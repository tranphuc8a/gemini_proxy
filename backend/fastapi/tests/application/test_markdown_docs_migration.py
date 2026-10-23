"""Copying the old whole-tree store into the delta store, once (md-sync B10).

The old store comes in its three shapes - the nested JSON file, the `markdown_files` table (the suite's
SQLite stands in for MySQL), the `markdown_files` collection (`fake_mongo`) - and is read-only to the
migration: every test that migrates also proves the old data was not touched. Nothing here reaches a real
database.
"""

import os

os.environ.setdefault("TESTING", "1")

import hashlib
import json
import time

import pytest
from sqlalchemy import text

from src.adapter.output.markdown_docs import legacy_reader
from src.adapter.output.markdown_docs.legacy_reader import LEGACY_COLLECTION, LEGACY_TABLE_SQL, LegacyMarkdownReader
from src.adapter.output.markdown_docs.json_repository import JsonMarkdownDocsRepository
from src.adapter.output.markdown_share.json_repository import JsonMarkdownShareRepository
from src.adapter.output.mysql.db.base import get_async_session
from src.application.exceptions.exceptions import AppException
from src.application.ports.output.markdown_docs_repository_port import LegacyMarkdownReaderPort
from src.application.usecases.markdown_docs_usecase import HORIZON_KEY, MIGRATION_KEY, MIGRATION_LEASE_MS, MarkdownDocsUseCase
from src.application.utils.line_patch import sha256_hex
from src.domain.vo.markdown_docs_vo import DocRecord
from src.domain.vo.markdown_ids import is_doc_id
from src.domain.vo.markdown_share_vo import MarkdownShareRecord
from tests.conftest import arun
from tests.support import fake_mongo
from tests.support.markdown_docs import T0, Clock, LoopWatch, delete_op, file_op, make_uc, push_one

SPACE = "default"

#: The tree an old editor saved: folders, nested files, a root, Vietnamese names.
TREE = [
    {"id": "root", "name": "Notes", "type": "folder", "children": [
        {"id": "welcome", "name": "welcome.md", "type": "file", "content": "# Chào mừng\n"},
        {"id": "folder-1", "name": "Công việc", "type": "folder", "children": [
            {"id": "file-a", "name": "họp.md", "type": "file", "content": "# Họp\n\nnội dung ệ\n"},
            {"id": "file-b", "name": "b.md", "type": "file", "content": ""},
        ]},
    ]},
    {"id": "file-top", "name": "top.md", "type": "file", "content": "ở ngoài cùng"},
]
TREE_SIZE = 6


def flat_rows(nodes, parent=None, out=None):
    out = [] if out is None else out
    for position, node in enumerate(nodes):
        out.append({**{k: v for k, v in node.items() if k != "children"}, "parent": parent, "position": position})
        flat_rows(node.get("children") or [], node["id"], out)
    return out


# ------------------------------------------------------- the three shapes of the old store

class OldStore:
    """Writes a tree into one backend's old store and can fingerprint it (to prove it was left alone)."""

    def __init__(self, backend, tmp_path, monkeypatch):
        self.backend = backend
        self.tmp_path = tmp_path
        self.monkeypatch = monkeypatch
        self.path = tmp_path / "markdown-files.json"
        self.database = None
        monkeypatch.setenv("MARKDOWN_JSON_FILE", str(self.path))
        if backend == "mongo":
            self.database = fake_mongo.install(monkeypatch, legacy_reader)

    async def write(self, tree):
        if self.backend == "json":
            self.path.write_text(json.dumps({"files": tree}, indent=2, ensure_ascii=False), encoding="utf-8")
        elif self.backend == "mysql":
            session = get_async_session()
            try:
                await session.execute(text(LEGACY_TABLE_SQL))
                await session.execute(text("DELETE FROM markdown_files"))
                for row in flat_rows(tree):
                    await session.execute(
                        text("INSERT INTO markdown_files (id, name, node_type, content, parent_id, sort_order) "
                             "VALUES (:id, :name, :type, :content, :parent, :position)"), row | {"content": row.get("content")},
                    )
                await session.commit()
            finally:
                await session.close()
        else:
            collection = self.database[LEGACY_COLLECTION]
            collection.documents.clear()                                              # a save replaces the whole store
            for row in flat_rows(tree):
                await collection.insert_one({
                    "_id": row["id"], "name": row["name"], "node_type": row["type"], "content": row.get("content"),
                    "parent_id": row["parent"], "sort_order": row["position"],
                })

    async def fingerprint(self):
        if self.backend == "json":
            return hashlib.sha256(self.path.read_bytes()).hexdigest() if self.path.exists() else None
        if self.backend == "mysql":
            session = get_async_session()
            try:
                result = await session.execute(text("SELECT id, name, node_type, content, parent_id, sort_order FROM markdown_files ORDER BY id"))
                return hashlib.sha256(json.dumps([list(row) for row in result], ensure_ascii=False, default=str).encode()).hexdigest()
            finally:
                await session.close()
        return hashlib.sha256(json.dumps(self.database[LEGACY_COLLECTION].documents, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


@pytest.fixture(params=["json", "mysql", "mongo"])
def old(request, tmp_path, monkeypatch):
    store = OldStore(request.param, tmp_path, monkeypatch)
    yield store
    if store.backend == "mysql":                    # the suite's SQLite file outlives the test: leave the old table empty
        arun(store.write([]))


def migrating_uc(old, shares=None, clock=None, **options):
    repo = JsonMarkdownDocsRepository(file_path=old.tmp_path / "markdown-docs.json")
    uc = MarkdownDocsUseCase(repo, LegacyMarkdownReader(), shares, backend=old.backend, clock=clock or Clock(), **options)
    return uc, repo


# ------------------------------------------------------------------------ what is copied

def test_every_old_node_becomes_a_record_at_rev_1_and_the_old_store_is_untouched(old):
    async def scenario():
        await old.write(TREE)
        before = await old.fingerprint()
        uc, repo = migrating_uc(old)
        assert await uc.is_migrated() is False
        await uc.ensure_migrated()
        records = {r.id: r for r in await repo.list_since(SPACE, 0, 100, True)}
        history = {doc_id: await repo.list_revisions(SPACE, doc_id) for doc_id in records}
        flag = json.loads(await repo.get_meta(SPACE, MIGRATION_KEY))
        return before, await old.fingerprint(), records, history, flag, await uc.is_migrated()

    before, after, records, history, flag, migrated = arun(scenario())
    assert before == after, "the old store is read, never written"
    assert migrated and flag["state"] == "done" and flag["nodes"] == TREE_SIZE and flag["idMap"] == {} and flag["skipped"] == []
    assert set(records) == {"root", "welcome", "folder-1", "file-a", "file-b", "file-top"}
    for record in records.values():
        assert (record.rev, record.contentRev, record.metaRev, record.deleted, record.device) == (1, 1, 1, False, "legacy")
    assert (records["file-a"].name, records["file-a"].parentId, records["file-a"].kind) == ("họp.md", "folder-1", "file")
    assert (records["folder-1"].parentId, records["root"].parentId, records["file-top"].parentId) == ("root", None, None)
    assert records["file-a"].content == "# Họp\n\nnội dung ệ\n" and records["file-a"].hash == sha256_hex("# Họp\n\nnội dung ệ\n")
    assert records["folder-1"].content is None and records["folder-1"].hash == ""
    assert records["file-b"].content == "" and records["file-b"].size == 0
    assert {doc_id for doc_id, rows in history.items() if rows} == {"welcome", "file-a", "file-b", "file-top"}, "files only"
    row = history["file-a"][0]
    assert (row.rev, row.origin, row.encoding, row.device, row.deleted) == (1, "migrate", "full", "legacy", False)
    assert len({r.serverUpdatedAt for r in records.values()}) == TREE_SIZE, "distinct stamps: a pull can page through them"


def test_running_twice_or_in_another_process_copies_nothing_more(old):
    async def scenario():
        await old.write(TREE)
        uc, repo = migrating_uc(old)
        await uc.ensure_migrated()
        await push_one(uc, file_op("file-a", "edited after the copy", base=1))
        again_same_process = await uc.ensure_migrated()
        other_process = MarkdownDocsUseCase(repo, LegacyMarkdownReader(), None, backend=old.backend, clock=Clock())
        await other_process.ensure_migrated()
        await old.write(TREE + [{"id": "late", "name": "late.md", "type": "file", "content": "added to the old store later"}])
        await MarkdownDocsUseCase(repo, LegacyMarkdownReader(), None, backend=old.backend, clock=Clock()).ensure_migrated()
        return await repo.count(SPACE), (await repo.get(SPACE, "file-a")).content, await repo.get(SPACE, "late"), again_same_process

    count, content, late, _ = arun(scenario())
    assert count == TREE_SIZE and content == "edited after the copy", "the copy never overwrites what the delta store holds"
    assert late is None, "it is a one-time copy: what the old editor saves afterwards is not pulled in"


def test_an_empty_or_missing_old_store_is_migrated_as_empty(old):
    async def scenario():
        if old.backend != "json":
            await old.write([])                      # json: no file at all; the others: an empty table / collection
        uc, repo = migrating_uc(old)
        await uc.ensure_migrated()
        first = await uc.changes(0, None, "")
        pushed = await push_one(uc, file_op("n1", "fresh", name="n.md"))
        return first, pushed, json.loads(await repo.get_meta(SPACE, MIGRATION_KEY))

    first, pushed, flag = arun(scenario())
    assert first["items"] == [] and pushed["status"] == "ok" and flag["nodes"] == 0


def test_the_first_pull_or_push_does_the_copy_itself(old):
    async def scenario():
        await old.write(TREE)
        pulled_uc, pulled_repo = migrating_uc(old)
        first = await pulled_uc.changes(0, None, "")
        (old.tmp_path / "markdown-docs.json").unlink()
        pushed_uc, pushed_repo = migrating_uc(old)
        await push_one(pushed_uc, file_op("brand-new", "x", name="new.md"))
        return first, await pushed_repo.count(SPACE)

    first, count = arun(scenario())
    assert len(first["items"]) == TREE_SIZE
    assert count == TREE_SIZE + 1


def test_a_big_tree_is_copied_in_one_go(old):
    async def scenario():
        files = [{"id": f"file-{n}", "name": f"doc {n}.md", "type": "file", "content": f"# {n}\n" + "line of text ệ\n" * 40} for n in range(300)]
        tree = [{"id": "root", "name": "Notes", "type": "folder", "children": files}]
        await old.write(tree)
        uc, repo = migrating_uc(old)
        await uc.ensure_migrated()
        return await repo.count(SPACE), await uc.get_document("file-299")

    count, last = arun(scenario())
    assert count == 301 and last["content"].startswith("# 299\n")


# --------------------------------------------------------------------------- odd old data

def odd_tree():
    return [
        {"id": "root", "name": "Notes", "type": "folder", "children": [
            {"id": "id with space", "name": "a/b.md", "type": "file", "content": "slash in the name"},
            {"id": "an/other", "name": "  ", "type": "folder", "children": [
                {"id": "child-ok", "name": "child.md", "type": "file", "content": "kid"},
            ]},
            {"id": "x" * 100, "name": "n" * 400, "type": "file", "content": "long id and name"},
        ]},
    ]


def test_ids_the_new_pattern_refuses_are_renamed_and_the_table_is_kept(old):
    async def scenario():
        await old.write(odd_tree())
        uc, repo = migrating_uc(old)
        await uc.ensure_migrated()
        records = {r.id: r for r in await repo.list_since(SPACE, 0, 100, True)}
        return records, json.loads(await repo.get_meta(SPACE, MIGRATION_KEY))

    records, flag = arun(scenario())
    id_map = flag["idMap"]
    assert set(id_map) == {"id with space", "an/other", "x" * 100}
    assert all(is_doc_id(new) and new.startswith("legacy-") for new in id_map.values()), "every stored id fits the pattern"
    assert set(records) == {"root", "child-ok", *id_map.values()}
    assert records[id_map["an/other"]].kind == "folder" and records["child-ok"].parentId == id_map["an/other"], "children follow their renamed parent"
    assert records[id_map["id with space"]].parentId == "root"
    assert records[id_map["id with space"]].name == "a-b.md", "a slash cannot stay in a name"
    assert records[id_map["an/other"]].name == "Untitled", "a blank folder name gets a placeholder"
    assert len(records[id_map["x" * 100]].name) == 255


def test_two_old_nodes_with_the_same_id_both_survive(tmp_path, monkeypatch):
    """Only a hand-edited JSON file can repeat an id (a table or a collection has a key)."""
    old = OldStore("json", tmp_path, monkeypatch)

    async def scenario():
        await old.write([
            {"id": "root", "name": "Notes", "type": "folder", "children": [
                {"id": "dup", "name": "one.md", "type": "file", "content": "first"},
                {"id": "dup", "name": "two.md", "type": "file", "content": "second"},
            ]},
        ])
        uc, repo = migrating_uc(old)
        await uc.ensure_migrated()
        return sorted((r.name, r.content) for r in await repo.list_since(SPACE, 0, 10, True) if r.kind == "file")

    assert arun(scenario()) == [("one.md", "first"), ("two.md", "second")]


def test_a_link_on_a_renamed_id_is_carried_over(tmp_path, monkeypatch):
    """B10: the id table also updates `markdown_shares.doc_id` (ke-hoach §1.2)."""
    old = OldStore("json", tmp_path, monkeypatch)

    async def scenario():
        await old.write(odd_tree())
        shares = JsonMarkdownShareRepository(file_path=tmp_path / "shares.json")
        for doc_id in ("id with space", "child-ok"):
            await shares.save(MarkdownShareRecord(
                token=sha256_hex(doc_id)[:32], doc_id=doc_id, title="t", shared_at=T0, updated_at=T0, bytes=1,
                content_hash="h" * 64, content="shared text",
            ))
        uc, repo = migrating_uc(old, shares=shares)
        await uc.ensure_migrated()
        flag = json.loads(await repo.get_meta(SPACE, MIGRATION_KEY))
        new_id = flag["idMap"]["id with space"]
        return await shares.get_by_doc("id with space"), await shares.get_by_doc(new_id), await shares.get_by_doc("child-ok")

    gone, moved, untouched = arun(scenario())
    assert gone is None and moved is not None and moved.doc_id.startswith("legacy-"), "the link now follows the node's new id"
    assert untouched is not None and untouched.doc_id == "child-ok"


def test_a_failing_link_update_never_undoes_the_copy(tmp_path, monkeypatch):
    old = OldStore("json", tmp_path, monkeypatch)

    class BrokenShares(JsonMarkdownShareRepository):
        async def rename_docs(self, mapping):
            raise OSError("share store down")

    async def scenario():
        await old.write(odd_tree())
        uc, repo = migrating_uc(old, shares=BrokenShares(file_path=tmp_path / "shares.json"))
        await uc.ensure_migrated()
        return await uc.is_migrated(), await repo.count(SPACE)

    assert arun(scenario()) == (True, 5)


def test_content_over_the_budget_is_left_out_and_reported(old):
    async def scenario():
        tree = [{"id": "root", "name": "Notes", "type": "folder", "children": [
            {"id": "small", "name": "s.md", "type": "file", "content": "x" * 50},
            {"id": "huge", "name": "h.md", "type": "file", "content": "ệ" * 40},          # 120 bytes
        ]}]
        await old.write(tree)
        uc, repo = migrating_uc(old, max_doc_bytes=100)
        await uc.ensure_migrated()
        return sorted(r.id for r in await repo.list_since(SPACE, 0, 10, True)), json.loads(await repo.get_meta(SPACE, MIGRATION_KEY))

    ids, flag = arun(scenario())
    assert ids == ["root", "small"] and flag["skipped"] == [{"id": "huge", "reason": "too_large"}]
    assert flag["nodes"] == 2


def test_a_lone_surrogate_in_old_content_is_replaced_not_fatal(tmp_path, monkeypatch):
    old = OldStore("json", tmp_path, monkeypatch)

    async def scenario():
        old.path.write_text(json.dumps({"files": [{"id": "f", "name": "f.md", "type": "file", "content": "bad \ud800 mark"}]}), encoding="utf-8")
        uc, repo = migrating_uc(old)
        await uc.ensure_migrated()
        return (await repo.get(SPACE, "f")).content

    content = arun(scenario())
    assert content.startswith("bad ") and content.endswith(" mark") and "\ud800" not in content


# ------------------------------------------------------------- claiming and recovering

def seeded_flag(old, state, at):
    async def put():
        repo = JsonMarkdownDocsRepository(file_path=old.tmp_path / "markdown-docs.json")
        await repo.put_meta(SPACE, MIGRATION_KEY, json.dumps({"state": state, "at": at}))
    return put()


def test_while_another_process_is_copying_a_caller_is_told_to_retry(tmp_path, monkeypatch):
    old = OldStore("json", tmp_path, monkeypatch)

    async def scenario():
        await old.write(TREE)
        clock = Clock()
        await seeded_flag(old, "running", clock.now - 1000)
        uc, repo = migrating_uc(old, clock=clock)
        try:
            await uc.ensure_migrated()
        except AppException as error:
            return error.status_code, error.payload["code"], error.headers, await repo.count(SPACE)

    assert arun(scenario()) == (503, "md_migrating", {"Retry-After": "2"}, 0)


@pytest.mark.parametrize("state,age", [("running", MIGRATION_LEASE_MS + 1), ("failed", 10)])
def test_a_dead_claim_or_a_failed_run_is_taken_over(tmp_path, monkeypatch, state, age):
    old = OldStore("json", tmp_path, monkeypatch)

    async def scenario():
        await old.write(TREE)
        clock = Clock()
        await seeded_flag(old, state, clock.now - age)
        uc, repo = migrating_uc(old, clock=clock)
        await uc.ensure_migrated()
        return await repo.count(SPACE), json.loads(await repo.get_meta(SPACE, MIGRATION_KEY))["state"]

    assert arun(scenario()) == (TREE_SIZE, "done")


def test_a_failed_read_releases_the_claim_and_the_next_call_succeeds(tmp_path, monkeypatch):
    old = OldStore("json", tmp_path, monkeypatch)

    class Flaky(LegacyMarkdownReaderPort):
        def __init__(self):
            self.calls = 0

        async def read_tree(self, backend):
            self.calls += 1
            if self.calls == 1:
                raise OSError("old store unreachable")
            return await LegacyMarkdownReader().read_tree(backend)

    async def scenario():
        await old.write(TREE)
        repo = JsonMarkdownDocsRepository(file_path=tmp_path / "markdown-docs.json")
        uc = MarkdownDocsUseCase(repo, Flaky(), None, backend="json", clock=Clock())
        try:
            await uc.ensure_migrated()
        except OSError:
            pass
        state_after_failure = json.loads(await repo.get_meta(SPACE, MIGRATION_KEY))["state"]
        count_after_failure = await repo.count(SPACE)
        await uc.ensure_migrated()
        return state_after_failure, count_after_failure, await repo.count(SPACE), await uc.is_migrated()

    assert arun(scenario()) == ("failed", 0, TREE_SIZE, True), "a hiccup is not a lock, and an unreadable store is not an empty one"


def test_a_corrupt_old_file_is_an_error_not_an_empty_migration(tmp_path, monkeypatch):
    old = OldStore("json", tmp_path, monkeypatch)

    async def scenario():
        old.path.write_text("{ this is not json", encoding="utf-8")
        uc, repo = migrating_uc(old)
        with pytest.raises(ValueError):
            await uc.ensure_migrated()
        return await uc.is_migrated(), await repo.count(SPACE)

    assert arun(scenario()) == (False, 0), "never mark a store migrated because it could not be read"


# ------------------------------------------------------------------ the old tree endpoint

def test_the_old_tree_rows_are_none_until_migrated_then_rebuilt_from_the_new_store(old):
    async def scenario():
        await old.write(TREE)
        uc, repo = migrating_uc(old)
        before = await uc.legacy_rows()
        await uc.ensure_migrated()
        await push_one(uc, file_op("file-a", "edited", base=1, parent="unset"))
        await push_one(uc, delete_op("file-b", base=1))
        return before, await uc.legacy_rows()

    before, rows = arun(scenario())
    assert before is None
    by_id = {r["id"]: r for r in rows}
    assert "file-b" not in by_id, "a deleted node does not come back through the old endpoint"
    assert by_id["file-a"]["content"] == "edited" and by_id["file-a"]["node_type"] == "file" and by_id["file-a"]["parent_id"] == "folder-1"
    assert rows[0]["id"] == "root" and [r["sort_order"] for r in rows] == list(range(len(rows)))
    assert set(rows[0]) == {"id", "name", "node_type", "content", "parent_id", "sort_order"}


def test_a_loop_of_folders_is_cut_so_everything_stays_reachable(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path)
        await uc.ensure_migrated()
        for doc_id, parent in (("fa", "fb"), ("fb", "fa"), ("fc", "fa")):
            await repo.insert(SPACE, DocRecord(id=doc_id, kind="folder", parentId=parent, name=doc_id, rev=1, contentRev=1, metaRev=1,
                                               createdAt=T0, updatedAt=T0, serverUpdatedAt=T0))
        return {r["id"]: r["parent_id"] for r in await uc.legacy_rows()}

    parents = arun(scenario())
    assert parents["fa"] is None and parents["fb"] == "fa" and parents["fc"] == "fa"


def test_plan_migration_is_pure_and_keeps_the_order_parents_first(tmp_path):
    uc, _repo, _clock = make_uc(tmp_path)
    rows = [
        {"id": "root", "name": "Notes", "kind": "folder", "content": None, "parent_id": None},
        {"id": "f1", "name": "a.md", "kind": "file", "content": "text", "parent_id": "root"},
        {"id": "orphan", "name": "o.md", "kind": "file", "content": "x", "parent_id": "missing-parent"},
    ]
    records, revisions, id_map, skipped = uc.plan_migration(rows, T0)
    assert [r.id for r in records] == ["root", "f1", "orphan"] and id_map == {} and skipped == []
    assert records[2].parentId == "missing-parent", "the server keeps what was there: orphans reach the top when the tree is built"
    assert [(r.docId, r.origin) for r in revisions] == [("f1", "migrate"), ("orphan", "migrate")]
    assert [r.serverUpdatedAt for r in records] == [T0 - 3, T0 - 2, T0 - 1], "in the past, one stamp per node, never ahead of the clock"
    assert HORIZON_KEY == "horizon"


class Fixed(LegacyMarkdownReaderPort):
    """An old store that is just these rows."""

    def __init__(self, rows):
        self.rows = rows

    async def read_tree(self, backend):
        return self.rows


def test_a_document_pushed_during_a_paged_first_pull_is_not_lost_behind_the_cursor(tmp_path):
    """Migrated nodes were stamped `now + index`: ahead of the clock. A device pulling the migrated tree page by page
    holds the stamp of the last record it got as its cursor, so a document ANOTHER device pushed meanwhile - stamped
    with the clock, which is behind that - sat before the cursor and never reached the puller."""
    rows = [{"id": "root", "name": "Notes", "kind": "folder", "content": None, "parent_id": None}] + [
        {"id": f"old-{n}", "name": f"old {n}.md", "kind": "file", "content": f"text {n}", "parent_id": "root"} for n in range(5)
    ]

    async def scenario():
        clock = Clock()
        repo = JsonMarkdownDocsRepository(file_path=tmp_path / "markdown-docs.json")
        uc = MarkdownDocsUseCase(repo, Fixed(rows), None, clock=clock, page_items=2)
        first = await uc.changes(0, None, "md-puller")
        assert first["more"] is True
        await push_one(uc, file_op("newcomer", "pushed meanwhile", name="newcomer.md"), device="md-pusher")
        seen = [item["id"] for item in first["items"]]
        cursor = first["cursor"]
        for _ in range(20):
            page = await uc.changes(cursor, None, "md-puller")
            seen.extend(item["id"] for item in page["items"])
            cursor = page["cursor"]
            if not page["more"]:
                break
        stamps = [r.serverUpdatedAt for r in await repo.list_since(SPACE, 0, 100, True) if r.device == "legacy"]
        return seen, stamps, clock.now

    seen, stamps, now = arun(scenario())
    assert sorted(seen) == sorted(["root", "newcomer"] + [f"old-{n}" for n in range(5)]), "nothing migrated, nothing pushed is missed"
    assert len(stamps) == 6 and max(stamps) < now, "every migrated stamp is behind the clock"
    assert len(set(stamps)) == 6, "and each node has its own, so the tree pages instead of being one run"


def test_planning_the_copy_of_a_big_old_tree_runs_off_the_event_loop(tmp_path):
    """Hashing and compressing the whole old tree (megabytes) is CPU: it is paid in a worker thread, so that the one
    request that triggers the copy does not stall every other request of the process."""
    rows = [{"id": f"old-{n}", "name": f"old {n}.md", "kind": "file", "content": "a line of text\n" * 4000, "parent_id": None} for n in range(3)]

    async def scenario():
        repo = JsonMarkdownDocsRepository(file_path=tmp_path / "markdown-docs.json")
        uc = MarkdownDocsUseCase(repo, Fixed(rows), None, clock=Clock())
        real = uc.plan_migration

        def slow(*args):
            time.sleep(0.5)
            return real(*args)

        uc.plan_migration = slow
        async with LoopWatch() as watch:
            await uc.ensure_migrated()
        return watch.longest, await repo.count(SPACE)

    longest_stall, count = arun(scenario())
    assert count == 3 and longest_stall < 0.25, f"the loop was stuck for {longest_stall:.2f} s"
