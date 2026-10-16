"""Outbound port: where Code Studio workspaces and their records live.

Three adapters implement it - a JSON file, a MySQL table and a MongoDB
collection - chosen with `?backend=`. The server never looks inside the code, so
the contract is small. The one method that matters is `upsert_newer`: it applies
the last-writer-wins rule (`domain.vo.codestore_vo.wins`) AT THE STORE, as one
atomic step per record. A read-compare-write in the use case would leave a window
in which two devices both pass the comparison and the older edit overwrites the
newer one.

The same store keeps the read-only share links (`ShareRecord`): a token that reads
a frozen copy of one record. Looking a token up must be an index lookup - it is the
one query an anonymous client can trigger - and deleting a workspace takes its links with it.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Sequence

from src.domain.vo.codestore_vo import CodeItem, ShareRecord, ShareSummary, WorkspaceRecord


class CodestoreRepositoryPort(ABC):
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
    async def get_items(self, workspace_id: str, ids: Sequence[str]) -> Dict[str, CodeItem]:
        """The records among `ids` that exist, by id."""

    @abstractmethod
    async def list_since(self, workspace_id: str, since: int, limit: int) -> List[CodeItem]:
        """Records with `serverUpdatedAt > since`, oldest first (ties by id), at most `limit`."""

    @abstractmethod
    async def upsert_newer(self, workspace_id: str, items: Sequence[CodeItem]) -> List[str]:
        """Store each record unless the stored one wins (see `wins`); the ids actually written.

        Each record's `serverUpdatedAt` is stored as given.
        """

    @abstractmethod
    async def purge_tombstones(self, workspace_id: str, before: int) -> int:
        """Delete tombstones whose `serverUpdatedAt < before`; how many went."""

    # ---------------------------------------------------------------- shares
    @abstractmethod
    async def get_share_for_item(self, workspace_id: str, item_id: str) -> Optional[ShareSummary]:
        """The active link of a record, if it has one."""

    @abstractmethod
    async def save_share(self, record: ShareRecord) -> ShareSummary:
        """Create the link of a record, or refresh the snapshot of the one it has.

        The link of a record is unique. When one exists its token and `shared_at`
        are KEPT (only name, snapshot and `updated_at` change), whatever `record`
        carries; the summary returned is what is stored.
        """

    @abstractmethod
    async def count_shares(self, workspace_id: str) -> int:
        """Active links of the workspace."""

    @abstractmethod
    async def list_shares(self, workspace_id: str) -> List[ShareSummary]:
        """The workspace's links, most recently first shared first (ties by item id)."""

    @abstractmethod
    async def get_share(self, token: str) -> Optional[ShareRecord]:
        """The link with exactly this token (by index), or None."""

    @abstractmethod
    async def delete_share(self, workspace_id: str, item_id: str) -> bool:
        """Revoke the link of a record; False if it had none."""

    @abstractmethod
    async def delete_shares(self, workspace_id: str, item_ids: Sequence[str]) -> int:
        """Revoke the links of several records; how many went."""
