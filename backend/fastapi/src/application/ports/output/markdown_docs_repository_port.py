"""Outbound ports of the markdown delta sync (md-sync B2).

`MarkdownDocsRepositoryPort` is the store of one backend (json / mysql / mongo): the node
records, their history rows and a few named values (`meta`). Every call names the `space`
(see `markdown_docs_vo.DEFAULT_SPACE`). All three adapters must behave identically; the
contract test in `tests/adapter/output/markdown_docs` runs the same cases over each.

The concurrency rule is compare-and-set on `rev`: `cas_write` replaces a record only if
its stored `rev` is still `expected_rev`, `insert` only if the id is absent. The use case
re-reads and decides again when either answers False.

`LegacyMarkdownReaderPort` reads the OLD store (the whole-tree `PUT /files` one) so that the
first sync can copy it into the new one. It never writes.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from contextlib import asynccontextmanager
from typing import AsyncIterator, Dict, List, Optional, Sequence

from src.domain.vo.markdown_docs_vo import DocRecord, Revision


class MarkdownDocsRepositoryPort(ABC):
    # ------------------------------------------------------------ documents
    @abstractmethod
    async def get(self, space: str, doc_id: str) -> Optional[DocRecord]:
        """The record with this exact id (tombstones included), content included."""

    @abstractmethod
    async def get_many(self, space: str, ids: Sequence[str]) -> Dict[str, DocRecord]:
        """The existing records among `ids`, keyed by id."""

    @abstractmethod
    async def list_since(self, space: str, since: int, limit: int, include_deleted: bool) -> List[DocRecord]:
        """Records with `serverUpdatedAt > since`, oldest first (ties by id), at most `limit`."""

    @abstractmethod
    async def list_live(self, space: str) -> List[DocRecord]:
        """Every record that is not a tombstone, in no particular order."""

    @abstractmethod
    async def insert(self, space: str, record: DocRecord) -> bool:
        """Store a NEW record; False when the id is already there (someone inserted it first)."""

    @abstractmethod
    async def cas_write(self, space: str, record: DocRecord, expected_rev: int) -> bool:
        """Replace the record of `record.id` iff its stored rev is `expected_rev`; False otherwise."""

    @abstractmethod
    async def count(self, space: str) -> int:
        """Records of the space, tombstones included."""

    @abstractmethod
    async def purge_tombstones(self, space: str, before: int) -> List[str]:
        """Delete the tombstones with `serverUpdatedAt < before` AND the history rows of those nodes; the ids that went.

        One call does both (a statement per kind, in one transaction where the store has them): purging a tree of
        thousands of nodes must not cost a round trip each to a remote database, and a purge cut short must not leave
        history rows whose node is gone - nothing would ever find them again."""

    async def insert_many(self, space: str, records: Sequence[DocRecord]) -> int:
        """Insert the records whose id is absent; how many were inserted. Adapters override it
        to do the lot in one round trip (the migration copies a whole tree)."""
        inserted = 0
        for record in records:
            if await self.insert(space, record):
                inserted += 1
        return inserted

    # -------------------------------------------------------------- history
    @abstractmethod
    async def add_revision(self, space: str, revision: Revision) -> None:
        """Store one history row (replacing a row with the same doc and rev)."""

    async def add_revisions(self, space: str, revisions: Sequence[Revision]) -> None:
        for revision in revisions:
            await self.add_revision(space, revision)

    @abstractmethod
    async def list_revisions(self, space: str, doc_id: str) -> List[Revision]:
        """Every history row of the document WITHOUT `body`, oldest first."""

    @abstractmethod
    async def get_revision(self, space: str, doc_id: str, rev: int) -> Optional[Revision]:
        """One history row, body included."""

    @abstractmethod
    async def latest_keyframe(self, space: str, doc_id: str) -> Optional[Revision]:
        """The newest row with `encoding == "full"`, body included."""

    @abstractmethod
    async def delete_revisions(self, space: str, doc_id: str, revs: Sequence[int]) -> None: ...

    @abstractmethod
    async def delete_all_revisions(self, space: str, doc_id: str) -> None: ...

    # ----------------------------------------------------------------- meta
    @abstractmethod
    async def get_meta(self, space: str, key: str) -> Optional[str]: ...

    @abstractmethod
    async def put_meta_if_absent(self, space: str, key: str, value: str) -> bool:
        """Create the value; False when the key already exists (the claim of a one-time job)."""

    @abstractmethod
    async def put_meta(self, space: str, key: str, value: str) -> None: ...

    # ---------------------------------------------------------------- batch
    @asynccontextmanager
    async def batch(self) -> AsyncIterator[None]:
        """A group of writes the adapter may persist once, at the end (the JSON file is rewritten
        whole, so one push of 200 nodes must not rewrite it 200 times). A no-op by default."""
        yield


class LegacyMarkdownReaderPort(ABC):
    @abstractmethod
    async def read_tree(self, backend: str) -> List[Dict]:
        """The old store of this backend, flattened to rows
        `{id, name, kind, content, parent_id}` (parents before children; read-only)."""
