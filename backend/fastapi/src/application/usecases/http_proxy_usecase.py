"""Forward an arbitrary HTTP call on behalf of a browser client.

Why this exists: postman-lite runs inside a tab, so every cross-origin call it
makes is subject to the same-origin policy. A server that does not send
`Access-Control-Allow-Origin` is simply unreachable from JavaScript, even though
the real Postman — a native app with no origin — reaches it fine. Forwarding the
call from the backend removes the browser from the equation, and as a bonus the
caller gets the response headers in full (a cross-origin `fetch` only exposes the
six safelisted ones) and can finally send `Cookie`, `User-Agent` or `Referer`,
which `fetch` refuses to set.

The flip side is that this is a forward proxy: anything the backend can reach,
its callers can now reach too. Deployments that expose the API publicly should
set `PROXY_ENABLED=false` or pin `PROXY_ALLOWED_HOSTS`.
"""

from __future__ import annotations

import base64
import ipaddress
import time
from fnmatch import fnmatch
from typing import Dict, Tuple
from urllib.parse import urlsplit

import httpx

from src.application.config.config import settings
from src.application.exceptions.exceptions import (
    BadGatewayError,
    BadRequestError,
    GatewayTimeoutError,
)
from src.domain.vo.proxy_vo import ProxyRequest, ProxyResponse

# Headers that describe one hop of a connection. Passing them through would
# describe the browser->backend hop to the upstream server, which is wrong, and
# `Content-Length` in particular would contradict the body httpx re-encodes.
HOP_BY_HOP_HEADERS = frozenset(
    {
        "connection",
        "content-length",
        "host",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailer",
        "transfer-encoding",
        "upgrade",
    }
)

# Link-local metadata services hand out cloud credentials to anyone who can make
# an HTTP request from inside the instance. They stay blocked regardless of the
# allow-list, because no legitimate API-testing session needs them.
BLOCKED_HOSTNAMES = frozenset({"metadata.google.internal", "metadata.goog"})

ALLOWED_SCHEMES = frozenset({"http", "https"})

ALLOWED_METHODS = frozenset(
    {"GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
)


def _allowed_hosts() -> list[str]:
    raw = (getattr(settings, "PROXY_ALLOWED_HOSTS", "*") or "*").strip()
    if raw == "*":
        return ["*"]
    return [h.strip().lower() for h in raw.split(",") if h.strip()]


def _is_blocked_address(hostname: str) -> bool:
    """True for the cloud metadata endpoint, by name or by literal address."""
    if hostname in BLOCKED_HOSTNAMES:
        return True
    try:
        address = ipaddress.ip_address(hostname)
    except ValueError:
        return False
    return address.is_link_local


def validate_target(url: str) -> str:
    """Reject anything we refuse to fetch, and return the normalised hostname."""
    parts = urlsplit(url)
    scheme = parts.scheme.lower()
    if scheme not in ALLOWED_SCHEMES:
        raise BadRequestError(
            f"Chỉ hỗ trợ http/https, không hỗ trợ '{parts.scheme or 'scheme rỗng'}'"
        )
    hostname = (parts.hostname or "").lower()
    if not hostname:
        raise BadRequestError("URL thiếu hostname")
    if _is_blocked_address(hostname):
        raise BadRequestError("Địa chỉ link-local/metadata bị chặn")

    patterns = _allowed_hosts()
    if patterns != ["*"] and not any(fnmatch(hostname, p) for p in patterns):
        raise BadRequestError(f"Host '{hostname}' không nằm trong PROXY_ALLOWED_HOSTS")
    return hostname


def _clean_request_headers(headers: Dict[str, str]) -> Dict[str, str]:
    return {
        k: v
        for k, v in (headers or {}).items()
        if k and k.lower() not in HOP_BY_HOP_HEADERS
    }


def _decode_request_body(request: ProxyRequest) -> bytes | None:
    if request.body is None or request.body == "":
        return None
    if request.body_encoding == "base64":
        try:
            return base64.b64decode(request.body, validate=True)
        except Exception as exc:  # noqa: BLE001 - surfaced to the caller as 400
            raise BadRequestError(f"body base64 không hợp lệ: {exc}") from exc
    return request.body.encode("utf-8")


def _encode_response_body(raw: bytes) -> Tuple[str, str]:
    """Return (body, encoding). Text when the bytes are valid UTF-8, else base64."""
    try:
        return raw.decode("utf-8"), "text"
    except UnicodeDecodeError:
        return base64.b64encode(raw).decode("ascii"), "base64"


async def forward(request: ProxyRequest) -> ProxyResponse:
    if not getattr(settings, "PROXY_ENABLED", True):
        raise BadRequestError("Proxy đang tắt (PROXY_ENABLED=false)")

    method = (request.method or "GET").upper()
    if method not in ALLOWED_METHODS:
        raise BadRequestError(f"Method '{method}' không được hỗ trợ")

    target_url = validate_target(request.url)

    headers = _clean_request_headers(request.headers)
    content = _decode_request_body(request)
    timeout = float(
        request.timeout_seconds or getattr(settings, "PROXY_TIMEOUT_SECONDS", 60)
    )
    max_bytes = int(getattr(settings, "PROXY_MAX_BYTES", 10 * 1024 * 1024))

    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=request.follow_redirects,
            # The caller is testing someone else's API and may well point it at a
            # box with a self-signed certificate; refusing would make the tool
            # less capable than the curl command it prints.
            verify=bool(getattr(settings, "PROXY_VERIFY_TLS", False)),
        ) as client:
            upstream = await client.request(
                method,
                target_url,
                headers=headers or None,
                content=content,
            )
            raw = upstream.content
    except httpx.TimeoutException as exc:
        raise GatewayTimeoutError(f"Upstream timeout sau {timeout:g}s: {exc}") from exc
    except httpx.RequestError as exc:
        raise BadGatewayError(f"Không gọi được upstream: {exc}") from exc

    elapsed_ms = int((time.perf_counter() - started) * 1000)

    size_bytes = len(raw)
    truncated = size_bytes > max_bytes
    if truncated:
        raw = raw[:max_bytes]

    body, encoding = _encode_response_body(raw)
    raw_headers = [[k, v] for k, v in upstream.headers.multi_items()]

    return ProxyResponse(
        status=upstream.status_code,
        status_text=upstream.reason_phrase or "",
        headers=dict(upstream.headers),
        raw_headers=raw_headers,
        body=body,
        body_encoding=encoding,
        content_type=upstream.headers.get("content-type", ""),
        size_bytes=size_bytes,
        elapsed_ms=elapsed_ms,
        final_url=str(upstream.url),
        redirected=str(upstream.url) != target_url,
        truncated=truncated,
    )
