"""Which counter `RATE_LIMIT_BACKEND` picks, and that `/run` and `/codestore` use it.

`auto` is the part with consequences: a MySQL deployment must end up on the shared
table without anyone setting a thing, and a laptop, a test run or a SQLite file must
stay in memory. The use-case tests then show the point of the feature: two
instances over one store count together, and a store that is down never takes the
request with it.
"""

import os

os.environ.setdefault("TESTING", "1")

import hashlib
import logging

import pytest

from src.adapter.factory import rate_limit_factory
from src.adapter.factory.rate_limit_factory import build_rate_limiter, resolve_backend
from src.adapter.output.codestore.json_repository import JsonCodestoreRepository
from src.adapter.output.ratelimit import mongo_rate_limiter
from src.adapter.output.ratelimit.database_rate_limiter import DatabaseRateLimiter
from src.adapter.output.ratelimit.mongo_rate_limiter import MongoRateLimiter
from src.application.config.config import settings
from src.application.exceptions.exceptions import AppException
from src.application.ports.output.code_executor_port import CodeExecutorPort
from src.application.ports.output.rate_limiter_port import RateLimiterPort
from src.application.usecases.codestore_usecase import CodestoreUseCase
from src.application.usecases.run_usecase import RunUseCase
from src.application.utils.rate_limiter import FailOpenRateLimiter, MemoryRateLimiter
from src.domain.vo.run_vo import RunCaller, RunRequestIn, StageResult, finish
from tests.conftest import arun
from tests.support import fake_mongo


@pytest.fixture
def name(request):
    return "w_" + hashlib.sha1(request.node.nodeid.encode()).hexdigest()[:24]


@pytest.fixture
def env(monkeypatch):
    """Settings the way `auto` reads them, with nothing from the developer's own .env."""
    monkeypatch.delenv("DB_URL", raising=False)
    monkeypatch.setattr(settings, "DB_URL", "")
    monkeypatch.setattr(settings, "RATE_LIMIT_BACKEND", "auto")
    monkeypatch.setattr(settings, "MONGO_URI", "")
    return monkeypatch


# ---------------------------------------------------------------------------
# resolve_backend / build_rate_limiter
# ---------------------------------------------------------------------------
def test_auto_picks_the_database_for_a_real_mysql(env):
    env.setattr(settings, "DB_URL", "mysql+aiomysql://user:pw@db.example:3306/app")
    assert resolve_backend(under_test=False) == "database"


def test_auto_picks_the_database_when_the_db_fields_describe_mysql(env):
    assert resolve_backend(under_test=False) == "database"          # no DB_URL: DB_HOST/... are a MySQL server


def test_auto_stays_in_memory_for_a_sqlite_file(env):
    env.setattr(settings, "DB_URL", "sqlite+aiosqlite:///data/dev.sqlite3")
    assert resolve_backend(under_test=False) == "memory"


def test_the_environment_url_beats_the_settings_one_like_the_engine_does(env):
    env.setattr(settings, "DB_URL", "mysql+aiomysql://user:pw@db.example/app")
    env.setenv("DB_URL", "sqlite+aiosqlite:///x.sqlite3")
    assert resolve_backend(under_test=False) == "memory"


def test_auto_stays_in_memory_under_test_whatever_the_database(env):
    env.setattr(settings, "DB_URL", "mysql+aiomysql://user:pw@db.example/app")
    assert resolve_backend(under_test=True) == "memory"
    assert resolve_backend() == "memory"                              # and this very run is a test run


def test_auto_never_picks_mongo_even_when_it_is_configured(env):
    env.setattr(settings, "MONGO_URI", "mongodb://127.0.0.1:27017")
    env.setattr(settings, "DB_URL", "sqlite+aiosqlite:///x.sqlite3")
    assert resolve_backend(under_test=False) == "memory"
    env.setattr(settings, "DB_URL", "mysql+aiomysql://user:pw@db.example/app")
    assert resolve_backend(under_test=False) == "database"


@pytest.mark.parametrize("chosen", ["memory", "database", "mongo", "MEMORY", " Database "])
def test_an_explicit_choice_is_taken_as_is_even_under_test(env, chosen):
    env.setattr(settings, "RATE_LIMIT_BACKEND", chosen)
    assert resolve_backend() == chosen.strip().lower()


def test_an_unknown_value_falls_back_to_auto_with_a_warning(env, caplog):
    env.setattr(settings, "RATE_LIMIT_BACKEND", "redis")
    with caplog.at_level(logging.WARNING):
        assert resolve_backend(under_test=True) == "memory"
        env.setattr(settings, "DB_URL", "mysql+aiomysql://user:pw@db.example/app")
        assert resolve_backend(under_test=False) == "database"
    assert "redis" in caplog.text and "auto" in caplog.text


def test_build_returns_the_counter_the_backend_names(env, name):
    env.setattr(settings, "RATE_LIMIT_BACKEND", "memory")
    memory = build_rate_limiter(name, 5, 60)
    assert isinstance(memory, MemoryRateLimiter)

    env.setattr(settings, "RATE_LIMIT_BACKEND", "database")
    shared = build_rate_limiter(name, 5, 60)
    assert isinstance(shared, FailOpenRateLimiter) and isinstance(shared._primary, DatabaseRateLimiter)
    assert isinstance(shared._fallback, MemoryRateLimiter)

    env.setattr(settings, "RATE_LIMIT_BACKEND", "mongo")
    env.setattr(settings, "MONGO_URI", "mongodb://127.0.0.1:27017")
    document = build_rate_limiter(name, 5, 60)
    assert isinstance(document, FailOpenRateLimiter) and isinstance(document._primary, MongoRateLimiter)


def test_mongo_without_a_uri_counts_in_memory_and_says_so(env, name, caplog):
    env.setattr(settings, "RATE_LIMIT_BACKEND", "mongo")
    with caplog.at_level(logging.WARNING):
        limiter = build_rate_limiter(name, 5, 60)
    assert isinstance(limiter, MemoryRateLimiter) and "MONGO_URI" in caplog.text


def test_the_built_counter_enforces_the_limit_it_was_given(env, name):
    env.setattr(settings, "RATE_LIMIT_BACKEND", "database")
    limiter = build_rate_limiter(name, 2, 60)

    async def scenario():
        await limiter.add("9.9.9.9")
        await limiter.add("9.9.9.9")
        return await limiter.retry_after("9.9.9.9"), await limiter.retry_after("8.8.8.8")

    blocked, other = arun(scenario())
    assert blocked is not None and other is None


def test_the_timeout_setting_reaches_the_wrapper(env, name):
    env.setattr(settings, "RATE_LIMIT_BACKEND", "database")
    env.setattr(settings, "RATE_LIMIT_TIMEOUT_S", 7.5)
    assert build_rate_limiter(name, 2, 60)._timeout == 7.5


def test_test_run_detection_matches_the_sql_engine_fallback():
    assert rate_limit_factory.running_under_test() is True


# ---------------------------------------------------------------------------
# /run
# ---------------------------------------------------------------------------
class Echo(CodeExecutorPort):
    id, label, kind, needs_session = "fake", "Fake", "remote", False

    def languages(self):
        return ("python",)

    def multi_file_languages(self):
        return ()

    def availability(self):
        return True, ""

    async def execute(self, request):
        return finish(provider="fake", language="python", version="1", compile=None,
                      run=StageResult(ran=True, ok=True, stdout="hi\n", code=0))


def run_body():
    return RunRequestIn(provider="fake", language="python", files=[{"name": "main.py", "content": "print(1)"}])


def run_once(uc, ip="203.0.113.9"):
    return arun(uc.run(run_body(), RunCaller(ip=ip, admin=False)))


def test_two_run_instances_over_one_store_share_the_limit(name):
    first = RunUseCase({"fake": Echo()}, limiter=DatabaseRateLimiter(name, 2, 60))
    second = RunUseCase({"fake": Echo()}, limiter=DatabaseRateLimiter(name, 2, 60))
    run_once(first)
    run_once(second)
    with pytest.raises(AppException) as caught:
        run_once(first)
    error = caught.value
    assert error.status_code == 429 and error.payload["code"] == "run_rate_limited"
    assert error.payload["retryAfter"] >= 1 and error.headers["Retry-After"] == str(error.payload["retryAfter"])
    with pytest.raises(AppException):
        run_once(second)
    assert run_once(first, ip="198.51.100.1").ok is True             # another address is untouched


class Down(RateLimiterPort):
    def __init__(self):
        self.calls = 0

    async def retry_after(self, key):
        self.calls += 1
        raise ConnectionError("mysql://root:secret@10.0.0.9 unreachable")

    async def add(self, key):
        self.calls += 1
        raise ConnectionError("mysql://root:secret@10.0.0.9 unreachable")

    async def reset(self, key=None):
        raise ConnectionError("down")


def test_run_still_runs_when_the_shared_counter_is_down_and_limits_in_memory(caplog):
    down = Down()
    limiter = FailOpenRateLimiter(down, MemoryRateLimiter(2, 60), name="run", cooldown_s=30)
    uc = RunUseCase({"fake": Echo()}, limiter=limiter)
    with caplog.at_level(logging.WARNING):
        assert run_once(uc).ok is True
        assert run_once(uc).ok is True
        with pytest.raises(AppException) as caught:
            run_once(uc)
    assert caught.value.payload["code"] == "run_rate_limited"        # the in-memory counter still protects this instance
    assert down.calls == 1                                            # and the dead store was asked once, not per request
    assert "secret" not in caplog.text and "10.0.0.9" not in caplog.text


def test_run_accepts_the_legacy_in_process_window():
    from src.application.utils.rate_limit import FailureWindow

    uc = RunUseCase({"fake": Echo()}, limiter=FailureWindow(1, 60))
    run_once(uc)
    with pytest.raises(AppException):
        run_once(uc)


# ---------------------------------------------------------------------------
# /codestore
# ---------------------------------------------------------------------------
def store_usecase(repository, **limiters):
    return CodestoreUseCase(repository, **limiters)


def test_wrong_keys_are_counted_across_instances(tmp_path, name):
    repository = JsonCodestoreRepository(file_path=tmp_path / "codestore.json")

    def instance():
        return store_usecase(repository, failure_limiter=DatabaseRateLimiter(name, 3, 600))

    first, second = instance(), instance()

    async def scenario():
        created = await first.create_workspace("1.1.1.1")
        workspace_id = created["workspaceId"]
        outcomes = []
        for uc in (first, second, first):
            try:
                await uc.list_items(workspace_id, "wrong-key", 0, ip="203.0.113.50")
            except AppException as error:
                outcomes.append(error.payload["code"])
        try:
            await second.list_items(workspace_id, created["key"], 0, ip="203.0.113.50")
        except AppException as error:
            outcomes.append(error.payload["code"])
        other = await second.list_items(workspace_id, created["key"], 0, ip="198.51.100.2")
        return outcomes, other

    outcomes, other = arun(scenario())
    assert outcomes == ["codestore_bad_key"] * 3 + ["codestore_rate_limited"]      # the right key waits too
    assert other["items"] == []


def test_workspace_creation_is_counted_across_instances(tmp_path, name):
    repository = JsonCodestoreRepository(file_path=tmp_path / "codestore.json")
    first = store_usecase(repository, workspace_limiter=DatabaseRateLimiter(name, 2, 3600))
    second = store_usecase(repository, workspace_limiter=DatabaseRateLimiter(name, 2, 3600))

    async def scenario():
        await first.create_workspace("5.5.5.5")
        await second.create_workspace("5.5.5.5")
        with pytest.raises(AppException) as caught:
            await first.create_workspace("5.5.5.5")
        await second.create_workspace("6.6.6.6")
        return caught.value

    error = arun(scenario())
    assert error.status_code == 429 and error.payload["code"] == "codestore_rate_limited"
    assert error.headers["Retry-After"] == str(error.payload["retryAfter"])


def test_codestore_keeps_working_when_the_shared_counters_are_down(tmp_path, caplog):
    repository = JsonCodestoreRepository(file_path=tmp_path / "codestore.json")

    def guarded(max_events):
        return FailOpenRateLimiter(Down(), MemoryRateLimiter(max_events, 600), name="codestore", cooldown_s=30)

    uc = store_usecase(repository, workspace_limiter=guarded(2), failure_limiter=guarded(2))

    async def scenario():
        created = await uc.create_workspace("7.7.7.7")
        await uc.create_workspace("7.7.7.7")
        with pytest.raises(AppException) as too_many:
            await uc.create_workspace("7.7.7.7")
        for _ in range(2):
            with pytest.raises(AppException):
                await uc.list_items(created["workspaceId"], "wrong", 0, ip="7.7.7.7")
        with pytest.raises(AppException) as blocked:
            await uc.list_items(created["workspaceId"], created["key"], 0, ip="7.7.7.7")
        return too_many.value, blocked.value

    with caplog.at_level(logging.WARNING):
        too_many, blocked = arun(scenario())
    assert too_many.payload["code"] == "codestore_rate_limited" and blocked.payload["code"] == "codestore_rate_limited"
    assert "secret" not in caplog.text


def test_the_codestore_wiring_builds_one_shared_counter_per_purpose(monkeypatch, tmp_path):
    from src.adapter.factory import codestore_factory

    fake_mongo.install(monkeypatch, mongo_rate_limiter)
    codestore_factory.reset_for_tests()
    monkeypatch.setattr(settings, "RATE_LIMIT_BACKEND", "database")
    monkeypatch.setattr(settings, "CODESTORE_JSON_FILE", str(tmp_path / "codestore.json"))
    try:
        built = {name: codestore_factory._limiter(name) for name in ("workspaces", "failures", "share_reads", "share_failures")}
        assert all(isinstance(limiter, FailOpenRateLimiter) for limiter in built.values())
        names = {limiter._primary._name for limiter in built.values()}
        assert names == {"codestore_workspaces", "codestore_failures", "codestore_share_reads", "codestore_share_failures"}
        assert codestore_factory._limiter("failures") is built["failures"]            # cached: shared by every backend
    finally:
        codestore_factory.reset_for_tests()
