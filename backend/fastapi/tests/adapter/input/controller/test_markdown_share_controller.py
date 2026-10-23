"""`/markdown/shares` and `/markdown/shared` over HTTP (md-share §5.2), through the real
wiring: factory -> use case -> JSON repository on a temp file (Mongo on fake_mongo).
Nothing touches a real database."""

import os

os.environ.setdefault("TESTING", "1")

import logging

import pytest
from fastapi.testclient import TestClient

from src.adapter.factory import markdown_share_factory
from src.adapter.input.controllers import markdown_admin
from src.adapter.output.markdown_share import mongo_repository
from src.adapter.output.markdown_share.json_repository import JsonMarkdownShareRepository
from src.application.config.config import settings
from src.application.ports.output.markdown_share_repository_port import MarkdownShareConflict
from src.application.usecases.markdown_share_usecase import MarkdownShareUseCase
from src.main import app
from tests.support import fake_mongo

BASE = f"{settings.API_PREFIX}/markdown"
KEY = "share-test-admin-key"
ADMIN = {"X-Admin-Key": KEY}


@pytest.fixture(autouse=True)
def wiring(tmp_path, monkeypatch):
    markdown_share_factory.reset_for_tests()
    markdown_admin.reset_for_tests()
    monkeypatch.setenv("MARKDOWN_ADMIN_KEY", KEY)
    monkeypatch.setenv("MARKDOWN_JSON_FILE", str(tmp_path / "markdown-files.json"))
    monkeypatch.delenv("MARKDOWN_STORAGE_BACKEND", raising=False)
    monkeypatch.setattr(settings, "MARKDOWN_STORAGE_BACKEND", "json")
    monkeypatch.setattr(settings, "MARKDOWN_SHARES_JSON_FILE", str(tmp_path / "markdown-shares.json"))
    monkeypatch.setattr(settings, "MARKDOWN_SHARE_MAX_BYTES", 2_000_000)
    monkeypatch.setattr(settings, "MARKDOWN_SHARE_READS_PER_MIN", 120)
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()
    markdown_share_factory.reset_for_tests()
    markdown_admin.reset_for_tests()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def body(doc_id="file-abc-1-xyz", title="Ghi chú họp", content="# Họp\n\n$x^2$\n", **extra):
    return {"docId": doc_id, "title": title, "content": content, **extra}


def share(client, **kwargs):
    return client.post(f"{BASE}/shares", json=body(**kwargs), headers=ADMIN)


# ------------------------------------------------------------- permissions
@pytest.mark.parametrize("method,path", [("post", "/shares"), ("get", "/shares"), ("delete", "/shares?docId=x")])
def test_owner_routes_need_the_administrator(client, method, path):
    kwargs = {"json": body()} if method == "post" else {}
    response = getattr(client, method)(f"{BASE}{path}", **kwargs)
    assert response.status_code == 403
    assert response.json()["data"]["code"] == "markdown_admin_required"
    wrong = getattr(client, method)(f"{BASE}{path}", headers={"X-Admin-Key": "nope"}, **kwargs)
    assert wrong.status_code == 403 and wrong.json()["data"]["code"] == "markdown_admin_invalid"


def test_the_raw_key_and_a_session_both_work(client):
    assert share(client).status_code == 201
    session = client.post(f"{BASE}/admin/verify", headers=ADMIN).json()["session"]
    listed = client.get(f"{BASE}/shares", headers={"X-Admin-Session": session})
    assert listed.status_code == 200 and len(listed.json()["shares"]) == 1


# ------------------------------------------------------------------ create
def test_first_share_is_201_then_200_with_the_same_token(client):
    first = share(client)
    assert first.status_code == 201
    assert first.headers["cache-control"] == "no-store"
    out = first.json()
    assert set(out) == {"token", "docId", "title", "mode", "sharedAt", "updatedAt", "expiresAt", "bytes", "contentHash"}
    again = share(client, content="v2", expiresInDays=7)
    assert again.status_code == 200
    assert again.json()["token"] == out["token"] and again.json()["sharedAt"] == out["sharedAt"]
    assert again.json()["expiresAt"] is not None


def test_listing_has_limits_and_no_content(client):
    share(client)
    listed = client.get(f"{BASE}/shares", headers=ADMIN)
    assert listed.headers["cache-control"] == "no-store"
    data = listed.json()
    assert data["limits"] == {"maxShares": 50, "maxBytes": 2_000_000}
    assert isinstance(data["persistent"], bool)
    assert "content" not in data["shares"][0] and data["shares"][0]["expired"] is False


def test_validation(client, monkeypatch):
    assert share(client, title="t" * 201).status_code == 422
    assert share(client, doc_id="has space").status_code == 422
    assert share(client, expiresInDays=3).status_code == 422
    root = share(client, doc_id="root")
    assert root.status_code == 400 and root.json()["data"]["code"] == "markdown_share_bad_input"
    monkeypatch.setattr(settings, "MARKDOWN_SHARE_MAX_BYTES", 10)
    markdown_share_factory.reset_for_tests()
    big = share(client, content="0123456789A")
    assert big.status_code == 400
    assert big.json()["data"] == {"code": "markdown_share_too_large", "limit": 10, "bytes": 11}


def test_backend_choice(client, monkeypatch):
    bad = client.post(f"{BASE}/shares?backend=postgres", json=body(), headers=ADMIN)
    assert bad.status_code == 400 and bad.json()["data"]["code"] == "markdown_bad_backend"
    monkeypatch.setattr(markdown_share_factory.mongo_store, "is_configured", lambda: False)
    missing = client.post(f"{BASE}/shares?backend=mongo", json=body(), headers=ADMIN)
    assert missing.status_code == 503 and missing.json()["data"]["code"] == "markdown_backend_unavailable"


def test_mongo_backend_is_a_separate_store(client, monkeypatch):
    fake_mongo.install(monkeypatch, mongo_repository)
    monkeypatch.setattr(markdown_share_factory.mongo_store, "is_configured", lambda: True)
    created = client.post(f"{BASE}/shares?backend=mongo", json=body(), headers=ADMIN)
    assert created.status_code == 201
    token = created.json()["token"]
    assert client.get(f"{BASE}/shared?backend=mongo", headers={"X-Share-Token": token}).status_code == 200
    assert client.get(f"{BASE}/shared?backend=json", headers={"X-Share-Token": token}).status_code == 404


# -------------------------------------------------------------- public read
def test_anyone_with_the_token_reads_the_snapshot(client):
    token = share(client).json()["token"]
    shown = client.get(f"{BASE}/shared", headers={"X-Share-Token": token})
    assert shown.status_code == 200
    assert shown.json()["title"] == "Ghi chú họp" and shown.json()["content"].startswith("# Họp")
    assert set(shown.json()) == {"title", "content", "mode", "sharedAt", "updatedAt", "expiresAt"}
    assert shown.headers["cache-control"] == "no-store"
    assert "noindex" in shown.headers["x-robots-tag"]
    assert shown.headers["x-content-type-options"] == "nosniff"


def test_a_missing_or_malformed_token_is_404_not_422(client):
    for headers in ({}, {"X-Share-Token": "x"}, {"X-Share-Token": "a" * 300}, {"X-Share-Token": "../../etc"}):
        response = client.get(f"{BASE}/shared", headers=headers)
        assert response.status_code == 404, headers
        assert response.json()["data"]["code"] == "markdown_share_not_found"
        assert response.headers["cache-control"] == "no-store" and "noindex" in response.headers["x-robots-tag"]


def test_no_route_takes_the_token_in_the_path(client):
    token = share(client).json()["token"]
    assert client.get(f"{BASE}/shared/{token}").status_code in (404, 405)
    assert client.get(f"{BASE}/shared?token={token}").status_code == 404


def test_revoke_kills_the_link(client):
    token = share(client).json()["token"]
    revoked = client.delete(f"{BASE}/shares", params={"docId": "file-abc-1-xyz"}, headers=ADMIN)
    assert revoked.status_code == 200 and revoked.json() == {"revoked": True}
    assert client.get(f"{BASE}/shared", headers={"X-Share-Token": token}).status_code == 404
    again = client.delete(f"{BASE}/shares", params={"docId": "file-abc-1-xyz"}, headers=ADMIN)
    assert again.status_code == 404 and again.json()["data"]["code"] == "markdown_share_not_found"


def test_reading_too_fast_is_429_with_retry_after(client, monkeypatch):
    monkeypatch.setattr(settings, "MARKDOWN_SHARE_READS_PER_MIN", 2)
    markdown_share_factory.reset_for_tests()
    token = share(client).json()["token"]
    for _ in range(2):
        assert client.get(f"{BASE}/shared", headers={"X-Share-Token": token}).status_code == 200
    limited = client.get(f"{BASE}/shared", headers={"X-Share-Token": token})
    assert limited.status_code == 429
    assert limited.json()["data"]["code"] == "markdown_rate_limited"
    assert int(limited.headers["retry-after"]) >= 1


def test_wrong_tokens_are_limited_too(client):
    for _ in range(20):
        assert client.get(f"{BASE}/shared", headers={"X-Share-Token": "w" * 22}).status_code == 404
    assert client.get(f"{BASE}/shared", headers={"X-Share-Token": "w" * 22}).status_code == 429


def test_the_public_read_works_while_the_store_is_private(client, monkeypatch):
    monkeypatch.setenv("MARKDOWN_PUBLIC_READ", "false")
    token = share(client).json()["token"]
    assert client.get(f"{BASE}/files").status_code == 403
    assert client.get(f"{BASE}/shared", headers={"X-Share-Token": token}).status_code == 200


def test_the_other_markdown_routes_still_answer(client):
    assert client.get(f"{BASE}/backends").status_code == 200
    assert client.post(f"{BASE}/admin/verify", headers=ADMIN).status_code == 200
    assert client.get(f"{BASE}/files", headers=ADMIN).status_code == 200


# ------------------------------------------------------------------ M3V
SECRET_TOKEN = "SecretTokenValue0123456789"
DRIVER_MESSAGE = (
    "(pymysql.err.OperationalError) (2013, 'Lost connection to MySQL server during query') "
    f"[SQL: SELECT token FROM markdown_shares WHERE token = %s] [parameters: ('{SECRET_TOKEN}',)]"
)


class _ExplodingRepository(JsonMarkdownShareRepository):
    async def get(self, token):
        raise RuntimeError(DRIVER_MESSAGE)


class _ExplodingUseCase:
    """A use case that fails before it even reaches the store (a limiter, a bug): the route is the last line."""

    async def read_shared(self, token, ip=""):
        raise RuntimeError(DRIVER_MESSAGE)


def _use(uc):
    app.dependency_overrides[markdown_share_factory.get_markdown_share_input_port] = lambda: uc


def _assert_generic(response, caplog):
    assert response.status_code == 503
    assert response.json()["data"] == {"code": "markdown_share_unavailable"}
    assert SECRET_TOKEN not in response.text and "parameters" not in response.text and "SELECT" not in response.text
    assert SECRET_TOKEN not in caplog.text and "parameters" not in caplog.text, "nothing of the driver's message is logged"
    assert response.headers["cache-control"] == "no-store" and "noindex" in response.headers["x-robots-tag"]


def test_a_store_failure_on_the_public_read_is_a_generic_503_without_the_token(client, tmp_path, caplog):
    caplog.set_level(logging.DEBUG)
    _use(MarkdownShareUseCase(_ExplodingRepository(file_path=tmp_path / "x.json"), read_limiter=None, miss_limiter=None))
    _assert_generic(client.get(f"{BASE}/shared", headers={"X-Share-Token": SECRET_TOKEN}), caplog)


def test_anything_unexpected_on_the_public_read_is_the_same_generic_503(client, caplog):
    caplog.set_level(logging.DEBUG)
    _use(_ExplodingUseCase())
    _assert_generic(client.get(f"{BASE}/shared", headers={"X-Share-Token": SECRET_TOKEN}), caplog)


def test_a_slot_conflict_is_a_409_with_a_code(client, tmp_path):
    class _Conflicting(JsonMarkdownShareRepository):
        async def save(self, record):
            raise MarkdownShareConflict("markdown_shares.doc_id")

    _use(MarkdownShareUseCase(_Conflicting(file_path=tmp_path / "c.json")))
    response = share(client, doc_id="Doc-A")
    assert response.status_code == 409
    assert response.json()["data"] == {"code": "markdown_share_conflict"}


def test_refreshing_an_expired_link_over_http_is_a_new_link(client, tmp_path):
    clock = {"now": 1_700_000_000_000}
    _use(MarkdownShareUseCase(JsonMarkdownShareRepository(file_path=tmp_path / "e.json"), clock=lambda: clock["now"]))
    first = share(client, expiresInDays=1)
    token = first.json()["token"]
    clock["now"] = int(first.json()["expiresAt"]) + 1000
    again = share(client, content="v2")
    assert again.status_code == 201 and again.json()["token"] != token
    assert client.get(f"{BASE}/shared", headers={"X-Share-Token": token}).status_code == 404
    assert client.get(f"{BASE}/shared", headers={"X-Share-Token": again.json()["token"]}).json()["content"] == "v2"
