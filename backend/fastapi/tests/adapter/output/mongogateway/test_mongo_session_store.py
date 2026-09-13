"""The MongoDB session store: in-memory behaviour plus the sealed file mirror."""

import asyncio
import json

import pytest

from src.adapter.output.mongogateway.session_store import FileMongoSessionStore
from src.adapter.output.sqlgateway.crypto import is_available as crypto_available
from src.application.ports.output.mongo_gateway_output_port import MongoConnectionProfile
from src.application.ports.output.mongo_session_output_port import StoredMongoSession

SECRET = "unit-test-secret"
URI = "mongodb://root:s3cr3t@db.local:27017/shop?authSource=admin"

needs_crypto = pytest.mark.skipif(not crypto_available(), reason="cryptography is not installed")


def run(coro):
    return asyncio.run(coro)


def make_session(token="tok-1", uri=URI) -> StoredMongoSession:
    return StoredMongoSession(
        token=token,
        profile=MongoConnectionProfile(
            uri=uri,
            host="db.local",
            port=27017,
            username="root",
            database="shop",
            auth_source="admin",
        ),
        label="root@db.local:27017",
        server_version="8.0.4",
        server_flavor="MongoDB",
        topology="standalone",
    )


class TestInMemory:
    def test_create_then_get(self):
        store = FileMongoSessionStore(file_path=None, secret=SECRET, persist=False)
        created = run(store.create(make_session()))
        assert created.connected_at and created.last_used_at
        assert run(store.get("tok-1")).profile.uri == URI

    def test_get_returns_none_for_an_unknown_token(self):
        store = FileMongoSessionStore(file_path=None, secret=SECRET, persist=False)
        assert run(store.get("nope")) is None

    def test_touch_moves_last_used_at(self):
        store = FileMongoSessionStore(file_path=None, secret=SECRET, persist=False)
        run(store.create(make_session()))

        async def scenario():
            session = await store.touch("tok-1")
            return session.last_used_at

        assert run(scenario())
        assert run(store.touch("missing")) is None

    def test_delete_reports_whether_it_removed_anything(self):
        store = FileMongoSessionStore(file_path=None, secret=SECRET, persist=False)
        run(store.create(make_session()))
        assert run(store.delete("tok-1")) is True
        assert run(store.delete("tok-1")) is False

    def test_update_replaces_the_stored_session(self):
        store = FileMongoSessionStore(file_path=None, secret=SECRET, persist=False)
        session = run(store.create(make_session()))
        session.label = "renamed"
        run(store.update(session))
        assert run(store.get("tok-1")).label == "renamed"

    def test_persistence_is_off_without_a_path(self):
        store = FileMongoSessionStore(file_path=None, secret=SECRET, persist=False)
        assert store.persistent is False


@needs_crypto
class TestFileMirror:
    def test_sessions_survive_a_restart(self, tmp_path):
        path = tmp_path / "sessions.json"
        first = FileMongoSessionStore(file_path=path, secret=SECRET)
        run(first.create(make_session()))

        second = FileMongoSessionStore(file_path=path, secret=SECRET)
        restored = run(second.get("tok-1"))
        assert restored is not None
        assert restored.profile.uri == URI
        assert restored.profile.username == "root"
        assert restored.server_version == "8.0.4"

    def test_the_uri_is_never_written_in_the_clear(self, tmp_path):
        path = tmp_path / "sessions.json"
        store = FileMongoSessionStore(file_path=path, secret=SECRET)
        run(store.create(make_session()))

        raw = path.read_text(encoding="utf-8")
        assert "s3cr3t" not in raw
        assert URI not in raw
        record = json.loads(raw)["sessions"][0]
        assert record["host"] == "db.local"  # display fields stay readable
        assert record["uri"] != URI

    def test_rotating_the_secret_invalidates_stored_sessions(self, tmp_path):
        path = tmp_path / "sessions.json"
        run(FileMongoSessionStore(file_path=path, secret=SECRET).create(make_session()))

        rotated = FileMongoSessionStore(file_path=path, secret="a-different-secret")
        assert run(rotated.get("tok-1")) is None

    def test_delete_rewrites_the_file(self, tmp_path):
        path = tmp_path / "sessions.json"
        store = FileMongoSessionStore(file_path=path, secret=SECRET)
        run(store.create(make_session("a")))
        run(store.create(make_session("b")))
        run(store.delete("a"))

        tokens = {record["token"] for record in json.loads(path.read_text(encoding="utf-8"))["sessions"]}
        assert tokens == {"b"}

    def test_a_corrupt_file_does_not_break_startup(self, tmp_path):
        path = tmp_path / "sessions.json"
        path.write_text("{not json", encoding="utf-8")
        store = FileMongoSessionStore(file_path=path, secret=SECRET)
        assert run(store.get("tok-1")) is None

    def test_an_empty_secret_disables_persistence(self, tmp_path):
        store = FileMongoSessionStore(file_path=tmp_path / "sessions.json", secret="")
        assert store.persistent is False
        run(store.create(make_session()))
        assert not (tmp_path / "sessions.json").exists()
