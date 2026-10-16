"""MySQL Code Studio store, for when several devices share one backend.

Three tables (workspaces, records, read-only share links) are created on demand with `CREATE TABLE IF NOT EXISTS`, the same way
the spending and postman stores do, rather than through Alembic: this backend is
opt-in and must not force a migration on deployments that never enable it.

A record is one row; its whole JSON is `payload`, and the three values that are
queried (`updated_at`, `server_updated_at`, `deleted`) are columns as well. Every
statement is plain portable SQL with bound parameters, because the test suite
runs the identical code against the SQLite engine it falls back to. (No secondary
index: `CREATE INDEX IF NOT EXISTS` is not MySQL syntax, and the primary key
`(workspace_id, id)` already confines a read to one workspace's few thousand rows.)

`upsert_newer` applies last-writer-wins in the database. The `UPDATE` carries the
rule in its `WHERE`, so the comparison and the write are one atomic statement;
only when it matched nothing does the code look for the row, and insert it if it
is absent. Two requests inserting the same new id at once make one `INSERT` fail
on the primary key: the whole batch is then rolled back and run once more, which
is safe because applying the same records again changes nothing.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Sequence

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from src.adapter.output.mysql.db.base import get_async_session
from src.application.ports.output.codestore_repository_port import CodestoreRepositoryPort
from src.domain.vo.codestore_vo import CodeItem, ShareRecord, ShareSummary, WorkspaceRecord

CREATE_WORKSPACES = """
CREATE TABLE IF NOT EXISTS codestore_workspaces (
    id VARCHAR(64) PRIMARY KEY,
    key_hash VARCHAR(128) NOT NULL,
    created_at VARCHAR(40) NOT NULL
)
"""

CREATE_ITEMS = """
CREATE TABLE IF NOT EXISTS codestore_items (
    workspace_id VARCHAR(64) NOT NULL,
    id VARCHAR(80) NOT NULL,
    updated_at BIGINT NOT NULL,
    server_updated_at BIGINT NOT NULL,
    deleted INTEGER NOT NULL,
    payload LONGTEXT NOT NULL,
    PRIMARY KEY (workspace_id, id)
)
"""

# A link is found by its token (the primary key) or by (workspace, record) (the unique key):
# neither lookup scans. `name` and the dates are columns so that listing a workspace's links
# does not read the snapshots, which can be 512 KB each.
CREATE_SHARES = """
CREATE TABLE IF NOT EXISTS codestore_shares (
    token VARCHAR(64) NOT NULL PRIMARY KEY,
    workspace_id VARCHAR(64) NOT NULL,
    item_id VARCHAR(80) NOT NULL,
    name VARCHAR(255) NOT NULL,
    shared_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    payload LONGTEXT NOT NULL,
    UNIQUE (workspace_id, item_id)
)
"""

SHARE_COLUMNS = "token, workspace_id, item_id, name, shared_at, updated_at"
UPDATE_SHARE = text(
    "UPDATE codestore_shares SET name = :name, updated_at = :updated_at, payload = :payload "
    "WHERE workspace_id = :workspace_id AND item_id = :item_id"
)
INSERT_SHARE = text(
    "INSERT INTO codestore_shares (token, workspace_id, item_id, name, shared_at, updated_at, payload) "
    "VALUES (:token, :workspace_id, :item_id, :name, :shared_at, :updated_at, :payload)"
)

UPDATE_IF_NEWER = text(
    "UPDATE codestore_items SET updated_at = :updated_at, server_updated_at = :server_updated_at, "
    "deleted = :deleted, payload = :payload "
    "WHERE workspace_id = :workspace_id AND id = :id "
    "AND (updated_at < :updated_at OR (updated_at = :updated_at AND deleted = 0 AND :deleted = 1))"
)
INSERT_ITEM = text(
    "INSERT INTO codestore_items (workspace_id, id, updated_at, server_updated_at, deleted, payload) "
    "VALUES (:workspace_id, :id, :updated_at, :server_updated_at, :deleted, :payload)"
)


def _row(workspace_id: str, item: CodeItem) -> Dict[str, Any]:
    return {
        "workspace_id": workspace_id,
        "id": item.id,
        "updated_at": item.updatedAt,
        "server_updated_at": item.serverUpdatedAt,
        "deleted": 1 if item.deleted else 0,
        "payload": json.dumps(item.model_dump(), ensure_ascii=False),
    }


def _item(row: Any) -> CodeItem:
    mapping = row._mapping if hasattr(row, "_mapping") else row
    data = json.loads(mapping["payload"])
    # The columns are what is queried; make the object agree with them.
    data["serverUpdatedAt"] = int(mapping["server_updated_at"])
    return CodeItem(**data)


def _share_summary(row: Any) -> ShareSummary:
    mapping = row._mapping if hasattr(row, "_mapping") else row
    return ShareSummary(
        token=mapping["token"], workspace_id=mapping["workspace_id"], item_id=mapping["item_id"],
        name=mapping["name"], shared_at=int(mapping["shared_at"]), updated_at=int(mapping["updated_at"]),
    )


class MySqlCodestoreRepository(CodestoreRepositoryPort):
    def __init__(self) -> None:
        self._ready = False

    async def _session(self):
        session = get_async_session()
        if not self._ready:
            try:
                await session.execute(text(CREATE_WORKSPACES))
                await session.execute(text(CREATE_ITEMS))
                await session.execute(text(CREATE_SHARES))
                await session.commit()
            except Exception:
                # Not marked ready: the next request tries again.
                await session.close()
                raise
            self._ready = True
        return session

    # ----------------------------------------------------------- workspaces
    async def create_workspace(self, record: WorkspaceRecord) -> None:
        session = await self._session()
        try:
            await session.execute(
                text("INSERT INTO codestore_workspaces (id, key_hash, created_at) VALUES (:id, :key_hash, :created_at)"),
                {"id": record.id, "key_hash": record.key_hash, "created_at": record.created_at},
            )
            await session.commit()
        finally:
            await session.close()

    async def get_workspace(self, workspace_id: str) -> Optional[WorkspaceRecord]:
        session = await self._session()
        try:
            result = await session.execute(
                text("SELECT id, key_hash, created_at FROM codestore_workspaces WHERE id = :id"), {"id": workspace_id}
            )
            row = result.fetchone()
            if row is None:
                return None
            mapping = row._mapping
            return WorkspaceRecord(id=mapping["id"], key_hash=mapping["key_hash"], created_at=mapping["created_at"])
        finally:
            await session.close()

    async def delete_workspace(self, workspace_id: str) -> bool:
        session = await self._session()
        try:
            await session.execute(text("DELETE FROM codestore_shares WHERE workspace_id = :id"), {"id": workspace_id})
            await session.execute(text("DELETE FROM codestore_items WHERE workspace_id = :id"), {"id": workspace_id})
            result = await session.execute(text("DELETE FROM codestore_workspaces WHERE id = :id"), {"id": workspace_id})
            await session.commit()
            return (result.rowcount or 0) > 0
        finally:
            await session.close()

    # -------------------------------------------------------------- records
    async def count_items(self, workspace_id: str) -> int:
        session = await self._session()
        try:
            result = await session.execute(
                text("SELECT COUNT(*) FROM codestore_items WHERE workspace_id = :id"), {"id": workspace_id}
            )
            return int(result.scalar() or 0)
        finally:
            await session.close()

    async def get_items(self, workspace_id: str, ids: Sequence[str]) -> Dict[str, CodeItem]:
        if not ids:
            return {}
        session = await self._session()
        try:
            names = {f"i{index}": item_id for index, item_id in enumerate(ids)}
            marks = ", ".join(f":{name}" for name in names)
            result = await session.execute(
                text(f"SELECT payload, server_updated_at FROM codestore_items "
                     f"WHERE workspace_id = :workspace_id AND id IN ({marks})"),
                {"workspace_id": workspace_id, **names},
            )
            items = [_item(row) for row in result.fetchall()]
            return {item.id: item for item in items}
        finally:
            await session.close()

    async def list_since(self, workspace_id: str, since: int, limit: int) -> List[CodeItem]:
        session = await self._session()
        try:
            result = await session.execute(
                text("SELECT payload, server_updated_at FROM codestore_items "
                     "WHERE workspace_id = :workspace_id AND server_updated_at > :since "
                     "ORDER BY server_updated_at ASC, id ASC LIMIT :limit"),
                {"workspace_id": workspace_id, "since": since, "limit": limit},
            )
            return [_item(row) for row in result.fetchall()]
        finally:
            await session.close()

    async def upsert_newer(self, workspace_id: str, items: Sequence[CodeItem]) -> List[str]:
        session = await self._session()
        try:
            for attempt in range(2):
                written: List[str] = []
                try:
                    for item in items:
                        if await self._upsert_one(session, workspace_id, item):
                            written.append(item.id)
                    await session.commit()
                    return written
                except IntegrityError:
                    # Another request inserted one of these ids first.
                    await session.rollback()
                    if attempt == 1:
                        raise
            return []
        finally:
            await session.close()

    @staticmethod
    async def _upsert_one(session, workspace_id: str, item: CodeItem) -> bool:
        row = _row(workspace_id, item)
        updated = await session.execute(UPDATE_IF_NEWER, row)
        if updated.rowcount == 1:
            return True
        present = await session.execute(
            text("SELECT 1 FROM codestore_items WHERE workspace_id = :workspace_id AND id = :id"),
            {"workspace_id": workspace_id, "id": item.id},
        )
        if present.first() is not None:
            return False                       # it is there, and it wins
        await session.execute(INSERT_ITEM, row)
        return True

    async def purge_tombstones(self, workspace_id: str, before: int) -> int:
        session = await self._session()
        try:
            result = await session.execute(
                text("DELETE FROM codestore_items WHERE workspace_id = :id AND deleted = 1 "
                     "AND server_updated_at < :before"),
                {"id": workspace_id, "before": before},
            )
            await session.commit()
            return int(result.rowcount or 0)
        finally:
            await session.close()

    # --------------------------------------------------------------- shares
    async def get_share_for_item(self, workspace_id: str, item_id: str) -> Optional[ShareSummary]:
        session = await self._session()
        try:
            result = await session.execute(
                text(f"SELECT {SHARE_COLUMNS} FROM codestore_shares WHERE workspace_id = :workspace_id AND item_id = :item_id"),
                {"workspace_id": workspace_id, "item_id": item_id},
            )
            row = result.fetchone()
            return _share_summary(row) if row is not None else None
        finally:
            await session.close()

    async def save_share(self, record: ShareRecord) -> ShareSummary:
        where = {"workspace_id": record.workspace_id, "item_id": record.item_id}
        payload = json.dumps(record.item.model_dump(), ensure_ascii=False)
        refresh = {**where, "name": record.name[:255], "updated_at": record.updated_at, "payload": payload}
        create = {**refresh, "token": record.token, "shared_at": record.shared_at}
        session = await self._session()
        try:
            for attempt in range(2):
                try:
                    updated = await session.execute(UPDATE_SHARE, refresh)
                    if not updated.rowcount:
                        present = await session.execute(
                            text("SELECT 1 FROM codestore_shares WHERE workspace_id = :workspace_id AND item_id = :item_id"),
                            where,
                        )
                        if present.first() is None:
                            await session.execute(INSERT_SHARE, create)
                    stored = await session.execute(
                        text(f"SELECT {SHARE_COLUMNS} FROM codestore_shares "
                             "WHERE workspace_id = :workspace_id AND item_id = :item_id"),
                        where,
                    )
                    summary = _share_summary(stored.fetchone())
                    await session.commit()
                    return summary
                except IntegrityError:
                    # Another request created this record's link first: update that one.
                    await session.rollback()
                    if attempt == 1:
                        raise
            raise RuntimeError("unreachable")  # pragma: no cover
        finally:
            await session.close()

    async def count_shares(self, workspace_id: str) -> int:
        session = await self._session()
        try:
            result = await session.execute(
                text("SELECT COUNT(*) FROM codestore_shares WHERE workspace_id = :id"), {"id": workspace_id}
            )
            return int(result.scalar() or 0)
        finally:
            await session.close()

    async def list_shares(self, workspace_id: str) -> List[ShareSummary]:
        session = await self._session()
        try:
            result = await session.execute(
                text(f"SELECT {SHARE_COLUMNS} FROM codestore_shares WHERE workspace_id = :id "
                     "ORDER BY shared_at DESC, item_id ASC"),
                {"id": workspace_id},
            )
            return [_share_summary(row) for row in result.fetchall()]
        finally:
            await session.close()

    async def get_share(self, token: str) -> Optional[ShareRecord]:
        session = await self._session()
        try:
            result = await session.execute(
                text(f"SELECT {SHARE_COLUMNS}, payload FROM codestore_shares WHERE token = :token"), {"token": token}
            )
            row = result.fetchone()
            if row is None:
                return None
            summary = _share_summary(row)
            if summary.token != token:
                return None        # MySQL's default collation ignores case: the token must match exactly
            mapping = row._mapping
            return ShareRecord(**summary.model_dump(), item=CodeItem(**json.loads(mapping["payload"])))
        finally:
            await session.close()

    async def delete_share(self, workspace_id: str, item_id: str) -> bool:
        return await self.delete_shares(workspace_id, [item_id]) > 0

    async def delete_shares(self, workspace_id: str, item_ids: Sequence[str]) -> int:
        if not item_ids:
            return 0
        session = await self._session()
        try:
            names = {f"i{index}": item_id for index, item_id in enumerate(item_ids)}
            marks = ", ".join(f":{name}" for name in names)
            result = await session.execute(
                text(f"DELETE FROM codestore_shares WHERE workspace_id = :workspace_id AND item_id IN ({marks})"),
                {"workspace_id": workspace_id, **names},
            )
            await session.commit()
            return int(result.rowcount or 0)
        finally:
            await session.close()
