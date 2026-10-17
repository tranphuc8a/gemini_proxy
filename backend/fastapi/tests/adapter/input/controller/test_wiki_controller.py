"""`/wiki` over HTTP: the contract the Personal Wiki web app codes against.

Runs through the real wiring (factory -> use case -> repository): JSON on a temp
file, MySQL on the SQLite engine the suite falls back to, Mongo on
`tests.support.fake_mongo`. Nothing touches a real database.
"""

import os

os.environ.setdefault("TESTING", "1")

import pytest
from fastapi.testclient import TestClient

from src.adapter.factory import wiki_factory
from src.adapter.output.wiki import mongo_repository
from src.application.config.config import settings
from src.main import app
from tests.support import fake_mongo

BASE = f"{settings.API_PREFIX}/wiki"


@pytest.fixture(autouse=True)
def wiring(tmp_path, monkeypatch):
    wiki_factory.reset_for_tests()
    monkeypatch.setattr(settings, "WIKI_STORAGE_BACKEND", "json")
    monkeypatch.setattr(settings, "WIKI_JSON_FILE", str(tmp_path / "wiki.json"))
    monkeypatch.setattr(settings, "WIKI_MAX_ITEMS", 300_000)
    monkeypatch.setattr(settings, "WIKI_WORKSPACES_PER_HOUR", 50)
    fake_mongo.install(monkeypatch, mongo_repository)

    async def reachable():
        return {"ok": True}

    monkeypatch.setattr(wiki_factory.mongo_store, "ping", reachable)
    app.dependency_overrides.clear()
    yield
    wiki_factory.reset_for_tests()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def now_ms():
    import time

    return int(time.time() * 1000)


def note(item_id="n1", body="xin chào", updated=None, **overrides):
    values = {"id": item_id, "kind": "note", "updatedAt": updated if updated is not None else now_ms() - 1000,
              "deleted": False, "data": {"title": "Bài 1", "body": body, "tags": ["ôn thi"]}}
    values.update(overrides)
    return values


def create(client, backend=None):
    res = client.post(f"{BASE}/workspaces" + (f"?backend={backend}" if backend else ""))
    assert res.status_code == 201, res.text
    return res.json()


def auth(created):
    return {"X-Wiki-Key": created["key"]}


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
    monkeypatch.setattr(wiki_factory.mongo_store, "is_configured", lambda: False)
    row = next(r for r in client.get(f"{BASE}/backends").json()["backends"] if r["id"] == "mongo")
    assert row["available"] is False and row["reason"]


def test_backends_never_reveals_host_database_or_driver_messages(client, monkeypatch):
    monkeypatch.setattr(settings, "DB_HOST", "secret-db-host.example")
    monkeypatch.setattr(settings, "DB_DATABASE", "secret_database_name")
    monkeypatch.setattr(settings, "MONGO_URI", "mongodb://user:hunter2@secret-mongo.example/db")

    async def broken_ping():
        raise RuntimeError("getaddrinfo failed for secret-mongo.example (user hunter2)")

    monkeypatch.setattr(wiki_factory.mongo_store, "ping", broken_ping)

    class BrokenSession:
        async def execute(self, *_a, **_k):
            raise RuntimeError("Can't connect to MySQL server on 'secret-db-host.example'")

        async def close(self):
            return None

    monkeypatch.setattr(wiki_factory, "get_async_session", lambda: BrokenSession())
    res = client.get(f"{BASE}/backends")
    rows = {row["id"]: row for row in res.json()["backends"]}
    assert rows["mysql"]["available"] is False and rows["mongo"]["available"] is False
    for secret in ("secret-db-host", "secret_database_name", "secret-mongo", "hunter2", "getaddrinfo"):
        assert secret not in res.text


def test_a_json_store_in_a_temp_directory_is_flagged_as_not_persistent(client, monkeypatch):
    import tempfile
    from pathlib import Path

    monkeypatch.setattr(wiki_factory, "data_root", lambda: Path(tempfile.gettempdir()) / "gemini-proxy-data")
    row = next(r for r in client.get(f"{BASE}/backends").json()["backends"] if r["id"] == "json")
    assert row["available"] is True and row["persistent"] is False and "MySQL" in row["reason"]


# ---------------------------------------------------------------------------
# workspaces
# ---------------------------------------------------------------------------
def test_create_returns_bare_json_with_the_key_and_never_shows_it_again(client):
    res = client.post(f"{BASE}/workspaces")
    assert res.status_code == 201 and res.headers["cache-control"] == "no-store"
    created = res.json()
    assert set(created) == {"workspaceId", "key"} and created["workspaceId"].startswith("wk_")
    assert len(created["key"]) >= 32

    for response in (client.get(f"{BASE}/{created['workspaceId']}/items", headers=auth(created)),
                     client.put(f"{BASE}/{created['workspaceId']}/items", json={"items": [note()]}, headers=auth(created)),
                     client.get(f"{BASE}/backends")):
        assert created["key"] not in response.text


def test_the_full_flow_create_put_get_conflict_delete(client):
    created = create(client)
    ws = created["workspaceId"]

    pushed = client.put(f"{BASE}/{ws}/items", json={"items": [note("a", "v1"), note("b", "x", kind="card")]},
                        headers=auth(created))
    assert pushed.status_code == 200 and pushed.headers["cache-control"] == "no-store"
    body = pushed.json()
    assert set(body) == {"items", "serverTime"} and [i["id"] for i in body["items"]] == ["a", "b"]
    assert set(body["items"][0]) == {"id", "kind", "updatedAt", "deleted", "data", "serverUpdatedAt"}
    assert body["items"][1]["kind"] == "card" and body["items"][0]["data"]["tags"] == ["ôn thi"]
    assert isinstance(body["serverTime"], int) and body["items"][1]["serverUpdatedAt"] == body["items"][0]["serverUpdatedAt"] + 1

    listed = client.get(f"{BASE}/{ws}/items", headers=auth(created))
    assert listed.status_code == 200 and listed.headers["cache-control"] == "no-store"
    assert set(listed.json()) == {"items", "serverTime", "more"}
    assert len(listed.json()["items"]) == 2 and listed.json()["more"] is False

    # a stale edit of "a" from another device loses, and the answer says what the server holds
    stale = client.put(f"{BASE}/{ws}/items", json={"items": [note("a", "stale", updated=1)]}, headers=auth(created))
    assert stale.json()["items"][0]["data"]["body"] == "v1"

    # a deletion becomes a tombstone that other devices can fetch, and it drops the data
    gone = client.put(f"{BASE}/{ws}/items", json={"items": [note("b", deleted=True, updated=now_ms())]},
                      headers=auth(created))
    assert gone.json()["items"][0]["deleted"] is True and gone.json()["items"][0]["data"] == {}
    after = client.get(f"{BASE}/{ws}/items?since=0", headers=auth(created)).json()["items"]
    assert {i["id"]: i["deleted"] for i in after} == {"a": False, "b": True}

    deleted = client.delete(f"{BASE}/{ws}", headers=auth(created))
    assert deleted.json() == {"deleted": True} and deleted.headers["cache-control"] == "no-store"
    assert client.get(f"{BASE}/{ws}/items", headers=auth(created)).status_code == 404


def test_the_since_cursor_hands_over_only_what_is_new(client):
    created = create(client)
    ws = created["workspaceId"]
    client.put(f"{BASE}/{ws}/items", json={"items": [note("old")]}, headers=auth(created))
    first = client.get(f"{BASE}/{ws}/items", headers=auth(created)).json()
    assert [i["id"] for i in first["items"]] == ["old"]
    # Nothing new: the cursor the server gave returns nothing once the lag has passed.
    quiet = client.get(f"{BASE}/{ws}/items?since={first['items'][0]['serverUpdatedAt']}", headers=auth(created)).json()
    assert quiet["items"] == [] and quiet["serverTime"] >= first["items"][0]["serverUpdatedAt"]


def test_limit_pages_the_answer_and_more_says_so(client):
    created = create(client)
    ws = created["workspaceId"]
    client.put(f"{BASE}/{ws}/items", json={"items": [note(f"r{n}") for n in range(5)]}, headers=auth(created))
    page = client.get(f"{BASE}/{ws}/items?limit=2", headers=auth(created)).json()
    assert len(page["items"]) == 2 and page["more"] is True
    rest = client.get(f"{BASE}/{ws}/items?since={page['serverTime']}&limit=10", headers=auth(created)).json()
    assert [i["id"] for i in page["items"] + rest["items"]] == [f"r{n}" for n in range(5)] and rest["more"] is False


def test_since_and_limit_are_validated(client):
    created = create(client)
    url = f"{BASE}/{created['workspaceId']}/items"
    for query in ("since=-1", "since=abc", "since=4102444800001", "limit=0", "limit=501", "limit=x"):
        assert client.get(f"{url}?{query}", headers=auth(created)).status_code == 422, query
    assert client.get(f"{url}?since=0&limit=500", headers=auth(created)).status_code == 200


# ---------------------------------------------------------------------------
# access and errors
# ---------------------------------------------------------------------------
def test_errors_use_the_envelope_with_a_code(client):
    created = create(client)
    ws = created["workspaceId"]
    missing = client.get(f"{BASE}/{ws}/items")
    assert missing.status_code == 401 and missing.json()["data"]["code"] == "wiki_key_required"
    assert missing.json()["status_code"] == 401 and "X-Wiki-Key" in missing.json()["message"]

    wrong = client.get(f"{BASE}/{ws}/items", headers={"X-Wiki-Key": "nope"})
    assert wrong.status_code == 401 and wrong.json()["data"]["code"] == "wiki_bad_key"

    unknown = client.get(f"{BASE}/wk_doesnotexist/items", headers=auth(created))
    assert unknown.status_code == 404 and unknown.json()["data"]["code"] == "wiki_not_found"


def test_a_bearer_header_works_as_a_fallback(client):
    created = create(client)
    ws = created["workspaceId"]
    res = client.get(f"{BASE}/{ws}/items", headers={"Authorization": f"Bearer {created['key']}"})
    assert res.status_code == 200
    put = client.put(f"{BASE}/{ws}/items", json={"items": [note("viaBearer")]},
                     headers={"Authorization": f"bearer {created['key']}"})
    assert put.status_code == 200 and put.json()["items"][0]["id"] == "viaBearer"
    # the dedicated header wins when both are sent; a bearer of something else is a wrong key
    both = client.get(f"{BASE}/{ws}/items", headers={"X-Wiki-Key": created["key"], "Authorization": "Bearer nope"})
    assert both.status_code == 200
    other = client.get(f"{BASE}/{ws}/items", headers={"Authorization": "Bearer nope"})
    assert other.status_code == 401 and other.json()["data"]["code"] == "wiki_bad_key"
    basic = client.get(f"{BASE}/{ws}/items", headers={"Authorization": f"Basic {created['key']}"})
    assert basic.status_code == 401 and basic.json()["data"]["code"] == "wiki_key_required"


def test_the_key_header_is_trimmed_and_the_codestore_header_is_not_accepted(client):
    created = create(client)
    ws = created["workspaceId"]
    assert client.get(f"{BASE}/{ws}/items", headers={"X-Wiki-Key": f"  {created['key']}  "}).status_code == 200
    foreign = client.get(f"{BASE}/{ws}/items", headers={"X-Codestore-Key": created["key"]})
    assert foreign.status_code == 401 and foreign.json()["data"]["code"] == "wiki_key_required"


def test_delete_needs_the_key(client):
    created = create(client)
    ws = created["workspaceId"]
    assert client.delete(f"{BASE}/{ws}").status_code == 401
    assert client.delete(f"{BASE}/{ws}", headers={"X-Wiki-Key": "x"}).status_code == 401
    assert client.delete(f"{BASE}/{ws}", headers=auth(created)).status_code == 200
    assert client.delete(f"{BASE}/{ws}", headers=auth(created)).status_code == 404       # gone: unknown before key


def test_a_key_of_one_workspace_does_not_open_another(client):
    a, b = create(client), create(client)
    client.put(f"{BASE}/{a['workspaceId']}/items", json={"items": [note("secret")]}, headers=auth(a))
    cross = client.get(f"{BASE}/{a['workspaceId']}/items", headers=auth(b))
    assert cross.status_code == 401 and "secret" not in cross.text
    assert client.get(f"{BASE}/{b['workspaceId']}/items", headers=auth(b)).json()["items"] == []


def test_a_workspace_id_that_is_not_an_id_is_a_422(client):
    created = create(client)
    for bad in ("a b", "x" * 65, "..%2f", "wk_x;y"):
        assert client.get(f"{BASE}/{bad}/items", headers=auth(created)).status_code in (404, 422)
    assert client.get(f"{BASE}/{'x' * 65}/items", headers=auth(created)).status_code == 422
    assert client.delete(f"{BASE}/{'x' * 65}", headers=auth(created)).status_code == 422


def test_validation_errors_are_400_with_the_offending_item_and_422_for_schema_violations(client):
    created = create(client)
    ws = created["workspaceId"]
    url = f"{BASE}/{ws}/items"

    clock = client.put(url, json={"items": [note("c", updated=now_ms() + 3 * 24 * 3600 * 1000)]}, headers=auth(created))
    assert clock.status_code == 400 and clock.json()["data"] == {"code": "wiki_bad_clock", "itemId": "c"}

    huge = client.put(url, json={"items": [note("h", body="z" * 1_600_001)]}, headers=auth(created))
    assert huge.status_code == 400 and huge.json()["data"] == {"code": "wiki_bad_item", "itemId": "h"}

    too_big = client.put(url, json={"items": [note(f"b{n}", body="z" * 1_400_000) for n in range(3)]}, headers=auth(created))
    assert too_big.status_code == 400 and too_big.json()["data"] == {"code": "wiki_too_large"}

    for bad in ({"items": [note("x" * 81)]}, {"items": [note(kind="folder")]}, {"items": [note()] * 201},
                {"items": [note(data=[1, 2])]}, {"items": [note(data="text")]}, {"items": [note(updated=-5)]},
                {"items": [{"id": "x"}]}, {"items": "no"}):
        status = client.put(url, json=bad, headers=auth(created)).status_code
        assert status == 422, (bad if len(str(bad)) < 200 else "big", status)
    assert client.put(url, json={}, headers=auth(created)).status_code == 200            # no items: a no-op
    assert client.get(url, headers=auth(created)).json()["items"] == []        # nothing leaked in


def test_an_empty_put_and_a_put_of_200_records(client):
    created = create(client)
    ws = created["workspaceId"]
    assert client.put(f"{BASE}/{ws}/items", json={"items": []}, headers=auth(created)).json()["items"] == []
    res = client.put(f"{BASE}/{ws}/items", json={"items": [note(f"r{n:03d}") for n in range(200)]}, headers=auth(created))
    assert res.status_code == 200 and len(res.json()["items"]) == 200


def test_a_note_of_one_and_a_half_megabytes_goes_through_and_comes_back_intact(client):
    created = create(client)
    ws = created["workspaceId"]
    body = "ế" * 500_000
    sent = note("big", body=body)
    pushed = client.put(f"{BASE}/{ws}/items", json={"items": [sent]}, headers=auth(created))
    assert pushed.status_code == 200, pushed.text[:200]
    assert pushed.json()["items"][0]["data"]["body"] == body
    listed = client.get(f"{BASE}/{ws}/items", headers=auth(created)).json()
    assert [i["id"] for i in listed["items"]] == ["big"] and listed["items"][0]["data"] == sent["data"]


def test_data_is_opaque_whatever_the_note_holds(client):
    created = create(client)
    ws = created["workspaceId"]
    data = {"$where": "1", "a.b": [1, 2.5, None, True, {"": "x"}], "emoji": "🍜", "html": "<b>x</b>", "n": {"d": {"e": []}}}
    client.put(f"{BASE}/{ws}/items", json={"items": [note("odd", data=data)]}, headers=auth(created))
    assert client.get(f"{BASE}/{ws}/items", headers=auth(created)).json()["items"][0]["data"] == data


def test_the_quota_of_records_is_enforced_over_http(client, monkeypatch):
    monkeypatch.setattr(settings, "WIKI_MAX_ITEMS", 2)
    wiki_factory.reset_for_tests()
    created = create(client)
    ws = created["workspaceId"]
    assert client.put(f"{BASE}/{ws}/items", json={"items": [note("a"), note("b")]}, headers=auth(created)).status_code == 200
    full = client.put(f"{BASE}/{ws}/items", json={"items": [note("c")]}, headers=auth(created))
    assert full.status_code == 400 and full.json()["data"]["code"] == "wiki_workspace_full"
    assert full.json()["data"]["limit"] == 2


def test_creating_workspaces_is_rate_limited_per_address(client, monkeypatch):
    monkeypatch.setattr(settings, "WIKI_WORKSPACES_PER_HOUR", 2)
    wiki_factory.reset_for_tests()
    create(client)
    create(client)
    third = client.post(f"{BASE}/workspaces")
    assert third.status_code == 429 and third.json()["data"]["code"] == "wiki_rate_limited"
    assert int(third.headers["retry-after"]) >= 1


def test_wrong_keys_are_counted_and_then_blocked(client):
    created = create(client)
    ws = created["workspaceId"]
    codes = [client.get(f"{BASE}/{ws}/items", headers={"X-Wiki-Key": f"guess{n}"}).status_code for n in range(22)]
    assert codes[:20] == [401] * 20 and codes[20:] == [429, 429]
    blocked = client.put(f"{BASE}/{ws}/items", json={"items": [note()]}, headers=auth(created))
    assert blocked.status_code == 429 and blocked.json()["data"]["code"] == "wiki_rate_limited"


def test_the_wiki_and_codestore_counters_are_apart(client):
    from src.adapter.factory import codestore_factory

    codestore_factory.reset_for_tests()
    try:
        created = create(client)
        ws = created["workspaceId"]
        for n in range(21):
            client.get(f"{BASE}/{ws}/items", headers={"X-Wiki-Key": f"guess{n}"})
        assert client.get(f"{BASE}/{ws}/items", headers=auth(created)).status_code == 429
        assert client.post(f"{settings.API_PREFIX}/codestore/workspaces").status_code == 201      # not locked out of the other store
    finally:
        codestore_factory.reset_for_tests()


# ---------------------------------------------------------------------------
# ?backend=
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("backend", ["json", "mysql", "mongo"])
def test_each_backend_serves_the_whole_flow_and_keeps_workspaces_apart(client, backend):
    created = create(client, backend)
    ws = created["workspaceId"]
    q = f"?backend={backend}"
    put = client.put(f"{BASE}/{ws}/items{q}", json={"items": [note("a", "hello 🍜"), note("c", kind="card", data={"front": "f"})]},
                     headers=auth(created))
    assert put.status_code == 200, put.text
    listed = client.get(f"{BASE}/{ws}/items{q}", headers=auth(created)).json()
    assert sorted(i["id"] for i in listed["items"]) == ["a", "c"]
    assert next(i for i in listed["items"] if i["id"] == "a")["data"]["body"] == "hello 🍜"
    assert next(i for i in listed["items"] if i["id"] == "c")["kind"] == "card"

    # the workspace exists only in the store it was created in
    for other in {"json", "mysql", "mongo"} - {backend}:
        assert client.get(f"{BASE}/{ws}/items?backend={other}", headers=auth(created)).status_code == 404

    assert client.delete(f"{BASE}/{ws}{q}", headers=auth(created)).json() == {"deleted": True}
    assert client.get(f"{BASE}/{ws}/items{q}", headers=auth(created)).status_code == 404


def test_the_default_backend_comes_from_the_settings(client, monkeypatch):
    monkeypatch.setattr(settings, "WIKI_STORAGE_BACKEND", "mongo")
    wiki_factory.reset_for_tests()
    created = create(client)
    assert client.get(f"{BASE}/backends").json()["default"] == "mongo"
    assert client.get(f"{BASE}/{created['workspaceId']}/items?backend=mongo", headers=auth(created)).status_code == 200
    assert client.get(f"{BASE}/{created['workspaceId']}/items?backend=json", headers=auth(created)).status_code == 404


def test_an_unknown_backend_is_a_400_and_an_unconfigured_mongo_a_503(client, monkeypatch):
    bad = client.post(f"{BASE}/workspaces?backend=oracle")
    assert bad.status_code == 400 and bad.json()["data"]["code"] == "wiki_bad_backend"
    assert client.post(f"{BASE}/workspaces?backend=" + "x" * 17).status_code == 422
    assert client.get(f"{BASE}/wk_x/items?backend=oracle", headers={"X-Wiki-Key": "k"}).status_code == 400
    assert client.post(f"{BASE}/workspaces?backend=MySQL").status_code == 201            # case does not matter

    monkeypatch.setattr(wiki_factory.mongo_store, "is_configured", lambda: False)
    unavailable = client.post(f"{BASE}/workspaces?backend=mongo")
    assert unavailable.status_code == 503 and unavailable.json()["data"]["code"] == "wiki_backend_unavailable"


def test_the_json_file_holds_only_the_key_digest(client, tmp_path):
    created = create(client)
    stored = (tmp_path / "wiki.json").read_text(encoding="utf-8")
    assert created["key"] not in stored and created["workspaceId"] in stored
    assert not (tmp_path / "codestore.json").exists()


@pytest.mark.filterwarnings("ignore:Duplicate Operation ID")
def test_the_wiki_routes_are_registered_under_the_wiki_tag():
    paths = app.openapi()["paths"]
    wiki = {path: sorted(methods) for path, methods in paths.items() if path.startswith(BASE + "/")}
    assert wiki == {
        f"{BASE}/backends": ["get"],
        f"{BASE}/workspaces": ["post"],
        f"{BASE}/{{workspace_id}}/items": ["get", "put"],
        f"{BASE}/{{workspace_id}}": ["delete"],
    }
    assert {tag for path in wiki for operation in paths[path].values() for tag in operation["tags"]} == {"wiki"}
