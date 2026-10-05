"""Inbound port for the spending workspace use cases."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from src.domain.vo.spending_vo import (
    SpendingCreated,
    SpendingCreateRequest,
    SpendingSaveRequest,
    SpendingView,
)


class SpendingInputPort(ABC):
    @abstractmethod
    async def create_workspace(self, request: SpendingCreateRequest) -> SpendingCreated: ...

    @abstractmethod
    async def get_workspace(
        self, workspace_id: str, access_key: str, since: Optional[int] = None
    ) -> SpendingView: ...

    @abstractmethod
    async def save_workspace(
        self, workspace_id: str, access_key: str, request: SpendingSaveRequest
    ) -> SpendingView: ...

    @abstractmethod
    async def delete_workspace(self, workspace_id: str, access_key: str) -> bool: ...
