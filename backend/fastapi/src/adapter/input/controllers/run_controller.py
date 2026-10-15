"""Run source code through a provider the user picks.

    GET  /run/providers   which providers exist, what each can run, and whether it works here
    POST /run             compile and run files; a fault of the CODE is `ok: false` in a 200

The backend is deployed serverless - no compiler, no sandbox - so the actual
running happens at a remote service (Piston, Judge0, Wandbox) or, only when an
operator switched it on and only for an administrator, with programs installed on
the server itself (`local`). The client names a provider by id; it never sends an
address. Answers are bare JSON like `/ai/*`, errors use the common envelope with
`data.code`. Source code is never logged.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import JSONResponse

from src.adapter.factory.run_factory import get_run_input_port
from src.adapter.input.controllers.admin_auth import client_address, is_admin
from src.application.ports.input.run_input_port import RunInputPort
from src.domain.vo.run_vo import RunCaller, RunRequestIn

router = APIRouter(prefix="/run", tags=["run"])

NO_STORE = {"Cache-Control": "no-store"}


@router.get("/providers", summary="Run providers and what each can do (no network access)")
async def run_providers(uc: RunInputPort = Depends(get_run_input_port)):
    return JSONResponse(uc.providers(), headers=NO_STORE)


@router.post("", summary="Compile and run source files")
async def run_code(
    body: RunRequestIn,
    request: Request,
    x_admin_key: Optional[str] = Header(default=None),
    x_admin_session: Optional[str] = Header(default=None),
    uc: RunInputPort = Depends(get_run_input_port),
):
    caller = RunCaller(ip=client_address(request), admin=is_admin(x_admin_key, x_admin_session))
    result = await uc.run(body, caller)
    return JSONResponse(result.model_dump(), headers=NO_STORE)
