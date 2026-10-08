"""The AI features' model: one Gemini `generateContent` call per request.

Unlike the chat (`gemini_service.py`), a feature sends its own turns — text,
and for some features audio or a PDF as inline data — with a system
instruction and a generation config (JSON output, temperature, length), and it
needs the token counts back: the AI guard books them.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from src.adapter.output.gemini.helper.gemini_client import GeminiClient, GeminiClientError
from src.application.exceptions.exceptions import AppException, BadGatewayError
from src.application.ports.output.ai_output_port import AiModelOutputPort
from src.domain.models.ai_domain import AiCompletion


def parse_completion(raw: Any) -> AiCompletion:
    """The text and the token counts of a `generateContent` response.

    Thought parts (a thinking model's reasoning) are not part of the answer but
    are billed as output, so they count in `output_tokens`.
    """
    if not isinstance(raw, dict):
        raise BadGatewayError("AI trả về dữ liệu không đọc được")
    candidates = raw.get("candidates") or []
    if not candidates:
        reason = (raw.get("promptFeedback") or {}).get("blockReason")
        if reason:
            raise AppException(message=f"AI từ chối yêu cầu này ({reason})", status_code=422, code="ai_blocked",
                               payload={"code": "ai_blocked", "reason": reason})
        raise BadGatewayError("AI không trả lời")
    first = candidates[0] or {}
    parts = ((first.get("content") or {}).get("parts")) or []
    text = "".join(str(p.get("text") or "") for p in parts if isinstance(p, dict) and not p.get("thought"))
    usage = raw.get("usageMetadata") or {}
    output = int(usage.get("candidatesTokenCount") or 0) + int(usage.get("thoughtsTokenCount") or 0)
    return AiCompletion(text=text, prompt_tokens=int(usage.get("promptTokenCount") or 0), output_tokens=output,
                        finish_reason=str(first.get("finishReason") or ""))


class GeminiAiModel(AiModelOutputPort):
    async def complete(self, *, model: str, contents: List[Dict[str, Any]], system: Optional[str] = None,
                       generation_config: Optional[Dict[str, Any]] = None) -> AiCompletion:
        extra: Dict[str, Any] = {}
        if system:
            extra["systemInstruction"] = {"parts": [{"text": system}]}
        if generation_config:
            extra["generationConfig"] = generation_config
        # One client per call: an httpx client is bound to the event loop that
        # opened it, and requests (and tests) do not share a loop.
        client = GeminiClient()
        try:
            try:
                raw = await client.generate(contents, model=model, extra=extra)
            except GeminiClientError as exc:
                # A model that refuses this thinking switch answers HTTP 400; ask once more without it
                # rather than failing the feature (families differ — see ai_models.thinking_config).
                thinking = (generation_config or {}).get("thinkingConfig")
                if not thinking or "HTTP 400" not in str(exc):
                    raise
                retry = dict(extra, generationConfig={k: v for k, v in generation_config.items() if k != "thinkingConfig"})
                raw = await client.generate(contents, model=model, extra=retry)
        except GeminiClientError as exc:
            raise BadGatewayError(f"Lỗi khi gọi AI: {exc}") from exc
        finally:
            await client.stop()
        return parse_completion(raw)

    async def list_models(self) -> List[Dict[str, Any]]:
        client = GeminiClient()
        try:
            raw = await client.list_models()
        finally:
            await client.stop()
        out = []
        for m in raw:
            if "generateContent" not in (m.get("supportedGenerationMethods") or []):
                continue
            mid = str(m.get("name") or "").split("/", 1)[-1]
            if mid:
                out.append({"id": mid, "label": str(m.get("displayName") or mid)})
        return out
