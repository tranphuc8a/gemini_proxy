"""One stateless answer from a chosen model (the chat's "compare two models")."""

from __future__ import annotations

import asyncio

import pytest

from src.application.config.config import settings
from src.application.exceptions.exceptions import AppException, BadGatewayError, BadRequestError
from src.application.usecases.ai_chat_usecase import AiChatUseCase
from src.application.usecases.ai_usecase import AiUseCase
from src.domain.models.ai_domain import AiCaller
from tests.support.fake_ai import FakeModel, FakeStore

ADMIN = AiCaller(ip="1.2.3.4", admin=True)


@pytest.fixture
def chat(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_URL", "https://gemini.test/v1beta/models/gemini-2.5-flash:generateContent")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "k")
    monkeypatch.setattr(settings, "AI_ENABLED", True)
    monkeypatch.setattr(settings, "AI_ACCESS", "admin")
    monkeypatch.setattr(settings, "AI_MODEL", "gemini-2.5-flash")

    def make(answer="**Xin chào**"):
        store, model = FakeStore(), FakeModel([answer])
        return AiChatUseCase(AiUseCase(store, model)), store, model
    return make


def test_the_chosen_model_answers_and_its_own_config_is_used(chat):
    uc, store, model = chat()
    out = asyncio.run(uc.compare(ADMIN, prompt="  chào  ", model="gemini-2.5-pro"))
    assert model.calls[0]["model"] == "gemini-2.5-pro" and model.calls[0]["contents"][0]["parts"][0]["text"] == "chào"
    assert "thinkingConfig" not in model.calls[0]["config"]          # Pro cannot turn thinking off
    assert out["text"] == "**Xin chào**" and out["model"] == "gemini-2.5-pro" and out["ms"] >= 0
    assert out["promptTokens"] == 11 and out["outputTokens"] == 5 and store.records[0][0] == "compare"
    asyncio.run(uc.compare(ADMIN, prompt="chào", model="gemini-2.5-flash-lite"))
    assert model.calls[1]["config"]["thinkingConfig"] == {"thinkingBudget": 0}
    assert len(model.calls) == 2                                        # never cached: a second opinion is the point


def test_unknown_models_empty_prompts_and_empty_answers_are_refused(chat):
    uc, _, model = chat("   ")
    with pytest.raises(BadRequestError):
        asyncio.run(uc.compare(ADMIN, prompt="hi", model="gpt-5"))
    with pytest.raises(BadRequestError):
        asyncio.run(uc.compare(ADMIN, prompt=" ", model="gemini-2.5-pro"))
    assert model.calls == []
    with pytest.raises(BadGatewayError):
        asyncio.run(uc.compare(ADMIN, prompt="hi", model="gemini-2.5-pro"))


def test_comparing_follows_the_ai_access_rules(chat):
    uc, _, model = chat()
    with pytest.raises(AppException) as exc:
        asyncio.run(uc.compare(AiCaller(ip="9.9.9.9"), prompt="hi", model="gemini-2.5-pro"))
    assert exc.value.status_code == 403 and model.calls == []
