"""The algorithm arena: the server measures every answer itself."""

from __future__ import annotations

import asyncio

import pytest

from src.application.exceptions.exceptions import AppException, BadRequestError, NotFoundError
from src.application.usecases import arena_usecase
from src.application.usecases.arena_usecase import ArenaUseCase, points, tour_length
from src.domain.models.arena_domain import ArenaScore


class FakeStore:
    def __init__(self):
        self.best = {}

    async def keep_best(self, problem, name, score, now):
        if (problem, name) in self.best and self.best[(problem, name)] <= score:
            return False
        self.best[(problem, name)] = score
        return True

    async def top(self, problem, limit):
        rows = sorted((s, n) for (p, n), s in self.best.items() if p == problem)[:limit]
        return [ArenaScore(problem=problem, name=n, score=s) for s, n in rows]

    async def rank(self, problem, score):
        return 1 + sum(1 for (p, _), s in self.best.items() if p == problem and s < score)


def _submit(uc, name="An", tour=None, problem="tsp-60", ip="1.1.1.1"):
    return asyncio.run(uc.submit(ip, problem, name, list(range(60)) if tour is None else tour))


def test_cities_are_the_same_every_time_and_inside_the_square():
    a, b = points("tsp-200"), points("tsp-200")
    assert a == b and len(a) == 200 and all(0 <= x < 1000 and 0 <= y < 1000 for x, y in a)
    assert points("tsp-60") != points("tsp-200")[:60]


def test_the_problem_ships_its_cities():
    p = ArenaUseCase.problem("tsp-60")
    assert p["n"] == 60 and len(p["points"]) == 60 and p["points"][0] == list(points("tsp-60")[0])
    with pytest.raises(NotFoundError):
        ArenaUseCase.problem("khong-co")


def test_the_score_is_measured_here_and_only_a_better_one_is_kept():
    uc = ArenaUseCase(FakeStore())
    out = _submit(uc)
    assert out == {"score": tour_length(points("tsp-60"), list(range(60))), "improved": True, "rank": 1}
    worse = list(range(0, 60, 2)) + list(range(1, 60, 2))
    assert _submit(uc, tour=worse)["improved"] is (tour_length(points("tsp-60"), worse) < out["score"])
    assert _submit(uc, tour=list(range(60)))["improved"] is False, "the same score again is not an improvement"


@pytest.mark.parametrize("tour", [list(range(59)), list(range(59)) + [0], list(range(1, 61)), []])
def test_anything_but_a_permutation_is_refused(tour):
    with pytest.raises(BadRequestError):
        _submit(ArenaUseCase(FakeStore()), tour=tour)


@pytest.mark.parametrize("name", ["", "   ", "x" * 31, "<b>", "a/b"])
def test_names_are_short_and_plain(name):
    with pytest.raises(BadRequestError):
        _submit(ArenaUseCase(FakeStore()), name=name)


def test_unicode_names_and_spaces_are_fine():
    uc = ArenaUseCase(FakeStore())
    _submit(uc, name="  Trần   Phúc ")
    assert asyncio.run(uc.leaderboard("tsp-60"))["rows"][0]["name"] == "Trần Phúc"


def test_an_address_submits_at_most_so_many_times_an_hour(monkeypatch):
    monkeypatch.setattr(arena_usecase, "SUBMITS_PER_HOUR", 2)
    arena_usecase.reset_limits()
    uc = ArenaUseCase(FakeStore())
    _submit(uc)
    _submit(uc)
    with pytest.raises(AppException) as exc:
        _submit(uc)
    assert exc.value.status_code == 429 and exc.value.headers["Retry-After"]
    assert _submit(uc, ip="2.2.2.2")["rank"] == 1, "another address is not held back"
