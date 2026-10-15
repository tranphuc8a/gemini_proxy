"""Code Studio store: snippets and projects synced between devices.

    GET    /codestore/backends                    which stores this server can use
    POST   /codestore/workspaces?backend=         create a workspace -> {workspaceId, key}   (key shown once)
    GET    /codestore/{workspaceId}/items?since=  records changed on the server after `since`
    PUT    /codestore/{workspaceId}/items         merge records (last writer wins, per record)
    DELETE /codestore/{workspaceId}               delete the whole workspace

There are no accounts: a workspace is its id plus a secret key (`X-Codestore-Key`),
the way `/spending` does it. The key is returned once, at creation; only its
SHA-256 is stored. Answers are bare JSON like `/ai/*`; errors use the common
envelope with `data.code`. Data kept in the browser's localStorage never reaches
this API at all.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Header, Path, Query, Request
from fastapi.responses import JSONResponse

from src.adapter.factory.codestore_factory import available_backends, default_backend, get_codestore_input_port
from src.adapter.input.controllers.admin_auth import client_address
from src.application.ports.input.codestore_input_port import CodestoreInputPort
from src.domain.vo.codestore_vo import PutItemsRequest

router = APIRouter(prefix="/codestore", tags=["codestore"])

NO_STORE = {"Cache-Control": "no-store"}
WorkspaceId = Path(..., pattern=r"^[A-Za-z0-9_-]{1,64}$", description="The workspaceId returned at creation")


def codestore_key(
    x_codestore_key: Optional[str] = Header(default=None, alias="X-Codestore-Key", max_length=200),
    authorization: Optional[str] = Header(default=None, max_length=300),
) -> str:
    """The key from `X-Codestore-Key`, falling back to a bearer header."""
    if x_codestore_key:
        return x_codestore_key.strip()
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return ""


@router.get("/backends", summary="Stores this deployment can serve")
async def list_backends():
    """What `?backend=` accepts, and which entry is the default.

    Each store is separate: a workspace and its key were created in one and mean
    nothing in the others. `persistent: false` marks a store whose data is lost
    when the server restarts (the JSON file in a temporary directory).
    """
    return JSONResponse({"default": default_backend(), "backends": await available_backends()}, headers=NO_STORE)


@router.post("/workspaces", status_code=201, summary="Create a workspace and its secret key")
async def create_workspace(request: Request, uc: CodestoreInputPort = Depends(get_codestore_input_port)):
    created = await uc.create_workspace(client_address(request))
    return JSONResponse(created, status_code=201, headers=NO_STORE)


@router.get("/{workspace_id}/items", summary="Records changed after `since`")
async def list_items(
    request: Request,
    workspace_id: str = WorkspaceId,
    since: int = Query(default=0, ge=0, le=4_102_444_800_000, description="The `serverTime` of the previous answer"),
    limit: Optional[int] = Query(default=None, ge=1, le=500, description="Fewer records per page than the default"),
    key: str = Depends(codestore_key),
    uc: CodestoreInputPort = Depends(get_codestore_input_port),
):
    out = await uc.list_items(workspace_id, key, since, limit, ip=client_address(request))
    return JSONResponse(out, headers=NO_STORE)


@router.put("/{workspace_id}/items", summary="Merge records; answers with what the server now holds")
async def put_items(
    body: PutItemsRequest,
    request: Request,
    workspace_id: str = WorkspaceId,
    key: str = Depends(codestore_key),
    uc: CodestoreInputPort = Depends(get_codestore_input_port),
):
    out = await uc.put_items(workspace_id, key, body, ip=client_address(request))
    return JSONResponse(out, headers=NO_STORE)


@router.delete("/{workspace_id}", summary="Delete a workspace and everything in it")
async def delete_workspace(
    request: Request,
    workspace_id: str = WorkspaceId,
    key: str = Depends(codestore_key),
    uc: CodestoreInputPort = Depends(get_codestore_input_port),
):
    deleted = await uc.delete_workspace(workspace_id, key, ip=client_address(request))
    return JSONResponse({"deleted": deleted}, headers=NO_STORE)
