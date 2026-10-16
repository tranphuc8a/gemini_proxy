"""Use cases of the Code Studio store: workspaces, records, merging.

The rules that live here and nowhere else:

1. **Access.** A workspace is reached only with the key handed out at creation
   (`X-Codestore-Key`). Only its SHA-256 is stored, so a leaked JSON file or a
   dumped table gives nobody a way in. Wrong keys are counted per client
   address and, past a few, refused for a while.
2. **Validation.** Every record is checked and normalised before it is stored:
   snippets have exactly one file, projects at least one, file paths cannot climb
   (`..`), be absolute or hold control characters, `meta` and the whole record
   have byte limits, and a device clock more than a day ahead is refused (it
   would win every later merge).
3. **Last writer wins, per record** (`domain.vo.codestore_vo.wins`), enforced
   atomically by the store, never by a read-compare-write here. A deletion is a
   tombstone and is kept.
4. **Quotas.** A workspace holds at most `max_items` records; when it is full,
   tombstones older than `tombstone_ttl_days` are discarded to make room. A
   client address may create only so many workspaces an hour.
5. **Read-only links** (`create_share`...). A link is a token that reads a FROZEN
   copy (snapshot) of one stored record: the owner publishes a version on purpose,
   later edits stay private until the owner publishes again, and nothing a reader
   does can reach the workspace. The token is the read key, so it is 128 bits of
   `secrets.token_urlsafe`, never logged, and a link dies with the record (a
   tombstone) and with the workspace. The public read is rate limited per client
   address, and so are wrong tokens.
6. **Sync cursor.** `serverTime` is the value to send back as `since`. It
   trails the real clock by `SYNC_LAG_MS`: a write that began before a poll but
   committed after it would otherwise be stamped older than the poll's cursor
   and never delivered. Replaying a record a device already has is harmless -
   merging is idempotent - losing one is not.
"""

from __future__ import annotations

import hashlib
import json
import secrets
import time
import unicodedata
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Tuple

from src.application.exceptions.exceptions import (
    AppException,
    BadRequestError,
    NotFoundError,
    UnauthorizedError,
)
from src.application.ports.input.codestore_input_port import CodestoreInputPort
from src.application.ports.output.codestore_repository_port import CodestoreRepositoryPort
from src.application.utils.rate_limiter import LimiterLike, as_rate_limiter
from src.application.utils.safe_paths import find_path_conflict, normalize_store_path
from src.domain.vo.codestore_vo import (
    MAX_CLOCK_AHEAD_MS,
    MAX_ITEM_BYTES,
    MAX_META_BYTES,
    MAX_PUT_BYTES,
    PRIVATE_META_KEYS,
    CodeFile,
    CodeItem,
    CodeItemIn,
    PutItemsRequest,
    ShareRecord,
    WorkspaceRecord,
    wins,
)

SYNC_LAG_MS = 2000
DEFAULT_PAGE_ITEMS = 200
#: One `GET` answer stays well under the 4.5 MB a serverless platform allows.
DEFAULT_PAGE_BYTES = 3_000_000
DAY_MS = 24 * 3600 * 1000
#: 16 random bytes = 128 bits: the token is the whole read key of a link.
SHARE_TOKEN_BYTES = 16
SHARE_NOT_FOUND = "Liên kết chia sẻ không tồn tại hoặc đã bị thu hồi"


def hash_key(key: str) -> str:
    # Defined here, not shared: the digest is persisted and must not change
    # because an unrelated feature was edited.
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def now_ms() -> int:
    return int(time.time() * 1000)


def item_bytes(item: CodeItemIn) -> int:
    return len(json.dumps(item.model_dump(), ensure_ascii=False).encode("utf-8"))


def _bad(message: str, code: str, **extra: Any) -> BadRequestError:
    return BadRequestError(message, payload={"code": code, **extra})


def _has_control(text: str) -> bool:
    return any(unicodedata.category(char) == "Cc" for char in text)


def _too_fast(message: str, wait: int) -> AppException:
    return AppException(
        message=message, status_code=429, code="codestore_rate_limited",
        payload={"code": "codestore_rate_limited", "retryAfter": wait},
        headers={"Retry-After": str(wait)},
    )


def public_item(item: CodeItem) -> Dict[str, Any]:
    """What a read-only link shows of a record: no workspace, no server clock, and none
    of the owner's editor state (`PRIVATE_META_KEYS`)."""
    return {
        "id": item.id, "kind": item.kind, "name": item.name, "language": item.language,
        "files": [{"path": file.path, "content": file.content} for file in item.files],
        "meta": {name: value for name, value in item.meta.items() if name not in PRIVATE_META_KEYS},
        "updatedAt": item.updatedAt,
    }


class CodestoreUseCase(CodestoreInputPort):
    def __init__(
        self,
        repository: CodestoreRepositoryPort,
        *,
        max_items: int = 2000,
        tombstone_ttl_days: int = 90,
        clock: Callable[[], int] = now_ms,
        workspace_limiter: Optional[LimiterLike] = None,
        failure_limiter: Optional[LimiterLike] = None,
        share_read_limiter: Optional[LimiterLike] = None,
        share_failure_limiter: Optional[LimiterLike] = None,
        max_shares: int = 50,
        token_factory: Callable[[], str] = lambda: secrets.token_urlsafe(SHARE_TOKEN_BYTES),
        page_items: int = DEFAULT_PAGE_ITEMS,
        page_bytes: int = DEFAULT_PAGE_BYTES,
    ):
        self._repo = repository
        self._max_items = max(1, max_items)
        self._tombstone_ttl_ms = max(0, tombstone_ttl_days) * DAY_MS
        self._clock = clock
        # Counters (`RateLimiterPort`): memory, or shared between instances. The legacy
        # in-process `FailureWindow` is still accepted.
        self._creations = as_rate_limiter(workspace_limiter)
        self._failures = as_rate_limiter(failure_limiter)
        self._share_reads = as_rate_limiter(share_read_limiter)
        self._share_failures = as_rate_limiter(share_failure_limiter)
        self._max_shares = max(1, max_shares)
        self._new_token = token_factory
        self._page_items = max(1, page_items)
        self._page_bytes = max(1, page_bytes)

    # ---------------------------------------------------------------- access
    async def _authorise(self, workspace_id: str, key: str, ip: str) -> WorkspaceRecord:
        if self._failures is not None and ip:
            wait = await self._failures.retry_after(ip)
            if wait:
                raise _too_fast(f"Nhập sai khoá quá nhiều lần — thử lại sau {wait} giây", wait)
        record = await self._repo.get_workspace(workspace_id)
        if record is None:
            raise NotFoundError("Không gian làm việc không tồn tại", payload={"code": "codestore_not_found"})
        if not key:
            raise UnauthorizedError("Thiếu header X-Codestore-Key", payload={"code": "codestore_key_required"})
        # compare_digest keeps the check constant-time, so latency does not leak
        # how much of a guessed key was right.
        if not secrets.compare_digest(hash_key(key), record.key_hash):
            if self._failures is not None and ip:
                await self._failures.add(ip)
            raise UnauthorizedError("Khoá không đúng", payload={"code": "codestore_bad_key"})
        return record

    # ------------------------------------------------------------ workspaces
    async def create_workspace(self, ip: str) -> Dict[str, Any]:
        if self._creations is not None and ip:
            wait = await self._creations.retry_after(ip)
            if wait:
                raise _too_fast(f"Tạo không gian làm việc quá nhiều — thử lại sau {wait} giây", wait)
        key = secrets.token_urlsafe(24)
        record = WorkspaceRecord(
            id="cs_" + secrets.token_urlsafe(12),
            key_hash=hash_key(key),
            created_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        )
        await self._repo.create_workspace(record)
        if self._creations is not None and ip:
            await self._creations.add(ip)
        return {"workspaceId": record.id, "key": key}

    async def delete_workspace(self, workspace_id: str, key: str, ip: str = "") -> bool:
        await self._authorise(workspace_id, key, ip)
        return await self._repo.delete_workspace(workspace_id)

    # ------------------------------------------------------------------ read
    async def list_items(
        self, workspace_id: str, key: str, since: int, limit: Optional[int] = None, ip: str = ""
    ) -> Dict[str, Any]:
        await self._authorise(workspace_id, key, ip)
        size = min(limit or self._page_items, self._page_items)
        found = await self._repo.list_since(workspace_id, max(0, since), size + 1)
        more = len(found) > size

        page: List[CodeItem] = []
        used = 0
        for item in found[:size]:
            weight = item_bytes(item)
            if page and used + weight > self._page_bytes:
                more = True
                break
            page.append(item)
            used += weight

        if more and page and found[len(page)].serverUpdatedAt == page[-1].serverUpdatedAt:
            # The cursor is `serverUpdatedAt` and the next call asks for strictly more, so a page
            # must not end between two records that carry the same stamp (two requests landing in
            # the same few milliseconds can stamp alike): the second would never be delivered.
            # End the page before that run instead; it is a little shorter, never lossy.
            stamp = page[-1].serverUpdatedAt
            keep = len(page)
            while keep > 0 and page[keep - 1].serverUpdatedAt == stamp:
                keep -= 1
            if keep > 0:
                page = page[:keep]
        if more and page:
            # A cursor, not a clock: the next call continues right after this page.
            server_time = page[-1].serverUpdatedAt
        else:
            server_time = max(since, self._clock() - SYNC_LAG_MS)
        return {"items": [item.model_dump() for item in page], "serverTime": server_time, "more": more}

    # ----------------------------------------------------------------- write
    def _normalise(self, item: CodeItemIn, now: int, stamp: int = 0) -> CodeItem:
        """A validated, normalised copy of what a client sent."""
        def refuse(message: str) -> BadRequestError:
            return _bad(message, "codestore_bad_item", itemId=item.id)

        if item.updatedAt > now + MAX_CLOCK_AHEAD_MS:
            raise _bad(
                "Đồng hồ thiết bị lệch hơn 1 ngày so với máy chủ — hãy chỉnh lại giờ rồi đồng bộ lại",
                "codestore_bad_clock", itemId=item.id,
            )
        name = item.name.strip()
        if _has_control(name):
            raise refuse("Tên chứa ký tự điều khiển")

        if item.deleted:
            # A tombstone says only "this id is gone": the content is dropped.
            return CodeItem(id=item.id, kind=item.kind, name=name, language=item.language, files=[], meta={},
                            updatedAt=item.updatedAt, deleted=True, serverUpdatedAt=stamp)

        if not item.files:
            raise refuse("Bản ghi cần ít nhất một tệp")
        if item.kind == "snippet" and len(item.files) != 1:
            raise refuse("Đoạn mã (snippet) chỉ gồm đúng một tệp")
        files: List[CodeFile] = []
        for file in item.files:
            try:
                path = normalize_store_path(file.path)
            except ValueError as cause:
                raise refuse(str(cause)) from cause
            files.append(CodeFile(path=path, content=file.content))
        conflict = find_path_conflict([file.path for file in files])
        if conflict:
            raise refuse(conflict)

        try:
            meta_size = len(json.dumps(item.meta, ensure_ascii=False).encode("utf-8"))
        except (TypeError, ValueError) as cause:
            raise refuse("meta không chuyển được thành JSON") from cause
        if meta_size > MAX_META_BYTES:
            raise refuse(f"meta quá lớn ({meta_size} byte, tối đa {MAX_META_BYTES})")

        clean = CodeItem(id=item.id, kind=item.kind, name=name, language=item.language, files=files,
                         meta=item.meta, updatedAt=item.updatedAt, deleted=False, serverUpdatedAt=stamp)
        size = item_bytes(clean)
        if size > MAX_ITEM_BYTES:
            raise refuse(f"Bản ghi quá lớn ({size} byte, tối đa {MAX_ITEM_BYTES})")
        return clean

    async def put_items(
        self, workspace_id: str, key: str, request: PutItemsRequest, ip: str = ""
    ) -> Dict[str, Any]:
        await self._authorise(workspace_id, key, ip)
        now = self._clock()

        # Validate everything first: a bad record refuses the whole request
        # rather than leaving half of it stored.
        total = 0
        winners: Dict[str, CodeItem] = {}
        order: List[str] = []
        for incoming in request.items:
            item = self._normalise(incoming, now)
            total += item_bytes(item)
            if total > MAX_PUT_BYTES:
                raise _bad(f"Yêu cầu quá lớn (tối đa {MAX_PUT_BYTES} byte)", "codestore_too_large")
            held = winners.get(item.id)
            if held is None:
                order.append(item.id)
                winners[item.id] = item
            elif wins(item.updatedAt, item.deleted, held.updatedAt, held.deleted):
                winners[item.id] = item          # the same id twice in one request

        if order:
            await self._make_room(workspace_id, order, now)
            # Distinct stamps within one request: a paged `GET` cuts between
            # records and must never cut through two that share a stamp.
            stamped = [winners[item_id].model_copy(update={"serverUpdatedAt": now + index})
                       for index, item_id in enumerate(order)]
            written = await self._repo.upsert_newer(workspace_id, stamped)
            # A deleted record takes its read-only links with it. Only deletions that
            # actually replaced the stored record count: one that lost to a newer edit
            # changed nothing, and the record (and its link) is still there.
            gone = [item_id for item_id in written if winners[item_id].deleted]
            if gone:
                await self._repo.delete_shares(workspace_id, gone)

        held_now = await self._repo.get_items(workspace_id, order) if order else {}
        return {
            "items": [held_now[item_id].model_dump() for item_id in order if item_id in held_now],
            "serverTime": max(0, self._clock() - SYNC_LAG_MS),
        }

    async def _make_room(self, workspace_id: str, ids: List[str], now: int) -> None:
        existing = await self._repo.get_items(workspace_id, ids)
        new = sum(1 for item_id in ids if item_id not in existing)
        if new == 0:
            return
        count = await self._repo.count_items(workspace_id)
        if count + new <= self._max_items:
            return
        await self._repo.purge_tombstones(workspace_id, now - self._tombstone_ttl_ms)
        count = await self._repo.count_items(workspace_id)
        if count + new > self._max_items:
            raise _bad(
                f"Không gian làm việc đã đầy ({count}/{self._max_items} bản ghi) — hãy xoá bớt đoạn mã hoặc dự án cũ",
                "codestore_workspace_full", limit=self._max_items,
            )

    # ---------------------------------------------------------- read-only links
    async def create_share(
        self, workspace_id: str, key: str, item_id: str, ip: str = ""
    ) -> Tuple[bool, Dict[str, Any]]:
        await self._authorise(workspace_id, key, ip)
        item = (await self._repo.get_items(workspace_id, [item_id])).get(item_id)
        if item is None or item.deleted:
            # The server shows only what it holds: a record that was never synced
            # (or was deleted) has nothing to freeze.
            raise NotFoundError(
                "Bản ghi chưa có trên máy chủ (hãy đồng bộ trước khi chia sẻ) hoặc đã bị xoá",
                payload={"code": "codestore_item_not_found", "itemId": item_id},
            )
        existing = await self._repo.get_share_for_item(workspace_id, item_id)
        if existing is None and await self._repo.count_shares(workspace_id) >= self._max_shares:
            raise _bad(
                f"Không gian làm việc đã có {self._max_shares} liên kết chia sẻ — hãy thu hồi bớt liên kết cũ",
                "codestore_too_many_shares", limit=self._max_shares,
            )
        now = self._clock()
        # The snapshot is the stored record (already within MAX_ITEM_BYTES), minus the server's clock.
        stored = await self._repo.save_share(ShareRecord(
            token=existing.token if existing else self._new_token(),
            workspace_id=workspace_id, item_id=item_id, name=item.name,
            shared_at=existing.shared_at if existing else now, updated_at=now,
            item=item.model_copy(update={"serverUpdatedAt": 0}),
        ))
        return existing is None, {"token": stored.token, "sharedAt": stored.shared_at, "updatedAt": stored.updated_at}

    async def list_shares(self, workspace_id: str, key: str, ip: str = "") -> Dict[str, Any]:
        await self._authorise(workspace_id, key, ip)
        return {"shares": [
            {"token": share.token, "itemId": share.item_id, "name": share.name,
             "sharedAt": share.shared_at, "updatedAt": share.updated_at}
            for share in await self._repo.list_shares(workspace_id)
        ]}

    async def revoke_share(self, workspace_id: str, key: str, item_id: str, ip: str = "") -> Dict[str, Any]:
        await self._authorise(workspace_id, key, ip)
        if not await self._repo.delete_share(workspace_id, item_id):
            raise NotFoundError("Bản ghi này chưa được chia sẻ", payload={"code": "codestore_share_not_found"})
        return {"revoked": True}

    async def read_shared(self, token: str, ip: str = "") -> Dict[str, Any]:
        if ip and self._share_failures is not None:
            wait = await self._share_failures.retry_after(ip)
            if wait:
                raise _too_fast(f"Mở liên kết chia sẻ sai quá nhiều lần — thử lại sau {wait} giây", wait)
        if ip and self._share_reads is not None:
            wait = await self._share_reads.retry_after(ip)
            if wait:
                raise _too_fast(f"Mở liên kết chia sẻ quá nhiều — thử lại sau {wait} giây", wait)
            await self._share_reads.add(ip)
        share = await self._repo.get_share(token) if token else None
        if share is None:
            # Unknown, malformed and revoked tokens are answered alike, and counted:
            # guessing a 128-bit token is hopeless, but a scanner should still be slowed.
            if ip and self._share_failures is not None:
                await self._share_failures.add(ip)
            raise NotFoundError(SHARE_NOT_FOUND, payload={"code": "codestore_share_not_found"})
        return {"item": public_item(share.item), "sharedAt": share.shared_at}
