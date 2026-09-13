"""Outbound port: keep a MongoDB login alive until the user logs out."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from src.application.ports.output.mongo_gateway_output_port import MongoConnectionProfile


@dataclass
class StoredMongoSession:
    token: str
    profile: MongoConnectionProfile
    label: str | None = None
    server_version: str | None = None
    server_flavor: str | None = None
    topology: str | None = None
    connected_at: str = ""
    last_used_at: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


class MongoSessionOutputPort(ABC):
    @abstractmethod
    async def create(self, session: StoredMongoSession) -> StoredMongoSession:
        ...

    @abstractmethod
    async def get(self, token: str) -> StoredMongoSession | None:
        ...

    @abstractmethod
    async def touch(self, token: str) -> StoredMongoSession | None:
        """Refresh `last_used_at`; returns the session or None when unknown."""

    @abstractmethod
    async def update(self, session: StoredMongoSession) -> StoredMongoSession:
        ...

    @abstractmethod
    async def delete(self, token: str) -> bool:
        ...
