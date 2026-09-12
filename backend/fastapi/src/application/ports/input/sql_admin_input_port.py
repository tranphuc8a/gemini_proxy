"""Inbound port for the SQL administrator use cases."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from src.domain.vo.sqladmin_vo import (
    BrowsePage,
    ConnectRequest,
    CreateDatabaseRequest,
    DatabaseInfo,
    MutationResult,
    ProcessInfo,
    QueryRequest,
    QueryResult,
    RowDeleteRequest,
    RowMutation,
    ServerOverview,
    SessionInfo,
    TableInfo,
    TableStructure,
)


class SqlAdminInputPort(ABC):
    # --- session ---------------------------------------------------------
    @abstractmethod
    async def connect(self, request: ConnectRequest) -> SessionInfo: ...

    @abstractmethod
    async def current_session(self, token: str) -> SessionInfo: ...

    @abstractmethod
    async def disconnect(self, token: str) -> bool: ...

    # --- schema ----------------------------------------------------------
    @abstractmethod
    async def list_databases(self, token: str) -> list[DatabaseInfo]: ...

    @abstractmethod
    async def create_database(self, token: str, request: CreateDatabaseRequest) -> MutationResult: ...

    @abstractmethod
    async def drop_database(self, token: str, database: str) -> MutationResult: ...

    @abstractmethod
    async def list_tables(self, token: str, database: str) -> list[TableInfo]: ...

    @abstractmethod
    async def table_structure(self, token: str, database: str, table: str) -> TableStructure: ...

    @abstractmethod
    async def drop_table(self, token: str, database: str, table: str) -> MutationResult: ...

    @abstractmethod
    async def truncate_table(self, token: str, database: str, table: str) -> MutationResult: ...

    # --- data ------------------------------------------------------------
    @abstractmethod
    async def browse_table(
        self,
        token: str,
        database: str,
        table: str,
        limit: int = 50,
        offset: int = 0,
        order_by: str | None = None,
        direction: str | None = None,
        search: str | None = None,
    ) -> BrowsePage: ...

    @abstractmethod
    async def insert_row(self, token: str, database: str, table: str, payload: RowMutation) -> MutationResult: ...

    @abstractmethod
    async def update_row(self, token: str, database: str, table: str, payload: RowMutation) -> MutationResult: ...

    @abstractmethod
    async def delete_rows(self, token: str, database: str, table: str, payload: RowDeleteRequest) -> MutationResult: ...

    # --- console / server -------------------------------------------------
    @abstractmethod
    async def run_sql(self, token: str, request: QueryRequest) -> list[QueryResult]: ...

    @abstractmethod
    async def server_overview(self, token: str) -> ServerOverview: ...

    @abstractmethod
    async def process_list(self, token: str) -> list[ProcessInfo]: ...

    @abstractmethod
    async def export_table(self, token: str, database: str, table: str, fmt: str, limit: int) -> dict[str, Any]: ...
