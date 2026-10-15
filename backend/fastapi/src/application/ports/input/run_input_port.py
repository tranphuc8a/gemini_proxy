"""Inbound port for the `/run` use cases."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict

from src.domain.vo.run_vo import RunCaller, RunRequestIn, RunResult


class RunInputPort(ABC):
    @abstractmethod
    def providers(self) -> Dict[str, Any]:
        """`{"providers": [...], "default": id}`; no network access."""

    @abstractmethod
    async def run(self, body: RunRequestIn, caller: RunCaller) -> RunResult: ...
