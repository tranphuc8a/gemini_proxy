"""The three stores of the markdown delta sync must behave identically (md-sync B3-B5).

JSON is exercised on `tmp_path`; MySQL runs its portable SQL against the SQLite engine the suite
falls back to (the tables are created at run time, as on a real deployment - never against a real
database); Mongo runs against `tests.support.fake_mongo`. One contract over all three: a client
switching backend must not notice.
"""

import os

os.environ.setdefault("TESTING", "1")

import json

import pytest
from sqlalchemy import text

from src.adapter.output.markdown_docs import mongo_repository
from src.adapter.output.markdown_docs.json_repository import JsonMarkdownDocsRepository
from src.adapter.output.markdown_docs.mongo_repository import MongoMarkdownDocsRepository
from src.adapter.output.markdown_docs.mysql_repository import MySqlMarkdownDocsRepository, create_tables_sql
from src.domain.vo.markdown_docs_vo import DocRecord, Revision
from tests.conftest import arun
from tests.support import fake_mongo

SPACE = "default"


def json_repo(tmp_path):
    return JsonMarkdownDocsRepository(file_path=tmp_path / "markdown-docs.json")


class _FreshSql(MySqlMarkdownDocsRepository):
    """The suite's SQLite file is shared by every test: start each test with empty tables."""

    async def _session(self):
        fresh = not self._ready
        session = await super()._session()
        if fresh:
            for table in ("markdown_docs", "markdown_doc_revisions", "markdown_meta"):
                await session.execute(text(f"DELETE FROM {table}"))
            await session.commit()
        return session


def sql_repo(_tmp_path):
    return _FreshSql()


def mongo_repo(_tmp_path):
    return MongoMarkdownDocsRepository()


REPOS = [pytest.param(json_repo, id="json"), pytest.param(sql_repo, id="sql"), pytest.param(mongo_repo, id="mongo")]


@pytest.fixture(autouse=True)
def fake_db(monkeypatch):
    return fake_mongo.install(monkeypatch, mongo_repository)


def doc(doc_id="d1", rev=1, stamp=1000, deleted=False, content="# Xin chào\n", name="a.md", parent="root", kind="file", **extra):
    return DocRecord(
        id=doc_id, kind=kind, parentId=parent, name=name, content=None if deleted or kind == "folder" else content,
        hash="" if deleted or kind == "folder" else "h" * 64, size=len(content.encode("utf-8")) if not deleted and kind == "file" else 0,
        rev=rev, contentRev=rev, metaRev=1, deleted=deleted, createdAt=500, updatedAt=900, serverUpdatedAt=stamp,
        device="dev-a", **extra,
    )


def revision(doc_id="d1", rev=1, encoding="full", body="text", base=None, label=None, saved=1000, **extra):
    return Revision(
        docId=doc_id, rev=rev, kind="file", name="a.md", parentId="root", hash="h" * 64, size=len(body),
        encoding=encoding, baseRev=base, body=body, origin="edit", label=label, device="dev-a",
        savedAt=saved, updatedAt=saved, **extra,
    )


# ------------------------------------------------------------------- documents

@pytest.mark.parametrize("factory", REPOS)
def test_insert_then_read_back_exactly(factory, tmp_path):
    async def scenario():
        repo = factory(tmp_path)
        stored = doc(content="Tiếng Việt ệ\n$x^2$\r\n", parent=None)
        first = await repo.insert(SPACE, stored)
        again = await repo.insert(SPACE, doc(content="other"))
        return first, again, await repo.get(SPACE, "d1"), await repo.get(SPACE, "nope")

    first, again, read, missing = arun(scenario())
    assert first is True and again is False, "an existing id is never inserted twice"
    assert read.content == "Tiếng Việt ệ\n$x^2$\r\n" and read.parentId is None and read.rev == 1 and read.device == "dev-a"
    assert read.model_dump() == doc(content="Tiếng Việt ệ\n$x^2$\r\n", parent=None).model_dump()
    assert missing is None


@pytest.mark.parametrize("factory", REPOS)
def test_ids_match_exactly_and_spaces_are_apart(factory, tmp_path):
    async def scenario():
        repo = factory(tmp_path)
        await repo.insert(SPACE, doc("Ab", content="upper"))
        await repo.insert(SPACE, doc("aB", content="lower"))
        await repo.insert("other", doc("Ab", content="elsewhere"))
        return (await repo.get(SPACE, "Ab")).content, (await repo.get(SPACE, "aB")).content, \
            (await repo.get("other", "Ab")).content, await repo.get("other", "aB"), await repo.count(SPACE), await repo.count("other")

    assert arun(scenario()) == ("upper", "lower", "elsewhere", None, 2, 1)


@pytest.mark.parametrize("factory", REPOS)
def test_get_many_returns_only_what_exists(factory, tmp_path):
    async def scenario():
        repo = factory(tmp_path)
        for doc_id in ("a", "b", "c"):
            await repo.insert(SPACE, doc(doc_id))
        found = await repo.get_many(SPACE, ["a", "c", "zzz"])
        return sorted(found), await repo.get_many(SPACE, [])

    assert arun(scenario()) == (["a", "c"], {})


@pytest.mark.parametrize("factory", REPOS)
def test_compare_and_set_only_writes_at_the_expected_rev(factory, tmp_path):
    async def scenario():
        repo = factory(tmp_path)
        await repo.insert(SPACE, doc(rev=1, content="v1"))
        stale = await repo.cas_write(SPACE, doc(rev=2, content="stale"), expected_rev=7)
        missing = await repo.cas_write(SPACE, doc("ghost", rev=2), expected_rev=1)
        after_stale = await repo.get(SPACE, "d1")
        won = await repo.cas_write(SPACE, doc(rev=2, content="v2", name="b.md", stamp=2000), expected_rev=1)
        twice = await repo.cas_write(SPACE, doc(rev=3, content="v3"), expected_rev=1)
        return stale, missing, after_stale.content, won, twice, await repo.get(SPACE, "d1"), await repo.get(SPACE, "ghost")

    stale, missing, kept, won, twice, final, ghost = arun(scenario())
    assert (stale, missing, kept) == (False, False, "v1")
    assert won is True and twice is False, "the second writer based on rev 1 loses"
    assert (final.content, final.rev, final.name, final.serverUpdatedAt) == ("v2", 2, "b.md", 2000)
    assert ghost is None, "cas_write never creates"


@pytest.mark.parametrize("factory", REPOS)
def test_list_since_is_strict_ordered_by_stamp_then_id_and_can_hide_tombstones(factory, tmp_path):
    async def scenario():
        repo = factory(tmp_path)
        await repo.insert(SPACE, doc("c", stamp=3000))
        await repo.insert(SPACE, doc("b", stamp=2000))
        await repo.insert(SPACE, doc("a", stamp=2000))
        await repo.insert(SPACE, doc("gone", stamp=2500, deleted=True, rev=2))
        every = [r.id for r in await repo.list_since(SPACE, 0, 100, True)]
        live = [r.id for r in await repo.list_since(SPACE, 0, 100, False)]
        after = [r.id for r in await repo.list_since(SPACE, 2000, 100, True)]
        capped = [r.id for r in await repo.list_since(SPACE, 0, 2, True)]
        return every, live, after, capped

    every, live, after, capped = arun(scenario())
    assert every == ["a", "b", "gone", "c"]
    assert live == ["a", "b", "c"]
    assert after == ["gone", "c"], "strictly greater than the cursor"
    assert capped == ["a", "b"]


@pytest.mark.parametrize("factory", REPOS)
def test_tombstones_have_no_content_and_leave_the_live_list(factory, tmp_path):
    async def scenario():
        repo = factory(tmp_path)
        await repo.insert(SPACE, doc("keep"))
        await repo.insert(SPACE, doc("folder1", kind="folder", name="Notes"))
        await repo.insert(SPACE, doc("dead", deleted=True, rev=2))
        return sorted(r.id for r in await repo.list_live(SPACE)), await repo.get(SPACE, "dead"), await repo.count(SPACE)

    live, dead, count = arun(scenario())
    assert live == ["folder1", "keep"]
    assert dead.deleted is True and dead.content is None and dead.hash == ""
    assert count == 3, "tombstones count towards the space"


@pytest.mark.parametrize("factory", REPOS)
def test_purge_tombstones_takes_only_old_deleted_records(factory, tmp_path):
    async def scenario():
        repo = factory(tmp_path)
        await repo.insert(SPACE, doc("old", stamp=100, deleted=True, rev=2))
        await repo.insert(SPACE, doc("edge", stamp=1000, deleted=True, rev=2))
        await repo.insert(SPACE, doc("fresh", stamp=5000, deleted=True, rev=2))
        await repo.insert(SPACE, doc("live-old", stamp=100))
        gone = await repo.purge_tombstones(SPACE, 1000)
        return gone, sorted(r.id for r in await repo.list_since(SPACE, 0, 100, True))

    assert arun(scenario()) == (["old"], ["edge", "fresh", "live-old"])


@pytest.mark.parametrize("factory", REPOS)
def test_purging_tombstones_takes_their_history_with_them_and_only_theirs(factory, tmp_path):
    """One call removes the nodes AND their history (a statement per kind): a purge of thousands of nodes costs no
    round trip each, and one cut short leaves no history rows of a node that is gone."""
    async def scenario():
        repo = factory(tmp_path)
        await repo.insert(SPACE, doc("old", stamp=100, deleted=True, rev=2))
        await repo.insert(SPACE, doc("old2", stamp=200, deleted=True, rev=3))
        await repo.insert(SPACE, doc("fresh", stamp=5000, deleted=True, rev=2))
        await repo.insert(SPACE, doc("live"))
        for doc_id in ("old", "old2", "fresh", "live"):
            await repo.add_revision(SPACE, revision(doc_id, rev=1, body="first"))
            await repo.add_revision(SPACE, revision(doc_id, rev=2, encoding="none", body=""))
        gone = await repo.purge_tombstones(SPACE, 1000)
        history = {doc_id: [row.rev for row in await repo.list_revisions(SPACE, doc_id)] for doc_id in ("old", "old2", "fresh", "live")}
        return gone, history, await repo.purge_tombstones(SPACE, 1000)

    gone, history, again = arun(scenario())
    assert gone == ["old", "old2"] and again == []
    assert history == {"old": [], "old2": [], "fresh": [1, 2], "live": [1, 2]}


@pytest.mark.parametrize("factory", REPOS)
def test_insert_many_adds_only_the_absent_ones(factory, tmp_path):
    async def scenario():
        repo = factory(tmp_path)
        await repo.insert(SPACE, doc("a", content="mine"))
        added = await repo.insert_many(SPACE, [doc("a", content="theirs"), doc("b"), doc("c")])
        again = await repo.insert_many(SPACE, [doc("b"), doc("c")])
        return added, again, (await repo.get(SPACE, "a")).content, await repo.count(SPACE), await repo.insert_many(SPACE, [])

    assert arun(scenario()) == (2, 0, "mine", 3, 0)


# --------------------------------------------------------------------- history

@pytest.mark.parametrize("factory", REPOS)
def test_history_rows_round_trip_without_the_body_in_listings(factory, tmp_path):
    async def scenario():
        repo = factory(tmp_path)
        await repo.add_revision(SPACE, revision(rev=3, body="third", saved=3000))
        await repo.add_revisions(SPACE, [revision(rev=1, body="Tiếng Việt\n", saved=1000),
                                         revision(rev=2, encoding="delta", base=1, body='{"v":1,"h":[]}', saved=2000, compressed=True)])
        await repo.add_revision(SPACE, revision("other", rev=1, body="x"))
        listed = await repo.list_revisions(SPACE, "d1")
        return listed, await repo.get_revision(SPACE, "d1", 2), await repo.get_revision(SPACE, "d1", 1), await repo.get_revision(SPACE, "d1", 9)

    listed, delta, first, missing = arun(scenario())
    assert [row.rev for row in listed] == [1, 2, 3], "oldest first"
    assert all(row.body == "" for row in listed), "a listing never moves the text"
    assert (delta.encoding, delta.baseRev, delta.compressed, delta.body) == ("delta", 1, True, '{"v":1,"h":[]}')
    assert first.body == "Tiếng Việt\n" and first.origin == "edit" and first.device == "dev-a" and first.savedAt == 1000
    assert missing is None


@pytest.mark.parametrize("factory", REPOS)
def test_adding_a_row_with_the_same_rev_replaces_it(factory, tmp_path):
    async def scenario():
        repo = factory(tmp_path)
        await repo.add_revision(SPACE, revision(rev=1, body="old"))
        await repo.add_revision(SPACE, revision(rev=1, body="new", label="v1"))
        return (await repo.get_revision(SPACE, "d1", 1)), len(await repo.list_revisions(SPACE, "d1"))

    row, count = arun(scenario())
    assert (row.body, row.label, count) == ("new", "v1", 1)


@pytest.mark.parametrize("factory", REPOS)
def test_latest_keyframe_is_the_newest_full_row(factory, tmp_path):
    async def scenario():
        repo = factory(tmp_path)
        none_yet = await repo.latest_keyframe(SPACE, "d1")
        await repo.add_revision(SPACE, revision(rev=1, body="first"))
        await repo.add_revision(SPACE, revision(rev=2, encoding="delta", base=1, body="d"))
        await repo.add_revision(SPACE, revision(rev=3, encoding="full", body="third"))
        await repo.add_revision(SPACE, revision(rev=4, encoding="delta", base=3, body="d"))
        await repo.add_revision(SPACE, revision(rev=5, encoding="none", body=""))
        return none_yet, await repo.latest_keyframe(SPACE, "d1"), await repo.latest_keyframe(SPACE, "other")

    none_yet, frame, other = arun(scenario())
    assert none_yet is None and other is None
    assert (frame.rev, frame.body) == (3, "third"), "the text is included"


@pytest.mark.parametrize("factory", REPOS)
def test_delete_revisions_some_or_all(factory, tmp_path):
    async def scenario():
        repo = factory(tmp_path)
        for rev in range(1, 6):
            await repo.add_revision(SPACE, revision(rev=rev, body=str(rev)))
        await repo.add_revision(SPACE, revision("keep", rev=1, body="k"))
        await repo.delete_revisions(SPACE, "d1", [2, 4, 99])
        await repo.delete_revisions(SPACE, "d1", [])
        left = [row.rev for row in await repo.list_revisions(SPACE, "d1")]
        await repo.delete_all_revisions(SPACE, "d1")
        return left, await repo.list_revisions(SPACE, "d1"), [row.rev for row in await repo.list_revisions(SPACE, "keep")]

    assert arun(scenario()) == ([1, 3, 5], [], [1])


# ------------------------------------------------------------------------ meta

@pytest.mark.parametrize("factory", REPOS)
def test_meta_claims_overwrites_and_stays_per_space(factory, tmp_path):
    async def scenario():
        repo = factory(tmp_path)
        absent = await repo.get_meta(SPACE, "migrated_v1")
        first = await repo.put_meta_if_absent(SPACE, "migrated_v1", "running")
        second = await repo.put_meta_if_absent(SPACE, "migrated_v1", "other")
        kept = await repo.get_meta(SPACE, "migrated_v1")
        await repo.put_meta(SPACE, "migrated_v1", "done")
        await repo.put_meta(SPACE, "horizon", "42")
        await repo.put_meta(SPACE, "horizon", "43")
        return absent, first, second, kept, await repo.get_meta(SPACE, "migrated_v1"), await repo.get_meta(SPACE, "horizon"), \
            await repo.get_meta("other", "horizon")

    assert arun(scenario()) == (None, True, False, "running", "done", "43", None)


@pytest.mark.parametrize("factory", REPOS)
def test_a_long_meta_value_survives(factory, tmp_path):
    """The migration flag carries the id table: it can be far longer than 64 KB on a big old store."""
    value = json.dumps({"idMap": {f"old {n}": f"legacy-{n:024d}" for n in range(4000)}})

    async def scenario():
        repo = factory(tmp_path)
        await repo.put_meta(SPACE, "migrated_v1", value)
        return await repo.get_meta(SPACE, "migrated_v1")

    assert len(value) > 100_000
    assert arun(scenario()) == value


@pytest.mark.parametrize("factory", REPOS)
def test_batch_is_a_harmless_group(factory, tmp_path):
    async def scenario():
        repo = factory(tmp_path)
        async with repo.batch():
            await repo.insert(SPACE, doc("a"))
            await repo.insert(SPACE, doc("b"))
        return await repo.count(SPACE)

    assert arun(scenario()) == 2


# ----------------------------------------------------------- json-file specifics

def test_json_store_survives_a_restart_and_keeps_history_apart(tmp_path):
    async def scenario():
        repo = json_repo(tmp_path)
        await repo.insert(SPACE, doc("folder:one", content="Tiếng Việt"))
        await repo.add_revision(SPACE, revision("folder:one", rev=1, body="Tiếng Việt"))
        await repo.put_meta(SPACE, "horizon", "7")
        again = json_repo(tmp_path)
        return await again.get(SPACE, "folder:one"), await again.get_revision(SPACE, "folder:one", 1), await again.get_meta(SPACE, "horizon")

    kept, row, horizon = arun(scenario())
    assert kept.content == "Tiếng Việt" and row.body == "Tiếng Việt" and horizon == "7"
    main = json.loads((tmp_path / "markdown-docs.json").read_text(encoding="utf-8"))
    assert "revisions" not in json.dumps(main) and main["spaces"][SPACE]["docs"]["folder:one"]["rev"] == 1
    history = list((tmp_path / "markdown-history" / SPACE).glob("*.json"))
    assert len(history) == 1 and ":" not in history[0].name, "one file per document, named by a hash (no ':' on Windows)"
    assert not list(tmp_path.glob("*.tmp")), "no temporary file is left behind"


def test_json_batch_rewrites_the_file_once(tmp_path, monkeypatch):
    repo = json_repo(tmp_path)
    flushes = []
    original = repo._flush_unlocked
    monkeypatch.setattr(repo, "_flush_unlocked", lambda: (flushes.append(1), original())[1])

    async def scenario():
        async with repo.batch():
            for index in range(25):
                await repo.insert(SPACE, doc(f"d{index}"))
            await repo.cas_write(SPACE, doc("d0", rev=2), expected_rev=1)
        during = len(flushes)
        await repo.insert(SPACE, doc("late"))
        return during, len(flushes), json_repo(tmp_path)

    during, after_single, reread = arun(scenario())
    assert during == 1, "25 inserts and a write inside one batch are one rewrite"
    assert after_single == 2, "outside a batch every write is persisted at once"
    assert arun(reread.count(SPACE)) == 26


def test_json_a_failed_rewrite_does_not_leave_memory_ahead_of_the_disk(tmp_path, monkeypatch):
    repo = json_repo(tmp_path)
    arun(repo.insert(SPACE, doc("safe")))

    async def scenario():
        def boom():
            raise OSError("disk full")
        monkeypatch.setattr(repo, "_flush_unlocked", boom)
        with pytest.raises(OSError):
            await repo.insert(SPACE, doc("lost"))
        monkeypatch.undo()
        return sorted(r.id for r in await repo.list_live(SPACE))

    assert arun(scenario()) == ["safe"], "what was not persisted is not served either"


def test_json_corrupt_file_is_set_aside_and_the_store_starts_empty(tmp_path):
    (tmp_path / "markdown-docs.json").write_text("{not json", encoding="utf-8")

    async def scenario():
        repo = json_repo(tmp_path)
        count = await repo.count(SPACE)
        await repo.insert(SPACE, doc("fresh"))
        return count, await repo.count(SPACE)

    assert arun(scenario()) == (0, 1)
    assert (tmp_path / "markdown-docs.json.corrupt").exists()


# ------------------------------------------------------------- sql specifics

def test_sql_ddl_is_exact_on_mysql_only():
    mysql = "\n".join(create_tables_sql("mysql"))
    assert mysql.count("utf8mb4_bin") >= 6, "ids of every table compare exactly on MySQL (its default collation ignores case)"
    assert "utf8mb4_bin" not in "\n".join(create_tables_sql("sqlite"))
    assert all("IF NOT EXISTS" in statement for statement in create_tables_sql("mysql"))
