import os
os.environ.setdefault("TESTING", "1")

from fastapi.testclient import TestClient
from src.main import app


def test_send_message_calls_usecase(monkeypatch):
    # monkeypatch the usecase in controller to avoid DB operations
    fake_result = {"user": {"id": 1, "content": "hi"}, "assistant": {"id": 2, "content": "reply"}}

    import src.adapter.controllers.conversation_controller as controller

    class FakeUsecase:
        def send_message(self, conversation_id, content, role="user"):
            assert conversation_id == "conv1"
            assert content == "hello"
            return fake_result

    monkeypatch.setattr(controller, "usecase", FakeUsecase())

    client = TestClient(app)
    r = client.post("/api/v1/conversations/conv1/messages", params={"content": "hello"})
    assert r.status_code == 200
    assert r.json() == fake_result
