"""RESTful surface for the personal-spending workspaces.

The ledger lives in the browser first and every figure is computed there; this
router is what makes it survive a cleared cache and follow the user to another
device. A workspace is one JSON document with a revision: `GET` it (cheaply, with
`?since=` while polling), `PUT` it back with the revision it was based on, and
merge on 409.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query

from src.adapter.factory.spending_factory import available_backends, default_backend, get_spending_input_port
from src.adapter.input.controllers.postman_controller import workspace_key
from src.adapter.input.controllers.response_utils import success_response
from src.application.ports.input.spending_input_port import SpendingInputPort
from src.domain.vo.spending_vo import SpendingCreateRequest, SpendingSaveRequest

router = APIRouter(prefix="/spending", tags=["spending"])


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


@router.post("/workspaces", summary="Create a workspace and its access key")
async def create_workspace(
    request: SpendingCreateRequest,
    service: SpendingInputPort = Depends(get_spending_input_port),
):
    data = await service.create_workspace(request)
    return success_response(
        data=data,
        message="Sổ chi tiêu đã được tạo. Hãy lưu access key - key này chỉ hiện một lần.",
        status_code=201,
    )


@router.get("/workspaces/{workspace_id}", summary="Read a workspace (or learn it is unchanged)")
async def get_workspace(
    workspace_id: str,
    since: Optional[int] = Query(
        default=None,
        ge=0,
        description="The revision the caller already holds. If it is still current the answer carries "
        "`unchanged: true` and no `data`.",
    ),
    key: str = Depends(workspace_key),
    service: SpendingInputPort = Depends(get_spending_input_port),
):
    return success_response(data=await service.get_workspace(workspace_id, key, since), message="OK")


@router.put("/workspaces/{workspace_id}", summary="Save a workspace (optimistic locking)")
async def save_workspace(
    workspace_id: str,
    request: SpendingSaveRequest,
    key: str = Depends(workspace_key),
    service: SpendingInputPort = Depends(get_spending_input_port),
):
    data = await service.save_workspace(workspace_id, key, request)
    return success_response(data=data, message="Đã lưu")


@router.delete("/workspaces/{workspace_id}", summary="Delete a workspace")
async def delete_workspace(
    workspace_id: str,
    key: str = Depends(workspace_key),
    service: SpendingInputPort = Depends(get_spending_input_port),
):
    deleted = await service.delete_workspace(workspace_id, key)
    return success_response(data={"deleted": deleted}, message="Đã xóa sổ chi tiêu")
