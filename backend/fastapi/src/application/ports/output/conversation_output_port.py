from abc import ABC, abstractmethod
from typing import Optional
from src.domain.models import ConversationDomain as Conversation, MessageDomain as Message


class ConversationOutputPort(ABC):
    @abstractmethod
    async def get_by_id(self, conversation_id: str) -> Optional[Conversation]:
        raise NotImplementedError()

    @abstractmethod
    async def get_all(self, limit: int, after: Optional[str], offset: int, order: str):
        """Return a tuple (List[Conversation], has_more: bool).

        - order: 'asc' or 'desc' (by created_at)
        - after: conversation id cursor (optional)
        - offset: number of records to skip after the 'after' cursor
        - limit: max items to return
        """
        raise NotImplementedError()

    @abstractmethod
    async def save(self, conversation: Conversation) -> Conversation:
        raise NotImplementedError()

    @abstractmethod
    async def delete(self, conversation: Conversation) -> None:
        raise NotImplementedError()


