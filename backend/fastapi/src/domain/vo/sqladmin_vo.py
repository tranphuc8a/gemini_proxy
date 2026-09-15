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


# ---------------------------------------------------------------------------
# Schema editing
#
# One request model per operation rather than a single "run this ALTER" string:
# the operation is what gets validated, and an identifier that has been through
# `quote_identifier` cannot become a second statement. A free-text DDL box does
# exist -- it is `/query` -- but a form that builds SQL must not be one.
# ---------------------------------------------------------------------------

class ColumnDefinition(BaseModel):
    """Enough to render a column clause. Types are not enumerated on purpose.

    MySQL has too many, they grow, and a caller that wants `GEOMETRY` or an
    `ENUM(...)` should not have to wait for this list to catch up. The type is
    checked for shape rather than membership -- see `validate_column_type`.
    """

    name: str = Field(min_length=1, max_length=64)
    data_type: str = Field(min_length=1, max_length=200)
    nullable: bool = True
    default: str | None = Field(default=None, max_length=500)
    #: Rendered verbatim after the type: AUTO_INCREMENT, UNSIGNED, ON UPDATE …
    extra: str | None = Field(default=None, max_length=200)
    comment: str | None = Field(default=None, max_length=500)
    #: Place the column after this one; "" means FIRST.
    after: str | None = Field(default=None, max_length=64)


class AddColumnRequest(BaseModel):
    column: ColumnDefinition


class ModifyColumnRequest(BaseModel):
    """`name` is the column as it is now; `column.name` is what it becomes."""

    name: str = Field(min_length=1, max_length=64)
    column: ColumnDefinition


class DropColumnRequest(BaseModel):
    name: str = Field(min_length=1, max_length=64)


class RenameTableRequest(BaseModel):
    new_name: str = Field(min_length=1, max_length=64)


class CreateTableRequest(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    columns: list[ColumnDefinition] = Field(min_length=1)
    primary_key: list[str] = Field(default_factory=list)
    engine: str | None = Field(default=None, max_length=64)
    charset: str | None = Field(default=None, max_length=64)
    comment: str | None = Field(default=None, max_length=500)


class IndexRequest(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    columns: list[str] = Field(min_length=1)
    unique: bool = False


class PrimaryKeyRequest(BaseModel):
    """Empty `columns` drops the primary key instead of setting one."""

    columns: list[str] = Field(default_factory=list)


class ForeignKeyRequest(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    columns: list[str] = Field(min_length=1)
    referenced_table: str = Field(min_length=1, max_length=64)
    referenced_columns: list[str] = Field(min_length=1)
    referenced_schema: str | None = Field(default=None, max_length=64)
    on_delete: str | None = Field(default=None, max_length=20)
    on_update: str | None = Field(default=None, max_length=20)


# --------------------------------------------------------------------- views

class ViewInfo(BaseModel):
    name: str
    updatable: bool = False
    definer: str | None = None
    security: str | None = None
    definition: str | None = None


class ViewRequest(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    #: The SELECT behind the view. Free-form by necessity: a view *is* a query.
    select: str = Field(min_length=1)
    replace: bool = True
    check_option: str | None = Field(default=None, max_length=20)


# ------------------------------------------------------------------ routines

class RoutineInfo(BaseModel):
    name: str
    kind: Literal["FUNCTION", "PROCEDURE"]
    returns: str | None = None
    parameters: str | None = None
    language: str | None = None
    deterministic: bool = False
    security: str | None = None
    comment: str | None = None
    created: str | None = None
    modified: str | None = None
    definition: str | None = None


class RoutineRequest(BaseModel):
    """A routine body cannot be assembled from parts, so this takes the whole
    `CREATE PROCEDURE …` / `CREATE FUNCTION …` statement."""

    statement: str = Field(min_length=1)
    replace: bool = False


class CallRoutineRequest(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    #: Bound as parameters, never interpolated.
    arguments: list[Any] = Field(default_factory=list)


class TriggerInfo(BaseModel):
    name: str
    table: str
    timing: str
    event: str
    statement: str | None = None


# ---------------------------------------------------------- backup & restore

class BackupRequest(BaseModel):
    """What to include in a dump.

    Schema and data are separable because the two are wanted for different
    reasons: schema-only to recreate a structure elsewhere, data-only to reload
    rows into a structure that already exists.
    """

    include_schema: bool = True
    include_data: bool = True
    include_routines: bool = True
    include_views: bool = True
    drop_if_exists: bool = True
    #: Cap per table, so one runaway table cannot exhaust memory.
    max_rows_per_table: int = Field(default=100_000, ge=1, le=1_000_000)
    tables: list[str] = Field(default_factory=list)


class BackupResult(BaseModel):
    database: str
    filename: str
    media_type: str = "application/sql"
    content: str
    tables: int = 0
    rows: int = 0
    routines: int = 0
    views: int = 0
    bytes: int = 0
    generated_at: str = ""
    truncated_tables: list[str] = Field(default_factory=list)


class RestoreRequest(BaseModel):
    """A dump to replay. `stop_on_error` off is what makes a partial restore
    useful: one bad statement in a thousand should not hide the other 999."""

    content: str = Field(min_length=1)
    stop_on_error: bool = True
    #: Refuse the whole thing unless the caller names the database it targets.
    confirm_database: str | None = None


class RestoreResult(BaseModel):
    database: str
    statements: int = 0
    executed: int = 0
    failed: int = 0
    affected_rows: int = 0
    duration_ms: float = 0.0
    errors: list[str] = Field(default_factory=list)
