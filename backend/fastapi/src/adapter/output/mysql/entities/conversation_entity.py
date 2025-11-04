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
    created_at = Column(Integer, nullable=False)
    updated_at = Column(Integer, nullable=True)

    messages = relationship("MessageEntity", back_populates="conversation", cascade="all, delete-orphan")

    @classmethod
    def from_domain(cls, domain_obj: ConversationDomain) -> "ConversationEntity":
        ent = cls(
            id=domain_obj.id, 
            name=domain_obj.name,
            created_at=domain_obj.created_at,
            updated_at=domain_obj.updated_at
        )
        return ent

    def to_domain(self) -> ConversationDomain:
        # convert messages only if they are already loaded on the instance to avoid triggering
        # a lazy load (which can fail in async contexts if not run within greenlet_spawn)
        msgs = []
        if "messages" in self.__dict__ and self.messages is not None:
            msgs = [m.to_domain() for m in self.messages]

        # normalize timestamps if stored as datetime or string
        def _normalize_ts(val):
            if val is None:
                return None
            if isinstance(val, int):
                return val
            if isinstance(val, datetime):
                return int(val.timestamp())
            if isinstance(val, str):
                # try ISO format first
                try:
                    dt = datetime.fromisoformat(val)
                    return int(dt.timestamp())
                except Exception:
                    pass
                # try numeric string
                try:
                    return int(float(val))
                except Exception:
                    raise ValueError(f"Cannot parse timestamp value: {val}")

        created = _normalize_ts(self.created_at)
        updated = _normalize_ts(self.updated_at)

        return ConversationDomain(
            id=cast(str, self.id),
            name=cast(str, self.name),
            created_at=cast(int, created),
            updated_at=cast(int, updated) if updated is not None else None,
            messages=msgs,
        )
