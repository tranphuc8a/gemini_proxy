"""Drafting a course with AI: what reaches the model, and what comes back."""

from __future__ import annotations

import asyncio
import base64
import json

import pytest

from src.application.config.config import settings
from src.application.exceptions.exceptions import BadGatewayError, BadRequestError
from src.application.ports.output.web_page_output_port import WebPage, WebPageOutputPort
from src.application.usecases import ai_draft_usecase
from src.application.usecases.ai_draft_usecase import AiDraftUseCase
from src.application.usecases.ai_usecase import AiUseCase
from src.domain.models.ai_domain import AiCaller
from tests.support.fake_ai import FakeModel, FakeStore

ADMIN = AiCaller(ip="1.2.3.4", admin=True)
PDF = b"%PDF-1.4 tai lieu"

OUTLINE = {
    "title": "  Nhập môn   Bloom filter ", "subtitle": "x" * 500, "description": "Mô tả.", "icon": "🌸🌸🌸🌸🌸🌸🌸🌸🌸",
    "parts": [
        {"title": "Nền tảng", "lessons": [
            {"title": "Bài một", "summary": "Hiểu băm", "points": ["a", "", "b"], "notes": "ghi chép 1"},
            {"title": "", "summary": "không tên — bỏ"},
            "không phải object"]},
        {"title": "Rỗng", "lessons": []},
    ],
}


class FakePages(WebPageOutputPort):
    def __init__(self, page: WebPage):
        self.page, self.asked = page, []

    async def fetch(self, url):
        self.asked.append(url)
        return self.page


@pytest.fixture
def draft(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_URL", "https://gemini.test/v1beta/models/gemini-2.5-flash:generateContent")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "k")
    monkeypatch.setattr(settings, "AI_ENABLED", True)
    monkeypatch.setattr(settings, "AI_ACCESS", "admin")

    def make(*answers, page=None):
        model = FakeModel(list(answers) or [json.dumps(OUTLINE)])
        pages = FakePages(page or WebPage(url="https://example.org/x", title="Trang", text="Nội dung trang web."))
        return AiDraftUseCase(AiUseCase(FakeStore(), model), pages), model, pages
    return make


def _parts(model, i=-1):
    return model.calls[i]["contents"][0]["parts"]


def test_an_outline_is_trimmed_to_shape(draft):
    uc, model, _ = draft()
    out = asyncio.run(uc.outline(ADMIN, topic="Bloom filter", lessons=6))
    o = out["outline"]
    assert o["title"] == "Nhập môn Bloom filter" and len(o["subtitle"]) == 160 and o["icon"] == "🌸" * 8
    assert [p["title"] for p in o["parts"]] == ["Nền tảng"], "a part left without lessons is dropped"
    assert o["parts"][0]["lessons"] == [{"title": "Bài một", "summary": "Hiểu băm", "points": ["a", "b"],
                                         "notes": "ghi chép 1"}]
    prompt = _parts(model)[0]["text"]
    assert "khoảng 6 bài" in prompt and "Bloom filter" in prompt and "người mới bắt đầu" in prompt
    assert model.calls[0]["config"]["responseSchema"] == ai_draft_usecase.OUTLINE_SCHEMA


def test_sources_reach_the_model_text_url_and_pdf(draft):
    uc, model, pages = draft()
    asyncio.run(uc.outline(ADMIN, text="Văn bản dán vào.", url="https://example.org/x",
                           pdf=base64.b64encode(PDF).decode()))
    parts = _parts(model)
    assert "Văn bản dán vào." in parts[0]["text"] and "Nội dung trang web." in parts[0]["text"]
    assert "[Trang web: Trang]" in parts[0]["text"] and "văn bản dưới đây và tệp PDF đính kèm" in parts[0]["text"]
    assert parts[1] == {"inlineData": {"mimeType": "application/pdf", "data": base64.b64encode(PDF).decode()}}
    assert pages.asked == ["https://example.org/x"]


def test_a_url_to_a_pdf_is_sent_as_the_pdf(draft):
    uc, model, _ = draft(page=WebPage(url="https://example.org/a.pdf", title="a.pdf", pdf=PDF))
    out = asyncio.run(uc.outline(ADMIN, url="https://example.org/a.pdf"))
    assert _parts(model)[1]["inlineData"]["data"] == base64.b64encode(PDF).decode()
    assert out["source"]["pdf"] is True and out["source"]["url"] == "https://example.org/a.pdf"
    with pytest.raises(BadRequestError):
        asyncio.run(uc.outline(ADMIN, url="https://example.org/a.pdf", pdf=base64.b64encode(PDF).decode()))


def test_long_source_text_is_cut_and_said_so(draft, monkeypatch):
    uc, model, _ = draft()
    monkeypatch.setattr(ai_draft_usecase, "SOURCE_CHARS", 30)
    out = asyncio.run(uc.outline(ADMIN, text="a" * 29 + "PHẦN-CUỐI-BỎ"))
    assert "PHẦN-CUỐI-BỎ" not in _parts(model)[0]["text"] and "đã cắt bớt" in _parts(model)[0]["text"]
    assert out["source"]["cut"] is True


@pytest.mark.parametrize("kw", [{}, {"topic": "   "}, {"topic": "x", "level": "sieu-cap"},
                                {"pdf": "không-phải-base64!"}, {"pdf": base64.b64encode(b"<html>").decode()}])
def test_bad_requests_cost_nothing(draft, kw):
    uc, model, _ = draft()
    with pytest.raises(BadRequestError):
        asyncio.run(uc.outline(ADMIN, **kw))
    assert model.calls == []


def test_an_outline_without_any_lesson_is_a_bad_gateway(draft):
    uc, _, _ = draft(json.dumps({"title": "T", "description": "", "parts": [{"title": "P", "lessons": []}]}))
    with pytest.raises(BadGatewayError):
        asyncio.run(uc.outline(ADMIN, topic="x"))


def test_a_lesson_is_written_from_its_plan_and_gets_its_heading(draft):
    uc, model, _ = draft(json.dumps({"md": "## Mục tiêu\n\n- hiểu Bloom filter và dương tính giả"}))
    out = asyncio.run(uc.lesson(ADMIN, course={"title": "Khoá B", "description": "Mô tả B"},
                                outline=["Bài một", "Bài hai"], part="Nền tảng",
                                lesson={"title": "Bài hai", "summary": "Tính kích thước", "points": ["m", "k"],
                                        "notes": "m = -n ln p / (ln 2)^2"}, level="nang-cao"))
    assert out["md"].startswith("# Bài hai\n\n## Mục tiêu")
    prompt = _parts(model)[0]["text"]
    assert "► Bài hai" in prompt and "  Bài một" in prompt and "m = -n ln p / (ln 2)^2" in prompt
    assert "«Khoá B»" in prompt and "đi sâu" in prompt and "- m\n- k" in prompt
    again = asyncio.run(uc.lesson(ADMIN, course={"title": "Khoá B", "description": "Mô tả B"},
                                  outline=["Bài một", "Bài hai"], part="Nền tảng",
                                  lesson={"title": "Bài hai", "summary": "Tính kích thước", "points": ["m", "k"],
                                          "notes": "m = -n ln p / (ln 2)^2"}, level="nang-cao"))
    assert again["cached"] is True and len(model.calls) == 1


def test_a_lesson_that_already_has_its_heading_is_kept(draft):
    uc, _, _ = draft(json.dumps({"md": "# Bài một\n\nNội dung đủ dài để không bị coi là rỗng nhé."}))
    out = asyncio.run(uc.lesson(ADMIN, course={"title": "K"}, outline=[], part="P", lesson={"title": "Bài một"}))
    assert out["md"].count("# Bài một") == 1


def test_drafting_is_for_administrators(draft):
    uc, model, _ = draft()
    from src.application.exceptions.exceptions import AppException
    with pytest.raises(AppException) as exc:
        asyncio.run(uc.outline(AiCaller(ip="9.9.9.9"), topic="x"))
    assert exc.value.payload["code"] == "ai_admin_only" and model.calls == []
