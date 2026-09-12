"""Outbound port: run SQL against an arbitrary user-supplied MySQL/MariaDB server."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Sequence


@dataclass(frozen=True)
class ConnectionProfile:
    """Everything needed to open a connection to the target server."""

    host: str
    port: int
    username: str
    password: str
    database: str | None = None
    charset: str = "utf8mb4"

    def redacted(self) -> dict[str, Any]:
        return {
            "host": self.host,
            "port": self.port,
            "username": self.username,
            "database": self.database,
        }


@dataclass
class RawResult:
    """Driver-level outcome of one statement, before it becomes a QueryResult VO."""

    columns: list[str]
    column_types: list[str]
    rows: list[list[Any]]
    affected_rows: int
    last_insert_id: int | None
    duration_ms: float


class SqlGatewayOutputPort(ABC):
    """Executes statements on behalf of a session, reusing a pool per session."""

    @abstractmethod
    async def probe(self, profile: ConnectionProfile) -> dict[str, Any]:
        """Open a throwaway connection to verify credentials; return server facts."""

    @abstractmethod
    async def execute(
        self,
        session_id: str,
        profile: ConnectionProfile,
        statement: str,
        params: Sequence[Any] | None = None,
        database: str | None = None,
        max_rows: int | None = None,
    ) -> RawResult:
        """Run a single statement and return its rows/metadata."""

    @abstractmethod
    async def release(self, session_id: str) -> None:
        """Drop any pooled connections held for `session_id`."""

    @abstractmethod
    async def release_all(self) -> None:
        """Drop every pooled connection (application shutdown)."""
