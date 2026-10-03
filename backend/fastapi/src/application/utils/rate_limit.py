"""Counting events in a sliding window — failed logins (enough to stop guessing
a secret), or requests (a rate limit).

In-process and per instance: on a serverless platform each instance counts on
its own, so this slows an attacker down rather than stopping a distributed
one. That is why the limit comes in two layers — per client address, and for
the whole instance — and why a long random admin key remains the real defence.
"""

from __future__ import annotations

import threading
import time
from collections import deque
from typing import Deque, Dict, Optional


class FailureWindow:
    def __init__(self, max_failures: int, window_seconds: int, clock=time.monotonic):
        self.max_failures = max(1, int(max_failures))
        self.window = max(1, int(window_seconds))
        self._clock = clock
        self._events: Dict[str, Deque[float]] = {}
        self._lock = threading.Lock()

    def _trim(self, key: str, now: float) -> Deque[float]:
        q = self._events.setdefault(key, deque())
        while q and q[0] <= now - self.window:
            q.popleft()
        if not q:
            self._events.pop(key, None)
            q = self._events.setdefault(key, deque())
        return q

    def retry_after(self, key: str) -> Optional[int]:
        """Seconds to wait if `key` is over the limit, else None."""
        with self._lock:
            now = self._clock()
            q = self._trim(key, now)
            if len(q) < self.max_failures:
                return None
            return max(1, int(q[0] + self.window - now) + 1)

    def add(self, key: str) -> None:
        """Count one event for `key`."""
        with self._lock:
            self._trim(key, self._clock()).append(self._clock())

    #: A failed attempt is the event the login limits count.
    fail = add

    def reset(self, key: Optional[str] = None) -> None:
        with self._lock:
            if key is None:
                self._events.clear()
            else:
                self._events.pop(key, None)
