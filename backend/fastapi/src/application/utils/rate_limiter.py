"""Building blocks of the shared rate limiter (`RateLimiterPort`).

* `MemoryRateLimiter` - the async face of `FailureWindow`: exact, per process.
* `FailOpenRateLimiter` - a persistent counter that must never take a request
  down: when it fails it logs a warning and the instance counts in memory instead.
* the bucket arithmetic the two persistent adapters (SQL, MongoDB) share.

Why buckets: a persistent counter cannot keep a timestamp per event. Time is cut
into buckets of `window / 6` seconds and one counter lives per (key, bucket);
the events of a window are the sum over the buckets that still overlap it. A
bucket is kept until the END of its slot has left the window, so an event is
remembered up to one bucket (a sixth of the window) longer than in an exact
sliding window and never shorter: the limit is never looser than configured.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import math
import time
from typing import Callable, Mapping, Optional, Union

from src.application.ports.output.rate_limiter_port import RateLimiterPort
from src.application.utils.rate_limit import FailureWindow

logger = logging.getLogger(__name__)

BUCKETS_PER_WINDOW = 6


# --------------------------------------------------------------- bucket maths
def bucket_seconds(window_seconds: int) -> int:
    """Length of one bucket: a sixth of the window, at least a second."""
    return max(1, math.ceil(max(1, int(window_seconds)) / BUCKETS_PER_WINDOW))


def live_buckets(now: float, window_seconds: int) -> range:
    """Indexes of the buckets that may still hold events of the window ending at `now`."""
    length = bucket_seconds(window_seconds)
    return range(math.floor((now - window_seconds) / length), math.floor(now / length) + 1)


def bucket_of(now: float, window_seconds: int) -> int:
    return math.floor(now / bucket_seconds(window_seconds))


def bucket_expires_at(bucket: int, window_seconds: int) -> int:
    """Epoch second after which no event of `bucket` is inside any window any more."""
    return (bucket + 1) * bucket_seconds(window_seconds) + int(window_seconds)


def wait_seconds(counts: Mapping[int, int], now: float, window_seconds: int, max_events: int) -> Optional[int]:
    """How long until fewer than `max_events` events are left, or None if already so.

    `counts` maps a live bucket to its events. Expiry goes oldest bucket first, so
    the answer is the moment the bucket that brings the total under the limit expires.
    """
    total = sum(max(0, int(hits)) for hits in counts.values())
    if total < max_events:
        return None
    excess = total - max_events + 1
    running = 0
    for bucket in sorted(counts):
        running += max(0, int(counts[bucket]))
        if running >= excess:
            return max(1, math.ceil(bucket_expires_at(bucket, window_seconds) - now))
    return max(1, int(window_seconds))          # unreachable: total >= excess


def subject_digest(key: str) -> str:
    """What a persistent store keeps instead of the key: a client address is personal
    data, and the store needs equality only."""
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


# ------------------------------------------------------------------- adapters
class MemoryRateLimiter(RateLimiterPort):
    """The in-process counter (exact sliding window), behind the async port."""

    def __init__(
        self,
        max_events: int = 1,
        window_seconds: int = 60,
        clock: Callable[[], float] = time.monotonic,
        *,
        window: Optional[FailureWindow] = None,
    ):
        self._window = window or FailureWindow(max_events, window_seconds, clock=clock)

    @classmethod
    def wrapping(cls, window: FailureWindow) -> "MemoryRateLimiter":
        return cls(window=window)

    async def retry_after(self, key: str) -> Optional[int]:
        return self._window.retry_after(key)

    async def add(self, key: str) -> None:
        self._window.add(key)

    async def reset(self, key: Optional[str] = None) -> None:
        self._window.reset(key)


class FailOpenRateLimiter(RateLimiterPort):
    """`primary` while it works, `fallback` (memory) while it does not.

    A rate limit protects the service; it must not become the way the service goes
    down. So any error or timeout of the persistent counter is logged (the class of
    the error only: a driver message can carry a host name or a user) and the
    instance counts in memory from then on. After `cooldown_s` the primary is tried
    again, so a database that comes back is used again. During the cooldown the
    primary is not asked at all: a hung database must not cost every request
    `timeout_s`.
    """

    def __init__(
        self,
        primary: RateLimiterPort,
        fallback: RateLimiterPort,
        *,
        name: str = "",
        timeout_s: float = 2.0,
        cooldown_s: float = 30.0,
        clock: Callable[[], float] = time.monotonic,
    ):
        self._primary = primary
        self._fallback = fallback
        self._name = name
        self._timeout = max(0.05, float(timeout_s))
        self._cooldown = max(0.0, float(cooldown_s))
        self._clock = clock
        self._resume_at = 0.0
        self._degraded = False

    @property
    def degraded(self) -> bool:
        """True while counting in memory because the persistent counter failed."""
        return self._degraded

    async def _call(self, operation: str, *args):
        if self._clock() >= self._resume_at:
            try:
                result = await asyncio.wait_for(getattr(self._primary, operation)(*args), self._timeout)
            except Exception as cause:  # noqa: BLE001 - any failure of the store means "count in memory"
                self._resume_at = self._clock() + self._cooldown
                self._degraded = True
                logger.warning(
                    "Rate limiter %r: the shared counter failed (%s); this instance counts in memory for %.0f s",
                    self._name, type(cause).__name__, self._cooldown,
                )
            else:
                if self._degraded:
                    self._degraded = False
                    logger.info("Rate limiter %r: the shared counter works again", self._name)
                return result
        return await getattr(self._fallback, operation)(*args)

    async def retry_after(self, key: str) -> Optional[int]:
        return await self._call("retry_after", key)

    async def add(self, key: str) -> None:
        await self._call("add", key)

    async def reset(self, key: Optional[str] = None) -> None:
        # Both: whichever counter answered earlier must forget.
        try:
            await asyncio.wait_for(self._primary.reset(key), self._timeout)
        except Exception as cause:  # noqa: BLE001
            logger.warning("Rate limiter %r: reset failed (%s)", self._name, type(cause).__name__)
        await self._fallback.reset(key)


LimiterLike = Union[RateLimiterPort, FailureWindow]


def as_rate_limiter(limiter: Optional[LimiterLike]) -> Optional[RateLimiterPort]:
    """Accept the legacy `FailureWindow` where a use case now takes a port."""
    if limiter is None or isinstance(limiter, RateLimiterPort):
        return limiter
    if isinstance(limiter, FailureWindow):
        return MemoryRateLimiter.wrapping(limiter)
    raise TypeError(f"not a rate limiter: {type(limiter).__name__}")
