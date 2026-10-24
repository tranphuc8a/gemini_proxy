# -*- coding: utf-8 -*-
"""Kiểm riêng của bàn ĐI BỘ & XE MÁY (assets/js/ui/boards/motorbike.js + assets/css/board-motorbike.css) bằng trình duyệt thật.

check.py nạp tệp này và gọi run(P, check, section, tid) sau vòng đời chung của mọi loại (xem tang_2). P là Page của check.py (P.pg = Playwright page).
Phần chạy trên Edge thật (channel="msedge", lùi về Chromium + in rõ nếu máy không có Edge) nằm ở edge_p5(): giải trọn ván bằng giao diện (chọn xe, Lấy xe, Chở tới bằng thanh trượt, Quay lại đón, Thả, Bỏ xe, xác nhận nộp),
xem trước lỗi, biểu đồ không–thời gian, quay về từ dòng kế hoạch, gợi ý tô biểu đồ + kế hoạch, replay chỉ-đọc, cách hiểu B (xe ôm), đề không chia hết trong trình soạn.

Nguồn sự thật ĐỘC LẬP: bộ mô phỏng hướng sự kiện viết lại bằng Python `fractions.Fraction` (không gọi engine), giá trị tối ưu = công thức đóng tính lại bằng Fraction (đưa-đón / tiếp sức / xe ôm / chở thẳng),
bản ghi kế hoạch đọc thẳng từ state.v theo bố cục Puz.plan (v = [nộp, số lệnh, (xe, lệnh, a, b)…])."""

from __future__ import annotations

import re
import threading
from fractions import Fraction as Fr

SEED = 20261017
OPN = {1: "take", 2: "ride", 3: "meet", 4: "off"}


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


def t_shuttle(g, m):
    return (m * (2 * g - 1) + 1) / (m * (m + 2 * g - 1))


def best_of(d):
    """Tối ưu (Fraction) viết lại bằng Python. d = puzzle.data."""
    n, k, m = d["n"], d["k"], Fr(d["mu"], d["mv"])
    if d["interp"] == "B":
        return 1 / m if n <= k else t_shuttle(Fr(n, k), m)
    if n <= 2 * k:
        return 1 / m
    if m >= 3:
        return t_shuttle(Fr(n, k) - 1, m)
    return 1 - Fr(2 * k, n) * (1 - 1 / m)


def recs_of(g):
    v = g["v"]
    return [tuple(v[2 + 4 * i: 6 + 4 * i]) for i in range(v[1])]


def simulate(d, recs):
    """Mô phỏng hướng sự kiện bằng Fraction. → dict(ok, T, arr, msg). Luật như mô tả trong rules của loại."""
    n, k, G, m = d["n"], d["k"], d["G"], Fr(d["mu"], d["mv"])
    A = d["interp"] != "B"
    ps = [{"md": "w", "x0": Fr(0), "t0": Fr(0), "dn": None} for _ in range(n)]
    bs = [{"x": Fr(0), "t": Fr(0), "rd": [] if A else [-1], "q": [], "qi": 0} for _ in range(k)]
    for r in recs:
        if not 1 <= r[0] <= k:
            return {"ok": False, "msg": "xe"}
        bs[r[0] - 1]["q"].append(r)

    def real(b):
        return [z for z in b["rd"] if z >= 0]

    def at(p, t):
        return ps[p]["x0"] + (t - ps[p]["t0"])

    phase = 1
    for _ in range(5000):
        cand = [i for i in range(k) if (bs[i]["qi"] < len(bs[i]["q"]) if phase == 1 else bool(real(bs[i])))]
        if not cand:
            if phase == 1:
                phase = 2
                continue
            break
        bi = min(cand, key=lambda i: (bs[i]["t"], i))
        b = bs[bi]
        if b["qi"] < len(b["q"]):
            r = b["q"][b["qi"]]
            b["qi"] += 1
        else:
            r = (bi + 1, 2, G, 0)
        op = r[1]
        if op == 1:
            who = [r[2] - 1] + ([r[3] - 1] if r[3] else [])
            if (A and b["rd"]) or (not A and (real(b) or r[3])):
                return {"ok": False, "msg": "take"}
            tb = b["t"]
            for p in who:
                if not 0 <= p < n or ps[p]["md"] != "w" or at(p, b["t"]) > b["x"]:
                    return {"ok": False, "msg": "take-p"}
                tb = max(tb, b["t"] + (b["x"] - at(p, b["t"])))
            for p in who:
                ps[p]["md"] = "b"
            b["rd"] = ([] if A else [-1]) + who
            b["t"] = tb
        elif op == 2:
            if not b["rd"]:
                return {"ok": False, "msg": "ride"}
            x = Fr(r[2], G)
            if x == b["x"]:
                return {"ok": False, "msg": "ride0"}
            b["t"] += abs(x - b["x"]) / m
            b["x"] = x
            if x == 1:
                for z in real(b):
                    ps[z]["md"], ps[z]["dn"] = "d", b["t"]
                b["rd"] = [] if A else [-1]
        elif op == 3:
            p = r[2] - 1
            if not b["rd"] or len(b["rd"]) >= 2 or not 0 <= p < n or ps[p]["md"] != "w":
                return {"ok": False, "msg": "meet"}
            xq = at(p, b["t"])
            if xq >= 1:
                return {"ok": False, "msg": "meet-B"}
            tm = b["t"] + ((xq - b["x"]) / (m - 1) if xq >= b["x"] else (b["x"] - xq) / (m + 1))
            xm = at(p, tm)
            if xm > 1:
                return {"ok": False, "msg": "meet-late"}
            b["t"], b["x"] = tm, xm
            ps[p]["md"] = "b"
            b["rd"].append(p)
        elif op == 4:
            p = r[2] - 1
            if not 0 <= p < n or p not in b["rd"]:
                return {"ok": False, "msg": "off"}
            b["rd"].remove(p)
            ps[p].update({"md": "w", "x0": b["x"], "t0": b["t"]})
            if b["x"] >= 1:
                ps[p].update({"md": "d", "dn": b["t"]})
        else:
            return {"ok": False, "msg": "op"}
    arr = []
    for p in ps:
        arr.append(p["dn"] if p["md"] == "d" else p["t0"] + 1 - p["x0"])
    return {"ok": True, "T": max(arr), "arr": arr}


def frac_text(f):
    return "%d/%d" % (f.numerator, f.denominator) if f.denominator != 1 else str(f.numerator)


JS_HINT = """() => {
  const id = decodeURIComponent(/#\\/play\\/([^?]+)/.exec(location.hash)[1]), g = Puz.ui.app.ctx().getGame(id), T = g.type;
  return T.hint(g.puzzle, g.state, 3, g.settings());
}"""
JS_FOCUS = """() => { const a = document.activeElement; return { tag: a.tagName, cls: a.className, txt: (a.textContent || '').trim(), label: a.getAttribute('aria-label'), inBody: a === document.body }; }"""
JS_LASTREC = "() => { const r = Puz.ui.app.ctx().user.history().filter(x => x.type === 'motorbike'); return r.length ? r[r.length - 1] : null; }"
JS_DUP = """() => {
  const c = Puz.ui.app.ctx(), id = decodeURIComponent(/#\\/play\\/([^?]+)/.exec(location.hash)[1]), g = c.getGame(id), hosts = [], views = [];
  for (let k = 0; k < 2; k++) { const h = document.createElement('div'); document.body.append(h); hosts.push(h); views.push(Puz.boards.motorbike.mount(h, { game: g, puzzle: g.puzzle, type: g.type, U: Puz.ui, readOnly: false, announce() {} })); }
  const ids = hosts.map(h => (h.querySelector('.pz-mb-take, .pz-mb-ride') || {}).getAttribute ? h.querySelector('.pz-mb-take, .pz-mb-ride').getAttribute('aria-describedby') : null), own = hosts.map((h, i) => { const e = document.getElementById(ids[i]); return !!e && h.contains(e); });
  const ro = document.createElement('div'); document.body.append(ro); const rv = Puz.boards.motorbike.mount(ro, { game: g, puzzle: g.puzzle, type: g.type, U: Puz.ui, readOnly: true, announce() {} });
  const roInfo = { controls: ro.querySelectorAll('.pz-mb-controls').length, svg: ro.querySelectorAll('.pz-mb-svg').length, btns: ro.querySelectorAll('.pz-mb-actions').length };
  rv.destroy(); ro.remove(); views.forEach(v => v.destroy()); hosts.forEach(h => h.remove());
  return { ids: ids, own: own, ro: roInfo };
}"""
TAKE_DRV = ".board-host select[aria-label='Người lái'], .board-host select[aria-label='Khách lên xe']"
TAKE_REAR = ".board-host select[aria-label^='Người ngồi sau']"
RANGE = ".board-host .pz-mb-range"


def status_T(pg):
    """Giá trị T (Fraction) đọc từ dòng trạng thái của bàn: '… sau 31 phút 12 giây (13/25 giờ).'"""
    t = pg.inner_text(".board-host .pz-mb-status")
    m = re.search(r"\((\d+)(?:/(\d+))? giờ\)", t)
    return Fr(int(m.group(1)), int(m.group(2) or 1)) if m else None


def ui_cmd(pg, rec):
    """Thực hiện MỘT lệnh bằng giao diện (chọn xe, ô chọn người, thanh trượt, nút) — đúng như người chơi."""
    bike, op, a, b = rec
    pg.click(".board-host .pz-mb-bikechip[data-bike='%d']" % (bike - 1))
    if op == 1:
        pg.select_option(TAKE_DRV, str(a))
        if pg.locator(TAKE_REAR).count():
            pg.select_option(TAKE_REAR, str(b))
        pg.click(".board-host .pz-mb-take")
    elif op == 2:
        pg.evaluate("v => { const r = document.querySelector('.board-host .pz-mb-range'); r.value = String(v); r.dispatchEvent(new Event('input', { bubbles: true })); }", a)
        pg.click(".board-host .pz-mb-ride")
    elif op == 3:
        pg.select_option(".board-host select[aria-label='Người muốn đón']", str(a))
        pg.click(".board-host .pz-mb-meet")
    else:
        pg.click(".board-host .pz-mb-off[data-who='%d']" % a)
    pg.wait_for_timeout(30)


def ui_apply_hint(pg, E, check_each=None):
    """Lặp: lấy gợi ý mức 3 của engine (không tính vào bộ đếm), làm lại từng lệnh BẰNG GIAO DIỆN. Dừng khi gợi ý là 'nộp'. → (số lệnh, gợi ý cuối)."""
    cnt = 0
    for _ in range(80):
        h = pg.evaluate(JS_HINT)
        a = h.get("action")
        if h.get("none") or not a or a["k"] != "cmd":
            return cnt, h
        ui_cmd(pg, (a["bike"], {"take": 1, "ride": 2, "meet": 3, "off": 4}[a["op"]], a["a"], a.get("b") or 0))
        cnt += 1
        if check_each:
            check_each(E.game())
    return cnt, None


def contrast(pg, fg, bg):
    c = pg.evaluate("""([a, b]) => { const f = document.createElement('i'), k = document.createElement('i'); f.style.color = 'var(' + a + ')'; k.style.color = 'var(' + b + ')'; document.body.append(f, k); const o = [getComputedStyle(f).color, getComputedStyle(k).color]; f.remove(); k.remove(); return o; }""", [fg, bg])
    return ratio(rgb(c[0]), rgb(c[1]))


def open_new(pg, opts, size="std", tier="easy", seed=SEED):
    pg.evaluate("h => { location.hash = h }", "#/new/motorbike?size=%s&tier=%s&seed=%d%s&go=1" % (size, tier, seed, ("&o=" + opts) if opts else ""))
    pg.wait_for_selector(".board-host .pz-mb-svg", timeout=30000)
    pg.wait_for_timeout(250)


def webkit_touch(url):
    """Luồng riêng (Playwright đồng bộ không lồng được): WebKit + iPhone 13, CHẠM thật: chạm nút Lấy xe, Chở tới (thanh trượt gán bằng mã), Thả, Nộp."""
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
            pg.evaluate("location.hash = '#/new/motorbike?size=std&tier=easy&seed=%d&go=1'" % (SEED + 91))
            pg.wait_for_selector(".board-host .pz-mb-svg", timeout=30000)
            pg.wait_for_timeout(300)
            out["data"] = pg.evaluate("Puz.ui.app.ctx().getGame(decodeURIComponent(/#\\/play\\/([^?]+)/.exec(location.hash)[1])).puzzle.data")
            pg.tap(".board-host .pz-mb-take")
            pg.wait_for_timeout(100)
            out["after_take"] = pg.locator(".board-host .pz-mb-step").count()
            pg.tap(".board-host .pz-mb-toB")
            pg.wait_for_timeout(100)
            out["after_ride"] = pg.locator(".board-host .pz-mb-step").count()
            out["svg_w"] = pg.evaluate("[document.querySelector('.board-host .pz-mb-svg').viewBox.baseVal.width, document.querySelector('.board-host .pz-mb-diag').clientWidth]")
            out["overflow"] = pg.evaluate("[document.documentElement.scrollWidth, innerWidth]")
            out["errs"] = errs
            out["ok"] = True
            br.close()
    except Exception as e:  # noqa: BLE001
        out["err"] = "%s: %s" % (type(e).__name__, e)
    return out


# ---------------------------------------------------------------------------------------------- Edge: giải trọn bằng giao diện, lỗi, replay, xe ôm, trình soạn
def edge_p5(P, check, section, tid):
    PageCls = type(P)
    bt = P.pg.context.browser.browser_type
    try:
        br, kenh = bt.launch(channel="msedge"), "Edge"
    except Exception as e:  # noqa: BLE001
        br, kenh = bt.launch(), "Chromium (không mở được Edge: %s)" % str(e).splitlines()[0][:80]
    section("  — đợt P5 trên %s: giải trọn bằng giao diện, biểu đồ không–thời gian, xem trước lỗi, quay về, gợi ý, xe ôm, trình soạn" % kenh)
    E = PageCls(br, P.url, "mb-p5", viewport={"width": 1280, "height": 1000})
    pg = E.pg
    try:
        # ---- vẽ đúng theo state
        open_new(pg, "", "std", "easy", SEED + 51)
        g = E.game()
        d = g["data"]
        check(d["interp"] == "A" and d["exact"] and Fr(d["best"]) == best_of(d) and d["G"] >= 24, "đề dễ (%d người, %d xe, m = %d/%d): tối ưu của engine %s = công thức viết lại bằng Fraction" % (d["n"], d["k"], d["mu"], d["mv"], d["best"]), (d["best"], str(best_of(d))))
        stats = pg.inner_text(".board-host .pz-mb-stats").replace("\n", " ")
        check(("%d người" % d["n"]) in stats and ("xe nhanh gấp %s" % (str(d["mu"]) if d["mv"] == 1 else "%d/%d" % (d["mu"], d["mv"]))) in stats.lower() and "60 phút" in stats, "dải đề bài nêu số người, số xe, xe nhanh gấp m, đi bộ cả quãng 60 phút", stats)
        svg = pg.locator(".board-host .pz-mb-svg")
        check(svg.get_attribute("role") == "img" and "Biểu đồ không–thời gian" in svg.get_attribute("aria-label") and "60 phút" in pg.inner_text(".board-host .pz-mb-status"), "biểu đồ SVG: role=img + aria-label tóm tắt; dòng trạng thái nêu T (kế hoạch rỗng = 60 phút)")
        check(status_T(pg) == 1 and pg.locator(".board-host .pz-mb-walk").count() == d["n"] and pg.locator(".board-host .pz-mb-bike").count() == 0, "kế hoạch rỗng: mọi người đi bộ (%d nét mảnh), chưa có nét xe, T = 1 giờ" % d["n"])
        check(pg.locator(".board-host .pz-mb-plan .pz-mb-empty").count() == 1 and pg.is_disabled(".board-host .pz-mb-submit") and pg.is_disabled(".board-host .pz-mb-clear") and pg.is_disabled(".board-host .pz-mb-popbtn"), "kế hoạch rỗng: dòng hướng dẫn; 'Nộp', 'Xoá kế hoạch', 'Xoá lệnh cuối' bị vô hiệu")
        check(pg.locator(".board-host .pz-mb-bikechip").count() == d["k"] and pg.get_attribute(".board-host .pz-mb-bikechip.on", "aria-checked") == "true" and pg.locator(".board-host .pz-mb-take").count() == 1 and pg.locator(RANGE).count() == 0 and pg.locator(".board-host .pz-mb-meet").count() == 0,
              "xe trống: chỉ có lệnh 'Lấy xe' (chưa có thanh trượt/đón/thả — chưa ai ngồi trên xe)")

        # ---- xem trước lỗi: người lái = người ngồi sau
        pg.select_option(TAKE_DRV, "1")
        pg.select_option(TAKE_REAR, "1")
        note = pg.inner_text(".board-host .pz-mb-note >> nth=0")
        check(pg.is_disabled(".board-host .pz-mb-take") and "không hợp lệ" in note, "lái và ngồi sau cùng một người: 'Lấy xe' bị vô hiệu, ghi chú nêu lý do (do engine)", note)
        pg.select_option(TAKE_REAR, "2")
        check(not pg.is_disabled(".board-host .pz-mb-take") and "Sau lệnh" in pg.inner_text(".board-host .pz-mb-note >> nth=0") and "P1 lái, P2 ngồi sau" in pg.inner_text(".board-host .pz-mb-note >> nth=0"), "P1 lái + P2 ngồi sau: nút mở, ghi chú xem trước nêu sự kiện", pg.inner_text(".board-host .pz-mb-note >> nth=0"))
        check(pg.get_attribute(".board-host .pz-mb-take", "aria-describedby") == pg.get_attribute(".board-host .pz-mb-note >> nth=0", "id"), "nút 'Lấy xe' trỏ aria-describedby vào ghi chú xem trước của chính nó")
        pg.click(".board-host .pz-mb-take")
        g = E.game()
        rc = recs_of(g)
        check(rc == [(1, 1, 1, 2)] and g["status"] == "playing", "Lấy xe bằng giao diện: bản ghi [xe 1, lấy, P1, P2] (đọc thẳng state.v)", rc)
        info = pg.inner_text(".board-host .pz-mb-binfo")
        check("trên xe: P1 (lái), P2" in info and pg.locator(RANGE).count() == 1 and pg.locator(".board-host .pz-mb-off").count() == 2 and pg.locator(".board-host .pz-mb-aband").count() == 1 and pg.locator(".board-host .pz-mb-meet").count() == 0,
              "sau khi lấy xe: dòng thông tin nêu 'P1 (lái), P2'; có thanh trượt, 2 nút Thả, 'Bỏ xe'; chưa có 'Quay lại đón' (xe đã đủ 2 người)", info)
        sim = simulate(d, rc)
        check(sim["ok"] and status_T(pg) == sim["T"], "T hiển thị = mô phỏng Fraction độc lập (%s giờ)" % frac_text(sim["T"]))

        # ---- thanh trượt: phím, nhãn, xem trước
        pg.focus(RANGE)
        v0 = int(pg.input_value(RANGE))
        pg.keyboard.press("ArrowRight")
        check(int(pg.input_value(RANGE)) == min(d["G"], v0 + 1) and "quãng" in pg.inner_text(".board-host .pz-mb-rval") and pg.get_attribute(RANGE, "aria-label").startswith("Vị trí muốn chở tới"), "thanh trượt: phím → đổi 1 vạch, nhãn 'x/y quãng (… %)', có aria-label", pg.inner_text(".board-host .pz-mb-rval"))
        solv = pg.evaluate("() => { const g = Puz.ui.app.ctx().getGame(decodeURIComponent(/#\\/play\\/([^?]+)/.exec(location.hash)[1])); return g.puzzle.solution.v.slice(); }")
        sol = [tuple(solv[2 + 4 * i: 6 + 4 * i]) for i in range(solv[1])]
        first_ride = [r for r in sol if r[1] == 2][0]
        pg.evaluate("v => { const r = document.querySelector('.board-host .pz-mb-range'); r.value = String(v); r.dispatchEvent(new Event('input', { bubbles: true })); }", first_ride[2])
        txt = pg.inner_text("#" + pg.get_attribute(".board-host .pz-mb-ride", "aria-describedby"))
        check("Xe 1 tới" in txt and "Nếu dừng ở đây" in txt, "xem trước 'Chở tới': nêu thời điểm xe tới và T nếu dừng ở đây", txt)
        pg.click(".board-host .pz-mb-ride")
        g = E.game()
        rc = recs_of(g)
        sim = simulate(d, rc)
        check(rc[-1] == (1, 2, first_ride[2], 0) and sim["ok"] and status_T(pg) == sim["T"] and pg.locator(".board-host .pz-mb-bike").count() == 2, "Chở tới theo vạch %d/%d: bản ghi đúng, biểu đồ có 2 nét xe (đoạn đã chở + đoạn xe tự chạy nốt tới B), T khớp Fraction độc lập (%s)" % (first_ride[2], d["G"], frac_text(sim["T"])))

        # ---- quay về từ dòng kế hoạch / xoá lệnh cuối: focus không rơi về BODY
        check(pg.locator(".board-host .pz-mb-step").count() == 2 and pg.locator(".board-host .pz-mb-cut").count() == 1, "kế hoạch có 2 dòng; dòng cuối không có nút 'Giữ tới đây'")
        pg.focus(".board-host .pz-mb-cut >> nth=0")
        pg.keyboard.press("Enter")
        g = E.game()
        fo = pg.evaluate(JS_FOCUS)
        check(g["v"][1] == 1 and not fo["inBody"], "'Giữ tới đây' ở dòng 1: còn 1 lệnh; nút tự biến mất nhưng focus không rơi về BODY", (g["v"][1], fo))
        pg.click(".board-host .pz-mb-popbtn")
        check(E.game()["v"][1] == 0 and pg.is_disabled(".board-host .pz-mb-popbtn"), "'Xoá lệnh cuối' đưa về kế hoạch rỗng (nút tự vô hiệu)")

        # ---- gợi ý tô biểu đồ + kế hoạch (ghost), vạch gợi ý
        E.start(tid, "std", "easy", SEED + 51)
        pg.click(".toolbar button:has-text('Gợi ý')")
        pg.wait_for_selector(".hint-panel:not([hidden]) .hint-text")
        pg.click(".hint-panel button:has-text('Chi tiết hơn')")
        pg.click(".hint-panel button:has-text('Chi tiết hơn')")
        check("Gợi ý sẽ thêm" in pg.inner_text(".board-host .pz-mb-ghost") and "lấy xe" in pg.inner_text(".board-host .pz-mb-ghost"), "gợi ý mức 3 hiện dòng 'Gợi ý sẽ thêm: … lấy xe …' ngay dưới kế hoạch", pg.inner_text(".board-host .pz-mb-ghost"))
        pg.click(".hint-panel button:has-text('Áp dụng nước này')")
        check(E.game()["v"][1] == 1 and recs_of(E.game())[0][1] == 1, "áp dụng gợi ý đầu tiên = một lệnh 'Lấy xe' (một nước)")
        # gợi ý chở: vạch gợi ý trên biểu đồ
        pg.click(".toolbar button:has-text('Gợi ý')")
        pg.wait_for_selector(".hint-panel:not([hidden]) .hint-text")
        pg.click(".hint-panel button:has-text('Chi tiết hơn')")
        check(pg.locator(".board-host .pz-mb-hintline").count() == 1, "gợi ý mức 2 về vị trí chở: biểu đồ có vạch 'gợi ý' (nét chấm cam + chữ)")
        pg.keyboard.press("Escape")

        # ---- làm trọn bằng giao diện theo gợi ý, so từng bước với mô phỏng độc lập
        E.start(tid, "std", "medium", SEED + 52)
        g = E.game()
        d = g["data"]
        bad = []

        def each(gg):
            r = recs_of(gg)
            s = simulate(d, r)
            if not s["ok"] or status_T(pg) != s["T"]:
                bad.append((len(r), str(status_T(pg)), str(s.get("T"))))
        n_ops, last = ui_apply_hint(pg, E, each)
        g = E.game()
        s = simulate(d, recs_of(g))
        check(not bad and n_ops >= 4 and last and last["action"]["k"] == "submit" and s["ok"] and s["T"] == best_of(d),
              "bậc Vừa (%d người, %d xe, m = %d/%d): làm bằng giao diện %d lệnh theo gợi ý; sau mỗi lệnh T hiển thị = Fraction độc lập; cuối cùng T = %s = tối ưu độc lập" % (d["n"], d["k"], d["mu"], d["mv"], n_ops, frac_text(best_of(d))), (bad[:3], str(s.get("T")), str(best_of(d))))
        arr_txt = pg.evaluate("[...document.querySelectorAll('.board-host .pz-mb-arr')].map(e => e.textContent)")
        check(len(arr_txt) == 1 and "tới B" in arr_txt[0] and ("P%d" % d["n"]) in arr_txt[0], "biểu đồ gộp mọi người tới cùng lúc thành MỘT nhãn 'P1 … P%d tới B · …' (lịch tối ưu)" % d["n"], arr_txt)
        dash = pg.evaluate("[...new Set([...document.querySelectorAll('.board-host .pz-mb-bike')].map(e => (e.getAttribute('class').match(/pz-mb-b\\d/) || [''])[0] + '|' + (e.getAttribute('stroke-dasharray') || '')))]")
        check(len(dash) == d["k"] and len({x.split("|")[1] for x in dash}) == d["k"], "mỗi xe một KIỂU NÉT khác nhau (không chỉ màu): %s" % dash, dash)
        check(pg.locator(".board-host .pz-mb-tline").count() == 1 and pg.locator(".board-host .pz-mb-evtable tr").count() >= n_ops, "có vạch ngang 'người cuối tới B' và bảng sự kiện bằng chữ cho trình đọc màn hình")
        dup = pg.evaluate(JS_DUP)
        check(dup["ids"][0] != dup["ids"][1] and all(dup["own"]) and dup["ro"]["controls"] == 0 and dup["ro"]["svg"] == 1 and dup["ro"]["btns"] == 0, "hai bàn cùng tồn tại: id ghi chú không trùng; bàn chỉ-đọc (replay) không có điều khiển / nút, vẫn có biểu đồ", dup)
        pg.click(".board-host .pz-mb-submit")
        check(pg.get_attribute(".board-host .pz-mb-submit", "aria-expanded") == "true" and "Nộp kế hoạch hiện tại" in pg.inner_text(".board-host .pz-mb-confirm"), "bấm 'Nộp kế hoạch…' mở hộp xác nhận (aria-expanded)")
        pg.keyboard.press("Escape")
        check(pg.is_hidden(".board-host .pz-mb-confirm") and E.game()["status"] == "playing", "Esc đóng hộp xác nhận, chưa nộp")
        pg.click(".board-host .pz-mb-submit")
        pg.click(".board-host .pz-mb-ok")
        pg.wait_for_selector("dialog[open] h2:has-text('Đã giải')", timeout=10000)
        rec = pg.evaluate(JS_LASTREC)
        check(rec["grade"]["stars"] == 3 and rec["grade"]["quality"] == 1 and "Tối ưu" in pg.inner_text("dialog[open]") and "phút" in pg.inner_text("dialog[open] .stat-grid"), "nộp lịch tối ưu: 3★, chất lượng 100 %, 'Tối ưu!', giá trị tính bằng phút", rec["grade"])
        pg.keyboard.press("Escape")
        pg.wait_for_selector("dialog[open]", state="detached", timeout=5000)

        # ---- cách hiểu B (xe ôm)
        open_new(pg, "interp:B", "std", "easy", SEED + 53)
        g = E.game()
        d = g["data"]
        check(d["interp"] == "B" and pg.locator(".board-host .pz-mb-bikechip").first.inner_text().startswith("Xe ôm 1") and pg.locator(TAKE_DRV).count() == 1 and pg.locator(TAKE_REAR).count() == 0, "xe ôm: chip 'Xe ôm 1', chỉ chọn MỘT khách (không có ô 'ngồi sau')", d["interp"])
        check(Fr(d["best"]) == best_of(d), "xe ôm: tối ưu engine %s = công thức Fraction độc lập" % d["best"])
        bad = []

        def each2(gg):
            r = recs_of(gg)
            s = simulate(d, r)
            if not s["ok"] or status_T(pg) != s["T"]:
                bad.append((len(r), str(status_T(pg)), str(s.get("T"))))
        n_ops, last = ui_apply_hint(pg, E, each2)
        s = simulate(d, recs_of(E.game()))
        check(not bad and last and last["action"]["k"] == "submit" and s["ok"] and s["T"] == best_of(d) and pg.locator(".board-host .pz-mb-aband").count() == 0, "xe ôm: làm bằng giao diện (%d lệnh) tới đúng tối ưu độc lập; không có nút 'Bỏ xe' (vô nghĩa với xe ôm)" % n_ops, (bad[:2], str(s.get("T"))))

        # ---- tiếp sức (bỏ xe): thả cả hai người = xe bị bỏ lại; macro 'Bỏ xe tại đây'
        E.start(tid, "std", "easy", SEED + 54)
        d = E.game()["data"]
        pg.evaluate("location.hash = '#/create/motorbike'")
        pg.wait_for_selector(".pz-mb-ed", timeout=15000)
        pg.wait_for_function("document.querySelector('.cr-status .cr-chip')", timeout=20000)
        txt = pg.inner_text(".cr-status").replace(" ", " ")
        check("13/25" in txt and "31 phút 12 giây" in txt, "trình soạn mặc định 4 người / 1 xe / m = 5: vỏ báo 'Tối ưu chính xác: 13/25 giờ (31 phút 12 giây)'", txt)
        pg.click(".pz-mb-ed button:has-text('4 người, 1 xe, m = 2 (bỏ xe)')")
        pg.wait_for_function("/3\\/4/.test(document.querySelector('.cr-status').innerText)", timeout=20000)
        check(pg.input_value(".pz-mb-ed input[aria-label^='Tốc độ xe']") == "2" and "Tiếp sức" in pg.inner_text(".cr-status"), "mẫu 'm = 2 (bỏ xe)': m điền 2; vỏ báo 3/4 giờ, chế độ Tiếp sức", pg.inner_text(".cr-status"))
        pg.click("button:has-text('Chơi thử')")
        pg.wait_for_selector(".board-host .pz-mb-svg", timeout=30000)
        d = E.game()["data"]
        check(d["n"] == 4 and d["k"] == 1 and d["mu"] == 2 and d["best"] == "3/4" and d["fam"] == "tiep-suc", "Chơi thử từ trình soạn: đề 4/1/m=2, họ tiếp sức", d)
        recs = [(1, 1, 1, 2), (1, 2, d["G"] // 2, 0)]
        for r in recs:
            ui_cmd(pg, r)
        check(pg.locator(".board-host .pz-mb-aband").count() == 1 and not pg.is_disabled(".board-host .pz-mb-aband"), "đang chở 2 người ở giữa đường: có nút 'Bỏ xe tại đây'")
        n0 = E.game()["v"][1]
        pg.click(".board-host .pz-mb-aband")
        g = E.game()
        check(g["v"][1] == n0 + 2 and [r[1] for r in recs_of(g)][-2:] == [4, 4] and "đang đỗ, chưa có ai trên xe" in pg.inner_text(".board-host .pz-mb-binfo") and pg.locator(".board-host .pz-mb-take").count() == 1, "'Bỏ xe tại đây' = MỘT diff thêm 2 lệnh xuống; xe đỗ giữa đường; lại có 'Lấy xe' cho cặp sau", recs_of(g))
        pg.click(".toolbar button:has-text('Hoàn tác')")
        check(E.game()["v"][1] == n0, "một lần Hoàn tác gỡ cả macro 'Bỏ xe' (2 lệnh)")
        n_ops, last = ui_apply_hint(pg, E)
        s = simulate(d, recs_of(E.game()))
        check(last and last["action"]["k"] == "submit" and s["ok"] and s["T"] == Fr(3, 4), "tiếp sức 4 người m = 2: gợi ý dẫn tới T = 3/4 giờ (45 phút) = tối ưu độc lập", str(s.get("T")))

        # ---- đề không chia hết: cảnh báo, chơi được, không bao giờ 3★
        pg.evaluate("location.hash = '#/create/motorbike'")
        pg.wait_for_selector(".pz-mb-ed", timeout=15000)
        pg.click(".pz-mb-ed button:has-text('5 người, 1 xe, m = 2')")
        pg.wait_for_function("/Chưa biết tối ưu/.test(document.querySelector('.cr-status').innerText)", timeout=20000)
        txt = pg.inner_text(".cr-status").replace(" ", " ")
        check("4/5" in txt and "5/6" in txt and "cận dưới LP" in (pg.inner_text(".cr-status") + txt), "5 người / 1 xe / m = 2: vỏ cảnh báo 'Chưa biết tối ưu chính xác', nêu cận LP 4/5 và lịch biết 5/6", txt)
        check("Chưa biết tối ưu" in pg.inner_text(".pz-mb-edinfo"), "dòng kết quả ngay trong trình soạn cũng cảnh báo")
        pg.fill(".pz-mb-ed input[aria-label^='Tốc độ xe']", "1")
        pg.wait_for_function("document.querySelector('.cr-status .cr-chip.bad') || /m > 1|Tốc độ/.test(document.querySelector('.cr-status').innerText)", timeout=20000)
        check(pg.is_disabled("button:has-text('Chơi thử')"), "m = 1: vỏ báo lỗi, 'Chơi thử' bị khoá", pg.inner_text(".cr-status"))
        pg.fill(".pz-mb-ed input[aria-label^='Tốc độ xe']", "5/2")
        pg.wait_for_function("/Chưa biết|Tối ưu/.test(document.querySelector('.cr-status').innerText)", timeout=20000)
        pg.fill(".pz-mb-ed input[aria-label^='Tốc độ xe']", "2")
        pg.wait_for_function("/4\\/5/.test(document.querySelector('.cr-status').innerText)", timeout=20000)
        pg.click("button:has-text('Chơi thử')")
        pg.wait_for_selector(".board-host .pz-mb-svg", timeout=30000)
        d = E.game()["data"]
        ttl = pg.inner_text(".play-title h1").replace(" ", " ")
        check(not d["exact"] and d["best"] == "4/5" and d["known"] == "5/6" and "5 người · 1 xe · xe nhanh gấp 2" in ttl, "Chơi thử đề không chia hết: best = cận LP 4/5, known = 5/6; tiêu đề tự giải thích cỡ", (d["best"], d["known"], ttl))
        n_ops, last = ui_apply_hint(pg, E)
        check(last and last["action"]["k"] == "submit", "gợi ý dẫn tới lịch tốt nhất biết rồi bảo nộp (đề không biết tối ưu vẫn kết thúc được)")
        pg.click(".board-host .pz-mb-submit")
        pg.click(".board-host .pz-mb-ok")
        pg.wait_for_selector("dialog[open] h2:has-text('Đã giải')", timeout=10000)
        rec = pg.evaluate(JS_LASTREC)
        dlg = pg.inner_text("dialog[open]")
        check(rec["grade"]["stars"] < 3 and rec["grade"]["quality"] < 1 and "cận dưới LP" in dlg and "Tối ưu!" not in dlg, "nộp lịch tốt nhất biết (không chạm cận LP): KHÔNG 3★, KHÔNG 'Tối ưu!', hộp thoại nêu cận dưới LP", rec["grade"])
        pg.keyboard.press("Escape")
        pg.wait_for_selector("dialog[open]", state="detached", timeout=5000)

        # ---- trình soạn: Enter trên chip (vẽ lại) giữ focus
        pg.evaluate("location.hash = '#/create/motorbike'")
        pg.wait_for_selector(".pz-mb-ed", timeout=15000)
        pg.focus(".pz-mb-ed .chip:has-text('Xe ôm')")
        pg.keyboard.press("Enter")
        fo = pg.evaluate(JS_FOCUS)
        check(not fo["inBody"] and fo["txt"].startswith("Xe ôm"), "trình soạn: Enter trên chip 'Xe ôm' (vẽ lại) — focus ở lại đúng chip", fo)
    finally:
        E.close()
        br.close()


# ---------------------------------------------------------------------------------------------- chạy trên trình duyệt của check.py
def run(P, check, section, tid):
    pg = P.pg
    br = pg.context.browser

    # ======================================================================= tương phản, co giãn, giảm chuyển động
    section("  — tương phản (sáng + tối), biểu đồ co theo khung, 280 px với bàn dài nhất")
    P.start(tid, "std", "expert", SEED + 40)
    low = []
    for theme in ("light", "dark"):
        pg.evaluate("t => { document.documentElement.dataset.theme = t }", theme)
        for fg, bg, lab, need in (("--text", "--sunk", "chữ nhãn người tới B trên nền biểu đồ", 4.5), ("--pz-mb-hint", "--sunk", "chữ 'gợi ý' trên biểu đồ", 4.5), ("--text-2", "--sunk", "chữ trục", 4.5), ("--text", "--elev", "chữ trên nền thẻ", 4.5),
                                  ("--pz-mb-b0", "--sunk", "nét xe 1", 3), ("--pz-mb-b1", "--sunk", "nét xe 2", 3), ("--pz-mb-b2", "--sunk", "nét xe 3", 3), ("--pz-mb-b3", "--sunk", "nét xe 4", 3),
                                  ("--pz-mb-walk", "--sunk", "nét người đi bộ", 3), ("--pz-mb-tline", "--sunk", "vạch người cuối tới B", 3)):
            r = contrast(pg, fg, bg)
            if r < need:
                low.append("%s %s = %.2f" % (theme, lab, r))
    pg.evaluate("t => { document.documentElement.dataset.theme = t }", "light")
    check(not low, "tương phản --pz-mb-* ≥ 4,5:1 (chữ) / ≥ 3:1 (nét vẽ) ở giao diện sáng và tối", low)

    ctx = br.new_context(viewport={"width": 280, "height": 740}, service_workers="block", reduced_motion="reduce")
    p2 = ctx.new_page()
    errs = []
    p2.on("pageerror", lambda e: errs.append(str(e)))
    p2.goto(P.url, wait_until="load")
    p2.wait_for_function("document.body.classList.contains('ready')", timeout=30000)
    for opts, sd in (("", SEED + 70), ("interp:B", SEED + 71)):
        p2.evaluate("location.hash = '#/new/motorbike?size=std&tier=expert&seed=%d%s&go=1'" % (sd, ("&o=" + opts) if opts else ""))
        p2.wait_for_selector(".board-host .pz-mb-svg", timeout=30000)
        p2.wait_for_timeout(300)
        # làm đầy kế hoạch bằng chính lịch tối ưu (nhiều xe, nhiều dòng) rồi đo tràn ngang ở 280 px
        p2.evaluate("""() => { const c = Puz.ui.app.ctx(), id = decodeURIComponent(/#\\/play\\/([^?]+)/.exec(location.hash)[1]), g = c.getGame(id); let n = 0;
          while (g.status === 'playing' && n < 70) { const h = g.hint(3); if (!h || h.none || !h.action || h.action.k !== 'cmd') break; g.applyHint(h); n++; } }""")
        p2.wait_for_timeout(300)
        m = p2.evaluate("""() => { const W = innerWidth, bad = []; for (const el of document.querySelectorAll('.board-host *')) { if (el.closest('svg')) continue; const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) bad.push((el.className || el.tagName) + ':' + Math.round(r.left) + '..' + Math.round(r.right)); }
          const tiny = [...document.querySelectorAll('.board-host button, .board-host input, .board-host select')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.height < 43.5); }).map(e => (e.className || e.tagName) + ':' + Math.round(e.getBoundingClientRect().height));
          const sv = document.querySelector('.board-host .pz-mb-svg'), dg = document.querySelector('.board-host .pz-mb-diag');
          return { bad: bad.slice(0, 5), tiny: tiny.slice(0, 5), sw: document.documentElement.scrollWidth, iw: innerWidth, steps: document.querySelectorAll('.board-host .pz-mb-step').length, vb: sv.viewBox.baseVal.width, cw: dg.clientWidth,
                   fs: parseFloat(getComputedStyle(document.querySelector('.board-host .pz-mb-axt')).fontSize) }; }""")
        check(not m["bad"] and m["sw"] <= m["iw"] + 1 and not m["tiny"] and m["steps"] >= 6 and abs(m["vb"] - m["cw"]) <= 2 and m["fs"] >= 11.5,
              "280 px, bậc chuyên gia%s (%d dòng kế hoạch): không phần tử nào ra ngoài khung, trang không tràn ngang, mọi nút/ô chọn/thanh trượt cao ≥ 44 px, biểu đồ có viewBox = bề rộng thật (chữ %.0f px, không co)" % (" xe ôm" if opts else "", m["steps"], m["fs"]), m)
    p2.set_viewport_size({"width": 420, "height": 740})
    p2.wait_for_timeout(500)
    m2 = p2.evaluate("[document.querySelector('.board-host .pz-mb-svg').viewBox.baseVal.width, document.querySelector('.board-host .pz-mb-diag').clientWidth]")
    check(abs(m2[0] - m2[1]) <= 2 and m2[0] > 300, "đổi khung 280 → 420 px: biểu đồ vẽ lại theo bề rộng mới (ResizeObserver)", m2)
    p2.evaluate("location.hash = '#/create/motorbike'")
    p2.wait_for_selector(".pz-mb-ed", timeout=15000)
    p2.wait_for_timeout(400)
    ov = p2.evaluate("[document.documentElement.scrollWidth, innerWidth]")
    check(ov[0] <= ov[1] + 1, "420 px: trình soạn không tràn ngang", ov)
    check(not errs, "không lỗi JS ở ngữ cảnh 280/420 px + giảm chuyển động", errs)
    ctx.close()

    # ======================================================================= WebKit iPhone 13 (chạm thật)
    section("  — WebKit iPhone 13: chạm Lấy xe, Chở thẳng tới B")
    box = {}
    th = threading.Thread(target=lambda: box.update(webkit_touch(P.url)))
    th.start()
    th.join(180)
    if box.get("err") and ("Executable doesn't exist" in box["err"] or "browserType.launch" in box["err"]):
        print("  (bỏ qua WebKit: %s)" % box["err"].splitlines()[0][:100])
    else:
        check(box.get("ok") and box.get("after_take") == 1 and box.get("after_ride") == 2 and abs(box["svg_w"][0] - box["svg_w"][1]) <= 2 and box["overflow"][0] <= box["overflow"][1] + 1 and not box.get("errs"),
              "iPhone 13 (WebKit): chạm 'Lấy xe' → 1 lệnh, chạm 'Chở thẳng tới B' → 2 lệnh; biểu đồ vừa khung, không tràn ngang, không lỗi JS", box)

    edge_p5(P, check, section, tid)
