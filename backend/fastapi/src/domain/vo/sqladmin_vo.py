"""Request/response value objects for the SQL administrator feature."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class ConnectRequest(BaseModel):
    host: str = Field(default="localhost", max_length=255)
    port: int = Field(default=3306, ge=1, le=65535)
    username: str = Field(max_length=128)
    password: str = Field(default="")
    database: str | None = Field(default=None, max_length=64)
    label: str | None = Field(default=None, max_length=120)


class SessionInfo(BaseModel):
    token: str
    host: str
    port: int
    username: str
    database: str | None = None
    label: str | None = None
    server_version: str | None = None
    server_flavor: str | None = None
    connected_at: str
    last_used_at: str


class DatabaseInfo(BaseModel):
    name: str
    charset: str | None = None
    collation: str | None = None


class TableInfo(BaseModel):
    name: str
    type: str = "BASE TABLE"
    engine: str | None = None
    rows: int | None = None
    data_length: int | None = None
    collation: str | None = None
    comment: str | None = None


class ColumnInfo(BaseModel):
    name: str
    data_type: str
    column_type: str
    nullable: bool
    key: str | None = None
    default: Any = None
    extra: str | None = None
    comment: str | None = None
    position: int = 0


class IndexInfo(BaseModel):
    name: str
    unique: bool
    columns: list[str] = Field(default_factory=list)
    index_type: str | None = None


class ForeignKeyInfo(BaseModel):
    name: str
    column: str
    referenced_table: str
    referenced_column: str
    referenced_schema: str | None = None


class TableStructure(BaseModel):
    database: str
    table: str
    columns: list[ColumnInfo] = Field(default_factory=list)
    indexes: list[IndexInfo] = Field(default_factory=list)
    foreign_keys: list[ForeignKeyInfo] = Field(default_factory=list)
    primary_key: list[str] = Field(default_factory=list)
    ddl: str | None = None


class QueryResult(BaseModel):
    """One statement's outcome. `columns`/`rows` are empty for write statements."""

    statement: str
    kind: Literal["read", "write"] = "read"
    columns: list[str] = Field(default_factory=list)
    column_types: list[str] = Field(default_factory=list)
    rows: list[list[Any]] = Field(default_factory=list)
    row_count: int = 0
    affected_rows: int = 0
    last_insert_id: int | None = None
    duration_ms: float = 0.0
    truncated: bool = False
    error: str | None = None


class QueryRequest(BaseModel):
    sql: str = Field(min_length=1)
    database: str | None = None
    max_rows: int = Field(default=500, ge=1, le=10000)


class BrowsePage(BaseModel):
    database: str
    table: str
    columns: list[ColumnInfo] = Field(default_factory=list)
    primary_key: list[str] = Field(default_factory=list)
    rows: list[dict[str, Any]] = Field(default_factory=list)
    total: int = 0
    limit: int = 50
    offset: int = 0
    duration_ms: float = 0.0


class RowMutation(BaseModel):
    """Insert/update payload. `key` identifies the target row for updates."""

    values: dict[str, Any] = Field(default_factory=dict)
    key: dict[str, Any] | None = None


class RowDeleteRequest(BaseModel):
    keys: list[dict[str, Any]] = Field(min_length=1)


class CreateDatabaseRequest(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    charset: str = Field(default="utf8mb4", max_length=64)
    collation: str | None = Field(default=None, max_length=64)


class MutationResult(BaseModel):
    affected_rows: int = 0
    last_insert_id: int | None = None
    statement: str | None = None
    duration_ms: float = 0.0


class ServerOverview(BaseModel):
    version: str | None = None
    flavor: str | None = None
    uptime_seconds: int | None = None
    current_user: str | None = None
    charset: str | None = None
    status: dict[str, Any] = Field(default_factory=dict)
    variables: dict[str, Any] = Field(default_factory=dict)


class ProcessInfo(BaseModel):
    id: int
    user: str | None = None
    host: str | None = None
    db: str | None = None
    command: str | None = None
    time: int | None = None
    state: str | None = None
    info: str | None = None
