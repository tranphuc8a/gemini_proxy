"""Version history written from the first push on (md-sync B8): one row per change of text, keyframes
and line deltas, coalescing, compression, and rebuilding every row back to the text that was saved.

JSON store on `tmp_path`, fake clock. History rows are read through the store (`list_revisions` /
`get_revision`) and through the use case (`list_revisions` / `get_revision`, what the routes serve).
"""

import os

os.environ.setdefault("TESTING", "1")

import random
import time

import pytest

from src.application.exceptions.exceptions import AppException, NotFoundError
from src.application.usecases.markdown_docs_usecase import (
    COMPRESS_ABOVE_BYTES,
    KEYFRAME_EVERY,
    pack_body,
    unpack_body,
)
from src.application.utils.line_patch import join_lines, sha256_hex
from tests.conftest import arun
from tests.support.markdown_docs import (
    T0, LoopWatch, delete_op, file_op, make_uc, meta_op, patch_op, push_one, repetitive_lines, shuffled_vocabulary,
)

SPACE = "default"
MINUTE = 60_000


def article(lines: int = 120, seed: int = 0) -> str:
    """A text of about 6 KB per 120 lines - over the 2 KB below which history stores whole text."""
    rng = random.Random(seed)
    words = ["alpha", "beta", "gamma", "delta", "tiếng", "việt", "ệ", "markdown", "đồng", "bộ"]
    return "\n".join(f"{n}: " + " ".join(rng.choice(words) for _ in range(9)) for n in range(lines)) + "\n"


def edit_line(text: str, line: int, replacement: str) -> str:
    rows = text.split("\n")
    rows[line] = replacement
    return "\n".join(rows)


async def rows_of(repo, doc_id="d1"):
    return [(row.rev, row.encoding) for row in await repo.list_revisions(SPACE, doc_id)]


# -------------------------------------------------------------- when a row is written

def test_only_a_change_of_text_adds_a_row(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path, coalesce_ms=0)
        text = article()
        await push_one(uc, file_op("d1", text, name="a.md"))
        await push_one(uc, file_op("d1", text, base=1))                                   # the same text again
        await push_one(uc, meta_op("d1", base=1, name="b.md"))                            # a rename
        await push_one(uc, file_op("d1", text + "more\n", base=2))                        # a real edit
        return await rows_of(repo)

    assert arun(scenario()) == [(1, "full"), (3, "delta")], "rev 2 was a rename: it has no text to remember"


def test_each_row_carries_who_when_and_what_it_was_called(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path, coalesce_ms=0)
        await push_one(uc, file_op("d1", "first", name="a.md", parent="root"), device="md-aaa")
        clock.advance(5 * MINUTE)
        await push_one(uc, file_op("d1", "second", base=1, updatedAt=T0 + 777), device="md-bbb")
        return await repo.list_revisions(SPACE, "d1")

    first, second = arun(scenario())
    assert (first.rev, first.device, first.origin, first.name, first.parentId, first.savedAt) == (1, "md-aaa", "edit", "a.md", "root", T0)
    assert (second.rev, second.device, second.savedAt, second.updatedAt) == (2, "md-bbb", T0 + 5 * MINUTE, T0 + 777)
    assert second.hash == sha256_hex("second") and second.size == 6 and second.deleted is False


def test_a_folder_has_no_history(tmp_path):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        await push_one(uc, {"id": "fo", "kind": "folder", "baseRev": 0, "set": {"name": "Notes", "parentId": "root"}, "updatedAt": T0})
        await push_one(uc, meta_op("fo", base=1, kind="folder", name="Renamed"))
        return await repo.list_revisions(SPACE, "fo")

    assert arun(scenario()) == []


def test_deleting_adds_a_row_without_text(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path)
        await push_one(uc, file_op("d1", article(), name="a.md"))
        await push_one(uc, delete_op("d1", base=1), device="md-bbb")
        rows = await repo.list_revisions(SPACE, "d1")
        return rows, await uc.get_revision("d1", 2), await uc.get_revision("d1", 1)

    rows, gone, before = arun(scenario())
    assert [(row.rev, row.encoding, row.origin, row.deleted, row.device) for row in rows] == [
        (1, "full", "edit", False, "dev-a"), (2, "none", "delete", True, "md-bbb")]
    assert gone["content"] is None and gone["deleted"] is True
    assert before["content"] == article(), "the text before the delete is still there to restore from"


# ------------------------------------------------------------------ keyframe vs delta

def test_the_first_row_and_small_texts_are_stored_whole_and_big_ones_as_a_delta(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path, coalesce_ms=0)
        await push_one(uc, file_op("small", "tiny text", name="s.md"))
        await push_one(uc, file_op("small", "tiny text, edited", base=1))
        big = article()
        await push_one(uc, file_op("d1", big, name="b.md"))
        await push_one(uc, file_op("d1", edit_line(big, 10, "one line changed"), base=1))
        small_rows = await repo.list_revisions(SPACE, "small")
        big_rows = await repo.list_revisions(SPACE, "d1")
        return small_rows, big_rows, await repo.get_revision(SPACE, "d1", 2)

    small_rows, big_rows, delta_row = arun(scenario())
    assert [row.encoding for row in small_rows] == ["full", "full"], "under 2 KB a delta saves nothing"
    assert [(row.rev, row.encoding, row.baseRev) for row in big_rows] == [(1, "full", None), (2, "delta", 1)]
    assert len(delta_row.body) < 300 and delta_row.compressed is False, "one line, not the 6 KB text"


def test_a_delta_is_always_against_a_keyframe_and_a_new_keyframe_comes_every_fifty(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path, coalesce_ms=0, keep_recent=500, daily_days=0)
        text = article()
        await push_one(uc, file_op("d1", text, name="a.md"))
        for step in range(2, 2 * KEYFRAME_EVERY + 5):
            text = edit_line(text, step % 100, f"edit number {step}")
            await push_one(uc, file_op("d1", text, base=step - 1))
        return await repo.list_revisions(SPACE, "d1")

    rows = arun(scenario())
    frames = [row.rev for row in rows if row.encoding == "full"]
    assert frames == [1, 1 + KEYFRAME_EVERY, 1 + 2 * KEYFRAME_EVERY], "a keyframe whenever 50 revisions have passed"
    by_rev = {row.rev: row for row in rows}
    for row in rows:
        if row.encoding == "delta":
            base = by_rev[row.baseRev]
            assert base.encoding == "full" and row.baseRev == max(f for f in frames if f < row.rev), "never a chain of deltas"


def test_a_rewrite_bigger_than_half_the_text_is_stored_whole(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path, coalesce_ms=0)
        await push_one(uc, file_op("d1", article(seed=1), name="a.md"))
        await push_one(uc, file_op("d1", article(seed=2), base=1))                          # every line is different
        return await rows_of(repo)

    assert arun(scenario()) == [(1, "full"), (2, "full")]


def test_a_document_too_long_to_diff_is_always_a_keyframe(tmp_path, monkeypatch):
    from src.application.usecases import markdown_docs_usecase as module

    monkeypatch.setattr(module, "MAX_DIFF_LINES", 50)

    async def scenario():
        uc, repo, clock = make_uc(tmp_path, coalesce_ms=0)
        text = article(lines=200)
        await push_one(uc, file_op("d1", text, name="a.md"))
        await push_one(uc, file_op("d1", edit_line(text, 3, "one line"), base=1))           # a one-line edit still diffs
        wide = "\n".join(f"changed {n}" if 20 <= n < 120 else row for n, row in enumerate(text.split("\n")))
        await push_one(uc, file_op("d1", wide, base=2))                                      # 100 lines differ: past the limit of 50
        return await rows_of(repo)

    assert arun(scenario()) == [(1, "full"), (2, "delta"), (3, "full")]


def test_a_big_document_with_repeated_lines_is_pushed_without_stalling_the_server(tmp_path):
    """The shape that took ~5.6 s on the event loop at 12,000 lines (a quarter blank, edits near the head and the
    tail): `make_delta` ran inline in the push and every other request of the process waited for it."""
    lines = repetitive_lines(random.Random(11), 20_000)
    edited = list(lines)
    edited[3] = "EDITED NEAR THE HEAD"
    edited[-4] = "EDITED NEAR THE TAIL"
    old, new = join_lines(lines), join_lines(edited)

    async def scenario():
        uc, repo, clock = make_uc(tmp_path, coalesce_ms=0)
        await push_one(uc, file_op("d1", old, name="a.md"))
        async with LoopWatch() as watch:
            started = time.perf_counter()
            result = await push_one(uc, file_op("d1", new, base=1))
            elapsed = time.perf_counter() - started
        rebuilt = await uc.get_revision("d1", 2)
        return result, elapsed, watch.longest, await rows_of(repo), rebuilt["content"]

    result, elapsed, longest_stall, rows, rebuilt = arun(scenario())
    assert result["status"] == "ok" and rows == [(1, "full"), (2, "delta")], "still a delta, not a whole second copy"
    assert elapsed < 1.0, f"the push took {elapsed:.2f} s"
    assert longest_stall < 0.3, f"the loop was stuck for {longest_stall:.2f} s"
    assert rebuilt == new


def test_the_history_encoding_of_a_big_text_runs_off_the_event_loop(tmp_path, monkeypatch):
    """Whatever the diff costs (here: 0.5 s of pure blocking), it is paid in a worker thread for a big document."""
    from src.application.usecases import markdown_docs_usecase as module

    real = module.encode_revision_body

    def slow(keyframe, content):
        time.sleep(0.5)
        return real(keyframe, content)

    monkeypatch.setattr(module, "encode_revision_body", slow)

    async def scenario():
        uc, repo, clock = make_uc(tmp_path, coalesce_ms=0)
        text = article(lines=2500)
        assert len(text.encode("utf-8")) > module.INLINE_CPU_BYTES
        await push_one(uc, file_op("d1", text, name="a.md"))
        async with LoopWatch() as watch:
            await push_one(uc, file_op("d1", edit_line(text, 1200, "an edit"), base=1))
        return watch.longest, await rows_of(repo)

    longest_stall, rows = arun(scenario())
    assert rows == [(1, "full"), (2, "delta")]
    assert longest_stall < 0.25, f"the loop was stuck for {longest_stall:.2f} s"


def test_rebuilding_a_big_version_runs_off_the_event_loop(tmp_path, monkeypatch):
    """Unzip + apply the delta + SHA-256 of a megabyte is CPU too: reading history must not stall other requests."""
    from src.application.usecases import markdown_docs_usecase as module

    real = module.decode_revision

    def slow(row, keyframe):
        time.sleep(0.5)
        return real(row, keyframe)

    async def scenario():
        uc, repo, clock = make_uc(tmp_path, coalesce_ms=0)
        text = article(lines=2500)
        await push_one(uc, file_op("d1", text, name="a.md"))
        await push_one(uc, file_op("d1", edit_line(text, 1200, "an edit"), base=1))
        monkeypatch.setattr(module, "decode_revision", slow)
        async with LoopWatch() as watch:
            rebuilt = await uc.get_revision("d1", 2)
        return watch.longest, rebuilt["content"] == edit_line(text, 1200, "an edit")

    longest_stall, same = arun(scenario())
    assert same and longest_stall < 0.25, f"the loop was stuck for {longest_stall:.2f} s"


def test_a_text_that_cannot_be_diffed_cheaply_is_stored_whole_and_rebuilds(tmp_path):
    """150 distinct lines repeated 130 times each, then shuffled: the diff is refused by its budget, so the push
    stores a keyframe (not a hang) and every version still rebuilds."""
    old_lines, new_lines = shuffled_vocabulary(random.Random(12), 20_000)
    old, new = join_lines(old_lines), join_lines(new_lines)

    async def scenario():
        uc, repo, clock = make_uc(tmp_path, coalesce_ms=0)
        await push_one(uc, file_op("d1", old, name="a.md"))
        started = time.perf_counter()
        result = await push_one(uc, file_op("d1", new, base=1))
        elapsed = time.perf_counter() - started
        return result, elapsed, await rows_of(repo), (await uc.get_revision("d1", 1))["content"], (await uc.get_revision("d1", 2))["content"]

    result, elapsed, rows, first, second = arun(scenario())
    assert result["status"] == "ok" and rows == [(1, "full"), (2, "full")]
    assert elapsed < 2.0, f"the push took {elapsed:.2f} s"
    assert first == old and second == new


def test_only_the_form_that_is_kept_is_compressed(tmp_path, monkeypatch):
    """A history row that turns out a delta no longer pays for zlib over the whole megabyte first."""
    from src.application.usecases import markdown_docs_usecase as module

    real = module.pack_body
    zlib_runs = []

    def counting(text):
        result = real(text)
        if result[1]:
            zlib_runs.append(len(text))
        return result

    monkeypatch.setattr(module, "pack_body", counting)

    async def scenario():
        uc, repo, clock = make_uc(tmp_path, coalesce_ms=0)
        text = article(lines=2500)
        await push_one(uc, file_op("d1", text, name="a.md"))
        after_keyframe = len(zlib_runs)
        await push_one(uc, file_op("d1", edit_line(text, 1200, "an edit"), base=1))
        return after_keyframe, len(zlib_runs), await rows_of(repo)

    after_keyframe, after_delta, rows = arun(scenario())
    assert rows == [(1, "full"), (2, "delta")]
    assert (after_keyframe, after_delta) == (1, 1), "the keyframe was compressed once; the delta row compressed nothing"


def test_big_bodies_are_compressed_and_come_back_exactly(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path, coalesce_ms=0)
        text = article(lines=2500)                                                         # well over 32 KB
        assert len(text.encode("utf-8")) > COMPRESS_ABOVE_BYTES
        await push_one(uc, file_op("d1", text, name="a.md"))
        edited = edit_line(text, 1200, "an edit in the middle")
        await push_one(uc, file_op("d1", edited, base=1))
        keyframe = await repo.get_revision(SPACE, "d1", 1)
        delta = await repo.get_revision(SPACE, "d1", 2)
        return text, edited, keyframe, delta, await uc.get_revision("d1", 1), await uc.get_revision("d1", 2)

    text, edited, keyframe, delta, rebuilt1, rebuilt2 = arun(scenario())
    assert keyframe.compressed is True and len(keyframe.body) < len(text) / 2, "prose compresses"
    assert delta.compressed is False, "a one-line delta is small enough to stay readable"
    assert rebuilt1["content"] == text and rebuilt2["content"] == edited


def test_pack_and_unpack_round_trip():
    small, flag = pack_body("short ệ")
    assert (small, flag) == ("short ệ", False)
    big, flag = pack_body("ệ" * 40_000)
    assert flag is True and unpack_body(big, flag) == "ệ" * 40_000


# ------------------------------------------------------------------------ coalescing

def test_edits_of_one_device_within_ten_minutes_share_one_row(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path)
        text = article()
        await push_one(uc, file_op("d1", text, name="a.md"), device="md-aaa")                     # rev 1: the keyframe
        for step in range(2, 8):
            clock.advance(MINUTE)
            await push_one(uc, file_op("d1", text + f"typed {step}\n", base=step - 1), device="md-aaa")
        return await rows_of(repo), await uc.get_revision("d1", 7)

    rows, last = arun(scenario())
    assert rows == [(1, "full"), (7, "delta")], "six quick edits are one version: its text is the last"
    assert last["content"].endswith("typed 7\n")


def test_another_device_or_ten_quiet_minutes_start_a_new_row(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path)
        text = article()
        await push_one(uc, file_op("d1", text, name="a.md"), device="md-aaa")
        clock.advance(MINUTE)
        await push_one(uc, file_op("d1", text + "1\n", base=1), device="md-aaa")           # rev 2: delta
        clock.advance(MINUTE)
        await push_one(uc, file_op("d1", text + "2\n", base=2), device="md-bbb")           # another device: new row
        clock.advance(10 * MINUTE)
        await push_one(uc, file_op("d1", text + "3\n", base=3), device="md-bbb")           # same device but 10 min later
        clock.advance(MINUTE)
        await push_one(uc, file_op("d1", text + "4\n", base=4), device="md-bbb")           # joins rev 4
        return await rows_of(repo)

    assert arun(scenario()) == [(1, "full"), (2, "delta"), (3, "delta"), (5, "delta")]


def test_a_named_version_is_never_swallowed_by_coalescing(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path)
        text = article()
        await push_one(uc, file_op("d1", text, name="a.md"), device="md-aaa")
        clock.advance(MINUTE)
        await push_one(uc, file_op("d1", text + "1\n", base=1), device="md-aaa")
        named = await repo.get_revision(SPACE, "d1", 2)
        await repo.add_revision(SPACE, named.model_copy(update={"label": "release 1.0"}))
        clock.advance(MINUTE)
        await push_one(uc, file_op("d1", text + "2\n", base=2), device="md-aaa")
        return await rows_of(repo)

    assert arun(scenario()) == [(1, "full"), (2, "delta"), (3, "delta")]


def test_a_delete_and_an_undelete_are_never_coalesced(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path)
        text = article()
        await push_one(uc, file_op("d1", text, name="a.md"))
        await push_one(uc, file_op("d1", text + "x\n", base=1))
        await push_one(uc, delete_op("d1", base=2))
        await push_one(uc, file_op("d1", text + "y\n", base=3, deleted=False))
        return await rows_of(repo)

    assert arun(scenario()) == [(1, "full"), (2, "delta"), (3, "none"), (4, "delta")]


# ------------------------------------------------------------- rebuilding what was saved

def test_every_kept_version_rebuilds_to_the_text_that_was_saved(tmp_path):
    """A journal of what each push stored, then every row of the history rebuilt and compared."""
    rng = random.Random(7)

    async def scenario():
        uc, repo, clock = make_uc(tmp_path, coalesce_ms=0, keep_recent=500)
        journal = {}
        text = article(lines=150)
        await push_one(uc, file_op("d1", text, name="a.md"))
        journal[1] = text
        rev = 1
        for step in range(70):
            kind = rng.random()
            if kind < 0.6:
                text = edit_line(text, rng.randrange(0, 150), f"changed {step} " + "w" * rng.randrange(0, 40))
            elif kind < 0.8:
                rows = text.split("\n")
                at = rng.randrange(0, len(rows))
                rows[at:at] = [f"inserted {step}.{n}" for n in range(rng.randrange(1, 6))]
                text = "\n".join(rows)
            elif kind < 0.95:
                rows = text.split("\n")
                at = rng.randrange(0, len(rows) - 10)
                del rows[at:at + rng.randrange(1, 8)]
                text = "\n".join(rows)
            else:
                text = article(lines=150, seed=step)                                      # a total rewrite
            clock.advance(MINUTE)
            result = await push_one(uc, file_op("d1", text, base=rev))
            rev = result["rev"]
            journal[rev] = text
        rebuilt = {row.rev: (await uc.get_revision("d1", row.rev))["content"] for row in await repo.list_revisions(SPACE, "d1")}
        return journal, rebuilt

    journal, rebuilt = arun(scenario())
    assert len(rebuilt) == 71
    for rev, content in rebuilt.items():
        assert content == journal[rev], f"revision {rev} does not rebuild to what was saved"


def test_rebuilding_needs_at_most_two_reads(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path, coalesce_ms=0)
        text = article()
        await push_one(uc, file_op("d1", text, name="a.md"))
        for step in range(2, 30):
            text = edit_line(text, step, f"edit {step}")
            await push_one(uc, file_op("d1", text, base=step - 1))
        reads = []
        real = repo.get_revision

        async def counting(space, doc_id, rev):
            reads.append(rev)
            return await real(space, doc_id, rev)

        repo.get_revision = counting
        await uc.get_revision("d1", 29)
        return reads

    reads = arun(scenario())
    assert reads == [29, 1], "the row, then its keyframe - never a chain"


# ----------------------------------------------------------------------- the read side

def test_the_listing_is_newest_first_pages_by_rev_and_never_carries_text(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path, coalesce_ms=0)
        text = article()
        await push_one(uc, file_op("d1", text, name="a.md"))
        for step in range(2, 8):
            await push_one(uc, file_op("d1", text + f"{step}\n", base=step - 1))
        return await uc.list_revisions("d1", None, 3), await uc.list_revisions("d1", 5, None), await uc.list_revisions("ghost", None, None)

    newest, older, ghost = arun(scenario())
    assert [row["rev"] for row in newest["items"]] == [7, 6, 5] and newest["more"] is True
    assert [row["rev"] for row in older["items"]] == [4, 3, 2, 1] and older["more"] is False
    assert all("body" not in row and "docId" not in row for row in newest["items"])
    assert set(newest["items"][0]) >= {"rev", "encoding", "baseRev", "origin", "device", "savedAt", "updatedAt", "name", "hash", "size", "label"}
    assert ghost == {"items": [], "more": False}


def test_a_version_that_is_gone_is_a_404_with_a_code(tmp_path):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        await push_one(uc, file_op("d1", "text", name="a.md"))
        await uc.get_revision("d1", 99)

    with pytest.raises(NotFoundError) as error:
        arun(scenario())
    assert error.value.payload["code"] == "md_revision_not_found"


def test_a_row_that_no_longer_rebuilds_says_so_instead_of_returning_wrong_text(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path, coalesce_ms=0)
        text = article()
        await push_one(uc, file_op("d1", text, name="a.md"))
        await push_one(uc, file_op("d1", edit_line(text, 3, "changed"), base=1))
        row = await repo.get_revision(SPACE, "d1", 2)
        await repo.add_revision(SPACE, row.model_copy(update={"body": '{"v":1,"h":[[0,1,["tampered"]]]}'}))
        try:
            await uc.get_revision("d1", 2)
        except AppException as error:
            return error.status_code, error.payload["code"]

    assert arun(scenario()) == (500, "md_history_broken")


def test_a_lost_keyframe_is_reported_not_guessed(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path, coalesce_ms=0)
        text = article()
        await push_one(uc, file_op("d1", text, name="a.md"))
        await push_one(uc, file_op("d1", edit_line(text, 3, "changed"), base=1))
        await repo.delete_revisions(SPACE, "d1", [1])
        try:
            await uc.get_revision("d1", 2)
        except AppException as error:
            return error.status_code, error.payload["code"]

    assert arun(scenario()) == (500, "md_history_broken")


def test_a_patch_push_writes_the_same_history_as_a_whole_text_push(tmp_path):
    (tmp_path / "patch").mkdir()
    (tmp_path / "whole").mkdir()

    async def scenario():
        text = article()
        edited = edit_line(text, 20, "via patch")
        uc, repo, _ = make_uc(tmp_path / "patch", coalesce_ms=0)
        await push_one(uc, file_op("d1", text, name="a.md"))
        await push_one(uc, patch_op("d1", text, edited, base=1))
        uc2, repo2, _ = make_uc(tmp_path / "whole", coalesce_ms=0)
        await push_one(uc2, file_op("d1", text, name="a.md"))
        await push_one(uc2, file_op("d1", edited, base=1))
        a = [(row.rev, row.encoding, row.body, row.hash) for row in [await repo.get_revision(SPACE, "d1", r) for r in (1, 2)]]
        b = [(row.rev, row.encoding, row.body, row.hash) for row in [await repo2.get_revision(SPACE, "d1", r) for r in (1, 2)]]
        return a, b

    a, b = arun(scenario())
    assert a == b


def test_history_survives_a_restart_of_the_store(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path, coalesce_ms=0)
        text = article()
        await push_one(uc, file_op("d1", text, name="a.md"))
        await push_one(uc, file_op("d1", edit_line(text, 5, "second"), base=1))
        again, _repo2, _ = make_uc(tmp_path, clock=clock)                                  # a new process on the same files
        return (await again.get_revision("d1", 2))["content"], edit_line(text, 5, "second")

    got, want = arun(scenario())
    assert got == want
