from __future__ import annotations
import abc
from collections.abc import AsyncIterator

from domain.vo.message_request import MessageRequest

class GeminiInputPort(abc.ABC):
    """
    Input port cho Gemini — định nghĩa các phương thức mà layer cao hơn (ví dụ controller)
    sẽ gọi để tương tác với service/ứng dụng thực thi logic Gemini.
    """

    @abc.abstractmethod
    async def query(self, message_request: MessageRequest) -> str:
        pass
    
    @abc.abstractmethod
    async def query_stream(self, message_request: MessageRequest) -> AsyncIterator[str]:
        pass