"""All three Code Studio storage backends must behave identically.

The JSON one is exercised directly; the SQL one runs against the SQLite engine the
suite already falls back to (which is why `MySqlCodestoreRepository` sticks to
portable SQL); the Mongo one runs against `tests.support.fake_mongo`, so its own
(de)serialisation and conditional-update code executes rather than a mock of it.

One suite over all three is the point: a client that switches backend must not have
to care which one it got. The part worth most is `upsert_newer` - last-writer-wins
done by the store, atomically - because each backend implements it differently (a
lock, a conditional `UPDATE`, a filtered `update_one`).
"""

import os

os.environ.setdefault("TESTING", "1")

import asyncio
import itertools
import json
import re

import pytest

from src.adapter.output.codestore import mongo_repository
from src.adapter.output.codestore.json_repository import JsonCodestoreRepository
from src.adapter.output.codestore.mongo_repository import MongoCodestoreRepository
from src.adapter.output.codestore.mysql_repository import MySqlCodestoreRepository
from src.domain.vo.codestore_vo import CodeFile, CodeItem, WorkspaceRecord, wins
from tests.conftest import arun
from tests.support import fake_mongo


@pytest.fixture
def ws(request):
    """A workspace id unique to this test.

    The suite's SQLite fallback is one database shared by every test, and these
    tables are raw SQL so conftest's drop_all never touches them. Unique ids keep
    the SQL cases independent without a teardown hook.
    """
    return "cs_" + re.sub(r"[^A-Za-z0-9]", "_", request.node.name)[:55]


def json_repo(tmp_path):
    return JsonCodestoreRepository(file_path=tmp_path / "codestore.json")


def sql_repo(_tmp_path):
    return MySqlCodestoreRepository()


def mongo_repo(_tmp_path):
    return MongoCodestoreRepository()


REPOS = [pytest.param(json_repo, id="json"), pytest.param(sql_repo, id="sql"), pytest.param(mongo_repo, id="mongo")]


@pytest.fixture(autouse=True)
def fake_db(monkeypatch):
    """A fresh in-memory MongoDB per test, for the mongo parametrisation."""
    return fake_mongo.install(monkeypatch, mongo_repository)


def record(workspace_id, key_hash="hash"):
    return WorkspaceRecord(id=workspace_id, key_hash=key_hash, created_at="2026-10-15T00:00:00+00:00")


def item(item_id="i1", updated=1000, server=1000, deleted=False, content="int main(){}", **overrides):
    values = dict(
        id=item_id, kind="snippet", name="Bài 1 — cơm trưa 🍜", language="cpp",
        files=[] if deleted else [CodeFile(path="main.cpp", content=content)],
        meta={}, updatedAt=updated, deleted=deleted, serverUpdatedAt=server,
    )
    values.update(overrides)
    return CodeItem(**values)


async def setup(factory, tmp_path, workspace_id):
    repo = factory(tmp_path)
    await repo.create_workspace(record(workspace_id))
    return repo


# ---------------------------------------------------------------------------
# workspaces
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("factory", REPOS)
def test_create_and_read_back_a_workspace(factory, tmp_path, ws):
    async def scenario():
        repo = factory(tmp_path)
        await repo.create_workspace(record(ws, key_hash="abc123"))
        return await repo.get_workspace(ws), await repo.get_workspace(ws + "_other")

    found, missing = arun(scenario())
    assert found == record(ws, key_hash="abc123")
    assert missing is None


@pytest.mark.parametrize("factory", REPOS)
def test_deleting_a_workspace_takes_its_records_and_only_its_records(factory, tmp_path, ws):
    async def scenario():
        repo = await setup(factory, tmp_path, ws)
        await repo.create_workspace(record(ws + "_b"))
        await repo.upsert_newer(ws, [item("a"), item("b")])
        await repo.upsert_newer(ws + "_b", [item("a", content="other")])
        first = await repo.delete_workspace(ws)
        again = await repo.delete_workspace(ws)
        return (first, again, await repo.get_workspace(ws), await repo.count_items(ws),
                await repo.get_items(ws + "_b", ["a"]), await repo.count_items(ws + "_b"))

    first, again, gone, count, other, other_count = arun(scenario())
    assert first is True and again is False and gone is None and count == 0
    assert other["a"].files[0].content == "other" and other_count == 1


@pytest.mark.parametrize("factory", REPOS)
def test_records_of_an_unknown_workspace_read_as_empty(factory, tmp_path, ws):
    async def scenario():
        repo = factory(tmp_path)
        return (await repo.count_items(ws), await repo.get_items(ws, ["x"]), await repo.list_since(ws, 0, 10),
                await repo.purge_tombstones(ws, 10**15))

    assert arun(scenario()) == (0, {}, [], 0)


# ---------------------------------------------------------------------------
# last-writer-wins, per record
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("factory", REPOS)
def test_a_new_record_is_stored_with_everything_intact(factory, tmp_path, ws):
    original = item("p1", updated=5, server=77, kind="project", language="python",
                    files=[CodeFile(path="src/main.py", content="print('xin chào')"), CodeFile(path="README.md", content="# x")],
                    meta={"$set": {"a.b": [1, 2, {"$gt": "x"}]}, "": "empty key", "emoji": "🍜"})

    async def scenario():
        repo = await setup(factory, tmp_path, ws)
        written = await repo.upsert_newer(ws, [original])
        return written, await repo.get_items(ws, ["p1"])

    written, held = arun(scenario())
    assert written == ["p1"] and held["p1"] == original


@pytest.mark.parametrize("factory", REPOS)
def test_the_later_updated_at_wins_and_the_earlier_is_ignored(factory, tmp_path, ws):
    async def scenario():
        repo = await setup(factory, tmp_path, ws)
        await repo.upsert_newer(ws, [item(updated=100, content="v100", server=1)])
        newer = await repo.upsert_newer(ws, [item(updated=200, content="v200", server=2)])
        older = await repo.upsert_newer(ws, [item(updated=150, content="v150", server=3)])
        return newer, older, (await repo.get_items(ws, ["i1"]))["i1"]

    newer, older, held = arun(scenario())
    assert newer == ["i1"] and older == []
    assert held.files[0].content == "v200" and held.updatedAt == 200 and held.serverUpdatedAt == 2


@pytest.mark.parametrize("factory", REPOS)
def test_the_same_record_pushed_twice_changes_nothing(factory, tmp_path, ws):
    async def scenario():
        repo = await setup(factory, tmp_path, ws)
        await repo.upsert_newer(ws, [item(updated=100, server=10)])
        again = await repo.upsert_newer(ws, [item(updated=100, server=99)])
        return again, (await repo.get_items(ws, ["i1"]))["i1"]

    again, held = arun(scenario())
    assert again == [] and held.serverUpdatedAt == 10               # not restamped: no spurious change for pollers


@pytest.mark.parametrize("factory", REPOS)
def test_on_a_tie_a_deletion_beats_an_edit_but_not_the_other_way_round(factory, tmp_path, ws):
    async def scenario():
        repo = await setup(factory, tmp_path, ws)
        await repo.upsert_newer(ws, [item("a", updated=100)])
        delete_wins = await repo.upsert_newer(ws, [item("a", updated=100, deleted=True, server=5)])
        edit_after = await repo.upsert_newer(ws, [item("a", updated=100, server=6)])

        await repo.upsert_newer(ws, [item("b", updated=100, deleted=True)])
        edit_vs_tombstone = await repo.upsert_newer(ws, [item("b", updated=100)])
        return delete_wins, edit_after, edit_vs_tombstone, await repo.get_items(ws, ["a", "b"])

    delete_wins, edit_after, edit_vs_tombstone, held = arun(scenario())
    assert delete_wins == ["a"] and edit_after == [] and edit_vs_tombstone == []
    assert held["a"].deleted and held["b"].deleted


@pytest.mark.parametrize("factory", REPOS)
def test_a_later_edit_brings_back_a_deleted_record_and_a_later_deletion_removes_it(factory, tmp_path, ws):
    async def scenario():
        repo = await setup(factory, tmp_path, ws)
        await repo.upsert_newer(ws, [item(updated=100, deleted=True)])
        revived = await repo.upsert_newer(ws, [item(updated=200, content="again")])
        removed = await repo.upsert_newer(ws, [item(updated=300, deleted=True)])
        stale_edit = await repo.upsert_newer(ws, [item(updated=250, content="stale")])
        return revived, removed, stale_edit, (await repo.get_items(ws, ["i1"]))["i1"]

    revived, removed, stale_edit, held = arun(scenario())
    assert revived == ["i1"] and removed == ["i1"] and stale_edit == []
    assert held.deleted and held.updatedAt == 300 and held.files == []


@pytest.mark.parametrize("factory", REPOS)
def test_a_batch_applies_each_record_on_its_own_merits(factory, tmp_path, ws):
    async def scenario():
        repo = await setup(factory, tmp_path, ws)
        await repo.upsert_newer(ws, [item("a", updated=500), item("b", updated=100)])
        written = await repo.upsert_newer(ws, [item("a", updated=400, server=2), item("b", updated=200, server=2),
                                               item("c", updated=1, server=2)])
        return written, await repo.get_items(ws, ["a", "b", "c"])

    written, held = arun(scenario())
    assert written == ["b", "c"]
    assert held["a"].updatedAt == 500 and held["b"].updatedAt == 200 and held["c"].updatedAt == 1


@pytest.mark.parametrize("factory", REPOS)
def test_the_same_id_in_two_workspaces_is_two_records(factory, tmp_path, ws):
    async def scenario():
        repo = await setup(factory, tmp_path, ws)
        await repo.create_workspace(record(ws + "_b"))
        await repo.upsert_newer(ws, [item("x", content="mine")])
        await repo.upsert_newer(ws + "_b", [item("x", content="theirs", updated=1)])
        return (await repo.get_items(ws, ["x"]))["x"], (await repo.get_items(ws + "_b", ["x"]))["x"]

    mine, theirs = arun(scenario())
    assert mine.files[0].content == "mine" and theirs.files[0].content == "theirs"


@pytest.mark.parametrize("factory", REPOS)
def test_concurrent_pushes_of_a_new_id_end_with_the_latest_whatever_the_order(factory, tmp_path, ws):
    """The race the atomic rule exists for: several devices push the same new id at once."""
    stamps = [100, 400, 250, 300, 50]

    async def scenario():
        repo = await setup(factory, tmp_path, ws)
        await asyncio.gather(*(
            repo.upsert_newer(ws, [item("race", updated=stamp, content=f"v{stamp}", server=stamp)]) for stamp in stamps
        ))
        return (await repo.get_items(ws, ["race"]))["race"], await repo.count_items(ws)

    held, count = arun(scenario())
    assert held.updatedAt == 400 and held.files[0].content == "v400" and count == 1


@pytest.mark.parametrize("factory", REPOS)
def test_concurrent_pushes_in_every_order_converge_to_the_same_record(factory, tmp_path, ws):
    stamps = [10, 30, 20]

    async def scenario():
        outcomes = []
        for number, order in enumerate(itertools.permutations(stamps)):
            repo = factory(tmp_path)
            workspace_id = f"{ws}_{number}"
            await repo.create_workspace(record(workspace_id))
            for stamp in order:
                await repo.upsert_newer(workspace_id, [item(updated=stamp, content=f"v{stamp}")])
            outcomes.append((await repo.get_items(workspace_id, ["i1"]))["i1"].files[0].content)
        return outcomes

    assert set(arun(scenario())) == {"v30"}


def test_the_rule_is_the_one_the_stores_implement():
    assert wins(2, False, 1, False) and not wins(1, False, 2, False)
    assert wins(1, True, 1, False) and not wins(1, False, 1, True) and not wins(1, True, 1, True)
    assert not wins(1, False, 1, False)
    assert wins(5, False, 1, True) and not wins(1, False, 5, True)


# ---------------------------------------------------------------------------
# reading
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("factory", REPOS)
def test_get_items_returns_only_those_that_exist(factory, tmp_path, ws):
    async def scenario():
        repo = await setup(factory, tmp_path, ws)
        await repo.upsert_newer(ws, [item("a"), item("b"), item("c")])
        return await repo.get_items(ws, ["a", "zzz", "c"]), await repo.get_items(ws, [])

    held, nothing = arun(scenario())
    assert sorted(held) == ["a", "c"] and nothing == {}


@pytest.mark.parametrize("factory", REPOS)
def test_list_since_is_strict_ordered_and_limited(factory, tmp_path, ws):
    async def scenario():
        repo = await setup(factory, tmp_path, ws)
        await repo.upsert_newer(ws, [item("c", server=30), item("a", server=10), item("b", server=20),
                                     item("d", server=20), item("e", server=40)])
        every = await repo.list_since(ws, 0, 100)
        after_20 = await repo.list_since(ws, 20, 100)
        first_two = await repo.list_since(ws, 0, 2)
        return every, after_20, first_two, await repo.list_since(ws, 40, 10)

    every, after_20, first_two, none_left = arun(scenario())
    assert [i.id for i in every] == ["a", "b", "d", "c", "e"]            # server stamp, ties by id
    assert [i.id for i in after_20] == ["c", "e"]                         # strictly after
    assert [i.id for i in first_two] == ["a", "b"] and none_left == []
    assert [i.serverUpdatedAt for i in every] == [10, 20, 20, 30, 40]


@pytest.mark.parametrize("factory", REPOS)
def test_list_since_includes_tombstones_so_other_devices_learn_of_deletions(factory, tmp_path, ws):
    async def scenario():
        repo = await setup(factory, tmp_path, ws)
        await repo.upsert_newer(ws, [item("gone", updated=5, deleted=True, server=9)])
        return await repo.list_since(ws, 0, 10)

    [tombstone] = arun(scenario())
    assert tombstone.deleted and tombstone.files == []


@pytest.mark.parametrize("factory", REPOS)
def test_count_includes_tombstones(factory, tmp_path, ws):
    async def scenario():
        repo = await setup(factory, tmp_path, ws)
        await repo.upsert_newer(ws, [item("a"), item("b", deleted=True), item("c")])
        return await repo.count_items(ws)

    assert arun(scenario()) == 3


@pytest.mark.parametrize("factory", REPOS)
def test_purge_removes_only_old_tombstones(factory, tmp_path, ws):
    async def scenario():
        repo = await setup(factory, tmp_path, ws)
        await repo.upsert_newer(ws, [
            item("old-gone", deleted=True, server=100), item("new-gone", deleted=True, server=900),
            item("old-live", server=100), item("edge-gone", deleted=True, server=500),
        ])
        purged = await repo.purge_tombstones(ws, 500)
        return purged, sorted((await repo.get_items(ws, ["old-gone", "new-gone", "old-live", "edge-gone"])))

    purged, remaining = arun(scenario())
    assert purged == 1 and remaining == ["edge-gone", "new-gone", "old-live"]       # strictly older than the cutoff


@pytest.mark.parametrize("factory", REPOS)
def test_half_a_megabyte_of_unicode_round_trips(factory, tmp_path, ws):
    content = ("xin chào — ế ữ 🍜 \\ \" ' \n\t" * 20_000)[:500_000]
    big = item("big", content=content, meta={"note": "ghi chú", "n": [1, 2.5, None, True]})

    async def scenario():
        repo = await setup(factory, tmp_path, ws)
        await repo.upsert_newer(ws, [big])
        return (await repo.get_items(ws, ["big"]))["big"]

    assert arun(scenario()) == big


# ---------------------------------------------------------------------------
# backend-specific facts
# ---------------------------------------------------------------------------
def test_json_store_survives_a_restart_and_keeps_only_the_key_hash(tmp_path):
    path = tmp_path / "store.json"

    async def first():
        repo = JsonCodestoreRepository(file_path=path)
        await repo.create_workspace(record("cs_persist", key_hash="digest-only"))
        await repo.upsert_newer("cs_persist", [item("a", content="keep me")])

    async def second():
        repo = JsonCodestoreRepository(file_path=path)
        return await repo.get_workspace("cs_persist"), (await repo.get_items("cs_persist", ["a"]))["a"]

    arun(first())
    workspace, held = arun(second())
    assert workspace.key_hash == "digest-only" and held.files[0].content == "keep me"
    assert json.loads(path.read_text(encoding="utf-8"))["version"] == 1


def test_json_store_with_a_corrupt_file_starts_empty_and_keeps_the_bad_file(tmp_path):
    path = tmp_path / "store.json"
    path.write_text("{ not json", encoding="utf-8")

    async def scenario():
        repo = JsonCodestoreRepository(file_path=path)
        return await repo.get_workspace("cs_x")

    assert arun(scenario()) is None
    assert (tmp_path / "store.json.corrupt").exists()


def test_json_store_failed_write_is_not_remembered_in_memory(tmp_path, monkeypatch):
    async def scenario():
        repo = JsonCodestoreRepository(file_path=tmp_path / "store.json")
        await repo.create_workspace(record("cs_disk"))

        def refuse(_self):
            raise OSError("disk full")

        monkeypatch.setattr(JsonCodestoreRepository, "_flush_unlocked", refuse)
        with pytest.raises(OSError):
            await repo.upsert_newer("cs_disk", [item("a")])
        return await repo.count_items("cs_disk")

    assert arun(scenario()) == 0


def test_mongo_stores_the_record_as_a_string_so_dollar_keys_are_safe(fake_db, tmp_path):
    async def scenario():
        repo = MongoCodestoreRepository()
        await repo.create_workspace(record("cs_m"))
        await repo.upsert_newer("cs_m", [item("a", meta={"$where": "1", "a.b": 2})])

    arun(scenario())
    [document] = fake_db["codestore_items"].documents.values()
    assert document["_id"] == "cs_m:a" and isinstance(document["payload_json"], str)
    assert set(document) == {"_id", "workspace_id", "item_id", "updated_at", "server_updated_at", "deleted",
                             "payload_json"}
    assert "$where" not in document and json.loads(document["payload_json"])["meta"] == {"$where": "1", "a.b": 2}
    assert fake_db["codestore_items"].indexes                     # the sync query has its index


def test_mongo_lost_insert_race_decides_again_instead_of_failing(fake_db):
    """A second writer inserted the id between our update attempt and our insert."""
    async def scenario():
        repo = MongoCodestoreRepository()
        await repo.create_workspace(record("cs_race"))
        collection = fake_db["codestore_items"]
        real_insert = collection.insert_one
        injected = {"done": False}

        async def insert_after_rival(document):
            if not injected["done"]:
                injected["done"] = True
                await real_insert({**document, "updated_at": 900,
                                   "payload_json": json.dumps(item("r", updated=900, content="rival").model_dump())})
            return await real_insert(document)          # raises: the rival is already there

        collection.insert_one = insert_after_rival
        written = await repo.upsert_newer("cs_race", [item("r", updated=500, content="ours")])
        collection.insert_one = real_insert
        return written, (await repo.get_items("cs_race", ["r"]))["r"]

    written, held = arun(scenario())
    assert written == [] and held.files[0].content == "rival"            # the rival is newer, so it stays


def test_sql_tables_are_created_on_demand():
    from sqlalchemy import text
    from src.adapter.output.mysql.db.base import get_async_session

    async def scenario():
        repo = MySqlCodestoreRepository()
        await repo.create_workspace(record("cs_sql_tables"))
        session = get_async_session()
        try:
            names = [row[0] for row in (await session.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'codestore_%'"))).fetchall()]
        finally:
            await session.close()
        return sorted(names)

    assert arun(scenario()) == ["codestore_items", "codestore_workspaces"]
