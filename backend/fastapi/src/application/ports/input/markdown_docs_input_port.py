"""Inbound port of the markdown delta sync (md-sync B2).

Also what md-share's future "live" mode reads: `get_document(doc_id)` is the document by id
(`hash` / `contentRev` make its ETag), the single door both features use (ke-hoach §1.2).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from src.domain.vo.markdown_docs_vo import PushRequest


class MarkdownDocsInputPort(ABC):
    @abstractmethod
    async def push(self, request: PushRequest) -> Dict[str, Any]:
        """Apply the ops independently. `{"results": [...], "serverTime"}`; each result is
        `ok` / `conflict` / `rejected` (see the design, md-sync §3.3)."""

    @abstractmethod
    async def changes(self, since: int, limit: Optional[int], device: str) -> Dict[str, Any]:
        """`{"items", "cursor", "more", "horizon", "reset"}`: records newer than `since`, one page."""

    @abstractmethod
    async def get_document(self, doc_id: str) -> Dict[str, Any]:
        """The latest live record of this id with its content; 404 `md_doc_not_found` otherwise."""

    @abstractmethod
    async def list_revisions(self, doc_id: str, before: Optional[int], limit: Optional[int]) -> Dict[str, Any]:
        """`{"items": [...newest first, no body], "more"}` of one document's history."""

    @abstractmethod
    async def get_revision(self, doc_id: str, rev: int) -> Dict[str, Any]:
        """One history row rebuilt to its full text: `{rev, content, name, ...}`."""

    @abstractmethod
    async def is_migrated(self) -> bool:
        """Has the old whole-tree store been copied into this one?"""

    @abstractmethod
    async def legacy_rows(self) -> Optional[List[Dict[str, Any]]]:
        """The live nodes as rows for the old tree endpoint, or None while not migrated."""
