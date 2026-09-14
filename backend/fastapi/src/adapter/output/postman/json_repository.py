"""JSON-file workspace store - the default backend.

Chosen as the default because it works on a laptop with no database at all,
which is the situation postman-lite-pro is normally used in. The whole document
set is held in memory and mirrored to one file; an `asyncio.Lock` serialises
writes so two concurrent saves cannot interleave and lose each other.

Writes go to a temporary file and are then moved into place, so a crash halfway
through leaves the previous good file rather than a truncated one.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from src.application.ports.output.postman_repository_port import PostmanRepositoryPort
from src.application.utils.data_paths import seeded_data_path
from src.domain.vo.postman_vo import HistoryEntry, WorkspaceRecord

logger = logging.getLogger(__name__)


class JsonPostmanRepository(PostmanRepositoryPort):
    def __init__(self, file_path: str | Path = "data/postman-workspaces.json"):
        # Resolved against a writable root rather than the working directory:
        # a serverless deployment unpacks its code read-only, and the first save
        # there used to fail with EROFS.
        self._path = seeded_data_path(file_path)
        self._lock = asyncio.Lock()
        self._loaded = False
        self._workspaces: Dict[str, WorkspaceRecord] = {}
        self._history: Dict[str, List[HistoryEntry]] = {}

    # ------------------------------------------------------------------ io
    def _load_unlocked(self) -> None:
        if self._loaded:
            return
        self._loaded = True
        if not self._path.exists():
            return
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
        except Exception:
            # A corrupt file must not take the whole app down; start empty and
            # keep the bad file so it can be inspected.
            logger.exception("Could not read %s; starting with an empty store", self._path)
            try:
                self._path.rename(self._path.with_suffix(self._path.suffix + ".corrupt"))
            except OSError:
                pass
            return

        for item in raw.get("workspaces", []):
            try:
                record = WorkspaceRecord(**item)
            except Exception:
                logger.warning("Skipping malformed workspace in %s", self._path)
                continue
            self._workspaces[record.id] = record

        for workspace_id, entries in (raw.get("history") or {}).items():
            page: List[HistoryEntry] = []
            for entry in entries:
                try:
                    page.append(HistoryEntry(**entry))
                except Exception:
                    continue
            self._history[workspace_id] = page

    def _flush_unlocked(self) -> None:
        payload: Dict[str, Any] = {
            "version": 1,
            "workspaces": [w.model_dump() for w in self._workspaces.values()],
            "history": {k: [e.model_dump() for e in v] for k, v in self._history.items()},
        }
        self._path.parent.mkdir(parents=True, exist_ok=True)
        temp = self._path.with_suffix(self._path.suffix + ".tmp")
        temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(temp, self._path)

    # ----------------------------------------------------------- workspace
    async def create(self, record: WorkspaceRecord) -> WorkspaceRecord:
        async with self._lock:
            self._load_unlocked()
            self._workspaces[record.id] = record
            self._flush_unlocked()
            return record

    async def get(self, workspace_id: str) -> Optional[WorkspaceRecord]:
        async with self._lock:
            self._load_unlocked()
            record = self._workspaces.get(workspace_id)
            # Hand out a copy: the caller mutates the record while saving, and a
            # failed save must not leave the in-memory store half-updated.
            return record.model_copy(deep=True) if record else None

    async def save(self, record: WorkspaceRecord) -> WorkspaceRecord:
        async with self._lock:
            self._load_unlocked()
            self._workspaces[record.id] = record
            self._flush_unlocked()
            return record

    async def delete(self, workspace_id: str) -> bool:
        async with self._lock:
            self._load_unlocked()
            existed = self._workspaces.pop(workspace_id, None) is not None
            self._history.pop(workspace_id, None)
            if existed:
                self._flush_unlocked()
            return existed

    async def find_by_share_token(self, token: str) -> Optional[WorkspaceRecord]:
        async with self._lock:
            self._load_unlocked()
            for record in self._workspaces.values():
                if record.share_token and record.share_token == token:
                    return record.model_copy(deep=True)
            return None

    # ------------------------------------------------------------- history
    async def list_history(self, workspace_id: str, limit: int, offset: int = 0) -> tuple[List[HistoryEntry], int]:
        async with self._lock:
            self._load_unlocked()
            entries = self._history.get(workspace_id, [])
            return [e.model_copy(deep=True) for e in entries[offset:offset + limit]], len(entries)

    async def append_history(self, workspace_id: str, entry: HistoryEntry, max_items: int) -> HistoryEntry:
        async with self._lock:
            self._load_unlocked()
            entries = self._history.setdefault(workspace_id, [])
            entries.insert(0, entry)
            del entries[max_items:]
            self._flush_unlocked()
            return entry

    async def clear_history(self, workspace_id: str) -> int:
        async with self._lock:
            self._load_unlocked()
            removed = len(self._history.pop(workspace_id, []))
            if removed:
                self._flush_unlocked()
            return removed
