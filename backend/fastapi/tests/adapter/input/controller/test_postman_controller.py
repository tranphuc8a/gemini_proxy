"""Tests for the postman-lite-pro workspace API.

The JSON repository is pointed at a temp file so nothing touches the real store.
"""

import os

os.environ.setdefault("TESTING", "1")

import pytest
from fastapi.testclient import TestClient

from src.adapter.factory import postman_factory
from src.adapter.output.postman.json_repository import JsonPostmanRepository
from src.application.config.config import settings
from src.application.usecases.postman_usecase import PostmanUseCase
from src.main import app

BASE = f"{settings.API_PREFIX}/postman"


@pytest.fixture
def client(tmp_path, monkeypatch):
    postman_factory.reset_for_tests()
    repo = JsonPostmanRepository(file_path=tmp_path / "workspaces.json")
    usecase = PostmanUseCase(repository=repo, max_history=5)
    app.dependency_overrides[postman_factory.get_postman_input_port] = lambda: usecase
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    postman_factory.reset_for_tests()


def make_workspace(client, name="Team API"):
    body = client.post(f"{BASE}/workspaces", json={"name": name}).json()
    return body["data"]


def auth(key):
    return {"X-Workspace-Key": key}


# ---------------------------------------------------------------------------
# creation and access
# ---------------------------------------------------------------------------
def test_create_returns_a_key_that_opens_the_workspace(client):
    created = make_workspace(client)
    assert created["revision"] == 1
    assert created["access_key"]

    res = client.get(f"{BASE}/workspaces/{created['id']}", headers=auth(created["access_key"]))
    assert res.status_code == 200
    assert res.json()["data"]["name"] == "Team API"


def test_reading_without_the_key_is_refused(client):
    created = make_workspace(client)
    assert client.get(f"{BASE}/workspaces/{created['id']}").status_code == 401
    assert client.get(f"{BASE}/workspaces/{created['id']}", headers=auth("wrong")).status_code == 401


def test_unknown_workspace_is_404_not_401(client):
    # Order matters: answering 401 for a missing id would let a caller probe
    # which workspace ids exist.
    assert client.get(f"{BASE}/workspaces/ws_nope", headers=auth("x")).status_code == 404


def test_the_access_key_is_never_stored_in_the_clear(client, tmp_path):
    created = make_workspace(client)
    client.get(f"{BASE}/workspaces/{created['id']}", headers=auth(created["access_key"]))
    stored = (tmp_path / "workspaces.json").read_text(encoding="utf-8")
    assert created["access_key"] not in stored


def test_bearer_header_works_as_an_alternative_to_the_custom_header(client):
    created = make_workspace(client)
    res = client.get(
        f"{BASE}/workspaces/{created['id']}",
        headers={"Authorization": f"Bearer {created['access_key']}"},
    )
    assert res.status_code == 200


# ---------------------------------------------------------------------------
# saving and revisions
# ---------------------------------------------------------------------------
def test_save_round_trips_the_documents_and_bumps_the_revision(client):
    created = make_workspace(client)
    payload = {
        "revision": 1,
        "collections": [{"id": "c1", "name": "Auth"}],
        "requests": [{"id": "r1", "name": "Login", "method": "POST"}],
        "environments": [{"name": "Local", "vars": {"BASE": "http://localhost"}}],
    }

    saved = client.put(
        f"{BASE}/workspaces/{created['id']}", json=payload, headers=auth(created["access_key"])
    ).json()["data"]

    assert saved["revision"] == 2
    assert saved["requests"][0]["name"] == "Login"

    reread = client.get(
        f"{BASE}/workspaces/{created['id']}", headers=auth(created["access_key"])
    ).json()["data"]
    assert reread["collections"] == payload["collections"]
    assert reread["environments"] == payload["environments"]


def test_a_stale_save_is_refused_and_returns_the_current_document(client):
    created = make_workspace(client)
    key = auth(created["access_key"])
    client.put(f"{BASE}/workspaces/{created['id']}", json={"revision": 1, "requests": [{"id": "a"}]}, headers=key)

    # Second browser still thinks it is on revision 1.
    res = client.put(
        f"{BASE}/workspaces/{created['id']}",
        json={"revision": 1, "requests": [{"id": "b"}]},
        headers=key,
    )

    assert res.status_code == 409
    current = res.json()["data"]["current"]
    assert current["revision"] == 2
    assert current["requests"] == [{"id": "a"}]  # the first save survived


def test_saving_without_the_key_changes_nothing(client):
    created = make_workspace(client)
    res = client.put(f"{BASE}/workspaces/{created['id']}", json={"revision": 1, "requests": [{"id": "x"}]})
    assert res.status_code == 401

    reread = client.get(
        f"{BASE}/workspaces/{created['id']}", headers=auth(created["access_key"])
    ).json()["data"]
    assert reread["requests"] == []


def test_oversized_payload_is_refused(client):
    created = make_workspace(client)
    res = client.put(
        f"{BASE}/workspaces/{created['id']}",
        json={"revision": 1, "requests": [{"id": str(i)} for i in range(5001)]},
        headers=auth(created["access_key"]),
    )
    assert res.status_code == 400


# ---------------------------------------------------------------------------
# sharing
# ---------------------------------------------------------------------------
def test_share_link_exposes_collections_but_never_environments(client):
    created = make_workspace(client)
    key = auth(created["access_key"])
    client.put(
        f"{BASE}/workspaces/{created['id']}",
        json={
            "revision": 1,
            "collections": [{"id": "c1", "name": "Public"}],
            "requests": [{"id": "r1"}],
            "environments": [{"name": "Prod", "vars": {"TOKEN": "super-secret"}}],
        },
        headers=key,
    )

    token = client.post(f"{BASE}/workspaces/{created['id']}/share", headers=key).json()["data"]["share_token"]
    shared = client.get(f"{BASE}/shared/{token}").json()["data"]

    assert shared["collections"] == [{"id": "c1", "name": "Public"}]
    # Environments hold tokens and passwords, so they must not be in a payload
    # reachable by anyone holding the link.
    assert "environments" not in shared
    assert "super-secret" not in client.get(f"{BASE}/shared/{token}").text


def test_revoking_a_share_makes_the_link_dead(client):
    created = make_workspace(client)
    key = auth(created["access_key"])
    token = client.post(f"{BASE}/workspaces/{created['id']}/share", headers=key).json()["data"]["share_token"]
    assert client.get(f"{BASE}/shared/{token}").status_code == 200

    client.post(f"{BASE}/workspaces/{created['id']}/share?enabled=false", headers=key)
    assert client.get(f"{BASE}/shared/{token}").status_code == 404


def test_sharing_twice_keeps_the_same_link(client):
    created = make_workspace(client)
    key = auth(created["access_key"])
    first = client.post(f"{BASE}/workspaces/{created['id']}/share", headers=key).json()["data"]["share_token"]
    second = client.post(f"{BASE}/workspaces/{created['id']}/share", headers=key).json()["data"]["share_token"]
    assert first == second


# ---------------------------------------------------------------------------
# history
# ---------------------------------------------------------------------------
def test_history_is_newest_first_and_capped(client):
    created = make_workspace(client)
    key = auth(created["access_key"])

    for i in range(7):  # max_history is 5 in this fixture
        client.post(
            f"{BASE}/workspaces/{created['id']}/history",
            json={"method": "GET", "url": f"https://a.dev/{i}", "status": 200},
            headers=key,
        )

    page = client.get(f"{BASE}/workspaces/{created['id']}/history", headers=key).json()["data"]
    assert page["total"] == 5
    assert page["items"][0]["url"] == "https://a.dev/6"


def test_history_entries_get_an_id_and_timestamp(client):
    created = make_workspace(client)
    key = auth(created["access_key"])
    entry = client.post(
        f"{BASE}/workspaces/{created['id']}/history",
        json={"method": "POST", "url": "https://a.dev/x"},
        headers=key,
    ).json()["data"]
    assert entry["id"]
    assert entry["timestamp"]


def test_clearing_history_leaves_the_workspace_intact(client):
    created = make_workspace(client)
    key = auth(created["access_key"])
    client.put(f"{BASE}/workspaces/{created['id']}", json={"revision": 1, "requests": [{"id": "r"}]}, headers=key)
    client.post(f"{BASE}/workspaces/{created['id']}/history", json={"method": "GET", "url": "u"}, headers=key)

    removed = client.delete(f"{BASE}/workspaces/{created['id']}/history", headers=key).json()["data"]["removed"]
    assert removed == 1

    reread = client.get(f"{BASE}/workspaces/{created['id']}", headers=key).json()["data"]
    assert reread["requests"] == [{"id": "r"}]


def test_deleting_a_workspace_takes_its_history_with_it(client):
    created = make_workspace(client)
    key = auth(created["access_key"])
    client.post(f"{BASE}/workspaces/{created['id']}/history", json={"method": "GET", "url": "u"}, headers=key)

    assert client.delete(f"{BASE}/workspaces/{created['id']}", headers=key).json()["data"]["deleted"] is True
    assert client.get(f"{BASE}/workspaces/{created['id']}", headers=key).status_code == 404
