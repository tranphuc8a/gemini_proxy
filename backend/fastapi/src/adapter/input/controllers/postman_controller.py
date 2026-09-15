"""RESTful surface for postman-lite-pro workspaces.

Collections, requests and environments live in the browser first; this router is
what makes them survive a cleared cache and follow the user to another machine.
Request *sending* is not here - that is `/proxy/request`.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, Query

from src.adapter.factory.postman_factory import available_backends, default_backend, get_postman_input_port
from src.adapter.input.controllers.response_utils import success_response
from src.application.ports.input.postman_input_port import PostmanInputPort
from src.domain.vo.postman_vo import (
    HistoryEntry,
    WorkspaceCreateRequest,
    WorkspaceSaveRequest,
)

router = APIRouter(prefix="/postman", tags=["postman-lite-pro"])


def workspace_key(
    x_workspace_key: str | None = Header(default=None, alias="X-Workspace-Key"),
    authorization: str | None = Header(default=None),
) -> str:
    """Read the access key from X-Workspace-Key, falling back to a bearer header."""
    if x_workspace_key:
        return x_workspace_key
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return ""


@router.get("/backends", summary="Storage backends this deployment can serve")
async def list_backends():
    """What `?backend=` will accept, and which entry is the default.

    Each backend is a separate store: a workspace id and its access key were
    minted in one of them and mean nothing in the others. The web app shows the
    choice, and needs to know which entries would only fail on first use.
    """
    return success_response(
        data={"default": default_backend(), "backends": await available_backends()},
        message="OK",
    )


# ---------------------------------------------------------------------------
# workspace
# ---------------------------------------------------------------------------
@router.post("/workspaces", summary="Create a workspace and its access key")
async def create_workspace(
    request: WorkspaceCreateRequest,
    service: PostmanInputPort = Depends(get_postman_input_port),
):
    data = await service.create_workspace(request)
    return success_response(
        data=data,
        message="Workspace đã được tạo. Hãy lưu access key - key này chỉ hiện một lần.",
        status_code=201,
    )


@router.get("/workspaces/{workspace_id}", summary="Read a workspace")
async def get_workspace(
    workspace_id: str,
    key: str = Depends(workspace_key),
    service: PostmanInputPort = Depends(get_postman_input_port),
):
    return success_response(data=await service.get_workspace(workspace_id, key), message="OK")


@router.put("/workspaces/{workspace_id}", summary="Save a workspace (optimistic locking)")
async def save_workspace(
    workspace_id: str,
    request: WorkspaceSaveRequest,
    key: str = Depends(workspace_key),
    service: PostmanInputPort = Depends(get_postman_input_port),
):
    data = await service.save_workspace(workspace_id, key, request)
    return success_response(data=data, message="Đã lưu")


@router.delete("/workspaces/{workspace_id}", summary="Delete a workspace and its history")
async def delete_workspace(
    workspace_id: str,
    key: str = Depends(workspace_key),
    service: PostmanInputPort = Depends(get_postman_input_port),
):
    deleted = await service.delete_workspace(workspace_id, key)
    return success_response(data={"deleted": deleted}, message="Đã xóa workspace")


# ---------------------------------------------------------------------------
# sharing
# ---------------------------------------------------------------------------
@router.post("/workspaces/{workspace_id}/share", summary="Enable or revoke the read-only share link")
async def set_share(
    workspace_id: str,
    enabled: bool = Query(default=True),
    key: str = Depends(workspace_key),
    service: PostmanInputPort = Depends(get_postman_input_port),
):
    data = await service.set_share(workspace_id, key, enabled)
    return success_response(data=data, message="Đã bật chia sẻ" if data.enabled else "Đã thu hồi link")


@router.get("/shared/{share_token}", summary="Read a shared workspace (no access key)")
async def get_shared(
    share_token: str,
    service: PostmanInputPort = Depends(get_postman_input_port),
):
    return success_response(data=await service.get_shared(share_token), message="OK")


# ---------------------------------------------------------------------------
# history
# ---------------------------------------------------------------------------
@router.get("/workspaces/{workspace_id}/history", summary="List server-side history")
async def list_history(
    workspace_id: str,
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    key: str = Depends(workspace_key),
    service: PostmanInputPort = Depends(get_postman_input_port),
):
    data = await service.list_history(workspace_id, key, limit, offset)
    return success_response(data=data, message="OK")


@router.post("/workspaces/{workspace_id}/history", summary="Record one sent request")
async def add_history(
    workspace_id: str,
    entry: HistoryEntry,
    key: str = Depends(workspace_key),
    service: PostmanInputPort = Depends(get_postman_input_port),
):
    data = await service.add_history(workspace_id, key, entry)
    return success_response(data=data, message="OK", status_code=201)


@router.delete("/workspaces/{workspace_id}/history", summary="Clear server-side history")
async def clear_history(
    workspace_id: str,
    key: str = Depends(workspace_key),
    service: PostmanInputPort = Depends(get_postman_input_port),
):
    removed = await service.clear_history(workspace_id, key)
    return success_response(data={"removed": removed}, message="Đã xóa lịch sử")
