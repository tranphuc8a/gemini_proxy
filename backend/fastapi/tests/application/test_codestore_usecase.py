"""The rules of the Code Studio store: access, validation, merging, quotas, paging.

Most tests run against the real `JsonCodestoreRepository` on a temp file rather than
a fake: the atomic merge lives in the repository, so a fake would test the test. A
few flows run against all three backends (see `test_codestore_repositories.py` for
the per-backend contract).
"""

import os

os.environ.setdefault("TESTING", "1")

import json
import re

import pytest

from src.adapter.output.codestore import mongo_repository
from src.adapter.output.codestore.json_repository import JsonCodestoreRepository
from src.adapter.output.codestore.mongo_repository import MongoCodestoreRepository
from src.adapter.output.codestore.mysql_repository import MySqlCodestoreRepository
from src.application.exceptions.exceptions import AppException, BadRequestError, NotFoundError, UnauthorizedError
from src.application.usecases.codestore_usecase import SYNC_LAG_MS, CodestoreUseCase, hash_key
from src.application.utils.rate_limit import FailureWindow
from src.domain.vo.codestore_vo import (
    MAX_ITEM_BYTES,
    MAX_META_BYTES,
    CodeFile,
    CodeItemIn,
    PutItemsRequest,
)
from tests.conftest import arun
from tests.support import fake_mongo

NOW = 1_800_000_000_000
DAY = 24 * 3600 * 1000


class Clock:
    def __init__(self, now=NOW):
        self.now = now

    def __call__(self):
        return self.now


def incoming(item_id="i1", updated=NOW - 1000, kind="snippet", files=None, deleted=False, **overrides):
    if files is None:
        files = [] if deleted else [{"path": "main.cpp", "content": "int main(){}"}]
    values = dict(id=item_id, kind=kind, name="Bài 1", language="cpp", files=files, meta={}, updatedAt=updated,
                  deleted=deleted)
    values.update(overrides)
    return CodeItemIn(**values)


def put(*items):
    return PutItemsRequest(items=list(items))


def build(tmp_path, clock=None, **options):
    repo = JsonCodestoreRepository(file_path=tmp_path / "codestore.json")
    clock = clock or Clock()
    return CodestoreUseCase(repo, clock=clock, **options), repo, clock


async def create(uc):
    created = await uc.create_workspace("1.1.1.1")
    return created["workspaceId"], created["key"]


def refused(coro):
    with pytest.raises(AppException) as caught:
        arun(coro)
    return caught.value


# ---------------------------------------------------------------------------
# workspaces and access
# ---------------------------------------------------------------------------
def test_create_returns_the_key_once_and_stores_only_its_hash(tmp_path):
    async def scenario():
        uc, repo, _ = build(tmp_path)
        workspace_id, key = await create(uc)
        return workspace_id, key, await repo.get_workspace(workspace_id)

    workspace_id, key, stored = arun(scenario())
    assert re.fullmatch(r"cs_[A-Za-z0-9_-]{16}", workspace_id) and len(key) >= 32
    assert stored.key_hash == hash_key(key) and key not in stored.model_dump_json()
    assert key not in (tmp_path / "codestore.json").read_text(encoding="utf-8")
    assert hash_key(key) in (tmp_path / "codestore.json").read_text(encoding="utf-8")


def test_two_workspaces_never_share_an_id_or_a_key(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path)
        return [await create(uc) for _ in range(20)]

    made = arun(scenario())
    assert len({workspace_id for workspace_id, _ in made}) == 20 and len({key for _, key in made}) == 20


def test_access_needs_the_right_key_and_unknown_is_answered_before_wrong(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path)
        workspace_id, key = await create(uc)
        return uc, workspace_id, key

    uc, workspace_id, key = arun(scenario())
    missing = refused(uc.list_items("cs_unknown", key, 0))
    assert isinstance(missing, NotFoundError) and missing.payload["code"] == "codestore_not_found"
    none = refused(uc.list_items(workspace_id, "", 0))
    assert isinstance(none, UnauthorizedError) and none.payload["code"] == "codestore_key_required"
    wrong = refused(uc.list_items(workspace_id, "not-the-key", 0))
    assert isinstance(wrong, UnauthorizedError) and wrong.payload["code"] == "codestore_bad_key"
    assert arun(uc.list_items(workspace_id, key, 0))["items"] == []


def test_a_key_of_one_workspace_does_not_open_another(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path)
        a, key_a = await create(uc)
        b, key_b = await create(uc)
        await uc.put_items(a, key_a, put(incoming("secret")))
        return uc, a, key_a, b, key_b

    uc, a, key_a, b, key_b = arun(scenario())
    assert refused(uc.list_items(a, key_b, 0)).payload["code"] == "codestore_bad_key"
    assert refused(uc.put_items(a, key_b, put(incoming()))).payload["code"] == "codestore_bad_key"
    assert refused(uc.delete_workspace(a, key_b)).payload["code"] == "codestore_bad_key"
    assert arun(uc.list_items(b, key_b, 0))["items"] == []                       # b has none of a's records
    assert [i["id"] for i in arun(uc.list_items(a, key_a, 0))["items"]] == ["secret"]


def test_guessing_keys_is_slowed_down_per_address(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path, failure_limiter=FailureWindow(3, 600))
        workspace_id, key = await create(uc)
        return uc, workspace_id, key

    uc, workspace_id, key = arun(scenario())
    for _ in range(3):
        assert refused(uc.list_items(workspace_id, "guess", 0, ip="6.6.6.6")).status_code == 401
    blocked = refused(uc.list_items(workspace_id, "guess", 0, ip="6.6.6.6"))
    assert blocked.status_code == 429 and blocked.payload["code"] == "codestore_rate_limited"
    assert int(blocked.headers["Retry-After"]) >= 1
    # Even the right key waits (the attacker may have found it), but another address does not.
    assert refused(uc.list_items(workspace_id, key, 0, ip="6.6.6.6")).status_code == 429
    assert arun(uc.list_items(workspace_id, key, 0, ip="7.7.7.7"))["items"] == []


def test_creating_workspaces_is_limited_per_address(tmp_path):
    uc, _, _ = build(tmp_path, workspace_limiter=FailureWindow(2, 3600))
    arun(uc.create_workspace("5.5.5.5"))
    arun(uc.create_workspace("5.5.5.5"))
    blocked = refused(uc.create_workspace("5.5.5.5"))
    assert blocked.status_code == 429 and blocked.payload["code"] == "codestore_rate_limited"
    assert "workspaceId" in arun(uc.create_workspace("5.5.5.6"))


def test_deleting_a_workspace_needs_the_key_and_removes_everything(tmp_path):
    async def scenario():
        uc, repo, _ = build(tmp_path)
        workspace_id, key = await create(uc)
        await uc.put_items(workspace_id, key, put(incoming("a"), incoming("b")))
        return uc, repo, workspace_id, key

    uc, repo, workspace_id, key = arun(scenario())
    assert refused(uc.delete_workspace(workspace_id, "nope")).status_code == 401
    assert arun(uc.delete_workspace(workspace_id, key)) is True
    assert arun(repo.count_items(workspace_id)) == 0
    assert refused(uc.list_items(workspace_id, key, 0)).status_code == 404


# ---------------------------------------------------------------------------
# put / get and the sync cursor
# ---------------------------------------------------------------------------
def test_put_answers_with_what_the_server_holds_for_the_ids_sent(tmp_path):
    async def scenario():
        uc, _, clock = build(tmp_path)
        workspace_id, key = await create(uc)
        return await uc.put_items(workspace_id, key, put(incoming("a"), incoming("b", kind="project", files=[
            {"path": "src\\main.py", "content": "x"}, {"path": "./README.md", "content": "y"}]))), clock

    out, clock = arun(scenario())
    assert [item["id"] for item in out["items"]] == ["a", "b"]
    assert out["serverTime"] == clock.now - SYNC_LAG_MS
    assert out["items"][0]["serverUpdatedAt"] == NOW and out["items"][1]["serverUpdatedAt"] == NOW + 1
    assert [file["path"] for file in out["items"][1]["files"]] == ["src/main.py", "README.md"]      # normalised


def test_the_server_copy_wins_and_is_what_comes_back(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path)
        workspace_id, key = await create(uc)
        await uc.put_items(workspace_id, key, put(incoming("a", updated=NOW - 100, files=[
            {"path": "main.cpp", "content": "newer on the server"}])))
        stale = await uc.put_items(workspace_id, key, put(incoming("a", updated=NOW - 500, files=[
            {"path": "main.cpp", "content": "older from a stale device"}])))
        fresh = await uc.put_items(workspace_id, key, put(incoming("a", updated=NOW - 50, files=[
            {"path": "main.cpp", "content": "newest"}])))
        return stale, fresh

    stale, fresh = arun(scenario())
    assert stale["items"][0]["files"][0]["content"] == "newer on the server"
    assert stale["items"][0]["updatedAt"] == NOW - 100
    assert fresh["items"][0]["files"][0]["content"] == "newest"


def test_a_deletion_is_kept_as_a_tombstone_without_content(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path)
        workspace_id, key = await create(uc)
        await uc.put_items(workspace_id, key, put(incoming("a", updated=NOW - 300)))
        gone = await uc.put_items(workspace_id, key, put(incoming(
            "a", updated=NOW - 200, deleted=True, files=[{"path": "x.cpp", "content": "ignored"}], meta={"k": "v"})))
        listed = await uc.list_items(workspace_id, key, 0)
        late_edit = await uc.put_items(workspace_id, key, put(incoming("a", updated=NOW - 250)))
        return gone, listed, late_edit

    gone, listed, late_edit = arun(scenario())
    [tombstone] = gone["items"]
    assert tombstone["deleted"] is True and tombstone["files"] == [] and tombstone["meta"] == {}
    assert listed["items"][0]["deleted"] is True                               # other devices learn of it
    assert late_edit["items"][0]["deleted"] is True                            # an older edit cannot undo it


def test_the_same_id_twice_in_one_request_keeps_the_later_one(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path)
        workspace_id, key = await create(uc)
        return await uc.put_items(workspace_id, key, put(
            incoming("a", updated=NOW - 100, files=[{"path": "a.cpp", "content": "later"}]),
            incoming("b"),
            incoming("a", updated=NOW - 900, files=[{"path": "a.cpp", "content": "earlier"}]),
        ))

    out = arun(scenario())
    assert [i["id"] for i in out["items"]] == ["a", "b"]
    assert out["items"][0]["files"][0]["content"] == "later"


def test_an_empty_put_is_a_harmless_no_op(tmp_path):
    async def scenario():
        uc, _, clock = build(tmp_path)
        workspace_id, key = await create(uc)
        return await uc.put_items(workspace_id, key, put()), clock

    out, clock = arun(scenario())
    assert out == {"items": [], "serverTime": clock.now - SYNC_LAG_MS}


def test_get_since_returns_only_records_stored_after_it(tmp_path):
    async def scenario():
        uc, _, clock = build(tmp_path)
        workspace_id, key = await create(uc)
        await uc.put_items(workspace_id, key, put(incoming("old")))
        clock.now += 60_000
        first = await uc.list_items(workspace_id, key, 0)
        await uc.put_items(workspace_id, key, put(incoming("new")))
        clock.now += 60_000
        second = await uc.list_items(workspace_id, key, first["serverTime"])
        third = await uc.list_items(workspace_id, key, second["serverTime"])
        return first, second, third

    first, second, third = arun(scenario())
    assert [i["id"] for i in first["items"]] == ["old"] and first["more"] is False
    assert [i["id"] for i in second["items"]] == ["new"]
    assert third["items"] == [] and third["serverTime"] >= second["serverTime"]


def test_since_filters_on_the_server_clock_not_on_the_devices(tmp_path):
    """An edit made long ago but pushed just now must still reach a poller."""
    async def scenario():
        uc, _, clock = build(tmp_path)
        workspace_id, key = await create(uc)
        await uc.put_items(workspace_id, key, put(incoming("a")))
        clock.now += 10_000
        cursor = (await uc.list_items(workspace_id, key, 0))["serverTime"]
        clock.now += 10_000
        await uc.put_items(workspace_id, key, put(incoming("pushed-late", updated=NOW - 30 * DAY)))
        return await uc.list_items(workspace_id, key, cursor)

    assert [i["id"] for i in arun(scenario())["items"]] == ["pushed-late"]


def test_a_write_that_commits_after_a_poll_is_still_delivered(tmp_path):
    """Why `serverTime` trails the clock: a write stamped before the poll but stored after it."""
    async def scenario():
        uc, _, clock = build(tmp_path)
        workspace_id, key = await create(uc)
        clock.now = NOW + 1_000_500
        polled = await uc.list_items(workspace_id, key, 0)             # polls at +1,000,500
        clock.now = NOW + 1_000_000                                    # a slower writer, stamped earlier,
        await uc.put_items(workspace_id, key, put(incoming("late")))   # commits only now
        clock.now = NOW + 1_005_000
        return polled, await uc.list_items(workspace_id, key, polled["serverTime"])

    polled, next_poll = arun(scenario())
    assert polled["items"] == [] and polled["serverTime"] == NOW + 1_000_500 - SYNC_LAG_MS
    assert [i["id"] for i in next_poll["items"]] == ["late"]


def test_paging_by_count_covers_every_record_exactly_once(tmp_path):
    async def scenario():
        uc, _, clock = build(tmp_path, page_items=3)
        workspace_id, key = await create(uc)
        for batch in range(4):
            clock.now = NOW + batch * 10_000
            await uc.put_items(workspace_id, key, put(*[incoming(f"r{batch}-{n}") for n in range(3)]))
        clock.now = NOW + 100_000
        seen, cursor, pages = [], 0, 0
        while True:
            page = await uc.list_items(workspace_id, key, cursor)
            seen += [i["id"] for i in page["items"]]
            cursor, pages = page["serverTime"], pages + 1
            if not page["more"]:
                return seen, pages

    seen, pages = arun(scenario())
    assert len(seen) == 12 and len(set(seen)) == 12 and pages == 4      # the last full page knows it is last
    assert seen == [f"r{batch}-{n}" for batch in range(4) for n in range(3)]


def test_a_batch_of_records_is_never_cut_through_the_middle_of_a_stamp(tmp_path):
    """One request stores records at distinct stamps, so a page boundary cannot hide one."""
    async def scenario():
        uc, _, clock = build(tmp_path, page_items=7)
        workspace_id, key = await create(uc)
        await uc.put_items(workspace_id, key, put(*[incoming(f"b{n:02d}") for n in range(30)]))
        clock.now += 10 * SYNC_LAG_MS
        seen, cursor = [], 0
        for _ in range(20):
            page = await uc.list_items(workspace_id, key, cursor)
            seen += [i["id"] for i in page["items"]]
            cursor = page["serverTime"]
            if not page["more"]:
                break
        return seen

    seen = arun(scenario())
    assert sorted(seen) == [f"b{n:02d}" for n in range(30)] and len(seen) == 30


def test_paging_by_size_keeps_one_answer_under_the_byte_budget(tmp_path):
    async def scenario():
        uc, _, clock = build(tmp_path, page_bytes=30_000)
        workspace_id, key = await create(uc)
        big = "x" * 9_000
        await uc.put_items(workspace_id, key, put(*[
            incoming(f"f{n}", files=[{"path": "main.cpp", "content": big}]) for n in range(8)]))
        clock.now += 60_000
        first = await uc.list_items(workspace_id, key, 0)
        rest = await uc.list_items(workspace_id, key, first["serverTime"])
        return first, rest

    first, rest = arun(scenario())
    assert first["more"] is True and 1 <= len(first["items"]) < 8
    assert first["serverTime"] == first["items"][-1]["serverUpdatedAt"]            # a cursor, not a clock
    assert len(json.dumps(first["items"])) <= 30_000 + 9_500
    assert len(first["items"]) + len(rest["items"]) >= 4


def test_one_record_bigger_than_the_budget_is_still_delivered(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path, page_bytes=100)
        workspace_id, key = await create(uc)
        await uc.put_items(workspace_id, key, put(incoming("fat", files=[{"path": "a.cpp", "content": "z" * 5_000}])))
        return await uc.list_items(workspace_id, key, 0)

    page = arun(scenario())
    assert [i["id"] for i in page["items"]] == ["fat"] and page["more"] is False


def test_limit_asks_for_a_smaller_page_but_never_a_bigger_one(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path, page_items=5)
        workspace_id, key = await create(uc)
        await uc.put_items(workspace_id, key, put(*[incoming(f"r{n}") for n in range(8)]))
        return await uc.list_items(workspace_id, key, 0, limit=2), await uc.list_items(workspace_id, key, 0, limit=500)

    small, huge = arun(scenario())
    assert len(small["items"]) == 2 and small["more"] is True
    assert len(huge["items"]) == 5 and huge["more"] is True


# ---------------------------------------------------------------------------
# validation
# ---------------------------------------------------------------------------
def bad_item(tmp_path, *items):
    async def scenario():
        uc, repo, _ = build(tmp_path)
        workspace_id, key = await create(uc)
        return uc, repo, workspace_id, key

    uc, repo, workspace_id, key = arun(scenario())
    error = refused(uc.put_items(workspace_id, key, put(*items)))
    return error, arun(repo.count_items(workspace_id))


def test_a_snippet_has_exactly_one_file_and_a_project_at_least_one(tmp_path):
    two = incoming("s", files=[{"path": "a.cpp", "content": ""}, {"path": "b.cpp", "content": ""}])
    error, stored = bad_item(tmp_path, two)
    assert error.status_code == 400 and error.payload == {"code": "codestore_bad_item", "itemId": "s"}
    assert "một tệp" in error.message and stored == 0

    error, _ = bad_item(tmp_path, incoming("p", kind="project", files=[]))
    assert error.payload["code"] == "codestore_bad_item" and "ít nhất" in error.message
    error, _ = bad_item(tmp_path, incoming("s2", files=[]))
    assert error.payload["code"] == "codestore_bad_item"


@pytest.mark.parametrize("path", ["../x", "a/../../x", "/etc/passwd", "C:\\x", "dir/", "a/\x00b", "a/\x1b[0m", "..\\x"])
def test_file_paths_that_climb_or_hold_control_characters_are_refused(tmp_path, path):
    error, stored = bad_item(tmp_path, incoming("p", kind="project", files=[
        {"path": "ok.cpp", "content": ""}, {"path": path, "content": "x"}]))
    assert error.status_code == 400 and error.payload["code"] == "codestore_bad_item" and stored == 0


def test_duplicate_paths_are_refused_even_when_they_differ_only_by_case_or_slash_style(tmp_path):
    error, _ = bad_item(tmp_path, incoming("p", kind="project", files=[
        {"path": "src/A.cpp", "content": ""}, {"path": "src\\a.cpp", "content": ""}]))
    assert error.payload["code"] == "codestore_bad_item" and "Trùng" in error.message
    error, _ = bad_item(tmp_path, incoming("p", kind="project", files=[
        {"path": "src", "content": ""}, {"path": "src/a.cpp", "content": ""}]))
    assert "thư mục" in error.message


def test_meta_and_whole_record_have_byte_limits(tmp_path):
    big_meta = incoming("m", meta={"note": "x" * (MAX_META_BYTES + 1)})
    error, _ = bad_item(tmp_path, big_meta)
    assert error.payload["code"] == "codestore_bad_item" and "meta" in error.message

    ok_meta = incoming("m", meta={"note": "x" * (MAX_META_BYTES - 100)})
    huge = incoming("h", files=[{"path": "a.cpp", "content": "😀" * (MAX_ITEM_BYTES // 4)}])      # a bit over 512 KB
    error, _ = bad_item(tmp_path, ok_meta, huge)
    assert error.payload == {"code": "codestore_bad_item", "itemId": "h"}


def test_a_request_over_two_megabytes_is_refused(tmp_path):
    chunk = "y" * 400_000
    items = [incoming(f"r{n}", files=[{"path": "a.cpp", "content": chunk}]) for n in range(6)]
    error, stored = bad_item(tmp_path, *items)
    assert error.payload["code"] == "codestore_too_large" and stored == 0


def test_a_device_clock_a_day_ahead_is_refused_a_few_hours_ahead_is_not(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path)
        workspace_id, key = await create(uc)
        fine = await uc.put_items(workspace_id, key, put(incoming("soon", updated=NOW + 3 * 3600 * 1000)))
        return uc, workspace_id, key, fine

    uc, workspace_id, key, fine = arun(scenario())
    assert fine["items"][0]["id"] == "soon"
    error = refused(uc.put_items(workspace_id, key, put(incoming("far", updated=NOW + 2 * DAY))))
    assert error.status_code == 400 and error.payload["code"] == "codestore_bad_clock" and error.payload["itemId"] == "far"


def test_one_bad_record_refuses_the_whole_request_and_stores_nothing(tmp_path):
    async def scenario():
        uc, repo, _ = build(tmp_path)
        workspace_id, key = await create(uc)
        return uc, repo, workspace_id, key

    uc, repo, workspace_id, key = arun(scenario())
    refused(uc.put_items(workspace_id, key, put(incoming("good-1"), incoming("bad", files=[]), incoming("good-2"))))
    assert arun(repo.count_items(workspace_id)) == 0


def test_the_name_is_trimmed_and_may_not_hold_control_characters(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path)
        workspace_id, key = await create(uc)
        ok = await uc.put_items(workspace_id, key, put(incoming("a", name="  Bài tập  ")))
        return uc, workspace_id, key, ok

    uc, workspace_id, key, ok = arun(scenario())
    assert ok["items"][0]["name"] == "Bài tập"
    assert refused(uc.put_items(workspace_id, key, put(incoming("b", name="x\x00y")))).payload["code"] == "codestore_bad_item"


@pytest.mark.parametrize("field, value", [("id", ""), ("id", "has space"), ("id", "../x"), ("id", "a" * 81),
                                          ("kind", "folder"), ("language", "c++; rm"), ("language", "x" * 33),
                                          ("updatedAt", -1), ("name", "n" * 201)])
def test_the_schema_stops_malformed_fields_before_the_use_case(field, value):
    values = dict(id="i", kind="snippet", name="n", language="cpp", files=[{"path": "a.cpp", "content": ""}],
                  meta={}, updatedAt=1, deleted=False)
    values[field] = value
    with pytest.raises(Exception):
        CodeItemIn(**values)


def test_the_schema_caps_records_per_request_and_files_per_record():
    with pytest.raises(Exception):
        PutItemsRequest(items=[incoming(f"r{n}") for n in range(101)])
    with pytest.raises(Exception):
        CodeItemIn(id="p", kind="project", updatedAt=1, files=[CodeFile(path=f"f{n}", content="") for n in range(201)])
    assert len(PutItemsRequest(items=[incoming(f"r{n}") for n in range(100)]).items) == 100


# ---------------------------------------------------------------------------
# quota
# ---------------------------------------------------------------------------
def test_a_full_workspace_refuses_new_records_but_still_updates_existing_ones(tmp_path):
    async def scenario():
        uc, repo, _ = build(tmp_path, max_items=3)
        workspace_id, key = await create(uc)
        await uc.put_items(workspace_id, key, put(incoming("a"), incoming("b"), incoming("c")))
        return uc, repo, workspace_id, key

    uc, repo, workspace_id, key = arun(scenario())
    error = refused(uc.put_items(workspace_id, key, put(incoming("d"))))
    assert error.status_code == 400 and error.payload == {"code": "codestore_workspace_full", "limit": 3}
    assert "3/3" in error.message and arun(repo.count_items(workspace_id)) == 3

    updated = arun(uc.put_items(workspace_id, key, put(incoming("a", updated=NOW - 10))))
    assert updated["items"][0]["updatedAt"] == NOW - 10
    # A request mixing an update with TWO new records would overflow: refused whole.
    refused(uc.put_items(workspace_id, key, put(incoming("a", updated=NOW - 5), incoming("e"))))
    assert arun(repo.count_items(workspace_id)) == 3


def test_old_tombstones_are_discarded_to_make_room_young_ones_are_not(tmp_path):
    async def scenario():
        uc, repo, clock = build(tmp_path, max_items=3, tombstone_ttl_days=30)
        workspace_id, key = await create(uc)
        await uc.put_items(workspace_id, key, put(incoming("live"), incoming("old-gone", deleted=True)))
        clock.now += 40 * DAY
        await uc.put_items(workspace_id, key, put(incoming("young-gone", deleted=True, updated=clock.now - 1000)))
        return uc, repo, clock, workspace_id, key

    uc, repo, clock, workspace_id, key = arun(scenario())
    assert arun(repo.count_items(workspace_id)) == 3
    arun(uc.put_items(workspace_id, key, put(incoming("fresh", updated=clock.now - 10))))
    held = arun(repo.get_items(workspace_id, ["live", "old-gone", "young-gone", "fresh"]))
    assert sorted(held) == ["fresh", "live", "young-gone"]                       # only the 40-day-old tombstone went


def test_when_only_young_tombstones_fill_the_workspace_it_is_full(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path, max_items=2, tombstone_ttl_days=30)
        workspace_id, key = await create(uc)
        await uc.put_items(workspace_id, key, put(incoming("a", deleted=True), incoming("b", deleted=True)))
        return uc, workspace_id, key

    uc, workspace_id, key = arun(scenario())
    assert refused(uc.put_items(workspace_id, key, put(incoming("c")))).payload["code"] == "codestore_workspace_full"


# ---------------------------------------------------------------------------
# the same flow on every backend
# ---------------------------------------------------------------------------
def json_backend(tmp_path):
    return JsonCodestoreRepository(file_path=tmp_path / "flow.json")


def sql_backend(_tmp_path):
    return MySqlCodestoreRepository()


def mongo_backend(_tmp_path):
    return MongoCodestoreRepository()


BACKENDS = [pytest.param(json_backend, id="json"), pytest.param(sql_backend, id="sql"),
            pytest.param(mongo_backend, id="mongo")]


@pytest.mark.parametrize("backend", BACKENDS)
def test_the_whole_sync_flow_is_the_same_on_json_mysql_and_mongo(backend, tmp_path, monkeypatch):
    fake_mongo.install(monkeypatch, mongo_repository)

    async def scenario():
        clock = Clock()
        uc = CodestoreUseCase(backend(tmp_path), clock=clock, page_items=2)
        workspace_id, key = await create(uc)

        # device A pushes two records, device B a stale edit of one and a deletion of the other
        await uc.put_items(workspace_id, key, put(
            incoming("s", updated=NOW - 500, files=[{"path": "main.cpp", "content": "A's edit"}]),
            incoming("p", kind="project", updated=NOW - 500, files=[{"path": "src/a.py", "content": "1"},
                                                                    {"path": "src/b.py", "content": "2"}])))
        clock.now += 5_000
        b = await uc.put_items(workspace_id, key, put(
            incoming("s", updated=NOW - 900, files=[{"path": "main.cpp", "content": "B's stale edit"}]),
            incoming("p", updated=NOW - 100, deleted=True, kind="project")))
        clock.now += 5_000
        everything = []
        cursor = 0
        while True:
            page = await uc.list_items(workspace_id, key, cursor)
            everything += page["items"]
            cursor = page["serverTime"]
            if not page["more"]:
                break
        return b, everything

    b, everything = arun(scenario())
    by_id = {item["id"]: item for item in b["items"]}
    assert by_id["s"]["files"][0]["content"] == "A's edit" and by_id["p"]["deleted"] is True
    final = {item["id"]: item for item in everything}
    assert final["s"]["files"][0]["content"] == "A's edit" and final["p"]["deleted"] is True and final["p"]["files"] == []
