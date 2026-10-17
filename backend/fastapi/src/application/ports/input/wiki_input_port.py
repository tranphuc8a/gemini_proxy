"""Inbound port for the Personal Wiki store use cases."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional

from src.domain.vo.wiki_vo import PutItemsRequest


class WikiInputPort(ABC):
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
