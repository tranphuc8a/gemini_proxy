"""Shape of a push (md-sync B2): what is refused with 422 before the use case sees it."""

import pytest
from pydantic import ValidationError

from src.domain.vo.markdown_docs_vo import MAX_OPS_PER_PUSH, DocRecord, PushOp, PushRequest, Revision
from src.domain.vo.markdown_ids import DOC_ID_PATTERN

H = "a" * 64


def op(**fields):
    base = {"id": "file-1", "kind": "file", "baseRev": 0, "updatedAt": 1_761_000_000_000}
    return {**base, **fields}


def test_a_minimal_op_with_content_parses():
    parsed = PushOp(**op(content="x", hash=H, set={"name": "x.md", "parentId": "root"}))
    assert parsed.meta.name == "x.md" and parsed.meta.parentId == "root" and parsed.deleted is None


def test_the_id_shape_is_the_one_every_markdown_feature_shares():
    from src.domain.vo import markdown_docs_vo
    assert markdown_docs_vo.DOC_ID_PATTERN == DOC_ID_PATTERN
    for good in ["root", "file-lq8x1-0a-k3j2", "a:b.c_d-1", "x" * 80]:
        PushOp(**op(id=good, deleted=True))
    for bad in ["", "x" * 81, "a b", "a/b", "ệ", "a\n"]:
        with pytest.raises(ValidationError):
            PushOp(**op(id=bad, deleted=True))


def test_parent_null_is_not_the_same_as_parent_not_sent():
    moved_to_top = PushOp(**op(set={"parentId": None}))
    renamed_only = PushOp(**op(set={"name": "n.md"}))
    assert "parentId" in moved_to_top.meta.model_fields_set and moved_to_top.meta.parentId is None
    assert "parentId" not in renamed_only.meta.model_fields_set


@pytest.mark.parametrize("fields", [
    dict(content="x", hash=H, patch={"v": 1, "h": []}, baseHash=H),    # both
    dict(patch={"v": 1, "h": []}, hash=H),                              # patch without baseHash
    dict(content="x"),                                                  # content without hash
    dict(patch={"v": 1, "h": []}, baseHash=H),                          # patch without hash
    dict(kind="folder", content="x", hash=H),                           # a folder has no content
    dict(content="x", hash="not-a-hash"),
    dict(content="x", hash=H.upper()),
    dict(content="x", hash=H, baseRev=-1),
    dict(content="x", hash=H, updatedAt=-5),
    dict(kind="note", content="x", hash=H),
    dict(patch={"v": 2, "h": []}, baseHash=H, hash=H),
    dict(patch={"v": 1, "h": [[0, 1]]}, baseHash=H, hash=H),
    dict(patch={"v": 1, "h": [[0.5, 1, []]]}, baseHash=H, hash=H),
    dict(patch={"v": 1, "h": [["0", 1, []]]}, baseHash=H, hash=H),
    dict(patch={"v": 1, "h": [[0, 1, [3]]]}, baseHash=H, hash=H),
    dict(set={"parentId": "has space"}),
])
def test_incoherent_ops_are_refused(fields):
    with pytest.raises(ValidationError):
        PushOp(**op(**fields))


def test_a_good_patch_op_parses_and_dumps_back_to_the_shared_format():
    parsed = PushOp(**op(patch={"v": 1, "h": [[3, 1, ["x", "y"]], [9, 0, []]]}, baseHash=H, hash="b" * 64, baseRev=4))
    assert parsed.patch.model_dump() == {"v": 1, "h": [(3, 1, ["x", "y"]), (9, 0, [])]}


def test_a_push_has_between_one_and_200_ops_and_a_device():
    ops = [op(id=f"d{n}", deleted=True) for n in range(MAX_OPS_PER_PUSH)]
    assert len(PushRequest(device="md-abc1234567", ops=ops).ops) == 200
    with pytest.raises(ValidationError):
        PushRequest(device="md-abc1234567", ops=ops + [op(id="one-more", deleted=True)])
    with pytest.raises(ValidationError):
        PushRequest(device="md-abc1234567", ops=[])
    for device in ["", "x" * 65, "has space", "ệ"]:
        with pytest.raises(ValidationError):
            PushRequest(device=device, ops=ops[:1])


def test_the_migrations_device_name_is_not_one_a_client_may_use():
    with pytest.raises(ValidationError):
        PushRequest(device="legacy", ops=[op(id="d1", deleted=True)])
    assert PushRequest(device="legacy-2", ops=[op(id="d1", deleted=True)]).device == "legacy-2"


def test_records_and_revisions_dump_in_camel_case_and_drop_text_on_request():
    record = DocRecord(id="a", kind="file", name="a.md", content="text", hash=H, size=4)
    assert record.model_dump()["serverUpdatedAt"] == 0 and record.without_content().content is None and record.content == "text"
    row = Revision(docId="a", rev=2, body="secret text", encoding="delta", baseRev=1, hash=H, size=11)
    meta = row.meta()
    assert "body" not in meta and "docId" not in meta and meta["baseRev"] == 1 and meta["encoding"] == "delta"
    assert row.without_body().body == "" and row.body == "secret text"
