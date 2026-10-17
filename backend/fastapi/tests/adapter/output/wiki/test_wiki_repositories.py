"""All three Personal Wiki storage backends must behave identically.

The JSON one is exercised directly; the SQL one runs against the SQLite engine the
suite already falls back to (which is why `MySqlWikiRepository` sticks to portable
SQL); the Mongo one runs against `tests.support.fake_mongo`, so its own
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

from src.adapter.output.wiki import mongo_repository
from src.adapter.output.wiki.json_repository import JsonWikiRepository
from src.adapter.output.wiki.mongo_repository import MongoWikiRepository
from src.adapter.output.wiki.mysql_repository import (
    MySqlWikiRepository,
    create_items_sql,
    create_workspaces_sql,
)
from src.domain.vo.wiki_vo import Record, WorkspaceRecord, wins
from tests.conftest import arun
from tests.support import fake_mongo


@pytest.fixture
def ws(request):
    """A workspace id unique to this test.

    The suite's SQLite fallback is one database shared by every test, and these
    tables are raw SQL so conftest's drop_all never touches them. Unique ids keep
    the SQL cases independent without a teardown hook.
    """
    return "wk_" + re.sub(r"[^A-Za-z0-9]", "_", request.node.name)[:55]


def json_repo(tmp_path):
    return JsonWikiRepository(file_path=tmp_path / "wiki.json")


def sql_repo(_tmp_path):
    return MySqlWikiRepository()


def mongo_repo(_tmp_path):
    return MongoWikiRepository()


REPOS = [pytest.param(json_repo, id="json"), pytest.param(sql_repo, id="sql"), pytest.param(mongo_repo, id="mongo")]


@pytest.fixture(autouse=True)
def fake_db(monkeypatch):
    """A fresh in-memory MongoDB per test, for the mongo parametrisation."""
    return fake_mongo.install(monkeypatch, mongo_repository)


def record(workspace_id, key_hash="hash"):
    return WorkspaceRecord(id=workspace_id, key_hash=key_hash, created_at="2026-10-18T00:00:00+00:00")


def item(item_id="i1", updated=1000, server=1000, deleted=False, text="xin chào", **overrides):
    values = dict(
        id=item_id, kind="note", updatedAt=updated, deleted=deleted, serverUpdatedAt=server,
        data={} if deleted else {"title": "Bài 1 — cơm trưa 🍜", "body": text},
    )
    values.update(overrides)
    return Record(**values)


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
        await repo.upsert_newer(ws + "_b", [item("a", text="other")])
        first = await repo.delete_workspace(ws)
        again = await repo.delete_workspace(ws)
        return (first, again, await repo.get_workspace(ws), await repo.count_items(ws),
                await repo.get_items(ws + "_b", ["a"]), await repo.count_items(ws + "_b"))

    first, again, gone, count, other, other_count = arun(scenario())
    assert first is True and again is False and gone is None and count == 0
    assert other["a"].data["body"] == "other" and other_count == 1


@pytest.mark.parametrize("factory", REPOS)
def test_records_of_an_unknown_workspace_read_as_empty(factory, tmp_path, ws):
    async def scenario():
        repo = factory(tmp_path)
        return (await repo.count_items(ws), await repo.get_items(ws, ["x"]), await repo.list_since(ws, 0, 10),
                await repo.delete_old_tombstones(ws, 10**15), await repo.upsert_newer(ws, []))

    assert arun(scenario()) == (0, {}, [], 0, [])


# ---------------------------------------------------------------------------
# last-writer-wins, per record
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("factory", REPOS)
def test_a_new_record_is_stored_with_everything_intact(factory, tmp_path, ws):
    original = item("c1", updated=5, server=77, kind="card",
                    data={"$set": {"a.b": [1, 2, {"$gt": "x"}]}, "": "empty key", "emoji": "🍜", "n": [1, 2.5, None, True]})

    async def scenario():
        repo = await setup(factory, tmp_path, ws)
        written = await repo.upsert_newer(ws, [original])
        return written, await repo.get_items(ws, ["c1"]), await repo.list_since(ws, 0, 5)

    written, held, listed = arun(scenario())
    assert written == ["c1"] and held["c1"] == original and listed == [original]


@pytest.mark.parametrize("factory", REPOS)
def test_the_later_updated_at_wins_and_the_earlier_is_ignored(factory, tmp_path, ws):
    async def scenario():
        repo = await setup(factory, tmp_path, ws)
        await repo.upsert_newer(ws, [item(updated=100, text="v100", server=1)])
        newer = await repo.upsert_newer(ws, [item(updated=200, text="v200", server=2)])
        older = await repo.upsert_newer(ws, [item(updated=150, text="v150", server=3)])
        return newer, older, (await repo.get_items(ws, ["i1"]))["i1"]

    newer, older, held = arun(scenario())
    assert newer == ["i1"] and older == []
    assert held.data["body"] == "v200" and held.updatedAt == 200 and held.serverUpdatedAt == 2


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
        deletion_again = await repo.upsert_newer(ws, [item("a", updated=100, deleted=True, server=7)])

        await repo.upsert_newer(ws, [item("b", updated=100, deleted=True)])
        edit_vs_tombstone = await repo.upsert_newer(ws, [item("b", updated=100)])
        return delete_wins, edit_after, deletion_again, edit_vs_tombstone, await repo.get_items(ws, ["a", "b"])

    delete_wins, edit_after, deletion_again, edit_vs_tombstone, held = arun(scenario())
    assert delete_wins == ["a"] and edit_after == [] and deletion_again == [] and edit_vs_tombstone == []
    assert held["a"].deleted and held["b"].deleted and held["a"].serverUpdatedAt == 5 and held["a"].data == {}


@pytest.mark.parametrize("factory", REPOS)
def test_a_later_edit_brings_back_a_deleted_record_and_a_later_deletion_removes_it(factory, tmp_path, ws):
    async def scenario():
        repo = await setup(factory, tmp_path, ws)
        await repo.upsert_newer(ws, [item(updated=100, deleted=True)])
        revived = await repo.upsert_newer(ws, [item(updated=200, text="again")])
        removed = await repo.upsert_newer(ws, [item(updated=300, deleted=True)])
        stale_edit = await repo.upsert_newer(ws, [item(updated=250, text="stale")])
        return revived, removed, stale_edit, (await repo.get_items(ws, ["i1"]))["i1"]

    revived, removed, stale_edit, held = arun(scenario())
    assert revived == ["i1"] and removed == ["i1"] and stale_edit == []
    assert held.deleted and held.updatedAt == 300 and held.data == {}


@pytest.mark.parametrize("factory", REPOS)
def test_a_record_may_change_kind_when_a_newer_version_says_so(factory, tmp_path, ws):
    async def scenario():
        repo = await setup(factory, tmp_path, ws)
        await repo.upsert_newer(ws, [item(updated=100)])
        await repo.upsert_newer(ws, [item(updated=200, kind="card", data={"front": "f"})])
        return (await repo.get_items(ws, ["i1"]))["i1"]

    held = arun(scenario())
    assert held.kind == "card" and held.data == {"front": "f"}


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
        await repo.upsert_newer(ws, [item("x", text="mine")])
        await repo.upsert_newer(ws + "_b", [item("x", text="theirs", updated=1)])
        return (await repo.get_items(ws, ["x"]))["x"], (await repo.get_items(ws + "_b", ["x"]))["x"]

    mine, theirs = arun(scenario())
    assert mine.data["body"] == "mine" and theirs.data["body"] == "theirs"


@pytest.mark.parametrize("factory", REPOS)
def test_ids_that_differ_only_by_case_are_different_records(factory, tmp_path, ws):
    """MySQL's default collation would make `Ab` and `aB` one row; ids are case sensitive."""
    async def scenario():
        repo = await setup(factory, tmp_path, ws)
        await repo.upsert_newer(ws, [item("Ab", text="upper", server=1), item("aB", text="lower", server=2)])
        written = await repo.upsert_newer(ws, [item("AB", text="third", server=3)])
        return (written, await repo.get_items(ws, ["Ab", "aB", "AB"]), await repo.count_items(ws),
                await repo.get_items(ws, ["ab"]))

    written, held, count, none = arun(scenario())
    assert written == ["AB"] and count == 3 and none == {}
    assert {key: value.data["body"] for key, value in held.items()} == {"Ab": "upper", "aB": "lower", "AB": "third"}


@pytest.mark.parametrize("factory", REPOS)
def test_concurrent_pushes_of_a_new_id_end_with_the_latest_whatever_the_order(factory, tmp_path, ws):
    """The race the atomic rule exists for: several devices push the same new id at once."""
    stamps = [100, 400, 250, 300, 50]

    async def scenario():
        repo = await setup(factory, tmp_path, ws)
        await asyncio.gather(*(
            repo.upsert_newer(ws, [item("race", updated=stamp, text=f"v{stamp}", server=stamp)]) for stamp in stamps
        ))
        return (await repo.get_items(ws, ["race"]))["race"], await repo.count_items(ws)

    held, count = arun(scenario())
    assert held.updatedAt == 400 and held.data["body"] == "v400" and count == 1


@pytest.mark.parametrize("factory", REPOS)
def test_concurrent_pushes_of_edit_and_deletion_at_one_moment_end_deleted(factory, tmp_path, ws):
    async def scenario():
        repo = await setup(factory, tmp_path, ws)
        await asyncio.gather(
            repo.upsert_newer(ws, [item("t", updated=100, text="edit", server=1)]),
            repo.upsert_newer(ws, [item("t", updated=100, deleted=True, server=2)]),
            repo.upsert_newer(ws, [item("t", updated=100, text="edit again", server=3)]),
        )
        return (await repo.get_items(ws, ["t"]))["t"]

    held = arun(scenario())
    assert held.deleted is True and held.data == {}


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
                await repo.upsert_newer(workspace_id, [item(updated=stamp, text=f"v{stamp}")])
            outcomes.append((await repo.get_items(workspace_id, ["i1"]))["i1"].data["body"])
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
def test_get_items_copes_with_a_couple_of_hundred_ids(factory, tmp_path, ws):
    ids = [f"r{n:03d}" for n in range(200)]

    async def scenario():
        repo = await setup(factory, tmp_path, ws)
        await repo.upsert_newer(ws, [item(item_id, server=n + 1) for n, item_id in enumerate(ids)])
        return await repo.get_items(ws, ids + ["missing"])

    assert sorted(arun(scenario())) == ids


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
def test_list_since_pages_through_many_records_without_loss_or_repeat(factory, tmp_path, ws):
    async def scenario():
        repo = await setup(factory, tmp_path, ws)
        await repo.upsert_newer(ws, [item(f"r{n:04d}", server=1000 + n) for n in range(450)])
        seen, cursor = [], 0
        while True:
            page = await repo.list_since(ws, cursor, 100)
            if not page:
                return seen
            seen += [i.id for i in page]
            cursor = page[-1].serverUpdatedAt

    assert arun(scenario()) == [f"r{n:04d}" for n in range(450)]


@pytest.mark.parametrize("factory", REPOS)
def test_list_since_includes_tombstones_so_other_devices_learn_of_deletions(factory, tmp_path, ws):
    async def scenario():
        repo = await setup(factory, tmp_path, ws)
        await repo.upsert_newer(ws, [item("gone", updated=5, deleted=True, server=9)])
        return await repo.list_since(ws, 0, 10)

    [tombstone] = arun(scenario())
    assert tombstone.deleted and tombstone.data == {}


@pytest.mark.parametrize("factory", REPOS)
def test_list_since_only_reads_its_own_workspace(factory, tmp_path, ws):
    async def scenario():
        repo = await setup(factory, tmp_path, ws)
        await repo.create_workspace(record(ws + "_b"))
        await repo.upsert_newer(ws, [item("mine", server=5)])
        await repo.upsert_newer(ws + "_b", [item("theirs", server=6)])
        return await repo.list_since(ws, 0, 10), await repo.list_since(ws + "_b", 0, 10)

    mine, theirs = arun(scenario())
    assert [i.id for i in mine] == ["mine"] and [i.id for i in theirs] == ["theirs"]


@pytest.mark.parametrize("factory", REPOS)
def test_count_includes_tombstones(factory, tmp_path, ws):
    async def scenario():
        repo = await setup(factory, tmp_path, ws)
        await repo.upsert_newer(ws, [item("a"), item("b", deleted=True), item("c")])
        return await repo.count_items(ws)

    assert arun(scenario()) == 3


@pytest.mark.parametrize("factory", REPOS)
def test_old_tombstones_are_deleted_and_nothing_else(factory, tmp_path, ws):
    async def scenario():
        repo = await setup(factory, tmp_path, ws)
        await repo.upsert_newer(ws, [
            item("old-gone", deleted=True, server=100), item("new-gone", deleted=True, server=900),
            item("old-live", server=100), item("edge-gone", deleted=True, server=500),
        ])
        purged = await repo.delete_old_tombstones(ws, 500)
        return purged, sorted((await repo.get_items(ws, ["old-gone", "new-gone", "old-live", "edge-gone"])))

    purged, remaining = arun(scenario())
    assert purged == 1 and remaining == ["edge-gone", "new-gone", "old-live"]       # strictly older than the cutoff


# ---------------------------------------------------------------------------
# big records
# ---------------------------------------------------------------------------
def big_note(item_id="big"):
    """About 1.5 MB of JSON: 500,000 three-byte characters, awkward keys and escapes around them."""
    return item(item_id, updated=7, server=99, data={
        "title": "ghi chú dài", "body": "ế" * 500_000, "$where": {"a.b": ["\\ \" ' \n\t", "🍜"]},
        "cards": [{"front": "q", "back": "a"}] * 50,
    })


@pytest.mark.parametrize("factory", REPOS)
def test_a_record_of_one_and_a_half_megabytes_round_trips(factory, tmp_path, ws):
    big = big_note()
    assert len(json.dumps(big.data, ensure_ascii=False).encode("utf-8")) > 1_500_000

    async def scenario():
        repo = await setup(factory, tmp_path, ws)
        written = await repo.upsert_newer(ws, [big, item("small", server=100)])
        return (written, (await repo.get_items(ws, ["big"]))["big"], await repo.list_since(ws, 0, 10),
                await repo.upsert_newer(ws, [item("big", updated=6, server=200, text="older")]))

    written, held, listed, older = arun(scenario())
    assert written == ["big", "small"] and held == big and [i.id for i in listed] == ["big", "small"]
    assert listed[0] == big and older == []


@pytest.mark.parametrize("factory", REPOS)
def test_a_big_record_is_replaced_by_a_newer_small_one_and_back(factory, tmp_path, ws):
    async def scenario():
        repo = await setup(factory, tmp_path, ws)
        await repo.upsert_newer(ws, [big_note("n")])
        shrunk = await repo.upsert_newer(ws, [item("n", updated=8, server=100, text="short")])
        small = (await repo.get_items(ws, ["n"]))["n"]
        grown = await repo.upsert_newer(ws, [item("n", updated=9, server=101, data={"body": "ế" * 500_000})])
        return shrunk, small, grown, (await repo.get_items(ws, ["n"]))["n"]

    shrunk, small, grown, big = arun(scenario())
    assert shrunk == ["n"] and small.data["body"] == "short" and grown == ["n"] and len(big.data["body"]) == 500_000


@pytest.mark.parametrize("factory", REPOS)
def test_concurrent_pushes_of_big_records_keep_the_latest(factory, tmp_path, ws):
    async def scenario():
        repo = await setup(factory, tmp_path, ws)
        await asyncio.gather(*(
            repo.upsert_newer(ws, [item("n", updated=stamp, server=stamp, data={"v": stamp, "body": "ế" * 200_000})])
            for stamp in (10, 30, 20)
        ))
        return (await repo.get_items(ws, ["n"]))["n"]

    held = arun(scenario())
    assert held.updatedAt == 30 and held.data["v"] == 30 and len(held.data["body"]) == 200_000


# ---------------------------------------------------------------------------
# backend-specific facts
# ---------------------------------------------------------------------------
def test_json_store_survives_a_restart_and_keeps_only_the_key_hash(tmp_path):
    path = tmp_path / "store.json"

    async def first():
        repo = JsonWikiRepository(file_path=path)
        await repo.create_workspace(record("wk_persist", key_hash="digest-only"))
        await repo.upsert_newer("wk_persist", [item("a", text="keep me"), item("t", deleted=True, server=5)])

    async def second():
        repo = JsonWikiRepository(file_path=path)
        return await repo.get_workspace("wk_persist"), await repo.get_items("wk_persist", ["a", "t"])

    arun(first())
    workspace, held = arun(second())
    assert workspace.key_hash == "digest-only" and held["a"].data["body"] == "keep me" and held["t"].deleted
    stored = json.loads(path.read_text(encoding="utf-8"))
    assert stored["version"] == 1 and set(stored["workspaces"]["wk_persist"]) == {"key_hash", "created_at", "items"}


def test_json_store_with_a_corrupt_file_starts_empty_and_keeps_the_bad_file(tmp_path):
    path = tmp_path / "store.json"
    path.write_text("{ not json", encoding="utf-8")

    async def scenario():
        repo = JsonWikiRepository(file_path=path)
        return await repo.get_workspace("wk_x")

    assert arun(scenario()) is None
    assert (tmp_path / "store.json.corrupt").exists()


def test_json_store_skips_a_malformed_record_but_keeps_the_rest(tmp_path):
    path = tmp_path / "store.json"
    good = item("good").model_dump()
    path.write_text(json.dumps({"version": 1, "workspaces": {"wk_a": {
        "key_hash": "h", "created_at": "t", "items": {"good": good, "bad": {"id": "bad", "kind": "folder"}}}}}),
        encoding="utf-8")

    async def scenario():
        repo = JsonWikiRepository(file_path=path)
        return await repo.count_items("wk_a"), sorted(await repo.get_items("wk_a", ["good", "bad"]))

    assert arun(scenario()) == (1, ["good"])


def test_json_store_failed_write_is_not_remembered_in_memory(tmp_path, monkeypatch):
    async def scenario():
        repo = JsonWikiRepository(file_path=tmp_path / "store.json")
        await repo.create_workspace(record("wk_disk"))
        await repo.upsert_newer("wk_disk", [item("old", updated=100, text="before")])

        def refuse(_self):
            raise OSError("disk full")

        monkeypatch.setattr(JsonWikiRepository, "_flush_unlocked", refuse)
        with pytest.raises(OSError):
            await repo.upsert_newer("wk_disk", [item("a"), item("old", updated=200, text="never stored")])
        with pytest.raises(OSError):
            await repo.delete_workspace("wk_disk")
        return await repo.count_items("wk_disk"), (await repo.get_items("wk_disk", ["old"]))["old"], await repo.get_workspace("wk_disk")

    count, old, workspace = arun(scenario())
    assert count == 1 and old.data["body"] == "before" and workspace is not None     # "a" was never kept, "old" is back


def test_json_store_failed_purge_keeps_the_tombstones(tmp_path, monkeypatch):
    async def scenario():
        repo = JsonWikiRepository(file_path=tmp_path / "store.json")
        await repo.create_workspace(record("wk_purge"))
        await repo.upsert_newer("wk_purge", [item("t", deleted=True, server=1)])

        def refuse(_self):
            raise OSError("disk full")

        monkeypatch.setattr(JsonWikiRepository, "_flush_unlocked", refuse)
        with pytest.raises(OSError):
            await repo.delete_old_tombstones("wk_purge", 10**15)
        return await repo.count_items("wk_purge")

    assert arun(scenario()) == 1


def test_json_store_keeps_100_thousand_small_records_usable_in_memory(tmp_path):
    """Reading must not depend on sorting everything: the page of a big workspace is a bounded selection."""
    async def scenario():
        repo = JsonWikiRepository(file_path=tmp_path / "store.json")
        await repo.create_workspace(record("wk_many"))
        held = repo._items["wk_many"]                                  # fill the in-memory state directly
        for n in range(100_000):
            held[f"r{n:06d}"] = Record(id=f"r{n:06d}", kind="note", updatedAt=n, serverUpdatedAt=1_000 + n, data={"t": n})
        first = await repo.list_since("wk_many", 0, 200)
        middle = await repo.list_since("wk_many", 50_000 + 1_000, 200)
        return first, middle, await repo.count_items("wk_many")

    first, middle, count = arun(scenario())
    assert count == 100_000 and [i.id for i in first] == [f"r{n:06d}" for n in range(200)]
    assert middle[0].id == "r050001" and len(middle) == 200


def test_mongo_stores_the_data_as_a_string_so_dollar_keys_are_safe(fake_db, tmp_path):
    async def scenario():
        repo = MongoWikiRepository()
        await repo.create_workspace(record("wk_m"))
        await repo.upsert_newer("wk_m", [item("a", data={"$where": "1", "a.b": 2})])

    arun(scenario())
    [document] = fake_db["wiki_items"].documents.values()
    assert document["_id"] == "wk_m:a" and isinstance(document["dataJson"], str)
    assert set(document) == {"_id", "workspaceId", "itemId", "kind", "updatedAt", "serverUpdatedAt", "deleted", "dataJson"}
    assert "$where" not in document and json.loads(document["dataJson"]) == {"$where": "1", "a.b": 2}
    assert [("workspaceId", 1), ("serverUpdatedAt", 1)] in fake_db["wiki_items"].indexes     # the sync query has its index
    assert fake_db["wiki_workspaces"].documents["wk_m"]["keyHash"] == "hash"


def test_mongo_lost_insert_race_decides_again_instead_of_failing(fake_db):
    """A second writer inserted the id between our update attempt and our insert."""
    async def scenario():
        repo = MongoWikiRepository()
        await repo.create_workspace(record("wk_race"))
        collection = fake_db["wiki_items"]
        real_insert = collection.insert_one
        injected = {"done": False}

        async def insert_after_rival(document):
            if not injected["done"]:
                injected["done"] = True
                await real_insert({**document, "updatedAt": 900,
                                   "dataJson": json.dumps(item("r", updated=900, text="rival").data)})
            return await real_insert(document)          # raises: the rival is already there

        collection.insert_one = insert_after_rival
        written = await repo.upsert_newer("wk_race", [item("r", updated=500, text="ours")])
        collection.insert_one = real_insert
        return written, (await repo.get_items("wk_race", ["r"]))["r"]

    written, held = arun(scenario())
    assert written == [] and held.data["body"] == "rival"            # the rival is newer, so it stays


def test_sql_tables_and_the_sync_index_are_created_on_demand():
    from sqlalchemy import text
    from src.adapter.output.mysql.db.base import get_async_session

    async def scenario():
        repo = MySqlWikiRepository()
        await repo.create_workspace(record("wk_sql_tables"))
        session = get_async_session()
        try:
            names = [row[0] for row in (await session.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'wiki_%'"))).fetchall()]
            indexes = [row[0] for row in (await session.execute(
                text("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='wiki_items' AND sql IS NOT NULL"))).fetchall()]
        finally:
            await session.close()
        return sorted(names), indexes

    names, indexes = arun(scenario())
    assert names == ["wiki_items", "wiki_workspaces"]
    assert len(indexes) == 1 and "(workspace_id, server_updated_at)" in indexes[0]


def test_sql_a_second_instance_over_the_same_tables_is_harmless():
    async def scenario():
        await MySqlWikiRepository().create_workspace(record("wk_sql_first"))
        second = MySqlWikiRepository()                                   # creates "IF NOT EXISTS" again, index too
        await second.create_workspace(record("wk_sql_second"))
        return await second.get_workspace("wk_sql_first")

    assert arun(scenario()).id == "wk_sql_first"


def test_sql_ddl_keeps_big_records_and_exact_ids_on_mysql_without_breaking_sqlite():
    items_mysql, items_sqlite = create_items_sql("mysql"), create_items_sql("sqlite")
    assert "payload LONGTEXT" in items_mysql and "payload LONGTEXT" in items_sqlite
    assert items_mysql.count("utf8mb4_bin") == 2 and "workspace_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL" in items_mysql
    assert "id VARCHAR(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL" in items_mysql
    assert "utf8mb4" not in items_sqlite and "utf8mb4" not in create_items_sql()
    assert "PRIMARY KEY (workspace_id, id)" in items_mysql
    assert create_workspaces_sql("mysql").count("utf8mb4_bin") == 1 and "utf8mb4" not in create_workspaces_sql("sqlite")
    assert "CREATE TABLE IF NOT EXISTS wiki_workspaces" in create_workspaces_sql() and "wiki_items" in items_sqlite
