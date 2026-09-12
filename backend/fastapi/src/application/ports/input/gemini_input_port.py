from __future__ import annotations
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator

from src.domain.vo.message_request import MessageRequest
from src.domain.vo.stream_event import StreamEvent

class GeminiInputPort(ABC):
    """
    Input port cho Gemini — định nghĩa các phương thức mà layer cao hơn (ví dụ controller)
    sẽ gọi để tương tác với service/ứng dụng thực thi logic Gemini.
    """

    @abstractmethod
    async def query(self, message_request: MessageRequest) -> str:
        pass

    @abstractmethod
    async def query_stream(self, message_request: MessageRequest) -> AsyncIterator[StreamEvent]:
        """Yield the answer as StreamEvent frames.

        The sequence is zero or more DELTA frames followed by exactly one
        terminal frame: DONE when the answer completed, ERROR when it did not.
        """
        yield StreamEvent.delta("")
