from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from typing import AsyncIterator
from src.application.ports.input.gemini_input_port import GeminiInputPort
from src.domain.vo.message_request import MessageRequest
from src.adapter.factory.service_factory import ServiceFactory


router = APIRouter(prefix="/gemini", tags=["gemini"])


@router.post("/query", response_model=str)
async def query(
    message_request: MessageRequest = Depends(MessageRequest.as_body),
    gemini_service: GeminiInputPort = Depends(ServiceFactory.get_gemini_input_port),
):
    """Synchronous (non-streaming) Gemini query returning the full assistant text."""
    return await gemini_service.query(message_request)


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
        async for chunk in gemini_service.query_stream(message_request):
            # encode each string chunk as utf-8 bytes
            yield chunk.encode("utf-8")

    return StreamingResponse(generator(), media_type="text/plain; charset=utf-8")
