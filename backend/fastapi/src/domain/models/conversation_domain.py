from typing import List, Optional
from pydantic import BaseModel, Field
from .message_domain import MessageDomain


class ConversationDomain(BaseModel):
    id: str
    name: str
    created_at: int
    updated_at: Optional[int] = None
    # avoid mutable default list
    messages: List[MessageDomain] = Field(default_factory=list)
    # optional DB-backed messages count (populated by repository)
    messages_count: Optional[int] = None

    class Config:
        from_attributes = True
