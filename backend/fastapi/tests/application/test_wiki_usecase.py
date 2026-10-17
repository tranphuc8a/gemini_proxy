"""The rules of the Personal Wiki store: access, validation, merging, quotas, paging.

Most tests run against the real `JsonWikiRepository` on a temp file rather than a
fake: the atomic merge lives in the repository, so a fake would test the test. One
flow runs against all three backends (see `test_wiki_repositories.py` for the
per-backend contract).
"""

import os

os.environ.setdefault("TESTING", "1")

import json
import re

import pytest

from src.adapter.output.wiki import mongo_repository
from src.adapter.output.wiki.json_repository import JsonWikiRepository
from src.adapter.output.wiki.mongo_repository import MongoWikiRepository
from src.adapter.output.wiki.mysql_repository import MySqlWikiRepository
from src.application.exceptions.exceptions import AppException, NotFoundError, UnauthorizedError
from src.application.usecases.wiki_usecase import SYNC_LAG_MS, WikiUseCase, hash_key
from src.application.utils.rate_limit import FailureWindow
from src.domain.vo.wiki_vo import (
    MAX_ITEM_BYTES,
    MAX_ITEMS_PER_PUT,
    MAX_PUT_BYTES,
    PutItemsRequest,
    RecordIn,
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


def incoming(item_id="n1", updated=NOW - 1000, kind="note", data=None, deleted=False, **overrides):
    if data is None:
        data = {} if deleted else {"title": "Bài 1", "body": "xin chào 🍜", "tags": ["ôn thi"]}
    values = dict(id=item_id, kind=kind, updatedAt=updated, deleted=deleted, data=data)
    values.update(overrides)
    return RecordIn(**values)


def put(*items):
    return PutItemsRequest(items=list(items))


def build(tmp_path, clock=None, **options):
    repo = JsonWikiRepository(file_path=tmp_path / "wiki.json")
    clock = clock or Clock()
    return WikiUseCase(repo, clock=clock, **options), repo, clock


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
    assert re.fullmatch(r"wk_[A-Za-z0-9_-]{16}", workspace_id) and len(key) >= 32
    assert stored.key_hash == hash_key(key) and key not in stored.model_dump_json()
    assert key not in (tmp_path / "wiki.json").read_text(encoding="utf-8")
    assert hash_key(key) in (tmp_path / "wiki.json").read_text(encoding="utf-8")


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
    missing = refused(uc.list_items("wk_unknown", key, 0))
    assert isinstance(missing, NotFoundError) and missing.payload["code"] == "wiki_not_found"
    none = refused(uc.list_items(workspace_id, "", 0))
    assert isinstance(none, UnauthorizedError) and none.payload["code"] == "wiki_key_required"
    wrong = refused(uc.list_items(workspace_id, "not-the-key", 0))
    assert isinstance(wrong, UnauthorizedError) and wrong.payload["code"] == "wiki_bad_key"
    assert arun(uc.list_items(workspace_id, key, 0))["items"] == []


def test_a_key_of_one_workspace_does_not_open_another(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path)
        a, key_a = await create(uc)
        b, key_b = await create(uc)
        await uc.put_items(a, key_a, put(incoming("secret")))
        return uc, a, key_a, b, key_b

    uc, a, key_a, b, key_b = arun(scenario())
    assert refused(uc.list_items(a, key_b, 0)).payload["code"] == "wiki_bad_key"
    assert refused(uc.put_items(a, key_b, put(incoming()))).payload["code"] == "wiki_bad_key"
    assert refused(uc.delete_workspace(a, key_b)).payload["code"] == "wiki_bad_key"
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
    assert blocked.status_code == 429 and blocked.payload["code"] == "wiki_rate_limited"
    assert int(blocked.headers["Retry-After"]) >= 1
    # Even the right key waits (the attacker may have found it), but another address does not.
    assert refused(uc.list_items(workspace_id, key, 0, ip="6.6.6.6")).status_code == 429
    assert arun(uc.list_items(workspace_id, key, 0, ip="7.7.7.7"))["items"] == []
    # Every route is guarded: a blocked address cannot write or delete either.
    assert refused(uc.put_items(workspace_id, key, put(incoming()), ip="6.6.6.6")).status_code == 429
    assert refused(uc.delete_workspace(workspace_id, key, ip="6.6.6.6")).status_code == 429


def test_creating_workspaces_is_limited_per_address(tmp_path):
    uc, _, _ = build(tmp_path, workspace_limiter=FailureWindow(2, 3600))
    arun(uc.create_workspace("5.5.5.5"))
    arun(uc.create_workspace("5.5.5.5"))
    blocked = refused(uc.create_workspace("5.5.5.5"))
    assert blocked.status_code == 429 and blocked.payload["code"] == "wiki_rate_limited"
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
# put / get, last writer wins
# ---------------------------------------------------------------------------
def test_put_answers_with_what_the_server_holds_for_the_ids_sent(tmp_path):
    async def scenario():
        uc, _, clock = build(tmp_path)
        workspace_id, key = await create(uc)
        return await uc.put_items(workspace_id, key, put(incoming("a"), incoming("b", kind="card", data={"front": "x"}))), clock

    out, clock = arun(scenario())
    assert set(out) == {"items", "serverTime"}
    assert [item["id"] for item in out["items"]] == ["a", "b"]
    assert out["serverTime"] == clock.now - SYNC_LAG_MS
    assert out["items"][0]["serverUpdatedAt"] == NOW and out["items"][1]["serverUpdatedAt"] == NOW + 1   # distinct stamps
    assert out["items"][1]["kind"] == "card" and out["items"][1]["data"] == {"front": "x"}
    assert set(out["items"][0]) == {"id", "kind", "updatedAt", "deleted", "data", "serverUpdatedAt"}


def test_data_is_stored_exactly_as_sent_the_server_does_not_look_inside(tmp_path):
    odd = {"$set": {"a.b": [1, 2.5, None, True, {"": "empty key"}]}, "emoji": "🍜", "nested": {"deep": {"x": [[]]}}}

    async def scenario():
        uc, _, _ = build(tmp_path)
        workspace_id, key = await create(uc)
        await uc.put_items(workspace_id, key, put(incoming("a", data=odd)))
        return (await uc.list_items(workspace_id, key, 0))["items"][0]["data"]

    assert arun(scenario()) == odd


def test_the_server_copy_wins_and_is_what_comes_back(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path)
        workspace_id, key = await create(uc)
        await uc.put_items(workspace_id, key, put(incoming("a", updated=NOW - 100, data={"body": "newer on the server"})))
        stale = await uc.put_items(workspace_id, key, put(incoming("a", updated=NOW - 500, data={"body": "older, stale device"})))
        fresh = await uc.put_items(workspace_id, key, put(incoming("a", updated=NOW - 50, data={"body": "newest"})))
        return stale, fresh

    stale, fresh = arun(scenario())
    assert stale["items"][0]["data"]["body"] == "newer on the server" and stale["items"][0]["updatedAt"] == NOW - 100
    assert fresh["items"][0]["data"]["body"] == "newest"


def test_a_tie_keeps_the_stored_record_unless_the_incoming_one_is_a_deletion(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path)
        workspace_id, key = await create(uc)
        t = NOW - 100
        await uc.put_items(workspace_id, key, put(incoming("edit", updated=t, data={"body": "first"}),
                                                  incoming("gone", updated=t, deleted=True)))
        again = await uc.put_items(workspace_id, key, put(incoming("edit", updated=t, data={"body": "second"}),
                                                          incoming("gone", updated=t, data={"body": "resurrected?"})))
        killed = await uc.put_items(workspace_id, key, put(incoming("edit", updated=t, deleted=True)))
        return again, killed

    again, killed = arun(scenario())
    by_id = {item["id"]: item for item in again["items"]}
    assert by_id["edit"]["data"] == {"body": "first"} and by_id["edit"]["deleted"] is False     # equal edits: stored stays
    assert by_id["gone"]["deleted"] is True and by_id["gone"]["data"] == {}                      # an edit never beats a tombstone
    assert killed["items"][0]["deleted"] is True and killed["items"][0]["data"] == {}            # a deletion beats an edit


def test_a_deletion_is_kept_as_a_tombstone_that_drops_data(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path)
        workspace_id, key = await create(uc)
        await uc.put_items(workspace_id, key, put(incoming("a", updated=NOW - 300)))
        gone = await uc.put_items(workspace_id, key, put(incoming(
            "a", updated=NOW - 200, deleted=True, data={"title": "should vanish", "body": "x" * 1000})))
        listed = await uc.list_items(workspace_id, key, 0)
        late_edit = await uc.put_items(workspace_id, key, put(incoming("a", updated=NOW - 250)))
        newer_edit = await uc.put_items(workspace_id, key, put(incoming("a", updated=NOW - 10, data={"title": "back"})))
        return gone, listed, late_edit, newer_edit

    gone, listed, late_edit, newer_edit = arun(scenario())
    [tombstone] = gone["items"]
    assert tombstone["deleted"] is True and tombstone["data"] == {} and tombstone["kind"] == "note"
    assert listed["items"][0]["deleted"] is True                               # other devices learn of it
    assert late_edit["items"][0]["deleted"] is True                            # an older edit cannot undo it
    assert newer_edit["items"][0]["deleted"] is False and newer_edit["items"][0]["data"] == {"title": "back"}


def test_the_same_id_twice_in_one_request_keeps_the_later_one(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path)
        workspace_id, key = await create(uc)
        return await uc.put_items(workspace_id, key, put(
            incoming("a", updated=NOW - 100, data={"body": "later"}),
            incoming("b"),
            incoming("a", updated=NOW - 900, data={"body": "earlier"}),
            incoming("c", updated=NOW - 100, data={"body": "first"}),
            incoming("c", updated=NOW - 100, deleted=True),                # a tie in the same request: deletion wins
            incoming("d", updated=NOW - 100, data={"body": "first"}),
            incoming("d", updated=NOW - 100, data={"body": "second"}),     # an equal edit: the first stays
        ))

    out = arun(scenario())
    assert [item["id"] for item in out["items"]] == ["a", "b", "c", "d"]
    by_id = {item["id"]: item for item in out["items"]}
    assert by_id["a"]["data"]["body"] == "later" and by_id["c"]["deleted"] is True and by_id["d"]["data"]["body"] == "first"
    assert [item["serverUpdatedAt"] for item in out["items"]] == [NOW, NOW + 1, NOW + 2, NOW + 3]


def test_an_empty_put_is_a_harmless_no_op(tmp_path):
    async def scenario():
        uc, _, clock = build(tmp_path)
        workspace_id, key = await create(uc)
        return await uc.put_items(workspace_id, key, put()), clock

    out, clock = arun(scenario())
    assert out == {"items": [], "serverTime": clock.now - SYNC_LAG_MS}


# ---------------------------------------------------------------------------
# the sync cursor
# ---------------------------------------------------------------------------
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


def test_server_time_trails_the_clock_and_never_goes_backwards(tmp_path):
    async def scenario():
        uc, _, clock = build(tmp_path)
        workspace_id, key = await create(uc)
        empty = await uc.list_items(workspace_id, key, 0)
        ahead = await uc.list_items(workspace_id, key, clock.now + 10 * DAY)      # a cursor from the future
        return empty, ahead, clock

    empty, ahead, clock = arun(scenario())
    assert empty["serverTime"] == clock.now - SYNC_LAG_MS
    assert ahead["serverTime"] == clock.now + 10 * DAY


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


@pytest.mark.parametrize("page_items,batches", [(200, (100, 100, 51)), (7, (5, 5, 5, 5)), (4, (3, 9, 2))])
def test_requests_in_the_same_millisecond_stamp_alike_and_no_page_ends_between_two_of_them(tmp_path, page_items, batches):
    """Each request stamps its records `now`, `now+1`, ...: two requests in the same
    millisecond share stamps. The next call asks for strictly more than the cursor, so a page
    that ended between two records with one stamp would silently lose the second."""
    async def scenario():
        uc, _, clock = build(tmp_path, page_items=page_items)
        workspace_id, key = await create(uc)
        total = 0
        for size in batches:                                  # the clock does not move: every request stamps now+0..now+size-1
            await uc.put_items(workspace_id, key, put(*[incoming(f"r{total + n:03d}") for n in range(size)]))
            total += size
        clock.now += 10 * SYNC_LAG_MS
        seen, cursor, pages = [], 0, 0
        for _ in range(200):
            page = await uc.list_items(workspace_id, key, cursor)
            seen += [i["id"] for i in page["items"]]
            cursor, pages = page["serverTime"], pages + 1
            assert len(page["items"]) <= page_items
            if not page["more"]:
                return total, seen, pages
        raise AssertionError("paging did not end")

    total, seen, pages = arun(scenario())
    assert len(seen) == len(set(seen)) == total               # every record exactly once, none lost, none doubled
    assert pages > 1


def test_paging_by_size_keeps_one_answer_under_the_byte_budget(tmp_path):
    async def scenario():
        uc, _, clock = build(tmp_path, page_bytes=30_000)
        workspace_id, key = await create(uc)
        big = "x" * 9_000
        await uc.put_items(workspace_id, key, put(*[incoming(f"f{n}", data={"body": big}) for n in range(8)]))
        clock.now += 60_000
        seen, cursor, pages = [], 0, []
        for _ in range(20):
            page = await uc.list_items(workspace_id, key, cursor)
            seen += [i["id"] for i in page["items"]]
            pages.append(page)
            cursor = page["serverTime"]
            if not page["more"]:
                break
        return pages, seen

    pages, seen = arun(scenario())
    assert pages[0]["more"] is True and 1 <= len(pages[0]["items"]) < 8
    assert pages[0]["serverTime"] == pages[0]["items"][-1]["serverUpdatedAt"]            # a cursor, not a clock
    assert all(len(json.dumps(page["items"])) <= 30_000 + 9_500 for page in pages)
    assert seen == [f"f{n}" for n in range(8)]                                           # all of them, in order


def test_one_record_bigger_than_the_budget_is_still_delivered(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path, page_bytes=100)
        workspace_id, key = await create(uc)
        await uc.put_items(workspace_id, key, put(incoming("fat", data={"body": "z" * 5_000})))
        return await uc.list_items(workspace_id, key, 0)

    page = arun(scenario())
    assert [i["id"] for i in page["items"]] == ["fat"] and page["more"] is False


def test_the_default_page_is_200_records_and_3_megabytes(tmp_path):
    from src.application.usecases import wiki_usecase

    assert wiki_usecase.DEFAULT_PAGE_ITEMS == 200 and wiki_usecase.DEFAULT_PAGE_BYTES == 3_000_000

    async def scenario():
        uc, _, clock = build(tmp_path)
        workspace_id, key = await create(uc)
        for batch in range(2):
            await uc.put_items(workspace_id, key, put(*[incoming(f"b{batch}-{n:03d}") for n in range(150)]))
            clock.now += 1000
        clock.now += 60_000
        return await uc.list_items(workspace_id, key, 0)

    page = arun(scenario())
    assert len(page["items"]) <= 200 and page["more"] is True


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
def bad_request(tmp_path, *items):
    async def scenario():
        uc, repo, _ = build(tmp_path)
        workspace_id, key = await create(uc)
        return uc, repo, workspace_id, key

    uc, repo, workspace_id, key = arun(scenario())
    error = refused(uc.put_items(workspace_id, key, put(*items)))
    return error, arun(repo.count_items(workspace_id))


def test_a_record_of_exactly_the_limit_is_stored_one_byte_over_is_refused(tmp_path):
    # {"t":"<n>"} is 8 bytes of JSON around the text.
    fits = incoming("fits", data={"t": "x" * (MAX_ITEM_BYTES - 8)})
    over = incoming("over", data={"t": "x" * (MAX_ITEM_BYTES - 7)})

    async def scenario():
        uc, repo, _ = build(tmp_path)
        workspace_id, key = await create(uc)
        out = await uc.put_items(workspace_id, key, put(fits))
        return out, uc, repo, workspace_id, key

    out, uc, repo, workspace_id, key = arun(scenario())
    assert out["items"][0]["id"] == "fits"
    error = refused(uc.put_items(workspace_id, key, put(over)))
    assert error.status_code == 400 and error.payload == {"code": "wiki_bad_item", "itemId": "over"}
    assert arun(repo.count_items(workspace_id)) == 1


def test_a_note_of_500000_three_byte_characters_fits(tmp_path):
    """The reason for the limit: 500,000 characters of up to 3 bytes each in UTF-8."""
    note = incoming("big", data={"title": "dài", "body": "ế" * 500_000})

    async def scenario():
        uc, _, _ = build(tmp_path)
        workspace_id, key = await create(uc)
        await uc.put_items(workspace_id, key, put(note))
        return (await uc.list_items(workspace_id, key, 0))["items"]

    [held] = arun(scenario())
    assert held["data"]["body"] == "ế" * 500_000


def test_data_that_cannot_be_written_as_json_utf8_is_refused(tmp_path):
    for nasty in ({"x": float("nan")}, {"x": float("inf")}, {"x": "lone \ud800 surrogate"}):
        error, stored = bad_request(tmp_path, incoming("ok"), incoming("nasty", data=nasty))
        assert error.status_code == 400 and error.payload == {"code": "wiki_bad_item", "itemId": "nasty"} and stored == 0


def test_a_request_over_four_megabytes_is_refused_as_a_whole(tmp_path):
    chunk = "y" * 1_400_000
    items = [incoming(f"r{n}", data={"body": chunk}) for n in range(3)]       # 4.2 MB: each is within its own limit
    assert sum(len(item.data["body"]) for item in items) > MAX_PUT_BYTES
    error, stored = bad_request(tmp_path, *items)
    assert error.payload == {"code": "wiki_too_large"} and stored == 0


def test_a_request_just_under_four_megabytes_is_stored(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path)
        workspace_id, key = await create(uc)
        items = [incoming(f"r{n}", data={"body": "y" * 1_300_000}) for n in range(3)]          # 3.9 MB
        return await uc.put_items(workspace_id, key, put(*items))

    assert len(arun(scenario())["items"]) == 3


def test_a_device_clock_a_day_ahead_is_refused_a_few_hours_ahead_is_not(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path)
        workspace_id, key = await create(uc)
        fine = await uc.put_items(workspace_id, key, put(incoming("soon", updated=NOW + 3 * 3600 * 1000)))
        return uc, workspace_id, key, fine

    uc, workspace_id, key, fine = arun(scenario())
    assert fine["items"][0]["id"] == "soon"
    error = refused(uc.put_items(workspace_id, key, put(incoming("far", updated=NOW + 2 * DAY))))
    assert error.status_code == 400 and error.payload == {"code": "wiki_bad_clock", "itemId": "far"}
    # a deletion from a fast clock would win every merge as well
    error = refused(uc.put_items(workspace_id, key, put(incoming("far-gone", updated=NOW + 2 * DAY, deleted=True))))
    assert error.payload["code"] == "wiki_bad_clock"


def test_one_bad_record_refuses_the_whole_request_and_stores_nothing(tmp_path):
    error, stored = bad_request(tmp_path, incoming("good-1"), incoming("bad", updated=NOW + 9 * DAY), incoming("good-2"))
    assert error.payload["code"] == "wiki_bad_clock" and stored == 0

    big = incoming("big", data={"body": "x" * (MAX_ITEM_BYTES + 1)})
    error, stored = bad_request(tmp_path, incoming("good-1"), big, incoming("good-2"))
    assert error.payload == {"code": "wiki_bad_item", "itemId": "big"} and stored == 0


@pytest.mark.parametrize("field, value", [("id", ""), ("id", "has space"), ("id", "../x"), ("id", "a" * 81),
                                          ("id", "ế"), ("id", "x/y"),
                                          ("kind", "folder"), ("kind", "Note"), ("kind", ""),
                                          ("updatedAt", -1), ("updatedAt", 4_102_444_800_001), ("updatedAt", "yesterday"),
                                          ("data", []), ("data", "text"), ("data", None), ("deleted", "maybe")])
def test_the_schema_stops_malformed_fields_before_the_use_case(field, value):
    values = dict(id="i", kind="note", updatedAt=1, deleted=False, data={})
    values[field] = value
    with pytest.raises(Exception):
        RecordIn(**values)


def test_the_schema_accepts_both_kinds_and_every_id_character_class():
    for kind in ("note", "card"):
        assert RecordIn(id="A-z_0.9:x", kind=kind, updatedAt=0).data == {}
    assert RecordIn(id="a" * 80, kind="note", updatedAt=4_102_444_800_000).deleted is False


def test_the_schema_caps_records_per_request():
    assert MAX_ITEMS_PER_PUT == 200
    with pytest.raises(Exception):
        PutItemsRequest(items=[incoming(f"r{n}") for n in range(201)])
    assert len(PutItemsRequest(items=[incoming(f"r{n}") for n in range(200)]).items) == 200


def test_a_full_request_of_200_records_is_stored(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path)
        workspace_id, key = await create(uc)
        return await uc.put_items(workspace_id, key, put(*[incoming(f"r{n:03d}") for n in range(200)]))

    out = arun(scenario())
    assert len(out["items"]) == 200 and [i["serverUpdatedAt"] for i in out["items"]] == list(range(NOW, NOW + 200))


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
    assert error.status_code == 400 and error.payload == {"code": "wiki_workspace_full", "limit": 3}
    assert "3/3" in error.message and arun(repo.count_items(workspace_id)) == 3

    updated = arun(uc.put_items(workspace_id, key, put(incoming("a", updated=NOW - 10))))
    assert updated["items"][0]["updatedAt"] == NOW - 10
    # A request mixing an update with a new record would overflow: refused whole.
    refused(uc.put_items(workspace_id, key, put(incoming("a", updated=NOW - 5), incoming("e"))))
    assert arun(repo.count_items(workspace_id)) == 3


def test_a_workspace_may_fill_up_to_the_limit_exactly(tmp_path):
    async def scenario():
        uc, repo, _ = build(tmp_path, max_items=5)
        workspace_id, key = await create(uc)
        await uc.put_items(workspace_id, key, put(incoming("a"), incoming("b"), incoming("c")))
        await uc.put_items(workspace_id, key, put(incoming("d"), incoming("e")))
        return await repo.count_items(workspace_id)

    assert arun(scenario()) == 5


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
    assert refused(uc.put_items(workspace_id, key, put(incoming("c")))).payload["code"] == "wiki_workspace_full"


def test_an_old_tombstone_resent_as_an_edit_does_not_get_a_free_place(tmp_path):
    """Purging the tombstone of an id that this very request writes again frees nothing: the id takes the place back."""
    async def scenario():
        uc, repo, clock = build(tmp_path, max_items=3, tombstone_ttl_days=30)
        workspace_id, key = await create(uc)
        await uc.put_items(workspace_id, key, put(incoming("live"), incoming("old-gone", deleted=True, updated=NOW - 100)))
        clock.now += 40 * DAY
        await uc.put_items(workspace_id, key, put(incoming("young-gone", deleted=True, updated=clock.now - 1000)))
        error = None
        try:
            await uc.put_items(workspace_id, key, put(incoming("old-gone", updated=clock.now - 10),
                                                      incoming("brand-new", updated=clock.now - 10)))
        except AppException as caught:
            error = caught
        return error, await repo.count_items(workspace_id)

    error, count = arun(scenario())
    assert error is not None and error.payload["code"] == "wiki_workspace_full" and count <= 3


def test_a_roomy_workspace_is_not_asked_which_ids_exist(tmp_path):
    """Far below the limit even an all-new request fits, so the use case reads nothing but the count."""
    async def scenario():
        uc, repo, _ = build(tmp_path, max_items=1000)
        workspace_id, key = await create(uc)
        calls = []
        real = repo.get_items

        async def spy(workspace, ids):
            calls.append(list(ids))
            return await real(workspace, ids)

        repo.get_items = spy
        await uc.put_items(workspace_id, key, put(incoming("a"), incoming("b")))
        return calls

    assert arun(scenario()) == [["a", "b"]]            # only the final read of what the server holds


# ---------------------------------------------------------------------------
# the same flow on every backend
# ---------------------------------------------------------------------------
def json_backend(tmp_path):
    return JsonWikiRepository(file_path=tmp_path / "flow.json")


def sql_backend(_tmp_path):
    return MySqlWikiRepository()


def mongo_backend(_tmp_path):
    return MongoWikiRepository()


BACKENDS = [pytest.param(json_backend, id="json"), pytest.param(sql_backend, id="sql"),
            pytest.param(mongo_backend, id="mongo")]


@pytest.mark.parametrize("backend", BACKENDS)
def test_the_whole_sync_flow_is_the_same_on_json_mysql_and_mongo(backend, tmp_path, monkeypatch):
    fake_mongo.install(monkeypatch, mongo_repository)

    async def scenario():
        clock = Clock()
        uc = WikiUseCase(backend(tmp_path), clock=clock, page_items=2)
        workspace_id, key = await create(uc)

        # device A pushes a note and a card, device B a stale edit of the note and a deletion of the card
        await uc.put_items(workspace_id, key, put(
            incoming("n", updated=NOW - 500, data={"title": "A's edit", "emoji": "🍜"}),
            incoming("c", kind="card", updated=NOW - 500, data={"front": "1", "back": "2"})))
        clock.now += 5_000
        b = await uc.put_items(workspace_id, key, put(
            incoming("n", updated=NOW - 900, data={"title": "B's stale edit"}),
            incoming("c", kind="card", updated=NOW - 100, deleted=True)))
        clock.now += 5_000
        everything, cursor = [], 0
        while True:
            page = await uc.list_items(workspace_id, key, cursor)
            everything += page["items"]
            cursor = page["serverTime"]
            if not page["more"]:
                break
        return b, everything

    b, everything = arun(scenario())
    by_id = {item["id"]: item for item in b["items"]}
    assert by_id["n"]["data"]["title"] == "A's edit" and by_id["c"]["deleted"] is True
    final = {item["id"]: item for item in everything}
    assert final["n"]["data"] == {"title": "A's edit", "emoji": "🍜"} and final["n"]["kind"] == "note"
    assert final["c"]["deleted"] is True and final["c"]["data"] == {} and final["c"]["kind"] == "card"
