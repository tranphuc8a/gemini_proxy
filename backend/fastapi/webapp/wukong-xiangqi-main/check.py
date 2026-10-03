#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kiem tra "Co tuong moi ngay" (apps/wukong/gui/daily.html) tren FastAPI that + Chromium.

    python check.py --tinh     # cu phap JS, the tren trang chu, moi van co the duoc chon deu hop le
    python check.py            # + trinh duyet: choi tron 8 nuoc (goi y, hoi Wukong, doan sai),
                               #   diem, chuoi ngay, tai lai giua chung, xem lai, van luyen

Tra exit code khac 0 khi co loi.
"""

from __future__ import annotations

import datetime as dt
import json
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
WUKONG = os.path.join(HERE, "apps", "wukong")
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "courses", "engine"))
import kiem_khoa_hoc as K  # noqa: E402

B = K.BaoCao()
ok, sai = B.ok, B.sai
ROUNDS = 8

# Moi van du dai trong games.js: 30 nuoc dau deu hop le voi engine (trang doan toi nuoc 13 + 16).
LEGAL_JS = r"""
const fs = require('fs');
eval(fs.readFileSync('engine/wukong.js', 'utf8') + ';global.Engine = Engine;');
eval(fs.readFileSync('gui/game/games.js', 'utf8').replace('const Games', 'global.Games'));
const e = new Engine();
const pool = Games.filter(g => g.moves.trim().split(/\s+/).length >= 30);
let bad = [];
for (const g of pool) {
  e.setBoard(e.START_FEN);
  for (const m of g.moves.trim().split(/\s+/).slice(0, 30)) {
    if (!e.generateLegalMoves().some(x => e.moveToString(x.move) === m)) { bad.push(g.id); break; }
    e.makeMove(e.moveFromString(m));
  }
}
process.stdout.write(JSON.stringify({pool: pool.length, bad}));
"""


def tinh():
    print("TANG 1 — tinh")
    node = shutil.which("node")
    if not node:
        B.bo_qua("chua co node")
        return
    for f in ("daily.js", "daily-worker.js"):
        r = subprocess.run([node, "--check", os.path.join(WUKONG, "gui", "game", f)], capture_output=True, text=True)
        (ok if r.returncode == 0 else sai)("cu phap game/" + f + ("" if r.returncode == 0 else ": " + r.stderr[-200:]))
    with open(os.path.join(HERE, "index.html"), encoding="utf-8") as fh:
        (ok if "apps/wukong/gui/daily.html" in fh.read() else sai)("trang chu Wukong co the 'Co tuong moi ngay'")
    r = subprocess.run([node, "-e", LEGAL_JS], cwd=WUKONG, capture_output=True, text=True)
    try:
        kq = json.loads(r.stdout.strip().splitlines()[-1])
    except (ValueError, IndexError):
        sai("khong kiem duoc games.js: " + (r.stderr or r.stdout)[-200:])
        return
    (ok if kq["pool"] > 1000 and not kq["bad"] else sai)(
        "%d van du dai, 30 nuoc dau deu hop le%s" % (kq["pool"], "" if not kq["bad"] else " — HONG: %s" % kq["bad"][:5]))


def trinh_duyet():
    print("\nTANG 2 — FastAPI that + Chromium")
    try:
        from playwright.sync_api import sync_playwright
    except Exception:
        B.bo_qua("chua cai playwright")
        return
    may = K.MayChuThu([]).__enter__()
    loi = []
    url = may.goc + "/webapp/wukong-xiangqi-main/apps/wukong/gui/daily.html"
    hom = dt.date.today()
    try:
        with sync_playwright() as pw:
            br = pw.chromium.launch()

            def trang(ctx):
                pg = ctx.new_page()
                pg.on("pageerror", lambda e: loi.append(str(e)))
                pg.on("console", lambda m: loi.append(m.text) if m.type == "error" else None)
                return pg

            def mo(pg, q=""):
                pg.goto(url + q, wait_until="load")
                pg.wait_for_function("document.querySelectorAll('#ban .o').length === 90", timeout=20000)

            def ban(pg):
                return pg.evaluate("() => ({van: +document.getElementById('ban').dataset.van, "
                                   "ply: document.getElementById('ban').dataset.ply})")

            def cho_luot(pg, ply):
                pg.wait_for_function(
                    "p => document.getElementById('ban').dataset.ply === String(p) && "
                    "!document.getElementById('btnMay').disabled", arg=ply, timeout=15000)

            def bam(pg, ten):
                pg.click("#ban .o[data-ten='%s']" % ten)

            def di(pg, nuoc):
                bam(pg, nuoc[:2])
                bam(pg, nuoc[2:4])

            def diem_o(pg):
                return pg.eval_on_selector_all("#oDiem li", "e => e.map(li => li.className)")

            def nuoc_sai(pg, dung, ben):
                """Mot nuoc hop le khac nuoc ky thu: quan cua minh khac quan ky thu da di."""
                mau = " đỏ" if ben == 0 else " đen"
                quan = pg.eval_on_selector_all(
                    "#ban .o", "(e, mau) => e.filter(b => b.querySelector('img') && "
                    "b.getAttribute('aria-label').endsWith(mau)).map(b => b.dataset.ten)", mau)
                for ten in quan:
                    if ten == dung[:2]:
                        continue
                    bam(pg, ten)
                    dich = pg.eval_on_selector_all("#ban .o.dich", "e => e.map(b => b.dataset.ten)")
                    if dich:
                        bam(pg, dich[0])
                        return ten + dich[0]
                    bam(pg, ten)                                   # bo chon
                return None

            # ---------------------------------------------- van hom nay, tu dau
            ctx = br.new_context(viewport={"width": 1280, "height": 900})
            pg = trang(ctx)
            mo(pg)
            b0 = ban(pg)
            moves = pg.evaluate("id => Games.find(g => g.id === id).moves.trim().split(/\\s+/)", b0["van"])
            start = int(b0["ply"])
            side = start % 2
            # Ngay chan cam Do (doan tu ply 12), ngay le cam Den (ply 13) — theo so ngay ke tu 1970.
            (ok if start == 12 + (hom - dt.date(1970, 1, 1)).days % 2 else sai)(
                "van #%d, doan tu ply %d, cam %s (ngay %s)" % (b0["van"], start, "Den" if side else "Do", hom))
            ten_mo = pg.text_content("#thongTin")
            (ok if ("Đen" if side else "Đỏ") in ten_mo else sai)("bang thong tin noi ro ben cam")

            # nuoc 1: goi y quan (-1) roi di dung -> 2 diem
            cho_luot(pg, start)
            pg.click("#btnGoiY")
            goi = pg.eval_on_selector_all("#ban .o.goi-y", "e => e.map(b => b.dataset.ten)")
            (ok if goi == [moves[start][:2]] else sai)("goi y to dung quan ky thu da di: %s" % goi)
            di(pg, moves[start])
            pg.wait_for_function("document.querySelectorAll('#oDiem li.d2').length === 1", timeout=5000)
            ok("nuoc 1: goi y + doan dung lan dau = 2 diem")

            # nuoc 2: sai mot lan, dung lan hai -> 2 diem
            cho_luot(pg, start + 2)
            sai1 = nuoc_sai(pg, moves[start + 2], side)
            (ok if sai1 and "Chưa phải" in pg.text_content("#loiNhan") else sai)("nuoc 2: doan sai %s bi bao 'Chua phai'" % sai1)
            di(pg, moves[start + 2])
            pg.wait_for_function("document.querySelectorAll('#oDiem li.d2').length === 2", timeout=5000)
            ok("nuoc 2: dung o lan hai = 2 diem")

            # nuoc 3: hoi Wukong (Web Worker), roi sai ca hai -> 0 diem, nuoc that duoc bay ra
            cho_luot(pg, start + 4)
            pg.click("#btnMay")
            pg.wait_for_function("document.querySelectorAll('#ban .o.may').length === 2", timeout=20000)
            (ok if "Wukong chọn" in pg.text_content("#loiNhan") else sai)("Hoi Wukong: engine trong Worker tra mot nuoc, to xanh")
            nuoc_sai(pg, moves[start + 4], side)
            nuoc_sai(pg, moves[start + 4], side)
            pg.wait_for_selector("#ban .o.dung", timeout=3000)
            pg.wait_for_function("document.querySelectorAll('#oDiem li.d0').length === 1", timeout=5000)
            ok("nuoc 3: sai ca hai = 0 diem, nuoc ky thu duoc to ra")

            # tai lai giua chung: tiep tuc o nuoc 4
            cho_luot(pg, start + 6)
            mo(pg)
            cho_luot(pg, start + 6)
            (ok if diem_o(pg)[:4] == ["d2", "d2", "d0", "dang"] else sai)("tai lai trang: tiep tuc van do o nuoc 4 (%s)" % diem_o(pg)[:4])

            for r in range(3, ROUNDS):
                cho_luot(pg, start + 2 * r)
                di(pg, moves[start + 2 * r])
            pg.wait_for_selector("#ket:not([hidden])", timeout=10000)
            chia = pg.text_content("#ketChia")
            (ok if "19 / 24" in pg.text_content("#ketDiem") and "🟨🟨🟥🟩🟩🟩🟩🟩 19/24" in chia else sai)(
                "ket qua: 19/24, chuoi emoji dung (%r)" % chia.splitlines()[1:2])
            luu = pg.evaluate("() => JSON.parse(localStorage.getItem('xq.daily'))")
            hom_iso = hom.isoformat()
            (ok if luu["choi"].get(hom_iso, {}).get("d") == [2, 2, 0, 3, 3, 3, 3, 3] and luu.get("chuoi") == 1
             and "dang" not in luu else sai)("luu: diem 8 nuoc cua hom nay, chuoi 1, xoa tien do dang choi")

            pg.click("#duyet [data-di='dau']")
            dau = pg.text_content("#duyetSo")
            pg.click("#duyet [data-di='cuoi']")
            (ok if dau.startswith("0 /") and pg.text_content("#duyetSo") == "%d / %d" % (len(moves), len(moves)) else sai)(
                "xem lai ca van: %s .. %s" % (dau, pg.text_content("#duyetSo")))

            mo(pg)
            pg.wait_for_selector("#ket:not([hidden])", timeout=5000)
            (ok if pg.is_hidden("#choi") and "đã chơi" in pg.text_content("#loiNhan") else sai)(
                "mo lai trong ngay: chi xem ket qua, khong choi lai van tinh diem")

            mo(pg, "?van=%d" % b0["van"])
            (ok if ("Luyện ván #%d" % b0["van"]) in pg.text_content("#ngay") and pg.is_visible("#choi") else sai)(
                "?van=: van luyen choi lai duoc")
            luu2 = pg.evaluate("() => JSON.parse(localStorage.getItem('xq.daily'))")
            (ok if list(luu2["choi"]) == [hom_iso] else sai)("van luyen khong dong vao so ngay da choi")
            ctx.close()

            # ---------------------------------- chuoi: hom qua da choi -> hom nay thanh 5
            ctx = br.new_context(viewport={"width": 390, "height": 844})
            pg = trang(ctx)
            mo(pg)
            hom_qua = (hom - dt.timedelta(days=1)).isoformat()
            pg.evaluate("v => localStorage.setItem('xq.daily', JSON.stringify(v))",
                        {"choi": {hom_qua: {"van": 1, "d": [3] * 8}}, "chuoi": 4, "kyLuc": 4, "cuoiNgay": hom_qua})
            mo(pg)
            (ok if "Chuỗi 4" in pg.text_content("#chuoi") else sai)("chuoi hom qua van con: 4 ngay")
            for r in range(ROUNDS):
                cho_luot(pg, start + 2 * r)
                di(pg, moves[start + 2 * r])
            pg.wait_for_selector("#ket:not([hidden])", timeout=10000)
            luu = pg.evaluate("() => JSON.parse(localStorage.getItem('xq.daily'))")
            (ok if luu["chuoi"] == 5 and luu["kyLuc"] == 5 and "Chuỗi 5 ngày" in pg.text_content("#ketChia")
             and "24/24" in pg.text_content("#ketChia") else sai)("dien thoai: 24/24, chuoi len 5, ky luc 5")
            ctx.close()
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
