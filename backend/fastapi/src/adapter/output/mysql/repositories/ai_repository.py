"""`ai_usage` and `ai_cache` through SQLAlchemy Core.

The budget check is ONE conditional UPDATE on the day's total row: it either
increments the counter while it is under the caps, or matches no row. That is
what keeps many serverless instances from overspending together — a read
followed by a write would let them all read "one left" at once.

No savepoints: SQLite through aiosqlite does not run them reliably, so each step
is its own short transaction, and a lost insert race is retried as an update.
"""

from __future__ import annotations

import time
from typing import List, Optional

from sqlalchemy import delete, insert, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.adapter.output.mysql.entities.ai_entity import AiCacheEntity, AiUsageEntity
from src.application.ports.output.ai_output_port import AiOutputPort
from src.domain.models.ai_domain import AiUsageRow

_USAGE = AiUsageEntity.__table__
_CACHE = AiCacheEntity.__table__

#: The feature name of a day's total row — the one the budget is checked on.
TOTAL = "*"


class AiRepository(AiOutputPort):
    def __init__(self, db: AsyncSession):
        self.db = db

    def _row(self, day: str, feature: str):
        return (_USAGE.c.day == day) & (_USAGE.c.feature == feature)

    async def reserve(self, day: str, max_requests: int, max_tokens: int) -> bool:
        if max_requests < 1 or max_tokens < 1:
            return False
        for _ in range(2):
            res = await self.db.execute(
                update(_USAGE)
                .where(self._row(day, TOTAL),
                       _USAGE.c.requests < max_requests,
                       _USAGE.c.prompt_tokens + _USAGE.c.output_tokens < max_tokens)
                .values(requests=_USAGE.c.requests + 1))
            if res.rowcount:
                await self.db.commit()
                return True
            exists = (await self.db.execute(select(_USAGE.c.day).where(self._row(day, TOTAL)))).first()
            if exists is not None:
                await self.db.rollback()
                return False                       # the row is there and a cap is reached
            try:
                await self.db.execute(insert(_USAGE).values(day=day, feature=TOTAL, requests=1,
                                                             prompt_tokens=0, output_tokens=0))
                await self.db.commit()
                return True
            except IntegrityError:
                await self.db.rollback()           # another instance opened the day first: retry the UPDATE
        return False

    async def _add(self, day: str, feature: str, requests: int, prompt_tokens: int, output_tokens: int) -> None:
        bump = (update(_USAGE).where(self._row(day, feature))
                .values(requests=_USAGE.c.requests + requests,
                        prompt_tokens=_USAGE.c.prompt_tokens + prompt_tokens,
                        output_tokens=_USAGE.c.output_tokens + output_tokens))
        res = await self.db.execute(bump)
        if res.rowcount:
            await self.db.commit()
            return
        try:
            await self.db.execute(insert(_USAGE).values(day=day, feature=feature, requests=requests,
                                                         prompt_tokens=prompt_tokens, output_tokens=output_tokens))
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            await self.db.execute(bump)
            await self.db.commit()

    async def record(self, day: str, feature: str, prompt_tokens: int, output_tokens: int) -> None:
        prompt_tokens, output_tokens = max(0, int(prompt_tokens)), max(0, int(output_tokens))
        await self._add(day, feature, 1, prompt_tokens, output_tokens)
        # The total's request was counted when it was reserved; only the tokens are new.
        await self._add(day, TOTAL, 0, prompt_tokens, output_tokens)

    async def usage(self, since_day: str) -> List[AiUsageRow]:
        rows = (await self.db.execute(
            select(_USAGE).where(_USAGE.c.day >= since_day).order_by(_USAGE.c.day, _USAGE.c.feature)
        )).mappings().all()
        return [AiUsageRow(day=r["day"], feature=r["feature"], requests=r["requests"] or 0,
                           prompt_tokens=r["prompt_tokens"] or 0, output_tokens=r["output_tokens"] or 0)
                for r in rows]

    async def cache_get(self, key: str, min_created_at: int) -> Optional[str]:
        row = (await self.db.execute(
            select(_CACHE.c.payload).where(_CACHE.c.cache_key == key, _CACHE.c.created_at >= min_created_at)
        )).first()
        return row[0] if row else None

    async def cache_put(self, key: str, feature: str, payload: str, prune_before: int) -> None:
        await self.db.execute(delete(_CACHE).where((_CACHE.c.cache_key == key) | (_CACHE.c.created_at < prune_before)))
        try:
            await self.db.execute(insert(_CACHE).values(cache_key=key, feature=feature, payload=payload,
                                                         created_at=int(time.time())))
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()               # the same answer was stored a moment ago
