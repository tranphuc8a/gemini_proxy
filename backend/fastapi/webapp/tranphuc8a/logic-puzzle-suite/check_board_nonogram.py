#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kiểm RIÊNG bàn Nonogram (assets/js/ui/boards/nonogram.js + board-nonogram.css) bằng trình duyệt thật.

check.py (tầng 2) tự nạp tệp này và gọi run(P, check, section, tid) trên trang máy tính (Chromium 1366×860).
Chạy riêng:   backend\\fastapi\\.venv\\Scripts\\python.exe backend\\fastapi\\webapp\\tranphuc8a\\logic-puzzle-suite\\check_board_nonogram.py [--may-chu-that] [--url http://127.0.0.1:8767/index.html]
Phần WebKit (iPhone 13) chạy trong một tiến trình con (Playwright đồng bộ không lồng nhau được) rồi quy về các phép check ở đây.

Kiểm: lưới + manh mối khớp puzzle.data · chạm tô/gạch/xoá + chạm hai lần gỡ · kéo = MỘT nước đi, khoá theo hàng/cột, xem trước không đổi dữ liệu, hoàn tác lùi cả nét ·
manh mối đã khớp mờ đi · ô/dòng xung đột · Xoá hàng/cột · bàn phím · gợi ý tô ô + manh mối · giải thật bằng chuột → "Đã giải" · replay chỉ-đọc · cỡ/tràn ngang 280–1280 với cỡ 5/15/25 ·
nút ≥ 44px, chữ manh mối ≥ 11px · cảm ứng thật (CDP) một ngón kéo tô, hai ngón cuộn bàn lớn · trình soạn (vẽ ảnh, nhập manh mối, khởi tạo từ input/puzzle) · WebKit."""

from __future__ import annotations

import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

OVERFLOW_JS = r"""
() => {
  const W = innerWidth, bad = [];
  if (document.documentElement.scrollWidth > W + 1) bad.push("TRANG cuộn ngang: scrollWidth " + document.documentElement.scrollWidth + " > " + W);
  const scroller = (el) => { for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === "auto" || o === "scroll") return true; } return false; };
  const name = (el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).join(".") : "");
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") continue;
    if (el.closest("dialog") && !el.closest("dialog[open]")) continue;
    if (el.closest("[inert]") || el.closest("[hidden]")) continue;
    const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    if ((r.right > W + 1 || r.left < -1) && !scroller(el)) { bad.push(name(el) + " ra ngoài khung: " + Math.round(r.left) + "…" + Math.round(r.right) + " (rộng " + W + ")"); if (bad.length > 6) break; }
  }
  return bad;
}
"""

GAME_JS = r"""() => {
  const m = /#\/play\/([^?]+)/.exec(location.hash); if (!m) return null;
  const g = Puz.ui.app.ctx().getGame(decodeURIComponent(m[1])); if (!g) return null;
  const d = g.puzzle.data;
  return { w: d.w, h: d.h, rows: d.rows, cols: d.cols, sol: g.puzzle.solution && g.puzzle.solution.v.slice(), v: g.state.v.slice(), moves: g.counters.moves, undo: g.undoStack.length, redo: g.redoStack.length, status: g.status };
}"""

# Bàn 25×25 từ ảnh dựng sẵn (vòng tròn + đường chéo + nhiễu tất định), qua fromInput của engine rồi mở như một ván tự tạo.
START_BIG = r"""(n) => {
  const T = Puz.types.get('nonogram'), img = []; let s = 12345;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const d = Math.hypot(r - (n - 1) / 2, c - (n - 1) / 2); s = (s * 1103515245 + 12345) & 0x7fffffff; img.push(((d < n * 0.45 && d > n * 0.2) || r === c || (s % 7 === 0 && d < n * 0.3)) ? 1 : 0); }
  const res = T.fromInput({ w: n, h: n, image: img }); if (!res.ok) return 'ERR ' + res.errors.join('|');
  Puz.ui.app.ctx().startGame(res.puzzle, { source: 'custom' }); return 'ok';
}"""

CLUE_TEXT_JS = r"""() => ({
  rows: [...document.querySelectorAll('.pz-ng-rows .pz-ng-clue')].map(e => [...e.querySelectorAll('.n')].map(n => +n.textContent)),
  cols: [...document.querySelectorAll('.pz-ng-cols .pz-ng-clue')].map(e => [...e.querySelectorAll('.n')].map(n => +n.textContent))
})"""

_seed = [7771000]


def next_seed():
    _seed[0] += 1
    return _seed[0]


def center(pg, i):
    bb = pg.locator(".pz-ng-grid .pz-ng-cell[data-i='%d']" % i).bounding_box()
    return bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2


def drag(pg, cells, jitter=(0, 0), steps=4, up=True):
    pts = [center(pg, i) for i in cells]
    pg.mouse.move(*pts[0])
    pg.mouse.down()
    for (x, y) in pts[1:]:
        pg.mouse.move(x + jitter[0], y + jitter[1], steps=steps)
    if up:
        pg.mouse.up()


def click_cell(pg, i, **kw):
    x, y = center(pg, i)
    pg.mouse.click(x, y, **kw)


def tool(pg, name):
    pg.click(".pz-ng-tools button:has-text('%s')" % name)


def diff(a, b):
    return [i for i in range(len(a)) if a[i] != b[i]]


DOM_V_JS = r"""() => [...document.querySelectorAll('.pz-ng-grid .pz-ng-cell')].map(e => e.classList.contains('f') ? 1 : e.classList.contains('x') ? 2 : 0)"""


def clue_runs(v, base, stride, n):
    out, run = [], 0
    for c in range(n):
        if v[base + c * stride] == 1:
            run += 1
        elif run:
            out.append(run)
            run = 0
    if run:
        out.append(run)
    return out


def sol_runs(g):
    """Các đoạn tô liên tiếp theo hàng của lời giải: [(hàng, cột đầu, cột cuối)]."""
    out = []
    for r in range(g["h"]):
        c = 0
        while c < g["w"]:
            if g["sol"][r * g["w"] + c] == 1:
                c0 = c
                while c + 1 < g["w"] and g["sol"][r * g["w"] + c + 1] == 1:
                    c += 1
                out.append((r, c0, c))
            c += 1
    return out


# ============================================================================================ chơi
def run(P, check, section, tid):
    pg = P.pg
    state = {"n": 0}

    def ck(cond, msg, detail=""):
        state["n"] += 1
        return check(cond, "Nonogram: " + msg, detail)

    def fresh(size="10", tier="easy"):
        P.start(tid, size, tier, next_seed())
        pg.wait_for_selector(".pz-ng-grid .pz-ng-cell")
        pg.wait_for_timeout(120)
        return pg.evaluate(GAME_JS)

    # ------------------------------------------------------------------ lưới + manh mối
    section(" · Nonogram: lưới và manh mối")
    g = fresh("10")
    W, H = g["w"], g["h"]
    ck(pg.locator(".pz-ng-grid .pz-ng-cell").count() == W * H, "lưới đúng %d×%d = %d ô" % (W, H, W * H))
    ck(pg.get_attribute(".pz-ng-grid", "role") == "grid" and pg.get_attribute(".pz-ng-grid", "aria-rowcount") == str(H) and pg.get_attribute(".pz-ng-grid", "aria-colcount") == str(W), "lưới role=grid, aria-rowcount/colcount đúng")
    ct = pg.evaluate(CLUE_TEXT_JS)
    ck(ct["rows"] == [r or [0] for r in g["rows"]] and ct["cols"] == [c or [0] for c in g["cols"]], "số manh mối hàng (trái) và cột (trên) khớp puzzle.data", (ct["rows"][:3], g["rows"][:3]))
    pos = pg.evaluate("(() => { const c = document.querySelector('.pz-ng-cell').getBoundingClientRect(), r = document.querySelector('.pz-ng-rows .pz-ng-clue').getBoundingClientRect(), k = document.querySelector('.pz-ng-cols .pz-ng-clue').getBoundingClientRect(); return { rowLeft: r.right <= c.left + 1, colAbove: k.bottom <= c.top + 1 }; })()")
    ck(pos["rowLeft"] and pos["colAbove"], "manh mối hàng nằm bên TRÁI lưới, manh mối cột nằm phía TRÊN lưới", pos)
    ck(pg.get_attribute(".pz-ng-cell[data-i='0']", "aria-label") == "Hàng 1, cột 1, ô chưa biết", "aria-label ô = type.describeCell", pg.get_attribute(".pz-ng-cell[data-i='0']", "aria-label"))
    ck(pg.get_attribute(".pz-ng-scroll", "tabindex") == "0" and pg.get_attribute(".pz-ng-scroll", "role") == "region" and bool(pg.get_attribute(".pz-ng-scroll", "aria-label")), "vùng cuộn có tabindex=0, role=region, aria-label")
    hs = pg.evaluate("[...document.querySelectorAll('.pz-ng-bar button')].map(b => Math.round(b.getBoundingClientRect().height))")
    ck(len(hs) >= 8 and min(hs) >= 44, "mọi nút của bàn (%d nút) cao ≥ 44px" % len(hs), hs)
    thick = pg.evaluate("document.querySelectorAll('.pz-ng-cell.bx').length")
    ck(thick == (W // 5 - (1 if W % 5 == 0 else 0)) * H, "kẻ đậm sau mỗi 5 cột (%d ô có bx)" % thick)

    # ------------------------------------------------------------------ chạm: tô / gạch / xoá
    section(" · Nonogram: chạm một ô (Tô, Gạch, Xoá)")
    A = 3 * W + 3
    m0 = P.game()["moves"]
    click_cell(pg, A)
    s1 = P.game()
    ck(s1["v"][A] == 1 and s1["moves"] == m0 + 1, "chạm với dụng cụ Tô → ô = 1 (tô), một nước đi", (s1["v"][A], s1["moves"]))
    ck("đã tô" in pg.get_attribute(".pz-ng-cell[data-i='%d']" % A, "aria-label") and "f" in pg.get_attribute(".pz-ng-cell[data-i='%d']" % A, "class").split(), "ô vừa tô: class f + aria-label 'đã tô'")
    click_cell(pg, A)
    ck(P.game()["v"][A] == 0, "chạm lần hai vào ô đã tô → gỡ về 0")
    tool(pg, "Gạch")
    ck(pg.get_attribute(".pz-ng-tools button:has-text('Gạch')", "aria-pressed") == "true" and pg.get_attribute(".pz-ng-tools button:has-text('Tô')", "aria-pressed") == "false", "bấm Gạch → aria-pressed chuyển đúng")
    click_cell(pg, A)
    ck(P.game()["v"][A] == 2 and "x" in pg.get_attribute(".pz-ng-cell[data-i='%d']" % A, "class").split(), "dụng cụ Gạch → ô = 2 (✕)")
    click_cell(pg, A)
    ck(P.game()["v"][A] == 0, "chạm lần hai với Gạch → gỡ về 0")
    tool(pg, "Tô")
    click_cell(pg, A)
    tool(pg, "Xoá")
    click_cell(pg, A)
    ck(P.game()["v"][A] == 0, "dụng cụ Xoá đưa ô đã tô về 0")
    n = P.game()["moves"]
    click_cell(pg, A)
    ck(P.game()["moves"] == n, "Xoá trên ô trống không tạo nước đi")
    tool(pg, "Tô")
    B = 5 * W + 6
    click_cell(pg, B, button="right")
    ck(P.game()["v"][B] == 2, "chuột phải = gạch (ô = 2)")
    click_cell(pg, B, button="right")
    ck(P.game()["v"][B] == 0, "chuột phải lần hai → gỡ")

    # ------------------------------------------------------------------ kéo = MỘT nước đi
    section(" · Nonogram: kéo qua nhiều ô (một nét = một nước đi)")
    r = 6
    row6 = [r * W + c for c in range(1, 5)]
    before = P.game()
    drag(pg, row6, jitter=(0, 7))
    after = P.game()
    ch = diff(before["v"], after["v"])
    ck(ch == row6 and all(after["v"][i] == 1 for i in row6), "kéo ngang 4 ô (lệch dọc vài px) → đúng 4 ô liền nhau được tô", ch)
    ck(after["moves"] == before["moves"] + 1 and after["undo"] == before["undo"] + 1, "cả nét là MỘT nước đi (moves %d → %d)" % (before["moves"], after["moves"]))
    pg.click(".toolbar button:has-text('Hoàn tác')")
    und = P.game()
    ck(und["v"] == before["v"] and und["undo"] == before["undo"], "một lần Hoàn tác lùi cả nét 4 ô")
    ck(pg.evaluate(DOM_V_JS) == und["v"], "sau Hoàn tác, giao diện (class f/x của từng ô) khớp đúng state của ván")
    pg.click(".toolbar button:has-text('Làm lại')")
    ck(P.game()["v"] == after["v"], "Làm lại áp lại cả nét")
    pg.click(".toolbar button:has-text('Hoàn tác')")
    # xem trước
    row7 = [7 * W + c for c in range(1, 4)]
    base = P.game()
    drag(pg, row7, up=False)
    mid = P.game()
    pv = pg.evaluate("[...document.querySelectorAll('.pz-ng-cell.pv1')].map(e => +e.dataset.i)")
    ck(sorted(pv) == row7 and mid["v"] == base["v"] and mid["moves"] == base["moves"], "đang kéo: 3 ô có lớp xem trước pv1 nhưng dữ liệu và số nước đi CHƯA đổi", (pv, mid["moves"]))
    pg.mouse.up()
    fin = P.game()
    ck(sorted(diff(base["v"], fin["v"])) == row7 and fin["moves"] == base["moves"] + 1 and pg.locator(".pz-ng-cell.pv1").count() == 0, "thả chuột → áp dụng một lần, xoá xem trước")
    # khoá trục
    before = P.game()
    seg = [2 * W + c for c in range(2, 6)]
    pts = [center(pg, i) for i in seg]
    pg.mouse.move(*pts[0]); pg.mouse.down(); pg.mouse.move(pts[-1][0], pts[-1][1], steps=6)
    x5, y5 = center(pg, 5 * W + 5)
    pg.mouse.move(x5, y5, steps=8)                    # rồi kéo xuống dưới 3 hàng: vẫn khoá theo HÀNG đầu tiên
    pg.mouse.up()
    after = P.game()
    ck(sorted(diff(before["v"], after["v"])) == seg, "kéo bị khoá theo hàng đã chọn lúc đầu (kéo lệch xuống 3 hàng vẫn chỉ tô hàng 3)", diff(before["v"], after["v"]))
    before = P.game()
    col = [c + 8 for c in (0, W, 2 * W, 3 * W)]
    drag(pg, col, jitter=(9, 0))
    after = P.game()
    ck(sorted(diff(before["v"], after["v"])) == col, "kéo dọc (lệch ngang vài px) → khoá theo cột, đúng 4 ô", diff(before["v"], after["v"]))
    # nét xoá: bắt đầu trên ô đã tô
    before = P.game()
    drag(pg, [7 * W + 1, 7 * W + 2, 7 * W + 3])
    after = P.game()
    ck(all(after["v"][7 * W + c] == 0 for c in (1, 2, 3)) and after["moves"] == before["moves"] + 1, "kéo bắt đầu trên ô đã tô (dụng cụ Tô) → cả nét XOÁ, vẫn một nước đi")
    # gạch bằng kéo
    tool(pg, "Gạch")
    before = P.game()
    gx = [9 * W + c for c in range(0, 5)]
    drag(pg, gx)
    after = P.game()
    ck(sorted(diff(before["v"], after["v"])) == gx and all(after["v"][i] == 2 for i in gx), "kéo với Gạch → 5 ô ✕ cùng lúc")
    tool(pg, "Tô")

    # ------------------------------------------------------------------ Xoá hàng / cột
    section(" · Nonogram: Xoá hàng / Xoá cột")
    ck(pg.locator(".pz-ng-line:has-text('Xoá hàng')").is_enabled(), "đã có ô chọn → nút Xoá hàng bật")
    row2 = [2 * W + c for c in range(0, 4)]
    tool(pg, "Xoá")
    click_cell(pg, 2 * W + 9)                          # chọn ô (hàng 3, cột 10) mà không đổi gì
    tool(pg, "Tô")
    # (Xoá trên ô trống chỉ chọn). Tô sẵn vài ô cùng hàng 3 rồi chọn lại ô ở hàng đó bằng bàn phím
    pg.locator(".pz-ng-cell[data-i='%d']" % (2 * W + 9)).focus()
    before = P.game()
    n_row = sum(1 for c in range(W) if before["v"][2 * W + c])
    ck(n_row >= 1, "hàng 3 đã có dấu để xoá (%d ô)" % n_row)
    pg.click(".pz-ng-line:has-text('Xoá hàng')")
    after = P.game()
    ck(all(after["v"][2 * W + c] == 0 for c in range(W)) and after["moves"] == before["moves"] + 1, "Xoá hàng → mọi ô của hàng về 0, một nước đi ({k:'clearline'})")
    pg.click(".toolbar button:has-text('Hoàn tác')")
    ck(P.game()["v"] == before["v"] and pg.evaluate(DOM_V_JS) == before["v"], "Hoàn tác lùi cả hàng đã xoá (giao diện khớp state)")
    cc = 8
    pg.locator(".pz-ng-cell[data-i='%d']" % cc).focus()
    pg.keyboard.press("ArrowDown")                      # chọn ô (hàng 2, cột 9) bằng bàn phím
    before = P.game()
    n_col = sum(1 for r2 in range(H) if before["v"][r2 * W + cc])
    pg.click(".pz-ng-line:has-text('Xoá cột')")
    after = P.game()
    ck(n_col >= 1 and all(after["v"][r2 * W + cc] == 0 for r2 in range(H)) and after["moves"] == before["moves"] + 1, "Xoá cột → mọi ô của cột về 0, một nước đi (cột có %d ô)" % n_col)

    # ------------------------------------------------------------------ bàn phím
    section(" · Nonogram: bàn phím")
    pg.locator(".pz-ng-cell[data-i='%d']" % (5 * W + 5)).focus()
    keys = [("ArrowRight", 5 * W + 6), ("ArrowDown", 6 * W + 6), ("ArrowLeft", 6 * W + 5), ("ArrowUp", 5 * W + 5), ("Home", 5 * W), ("End", 5 * W + W - 1)]
    bad = []
    for k, want in keys:
        pg.keyboard.press(k)
        got = pg.evaluate("document.activeElement && document.activeElement.dataset ? +document.activeElement.dataset.i : -1")
        if got != want:
            bad.append((k, got, want))
    ck(not bad, "mũi tên / Home / End di chuyển ô chọn đúng", bad)
    pg.locator(".pz-ng-cell[data-i='0']").focus()
    pg.keyboard.press("ArrowLeft"); pg.keyboard.press("ArrowUp")
    ck(pg.evaluate("+document.activeElement.dataset.i") == 0, "ở mép bàn mũi tên không đi ra ngoài")
    tabs = pg.evaluate("[...document.querySelectorAll('.pz-ng-cell')].filter(c => c.getAttribute('tabindex') === '0').length")
    ck(tabs == 1, "roving tabindex: đúng một ô tabindex=0", tabs)
    K = 4 * W + 4
    pg.locator(".pz-ng-cell[data-i='%d']" % K).focus()
    pg.keyboard.press("Space")
    ck(P.game()["v"][K] == 1 and "đã tô" in pg.get_attribute(".pz-ng-cell[data-i='%d']" % K, "aria-label"), "Space áp dụng dụng cụ Tô → ô tô, aria-label cập nhật")
    pg.keyboard.press("x")
    ck(P.game()["v"][K] == 2, "phím X → gạch")
    pg.keyboard.press("Delete")
    ck(P.game()["v"][K] == 0, "phím Delete → xoá")
    pg.keyboard.press("Enter")
    pg.keyboard.press("Enter")
    ck(P.game()["v"][K] == 0, "Enter hai lần = tô rồi gỡ")
    pg.keyboard.press("f")
    ck(P.game()["v"][K] == 1, "phím F → tô")
    pg.keyboard.press("Delete")

    # ------------------------------------------------------------------ xung đột + manh mối đã khớp (ván mới)
    section(" · Nonogram: ô xung đột, manh mối đã khớp")
    g = fresh("10")
    W, H = g["w"], g["h"]
    full_rows = [r for r in range(H) if g["rows"][r] != [W]]
    r = full_rows[0]
    row = [r * W + c for c in range(W)]
    on = pg.evaluate("Puz.ui.app.ctx().settings().showConflicts")
    drag(pg, row)
    cf = pg.evaluate("[...document.querySelectorAll('.pz-ng-cell.cf')].map(e => +e.dataset.i)")
    ccl = pg.evaluate("({ rows: [...document.querySelectorAll('.pz-ng-rows .pz-ng-clue')].map((e, i) => e.classList.contains('cf') ? i : -1).filter(i => i >= 0), cols: [...document.querySelectorAll('.pz-ng-cols .pz-ng-clue')].map((e, i) => e.classList.contains('cf') ? i : -1).filter(i => i >= 0) })")
    ck(on and len(cf) > 0, "tô kín cả hàng %d (clue %s) → có ô xung đột được tô (.cf): %d ô" % (r + 1, g["rows"][r], len(cf)), (on, cf))
    ck(r in ccl["rows"], "số manh mối của hàng vi phạm tô màu báo lỗi (.cf)", ccl)
    in_flagged = all((i // W) in ccl["rows"] or (i % W) in ccl["cols"] for i in cf)
    each_has = all(any((i // W) == rr for i in cf) for rr in ccl["rows"]) and all(any((i % W) == cc2 for i in cf) for cc2 in ccl["cols"])
    ck(in_flagged and each_has, "dòng bị tô lỗi và ô xung đột của engine khớp nhau (mỗi ô nằm trong dòng lỗi, mỗi dòng lỗi có ô)", (ccl, cf[:6]))
    pg.click(".toolbar button:has-text('Hoàn tác')")
    ck(pg.locator(".pz-ng-cell.cf").count() == 0 and pg.locator(".pz-ng-clue.cf").count() == 0, "hoàn tác → hết xung đột")
    # đủ khối → mờ + gạch ngang
    g = P.game()
    rr = pg.evaluate(GAME_JS)
    target = [x for x in sol_runs(rr)][0][0]                       # hàng đầu tiên có ô tô
    runs = [x for x in sol_runs(rr) if x[0] == target]
    for (r0, c0, c1) in runs:
        drag(pg, [r0 * W + c for c in range(c0, c1 + 1)]) if c1 > c0 else click_cell(pg, r0 * W + c0)
    done_rows = pg.evaluate("[...document.querySelectorAll('.pz-ng-rows .pz-ng-clue')].map((e, i) => e.classList.contains('done') ? i : -1).filter(i => i >= 0)")
    ck(target in done_rows, "tô đủ các khối của hàng %d theo đáp án → số manh mối hàng đó mờ + gạch ngang (.done)" % (target + 1), done_rows)
    td = pg.evaluate("getComputedStyle(document.querySelectorAll('.pz-ng-rows .pz-ng-clue')[%d].querySelector('.n')).textDecorationLine" % target)
    ck("line-through" in td, "số đã khớp có gạch ngang (text-decoration: line-through)", td)
    for _ in runs:
        pg.click(".toolbar button:has-text('Hoàn tác')")
    ck(pg.locator(".pz-ng-rows .pz-ng-clue.done").count() == 0 or target not in pg.evaluate("[...document.querySelectorAll('.pz-ng-rows .pz-ng-clue')].map((e, i) => e.classList.contains('done') ? i : -1)"), "hoàn tác → hết mờ")
    # tô nhạt hàng + cột của ô chọn cùng manh mối
    click_cell(pg, 3 * W + 4)
    ck(pg.locator(".pz-ng-cell.pr").count() == (W - 1) + (H - 1) and pg.locator(".pz-ng-clue.on").count() == 2, "chọn ô → tô nhạt hàng + cột (%d ô) và hai manh mối tương ứng (.on)" % ((W - 1) + (H - 1)), (pg.locator(".pz-ng-cell.pr").count(), pg.locator(".pz-ng-clue.on").count()))
    click_cell(pg, 3 * W + 4)

    # ------------------------------------------------------------------ gợi ý: tô ô + manh mối
    section(" · Nonogram: gợi ý tô ô và manh mối")
    g = fresh("10")
    pg.click(".toolbar button:has-text('Gợi ý')")
    pg.wait_for_selector(".hint-panel:not([hidden])")
    nh = pg.locator(".pz-ng-cell.hint").count()
    nc = pg.locator(".pz-ng-clue.hl-hint").count()
    ck(nh >= 1 and nc >= 1, "gợi ý mức 1: %d ô tô hổ phách (.hint) + %d manh mối được tô nhạt (.hl-hint)" % (nh, nc))
    pg.click(".hint-panel button:has-text('Chi tiết hơn')")
    pg.click(".hint-panel button:has-text('Chi tiết hơn')")
    ck(pg.locator(".pz-ng-cell.hint").count() >= 1, "gợi ý mức 3 vẫn tô các ô")
    m0 = P.game()["moves"]
    pg.click(".hint-panel button:has-text('Áp dụng nước này')")
    ck(P.game()["moves"] == m0 + 1 and pg.locator(".pz-ng-cell.hint").count() == 0 and pg.locator(".pz-ng-clue.hl-hint").count() == 0, "áp dụng gợi ý → một nước đi, xoá tô sáng")

    # ------------------------------------------------------------------ giải thật bằng chuột 5×5
    section(" · Nonogram: giải 5×5 bằng chuột thật → 'Đã giải'")
    g = fresh("5", "easy")
    W, H = g["w"], g["h"]
    runs = sol_runs(g)
    for (r0, c0, c1) in runs:
        if c1 > c0:
            drag(pg, [r0 * W + c for c in range(c0, c1 + 1)])
        else:
            click_cell(pg, r0 * W + c0)
    popped = pg.evaluate("document.querySelectorAll('.pz-ng.pop').length")
    try:
        pg.wait_for_selector("dialog[open] h2:has-text('Đã giải')", timeout=8000)
        ok = True
    except Exception:
        ok = False
    gg = P.game()
    ck(ok and gg["status"] == "solved", "tô %d đoạn theo đáp án → hộp thoại 'Đã giải' (trạng thái %s)" % (len(runs), gg["status"]))
    pic = pg.evaluate("[...document.querySelectorAll('.pz-ng-cell.f')].map(e => +e.dataset.i).sort((a, b) => a - b)")
    ck(pic == [i for i in range(W * H) if g["sol"][i] == 1] and pg.locator(".pz-ng.done").count() == 1, "ảnh đáp án hiện đủ (%d ô tô) và bàn ở trạng thái .done" % len(pic))
    ck(popped == 1, "giải xong: bật hiệu ứng nhẹ (.pop, tự tắt sau ~1,7 s; CSS chỉ chạy khi không bật prefers-reduced-motion)", popped)
    ck(pg.locator(".pz-ng-clue.done").count() == W + H, "xong → mọi manh mối đều mờ")
    # replay chỉ đọc
    pg.click("dialog[open] button:has-text('Xem lời giải từng bước')")
    pg.wait_for_selector(".replay-panel:not([hidden])", timeout=20000)
    ck(pg.locator(".pz-ng.ro").count() == 1 and pg.locator(".pz-ng-tools").count() == 0 and pg.locator(".pz-ng-zoom").count() == 1, "replay: bàn chỉ-đọc (không có dụng cụ, còn nút cỡ ô)")
    pg.click(".replay-panel button:has-text('Sau')")
    ck(pg.locator(".pz-ng-cell.replay").count() >= 1 and pg.locator(".pz-ng-clue.hl-replay").count() >= 1, "replay: ô của bước được tô xanh (.replay) + manh mối tương ứng (.hl-replay)")
    nf = pg.locator(".pz-ng-cell.f").count()
    click_cell(pg, 0)
    drag(pg, [0, 1, 2])
    ck(pg.locator(".pz-ng-cell.f").count() == nf and P.game() is not None, "replay: chạm/kéo không đổi bàn (chỉ-đọc)")
    pg.click(".replay-panel button:has-text('Thoát replay')")
    m = P.game()["moves"]
    click_cell(pg, 0)
    ck(P.game()["moves"] == m and pg.locator(".pz-ng-cell.f").count() == len(pic), "ván đã xong: chạm vào ô không đổi bàn")
    P.go("#/", 200)

    # ------------------------------------------------------------------ co giãn
    section(" · Nonogram: co giãn 280–1280px × cỡ 5/15/25")
    widths = [280, 360, 768, 1280]
    for label, how in (("5×5", ("5", None)), ("15×15", ("15", None)), ("25×25", (None, 25))):
        issues = []
        fonts = []
        sizes = {}
        for w in widths:
            pg.set_viewport_size({"width": w, "height": 800})
            if how[1]:
                pg.evaluate("location.hash = '#/'")
                pg.wait_for_timeout(150)
                pg.evaluate(START_BIG, how[1])
            else:
                P.start(tid, how[0], "easy", 8880000 + int(how[0]))
            pg.wait_for_selector(".pz-ng-grid .pz-ng-cell")
            pg.wait_for_timeout(450)
            bad = pg.evaluate(OVERFLOW_JS)
            info = pg.evaluate("""() => { const sc = document.querySelector('.pz-ng-scroll'), b = document.querySelector('.pz-ng-board');
              return { c: parseFloat(getComputedStyle(b).getPropertyValue('--c')), sw: sc.scrollWidth, cw: sc.clientWidth, vw: innerWidth,
                       minfont: Math.min(...[...document.querySelectorAll('.pz-ng-clue .n')].map(e => parseFloat(getComputedStyle(e).fontSize))),
                       btn: Math.min(...[...document.querySelectorAll('.pz-ng-bar button')].map(e => e.getBoundingClientRect().height)) } }""")
            sizes[w] = info["c"]
            if bad:
                issues.append("%dpx: %s" % (w, "; ".join(bad[:2])))
            if info["cw"] > w:
                issues.append("%dpx: vùng cuộn rộng %d > màn" % (w, info["cw"]))
            if info["minfont"] < 11:
                issues.append("%dpx: chữ manh mối %.1fpx < 11" % (w, info["minfont"]))
            if info["btn"] < 43.5:
                issues.append("%dpx: có nút cao %.1fpx < 44" % (w, info["btn"]))
            if how[0] in ("5", "15") and info["sw"] > info["cw"] + 1 and w >= 360:
                issues.append("%dpx: cỡ %s không vừa khung (scrollWidth %d > %d, ô %spx)" % (w, label, info["sw"], info["cw"], info["c"]))
            if how[1] and w >= 360 and info["c"] < 17.5:
                issues.append("%dpx: ô %spx < 18" % (w, info["c"]))
        ck(not issues, "%s: không tràn ngang trang, chữ manh mối ≥ 11px, nút ≥ 44px, cỡ vừa khung (cỡ ô theo bề rộng %s)" % (label, sizes), issues)
        fonts.append(sizes)
    pg.set_viewport_size({"width": 1366, "height": 860})

    # zoom
    section(" · Nonogram: phóng to / thu nhỏ và cuộn bàn lớn")
    pg.set_viewport_size({"width": 390, "height": 844})
    pg.evaluate("location.hash = '#/'")
    pg.wait_for_timeout(150)
    pg.evaluate(START_BIG, 25)
    pg.wait_for_selector(".pz-ng-grid .pz-ng-cell")
    pg.wait_for_timeout(450)
    px = lambda: pg.evaluate("parseFloat(getComputedStyle(document.querySelector('.pz-ng-board')).getPropertyValue('--c'))")
    c0 = px()
    sc = pg.evaluate("(() => { const s = document.querySelector('.pz-ng-scroll'); return [s.scrollWidth, s.clientWidth, !document.querySelector('.pz-ng-tip').hidden]; })()")
    ck(sc[0] > sc[1] and sc[2], "25×25 trên 390px: ô tối thiểu %gpx, cuộn ngang trong vùng riêng (scrollWidth %d > %d) và có dòng chỉ dẫn" % (c0, sc[0], sc[1]))
    pg.click(".pz-ng-zoom button[aria-label='Phóng to ô']")
    c1 = px()
    pg.click(".pz-ng-zoom button[aria-label='Phóng to ô']")
    c2 = px()
    pg.click(".pz-ng-zoom button[aria-label='Thu nhỏ ô']")
    c3 = px()
    ck(c1 > c0 and c2 > c1 and c3 < c2, "nút + / − đổi cỡ ô (%g → %g → %g → %g)" % (c0, c1, c2, c3))
    pg.click(".pz-ng-zoom button[aria-label='Phóng to ô']")
    pg.click(".pz-ng-zoom button[aria-label='Phóng to ô']")
    sticky = pg.evaluate("""() => { const s = document.querySelector('.pz-ng-scroll'); s.scrollLeft = 150; s.scrollTop = 80;
      const rc = s.getBoundingClientRect(), r = document.querySelector('.pz-ng-rows .pz-ng-clue').getBoundingClientRect(), k = document.querySelector('.pz-ng-cols .pz-ng-clue').getBoundingClientRect();
      return { dx: Math.round(r.left - rc.left), dy: Math.round(k.top - rc.top), sl: s.scrollLeft, st: s.scrollTop }; }""")
    ck(sticky["sl"] > 0 and sticky["st"] > 0 and sticky["dx"] <= 2 and sticky["dy"] <= 2, "cuộn bàn lớn (đã phóng to): manh mối hàng/cột đóng băng ở mép (không trôi đi)", sticky)
    pg.click(".pz-ng-zoom button:has-text('Vừa')")
    ck(px() == c0, "nút Vừa trở về cỡ vừa khung (%g)" % px())
    pg.set_viewport_size({"width": 1366, "height": 860})
    P.go("#/", 200)

    # ------------------------------------------------------------------ cảm ứng thật (Chromium di động, CDP)
    section(" · Nonogram: cảm ứng thật (Chromium di động) — một ngón kéo tô, hai ngón cuộn")
    try:
        T = type(P)(pg.context.browser, P.url, "nonogram-touch", viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    except Exception as e:                                                    # pragma: no cover
        T = None
        print("  (bỏ qua cảm ứng thật: %s)" % str(e).splitlines()[0])
    if T is not None:
        try:
            touch_tests(T, tid, ck)
        finally:
            T.close()

    # ------------------------------------------------------------------ tương phản màu riêng của bàn
    contrast_tests(ck, section)

    # ------------------------------------------------------------------ trình soạn
    editor_tests(P, tid, ck, section)

    # ------------------------------------------------------------------ WebKit (tiến trình con)
    section(" · Nonogram: WebKit (iPhone 13)")
    try:
        r = subprocess.run([sys.executable, os.path.abspath(__file__), "--webkit", P.url], capture_output=True, text=True, encoding="utf-8", timeout=300)
        lines = [l for l in r.stdout.splitlines() if l.startswith(("PASS:", "FAIL:", "SKIP:"))]
        if not lines:
            ck(False, "WebKit: tiến trình con không trả kết quả", (r.stdout + r.stderr)[-400:])
        for l in lines:
            kind, rest = l.split(":", 1)
            if kind == "SKIP":
                print("  (bỏ qua WebKit: %s)" % rest.strip())
            else:
                msg, _, det = rest.partition("|")
                ck(kind == "PASS", "WebKit: " + msg.strip(), det.strip())
    except Exception as e:
        ck(False, "WebKit: không chạy được tiến trình con", str(e)[:200])
    P.go("#/", 400)
    pg.evaluate("Puz.ui.app.ctx().user.dropDraft('edit:nonogram')")      # không để bản nháp của bài kiểm lại cho phần sau
    return state["n"]


# ============================================================================================ tương phản (màu riêng của bàn)
def contrast_tests(ck, section):
    """Đo lại tương phản của các cặp màu RIÊNG của bàn (check.py tầng 1 chỉ đo --pz-* chung). Chữ ≥ 4,5:1; ô tô / dấu ✕ / viền chọn (thành phần giao diện) ≥ 3:1. Sáng + tối."""
    import re

    def rd(*parts):
        with open(os.path.join(HERE, *parts), encoding="utf-8") as f:
            return f.read()

    def block(css, sel):
        m = re.search(sel + r"\s*\{(.*?)\n\}", css, re.S | re.M)
        return dict(re.findall(r"--([a-z0-9-]+):\s*([^;]+);", m.group(1))) if m else {}

    def lum(c):
        def f(v):
            v /= 255
            return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
        r, g, b = (f(x) for x in c[:3])
        return 0.2126 * r + 0.7152 * g + 0.0722 * b

    def contrast(a, b):
        la, lb = lum(a), lum(b)
        return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)

    def color(spec, tok, depth=0):
        spec = spec.strip()
        m = re.match(r"var\(--([a-z0-9-]+)\)", spec)
        if m:
            return color(tok[m.group(1)], tok, depth + 1)
        if spec.startswith("#"):
            h = spec.lstrip("#")
            return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
        m = re.match(r"rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)", spec)
        return (int(m.group(1)), int(m.group(2)), int(m.group(3)), float(m.group(4)))

    def blend(fg, bg):
        return tuple(round(fg[i] * fg[3] + bg[i] * (1 - fg[3])) for i in range(3))

    section(" · Nonogram: tương phản màu riêng của bàn")
    tk, pz = rd("assets", "css", "tokens.css"), rd("assets", "css", "puzzle.css")
    ng = {"pz-ng-fill": "var(--pz-user)", "pz-ng-x": "var(--text-3)", "pz-ng-head": "var(--s2)", "pz-ng-num": "var(--text)", "pz-ng-num-done": "var(--text-3)"}
    css = rd("assets", "css", "board-nonogram.css")
    ck(all(("--%s: %s;" % (k, v)) in css for k, v in ng.items()), "các biến --pz-ng-* trong board-nonogram.css đúng như bảng đo (bí danh của token nên tự đổi theo sáng/tối)")
    for mode in ("sáng", "tối"):
        tok = dict(block(tk, r"^:root"))
        tok.update(block(pz, r"^:root"))
        if mode == "tối":
            tok.update(block(tk, r':root\[data-theme="dark"\]'))
            tok.update(block(pz, r':root\[data-theme="dark"\]'))
        tok.update(ng)
        col = lambda n: color("var(--%s)" % n, tok)
        over = lambda top, bg: blend(col(top), col(bg))
        pairs = [
            ("chữ manh mối / nền đầu", col("pz-ng-num"), col("pz-ng-head"), 4.5),
            ("chữ manh mối đã khớp / nền đầu", col("pz-ng-num-done"), col("pz-ng-head"), 4.5),
            ("chữ manh mối lỗi / nền lỗi", col("pz-conflict-text"), over("pz-conflict", "pz-ng-head"), 4.5),
            ("chữ manh mối / nền gợi ý", col("pz-ng-num"), over("pz-hint", "pz-ng-head"), 4.5),
            ("chữ manh mối / nền replay", col("pz-ng-num"), over("pz-replay", "pz-ng-head"), 4.5),
            ("chữ manh mối / nền dòng đang chọn", col("pz-ng-num"), over("pz-select", "pz-ng-head"), 4.5),
            ("chữ đã khớp (text-2) / nền dòng chọn", col("text-2"), over("pz-select", "pz-ng-head"), 4.5),
            ("chữ đã khớp (text-2) / nền gợi ý", col("text-2"), over("pz-hint", "pz-ng-head"), 4.5),
            ("chữ đã khớp (text-2) / nền replay", col("text-2"), over("pz-replay", "pz-ng-head"), 4.5),
            ("ô tô / nền ô", col("pz-ng-fill"), col("pz-cell"), 3.0),
            ("dấu ✕ / nền ô", col("pz-ng-x"), col("pz-cell"), 3.0),
            ("ô tô báo lỗi (danger) / nền ô", col("danger"), col("pz-cell"), 3.0),
            ("✕ báo lỗi / nền lỗi", col("pz-conflict-text"), over("pz-conflict", "pz-cell"), 3.0),
            ("viền chọn (accent) / nền ô", col("accent"), col("pz-cell"), 3.0),
            ("lỗi ở ô nhập (danger) / nền", col("danger"), col("elev"), 4.5),
            ("nút dụng cụ đang chọn: accent-fg / accent", col("accent-fg"), col("accent"), 4.5),
        ]
        bad = [(n, round(contrast(a, b), 2), need) for n, a, b, need in pairs if contrast(a, b) < need]
        ck(not bad, "giao diện %s: %d cặp màu riêng của bàn đạt (chữ ≥ 4,5:1, thành phần ≥ 3:1)" % (mode, len(pairs)), bad)


# ============================================================================================ cảm ứng thật
def touch_tests(T, tid, ck):
    pg = T.pg
    cdp = pg.context.new_cdp_session(pg)

    def ts(kind, pts):
        cdp.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": [{"x": x, "y": y, "id": i} for i, (x, y) in enumerate(pts)]})

    def tap(x, y):
        ts("touchStart", [(x, y)]); ts("touchEnd", [])

    T.start(tid, "10", "easy", next_seed())
    pg.wait_for_selector(".pz-ng-grid .pz-ng-cell")
    pg.wait_for_timeout(300)
    g = pg.evaluate(GAME_JS)
    W = g["w"]
    ta = pg.evaluate("getComputedStyle(document.querySelector('.pz-ng-grid')).touchAction")
    ck(ta == "none", "lưới có touch-action: none (kéo tô không bị trình duyệt cuộn trang)", ta)
    x, y = center(pg, 3 * W + 3)
    tap(x, y)
    pg.wait_for_timeout(150)
    ck(T.game()["v"][3 * W + 3] == 1, "chạm ngón tay vào ô → tô")
    tap(x, y)
    pg.wait_for_timeout(150)
    ck(T.game()["v"][3 * W + 3] == 0, "chạm lần hai bằng ngón tay → gỡ")
    cells = [5 * W + c for c in range(1, 6)]
    pts = [center(pg, i) for i in cells]
    top0 = pg.evaluate("(document.querySelector('.pane-main') || document.scrollingElement).scrollTop")
    before = T.game()
    ts("touchStart", [pts[0]])
    for p in pts[1:]:
        ts("touchMove", [(p[0], p[1] + 6)])
    ts("touchEnd", [])
    pg.wait_for_timeout(200)
    after = T.game()
    top1 = pg.evaluate("(document.querySelector('.pane-main') || document.scrollingElement).scrollTop")
    ck(sorted(diff(before["v"], after["v"])) == cells and after["moves"] == before["moves"] + 1, "một ngón kéo ngang 5 ô → đúng 5 ô, MỘT nước đi", (diff(before["v"], after["v"]), after["moves"]))
    ck(top1 == top0, "kéo trên lưới không cuộn trang (scrollTop %s → %s)" % (top0, top1))
    # hai ngón cuộn bàn 25×25
    pg.evaluate("location.hash = '#/'")
    pg.wait_for_timeout(150)
    pg.evaluate(START_BIG, 25)
    pg.wait_for_selector(".pz-ng-grid .pz-ng-cell")
    pg.wait_for_timeout(500)
    m0 = T.game()["moves"]
    sl0 = pg.evaluate("document.querySelector('.pz-ng-scroll').scrollLeft")
    ctr = center(pg, 12 * 25 + 12)
    a = (ctr[0] - 130, ctr[1]); b = (ctr[0] - 70, ctr[1])          # hai ngón đều trong phần lưới nhìn thấy
    ts("touchStart", [a, b])
    for d in (10, 25, 40, 60, 80):
        ts("touchMove", [(a[0] - d, a[1]), (b[0] - d, b[1])])
    ts("touchEnd", [])
    pg.wait_for_timeout(200)
    sl1 = pg.evaluate("document.querySelector('.pz-ng-scroll').scrollLeft")
    ck(sl1 > sl0 + 30 and T.game()["moves"] == m0, "hai ngón kéo sang trái cuộn bàn lớn (scrollLeft %d → %d) và không tô nhầm ô nào" % (sl0, sl1), (sl0, sl1, T.game()["moves"], m0))
    # một ngón rồi thêm ngón thứ hai: huỷ nét đang kéo
    pg.evaluate("document.querySelector('.pz-ng-scroll').scrollLeft = 0")
    p0 = center(pg, 4 * 25 + 5)
    p1 = center(pg, 4 * 25 + 8)
    ts("touchStart", [p0])
    ts("touchMove", [(p1[0], p0[1])])
    ts("touchStart", [(p1[0], p0[1]), (p1[0] + 60, p0[1] + 60)])
    ts("touchEnd", [])
    pg.wait_for_timeout(200)
    ck(T.game()["moves"] == m0 and pg.locator(".pz-ng-cell.pv1").count() == 0, "đang kéo một ngón mà đặt thêm ngón thứ hai → huỷ nét, không tô gì, không còn xem trước")
    # kéo một ngón trên vùng manh mối cuộn được (native)
    sl2 = pg.evaluate("document.querySelector('.pz-ng-scroll').scrollLeft")
    geo = pg.evaluate("(() => { const s = document.querySelector('.pz-ng-scroll').getBoundingClientRect(), c = document.querySelector('.pz-ng-cols').getBoundingClientRect(); return [s.left + s.width * 0.65, c.top + c.height / 2]; })()")
    sx, sy = geo
    ts("touchStart", [(sx, sy)])
    for d in (10, 30, 60, 100):
        ts("touchMove", [(sx - d, sy)])
    ts("touchEnd", [])
    pg.wait_for_timeout(300)
    sl3 = pg.evaluate("document.querySelector('.pz-ng-scroll').scrollLeft")
    ck(sl3 != sl2, "kéo một ngón trên vùng manh mối cuộn bàn bằng cách thường (scrollLeft %d → %d)" % (sl2, sl3))
    T.go("#/", 200)


# ============================================================================================ trình soạn
def ed_mode(pg, mode):
    """Đưa trình soạn về chế độ draw|clue (bản nháp đã khôi phục có thể đang ở chế độ kia; có thể hiện hộp thoại xác nhận)."""
    lab = "Vẽ ảnh" if mode == "draw" else "Nhập manh mối"
    if pg.get_attribute(".pz-ng-seg button:has-text('%s')" % lab, "aria-pressed") != "true":
        pg.click(".pz-ng-seg button:has-text('%s')" % lab)
        pg.wait_for_timeout(300)
        if pg.locator("dialog[open]").count():
            pg.click("dialog[open] button:has-text('Chuyển')")
            pg.wait_for_timeout(300)


def editor_tests(P, tid, ck, section):
    pg = P.pg
    section(" · Nonogram: trình soạn (Vẽ ảnh / Nhập manh mối)")
    P.go("#/create/" + tid, 600)
    pg.wait_for_selector(".pz-ng-ed .pz-ng-grid .pz-ng-cell", timeout=15000)
    n0 = pg.locator(".pz-ng-ed .pz-ng-cell").count()
    ck(n0 == 100 and pg.get_attribute(".pz-ng-seg button:has-text('Vẽ ảnh')", "aria-pressed") == "true", "mở trình soạn: chế độ Vẽ ảnh, ảnh trống 10×10 (%d ô)" % n0)
    pg.wait_for_selector(".cr-chip", timeout=15000)
    ck(True, "vỏ hiện trạng thái kiểm tra ngay khi mở: " + pg.inner_text(".cr-chip").strip())
    # vẽ: kéo ngang hàng 1 (3 ô) + chạm 1 ô hàng 3
    drag(pg, [1, 2, 3])
    click_cell_ed = lambda i: pg.mouse.click(*center(pg, i))
    click_cell_ed(2 * 10 + 5)
    pg.wait_for_timeout(200)
    img = pg.evaluate("[...document.querySelectorAll('.pz-ng-ed .pz-ng-cell')].map(e => e.classList.contains('f') ? 1 : 0)")
    ck(img[1:4] == [1, 1, 1] and img[25] == 1 and sum(img) == 4, "kéo + chạm vẽ đúng 4 ô", sum(img))
    ct = pg.evaluate(CLUE_TEXT_JS)
    ck(ct["rows"][0] == [3] and ct["rows"][2] == [1] and ct["cols"][1] == [1] and ct["cols"][5] == [1] and ct["rows"][5] == [0], "manh mối tính tự động bên cạnh ảnh: hàng 1 = 3, hàng 3 = 1, hàng trống = 0", (ct["rows"][:3], ct["cols"][:6]))
    pg.wait_for_function("document.querySelector('.cr-chip') && !/Đang kiểm tra/.test(document.querySelector('.cr-status').innerText)", timeout=15000)
    pg.wait_for_timeout(700)
    chip = pg.inner_text(".cr-chip")
    ck("nghiệm" in chip, "sau khi vẽ, vỏ hiện trạng thái nghiệm: «%s»" % chip.strip())
    # xoá bằng kéo bắt đầu trên ô đã tô
    drag(pg, [1, 2])
    img = pg.evaluate("[...document.querySelectorAll('.pz-ng-ed .pz-ng-cell')].map(e => e.classList.contains('f') ? 1 : 0)")
    ck(img[1] == 0 and img[2] == 0 and img[3] == 1, "kéo bắt đầu trên ô đã tô → xoá (không tô)")
    pg.click("button:has-text('Đảo ảnh')")
    img = pg.evaluate("[...document.querySelectorAll('.pz-ng-ed .pz-ng-cell')].map(e => e.classList.contains('f') ? 1 : 0)")
    ck(sum(img) == 100 - 2, "Đảo ảnh: %d ô tô (100 − 2)" % sum(img))
    pg.click("button:has-text('Xoá hết')")
    ck(pg.locator(".pz-ng-ed .pz-ng-cell.f").count() == 0, "Xoá hết → ảnh trống")
    pg.click("button:has-text('Ảnh ngẫu nhiên')")
    ck(pg.locator(".pz-ng-ed .pz-ng-cell.f").count() > 0, "Ảnh ngẫu nhiên: có ô tô")
    # đổi cỡ
    pg.select_option("#ng-ed-w", "5")
    pg.select_option("#ng-ed-h", "7")
    pg.wait_for_timeout(200)
    ck(pg.locator(".pz-ng-ed .pz-ng-cell").count() == 35, "đổi cỡ 5 (rộng) × 7 (cao) → 35 ô")
    pg.click("button:has-text('Xoá hết')")
    drag(pg, [0, 1, 2, 3, 4])
    pg.wait_for_timeout(900)
    # nhập manh mối: bộ clue duy nhất 5×5
    pg.select_option("#ng-ed-h", "5")
    pg.click(".pz-ng-seg button:has-text('Nhập manh mối')")
    pg.wait_for_selector("#ng-ed-r0")
    ck(pg.locator(".pz-ng-ed input[type='text']").count() == 10, "chế độ Nhập manh mối: 5 ô nhập hàng + 5 ô nhập cột")
    for i, t in enumerate(["1", "2", "3", "4", "5"]):
        pg.fill("#ng-ed-r%d" % i, t)
    for i, t in enumerate(["5", "4", "3", "2", "1"]):
        pg.fill("#ng-ed-c%d" % i, t)
    pg.wait_for_function("(() => { const c = document.querySelector('.cr-chip'); return c && /một nghiệm/.test(c.innerText); })()", timeout=15000)
    ck(True, "nhập manh mối hàng 1,2,3,4,5 / cột 5,4,3,2,1 → vỏ báo «%s»" % pg.inner_text(".cr-chip").strip())
    ck("khớp" in pg.inner_text(".pz-ng-totals"), "dòng tổng: " + pg.inner_text(".pz-ng-totals"))
    # lỗi theo dòng
    pg.fill("#ng-ed-r1", "x 2")
    pg.fill("#ng-ed-r2", "9 9")
    pg.fill("#ng-ed-r3", "")
    pg.wait_for_timeout(200)
    m1, m2, m3 = [pg.inner_text("#ng-ed-r%d-e" % i) for i in (1, 2, 3)]
    ck(m1 and m2 and m3 and pg.get_attribute("#ng-ed-r1", "aria-invalid") == "true" and "Cần ít nhất" in m2 and "Chưa nhập" in m3, "mỗi dòng sai báo lỗi riêng + aria-invalid", (m1, m2, m3))
    pg.wait_for_function("(() => { const c = document.querySelector('.cr-chip'); return c && /Vô nghiệm/.test(c.innerText); })()", timeout=15000)
    ck("không hợp lệ" in pg.inner_text(".cr-status") or "cần ít nhất" in pg.inner_text(".cr-status").lower(), "vỏ cũng báo lỗi của engine cho manh mối sai: " + pg.inner_text(".cr-status").replace("\n", " | ")[:140])
    pg.fill("#ng-ed-r1", "2"); pg.fill("#ng-ed-r2", "3"); pg.fill("#ng-ed-r3", "4")
    pg.wait_for_timeout(300)
    # tổng hai bên lệch
    pg.fill("#ng-ed-r4", "4")
    pg.wait_for_timeout(300)
    ck("khác" in pg.inner_text(".pz-ng-totals"), "tổng hàng ≠ tổng cột được cảnh báo: " + pg.inner_text(".pz-ng-totals"))
    # chuyển lại Vẽ ảnh (hỏi xác nhận vì manh mối tay lệch ảnh)
    pg.click(".pz-ng-seg button:has-text('Vẽ ảnh')")
    pg.wait_for_selector("dialog[open]")
    pg.click("dialog[open] button:has-text('Chuyển')")
    pg.wait_for_selector(".pz-ng-ed .pz-ng-grid .pz-ng-cell")
    ck(pg.get_attribute(".pz-ng-seg button:has-text('Vẽ ảnh')", "aria-pressed") == "true", "chuyển về Vẽ ảnh (sau khi xác nhận)")

    # --- gọi trực tiếp editor(): khởi tạo từ input/puzzle, hình dạng onChange
    section(" · Nonogram: trình soạn — khởi tạo và hình dạng dữ liệu phát ra")
    P.go("#/", 300)
    res = pg.evaluate(r"""() => {
      const T = Puz.types.get('nonogram'), out = {};
      function open(env) {
        const host = document.createElement('div'); host.style.width = '640px'; document.body.append(host);
        const calls = [];
        const ev = Puz.boards.nonogram.editor(host, Object.assign({ input: null, puzzle: null, onChange: x => calls.push(JSON.parse(JSON.stringify(x))), U: Puz.ui, ctx: Puz.ui.app.ctx(), type: T }, env));
        const r = { calls: calls.length, first: calls[0], input: ev.getInput(), cells: host.querySelectorAll('.pz-ng-cell').length, inputs: host.querySelectorAll('input[type=text]').length,
          drawOn: host.querySelector('.pz-ng-seg button[aria-pressed=true]').innerText.trim(), v1: host.querySelector('input[type=text]') && host.querySelector('input[type=text]').value, fi: T.fromInput(ev.getInput()) };
        r.fiOk = r.fi.ok; r.fiStatus = r.fi.status; delete r.fi; ev.destroy(); host.remove(); return r;
      }
      out.blank = open({});
      const img = []; for (let i = 0; i < 20; i++) img.push(i % 3 === 0 ? 1 : 0);
      out.imgIn = open({ input: { w: 5, h: 4, image: img } });
      out.strIn = open({ input: { w: 3, h: 3, image: '#.#\n.#.\n#.#' } });
      out.clueIn = open({ input: { w: 5, h: 5, rows: [[1], [2], [3], [4], [5]], cols: [[5], [4], [3], [2], [1]] } });
      const p = T.generate(424242, { sizeId: '5', tier: 'easy' });
      out.puz = open({ puzzle: p }); out.puzSol = p.solution.v.map(v => v === 1 ? 1 : 0); out.puzW = p.data.w;
      out.badIn = open({ input: { w: 99, h: 2, image: [1] } });
      return out;
    }""")
    b = res["blank"]
    ck(b["calls"] == 1 and b["first"]["w"] == 10 and b["first"]["h"] == 10 and len(b["first"]["image"]) == 100 and set(b["first"]["image"]) == {0} and b["fiOk"], "không có input: onChange gọi đúng 1 lần với {w,h,image} 10×10 trống; fromInput ok", (b["calls"], b["fiOk"]))
    i1 = res["imgIn"]
    ck(i1["cells"] == 20 and i1["input"]["w"] == 5 and i1["input"]["h"] == 4 and i1["input"]["image"] == [1 if i % 3 == 0 else 0 for i in range(20)] and i1["drawOn"] == "Vẽ ảnh" and i1["calls"] == 1, "khởi tạo từ input {w,h,image}: 20 ô, ảnh giữ nguyên, chế độ Vẽ ảnh, onChange 1 lần")
    s1 = res["strIn"]
    ck(s1["cells"] == 9 and s1["input"]["image"] == [1, 0, 1, 0, 1, 0, 1, 0, 1], "khởi tạo từ ảnh dạng chuỗi '#.#' → 9 ô đúng", s1["input"])
    c1 = res["clueIn"]
    ck(c1["drawOn"] == "Nhập manh mối" and c1["inputs"] == 10 and c1["v1"] == "1" and c1["input"]["rows"] == [[1], [2], [3], [4], [5]] and c1["input"]["cols"] == [[5], [4], [3], [2], [1]] and c1["fiOk"] and c1["fiStatus"] == "unique", "khởi tạo từ input {w,h,rows,cols}: chế độ Nhập manh mối, phát lại {w,h,rows,cols} đúng, fromInput duy nhất", c1["input"])
    pz = res["puz"]
    ck(pz["drawOn"] == "Vẽ ảnh" and pz["input"]["image"] == res["puzSol"] and pz["fiOk"] and pz["fiStatus"] == "unique", "khởi tạo từ env.puzzle (có solution): vẽ lại ảnh đáp án; fromInput → duy nhất")
    bd = res["badIn"]
    ck(bd["cells"] == 100 and bd["calls"] == 1, "input hỏng (w=99) → rơi về ảnh trống 10×10, không ném lỗi")

    # --- co giãn trình soạn
    section(" · Nonogram: trình soạn co giãn 280–1280px")
    issues = []
    for w in (280, 360, 768, 1280):
        pg.set_viewport_size({"width": w, "height": 800})
        for mode in ("draw", "clue"):
            P.go("#/create/" + tid, 450)
            pg.wait_for_selector(".pz-ng-ed .pz-ng-seg", timeout=15000)
            ed_mode(pg, "draw")
            pg.select_option("#ng-ed-w", "25")
            pg.select_option("#ng-ed-h", "25")
            pg.wait_for_timeout(250)
            pg.click("button:has-text('Ảnh ngẫu nhiên')")
            pg.wait_for_timeout(200)
            if mode == "clue":
                pg.click(".pz-ng-seg button:has-text('Nhập manh mối')")
                pg.wait_for_selector("#ng-ed-r0")
                pg.wait_for_timeout(200)
            bad = pg.evaluate(OVERFLOW_JS)
            small = pg.evaluate("Math.min(...[...document.querySelectorAll('.pz-ng-ed button, .pz-ng-ed select, .pz-ng-ed input')].filter(e => e.offsetParent !== null).map(e => e.getBoundingClientRect().height))")
            if bad:
                issues.append("%dpx %s: %s" % (w, mode, "; ".join(bad[:2])))
            if small < 43.5:
                issues.append("%dpx %s: điều khiển cao %.1fpx < 44" % (w, mode, small))
    ck(not issues, "trình soạn 25×25 ở cả hai chế độ: không tràn ngang trang, điều khiển ≥ 44px", issues)
    pg.set_viewport_size({"width": 1366, "height": 860})
    P.go("#/", 200)


# ============================================================================================ WebKit (tiến trình con)
def stable_bbox(pg, sel):
    """Hộp bao của phần tử sau khi bố cục đã yên (hai lần đo cách nhau 150 ms giống nhau): tránh chạm trượt khi ô còn đang đổi cỡ."""
    last = None
    pg.locator(sel).scroll_into_view_if_needed()                  # màn iPhone chỉ cao 664px: ô có thể nằm dưới nếp gập
    for _ in range(20):
        bb = pg.locator(sel).bounding_box()
        if bb and last and all(abs(bb[k] - last[k]) < 0.5 for k in ("x", "y", "width", "height")):
            return bb
        last = bb
        pg.wait_for_timeout(150)
    return last


def webkit_main(url):
    from playwright.sync_api import sync_playwright

    def out(ok, msg, detail=""):
        print(("PASS:" if ok else "FAIL:") + msg + ("|" + str(detail) if detail != "" else ""))
        sys.stdout.flush()

    with sync_playwright() as pw:
        try:
            br = pw.webkit.launch()
        except Exception as e:
            print("SKIP:" + str(e).splitlines()[0])
            return 0
        dev = dict(pw.devices["iPhone 13"])
        dev["service_workers"] = "block"
        ctx = br.new_context(**dev)
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(url, wait_until="load")
        pg.wait_for_function("document.body.classList.contains('ready')", timeout=30000)
        pg.evaluate("h => { location.hash = h }", "#/new/nonogram?size=10&tier=easy&seed=5550101&go=1")
        pg.wait_for_selector(".pz-ng-grid .pz-ng-cell", timeout=60000)
        pg.wait_for_timeout(500)
        g = pg.evaluate(GAME_JS)
        W = g["w"]
        out(pg.locator(".pz-ng-cell").count() == W * g["h"], "lưới 10×10 được vẽ")
        out(pg.evaluate("getComputedStyle(document.querySelector('.pz-ng-grid')).touchAction") == "none", "touch-action: none trên lưới")
        bad = pg.evaluate(OVERFLOW_JS)
        out(not bad, "trang không tràn ngang ở 390px", bad[:2])
        bb = stable_bbox(pg, ".pz-ng-cell[data-i='%d']" % (3 * W + 3))
        pg.touchscreen.tap(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2)
        pg.wait_for_timeout(250)
        v = pg.evaluate(GAME_JS)["v"]
        out(v[3 * W + 3] == 1, "chạm (touchscreen.tap) vào ô → tô", v[3 * W + 3])
        pg.touchscreen.tap(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2)
        pg.wait_for_timeout(250)
        out(pg.evaluate(GAME_JS)["v"][3 * W + 3] == 0, "chạm lần hai → gỡ")
        # kéo: PointerEvent cảm ứng tổng hợp (WebKit của Playwright không có API kéo cảm ứng)
        cells = [5 * W + c for c in range(1, 5)]
        res = pg.evaluate("""(cells) => {
          const g = document.querySelector('.pz-ng-grid'), pts = cells.map(i => { const r = document.querySelector('.pz-ng-cell[data-i="' + i + '"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
          const ev = (t, p) => g.dispatchEvent(new PointerEvent(t, { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: p[0], clientY: p[1], button: 0, buttons: t === 'pointerup' ? 0 : 1 }));
          ev('pointerdown', pts[0]); for (let k = 1; k < pts.length; k++) ev('pointermove', pts[k]);
          const pv = document.querySelectorAll('.pz-ng-cell.pv1').length; ev('pointerup', pts[pts.length - 1]); return pv; }""", cells)
        gg = pg.evaluate(GAME_JS)
        out(res == 4 and sorted(diff([0] * len(gg["v"]), gg["v"])) == sorted(cells) and gg["moves"] == 3, "kéo cảm ứng qua 4 ô → xem trước 4 ô, thả tay = MỘT nước đi (moves=%d)" % gg["moves"], (res, gg["moves"], diff([0] * len(gg["v"]), gg["v"])))
        pg.click(".toolbar button:has-text('Hoàn tác')")
        out(pg.evaluate(GAME_JS)["v"][5 * W + 1] == 0, "Hoàn tác lùi cả nét trên WebKit")
        # trình soạn
        pg.evaluate("h => { location.hash = h }", "#/create/nonogram")
        pg.wait_for_selector(".pz-ng-ed .pz-ng-cell", timeout=20000)
        pg.wait_for_timeout(400)
        bb = stable_bbox(pg, ".pz-ng-ed .pz-ng-cell[data-i='12']")
        pg.touchscreen.tap(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2)
        pg.wait_for_timeout(400)
        nf = pg.locator(".pz-ng-ed .pz-ng-cell.f").count()
        rc = pg.evaluate("[...document.querySelectorAll('.pz-ng-rows .pz-ng-clue')].slice(0, 3).map(e => e.innerText.trim())")
        out(nf == 1 and rc[1] == "1", "trình soạn: chạm vẽ một ô → manh mối hàng 2 = 1", (nf, rc))
        pg.click(".pz-ng-seg button:has-text('Nhập manh mối')")
        pg.wait_for_selector("#ng-ed-r0")
        pg.fill("#ng-ed-r0", "9 9")
        pg.wait_for_timeout(300)
        out("Cần ít nhất" in pg.inner_text("#ng-ed-r0-e"), "trình soạn: nhập manh mối sai báo lỗi dòng")
        out(not errs, "không có lỗi JS trên WebKit", errs[:2])
        ctx.close()
        br.close()
    return 0


# ============================================================================================ chạy riêng
def main():
    args = sys.argv[1:]
    if args and args[0] == "--webkit":
        return webkit_main(args[1])
    import importlib.util
    spec = importlib.util.spec_from_file_location("lps_check", os.path.join(HERE, "check.py"))
    C = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(C)
    from playwright.sync_api import sync_playwright
    url = "http://127.0.0.1:8767/index.html"
    if "--url" in args:
        url = args[args.index("--url") + 1]
    may = None
    if "--may-chu-that" in args:
        may = C.K.MayChuThu([]).__enter__()
        url = may.goc + C.PATH
    try:
        with sync_playwright() as pw:
            br = pw.chromium.launch()
            P = C.Page(br, url, "desk", viewport={"width": 1366, "height": 860}, permissions=["clipboard-read", "clipboard-write"])
            C.section("Bàn Nonogram (riêng)")
            C.ERRORS[:] = []
            n = run(P, C.check, C.section, "nonogram")
            P.close()
            br.close()
    finally:
        if may:
            may.__exit__(None, None, None)
    if C.ERRORS:
        print("\nLỗi console/pageerror (%d):" % len(C.ERRORS))
        for e in C.ERRORS[:10]:
            print("   ", e)
        C.check(False, "không lỗi JS/console")
    print("\n%d đạt, %d sai" % (C.OK, C.FAIL))
    return 1 if C.FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
