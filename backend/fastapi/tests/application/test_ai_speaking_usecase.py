"""Feedback on a recorded OPIc answer: what the model hears, and what comes back."""

from __future__ import annotations

import asyncio
import base64
import json

import pytest

from src.application.config.config import settings
from src.application.exceptions.exceptions import AppException, BadGatewayError, BadRequestError
from src.application.usecases import ai_speaking_usecase
from src.application.usecases.ai_speaking_usecase import AiSpeakingUseCase
from src.application.usecases.ai_usecase import AiUseCase
from src.domain.models.ai_domain import AiCaller
from tests.support.fake_ai import FakeModel, FakeStore

ADMIN = AiCaller(ip="1.2.3.4", admin=True)
WAV = b"RIFF" + b"\x00" * 2000
FEEDBACK = {
    "transcript": " I live in Hanoi with my family. ", "level": "IM2",
    "scores": {"fluency": 4, "grammar": 3, "vocabulary": 9, "pronunciation": 0, "task": 4},
    "summary": "Trôi chảy, còn lỗi thì.", "strengths": ["Ý rõ", "", 3],
    "fixes": [{"said": "I go there yesterday", "better": "I went there yesterday", "why": "quá khứ"},
              {"said": "", "better": "x"}, "không phải object"],
    "tips": ["Luyện thì quá khứ"], "better_answer": "I live in Hanoi...",
}


@pytest.fixture
def speak(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_URL", "https://gemini.test/v1beta/models/gemini-2.5-flash:generateContent")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "k")
    monkeypatch.setattr(settings, "AI_ENABLED", True)
    monkeypatch.setattr(settings, "AI_ACCESS", "admin")

    def make(answer=FEEDBACK):
        store, model = FakeStore(), FakeModel([json.dumps(answer)])
        return AiSpeakingUseCase(AiUseCase(store, model)), store, model
    return make


def _ask(uc, caller=ADMIN, **kw):
    args = {"question": "Tell me about where you live.", "question_vi": "Kể về nơi bạn sống", "kind": "mô tả",
            "audio": base64.b64encode(WAV).decode(), "seconds": 75, **kw}
    return asyncio.run(uc.opic(caller, **args))


def test_the_model_hears_the_audio_and_the_answer_is_cleaned(speak):
    uc, store, model = speak()
    out = _ask(uc, script="My home is in Hanoi.")
    parts = model.calls[0]["contents"][0]["parts"]
    assert parts[1] == {"inlineData": {"mimeType": "audio/wav", "data": base64.b64encode(WAV).decode()}}
    assert "Tell me about where you live." in parts[0]["text"] and "75 giây" in parts[0]["text"]
    assert "My home is in Hanoi." in parts[0]["text"] and "CHẤM theo những gì thật sự nghe được" in parts[0]["text"]
    assert out["level"] == "IM2" and out["transcript"] == "I live in Hanoi with my family."
    assert out["scores"] == {"fluency": 4, "grammar": 3, "vocabulary": 5, "pronunciation": 1, "task": 4}
    assert out["strengths"] == ["Ý rõ"] and len(out["fixes"]) == 1 and out["cached"] is False
    assert model.calls[0]["config"]["responseSchema"] == ai_speaking_usecase.FEEDBACK_SCHEMA
    assert store.records[0][0] == "opic"


def test_the_same_recording_twice_costs_one_call(speak):
    uc, _, model = speak()
    _ask(uc)
    assert _ask(uc)["cached"] is True and len(model.calls) == 1
    _ask(uc, audio=base64.b64encode(WAV + b"\x01").decode())
    assert len(model.calls) == 2


@pytest.mark.parametrize("kw", [{"question": "  "}, {"mime": "video/mp4"}, {"audio": "không phải base64"},
                                {"audio": base64.b64encode(b"RIFF").decode()}])
def test_bad_input_is_refused_before_any_call(speak, kw):
    uc, _, model = speak()
    with pytest.raises(BadRequestError):
        _ask(uc, **kw)
    assert model.calls == []


def test_a_recording_too_long_is_refused(speak, monkeypatch):
    uc, _, model = speak()
    monkeypatch.setattr(ai_speaking_usecase, "AUDIO_BYTES", 1500)
    with pytest.raises(BadRequestError):
        _ask(uc)
    assert model.calls == []


def test_an_answer_without_a_valid_level_is_a_bad_gateway(speak):
    uc, store, _ = speak({**FEEDBACK, "level": "C2"})
    with pytest.raises(BadGatewayError):
        _ask(uc)
    assert store.cache == {}


def test_the_access_rules_apply(speak):
    uc, _, model = speak()
    with pytest.raises(AppException) as exc:
        _ask(uc, AiCaller(ip="9.9.9.9"))
    assert exc.value.payload["code"] == "ai_admin_only" and model.calls == []
