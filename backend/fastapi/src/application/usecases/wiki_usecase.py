"""Use cases of the Personal Wiki store: workspaces, records, merging.

A close, simplified sibling of the Code Studio store (`codestore_usecase`): the same
rules, with no read-only links and no per-kind validation. The rules that live here
and nowhere else:

1. **Access.** A workspace is reached only with the key handed out at creation
   (`X-Wiki-Key`). Only its SHA-256 is stored, so a leaked JSON file or a dumped
   table gives nobody a way in. Wrong keys are counted per client address and, past
   a few, refused for a while.
2. **Validation.** Every record is checked and normalised before it is stored. The
   server never looks inside `data` (the client's note or card); it only requires a
   JSON object that can be written as UTF-8 and is at most `MAX_ITEM_BYTES` long. A
   device clock more than a day ahead is refused (it would win every later merge). A
   bad record refuses the WHOLE request, so nothing is stored by halves.
3. **Last writer wins, per record** (`domain.vo.wiki_vo.wins`), enforced atomically
   by the store, never by a read-compare-write here. A deletion is a tombstone, is
   kept, and loses its `data`.
4. **Quotas.** A workspace holds at most `max_items` records; when it is full,
   tombstones older than `tombstone_ttl_days` are discarded to make room. A client
   address may create only so many workspaces an hour.
5. **Sync cursor.** `serverTime` is the value to send back as `since`. It trails the
   real clock by `SYNC_LAG_MS`: a write that began before a poll but committed after
   it would otherwise be stamped older than the poll's cursor and never delivered.
   Replaying a record a device already has is harmless - merging is idempotent -
   losing one is not.
"""

from __future__ import annotations

import hashlib
import json
import secrets
import time
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

from src.application.exceptions.exceptions import (
    AppException,
    BadRequestError,
    NotFoundError,
    UnauthorizedError,
)
from src.application.ports.input.wiki_input_port import WikiInputPort
from src.application.ports.output.wiki_repository_port import WikiRepositoryPort
from src.application.utils.rate_limiter import LimiterLike, as_rate_limiter
from src.domain.vo.wiki_vo import (
    MAX_CLOCK_AHEAD_MS,
    MAX_ITEM_BYTES,
    MAX_PUT_BYTES,
    PutItemsRequest,
    Record,
    RecordIn,
    WorkspaceRecord,
    wins,
)

SYNC_LAG_MS = 2000
DEFAULT_PAGE_ITEMS = 200
#: One `GET` answer stays well under the 4.5 MB a serverless platform allows.
DEFAULT_PAGE_BYTES = 3_000_000
DAY_MS = 24 * 3600 * 1000


def hash_key(key: str) -> str:
    # Defined here, not shared: the digest is persisted and must not change
    # because an unrelated feature was edited.
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def now_ms() -> int:
    return int(time.time() * 1000)


def json_bytes(value: Any) -> int:
    """Size of `value` as the server answers with it: compact JSON, UTF-8, no NaN.

    Raises ValueError (TypeError, RecursionError) for what cannot be written that way:
    NaN/Infinity, a lone surrogate, a value that is not JSON, nesting too deep.
    """
    return len(json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode("utf-8"))


def item_bytes(item: Record) -> int:
    return json_bytes(item.model_dump())


def _bad(message: str, code: str, **extra: Any) -> BadRequestError:
    return BadRequestError(message, payload={"code": code, **extra})


def _too_fast(message: str, wait: int) -> AppException:
    return AppException(
        message=message, status_code=429, code="wiki_rate_limited",
        payload={"code": "wiki_rate_limited", "retryAfter": wait},
        headers={"Retry-After": str(wait)},
    )


class WikiUseCase(WikiInputPort):
    def __init__(
        self,
        repository: WikiRepositoryPort,
        *,
        max_items: int = 300_000,
        tombstone_ttl_days: int = 90,
        clock: Callable[[], int] = now_ms,
        workspace_limiter: Optional[LimiterLike] = None,
        failure_limiter: Optional[LimiterLike] = None,
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
            raise NotFoundError("Không gian làm việc không tồn tại", payload={"code": "wiki_not_found"})
        if not key:
            raise UnauthorizedError("Thiếu header X-Wiki-Key", payload={"code": "wiki_key_required"})
        # compare_digest keeps the check constant-time, so latency does not leak
        # how much of a guessed key was right.
        if not secrets.compare_digest(hash_key(key), record.key_hash):
            if self._failures is not None and ip:
                await self._failures.add(ip)
            raise UnauthorizedError("Khoá không đúng", payload={"code": "wiki_bad_key"})
        return record

    # ------------------------------------------------------------ workspaces
    async def create_workspace(self, ip: str) -> Dict[str, Any]:
        if self._creations is not None and ip:
            wait = await self._creations.retry_after(ip)
            if wait:
                raise _too_fast(f"Tạo không gian làm việc quá nhiều — thử lại sau {wait} giây", wait)
        key = secrets.token_urlsafe(24)
        record = WorkspaceRecord(
            id="wk_" + secrets.token_urlsafe(12),
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

        page: List[Record] = []
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
    def _normalise(self, item: RecordIn, now: int, stamp: int = 0) -> Record:
        """A validated, normalised copy of what a client sent."""
        if item.updatedAt > now + MAX_CLOCK_AHEAD_MS:
            raise _bad(
                "Đồng hồ thiết bị lệch hơn 1 ngày so với máy chủ — hãy chỉnh lại giờ rồi đồng bộ lại",
                "wiki_bad_clock", itemId=item.id,
            )
        if item.deleted:
            # A tombstone says only "this id is gone": the content is dropped.
            return Record(id=item.id, kind=item.kind, updatedAt=item.updatedAt, deleted=True, data={},
                          serverUpdatedAt=stamp)

        try:
            size = json_bytes(item.data)
        except (TypeError, ValueError, RecursionError) as cause:
            raise _bad("data không chuyển được thành JSON (UTF-8)", "wiki_bad_item", itemId=item.id) from cause
        if size > MAX_ITEM_BYTES:
            raise _bad(f"Bản ghi quá lớn ({size} byte, tối đa {MAX_ITEM_BYTES})", "wiki_bad_item", itemId=item.id)
        return Record(id=item.id, kind=item.kind, updatedAt=item.updatedAt, deleted=False, data=item.data,
                      serverUpdatedAt=stamp)

    async def put_items(
        self, workspace_id: str, key: str, request: PutItemsRequest, ip: str = ""
    ) -> Dict[str, Any]:
        await self._authorise(workspace_id, key, ip)
        now = self._clock()

        # Validate everything first: a bad record refuses the whole request
        # rather than leaving half of it stored.
        total = 0
        winners: Dict[str, Record] = {}
        order: List[str] = []
        for incoming in request.items:
            item = self._normalise(incoming, now)
            try:
                total += item_bytes(item)
            except (TypeError, ValueError, RecursionError) as cause:
                raise _bad("data không chuyển được thành JSON (UTF-8)", "wiki_bad_item", itemId=item.id) from cause
            if total > MAX_PUT_BYTES:
                raise _bad(f"Yêu cầu quá lớn (tối đa {MAX_PUT_BYTES} byte)", "wiki_too_large")
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
            await self._repo.upsert_newer(workspace_id, stamped)

        held_now = await self._repo.get_items(workspace_id, order) if order else {}
        return {
            "items": [held_now[item_id].model_dump() for item_id in order if item_id in held_now],
            "serverTime": max(0, self._clock() - SYNC_LAG_MS),
        }

    async def _make_room(self, workspace_id: str, ids: List[str], now: int) -> None:
        count = await self._repo.count_items(workspace_id)
        if count + len(ids) <= self._max_items:
            return                                  # even if every id were new, they fit: no need to read anything
        # Close to the limit: only records that are NEW take up room.
        existing = await self._repo.get_items(workspace_id, ids)
        new = sum(1 for item_id in ids if item_id not in existing)
        if new == 0 or count + new <= self._max_items:
            return
        await self._repo.delete_old_tombstones(workspace_id, now - self._tombstone_ttl_ms)
        count = await self._repo.count_items(workspace_id)
        # Look again: an old tombstone of an id in this request is gone now, and writing that id
        # takes a place up as a new record.
        existing = await self._repo.get_items(workspace_id, ids)
        new = sum(1 for item_id in ids if item_id not in existing)
        if count + new > self._max_items:
            raise _bad(
                f"Không gian làm việc đã đầy ({count}/{self._max_items} bản ghi) — hãy xoá bớt ghi chú cũ",
                "wiki_workspace_full", limit=self._max_items,
            )
