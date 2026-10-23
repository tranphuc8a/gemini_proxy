"""Inbound port for the markdown editor's read-only share links."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, Tuple

from src.domain.vo.markdown_share_vo import MarkdownShareIn


class MarkdownShareInputPort(ABC):
    @abstractmethod
    async def create_or_refresh(self, request: MarkdownShareIn) -> Tuple[bool, Dict[str, Any]]:
        """`(created, summary)`: a new link (True) or a refreshed snapshot of the existing one."""

    @abstractmethod
    async def list_shares(self) -> Dict[str, Any]:
        """`{"shares", "limits", "persistent"}`, newest first, without snapshots."""

    @abstractmethod
    async def revoke(self, doc_id: str) -> Dict[str, Any]:
        """`{"revoked": True}`; 404 when the document has no link."""

    @abstractmethod
    async def read_shared(self, token: str, ip: str = "") -> Dict[str, Any]:
        """The public read: `{"title", "content", "mode", "sharedAt", "updatedAt", "expiresAt"}`."""
