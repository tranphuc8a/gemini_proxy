#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kiem tra Thu vien khoa hoc (trang doc CHUNG) tren FastAPI that + SQLite tam + Chromium.

    python check.py            # can playwright + venv backend/fastapi/.venv
    python check.py --anh      # chup anh vao _shots/

Tinh huong cua nguoi dung: tao mot khoa MOI qua API (y nhu trang Quan ly), khong
dung thu muc nao trong webapp/ — khoa do phai doc duoc ngay o
/webapp/courses/khoa-hoc/?khoa=<slug> va co mat trong danh muc. Kem theo:
config.webapp tro vao thu muc khong ton tai khong lam hong link; khoa co trang
rieng thi danh muc tro sang trang rieng; ban nhap an voi khach, hien voi quan tri
vien (token phien cua trang Quan ly); slug khong co -> trang bao loi co huong dan.

Tra exit code khac 0 khi co loi.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "engine"))
import kiem_khoa_hoc as K  # noqa: E402

B = K.BaoCao()
ok, sai = B.ok, B.sai

KHOA_MOI = "test-course"
TIEU_DE = "Test khóa học"


def goi(may, method, duong, body=None, headers=None):
    h = {"Content-Type": "application/json", "X-Admin-Key": may.khoa_admin}
    h.update(headers or {})
    req = urllib.request.Request(may.api + duong, method=method, headers=h,
                                 data=None if body is None else json.dumps(body).encode("utf-8"))
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read().decode("utf-8") or "null")
    except urllib.error.HTTPError as e:
        return e.code, None


def tang_1():
    print("TANG 1 — tinh")
    html = open(os.path.join(HERE, "index.html"), encoding="utf-8").read()
    a, b = html.find('src="assets/cau-hinh.js"'), html.find('src="assets/thu-vien.js"')
    (ok if 0 < a < b and 'src="assets/app.js"' not in html else sai)(
        "index.html nap cau-hinh.js -> thu-vien.js (thu-vien.js moi quyet dinh nap engine)")
    import sync                                           # courses/engine/sync.py (sys.path o tren)
    for ten in ("app.js", "app.css"):
        try:
            ban = open(os.path.join(HERE, "assets", ten), encoding="utf-8", newline="").read()
        except OSError:
            ban = ""
        (ok if ban == sync.noi_dung_dich(ten) else sai)("assets/%s khop courses/engine/ (engine/sync.py)" % ten)
    json.load(open(os.path.join(HERE, "metadata.json"), encoding="utf-8"))
    ok("metadata.json doc duoc (trang hien trong portal)")
    for ten in ("cau-hinh.js", "thu-vien.js", "app.js"):
        r = subprocess.run(["node", "--check", os.path.join(HERE, "assets", ten)], capture_output=True, text=True)
        (ok if r.returncode == 0 else sai)("cu phap assets/%s" % ten)


def tang_2(chup):
    print("\nTANG 2 — FastAPI that + SQLite tam + Chromium")
    try:
        from playwright.sync_api import sync_playwright
    except Exception:
        B.bo_qua("chua cai playwright")
        return
    may = K.MayChuThu([os.path.join(K.CONTENT, "system-design.json")]).__enter__()
    anh = os.path.join(HERE, "_shots")
    try:
        # Khoa moi y nhu nguoi dung tao o trang Quan ly: co config.webapp tro vao
        # thu muc KHONG ton tai, mot section, mot nhom, mot bai.
        st, _ = goi(may, "POST", "/courses", {"slug": KHOA_MOI, "title": TIEU_DE, "subtitle": "khoá tạo ở trang quản lý",
                                               "icon": "🧪", "published": True, "config": {"webapp": "courses/test"}})
        nav = [{"id": "chinh", "title": "Chính", "groups": [{"title": "Phần mở đầu", "short": "P1", "items": []}]}]
        st2, _ = goi(may, "PUT", "/courses/%s/structure" % KHOA_MOI, {"nav": nav})
        st3, _ = goi(may, "PUT", "/courses/%s/docs/p1/bai-mot.md" % KHOA_MOI,
                     {"md": "# Bài một\n\n## Mục đầu\n\nNội dung bài một về **tối ưu tham lam**.\n",
                      "section": "chinh", "group": "P1"})
        st4, _ = goi(may, "POST", "/courses", {"slug": "nhap-thu", "title": "Khoá nháp", "published": False})
        (ok if (st, st2, st3, st4) == (201, 200, 200, 201) else sai)(
            "tao khoa moi + cay + bai, va mot khoa nhap qua API (%s)" % ((st, st2, st3, st4),))
        _, tok = goi(may, "POST", "/courses/admin/verify")
        token = (tok or {}).get("session")

        goc = may.goc + "/webapp/courses/khoa-hoc/"
        loi = []
        with sync_playwright() as pw:
            br = pw.chromium.launch()
            pg = br.new_page(viewport={"width": 1280, "height": 860})
            # Hai 404 la CO Y (khoa khong ton tai, ban nhap khi chua dang nhap); bo qua dung chung theo URL.
            # Moi 404 khac la loi — ke ca khi tham do trang rieng (danh muc dung /webapp/_api/list, khong tham do).
            pg.on("console", lambda m: loi.append(m.text) if m.type == "error" and not (
                "404" in m.text and ("khong-co-khoa" in (m.location or {}).get("url", "") or
                                     "nhap-thu" in (m.location or {}).get("url", ""))) else None)
            pg.on("pageerror", lambda e: loi.append("pageerror: %s" % e))

            # 1. danh muc: khoa moi co mat; trang rieng co that -> tro sang do; config.webapp hong -> trang chung
            pg.goto(goc + "?theme=light")
            pg.wait_for_selector(".grid .card")
            the = pg.evaluate("() => Object.fromEntries([...document.querySelectorAll('.grid .card')]"
                              ".map(a => [a.dataset.slug, a.getAttribute('href')]))")
            (ok if (the.get(KHOA_MOI) or "").split("&")[0] == "?khoa=" + KHOA_MOI else sai)(
                "danh muc: khoa moi tro vao trang doc chung (?khoa=%s), bo qua config.webapp hong — %r" % (KHOA_MOI, the.get(KHOA_MOI)))
            (ok if the.get("system-design") == "/webapp/courses/system-design-course/" else sai)(
                "danh muc: khoa co trang rieng tro sang trang rieng — %r" % the.get("system-design"))
            (ok if "nhap-thu" not in the else sai)("danh muc: ban nhap an voi khach")
            if chup:
                os.makedirs(anh, exist_ok=True)
                pg.screenshot(path=os.path.join(anh, "thu-vien.png"))

            # 2. doc khoa moi
            pg.click('.card[data-slug="%s"]' % KHOA_MOI)
            pg.wait_for_selector(".hero h1")
            kq = pg.evaluate("() => ({brand: document.querySelector('.brand-txt b').textContent,"
                             " mark: document.querySelector('#brandMark').textContent, title: document.title,"
                             " hero: document.querySelector('.hero h1').textContent,"
                             " nav: document.querySelectorAll('#sideNav .nav-i').length,"
                             " tim: document.querySelector('#btnSearch span').textContent})")
            (ok if kq["brand"] == TIEU_DE and kq["mark"] == "🧪" and TIEU_DE in kq["title"] and TIEU_DE in kq["hero"] else sai)(
                "trang doc: ten, bieu tuong, tieu de lay tu database (%s)" % kq)
            (ok if kq["nav"] == 1 and "1 tài liệu" in kq["tim"] else sai)("muc luc 1 bai, o tim kiem dem dung (%s)" % kq["tim"])
            pg.click("#sideNav .nav-i")
            pg.wait_for_function("() => { const b = document.querySelector('#body .prose');"
                                 " return b && b.textContent.includes('tham lam'); }", timeout=15000)
            ok("mo bai: markdown tai tu /docs/")
            pg.keyboard.press("Control+K")
            with pg.expect_response(lambda r: "/search?" in r.url, timeout=10000):
                pg.fill("#q", "tham lam")
            pg.wait_for_selector("#res .r-i mark", timeout=10000)
            ok("tim kiem phia server trong khoa moi")
            pg.keyboard.press("Escape")
            if chup:
                pg.screenshot(path=os.path.join(anh, "khoa-moi.png"))
            luu = pg.evaluate("() => Object.keys(localStorage).filter(k => k.startsWith('kh-%s.'))" % KHOA_MOI)
            (ok if luu else sai)("tien do cat rieng theo khoa (localStorage %s)" % luu[:3])

            # 3. slug khong co -> trang loi co huong dan
            pg.goto(goc + "?khoa=khong-co-khoa")
            pg.wait_for_selector(".hero h1")
            txt = pg.evaluate("() => document.querySelector('#main').textContent")
            (ok if "Không tải được khoá học" in txt and "bản nháp" in txt else sai)("khoa khong ton tai: trang loi co huong dan")

            # 4. ban nhap: khach -> loi; quan tri vien (token cua trang Quan ly) + &nhap=1 -> doc duoc
            pg.goto(goc + "?khoa=nhap-thu")
            pg.wait_for_selector(".hero h1")
            (ok if "Không tải được" in pg.evaluate("() => document.querySelector('.hero h1').textContent") else sai)(
                "ban nhap: khach khong xem duoc")
            pg.evaluate("t => localStorage.setItem('qlkh.phien@' + new URL('%s', location.href).href.replace(/\\/+$/, '') + '.token',"
                        " JSON.stringify(t))" % may.api_prefix, token)
            pg.goto(goc + "?khoa=nhap-thu&nhap=1")
            pg.wait_for_selector(".hero h1")
            (ok if "Khoá nháp" in pg.evaluate("() => document.querySelector('.hero h1').textContent") else sai)(
                "ban nhap: quan tri vien xem truoc duoc voi &nhap=1")
            pg.goto(goc)
            pg.wait_for_selector('.card[data-slug="nhap-thu"] .tv-tag.nhap')
            ok("danh muc cua quan tri vien co ban nhap (nhan 'nhap')")
            br.close()
        if loi:
            for l in loi[:8]:
                sai("console: " + l[:200])
        else:
            ok("khong co loi console / pageerror (ngoai hai 404 co y)")
    finally:
        may.__exit__(None, None, None)


def main():
    print("\nThu vien khoa hoc — trang doc chung")
    tang_1()
    if "--tinh" not in sys.argv:
        tang_2("--anh" in sys.argv)
    print()
    if B.loi:
        print(K.DO + "[HONG]" + K.HET + " %d loi" % len(B.loi))
        return 1
    print(K.XANH + "[DAT]" + K.HET + " 0 loi")
    return 0


if __name__ == "__main__":
    sys.exit(main())
