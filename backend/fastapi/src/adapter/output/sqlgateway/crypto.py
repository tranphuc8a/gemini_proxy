"""Seal/unseal target-server passwords before they touch disk.

Sessions must survive an application restart (the UI keeps the user logged in
until they log out), which means the target DB password has to be persisted.
It is sealed with AES-GCM under a key derived from SQLADMIN_SECRET_KEY so the
session file alone is not enough to recover credentials.

`cryptography` is an optional dependency: when it is missing we report
`is_available() is False` and the session store silently stays in memory only.
"""

from __future__ import annotations

import base64
import hashlib
import os

try:  # pragma: no cover - exercised implicitly by whichever branch is installed
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    _CRYPTO_AVAILABLE = True
except Exception:  # pragma: no cover
    AESGCM = None  # type: ignore[assignment]
    _CRYPTO_AVAILABLE = False

_NONCE_BYTES = 12
_SALT = b"sqladmin-session-v1"


class SealError(RuntimeError):
    """Raised when a sealed payload cannot be opened with the current key."""


def is_available() -> bool:
    return _CRYPTO_AVAILABLE


def _derive_key(secret: str) -> bytes:
    # A single fixed salt is acceptable here: the secret is a server-side key,
    # not a user password, and the derivation only needs to be deterministic.
    return hashlib.pbkdf2_hmac("sha256", secret.encode("utf-8"), _SALT, 120_000, dklen=32)


class PasswordSealer:
    def __init__(self, secret: str):
        if not secret:
            raise ValueError("A non-empty secret is required to seal sessions")
        self._secret = secret
        self._key = _derive_key(secret) if _CRYPTO_AVAILABLE else b""

    @property
    def available(self) -> bool:
        return _CRYPTO_AVAILABLE

    def seal(self, plaintext: str) -> str:
        if not _CRYPTO_AVAILABLE:
            raise SealError("cryptography is not installed; cannot seal credentials")
        nonce = os.urandom(_NONCE_BYTES)
        blob = AESGCM(self._key).encrypt(nonce, (plaintext or "").encode("utf-8"), None)
        return base64.urlsafe_b64encode(nonce + blob).decode("ascii")

    def unseal(self, sealed: str) -> str:
        if not _CRYPTO_AVAILABLE:
            raise SealError("cryptography is not installed; cannot open sealed credentials")
        try:
            raw = base64.urlsafe_b64decode(sealed.encode("ascii"))
            nonce, blob = raw[:_NONCE_BYTES], raw[_NONCE_BYTES:]
            return AESGCM(self._key).decrypt(nonce, blob, None).decode("utf-8")
        except Exception as exc:  # invalid key, tampered payload, bad base64
            raise SealError("Sealed credential could not be opened") from exc
