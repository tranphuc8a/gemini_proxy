"""Shared helpers for the backend test suite.

The app falls back to an in-memory SQLite engine whenever it detects pytest (see
`src.adapter.output.mysql.db.base`), so tests get a real database without any
external service. That database lives for exactly as long as the event loop that
opened it, so a test that touches it must do all of its work inside a single
`asyncio.run` — hence `run_with_db` below rather than a session fixture.

Tests drive coroutines with `arun`, matching the convention already used by the
sqlgateway and sql-admin tests.
"""

import asyncio
import os

os.environ.setdefault("TESTING", "1")

from src.adapter.output.mysql.db.base import Base, get_async_engine, get_async_session


def arun(coro):
    """Run a coroutine to completion from a synchronous test."""
    return asyncio.run(coro)


async def create_schema() -> None:
    """(Re)create every table on the engine bound to the current loop."""
    engine = get_async_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)


def run_with_db(scenario):
    """Run `scenario(session)` against a freshly-created schema.

    `scenario` is an async callable taking one AsyncSession. Schema creation, the
    scenario itself and session close all happen on one event loop, which is what
    keeps the in-memory database alive for the duration.
    """

    async def _outer():
        await create_schema()
        db = get_async_session()
        try:
            return await scenario(db)
        finally:
            await db.close()

    return arun(_outer())
