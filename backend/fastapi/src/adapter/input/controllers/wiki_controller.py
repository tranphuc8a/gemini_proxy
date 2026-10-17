"""Personal Wiki store: notes and flash cards synced between devices.

    GET    /wiki/backends                    which stores this server can use
    POST   /wiki/workspaces?backend=         create a workspace -> {workspaceId, key}   (key shown once)
    GET    /wiki/{workspaceId}/items?since=  records changed on the server after `since`
    PUT    /wiki/{workspaceId}/items         merge records (last writer wins, per record)
    DELETE /wiki/{workspaceId}               delete the whole workspace

There are no accounts: a workspace is its id plus a secret key (`X-Wiki-Key`, or
`Authorization: Bearer <key>`), the way `/codestore` does it. The key is returned
once, at creation; only its SHA-256 is stored. Answers are bare JSON like `/ai/*`
and `Cache-Control: no-store`; errors use the common envelope with `data.code`. A
record's `data` (the whole note or card) is opaque to the server. Data kept in the
browser's localStorage never reaches this API at all.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Header, Path, Query, Request
from fastapi.responses import JSONResponse

from src.adapter.factory.wiki_factory import available_backends, default_backend, get_wiki_input_port
from src.adapter.input.controllers.admin_auth import client_address
from src.application.ports.input.wiki_input_port import WikiInputPort
from src.domain.vo.wiki_vo import PutItemsRequest

router = APIRouter(prefix="/wiki", tags=["wiki"])

NO_STORE = {"Cache-Control": "no-store"}
WorkspaceId = Path(..., pattern=r"^[A-Za-z0-9_-]{1,64}$", description="The workspaceId returned at creation")


def wiki_key(
    x_wiki_key: Optional[str] = Header(default=None, alias="X-Wiki-Key", max_length=200),
    authorization: Optional[str] = Header(default=None, max_length=300),
) -> str:
    """The key from `X-Wiki-Key`, falling back to a bearer header."""
    if x_wiki_key:
        return x_wiki_key.strip()
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
async def create_workspace(request: Request, uc: WikiInputPort = Depends(get_wiki_input_port)):
    created = await uc.create_workspace(client_address(request))
    return JSONResponse(created, status_code=201, headers=NO_STORE)


@router.get("/{workspace_id}/items", summary="Records changed after `since`")
async def list_items(
    request: Request,
    workspace_id: str = WorkspaceId,
    since: int = Query(default=0, ge=0, le=4_102_444_800_000, description="The `serverTime` of the previous answer"),
    limit: Optional[int] = Query(default=None, ge=1, le=500, description="Fewer records per page than the default"),
    key: str = Depends(wiki_key),
    uc: WikiInputPort = Depends(get_wiki_input_port),
):
    out = await uc.list_items(workspace_id, key, since, limit, ip=client_address(request))
    return JSONResponse(out, headers=NO_STORE)


@router.put("/{workspace_id}/items", summary="Merge records; answers with what the server now holds")
async def put_items(
    body: PutItemsRequest,
    request: Request,
    workspace_id: str = WorkspaceId,
    key: str = Depends(wiki_key),
    uc: WikiInputPort = Depends(get_wiki_input_port),
):
    out = await uc.put_items(workspace_id, key, body, ip=client_address(request))
    return JSONResponse(out, headers=NO_STORE)


@router.delete("/{workspace_id}", summary="Delete a workspace and everything in it")
async def delete_workspace(
    request: Request,
    workspace_id: str = WorkspaceId,
    key: str = Depends(wiki_key),
    uc: WikiInputPort = Depends(get_wiki_input_port),
):
    deleted = await uc.delete_workspace(workspace_id, key, ip=client_address(request))
    return JSONResponse({"deleted": deleted}, headers=NO_STORE)
