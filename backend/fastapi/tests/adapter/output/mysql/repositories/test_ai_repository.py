"""AI spending books and answer cache against a real (SQLite) database.

The budget must hold across serverless instances, so it is one conditional
UPDATE on the day's total row; these tests pin down what that UPDATE admits.
"""

import time

from sqlalchemy import select

from src.adapter.output.mysql.entities.ai_entity import AiUsageEntity
from src.adapter.output.mysql.repositories.ai_repository import TOTAL, AiRepository
from src.adapter.output.mysql.db.base import get_async_session
from tests.conftest import run_with_db

DAY = "2026-10-03"


def test_reserve_admits_up_to_the_request_cap():
    async def scenario(db):
        repo = AiRepository(db)
        assert [await repo.reserve(DAY, 3, 10_000) for _ in range(4)] == [True, True, True, False]
        assert await repo.reserve("2026-10-04", 3, 10_000), "a new day has a new budget"
        assert not await repo.reserve(DAY, 0, 10_000), "a zero budget admits nothing"

    run_with_db(scenario)


def test_reserve_stops_once_the_tokens_are_spent():
    async def scenario(db):
        repo = AiRepository(db)
        assert await repo.reserve(DAY, 100, 1_000)
        await repo.record(DAY, "tutor", 700, 300)
        assert not await repo.reserve(DAY, 100, 1_000)
        assert await repo.reserve(DAY, 100, 1_001)

    run_with_db(scenario)


def test_two_sessions_share_one_budget():
    """Two instances = two sessions on one database: neither can overspend."""
    async def scenario(db):
        other = get_async_session()
        try:
            a, b = AiRepository(db), AiRepository(other)
            got = [await a.reserve(DAY, 3, 10_000), await b.reserve(DAY, 3, 10_000),
                   await a.reserve(DAY, 3, 10_000), await b.reserve(DAY, 3, 10_000)]
            assert got == [True, True, True, False]
        finally:
            await other.close()

    run_with_db(scenario)


def test_record_books_the_feature_and_the_days_tokens():
    async def scenario(db):
        repo = AiRepository(db)
        await repo.reserve(DAY, 10, 10_000)
        await repo.reserve(DAY, 10, 10_000)
        await repo.record(DAY, "tutor", 100, 40)
        await repo.record(DAY, "tutor", 10, 4)
        rows = {r.feature: r for r in await repo.usage(DAY)}
        assert rows["tutor"].requests == 2 and rows["tutor"].prompt_tokens == 110 and rows["tutor"].output_tokens == 44
        assert rows[TOTAL].requests == 2, "the total counts reservations, not records"
        assert rows[TOTAL].prompt_tokens == 110 and rows[TOTAL].output_tokens == 44
        assert await repo.usage("2026-10-04") == []
        stored = (await db.execute(select(AiUsageEntity))).scalars().all()
        assert sorted(r.feature for r in stored) == [TOTAL, "tutor"]

    run_with_db(scenario)


def test_cache_round_trip_ttl_replace_and_prune():
    async def scenario(db):
        repo = AiRepository(db)
        now = int(time.time())
        assert await repo.cache_get("k", 0) is None
        await repo.cache_put("k", "flashcards", '{"a":1}', prune_before=now - 100)
        assert await repo.cache_get("k", now - 10) == '{"a":1}'
        assert await repo.cache_get("k", now + 10) is None, "older than the wanted age"
        await repo.cache_put("k", "flashcards", '{"a":2}', prune_before=now - 100)
        assert await repo.cache_get("k", 0) == '{"a":2}'
        # An entry older than `prune_before` disappears on the next write.
        await repo.cache_put("old", "x", "1", prune_before=0)
        await repo.cache_put("new", "x", "2", prune_before=now + 10)
        assert await repo.cache_get("old", 0) is None and await repo.cache_get("k", 0) is None
        assert await repo.cache_get("new", 0) == "2"

    run_with_db(scenario)
