#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kiểm RIÊNG giao diện bàn N-Queens (assets/js/ui/boards/nqueens.js + assets/css/board-nqueens.css) bằng trình duyệt thật.

check.py (tầng 2) tự nạp tệp này và gọi run(P, check, section, tid) với P là trang Chromium máy tính đang mở app.
Có thể chạy rời bằng:  python check_board_nqueens.py  (tự dựng máy chủ thử như check.py) — in số phép đạt/sai.

Phủ: vẽ n×n + hậu cho sẵn khớp state · chạm đặt/gỡ hậu, chế độ Chấm, giữ lâu, chuột phải · ô cho sẵn khoá · hậu ăn nhau (so với engine) + đường nối + tắt qua Cài đặt ·
"Hiện ô bị tấn công" (đối chiếu bộ tính độc lập) · Xoá hậu / Xoá dấu chấm · bàn phím · tô gợi ý · replay (chỉ xem) · co giãn 280/360/768/1280 (n = 8, 16, 24) ·
độ tương phản màu riêng ≥ 4,5:1 (sáng + tối) · trình soạn (đặt hậu cho sẵn, trạng thái nghiệm, đổi N, bản nháp đúng dạng fromInput, Chơi thử) ·
chạm thật trên Chromium di động (CDP: chạm nhanh + giữ lâu) · WebKit iPhone 13 (tiến trình con)."""

from __future__ import annotations

import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CELL = ".pz-nq-cell"
SEED0 = 20261117


def GJS(body):
    """Hàm JS chạy trong trang với `g` = ván đang mở ở #/play/<id> (không dùng eval)."""
    return r"""() => { const m = /#\/play\/([^?]+)/.exec(location.hash); const g = Puz.ui.app.ctx().getGame(decodeURIComponent(m[1])); """ + body + " }"


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
    """Mọi cặp quân/chấm/chữ ↔ nền thật sự xuất hiện trên bàn, ở hai sắc ô × từng lớp tô, sáng và tối → (số cặp, [cặp < 4,5])."""
    low, total = [], 0
    for theme in ("light", "dark"):
        pg.evaluate("t => { document.documentElement.dataset.theme = t }", theme)
        c = {k: _parse(_var(pg, k)) for k in ("pz-nq-sq-a", "pz-nq-sq-b", "pz-nq-queen", "pz-nq-queen-conflict", "pz-nq-dot", "pz-given", "pz-conflict-text", "pz-hint", "pz-replay", "pz-nq-conflict-bg", "pz-nq-atk", "pz-nq-atk-hatch", "pz-good", "bg", "text", "text-2")}
        layers = {"none": [], "hint": [c["pz-hint"]], "replay": [c["pz-replay"]], "conflict": [c["pz-nq-conflict-bg"]],
                  "atk": [c["pz-nq-atk"], c["pz-nq-atk-hatch"]], "hint+atk": [c["pz-hint"], c["pz-nq-atk"], c["pz-nq-atk-hatch"]], "replay+atk": [c["pz-replay"], c["pz-nq-atk"], c["pz-nq-atk-hatch"]]}
        plan = (("hậu người chơi", "pz-nq-queen", ("none", "hint", "replay")), ("hậu cho sẵn", "pz-given", ("none", "hint", "replay")),
                ("hậu ăn nhau", "pz-nq-queen-conflict", ("conflict", "hint", "replay")), ("chấm loại", "pz-nq-dot", ("none", "hint", "replay", "atk", "hint+atk", "replay+atk")),
                ("ổ khoá", "pz-given", ("none",)))
        for what, fgk, kinds in plan:
            for sq in ("pz-nq-sq-a", "pz-nq-sq-b"):
                for kind in kinds:
                    bg = c[sq][:3]
                    for layer in layers[kind]:
                        bg = _over(layer, bg)
                    ratio = _contrast(c[fgk], bg)
                    total += 1
                    if ratio < 4.5:
                        low.append("%s %s trên %s+%s = %.2f" % (theme, what, sq[-1], kind, ratio))
        for what, fgk in (("chữ xung đột", "pz-conflict-text"), ("chữ ổn", "pz-good"), ("chữ phụ", "text-2"), ("chữ chính", "text")):
            ratio = _contrast(c[fgk], c["bg"][:3])
            total += 1
            if ratio < 4.5:
                low.append("%s %s trên nền trang = %.2f" % (theme, what, ratio))
        # hai sắc ô phải khác nhau đủ để thấy bàn cờ (≥ 1,15:1)
        total += 1
        if _contrast(c["pz-nq-sq-a"], c["pz-nq-sq-b"]) < 1.15:
            low.append("%s hai sắc ô quá gần nhau" % theme)
    pg.evaluate("document.documentElement.dataset.theme = 'light'")
    return total, low


# ------------------------------------------------------------------------------------------------ bộ tính độc lập
def attacked(v, n):
    """Ô nằm trong tầm ăn của một hậu (hàng/cột/2 chéo), trừ chính ô hậu — tính lại từ state, không dùng mã giao diện."""
    out = set()
    for q in [i for i, x in enumerate(v) if x == 1]:
        r, c = divmod(q, n)
        for i in range(n * n):
            r2, c2 = divmod(i, n)
            if r2 == r or c2 == c or abs(r2 - r) == abs(c2 - c):
                out.add(i)
    return set(i for i in out if v[i] != 1)


# ------------------------------------------------------------------------------------------------ tiện ích trang
def cls_set(pg, c):
    return set(pg.evaluate("c => [...document.querySelectorAll('.pz-nq-cell')].filter(e => e.classList.contains(c)).map(e => +e.dataset.i)", c))


def label(pg, i):
    return pg.get_attribute(sel(i), "aria-label") or ""


def state(P):
    g = P.game()
    return g, int(round(len(g["v"]) ** 0.5))


def engine_conflicts(pg):
    return set(pg.evaluate(GJS("return Puz.types.get('nqueens').check(g.puzzle, g.state).conflicts;")))


def tap(P, i, wait=80):
    P.pg.click(sel(i))
    P.pg.wait_for_timeout(wait)


def set_mode(pg, mode):
    pg.click("button[data-mode='%s']" % mode)
    pg.wait_for_timeout(40)


def fresh(P, size="8", tier="easy", seed=SEED0):
    """Vào ván mới của đúng (cỡ, bậc, seed) và bảo đảm bàn đang ở trạng thái đầu, chế độ Hậu, tắt hiện tấn công."""
    P.start("nqueens", size, tier, seed)
    P.pg.wait_for_selector(CELL)
    g, n = state(P)
    if g["v"] != g["initial"]:
        P.pg.evaluate(GJS("g.restart(); g.start();"))
        P.pg.wait_for_timeout(120)
        g, n = state(P)
    if P.pg.get_attribute("button[data-mode='queen']", "aria-pressed") != "true":
        set_mode(P.pg, "queen")
    if P.pg.get_attribute("button:has-text('Hiện ô bị tấn công')", "aria-pressed") == "true":
        P.pg.click("button:has-text('Hiện ô bị tấn công')")
    return g, n


def row_pair(g, n, avoid_given=True):
    """Hai ô trống cùng một hàng (để đặt hai hậu ăn nhau)."""
    rows = {}
    for i, x in enumerate(g["initial"]):
        if x == 0:
            rows.setdefault(i // n, []).append(i)
    for r in sorted(rows):
        if len(rows[r]) >= 2:
            return rows[r][0], rows[r][-1]
    return None


def touch_down_up(cdp, x, y, hold_ms, pg):
    cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y}]})
    pg.wait_for_timeout(hold_ms)
    cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    pg.wait_for_timeout(120)


# ================================================================================================ phần chạy chính
def run(P, check, section, tid):
    pg = P.pg
    pg.set_viewport_size({"width": 1280, "height": 900})
    pg.evaluate("document.documentElement.dataset.theme = 'light'")
    errs0 = len(P.errors)

    # ---------------------------------------------------------------- 1. vẽ bàn
    g, n = fresh(P, "8", "easy", SEED0)
    givens = [i for i, x in enumerate(g["initial"]) if x == 1]
    gridinfo = pg.evaluate("""() => { const gr = document.querySelector('.pz-nq-grid'), cs = [...document.querySelectorAll('.pz-nq-cell')];
      return { rows: document.querySelectorAll('.pz-nq-row').length, cells: cs.length, role: gr.getAttribute('role'), rc: gr.getAttribute('aria-rowcount'), cc: gr.getAttribute('aria-colcount'),
               roles: cs.every(c => c.getAttribute('role') === 'gridcell'), labels: cs.every(c => /^Hàng \\d+, cột \\d+, /.test(c.getAttribute('aria-label') || '')), tab0: cs.filter(c => c.getAttribute('tabindex') === '0').length,
               boardText: document.querySelector('.pz-nq-grid').textContent }; }""")
    check(gridinfo["rows"] == n and gridinfo["cells"] == n * n and gridinfo["role"] == "grid" and gridinfo["rc"] == str(n) and gridinfo["cc"] == str(n) and gridinfo["roles"],
          "N-Queens: bàn vẽ đúng %d×%d ô (%d hàng role=row, ô role=gridcell, grid có aria-rowcount/colcount)" % (n, n, n), gridinfo)
    check(gridinfo["labels"] and gridinfo["tab0"] == 1, "N-Queens: mọi ô có aria-label 'Hàng r, cột c, …' (từ type.describeCell) và đúng một ô tabindex=0 (roving)", (gridinfo["labels"], gridinfo["tab0"]))
    check(cls_set(pg, "given") == set(givens) and len(givens) >= 1 and all(g["v"][i] == 1 for i in givens),
          "N-Queens: %d ô hậu cho sẵn trên giao diện trùng đúng state (initial.v)" % len(givens), (sorted(cls_set(pg, "given")), givens))
    svgs = pg.evaluate("[...document.querySelectorAll('.pz-nq-cell.given')].map(c => { const s = c.querySelector('.pz-nq-q svg'); return s ? Math.round(s.getBoundingClientRect().width) : 0; })")
    check(all(w >= 20 for w in svgs) and "♛" not in gridinfo["boardText"] and "♕" not in gridinfo["boardText"], "N-Queens: quân hậu là SVG nội tuyến (không dùng ký tự emoji), cỡ ≥ 20 px ở 1280", svgs)
    check(pg.locator(".pz-nq-cell.given .pz-nq-lk svg").count() == len(givens), "N-Queens: hậu cho sẵn có biểu tượng ổ khoá + khung (kiểu riêng, không chỉ khác màu)")
    check(pg.inner_text(".pz-nq-count").startswith("Hậu: %d/%d" % (len(givens), n)), "N-Queens: dòng trạng thái 'Hậu: x/N' gồm cả hậu cho sẵn", pg.inner_text(".pz-nq-count"))

    # ---------------------------------------------------------------- 2. chạm đặt / gỡ / chấm
    free = [i for i, x in enumerate(g["initial"]) if x == 0]
    a = free[3]
    m0 = g["moves"]
    tap(P, a)
    g1, _ = state(P)
    check(g1["v"][a] == 1 and g1["moves"] == m0 + 1 and a in cls_set(pg, "queen") and "có hậu" in label(pg, a), "N-Queens: chạm ô trống → đặt hậu (game.moves +1, ô có lớp queen, aria-label 'có hậu')", (g1["v"][a], g1["moves"], label(pg, a)))
    check(pg.inner_text(".pz-nq-count").startswith("Hậu: %d/%d" % (len(givens) + 1, n)), "N-Queens: số 'Hậu: x/N' tăng sau khi đặt", pg.inner_text(".pz-nq-count"))
    tap(P, a)
    g2, _ = state(P)
    check(g2["v"][a] == 0 and g2["moves"] == m0 + 2 and a not in cls_set(pg, "queen"), "N-Queens: chạm lại → gỡ hậu (trống)", (g2["v"][a], g2["moves"]))
    set_mode(pg, "dot")
    check(pg.get_attribute("button[data-mode='dot']", "aria-pressed") == "true" and pg.get_attribute("button[data-mode='queen']", "aria-pressed") == "false", "N-Queens: công tắc chế độ Hậu | Chấm đổi aria-pressed")
    tap(P, a)
    g3, _ = state(P)
    check(g3["v"][a] == 2 and a in cls_set(pg, "dotted") and "đánh dấu loại" in label(pg, a) and pg.locator(sel(a) + " .pz-nq-dot").count() == 1, "N-Queens: chế độ Chấm: chạm ô trống → chấm loại (v=2, vẽ chấm, aria-label)", (g3["v"][a], label(pg, a)))
    check(pg.inner_text(".pz-nq-count").startswith("Hậu: %d/%d" % (len(givens), n)), "N-Queens: chấm không tính vào số hậu", pg.inner_text(".pz-nq-count"))
    tap(P, a)
    check(state(P)[0]["v"][a] == 0, "N-Queens: chạm lại ô có chấm → bỏ chấm")
    tap(P, a)                                           # lại có chấm
    set_mode(pg, "queen")
    tap(P, a)
    check(state(P)[0]["v"][a] == 1, "N-Queens: chế độ Hậu: chạm ô có chấm → đổi thành hậu")
    tap(P, a)                                           # gỡ
    # giữ lâu (chuột) = làm điều của chế độ kia; chuột phải cũng vậy
    box = pg.locator(sel(a)).bounding_box()
    mv0 = state(P)[0]["moves"]
    pg.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    pg.mouse.down()
    pg.wait_for_timeout(700)
    pg.mouse.up()
    pg.wait_for_timeout(100)
    g4, _ = state(P)
    check(g4["v"][a] == 2 and g4["moves"] == mv0 + 1, "N-Queens: giữ lâu ô (chế độ Hậu) → đánh dấu chấm, đúng một nước đi (nhả chuột không đặt thêm hậu)", (g4["v"][a], g4["moves"] - mv0))
    pg.click(sel(a), button="right")
    pg.wait_for_timeout(80)
    check(state(P)[0]["v"][a] == 0, "N-Queens: chuột phải = làm điều của chế độ kia (bỏ chấm), không hiện menu trình duyệt")
    # ô cho sẵn không đổi được
    gv = state(P)[0]
    gi = givens[0]
    tap(P, gi)
    set_mode(pg, "dot")
    tap(P, gi)
    set_mode(pg, "queen")
    pg.focus(sel(gi))
    pg.keyboard.press("Delete")
    pg.keyboard.press("Space")
    pg.wait_for_timeout(80)
    gg = state(P)[0]
    check(gg["v"] == gv["v"] and gg["moves"] == gv["moves"] and "hậu cho sẵn" in label(pg, gi), "N-Queens: ô hậu cho sẵn không đổi được (chạm, chế độ Chấm, Delete, Space đều vô tác dụng)", (gg["moves"], gv["moves"]))

    # ---------------------------------------------------------------- 3. hậu ăn nhau
    pair = row_pair(g, n)
    base_moves = state(P)[0]["moves"]
    tap(P, pair[0])
    tap(P, pair[1])
    gc, _ = state(P)
    eng = engine_conflicts(pg)
    ui = cls_set(pg, "conflict")
    check(pair[0] in ui and pair[1] in ui and ui == eng, "N-Queens: hai hậu cùng hàng → cả hai ô được tô xung đột, tập ô tô = type.check(...).conflicts của engine", (sorted(ui), sorted(eng)))
    txt = pg.inner_text(".pz-nq-conf")
    mt = re.search(r"Xung đột: (\d+) hậu", txt)
    check(mt is not None and int(mt.group(1)) == len(eng) and "bad" in (pg.get_attribute(".pz-nq-conf", "class") or ""), "N-Queens: dòng trạng thái báo đúng số hậu xung đột bằng chữ (%s)" % txt, txt)
    check(pg.locator(".pz-nq-lines line").count() >= 1 and "đang ăn hậu khác" in label(pg, pair[0]), "N-Queens: có đường nối đỏ giữa hậu ăn nhau + aria-label báo 'đang ăn hậu khác'", label(pg, pair[0]))
    ring = pg.evaluate("(s) => { const c = getComputedStyle(document.querySelector(s)); return { shadow: c.boxShadow, bgi: c.backgroundImage }; }", sel(pair[0]))
    check(ring["shadow"] != "none" and "gradient" in ring["bgi"], "N-Queens: ô xung đột có viền đỏ + nền tô (không chỉ đổi màu quân)", ring)
    tap(P, pair[1])
    check(pair[1] not in cls_set(pg, "conflict") and cls_set(pg, "conflict") == engine_conflicts(pg), "N-Queens: gỡ một trong hai hậu → ô đó hết tô, tập ô xung đột vẫn khớp engine")
    tap(P, pair[0])
    # tắt "Tô ô xung đột" trong Cài đặt → bàn không lộ xung đột
    play_hash = pg.evaluate("location.hash")
    tap(P, pair[0])
    tap(P, pair[1])
    P.go("#/settings", 300)
    sw = pg.locator(".set-row", has_text="Tô ô xung đột").locator("input")
    sw.set_checked(False, force=True)
    pg.evaluate("h => { location.hash = h }", play_hash)
    pg.wait_for_selector(CELL)
    pg.wait_for_timeout(250)
    check(len(cls_set(pg, "conflict")) == 0 and pg.locator(".pz-nq-lines line").count() == 0 and "đang ẩn" in pg.inner_text(".pz-nq-conf"),
          "N-Queens: tắt 'Tô ô xung đột' ở Cài đặt → không tô, không đường nối, dòng trạng thái ghi 'đang ẩn'", pg.inner_text(".pz-nq-conf"))
    check("%d/%d" % (len(givens) + 2, n) in pg.inner_text(".pz-nq-count"), "N-Queens: … nhưng số 'Hậu: x/N' vẫn đúng", pg.inner_text(".pz-nq-count"))
    P.go("#/settings", 300)
    pg.locator(".set-row", has_text="Tô ô xung đột").locator("input").set_checked(True, force=True)
    pg.evaluate("h => { location.hash = h }", play_hash)
    pg.wait_for_selector(CELL)
    pg.wait_for_timeout(200)
    check(len(cls_set(pg, "conflict")) >= 2, "N-Queens: bật lại 'Tô ô xung đột' → xung đột hiện lại")

    # ---------------------------------------------------------------- 4. Hiện ô bị tấn công
    btn = "button:has-text('Hiện ô bị tấn công')"
    gb, _ = state(P)
    check(pg.get_attribute(btn, "aria-pressed") == "false" and len(cls_set(pg, "atk")) == 0, "N-Queens: 'Hiện ô bị tấn công' mặc định tắt (aria-pressed=false, không ô nào tô)")
    pg.click(btn)
    pg.wait_for_timeout(80)
    ga, _ = state(P)
    atk_ui, want = cls_set(pg, "atk"), attacked(ga["v"], n)
    check(pg.get_attribute(btn, "aria-pressed") == "true" and atk_ui == want and len(want) > 0, "N-Queens: bật → đúng các ô trong hàng/cột/2 đường chéo của mọi hậu đang có được tô (%d ô, đối chiếu bộ tính độc lập)" % len(want), (len(atk_ui), len(want)))
    check(ga["v"] == gb["v"] and ga["moves"] == gb["moves"], "N-Queens: hiện ô bị tấn công không đổi state, không tính nước đi")
    op = pg.evaluate("(a) => { const on = getComputedStyle(document.querySelector(a), '::before').opacity; return on; }", sel(sorted(want)[0]))
    off = [i for i in range(n * n) if i not in want and ga["v"][i] != 1]
    opn = pg.evaluate("(a) => getComputedStyle(document.querySelector(a), '::before').opacity", sel(off[0])) if off else "0"
    check(op == "1" and opn == "0", "N-Queens: ô bị tấn công thật sự đổi giao diện (lớp phủ ::before opacity 1 so với 0)", (op, opn))
    tap(P, free[10])
    ga2, _ = state(P)
    check(cls_set(pg, "atk") == attacked(ga2["v"], n), "N-Queens: đặt thêm hậu → vùng tấn công cập nhật theo")
    tap(P, free[10])
    pg.click(btn)
    pg.wait_for_timeout(60)
    check(pg.get_attribute(btn, "aria-pressed") == "false" and len(cls_set(pg, "atk")) == 0, "N-Queens: tắt lại → hết tô")

    # ---------------------------------------------------------------- 5. xoá hậu / xoá chấm
    clr, clm = "button[aria-label^='Xoá hậu của tôi']", "button[aria-label='Xoá dấu chấm']"
    check(pg.locator(clr).count() == 1 and pg.locator(clm).count() == 1, "N-Queens: hai nút 'Xoá hậu của tôi' / 'Xoá dấu chấm' có aria-label")
    if not pg.is_disabled(clr):
        pg.click(clr)
    if not pg.is_disabled(clm):
        pg.click(clm)
    pg.wait_for_timeout(60)
    tap(P, free[5])
    tap(P, free[6])
    set_mode(pg, "dot")
    tap(P, free[8])
    tap(P, free[9])
    set_mode(pg, "queen")
    gx, _ = state(P)
    check(sum(1 for i in range(n * n) if gx["v"][i] == 1 and gx["initial"][i] == 0) >= 2 and 2 in gx["v"], "N-Queens: (chuẩn bị) bàn có hậu của người chơi và chấm")
    pg.click(clm)
    pg.wait_for_timeout(80)
    gy, _ = state(P)
    check(2 not in gy["v"] and [x for x in gy["v"] if x == 1] == [x for x in gx["v"] if x == 1] and pg.is_disabled(clm), "N-Queens: 'Xoá dấu chấm' chỉ bỏ chấm, giữ hậu; nút tự khoá khi hết chấm")
    pg.click(clr)
    pg.wait_for_timeout(80)
    gz, _ = state(P)
    check(gz["v"] == gz["initial"] and pg.is_disabled(clr), "N-Queens: 'Xoá hậu của tôi' trả bàn về hậu cho sẵn ({k:'clear'}); nút tự khoá")
    pg.click("button:has-text('Hoàn tác')")
    pg.wait_for_timeout(80)
    check(len([x for x in state(P)[0]["v"] if x == 1]) > len(givens), "N-Queens: Hoàn tác khôi phục hậu vừa xoá (đi qua game.act nên undo chạy)")
    pg.click(clr)
    pg.wait_for_timeout(60)

    # ---------------------------------------------------------------- 6. bàn phím
    pg.focus(sel(free[0]))
    c0 = free[0]
    r0, col0 = divmod(c0, n)
    pg.keyboard.press("ArrowRight")
    ae = pg.evaluate("+document.activeElement.dataset.i")
    check(ae == (c0 + 1 if col0 < n - 1 else c0), "N-Queens: bàn phím: ArrowRight chuyển focus sang ô bên phải", ae)
    pg.keyboard.press("ArrowDown")
    ae2 = pg.evaluate("+document.activeElement.dataset.i")
    check(ae2 == ae + n if ae // n < n - 1 else True, "N-Queens: ArrowDown xuống một hàng", ae2)
    pg.keyboard.press("ArrowLeft")
    pg.keyboard.press("ArrowUp")
    ae3 = pg.evaluate("+document.activeElement.dataset.i")
    check(pg.evaluate("document.querySelectorAll('.pz-nq-cell[tabindex=\"0\"]').length") == 1 and pg.evaluate("document.activeElement.getAttribute('tabindex')") == "0", "N-Queens: roving tabindex: ô đang focus là ô duy nhất tabindex=0", ae3)
    pg.focus(sel(0))
    pg.keyboard.press("ArrowLeft")
    pg.keyboard.press("ArrowUp")
    check(pg.evaluate("+document.activeElement.dataset.i") == 0, "N-Queens: mũi tên ở mép bàn không nhảy ra ngoài")
    pg.keyboard.press("End")
    check(pg.evaluate("+document.activeElement.dataset.i") == n - 1, "N-Queens: End về cuối hàng")
    k = free[7]
    pg.focus(sel(k))
    pg.keyboard.press("Space")
    pg.wait_for_timeout(60)
    check(state(P)[0]["v"][k] == 1, "N-Queens: Space đặt hậu ở ô đang focus")
    pg.keyboard.press("Delete")
    pg.wait_for_timeout(60)
    check(state(P)[0]["v"][k] == 0, "N-Queens: Delete gỡ hậu")
    pg.keyboard.press(".")
    pg.wait_for_timeout(60)
    check(state(P)[0]["v"][k] == 2, "N-Queens: phím '.' đánh dấu chấm")
    pg.keyboard.press("Backspace")
    pg.wait_for_timeout(60)
    check(state(P)[0]["v"][k] == 0, "N-Queens: Backspace bỏ chấm")
    pg.keyboard.press("Enter")
    pg.wait_for_timeout(60)
    check(state(P)[0]["v"][k] == 1, "N-Queens: Enter = hành động chính của ô (đặt hậu ở chế độ Hậu)")
    pg.keyboard.press("q")
    pg.wait_for_timeout(60)
    check(state(P)[0]["v"][k] == 0, "N-Queens: phím Q đảo hậu")
    pg.click(clr) if not pg.is_disabled(clr) else None

    # ---------------------------------------------------------------- 7. tô gợi ý
    pg.click(".toolbar button:has-text('Gợi ý')")
    pg.wait_for_selector(".hint-panel:not([hidden])")
    pg.wait_for_timeout(100)
    hint_cells = pg.evaluate(GJS("return g.lastHint && g.lastHint.cells || [];"))
    hs = cls_set(pg, "hint")
    check(len(hint_cells) >= 1 and hs == set(hint_cells), "N-Queens: gợi ý → đúng các ô gợi ý được tô (highlight 'hint')", (sorted(hs), hint_cells))
    hv = pg.evaluate("(s) => { const c = getComputedStyle(document.querySelector(s)); return [c.boxShadow, c.backgroundImage]; }", sel(hint_cells[0]))
    check(hv[0] != "none" and "gradient" in hv[1], "N-Queens: ô gợi ý có nền tô + viền (không chỉ màu)", hv)
    pg.click(".hint-panel button:has-text('Ẩn gợi ý')")
    pg.wait_for_timeout(80)
    check(len(cls_set(pg, "hint")) == 0, "N-Queens: ẩn gợi ý → xoá tô (highlight(null))")
    pg.click(".toolbar button:has-text('Gợi ý')")
    pg.wait_for_selector(".hint-panel:not([hidden])")
    mm = state(P)[0]["moves"]
    pg.click(sel(free[2]))
    pg.wait_for_timeout(100)
    check(len(cls_set(pg, "hint")) == 0 and state(P)[0]["moves"] == mm + 1, "N-Queens: thao tác trên bàn khi đang có gợi ý → gợi ý tự tắt, nước đi vẫn được tính")
    pg.click(clr) if not pg.is_disabled(clr) else None

    # ---------------------------------------------------------------- 8. giải xong + replay (chỉ xem)
    fresh(P, "8", "easy", SEED0 + 9)
    res = pg.evaluate(GJS("let k = 0; while (g.status === 'playing' && k < 400) { const h = g.hint(3); if (!h || h.none || !h.action) return -1; const r = g.applyHint(h); if (!r.ok) return -2; k++; } return g.status === 'solved' ? k : -3;"))
    check(res > 0, "N-Queens: giải bằng gợi ý mức 3 qua bàn thật (%d bước)" % res, res)
    pg.wait_for_selector("dialog[open] h2:has-text('Đã giải')", timeout=10000)
    pg.keyboard.press("Escape")
    pg.wait_for_selector("dialog[open]", state="detached")
    gs, _ = state(P)
    check(pg.inner_text(".pz-nq-count").endswith("%d/%d ✓" % (n, n)), "N-Queens: giải xong → 'Hậu: N/N ✓'", pg.inner_text(".pz-nq-count"))
    fr = [i for i, x in enumerate(gs["initial"]) if x == 0 and gs["v"][i] == 0][0]
    pg.click(sel(fr))
    pg.wait_for_timeout(100)
    check(state(P)[0]["v"] == gs["v"], "N-Queens: ván đã xong → chạm ô không đổi gì (game.act từ chối)")
    wk = pg.evaluate(r"""async () => { try { const m = /#\/play\/([^?]+)/.exec(location.hash), g = Puz.ui.app.ctx().getGame(decodeURIComponent(m[1]));
      const s = await Puz.gen.call('nqueens', 'replay', [g.puzzle], { timeout: 20000 }); return s && s.length ? s.length : 0; } catch (e) { return String((e && e.message) || e); } }""")
    check(isinstance(wk, int) and wk > 0, "N-Queens: engine.replay chạy được TRONG Web Worker (vỏ gọi qua Puz.gen.call; worker không nạp core/game.js nên engine không được dùng Puz.game)", wk)
    # Để vẫn kiểm được CÁI BÀN ở chế độ replay dù engine có lỗi trên, cho replay chạy ở luồng chính (nơi Puz.game có sẵn); khôi phục ngay sau đó.
    pg.evaluate(r"""() => { window.__genCall = Puz.gen.call; Puz.gen.call = function (t, fn, args) { try { return Promise.resolve(Puz.types.get(t)[fn].apply(null, args)); } catch (e) { return Promise.reject(e); } }; }""")
    pg.click(".play-status button:has-text('Replay')")
    pg.wait_for_selector(".replay-panel:not([hidden])", timeout=20000)
    pg.wait_for_selector(".pz-nq-grid.ro")
    check(pg.locator(".pz-nq .seg").count() == 0 and pg.locator(clr).count() == 0 and pg.locator("button:has-text('Hiện ô bị tấn công')").count() == 1, "N-Queens: replay (readOnly): ẩn nút đặt hậu/xoá, vẫn có 'Hiện ô bị tấn công'")
    pg.click(".replay-panel button:has-text('Sau')")
    pg.wait_for_timeout(120)
    rp = cls_set(pg, "replay")
    check(len(rp) >= 1, "N-Queens: replay bước 1 → ô của bước được tô xanh (highlight 'replay')", sorted(rp))
    before_q = cls_set(pg, "queen")
    pg.click(sel(fr))
    pg.wait_for_timeout(80)
    check(cls_set(pg, "queen") == before_q and state(P)[0]["v"] == gs["v"], "N-Queens: replay: chạm ô không gửi action (không đổi bàn replay lẫn ván)")
    pg.click(".replay-panel button[aria-label='Tới cuối']")
    pg.wait_for_timeout(120)
    check(pg.inner_text(".pz-nq-count").endswith("%d/%d ✓" % (n, n)), "N-Queens: replay tới cuối → 'Hậu: N/N ✓'", pg.inner_text(".pz-nq-count"))
    pg.click(".replay-panel button:has-text('Thoát replay')")
    pg.wait_for_selector(CELL)
    pg.evaluate("() => { if (window.__genCall) Puz.gen.call = window.__genCall; }")
    P.go("#/", 200)

    # ---------------------------------------------------------------- 9. co giãn + nút ≥ 44 px
    section(" · bàn nqueens: co giãn, độ tương phản")
    for size in ("8", "16"):
        bad = []
        fresh(P, size, "easy", SEED0 + 20)
        gg_, nn = state(P)
        for w in (280, 360, 768, 1280):
            pg.set_viewport_size({"width": w, "height": 900})
            pg.wait_for_timeout(120)
            m = pg.evaluate("""() => { const r = document.querySelector('.pz-nq-board').getBoundingClientRect(), h = document.querySelector('.board-host'), c = document.querySelector('.pz-nq-cell').getBoundingClientRect(),
              s = document.querySelector('.pz-nq-cell.given .pz-nq-q svg').getBoundingClientRect(), btns = [...document.querySelectorAll('.pz-nq button, .pz-nq select')].map(b => b.getBoundingClientRect().height);
              return { doc: document.documentElement.scrollWidth, inner: innerWidth, bw: r.width, right: r.right, host: h.scrollWidth - h.clientWidth, cell: c.width, queen: s.width, minBtn: Math.min.apply(null, btns), nb: btns.length }; }""")
            ok = m["doc"] <= m["inner"] and m["right"] <= m["inner"] + 0.5 and m["host"] <= 1 and m["minBtn"] >= 43.9 and m["queen"] >= 8
            if size == "16" and w == 360:
                ok = ok and m["cell"] >= 18 and m["queen"] >= 14
            if not ok:
                bad.append((size, w, m))
        check(not bad, "N-Queens: n=%d không tràn ngang ở 280/360/768/1280 px, mọi nút/ô chọn cao ≥ 44 px%s" % (nn, ", ô ≥ 18 px & quân ≥ 14 px ở 360 px" if size == "16" else ""), bad[:2])
    pg.set_viewport_size({"width": 360, "height": 900})
    pg.evaluate("""() => { const t = Puz.types.get('nqueens'), r = t.fromInput({ n: 24, queens: [0] }); window.__nq24 = r; Puz.ui.app.ctx().startGame(r.puzzle, { source: 'custom' }); }""")
    pg.wait_for_function("document.querySelectorAll('.pz-nq-cell').length === 576", timeout=30000)
    pg.wait_for_timeout(200)
    mm = pg.evaluate("() => ({ doc: document.documentElement.scrollWidth, inner: innerWidth, cell: document.querySelector('.pz-nq-cell').getBoundingClientRect().width })")
    check(mm["doc"] <= mm["inner"], "N-Queens: n=24 (576 ô) ở 360 px không tràn ngang (ô %.1f px)" % mm["cell"], mm)
    t0 = pg.evaluate(GJS("const a = performance.now(); for (let i = 0; i < 20; i++) { g.act({ k: 'set', i: 100 + i, val: 1 }); } const b = performance.now(); for (let i = 0; i < 20; i++) g.act({ k: 'set', i: 100 + i, val: 0 }); return (b - a) / 20;"))
    check(t0 < 25, "N-Queens: n=24: mỗi nước đi (act + vẽ lại 576 ô) ≈ %.1f ms (< 25 ms)" % t0, t0)
    tap(P, 100)
    pg.wait_for_timeout(300)
    check("bị 1 hậu chặn" in label(pg, 101) and "có hậu" in label(pg, 100), "N-Queens: n=24: aria-label các ô được cập nhật (làm mới trễ) sau khi đặt hậu: %r" % label(pg, 101), label(pg, 101))
    tap(P, 100)
    pg.set_viewport_size({"width": 1280, "height": 900})
    total, low = contrast_report(pg)
    check(not low, "N-Queens: độ tương phản ≥ 4,5:1 cho %d cặp quân/chấm/chữ ↔ nền (hai sắc ô × tô hint/replay/xung đột/tấn công, sáng + tối)" % total, low[:6])
    P.go("#/", 150)

    # ---------------------------------------------------------------- 10. trình soạn
    section(" · bàn nqueens: trình soạn")
    editor_checks(P, check, g)

    # ---------------------------------------------------------------- 11. cảm ứng thật (Chromium di động qua CDP)
    section(" · bàn nqueens: cảm ứng")
    touch_checks(P, check)
    # ---------------------------------------------------------------- 12. WebKit iPhone 13
    webkit_checks(P, check)
    check(len(P.errors) == errs0, "N-Queens: không lỗi console/pageerror trong phiên kiểm bàn", P.errors[errs0:errs0 + 3])
    pg.set_viewport_size({"width": 1366, "height": 860})
    pg.evaluate("document.documentElement.dataset.theme = 'light'")
    P.go("#/", 200)


# ================================================================================================ trình soạn
def editor_checks(P, check, g8):
    pg = P.pg
    pg.set_viewport_size({"width": 1280, "height": 900})
    P.go("#/create/nqueens", 300)
    pg.wait_for_selector(".pz-nq-edit .pz-nq-grid")
    pg.click("button:has-text('Làm mới')")
    pg.click("dialog[open] button:has-text('Bắt đầu lại')")
    pg.wait_for_selector(".pz-nq-edit .pz-nq-grid")
    pg.wait_for_timeout(300)
    n = int(pg.evaluate("+document.querySelector('.pz-nq-edit select').value"))
    check(n == 8 and pg.locator(CELL).count() == 64 and pg.locator(".pz-nq-cell.given").count() == 0, "N-Queens (soạn): mở trống → N=8, 64 ô, chưa có hậu cho sẵn", (n, pg.locator(CELL).count()))
    pg.wait_for_selector(".cr-chip.c-warn", timeout=15000)
    check("nhiều nghiệm" in pg.inner_text(".cr-chip"), "N-Queens (soạn): bàn trống → trạng thái 'Puzzle có nhiều nghiệm' (engine fromInput)", pg.inner_text(".cr-chip"))
    check(pg.inner_text(".pz-nq-edit .pz-nq-count").startswith("Hậu cho sẵn: 0"), "N-Queens (soạn): hiển thị số hậu cho sẵn", pg.inner_text(".pz-nq-edit .pz-nq-count"))
    givens = [i for i, x in enumerate(g8["initial"]) if x == 1]
    for i in givens:
        pg.click(sel(i))
    pg.wait_for_selector(".cr-chip.c-ok", timeout=15000)
    check("đúng một nghiệm" in pg.inner_text(".cr-chip") and pg.locator(".pz-nq-edit .pz-nq-cell.given").count() == len(givens) and pg.inner_text(".pz-nq-edit .pz-nq-count").startswith("Hậu cho sẵn: %d" % len(givens)),
          "N-Queens (soạn): đặt %d hậu cho sẵn của một đề sinh sẵn → 'Có đúng một nghiệm', đếm đúng" % len(givens), pg.inner_text(".cr-chip"))
    check(pg.get_attribute(sel(givens[0]), "aria-label") == "Hàng %d, cột %d, có hậu cho sẵn" % (givens[0] // 8 + 1, givens[0] % 8 + 1), "N-Queens (soạn): aria-label ô có hậu cho sẵn", pg.get_attribute(sel(givens[0]), "aria-label"))
    pg.wait_for_timeout(800)
    draft = pg.evaluate("Puz.ui.app.ctx().user.getDraft('edit:nqueens').then(d => d && d.value && d.value.input)")
    want_v = [1 if i in givens else 0 for i in range(64)]
    check(draft and draft.get("n") == 8 and draft.get("v") == want_v and set(draft.keys()) == {"n", "v"}, "N-Queens (soạn): onChange phát đúng dạng {n, v:[n*n số 0/1]} mà fromInput nhận (đọc từ bản nháp tự lưu)", draft)
    # thêm hậu thứ năm cùng hàng với một hậu cho sẵn → vô nghiệm + cảnh báo của trình soạn
    r_of = givens[0] // 8
    extra = [i for i in range(r_of * 8, r_of * 8 + 8) if i not in givens][0]
    pg.click(sel(extra))
    pg.wait_for_selector(".cr-chip.c-bad", timeout=15000)
    check("Vô nghiệm" in pg.inner_text(".cr-chip") and pg.locator(".pz-nq-edit .pz-nq-cell.conflict").count() >= 2 and "ăn nhau" in pg.inner_text(".pz-nq-edit .pz-nq-note.bad"),
          "N-Queens (soạn): hậu cho sẵn ăn nhau → 'Vô nghiệm' + tô đỏ ô + chữ cảnh báo của trình soạn", pg.inner_text(".cr-chip"))
    check(pg.locator("button:has-text('Chơi thử')").is_disabled(), "N-Queens (soạn): đề vô nghiệm → nút Chơi thử bị khoá")
    pg.click(sel(extra))
    pg.wait_for_selector(".cr-chip.c-ok", timeout=15000)
    check(pg.locator(".pz-nq-edit .pz-nq-cell.conflict").count() == 0, "N-Queens (soạn): bấm lại ô → gỡ hậu cho sẵn, trở lại 'Có đúng một nghiệm'")
    # bàn phím trong trình soạn
    pg.focus(sel(extra))
    pg.keyboard.press("Space")
    pg.wait_for_selector(".cr-chip.c-bad", timeout=15000)
    pg.keyboard.press("Delete")
    pg.wait_for_selector(".cr-chip.c-ok", timeout=15000)
    check(True, "N-Queens (soạn): Space/Delete trên ô đang focus đặt/gỡ hậu cho sẵn")
    # đổi N: giữ hậu còn nằm trong bàn mới
    pg.select_option(".pz-nq-edit select", "10")
    pg.wait_for_timeout(200)
    check(pg.locator(CELL).count() == 100 and pg.locator(".pz-nq-edit .pz-nq-cell.given").count() == len(givens), "N-Queens (soạn): đổi N=10 → dựng lại 100 ô, giữ nguyên các hậu cho sẵn", (pg.locator(CELL).count(), pg.locator(".pz-nq-cell.given").count()))
    pg.click("button[aria-label='Tăng N']")
    pg.click("button[aria-label='Tăng N']")
    pg.click("button[aria-label='Giảm N']")
    pg.wait_for_timeout(100)
    check(pg.locator(CELL).count() == 121 and pg.evaluate("document.querySelector('.pz-nq-edit select').value") == "11", "N-Queens (soạn): nút +/− đổi N từng bước (10 → 12 → 11 = 121 ô)", pg.locator(CELL).count())
    pg.select_option(".pz-nq-edit select", "4")
    pg.wait_for_timeout(200)
    keep = [i for i in givens if i // 8 < 4 and i % 8 < 4]
    check(pg.locator(CELL).count() == 16 and pg.locator(".pz-nq-edit .pz-nq-cell.given").count() == len(keep), "N-Queens (soạn): thu về N=4 → chỉ giữ hậu còn nằm trong bàn 4×4 (%d hậu)" % len(keep), (pg.locator(".pz-nq-cell.given").count(), len(keep)))
    check(pg.is_disabled("button[aria-label='Giảm N']"), "N-Queens (soạn): N=4 là cỡ nhỏ nhất → nút Giảm N khoá")
    pg.select_option(".pz-nq-edit select", "8")
    pg.wait_for_timeout(100)
    if not pg.is_disabled("button:has-text('Xoá hết hậu')"):
        pg.click("button:has-text('Xoá hết hậu')")
    for i in givens:
        pg.click(sel(i))
    pg.wait_for_selector(".cr-chip.c-ok", timeout=15000)
    # co giãn của trình soạn
    bad = []
    for w in (280, 360, 768, 1280):
        pg.set_viewport_size({"width": w, "height": 900})
        pg.wait_for_timeout(120)
        m = pg.evaluate("""() => { const r = document.querySelector('.pz-nq-board').getBoundingClientRect(), bt = [...document.querySelectorAll('.pz-nq-edit button, .pz-nq-edit select')].map(b => b.getBoundingClientRect().height);
          return { doc: document.documentElement.scrollWidth, inner: innerWidth, right: r.right, minBtn: Math.min.apply(null, bt) }; }""")
        if not (m["doc"] <= m["inner"] and m["right"] <= m["inner"] + 0.5 and m["minBtn"] >= 43.9):
            bad.append((w, m))
    check(not bad, "N-Queens (soạn): không tràn ngang ở 280/360/768/1280 px, nút +/−/ô chọn N/Xoá hết cao ≥ 44 px", bad[:2])
    pg.set_viewport_size({"width": 1280, "height": 900})
    pg.wait_for_selector(".cr-chip.c-ok", timeout=15000)
    pg.click("button:has-text('Chơi thử')")
    pg.wait_for_selector(".pz-nq-grid:not(.ro) .pz-nq-cell.given", timeout=15000)
    check(pg.locator(".pz-nq-cell.given").count() == len(givens) and pg.locator(CELL).count() == 64 and pg.evaluate("location.hash").startswith("#/play/"), "N-Queens (soạn): 'Chơi thử' mở ván có đúng %d hậu cho sẵn, bàn 8×8" % len(givens))
    # mở "sửa bản sao" từ puzzle đang có: khởi tạo từ env.puzzle
    P.go("#/create/nqueens", 300)
    pg.wait_for_selector(".pz-nq-edit .pz-nq-grid")
    check(pg.locator(".pz-nq-edit .pz-nq-cell.given").count() == len(givens), "N-Queens (soạn): quay lại màn Tạo → khôi phục bản nháp (env.input) với đúng %d hậu cho sẵn" % len(givens))
    P.go("#/", 150)


# ================================================================================================ cảm ứng thật (Chromium di động)
def touch_checks(P, check):
    try:
        br = P.ctx.browser
        M = type(P)(br, P.url, "nq-di-dong", viewport={"width": 393, "height": 727}, device_scale_factor=2.75, has_touch=True, is_mobile=True,
                    user_agent="Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36")
    except Exception as e:  # noqa: BLE001
        check(False, "N-Queens: mở Chromium di động để thử chạm thật", e)
        return
    try:
        pg = M.pg
        M.start("nqueens", "8", "easy", SEED0 + 40)
        pg.wait_for_selector(CELL)
        g, n = state(M)
        cdp = M.ctx.new_cdp_session(pg)
        free = [i for i, x in enumerate(g["initial"]) if x == 0]
        a = free[4]
        pg.tap(sel(a))
        pg.wait_for_timeout(120)
        check(state(M)[0]["v"][a] == 1, "N-Queens (cảm ứng): chạm nhanh (pointer touch) vào ô trống → đặt hậu")
        b = pg.locator(sel(free[9])).bounding_box()
        mv = state(M)[0]["moves"]
        touch_down_up(cdp, b["x"] + b["width"] / 2, b["y"] + b["height"] / 2, 700, pg)
        g2, _ = state(M)
        check(g2["v"][free[9]] == 2 and g2["moves"] == mv + 1, "N-Queens (cảm ứng): GIỮ LÂU ô trống (không cần chuột phải) → đánh dấu chấm, đúng một nước đi", (g2["v"][free[9]], g2["moves"] - mv))
        b = pg.locator(sel(free[11])).bounding_box()
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": b["x"] + b["width"] / 2, "y": b["y"] + b["height"] / 2}]})
        cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": b["x"] + b["width"] / 2, "y": b["y"] + b["height"] / 2 + 60}]})
        pg.wait_for_timeout(700)
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        pg.wait_for_timeout(120)
        check(state(M)[0]["v"][free[11]] == 0, "N-Queens (cảm ứng): vuốt/kéo khỏi ô (cuộn trang) → huỷ, không đặt gì")
        pg.tap("button[data-mode='dot']")
        pg.tap(sel(free[12]))
        pg.wait_for_timeout(100)
        check(state(M)[0]["v"][free[12]] == 2, "N-Queens (cảm ứng): chạm nút chế độ 'Chấm' rồi chạm ô → chấm")
        pg.tap("button[data-mode='queen']")
        sc = pg.evaluate("[document.documentElement.scrollWidth, innerWidth]")
        hs = pg.evaluate("[...document.querySelectorAll('.pz-nq button')].map(b => Math.round(b.getBoundingClientRect().height))")
        check(sc[0] <= sc[1] and min(hs) >= 44, "N-Queens (cảm ứng): màn 393 px không tràn ngang, nút ≥ 44 px (%s)" % sorted(set(hs)), (sc, hs))
        cdp.detach()
    finally:
        M.close()


# ================================================================================================ WebKit (tiến trình con)
WEBKIT_SCRIPT = r'''
import sys
from playwright.sync_api import sync_playwright
url = sys.argv[1]
out = []
def rep(ok, msg, detail=""):
    print("WK|%s|%s|%s" % ("ok" if ok else "bad", msg, detail), flush=True)
GAME = r"""() => { const m = /#\/play\/([^?]+)/.exec(location.hash); const g = Puz.ui.app.ctx().getGame(decodeURIComponent(m[1])); return { v: g.state.v.slice(), initial: g.puzzle.initial.v.slice(), moves: g.counters.moves }; }"""
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
    pg.evaluate("location.hash = '#/new/nqueens?size=8&tier=easy&seed=20261117&go=1'")
    pg.wait_for_selector(".pz-nq-cell", timeout=30000)
    pg.wait_for_timeout(300)
    g = pg.evaluate(GAME)
    n = 8
    cells = pg.locator(".pz-nq-cell").count()
    rep(cells == 64 and pg.locator(".pz-nq-cell.given").count() == sum(g["initial"]), "WebKit iPhone 13: bàn vẽ 64 ô, hậu cho sẵn khớp state", (cells, pg.locator(".pz-nq-cell.given").count()))
    sc = pg.evaluate("[document.documentElement.scrollWidth, innerWidth]")
    rep(sc[0] <= sc[1], "WebKit iPhone 13: không tràn ngang (%d/%d px)" % (sc[0], sc[1]), sc)
    free = [i for i, x in enumerate(g["initial"]) if x == 0]
    a = free[5]
    pg.tap(".pz-nq-cell[data-i='%d']" % a)
    pg.wait_for_timeout(150)
    g1 = pg.evaluate(GAME)
    rep(g1["v"][a] == 1 and g1["moves"] == g["moves"] + 1, "WebKit iPhone 13: chạm ô trống → đặt hậu (Pointer Events cảm ứng)", (g1["v"][a], g1["moves"]))
    pg.tap(".pz-nq-cell[data-i='%d']" % a)
    pg.wait_for_timeout(150)
    rep(pg.evaluate(GAME)["v"][a] == 0, "WebKit iPhone 13: chạm lại → gỡ hậu")
    pg.tap("button[data-mode='dot']")
    pg.tap(".pz-nq-cell[data-i='%d']" % a)
    pg.wait_for_timeout(150)
    rep(pg.evaluate(GAME)["v"][a] == 2 and pg.locator(".pz-nq-cell[data-i='%d'] .pz-nq-dot" % a).count() == 1, "WebKit iPhone 13: chế độ Chấm → chấm loại")
    pg.tap("button[data-mode='queen']")
    pg.tap(".pz-nq-cell[data-i='%d']" % free[8])
    pg.tap("button:has-text('Hiện ô bị tấn công')")
    pg.wait_for_timeout(150)
    rep(pg.locator(".pz-nq-cell.atk").count() > 0, "WebKit iPhone 13: 'Hiện ô bị tấn công' tô được các ô (container query + ::before)", pg.locator(".pz-nq-cell.atk").count())
    sw = pg.evaluate("(() => { const c = document.querySelector('.pz-nq-cell.given .pz-nq-q svg'); const r = c.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })()")
    rep(sw[0] >= 20 and sw[1] >= 20, "WebKit iPhone 13: quân hậu SVG hiển thị (%dx%d px)" % (sw[0], sw[1]), sw)
    hs = pg.evaluate("[...document.querySelectorAll('.pz-nq button')].map(b => Math.round(b.getBoundingClientRect().height))")
    rep(min(hs) >= 44, "WebKit iPhone 13: mọi nút điều khiển cao ≥ 44 px", hs)
    pg.evaluate("location.hash = '#/create/nqueens'")
    pg.wait_for_selector(".pz-nq-edit .pz-nq-cell", timeout=15000)
    pg.tap(".pz-nq-edit .pz-nq-cell[data-i='%d']" % 10)
    pg.wait_for_timeout(150)
    rep(pg.locator(".pz-nq-edit .pz-nq-cell.given").count() == 1, "WebKit iPhone 13: trình soạn: chạm ô → đặt hậu cho sẵn")
    sc = pg.evaluate("[document.documentElement.scrollWidth, innerWidth]")
    rep(sc[0] <= sc[1], "WebKit iPhone 13: trình soạn không tràn ngang (%d/%d px)" % (sc[0], sc[1]), sc)
    rep(not errs, "WebKit iPhone 13: không lỗi console/pageerror", errs[:2])
    br.close()
'''


def webkit_checks(P, check):
    try:
        r = subprocess.run([sys.executable, "-c", WEBKIT_SCRIPT, P.url], capture_output=True, text=True, encoding="utf-8", timeout=180)
    except Exception as e:  # noqa: BLE001
        check(False, "N-Queens: chạy WebKit iPhone 13 (tiến trình con)", e)
        return
    lines = [ln for ln in r.stdout.splitlines() if ln.startswith("WK|")]
    for ln in lines:
        _, ok, msg, detail = (ln.split("|", 3) + [""])[:4]
        check(ok == "ok", "N-Queens: " + msg, detail)
    check(len(lines) >= 10 and r.returncode == 0, "N-Queens: tiến trình WebKit chạy hết (%d phép)" % len(lines), (r.stderr or "").strip().splitlines()[-1:] or r.returncode)


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
            C.section(" · bàn nqueens: tương tác riêng (chạy rời)")
            run(P, C.check, C.section, "nqueens")
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
