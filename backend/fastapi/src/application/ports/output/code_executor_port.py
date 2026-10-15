"""Outbound port: something that can compile and run source code.

Four adapters implement it (`adapter/output/run/`): Piston, Judge0 and Wandbox
(remote services reached over HTTP) and `local` (programs installed on the
server). The backend is deployed serverless, where there is no compiler and no
sandbox, which is why a user picks a provider per request instead of the server
choosing one.

An adapter reports facts about itself without touching the network
(`languages`, `availability`) - `GET /run/providers` is public and must stay
cheap - and does the work in `execute`.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Literal, Tuple

from src.domain.vo.run_vo import ExecutionRequest, RunResult


class CodeExecutorPort(ABC):
    #: The id clients send as `provider`.
    id: str
    label: str
    kind: Literal["remote", "local"]
    #: True when running it needs an administrator session (it executes code on
    #: the server's own machine).
    needs_session: bool = False

    @abstractmethod
    def languages(self) -> Tuple[str, ...]:
        """Canonical language ids this provider can run right now."""

    def multi_file_languages(self) -> Tuple[str, ...]:
        """The languages for which a request may carry more than one file."""
        return ()

    @abstractmethod
    def availability(self) -> Tuple[bool, str]:
        """`(available, reason)`; `reason` is Vietnamese and empty when available.

        Purely local knowledge (configuration, programs found on disk): it must
        not call the provider.
        """

    @abstractmethod
    async def execute(self, request: ExecutionRequest) -> RunResult:
        """Compile and run. A fault of the user's code is part of the result; a
        fault of the provider raises `RunProviderUnavailable`, `RunProviderTimeout`
        or `RunProviderRejected`."""
