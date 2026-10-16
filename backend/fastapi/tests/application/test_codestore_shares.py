"""Read-only share links of `/codestore`: what a link shows, who can make or read one, how it dies.

The use case sits on a real repository (JSON on a temp file for most tests; the
three stores for the end-to-end flow), so what is checked is what a client sees. The
properties that matter, in the order they are tested:

* a link shows a FROZEN copy: edits made after sharing stay private until the owner
  shares again, and re-sharing keeps the token;
* what it shows names nothing about the workspace and nothing of the owner's editor state;
* the token is 128 random bits and never reaches a log;
* a deleted record, a deleted workspace or a revoked link all end the same way (404);
* the public read is rate limited, and so are wrong tokens - apart from the key counter.
"""

import os

os.environ.setdefault("TESTING", "1")

import json
import logging
import re

import pytest

from src.adapter.output.codestore import mongo_repository
from src.adapter.output.codestore.json_repository import JsonCodestoreRepository
from src.adapter.output.codestore.mongo_repository import MongoCodestoreRepository
from src.adapter.output.codestore.mysql_repository import MySqlCodestoreRepository
from src.application.exceptions.exceptions import AppException, BadRequestError, NotFoundError, UnauthorizedError
from src.application.usecases.codestore_usecase import SHARE_NOT_FOUND, CodestoreUseCase
from src.application.utils.rate_limiter import MemoryRateLimiter
from src.domain.vo.codestore_vo import CodeItemIn, PutItemsRequest
from tests.conftest import arun
from tests.support import fake_mongo

NOW = 1_800_000_000_000
IP = "203.0.113.5"


class Clock:
    def __init__(self, now=NOW):
        self.now = now

    def __call__(self):
        return self.now


def incoming(item_id="i1", updated=NOW - 5000, content="int main(){}", deleted=False, meta=None, **overrides):
    values = dict(id=item_id, kind="snippet", name="Bài 1", language="cpp", meta=meta or {}, updatedAt=updated,
                  files=[] if deleted else [{"path": "main.cpp", "content": content}], deleted=deleted)
    values.update(overrides)
    return CodeItemIn(**values)


def put(*items):
    return PutItemsRequest(items=list(items))


def build(tmp_path, clock=None, **options):
    repo = JsonCodestoreRepository(file_path=tmp_path / "codestore.json")
    clock = clock or Clock()
    return CodestoreUseCase(repo, clock=clock, **options), repo, clock


async def workspace_with(uc, *items):
    created = await uc.create_workspace("1.1.1.1")
    if items:
        await uc.put_items(created["workspaceId"], created["key"], put(*items))
    return created["workspaceId"], created["key"]


def fails(coro, kind=AppException):
    with pytest.raises(kind) as caught:
        arun(coro)
    return caught.value


# ---------------------------------------------------------------------------
# making a link
# ---------------------------------------------------------------------------
def test_sharing_gives_a_random_token_and_the_dates(tmp_path):
    async def scenario():
        uc, _, clock = build(tmp_path)
        ws, key = await workspace_with(uc, incoming())
        clock.now = NOW + 123
        return await uc.create_share(ws, key, "i1")

    created, body = arun(scenario())
    assert created is True
    assert set(body) == {"token", "sharedAt", "updatedAt"}
    assert re.fullmatch(r"[A-Za-z0-9_-]{22}", body["token"])            # token_urlsafe(16): 128 bits
    assert body["sharedAt"] == NOW + 123 and body["updatedAt"] == NOW + 123


def test_tokens_do_not_repeat(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path, max_shares=100)
        ws, key = await workspace_with(uc, *[incoming(f"i{n}") for n in range(60)])
        return [(await uc.create_share(ws, key, f"i{n}"))[1]["token"] for n in range(60)]

    tokens = arun(scenario())
    assert len(set(tokens)) == 60


def test_the_token_comes_from_the_injected_factory_so_it_can_be_a_secure_source_in_production_and_fixed_in_tests(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path, token_factory=lambda: "fixed-token-for-the-test")
        ws, key = await workspace_with(uc, incoming())
        return (await uc.create_share(ws, key, "i1"))[1]["token"], await uc.read_shared("fixed-token-for-the-test")

    token, read = arun(scenario())
    assert token == "fixed-token-for-the-test" and read["item"]["id"] == "i1"


def test_a_record_the_server_does_not_hold_cannot_be_shared(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path)
        ws, key = await workspace_with(uc)
        return uc, ws, key

    uc, ws, key = arun(scenario())
    error = fails(uc.create_share(ws, key, "never-synced"), NotFoundError)
    assert error.payload == {"code": "codestore_item_not_found", "itemId": "never-synced"}


def test_a_deleted_record_cannot_be_shared(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path)
        ws, key = await workspace_with(uc, incoming(deleted=True))
        return uc, ws, key

    uc, ws, key = arun(scenario())
    assert fails(uc.create_share(ws, key, "i1"), NotFoundError).payload["code"] == "codestore_item_not_found"


def test_every_share_operation_needs_the_workspace_key(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path)
        ws, key = await workspace_with(uc, incoming())
        await uc.create_share(ws, key, "i1")
        return uc, ws

    uc, ws = arun(scenario())
    for call in (lambda k: uc.create_share(ws, k, "i1"), lambda k: uc.list_shares(ws, k),
                 lambda k: uc.revoke_share(ws, k, "i1")):
        assert fails(call(""), UnauthorizedError).payload["code"] == "codestore_key_required"
        assert fails(call("not-the-key"), UnauthorizedError).payload["code"] == "codestore_bad_key"
    assert fails(uc.create_share("cs_unknown", "k", "i1"), NotFoundError).payload["code"] == "codestore_not_found"


def test_a_key_of_another_workspace_cannot_share_or_list_or_revoke(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path)
        ws, key = await workspace_with(uc, incoming())
        await uc.create_share(ws, key, "i1")
        other_ws, other_key = await workspace_with(uc, incoming())
        return uc, ws, other_key

    uc, ws, other_key = arun(scenario())
    for call in (uc.create_share(ws, other_key, "i1"), uc.list_shares(ws, other_key), uc.revoke_share(ws, other_key, "i1")):
        assert fails(call, UnauthorizedError).payload["code"] == "codestore_bad_key"


# ---------------------------------------------------------------------------
# a link shows a frozen copy
# ---------------------------------------------------------------------------
def test_edits_after_sharing_stay_private_until_the_owner_shares_again(tmp_path):
    async def scenario():
        uc, _, clock = build(tmp_path)
        ws, key = await workspace_with(uc, incoming(updated=NOW - 5000, content="version one"))
        _, first = await uc.create_share(ws, key, "i1")
        await uc.put_items(ws, key, put(incoming(updated=NOW - 4000, content="version two (private)")))
        before = await uc.read_shared(first["token"])
        clock.now = NOW + 900
        created, second = await uc.create_share(ws, key, "i1")
        after = await uc.read_shared(first["token"])
        return first, created, second, before, after

    first, created, second, before, after = arun(scenario())
    assert before["item"]["files"][0]["content"] == "version one"
    assert created is False and second["token"] == first["token"]            # the link stays, only the copy changes
    assert second["sharedAt"] == first["sharedAt"] and second["updatedAt"] == NOW + 900
    assert after["item"]["files"][0]["content"] == "version two (private)" and after["sharedAt"] == first["sharedAt"]


def test_what_a_link_shows_is_the_record_without_workspace_clock_or_editor_state(tmp_path):
    meta = {"stdin": "3\n", "args": ["a b"], "compileArgs": ["-Wall"], "folders": ["docs"],
            "pinned": True, "openTabs": ["main.cpp"], "activeFile": "main.cpp"}

    async def scenario():
        uc, _, _ = build(tmp_path)
        ws, key = await workspace_with(uc, incoming(
            "p1", kind="project", language="python", name="Dự án 🍜", meta=meta,
            files=[{"path": "src/main.py", "content": "print('xin chào')"}, {"path": "README.md", "content": "# x"}]))
        _, made = await uc.create_share(ws, key, "p1")
        return ws, key, made["token"], await uc.read_shared(made["token"])

    ws, key, token, shown = arun(scenario())
    assert set(shown) == {"item", "sharedAt"}
    assert shown["item"] == {
        "id": "p1", "kind": "project", "name": "Dự án 🍜", "language": "python",
        "files": [{"path": "src/main.py", "content": "print('xin chào')"}, {"path": "README.md", "content": "# x"}],
        "meta": {"stdin": "3\n", "args": ["a b"], "compileArgs": ["-Wall"], "folders": ["docs"]},
        "updatedAt": NOW - 5000,
    }
    text = json.dumps(shown, ensure_ascii=False)
    for secret in (ws, key, "serverUpdatedAt", "workspace", "key_hash", "pinned", "openTabs", "activeFile", "deleted"):
        assert secret not in text


def test_the_stored_record_keeps_its_editor_state_only_the_link_hides_it(tmp_path):
    async def scenario():
        uc, repo, _ = build(tmp_path)
        ws, key = await workspace_with(uc, incoming(meta={"pinned": True, "activeFile": "main.cpp"}))
        await uc.create_share(ws, key, "i1")
        return (await repo.get_items(ws, ["i1"]))["i1"].meta

    assert arun(scenario()) == {"pinned": True, "activeFile": "main.cpp"}


# ---------------------------------------------------------------------------
# listing and revoking
# ---------------------------------------------------------------------------
def test_listing_names_each_link_with_its_record_and_dates(tmp_path):
    async def scenario():
        uc, _, clock = build(tmp_path)
        ws, key = await workspace_with(uc, incoming("a", name="Đầu"), incoming("b", name="Sau"))
        _, first = await uc.create_share(ws, key, "a")
        clock.now = NOW + 50
        _, second = await uc.create_share(ws, key, "b")
        other_ws, other_key = await workspace_with(uc, incoming("a"))
        await uc.create_share(other_ws, other_key, "a")
        return first, second, await uc.list_shares(ws, key), await uc.list_shares(other_ws, other_key)

    first, second, listed, others = arun(scenario())
    assert listed == {"shares": [
        {"token": second["token"], "itemId": "b", "name": "Sau", "sharedAt": NOW + 50, "updatedAt": NOW + 50},
        {"token": first["token"], "itemId": "a", "name": "Đầu", "sharedAt": NOW, "updatedAt": NOW},
    ]}
    assert len(others["shares"]) == 1                                         # another workspace's links are its own


def test_an_empty_workspace_lists_no_links(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path)
        ws, key = await workspace_with(uc)
        return await uc.list_shares(ws, key)

    assert arun(scenario()) == {"shares": []}


def test_revoking_ends_the_link_and_a_second_revoke_says_so(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path)
        ws, key = await workspace_with(uc, incoming())
        _, made = await uc.create_share(ws, key, "i1")
        revoked = await uc.revoke_share(ws, key, "i1")
        return uc, ws, key, made["token"], revoked

    uc, ws, key, token, revoked = arun(scenario())
    assert revoked == {"revoked": True}
    assert fails(uc.read_shared(token), NotFoundError).payload["code"] == "codestore_share_not_found"
    assert fails(uc.revoke_share(ws, key, "i1"), NotFoundError).payload["code"] == "codestore_share_not_found"
    assert fails(uc.revoke_share(ws, key, "never-shared"), NotFoundError).payload["code"] == "codestore_share_not_found"
    assert arun(uc.list_shares(ws, key)) == {"shares": []}


def test_sharing_again_after_a_revoke_makes_a_new_token_and_the_old_stays_dead(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path)
        ws, key = await workspace_with(uc, incoming())
        _, first = await uc.create_share(ws, key, "i1")
        await uc.revoke_share(ws, key, "i1")
        created, second = await uc.create_share(ws, key, "i1")
        return uc, first, created, second

    uc, first, created, second = arun(scenario())
    assert created is True and second["token"] != first["token"]
    assert fails(uc.read_shared(first["token"]), NotFoundError)
    assert arun(uc.read_shared(second["token"]))["item"]["id"] == "i1"


# ---------------------------------------------------------------------------
# quota
# ---------------------------------------------------------------------------
def test_a_workspace_holds_at_most_max_shares_links(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path, max_shares=2)
        ws, key = await workspace_with(uc, incoming("a"), incoming("b"), incoming("c"))
        await uc.create_share(ws, key, "a")
        await uc.create_share(ws, key, "b")
        return uc, ws, key

    uc, ws, key = arun(scenario())
    error = fails(uc.create_share(ws, key, "c"), BadRequestError)
    assert error.payload == {"code": "codestore_too_many_shares", "limit": 2}
    # refreshing a link that exists is not "one more"
    created, _ = arun(uc.create_share(ws, key, "a"))
    assert created is False
    arun(uc.revoke_share(ws, key, "b"))
    assert arun(uc.create_share(ws, key, "c"))[0] is True


def test_the_quota_is_per_workspace(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path, max_shares=1)
        first_ws, first_key = await workspace_with(uc, incoming("a"))
        second_ws, second_key = await workspace_with(uc, incoming("a"))
        await uc.create_share(first_ws, first_key, "a")
        return (await uc.create_share(second_ws, second_key, "a"))[0]

    assert arun(scenario()) is True


# ---------------------------------------------------------------------------
# a link dies with its record and with its workspace
# ---------------------------------------------------------------------------
def test_deleting_the_record_revokes_its_link(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path)
        ws, key = await workspace_with(uc, incoming("a"), incoming("b"))
        _, a = await uc.create_share(ws, key, "a")
        _, b = await uc.create_share(ws, key, "b")
        await uc.put_items(ws, key, put(incoming("a", updated=NOW - 100, deleted=True)))
        return uc, ws, key, a["token"], b["token"]

    uc, ws, key, gone, kept = arun(scenario())
    assert fails(uc.read_shared(gone), NotFoundError).payload["code"] == "codestore_share_not_found"
    assert arun(uc.read_shared(kept))["item"]["id"] == "b"
    assert [share["itemId"] for share in arun(uc.list_shares(ws, key))["shares"]] == ["b"]


def test_a_deletion_that_lost_to_a_newer_edit_does_not_revoke(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path)
        ws, key = await workspace_with(uc, incoming(updated=NOW - 100, content="newer"))
        _, made = await uc.create_share(ws, key, "i1")
        await uc.put_items(ws, key, put(incoming(updated=NOW - 900, deleted=True)))         # an old tombstone arrives late
        return uc, made["token"]

    uc, token = arun(scenario())
    assert arun(uc.read_shared(token))["item"]["files"][0]["content"] == "newer"


def test_an_edit_or_a_resurrection_after_deletion_does_not_bring_the_old_link_back(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path)
        ws, key = await workspace_with(uc, incoming(updated=NOW - 900))
        _, made = await uc.create_share(ws, key, "i1")
        await uc.put_items(ws, key, put(incoming(updated=NOW - 500, deleted=True)))
        await uc.put_items(ws, key, put(incoming(updated=NOW - 100, content="alive again")))
        return uc, ws, key, made["token"]

    uc, ws, key, token = arun(scenario())
    assert fails(uc.read_shared(token), NotFoundError)
    assert arun(uc.list_shares(ws, key)) == {"shares": []}


def test_a_plain_edit_keeps_the_link_but_not_the_copy(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path)
        ws, key = await workspace_with(uc, incoming(content="first"))
        _, made = await uc.create_share(ws, key, "i1")
        await uc.put_items(ws, key, put(incoming(updated=NOW - 100, content="second")))
        return (await uc.read_shared(made["token"]))["item"]["files"][0]["content"], len((await uc.list_shares(ws, key))["shares"])

    assert arun(scenario()) == ("first", 1)


def test_deleting_the_workspace_revokes_every_link(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path)
        ws, key = await workspace_with(uc, incoming("a"), incoming("b"))
        tokens = [(await uc.create_share(ws, key, item))[1]["token"] for item in ("a", "b")]
        other_ws, other_key = await workspace_with(uc, incoming("a"))
        _, kept = await uc.create_share(other_ws, other_key, "a")
        await uc.delete_workspace(ws, key)
        return uc, tokens, kept["token"]

    uc, tokens, kept = arun(scenario())
    for token in tokens:
        assert fails(uc.read_shared(token), NotFoundError).payload["code"] == "codestore_share_not_found"
    assert arun(uc.read_shared(kept))["item"]["id"] == "a"


# ---------------------------------------------------------------------------
# the public read
# ---------------------------------------------------------------------------
def test_an_unknown_a_malformed_and_a_revoked_token_are_answered_identically(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path)
        ws, key = await workspace_with(uc, incoming())
        _, made = await uc.create_share(ws, key, "i1")
        await uc.revoke_share(ws, key, "i1")
        return uc, made["token"]

    uc, revoked = arun(scenario())
    errors = [fails(uc.read_shared(token), NotFoundError) for token in (revoked, "x" * 22, "short", "", "../../etc", "%00")]
    assert {error.message for error in errors} == {SHARE_NOT_FOUND}
    assert {error.payload["code"] for error in errors} == {"codestore_share_not_found"}
    assert {error.status_code for error in errors} == {404}


def test_the_public_read_needs_no_key_and_no_workspace_id(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path)
        ws, key = await workspace_with(uc, incoming())
        _, made = await uc.create_share(ws, key, "i1")
        return await uc.read_shared(made["token"], ip=IP)

    assert arun(scenario())["item"]["name"] == "Bài 1"


def test_reads_are_limited_per_address_and_the_wait_is_named(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path, share_read_limiter=MemoryRateLimiter(2, 60))
        ws, key = await workspace_with(uc, incoming())
        _, made = await uc.create_share(ws, key, "i1")
        await uc.read_shared(made["token"], ip=IP)
        await uc.read_shared(made["token"], ip=IP)
        return uc, made["token"]

    uc, token = arun(scenario())
    error = fails(uc.read_shared(token, ip=IP))
    assert error.status_code == 429 and error.payload["code"] == "codestore_rate_limited"
    assert error.payload["retryAfter"] >= 1 and error.headers["Retry-After"] == str(error.payload["retryAfter"])
    assert arun(uc.read_shared(token, ip="198.51.100.9"))["item"]["id"] == "i1"        # another address is untouched


def test_wrong_tokens_are_counted_and_then_even_a_right_one_waits(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path, share_failure_limiter=MemoryRateLimiter(3, 600))
        ws, key = await workspace_with(uc, incoming())
        _, made = await uc.create_share(ws, key, "i1")
        for guess in ("a" * 22, "b" * 22, "c" * 22):
            with pytest.raises(NotFoundError):
                await uc.read_shared(guess, ip=IP)
        return uc, ws, key, made["token"]

    uc, ws, key, token = arun(scenario())
    error = fails(uc.read_shared(token, ip=IP))
    assert error.status_code == 429 and error.payload["code"] == "codestore_rate_limited"
    assert arun(uc.read_shared(token, ip="198.51.100.9"))["item"]["id"] == "i1"
    # wrong TOKENS do not lock the owner out of the workspace: a separate counter from wrong KEYS
    assert arun(uc.list_items(ws, key, 0, ip=IP))["items"][0]["id"] == "i1"


def test_a_right_token_is_never_counted_as_a_failure(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path, share_failure_limiter=MemoryRateLimiter(2, 600))
        ws, key = await workspace_with(uc, incoming())
        _, made = await uc.create_share(ws, key, "i1")
        for _ in range(10):
            await uc.read_shared(made["token"], ip=IP)
        return True

    assert arun(scenario())


def test_wrong_keys_and_wrong_tokens_have_separate_counters(tmp_path):
    async def scenario():
        uc, _, _ = build(tmp_path, failure_limiter=MemoryRateLimiter(2, 600), share_failure_limiter=MemoryRateLimiter(2, 600))
        ws, key = await workspace_with(uc, incoming())
        _, made = await uc.create_share(ws, key, "i1")
        for _ in range(2):
            with pytest.raises(UnauthorizedError):
                await uc.list_items(ws, "wrong", 0, ip=IP)
        return uc, ws, key, made["token"]

    uc, ws, key, token = arun(scenario())
    # keys are locked out for this address ...
    assert fails(uc.list_items(ws, key, 0, ip=IP)).payload["code"] == "codestore_rate_limited"
    # ... but reading a link is not (and an unknown token is still just a 404)
    assert arun(uc.read_shared(token, ip=IP))["item"]["id"] == "i1"
    assert fails(uc.read_shared("z" * 22, ip=IP), NotFoundError).payload["code"] == "codestore_share_not_found"


def test_the_token_never_reaches_a_log(tmp_path, caplog):
    async def scenario():
        uc, _, _ = build(tmp_path)
        ws, key = await workspace_with(uc, incoming())
        _, made = await uc.create_share(ws, key, "i1")
        await uc.read_shared(made["token"], ip=IP)
        await uc.list_shares(ws, key)
        await uc.revoke_share(ws, key, "i1")
        with pytest.raises(NotFoundError):
            await uc.read_shared(made["token"], ip=IP)
        return made["token"]

    with caplog.at_level(logging.DEBUG):
        token = arun(scenario())
    assert token not in caplog.text


# ---------------------------------------------------------------------------
# the same flow on every store
# ---------------------------------------------------------------------------
def json_repo(tmp_path):
    return JsonCodestoreRepository(file_path=tmp_path / "codestore.json")


def sql_repo(_tmp_path):
    return MySqlCodestoreRepository()


def mongo_repo(_tmp_path):
    return MongoCodestoreRepository()


@pytest.mark.parametrize("factory", [pytest.param(json_repo, id="json"), pytest.param(sql_repo, id="sql"),
                                     pytest.param(mongo_repo, id="mongo")])
def test_the_whole_life_of_a_link_on_every_store(factory, tmp_path, monkeypatch):
    fake_mongo.install(monkeypatch, mongo_repository)
    big = "x" * 400_000 + " — nội dung lớn 🍜"

    async def scenario():
        uc = CodestoreUseCase(factory(tmp_path), clock=Clock(), max_shares=3)
        ws, key = await workspace_with(uc, incoming("a", content="one", meta={"$set": {"a.b": 1}, "pinned": True}),
                                       incoming("big", content=big), incoming("c"), incoming("d"))
        created_a, a = await uc.create_share(ws, key, "a")
        _, large = await uc.create_share(ws, key, "big")
        await uc.create_share(ws, key, "c")
        too_many = None
        try:
            await uc.create_share(ws, key, "d")
        except BadRequestError as error:
            too_many = error.payload["code"]
        shown = await uc.read_shared(a["token"])
        await uc.put_items(ws, key, put(incoming("a", updated=NOW - 10, content="two")))
        still_old = (await uc.read_shared(a["token"]))["item"]["files"][0]["content"]
        again_created, again = await uc.create_share(ws, key, "a")
        refreshed = (await uc.read_shared(a["token"]))["item"]["files"][0]["content"]
        listed = [share["itemId"] for share in (await uc.list_shares(ws, key))["shares"]]
        big_back = (await uc.read_shared(large["token"]))["item"]["files"][0]["content"]
        await uc.put_items(ws, key, put(incoming("a", updated=NOW - 5, deleted=True)))
        after_delete = None
        try:
            await uc.read_shared(a["token"])
        except NotFoundError as error:
            after_delete = error.payload["code"]
        await uc.revoke_share(ws, key, "c")
        await uc.delete_workspace(ws, key)
        after_workspace = None
        try:
            await uc.read_shared(large["token"])
        except NotFoundError as error:
            after_workspace = error.payload["code"]
        return (created_a, too_many, shown, still_old, again_created, again["token"] == a["token"], refreshed, listed,
                big_back == big, after_delete, after_workspace)

    (created_a, too_many, shown, still_old, again_created, same_token, refreshed, listed, big_ok, after_delete,
     after_workspace) = arun(scenario())
    assert created_a is True and too_many == "codestore_too_many_shares"
    assert shown["item"]["meta"] == {"$set": {"a.b": 1}} and shown["item"]["files"][0]["content"] == "one"
    assert still_old == "one" and again_created is False and same_token and refreshed == "two"
    assert sorted(listed) == ["a", "big", "c"] and big_ok
    assert after_delete == "codestore_share_not_found" and after_workspace == "codestore_share_not_found"
