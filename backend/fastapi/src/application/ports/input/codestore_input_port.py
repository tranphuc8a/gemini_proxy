"""Inbound port for the Code Studio store use cases."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, Tuple

from src.domain.vo.codestore_vo import PutItemsRequest


class CodestoreInputPort(ABC):
    @abstractmethod
    async def create_workspace(self, ip: str) -> Dict[str, Any]:
        """`{"workspaceId", "key"}`; the key is returned this once."""

    @abstractmethod
    async def list_items(
        self, workspace_id: str, key: str, since: int, limit: Optional[int] = None, ip: str = ""
    ) -> Dict[str, Any]:
        """`{"items", "serverTime", "more"}`."""

    @abstractmethod
    async def put_items(
        self, workspace_id: str, key: str, request: PutItemsRequest, ip: str = ""
    ) -> Dict[str, Any]:
        """`{"items", "serverTime"}`: what the server now holds for the ids sent."""

    @abstractmethod
    async def delete_workspace(self, workspace_id: str, key: str, ip: str = "") -> bool: ...

    # ----------------------------------------------------------- read-only links
    @abstractmethod
    async def create_share(
        self, workspace_id: str, key: str, item_id: str, ip: str = ""
    ) -> Tuple[bool, Dict[str, Any]]:
        """`(created, {"token", "sharedAt", "updatedAt"})`: a frozen copy of the stored record.

        `created` is False when the record already had a link: its snapshot was
        refreshed and the token kept.
        """

    @abstractmethod
    async def list_shares(self, workspace_id: str, key: str, ip: str = "") -> Dict[str, Any]:
        """`{"shares": [{"token", "itemId", "name", "sharedAt", "updatedAt"}]}`."""

    @abstractmethod
    async def revoke_share(self, workspace_id: str, key: str, item_id: str, ip: str = "") -> Dict[str, Any]:
        """`{"revoked": True}`."""

    @abstractmethod
    async def read_shared(self, token: str, ip: str = "") -> Dict[str, Any]:
        """Public, no key: `{"item", "sharedAt"}` of the link with this token."""
