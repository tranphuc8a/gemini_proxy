"""The algorithm arena's leaderboard: one row per (problem, name) — that name's best."""

from __future__ import annotations

from sqlalchemy import BigInteger, Column, Float, Index, Integer, String, UniqueConstraint

from src.adapter.output.mysql.db.base import Base

_MYSQL_TABLE = {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}


class ArenaScoreEntity(Base):
    __tablename__ = "arena_scores"
    __table_args__ = (
        UniqueConstraint("problem", "name", name="uq_arena_problem_name"),
        Index("ix_arena_problem_score", "problem", "score"),
        dict(_MYSQL_TABLE),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    problem = Column(String(32), nullable=False)
    name = Column(String(40), nullable=False)
    #: Tour length as the server measured it — lower is better.
    score = Column(Float, nullable=False)
    updated_at = Column(BigInteger, nullable=False)
