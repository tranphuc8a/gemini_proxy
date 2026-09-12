"""HTTP-level behaviour of the conversation resource.

URLs are built from settings.API_PREFIX rather than hard-coded, because the
prefix is deployment configuration — it is "/api/v1" in the sample env and empty
in the deployed one.
"""

import pytest
from fastapi.testclient import TestClient

from src.adapter.output.mysql.db.base import (
    Base,
    get_async_engine,
    get_async_session,
    get_async_session_dependency,
)
from src.application.config.config import settings
from src.main import app

CONVERSATIONS = f"{settings.API_PREFIX}/conversations"


@pytest.fixture
def client():
    """A TestClient whose requests run against a freshly-created schema.

    The app's own startup schedules init_db() as a background task, which is not
    a strong enough guarantee for a test that queries immediately; overriding the
    session dependency makes schema creation happen before the first query.
    """
    created = {"done": False}

    async def _session_with_schema():
        if not created["done"]:
            engine = get_async_engine()
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.drop_all)
                await conn.run_sync(Base.metadata.create_all)
            created["done"] = True
        db = get_async_session()
        try:
            yield db
        finally:
            await db.close()

    app.dependency_overrides[get_async_session_dependency] = _session_with_schema
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_health(client):
    r = client.get(f"{settings.API_PREFIX}/health/")
    assert r.status_code == 200
    assert r.json()["status_code"] == 200


def test_list_conversations_empty(client):
    r = client.get(CONVERSATIONS)
    assert r.status_code == 200
    body = r.json()["data"]
    assert body["data"] == []
    assert body["first_id"] is None
    assert body["last_id"] is None
    assert body["has_more"] is False


@pytest.mark.parametrize("path", ["", "/"])
def test_collection_answers_with_and_without_a_trailing_slash(client, path):
    """Regression: only the trailing-slash spelling existed, so the browser paid
    a 307 redirect on every list and create."""
    r = client.get(f"{CONVERSATIONS}{path}", follow_redirects=False)
    assert r.status_code == 200


def test_create_list_rename_delete_round_trip(client):
    created = client.post(CONVERSATIONS)
    assert created.status_code == 201
    conv = created.json()["data"]
    assert conv["name"] == "New Conversation"
    conversation_id = conv["id"]

    listed = client.get(CONVERSATIONS).json()["data"]
    assert [c["id"] for c in listed["data"]] == [conversation_id]

    renamed = client.put(CONVERSATIONS, json={"id": conversation_id, "name": "Trip planning"})
    assert renamed.status_code == 200
    assert renamed.json()["data"]["name"] == "Trip planning"

    detail = client.get(f"{CONVERSATIONS}/{conversation_id}")
    assert detail.status_code == 200
    assert detail.json()["data"]["name"] == "Trip planning"

    deleted = client.delete(f"{CONVERSATIONS}/{conversation_id}")
    assert deleted.status_code == 200
    assert deleted.json()["data"] == {"deleted": True}

    assert client.get(CONVERSATIONS).json()["data"]["data"] == []


def test_unknown_conversation_is_404(client):
    r = client.get(f"{CONVERSATIONS}/does-not-exist")
    assert r.status_code == 404
    assert r.json()["status_code"] == 404


def test_messages_are_listed_newest_first(client):
    conversation_id = client.post(CONVERSATIONS).json()["data"]["id"]
    for text in ("first", "second", "third"):
        posted = client.post(f"{CONVERSATIONS}/{conversation_id}/messages", params={"content": text})
        assert posted.status_code == 201

    page = client.get(f"{CONVERSATIONS}/{conversation_id}/messages", params={"limit": 2, "order": "desc"})
    assert page.status_code == 200
    body = page.json()["data"]
    assert [m["content"] for m in body["data"]] == ["third", "second"]
    assert body["has_more"] is True

    recent = client.get(f"{CONVERSATIONS}/{conversation_id}/messages/recent", params={"k": 2})
    assert recent.status_code == 200
    assert len(recent.json()["data"]) == 2


def test_invalid_order_is_rejected(client):
    r = client.get(CONVERSATIONS, params={"order": "sideways"})
    assert r.status_code == 422
