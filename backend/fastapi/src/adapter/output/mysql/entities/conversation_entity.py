from datetime import datetime
from sqlalchemy import Column, String, DateTime
from sqlalchemy.orm import relationship
from src.adapter.db.base import Base
from src.domain.models import ConversationDomain, MessageDomain
from .abstract_entity import AbstractEntity
from typing import List


class ConversationEntity(Base, AbstractEntity[ConversationDomain]):
    __tablename__ = "conversations"

    id = Column(String(64), primary_key=True)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    messages = relationship("MessageEntity", back_populates="conversation", cascade="all, delete-orphan")

    @classmethod
    def from_domain(cls, domain_obj: ConversationDomain) -> "ConversationEntity":
        ent = cls(id=domain_obj.id, name=domain_obj.name)
        # don't set created_at/updated_at here; DB defaults will apply if None
        return ent

    def to_domain(self) -> ConversationDomain:
        # convert messages if loaded
        msgs = [m.to_domain() for m in self.messages] if self.messages is not None else []
        return ConversationDomain(id=self.id, name=self.name, created_at=self.created_at, updated_at=self.updated_at, messages=msgs)
