"""MySQL workspace store, for when several people share one backend.

Tables are created on demand with `CREATE TABLE IF NOT EXISTS`, the same way
`markdown_storage_controller` does, rather than through Alembic: this feature is
opt-in via `POSTMAN_STORAGE_BACKEND=mysql` and must not force a migration on
deployments that never enable it.

Every statement is plain portable SQL with bound parameters, because the test
suite runs the identical code against the in-memory SQLite engine.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from sqlalchemy import text

from src.adapter.output.mysql.db.base import get_async_session
from src.application.ports.output.postman_repository_port import PostmanRepositoryPort
from src.domain.vo.postman_vo import HistoryEntry, WorkspaceRecord

CREATE_WORKSPACES = """
CREATE TABLE IF NOT EXISTS postman_workspaces (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(191) NOT NULL,
    key_hash VARCHAR(128) NOT NULL,
    revision INTEGER NOT NULL,
    created_at VARCHAR(40) NOT NULL,
    updated_at VARCHAR(40) NOT NULL,
    share_token VARCHAR(64) NULL,
    payload LONGTEXT NOT NULL
)
"""

CREATE_HISTORY = """
CREATE TABLE IF NOT EXISTS postman_history (
    id VARCHAR(64) PRIMARY KEY,
    workspace_id VARCHAR(64) NOT NULL,
    timestamp VARCHAR(40) NOT NULL,
    payload LONGTEXT NOT NULL
)
"""

# Share lookups and history paging are the only non-primary-key reads.
CREATE_SHARE_INDEX = "CREATE INDEX IF NOT EXISTS ix_postman_share ON postman_workspaces (share_token)"
CREATE_HISTORY_INDEX = "CREATE INDEX IF NOT EXISTS ix_postman_history_ws ON postman_history (workspace_id, timestamp)"


class MySqlPostmanRepository(PostmanRepositoryPort):
    def __init__(self) -> None:
        self._ready = False

    async def _session(self):
        session = get_async_session()
        if not self._ready:
            for statement in (CREATE_WORKSPACES, CREATE_HISTORY, CREATE_SHARE_INDEX, CREATE_HISTORY_INDEX):
                try:
                    await session.execute(text(statement))
                except Exception:
                    # MySQL before 8.0.29 rejects "CREATE INDEX IF NOT EXISTS";
                    # the index is an optimisation, not a correctness condition.
                    pass
            await session.commit()
            self._ready = True
        return session

    # ---------------------------------------------------------- (de)serialise
    @staticmethod
    def _to_row(record: WorkspaceRecord) -> Dict[str, Any]:
        payload = {
            "collections": record.collections,
            "requests": record.requests,
            "environments": record.environments,
        }
        return {
            "id": record.id,
            "name": record.name,
            "key_hash": record.key_hash,
            "revision": record.revision,
            "created_at": record.created_at,
            "updated_at": record.updated_at,
            "share_token": record.share_token,
            "payload": json.dumps(payload, ensure_ascii=False),
        }

    @staticmethod
    def _from_row(row: Any) -> WorkspaceRecord:
        mapping = row._mapping if hasattr(row, "_mapping") else row
        try:
            payload = json.loads(mapping["payload"] or "{}")
        except (TypeError, ValueError):
            payload = {}
        return WorkspaceRecord(
            id=mapping["id"],
            name=mapping["name"],
            key_hash=mapping["key_hash"],
            revision=int(mapping["revision"]),
            created_at=mapping["created_at"],
            updated_at=mapping["updated_at"],
            share_token=mapping["share_token"],
            collections=payload.get("collections") or [],
            requests=payload.get("requests") or [],
            environments=payload.get("environments") or [],
        )

    # ----------------------------------------------------------- workspace
    async def create(self, record: WorkspaceRecord) -> WorkspaceRecord:
        session = await self._session()
        try:
            await session.execute(
                text(
                    "INSERT INTO postman_workspaces "
                    "(id, name, key_hash, revision, created_at, updated_at, share_token, payload) "
                    "VALUES (:id, :name, :key_hash, :revision, :created_at, :updated_at, :share_token, :payload)"
                ),
                self._to_row(record),
            )
            await session.commit()
            return record
        finally:
            await session.close()

    async def get(self, workspace_id: str) -> Optional[WorkspaceRecord]:
        session = await self._session()
        try:
            result = await session.execute(
                text("SELECT * FROM postman_workspaces WHERE id = :id"), {"id": workspace_id}
            )
            row = result.fetchone()
            return self._from_row(row) if row is not None else None
        finally:
            await session.close()

    async def save(self, record: WorkspaceRecord) -> WorkspaceRecord:
        session = await self._session()
        try:
            await session.execute(
                text(
                    "UPDATE postman_workspaces SET name = :name, revision = :revision, "
                    "updated_at = :updated_at, share_token = :share_token, payload = :payload "
                    "WHERE id = :id"
                ),
                self._to_row(record),
            )
            await session.commit()
            return record
        finally:
            await session.close()

    async def delete(self, workspace_id: str) -> bool:
        session = await self._session()
        try:
            result = await session.execute(
                text("DELETE FROM postman_workspaces WHERE id = :id"), {"id": workspace_id}
            )
            await session.execute(
                text("DELETE FROM postman_history WHERE workspace_id = :id"), {"id": workspace_id}
            )
            await session.commit()
            return (result.rowcount or 0) > 0
        finally:
            await session.close()

    async def find_by_share_token(self, token: str) -> Optional[WorkspaceRecord]:
        session = await self._session()
        try:
            result = await session.execute(
                text("SELECT * FROM postman_workspaces WHERE share_token = :token"), {"token": token}
            )
            row = result.fetchone()
            return self._from_row(row) if row is not None else None
        finally:
            await session.close()

    # ------------------------------------------------------------- history
    async def list_history(self, workspace_id: str, limit: int, offset: int = 0) -> tuple[List[HistoryEntry], int]:
        session = await self._session()
        try:
            total = await session.execute(
                text("SELECT COUNT(*) FROM postman_history WHERE workspace_id = :ws"),
                {"ws": workspace_id},
            )
            count = int(total.scalar() or 0)

            result = await session.execute(
                text(
                    "SELECT payload FROM postman_history WHERE workspace_id = :ws "
                    "ORDER BY timestamp DESC LIMIT :limit OFFSET :offset"
                ),
                {"ws": workspace_id, "limit": limit, "offset": offset},
            )
            entries: List[HistoryEntry] = []
            for row in result.fetchall():
                try:
                    entries.append(HistoryEntry(**json.loads(row[0])))
                except (TypeError, ValueError):
                    continue
            return entries, count
        finally:
            await session.close()

    async def append_history(self, workspace_id: str, entry: HistoryEntry, max_items: int) -> HistoryEntry:
        session = await self._session()
        try:
            await session.execute(
                text(
                    "INSERT INTO postman_history (id, workspace_id, timestamp, payload) "
                    "VALUES (:id, :ws, :ts, :payload)"
                ),
                {
                    "id": entry.id,
                    "ws": workspace_id,
                    "ts": entry.timestamp or "",
                    "payload": json.dumps(entry.model_dump(), ensure_ascii=False),
                },
            )
            # Trim by id rather than with a LIMIT in DELETE: MySQL does not allow
            # a LIMIT inside a subquery on the table being deleted from.
            result = await session.execute(
                text(
                    "SELECT id FROM postman_history WHERE workspace_id = :ws "
                    "ORDER BY timestamp DESC LIMIT :limit OFFSET :offset"
                ),
                {"ws": workspace_id, "limit": 1000, "offset": max_items},
            )
            stale = [row[0] for row in result.fetchall()]
            for stale_id in stale:
                await session.execute(
                    text("DELETE FROM postman_history WHERE id = :id"), {"id": stale_id}
                )
            await session.commit()
            return entry
        finally:
            await session.close()

    async def clear_history(self, workspace_id: str) -> int:
        session = await self._session()
        try:
            result = await session.execute(
                text("DELETE FROM postman_history WHERE workspace_id = :ws"), {"ws": workspace_id}
            )
            await session.commit()
            return result.rowcount or 0
        finally:
            await session.close()
