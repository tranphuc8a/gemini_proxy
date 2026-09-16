"""Administrator sessions must survive the process that created them.

The bug behind this file: sessions were mirrored to a JSON file, and on a
serverless platform that file sits in a per-instance temp directory. The next
request lands on another instance, the mirror is empty, and the user is asked to
log in again — "lưu session không lâu".

Each test therefore builds a store, logs in, throws the store away, builds a
*second* store against the same backing, and checks the session is still there.
That is what a restart looks like from the store's point of view.
"""

import os

os.environ.setdefault("TESTING", "1")

import pytest

from src.adapter.output.mongogateway import session_store as mongo_sessions
from src.adapter.output.sessionstore import records as record_module
from src.adapter.output.sqlgateway import session_store as sql_sessions
from src.application.ports.output.sql_gateway_output_port import ConnectionProfile
from src.application.ports.output.sql_session_output_port import StoredSession
from tests.conftest import arun
from tests.support import fake_mongo

SECRET = "unit-test-secret-key"


def make_session(token: str = "tok-1") -> StoredSession:
    return StoredSession(
        token=token,
        profile=ConnectionProfile(
            host="db.example.com", port=3306, username="root",
            password="s3cr3t", database="shop", charset="utf8mb4",
        ),
        label="shop",
    )


@pytest.fixture
def json_backing(tmp_path, monkeypatch):
    monkeypatch.setattr(record_module.settings, "ADMIN_SESSION_BACKEND", "json", raising=False)
    return tmp_path / "sessions.json"


# ------------------------------------------------------------------ backends

def test_json_mirror_survives_a_restart(json_backing):
    async def scenario():
        first = sql_sessions.FileSessionStore(json_backing, SECRET)
        await first.create(make_session())

        # A brand-new store: nothing is shared with `first` but the file.
        second = sql_sessions.FileSessionStore(json_backing, SECRET)
        return await second.get("tok-1")

    restored = arun(scenario())
    assert restored is not None
    assert restored.profile.password == "s3cr3t", "the sealed password must come back readable"
    assert restored.label == "shop"


def test_mongo_mirror_survives_a_restart(tmp_path, monkeypatch):
    monkeypatch.setattr(record_module.settings, "ADMIN_SESSION_BACKEND", "mongo", raising=False)
    fake_mongo.install(monkeypatch, _MongoModuleShim)

    async def scenario():
        first = sql_sessions.FileSessionStore(tmp_path / "unused.json", SECRET)
        await first.create(make_session())
        second = sql_sessions.FileSessionStore(tmp_path / "unused.json", SECRET)
        return await second.get("tok-1")

    restored = arun(scenario())
    assert restored is not None
    assert restored.profile.host == "db.example.com"


def test_mysql_mirror_survives_a_restart(tmp_path, monkeypatch):
    """Runs against the suite's in-memory SQLite, which is why the record store
    sticks to portable SQL."""
    monkeypatch.setattr(record_module.settings, "ADMIN_SESSION_BACKEND", "mysql", raising=False)

    async def scenario():
        first = sql_sessions.FileSessionStore(tmp_path / "unused.json", SECRET)
        await first.create(make_session("tok-mysql"))
        second = sql_sessions.FileSessionStore(tmp_path / "unused.json", SECRET)
        return await second.get("tok-mysql")

    restored = arun(scenario())
    assert restored is not None
    assert restored.profile.username == "root"


# --------------------------------------------------------------- separation

def test_the_two_administrators_do_not_see_each_others_sessions(tmp_path, monkeypatch):
    """One table serves both, so the `kind` column has to actually separate them:
    a SQL session appearing in the MongoDB administrator would be a session
    fixation bug, not a cosmetic one."""
    monkeypatch.setattr(record_module.settings, "ADMIN_SESSION_BACKEND", "mysql", raising=False)

    async def scenario():
        sql_store = sql_sessions.FileSessionStore(tmp_path / "a.json", SECRET)
        await sql_store.create(make_session("shared-token"))

        mongo_store = mongo_sessions.FileMongoSessionStore(tmp_path / "b.json", SECRET)
        return await mongo_store.get("shared-token")

    assert arun(scenario()) is None


def test_the_two_kinds_are_different():
    assert sql_sessions.SESSION_KIND != mongo_sessions.SESSION_KIND


# ------------------------------------------------------------------ logout

def test_logout_removes_the_session_everywhere(json_backing):
    async def scenario():
        store = sql_sessions.FileSessionStore(json_backing, SECRET)
        await store.create(make_session())
        removed = await store.delete("tok-1")
        fresh = sql_sessions.FileSessionStore(json_backing, SECRET)
        return removed, await fresh.get("tok-1")

    removed, after = arun(scenario())
    assert removed is True
    assert after is None, "a logged-out session must not come back after a restart"


def test_a_rotated_secret_invalidates_stored_sessions(json_backing):
    """There is no server-side revocation list, so rotating the key is what
    revokes access; a session that survived it would defeat the point."""

    async def scenario():
        await sql_sessions.FileSessionStore(json_backing, SECRET).create(make_session())
        rotated = sql_sessions.FileSessionStore(json_backing, "a-completely-different-secret")
        return await rotated.get("tok-1")

    assert arun(scenario()) is None


# ------------------------------------------------------------ configuration

def test_an_unknown_backend_falls_back_to_json_rather_than_refusing_to_start(tmp_path, monkeypatch):
    monkeypatch.setattr(record_module.settings, "ADMIN_SESSION_BACKEND", "postgres", raising=False)
    store = record_module.build_record_store(tmp_path / "s.json")
    assert isinstance(store, record_module.JsonRecordStore)


def test_mongo_without_a_uri_falls_back_to_json(tmp_path, monkeypatch):
    monkeypatch.setattr(record_module.settings, "ADMIN_SESSION_BACKEND", "mongo", raising=False)
    from src.adapter.output.mongostore import client as mongo_client

    monkeypatch.setattr(mongo_client, "is_configured", lambda: False)
    assert isinstance(record_module.build_record_store(tmp_path / "s.json"), record_module.JsonRecordStore)


def test_no_file_and_no_database_means_memory_only():
    assert isinstance(record_module.build_record_store(None, backend="json"), record_module.NullRecordStore)


def test_a_broken_mirror_does_not_break_login(tmp_path, monkeypatch):
    """Persistence is a convenience; losing it must not stop anyone logging in.

    The failure is injected at the store the session module actually uses, not
    at `record_module.build_record_store`, because the name is bound at import
    time — patching the source module would have tested nothing.
    """

    class Exploding(record_module.SessionRecordStore):
        async def load(self, kind):
            raise OSError("disk on fire")

        async def save(self, kind, records):
            raise OSError("disk on fire")

    monkeypatch.setattr(sql_sessions, "build_record_store", lambda *a, **k: Exploding())

    async def scenario():
        store = sql_sessions.FileSessionStore(tmp_path / "s.json", SECRET)
        await store.create(make_session())
        # The session works for this process; only its survival is lost.
        return await store.get("tok-1")

    assert arun(scenario()) is not None


def test_storage_label_says_where_sessions_live(json_backing):
    store = sql_sessions.FileSessionStore(json_backing, SECRET)
    assert "json" in store.storage_label


class _MongoModuleShim:
    """`fake_mongo.install` patches a module's `mongo_store`; the record store
    imports it inside a function, so hand the fake a module-shaped object."""

    from src.adapter.output.mongostore import client as mongo_store  # noqa: F401


# ------------------------------------------------------- more than one worker

def test_a_worker_finds_a_session_another_worker_created(json_backing):
    """The signout-while-working bug.

    Each store reads the mirror once, at its own first request. Worker B did
    that before the session existed, and the `_loaded` flag stopped it ever
    looking again — so a session created on worker A was invisible to B for the
    life of the process. Every request that landed on B answered 401 and signed
    the user out, at random, in the middle of a session.
    """

    async def scenario():
        worker_b = sql_sessions.FileSessionStore(json_backing, SECRET)
        # B does its one-time read now, while the mirror is still empty.
        assert await worker_b.get("tok-1") is None

        worker_a = sql_sessions.FileSessionStore(json_backing, SECRET)
        await worker_a.create(make_session())

        # Rate limiting must not hide the session from the next real request.
        worker_b._last_reload = 0.0
        return await worker_b.touch("tok-1")

    assert arun(scenario()) is not None, "worker B still cannot see the session"


def test_a_logout_on_one_worker_is_seen_by_another(json_backing):
    """The reload replaces rather than merges, or a logout elsewhere would be
    undone by the next worker that reloaded."""

    async def scenario():
        worker_a = sql_sessions.FileSessionStore(json_backing, SECRET)
        await worker_a.create(make_session())

        worker_b = sql_sessions.FileSessionStore(json_backing, SECRET)
        assert await worker_b.get("tok-1") is not None, "B should see A's session"

        await worker_a.delete("tok-1")
        worker_b._last_reload = 0.0
        return await worker_b.touch("tok-1")

    assert arun(scenario()) is None


def test_a_dead_token_does_not_hit_the_mirror_on_every_request(json_backing, monkeypatch):
    """Rate limiting: without it a client holding an expired token would turn
    each of its requests into a database round trip."""

    async def scenario():
        store = sql_sessions.FileSessionStore(json_backing, SECRET)
        await store.get("warm-up")

        reads = {"count": 0}
        original = store._records.load

        async def counting(kind):
            reads["count"] += 1
            return await original(kind)

        store._records.load = counting
        store._last_reload = 0.0

        for _ in range(20):
            assert await store.touch("never-existed") is None
        return reads["count"]

    assert arun(scenario()) == 1, "the mirror should be re-read once, not per request"


def test_the_miss_path_costs_nothing_when_the_session_is_present(json_backing):
    """The reload must stay on the failure path; a hit should not touch the
    mirror at all, or every query would carry a round trip."""

    async def scenario():
        store = sql_sessions.FileSessionStore(json_backing, SECRET)
        await store.create(make_session())

        reads = {"count": 0}
        original = store._records.load

        async def counting(kind):
            reads["count"] += 1
            return await original(kind)

        store._records.load = counting
        for _ in range(10):
            assert await store.touch("tok-1") is not None
        return reads["count"]

    assert arun(scenario()) == 0
