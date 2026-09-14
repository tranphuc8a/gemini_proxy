"""The graphuc document store across all three backends.

The same suite runs against json, mysql (on the suite's SQLite fallback) and
mongo (on `tests.support.fake_mongo`), because a client that switches backend
must not have to care which one it got.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.adapter.input.controllers import graph_storage_controller as controller
from tests.support import fake_mongo

ADMIN_KEY = "graph-test-key"

DOCUMENT = {
    "nodes": [
        {"id": "a", "label": "Bắt đầu", "x": 0, "y": 0},
        {"id": "b", "label": "Kết thúc", "x": 120, "y": 40},
    ],
    "edges": [{"id": "e1", "source": "a", "target": "b", "weight": 3}],
}


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("GRAPHUC_ADMIN_KEY", ADMIN_KEY)
    monkeypatch.setenv("GRAPHUC_JSON_FILE", str(tmp_path / "graphs.json"))
    fake_mongo.install(monkeypatch, controller)
    app = FastAPI()
    app.include_router(controller.router)
    return TestClient(app)


def auth():
    return {"X-Admin-Key": ADMIN_KEY}


BACKENDS = ["json", "mysql", "mongo"]


def url(path: str, backend: str) -> str:
    return f"{path}?backend={backend}"


# ------------------------------------------------------------------ auth

def test_saving_needs_the_admin_key(client):
    assert client.put("/graphs/g1", json={"title": "x", "document": {}}).status_code == 403


def test_reading_does_not_need_the_admin_key(client):
    """A saved graph is usually saved in order to be shown to somebody."""
    client.put("/graphs/g1", json={"title": "x", "document": DOCUMENT}, headers=auth())
    assert client.get("/graphs/g1").status_code == 200


def test_session_token_replaces_the_key(client):
    token = client.post("/graphs/_admin/verify", headers=auth()).json()["session"]
    assert client.put(
        "/graphs/g1", json={"title": "x", "document": DOCUMENT}, headers={"X-Admin-Session": token}
    ).status_code == 200


def test_a_graphuc_token_does_not_unlock_the_markdown_editor(client, monkeypatch):
    """Both apps sign with their own salt, so a token cannot cross between them
    even when the two happen to share an admin key."""
    from src.adapter.input.controllers import markdown_storage_controller
    from src.application.utils import admin_session

    token = client.post("/graphs/_admin/verify", headers=auth()).json()["session"]
    with pytest.raises(admin_session.SessionError):
        admin_session.verify(token, ADMIN_KEY, salt=markdown_storage_controller.SESSION_SALT)


# -------------------------------------------------------------- backends

@pytest.mark.parametrize("backend", BACKENDS)
def test_round_trip(client, backend):
    saved = client.put(
        url("/graphs/round-trip", backend),
        json={"title": "Đồ thị", "kind": "digraph", "document": DOCUMENT},
        headers=auth(),
    )
    assert saved.status_code == 200, saved.text
    body = saved.json()
    assert body["nodes"] == 2 and body["edges"] == 1
    assert body["revision"] == 1

    loaded = client.get(url("/graphs/round-trip", backend)).json()
    assert loaded["document"] == DOCUMENT
    assert loaded["title"] == "Đồ thị"
    assert loaded["kind"] == "digraph"


@pytest.mark.parametrize("backend", BACKENDS)
def test_resaving_bumps_the_revision_and_keeps_created_at(client, backend):
    first = client.put(url("/graphs/rev", backend), json={"title": "v1", "document": DOCUMENT}, headers=auth()).json()
    second = client.put(url("/graphs/rev", backend), json={"title": "v2", "document": DOCUMENT}, headers=auth()).json()
    assert second["revision"] == first["revision"] + 1
    assert second["created_at"] == first["created_at"]
    assert second["title"] == "v2"


@pytest.mark.parametrize("backend", BACKENDS)
def test_listing_omits_the_drawing(client, backend):
    """The list is for a picker; sending every drawing would make it useless on
    a slow connection exactly when there are most graphs to choose from."""
    client.put(url("/graphs/listed", backend), json={"title": "Đã lưu", "document": DOCUMENT}, headers=auth())
    listed = client.get(url("/graphs", backend)).json()
    entry = next(item for item in listed if item["id"] == "listed")
    assert entry["nodes"] == 2
    assert "document" not in entry


@pytest.mark.parametrize("backend", BACKENDS)
def test_delete(client, backend):
    client.put(url("/graphs/gone", backend), json={"title": "x", "document": DOCUMENT}, headers=auth())
    assert client.delete(url("/graphs/gone", backend), headers=auth()).json() == {"deleted": True}
    assert client.get(url("/graphs/gone", backend)).status_code == 404
    assert client.delete(url("/graphs/gone", backend), headers=auth()).json() == {"deleted": False}


@pytest.mark.parametrize("backend", BACKENDS)
def test_missing_graph_is_404(client, backend):
    assert client.get(url("/graphs/never-saved", backend)).status_code == 404


def test_backends_are_separate_stores(client):
    client.put(url("/graphs/split", "json"), json={"title": "từ json", "document": DOCUMENT}, headers=auth())
    client.put(url("/graphs/split", "mongo"), json={"title": "từ mongo", "document": DOCUMENT}, headers=auth())
    assert client.get(url("/graphs/split", "json")).json()["title"] == "từ json"
    assert client.get(url("/graphs/split", "mongo")).json()["title"] == "từ mongo"


def test_mongo_is_reported_unavailable_without_a_uri(client, monkeypatch):
    monkeypatch.setattr(controller.mongo_store, "is_configured", lambda: False)
    listed = {item["id"]: item for item in client.get("/graphs/_backends").json()}
    assert listed["mongo"]["available"] is False
    assert client.get("/graphs?backend=mongo").status_code == 503


def test_unknown_backend_is_a_client_error(client):
    assert client.get("/graphs?backend=postgres").status_code == 400


# ------------------------------------------------------------- validation

def test_an_oversized_document_is_refused(client):
    huge = {"nodes": [{"id": str(i), "note": "x" * 1000} for i in range(6000)], "edges": []}
    assert client.put("/graphs/huge", json={"title": "x", "document": huge}, headers=auth()).status_code == 413


def test_a_malformed_id_is_refused(client):
    """Ids reach the filesystem-backed store as dictionary keys and the SQL one
    as bound parameters, but a path-shaped id is confusing everywhere."""
    assert client.put("/graphs/..", json={"title": "x", "document": {}}, headers=auth()).status_code in (400, 404)
    assert client.put("/graphs/a b", json={"title": "x", "document": {}}, headers=auth()).status_code == 400


def test_counts_survive_a_document_without_nodes(client):
    saved = client.put("/graphs/empty", json={"title": "x", "document": {"meta": {}}}, headers=auth()).json()
    assert saved["nodes"] == 0 and saved["edges"] == 0


def test_the_corrupt_json_store_reads_as_empty(client, tmp_path, monkeypatch):
    """A half-written file must not take the router down."""
    path = controller._json_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("{not json", encoding="utf-8")
    assert client.get("/graphs").json() == []
