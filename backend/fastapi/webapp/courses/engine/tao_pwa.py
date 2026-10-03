#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Sinh manifest.webmanifest + bieu tuong cai dat cho cac trang doc offline.

Trang dich: nhom "pwa" trong dong-bo.json — cung nhung trang nhan pwa.js + sw.js.
Moi trang duoc:
  · manifest.webmanifest     (goc trang) ten + mo ta lay tu metadata.json — dung ten
                             portal dang hien; theme_color = mau nen cua favicon
  · assets/icon-192.png, assets/icon-512.png
                             ve lai tu favicon SVG trong index.html (Chromium chup)
  · assets/icon-maskable.png nen tran vien cung mau, hinh thu vao giua — Android cat
                             bieu tuong theo hinh tron / giot nuoc ma khong mat net

    python engine/tao_pwa.py               # moi trang
    python engine/tao_pwa.py opic-course   # mot trang

Doi favicon hay metadata.json thi chay lai; kiem_pwa.tinh() (check.py moi trang)
bao manifest lech. Ve bieu tuong can playwright + Chromium.
"""
import io
import json
import os
import re
import sys
from urllib.parse import unquote

HERE = os.path.dirname(os.path.abspath(__file__))
COURSES = os.path.dirname(HERE)

# Ten duoi bieu tuong tren man hinh chinh (nen ngan, ~12 ky tu). Thieu thi cat tu tieu de.
TEN_NGAN = {
    "ai-everything-course": "Khoá học AI",
    "heuristic-course": "Heuristic",
    "heuristic-course-2": "Heuristic 2",
    "system-design-course": "System Design",
    "khoa-hoc": "Khoá học",
    "opic-course": "OPIc",
    "lab-visual": "Web Lab",
}
# heuristic-course-2 dung chung metadata.json voi heuristic-course — hai ung dung cai vao
# may phai khac ten.
TEN = {"heuristic-course-2": "Học Heuristic (bản 2)"}

BIEU_TUONG = [("icon-192.png", 192, "any"), ("icon-512.png", 512, "any"), ("icon-maskable.png", 512, "maskable")]


def cac_trang():
    sys.path.insert(0, HERE)
    import sync
    return list((sync.doc_cau_hinh().get("pwa") or {}).get("dich", []))


def favicon(trang):
    """(href data: nguyen van, svg da giai ma) cua <link rel="icon"> trong index.html."""
    with io.open(os.path.join(COURSES, trang, "index.html"), encoding="utf-8") as f:
        m = re.search(r'<link rel="icon" href="(data:image/svg\+xml,[^"]+)"', f.read())
    if not m:
        raise ValueError('%s/index.html khong co favicon SVG (<link rel="icon" href="data:image/svg+xml,...">)' % trang)
    return m.group(1), unquote(m.group(1).split(",", 1)[1])


def mau_nen(svg):
    m = re.search(r"<rect[^>]*\bfill=['\"](#[0-9a-fA-F]{3,8})['\"]", svg)
    return m.group(1).lower() if m else "#3b5bdb"


def manifest_cua(trang):
    with io.open(os.path.join(COURSES, trang, "metadata.json"), encoding="utf-8") as f:
        meta = json.load(f)
    ten = TEN.get(trang) or meta["title"]
    return {
        "name": ten,
        "short_name": TEN_NGAN.get(trang) or ten.split(" — ")[0][:12],
        "description": meta.get("description", ""),
        "lang": "vi",
        # Khong dat "id": no tinh theo goc origin, moi trang se trung mot id. Mac dinh
        # id = start_url — rieng tung trang.
        "start_url": "./",
        "scope": "./",
        "display": "standalone",
        "background_color": "#ffffff",
        "theme_color": mau_nen(favicon(trang)[1]),
        "icons": [{"src": "assets/" + f, "sizes": "%dx%d" % (n, n), "type": "image/png", "purpose": p}
                  for f, n, p in BIEU_TUONG],
    }


def ghi_manifest(trang):
    with io.open(os.path.join(COURSES, trang, "manifest.webmanifest"), "w", encoding="utf-8") as f:
        f.write(json.dumps(manifest_cua(trang), ensure_ascii=False, indent=2) + "\n")


def ve_bieu_tuong(br, trang):
    href, svg = favicon(trang)
    nen = mau_nen(svg)
    hinh = '<img src="%s" width="%d" height="%d" style="display:block">'
    pg = br.new_page(device_scale_factor=1)
    try:
        for ten, n, muc_dich in BIEU_TUONG:
            if muc_dich == "maskable":
                # vung an toan la hinh tron duong kinh 80% — hinh 70% nam gon trong do
                k = round(n * 0.7)
                html = ('<body style="margin:0"><div style="width:%dpx;height:%dpx;background:%s;display:grid;'
                        'place-items:center">%s</div>' % (n, n, nen, hinh % (href, k, k)))
            else:
                html = '<body style="margin:0">' + hinh % (href, n, n)
            pg.set_viewport_size({"width": n, "height": n})
            pg.set_content(html)
            pg.wait_for_function("() => [...document.images].every(i => i.complete && i.naturalWidth > 0)")
            pg.screenshot(path=os.path.join(COURSES, trang, "assets", ten), omit_background=True)
    finally:
        pg.close()


def main(argv):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    trang = [a for a in argv if not a.startswith("-")] or cac_trang()
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        br = p.chromium.launch()
        try:
            for t in trang:
                ghi_manifest(t)
                ve_bieu_tuong(br, t)
                print("  [ghi] %s/manifest.webmanifest + %s" % (t, ", ".join("assets/" + f for f, _n, _p in BIEU_TUONG)))
        finally:
            br.close()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
