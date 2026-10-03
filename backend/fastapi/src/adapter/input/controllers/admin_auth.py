"""Who is calling: the course administrator, and from which address.

Shared by the course API and the AI features: one administrator key
(`COURSE_ADMIN_KEY`), exchanged for a signed session token by
`POST /courses/admin/verify` — see `application.utils.admin_session`.
"""

from __future__ import annotations

import hmac
import os
from typing import Optional

from fastapi import Header, Request

from src.application.config.config import settings
from src.application.exceptions.exceptions import AppException
from src.application.utils import admin_session

#: Namespaces the HMAC so a token minted here cannot be replayed against another
#: app that happens to share the same admin key.
SESSION_SALT = "course-admin"


def admin_key() -> str:
    """The configured key, or "" when administration is switched off."""
    return (os.getenv("COURSE_ADMIN_KEY") or getattr(settings, "COURSE_ADMIN_KEY", "") or "").strip()


def int_setting(name: str, default: int) -> int:
    return int(os.getenv(name, getattr(settings, name, default)) or default)


def key_matches(provided: Optional[str], expected: str) -> bool:
    # Constant-time: `==` on a secret leaks how long a prefix matched.
    return bool(provided and expected) and hmac.compare_digest(
        provided.encode("utf-8"), expected.encode("utf-8"))


def forbidden(message: str, code: str) -> AppException:
    """403 with a machine-readable `data.code` — the page reacts to the code,
    the person reads the (Vietnamese) message."""
    return AppException(message=message, status_code=403, code=code, payload={"code": code})


def admin_disabled() -> AppException:
    return forbidden("Quản trị khoá học đang tắt: máy chủ chưa đặt COURSE_ADMIN_KEY", "admin_disabled")


def session_problem(cause: admin_session.SessionError) -> AppException:
    if "expired" in str(cause).lower():
        return forbidden("Phiên quản trị đã hết hạn — nhập lại khoá quản trị", "session_expired")
    return forbidden("Token phiên quản trị không hợp lệ — nhập lại khoá quản trị", "session_invalid")


def is_admin(key: Optional[str], session_token: Optional[str]) -> bool:
    expected = admin_key()
    if not expected:
        return False
    if key_matches(key, expected):
        return True
    if session_token:
        try:
            admin_session.verify(session_token, expected, salt=SESSION_SALT)
            return True
        except admin_session.SessionError:
            return False
    return False


def require_admin(
    x_admin_key: Optional[str] = Header(default=None),
    x_admin_session: Optional[str] = Header(default=None),
) -> None:
    if is_admin(x_admin_key, x_admin_session):
        return
    if not admin_key():
        raise admin_disabled()
    if x_admin_session:
        try:
            admin_session.verify(x_admin_session, admin_key(), salt=SESSION_SALT)
        except admin_session.SessionError as cause:
            raise session_problem(cause) from cause
    raise forbidden("Cần khoá quản trị hoặc token phiên", "admin_required")


def optional_admin(
    x_admin_key: Optional[str] = Header(default=None),
    x_admin_session: Optional[str] = Header(default=None),
) -> bool:
    """Reads are public; an admin session additionally sees drafts."""
    return is_admin(x_admin_key, x_admin_session)


def client_address(request: Request) -> str:
    # Behind Vercel / a proxy the socket address is the proxy's.
    real = request.headers.get("x-real-ip")
    if real:
        return real.strip()
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "?"
