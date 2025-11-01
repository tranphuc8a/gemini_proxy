from dataclasses import dataclass, field
from typing import List, Optional
from .message_domain import MessageDomain

@dataclass
class ConversationDomain:
    id: str
    name: str
    created_at: int
    updated_at: Optional[int] = None
    messages: List[MessageDomain] = field(default_factory=list)
