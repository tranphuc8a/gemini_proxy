"""All three spending storage backends must behave identically.

The JSON one is exercised directly; the SQL one runs against the SQLite engine
the test suite already falls back to, which is why every statement in
`MySqlSpendingRepository` sticks to portable SQL; the Mongo one runs against
`tests.support.fake_mongo`, so its own (de)serialisation and compare-and-set code
executes rather than a mock of it.

Parametrising one suite over all three is the point: a client that switches
backend must not have to care which one it got. The part worth most is the
compare-and-set -- `replace_if_revision` is what stops two devices from
overwriting each other, and each backend implements it differently (a lock, a
conditional UPDATE, a filtered `update_one`).
"""

import os

os.environ.setdefault("TESTING", "1")

import asyncio
import json
import re

import pytest

from src.adapter.output.spending import mongo_repository
from src.adapter.output.spending.json_repository import JsonSpendingRepository
from src.adapter.output.spending.mongo_repository import MongoSpendingRepository
from src.adapter.output.spending.mysql_repository import MySqlSpendingRepository
from src.domain.vo.spending_vo import SpendingRecord
from tests.conftest import arun
from tests.support import fake_mongo


@pytest.fixture
def ws_id(request):
    """A workspace id unique to this test.

    The suite's SQLite fallback is one database shared by every test, and this
    table is raw SQL so conftest's drop_all never touches it. Unique ids keep the
    SQL cases independent without a teardown hook.
    """
    return "sp_" + re.sub(r"[^A-Za-z0-9]", "_", request.node.name)


def make_record(workspace_id, **overrides):
    base = dict(
        id=workspace_id,
        name="Sổ chi tiêu",
        key_hash="hash",
        revision=1,
        created_at="2026-10-05T00:00:00+00:00",
        updated_at="2026-10-05T00:00:00+00:00",
        data={"schema": 1, "transactions": [{"id": "t1", "amount": 57000, "note": "cơm trưa"}]},
    )
    base.update(overrides)
    return SpendingRecord(**base)


def next_revision(record, **overrides):
    """What the usecase would hand to `replace_if_revision`."""
    fields = dict(
        revision=record.revision + 1,
        updated_at="2026-10-05T01:00:00+00:00",
        data={"schema": 1, "transactions": []},
    )
    fields.update(overrides)
    return record.model_copy(update=fields, deep=True)


def json_repo(tmp_path):
    return JsonSpendingRepository(file_path=tmp_path / "spending.json")


def sql_repo(_tmp_path):
    return MySqlSpendingRepository()


def mongo_repo(_tmp_path):
    return MongoSpendingRepository()


REPOS = [
    pytest.param(json_repo, id="json"),
    pytest.param(sql_repo, id="sql"),
    pytest.param(mongo_repo, id="mongo"),
]


@pytest.fixture(autouse=True)
def fake_db(monkeypatch):
    """A fresh in-memory MongoDB per test, for the mongo parametrisation."""
    return fake_mongo.install(monkeypatch, mongo_repository)


def big_ledger():
    """Over 1 MB, with everything a hand-typed Vietnamese ledger can contain."""
    transactions = [
        {
            "id": f"t_{i}",
            "type": "expense",
            "date": "2026-10-05",
            "amount": 57000 + i,
            "note": f"cơm trưa quán Bà Tư #{i} — đã trả ✓ 🍜",
            "tags": ["ăn uống", "ế", "ữ"],
            "split": {"paidBy": "p_me", "shares": {"p_me": 28500, "p_x1": 28501 + i}},
            "ratio": 0.1 + i / 7,
            "archived": False,
            "categoryId": None,
        }
        for i in range(4000)
    ]
    return {
        "schema": 1,
        "transactions": transactions,
        # Keys MongoDB would refuse or reinterpret if they were real field names.
        "$set": {"$where": "1", "a.b": {"c.d": 1, "$gt": [1, 2]}},
        "tombstones": {"transactions": {"t_9": "2026-10-04T10:00:00.000Z"}},
        "": "empty key",
    }


# ---------------------------------------------------------------------------
# create / get
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("factory", REPOS)
def test_create_and_read_back_the_whole_record(factory, tmp_path, ws_id):
    async def scenario():
        repo = factory(tmp_path)
        await repo.create(make_record(ws_id))
        return await repo.get(ws_id)

    loaded = arun(scenario())
    assert loaded == make_record(ws_id)


@pytest.mark.parametrize("factory", REPOS)
def test_missing_workspace_reads_as_none(factory, tmp_path):
    async def scenario():
        return await factory(tmp_path).get("sp_absent")

    assert arun(scenario()) is None


@pytest.mark.parametrize("factory", REPOS)
def test_a_record_read_back_is_an_independent_copy(factory, tmp_path, ws_id):
    async def scenario():
        repo = factory(tmp_path)
        original = make_record(ws_id)
        await repo.create(original)
        original.data["transactions"].append({"id": "after-create"})  # the caller keeps editing its object
        borrowed = await repo.get(ws_id)
        borrowed.data["transactions"].append({"id": "not-saved"})
        borrowed.name = "changed in memory"
        return await repo.get(ws_id)

    reloaded = arun(scenario())
    assert reloaded.data["transactions"] == [{"id": "t1", "amount": 57000, "note": "cơm trưa"}]
    assert reloaded.name == "Sổ chi tiêu"


# ---------------------------------------------------------------------------
# replace_if_revision
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("factory", REPOS)
def test_replace_if_revision_writes_when_the_revision_matches(factory, tmp_path, ws_id):
    async def scenario():
        repo = factory(tmp_path)
        first = make_record(ws_id)
        await repo.create(first)
        updated = next_revision(first, name="Đã đổi tên", data={"schema": 1, "transactions": [{"id": "t2"}]})
        accepted = await repo.replace_if_revision(updated, expected_revision=1)
        return accepted, await repo.get(ws_id)

    accepted, stored = arun(scenario())
    assert accepted is True
    assert stored.revision == 2
    assert stored.name == "Đã đổi tên"
    assert stored.updated_at == "2026-10-05T01:00:00+00:00"
    assert stored.data == {"schema": 1, "transactions": [{"id": "t2"}]}


@pytest.mark.parametrize("factory", REPOS)
def test_replace_if_revision_never_touches_the_key_hash_or_creation_time(factory, tmp_path, ws_id):
    async def scenario():
        repo = factory(tmp_path)
        first = make_record(ws_id)
        await repo.create(first)
        tampered = next_revision(first, key_hash="someone-elses-hash", created_at="1999-01-01T00:00:00+00:00")
        assert await repo.replace_if_revision(tampered, expected_revision=1) is True
        return await repo.get(ws_id)

    stored = arun(scenario())
    assert stored.key_hash == "hash"
    assert stored.created_at == "2026-10-05T00:00:00+00:00"
    assert stored.revision == 2


@pytest.mark.parametrize("factory", REPOS)
def test_a_stale_expected_revision_is_refused_and_leaves_the_document_untouched(factory, tmp_path, ws_id):
    async def scenario():
        repo = factory(tmp_path)
        first = make_record(ws_id)
        await repo.create(first)
        before = await repo.get(ws_id)

        # The stored revision is 1; the writer believes it is 5.
        stale = next_revision(first, revision=6, name="must not land", data={"overwritten": True})
        accepted = await repo.replace_if_revision(stale, expected_revision=5)
        return accepted, before, await repo.get(ws_id)

    accepted, before, after = arun(scenario())
    assert accepted is False
    assert after == before


@pytest.mark.parametrize("factory", REPOS)
def test_the_second_writer_from_the_same_revision_is_refused(factory, tmp_path, ws_id):
    async def scenario():
        repo = factory(tmp_path)
        first = make_record(ws_id)
        await repo.create(first)
        phone = next_revision(first, data={"by": "phone"})
        laptop = next_revision(first, data={"by": "laptop"})
        answers = [
            await repo.replace_if_revision(phone, expected_revision=1),
            await repo.replace_if_revision(laptop, expected_revision=1),
        ]
        stored_after_conflict = await repo.get(ws_id)
        # Having re-read, the laptop may now write on top of revision 2.
        retry = next_revision(stored_after_conflict, data={"by": "laptop", "merged": True})
        answers.append(await repo.replace_if_revision(retry, expected_revision=2))
        return answers, stored_after_conflict, await repo.get(ws_id)

    answers, mid, final = arun(scenario())
    assert answers == [True, False, True]
    assert mid.data == {"by": "phone"}
    assert (final.revision, final.data) == (3, {"by": "laptop", "merged": True})


@pytest.mark.parametrize("factory", REPOS)
def test_replacing_a_workspace_that_does_not_exist_is_refused_and_creates_nothing(factory, tmp_path, ws_id):
    async def scenario():
        repo = factory(tmp_path)
        accepted = await repo.replace_if_revision(make_record(ws_id, revision=2), expected_revision=1)
        return accepted, await repo.get(ws_id)

    accepted, stored = arun(scenario())
    assert accepted is False
    assert stored is None


@pytest.mark.parametrize("factory", REPOS)
def test_two_concurrent_writers_from_the_same_revision_cannot_both_win(factory, tmp_path, ws_id):
    async def scenario():
        repo = factory(tmp_path)
        first = make_record(ws_id)
        await repo.create(first)
        phone = next_revision(first, data={"by": "phone"})
        laptop = next_revision(first, data={"by": "laptop"})
        answers = await asyncio.gather(
            repo.replace_if_revision(phone, expected_revision=1),
            repo.replace_if_revision(laptop, expected_revision=1),
        )
        return answers, await repo.get(ws_id)

    answers, stored = arun(scenario())
    assert sorted(answers) == [False, True]
    assert stored.revision == 2
    winner = "phone" if answers[0] else "laptop"
    assert stored.data == {"by": winner}


@pytest.mark.parametrize("factory", REPOS)
def test_many_concurrent_writers_leave_exactly_one_winner(factory, tmp_path, ws_id):
    async def scenario():
        repo = factory(tmp_path)
        first = make_record(ws_id)
        await repo.create(first)
        attempts = [next_revision(first, data={"by": f"device-{i}"}) for i in range(6)]
        answers = await asyncio.gather(*(repo.replace_if_revision(a, expected_revision=1) for a in attempts))
        return answers, await repo.get(ws_id)

    answers, stored = arun(scenario())
    assert answers.count(True) == 1
    assert stored.revision == 2
    assert stored.data == {"by": f"device-{answers.index(True)}"}


# ---------------------------------------------------------------------------
# delete
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("factory", REPOS)
def test_delete_removes_only_that_workspace(factory, tmp_path, ws_id):
    async def scenario():
        repo = factory(tmp_path)
        await repo.create(make_record(ws_id))
        await repo.create(make_record(ws_id + "_other"))
        deleted = await repo.delete(ws_id)
        again = await repo.delete(ws_id)
        return deleted, again, await repo.get(ws_id), await repo.get(ws_id + "_other")

    deleted, again, gone, kept = arun(scenario())
    assert deleted is True
    assert again is False
    assert gone is None
    assert kept is not None


# ---------------------------------------------------------------------------
# opaque payloads
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("factory", REPOS)
def test_a_large_unicode_payload_round_trips_exactly(factory, tmp_path, ws_id):
    ledger = big_ledger()
    canonical = json.dumps(ledger, ensure_ascii=False)
    assert len(canonical.encode("utf-8")) > 1_000_000  # the case is only worth running if it is big

    async def scenario():
        repo = factory(tmp_path)
        await repo.create(make_record(ws_id, data=ledger))
        after_create = await repo.get(ws_id)

        # And again through the update path, which serialises separately.
        changed = dict(ledger, extra={"ghi chú": "Đ", "$": 1})
        accepted = await repo.replace_if_revision(
            next_revision(after_create, data=changed), expected_revision=1
        )
        return after_create, accepted, await repo.get(ws_id), changed

    after_create, accepted, after_replace, changed = arun(scenario())
    assert after_create.data == ledger
    assert json.dumps(after_create.data, ensure_ascii=False) == canonical  # same content *and* key order
    assert accepted is True
    assert after_replace.data == changed
    assert json.dumps(after_replace.data, ensure_ascii=False) == json.dumps(changed, ensure_ascii=False)


@pytest.mark.parametrize("factory", REPOS)
def test_keys_that_look_like_mongo_operators_are_plain_data(factory, tmp_path, ws_id):
    weird = {"$set": 1, "$where": {"$gt": 0}, "a.b.c": [{"$in": ["x"]}], "$": {"": ""}}

    async def scenario():
        repo = factory(tmp_path)
        await repo.create(make_record(ws_id, data=weird))
        replaced = await repo.replace_if_revision(
            next_revision(make_record(ws_id), data={"$unset": {"a.b": 1}}), expected_revision=1
        )
        return replaced, await repo.get(ws_id)

    replaced, stored = arun(scenario())
    assert replaced is True
    assert stored.data == {"$unset": {"a.b": 1}}


# ---------------------------------------------------------------------------
# mongo: the document is stored as a string (decision D6)
# ---------------------------------------------------------------------------
def test_mongo_keeps_the_client_document_as_a_json_string(tmp_path, ws_id, fake_db):
    async def scenario():
        repo = mongo_repo(tmp_path)
        await repo.create(make_record(ws_id, data={"$set": {"a.b": 1}, "tên": "Phúc"}))
        await repo.replace_if_revision(
            next_revision(make_record(ws_id), data={"$where": "x", "tên": "Đạt"}), expected_revision=1
        )

    arun(scenario())
    stored = fake_db["spending_workspaces"].documents[ws_id]
    assert set(stored) == {"_id", "name", "key_hash", "revision", "created_at", "updated_at", "payload_json"}
    assert isinstance(stored["payload_json"], str)
    assert json.loads(stored["payload_json"]) == {"$where": "x", "tên": "Đạt"}
    assert "Đạt" in stored["payload_json"]  # stored as UTF-8, not \u-escaped


# ---------------------------------------------------------------------------
# json file specifics
# ---------------------------------------------------------------------------
def test_json_store_survives_a_corrupt_file(tmp_path, ws_id):
    path = tmp_path / "spending.json"
    path.write_text("{ this is not json", encoding="utf-8")

    async def scenario():
        repo = JsonSpendingRepository(file_path=path)
        # Starting empty beats refusing to boot; the bad file is kept alongside.
        await repo.create(make_record(ws_id))
        return await repo.get(ws_id)

    assert arun(scenario()) is not None
    assert (tmp_path / "spending.json.corrupt").exists()


def test_json_store_skips_a_malformed_record_but_keeps_the_rest(tmp_path, ws_id):
    path = tmp_path / "spending.json"
    good = make_record(ws_id).model_dump()
    path.write_text(json.dumps({"version": 1, "workspaces": [{"id": "broken"}, good]}), encoding="utf-8")

    async def scenario():
        repo = JsonSpendingRepository(file_path=path)
        return await repo.get("broken"), await repo.get(ws_id)

    broken, kept = arun(scenario())
    assert broken is None
    assert kept is not None


def test_json_store_reloads_from_disk_in_a_new_process(tmp_path, ws_id):
    async def write():
        repo = json_repo(tmp_path)
        first = make_record(ws_id)
        await repo.create(first)
        await repo.replace_if_revision(next_revision(first, data={"ghi chú": "đã lưu"}), expected_revision=1)

    async def read():
        return await json_repo(tmp_path).get(ws_id)

    arun(write())
    reloaded = arun(read())
    assert reloaded.revision == 2
    assert reloaded.data == {"ghi chú": "đã lưu"}
    assert "đã lưu" in (tmp_path / "spending.json").read_text(encoding="utf-8")  # readable, not \u-escaped
    assert not (tmp_path / "spending.json.tmp").exists()


def test_json_store_does_not_claim_a_write_the_disk_refused(tmp_path, ws_id, monkeypatch):
    async def scenario():
        repo = json_repo(tmp_path)
        first = make_record(ws_id)
        await repo.create(first)

        def refuse():
            raise OSError("disk full")

        monkeypatch.setattr(repo, "_flush_unlocked", refuse)
        with pytest.raises(OSError):
            await repo.replace_if_revision(next_revision(first, data={"lost": True}), expected_revision=1)
        with pytest.raises(OSError):
            await repo.delete(ws_id)
        with pytest.raises(OSError):
            await repo.create(make_record(ws_id + "_new"))
        return await repo.get(ws_id), await repo.get(ws_id + "_new")

    kept, never_created = arun(scenario())
    assert (kept.revision, kept.data["transactions"][0]["id"]) == (1, "t1")
    assert never_created is None
