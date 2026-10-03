"""The algorithm arena: problems the browser solves with the visitor's own code,
scores the server measures itself.

A visitor writes a heuristic in JavaScript; it runs in their browser (a Web
Worker) on a fixed instance and returns a tour. The server never takes a number
from the page: it regenerates the instance from its seed, checks that the answer
visits every city exactly once, and measures the tour itself. The leaderboard
keeps each name's best per problem.
"""

from __future__ import annotations

import functools
import math
import re
import time
from typing import Any, Dict, List, Tuple

from src.application.exceptions.exceptions import AppException, BadRequestError, NotFoundError
from src.application.ports.output.arena_output_port import ArenaOutputPort
from src.application.utils.rate_limit import FailureWindow

#: Euclidean travelling salesman on integer points in [0, 1000)². Lower is better.
PROBLEMS: Dict[str, Dict[str, Any]] = {
    "tsp-60": {"title": "Người du lịch — 60 thành phố", "n": 60, "seed": 60601},
    "tsp-200": {"title": "Người du lịch — 200 thành phố", "n": 200, "seed": 20202},
    "tsp-1000": {"title": "Người du lịch — 1000 thành phố", "n": 1000, "seed": 100001},
}
NAME_RE = re.compile(r"^[\w .\-]{1,30}$")
SUBMITS_PER_HOUR = 60
_WINDOW: Dict[str, FailureWindow] = {}


def _window() -> FailureWindow:
    if "w" not in _WINDOW:
        _WINDOW["w"] = FailureWindow(SUBMITS_PER_HOUR, 3600)
    return _WINDOW["w"]


def reset_limits() -> None:
    _WINDOW.clear()


@functools.lru_cache(maxsize=None)
def points(problem: str) -> Tuple[Tuple[int, int], ...]:
    """The cities of a problem: a 32-bit LCG from the problem's seed — the same
    numbers every time, on every instance of the server."""
    spec = PROBLEMS[problem]
    s, out = spec["seed"] & 0xFFFFFFFF, []
    for _ in range(spec["n"]):
        s = (s * 1664525 + 1013904223) & 0xFFFFFFFF
        x = s * 1000 >> 32
        s = (s * 1664525 + 1013904223) & 0xFFFFFFFF
        y = s * 1000 >> 32
        out.append((x, y))
    return tuple(out)


def tour_length(pts: Tuple[Tuple[int, int], ...], tour: List[int]) -> float:
    total = 0.0
    for i, a in enumerate(tour):
        b = tour[(i + 1) % len(tour)]
        total += math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1])
    return round(total, 3)


def _spec(problem: str) -> Dict[str, Any]:
    if problem not in PROBLEMS:
        raise NotFoundError(f"Không có đề {problem!r}")
    return PROBLEMS[problem]


class ArenaUseCase:
    def __init__(self, store: ArenaOutputPort):
        self.store = store

    @staticmethod
    def problems() -> List[Dict[str, Any]]:
        return [{"id": k, "title": v["title"], "n": v["n"]} for k, v in PROBLEMS.items()]

    @staticmethod
    def problem(problem: str) -> Dict[str, Any]:
        spec = _spec(problem)
        return {"id": problem, "title": spec["title"], "n": spec["n"],
                "points": [list(p) for p in points(problem)],
                "objective": "Độ dài chu trình đi qua mọi thành phố đúng một lần rồi về điểm đầu — càng ngắn càng tốt."}

    async def submit(self, ip: str, problem: str, name: str, tour: List[int]) -> Dict[str, Any]:
        n = _spec(problem)["n"]
        name = " ".join((name or "").split())
        if not NAME_RE.match(name):
            raise BadRequestError("Tên 1–30 ký tự: chữ, số, dấu cách và . _ -")
        if len(tour) != n or sorted(tour) != list(range(n)):
            raise BadRequestError(f"Lời giải phải là một hoán vị của 0…{n - 1}: đi qua mỗi thành phố đúng một lần")
        window = _window()
        wait = window.retry_after(ip)
        if wait:
            raise AppException(message=f"Nộp quá nhiều lần — thử lại sau {wait} giây", status_code=429,
                               code="arena_rate_limited", payload={"code": "arena_rate_limited", "retryAfter": wait},
                               headers={"Retry-After": str(wait)})
        window.add(ip)
        score = tour_length(points(problem), tour)
        improved = await self.store.keep_best(problem, name, score, int(time.time()))
        return {"score": score, "improved": improved, "rank": await self.store.rank(problem, score)}

    async def leaderboard(self, problem: str, limit: int = 20) -> Dict[str, Any]:
        _spec(problem)
        rows = await self.store.top(problem, max(1, min(int(limit), 100)))
        return {"problem": problem, "rows": [{"rank": i + 1, "name": r.name, "score": r.score, "updatedAt": r.updated_at}
                                             for i, r in enumerate(rows)]}
