from fastapi import APIRouter, Query, Depends
from typing import Optional, List
from src.adapter.factory.service_factory import ServiceFactory
from src.application.ports.output.message_output_port import MessageOutputPort
from src.application.ports.input.conversation_input_port import ConversationInputPort
from src.domain.vo.message_response import MessageResponse
from src.domain.vo.list_response import ListResponse
from src.domain.vo.message_update_request import MessageUpdateRequest
from src.domain.models.message_domain import MessageDomain
from src.adapter.input.controllers.response_utils import success_response


router = APIRouter(prefix="/messages", tags=["messages"])


@router.get("/", response_model=ListResponse[MessageResponse])
async def list_messages(
    conversation_id: Optional[str] = Query(None, description="Filter by conversation id"),
    after: Optional[str] = Query(None),
    limit: int = Query(20, gt=0),
    order: str = Query("desc", regex="^(asc|desc)$"),
    message_repo: MessageOutputPort = Depends(ServiceFactory.get_message_output_port),
):
    """List messages. If `conversation_id` is provided, returns messages for that conversation (cursor pagination)."""
    if conversation_id:
        messages, has_more = await message_repo.get_list_by_conversation(conversation_id, after, limit, order)
        data: List[MessageResponse] = [MessageResponse.from_domain(m) for m in messages]
        first_id = data[0].id if data else None
        last_id = data[-1].id if data else None
        payload = ListResponse[MessageResponse](data=data, first_id=first_id, last_id=last_id, has_more=has_more)
        return success_response(data=payload, message="ok", status_code=200)
    # If no conversation_id provided, return empty list
    payload = ListResponse[MessageResponse](data=[], first_id=None, last_id=None, has_more=False)
    return success_response(data=payload, message="ok", status_code=200)


@router.get("/{message_id}", response_model=MessageResponse)
async def get_message(
    message_id: str,
    message_repo: MessageOutputPort = Depends(ServiceFactory.get_message_output_port),
):
    msg = await message_repo.get_by_id(message_id)
    return success_response(data=MessageResponse.from_domain(msg), message="ok", status_code=200)


@router.put("/", response_model=MessageResponse)
async def update_message(
    request: MessageUpdateRequest = Depends(MessageUpdateRequest.as_body),
    message_repo: MessageOutputPort = Depends(ServiceFactory.get_message_output_port),
):
    # retrieve existing message
    existing = await message_repo.get_by_id(request.id)
    # apply updates
    updated = MessageDomain(
        id=existing.id,
        conversation_id=existing.conversation_id,
        role=request.role if request.role is not None else existing.role,
        content=request.content,
        created_at=existing.created_at,
    )
    saved = await message_repo.update(updated)
    return success_response(data=MessageResponse.from_domain(saved), message="ok", status_code=200)


@router.delete("/{message_id}")
async def delete_message(
    message_id: str,
    message_repo: MessageOutputPort = Depends(ServiceFactory.get_message_output_port),
):
    existing = await message_repo.get_by_id(message_id)
    result = await message_repo.delete(existing)
    return success_response(data={"deleted": result}, message="deleted", status_code=200)


# Helper endpoint: messages by conversation (convenience)
@router.get("/by-conversation/{conversation_id}", response_model=ListResponse[MessageResponse])
async def get_messages_by_conversation(
    conversation_id: str,
    after: Optional[str] = Query(None),
    limit: int = Query(20, gt=0),
    order: str = Query("desc", regex="^(asc|desc)$"),
    conversation_service: ConversationInputPort = Depends(ServiceFactory.get_conversation_input_port),
):
    data = await conversation_service.get_conversation_messages(conversation_id=conversation_id, after=after, limit=limit, order=order)
    return success_response(data=data, message="ok", status_code=200)
