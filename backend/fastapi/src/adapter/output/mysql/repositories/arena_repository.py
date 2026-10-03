"""`arena_scores` through SQLAlchemy Core.

Keeping a name's best is a conditional UPDATE ("set score where score is worse")
and an INSERT when the name has no row yet; a lost insert race (two first
submissions at once) is retried as the update. No savepoints, as with the AI
books: SQLite through aiosqlite does not run them reliably.
"""

from __future__ import annotations

from typing import List

from sqlalchemy import func, insert, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.adapter.output.mysql.entities.arena_entity import ArenaScoreEntity
from src.application.ports.output.arena_output_port import ArenaOutputPort
from src.domain.models.arena_domain import ArenaScore

_T = ArenaScoreEntity.__table__


class ArenaRepository(ArenaOutputPort):
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _better(self, problem: str, name: str, score: float, now: int) -> bool:
        res = await self.db.execute(
            update(_T).where((_T.c.problem == problem) & (_T.c.name == name) & (_T.c.score > score))
            .values(score=score, updated_at=now))
        await self.db.commit()
        return res.rowcount > 0

    async def keep_best(self, problem: str, name: str, score: float, now: int) -> bool:
        if await self._better(problem, name, score, now):
            return True
        exists = (await self.db.execute(
            select(func.count()).select_from(_T).where((_T.c.problem == problem) & (_T.c.name == name)))).scalar_one()
        if exists:
            return False                                    # the name already did at least as well
        try:
            await self.db.execute(insert(_T).values(problem=problem, name=name, score=score, updated_at=now))
            await self.db.commit()
            return True
        except IntegrityError:
            await self.db.rollback()
            return await self._better(problem, name, score, now)

    async def top(self, problem: str, limit: int) -> List[ArenaScore]:
        rows = (await self.db.execute(
            select(_T.c.problem, _T.c.name, _T.c.score, _T.c.updated_at).where(_T.c.problem == problem)
            .order_by(_T.c.score.asc(), _T.c.updated_at.asc()).limit(limit))).all()
        return [ArenaScore(problem=r.problem, name=r.name, score=r.score, updated_at=r.updated_at) for r in rows]

    async def rank(self, problem: str, score: float) -> int:
        better = (await self.db.execute(
            select(func.count()).select_from(_T).where((_T.c.problem == problem) & (_T.c.score < score)))).scalar_one()
        return int(better) + 1
