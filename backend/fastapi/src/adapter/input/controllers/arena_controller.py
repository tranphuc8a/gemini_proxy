"""The algorithm arena (webapp/dau-truong-thuat-toan).

    GET  /arena/problems                       the problems
    GET  /arena/problems/{id}                  one problem with its cities
    GET  /arena/problems/{id}/leaderboard      best score per name, best first
    POST /arena/problems/{id}/submit           {name, tour} → score measured here, rank
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, StrictInt

from src.adapter.factory.arena_factory import get_arena_usecase
from src.adapter.input.controllers.admin_auth import client_address
from src.application.usecases.arena_usecase import ArenaUseCase

router = APIRouter(prefix="/arena", tags=["arena"])


class Submission(BaseModel):
    name: str = Field(..., max_length=60)
    tour: List[StrictInt] = Field(..., max_length=1000)


@router.get("/problems")
async def list_problems():
    return {"problems": ArenaUseCase.problems()}


@router.get("/problems/{problem}")
async def get_problem(problem: str):
    # The cities never change for a problem id: cache freely.
    return JSONResponse(ArenaUseCase.problem(problem), headers={"Cache-Control": "public, max-age=86400"})


@router.get("/problems/{problem}/leaderboard")
async def leaderboard(problem: str, limit: int = Query(20, ge=1, le=100), uc: ArenaUseCase = Depends(get_arena_usecase)):
    return JSONResponse(await uc.leaderboard(problem, limit), headers={"Cache-Control": "no-store"})


@router.post("/problems/{problem}/submit")
async def submit(problem: str, body: Submission, request: Request, uc: ArenaUseCase = Depends(get_arena_usecase)):
    out = await uc.submit(client_address(request), problem, body.name, body.tour)
    return JSONResponse(out, headers={"Cache-Control": "no-store"})
