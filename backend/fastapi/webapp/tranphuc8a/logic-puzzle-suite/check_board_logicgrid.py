#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kiểm RIÊNG giao diện bàn Logic Grid + trình soạn (assets/js/ui/boards/logicgrid.js + assets/css/board-logicgrid.css) bằng trình duyệt thật.

check.py (tầng 2) tự nạp tệp này và gọi run(P, check, section, tid) với P là trang Chromium máy tính đang mở app.
Có thể chạy rời bằng:  python check_board_logicgrid.py  (tự dựng máy chủ thử như check.py) — in số phép đạt/sai.

Phủ: số khối = K(K-1)/2 và N×N ô/khối khớp state, nhãn hàng/cột thẳng hàng với ô (cả khối chuyển vị của bậc thang) · danh sách manh mối khớp puzzle.data.clues ·
chạm ô theo vòng trống → ✗ → ✓ → trống, hình ✓/✗ khác nhau (SVG), dụng cụ Đúng/Loại/Xoá · autoRemove: ✓ kéo theo ✗ cùng hàng/cột trong MỘT lần hoàn tác · ô conflict (đối chiếu engine) ·
bảng "Đã xác định" theo ✓ liên thông · bàn phím (mũi tên, sang khối kề, V/X/Delete/Space/Enter, roving tabindex) · gợi ý tô đúng ô + manh mối, chuyển khối ở chế độ từng khối ·
manh mối "đã dùng" (nhớ qua đổi bố cục và vào lại ván) · giải 3x3 bằng giao diện thật → "Đã giải" · replay chỉ xem · không tràn ngang 280/360/768/1280 (5x5) + nút ≥ 44 px ·
độ tương phản màu riêng (sáng + tối) · chữ lạ vào DOM bằng textContent · trình soạn (nhóm, mục, thứ tự, dòng sai báo lỗi dưới đúng dòng, ví dụ → đúng một nghiệm, bản nháp đúng dạng fromInput) ·
chạm thật + vuốt đổi khối trên Chromium di động (CDP) · WebKit iPhone 13 (tiến trình con)."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CELL = ".pz-lg-cell"
SEED0 = 20261217


def GJS(body):
    """Hàm JS chạy trong trang với `g` = ván đang mở ở #/play/<id> (không dùng eval)."""
    return r"""() => { const m = /#\/play\/([^?]+)/.exec(location.hash); const g = Puz.ui.app.ctx().getGame(decodeURIComponent(m[1])); const T = Puz.types.get('logicgrid'); """ + body + " }"


def sel(i):
    return "%s[data-i='%d']" % (CELL, i)


# ------------------------------------------------------------------------------------------------ đo màu (độc lập với check.py)
def _lum(c):
    def f(v):
        v /= 255.0
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (f(x) for x in c[:3])
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def _contrast(a, b):
    la, lb = _lum(a), _lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def _over(fg, bg):
    a = fg[3] if len(fg) > 3 else 1.0
    return tuple(fg[i] * a + bg[i] * (1 - a) for i in range(3))


def _parse(s):
    s = s.strip()
    if s.startswith("#"):
        s = s.lstrip("#")
        if len(s) == 3:
            s = "".join(ch * 2 for ch in s)
        return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))
    m = re.match(r"rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?\s*\)", s)
    if not m:
        raise ValueError("không đọc được màu: " + s)
    return (float(m.group(1)), float(m.group(2)), float(m.group(3)), float(m.group(4)) if m.group(4) else 1.0)


def _var(pg, name):
    v = pg.evaluate("n => getComputedStyle(document.documentElement).getPropertyValue(n).trim()", "--" + name)
    m = re.match(r"var\(--([a-z0-9-]+)\)", v)
    return _var(pg, m.group(1)) if m else v


def contrast_report(pg):
    """Mọi cặp chữ/dấu ↔ nền thật sự xuất hiện trên bàn (sáng + tối) → (số cặp, [cặp dưới ngưỡng]). Chữ ≥ 4,5; dấu ✓/✗ (đồ hoạ) ≥ 3, nhưng cũng báo nếu dưới 4,5."""
    low, total, soft = [], 0, []
    for theme in ("light", "dark"):
        pg.evaluate("t => { document.documentElement.dataset.theme = t }", theme)
        names = ("elev", "pz-cell", "pz-lg-head", "pz-lg-yes", "pz-lg-yes-bg", "pz-lg-no", "pz-lg-used", "text", "text-2", "text-3", "accent", "accent-fg", "accent-text", "accent-soft", "ok", "danger",
                 "pz-select", "pz-peer", "pz-hint", "pz-replay", "pz-conflict", "pz-conflict-text", "pz-good", "star", "s2")
        c = {k: _parse(_var(pg, k)) for k in names}
        base, head, elev = c["pz-cell"], c["pz-lg-head"], c["elev"]

        def bg(*layers, start=base):
            out = start
            for L in layers:
                out = _over(L, out)
            return out
        plan = [
            # (mô tả, màu chữ/dấu, nền, ngưỡng)
            ("nhãn mục", c["text"], bg(start=head), 4.5),
            ("nhãn mục đang chọn", c["accent-text"], bg(c["pz-select"], start=head), 4.5),
            ("manh mối", c["text"], bg(start=elev), 4.5),
            ("manh mối đã dùng (gạch)", c["pz-lg-used"], bg(start=elev), 4.5),
            ("manh mối được gợi ý", c["text"], bg(c["pz-hint"], start=elev), 4.5),
            ("số thứ tự manh mối", c["accent-text"], bg(c["accent-soft"], start=elev), 4.5),
            ("bảng đã xác định: đúng", c["pz-lg-yes"], bg(start=elev), 4.5),
            ("bảng đã xác định: mâu thuẫn", c["pz-conflict-text"], bg(start=elev), 4.5),
            ("bảng đã xác định: chưa biết", c["text-3"], bg(start=elev), 4.5),
            ("chú thích/tiêu đề phụ", c["text-2"], bg(start=elev), 4.5),
            ("nhóm khối đã đủ ✓ (chip)", c["ok"], bg(start=elev), 4.5),
            ("chip thường", c["text-2"], bg(start=elev), 4.5),
            ("chip/công cụ đang chọn", c["accent-fg"], bg(start=c["accent"]), 4.5),
            ("cảnh báo trình soạn", c["star"], bg(start=elev), 4.5),
            ("lỗi trình soạn", c["danger"], bg(start=elev), 4.5),
        ]
        glyph = []
        for lname, layers in (("nền", []), ("hàng/cột đang chọn", [c["pz-peer"]]), ("gợi ý", [c["pz-hint"]]), ("replay", [c["pz-replay"]])):
            glyph.append(("✗ trên ô " + lname, c["pz-lg-no"], bg(*layers), 3.0))
        for lname, layers in (("nền", [c["pz-lg-yes-bg"]]), ("hàng/cột đang chọn", [c["pz-lg-yes-bg"], c["pz-peer"]]), ("gợi ý", [c["pz-lg-yes-bg"], c["pz-hint"]]), ("replay", [c["pz-lg-yes-bg"], c["pz-replay"]])):
            glyph.append(("✓ trên ô " + lname, c["pz-lg-yes"], bg(*layers), 3.0))
        glyph.append(("dấu trên ô mâu thuẫn", c["pz-conflict-text"], bg(c["pz-conflict"]), 3.0))
        for name, fg, b, th in plan + glyph:
            fgc = _over(fg, b) if len(fg) > 3 and fg[3] < 1 else fg[:3]
            r = _contrast(fgc, b)
            total += 1
            if r < th:
                low.append("%s · %s: %.2f < %.1f" % (theme, name, r, th))
            elif r < 4.5 and th < 4.5:
                soft.append("%s · %s: %.2f" % (theme, name, r))
    pg.evaluate("document.documentElement.dataset.theme = 'light'")
    return total, low, soft


# ------------------------------------------------------------------------------------------------ tiện ích
def PZ(P):
    return P.pg.evaluate(GJS(r"""return { K: g.puzzle.data.cats.length, N: g.puzzle.data.cats[0].items.length, cats: g.puzzle.data.cats.map(c => ({ name: c.name, items: c.items })), nclues: g.puzzle.data.clues.length,
      total: g.state.v.length, sol: g.puzzle.solution.v.slice(), texts: g.puzzle.data.clues.map((c, k) => T.clueText(g.puzzle, k)), blocks: T.blocks(g.puzzle), id: g.id };"""))


def cls_set(pg, c):
    return set(pg.evaluate("c => [...document.querySelectorAll('.pz-lg-cell.' + c)].map(e => +e.dataset.i)", c))


def vattr(pg, i):
    return int(pg.get_attribute(sel(i), "data-v"))


def fresh(P, size="4x4", tier="easy", seed=SEED0, layout=None, auto=None):
    """Vào ván mới của đúng (cỡ, bậc, seed), bảo đảm bàn ở trạng thái đầu, công cụ Vòng; layout = 'ladder' | 'single' để ép bố cục."""
    pg = P.pg
    P.start("logicgrid", size, tier, seed)
    wait_board(pg, size)
    g = P.game()
    if g["v"] != g["initial"] or g["moves"]:
        pg.evaluate(GJS("g.restart(); g.start();"))
        pg.wait_for_timeout(120)
    if auto is not None:
        pg.evaluate(GJS("g.setSettings({ autoRemove: %s });" % ("true" if auto else "false")))
    pg.wait_for_timeout(120)
    if pg.locator("button[data-tool='cycle']").count() and pg.get_attribute("button[data-tool='cycle']", "aria-pressed") != "true":
        pg.click("button[data-tool='cycle']")
    if layout and pg.locator(".pz-lg-layout button[data-layout='%s']" % layout).count() and pg.get_attribute(".pz-lg-layout button[data-layout='%s']" % layout, "aria-pressed") != "true":
        pg.click(".pz-lg-layout button[data-layout='%s']" % layout)
        pg.wait_for_timeout(200)
    return P.game()


def wait_board(pg, size):
    """Chờ bàn ĐÚNG cỡ (K×N) được vẽ (tránh đọc nhầm bàn cũ khi vừa đổi ván)."""
    K, N = int(size[0]), int(size[2])
    pg.wait_for_function("document.querySelectorAll('.pz-lg-cell').length === %d" % (K * (K - 1) // 2 * N * N), timeout=30000)
    pg.wait_for_timeout(120)


def click_cell(P, i, wait=70):
    P.pg.click(sel(i))
    P.pg.wait_for_timeout(wait)


def ci(pz, a_cat, a, b_cat, b):
    """Chỉ số ô theo công thức của engine (không dùng hàm của engine, để độc lập)."""
    K, N = pz["K"], pz["N"]
    if a_cat > b_cat:
        a_cat, a, b_cat, b = b_cat, b, a_cat, a
    return (a_cat * (2 * K - a_cat - 1) // 2 + (b_cat - a_cat - 1)) * N * N + a * N + b


def tap_targets(pg, selector):
    return pg.evaluate("s => [...document.querySelectorAll(s)].filter(e => !e.closest('[hidden]')).map(e => { const r = e.getBoundingClientRect(); return [(e.className.baseVal || e.className || e.tagName).toString().slice(0, 40), Math.round(r.height * 10) / 10]; })", selector)


OVERFLOW_BOARD = r"""() => {
  const W = innerWidth, bad = [];
  const scroller = (el) => { for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; };
  for (const el of document.querySelectorAll('.board-host *, .editor-host *')) {
    if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
    if (el.closest('[hidden]') || el.closest('[inert]')) continue;
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    if ((r.right > W + 1 || r.left < -1) && !scroller(el)) bad.push((el.className.baseVal !== undefined ? el.className.baseVal : el.className) + ' ' + Math.round(r.left) + '…' + Math.round(r.right));
  }
  return [document.documentElement.scrollWidth > W + 1, bad.slice(0, 4)];
}"""


# ================================================================================================ chạy
def run(P, check, section, tid):
    pg = P.pg
    pg.set_viewport_size({"width": 1280, "height": 900})
    pg.evaluate("document.documentElement.dataset.theme = 'light'")
    errs0 = len(P.errors)

    # ---------------------------------------------------------------- 1. cấu trúc: khối, ô, manh mối, nhãn
    g = fresh(P, "4x4", "easy", SEED0, layout="ladder", auto=False)
    pz = PZ(P)
    K, N = pz["K"], pz["N"]
    NN = N * N
    nb = K * (K - 1) // 2
    info = pg.evaluate("""() => { const bl = [...document.querySelectorAll('.pz-lg-block')], cs = [...document.querySelectorAll('.pz-lg-cell')];
      return { blocks: bl.length, per: bl.map(b => b.querySelectorAll('.pz-lg-cell').length), rows: bl.map(b => b.querySelectorAll('.pz-lg-row').length), roles: bl.every(b => b.getAttribute('role') === 'grid') && cs.every(c => c.getAttribute('role') === 'gridcell'),
        ids: cs.map(c => +c.dataset.i), parent: cs.every(c => +c.closest('.pz-lg-block').dataset.bi === Math.floor(+c.dataset.i / %d)), tab0: cs.filter(c => c.getAttribute('tabindex') === '0').length,
        area: document.querySelector('.pz-lg-area').className, titlesC: document.querySelectorAll('.pz-lg-gt.c').length, titlesR: document.querySelectorAll('.pz-lg-gt.r').length }; }""" % NN)
    check(info["blocks"] == nb and all(x == NN for x in info["per"]) and all(x == N for x in info["rows"]), "Logic Grid: %d nhóm × %d mục → %d khối, mỗi khối %d×%d ô (role=row ×%d)" % (K, N, nb, N, N, N), info["per"])
    check(sorted(info["ids"]) == list(range(pz["total"])) and info["parent"], "Logic Grid: %d ô khớp đúng độ dài state, data-i duy nhất 0…%d, mỗi ô nằm đúng khối blockIdx" % (pz["total"], pz["total"] - 1))
    check(info["roles"] and info["tab0"] == 1, "Logic Grid: khối role=grid, ô role=gridcell, đúng MỘT ô tabindex=0 trong cả bàn (roving)", info["tab0"])
    check("ladder" in info["area"] and info["titlesC"] == K - 1 and info["titlesR"] == K - 1, "Logic Grid: 1280 px → bố cục bậc thang (%d tiêu đề cột + %d tiêu đề hàng nhóm)" % (K - 1, K - 1), info)
    texts = pg.evaluate("[...document.querySelectorAll('.pz-lg-clue')].map(b => [b.querySelector('.n').textContent, b.querySelector('.t').textContent])")
    check(len(texts) == pz["nclues"] and [t[1] for t in texts] == pz["texts"] and [t[0] for t in texts] == [str(k + 1) for k in range(pz["nclues"])], "Manh mối: đúng %d dòng, đánh số 1…%d, đúng chữ type.clueText" % (pz["nclues"], pz["nclues"]), texts[:2])
    align = pg.evaluate(GJS(r"""const rl = [...document.querySelectorAll('.pz-lg-rl')], cl = [...document.querySelectorAll('.pz-lg-cl')], bad = []; let n = 0;
      for (const el of document.querySelectorAll('.pz-lg-cell')) { const i = +el.dataset.i, f = T.cellInfo(g.puzzle, i), r = el.getBoundingClientRect(), cy = r.top + r.height / 2, cx = r.left + r.width / 2;
        const row = rl.find(l => { const q = l.getBoundingClientRect(); return cy > q.top && cy < q.bottom; }), col = cl.find(l => { const q = l.getBoundingClientRect(); return cx > q.left && cx < q.right; });
        const rt = row ? row.textContent : '', ct = col ? col.textContent : '', tr = f.ci >= 1;
        const ok = tr ? (rt.startsWith(f.bName) && ct.startsWith(f.aName)) : (rt.startsWith(f.aName) && ct.startsWith(f.bName)); n++;
        if (!ok && bad.length < 3) bad.push([i, rt, ct, f.aName, f.bName]); }
      return { n, bad };"""))
    check(align["n"] == pz["total"] and not align["bad"], "Bậc thang: nhãn hàng (lề trái) và nhãn cột (phía trên) thẳng hàng đúng với MỌI ô, kể cả khối chuyển vị (%d ô)" % align["n"], align["bad"])
    labs = pg.evaluate("[...document.querySelectorAll('.pz-lg-cell')].map(c => [c.getAttribute('aria-label'), +c.dataset.i])")
    pairs = pg.evaluate(GJS("return Array.from({length: g.state.v.length}, (_, i) => { const f = T.cellInfo(g.puzzle, i); return f.aName + ' — ' + f.bName + ': chưa đánh dấu'; });"))
    check(all(l[0] == pairs[l[1]] for l in labs), "Mọi ô có aria-label dạng «An — Đỏ: chưa đánh dấu» (từ cellInfo)", [l for l in labs if l[0] != pairs[l[1]]][:2])

    # ---------------------------------------------------------------- 2. chạm ô: vòng trống → ✗ → ✓ → trống; hình ✓/✗ khác nhau
    a = 1 * N + 2
    m0 = P.game()["moves"]
    click_cell(P, a)
    g1 = P.game()
    shape_no = pg.evaluate("s => { const e = document.querySelector(s + ' svg'); if (!e) return null; const r = e.getBoundingClientRect(); return { cls: e.getAttribute('class'), d: e.querySelector('path').getAttribute('d'), w: Math.round(r.width), h: Math.round(r.height) }; }", sel(a))
    check(g1["v"][a] == 2 and g1["moves"] == m0 + 1 and "no" in pg.get_attribute(sel(a), "class").split() and shape_no and "mk-no" in shape_no["cls"], "Chạm ô trống → ✗ (state=2, +1 nước, lớp no, SVG gạch chéo)", (g1["v"][a], shape_no))
    check("đã loại" in pg.get_attribute(sel(a), "aria-label") and vattr(pg, a) == 2, "ô ✗: aria-label «đã loại», data-v=2", pg.get_attribute(sel(a), "aria-label"))
    click_cell(P, a)
    g2 = P.game()
    shape_yes = pg.evaluate("s => { const e = document.querySelector(s + ' svg'); const r = e.getBoundingClientRect(); return { cls: e.getAttribute('class'), d: e.querySelector('path').getAttribute('d'), w: Math.round(r.width), h: Math.round(r.height) }; }", sel(a))
    check(g2["v"][a] == 1 and "yes" in pg.get_attribute(sel(a), "class").split() and "mk-yes" in shape_yes["cls"], "Chạm lần hai → ✓ (state=1, lớp yes, SVG dấu tích)", (g2["v"][a], shape_yes))
    check(shape_yes["d"] != shape_no["d"] and "M" in shape_no["d"][1:] and "M" not in shape_yes["d"][1:] and shape_yes["w"] >= 12 and shape_no["w"] >= 12,
          "✓ và ✗ phân biệt bằng HÌNH (đường vẽ khác: dấu tích một nét, gạch chéo hai nét; cỡ ≥ 12 px), không chỉ màu", (shape_yes, shape_no))
    check("chắc chắn đúng" in pg.get_attribute(sel(a), "aria-label"), "ô ✓: aria-label «chắc chắn đúng»", pg.get_attribute(sel(a), "aria-label"))
    click_cell(P, a)
    g3 = P.game()
    check(g3["v"][a] == 0 and pg.locator(sel(a) + " svg").count() == 0 and "chưa đánh dấu" in pg.get_attribute(sel(a), "aria-label") and g3["moves"] == m0 + 3, "Chạm lần ba → trống (không còn SVG, aria-label chưa đánh dấu)", g3["v"][a])
    # dụng cụ
    b2 = 2 * N + 1
    pg.click("button[data-tool='yes']")
    check(pg.get_attribute("button[data-tool='yes']", "aria-pressed") == "true" and pg.get_attribute("button[data-tool='cycle']", "aria-pressed") == "false", "Dụng cụ Đúng: aria-pressed đổi theo")
    click_cell(P, b2)
    v1 = P.game()["v"][b2]
    click_cell(P, b2)
    v2 = P.game()["v"][b2]
    check(v1 == 1 and v2 == 0, "Dụng cụ Đúng: chạm ô trống → ✓, chạm lại → xoá", (v1, v2))
    pg.click("button[data-tool='no']")
    click_cell(P, b2)
    v1 = P.game()["v"][b2]
    click_cell(P, b2)
    v2 = P.game()["v"][b2]
    check(v1 == 2 and v2 == 0, "Dụng cụ Loại: chạm ô trống → ✗, chạm lại → xoá", (v1, v2))
    click_cell(P, b2)
    mv = P.game()["moves"]
    pg.click("button[data-tool='erase']")
    click_cell(P, b2)
    click_cell(P, b2)
    gg = P.game()
    check(gg["v"][b2] == 0 and gg["moves"] == mv + 1, "Dụng cụ Xoá: xoá dấu; chạm ô đang trống không tạo nước đi", (gg["v"][b2], gg["moves"] - mv))
    pg.click("button[data-tool='cycle']")
    # chuột phải = ✓
    pg.click(sel(b2), button="right")
    pg.wait_for_timeout(80)
    check(P.game()["v"][b2] == 1, "Chuột phải trên ô → ✓ (không hiện menu trình duyệt)")
    pg.click(sel(b2), button="right")
    pg.wait_for_timeout(80)
    check(P.game()["v"][b2] == 0, "Chuột phải lần nữa → bỏ ✓")

    # ---------------------------------------------------------------- 3. autoRemove: một lần hoàn tác lùi hết
    fresh(P, "4x4", "easy", SEED0, layout="ladder", auto=True)
    pg.click("button[data-tool='yes']")
    c0 = 1 * N + 1                                                       # khối 0 (nhóm 0 × nhóm 1), hàng 1, cột 1
    click_cell(P, c0)
    gA = P.game()
    ring = [1 * N + k for k in range(N) if k != 1] + [r * N + 1 for r in range(N) if r != 1]
    check(gA["v"][c0] == 1 and all(gA["v"][i] == 2 for i in ring) and gA["moves"] == 1 and gA["undo"] == 1, "autoRemove: ✓ kéo theo ✗ cho %d ô cùng hàng/cột trong CÙNG diff (1 nước, 1 mục hoàn tác)" % len(ring), (sum(1 for i in ring if gA["v"][i] == 2), gA["undo"]))
    check(all(vattr(pg, i) == 2 for i in ring) and "no" in pg.get_attribute(sel(ring[0]), "class").split(), "autoRemove: các ô ✗ phụ cũng được VẼ (data-v=2, lớp no)")
    pg.click(".toolbar button:has-text('Hoàn tác')")
    gB = P.game()
    check(gB["v"] == gB["initial"] and cls_set(pg, "yes") == set() and cls_set(pg, "no") == set(), "Một lần Hoàn tác lùi hết ✓ và mọi ✗ phụ (state và bàn vẽ về trống)")
    pg.click(".toolbar button:has-text('Làm lại')")
    check(P.game()["v"] == gA["v"] and cls_set(pg, "yes") == {c0}, "Làm lại áp lại đúng ✓ + ✗ phụ")
    pg.click("button[data-tool='cycle']")

    # ---------------------------------------------------------------- 4. ô conflict
    fresh(P, "4x4", "easy", SEED0, layout="ladder", auto=False)
    pg.click("button[data-tool='yes']")
    solv = pz["sol"]
    colb = [b for b in range(N) if solv[ci(pz, 0, 0, 1, b)] == 1][0]
    p1 = ci(pz, 0, 0, 1, colb)                                             # ✓ đúng theo lời giải
    p2 = ci(pz, 0, 1, 1, colb)                                             # ✓ thứ hai CÙNG cột (sai) → hai ✓ vi phạm
    click_cell(P, p1)
    check(cls_set(pg, "conflict") == set(), "Một ✓ đúng lời giải chưa vi phạm: không có ô conflict")
    click_cell(P, p2)
    eng = set(pg.evaluate(GJS("return T.check(g.puzzle, g.state).conflicts;")))
    check(len(eng) >= 2 and cls_set(pg, "conflict") == eng, "Hai ✓ cùng cột: ô conflict trên bàn (%d ô) đúng bằng check().conflicts của engine" % len(eng), (sorted(cls_set(pg, "conflict")), sorted(eng)))
    check("mâu thuẫn" in pg.get_attribute(sel(p1), "aria-label"), "ô conflict: aria-label nói «mâu thuẫn»", pg.get_attribute(sel(p1), "aria-label"))
    cb = pg.evaluate("s => { const e = document.querySelector(s); const cs = getComputedStyle(e); return [cs.backgroundImage !== 'none', cs.boxShadow !== 'none']; }", sel(p1))
    check(cb[0] and cb[1], "ô conflict tô nền + viền đậm (không chỉ màu chữ)", cb)
    pg.evaluate("Puz.ui.app.ctx().user.setSetting('showConflicts', false)")
    pg.wait_for_timeout(120)
    pg.click(".toolbar button:has-text('Hoàn tác')")
    pg.click(".toolbar button:has-text('Làm lại')")
    check(cls_set(pg, "conflict") == set(), "Tắt «Tô ô xung đột» trong Cài đặt → bàn không tô conflict")
    pg.evaluate("Puz.ui.app.ctx().user.setSetting('showConflicts', true)")
    pg.click(".toolbar button:has-text('Hoàn tác')")
    pg.click(".toolbar button:has-text('Làm lại')")
    check(cls_set(pg, "conflict") == eng, "Bật lại → ô conflict tô lại đúng")
    pg.click("button[data-tool='cycle']")

    # ---------------------------------------------------------------- 5. bảng "đã xác định" theo ✓ liên thông
    g = fresh(P, "4x4", "easy", SEED0, layout="ladder", auto=False)
    sol = pz["sol"]
    row_a = 0
    colb = [b for b in range(N) if sol[ci(pz, 0, row_a, 1, b)] == 1][0]
    colc = [c for c in range(N) if sol[ci(pz, 1, colb, 2, c)] == 1][0]
    pg.click("button[data-tool='yes']")
    click_cell(P, ci(pz, 0, row_a, 1, colb))
    cell_txt = lambda r, c: pg.inner_text(".pz-lg-sumtab tbody tr:nth-child(%d) td:nth-child(%d)" % (r + 1, c + 1)).strip()
    check(cell_txt(row_a, 1) == pz["cats"][1]["items"][colb] and "·" in cell_txt(row_a, 2),
          "Bảng «Đã xác định»: ✓ (%s, %s) → hàng %s hiện «%s»" % (pz["cats"][0]["items"][row_a], pz["cats"][1]["items"][colb], pz["cats"][0]["items"][row_a], pz["cats"][1]["items"][colb]), cell_txt(row_a, 1))
    check("1/" in pg.inner_text(".pz-lg-sum h3"), "tiêu đề bảng đếm «1/%d»" % (N * (K - 1)), pg.inner_text(".pz-lg-sum h3"))
    click_cell(P, ci(pz, 1, colb, 2, colc))
    check(cell_txt(row_a, 1) == pz["cats"][1]["items"][colb] and cell_txt(row_a, 2) == pz["cats"][2]["items"][colc],
          "Bắc cầu: ✓ (%s–%s) rồi ✓ (%s–%s) → hàng %s hiện cả «%s» và «%s» dù ô (%s, %s) chưa đánh" % (pz["cats"][0]["items"][row_a], pz["cats"][1]["items"][colb], pz["cats"][1]["items"][colb], pz["cats"][2]["items"][colc], pz["cats"][0]["items"][row_a], pz["cats"][1]["items"][colb], pz["cats"][2]["items"][colc], pz["cats"][0]["items"][row_a], pz["cats"][2]["items"][colc]),
          (cell_txt(row_a, 1), cell_txt(row_a, 2)))
    check(P.game()["v"][ci(pz, 0, row_a, 2, colc)] == 0 and "2/" in pg.inner_text(".pz-lg-sum h3"), "…và ô bắc cầu thật sự vẫn trống (không bị ghi), đếm «2/%d»" % (N * (K - 1)))
    # nối mà chưa biết thuộc ai
    click_cell(P, ci(pz, 1, (colb + 1) % N, 2, [c for c in range(N) if sol[ci(pz, 1, (colb + 1) % N, 2, c)] == 1][0]))
    check("chưa biết thuộc" in pg.inner_text(".pz-lg-orph"), "Cặp ✓ chưa gắn với ai hiện ở dòng «Đã nối nhưng chưa biết thuộc … nào»", pg.inner_text(".pz-lg-orph"))
    pg.click("button[data-tool='cycle']")
    # đổi bố cục không mất dấu / bảng
    pg.click(".pz-lg-layout button[data-layout='single']")
    pg.wait_for_timeout(250)
    check(cls_set(pg, "yes") == {i for i, v in enumerate(P.game()["v"]) if v == 1} and len(cls_set(pg, "yes")) == 3, "Đổi sang «Từng khối»: các ✓ vẫn đủ ở bàn mới dựng (3 ô)")
    pg.click(".pz-lg-layout button[data-layout='ladder']")
    pg.wait_for_timeout(250)

    # ---------------------------------------------------------------- 6. bàn phím
    g = fresh(P, "4x4", "easy", SEED0, layout="ladder", auto=False)
    pg.focus(sel(0))
    pg.keyboard.press("ArrowRight")
    pg.keyboard.press("ArrowDown")
    act = pg.evaluate("+document.activeElement.dataset.i")
    check(act == N + 1, "Bàn phím: → rồi ↓ từ ô 0 → focus ô %d" % (N + 1), act)
    pg.keyboard.press("End")
    check(pg.evaluate("+document.activeElement.dataset.i") == N + (N - 1), "End → cuối hàng", pg.evaluate("+document.activeElement.dataset.i"))
    pg.keyboard.press("Home")
    k0 = pg.evaluate("+document.activeElement.dataset.i")
    pg.keyboard.press("v")
    check(P.game()["v"][k0] == 1, "Phím V đặt ✓", P.game()["v"][k0])
    pg.keyboard.press("x")
    check(P.game()["v"][k0] == 2, "Phím X đặt ✗")
    pg.keyboard.press("Delete")
    check(P.game()["v"][k0] == 0, "Phím Delete xoá dấu")
    pg.keyboard.press("Space")
    s1 = P.game()["v"][k0]
    pg.keyboard.press("Enter")
    s2 = P.game()["v"][k0]
    pg.keyboard.press("Space")
    s3 = P.game()["v"][k0]
    check((s1, s2, s3) == (2, 1, 0), "Space/Enter áp dụng dụng cụ Vòng: trống → ✗ → ✓ → trống", (s1, s2, s3))
    check(pg.evaluate("document.querySelectorAll(\".pz-lg-cell[tabindex='0']\").length") == 1 and pg.evaluate("document.activeElement.getAttribute('tabindex')") == "0", "Roving tabindex: đúng một ô tabindex=0 và nó đang giữ focus")
    pg.focus(sel(N - 1))                                                  # cột cuối, hàng 0 của khối 0 → → sang khối (0,2)
    pg.keyboard.press("ArrowRight")
    to = pg.evaluate("+document.activeElement.dataset.i")
    check(to == ci(pz, 0, 0, 2, 0), "Bậc thang: → ở cột cuối khối nhảy sang khối kề bên phải (ô %d)" % ci(pz, 0, 0, 2, 0), to)
    pg.focus(sel(ci(pz, 0, N - 1, 1, 2)))                                 # hàng cuối khối 0, cột 2 → ↓ sang khối bên dưới (cùng nhóm cột)
    pg.keyboard.press("ArrowDown")
    to = pg.evaluate("+document.activeElement.dataset.i")
    check(to == ci(pz, 1, 2, K - 1, 0), "Bậc thang: ↓ ở hàng cuối khối nhảy sang khối bên dưới, đúng cột (ô %d)" % ci(pz, 1, 2, K - 1, 0), to)
    pg.keyboard.press("Escape")
    check(pg.locator(".pz-lg-cell.sel").count() == 0, "Esc bỏ chọn ô")
    sc = pg.evaluate("document.activeElement.closest('.pz-lg-block') !== null")
    check(sc, "Focus vẫn nằm trong bàn sau Esc")

    # ---------------------------------------------------------------- 7. chọn ô tô hàng/cột + nhãn
    click_cell(P, 2 * N + 3)
    peers = cls_set(pg, "peer") | cls_set(pg, "sel")
    expect = {2 * N + k for k in range(N)} | {r * N + 3 for r in range(N)}
    check(cls_set(pg, "sel") == {2 * N + 3} and peers == expect, "Chọn ô: tô nhạt đúng hàng + cột trong khối (%d ô) và đánh dấu ô chọn" % len(expect), (sorted(peers), sorted(expect)))
    lit = pg.evaluate("[...document.querySelectorAll('.pz-lg-rl.on, .pz-lg-cl.on')].map(e => [e.className, e.textContent])")
    check(len(lit) == 2 and any("rl" in x[0] and x[1].startswith(pz["cats"][0]["items"][2]) for x in lit) and any("cl" in x[0] and x[1].startswith(pz["cats"][1]["items"][3]) for x in lit),
          "Chọn ô: tô đậm đúng nhãn hàng «%s» và nhãn cột «%s»" % (pz["cats"][0]["items"][2], pz["cats"][1]["items"][3]), lit)

    # ---------------------------------------------------------------- 8. gợi ý: tô ô + manh mối; chuyển khối ở chế độ từng khối
    fresh(P, "4x4", "easy", SEED0, layout="ladder", auto=False)
    pg.click(".toolbar button:has-text('Gợi ý')")
    pg.wait_for_selector(".hint-panel:not([hidden]) .hint-text")
    lh = pg.evaluate(GJS("return { cells: g.lastHint.cells, clues: (g.lastHint.regions && g.lastHint.regions.clues) || [], level: g.lastHint.level };"))
    check(lh["level"] == 1 and len(lh["cells"]) >= 1 and cls_set(pg, "hint") == set(lh["cells"]), "Gợi ý mức 1: tô đúng %d ô trong hint.cells (hàng của nhóm 0)" % len(lh["cells"]), (sorted(cls_set(pg, "hint")), lh["cells"]))
    hl = set(pg.evaluate("[...document.querySelectorAll('.pz-lg-clue')].map((b, k) => b.classList.contains('hl-hint') ? k : -1).filter(k => k >= 0)"))
    check(len(lh["clues"]) >= 1 and hl == set(lh["clues"]), "Gợi ý mức 1: tô đúng manh mối hint.regions.clues %s" % sorted(lh["clues"]), (sorted(hl), lh["clues"]))
    pg.click(".hint-panel button:has-text('Chi tiết hơn')")
    lh2 = pg.evaluate(GJS("return { cells: g.lastHint.cells, level: g.lastHint.level };"))
    check(lh2["level"] == 2 and cls_set(pg, "hint") == set(lh2["cells"]) and len(lh2["cells"]) == 1, "Gợi ý mức 2: tô đúng MỘT ô %s, đổi theo mức" % lh2["cells"], (sorted(cls_set(pg, "hint")), lh2["cells"]))
    pg.click(".hint-panel button:has-text('Chi tiết hơn')")
    m0 = P.game()["moves"]
    pg.click(".hint-panel button:has-text('Áp dụng nước này')")
    check(P.game()["moves"] == m0 + 1 and cls_set(pg, "hint") == set() and pg.locator(".pz-lg-clue.hl-hint").count() == 0, "Áp dụng gợi ý: ô được áp, tô gợi ý (ô + manh mối) tắt")
    # từng khối: tự chuyển sang khối chứa ô gợi ý
    fresh(P, "4x4", "easy", SEED0 + 5, layout="single", auto=False)
    pz2 = PZ(P)
    last = pz2["K"] * (pz2["K"] - 1) // 2 - 1
    pg.click(".pz-lg-chip[data-bi='%d']" % last)
    pg.wait_for_timeout(150)
    check(pg.get_attribute(".pz-lg-chip[data-bi='%d']" % last, "aria-selected") == "true" and pg.locator(".pz-lg-sb:not([hidden])").count() == 1, "Từng khối: chạm chip → hiện đúng một khối, chip aria-selected")
    pg.click(".toolbar button:has-text('Gợi ý')")
    pg.wait_for_selector(".hint-panel:not([hidden]) .hint-text")
    lh = pg.evaluate(GJS("return { cells: g.lastHint.cells };"))
    want = lh["cells"][0] // (pz2["N"] ** 2)
    vis = pg.evaluate("+document.querySelector('.pz-lg-sb:not([hidden]) .pz-lg-block').dataset.bi")
    hv = pg.evaluate("document.querySelectorAll('.pz-lg-sb:not([hidden]) .pz-lg-cell.hint').length")
    check(vis == want and want != last and hv == len(lh["cells"]), "Từng khối: gợi ý ở khối %d → tự chuyển từ khối %d sang khối %d và tô %d ô" % (want, last, want, hv), (vis, want, hv))
    check(pg.get_attribute(".pz-lg-chip[data-bi='%d']" % want, "aria-selected") == "true", "…chip của khối đó được chọn")
    pg.click(".hint-panel button:has-text('Ẩn gợi ý')")
    check(cls_set(pg, "hint") == set(), "Ẩn gợi ý → xoá tô ô")

    # ---------------------------------------------------------------- 9. manh mối "đã dùng"
    g = fresh(P, "4x4", "easy", SEED0, layout="ladder", auto=False)
    pg.click(".pz-lg-clue[data-k='1']")
    pg.click(".pz-lg-clue[data-k='3']")
    info = pg.evaluate("[...document.querySelectorAll('.pz-lg-clue')].map(b => [b.classList.contains('used'), b.getAttribute('aria-pressed')])")
    dec = pg.evaluate("getComputedStyle(document.querySelector('.pz-lg-clue[data-k=\"1\"] .t')).textDecorationLine")
    check([x[0] for x in info] == [False, True, False, True] + [False] * (len(info) - 4) and info[1][1] == "true" and "line-through" in dec, "Chạm manh mối → gạch «đã dùng» (lớp used, aria-pressed, gạch ngang)", (info[:4], dec))
    check(pg.inner_text(".pz-lg-ccnt").replace(" ", "").startswith("2/%d" % pz["nclues"]), "Bộ đếm «2/%d đã dùng»" % pz["nclues"], pg.inner_text(".pz-lg-ccnt"))
    pg.click(".pz-lg-layout button[data-layout='single']")
    pg.wait_for_timeout(200)
    check(pg.locator(".pz-lg-clue.used").count() == 2, "Đổi bố cục: manh mối đã gạch vẫn còn")
    gid = P.game()["id"]
    P.go("#/", 300)
    P.go("#/play/" + gid, 500)
    pg.wait_for_selector(CELL)
    check(pg.locator(".pz-lg-clue.used").count() == 2, "Rời ván rồi vào lại: manh mối đã gạch được nhớ (trong phiên)")
    pg.click(".pz-lg-clue[data-k='1']")
    check(pg.locator(".pz-lg-clue.used").count() == 1, "Chạm lần nữa → bỏ gạch")
    pg.click(".pz-lg-fold")
    check(pg.get_attribute(".pz-lg-fold", "aria-expanded") == "false" and pg.locator(".pz-lg-clist:visible").count() == 0, "Nút «Thu gọn» ẩn danh sách (aria-expanded=false)")
    pg.click(".pz-lg-fold")
    check(pg.locator(".pz-lg-clist:visible").count() == 1, "…và «Mở rộng» hiện lại")

    # ---------------------------------------------------------------- 10. giải một ván 3x3 easy bằng giao diện thật
    g = fresh(P, "3x3", "easy", SEED0 + 1, layout="ladder", auto=True)
    pz3 = PZ(P)
    pg.click("button[data-tool='yes']")
    ones = [i for i, v in enumerate(pz3["sol"]) if v == 1]
    clicked = 0
    for i in ones:
        if P.game()["status"] != "playing":
            break
        if P.game()["v"][i] != 1:
            click_cell(P, i, 90)
            clicked += 1
    pg.wait_for_selector("dialog[open] h2:has-text('Đã giải')", timeout=15000)
    check(P.game()["status"] == "solved" and clicked >= 1 and P.game()["v"][ones[0]] == 1, "Giải 3x3 bằng cách chạm %d ô ✓ theo lời giải → hộp thoại «Đã giải!» (status solved)" % clicked, clicked)
    check(not any(P.game()["v"][i] == 1 for i in range(len(pz3["sol"])) if pz3["sol"][i] == 2), "…và không có ✓ nào ở ô sai")
    h = [r for r in P.history() if r["type"] == tid][-1:]
    check(h and h[0]["result"] == "solved" and h[0]["mistakes"] == 0, "Lịch sử ghi 'solved', 0 lỗi", h)

    # ---------------------------------------------------------------- 11. replay: chỉ xem
    pg.click("dialog[open] button:has-text('Xem lời giải từng bước')")
    pg.wait_for_selector(".replay-panel:not([hidden])", timeout=20000)
    pg.wait_for_selector(CELL)
    check(pg.locator(".pz-lg-tool").count() == 0 and pg.locator(".pz-lg-cell.yes, .pz-lg-cell.no").count() == 0, "Replay: bàn chỉ xem (không có dụng cụ), bắt đầu từ bàn trống")
    pg.click(".replay-panel button:has-text('Sau')")
    pg.wait_for_timeout(150)
    rp = pg.evaluate("({ replay: [...document.querySelectorAll('.pz-lg-cell.replay')].length, marked: document.querySelectorAll('.pz-lg-cell.yes, .pz-lg-cell.no').length })")
    check(rp["replay"] >= 1 and rp["marked"] >= 1, "Replay bước 1: tô xanh ô của bước (%d ô) và ô được đánh dấu hiện ra" % rp["replay"], rp)
    before = pg.evaluate("[...document.querySelectorAll('.pz-lg-cell')].map(c => c.getAttribute('data-v')).join('')")
    pg.click(sel(5))
    pg.keyboard.press("v")
    pg.wait_for_timeout(100)
    after = pg.evaluate("[...document.querySelectorAll('.pz-lg-cell')].map(c => c.getAttribute('data-v')).join('')")
    check(before == after, "Replay: chạm ô và phím V KHÔNG sửa bàn (readOnly)", (before, after))
    pg.click(".replay-panel button[aria-label='Tới cuối']")
    pg.wait_for_timeout(150)
    check(cls_set(pg, "yes") == set(ones), "Replay tới cuối: đúng các ✓ của lời giải hiện đủ (%d ô)" % len(ones), sorted(cls_set(pg, "yes")))
    pg.click(".replay-panel button:has-text('Thoát replay')")

    # ---------------------------------------------------------------- 12. co giãn + nút ≥ 44
    bad_all, small = [], []
    for w in (280, 360, 768, 1280):
        pg.set_viewport_size({"width": w, "height": 900})
        fresh(P, "5x5", "easy", SEED0 + 2, auto=False)
        pg.wait_for_timeout(250)
        ov = pg.evaluate(OVERFLOW_BOARD)
        mode = pg.evaluate("document.querySelector('.pz-lg-area').className")
        if ov[0] or ov[1]:
            bad_all.append("%d px (%s): %s" % (w, mode, ov))
        t = [x for x in tap_targets(pg, ".pz-lg-tool, .pz-lg-chip, .pz-lg-layout button, .pz-lg-fold") if x[1] < 43.5]
        if t:
            small.append("%d px: %s" % (w, t[:3]))
        expect = "single" if w <= 360 else "ladder"
        if expect not in mode:
            bad_all.append("%d px: chọn bố cục %s, mong %s" % (w, mode, expect))
        # ép bậc thang ở khung hẹp: cuộn ngang TRONG vùng lưới, trang không tràn
        if w <= 360:
            pg.click(".pz-lg-layout button[data-layout='ladder']")
            pg.wait_for_timeout(250)
            ov2 = pg.evaluate(OVERFLOW_BOARD)
            sc = pg.evaluate("(() => { const s = document.querySelector('.pz-lg-scroll'); return s ? [s.scrollWidth, s.clientWidth] : null; })()")
            if ov2[0] or ov2[1] or not sc or sc[0] <= sc[1]:
                bad_all.append("%d px ép bậc thang: %s %s" % (w, ov2, sc))
    check(not bad_all, "5x5 ở 280/360/768/1280 px: không tràn ngang (kể cả ép bậc thang ở khung hẹp → cuộn trong vùng lưới); tự chọn từng khối ≤ 360, bậc thang ≥ 768", bad_all[:3])
    check(not small, "Nút công cụ/chip/bố cục/thu gọn cao ≥ 44 px ở mọi bề rộng", small[:3])
    pg.set_viewport_size({"width": 1280, "height": 900})
    # khung hẹp ở 3x3 vẫn bậc thang nếu ô vừa
    pg.set_viewport_size({"width": 360, "height": 800})
    fresh(P, "3x3", "easy", SEED0, auto=False)
    pg.wait_for_timeout(250)
    check("ladder" in pg.evaluate("document.querySelector('.pz-lg-area').className") and not pg.evaluate(OVERFLOW_BOARD)[0], "3x3 ở 360 px: ô còn đủ lớn nên vẫn là bậc thang, không tràn")
    pg.set_viewport_size({"width": 1280, "height": 900})

    # ---------------------------------------------------------------- 13. màu riêng
    fresh(P, "3x3", "easy", SEED0, auto=False)
    total, low, soft = contrast_report(pg)
    check(not low, "Độ tương phản màu riêng: %d cặp (chữ ≥ 4,5 · dấu ✓/✗ ≥ 3; sáng + tối) đều đạt%s" % (total, (" — dưới 4,5 nhưng ≥ 3 (đồ hoạ): " + "; ".join(soft)) if soft else ""), low)

    # ---------------------------------------------------------------- 14. chữ lạ vào DOM
    weird = pg.evaluate("""async () => { const T = Puz.types.get('logicgrid'); const r = T.fromInput({ cats: [{ name: 'Người', items: ['&lt;b&gt;An', 'Bình "x"', "Chi 'y'"] }, { name: 'Màu', items: ['&amp;Đỏ', 'Xanh\\\\n', 'Lục \\u202e'] }], clues: ['&lt;b&gt;An = &amp;Đỏ'] });
      if (!r.ok) return { ok: false, errors: r.errors }; Puz.ui.app.ctx().startGame(r.puzzle, { source: 'custom' }); return { ok: true }; }""")
    if weird.get("ok"):
        pg.wait_for_selector(CELL)
        pg.wait_for_timeout(200)
        wd = pg.evaluate("({ bold: document.querySelectorAll('.pz-lg-rl b, .pz-lg-clue b, .pz-lg-sum b, .board-host img, .board-host script').length, txt: [...document.querySelectorAll('.pz-lg-rl')].map(e => e.textContent).join('|'), clue: document.querySelector('.pz-lg-clue .t').textContent, xss: window.__xss === undefined })")
        check(wd["bold"] == 0 and "&lt;b&gt;An" in wd["txt"] and "&lt;b&gt;An" in wd["clue"] and wd["xss"], "Tên mục có ký tự lạ (&lt; &amp; dấu nháy) hiện NGUYÊN VĂN qua textContent, không thành thẻ HTML", wd)
    else:
        check(False, "dựng được đề có ký tự lạ để thử XSS", weird)

    # ---------------------------------------------------------------- 15. trình soạn
    editor_checks(P, check)
    check(len(P.errors) == errs0, "Logic Grid: không lỗi console/pageerror phát sinh trong các phép thử bàn + trình soạn", P.errors[errs0:errs0 + 3])
    touch_checks(P, check)
    webkit_checks(P, check)


# ================================================================================================ trình soạn
def reset_editor(P):
    pg = P.pg
    P.go("#/create/logicgrid", 500)
    pg.wait_for_selector(".pz-lg-ed", timeout=20000)
    pg.click(".ph-act button:has-text('Làm mới')")
    pg.click("dialog[open] button:has-text('Bắt đầu lại')")
    pg.wait_for_selector(".pz-lg-ed .pz-lg-gc", timeout=10000)
    pg.wait_for_timeout(300)


def editor_checks(P, check):
    pg = P.pg
    pg.set_viewport_size({"width": 1280, "height": 900})
    reset_editor(P)
    names = pg.evaluate("[...document.querySelectorAll('.pz-lg-gname')].map(i => i.value)")
    items = pg.evaluate("[...document.querySelectorAll('.pz-lg-gc')].map(g => [...g.querySelectorAll('.pz-lg-iname')].map(i => i.value))")
    check(names == ["Người", "Màu", "Nghề"] and all(len(x) == 3 for x in items) and items[0] == ["Alice", "Bob", "Carol"], "Trình soạn: mặc định 3 nhóm Người/Màu/Nghề × 3 mục như ví dụ", (names, items))
    check(pg.locator(".pz-lg-cin").count() == 1 and pg.locator(".pz-lg-gc.first").count() == 1 and "hàng" in pg.inner_text(".pz-lg-gc.first .pz-lg-gtag"), "…một dòng manh mối trống; nhóm đầu ghi chú là «hàng»")
    pg.wait_for_selector(".cr-chip", timeout=15000)
    check("nhiều nghiệm" in pg.inner_text(".cr-chip"), "Chưa có manh mối → vỏ báo «nhiều nghiệm»", pg.inner_text(".cr-chip"))
    pg.click("button:has-text('Dùng ví dụ')")
    pg.wait_for_selector(".cr-chip.c-ok", timeout=15000)
    check("một nghiệm" in pg.inner_text(".cr-chip") and pg.locator(".pz-lg-cin").count() == 4, "«Dùng ví dụ» (Alice/Bob/Carol + 4 manh mối) → «Có đúng một nghiệm» và độ khó", pg.inner_text(".cr-status").replace("\n", " | ")[:120])
    check(pg.locator(".pz-lg-rowmsg.ok").count() == 4 and "Alice" in pg.inner_text(".pz-lg-crow:nth-child(1) .pz-lg-rowmsg"), "Dòng đúng hiện câu tiếng Việt đọc được ngay dưới dòng", pg.inner_text(".pz-lg-crow:nth-child(1) .pz-lg-rowmsg"))
    # dòng sai: lỗi NGAY DƯỚI dòng đó
    pg.fill(".pz-lg-cin >> nth=1", "Bob <")
    pg.fill(".pz-lg-cin >> nth=0", "Alice != Zed")
    pg.wait_for_timeout(200)
    r0 = pg.evaluate("""() => { const li = document.querySelectorAll('.pz-lg-crow')[0], inp = li.querySelector('.pz-lg-cin'), msg = li.querySelector('.pz-lg-rowmsg'), a = inp.getBoundingClientRect(), b = msg.getBoundingClientRect();
      return { text: msg.textContent, bad: msg.classList.contains('bad'), below: b.top >= a.bottom - 1, invalid: inp.getAttribute('aria-invalid'), others: [...document.querySelectorAll('.pz-lg-crow')].map(l => l.querySelector('.pz-lg-rowmsg').classList.contains('bad')) }; }""")
    check(r0["bad"] and r0["below"] and "Dòng 1" in r0["text"] and "Zed" in r0["text"] and r0["invalid"] == "true", "Dòng sai «Alice != Zed»: báo «Dòng 1: Không tìm thấy mục «Zed»…» NGAY DƯỚI dòng (aria-invalid)", r0)
    check(r0["others"] == [True, True, False, False], "…chỉ đúng các dòng sai (1, 2) báo lỗi, dòng 3–4 vẫn đúng", r0["others"])
    pg.wait_for_selector(".cr-status .form-err", timeout=15000)
    check("Manh mối 1" in pg.inner_text(".cr-status") and "Manh mối 2" in pg.inner_text(".cr-status") and pg.locator(".cr-chip.c-ok").count() == 0, "Vỏ cũng báo lỗi của engine (fromInput) với đúng số dòng", pg.inner_text(".cr-status").replace("\n", " | ")[:160])
    pg.fill(".pz-lg-cin >> nth=1", "Carol < Alice")
    pg.wait_for_timeout(200)
    t = pg.inner_text(".pz-lg-crow:nth-child(2) .pz-lg-rowmsg")
    check("có thứ tự" in t or "ordered" in t, "Phép so sánh khi chưa có nhóm có thứ tự → lỗi giải thích rõ", t)
    pg.fill(".pz-lg-cin >> nth=0", "Alice != Đỏ")
    pg.fill(".pz-lg-cin >> nth=1", "Xanh = Bob")
    pg.wait_for_timeout(200)
    check(pg.locator(".pz-lg-rowmsg.bad").count() == 0, "Sửa lại hai dòng → hết lỗi")
    pg.wait_for_selector(".cr-chip.c-ok", timeout=15000)
    check("một nghiệm" in pg.inner_text(".cr-chip"), "…và đề lại «có đúng một nghiệm»")
    # thêm / xoá mục + cảnh báo lệch
    pg.click(".pz-lg-gc:nth-child(1) button:has-text('Thêm mục')")
    pg.wait_for_timeout(200)
    check(pg.locator(".pz-lg-iname").count() == 10 and "khác nhóm đầu" in pg.inner_text(".pz-lg-warns") and pg.evaluate("document.activeElement.classList.contains('pz-lg-iname')"), "Thêm mục vào nhóm 1 → 4 mục, cảnh báo «khác nhóm đầu (4 mục)», ô mới nhận focus", pg.inner_text(".pz-lg-warns")[:100])
    pg.keyboard.type("Dan")
    pg.click("button[aria-label='Xoá mục 4 của nhóm Người']")
    pg.wait_for_timeout(200)
    check(pg.locator(".pz-lg-iname").count() == 9 and pg.locator(".pz-lg-warn").count() == 0, "Xoá mục vừa thêm → 3 mục, cảnh báo biến mất")
    pg.click("button[aria-label='Thêm một mục ở mọi nhóm']")
    pg.wait_for_timeout(200)
    check(pg.locator(".pz-lg-iname").count() == 12 and pg.inner_text(".pz-lg-stepn") == "4" and "mục trống" in pg.inner_text(".pz-lg-warns"), "Bộ đếm «Số mục mỗi nhóm» +: mọi nhóm 4 mục, cảnh báo mục trống", pg.inner_text(".pz-lg-warns")[:100])
    pg.click("button[aria-label='Bớt một mục ở mọi nhóm']")
    pg.wait_for_timeout(200)
    check(pg.locator(".pz-lg-iname").count() == 9 and pg.locator(".pz-lg-warn").count() == 0, "…và − trả về 3 mục, hết cảnh báo")
    # đổi tên mục → manh mối cập nhật
    pg.fill(".pz-lg-gc:nth-child(2) .pz-lg-iname >> nth=0", "Hồng")
    pg.wait_for_timeout(250)
    check(pg.locator(".pz-lg-crow:nth-child(1) .pz-lg-rowmsg.bad").count() == 1 and "Đỏ" in pg.inner_text(".pz-lg-crow:nth-child(1) .pz-lg-rowmsg"), "Đổi tên mục «Đỏ» → «Hồng»: dòng «Alice != Đỏ» báo lỗi ngay (kiểm lại cả khi sửa nhóm)", pg.inner_text(".pz-lg-crow:nth-child(1) .pz-lg-rowmsg"))
    pg.fill(".pz-lg-gc:nth-child(2) .pz-lg-iname >> nth=0", "Đỏ")
    pg.wait_for_timeout(250)
    # nhóm có thứ tự + từ vựng
    tpl_off = pg.get_attribute("button.tpl:has-text('A < B')", "aria-disabled")
    pg.click("button:has-text('Từ vựng gợi ý')")
    pg.click(".pz-lg-vocab button:has-text('Vị trí')")
    pg.wait_for_timeout(250)
    ordc = pg.evaluate("[...document.querySelectorAll('.pz-lg-gc')].map(g => [g.querySelector('.pz-lg-gname').value, g.querySelector('.pz-lg-ordcb').checked, [...g.querySelectorAll('.pz-lg-iname')].map(i => i.value), g.querySelectorAll('.pz-lg-ival').length])")
    check(len(ordc) == 4 and ordc[3][0] == "Vị trí" and ordc[3][1] and ordc[3][2] == ["1", "2", "3"] and ordc[3][3] == 3, "Từ vựng gợi ý → thêm nhóm «Vị trí» có thứ tự, mục 1-2-3, ô giá trị số cho từng mục", ordc[3])
    check(tpl_off == "true" and pg.get_attribute("button.tpl:has-text('A < B')", "aria-disabled") is None, "Nút mẫu «A < B» bị khoá khi chưa có nhóm có thứ tự và mở khi đã có")
    pg.fill(".pz-lg-cin >> nth=3", "Alice < Bob")
    pg.wait_for_timeout(250)
    check(pg.locator(".pz-lg-crow:nth-child(4) .pz-lg-rowmsg.ok").count() == 1 and "bên trái" in pg.inner_text(".pz-lg-crow:nth-child(4) .pz-lg-rowmsg"), "Có nhóm «Vị trí»: «Alice < Bob» hợp lệ, đọc là «… ở bên trái …»", pg.inner_text(".pz-lg-crow:nth-child(4) .pz-lg-rowmsg"))
    pg.fill(".pz-lg-cin >> nth=3", "Alice = Bob + 1")
    pg.wait_for_timeout(250)
    check(pg.locator(".pz-lg-crow:nth-child(4) .pz-lg-rowmsg.ok").count() == 1, "«A = B + k» (hơn kém k) hợp lệ", pg.inner_text(".pz-lg-crow:nth-child(4) .pz-lg-rowmsg"))
    pg.fill(".pz-lg-cin >> nth=3", "Alice next-to Bob")
    pg.wait_for_timeout(250)
    check(pg.locator(".pz-lg-crow:nth-child(4) .pz-lg-rowmsg.ok").count() == 1, "«A next-to B» (liền kề) hợp lệ")
    pg.fill(".pz-lg-cin >> nth=3", "Alice = Bob | Carol | Dan")
    pg.wait_for_timeout(250)
    check("Dan" in pg.inner_text(".pz-lg-crow:nth-child(4) .pz-lg-rowmsg"), "Mục không tồn tại trong «hoặc» → lỗi nêu đúng tên «Dan»")
    pg.wait_for_selector(".cr-status .form-err, .cr-chip", timeout=15000)
    # chèn tên mục / phép toán vào dòng đang soạn
    pg.fill(".pz-lg-cin >> nth=3", "")
    pg.click(".pz-lg-cin >> nth=3")
    pg.click(".pz-lg-pal button:has-text('Alice')")
    pg.click(".pz-lg-pal button:has-text('≠')")
    pg.click(".pz-lg-pal >> text='Xanh'")
    v = pg.input_value(".pz-lg-cin >> nth=3")
    check(v.replace("  ", " ").strip() == "Alice != Xanh" and pg.locator(".pz-lg-crow:nth-child(4) .pz-lg-rowmsg.ok").count() == 1, "Bảng chèn: bấm «Alice», «≠», «Xanh» ghép thành «Alice != Xanh» vào dòng đang soạn và hợp lệ", v)
    n0 = pg.locator(".pz-lg-cin").count()
    pg.click("button.tpl:has-text('A = B | C')")
    check(pg.locator(".pz-lg-cin").count() == n0 + 1 and pg.locator(".pz-lg-crow:last-child .pz-lg-rowmsg.ok").count() == 1, "Nút mẫu «A = B | C» thêm một dòng mẫu hợp lệ lấy từ mục thật của đề", pg.input_value(".pz-lg-crow:last-child .pz-lg-cin"))
    pg.click("summary:has-text('Bảng cú pháp')")
    check(pg.locator(".pz-lg-syn tbody tr").count() >= 8 and pg.locator(".pz-lg-syn:visible").count() == 1, "Bảng cú pháp (gập) mở ra liệt kê các mẫu")
    # hợp đồng onChange / getInput / env.input / env.puzzle (gắn trình soạn trực tiếp với env giả)
    contract = pg.evaluate("""async () => {
      const T = Puz.types.get('logicgrid'), out = {}; const host = document.createElement('div'); document.body.append(host);
      const calls = []; const ed = Puz.boards.logicgrid.editor(host, { input: null, puzzle: null, U: Puz.ui, ctx: {}, type: T, onChange: x => calls.push(JSON.parse(JSON.stringify(x))) });
      out.callsAtOpen = calls.length; out.first = calls[0]; out.same = JSON.stringify(ed.getInput()) === JSON.stringify(calls[calls.length - 1]); out.ok0 = T.fromInput(ed.getInput()).ok; ed.destroy(); host.remove();
      const h2 = document.createElement('div'); document.body.append(h2); const c2 = [];
      const e2 = Puz.boards.logicgrid.editor(h2, { input: { cats: [{ name: 'Hạng', items: ['x', 'y', 'z'], ordered: true, values: [1, 2, 5] }, { name: 'Mầu', items: ['đỏ', 'xanh', 'lục'] }], clues: ['x = đỏ', 'y = xanh'] }, puzzle: null, U: Puz.ui, ctx: {}, type: T, onChange: x => c2.push(x) });
      out.restore = { ord: h2.querySelector('.pz-lg-ordcb').checked, vals: [...h2.querySelectorAll('.pz-lg-ival')].map(i => i.value), rows: h2.querySelectorAll('.pz-lg-cin').length, input: e2.getInput(), calls: c2.length }; out.restoreOk = T.fromInput(e2.getInput()); e2.destroy(); h2.remove();
      const pz = await Puz.gen.generate('logicgrid', 77, { sizeId: '4x4', tier: 'easy' }); const h3 = document.createElement('div'); document.body.append(h3);
      const e3 = Puz.boards.logicgrid.editor(h3, { input: null, puzzle: pz, U: Puz.ui, ctx: {}, type: T, onChange: () => {} });
      const rows3 = [...h3.querySelectorAll('.pz-lg-cin')].map(i => i.value), dsl = pz.data.clues.map((c, k) => T.clueDSL(pz, k)); const re = T.fromInput(e3.getInput());
      out.puz = { same: JSON.stringify(rows3) === JSON.stringify(dsl), n: rows3.length, ok: re.ok, status: re.status, sameClues: re.ok && JSON.stringify(re.puzzle.data.clues) === JSON.stringify(pz.data.clues), score: re.score !== undefined ? re.score : (re.puzzle && re.puzzle.score) };
      e3.destroy(); h3.remove(); return out; }""")
    f = contract["first"]
    check(contract["callsAtOpen"] == 1 and contract["same"] and contract["ok0"] and len(f["cats"]) == 3 and set(f["cats"][0].keys()) == {"name", "items", "ordered", "values"} and f["clues"] == [], "editor(): gọi onChange đúng MỘT lần khi mở, getInput() trùng, input đúng dạng {cats:[{name,items,ordered,values}], clues:[]} và fromInput nhận", contract["first"])
    rs = contract["restore"]
    check(rs["ord"] and rs["vals"] == ["1", "2", "5"] and rs["rows"] == 2 and rs["input"]["cats"][0]["values"] == [1, 2, 5] and rs["input"]["clues"] == ["x = đỏ", "y = xanh"] and contract["restoreOk"]["ok"], "editor(): khôi phục từ env.input (nhóm có thứ tự, giá trị 1-2-5, 2 manh mối) và xuất lại nguyên dạng", rs)
    check(contract["puz"]["same"] and contract["puz"]["ok"] and contract["puz"]["status"] == "unique" and contract["puz"]["sameClues"], "editor(): khởi tạo từ env.puzzle: %d dòng DSL = type.clueDSL, fromInput(getInput()) ra đúng cùng bộ manh mối, nghiệm duy nhất" % contract["puz"]["n"], contract["puz"])
    # XSS trong trình soạn
    pg.fill(".pz-lg-cin >> nth=0", '<img src=x onerror="window.__xss=1"> = <b>x</b>')
    pg.fill(".pz-lg-gc:nth-child(3) .pz-lg-iname >> nth=0", '<img src=x onerror="window.__xss=2">')
    pg.wait_for_timeout(300)
    xs = pg.evaluate("({ img: document.querySelectorAll('.pz-lg-ed img, .pz-lg-ed script, .pz-lg-warns *:not(p), .pz-lg-rowmsg *, .create-side img').length, x: window.__xss === undefined, warns: document.querySelector('.pz-lg-warns').textContent.slice(0, 120) })")
    check(xs["img"] == 0 and xs["x"] and "ký tự không dùng được" in xs["warns"], "Trình soạn: HTML độc trong dòng manh mối/tên mục KHÔNG chạy, chỉ hiện như chữ (textContent)", xs)
    # cỡ nhỏ
    bad, small = [], []
    for w in (280, 360, 768, 1280):
        pg.set_viewport_size({"width": w, "height": 900})
        P.go("#/create/logicgrid", 400)
        pg.wait_for_selector(".pz-lg-ed", timeout=15000)
        ov = pg.evaluate(OVERFLOW_BOARD)
        if ov[0] or ov[1]:
            bad.append("%d px: %s" % (w, ov))
        sm = pg.evaluate("[...document.querySelectorAll('.pz-lg-ed button, .pz-lg-ed input[type=text], .pz-lg-ed summary')].filter(e => !e.closest('[hidden]')).map(e => [e.className.toString().slice(0, 30), Math.round(e.getBoundingClientRect().height * 10) / 10]).filter(x => x[1] < 43.5)")
        if sm:
            small.append("%d px: %s" % (w, sm[:3]))
    check(not bad, "Trình soạn 280/360/768/1280 px: không tràn ngang", bad[:3])
    check(not small, "Trình soạn: nút, ô nhập, tóm tắt cao ≥ 44 px ở mọi bề rộng", small[:3])
    pg.set_viewport_size({"width": 1280, "height": 900})
    reset_editor(P)


# ================================================================================================ chạm thật (Chromium di động)
def touch_checks(P, check):
    try:
        br = P.ctx.browser
        kw = dict(viewport={"width": 393, "height": 727}, device_scale_factor=2.75, has_touch=True, is_mobile=True,
                  user_agent="Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36")
        M = type(P)(br, P.url, "lg-di-dong", **kw)
    except Exception as e:  # noqa: BLE001
        check(False, "Logic Grid: mở Chromium di động để thử chạm thật", e)
        return
    try:
        pg = M.pg
        M.start("logicgrid", "4x4", "easy", SEED0 + 11)
        wait_board(pg, "4x4")
        pg.wait_for_timeout(200)
        area = pg.evaluate("document.querySelector('.pz-lg-area').className")
        check("single" in area, "Di động 393 px, 4x4: tự chọn bố cục «Từng khối» (ô bậc thang quá nhỏ để chạm)", area)
        pz = PZ(M)
        nb = pz["K"] * (pz["K"] - 1) // 2
        check(pg.locator(".pz-lg-sb:not([hidden])").count() == 1 and pg.locator(".pz-lg-chip").count() == nb, "…hiện một khối + %d chip chọn cặp nhóm" % nb)
        chips = pg.evaluate("[...document.querySelectorAll('.pz-lg-chip')].map(c => c.textContent.replace('✓', '').replace('!', '').trim())")
        want = [pz["cats"][b["ci"]]["name"] + " × " + pz["cats"][b["cj"]]["name"] for b in pz["blocks"]]
        check(chips == want, "Chip ghi đúng «Người × Màu», «Người × Nghề»… theo thứ tự khối", chips[:3])
        free = 1 * pz["N"] + 1
        pg.tap(sel(free))
        pg.wait_for_timeout(120)
        check(M.game()["v"][free] == 2, "Chạm (pointer touch) vào ô → ✗ (ô vẽ %d px)" % pg.evaluate("Math.round(document.querySelector('.pz-lg-cell').getBoundingClientRect().width)"))
        pg.tap("button[data-tool='yes']")
        pg.tap(sel(free))
        pg.wait_for_timeout(120)
        check(M.game()["v"][free] == 1, "Chạm nút «Đúng» rồi chạm ô đang ✗ → ✓ (dụng cụ, cảm ứng)", M.game()["v"][free])
        pg.tap("button[data-tool='cycle']")
        pg.tap(".pz-lg-chip[data-bi='2']")
        pg.wait_for_timeout(120)
        check(pg.evaluate("+document.querySelector('.pz-lg-sb:not([hidden]) .pz-lg-block').dataset.bi") == 2 and pg.get_attribute(".pz-lg-chip[data-bi='2']", "aria-selected") == "true", "Chạm chip thứ 3 → hiện khối 2, chip aria-selected")
        hs = tap_targets(pg, ".pz-lg-clue, .pz-lg-tool, .pz-lg-chip, .pz-lg-layout button, .pz-lg-fold")
        check(min(x[1] for x in hs) >= 43.5, "Di động: manh mối, công cụ, chip, nút bố cục cao ≥ 44 px (%s)" % sorted(set(round(x[1]) for x in hs)), [x for x in hs if x[1] < 43.5][:3])
        sc = pg.evaluate("[document.documentElement.scrollWidth, innerWidth]")
        check(sc[0] <= sc[1] and not pg.evaluate(OVERFLOW_BOARD)[1], "Di động 393 px: không tràn ngang", sc)
        # 3x3 ở 393: bậc thang chạm được
        M.start("logicgrid", "3x3", "easy", SEED0 + 12)
        wait_board(pg, "3x3")
        pg.wait_for_timeout(200)
        cw = pg.evaluate("[document.querySelector('.pz-lg-area').className, Math.round(document.querySelector('.pz-lg-cell').getBoundingClientRect().width)]")
        check("ladder" in cw[0] and cw[1] >= 30, "Di động 393 px, 3x3: bậc thang, ô %d px (≥ 30) chạm được" % cw[1], cw)
        pg.tap(sel(4))
        pg.wait_for_timeout(120)
        gg = M.game()
        check(gg["v"][4] == 2, "3x3 bậc thang trên cảm ứng: chạm ô → ✗", (gg["v"][4], gg["status"], gg["moves"]))
    finally:
        M.close()
    # vuốt thật bằng CDP ở một trang riêng (chuỗi chạm CDP thô làm Playwright không còn tạo click ở các lần tap sau trên cùng trang)
    try:
        M = type(P)(br, P.url, "lg-vuot", **kw)
    except Exception as e:  # noqa: BLE001
        check(False, "Logic Grid: mở trang di động để thử vuốt", e)
        return
    try:
        pg = M.pg
        M.start("logicgrid", "4x4", "easy", SEED0 + 11)
        wait_board(pg, "4x4")
        pg.wait_for_timeout(200)
        pg.tap(".pz-lg-chip[data-bi='2']")
        pg.wait_for_timeout(150)
        cdp = M.ctx.new_cdp_session(pg)
        pg.evaluate("document.querySelector('.pz-lg-sbs').scrollIntoView({ block: 'center' })")
        pg.wait_for_timeout(250)
        b = pg.locator(".pz-lg-sbs").bounding_box()
        y = min(b["y"] + b["height"] * 0.35, 700)
        x0, x1 = b["x"] + b["width"] * 0.8, b["x"] + b["width"] * 0.15

        def swipe(xa, xb):
            cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": xa, "y": y}]})
            for k in range(1, 7):
                cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": xa + (xb - xa) * k / 6.0, "y": y}]})
            cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
            pg.wait_for_timeout(250)
        cur = lambda: pg.evaluate("+document.querySelector('.pz-lg-sb:not([hidden]) .pz-lg-block').dataset.bi")
        mv = M.game()["moves"]
        swipe(x0, x1)
        blk = cur()
        check(blk == 3 and pg.get_attribute(".pz-lg-chip[data-bi='3']", "aria-selected") == "true", "Vuốt trái trên khối → sang khối kế tiếp (2 → 3), chip theo", blk)
        swipe(x1, x0)
        blk2 = cur()
        check(blk2 == 2 and M.game()["moves"] == mv, "Vuốt phải → quay lại khối 2; hai cú vuốt KHÔNG đánh dấu ô nào", (blk2, M.game()["moves"] - mv))
        swipe(x1, x0)
        swipe(x1, x0)
        swipe(x1, x0)
        check(cur() == 0, "Vuốt phải tới đầu thì dừng ở khối 0 (không vòng)", cur())
        cdp.detach()
    finally:
        M.close()


# ================================================================================================ WebKit (tiến trình con)
WEBKIT_SCRIPT = r'''
import sys
from playwright.sync_api import sync_playwright
url = sys.argv[1]
def rep(ok, msg, detail=""):
    print("WK|%s|%s|%s" % ("ok" if ok else "bad", msg, detail), flush=True)
GAME = r"""() => { const m = /#\/play\/([^?]+)/.exec(location.hash); const g = Puz.ui.app.ctx().getGame(decodeURIComponent(m[1])); return { v: g.state.v.slice(), moves: g.counters.moves, K: g.puzzle.data.cats.length, N: g.puzzle.data.cats[0].items.length }; }"""
errs = []
with sync_playwright() as pw:
    dev = pw.devices["iPhone 13"]
    br = pw.webkit.launch()
    ctx = br.new_context(**dev, service_workers="block")
    pg = ctx.new_page()
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.set_default_timeout(20000)
    pg.goto(url, wait_until="load")
    pg.wait_for_function("document.body.classList.contains('ready')", timeout=20000)
    pg.evaluate("location.hash = '#/new/logicgrid?size=4x4&tier=easy&seed=20261228&go=1'")
    pg.wait_for_selector(".pz-lg-cell", timeout=30000)
    pg.wait_for_timeout(400)
    g = pg.evaluate(GAME)
    nb = g["K"] * (g["K"] - 1) // 2
    rep(pg.locator(".pz-lg-block").count() == nb and pg.locator(".pz-lg-cell").count() == len(g["v"]), "WebKit iPhone 13: %d khối, %d ô khớp state" % (nb, len(g["v"])), pg.locator(".pz-lg-cell").count())
    area = pg.evaluate("document.querySelector('.pz-lg-area').className")
    rep("single" in area and pg.locator(".pz-lg-sb:not([hidden])").count() == 1 and pg.locator(".pz-lg-chip").count() == nb, "WebKit iPhone 13: 4x4 → «Từng khối» + %d chip" % nb, area)
    sc = pg.evaluate("[document.documentElement.scrollWidth, innerWidth]")
    rep(sc[0] <= sc[1], "WebKit iPhone 13: không tràn ngang (%d/%d px)" % (sc[0], sc[1]), sc)
    pg.tap(".pz-lg-cell[data-i='6']")
    pg.wait_for_timeout(150)
    g1 = pg.evaluate(GAME)
    rep(g1["v"][6] == 2 and g1["moves"] == 1, "WebKit iPhone 13: chạm ô → ✗ (Pointer Events cảm ứng)", (g1["v"][6], g1["moves"]))
    rep(pg.locator(".pz-lg-cell[data-i='6'] svg.mk-no").count() == 1, "WebKit iPhone 13: ✗ vẽ bằng SVG gạch chéo")
    pg.tap(".pz-lg-cell[data-i='6']")
    pg.wait_for_timeout(150)
    rep(pg.evaluate(GAME)["v"][6] == 1 and pg.locator(".pz-lg-cell[data-i='6'] svg.mk-yes").count() == 1, "WebKit iPhone 13: chạm lần hai → ✓ (SVG dấu tích)")
    sz = pg.evaluate("(() => { const r = document.querySelector('.pz-lg-cell[data-i=\"6\"] svg').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })()")
    rep(sz[0] >= 18 and sz[1] >= 18, "WebKit iPhone 13: dấu ✓ hiển thị %dx%d px" % (sz[0], sz[1]), sz)
    pg.tap(".pz-lg-chip[data-bi='3']")
    pg.wait_for_timeout(150)
    rep(pg.evaluate("+document.querySelector('.pz-lg-sb:not([hidden]) .pz-lg-block').dataset.bi") == 3, "WebKit iPhone 13: chạm chip → đổi khối")
    lab = pg.evaluate("(() => { const s = document.querySelector('.pz-lg-sb:not([hidden]) .pz-lg-cl'); const cs = getComputedStyle(s.querySelector('span')); return [cs.writingMode, Math.round(s.getBoundingClientRect().height)]; })()")
    rep(lab[1] >= 30, "WebKit iPhone 13: nhãn cột hiển thị (writing-mode %s, cao %d px)" % (lab[0], lab[1]), lab)
    pg.tap("button[data-tool='no']")
    pg.tap(".pz-lg-sb:not([hidden]) .pz-lg-cell >> nth=2")
    pg.wait_for_timeout(150)
    rep(pg.evaluate(GAME)["moves"] == 3, "WebKit iPhone 13: dụng cụ Loại + chạm ô → thêm một nước")
    pg.tap(".pz-lg-clue >> nth=0")
    rep(pg.locator(".pz-lg-clue.used").count() == 1, "WebKit iPhone 13: chạm manh mối → gạch «đã dùng»")
    hs = pg.evaluate("[...document.querySelectorAll('.pz-lg-clue, .pz-lg-tool, .pz-lg-chip, .pz-lg-layout button, .pz-lg-fold')].map(b => Math.round(b.getBoundingClientRect().height))")
    rep(min(hs) >= 44, "WebKit iPhone 13: manh mối, công cụ, chip, nút bố cục cao ≥ 44 px", sorted(set(hs)))
    pg.evaluate("location.hash = '#/create/logicgrid'")
    pg.wait_for_selector(".pz-lg-ed .pz-lg-gc", timeout=15000)
    pg.tap("button:has-text('Dùng ví dụ')")
    pg.wait_for_selector(".cr-chip.c-ok", timeout=20000)
    rep("một nghiệm" in pg.inner_text(".cr-chip"), "WebKit iPhone 13: trình soạn: «Dùng ví dụ» → «Có đúng một nghiệm»", pg.inner_text(".cr-chip"))
    pg.fill(".pz-lg-cin >> nth=0", "Alice != Zed")
    pg.wait_for_timeout(300)
    rep(pg.locator(".pz-lg-crow:nth-child(1) .pz-lg-rowmsg.bad").count() == 1, "WebKit iPhone 13: trình soạn: dòng sai báo lỗi dưới dòng")
    sc = pg.evaluate("[document.documentElement.scrollWidth, innerWidth]")
    rep(sc[0] <= sc[1], "WebKit iPhone 13: trình soạn không tràn ngang (%d/%d px)" % (sc[0], sc[1]), sc)
    rep(not errs, "WebKit iPhone 13: không lỗi console/pageerror", errs[:2])
    br.close()
'''


def webkit_checks(P, check):
    try:
        r = subprocess.run([sys.executable, "-c", WEBKIT_SCRIPT, P.url], capture_output=True, text=True, encoding="utf-8", timeout=240)
    except Exception as e:  # noqa: BLE001
        check(False, "Logic Grid: chạy WebKit iPhone 13 (tiến trình con)", e)
        return
    lines = [ln for ln in r.stdout.splitlines() if ln.startswith("WK|")]
    for ln in lines:
        _, ok, msg, detail = (ln.split("|", 3) + [""])[:4]
        check(ok == "ok", "Logic Grid: " + msg, detail)
    check(len(lines) >= 10 and r.returncode == 0, "Logic Grid: tiến trình WebKit chạy hết (%d phép)" % len(lines), (r.stderr or "").strip().splitlines()[-1:] or r.returncode)


# ================================================================================================ chạy rời
def _standalone():
    import importlib.util
    sys.path.insert(0, HERE)
    spec = importlib.util.spec_from_file_location("lps_check", os.path.join(HERE, "check.py"))
    C = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(C)
    from playwright.sync_api import sync_playwright
    may = C.K.MayChuThu([]).__enter__()
    try:
        url = may.goc + C.PATH
        with sync_playwright() as pw:
            br = pw.chromium.launch()
            P = C.Page(br, url, "desk", viewport={"width": 1366, "height": 860})
            C.section(" · bàn logicgrid: tương tác riêng (chạy rời)")
            run(P, C.check, C.section, "logicgrid")
            P.close()
            br.close()
    finally:
        may.__exit__(None, None, None)
    if C.ERRORS:
        print("\nLỗi console/pageerror (%d):" % len(C.ERRORS))
        for e in C.ERRORS[:10]:
            print("   ", e)
        C.check(False, "không lỗi JS/console")
    print("\n%d đạt, %d sai" % (C.OK, C.FAIL))
    return 1 if C.FAIL else 0


if __name__ == "__main__":
    sys.exit(_standalone())
