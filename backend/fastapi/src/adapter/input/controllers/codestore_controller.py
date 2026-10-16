"""Code Studio store: snippets and projects synced between devices.

    GET    /codestore/backends                    which stores this server can use
    POST   /codestore/workspaces?backend=         create a workspace -> {workspaceId, key}   (key shown once)
    GET    /codestore/{workspaceId}/items?since=  records changed on the server after `since`
    PUT    /codestore/{workspaceId}/items         merge records (last writer wins, per record)
    DELETE /codestore/{workspaceId}               delete the whole workspace

    POST   /codestore/{workspaceId}/items/{itemId}/share   make (or refresh) a read-only link -> {token, sharedAt, updatedAt}
    GET    /codestore/{workspaceId}/shares                 the workspace's links
    DELETE /codestore/{workspaceId}/items/{itemId}/share   revoke a link
    GET    /codestore/shared/{token}                       PUBLIC, no key: the frozen copy a link shows

There are no accounts: a workspace is its id plus a secret key (`X-Codestore-Key`),
the way `/spending` does it. The key is returned once, at creation; only its
SHA-256 is stored. A read-only link (`/shared/{token}`) is the one thing that needs no key:
the token IS the key, and it opens a snapshot of one record, never the workspace.
Answers are bare JSON like `/ai/*`; errors use the common
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
ItemId = Path(..., pattern=r"^[A-Za-z0-9_.:-]{1,80}$", description="The id of a record")
# Only a length cap: a wrong token of any shape must be answered like an unknown one (404), not told apart by a 422.
ShareToken = Path(..., min_length=1, max_length=100, description="The token of a read-only link")


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


# Registered BEFORE the `/{workspace_id}/...` routes: `/shared/{token}` is as many segments as
# `/{workspace_id}/items`, and the literal route must win.
@router.get("/shared/{token}", summary="Read a record through a read-only link (public)")
async def read_shared(
    request: Request,
    token: str = ShareToken,
    uc: CodestoreInputPort = Depends(get_codestore_input_port),
):
    """No key. Returns the snapshot taken when the owner shared the record - not the
    record as it is now - without the owner's editor state or anything that names the
    workspace. Unknown and revoked tokens give the same 404. Rate limited per client
    address, and so are wrong tokens. Pass the same `?backend=` the link was made in."""
    out = await uc.read_shared(token, ip=client_address(request))
    return JSONResponse(out, headers=NO_STORE)


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


@router.post("/{workspace_id}/items/{item_id}/share", status_code=201,
             summary="Make a read-only link to a record, or refresh the one it has")
async def create_share(
    request: Request,
    workspace_id: str = WorkspaceId,
    item_id: str = ItemId,
    key: str = Depends(codestore_key),
    uc: CodestoreInputPort = Depends(get_codestore_input_port),
):
    """Freezes the record as the SERVER holds it now (sync first). 201 for a new link,
    200 when the record already had one: its snapshot is refreshed and the token kept."""
    created, out = await uc.create_share(workspace_id, key, item_id, ip=client_address(request))
    return JSONResponse(out, status_code=201 if created else 200, headers=NO_STORE)


@router.get("/{workspace_id}/shares", summary="The read-only links of a workspace")
async def list_shares(
    request: Request,
    workspace_id: str = WorkspaceId,
    key: str = Depends(codestore_key),
    uc: CodestoreInputPort = Depends(get_codestore_input_port),
):
    out = await uc.list_shares(workspace_id, key, ip=client_address(request))
    return JSONResponse(out, headers=NO_STORE)


@router.delete("/{workspace_id}/items/{item_id}/share", summary="Revoke the read-only link of a record")
async def revoke_share(
    request: Request,
    workspace_id: str = WorkspaceId,
    item_id: str = ItemId,
    key: str = Depends(codestore_key),
    uc: CodestoreInputPort = Depends(get_codestore_input_port),
):
    out = await uc.revoke_share(workspace_id, key, item_id, ip=client_address(request))
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
