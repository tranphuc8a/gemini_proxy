from datetime import datetime
from typing import cast
import uuid
from sqlalchemy import Column, Integer, String, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from src.domain.enums.enums import ERole
from src.adapter.output.mysql.db.base import Base
from src.domain.models.message_domain import MessageDomain
from src.adapter.output.mysql.entities.abstract_entity import AbstractEntity


class MessageEntity(Base, AbstractEntity[MessageDomain]):
    __tablename__ = "messages"
    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String(64), ForeignKey("conversations.id"), nullable=False)
    # Store the enum by its value (e.g. 'user', 'model') and allow SQLAlchemy
    # to map DB strings back to the Python Enum using the value, not the name.
    # values_callable tells SQLAlchemy which values to expect in the DB.
    role = Column(
        Enum(ERole, values_callable=lambda enum: [e.value for e in enum], name="erole"),
        nullable=False,
    )
    content = Column(Text, nullable=False)
    created_at = Column(Integer, nullable=False)

    conversation = relationship("ConversationEntity", back_populates="messages")

    @classmethod
    def from_domain(cls, domain_obj: MessageDomain) -> "MessageEntity":
        ent = cls(
            id=domain_obj.id,
            conversation_id=domain_obj.conversation_id, 
            role=domain_obj.role, 
            content=domain_obj.content,
            created_at=domain_obj.created_at
        )
        return ent
    
    def to_domain(self) -> MessageDomain:
        # normalize role to enum and created_at to an int timestamp
        role_enum = self.role if isinstance(self.role, ERole) else ERole(str(self.role))
        created = self.created_at
        if isinstance(created, datetime):
            created = int(created.timestamp())

        return MessageDomain(
            id=cast(str, self.id),
            conversation_id=cast(str, self.conversation_id),
            role=role_enum,
            content=cast(str, self.content),
            created_at=cast(int, created),
        )
