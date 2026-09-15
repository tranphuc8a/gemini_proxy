"""Inbound port for the SQL administrator use cases."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from src.domain.vo.sqladmin_vo import (
    AddColumnRequest,
    BackupRequest,
    BackupResult,
    BrowsePage,
    CallRoutineRequest,
    ConnectRequest,
    CreateDatabaseRequest,
    CreateTableRequest,
    DatabaseInfo,
    DropColumnRequest,
    ForeignKeyRequest,
    IndexRequest,
    ModifyColumnRequest,
    MutationResult,
    PrimaryKeyRequest,
    ProcessInfo,
    QueryRequest,
    QueryResult,
    RenameTableRequest,
    RestoreRequest,
    RestoreResult,
    RoutineInfo,
    RoutineRequest,
    RowDeleteRequest,
    RowMutation,
    ServerOverview,
    SessionInfo,
    TriggerInfo,
    ViewInfo,
    ViewRequest,
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

    # --- schema editing --------------------------------------------------
    # Declared here so the port stays the whole contract the controller may
    # rely on. They are not @abstractmethod: an alternative implementation that
    # only browses is a legitimate thing to write, and forcing it to stub
    # twenty DDL methods would be noise, not safety.
    async def create_table(self, token: str, database: str, request: CreateTableRequest) -> MutationResult: ...

    async def rename_table(self, token: str, database: str, table: str, request: RenameTableRequest) -> MutationResult: ...

    async def add_column(self, token: str, database: str, table: str, request: AddColumnRequest) -> MutationResult: ...

    async def modify_column(self, token: str, database: str, table: str, request: ModifyColumnRequest) -> MutationResult: ...

    async def drop_column(self, token: str, database: str, table: str, request: DropColumnRequest) -> MutationResult: ...

    async def set_primary_key(self, token: str, database: str, table: str, request: PrimaryKeyRequest) -> MutationResult: ...

    async def create_index(self, token: str, database: str, table: str, request: IndexRequest) -> MutationResult: ...

    async def drop_index(self, token: str, database: str, table: str, name: str) -> MutationResult: ...

    async def create_foreign_key(self, token: str, database: str, table: str, request: ForeignKeyRequest) -> MutationResult: ...

    async def drop_foreign_key(self, token: str, database: str, table: str, name: str) -> MutationResult: ...

    # --- views -----------------------------------------------------------
    async def list_views(self, token: str, database: str) -> list[ViewInfo]: ...

    async def get_view(self, token: str, database: str, view: str) -> ViewInfo: ...

    async def save_view(self, token: str, database: str, request: ViewRequest) -> MutationResult: ...

    async def drop_view(self, token: str, database: str, view: str) -> MutationResult: ...

    # --- routines --------------------------------------------------------
    async def list_routines(self, token: str, database: str) -> list[RoutineInfo]: ...

    async def get_routine(self, token: str, database: str, name: str, kind: str) -> RoutineInfo: ...

    async def save_routine(self, token: str, database: str, request: RoutineRequest) -> MutationResult: ...

    async def drop_routine(self, token: str, database: str, name: str, kind: str) -> MutationResult: ...

    async def call_routine(self, token: str, database: str, request: CallRoutineRequest) -> QueryResult: ...

    async def list_triggers(self, token: str, database: str) -> list[TriggerInfo]: ...

    # --- backup & restore ------------------------------------------------
    async def backup_database(self, token: str, database: str, request: BackupRequest) -> BackupResult: ...

    async def restore_database(self, token: str, database: str, request: RestoreRequest) -> RestoreResult: ...
