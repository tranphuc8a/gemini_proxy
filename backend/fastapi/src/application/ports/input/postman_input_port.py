"""Inbound port for the postman-lite-pro workspace use cases."""

from __future__ import annotations

from abc import ABC, abstractmethod

from src.domain.vo.postman_vo import (
    HistoryEntry,
    HistoryPage,
    ShareResult,
    SharedWorkspaceView,
    WorkspaceCreated,
    WorkspaceCreateRequest,
    WorkspaceSaveRequest,
    WorkspaceView,
)


class PostmanInputPort(ABC):
    # --- workspace -------------------------------------------------------
    @abstractmethod
    async def create_workspace(self, request: WorkspaceCreateRequest) -> WorkspaceCreated: ...

    @abstractmethod
    async def get_workspace(self, workspace_id: str, access_key: str) -> WorkspaceView: ...

    @abstractmethod
    async def save_workspace(
        self, workspace_id: str, access_key: str, request: WorkspaceSaveRequest
    ) -> WorkspaceView: ...

    @abstractmethod
    async def delete_workspace(self, workspace_id: str, access_key: str) -> bool: ...

    # --- sharing ---------------------------------------------------------
    @abstractmethod
    async def set_share(self, workspace_id: str, access_key: str, enabled: bool) -> ShareResult: ...

    @abstractmethod
    async def get_shared(self, share_token: str) -> SharedWorkspaceView: ...

    # --- history ---------------------------------------------------------
    @abstractmethod
    async def list_history(
        self, workspace_id: str, access_key: str, limit: int, offset: int
    ) -> HistoryPage: ...

    @abstractmethod
    async def add_history(
        self, workspace_id: str, access_key: str, entry: HistoryEntry
    ) -> HistoryEntry: ...

    @abstractmethod
    async def clear_history(self, workspace_id: str, access_key: str) -> int: ...
