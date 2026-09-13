"""Outbound port: talk to an arbitrary user-supplied MongoDB deployment.

Unlike SQL, MongoDB has no single "run this statement" entry point, so the port
exposes the handful of driver operations the use cases actually need. Anything
that maps cleanly onto a database command (stats, drop, create, server status)
goes through `run_command` instead of getting its own method.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class MongoConnectionProfile:
    """Everything needed to reach the target deployment.

    `uri` is authoritative — it is what the driver is handed. The remaining
    fields are the parsed view of it, kept for display and for the session list.
    """

    uri: str
    host: str = "localhost"
    port: int | None = 27017
    username: str | None = None
    database: str | None = None
    auth_source: str | None = None
    tls: bool = False
    srv: bool = False
    options: dict[str, Any] = field(default_factory=dict)

    def redacted(self) -> dict[str, Any]:
        return {
            "host": self.host,
            "port": self.port,
            "username": self.username,
            "database": self.database,
            "tls": self.tls,
            "srv": self.srv,
        }


@dataclass
class QueryOutcome:
    """Documents returned by a read, plus how long the driver took."""

    documents: list[dict[str, Any]] = field(default_factory=list)
    duration_ms: float = 0.0
    truncated: bool = False


@dataclass
class WriteOutcome:
    """Normalised result of an insert, update or delete."""

    acknowledged: bool = True
    matched: int = 0
    modified: int = 0
    inserted: int = 0
    deleted: int = 0
    upserted_id: Any = None
    inserted_ids: list[Any] = field(default_factory=list)
    duration_ms: float = 0.0


class MongoGatewayOutputPort(ABC):
    """Executes operations on behalf of a session, reusing one client per session."""

    @abstractmethod
    async def probe(self, profile: MongoConnectionProfile) -> dict[str, Any]:
        """Open a throwaway client to verify the credentials; return server facts."""

    @abstractmethod
    async def run_command(
        self,
        session_id: str,
        profile: MongoConnectionProfile,
        database: str,
        command: dict[str, Any],
    ) -> dict[str, Any]:
        """Run a database command (stats, drop, create, serverStatus, ...)."""

    @abstractmethod
    async def list_databases(self, session_id: str, profile: MongoConnectionProfile) -> list[dict[str, Any]]:
        ...

    @abstractmethod
    async def list_collections(
        self, session_id: str, profile: MongoConnectionProfile, database: str
    ) -> list[dict[str, Any]]:
        ...

    @abstractmethod
    async def find(
        self,
        session_id: str,
        profile: MongoConnectionProfile,
        database: str,
        collection: str,
        filter: dict[str, Any],
        projection: dict[str, Any] | None = None,
        sort: list[tuple[str, int]] | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> QueryOutcome:
        ...

    @abstractmethod
    async def count(
        self,
        session_id: str,
        profile: MongoConnectionProfile,
        database: str,
        collection: str,
        filter: dict[str, Any],
    ) -> int:
        ...

    @abstractmethod
    async def insert(
        self,
        session_id: str,
        profile: MongoConnectionProfile,
        database: str,
        collection: str,
        documents: list[dict[str, Any]],
    ) -> WriteOutcome:
        ...

    @abstractmethod
    async def update(
        self,
        session_id: str,
        profile: MongoConnectionProfile,
        database: str,
        collection: str,
        filter: dict[str, Any],
        update: dict[str, Any],
        many: bool = False,
        upsert: bool = False,
        replace: bool = False,
    ) -> WriteOutcome:
        ...

    @abstractmethod
    async def delete(
        self,
        session_id: str,
        profile: MongoConnectionProfile,
        database: str,
        collection: str,
        filter: dict[str, Any],
        many: bool = False,
    ) -> WriteOutcome:
        ...

    @abstractmethod
    async def aggregate(
        self,
        session_id: str,
        profile: MongoConnectionProfile,
        database: str,
        collection: str,
        pipeline: list[dict[str, Any]],
        max_rows: int = 200,
    ) -> QueryOutcome:
        ...

    @abstractmethod
    async def list_indexes(
        self, session_id: str, profile: MongoConnectionProfile, database: str, collection: str
    ) -> list[dict[str, Any]]:
        ...

    @abstractmethod
    async def create_index(
        self,
        session_id: str,
        profile: MongoConnectionProfile,
        database: str,
        collection: str,
        keys: list[tuple[str, Any]],
        options: dict[str, Any],
    ) -> str:
        ...

    @abstractmethod
    async def drop_index(
        self, session_id: str, profile: MongoConnectionProfile, database: str, collection: str, name: str
    ) -> None:
        ...

    @abstractmethod
    async def release(self, session_id: str) -> None:
        """Close the client held for `session_id`."""

    @abstractmethod
    async def release_all(self) -> None:
        """Close every client (application shutdown)."""
