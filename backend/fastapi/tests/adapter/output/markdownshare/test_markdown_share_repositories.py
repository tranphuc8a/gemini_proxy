"""The three stores of markdown share links must behave identically.

JSON is exercised on `tmp_path`; MySQL runs its portable SQL against the SQLite engine
the suite falls back to (the table is created at run time, as on a real deployment -
never against a real database); Mongo runs against `tests.support.fake_mongo`. One
contract over all three: a client switching backend must not notice.
"""

import os

os.environ.setdefault("TESTING", "1")

import json

import pytest
from sqlalchemy import text

from src.adapter.output.markdown_share import mongo_repository
from src.adapter.output.markdown_share.json_repository import JsonMarkdownShareRepository
from src.adapter.output.markdown_share.mongo_repository import MongoMarkdownShareRepository
from src.adapter.output.markdown_share.mysql_repository import MySqlMarkdownShareRepository
from src.adapter.output.mysql.db.base import get_async_session
from src.application.ports.output.markdown_share_repository_port import MarkdownShareConflict
from src.domain.vo.markdown_share_vo import MarkdownShareRecord, MarkdownShareSummary
from tests.conftest import arun
from tests.support import fake_mongo


def json_repo(tmp_path):
    return JsonMarkdownShareRepository(file_path=tmp_path / "markdown-shares.json")


class _FreshSql(MySqlMarkdownShareRepository):
    """The suite's SQLite file is shared by every test: start each test with an empty table."""

    async def _session(self):
        fresh = not self._ready
        session = await super()._session()
        if fresh:
            await session.execute(text("DELETE FROM markdown_shares"))
            await session.commit()
        return session


def sql_repo(_tmp_path):
    return _FreshSql()


def mongo_repo(_tmp_path):
    return MongoMarkdownShareRepository()


REPOS = [pytest.param(json_repo, id="json"), pytest.param(sql_repo, id="sql"), pytest.param(mongo_repo, id="mongo")]


@pytest.fixture(autouse=True)
def fake_db(monkeypatch):
    return fake_mongo.install(monkeypatch, mongo_repository)


def record(doc_id="doc-1", token="tok_aaaaaaaaaaaaaaaaaaa", shared=1000, updated=None, content="# Xin chào\n", expires=None, title="Ghi chú"):
    return MarkdownShareRecord(
        token=token, doc_id=doc_id, title=title, mode="snapshot", shared_at=shared,
        updated_at=updated if updated is not None else shared, expires_at=expires,
        bytes=len(content.encode("utf-8")), content_hash="h" * 64, content=content,
    )


@pytest.mark.parametrize("factory", REPOS)
def test_save_then_read_back_by_token_and_by_doc(factory, tmp_path):
    async def scenario():
        repo = factory(tmp_path)
        saved = await repo.save(record())
        return saved, await repo.get("tok_aaaaaaaaaaaaaaaaaaa"), await repo.get_by_doc("doc-1"), await repo.get("nope_xxxxxxxxxxxxxxxx")

    saved, by_token, by_doc, missing = arun(scenario())
    assert isinstance(saved, MarkdownShareSummary) and saved.token == "tok_aaaaaaaaaaaaaaaaaaa"
    assert by_token.content == "# Xin chào\n" and by_token.title == "Ghi chú" and by_token.expires_at is None
    assert by_doc.token == saved.token and not hasattr(by_doc, "content")
    assert missing is None


@pytest.mark.parametrize("factory", REPOS)
def test_refreshing_keeps_token_and_shared_at(factory, tmp_path):
    async def scenario():
        repo = factory(tmp_path)
        await repo.save(record(shared=1000))
        again = await repo.save(record(token="other_token_xxxxxxxxxx", shared=5000, updated=5000, content="new", title="Mới", expires=99))
        return again, await repo.get("tok_aaaaaaaaaaaaaaaaaaa"), await repo.get("other_token_xxxxxxxxxx"), await repo.count()

    again, stored, ghost, count = arun(scenario())
    assert again.token == "tok_aaaaaaaaaaaaaaaaaaa" and again.shared_at == 1000 and again.updated_at == 5000
    assert stored.content == "new" and stored.title == "Mới" and stored.expires_at == 99 and stored.bytes == 3
    assert ghost is None and count == 1


@pytest.mark.parametrize("factory", REPOS)
def test_listing_is_newest_first_and_never_carries_content(factory, tmp_path):
    async def scenario():
        repo = factory(tmp_path)
        await repo.save(record("b", "tok_bbbbbbbbbbbbbbbbbbb", shared=2000))
        await repo.save(record("a", "tok_ccccccccccccccccccc", shared=2000))
        await repo.save(record("c", "tok_ddddddddddddddddddd", shared=3000))
        return await repo.list()

    rows = arun(scenario())
    assert [row.doc_id for row in rows] == ["c", "a", "b"]
    assert all(type(row) is MarkdownShareSummary for row in rows)


@pytest.mark.parametrize("factory", REPOS)
def test_delete_by_doc(factory, tmp_path):
    async def scenario():
        repo = factory(tmp_path)
        await repo.save(record())
        first = await repo.delete_by_doc("doc-1")
        second = await repo.delete_by_doc("doc-1")
        return first, second, await repo.get("tok_aaaaaaaaaaaaaaaaaaa"), await repo.count()

    assert arun(scenario()) == (True, False, None, 0)


@pytest.mark.parametrize("factory", REPOS)
def test_purge_expired_drops_only_expired_links(factory, tmp_path):
    async def scenario():
        repo = factory(tmp_path)
        await repo.save(record("old", "tok_eeeeeeeeeeeeeeeeeee", expires=500))
        await repo.save(record("now", "tok_fffffffffffffffffff", expires=1000))
        await repo.save(record("later", "tok_ggggggggggggggggggg", expires=5000))
        await repo.save(record("never", "tok_hhhhhhhhhhhhhhhhhhh"))
        purged = await repo.purge_expired(1000)
        return purged, sorted(row.doc_id for row in await repo.list())

    assert arun(scenario()) == (2, ["later", "never"])


@pytest.mark.parametrize("factory", REPOS)
def test_ids_and_tokens_match_exactly(factory, tmp_path):
    async def scenario():
        repo = factory(tmp_path)
        await repo.save(record("Doc-A", "Tok_AAAAAAAAAAAAAAAAAAA"))
        return await repo.get_by_doc("doc-a"), await repo.get("tok_aaaaaaaaaaaaaaaaaaa"), await repo.delete_by_doc("DOC-A")

    assert arun(scenario()) == (None, None, False)


def test_sql_insert_race_is_retried_as_an_update(monkeypatch):
    """Two first shares of one document at once: our UPDATE matched nothing, the other request
    inserted, so our INSERT hits the unique key. It is rolled back and decided again (an
    UPDATE this time): one row, the first token kept, the newer snapshot stored."""
    import sqlalchemy.ext.asyncio as sa_async
    from src.adapter.output.markdown_share import mysql_repository as module

    real_execute = sa_async.AsyncSession.execute
    state = {"skipped": 0}

    class _NoRows:
        rowcount = 0

    async def execute(self, statement, *args, **kwargs):
        if statement is module.UPDATE_SHARE and not state["skipped"]:
            state["skipped"] += 1
            return _NoRows()
        return await real_execute(self, statement, *args, **kwargs)

    async def scenario():
        repo = sql_repo(None)
        await repo.save(record(token="tok_first_xxxxxxxxxxxx", content="first"))
        monkeypatch.setattr(sa_async.AsyncSession, "execute", execute)
        try:
            saved = await repo.save(record(token="tok_second_xxxxxxxxxxx", content="second", updated=9000))
        finally:
            monkeypatch.setattr(sa_async.AsyncSession, "execute", real_execute)
        return saved, await repo.get("tok_first_xxxxxxxxxxxx"), await repo.count()

    saved, stored, count = arun(scenario())
    assert state["skipped"] == 1
    assert saved.token == "tok_first_xxxxxxxxxxxx" and count == 1
    assert stored.content == "second" and stored.updated_at == 9000


@pytest.fixture
def nocase_table(monkeypatch):
    """The table as MySQL's default collation makes it: `doc_id` (and its UNIQUE key) ignore case.

    The suite's SQLite file is shared, so the ordinary table is dropped before and after."""
    from src.adapter.output.markdown_share import mysql_repository as module

    nocase = module.CREATE_SHARES.replace("doc_id VARCHAR(255) NOT NULL,", "doc_id VARCHAR(255) NOT NULL COLLATE NOCASE,")
    assert nocase != module.CREATE_SHARES

    async def drop():
        session = get_async_session()
        try:
            await session.execute(text("DROP TABLE IF EXISTS markdown_shares"))
            await session.commit()
        finally:
            await session.close()

    arun(drop())
    monkeypatch.setattr(module, "CREATE_SHARES", nocase)
    yield
    arun(drop())


def test_sql_ids_that_differ_only_in_case_are_a_conflict_not_an_overwrite(nocase_table):
    """MySQL's collation makes `Doc-A` and `doc-a` one key: the second save must be refused (the use case answers
    409 `markdown_share_conflict`), leave the first link as it was, and not leak an IntegrityError (a bare 500)."""

    async def scenario():
        repo = sql_repo(None)
        await repo.save(record("doc-a", "tok_aaaaaaaaaaaaaaaaaaa", content="A"))
        with pytest.raises(MarkdownShareConflict) as caught:
            await repo.save(record("DOC-A", "tok_bbbbbbbbbbbbbbbbbbb", content="B", title="Other"))
        refreshed = await repo.save(record("doc-a", "tok_zzzzzzzzzzzzzzzzzzz", content="A2", updated=7))
        return caught.value, await repo.get("tok_aaaaaaaaaaaaaaaaaaa"), await repo.get("tok_bbbbbbbbbbbbbbbbbbb"), refreshed, await repo.count()

    error, first, second, refreshed, count = arun(scenario())
    assert "parameters" not in str(error) and "INSERT" not in str(error)
    assert first.doc_id == "doc-a" and first.title == "Ghi chú" and first.content == "A2", "only its own refresh changed it"
    assert second is None and count == 1
    assert refreshed.token == "tok_aaaaaaaaaaaaaaaaaaa" and refreshed.updated_at == 7


# ----------------------------------------------------------- json specifics
def test_json_file_survives_a_restart_and_uses_the_documented_shape(tmp_path):
    path = tmp_path / "markdown-shares.json"

    async def scenario():
        await JsonMarkdownShareRepository(file_path=path).save(record(expires=7))
        return await JsonMarkdownShareRepository(file_path=path).get("tok_aaaaaaaaaaaaaaaaaaa")

    again = arun(scenario())
    assert again.doc_id == "doc-1" and again.expires_at == 7
    raw = json.loads(path.read_text(encoding="utf-8"))
    assert raw["version"] == 1
    entry = raw["shares"]["tok_aaaaaaaaaaaaaaaaaaa"]
    assert set(entry) == {"docId", "title", "mode", "sharedAt", "updatedAt", "expiresAt", "bytes", "contentHash", "content"}
    assert not list(tmp_path.glob("*.tmp")), "the temporary file is moved into place"


def test_json_corrupt_file_is_set_aside_and_the_store_starts_empty(tmp_path):
    path = tmp_path / "markdown-shares.json"
    path.write_text("{not json", encoding="utf-8")
    repo = JsonMarkdownShareRepository(file_path=path)
    assert arun(repo.count()) == 0
    assert (tmp_path / "markdown-shares.json.corrupt").exists()
    arun(repo.save(record()))
    assert arun(JsonMarkdownShareRepository(file_path=path).count()) == 1


def test_json_failed_write_leaves_memory_as_it_was(tmp_path, monkeypatch):
    repo = JsonMarkdownShareRepository(file_path=tmp_path / "markdown-shares.json")
    arun(repo.save(record()))

    def boom(*_args, **_kwargs):
        raise OSError("disk full")

    monkeypatch.setattr(repo, "_flush_unlocked", boom)
    with pytest.raises(OSError):
        arun(repo.save(record("doc-2", "tok_zzzzzzzzzzzzzzzzzzz")))
    with pytest.raises(OSError):
        arun(repo.delete_by_doc("doc-1"))
    assert arun(repo.count()) == 1 and arun(repo.get_by_doc("doc-1")) is not None


def test_mongo_creates_a_unique_index_on_doc_id(fake_db):
    arun(MongoMarkdownShareRepository().count())
    assert ["doc_id"] in fake_db["markdown_shares"].unique_indexes
