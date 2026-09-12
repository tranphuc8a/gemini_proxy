from typing import ClassVar, List, Optional
from pydantic import BaseModel, Field, ConfigDict
from .message_domain import MessageDomain


class ConversationDomain(BaseModel):
    # What a conversation is called until it is named — either by the user, or
    # from its first message. Both use cases compare against this, so it lives
    # here rather than being spelled out in each of them.
    DEFAULT_NAME: ClassVar[str] = "New Conversation"

    id: str
    name: str
    created_at: int
    updated_at: Optional[int] = None
    # avoid mutable default list
    messages: List[MessageDomain] = Field(default_factory=list)
    # optional DB-backed messages count (populated by repository)
    messages_count: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)
