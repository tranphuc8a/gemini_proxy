# -*- coding: utf-8 -*-
"""Kiểm riêng của bàn LẠC ĐÀ CHỞ CHUỐI (assets/js/ui/boards/camel.js + assets/css/board-camel.css) bằng trình duyệt thật.

check.py nạp tệp này và gọi run(P, check, section, tid) sau vòng đời chung của mọi loại (xem tang_2). P là Page của check.py (P.pg = Playwright page).
Phần chạy trên Edge thật (channel="msedge", lùi về Chromium + in rõ nếu máy không có Edge) nằm ở edge_p4(): giải trọn ván bằng giao diện (ô Lấy / Đặt / Đi tới, chuyến tiếp tế, xác nhận nộp),
trục km (chạm / kéo / phím), xem trước lỗi, đếm "nước làm mất tối ưu", quay về từ dòng kế hoạch, gợi ý tô trục và kế hoạch, replay chỉ-đọc, bài tới D, trình soạn.

Nguồn sự thật ĐỘC LẬP: luật chơi viết lại bằng Python (bộ mô phỏng từng thao tác, kho dạng từ điển), tối ưu bằng QHĐ theo km viết lại bằng Python (g(S) = max_f [min(S, f·C) − (2f − 1)]),
bản ghi kế hoạch đọc thẳng từ state.v theo bố cục Puz.plan (v = [nộp, số bước, (lạc đà, thao tác, đối số)…]) — không gọi engine để tính giá trị."""

from __future__ import annotations

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


def gstep(S, C):
    best = -1
    f = 1
    while f <= -(-S // C) + 1:
        m = min(S, f * C)
        if m >= 2 * f - 1:
            best = max(best, m - (2 * f - 1))
        f += 1
    return best


def far_disc(B, C):
    S, x, best = B, 0, min(B, C)
    while S >= 1:
        S = gstep(S, C)
        if S < 0:
            break
        x += 1
        best = max(best, x + min(S, C))
    return best


def deliver_disc(B, C, D):
    S = B
    for _ in range(D):
        if S < 1:
            return 0
        S = gstep(S, C)
        if S < 0:
            return 0
    return S


def simulate(B, C, mx, ops):
    """ops = [(op, arg)] với op 1 = đi tới km, 2 = lấy, 3 = đặt. Kho dạng từ điển. → dict(ok, at, pos, load, far, dep)."""
    pos, load, far, dep = 0, 0, 0, {0: B}
    for i, (op, a) in enumerate(ops):
        here = dep.get(pos, 0)
        if op == 2:
            if not (1 <= a <= here and load + a <= C):
                return {"ok": False, "at": i}
            dep[pos] = here - a
            load += a
        elif op == 3:
            if not (1 <= a <= load):
                return {"ok": False, "at": i}
            dep[pos] = here + a
            load -= a
        elif op == 1:
            if not (0 <= a <= mx) or a == pos or abs(a - pos) > load:
                return {"ok": False, "at": i}
            load -= abs(a - pos)
            pos = a
            far = max(far, a)
        else:
            return {"ok": False, "at": i}
    return {"ok": True, "pos": pos, "load": load, "far": far, "dep": dep}


def ops_of(g):
    v = g["v"]
    return [(v[2 + 3 * i + 1], v[2 + 3 * i + 2]) for i in range(v[1])]


def value_of(g):
    d = g["data"]
    s = simulate(d["B"], d["C"], d["maxX"], ops_of(g))
    if not s["ok"]:
        return None
    return s["far"] if d["mode"] == "far" else s["dep"].get(d["D"], 0) + (s["load"] if s["pos"] == d["D"] else 0)


def best_of(d):
    return far_disc(d["B"], d["C"]) if d["mode"] == "far" else deliver_disc(d["B"], d["C"], d["D"])


JS_HINT = """() => {
  const id = decodeURIComponent(/#\\/play\\/([^?]+)/.exec(location.hash)[1]), g = Puz.ui.app.ctx().getGame(id), T = g.type;
  return T.hint(g.puzzle, g.state, 3, g.settings());
}"""
JS_FOCUS = """() => { const a = document.activeElement; return { tag: a.tagName, cls: a.className, txt: (a.textContent || '').trim(), label: a.getAttribute('aria-label'), inBody: a === document.body }; }"""
JS_HUD = """() => [...document.querySelectorAll('.hud-chip')].map(c => ({ title: c.title, val: c.lastChild ? c.lastChild.textContent : '' }))"""
JS_LASTREC = "() => { const r = Puz.ui.app.ctx().user.history().filter(x => x.type === 'camel'); return r.length ? r[r.length - 1] : null; }"
JS_DUP = """() => {
  const c = Puz.ui.app.ctx(), id = decodeURIComponent(/#\\/play\\/([^?]+)/.exec(location.hash)[1]), g = c.getGame(id), hosts = [], views = [];
  for (let k = 0; k < 2; k++) { const h = document.createElement('div'); document.body.append(h); hosts.push(h); views.push(Puz.boards.camel.mount(h, { game: g, puzzle: g.puzzle, type: g.type, U: Puz.ui, readOnly: false, settings: c.settings, announce: () => {}, clearHint: () => {} })); }
  const ids = hosts.map(h => h.querySelector('.pz-cm-go').getAttribute('aria-describedby')), own = hosts.map((h, i) => { const e = document.getElementById(ids[i]); return !!e && h.contains(e); });
  views.forEach(v => v.destroy()); hosts.forEach(h => h.remove());
  return { ids: ids, own: own };
}"""

LOAD_IN = ".board-host input[aria-label^='Số quả muốn lấy']"
DROP_IN = ".board-host input[aria-label^='Số quả muốn đặt']"
GO_IN = ".board-host input[aria-label='Km muốn đi tới']"
TRACK = ".board-host .pz-cm-track"


def status_nums(pg):
    """(vị trí, chở, sức chở) đọc từ dòng trạng thái của bàn."""
    t = pg.inner_text(".board-host .pz-cm-status")
    m = re.search(r"km (\d+) · chở (\d+)/(\d+)", t)
    return (int(m.group(1)), int(m.group(2)), int(m.group(3))) if m else None


def ui_op(pg, op, n):
    """Thực hiện MỘT thao tác bằng ô nhập + nút (đúng như người chơi)."""
    if op == "load":
        pg.fill(LOAD_IN, str(n))
        pg.click(".board-host .pz-cm-load")
    elif op == "drop":
        pg.fill(DROP_IN, str(n))
        pg.click(".board-host .pz-cm-drop")
    else:
        pg.fill(GO_IN, str(n))
        pg.click(".board-host .pz-cm-go")
    pg.wait_for_timeout(30)


def ui_apply_hint(pg, E, check_each=None):
    """Lặp: lấy gợi ý mức 3 của engine (không tính vào bộ đếm), làm lại từng thao tác BẰNG GIAO DIỆN. Dừng khi gợi ý là 'nộp'. → số chặng."""
    chunks = 0
    for _ in range(40):
        h = pg.evaluate(JS_HINT)
        a = h.get("action")
        if h.get("none") or not a or a["k"] != "steps":
            return chunks, h
        for o in a["ops"]:
            ui_op(pg, o["op"], o["n"])
        chunks += 1
        if check_each:
            check_each(E.game())
    return chunks, None


def contrast(pg, fg, bg):
    c = pg.evaluate("""([a, b]) => { const f = document.createElement('i'), k = document.createElement('i'); f.style.color = 'var(' + a + ')'; k.style.color = 'var(' + b + ')'; document.body.append(f, k); const o = [getComputedStyle(f).color, getComputedStyle(k).color]; f.remove(); k.remove(); return o; }""", [fg, bg])
    return ratio(rgb(c[0]), rgb(c[1]))


def webkit_touch(url):
    """Luồng riêng (Playwright đồng bộ không lồng được): WebKit + iPhone 13, CHẠM thật: chạm trục chọn km, Đầy, Lấy, Đi tới."""
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
            pg.evaluate("location.hash = '#/new/camel?size=far&tier=easy&seed=%d&go=1'" % (SEED + 91))
            pg.wait_for_selector(".board-host .pz-cm-track", timeout=30000)
            pg.wait_for_timeout(300)
            out["data"] = pg.evaluate("Puz.ui.app.ctx().getGame(decodeURIComponent(/#\\/play\\/([^?]+)/.exec(location.hash)[1])).puzzle.data")
            box = pg.locator(".board-host .pz-cm-layer").bounding_box()
            pg.touchscreen.tap(box["x"] + box["width"] * 0.5, box["y"] + 60)
            pg.wait_for_timeout(100)
            out["tgt"] = int(pg.get_attribute(".board-host .pz-cm-track", "aria-valuenow"))
            out["goin"] = pg.input_value(GO_IN)
            pg.tap(".board-host button:has-text('Đầy')")
            pg.tap(".board-host .pz-cm-load")
            pg.wait_for_timeout(100)
            out["after_load"] = status_nums(pg)
            pg.tap(".board-host .pz-cm-run")
            pg.wait_for_timeout(100)
            out["after_run"] = status_nums(pg)
            out["steps"] = pg.locator(".board-host .pz-cm-step .pz-cm-stext").count()
            out["overflow"] = pg.evaluate("[document.documentElement.scrollWidth, innerWidth]")
            out["errs"] = errs
            out["ok"] = True
            br.close()
    except Exception as e:  # noqa: BLE001
        out["err"] = "%s: %s" % (type(e).__name__, e)
    return out


# ---------------------------------------------------------------------------------------------- Edge: giải trọn bằng giao diện, trục, lỗi, replay, bài tới D, trình soạn
def edge_p4(P, check, section, tid):
    PageCls = type(P)
    bt = P.pg.context.browser.browser_type
    try:
        br, kenh = bt.launch(channel="msedge"), "Edge"
    except Exception as e:  # noqa: BLE001
        br, kenh = bt.launch(), "Chromium (không mở được Edge: %s)" % str(e).splitlines()[0][:80]
    section("  — đợt P4 trên %s: giải trọn bằng giao diện, trục km, xem trước lỗi, nước làm mất tối ưu, replay chỉ-đọc, bài tới D, trình soạn" % kenh)
    E = PageCls(br, P.url, "cm-p4", viewport={"width": 1280, "height": 1000})
    pg = E.pg
    try:
        # ---- vẽ đúng theo state + xem trước lỗi + trục
        E.start(tid, "far", "easy", SEED + 51)
        g = E.game()
        d = g["data"]
        B, C, mx = d["B"], d["C"], d["maxX"]
        check(d["mode"] == "far" and d["best"] == far_disc(B, C), "đề dễ (%d quả, chở %d): tối ưu của engine = QHĐ viết lại bằng Python (%d km)" % (B, C, d["best"]), (d["best"], far_disc(B, C)))
        check(pg.get_attribute(TRACK, "role") == "slider" and pg.get_attribute(TRACK, "aria-valuemax") == str(mx) and pg.get_attribute(TRACK, "aria-valuemin") == "0",
              "trục km: role=slider, aria-valuemin 0, aria-valuemax = %d" % mx)
        check(status_nums(pg) == (0, 0, C) and pg.locator(".board-host .pz-cm-depot").count() == 1 and pg.inner_text(".board-host .pz-cm-depot .pz-cm-dn").replace(" ", " ") == "{:,}".format(B).replace(",", " "),
              "bàn trống: lạc đà ở km 0 chở 0/%d, một kho ở A ghi đúng %d quả" % (C, B))
        check(pg.locator(".board-host .pz-cm-plan .pz-cm-empty").count() == 1 and pg.is_disabled(".board-host .pz-cm-submit") and pg.is_disabled(".board-host .pz-cm-clear"), "kế hoạch rỗng: dòng hướng dẫn, 'Nộp' và 'Xoá' bị vô hiệu")
        pg.fill(GO_IN, "3")
        check(pg.is_disabled(".board-host .pz-cm-go") and "ăn dọc đường" in pg.inner_text(".board-host .pz-cm-note >> nth=2") and not pg.is_disabled(".board-host .pz-cm-trip") and "Chuyến tiếp tế tới km 3" in pg.inner_text(".board-host .pz-cm-note >> nth=3"),
              "đi khi chưa chở gì: 'Đi tới' bị vô hiệu, ghi chú nêu lý do 'ăn dọc đường' (do engine, không phải bàn); chuyến tiếp tế (tự lấy chuối) vẫn dùng được", pg.inner_text(".board-host .pz-cm-note >> nth=2"))
        pg.fill(LOAD_IN, str(C + 1))
        check(pg.is_disabled(".board-host .pz-cm-load") and "Sức chở" in pg.inner_text(".board-host .pz-cm-note >> nth=0"), "lấy quá sức chở: nút vô hiệu + ghi chú 'Sức chở tối đa %d'" % C, pg.inner_text(".board-host .pz-cm-note >> nth=0"))
        pg.click(".board-host button:has-text('Đầy')")
        check(pg.input_value(LOAD_IN) == str(min(C, B)) and not pg.is_disabled(".board-host .pz-cm-load") and "Sau khi lấy" in pg.inner_text(".board-host .pz-cm-note >> nth=0"), "nút 'Đầy' điền %d và mở nút Lấy, ghi chú xem trước 'Sau khi lấy: …'" % min(C, B))
        # trục: bấm, phím
        box = pg.locator(".board-host .pz-cm-layer").bounding_box()
        pg.mouse.click(box["x"] + box["width"] * 0.5, box["y"] + 80)
        v = int(pg.get_attribute(TRACK, "aria-valuenow"))
        check(abs(v - round(mx / 2)) <= 1 and pg.input_value(GO_IN) == str(v), "bấm giữa trục: km đang chọn ≈ %d (nhận %d), ô 'Đi tới' cập nhật theo" % (round(mx / 2), v))
        pg.mouse.move(box["x"] + box["width"] * 0.2, box["y"] + 80)
        pg.mouse.down()
        pg.mouse.move(box["x"] + box["width"] * 0.9, box["y"] + 80, steps=6)
        pg.mouse.up()
        v2 = int(pg.get_attribute(TRACK, "aria-valuenow"))
        check(abs(v2 - round(mx * 0.9)) <= 1, "kéo trên trục tới 90 %%: km đang chọn ≈ %d (nhận %d)" % (round(mx * 0.9), v2))
        pg.focus(TRACK)
        pg.keyboard.press("Home")
        check(pg.get_attribute(TRACK, "aria-valuenow") == "0", "phím Home: km 0")
        pg.keyboard.press("ArrowRight")
        pg.keyboard.press("ArrowRight")
        check(pg.get_attribute(TRACK, "aria-valuenow") == "2" and pg.get_attribute(TRACK, "aria-valuetext") == "km 2", "mũi tên phải ×2: km 2 (aria-valuetext 'km 2')")
        pg.keyboard.press("PageUp")
        check(pg.get_attribute(TRACK, "aria-valuenow") == str(min(mx, 12)), "PageUp: +10")
        pg.keyboard.press("End")
        check(pg.get_attribute(TRACK, "aria-valuenow") == str(mx), "phím End: km cuối bản đồ %d" % mx)
        pg.keyboard.press("ArrowRight")
        check(pg.get_attribute(TRACK, "aria-valuenow") == str(mx), "không vượt cuối bản đồ")
        pg.keyboard.press("Home")
        pg.keyboard.press("ArrowLeft")
        check(pg.get_attribute(TRACK, "aria-valuenow") == "0", "không lùi dưới 0 (ArrowLeft ở km 0 không làm gì)")

        # ---- thao tác thật: Lấy → Đi → Đặt, đối chiếu mô phỏng độc lập
        pg.fill(GO_IN, "3")
        pg.click(".board-host .pz-cm-load")
        g = E.game()
        s = simulate(B, C, mx, ops_of(g))
        check(g["v"][1] == 1 and s["ok"] and s["load"] == min(C, B) and status_nums(pg) == (0, s["load"], C), "Lấy đầy bằng giao diện: bản ghi [0, 2, %d]; bàn và mô phỏng độc lập cùng nói chở %d" % (min(C, B), s["load"]), (g["v"][:6], status_nums(pg)))
        check(pg.get_attribute(".board-host .pz-cm-load", "aria-describedby") == pg.get_attribute(".board-host .pz-cm-note >> nth=0", "id"), "nút Lấy trỏ aria-describedby vào ghi chú xem trước của chính nó")
        ui_op(pg, "go", 3)
        g = E.game()
        s = simulate(B, C, mx, ops_of(g))
        check(s["ok"] and s["pos"] == 3 and s["load"] == min(C, B) - 3 and status_nums(pg) == (3, s["load"], C) and value_of(g) == 3, "Đi tới km 3: ăn 3 quả (mô phỏng độc lập: chở %d), bàn khớp; giá trị 'xa nhất' = 3" % s["load"])
        left = float(re.search(r"left:\s*([\d.]+)%", pg.get_attribute(".board-host .pz-cm-camel", "style")).group(1))
        check(pg.locator(".board-host .pz-cm-camel").count() == 1 and abs(left - 3 / mx * 100) < 0.05, "🐪 dịch tới km 3: vị trí %.2f %% bề rộng trục = 3/%d" % (left, mx), left)
        pg.click(".board-host button:has-text('Hết')")
        check(pg.input_value(DROP_IN) == str(s["load"]), "nút 'Hết' điền đúng số đang chở")
        amount = s["load"] - (3 if s["load"] > 3 else 0)
        pg.fill(DROP_IN, str(amount))
        pg.click(".board-host .pz-cm-drop")
        g = E.game()
        s = simulate(B, C, mx, ops_of(g))
        check(s["ok"] and s["dep"].get(3) == amount and pg.locator(".board-host .pz-cm-depot").count() == 2 and "kho: " in pg.inner_text(".board-host .pz-cm-status"), "Đặt %d quả ở km 3: kho mới trên trục (2 kho), dòng trạng thái liệt kê kho" % amount)
        rows = pg.locator(".board-host .pz-cm-step").count()
        check(rows == 3 and pg.locator(".board-host .pz-cm-step .pz-cm-cut").count() == 2, "kế hoạch có 3 dòng; dòng cuối không có nút 'Giữ tới đây' (2 nút còn lại)", rows)

        # ---- quay về từ dòng kế hoạch (nút tự biến mất → focus phải sang ô 'Đi tới', không rơi về BODY)
        pg.focus(".board-host .pz-cm-cut >> nth=0")
        pg.keyboard.press("Enter")
        g = E.game()
        fo = pg.evaluate(JS_FOCUS)
        check(g["v"][1] == 1 and pg.locator(".board-host .pz-cm-step").count() == 1 and not fo["inBody"] and fo["label"] == "Km muốn đi tới",
              "'↩ Giữ tới đây' ở bước 1 bằng Enter: kế hoạch còn 1 bước; focus sang ô 'Đi tới', không rơi về BODY", (g["v"][1], fo))
        check(g["undo"] >= 1, "quay về là một thao tác hoàn tác được (Puz.game)")
        pg.click(".toolbar button:has-text('Hoàn tác')")
        check(E.game()["v"][1] == 3 and pg.locator(".board-host .pz-cm-step").count() == 3, "Hoàn tác quay về: bàn vẽ lại đủ 3 bước")

        # ---- chuyến tiếp tế và 'đi hết sức' (macro): đối chiếu mô phỏng độc lập
        pg.click(".board-host .pz-cm-clear")
        check(E.game()["v"][1] == 0, "'Xoá kế hoạch' đưa về 0 bước")
        x = max(1, C // 4)
        pg.fill(GO_IN, str(x))
        check("Chuyến tiếp tế tới km %d" % x in pg.inner_text(".board-host .pz-cm-trip"), "nút chuyến tiếp tế đổi nhãn theo km đang chọn ('…tới km %d')" % x)
        m0 = E.game()["moves"]
        pg.click(".board-host .pz-cm-trip")
        g = E.game()
        s = simulate(B, C, mx, ops_of(g))
        check(g["v"][1] == 4 and s["ok"] and s["pos"] == 0 and s["load"] == 0 and s["dep"].get(x) == min(C, B) - 2 * x and g["moves"] == m0 + 1, "chuyến tiếp tế tới km %d: MỘT thao tác, 4 bản ghi (lấy, đi, đặt, về); mô phỏng độc lập: kho km %d = %d, lạc đà về A" % (x, x, min(C, B) - 2 * x), (ops_of(g), s))
        pg.click(".board-host .pz-cm-clear")
        pg.click(".board-host .pz-cm-run")
        g = E.game()
        s = simulate(B, C, mx, ops_of(g))
        check(s["ok"] and s["pos"] == min(C, B) and s["load"] == 0 and value_of(g) == min(C, B) and pg.is_disabled(".board-host .pz-cm-run"), "'Đi hết sức': lấy đầy, đi %d km tới hết chuối; nút tự vô hiệu (không còn chuối để ăn)" % min(C, B), ops_of(g))

        # ---- nộp: hộp xác nhận (Escape trả focus), nộp suboptimal → chất lượng độc lập
        pg.click(".board-host .pz-cm-submit")
        check(pg.locator(".board-host .pz-cm-confirm:not([hidden])").count() == 1 and "Nộp xong ván kết thúc" in pg.inner_text(".board-host .pz-cm-confirm") and pg.get_attribute(".board-host .pz-cm-submit", "aria-expanded") == "true",
              "'Nộp kế hoạch…' mở hộp xác nhận nói giá trị hiện tại và hậu quả")
        pg.keyboard.press("Escape")
        fo = pg.evaluate(JS_FOCUS)
        check(pg.locator(".board-host .pz-cm-confirm:not([hidden])").count() == 0 and "pz-cm-submit" in fo["cls"], "Escape đóng hộp xác nhận, focus về nút 'Nộp kế hoạch…'", fo)
        pg.click(".board-host .pz-cm-submit")
        pg.click(".board-host .pz-cm-ok")
        pg.wait_for_selector("dialog[open] h2:has-text('Đã giải')", timeout=10000)
        rec = pg.evaluate(JS_LASTREC)
        best = far_disc(B, C)
        want_q = round(min(C, B) / best, 3)
        check(rec and rec["result"] == "solved" and rec["grade"]["value"] == min(C, B) and rec["grade"]["best"] == best and abs(rec["grade"]["quality"] - want_q) < 0.0011 and rec["grade"]["stars"] == (3 if want_q >= 1 else 2 if want_q >= 0.9 else 1),
              "nộp 'đi hết sức' (%d km): lịch sử 'solved', grade value %d, tối ưu %d (QHĐ Python), quality %.3f" % (min(C, B), min(C, B), best, want_q), rec and rec.get("grade"))
        stats = pg.inner_text("dialog[open] .stat-grid")
        check("Điểm tối ưu" in stats and "km" in stats and "Đạt" in pg.inner_text("dialog[open]"), "hộp thoại 'Đã giải': ô 'Điểm tối ưu' có đơn vị km và dòng 'Đạt … % mức tối ưu'", stats.replace("\n", " "))
        pg.keyboard.press("Escape")
        pg.wait_for_selector("dialog[open]", state="detached", timeout=5000)

        # ---- giải trọn bằng giao diện theo gợi ý: từng chặng khớp mô phỏng độc lập; nộp 3★
        E.start(tid, "far", "medium", SEED + 52)
        g = E.game()
        d = g["data"]
        bad = []

        def each(cur):
            sm = simulate(d["B"], d["C"], d["maxX"], ops_of(cur))
            if not sm["ok"] or status_nums(pg) != (sm["pos"], sm["load"], d["C"]):
                bad.append((ops_of(cur)[-3:], sm.get("pos"), sm.get("load"), status_nums(pg)))
        chunks, last = ui_apply_hint(pg, E, each)
        g = E.game()
        check(chunks >= 3 and last and last.get("action") and last["action"]["k"] == "submit" and not bad, "đề vừa (%d quả, chở %d): %d chặng làm bằng ô nhập + nút, mỗi chặng bàn = mô phỏng độc lập; gợi ý cuối là 'nộp'" % (d["B"], d["C"], chunks), bad[:2])
        check(value_of(g) == d["best"] == best_of(d) and g["mistakes"] == 0, "giá trị kế hoạch = %d km = tối ưu độc lập (QHĐ Python), 0 nước làm mất tối ưu" % d["best"], (value_of(g), d["best"], g["mistakes"]))
        pg.click(".board-host .pz-cm-submit")
        pg.click(".board-host .pz-cm-ok")
        pg.wait_for_selector("dialog[open] h2:has-text('Đã giải')", timeout=10000)
        rec = pg.evaluate(JS_LASTREC)
        check(rec and rec["grade"]["stars"] == 3 and rec["grade"]["quality"] == 1 and rec["grade"]["value"] == d["best"] and rec["mistakes"] == 0, "nộp: 3★, quality 1, value = tối ưu, 0 lỗi", rec and rec.get("grade"))
        check("★★★" in pg.inner_text("dialog[open] .stat-grid") and "Tối ưu!" in pg.inner_text("dialog[open]"), "hộp thoại: ★★★ và 'Tối ưu!'")
        hud = pg.evaluate(JS_HUD)
        mv = [x for x in hud if x["title"].startswith("Số thao tác")]
        ms = [x for x in hud if x["title"] == "Nước làm mất tối ưu"]
        check(len(mv) == 1 and len(ms) == 1 and ms[0]["val"] == "0" and mv[0]["val"] == str(g["moves"] + 1), "HUD: chip 'Số thao tác' = bộ đếm của vỏ (%d), chip 'Nước làm mất tối ưu' = 0" % (g["moves"] + 1), hud)
        # ---- replay chỉ-đọc
        pg.click("dialog[open] button:has-text('Xem lời giải từng bước')")
        pg.wait_for_selector(".replay-panel:not([hidden])", timeout=20000)
        total = int(pg.inner_text(".rp-count").split("/")[1])
        check(pg.locator(".board-host .pz-cm-controls").count() == 0 and pg.locator(".board-host .pz-cm-submit").count() == 0 and pg.locator(".board-host .pz-cm-cut").count() == 0, "bàn chỉ-đọc trong replay: không có ô nhập, không nút nộp / giữ tới đây")
        pg.click(".replay-panel button:has-text('Sau')")
        check(pg.locator(".board-host .pz-cm-step.replay").count() >= 2 and "Chặng 1" in pg.inner_text(".rp-text"), "replay bước 1: các dòng của chặng đầu được tô 'replay'; lời giải thích 'Chặng 1…'", pg.inner_text(".rp-text"))
        pg.click(".replay-panel button[aria-label='Tới cuối']")
        check(pg.inner_text(".rp-count") == "Bước %d/%d" % (total, total) and pg.locator(".board-host .pz-cm-step").count() == E.game()["v"][1], "replay cuối: số dòng kế hoạch = số bước của lời giải (%d)" % E.game()["v"][1])
        pg.click(".replay-panel button[aria-label='Về đầu']")
        check(pg.locator(".board-host .pz-cm-step").count() == 0 and pg.locator(".board-host .pz-cm-empty").count() == 1, "replay về đầu: kế hoạch trống (chỉ còn dòng hướng dẫn)")
        pg.click(".replay-panel button:has-text('Thoát replay')")

        # ---- nước làm mất tối ưu: đếm, gợi ý nói trước, 'quay về', lỗi không bị xoá
        E.start(tid, "far", "medium", SEED + 53)
        g = E.game()
        d = g["data"]
        h0 = pg.evaluate(JS_HINT)
        first = h0["action"]["ops"]
        # nước làm mất tối ưu chắc chắn: lấy đầy rồi đi hết sức (bỏ phí cả kho)
        pg.click(".board-host .pz-cm-run")
        g = E.game()
        hud = pg.evaluate(JS_HUD)
        ms = [x for x in hud if x["title"] == "Nước làm mất tối ưu"]
        check(g["mistakes"] == 1 and ms and ms[0]["val"] == "1" and value_of(g) == d["C"], "đi hết sức ngay từ đầu (bỏ kho): chip 'Nước làm mất tối ưu' = 1 (đối chiếu: giá trị chỉ %d km so với tối ưu %d)" % (d["C"], d["best"]), (g["mistakes"], hud))
        pg.click(".toolbar button:has-text('Gợi ý')")
        pg.wait_for_selector(".hint-panel:not([hidden]) .hint-text")
        t1 = pg.inner_text(".hint-panel .hint-text")
        check("mất tối ưu" in t1, "gợi ý mức 1 nói trước: kế hoạch đã mất tối ưu", t1)
        pg.click(".hint-panel button:has-text('Chi tiết hơn')")
        check(pg.locator(".board-host .pz-cm-step.hint").count() >= 1, "gợi ý mức 2: tô dòng kế hoạch làm mất tối ưu (class hint)")
        pg.click(".hint-panel button:has-text('Chi tiết hơn')")
        check("Quay về trước bước" in pg.inner_text(".hint-panel .hint-text") and pg.locator(".hint-panel button:has-text('Áp dụng nước này')").count() == 1, "gợi ý mức 3: 'Quay về trước bước …' + nút áp dụng (truncate)")
        pg.click(".hint-panel button:has-text('Áp dụng nước này')")
        g = E.game()
        check(g["v"][1] <= 1 and g["mistakes"] == 1, "áp dụng 'quay về': kế hoạch rút ngắn, lỗi vẫn là 1 (hoàn tác không xoá lỗi)", (g["v"][1], g["mistakes"]))
        # gợi ý bình thường: tô vạch km trên trục + liệt kê thao tác sẽ thêm
        pg.click(".board-host .pz-cm-clear") if g["v"][1] else None
        pg.click(".toolbar button:has-text('Gợi ý')")
        pg.wait_for_selector(".hint-panel:not([hidden]) .hint-text")
        check(pg.locator(".board-host .pz-cm-hintpos").count() == 0, "gợi ý mức 1 KHÔNG tô km đích trên trục (không lộ đáp án)")
        pg.click(".hint-panel button:has-text('Chi tiết hơn')")
        check(pg.locator(".board-host .pz-cm-hintpos").count() >= 1, "gợi ý mức 2: tô vạch km (viền chấm cam, có chữ 'km …') trên trục")
        pg.click(".hint-panel button:has-text('Chi tiết hơn')")
        gh = pg.inner_text(".board-host .pz-cm-ghost")
        check(pg.locator(".board-host .pz-cm-ghost:not([hidden])").count() == 1 and "Gợi ý sẽ thêm" in gh and "đi tới km" in gh, "gợi ý mức 3: dòng 'Gợi ý sẽ thêm: lấy … → đi tới km … → đặt …' dưới kế hoạch", gh)
        pg.click(".hint-panel button:has-text('Ẩn gợi ý')")
        check(pg.locator(".board-host .pz-cm-hintpos").count() == 0 and pg.locator(".board-host .pz-cm-ghost:not([hidden])").count() == 0, "ẩn gợi ý: xoá vạch km và dòng gợi ý")

        # ---- hai bàn cùng mount: id ghi chú không trùng
        dup = pg.evaluate(JS_DUP)
        check(dup["ids"][0] != dup["ids"][1] and dup["own"] == [True, True], "hai bàn cùng mount: id ghi chú khác nhau, mỗi aria-describedby trỏ vào CHÍNH bàn của nó", dup)

        # ---- bàn phím trong ô nhập: Enter thực hiện đúng thao tác, focus ở lại
        E.start(tid, "far", "easy", SEED + 54)
        d = E.game()["data"]
        pg.click(LOAD_IN)
        pg.keyboard.type(str(d["C"]))
        pg.keyboard.press("Enter")
        g = E.game()
        fo = pg.evaluate(JS_FOCUS)
        check(g["v"][1] == 1 and not fo["inBody"] and "pz-cm-num" in fo["cls"], "Enter trong ô 'Lấy' = Lấy; focus ở lại ô (không rơi về BODY)", (g["v"][1], fo))
        pg.click(GO_IN)
        pg.fill(GO_IN, "2")
        pg.keyboard.press("Enter")
        check(E.game()["v"][1] == 2 and ops_of(E.game())[-1] == (1, 2), "Enter trong ô 'Đi tới' = Đi tới km 2", ops_of(E.game()))
        pg.focus(TRACK)
        pg.keyboard.press("Home")
        pg.keyboard.press("ArrowRight")
        pg.keyboard.press("Enter")
        check(E.game()["v"][1] == 3 and ops_of(E.game())[-1] == (1, 1), "Enter trên trục (km đang chọn = 1) = Đi tới km 1", ops_of(E.game()))
        pg.keyboard.press("Enter")
        check(E.game()["v"][1] == 3, "Enter khi đã đứng ở km đang chọn: lệnh vô nghĩa bị bỏ qua, không thêm bước")

        # ---- bài tới D
        E.start(tid, "deliver", "medium", SEED + 55)
        g = E.game()
        d = g["data"]
        D = d["D"]
        check(d["mode"] == "deliver" and pg.locator(".board-host .pz-cm-dest").count() == 1 and ("D · km %d" % D) in pg.inner_text(".board-host .pz-cm-dest").replace(" ", " ") and "ở km" in pg.inner_text(".board-host .pz-cm-goal") and d["best"] == deliver_disc(d["B"], d["C"], D),
              "bài 'chở tới D': vạch đích 'D · km %d' trên trục, mục tiêu nêu km %d; tối ưu engine = QHĐ Python (%d quả)" % (D, D, d["best"]))
        chunks, last = ui_apply_hint(pg, E)
        g = E.game()
        check(chunks >= 2 and last and last["action"]["k"] == "submit" and value_of(g) == d["best"], "làm bằng giao diện theo gợi ý: giá trị ở km %d = %d quả = tối ưu độc lập" % (D, d["best"]), (chunks, value_of(g), d["best"]))
        pg.click(".board-host .pz-cm-submit")
        pg.click(".board-host .pz-cm-ok")
        pg.wait_for_selector("dialog[open] h2:has-text('Đã giải')", timeout=10000)
        rec = pg.evaluate(JS_LASTREC)
        check(rec["grade"]["stars"] == 3 and rec["grade"]["value"] == d["best"] and "quả" in pg.inner_text("dialog[open] .stat-grid"), "nộp bài tới D: 3★, giá trị tính bằng 'quả'", rec["grade"])
        pg.keyboard.press("Escape")
        pg.wait_for_selector("dialog[open]", state="detached", timeout=5000)

        # ---- trình soạn
        pg.evaluate("location.hash = '#/create/camel'")
        pg.wait_for_selector(".pz-cm-ed", timeout=15000)
        pg.wait_for_function("document.querySelector('.cr-status .cr-chip')", timeout=20000)
        txt = pg.inner_text(".cr-status").replace(" ", " ")
        check("Tối ưu rời rạc: 1 533 km" in txt and "1 533 1/3" in txt, "trình soạn mặc định 3000/1000: vỏ báo 'Tối ưu rời rạc: 1 533 km (liên tục 1 533 1/3)'", txt)
        check("1 533 1/3" in pg.inner_text(".pz-cm-edinfo").replace(" ", " "), "dòng kết quả ngay trong trình soạn nêu cả liên tục và rời rạc")
        pg.click(".pz-cm-ed button:has-text('Gọn 45 / 15')")
        pg.wait_for_function("/23 km/.test(document.querySelector('.cr-status').innerText)", timeout=20000)
        check(pg.input_value(".pz-cm-ed input[aria-label^='Chuối ở kho']") == "45" and pg.input_value(".pz-cm-ed input[aria-label^='Sức chở']") == "15", "nút mẫu 'Gọn 45 / 15' điền B = 45, C = 15; vỏ báo 23 km")
        pg.click(".pz-cm-ed .chip:has-text('Chở tới đích D')")
        check(pg.locator(".pz-cm-ed input[aria-label^='Đích D']").count() == 1, "chọn 'Chở tới đích D': hiện ô nhập D")
        pg.fill(".pz-cm-ed input[aria-label^='Đích D']", "99999")
        pg.wait_for_function("/quá xa|ngoài|nguyên/.test(document.querySelector('.cr-status').innerText) || document.querySelector('.cr-status .cr-chip.bad')", timeout=20000)
        check(pg.is_disabled("button:has-text('Chơi thử')"), "D quá xa: vỏ báo lỗi, 'Chơi thử' bị khoá", pg.inner_text(".cr-status"))
        pg.fill(".pz-cm-ed input[aria-label^='Đích D']", "10")
        pg.wait_for_function("/Tối ưu rời rạc/.test(document.querySelector('.cr-status').innerText)", timeout=20000)
        check(not pg.is_disabled("button:has-text('Chơi thử')"), "D = 10: hợp lệ, 'Chơi thử' mở")
        pg.click("button:has-text('Chơi thử')")
        pg.wait_for_selector(".board-host .pz-cm-track", timeout=30000)
        g = E.game()
        ttl = pg.inner_text(".play-title h1")
        check(g["data"]["mode"] == "deliver" and g["data"]["B"] == 45 and g["data"]["C"] == 15 and g["data"]["D"] == 10 and "45 quả · chở 15 · tới km 10" in ttl.replace(" ", " "), "Chơi thử từ trình soạn: đề 45/15 tới km 10; tiêu đề tự giải thích cỡ", (g["data"], ttl))
        pg.evaluate("location.hash = '#/create/camel'")
        pg.wait_for_selector(".pz-cm-ed", timeout=15000)
        pg.focus(".pz-cm-ed .chip:has-text('Chở tới đích D')")
        pg.keyboard.press("Enter")
        fo = pg.evaluate(JS_FOCUS)
        check(not fo["inBody"] and fo["txt"].startswith("Chở tới đích D"), "trình soạn: Enter trên chip 'Chở tới đích D' (vẽ lại) — focus ở lại đúng chip", fo)
    finally:
        E.close()
        br.close()


# ---------------------------------------------------------------------------------------------- chạy trên trình duyệt của check.py
def run(P, check, section, tid):
    pg = P.pg
    br = pg.context.browser

    # ======================================================================= tương phản, co giãn, giảm chuyển động
    section("  — tương phản (sáng + tối), co giãn 360 px với bàn dài nhất, giảm chuyển động")
    P.start(tid, "far", "expert", SEED + 40)
    low = []
    for theme in ("light", "dark"):
        pg.evaluate("t => { document.documentElement.dataset.theme = t }", theme)
        for fg, bg, lab, need in (("--pz-cm-tag-ink", "--pz-cm-tag", "chữ thẻ tải", 4.5), ("--pz-cm-dest", "--elev", "nhãn đích D", 4.5), ("--pz-cm-hint", "--elev", "nhãn km gợi ý", 4.5), ("--text", "--elev", "chữ trên nền thẻ", 4.5),
                                  ("--accent-text", "--elev", "nhãn km đang chọn", 4.5), ("--pz-cm-depot", "--elev", "cột kho", 3), ("--pz-cm-tag-edge", "--pz-cm-tag", "viền thẻ tải", 3)):
            r = contrast(pg, fg, bg)
            if r < need:
                low.append("%s %s = %.2f" % (theme, lab, r))
    pg.evaluate("t => { document.documentElement.dataset.theme = t }", "light")
    check(not low, "tương phản --pz-cm-* ≥ 4,5:1 (chữ) / ≥ 3:1 (cột, viền) ở giao diện sáng và tối", low)

    ctx = br.new_context(viewport={"width": 280, "height": 740}, service_workers="block", reduced_motion="reduce")
    p2 = ctx.new_page()
    errs = []
    p2.on("pageerror", lambda e: errs.append(str(e)))
    p2.goto(P.url, wait_until="load")
    p2.wait_for_function("document.body.classList.contains('ready')", timeout=30000)
    for sz, tier, sd in (("far", "expert", SEED + 70), ("deliver", "expert", SEED + 71)):
        p2.evaluate("location.hash = '#/new/camel?size=%s&tier=%s&seed=%d&go=1'" % (sz, tier, sd))
        p2.wait_for_selector(".board-host .pz-cm-track", timeout=30000)
        p2.wait_for_timeout(300)
        # đổ đầy bản đồ bằng kế hoạch tối ưu (nhiều kho, nhiều dòng) rồi đo tràn ngang ở 280 px
        p2.evaluate("""() => { const c = Puz.ui.app.ctx(), id = decodeURIComponent(/#\\/play\\/([^?]+)/.exec(location.hash)[1]), g = c.getGame(id); let n = 0;
          while (g.status === 'playing' && n < 60) { const h = g.hint(3); if (!h || h.none || !h.action || h.action.k !== 'steps') break; g.applyHint(h); n++; } }""")
        p2.wait_for_timeout(250)
        m = p2.evaluate("""() => { const W = innerWidth, bad = []; for (const el of document.querySelectorAll('.board-host *')) { const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) bad.push((el.className && el.className.baseVal === undefined ? el.className : el.tagName) + ':' + Math.round(r.left) + '-' + Math.round(r.right)); }
          const tiny = [...document.querySelectorAll('.board-host button, .board-host input')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.height < 43.5); }).map(e => (e.className || e.tagName) + ':' + Math.round(e.getBoundingClientRect().height));
          return { bad: bad.slice(0, 5), tiny: tiny.slice(0, 5), sw: document.documentElement.scrollWidth, iw: innerWidth, steps: document.querySelectorAll('.board-host .pz-cm-step').length, depots: document.querySelectorAll('.board-host .pz-cm-depot').length }; }""")
        check(not m["bad"] and m["sw"] <= m["iw"] + 1 and not m["tiny"] and m["steps"] >= 5, "280 px, bài %s chuyên gia (%d dòng kế hoạch, %d kho): không phần tử nào ra ngoài khung, trang không tràn ngang, mọi nút/ô nhập cao ≥ 44 px" % (sz, m["steps"], m["depots"]), m)
        dur = p2.evaluate("getComputedStyle(document.querySelector('.board-host .pz-cm-camel')).transitionDuration")
        check(float(dur.split(",")[0].rstrip("s")) < 0.001, "prefers-reduced-motion: 🐪 không chuyển động (transition ≈ 0)", dur)
    p2.evaluate("location.hash = '#/create/camel'")
    p2.wait_for_selector(".pz-cm-ed", timeout=15000)
    p2.wait_for_timeout(400)
    ov = p2.evaluate("[document.documentElement.scrollWidth, innerWidth]")
    check(ov[0] <= ov[1] + 1, "280 px: trình soạn không tràn ngang", ov)
    check(not errs, "không lỗi JS ở ngữ cảnh 280 px + giảm chuyển động", errs)
    ctx.close()

    # ======================================================================= WebKit iPhone 13 (chạm thật)
    section("  — WebKit iPhone 13: chạm trục chọn km, Đầy, Lấy, Đi hết sức")
    box = {}
    th = threading.Thread(target=lambda: box.update(webkit_touch(P.url)))
    th.start()
    th.join(180)
    if box.get("err") and ("Executable doesn't exist" in box["err"] or "browserType.launch" in box["err"]):
        print("  (bỏ qua WebKit: %s)" % box["err"].splitlines()[0][:100])
    else:
        d = box.get("data") or {}
        C, B = d.get("C", 0), d.get("B", 0)
        check(box.get("ok") and box.get("tgt", -1) > 0 and box.get("goin") == str(box.get("tgt")) and box.get("after_load") == (0, min(B, C), C) and box.get("after_run") and box["after_run"][0] == min(B, C) and box["steps"] == 2
              and box["overflow"][0] <= box["overflow"][1] + 1 and not box.get("errs"),
              "iPhone 13 (WebKit): chạm trục giữa → km %s, chạm 'Đầy' + Lấy → chở %d, chạm 'Đi hết sức' → km %d; 2 dòng kế hoạch, không tràn ngang, không lỗi JS" % (box.get("tgt"), min(B, C), min(B, C)), box)

    edge_p4(P, check, section, tid)
