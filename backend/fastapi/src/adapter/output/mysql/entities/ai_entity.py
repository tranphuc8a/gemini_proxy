"""Bookkeeping of the AI features: what was spent, and answers worth keeping.

`ai_usage` holds one row per UTC day per feature, plus a row with feature "*"
that is the day's total — the budget row: a request is admitted by a single
conditional UPDATE on it, so concurrent serverless instances cannot overspend.

`ai_cache` keeps answers that depend only on their inputs — the flashcards of
a lesson at a given revision, say — so the second learner costs nothing.
"""

from __future__ import annotations

from sqlalchemy import BigInteger, Column, Integer, String

from src.adapter.output.mysql.db.base import Base
from src.adapter.output.mysql.entities.course_entity import LongText

_MYSQL_TABLE = {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}


class AiUsageEntity(Base):
    __tablename__ = "ai_usage"
    __table_args__ = (dict(_MYSQL_TABLE),)

    #: "2026-10-03" — UTC, so every instance agrees when a day ends.
    day = Column(String(10), primary_key=True)
    #: "chat", "tutor", "flashcards"… — "*" is the day's total.
    feature = Column(String(32), primary_key=True)
    requests = Column(Integer, nullable=False, default=0)
    prompt_tokens = Column(BigInteger, nullable=False, default=0)
    output_tokens = Column(BigInteger, nullable=False, default=0)


class AiCacheEntity(Base):
    __tablename__ = "ai_cache"
    __table_args__ = (dict(_MYSQL_TABLE),)

    #: sha1 of the feature, the model and every input of the answer.
    cache_key = Column(String(40), primary_key=True)
    feature = Column(String(32), nullable=False)
    #: The answer, JSON.
    payload = Column(LongText, nullable=False)
    created_at = Column(BigInteger, nullable=False, index=True)
