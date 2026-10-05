"""The rules of the spending workspace store: access, size, revisions, races.

Everything runs against the real `JsonSpendingRepository` on a temp file rather
than a fake: the compare-and-set that closes the race lives in the repository, so
a fake would test the test. The other two backends are held to the same contract
by `tests/adapter/output/spending/test_spending_repositories.py`.
"""

import os

os.environ.setdefault("TESTING", "1")

import asyncio
import json

import pytest
from pydantic import ValidationError

from src.adapter.output.spending.json_repository import JsonSpendingRepository
from src.application.exceptions.exceptions import (
    BadRequestError,
    ConflictError,
    NotFoundError,
    UnauthorizedError,
)
from src.application.usecases.spending_usecase import SpendingUseCase, hash_key
from src.domain.vo.spending_vo import DEFAULT_NAME, SpendingCreateRequest, SpendingSaveRequest
from tests.conftest import arun


def build(tmp_path, max_bytes=10_000, repo_class=JsonSpendingRepository):
    repo = repo_class(file_path=tmp_path / "spending.json")
    return SpendingUseCase(repo, max_bytes=max_bytes), repo


def save_request(revision, data, name=None):
    return SpendingSaveRequest(revision=revision, name=name, data=data)


# ---------------------------------------------------------------------------
# creation
# ---------------------------------------------------------------------------
def test_create_returns_the_key_once_and_stores_only_its_hash(tmp_path):
    async def scenario():
        uc, _ = build(tmp_path)
        created = await uc.create_workspace(SpendingCreateRequest(name="Nhà"))
        return created

    created = arun(scenario())
    assert created.id.startswith("sp_")
    assert created.revision == 1
    assert len(created.access_key) >= 32

    stored = (tmp_path / "spending.json").read_text(encoding="utf-8")
    assert created.access_key not in stored
    assert hash_key(created.access_key) in stored


def test_two_workspaces_never_share_an_id_or_a_key(tmp_path):
    async def scenario():
        uc, _ = build(tmp_path)
        return await uc.create_workspace(SpendingCreateRequest()), await uc.create_workspace(SpendingCreateRequest())

    first, second = arun(scenario())
    assert first.id != second.id
    assert first.access_key != second.access_key


def test_create_without_data_starts_with_an_empty_document(tmp_path):
    async def scenario():
        uc, _ = build(tmp_path)
        created = await uc.create_workspace(SpendingCreateRequest())
        return created, await uc.get_workspace(created.id, created.access_key)

    created, view = arun(scenario())
    assert created.name == DEFAULT_NAME
    assert view.data == {}
    assert view.revision == 1


def test_create_with_data_stores_it_as_revision_one(tmp_path):
    ledger = {"schema": 1, "transactions": [{"id": "t1", "amount": 57000, "note": "cơm trưa"}]}

    async def scenario():
        uc, _ = build(tmp_path)
        created = await uc.create_workspace(SpendingCreateRequest(name="Máy này", data=ledger))
        return created, await uc.get_workspace(created.id, created.access_key)

    created, view = arun(scenario())
    assert created.revision == 1
    assert view.revision == 1
    assert view.data == ledger


def test_the_name_is_trimmed_and_a_blank_one_falls_back_to_the_default(tmp_path):
    async def scenario():
        uc, _ = build(tmp_path)
        trimmed = await uc.create_workspace(SpendingCreateRequest(name="  Nhà riêng  "))
        blank = await uc.create_workspace(SpendingCreateRequest(name="   "))
        return trimmed.name, blank.name

    trimmed, blank = arun(scenario())
    assert trimmed == "Nhà riêng"
    assert blank == DEFAULT_NAME


def test_an_empty_or_overlong_name_is_rejected_by_the_request_model():
    with pytest.raises(ValidationError):
        SpendingCreateRequest(name="")
    with pytest.raises(ValidationError):
        SpendingCreateRequest(name="x" * 121)
    with pytest.raises(ValidationError):
        SpendingSaveRequest(revision=1, name="", data={})


# ---------------------------------------------------------------------------
# access: 404 before 401
# ---------------------------------------------------------------------------
def test_reading_needs_the_right_key(tmp_path):
    async def scenario():
        uc, _ = build(tmp_path)
        created = await uc.create_workspace(SpendingCreateRequest(data={"a": 1}))
        ok = await uc.get_workspace(created.id, created.access_key)
        outcomes = {}
        for label, key in (("wrong", "not-the-key"), ("missing", "")):
            try:
                await uc.get_workspace(created.id, key)
            except UnauthorizedError as exc:
                outcomes[label] = exc.status_code
        return ok, outcomes

    ok, outcomes = arun(scenario())
    assert ok.data == {"a": 1}
    assert outcomes == {"wrong": 401, "missing": 401}


def test_an_unknown_workspace_is_404_whatever_key_is_sent(tmp_path):
    # Answering 401 here would let a caller probe which ids exist.
    async def scenario():
        uc, _ = build(tmp_path)
        statuses = []
        for key in ("", "some-key"):
            with pytest.raises(NotFoundError) as raised:
                await uc.get_workspace("sp_nope", key)
            statuses.append(raised.value.status_code)
        with pytest.raises(NotFoundError):
            await uc.save_workspace("sp_nope", "k", save_request(1, {}))
        with pytest.raises(NotFoundError):
            await uc.delete_workspace("sp_nope", "k")
        return statuses

    assert arun(scenario()) == [404, 404]


def test_a_save_with_the_wrong_key_changes_nothing(tmp_path):
    async def scenario():
        uc, _ = build(tmp_path)
        created = await uc.create_workspace(SpendingCreateRequest(data={"v": "original"}))
        with pytest.raises(UnauthorizedError):
            await uc.save_workspace(created.id, "wrong", save_request(1, {"v": "hijacked"}))
        with pytest.raises(UnauthorizedError):
            await uc.delete_workspace(created.id, "wrong")
        return await uc.get_workspace(created.id, created.access_key)

    view = arun(scenario())
    assert view.data == {"v": "original"}
    assert view.revision == 1


# ---------------------------------------------------------------------------
# polling with ?since
# ---------------------------------------------------------------------------
def test_since_equal_to_the_revision_answers_unchanged_without_the_document(tmp_path):
    async def scenario():
        uc, _ = build(tmp_path)
        created = await uc.create_workspace(SpendingCreateRequest(data={"big": "document"}))
        return created, await uc.get_workspace(created.id, created.access_key, since=1)

    created, view = arun(scenario())
    assert view.unchanged is True
    assert view.data is None
    assert view.revision == 1
    assert view.id == created.id


def test_since_older_or_newer_or_absent_returns_the_full_document(tmp_path):
    async def scenario():
        uc, _ = build(tmp_path)
        created = await uc.create_workspace(SpendingCreateRequest(data={"n": 1}))
        await uc.save_workspace(created.id, created.access_key, save_request(1, {"n": 2}))
        views = []
        for since in (None, 1, 99, 0):
            views.append(await uc.get_workspace(created.id, created.access_key, since=since))
        return views

    for view in arun(scenario()):
        assert view.revision == 2
        assert view.unchanged is False
        assert view.data == {"n": 2}


def test_since_still_needs_the_key(tmp_path):
    async def scenario():
        uc, _ = build(tmp_path)
        created = await uc.create_workspace(SpendingCreateRequest())
        with pytest.raises(UnauthorizedError):
            await uc.get_workspace(created.id, "wrong", since=1)

    arun(scenario())


# ---------------------------------------------------------------------------
# saving and revisions
# ---------------------------------------------------------------------------
def test_save_stores_the_document_and_bumps_the_revision(tmp_path):
    async def scenario():
        uc, _ = build(tmp_path)
        created = await uc.create_workspace(SpendingCreateRequest(name="Cũ"))
        saved = await uc.save_workspace(
            created.id, created.access_key, save_request(1, {"transactions": [{"id": "t1"}]}, name="  Mới ")
        )
        return created, saved, await uc.get_workspace(created.id, created.access_key)

    created, saved, reread = arun(scenario())
    assert saved.revision == 2
    assert saved.name == "Mới"
    assert saved.created_at == created.created_at
    assert reread.revision == 2
    assert reread.data == {"transactions": [{"id": "t1"}]}
    assert reread.name == "Mới"


def test_save_without_a_name_keeps_the_current_one(tmp_path):
    async def scenario():
        uc, _ = build(tmp_path)
        created = await uc.create_workspace(SpendingCreateRequest(name="Giữ nguyên"))
        return await uc.save_workspace(created.id, created.access_key, save_request(1, {"x": 1}))

    assert arun(scenario()).name == "Giữ nguyên"


def test_a_blank_name_on_save_is_refused_and_nothing_is_written(tmp_path):
    async def scenario():
        uc, _ = build(tmp_path)
        created = await uc.create_workspace(SpendingCreateRequest(name="Tên", data={"v": 1}))
        with pytest.raises(BadRequestError):
            await uc.save_workspace(created.id, created.access_key, save_request(1, {"v": 2}, name="   "))
        return await uc.get_workspace(created.id, created.access_key)

    view = arun(scenario())
    assert (view.name, view.revision, view.data) == ("Tên", 1, {"v": 1})


def test_a_stale_save_is_refused_and_carries_the_current_document(tmp_path):
    async def scenario():
        uc, _ = build(tmp_path)
        created = await uc.create_workspace(SpendingCreateRequest())
        await uc.save_workspace(created.id, created.access_key, save_request(1, {"from": "phone"}))
        # The laptop still believes it is on revision 1.
        with pytest.raises(ConflictError) as raised:
            await uc.save_workspace(created.id, created.access_key, save_request(1, {"from": "laptop"}))
        return raised.value, await uc.get_workspace(created.id, created.access_key)

    conflict, stored = arun(scenario())
    assert conflict.status_code == 409
    current = conflict.payload["current"]
    assert current["revision"] == 2
    assert current["data"] == {"from": "phone"}
    assert stored.data == {"from": "phone"}  # the first save survived


def test_a_revision_from_the_future_is_also_a_conflict(tmp_path):
    async def scenario():
        uc, _ = build(tmp_path)
        created = await uc.create_workspace(SpendingCreateRequest(data={"v": 1}))
        with pytest.raises(ConflictError):
            await uc.save_workspace(created.id, created.access_key, save_request(7, {"v": 2}))

    arun(scenario())


def test_the_document_returned_by_a_save_is_what_is_stored(tmp_path):
    data = {"giao dịch": [{"ghi chú": "bún chả 60k", "tiền": 60000}], "$meta": {"a.b": True}}

    async def scenario():
        uc, _ = build(tmp_path)
        created = await uc.create_workspace(SpendingCreateRequest())
        saved = await uc.save_workspace(created.id, created.access_key, save_request(1, data))
        return saved, await uc.get_workspace(created.id, created.access_key)

    saved, stored = arun(scenario())
    assert saved.data == data == stored.data


# ---------------------------------------------------------------------------
# size and type
# ---------------------------------------------------------------------------
def document_of_json_length(length):
    """A dict whose compact JSON (`ensure_ascii=False`) is exactly `length` bytes."""
    filler = length - len('{"k": ""}')
    return {"k": "x" * filler}


def test_the_size_limit_counts_utf8_bytes_of_the_json_and_is_inclusive(tmp_path):
    async def scenario():
        uc, _ = build(tmp_path, max_bytes=100)
        at_limit = document_of_json_length(100)
        assert len(json.dumps(at_limit).encode("utf-8")) == 100
        created = await uc.create_workspace(SpendingCreateRequest(data=at_limit))

        with pytest.raises(BadRequestError):
            await uc.create_workspace(SpendingCreateRequest(data=document_of_json_length(101)))

        # 40 characters but 120 bytes: the limit is on bytes, not characters.
        wide = {"k": "ế" * 40}
        assert len(json.dumps(wide, ensure_ascii=False)) < 100 < len(json.dumps(wide, ensure_ascii=False).encode("utf-8"))
        with pytest.raises(BadRequestError):
            await uc.save_workspace(created.id, created.access_key, save_request(1, wide))

    arun(scenario())


def test_oversize_data_is_refused_on_create_and_save_and_save_changes_nothing(tmp_path):
    big = {"blob": "x" * 500}

    async def scenario():
        uc, _ = build(tmp_path, max_bytes=200)
        with pytest.raises(BadRequestError) as on_create:
            await uc.create_workspace(SpendingCreateRequest(data=big))

        created = await uc.create_workspace(SpendingCreateRequest(data={"small": 1}))
        with pytest.raises(BadRequestError) as on_save:
            await uc.save_workspace(created.id, created.access_key, save_request(1, big))
        reread = await uc.get_workspace(created.id, created.access_key)
        return on_create.value, on_save.value, reread

    on_create, on_save, reread = arun(scenario())
    assert on_create.status_code == on_save.status_code == 400
    assert (reread.revision, reread.data) == (1, {"small": 1})


def test_data_that_is_not_an_object_is_refused(tmp_path):
    # The request models already reject these over HTTP; the usecase must not
    # rely on that, so build the requests without validation.
    async def scenario():
        uc, _ = build(tmp_path)
        for bad in ([1, 2], "text", 5):
            with pytest.raises(BadRequestError):
                await uc.create_workspace(SpendingCreateRequest.model_construct(name="x", data=bad))
        created = await uc.create_workspace(SpendingCreateRequest())
        for bad in ([1, 2], "text", None):
            with pytest.raises(BadRequestError):
                await uc.save_workspace(
                    created.id, created.access_key, SpendingSaveRequest.model_construct(revision=1, name=None, data=bad)
                )
        return await uc.get_workspace(created.id, created.access_key)

    assert arun(scenario()).revision == 1


def test_the_request_models_reject_a_non_object_document():
    with pytest.raises(ValidationError):
        SpendingSaveRequest(revision=1, data=[1, 2])
    with pytest.raises(ValidationError):
        SpendingCreateRequest(data=[1, 2])
    with pytest.raises(ValidationError):
        SpendingSaveRequest(revision=-1, data={})


# ---------------------------------------------------------------------------
# delete
# ---------------------------------------------------------------------------
def test_delete_removes_the_workspace(tmp_path):
    async def scenario():
        uc, _ = build(tmp_path)
        created = await uc.create_workspace(SpendingCreateRequest())
        deleted = await uc.delete_workspace(created.id, created.access_key)
        with pytest.raises(NotFoundError):
            await uc.get_workspace(created.id, created.access_key)
        with pytest.raises(NotFoundError):
            await uc.delete_workspace(created.id, created.access_key)
        return deleted

    assert arun(scenario()) is True


# ---------------------------------------------------------------------------
# races
# ---------------------------------------------------------------------------
def test_two_saves_from_the_same_revision_cannot_both_win(tmp_path):
    async def scenario():
        uc, _ = build(tmp_path)
        created = await uc.create_workspace(SpendingCreateRequest())
        outcomes = await asyncio.gather(
            uc.save_workspace(created.id, created.access_key, save_request(1, {"by": "phone"})),
            uc.save_workspace(created.id, created.access_key, save_request(1, {"by": "laptop"})),
            return_exceptions=True,
        )
        return outcomes, await uc.get_workspace(created.id, created.access_key)

    outcomes, stored = arun(scenario())
    winners = [o for o in outcomes if not isinstance(o, BaseException)]
    losers = [o for o in outcomes if isinstance(o, ConflictError)]
    assert len(winners) == 1 and len(losers) == 1
    assert winners[0].revision == 2
    assert stored.revision == 2
    assert stored.data == winners[0].data
    assert losers[0].payload["current"]["data"] == winners[0].data


class _InterleavingRepository(JsonSpendingRepository):
    """Hands control back to the loop after every read.

    Two saves then both read revision 1 and both pass the usecase's early
    revision check before either writes -- the interleaving two requests in
    flight on a real server produce, and the one a plain `gather` over this
    in-memory store would never reach. It also records what each
    `replace_if_revision` answered, to prove the compare-and-set (not the early
    check) is what stopped the loser.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.cas_answers = []

    async def get(self, workspace_id):
        record = await super().get(workspace_id)
        await asyncio.sleep(0)
        return record

    async def replace_if_revision(self, record, expected_revision):
        answer = await super().replace_if_revision(record, expected_revision)
        self.cas_answers.append(answer)
        return answer


def test_the_compare_and_set_stops_a_save_that_passed_the_early_revision_check(tmp_path):
    async def scenario():
        uc, repo = build(tmp_path, repo_class=_InterleavingRepository)
        created = await uc.create_workspace(SpendingCreateRequest())
        outcomes = await asyncio.gather(
            uc.save_workspace(created.id, created.access_key, save_request(1, {"by": "phone"})),
            uc.save_workspace(created.id, created.access_key, save_request(1, {"by": "laptop"})),
            return_exceptions=True,
        )
        return outcomes, repo.cas_answers, await uc.get_workspace(created.id, created.access_key)

    outcomes, cas_answers, stored = arun(scenario())
    winners = [o for o in outcomes if not isinstance(o, BaseException)]
    losers = [o for o in outcomes if isinstance(o, ConflictError)]

    assert sorted(cas_answers) == [False, True], "both saves must have reached the store"
    assert len(winners) == 1 and len(losers) == 1
    assert stored.revision == 2
    assert stored.data == winners[0].data
    # The loser is told what the winner stored, re-read after its own failed write.
    assert losers[0].payload["current"]["revision"] == 2
    assert losers[0].payload["current"]["data"] == winners[0].data


def test_a_save_that_loses_to_a_delete_is_a_404_not_a_conflict(tmp_path):
    class DeletedUnderneath(JsonSpendingRepository):
        async def replace_if_revision(self, record, expected_revision):
            await self.delete(record.id)  # another device deletes between read and write
            return await super().replace_if_revision(record, expected_revision)

    async def scenario():
        uc, _ = build(tmp_path, repo_class=DeletedUnderneath)
        created = await uc.create_workspace(SpendingCreateRequest())
        with pytest.raises(NotFoundError):
            await uc.save_workspace(created.id, created.access_key, save_request(1, {"x": 1}))

    arun(scenario())
