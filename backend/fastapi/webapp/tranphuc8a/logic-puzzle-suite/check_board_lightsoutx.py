# -*- coding: utf-8 -*-
"""Kiểm riêng của bàn LIGHTS OUT BIẾN THỂ (assets/js/ui/boards/lightsoutx.js + assets/css/board-lightsoutx.css) bằng trình duyệt thật.

check.py nạp tệp này và gọi run(P, check, section, tid) sau vòng đời chung của mọi loại (xem tang_2). P là Page của check.py (P.pg = Playwright page).
Phần chạy trên Edge thật (channel="msedge", lùi về Chromium + in rõ nếu máy không có Edge) nằm ở edge_p7(): bàn mặc định, bàn biến thể (vua + xuyến + 3 mức + ô khoá),
bàn 5 mức, xem trước nước bấm (cả ô cuốn vòng), bàn phím bỏ qua ô khoá, giải bằng cách bấm thật, công tắc Đuổi đèn mod k, replay chỉ-đọc, trang Puzzle mới (options), trình soạn, 360 px.

Nguồn sự thật ĐỘC LẬP: luật bấm viết lại ở đây bằng Python (offset, cuốn vòng bằng %, bỏ ô khoá, cộng dồn mod k) để so với state sau mỗi lần bấm và với tập ô xem trước;
bất biến kiểm bằng vét cạn mọi vector y của hạt nhân (Python)."""

from __future__ import annotations

import itertools
import re

SEED = 20261017

OFFS = {
    "cross": [(0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)],
    "x": [(0, 0), (-1, -1), (-1, 1), (1, -1), (1, 1)],
    "king": [(0, 0), (-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)],
    "knight": [(0, 0), (-2, -1), (-2, 1), (-1, -2), (-1, 2), (1, -2), (1, 2), (2, -1), (2, 1)],
    "plus2": [(0, 0), (-1, 0), (1, 0), (0, -1), (0, 1), (-2, 0), (2, 0), (0, -2), (0, 2)],
}


# ---------------------------------------------------------------------------------------------- nguồn độc lập
def eff(sp, i):
    """{ô: số lần cộng (mod k, ≠ 0)} khi bấm ô i — mô phỏng độc lập."""
    w, h, k = sp["w"], sp["h"], sp["k"]
    r, c = divmod(i, w)
    acc = {}
    for dr, dc in OFFS[sp["rule"]]:
        rr, cc = r + dr, c + dc
        if sp["topo"] == "torus":
            rr, cc = rr % h, cc % w
        elif not (0 <= rr < h and 0 <= cc < w):
            continue
        j = rr * w + cc
        if j in sp["holes"]:
            continue
        acc[j] = acc.get(j, 0) + 1
    return {j: n % k for j, n in acc.items() if n % k}


def sim(sp, v, i):
    out = list(v)
    for j, n in eff(sp, i).items():
        out[j] = (out[j] + n) % sp["k"]
    return out


def rgb(s):
    m = re.match(r"rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)", s.strip())
    if not m:
        raise ValueError(s)
    return (int(m.group(1)), int(m.group(2)), int(m.group(3)))


def lum(c):
    def f(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (f(x) for x in c)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(a, b):
    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


JS_GAME = """() => {
  const id = decodeURIComponent(location.hash.split('/play/')[1].split('?')[0]);
  const g = Puz.ui.app.ctx().getGame(id), d = g.puzzle.data;
  return { id: g.id, w: d.w, h: d.h, rule: d.rule, topo: d.topo, k: d.k, holes: d.holes, presses: d.presses, v: g.state.v.slice(), moves: g.counters.moves, status: g.status,
           initial: g.puzzle.initial.v.slice(), hint: g.lastHint, setting: g.settings().loHint || null, options: g.puzzle.options, grade: g.status === 'solved' ? g.grade() : null };
}"""
JS_SOLVE_HINTS = """() => {
  const id = decodeURIComponent(location.hash.split('/play/')[1].split('?')[0]), g = Puz.ui.app.ctx().getGame(id), seq = []; let tech = null, n = 0;
  while (g.status === 'playing' && n < 4000) { const h = g.hint(3); if (!h || h.none || !h.action) return { err: 'hint ' + n, seq }; tech = h.technique; const r = g.applyHint(h); if (!r.ok) return { err: 'apply ' + n, seq }; seq.push(h.action.i); n++; }
  return { status: g.status, seq, tech };
}"""


def cell(i):
    return ".board-host .pz-lo-cell[data-i='%d']" % i


def gstate(pg):
    return pg.evaluate(JS_GAME)


def stats(pg):
    return [t.strip() for t in pg.evaluate("[...document.querySelectorAll('.board-host .pz-lo-stat')].map(e => e.textContent)")]


def spec_of(g):
    return {"w": g["w"], "h": g["h"], "rule": g["rule"], "topo": g["topo"], "k": g["k"], "holes": set(g["holes"])}


def start_o(P, size, tier, seed, o):
    """Vào ván mới với tuỳ chọn o (liên kết seed #/new/lightsoutx?...&o=rule:king,k:3&go=1)."""
    P.go("#/new/lightsoutx?size=%s&tier=%s&seed=%d&o=%s&go=1" % (size, tier, seed, o), 100)
    P.pg.wait_for_selector(".board-host > *", timeout=30000)
    P.pg.wait_for_function("/#\\/play\\//.test(location.hash)", timeout=30000)


def min_obstruction_size(sp, v):
    """Vét cạn mọi y ∈ Z_k^n (n ô thật): y·cột_j = 0 ∀j và y·v ≠ 0 → số ô khác 0 nhỏ nhất. None nếu bàn giải được."""
    w, h, k = sp["w"], sp["h"], sp["k"]
    act = [i for i in range(w * h) if i not in sp["holes"]]
    cols = {j: eff(sp, j) for j in act}
    best = None
    for ys in itertools.product(range(k), repeat=len(act)):
        if not any(ys):
            continue
        y = dict(zip(act, ys))
        ok = all(sum(y[t] * n for t, n in cols[j].items()) % k == 0 for j in act)
        if ok and sum(y[i] * v[i] for i in act) % k:
            sup = sum(1 for x in ys if x)
            best = sup if best is None else min(best, sup)
    return best


def edge_p7(P, check, section, tid):
    PageCls = type(P)
    bt = P.pg.context.browser.browser_type
    try:
        br, kenh = bt.launch(channel="msedge"), "Edge"
    except Exception as e:  # noqa: BLE001
        br, kenh = bt.launch(), "Chromium (không mở được Edge: %s)" % str(e).splitlines()[0][:80]
    section("  — đợt P7 trên %s: bàn mặc định, biến thể (vua · xuyến · 3 mức · ô khoá), 5 mức, xem trước, bàn phím, giải bằng bấm, Đuổi đèn mod k, replay, Puzzle mới, trình soạn, 360 px" % kenh)
    E = PageCls(br, P.url, "lox-p7", viewport={"width": 1280, "height": 900})
    pg = E.pg
    try:
        # ======================================================================= bàn mặc định (như Lights Out cổ điển, k = 2)
        E.start(tid, "5", "medium", SEED + 61)
        g = gstate(pg)
        sp, w, h = spec_of(g), g["w"], g["h"]
        n = w * h
        check(pg.locator(".board-host .pz-lo-cell").count() == n and pg.locator(".board-host .pz-lox-multi").count() == 0 and pg.locator(".board-host .rays").count() == n, "k = 2: bàn %d×%d dùng biểu tượng đèn (đĩa + tia), không vòng cung" % (w, h))
        st = stats(pg)
        K = len(g["presses"])
        check(st[0].startswith("Chữ thập") and "có mép" in st[0] and st[2].startswith("0 lần bấm") and st[3] == "Par %d lần bấm" % K, "chip: luật · mép · mức, đèn sáng, lần bấm, 'Par %d lần bấm'" % K, st)
        chips = pg.locator(".board-host .pz-lo-hintsw .chip")
        check(chips.count() == 2 and "Đuổi đèn" in chips.nth(1).inner_text() and pg.evaluate("localStorage.getItem('puz:lox-hint')") in (None, "min"), "luật chữ thập + có mép + không ô khoá: có công tắc kiểu gợi ý (Ít bấm nhất | Đuổi đèn)")
        before = gstate(pg)
        pg.click(cell(12))
        after = gstate(pg)
        check(after["v"] == sim(sp, before["v"], 12) and after["moves"] == 1, "bấm ô giữa: state = mô phỏng độc lập (cộng 1 mod 2 cho chữ thập)")
        check(pg.evaluate("[...document.querySelectorAll('.board-host .pz-lo-cell')].map(c => c.classList.contains('on') ? 1 : 0)") == after["v"], "DOM khớp state sau khi bấm")

        # ======================================================================= bàn biến thể: vua · xuyến · 3 mức · ô khoá
        start_o(E, "6", "medium", SEED + 62, "rule:king,topo:torus,k:3,holes:few")
        g = gstate(pg)
        sp, w, h = spec_of(g), g["w"], g["h"]
        n = w * h
        holes = sorted(g["holes"])
        check(g["rule"] == "king" and g["topo"] == "torus" and g["k"] == 3 and len(holes) == 2 and g["options"] == {"rule": "king", "topo": "torus", "k": "3", "holes": "few"}, "liên kết o= → đề đúng luật/mép/k, 2 ô khoá (6 % của 36), puzzle.options gọn", (g["rule"], g["topo"], g["k"], holes, g["options"]))
        check(pg.locator(".board-host .pz-lox-multi").count() == 1 and pg.locator(".board-host .pz-lo-grid.torus").count() == 1 and pg.evaluate("getComputedStyle(document.querySelector('.board-host .pz-lo-grid')).borderTopStyle") == "dashed", "k = 3: có lớp k mức; xuyến: khung viền ĐỨT")
        lock = pg.evaluate("[...document.querySelectorAll('.board-host .pz-lo-cell.lock')].map(c => [+c.dataset.i, c.getAttribute('aria-disabled'), c.getAttribute('tabindex'), c.getAttribute('aria-label')])")
        check(sorted(x[0] for x in lock) == holes and all(x[1] == "true" and x[2] == "-1" and "ô khoá" in x[3] for x in lock), "ô khoá: aria-disabled, ngoài thứ tự Tab, nhãn 'ô khoá'", lock)
        check(pg.locator(".board-host .pz-lo-hintsw").count() == 0, "luật vua (không phải chữ thập, có xuyến, có ô khoá): KHÔNG có công tắc Đuổi đèn")
        st = stats(pg)
        check("Vua" in st[0] and "quấn mép" in st[0] and "3 mức" in st[0] and "2 ô khoá" in st[0] and st[1].endswith("ô khác 0"), "chip nêu luật, mép, số mức, ô khoá; đếm 'ô khác 0'", st)
        note = pg.inner_text(".board-host .pz-lox-note")
        check("Quấn mép" in note and "ô khoá" in note and "quay về 0" in note, "dòng chú thích nêu quấn mép, ô khoá, vòng mức", note)
        # vẽ k mức: số cung sáng = mức, chữ số = mức, aria-label
        lv = pg.evaluate("[...document.querySelectorAll('.board-host .pz-lo-cell:not(.lock)')].map(c => [+c.dataset.i, c.querySelectorAll('.seg.f').length, c.querySelector('.num').textContent, c.getAttribute('aria-label'), c.querySelectorAll('.seg').length])")
        check(all(x[1] == g["v"][x[0]] and x[2] == str(g["v"][x[0]]) and ("mức %d trên 2" % g["v"][x[0]]) in x[3] and x[4] == 2 for x in lv), "mỗi ô thường: số cung sáng = chữ số = mức (0…2), 2 cung, aria-label 'mức m trên 2'", lv[:3])
        # bấm: state = mô phỏng; ô khoá không bấm được
        free = [i for i in range(n) if i not in sp["holes"]]
        for i in (free[0], free[len(free) // 2], free[-1], free[5]):
            before = gstate(pg)
            pg.click(cell(i))
            after = gstate(pg)
            check(after["v"] == sim(sp, before["v"], i) and after["moves"] == before["moves"] + 1, "bấm ô %d (vua, xuyến, mod 3): state = mô phỏng độc lập (cuốn vòng, bỏ ô khoá, cộng mod 3)" % i)
        m0 = gstate(pg)["moves"]
        pg.click(cell(holes[0]), force=True)
        check(gstate(pg)["moves"] == m0, "bấm ô khoá: không có tác dụng, không tính lần bấm")
        lv = pg.evaluate("[...document.querySelectorAll('.board-host .pz-lo-cell:not(.lock)')].map(c => [+c.dataset.i, c.querySelectorAll('.seg.f').length, c.querySelector('.num').textContent])")
        cur = gstate(pg)["v"]
        check(all(x[1] == cur[x[0]] and x[2] == str(cur[x[0]]) for x in lv), "sau các lần bấm: cung sáng + chữ số vẽ lại đúng mức mới")
        # bấm 3 lần = như cũ
        b3 = gstate(pg)["v"]
        for _ in range(3):
            pg.click(cell(free[3]))
        check(gstate(pg)["v"] == b3, "bấm một ô 3 lần (k = 3) → như chưa bấm")
        # xem trước (rê chuột): đúng tập ô, kể cả ô cuốn vòng; nhãn +n
        for i in (0, free[7]):
            if i in sp["holes"]:
                continue
            pg.hover(cell(i))
            pg.wait_for_timeout(60)
            want = eff(sp, i)
            got = pg.evaluate("[...document.querySelectorAll('.board-host .pz-lo-cell.xp, .board-host .pz-lo-cell.xp-c')].map(c => [+c.dataset.i, c.querySelector('.pz-lox-add').textContent])")
            check(sorted(x[0] for x in got) == sorted(want.keys()) and all(x[1] == "+%d" % want[x[0]] for x in got), "rê chuột ô %d: tô đúng %d ô sẽ đổi (kể cả mép đối diện của xuyến, trừ ô khoá), nhãn +n" % (i, len(want)), (sorted(x[0] for x in got), sorted(want)))
        pg.mouse.move(2, 2)
        check(pg.locator(".board-host .pz-lo-cell.xp, .board-host .pz-lo-cell.xp-c").count() == 0, "rời chuột khỏi bàn: hết tô xem trước")
        # bàn phím: mũi tên nhảy qua ô khoá, Space bấm
        first = free[0]
        pg.focus(cell(first))
        want_nav = []
        for key, dr, dc in (("ArrowRight", 0, 1), ("ArrowDown", 1, 0)):
            pg.keyboard.press(key)
            want_nav.append(int(pg.evaluate("document.activeElement.dataset.i")))
        r0, c0 = divmod(first, w)
        t1 = r0 * w + c0 + 1
        while t1 in sp["holes"] and t1 // w == r0 and t1 % w < w - 1:
            t1 += 1
        check(want_nav[0] == (t1 if t1 not in sp["holes"] else first) and all(x not in sp["holes"] for x in want_nav), "mũi tên di chuyển giữa các ô, không bao giờ đứng trên ô khoá", want_nav)
        # đưa focus tới ô liền trước ô khoá cùng hàng (nếu có) và kiểm nhảy qua
        hh = holes[0]
        if hh % w > 0 and hh % w < w - 1 and (hh + 1) not in sp["holes"] and (hh - 1) not in sp["holes"]:
            pg.focus(cell(hh - 1))
            pg.keyboard.press("ArrowRight")
            check(int(pg.evaluate("document.activeElement.dataset.i")) == hh + 1, "ArrowRight nhảy QUA ô khoá (ô %d → %d)" % (hh - 1, hh + 1))
        mv = gstate(pg)["moves"]
        pg.keyboard.press("Space")
        check(gstate(pg)["moves"] == mv + 1, "Space bấm ô đang focus")
        # mũi tên nhảy QUA ô khoá — bàn dựng tay (4×3, ô khoá 1 và 4) gắn vào trang bằng chính board.mount
        r_nav = pg.evaluate("""() => {
          const T = Puz.types.get("lightsoutx"), made = T.fromInput({ w: 4, h: 3, rule: "cross", topo: "flat", k: 3, holes: [1, 4], v: [0, 0, 1, 0, 0, 2, 0, 1, 0, 0, 1, 0] }), p = made.puzzle;
          const wrap = document.createElement("div"); wrap.id = "nav-fixture"; wrap.style.cssText = "position:fixed;left:0;top:0;width:340px;z-index:99999;background:#fff;";
          const host = document.createElement("div"); host.className = "board-host"; wrap.append(host); document.body.append(wrap);
          const g = Puz.game.create(p, {}); Puz.boards.lightsoutx.mount(host, { game: g, puzzle: p, type: T, U: Puz.ui, readOnly: false, settings: () => ({}), announce: () => {} });
          return { ok: made.ok, locked: [...host.querySelectorAll(".lock")].map(c => +c.dataset.i), tab: [...host.querySelectorAll("[tabindex='0']")].map(c => +c.dataset.i) };
        }""")
        check(r_nav["ok"] and r_nav["locked"] == [1, 4] and r_nav["tab"] == [0], "bàn dựng tay 4×3 (ô khoá 1 và 4): đúng 2 ô khoá, ô tabindex=0 là ô thường đầu tiên", r_nav)
        pg.focus("#nav-fixture .pz-lo-cell[data-i=\"0\"]")
        pg.keyboard.press("ArrowRight")
        a1 = int(pg.evaluate("document.activeElement.dataset.i"))
        pg.keyboard.press("ArrowLeft")
        a2 = int(pg.evaluate("document.activeElement.dataset.i"))
        pg.keyboard.press("ArrowDown")
        a3 = int(pg.evaluate("document.activeElement.dataset.i"))
        pg.keyboard.press("End")
        a4 = int(pg.evaluate("document.activeElement.dataset.i"))
        pg.keyboard.press("Home")
        a5 = int(pg.evaluate("document.activeElement.dataset.i"))
        check((a1, a2, a3, a4, a5) == (2, 0, 8, 11, 8), "ArrowRight nhảy QUA ô khoá 1 (0→2), ArrowLeft về 0, ArrowDown nhảy QUA ô khoá 4 (0→8), End → 11, Home → 8", (a1, a2, a3, a4, a5))
        pg.evaluate("document.getElementById(\"nav-fixture\").remove()")
        # giải bằng cách bấm thật theo data.presses (mô phỏng người chơi), kiểm hộp thoại + grade
        start_o(E, "6", "medium", SEED + 63, "rule:king,topo:torus,k:3,holes:few")
        g = gstate(pg)
        for i in g["presses"]:
            pg.click(cell(i))
        pg.wait_for_selector("dialog[open] h2:has-text('Đã giải')", timeout=10000)
        gr = gstate(pg)
        stt = pg.inner_text("dialog[open] .stat-grid")
        check(gr["status"] == "solved" and gr["grade"]["stars"] == 3 and gr["grade"]["quality"] == 1 and "★★★" in stt and "Điểm tối ưu" in stt, "bấm đúng par %d lần → 'Đã giải', 3★, chất lượng 1" % len(g["presses"]), (gr["grade"], stt.replace("\n", " ")))
        # replay chỉ-đọc
        pg.click("dialog[open] button:has-text('Xem lời giải từng bước')")
        pg.wait_for_selector(".replay-panel:not([hidden])", timeout=20000)
        check(pg.locator(".board-host .pz-lo-hintsw").count() == 0, "replay: bàn chỉ-đọc, không có công tắc kiểu gợi ý")
        pg.click(".replay-panel button:has-text('Sau')")
        mk = pg.evaluate("[...document.querySelectorAll('.board-host .pz-lo-cell.replay')].map(c => +c.dataset.i).sort((a, b) => a - b)")
        check(mk == sorted(set(g["presses"])) and "Bản đồ lời giải" in pg.inner_text(".rp-text"), "replay bước 1: tô MỌI ô cần bấm (bản đồ lời giải)", (mk, sorted(set(g["presses"]))))
        pg.click(".replay-panel button:has-text('Thoát replay')")

        # ======================================================================= 5 mức (x · có mép), độ tương phản chữ số
        start_o(E, "5", "hard", SEED + 64, "rule:x,k:5")
        g = gstate(pg)
        sp = spec_of(g)
        check(pg.locator(".board-host .pz-lo-cell:not(.lock) .seg").count() == (g["w"] * g["h"]) * 4 and pg.locator(".board-host .pz-lo-hintsw").count() == 0, "k = 5: mỗi ô có vòng 4 cung; luật X: không có công tắc Đuổi đèn")
        for theme in ("light", "dark"):
            pg.evaluate("t => { document.documentElement.dataset.theme = t }", theme)
            pg.wait_for_timeout(80)
            probe = pg.evaluate("""() => { const c = document.querySelector('.board-host .pz-lo-cell.on') || document.querySelector('.board-host .pz-lo-cell'), s = getComputedStyle(c), num = getComputedStyle(c.querySelector('.num')),
              seg = [...c.querySelectorAll('.seg.f')][0], sg = seg ? getComputedStyle(seg).stroke : null; return { bg: s.backgroundColor, num: num.fill, seg: sg }; }""")
            bg, numc = rgb(probe["bg"]), rgb(probe["num"])
            segok = True if not probe["seg"] or probe["seg"] == "none" else ratio(rgb(probe["seg"]), bg) >= 3
            check(ratio(numc, bg) >= 4.5 and segok, "chữ số mức ≥ 4,5:1 trên nền ô và cung sáng ≥ 3:1 (giao diện %s)" % theme, (round(ratio(numc, bg), 2), probe))
        pg.evaluate("delete document.documentElement.dataset.theme")
        i0 = next(i for i in range(g["w"] * g["h"]) if g["v"][i] == 0)
        for _ in range(4):
            pg.click(cell(i0))
        # (4 lần bấm một ô mod 5 chưa về như cũ; chỉ kiểm mô phỏng)
        cur = gstate(pg)["v"]
        want = g["v"]
        for _ in range(4):
            want = sim(sp, want, i0)
        check(cur == want, "k = 5: bấm 4 lần một ô = mô phỏng độc lập (cộng 4 mod 5)")

        # ======================================================================= công tắc Đuổi đèn mod k (chữ thập · có mép · k = 3)
        start_o(E, "5", "medium", SEED + 65, "k:3")
        g = gstate(pg)
        sp, w, h = spec_of(g), g["w"], g["h"]
        chips = pg.locator(".board-host .pz-lo-hintsw .chip")
        check(chips.count() == 2 and chips.nth(0).get_attribute("aria-pressed") == "true" and chips.nth(1).get_attribute("aria-pressed") == "false" and all(chips.nth(q).bounding_box()["height"] >= 44 for q in range(2)), "k = 3 chữ thập: công tắc 'Ít bấm nhất | Đuổi đèn', mỗi nút cao ≥ 44 px")
        pg.click(".pz-lo-hintsw .chip:has-text('Đuổi đèn')")
        check(gstate(pg)["setting"] == "chase", "bấm 'Đuổi đèn': settings của ván = 'chase'")
        v = gstate(pg)["v"]
        first = next(i for i in range((h - 1) * w) if v[i])
        s_lv = v[first]
        pg.click(".toolbar button:has-text('Gợi ý')")
        pg.wait_for_selector(".hint-panel:not([hidden]) .hint-text")
        pg.click(".hint-panel button:has-text('Chi tiết hơn')")
        pg.click(".hint-panel button:has-text('Chi tiết hơn')")
        h3 = gstate(pg)["hint"]
        txt = pg.inner_text(".hint-panel .hint-text")
        check(h3["level"] == 3 and h3["action"]["i"] == first + w and "Đuổi đèn" in pg.text_content(".hint-panel .hint-level"),
              "Đuổi đèn mod 3 mức 3: bấm ô NGAY DƯỚI ô khác 0 đầu tiên (ô %d, mức %d)" % (first + w, s_lv), (h3 and h3.get("action"), txt))
        # sau (3 − s) lần bấm ô dưới thì ô trên về 0
        for _ in range((3 - s_lv) % 3):
            pg.click(cell(first + w))
        check(gstate(pg)["v"][first] == 0, "bấm ô dưới (k − mức) lần → ô trên về 0 (đúng thủ tục đuổi đèn mod 3)")
        res = pg.evaluate(JS_SOLVE_HINTS)
        check(res.get("status") == "solved" and res.get("tech") == "Đuổi đèn", "lặp gợi ý Đuổi đèn (mod 3) giải xong ván (%d nước)" % len(res.get("seq", [])), res.get("err"))
        pg.wait_for_selector("dialog[open] h2:has-text('Đã giải')", timeout=10000)
        pg.keyboard.press("Escape")

        # ======================================================================= trang Puzzle mới: options
        E.go("#/new/lightsoutx", 400)
        pg.wait_for_selector(".ng-opt", timeout=10000)
        labs = pg.evaluate("[...document.querySelectorAll('.ng-opt')].map(e => e.innerText.replace(/\\s+/g, ' '))")
        check(len(labs) == 4 and "Luật bấm" in labs[0] and "Mép bàn" in labs[1] and "Số mức" in labs[2] and "Ô khoá" in labs[3], "Puzzle mới: 4 hàng tuỳ chọn (Luật bấm, Mép bàn, Số mức, Ô khoá)", labs)
        pg.click(".ng-opt >> nth=0 >> .chip:has-text('Quân mã')")
        pg.click(".ng-opt >> nth=1 >> .chip:has-text('Quấn mép')")
        pg.click(".ng-opt >> nth=2 >> .chip:has-text('5 mức')")
        pg.fill("#ng-seed", str(SEED + 70))
        pg.click("button:has-text('Bắt đầu')")
        pg.wait_for_function("/#\\/play\\//.test(location.hash)", timeout=30000)
        pg.wait_for_selector(".board-host .pz-lo-cell", timeout=30000)
        g = gstate(pg)
        check(g["rule"] == "knight" and g["topo"] == "torus" and g["k"] == 5 and g["options"] == {"rule": "knight", "topo": "torus", "k": "5"}, "chọn Quân mã + Quấn mép + 5 mức → ván đúng cấu hình, options gọn", (g["rule"], g["topo"], g["k"], g["options"]))
        # tải lại trang: khôi phục ván dở đúng cấu hình
        E.reload()
        E.go("#/", 300)
        pg.click(".resume .resume-main >> nth=0")
        pg.wait_for_selector(".board-host .pz-lo-cell")
        g2 = gstate(pg)
        check(g2["v"] == g["v"] and g2["rule"] == "knight" and pg.locator(".board-host .pz-lo-grid.torus").count() == 1, "tải lại trang: ván dở khôi phục đúng (luật mã, xuyến, 5 mức)")

        # ======================================================================= trình soạn
        E.go("#/create/lightsoutx", 400)
        pg.wait_for_selector(".pz-lox-ed .pz-lo-ed-grid", timeout=10000)
        pg.click(".ph-act button:has-text('Làm mới')")
        pg.click("dialog[open] button:has-text('Bắt đầu lại')")
        pg.wait_for_timeout(500)

        def ed(sel):
            return pg.evaluate("(s) => [...document.querySelectorAll('.pz-lo-ed-grid .pz-lo-cell')].map(c => " + sel + ")", None)

        def lit():
            return pg.evaluate("[...document.querySelectorAll('.pz-lo-ed-grid .pz-lo-cell')].map(c => c.classList.contains('lock') ? -1 : (c.querySelector('.num') ? +c.querySelector('.num').textContent : (c.classList.contains('on') ? 1 : 0)))")

        def wait_status(timeout=15000):
            pg.wait_for_function("(() => { const t = document.querySelector('.cr-status').textContent; return t.trim().length > 0 && t.indexOf('Đang kiểm tra') < 0; })()", timeout=timeout)

        check(pg.locator(".pz-lo-ed-grid .pz-lo-cell").count() == 25 and sum(lit()) == 0 and pg.locator(".pz-lox-opt .chip").count() >= 12, "trình soạn trống: bàn 5×5, các nhóm chip luật/mép/mức/chế độ")
        wait_status()
        check(pg.locator(".cr-status .form-err").count() >= 1 and pg.locator(".create-side button:has-text('Chơi thử')").is_disabled(), "bàn về 0 hết sẵn → vỏ báo lỗi, khoá 'Chơi thử'", pg.inner_text(".cr-status"))
        pg.click(".pz-lox-opt .chip:has-text('3 mức')")
        for i in (7, 12):
            pg.click(".pz-lo-ed-grid .pz-lo-cell[data-i='%d']" % i)
        pg.click(".pz-lo-ed-grid .pz-lo-cell[data-i='12']")
        check(lit()[7] == 1 and lit()[12] == 2 and "2 trên 25" in pg.inner_text(".pz-lo-info"), "k = 3: bấm ô tăng mức 1 → 2 (vòng); thông tin '2 trên 25 ô đang khác 0'", (lit()[7], lit()[12], pg.inner_text(".pz-lo-info")))
        pg.click(".pz-lo-ed-grid .pz-lo-cell[data-i='12']")
        check(lit()[12] == 0, "bấm lần thứ 3: vòng về mức 0")
        pg.click(".pz-lox-opt .chip:has-text('Vua')")
        pg.click(".pz-lox-opt .chip:has-text('Quấn mép')")
        pg.click(".pz-lox-opt .chip:has-text('Khoá ô')")
        pg.click(".pz-lo-ed-grid .pz-lo-cell[data-i='0']")
        pg.click(".pz-lo-ed-grid .pz-lo-cell[data-i='24']")
        check(lit()[0] == -1 and lit()[24] == -1 and pg.locator(".pz-lo-ed-grid .pz-lo-cell.lock[aria-disabled=true]").count() == 2 and pg.locator("button:has-text('Mở hết ô khoá')").is_visible(), "chế độ 'Khoá ô': bấm khoá 2 ô (nền sọc, aria-disabled), hiện nút 'Mở hết ô khoá'")
        pg.click(".pz-lox-opt .chip:has-text('Đặt mức')")
        pg.click(".pz-lo-ed-grid .pz-lo-cell[data-i='0']", force=True)
        check(lit()[0] == -1, "ô khoá không đổi mức khi ở chế độ 'Đặt mức'")
        wait_status()
        txt = pg.inner_text(".cr-status")
        check(pg.locator(".cr-diff").count() == 1 or pg.locator(".cr-status .form-err").count() >= 1, "vỏ kiểm đề biến thể bằng engine (worker) và hiện kết quả", txt.replace("\n", " | "))
        pg.click("button:has-text('Mở hết ô khoá')")
        check(pg.locator(".pz-lo-ed-grid .pz-lo-cell.lock").count() == 0, "'Mở hết ô khoá' bỏ mọi ô khoá")
        # bất biến sống: 4×4 chữ thập có mép k = 2 → bàn một đèn ở góc không giải được; tập tô viền chấm = tập nhỏ nhất theo vét cạn
        pg.click(".pz-lox-opt .chip:has-text('Chữ thập')")
        pg.click(".pz-lox-opt .chip:has-text('Có mép')")
        pg.click(".pz-lox-opt .chip:has-text('2 (bật/tắt)')")
        pg.click("button:has-text('Về 0 hết')")
        pg.select_option(".pz-lo-dim >> nth=0 >> select", "4")
        pg.select_option(".pz-lo-dim >> nth=1 >> select", "4")
        pg.wait_for_timeout(200)
        pg.click(".pz-lo-ed-grid .pz-lo-cell[data-i='0']")
        pg.wait_for_timeout(200)
        v = lit()
        sp4 = {"w": 4, "h": 4, "rule": "cross", "topo": "flat", "k": 2, "holes": set()}
        want = min_obstruction_size(sp4, v)
        ob = pg.evaluate("[...document.querySelectorAll('.pz-lo-ed-grid .pz-lo-cell.obst')].map(c => +c.dataset.i)")
        okInv = want is not None and len(ob) == want
        if okInv:     # y·A = 0 và y·b lẻ cho đúng tập đang tô
            y = {i: 1 for i in ob}
            okInv = all(sum(1 for t in eff(sp4, j) if t in y) % 2 == 0 for j in range(16)) and sum(v[i] for i in ob) % 2 == 1
        check(okInv, "bàn 4×4 một đèn ở góc: engine tô nhóm bất biến %d ô viền chấm — y·A = 0, y·b lẻ, và nhỏ nhất theo vét cạn mọi y (Python)" % (want or 0), (ob, want))
        check("Không giải được" in pg.inner_text(".pz-lox-ed .pz-lo-obinfo") and "CHẴN" in pg.inner_text(".pz-lox-ed .pz-lo-obinfo"), "dòng giải thích bất biến hiện dưới bàn", pg.inner_text(".pz-lox-ed .pz-lo-obinfo"))
        wait_status()
        check(pg.locator(".cr-status .form-err").count() >= 1 and pg.locator(".create-side button:has-text('Chơi thử')").is_disabled(), "vỏ cũng báo vô nghiệm + khoá 'Chơi thử'", pg.inner_text(".cr-status"))
        # bàn lớn 20×20: khung cuộn
        pg.select_option(".pz-lo-dim >> nth=0 >> select", "20")
        pg.select_option(".pz-lo-dim >> nth=1 >> select", "20")
        pg.wait_for_timeout(300)
        check(pg.locator(".pz-lo-ed-grid .pz-lo-cell").count() == 400 and pg.locator(".pz-lox-scroll").count() == 1, "bàn 20×20: 400 ô trong khung cuộn ngang")
    finally:
        E.close()
        br.close()

    # ======================================================================= điện thoại 360 px (Chromium)
    section("  — 360 px: bàn rộng cuộn trong khung, trang không tràn ngang")
    M = PageCls(P.pg.context.browser, P.url, "lox-360", viewport={"width": 360, "height": 780}, is_mobile=True, has_touch=True)
    try:
        start_o(M, "10", "hard", SEED + 71, "rule:king,topo:torus,k:5,holes:some")
        ov = M.pg.evaluate("({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })")
        cs = M.pg.evaluate("(() => { const c = document.querySelector('.board-host .pz-lo-cell:not(.lock)').getBoundingClientRect(); return [c.width, c.height]; })()")
        check(ov["sw"] <= ov["cw"] + 1 and cs[0] >= 24, "10×10 k=5 xuyến + ô khoá ở 360 px: không tràn ngang trang, ô ≥ 24 px", (ov, cs))
        M.go("#/create/lightsoutx", 400)
        M.pg.wait_for_selector(".pz-lox-ed .pz-lo-ed-grid", timeout=10000)
        M.pg.select_option(".pz-lo-dim >> nth=0 >> select", "20")
        M.pg.select_option(".pz-lo-dim >> nth=1 >> select", "20")
        M.pg.wait_for_timeout(300)
        r = M.pg.evaluate("({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, inner: (() => { const s = document.querySelector('.pz-lox-scroll'); return s ? [s.scrollWidth, s.clientWidth] : null; })() })")
        check(r["sw"] <= r["cw"] + 1 and r["inner"] and r["inner"][0] > r["inner"][1], "soạn 20×20 ở 360 px: cuộn ngang TRONG khung (không tràn trang)", r)
    finally:
        M.close()


def run(P, check, section, tid):
    edge_p7(P, check, section, tid)
