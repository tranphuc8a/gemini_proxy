"""Outbound port: where the markdown editor's read-only share links are kept.

One store per backend (json / mysql / mongo), like the document tree itself. A link is
found by its token (the public read) or by the document id (one link per document).
`save` of a document that already has a link keeps that link's token and `shared_at`:
only the snapshot, title, expiry and `updated_at` change.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Dict, List, Optional

from src.domain.vo.markdown_share_vo import MarkdownShareRecord, MarkdownShareSummary


class MarkdownShareConflict(Exception):
    """`save` refused: the id's slot is held by ANOTHER document's link.

    Only a store whose id comparison ignores case (MySQL's default collation) gets here: ``Doc-A`` and ``doc-a`` are two
    documents for the editor but one key for the database. The use case turns it into 409 `markdown_share_conflict`;
    the message of the cause never reaches a client (it carries the statement and its parameters)."""


class MarkdownShareRepositoryPort(ABC):
    @abstractmethod
    async def get_by_doc(self, doc_id: str) -> Optional[MarkdownShareSummary]:
        """The link of this document (exact id), or None."""

    @abstractmethod
    async def save(self, record: MarkdownShareRecord) -> MarkdownShareSummary:
        """Create the link, or refresh the existing one of `record.doc_id` (token and shared_at kept).

        Raises `MarkdownShareConflict` when another document's link holds the slot (see there)."""

    @abstractmethod
    async def count(self) -> int: ...

    @abstractmethod
    async def list(self) -> List[MarkdownShareSummary]:
        """Every link, newest `shared_at` first (ties by doc id). Never reads the snapshots."""

    @abstractmethod
    async def get(self, token: str) -> Optional[MarkdownShareRecord]:
        """The link with this exact token, snapshot included, or None."""

    @abstractmethod
    async def delete_by_doc(self, doc_id: str) -> bool:
        """Revoke the link of this document; False if it had none."""

    @abstractmethod
    async def purge_expired(self, now: int) -> int:
        """Drop links whose `expires_at` is at or before `now`; how many went."""

    async def rename_docs(self, mapping: Dict[str, str]) -> int:
        """Point links at new document ids (`{old: new}`): the delta sync renames ids that the old
        store let through but the shared id pattern does not allow. A link whose new id already has
        one stays as it is. Returns how many links moved. Default: none (a store that never had to)."""
        return 0
