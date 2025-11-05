from __future__ import annotations

import asyncio
import logging
from typing import AsyncIterator, List, Optional
from io import StringIO
from fastapi import HTTPException
from src.application.exceptions.exceptions import BadGatewayError, GatewayTimeoutError

from src.application.ports.output.conversation_output_port import ConversationOutputPort
from src.application.ports.output.gemini_output_port import GeminiOutputPort
from src.application.ports.output.message_output_port import MessageOutputPort
from src.domain.vo.message_request import MessageRequest
from src.application.ports.input.gemini_input_port import GeminiInputPort
from src.domain.utils.validators import validate_message_content, validate_model_name
from src.domain.utils.utils import generate_unique_id, get_current_timestamp
from src.application.config.config import settings
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
        return resp

    async def query_stream(self, message_request: MessageRequest) -> AsyncIterator[str]:
        user_msg, model_hint = message_request.to_domain()
        user_msg.content = validate_message_content(user_msg.content)
        await self._persist_user_message(user_msg)

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
            raise BadGatewayError(f"Gemini stream error: {exc}")

        # Accumulate in a StringIO to reduce list growth overhead
        buffer = StringIO()
        try:
            async for part in stream_iter:
                if part is None:
                    continue
                buffer.write(part)
                yield part
        except asyncio.CancelledError:
            logger.info("Streaming to client cancelled")
            raise
        except Exception as exc:
            logger.exception("Error while streaming from Gemini: %s", exc)
            # Stop iteration; downstream StreamingResponse will close the connection.
            return

        # Stream finished successfully, persist the assistant message once
        full_text = buffer.getvalue()
        await self._persist_assistant_message(user_msg.conversation_id, full_text)
        