"""MySQL Personal Wiki store, for when several devices share one backend.

Two tables (workspaces, records) are created on demand with `CREATE TABLE IF NOT
EXISTS`, the same way the codestore, spending and postman stores do, rather than
through Alembic: this backend is opt-in and must not force a migration on
deployments that never enable it.

A record is one row. The values that are queried (`updated_at`, `server_updated_at`,
`deleted`) are columns, and the client's opaque `data` object is `payload`, a JSON
text in a `LONGTEXT` column (up to 4 GB; one note may be ~1.6 MB, so `TEXT`'s 64 KB
would not do). Every statement is plain portable SQL with bound parameters, because
the test suite runs the identical code against the SQLite engine it falls back to.
The sync query (`WHERE workspace_id = ? AND server_updated_at > ?`) has its own index,
created apart from the table because `CREATE INDEX IF NOT EXISTS` is not understood
by every MySQL (see `_ensure_tables`); without it a page of a large workspace would
scan the whole primary key.

Ids are case SENSITIVE. MySQL's default collation is not, so on MySQL the two id
columns are created with `utf8mb4_bin`: otherwise the notes `Ab` and `aB` would be one
row and the second would overwrite the first. (SQLite compares exactly already.)

`upsert_newer` applies last-writer-wins in the database. The `UPDATE` carries the
rule in its `WHERE`, so the comparison and the write are one atomic statement;
only when it matched nothing does the code look for the row, and insert it if it
is absent. Two requests inserting the same new id at once make one `INSERT` fail
on the primary key: the whole batch is then rolled back and run once more, which
is safe because applying the same records again changes nothing.

A row of 1.6 MB is one statement: the server's `max_allowed_packet` must be above
that (the default of every current MySQL/MariaDB is 16 MB or more; 4 MB on old 5.7).
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Sequence

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from src.adapter.output.mysql.db.base import get_async_session
from src.application.ports.output.wiki_repository_port import WikiRepositoryPort
from src.domain.vo.wiki_vo import Record, WorkspaceRecord

#: Appended to the id columns on MySQL only (SQLite would reject the collation's name).
MYSQL_EXACT_IDS = " CHARACTER SET utf8mb4 COLLATE utf8mb4_bin"


def create_workspaces_sql(dialect: str = "") -> str:
    exact = MYSQL_EXACT_IDS if dialect in ("mysql", "mariadb") else ""
    return f"""
CREATE TABLE IF NOT EXISTS wiki_workspaces (
    id VARCHAR(64){exact} PRIMARY KEY,
    key_hash VARCHAR(128) NOT NULL,
    created_at VARCHAR(40) NOT NULL
)
"""


def create_items_sql(dialect: str = "") -> str:
    exact = MYSQL_EXACT_IDS if dialect in ("mysql", "mariadb") else ""
    return f"""
CREATE TABLE IF NOT EXISTS wiki_items (
    workspace_id VARCHAR(64){exact} NOT NULL,
    id VARCHAR(80){exact} NOT NULL,
    kind VARCHAR(16) NOT NULL,
    updated_at BIGINT NOT NULL,
    server_updated_at BIGINT NOT NULL,
    deleted INTEGER NOT NULL,
    payload LONGTEXT NOT NULL,
    PRIMARY KEY (workspace_id, id)
)
"""


# `IF NOT EXISTS` first (SQLite, MariaDB, MySQL 8.0.29+); the plain form for older MySQL, where the
# second run fails with "duplicate key name", which is the answer "it is there".
CREATE_SYNC_INDEXES = (
    "CREATE INDEX IF NOT EXISTS ix_wiki_items_sync ON wiki_items (workspace_id, server_updated_at)",
    "CREATE INDEX ix_wiki_items_sync ON wiki_items (workspace_id, server_updated_at)",
)

COLUMNS = "id, kind, updated_at, server_updated_at, deleted, payload"
UPDATE_IF_NEWER = text(
    "UPDATE wiki_items SET kind = :kind, updated_at = :updated_at, server_updated_at = :server_updated_at, "
    "deleted = :deleted, payload = :payload "
    "WHERE workspace_id = :workspace_id AND id = :id "
    "AND (updated_at < :updated_at OR (updated_at = :updated_at AND deleted = 0 AND :deleted = 1))"
)
INSERT_ITEM = text(
    "INSERT INTO wiki_items (workspace_id, id, kind, updated_at, server_updated_at, deleted, payload) "
    "VALUES (:workspace_id, :id, :kind, :updated_at, :server_updated_at, :deleted, :payload)"
)


def _row(workspace_id: str, item: Record) -> Dict[str, Any]:
    return {
        "workspace_id": workspace_id,
        "id": item.id,
        "kind": item.kind,
        "updated_at": item.updatedAt,
        "server_updated_at": item.serverUpdatedAt,
        "deleted": 1 if item.deleted else 0,
        "payload": json.dumps(item.data, ensure_ascii=False),
    }


def _item(row: Any) -> Record:
    mapping = row._mapping if hasattr(row, "_mapping") else row
    return Record(
        id=mapping["id"], kind=mapping["kind"], updatedAt=int(mapping["updated_at"]),
        deleted=bool(mapping["deleted"]), data=json.loads(mapping["payload"] or "{}"),
        serverUpdatedAt=int(mapping["server_updated_at"]),
    )


def _dialect(session: Any) -> str:
    try:
        return str(session.get_bind().dialect.name)
    except Exception:  # noqa: BLE001 - an unknown dialect gets the portable DDL
        return ""


class MySqlWikiRepository(WikiRepositoryPort):
    def __init__(self) -> None:
        self._ready = False

    async def _ensure_tables(self, session: Any) -> None:
        dialect = _dialect(session)
        await session.execute(text(create_workspaces_sql(dialect)))
        await session.execute(text(create_items_sql(dialect)))
        await session.commit()
        for statement in CREATE_SYNC_INDEXES:
            try:
                await session.execute(text(statement))
                await session.commit()
                break
            except Exception:  # noqa: BLE001 - an optimisation, not a correctness condition
                await session.rollback()

    async def _session(self):
        session = get_async_session()
        if not self._ready:
            try:
                await self._ensure_tables(session)
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
                text("INSERT INTO wiki_workspaces (id, key_hash, created_at) VALUES (:id, :key_hash, :created_at)"),
                {"id": record.id, "key_hash": record.key_hash, "created_at": record.created_at},
            )
            await session.commit()
        finally:
            await session.close()

    async def get_workspace(self, workspace_id: str) -> Optional[WorkspaceRecord]:
        session = await self._session()
        try:
            result = await session.execute(
                text("SELECT id, key_hash, created_at FROM wiki_workspaces WHERE id = :id"), {"id": workspace_id}
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
            await session.execute(text("DELETE FROM wiki_items WHERE workspace_id = :id"), {"id": workspace_id})
            result = await session.execute(text("DELETE FROM wiki_workspaces WHERE id = :id"), {"id": workspace_id})
            await session.commit()
            return (result.rowcount or 0) > 0
        finally:
            await session.close()

    # -------------------------------------------------------------- records
    async def count_items(self, workspace_id: str) -> int:
        session = await self._session()
        try:
            result = await session.execute(
                text("SELECT COUNT(*) FROM wiki_items WHERE workspace_id = :id"), {"id": workspace_id}
            )
            return int(result.scalar() or 0)
        finally:
            await session.close()

    async def get_items(self, workspace_id: str, ids: Sequence[str]) -> Dict[str, Record]:
        if not ids:
            return {}
        session = await self._session()
        try:
            names = {f"i{index}": item_id for index, item_id in enumerate(ids)}
            marks = ", ".join(f":{name}" for name in names)
            result = await session.execute(
                text(f"SELECT {COLUMNS} FROM wiki_items WHERE workspace_id = :workspace_id AND id IN ({marks})"),
                {"workspace_id": workspace_id, **names},
            )
            items = [_item(row) for row in result.fetchall()]
            return {item.id: item for item in items}
        finally:
            await session.close()

    async def list_since(self, workspace_id: str, since: int, limit: int) -> List[Record]:
        session = await self._session()
        try:
            result = await session.execute(
                text(f"SELECT {COLUMNS} FROM wiki_items "
                     "WHERE workspace_id = :workspace_id AND server_updated_at > :since "
                     "ORDER BY server_updated_at ASC, id ASC LIMIT :limit"),
                {"workspace_id": workspace_id, "since": since, "limit": limit},
            )
            return [_item(row) for row in result.fetchall()]
        finally:
            await session.close()

    async def upsert_newer(self, workspace_id: str, items: Sequence[Record]) -> List[str]:
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
    async def _upsert_one(session, workspace_id: str, item: Record) -> bool:
        row = _row(workspace_id, item)
        updated = await session.execute(UPDATE_IF_NEWER, row)
        if updated.rowcount == 1:
            return True
        present = await session.execute(
            text("SELECT 1 FROM wiki_items WHERE workspace_id = :workspace_id AND id = :id"),
            {"workspace_id": workspace_id, "id": item.id},
        )
        if present.first() is not None:
            return False                       # it is there, and it wins
        await session.execute(INSERT_ITEM, row)
        return True

    async def delete_old_tombstones(self, workspace_id: str, before: int) -> int:
        session = await self._session()
        try:
            result = await session.execute(
                text("DELETE FROM wiki_items WHERE workspace_id = :id AND deleted = 1 "
                     "AND server_updated_at < :before"),
                {"id": workspace_id, "before": before},
            )
            await session.commit()
            return int(result.rowcount or 0)
        finally:
            await session.close()
