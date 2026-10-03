"""The course content API: import, the light manifest, documents, search, admin edits.

The refactor's promise is in the first manifest test: the page start-up payload
carries no markdown. Everything else pins down that moving the content into the
database changed *where* it lives, not what the course pages see — navigation
order, slugs, ranking and snippets behave as they did in the browser engine.
"""

from __future__ import annotations

import copy
import hashlib
import hmac
import json
import time
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, select

from src.adapter.output.mysql.db.base import Base, get_async_engine, get_async_session, get_async_session_dependency
from src.adapter.output.mysql.entities import CourseGroupEntity, CourseSectionEntity
from src.application.config.config import settings
from src.application.usecases import course_usecase
from src.application.utils import admin_session
from src.main import app

ADMIN_KEY = "test-course-key"
BASE = f"{settings.API_PREFIX}/courses"
ADMIN = {"X-Admin-Key": ADMIN_KEY}

BUNDLE = {
    "course": {"slug": "demo", "title": "Khoá thử nghiệm", "icon": "🧪", "description": "Để kiểm thử"},
    "nav": [
        {"id": "khoa-hoc", "title": "Khoá học", "sub": "hai phần", "icon": "compass", "groups": [
            {"title": "Phần 1 — Nền tảng", "short": "P1", "items": ["p1/bai-01.md", "p1/bai-02.md"]},
            {"title": "Phần 2 — Nâng cao", "short": "P2", "items": ["p2/bai-01.md"]},
        ]},
        {"id": "tai-lieu", "title": "Tài liệu", "sub": "", "icon": "book", "groups": [
            {"title": "Tra cứu", "short": "Tra cứu", "items": ["ref/tu-dien.md"]},
        ]},
    ],
    "slugs": {},
    "order": [],
    "docs": {
        "p1/bai-01.md": {"id": "p1/bai-01.md", "slug": "bai/p1-bai-01", "title": "Gradient và tối ưu",
                         "kind": "lesson", "meta": {"no": 1},
                         "md": "# Gradient và tối ưu\n\n## Đạo hàm\n\nGradient descent đi ngược gradient.\n\n"
                               "## Bước học\n\nChọn bước học vừa phải.\n\n```py\nx = x - lr * g\n```\n"},
        "p1/bai-02.md": {"id": "p1/bai-02.md", "slug": "bai/p1-bai-02", "title": "Xác suất",
                         "kind": "lesson", "meta": {"no": 2},
                         "md": "# Xác suất\n\nPhân phối chuẩn. Một ví dụ: sandbox không phải bộ nhớ.\n"},
        "p2/bai-01.md": {"id": "p2/bai-01.md", "slug": "bai/p2-bai-01", "title": "Học sâu",
                         "kind": "lesson", "tag": "★ trọng tâm", "meta": {"no": 3},
                         "md": "# Học sâu\n\nMạng nhiều lớp dùng gradient để học. 📌 Ghi nhớ.\n"},
        "ref/tu-dien.md": {"id": "ref/tu-dien.md", "slug": "tai-lieu/tu-dien", "title": "Từ điển",
                           "kind": "ref", "md": "# Từ điển\n\n| Anh | Việt |\n|---|---|\n| gradient | độ dốc |\n"},
        "phu-luc.md": {"id": "phu-luc.md", "slug": "phu-luc", "title": "Phụ lục ngoài cây",
                       "kind": "ref", "md": "# Phụ lục\n\nKhông nằm trong mục lục.\n"},
    },
    "stats": {"lessonsPlanned": 5},
}


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("COURSE_ADMIN_KEY", ADMIN_KEY)
    course_usecase.reset_search_cache()
    created = {"done": False}

    async def _session_with_schema():
        if not created["done"]:
            engine = get_async_engine()
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.drop_all)
                await conn.run_sync(Base.metadata.create_all)
            created["done"] = True
        db = get_async_session()
        try:
            yield db
        finally:
            await db.close()

    app.dependency_overrides[get_async_session_dependency] = _session_with_schema
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    course_usecase.reset_search_cache()


def _import(client, bundle=None, **params):
    r = client.post(f"{BASE}/import", json=bundle or BUNDLE, headers=ADMIN, params=params)
    assert r.status_code == 200, r.text
    return r.json()


# ------------------------------------------------------------------ import

def test_writes_need_the_admin_key(client):
    assert client.post(f"{BASE}/import", json=BUNDLE).status_code == 403
    assert client.post(f"{BASE}/import", json=BUNDLE, headers={"X-Admin-Key": "nope"}).status_code == 403
    assert client.post(BASE, json={"slug": "x", "title": "X"}).status_code == 403


def test_import_stores_the_course_and_computes_stats(client):
    course = _import(client)
    assert course["slug"] == "demo" and course["title"] == "Khoá thử nghiệm" and course["icon"] == "🧪"
    assert course["docCount"] == 5
    stats = course["stats"]
    assert stats["files"] == 5 and stats["lessons"] == 3
    assert stats["lessonsPlanned"] == 5, "editorial stats from the bundle are kept"
    assert stats["words"] > 0 and stats["minutes"] >= 10

    listed = client.get(BASE).json()["courses"]
    assert [c["slug"] for c in listed] == ["demo"]


def test_import_replaces_an_existing_course_and_bumps_the_version(client):
    first = _import(client)
    smaller = copy.deepcopy(BUNDLE)
    del smaller["docs"]["phu-luc.md"]
    second = _import(client, smaller)
    assert second["docCount"] == 4
    assert second["version"] > first["version"]
    assert client.get(f"{BASE}/demo/docs/phu-luc.md").status_code == 404


# ---------------------------------------------------------------- manifest

def test_manifest_carries_no_markdown(client):
    _import(client)
    m = client.get(f"{BASE}/demo/manifest").json()
    assert set(m) >= {"course", "nav", "slugs", "order", "docs", "stats", "version"}
    assert all("md" not in d and "outline" not in d for d in m["docs"].values())
    assert m["docs"]["p2/bai-01.md"]["tag"] == "★ trọng tâm"
    assert m["docs"]["p1/bai-01.md"]["section"] == "khoa-hoc" and m["docs"]["p1/bai-01.md"]["group"] == "P1"
    assert m["slugs"]["bai/p2-bai-01"] == "p2/bai-01.md"


def test_manifest_order_is_navigation_order_with_unlisted_documents_last(client):
    """Positions are stored per group; ordering by them alone would interleave
    the groups (P1 #0, P2 #0, Tra cứu #0, P1 #1…)."""
    _import(client)
    m = client.get(f"{BASE}/demo/manifest").json()
    assert m["order"] == ["p1/bai-01.md", "p1/bai-02.md", "p2/bai-01.md", "ref/tu-dien.md", "phu-luc.md"]
    assert list(m["docs"]) == m["order"]
    assert m["nav"][0]["groups"][0]["items"] == ["p1/bai-01.md", "p1/bai-02.md"]


def test_manifest_revalidates_with_an_etag_and_is_gzipped(client):
    _import(client)
    r = client.get(f"{BASE}/demo/manifest", headers={"Accept-Encoding": "gzip"})
    assert r.status_code == 200 and r.headers["content-encoding"] == "gzip"
    etag = r.headers["etag"]
    again = client.get(f"{BASE}/demo/manifest", headers={"If-None-Match": etag})
    assert again.status_code == 304 and again.content == b""

    client.put(f"{BASE}/demo/docs/p1/bai-02.md", json={"md": "# Xác suất\n\nĐã sửa.\n"}, headers=ADMIN)
    after_edit = client.get(f"{BASE}/demo/manifest", headers={"If-None-Match": etag})
    assert after_edit.status_code == 200, "an edit must invalidate the cached manifest"


# --------------------------------------------------------------- documents

def test_a_document_comes_with_markdown_and_derived_fields(client):
    _import(client)
    d = client.get(f"{BASE}/demo/docs/p1/bai-01.md").json()
    assert d["md"].startswith("# Gradient và tối ưu")
    assert d["outline"] == [{"d": 2, "t": "Đạo hàm"}, {"d": 2, "t": "Bước học"}]
    assert d["codeLines"] == 1 and d["words"] > 5
    assert client.get(f"{BASE}/demo/docs/khong/co.md").status_code == 404
    assert client.get(f"{BASE}/khong-co/docs/p1/bai-01.md").status_code == 404


def test_emoji_and_vietnamese_survive_the_round_trip(client):
    _import(client)
    assert "📌" in client.get(f"{BASE}/demo/docs/p2/bai-01.md").json()["md"]


# ------------------------------------------------------------------ search

def test_search_ignores_diacritics_and_ranks_titles_first(client):
    _import(client)
    hits = client.get(f"{BASE}/demo/search", params={"q": "gradient"}).json()["hits"]
    assert [h["id"] for h in hits][:1] == ["p1/bai-01.md"], "title match outranks body matches"
    assert {h["id"] for h in hits} == {"p1/bai-01.md", "p2/bai-01.md", "ref/tu-dien.md"}

    hits = client.get(f"{BASE}/demo/search", params={"q": "xac suat"}).json()["hits"]
    assert hits and hits[0]["id"] == "p1/bai-02.md"


def test_search_across_every_published_course(client):
    _import(client)
    other = {**BUNDLE, "course": {**BUNDLE["course"], "slug": "khac", "title": "Khoá khác"}}
    _import(client, other)
    hidden = {**BUNDLE, "course": {**BUNDLE["course"], "slug": "nhap", "title": "Nháp", "published": False}}
    _import(client, hidden)
    body = client.get(f"{BASE}/search", params={"q": "gradient", "limit": 50}).json()
    courses = {h["course"] for h in body["hits"]}
    assert courses == {"demo", "khac"}, "both published courses, never the draft"
    assert body["hits"][0]["id"] == "p1/bai-01.md" and body["hits"][0]["courseTitle"] in ("Khoá thử nghiệm", "Khoá khác")
    scores = [h["score"] for h in body["hits"]]
    assert scores == sorted(scores, reverse=True)
    assert client.get(f"{BASE}/search", params={"q": " "}).json()["hits"] == []
    assert len(client.get(f"{BASE}/search", params={"q": "gradient", "limit": 2}).json()["hits"]) == 2


def test_search_snippets_keep_the_original_diacritics(client):
    _import(client)
    hit = client.get(f"{BASE}/demo/search", params={"q": "phan phoi"}).json()["hits"][0]
    assert "Phân phối chuẩn" in hit["snippet"]


def test_search_matches_at_word_starts_only(client):
    _import(client)
    ids = {h["id"] for h in client.get(f"{BASE}/demo/search", params={"q": "box"}).json()["hits"]}
    assert "p1/bai-02.md" not in ids, "'box' sits inside 'sandbox' and must not match"
    assert client.get(f"{BASE}/demo/search", params={"q": "  "}).json()["hits"] == []


def test_search_sees_an_edit_immediately(client):
    _import(client)
    assert client.get(f"{BASE}/demo/search", params={"q": "transformer"}).json()["hits"] == []
    client.put(f"{BASE}/demo/docs/p2/bai-01.md", json={"md": "# Học sâu\n\nTransformer là gì.\n"}, headers=ADMIN)
    hits = client.get(f"{BASE}/demo/search", params={"q": "transformer"}).json()["hits"]
    assert [h["id"] for h in hits] == ["p2/bai-01.md"]


# ------------------------------------------------------- publish / drafts

def test_an_unpublished_course_is_visible_to_admins_only(client):
    _import(client)
    r = client.patch(f"{BASE}/demo", json={"published": False}, headers=ADMIN)
    assert r.status_code == 200 and r.json()["published"] is False

    assert client.get(f"{BASE}/demo/manifest").status_code == 404
    assert client.get(f"{BASE}/demo/docs/p1/bai-01.md").status_code == 404
    assert client.get(BASE).json()["courses"] == []

    assert client.get(f"{BASE}/demo/manifest", headers=ADMIN).status_code == 200
    assert [c["slug"] for c in client.get(BASE, params={"all": 1}, headers=ADMIN).json()["courses"]] == ["demo"]
    assert client.get(BASE, params={"all": 1}).json()["courses"] == [], "?all=1 alone is not an admin"


# --------------------------------------------------------------- structure

def test_replacing_the_structure_reorders_without_touching_documents(client):
    _import(client)
    nav = client.get(f"{BASE}/demo").json()["nav"]
    nav[0]["groups"].reverse()                                   # P2 before P1
    nav[0]["groups"][1]["items"].reverse()                       # bai-02 before bai-01
    r = client.put(f"{BASE}/demo/structure", json={"nav": nav}, headers=ADMIN)
    assert r.status_code == 200, r.text
    order = client.get(f"{BASE}/demo/manifest").json()["order"]
    assert order[:3] == ["p2/bai-01.md", "p1/bai-02.md", "p1/bai-01.md"]
    assert client.get(f"{BASE}/demo/docs/p1/bai-01.md").json()["md"].startswith("# Gradient")


def test_a_structure_naming_unknown_documents_is_rejected(client):
    _import(client)
    nav = client.get(f"{BASE}/demo").json()["nav"]
    nav[0]["groups"][0]["items"].append("khong-ton-tai.md")
    r = client.put(f"{BASE}/demo/structure", json={"nav": nav}, headers=ADMIN)
    assert r.status_code == 400 and "khong-ton-tai.md" in r.json()["message"]


# ---------------------------------------------------------------- documents

def test_creating_a_document_places_it_at_the_end_of_its_group(client):
    _import(client)
    r = client.put(f"{BASE}/demo/docs/p1/bai-03.md", headers=ADMIN,
                   json={"md": "# Bài ba\n\nNội dung.\n", "section": "khoa-hoc", "group": "P1"})
    assert r.status_code == 200, r.text
    doc = r.json()
    assert doc["title"] == "Bài ba", "the title defaults to the H1"
    assert doc["slug"] == "p1/bai-03" and doc["group"] == "P1"
    m = client.get(f"{BASE}/demo/manifest").json()
    assert m["nav"][0]["groups"][0]["items"] == ["p1/bai-01.md", "p1/bai-02.md", "p1/bai-03.md"]
    assert m["stats"]["files"] == 6


def test_document_slugs_stay_unique(client):
    _import(client)
    r = client.put(f"{BASE}/demo/docs/p1/moi.md", headers=ADMIN, json={"md": "# Mới", "slug": "bai/p1-bai-01"})
    assert r.status_code == 409


def test_placing_into_a_missing_group_is_a_client_error(client):
    _import(client)
    r = client.put(f"{BASE}/demo/docs/p1/x.md", headers=ADMIN, json={"md": "# X", "section": "khoa-hoc", "group": "P9"})
    assert r.status_code == 400


def test_deleting_documents_and_courses(client):
    _import(client)
    assert client.delete(f"{BASE}/demo/docs/phu-luc.md", headers=ADMIN).status_code == 200
    assert client.get(f"{BASE}/demo/docs/phu-luc.md").status_code == 404
    assert client.get(f"{BASE}/demo").json()["stats"]["files"] == 4
    assert client.delete(f"{BASE}/demo/docs/phu-luc.md", headers=ADMIN).status_code == 404

    assert client.delete(f"{BASE}/demo", headers=ADMIN).status_code == 200
    assert client.get(f"{BASE}/demo/manifest").status_code == 404
    assert client.get(BASE).json()["courses"] == []


# ------------------------------------------------------- bundle and export

def test_the_bundle_endpoint_refuses_big_courses_except_for_admins(client, monkeypatch):
    _import(client)
    full = client.get(f"{BASE}/demo/bundle").json()
    assert full["docs"]["p1/bai-01.md"]["md"].startswith("# Gradient")

    monkeypatch.setattr(settings, "COURSE_BULK_MAX_BYTES", 50)
    r = client.get(f"{BASE}/demo/bundle")
    assert r.status_code == 413 and "manifest" in r.json()["message"]
    assert client.get(f"{BASE}/demo/bundle", headers=ADMIN).status_code == 200


def test_export_then_import_is_a_round_trip(client):
    _import(client)
    exported = client.get(f"{BASE}/demo/export", headers=ADMIN)
    assert exported.status_code == 200 and "attachment" in exported.headers["content-disposition"]
    bundle = exported.json()
    copy_course = _import(client, bundle, slug="demo-copy", title="Bản sao")
    assert copy_course["docCount"] == 5

    a = client.get(f"{BASE}/demo/manifest").json()
    b = client.get(f"{BASE}/demo-copy/manifest").json()
    for key in ("nav", "slugs", "order", "docs"):
        assert a[key] == b[key], key
    assert client.get(f"{BASE}/demo-copy/docs/p1/bai-01.md").json()["md"] == \
        client.get(f"{BASE}/demo/docs/p1/bai-01.md").json()["md"]


# --------------------------------------------------------------- validation

@pytest.mark.parametrize("slug", ["Demo", "-x", "admin", "import", "a" * 70, "có-dấu"])
def test_bad_course_slugs_are_rejected(client, slug):
    assert client.post(BASE, json={"slug": slug, "title": "X"}, headers=ADMIN).status_code == 400


def test_duplicate_document_slugs_in_a_bundle_are_rejected(client):
    bad = copy.deepcopy(BUNDLE)
    bad["docs"]["p1/bai-02.md"]["slug"] = "bai/p1-bai-01"
    r = client.post(f"{BASE}/import", json=bad, headers=ADMIN)
    assert r.status_code == 400 and "trùng slug" in r.json()["message"]


def test_creating_an_empty_course_then_filling_it(client):
    r = client.post(BASE, json={"slug": "rong", "title": "Khoá rỗng"}, headers=ADMIN)
    assert r.status_code == 201
    assert client.post(BASE, json={"slug": "rong", "title": "Lần hai"}, headers=ADMIN).status_code == 409
    nav = [{"id": "chinh", "title": "Chính", "groups": [{"title": "Nhóm A", "short": "A", "items": []}]}]
    assert client.put(f"{BASE}/rong/structure", json={"nav": nav}, headers=ADMIN).status_code == 200
    assert client.put(f"{BASE}/rong/docs/a/1.md", json={"md": "# Một", "section": "chinh", "group": "A"},
                      headers=ADMIN).status_code == 200
    assert client.get(f"{BASE}/rong/manifest").json()["order"] == ["a/1.md"]


# ----------------------------------------------------------------- sessions

def test_a_session_token_unlocks_writes_and_dies_with_the_key(client, monkeypatch):
    token = client.post(f"{BASE}/admin/verify", headers=ADMIN).json()["session"]
    assert ADMIN_KEY not in token
    assert client.post(BASE, json={"slug": "qua-token", "title": "T"},
                       headers={"X-Admin-Session": token}).status_code == 201
    refreshed = client.post(f"{BASE}/admin/session", headers={"X-Admin-Session": token})
    assert refreshed.status_code == 200
    monkeypatch.setenv("COURSE_ADMIN_KEY", "rotated")
    assert client.post(f"{BASE}/admin/session", headers={"X-Admin-Session": token}).status_code == 403
    assert client.delete(f"{BASE}/qua-token", headers={"X-Admin-Session": token}).status_code == 403


# ------------------------------------------------------------ review fixes
#
# Each test below pins down one finding of the independent review of the
# refactor, so the fix cannot quietly regress.

@contextmanager
def _statements():
    """Every SQL statement the app sends while the block runs (executemany = 1)."""
    engine = get_async_engine().sync_engine
    seen: list = []

    def listen(conn, cursor, statement, parameters, context, executemany):  # noqa: ARG001
        seen.append(statement)

    event.listen(engine, "before_cursor_execute", listen)
    try:
        yield seen
    finally:
        event.remove(engine, "before_cursor_execute", listen)


def _forged_token(key: str) -> str:
    body = admin_session._b64encode(json.dumps({"exp": int(time.time()) + 3600, "nonce": "x"}).encode("utf-8"))
    signature = hmac.new(admin_session._secret(key, "course-admin"), body.encode("ascii"), hashlib.sha256).digest()
    return f"{body}.{admin_session._b64encode(signature)}"


def test_without_a_configured_key_course_administration_is_off(client, monkeypatch):
    """No default key: an unset COURSE_ADMIN_KEY must not mean "course-admin-2024",
    and a token signed with the empty key must not verify."""
    monkeypatch.setenv("COURSE_ADMIN_KEY", "")
    monkeypatch.setattr(settings, "COURSE_ADMIN_KEY", "", raising=False)
    r = client.post(f"{BASE}/admin/verify", headers={"X-Admin-Key": "course-admin-2024"})
    assert r.status_code == 403 and "disabled" in r.text
    assert client.post(f"{BASE}/import", json=BUNDLE, headers={"X-Admin-Key": ""}).status_code == 403
    forged = {"X-Admin-Session": _forged_token("")}
    assert client.post(BASE, json={"slug": "x", "title": "X"}, headers=forged).status_code == 403
    assert client.post(f"{BASE}/admin/session", headers=forged).status_code == 403
    assert client.get(BASE, params={"all": 1}, headers=forged).status_code == 200, "reads stay public"


def test_a_session_cannot_be_refreshed_forever(client):
    old = admin_session.issue(ADMIN_KEY, salt="course-admin", ttl_seconds=3600,
                              since=int(time.time()) - 8 * 86400)
    r = client.post(f"{BASE}/admin/session", headers={"X-Admin-Session": old.token})
    assert r.status_code == 403 and r.json()["data"]["code"] == "session_too_old"

    fresh = client.post(f"{BASE}/admin/verify", headers=ADMIN).json()["session"]
    again = client.post(f"{BASE}/admin/session", headers={"X-Admin-Session": fresh})
    assert again.status_code == 200
    first = admin_session.verify_claims(fresh, ADMIN_KEY, salt="course-admin")
    second = admin_session.verify_claims(again.json()["session"], ADMIN_KEY, salt="course-admin")
    assert second["since"] == first["since"], "a refresh carries the login time forward"


def test_a_course_deleted_and_imported_again_never_matches_old_caches(client):
    """The version restarts at 1 after a delete; the revision must not."""
    _import(client)
    client.put(f"{BASE}/demo/docs/p1/bai-02.md", json={"md": "# Xác suất\n\nCon zebra.\n"}, headers=ADMIN)
    old_manifest = client.get(f"{BASE}/demo/manifest")
    old_doc = client.get(f"{BASE}/demo/docs/p1/bai-02.md")
    assert client.get(f"{BASE}/demo/search", params={"q": "zebra"}).json()["hits"]
    stale_index = dict(course_usecase._SEARCH_CACHE)       # what another process still holds

    assert client.delete(f"{BASE}/demo", headers=ADMIN).status_code == 200
    _import(client)
    client.put(f"{BASE}/demo/docs/p1/bai-02.md", json={"md": "# Xác suất\n\nNgựa vằn.\n"}, headers=ADMIN)
    new_manifest = client.get(f"{BASE}/demo/manifest")
    assert new_manifest.json()["version"] == old_manifest.json()["version"], "same version number…"
    assert new_manifest.headers["etag"] != old_manifest.headers["etag"], "…but not the same revision"
    assert client.get(f"{BASE}/demo/manifest",
                      headers={"If-None-Match": old_manifest.headers["etag"]}).status_code == 200
    assert client.get(f"{BASE}/demo/docs/p1/bai-02.md",
                      headers={"If-None-Match": old_doc.headers["etag"]}).status_code == 200

    course_usecase._SEARCH_CACHE.update(stale_index)       # a process that never saw the delete
    course_usecase._HITS_CACHE.clear()
    assert client.get(f"{BASE}/demo/search", params={"q": "zebra"}).json()["hits"] == []
    assert client.get(f"{BASE}/demo/search", params={"q": "ngua van"}).json()["hits"]


def test_the_version_is_incremented_by_the_database(client):
    """`version = version + 1` in SQL: two overlapping saves end at N+2, not N+1."""
    before = _import(client)["version"]
    with _statements() as seen:
        r = client.patch(f"{BASE}/demo", json={"title": "Đổi tên"}, headers=ADMIN)
    assert r.status_code == 200 and r.json()["version"] == before + 1
    bumps = [s for s in seen if s.lstrip().upper().startswith("UPDATE COURSES")]
    assert bumps and "courses.version +" in bumps[-1], bumps


def test_reads_take_a_handful_of_queries(client):
    _import(client)
    with _statements() as seen:
        assert client.get(f"{BASE}/demo/manifest").status_code == 200
    assert len(seen) <= 5, seen          # revision + course + summaries + sections + groups
    with _statements() as seen:
        assert client.get(f"{BASE}/demo/docs/p1/bai-01.md").json()["group"] == "P1"
    assert len(seen) <= 3, seen          # revision + visibility + one joined select


def test_bulk_writes_do_not_scale_with_the_number_of_documents(client):
    """Remote MySQL turns every statement into a round trip: importing or
    reordering 300 documents must not mean 300 statements. Documents may also
    leave out id, slug and title — they are filled from the key and the H1."""
    n = 300
    big = {
        "course": {"slug": "lon", "title": "Khoá lớn"},
        "nav": [{"id": "chinh", "title": "Chính", "groups": [
            {"title": "Tất cả", "short": "A", "items": [f"d/{i}.md" for i in range(n)]}]}],
        "docs": {f"d/{i}.md": {"md": f"# Bài {i}\n\nNội dung số {i}.\n"} for i in range(n)},
    }
    client.get(BASE)                     # the fixture creates the schema on first use
    with _statements() as seen:
        course = _import(client, big)
    assert course["docCount"] == n and len(seen) <= 20, len(seen)
    doc = client.get(f"{BASE}/lon/docs/d/7.md").json()
    assert doc["title"] == "Bài 7" and doc["slug"] == "d/7" and doc["outline"] == []

    nav = client.get(f"{BASE}/lon").json()["nav"]
    nav[0]["groups"][0]["items"].reverse()
    with _statements() as seen:
        r = client.put(f"{BASE}/lon/structure", json={"nav": nav}, headers=ADMIN)
    assert r.status_code == 200 and len(seen) <= 30, len(seen)
    assert client.get(f"{BASE}/lon/manifest").json()["order"][:3] == ["d/299.md", "d/298.md", "d/297.md"]


@pytest.mark.parametrize("mutate, expected", [
    (lambda b: b["nav"][0].update(id='x" onmouseover="alert(1)'), "id section"),
    (lambda b: b["nav"][0].update(icon='x"/><img src=x onerror=alert(1)>'), "biểu tượng section"),
    (lambda b: b["docs"]["p1/bai-01.md"].update(slug="bai/<script>"), "slug bài"),
    (lambda b: b["docs"]["p1/bai-01.md"].update(kind="lesson x"), "loại bài"),
], ids=["section-id", "section-icon", "doc-slug", "doc-kind"])
def test_identifiers_with_markup_characters_are_refused(client, mutate, expected):
    bad = copy.deepcopy(BUNDLE)
    mutate(bad)
    r = client.post(f"{BASE}/import", json=bad, headers=ADMIN)
    assert r.status_code == 400 and expected in r.json()["message"].lower(), r.text


def test_document_ids_with_markup_characters_are_refused(client):
    _import(client)
    r = client.put(f"{BASE}/demo/docs/a%22b.md", json={"md": "# X"}, headers=ADMIN)
    assert r.status_code == 400 and "id bài" in r.json()["message"].lower()
    assert client.put(f"{BASE}/demo/docs/ghi-chú/bài-1.md", json={"md": "# Vietnamese ids are fine"},
                      headers=ADMIN).status_code == 200


def test_search_bounds_the_work_a_query_can_ask_for(client):
    """One-letter terms are dropped and repeats collapse: 'a ' x 99 used to
    cost 37 s on the AI course; now it asks for nothing."""
    _import(client)
    assert client.get(f"{BASE}/demo/search", params={"q": "a " * 99}).json()["hits"] == []
    hits = client.get(f"{BASE}/demo/search", params={"q": "a gradient gradient GRADIENT"}).json()["hits"]
    assert hits and hits[0]["id"] == "p1/bai-01.md"
    again = client.get(f"{BASE}/demo/search", params={"q": "a gradient gradient GRADIENT"}).json()["hits"]
    assert again == hits, "a repeated query is answered from the cache, identically"


def test_sqladmin_edits_to_groups_and_sections_change_the_revision(client):
    """Renaming a group or deleting a section in sqladmin must invalidate the
    browser's manifest exactly like an API edit does."""
    from src.adapter.input import admin as admin_views

    _import(client)
    etag = client.get(f"{BASE}/demo/manifest").headers["etag"]

    async def rename_group():
        session = get_async_session()
        try:
            group = (await session.execute(
                select(CourseGroupEntity).where(CourseGroupEntity.short == "P2"))).scalar_one()
            view, request = admin_views.CourseGroupAdmin(), SimpleNamespace(state=SimpleNamespace())
            await view.on_model_change({}, group, False, request)
            group.title = "Phần 2 — Đổi tên"
            await session.commit()
            await view.after_model_change({}, group, False, request)
        finally:
            await session.close()

    client.portal.call(rename_group)
    m = client.get(f"{BASE}/demo/manifest", headers={"If-None-Match": etag})
    assert m.status_code == 200 and m.json()["nav"][0]["groups"][1]["title"] == "Phần 2 — Đổi tên"
    etag = m.headers["etag"]

    async def delete_section():
        session = get_async_session()
        try:
            section = (await session.execute(
                select(CourseSectionEntity).where(CourseSectionEntity.sec_id == "tai-lieu"))).scalar_one()
            view, request = admin_views.CourseSectionAdmin(), SimpleNamespace(state=SimpleNamespace())
            await view.on_model_delete(section, request)
            await session.delete(section)
            await session.commit()
            await view.after_model_delete(section, request)
        finally:
            await session.close()

    client.portal.call(delete_section)
    m = client.get(f"{BASE}/demo/manifest", headers={"If-None-Match": etag})
    assert m.status_code == 200 and [s["id"] for s in m.json()["nav"]] == ["khoa-hoc"]


# ------------------------------------------------------------- real bundles

COURSE_CONTENT = Path(__file__).resolve().parents[5] / "course-content"


@pytest.mark.parametrize("path", sorted(COURSE_CONTENT.glob("*.json")) or [None],
                         ids=lambda p: p.stem if p else "none")
def test_every_checked_in_course_bundle_imports_and_serves_a_light_manifest(client, path):
    if path is None:
        pytest.skip("no bundles in backend/course-content/")
    bundle = json.loads(path.read_text(encoding="utf-8"))
    course = _import(client, bundle)
    slug = course["slug"]
    assert course["docCount"] == len(bundle["docs"])

    manifest = client.get(f"{BASE}/{slug}/manifest")
    # The manifest must leave ALL markdown behind: it has to fit in what the
    # bundle weighs without its markdown. (A fixed ratio would not do — OPIc's
    # documents are short scripts, so markdown is a small share of its bundle.)
    raw = len(json.dumps(bundle, ensure_ascii=False).encode("utf-8"))
    md_bytes = sum(len((d.get("md") or "").encode("utf-8")) for d in bundle["docs"].values())
    assert len(manifest.content) <= raw - md_bytes, "the manifest must not carry markdown"
    m = manifest.json()
    assert m["order"] == [i for s in bundle["nav"] for g in s["groups"] for i in g["items"]] + \
        [d for d in bundle["docs"] if d not in {i for s in bundle["nav"] for g in s["groups"] for i in g["items"]}]

    first = m["order"][0]
    assert client.get(f"{BASE}/{slug}/docs/{first}").json()["md"] == bundle["docs"][first]["md"]
