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
    ConnectRequest,
    CreateDatabaseRequest,
    QueryRequest,
    RowDeleteRequest,
    RowMutation,
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
