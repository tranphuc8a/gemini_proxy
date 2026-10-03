"""The arena over HTTP, on the test database."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from src.adapter.output.mysql.db.base import Base, get_async_engine, get_async_session, get_async_session_dependency
from src.application.config.config import settings
from src.application.usecases.arena_usecase import points, tour_length
from src.main import app

ARENA = f"{settings.API_PREFIX}/arena"


@pytest.fixture
def client():
    created = {"done": False}

    async def _session_with_schema():
        if not created["done"]:
            async with get_async_engine().begin() as conn:
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


def test_problems_and_their_cities(client):
    ids = [p["id"] for p in client.get(f"{ARENA}/problems").json()["problems"]]
    assert ids == ["tsp-60", "tsp-200", "tsp-1000"]
    r = client.get(f"{ARENA}/problems/tsp-200")
    assert r.status_code == 200 and len(r.json()["points"]) == 200 and "max-age" in r.headers["cache-control"]
    assert client.get(f"{ARENA}/problems/nope").status_code == 404


def test_submit_rank_and_leaderboard(client):
    n = 60
    good = list(range(n))
    bad = list(range(0, n, 2)) + list(range(1, n, 2))
    first = client.post(f"{ARENA}/problems/tsp-60/submit", json={"name": "An", "tour": bad}).json()
    assert first["improved"] is True and first["rank"] == 1
    second = client.post(f"{ARENA}/problems/tsp-60/submit", json={"name": "Bình", "tour": good}).json()
    assert second["score"] == tour_length(points("tsp-60"), good)
    again = client.post(f"{ARENA}/problems/tsp-60/submit", json={"name": "An", "tour": bad}).json()
    assert again["improved"] is False
    rows = client.get(f"{ARENA}/problems/tsp-60/leaderboard").json()["rows"]
    assert [r["name"] for r in rows] == sorted(["An", "Bình"], key=lambda x: {"An": first["score"], "Bình": second["score"]}[x])
    assert [r["rank"] for r in rows] == [1, 2]


def test_bad_submissions(client):
    url = f"{ARENA}/problems/tsp-60/submit"
    assert client.post(url, json={"name": "An", "tour": [True] * 60}).status_code == 422, "booleans are not city numbers"
    assert client.post(url, json={"name": "An", "tour": list(range(10))}).status_code == 400
    assert client.post(url, json={"name": "<script>", "tour": list(range(60))}).status_code == 400
    assert client.post(f"{ARENA}/problems/nope/submit", json={"name": "An", "tour": [0]}).status_code == 404
