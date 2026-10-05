#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Vẽ biểu tượng cài đặt (PWA) cho Quản lý chi tiêu từ favicon SVG trong index.html.

    backend\\fastapi\\.venv\\Scripts\\python.exe quan-ly-chi-tieu\\tao-bieu-tuong.py

Ghi vào assets/ của ứng dụng:
  icon-192.png, icon-512.png   biểu tượng thường (nền trong suốt, bo góc theo favicon)
  icon-maskable.png            nền tràn viền, hình thu vào 70% — Android cắt theo hình tròn / giọt nước
  apple-touch-icon.png         180×180 nền tràn viền — iOS tự bo góc và không chịu nền trong suốt

Đổi favicon thì chạy lại. Cần playwright + Edge/Chrome/Chromium (đã có cho selftest).
Bố cục theo courses/engine/tao_pwa.py, nhưng không dùng lại được: bản đó gắn cứng vào thư mục courses/.
"""
import io
import os
import re
import sys
from urllib.parse import unquote

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(os.path.dirname(HERE), "backend", "fastapi", "webapp", "tranphuc8a", "quan-ly-chi-tieu")

# (tên tệp, cạnh, kiểu): "trong" = nền trong suốt; "tran" = nền tràn viền, hình thu vào 70%
BIEU_TUONG = [("icon-192.png", 192, "trong"), ("icon-512.png", 512, "trong"),
              ("icon-maskable.png", 512, "tran"), ("apple-touch-icon.png", 180, "tran")]


def favicon():
    """(href data: nguyên văn, svg đã giải mã) của <link rel="icon"> trong index.html."""
    with io.open(os.path.join(APP, "index.html"), encoding="utf-8") as f:
        m = re.search(r'<link rel="icon" href="(data:image/svg\+xml,[^"]+)"', f.read())
    if not m:
        raise SystemExit('index.html không có favicon SVG (<link rel="icon" href="data:image/svg+xml,...">)')
    return m.group(1), unquote(m.group(1).split(",", 1)[1])


def mau_nen(svg):
    m = re.search(r"<rect[^>]*\bfill=['\"](#[0-9a-fA-F]{3,8})['\"]", svg)
    return m.group(1).lower() if m else "#2459d8"


def mo_trinh_duyet(pw):
    for kw in ({"channel": "msedge"}, {"channel": "chrome"}, {}):
        try:
            return pw.chromium.launch(**kw)
        except Exception:
            continue
    raise SystemExit("Không tìm thấy Edge/Chrome/Chromium cho Playwright")


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    from playwright.sync_api import sync_playwright
    href, svg = favicon()
    nen = mau_nen(svg)
    with sync_playwright() as pw:
        br = mo_trinh_duyet(pw)
        pg = br.new_page(device_scale_factor=1)
        try:
            for ten, n, kieu in BIEU_TUONG:
                if kieu == "tran":
                    k = round(n * 0.7)  # vùng an toàn của maskable là hình tròn đường kính 80%
                    html = ('<body style="margin:0"><div style="width:%dpx;height:%dpx;background:%s;display:grid;place-items:center">'
                            '<img src="%s" width="%d" height="%d" style="display:block"></div>' % (n, n, nen, href, k, k))
                else:
                    html = '<body style="margin:0"><img src="%s" width="%d" height="%d" style="display:block">' % (href, n, n)
                pg.set_viewport_size({"width": n, "height": n})
                pg.set_content(html)
                pg.wait_for_function("() => [...document.images].every(i => i.complete && i.naturalWidth > 0)")
                pg.screenshot(path=os.path.join(APP, "assets", ten), omit_background=(kieu == "trong"))
                print("  [ghi] assets/%s (%dx%d)" % (ten, n, n))
        finally:
            br.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
