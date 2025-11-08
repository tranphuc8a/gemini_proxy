from fastapi import APIRouter, Query, Depends
from typing import Optional, List
from src.domain.vo.message_response import MessageResponse
from src.application.ports.input.conversation_input_port import ConversationInputPort
from src.domain.vo.conversation_response import ConversationResponse
from src.domain.vo.conversation_update_request import ConversationUpdateRequest
from src.domain.vo.list_response import ListResponse
from src.adapter.factory.service_factory import ServiceFactory
from src.adapter.input.controllers.response_utils import success_response


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
    data = await conversation_service.get_conversation_list(limit=limit, after=after, order=order)
    return success_response(data=data, message="ok", status_code=200)


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: str,
    conversation_service: ConversationInputPort = Depends(ServiceFactory.get_conversation_input_port)
):
    data = await conversation_service.get_conversation_detail(conversation_id)
    return success_response(data=data, message="ok", status_code=200)


@router.post("/", response_model=ConversationResponse)
async def create_conversation(
    conversation_service: ConversationInputPort = Depends(ServiceFactory.get_conversation_input_port)
):
    data = await conversation_service.create_conversation()
    return success_response(data=data, message="created", status_code=201)


@router.put("/", response_model=ConversationResponse)
async def update_conversation(
    request: ConversationUpdateRequest,
    conversation_service: ConversationInputPort = Depends(ServiceFactory.get_conversation_input_port)
):
    data = await conversation_service.update_conversation(request)
    return success_response(data=data, message="updated", status_code=200)


@router.delete("/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    conversation_service: ConversationInputPort = Depends(ServiceFactory.get_conversation_input_port)
):
    result = await conversation_service.delete_conversation(conversation_id)
    return success_response(data={"deleted": result}, message="deleted", status_code=200)


@router.post("/{conversation_id}/messages")
async def post_message(
    conversation_id: str,
    content: str,
    conversation_service: ConversationInputPort = Depends(ServiceFactory.get_conversation_input_port)
):
    data = await conversation_service.post_message(conversation_id, content)
    return success_response(data=data, message="created", status_code=201)


@router.get("/{conversation_id}/messages", response_model=ListResponse[MessageResponse])
async def get_conversation_messages(
    conversation_id: str,
    after: Optional[str] = Query(None),
    limit: int = Query(10, gt=0),
    order: str = Query("desc", regex="^(asc|desc)$"),
    conversation_service: ConversationInputPort = Depends(ServiceFactory.get_conversation_input_port)
):
    """Get messages for a conversation (cursor pagination)."""
    data = await conversation_service.get_conversation_messages(conversation_id=conversation_id, after=after, limit=limit, order=order)
    return success_response(data=data, message="ok", status_code=200)


@router.get("/{conversation_id}/messages/recent", response_model=List[MessageResponse])
async def get_recent_messages(
    conversation_id: str,
    k: int = Query(5, gt=0, description="Number of latest messages to return (default 5)"),
    conversation_service: ConversationInputPort = Depends(ServiceFactory.get_conversation_input_port)
):
    data = await conversation_service.get_recent_messages(conversation_id=conversation_id, k=k)
    return success_response(data=data, message="ok", status_code=200)
