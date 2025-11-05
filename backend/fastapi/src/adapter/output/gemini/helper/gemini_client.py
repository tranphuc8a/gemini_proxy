from typing import Any, Dict, Optional, AsyncIterator
from httpx import AsyncClient, HTTPStatusError, RequestError, Timeout, Limits
import logging
from urllib.parse import urlparse, urlunparse
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from src.application.config.config import settings
from src.domain.enums.enums import ERole
import asyncio
import json
import re


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
        # Enable HTTP/2 when available and set modest connection limits for better throughput.
        # Keep a single shared client to reuse connections.
        self.client: AsyncClient = AsyncClient(
            timeout=self.timeout,
            http2=True,
            limits=Limits(max_connections=100, max_keepalive_connections=20, keepalive_expiry=60.0),
        )
        self.headers: Dict[str, str] = {
            "Content-Type": "application/json",
            # Prefer JSON streaming as returned by Google for streamGenerateContent
            "Accept": "application/json",
            "x-goog-api-key": self.api_key,
        }
    
    async def stop(self) -> None:
        if self.client is not None:
            await self.client.aclose()
            
    async def health_check(self) -> bool:
        """Perform a simple health check by sending a request to the base URL."""
        if not self.url:
            raise GeminiClientError("GEMINI_URL is not configured")
        try:
            resp = await self.client.get(self.url, headers=self.headers)
            resp.raise_for_status()
            return True
        except Exception as exc:
            logging.error(f"GeminiClient health check failed: {exc}")
            return False

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
        content: Any = (
            prompt
            if isinstance(prompt, list)
            else [{"role": ERole.USER.value, "parts": [{"text": prompt}]}]
        )
        payload: Dict[str, Any] = {"contents": content}
        if model:
            payload["model"] = model
        if extra:
            payload.update(extra)
        return payload

    def _apply_model_to_url(self, base_url: str, model: Optional[str]) -> str:
        """Replace the model segment in `.../models/<model>:<method>` with the provided model.

        If model is falsy or the URL doesn't match the expected format, return the original URL.
        """
        if not model:
            return base_url
        try:
            parsed = urlparse(base_url)
            path = parsed.path or ""
            marker = "/models/"
            idx = path.find(marker)
            if idx == -1:
                return base_url
            start = idx + len(marker)
            colon = path.find(":", start)
            if colon == -1:
                return base_url
            # substitute model between start and colon
            new_path = path[:start] + str(model) + path[colon:]
            return urlunparse((parsed.scheme, parsed.netloc, new_path, parsed.params, parsed.query, parsed.fragment))
        except Exception:
            return base_url

    def _to_stream_url(self, base_url: str) -> str:
        """Convert a non-stream generate URL to its streaming variant when applicable.

        Example:
        .../models/gemini-2.5-flash:generateContent?key=... ->
        .../models/gemini-2.5-flash:streamGenerateContent?key=...
        """
        if ":streamGenerateContent" in base_url:
            return base_url
        if ":generateContent" in base_url:
            return base_url.replace(":generateContent", ":streamGenerateContent")
        # If method not present, assume caller already set a streaming-capable URL
        return base_url

    async def generate(self, 
                       prompt: Any, 
                       model: Optional[str] = None, 
                       extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if not self.url:
            raise GeminiClientError("GEMINI_URL is not configured")
        payload: Dict[str, Any] = self._get_payload(prompt, model, extra)
        url_to_use = self._apply_model_to_url(self.url, model)
        
        try:
            return await self._post(url_to_use, payload, self.headers)
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

        try:
            # For long-lived streams, disable read timeout to avoid premature disconnects.
            stream_timeout = Timeout(connect=self.timeout, read=None, write=self.timeout, pool=self.timeout)
            # Apply model override into URL first, then convert to streaming method
            stream_url = self._to_stream_url(self._apply_model_to_url(self.url, model))
            async with self.client.stream("POST", stream_url, json=payload, headers=headers, timeout=stream_timeout) as resp:
                resp.raise_for_status()

                # Google streamGenerateContent may return NDJSON or SSE. Some providers split a single
                # JSON object/array across multiple SSE events. We therefore accumulate SSE payloads
                # and greedily extract any completed "text": "..." fields without echoing raw JSON.
                sse_mode = False
                json_buf: str = ""
                processed_idx: int = 0
                text_pattern = re.compile(r'"text"\s*:\s*"((?:\\.|[^"\\])*)"')

                async for line in resp.aiter_lines():
                    if line is None:
                        continue
                    raw = line.rstrip("\n")

                    # Detect SSE markers
                    if raw.startswith(":"):
                        # SSE comment/keepalive
                        continue
                    if raw.startswith("data:"):
                        sse_mode = True
                        sse_payload = raw[len("data:"):].lstrip()
                        if sse_payload == "[DONE]":
                            return
                        # Accumulate payload fragments; many providers split JSON across events
                        json_buf += (sse_payload + "\n")

                        # Greedily extract any complete text fields from the rolling buffer
                        for m in text_pattern.finditer(json_buf, processed_idx):
                            raw_text = m.group(1)
                            try:
                                # Use json.loads on a quoted string to unescape sequences
                                decoded = json.loads(f'"{raw_text}"')
                            except Exception:
                                decoded = raw_text
                            if decoded:
                                yield decoded
                            processed_idx = m.end()
                        # Optionally trim buffer to keep memory bounded
                        if processed_idx > 0 and processed_idx > len(json_buf) // 2:
                            json_buf = json_buf[processed_idx:]
                            processed_idx = 0
                        continue

                    # Blank line between SSE events — ignore; we accumulate across events
                    if raw.strip() == "" and sse_mode:
                        continue

                    # NDJSON or multi-line JSON fallback:
                    # Accumulate raw lines into the rolling buffer and extract text fields with regex
                    data = raw.strip()
                    if not data:
                        continue
                    if data == "[DONE]":
                        return

                    json_buf += (data + "\n")
                    for m in text_pattern.finditer(json_buf, processed_idx):
                        raw_text = m.group(1)
                        try:
                            decoded = json.loads(f'"{raw_text}"')
                        except Exception:
                            decoded = raw_text
                        if decoded:
                            yield decoded
                        processed_idx = m.end()
                    if processed_idx > 0 and processed_idx > len(json_buf) // 2:
                        json_buf = json_buf[processed_idx:]
                        processed_idx = 0

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

