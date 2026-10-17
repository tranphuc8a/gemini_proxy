"""Outbound port: where Personal Wiki workspaces and their records live.

Three adapters implement it - a JSON file, a MySQL table and a MongoDB
collection - chosen with `?backend=`. The server never looks inside a record's
`data`, so the contract is small. The one method that matters is `upsert_newer`: it
applies the last-writer-wins rule (`domain.vo.wiki_vo.wins`) AT THE STORE, as one
atomic step per record. A read-compare-write in the use case would leave a window
in which two devices both pass the comparison and the older edit overwrites the
newer one.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Sequence

from src.domain.vo.wiki_vo import Record, WorkspaceRecord


class WikiRepositoryPort(ABC):
    @abstractmethod
    async def create_workspace(self, record: WorkspaceRecord) -> None: ...

    @abstractmethod
    async def get_workspace(self, workspace_id: str) -> Optional[WorkspaceRecord]: ...

    @abstractmethod
    async def delete_workspace(self, workspace_id: str) -> bool:
        """Remove the workspace and every record in it; False if it did not exist."""

    @abstractmethod
    async def count_items(self, workspace_id: str) -> int:
        """Records held, tombstones included."""

    @abstractmethod
    async def get_items(self, workspace_id: str, ids: Sequence[str]) -> Dict[str, Record]:
        """The records among `ids` that exist, by id."""

    @abstractmethod
    async def list_since(self, workspace_id: str, since: int, limit: int) -> List[Record]:
        """Records with `serverUpdatedAt > since`, oldest first (ties by id), at most `limit`."""

    @abstractmethod
    async def upsert_newer(self, workspace_id: str, items: Sequence[Record]) -> List[str]:
        """Store each record unless the stored one wins (see `wins`); the ids actually written.

        Each record's `serverUpdatedAt` is stored as given.
        """

    @abstractmethod
    async def delete_old_tombstones(self, workspace_id: str, before: int) -> int:
        """Delete tombstones whose `serverUpdatedAt < before`; how many went."""
