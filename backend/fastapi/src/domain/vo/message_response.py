from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class MessageResponse(BaseModel):
    id: Optional[int]
    conversation_id: str
    role: str
    content: str
    created_at: Optional[datetime]

    class Config:
        orm_mode = True

    @classmethod
    def from_domain(cls, domain_obj):
        return cls(id=domain_obj.id, conversation_id=domain_obj.conversation_id, role=domain_obj.role, content=domain_obj.content, created_at=domain_obj.created_at)

    def to_domain(self):
        # returning a simple dict-like object; callers can construct Domain dataclass if needed
        return {
            "id": self.id,
            "conversation_id": self.conversation_id,
            "role": self.role,
            "content": self.content,
            "created_at": self.created_at,
        }
