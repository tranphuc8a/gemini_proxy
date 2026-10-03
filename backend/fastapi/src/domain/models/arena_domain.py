from __future__ import annotations

from pydantic import BaseModel


class ArenaScore(BaseModel):
    """One name's best result on one problem — lower is better (a tour length)."""

    problem: str
    name: str
    score: float
    updated_at: int = 0
