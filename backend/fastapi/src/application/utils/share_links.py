"""What every read-only share link has in common, whichever app it belongs to.

Pure (no HTTP, no storage): the token, the content hash, the 429 a public read
answers when it is too fast, and the guard that counts public reads and wrong tokens
per client address. The semantics copy `CodestoreUseCase.read_shared`, which keeps its
own code for now (moving it here is the optional md-share V18, postponed by Q8).

A token is the whole read key of a link: 16 random bytes (128 bits) of
`secrets.token_urlsafe`, 22 characters of ``[A-Za-z0-9_-]``. Nothing here ever logs one.
"""

from __future__ import annotations

import re
import secrets
from typing import Optional

from src.application.exceptions.exceptions import AppException
from src.application.utils.hashing import sha256_hex
from src.application.utils.rate_limiter import LimiterLike, as_rate_limiter

#: 16 random bytes = 128 bits: guessing one is hopeless, so a link needs no password.
SHARE_TOKEN_BYTES = 16
#: What a token may look like when it arrives. Anything else is answered exactly like an
#: unknown token (the caller cannot tell "malformed" from "revoked").
TOKEN_SHAPE = re.compile(r"^[A-Za-z0-9_-]{16,100}$")


def new_share_token() -> str:
    return secrets.token_urlsafe(SHARE_TOKEN_BYTES)


def token_well_formed(token: Optional[str]) -> bool:
    return bool(token) and TOKEN_SHAPE.fullmatch(token or "") is not None


def content_hash(text: str) -> str:
    """The snapshot's hash: the shared `sha256_hex`, so the browser can compare it."""
    return sha256_hex(text)


def rate_limited(code: str, message: str, wait: int) -> AppException:
    """429 with `data.retryAfter` and a `Retry-After` header (seconds)."""
    wait = max(1, int(wait))
    return AppException(
        message=message, status_code=429, code=code,
        payload={"code": code, "retryAfter": wait},
        headers={"Retry-After": str(wait)},
    )


class PublicReadGuard:
    """Rate limits of a public read, per client address.

    `admit` first refuses an address that guessed too many wrong tokens (counted apart
    from reads, so a link opened by many people behind one address cannot be locked by
    the reads themselves), then one that reads too fast, and only then counts the read.
    `missed` counts one wrong token. An empty address (no client information) is never
    limited: there is nothing to key the counter on.
    """

    def __init__(
        self,
        reads: Optional[LimiterLike] = None,
        misses: Optional[LimiterLike] = None,
        *,
        code: str,
        too_many_misses: str = "Mở liên kết chia sẻ sai quá nhiều lần — thử lại sau {wait} giây",
        too_many_reads: str = "Mở liên kết chia sẻ quá nhiều — thử lại sau {wait} giây",
    ):
        self._reads = as_rate_limiter(reads)
        self._misses = as_rate_limiter(misses)
        self._code = code
        self._too_many_misses = too_many_misses
        self._too_many_reads = too_many_reads

    async def admit(self, ip: str) -> None:
        if not ip:
            return
        if self._misses is not None:
            wait = await self._misses.retry_after(ip)
            if wait:
                raise rate_limited(self._code, self._too_many_misses.format(wait=wait), wait)
        if self._reads is not None:
            wait = await self._reads.retry_after(ip)
            if wait:
                raise rate_limited(self._code, self._too_many_reads.format(wait=wait), wait)
            await self._reads.add(ip)

    async def missed(self, ip: str) -> None:
        if ip and self._misses is not None:
            await self._misses.add(ip)
