from dataclasses import dataclass

@dataclass
class MessageDomain:
    id: str
    conversation_id: str
    role: str
    content: str
    created_at: int
