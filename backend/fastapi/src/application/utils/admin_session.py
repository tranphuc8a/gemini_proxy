"""Short-lived admin sessions for the token-gated web apps.

The editor apps gate writing behind a single shared admin key. Holding that key
in a JavaScript variable and nowhere else was the right instinct -- it is never
in the bundle, never in storage, never in a log -- but it also meant every reload
signed the user out, which is the bug this module fixes.

A session token is issued *in exchange* for the key and stored instead of it:

    payload = {"exp": <unix seconds>, "nonce": <random>}
    token   = base64url(json(payload)) + "." + base64url(hmac_sha256(secret, part))

Three properties matter:

* **The key never leaves the server.** What the browser keeps is a signature over
  an expiry, useless for anything but this app.
* **It expires.** A stolen token is worth something for hours, not forever.
* **Rotating the admin key invalidates every token**, because the key is mixed
  into the signing secret. That is what makes "change the key" an effective
  revocation -- there is no server-side session list to clear.

`hmac.compare_digest` does every comparison here: `==` on a signature leaks its
prefix through timing.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional


class SessionError(Exception):
    """A token that cannot be trusted: malformed, forged, or expired."""


def _b64encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _secret(admin_key: str, salt: str) -> bytes:
    """Derive the signing secret from the admin key itself.

    Mixing the key in is what ties a token's lifetime to the key's: change the
    key and every token signed under the old one stops verifying.
    """
    return hashlib.sha256(f"{salt}:{admin_key}".encode("utf-8")).digest()


@dataclass(frozen=True)
class AdminSession:
    token: str
    expires_at: int


def issue(admin_key: str, *, salt: str, ttl_seconds: int, since: Optional[int] = None) -> AdminSession:
    """Mint a token for a caller that has just proved it knows `admin_key`.

    `since` is when that proof happened — the original login. A refresh passes
    it on unchanged, so a caller can cap how long a chain of refreshes may run
    (see `verify_claims`); tokens issued without it simply carry no such claim.
    """
    if not admin_key:
        raise ValueError("Cannot issue a session without an admin key")
    expires_at = int(time.time()) + max(60, ttl_seconds)
    claims: Dict[str, Any] = {"exp": expires_at, "nonce": secrets.token_hex(8)}
    if since is not None:
        claims["since"] = int(since)
    payload = json.dumps(claims, separators=(",", ":"))
    body = _b64encode(payload.encode("utf-8"))
    signature = hmac.new(_secret(admin_key, salt), body.encode("ascii"), hashlib.sha256).digest()
    return AdminSession(token=f"{body}.{_b64encode(signature)}", expires_at=expires_at)


def verify_claims(token: str, admin_key: str, *, salt: str) -> Dict[str, Any]:
    """Return the token's claims (at least ``exp``), or raise `SessionError`.

    Never raises anything else: a token arrives from the network and every way it
    can be malformed has to end in the same rejection.
    """
    # An empty key would sign with sha256("salt:"), a secret anyone can compute:
    # with no key configured there is no session to accept.
    if not admin_key:
        raise SessionError("No admin key is configured")
    if not token or "." not in token:
        raise SessionError("Malformed session token")

    body, _, signature = token.partition(".")
    try:
        # A header is decoded as latin-1, so a hostile token may hold characters
        # that `encode("ascii")` rejects; that is a bad token, not a server error.
        expected = hmac.new(_secret(admin_key, salt), body.encode("ascii"), hashlib.sha256).digest()
        provided = _b64decode(signature)
    except Exception as cause:
        raise SessionError("Malformed session token") from cause
    if not hmac.compare_digest(expected, provided):
        raise SessionError("Session token signature does not match")

    try:
        payload = json.loads(_b64decode(body))
        expires_at = int(payload["exp"])
    except Exception as cause:
        raise SessionError("Malformed session token") from cause
    if not isinstance(payload, dict):
        raise SessionError("Malformed session token")

    if expires_at <= int(time.time()):
        raise SessionError("Session expired")
    return payload


def verify(token: str, admin_key: str, *, salt: str) -> int:
    """Return the token's expiry, or raise `SessionError` (see `verify_claims`)."""
    return int(verify_claims(token, admin_key, salt=salt)["exp"])
