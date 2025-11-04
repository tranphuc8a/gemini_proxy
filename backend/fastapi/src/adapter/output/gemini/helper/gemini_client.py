from typing import Any, Dict, Optional, AsyncIterator
from httpx import AsyncClient, HTTPStatusError, RequestError
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from src.application.config.config import settings
import asyncio
import json


class GeminiClientError(RuntimeError):
    pass


class GeminiClient:
    """Async HTTP client for calling Gemini-like LLM endpoints.

    Uses AsyncClient under the hood and retries transient network errors.
    """
    def __init__(
        self,
        url: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout: Optional[int] = None,
    ):
        self.url = url or settings.GEMINI_URL
        self.api_key = api_key or settings.GEMINI_API_KEY or ""
        self.timeout = timeout or settings.GEMINI_TIMEOUT_SECONDS
        self.client: AsyncClient = AsyncClient(timeout=self.timeout)
        self.headers: Dict[str, str] = {
            "Content-Type": "application/json",
            "x-goog-api-key": self.api_key
        }
    
    async def stop(self) -> None:
        if self.client is not None:
            await self.client.aclose()

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=10),
           retry=retry_if_exception_type(RequestError))
    async def _post(self, url: str, json: Dict[str, Any], headers: Dict[str, str]) -> Dict[str, Any]:
        resp = await self.client.post(url, json=json, headers=headers)
        resp.raise_for_status()
        return resp.json()

    def _get_payload(self, 
                     prompt: Any, 
                     model: Optional[str] = None, 
                     extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        content: Any = prompt if isinstance(prompt, list) else [{"role": "user", "parts": [{"text": prompt}]}]
        payload: Dict[str, Any] = {"contents": content}
        if model:
            payload["model"] = model
        if extra:
            payload.update(extra)
        return payload

    async def generate(self, 
                       prompt: Any, 
                       model: Optional[str] = None, 
                       extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if not self.url:
            raise GeminiClientError("GEMINI_URL is not configured")
        payload: Dict[str, Any] = self._get_payload(prompt, model, extra)
        
        try:
            return await self._post(self.url, payload, self.headers)
        except RequestError as exc:
            raise GeminiClientError(f"Request error while calling Gemini API: {exc}") from exc
        except HTTPStatusError as exc:
            body = exc.response.text if exc.response is not None else ""
            status = exc.response.status_code if exc.response is not None else "?"
            if status == 401:
                # More actionable error message for auth failures when using API keys
                hint = (
                    "Request had invalid authentication credentials.\n"
                    "Set GEMINI_API_KEY to a valid API key and ensure the endpoint accepts API-key-based authentication.\n"
                    "If you previously relied on OAuth/bearer tokens, that flow has been removed — switch to an API key or re-enable OAuth support."
                )
                raise GeminiClientError(f"Gemini API returned HTTP 401: {body}\n{hint}") from exc
            raise GeminiClientError(f"Gemini API returned HTTP {status}: {body}") from exc

    async def stream_generate(self, 
                              prompt: Any, 
                              model: Optional[str] = None, 
                              extra: Optional[Dict[str, Any]] = None) -> AsyncIterator[str]:
        if not self.url:
            raise GeminiClientError("GEMINI_URL is not configured")

        payload: Dict[str, Any] = self._get_payload(prompt, model, extra)
        headers = self.headers.copy()
        headers.setdefault("Accept", "text/event-stream")

        try:
            async with self.client.stream("POST", self.url, json=payload, headers=headers, timeout=self.timeout) as resp:
                resp.raise_for_status()

                event_lines: list[str] = []
                async for line in resp.aiter_lines():
                    if not line:
                        # empty line = end of an SSE event; flush if we have buffered data
                        if not event_lines:
                            continue
                        data = "\n".join(event_lines).strip()
                        event_lines = []
                    else:
                        line = line.strip()
                        if line.startswith("data:"):
                            event_lines.append(line[len("data:"):].lstrip())
                            continue
                        # not an SSE "data:" line — treat the line itself as a unit
                        data = line

                    if not data:
                        continue

                    # termination sentinel used by many streaming APIs
                    if data == "[DONE]":
                        return

                    # Try to parse JSON payloads, then extract text parts if present
                    try:
                        obj = json.loads(data)
                    except Exception:
                        # not JSON — yield raw chunk
                        yield data
                        continue

                    # try common Gemini-like shapes: top-level "candidates" -> candidate.content.parts[].text
                    candidates = obj.get("candidates") or []
                    emitted = False
                    for cand in candidates:
                        content = cand.get("content", {}) if isinstance(cand, dict) else {}
                        parts = content.get("parts", []) if isinstance(content, dict) else []
                        for part in parts:
                            if not isinstance(part, dict):
                                continue
                            text = part.get("text")
                            if text:
                                emitted = True
                                yield text

                    # fallback: sometimes text may be at top-level fields like "text" or "message"
                    if not emitted:
                        fallback_text = None
                        if isinstance(obj, dict):
                            for k in ("text", "message", "content"):
                                v = obj.get(k)
                                if isinstance(v, str) and v:
                                    fallback_text = v
                                    break
                        if fallback_text:
                            yield fallback_text

        except RequestError as exc:
            raise GeminiClientError(f"Request error while streaming from Gemini API: {exc}") from exc
        except HTTPStatusError as exc:
            body = exc.response.text if exc.response is not None else ""
            status = exc.response.status_code if exc.response is not None else "?"
            if status == 401:
                hint = (
                    "Request had invalid authentication credentials.\n"
                    "Set GEMINI_API_KEY to a valid API key and ensure the endpoint accepts API-key-based authentication.\n"
                    "If you previously relied on OAuth/bearer tokens, that flow has been removed — switch to an API key or re-enable OAuth support."
                )
                raise GeminiClientError(f"Gemini API returned HTTP 401: {body}\n{hint}") 
            raise GeminiClientError(f"Gemini API returned HTTP {status}: {body}")

