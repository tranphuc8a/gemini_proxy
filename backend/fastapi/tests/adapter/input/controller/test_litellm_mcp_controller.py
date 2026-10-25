from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from src.adapter.factory.litellm_factory import get_litellm_admin_client, get_litellm_user_ai
from src.application.config.config import settings
from src.application.exceptions.exceptions import AppException
from src.application.usecases.ai_usecase import AiUseCase
from src.main import app
from tests.support.fake_ai import FakeModel, FakeStore

API = settings.API_PREFIX
ADMIN_KEY = "litellm-test-admin"
MODEL = "gemini-2.5-flash"


class StubLiteLLMAdmin:
    def __init__(self):
        self.generated = None

    async def list_models(self):
        return [{"id": MODEL, "label": MODEL}, {"id": "claude-3-7-sonnet", "label": "Claude"}]

    async def management_request(self, path, payload):
        self.generated = (path, payload)
        return {"key": "sk-one-time"}


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("COURSE_ADMIN_KEY", ADMIN_KEY)
    monkeypatch.setattr(settings, "AI_ENABLED", True)
    monkeypatch.setattr(settings, "LITELLM_API_BASE", "https://litellm.test/v1")
    monkeypatch.setattr(settings, "FRONTEND_ALLOWED_ORIGINS", "https://trusted.example")
    model = FakeModel(answers=["Hello from LiteLLM"], models=[MODEL])
    admin = StubLiteLLMAdmin()
    app.dependency_overrides[get_litellm_user_ai] = lambda: AiUseCase(FakeStore(), model)
    app.dependency_overrides[get_litellm_admin_client] = lambda: admin
    with TestClient(app) as test_client:
        yield test_client, model, admin
    app.dependency_overrides.clear()


def _mcp(client, method, params=None, request_id=1, headers=None):
    payload = {"jsonrpc": "2.0", "id": request_id, "method": method}
    if params is not None:
        payload["params"] = params
    return client.post(
        f"{API}/mcp",
        json=payload,
        headers={"Accept": "application/json, text/event-stream", **(headers or {})},
    )


def test_litellm_user_factory_requires_bearer_key(monkeypatch):
    monkeypatch.setattr(settings, "LITELLM_API_BASE", "https://litellm.test/v1")
    with pytest.raises(AppException) as error:
        get_litellm_user_ai(authorization=None, db=None)
    assert error.value.status_code == 401
    assert error.value.payload["code"] == "litellm_key_required"

    user_ai = get_litellm_user_ai(authorization="Bearer personal-key", db=None)
    assert user_ai.model.api_key == "personal-key"


def test_user_model_list_and_chat_use_the_personal_key_gateway(client):
    http, model, _ = client
    models = http.get(f"{API}/litellm/models", headers={"Authorization": "Bearer user-key"})
    assert models.status_code == 200 and models.headers["cache-control"] == "no-store"
    assert models.json()["models"] == [{"id": MODEL, "label": MODEL}]

    chat = http.post(
        f"{API}/litellm/chat",
        headers={"Authorization": "Bearer user-key"},
        json={"model": MODEL, "messages": [{"role": "user", "content": "hello"}]},
    )
    assert chat.status_code == 200 and chat.json()["text"] == "Hello from LiteLLM"
    assert model.calls[0]["model"] == MODEL


def test_admin_issues_a_scoped_key_once_and_rejects_unlisted_models(client):
    http, _, admin = client
    headers = {"X-Admin-Key": ADMIN_KEY}
    issued = http.post(f"{API}/litellm/admin/keys", headers=headers, json={
        "alias": "dev-team-01", "models": [MODEL], "duration": "7d", "maxBudget": 10,
    })
    assert issued.status_code == 201 and issued.headers["cache-control"] == "no-store"
    assert issued.json()["key"] == "sk-one-time"
    assert admin.generated == ("key/generate", {
        "key_alias": "dev-team-01", "models": [MODEL], "duration": "7d", "max_budget": 10,
    })

    denied = http.post(f"{API}/litellm/admin/keys", headers=headers, json={
        "alias": "bad", "models": ["not-configured"],
    })
    assert denied.status_code == 400 and denied.json()["data"]["code"] == "litellm_model_invalid"
    invalid = http.post(f"{API}/litellm/admin/keys", headers=headers, json={
        "alias": "duplicate", "models": [MODEL, MODEL],
    })
    assert invalid.status_code == 422
    unauthenticated = http.get(f"{API}/litellm/admin/models")
    assert unauthenticated.status_code == 403


def test_mcp_streamable_http_initializes_lists_and_calls_chat(client):
    http, model, _ = client
    initialized = _mcp(http, "initialize")
    assert initialized.status_code == 200
    assert initialized.json()["result"]["protocolVersion"] == "2025-06-18"

    listed = _mcp(http, "tools/list")
    assert [tool["name"] for tool in listed.json()["result"]["tools"]] == ["list_models", "chat"]
    models = _mcp(http, "tools/call", {"name": "list_models", "arguments": {}})
    assert MODEL in models.json()["result"]["structuredContent"]["models"][0]["id"]

    answer = _mcp(http, "tools/call", {
        "name": "chat", "arguments": {"model": MODEL, "prompt": "hello"},
    })
    assert answer.status_code == 200
    assert answer.json()["result"]["structuredContent"]["text"] == "Hello from LiteLLM"
    assert model.calls[-1]["model"] == MODEL

    denied = _mcp(http, "tools/call", {
        "name": "chat", "arguments": {"model": "not-allowed", "prompt": "hello"},
    })
    assert denied.json()["error"]["code"] == -32000


def test_mcp_validates_accept_origin_and_body_size(client):
    http, _, _ = client
    missing_accept = http.post(f"{API}/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "ping"})
    assert missing_accept.status_code == 406

    blocked_origin = _mcp(http, "ping", headers={"Origin": "https://attacker.example"})
    assert blocked_origin.status_code == 403

    too_large = http.post(
        f"{API}/mcp",
        content=b"x" * 128_001,
        headers={
            "Accept": "application/json, text/event-stream",
            "Content-Type": "application/json",
        },
    )
    assert too_large.status_code == 413
    assert http.get(f"{API}/mcp").status_code == 405


def test_mcp_notification_returns_accepted_without_response(client):
    http, _, _ = client
    response = _mcp(http, "notifications/initialized", request_id=None)
    assert response.status_code == 202 and response.content == b""
