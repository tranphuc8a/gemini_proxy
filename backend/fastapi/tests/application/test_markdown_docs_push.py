"""Pushing node changes (md-sync B6): the decisions of `MarkdownDocsUseCase.push`, op by op.

JSON store on `tmp_path`, a fake clock. The decision table is the design's (md-sync §3.4): CAS on `rev`,
content and meta judged apart, edit beats delete, replays are harmless, the server verifies hashes.
"""

import os

os.environ.setdefault("TESTING", "1")

import json
import time

import pytest
from sqlalchemy import text

from src.adapter.output.markdown_docs import mongo_repository
from src.adapter.output.markdown_docs.json_repository import JsonMarkdownDocsRepository
from src.adapter.output.markdown_docs.mongo_repository import MongoMarkdownDocsRepository
from src.adapter.output.markdown_docs.mysql_repository import MySqlMarkdownDocsRepository
from src.application.exceptions.exceptions import AppException
from src.application.usecases.markdown_docs_usecase import ITEM_OVERHEAD_BYTES, MarkdownDocsUseCase
from src.application.utils.line_patch import sha256_hex
from src.domain.vo.markdown_docs_vo import MetaIn, PushOp, PushRequest
from tests.conftest import arun
from tests.support import fake_mongo
from tests.support.markdown_docs import (
    DAY, T0, Clock, LoopWatch, delete_op, file_op, folder_op, make_uc, meta_op, patch_op, push, push_one,
)

SPACE = "default"
BIG = "\n".join(f"line {n} of a fairly long document, with some words in it" for n in range(300)) + "\n"


async def stored(repo, doc_id):
    return await repo.get(SPACE, doc_id)


# ---------------------------------------------------------------------- create / edit

def test_a_new_file_is_stored_at_rev_1_with_its_history(tmp_path):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        result = await push_one(uc, file_op("f1", "# Xin chào\n", name="a.md"), device="md-device-1")
        return result, await stored(repo, "f1"), await repo.list_revisions(SPACE, "f1")

    result, record, history = arun(scenario())
    assert result["status"] == "ok" and (result["rev"], result["contentRev"], result["metaRev"]) == (1, 1, 1)
    assert result["hash"] == sha256_hex("# Xin chào\n") and result["serverUpdatedAt"] >= T0
    assert (record.name, record.parentId, record.content, record.size, record.device) == ("a.md", "root", "# Xin chào\n", 12, "md-device-1")
    assert [row.rev for row in history] == [1] and history[0].origin == "edit" and history[0].encoding == "full"


def test_editing_with_whole_text_bumps_rev_and_content_rev_only(tmp_path):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        await push_one(uc, file_op("f1", "v1", name="a.md"))
        second = await push_one(uc, file_op("f1", "v2", base=1))
        return second, await stored(repo, "f1")

    second, record = arun(scenario())
    assert second["status"] == "ok" and (second["rev"], second["contentRev"], second["metaRev"]) == (2, 2, 1)
    assert record.content == "v2" and record.hash == sha256_hex("v2") and record.name == "a.md", "the name is not touched"


def test_a_correct_patch_is_applied_and_verified(tmp_path):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        await push_one(uc, file_op("f1", BIG, name="a.md"))
        edited = BIG.replace("line 150 ", "LINE 150 ")
        result = await push_one(uc, patch_op("f1", BIG, edited, base=1))
        return result, edited, await stored(repo, "f1")

    result, edited, record = arun(scenario())
    assert result["status"] == "ok" and result["rev"] == 2
    assert record.content == edited and record.hash == sha256_hex(edited)


def test_a_patch_against_another_base_is_refused_not_applied(tmp_path):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        await push_one(uc, file_op("f1", BIG, name="a.md"))
        lying = patch_op("f1", BIG + "extra\n", BIG.replace("line 1 ", "LINE 1 ") + "extra\n", base=1)
        return await push_one(uc, lying), (await stored(repo, "f1")).content

    result, content = arun(scenario())
    assert (result["status"], result["code"]) == ("rejected", "md_patch_mismatch")
    assert content == BIG


def test_a_patch_that_does_not_fit_or_a_wrong_hash_is_refused(tmp_path):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        await push_one(uc, file_op("f1", BIG, name="a.md"))
        bad_hash = patch_op("f1", BIG, BIG.replace("line 1 ", "LINE 1 "), base=1)
        bad_hash["hash"] = sha256_hex("something else")
        outside = patch_op("f1", BIG, BIG, base=1)
        outside["patch"] = {"v": 1, "h": [[99999, 1, ["x"]]]}
        outside["hash"] = sha256_hex("x")
        whole_wrong = file_op("f1", "new text", base=1)
        whole_wrong["hash"] = sha256_hex("another text")
        return [await push_one(uc, op) for op in (bad_hash, outside, whole_wrong)], (await stored(repo, "f1")).rev

    results, rev = arun(scenario())
    assert [(r["status"], r["code"]) for r in results] == [
        ("rejected", "md_patch_mismatch"), ("rejected", "md_patch_mismatch"), ("rejected", "md_hash_mismatch")]
    assert rev == 1, "nothing was written"


def test_a_patch_for_a_node_the_server_does_not_have_is_refused(tmp_path):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        return await push_one(uc, patch_op("ghost", "a", "b", base=3)), await stored(repo, "ghost")

    result, record = arun(scenario())
    assert result["code"] == "md_patch_mismatch" and record is None


# ---------------------------------------------------------------------- conflicts

def test_an_edit_based_on_an_old_rev_conflicts_and_writes_nothing(tmp_path):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        await push_one(uc, file_op("f1", "v1", name="a.md"))
        await push_one(uc, file_op("f1", "theirs", base=1), device="dev-b")
        mine = await push_one(uc, file_op("f1", "mine", base=1), device="dev-a")
        return mine, await stored(repo, "f1")

    mine, record = arun(scenario())
    assert mine["status"] == "conflict" and mine["parts"] == ["content"]
    assert mine["record"]["content"] == "theirs" and mine["record"]["rev"] == 2 and mine["record"]["device"] == "dev-b"
    assert record.content == "theirs" and record.rev == 2


def test_a_stale_patch_is_a_conflict_not_a_mismatch(tmp_path):
    """A patch made against text another device has since changed cannot apply, but the client needs
    the other text to merge, not a demand to resend its own: that is a conflict."""
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        await push_one(uc, file_op("f1", BIG, name="a.md"))
        await push_one(uc, file_op("f1", BIG + "added elsewhere\n", base=1), device="dev-b")
        return await push_one(uc, patch_op("f1", BIG, BIG.replace("line 1 ", "LINE 1 "), base=1))

    result = arun(scenario())
    assert result["status"] == "conflict" and result["parts"] == ["content"] and result["record"]["content"].endswith("added elsewhere\n")


def test_a_rename_and_an_edit_from_two_devices_both_stand(tmp_path):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        await push_one(uc, file_op("f1", "v1", name="a.md"))
        edit = await push_one(uc, file_op("f1", "v2", base=1), device="dev-b")
        rename = await push_one(uc, meta_op("f1", base=1, name="renamed.md"), device="dev-a")
        return edit, rename, await stored(repo, "f1")

    edit, rename, record = arun(scenario())
    assert edit["status"] == "ok" and rename["status"] == "ok", "content and meta are judged apart"
    assert (record.name, record.content, record.rev, record.contentRev, record.metaRev) == ("renamed.md", "v2", 3, 2, 3)


def test_two_renames_conflict_on_meta_and_the_answer_has_no_text(tmp_path):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        await push_one(uc, file_op("f1", "text", name="a.md"))
        await push_one(uc, meta_op("f1", base=1, name="b.md"), device="dev-b")
        mine = await push_one(uc, meta_op("f1", base=1, name="c.md"), device="dev-a")
        same = await push_one(uc, meta_op("f1", base=1, name="b.md"), device="dev-a")
        return mine, same, (await stored(repo, "f1")).name

    mine, same, name = arun(scenario())
    assert mine["status"] == "conflict" and mine["parts"] == ["meta"] and mine["record"]["content"] is None
    assert mine["record"]["name"] == "b.md"
    assert same["status"] == "ok", "asking for what is already there is no conflict"
    assert name == "b.md"


def test_moving_to_the_top_and_into_a_folder(tmp_path):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        await push(uc, folder_op("fo", "Notes"), file_op("f1", "x", name="a.md", parent="fo"))
        to_top = await push_one(uc, meta_op("f1", base=1, parentId=None))
        to_folder = await push_one(uc, meta_op("f1", base=2, parentId="fo"))
        return to_top, to_folder, (await stored(repo, "f1")).parentId

    to_top, to_folder, parent = arun(scenario())
    assert (to_top["status"], to_top["metaRev"], to_folder["status"], parent) == ("ok", 2, "ok", "fo")


# ----------------------------------------------------------------- edit beats delete

def test_deleting_leaves_a_tombstone_without_text(tmp_path):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        await push_one(uc, file_op("f1", "secret text", name="a.md"))
        result = await push_one(uc, delete_op("f1", base=1))
        return result, await stored(repo, "f1"), await repo.list_revisions(SPACE, "f1")

    result, record, history = arun(scenario())
    assert result["status"] == "ok" and result["rev"] == 2 and result["hash"] == ""
    assert record.deleted and record.content is None and record.hash == "" and record.size == 0 and record.name == "a.md"
    assert [(row.rev, row.encoding, row.origin, row.deleted) for row in history] == [(1, "full", "edit", False), (2, "none", "delete", True)]


def test_deleting_something_edited_since_is_a_conflict(tmp_path):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        await push_one(uc, file_op("f1", "v1", name="a.md"))
        await push_one(uc, file_op("f1", "v2", base=1), device="dev-b")
        result = await push_one(uc, delete_op("f1", base=1))
        return result, (await stored(repo, "f1")).deleted

    result, deleted = arun(scenario())
    assert result["status"] == "conflict" and result["parts"] == ["deleted"] and result["record"]["content"] == "v2" and deleted is False


def test_deleting_something_only_renamed_since_still_deletes(tmp_path):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        await push_one(uc, file_op("f1", "v1", name="a.md"))
        await push_one(uc, meta_op("f1", base=1, name="b.md"), device="dev-b")
        result = await push_one(uc, delete_op("f1", base=1))
        return result, (await stored(repo, "f1")).deleted

    result, deleted = arun(scenario())
    assert result["status"] == "ok" and result["rev"] == 3 and deleted is True, "a rename elsewhere does not save a node from a delete"


def test_editing_a_deleted_node_is_a_conflict_that_shows_the_tombstone(tmp_path):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        await push_one(uc, file_op("f1", "v1", name="a.md"))
        await push_one(uc, delete_op("f1", base=1), device="dev-b")
        edit = await push_one(uc, file_op("f1", "mine", base=1))
        rename = await push_one(uc, meta_op("f1", base=1, name="z.md"))
        again_delete = await push_one(uc, delete_op("f1", base=1))
        return edit, rename, again_delete, await stored(repo, "f1")

    edit, rename, again_delete, record = arun(scenario())
    assert edit["status"] == "conflict" and edit["parts"] == ["deleted"] and edit["record"]["deleted"] is True
    assert rename["status"] == "conflict" and rename["parts"] == ["deleted"]
    assert again_delete["status"] == "ok", "deleting what is deleted is already done"
    assert record.deleted and record.rev == 2


def test_an_explicit_undelete_with_the_text_brings_the_node_back(tmp_path):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        await push_one(uc, file_op("f1", "v1", name="a.md"))
        await push_one(uc, delete_op("f1", base=1), device="dev-b")
        back = await push_one(uc, file_op("f1", "mine, kept", base=2, deleted=False))
        return back, await stored(repo, "f1"), [row.rev for row in await repo.list_revisions(SPACE, "f1")]

    back, record, history = arun(scenario())
    assert back["status"] == "ok" and back["rev"] == 3
    assert (record.deleted, record.content, record.contentRev, record.name) == (False, "mine, kept", 3, "a.md")
    assert history == [1, 2, 3], "the revival is a new history row, never a rewrite"


def test_undelete_needs_the_text_and_to_have_seen_the_tombstone(tmp_path):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        await push_one(uc, file_op("f1", "v1", name="a.md"))
        await push_one(uc, delete_op("f1", base=1))
        blind = await push_one(uc, file_op("f1", "x", base=1, deleted=False))
        no_text = await push_one(uc, {"id": "f1", "kind": "file", "baseRev": 2, "deleted": False, "updatedAt": T0})
        return blind, no_text, (await stored(repo, "f1")).deleted

    blind, no_text, deleted = arun(scenario())
    assert blind["status"] == "conflict" and blind["parts"] == ["deleted"], "based on rev 1 it never saw the delete"
    assert (no_text["status"], no_text["code"]) == ("rejected", "md_content_required")
    assert deleted is True


def test_a_folder_can_be_deleted_and_revived_without_text(tmp_path):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        await push_one(uc, folder_op("fo", "Notes"))
        gone = await push_one(uc, delete_op("fo", base=1, kind="folder"))
        back = await push_one(uc, {"id": "fo", "kind": "folder", "baseRev": 2, "deleted": False, "updatedAt": T0})
        return gone, back, await stored(repo, "fo"), await repo.list_revisions(SPACE, "fo")

    gone, back, record, history = arun(scenario())
    assert gone["status"] == "ok" and back["status"] == "ok" and back["rev"] == 3
    assert record.deleted is False and record.content is None and history == [], "folders have no history"


def test_deleting_what_the_server_never_saw_still_stores_a_tombstone(tmp_path):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        result = await push_one(uc, delete_op("never", base=3))
        return result, await stored(repo, "never"), await repo.list_revisions(SPACE, "never")

    result, record, history = arun(scenario())
    assert result["status"] == "ok" and record.deleted and record.rev == 1 and history == []


# ------------------------------------------------------------- the size of the answer

async def stale_edits(uc, count, size):
    """`count` documents of about `size` bytes that device B edited after device A saw them; then device A pushes a
    tiny patch for each of them, based on the old rev. The REQUEST is a few hundred bytes; every answer is a
    conflict that carries the server's whole text. Returns the answer's `results`."""
    texts = {f"d{n:02d}": ("x" * 99 + "\n") * (size // 100) for n in range(count)}
    per_push = max(1, 3_000_000 // max(size, 1))                       # a push carries at most 4 MB of text
    creates = [file_op(doc_id, body, name=f"{doc_id}.md") for doc_id, body in texts.items()]
    edits = [file_op(doc_id, body + "theirs\n", base=1) for doc_id, body in texts.items()]
    for start in range(0, count, per_push):
        await push(uc, *creates[start:start + per_push])
    for start in range(0, count, per_push):
        await push(uc, *edits[start:start + per_push], device="dev-b")
    mine = [patch_op(doc_id, body, body + "mine\n", base=1) for doc_id, body in texts.items()]
    return await push(uc, *mine, device="dev-a")


def test_a_push_answer_never_carries_more_text_than_the_budget(tmp_path):
    """A request of a few hundred bytes (patches) came back with up to 200 x 3.5 MB of conflicting texts: past Vercel's
    4.5 MB cap, so the client never saw its conflicts and the sync loop stuck. The texts one answer carries now
    share the page budget; the rest come back with `contentOmitted` and are fetched by id."""
    async def scenario():
        uc, repo, _ = make_uc(tmp_path, page_bytes=2_000)
        results = await stale_edits(uc, 4, 500)
        return results, await uc.get_document("d02")

    results, fetched = arun(scenario())
    assert [r["status"] for r in results] == ["conflict"] * 4
    with_text = [r["id"] for r in results if r["record"]["content"] is not None]
    omitted = [r["id"] for r in results if r.get("contentOmitted")]
    assert with_text == ["d00", "d01"] and omitted == ["d02", "d03"], "in op order, until the budget is spent"
    assert sum(len(r["record"]["content"]) for r in results if r["record"]["content"] is not None) <= 2_000
    assert all("contentOmitted" not in r for r in results[:2]), "the flag exists only when something was left out"
    left_out = results[2]["record"]
    assert left_out["content"] is None and left_out["rev"] == 2 and left_out["hash"] == sha256_hex(fetched["content"]), \
        "the record is whole but its text: the client sees WHICH version it has to fetch"
    assert fetched["content"].endswith("theirs\n") and fetched["rev"] == 2, "GET /markdown/docs/{id} is the way to the text"


def test_the_answer_budget_is_charged_by_size_plus_the_per_item_overhead_and_the_edge_is_inclusive(tmp_path):
    async def scenario(budget):
        folder = tmp_path / f"b{budget}"
        folder.mkdir()
        uc, repo, _ = make_uc(folder, page_bytes=budget)
        return [bool(r.get("contentOmitted")) for r in await stale_edits(uc, 2, 500)]

    size = 500 + len("theirs\n")                                    # what one conflicting record weighs in the answer
    weight = size + ITEM_OVERHEAD_BYTES
    assert arun(scenario(weight - 1)) == [True, True], "one byte short of the first record: nothing fits"
    assert arun(scenario(weight)) == [False, True], "exactly enough for one"
    assert arun(scenario(2 * weight)) == [False, False]


def test_only_text_counts_against_the_answer_budget(tmp_path):
    """ok, rejected, and name-only conflicts carry no text, so any number of them leaves the budget alone."""
    async def scenario():
        uc, repo, _ = make_uc(tmp_path, page_bytes=1_000)
        await push(uc, file_op("d1", "x" * 400, name="a.md"), file_op("m1", "meta", name="m.md"))
        await push(uc, meta_op("m1", base=1, name="renamed-b.md"), device="dev-b")
        await push(uc, file_op("d1", "x" * 400 + "theirs", base=1), device="dev-b")
        return await push(
            uc,
            file_op("new", "fresh", name="new.md"),                                    # ok
            {**file_op("bad", "text", name="bad.md"), "hash": sha256_hex("other")},    # rejected
            meta_op("m1", base=1, name="renamed-a.md"),                                # conflict on the name only
            patch_op("d1", "x" * 400, "x" * 400 + "mine", base=1),                     # conflict with text: 806 <= 1000
        )

    results = arun(scenario())
    assert [r["status"] for r in results] == ["ok", "rejected", "conflict", "conflict"]
    assert results[2]["parts"] == ["meta"] and results[2]["record"]["content"] is None and "contentOmitted" not in results[2]
    assert results[3]["record"]["content"] == "x" * 400 + "theirs" and "contentOmitted" not in results[3]


def test_ten_big_stale_documents_stay_under_the_response_cap_of_the_host(tmp_path):
    """The reviewer's case, at the shipped budget: ten ~0.59 MB documents another device changed; one push of ten tiny
    patches. It answered 6.01 MB (Vercel refuses past 4.5 MB); now the answer carries text up to the 3 MB budget."""
    results = arun(stale_edits(make_uc(tmp_path)[0], 10, 590_000))
    assert [r["status"] for r in results] == ["conflict"] * 10
    assert sum(1 for r in results if r["record"]["content"] is not None) == 5
    assert sum(1 for r in results if r.get("contentOmitted")) == 5
    assert len(json.dumps({"results": results}).encode("utf-8")) < 4_500_000


# --------------------------------------------------- a replay is a claim about the text too

def test_a_replay_whose_text_does_not_hash_to_what_it_says_is_refused(tmp_path):
    """`hash == the stored hash` used to skip every check: the text could be anything and the answer was `ok`."""
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        await push_one(uc, file_op("f1", "v1", name="a.md"))
        forged = file_op("f1", "v1", base=1)
        forged["content"] = "NOT v1"                                       # the hash still says v1
        faithful = await push_one(uc, file_op("f1", "v1", base=1))
        return await push_one(uc, forged), faithful, await stored(repo, "f1")

    forged, faithful, record = arun(scenario())
    assert forged["status"] == "rejected" and forged["code"] == "md_hash_mismatch"
    assert faithful["status"] == "ok" and record.content == "v1" and record.rev == 1


# ------------------------------------------------- big documents never stall the event loop

def test_applying_a_patch_to_a_big_stored_document_runs_off_the_event_loop(tmp_path):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        big = "a line of a long document\n" * 3000
        assert len(big) > 32 * 1024
        await push_one(uc, file_op("f1", big, name="a.md"))
        real = uc._plan

        def slow(*args):
            time.sleep(0.5)
            return real(*args)

        uc._plan = slow
        async with LoopWatch() as watch:
            result = await push_one(uc, patch_op("f1", big, big + "more\n", base=1))
        return result, watch.longest

    result, longest = arun(scenario())
    assert result["status"] == "ok"
    assert longest < 0.25, f"the loop was stuck for {longest:.2f} s"


# ------------------------------------------------------------------- idempotence

def test_replaying_an_op_whose_answer_was_lost_is_ok_not_a_conflict(tmp_path):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        create = file_op("f1", "v1", name="a.md")
        edit = file_op("f1", "v2", base=1)
        patch = patch_op("f1", BIG, BIG.replace("line 1 ", "LINE 1 "), base=3)
        rename = meta_op("f1", base=1, name="b.md")
        out = []
        await push_one(uc, create)
        out.append(await push_one(uc, create))                       # the create again
        out.append(await push_one(uc, edit))
        out.append(await push_one(uc, edit))                         # the edit again
        await push_one(uc, file_op("f1", BIG, base=2))
        out.append(await push_one(uc, patch))
        out.append(await push_one(uc, patch))                        # the patch again
        out.append(await push_one(uc, rename))
        out.append(await push_one(uc, rename))
        out.append(await push_one(uc, delete_op("f1", base=5)))
        out.append(await push_one(uc, delete_op("f1", base=5)))
        return out, await stored(repo, "f1"), await repo.list_revisions(SPACE, "f1")

    out, record, history = arun(scenario())
    assert [r["status"] for r in out] == ["ok"] * 9
    assert out[0]["rev"] == 1 and out[1]["rev"] == out[2]["rev"] == 2, "a replay answers with the stored state and writes nothing"
    assert out[3]["rev"] == out[4]["rev"] == 4 and out[5]["rev"] == out[6]["rev"] == 5 and out[7]["rev"] == out[8]["rev"] == 6
    assert record.deleted and record.rev == 6
    assert [row.rev for row in history] == sorted({row.rev for row in history}), "no duplicate history rows"


# --------------------------------------------------------------------- refusals

@pytest.mark.parametrize("name", ["", "   ", "a/b.md", "x" * 256, "tab\there.md", "nul\x00.md"])
def test_bad_names_are_rejected(tmp_path, name):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        created = await push_one(uc, file_op("f1", "x", name=name))
        return created, await stored(repo, "f1")

    created, record = arun(scenario())
    assert (created["status"], created["code"]) == ("rejected", "md_bad_name") and record is None


def test_a_new_file_needs_a_name_and_a_node_cannot_be_its_own_parent(tmp_path):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        nameless = await push_one(uc, {"id": "f1", "kind": "file", "baseRev": 0, "content": "x", "hash": sha256_hex("x"), "updatedAt": T0})
        loop = await push_one(uc, folder_op("fo", "Notes", parent="fo"))
        return nameless, loop

    nameless, loop = arun(scenario())
    assert nameless["code"] == "md_bad_name" and loop["code"] == "md_bad_parent"


def test_the_kind_of_a_node_never_changes(tmp_path):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        await push_one(uc, file_op("n1", "x", name="a.md"))
        return await push_one(uc, folder_op("n1", "Notes", base=1))

    assert arun(scenario())["code"] == "md_kind_changed"


def test_a_clock_more_than_a_day_ahead_is_rejected(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path)
        ahead = file_op("f1", "x", name="a.md")
        ahead["updatedAt"] = clock.now + DAY + 1
        ok = file_op("f2", "x", name="b.md")
        ok["updatedAt"] = clock.now + DAY - 1000
        return await push(uc, ahead, ok)

    results = arun(scenario())
    assert results[0]["code"] == "md_bad_clock" and results[1]["status"] == "ok"


def test_a_document_over_the_budget_is_rejected_but_its_neighbours_stand(tmp_path):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path, max_doc_bytes=100)
        fits = file_op("small", "x" * 100, name="s.md")
        too_big = file_op("big", "x" * 101, name="b.md")
        wide = file_op("wide", "ệ" * 34, name="w.md")             # 102 bytes in UTF-8, 34 characters
        return await push(uc, too_big, fits, wide)

    results = arun(scenario())
    assert [r.get("code", r["status"]) for r in results] == ["md_doc_too_large", "ok", "md_doc_too_large"]


def test_text_that_is_not_utf8_is_rejected_by_the_model_and_by_the_use_case(tmp_path):
    """Pydantic already refuses a lone surrogate (422); the use case refuses it too for a caller that skips validation."""
    with pytest.raises(Exception):
        PushOp(id="f1", kind="file", baseRev=0, content="broken \ud800 surrogate", hash=sha256_hex("x"), updatedAt=T0)

    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        lone = PushOp.model_construct(
            id="f1", kind="file", baseRev=0, meta=MetaIn(name="a.md", parentId="root"), content="broken \ud800 surrogate",
            patch=None, baseHash=None, hash=sha256_hex("x"), deleted=None, updatedAt=T0,
        )
        return (await uc.push(PushRequest.model_construct(device="dev-a", ops=[lone])))["results"][0], await stored(repo, "f1")

    result, record = arun(scenario())
    assert result["code"] == "md_bad_content" and record is None


def test_a_whole_request_with_a_repeated_node_or_too_much_text_is_a_400(tmp_path):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path, max_push_bytes=1000)
        errors = []
        for ops in ([file_op("f1", "a", name="a.md"), file_op("f1", "b", base=1)],
                    [file_op("f1", "x" * 900, name="a.md"), file_op("f2", "y" * 900, name="b.md")]):
            try:
                await push(uc, *ops)
            except AppException as error:
                errors.append((error.status_code, error.payload["code"]))
        return errors, await repo.count(SPACE)

    errors, count = arun(scenario())
    assert errors == [(400, "md_duplicate_op"), (400, "md_push_too_large")] and count == 0, "nothing of a refused request is stored"


def test_one_bad_op_does_not_stop_the_others_and_results_keep_the_order(tmp_path):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        await push_one(uc, file_op("old", "v1", name="old.md"))
        return await push(
            uc,
            file_op("a", "A", name="a.md"),
            file_op("bad", "B", name="b/c.md"),
            file_op("old", "stale", base=0),
            file_op("c", "C", name="c.md"),
        )

    results = arun(scenario())
    assert [(r["id"], r["status"]) for r in results] == [("a", "ok"), ("bad", "rejected"), ("old", "conflict"), ("c", "ok")]


# ------------------------------------------------------------------------ capacity

def test_a_full_space_makes_room_from_old_tombstones_then_refuses(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path, max_docs=3, tombstone_days=90)
        await push(uc, file_op("a", "1", name="a.md"), file_op("b", "2", name="b.md"), delete_op("old", base=0))
        clock.advance(91 * DAY)                                    # the tombstone of "old" is now expired
        room = await push(uc, file_op("c", "3", name="c.md"))
        full = await push(uc, file_op("d", "4", name="d.md"), file_op("a", "1!", base=1))
        return room, full, sorted(r.id for r in await repo.list_since(SPACE, 0, 100, True))

    room, full, ids = arun(scenario())
    assert room[0]["status"] == "ok"
    assert (full[0]["status"], full[0]["code"]) == ("rejected", "md_space_full"), "new nodes are refused when no room is left"
    assert full[1]["status"] == "ok", "edits of existing nodes still go through"
    assert ids == ["a", "b", "c"]


# -------------------------------------------------------------- stamps and races

def test_stamps_differ_inside_a_request_and_never_go_backwards_for_a_node(tmp_path):
    async def scenario():
        uc, repo, clock = make_uc(tmp_path)
        await push(uc, file_op("a", "1", name="a.md"), file_op("b", "2", name="b.md"), file_op("c", "3", name="c.md"))
        first = {r.id: r.serverUpdatedAt for r in await repo.list_since(SPACE, 0, 10, True)}
        clock.advance(-60_000)                                     # another instance whose clock runs behind
        result = await push_one(uc, file_op("a", "1!", base=1))
        return first, result

    first, result = arun(scenario())
    assert len(set(first.values())) == 3
    assert result["serverUpdatedAt"] > first["a"], "a node's stamp only grows: the pull cursor must not skip it"


def test_each_op_is_stamped_when_it_is_written_not_when_the_push_began(tmp_path):
    """Against a far database a push of many ops takes seconds. A stamp taken at the start would be older than
    the 2 s lag of a pull cursor by the time the op commits, and that device would never receive it."""
    async def scenario():
        uc, repo, clock = make_uc(tmp_path)
        real = repo.insert

        async def slow_insert(space, record):
            clock.advance(1000)                                       # a second per write
            return await real(space, record)

        repo.insert = slow_insert
        await push(uc, *[file_op(f"f{n}", "x", name=f"f{n}.md") for n in range(5)])
        return [(r.id, r.serverUpdatedAt) for r in await repo.list_since(SPACE, 0, 10, True)]

    stamps = arun(scenario())
    assert stamps == [(f"f{n}", T0 + 1000 * n) for n in range(5)], "each stamp is the clock when its own op was about to be written"


def test_a_lost_compare_and_set_decides_again_on_what_won(tmp_path):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        await push_one(uc, file_op("f1", "v1", name="a.md"))
        real = repo.cas_write
        raced = []

        async def lose_once(space, record, expected_rev):
            if not raced:
                raced.append(1)
                winner = (await repo.get(space, "f1")).model_copy(update={"rev": 2, "contentRev": 2, "content": "theirs", "hash": sha256_hex("theirs")})
                assert await real(space, winner, 1)
                return False
            return await real(space, record, expected_rev)

        repo.cas_write = lose_once
        return await push_one(uc, file_op("f1", "mine", base=1))

    result = arun(scenario())
    assert result["status"] == "conflict" and result["record"]["content"] == "theirs"


def test_three_lost_races_in_a_row_ask_the_client_to_retry(tmp_path):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)
        await push_one(uc, file_op("f1", "v1", name="a.md"))

        async def always_lose(space, record, expected_rev):
            return False

        repo.cas_write = always_lose
        try:
            await push_one(uc, file_op("f1", "mine", base=1))
        except AppException as error:
            return error.status_code, error.payload["code"], error.headers

    assert arun(scenario()) == (503, "md_busy", {"Retry-After": "1"})


def test_a_failing_history_never_fails_the_push(tmp_path):
    async def scenario():
        uc, repo, _ = make_uc(tmp_path)

        async def broken(space, revision):
            raise OSError("history disk full")

        repo.add_revision = broken
        result = await push_one(uc, file_op("f1", "v1", name="a.md"))
        return result, await stored(repo, "f1")

    result, record = arun(scenario())
    assert result["status"] == "ok" and record.content == "v1", "a missing history row, never a lost document"


def test_a_megabyte_document_changes_through_a_small_patch(tmp_path):
    lines = [f"paragraph {n}: " + "word " * 30 for n in range(6000)]
    old = "\n".join(lines)
    edited = list(lines)
    edited[3000] = "one edited line"
    new = "\n".join(edited)

    async def scenario():
        uc, repo, _ = make_uc(tmp_path, max_push_bytes=4_000_000)
        await push_one(uc, file_op("big", old, name="big.md"))
        op = patch_op("big", old, new, base=1)
        return len(json.dumps(op)), await push_one(uc, op), (await stored(repo, "big")).content == new

    size, result, same = arun(scenario())
    assert len(old) > 800_000 and size < 2_000 and result["status"] == "ok" and same


# ---------------------------------------------- the same story on every store

class _FreshSql(MySqlMarkdownDocsRepository):
    async def _session(self):
        fresh = not self._ready
        session = await super()._session()
        if fresh:
            for table in ("markdown_docs", "markdown_doc_revisions", "markdown_meta"):
                await session.execute(text(f"DELETE FROM {table}"))
            await session.commit()
        return session


@pytest.mark.parametrize("kind", ["json", "sql", "mongo"])
def test_the_same_story_gives_the_same_answers_on_every_store(kind, tmp_path, monkeypatch):
    fake_mongo.install(monkeypatch, mongo_repository)
    repo = {"json": lambda: JsonMarkdownDocsRepository(file_path=tmp_path / "d.json"), "sql": _FreshSql,
            "mongo": MongoMarkdownDocsRepository}[kind]()
    edited = BIG.replace("line 7 ", "LINE 7 ")

    async def scenario():
        uc = MarkdownDocsUseCase(repo, clock=Clock(), coalesce_ms=0)
        out = []
        out.append(await push(uc, folder_op("fo", "Notes"), file_op("f1", BIG, name="a.md", parent="fo")))
        out.append(await push(uc, patch_op("f1", BIG, edited, base=1)))
        out.append(await push(uc, file_op("f1", "stale", base=1)))
        out.append(await push(uc, meta_op("f1", base=2, name="b.md")))
        out.append(await push(uc, delete_op("f1", base=3)))
        out.append(await push(uc, file_op("f1", edited + "back\n", base=4, deleted=False)))
        record = await repo.get(SPACE, "f1")
        history = await repo.list_revisions(SPACE, "f1")
        text_of = {row.rev: (await uc.get_revision("f1", row.rev))["content"] for row in history}
        changes = await uc.changes(0, None, "")
        return out, record, history, text_of, changes

    out, record, history, text_of, changes = arun(scenario())
    shape = [[(r["status"], r.get("rev"), r.get("parts")) for r in step] for step in out]
    assert shape == [
        [("ok", 1, None), ("ok", 1, None)],
        [("ok", 2, None)],
        [("conflict", None, ["content"])],
        [("ok", 3, None)],
        [("ok", 4, None)],
        [("ok", 5, None)],
    ]
    assert (record.name, record.deleted, record.content, record.rev) == ("b.md", False, edited + "back\n", 5)
    assert [(row.rev, row.encoding) for row in history] == [(1, "full"), (2, "delta"), (4, "none"), (5, "delta")]
    assert text_of[1] == BIG and text_of[2] == edited and text_of[4] is None and text_of[5] == record.content
    assert sorted(item["id"] for item in changes["items"]) == ["f1", "fo"]
