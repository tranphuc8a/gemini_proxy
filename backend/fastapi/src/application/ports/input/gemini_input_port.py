from __future__ import annotations
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator

from domain.vo.message_request import MessageRequest

class GeminiInputPort(ABC):
    """
    Input port cho Gemini — định nghĩa các phương thức mà layer cao hơn (ví dụ controller)
    sẽ gọi để tương tác với service/ứng dụng thực thi logic Gemini.
    """

    @abstractmethod
    async def query(self, message_request: MessageRequest) -> str:
        pass
    
    @abstractmethod
    async def query_stream(self, message_request: MessageRequest) -> AsyncIterator[str]:
        yield ""