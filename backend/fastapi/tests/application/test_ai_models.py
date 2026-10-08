"""Which models a caller may pick, how each is asked, and the catalog behind it."""

from __future__ import annotations

import asyncio
import json

import pytest

from src.adapter.output.gemini.helper.gemini_client import GeminiClient, GeminiClientError
from src.adapter.output.gemini.service import gemini_ai_model
from src.application.config.config import settings
from src.application.exceptions.exceptions import AppException, BadGatewayError, BadRequestError
from src.application.usecases import ai_models
from src.application.usecases.ai_usecase import AiUseCase, cache_key, generation_config, text_turn
from src.domain.models.ai_domain import AiCaller
from tests.support.fake_ai import FakeModel, FakeStore

ADMIN = AiCaller(ip="1.2.3.4", admin=True)
LEARNER = AiCaller(ip="5.6.7.8", code=True)
#: What the live listing offered on 2026-10-08, text and non-text models mixed.
LIVE = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-preview-tts", "gemini-flash-latest", "gemini-pro-latest",
        "gemini-2.5-flash-lite", "gemini-2.5-flash-image", "gemini-3-flash-preview", "gemini-3.1-pro-preview",
        "gemini-3.1-pro-preview-customtools", "gemini-3.1-flash-lite", "gemini-3-pro-image", "gemini-nano-banana-2.1",
        "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-omni-1.1-flash", "gemini-3.5-transcribe", "gemini-3.8-flash",
        "gemini-3.8-flash-tts", "gemini-robotics-er-2-preview", "gemini-2.5-computer-use-preview-10-2025"]


@pytest.fixture
def ai(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_URL", "https://gemini.test/v1beta/models/gemini-3.5-flash:generateContent")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "k")
    monkeypatch.setattr(settings, "AI_ENABLED", True)
    monkeypatch.setattr(settings, "AI_ACCESS", "code")
    monkeypatch.setattr(settings, "AI_MODEL", "gemini-3.5-flash")
    monkeypatch.setattr(settings, "AI_MODELS", "")

    def make(answers=("một câu trả lời",), models=LIVE):
        store, model = FakeStore(), FakeModel(list(answers), models=None if models is None else list(models))
        return AiUseCase(store, model), store, model
    return make


def run(coro):
    return asyncio.run(coro)


# ---------------------------------------------------------------- the catalog

def test_the_catalog_keeps_text_models_newest_first(ai):
    uc, _, model = ai()
    out = run(uc.models_for(ADMIN))
    ids = [m["id"] for m in out["models"]]
    assert out["source"] == "api" and out["default"] == "gemini-3.5-flash"
    assert ids == ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite",
                   "gemini-3.1-pro-preview", "gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.5-flash-lite",
                   "gemini-2.5-pro", "gemini-flash-latest", "gemini-pro-latest"]
    by = {m["id"]: m for m in out["models"]}
    assert by["gemini-3.5-flash"]["default"] and not by["gemini-3.8-flash"]["default"]
    assert by["gemini-3.1-pro-preview"]["tier"] == "pro" and by["gemini-3.1-pro-preview"]["preview"]
    assert by["gemini-3.5-flash-lite"]["tier"] == "flash-lite" and by["gemini-flash-latest"]["alias"]
    run(uc.models_for(ADMIN))
    assert model.listed == 1                                          # cached between requests


def test_pro_models_are_listed_but_only_administrators_may_pick_them(ai):
    uc, _, _ = ai()
    seen = {m["id"]: m for m in run(uc.models_for(LEARNER))["models"]}
    assert seen["gemini-3.1-pro-preview"]["adminOnly"] and not seen["gemini-3.1-pro-preview"]["allowed"]
    assert seen["gemini-3.8-flash"]["allowed"] and not seen["gemini-3.8-flash"]["adminOnly"]
    assert all(m["allowed"] for m in run(uc.models_for(ADMIN))["models"])


def test_a_failed_listing_falls_back_and_the_default_is_always_there(ai, monkeypatch):
    monkeypatch.setattr(settings, "AI_MODEL", "gemini-9-flash")
    uc, _, model = ai(models=None)
    out = run(uc.models_for(ADMIN))
    ids = [m["id"] for m in out["models"]]
    assert out["source"] == "fallback" and ids[0] == "gemini-9-flash" and set(ai_models.FALLBACK) <= set(ids)
    run(uc.models_for(ADMIN))
    assert model.listed == 1                                          # the failure is remembered for a while too


def test_ai_models_pins_the_list_without_asking_google(ai, monkeypatch):
    monkeypatch.setattr(settings, "AI_MODELS", "gemini-3.5-flash-lite, gemini-3.8-flash ,bad id!")
    uc, _, model = ai()
    out = run(uc.models_for(LEARNER))
    assert out["source"] == "config" and [m["id"] for m in out["models"]] == ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.8-flash"]
    assert model.listed == 0


def test_the_listing_expires(ai, monkeypatch):
    uc, _, model = ai()
    run(uc.models_for(ADMIN))
    clock = ai_models.time.time() + settings.AI_MODELS_TTL_SECONDS + 1
    monkeypatch.setattr(ai_models.time, "time", lambda: clock)
    run(uc.models_for(ADMIN))
    assert model.listed == 2


# ---------------------------------------------------------------- picking a model

def test_resolving_a_model(ai):
    uc, _, _ = ai()
    assert run(uc.resolve_model(LEARNER, None)) == "gemini-3.5-flash"
    assert run(uc.resolve_model(LEARNER, "  ")) == "gemini-3.5-flash"
    assert run(uc.resolve_model(LEARNER, "gemini-3.8-flash")) == "gemini-3.8-flash"
    with pytest.raises(BadRequestError) as unknown:
        run(uc.resolve_model(LEARNER, "gpt-5"))
    assert unknown.value.payload["code"] == "ai_model_unknown" and "gemini-3.8-flash" in unknown.value.payload["models"]
    with pytest.raises(BadRequestError) as bad:
        run(uc.resolve_model(LEARNER, "gemini 3/../x"))
    assert bad.value.payload["code"] == "ai_model_invalid"
    with pytest.raises(AppException) as pro:
        run(uc.resolve_model(LEARNER, "gemini-3.1-pro-preview"))
    assert pro.value.status_code == 403 and pro.value.code == "ai_model_admin_only"
    assert run(uc.resolve_model(ADMIN, "gemini-3.1-pro-preview")) == "gemini-3.1-pro-preview"


def test_the_callers_pick_is_asked_with_its_own_thinking_switch(ai):
    uc, _, model = ai()
    caller = LEARNER.model_copy(update={"model": "gemini-3.5-flash-lite"})
    run(uc.ask(caller, "tutor_summary", contents=[text_turn("x")], config=generation_config(max_tokens=100)))
    call = model.calls[0]
    assert call["model"] == "gemini-3.5-flash-lite"
    assert call["config"]["thinkingConfig"] == {"thinkingLevel": "low"} and call["config"]["maxOutputTokens"] == 100
    run(uc.ask(LEARNER, "tutor_summary", contents=[text_turn("x")], config=generation_config(max_tokens=100)))
    assert model.calls[1]["model"] == "gemini-3.5-flash" and model.calls[1]["config"]["thinkingConfig"] == {"thinkingBudget": 0}


def test_a_feature_that_names_its_model_wins_over_the_header(ai):
    uc, _, model = ai()
    caller = ADMIN.model_copy(update={"model": "gemini-3.8-flash"})
    run(uc.ask(caller, "compare", contents=[text_turn("x")], config=generation_config(), model="gemini-2.5-pro"))
    assert model.calls[0]["model"] == "gemini-2.5-pro" and "thinkingConfig" not in model.calls[0]["config"]


def test_an_unknown_pick_is_refused_before_any_spending(ai):
    uc, store, model = ai()
    with pytest.raises(BadRequestError):
        run(uc.ask(LEARNER.model_copy(update={"model": "gemini-0-nope"}), "tutor_summary", contents=[text_turn("x")]))
    assert model.calls == [] and store.reserved == 0


def test_cached_answers_are_kept_per_model(ai):
    uc, store, model = ai(answers=["từ 3.5", "từ 3.8"])
    key = cache_key("tutor", "lesson-1")
    a, _ = run(uc.ask(LEARNER, "tutor_summary", contents=[text_turn("x")], cache=key))
    b, _ = run(uc.ask(LEARNER.model_copy(update={"model": "gemini-3.8-flash"}), "tutor_summary", contents=[text_turn("x")], cache=key))
    c, completion = run(uc.ask(LEARNER, "tutor_summary", contents=[text_turn("x")], cache=key))
    assert (a, b, c) == ("từ 3.5", "từ 3.8", "từ 3.5") and completion.cached and len(model.calls) == 2
    assert key in store.cache and len(store.cache) == 2               # the default model keeps its old key


# ---------------------------------------------------------------- thinking switches (measured live, 2026-10-08)

@pytest.mark.parametrize("model, expected", [
    ("gemini-2.5-flash", {"thinkingBudget": 0}),
    ("gemini-2.5-flash-lite", {"thinkingBudget": 0}),
    ("gemini-2.5-pro", None),
    ("gemini-3-flash-preview", {"thinkingBudget": 0}),
    ("gemini-3.5-flash", {"thinkingBudget": 0}),
    ("gemini-3.8-flash", {"thinkingBudget": 0}),
    ("gemini-3.5-flash-lite", {"thinkingLevel": "low"}),
    ("gemini-3.1-flash-lite", {"thinkingLevel": "low"}),
    ("gemini-flash-lite-latest", {"thinkingLevel": "low"}),
    ("gemini-flash-latest", {"thinkingBudget": 0}),
    ("gemini-3.1-pro-preview", None),
    ("gemini-pro-latest", None),
])
def test_thinking_switch_per_family(model, expected):
    assert ai_models.thinking_config(model) == expected
    fitted = ai_models.fit_config({"temperature": 0.2, "thinkingConfig": {"thinkingBudget": 0}}, model)
    assert fitted.get("thinkingConfig") == expected and fitted["temperature"] == 0.2
    assert ai_models.fit_config(None, model) is None


def test_text_model_filter():
    assert ai_models.is_text_model("gemini-3.8-flash") and ai_models.is_text_model("gemini-flash-latest")
    for other in ("gemini-3.8-flash-tts", "gemini-3-pro-image", "gemini-nano-banana-2.1", "gemini-omni-1.1-flash",
                  "gemini-3.5-transcribe", "gemini-robotics-er-2-preview", "gemini-3.1-pro-preview-customtools", "text-embedding-004"):
        assert not ai_models.is_text_model(other), other


# ---------------------------------------------------------------- the Gemini adapter

class _Client:
    """Stands in for GeminiClient inside GeminiAiModel."""
    calls = []
    refuse_thinking = True

    def __init__(self, *a, **k):
        pass

    async def generate(self, contents, model=None, extra=None):
        _Client.calls.append(json.loads(json.dumps(extra)))
        if _Client.refuse_thinking and "thinkingConfig" in (extra.get("generationConfig") or {}):
            raise GeminiClientError('Gemini API returned HTTP 400: {"error": {"message": "Request contains an invalid argument."}}')
        return {"candidates": [{"content": {"parts": [{"text": "OK"}]}, "finishReason": "STOP"}],
                "usageMetadata": {"promptTokenCount": 3, "candidatesTokenCount": 1}}

    async def list_models(self):
        return [{"name": "models/gemini-3.5-flash", "displayName": "Gemini 3.5 Flash", "supportedGenerationMethods": ["generateContent"]},
                {"name": "models/text-embedding-004", "supportedGenerationMethods": ["embedContent"]}]

    async def stop(self):
        pass


def test_a_model_that_refuses_the_thinking_switch_is_asked_again_without_it(monkeypatch):
    monkeypatch.setattr(gemini_ai_model, "GeminiClient", _Client)
    _Client.calls, _Client.refuse_thinking = [], True
    out = run(gemini_ai_model.GeminiAiModel().complete(model="gemini-3.5-flash-lite", contents=[text_turn("x")],
                                                       generation_config={"temperature": 0, "thinkingConfig": {"thinkingBudget": 0}}))
    assert out.text == "OK" and len(_Client.calls) == 2 and _Client.calls[1]["generationConfig"] == {"temperature": 0}


def test_other_errors_are_not_retried(monkeypatch):
    class Down(_Client):
        async def generate(self, contents, model=None, extra=None):
            _Client.calls.append(extra)
            raise GeminiClientError("Gemini API returned HTTP 429: quota")
    monkeypatch.setattr(gemini_ai_model, "GeminiClient", Down)
    _Client.calls = []
    with pytest.raises(BadGatewayError):
        run(gemini_ai_model.GeminiAiModel().complete(model="gemini-3.5-flash", contents=[text_turn("x")],
                                                     generation_config={"thinkingConfig": {"thinkingBudget": 0}}))
    assert len(_Client.calls) == 1


def test_the_adapter_lists_only_generate_content_models(monkeypatch):
    monkeypatch.setattr(gemini_ai_model, "GeminiClient", _Client)
    # conftest stubs list_models for every test; this one exercises the real method.
    monkeypatch.setattr(gemini_ai_model.GeminiAiModel, "list_models", _REAL_LIST)
    assert run(gemini_ai_model.GeminiAiModel().list_models()) == [{"id": "gemini-3.5-flash", "label": "Gemini 3.5 Flash"}]


_REAL_LIST = gemini_ai_model.GeminiAiModel.__dict__["list_models"]


def test_models_url_comes_from_gemini_url():
    c = GeminiClient(url="https://g.test/v1beta/models/gemini-3.5-flash:generateContent?x=1", api_key="k")
    assert c._models_url() == "https://g.test/v1beta/models"
    other = GeminiClient(url="https://g.test/other", api_key="k")
    assert other._models_url() == ""
    run(c.stop())
    run(other.stop())
