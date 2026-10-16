"""Which counter a rate limit uses: memory, the SQL database or MongoDB.

`RATE_LIMIT_BACKEND` names it (`memory`, `database`, `mongo`) or leaves the choice
to `auto`: the SQL table when the application's own database is a real MySQL,
memory in every other case - a SQLite file (development), a test run, or no way to
tell. `auto` never picks MongoDB: that is a deliberate choice of the operator.

A persistent counter is wrapped in `FailOpenRateLimiter`: when it fails, the
request is still served and the instance counts in memory for a while.
"""

from __future__ import annotations

import logging
import os
import sys
from typing import Optional

from src.application.config.config import settings
from src.application.ports.output.rate_limiter_port import RateLimiterPort
from src.application.utils.rate_limiter import FailOpenRateLimiter, MemoryRateLimiter

logger = logging.getLogger(__name__)

BACKENDS = ("memory", "database", "mongo", "auto")


def running_under_test() -> bool:
    """The same test the SQL engine uses to fall back to SQLite (`mysql/db/base.py`)."""
    return bool(
        getattr(settings, "TESTING", False)
        or os.environ.get("PYTEST_CURRENT_TEST")
        or any(name.startswith("pytest") for name in sys.modules)
    )


def database_is_mysql() -> bool:
    """Is the application's database a real MySQL server rather than a SQLite file?

    An explicit `DB_URL` wins (its scheme says which); without one the `DB_*` fields
    describe a MySQL server. Mirrors how `mysql/db/base.py` builds its engine.
    """
    url = (os.environ.get("DB_URL") or getattr(settings, "DB_URL", "") or "").strip().lower()
    if url:
        return not url.startswith("sqlite")
    return True


def resolve_backend(requested: Optional[str] = None, *, under_test: Optional[bool] = None) -> str:
    """`memory`, `database` or `mongo` - never `auto`."""
    chosen = (requested if requested is not None else getattr(settings, "RATE_LIMIT_BACKEND", "auto"))
    chosen = (chosen or "auto").strip().lower()
    if chosen not in BACKENDS:
        logger.warning("RATE_LIMIT_BACKEND=%r is not one of %s; using auto", chosen, ", ".join(BACKENDS))
        chosen = "auto"
    if chosen != "auto":
        return chosen
    testing = running_under_test() if under_test is None else under_test
    if testing:
        return "memory"
    return "database" if database_is_mysql() else "memory"


def build_rate_limiter(name: str, max_events: int, window_seconds: int) -> RateLimiterPort:
    """A counter allowing `max_events` per `window_seconds` per key, on the configured backend."""
    backend = resolve_backend()
    if backend == "memory":
        return MemoryRateLimiter(max_events, window_seconds)

    if backend == "mongo":
        from src.adapter.output.mongostore import client as mongo_store

        if not mongo_store.is_configured():
            logger.warning("RATE_LIMIT_BACKEND=mongo but MONGO_URI is empty; the %r limit is counted in memory", name)
            return MemoryRateLimiter(max_events, window_seconds)
        from src.adapter.output.ratelimit.mongo_rate_limiter import MongoRateLimiter

        shared: RateLimiterPort = MongoRateLimiter(name, max_events, window_seconds)
    else:
        from src.adapter.output.ratelimit.database_rate_limiter import DatabaseRateLimiter

        shared = DatabaseRateLimiter(name, max_events, window_seconds)
    return FailOpenRateLimiter(
        shared, MemoryRateLimiter(max_events, window_seconds),
        name=name, timeout_s=float(getattr(settings, "RATE_LIMIT_TIMEOUT_S", 2.0)),
    )
