"""What the remote providers (Piston, Judge0, Wandbox) have in common.

* `HttpExecutor` - the HTTP plumbing and, above all, the error mapping: every way
  a provider can fail becomes one of three `AppException`s with a Vietnamese
  message, and the provider's own words are only passed on after the provider's
  URL and key were scrubbed out of them.
* small helpers: cutting output at the limit, reading numbers leniently,
  parsing `lang=value` override lists from the settings, naming a Java main class.
"""

from __future__ import annotations

import re
import time
from typing import Any, Dict, Mapping, Optional, Tuple
from urllib.parse import urlsplit

import httpx

from src.application.exceptions.run_exceptions import (
    RunProviderRejected,
    RunProviderTimeout,
    RunProviderUnavailable,
)
from src.application.ports.output.code_executor_port import CodeExecutorPort
from src.domain.utils.run_languages import LANGUAGES, canonical_language
from src.domain.vo.run_vo import MAX_OUTPUT_BYTES, ExecutionRequest

DETAIL_CHARS = 200


def clip_text(text: Any, limit: int = MAX_OUTPUT_BYTES) -> Tuple[str, bool]:
    """`text` cut to `limit` UTF-8 bytes, and whether anything was cut."""
    if text is None:
        return "", False
    if not isinstance(text, str):
        text = str(text)
    raw = text.encode("utf-8")
    if len(raw) <= limit:
        return text, False
    return raw[:limit].decode("utf-8", errors="ignore"), True


def to_int(value: Any, default: Optional[int] = None) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def seconds_to_ms(value: Any) -> int:
    """`"0.123"` (seconds, as Judge0 writes them) -> 123."""
    try:
        return max(0, int(round(float(value) * 1000)))
    except (TypeError, ValueError):
        return 0


def parse_overrides(text: str) -> Dict[str, str]:
    """`"cpp=105, python=100"` -> `{"cpp": "105", "python": "100"}`.

    Keys go through the language aliases; entries that do not name a known
    language, and anything malformed, are skipped - a typo in a setting must not
    stop the whole provider.
    """
    result: Dict[str, str] = {}
    for part in (text or "").split(","):
        name, _, value = part.partition("=")
        language = canonical_language(name)
        if language and value.strip():
            result[language] = value.strip()
    return result


_PACKAGE = re.compile(r"^\s*package\s+([A-Za-z_][\w.]*)\s*;", re.MULTILINE)


def java_main_class(main_file: str, content: str) -> str:
    """The class to run for `main_file`: its stem, qualified by its `package`."""
    stem = main_file.rsplit("/", 1)[-1]
    if stem.endswith(".java"):
        stem = stem[: -len(".java")]
    package = _PACKAGE.search(content)
    return f"{package.group(1)}.{stem}" if package else stem


class HttpExecutor(CodeExecutorPort):
    """A provider reached over HTTP. Subclasses build the request and read the reply."""

    kind = "remote"

    def __init__(
        self,
        *,
        base_url: str,
        api_key: str = "",
        http_timeout_s: float = 30.0,
        transport: Optional[httpx.AsyncBaseTransport] = None,
    ):
        self._base = (base_url or "").strip().rstrip("/")
        self._key = (api_key or "").strip()
        self._timeout_ceiling = max(1.0, float(http_timeout_s))
        # Injected by tests (httpx.MockTransport); None means the real network.
        self._transport = transport

    # -------------------------------------------------------------- helpers
    def _timeout_for(self, request: ExecutionRequest) -> float:
        """Long enough for compile + run, never longer than the configured ceiling."""
        needed = (request.compile_timeout_ms + request.run_timeout_ms) / 1000 + 5
        return max(5.0, min(self._timeout_ceiling, needed))

    def _scrub(self, text: str) -> str:
        """Remove the provider's address and key from a message before it leaves."""
        secrets = [self._key, self._base, urlsplit(self._base).netloc]
        for secret in secrets:
            if secret:
                text = text.replace(secret, "***")
        text = re.sub(r"https?://\S+", "***", text)
        text = " ".join(text.split())
        return text[:DETAIL_CHARS]

    @staticmethod
    def _body_message(response: httpx.Response) -> str:
        try:
            data = response.json()
        except ValueError:
            return response.text or ""
        if isinstance(data, dict):
            for key in ("message", "error", "detail"):
                value = data.get(key)
                if isinstance(value, str) and value:
                    return value
                if isinstance(value, (list, dict)) and value:
                    return str(value)
        return response.text or ""

    def _raise_for_status(self, response: httpx.Response) -> None:
        status = response.status_code
        if 200 <= status < 300:
            return
        detail = self._scrub(self._body_message(response))
        if status == 429:
            retry = to_int(response.headers.get("retry-after"))
            raise RunProviderRejected(
                self.id,
                f"Nhà cung cấp '{self.id}' đang giới hạn tốc độ — thử lại sau ít giây hoặc chọn nhà cung cấp khác.",
                detail=detail,
                retry_after=retry,
            )
        if status in (401, 403):
            raise RunProviderRejected(
                self.id,
                f"Nhà cung cấp '{self.id}' từ chối quyền truy cập (khoá API thiếu hoặc không đúng).",
                detail=detail,
            )
        if 400 <= status < 500:
            raise RunProviderRejected(
                self.id,
                f"Nhà cung cấp '{self.id}' từ chối yêu cầu" + (f": {detail}" if detail else "."),
                detail=detail,
            )
        raise RunProviderUnavailable(self.id, detail=f"HTTP {status}")

    async def _send(
        self,
        method: str,
        path: str,
        request: ExecutionRequest,
        *,
        json_body: Optional[Dict[str, Any]] = None,
        params: Optional[Mapping[str, str]] = None,
        headers: Optional[Mapping[str, str]] = None,
    ) -> httpx.Response:
        try:
            async with httpx.AsyncClient(transport=self._transport, timeout=self._timeout_for(request)) as client:
                response = await client.request(
                    method,
                    self._base + path,
                    json=json_body,
                    params=params,
                    headers={"Accept": "application/json", **(headers or {})},
                )
        except httpx.TimeoutException as cause:
            raise RunProviderTimeout(self.id) from cause
        except httpx.HTTPError as cause:
            # Not `str(cause)`: a connection error quotes the address.
            raise RunProviderUnavailable(self.id, detail=cause.__class__.__name__) from cause
        self._raise_for_status(response)
        return response

    def _json(self, response: httpx.Response) -> Dict[str, Any]:
        try:
            data = response.json()
        except ValueError as cause:
            raise RunProviderUnavailable(self.id, "Nhà cung cấp trả về dữ liệu không đọc được.") from cause
        if not isinstance(data, dict):
            raise RunProviderUnavailable(self.id, "Nhà cung cấp trả về dữ liệu không đúng định dạng.")
        return data

    @staticmethod
    def _timed(start: float) -> int:
        return int((time.perf_counter() - start) * 1000)

    # ------------------------------------------------- availability helpers
    def _all_languages(self, mapping: Mapping[str, Any]) -> Tuple[str, ...]:
        return tuple(language for language in LANGUAGES if language in mapping)
