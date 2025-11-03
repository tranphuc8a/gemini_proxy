from datetime import datetime
from typing import cast
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from src.adapter.output.mysql.db.base import Base
from src.domain.models.conversation_domain import ConversationDomain
from .abstract_entity import AbstractEntity


class ConversationEntity(Base, AbstractEntity[ConversationDomain]):
    __tablename__ = "conversations"

    id = Column(String(64), primary_key=True)
    name = Column(String(255), nullable=False)
    created_at = Column(Integer, nullable=False, default=datetime.utcnow)
    updated_at = Column(Integer, nullable=True, default=datetime.utcnow)

    messages = relationship("MessageEntity", back_populates="conversation", cascade="all, delete-orphan")

    @classmethod
    def from_domain(cls, domain_obj: ConversationDomain) -> "ConversationEntity":
        ent = cls(id=domain_obj.id, name=domain_obj.name)
        # don't set created_at/updated_at here; DB defaults will apply if None
        return ent

    def to_domain(self) -> ConversationDomain:
        # convert messages if loaded
        msgs = [m.to_domain() for m in self.messages] if self.messages is not None else []
        return ConversationDomain(
            id=cast(str, self.id), 
            name=cast(str, self.name), 
            created_at=cast(int, self.created_at), 
            updated_at=cast(int, self.updated_at) if self.updated_at is not None else None, 
            messages=msgs
        )
