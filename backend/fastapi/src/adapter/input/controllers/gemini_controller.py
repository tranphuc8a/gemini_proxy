from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from typing import AsyncIterator
from src.application.ports.input.gemini_input_port import GeminiInputPort
from src.domain.enums.enums import EStreamEvent
from src.domain.vo.message_request import MessageRequest
from src.domain.vo.stream_event import StreamEvent
from src.adapter.factory.service_factory import ServiceFactory
from src.adapter.input.controllers.response_utils import success_response
import json
import logging


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/gemini", tags=["gemini"])


def _sse_frame(event: StreamEvent) -> bytes:
    """Render one StreamEvent as a Server-Sent Events frame.

    Delta frames keep the historical shape — a bare JSON string on `data:` with
    no event name — so the payload stays small on the hot path. Terminal frames
    are named events carrying a JSON object.
    """
    if event.type == EStreamEvent.DELTA:
        body = json.dumps(event.text or "", ensure_ascii=False)
        return f"data: {body}\n\n".encode("utf-8")

    payload = event.model_dump(exclude_none=True, exclude={"type"})
    body = json.dumps(payload, ensure_ascii=False)
    return f"event: {event.type.value}\ndata: {body}\n\n".encode("utf-8")


@router.post("/query", response_model=str)
async def query(
    message_request: MessageRequest = Depends(MessageRequest.as_body),
    gemini_service: GeminiInputPort = Depends(ServiceFactory.get_gemini_input_port),
):
    """Synchronous (non-streaming) Gemini query returning the full assistant text."""
    resp = await gemini_service.query(message_request)
    return success_response(data=resp, message="ok", status_code=200)


@router.post("/stream")
async def query_stream(
    message_request: MessageRequest = Depends(MessageRequest.as_body),
    gemini_service: GeminiInputPort = Depends(ServiceFactory.get_gemini_input_port),
):
    """Streaming endpoint: Server-Sent Events carrying the answer as it arrives.

    A StreamingResponse commits its status line before the first chunk, so a
    mid-stream failure cannot be reported as an HTTP error. It is reported as a
    terminal `error` event instead; the stream always ends in either `done` or
    `error`.
    """

    async def generator() -> AsyncIterator[bytes]:
        try:
            async for event in gemini_service.query_stream(message_request):
                yield _sse_frame(event)
        except Exception as exc:  # the use case failed outside its own guard
            logger.exception("Unhandled error while streaming Gemini answer: %s", exc)
            yield _sse_frame(StreamEvent.error(str(exc) or "Streaming failed"))

    headers = {
        # Prevent proxies from buffering the response
        "Cache-Control": "no-cache, no-transform",
        # For nginx / proxy buffering bypass
        "X-Accel-Buffering": "no",
    }

    return StreamingResponse(generator(), media_type="text/event-stream", headers=headers)
