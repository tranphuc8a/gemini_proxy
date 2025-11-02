from abc import ABC, abstractmethod
from typing import AsyncIterator, Dict, Any, List, Optional

from domain.models.message_domain import MessageDomain

class GeminiOutputPort(ABC):
    """
    Output port interface cho GeminI (tương tự các output port khác).
    Định nghĩa các phương thức mà adapter (infrastructure) phải triển khai.
    """

    @abstractmethod
    async def generate(
        self, model: str, message: MessageDomain, history: List[MessageDomain]
    ) -> str:
        """
        Sinh một phản hồi hoàn chỉnh từ Gemini.
        Trả về một dict chứa ít nhất:
          - "text": str  (phần văn bản trả về)
          - "raw": Any   (dữ liệu thô/metadata nếu cần)
        """
        pass

    @abstractmethod
    async def stream_generate(
        self, model: str, message: MessageDomain, history: List[MessageDomain]
    ) -> AsyncIterator[str]:
        """
        Sinh phản hồi theo luồng (streaming). Trả về iterator async yield các phần text dần dần.
        Adapter nên đảm bảo đóng luồng khi kết thúc.
        """
        yield ""

    @abstractmethod
    async def stop(self) -> None:
        """
        Dừng hoặc huỷ tác vụ đang chạy (nếu adapter hỗ trợ).
        """
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """
        Kiểm tra trạng thái kết nối/availability của Gemini adapter.
        Trả về True nếu healthy, False nếu không.
        """
        pass