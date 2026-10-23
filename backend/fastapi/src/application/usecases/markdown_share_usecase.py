"""Use cases of the markdown editor's read-only share links.

The rules that live here and nowhere else:

1. **Snapshot.** A link reads a FROZEN copy of one document, sent in the request body
   by an administrator (never read from the server's tree: saving that tree overwrites
   it whole, and asking the owner to save first could erase another device's work).
   Sharing the same document again refreshes the copy and keeps the token.
2. **One link per document**, at most `max_shares` per store. When the store is full,
   expired links are dropped first; only then is a new link refused.
3. **The token is the read key**: 128 bits, never logged (neither is the content). An
   unknown, malformed, revoked or expired token gets one and the same 404, and is
   counted against the client address; reads are counted too (`PublicReadGuard`).
4. **The public read reveals nothing else**: no document id, token, hash, size, store
   name or folder - only the title, the text and the dates. A store failure on that path
   (the driver's message carries the statement AND the bound token) becomes one generic
   503: neither logged nor returned, only the exception's class name is.
5. **An expired link is gone.** Sharing a document whose link has expired makes a NEW link
   (new token, new `sharedAt`): whoever kept the old address must not read the new snapshot.
6. **Validation.** The document id has the shape every markdown feature shares
   (`markdown_ids`); `root` cannot be shared; the title is trimmed and has no control
   characters; the snapshot's size is measured in UTF-8 bytes against `max_bytes`.
"""

from __future__ import annotations

import logging
import time
import unicodedata
from typing import Any, Callable, Dict, Optional, Tuple

from src.application.exceptions.exceptions import AppException, BadRequestError, ConflictError, NotFoundError
from src.application.ports.input.markdown_share_input_port import MarkdownShareInputPort
from src.application.ports.output.markdown_share_repository_port import MarkdownShareConflict, MarkdownShareRepositoryPort
from src.application.utils.rate_limiter import LimiterLike
from src.application.utils.share_links import PublicReadGuard, content_hash, new_share_token, token_well_formed
from src.domain.vo.markdown_ids import UNSHAREABLE_DOC_IDS, is_doc_id
from src.domain.vo.markdown_share_vo import MAX_TITLE_CHARS, MarkdownShareIn, MarkdownShareRecord, MarkdownShareSummary

logger = logging.getLogger(__name__)

DAY_MS = 24 * 3600 * 1000
#: One message for every way a token can fail, so a reader cannot tell them apart.
SHARE_NOT_FOUND = "Liên kết chia sẻ không tồn tại, đã hết hạn hoặc đã bị thu hồi"
RATE_CODE = "markdown_rate_limited"
UNAVAILABLE_CODE = "markdown_share_unavailable"
CONFLICT_CODE = "markdown_share_conflict"


def store_unavailable(cause: BaseException) -> AppException:
    """The one answer to a store that failed while a stranger was reading a link.

    Nothing of `cause` goes out or into the log but its class name: a SQLAlchemy/driver message holds
    `[parameters: (<token>,)]` (md-share §3.3: a token is never logged)."""
    logger.error("markdown share read failed: %s", type(cause).__name__)
    return AppException(
        "Chưa mở được liên kết chia sẻ lúc này — thử lại sau ít phút",
        status_code=503, code=UNAVAILABLE_CODE, payload={"code": UNAVAILABLE_CODE},
    )


def now_ms() -> int:
    return int(time.time() * 1000)


def _bad(message: str, code: str, **extra: Any) -> BadRequestError:
    return BadRequestError(message, payload={"code": code, **extra})


def _has_control(text: str) -> bool:
    return any(unicodedata.category(char) == "Cc" for char in text)


def _summary_json(share: MarkdownShareSummary) -> Dict[str, Any]:
    return {
        "token": share.token, "docId": share.doc_id, "title": share.title, "mode": share.mode,
        "sharedAt": share.shared_at, "updatedAt": share.updated_at, "expiresAt": share.expires_at,
        "bytes": share.bytes, "contentHash": share.content_hash,
    }


class MarkdownShareUseCase(MarkdownShareInputPort):
    def __init__(
        self,
        repository: MarkdownShareRepositoryPort,
        *,
        clock: Callable[[], int] = now_ms,
        token_factory: Callable[[], str] = new_share_token,
        max_shares: int = 50,
        max_bytes: int = 2_000_000,
        read_limiter: Optional[LimiterLike] = None,
        miss_limiter: Optional[LimiterLike] = None,
        persistent: bool = True,
    ):
        self._repo = repository
        self._clock = clock
        self._new_token = token_factory
        self._max_shares = max(1, int(max_shares))
        self._max_bytes = max(1, int(max_bytes))
        self._guard = PublicReadGuard(read_limiter, miss_limiter, code=RATE_CODE)
        self._persistent = bool(persistent)

    # ------------------------------------------------------------ owner side
    async def create_or_refresh(self, request: MarkdownShareIn) -> Tuple[bool, Dict[str, Any]]:
        doc_id = request.docId
        if not is_doc_id(doc_id):
            raise _bad("Mã tài liệu không hợp lệ", "markdown_share_bad_input", field="docId")
        if doc_id in UNSHAREABLE_DOC_IDS:
            raise _bad("Không chia sẻ được thư mục gốc", "markdown_share_bad_input", field="docId")
        title = request.title.strip()[:MAX_TITLE_CHARS]
        if not title or _has_control(title):
            raise _bad("Tiêu đề trống hoặc có ký tự điều khiển", "markdown_share_bad_input", field="title")
        if request.mode != "snapshot":                 # unreachable through the VO; a guard for direct callers
            raise _bad("Chỉ hỗ trợ chế độ ảnh chụp (snapshot)", "markdown_share_bad_input", field="mode")
        content = request.content or ""
        size = len(content.encode("utf-8"))
        if size > self._max_bytes:
            raise _bad(
                f"Tài liệu quá lớn để chia sẻ ({size:,} byte, tối đa {self._max_bytes:,} byte)",
                "markdown_share_too_large", limit=self._max_bytes, bytes=size,
            )

        existing = await self._repo.get_by_doc(doc_id)
        now = self._clock()
        if existing is not None and existing.expires_at is not None and existing.expires_at <= now:
            # Refreshing an expired link would bring back the very token its holders were told is dead.
            # Drop it: what follows is a new link (new token, new `sharedAt`), at no cost to the quota.
            await self._repo.delete_by_doc(doc_id)
            existing = None
        if existing is None and await self._repo.count() >= self._max_shares:
            await self._repo.purge_expired(now)
            if await self._repo.count() >= self._max_shares:
                raise _bad(
                    f"Đã có {self._max_shares} liên kết chia sẻ — hãy thu hồi bớt liên kết cũ",
                    "markdown_too_many_shares", limit=self._max_shares,
                )
        expires_at = now + request.expiresInDays * DAY_MS if request.expiresInDays else None
        try:
            stored = await self._repo.save(MarkdownShareRecord(
                token=existing.token if existing else self._new_token(),
                doc_id=doc_id, title=title, mode="snapshot",
                shared_at=existing.shared_at if existing else now, updated_at=now,
                expires_at=expires_at, bytes=size, content_hash=content_hash(content), content=content,
            ))
        except MarkdownShareConflict:
            raise ConflictError(
                "Một tài liệu khác có mã chỉ khác hoa/thường đã có liên kết chia sẻ — "
                "thu hồi liên kết đó hoặc đổi tên một trong hai tài liệu",
                payload={"code": CONFLICT_CODE},
            ) from None
        return existing is None, _summary_json(stored)

    async def list_shares(self) -> Dict[str, Any]:
        now = self._clock()
        shares = []
        for share in await self._repo.list():
            entry = _summary_json(share)
            entry["expired"] = share.expires_at is not None and share.expires_at <= now
            shares.append(entry)
        return {
            "shares": shares,
            "limits": {"maxShares": self._max_shares, "maxBytes": self._max_bytes},
            "persistent": self._persistent,
        }

    async def revoke(self, doc_id: str) -> Dict[str, Any]:
        if not is_doc_id(doc_id) or not await self._repo.delete_by_doc(doc_id):
            raise NotFoundError("Tài liệu này chưa được chia sẻ", payload={"code": "markdown_share_not_found"})
        return {"revoked": True}

    # ------------------------------------------------------------ public read
    async def read_shared(self, token: str, ip: str = "") -> Dict[str, Any]:
        await self._guard.admit(ip)
        try:
            share = await self._repo.get(token) if token_well_formed(token) else None
        except AppException:
            raise
        except Exception as cause:  # noqa: BLE001 - whatever the driver raised: see `store_unavailable`
            raise store_unavailable(cause) from None
        if share is not None and share.expires_at is not None and share.expires_at <= self._clock():
            share = None
        if share is None or share.content is None:
            await self._guard.missed(ip)
            raise NotFoundError(SHARE_NOT_FOUND, payload={"code": "markdown_share_not_found"})
        return {
            "title": share.title, "content": share.content, "mode": share.mode,
            "sharedAt": share.shared_at, "updatedAt": share.updated_at, "expiresAt": share.expires_at,
        }
