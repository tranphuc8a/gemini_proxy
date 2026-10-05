"""MySQL spending store, for when several devices share one backend.

The table is created on demand with `CREATE TABLE IF NOT EXISTS`, the same way
the postman store does, rather than through Alembic: this backend is opt-in and
must not force a migration on deployments that never enable it.

The client's document is one opaque JSON string in `payload`. Every statement is
plain portable SQL with bound parameters, because the test suite runs the
identical code against the SQLite engine it falls back to.

`replace_if_revision` is a single `UPDATE ... WHERE id = :id AND revision =
:expected`. The database evaluates the condition and applies the change
atomically (a locking read inside the UPDATE), so two concurrent saves from the
same base revision cannot both match. Success is `rowcount == 1`; MySQL counts
*changed* rows unless the driver asks for *matched* ones, and the two agree here
because `revision` always changes.
"""

from __future__ import annotations

import json
from typing import Any, Dict, Optional

from sqlalchemy import text

from src.adapter.output.mysql.db.base import get_async_session
from src.application.ports.output.spending_repository_port import SpendingRepositoryPort
from src.domain.vo.spending_vo import SpendingRecord

CREATE_WORKSPACES = """
CREATE TABLE IF NOT EXISTS spending_workspaces (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(191) NOT NULL,
    key_hash VARCHAR(128) NOT NULL,
    revision INTEGER NOT NULL,
    created_at VARCHAR(40) NOT NULL,
    updated_at VARCHAR(40) NOT NULL,
    payload LONGTEXT NOT NULL
)
"""


class MySqlSpendingRepository(SpendingRepositoryPort):
    def __init__(self) -> None:
        self._ready = False

    async def _session(self):
        session = get_async_session()
        if not self._ready:
            try:
                await session.execute(text(CREATE_WORKSPACES))
                await session.commit()
            except Exception:
                # Not marked ready: the next request tries again instead of
                # running against a table that was never created.
                await session.close()
                raise
            self._ready = True
        return session

    # ---------------------------------------------------------- (de)serialise
    @staticmethod
    def _to_row(record: SpendingRecord) -> Dict[str, Any]:
        return {
            "id": record.id,
            "name": record.name,
            "key_hash": record.key_hash,
            "revision": record.revision,
            "created_at": record.created_at,
            "updated_at": record.updated_at,
            "payload": json.dumps(record.data, ensure_ascii=False),
        }

    @staticmethod
    def _from_row(row: Any) -> SpendingRecord:
        mapping = row._mapping if hasattr(row, "_mapping") else row
        try:
            data = json.loads(mapping["payload"] or "{}")
        except (TypeError, ValueError):
            data = {}
        return SpendingRecord(
            id=mapping["id"],
            name=mapping["name"],
            key_hash=mapping["key_hash"],
            revision=int(mapping["revision"]),
            created_at=mapping["created_at"],
            updated_at=mapping["updated_at"],
            data=data if isinstance(data, dict) else {},
        )

    # ----------------------------------------------------------- workspace
    async def create(self, record: SpendingRecord) -> SpendingRecord:
        session = await self._session()
        try:
            await session.execute(
                text(
                    "INSERT INTO spending_workspaces "
                    "(id, name, key_hash, revision, created_at, updated_at, payload) "
                    "VALUES (:id, :name, :key_hash, :revision, :created_at, :updated_at, :payload)"
                ),
                self._to_row(record),
            )
            await session.commit()
            return record
        finally:
            await session.close()

    async def get(self, workspace_id: str) -> Optional[SpendingRecord]:
        session = await self._session()
        try:
            result = await session.execute(
                text("SELECT * FROM spending_workspaces WHERE id = :id"), {"id": workspace_id}
            )
            row = result.fetchone()
            return self._from_row(row) if row is not None else None
        finally:
            await session.close()

    async def replace_if_revision(self, record: SpendingRecord, expected_revision: int) -> bool:
        session = await self._session()
        try:
            params = self._to_row(record)
            params["expected"] = expected_revision
            result = await session.execute(
                text(
                    "UPDATE spending_workspaces SET name = :name, revision = :revision, "
                    "updated_at = :updated_at, payload = :payload "
                    "WHERE id = :id AND revision = :expected"
                ),
                params,
            )
            await session.commit()
            return result.rowcount == 1
        finally:
            await session.close()

    async def delete(self, workspace_id: str) -> bool:
        session = await self._session()
        try:
            result = await session.execute(
                text("DELETE FROM spending_workspaces WHERE id = :id"), {"id": workspace_id}
            )
            await session.commit()
            return (result.rowcount or 0) > 0
        finally:
            await session.close()
