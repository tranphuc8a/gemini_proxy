import asyncio
import json

import httpx
import respx
import pytest

from src.adapter.factory.ai_factory import get_ai_usecase
from src.adapter.factory import service_factory
from src.adapter.factory.service_factory import ServiceFactory
from src.adapter.output.litellm.litellm_adapter import LiteLLMAiModel, LiteLLMChatService
from src.application.config.config import settings
from src.application.exceptions.exceptions import AppException


@respx.mock
def test_ai_adapter_authenticates_translates_request_and_reads_usage(monkeypatch):
    monkeypatch.setattr(settings, "LITELLM_API_BASE", "https://litellm.test")
    monkeypatch.setattr(settings, "LITELLM_MASTER_KEY", "proxy-secret")
    route = respx.post("https://litellm.test/v1/chat/completions").mock(
        return_value=httpx.Response(200, json={
            "choices": [{"message": {"content": "ok"}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 9, "completion_tokens": 4},
        }))

    completion = asyncio.run(LiteLLMAiModel().complete(
        model="hive-deepseek-v4.1-flash-1017",
        contents=[{"role": "user", "parts": [{"text": "xin chao"}]}],
        system="Ban la tro ly",
        generation_config={
            "temperature": 0.2,
            "maxOutputTokens": 256,
            "responseMimeType": "application/json",
            "responseSchema": {"type": "OBJECT", "properties": {"answer": {"type": "STRING"}}},
            "thinkingConfig": {"thinkingBudget": 0},
        },
    ))

    assert completion.text == "ok"
    assert (completion.prompt_tokens, completion.output_tokens, completion.finish_reason) == (9, 4, "STOP")
    request = route.calls.last.request
    assert request.headers["Authorization"] == "Bearer proxy-secret"
    payload = json.loads(request.content)
    assert payload["model"] == "hive-deepseek-v4.1-flash-1017"
    assert payload["messages"] == [
        {"role": "system", "content": "Ban la tro ly"},
        {"role": "user", "content": "xin chao"},
    ]
    assert payload["max_tokens"] == 256 and payload["temperature"] == 0.2
    assert payload["response_format"]["json_schema"]["schema"]["type"] == "object"
    assert "thinkingConfig" not in payload


@respx.mock
def test_models_endpoint_uses_key_and_v1_prefix(monkeypatch):
    monkeypatch.setattr(settings, "LITELLM_API_BASE", "https://litellm.test/v1/")
    monkeypatch.setattr(settings, "LITELLM_MASTER_KEY", "proxy-secret")
    route = respx.get("https://litellm.test/v1/models").mock(
        return_value=httpx.Response(200, json={"data": [{"id": "hive-deepseek-v4.1-flash-1017"}]}))

    models = asyncio.run(LiteLLMAiModel().list_models())

    assert models == [{"id": "hive-deepseek-v4.1-flash-1017", "label": "hive-deepseek-v4.1-flash-1017"}]
    assert route.calls.last.request.headers["Authorization"] == "Bearer proxy-secret"


@pytest.mark.parametrize("status_code", [401, 403])
@respx.mock
def test_user_virtual_key_is_forwarded_and_rejection_status_is_preserved(monkeypatch, status_code):
    monkeypatch.setattr(settings, "LITELLM_API_BASE", "https://litellm.test/v1")
    monkeypatch.setattr(settings, "LITELLM_MASTER_KEY", "proxy-secret")
    route = respx.get("https://litellm.test/v1/models").mock(
        return_value=httpx.Response(status_code, json={"error": "not allowed"}))

    with pytest.raises(AppException) as error:
        asyncio.run(LiteLLMAiModel(api_key="personal-key").list_models())

    assert error.value.status_code == status_code
    assert error.value.payload["code"] == "litellm_key_rejected"
    assert route.calls.last.request.headers["Authorization"].endswith("personal-key")


@pytest.mark.parametrize("operation", ["generate", "stream"])
@pytest.mark.parametrize("status_code", [401, 403])
@respx.mock
def test_chat_service_preserves_upstream_auth_errors(monkeypatch, operation, status_code):
    monkeypatch.setattr(settings, "LITELLM_API_BASE", "https://litellm.test/v1")
    monkeypatch.setattr(settings, "LITELLM_MASTER_KEY", "proxy-secret")
    respx.post("https://litellm.test/v1/chat/completions").mock(
        return_value=httpx.Response(status_code, json={"error": "not allowed"}))

    async def invoke():
        service = LiteLLMChatService()
        if operation == "generate":
            await service.generate("model-alias", [])
        else:
            return [text async for text in service.stream_generate("model-alias", [])]

    with pytest.raises(AppException) as error:
        asyncio.run(invoke())
    assert error.value.status_code == status_code
    assert error.value.payload["code"] == "litellm_key_rejected"


@respx.mock
def test_chat_service_streams_openai_sse_deltas(monkeypatch):
    monkeypatch.setattr(settings, "LITELLM_API_BASE", "https://litellm.test/v1")
    monkeypatch.setattr(settings, "LITELLM_MASTER_KEY", "proxy-secret")
    respx.post("https://litellm.test/v1/chat/completions").mock(
        return_value=httpx.Response(200, content=(
            b'data: {"choices":[{"delta":{"content":"Xin "}}]}\n\n'
            b'data: {"choices":[{"delta":{"content":"chao"}}]}\n\n'
            b"data: [DONE]\n\n"
        )))

    async def read_stream():
        return [text async for text in LiteLLMChatService().stream_generate("model-alias", [])]

    assert asyncio.run(read_stream()) == ["Xin ", "chao"]


def test_factories_route_ai_features_and_chat_through_litellm(monkeypatch):
    monkeypatch.setattr(settings, "LITELLM_API_BASE", "http://litellm.test/v1")
    ai = get_ai_usecase(db=None)
    assert isinstance(ai.model, LiteLLMAiModel)

    monkeypatch.setattr(service_factory, "_make_repos_and_ports", lambda db: (None, None, None, None))
    chat = ServiceFactory.get_gemini_input_port(db=None)
    assert isinstance(chat.gemini_output_port, LiteLLMChatService)
