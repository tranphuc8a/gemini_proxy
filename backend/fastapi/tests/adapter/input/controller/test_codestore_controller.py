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


# ---------------------------------------------------------------------------
# read-only links
# ---------------------------------------------------------------------------
def synced(client, created, *items, backend=None):
    q = f"?backend={backend}" if backend else ""
    res = client.put(f"{BASE}/{created['workspaceId']}/items{q}", json={"items": list(items)}, headers=auth(created))
    assert res.status_code == 200, res.text


def share_url(created, item_id, backend=None):
    return f"{BASE}/{created['workspaceId']}/items/{item_id}/share" + (f"?backend={backend}" if backend else "")


def test_sharing_answers_201_with_the_token_then_200_for_a_refresh_with_the_same_token(client):
    created = create(client)
    synced(client, created, item("a", "one"))
    first = client.post(share_url(created, "a"), headers=auth(created))
    assert first.status_code == 201 and first.headers["cache-control"] == "no-store"
    body = first.json()
    assert set(body) == {"token", "sharedAt", "updatedAt"} and len(body["token"]) == 22
    assert body["sharedAt"] == body["updatedAt"] and body["sharedAt"] > 1_700_000_000_000

    synced(client, created, item("a", "two", updated=now_ms()))
    second = client.post(share_url(created, "a"), headers=auth(created))
    assert second.status_code == 200 and second.json()["token"] == body["token"]
    assert second.json()["sharedAt"] == body["sharedAt"] and second.json()["updatedAt"] >= body["updatedAt"]


def test_the_public_read_needs_no_key_and_shows_the_snapshot_without_private_fields(client):
    created = create(client)
    ws = created["workspaceId"]
    synced(client, created, item("a", "frozen", meta={"stdin": "3\n", "pinned": True, "openTabs": ["a.cpp"], "activeFile": "a.cpp"}))
    token = client.post(share_url(created, "a"), headers=auth(created)).json()["token"]
    synced(client, created, item("a", "edited later", updated=now_ms()))

    res = client.get(f"{BASE}/shared/{token}")                            # no header at all
    assert res.status_code == 200 and res.headers["cache-control"] == "no-store"
    body = res.json()
    assert set(body) == {"item", "sharedAt"}
    assert body["item"] == {"id": "a", "kind": "snippet", "name": "Bài 1", "language": "cpp",
                            "files": [{"path": "main.cpp", "content": "frozen"}], "meta": {"stdin": "3\n"},
                            "updatedAt": body["item"]["updatedAt"]}
    for secret in (ws, created["key"], "serverUpdatedAt", "pinned", "openTabs", "activeFile"):
        assert secret not in res.text


def test_a_link_is_read_in_the_store_it_was_made_in(client):
    created = create(client, "mysql")
    synced(client, created, item("a"), backend="mysql")
    token = client.post(share_url(created, "a", "mysql"), headers=auth(created)).json()["token"]
    assert client.get(f"{BASE}/shared/{token}?backend=mysql").status_code == 200
    for other in ("json", "mongo"):
        assert client.get(f"{BASE}/shared/{token}?backend={other}").status_code == 404
    assert client.get(f"{BASE}/shared/{token}").status_code == 404          # the default store is json


@pytest.mark.parametrize("backend", ["json", "mysql", "mongo"])
def test_the_share_flow_on_every_store_over_http(client, backend):
    created = create(client, backend)
    ws = created["workspaceId"]
    synced(client, created, item("a", "uno"), item("b", "dos"), backend=backend)
    token_a = client.post(share_url(created, "a", backend), headers=auth(created)).json()["token"]
    token_b = client.post(share_url(created, "b", backend), headers=auth(created)).json()["token"]

    listed = client.get(f"{BASE}/{ws}/shares?backend={backend}", headers=auth(created))
    assert listed.status_code == 200 and listed.headers["cache-control"] == "no-store"
    rows = {row["itemId"]: row for row in listed.json()["shares"]}
    assert set(rows) == {"a", "b"} and set(rows["a"]) == {"token", "itemId", "name", "sharedAt", "updatedAt"}
    assert rows["a"]["token"] == token_a and rows["a"]["name"] == "Bài 1"

    assert client.get(f"{BASE}/shared/{token_a}?backend={backend}").json()["item"]["files"][0]["content"] == "uno"
    revoked = client.delete(share_url(created, "a", backend), headers=auth(created))
    assert revoked.status_code == 200 and revoked.json() == {"revoked": True}
    assert client.get(f"{BASE}/shared/{token_a}?backend={backend}").status_code == 404

    # deleting a record revokes its link; so does deleting the workspace
    client.put(f"{BASE}/{ws}/items?backend={backend}", json={"items": [item("b", deleted=True, updated=now_ms())]},
               headers=auth(created))
    assert client.get(f"{BASE}/shared/{token_b}?backend={backend}").status_code == 404
    synced(client, created, item("c"), backend=backend)
    token_c = client.post(share_url(created, "c", backend), headers=auth(created)).json()["token"]
    assert client.delete(f"{BASE}/{ws}?backend={backend}", headers=auth(created)).json() == {"deleted": True}
    assert client.get(f"{BASE}/shared/{token_c}?backend={backend}").status_code == 404


def test_share_errors_use_the_envelope_with_a_code(client):
    created = create(client)
    ws = created["workspaceId"]
    synced(client, created, item("a"))

    no_key = client.post(share_url(created, "a"))
    assert no_key.status_code == 401 and no_key.json()["data"]["code"] == "codestore_key_required"
    wrong = client.post(share_url(created, "a"), headers={"X-Codestore-Key": "nope"})
    assert wrong.status_code == 401 and wrong.json()["data"]["code"] == "codestore_bad_key"
    unknown_ws = client.post(f"{BASE}/cs_nothere/items/a/share", headers=auth(created))
    assert unknown_ws.status_code == 404 and unknown_ws.json()["data"]["code"] == "codestore_not_found"

    unsynced = client.post(share_url(created, "never-synced"), headers=auth(created))
    assert unsynced.status_code == 404 and unsynced.json()["data"] == {"code": "codestore_item_not_found", "itemId": "never-synced"}

    not_shared = client.delete(share_url(created, "a"), headers=auth(created))
    assert not_shared.status_code == 404 and not_shared.json()["data"]["code"] == "codestore_share_not_found"
    assert client.get(f"{BASE}/{ws}/shares").status_code == 401
    assert client.delete(share_url(created, "a")).status_code == 401
    assert client.post(f"{BASE}/{ws}/items/{'x' * 81}/share", headers=auth(created)).status_code == 422
    assert client.post(f"{BASE}/{ws}/items/a b/share", headers=auth(created)).status_code in (404, 422)


def test_bearer_auth_works_for_sharing_too(client):
    created = create(client)
    synced(client, created, item("a"))
    res = client.post(share_url(created, "a"), headers={"Authorization": f"Bearer {created['key']}"})
    assert res.status_code == 201


def test_a_deleted_record_cannot_be_shared_over_http(client):
    created = create(client)
    synced(client, created, item("a", deleted=True, files=[]))
    res = client.post(share_url(created, "a"), headers=auth(created))
    assert res.status_code == 404 and res.json()["data"]["code"] == "codestore_item_not_found"


def test_unknown_malformed_and_revoked_tokens_all_give_the_same_404(client):
    created = create(client)
    synced(client, created, item("a"))
    token = client.post(share_url(created, "a"), headers=auth(created)).json()["token"]
    client.delete(share_url(created, "a"), headers=auth(created))
    answers = [client.get(f"{BASE}/shared/{guess}") for guess in (token, "A" * 22, "short", "x" * 100, "items", "shares", "%2e%2e")]
    assert {answer.status_code for answer in answers} == {404}
    assert {answer.json()["message"] for answer in answers} == {answers[0].json()["message"]}
    assert {answer.json()["data"]["code"] for answer in answers} == {"codestore_share_not_found"}
    assert client.get(f"{BASE}/shared/{'x' * 101}").status_code == 422             # only an absurd length is told apart


def test_the_token_route_does_not_swallow_the_workspace_routes(client):
    """`/shared/{token}` and `/{workspace}/items` have the same shape; each must still reach its own handler."""
    created = create(client)
    synced(client, created, item("a"))
    assert client.get(f"{BASE}/{created['workspaceId']}/items", headers=auth(created)).status_code == 200
    assert client.get(f"{BASE}/shared/items").json()["data"]["code"] == "codestore_share_not_found"
    assert client.get(f"{BASE}/backends").status_code == 200


def test_the_link_limit_per_workspace_is_enforced_over_http(client, monkeypatch):
    monkeypatch.setattr(settings, "CODESTORE_MAX_SHARES", 2)
    codestore_factory.reset_for_tests()
    created = create(client)
    synced(client, created, item("a"), item("b"), item("c"))
    assert client.post(share_url(created, "a"), headers=auth(created)).status_code == 201
    assert client.post(share_url(created, "b"), headers=auth(created)).status_code == 201
    full = client.post(share_url(created, "c"), headers=auth(created))
    assert full.status_code == 400 and full.json()["data"] == {"code": "codestore_too_many_shares", "limit": 2}
    assert client.post(share_url(created, "a"), headers=auth(created)).status_code == 200          # a refresh is not "one more"


def test_public_reads_are_rate_limited_per_address(client, monkeypatch):
    monkeypatch.setattr(settings, "CODESTORE_SHARE_READS_PER_MIN", 3)
    codestore_factory.reset_for_tests()
    created = create(client)
    synced(client, created, item("a"))
    token = client.post(share_url(created, "a"), headers=auth(created)).json()["token"]
    codes = [client.get(f"{BASE}/shared/{token}").status_code for _ in range(5)]
    assert codes == [200, 200, 200, 429, 429]
    limited = client.get(f"{BASE}/shared/{token}")
    assert limited.json()["data"]["code"] == "codestore_rate_limited" and int(limited.headers["retry-after"]) >= 1
    assert client.get(f"{BASE}/shared/{token}", headers={"X-Real-IP": "198.51.100.77"}).status_code == 200


def test_guessing_tokens_gets_an_address_blocked(client):
    created = create(client)
    synced(client, created, item("a"))
    token = client.post(share_url(created, "a"), headers=auth(created)).json()["token"]
    codes = [client.get(f"{BASE}/shared/guess{n:018d}").status_code for n in range(22)]
    assert codes[:20] == [404] * 20 and codes[20:] == [429, 429]
    assert client.get(f"{BASE}/shared/{token}").status_code == 429                      # the right one waits as well
    assert client.get(f"{BASE}/shared/{token}", headers={"X-Real-IP": "198.51.100.78"}).status_code == 200
    assert client.get(f"{BASE}/{created['workspaceId']}/items", headers=auth(created)).status_code == 200


def test_the_json_file_holds_a_snapshot_for_the_link_and_nothing_of_the_key(client, tmp_path):
    created = create(client)
    synced(client, created, item("a", "snapshot body"))
    token = client.post(share_url(created, "a"), headers=auth(created)).json()["token"]
    stored = (tmp_path / "codestore.json").read_text(encoding="utf-8")
    assert token in stored and "snapshot body" in stored and created["key"] not in stored
