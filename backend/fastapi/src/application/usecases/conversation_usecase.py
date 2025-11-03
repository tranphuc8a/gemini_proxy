from typing import Optional
from src.domain.enums.enums import ERole
from src.domain.models.message_domain import MessageDomain
from src.application.ports.input.conversation_input_port import ConversationInputPort
from src.application.ports.output.conversation_output_port import ConversationOutputPort
from src.application.ports.output.message_output_port import MessageOutputPort
from src.domain.utils.utils import generate_unique_id, get_current_timestamp
from src.domain.vo.message_response import MessageResponse
from src.domain.vo.conversation_update_request import ConversationUpdateRequest
from src.domain.vo.conversation_response import ConversationResponse
from src.domain.vo.list_response import ListResponse
from src.domain.models.conversation_domain import ConversationDomain
from fastapi import HTTPException


class ConversationUseCase(ConversationInputPort):
    LATEST_MESSAGE_COUNT = 10
    CONVERSATION_NEW_NAME = "New Conversation"

    def __init__(self, conversation_repo: ConversationOutputPort, message_repo: MessageOutputPort):
        self.conversation_repo = conversation_repo
        self.message_repo = message_repo

    async def get_conversation_detail(self, conversation_id: str) -> ConversationResponse:
        conv = await self.conversation_repo.get_by_id(conversation_id)
        if conv is None:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # fetch latest messages explicitly to avoid async lazy-loading issues
        messages, _ = await self.message_repo.get_list_by_conversation(conversation_id, limit=self.LATEST_MESSAGE_COUNT, after=None, order="desc")
        conv.messages = messages
        return ConversationResponse.from_domain(conv)

    async def get_conversation_list(self, 
                                    after: Optional[str] = None, 
                                    limit: int = 10, 
                                    order: Optional[str] = "desc") -> ListResponse[ConversationResponse]:
        """Return a paginated ListResponse of conversations.

        - order: 'asc' or 'desc' (by created_at)
        - after: id cursor (optional)
        - offset: number of items to skip after the cursor
        - limit: max items to return
        """
        items, has_more = await self.conversation_repo.get_all(limit=limit, after=after, order=order if order else "desc")
        # convert to response VO list
        data = [ConversationResponse.from_domain(c) for c in items]
        first_id = data[0].id if data else None
        last_id = data[-1].id if data else None
        return ListResponse[ConversationResponse](data=data, first_id=first_id, last_id=last_id, has_more=has_more)

    async def get_conversation_messages(self, 
                                        conversation_id: str, 
                                        after: Optional[str] = None, 
                                        limit: int = 10, 
                                        order: Optional[str] = "desc") -> ListResponse[MessageResponse]:
        conv = await self.conversation_repo.get_by_id(conversation_id)
        if conv is None:
            raise HTTPException(status_code=404, detail="Conversation not found")
        messageList, has_more = await self.message_repo\
            .get_list_by_conversation(conversation_id, after=after, limit=limit, order=order if order else "desc")
        data = [MessageResponse.from_domain(m) for m in messageList]
        first_id = data[0].id if data else None
        last_id = data[-1].id if data else None
        return ListResponse[MessageResponse](
            data=data, 
            first_id=first_id, 
            last_id=last_id, 
            has_more=has_more
        )

    async def create_conversation(self) -> ConversationResponse:
        conv = ConversationDomain(
            id=generate_unique_id("conv"), 
            name=self.CONVERSATION_NEW_NAME,
            created_at=get_current_timestamp(),
            updated_at=None
        )
        saved = await self.conversation_repo.save(conv)
        return ConversationResponse.from_domain(saved)

    async def update_conversation(self, request: ConversationUpdateRequest) -> ConversationResponse:
        conv = await self.conversation_repo.get_by_id(request.id)
        if conv is None:
            raise HTTPException(status_code=404, detail="Conversation not found")
        conv.name = request.name
        conv.updated_at = get_current_timestamp()
        updated = await self.conversation_repo.save(conv)
        return ConversationResponse.from_domain(updated)

    async def delete_conversation(self, conversation_id: str) -> bool:
        conv = await self.conversation_repo.get_by_id(conversation_id)
        if conv is None:
            raise HTTPException(status_code=404, detail="Conversation not found")
        await self.conversation_repo.delete(conv)
        return True

    async def post_message(self, conversation_id: str, content: str) -> MessageResponse:
        conv = await self.conversation_repo.get_by_id(conversation_id)
        if conv is None:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        message = MessageDomain(
            id=generate_unique_id("msg"),
            conversation_id=conversation_id,
            role=ERole.USER,
            content=content,
            created_at=get_current_timestamp(),
        )
        saved_message = await self.message_repo.save(message)
        return MessageResponse.from_domain(saved_message)
    