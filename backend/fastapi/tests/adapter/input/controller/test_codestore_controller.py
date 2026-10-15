"""`/codestore` over HTTP: the contract the Code Studio web app codes against.

Runs through the real wiring (factory -> use case -> repository): JSON on a temp
file, MySQL on the SQLite engine the suite falls back to, Mongo on
`tests.support.fake_mongo`. Nothing touches a real database.
"""

import os

os.environ.setdefault("TESTING", "1")

import pytest
from fastapi.testclient import TestClient

from src.adapter.factory import codestore_factory
from src.adapter.output.codestore import mongo_repository
from src.application.config.config import settings
from src.main import app
from tests.support import fake_mongo

BASE = f"{settings.API_PREFIX}/codestore"
NOW_MS = 1_800_000_000_000


@pytest.fixture(autouse=True)
def wiring(tmp_path, monkeypatch):
    codestore_factory.reset_for_tests()
    monkeypatch.setattr(settings, "CODESTORE_STORAGE_BACKEND", "json")
    monkeypatch.setattr(settings, "CODESTORE_JSON_FILE", str(tmp_path / "codestore.json"))
    monkeypatch.setattr(settings, "CODESTORE_MAX_ITEMS", 2000)
    monkeypatch.setattr(settings, "CODESTORE_WORKSPACES_PER_HOUR", 50)
    fake_mongo.install(monkeypatch, mongo_repository)

    async def reachable():
        return {"ok": True}

    monkeypatch.setattr(codestore_factory.mongo_store, "ping", reachable)
    app.dependency_overrides.clear()
    yield
    codestore_factory.reset_for_tests()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def now_ms():
    import time

    return int(time.time() * 1000)


def item(item_id="i1", content="int main(){}", updated=None, **overrides):
    values = {"id": item_id, "kind": "snippet", "name": "Bài 1", "language": "cpp",
              "files": [{"path": "main.cpp", "content": content}], "meta": {"tag": "ôn thi"},
              "updatedAt": updated if updated is not None else now_ms() - 1000, "deleted": False}
    values.update(overrides)
    return values


def create(client, backend=None):
    res = client.post(f"{BASE}/workspaces" + (f"?backend={backend}" if backend else ""))
    assert res.status_code == 201, res.text
    return res.json()


def auth(created):
    return {"X-Codestore-Key": created["key"]}


# ---------------------------------------------------------------------------
# backends
# ---------------------------------------------------------------------------
def test_backends_lists_the_three_stores_and_the_default(client):
    res = client.get(f"{BASE}/backends")
    assert res.status_code == 200 and res.headers["cache-control"] == "no-store"
    body = res.json()
    assert set(body) == {"default", "backends"} and body["default"] == "json"
    assert [row["id"] for row in body["backends"]] == ["json", "mysql", "mongo"]
    assert all(set(row) >= {"id", "label", "available", "reason", "persistent"} for row in body["backends"])
    by_id = {row["id"]: row for row in body["backends"]}
    assert by_id["json"]["available"] is True and by_id["mysql"]["available"] is True        # SQLite stands in
    assert by_id["mongo"]["available"] is True                                               # the fake is "configured"


def test_backends_reports_an_unconfigured_mongo_without_naming_anything(client, monkeypatch):
    monkeypatch.setattr(codestore_factory.mongo_store, "is_configured", lambda: False)
    row = next(r for r in client.get(f"{BASE}/backends").json()["backends"] if r["id"] == "mongo")
    assert row["available"] is False and row["reason"]


def test_backends_never_reveals_host_database_or_driver_messages(client, monkeypatch):
    monkeypatch.setattr(settings, "DB_HOST", "secret-db-host.example")
    monkeypatch.setattr(settings, "DB_DATABASE", "secret_database_name")
    monkeypatch.setattr(settings, "MONGO_URI", "mongodb://user:hunter2@secret-mongo.example/db")

    async def broken_ping():
        raise RuntimeError("getaddrinfo failed for secret-mongo.example (user hunter2)")

    monkeypatch.setattr(codestore_factory.mongo_store, "ping", broken_ping)

    async def broken_session():
        raise RuntimeError("Can't connect to MySQL server on 'secret-db-host.example'")

    class BrokenSession:
        async def execute(self, *_a, **_k):
            await broken_session()

        async def close(self):
            return None

    monkeypatch.setattr(codestore_factory, "get_async_session", lambda: BrokenSession())
    res = client.get(f"{BASE}/backends")
    rows = {row["id"]: row for row in res.json()["backends"]}
    assert rows["mysql"]["available"] is False and rows["mongo"]["available"] is False
    for secret in ("secret-db-host", "secret_database_name", "secret-mongo", "hunter2", "getaddrinfo"):
        assert secret not in res.text


def test_a_json_store_in_a_temp_directory_is_flagged_as_not_persistent(client, monkeypatch, tmp_path):
    import tempfile
    from pathlib import Path

    monkeypatch.setattr(codestore_factory, "data_root", lambda: Path(tempfile.gettempdir()) / "gemini-proxy-data")
    row = next(r for r in client.get(f"{BASE}/backends").json()["backends"] if r["id"] == "json")
    assert row["available"] is True and row["persistent"] is False and "MySQL" in row["reason"]


# ---------------------------------------------------------------------------
# workspaces
# ---------------------------------------------------------------------------
def test_create_returns_bare_json_with_the_key_and_never_shows_it_again(client):
    res = client.post(f"{BASE}/workspaces")
    assert res.status_code == 201 and res.headers["cache-control"] == "no-store"
    created = res.json()
    assert set(created) == {"workspaceId", "key"} and created["workspaceId"].startswith("cs_")
    assert len(created["key"]) >= 32

    for response in (client.get(f"{BASE}/{created['workspaceId']}/items", headers=auth(created)),
                     client.put(f"{BASE}/{created['workspaceId']}/items", json={"items": [item()]}, headers=auth(created)),
                     client.get(f"{BASE}/backends")):
        assert created["key"] not in response.text


def test_the_full_flow_create_put_get_conflict_delete(client):
    created = create(client)
    ws = created["workspaceId"]

    pushed = client.put(f"{BASE}/{ws}/items", json={"items": [item("a", "v1"), item("b", "x")]}, headers=auth(created))
    assert pushed.status_code == 200 and pushed.headers["cache-control"] == "no-store"
    body = pushed.json()
    assert set(body) == {"items", "serverTime"} and [i["id"] for i in body["items"]] == ["a", "b"]
    assert set(body["items"][0]) >= {"id", "kind", "name", "language", "files", "meta", "updatedAt", "deleted",
                                     "serverUpdatedAt"}

    listed = client.get(f"{BASE}/{ws}/items", headers=auth(created)).json()
    assert set(listed) == {"items", "serverTime", "more"} and len(listed["items"]) == 2 and listed["more"] is False

    # a stale edit of "a" from another device loses, and the answer says what the server holds
    stale = client.put(f"{BASE}/{ws}/items", json={"items": [item("a", "stale", updated=1)]}, headers=auth(created))
    assert stale.json()["items"][0]["files"][0]["content"] == "v1"

    # a deletion becomes a tombstone that other devices can fetch
    gone = client.put(f"{BASE}/{ws}/items", json={"items": [item("b", deleted=True, updated=now_ms())]},
                      headers=auth(created))
    assert gone.json()["items"][0]["deleted"] is True and gone.json()["items"][0]["files"] == []
    after = client.get(f"{BASE}/{ws}/items?since=0", headers=auth(created)).json()["items"]
    assert {i["id"]: i["deleted"] for i in after} == {"a": False, "b": True}

    assert client.delete(f"{BASE}/{ws}", headers=auth(created)).json() == {"deleted": True}
    assert client.get(f"{BASE}/{ws}/items", headers=auth(created)).status_code == 404


def test_the_since_cursor_hands_over_only_what_is_new(client):
    created = create(client)
    ws = created["workspaceId"]
    client.put(f"{BASE}/{ws}/items", json={"items": [item("old")]}, headers=auth(created))
    first = client.get(f"{BASE}/{ws}/items", headers=auth(created)).json()
    assert [i["id"] for i in first["items"]] == ["old"]
    # Nothing new: the cursor the server gave returns nothing once the lag has passed.
    quiet = client.get(f"{BASE}/{ws}/items?since={first['items'][0]['serverUpdatedAt']}", headers=auth(created)).json()
    assert quiet["items"] == [] and quiet["serverTime"] >= first["items"][0]["serverUpdatedAt"]


def test_limit_pages_the_answer_and_more_says_so(client):
    created = create(client)
    ws = created["workspaceId"]
    client.put(f"{BASE}/{ws}/items", json={"items": [item(f"r{n}") for n in range(5)]}, headers=auth(created))
    page = client.get(f"{BASE}/{ws}/items?limit=2", headers=auth(created)).json()
    assert len(page["items"]) == 2 and page["more"] is True
    rest = client.get(f"{BASE}/{ws}/items?since={page['serverTime']}&limit=10", headers=auth(created)).json()
    assert [i["id"] for i in page["items"] + rest["items"]] == [f"r{n}" for n in range(5)] and rest["more"] is False


# ---------------------------------------------------------------------------
# access and errors
# ---------------------------------------------------------------------------
def test_errors_use_the_envelope_with_a_code(client):
    created = create(client)
    ws = created["workspaceId"]
    missing = client.get(f"{BASE}/{ws}/items")
    assert missing.status_code == 401 and missing.json()["data"]["code"] == "codestore_key_required"
    assert missing.json()["status_code"] == 401 and "X-Codestore-Key" in missing.json()["message"]

    wrong = client.get(f"{BASE}/{ws}/items", headers={"X-Codestore-Key": "nope"})
    assert wrong.status_code == 401 and wrong.json()["data"]["code"] == "codestore_bad_key"

    unknown = client.get(f"{BASE}/cs_doesnotexist/items", headers=auth(created))
    assert unknown.status_code == 404 and unknown.json()["data"]["code"] == "codestore_not_found"


def test_a_bearer_header_works_as_a_fallback(client):
    created = create(client)
    ws = created["workspaceId"]
    res = client.get(f"{BASE}/{ws}/items", headers={"Authorization": f"Bearer {created['key']}"})
    assert res.status_code == 200


def test_delete_needs_the_key(client):
    created = create(client)
    ws = created["workspaceId"]
    assert client.delete(f"{BASE}/{ws}").status_code == 401
    assert client.delete(f"{BASE}/{ws}", headers={"X-Codestore-Key": "x"}).status_code == 401
    assert client.delete(f"{BASE}/{ws}", headers=auth(created)).status_code == 200


def test_a_workspace_id_that_is_not_an_id_is_a_422(client):
    created = create(client)
    for bad in ("a b", "x" * 65, "..%2f", "cs_x;y"):
        assert client.get(f"{BASE}/{bad}/items", headers=auth(created)).status_code in (404, 422)
    assert client.get(f"{BASE}/{'x' * 65}/items", headers=auth(created)).status_code == 422


def test_validation_errors_are_400_with_the_offending_item_and_422_for_schema_violations(client):
    created = create(client)
    ws = created["workspaceId"]
    url = f"{BASE}/{ws}/items"
    climbing = client.put(url, json={"items": [item("p", kind="project", files=[
        {"path": "../../etc/passwd", "content": "x"}])]}, headers=auth(created))
    assert climbing.status_code == 400
    assert climbing.json()["data"] == {"code": "codestore_bad_item", "itemId": "p"}

    clock = client.put(url, json={"items": [item("c", updated=now_ms() + 3 * 24 * 3600 * 1000)]}, headers=auth(created))
    assert clock.status_code == 400 and clock.json()["data"]["code"] == "codestore_bad_clock"

    for bad in ({"items": [item("x" * 81)]}, {"items": [item(kind="folder")]}, {"items": [item()] * 101},
                {"items": [item("a", content="z" * 524_289)]}, {"items": "no"}, {}):
        status = client.put(url, json=bad, headers=auth(created)).status_code
        assert status == 422 or (bad == {} and status == 200), (bad if len(str(bad)) < 200 else "big", status)
    assert client.get(url, headers=auth(created)).json()["items"] == []        # nothing leaked in


def test_the_quota_of_records_is_enforced_over_http(client, monkeypatch):
    monkeypatch.setattr(settings, "CODESTORE_MAX_ITEMS", 2)
    codestore_factory.reset_for_tests()
    created = create(client)
    ws = created["workspaceId"]
    assert client.put(f"{BASE}/{ws}/items", json={"items": [item("a"), item("b")]}, headers=auth(created)).status_code == 200
    full = client.put(f"{BASE}/{ws}/items", json={"items": [item("c")]}, headers=auth(created))
    assert full.status_code == 400 and full.json()["data"]["code"] == "codestore_workspace_full"


def test_creating_workspaces_is_rate_limited_per_address(client, monkeypatch):
    monkeypatch.setattr(settings, "CODESTORE_WORKSPACES_PER_HOUR", 2)
    codestore_factory.reset_for_tests()
    create(client)
    create(client)
    third = client.post(f"{BASE}/workspaces")
    assert third.status_code == 429 and third.json()["data"]["code"] == "codestore_rate_limited"
    assert int(third.headers["retry-after"]) >= 1


def test_wrong_keys_are_counted_and_then_blocked(client):
    created = create(client)
    ws = created["workspaceId"]
    codes = [client.get(f"{BASE}/{ws}/items", headers={"X-Codestore-Key": f"guess{n}"}).status_code for n in range(22)]
    assert codes[:20] == [401] * 20 and codes[20:] == [429, 429]


# ---------------------------------------------------------------------------
# ?backend=
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("backend", ["json", "mysql", "mongo"])
def test_each_backend_serves_the_whole_flow_and_keeps_workspaces_apart(client, backend):
    created = create(client, backend)
    ws = created["workspaceId"]
    q = f"?backend={backend}"
    put = client.put(f"{BASE}/{ws}/items{q}", json={"items": [item("a", "hello 🍜"), item("p", kind="project", files=[
        {"path": "src/main.py", "content": "1"}, {"path": "README.md", "content": "2"}])]}, headers=auth(created))
    assert put.status_code == 200, put.text
    listed = client.get(f"{BASE}/{ws}/items{q}", headers=auth(created)).json()
    assert sorted(i["id"] for i in listed["items"]) == ["a", "p"]
    assert next(i for i in listed["items"] if i["id"] == "a")["files"][0]["content"] == "hello 🍜"

    # the workspace exists only in the store it was created in
    for other in {"json", "mysql", "mongo"} - {backend}:
        assert client.get(f"{BASE}/{ws}/items?backend={other}", headers=auth(created)).status_code == 404

    assert client.delete(f"{BASE}/{ws}{q}", headers=auth(created)).json() == {"deleted": True}
    assert client.get(f"{BASE}/{ws}/items{q}", headers=auth(created)).status_code == 404


def test_the_default_backend_comes_from_the_settings(client, monkeypatch):
    monkeypatch.setattr(settings, "CODESTORE_STORAGE_BACKEND", "mongo")
    codestore_factory.reset_for_tests()
    created = create(client)
    assert client.get(f"{BASE}/backends").json()["default"] == "mongo"
    assert client.get(f"{BASE}/{created['workspaceId']}/items?backend=mongo", headers=auth(created)).status_code == 200
    assert client.get(f"{BASE}/{created['workspaceId']}/items?backend=json", headers=auth(created)).status_code == 404


def test_an_unknown_backend_is_a_400_and_an_unconfigured_mongo_a_503(client, monkeypatch):
    bad = client.post(f"{BASE}/workspaces?backend=oracle")
    assert bad.status_code == 400 and bad.json()["data"]["code"] == "codestore_bad_backend"
    assert client.post(f"{BASE}/workspaces?backend=" + "x" * 17).status_code == 422

    monkeypatch.setattr(codestore_factory.mongo_store, "is_configured", lambda: False)
    unavailable = client.post(f"{BASE}/workspaces?backend=mongo")
    assert unavailable.status_code == 503 and unavailable.json()["data"]["code"] == "codestore_backend_unavailable"


def test_the_json_file_holds_only_the_key_digest(client, tmp_path):
    created = create(client)
    stored = (tmp_path / "codestore.json").read_text(encoding="utf-8")
    assert created["key"] not in stored and created["workspaceId"] in stored
