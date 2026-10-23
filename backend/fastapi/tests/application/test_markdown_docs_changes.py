"""Pulling changes (md-sync B7) and reading one document (the door md-share's live mode will use).

`MarkdownDocsUseCase.changes` on a JSON store in `tmp_path` with a fake clock: the cursor rules (it
trails the clock, a page never ends between equal stamps, nothing is skipped or delivered twice over
a whole pull), tombstones, the device filter, the horizon, and `get_document`.
"""

import os

os.environ.setdefault("TESTING", "1")

import pytest

from src.application.exceptions.exceptions import NotFoundError
from src.application.utils.line_patch import sha256_hex
from src.application.utils.sync_paging import cut_page
from src.domain.vo.markdown_docs_vo import SYNC_LAG_MS, DocRecord
from tests.conftest import arun
from tests.support.markdown_docs import DAY, T0, delete_op, file_op, make_uc, meta_op, push, push_one

SPACE = "default"


def raw_record(doc_id: str, stamp: int, content: str = "x", **extra) -> DocRecord:
    """A record written straight into a store, to control its `serverUpdatedAt` exactly."""
    fields = dict(
        id=doc_id, kind="file", parentId="root", name=f"{doc_id}.md", content=content, hash=sha256_hex(content),
        size=len(content.encode("utf-8")), rev=1, contentRev=1, metaRev=1, deleted=False, createdAt=T0,
        updatedAt=T0, serverUpdatedAt=stamp, device="dev-x",
    )
    fields.update(extra)
    return DocRecord(**fields)


async def pull_all(uc, since=0, device="", limit=None, max_calls=200):
    """Follow the cursor to the end like a client does: `(batches, final cursor)`."""
    batches = []
    for _ in range(max_calls):
        answer = await uc.changes(since, limit, device)
        batches.append([item["id"] for item in answer["items"]])
        since = answer["cursor"]
        if not answer["more"]:
            return batches, since
    raise AssertionError("the pull never ended")


# ------------------------------------------------------------------ what a pull carries

def test_the_first_pull_skips_tombstones_and_a_later_one_carries_them(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path)
        await push(uc, file_op("keep", "alive", name="keep.md"), file_op("gone", "soon", name="gone.md"))
        await push_one(uc, delete_op("gone", base=1))
        first = await uc.changes(0, None, "")
        later = await uc.changes(T0 - 1, None, "")
        return first, later

    first, later = arun(scenario())
    assert [item["id"] for item in first["items"]] == ["keep"], "a client with nothing needs no grave markers"
    tomb = next(item for item in later["items"] if item["id"] == "gone")
    assert {item["id"] for item in later["items"]} == {"keep", "gone"}
    assert tomb["deleted"] is True and tomb["content"] is None and tomb["hash"] == "" and tomb["rev"] == 2


def test_items_come_oldest_first_and_carry_the_whole_record(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path)
        await push_one(uc, file_op("a", "A", name="a.md"))
        clock.advance(5000)
        await push_one(uc, file_op("b", "B", name="b.md"))
        clock.advance(5000)
        await push_one(uc, file_op("a", "A2", base=1), device="dev-b")      # "a" is now the newest
        return await uc.changes(0, None, "")

    answer = arun(scenario())
    assert [item["id"] for item in answer["items"]] == ["b", "a"]
    record = answer["items"][1]
    assert (record["content"], record["rev"], record["contentRev"], record["metaRev"], record["device"], record["name"]) == (
        "A2", 2, 2, 1, "dev-b", "a.md")
    assert record["hash"] == sha256_hex("A2") and record["size"] == 2 and record["kind"] == "file"


def test_a_rename_is_a_change_too(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path)
        await push_one(uc, file_op("a", "A", name="a.md"))
        cursor = (await uc.changes(0, None, ""))["cursor"]
        clock.advance(10_000)
        await push_one(uc, meta_op("a", base=1, name="renamed.md"))
        return await uc.changes(cursor, None, "")

    answer = arun(scenario())
    assert [(item["id"], item["name"], item["metaRev"]) for item in answer["items"]] == [("a", "renamed.md", 2)]


def test_a_device_gets_its_own_writes_without_text_but_everyone_elses_with_it(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path)
        await push_one(uc, file_op("mine", "my text", name="m.md"), device="md-aaa")
        await push_one(uc, file_op("theirs", "their text", name="t.md"), device="md-bbb")
        return await uc.changes(T0 - 1, None, "md-aaa"), await uc.changes(T0 - 1, None, "")      # an incremental pull

    as_a, anonymous = arun(scenario())
    by_id = {item["id"]: item for item in as_a["items"]}
    assert by_id["mine"]["content"] is None and by_id["mine"]["hash"] == sha256_hex("my text"), "the hash stays: the client checks it"
    assert by_id["theirs"]["content"] == "their text"
    assert {item["id"]: item["content"] for item in anonymous["items"]} == {"mine": "my text", "theirs": "their text"}


def test_a_full_pull_brings_the_text_of_the_devices_own_writes_too(tmp_path):
    """`since=0` is a full reconciliation: a device whose IndexedDB was cleared (or evicted) while its `deviceId` in
    localStorage survived asks for everything and must get the text, even of what it wrote itself - it has nothing."""
    async def scenario():
        uc, repo, clock = make_uc(tmp_path)
        await push_one(uc, file_op("mine", "my text", name="m.md"), device="md-aaa")
        full = await uc.changes(0, None, "md-aaa")
        incremental = await uc.changes(T0 - 1, None, "md-aaa")
        return full, incremental

    full, incremental = arun(scenario())
    assert {item["id"]: item["content"] for item in full["items"]} == {"mine": "my text"}
    assert {item["id"]: item["content"] for item in incremental["items"]} == {"mine": None}, "the incremental pull still saves the bytes"


# ------------------------------------------------------------------------ the cursor

def test_the_cursor_trails_the_clock_so_a_late_commit_is_not_skipped(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path)
        await push_one(uc, file_op("a", "A", name="a.md"))
        clock.advance(10_000)
        done = await uc.changes(0, None, "")
        await push_one(uc, file_op("b", "B", name="b.md"))                  # stamped "now", right after the poll
        just_now = await uc.changes(done["cursor"], None, "")
        return done, just_now, clock.now

    done, just_now, now = arun(scenario())
    assert done["cursor"] == now - SYNC_LAG_MS and done["more"] is False
    assert [item["id"] for item in just_now["items"]] == ["b"]


def test_a_record_written_inside_the_lag_window_is_delivered_again_not_lost(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path)
        await push_one(uc, file_op("a", "A", name="a.md"))
        first = await uc.changes(0, None, "")
        second = await uc.changes(first["cursor"], None, "")                 # nothing happened since: the same record, again
        clock.advance(SYNC_LAG_MS + 100)
        third = await uc.changes(second["cursor"], None, "")                 # the window has passed, the old cursor still sees it
        fourth = await uc.changes(third["cursor"], None, "")                 # ...and the cursor this answer gave does not
        return first, second, third, fourth

    first, second, third, fourth = arun(scenario())
    assert [i["id"] for i in first["items"]] == ["a"] and [i["id"] for i in second["items"]] == ["a"], "redelivery is the price of never missing one"
    assert [i["id"] for i in third["items"]] == ["a"] and third["cursor"] > T0
    assert fourth["items"] == [], "once the window has passed the cursor moves beyond it"


def test_the_cursor_never_goes_backwards(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path)
        far_ahead = T0 + 3_600_000
        return await uc.changes(far_ahead, None, "")

    assert arun(scenario())["cursor"] == T0 + 3_600_000


def test_a_whole_pull_delivers_every_record_once_and_a_late_edit_after_it(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path, page_items=7)
        for batch in range(4):
            await push(uc, *[file_op(f"d{batch}-{n}", f"text {batch}-{n}", name=f"d{batch}-{n}.md") for n in range(6)])
            clock.advance(1000)
        batches, cursor = await pull_all(uc)
        clock.advance(10_000)
        await push_one(uc, file_op("d0-0", "edited", base=1))
        after, _ = await pull_all(uc, since=cursor)
        return batches, after

    batches, after = arun(scenario())
    delivered = [doc_id for batch in batches for doc_id in batch]
    assert len(batches) >= 4 and all(len(batch) <= 7 for batch in batches)
    assert sorted(delivered) == sorted(f"d{b}-{n}" for b in range(4) for n in range(6))
    assert len(delivered) == len(set(delivered)), "no record twice while the cursor walks the pages"
    assert after == [["d0-0"]] or "d0-0" in [i for batch in after for i in batch]


def test_limit_asks_for_a_smaller_page_and_cannot_ask_for_a_bigger_one(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path, page_items=5)
        await push(uc, *[file_op(f"f{n}", "x", name=f"f{n}.md") for n in range(12)])
        small = await uc.changes(0, 2, "")
        big = await uc.changes(0, 1000, "")
        return small, big

    small, big = arun(scenario())
    assert len(small["items"]) == 2 and small["more"] is True
    assert len(big["items"]) == 5 and big["more"] is True, "the server's page size is a ceiling"


# ------------------------------------------------------------ equal stamps and byte budget

def test_a_page_never_ends_between_two_records_that_share_a_stamp(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path, page_items=2)
        clock.now = T0 + 10 * DAY                                           # far ahead of the stamps below
        for doc_id, stamp in (("a", 100), ("b", 200), ("c", 200), ("d", 200), ("e", 300)):
            assert await repo.insert(SPACE, raw_record(doc_id, stamp))
        return await pull_all(uc)

    batches, _ = arun(scenario())
    delivered = [doc_id for batch in batches for doc_id in batch]
    assert sorted(delivered) == ["a", "b", "c", "d", "e"], "a record sharing its neighbour's stamp must not be lost"
    assert len(delivered) == len(set(delivered))
    assert ["b", "c", "d"] in batches, "the run of equal stamps travels whole"


def test_one_record_at_a_time_loses_nothing_even_when_stamps_collide(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path)
        clock.now = T0 + 10 * DAY
        for doc_id in ("a", "b", "c", "d", "e", "f"):
            assert await repo.insert(SPACE, raw_record(doc_id, 500))        # six writes in the same millisecond
        return await pull_all(uc, limit=1)

    batches, _ = arun(scenario())
    assert sorted(i for batch in batches for i in batch) == ["a", "b", "c", "d", "e", "f"]


def test_a_run_longer_than_one_fetch_is_still_delivered_whole(tmp_path):
    """More equal stamps than the first fetch holds: the use case looks further instead of cutting the run."""
    async def scenario():
        uc, repo, clock = make_uc(tmp_path, page_items=3)
        clock.now = T0 + 10 * DAY
        ids = [f"r{n:02d}" for n in range(20)]
        for doc_id in ids:
            assert await repo.insert(SPACE, raw_record(doc_id, 700))
        await repo.insert(SPACE, raw_record("z", 800))
        batches, _ = await pull_all(uc)
        return ids, batches

    ids, batches = arun(scenario())
    assert sorted(i for batch in batches for i in batch) == sorted(ids + ["z"])
    assert max(len(batch) for batch in batches) == 20


def test_a_page_over_the_byte_budget_still_carries_one_record_and_the_pull_continues(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path, page_bytes=1000)
        for n in range(4):
            await push_one(uc, file_op(f"big{n}", "y" * 3000, name=f"big{n}.md"))
            clock.advance(10)
        return await pull_all(uc)

    batches, _ = arun(scenario())
    assert [len(batch) for batch in batches] == [1, 1, 1, 1]
    assert [batch[0] for batch in batches] == ["big0", "big1", "big2", "big3"]


def test_cut_page_is_pure_and_keeps_the_records_it_cannot_place():
    def stamp(item):
        return item[1]

    found = [("a", 1), ("b", 2), ("c", 2), ("d", 3)]
    page, more = cut_page(found, 2, 10**9, lambda item: 1, stamp)
    assert page == [("a", 1)] and more is True, "ends before the run of 2s"
    page, more = cut_page(found[:2], 2, 10**9, lambda item: 1, stamp)
    assert page == found[:2] and more is False
    page, more = cut_page([("a", 1), ("b", 1), ("c", 1)], 2, 10**9, lambda item: 1, stamp)
    assert [i for i, _ in page] == ["a", "b", "c"] and more is False, "a page that is only one run is delivered whole"
    assert cut_page([], 5, 100, lambda item: 1, stamp) == ([], False)


# ------------------------------------------------------------------------- the horizon

def test_a_client_older_than_the_tombstone_horizon_is_told_to_reconcile(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path, tombstone_days=90)
        await push(uc, file_op("a", "A", name="a.md"), file_op("b", "B", name="b.md"))
        await push_one(uc, delete_op("b", base=1))
        before_purge = await uc.changes(T0 - 1, None, "")
        clock.advance(91 * DAY)
        purged = await uc.purge_expired_tombstones()
        stale = await uc.changes(T0 + 10, None, "")                         # a device last seen 91 days ago
        fresh = await uc.changes(clock.now - 1000, None, "")
        first = await uc.changes(0, None, "")
        return before_purge, purged, stale, fresh, first, await repo.get(SPACE, "b")

    before_purge, purged, stale, fresh, first, gone = arun(scenario())
    assert before_purge["horizon"] == 0 and before_purge["reset"] is False
    assert purged == ["b"] and gone is None
    assert stale["horizon"] > T0 and stale["reset"] is True
    assert fresh["reset"] is False, "a device that kept up never has to start over"
    assert first["reset"] is False, "since=0 already is a full pull"


def test_purging_a_tombstone_drops_its_history_too(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path, tombstone_days=30)
        await push_one(uc, file_op("a", "A", name="a.md"))
        await push_one(uc, delete_op("a", base=1))
        had = [row.rev for row in await repo.list_revisions(SPACE, "a")]
        clock.advance(31 * DAY)
        await uc.purge_expired_tombstones()
        return had, await repo.list_revisions(SPACE, "a"), await repo.get(SPACE, "a")

    had, left, record = arun(scenario())
    assert had == [1, 2] and left == [] and record is None


def test_a_live_document_is_never_purged(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path, tombstone_days=1)
        await push_one(uc, file_op("a", "A", name="a.md"))
        clock.advance(400 * DAY)
        return await uc.purge_expired_tombstones(), (await repo.get(SPACE, "a")).content

    assert arun(scenario()) == ([], "A")


# ------------------------------------------------------------ one document by its id

def test_get_document_returns_the_latest_record_with_its_text(tmp_path):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        await push_one(uc, file_op("doc-1", "v1", name="a.md"))
        await push_one(uc, file_op("doc-1", "# v2\n", base=1))
        return await uc.get_document("doc-1")

    record = arun(scenario())
    assert (record["content"], record["rev"], record["contentRev"], record["hash"]) == ("# v2\n", 2, 2, sha256_hex("# v2\n"))


@pytest.mark.parametrize("doc_id", ["ghost", "a/b", "x" * 81, "", "ả ê"])
def test_get_document_of_nothing_is_a_404_with_a_code(tmp_path, doc_id):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        await uc.get_document(doc_id)

    with pytest.raises(NotFoundError) as error:
        arun(scenario())
    assert error.value.payload["code"] == "md_doc_not_found"


def test_get_document_of_a_deleted_one_does_not_serve_the_tombstone(tmp_path):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        await push_one(uc, file_op("doc-1", "secret", name="a.md"))
        await push_one(uc, delete_op("doc-1", base=1))
        await uc.get_document("doc-1")

    with pytest.raises(NotFoundError) as error:
        arun(scenario())
    assert error.value.payload["code"] == "md_doc_not_found"
