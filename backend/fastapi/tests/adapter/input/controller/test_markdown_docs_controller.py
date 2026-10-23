"""`/markdown/sync/*` and `/markdown/docs/*` over HTTP (md-sync B11), through the real wiring: factory ->
use case -> JSON store on a temp file (MySQL on the suite's SQLite, Mongo on fake_mongo). Nothing touches a
real database.
"""

import os

os.environ.setdefault("TESTING", "1")

import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from src.adapter.factory import markdown_docs_factory, markdown_share_factory
from src.adapter.input.controllers import markdown_admin
from src.adapter.output.markdown_docs import legacy_reader, mongo_repository
from src.application.config.config import settings
from src.application.utils.line_patch import make_delta, sha256_hex
from src.main import app
from tests.support import fake_mongo

BASE = f"{settings.API_PREFIX}/markdown"
KEY = "docs-test-admin-key"
ADMIN = {"X-Admin-Key": KEY}
NOW = 1_761_000_000_000
BIG = "\n".join(f"line {n} of a fairly long document, with some words in it" for n in range(300)) + "\n"


@pytest.fixture(autouse=True)
def wiring(tmp_path, monkeypatch):
    markdown_docs_factory.reset_for_tests()
    markdown_share_factory.reset_for_tests()
    markdown_admin.reset_for_tests()
    monkeypatch.setenv("MARKDOWN_ADMIN_KEY", KEY)
    monkeypatch.setenv("MARKDOWN_JSON_FILE", str(tmp_path / "markdown-files.json"))
    for name in ("MARKDOWN_STORAGE_BACKEND", "MARKDOWN_PUBLIC_READ", "MARKDOWN_LEGACY_PUT"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setattr(settings, "MARKDOWN_STORAGE_BACKEND", "json")
    monkeypatch.setattr(settings, "MARKDOWN_PUBLIC_READ", False)
    monkeypatch.setattr(settings, "MARKDOWN_DOCS_JSON_FILE", str(tmp_path / "markdown-docs.json"))
    monkeypatch.setattr(settings, "MARKDOWN_SHARES_JSON_FILE", str(tmp_path / "markdown-shares.json"))
    monkeypatch.setattr(settings, "MARKDOWN_DOC_MAX_BYTES", 3_500_000)
    monkeypatch.setattr(settings, "MARKDOWN_PUSH_MAX_BYTES", 4_000_000)
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()
    markdown_docs_factory.reset_for_tests()
    markdown_share_factory.reset_for_tests()
    markdown_admin.reset_for_tests()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def op(doc_id, content, base=0, name="a.md", **extra):
    body = {"id": doc_id, "kind": "file", "baseRev": base, "content": content, "hash": sha256_hex(content), "updatedAt": NOW, **extra}
    if name:
        body["set"] = {"name": name, "parentId": "root"}
    return body


def push(client, *ops, device="md-test", headers=ADMIN, backend=""):
    suffix = f"?backend={backend}" if backend else ""
    return client.post(f"{BASE}/sync/push{suffix}", json={"device": device, "ops": list(ops)}, headers=headers)


# ------------------------------------------------------------------ who may do what

@pytest.mark.parametrize("method,path,body", [
    ("post", "/sync/push", {"device": "d", "ops": [{"id": "a", "kind": "file", "baseRev": 0, "updatedAt": 1, "content": "x", "hash": "0" * 64}]}),
    ("get", "/docs/doc-1/revisions", None),
    ("get", "/docs/doc-1/revisions/1", None),
])
def test_writing_and_history_need_the_administrator(client, method, path, body):
    kwargs = {"json": body} if body is not None else {}
    response = getattr(client, method)(f"{BASE}{path}", **kwargs)
    assert response.status_code == 403 and response.json()["data"]["code"] == "markdown_admin_required"
    wrong = getattr(client, method)(f"{BASE}{path}", headers={"X-Admin-Key": "nope"}, **kwargs)
    assert wrong.status_code == 403 and wrong.json()["data"]["code"] == "markdown_admin_invalid"


@pytest.mark.parametrize("path", ["/sync/changes", "/docs/doc-1"])
def test_the_store_is_private_by_default_so_a_guest_cannot_read(client, path):
    assert push(client, op("doc-1", "# secret\n")).status_code == 200
    guest = client.get(f"{BASE}{path}")
    assert guest.status_code == 403 and guest.json()["data"]["code"] == "markdown_private"
    assert "secret" not in guest.text
    assert client.get(f"{BASE}{path}", headers=ADMIN).status_code == 200


def test_a_session_works_like_the_key_for_every_route(client):
    session = client.post(f"{BASE}/admin/verify", headers=ADMIN).json()["session"]
    headers = {"X-Admin-Session": session}
    assert push(client, op("doc-1", "text"), headers=headers).status_code == 200
    assert client.get(f"{BASE}/sync/changes", headers=headers).status_code == 200
    assert client.get(f"{BASE}/docs/doc-1", headers=headers).status_code == 200
    assert client.get(f"{BASE}/docs/doc-1/revisions", headers=headers).status_code == 200


def test_with_public_read_on_guests_read_documents_but_never_write_or_see_history(client, monkeypatch):
    assert push(client, op("doc-1", "# shared openly\n")).status_code == 200
    monkeypatch.setattr(settings, "MARKDOWN_PUBLIC_READ", True)
    assert [i["id"] for i in client.get(f"{BASE}/sync/changes").json()["items"]] == ["doc-1"]
    assert client.get(f"{BASE}/docs/doc-1").json()["content"] == "# shared openly\n"
    assert push(client, op("doc-2", "x"), headers={}).status_code == 403
    assert client.get(f"{BASE}/docs/doc-1/revisions").status_code == 403, "history is never public"
    assert client.get(f"{BASE}/docs/doc-1/revisions/1").status_code == 403


def test_wrong_keys_are_counted_and_lock_the_address_out_of_every_route(client, monkeypatch):
    monkeypatch.setattr(settings, "MARKDOWN_ADMIN_MAX_FAILURES", 3)
    markdown_admin.reset_for_tests()
    for _ in range(3):
        assert push(client, op("a", "x"), headers={"X-Admin-Key": "guess"}).status_code == 403
    locked = push(client, op("a", "x"))                                     # even the right key waits
    assert locked.status_code == 429 and locked.json()["data"]["code"] == "markdown_admin_locked" and locked.headers["retry-after"]


# ----------------------------------------------------------------------- push / pull

def test_push_answers_per_op_and_the_documents_come_back_through_changes(client):
    response = push(client, op("doc-1", "# Xin chào\n", name="chao.md"), op("doc-2", "second", name="two.md"), device="md-aaa")
    assert response.status_code == 200 and response.headers["cache-control"] == "no-store"
    body = response.json()
    assert [(r["id"], r["status"], r["rev"]) for r in body["results"]] == [("doc-1", "ok", 1), ("doc-2", "ok", 1)]
    assert body["results"][0]["hash"] == sha256_hex("# Xin chào\n") and body["serverTime"] > 0

    pulled = client.get(f"{BASE}/sync/changes?since=0&device=md-bbb", headers=ADMIN)
    assert pulled.status_code == 200 and pulled.headers["cache-control"] == "no-store"
    data = pulled.json()
    assert set(data) == {"items", "cursor", "more", "horizon", "reset"} and data["more"] is False and data["reset"] is False
    by_id = {item["id"]: item for item in data["items"]}
    assert by_id["doc-1"]["content"] == "# Xin chào\n" and by_id["doc-1"]["name"] == "chao.md" and by_id["doc-1"]["parentId"] == "root"

    own = client.get(f"{BASE}/sync/changes?since=1&device=md-aaa", headers=ADMIN).json()
    assert own["items"] and all(item["content"] is None for item in own["items"]), "an incremental pull does not send a device its own text"
    full = client.get(f"{BASE}/sync/changes?since=0&device=md-aaa", headers=ADMIN).json()
    assert sorted(item["content"] for item in full["items"]) == ["# Xin chào\n", "second"], "a full pull (since=0) always carries the text"


def test_a_conflict_and_a_rejection_are_results_not_errors(client):
    assert push(client, op("doc-1", "v1")).status_code == 200
    assert push(client, op("doc-1", "theirs", base=1, name=None), device="md-bbb").status_code == 200
    mixed = push(client, op("doc-1", "mine", base=1, name=None), op("bad", "x", name="a/b.md"), op("fine", "ok", name="f.md")).json()["results"]
    assert [r["status"] for r in mixed] == ["conflict", "rejected", "ok"]
    assert mixed[0]["parts"] == ["content"] and mixed[0]["record"]["content"] == "theirs"
    assert mixed[1]["code"] == "md_bad_name"


def test_a_line_patch_goes_through_and_the_history_shows_it(client):
    edited = BIG.replace("line 150 ", "LINE 150 ")
    assert push(client, op("doc-1", BIG)).status_code == 200
    patched = {"id": "doc-1", "kind": "file", "baseRev": 1, "patch": make_delta(BIG, edited), "baseHash": sha256_hex(BIG), "hash": sha256_hex(edited), "updatedAt": NOW}
    result = push(client, patched)
    assert result.json()["results"][0]["status"] == "ok"
    assert len(json.dumps(patched)) < 400, "the point of a patch: a small body for a 17 KB document"

    assert client.get(f"{BASE}/docs/doc-1", headers=ADMIN).json()["content"] == edited
    listing = client.get(f"{BASE}/docs/doc-1/revisions", headers=ADMIN).json()
    assert [row["rev"] for row in listing["items"]] == [2, 1] and listing["more"] is False
    assert all("body" not in row for row in listing["items"]), "a listing carries no text"
    version = client.get(f"{BASE}/docs/doc-1/revisions/1", headers=ADMIN).json()
    assert version["content"] == BIG and version["rev"] == 1 and version["docId"] == "doc-1"
    assert client.get(f"{BASE}/docs/doc-1/revisions?limit=1", headers=ADMIN).json()["more"] is True
    assert client.get(f"{BASE}/docs/doc-1/revisions?before=2", headers=ADMIN).json()["items"][0]["rev"] == 1


def test_a_deleted_document_leaves_the_pull_as_a_tombstone_and_the_door_by_id(client):
    assert push(client, op("doc-1", "gone soon")).status_code == 200
    gone = push(client, {"id": "doc-1", "kind": "file", "baseRev": 1, "deleted": True, "updatedAt": NOW}).json()["results"][0]
    assert gone["status"] == "ok" and gone["hash"] == ""
    tomb = [i for i in client.get(f"{BASE}/sync/changes?since=1", headers=ADMIN).json()["items"] if i["id"] == "doc-1"][0]
    assert tomb["deleted"] is True and tomb["content"] is None
    missing = client.get(f"{BASE}/docs/doc-1", headers=ADMIN)
    assert missing.status_code == 404 and missing.json()["data"]["code"] == "md_doc_not_found"
    assert client.get(f"{BASE}/docs/never-existed", headers=ADMIN).status_code == 404
    assert client.get(f"{BASE}/docs/doc-1/revisions/99", headers=ADMIN).json()["data"]["code"] == "md_revision_not_found"


def test_the_document_door_is_what_md_share_live_mode_will_read(client):
    """`GET /docs/{id}` carries what the ETag needs: the text, its hash and `contentRev`."""
    push(client, op("doc-1", "v1"))
    push(client, op("doc-1", "v2", base=1, name=None))
    record = client.get(f"{BASE}/docs/doc-1", headers=ADMIN).json()
    assert (record["content"], record["hash"], record["contentRev"], record["rev"]) == ("v2", sha256_hex("v2"), 2, 2)


# ----------------------------------------------------------------- bad requests

@pytest.mark.parametrize("body", [
    {"device": "md-test", "ops": []},
    {"device": "md test", "ops": [{"id": "a", "kind": "file", "baseRev": 0, "updatedAt": 1}]},
    {"ops": [{"id": "a", "kind": "file", "baseRev": 0, "updatedAt": 1}]},
    {"device": "md-test", "ops": [{"id": "a/b", "kind": "file", "baseRev": 0, "updatedAt": 1}]},
    {"device": "md-test", "ops": [{"id": "a", "kind": "disk", "baseRev": 0, "updatedAt": 1}]},
    {"device": "md-test", "ops": [{"id": "a", "kind": "file", "baseRev": 0, "updatedAt": 1, "content": "x", "hash": "nope"}]},
    {"device": "md-test", "ops": [{"id": "a", "kind": "file", "baseRev": 0, "updatedAt": 1, "content": "x"}]},
    {"device": "md-test", "ops": [{"id": "a", "kind": "file", "baseRev": 0, "updatedAt": 1, "content": "x", "hash": "0" * 64,
                                   "patch": {"v": 1, "h": []}, "baseHash": "0" * 64}]},
    {"device": "md-test", "ops": [{"id": "a", "kind": "file", "baseRev": 0, "updatedAt": 1, "patch": {"v": 1, "h": []}, "hash": "0" * 64}]},
    {"device": "md-test", "ops": [{"id": "a", "kind": "folder", "baseRev": 0, "updatedAt": 1, "content": "x", "hash": "0" * 64}]},
    {"device": "md-test", "ops": [{"id": "a", "kind": "file", "baseRev": -1, "updatedAt": 1}]},
])
def test_a_body_of_the_wrong_shape_is_refused_before_anything_is_written(client, body):
    response = client.post(f"{BASE}/sync/push", json=body, headers=ADMIN)
    assert response.status_code in (400, 422)
    assert client.get(f"{BASE}/sync/changes", headers=ADMIN).json()["items"] == []


def test_more_than_200_ops_in_one_push_is_refused(client):
    ops = [{"id": f"d{n}", "kind": "folder", "baseRev": 0, "updatedAt": 1, "set": {"name": f"f{n}"}} for n in range(201)]
    assert push(client, *ops).status_code in (400, 422)
    assert push(client, *ops[:200]).status_code == 200


def test_the_same_node_twice_or_too_much_text_is_a_400_with_a_code(client, monkeypatch):
    twice = push(client, op("doc-1", "a"), op("doc-1", "b", base=1))
    assert twice.status_code == 400 and twice.json()["data"]["code"] == "md_duplicate_op"
    monkeypatch.setattr(settings, "MARKDOWN_PUSH_MAX_BYTES", 1000)
    markdown_docs_factory.reset_for_tests()
    big = push(client, op("a", "x" * 700), op("b", "y" * 700, name="b.md"))
    assert big.status_code == 400 and big.json()["data"]["code"] == "md_push_too_large"
    assert client.get(f"{BASE}/sync/changes", headers=ADMIN).json()["items"] == []


def test_one_document_over_the_budget_is_rejected_alone(client, monkeypatch):
    monkeypatch.setattr(settings, "MARKDOWN_DOC_MAX_BYTES", 50)
    markdown_docs_factory.reset_for_tests()
    results = push(client, op("big", "x" * 51, name="b.md"), op("small", "x" * 50, name="s.md")).json()["results"]
    assert [(r["status"], r.get("code")) for r in results] == [("rejected", "md_doc_too_large"), ("ok", None)]


@pytest.mark.parametrize("path", ["/sync/changes?since=-1", "/sync/changes?limit=0", "/sync/changes?limit=5000", "/sync/changes?device=a%20b",
                                  "/docs/a%2Fb", f"/docs/{'x' * 81}", "/docs/doc-1/revisions/0", "/docs/doc-1/revisions?limit=0"])
def test_bad_query_values_are_refused(client, path):
    assert client.get(f"{BASE}{path}", headers=ADMIN).status_code in (400, 404, 422)
    assert client.get(f"{BASE}{path}", headers=ADMIN).status_code != 200


def test_an_enormous_cursor_is_refused_not_passed_to_the_database(client):
    assert client.get(f"{BASE}/sync/changes?since={10 ** 30}", headers=ADMIN).status_code == 422


def test_an_enormous_version_number_is_refused_not_passed_to_the_database(client):
    """A BIGINT overflow in the driver (SQLite: OverflowError) used to turn into a 503 `md_store_unavailable`."""
    assert push(client, op("doc-1", "text")).status_code == 200
    assert client.get(f"{BASE}/docs/doc-1/revisions/{2 ** 31 - 1}", headers=ADMIN).status_code == 404
    for rev in (2 ** 31, 99999999999999999999):
        assert client.get(f"{BASE}/docs/doc-1/revisions/{rev}", headers=ADMIN).status_code == 422


def test_the_device_name_legacy_is_reserved_for_the_migration(client):
    assert push(client, op("doc-1", "text"), device="legacy").status_code == 422
    assert push(client, op("doc-1", "text"), device="legacy-2").status_code == 200


# -------------------------------------------------------------------------- backends

def test_the_backends_are_separate_stores(client, tmp_path, monkeypatch):
    fake_mongo.install(monkeypatch, mongo_repository)
    fake_mongo.install(monkeypatch, legacy_reader)
    assert push(client, op("only-json", "j")).status_code == 200
    assert push(client, op("only-mongo", "m"), backend="mongo").status_code == 200
    json_ids = [i["id"] for i in client.get(f"{BASE}/sync/changes?backend=json", headers=ADMIN).json()["items"]]
    mongo_ids = [i["id"] for i in client.get(f"{BASE}/sync/changes?backend=mongo", headers=ADMIN).json()["items"]]
    assert json_ids == ["only-json"] and mongo_ids == ["only-mongo"]
    assert client.get(f"{BASE}/docs/only-mongo?backend=mongo", headers=ADMIN).json()["content"] == "m"
    assert client.get(f"{BASE}/docs/only-mongo", headers=ADMIN).status_code == 404


def test_mongo_without_a_uri_is_a_503_and_an_unknown_backend_a_400(client, monkeypatch):
    monkeypatch.setattr(mongo_repository.mongo_store, "is_configured", lambda: False)
    response = client.get(f"{BASE}/sync/changes?backend=mongo", headers=ADMIN)
    assert response.status_code == 503 and response.json()["data"]["code"] == "markdown_backend_unavailable"
    assert push(client, op("a", "x"), backend="mongo").status_code == 503
    unknown = client.get(f"{BASE}/sync/changes?backend=postgres", headers=ADMIN)
    assert unknown.status_code == 400 and unknown.json()["data"]["code"] == "markdown_bad_backend"


@pytest.fixture
def clean_sql_store():
    """The suite's SQLite file outlives a test: start with empty sync tables, leave them empty."""
    from src.adapter.output.markdown_docs.mysql_repository import MySqlMarkdownDocsRepository
    from src.adapter.output.mysql.db.base import get_async_session
    from tests.conftest import arun

    async def wipe():
        await MySqlMarkdownDocsRepository()._session()          # creates the tables if they are not there yet
        session = get_async_session()
        try:
            for table in ("markdown_docs", "markdown_doc_revisions", "markdown_meta"):
                await session.execute(text(f"DELETE FROM {table}"))
            await session.commit()
        finally:
            await session.close()

    arun(wipe())
    yield
    arun(wipe())


def test_the_sql_store_runs_the_same_flow_with_tables_created_on_the_fly(client, clean_sql_store):
    created = push(client, op("sql-1", BIG, name="s.md"), backend="mysql")
    assert created.status_code == 200 and created.json()["results"][0]["status"] == "ok"
    edited = BIG.replace("line 5 ", "LINE 5 ")
    patched = {"id": "sql-1", "kind": "file", "baseRev": 1, "patch": make_delta(BIG, edited), "baseHash": sha256_hex(BIG), "hash": sha256_hex(edited), "updatedAt": NOW}
    assert push(client, patched, backend="mysql").json()["results"][0]["rev"] == 2
    assert client.get(f"{BASE}/docs/sql-1?backend=mysql", headers=ADMIN).json()["content"] == edited
    assert client.get(f"{BASE}/docs/sql-1/revisions/1?backend=mysql", headers=ADMIN).json()["content"] == BIG
    assert client.get(f"{BASE}/docs/sql-1", headers=ADMIN).status_code == 404, "the json store knows nothing of it"


# ------------------------------------------------------------------ a failing store

def test_a_store_failure_is_one_generic_503_that_leaks_nothing(client, monkeypatch):
    class Boom(Exception):
        pass

    async def explode(self, space, doc_id):
        raise Boom("(2003, \"Can't connect to MySQL server on 'db.secret-host.example'\") [parameters: ('# private text',)]")

    from src.adapter.output.markdown_docs.json_repository import JsonMarkdownDocsRepository
    assert push(client, op("doc-1", "# private text")).status_code == 200
    monkeypatch.setattr(JsonMarkdownDocsRepository, "get", explode)
    monkeypatch.setattr(JsonMarkdownDocsRepository, "list_since", lambda self, *a, **k: explode(self, "x", "y"))
    for response in (client.get(f"{BASE}/docs/doc-1", headers=ADMIN), client.get(f"{BASE}/sync/changes", headers=ADMIN)):
        assert response.status_code == 503 and response.json()["data"]["code"] == "md_store_unavailable"
        assert "secret-host" not in response.text and "private text" not in response.text and response.headers["retry-after"] == "5"


def test_a_programming_error_in_the_store_path_is_traceable_without_leaking_its_message(client, monkeypatch, caplog):
    """`md_store_unavailable` hides the message (a driver message carries the host and the pushed text) but a KeyError of
    ours must not look like a database that is down: the log keeps the class and the stack frames, never the message."""
    from src.adapter.output.markdown_docs.json_repository import JsonMarkdownDocsRepository

    message = "-".join(["secret", "key", "name", "# private text"])          # built at run time, as a driver's is

    async def broken(self, space, doc_id):
        raise KeyError(message)

    assert push(client, op("doc-1", "# private text")).status_code == 200
    monkeypatch.setattr(JsonMarkdownDocsRepository, "get", broken)
    with caplog.at_level("ERROR"):
        response = client.get(f"{BASE}/docs/doc-1", headers=ADMIN)
    assert response.status_code == 503 and "secret-key-name" not in response.text
    logged = " ".join(record.getMessage() + (record.exc_text or "") for record in caplog.records)
    assert "KeyError" in logged and "markdown sync store failed" in logged
    assert "in broken" in logged and "raise KeyError" in logged, "the frame that raised is in the log"
    assert "secret-key-name" not in logged and "private text" not in logged


def test_the_first_call_migrates_the_old_tree_and_nothing_is_lost_on_a_second_one(client, tmp_path):
    (tmp_path / "markdown-files.json").write_text(json.dumps({"files": [
        {"id": "root", "name": "Notes", "type": "folder", "children": [{"id": "old-1", "name": "old.md", "type": "file", "content": "from the old store"}]},
    ]}), encoding="utf-8")
    first = client.get(f"{BASE}/sync/changes", headers=ADMIN).json()
    again = client.get(f"{BASE}/sync/changes", headers=ADMIN).json()
    assert sorted(i["id"] for i in first["items"]) == ["old-1", "root"] == sorted(i["id"] for i in again["items"])
    assert client.get(f"{BASE}/docs/old-1", headers=ADMIN).json()["content"] == "from the old store"
    assert json.loads((tmp_path / "markdown-files.json").read_text(encoding="utf-8"))["files"][0]["id"] == "root", "the old file is untouched"
