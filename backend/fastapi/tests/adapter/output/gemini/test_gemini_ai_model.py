"""The AI features' single-shot Gemini call: request shape and answer parsing."""

import asyncio
import json

import httpx
import pytest
import respx

from src.adapter.output.gemini.service.gemini_ai_model import GeminiAiModel, parse_completion
from src.application.config.config import settings
from src.application.exceptions.exceptions import AppException

URL = "https://gemini.test/v1beta/models/gemini-2.5-flash:generateContent"


def test_parse_joins_text_skips_thoughts_and_counts_them_as_output():
    raw = {
        "candidates": [{"content": {"parts": [{"text": "nghĩ…", "thought": True}, {"text": "Xin "}, {"text": "chào"}]},
                        "finishReason": "STOP"}],
        "usageMetadata": {"promptTokenCount": 12, "candidatesTokenCount": 3, "thoughtsTokenCount": 20},
    }
    c = parse_completion(raw)
    assert c.text == "Xin chào" and c.prompt_tokens == 12 and c.output_tokens == 23 and c.finish_reason == "STOP"


def test_a_blocked_prompt_is_a_422_with_the_reason():
    with pytest.raises(AppException) as exc:
        parse_completion({"promptFeedback": {"blockReason": "SAFETY"}})
    assert exc.value.status_code == 422 and exc.value.payload == {"code": "ai_blocked", "reason": "SAFETY"}
    with pytest.raises(AppException) as exc:
        parse_completion({"candidates": []})
    assert exc.value.status_code == 502


@respx.mock
def test_complete_sends_system_config_and_the_chosen_model(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_URL", URL)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "secret-key")
    route = respx.post("https://gemini.test/v1beta/models/gemini-2.5-pro:generateContent").mock(
        return_value=httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": "ok"}]}}],
                                               "usageMetadata": {"promptTokenCount": 5, "candidatesTokenCount": 1}}))
    turns = [{"role": "user", "parts": [{"text": "hỏi"}, {"inlineData": {"mimeType": "audio/webm", "data": "AAAA"}}]}]
    c = asyncio.run(GeminiAiModel().complete(model="gemini-2.5-pro", contents=turns, system="Bạn là gia sư",
                                             generation_config={"temperature": 0.2}))
    assert c.text == "ok" and c.prompt_tokens == 5
    sent = json.loads(route.calls.last.request.content)
    assert sent["contents"] == turns
    assert sent["systemInstruction"] == {"parts": [{"text": "Bạn là gia sư"}]}
    assert sent["generationConfig"] == {"temperature": 0.2}
    assert route.calls.last.request.headers["x-goog-api-key"] == "secret-key"


@respx.mock
def test_an_upstream_error_is_a_502(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_URL", URL)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "k")
    respx.post(URL).mock(return_value=httpx.Response(429, json={"error": {"message": "quota"}}))
    with pytest.raises(AppException) as exc:
        asyncio.run(GeminiAiModel().complete(model="gemini-2.5-flash", contents=[]))
    assert exc.value.status_code == 502 and "429" in exc.value.message
