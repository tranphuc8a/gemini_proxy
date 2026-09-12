from __future__ import annotations

import asyncio
import logging
import re
from typing import AsyncIterator, List, Optional
from io import StringIO
from fastapi import HTTPException
from src.application.exceptions.exceptions import BadGatewayError, GatewayTimeoutError

from src.application.ports.output.conversation_output_port import ConversationOutputPort
from src.application.ports.output.gemini_output_port import GeminiOutputPort
from src.application.ports.output.message_output_port import MessageOutputPort
from src.domain.vo.message_request import MessageRequest
from src.domain.vo.stream_event import StreamEvent
from src.application.ports.input.gemini_input_port import GeminiInputPort
from src.domain.utils.validators import validate_message_content, validate_model_name
from src.domain.utils.utils import generate_unique_id, get_current_timestamp
from src.application.config.config import settings
from src.domain.models.conversation_domain import ConversationDomain
from src.domain.models.message_domain import MessageDomain
from src.domain.enums.enums import EModel, ERole

logger = logging.getLogger(__name__)


class GeminiUseCase(GeminiInputPort):
    """Use case coordinating Gemini calls, persistence and conversation updates.

    Behavior:
    - Validate and persist incoming user message.
    - Build a short history and call the GeminiOutputPort.
    - Persist assistant response and update conversation metadata.
    - Stream-supporting: yields chunks as produced by the adapter.
    """

    # A conversation starts life under this placeholder; the first user message
    # replaces it.
    DEFAULT_CONVERSATION_NAME = ConversationDomain.DEFAULT_NAME
    TITLE_MAX_LENGTH = 60

    def __init__(
        self,
        gemini_output_port: GeminiOutputPort,
        message_output_port: MessageOutputPort,
        conversation_output_port: ConversationOutputPort,
    ):
        self.gemini_output_port = gemini_output_port
        self.message_output_port = message_output_port
        self.conversation_output_port = conversation_output_port

    async def _persist_user_message(self, message_domain: MessageDomain) -> Optional[MessageDomain]:
        try:
            return await self.message_output_port.save(message_domain)
        except Exception as exc:  # pragma: no cover - persistence should not break core flow
            logger.exception("Failed to persist user message: %s", exc)
            return None

    @staticmethod
    def _derive_title(text: str) -> str:
        """Turn the first user message into a sidebar title.

        Takes the first non-empty line, drops the markdown punctuation that would
        otherwise read as noise in a one-line label, and truncates on a word
        boundary.
        """
        first_line = next((ln.strip() for ln in (text or "").splitlines() if ln.strip()), "")
        cleaned = re.sub(r"^[#>\-*\s]+", "", first_line)
        cleaned = re.sub(r"[`*_~]", "", cleaned).strip()
        if not cleaned:
            return GeminiUseCase.DEFAULT_CONVERSATION_NAME
        if len(cleaned) <= GeminiUseCase.TITLE_MAX_LENGTH:
            return cleaned
        head = cleaned[: GeminiUseCase.TITLE_MAX_LENGTH]
        cut = head.rfind(" ")
        if cut > GeminiUseCase.TITLE_MAX_LENGTH // 2:
            head = head[:cut]
        return head.rstrip() + "..."

    async def _touch_conversation(self, conversation_id: Optional[str], first_user_text: Optional[str] = None) -> None:
        """Record activity on a conversation, and name it on the first message.

        Best-effort: chat must not fail because the sidebar metadata could not be
        written.
        """
        if not conversation_id:
            return
        try:
            conv = await self.conversation_output_port.get_by_id(conversation_id)
            if conv is None:
                return
            if first_user_text and (not conv.name or conv.name == self.DEFAULT_CONVERSATION_NAME):
                conv.name = self._derive_title(first_user_text)
            conv.updated_at = get_current_timestamp()
            await self.conversation_output_port.save(conv)
        except Exception:
            logger.exception("Failed to update conversation metadata for %s", conversation_id)

    async def _persist_assistant_message(self, conversation_id: Optional[str], text: str) -> Optional[MessageDomain]:
        if conversation_id is None:
            return None
        msg = MessageDomain(
            id=generate_unique_id("msg"),
            conversation_id=conversation_id,
            role=ERole.MODEL,
            content=text,
            created_at=get_current_timestamp(),
        )
        try:
            saved = await self.message_output_port.save(msg)
            return saved
        except Exception:
            logger.exception("Failed to persist assistant message for conversation %s", conversation_id)
            return None

    async def query(self, message_request: MessageRequest) -> str:
        # convert to domain object and validate
        user_msg, model_hint = message_request.to_domain()
        # sanitize/validate content
        user_msg.content = validate_message_content(user_msg.content)

        # persist user message (best-effort)
        await self._persist_user_message(user_msg)

        # determine model
        try:
            model = validate_model_name(model_hint or settings.GEMINI_URL or EModel.GEMINI_2_5_PRO)
            model_name = model.value if isinstance(model, EModel) else str(model)
        except Exception:
            model_name = str(model_hint or EModel.GEMINI_2_5_PRO)

        # build short history
        history: List[MessageDomain] = []
        if user_msg.conversation_id:
            try:
                history = await self.message_output_port.get_latest_by_conversation(user_msg.conversation_id, 100)
            except Exception:
                logger.debug("Could not load history for conversation %s", user_msg.conversation_id)

        # call Gemini with a timeout
        try:
            timeout = getattr(settings, "GEMINI_TIMEOUT_SECONDS", 30)
            resp = await asyncio.wait_for(
                self.gemini_output_port.generate(model_name, history), timeout=timeout
            )
        except asyncio.TimeoutError:
            logger.exception("Gemini generate timed out")
            raise GatewayTimeoutError("Gemini request timed out")
        except Exception as exc:
            logger.exception("Gemini generate failed: %s", exc)
            # Map adapter failures to a 502 Bad Gateway so callers know it's an upstream problem
            raise BadGatewayError(f"Gemini service error: {exc}")

        # persist assistant message and update conversation
        await self._persist_assistant_message(user_msg.conversation_id, resp)
        await self._touch_conversation(user_msg.conversation_id, first_user_text=user_msg.content)
        return resp

    async def query_stream(self, message_request: MessageRequest) -> AsyncIterator[StreamEvent]:
        """Stream an answer as a sequence of StreamEvent frames.

        The stream always ends with exactly one terminal frame — DONE or ERROR —
        so a client can tell a completed answer from a broken one. An upstream
        failure used to end the iteration silently, which the browser read as a
        successful but empty response.
        """
        user_msg, model_hint = message_request.to_domain()
        user_msg.content = validate_message_content(user_msg.content)
        saved_user = await self._persist_user_message(user_msg)

        try:
            model = validate_model_name(model_hint or settings.GEMINI_URL or EModel.GEMINI_2_5_PRO)
            model_name = model.value if isinstance(model, EModel) else str(model)
        except Exception:
            model_name = str(model_hint or EModel.GEMINI_2_5_PRO)

        history: List[MessageDomain] = []
        if user_msg.conversation_id:
            try:
                history = await self.message_output_port.get_latest_by_conversation(user_msg.conversation_id, 100)
            except Exception:
                logger.debug("Could not load history for conversation %s", user_msg.conversation_id)

        # get stream iterator
        try:
            # stream_generate returns an async iterator (async generator); do not await it
            stream_iter = self.gemini_output_port.stream_generate(model_name, history)
        except Exception as exc:
            logger.exception("Gemini stream_generate not available or failed to start: %s", exc)
            yield StreamEvent.error(
                f"Gemini stream error: {exc}",
                user_message_id=saved_user.id if saved_user else None,
            )
            return

        # Accumulate in a StringIO to reduce list growth overhead
        buffer = StringIO()
        try:
            async for part in stream_iter:
                if part is None:
                    continue
                buffer.write(part)
                yield StreamEvent.delta(part)
        except asyncio.CancelledError:
            # The client went away mid-answer. Keep whatever arrived so the
            # conversation is not left with a dangling user message.
            logger.info("Streaming to client cancelled")
            partial = buffer.getvalue()
            if partial:
                await self._persist_assistant_message(user_msg.conversation_id, partial)
            await self._touch_conversation(user_msg.conversation_id, first_user_text=user_msg.content)
            raise
        except Exception as exc:
            logger.exception("Error while streaming from Gemini: %s", exc)
            partial = buffer.getvalue()
            if partial:
                await self._persist_assistant_message(user_msg.conversation_id, partial)
            await self._touch_conversation(user_msg.conversation_id, first_user_text=user_msg.content)
            yield StreamEvent.error(
                str(exc) or "Gemini stream failed",
                user_message_id=saved_user.id if saved_user else None,
            )
            return

        # Stream finished successfully, persist the assistant message once
        full_text = buffer.getvalue()
        saved_assistant = await self._persist_assistant_message(user_msg.conversation_id, full_text)
        await self._touch_conversation(user_msg.conversation_id, first_user_text=user_msg.content)
        yield StreamEvent.done(
            conversation_id=user_msg.conversation_id,
            user_message_id=saved_user.id if saved_user else None,
            message_id=saved_assistant.id if saved_assistant else None,
        )
