"""Outbound port: where postman-lite-pro workspaces and their history live.

Two adapters implement this - a JSON file and a MySQL table - selected by
`POSTMAN_STORAGE_BACKEND`. Keeping the contract this small is what lets the JSON
adapter be the default: a developer with no database still gets working sync.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import List, Optional

from src.domain.vo.postman_vo import HistoryEntry, WorkspaceRecord


class PostmanRepositoryPort(ABC):
    @abstractmethod
    async def create(self, record: WorkspaceRecord) -> WorkspaceRecord:
        ...

    @abstractmethod
    async def get(self, workspace_id: str) -> Optional[WorkspaceRecord]:
        ...

    @abstractmethod
    async def save(self, record: WorkspaceRecord) -> WorkspaceRecord:
        """Overwrite the stored document. The usecase has already checked the
        revision, so an adapter only persists what it is given."""

    @abstractmethod
    async def delete(self, workspace_id: str) -> bool:
        ...

    @abstractmethod
    async def find_by_share_token(self, token: str) -> Optional[WorkspaceRecord]:
        ...

    # --- history ---------------------------------------------------------
    @abstractmethod
    async def list_history(self, workspace_id: str, limit: int, offset: int = 0) -> tuple[List[HistoryEntry], int]:
        """Newest first. Returns (page, total)."""

    @abstractmethod
    async def append_history(self, workspace_id: str, entry: HistoryEntry, max_items: int) -> HistoryEntry:
        ...

    @abstractmethod
    async def clear_history(self, workspace_id: str) -> int:
        """Returns how many entries were removed."""
