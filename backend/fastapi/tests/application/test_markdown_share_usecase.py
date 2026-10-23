"""MarkdownShareUseCase: the rules of the markdown editor's read-only links (md-share §5.1).

Most tests run on the JSON store in `tmp_path` with a fake clock and memory counters; the
whole life of a link is then replayed on all three stores (MySQL on the suite's SQLite,
Mongo on `fake_mongo`).
"""

import os

os.environ.setdefault("TESTING", "1")

import itertools
import logging

import pytest
from sqlalchemy import text

from src.adapter.output.markdown_share import mongo_repository
from src.adapter.output.markdown_share.json_repository import JsonMarkdownShareRepository
from src.adapter.output.markdown_share.mongo_repository import MongoMarkdownShareRepository
from src.adapter.output.markdown_share.mysql_repository import MySqlMarkdownShareRepository
from src.application.exceptions.exceptions import AppException
from src.application.ports.output.markdown_share_repository_port import MarkdownShareConflict
from src.application.usecases.markdown_share_usecase import DAY_MS, SHARE_NOT_FOUND, MarkdownShareUseCase
from src.application.utils.rate_limiter import MemoryRateLimiter
from src.domain.vo.markdown_share_vo import MarkdownShareIn
from tests.conftest import arun
from tests.support import fake_mongo


class Clock:
    def __init__(self, now=1_700_000_000_000):
        self.now = now

    def __call__(self):
        return self.now


def tokens():
    counter = itertools.count(1)
    return lambda: f"token_{next(counter):016d}"


def make(tmp_path, *, repo=None, clock=None, max_shares=50, max_bytes=2_000_000, reads=None, misses=None, persistent=True):
    return MarkdownShareUseCase(
        repo or JsonMarkdownShareRepository(file_path=tmp_path / "shares.json"),
        clock=clock or Clock(), token_factory=tokens(), max_shares=max_shares, max_bytes=max_bytes,
        read_limiter=reads, miss_limiter=misses, persistent=persistent,
    )


def req(doc_id="doc-1", title="Ghi chú", content="# Xin chào\n\n$e^{i\\pi}+1=0$\n", days=None):
    return MarkdownShareIn(docId=doc_id, title=title, content=content, expiresInDays=days)


def code_of(call):
    with pytest.raises(AppException) as caught:
        arun(call)
    return caught.value


# ----------------------------------------------------------------- create
def test_create_returns_a_token_and_matching_dates(tmp_path):
    clock = Clock()
    created, out = arun(make(tmp_path, clock=clock).create_or_refresh(req()))
    assert created is True
    assert out["token"] == "token_0000000000000001"
    assert out["sharedAt"] == out["updatedAt"] == clock.now
    assert out["docId"] == "doc-1" and out["title"] == "Ghi chú" and out["mode"] == "snapshot"
    assert out["expiresAt"] is None
    assert out["bytes"] == len("# Xin chào\n\n$e^{i\\pi}+1=0$\n".encode("utf-8"))
    assert len(out["contentHash"]) == 64


def test_sharing_again_keeps_token_and_shared_at(tmp_path):
    clock = Clock()
    uc = make(tmp_path, clock=clock)

    async def scenario():
        _, first = await uc.create_or_refresh(req())
        clock.now += 5000
        created, second = await uc.create_or_refresh(req(title="Mới", content="khác"))
        return first, created, second

    first, created, second = arun(scenario())
    assert created is False
    assert second["token"] == first["token"] and second["sharedAt"] == first["sharedAt"]
    assert second["updatedAt"] == first["updatedAt"] + 5000
    assert second["title"] == "Mới" and second["contentHash"] != first["contentHash"]


def test_two_documents_get_two_tokens(tmp_path):
    uc = make(tmp_path)

    async def scenario():
        return (await uc.create_or_refresh(req("a")))[1]["token"], (await uc.create_or_refresh(req("b")))[1]["token"]

    first, second = arun(scenario())
    assert first != second


def test_the_size_limit_counts_utf8_bytes(tmp_path):
    uc = make(tmp_path, max_bytes=100)
    text_ = "ệ" * 40                                  # 40 characters, 120 bytes
    error = code_of(uc.create_or_refresh(req(content=text_)))
    assert error.status_code == 400
    assert error.payload == {"code": "markdown_share_too_large", "limit": 100, "bytes": 120}
    created, _ = arun(uc.create_or_refresh(req(content="x" * 100)))
    assert created


@pytest.mark.parametrize("title", ["   ", "a\u0007b", "line\nbreak"])
def test_a_blank_or_control_character_title_is_refused(tmp_path, title):
    error = code_of(make(tmp_path).create_or_refresh(req(title=title)))
    assert error.status_code == 400 and error.payload["code"] == "markdown_share_bad_input"


def test_the_title_is_trimmed(tmp_path):
    _, out = arun(make(tmp_path).create_or_refresh(req(title="  Báo cáo  ")))
    assert out["title"] == "Báo cáo"


def test_the_root_folder_cannot_be_shared(tmp_path):
    error = code_of(make(tmp_path).create_or_refresh(req("root")))
    assert error.status_code == 400 and error.payload["code"] == "markdown_share_bad_input"


def test_a_doc_id_with_a_newline_is_refused_even_past_the_vo(tmp_path):
    bad = MarkdownShareIn.model_construct(docId="a\nb", title="t", content="", expiresInDays=None, mode="snapshot")
    error = code_of(make(tmp_path).create_or_refresh(bad))
    assert error.status_code == 400 and error.payload["code"] == "markdown_share_bad_input"


def test_expiry_in_days(tmp_path):
    clock = Clock()
    _, out = arun(make(tmp_path, clock=clock).create_or_refresh(req(days=7)))
    assert out["expiresAt"] == clock.now + 7 * DAY_MS


# ------------------------------------------------------------------ quota
def test_the_51st_link_is_refused_but_refreshing_one_is_not(tmp_path):
    uc = make(tmp_path, max_shares=3)

    async def scenario():
        for name in ("a", "b", "c"):
            await uc.create_or_refresh(req(name))
        refreshed = await uc.create_or_refresh(req("b", content="new"))
        return refreshed

    created, _ = arun(scenario())
    assert created is False
    error = code_of(uc.create_or_refresh(req("d")))
    assert error.status_code == 400 and error.payload == {"code": "markdown_too_many_shares", "limit": 3}


def test_a_full_store_drops_expired_links_to_make_room(tmp_path):
    clock = Clock()
    uc = make(tmp_path, clock=clock, max_shares=2)

    async def scenario():
        await uc.create_or_refresh(req("old", days=1))
        await uc.create_or_refresh(req("keep"))
        clock.now += 2 * DAY_MS
        created, _ = await uc.create_or_refresh(req("new"))
        listed = await uc.list_shares()
        return created, sorted(entry["docId"] for entry in listed["shares"])

    assert arun(scenario()) == (True, ["keep", "new"])


# ------------------------------------------------------------------ list
def test_listing_is_newest_first_without_content(tmp_path):
    clock = Clock()
    uc = make(tmp_path, clock=clock, persistent=False)

    async def scenario():
        await uc.create_or_refresh(req("a", days=1))
        clock.now += 10
        await uc.create_or_refresh(req("b"))
        clock.now += 2 * DAY_MS
        return await uc.list_shares()

    out = arun(scenario())
    assert [entry["docId"] for entry in out["shares"]] == ["b", "a"]
    assert all("content" not in entry for entry in out["shares"])
    assert {entry["docId"]: entry["expired"] for entry in out["shares"]} == {"a": True, "b": False}
    assert all(entry["bytes"] > 0 and len(entry["contentHash"]) == 64 for entry in out["shares"])
    assert out["limits"] == {"maxShares": 50, "maxBytes": 2_000_000}
    assert out["persistent"] is False


# ---------------------------------------------------------------- revoke
def test_revoke_then_read_is_404_and_sharing_again_makes_a_new_token(tmp_path):
    uc = make(tmp_path)

    async def scenario():
        _, first = await uc.create_or_refresh(req())
        assert await uc.revoke("doc-1") == {"revoked": True}
        return first

    first = arun(scenario())
    assert code_of(uc.read_shared(first["token"])).status_code == 404
    assert code_of(uc.revoke("doc-1")).payload == {"code": "markdown_share_not_found"}
    _, again = arun(uc.create_or_refresh(req()))
    assert again["token"] != first["token"]
    assert code_of(uc.read_shared(first["token"])).status_code == 404
    assert arun(uc.read_shared(again["token"]))["title"] == "Ghi chú"


def test_revoking_a_malformed_doc_id_is_a_plain_404(tmp_path):
    assert code_of(make(tmp_path).revoke("../x")).status_code == 404


# ------------------------------------------------------------------ read
def test_the_public_read_returns_exactly_six_keys(tmp_path):
    uc = make(tmp_path)
    _, out = arun(uc.create_or_refresh(req()))
    shown = arun(uc.read_shared(out["token"], ip="1.1.1.1"))
    assert set(shown) == {"title", "content", "mode", "sharedAt", "updatedAt", "expiresAt"}
    assert shown["content"].startswith("# Xin chào")


def test_every_bad_token_gets_the_same_answer(tmp_path):
    clock = Clock()
    uc = make(tmp_path, clock=clock)

    async def scenario():
        _, revoked = await uc.create_or_refresh(req("gone"))
        await uc.revoke("gone")
        _, expiring = await uc.create_or_refresh(req("soon", days=1))
        clock.now += DAY_MS
        return revoked["token"], expiring["token"]

    revoked, expired = arun(scenario())
    answers = set()
    for token in ["token_9999999999999999", "../x", "a" * 101, "", revoked, expired]:
        error = code_of(uc.read_shared(token))
        answers.add((error.status_code, error.message, tuple(sorted(error.payload.items()))))
    assert answers == {(404, SHARE_NOT_FOUND, (("code", "markdown_share_not_found"),))}


def test_reads_are_limited_per_address(tmp_path):
    uc = make(tmp_path, reads=MemoryRateLimiter(3, 60), misses=MemoryRateLimiter(20, 600))
    _, out = arun(uc.create_or_refresh(req()))
    for _ in range(3):
        arun(uc.read_shared(out["token"], ip="2.2.2.2"))
    error = code_of(uc.read_shared(out["token"], ip="2.2.2.2"))
    assert error.status_code == 429 and error.payload["code"] == "markdown_rate_limited"
    assert error.payload["retryAfter"] >= 1 and error.headers["Retry-After"] == str(error.payload["retryAfter"])
    assert arun(uc.read_shared(out["token"], ip="3.3.3.3"))["title"]


def test_twenty_wrong_tokens_lock_out_even_the_right_one(tmp_path):
    uc = make(tmp_path, reads=MemoryRateLimiter(1000, 60), misses=MemoryRateLimiter(20, 600))
    _, out = arun(uc.create_or_refresh(req()))
    for _ in range(10):
        arun(uc.read_shared(out["token"], ip="4.4.4.4"))         # right tokens are never counted as wrong
    for _ in range(20):
        assert code_of(uc.read_shared("token_0000000000000999", ip="4.4.4.4")).status_code == 404
    error = code_of(uc.read_shared(out["token"], ip="4.4.4.4"))
    assert error.status_code == 429 and "sai quá nhiều" in error.message


def test_nothing_is_logged_with_a_token_or_the_content(tmp_path, caplog):
    caplog.set_level(logging.DEBUG)
    uc = make(tmp_path, reads=MemoryRateLimiter(1000, 60), misses=MemoryRateLimiter(1000, 600))
    secret = "Bí mật tuyệt đối 42"

    async def scenario():
        _, out = await uc.create_or_refresh(req(content=secret))
        await uc.read_shared(out["token"], ip="5.5.5.5")
        try:
            await uc.read_shared("token_0000000000000999", ip="5.5.5.5")
        except AppException:
            pass
        await uc.list_shares()
        await uc.revoke("doc-1")
        return out["token"]

    token = arun(scenario())
    assert token not in caplog.text and secret not in caplog.text


# ------------------------------------------------------ all three stores
class _FreshSql(MySqlMarkdownShareRepository):
    async def _session(self):
        fresh = not self._ready
        session = await super()._session()
        if fresh:
            await session.execute(text("DELETE FROM markdown_shares"))
            await session.commit()
        return session


@pytest.mark.parametrize("store", ["json", "sql", "mongo"])
def test_the_whole_life_of_a_link_on_every_store(tmp_path, monkeypatch, store):
    if store == "mongo":
        fake_mongo.install(monkeypatch, mongo_repository)
    repo = {
        "json": lambda: JsonMarkdownShareRepository(file_path=tmp_path / "s.json"),
        "sql": _FreshSql,
        "mongo": MongoMarkdownShareRepository,
    }[store]()
    clock = Clock()
    uc = make(tmp_path, repo=repo, clock=clock)

    async def scenario():
        created, first = await uc.create_or_refresh(req(content="v1"))
        assert created and (await uc.read_shared(first["token"]))["content"] == "v1"
        clock.now += 1000
        created, second = await uc.create_or_refresh(req(content="v2", days=30))
        assert not created and second["token"] == first["token"]
        shown = await uc.read_shared(first["token"])
        assert shown["content"] == "v2" and shown["expiresAt"] == clock.now + 30 * DAY_MS
        listed = await uc.list_shares()
        assert [entry["docId"] for entry in listed["shares"]] == ["doc-1"]
        await uc.revoke("doc-1")
        try:
            await uc.read_shared(first["token"])
        except AppException as error:
            return error.status_code
        return 200

    assert arun(scenario()) == 404


# ------------------------------------------------- M3V: errors, expiry, conflicts
SECRET_TOKEN = "SecretTokenValue0123456789"
DRIVER_MESSAGE = (
    "(pymysql.err.OperationalError) (2013, 'Lost connection to MySQL server during query') "
    f"[SQL: SELECT token, doc_id FROM markdown_shares WHERE token = %s] [parameters: ('{SECRET_TOKEN}',)]"
)


class _BrokenStore(JsonMarkdownShareRepository):
    """A store that drops the connection in the middle of a read, the way MySQL/Aiven does."""

    def __init__(self, tmp_path, error):
        super().__init__(file_path=tmp_path / "broken.json")
        self._error = error

    async def get(self, token):
        raise self._error


def test_a_store_failure_on_the_public_read_is_a_generic_error_without_the_token(tmp_path, caplog):
    caplog.set_level(logging.DEBUG)
    uc = make(tmp_path, repo=_BrokenStore(tmp_path, RuntimeError(DRIVER_MESSAGE)))
    error = code_of(uc.read_shared(SECRET_TOKEN, ip="6.6.6.6"))
    assert error.status_code == 503
    assert error.payload == {"code": "markdown_share_unavailable"}
    assert SECRET_TOKEN not in error.message and "parameters" not in error.message and "SELECT" not in error.message
    assert SECRET_TOKEN not in caplog.text and "parameters" not in caplog.text, "nothing of the driver's message is logged"
    assert error.__cause__ is None and error.__suppress_context__, "the traceback does not chain the driver's error"


def test_a_failing_store_is_not_counted_as_a_wrong_token(tmp_path):
    misses = MemoryRateLimiter(1, 600)
    uc = make(tmp_path, repo=_BrokenStore(tmp_path, RuntimeError(DRIVER_MESSAGE)), misses=misses, reads=MemoryRateLimiter(1000, 60))
    for _ in range(3):
        assert code_of(uc.read_shared(SECRET_TOKEN, ip="6.6.6.7")).status_code == 503


def test_refreshing_an_expired_link_issues_a_new_token(tmp_path):
    clock = Clock()
    uc = make(tmp_path, clock=clock, max_shares=1)

    async def scenario():
        _, first = await uc.create_or_refresh(req(days=1, content="v1"))
        clock.now += 2 * DAY_MS
        created, second = await uc.create_or_refresh(req(content="v2"))
        listed = await uc.list_shares()
        return first, created, second, listed

    first, created, second, listed = arun(scenario())
    assert created is True, "an expired link is gone: what the owner gets is a new one"
    assert second["token"] != first["token"]
    assert second["sharedAt"] == second["updatedAt"] == clock.now and second["expiresAt"] is None
    assert [entry["token"] for entry in listed["shares"]] == [second["token"]], "one link per document, quota unchanged"
    assert code_of(uc.read_shared(first["token"])).status_code == 404, "whoever kept the old link learns nothing new"
    assert arun(uc.read_shared(second["token"]))["content"] == "v2"


def test_refreshing_a_link_that_has_not_expired_still_keeps_the_token(tmp_path):
    clock = Clock()
    uc = make(tmp_path, clock=clock)

    async def scenario():
        _, first = await uc.create_or_refresh(req(days=7))
        clock.now += 7 * DAY_MS - 1
        created, second = await uc.create_or_refresh(req(days=30, content="v2"))
        return first, created, second

    first, created, second = arun(scenario())
    assert created is False and second["token"] == first["token"] and second["sharedAt"] == first["sharedAt"]


@pytest.mark.parametrize("store", ["json", "sql", "mongo"])
def test_an_expired_link_gets_a_new_token_on_every_store(tmp_path, monkeypatch, store):
    if store == "mongo":
        fake_mongo.install(monkeypatch, mongo_repository)
    repo = {
        "json": lambda: JsonMarkdownShareRepository(file_path=tmp_path / "s.json"),
        "sql": _FreshSql,
        "mongo": MongoMarkdownShareRepository,
    }[store]()
    clock = Clock()
    uc = make(tmp_path, repo=repo, clock=clock)

    async def scenario():
        _, first = await uc.create_or_refresh(req(days=1))
        clock.now += DAY_MS
        created, second = await uc.create_or_refresh(req(content="again"))
        return first["token"], created, second["token"], (await uc.read_shared(second["token"]))["content"], await repo.count()

    old, created, new, content, count = arun(scenario())
    assert created and new != old and content == "again" and count == 1


class _ConflictingStore(JsonMarkdownShareRepository):
    async def save(self, record):
        raise MarkdownShareConflict("markdown_shares.doc_id (Doc-A vs doc-a) [parameters: ('x',)]")


def test_a_slot_held_by_another_document_is_a_409_with_a_code(tmp_path, caplog):
    caplog.set_level(logging.DEBUG)
    uc = make(tmp_path, repo=_ConflictingStore(file_path=tmp_path / "c.json"))
    error = code_of(uc.create_or_refresh(req("Doc-A")))
    assert error.status_code == 409
    assert error.payload == {"code": "markdown_share_conflict"}
    assert "parameters" not in error.message and "markdown_shares" not in error.message
    assert error.__cause__ is None and error.__suppress_context__
