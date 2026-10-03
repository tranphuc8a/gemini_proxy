from abc import ABC, abstractmethod
from typing import List

from src.domain.models.arena_domain import ArenaScore


class ArenaOutputPort(ABC):
    @abstractmethod
    async def keep_best(self, problem: str, name: str, score: float, now: int) -> bool:
        """Store `score` for (problem, name) unless that name already has a score at least
        as good. True when the stored best changed."""

    @abstractmethod
    async def top(self, problem: str, limit: int) -> List[ArenaScore]:
        """The best scores of a problem, best first."""

    @abstractmethod
    async def rank(self, problem: str, score: float) -> int:
        """1 + how many names did strictly better than `score`."""
