from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from src.domain.vo.message_response import MessageResponse


class ConversationResponse(BaseModel):
    id: Optional[str]
    name: Optional[str] = Field(default="New Conversation")
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    messages: List[MessageResponse] = []

    class Config:
        orm_mode = True

    @classmethod
    def from_domain(cls, domain_obj):
        messages = [MessageResponse.from_domain(m) for m in getattr(domain_obj, "messages", [])]
        return cls(id=domain_obj.id, name=domain_obj.name, created_at=domain_obj.created_at, updated_at=domain_obj.updated_at, messages=messages)

    def to_domain(self):
        return {
            "id": self.id,
            "name": self.name,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "messages": [m.to_domain() for m in self.messages],
        }
