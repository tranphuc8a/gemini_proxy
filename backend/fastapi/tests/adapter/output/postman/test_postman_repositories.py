"""All three workspace storage backends must behave identically.

The JSON one is exercised directly; the SQL one runs against the in-memory
SQLite engine the test suite already falls back to, which is why every statement
in `MySqlPostmanRepository` sticks to portable SQL; the Mongo one runs against
`tests.support.fake_mongo`, so its own paging, trimming and serialisation code
executes rather than a mock of it.

Parametrising one suite over all three is the point: a client that switches
backend must not have to care which one it got.
"""

import os

os.environ.setdefault("TESTING", "1")

import re

import pytest

from src.adapter.output.postman import mongo_repository
from src.adapter.output.postman.json_repository import JsonPostmanRepository
from src.adapter.output.postman.mongo_repository import MongoPostmanRepository
from src.adapter.output.postman.mysql_repository import MySqlPostmanRepository
from src.domain.vo.postman_vo import HistoryEntry, WorkspaceRecord
from tests.conftest import arun
from tests.support import fake_mongo


@pytest.fixture
def ws_id(request):
    """A workspace id unique to this test.

    The suite's SQLite fallback is a single in-memory database shared by every
    test, and these tables are raw SQL so conftest's drop_all never touches
    them. Unique ids keep the SQL cases independent without a teardown hook.
    """
    return "ws_" + re.sub(r"[^A-Za-z0-9]", "_", request.node.name)


def make_record(workspace_id, **overrides):
    base = dict(
        id=workspace_id,
        name="Team",
        key_hash="hash",
        revision=1,
        created_at="2026-09-13T00:00:00+00:00",
        updated_at="2026-09-13T00:00:00+00:00",
        collections=[{"id": "c1", "name": "Auth"}],
        requests=[{"id": "r1", "name": "Login"}],
        environments=[{"name": "Local", "vars": {"A": "1"}}],
    )
    base.update(overrides)
    return WorkspaceRecord(**base)


def json_repo(tmp_path):
    return JsonPostmanRepository(file_path=tmp_path / "ws.json")


def sql_repo(_tmp_path):
    return MySqlPostmanRepository()


def mongo_repo(_tmp_path):
    return MongoPostmanRepository()


REPOS = [
    pytest.param(json_repo, id="json"),
    pytest.param(sql_repo, id="sql"),
    pytest.param(mongo_repo, id="mongo"),
]


@pytest.fixture(autouse=True)
def _mongo(monkeypatch):
    """A fresh in-memory database per test, for the mongo parametrisation."""
    return fake_mongo.install(monkeypatch, mongo_repository)


@pytest.mark.parametrize("factory", REPOS)
def test_create_and_read_back_every_document(factory, tmp_path, ws_id):
    async def scenario():
        repo = factory(tmp_path)
        await repo.create(make_record(ws_id))
        return await repo.get(ws_id)

    loaded = arun(scenario())
    assert loaded is not None
    assert loaded.collections == [{"id": "c1", "name": "Auth"}]
    assert loaded.environments[0]["vars"] == {"A": "1"}


@pytest.mark.parametrize("factory", REPOS)
def test_missing_workspace_reads_as_none(factory, tmp_path):
    async def scenario():
        return await factory(tmp_path).get("ws_absent")

    assert arun(scenario()) is None


@pytest.mark.parametrize("factory", REPOS)
def test_save_overwrites_the_stored_document(factory, tmp_path, ws_id):
    async def scenario():
        repo = factory(tmp_path)
        await repo.create(make_record(ws_id))
        record = await repo.get(ws_id)
        record.revision = 2
        record.requests = [{"id": "r2"}]
        await repo.save(record)
        return await repo.get(ws_id)

    reloaded = arun(scenario())
    assert reloaded.revision == 2
    assert reloaded.requests == [{"id": "r2"}]


@pytest.mark.parametrize("factory", REPOS)
def test_share_token_lookup(factory, tmp_path, ws_id):
    async def scenario():
        repo = factory(tmp_path)
        await repo.create(make_record(ws_id, share_token="tok-" + ws_id))
        found = await repo.find_by_share_token("tok-" + ws_id)
        missing = await repo.find_by_share_token("tok-nope")
        return found, missing

    found, missing = arun(scenario())
    assert found.id == ws_id
    assert missing is None


@pytest.mark.parametrize("factory", REPOS)
def test_delete_removes_workspace_and_history(factory, tmp_path, ws_id):
    async def scenario():
        repo = factory(tmp_path)
        await repo.create(make_record(ws_id))
        await repo.append_history(ws_id, HistoryEntry(id=f"{ws_id}-h1", timestamp="2026-01-01", url="u"), 10)
        deleted = await repo.delete(ws_id)
        page, total = await repo.list_history(ws_id, 10)
        return deleted, await repo.get(ws_id), page, total

    deleted, record, page, total = arun(scenario())
    assert deleted is True
    assert record is None
    assert page == [] and total == 0


@pytest.mark.parametrize("factory", REPOS)
def test_history_is_newest_first_and_trimmed_to_the_cap(factory, tmp_path, ws_id):
    async def scenario():
        repo = factory(tmp_path)
        await repo.create(make_record(ws_id))
        for i in range(6):
            await repo.append_history(
                ws_id,
                HistoryEntry(id=f"{ws_id}-h{i}", timestamp=f"2026-01-0{i + 1}T00:00:00", url=f"https://a.dev/{i}"),
                3,
            )
        return await repo.list_history(ws_id, 10)

    page, total = arun(scenario())
    assert total == 3
    assert [e.url for e in page] == ["https://a.dev/5", "https://a.dev/4", "https://a.dev/3"]


@pytest.mark.parametrize("factory", REPOS)
def test_history_paging(factory, tmp_path, ws_id):
    async def scenario():
        repo = factory(tmp_path)
        await repo.create(make_record(ws_id))
        for i in range(5):
            await repo.append_history(
                ws_id, HistoryEntry(id=f"{ws_id}-h{i}", timestamp=f"2026-01-0{i + 1}T00:00:00", url=str(i)), 50
            )
        return await repo.list_history(ws_id, limit=2, offset=2)

    page, total = arun(scenario())
    assert total == 5
    assert [e.url for e in page] == ["2", "1"]


@pytest.mark.parametrize("factory", REPOS)
def test_clear_history_reports_how_many_it_removed(factory, tmp_path, ws_id):
    async def scenario():
        repo = factory(tmp_path)
        await repo.create(make_record(ws_id))
        for i in range(3):
            await repo.append_history(ws_id, HistoryEntry(id=f"{ws_id}-h{i}", timestamp=f"2026-01-0{i + 1}", url="u"), 50)
        return await repo.clear_history(ws_id)

    assert arun(scenario()) == 3


def test_json_store_survives_a_corrupt_file(tmp_path, ws_id):
    path = tmp_path / "ws.json"
    path.write_text("{ this is not json", encoding="utf-8")

    async def scenario():
        repo = JsonPostmanRepository(file_path=path)
        # Starting empty beats refusing to boot; the bad file is kept alongside.
        await repo.create(make_record(ws_id))
        return await repo.get(ws_id)

    assert arun(scenario()) is not None
    assert (tmp_path / "ws.json.corrupt").exists()


def test_json_store_reloads_from_disk_in_a_new_process(tmp_path, ws_id):
    async def write():
        await JsonPostmanRepository(file_path=tmp_path / "ws.json").create(make_record(ws_id))

    async def read():
        return await JsonPostmanRepository(file_path=tmp_path / "ws.json").get(ws_id)

    arun(write())
    reloaded = arun(read())
    assert reloaded.name == "Team"


def test_json_get_returns_a_copy_so_a_failed_save_cannot_corrupt_memory(tmp_path, ws_id):
    async def scenario():
        repo = JsonPostmanRepository(file_path=tmp_path / "ws.json")
        await repo.create(make_record(ws_id))
        borrowed = await repo.get(ws_id)
        borrowed.requests.append({"id": "not-saved"})
        return await repo.get(ws_id)

    assert arun(scenario()).requests == [{"id": "r1", "name": "Login"}]
