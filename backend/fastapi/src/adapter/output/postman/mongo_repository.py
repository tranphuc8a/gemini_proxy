"""MongoDB workspace store, the third `POSTMAN_STORAGE_BACKEND`.

It exists for the deployment that has a MongoDB and no MySQL -- on a serverless
platform the JSON backend's file lives in an ephemeral directory, so "no
database" and "no persistence" are the same thing there.

Two collections mirror the two MySQL tables. A workspace document keeps the
envelope (identity, revision, access) as top-level fields and the browser-owned
payload nested under `payload`, exactly as the SQL adapter puts it in one JSON
column: the shape of a collection or request belongs to the client, and storing
it as opaque data is what keeps this adapter out of the way when it changes.

Indexes are created on first use rather than through a migration, matching how
the MySQL adapter creates its tables: this backend is opt-in and must not impose
anything on deployments that never select it.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from src.adapter.output.mongostore import client as mongo_store
from src.application.ports.output.postman_repository_port import PostmanRepositoryPort
from src.domain.vo.postman_vo import HistoryEntry, WorkspaceRecord

logger = logging.getLogger(__name__)

WORKSPACES = "postman_workspaces"
HISTORY = "postman_history"


class MongoPostmanRepository(PostmanRepositoryPort):
    def __init__(self) -> None:
        self._ready = False

    async def _collections(self) -> tuple[Any, Any]:
        workspaces = mongo_store.get_collection(WORKSPACES)
        history = mongo_store.get_collection(HISTORY)
        if not self._ready:
            try:
                await workspaces.create_index("share_token", sparse=True)
                # History is only ever read newest-first within one workspace.
                await history.create_index([("workspace_id", 1), ("timestamp", -1)])
            except Exception:
                # An index is an optimisation, not a correctness condition; a
                # user without index privileges should still get a working store.
                logger.warning("Could not create postman indexes", exc_info=True)
            self._ready = True
        return workspaces, history

    # ---------------------------------------------------------- (de)serialise
    @staticmethod
    def _to_document(record: WorkspaceRecord) -> Dict[str, Any]:
        return {
            "_id": record.id,
            "name": record.name,
            "key_hash": record.key_hash,
            "revision": record.revision,
            "created_at": record.created_at,
            "updated_at": record.updated_at,
            "share_token": record.share_token,
            "payload": {
                "collections": record.collections,
                "requests": record.requests,
                "environments": record.environments,
            },
        }

    @staticmethod
    def _from_document(doc: Dict[str, Any]) -> WorkspaceRecord:
        payload = doc.get("payload") or {}
        return WorkspaceRecord(
            id=doc["_id"],
            name=doc["name"],
            key_hash=doc["key_hash"],
            revision=int(doc["revision"]),
            created_at=doc["created_at"],
            updated_at=doc["updated_at"],
            share_token=doc.get("share_token"),
            collections=payload.get("collections") or [],
            requests=payload.get("requests") or [],
            environments=payload.get("environments") or [],
        )

    # ----------------------------------------------------------- workspace
    async def create(self, record: WorkspaceRecord) -> WorkspaceRecord:
        workspaces, _ = await self._collections()
        await workspaces.insert_one(self._to_document(record))
        return record

    async def get(self, workspace_id: str) -> Optional[WorkspaceRecord]:
        workspaces, _ = await self._collections()
        doc = await workspaces.find_one({"_id": workspace_id})
        return self._from_document(doc) if doc else None

    async def save(self, record: WorkspaceRecord) -> WorkspaceRecord:
        workspaces, _ = await self._collections()
        document = self._to_document(record)
        document.pop("_id")
        await workspaces.update_one({"_id": record.id}, {"$set": document})
        return record

    async def delete(self, workspace_id: str) -> bool:
        workspaces, history = await self._collections()
        result = await workspaces.delete_one({"_id": workspace_id})
        await history.delete_many({"workspace_id": workspace_id})
        return result.deleted_count > 0

    async def find_by_share_token(self, token: str) -> Optional[WorkspaceRecord]:
        workspaces, _ = await self._collections()
        doc = await workspaces.find_one({"share_token": token})
        return self._from_document(doc) if doc else None

    # ------------------------------------------------------------- history
    async def list_history(self, workspace_id: str, limit: int, offset: int = 0) -> tuple[List[HistoryEntry], int]:
        _, history = await self._collections()
        total = await history.count_documents({"workspace_id": workspace_id})
        cursor = (
            history.find({"workspace_id": workspace_id})
            .sort("timestamp", -1)
            .skip(offset)
            .limit(limit)
        )
        entries: List[HistoryEntry] = []
        async for doc in cursor:
            try:
                entries.append(HistoryEntry(**(doc.get("payload") or {})))
            except Exception:
                # One unreadable entry must not hide the rest of the history.
                continue
        return entries, total

    async def append_history(self, workspace_id: str, entry: HistoryEntry, max_items: int) -> HistoryEntry:
        _, history = await self._collections()
        await history.insert_one({
            "_id": entry.id,
            "workspace_id": workspace_id,
            "timestamp": entry.timestamp or "",
            "payload": entry.model_dump(),
        })

        # Trim to the newest `max_items`. Collecting the ids to drop first keeps
        # this to one delete, and skipping the read entirely when the workspace
        # is under the cap keeps the common path to a single insert.
        if await history.count_documents({"workspace_id": workspace_id}) > max_items:
            stale = history.find({"workspace_id": workspace_id}, {"_id": 1}).sort("timestamp", -1).skip(max_items)
            doomed = [doc["_id"] async for doc in stale]
            if doomed:
                await history.delete_many({"_id": {"$in": doomed}})
        return entry

    async def clear_history(self, workspace_id: str) -> int:
        _, history = await self._collections()
        result = await history.delete_many({"workspace_id": workspace_id})
        return result.deleted_count
