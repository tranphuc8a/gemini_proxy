from pydantic import BaseModel, ConfigDict
from src.domain.enums.enums import ERole


class MessageDomain(BaseModel):
    id: str
    conversation_id: str
    role: ERole
    content: str
    created_at: int

    model_config = ConfigDict(from_attributes=True)
