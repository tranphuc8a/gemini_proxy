from typing import Any, Dict, Optional
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from backend.fastapi.src.application.config.config import settings


class GeminiClientError(RuntimeError):
    pass


class GeminiClient:
    """HTTP client for calling Gemini-like LLM endpoints.

    Behavior:
    - If `GEMINI_URL` contains 'generativelanguage' or ':generate' we'll use a
      Google Generative Language-like payload: {"prompt": {"text": ...}}
    - Otherwise we send a generic JSON: {"prompt": "..."} unless overridden.

    The client will retry transient network errors using exponential backoff.
    """

    def __init__(self, url: Optional[str] = None, api_key: Optional[str] = None, timeout: Optional[int] = None):
        self.url = url or settings.GEMINI_URL
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.timeout = timeout or settings.GEMINI_TIMEOUT_SECONDS

    def _is_google_style(self) -> bool:
        if not self.url:
            return False
        return "generativelanguage" in self.url or ":generate" in self.url or "models/" in self.url

    def _prepare_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=10),
           retry=retry_if_exception_type(httpx.RequestError))
    def _post(self, url: str, json: Dict[str, Any], headers: Dict[str, str]) -> Dict[str, Any]:
        with httpx.Client(timeout=self.timeout) as client:
            resp = client.post(url, json=json, headers=headers)
            resp.raise_for_status()
            return resp.json()

    def generate(self, prompt: str, model: Optional[str] = None, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if not self.url:
            raise GeminiClientError("GEMINI_URL is not configured")

        # choose payload shape
        if self._is_google_style():
            payload: Dict[str, Any] = {"prompt": {"text": prompt}}
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
            return self._post(self.url, payload, headers)
        except httpx.RequestError as exc:
            raise GeminiClientError(f"Request error while calling Gemini API: {exc}") from exc
        except httpx.HTTPStatusError as exc:
            body = exc.response.text if exc.response is not None else ""
            raise GeminiClientError(f"Gemini API returned HTTP {exc.response.status_code}: {body}") from exc
