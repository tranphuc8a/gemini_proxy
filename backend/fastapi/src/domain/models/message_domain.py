from pydantic import BaseModel
from src.domain.enums.enums import ERole


class MessageDomain(BaseModel):
    id: str
    conversation_id: str
    role: ERole
    content: str
    created_at: int

    class Config:
        from_attributes = True
