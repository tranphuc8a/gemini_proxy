from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from src.adapter.db.base import Base
from src.domain.models import MessageDomain
from .abstract_entity import AbstractEntity


class MessageEntity(Base, AbstractEntity[MessageDomain]):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(String(64), ForeignKey("conversations.id"), nullable=False)
    role = Column(String(32), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("ConversationEntity", back_populates="messages")

    @classmethod
    def from_domain(cls, domain_obj: MessageDomain) -> "MessageEntity":
        ent = cls(conversation_id=domain_obj.conversation_id, role=domain_obj.role, content=domain_obj.content)
        # id and created_at are handled by DB
        return ent

    def to_domain(self) -> MessageDomain:
        return MessageDomain(id=self.id, conversation_id=self.conversation_id, role=self.role, content=self.content, created_at=self.created_at)
