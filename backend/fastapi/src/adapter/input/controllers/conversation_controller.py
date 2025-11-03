from fastapi import APIRouter, Query, Depends
from typing import Optional
from src.application.ports.input.conversation_input_port import ConversationInputPort
from src.domain.vo.conversation_response import ConversationResponse
from src.domain.vo.conversation_update_request import ConversationUpdateRequest
from src.domain.vo.list_response import ListResponse
from src.adapter.factory.service_factory import ServiceFactory


# Router organized as a grouped resource; prefix is applied when included in the app
router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("/", response_model=ListResponse[ConversationResponse])
async def list_conversations(
    after: Optional[str] = Query(None),
    limit: int = Query(10, gt=0),
    order: str = Query("desc", regex="^(asc|desc)$"),
    conversation_service: ConversationInputPort = Depends(ServiceFactory.get_conversation_input_port)
):
    """Cursor pagination: `after` is the id of the anchor element; return `limit` items after that anchor, skipping `offset` items, ordered by `created_at`."""
    return await conversation_service.get_conversation_list(limit=limit, after=after, order=order)


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: str,
    conversation_service: ConversationInputPort = Depends(ServiceFactory.get_conversation_input_port)
):
    return await conversation_service.get_conversation_detail(conversation_id)


@router.post("/", response_model=ConversationResponse)
async def create_conversation(
    conversation_service: ConversationInputPort = Depends(ServiceFactory.get_conversation_input_port)
):
    return await conversation_service.create_conversation()


@router.put("/", response_model=ConversationResponse)
async def update_conversation(
    request: ConversationUpdateRequest,
    conversation_service: ConversationInputPort = Depends(ServiceFactory.get_conversation_input_port)
):
    return await conversation_service.update_conversation(request)


@router.delete("/{conversation_id}", response_model=ConversationResponse)
async def delete_conversation(
    conversation_id: str,
    conversation_service: ConversationInputPort = Depends(ServiceFactory.get_conversation_input_port)
):
    return await conversation_service.delete_conversation(conversation_id)


@router.post("/{conversation_id}/messages")
async def post_message(
    conversation_id: str,
    content: str,
    conversation_service: ConversationInputPort = Depends(ServiceFactory.get_conversation_input_port)
):
    return await conversation_service.post_message(conversation_id, content)
