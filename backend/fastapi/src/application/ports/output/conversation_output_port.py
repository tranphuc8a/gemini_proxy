from abc import ABC, abstractmethod
from typing import List, Optional, Tuple
from src.domain.models.conversation_domain import ConversationDomain as Conversation



class ConversationOutputPort(ABC):
    @abstractmethod
    async def get_by_id(self, conversation_id: str) -> Optional[Conversation]:
        pass

    @abstractmethod
    async def get_all(self, limit: int, after: Optional[str], order: str) -> Tuple[List[Conversation], bool]:
        """Return a tuple (List[Conversation], has_more: bool).

        - order: 'asc' or 'desc' (by created_at)
        - after: conversation id cursor (optional)
        - offset: number of records to skip after the 'after' cursor
        - limit: max items to return
        """
        pass

    @abstractmethod
    async def save(self, conversation: Conversation) -> Conversation:
        pass

    @abstractmethod
    async def delete(self, conversation: Conversation) -> bool:
        pass


