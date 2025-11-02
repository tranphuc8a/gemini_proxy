from typing import Any, Dict, Optional, AsyncIterator
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from src.application.config.config import settings
import asyncio


class GeminiClientError(RuntimeError):
    pass


class GeminiClient:
    """Async HTTP client for calling Gemini-like LLM endpoints.

    Uses httpx.AsyncClient under the hood and retries transient network errors.
    """

    def __init__(self, url: Optional[str] = None, api_key: Optional[str] = None, timeout: Optional[int] = None):
        self.url = url or settings.GEMINI_URL
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.timeout = timeout or settings.GEMINI_TIMEOUT_SECONDS
        self._client: Optional[httpx.AsyncClient] = None

    def _is_google_style(self) -> bool:
        if not self.url:
            return False
        return "generativelanguage" in self.url or ":generate" in self.url or "models/" in self.url

    def _prepare_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=self.timeout)
        return self._client

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=10),
           retry=retry_if_exception_type(httpx.RequestError))
    async def _post(self, url: str, json: Dict[str, Any], headers: Dict[str, str]) -> Dict[str, Any]:
        client = await self._get_client()
        resp = await client.post(url, json=json, headers=headers)
        resp.raise_for_status()
        return resp.json()

    async def generate(self, prompt: Any, model: Optional[str] = None, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if not self.url:
            raise GeminiClientError("GEMINI_URL is not configured")

        # choose payload shape
        if self._is_google_style():
            payload: Dict[str, Any] = {"contents": prompt if isinstance(prompt, list) else [{"role": "user", "parts": [{"text": prompt}]}]}
            if model:
                payload["model"] = model
        else:
            payload = {"prompt": prompt}
            if model:
                payload["model"] = model

        if extra:
            payload.update(extra)

        headers = self._prepare_headers()

        try:
            return await self._post(self.url, payload, headers)
        except httpx.RequestError as exc:
            raise GeminiClientError(f"Request error while calling Gemini API: {exc}") from exc
        except httpx.HTTPStatusError as exc:
            body = exc.response.text if exc.response is not None else ""
            raise GeminiClientError(f"Gemini API returned HTTP {exc.response.status_code}: {body}") from exc

    async def stream_generate(self, prompt: Any, model: Optional[str] = None, extra: Optional[Dict[str, Any]] = None) -> AsyncIterator[str]:
        """A simple streaming wrapper which yields parts from a non-streaming response.

        If the upstream supports streaming HTTP, this method can be extended to
        consume chunks. For now, call `generate()` and yield each text part.
        """
        resp = await self.generate(prompt, model=model, extra=extra)
        # try to extract parts from common response shapes
        candidates = resp.get("candidates") or []
        for cand in candidates:
            content = cand.get("content", {})
            parts = content.get("parts", [])
            for part in parts:
                text = part.get("text")
                if text:
                    # simulate streaming with a tiny async sleep to allow cooperative scheduling
                    await asyncio.sleep(0)
                    yield text

    async def health_check(self) -> bool:
        if not self.url:
            return False
        try:
            client = await self._get_client()
            resp = await client.get(self.url)
            return resp.status_code < 500
        except Exception:
            return False

    async def stop(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None
