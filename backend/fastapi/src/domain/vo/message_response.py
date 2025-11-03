from pydantic import BaseModel

from src.domain.models.message_domain import MessageDomain


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    created_at: int

    class Config:
        orm_mode = True

    @classmethod
    def from_domain(cls, domain_obj: MessageDomain):
        return cls(
            id=domain_obj.id, 
            conversation_id=domain_obj.conversation_id, 
            role=domain_obj.role,
            content=domain_obj.content, 
            created_at=domain_obj.created_at
        )
