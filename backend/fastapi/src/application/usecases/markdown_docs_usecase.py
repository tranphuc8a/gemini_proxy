"""Use cases of the markdown delta sync (md-sync B6-B8, B10; ke-hoach M4a).

The rules that live here and nowhere else:

1. **One record per node, compare-and-set on `rev`.** A push carries only the nodes that
   changed; each op is judged on its own (`_plan`, pure) and written with `cas_write`
   (`insert` for a new id), re-reading and deciding again if another request got there
   first. There is no "newest wins": a stale write is a `conflict` the client merges.
2. **Content and meta are judged apart.** `contentRev` moves when the text (or the deleted
   state) changes, `metaRev` when the name or parent does. An op based on an older `rev`
   still passes if the part it changes was not touched since: a rename and an edit made
   on two devices both stand.
3. **Edit beats delete.** An edit against a tombstone, and a delete of a node edited since,
   come back as `conflict ["deleted"]`; only an explicit `deleted: false` (with the text)
   brings a node back.
4. **Replays are harmless.** An op whose result already is the stored state answers `ok`
   without writing, so a push whose answer was lost can be sent again.
5. **The server verifies, never trusts.** A patch applies only if `baseHash` is the stored
   hash and the result hashes to the op's `hash`; whole text is hashed too. The size budget
   (`max_doc_bytes`, `max_push_bytes`) is in UTF-8 bytes.
6. **History from day one** (`_write_history`): a row whenever a file's text changes, on
   delete and on restore - the newest full text every 50 rows or when small (a keyframe),
   otherwise a line delta against the latest keyframe; same-device edits within 10 minutes
   collapse into one row; `history_retention` decides what is kept. A history failure is
   logged and never fails the push (a missing row, not a lost document).
7. **Lazy migration** (`ensure_migrated`): the old whole-tree store is copied once, by the
   first call to a `/markdown/sync/*` route, claimed with a `markdown_meta` row so exactly
   one process does it; the old data is never touched.
8. **Cursor.** `cursor` trails the clock by `SYNC_LAG_MS` (a write that began before a poll
   but committed after it must still be newer than the cursor); a page never ends between
   two equal stamps (`sync_paging`). `horizon` is the newest purge of old tombstones: a
   client whose cursor is older must re-reconcile (`reset`).
9. **Bounded work.** What a request costs must not scale with a document's size in a way that stalls the process or
   overruns the host: the text one push answer carries is budgeted (`_conflict`: a record that does not fit comes back
   with `contentOmitted` and is fetched by id), and the CPU of a big document (diff, zlib, a patch applied to a stored
   megabyte, the migration's hashing) runs in a worker thread (`_cpu`), never inline on the event loop.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import time
import traceback
import unicodedata
import zlib
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

from src.application.exceptions.exceptions import AppException, NotFoundError
from src.application.ports.input.markdown_docs_input_port import MarkdownDocsInputPort
from src.application.ports.output.markdown_docs_repository_port import (
    LegacyMarkdownReaderPort,
    MarkdownDocsRepositoryPort,
)
from src.application.ports.output.markdown_share_repository_port import MarkdownShareRepositoryPort
from src.application.utils.history_retention import DAY_MS, select_keep
from src.application.utils.line_patch import MAX_DIFF_LINES, apply_patch, make_delta, patch_json, sha256_hex
from src.application.utils.sync_paging import cut_page
from src.domain.vo.markdown_docs_vo import (
    DEFAULT_SPACE,
    LEGACY_DEVICE,
    MAX_CLOCK_AHEAD_MS,
    MAX_DOC_BYTES,
    MAX_DOCS,
    MAX_NAME_CHARS,
    MAX_PUSH_BYTES,
    PAGE_BYTES,
    PAGE_ITEMS,
    SYNC_LAG_MS,
    DocRecord,
    PushOp,
    PushRequest,
    Revision,
)
from src.domain.vo.markdown_ids import is_doc_id

logger = logging.getLogger(__name__)

MIGRATION_KEY = "migrated_v1"
HORIZON_KEY = "horizon"
#: A claim older than this is a crashed migration: another process may take it over (the inserts are idempotent).
MIGRATION_LEASE_MS = 5 * 60 * 1000
MAINTENANCE_EVERY_MS = 6 * 3600 * 1000
#: Texts below this size are always stored whole in history: a delta would not be smaller.
FULL_BELOW_BYTES = 2048
KEYFRAME_EVERY = 50
COMPRESS_ABOVE_BYTES = 32 * 1024
#: Texts up to this size are diffed / compressed / planned inline; bigger ones go to a worker thread so that the
#: CPU time of one big document (a diff, zlib, a patch applied to a megabyte) never stalls the event loop - and with
#: it every other request of the process.
INLINE_CPU_BYTES = 32 * 1024
#: A delta bigger than this fraction of the text is not worth keeping: store the text.
DELTA_MAX_RATIO = 0.5
ITEM_OVERHEAD_BYTES = 400
MAX_STAMP_RUN_FETCH = 5000
DEFAULT_REVISION_PAGE = 50
MAX_REVISION_PAGE = 200
UNSET = object()


def now_ms() -> int:
    return int(time.time() * 1000)


def utf8_len(text: str) -> int:
    return len(text.encode("utf-8", "replace"))


def _error(status: int, code: str, message: str, headers: Optional[Dict[str, str]] = None) -> AppException:
    return AppException(message=message, status_code=status, code=code, payload={"code": code}, headers=headers)


UNAVAILABLE_CODE = "md_store_unavailable"


def store_unavailable(cause: BaseException) -> AppException:
    """The one answer to a store that failed (a database down, a disk full).

    Nothing of `cause` goes out or into the log but its class name and the stack frames: a SQLAlchemy / driver
    message holds the database host, the statement and `[parameters: ...]` - with a push, the text of the document -
    and the app-wide handler of an unexpected error would send all of it to the caller (which is a stranger when
    `MARKDOWN_PUBLIC_READ` is on)."""
    # The frames (file, line, source text) say WHERE a programming error happened - a KeyError must not look like a
    # database that is down - and carry no message, locals or parameters.
    frames = "".join(traceback.format_tb(cause.__traceback__)).rstrip()
    logger.error("markdown sync store failed: %s\n%s", type(cause).__name__, frames)
    return AppException(
        "Kho tài liệu chưa phản hồi lúc này — thử lại sau ít phút",
        status_code=503, code=UNAVAILABLE_CODE, payload={"code": UNAVAILABLE_CODE}, headers={"Retry-After": "5"},
    )


def _has_control(text: str) -> bool:
    return any(unicodedata.category(char) == "Cc" for char in text)


# ------------------------------------------------------------------ history codec
def pack_body(text: str) -> Tuple[str, bool]:
    """`(body, compressed)`: big texts are zlib + base64 (a megabyte of prose is a few hundred KB)."""
    raw = text.encode("utf-8")
    if len(raw) <= COMPRESS_ABOVE_BYTES:
        return text, False
    return base64.b64encode(zlib.compress(raw, 6)).decode("ascii"), True


def unpack_body(body: str, compressed: bool) -> str:
    if not compressed:
        return body
    return zlib.decompress(base64.b64decode(body.encode("ascii"))).decode("utf-8")


def full_revision(
    rec: DocRecord, content: str, origin: str, device: str, saved_at: int, updated_at: int, restored_from: Optional[int] = None,
    packed: Optional[Tuple[str, bool]] = None,
) -> Revision:
    """A history row holding the whole text. `packed` is `(body, compressed)` when the caller already has it."""
    body, compressed = packed if packed is not None else pack_body(content)
    return Revision(
        docId=rec.id, rev=rec.rev, kind="file", name=rec.name, parentId=rec.parentId, deleted=False, hash=rec.hash,
        size=rec.size, encoding="full", compressed=compressed, baseRev=None, body=body, origin=origin,
        restoredFrom=restored_from, device=device, savedAt=saved_at, updatedAt=updated_at,
    )


def encode_revision_body(keyframe: Optional[Revision], content: str) -> Tuple[str, str, bool]:
    """`(encoding, body, compressed)` of the history row of `content`: a line delta against the `keyframe` row when
    that is clearly smaller, otherwise the text itself. Only the form that is kept is compressed.

    Pure CPU (a diff, zlib): `MarkdownDocsUseCase._cpu` runs it off the event loop for a big text.
    """
    if keyframe is not None:
        try:
            delta = make_delta(unpack_body(keyframe.body, keyframe.compressed), content, MAX_DIFF_LINES)
        except Exception:  # noqa: BLE001 - an unreadable keyframe, or whatever the diff trips on: store the text instead
            delta = None
        if delta is not None:
            delta_text = patch_json(delta)
            if utf8_len(delta_text) <= DELTA_MAX_RATIO * utf8_len(content):
                body, compressed = pack_body(delta_text)
                return "delta", body, compressed
    body, compressed = pack_body(content)
    return "full", body, compressed


def decode_revision(row: Revision, keyframe: Optional[Revision]) -> str:
    """The full text of a history row (`keyframe` is the row its delta applies to). `ValueError` / `zlib.error` when
    it cannot be rebuilt or does not hash to what was stored. Pure CPU, like `encode_revision_body`."""
    if row.encoding == "full":
        content = unpack_body(row.body, row.compressed)
    else:
        if keyframe is None or keyframe.encoding != "full":
            raise ValueError("keyframe missing")
        base = unpack_body(keyframe.body, keyframe.compressed)
        content = apply_patch(base, json.loads(unpack_body(row.body, row.compressed)))
    if sha256_hex(content) != row.hash:
        raise ValueError("hash mismatch")
    return content


# ---------------------------------------------------------------------- plans
@dataclass
class Rejected:
    code: str
    message: str


@dataclass
class Conflicted:
    parts: List[str]
    record: DocRecord


@dataclass
class Unchanged:
    record: DocRecord


@dataclass
class Write:
    record: DocRecord
    content_changed: bool = False
    deleted_changed: bool = False        # True on delete AND on undelete


Plan = Rejected | Conflicted | Unchanged | Write


@dataclass
class _Budget:
    """What one push may still spend: NEW nodes before the space is full, and the text bytes its ANSWER may still carry
    (the conflicts of a push bring the server's whole text back; see `_push_one`)."""

    free: int = 1 << 60
    reply_bytes: int = 1 << 60


class MarkdownDocsUseCase(MarkdownDocsInputPort):
    def __init__(
        self,
        repository: MarkdownDocsRepositoryPort,
        legacy_reader: Optional[LegacyMarkdownReaderPort] = None,
        share_repository: Optional[MarkdownShareRepositoryPort] = None,
        *,
        backend: str = "json",
        space: str = DEFAULT_SPACE,
        clock: Callable[[], int] = now_ms,
        max_doc_bytes: int = MAX_DOC_BYTES,
        max_push_bytes: int = MAX_PUSH_BYTES,
        max_docs: int = MAX_DOCS,
        page_items: int = PAGE_ITEMS,
        page_bytes: int = PAGE_BYTES,
        keep_recent: int = 50,
        daily_days: int = 90,
        history_tz_minutes: int = 420,
        coalesce_ms: int = 10 * 60 * 1000,
        tombstone_days: int = 90,
    ):
        self._repo = repository
        self._legacy = legacy_reader
        self._shares = share_repository
        self._backend = backend
        self._space = space
        self._clock = clock
        self._max_doc_bytes = max(1, int(max_doc_bytes))
        self._max_push_bytes = max(1, int(max_push_bytes))
        self._max_docs = max(1, int(max_docs))
        self._page_items = max(1, int(page_items))
        self._page_bytes = max(1, int(page_bytes))
        self._keep_recent = max(1, int(keep_recent))
        self._daily_days = max(0, int(daily_days))
        self._tz = int(history_tz_minutes)
        self._coalesce_ms = max(0, int(coalesce_ms))
        self._tombstone_ms = max(1, int(tombstone_days)) * DAY_MS
        self._migrated = False
        self._migration_lock = asyncio.Lock()
        self._last_maintenance = 0

    @staticmethod
    async def _cpu(weight: int, function: Callable[..., Any], *args: Any) -> Any:
        """Run CPU-bound `function` inline for a small `weight` (bytes of text), in a worker thread for a big one."""
        if weight <= INLINE_CPU_BYTES:
            return function(*args)
        return await asyncio.to_thread(function, *args)

    # ------------------------------------------------------------- migration
    @staticmethod
    def _parse_flag(raw: Optional[str]) -> Optional[Dict[str, Any]]:
        if not raw:
            return None
        try:
            value = json.loads(raw)
            return value if isinstance(value, dict) else None
        except ValueError:
            return None

    async def is_migrated(self) -> bool:
        if self._migrated:
            return True
        flag = self._parse_flag(await self._repo.get_meta(self._space, MIGRATION_KEY))
        self._migrated = bool(flag and flag.get("state") == "done")
        return self._migrated

    async def ensure_migrated(self) -> None:
        """Copy the old whole-tree store into this one, once. Safe to call on every request."""
        if self._migrated or await self.is_migrated():
            return
        async with self._migration_lock:
            if await self.is_migrated():
                return
            now = self._clock()
            running = json.dumps({"state": "running", "at": now})
            if not await self._repo.put_meta_if_absent(self._space, MIGRATION_KEY, running):
                flag = self._parse_flag(await self._repo.get_meta(self._space, MIGRATION_KEY))
                if flag and flag.get("state") == "done":
                    self._migrated = True
                    return
                if flag and flag.get("state") == "running" and now - int(flag.get("at", 0)) < MIGRATION_LEASE_MS:
                    raise _error(
                        503, "md_migrating", "Máy chủ đang chuyển dữ liệu Markdown cũ sang kho mới — thử lại sau ít giây",
                        {"Retry-After": "2"},
                    )
                # A failed run, or a claim nobody finished (a crashed process): take it over. The inserts are idempotent.
                await self._repo.put_meta(self._space, MIGRATION_KEY, running)
            try:
                await self._migrate(now)
            except BaseException:
                # Release the claim at once: a hiccup of the old store must not lock the migration for the lease.
                try:
                    await self._repo.put_meta(self._space, MIGRATION_KEY, json.dumps({"state": "failed", "at": now}))
                except Exception:  # noqa: BLE001
                    logger.warning("markdown sync: could not release the migration claim", exc_info=True)
                raise
            self._migrated = True

    async def _migrate(self, now: int) -> None:
        if self._legacy is None:
            rows: List[Dict[str, Any]] = []
        else:
            rows = await self._legacy.read_tree(self._backend)
        weight = sum(len(row["content"]) for row in rows if isinstance(row.get("content"), str))
        records, revisions, id_map, skipped = await self._cpu(weight, self.plan_migration, rows, now)
        async with self._repo.batch():
            await self._repo.insert_many(self._space, records)
            await self._repo.add_revisions(self._space, revisions)
            if id_map and self._shares is not None:
                # A link is found by the document's id: carry the renamed ids over (ke-hoach §1.2). Ids made by
                # the editor never change, so this is a safety net; a failure must not undo the copy.
                try:
                    await self._shares.rename_docs(id_map)
                except Exception:  # noqa: BLE001
                    logger.warning("markdown sync: could not carry renamed ids over to the share links", exc_info=True)
            summary = {
                "state": "done", "at": now, "nodes": len(records), "idMap": id_map, "skipped": skipped,
            }
            await self._repo.put_meta(self._space, MIGRATION_KEY, json.dumps(summary, ensure_ascii=False))
        logger.info("markdown sync: migrated %d nodes from the old %s store (%d skipped)", len(records), self._backend, len(skipped))

    def plan_migration(
        self, rows: Sequence[Dict[str, Any]], now: int
    ) -> Tuple[List[DocRecord], List[Revision], Dict[str, str], List[Dict[str, str]]]:
        """Pure: the records, the first history rows, the old-to-new id table and the nodes left out.

        Each node gets its own stamp (a pull pages by stamp and a page never ends inside a run of equal ones, so
        one shared stamp would make the whole tree a single page), but the stamps run `now - n .. now - 1`: in the past,
        never ahead of the clock. A stamp in the future (`now + index`) would put a middle-of-the-pull cursor ahead of
        the clock, and a document that ANOTHER device pushes meanwhile - stamped with the clock - would sit behind that
        cursor and never reach the device that is still pulling."""
        id_map: Dict[str, str] = {}
        used: set = set()
        new_ids: List[str] = []
        for row in rows:
            old = str(row["id"])
            candidate = old if is_doc_id(old) else "legacy-" + sha256_hex(old)[:24]
            counter = 1
            while candidate in used:                       # a repeated id (hand-edited JSON): keep both nodes
                counter += 1
                candidate = "legacy-" + sha256_hex(f"{old}#{counter}")[:24]
            used.add(candidate)
            new_ids.append(candidate)
            if candidate != old and old not in id_map:
                id_map[old] = candidate

        first_new: Dict[str, str] = {}
        for row, new in zip(rows, new_ids):
            first_new.setdefault(str(row["id"]), new)

        records: List[DocRecord] = []
        revisions: List[Revision] = []
        skipped: List[Dict[str, str]] = []
        first_stamp = now - len(rows)
        for index, (row, new_id) in enumerate(zip(rows, new_ids)):
            kind = "folder" if row.get("kind") == "folder" else "file"
            name = str(row.get("name") or "").replace("/", "-").strip()[:MAX_NAME_CHARS]
            name = name or ("Untitled" if kind == "folder" else "untitled.md")
            parent_old = row.get("parent_id")
            parent = None
            if parent_old not in (None, ""):
                parent = first_new.get(str(parent_old))
                if parent is None:
                    parent = str(parent_old) if is_doc_id(str(parent_old)) else "legacy-" + sha256_hex(str(parent_old))[:24]
            content: Optional[str] = None
            if kind == "file":
                content = row.get("content") if isinstance(row.get("content"), str) else ""
                try:
                    content.encode("utf-8")
                except UnicodeEncodeError:
                    content = content.encode("utf-8", "replace").decode("utf-8")
                if utf8_len(content) > self._max_doc_bytes:
                    skipped.append({"id": new_id, "reason": "too_large"})
                    continue
            record = DocRecord(
                id=new_id, kind=kind, parentId=parent, name=name, content=content,
                hash=sha256_hex(content) if content is not None else "",
                size=utf8_len(content) if content is not None else 0,
                rev=1, contentRev=1, metaRev=1, deleted=False, createdAt=now, updatedAt=now,
                serverUpdatedAt=first_stamp + index, device=LEGACY_DEVICE,
            )
            records.append(record)
            if content is not None:
                revisions.append(full_revision(record, content, "migrate", LEGACY_DEVICE, now, now))
        return records, revisions, id_map, skipped

    async def legacy_rows(self) -> Optional[List[Dict[str, Any]]]:
        """The live nodes in the shape of the old tree endpoint, or None while not migrated."""
        if not await self.is_migrated():
            return None
        records = await self._repo.list_live(self._space)
        parents: Dict[str, Optional[str]] = {record.id: record.parentId for record in records}
        _break_cycles(parents)
        ordered = sorted(records, key=lambda r: (r.id != "root", r.kind != "folder", r.name.lower(), r.id))
        return [
            {
                "id": record.id, "name": record.name, "node_type": record.kind, "content": record.content,
                "parent_id": parents.get(record.id), "sort_order": position,
            }
            for position, record in enumerate(ordered)
        ]

    # ------------------------------------------------------------------ pull
    async def changes(self, since: int, limit: Optional[int], device: str) -> Dict[str, Any]:
        await self.ensure_migrated()
        since = max(0, int(since))
        size = min(limit or self._page_items, self._page_items)
        fetch = size + 1
        while True:
            found = await self._repo.list_since(self._space, since, fetch, include_deleted=since > 0)
            page, more = cut_page(
                found, size, self._page_bytes, lambda r: r.size + ITEM_OVERHEAD_BYTES, lambda r: r.serverUpdatedAt
            )
            # A page that is nothing but a run of equal stamps swallowed the whole fetch: the run may go
            # on past it, so look further (bounded: a run this long is not a real workload).
            if len(page) < fetch or fetch >= MAX_STAMP_RUN_FETCH:
                break
            fetch = min(fetch * 4, MAX_STAMP_RUN_FETCH)
        cursor = page[-1].serverUpdatedAt if more and page else max(since, self._clock() - SYNC_LAG_MS)
        horizon = await self._horizon()
        # A device's own writes come back without text (it has them), but only on an incremental pull: `since=0` is a
        # full reconciliation (a fresh install, or storage the browser evicted), where nothing is "already here".
        own = device if since > 0 else ""
        items = [
            (record.without_content() if own and record.device == own else record).model_dump()
            for record in page
        ]
        return {"items": items, "cursor": cursor, "more": more, "horizon": horizon, "reset": 0 < since < horizon}

    async def _horizon(self) -> int:
        raw = await self._repo.get_meta(self._space, HORIZON_KEY)
        try:
            return int(raw) if raw else 0
        except ValueError:
            return 0

    async def get_document(self, doc_id: str) -> Dict[str, Any]:
        record = await self._repo.get(self._space, doc_id) if is_doc_id(doc_id) else None
        if record is None or record.deleted:
            raise NotFoundError("Không tìm thấy tài liệu này (chưa đồng bộ lên máy chủ hoặc đã bị xoá)", payload={"code": "md_doc_not_found"})
        return record.model_dump()

    # ------------------------------------------------------------------ push
    @staticmethod
    def _op_weight(op: PushOp) -> int:
        if op.content is not None:
            return utf8_len(op.content)
        if op.patch is not None:
            return sum(utf8_len(line) + 4 for _o, _d, lines in op.patch.h for line in lines) + 16 * len(op.patch.h)
        return 0

    async def push(self, request: PushRequest) -> Dict[str, Any]:
        await self.ensure_migrated()
        ids = [op.id for op in request.ops]
        if len(set(ids)) != len(ids):
            raise _error(400, "md_duplicate_op", "Một yêu cầu đẩy không được chứa hai thao tác trên cùng một tài liệu")
        total = sum(self._op_weight(op) + 200 for op in request.ops)
        if total > self._max_push_bytes:
            raise _error(400, "md_push_too_large", f"Yêu cầu quá lớn (tối đa {self._max_push_bytes:,} byte) — hãy chia nhỏ")

        now = self._clock()
        await self._maybe_maintain(now)
        existing = await self._repo.get_many(self._space, ids)
        budget = _Budget()
        new_ops = sum(1 for op in request.ops if op.id not in existing)
        if new_ops:
            count = await self._repo.count(self._space)
            if count + new_ops > self._max_docs:
                await self.purge_expired_tombstones(now)
                existing = await self._repo.get_many(self._space, ids)
                new_ops = sum(1 for op in request.ops if op.id not in existing)
                count = await self._repo.count(self._space)
            budget.free = max(0, self._max_docs - count)
        budget.reply_bytes = self._page_bytes

        results: List[Dict[str, Any]] = []
        async with self._repo.batch():
            last_stamp = 0
            for op in request.ops:
                # Stamped when the op is about to be written, not when the push began: against a slow database
                # a push of dozens of ops takes seconds, and a stamp older than the 2 s cursor lag could fall
                # behind another device's pull cursor and never be delivered. Strictly increasing inside a push.
                last_stamp = max(self._clock(), last_stamp + 1)
                results.append(await self._push_one(op, existing.get(op.id), request.device, now, last_stamp, budget))
        return {"results": results, "serverTime": max(0, self._clock() - SYNC_LAG_MS)}

    async def _push_one(
        self, op: PushOp, cur: Optional[DocRecord], device: str, now: int, stamp: int, budget: _Budget
    ) -> Dict[str, Any]:
        for attempt in range(3):
            if attempt:
                cur = await self._repo.get(self._space, op.id)
            # Applying a patch to a stored megabyte (split, join, SHA-256) is CPU proportional to the document, not to the
            # request: a push of tiny patches against big documents must not stall the loop either.
            plan = await self._cpu(cur.size if cur is not None and op.patch is not None else 0, self._plan, op, cur, device, now, stamp)
            if isinstance(plan, Rejected):
                return {"id": op.id, "status": "rejected", "code": plan.code, "message": plan.message}
            if isinstance(plan, Conflicted):
                return self._conflict(op, plan, budget)
            if isinstance(plan, Unchanged):
                return self._ok(plan.record)

            if cur is None:
                if budget.free <= 0:
                    return {"id": op.id, "status": "rejected", "code": "md_space_full",
                            "message": f"Kho tài liệu đã đầy ({self._max_docs:,} mục) — hãy xoá bớt tài liệu cũ"}
                written = await self._repo.insert(self._space, plan.record)
            else:
                written = await self._repo.cas_write(self._space, plan.record, cur.rev)
            if not written:
                continue                                  # another request got there first: decide again
            if cur is None:
                budget.free -= 1
            await self._remember(plan, op, cur, device, now)
            return self._ok(plan.record)
        raise _error(503, "md_busy", "Máy chủ đang bận ghi tài liệu này — thử lại sau ít giây", {"Retry-After": "1"})

    @staticmethod
    def _conflict(op: PushOp, plan: Conflicted, budget: _Budget) -> Dict[str, Any]:
        """The answer for a conflicting op: the server's record, with its text when the client needs it to merge.

        The request that caused it can be tiny (a patch), but the answer carries the server's WHOLE text - up to
        `max_doc_bytes` each, for up to 200 ops - so the texts one answer may carry share a budget (`page_bytes`, the
        same one a pull page has: far below Vercel's 4.5 MB response cap). A record that does not fit comes back
        without its text and with `contentOmitted: true`: the client fetches it with `GET /markdown/docs/{id}`.
        A conflict that touches only the name/parent never carries text (the client has its own)."""
        record = plan.record.without_content() if plan.parts == ["meta"] else plan.record
        result: Dict[str, Any] = {"id": op.id, "status": "conflict", "parts": plan.parts}
        if record.content is not None:
            weight = record.size + ITEM_OVERHEAD_BYTES
            if weight > budget.reply_bytes:
                record = record.without_content()
                result["contentOmitted"] = True
            else:
                budget.reply_bytes -= weight
        result["record"] = record.model_dump()
        return result

    @staticmethod
    def _ok(record: DocRecord) -> Dict[str, Any]:
        return {
            "id": record.id, "status": "ok", "rev": record.rev, "contentRev": record.contentRev,
            "metaRev": record.metaRev, "hash": record.hash, "serverUpdatedAt": record.serverUpdatedAt,
        }

    # -- the decision (pure) --------------------------------------------------
    def _check_text(self, text: str, expected_hash: str, code_on_hash: str) -> Optional[Rejected]:
        try:
            raw = text.encode("utf-8")
        except UnicodeEncodeError:
            return Rejected("md_bad_content", "Nội dung có ký tự UTF-16 lẻ, không mã hoá UTF-8 được")
        if len(raw) > self._max_doc_bytes:
            return Rejected("md_doc_too_large", f"Tài liệu quá lớn ({len(raw):,} byte, tối đa {self._max_doc_bytes:,} byte)")
        if sha256_hex(text) != expected_hash:
            return Rejected(code_on_hash, "Mã băm của nội dung không khớp — nội dung bị hỏng khi truyền hoặc patch sai")
        return None

    @staticmethod
    def _meta_of(op: PushOp) -> Tuple[Any, Any, Optional[Rejected]]:
        """`(name, parent, error)`; each is `UNSET` when the op does not mention it."""
        name: Any = UNSET
        parent: Any = UNSET
        meta = op.meta
        if meta is not None:
            if "name" in meta.model_fields_set and meta.name is not None:
                name = meta.name.strip()
                if not name or "/" in name or len(name) > MAX_NAME_CHARS or _has_control(name):
                    return UNSET, UNSET, Rejected("md_bad_name", "Tên không hợp lệ (trống, quá 255 ký tự, có dấu / hoặc ký tự điều khiển)")
            if "parentId" in meta.model_fields_set:
                parent = meta.parentId
                if parent == op.id:
                    return UNSET, UNSET, Rejected("md_bad_parent", "Một mục không thể là thư mục cha của chính nó")
        return name, parent, None

    def _plan(self, op: PushOp, cur: Optional[DocRecord], device: str, now: int, stamp: int) -> Plan:
        if op.updatedAt > now + MAX_CLOCK_AHEAD_MS:
            return Rejected("md_bad_clock", "Đồng hồ thiết bị lệch hơn 1 ngày so với máy chủ — hãy chỉnh lại giờ rồi đồng bộ lại")
        name, parent, bad = self._meta_of(op)
        if bad is not None:
            return bad

        if cur is None:
            return self._plan_new(op, name, parent, device, stamp)
        if cur.kind != op.kind:
            return Rejected("md_kind_changed", "Không đổi được tệp thành thư mục (hoặc ngược lại)")

        content_intent = op.content is not None or op.patch is not None
        meta_changes: Dict[str, Any] = {}
        if name is not UNSET and name != cur.name:
            meta_changes["name"] = name
        if parent is not UNSET and parent != cur.parentId:
            meta_changes["parentId"] = parent
        next_stamp = max(stamp, cur.serverUpdatedAt + 1)

        if cur.deleted:
            if op.deleted is True:
                return Unchanged(cur)
            if op.deleted is False:
                if op.baseRev < cur.contentRev:
                    return Conflicted(["deleted"], cur)
                return self._plan_undelete(op, cur, meta_changes, device, next_stamp)
            if content_intent or meta_changes:
                return Conflicted(["deleted"], cur)
            return Unchanged(cur)

        if op.deleted is True:
            if cur.contentRev > op.baseRev:
                return Conflicted(["deleted"], cur)
            rev = cur.rev + 1
            tomb = cur.model_copy(update={
                "deleted": True, "content": None, "hash": "", "size": 0, "rev": rev, "contentRev": rev,
                "updatedAt": op.updatedAt, "serverUpdatedAt": next_stamp, "device": device,
            })
            return Write(tomb, deleted_changed=True)

        if op.content is not None and op.hash == cur.hash:
            # "Nothing to change" is still a claim about the text: the server never takes a hash on trust, so a text that
            # does not hash to what it says is refused here too (it would otherwise be answered `ok` - a replay).
            bad_replay = self._check_text(op.content, op.hash, "md_hash_mismatch")
            if bad_replay is not None:
                return bad_replay
        content_changes = content_intent and op.hash != cur.hash
        parts: List[str] = []
        if content_changes and cur.contentRev > op.baseRev:
            parts.append("content")
        if meta_changes and cur.metaRev > op.baseRev:
            parts.append("meta")
        if parts:
            return Conflicted(parts, cur)
        if not content_changes and not meta_changes:
            return Unchanged(cur)

        rev = cur.rev + 1
        update: Dict[str, Any] = {
            "rev": rev, "updatedAt": op.updatedAt, "serverUpdatedAt": next_stamp, "device": device, **meta_changes,
        }
        if meta_changes:
            update["metaRev"] = rev
        if content_changes:
            assert op.hash is not None
            if op.content is not None:
                text = op.content
                bad_text = self._check_text(text, op.hash, "md_hash_mismatch")
            else:
                assert op.patch is not None
                if cur.content is None or cur.hash != op.baseHash:
                    return Rejected("md_patch_mismatch", "Patch không khớp bản gốc trên máy chủ — hãy gửi nguyên văn")
                try:
                    text = apply_patch(cur.content, op.patch.model_dump())
                except ValueError:
                    return Rejected("md_patch_mismatch", "Patch không áp được lên bản gốc — hãy gửi nguyên văn")
                bad_text = self._check_text(text, op.hash, "md_patch_mismatch")
            if bad_text is not None:
                return bad_text
            update.update({"content": text, "hash": op.hash, "size": utf8_len(text), "contentRev": rev})
        return Write(cur.model_copy(update=update), content_changed=content_changes)

    def _plan_new(self, op: PushOp, name: Any, parent: Any, device: str, stamp: int) -> Plan:
        if op.patch is not None:
            return Rejected("md_patch_mismatch", "Chưa có bản gốc trên máy chủ để áp patch — hãy gửi nguyên văn")
        deleting = op.deleted is True
        if name is UNSET:
            if not deleting:
                return Rejected("md_bad_name", "Thiếu tên cho tài liệu mới")
            name = ""
        content: Optional[str] = None
        hash_value = ""
        if op.kind == "file" and not deleting:
            content = op.content if op.content is not None else ""
            hash_value = op.hash if op.content is not None and op.hash else sha256_hex(content)
            bad_text = self._check_text(content, hash_value, "md_hash_mismatch")
            if bad_text is not None:
                return bad_text
        record = DocRecord(
            id=op.id, kind=op.kind, parentId=None if parent is UNSET else parent, name=name,
            content=content, hash=hash_value, size=utf8_len(content) if content is not None else 0,
            rev=1, contentRev=1, metaRev=1, deleted=deleting, createdAt=op.updatedAt, updatedAt=op.updatedAt,
            serverUpdatedAt=stamp, device=device,
        )
        # A node deleted before the server ever saw it is still stored (as a tombstone), without history.
        return Write(record, content_changed=content is not None)

    def _plan_undelete(self, op: PushOp, cur: DocRecord, meta_changes: Dict[str, Any], device: str, stamp: int) -> Plan:
        rev = cur.rev + 1
        update: Dict[str, Any] = {
            "deleted": False, "rev": rev, "contentRev": rev, "updatedAt": op.updatedAt, "serverUpdatedAt": stamp,
            "device": device, **meta_changes,
        }
        if meta_changes:
            update["metaRev"] = rev
        if cur.kind == "file":
            if op.content is None:
                code = "md_patch_mismatch" if op.patch is not None else "md_content_required"
                return Rejected(code, "Cần gửi nguyên văn để đưa tài liệu đã xoá trở lại")
            assert op.hash is not None
            bad_text = self._check_text(op.content, op.hash, "md_hash_mismatch")
            if bad_text is not None:
                return bad_text
            update.update({"content": op.content, "hash": op.hash, "size": utf8_len(op.content)})
        return Write(cur.model_copy(update=update), content_changed=cur.kind == "file", deleted_changed=True)

    # -- history -----------------------------------------------------------------
    async def _remember(self, plan: Write, op: PushOp, previous: Optional[DocRecord], device: str, now: int) -> None:
        record = plan.record
        if record.kind != "file":
            return
        if previous is None and record.deleted:
            return                                        # a tombstone of something never stored: nothing to remember
        try:
            if record.deleted:
                row = Revision(
                    docId=record.id, rev=record.rev, kind="file", name=record.name, parentId=record.parentId, deleted=True,
                    encoding="none", origin="delete", device=device, savedAt=now, updatedAt=op.updatedAt,
                )
                await self._append_history(record, row, now)
            elif plan.content_changed and record.content is not None:
                # A node the store has just created has no rows yet: skip the read (a round trip to a remote database).
                await self._write_text_revision(record, "edit", device, now, op.updatedAt, known_rows=[] if previous is None else None)
        except Exception:  # noqa: BLE001 - the document is already stored: lose a history row, never the push
            logger.warning("markdown sync: could not write history for a node (rev %s)", record.rev, exc_info=True)

    async def _write_text_revision(
        self, record: DocRecord, origin: str, device: str, now: int, updated_at: int, restored_from: Optional[int] = None,
        known_rows: Optional[List[Revision]] = None,
    ) -> None:
        content = record.content or ""
        rows = known_rows if known_rows is not None else await self._repo.list_revisions(self._space, record.id)
        coalesce = (
            rows and origin == "edit" and rows[-1].origin == "edit" and rows[-1].encoding == "delta"
            and rows[-1].device == device and not rows[-1].label and now - rows[-1].savedAt < self._coalesce_ms
        )
        kept_rows = rows[:-1] if coalesce else rows
        keyframe_meta = next((r for r in reversed(kept_rows) if r.encoding == "full"), None)
        keyframe: Optional[Revision] = None
        if keyframe_meta is not None and record.size >= FULL_BELOW_BYTES and record.rev - keyframe_meta.rev < KEYFRAME_EVERY:
            keyframe = await self._repo.get_revision(self._space, record.id, keyframe_meta.rev)
            if keyframe is not None and keyframe.encoding != "full":
                keyframe = None
        # The diff and the compression are the CPU of this push: off the event loop for a big text, and the text is
        # compressed only when it is the form that is kept (a delta is small and is not).
        encoding, body, compressed = await self._cpu(record.size, encode_revision_body, keyframe, content)
        row = full_revision(record, content, origin, device, now, updated_at, restored_from, packed=(body, compressed))
        if encoding == "delta" and keyframe is not None:
            row = row.model_copy(update={"encoding": "delta", "baseRev": keyframe.rev})
        await self._append_history(record, row, now, drop=[rows[-1].rev] if coalesce else [], rows=kept_rows)

    async def _append_history(
        self, record: DocRecord, row: Revision, now: int, drop: Sequence[int] = (), rows: Optional[List[Revision]] = None
    ) -> None:
        if rows is None:
            rows = await self._repo.list_revisions(self._space, record.id)
        await self._repo.add_revision(self._space, row)                      # add first: a failure leaves an extra row
        doomed = list(drop)
        all_rows = [r for r in rows if r.rev != row.rev] + [row.without_body()]
        keep = select_keep(
            all_rows, now, keep_recent=self._keep_recent, daily_days=self._daily_days, tz_offset_minutes=self._tz
        )
        doomed.extend(r.rev for r in all_rows if r.rev not in keep)
        if doomed:
            await self._repo.delete_revisions(self._space, record.id, sorted(set(doomed)))

    # -- reading history -----------------------------------------------------------
    async def list_revisions(self, doc_id: str, before: Optional[int], limit: Optional[int]) -> Dict[str, Any]:
        rows = await self._repo.list_revisions(self._space, doc_id) if is_doc_id(doc_id) else []
        newest_first = [r for r in reversed(rows) if before is None or r.rev < before]
        size = max(1, min(limit or DEFAULT_REVISION_PAGE, MAX_REVISION_PAGE))
        return {"items": [r.meta() for r in newest_first[:size]], "more": len(newest_first) > size}

    async def get_revision(self, doc_id: str, rev: int) -> Dict[str, Any]:
        row = await self._repo.get_revision(self._space, doc_id, rev) if is_doc_id(doc_id) else None
        if row is None:
            raise NotFoundError("Không tìm thấy phiên bản này (đã bị dọn khỏi lịch sử hoặc chưa từng có)", payload={"code": "md_revision_not_found"})
        content = await self.rebuild_content(row)
        return {**row.meta(), "docId": doc_id, "content": content}

    async def rebuild_content(self, row: Revision) -> Optional[str]:
        """The full text of a history row: at most two reads (the row, then its keyframe)."""
        if row.encoding == "none":
            return None
        try:
            keyframe = None
            if row.encoding == "delta":
                keyframe = await self._repo.get_revision(self._space, row.docId, int(row.baseRev or 0))
            return await self._cpu(row.size, decode_revision, row, keyframe)
        except (ValueError, KeyError, zlib.error) as cause:
            logger.error("markdown sync: history row %s of a node cannot be rebuilt (%s)", row.rev, type(cause).__name__)
            raise _error(500, "md_history_broken", "Phiên bản này không dựng lại được (lịch sử bị hỏng)") from cause

    # -- maintenance -----------------------------------------------------------------
    async def _maybe_maintain(self, now: int) -> None:
        if now - self._last_maintenance < MAINTENANCE_EVERY_MS:
            return
        self._last_maintenance = now
        try:
            await self.purge_expired_tombstones(now)
        except Exception:  # noqa: BLE001 - housekeeping must never fail a push
            logger.warning("markdown sync: tombstone purge failed", exc_info=True)

    async def purge_expired_tombstones(self, now: Optional[int] = None) -> List[str]:
        """Drop tombstones (and their history) older than the retention; move `horizon` forward."""
        current = self._clock() if now is None else now
        cutoff = current - self._tombstone_ms
        # The store drops the history of the nodes it purges in the same call (one statement per kind, not one round
        # trip per node, and no orphan rows if this process dies half way).
        ids = await self._repo.purge_tombstones(self._space, cutoff)
        if ids:
            horizon = await self._horizon()
            if cutoff > horizon:
                await self._repo.put_meta(self._space, HORIZON_KEY, str(cutoff))
        return ids


def _break_cycles(parents: Dict[str, Optional[str]]) -> None:
    """Two devices moving folders into each other can leave a loop that no root reaches: cut each
    loop at its smallest id (that node goes to the top), so every node is reachable."""
    state: Dict[str, int] = {}
    for start in sorted(parents):
        path: List[str] = []
        node: Optional[str] = start
        while node is not None and node in parents and state.get(node) != 2:
            if state.get(node) == 1:
                cycle = path[path.index(node):]
                parents[min(cycle)] = None
                break
            state[node] = 1
            path.append(node)
            node = parents[node]
        for visited in path:
            state[visited] = 2
