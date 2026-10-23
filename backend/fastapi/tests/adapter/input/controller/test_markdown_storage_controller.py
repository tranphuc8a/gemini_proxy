"""The admin session and the three storage backends of the markdown editor.

The behaviour under test is the bug report "mỗi khi reload lại phải nhập admin
token": the key used to live in one JavaScript variable and nothing else, so a
reload signed the user out. The fix is an exchange -- key in, signed token out --
so the browser can keep *something* without keeping the key.
"""

import json
import logging
import time
import types

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.adapter.input.controllers import markdown_admin
from src.adapter.input.controllers import markdown_storage_controller as controller
from src.application.exceptions.exceptions import AppException
from src.application.utils import admin_session
from src.main import app_exception_handler
from tests.support import fake_mongo

ADMIN_KEY = "test-admin-key"


def _app() -> FastAPI:
    app = FastAPI()
    app.include_router(controller.router)
    # The envelope `{status_code, message, data:{code}}` and the Retry-After header come from here.
    app.add_exception_handler(AppException, app_exception_handler)
    return app


@pytest.fixture(autouse=True)
def _fresh_admin_counters(monkeypatch):
    """Wrong guesses are counted per address for the whole process: every test starts clean."""
    for name in ("MARKDOWN_PUBLIC_READ", "MARKDOWN_ALLOW_DEFAULT_KEY", "MARKDOWN_ADMIN_MAX_FAILURES"):
        monkeypatch.delenv(name, raising=False)
    markdown_admin.reset_for_tests()
    yield
    markdown_admin.reset_for_tests()


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("MARKDOWN_ADMIN_KEY", ADMIN_KEY)
    monkeypatch.setenv("MARKDOWN_JSON_FILE", str(tmp_path / "markdown-files.json"))
    return TestClient(_app())


ADMIN = {"X-Admin-Key": ADMIN_KEY}


TREE = {
    "files": [
        {
            "id": "root",
            "name": "Notes",
            "type": "folder",
            "children": [
                {"id": "a", "name": "a.md", "type": "file", "content": "first"},
                {"id": "b", "name": "b.md", "type": "file", "content": "second"},
            ],
        },
        {"id": "c", "name": "c.md", "type": "file", "content": "third"},
    ]
}


# ------------------------------------------------------------------ admin auth

def test_wrong_key_is_rejected(client):
    assert client.post("/markdown/admin/verify", headers={"X-Admin-Key": "nope"}).status_code == 403


def test_verify_returns_a_session_token_that_unlocks_saving(client):
    issued = client.post("/markdown/admin/verify", headers={"X-Admin-Key": ADMIN_KEY})
    assert issued.status_code == 200
    token = issued.json()["session"]
    assert token and ADMIN_KEY not in token, "the token must not carry the key it was minted from"

    saved = client.put("/markdown/files", json=TREE, headers={"X-Admin-Session": token})
    assert saved.status_code == 200


def test_session_survives_a_reload_and_is_refreshed(client):
    token = client.post("/markdown/admin/verify", headers={"X-Admin-Key": ADMIN_KEY}).json()["session"]

    # What the editor does on page load: hand back the stored token, get a fresh one.
    refreshed = client.post("/markdown/admin/session", headers={"X-Admin-Session": token})
    assert refreshed.status_code == 200
    assert refreshed.json()["expiresAt"] >= int(time.time())


def test_rotating_the_admin_key_invalidates_every_token(client, monkeypatch):
    """There is no server-side session list, so changing the key has to be what
    revokes access -- otherwise a leaked token would outlive the leaked key."""
    token = client.post("/markdown/admin/verify", headers={"X-Admin-Key": ADMIN_KEY}).json()["session"]
    monkeypatch.setenv("MARKDOWN_ADMIN_KEY", "rotated-key")
    assert client.post("/markdown/admin/session", headers={"X-Admin-Session": token}).status_code == 403


def test_expired_token_is_refused(client, monkeypatch):
    monkeypatch.setattr(admin_session, "issue", lambda key, *, salt, ttl_seconds: admin_session.AdminSession(
        token=_expired_token(key, salt), expires_at=0
    ))
    token = client.post("/markdown/admin/verify", headers={"X-Admin-Key": ADMIN_KEY}).json()["session"]
    assert client.put("/markdown/files", json=TREE, headers={"X-Admin-Session": token}).status_code == 403


def _expired_token(key: str, salt: str) -> str:
    import base64
    import hashlib
    import hmac

    payload = json.dumps({"exp": int(time.time()) - 5, "nonce": "x"}, separators=(",", ":"))
    body = base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")
    secret = hashlib.sha256(f"{salt}:{key}".encode()).digest()
    signature = hmac.new(secret, body.encode(), hashlib.sha256).digest()
    return f"{body}.{base64.urlsafe_b64encode(signature).decode().rstrip('=')}"


def test_saving_without_any_credential_is_refused(client):
    assert client.put("/markdown/files", json=TREE).status_code == 403


def test_the_raw_key_still_works(client):
    """A script or curl holding the key should not have to do the exchange."""
    assert client.put("/markdown/files", json=TREE, headers={"X-Admin-Key": ADMIN_KEY}).status_code == 200


# -------------------------------------------------------------------- backends

def test_backends_endpoint_reports_mongo_as_unavailable_without_a_uri(client, monkeypatch):
    monkeypatch.setattr(controller.mongo_store, "is_configured", lambda: False)
    listed = {item["id"]: item for item in client.get("/markdown/backends").json()}
    assert listed["json"]["available"] is True
    assert listed["mongo"]["available"] is False
    assert "MONGO_URI" in listed["mongo"]["reason"]


def test_choosing_mongo_without_a_uri_fails_loudly(client, monkeypatch):
    monkeypatch.setattr(controller.mongo_store, "is_configured", lambda: False)
    response = client.get("/markdown/files?backend=mongo", headers=ADMIN)
    assert response.status_code == 503


def test_unknown_backend_is_a_client_error(client):
    assert client.get("/markdown/files?backend=postgres", headers=ADMIN).status_code == 400


def test_json_round_trip(client):
    client.put("/markdown/files", json=TREE, headers={"X-Admin-Key": ADMIN_KEY})
    assert client.get("/markdown/files", headers=ADMIN).json() == _normalised(TREE)


def test_mongo_round_trip_preserves_the_tree(client, monkeypatch):
    """Flat documents in, the same nesting and sibling order back out."""
    fake_mongo.install(monkeypatch, controller)

    saved = client.put("/markdown/files?backend=mongo", json=TREE, headers={"X-Admin-Key": ADMIN_KEY})
    assert saved.status_code == 200
    # Shape, not representation: a database backend rebuilds every node with an
    # explicit (possibly empty) child list, which the JSON one leaves unset.
    assert _outline(client.get("/markdown/files?backend=mongo", headers=ADMIN).json()["files"]) == _outline(TREE["files"])


def test_mongo_save_replaces_rather_than_accumulates(client, monkeypatch):
    database = fake_mongo.install(monkeypatch, controller)
    client.put("/markdown/files?backend=mongo", json=TREE, headers={"X-Admin-Key": ADMIN_KEY})
    client.put(
        "/markdown/files?backend=mongo",
        json={"files": [{"id": "only", "name": "only.md", "type": "file", "content": "x"}]},
        headers={"X-Admin-Key": ADMIN_KEY},
    )
    assert list(database[controller.MONGO_COLLECTION].documents) == ["only"]


def test_the_backends_are_separate_stores(client, monkeypatch):
    """Saving to mongo must not disturb what the json backend holds."""
    fake_mongo.install(monkeypatch, controller)
    client.put("/markdown/files", json=TREE, headers={"X-Admin-Key": ADMIN_KEY})
    client.put(
        "/markdown/files?backend=mongo",
        json={"files": [{"id": "only", "name": "only.md", "type": "file", "content": "x"}]},
        headers={"X-Admin-Key": ADMIN_KEY},
    )
    assert client.get("/markdown/files?backend=json", headers=ADMIN).json() == _normalised(TREE)


def _outline(nodes: list) -> list:
    """(id, content, children) for every node, ignoring how absent fields are spelt."""
    return [(node["id"], node.get("content"), _outline(node.get("children") or [])) for node in nodes]


def _normalised(tree: dict) -> dict:
    """The response model fills in the optional fields the fixture leaves out."""

    def walk(nodes):
        return [
            {
                "id": node["id"],
                "name": node["name"],
                "type": node["type"],
                "content": node.get("content"),
                "children": walk(node["children"]) if node.get("children") else None,
                "parentId": node.get("parentId"),
            }
            for node in nodes
        ]

    return {"files": walk(tree["files"])}


# ------------------------------------------------------------- tree rebuilding

def test_rows_to_tree_restores_sibling_order():
    """Rows come back from a database in whatever order it likes; the tree the
    user saved is the one they must get back."""
    rows = [
        {"id": "b", "name": "b.md", "node_type": "file", "content": None, "parent_id": "root", "sort_order": 1},
        {"id": "root", "name": "Notes", "node_type": "folder", "content": None, "parent_id": None, "sort_order": 0},
        {"id": "a", "name": "a.md", "node_type": "file", "content": None, "parent_id": "root", "sort_order": 0},
    ]
    tree = controller._rows_to_tree(rows)
    assert [node["id"] for node in tree] == ["root"]
    assert [child["id"] for child in tree[0]["children"]] == ["a", "b"]


def test_rows_to_tree_keeps_orphans_as_roots():
    rows = [
        {"id": "lost", "name": "lost.md", "node_type": "file", "content": "x", "parent_id": "gone", "sort_order": 0},
    ]
    assert [node["id"] for node in controller._rows_to_tree(rows)] == ["lost"]


def test_flatten_numbers_siblings_from_zero():
    nodes = controller.MarkdownDocument(**TREE).files
    positions = {node.id: (parent, position) for node, parent, position in controller._flatten(nodes)}
    assert positions["root"] == (None, 0)
    assert positions["c"] == (None, 1)
    assert positions["a"] == ("root", 0)
    assert positions["b"] == ("root", 1)


# -------------------------------------------- private store (Q1, md-share V17a)

def test_the_store_is_private_by_default(client):
    """A guest no longer reads the server's documents: that is what makes a share link
    the only way in for someone without the key."""
    client.put("/markdown/files", json=TREE, headers=ADMIN)
    guest = client.get("/markdown/files")
    assert guest.status_code == 403
    assert guest.json()["data"]["code"] == "markdown_private"
    session = client.post("/markdown/admin/verify", headers=ADMIN).json()["session"]
    assert client.get("/markdown/files", headers={"X-Admin-Session": session}).status_code == 200


def test_public_read_can_be_switched_back_on(client, monkeypatch):
    monkeypatch.setenv("MARKDOWN_PUBLIC_READ", "true")
    client.put("/markdown/files", json=TREE, headers=ADMIN)
    assert client.get("/markdown/files").json() == _normalised(TREE)


def test_a_wrong_credential_on_a_private_read_is_not_mistaken_for_a_guest(client):
    response = client.get("/markdown/files", headers={"X-Admin-Key": "nope"})
    assert response.status_code == 403 and response.json()["data"]["code"] == "markdown_admin_invalid"


# ------------------------------------------------------ admin hardening (B0)

def test_twenty_wrong_keys_lock_the_address_with_retry_after(client):
    for _ in range(20):
        assert client.post("/markdown/admin/verify", headers={"X-Admin-Key": "guess"}).status_code == 403
    locked = client.post("/markdown/admin/verify", headers=ADMIN)
    assert locked.status_code == 429, "the right key from a locked address must wait too"
    assert locked.json()["data"]["code"] == "markdown_admin_locked"
    assert int(locked.headers["retry-after"]) >= 1
    assert client.put("/markdown/files", json=TREE, headers=ADMIN).status_code == 429
    # Another address is not affected.
    elsewhere = client.post("/markdown/admin/verify", headers={**ADMIN, "X-Real-IP": "203.0.113.9"})
    assert elsewhere.status_code == 200


def test_forged_sessions_count_but_expired_ones_and_guests_do_not(client, monkeypatch):
    monkeypatch.setenv("MARKDOWN_ADMIN_MAX_FAILURES", "3")
    markdown_admin.reset_for_tests()
    expired = _expired_token(ADMIN_KEY, controller.SESSION_SALT)
    for _ in range(5):
        response = client.post("/markdown/admin/session", headers={"X-Admin-Session": expired})
        assert response.status_code == 403 and response.json()["data"]["code"] == "markdown_session_expired"
        assert client.put("/markdown/files", json=TREE).json()["data"]["code"] == "markdown_admin_required"
    assert client.put("/markdown/files", json=TREE, headers=ADMIN).status_code == 200
    for _ in range(3):
        forged = client.post("/markdown/admin/session", headers={"X-Admin-Session": "forged.token"})
        assert forged.json()["data"]["code"] == "markdown_session_invalid"
    assert client.put("/markdown/files", json=TREE, headers=ADMIN).status_code == 429


def test_keys_are_compared_in_constant_time(client, monkeypatch):
    calls = []
    real = markdown_admin.hmac.compare_digest

    def spy(a, b):
        calls.append((a, b))
        return real(a, b)

    monkeypatch.setattr(markdown_admin.hmac, "compare_digest", spy)
    assert client.post("/markdown/admin/verify", headers=ADMIN).status_code == 200
    assert calls and calls[-1] == (ADMIN_KEY.encode(), ADMIN_KEY.encode())


def test_the_public_default_key_is_refused_from_elsewhere(tmp_path, monkeypatch, caplog):
    monkeypatch.delenv("MARKDOWN_ADMIN_KEY", raising=False)
    monkeypatch.setattr(controller.settings, "MARKDOWN_ADMIN_KEY", markdown_admin.DEFAULT_ADMIN_KEY)
    monkeypatch.setenv("MARKDOWN_JSON_FILE", str(tmp_path / "markdown-files.json"))
    caplog.set_level(logging.WARNING)
    remote = TestClient(_app())
    refused = remote.post("/markdown/admin/verify", headers={"X-Admin-Key": markdown_admin.DEFAULT_ADMIN_KEY})
    assert refused.status_code == 403
    assert refused.json()["data"]["code"] == "markdown_default_key_refused"
    remote.post("/markdown/admin/verify", headers={"X-Admin-Key": markdown_admin.DEFAULT_ADMIN_KEY})
    assert caplog.text.count("public default") == 1, "warned once per process"

    # This machine talking to itself (development) still works ...
    local = TestClient(_app(), client=("127.0.0.1", 50000))
    assert local.post("/markdown/admin/verify", headers={"X-Admin-Key": markdown_admin.DEFAULT_ADMIN_KEY}).status_code == 200
    # ... unless a proxy sits in between (every visitor would look local).
    proxied = local.post("/markdown/admin/verify", headers={"X-Admin-Key": markdown_admin.DEFAULT_ADMIN_KEY, "X-Forwarded-For": "198.51.100.7"})
    assert proxied.status_code == 403
    # An explicit opt-in accepts it from anywhere.
    monkeypatch.setenv("MARKDOWN_ALLOW_DEFAULT_KEY", "true")
    assert remote.post("/markdown/admin/verify", headers={"X-Admin-Key": markdown_admin.DEFAULT_ADMIN_KEY}).status_code == 200


def test_the_old_check_name_is_kept_as_an_alias():
    assert controller._check_admin is controller.check_markdown_admin is markdown_admin.check_markdown_admin
    assert controller.require_markdown_admin is markdown_admin.require_markdown_admin


# ------------------------------------------------------------ M3V: loopback, long keys
class _Peer:
    """Just what `is_local_request` reads of a request: the socket peer and the headers."""

    def __init__(self, host, headers=None):
        self.client = types.SimpleNamespace(host=host) if host is not None else None
        self.headers = headers or {}


@pytest.mark.parametrize(
    "host",
    ["127.0.0.1", "127.0.0.2", "127.255.255.254", "::1", "::ffff:127.0.0.1", "::ffff:127.0.0.2", "::ffff:7f00:1", "localhost"],
)
def test_every_loopback_peer_is_this_machine(host):
    assert markdown_admin.is_local_request(_Peer(host)) is True


@pytest.mark.parametrize(
    "host", ["10.0.0.5", "192.168.1.9", "0.0.0.0", "::ffff:10.0.0.5", "::2", "2001:db8::1", "testclient", "not-an-ip", "127.0.0", "", None]
)
def test_other_peers_are_not(host):
    assert markdown_admin.is_local_request(_Peer(host)) is False


def test_a_proxy_header_means_not_local_even_from_loopback():
    for header in ("X-Forwarded-For", "X-Real-IP", "Forwarded", "X-Forwarded-Host"):
        assert markdown_admin.is_local_request(_Peer("::ffff:127.0.0.1", {header.lower(): "198.51.100.7"})) is False
    assert markdown_admin.is_local_request(None) is False


@pytest.mark.parametrize("peer", ["::ffff:127.0.0.1", "127.0.0.2", "::1"])
def test_the_public_default_key_works_from_any_loopback_form(tmp_path, monkeypatch, peer):
    monkeypatch.delenv("MARKDOWN_ADMIN_KEY", raising=False)
    monkeypatch.setattr(controller.settings, "MARKDOWN_ADMIN_KEY", markdown_admin.DEFAULT_ADMIN_KEY)
    local = TestClient(_app(), client=(peer, 50000))
    assert local.post("/markdown/admin/verify", headers={"X-Admin-Key": markdown_admin.DEFAULT_ADMIN_KEY}).status_code == 200


@pytest.mark.parametrize("length", [64, 200, 201, 700, 2048, 3000])
def test_an_admin_key_of_any_length_that_fits_a_header_unlocks(tmp_path, monkeypatch, length):
    """`max_length=200` made `/admin/verify` answer 422 for a longer key, so it could never unlock."""
    key = "k" * (length - 1) + "Z"
    monkeypatch.setenv("MARKDOWN_ADMIN_KEY", key)
    monkeypatch.setenv("MARKDOWN_JSON_FILE", str(tmp_path / "markdown-files.json"))
    client = TestClient(_app())
    verified = client.post("/markdown/admin/verify", headers={"X-Admin-Key": key})
    assert verified.status_code == 200, verified.text
    assert client.put("/markdown/files", json=TREE, headers={"X-Admin-Key": key}).status_code == 200
    wrong = client.post("/markdown/admin/verify", headers={"X-Admin-Key": key[:-1] + "Y"})
    assert wrong.status_code == 403 and wrong.json()["data"]["code"] == "markdown_admin_invalid"


def test_an_absurdly_long_wrong_key_is_a_counted_403_not_a_422(client):
    huge = {"X-Admin-Key": "x" * 5000}
    for _ in range(20):
        answer = client.post("/markdown/admin/verify", headers=huge)
        assert answer.status_code == 403 and answer.json()["data"]["code"] == "markdown_admin_invalid"
    assert client.post("/markdown/admin/verify", headers=ADMIN).status_code == 429, "guesses of any length are counted"


# ---------------------------------- the old whole-tree endpoints beside the delta store (md-sync B10)

@pytest.fixture()
def sync_client(tmp_path, monkeypatch):
    """The storage routes AND the sync routes on one app, the delta store on a temp file."""
    from src.adapter.factory import markdown_docs_factory, markdown_share_factory
    from src.adapter.input.controllers import markdown_docs_controller

    monkeypatch.setenv("MARKDOWN_ADMIN_KEY", ADMIN_KEY)
    monkeypatch.setenv("MARKDOWN_JSON_FILE", str(tmp_path / "markdown-files.json"))
    monkeypatch.setattr(controller.settings, "MARKDOWN_DOCS_JSON_FILE", str(tmp_path / "markdown-docs.json"))
    monkeypatch.setattr(controller.settings, "MARKDOWN_SHARES_JSON_FILE", str(tmp_path / "markdown-shares.json"))
    monkeypatch.delenv("MARKDOWN_LEGACY_PUT", raising=False)
    monkeypatch.setattr(controller.settings, "MARKDOWN_LEGACY_PUT", "allow")
    markdown_docs_factory.reset_for_tests()
    markdown_share_factory.reset_for_tests()
    api = _app()
    api.include_router(markdown_docs_controller.router)
    yield TestClient(api)
    markdown_docs_factory.reset_for_tests()
    markdown_share_factory.reset_for_tests()


def _migrate(client):
    """Any call of the sync routes copies the old store into the delta store."""
    assert client.get("/markdown/sync/changes", headers=ADMIN).status_code == 200


def test_the_default_keeps_the_old_endpoints_working_before_and_after_the_copy(sync_client):
    assert sync_client.put("/markdown/files", json=TREE, headers=ADMIN).status_code == 200
    _migrate(sync_client)
    later = {"files": [{"id": "only", "name": "only.md", "type": "file", "content": "saved by an old editor"}]}
    assert sync_client.put("/markdown/files", json=later, headers=ADMIN).status_code == 200, "MARKDOWN_LEGACY_PUT=allow until the new client ships"
    assert sync_client.get("/markdown/files", headers=ADMIN).json() == _normalised(later), "GET keeps reading the old store"
    assert sorted(i["id"] for i in sync_client.get("/markdown/sync/changes", headers=ADMIN).json()["items"]) == ["a", "b", "c", "root"], \
        "the delta store holds the copy made at the first sync call"


def test_reject_turns_the_old_save_into_a_409_once_the_copy_exists(sync_client, monkeypatch):
    sync_client.put("/markdown/files", json=TREE, headers=ADMIN)
    monkeypatch.setenv("MARKDOWN_LEGACY_PUT", "reject")
    later = {"files": [{"id": "x", "name": "x.md", "type": "file", "content": "must not land"}]}

    before = sync_client.put("/markdown/files", json=TREE, headers=ADMIN)
    assert before.status_code == 200, "nothing has been copied yet: the old save is the only store there is"

    _migrate(sync_client)
    refused = sync_client.put("/markdown/files", json=later, headers=ADMIN)
    assert refused.status_code == 409 and refused.json()["data"]["code"] == "md_legacy_client"
    assert refused.json()["status_code"] == 409 and "dữ liệu trên máy bạn vẫn còn" in refused.json()["message"]
    ids = sorted(i["id"] for i in sync_client.get("/markdown/sync/changes", headers=ADMIN).json()["items"])
    assert "x" not in ids and ids == ["a", "b", "c", "root"], "the delta store was not overwritten by the whole-tree save"


def test_reject_answers_a_guest_with_403_not_with_the_409(sync_client, monkeypatch):
    sync_client.put("/markdown/files", json=TREE, headers=ADMIN)
    _migrate(sync_client)
    monkeypatch.setenv("MARKDOWN_LEGACY_PUT", "reject")
    assert sync_client.put("/markdown/files", json=TREE).status_code == 403, "the version of the store is not told to strangers"


def test_reject_rebuilds_the_old_tree_from_the_delta_store(sync_client, monkeypatch):
    sync_client.put("/markdown/files", json=TREE, headers=ADMIN)
    monkeypatch.setenv("MARKDOWN_LEGACY_PUT", "reject")
    assert sync_client.get("/markdown/files", headers=ADMIN).json() == _normalised(TREE), "not copied yet: the old store answers"

    _migrate(sync_client)
    ops = [
        {"id": "a", "kind": "file", "baseRev": 1, "content": "edited on another device", "hash": _sha("edited on another device"), "updatedAt": 1},
        {"id": "new-1", "kind": "file", "baseRev": 0, "content": "brand new", "hash": _sha("brand new"), "updatedAt": 1, "set": {"name": "new.md", "parentId": "root"}},
        {"id": "c", "kind": "file", "baseRev": 1, "deleted": True, "updatedAt": 1},
    ]
    assert sync_client.post("/markdown/sync/push", json={"device": "md-x", "ops": ops}, headers=ADMIN).status_code == 200

    tree = sync_client.get("/markdown/files", headers=ADMIN).json()["files"]
    assert [node["id"] for node in tree] == ["root"], "root first, and the deleted c is gone"
    assert _outline(tree) == [("root", None, [("a", "edited on another device", []), ("b", "second", []), ("new-1", "brand new", [])])]
    assert tree[0]["type"] == "folder" and tree[0]["children"][2]["name"] == "new.md"
    session = sync_client.post("/markdown/admin/verify", headers=ADMIN).json()["session"]
    assert sync_client.get("/markdown/files", headers={"X-Admin-Session": session}).status_code == 200


def test_an_unrecognised_mode_is_the_default_allow(sync_client, monkeypatch):
    sync_client.put("/markdown/files", json=TREE, headers=ADMIN)
    _migrate(sync_client)
    monkeypatch.setenv("MARKDOWN_LEGACY_PUT", "block")
    assert sync_client.put("/markdown/files", json=TREE, headers=ADMIN).status_code == 200


def test_the_old_store_is_not_touched_by_the_copy(sync_client, tmp_path):
    sync_client.put("/markdown/files", json=TREE, headers=ADMIN)
    path = tmp_path / "markdown-files.json"
    before = path.read_bytes()
    _migrate(sync_client)
    assert path.read_bytes() == before


def _sha(text: str) -> str:
    import hashlib

    return hashlib.sha256(text.encode("utf-8")).hexdigest()
