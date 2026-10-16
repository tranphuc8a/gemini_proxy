"""Outbound port: a counter of events per key inside a time window.

It is the rate limit's source of truth. The in-process `FailureWindow` is correct
for one process, but a serverless deployment runs many instances that never see
each other's counts, so a limit kept in memory only slows an attacker down. The
adapters behind this port count where every instance can see: memory (one
process, the default for development and tests), a SQL table or a MongoDB
collection.

One object is one *counter*: the limit (`max_events` per `window_seconds`) is fixed
when it is built, the key (a client address) is chosen per call. Callers ask first
(`retry_after`) and count afterwards (`add`), so what a client is refused for is
decided without counting the refusal itself. Two instances can both pass the
check and both add, which overshoots the limit by a few events at the edge: this
is a brake on abuse, not an exact meter.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional


class RateLimiterPort(ABC):
    @abstractmethod
    async def retry_after(self, key: str) -> Optional[int]:
        """Seconds until `key` may act again, or None when it is under the limit."""

    @abstractmethod
    async def add(self, key: str) -> None:
        """Count one event for `key`."""

    @abstractmethod
    async def reset(self, key: Optional[str] = None) -> None:
        """Forget the events of `key`, or of every key of this counter when None."""
