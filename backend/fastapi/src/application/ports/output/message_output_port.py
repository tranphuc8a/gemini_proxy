from abc import ABC, abstractmethod
from typing import List, Optional

from domain.models.message_domain import MessageDomain


class MessageOutputPort(ABC):
    @abstractmethod
    async def get_list_by_conversation(self, conversation_id: str, after: Optional[str], limit: int, order: str) -> tuple[List[MessageDomain], bool]:
        pass
    
    @abstractmethod
    async def get_all_by_conversation(self, conversation_id: str) -> List[MessageDomain]:
        pass

    @abstractmethod
    async def save(self, message: MessageDomain) -> MessageDomain:
        pass
    
    @abstractmethod
    async def delete(self, message: MessageDomain) -> bool:
        pass
    
    @abstractmethod
    async def delete_by_conversation(self, conversation_id: str) -> bool:
        pass
    
    @abstractmethod
    async def count_by_conversation(self, conversation_id: str) -> int:
        pass
    
    @abstractmethod
    async def get_latest_by_conversation(self, conversation_id: str, count: int) -> List[MessageDomain]:
        pass
    
    @abstractmethod
    async def get_by_id(self, message_id: int) -> MessageDomain:
        pass
    
    @abstractmethod
    async def update(self, message: MessageDomain) -> MessageDomain:
        pass
    
    @abstractmethod
    async def get_by_conversation_and_role(self, conversation_id: str, role: str) -> List[MessageDomain]:
        pass
    