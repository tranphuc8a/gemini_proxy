from datetime import datetime
from typing import cast
from sqlalchemy import Column, Integer, String, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from src.domain.enums.enums import ERole
from src.adapter.output.mysql.db.base import Base
from src.domain.models.message_domain import MessageDomain
from src.adapter.output.mysql.entities.abstract_entity import AbstractEntity


class MessageEntity(Base, AbstractEntity[MessageDomain]):
    __tablename__ = "messages"

    id = Column(String(64), primary_key=True)
    conversation_id = Column(String(64), ForeignKey("conversations.id"), nullable=False)
    role = Column(Enum(ERole), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(Integer, nullable=False, default=datetime.utcnow)

    conversation = relationship("ConversationEntity", back_populates="messages")

    @classmethod
    def from_domain(cls, domain_obj: MessageDomain) -> "MessageEntity":
        ent = cls(conversation_id=domain_obj.conversation_id, role=domain_obj.role, content=domain_obj.content)
        # id and created_at are handled by DB
        return ent
    
    def to_domain(self) -> MessageDomain:
        return MessageDomain(
            id=cast(str, self.id), 
            conversation_id=cast(str, self.conversation_id), 
            role=cast(ERole, self.role), 
            content=cast(str, self.content), 
            created_at=cast(int, self.created_at)
        )
