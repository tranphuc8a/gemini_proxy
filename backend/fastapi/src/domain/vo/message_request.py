
from fastapi.utils import generate_unique_id
from pydantic import BaseModel
from fastapi import Body

from domain.models.message_domain import MessageDomain
from domain.utils.utils import get_current_timestamp, generate_unique_id


class MessageRequest(BaseModel):
    conversation_id: str
    content: str
    model: str

    class Config:
        orm_mode = True

    def to_domain(self) -> tuple[MessageDomain, str]:
        return (
            MessageDomain(
                id=generate_unique_id("msg"),
                conversation_id=self.conversation_id,
                role="user",
                content=self.content,
                created_at=get_current_timestamp()
            ),
            self.model
        )

    @staticmethod
    def as_body(
        conversation_id: str = Body(..., description="ID cuộc chuyện (không rỗng)", min_length=1),
        content: str = Body(..., description="Nội dung tin nhắn (1-2000 ký tự)", min_length=1, max_length=2000),
        model: str = Body(..., description="Tên mô hình (ví dụ: 'gpt-4')", min_length=1),
        ) -> "MessageRequest":
        return MessageRequest(
            conversation_id=conversation_id,
            content=content,
            model=model,
        )
