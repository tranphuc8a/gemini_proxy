from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from domain.models.conversation_domain import ConversationDomain
from src.domain.vo.message_response import MessageResponse


class ConversationResponse(BaseModel):
    id: Optional[str]
    name: Optional[str] = Field(default="New Conversation")
    created_at: Optional[int]
    updated_at: Optional[int]
    messages: List[MessageResponse] = []

    class Config:
        orm_mode = True

    @classmethod
    def from_domain(cls, domain_obj: ConversationDomain):
        messages = [MessageResponse.from_domain(m) for m in getattr(domain_obj, "messages", [])]
        return cls(
            id=domain_obj.id, 
            name=domain_obj.name, 
            created_at=domain_obj.created_at, 
            updated_at=domain_obj.updated_at, 
            messages=messages
        )
