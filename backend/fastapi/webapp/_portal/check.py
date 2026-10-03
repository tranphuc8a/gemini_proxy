#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kiem tra portal: Ctrl+K "tim moi thu" (palette.js) tren FastAPI that + SQLite tam + Chromium.

    python check.py        # can playwright + venv backend/fastapi/.venv

  - cu phap portal.js, palette.js (node --check)
  - Ctrl+K mo bang lenh; go "bloom": bai hoc (tim tren server, moi khoa da xuat ban),
    lab (courses/lab-visual/danh-sach.json), Enter mo dung bai o trang rieng cua khoa
  - Hoi AI (Gemini GIA, quan tri vien): cau tra loi kem nguon tro toi bai
  - khach khi AI chi danh cho quan tri vien: KHONG co dong "Hoi AI"
  - khong loi console / pageerror

Tra exit code khac 0 khi co loi.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
COURSES = os.path.join(os.path.dirname(HERE), "courses")
sys.path.insert(0, os.path.join(COURSES, "engine"))
import kiem_khoa_hoc as K  # noqa: E402

B = K.BaoCao()
ok, sai = B.ok, B.sai


def tinh():
    print("TANG 1 — tinh")
    node = shutil.which("node")
    if not node:
        B.bo_qua("khong co Node — bo qua kiem cu phap")
        return
    for f in ("portal.js", "palette.js"):
        r = subprocess.run([node, "--check", os.path.join(HERE, f)], capture_output=True, text=True)
        (ok if r.returncode == 0 else sai)("cu phap " + f + ("" if r.returncode == 0 else ": " + r.stderr.strip()[-200:]))


def trinh_duyet():
    print("\nTANG 2 — FastAPI that + SQLite tam + Chromium")
    try:
        from playwright.sync_api import sync_playwright
    except Exception:
        B.bo_qua("chua cai playwright")
        return
    may = K.MayChuThu([os.path.join(K.CONTENT, "system-design.json")]).__enter__()
    loi = []
    try:
        url = may.goc + "/webapp/_portal/portal.html"
        with sync_playwright() as pw:
            br = pw.chromium.launch()
            pg = br.new_page(viewport={"width": 1280, "height": 860})
            pg.on("console", lambda m: loi.append(m.text) if m.type == "error" else None)
            pg.on("pageerror", lambda e: loi.append("pageerror: %s" % e))
            pg.goto(url, wait_until="load")
            pg.wait_for_selector(".app-card, .apps a", timeout=20000)

            # khach: AI chi danh cho quan tri vien -> khong co dong Hoi AI
            pg.keyboard.press("Control+K")
            pg.wait_for_selector("#paletteInput:focus", timeout=5000)
            pg.keyboard.type("bloom filter")
            try:
                pg.wait_for_selector('.palette-group:text("Bài học")', timeout=10000)
                pg.wait_for_selector('.palette-group:text("Lab")', timeout=10000)
                nhom = pg.eval_on_selector_all(".palette-group", "e => e.map(x => x.textContent)")
                (ok if "AI" not in nhom else sai)("Ctrl+K: bai hoc + lab tim duoc; khach KHONG thay 'Hoi AI' (%s)" % nhom)
            except Exception as e:  # noqa: BLE001
                sai("Ctrl+K khong ra bai hoc / lab: %s" % str(e).splitlines()[0])
            pg.keyboard.press("Escape")
            (ok if pg.locator("#palette").is_hidden() else sai)("Esc dong bang lenh")

            # Enter mo bai dau tien o trang rieng cua khoa (config.webapp)
            pg.keyboard.press("Control+K")
            pg.keyboard.type("bloom filter")
            pg.wait_for_selector('.palette-group:text("Bài học")', timeout=10000)
            dau = pg.locator('.palette-item[href*="#/"]').first.get_attribute("href")
            pg.locator('.palette-item[href*="#/"]').first.click()
            pg.wait_for_url("**/system-design-course/**", timeout=10000)
            (ok if "/webapp/courses/system-design-course/#/" in pg.url else sai)("bam bai hoc mo trang rieng cua khoa: %s" % dau)

            # quan tri vien: Hoi AI -> cau tra loi kem nguon
            pg.goto(url, wait_until="load")
            pg.evaluate("([k, t]) => localStorage.setItem(k, JSON.stringify(t))",
                        ["qlkh.phien@" + may.api + ".token", K.phien_quan_tri(may)])
            pg.reload(wait_until="load")
            pg.wait_for_selector(".app-card, .apps a", timeout=20000)
            pg.keyboard.press("Control+K")
            pg.keyboard.type("bloom filter la gi")
            try:
                pg.wait_for_selector('.palette-item:has-text("Hỏi AI")', timeout=10000)
                truoc = len(may.gemini.goi)
                pg.locator('.palette-item:has-text("Hỏi AI")').click()
                pg.wait_for_selector(".palette-sources a", timeout=20000)
                nguon = pg.eval_on_selector_all(".palette-sources a", "e => e.map(a => a.getAttribute('href'))")
                (ok if len(may.gemini.goi) == truoc + 1 and nguon and "#/" in nguon[0] else sai)(
                    "Hoi AI: tra loi kem nguon tro toi bai %s" % nguon[:2])
            except Exception as e:  # noqa: BLE001
                sai("Hoi AI tu bang lenh: %s" % str(e).splitlines()[0])
            br.close()
    finally:
        may.__exit__(None, None, None)
    if loi:
        for l in loi[:6]:
            sai("console: " + l[:200])
    else:
        ok("khong co loi console / pageerror")


def main():
    tinh()
    if "--tinh" not in sys.argv[1:]:
        trinh_duyet()
    print()
    if B.loi:
        print(K.DO + "[HONG]" + K.HET + " %d loi" % len(B.loi))
        sys.exit(1)
    print(K.XANH + "[DAT]" + K.HET + " 0 loi")


if __name__ == "__main__":
    main()
