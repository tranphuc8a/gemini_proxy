"""Outbound port: persist connection sessions until the user logs out."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from src.application.ports.output.sql_gateway_output_port import ConnectionProfile


@dataclass
class StoredSession:
    token: str
    profile: ConnectionProfile
    label: str | None = None
    server_version: str | None = None
    server_flavor: str | None = None
    connected_at: str = ""
    last_used_at: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


class SqlSessionOutputPort(ABC):
    @abstractmethod
    async def create(self, session: StoredSession) -> StoredSession:
        ...

    @abstractmethod
    async def get(self, token: str) -> StoredSession | None:
        ...

    @abstractmethod
    async def touch(self, token: str) -> StoredSession | None:
        """Refresh `last_used_at`; returns the session or None when unknown."""

    @abstractmethod
    async def update(self, session: StoredSession) -> StoredSession:
        ...

    @abstractmethod
    async def delete(self, token: str) -> bool:
        ...
