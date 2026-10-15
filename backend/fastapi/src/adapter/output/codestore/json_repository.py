"""JSON-file Code Studio store - the zero-setup backend.

The whole store lives in memory and is mirrored to one file: workspaces, each
with its records. An `asyncio.Lock` serialises every operation, so
`upsert_newer` compares and writes under one lock and two concurrent pushes
cannot both win. Writes go to a temporary file that is then moved into place, so a
crash halfway leaves the previous good file.

On a serverless platform the file lives in an ephemeral directory (see
`application/utils/data_paths`): use the mysql or mongo backend there.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Dict, List, Optional, Sequence

from src.application.ports.output.codestore_repository_port import CodestoreRepositoryPort
from src.application.utils.data_paths import seeded_data_path
from src.domain.vo.codestore_vo import CodeItem, WorkspaceRecord, wins

logger = logging.getLogger(__name__)


class JsonCodestoreRepository(CodestoreRepositoryPort):
    def __init__(self, file_path: str | Path = "data/codestore.json"):
        self._path = seeded_data_path(file_path)
        self._lock = asyncio.Lock()
        self._loaded = False
        self._workspaces: Dict[str, WorkspaceRecord] = {}
        self._items: Dict[str, Dict[str, CodeItem]] = {}

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
            # A corrupt file must not take the app down: start empty, keep the
            # bad file where it can be inspected.
            logger.exception("Could not read %s; starting with an empty store", self._path)
            try:
                self._path.rename(self._path.with_suffix(self._path.suffix + ".corrupt"))
            except OSError:
                pass
            return
        for workspace_id, entry in (raw.get("workspaces") or {}).items():
            try:
                record = WorkspaceRecord(id=workspace_id, key_hash=entry["key_hash"], created_at=entry["created_at"])
            except Exception:
                logger.warning("Skipping malformed workspace in %s", self._path)
                continue
            items: Dict[str, CodeItem] = {}
            for item_id, data in (entry.get("items") or {}).items():
                try:
                    items[item_id] = CodeItem(**data)
                except Exception:
                    logger.warning("Skipping malformed record in %s", self._path)
            self._workspaces[workspace_id] = record
            self._items[workspace_id] = items

    def _flush_unlocked(self) -> None:
        payload = {
            "version": 1,
            "workspaces": {
                workspace_id: {
                    "key_hash": record.key_hash,
                    "created_at": record.created_at,
                    "items": {item_id: item.model_dump() for item_id, item in self._items.get(workspace_id, {}).items()},
                }
                for workspace_id, record in self._workspaces.items()
            },
        }
        self._path.parent.mkdir(parents=True, exist_ok=True)
        temp = self._path.with_suffix(self._path.suffix + ".tmp")
        temp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        os.replace(temp, self._path)

    # ----------------------------------------------------------- workspaces
    async def create_workspace(self, record: WorkspaceRecord) -> None:
        async with self._lock:
            self._load_unlocked()
            self._workspaces[record.id] = record.model_copy()
            self._items[record.id] = {}
            try:
                self._flush_unlocked()
            except Exception:
                # Memory must not claim a write the disk refused.
                self._workspaces.pop(record.id, None)
                self._items.pop(record.id, None)
                raise

    async def get_workspace(self, workspace_id: str) -> Optional[WorkspaceRecord]:
        async with self._lock:
            self._load_unlocked()
            record = self._workspaces.get(workspace_id)
            return record.model_copy() if record else None

    async def delete_workspace(self, workspace_id: str) -> bool:
        async with self._lock:
            self._load_unlocked()
            record = self._workspaces.pop(workspace_id, None)
            if record is None:
                return False
            items = self._items.pop(workspace_id, {})
            try:
                self._flush_unlocked()
            except Exception:
                self._workspaces[workspace_id] = record
                self._items[workspace_id] = items
                raise
            return True

    # -------------------------------------------------------------- records
    async def count_items(self, workspace_id: str) -> int:
        async with self._lock:
            self._load_unlocked()
            return len(self._items.get(workspace_id, {}))

    async def get_items(self, workspace_id: str, ids: Sequence[str]) -> Dict[str, CodeItem]:
        async with self._lock:
            self._load_unlocked()
            held = self._items.get(workspace_id, {})
            return {item_id: held[item_id].model_copy(deep=True) for item_id in ids if item_id in held}

    async def list_since(self, workspace_id: str, since: int, limit: int) -> List[CodeItem]:
        async with self._lock:
            self._load_unlocked()
            newer = [item for item in self._items.get(workspace_id, {}).values() if item.serverUpdatedAt > since]
            newer.sort(key=lambda item: (item.serverUpdatedAt, item.id))
            return [item.model_copy(deep=True) for item in newer[:limit]]

    async def upsert_newer(self, workspace_id: str, items: Sequence[CodeItem]) -> List[str]:
        async with self._lock:
            self._load_unlocked()
            held = self._items.get(workspace_id)
            if held is None:
                return []
            before = dict(held)
            written: List[str] = []
            for item in items:
                current = held.get(item.id)
                # Compared under the lock that also guards the write.
                if current is None or wins(item.updatedAt, item.deleted, current.updatedAt, current.deleted):
                    held[item.id] = item.model_copy(deep=True)
                    written.append(item.id)
            if written:
                try:
                    self._flush_unlocked()
                except Exception:
                    self._items[workspace_id] = before
                    raise
            return written

    async def purge_tombstones(self, workspace_id: str, before: int) -> int:
        async with self._lock:
            self._load_unlocked()
            held = self._items.get(workspace_id, {})
            doomed = [item_id for item_id, item in held.items() if item.deleted and item.serverUpdatedAt < before]
            if not doomed:
                return 0
            removed = {item_id: held.pop(item_id) for item_id in doomed}
            try:
                self._flush_unlocked()
            except Exception:
                held.update(removed)
                raise
            return len(doomed)
