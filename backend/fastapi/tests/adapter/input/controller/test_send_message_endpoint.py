"""The wire format of the Gemini endpoints.

The streaming endpoint is the browser's only channel for reporting that an answer
failed — a StreamingResponse has already committed its 200 by the time anything
goes wrong — so the frame shapes here are a contract, not an implementation
detail.
"""

from typing import AsyncIterator, List

import pytest
from fastapi.testclient import TestClient

from src.adapter.factory.service_factory import ServiceFactory
from src.application.config.config import settings
from src.application.ports.input.gemini_input_port import GeminiInputPort
from src.domain.vo.message_request import MessageRequest
from src.domain.vo.stream_event import StreamEvent
from src.main import app

GEMINI = f"{settings.API_PREFIX}/gemini"


class StubGemini(GeminiInputPort):
    """Emits a scripted sequence of frames and records what it was asked."""

    def __init__(self, events: List[StreamEvent], answer: str = "full answer"):
        self.events = events
        self.answer = answer
        self.seen: List[MessageRequest] = []

    async def query(self, message_request: MessageRequest) -> str:
        self.seen.append(message_request)
        return self.answer

    async def query_stream(self, message_request: MessageRequest) -> AsyncIterator[StreamEvent]:
        self.seen.append(message_request)
        for event in self.events:
            yield event


@pytest.fixture
def stub():
    holder = {}

    def _install(gemini: StubGemini) -> TestClient:
        holder["gemini"] = gemini
        app.dependency_overrides[ServiceFactory.get_gemini_input_port] = lambda: gemini
        return TestClient(app)

    yield _install
    app.dependency_overrides.clear()


def _body(content: str = "hello", conversation_id: str = "conv1", model: str = "gemini-2.5-flash"):
    return {"conversation_id": conversation_id, "content": content, "model": model}


def _frames(text: str) -> List[str]:
    return [frame for frame in text.split("\n\n") if frame.strip()]


def test_query_returns_the_answer_in_the_standard_envelope(stub):
    gemini = StubGemini([], answer="42")
    client = stub(gemini)

    r = client.post(f"{GEMINI}/query", json=_body(content="the meaning of life?"))

    assert r.status_code == 200
    assert r.json() == {"status_code": 200, "message": "ok", "data": "42"}
    assert gemini.seen[0].content == "the meaning of life?"


def test_query_rejects_an_empty_message(stub):
    client = stub(StubGemini([]))
    r = client.post(f"{GEMINI}/query", json=_body(content=""))
    assert r.status_code == 422


def test_stream_sends_deltas_then_a_done_event(stub):
    gemini = StubGemini(
        [
            StreamEvent.delta("Hel"),
            StreamEvent.delta("lo!"),
            StreamEvent.done(conversation_id="conv1", user_message_id="u1", message_id="m1"),
        ]
    )
    client = stub(gemini)

    r = client.post(f"{GEMINI}/stream", json=_body())

    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/event-stream")
    frames = _frames(r.text)
    assert frames[0] == 'data: "Hel"'
    assert frames[1] == 'data: "lo!"'
    assert frames[2].startswith("event: done\ndata: ")
    assert '"message_id": "m1"' in frames[2]


def test_stream_reports_a_failure_as_a_terminal_error_event(stub):
    """Regression: a failed answer used to look exactly like a short one."""
    gemini = StubGemini([StreamEvent.delta("partial"), StreamEvent.error("upstream exploded")])
    client = stub(gemini)

    r = client.post(f"{GEMINI}/stream", json=_body())

    assert r.status_code == 200
    frames = _frames(r.text)
    assert frames[0] == 'data: "partial"'
    assert frames[-1] == 'event: error\ndata: {"message": "upstream exploded"}'


def test_stream_turns_an_unguarded_crash_into_an_error_event(stub):
    class Exploding(StubGemini):
        async def query_stream(self, message_request):
            yield StreamEvent.delta("before")
            raise RuntimeError("boom")

    client = stub(Exploding([]))

    r = client.post(f"{GEMINI}/stream", json=_body())

    frames = _frames(r.text)
    assert frames[0] == 'data: "before"'
    assert frames[-1].startswith("event: error")
    assert "boom" in frames[-1]


def test_stream_preserves_non_ascii_text(stub):
    gemini = StubGemini([StreamEvent.delta("Xin chào"), StreamEvent.done()])
    client = stub(gemini)

    r = client.post(f"{GEMINI}/stream", json=_body())

    assert 'data: "Xin chào"' in r.text


def test_stream_disables_proxy_buffering(stub):
    """Without these headers an intermediary can hold the whole answer back."""
    client = stub(StubGemini([StreamEvent.done()]))

    r = client.post(f"{GEMINI}/stream", json=_body())

    assert r.headers["cache-control"] == "no-cache, no-transform"
    assert r.headers["x-accel-buffering"] == "no"
