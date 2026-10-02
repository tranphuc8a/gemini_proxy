"""Editing courses safely: what the QA pass of the management page asked for.

Each test names the finding or the feature it pins down (QA-xx in
docs/kiem-thu-quan-ly-khoa-hoc.md): saves that cannot silently overwrite each
other, history and trash so a click cannot lose work, addresses that survive a
rename, files uploaded to a course, link checking, templates and copies, size
and login limits — with messages a Vietnamese editor can read.
"""

from __future__ import annotations

import base64
import copy

import pytest

from src.adapter.input.controllers import course_controller
from src.application.config.config import settings
from test_course_controller import ADMIN, BASE, BUNDLE, _import, client  # noqa: F401  (fixture)

PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")


@pytest.fixture(autouse=True)
def _fresh_login_limits():
    course_controller.reset_login_limits()
    yield
    course_controller.reset_login_limits()


def _doc(client, doc_id="p1/bai-02.md"):
    r = client.get(f"{BASE}/demo/docs/{doc_id}", headers=ADMIN)
    assert r.status_code == 200, r.text
    return r.json()


def _put(client, doc_id, body, **headers):
    return client.put(f"{BASE}/demo/docs/{doc_id}", json=body, headers=dict(ADMIN, **headers))


# ------------------------------------------------------- QA-01: no silent overwrite

def test_a_stale_save_is_refused_with_the_current_version(client):
    _import(client)
    loaded = _doc(client)
    assert loaded["rev"]
    first = _put(client, "p1/bai-02.md", {"md": "# Xác suất\n\nBản của A.\n"}, **{"If-Match": loaded["rev"]})
    assert first.status_code == 200 and first.json()["rev"] != loaded["rev"]

    stale = _put(client, "p1/bai-02.md", {"md": "# Xác suất\n\nBản của B.\n"}, **{"If-Match": f'"{loaded["rev"]}"'})
    assert stale.status_code == 409
    body = stale.json()
    assert "nơi khác" in body["message"] and "Bản của A" in body["data"]["current"]["md"]
    assert "Bản của A" in _doc(client)["md"], "the newer version is untouched"

    forced = _put(client, "p1/bai-02.md", {"md": "# Xác suất\n\nB ghi đè có chủ ý.\n"})
    assert forced.status_code == 200, "without If-Match a save still goes through (CLI, scripts)"


def test_creating_a_document_never_replaces_an_existing_one(client):
    _import(client)
    r = _put(client, "p1/bai-02.md", {"md": "# Trùng"}, **{"If-None-Match": "*"})
    assert r.status_code == 409 and "Đã có bài" in r.json()["message"]
    assert _put(client, "p1/moi.md", {"md": "# Mới"}, **{"If-None-Match": "*"}).status_code == 200


def test_the_tree_and_the_course_information_have_their_own_fingerprints(client):
    _import(client)
    course = client.get(f"{BASE}/demo", headers=ADMIN).json()
    tree, info = course["treeRev"], course["infoRev"]

    nav = course["nav"]
    nav[0]["groups"].reverse()
    assert client.put(f"{BASE}/demo/structure", json={"nav": nav},
                      headers=dict(ADMIN, **{"If-Match": tree})).status_code == 200
    stale = client.put(f"{BASE}/demo/structure", json={"nav": course["nav"]}, headers=dict(ADMIN, **{"If-Match": tree}))
    assert stale.status_code == 409 and stale.json()["data"]["current"]["nav"][0]["groups"][0]["short"] == "P2"

    # A document edit (even a slug change, which records an alias in the config)
    # is not an edit of the course information.
    _put(client, "p1/bai-01.md", {"slug": "bai/p1-bai-01-moi"})
    ok = client.patch(f"{BASE}/demo", json={"subtitle": "Phụ đề mới"}, headers=dict(ADMIN, **{"If-Match": info}))
    assert ok.status_code == 200
    stale = client.patch(f"{BASE}/demo", json={"subtitle": "Khác"}, headers=dict(ADMIN, **{"If-Match": info}))
    assert stale.status_code == 409 and stale.json()["data"]["current"]["subtitle"] == "Phụ đề mới"


# ------------------------------------------------------- history and trash

def test_each_save_keeps_the_version_it_replaced(client):
    _import(client)
    _put(client, "p1/bai-02.md", {"md": "# Xác suất\n\nLần 1.\n"})
    _put(client, "p1/bai-02.md", {"md": "# Xác suất\n\nLần 1.\n"})          # no change: no new version
    _put(client, "p1/bai-02.md", {"md": "# Xác suất\n\nLần 2.\n"})
    revs = client.get(f"{BASE}/demo/history", params={"doc": "p1/bai-02.md"}, headers=ADMIN).json()["revisions"]
    assert [r["action"] for r in revs] == ["sua", "sua"]
    newest = client.get(f"{BASE}/demo/history/{revs[0]['id']}", headers=ADMIN).json()
    oldest = client.get(f"{BASE}/demo/history/{revs[1]['id']}", headers=ADMIN).json()
    assert "Lần 1" in newest["md"] and "Phân phối chuẩn" in oldest["md"], "newest first; the original kept"
    assert client.get(f"{BASE}/demo/history", params={"doc": "p1/bai-02.md"}).status_code == 403


def test_history_is_capped_per_document(client, monkeypatch):
    from src.adapter.output.mysql.repositories import course_repository
    monkeypatch.setattr(course_repository, "REVISIONS_KEPT", 3)
    _import(client)
    for i in range(6):
        _put(client, "p1/bai-02.md", {"md": f"# Xác suất\n\nLần {i}.\n"})
    revs = client.get(f"{BASE}/demo/history", params={"doc": "p1/bai-02.md"}, headers=ADMIN).json()["revisions"]
    assert len(revs) == 3


def test_a_deleted_document_comes_back_where_it_was(client):
    _import(client)
    assert client.delete(f"{BASE}/demo/docs/p1/bai-02.md", headers=ADMIN).json()["trash"] is True
    trash = client.get(f"{BASE}/trash", headers=ADMIN).json()
    entry = [d for d in trash["docs"] if d["docId"] == "p1/bai-02.md"][0]
    assert entry["courseSlug"] == "demo" and entry["placement"] == {"section": "khoa-hoc", "group": "P1"}

    r = client.post(f"{BASE}/demo/trash/{entry['id']}/restore", headers=ADMIN)
    assert r.status_code == 200 and r.json()["group"] == "P1"
    m = client.get(f"{BASE}/demo/manifest").json()
    assert m["nav"][0]["groups"][0]["items"] == ["p1/bai-01.md", "p1/bai-02.md"]
    assert client.post(f"{BASE}/demo/trash/{entry['id']}/restore", headers=ADMIN).status_code == 404


def test_a_deleted_course_waits_in_the_trash_with_its_files(client):
    _import(client)
    client.put(f"{BASE}/demo/assets/hinh.png", content=PNG, headers=dict(ADMIN, **{"Content-Type": "image/png"}))
    assert client.delete(f"{BASE}/demo", headers=ADMIN).status_code == 200
    item = client.get(f"{BASE}/trash", headers=ADMIN).json()["courses"][0]
    assert item["slug"] == "demo" and item["docCount"] == 5

    client.post(BASE, json={"slug": "demo", "title": "Khoá khác chiếm slug"}, headers=ADMIN)
    taken = client.post(f"{BASE}/trash/courses/{item['id']}/restore", json={}, headers=ADMIN)
    assert taken.status_code == 409 and taken.json()["data"]["slugTaken"] == "demo"

    back = client.post(f"{BASE}/trash/courses/{item['id']}/restore", json={"slug": "demo-cu"}, headers=ADMIN)
    assert back.status_code == 200 and back.json()["docCount"] == 5
    assert client.get(f"{BASE}/demo-cu/assets/hinh.png").content == PNG
    assert client.get(f"{BASE}/trash", headers=ADMIN).json()["courses"] == []


def test_replacing_a_course_by_import_keeps_a_backup(client):
    _import(client)
    smaller = copy.deepcopy(BUNDLE)
    del smaller["docs"]["phu-luc.md"]
    _import(client, smaller)
    courses = client.get(f"{BASE}/trash", headers=ADMIN).json()["courses"]
    assert [c["docCount"] for c in courses] == [5], "the replaced version, all five documents"
    assert client.delete(f"{BASE}/trash/courses/{courses[0]['id']}", headers=ADMIN).status_code == 200


# ------------------------------------------------------- QA-09: addresses survive a rename

def test_a_changed_slug_keeps_the_old_address(client):
    _import(client)
    _put(client, "p1/bai-01.md", {"slug": "bai/gradient"})
    m = client.get(f"{BASE}/demo/manifest").json()
    assert m["slugs"]["bai/gradient"] == "p1/bai-01.md"
    assert m["aliases"] == {"bai/p1-bai-01": "p1/bai-01.md"}
    assert "slugAliases" not in client.get(f"{BASE}/demo", headers=ADMIN).json()["config"], "hidden from the editor"

    _put(client, "p1/bai-01.md", {"slug": "bai/p1-bai-01"})          # back: a real slug again, not an alias
    assert client.get(f"{BASE}/demo/manifest").json()["aliases"] == {"bai/gradient": "p1/bai-01.md"}
    client.delete(f"{BASE}/demo/docs/p1/bai-01.md", headers=ADMIN)
    assert client.get(f"{BASE}/demo/manifest").json()["aliases"] == {}


def test_renaming_a_document_id_keeps_its_place_history_and_learners(client):
    _import(client)
    _put(client, "p1/bai-01.md", {"md": "# Gradient và tối ưu\n\nSửa một lần.\n"})
    r = client.post(f"{BASE}/demo/rename", json={"from": "p1/bai-01.md", "to": "p1/gradient.md"}, headers=ADMIN)
    assert r.status_code == 200 and r.json()["id"] == "p1/gradient.md"
    m = client.get(f"{BASE}/demo/manifest").json()
    assert m["order"][0] == "p1/gradient.md" and m["idAliases"] == {"p1/bai-01.md": "p1/gradient.md"}
    revs = client.get(f"{BASE}/demo/history", params={"doc": "p1/gradient.md"}, headers=ADMIN).json()["revisions"]
    assert len(revs) == 1, "history follows the new id"

    taken = client.post(f"{BASE}/demo/rename", json={"from": "p1/gradient.md", "to": "p1/bai-02.md"}, headers=ADMIN)
    assert taken.status_code == 409 and "Đã có bài" in taken.json()["message"]
    again = client.post(f"{BASE}/demo/rename", json={"from": "p1/gradient.md", "to": "p1/gd.md"}, headers=ADMIN)
    assert again.status_code == 200
    assert client.get(f"{BASE}/demo/manifest").json()["idAliases"] == \
        {"p1/bai-01.md": "p1/gd.md", "p1/gradient.md": "p1/gd.md"}, "a chain of renames collapses"


# ------------------------------------------------------- QA-20: links

def test_the_link_checker_finds_dead_links_and_who_points_where(client):
    _import(client)
    _put(client, "p2/bai-01.md", {"md": "# Học sâu\n\n[Trước](../p1/bai-01.md) · [Mất](../p1/khong-co.md) · "
                                        "[Slug](#/bai/p1-bai-02) · [Slug hỏng](#/bai/khong-co) · "
                                        "![](assets/khong-co.png) · [Web](https://example.com)\n\n"
                                        "```md\n[trong code](khong-tinh.md)\n```\n"})
    r = client.get(f"{BASE}/demo/links", headers=ADMIN).json()
    assert sorted(b["href"] for b in r["broken"]) == ["#/bai/khong-co", "../p1/khong-co.md", "assets/khong-co.png"]
    assert all(b["from"] == "p2/bai-01.md" and b["fromTitle"] == "Học sâu" for b in r["broken"])
    assert r["inbound"]["p1/bai-01.md"] == ["p2/bai-01.md"] and r["inbound"]["p1/bai-02.md"] == ["p2/bai-01.md"]


# ------------------------------------------------------- files

def test_uploaded_files_are_served_like_the_course(client, monkeypatch):
    _import(client)
    up = client.put(f"{BASE}/demo/assets/Ảnh Chụp (1).PNG", content=PNG, headers=ADMIN)
    assert up.status_code == 201 and up.json()["name"] == "anh-chup-1.png"
    assert up.json()["markdown"] == "![](assets/anh-chup-1.png)"
    _put(client, "p1/bai-01.md", {"md": "# Gradient và tối ưu\n\n![hình](assets/anh-chup-1.png)\n"})
    listing = client.get(f"{BASE}/demo/assets", headers=ADMIN).json()["assets"]
    assert listing[0]["usedBy"] == ["p1/bai-01.md"]

    got = client.get(f"{BASE}/demo/assets/anh-chup-1.png")
    assert got.status_code == 200 and got.content == PNG and got.headers["content-type"] == "image/png"
    assert got.headers["x-content-type-options"] == "nosniff"
    assert client.get(f"{BASE}/demo/assets/anh-chup-1.png", headers={"If-None-Match": got.headers["etag"]}).status_code == 304

    svg = client.put(f"{BASE}/demo/assets/ve.svg", content=b"<svg xmlns='http://www.w3.org/2000/svg'/>", headers=ADMIN)
    assert svg.status_code == 201
    assert "sandbox" in client.get(f"{BASE}/demo/assets/ve.svg").headers["content-security-policy"]
    bad = client.put(f"{BASE}/demo/assets/trang.html", content=b"<script>alert(1)</script>", headers=ADMIN)
    assert bad.status_code == 400 and "loại tệp" in bad.json()["message"]
    monkeypatch.setattr(settings, "COURSE_ASSET_MAX_BYTES", 10, raising=False)
    assert client.put(f"{BASE}/demo/assets/to.png", content=PNG, headers=ADMIN).status_code == 413

    client.patch(f"{BASE}/demo", json={"published": False}, headers=ADMIN)
    assert client.get(f"{BASE}/demo/assets/anh-chup-1.png").status_code == 404, "a draft's files are not public"
    assert client.get(f"{BASE}/demo/assets/anh-chup-1.png", headers=ADMIN).status_code == 200
    assert client.delete(f"{BASE}/demo/assets/anh-chup-1.png", headers=ADMIN).status_code == 200
    assert client.get(f"{BASE}/demo/assets/anh-chup-1.png", headers=ADMIN).status_code == 404


def test_export_carries_the_files_and_import_brings_them_back(client):
    _import(client)
    client.put(f"{BASE}/demo/assets/hinh.png", content=PNG, headers=ADMIN)
    bundle = client.get(f"{BASE}/demo/export", headers=ADMIN).json()
    assert base64.b64decode(bundle["assets"]["hinh.png"]["data"]) == PNG
    _import(client, bundle, slug="demo-2")
    assert client.get(f"{BASE}/demo-2/assets/hinh.png").content == PNG


# ------------------------------------------------------- templates and copies

def test_a_new_course_can_start_from_a_template(client):
    r = client.post(BASE, json={"slug": "mau", "title": "Khoá mẫu", "template": "co-ban"}, headers=ADMIN)
    assert r.status_code == 201
    body = r.json()
    assert [s["id"] for s in body["nav"]] == ["khoa-hoc", "tai-lieu"] and body["docCount"] == 6
    intro = client.get(f"{BASE}/mau/docs/gioi-thieu/README.md").json()
    assert intro["title"] == "Giới thiệu Khoá mẫu" and "## Mục tiêu" in intro["md"]
    bad = client.post(BASE, json={"slug": "mau-2", "title": "X", "template": "khong-co"}, headers=ADMIN)
    assert bad.status_code == 400 and "mẫu" in bad.json()["message"]


def test_duplicating_a_course_gives_a_draft_copy(client):
    bundle = copy.deepcopy(BUNDLE)
    bundle["course"]["config"] = {"webapp": "courses/demo-course"}
    _import(client, bundle)
    client.put(f"{BASE}/demo/assets/hinh.png", content=PNG, headers=ADMIN)
    r = client.post(f"{BASE}/demo/duplicate", json={"slug": "demo-ban-sao"}, headers=ADMIN)
    assert r.status_code == 201
    copy_ = r.json()
    assert copy_["published"] is False and copy_["title"] == "Khoá thử nghiệm (bản sao)" and copy_["docCount"] == 5
    assert "webapp" not in copy_["config"], "the custom page belongs to the original"
    assert client.get(f"{BASE}/demo-ban-sao/assets/hinh.png", headers=ADMIN).content == PNG
    assert client.post(f"{BASE}/demo/duplicate", json={"slug": "demo"}, headers=ADMIN).status_code == 409


# ------------------------------------------------------- limits and messages

def test_one_lesson_has_a_size_limit_with_a_readable_message(client, monkeypatch):
    _import(client)
    monkeypatch.setattr(settings, "COURSE_DOC_MAX_BYTES", 1000, raising=False)
    r = _put(client, "p1/bai-02.md", {"md": "x" * 2000})
    assert r.status_code == 413 and "tách thành nhiều bài" in r.json()["message"]


def test_guessing_the_admin_key_is_slowed_down(client):
    for _ in range(5):
        assert client.post(f"{BASE}/admin/verify", headers={"X-Admin-Key": "sai"}).status_code == 403
    r = client.post(f"{BASE}/admin/verify", headers={"X-Admin-Key": "sai"})
    assert r.status_code == 429 and int(r.headers["retry-after"]) > 0 and r.json()["data"]["code"] == "too_many_attempts"
    assert client.post(f"{BASE}/admin/verify", headers=ADMIN).status_code == 429, "the address waits, right key or not"
    other = client.post(f"{BASE}/admin/verify", headers=dict(ADMIN, **{"X-Forwarded-For": "203.0.113.9"}))
    assert other.status_code == 200, "another address is not punished"


def test_messages_are_in_vietnamese(client):
    assert client.post(BASE, json={"slug": "x", "title": " "}, headers=ADMIN).json()["message"] == "Khoá học cần tiêu đề"
    assert "từ dành riêng" in client.post(BASE, json={"slug": "trash", "title": "X"}, headers=ADMIN).json()["message"]
    r = client.post(BASE, json={"slug": "x", "title": "X"})
    assert r.status_code == 403 and r.json()["data"]["code"] == "admin_required" and "khoá quản trị" in r.json()["message"]
