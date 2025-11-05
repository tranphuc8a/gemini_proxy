from fastapi import Body
from pydantic import BaseModel


class MessageUpdateRequest(BaseModel):
    id: str
    content: str
    role: str | None = None

    @staticmethod
    def as_body(
        id: str = Body(..., min_length=1, description="Message ID (non-empty)"),
        content: str = Body(..., min_length=0, description="Updated message content"),
        role: str | None = Body(None, description="Optional role (user/model)")
    ) -> "MessageUpdateRequest":
        return MessageUpdateRequest(
            id=id,
            content=content,
            role=role,
        )
