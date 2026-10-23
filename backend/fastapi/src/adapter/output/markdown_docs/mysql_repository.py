"""MySQL store of the markdown delta sync (md-sync B4).

Three tables, created on first use with `CREATE TABLE IF NOT EXISTS` (Q2: no Alembic
migration), like `/wiki`, `codestore_shares` and `markdown_shares`: an opt-in feature must not
force a migration on a deployment that never uses it. On the real database that DDL runs the
first time the OWNER's editor calls `/markdown/sync/*` after deploying; tests only ever run it
against the SQLite engine the suite falls back to, which is why every statement is plain
portable SQL with bound parameters.

* `markdown_docs`          one row per node, primary key `(space, id)`; the pull query
                           (`space = ? AND server_updated_at > ?`) has its own index.
* `markdown_doc_revisions` one row per history entry, primary key `(space, doc_id, rev)`.
* `markdown_meta`          named values (the migration claim, the tombstone horizon).

Ids are case SENSITIVE: the default MySQL collation is not, so on MySQL the id columns are
created `utf8mb4_bin` (otherwise the nodes `Ab` and `aB` would be one row). SQLite compares
exactly already.

Concurrency is compare-and-set: `cas_write` is `UPDATE ... WHERE rev = :expected` (one atomic
statement; it always changes `rev`, so "rows changed" equals "rows matched"), and `insert`
answers False on a duplicate key. The legacy tables are never touched here.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from src.adapter.output.mysql.db.base import get_async_session
from src.application.ports.output.markdown_docs_repository_port import MarkdownDocsRepositoryPort
from src.domain.vo.markdown_docs_vo import DocRecord, Revision

MYSQL_EXACT_IDS = " CHARACTER SET utf8mb4 COLLATE utf8mb4_bin"
CHUNK = 200


def create_tables_sql(dialect: str = "") -> List[str]:
    exact = MYSQL_EXACT_IDS if dialect in ("mysql", "mariadb") else ""
    return [
        f"""
CREATE TABLE IF NOT EXISTS markdown_docs (
    space VARCHAR(32){exact} NOT NULL,
    id VARCHAR(80){exact} NOT NULL,
    kind VARCHAR(8) NOT NULL,
    parent_id VARCHAR(80){exact} NULL,
    name VARCHAR(255) NOT NULL,
    content LONGTEXT NULL,
    hash VARCHAR(64) NOT NULL,
    size INTEGER NOT NULL,
    rev INTEGER NOT NULL,
    content_rev INTEGER NOT NULL,
    meta_rev INTEGER NOT NULL,
    deleted INTEGER NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    server_updated_at BIGINT NOT NULL,
    device VARCHAR(64) NOT NULL,
    PRIMARY KEY (space, id)
)
""",
        f"""
CREATE TABLE IF NOT EXISTS markdown_doc_revisions (
    space VARCHAR(32){exact} NOT NULL,
    doc_id VARCHAR(80){exact} NOT NULL,
    rev INTEGER NOT NULL,
    kind VARCHAR(8) NOT NULL,
    name VARCHAR(255) NOT NULL,
    parent_id VARCHAR(80){exact} NULL,
    deleted INTEGER NOT NULL,
    hash VARCHAR(64) NOT NULL,
    size INTEGER NOT NULL,
    encoding VARCHAR(8) NOT NULL,
    compressed INTEGER NOT NULL,
    base_rev INTEGER NULL,
    body LONGTEXT NOT NULL,
    origin VARCHAR(16) NOT NULL,
    restored_from INTEGER NULL,
    label VARCHAR(200) NULL,
    device VARCHAR(64) NOT NULL,
    saved_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (space, doc_id, rev)
)
""",
        f"""
CREATE TABLE IF NOT EXISTS markdown_meta (
    space VARCHAR(32){exact} NOT NULL,
    k VARCHAR(64){exact} NOT NULL,
    v LONGTEXT NOT NULL,
    PRIMARY KEY (space, k)
)
""",
    ]


# `IF NOT EXISTS` first (SQLite and MariaDB have it; MySQL does not). On MySQL that statement is a syntax error,
# so the plain form creates the index, and on later runs fails with "duplicate key name" - the answer "it is
# there" (both failures are swallowed: the index is an optimisation, not a correctness condition).
CREATE_SYNC_INDEXES = (
    "CREATE INDEX IF NOT EXISTS ix_markdown_docs_sync ON markdown_docs (space, server_updated_at)",
    "CREATE INDEX ix_markdown_docs_sync ON markdown_docs (space, server_updated_at)",
)

DOC_COLUMNS = (
    "id, kind, parent_id, name, content, hash, size, rev, content_rev, meta_rev, deleted, "
    "created_at, updated_at, server_updated_at, device"
)
REV_META_COLUMNS = (
    "doc_id, rev, kind, name, parent_id, deleted, hash, size, encoding, compressed, base_rev, "
    "origin, restored_from, label, device, saved_at, updated_at"
)
INSERT_DOC = text(
    "INSERT INTO markdown_docs (space, id, kind, parent_id, name, content, hash, size, rev, content_rev, meta_rev, "
    "deleted, created_at, updated_at, server_updated_at, device) VALUES (:space, :id, :kind, :parent_id, :name, "
    ":content, :hash, :size, :rev, :content_rev, :meta_rev, :deleted, :created_at, :updated_at, :server_updated_at, :device)"
)
UPDATE_DOC = text(
    "UPDATE markdown_docs SET kind = :kind, parent_id = :parent_id, name = :name, content = :content, hash = :hash, "
    "size = :size, rev = :rev, content_rev = :content_rev, meta_rev = :meta_rev, deleted = :deleted, "
    "created_at = :created_at, updated_at = :updated_at, server_updated_at = :server_updated_at, device = :device "
    "WHERE space = :space AND id = :id AND rev = :expected"
)
INSERT_REV = text(
    "INSERT INTO markdown_doc_revisions (space, doc_id, rev, kind, name, parent_id, deleted, hash, size, encoding, "
    "compressed, base_rev, body, origin, restored_from, label, device, saved_at, updated_at) VALUES (:space, :doc_id, "
    ":rev, :kind, :name, :parent_id, :deleted, :hash, :size, :encoding, :compressed, :base_rev, :body, :origin, "
    ":restored_from, :label, :device, :saved_at, :updated_at)"
)


def _doc_params(space: str, record: DocRecord) -> Dict[str, Any]:
    return {
        "space": space, "id": record.id, "kind": record.kind, "parent_id": record.parentId, "name": record.name[:255],
        "content": record.content, "hash": record.hash, "size": record.size, "rev": record.rev,
        "content_rev": record.contentRev, "meta_rev": record.metaRev, "deleted": 1 if record.deleted else 0,
        "created_at": record.createdAt, "updated_at": record.updatedAt, "server_updated_at": record.serverUpdatedAt,
        "device": record.device,
    }


def _doc(row: Any) -> DocRecord:
    m = row._mapping
    return DocRecord(
        id=m["id"], kind=m["kind"], parentId=m["parent_id"], name=m["name"], content=m["content"], hash=m["hash"],
        size=int(m["size"]), rev=int(m["rev"]), contentRev=int(m["content_rev"]), metaRev=int(m["meta_rev"]),
        deleted=bool(m["deleted"]), createdAt=int(m["created_at"]), updatedAt=int(m["updated_at"]),
        serverUpdatedAt=int(m["server_updated_at"]), device=m["device"],
    )


def _rev_params(space: str, row: Revision) -> Dict[str, Any]:
    return {
        "space": space, "doc_id": row.docId, "rev": row.rev, "kind": row.kind, "name": row.name[:255],
        "parent_id": row.parentId, "deleted": 1 if row.deleted else 0, "hash": row.hash, "size": row.size,
        "encoding": row.encoding, "compressed": 1 if row.compressed else 0, "base_rev": row.baseRev, "body": row.body,
        "origin": row.origin, "restored_from": row.restoredFrom, "label": row.label, "device": row.device,
        "saved_at": row.savedAt, "updated_at": row.updatedAt,
    }


def _revision(row: Any) -> Revision:
    m = row._mapping
    body = m["body"] if "body" in m.keys() else ""
    return Revision(
        docId=m["doc_id"], rev=int(m["rev"]), kind=m["kind"], name=m["name"], parentId=m["parent_id"],
        deleted=bool(m["deleted"]), hash=m["hash"], size=int(m["size"]), encoding=m["encoding"],
        compressed=bool(m["compressed"]), baseRev=None if m["base_rev"] is None else int(m["base_rev"]), body=body,
        origin=m["origin"], restoredFrom=None if m["restored_from"] is None else int(m["restored_from"]),
        label=m["label"], device=m["device"], savedAt=int(m["saved_at"]), updatedAt=int(m["updated_at"]),
    )


def _dialect(session: Any) -> str:
    try:
        return str(session.get_bind().dialect.name)
    except Exception:  # noqa: BLE001 - an unknown dialect gets the portable DDL
        return ""


def _marks(prefix: str, values: Sequence[Any]) -> tuple[str, Dict[str, Any]]:
    names = {f"{prefix}{index}": value for index, value in enumerate(values)}
    return ", ".join(f":{name}" for name in names), names


class MySqlMarkdownDocsRepository(MarkdownDocsRepositoryPort):
    def __init__(self) -> None:
        self._ready = False

    async def _ensure_tables(self, session: Any) -> None:
        for statement in create_tables_sql(_dialect(session)):
            await session.execute(text(statement))
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
                await session.close()          # not marked ready: the next request tries again
                raise
            self._ready = True
        return session

    # ----------------------------------------------------------- documents
    async def get(self, space: str, doc_id: str) -> Optional[DocRecord]:
        session = await self._session()
        try:
            result = await session.execute(
                text(f"SELECT {DOC_COLUMNS} FROM markdown_docs WHERE space = :space AND id = :id"),
                {"space": space, "id": doc_id},
            )
            row = result.fetchone()
            if row is None:
                return None
            record = _doc(row)
            return record if record.id == doc_id else None          # exact id, whatever the collation
        finally:
            await session.close()

    async def get_many(self, space: str, ids: Sequence[str]) -> Dict[str, DocRecord]:
        wanted = set(ids)
        found: Dict[str, DocRecord] = {}
        if not wanted:
            return found
        session = await self._session()
        try:
            listed = list(wanted)
            for start in range(0, len(listed), CHUNK):
                marks, names = _marks("i", listed[start:start + CHUNK])
                result = await session.execute(
                    text(f"SELECT {DOC_COLUMNS} FROM markdown_docs WHERE space = :space AND id IN ({marks})"),
                    {"space": space, **names},
                )
                for row in result.fetchall():
                    record = _doc(row)
                    if record.id in wanted:
                        found[record.id] = record
            return found
        finally:
            await session.close()

    async def list_since(self, space: str, since: int, limit: int, include_deleted: bool) -> List[DocRecord]:
        session = await self._session()
        try:
            live = "" if include_deleted else " AND deleted = 0"
            result = await session.execute(
                text(f"SELECT {DOC_COLUMNS} FROM markdown_docs WHERE space = :space AND server_updated_at > :since{live} "
                     "ORDER BY server_updated_at ASC, id ASC LIMIT :limit"),
                {"space": space, "since": int(since), "limit": max(0, int(limit))},
            )
            return [_doc(row) for row in result.fetchall()]
        finally:
            await session.close()

    async def list_live(self, space: str) -> List[DocRecord]:
        session = await self._session()
        try:
            result = await session.execute(
                text(f"SELECT {DOC_COLUMNS} FROM markdown_docs WHERE space = :space AND deleted = 0"), {"space": space}
            )
            return [_doc(row) for row in result.fetchall()]
        finally:
            await session.close()

    async def _exists(self, session: Any, space: str, doc_id: str) -> bool:
        result = await session.execute(
            text("SELECT 1 FROM markdown_docs WHERE space = :space AND id = :id"), {"space": space, "id": doc_id}
        )
        return result.first() is not None

    async def insert(self, space: str, record: DocRecord) -> bool:
        session = await self._session()
        try:
            try:
                await session.execute(INSERT_DOC, _doc_params(space, record))
                await session.commit()
                return True
            except IntegrityError:
                await session.rollback()
                if await self._exists(session, space, record.id):
                    return False                     # someone inserted the id first
                raise
        finally:
            await session.close()

    async def insert_many(self, space: str, records: Sequence[DocRecord]) -> int:
        if not records:
            return 0
        session = await self._session()
        try:
            present: set = set()
            ids = [record.id for record in records]
            for start in range(0, len(ids), CHUNK):
                marks, names = _marks("i", ids[start:start + CHUNK])
                result = await session.execute(
                    text(f"SELECT id FROM markdown_docs WHERE space = :space AND id IN ({marks})"), {"space": space, **names}
                )
                present.update(row[0] for row in result.fetchall())
            fresh = [record for record in records if record.id not in present]
            try:
                for record in fresh:
                    await session.execute(INSERT_DOC, _doc_params(space, record))
                await session.commit()
                return len(fresh)
            except IntegrityError:
                await session.rollback()              # a concurrent insert: decide one by one
        finally:
            await session.close()
        return await super().insert_many(space, records)

    async def cas_write(self, space: str, record: DocRecord, expected_rev: int) -> bool:
        session = await self._session()
        try:
            result = await session.execute(UPDATE_DOC, {**_doc_params(space, record), "expected": int(expected_rev)})
            await session.commit()
            return (result.rowcount or 0) == 1
        finally:
            await session.close()

    async def count(self, space: str) -> int:
        session = await self._session()
        try:
            result = await session.execute(text("SELECT COUNT(*) FROM markdown_docs WHERE space = :space"), {"space": space})
            return int(result.scalar() or 0)
        finally:
            await session.close()

    async def purge_tombstones(self, space: str, before: int) -> List[str]:
        session = await self._session()
        try:
            params = {"space": space, "before": int(before)}
            result = await session.execute(
                text("SELECT id FROM markdown_docs WHERE space = :space AND deleted = 1 AND server_updated_at < :before"), params
            )
            ids = sorted(row[0] for row in result.fetchall())
            if ids:
                # History first (it is found through the tombstones), the nodes second, one commit: a cut-short purge
                # leaves everything or nothing, never rows of a node that is gone.
                await session.execute(
                    text(
                        "DELETE FROM markdown_doc_revisions WHERE space = :space AND doc_id IN "
                        "(SELECT id FROM markdown_docs WHERE space = :space AND deleted = 1 AND server_updated_at < :before)"
                    ),
                    params,
                )
                await session.execute(
                    text("DELETE FROM markdown_docs WHERE space = :space AND deleted = 1 AND server_updated_at < :before"), params
                )
                await session.commit()
            return ids
        finally:
            await session.close()

    # ------------------------------------------------------------- history
    async def add_revision(self, space: str, revision: Revision) -> None:
        await self.add_revisions(space, [revision])

    async def add_revisions(self, space: str, revisions: Sequence[Revision]) -> None:
        if not revisions:
            return
        session = await self._session()
        try:
            for row in revisions:
                await session.execute(
                    text("DELETE FROM markdown_doc_revisions WHERE space = :space AND doc_id = :doc_id AND rev = :rev"),
                    {"space": space, "doc_id": row.docId, "rev": row.rev},
                )
                await session.execute(INSERT_REV, _rev_params(space, row))
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

    async def list_revisions(self, space: str, doc_id: str) -> List[Revision]:
        session = await self._session()
        try:
            result = await session.execute(
                text(f"SELECT {REV_META_COLUMNS} FROM markdown_doc_revisions WHERE space = :space AND doc_id = :doc_id "
                     "ORDER BY rev ASC"),
                {"space": space, "doc_id": doc_id},
            )
            return [row for row in (_revision(r) for r in result.fetchall()) if row.docId == doc_id]
        finally:
            await session.close()

    async def get_revision(self, space: str, doc_id: str, rev: int) -> Optional[Revision]:
        session = await self._session()
        try:
            result = await session.execute(
                text(f"SELECT {REV_META_COLUMNS}, body FROM markdown_doc_revisions "
                     "WHERE space = :space AND doc_id = :doc_id AND rev = :rev"),
                {"space": space, "doc_id": doc_id, "rev": int(rev)},
            )
            row = result.fetchone()
            revision = _revision(row) if row is not None else None
            return revision if revision is not None and revision.docId == doc_id else None
        finally:
            await session.close()

    async def latest_keyframe(self, space: str, doc_id: str) -> Optional[Revision]:
        session = await self._session()
        try:
            result = await session.execute(
                text(f"SELECT {REV_META_COLUMNS}, body FROM markdown_doc_revisions "
                     "WHERE space = :space AND doc_id = :doc_id AND encoding = 'full' ORDER BY rev DESC LIMIT 1"),
                {"space": space, "doc_id": doc_id},
            )
            row = result.fetchone()
            revision = _revision(row) if row is not None else None
            return revision if revision is not None and revision.docId == doc_id else None
        finally:
            await session.close()

    async def delete_revisions(self, space: str, doc_id: str, revs: Sequence[int]) -> None:
        if not revs:
            return
        session = await self._session()
        try:
            listed = [int(rev) for rev in revs]
            for start in range(0, len(listed), CHUNK):
                marks, names = _marks("r", listed[start:start + CHUNK])
                await session.execute(
                    text(f"DELETE FROM markdown_doc_revisions WHERE space = :space AND doc_id = :doc_id AND rev IN ({marks})"),
                    {"space": space, "doc_id": doc_id, **names},
                )
            await session.commit()
        finally:
            await session.close()

    async def delete_all_revisions(self, space: str, doc_id: str) -> None:
        session = await self._session()
        try:
            await session.execute(
                text("DELETE FROM markdown_doc_revisions WHERE space = :space AND doc_id = :doc_id"),
                {"space": space, "doc_id": doc_id},
            )
            await session.commit()
        finally:
            await session.close()

    # ---------------------------------------------------------------- meta
    async def get_meta(self, space: str, key: str) -> Optional[str]:
        session = await self._session()
        try:
            result = await session.execute(
                text("SELECT k, v FROM markdown_meta WHERE space = :space AND k = :k"), {"space": space, "k": key}
            )
            row = result.fetchone()
            return row[1] if row is not None and row[0] == key else None
        finally:
            await session.close()

    async def put_meta_if_absent(self, space: str, key: str, value: str) -> bool:
        session = await self._session()
        try:
            try:
                await session.execute(
                    text("INSERT INTO markdown_meta (space, k, v) VALUES (:space, :k, :v)"),
                    {"space": space, "k": key, "v": value},
                )
                await session.commit()
                return True
            except IntegrityError:
                await session.rollback()
                return False
        finally:
            await session.close()

    async def put_meta(self, space: str, key: str, value: str) -> None:
        session = await self._session()
        try:
            params = {"space": space, "k": key, "v": value}
            updated = await session.execute(text("UPDATE markdown_meta SET v = :v WHERE space = :space AND k = :k"), params)
            if not updated.rowcount:
                present = await session.execute(
                    text("SELECT 1 FROM markdown_meta WHERE space = :space AND k = :k"), {"space": space, "k": key}
                )
                if present.first() is None:
                    await session.execute(text("INSERT INTO markdown_meta (space, k, v) VALUES (:space, :k, :v)"), params)
            await session.commit()
        finally:
            await session.close()
