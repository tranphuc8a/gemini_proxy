from fastapi import APIRouter, Query, Depends
from typing import Optional
from src.application.usecases.conversation_usecase import ConversationUseCase
from src.adapter.repositories.conversation_repository import ConversationRepository
from src.adapter.repositories.message_repository import MessageRepository
from src.domain.vo.conversation_response import ConversationResponse
from src.domain.vo.conversation_update_request import ConversationUpdateRequest
from domain.vo.list_response import ListResponse
from src.adapter.db.base import get_async_session
from sqlalchemy.ext.asyncio import AsyncSession


# Router organized as a grouped resource; prefix is applied when included in the app
router = APIRouter(prefix="/conversations", tags=["conversations"])

# create repositories and usecase (simple wiring)
conversation_repo = ConversationRepository()
message_repo = MessageRepository()
usecase = ConversationUseCase(conversation_repo, message_repo)


@router.get("/", response_model=ListResponse[ConversationResponse])
async def list_conversations(
    after: Optional[str] = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(10, gt=0),
    order: str = Query("desc", regex="^(asc|desc)$"),
    db: AsyncSession = Depends(get_async_session),
):
    """Cursor pagination: `after` is the id of the anchor element; return `limit` items after that anchor, skipping `offset` items, ordered by `created_at`."""
    return await usecase.get_conversation_list(db=db, limit=limit, after=after, offset=offset, order=order)


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(conversation_id: str, db: AsyncSession = Depends(get_async_session)):
    return await usecase.get_conversation_detail(db, conversation_id)


@router.post("/", response_model=ConversationResponse)
async def create_conversation(db: AsyncSession = Depends(get_async_session)):
    return await usecase.create_conversation(db)


@router.put("/", response_model=ConversationResponse)
async def update_conversation(request: ConversationUpdateRequest, db: AsyncSession = Depends(get_async_session)):
    return await usecase.update_conversation(db, request)


@router.delete("/{conversation_id}", response_model=ConversationResponse)
async def delete_conversation(conversation_id: str, db: AsyncSession = Depends(get_async_session)):
    return await usecase.delete_conversation(db, conversation_id)


@router.post("/{conversation_id}/messages")
async def send_message(conversation_id: str, content: str, db: AsyncSession = Depends(get_async_session)):
    """Send a message in a conversation: persist user message, call Gemini, persist assistant reply.

    This endpoint is compatible with both the old synchronous usecase signature
    (send_message(conversation_id, content, role="user")) as well as the new
    async signature that accepts the DB session first
    (send_message(db, conversation_id, content, role="user")). We detect the
    callable signature at runtime to support monkeypatch-based tests as well.
    """
    import inspect

    fn = usecase.send_message
    sig = inspect.signature(fn)
    params = list(sig.parameters.keys())
    # If the first parameter is 'db' we assume new signature
    if params and params[0] == "db":
        return await fn(db, conversation_id, content, role="user")

    # Otherwise call old style; support both sync and async implementations
    res = fn(conversation_id, content, role="user")
    if inspect.isawaitable(res):
        return await res
    return res
