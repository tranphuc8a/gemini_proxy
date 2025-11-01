from dataclasses import dataclass
from typing import Optional
from datetime import datetime


@dataclass
class MessageDomain:
    id: Optional[int]
    conversation_id: str
    role: str
    content: str
    created_at: Optional[datetime] = None
