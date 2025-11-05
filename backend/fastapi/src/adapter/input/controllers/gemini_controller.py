from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from typing import AsyncIterator
from src.application.ports.input.gemini_input_port import GeminiInputPort
from src.domain.vo.message_request import MessageRequest
from src.adapter.factory.service_factory import ServiceFactory
from src.adapter.input.controllers.response_utils import success_response
import json


router = APIRouter(prefix="/gemini", tags=["gemini"])


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
    """Streaming endpoint: returns a streaming response of partial text chunks.

    The streaming generator yields plain text fragments. Clients can treat this as
    a simple text stream. For richer SSE behavior a transformation is possible.
    """

    async def generator() -> AsyncIterator[bytes]:
        # Yield Server-Sent Events (SSE) style 'data:' frames so clients such as
        # EventSource or curl can process parts immediately. Each event is
        # terminated by a blank line. This also tends to reduce buffering in
        # intermediate proxies.
        async for chunk in gemini_service.query_stream(message_request):
            if chunk is None:
                continue
            # Ensure chunk is a str and strip accidental newlines
            text = str(chunk)
            # SSE data frame
            data = f"data: {json.dumps(text, ensure_ascii=False)}\n\n"
            yield data.encode("utf-8")

    headers = {
        # Prevent proxies from buffering the response
        "Cache-Control": "no-cache, no-transform",
        # For nginx / proxy buffering bypass
        "X-Accel-Buffering": "no",
    }

    return StreamingResponse(generator(), media_type="text/event-stream", headers=headers)
