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
5. **Sync cursor.** `serverTime` is the value to send back as `since`. It
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
from typing import Any, Callable, Dict, List, Optional

from src.application.exceptions.exceptions import (
    AppException,
    BadRequestError,
    NotFoundError,
    UnauthorizedError,
)
from src.application.ports.input.codestore_input_port import CodestoreInputPort
from src.application.ports.output.codestore_repository_port import CodestoreRepositoryPort
from src.application.utils.rate_limit import FailureWindow
from src.application.utils.safe_paths import find_path_conflict, normalize_store_path
from src.domain.vo.codestore_vo import (
    MAX_CLOCK_AHEAD_MS,
    MAX_ITEM_BYTES,
    MAX_META_BYTES,
    MAX_PUT_BYTES,
    CodeFile,
    CodeItem,
    CodeItemIn,
    PutItemsRequest,
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


def item_bytes(item: CodeItemIn) -> int:
    return len(json.dumps(item.model_dump(), ensure_ascii=False).encode("utf-8"))


def _bad(message: str, code: str, **extra: Any) -> BadRequestError:
    return BadRequestError(message, payload={"code": code, **extra})


def _has_control(text: str) -> bool:
    return any(unicodedata.category(char) == "Cc" for char in text)


class CodestoreUseCase(CodestoreInputPort):
    def __init__(
        self,
        repository: CodestoreRepositoryPort,
        *,
        max_items: int = 2000,
        tombstone_ttl_days: int = 90,
        clock: Callable[[], int] = now_ms,
        workspace_limiter: Optional[FailureWindow] = None,
        failure_limiter: Optional[FailureWindow] = None,
        page_items: int = DEFAULT_PAGE_ITEMS,
        page_bytes: int = DEFAULT_PAGE_BYTES,
    ):
        self._repo = repository
        self._max_items = max(1, max_items)
        self._tombstone_ttl_ms = max(0, tombstone_ttl_days) * DAY_MS
        self._clock = clock
        self._creations = workspace_limiter
        self._failures = failure_limiter
        self._page_items = max(1, page_items)
        self._page_bytes = max(1, page_bytes)

    # ---------------------------------------------------------------- access
    async def _authorise(self, workspace_id: str, key: str, ip: str) -> WorkspaceRecord:
        if self._failures is not None and ip:
            wait = self._failures.retry_after(ip)
            if wait:
                raise AppException(
                    message=f"Nhập sai khoá quá nhiều lần — thử lại sau {wait} giây",
                    status_code=429, code="codestore_rate_limited",
                    payload={"code": "codestore_rate_limited", "retryAfter": wait},
                    headers={"Retry-After": str(wait)},
                )
        record = await self._repo.get_workspace(workspace_id)
        if record is None:
            raise NotFoundError("Không gian làm việc không tồn tại", payload={"code": "codestore_not_found"})
        if not key:
            raise UnauthorizedError("Thiếu header X-Codestore-Key", payload={"code": "codestore_key_required"})
        # compare_digest keeps the check constant-time, so latency does not leak
        # how much of a guessed key was right.
        if not secrets.compare_digest(hash_key(key), record.key_hash):
            if self._failures is not None and ip:
                self._failures.add(ip)
            raise UnauthorizedError("Khoá không đúng", payload={"code": "codestore_bad_key"})
        return record

    # ------------------------------------------------------------ workspaces
    async def create_workspace(self, ip: str) -> Dict[str, Any]:
        if self._creations is not None and ip:
            wait = self._creations.retry_after(ip)
            if wait:
                raise AppException(
                    message=f"Tạo không gian làm việc quá nhiều — thử lại sau {wait} giây",
                    status_code=429, code="codestore_rate_limited",
                    payload={"code": "codestore_rate_limited", "retryAfter": wait},
                    headers={"Retry-After": str(wait)},
                )
        key = secrets.token_urlsafe(24)
        record = WorkspaceRecord(
            id="cs_" + secrets.token_urlsafe(12),
            key_hash=hash_key(key),
            created_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        )
        await self._repo.create_workspace(record)
        if self._creations is not None and ip:
            self._creations.add(ip)
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
            await self._repo.upsert_newer(workspace_id, stamped)

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
