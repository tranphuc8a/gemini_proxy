from abc import ABC, abstractmethod
from typing import Optional
from src.domain.vo.conversation_update_request import ConversationUpdateRequest
from src.domain.models.conversation_domain import ConversationDomain

class ConversationInputPort(ABC):
    @abstractmethod
    async def get_conversation_detail(self, conversation_id: str) -> ConversationDomain:
        pass

    @abstractmethod
    async def get_conversation_list(self, limit: int = 10, after: Optional[str] = None, offset: int = 0, order: str = "desc"):
        pass

    @abstractmethod
    async def get_conversation_messages(self, conversation_id: str, page: int = 0, size: int = 10):
        pass

    @abstractmethod
    async def create_conversation(self):
        pass

    @abstractmethod
    async def update_conversation(self, request: ConversationUpdateRequest):
        pass

    @abstractmethod
    async def delete_conversation(self, conversation_id: str):
        pass

    @abstractmethod
    async def send_message(self, conversation_id: str, content: str, role: str = "user") -> object:
        pass
