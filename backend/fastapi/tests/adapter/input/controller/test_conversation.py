import os
os.environ.setdefault("TESTING", "1")

from fastapi.testclient import TestClient
from src.main import app


client = TestClient(app)
# ensure DB tables exist for tests (use in-memory sqlite when running under pytest)
from src.adapter.db.base import init_db
init_db()


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_list_conversations_empty():
    r = client.get("/api/v1/conversations")
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, dict)
    assert body["data"] == []
    assert body["first_id"] is None
    assert body["last_id"] is None
    assert body["has_more"] is False
