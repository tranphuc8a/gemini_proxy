# -*- coding: utf-8 -*-
"""Kiểm riêng của bàn CÂN ĐỒNG XU (assets/js/ui/boards/coinbalance.js + assets/css/board-coinbalance.css) bằng trình duyệt thật.

check.py nạp tệp này và gọi run(P, check, section, tid) sau vòng đời chung của mọi loại (xem tang_2). P là Page của check.py (P.pg = Playwright page).
Phần chạy trên Edge thật (channel="msedge", lùi về Chromium + in rõ nếu máy không có Edge) nằm ở edge_p3(): giải trọn ván bằng giao diện, replay chỉ-đọc, kết luận chưa chứng minh,
chế độ đối thủ, trang Puzzle mới (options), trình soạn.

Nguồn sự thật ĐỘC LẬP: kết quả cân được tính lại ở đây bằng so sánh KHỐI LƯỢNG (xu thật 100 g, giả nặng 101 g, giả nhẹ 99 g) từ xu giả cố định của đề (data.secret); bản ghi lần cân
được đọc thẳng từ state.v theo bố cục Puz.plan (viết lại bằng Python, không gọi engine); tập giả thuyết nhất quán (đối thủ) cũng dựng lại bằng vật lý."""

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


def weigh(L, R, coin, heavy):
    """1 trái nặng hơn · 2 cân bằng · 3 phải nặng hơn — so tổng khối lượng."""
    def w(j):
        return 100 if j != coin else (101 if heavy else 99)
    a, b = sum(w(j) for j in L), sum(w(j) for j in R)
    return 1 if a > b else 2 if a == b else 3


def records(g):
    """Bản ghi các lần cân đọc từ state.v theo bố cục Puz.plan: v = [nộp, len, p0, p1, rec…], rec = [đĩa xu 0…C−1, kết quả]."""
    d = g["data"]
    C = d["n"] + d["ref"]
    W = C + 1
    v = g["v"]
    out = []
    for i in range(v[1]):
        r = v[4 + i * W: 4 + (i + 1) * W]
        out.append(([j for j in range(C) if r[j] == 1], [j for j in range(C) if r[j] == 2], r[C]))
    return out


def conclusion(g):
    v = g["v"]
    return (v[2] - 1, v[3]) if v[0] else None


def consistent(g):
    """Mọi giả thuyết (xu, nặng?) khớp MỌI lần cân đã ghi — theo vật lý."""
    d = g["data"]
    out = []
    for c in range(d["n"]):
        for heavy in ([True] if d["fake"] == "heavy" else [True, False]):
            if all(weigh(L, R, c, heavy) == res for L, R, res in records(g)):
                out.append((c, heavy))
    return out


JS_SETTINGS = "() => Puz.ui.app.ctx().settings()"
JS_HINT = """() => {
  const id = decodeURIComponent(/#\\/play\\/([^?]+)/.exec(location.hash)[1]), g = Puz.ui.app.ctx().getGame(id), T = g.type;
  return T.hint(g.puzzle, g.state, 3, g.settings());
}"""
JS_FOCUS = """() => { const a = document.activeElement; return { tag: a.tagName, cls: a.className, txt: (a.textContent || '').trim(), pressed: a.getAttribute('aria-pressed'), label: a.getAttribute('aria-label'), i: a.dataset ? (a.dataset.i || null) : null, inBody: a === document.body }; }"""
JS_HUD = """() => [...document.querySelectorAll('.hud-chip')].map(c => ({ title: c.title, val: c.lastChild ? c.lastChild.textContent : '' }))"""
JS_DUP = """() => {
  const c = Puz.ui.app.ctx(), id = decodeURIComponent(/#\\/play\\/([^?]+)/.exec(location.hash)[1]), g = c.getGame(id), hosts = [], views = [];
  for (let k = 0; k < 2; k++) { const h = document.createElement('div'); document.body.append(h); hosts.push(h); views.push(Puz.boards.coinbalance.mount(h, { game: g, puzzle: g.puzzle, type: g.type, U: Puz.ui, readOnly: false, settings: c.settings, announce: () => {}, clearHint: () => {} })); }
  const ids = hosts.map(h => h.querySelector('.pz-cb-weigh').getAttribute('aria-describedby')), own = hosts.map((h, i) => { const e = document.getElementById(ids[i]); return !!e && h.contains(e); });
  views.forEach(v => v.destroy()); hosts.forEach(h => h.remove());
  return { ids: ids, own: own };
}"""
JS_LASTREC = "() => { const r = Puz.ui.app.ctx().user.history().filter(x => x.type === 'coinbalance'); return r.length ? r[r.length - 1] : null; }"


def coin(i):
    return ".board-host .pz-cb-coin[data-i='%d']" % i


def beam_angle(pg):
    """Góc quay (độ) của đòn cân đọc từ ma trận transform THỰC TẾ (âm = trái hạ xuống)."""
    return pg.evaluate("""() => { const m = new DOMMatrix(getComputedStyle(document.querySelector('.board-host .pz-cb-beam')).transform); return Math.round(Math.atan2(m.b, m.a) * 180 / Math.PI * 10) / 10; }""")


def stat_text(pg):
    return pg.inner_text(".board-host .pz-cb-budget").replace("\n", " ").strip()


def setup(pg, L, R):
    """Đặt xu lên đĩa bằng chạm: chọn đích rồi chạm từng xu."""
    pg.click(".board-host .pz-cb-target .chip:has-text('Trái')")
    for i in L:
        pg.click(coin(i))
    pg.click(".board-host .pz-cb-target .chip:has-text('Phải')")
    for i in R:
        pg.click(coin(i))


def ui_weigh(pg, L, R):
    setup(pg, L, R)
    pg.click(".board-host .pz-cb-weigh")
    pg.wait_for_timeout(60)


def ui_conclude(pg, c, heavy=None):
    pg.click(".board-host .pz-cb-open")
    pg.click(".board-host .pz-cb-cbtn[data-i='%d']" % c)
    if heavy is not None and pg.locator(".board-host .pz-cb-cdir .chip").count():
        pg.click(".board-host .pz-cb-cdir .chip:has-text('%s')" % ("Nặng hơn" if heavy else "Nhẹ hơn"))
    pg.click(".board-host .pz-cb-cok")
    pg.wait_for_timeout(120)


def webkit_touch(url):
    """Luồng riêng (Playwright đồng bộ không lồng được): WebKit + iPhone 13, CHẠM thật: đặt xu, Cân, kết luận."""
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
            pg.evaluate("location.hash = '#/new/coinbalance?size=nn3&tier=easy&seed=%d&go=1'" % (SEED + 81))
            pg.wait_for_selector(".board-host .pz-cb-coin", timeout=30000)
            pg.wait_for_timeout(300)
            pg.tap(".board-host .pz-cb-target .chip:has-text('Trái')")
            for i in (0, 1):
                pg.tap(coin(i))
            pg.tap(".board-host .pz-cb-target .chip:has-text('Phải')")
            for i in (2, 3):
                pg.tap(coin(i))
            out["placed"] = pg.evaluate("[document.querySelectorAll('.board-host .pz-cb-coin.on-l').length, document.querySelectorAll('.board-host .pz-cb-coin.on-r').length]")
            pg.tap(".board-host .pz-cb-weigh")
            pg.wait_for_timeout(300)
            out["log"] = pg.locator(".board-host .pz-cb-logrow").count()
            out["budget"] = pg.inner_text(".board-host .pz-cb-budget").replace("\n", " ")
            out["overflow"] = pg.evaluate("[document.documentElement.scrollWidth, innerWidth]")
            out["errs"] = errs
            out["ok"] = True
            br.close()
    except Exception as e:  # noqa: BLE001
        out["err"] = "%s: %s" % (type(e).__name__, e)
    return out


# ---------------------------------------------------------------------------------------------- Edge: giải trọn bằng giao diện, replay, đối thủ, Puzzle mới, trình soạn
def edge_p3(P, check, section, tid):
    PageCls = type(P)
    bt = P.pg.context.browser.browser_type
    try:
        br, kenh = bt.launch(channel="msedge"), "Edge"
    except Exception as e:  # noqa: BLE001
        br, kenh = bt.launch(), "Chromium (không mở được Edge: %s)" % str(e).splitlines()[0][:80]
    section("  — đợt P3 trên %s: giải trọn bằng giao diện, replay chỉ-đọc, kết luận chưa chứng minh, đối thủ, Puzzle mới, trình soạn" % kenh)
    E = PageCls(br, P.url, "cb-p3", viewport={"width": 1280, "height": 1000})
    pg = E.pg
    try:
        # ---- giải trọn bằng giao diện (cố định): mỗi phép cân của chiến lược tối ưu (đọc từ hint của engine, KHÔNG tính vào bộ đếm) làm lại bằng CHẠM thật
        E.start(tid, "nn3", "medium", SEED + 61)
        g = E.game()
        d = g["data"]
        secret = d["secret"]
        n_steps = 0
        for _ in range(6):
            h = pg.evaluate(JS_HINT)
            if h.get("none") or not h.get("action"):
                break
            a = h["action"]
            if a["k"] == "weigh":
                ui_weigh(pg, a["L"], a["R"])
                cur = E.game()
                L, R, res = records(cur)[-1]
                check(L == a["L"] and R == a["R"] and res == weigh(L, R, secret["coin"], bool(secret["heavy"])),
                      "lần cân %d làm bằng chạm: bản ghi đúng hai tập xu và kết quả = so khối lượng độc lập (%s)" % (len(records(cur)), res), (L, R, res))
                n_steps += 1
            else:
                check(a["k"] == "conclude", "bước cuối của chiến lược là kết luận", a)
                ui_conclude(pg, a["coin"], a.get("heavy"))
                break
        pg.wait_for_selector("dialog[open] h2:has-text('Đã giải')", timeout=10000)
        rec = pg.evaluate(JS_LASTREC)
        check(rec and rec["result"] == "solved" and rec["grade"]["stars"] == 3 and rec["grade"]["value"] == n_steps and rec["mistakes"] == 0,
              "giải xong bằng giao diện: lịch sử 'solved', grade 3★ (không hoàn tác, không gợi ý mức 3, 0 lần cân mất an toàn), value = %d lần cân" % n_steps, rec and rec.get("grade"))
        stats = pg.inner_text("dialog[open] .stat-grid")
        check("Điểm tối ưu" in stats and "★★★" in stats and "Tối ưu" in pg.inner_text("dialog[open]"), "hộp thoại 'Đã giải' có ô 'Điểm tối ưu' ★★★ và dòng 'Tối ưu…'", stats.replace("\n", " "))
        hud = pg.evaluate(JS_HUD)
        mv = [x for x in hud if x["title"].startswith("Số thao tác")]
        ms = [x for x in hud if x["title"].startswith("Sai sót")]
        check(len(mv) == 1 and len(ms) == 1 and not any(x["title"].startswith(("Số lần cân", "Lần cân mất an toàn")) for x in hud),
              "HUD: chip đếm tên 'Số thao tác…', chip lỗi tên 'Sai sót…' — không còn chip 'Số lần cân' đứng cạnh dòng 'Còn r / k lần cân'", [x["title"] for x in hud])
        check(bool(mv) and mv[0]["val"] == str(n_steps + 1) and E.game()["moves"] == n_steps + 1,
              "chip 'Số thao tác' = %d (các lần cân + kết luận) = bộ đếm của vỏ: có thể lớn hơn ngân sách %d lần cân mà KHÔNG mâu thuẫn vì nhãn là thao tác" % (n_steps + 1, d["k"]), (mv, n_steps))
        # kết luận của ván khớp xu giả thật (độc lập)
        done = E.game()
        c = conclusion(done)
        check(c is not None and c[0] == secret["coin"] and c[1] == (1 if secret["heavy"] else 2), "kết luận trong state = xu giả cố định của đề, đúng hướng (so với data.secret)", (c, secret))

        # ---- replay chỉ-đọc
        pg.click("dialog[open] button:has-text('Xem lời giải từng bước')")
        pg.wait_for_selector(".replay-panel:not([hidden])", timeout=20000)
        total = int(pg.inner_text(".rp-count").split("/")[1])
        check(total == n_steps + 1, "replay có đúng %d bước (số lần cân + kết luận)" % (n_steps + 1), total)
        check(pg.locator(".board-host .pz-cb-weigh").count() == 0 and pg.locator(".board-host .pz-cb-target").count() == 0, "bàn chỉ-đọc trong replay: không có nút Cân / chọn đĩa")
        pg.click(".board-host .pz-cb-coin >> nth=0")
        check(pg.locator(".board-host .pz-cb-coin.on-l, .board-host .pz-cb-coin.on-r").count() == 0, "chạm xu trong replay không đặt được xu lên đĩa")
        pg.click(".replay-panel button:has-text('Sau')")
        check(pg.locator(".board-host .pz-cb-logrow").count() == 1 and pg.locator(".board-host .pz-cb-coin.replay").count() >= 2, "replay bước 1: nhật ký có 1 lần cân, các xu của lần cân được tô 'replay'")
        pg.click(".replay-panel button[aria-label='Tới cuối']")
        check(pg.locator(".board-host .pz-cb-logend.is-ok").count() == 1 and "✓ đã được chứng minh" in pg.inner_text(".board-host .pz-cb-logend"), "replay cuối: dòng 'Kết luận … ✓ đã được chứng minh'")
        pg.click(".replay-panel button[aria-label='Về đầu']")
        check(pg.locator(".board-host .pz-cb-logrow").count() == 0 and "Chưa có lần cân nào" in pg.inner_text(".board-host .pz-cb-log"), "replay về đầu: nhật ký trống ('Chưa có lần cân nào.')")
        pg.click(".replay-panel button:has-text('Thoát replay')")

        # ---- kết luận chưa chứng minh → mở lại; hết lượt; hoàn tác
        E.start(tid, "nn3", "easy", SEED + 62)
        g = E.game()
        pg.click(".board-host .pz-cb-open")
        check(pg.locator(".board-host .pz-cb-concl:not([hidden])").count() == 1 and pg.locator(".board-host .pz-cb-cbtn").count() == g["data"]["n"] and pg.locator(".board-host .pz-cb-cdir .chip").count() == 2,
              "'Kết luận…' mở bảng chọn xu (%d xu) + nặng/nhẹ" % g["data"]["n"])
        check(pg.is_disabled(".board-host .pz-cb-cok"), "'Chốt kết luận' bị vô hiệu cho tới khi chọn xu và hướng")
        pg.keyboard.press("Escape")
        check(pg.locator(".board-host .pz-cb-concl:not([hidden])").count() == 0, "phím Escape đóng bảng kết luận")
        ui_conclude(pg, 0, True)
        g = E.game()
        check(g["status"] == "playing" and g["mistakes"] == 1 and pg.locator(".board-host .pz-cb-reopen:not([hidden])").count() == 1 and "chưa được chứng minh" in pg.inner_text(".board-host .pz-cb-reopen"),
              "kết luận khi chưa cân gì: ván VẪN chơi tiếp (không tính giải, dù đoán đúng nhờ may), +1 lỗi, hiện khung 'chưa được chứng minh' + nút mở lại", (g["status"], g["mistakes"]))
        check(pg.is_disabled(".board-host .pz-cb-weigh") and "Đã kết luận" in pg.inner_text(".board-host .pz-cb-reason"), "đã kết luận: nút Cân bị vô hiệu kèm lý do 'Đã kết luận…'")
        pg.click(".board-host .pz-cb-reopenbtn")
        g = E.game()
        check(g["v"][0] == 0 and pg.locator(".board-host .pz-cb-reopen:not([hidden])").count() == 0 and not pg.is_disabled(".board-host .pz-cb-open"), "'Mở lại để cân tiếp': xoá cờ kết luận, cân và kết luận lại được")
        for _ in range(3):
            ui_weigh(pg, [0], [1])
        check(stat_text(pg).startswith("Còn 0 / 3") and pg.is_disabled(".board-host .pz-cb-weigh") and "Hết lượt cân" in pg.inner_text(".board-host .pz-cb-reason"),
              "dùng hết 3 lần cân: 'Còn 0 / 3 lần cân', nút Cân vô hiệu, lý do 'Hết lượt cân — hãy kết luận.'", (stat_text(pg), pg.inner_text(".board-host .pz-cb-reason")))
        setup(pg, [2], [3])
        check(pg.is_disabled(".board-host .pz-cb-weigh"), "hết lượt: đặt xu cũng không cân được")
        g = E.game()
        check(g["mistakes"] >= 2, "cân 1–1 ba lần (mất an toàn) bị tính là 'lần cân mất an toàn' (đếm lỗi %d)" % g["mistakes"], g["mistakes"])
        pg.click(".toolbar button:has-text('Hoàn tác')")
        g = E.game()
        check(len(records(g)) == 2 and stat_text(pg).startswith("Còn 1 / 3") and pg.locator(".board-host .pz-cb-logrow").count() == 2, "Hoàn tác lần cân cuối: nhật ký còn 2 lần, 'Còn 1 / 3'")
        check(pg.locator(".board-host .pz-cb-coin.on-l, .board-host .pz-cb-coin.on-r").count() == 0, "hoàn tác xoá phần xu đang đặt dở trên đĩa")

        # ---- id duy nhất của dòng lý do: hai bàn cùng mount không trùng id, mỗi nút Cân trỏ về dòng lý do của CHÍNH bàn đó
        E.start(tid, "nn3", "easy", SEED + 65)
        n_c = E.game()["data"]["n"]
        dup = pg.evaluate(JS_DUP)
        check(dup["ids"][0] != dup["ids"][1] and dup["own"] == [True, True] and "pz-cb-reason" not in dup["ids"],
              "hai bàn cùng mount: id dòng lý do khác nhau và mỗi aria-describedby trỏ vào CHÍNH bàn của nó (trước đây cố định id='pz-cb-reason')", dup)

        # ---- bàn phím: focus KHÔNG rơi về BODY sau khi kích hoạt chip 'Đặt vào' và chọn xu trong bảng Kết luận; lưới Kết luận có roving tabindex + mũi tên
        pg.focus(".board-host .pz-cb-target .chip:has-text('Phải')")
        pg.keyboard.press("Enter")
        fo = pg.evaluate(JS_FOCUS)
        check(not fo["inBody"] and fo["tag"] == "BUTTON" and fo["txt"].startswith("Phải") and fo["pressed"] == "true",
              "chip 'Đặt vào: Phải' kích hoạt bằng Enter: focus ở lại đúng chip (đang bật), không rơi về BODY", fo)
        pg.keyboard.press("Tab")
        pg.keyboard.press(" ")
        fo = pg.evaluate(JS_FOCUS)
        check(not fo["inBody"] and fo["txt"].startswith("Ngoài") and fo["pressed"] == "true", "Tab → chip 'Ngoài', Space: vẫn focus đúng chip", fo)
        pg.focus(".board-host .pz-cb-open")
        pg.keyboard.press("Enter")
        fo = pg.evaluate(JS_FOCUS)
        check("pz-cb-cbtn" in fo["cls"] and fo["i"] == "0", "mở 'Kết luận…' bằng bàn phím: focus vào xu 1 của lưới chọn", fo)
        check(pg.locator(".board-host .pz-cb-cgrid button[tabindex='0']").count() == 1, "lưới chọn xu giả chỉ MỘT điểm dừng Tab (roving tabindex) — không phải %d lần Tab để tới xu cuối" % n_c)
        pg.keyboard.press("ArrowRight")
        check(pg.evaluate(JS_FOCUS)["i"] == "1", "mũi tên phải: focus sang xu 2")
        pg.keyboard.press("End")
        check(pg.evaluate(JS_FOCUS)["i"] == str(n_c - 1), "End: focus tới xu cuối (%d)" % n_c)
        pg.keyboard.press("Home")
        pg.keyboard.press("ArrowDown")
        cc = pg.evaluate("(() => { const b = [...document.querySelectorAll('.board-host .pz-cb-cgrid .pz-cb-cbtn')], t = b[0].offsetTop; let c = 0; while (c < b.length && Math.abs(b[c].offsetTop - t) < 3) c++; return c; })()")
        check(pg.evaluate(JS_FOCUS)["i"] == str(min(n_c - 1, cc)), "mũi tên xuống: xuống đúng một hàng (%d cột)" % cc, (pg.evaluate(JS_FOCUS)["i"], cc))
        pg.keyboard.press("Home")
        pg.keyboard.press("ArrowRight")
        pg.keyboard.press("ArrowRight")
        pg.keyboard.press(" ")
        fo = pg.evaluate(JS_FOCUS)
        check(not fo["inBody"] and fo["i"] == "2" and fo["pressed"] == "true", "Space chọn xu 3: focus ở lại đúng xu (chọn cập nhật tại chỗ, không vẽ lại lưới)", fo)
        pg.keyboard.press("Tab")
        pg.keyboard.press("Enter")
        fo = pg.evaluate(JS_FOCUS)
        check(not fo["inBody"] and fo["txt"].startswith("Nặng hơn") and fo["pressed"] == "true", "Tab ra khỏi lưới tới chip 'Nặng hơn', Enter: focus ở lại chip (không về BODY)", fo)
        check(not pg.is_disabled(".board-host .pz-cb-cok"), "đã chọn xu và hướng: 'Chốt kết luận' mở")
        pg.keyboard.press("Escape")
        fo = pg.evaluate(JS_FOCUS)
        check("pz-cb-open" in fo["cls"], "Escape đóng bảng và trả focus về nút 'Kết luận…'", fo)

        # ---- cùng mẫu lỗi: nút vừa bấm tự vô hiệu / ẩn / bị gỡ (Xoá đĩa, Cân, Chốt kết luận, Mở lại) — focus phải sang việc kế tiếp, không rơi về BODY
        pg.focus(coin(0))
        pg.keyboard.press("l")
        pg.keyboard.press("ArrowRight")
        pg.keyboard.press("r")
        pg.focus(".board-host .pz-cb-clear")
        pg.keyboard.press("Enter")
        fo = pg.evaluate(JS_FOCUS)
        check(pg.is_disabled(".board-host .pz-cb-clear") and not fo["inBody"] and "pz-cb-coin" in fo["cls"], "'Xoá đĩa' bằng Enter (nút tự vô hiệu vì đĩa đã trống): focus về khay xu, không rơi về BODY", fo)
        pg.keyboard.press("l")
        pg.keyboard.press("ArrowRight")
        pg.keyboard.press("r")
        pg.focus(".board-host .pz-cb-weigh")
        pg.keyboard.press("Enter")
        fo = pg.evaluate(JS_FOCUS)
        check(len(records(E.game())) == 1 and pg.is_disabled(".board-host .pz-cb-weigh") and not fo["inBody"] and "pz-cb-coin" in fo["cls"], "'Cân' bằng Enter (đĩa được xoá, nút tự vô hiệu): focus về khay xu, không rơi về BODY", fo)
        pg.focus(".board-host .pz-cb-open")
        pg.keyboard.press("Enter")
        pg.keyboard.press(" ")
        pg.keyboard.press("Tab")
        pg.keyboard.press("Enter")
        pg.focus(".board-host .pz-cb-cok")
        pg.keyboard.press("Enter")
        fo = pg.evaluate(JS_FOCUS)
        check(pg.locator(".board-host .pz-cb-reopen:not([hidden])").count() == 1 and not fo["inBody"] and "pz-cb-reopenbtn" in fo["cls"], "'Chốt kết luận' (chưa chứng minh) bằng Enter: bảng đóng, focus sang nút 'Mở lại để cân tiếp'", fo)
        pg.keyboard.press("Enter")
        fo = pg.evaluate(JS_FOCUS)
        check(pg.locator(".board-host .pz-cb-reopen:not([hidden])").count() == 0 and not fo["inBody"] and "pz-cb-coin" in fo["cls"], "'Mở lại để cân tiếp' bằng Enter (khung bị gỡ): focus về khay xu, không rơi về BODY", fo)

        # ---- chế độ đối thủ qua liên kết seed o=
        pg.evaluate("location.hash = '#/new/coinbalance?size=nn3&tier=expert&seed=%d&o=mode:adv&go=1'" % (SEED + 63))
        pg.wait_for_selector(".board-host .pz-cb-coin", timeout=30000)
        pg.wait_for_function("/#\\/play\\//.test(location.hash)", timeout=30000)
        g = E.game()
        check(g["data"]["mode"] == "adv" and g["data"]["secret"] is None and "Đối thủ thích nghi" in pg.inner_text(".board-host .pz-cb-mode"),
              "liên kết có o=mode:adv → ván đối thủ: không có xu giả định sẵn, chip 'Đối thủ thích nghi'", (g["data"]["mode"], g["data"]["secret"]))
        ui_weigh(pg, [0, 1, 2, 3, 4], [5, 6, 7, 8, 9])                  # lần cân KHÔNG an toàn (5 với 5)
        g = E.game()
        L, R, res = records(g)[-1]
        check(g["mistakes"] == 1 and len(consistent(g)) >= 1, "5 với 5 (mất an toàn): +1 lỗi; kết quả đối thủ vẫn nhất quán với ≥ 1 giả thuyết vật lý (%d)" % len(consistent(g)), (g["mistakes"], consistent(g)))
        pg.click(".toolbar button:has-text('Gợi ý')")
        pg.wait_for_selector(".hint-panel:not([hidden]) .hint-text")
        check("không còn cách cân nào chắc chắn" in pg.inner_text(".hint-panel .hint-text"), "gợi ý mức 1 nói thế đã mất an toàn", pg.inner_text(".hint-panel .hint-text"))
        pg.click(".hint-panel button:has-text('Chi tiết hơn')")
        pg.click(".hint-panel button:has-text('Chi tiết hơn')")
        check("Quay về trước lần cân thứ 1" in pg.inner_text(".hint-panel .hint-text") and pg.locator(".hint-panel .why li").count() >= 1 and pg.locator(".hint-panel button:has-text('Áp dụng nước này')").count() == 1,
              "gợi ý mức 3: 'Quay về trước lần cân thứ 1' + giải thích + nút áp dụng (truncate)")
        # đi tiếp tới hết lượt rồi kết luận mọi cách: đối thủ giữ ≥ 2 khả năng ⇒ KHÔNG BAO GIỜ giải
        ui_weigh(pg, [0], [1])
        ui_weigh(pg, [2], [3])
        g = E.game()
        cons = consistent(g)
        coins = set(c for c, _ in cons)
        check(len(cons) >= 2 and len(records(g)) == 3, "thế đã mất: sau hết lượt vẫn còn ≥ 2 giả thuyết (%d, %d xu) — đối thủ không để lọt" % (len(cons), len(coins)), cons)
        ui_conclude(pg, sorted(coins)[0], cons[0][1])
        g = E.game()
        check(g["status"] == "playing" and pg.locator(".board-host .pz-cb-reopen:not([hidden])").count() == 1, "đối thủ: kết luận bất kỳ cũng KHÔNG tính giải (còn ≥ 2 khả năng)", g["status"])
        pg.click(".toolbar button:has-text('Hoàn tác')")
        pg.click(".toolbar button:has-text('Hoàn tác')")
        pg.click(".toolbar button:has-text('Hoàn tác')")
        pg.click(".toolbar button:has-text('Hoàn tác')")
        g = E.game()
        check(len(records(g)) == 0 and g["v"][0] == 0 and stat_text(pg).startswith("Còn 3 / 3"), "hoàn tác về đầu ván đối thủ: nhật ký trống, 'Còn 3 / 3'")
        # giải thật bằng gợi ý ở chế độ đối thủ
        res = pg.evaluate("""() => { const c = Puz.ui.app.ctx(), id = decodeURIComponent(/#\\/play\\/([^?]+)/.exec(location.hash)[1]), g = c.getGame(id); let n = 0;
          while (g.status === 'playing' && n < 12) { const h = g.hint(3); if (!h || h.none || !h.action) return { n: -1 }; const r = g.applyHint(h); if (!r.ok) return { n: -2 }; n++; }
          return { n: n, status: g.status }; }""")
        check(res["status"] == "solved" and res["n"] <= 4, "đối thủ nhất quán: lặp gợi ý mức 3 vẫn giải xong ván trong ≤ 4 bước (%s)" % res, res)
        # hộp thoại 'Đã giải' mở BẤT ĐỒNG BỘ (sau khi ghi lịch sử): phải CHỜ nó hiện rồi mới đóng — Escape + chờ 200 ms cố định thua khi máy bận (hộp thoại mở sau đó, che 'Puzzle mới')
        pg.wait_for_selector("dialog[open] h2:has-text('Đã giải')", timeout=15000)
        pg.keyboard.press("Escape")
        pg.wait_for_selector("dialog[open]", state="detached", timeout=5000)

        # ---- trang Puzzle mới: phiên bản + options + liên kết seed
        pg.evaluate("location.hash = '#/new/coinbalance'")
        pg.wait_for_selector(".ng-opt", timeout=15000)
        sizes = pg.evaluate("[...document.querySelectorAll('.set .field')].filter(f => /Phiên bản/.test(f.querySelector('label').textContent))[0].querySelectorAll('.chip').length")
        check(sizes == 6 and pg.locator(".ng-opt .chip").count() == 2 and pg.locator(".ng-opt label").first.inner_text() == "Chế độ", "Puzzle mới: nhãn 'Phiên bản' với 6 chip + hàng 'Chế độ' 2 chip", sizes)
        check("Puzzle tương tác" in pg.inner_text(".ng-kind"), "ghi chú loại 'Puzzle tương tác…' ở Puzzle mới")
        pg.click(".ng-opt .chip:has-text('Đối thủ thích nghi')")
        check("đối thủ chọn kết quả khó nhất" in pg.inner_text(".ng-opt .hint"), "chọn 'Đối thủ thích nghi' hiện ghi chú của lựa chọn")
        pg.fill("#ng-seed", str(SEED + 64))
        pg.click("button:has-text('Bắt đầu')")
        pg.wait_for_selector(".board-host .pz-cb-coin", timeout=30000)
        g = E.game()
        url = pg.evaluate("Puz.ui.pz.seedHash(Puz.ui.app.ctx().getGame(decodeURIComponent(/#\\/play\\/([^?]+)/.exec(location.hash)[1])).puzzle)")
        check(g["data"]["mode"] == "adv" and "o=mode%3Aadv" in url and "size=nn3" in url, "bắt đầu từ Puzzle mới với 'Đối thủ thích nghi' → ván adv; liên kết seed có o=mode:adv", url)

        # ---- trình soạn
        pg.evaluate("location.hash = '#/create/coinbalance'")
        pg.wait_for_selector(".pz-cb-ed", timeout=15000)
        pg.wait_for_function("document.querySelector('.cr-status .cr-chip')", timeout=20000)
        txt = pg.inner_text(".cr-status")
        check("✓ Có chiến lược chắc chắn trong 3 lần cân" in txt and pg.locator(".pz-cb-ed .pz-cb-cbtn").count() == 12, "trình soạn mặc định: 12 xu, 3 lần, có 12 nút chọn xu giả; vỏ báo '✓ Có chiến lược chắc chắn trong 3 lần cân'", txt)
        check("Tối đa có chiến lược chắc chắn với cấu hình này: 12 xu" in pg.inner_text(".pz-cb-ed"), "trình soạn nói giới hạn 'tối đa 12 xu' cho cấu hình hiện tại")
        pg.click(".pz-cb-ed .pz-cb-step[aria-label='Tăng số xu']")
        pg.wait_for_function("document.querySelector('.cr-status') && /không có chiến lược chắc chắn/.test(document.querySelector('.cr-status').innerText)", timeout=20000)
        check(pg.is_disabled("button:has-text('Chơi thử')") and "tối đa 12 xu" in pg.inner_text(".cr-status"), "13 xu / 3 lần: vỏ báo KHÔNG có chiến lược (giới hạn Dyson, tối đa 12 xu), 'Chơi thử' bị khoá")
        pg.click(".pz-cb-ed .chip:has-text('Có')")
        pg.wait_for_function("document.querySelector('.cr-status') && /Có chiến lược chắc chắn/.test(document.querySelector('.cr-status').innerText)", timeout=20000)
        check(not pg.is_disabled("button:has-text('Chơi thử')"), "thêm xu chuẩn: 13 xu / 3 lần giải được, 'Chơi thử' mở")
        pg.click(".pz-cb-ed .pz-cb-cbtn[aria-label='Xu 7']")
        pg.click(".pz-cb-ed .chip:has-text('Nhẹ hơn')")
        pg.click("button:has-text('Chơi thử')")
        pg.wait_for_selector(".board-host .pz-cb-coin", timeout=30000)
        g = E.game()
        check(g["data"]["n"] == 13 and g["data"]["ref"] == 1 and g["data"]["secret"] == {"coin": 6, "heavy": 0} and pg.locator(".board-host .pz-cb-coin.is-ref").count() == 1,
              "Chơi thử từ trình soạn: 13 xu + xu chuẩn, xu giả cố định = xu 7 nhẹ hơn; khay có 1 xu chuẩn", g["data"])
        ttl = pg.inner_text(".play-title h1")
        check("13 xu + chuẩn · 3 lần cân" in ttl and "13×3" not in ttl, "tiêu đề đề tự nhập tự giải thích cỡ: '13 xu + chuẩn · 3 lần cân' (không phải '13×3')", ttl)
        pg.evaluate("location.hash = '#/create/coinbalance'")
        pg.wait_for_selector(".pz-cb-ed", timeout=15000)
        # trình soạn: vẽ lại sau mỗi chip/nút nhưng focus ở lại đúng điều khiển vừa bấm
        pg.focus(".pz-cb-ed .chip:has-text('Nặng hoặc nhẹ')")
        pg.keyboard.press("Enter")
        fo = pg.evaluate(JS_FOCUS)
        check(not fo["inBody"] and fo["txt"].startswith("Nặng hoặc nhẹ") and fo["pressed"] == "true", "trình soạn: Enter trên chip 'Nặng hoặc nhẹ' — focus ở lại đúng chip sau khi vẽ lại", fo)
        pg.focus(".pz-cb-ed .pz-cb-step[aria-label='Tăng số xu']")
        pg.keyboard.press("Enter")
        fo = pg.evaluate(JS_FOCUS)
        check(not fo["inBody"] and fo["label"] == "Tăng số xu", "trình soạn: Enter trên nút '+' (số xu) — focus ở lại nút '+'", fo)
        pg.focus(".pz-cb-ed .chip:has-text('Đối thủ thích nghi')")
        pg.keyboard.press("Enter")
        fo = pg.evaluate(JS_FOCUS)
        check(not fo["inBody"] and fo["txt"].startswith("Đối thủ thích nghi") and fo["pressed"] == "true" and pg.locator(".pz-cb-ed .pz-cb-cbtn").count() == 0,
              "trình soạn: đổi sang 'Đối thủ thích nghi' (vùng chọn xu giả biến mất) — focus ở lại chip", fo)
        pg.click(".pz-cb-ed .chip:has-text('Đối thủ thích nghi')")
        check(pg.locator(".pz-cb-ed .pz-cb-cbtn").count() == 0, "chế độ đối thủ: ẩn phần chọn xu giả cố định")
        pg.click(".pz-cb-ed .chip:has-text('Nặng hơn (biết trước)')")
        check(pg.locator(".pz-cb-ed .chip:has-text('Có — nói cả hướng')").count() == 0, "biết xu giả nặng hơn: ẩn câu hỏi 'Phải nói nặng hay nhẹ?'")
    finally:
        E.close()
        br.close()


# ---------------------------------------------------------------------------------------------- chạy trên trình duyệt của check.py
def run(P, check, section, tid):
    pg = P.pg
    PageCls = type(P)
    br = pg.context.browser

    # ======================================================================= vẽ bàn
    section("  — bàn chơi: vẽ đúng theo state")
    P.start(tid, "nn3", "medium", SEED + 40)
    g = P.game()
    d = g["data"]
    n = d["n"]
    check(pg.locator(".board-host .pz-cb-coin").count() == n and d["k"] == 3 and d["mode"] == "fixed", "bàn %d xu vẽ đúng %d nút xu (nn3, 3 lần, cố định)" % (n, n), (pg.locator(".board-host .pz-cb-coin").count(), n))
    check(stat_text(pg) == "Còn 3 / 3 lần cân" and "Xu giả cố định" in pg.inner_text(".board-host .pz-cb-mode") and pg.inner_text(".board-host .pz-cb-stats").count("xu") >= 1, "thông số: 'Còn 3 / 3 lần cân', chế độ 'Xu giả cố định'", stat_text(pg))
    labels = pg.evaluate("[...document.querySelectorAll('.board-host .pz-cb-coin')].map(c => c.getAttribute('aria-label'))")
    check(all(labels[i] == "Xu %d, chưa cân lần nào" % (i + 1) for i in range(n)), "aria-label mỗi xu từ type.describeCell ('Xu i, chưa cân lần nào')", labels[:2])
    check(pg.get_attribute(".board-host .pz-cb-scale", "role") == "img" and pg.get_attribute(".board-host .pz-cb-scale", "aria-label").startswith("Cân đòn. Chưa cân lần nào") and beam_angle(pg) == 0,
          "cân đòn: role=img, nhãn đọc màn hình, đòn nằm ngang khi chưa cân")
    check(pg.get_attribute(".board-host .pz-cb-tray", "role") == "group" and pg.locator(".board-host .pz-cb-coin[tabindex='0']").count() == 1, "khay xu role=group, đúng 1 xu có tabindex 0 (roving)")
    check(pg.is_disabled(".board-host .pz-cb-weigh") and "Đặt xu lên hai đĩa rồi bấm Cân." in pg.inner_text(".board-host .pz-cb-reason"), "chưa đặt xu: nút Cân vô hiệu kèm lý do 'Đặt xu lên hai đĩa rồi bấm Cân.'")

    # ======================================================================= đặt xu, lý do vô hiệu, xoá đĩa
    section("  — đặt xu lên đĩa: chạm, lý do vô hiệu, xoá đĩa")
    pg.click(".board-host .pz-cb-target .chip:has-text('Trái')")
    for i in (0, 1, 2):
        pg.click(coin(i))
    pg.click(".board-host .pz-cb-target .chip:has-text('Phải')")
    for i in (3, 4, 5, 6):
        pg.click(coin(i))
    check(pg.locator(".board-host .pz-cb-coin.on-l").count() == 3 and pg.locator(".board-host .pz-cb-coin.on-r").count() == 4, "chạm xu: 3 xu đặt trái (viền liền ◀), 4 xu đặt phải (viền đứt ▶)")
    badge = pg.evaluate("[document.querySelector(\".board-host .pz-cb-coin[data-i='0'] .pz-cb-coinpan\").textContent, document.querySelector(\".board-host .pz-cb-coin[data-i='3'] .pz-cb-coinpan\").textContent]")
    check(badge == ["◀", "▶"], "đĩa đặt phân biệt bằng KÝ HIỆU ◀ ▶ chứ không chỉ màu", badge)
    check(pg.evaluate("[...document.querySelectorAll('.board-host .pz-cb-pan .pz-cb-pancount')].map(e => e.textContent.trim())") == ["3 xu", "4 xu"] and "Đang chuẩn bị lần cân 1: trái 3 xu, phải 4 xu." in pg.inner_text(".board-host .pz-cb-caption"),
          "hai đĩa hiện đúng số xu (3 | 4) và dòng 'Đang chuẩn bị lần cân 1'")
    check(pg.is_disabled(".board-host .pz-cb-weigh") and "Hai đĩa cần số xu bằng nhau (trái 3, phải 4)." in pg.inner_text(".board-host .pz-cb-reason"), "lệch số xu: nút Cân vô hiệu kèm lý do 'Hai đĩa cần số xu bằng nhau (trái 3, phải 4).'")
    pg.click(coin(6))                                                       # đích đang là Phải: chạm lại xu đang ở đĩa phải = bỏ ra ngoài
    check(pg.locator(".board-host .pz-cb-coin.on-r").count() == 3 and not pg.is_disabled(".board-host .pz-cb-weigh") and pg.inner_text(".board-host .pz-cb-reason").strip() == "", "chạm lại xu đang ở đúng đĩa đích = bỏ ra ngoài; 3–3 hợp lệ, nút Cân mở, lý do trống")
    pg.click(".board-host .pz-cb-clear")
    check(pg.locator(".board-host .pz-cb-coin.on-l, .board-host .pz-cb-coin.on-r").count() == 0 and pg.is_disabled(".board-host .pz-cb-weigh") and pg.is_disabled(".board-host .pz-cb-clear"), "'Xoá đĩa': mọi xu về khay, Cân/Xoá vô hiệu")
    hs = pg.evaluate("[...document.querySelectorAll('.board-host .pz-cb-act')].map(b => Math.round(b.getBoundingClientRect().height))")
    check(len(hs) == 3 and all(h_ >= 44 for h_ in hs), "nút Cân / Xoá đĩa / Kết luận cao ≥ 44 px", hs)

    # ======================================================================= cân thật + oracle vật lý
    section("  — cân: kết quả = so khối lượng độc lập, cân đòn nghiêng đúng chiều, nhật ký, hoàn tác")
    ui_weigh(pg, [0, 1, 2], [3, 4, 5])
    g = P.game()
    v_after = g["v"]
    L, R, res = records(g)[0]
    sec = g["data"]["secret"]
    want = weigh(L, R, sec["coin"], bool(sec["heavy"]))
    check(L == [0, 1, 2] and R == [3, 4, 5] and res == want and g["moves"] == 1, "lần cân 1 ghi đúng hai tập xu; kết quả %d = so khối lượng (xu giả %d %s)" % (res, sec["coin"] + 1, "nặng" if sec["heavy"] else "nhẹ"), (L, R, res, want))
    names = {1: "trái nặng hơn", 2: "cân bằng", 3: "phải nặng hơn"}
    check(pg.locator(".board-host .pz-cb-logrow").count() == 1 and "Lần 1: {1–3} ⚖ {4–6}" in pg.inner_text(".board-host .pz-cb-logrow") and names[res] in pg.inner_text(".board-host .pz-cb-logrow"), "nhật ký: 'Lần 1: {1–3} ⚖ {4–6}' + kết quả bằng CHỮ (%s)" % names[res], pg.inner_text(".board-host .pz-cb-logrow"))
    check(stat_text(pg) == "Còn 2 / 3 lần cân" and pg.inner_text(".board-host .pz-cb-loghead").endswith("(1/3)"), "'Còn 2 / 3 lần cân', tiêu đề nhật ký (1/3)")
    pg.wait_for_timeout(600)
    ang = beam_angle(pg)
    check(ang == {1: -11.0, 2: 0.0, 3: 11.0}[res], "đòn nghiêng đúng chiều: kết quả %d → góc %s° (âm = trái hạ)" % (res, ang), ang)
    check(names[res] in pg.inner_text(".board-host .pz-cb-caption") and pg.locator(".board-host .pz-cb-pan.is-heavy").count() == (0 if res == 2 else 1), "chú thích dưới cân nói kết quả; đĩa nặng được đánh dấu (trừ cân bằng)", pg.inner_text(".board-host .pz-cb-caption"))
    pg.click(".toolbar button:has-text('Hoàn tác')")
    g = P.game()
    pg.wait_for_timeout(600)
    check(len(records(g)) == 0 and stat_text(pg) == "Còn 3 / 3 lần cân" and beam_angle(pg) == 0 and pg.locator(".board-host .pz-cb-logrow").count() == 0, "Hoàn tác lần cân: nhật ký trống, 'Còn 3 / 3 lần cân', đòn trở về nằm ngang")
    pg.click(".toolbar button:has-text('Làm lại')")
    g2 = P.game()
    check(records(g2) == [(L, R, res)] and g2["v"] == v_after, "Làm lại áp lại ĐÚNG kết quả cũ, trạng thái giống từng bit (oracle tất định, kết quả nằm trong diff)")

    # ======================================================================= bàn phím
    section("  — bàn phím: mũi tên, L / R / 0, Space, Enter")
    P.start(tid, "nn3", "medium", SEED + 41)
    g = P.game()
    pg.focus(coin(0))
    pg.keyboard.press("l")
    pg.keyboard.press("ArrowRight")
    pg.keyboard.press("l")
    check(pg.locator(".board-host .pz-cb-coin.on-l").count() == 2 and pg.evaluate("document.activeElement.dataset.i") == "1", "phím L đặt xu đang focus vào đĩa trái; mũi tên → chuyển focus sang xu kế")
    pg.keyboard.press("ArrowRight")
    pg.keyboard.press("r")
    pg.keyboard.press("ArrowRight")
    pg.keyboard.press("r")
    check(pg.locator(".board-host .pz-cb-coin.on-r").count() == 2, "phím R đặt vào đĩa phải")
    pg.keyboard.press("ArrowLeft")
    pg.keyboard.press("0")
    check(pg.locator(".board-host .pz-cb-coin.on-r").count() == 1, "phím 0 bỏ xu ra ngoài")
    pg.keyboard.press("r")
    pg.keyboard.press("End")
    check(pg.evaluate("document.activeElement.dataset.i") == str(g["data"]["n"] - 1), "phím End → xu cuối; roving tabindex theo xu đang focus")
    pg.keyboard.press("Home")
    pg.keyboard.press("Enter")
    pg.wait_for_timeout(100)
    g = P.game()
    check(len(records(g)) == 1 and records(g)[0][0] == [0, 1] and records(g)[0][1] == [2, 3], "phím Enter = Cân: lần cân 2 xu / 2 xu đã ghi", records(g))
    pg.click(".board-host .pz-cb-target .chip:has-text('Trái')")
    pg.focus(coin(5))
    pg.keyboard.press(" ")
    check(pg.locator(".board-host .pz-cb-coin.on-l").count() == 1 and pg.locator(".board-host .pz-cb-coin[data-i='5'].on-l").count() == 1, "phím Space đặt xu vào đĩa đang chọn (Trái)")

    # ======================================================================= gợi ý tô xu
    section("  — gợi ý tô sáng xu")
    P.start(tid, "nn3", "medium", SEED + 42)
    pg.click(".toolbar button:has-text('Gợi ý')")
    pg.wait_for_selector(".hint-panel:not([hidden]) .hint-text")
    pg.click(".hint-panel button:has-text('Chi tiết hơn')")
    h2 = pg.evaluate("[...document.querySelectorAll('.board-host .pz-cb-coin.hint')].map(c => +c.dataset.i).sort((a, b) => a - b)")
    n2 = P.game()["data"]["n"]
    check(len(h2) >= 2 and len(h2) % 2 == 0 and all("đang được gợi ý" in pg.get_attribute(coin(i), "aria-label") for i in h2), "gợi ý mức 2 tô các xu của phép cân (%d xu), aria-label nói 'đang được gợi ý'" % len(h2), h2)
    pg.click(".hint-panel button:has-text('Chi tiết hơn')")
    check("Cân " in pg.inner_text(".hint-panel .hint-text") and pg.locator(".hint-panel .why li").count() >= 4, "mức 3: 'Cân {…} với {…}.' + ≥ 4 dòng 'vì sao'")
    pg.click(".hint-panel button:has-text('Áp dụng nước này')")
    check(pg.locator(".board-host .pz-cb-coin.hint").count() == 0 and len(records(P.game())) == 1, "áp dụng gợi ý = một lần cân thật; xoá tô sáng")

    # ======================================================================= tương phản, co giãn, giảm chuyển động
    section("  — tương phản (sáng + tối), co giãn 360 px với 39 xu, giảm chuyển động")
    low = []
    for theme in ("light", "dark"):
        pg.evaluate("t => { document.documentElement.dataset.theme = t }", theme)
        for fg, bg, lab in (("--pz-cb-coin-ink", "--pz-cb-coin", "chữ trên xu"), ("--pz-cb-ref-ink", "--pz-cb-ref", "chữ trên xu chuẩn"), ("--pz-cb-pan-ink", "--pz-cb-pan", "chữ trên đĩa/khay"), ("--text", "--elev", "chữ trên nền thẻ")):
            c = pg.evaluate("""([fg, bg]) => { const f = document.createElement('i'), b = document.createElement('i'); f.style.color = 'var(' + fg + ')'; b.style.color = 'var(' + bg + ')'; document.body.append(f, b); const o = [getComputedStyle(f).color, getComputedStyle(b).color]; f.remove(); b.remove(); return o; }""", [fg, bg])
            r = ratio(rgb(c[0]), rgb(c[1]))
            if r < 4.5:
                low.append("%s %s = %.2f" % (theme, lab, r))
        for ring, lab in (("--pz-cb-ring-l", "viền trái"), ("--pz-cb-ring-r", "viền phải"), ("--pz-cb-heavy", "đĩa nặng")):
            c = pg.evaluate("""([a, b]) => { const f = document.createElement('i'), k = document.createElement('i'); f.style.color = 'var(' + a + ')'; k.style.color = 'var(' + b + ')'; document.body.append(f, k); const o = [getComputedStyle(f).color, getComputedStyle(k).color]; f.remove(); k.remove(); return o; }""", [ring, "--pz-cb-pan"])
            r = ratio(rgb(c[0]), rgb(c[1]))
            if r < 4.5:                                  # ký hiệu ◀ ▶ trong huy hiệu là CHỮ trên nền thẻ → 4,5:1
                low.append("%s %s trên đĩa = %.2f" % (theme, lab, r))
        c = pg.evaluate("""() => { const f = document.createElement('i'), k = document.createElement('i'); f.style.color = 'var(--pz-cb-coin-edge)'; k.style.color = 'var(--pz-cb-pan)'; document.body.append(f, k); const o = [getComputedStyle(f).color, getComputedStyle(k).color]; f.remove(); k.remove(); return o; }""")
        if ratio(rgb(c[0]), rgb(c[1])) < 3:
            low.append("%s viền xu / khay < 3:1" % theme)
    pg.evaluate("t => { document.documentElement.dataset.theme = t }", "light")
    check(not low, "tương phản --pz-cb-* ≥ 4,5:1 (chữ) / ≥ 3:1 (viền xu) ở giao diện sáng và tối", low)

    ctx = br.new_context(viewport={"width": 360, "height": 740}, service_workers="block", reduced_motion="reduce")
    p2 = ctx.new_page()
    errs = []
    p2.on("pageerror", lambda e: errs.append(str(e)))
    p2.goto(P.url, wait_until="load")
    p2.wait_for_function("document.body.classList.contains('ready')", timeout=30000)
    p2.evaluate("location.hash = '#/new/coinbalance?size=nn4&tier=expert&seed=%d&go=1'" % (SEED + 70))
    p2.wait_for_selector(".board-host .pz-cb-coin", timeout=30000)
    p2.wait_for_timeout(300)
    m = p2.evaluate("""() => { const cs = [...document.querySelectorAll('.board-host .pz-cb-coin')].map(c => { const r = c.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
      return { n: cs.length, minw: Math.min(...cs.map(x => x[0])), minh: Math.min(...cs.map(x => x[1])), sw: document.documentElement.scrollWidth, iw: innerWidth, tray: document.querySelector('.board-host .pz-cb-tray').getBoundingClientRect().right,
               dur: getComputedStyle(document.querySelector('.board-host .pz-cb-beam')).transitionDuration, panDur: getComputedStyle(document.querySelector('.board-host .pz-cb-pan')).transitionDuration }; }""")
    check(m["n"] >= 13 and m["minw"] >= 44 and m["minh"] >= 44 and m["sw"] <= m["iw"] + 1 and m["tray"] <= m["iw"] + 1, "360 px, bàn %d xu: mọi xu ≥ 44×44 px (nhỏ nhất %dx%d), trang không tràn ngang" % (m["n"], m["minw"], m["minh"]), m)
    check(float(m["dur"].rstrip("s")) < 0.001 and float(m["panDur"].rstrip("s")) < 0.001, "prefers-reduced-motion: cân đòn và đĩa không chuyển động (transition ≈ 0, cả quy tắc chung lẫn của bàn)", m)
    p2.evaluate("location.hash = '#/new/coinbalance?size=nn4&tier=hard&seed=%d&o=mode:adv&go=1'" % (SEED + 71))
    p2.wait_for_timeout(500)
    bad = p2.evaluate("""() => { const W = innerWidth, bad = []; for (const el of document.querySelectorAll('.board-host *')) { const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) bad.push(el.className || el.tagName); } return bad.slice(0, 5); }""")
    check(not bad, "360 px: không phần tử nào của bàn ra ngoài khung (cả ván đối thủ)", bad)
    p2.evaluate("location.hash = '#/create/coinbalance'")
    p2.wait_for_selector(".pz-cb-ed", timeout=15000)
    p2.wait_for_timeout(400)
    ov = p2.evaluate("[document.documentElement.scrollWidth, innerWidth]")
    check(ov[0] <= ov[1] + 1, "360 px: trình soạn không tràn ngang", ov)
    check(not errs, "không lỗi JS ở ngữ cảnh 360 px + giảm chuyển động", errs)
    ctx.close()

    # ======================================================================= WebKit iPhone 13 (chạm thật)
    section("  — WebKit iPhone 13: chạm xu, Cân")
    box = {}
    th = threading.Thread(target=lambda: box.update(webkit_touch(P.url)))
    th.start()
    th.join(180)
    if box.get("err") and ("Executable doesn't exist" in box["err"] or "browserType.launch" in box["err"]):
        print("  (bỏ qua WebKit: %s)" % box["err"].splitlines()[0][:100])
    else:
        check(box.get("ok") and box.get("placed") == [2, 2] and box.get("log") == 1 and box.get("budget", "").startswith("Còn 2 / 3") and box["overflow"][0] <= box["overflow"][1] + 1 and not box.get("errs"),
              "iPhone 13 (WebKit): chạm đặt 2–2 xu, chạm Cân → 1 dòng nhật ký, 'Còn 2 / 3', không tràn ngang, không lỗi JS", box)

    edge_p3(P, check, section, tid)
