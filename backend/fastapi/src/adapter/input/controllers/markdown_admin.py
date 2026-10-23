"""Who may administer the markdown store, and who may read it (B0 + Q1, ke-hoach §1.2/§6).

Every markdown route that needs the administrator goes through `require_markdown_admin`
(a FastAPI dependency) or `check_markdown_admin` (the same check, callable): the
storage controller (`PUT /files`, and `GET /files` while the store is private), the
share links, and the delta sync (`markdown_docs_controller`, md-sync B11).

The rules:

* **Key or session.** `X-Admin-Key` is the key itself (scripts, curl); `X-Admin-Session`
  is a signed expiry minted for it by `/markdown/admin/verify` (`admin_session`, salt
  `markdown-editor`). The key is compared in constant time. It may be as long as an HTTP
  header allows (about 8 KB behind Vercel): the header has no length cap of its own, a
  longer guess than the key (or than `MAX_ADMIN_KEY_CHARS`) is just a counted wrong key.
* **Wrong guesses are counted** per client address: `MARKDOWN_ADMIN_MAX_FAILURES` (20)
  in `MARKDOWN_ADMIN_FAILURE_WINDOW_S` (600 s), then 429 with `Retry-After` - even for
  the right key, or the lock would only slow a guesser down for the wrong answers.
  Counted: a wrong key, a forged or malformed session. Not counted: no credential at
  all (a guest is not guessing) and an expired session (it was genuine once).
* **The default key is public** (it is printed in the repository). It is accepted only
  from this machine itself - a loopback peer with no proxy header - or when
  `MARKDOWN_ALLOW_DEFAULT_KEY=true`; anywhere else every admin request is refused with
  `markdown_default_key_refused` until `MARKDOWN_ADMIN_KEY` is set. A warning is logged
  once per process while the default is in use.
* **Reads.** `MARKDOWN_PUBLIC_READ` (default false: the store is private) decides whether
  `GET /markdown/files`, `/markdown/sync/changes` and `/markdown/docs/{id}` -
  needs the administrator too. History, trash and the list of links always do.
"""

from __future__ import annotations

import hmac
import ipaddress
import logging
import os
from typing import Optional

from fastapi import Header, Request

from src.adapter.factory.rate_limit_factory import build_rate_limiter
from src.adapter.input.controllers.admin_auth import client_address
from src.application.config.config import settings
from src.application.exceptions.exceptions import AppException
from src.application.ports.output.rate_limiter_port import RateLimiterPort
from src.application.utils import admin_session
from src.application.utils.share_links import rate_limited

logger = logging.getLogger(__name__)

#: Namespaces the HMAC so a token minted here cannot be replayed against another
#: app that shares the same admin key.
SESSION_SALT = "markdown-editor"
#: Printed in the repository (`config.py`, `.env.example`, README): never a secret.
DEFAULT_ADMIN_KEY = "markdown-editor-admin-2024"

#: A guess longer than this AND longer than the configured key cannot be right: it is refused as a wrong key
#: without being compared. (The header itself has no cap: a 422 for a long key meant it could never unlock.)
MAX_ADMIN_KEY_CHARS = 2048
_PROXY_HEADERS = ("x-forwarded-for", "x-real-ip", "forwarded", "x-forwarded-host")

_failures: Optional[RateLimiterPort] = None
_warned_default = False


# ------------------------------------------------------------------ settings
def _env_or_setting(name: str, default):
    value = os.getenv(name)
    return value if value is not None else getattr(settings, name, default)


def _flag(name: str, default: bool) -> bool:
    value = _env_or_setting(name, default)
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def admin_key() -> str:
    return str(_env_or_setting("MARKDOWN_ADMIN_KEY", DEFAULT_ADMIN_KEY) or "")


def public_read() -> bool:
    """May anyone read the stored documents (`GET /markdown/files`)? Default: no (Q1)."""
    return _flag("MARKDOWN_PUBLIC_READ", False)


def using_default_key() -> bool:
    return admin_key() == DEFAULT_ADMIN_KEY


def _failure_limiter() -> RateLimiterPort:
    global _failures
    if _failures is None:
        _failures = build_rate_limiter(
            "markdown_admin_failures",
            max(1, int(_env_or_setting("MARKDOWN_ADMIN_MAX_FAILURES", 20))),
            max(1, int(_env_or_setting("MARKDOWN_ADMIN_FAILURE_WINDOW_S", 600))),
        )
    return _failures


def reset_for_tests() -> None:
    global _failures, _warned_default
    _failures = None
    _warned_default = False


# --------------------------------------------------------------------- errors
def _forbidden(message: str, code: str) -> AppException:
    """403 with `data.code`: the page reacts to the code, the person reads the (Vietnamese) message."""
    return AppException(message=message, status_code=403, code=code, payload={"code": code})


def private_store() -> AppException:
    return _forbidden(
        "Kho tài liệu trên máy chủ này ở chế độ riêng tư — mở khoá quản trị để tải", "markdown_private"
    )


# ---------------------------------------------------------------------- check
def _is_loopback(host: str) -> bool:
    """127.0.0.0/8, ::1, and either inside an IPv4-mapped IPv6 address (`::ffff:127.0.0.1`, what a dual-stack
    server reports for a local IPv4 client). `ipaddress` alone misses the mapped form before Python 3.13."""
    if host == "localhost":
        return True
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        return False
    mapped = getattr(address, "ipv4_mapped", None)
    return address.is_loopback or (mapped is not None and mapped.is_loopback)


def is_local_request(request: Optional[Request]) -> bool:
    """This machine talking to itself: a loopback socket peer and no proxy in between.

    The socket address, never `X-Real-IP`: a header can claim anything, and a reverse
    proxy on the same host would otherwise make every visitor "local".
    """
    if request is None or request.client is None:
        return False
    if not _is_loopback(request.client.host or ""):
        return False
    return not any(request.headers.get(name) for name in _PROXY_HEADERS)


def key_matches(provided: Optional[str], expected: str) -> bool:
    # Constant time: `==` on a secret leaks how long a prefix matched.
    return bool(provided and expected) and hmac.compare_digest(provided.encode("utf-8"), expected.encode("utf-8"))


async def check_markdown_admin(
    admin_key_value: Optional[str],
    session_token: Optional[str] = None,
    *,
    ip: str = "",
    local: bool = False,
    missing: Optional[AppException] = None,
) -> None:
    """Raise unless the caller is the markdown administrator (see the module docstring).

    `ip` keys the wrong-guess counter ("" = not counted). `local` says the request came
    from this machine itself (`is_local_request`), the only place the default key works.
    `missing` is what to raise when no credential was sent at all (default 403
    `markdown_admin_required`).
    """
    global _warned_default
    expected = admin_key()
    if not expected:
        raise _forbidden("Quản trị kho markdown đang tắt: máy chủ chưa đặt MARKDOWN_ADMIN_KEY", "markdown_admin_disabled")
    if not admin_key_value and not session_token:
        raise missing or _forbidden("Cần khoá quản trị hoặc phiên quản trị", "markdown_admin_required")

    limiter = _failure_limiter() if ip else None
    if limiter is not None:
        wait = await limiter.retry_after(ip)
        if wait:
            raise rate_limited(
                "markdown_admin_locked", f"Nhập sai khoá quản trị quá nhiều lần — thử lại sau {wait} giây", wait
            )

    if expected == DEFAULT_ADMIN_KEY:
        if not _warned_default:
            _warned_default = True
            logger.warning(
                "MARKDOWN_ADMIN_KEY is the public default; markdown admin requests are accepted from this machine only. "
                "Set MARKDOWN_ADMIN_KEY to a private value."
            )
        if not (local or _flag("MARKDOWN_ALLOW_DEFAULT_KEY", False)):
            raise _forbidden(
                "Máy chủ đang dùng khoá quản trị mặc định (công khai trong mã nguồn) nên từ chối quản trị từ xa — "
                "hãy đặt MARKDOWN_ADMIN_KEY",
                "markdown_default_key_refused",
            )

    if admin_key_value:
        if len(admin_key_value) <= max(MAX_ADMIN_KEY_CHARS, len(expected)) and key_matches(admin_key_value, expected):
            return
        if limiter is not None:
            await limiter.add(ip)
        raise _forbidden("Khoá quản trị không đúng", "markdown_admin_invalid")

    try:
        admin_session.verify(session_token or "", expected, salt=SESSION_SALT)
        return
    except admin_session.SessionError as cause:
        if "expired" in str(cause).lower():
            raise _forbidden("Phiên quản trị đã hết hạn — nhập lại khoá quản trị", "markdown_session_expired") from cause
        if limiter is not None:
            await limiter.add(ip)
        raise _forbidden("Phiên quản trị không hợp lệ — nhập lại khoá quản trị", "markdown_session_invalid") from cause


async def check_markdown_admin_request(
    request: Request,
    x_admin_key: Optional[str],
    x_admin_session: Optional[str],
    *,
    missing: Optional[AppException] = None,
) -> None:
    await check_markdown_admin(
        x_admin_key, x_admin_session, ip=client_address(request), local=is_local_request(request), missing=missing
    )


async def require_markdown_admin(
    request: Request,
    x_admin_key: Optional[str] = Header(default=None),
    x_admin_session: Optional[str] = Header(default=None, max_length=600),
) -> None:
    """FastAPI dependency: the request must come from the markdown administrator."""
    await check_markdown_admin_request(request, x_admin_key, x_admin_session)


async def require_markdown_reader(
    request: Request,
    x_admin_key: Optional[str] = Header(default=None),
    x_admin_session: Optional[str] = Header(default=None, max_length=600),
) -> None:
    """FastAPI dependency for reading stored documents: anyone while `MARKDOWN_PUBLIC_READ`
    is on, the administrator otherwise (a guest gets 403 `markdown_private`)."""
    if public_read():
        return
    await check_markdown_admin_request(request, x_admin_key, x_admin_session, missing=private_store())
