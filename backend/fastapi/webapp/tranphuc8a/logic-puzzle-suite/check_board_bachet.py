# -*- coding: utf-8 -*-
"""Kiểm riêng của bàn QUẢ CÂN BACHET (assets/js/ui/boards/bachet.js + assets/css/board-bachet.css) bằng trình duyệt thật.

check.py nạp tệp này và gọi run(P, check, section, tid) sau vòng đời chung của mọi loại. P là Page của check.py (P.pg = Playwright page).
Phần chạy trên Edge thật (channel="msedge", lùi về Chromium + in rõ nếu máy không có Edge) nằm ở edge_p6a(): giải trọn ván bằng giao diện (gõ gam vào ô, nút − / +, nút quả cân của bàn đặt),
dải phủ 1..N, cân thử, đếm "nước làm mất tối ưu", gợi ý tô ô, replay chỉ-đọc, ba cỡ (hai đĩa, một đĩa, đặt quả cân), trình soạn.

Nguồn sự thật ĐỘC LẬP: tập khối lượng cân được tính lại ở đây bằng Python (tổng có dấu dạng set), số quả tối thiểu bằng vòng lặp số nguyên, "còn mở rộng được" bằng vét cạn đa tập,
số quả tối thiểu của từng vật trong cỡ đặt quả cân bằng đệ quy dấu {-1,0,1}; vị trí quả cân đọc thẳng từ state.v (v = [ô…, cờ nộp]) — không gọi engine để tính giá trị."""

from __future__ import annotations

import itertools
import re
import threading

SEED = 20261017


# ---------------------------------------------------------------------------------------------- nguồn độc lập
def rgb(s):
    m = re.match(r"rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)", s.strip())
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


def sums(W, two):
    s = {0}
    for w in W:
        s = s | {v + w for v in s} | ({v - w for v in s} if two else set())
    return s


def covered(W, N, two):
    s = sums(W, two)
    return [x for x in range(1, N + 1) if x in s]


def run_len(W, N, two):
    s = sums(W, two)
    r = 0
    while r < N and (r + 1) in s:
        r += 1
    return r


def min_count(N, two):
    m = 1
    while (((3 ** m - 1) // 2) if two else (2 ** m - 1)) < N:
        m += 1
    return m


def feasible(W, N, two):
    """Vét cạn đa tập: còn thêm được (min_count - len(W)) quả để phủ 1..N không?"""
    r = min_count(N, two) - len(W)
    if r < 0:
        return False
    for add in itertools.combinations_with_replacement(range(1, N + 1), r):
        if len(covered(list(W) + list(add), N, two)) == N:
            return True
    return False


def dat_min(W, x):
    best = 99

    def rec(i, s, used):
        nonlocal best
        if i == len(W):
            if s == x and used < best:
                best = used
            return
        rec(i + 1, s, used)
        rec(i + 1, s + W[i], used + 1)
        rec(i + 1, s - W[i], used + 1)
    rec(0, 0, 0)
    return best


def arrange_min(W, t, two):
    best = 99

    def rec(i, s, used):
        nonlocal best
        if i == len(W):
            if s == t and used < best:
                best = used
            return
        rec(i + 1, s, used)
        rec(i + 1, s + W[i], used + 1)
        if two:
            rec(i + 1, s - W[i], used + 1)
    rec(0, 0, 0)
    return best


def num(s):
    return int(re.sub(r"[^\d]", "", s))


JS_HINT = """() => {
  const id = decodeURIComponent(/#\\/play\\/([^?]+)/.exec(location.hash)[1]), g = Puz.ui.app.ctx().getGame(id), T = g.type;
  return T.hint(g.puzzle, g.state, 3, g.settings());
}"""
JS_FOCUS = """() => { const a = document.activeElement; return { tag: a.tagName, cls: a.className, txt: (a.textContent || '').trim(), label: a.getAttribute('aria-label'), inBody: a === document.body }; }"""
JS_HUD = """() => [...document.querySelectorAll('.hud-chip')].map(c => ({ title: c.title, val: c.lastChild ? c.lastChild.textContent : '' }))"""
JS_LASTREC = "() => { const r = Puz.ui.app.ctx().user.history().filter(x => x.type === 'bachet'); return r.length ? r[r.length - 1] : null; }"
JS_DUP = """() => {
  const c = Puz.ui.app.ctx(), id = decodeURIComponent(/#\\/play\\/([^?]+)/.exec(location.hash)[1]), g = c.getGame(id), hosts = [], views = [];
  for (let k = 0; k < 2; k++) { const h = document.createElement('div'); document.body.append(h); hosts.push(h); views.push(Puz.boards.bachet.mount(h, { game: g, puzzle: g.puzzle, type: g.type, U: Puz.ui, readOnly: false, settings: c.settings, announce: () => {} })); }
  const ids = hosts.map(h => h.querySelector('.pz-bc-tryin').getAttribute('aria-describedby')), own = hosts.map((h, i) => { const e = document.getElementById(ids[i]); return !!e && h.contains(e); });
  views.forEach(v => v.destroy()); hosts.forEach(h => h.remove());
  return { ids: ids, own: own };
}"""

SLOT = ".board-host .pz-bc-slot"
SUMMARY = ".board-host .pz-bc-summary"


def slot_in(i):
    return "%s:nth-child(%d) input" % (SLOT, i + 1)


def vals_of(g):
    """Khối lượng các ô quả cân (ô trống bỏ) và cờ nộp, đọc thẳng từ state.v."""
    M = g["data"]["slots"]
    return [w for w in g["v"][:M] if w > 0], g["v"][M]


def ui_set(pg, i, val):
    pg.fill(slot_in(i), "" if val == 0 else str(val))
    pg.keyboard.press("Enter")
    pg.wait_for_timeout(30)


def summary_run(pg):
    m = re.search(r"phủ liền 1…([\d  ]+)", pg.inner_text(SUMMARY))
    return num(m.group(1)) if m else 0


def ui_apply_hint(pg, E, check_each=None, limit=30):
    """Lặp: lấy gợi ý mức 3 (không tính vào bộ đếm), làm lại BẰNG GIAO DIỆN (gõ vào ô hoặc bấm nút quả cân). Dừng khi gợi ý là 'nộp'. → số bước."""
    steps = 0
    for _ in range(limit):
        h = pg.evaluate(JS_HINT)
        a = h.get("action")
        if h.get("none") or not a:
            return steps, h
        if a["k"] == "set":
            ui_set(pg, a["i"], a["val"])
        elif a["k"] == "place":
            btn = '.board-host .pz-bc-wt[data-item="%d"][data-k="%d"]' % (a["item"], a["i"])
            cur = int(pg.get_attribute(btn, "data-pos"))
            for _k in range((a["val"] - cur) % 3):
                pg.click(btn)
        else:
            return steps, h
        steps += 1
        if check_each:
            check_each(E.game())
    return steps, None


def contrast(pg, fg, bg):
    c = pg.evaluate("""([a, b]) => { const f = document.createElement('i'), k = document.createElement('i'); f.style.color = 'var(' + a + ')'; k.style.color = 'var(' + b + ')'; document.body.append(f, k); const o = [getComputedStyle(f).color, getComputedStyle(k).color]; f.remove(); k.remove(); return o; }""", [fg, bg])
    return ratio(rgb(c[0]), rgb(c[1]))


def webkit_touch(url):
    """Luồng riêng (Playwright đồng bộ không lồng được): WebKit + iPhone 13, CHẠM thật: nút + của ô 1 ba lần, chạm 'Nộp'."""
    out = {"ok": False, "err": ""}
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as pw:
            br = pw.webkit.launch()
            ctx = br.new_context(**pw.devices["iPhone 13"], service_workers="block")
            pg = ctx.new_page()
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.goto(url, wait_until="load")
            pg.wait_for_function("document.body.classList.contains('ready')", timeout=30000)
            pg.evaluate("location.hash = '#/new/bachet?size=hai&tier=medium&seed=%d&go=1'" % (SEED + 93))
            pg.wait_for_selector(".board-host .pz-bc-slot", timeout=30000)
            pg.wait_for_timeout(300)
            out["data"] = pg.evaluate("Puz.ui.app.ctx().getGame(decodeURIComponent(/#\\/play\\/([^?]+)/.exec(location.hash)[1])).puzzle.data")
            for _ in range(3):
                pg.tap("%s:nth-child(1) .pz-bc-inc" % SLOT)
            pg.tap("%s:nth-child(2) .pz-bc-inc" % SLOT)
            pg.wait_for_timeout(100)
            out["v"] = pg.evaluate("Puz.ui.app.ctx().getGame(decodeURIComponent(/#\\/play\\/([^?]+)/.exec(location.hash)[1])).state.v.slice()")
            out["summary"] = pg.inner_text(SUMMARY)
            pg.tap(".board-host .pz-bc-submit")
            pg.wait_for_timeout(150)
            out["after_submit"] = pg.evaluate("Puz.ui.app.ctx().getGame(decodeURIComponent(/#\\/play\\/([^?]+)/.exec(location.hash)[1])).state.v.slice(-1)[0]")
            out["overflow"] = pg.evaluate("[document.documentElement.scrollWidth, innerWidth]")
            out["errs"] = errs
            out["ok"] = True
            br.close()
    except Exception as e:  # noqa: BLE001
        out["err"] = "%s: %s" % (type(e).__name__, e)
    return out


# ---------------------------------------------------------------------------------------------- Edge: giải trọn bằng giao diện, cân thử, lỗi, replay, ba cỡ, trình soạn
def edge_p6a(P, check, section, tid):
    PageCls = type(P)
    bt = P.pg.context.browser.browser_type
    try:
        br, kenh = bt.launch(channel="msedge"), "Edge"
    except Exception as e:  # noqa: BLE001
        br, kenh = bt.launch(), "Chromium (không mở được Edge: %s)" % str(e).splitlines()[0][:80]
    section("  — đợt P6a trên %s: giải trọn bằng giao diện (gõ ô, − / +, nút quả cân), dải phủ, cân thử, lỗi, gợi ý, replay chỉ-đọc, ba cỡ, trình soạn" % kenh)
    E = PageCls(br, P.url, "bc-p6a", viewport={"width": 1280, "height": 1000})
    pg = E.pg
    try:
        # ---- vẽ đúng theo state: bàn trống, dải phủ, tóm tắt
        E.start(tid, "hai", "medium", SEED + 61)
        g = E.game()
        d = g["data"]
        N, M, m = d["N"], d["slots"], d["m"]
        check(d["mode"] == "hai" and m == min_count(N, True), "đề vừa hai đĩa (N=%d): số quả tối thiểu engine %d = vòng lặp Python" % (N, m), (m, min_count(N, True)))
        check(pg.locator(SLOT).count() == M and pg.locator(".board-host .pz-bc-cell").count() == N and pg.locator(".board-host .pz-bc-cell.gap").count() == N and pg.locator(".board-host .pz-bc-cell.ok").count() == 0,
              "bàn trống: %d ô quả cân (= m* + 2), dải phủ có %d ô đều 'còn hở', không ô nào 'cân được'" % (M, N))
        check("Đã dùng 0 quả" in pg.inner_text(SUMMARY) and "chưa phủ được khối lượng nào" in pg.inner_text(SUMMARY) and pg.is_disabled(".board-host .pz-bc-submit") and pg.is_disabled(".board-host .pz-bc-clear"),
              "tóm tắt 'Đã dùng 0 quả · chưa phủ được khối lượng nào'; 'Nộp' và 'Xoá hết' bị vô hiệu", pg.inner_text(SUMMARY))
        check(all(pg.get_attribute(slot_in(i), "aria-label").startswith("Quả cân thứ %d" % (i + 1)) for i in range(M)) and pg.get_attribute(".board-host .pz-bc-strip", "role") == "img" and "Đã dùng 0 quả" in pg.get_attribute(".board-host .pz-bc-strip", "aria-label"),
              "mỗi ô nhập có aria-label 'Quả cân thứ i', dải phủ role=img kèm tóm tắt bằng chữ")
        check("tối thiểu" not in pg.inner_text(".board-host").lower() and ("%d quả" % m) not in pg.inner_text(".board-host .pz-bc-stats"), "bàn KHÔNG lộ số quả tối thiểu (chỉ gợi ý / hộp thoại kết thúc)")

        # ---- gõ vào ô, − / +, đối chiếu tập cân được độc lập
        ui_set(pg, 0, 1)
        g = E.game()
        W, sub = vals_of(g)
        cov = covered(W, N, True)
        check(W == [1] and sub == 0 and pg.locator(".board-host .pz-bc-cell.ok").count() == len(cov) and summary_run(pg) == run_len(W, N, True) and g["moves"] == 1,
              "gõ 1 vào ô 1 + Enter: state.v = [1,…], dải phủ 'cân được' %d ô = tập tổng có dấu Python, phủ liền 1…%d" % (len(cov), run_len(W, N, True)), (W, summary_run(pg)))
        pg.click("%s:nth-child(2) .pz-bc-inc" % SLOT)
        pg.click("%s:nth-child(2) .pz-bc-inc" % SLOT)
        pg.click("%s:nth-child(2) .pz-bc-inc" % SLOT)
        g = E.game()
        W, _ = vals_of(g)
        check(W == [1, 3] and pg.locator(".board-host .pz-bc-cell.ok").count() == len(covered([1, 3], N, True)) and summary_run(pg) == run_len([1, 3], N, True), "nút + ×3 ở ô 2 → 3 g; dải phủ khớp {1,3}: phủ liền 1…%d" % run_len([1, 3], N, True))
        for i, cell in enumerate(pg.locator(".board-host .pz-bc-cell").all()[:N]):
            want = "ok" if (i + 1) in sums([1, 3], True) else "gap"
            if want not in cell.get_attribute("class"):
                check(False, "ô %d g của dải phủ phải là '%s'" % (i + 1, want))
                break
        else:
            check(True, "từng ô 1…%d của dải phủ ('cân được' / 'còn hở') = tập tổng có dấu Python" % N)
        check(pg.locator(".board-host .pz-bc-cell.ok .pz-bc-mark").first.inner_text() == "✓" and pg.locator(".board-host .pz-bc-cell.gap .pz-bc-mark").first.inner_text() == "✗", "ô 'cân được' có dấu ✓, ô 'còn hở' có dấu ✗ (không chỉ màu)")
        pg.fill(slot_in(2), str(N + 5))
        pg.keyboard.press("Enter")
        check(E.game()["v"][2] == 0 and "từ 1 đến %d" % N in pg.inner_text(".board-host .pz-bc-note") and pg.input_value(slot_in(2)) == "", "gõ %d (> N): bị từ chối, state không đổi, ô trả về trống, ghi chú nêu 1…%d" % (N + 5, N), pg.inner_text(".board-host .pz-bc-note"))
        pg.fill(slot_in(2), "-4")
        pg.keyboard.press("Enter")
        check(E.game()["v"][2] == 0 and pg.input_value(slot_in(2)) == "", "gõ -4: bị từ chối")
        # nút − về 0: tự vô hiệu mà focus không rơi về BODY
        pg.click("%s:nth-child(1) .pz-bc-dec" % SLOT)
        fo = pg.evaluate(JS_FOCUS)
        check(E.game()["v"][0] == 0 and pg.is_disabled("%s:nth-child(1) .pz-bc-dec" % SLOT) and not fo["inBody"] and "pz-bc-num" in fo["cls"], "nút − về 0 tự vô hiệu: focus chuyển sang ô nhập của chính ô đó, không rơi về BODY", fo)
        pg.click(".toolbar button:has-text('Hoàn tác')")
        check(E.game()["v"][0] == 1, "Hoàn tác trả quả 1 về 1 g")

        # ---- cân thử
        pg.fill(".board-host .pz-bc-tryin", "2")
        t2 = pg.inner_text(".board-host .pz-bc-tryout")
        check("2 g" in t2 and "1 quả" not in t2 and "2 quả" in t2 and arrange_min([1, 3], 2, True) == 2 and "＝" in t2, "cân thử 2 g với {1,3}: 'vật + 1 ＝ 3' dùng 2 quả (Python vét cạn: %d)" % arrange_min([1, 3], 2, True), t2)
        pg.fill(".board-host .pz-bc-tryin", str(N))
        t3 = pg.inner_text(".board-host .pz-bc-tryout")
        check(("chưa cân được" in t3) == (N not in sums([1, 3], True)), "cân thử %d g: %s (Python)" % (N, "chưa cân được" if N not in sums([1, 3], True) else "cân được"), t3)
        pg.fill(".board-host .pz-bc-tryin", "0")
        check("từ 1 đến %d" % N in pg.inner_text(".board-host .pz-bc-tryout"), "cân thử 0 g: nhắc nhập 1…N")
        dup = pg.evaluate(JS_DUP)
        check(dup["ids"][0] != dup["ids"][1] and all(dup["own"]), "hai bàn cùng tồn tại: aria-describedby của ô cân thử không trùng, mỗi mô tả nằm trong đúng bàn", dup)
        pg.fill(".board-host .pz-bc-tryin", "")

        # ---- nước làm mất tối ưu: quả sai rồi nộp sớm (đối chiếu vét cạn Python)
        E.start(tid, "hai", "easy", SEED + 62)
        g = E.game()
        d = g["data"]
        N, M, m = d["N"], d["slots"], d["m"]
        W0 = [N]
        want_bad = not feasible(W0, N, True) if N > 1 else False
        ui_set(pg, 0, N)
        g = E.game()
        hud = {x["title"]: x["val"] for x in pg.evaluate(JS_HUD)}
        lab = "Nước làm mất tối ưu / nộp khi chưa đạt"
        check(lab in hud and hud[lab] == str(1 if want_bad else 0), "đặt quả %d g cho N=%d: chip '%s' = %d (Python: còn mở rộng được = %s)" % (N, N, lab, 1 if want_bad else 0, not want_bad), hud)
        pg.click(".board-host .pz-bc-submit")
        g = E.game()
        hud = {x["title"]: x["val"] for x in pg.evaluate(JS_HUD)}
        check(g["v"][M] == 1 and g["status"] == "playing" and hud[lab] == str((1 if want_bad else 0) + 1) and "chưa phủ hết" in pg.inner_text(".board-host .pz-bc-note") and not pg.is_hidden(".board-host .pz-bc-reopen"),
              "nộp khi chưa phủ: ván tiếp tục, lỗi +1, ghi chú 'chưa phủ hết', nút 'Mở lại để sửa' hiện", (g["status"], hud))
        pg.click(".board-host .pz-bc-reopen")
        check(E.game()["v"][M] == 0 and pg.is_hidden(".board-host .pz-bc-reopen"), "'Mở lại để sửa' đưa cờ nộp về 0")
        pg.click(".board-host .pz-bc-clear")
        check(all(x == 0 for x in E.game()["v"]) and pg.is_disabled(".board-host .pz-bc-clear"), "'Xoá hết' đưa mọi ô về 0 (một nước, hoàn tác được)")

        # ---- giải trọn bằng giao diện theo gợi ý; từng bước bàn = Python
        E.start(tid, "hai", "hard", SEED + 63)
        g = E.game()
        d = g["data"]
        N, M, m = d["N"], d["slots"], d["m"]
        bad = []

        def each(cur):
            W, _ = vals_of(cur)
            if summary_run(pg) != run_len(W, N, True) or pg.locator(".board-host .pz-bc-cell.ok").count() != len(covered(W, N, True)):
                bad.append((W, summary_run(pg)))
        pg.click(".toolbar button:has-text('Gợi ý')")
        pg.wait_for_selector(".hint-panel:not([hidden]) .hint-text")
        pg.click(".hint-panel button:has-text('Chi tiết hơn')")
        pg.click(".hint-panel button:has-text('Chi tiết hơn')")
        hl = pg.evaluate("[...document.querySelectorAll('.board-host .pz-bc-slot')].map((e, i) => [e.classList.contains('hint'), e.querySelector('input').placeholder])")
        h3 = pg.evaluate(JS_HINT)
        check(hl[h3["action"]["i"]][0] and hl[h3["action"]["i"]][1] == "→ %d" % h3["action"]["val"] and sum(1 for x in hl if x[0]) == 1, "gợi ý mức 3: ô %d được tô và hiện '→ %d' làm chữ mờ (chỉ ô đó)" % (h3["action"]["i"] + 1, h3["action"]["val"]), hl)
        pg.keyboard.press("Escape")
        steps, last = ui_apply_hint(pg, E, each)
        g = E.game()
        W, sub = vals_of(g)
        check(steps == m and last and last.get("action") and last["action"]["k"] == "submit" and not bad and len(W) == m and len(covered(W, N, True)) == N,
              "đề khó (N=%d, m*=%d): %d bước gõ ô theo gợi ý, mỗi bước bàn = Python; bộ %s phủ đủ 1…%d (set Python); gợi ý cuối là 'nộp'" % (N, m, steps, W, N), (bad[:2], steps, W))
        check(g["mistakes"] == 0, "không nước nào làm mất tối ưu (0 lỗi)", g["mistakes"])
        pg.click(".board-host .pz-bc-submit")
        pg.wait_for_selector("dialog[open] h2:has-text('Đã giải')", timeout=10000)
        rec = pg.evaluate(JS_LASTREC)
        check(rec and rec["result"] == "solved" and rec["grade"]["stars"] == 3 and rec["grade"]["quality"] == 1 and rec["grade"]["value"] == min_count(N, True) == rec["grade"]["best"] and rec["mistakes"] == 0,
              "nộp: solved 3★, giá trị %d quả = tối thiểu Python, 0 lỗi" % min_count(N, True), rec and rec.get("grade"))
        stats = pg.inner_text("dialog[open] .stat-grid")
        check("★★★" in stats and "quả" in stats and "Tối ưu!" in pg.inner_text("dialog[open]"), "hộp thoại: ★★★, đơn vị 'quả', 'Tối ưu!'", stats.replace("\n", " "))
        hud = pg.evaluate(JS_HUD)
        mv = [x for x in hud if x["title"].startswith("Số thao tác")]
        check(len(mv) == 1 and mv[0]["val"] == str(g["moves"] + 1), "HUD: chip 'Số thao tác' = bộ đếm của vỏ (%d)" % (g["moves"] + 1), hud)
        # ---- replay chỉ-đọc
        pg.click("dialog[open] button:has-text('Xem lời giải từng bước')")
        pg.wait_for_selector(".replay-panel:not([hidden])", timeout=20000)
        check(pg.locator(".board-host .pz-bc-actions").count() == 0 and pg.locator(".board-host .pz-bc-try").count() == 0 and all(pg.locator(".board-host .pz-bc-slot input").nth(i).is_disabled() for i in range(M)), "bàn chỉ-đọc trong replay: ô nhập bị khoá, không nút nộp / cân thử")
        pg.click(".replay-panel button:has-text('Sau')")
        check(pg.locator(".board-host .pz-bc-slot.replay").count() == 1 and "Đặt quả cân" in pg.inner_text(".rp-text"), "replay bước 1: đúng một ô được tô 'replay', lời giải thích 'Đặt quả cân…'", pg.inner_text(".rp-text"))
        pg.click(".replay-panel button[aria-label='Tới cuối']")
        W2, sub2 = vals_of(E.game())
        check(len(W2) == m and sub2 == 1 and len(covered(W2, N, True)) == N, "replay cuối: bộ %d quả phủ đủ, cờ nộp 1" % m)
        pg.keyboard.press("Escape")

        # ---- cỡ một đĩa
        E.start(tid, "mot", "medium", SEED + 64)
        g = E.game()
        d = g["data"]
        N, M, m = d["N"], d["slots"], d["m"]
        check(d["mode"] == "mot" and m == min_count(N, False) and "chỉ một đĩa" in pg.inner_text(".board-host .pz-bc-stats"), "cỡ một đĩa (N=%d): m* = %d = vòng lặp Python; nhãn 'chỉ một đĩa'" % (N, m))
        ui_set(pg, 0, 1)
        ui_set(pg, 1, 2)
        W, _ = vals_of(E.game())
        check(W == [1, 2] and pg.locator(".board-host .pz-bc-cell.ok").count() == len(covered([1, 2], N, False)) and summary_run(pg) == run_len([1, 2], N, False) == 3, "{1,2} một đĩa phủ liền 1…3 (Python: tổng không dấu), dải phủ %d ô" % len(covered([1, 2], N, False)))
        steps, last = ui_apply_hint(pg, E)
        W, _ = vals_of(E.game())
        check(last and last["action"]["k"] == "submit" and len(W) == m and len(covered(W, N, False)) == N, "một đĩa: làm theo gợi ý tới 'nộp': %s phủ đủ 1…%d bằng tổng không dấu" % (W, N), (W, steps))

        # ---- cỡ đặt quả cân
        E.start(tid, "dat", "medium", SEED + 65)
        g = E.game()
        d = g["data"]
        Wt, X = d["W"], d["X"]
        mins = [dat_min(Wt, x) for x in X]
        check(d["mode"] == "dat" and d["mins"] == mins and d["best"] == sum(mins), "cỡ đặt quả cân: tối thiểu từng vật %s = đệ quy dấu Python; tổng %d" % (mins, sum(mins)), (d["mins"], mins))
        check(pg.locator(".board-host .pz-bc-wt").count() == len(Wt) * len(X) and pg.locator(".board-host .pz-bc-item").count() == len(X), "%d thẻ vật, mỗi thẻ %d nút quả cân" % (len(X), len(Wt)))
        btn0 = '.board-host .pz-bc-wt[data-item="0"][data-k="%d"]' % (len(Wt) - 1)
        pg.click(btn0)
        txt1 = pg.inner_text(btn0)
        row0 = E.game()["v"][len(Wt) - 1]
        pans = pg.inner_text(".board-host .pz-bc-item >> nth=0")
        check(row0 == 1 and "đĩa phải" in txt1 and "Đĩa phải" in pans and str(Wt[-1]) in pg.inner_text(".board-host .pz-bc-item:nth-child(1) .pz-bc-pan.right"), "chạm quả %d g lần 1 → đĩa phải ▶ (state 1), đĩa phải liệt kê quả đó" % Wt[-1], (txt1, row0))
        pg.click(btn0)
        check(E.game()["v"][len(Wt) - 1] == 2 and "cùng vật" in pg.inner_text(btn0) and str(Wt[-1]) in pg.inner_text(".board-host .pz-bc-item:nth-child(1) .pz-bc-pan.left"), "chạm lần 2 → cùng vật ◀ (state 2), đĩa trái liệt kê quả đó")
        pg.click(btn0)
        check(E.game()["v"][len(Wt) - 1] == 0 and "để ngoài" in pg.inner_text(btn0), "chạm lần 3 → để ngoài (state 0)")
        bad = []

        def each_dat(cur):
            v = cur["v"]
            q = len(Wt)
            for j, x in enumerate(X):
                row = v[j * q:(j + 1) * q]
                s = sum(Wt[k] if row[k] == 1 else -Wt[k] if row[k] == 2 else 0 for k in range(q))
                shown = pg.inner_text('.board-host .pz-bc-item:nth-child(%d) .pz-bc-res' % (j + 1))
                if ("Thăng bằng" in shown) != (s == x):
                    bad.append((j, row, shown))
        steps, last = ui_apply_hint(pg, E, each_dat)
        g = E.game()
        q = len(Wt)
        rows = [g["v"][j * q:(j + 1) * q] for j in range(len(X))]
        ok_rows = all(sum(Wt[k] if r[k] == 1 else -Wt[k] if r[k] == 2 else 0 for k in range(q)) == x for r, x in zip(rows, X))
        used = sum(1 for r in rows for c in r if c)
        check(last and last["action"]["k"] == "submit" and ok_rows and used == sum(mins) and not bad, "đặt quả cân: %d bước bấm nút quả cân theo gợi ý; mọi vật thăng bằng (tổng ± Python) với %d quả = tối thiểu độc lập; kết quả trên bàn khớp từng bước" % (steps, used), (bad[:2], used, sum(mins)))
        check(all("Thăng bằng" in pg.inner_text(".board-host .pz-bc-item:nth-child(%d) .pz-bc-res" % (j + 1)) for j in range(len(X))) and "＝" in pg.inner_text(".board-host .pz-bc-mid >> nth=0"), "mỗi thẻ ghi '＝ Thăng bằng' và dấu ＝ giữa hai đĩa")
        pg.click(".board-host .pz-bc-submit")
        pg.wait_for_selector("dialog[open] h2:has-text('Đã giải')", timeout=10000)
        rec = pg.evaluate(JS_LASTREC)
        check(rec and rec["grade"]["stars"] == 3 and rec["grade"]["value"] == sum(mins) == rec["grade"]["best"] and rec["mistakes"] == 0, "nộp bài đặt quả cân: 3★, value = tối thiểu %d, 0 lỗi" % sum(mins), rec and rec.get("grade"))
        pg.keyboard.press("Escape")
        pg.wait_for_selector("dialog[open]", state="detached", timeout=5000)

        # ---- trình soạn
        pg.evaluate("location.hash = '#/create/bachet'")
        pg.wait_for_selector(".pz-bc-ed", timeout=15000)
        pg.wait_for_function("document.querySelector('.cr-status .cr-chip')", timeout=20000)
        txt = pg.inner_text(".cr-status").replace(" ", " ")
        check("Tối thiểu 4 quả" in txt and "duy nhất" in txt and "1, 3, 9, 27" in txt, "trình soạn mặc định N=40 hai đĩa: vỏ báo 'Tối thiểu 4 quả … bộ tối ưu duy nhất {1, 3, 9, 27}'", txt)
        pg.fill(".pz-bc-ed input[aria-label^='Khối lượng lớn nhất']", "30")
        pg.wait_for_function("/nhiều bộ/.test(document.querySelector('.cr-status').innerText)", timeout=20000)
        check("Tối thiểu 4 quả" in pg.inner_text(".pz-bc-edinfo") and "nhiều bộ" in pg.inner_text(".pz-bc-edinfo"), "N = 30: dòng kết quả ngay trong trình soạn nêu 'nhiều bộ tối ưu' (Python: m*=%d)" % min_count(30, True))
        pg.fill(".pz-bc-ed input[aria-label^='Khối lượng lớn nhất']", "0")
        pg.wait_for_function("document.querySelector('.cr-status .cr-chip.bad') || /từ 1 đến/.test(document.querySelector('.cr-status').innerText)", timeout=20000)
        check(pg.is_disabled("button:has-text('Chơi thử')"), "N = 0: vỏ báo lỗi, 'Chơi thử' bị khoá", pg.inner_text(".cr-status"))
        pg.click(".pz-bc-ed button:has-text('Luỹ thừa 2')")
        pg.wait_for_function("/Tối thiểu 4 quả/.test(document.querySelector('.cr-status').innerText)", timeout=20000)
        check(pg.input_value(".pz-bc-ed input[aria-label^='Khối lượng lớn nhất']") == "15" and "chọn bộ — một đĩa".lower() in pg.inner_text(".pz-bc-ed .chip.on").lower(), "mẫu 'Luỹ thừa 2 (N = 15)': chuyển sang một đĩa, N = 15; m* = %d (Python)" % min_count(15, False))
        pg.click(".pz-bc-ed .chip:has-text('Đặt quả cân')")
        check(pg.locator(".pz-bc-ed input[aria-label^='Bộ quả cân']").count() == 1 and pg.locator(".pz-bc-ed input[aria-label^='Các vật']").count() == 1, "chọn 'Đặt quả cân': hiện ô nhập bộ W và các vật X")
        pg.fill(".pz-bc-ed input[aria-label^='Bộ quả cân']", "2, 4")
        pg.fill(".pz-bc-ed input[aria-label^='Các vật']", "3")
        pg.wait_for_function("/không thể cân bằng/.test(document.querySelector('.cr-status').innerText)", timeout=20000)
        check(dat_min([2, 4], 3) == 99 and pg.is_disabled("button:has-text('Chơi thử')"), "W={2,4}, vật 3 g: không cân được (Python), vỏ báo lỗi, 'Chơi thử' khoá", pg.inner_text(".cr-status"))
        pg.fill(".pz-bc-ed input[aria-label^='Bộ quả cân']", "1, 3, 9, 27")
        pg.fill(".pz-bc-ed input[aria-label^='Các vật']", "25, 14")
        pg.wait_for_function("/Tối thiểu \\d+ quả cho 2 vật/.test(document.querySelector('.cr-status').innerText)", timeout=20000)
        want = dat_min([1, 3, 9, 27], 25) + dat_min([1, 3, 9, 27], 14)
        check(("Tối thiểu %d quả cho 2 vật" % want) in pg.inner_text(".cr-status"), "W={1,3,9,27}, vật 25 và 14 g: vỏ báo tối thiểu %d quả (Python đệ quy dấu)" % want, pg.inner_text(".cr-status"))
        pg.click("button:has-text('Chơi thử')")
        pg.wait_for_selector(".board-host .pz-bc-wt", timeout=30000)
        g = E.game()
        ttl = pg.inner_text(".play-title h1")
        check(g["data"]["mode"] == "dat" and g["data"]["W"] == [1, 3, 9, 27] and g["data"]["X"] == [25, 14] and "4 quả cân · 2 vật" in ttl.replace(" ", " "), "Chơi thử từ trình soạn: đề đặt quả cân đúng W, X; tiêu đề tự giải thích cỡ", (g["data"], ttl))
        pg.evaluate("location.hash = '#/create/bachet'")
        pg.wait_for_selector(".pz-bc-ed", timeout=15000)
        pg.focus(".pz-bc-ed .chip:has-text('Đặt quả cân')")
        pg.keyboard.press("Enter")
        fo = pg.evaluate(JS_FOCUS)
        check(not fo["inBody"] and fo["txt"].startswith("Đặt quả cân"), "trình soạn: Enter trên chip 'Đặt quả cân' (vẽ lại) — focus ở lại đúng chip", fo)
    finally:
        E.close()
        br.close()


# ---------------------------------------------------------------------------------------------- chạy trên trình duyệt của check.py
def run(P, check, section, tid):
    pg = P.pg
    br = pg.context.browser

    # ======================================================================= tương phản, co giãn
    section("  — tương phản (sáng + tối), co giãn 280 px với dải phủ N lớn nhất và bàn đặt 6 quả")
    P.start(tid, "hai", "expert", SEED + 40)
    low = []
    for theme in ("light", "dark"):
        pg.evaluate("t => { document.documentElement.dataset.theme = t }", theme)
        for fg, bg, lab, need in (("--pz-bc-ok-ink", "--pz-bc-ok", "chữ ô 'cân được'", 4.5), ("--pz-bc-gap-ink", "--elev", "chữ ô 'còn hở'", 4.5), ("--pz-bc-pos1", "--elev", "nhãn đĩa phải", 4.5), ("--pz-bc-pos2", "--elev", "nhãn cùng vật", 4.5),
                                  ("--text", "--elev", "chữ trên nền thẻ", 4.5), ("--pz-bc-gap-line", "--elev", "viền ô hở", 3), ("--pz-bc-ok-ink", "--elev", "viền ô 'cân được'", 3)):
            r = contrast(pg, fg, bg)
            if r < need:
                low.append("%s %s = %.2f" % (theme, lab, r))
    pg.evaluate("t => { document.documentElement.dataset.theme = t }", "light")
    check(not low, "tương phản --pz-bc-* ≥ 4,5:1 (chữ) / ≥ 3:1 (viền) ở giao diện sáng và tối", low)

    ctx = br.new_context(viewport={"width": 280, "height": 740}, service_workers="block", reduced_motion="reduce")
    p2 = ctx.new_page()
    errs = []
    p2.on("pageerror", lambda e: errs.append(str(e)))
    p2.goto(P.url, wait_until="load")
    p2.wait_for_function("document.body.classList.contains('ready')", timeout=30000)
    for sz, tier, sd in (("hai", "expert", SEED + 70), ("mot", "expert", SEED + 71), ("dat", "expert", SEED + 72)):
        p2.evaluate("location.hash = '#/new/bachet?size=%s&tier=%s&seed=%d&go=1'" % (sz, tier, sd))
        p2.wait_for_selector(".board-host .pz-bc", timeout=30000)
        p2.wait_for_timeout(300)
        p2.evaluate("""() => { const c = Puz.ui.app.ctx(), id = decodeURIComponent(/#\\/play\\/([^?]+)/.exec(location.hash)[1]), g = c.getGame(id); let n = 0;
          while (g.status === 'playing' && n < 60) { const h = g.hint(3); if (!h || h.none || !h.action || (h.action.k !== 'set' && h.action.k !== 'place')) break; g.applyHint(h); n++; } }""")
        p2.wait_for_timeout(250)
        m = p2.evaluate("""() => { const W = innerWidth, bad = [];
          for (const el of document.querySelectorAll('.board-host *')) { const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) bad.push((typeof el.className === 'string' ? el.className : el.tagName) + ':' + Math.round(r.left) + '-' + Math.round(r.right)); }
          const tiny = [...document.querySelectorAll('.board-host button, .board-host input')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.height < 43.5); }).map(e => (e.className || e.tagName) + ':' + Math.round(e.getBoundingClientRect().height));
          return { bad: bad.slice(0, 5), tiny: tiny.slice(0, 5), sw: document.documentElement.scrollWidth, iw: innerWidth, slots: document.querySelectorAll('.board-host .pz-bc-slot').length, cells: document.querySelectorAll('.board-host .pz-bc-cell').length, wts: document.querySelectorAll('.board-host .pz-bc-wt').length }; }""")
        check(not m["bad"] and m["sw"] <= m["iw"] + 1 and not m["tiny"], "280 px, cỡ %s chuyên gia (%d ô, %d ô dải phủ, %d nút quả cân): không phần tử nào ra ngoài khung, trang không tràn ngang, mọi nút/ô nhập cao ≥ 44 px" % (sz, m["slots"], m["cells"], m["wts"]), m)
    p2.evaluate("location.hash = '#/create/bachet'")
    p2.wait_for_selector(".pz-bc-ed", timeout=15000)
    p2.wait_for_timeout(400)
    ov = p2.evaluate("[document.documentElement.scrollWidth, innerWidth]")
    check(ov[0] <= ov[1] + 1, "280 px: trình soạn không tràn ngang", ov)
    p2.click(".pz-bc-ed .chip:has-text('Đặt quả cân')")
    p2.wait_for_timeout(200)
    ov = p2.evaluate("[document.documentElement.scrollWidth, innerWidth]")
    check(ov[0] <= ov[1] + 1, "280 px: trình soạn cỡ đặt quả cân không tràn ngang", ov)
    check(not errs, "không lỗi JS ở ngữ cảnh 280 px", errs)
    ctx.close()

    # ======================================================================= WebKit iPhone 13 (chạm thật)
    section("  — WebKit iPhone 13: chạm nút + của ô quả cân, chạm Nộp")
    box = {}
    th = threading.Thread(target=lambda: box.update(webkit_touch(P.url)))
    th.start()
    th.join(180)
    if box.get("err") and ("Executable doesn't exist" in box["err"] or "browserType.launch" in box["err"]):
        print("  (bỏ qua WebKit: %s)" % box["err"].splitlines()[0][:100])
    else:
        d = box.get("data") or {}
        N, M = d.get("N", 0), d.get("slots", 0)
        v = box.get("v") or []
        check(box.get("ok") and v[:2] == [3, 1] and v[M] == 0 and ("phủ liền 1…%d" % run_len([3, 1], N, True)) in (box.get("summary") or "") and box.get("after_submit") == 1
              and box["overflow"][0] <= box["overflow"][1] + 1 and not box.get("errs"),
              "iPhone 13 (WebKit): chạm + ×3 ở ô 1 → 3 g, + ở ô 2 → 1 g; chạm 'Nộp' → cờ nộp 1; không tràn ngang, không lỗi JS", box)

    edge_p6a(P, check, section, tid)
