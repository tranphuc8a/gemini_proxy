"""Rate limiter whose counts live in a SQL table, so every instance sees them.

One small table, created on demand with `CREATE TABLE IF NOT EXISTS` (the way the
spending and codestore stores do, not through Alembic): this is opt-in plumbing and
must not force a migration.

    rate_limit_hits (limiter, subject, bucket) -> hits, expires_at

`limiter` names the counter (`run`, `codestore_failures`...), `subject` is the
SHA-256 of the key (a client address is personal data and the table only needs
equality), `bucket` a slot of `window / 6` seconds (see `application/utils/
rate_limiter`). Counting is one atomic upsert, so two instances adding at the same
moment never lose an event: MySQL `INSERT ... ON DUPLICATE KEY UPDATE`, SQLite and
PostgreSQL `INSERT ... ON CONFLICT DO UPDATE`. Asking is one `SELECT` on the primary
key. Rows past their expiry are deleted by `add` at most once a minute per
counter, so the table holds only what is still inside a window.
"""

from __future__ import annotations

import logging
import time
from typing import Callable, Dict, Optional

from sqlalchemy import text

from src.adapter.output.mysql.db.base import get_async_session
from src.application.ports.output.rate_limiter_port import RateLimiterPort
from src.application.utils.rate_limiter import (
    bucket_expires_at,
    bucket_of,
    live_buckets,
    subject_digest,
    wait_seconds,
)

logger = logging.getLogger(__name__)

TABLE = "rate_limit_hits"
MAX_NAME_LENGTH = 48

CREATE_TABLE = f"""
CREATE TABLE IF NOT EXISTS {TABLE} (
    limiter VARCHAR({MAX_NAME_LENGTH}) NOT NULL,
    subject VARCHAR(64) NOT NULL,
    bucket BIGINT NOT NULL,
    hits INTEGER NOT NULL,
    expires_at BIGINT NOT NULL,
    PRIMARY KEY (limiter, subject, bucket)
)
"""

SELECT_BUCKETS = text(
    f"SELECT bucket, hits FROM {TABLE} "
    "WHERE limiter = :limiter AND subject = :subject AND bucket >= :first AND bucket <= :last"
)
UPSERT_MYSQL = text(
    f"INSERT INTO {TABLE} (limiter, subject, bucket, hits, expires_at) "
    "VALUES (:limiter, :subject, :bucket, 1, :expires_at) "
    "ON DUPLICATE KEY UPDATE hits = hits + 1"
)
UPSERT_STANDARD = text(
    f"INSERT INTO {TABLE} (limiter, subject, bucket, hits, expires_at) "
    "VALUES (:limiter, :subject, :bucket, 1, :expires_at) "
    "ON CONFLICT (limiter, subject, bucket) DO UPDATE SET hits = hits + 1"
)
PURGE = text(f"DELETE FROM {TABLE} WHERE limiter = :limiter AND expires_at <= :now")
RESET_KEY = text(f"DELETE FROM {TABLE} WHERE limiter = :limiter AND subject = :subject")
RESET_ALL = text(f"DELETE FROM {TABLE} WHERE limiter = :limiter")


class DatabaseRateLimiter(RateLimiterPort):
    def __init__(
        self,
        name: str,
        max_events: int,
        window_seconds: int,
        *,
        clock: Callable[[], float] = time.time,
        session_factory: Callable[[], object] = get_async_session,
        purge_every_s: float = 60.0,
    ):
        if not name or len(name) > MAX_NAME_LENGTH:
            raise ValueError(f"the counter name must be 1-{MAX_NAME_LENGTH} characters")
        self._name = name
        self._max = max(1, int(max_events))
        self._window = max(1, int(window_seconds))
        self._clock = clock
        self._session_factory = session_factory
        self._purge_every = float(purge_every_s)
        self._last_purge = 0.0
        self._ready = False

    async def _session(self):
        session = self._session_factory()
        if not self._ready:
            try:
                await session.execute(text(CREATE_TABLE))
                await session.commit()
            except Exception:
                # Not marked ready: the next call tries again.
                await session.close()
                raise
            self._ready = True
        return session

    # ----------------------------------------------------------------- asking
    async def retry_after(self, key: str) -> Optional[int]:
        now = self._clock()
        window = live_buckets(now, self._window)
        session = await self._session()
        try:
            result = await session.execute(
                SELECT_BUCKETS,
                {"limiter": self._name, "subject": subject_digest(key), "first": window.start, "last": window.stop - 1},
            )
            counts: Dict[int, int] = {}
            for row in result.fetchall():
                mapping = row._mapping if hasattr(row, "_mapping") else row
                counts[int(mapping["bucket"])] = int(mapping["hits"])
            return wait_seconds(counts, now, self._window, self._max)
        finally:
            await session.close()

    # --------------------------------------------------------------- counting
    async def add(self, key: str) -> None:
        now = self._clock()
        bucket = bucket_of(now, self._window)
        session = await self._session()
        try:
            dialect = session.get_bind().dialect.name
            await session.execute(
                UPSERT_MYSQL if dialect == "mysql" else UPSERT_STANDARD,
                {
                    "limiter": self._name,
                    "subject": subject_digest(key),
                    "bucket": bucket,
                    "expires_at": bucket_expires_at(bucket, self._window),
                },
            )
            await session.commit()
            await self._purge(session, now)
        finally:
            await session.close()

    async def _purge(self, session, now: float) -> None:
        """Delete this counter's rows that no window can reach any more (at most once a minute)."""
        if now - self._last_purge < self._purge_every:
            return
        self._last_purge = now
        try:
            await session.execute(PURGE, {"limiter": self._name, "now": int(now)})
            await session.commit()
        except Exception as cause:  # noqa: BLE001 - housekeeping must not lose the count just made
            await session.rollback()
            logger.warning("Rate limiter %r: purging expired rows failed (%s)", self._name, type(cause).__name__)

    async def reset(self, key: Optional[str] = None) -> None:
        session = await self._session()
        try:
            if key is None:
                await session.execute(RESET_ALL, {"limiter": self._name})
            else:
                await session.execute(RESET_KEY, {"limiter": self._name, "subject": subject_digest(key)})
            await session.commit()
        finally:
            await session.close()
