from abc import ABC, abstractmethod


class MessageOutputPort(ABC):
    @abstractmethod
    async def get_list_by_conversation(self, conversation_id: str, offset: int, limit: int):
        raise NotImplementedError()
