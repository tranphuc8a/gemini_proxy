from typing import Any, Dict, Optional, AsyncIterator
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from src.application.config.config import settings
import asyncio
import time


class GeminiClientError(RuntimeError):
    pass


class GeminiClient:
    """Async HTTP client for calling Gemini-like LLM endpoints.

    Uses httpx.AsyncClient under the hood and retries transient network errors.
    """
    def __init__(
        self,
        url: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout: Optional[int] = None,
        oauth_token: Optional[str] = None,
        service_account_file: Optional[str] = None,
    ):
        self.url = url or settings.GEMINI_URL
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.timeout = timeout or settings.GEMINI_TIMEOUT_SECONDS
        # explicit OAuth token (string) or service account JSON file path to obtain tokens
        self._oauth_token = oauth_token or getattr(settings, "GEMINI_OAUTH_TOKEN", None)
        self._service_account_file = service_account_file or getattr(settings, "GEMINI_SERVICE_ACCOUNT_FILE", None)
        self._client: Optional[httpx.AsyncClient] = None
        # token cache (value, expiry_ts)
        self._token_cache: Optional[tuple[str, float]] = None

    def _is_google_style(self) -> bool:
        if not self.url:
            return False
        return "generativelanguage" in self.url or ":generate" in self.url or "models/" in self.url

    def _prepare_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
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

        # If an OAuth token or service account is configured, prefer sending
        # an Authorization: Bearer <token> header. Otherwise for Google-style
        # endpoints send x-goog-api-key if available.
        final_url = self.url
        token = await self._get_bearer_token()
        if token:
            headers["Authorization"] = f"Bearer {token}"
        elif self._is_google_style() and self.api_key:
            headers["x-goog-api-key"] = self.api_key

        try:
            return await self._post(final_url, payload, headers)
        except httpx.RequestError as exc:
            raise GeminiClientError(f"Request error while calling Gemini API: {exc}") from exc
        except httpx.HTTPStatusError as exc:
            body = exc.response.text if exc.response is not None else ""
            status = exc.response.status_code if exc.response is not None else "?"
            if status == 401:
                # Provide a more actionable error message for auth failures
                hint = (
                    "Request had invalid authentication credentials.\n"
                    "If you're calling Google's Generative Language API, you likely need an OAuth2 access token (service account) rather than an API key, or enable the API and use a valid API key.\n"
                    "Set GEMINI_API_KEY to a valid key, or configure an OAuth2 access token (service account). You can set GEMINI_SERVICE_ACCOUNT_FILE to a service account JSON file and the client will obtain a token automatically.\n"
                    "See https://developers.google.com/identity for details."
                )
                raise GeminiClientError(f"Gemini API returned HTTP 401: {body}\n{hint}") from exc
            raise GeminiClientError(f"Gemini API returned HTTP {status}: {body}") from exc

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

    async def _get_bearer_token(self) -> Optional[str]:
        """Return an OAuth2 bearer token, preferring an explicit token, then a cached
        service-account token obtained from a JSON key file. Returns None if no
        credentials are configured.
        """
        # 1) explicit token
        if self._oauth_token:
            return self._oauth_token

        # 2) cached token
        if self._token_cache is not None:
            token, expiry = self._token_cache
            if time.time() < expiry - 30:
                return token

        # 3) service account file -> obtain token
        if not self._service_account_file:
            return None

        # Try to import google-auth libraries lazily
        try:
            from google.oauth2 import service_account
            from google.auth.transport.requests import Request as GoogleRequest
        except Exception:
            raise GeminiClientError(
                "google-auth is required to use service account credentials. Install 'google-auth' package."
            )

        # Create credentials and refresh in a thread to avoid blocking the event loop
        scopes = ["https://www.googleapis.com/auth/cloud-platform"]

        def _refresh_credentials():
            creds = service_account.Credentials.from_service_account_file(self._service_account_file, scopes=scopes)
            # refresh will set token and expiry
            creds.refresh(GoogleRequest())
            return creds.token, getattr(creds, "expiry", None)

        try:
            token, expiry_dt = await asyncio.to_thread(_refresh_credentials)
        except Exception as exc:
            raise GeminiClientError(f"Failed to obtain OAuth token from service account: {exc}") from exc

        if token is None:
            return None

        # convert expiry to timestamp
        expiry_ts = time.time() + 300
        if expiry_dt is not None:
            try:
                expiry_ts = expiry_dt.timestamp()
            except Exception:
                expiry_ts = time.time() + 300

        self._token_cache = (token, expiry_ts)
        return token
