from pydantic import BaseModel

from src.domain.models.message_domain import MessageDomain
from src.domain.enums.enums import ERole


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    role: ERole
    content: str
    created_at: int

    class Config:
        from_attributes = True

    @classmethod
    def from_domain(cls, domain_obj: MessageDomain):
        return cls(
            id=domain_obj.id, 
            conversation_id=domain_obj.conversation_id, 
            role=domain_obj.role,
            content=domain_obj.content, 
            created_at=domain_obj.created_at
        )
