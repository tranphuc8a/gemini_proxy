"""The tutor beside a lesson: what it reads, what it asks, what it caches.

The course side is a small fake with the reader's visibility rule (an
unpublished course exists for an administrator only); the AI side is the real
gateway over the shared fakes, so access, the books and the cache are the ones
production runs.
"""

from __future__ import annotations

import asyncio
import json

import pytest

from src.application.config.config import settings
from src.application.exceptions.exceptions import AppException, BadGatewayError, BadRequestError, NotFoundError
from src.application.usecases import ai_course_usecase
from src.application.usecases.ai_course_usecase import AiCourseUseCase
from src.application.usecases.ai_usecase import AiUseCase
from src.domain.models.ai_domain import AiCaller
from src.domain.models.course_domain import CourseDocDomain, CourseDomain, CourseSearchHit
from tests.support.fake_ai import FakeModel, FakeStore

ANON = AiCaller(ip="1.2.3.4")
ADMIN = AiCaller(ip="1.2.3.4", admin=True)


class FakeCourses:
    def __init__(self, published: bool = True):
        self.published = published
        self.queries = []
        self.docs = {
            "a.md": CourseDocDomain(id="a.md", slug="bai/a", title="Bài A", md="# Bài A\n\nNội dung A về băm nhất quán.",
                                    rev="r1"),
            "b.md": CourseDocDomain(id="b.md", slug="bai/b", title="Bài B", md="# Bài B\n\nNội dung B.", rev="r1"),
            "c.md": CourseDocDomain(id="c.md", slug="bai/c", title="Bài C", md="# Bài C\n\nNội dung C.", rev="r1"),
        }

    def _visible(self, include_unpublished):
        self.queries.append("visible")
        if not self.published and not include_unpublished:
            raise NotFoundError("Không tìm thấy khoá học 'k'")

    async def get_course(self, slug, include_unpublished=False):
        self._visible(include_unpublished)
        return CourseDomain(slug=slug, title="Khoá K")

    async def get_doc(self, slug, doc_id, include_unpublished=False):
        self._visible(include_unpublished)
        if doc_id not in self.docs:
            raise NotFoundError(f"Không có bài {doc_id!r}")
        return self.docs[doc_id]

    async def search_all(self, query, limit=20):
        self.queries.append("search_all")
        hits = [] if "không-có" in query else [
            {"course": "k", "courseTitle": "Khoá K", "webapp": None, "id": i, "slug": "bai/" + i[:-3],
             "title": i, "score": 9.0 - n} for n, i in enumerate(("b.md", "a.md", "gone.md"))]
        return hits[:limit]

    async def search(self, slug, query, limit=24, include_unpublished=False):
        self._visible(include_unpublished)
        return [CourseSearchHit(id=i, slug=self.docs[i].slug, title=self.docs[i].title) for i in ("a.md", "b.md", "c.md")]


@pytest.fixture
def tutor(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_URL", "https://gemini.test/v1beta/models/gemini-2.5-flash:generateContent")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "k")
    monkeypatch.setattr(settings, "AI_ENABLED", True)
    monkeypatch.setattr(settings, "AI_ACCESS", "public")

    def make(*answers, published=True):
        store, model, courses = FakeStore(), FakeModel(list(answers) or None), FakeCourses(published)
        return AiCourseUseCase(AiUseCase(store, model), courses), store, model, courses
    return make


def _run(uc, caller=ANON, **kw):
    return asyncio.run(uc.tutor(caller, **{"course": "k", "doc": "a.md", **kw}))


def _prompt(model, i=-1):
    return model.calls[i]["contents"][0]["parts"][0]["text"]


def test_a_summary_reads_the_lesson_and_is_booked_under_its_action(tutor):
    uc, store, model, _ = tutor(json.dumps({"answer": "- ý một\n- ý hai"}))
    out = _run(uc, action="summary")
    assert out == {"action": "summary", "cached": False, "answer": "- ý một\n- ý hai", "sources": []}
    assert "Nội dung A về băm nhất quán." in _prompt(model)
    assert "«Khoá K»" in model.calls[0]["system"]
    assert model.calls[0]["config"]["responseMimeType"] == "application/json"
    assert store.records[0][0] == "tutor_summary"


def test_the_same_question_twice_costs_one_call_and_an_edit_asks_again(tutor):
    uc, _, model, courses = tutor(json.dumps({"answer": "giải thích"}))
    assert _run(uc, action="explain", selection="  đoạn   khó ")["cached"] is False
    again = _run(uc, action="explain", selection="đoạn khó")
    assert again["cached"] is True and again["answer"] == "giải thích" and len(model.calls) == 1
    courses.docs["a.md"] = courses.docs["a.md"].model_copy(update={"rev": "r2"})
    _run(uc, action="explain", selection="đoạn khó")
    assert len(model.calls) == 2, "a new revision of the lesson is asked about afresh"


def test_explaining_a_selection_quotes_it(tutor):
    uc, _, model, _ = tutor(json.dumps({"answer": "x"}))
    _run(uc, action="explain", selection="vòng băm có nút ảo")
    assert "vòng băm có nút ảo" in _prompt(model) and "bôi đen" in _prompt(model)
    _run(uc, action="explain")
    assert "bôi đen" not in _prompt(model), "no selection: the lesson's core idea"


def test_a_question_brings_related_lessons_and_cites_only_real_ones(tutor):
    uc, _, model, _ = tutor(json.dumps({"answer": "Theo [2] và [1]…", "sources": [2, 1, 2, 9, 0]}))
    out = _run(uc, action="ask", question="  nút ảo là gì? ")
    prompt = _prompt(model)
    assert "[1] BÀI «Bài A»" in prompt and "[2] BÀI «Bài B»" in prompt and "[3] BÀI «Bài C»" in prompt
    assert prompt.count("BÀI «Bài A»") == 1, "the lesson itself is not quoted twice"
    assert "nút ảo là gì?" in prompt
    assert [s["id"] for s in out["sources"]] == ["b.md", "a.md"], "in order, deduplicated, out-of-range dropped"
    assert out["sources"][0] == {"id": "b.md", "slug": "bai/b", "title": "Bài B"}


def test_a_question_is_required_to_ask(tutor):
    uc, _, model, _ = tutor()
    with pytest.raises(BadRequestError):
        _run(uc, action="ask", question="   ")
    with pytest.raises(BadRequestError):
        _run(uc, action="dance")
    assert model.calls == []


def test_a_quiz_keeps_the_well_formed_questions(tutor):
    good = {"question": "Q1?", "choices": ["a", "b", "c", "d"], "answer": 2, "explain": "vì c"}
    bad = [{"question": "", "choices": ["a", "b"], "answer": 0},
           {"question": "Q?", "choices": ["a", 3, "c", "d"], "answer": 0},
           {"question": "Q?", "choices": ["a", "b", "c", "d"], "answer": 4},
           {"question": "Q?", "choices": ["a", "b", "c", "d"], "answer": True}]
    uc, _, model, _ = tutor(json.dumps({"questions": [good] + bad}))
    out = _run(uc, action="quiz")
    assert out["questions"] == [good] and model.calls[0]["config"]["responseSchema"] == ai_course_usecase.QUIZ_SCHEMA


def test_a_quiz_with_nothing_usable_is_a_bad_gateway_and_is_not_cached(tutor):
    uc, store, _, _ = tutor(json.dumps({"questions": [{"question": "Q?"}]}))
    with pytest.raises(BadGatewayError):
        _run(uc, action="quiz")
    assert store.cache == {}


def test_another_quiz_variant_is_another_cache_entry(tutor):
    q = {"question": "Q?", "choices": ["a", "b", "c", "d"], "answer": 0, "explain": ""}
    uc, _, model, _ = tutor(json.dumps({"questions": [q]}))
    _run(uc, action="quiz")
    _run(uc, action="quiz")
    _run(uc, action="quiz", variant=1)
    assert len(model.calls) == 2


def test_flashcards_keep_the_complete_ones_and_are_cached_per_revision(tutor):
    cards = [{"front": " Bloom filter sai theo hướng nào? ", "back": "Chỉ dương tính giả."},
             {"front": "", "back": "thiếu mặt trước"}, {"front": "Q"}, "không phải object"]
    uc, store, model, _ = tutor(json.dumps({"cards": cards}))
    out = _run(uc, action="cards")
    assert out == {"action": "cards", "cached": False,
                   "cards": [{"front": "Bloom filter sai theo hướng nào?", "back": "Chỉ dương tính giả."}]}
    assert model.calls[0]["config"]["responseSchema"] == ai_course_usecase.CARDS_SCHEMA
    assert "flashcard" in _prompt(model) and store.records[0][0] == "tutor_cards"
    assert _run(uc, action="cards")["cached"] is True and len(model.calls) == 1


def test_an_unpublished_course_is_for_the_administrator_only(tutor):
    uc, _, model, _ = tutor(json.dumps({"answer": "x"}), published=False)
    with pytest.raises(NotFoundError):
        _run(uc, action="summary")
    assert model.calls == []
    assert _run(uc, ADMIN, action="summary")["answer"] == "x"


def test_a_refused_caller_costs_neither_a_query_nor_a_call(tutor, monkeypatch):
    uc, _, model, courses = tutor()
    monkeypatch.setattr(settings, "AI_ACCESS", "admin")
    with pytest.raises(AppException) as exc:
        _run(uc, action="summary")
    assert exc.value.payload["code"] == "ai_admin_only"
    assert courses.queries == [] and model.calls == []


def test_a_question_about_everything_quotes_the_best_lessons_and_cites_them(tutor):
    uc, store, model, _ = tutor(json.dumps({"answer": "Theo [2]…", "sources": [2, 7]}))
    out = asyncio.run(uc.answer(ANON, question="  băm   nhất quán? "))
    prompt = _prompt(model)
    assert "[1] KHOÁ «Khoá K» — BÀI «Bài B»" in prompt and "[2] KHOÁ «Khoá K» — BÀI «Bài A»" in prompt
    assert "gone.md" not in prompt and "băm nhất quán?" in prompt, "a hit whose lesson is gone is skipped"
    assert out == {"found": True, "answer": "Theo [2]…", "cached": False, "sources": [
        {"id": "a.md", "slug": "bai/a", "title": "Bài A", "course": "k", "courseTitle": "Khoá K", "webapp": None}]}
    assert store.records[0][0] == "ask"


def test_a_question_nothing_in_the_courses_matches_costs_nothing(tutor):
    uc, _, model, _ = tutor()
    assert asyncio.run(uc.answer(ANON, question="không-có gì")) == {"found": False, "answer": "", "sources": [],
                                                                     "cached": False}
    assert model.calls == []
    with pytest.raises(BadRequestError):
        asyncio.run(uc.answer(ANON, question="   "))


def test_a_long_lesson_is_cut_and_says_so(tutor, monkeypatch):
    uc, _, model, courses = tutor(json.dumps({"answer": "x"}))
    monkeypatch.setattr(ai_course_usecase, "LESSON_CHARS", 50)
    courses.docs["a.md"] = courses.docs["a.md"].model_copy(update={"md": "x" * 49 + "ĐUÔI-KHÔNG-GỬI"})
    _run(uc, action="summary")
    assert "ĐUÔI-KHÔNG-GỬI" not in _prompt(model) and "trích phần đầu" in _prompt(model)
