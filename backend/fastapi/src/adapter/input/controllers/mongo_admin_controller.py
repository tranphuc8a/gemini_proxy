"""RESTful surface for the MongoDB administrator front-end (/mongo-administrator).

The browser cannot speak the MongoDB wire protocol, so this router is the only
server-side component the pure-FE app depends on. Every call carries the session
token issued by POST /mongoadmin/sessions.

Reads that take a filter, a projection or a pipeline use POST rather than GET:
those are JSON documents, and squeezing them through a query string costs more
than it saves.
"""

from __future__ import annotations

from fastapi import APIRouter, Body, Depends, Header, Query
from fastapi.responses import Response

from src.adapter.factory.mongo_admin_factory import get_mongo_admin_input_port
from src.adapter.input.controllers.response_utils import success_response
from src.application.ports.input.mongo_admin_input_port import MongoAdminInputPort
from src.domain.vo.mongoadmin_vo import (
    AggregateRequest,
    CommandRequest,
    ConnectRequest,
    CountRequest,
    CreateCollectionRequest,
    CreateDatabaseRequest,
    CreateIndexRequest,
    DeleteRequest,
    FindRequest,
    InsertRequest,
    RenameCollectionRequest,
    UpdateRequest,
)

router = APIRouter(prefix="/mongoadmin", tags=["mongo-administrator"])


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
@router.post("/sessions", summary="Connect to a MongoDB deployment")
async def connect(
    request: ConnectRequest,
    service: MongoAdminInputPort = Depends(get_mongo_admin_input_port),
):
    data = await service.connect(request)
    return success_response(data=data, message="Connected", status_code=201)


@router.get("/sessions/current", summary="Restore the stored session")
async def current_session(
    token: str = Depends(session_token),
    service: MongoAdminInputPort = Depends(get_mongo_admin_input_port),
):
    return success_response(data=await service.current_session(token), message="Session active")


@router.delete("/sessions/current", summary="Log out and close the driver client")
async def disconnect(
    token: str = Depends(session_token),
    service: MongoAdminInputPort = Depends(get_mongo_admin_input_port),
):
    removed = await service.disconnect(token)
    return success_response(data={"disconnected": removed}, message="Disconnected")


# ---------------------------------------------------------------------------
# databases
# ---------------------------------------------------------------------------
@router.get("/databases", summary="List databases")
async def list_databases(
    token: str = Depends(session_token),
    service: MongoAdminInputPort = Depends(get_mongo_admin_input_port),
):
    return success_response(data=await service.list_databases(token), message="OK")


@router.post("/databases", summary="Create a database and its first collection")
async def create_database(
    request: CreateDatabaseRequest,
    token: str = Depends(session_token),
    service: MongoAdminInputPort = Depends(get_mongo_admin_input_port),
):
    data = await service.create_database(token, request)
    return success_response(data=data, message="Database created", status_code=201)


@router.delete("/databases/{database}", summary="Drop a database")
async def drop_database(
    database: str,
    token: str = Depends(session_token),
    service: MongoAdminInputPort = Depends(get_mongo_admin_input_port),
):
    return success_response(data=await service.drop_database(token, database), message="Database dropped")


@router.get("/databases/{database}/stats", summary="dbStats for one database")
async def database_stats(
    database: str,
    token: str = Depends(session_token),
    service: MongoAdminInputPort = Depends(get_mongo_admin_input_port),
):
    return success_response(data=await service.database_stats(token, database), message="OK")


# ---------------------------------------------------------------------------
# collections
# ---------------------------------------------------------------------------
@router.get("/databases/{database}/collections", summary="List collections and views")
async def list_collections(
    database: str,
    with_stats: bool = Query(default=False, description="Also fetch counts and sizes"),
    token: str = Depends(session_token),
    service: MongoAdminInputPort = Depends(get_mongo_admin_input_port),
):
    data = await service.list_collections(token, database, with_stats)
    return success_response(data=data, message="OK")


@router.post("/databases/{database}/collections", summary="Create a collection")
async def create_collection(
    database: str,
    request: CreateCollectionRequest,
    token: str = Depends(session_token),
    service: MongoAdminInputPort = Depends(get_mongo_admin_input_port),
):
    data = await service.create_collection(token, database, request)
    return success_response(data=data, message="Collection created", status_code=201)


@router.delete("/databases/{database}/collections/{collection}", summary="Drop a collection")
async def drop_collection(
    database: str,
    collection: str,
    token: str = Depends(session_token),
    service: MongoAdminInputPort = Depends(get_mongo_admin_input_port),
):
    data = await service.drop_collection(token, database, collection)
    return success_response(data=data, message="Collection dropped")


@router.post("/databases/{database}/collections/{collection}/rename", summary="Rename a collection")
async def rename_collection(
    database: str,
    collection: str,
    request: RenameCollectionRequest,
    token: str = Depends(session_token),
    service: MongoAdminInputPort = Depends(get_mongo_admin_input_port),
):
    data = await service.rename_collection(token, database, collection, request)
    return success_response(data=data, message="Collection renamed")


@router.post("/databases/{database}/collections/{collection}/truncate", summary="Delete every document")
async def truncate_collection(
    database: str,
    collection: str,
    token: str = Depends(session_token),
    service: MongoAdminInputPort = Depends(get_mongo_admin_input_port),
):
    data = await service.truncate_collection(token, database, collection)
    return success_response(data=data, message="Collection emptied")


@router.get("/databases/{database}/collections/{collection}/stats", summary="collStats for one collection")
async def collection_stats(
    database: str,
    collection: str,
    token: str = Depends(session_token),
    service: MongoAdminInputPort = Depends(get_mongo_admin_input_port),
):
    data = await service.collection_stats(token, database, collection)
    return success_response(data=data, message="OK")


# ---------------------------------------------------------------------------
# documents
# ---------------------------------------------------------------------------
_DOC_ROOT = "/databases/{database}/collections/{collection}/documents"


@router.post(f"{_DOC_ROOT}/find", summary="Query documents")
async def find_documents(
    database: str,
    collection: str,
    request: FindRequest,
    token: str = Depends(session_token),
    service: MongoAdminInputPort = Depends(get_mongo_admin_input_port),
):
    data = await service.find_documents(token, database, collection, request)
    return success_response(data=data, message="OK")


@router.post(f"{_DOC_ROOT}/count", summary="Count matching documents")
async def count_documents(
    database: str,
    collection: str,
    request: CountRequest,
    token: str = Depends(session_token),
    service: MongoAdminInputPort = Depends(get_mongo_admin_input_port),
):
    total = await service.count_documents(token, database, collection, request)
    return success_response(data={"count": total}, message="OK")


@router.post(_DOC_ROOT, summary="Insert one or many documents")
async def insert_documents(
    database: str,
    collection: str,
    request: InsertRequest,
    token: str = Depends(session_token),
    service: MongoAdminInputPort = Depends(get_mongo_admin_input_port),
):
    data = await service.insert_documents(token, database, collection, request)
    return success_response(data=data, message="Documents inserted", status_code=201)


@router.patch(_DOC_ROOT, summary="Update or replace documents")
async def update_documents(
    database: str,
    collection: str,
    request: UpdateRequest,
    token: str = Depends(session_token),
    service: MongoAdminInputPort = Depends(get_mongo_admin_input_port),
):
    data = await service.update_documents(token, database, collection, request)
    return success_response(data=data, message="Documents updated")


@router.post(f"{_DOC_ROOT}/delete", summary="Delete documents by filter")
async def delete_documents(
    database: str,
    collection: str,
    request: DeleteRequest,
    token: str = Depends(session_token),
    service: MongoAdminInputPort = Depends(get_mongo_admin_input_port),
):
    data = await service.delete_documents(token, database, collection, request)
    return success_response(data=data, message="Documents deleted")


@router.get(
    "/databases/{database}/collections/{collection}/export",
    summary="Export documents as json, jsonl or csv",
)
async def export_collection(
    database: str,
    collection: str,
    fmt: str = Query(default="json", alias="format"),
    limit: int = Query(default=200, ge=1, le=1000),
    filter: str | None = Query(default=None, description="Optional Extended JSON filter"),
    token: str = Depends(session_token),
    service: MongoAdminInputPort = Depends(get_mongo_admin_input_port),
):
    payload = await service.export_collection(token, database, collection, fmt, limit, filter)
    return Response(
        content=payload["content"],
        media_type=payload["media_type"],
        headers={"Content-Disposition": f'attachment; filename="{payload["filename"]}"'},
    )


# ---------------------------------------------------------------------------
# indexes
# ---------------------------------------------------------------------------
@router.get("/databases/{database}/collections/{collection}/indexes", summary="List indexes")
async def list_indexes(
    database: str,
    collection: str,
    token: str = Depends(session_token),
    service: MongoAdminInputPort = Depends(get_mongo_admin_input_port),
):
    return success_response(data=await service.list_indexes(token, database, collection), message="OK")


@router.post("/databases/{database}/collections/{collection}/indexes", summary="Create an index")
async def create_index(
    database: str,
    collection: str,
    request: CreateIndexRequest,
    token: str = Depends(session_token),
    service: MongoAdminInputPort = Depends(get_mongo_admin_input_port),
):
    data = await service.create_index(token, database, collection, request)
    return success_response(data=data, message="Index created", status_code=201)


@router.delete("/databases/{database}/collections/{collection}/indexes/{name}", summary="Drop an index")
async def drop_index(
    database: str,
    collection: str,
    name: str,
    token: str = Depends(session_token),
    service: MongoAdminInputPort = Depends(get_mongo_admin_input_port),
):
    return success_response(data=await service.drop_index(token, database, collection, name), message="Index dropped")


# ---------------------------------------------------------------------------
# console and server
# ---------------------------------------------------------------------------
@router.post("/databases/{database}/collections/{collection}/aggregate", summary="Run an aggregation pipeline")
async def aggregate(
    database: str,
    collection: str,
    request: AggregateRequest,
    token: str = Depends(session_token),
    service: MongoAdminInputPort = Depends(get_mongo_admin_input_port),
):
    return success_response(data=await service.aggregate(token, database, collection, request), message="OK")


@router.post("/command", summary="Run a raw database command")
async def run_command(
    request: CommandRequest = Body(...),
    token: str = Depends(session_token),
    service: MongoAdminInputPort = Depends(get_mongo_admin_input_port),
):
    return success_response(data=await service.run_command(token, request), message="OK")


@router.get("/server/overview", summary="Server version, status counters and build info")
async def server_overview(
    token: str = Depends(session_token),
    service: MongoAdminInputPort = Depends(get_mongo_admin_input_port),
):
    return success_response(data=await service.server_overview(token), message="OK")


@router.get("/server/operations", summary="Operations currently in progress")
async def current_operations(
    token: str = Depends(session_token),
    service: MongoAdminInputPort = Depends(get_mongo_admin_input_port),
):
    return success_response(data=await service.current_operations(token), message="OK")
