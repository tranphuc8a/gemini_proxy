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

import pytest

os.environ.setdefault("TESTING", "1")

from src.adapter.output.gemini.service.gemini_ai_model import GeminiAiModel
from src.adapter.output.mysql.db.base import Base, get_async_engine, get_async_session
from src.application.usecases import ai_models, ai_usecase, arena_usecase


@pytest.fixture(autouse=True)
def _fresh_ai_limits():
    """The AI rate limits count per process: every test starts from zero, so
    one file's requests never throttle another's (the chat shares them)."""
    ai_usecase.reset_limits()
    arena_usecase.reset_limits()
    yield
    ai_usecase.reset_limits()
    arena_usecase.reset_limits()


@pytest.fixture(autouse=True)
def _no_live_model_listing(monkeypatch):
    """The model catalog never reaches Google from a test.

    A local .env may hold a real GEMINI_API_KEY, and picking any model other than
    AI_MODEL consults the catalog; the real adapter's listing therefore answers
    "unavailable" (the catalog falls back to its built-in list), and every test
    starts with an empty catalog cache. A test that needs a listing uses FakeModel.
    """
    async def _unavailable(self):
        raise RuntimeError("models.list is not called from tests")
    monkeypatch.setattr(GeminiAiModel, "list_models", _unavailable)
    ai_models.reset_catalog()
    yield
    ai_models.reset_catalog()


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
