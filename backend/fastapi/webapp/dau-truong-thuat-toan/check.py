#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kiem tra Dau truong thuat toan tren FastAPI that + SQLite tam + Chromium.

    python check.py --tinh     # cu phap JS, metadata
    python check.py            # + trinh duyet: chay mau, nop, bang xep hang, ma treo bi huy

Tra exit code khac 0 khi co loi.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "courses", "engine"))
import kiem_khoa_hoc as K  # noqa: E402

B = K.BaoCao()
ok, sai = B.ok, B.sai


def tinh():
    print("TANG 1 — tinh")
    m = json.load(open(os.path.join(HERE, "metadata.json"), encoding="utf-8"))
    (ok if all(k in m for k in ("title", "description", "category", "tags", "icon")) else sai)("metadata.json du truong")
    node = shutil.which("node")
    if node:
        r = subprocess.run([node, "--check", os.path.join(HERE, "assets", "app.js")], capture_output=True, text=True)
        (ok if r.returncode == 0 else sai)("cu phap assets/app.js" + ("" if r.returncode == 0 else ": " + r.stderr[-200:]))


def trinh_duyet():
    print("\nTANG 2 — FastAPI that + SQLite tam + Chromium")
    try:
        from playwright.sync_api import sync_playwright
    except Exception:
        B.bo_qua("chua cai playwright")
        return
    may = K.MayChuThu([]).__enter__()
    loi = []
    try:
        with sync_playwright() as pw:
            br = pw.chromium.launch()
            pg = br.new_page(viewport={"width": 1280, "height": 900})
            pg.on("pageerror", lambda e: loi.append(str(e)))
            pg.on("console", lambda m: loi.append(m.text) if m.type == "error" else None)
            pg.goto(may.goc + "/webapp/dau-truong-thuat-toan/?theme=light", wait_until="load")
            pg.wait_for_selector("#dsDe button.on", timeout=20000)
            de = pg.eval_on_selector_all("#dsDe button", "e => e.map(b => b.dataset.id)")
            (ok if de == ["tsp-60", "tsp-200", "tsp-1000"] else sai)("3 de tu /arena/problems: %s" % de)

            pg.click("#btnChay")
            pg.wait_for_selector("#ra .tot", timeout=15000)
            m = re.search(r"độ dài (\d+\.\d+)", pg.text_content("#ra"))
            dai = float(m.group(1)) if m else -1
            (ok if dai > 0 else sai)("chay mau 'lang gieng gan nhat' trong Worker: do dai %.3f" % dai)

            pg.fill("#ten", "Kiểm thử")
            pg.click("#btnNop")
            # :has-text() khong phan biet hoa thuong -> khop nham "...may chu do lai" hien truoc khi nop
            pg.wait_for_function("() => /Máy chủ đo: \\d/.test(document.querySelector('#ra').textContent)", timeout=10000)
            m2 = re.search(r"Máy chủ đo: (\d+\.\d+) · hạng (\d+)", pg.text_content("#ra"))
            pg.wait_for_selector("#bang tr.toi", timeout=10000)
            (ok if m2 and abs(float(m2.group(1)) - dai) < 0.01 and m2.group(2) == "1" else sai)(
                "nop: may chu tu do = %s, hang %s; bang xep hang to dong cua minh" % (m2 and m2.group(1), m2 and m2.group(2)))

            pg.fill("#ma", "function giai(diem) { while (true) {} }")
            pg.click("#btnChay")
            pg.wait_for_selector("#ra .loi:has-text('Dừng sau')", timeout=15000)
            ok("ma treo bi huy sau 10 giay (Worker terminate)")

            pg.fill("#ma", "function giai(diem) { return [0, 0, 1]; }")
            pg.click("#btnChay")
            pg.wait_for_selector("#ra .loi", timeout=10000)
            ok("loi giai khong phai hoan vi bi tu choi ngay o trang")
            br.close()
    finally:
        may.__exit__(None, None, None)
    if loi:
        for l in loi[:5]:
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
