"""RESTful surface for the SQL administrator front-end (/sql-administrator).

The browser cannot speak the MySQL wire protocol, so this router is the only
server-side component the pure-FE app depends on. Every call carries the
session token issued by POST /sqladmin/sessions.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, Query
from fastapi.responses import Response

from src.adapter.factory.sql_admin_factory import get_sql_admin_input_port
from src.adapter.input.controllers.response_utils import success_response
from src.application.ports.input.sql_admin_input_port import SqlAdminInputPort
from src.domain.vo.sqladmin_vo import (
    AddColumnRequest,
    BackupRequest,
    CallRoutineRequest,
    ConnectRequest,
    CreateDatabaseRequest,
    CreateTableRequest,
    DropColumnRequest,
    ForeignKeyRequest,
    IndexRequest,
    ModifyColumnRequest,
    PrimaryKeyRequest,
    QueryRequest,
    RenameTableRequest,
    RestoreRequest,
    RoutineRequest,
    RowDeleteRequest,
    RowMutation,
    ViewRequest,
)

router = APIRouter(prefix="/sqladmin", tags=["sql-administrator"])


def session_token(
    x_session_token: str | None = Header(default=None, alias="X-Session-Token"),
    authorization: str | None = Header(default=None),
) -> str:
    """Read the session token from X-Session-Token, falling back to a bearer header."""
    if x_session_token:
        return x_session_token
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return ""


# ---------------------------------------------------------------------------
# session
# ---------------------------------------------------------------------------
@router.post("/sessions", summary="Connect to a MySQL/MariaDB server")
async def connect(
    request: ConnectRequest,
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    data = await service.connect(request)
    return success_response(data=data, message="Connected", status_code=201)


@router.get("/sessions/current", summary="Restore the stored session")
async def current_session(
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    return success_response(data=await service.current_session(token), message="Session active")


@router.delete("/sessions/current", summary="Log out and close pooled connections")
async def disconnect(
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    removed = await service.disconnect(token)
    return success_response(data={"disconnected": removed}, message="Disconnected")


# ---------------------------------------------------------------------------
# databases
# ---------------------------------------------------------------------------
@router.get("/databases", summary="List databases")
async def list_databases(
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    return success_response(data=await service.list_databases(token), message="OK")


@router.post("/databases", summary="Create a database")
async def create_database(
    request: CreateDatabaseRequest,
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    data = await service.create_database(token, request)
    return success_response(data=data, message="Database created", status_code=201)


@router.delete("/databases/{database}", summary="Drop a database")
async def drop_database(
    database: str,
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    return success_response(data=await service.drop_database(token, database), message="Database dropped")


# ---------------------------------------------------------------------------
# tables
# ---------------------------------------------------------------------------
@router.get("/databases/{database}/tables", summary="List tables and views")
async def list_tables(
    database: str,
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    return success_response(data=await service.list_tables(token, database), message="OK")


@router.get("/databases/{database}/tables/{table}/structure", summary="Columns, indexes, keys and DDL")
async def table_structure(
    database: str,
    table: str,
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    return success_response(data=await service.table_structure(token, database, table), message="OK")


@router.delete("/databases/{database}/tables/{table}", summary="Drop a table")
async def drop_table(
    database: str,
    table: str,
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    return success_response(data=await service.drop_table(token, database, table), message="Table dropped")


@router.post("/databases/{database}/tables/{table}/truncate", summary="Truncate a table")
async def truncate_table(
    database: str,
    table: str,
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    return success_response(data=await service.truncate_table(token, database, table), message="Table truncated")


# ---------------------------------------------------------------------------
# rows
# ---------------------------------------------------------------------------
@router.get("/databases/{database}/tables/{table}/rows", summary="Browse rows")
async def browse_rows(
    database: str,
    table: str,
    limit: int = Query(default=50, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    order_by: str | None = Query(default=None),
    direction: str | None = Query(default=None),
    search: str | None = Query(default=None),
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    data = await service.browse_table(token, database, table, limit, offset, order_by, direction, search)
    return success_response(data=data, message="OK")


@router.post("/databases/{database}/tables/{table}/rows", summary="Insert a row")
async def insert_row(
    database: str,
    table: str,
    payload: RowMutation,
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    data = await service.insert_row(token, database, table, payload)
    return success_response(data=data, message="Row inserted", status_code=201)


@router.patch("/databases/{database}/tables/{table}/rows", summary="Update a row by key")
async def update_row(
    database: str,
    table: str,
    payload: RowMutation,
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    return success_response(data=await service.update_row(token, database, table, payload), message="Row updated")


@router.post("/databases/{database}/tables/{table}/rows/delete", summary="Delete rows by key")
async def delete_rows(
    database: str,
    table: str,
    payload: RowDeleteRequest,
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    return success_response(data=await service.delete_rows(token, database, table, payload), message="Rows deleted")


# ---------------------------------------------------------------------------
# console, server, export
# ---------------------------------------------------------------------------
@router.post("/query", summary="Run an ad-hoc SQL script")
async def run_sql(
    request: QueryRequest,
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    return success_response(data=await service.run_sql(token, request), message="OK")


@router.get("/server/overview", summary="Server version, status counters and variables")
async def server_overview(
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    return success_response(data=await service.server_overview(token), message="OK")


@router.get("/server/processes", summary="SHOW FULL PROCESSLIST")
async def process_list(
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    return success_response(data=await service.process_list(token), message="OK")


@router.get("/databases/{database}/tables/{table}/export", summary="Export a table as csv, json or sql")
async def export_table(
    database: str,
    table: str,
    fmt: str = Query(default="csv", alias="format"),
    limit: int = Query(default=1000, ge=1, le=10000),
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    payload = await service.export_table(token, database, table, fmt, limit)
    return Response(
        content=payload["content"],
        media_type=payload["media_type"],
        headers={"Content-Disposition": f'attachment; filename="{payload["filename"]}"'},
    )


# ---------------------------------------------------------------------------
# schema editing
#
# Each route maps to one validated operation rather than to a piece of SQL. The
# console at /query is the place to type SQL; a route that builds a statement
# from a form must not also be one.
# ---------------------------------------------------------------------------
@router.post("/databases/{database}/tables", summary="Create a table")
async def create_table(
    database: str,
    request: CreateTableRequest,
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    return success_response(data=await service.create_table(token, database, request), message="Đã tạo bảng")


@router.patch("/databases/{database}/tables/{table}/rename", summary="Rename a table")
async def rename_table(
    database: str,
    table: str,
    request: RenameTableRequest,
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    return success_response(data=await service.rename_table(token, database, table, request), message="Đã đổi tên bảng")


@router.post("/databases/{database}/tables/{table}/columns", summary="Add a column")
async def add_column(
    database: str,
    table: str,
    request: AddColumnRequest,
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    return success_response(data=await service.add_column(token, database, table, request), message="Đã thêm cột")


@router.patch("/databases/{database}/tables/{table}/columns", summary="Modify or rename a column")
async def modify_column(
    database: str,
    table: str,
    request: ModifyColumnRequest,
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    return success_response(data=await service.modify_column(token, database, table, request), message="Đã sửa cột")


@router.post("/databases/{database}/tables/{table}/columns/delete", summary="Drop a column")
async def drop_column(
    database: str,
    table: str,
    request: DropColumnRequest,
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    return success_response(data=await service.drop_column(token, database, table, request), message="Đã xoá cột")


# --------------------------------------------------------------- keys/indexes
@router.put("/databases/{database}/tables/{table}/primary-key", summary="Set or drop the primary key")
async def set_primary_key(
    database: str,
    table: str,
    request: PrimaryKeyRequest,
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    data = await service.set_primary_key(token, database, table, request)
    return success_response(data=data, message="Đã cập nhật khoá chính")


@router.post("/databases/{database}/tables/{table}/indexes", summary="Create an index")
async def create_index(
    database: str,
    table: str,
    request: IndexRequest,
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    return success_response(data=await service.create_index(token, database, table, request), message="Đã tạo index")


@router.delete("/databases/{database}/tables/{table}/indexes/{name}", summary="Drop an index")
async def drop_index(
    database: str,
    table: str,
    name: str,
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    return success_response(data=await service.drop_index(token, database, table, name), message="Đã xoá index")


@router.post("/databases/{database}/tables/{table}/foreign-keys", summary="Create a foreign key")
async def create_foreign_key(
    database: str,
    table: str,
    request: ForeignKeyRequest,
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    data = await service.create_foreign_key(token, database, table, request)
    return success_response(data=data, message="Đã tạo khoá ngoại")


@router.delete("/databases/{database}/tables/{table}/foreign-keys/{name}", summary="Drop a foreign key")
async def drop_foreign_key(
    database: str,
    table: str,
    name: str,
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    data = await service.drop_foreign_key(token, database, table, name)
    return success_response(data=data, message="Đã xoá khoá ngoại")


# ---------------------------------------------------------------------- views
@router.get("/databases/{database}/views", summary="List views")
async def list_views(
    database: str,
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    return success_response(data=await service.list_views(token, database), message="OK")


@router.get("/databases/{database}/views/{view}", summary="Read one view's definition")
async def get_view(
    database: str,
    view: str,
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    return success_response(data=await service.get_view(token, database, view), message="OK")


@router.put("/databases/{database}/views", summary="Create or replace a view")
async def save_view(
    database: str,
    request: ViewRequest,
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    return success_response(data=await service.save_view(token, database, request), message="Đã lưu view")


@router.delete("/databases/{database}/views/{view}", summary="Drop a view")
async def drop_view(
    database: str,
    view: str,
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    return success_response(data=await service.drop_view(token, database, view), message="Đã xoá view")


# ------------------------------------------------------------------- routines
@router.get("/databases/{database}/routines", summary="List functions and procedures")
async def list_routines(
    database: str,
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    return success_response(data=await service.list_routines(token, database), message="OK")


@router.get("/databases/{database}/routines/{kind}/{name}", summary="Read one routine's body")
async def get_routine(
    database: str,
    kind: str,
    name: str,
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    return success_response(data=await service.get_routine(token, database, name, kind), message="OK")


@router.put("/databases/{database}/routines", summary="Create or replace a routine")
async def save_routine(
    database: str,
    request: RoutineRequest,
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    return success_response(data=await service.save_routine(token, database, request), message="Đã lưu routine")


@router.delete("/databases/{database}/routines/{kind}/{name}", summary="Drop a routine")
async def drop_routine(
    database: str,
    kind: str,
    name: str,
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    return success_response(data=await service.drop_routine(token, database, name, kind), message="Đã xoá routine")


@router.post("/databases/{database}/routines/call", summary="Call a procedure or function")
async def call_routine(
    database: str,
    request: CallRoutineRequest,
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    return success_response(data=await service.call_routine(token, database, request), message="OK")


@router.get("/databases/{database}/triggers", summary="List triggers")
async def list_triggers(
    database: str,
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    return success_response(data=await service.list_triggers(token, database), message="OK")


# ------------------------------------------------------------ backup/restore
@router.post("/databases/{database}/backup", summary="Dump a database as SQL")
async def backup_database(
    database: str,
    request: BackupRequest,
    download: bool = Query(default=False, description="Return the dump as a file attachment"),
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    result = await service.backup_database(token, database, request)
    if download:
        # A dump is often tens of megabytes; handing it back as a file avoids
        # pushing the whole thing through the JSON envelope and the browser's
        # string handling.
        return Response(
            content=result.content,
            media_type=result.media_type,
            headers={"Content-Disposition": f'attachment; filename="{result.filename}"'},
        )
    return success_response(data=result, message="Đã tạo bản sao lưu")


@router.post("/databases/{database}/restore", summary="Replay a SQL dump into a database")
async def restore_database(
    database: str,
    request: RestoreRequest,
    token: str = Depends(session_token),
    service: SqlAdminInputPort = Depends(get_sql_admin_input_port),
):
    result = await service.restore_database(token, database, request)
    message = "Đã phục hồi" if not result.failed else f"Phục hồi xong với {result.failed} lỗi"
    return success_response(data=result, message=message)
