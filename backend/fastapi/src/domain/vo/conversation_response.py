from typing import List, Optional
from pydantic import BaseModel, Field
from src.domain.models.conversation_domain import ConversationDomain
from src.domain.vo.message_response import MessageResponse


class ConversationResponse(BaseModel):
    id: Optional[str]
    name: Optional[str] = Field(default="New Conversation")
    created_at: Optional[int]
    updated_at: Optional[int]
    messages: List[MessageResponse] = Field(default_factory=list)
    messages_count: int = 0

    class Config:
        from_attributes = True

    @classmethod
    def from_domain(cls, domain_obj: ConversationDomain):
        messages = [MessageResponse.from_domain(m) for m in getattr(domain_obj, "messages", [])]
        # prefer repository-populated messages_count when available to avoid
        # relying on the in-memory messages list (which may be truncated in list views)
        messages_count = getattr(domain_obj, "messages_count", None)
        if messages_count is None:
            messages_count = len(messages)

        return cls(
            id=domain_obj.id,
            name=domain_obj.name,
            created_at=domain_obj.created_at,
            updated_at=domain_obj.updated_at,
            messages=messages,
            messages_count=messages_count,
        )
