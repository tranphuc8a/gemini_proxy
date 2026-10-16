"""The three rate-limit counters must behave the same, and survive a failing store.

One contract runs over `memory`, `database` (the SQLite engine the suite falls back
to) and `mongo` (`tests.support.fake_mongo`): what a client address is allowed,
what wait it is told, how long a count lives, that two instances over one store
share their counts. The persistent ones are bucketed (`application/utils/
rate_limiter`) and so a little stricter than the exact in-memory window; the
contract is written to what holds for all three.

The fail-open wrapper is tested separately, with stores that raise and hang.
"""

import os

os.environ.setdefault("TESTING", "1")

import asyncio
import hashlib
import logging
import random

import pytest
from sqlalchemy import text

from src.adapter.output.mysql.db.base import get_async_session
from src.adapter.output.ratelimit import mongo_rate_limiter
from src.adapter.output.ratelimit.database_rate_limiter import DatabaseRateLimiter
from src.adapter.output.ratelimit.mongo_rate_limiter import MongoRateLimiter
from src.application.ports.output.rate_limiter_port import RateLimiterPort
from src.application.utils.rate_limit import FailureWindow
from src.application.utils.rate_limiter import (
    FailOpenRateLimiter,
    MemoryRateLimiter,
    as_rate_limiter,
    bucket_expires_at,
    bucket_of,
    bucket_seconds,
    live_buckets,
    subject_digest,
    wait_seconds,
)
from tests.conftest import arun
from tests.support import fake_mongo

START = 1_800_000_000.0
IP = "203.0.113.7"


class Clock:
    def __init__(self, now=START):
        self.now = now

    def __call__(self):
        return self.now

    def advance(self, seconds):
        self.now += seconds


@pytest.fixture
def clock():
    return Clock()


@pytest.fixture
def name(request):
    """A counter name unique to this test: the SQLite file is one database for the whole run."""
    return "t_" + hashlib.sha1(request.node.nodeid.encode()).hexdigest()[:24]


@pytest.fixture(autouse=True)
def fake_db(monkeypatch):
    return fake_mongo.install(monkeypatch, mongo_rate_limiter)


def build(kind, name, clock, max_events=3, window=60):
    if kind == "memory":
        return MemoryRateLimiter(max_events, window, clock)
    if kind == "database":
        return DatabaseRateLimiter(name, max_events, window, clock=clock)
    return MongoRateLimiter(name, max_events, window, clock=clock)


KINDS = ["memory", "database", "mongo"]
SHARED_KINDS = ["database", "mongo"]


async def fill(limiter, key=IP, times=3):
    for _ in range(times):
        await limiter.add(key)


# ---------------------------------------------------------------------------
# the contract, over all three
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("kind", KINDS)
def test_under_the_limit_nothing_is_refused_and_at_the_limit_a_wait_is_named(kind, name, clock):
    async def scenario():
        limiter = build(kind, name, clock)
        before = []
        for _ in range(3):
            before.append(await limiter.retry_after(IP))
            await limiter.add(IP)
        return before, await limiter.retry_after(IP)

    before, wait = arun(scenario())
    assert before == [None, None, None]
    assert isinstance(wait, int) and 1 <= wait <= 60 + bucket_seconds(60)


@pytest.mark.parametrize("kind", KINDS)
def test_keys_are_independent(kind, name, clock):
    async def scenario():
        limiter = build(kind, name, clock)
        await fill(limiter, "1.1.1.1")
        return await limiter.retry_after("1.1.1.1"), await limiter.retry_after("2.2.2.2")

    blocked, other = arun(scenario())
    assert blocked is not None and other is None


@pytest.mark.parametrize("kind", KINDS)
def test_waiting_as_told_frees_the_key(kind, name, clock):
    async def scenario():
        limiter = build(kind, name, clock)
        await fill(limiter)
        clock.advance(10)
        wait = await limiter.retry_after(IP)
        still = await limiter.retry_after(IP)
        clock.advance(wait - 2)
        almost = await limiter.retry_after(IP)
        clock.advance(2)
        return wait, still, almost, await limiter.retry_after(IP)

    wait, still, almost, freed = arun(scenario())
    assert wait == still and almost is not None          # not free two seconds early (the exact window rounds up by one)
    assert freed is None                                  # free once the wait is over


@pytest.mark.parametrize("kind", KINDS)
def test_a_count_lives_at_least_half_the_window_and_at_most_a_window_and_a_bucket(kind, name, clock):
    async def scenario():
        limiter = build(kind, name, clock)
        await fill(limiter)
        clock.advance(30)
        half = await limiter.retry_after(IP)
        clock.advance(30 + bucket_seconds(60))
        return half, await limiter.retry_after(IP)

    half, over = arun(scenario())
    assert half is not None                               # 30 s later the events still count
    assert over is None                                   # a window and a bucket later none does


@pytest.mark.parametrize("kind", KINDS)
def test_old_events_expire_one_by_one_not_all_at_once(kind, name, clock):
    """3 allowed per minute; two events early, one late: the early pair leaving frees one slot."""
    async def scenario():
        limiter = build(kind, name, clock, max_events=3, window=600)
        await limiter.add(IP)
        await limiter.add(IP)
        clock.advance(400)
        await limiter.add(IP)
        blocked = await limiter.retry_after(IP)
        clock.advance(200 + bucket_seconds(600))         # the first two are gone, the third is not
        return blocked, await limiter.retry_after(IP)

    blocked, later = arun(scenario())
    assert blocked is not None and later is None


@pytest.mark.parametrize("kind", KINDS)
def test_reset_frees_one_key_or_the_whole_counter(kind, name, clock):
    async def scenario():
        limiter = build(kind, name, clock)
        await fill(limiter, "1.1.1.1")
        await fill(limiter, "2.2.2.2")
        await limiter.reset("1.1.1.1")
        one = (await limiter.retry_after("1.1.1.1"), await limiter.retry_after("2.2.2.2"))
        await limiter.reset()
        return one, (await limiter.retry_after("1.1.1.1"), await limiter.retry_after("2.2.2.2"))

    one, everything = arun(scenario())
    assert one[0] is None and one[1] is not None
    assert everything == (None, None)


@pytest.mark.parametrize("kind", KINDS)
def test_a_limit_of_one_blocks_after_the_first_event(kind, name, clock):
    async def scenario():
        limiter = build(kind, name, clock, max_events=1, window=10)
        first = await limiter.retry_after(IP)
        await limiter.add(IP)
        return first, await limiter.retry_after(IP)

    first, second = arun(scenario())
    assert first is None and second is not None and 1 <= second <= 10 + bucket_seconds(10)


@pytest.mark.parametrize("kind", KINDS)
def test_every_counter_is_a_rate_limiter_port(kind, name, clock):
    assert isinstance(build(kind, name, clock), RateLimiterPort)


# ---------------------------------------------------------------------------
# what only a shared store does
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("kind", SHARED_KINDS)
def test_two_instances_over_one_store_share_their_counts(kind, name, clock):
    async def scenario():
        first, second = build(kind, name, clock), build(kind, name, clock)
        await first.add(IP)
        await second.add(IP)
        both = await first.retry_after(IP)
        await second.add(IP)
        return both, await first.retry_after(IP), await second.retry_after(IP)

    both, via_first, via_second = arun(scenario())
    assert both is None                                   # 2 of 3
    assert via_first is not None and via_second is not None   # 3 of 3, seen from either instance


def test_two_memory_counters_do_not_share_anything(clock, name):
    async def scenario():
        first, second = build("memory", name, clock), build("memory", name, clock)
        await fill(first)
        return await first.retry_after(IP), await second.retry_after(IP)

    blocked, free = arun(scenario())
    assert blocked is not None and free is None           # which is exactly why a shared store exists


@pytest.mark.parametrize("kind", SHARED_KINDS)
def test_counters_with_different_names_do_not_meet(kind, name, clock):
    async def scenario():
        mine, other = build(kind, name + "_a", clock), build(kind, name + "_b", clock)
        await fill(mine)
        return await mine.retry_after(IP), await other.retry_after(IP)

    blocked, free = arun(scenario())
    assert blocked is not None and free is None


@pytest.mark.parametrize("kind", SHARED_KINDS)
def test_concurrent_adds_from_two_instances_lose_no_event(kind, name, clock):
    async def scenario():
        first, second = build(kind, name, clock, max_events=20), build(kind, name, clock, max_events=20)
        await asyncio.gather(*[(first if index % 2 else second).add(IP) for index in range(20)])
        at_limit = await first.retry_after(IP)
        roomy = build(kind, name, clock, max_events=21)
        return at_limit, await roomy.retry_after(IP)

    at_limit, one_more_allowed = arun(scenario())
    assert at_limit is not None                           # all 20 were counted
    assert one_more_allowed is None                       # and not 21


@pytest.mark.parametrize("kind", SHARED_KINDS)
def test_the_store_keeps_a_digest_of_the_address_not_the_address(kind, name, clock, fake_db):
    async def scenario():
        limiter = build(kind, name, clock)
        await limiter.add(IP)
        if kind == "mongo":
            return [dict(doc) for doc in fake_db["rate_limits"].documents.values()]
        session = get_async_session()
        try:
            result = await session.execute(
                text("SELECT limiter, subject, bucket, hits, expires_at FROM rate_limit_hits WHERE limiter = :n"), {"n": name}
            )
            return [dict(row._mapping) for row in result.fetchall()]
        finally:
            await session.close()

    rows = arun(scenario())
    assert len(rows) == 1 and rows[0]["subject"] == subject_digest(IP) and rows[0]["hits"] == 1
    assert IP not in repr(rows)
    assert rows[0]["bucket"] == bucket_of(START, 60)


def test_database_rows_past_their_expiry_are_deleted_by_the_next_add(name, clock):
    async def rows():
        session = get_async_session()
        try:
            result = await session.execute(
                text("SELECT bucket FROM rate_limit_hits WHERE limiter = :n ORDER BY bucket"), {"n": name}
            )
            return [row[0] for row in result.fetchall()]
        finally:
            await session.close()

    async def scenario():
        limiter = DatabaseRateLimiter(name, 3, 60, clock=clock, purge_every_s=60)
        await limiter.add("1.1.1.1")
        await limiter.add("2.2.2.2")
        first = await rows()
        clock.advance(60 + 2 * bucket_seconds(60))        # both buckets are dead now
        await limiter.add("3.3.3.3")
        return first, await rows()

    first, after = arun(scenario())
    assert first == [bucket_of(START, 60)] * 2          # one row per address
    assert after == [bucket_of(START + 60 + 2 * bucket_seconds(60), 60)]    # the two dead rows are gone


def test_database_purge_runs_at_most_once_per_interval(name, clock):
    async def count():
        session = get_async_session()
        try:
            return (await session.execute(
                text("SELECT COUNT(*) FROM rate_limit_hits WHERE limiter = :n"), {"n": name})).scalar()
        finally:
            await session.close()

    async def scenario():
        limiter = DatabaseRateLimiter(name, 3, 60, clock=clock, purge_every_s=3600)
        await limiter.add("1.1.1.1")                       # purges (first call), nothing to delete
        clock.advance(60 + 2 * bucket_seconds(60))
        await limiter.add("2.2.2.2")                       # inside the hour: the dead row stays for now
        return await count()

    assert arun(scenario()) == 2


def test_mongo_asks_for_a_ttl_index_on_expire_at(name, clock, fake_db):
    async def scenario():
        await MongoRateLimiter(name, 3, 60, clock=clock).add(IP)

    arun(scenario())
    assert "expire_at" in fake_db["rate_limits"].indexes
    document = next(iter(fake_db["rate_limits"].documents.values()))
    assert document["expire_at"].tzinfo is not None
    assert int(document["expire_at"].timestamp()) == bucket_expires_at(bucket_of(START, 60), 60)


def test_a_counter_name_must_fit_the_store():
    with pytest.raises(ValueError):
        DatabaseRateLimiter("x" * 49, 1, 1)
    with pytest.raises(ValueError):
        DatabaseRateLimiter("", 1, 1)
    with pytest.raises(ValueError):
        MongoRateLimiter("a:b", 1, 1)


def test_the_table_is_created_on_demand_and_only_once(name, clock):
    calls = []

    def factory():
        session = get_async_session()
        real = session.execute

        async def spy(statement, *args, **kwargs):
            calls.append(str(statement))
            return await real(statement, *args, **kwargs)

        session.execute = spy
        return session

    async def scenario():
        limiter = DatabaseRateLimiter(name, 3, 60, clock=clock, session_factory=factory)
        await limiter.add(IP)
        await limiter.retry_after(IP)
        await limiter.add(IP)

    arun(scenario())
    assert sum("CREATE TABLE IF NOT EXISTS rate_limit_hits" in call for call in calls) == 1


# ---------------------------------------------------------------------------
# the arithmetic the two persistent counters share
# ---------------------------------------------------------------------------
def test_buckets_are_a_sixth_of_the_window_and_at_least_a_second():
    assert [bucket_seconds(window) for window in (1, 6, 60, 600, 3600, 7)] == [1, 1, 10, 100, 600, 2]


def test_live_buckets_cover_exactly_the_buckets_that_can_hold_an_event_of_the_window():
    window = 60
    for now in (START, START + 3.5, START + 9.99, START + 10, START + 59):
        live = live_buckets(now, window)
        assert live.stop - 1 == bucket_of(now, window)
        for bucket in range(live.start - 3, live.stop):
            reachable = bucket_expires_at(bucket, window) > now        # the end of its slot is still in the window
            assert (bucket in live) == reachable


def test_wait_seconds_names_the_moment_enough_buckets_have_expired():
    window, now = 60, START
    first, second = bucket_of(now, window), bucket_of(now, window) + 3
    counts = {first: 2, second: 1}
    assert wait_seconds(counts, now, window, 4) is None
    assert wait_seconds(counts, now, window, 3) == max(1, int(bucket_expires_at(first, window) - now + 0.999999))
    until_first = max(1, int(bucket_expires_at(first, window) - now + 0.999999))
    until_second = max(1, int(bucket_expires_at(second, window) - now + 0.999999))
    assert until_first < until_second
    assert wait_seconds({first: 3, second: 2}, now, window, 3) == until_first      # the first bucket alone frees enough
    assert wait_seconds({first: 3, second: 2}, now, window, 2) == until_second     # it does not: the second must go too


def test_wait_seconds_counts_the_excess_when_instances_overshot_the_limit():
    """Two instances can both pass the check, so a bucket can hold more than the limit."""
    window, now = 60, START
    early, late = bucket_of(now, window), bucket_of(now, window) + 4
    # limit 3, 5 events: two must expire before one more fits, and the early bucket holds 3
    assert wait_seconds({early: 3, late: 2}, now, window, 3) == wait_seconds({early: 3}, now, window, 3)
    # the early bucket holds only 1: it takes the late one too
    wait = wait_seconds({early: 1, late: 4}, now, window, 3)
    assert wait == max(1, int(bucket_expires_at(late, window) - now + 0.999999))


def test_the_bucketed_window_is_never_looser_than_the_exact_one():
    """Random traffic: whenever an exact sliding window refuses, the bucketed one refuses too,
    and the wait it names is at most one bucket longer."""
    rng = random.Random(20261016)
    for window, limit in ((60, 5), (600, 20), (3600, 10), (7, 3)):
        exact_clock = Clock()
        exact = FailureWindow(limit, window, clock=exact_clock)
        counts = {}
        for _ in range(400):
            exact_clock.advance(rng.choice((0, 0, 1, 2, 5, window // 7 + 1)))
            now = exact_clock.now
            live = live_buckets(now, window)
            seen = {bucket: hits for bucket, hits in counts.items() if bucket in live}
            bucketed = wait_seconds(seen, now, window, limit)
            sliding = exact.retry_after(IP)
            if sliding is not None:
                assert bucketed is not None
                assert bucketed <= sliding + bucket_seconds(window) + 1
            if sliding is None and bucketed is None:
                exact.add(IP)
                bucket = bucket_of(now, window)
                counts[bucket] = counts.get(bucket, 0) + 1


def test_a_wrapper_makes_the_legacy_window_a_port_and_refuses_anything_else():
    window = FailureWindow(2, 60, clock=Clock())
    port = as_rate_limiter(window)

    async def scenario():
        await port.add(IP)
        await port.add(IP)
        return await port.retry_after(IP)

    assert isinstance(port, RateLimiterPort) and arun(scenario()) is not None and window.retry_after(IP) is not None
    assert as_rate_limiter(None) is None
    assert as_rate_limiter(port) is port
    with pytest.raises(TypeError):
        as_rate_limiter(object())


# ---------------------------------------------------------------------------
# fail open
# ---------------------------------------------------------------------------
class Broken(RateLimiterPort):
    """A store that raises; the message carries the secrets a driver error would."""

    def __init__(self, error=None, delay=0.0):
        self.calls = 0
        self.error = error or RuntimeError("OperationalError mysql://admin:hunter2@db.internal.example/app 203.0.113.7")
        self.delay = delay

    async def retry_after(self, key):
        self.calls += 1
        if self.delay:
            await asyncio.sleep(self.delay)
        raise self.error

    async def add(self, key):
        self.calls += 1
        if self.delay:
            await asyncio.sleep(self.delay)
        raise self.error

    async def reset(self, key=None):
        self.calls += 1
        raise self.error


def fail_open(primary, clock, cooldown=30.0, timeout=1.0):
    return FailOpenRateLimiter(primary, MemoryRateLimiter(3, 60, clock), name="unit", timeout_s=timeout,
                               cooldown_s=cooldown, clock=clock)


def test_a_failing_store_never_raises_and_the_instance_counts_in_memory(clock, caplog):
    broken = Broken()
    limiter = fail_open(broken, clock)

    async def scenario():
        first = await limiter.retry_after(IP)
        for _ in range(3):
            await limiter.add(IP)
        return first, await limiter.retry_after(IP)

    with caplog.at_level(logging.WARNING):
        first, blocked = arun(scenario())
    assert first is None and blocked is not None          # the memory fallback still enforces the limit
    assert limiter.degraded is True


def test_the_warning_names_the_failure_class_but_never_the_message_the_host_or_the_key(clock, caplog):
    limiter = fail_open(Broken(), clock)
    with caplog.at_level(logging.WARNING):
        arun(limiter.retry_after(IP))
    text_ = caplog.text
    assert "RuntimeError" in text_ and "unit" in text_
    for secret in ("hunter2", "db.internal.example", "mysql://", IP):
        assert secret not in text_


def test_a_failed_store_is_not_asked_again_during_the_cooldown_and_is_tried_after_it(clock):
    broken = Broken()
    limiter = fail_open(broken, clock, cooldown=30)

    async def scenario():
        await limiter.retry_after(IP)
        calls_after_first = broken.calls
        for _ in range(5):
            await limiter.add(IP)
            await limiter.retry_after(IP)
        during = broken.calls
        clock.advance(31)
        await limiter.retry_after(IP)
        return calls_after_first, during, broken.calls

    first, during, after = arun(scenario())
    assert first == 1 and during == 1 and after == 2


def test_a_store_that_comes_back_is_used_again(clock, name, caplog):
    flaky = {"down": True}
    real = DatabaseRateLimiter(name, 3, 60, clock=clock)

    class Switch(RateLimiterPort):
        async def retry_after(self, key):
            if flaky["down"]:
                raise ConnectionError("down")
            return await real.retry_after(key)

        async def add(self, key):
            if flaky["down"]:
                raise ConnectionError("down")
            await real.add(key)

        async def reset(self, key=None):
            await real.reset(key)

    limiter = fail_open(Switch(), clock, cooldown=10)

    async def scenario():
        await limiter.add(IP)                              # store down: counted in memory
        degraded = limiter.degraded
        flaky["down"] = False
        clock.advance(11)
        await fill(limiter, IP, 3)                         # store back: counted there
        return degraded, limiter.degraded, await real.retry_after(IP)

    with caplog.at_level(logging.INFO):
        degraded, still, in_store = arun(scenario())
    assert degraded is True and still is False and in_store is not None
    assert "works again" in caplog.text


def test_a_store_that_hangs_costs_one_timeout_not_one_per_request(clock):
    hanging = Broken(delay=5.0)
    limiter = fail_open(hanging, clock, timeout=0.2)

    async def scenario():
        started = asyncio.get_running_loop().time()
        await limiter.retry_after(IP)
        first = asyncio.get_running_loop().time() - started
        for _ in range(5):
            await limiter.add(IP)
        return first, asyncio.get_running_loop().time() - started

    first, total = arun(scenario())
    assert 0.15 <= first < 2.0 and total < 2.0 and hanging.calls == 1


def test_a_real_database_that_cannot_be_reached_is_survived(clock, name):
    def refuse():
        raise ConnectionRefusedError("[Errno 111] Connect call failed ('10.0.0.5', 3306)")

    limiter = FailOpenRateLimiter(DatabaseRateLimiter(name, 2, 60, clock=clock, session_factory=refuse),
                                  MemoryRateLimiter(2, 60, clock), name=name, cooldown_s=30, clock=clock)

    async def scenario():
        await fill(limiter, IP, 2)
        return await limiter.retry_after(IP)

    assert arun(scenario()) is not None


def test_a_database_without_the_table_fails_open_and_creates_it_on_the_next_try(clock, name):
    class Down:
        """Raises on the first call to the session, then behaves."""

        def __init__(self):
            self.refused = True

        def __call__(self):
            if self.refused:
                self.refused = False
                raise ConnectionError("first connection fails")
            return get_async_session()

    limiter = FailOpenRateLimiter(DatabaseRateLimiter(name, 2, 60, clock=clock, session_factory=Down()),
                                  MemoryRateLimiter(2, 60, clock), name=name, cooldown_s=5, clock=clock)

    async def scenario():
        await limiter.add(IP)                              # fails -> memory
        clock.advance(6)
        await limiter.add(IP)                              # cooldown over -> the store
        return limiter.degraded, await limiter.retry_after(IP)

    degraded, wait = arun(scenario())
    assert degraded is False and wait is None              # 1 event in the store, limit 2


def test_reset_clears_both_counters_even_when_the_store_is_down(clock):
    limiter = fail_open(Broken(), clock)

    async def scenario():
        await fill(limiter, IP, 3)
        blocked = await limiter.retry_after(IP)
        await limiter.reset(IP)
        return blocked, await limiter.retry_after(IP)

    blocked, freed = arun(scenario())
    assert blocked is not None and freed is None
