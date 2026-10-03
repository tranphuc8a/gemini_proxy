"""The one door to the model: access, limits, the daily budget, the books, the cache.

The ports are faked here; the database side of the budget (one conditional
UPDATE shared by every instance) is tested against SQLite in
tests/adapter/output/mysql/test_ai_repository.py.
"""

from __future__ import annotations

import asyncio

import pytest

from src.application.config.config import settings
from src.application.exceptions.exceptions import AppException
from src.application.usecases import ai_usecase
from src.application.usecases.ai_usecase import AiUseCase, generation_config, parse_json, text_turn
from src.application.utils import admin_session
from src.domain.models.ai_domain import AiCaller
from tests.support.fake_ai import FakeModel, FakeStore


ANON = AiCaller(ip="1.2.3.4")
ADMIN = AiCaller(ip="1.2.3.4", admin=True)


@pytest.fixture
def ai(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_URL", "https://gemini.test/v1beta/models/gemini-2.5-flash:generateContent")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "k")
    monkeypatch.setattr(settings, "AI_ENABLED", True)
    monkeypatch.setattr(settings, "AI_ACCESS", "public")
    monkeypatch.setattr(settings, "AI_ACCESS_CODE", "")
    store, model = FakeStore(), FakeModel()
    return AiUseCase(store, model), store, model


def _ask(uc: AiUseCase, caller=ANON, **kw):
    return asyncio.run(uc.ask(caller, kw.pop("feature", "tutor"), contents=[text_turn("hỏi")], **kw))


def _code(exc: pytest.ExceptionInfo) -> str:
    return exc.value.payload["code"]


# ------------------------------------------------------------------- access

def test_admin_only_is_the_default_and_a_typo_does_not_open_the_door(ai, monkeypatch):
    uc, _, model = ai
    for mode in ("admin", "", "Public!", "everyone"):
        monkeypatch.setattr(settings, "AI_ACCESS", mode)
        with pytest.raises(AppException) as exc:
            _ask(uc)
        assert exc.value.status_code == 403 and _code(exc) == "ai_admin_only"
    assert model.calls == [], "a refused caller costs nothing"
    assert _ask(uc, ADMIN)[0] == "một câu trả lời"


def test_code_mode_needs_the_code_token(ai, monkeypatch):
    uc, _, _ = ai
    monkeypatch.setattr(settings, "AI_ACCESS", "code")
    with pytest.raises(AppException) as exc:
        _ask(uc)
    assert _code(exc) == "ai_code_required"
    assert _ask(uc, AiCaller(ip="1.2.3.4", code=True))[0]
    assert _ask(uc, ADMIN)[0], "administrators are always in"


def test_status_tells_a_page_what_would_let_the_caller_in(ai, monkeypatch):
    monkeypatch.setattr(settings, "AI_ACCESS", "code")
    s = AiUseCase.status(ANON)
    assert s["enabled"] and s["access"] == "code" and s["allowed"] is False and s["needs"] == "code"
    monkeypatch.setattr(settings, "AI_ACCESS", "admin")
    assert AiUseCase.status(ANON)["needs"] == "admin"
    assert AiUseCase.status(ADMIN)["allowed"] is True
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    assert AiUseCase.status(ADMIN)["enabled"] is False


# ------------------------------------------------------------ switch, limits

def test_the_kill_switch_stops_everything(ai, monkeypatch):
    uc, _, model = ai
    monkeypatch.setattr(settings, "AI_ENABLED", False)
    with pytest.raises(AppException) as exc:
        _ask(uc, ADMIN)
    assert exc.value.status_code == 503 and _code(exc) == "ai_disabled" and model.calls == []
    with pytest.raises(AppException):
        asyncio.run(uc.admit(ANON, "chat"))


def test_an_unconfigured_server_says_so_before_spending(ai, monkeypatch):
    uc, store, _ = ai
    monkeypatch.setattr(settings, "GEMINI_URL", None)
    with pytest.raises(AppException) as exc:
        _ask(uc, ADMIN)
    assert exc.value.status_code == 503 and _code(exc) == "ai_unconfigured" and store.reserved == 0


def test_per_address_rate_limit_with_retry_after_and_admins_exempt(ai, monkeypatch):
    uc, _, _ = ai
    monkeypatch.setattr(settings, "AI_RATE_PER_MINUTE", 2)
    ai_usecase.reset_limits()
    _ask(uc)
    _ask(uc)
    with pytest.raises(AppException) as exc:
        _ask(uc)
    assert exc.value.status_code == 429 and _code(exc) == "ai_rate_limited"
    assert int(exc.value.headers["Retry-After"]) > 0
    assert _ask(uc, AiCaller(ip="5.6.7.8"))[0], "another address has its own count"
    for _ in range(3):
        assert _ask(uc, ADMIN)[0]


def test_the_daily_budget_answers_429_until_midnight_utc(ai):
    uc, store, model = ai
    store.max_requests = 2
    _ask(uc)
    _ask(uc)
    with pytest.raises(AppException) as exc:
        _ask(uc, ADMIN)
    assert exc.value.status_code == 429 and _code(exc) == "ai_budget_exhausted"
    assert 0 < int(exc.value.headers["Retry-After"]) <= 86400
    assert len(model.calls) == 2


def test_a_database_outage_skips_the_books_not_the_answer(ai):
    uc, store, model = ai
    store.broken = True
    assert _ask(uc, cache="k1")[0] == "một câu trả lời"
    assert len(model.calls) == 1


# ------------------------------------------------------------- books, cache

def test_every_answer_is_booked_with_its_tokens(ai):
    uc, store, _ = ai
    _, completion = _ask(uc, feature="flashcards")
    assert store.records == [("flashcards", 11, 5)]
    assert completion.prompt_tokens == 11 and not completion.cached


def test_a_cached_answer_skips_the_model_the_budget_and_the_books(ai):
    uc, store, model = ai
    key = ai_usecase.cache_key("flashcards", "demo", "p1/bai-01.md", "rev1")
    first = _ask(uc, cache=key)
    second = _ask(uc, cache=key)
    assert first[0] == second[0] and second[1].cached
    assert len(model.calls) == 1 and store.reserved == 1 and len(store.records) == 1


def test_only_answers_that_parse_are_cached(ai):
    uc, store, model = ai
    model.answers = ["không phải JSON", '{"ok": true}']
    with pytest.raises(AppException) as exc:
        _ask(uc, cache="k", parse=parse_json)
    assert exc.value.status_code == 502 and "k" not in store.cache
    assert _ask(uc, cache="k", parse=parse_json)[0] == {"ok": True}
    assert store.cache["k"] == '{"ok": true}'


def test_a_slow_model_times_out_as_504(ai, monkeypatch):
    uc, _, model = ai
    model.delay = 0.5
    monkeypatch.setattr(settings, "AI_TIMEOUT_SECONDS", 0.05)
    with pytest.raises(AppException) as exc:
        _ask(uc)
    assert exc.value.status_code == 504


def test_usage_reports_budget_and_config(ai):
    uc, _, _ = ai
    _ask(uc)
    u = asyncio.run(uc.usage(7))
    assert u["budget"]["requestsUsed"] == 1 and u["budget"]["tokensUsed"] == 10
    assert u["config"]["access"] == "public" and u["config"]["codeSet"] is False


# ---------------------------------------------------------------- AI tokens

def test_the_access_code_is_exchanged_for_a_token_and_rotation_revokes_it(ai, monkeypatch):
    monkeypatch.setattr(settings, "AI_ACCESS", "code")
    monkeypatch.setattr(settings, "AI_ACCESS_CODE", "lop-hoc-2026")
    with pytest.raises(AppException) as exc:
        ai_usecase.issue_code_session("sai", "9.9.9.9")
    assert _code(exc) == "ai_code_invalid"
    issued = ai_usecase.issue_code_session(" lop-hoc-2026 ", "9.9.9.9")
    assert ai_usecase.code_session_valid(issued.token)
    assert not ai_usecase.code_session_valid(issued.token + "x")
    monkeypatch.setattr(settings, "AI_ACCESS_CODE", "ma-moi")
    assert not ai_usecase.code_session_valid(issued.token), "a new code revokes every token"
    # A token signed for the course administrator is not an AI token.
    admin_token = admin_session.issue("ma-moi", salt="course-admin", ttl_seconds=600).token
    assert not ai_usecase.code_session_valid(admin_token)


def test_guessing_the_code_is_slowed_down(ai, monkeypatch):
    monkeypatch.setattr(settings, "AI_ACCESS", "code")
    monkeypatch.setattr(settings, "AI_ACCESS_CODE", "dung")
    for _ in range(5):
        with pytest.raises(AppException):
            ai_usecase.issue_code_session("sai", "7.7.7.7")
    with pytest.raises(AppException) as exc:
        ai_usecase.issue_code_session("dung", "7.7.7.7")
    assert exc.value.status_code == 429 and _code(exc) == "too_many_attempts"


def test_no_code_login_outside_code_mode(ai, monkeypatch):
    monkeypatch.setattr(settings, "AI_ACCESS", "public")
    monkeypatch.setattr(settings, "AI_ACCESS_CODE", "dung")
    with pytest.raises(AppException) as exc:
        ai_usecase.issue_code_session("dung", "1.1.1.1")
    assert _code(exc) == "ai_code_disabled"


# ----------------------------------------------------------------- helpers

def test_generation_config_json_mode_and_thinking(monkeypatch):
    monkeypatch.setattr(settings, "AI_MODEL", "gemini-2.5-flash")
    cfg = generation_config(schema={"type": "OBJECT"}, temperature=0.2, max_tokens=900)
    assert cfg["responseMimeType"] == "application/json" and cfg["responseSchema"] == {"type": "OBJECT"}
    assert cfg["thinkingConfig"] == {"thinkingBudget": 0} and cfg["maxOutputTokens"] == 900
    monkeypatch.setattr(settings, "AI_MODEL", "gemini-2.5-pro")
    assert "thinkingConfig" not in generation_config(), "Pro cannot switch thinking off"
    assert "responseMimeType" not in generation_config()


def test_parse_json_tolerates_a_code_fence():
    assert parse_json('```json\n{"a": 1}\n```') == {"a": 1}
    with pytest.raises(ValueError):
        parse_json("nope")


def test_cache_keys_depend_on_inputs_and_model(monkeypatch):
    monkeypatch.setattr(settings, "AI_MODEL", "m1")
    a = ai_usecase.cache_key("x", 1)
    assert a == ai_usecase.cache_key("x", 1) != ai_usecase.cache_key("x", 2)
    monkeypatch.setattr(settings, "AI_MODEL", "m2")
    assert ai_usecase.cache_key("x", 1) != a
