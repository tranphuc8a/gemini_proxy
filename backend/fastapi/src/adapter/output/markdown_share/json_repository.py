"""JSON-file store of the markdown share links - the zero-setup backend.

Every link lives in memory, mirrored to one file (`MARKDOWN_SHARES_JSON_FILE`), with an
index `doc_id -> token` so both lookups are dictionary hits. An `asyncio.Lock`
serialises the operations; a write goes to a temporary file that is then moved into
place, so a crash halfway leaves the previous good file. A corrupt file is renamed to
`.corrupt` and the store starts empty rather than taking the app down.

Worst case the file holds `MARKDOWN_MAX_SHARES` snapshots of `MARKDOWN_SHARE_MAX_BYTES`
(50 x 2 MB) and is rewritten on every share. On a serverless platform the file lives in
an ephemeral directory (`application/utils/data_paths`): links die with the instance,
which is why the listing reports `persistent: false` there.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Dict, List, Optional

from src.application.ports.output.markdown_share_repository_port import MarkdownShareRepositoryPort
from src.application.utils.data_paths import seeded_data_path
from src.domain.vo.markdown_share_vo import MarkdownShareRecord, MarkdownShareSummary

logger = logging.getLogger(__name__)

#: On disk the fields are camelCase (as in the design's file format); in memory, the VO's.
_TO_DISK = {
    "doc_id": "docId", "title": "title", "mode": "mode", "shared_at": "sharedAt", "updated_at": "updatedAt",
    "expires_at": "expiresAt", "bytes": "bytes", "content_hash": "contentHash", "content": "content",
}


class JsonMarkdownShareRepository(MarkdownShareRepositoryPort):
    def __init__(self, file_path: str | Path = "data/markdown-shares.json"):
        self._path = seeded_data_path(file_path)
        self._lock = asyncio.Lock()
        self._loaded = False
        self._shares: Dict[str, MarkdownShareRecord] = {}     # token -> link
        self._by_doc: Dict[str, str] = {}                     # doc id -> token

    # ------------------------------------------------------------------ io
    def _load_unlocked(self) -> None:
        if self._loaded:
            return
        self._loaded = True
        if not self._path.exists():
            return
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
            entries = (raw.get("shares") or {}).items()
        except Exception as cause:  # noqa: BLE001 - never log the content: it is the owner's document
            logger.warning("Could not read the markdown share file (%s); starting empty", type(cause).__name__)
            try:
                self._path.rename(self._path.with_suffix(self._path.suffix + ".corrupt"))
            except OSError:
                pass
            return
        for token, data in entries:
            try:
                record = MarkdownShareRecord(token=token, **{name: data.get(key) for name, key in _TO_DISK.items() if key in data})
            except Exception:  # noqa: BLE001
                logger.warning("Skipping a malformed markdown share link")
                continue
            if record.doc_id in self._by_doc:
                continue                                       # one link per document: the first one wins
            self._shares[token] = record
            self._by_doc[record.doc_id] = token

    def _flush_unlocked(self) -> None:
        payload = {
            "version": 1,
            "shares": {
                token: {key: getattr(record, name) for name, key in _TO_DISK.items()}
                for token, record in self._shares.items()
            },
        }
        self._path.parent.mkdir(parents=True, exist_ok=True)
        temp = self._path.with_suffix(self._path.suffix + ".tmp")
        temp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        os.replace(temp, self._path)

    def _commit(self, undo) -> None:
        """Flush, or put memory back the way it was and re-raise."""
        try:
            self._flush_unlocked()
        except Exception:
            undo()
            raise

    # --------------------------------------------------------------- reads
    async def get_by_doc(self, doc_id: str) -> Optional[MarkdownShareSummary]:
        async with self._lock:
            self._load_unlocked()
            token = self._by_doc.get(doc_id)
            return self._shares[token].summary() if token else None

    async def count(self) -> int:
        async with self._lock:
            self._load_unlocked()
            return len(self._shares)

    async def list(self) -> List[MarkdownShareSummary]:
        async with self._lock:
            self._load_unlocked()
            rows = [record.summary() for record in self._shares.values()]
        rows.sort(key=lambda share: (-share.shared_at, share.doc_id))
        return rows

    async def get(self, token: str) -> Optional[MarkdownShareRecord]:
        async with self._lock:
            self._load_unlocked()
            record = self._shares.get(token)
            return record.model_copy() if record else None

    # -------------------------------------------------------------- writes
    async def save(self, record: MarkdownShareRecord) -> MarkdownShareSummary:
        async with self._lock:
            self._load_unlocked()
            before_token = self._by_doc.get(record.doc_id)
            before = self._shares.get(before_token) if before_token else None
            stored = record.model_copy()
            if before is not None:
                # One link per document: its token and the date it was first shared stay.
                stored = stored.model_copy(update={"token": before.token, "shared_at": before.shared_at})
            self._shares[stored.token] = stored
            self._by_doc[stored.doc_id] = stored.token

            def undo() -> None:
                if before is None:
                    self._shares.pop(stored.token, None)
                    self._by_doc.pop(stored.doc_id, None)
                else:
                    self._shares[before.token] = before

            self._commit(undo)
            return stored.summary()

    async def delete_by_doc(self, doc_id: str) -> bool:
        async with self._lock:
            self._load_unlocked()
            token = self._by_doc.pop(doc_id, None)
            if token is None:
                return False
            removed = self._shares.pop(token)

            def undo() -> None:
                self._shares[token] = removed
                self._by_doc[doc_id] = token

            self._commit(undo)
            return True

    async def purge_expired(self, now: int) -> int:
        async with self._lock:
            self._load_unlocked()
            doomed = {
                token: record for token, record in self._shares.items()
                if record.expires_at is not None and record.expires_at <= now
            }
            if not doomed:
                return 0
            for token, record in doomed.items():
                del self._shares[token]
                self._by_doc.pop(record.doc_id, None)

            def undo() -> None:
                for token, record in doomed.items():
                    self._shares[token] = record
                    self._by_doc[record.doc_id] = token

            self._commit(undo)
            return len(doomed)

    async def rename_docs(self, mapping: Dict[str, str]) -> int:
        async with self._lock:
            self._load_unlocked()
            moved: Dict[str, str] = {}
            for old, new in mapping.items():
                token = self._by_doc.get(old)
                if token is None or new in self._by_doc:
                    continue
                self._by_doc.pop(old)
                self._by_doc[new] = token
                self._shares[token] = self._shares[token].model_copy(update={"doc_id": new})
                moved[old] = new
            if not moved:
                return 0

            def undo() -> None:
                for old, new in moved.items():
                    token = self._by_doc.pop(new)
                    self._by_doc[old] = token
                    self._shares[token] = self._shares[token].model_copy(update={"doc_id": old})

            self._commit(undo)
            return len(moved)
