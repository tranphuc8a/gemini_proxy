from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime
from .message_domain import MessageDomain

@dataclass
class ConversationDomain:
    id: str
    name: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    messages: List[MessageDomain] = field(default_factory=list)
