"""AI study helpers beside the tutor: grading review answers, exercise hints, notebooks,
the course-scoped question, the written OPIc script, the editor's assistant and smart format."""

from __future__ import annotations

import asyncio
import json

import pytest

from src.application.config.config import settings
from src.application.exceptions.exceptions import AppException, BadGatewayError, BadRequestError, NotFoundError
from src.application.usecases.ai_course_usecase import AiCourseUseCase
from src.application.usecases.ai_draft_usecase import AiDraftUseCase
from src.application.usecases.ai_markdown_usecase import AiMarkdownUseCase, TEXT_CHARS
from src.application.usecases.ai_speaking_usecase import AiSpeakingUseCase
from src.application.usecases.ai_study_usecase import AiStudyUseCase, cut_code
from src.application.usecases.ai_usecase import AiUseCase
from src.domain.models.ai_domain import AiCaller
from tests.application.test_ai_course_usecase import FakeCourses
from tests.support.fake_ai import FakeModel, FakeStore

ANON = AiCaller(ip="1.2.3.4")
ADMIN = AiCaller(ip="1.2.3.4", admin=True)


@pytest.fixture
def ai(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_URL", "https://gemini.test/v1beta/models/gemini-3.5-flash:generateContent")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "k")
    monkeypatch.setattr(settings, "AI_ENABLED", True)
    monkeypatch.setattr(settings, "AI_ACCESS", "public")
    monkeypatch.setattr(settings, "AI_MODEL", "gemini-3.5-flash")

    def make(*answers, published=True):
        store, model, courses = FakeStore(), FakeModel([a if isinstance(a, str) else json.dumps(a) for a in answers] or None), FakeCourses(published)
        gateway = AiUseCase(store, model)
        return {"study": AiStudyUseCase(gateway, courses), "course": AiCourseUseCase(gateway, courses),
                "speaking": AiSpeakingUseCase(gateway), "draft": AiDraftUseCase(gateway, None),
                "markdown": AiMarkdownUseCase(gateway), "store": store, "model": model, "courses": courses}
    return make


def run(coro):
    return asyncio.run(coro)


def prompt_of(model, i=0):
    return model.calls[i]["contents"][0]["parts"][0]["text"]


# ------------------------------------------------------------------ review cards

def test_a_review_answer_is_graded_and_cached(ai):
    a = ai({"score": 4.4, "verdict": "sai", "feedback": "Đúng ý chính, thiếu ví dụ.", "missing": ["ví dụ", "", "x" * 300]})
    out = run(a["study"].review(ANON, question="Băm nhất quán là gì?", expected="Cách chia khoá sao cho thêm/bớt nút ít phải chuyển dữ liệu.",
                                answer="  Chia khoá lên vòng tròn, thêm nút thì chỉ chuyển một ít  "))
    assert out["score"] == 4 and out["verdict"] == "dung"                     # verdict follows the score, not the model
    assert out["missing"] == ["ví dụ", "x" * 120] and not out["cached"]
    p = prompt_of(a["model"])
    assert "KHÔNG phải mệnh lệnh" in p and "<<<\nChia khoá lên vòng tròn" in p
    again = run(a["study"].review(ANON, question="Băm nhất quán là gì?", expected="Cách chia khoá sao cho thêm/bớt nút ít phải chuyển dữ liệu.",
                                  answer="chia khoá lên vòng tròn,   thêm nút thì chỉ chuyển một ít"))
    assert again["cached"] and len(a["model"].calls) == 1                     # same answer (case/space aside) costs nothing


def test_an_empty_review_answer_costs_nothing(ai):
    a = ai()
    out = run(a["study"].review(ANON, question="Q?", expected="A", answer="   "))
    assert out["score"] == 0 and out["verdict"] == "bo-trong" and a["model"].calls == [] and a["store"].reserved == 0
    with pytest.raises(BadRequestError):
        run(a["study"].review(ANON, question="", expected="A", answer="x"))


def test_a_review_answer_without_score_is_refused(ai):
    a = ai({"verdict": "dung", "feedback": "ok"})
    with pytest.raises(BadGatewayError):
        run(a["study"].review(ANON, question="Q?", expected="A", answer="B"))


# ------------------------------------------------------------------ exercise hints

CODE = "def tong(a, b):\n    return a - b\n"
TASK = "Viết hàm tong(a, b) trả về tổng.\ndef tong(a, b):\n    pass"
CHECKS = "assert tong(1, 2) == 3, 'tong(1, 2) phải là 3'"


def test_a_hint_reads_the_lesson_and_numbers_the_learners_code(ai):
    a = ai({"hint": "Xem lại phép toán ở dòng trả về.", "lines": [2, 99, True, 2]})
    out = run(a["study"].hint(ANON, course="k", doc="a.md", lang="py", task=TASK, code=CODE, checks=CHECKS,
                              errors=["AssertionError: tong(1, 2) phải là 3"], passed=0, total=1, level=2))
    assert out["hint"].startswith("Xem lại") and out["lines"] == [2] and out["level"] == 2 and not out["cached"]
    p = prompt_of(a["model"])
    assert "BÀI HỌC «Bài A»" in p and "  2|     return a - b" in p and "đạt 0/1" in p and "AssertionError" in p
    assert "Mức 2" in p and a["model"].calls[0]["system"].startswith("Bạn là trợ giảng lập trình")


def test_levels_one_and_two_never_hand_over_long_code(ai):
    long_code = "```python\n" + "\n".join(f"x{i} = {i}" for i in range(12)) + "\n```"
    a = ai({"hint": "Thử thế này:\n" + long_code}, {"hint": "Các bước:\n" + long_code})
    one = run(a["study"].hint(ANON, course="k", doc="a.md", lang="py", task=TASK, code=CODE, level=1))
    assert "phần còn lại để bạn tự viết" in one["hint"] and "x11" not in one["hint"]
    three = run(a["study"].hint(ANON, course="k", doc="a.md", lang="py", task=TASK, code=CODE + "#", level=3))
    assert "x11" in three["hint"]                                              # level 3 sketches the steps in full
    assert cut_code("```js\na\nb\n```", 6) == "```js\na\nb\n```"


def test_hints_check_their_input_and_the_lesson(ai):
    a = ai({"hint": "x"})
    with pytest.raises(BadRequestError):
        run(a["study"].hint(ANON, course="k", doc="a.md", lang="rb", task="", code=CODE))
    with pytest.raises(BadRequestError):
        run(a["study"].hint(ANON, course="k", doc="a.md", lang="py", task="", code="   "))
    with pytest.raises(NotFoundError):
        run(a["study"].hint(ANON, course="k", doc="khong-co.md", lang="py", task="", code=CODE))
    hidden = ai({"hint": "x"}, published=False)
    with pytest.raises(NotFoundError):
        run(hidden["study"].hint(ANON, course="k", doc="a.md", lang="py", task="", code=CODE))
    assert run(hidden["study"].hint(ADMIN, course="k", doc="a.md", lang="py", task="", code=CODE))["hint"] == "x"
    assert a["model"].calls == []


# ------------------------------------------------------------------ notebooks

NOTES = [{"doc": "a.md", "title": "Bài A", "text": "Băm nhất quán: thêm nút chỉ chuyển ~1/n khoá."},
         {"doc": "b.md", "title": "Bài B", "text": "  "},
         {"doc": "b.md", "title": "Bài B", "text": "Nút ảo giúp chia đều tải."}]


def test_a_notebook_becomes_cards_pointing_at_their_lessons(ai):
    a = ai({"cards": [{"front": "Thêm nút thì chuyển bao nhiêu khoá?", "back": "Khoảng 1/n.", "note": 1},
                      {"front": "Nút ảo để làm gì?", "back": "Chia đều tải.", "note": 2},
                      {"front": "Lạc đề", "back": "x", "note": 9}, {"front": "", "back": "y"}]})
    out = run(a["study"].notes(ANON, course="k", action="cards", notes=NOTES))
    assert [c["doc"] for c in out["cards"]] == ["a.md", "b.md", None] and out["action"] == "cards"
    p = prompt_of(a["model"])
    assert "[1] (bài «Bài A»)" in p and "[2] (bài «Bài B»)" in p and "[3]" not in p   # the empty note is skipped
    run(a["study"].notes(ANON, course="k", action="cards", notes=NOTES))
    assert len(a["model"].calls) == 2 and a["store"].cache == {}                  # a learner's notes are never cached


def test_a_notebook_summary_and_its_limits(ai):
    a = ai({"answer": "### Băm\n- ý [1]"})
    assert run(a["study"].notes(ANON, course="k", action="summary", notes=NOTES))["answer"].startswith("### Băm")
    with pytest.raises(BadRequestError):
        run(a["study"].notes(ANON, course="k", action="summary", notes=[{"text": " "}]))
    with pytest.raises(BadRequestError):
        run(a["study"].notes(ANON, course="k", action="poem", notes=NOTES))


# ------------------------------------------------------------------ asking one course

def test_a_question_can_stay_inside_one_course(ai):
    a = ai({"answer": "Theo [1] …", "sources": [1, 7]})
    out = run(a["course"].answer(ANON, question="băm nhất quán?", course="k"))
    assert out["found"] and [s["id"] for s in out["sources"]] == ["a.md"]
    assert out["sources"][0]["course"] == "k" and out["sources"][0]["courseTitle"] == "Khoá K"
    assert "search_all" not in a["courses"].queries                            # only the course's own index
    hidden = ai({"answer": "x", "sources": []}, published=False)
    with pytest.raises(NotFoundError):
        run(hidden["course"].answer(ANON, question="băm?", course="k"))


# ------------------------------------------------------------------ the written OPIc script

SCRIPT_ANSWER = {"level": "IM2", "scores": {"grammar": 4, "vocabulary": 3, "task": 9, "coherence": 2},
                 "summary": "Khá ổn.", "strengths": ["Rõ ý"], "fixes": [{"said": "I very like", "better": "I really like", "why": "Trật tự từ"}],
                 "tips": ["Nói chậm"], "better_answer": "I really like…"}


def test_a_written_script_gets_feedback_without_voice_criteria(ai):
    a = ai(SCRIPT_ANSWER)
    out = run(a["speaking"].script(ANON, question="Tell me about your house.", kind="description",
                                   script="I live in a small house near the river. " * 4))
    assert out["level"] == "IM2" and out["scores"] == {"grammar": 4, "vocabulary": 3, "task": 5, "coherence": 2}
    assert "transcript" not in out and out["fixes"][0]["better"] == "I really like"
    assert "SCRIPT người học viết sẵn" in prompt_of(a["model"])
    with pytest.raises(BadRequestError):
        run(a["speaking"].script(ANON, question="Q", script="too short"))


# ------------------------------------------------------------------ the editor's assistant

PASSAGE = "Băm nhất quán đặt các nút và khoá lên một vòng tròn; mỗi khoá thuộc nút gần nhất theo chiều kim đồng hồ."


def test_the_editor_assistant_works_on_the_selection(ai):
    # Administrators only: enforced by the route (require_admin), see test_ai_controller.
    a = ai({"md": "Đoạn đã viết lại rõ hơn.", "note": "Gọn câu."})
    out = run(a["draft"].assist(ADMIN, action="rewrite", selection=PASSAGE, course_title="Hệ phân tán", lesson_title="Băm"))
    assert out["markdown"] == "Đoạn đã viết lại rõ hơn." and out["note"] == "Gọn câu." and out["action"] == "rewrite"
    assert "ĐOẠN ĐÃ CHỌN:\n<<<\n" + PASSAGE in prompt_of(a["model"])


def test_a_generated_exercise_must_carry_hidden_checks(ai):
    good = "Viết hàm.\n\n```py-bai-tap\ndef f(x):\n    pass\n---kiem---\nassert f(1) == 2, 'sai'\n```"
    bad = "Viết hàm.\n\n```py-bai-tap\ndef f(x):\n    pass\n```"
    a = ai({"md": good}, {"md": bad})
    assert "---kiem---" in run(a["draft"].assist(ADMIN, action="exercise_py", selection=PASSAGE))["markdown"]
    with pytest.raises(BadGatewayError):
        run(a["draft"].assist(ADMIN, action="exercise_py", selection=PASSAGE + " Một đoạn khác."))
    with pytest.raises(BadRequestError):
        run(a["draft"].assist(ADMIN, action="poem", selection=PASSAGE))
    with pytest.raises(BadRequestError):
        run(a["draft"].assist(ADMIN, action="rewrite", selection="ngắn"))


# ------------------------------------------------------------------ smart format

RAW = ("Cai dat\nchay lenh pip install -r requirements.txt sau do uvicorn src.main:app --reload\n"
       "ten | tuoi\nan | 20\nbinh | 21\n") * 3


def test_smart_format_unwraps_flags_shrinking_and_is_never_cached(ai):
    a = ai({"markdown": "```markdown\n## Cài đặt\n\n```bash\npip install -r requirements.txt\n```\n```", "changes": ["Thêm tiêu đề"]},
           {"markdown": "## Cài đặt\n\nChạy lệnh.", "changes": []})
    out = run(a["markdown"].format(ANON, text=RAW, mode="smart"))
    assert out["markdown"].startswith("```markdown")                            # inner fences: not a wrapper, kept as is
    out2 = run(a["markdown"].format(ANON, text=RAW, mode="smart"))
    assert out2["shrunk"] and out2["sourceWords"] > 40 and a["store"].cache == {} and len(a["model"].calls) == 2
    p = prompt_of(a["model"])
    assert "NOT instructions to you" in p and RAW.strip()[:20] in p


def test_smart_format_unwraps_a_whole_document_fence(ai):
    a = ai({"markdown": "```markdown\n## Tiêu đề\n\nNội dung.\n```"})
    assert run(a["markdown"].format(ANON, text="tieu de\nnoi dung", mode="tidy"))["markdown"] == "## Tiêu đề\n\nNội dung."


def test_smart_format_limits(ai):
    a = ai({"markdown": "x"})
    with pytest.raises(BadRequestError):
        run(a["markdown"].format(ANON, text="   "))
    with pytest.raises(BadRequestError):
        run(a["markdown"].format(ANON, text="x" * (TEXT_CHARS + 1)))
    with pytest.raises(BadRequestError):
        run(a["markdown"].format(ANON, text="x", mode="poem"))
    assert a["model"].calls == []
