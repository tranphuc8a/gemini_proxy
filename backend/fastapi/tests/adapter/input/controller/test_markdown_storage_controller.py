"""The admin session and the three storage backends of the markdown editor.

The behaviour under test is the bug report "mỗi khi reload lại phải nhập admin
token": the key used to live in one JavaScript variable and nothing else, so a
reload signed the user out. The fix is an exchange -- key in, signed token out --
so the browser can keep *something* without keeping the key.
"""

import json
import time

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.adapter.input.controllers import markdown_storage_controller as controller
from src.application.utils import admin_session
from tests.support import fake_mongo

ADMIN_KEY = "test-admin-key"


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("MARKDOWN_ADMIN_KEY", ADMIN_KEY)
    monkeypatch.setenv("MARKDOWN_JSON_FILE", str(tmp_path / "markdown-files.json"))
    app = FastAPI()
    app.include_router(controller.router)
    return TestClient(app)


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
    response = client.get("/markdown/files?backend=mongo")
    assert response.status_code == 503


def test_unknown_backend_is_a_client_error(client):
    assert client.get("/markdown/files?backend=postgres").status_code == 400


def test_json_round_trip(client):
    client.put("/markdown/files", json=TREE, headers={"X-Admin-Key": ADMIN_KEY})
    assert client.get("/markdown/files").json() == _normalised(TREE)


def test_mongo_round_trip_preserves_the_tree(client, monkeypatch):
    """Flat documents in, the same nesting and sibling order back out."""
    fake_mongo.install(monkeypatch, controller)

    saved = client.put("/markdown/files?backend=mongo", json=TREE, headers={"X-Admin-Key": ADMIN_KEY})
    assert saved.status_code == 200
    # Shape, not representation: a database backend rebuilds every node with an
    # explicit (possibly empty) child list, which the JSON one leaves unset.
    assert _outline(client.get("/markdown/files?backend=mongo").json()["files"]) == _outline(TREE["files"])


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
    assert client.get("/markdown/files?backend=json").json() == _normalised(TREE)


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
