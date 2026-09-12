import asyncio
import json

import pytest

from src.adapter.output.sqlgateway.crypto import PasswordSealer, SealError, is_available
from src.adapter.output.sqlgateway.session_store import FileSessionStore
from src.application.ports.output.sql_gateway_output_port import ConnectionProfile
from src.application.ports.output.sql_session_output_port import StoredSession

SECRET = "test-secret-key"


def make_session(token="tok-1", password="s3cret", host="db.internal"):
    return StoredSession(
        token=token,
        profile=ConnectionProfile(host=host, port=3306, username="root", password=password, database="shop"),
        label="root@db.internal",
        server_version="8.0.36",
    )


def run(coro):
    return asyncio.run(coro)


@pytest.mark.skipif(not is_available(), reason="cryptography is not installed")
class TestPasswordSealer:
    def test_round_trip(self):
        sealer = PasswordSealer(SECRET)
        assert sealer.unseal(sealer.seal("hunter2")) == "hunter2"

    def test_empty_password_round_trips(self):
        sealer = PasswordSealer(SECRET)
        assert sealer.unseal(sealer.seal("")) == ""

    def test_ciphertext_is_not_the_plaintext(self):
        sealed = PasswordSealer(SECRET).seal("hunter2")
        assert "hunter2" not in sealed

    def test_nonce_makes_each_seal_unique(self):
        sealer = PasswordSealer(SECRET)
        assert sealer.seal("same") != sealer.seal("same")

    def test_other_key_cannot_open(self):
        sealed = PasswordSealer(SECRET).seal("hunter2")
        with pytest.raises(SealError):
            PasswordSealer("different-secret").unseal(sealed)

    def test_tampered_payload_is_rejected(self):
        sealer = PasswordSealer(SECRET)
        sealed = sealer.seal("hunter2")
        tampered = ("A" if sealed[0] != "A" else "B") + sealed[1:]
        with pytest.raises(SealError):
            sealer.unseal(tampered)

    def test_empty_secret_is_refused(self):
        with pytest.raises(ValueError):
            PasswordSealer("")


class TestFileSessionStore:
    def test_create_and_get(self, tmp_path):
        store = FileSessionStore(tmp_path / "sessions.json", SECRET)
        run(store.create(make_session()))
        loaded = run(store.get("tok-1"))
        assert loaded is not None and loaded.profile.username == "root"

    def test_create_stamps_timestamps(self, tmp_path):
        store = FileSessionStore(tmp_path / "sessions.json", SECRET)
        created = run(store.create(make_session()))
        assert created.connected_at and created.last_used_at

    def test_get_unknown_token(self, tmp_path):
        store = FileSessionStore(tmp_path / "sessions.json", SECRET)
        assert run(store.get("nope")) is None

    def test_touch_refreshes_and_returns_none_for_unknown(self, tmp_path):
        store = FileSessionStore(tmp_path / "sessions.json", SECRET)
        run(store.create(make_session()))
        assert run(store.touch("tok-1")) is not None
        assert run(store.touch("unknown")) is None

    def test_delete_reports_whether_it_existed(self, tmp_path):
        store = FileSessionStore(tmp_path / "sessions.json", SECRET)
        run(store.create(make_session()))
        assert run(store.delete("tok-1")) is True
        assert run(store.delete("tok-1")) is False
        assert run(store.get("tok-1")) is None

    @pytest.mark.skipif(not is_available(), reason="cryptography is not installed")
    def test_session_survives_a_restart(self, tmp_path):
        path = tmp_path / "sessions.json"
        run(FileSessionStore(path, SECRET).create(make_session()))

        restarted = FileSessionStore(path, SECRET)
        loaded = run(restarted.get("tok-1"))
        assert loaded is not None
        assert loaded.profile.password == "s3cret"
        assert loaded.profile.host == "db.internal"

    @pytest.mark.skipif(not is_available(), reason="cryptography is not installed")
    def test_password_is_not_written_in_clear(self, tmp_path):
        path = tmp_path / "sessions.json"
        run(FileSessionStore(path, SECRET).create(make_session()))
        raw = path.read_text(encoding="utf-8")
        assert "s3cret" not in raw
        assert json.loads(raw)["sessions"][0]["host"] == "db.internal"

    @pytest.mark.skipif(not is_available(), reason="cryptography is not installed")
    def test_rotated_secret_discards_stored_sessions(self, tmp_path):
        path = tmp_path / "sessions.json"
        run(FileSessionStore(path, SECRET).create(make_session()))
        assert run(FileSessionStore(path, "rotated-secret").get("tok-1")) is None

    @pytest.mark.skipif(not is_available(), reason="cryptography is not installed")
    def test_deleted_session_does_not_come_back_after_restart(self, tmp_path):
        path = tmp_path / "sessions.json"
        store = FileSessionStore(path, SECRET)
        run(store.create(make_session()))
        run(store.delete("tok-1"))
        assert run(FileSessionStore(path, SECRET).get("tok-1")) is None

    def test_persistence_disabled_keeps_memory_only(self, tmp_path):
        path = tmp_path / "sessions.json"
        store = FileSessionStore(path, SECRET, persist=False)
        run(store.create(make_session()))
        assert store.persistent is False
        assert not path.exists()
        assert run(store.get("tok-1")) is not None

    def test_missing_secret_disables_persistence(self, tmp_path):
        store = FileSessionStore(tmp_path / "sessions.json", "")
        assert store.persistent is False

    def test_corrupt_file_is_tolerated(self, tmp_path):
        path = tmp_path / "sessions.json"
        path.write_text("not json at all", encoding="utf-8")
        store = FileSessionStore(path, SECRET)
        assert run(store.get("tok-1")) is None

    def test_multiple_sessions_coexist(self, tmp_path):
        store = FileSessionStore(tmp_path / "sessions.json", SECRET)
        run(store.create(make_session("a", host="one")))
        run(store.create(make_session("b", host="two")))
        assert run(store.get("a")).profile.host == "one"
        assert run(store.get("b")).profile.host == "two"
