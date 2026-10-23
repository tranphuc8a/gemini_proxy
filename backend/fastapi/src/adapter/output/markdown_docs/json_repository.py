"""JSON-file store of the markdown delta sync - the zero-setup backend.

`data/markdown-docs.json` (`MARKDOWN_DOCS_JSON_FILE`): `{"version": 1, "spaces": {<space>:
{"meta": {key: value}, "docs": {id: record}}}}`. Every record lives in memory, mirrored to the
file by writing a temporary file and moving it into place (a crash halfway leaves the previous
good file); an `asyncio.Lock` serialises the operations; a corrupt file is renamed `.corrupt`
and the store starts empty rather than taking the app down.

History is NOT in that file: it would be rewritten with every edit. Each document keeps its
rows in `markdown-history/<space>/<sha1(id)[:16]>.json` next to the main file (the id may hold
`:` which is no file name on Windows), read and rewritten as a whole when that document's
history changes (<= ~300 small rows, by the retention policy).

`batch()` defers the rewrite of the main file to the end of a group of writes: one push of
200 nodes rewrites a multi-megabyte file once, not 200 times. If the rewrite fails the memory
is dropped and re-read from disk, so it never claims more than what was persisted.

On a serverless platform the file lives in an ephemeral directory (`application/utils/
data_paths`): a scratchpad there, not storage - use mysql or mongo for anything that must stay.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator, Dict, List, Optional, Sequence

from src.application.ports.output.markdown_docs_repository_port import MarkdownDocsRepositoryPort
from src.application.utils.data_paths import seeded_data_path
from src.domain.vo.markdown_docs_vo import DocRecord, Revision

logger = logging.getLogger(__name__)


class JsonMarkdownDocsRepository(MarkdownDocsRepositoryPort):
    def __init__(self, file_path: str | Path = "data/markdown-docs.json"):
        self._path = seeded_data_path(file_path)
        self._history_dir = self._path.parent / "markdown-history"
        self._lock = asyncio.Lock()
        self._loaded = False
        self._spaces: Dict[str, Dict[str, Dict]] = {}   # space -> {"meta": {...}, "docs": {id: DocRecord}}
        self._defer = 0
        self._dirty = False

    # ------------------------------------------------------------------ io
    def _space(self, space: str) -> Dict:
        self._load_unlocked()
        return self._spaces.setdefault(space, {"meta": {}, "docs": {}})

    def _quarantine(self, path: Path, why: str) -> None:
        logger.warning("Could not read %s (%s); starting empty", path.name, why)   # never the content
        try:
            path.rename(path.with_suffix(path.suffix + ".corrupt"))
        except OSError:
            pass

    def _load_unlocked(self) -> None:
        if self._loaded:
            return
        self._loaded = True
        self._spaces = {}
        if not self._path.exists():
            return
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
            spaces = raw.get("spaces") or {}
            for name, data in spaces.items():
                docs = {}
                for doc_id, entry in (data.get("docs") or {}).items():
                    docs[doc_id] = DocRecord(**entry)
                self._spaces[name] = {"meta": dict(data.get("meta") or {}), "docs": docs}
        except Exception as cause:  # noqa: BLE001
            self._spaces = {}
            self._quarantine(self._path, type(cause).__name__)

    def _flush_unlocked(self) -> None:
        payload = {
            "version": 1,
            "spaces": {
                name: {"meta": data["meta"], "docs": {doc_id: rec.model_dump() for doc_id, rec in data["docs"].items()}}
                for name, data in self._spaces.items()
            },
        }
        self._path.parent.mkdir(parents=True, exist_ok=True)
        temp = self._path.with_suffix(self._path.suffix + ".tmp")
        temp.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        os.replace(temp, self._path)

    def _commit_unlocked(self) -> None:
        if self._defer:
            self._dirty = True
            return
        self._persist_unlocked()

    def _persist_unlocked(self) -> None:
        try:
            self._flush_unlocked()
            self._dirty = False
        except Exception:
            # Memory ahead of the disk: drop it, the next call re-reads what was really saved.
            self._loaded = False
            self._spaces = {}
            self._dirty = False
            raise

    @asynccontextmanager
    async def batch(self) -> AsyncIterator[None]:
        self._defer += 1
        try:
            yield
        finally:
            self._defer -= 1
            if self._defer == 0 and self._dirty:
                async with self._lock:
                    if self._dirty:
                        self._persist_unlocked()

    # ----------------------------------------------------------- documents
    async def get(self, space: str, doc_id: str) -> Optional[DocRecord]:
        async with self._lock:
            record = self._space(space)["docs"].get(doc_id)
            return record.model_copy() if record else None

    async def get_many(self, space: str, ids: Sequence[str]) -> Dict[str, DocRecord]:
        async with self._lock:
            docs = self._space(space)["docs"]
            return {doc_id: docs[doc_id].model_copy() for doc_id in ids if doc_id in docs}

    async def list_since(self, space: str, since: int, limit: int, include_deleted: bool) -> List[DocRecord]:
        async with self._lock:
            rows = [
                record for record in self._space(space)["docs"].values()
                if record.serverUpdatedAt > since and (include_deleted or not record.deleted)
            ]
            rows.sort(key=lambda record: (record.serverUpdatedAt, record.id))
            return [record.model_copy() for record in rows[:max(0, limit)]]

    async def list_live(self, space: str) -> List[DocRecord]:
        async with self._lock:
            return [record.model_copy() for record in self._space(space)["docs"].values() if not record.deleted]

    async def insert(self, space: str, record: DocRecord) -> bool:
        async with self._lock:
            docs = self._space(space)["docs"]
            if record.id in docs:
                return False
            docs[record.id] = record.model_copy()
            self._commit_unlocked()
            return True

    async def insert_many(self, space: str, records: Sequence[DocRecord]) -> int:
        async with self._lock:
            docs = self._space(space)["docs"]
            inserted = 0
            for record in records:
                if record.id not in docs:
                    docs[record.id] = record.model_copy()
                    inserted += 1
            if inserted:
                self._commit_unlocked()
            return inserted

    async def cas_write(self, space: str, record: DocRecord, expected_rev: int) -> bool:
        async with self._lock:
            docs = self._space(space)["docs"]
            held = docs.get(record.id)
            if held is None or held.rev != expected_rev:
                return False
            docs[record.id] = record.model_copy()
            self._commit_unlocked()
            return True

    async def count(self, space: str) -> int:
        async with self._lock:
            return len(self._space(space)["docs"])

    async def purge_tombstones(self, space: str, before: int) -> List[str]:
        async with self._lock:
            docs = self._space(space)["docs"]
            doomed = [doc_id for doc_id, record in docs.items() if record.deleted and record.serverUpdatedAt < before]
            for doc_id in doomed:
                self._history_file(space, doc_id).unlink(missing_ok=True)     # history first: no orphan if cut short
                del docs[doc_id]
            if doomed:
                self._commit_unlocked()
            return sorted(doomed)

    # ------------------------------------------------------------- history
    def _history_file(self, space: str, doc_id: str) -> Path:
        digest = hashlib.sha1(doc_id.encode("utf-8")).hexdigest()[:16]
        return self._history_dir / space / f"{digest}.json"

    def _read_history(self, space: str, doc_id: str) -> Dict[int, Revision]:
        path = self._history_file(space, doc_id)
        if not path.exists():
            return {}
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            rows = [Revision(**entry) for entry in raw.get("rows", [])]
            return {row.rev: row for row in rows if row.docId == doc_id}
        except Exception as cause:  # noqa: BLE001
            self._quarantine(path, type(cause).__name__)
            return {}

    def _write_history(self, space: str, doc_id: str, rows: Dict[int, Revision]) -> None:
        path = self._history_file(space, doc_id)
        if not rows:
            path.unlink(missing_ok=True)
            return
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_suffix(".json.tmp")
        body = {"docId": doc_id, "rows": [rows[rev].model_dump() for rev in sorted(rows)]}
        temp.write_text(json.dumps(body, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        os.replace(temp, path)

    async def add_revision(self, space: str, revision: Revision) -> None:
        async with self._lock:
            rows = self._read_history(space, revision.docId)
            rows[revision.rev] = revision.model_copy()
            self._write_history(space, revision.docId, rows)

    async def add_revisions(self, space: str, revisions: Sequence[Revision]) -> None:
        async with self._lock:
            touched: Dict[str, Dict[int, Revision]] = {}
            for revision in revisions:
                rows = touched.get(revision.docId)
                if rows is None:
                    rows = touched[revision.docId] = self._read_history(space, revision.docId)
                rows[revision.rev] = revision.model_copy()
            for doc_id, rows in touched.items():
                self._write_history(space, doc_id, rows)

    async def list_revisions(self, space: str, doc_id: str) -> List[Revision]:
        async with self._lock:
            rows = self._read_history(space, doc_id)
            return [rows[rev].without_body() for rev in sorted(rows)]

    async def get_revision(self, space: str, doc_id: str, rev: int) -> Optional[Revision]:
        async with self._lock:
            row = self._read_history(space, doc_id).get(rev)
            return row.model_copy() if row else None

    async def latest_keyframe(self, space: str, doc_id: str) -> Optional[Revision]:
        async with self._lock:
            frames = [row for row in self._read_history(space, doc_id).values() if row.encoding == "full"]
            return max(frames, key=lambda row: row.rev).model_copy() if frames else None

    async def delete_revisions(self, space: str, doc_id: str, revs: Sequence[int]) -> None:
        if not revs:
            return
        async with self._lock:
            rows = self._read_history(space, doc_id)
            for rev in revs:
                rows.pop(rev, None)
            self._write_history(space, doc_id, rows)

    async def delete_all_revisions(self, space: str, doc_id: str) -> None:
        async with self._lock:
            self._history_file(space, doc_id).unlink(missing_ok=True)

    # ---------------------------------------------------------------- meta
    async def get_meta(self, space: str, key: str) -> Optional[str]:
        async with self._lock:
            return self._space(space)["meta"].get(key)

    async def put_meta_if_absent(self, space: str, key: str, value: str) -> bool:
        async with self._lock:
            meta = self._space(space)["meta"]
            if key in meta:
                return False
            meta[key] = value
            self._commit_unlocked()
            return True

    async def put_meta(self, space: str, key: str, value: str) -> None:
        async with self._lock:
            self._space(space)["meta"][key] = value
            self._commit_unlocked()
