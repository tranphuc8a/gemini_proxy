"""JSON-file spending store - the zero-setup backend.

Works on a laptop with no database at all, and is what the test suite drives the
usecase and controller against. The whole document set is held in memory and
mirrored to one file; an `asyncio.Lock` serialises every operation, so
`replace_if_revision` can compare the revision and write it under one lock and
two concurrent saves cannot both win.

Writes go to a temporary file and are then moved into place, so a crash halfway
through leaves the previous good file rather than a truncated one. The file is
written compactly: a workspace holds a client-sized document, and indenting it
would only add weight.

On a serverless platform the file lives in an ephemeral directory (see
`application/utils/data_paths`); use the mysql or mongo backend there.
"""

from __future__ import annotations

import asyncio
import copy
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional

from src.application.ports.output.spending_repository_port import SpendingRepositoryPort
from src.application.utils.data_paths import seeded_data_path
from src.domain.vo.spending_vo import SpendingRecord

logger = logging.getLogger(__name__)


class JsonSpendingRepository(SpendingRepositoryPort):
    def __init__(self, file_path: str | Path = "data/spending-workspaces.json"):
        # Resolved against a writable root rather than the working directory:
        # a serverless deployment unpacks its code read-only, and the first save
        # there used to fail with EROFS.
        self._path = seeded_data_path(file_path)
        self._lock = asyncio.Lock()
        self._loaded = False
        self._workspaces: Dict[str, SpendingRecord] = {}

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
                record = SpendingRecord(**item)
            except Exception:
                logger.warning("Skipping malformed workspace in %s", self._path)
                continue
            self._workspaces[record.id] = record

    def _flush_unlocked(self) -> None:
        payload: Dict[str, Any] = {
            "version": 1,
            "workspaces": [w.model_dump() for w in self._workspaces.values()],
        }
        self._path.parent.mkdir(parents=True, exist_ok=True)
        temp = self._path.with_suffix(self._path.suffix + ".tmp")
        temp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        os.replace(temp, self._path)

    # ----------------------------------------------------------- workspace
    async def create(self, record: SpendingRecord) -> SpendingRecord:
        async with self._lock:
            self._load_unlocked()
            # Keep a private copy: the caller still holds `record`, and later
            # edits to it must not reach the store without a save.
            self._workspaces[record.id] = record.model_copy(deep=True)
            try:
                self._flush_unlocked()
            except Exception:
                # Memory must not claim a write the disk refused.
                self._workspaces.pop(record.id, None)
                raise
            return record

    async def get(self, workspace_id: str) -> Optional[SpendingRecord]:
        async with self._lock:
            self._load_unlocked()
            record = self._workspaces.get(workspace_id)
            return record.model_copy(deep=True) if record else None

    async def replace_if_revision(self, record: SpendingRecord, expected_revision: int) -> bool:
        async with self._lock:
            self._load_unlocked()
            current = self._workspaces.get(record.id)
            # Compared under the lock that also guards the write below, so no
            # other save can slip in between the check and the assignment.
            if current is None or current.revision != expected_revision:
                return False
            self._workspaces[record.id] = current.model_copy(
                update={
                    "name": record.name,
                    "revision": record.revision,
                    "updated_at": record.updated_at,
                    "data": copy.deepcopy(record.data),
                }
            )
            try:
                self._flush_unlocked()
            except Exception:
                self._workspaces[record.id] = current
                raise
            return True

    async def delete(self, workspace_id: str) -> bool:
        async with self._lock:
            self._load_unlocked()
            removed = self._workspaces.pop(workspace_id, None)
            if removed is None:
                return False
            try:
                self._flush_unlocked()
            except Exception:
                self._workspaces[workspace_id] = removed
                raise
            return True
