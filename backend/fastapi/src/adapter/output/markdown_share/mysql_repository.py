"""MySQL store of the markdown share links.

The table is created on first use with `CREATE TABLE IF NOT EXISTS` (Q2: no Alembic
migration), like `markdown_files` and `codestore_shares`: an opt-in feature must not
force a migration on a deployment that never uses it. On the real database that DDL
runs the first time ANY request reaches the store in a process - the owner's first share, but also a
guest's `GET /markdown/shared?backend=mysql` (the public read opens the store too); it is idempotent and
creates nothing but this table. Tests only ever run it
against the SQLite engine the suite falls back to, which is why every statement is
plain portable SQL with bound parameters.

A link is found by its token (primary key) or its document (unique key); neither scans.
Listing selects the summary columns only, never `content` (up to 2 MB a row). MySQL's
default collation ignores case, so a lookup re-checks the exact value it read back:
a token or a document id must match exactly.

`save` refreshes with `UPDATE ... WHERE doc_id` and inserts only when that matched no
row; two requests creating the same document's link at once make one `INSERT` hit the
unique key, which is rolled back and decided once more (it then updates). Two ids that
differ only in case are one key to a case-insensitive collation: that save is refused with
`MarkdownShareConflict` (409 `markdown_share_conflict` for the client), never a bare 500.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from src.adapter.output.mysql.db.base import get_async_session
from src.application.ports.output.markdown_share_repository_port import MarkdownShareConflict, MarkdownShareRepositoryPort
from src.domain.vo.markdown_share_vo import MarkdownShareRecord, MarkdownShareSummary

# `mode` is reserved for "live" links (content NULL) so the table never needs an ALTER.
CREATE_SHARES = """
CREATE TABLE IF NOT EXISTS markdown_shares (
    token VARCHAR(64) NOT NULL PRIMARY KEY,
    doc_id VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    mode VARCHAR(16) NOT NULL,
    shared_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    expires_at BIGINT NULL,
    bytes INTEGER NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    content LONGTEXT NULL,
    UNIQUE (doc_id)
)
"""

SUMMARY_COLUMNS = "token, doc_id, title, mode, shared_at, updated_at, expires_at, bytes, content_hash"
UPDATE_SHARE = text(
    "UPDATE markdown_shares SET title = :title, mode = :mode, updated_at = :updated_at, expires_at = :expires_at, "
    "bytes = :bytes, content_hash = :content_hash, content = :content WHERE doc_id = :doc_id"
)
INSERT_SHARE = text(
    "INSERT INTO markdown_shares (token, doc_id, title, mode, shared_at, updated_at, expires_at, bytes, content_hash, content) "
    "VALUES (:token, :doc_id, :title, :mode, :shared_at, :updated_at, :expires_at, :bytes, :content_hash, :content)"
)


def _summary(row: Any) -> MarkdownShareSummary:
    mapping = row._mapping
    expires = mapping["expires_at"]
    return MarkdownShareSummary(
        token=mapping["token"], doc_id=mapping["doc_id"], title=mapping["title"], mode=mapping["mode"],
        shared_at=int(mapping["shared_at"]), updated_at=int(mapping["updated_at"]),
        expires_at=int(expires) if expires is not None else None,
        bytes=int(mapping["bytes"]), content_hash=mapping["content_hash"],
    )


class MySqlMarkdownShareRepository(MarkdownShareRepositoryPort):
    def __init__(self) -> None:
        self._ready = False

    async def _session(self):
        session = get_async_session()
        if not self._ready:
            try:
                await session.execute(text(CREATE_SHARES))
                await session.commit()
            except Exception:
                # Not marked ready: the next request tries again.
                await session.close()
                raise
            self._ready = True
        return session

    async def _row_by_doc(self, session, doc_id: str) -> Optional[MarkdownShareSummary]:
        result = await session.execute(
            text(f"SELECT {SUMMARY_COLUMNS} FROM markdown_shares WHERE doc_id = :doc_id"), {"doc_id": doc_id}
        )
        row = result.fetchone()
        if row is None:
            return None
        summary = _summary(row)
        return summary if summary.doc_id == doc_id else None

    async def get_by_doc(self, doc_id: str) -> Optional[MarkdownShareSummary]:
        session = await self._session()
        try:
            return await self._row_by_doc(session, doc_id)
        finally:
            await session.close()

    async def save(self, record: MarkdownShareRecord) -> MarkdownShareSummary:
        refresh = {
            "doc_id": record.doc_id, "title": record.title[:255], "mode": record.mode, "updated_at": record.updated_at,
            "expires_at": record.expires_at, "bytes": record.bytes, "content_hash": record.content_hash,
            "content": record.content,
        }
        create = {**refresh, "token": record.token, "shared_at": record.shared_at}
        session = await self._session()
        try:
            for attempt in range(2):
                try:
                    updated = await session.execute(UPDATE_SHARE, refresh)
                    if not updated.rowcount:
                        await session.execute(INSERT_SHARE, create)
                    stored = await self._row_by_doc(session, record.doc_id)
                    if stored is None:
                        # Only a case-insensitive collation gets here: another document whose id differs
                        # only in case holds the unique key (the UPDATE above even touched ITS row). Roll
                        # back and refuse rather than overwrite that link - and do not retry: it would
                        # decide the same way.
                        await session.rollback()
                        raise MarkdownShareConflict(f"doc id {record.doc_id!r} is held by another document's link")
                    await session.commit()
                    return stored
                except IntegrityError:
                    await session.rollback()
                    if attempt == 1:
                        # Not the driver's message: it carries the statement and the whole snapshot.
                        raise MarkdownShareConflict(f"doc id {record.doc_id!r} hit the unique key") from None
            raise RuntimeError("unreachable")  # pragma: no cover
        finally:
            await session.close()

    async def count(self) -> int:
        session = await self._session()
        try:
            result = await session.execute(text("SELECT COUNT(*) FROM markdown_shares"))
            return int(result.scalar() or 0)
        finally:
            await session.close()

    async def list(self) -> List[MarkdownShareSummary]:
        session = await self._session()
        try:
            result = await session.execute(
                text(f"SELECT {SUMMARY_COLUMNS} FROM markdown_shares ORDER BY shared_at DESC, doc_id ASC")
            )
            return [_summary(row) for row in result.fetchall()]
        finally:
            await session.close()

    async def get(self, token: str) -> Optional[MarkdownShareRecord]:
        session = await self._session()
        try:
            result = await session.execute(
                text(f"SELECT {SUMMARY_COLUMNS}, content FROM markdown_shares WHERE token = :token"), {"token": token}
            )
            row = result.fetchone()
            if row is None:
                return None
            summary = _summary(row)
            if summary.token != token:
                return None                     # MySQL's default collation ignores case
            return MarkdownShareRecord(**summary.model_dump(), content=row._mapping["content"])
        finally:
            await session.close()

    async def delete_by_doc(self, doc_id: str) -> bool:
        session = await self._session()
        try:
            existing = await self._row_by_doc(session, doc_id)
            if existing is None:
                return False
            # By token: the doc id comparison of the database might not be exact.
            result = await session.execute(text("DELETE FROM markdown_shares WHERE token = :token"), {"token": existing.token})
            await session.commit()
            return bool(result.rowcount)
        finally:
            await session.close()

    async def purge_expired(self, now: int) -> int:
        session = await self._session()
        try:
            result = await session.execute(
                text("DELETE FROM markdown_shares WHERE expires_at IS NOT NULL AND expires_at <= :now"), {"now": int(now)}
            )
            await session.commit()
            return int(result.rowcount or 0)
        finally:
            await session.close()

    async def rename_docs(self, mapping: Dict[str, str]) -> int:
        session = await self._session()
        moved = 0
        try:
            for old, new in mapping.items():
                existing = await self._row_by_doc(session, old)
                if existing is None:
                    continue
                try:
                    # By token: the doc id comparison of the database might not be exact.
                    await session.execute(
                        text("UPDATE markdown_shares SET doc_id = :new WHERE token = :token"),
                        {"new": new, "token": existing.token},
                    )
                    await session.commit()
                    moved += 1
                except IntegrityError:
                    await session.rollback()          # the new id already has a link: leave this one
            return moved
        finally:
            await session.close()
