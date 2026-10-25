"""Adapters for a LiteLLM proxy's OpenAI-compatible Chat Completions API."""

from __future__ import annotations

import json
from typing import Any, AsyncIterator, Dict, List, Optional

import httpx

from src.application.config.config import settings
from src.application.exceptions.exceptions import AppException, BadGatewayError
from src.application.ports.output.ai_output_port import AiModelOutputPort
from src.application.ports.output.gemini_output_port import GeminiOutputPort
from src.domain.models.ai_domain import AiCompletion
from src.domain.models.message_domain import MessageDomain


class LiteLLMClientError(RuntimeError):
    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


def _raise_upstream(exc: LiteLLMClientError, operation: str) -> None:
    if exc.status_code in (401, 403):
        raise AppException(message="LiteLLM virtual key không hợp lệ hoặc không được phép",
                           status_code=exc.status_code,
                           code="litellm_key_rejected",
                           payload={"code": "litellm_key_rejected"}) from exc
    raise BadGatewayError(f"{operation}: {exc}") from exc


def _chat_messages(contents: List[Dict[str, Any]], system: Optional[str] = None) -> List[Dict[str, Any]]:
    messages: List[Dict[str, Any]] = []
    if system:
        messages.append({"role": "system", "content": system})

    for turn in contents:
        role = str(turn.get("role") or "user")
        role = "assistant" if role == "model" else role
        parts = (turn.get("parts") or [])
        text = "".join(str(part.get("text") or "") for part in parts
                       if isinstance(part, dict) and "text" in part)
        non_text: List[Dict[str, Any]] = []
        for part in parts:
            if not isinstance(part, dict) or "inlineData" not in part:
                continue
            inline = part["inlineData"] or {}
            mime = str(inline.get("mimeType") or "application/octet-stream")
            data = str(inline.get("data") or "")
            if mime.startswith("image/"):
                non_text.append({"type": "image_url",
                                 "image_url": {"url": f"data:{mime};base64,{data}"}})
            elif mime == "application/pdf":
                non_text.append({"type": "file", "file": {
                    "filename": "document.pdf", "file_data": f"data:{mime};base64,{data}"}})
            elif mime.startswith("audio/"):
                audio_format = "wav" if mime in ("audio/wav", "audio/x-wav") else (
                    "mp3" if mime in ("audio/mpeg", "audio/mp3") else "")
                if not audio_format:
                    raise LiteLLMClientError(f"Unsupported audio format for LiteLLM: {mime}")
                non_text.append({"type": "input_audio",
                                 "input_audio": {"data": data, "format": audio_format}})
            else:
                raise LiteLLMClientError(f"Unsupported inline content type for LiteLLM: {mime}")

        if non_text:
            content: Any = ([{"type": "text", "text": text}] if text else []) + non_text
        else:
            content = text
        messages.append({"role": role, "content": content})
    return messages


def _openai_schema(value: Any) -> Any:
    if isinstance(value, list):
        return [_openai_schema(item) for item in value]
    if not isinstance(value, dict):
        return value
    converted = {key: _openai_schema(item) for key, item in value.items()}
    if isinstance(converted.get("type"), str):
        converted["type"] = converted["type"].lower()
    return converted


def _chat_payload(model: str, messages: List[Dict[str, Any]],
                  generation_config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    payload: Dict[str, Any] = {"model": model, "messages": messages}
    config = generation_config or {}
    if "temperature" in config:
        payload["temperature"] = config["temperature"]
    if "maxOutputTokens" in config:
        payload["max_tokens"] = config["maxOutputTokens"]
    schema = config.get("responseSchema")
    if schema is not None or config.get("responseMimeType") == "application/json":
        if schema is None:
            payload["response_format"] = {"type": "json_object"}
        else:
            payload["response_format"] = {
                "type": "json_schema",
                "json_schema": {
                    "name": "structured_response",
                    "strict": False,
                    "schema": _openai_schema(schema),
                },
            }
    return payload


def _content_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(str(part.get("text") or "") for part in content if isinstance(part, dict))
    return ""


class LiteLLMClient:
    def __init__(self, timeout: float, api_key: Optional[str] = None):
        self.base_url = str(settings.LITELLM_API_BASE or "").strip().rstrip("/")
        self.master_key = str(api_key or settings.LITELLM_MASTER_KEY or "").strip()
        self.timeout = timeout

    @property
    def api_base(self) -> str:
        if not self.base_url:
            raise LiteLLMClientError("LITELLM_API_BASE is not configured")
        return self.base_url if self.base_url.rsplit("/", 1)[-1] == "v1" else f"{self.base_url}/v1"

    @property
    def api_root(self) -> str:
        return self.api_base[:-3] if self.api_base.endswith("/v1") else self.api_base

    def _headers(self) -> Dict[str, str]:
        if not self.master_key:
            raise LiteLLMClientError("LITELLM_MASTER_KEY is not configured")
        return {"Authorization": f"Bearer {self.master_key}", "Content-Type": "application/json"}

    @staticmethod
    def _raise_status(response: httpx.Response) -> None:
        if response.is_error:
            raise LiteLLMClientError(f"LiteLLM proxy returned HTTP {response.status_code}",
                                     status_code=response.status_code)

    async def complete(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(f"{self.api_base}/chat/completions", json=payload,
                                             headers=self._headers())
            self._raise_status(response)
            return response.json()
        except httpx.RequestError as exc:
            raise LiteLLMClientError(f"Could not reach LiteLLM proxy: {exc}") from exc
        except (json.JSONDecodeError, ValueError) as exc:
            raise LiteLLMClientError("LiteLLM proxy returned invalid JSON") from exc

    async def management_request(self, path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(f"{self.api_root}/{path.lstrip('/')}", json=payload,
                                             headers=self._headers())
            self._raise_status(response)
            return response.json()
        except httpx.RequestError as exc:
            raise LiteLLMClientError(f"Could not reach LiteLLM proxy: {exc}") from exc
        except (json.JSONDecodeError, ValueError) as exc:
            raise LiteLLMClientError("LiteLLM proxy returned invalid JSON") from exc

    async def list_models(self) -> List[Dict[str, Any]]:
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(f"{self.api_base}/models", headers=self._headers())
            self._raise_status(response)
            raw = response.json()
        except httpx.RequestError as exc:
            raise LiteLLMClientError(f"Could not list LiteLLM models: {exc}") from exc
        except (json.JSONDecodeError, ValueError) as exc:
            raise LiteLLMClientError("LiteLLM proxy returned invalid model data") from exc
        return [{"id": str(item.get("id") or ""), "label": str(item.get("id") or "")}
                for item in raw.get("data", []) if isinstance(item, dict)]

    async def stream(self, payload: Dict[str, Any]) -> AsyncIterator[str]:
        stream_payload = dict(payload, stream=True)
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(self.timeout, read=None)) as client:
                async with client.stream("POST", f"{self.api_base}/chat/completions",
                                         json=stream_payload, headers=self._headers()) as response:
                    if response.is_error:
                        body = (await response.aread()).decode("utf-8", errors="replace")[:500]
                        raise LiteLLMClientError(
                            f"LiteLLM proxy returned HTTP {response.status_code}"
                            + (f": {body}" if body else ""), status_code=response.status_code)
                    async for line in response.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        raw = line[5:].strip()
                        if raw == "[DONE]":
                            return
                        try:
                            event = json.loads(raw)
                        except json.JSONDecodeError:
                            continue
                        choices = event.get("choices") or []
                        delta = (choices[0].get("delta") or {}) if choices else {}
                        text = _content_text(delta.get("content"))
                        if text:
                            yield text
        except httpx.RequestError as exc:
            raise LiteLLMClientError(f"Could not stream from LiteLLM proxy: {exc}") from exc


class LiteLLMAiModel(AiModelOutputPort):
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key

    async def complete(self, *, model: str, contents: List[Dict[str, Any]], system: Optional[str] = None,
                       generation_config: Optional[Dict[str, Any]] = None) -> AiCompletion:
        client = LiteLLMClient(timeout=float(settings.AI_TIMEOUT_SECONDS), api_key=self.api_key)
        try:
            raw = await client.complete(_chat_payload(
                model, _chat_messages(contents, system), generation_config))
            choices = raw.get("choices") or []
            if not choices:
                raise BadGatewayError("LiteLLM proxy returned no answer")
            choice = choices[0] or {}
            usage = raw.get("usage") or {}
            finish = str(choice.get("finish_reason") or "")
            finish = {"stop": "STOP", "length": "MAX_TOKENS", "content_filter": "SAFETY"}.get(finish, finish)
            return AiCompletion(
                text=_content_text((choice.get("message") or {}).get("content")),
                prompt_tokens=int(usage.get("prompt_tokens") or 0),
                output_tokens=int(usage.get("completion_tokens") or 0),
                finish_reason=finish,
            )
        except LiteLLMClientError as exc:
            _raise_upstream(exc, "Lỗi khi gọi LiteLLM")

    async def list_models(self) -> List[Dict[str, Any]]:
        try:
            return await LiteLLMClient(timeout=float(settings.AI_TIMEOUT_SECONDS),
                                       api_key=self.api_key).list_models()
        except LiteLLMClientError as exc:
            _raise_upstream(exc, "Không thể liệt kê model LiteLLM")


class LiteLLMChatService(GeminiOutputPort):
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key

    async def generate(self, model: str, history: List[MessageDomain]) -> str:
        turns = [{"role": item.role.value if hasattr(item.role, "value") else str(item.role),
                  "parts": [{"text": item.content}]} for item in history]
        client = LiteLLMClient(timeout=float(settings.GEMINI_TIMEOUT_SECONDS), api_key=self.api_key)
        try:
            raw = await client.complete(_chat_payload(model, _chat_messages(turns)))
            choices = raw.get("choices") or []
            if not choices:
                raise BadGatewayError("LiteLLM proxy returned no answer")
            return _content_text((choices[0].get("message") or {}).get("content"))
        except LiteLLMClientError as exc:
            _raise_upstream(exc, "Lỗi khi gọi LiteLLM")

    async def stream_generate(self, model: str, history: List[MessageDomain]) -> AsyncIterator[str]:
        turns = [{"role": item.role.value if hasattr(item.role, "value") else str(item.role),
                  "parts": [{"text": item.content}]} for item in history]
        client = LiteLLMClient(timeout=float(settings.GEMINI_TIMEOUT_SECONDS), api_key=self.api_key)
        try:
            async for text in client.stream(_chat_payload(model, _chat_messages(turns))):
                yield text
        except LiteLLMClientError as exc:
            _raise_upstream(exc, "Lỗi khi gọi LiteLLM")

    async def stop(self) -> None:
        return None

    async def health_check(self) -> bool:
        await LiteLLMClient(timeout=float(settings.AI_TIMEOUT_SECONDS),
                            api_key=self.api_key).list_models()
        return True
