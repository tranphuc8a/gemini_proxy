"""The AI endpoints over HTTP, and the chat now spending the same guarded quota."""

from __future__ import annotations

import json
from typing import AsyncIterator

import pytest
from fastapi.testclient import TestClient

from src.adapter.factory.ai_factory import get_ai_usecase
from src.adapter.factory.service_factory import ServiceFactory
from src.adapter.output.mysql.db.base import Base, get_async_engine, get_async_session, get_async_session_dependency
from src.application.config.config import settings
from src.application.ports.input.gemini_input_port import GeminiInputPort
from src.application.usecases.ai_usecase import AiUseCase
from src.domain.vo.message_request import MessageRequest
from src.domain.vo.stream_event import StreamEvent
from src.main import app
from tests.support.fake_ai import FakeModel, FakeStore

ADMIN_KEY = "test-course-key"
AI = f"{settings.API_PREFIX}/ai"
GEMINI = f"{settings.API_PREFIX}/gemini"


class StubGemini(GeminiInputPort):
    async def query(self, message_request: MessageRequest) -> str:
        return "trả lời ba mươi chữ"

    async def query_stream(self, message_request: MessageRequest) -> AsyncIterator[StreamEvent]:
        yield StreamEvent.delta("Xin ")
        yield StreamEvent.delta("chào")
        yield StreamEvent.done(conversation_id="c1", user_message_id="u1", message_id="m1")


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("COURSE_ADMIN_KEY", ADMIN_KEY)
    monkeypatch.setattr(settings, "AI_ENABLED", True)
    monkeypatch.setattr(settings, "AI_ACCESS", "admin")
    monkeypatch.setattr(settings, "AI_ACCESS_CODE", "")
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
    app.dependency_overrides[ServiceFactory.get_gemini_input_port] = lambda: StubGemini()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _chat(client, path="query", **headers):
    return client.post(f"{GEMINI}/{path}", json={"conversation_id": "c1", "content": "chào bạn", "model": "gemini-2.5-flash"},
                       headers=headers)


def test_status_by_default_lets_only_the_administrator_in(client):
    s = client.get(f"{AI}/status").json()
    assert s["access"] == "admin" and s["allowed"] is False and s["needs"] == "admin"
    s = client.get(f"{AI}/status", headers={"X-Admin-Key": ADMIN_KEY}).json()
    assert s["allowed"] is True and s["admin"] is True


def test_code_mode_login_and_token(client, monkeypatch):
    monkeypatch.setattr(settings, "AI_ACCESS", "code")
    monkeypatch.setattr(settings, "AI_ACCESS_CODE", "lop-10a")
    r = client.post(f"{AI}/session", json={"code": "sai"})
    assert r.status_code == 403 and r.json()["data"]["code"] == "ai_code_invalid"
    r = client.post(f"{AI}/session", json={"code": "lop-10a"})
    assert r.status_code == 200
    token = r.json()["session"]
    s = client.get(f"{AI}/status", headers={"X-AI-Session": token}).json()
    assert s["allowed"] is True and s["needs"] is None
    assert client.get(f"{AI}/status", headers={"X-AI-Session": "rac.khong-hop-le"}).json()["allowed"] is False
    r = client.get(f"{AI}/status", headers={"X-AI-Session": "rác.ÿ".encode("latin-1")})
    assert r.status_code == 200 and r.json()["allowed"] is False, "a latin-1 header is a bad token, not a 500"


def test_usage_is_for_the_administrator(client):
    r = client.get(f"{AI}/usage")
    assert r.status_code == 403
    _chat(client)
    u = client.get(f"{AI}/usage", headers={"X-Admin-Key": ADMIN_KEY}).json()
    features = {row["feature"]: row for row in u["rows"]}
    assert features["chat"]["requests"] == 1 and features["*"]["requests"] == 1
    assert features["chat"]["output_tokens"] > 0
    assert u["budget"]["requestsUsed"] == 1 and u["config"]["access"] == "admin"


def test_the_chat_is_counted_and_streams_as_before(client):
    r = _chat(client, "stream")
    assert r.status_code == 200 and "event: done" in r.text
    r = _chat(client, "query")
    assert r.status_code == 200 and r.json()["data"] == "trả lời ba mươi chữ"
    u = client.get(f"{AI}/usage", headers={"X-Admin-Key": ADMIN_KEY}).json()
    assert {row["feature"]: row["requests"] for row in u["rows"]}["chat"] == 2


def test_the_chat_obeys_the_kill_switch_and_the_rate_limit(client, monkeypatch):
    monkeypatch.setattr(settings, "AI_ENABLED", False)
    r = _chat(client)
    assert r.status_code == 503 and r.json()["data"]["code"] == "ai_disabled"
    monkeypatch.setattr(settings, "AI_ENABLED", True)
    monkeypatch.setattr(settings, "AI_RATE_PER_MINUTE", 1)
    from src.application.usecases import ai_usecase

    ai_usecase.reset_limits()
    assert _chat(client).status_code == 200
    r = _chat(client, "stream")
    assert r.status_code == 429 and int(r.headers["Retry-After"]) > 0
    assert r.json()["data"]["code"] == "ai_rate_limited", "refused before the stream starts: a plain 429"


def test_the_daily_budget_also_covers_the_chat(client, monkeypatch):
    monkeypatch.setattr(settings, "AI_DAILY_REQUESTS", 1)
    assert _chat(client).status_code == 200
    r = _chat(client)
    assert r.status_code == 429 and r.json()["data"]["code"] == "ai_budget_exhausted"


TINY = {
    "course": {"slug": "k", "title": "Khoá K"},
    "nav": [{"id": "chinh", "title": "Chính", "sub": "", "icon": "book", "groups": [
        {"title": "Phần 1", "short": "P1", "items": ["a.md"]}]}],
    "slugs": {}, "order": [],
    "docs": {"a.md": {"id": "a.md", "slug": "bai/a", "title": "Bài A", "kind": "lesson",
                      "md": "# Bài A\n\nNội dung về băm nhất quán.\n"}},
}


def test_the_tutor_over_http(client, monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_URL", "https://gemini.test/v1beta/models/gemini-2.5-flash:generateContent")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "k")
    model = FakeModel([json.dumps({"answer": "Tóm tắt bài A."})])
    app.dependency_overrides[get_ai_usecase] = lambda: AiUseCase(FakeStore(), model)
    admin = {"X-Admin-Key": ADMIN_KEY}
    assert client.post(f"{settings.API_PREFIX}/courses/import", json=TINY, headers=admin).status_code == 200
    ask = {"course": "k", "doc": "a.md", "action": "summary"}

    refused = client.post(f"{AI}/tutor", json=ask)
    assert refused.status_code == 403 and refused.json()["data"]["code"] == "ai_admin_only"
    assert client.post(f"{AI}/tutor", json={**ask, "action": "dance"}, headers=admin).status_code == 422
    assert client.post(f"{AI}/tutor", json={**ask, "doc": "khong-co.md"}, headers=admin).status_code == 404

    r = client.post(f"{AI}/tutor", json=ask, headers=admin)
    assert r.status_code == 200 and r.headers["cache-control"] == "no-store"
    assert r.json() == {"action": "summary", "cached": False, "answer": "Tóm tắt bài A.", "sources": []}
    assert "băm nhất quán" in model.calls[0]["contents"][0]["parts"][0]["text"]


def test_drafting_a_course_over_http_is_for_the_administrator(client, monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_URL", "https://gemini.test/v1beta/models/gemini-2.5-flash:generateContent")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "k")
    monkeypatch.setattr(settings, "AI_ACCESS", "public")          # the drafting routes ask for an admin anyway
    outline = {"title": "Khoá T", "description": "D", "parts": [
        {"title": "Phần 1", "lessons": [{"title": "Bài B", "summary": "s", "points": ["a"]}]}]}
    model = FakeModel([json.dumps(outline), json.dumps({"md": "## Mục tiêu\n\nĐủ dài để thành một bài học thật sự."})])
    app.dependency_overrides[get_ai_usecase] = lambda: AiUseCase(FakeStore(), model)
    admin = {"X-Admin-Key": ADMIN_KEY}
    plan = {"course": {"title": "Khoá T"}, "outline": ["Bài B"], "part": "Phần 1", "lesson": {"title": "Bài B"}}

    assert client.post(f"{AI}/draft/outline", json={"topic": "x"}).status_code in (401, 403)
    assert client.post(f"{AI}/draft/lesson", json=plan).status_code in (401, 403)
    assert client.post(f"{AI}/draft/outline", json={"topic": "x", "lessons": 1}, headers=admin).status_code == 422
    assert model.calls == []

    r = client.post(f"{AI}/draft/outline", json={"topic": "Bloom filter", "level": "trung-cap"}, headers=admin)
    assert r.status_code == 200 and r.json()["outline"]["parts"][0]["lessons"][0]["title"] == "Bài B"
    r = client.post(f"{AI}/draft/lesson", json=plan, headers=admin)
    assert r.status_code == 200 and r.json()["md"].startswith("# Bài B\n\n## Mục tiêu")

