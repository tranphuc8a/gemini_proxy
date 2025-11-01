from __future__ import annotations

import asyncio
import logging
from typing import AsyncIterator, List, Optional

from application.ports.output.conversation_output_port import ConversationOutputPort
from application.ports.output.gemini_output_port import GeminiOutputPort
from application.ports.output.message_output_port import MessageOutputPort
from domain.vo.message_request import MessageRequest
from src.application.ports.input.gemini_input_port import GeminiInputPort
from src.domain.utils.validators import validate_message_content, validate_model_name
from src.domain.utils.utils import generate_unique_id, get_current_timestamp
from src.application.config.config import settings
from domain.models.message_domain import MessageDomain
from src.domain.enums.enums import EModel

logger = logging.getLogger(__name__)


class GeminiUseCase(GeminiInputPort):
    """Use case coordinating Gemini calls, persistence and conversation updates.

    Behavior:
    - Validate and persist incoming user message.
    - Build a short history and call the GeminiOutputPort.
    - Persist assistant response and update conversation metadata.
    - Stream-supporting: yields chunks as produced by the adapter.
    """

    def __init__(
        self,
        gemini_output_port: GeminiOutputPort,
        message_output_port: MessageOutputPort,
        conversation_output_port: ConversationOutputPort,
    ):
        self.gemini_output_port = gemini_output_port
        self.message_output_port = message_output_port
        self.conversation_output_port = conversation_output_port

    async def _persist_user_message(self, message_domain: MessageDomain) -> None:
        try:
            await self.message_output_port.save(message_domain)
        except Exception as exc:  # pragma: no cover - persistence should not break core flow
            logger.exception("Failed to persist user message: %s", exc)

    async def _persist_assistant_message(self, conversation_id: Optional[str], text: str) -> Optional[MessageDomain]:
        if conversation_id is None:
            return None
        msg = MessageDomain(
            id=generate_unique_id("msg"),
            conversation_id=conversation_id,
            role="bot",
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
            model = validate_model_name(model_hint or settings.GEMINI_URL or "gpt-4")
            model_name = model.value if isinstance(model, EModel) else str(model)
        except Exception:
            model_name = str(model_hint or "gpt-4")

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
                self.gemini_output_port.generate(model_name, user_msg, history), timeout=timeout
            )
        except asyncio.TimeoutError:
            logger.exception("Gemini generate timed out")
            raise
        except Exception:
            logger.exception("Gemini generate failed")
            raise

        # persist assistant message and update conversation
        await self._persist_assistant_message(user_msg.conversation_id, resp)
        return resp

    async def query_stream(self, message_request: MessageRequest) -> AsyncIterator[str]:
        user_msg, model_hint = message_request.to_domain()
        user_msg.content = validate_message_content(user_msg.content)
        await self._persist_user_message(user_msg)

        try:
            model = validate_model_name(model_hint or settings.GEMINI_URL or "gpt-4")
            model_name = model.value if isinstance(model, EModel) else str(model)
        except Exception:
            model_name = str(model_hint or "gpt-4")

        history: List[MessageDomain] = []
        if user_msg.conversation_id:
            try:
                history = await self.message_output_port.get_latest_by_conversation(user_msg.conversation_id, 10)
            except Exception:
                logger.debug("Could not load history for conversation %s", user_msg.conversation_id)

        # get stream iterator
        try:
            stream_iter = await self.gemini_output_port.stream_generate(model_name, user_msg, history)
        except Exception:
            logger.exception("Gemini stream_generate not available or failed to start")
            raise

        parts: List[str] = []
        async for part in stream_iter:
            parts.append(part)
            # best-effort append partials (adapter may implement append_streaming_response)
            try:
                if hasattr(self.message_output_port, "append_streaming_response"):
                    await self.message_output_port.append_streaming_response(part, conversation_id=user_msg.conversation_id)
            except Exception:
                logger.debug("Failed to append streaming part")
            yield part

        full = "".join(parts)
        await self._persist_assistant_message(user_msg.conversation_id, full)
        