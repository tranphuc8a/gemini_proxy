from abc import ABC, abstractmethod
from typing import Optional
from src.domain.vo.conversation_update_request import ConversationUpdateRequest
from src.domain.vo.conversation_response import ConversationResponse
from src.domain.vo.message_response import MessageResponse
from src.domain.vo.list_response import ListResponse

class ConversationInputPort(ABC):
    @abstractmethod
    async def get_conversation_detail(self, conversation_id: str) -> ConversationResponse:
        pass

    @abstractmethod
    async def get_conversation_list(self, after: Optional[str] = None, limit: int = 10, order: Optional[str] = "desc") -> ListResponse[ConversationResponse]:
        pass

    @abstractmethod
    async def get_conversation_messages(self, conversation_id: str, after: Optional[str] = None, limit: int = 10, order: Optional[str] = "desc") -> ListResponse[MessageResponse]:
        pass

    @abstractmethod
    async def create_conversation(self) -> ConversationResponse:
        pass

    @abstractmethod
    async def update_conversation(self, request: ConversationUpdateRequest) -> ConversationResponse:
        pass

    @abstractmethod
    async def delete_conversation(self, conversation_id: str) -> bool:
        pass
