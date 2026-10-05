"""Tests for the personal-spending workspace API.

The JSON repository is pointed at a temp file so nothing touches the real store.
"""

import os

os.environ.setdefault("TESTING", "1")

import pytest
from fastapi.testclient import TestClient

from src.adapter.factory import spending_factory
from src.adapter.output.spending.json_repository import JsonSpendingRepository
from src.application.config.config import settings
from src.application.exceptions.exceptions import BadRequestError
from src.application.usecases.spending_usecase import SpendingUseCase
from src.domain.vo.spending_vo import SpendingCreateRequest
from src.main import app
from tests.conftest import arun

BASE = f"{settings.API_PREFIX}/spending"

LEDGER = {
    "schema": 1,
    "accounts": [{"id": "a_cash", "name": "Tiền mặt", "openingBalance": 0}],
    "transactions": [{"id": "t_1", "type": "expense", "amount": 57000, "note": "cơm trưa 🍜"}],
}


@pytest.fixture
def client(tmp_path):
    spending_factory.reset_for_tests()
    repo = JsonSpendingRepository(file_path=tmp_path / "spending.json")
    usecase = SpendingUseCase(repository=repo, max_bytes=2000)
    app.dependency_overrides[spending_factory.get_spending_input_port] = lambda: usecase
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    spending_factory.reset_for_tests()


@pytest.fixture
def real_wiring_client(tmp_path, monkeypatch):
    """No dependency override: requests go through `spending_factory` itself."""
    spending_factory.reset_for_tests()
    monkeypatch.setattr(settings, "SPENDING_STORAGE_BACKEND", "json")
    monkeypatch.setattr(settings, "SPENDING_JSON_FILE", str(tmp_path / "wired.json"))
    monkeypatch.setattr(settings, "SPENDING_MAX_BYTES", 1500)
    app.dependency_overrides.clear()
    with TestClient(app) as c:
        yield c
    spending_factory.reset_for_tests()


def make_workspace(client, name="Sổ nhà", data=None):
    body = {"name": name}
    if data is not None:
        body["data"] = data
    res = client.post(f"{BASE}/workspaces", json=body)
    assert res.status_code == 201, res.text
    return res.json()["data"]


def auth(key):
    return {"X-Workspace-Key": key}


# ---------------------------------------------------------------------------
# the whole flow
# ---------------------------------------------------------------------------
def test_full_flow_create_read_save_conflict_poll_delete(client):
    # create, pushing this device's ledger up as revision 1
    res = client.post(f"{BASE}/workspaces", json={"name": "Sổ nhà", "data": LEDGER})
    assert res.status_code == 201
    envelope = res.json()
    assert envelope["status_code"] == 201
    assert "access key" in envelope["message"]  # the message tells the user to keep the key
    created = envelope["data"]
    assert created["id"].startswith("sp_")
    assert created["revision"] == 1
    assert created["name"] == "Sổ nhà"
    key = auth(created["access_key"])
    path = f"{BASE}/workspaces/{created['id']}"

    # read it back
    view = client.get(path, headers=key).json()["data"]
    assert view["data"] == LEDGER
    assert view["revision"] == 1
    assert view["unchanged"] is False
    assert {"id", "name", "revision", "created_at", "updated_at"} <= set(view)

    # save revision 1 -> 2
    edited = {**LEDGER, "transactions": LEDGER["transactions"] + [{"id": "t_2", "type": "income", "amount": 1}]}
    saved = client.put(path, json={"revision": 1, "data": edited}, headers=key)
    assert saved.status_code == 200
    assert saved.json()["data"]["revision"] == 2
    assert saved.json()["data"]["data"] == edited

    # a second device, still on revision 1, is refused and shown what is stored
    stale = client.put(path, json={"revision": 1, "data": {"stale": True}}, headers=key)
    assert stale.status_code == 409
    current = stale.json()["data"]["current"]
    assert current["revision"] == 2
    assert current["data"] == edited
    assert client.get(path, headers=key).json()["data"]["data"] == edited  # nothing was overwritten

    # polling: up to date -> no document; behind -> the document
    unchanged = client.get(f"{path}?since=2", headers=key).json()["data"]
    assert unchanged["unchanged"] is True
    assert unchanged["data"] is None
    assert unchanged["revision"] == 2
    behind = client.get(f"{path}?since=1", headers=key).json()["data"]
    assert behind["unchanged"] is False
    assert behind["data"] == edited

    # delete
    deleted = client.delete(path, headers=key)
    assert deleted.status_code == 200
    assert deleted.json()["data"] == {"deleted": True}
    assert client.get(path, headers=key).status_code == 404
    assert client.delete(path, headers=key).status_code == 404


def test_create_without_a_body_name_uses_the_default_and_starts_empty(client):
    created = client.post(f"{BASE}/workspaces", json={}).json()["data"]
    view = client.get(f"{BASE}/workspaces/{created['id']}", headers=auth(created["access_key"])).json()["data"]
    assert view["name"] == "Sổ chi tiêu"
    assert view["data"] == {}


def test_save_can_rename_the_workspace(client):
    created = make_workspace(client)
    res = client.put(
        f"{BASE}/workspaces/{created['id']}",
        json={"revision": 1, "name": "Sổ mới", "data": {"a": 1}},
        headers=auth(created["access_key"]),
    )
    assert res.json()["data"]["name"] == "Sổ mới"


def test_vietnamese_text_and_operator_like_keys_round_trip_over_http(client):
    data = {"ghi chú": "Đặt cọc nhà — 3,5 triệu ✓", "$set": {"a.b": "x"}}
    created = make_workspace(client, data=data)
    view = client.get(f"{BASE}/workspaces/{created['id']}", headers=auth(created["access_key"])).json()["data"]
    assert view["data"] == data


# ---------------------------------------------------------------------------
# access: 404 before 401
# ---------------------------------------------------------------------------
def test_reading_without_or_with_the_wrong_key_is_401(client):
    created = make_workspace(client)
    path = f"{BASE}/workspaces/{created['id']}"
    assert client.get(path).status_code == 401
    assert client.get(path, headers=auth("wrong")).status_code == 401
    assert client.get(path, headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert client.get(path, headers={"Authorization": "Basic abc"}).status_code == 401


def test_unknown_workspace_is_404_not_401_for_every_verb(client):
    # Answering 401 for a missing id would let a caller probe which ids exist.
    path = f"{BASE}/workspaces/sp_nope"
    for headers in ({}, auth("x")):
        assert client.get(path, headers=headers).status_code == 404
        assert client.put(path, json={"revision": 1, "data": {}}, headers=headers).status_code == 404
        assert client.delete(path, headers=headers).status_code == 404


def test_a_write_without_the_key_changes_nothing(client):
    created = make_workspace(client, data={"v": "original"})
    path = f"{BASE}/workspaces/{created['id']}"
    assert client.put(path, json={"revision": 1, "data": {"v": "hijacked"}}).status_code == 401
    assert client.delete(path).status_code == 401

    view = client.get(path, headers=auth(created["access_key"])).json()["data"]
    assert (view["revision"], view["data"]) == (1, {"v": "original"})


def test_the_key_works_in_x_workspace_key_and_as_a_bearer_token(client):
    created = make_workspace(client, data={"v": 1})
    path = f"{BASE}/workspaces/{created['id']}"
    key = created["access_key"]

    assert client.get(path, headers=auth(key)).status_code == 200
    assert client.get(path, headers={"Authorization": f"Bearer {key}"}).status_code == 200
    assert client.get(path, headers={"Authorization": f"bearer {key}"}).status_code == 200
    # Both ways work for writes too.
    assert client.put(path, json={"revision": 1, "data": {"v": 2}}, headers={"Authorization": f"Bearer {key}"}).status_code == 200
    assert client.delete(path, headers=auth(key)).status_code == 200


def test_x_workspace_key_wins_when_both_headers_are_sent(client):
    created = make_workspace(client)
    res = client.get(
        f"{BASE}/workspaces/{created['id']}",
        headers={"X-Workspace-Key": created["access_key"], "Authorization": "Bearer wrong"},
    )
    assert res.status_code == 200


def test_the_access_key_and_its_hash_are_never_returned_again_or_stored_in_the_clear(client, tmp_path):
    created = make_workspace(client, data={"v": 1})
    path = f"{BASE}/workspaces/{created['id']}"
    key = auth(created["access_key"])

    for response in (
        client.get(path, headers=key),
        client.put(path, json={"revision": 1, "data": {"v": 2}}, headers=key),
        client.put(path, json={"revision": 1, "data": {"v": 3}}, headers=key),  # 409
        client.get(f"{path}?since=2", headers=key),
    ):
        assert created["access_key"] not in response.text
        assert "key_hash" not in response.text
        assert "access_key" not in response.text

    stored = (tmp_path / "spending.json").read_text(encoding="utf-8")
    assert created["access_key"] not in stored


# ---------------------------------------------------------------------------
# validation
# ---------------------------------------------------------------------------
def test_oversized_documents_are_refused_on_create_and_save(client):
    big = {"blob": "x" * 5000}  # the fixture's limit is 2000 bytes
    res = client.post(f"{BASE}/workspaces", json={"data": big})
    assert res.status_code == 400

    created = make_workspace(client, data={"v": 1})
    path = f"{BASE}/workspaces/{created['id']}"
    res = client.put(path, json={"revision": 1, "data": big}, headers=auth(created["access_key"]))
    assert res.status_code == 400
    assert client.get(path, headers=auth(created["access_key"])).json()["data"]["revision"] == 1


def test_a_document_that_is_not_an_object_is_rejected(client):
    # FastAPI's request validation answers before the usecase is reached; the
    # usecase has its own 400 for callers that bypass it (see its tests).
    assert client.post(f"{BASE}/workspaces", json={"data": [1, 2]}).status_code == 422
    created = make_workspace(client)
    path = f"{BASE}/workspaces/{created['id']}"
    key = auth(created["access_key"])
    assert client.put(path, json={"revision": 1, "data": [1, 2]}, headers=key).status_code == 422
    assert client.put(path, json={"revision": 1, "data": "text"}, headers=key).status_code == 422
    assert client.put(path, json={"revision": 1}, headers=key).status_code == 422  # data is required


def test_bad_revisions_names_and_since_values_are_422(client):
    created = make_workspace(client)
    path = f"{BASE}/workspaces/{created['id']}"
    key = auth(created["access_key"])
    assert client.put(path, json={"revision": -1, "data": {}}, headers=key).status_code == 422
    assert client.put(path, json={"revision": "one", "data": {}}, headers=key).status_code == 422
    assert client.put(path, json={"revision": 1, "name": "", "data": {}}, headers=key).status_code == 422
    assert client.put(path, json={"revision": 1, "name": "x" * 121, "data": {}}, headers=key).status_code == 422
    assert client.post(f"{BASE}/workspaces", json={"name": ""}).status_code == 422
    assert client.get(f"{path}?since=-1", headers=key).status_code == 422
    assert client.get(f"{path}?since=abc", headers=key).status_code == 422


def test_a_whitespace_only_name_on_save_is_a_400(client):
    created = make_workspace(client)
    res = client.put(
        f"{BASE}/workspaces/{created['id']}",
        json={"revision": 1, "name": "   ", "data": {}},
        headers=auth(created["access_key"]),
    )
    assert res.status_code == 400


# ---------------------------------------------------------------------------
# storage backend selection
# ---------------------------------------------------------------------------
def test_backends_endpoint_names_the_default_and_what_is_available(client, monkeypatch):
    # Mongo is reported unconfigured so the probe never opens a real connection,
    # whatever MONGO_URI the developer's .env holds. No key is sent: it needs none.
    monkeypatch.setattr(spending_factory.mongo_store, "is_configured", lambda: False)
    res = client.get(f"{BASE}/backends")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["default"] == spending_factory.default_backend()
    assert [entry["id"] for entry in data["backends"]] == ["json", "mysql", "mongo"]
    for entry in data["backends"]:
        assert set(entry) == {"id", "available", "reason"}
        assert isinstance(entry["available"], bool)
    listed = {entry["id"]: entry for entry in data["backends"]}
    assert listed["json"]["available"] is True
    assert listed["mongo"]["available"] is False


def test_an_unknown_backend_query_is_a_400(real_wiring_client):
    # No dependency override: this goes through the real `backend` query parameter.
    for call in (
        lambda: real_wiring_client.post(f"{BASE}/workspaces?backend=xyz", json={}),
        lambda: real_wiring_client.get(f"{BASE}/workspaces/sp_x?backend=xyz"),
        lambda: real_wiring_client.put(f"{BASE}/workspaces/sp_x?backend=postgres", json={"revision": 1, "data": {}}),
        lambda: real_wiring_client.delete(f"{BASE}/workspaces/sp_x?backend=xyz"),
    ):
        res = call()
        assert res.status_code == 400
        assert "json, mysql, mongo" in res.json()["message"]


def test_mongo_without_a_uri_is_a_503(real_wiring_client, monkeypatch):
    monkeypatch.setattr(spending_factory.mongo_store, "is_configured", lambda: False)
    assert real_wiring_client.post(f"{BASE}/workspaces?backend=mongo", json={}).status_code == 503


def test_the_real_wiring_serves_the_json_backend_with_the_configured_limit(real_wiring_client):
    # explicit ?backend=json and the settings default both reach the same store
    res = real_wiring_client.post(f"{BASE}/workspaces?backend=json", json={"name": "Wired", "data": {"v": 1}})
    assert res.status_code == 201
    created = res.json()["data"]
    path = f"{BASE}/workspaces/{created['id']}"

    for suffix in ("", "?backend=json"):
        got = real_wiring_client.get(path + suffix, headers=auth(created["access_key"]))
        assert got.status_code == 200
        assert got.json()["data"]["data"] == {"v": 1}

    # SPENDING_MAX_BYTES (1500 in this fixture) reaches the usecase
    too_big = real_wiring_client.post(f"{BASE}/workspaces", json={"data": {"blob": "x" * 3000}})
    assert too_big.status_code == 400


# ---------------------------------------------------------------------------
# factory wiring
# ---------------------------------------------------------------------------
def test_each_backend_gets_its_own_usecase(monkeypatch):
    """A workspace id belongs to the store it was created in, so the wiring must
    not hand two backends the same repository."""
    spending_factory.reset_for_tests()
    monkeypatch.setattr(spending_factory.mongo_store, "is_configured", lambda: True)
    try:
        assert spending_factory.get_spending_usecase("json") is spending_factory.get_spending_usecase("json")
        assert spending_factory.get_spending_usecase("json") is not spending_factory.get_spending_usecase("mysql")
        assert spending_factory.get_spending_usecase("mysql") is not spending_factory.get_spending_usecase("mongo")
        assert spending_factory.get_spending_repository("json") is spending_factory.get_spending_repository("json")
    finally:
        spending_factory.reset_for_tests()


def test_the_usecase_is_built_with_the_configured_size_limit(monkeypatch, tmp_path):
    spending_factory.reset_for_tests()
    monkeypatch.setattr(settings, "SPENDING_JSON_FILE", str(tmp_path / "limit.json"))
    monkeypatch.setattr(settings, "SPENDING_MAX_BYTES", 60)
    try:
        usecase = spending_factory.get_spending_usecase("json")
        with pytest.raises(BadRequestError):
            arun(usecase.create_workspace(SpendingCreateRequest(data={"blob": "x" * 100})))
    finally:
        spending_factory.reset_for_tests()


def test_resolve_backend_rejects_unknown_names_and_unconfigured_mongo(monkeypatch):
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as unknown:
        spending_factory.resolve_backend("postgres")
    assert unknown.value.status_code == 400

    monkeypatch.setattr(spending_factory.mongo_store, "is_configured", lambda: False)
    with pytest.raises(HTTPException) as unconfigured:
        spending_factory.resolve_backend("mongo")
    assert unconfigured.value.status_code == 503

    monkeypatch.setattr(spending_factory.mongo_store, "is_configured", lambda: True)
    assert spending_factory.resolve_backend("MONGO") == "mongo"
