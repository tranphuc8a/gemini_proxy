# -*- coding: utf-8 -*-
"""Kiểm riêng của bàn CÂN ĐIỆN TỬ (assets/js/ui/boards/coinscale.js + assets/css/board-coinscale.css) bằng trình duyệt thật.

check.py nạp tệp này và gọi run(P, check, section, tid) sau vòng đời chung của mọi loại (xem tang_2). P là Page của check.py (P.pg = Playwright page).
Phần chạy trên Edge thật (channel="msedge", lùi về Chromium + in rõ nếu máy không có Edge) nằm ở edge_p6b(): giải trọn ván bằng giao diện (cả hai phiên bản), replay chỉ-đọc,
kết luận chưa chứng minh, đối thủ, Puzzle mới (options), trình soạn.

Nguồn sự thật ĐỘC LẬP: số gam được tính lại ở đây bằng VẬT LÝ (chồng xu: xu thật 10 g, giả 11 g; hai loại: 9 g / 10 g) từ bí mật cố định của đề, và bản ghi các lần cân được
đọc thẳng từ state.v theo bố cục Puz.plan (viết lại bằng Python, không gọi engine): v = [nộp, len, p_0…p_{extra−1}, rec_0 (n+1 số), …].
Tập ứng viên của đối thủ cũng dựng lại bằng vật lý."""

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


def phys_stack(take, fake):
    return sum(t * (11 if i == fake else 10) for i, t in enumerate(take))


def phys_two(group, x):
    return sum((10 if (x >> i) & 1 else 9) for i in group)


def records(g):
    """Bản ghi các lần cân đọc từ state.v theo bố cục Puz.plan: stack extra = 1, two extra = n."""
    d = g["data"]
    n = d["n"]
    extra = 1 if d["form"] == "stack" else n
    head = 2 + extra
    v = g["v"]
    out = []
    for i in range(v[1]):
        r = v[head + i * (n + 1): head + (i + 1) * (n + 1)]
        out.append((r[:n], r[n]))
    return out


def grams_of(d, rec):
    take, res = rec
    if d["form"] == "stack":
        return sum(t * 10 for t in take) + res
    return sum(take) * 9 + res


def vec_bits(x, n):
    return [(x >> i) & 1 for i in range(n)]


def consistent(g):
    """Mọi bí mật (chỉ số chồng / bitmask xu nặng) khớp MỌI lần cân đã ghi — theo vật lý."""
    d = g["data"]
    n = d["n"]
    cands = range(n) if d["form"] == "stack" else range(1 << n)
    out = []
    for s in cands:
        ok = True
        for take, res in records(g):
            if d["form"] == "stack":
                ph = phys_stack(take, s)
            else:
                ph = phys_two([i for i in range(n) if take[i]], s)
            if ph != grams_of(d, (take, res)):
                ok = False
                break
        if ok:
            out.append(s)
    return out


JS_HINT = """() => {
  const id = decodeURIComponent(/#\\/play\\/([^?]+)/.exec(location.hash)[1]), g = Puz.ui.app.ctx().getGame(id), T = g.type;
  return T.hint(g.puzzle, g.state, 3, g.settings());
}"""
JS_FOCUS = """() => { const a = document.activeElement; return { tag: a.tagName, cls: a.className, txt: (a.textContent || '').trim(), pressed: a.getAttribute('aria-pressed'), label: a.getAttribute('aria-label'), i: a.dataset ? a.dataset.i : null, inBody: a === document.body, now: a.getAttribute('aria-valuenow'), role: a.getAttribute('role') }; }"""
JS_HUD = """() => [...document.querySelectorAll('.hud-chip')].map(c => ({ title: c.title, val: c.lastChild ? c.lastChild.textContent : '' }))"""
JS_LASTREC = "() => { const r = Puz.ui.app.ctx().user.history().filter(x => x.type === 'coinscale'); return r.length ? r[r.length - 1] : null; }"
JS_DUP = """() => {
  const c = Puz.ui.app.ctx(), id = decodeURIComponent(/#\\/play\\/([^?]+)/.exec(location.hash)[1]), g = c.getGame(id), hosts = [], views = [];
  for (let k = 0; k < 2; k++) { const h = document.createElement('div'); document.body.append(h); hosts.push(h); views.push(Puz.boards.coinscale.mount(h, { game: g, puzzle: g.puzzle, type: g.type, U: Puz.ui, readOnly: false, settings: () => ({}), announce: () => {} })); }
  const ids = hosts.map(h => h.querySelector('.pz-cs-weigh').getAttribute('aria-describedby')), own = hosts.map((h, i) => { const e = document.getElementById(ids[i]); return !!e && h.contains(e); });
  views.forEach(v => v.destroy()); hosts.forEach(h => h.remove());
  return { ids: ids, own: own };
}"""


def stk(i):
    return ".board-host .pz-cs-stk[data-i='%d']" % i


def pm(i, act):
    return stk(i) + " .pz-cs-pm[data-act='%s']" % act


def coin(i):
    return ".board-host .pz-cs-coin[data-i='%d']" % i


def stat_text(pg):
    return pg.inner_text(".board-host .pz-cs-budget").replace("\n", " ").strip()


def lcd_text(pg):
    return pg.inner_text(".board-host .pz-cs-lcdnum").strip().replace(" ", " ")


def ui_weigh(pg, action):
    """Làm lại một phép cân (action của engine) bằng CHẠM / bấm thật."""
    if "take" in action:
        for i, t in enumerate(action["take"]):
            for _ in range(t):
                pg.click(pm(i, "+"))
    else:
        for i in action["set"]:
            pg.click(coin(i))
    pg.click(".board-host .pz-cs-weigh")
    pg.wait_for_timeout(60)


def ui_conclude(pg, action):
    pg.click(".board-host .pz-cs-open")
    if "stack" in action:
        pg.click(".board-host .pz-cs-cbtn[data-i='%d']" % action["stack"])
    else:
        for i, v in enumerate(action["x"]):
            pg.click(".board-host .pz-cs-cbtn[data-i='%d']" % i)          # ? → nặng
            if not v:
                pg.click(".board-host .pz-cs-cbtn[data-i='%d']" % i)      # nặng → nhẹ
    pg.click(".board-host .pz-cs-cok")
    pg.wait_for_timeout(120)


def webkit_touch(url):
    """Luồng riêng (Playwright đồng bộ không lồng được): WebKit + iPhone 13, CHẠM thật: bấm +, Cân, rồi ván hai loại: chạm xu, Cân."""
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
            pg.evaluate("location.hash = '#/new/coinscale?size=chong&tier=medium&seed=%d&go=1'" % (SEED + 81))
            pg.wait_for_selector(".board-host .pz-cs-stk", timeout=30000)
            pg.wait_for_timeout(300)
            pg.tap(pm(1, "+"))
            pg.tap(pm(1, "+"))
            pg.tap(pm(2, "+"))
            out["val"] = pg.inner_text(stk(1) + " .pz-cs-stkval")
            pg.tap(".board-host .pz-cs-weigh")
            pg.wait_for_timeout(300)
            out["log"] = pg.locator(".board-host .pz-cs-logrow").count()
            out["budget"] = pg.inner_text(".board-host .pz-cs-budget").replace("\n", " ")
            pg.evaluate("location.hash = '#/new/coinscale?size=hailoai&tier=medium&seed=%d&go=1'" % (SEED + 82))
            pg.wait_for_selector(".board-host .pz-cs-coin", timeout=30000)
            pg.wait_for_timeout(300)
            pg.tap(coin(0))
            pg.tap(coin(1))
            out["on"] = pg.locator(".board-host .pz-cs-coin.on").count()
            pg.tap(".board-host .pz-cs-weigh")
            pg.wait_for_timeout(300)
            out["log2"] = pg.locator(".board-host .pz-cs-logrow").count()
            out["overflow"] = pg.evaluate("[document.documentElement.scrollWidth, innerWidth]")
            out["errs"] = errs
            out["ok"] = True
            br.close()
    except Exception as e:  # noqa: BLE001
        out["err"] = "%s: %s" % (type(e).__name__, e)
    return out


# ---------------------------------------------------------------------------------------------- Edge: giải trọn bằng giao diện, replay, đối thủ, Puzzle mới, trình soạn
def edge_p6b(P, check, section, tid):
    PageCls = type(P)
    bt = P.pg.context.browser.browser_type
    try:
        br, kenh = bt.launch(channel="msedge"), "Edge"
    except Exception as e:  # noqa: BLE001
        br, kenh = bt.launch(), "Chromium (không mở được Edge: %s)" % str(e).splitlines()[0][:80]
    section("  — đợt P6b trên %s: giải trọn bằng giao diện (cả hai phiên bản), replay chỉ-đọc, kết luận chưa chứng minh, đối thủ, Puzzle mới, trình soạn" % kenh)
    E = PageCls(br, P.url, "cs-p6b", viewport={"width": 1280, "height": 1000})
    pg = E.pg
    try:
        # ---- chồng xu: giải trọn bằng giao diện; mỗi lần cân của chiến lược tối ưu (đọc từ hint, KHÔNG tính vào bộ đếm) làm lại bằng bấm thật
        E.start(tid, "chong", "medium", SEED + 61)
        g = E.game()
        d = g["data"]
        n_steps = 0
        for _ in range(6):
            h = pg.evaluate(JS_HINT)
            if h.get("none") or not h.get("action"):
                break
            a = h["action"]
            if a["k"] == "weigh":
                ui_weigh(pg, a)
                cur = E.game()
                take, res = records(cur)[-1]
                check(take == a["take"] and grams_of(d, (take, res)) == phys_stack(take, d["secret"]),
                      "chồng xu, lần cân %d làm bằng bấm: bản ghi đúng số xu lấy và số gam = vật lý độc lập (%d g)" % (len(records(cur)), grams_of(d, (take, res))), (take, res))
                check(lcd_text(pg).replace(" ", "") == str(grams_of(d, (take, res))) + "g", "màn hình số hiện đúng số gam vừa cân (%s)" % lcd_text(pg), lcd_text(pg))
                n_steps += 1
            else:
                check(a["k"] == "conclude", "bước cuối của chiến lược là kết luận", a)
                ui_conclude(pg, a)
                break
        pg.wait_for_selector("dialog[open] h2:has-text('Đã giải')", timeout=10000)
        rec = pg.evaluate(JS_LASTREC)
        check(rec and rec["result"] == "solved" and rec["grade"]["stars"] == 3 and rec["grade"]["value"] == n_steps and rec["mistakes"] == 0,
              "giải xong bằng giao diện: lịch sử 'solved', grade 3★ (không hoàn tác, không gợi ý mức 3, 0 lần cân mất an toàn), value = %d lần cân" % n_steps, rec and rec.get("grade"))
        stats = pg.inner_text("dialog[open] .stat-grid")
        check("Điểm tối ưu" in stats and "★★★" in stats and "Tối ưu" in pg.inner_text("dialog[open]"), "hộp thoại 'Đã giải' có ô 'Điểm tối ưu' ★★★ và dòng 'Tối ưu…'", stats.replace("\n", " "))
        hud = pg.evaluate(JS_HUD)
        mv = [x for x in hud if x["title"].startswith("Số thao tác")]
        check(len(mv) == 1 and mv[0]["val"] == str(n_steps + 1), "HUD: chip 'Số thao tác' = %d (các lần cân + kết luận) = bộ đếm của vỏ" % (n_steps + 1), mv)
        done = E.game()
        check(done["v"][0] == 1 and done["v"][2] - 1 == d["secret"], "kết luận trong state = chồng giả cố định của đề (so với data.secret)", (done["v"][:3], d["secret"]))

        # ---- replay chỉ-đọc
        pg.click("dialog[open] button:has-text('Xem lời giải từng bước')")
        pg.wait_for_selector(".replay-panel:not([hidden])", timeout=20000)
        total = int(pg.inner_text(".rp-count").split("/")[1])
        check(total == n_steps + 1, "replay có đúng %d bước (số lần cân + kết luận)" % (n_steps + 1), total)
        check(pg.locator(".board-host .pz-cs-weigh").count() == 0 and pg.locator(".board-host .pz-cs-actions").count() == 0, "bàn chỉ-đọc trong replay: không có nút Cân / Kết luận")
        pg.click(pm(0, "+"), force=True)
        check(pg.evaluate("[...document.querySelectorAll('.board-host .pz-cs-stkval')].every(e => e.textContent === '0')"), "bấm + trong replay không đổi được số xu lấy")
        pg.click(".replay-panel button:has-text('Sau')")
        check(pg.locator(".board-host .pz-cs-logrow").count() == 1 and pg.locator(".board-host .pz-cs-stk.replay").count() >= 2, "replay bước 1: nhật ký có 1 lần cân, các chồng của lần cân được tô 'replay'")
        pg.click(".replay-panel button[aria-label='Tới cuối']")
        check(pg.locator(".board-host .pz-cs-logend.is-ok").count() == 1 and "✓ đã được chứng minh" in pg.inner_text(".board-host .pz-cs-logend"), "replay cuối: dòng 'Kết luận … ✓ đã được chứng minh'")
        pg.click(".replay-panel button[aria-label='Về đầu']")
        check(pg.locator(".board-host .pz-cs-logrow").count() == 0 and "Chưa có lần cân nào" in pg.inner_text(".board-host .pz-cs-log"), "replay về đầu: nhật ký trống")
        pg.click(".replay-panel button:has-text('Thoát replay')")

        # ---- hai loại: giải trọn bằng giao diện
        E.start(tid, "hailoai", "medium", SEED + 62)
        g = E.game()
        d = g["data"]
        n_steps = 0
        for _ in range(6):
            h = pg.evaluate(JS_HINT)
            if h.get("none") or not h.get("action"):
                break
            a = h["action"]
            if a["k"] == "weigh":
                ui_weigh(pg, a)
                cur = E.game()
                take, res = records(cur)[-1]
                grp = [i for i in range(d["n"]) if take[i]]
                check(grp == a["set"] and grams_of(d, (take, res)) == phys_two(grp, d["secret"]),
                      "hai loại, lần cân %d làm bằng chạm: nhóm đúng và số gam = vật lý độc lập (%d g)" % (len(records(cur)), grams_of(d, (take, res))), (grp, res))
                n_steps += 1
            else:
                ui_conclude(pg, a)
                break
        pg.wait_for_selector("dialog[open] h2:has-text('Đã giải')", timeout=10000)
        rec = pg.evaluate(JS_LASTREC)
        done = E.game()
        got = sum(1 << i for i in range(d["n"]) if done["v"][2 + i] == 2)
        check(rec and rec["result"] == "solved" and rec["grade"]["stars"] == 3 and got == d["secret"],
              "hai loại: giải xong bằng giao diện, grade 3★, kết luận từng xu = bí mật cố định (bitmask %d)" % d["secret"], (rec and rec.get("grade"), got, d["secret"]))
        pg.keyboard.press("Escape")

        # ---- kết luận chưa chứng minh → mở lại; hết lượt; hoàn tác (chồng xu, c = 9 → 1 lần cân)
        E.start(tid, "chong", "easy", SEED + 63)
        g = E.game()
        d = g["data"]
        pg.click(".board-host .pz-cs-open")
        check(pg.locator(".board-host .pz-cs-concl:not([hidden])").count() == 1 and pg.locator(".board-host .pz-cs-cbtn").count() == d["n"], "'Kết luận…' mở bảng chọn chồng (%d chồng)" % d["n"])
        check(pg.is_disabled(".board-host .pz-cs-cok"), "'Chốt kết luận' bị vô hiệu cho tới khi chọn chồng")
        pg.keyboard.press("Escape")
        check(pg.locator(".board-host .pz-cs-concl:not([hidden])").count() == 0, "phím Escape đóng bảng kết luận")
        ui_conclude(pg, {"stack": 0})
        g = E.game()
        check(g["status"] == "playing" and g["mistakes"] == 1 and pg.locator(".board-host .pz-cs-reopen:not([hidden])").count() == 1 and "chưa được chứng minh" in pg.inner_text(".board-host .pz-cs-reopen"),
              "kết luận khi chưa cân gì: ván VẪN chơi tiếp (không tính giải, dù đoán đúng nhờ may), +1 lỗi, khung 'chưa được chứng minh' + nút mở lại", (g["status"], g["mistakes"]))
        check(pg.is_disabled(".board-host .pz-cs-weigh") and "Đã kết luận" in pg.inner_text(".board-host .pz-cs-reason"), "đã kết luận: nút Cân bị vô hiệu kèm lý do")
        pg.click(".board-host .pz-cs-reopenbtn")
        g = E.game()
        check(g["v"][0] == 0 and pg.locator(".board-host .pz-cs-reopen:not([hidden])").count() == 0 and not pg.is_disabled(".board-host .pz-cs-open"), "'Mở lại để cân tiếp': xoá cờ kết luận")
        k = d["k"]
        for _ in range(k):
            ui_weigh(pg, {"take": [1] + [0] * (d["n"] - 1)})
        check(stat_text(pg).startswith("Còn 0 / %d" % k) and pg.is_disabled(".board-host .pz-cs-weigh") and "Hết lượt cân" in pg.inner_text(".board-host .pz-cs-reason"),
              "dùng hết %d lần cân: 'Còn 0 / %d', nút Cân vô hiệu, lý do 'Hết lượt cân — hãy kết luận.'" % (k, k), (stat_text(pg), pg.inner_text(".board-host .pz-cs-reason")))
        pg.click(pm(1, "+"))
        check(pg.is_disabled(".board-host .pz-cs-weigh"), "hết lượt: bấm + cũng không cân được")
        pg.click(".toolbar button:has-text('Hoàn tác')")
        g = E.game()
        check(len(records(g)) == k - 1 and stat_text(pg).startswith("Còn 1 / %d" % k), "Hoàn tác lần cân cuối: nhật ký còn %d lần, 'Còn 1 / %d'" % (k - 1, k))
        check(pg.evaluate("[...document.querySelectorAll('.board-host .pz-cs-stkval')].every(e => e.textContent === '0')"), "hoàn tác xoá phần số xu đang chuẩn bị dở")

        # ---- id duy nhất của dòng lý do: hai bàn cùng mount không trùng id
        dup = pg.evaluate(JS_DUP)
        check(dup["ids"][0] != dup["ids"][1] and dup["own"] == [True, True], "hai bàn cùng mount: id dòng lý do khác nhau, mỗi aria-describedby trỏ vào CHÍNH bàn của nó", dup)

        # ---- bàn phím: chồng xu (spinbutton roving, ↑/↓, số, ←/→, Enter), focus không rơi về BODY
        E.start(tid, "chong", "hard", SEED + 64)
        g = E.game()
        n_c = g["data"]["n"]
        check(pg.locator(".board-host .pz-cs-stk[tabindex='0']").count() == 1 and pg.get_attribute(stk(0), "role") == "spinbutton", "chồng xu: role=spinbutton, đúng MỘT điểm dừng Tab (roving) trong %d chồng" % n_c)
        pg.focus(stk(0))
        pg.keyboard.press("ArrowUp")
        pg.keyboard.press("ArrowUp")
        check(pg.evaluate(JS_FOCUS)["now"] == "2" and pg.inner_text(stk(0) + " .pz-cs-stkval") == "2", "↑ ↑: số xu lấy từ chồng 1 = 2 (aria-valuenow, ô số)", pg.evaluate(JS_FOCUS))
        pg.keyboard.press("ArrowDown")
        check(pg.inner_text(stk(0) + " .pz-cs-stkval") == "1", "↓: giảm còn 1")
        pg.keyboard.press("ArrowRight")
        fo = pg.evaluate(JS_FOCUS)
        check(fo["i"] == "1" and not fo["inBody"], "→: focus sang chồng 2", fo)
        pg.keyboard.press("2")
        check(pg.inner_text(stk(1) + " .pz-cs-stkval") == "2", "phím số '2': đặt thẳng chồng 2 lấy 2 xu")
        pg.keyboard.press("End")
        check(pg.evaluate(JS_FOCUS)["i"] == str(n_c - 1), "End: focus tới chồng cuối (%d)" % n_c)
        pg.keyboard.press("Home")
        pg.keyboard.press("Enter")
        gk = E.game()
        check(len(records(gk)) == 1 and records(gk)[0][0][:2] == [1, 2], "Enter = Cân: lần cân (1, 2, 0…) đã ghi", records(gk))
        fo = pg.evaluate(JS_FOCUS)
        check(not fo["inBody"], "sau Enter-Cân (nút tự vô hiệu vì lựa chọn đã xoá): focus không rơi về BODY", fo)
        pg.focus(stk(0))
        pg.keyboard.press("9")
        check(int(pg.inner_text(stk(0) + " .pz-cs-stkval")) <= g["data"]["c"], "phím số vượt c bị kẹp về c (%d)" % g["data"]["c"])
        check(pg.is_disabled(pm(0, "+")) and not pg.is_disabled(pm(0, "-")), "nút + tự vô hiệu khi chạm c, nút − còn bật")

        # ---- bàn phím: xu hai loại (roving, Space, mũi tên, Enter) + lưới Kết luận xoay ? → nặng → nhẹ
        E.start(tid, "hailoai", "hard", SEED + 65)
        g = E.game()
        n_t = g["data"]["n"]
        check(pg.locator(".board-host .pz-cs-coin[tabindex='0']").count() == 1 and pg.locator(".board-host .pz-cs-coin").count() == n_t, "hai loại: %d xu, đúng MỘT điểm dừng Tab" % n_t)
        pg.focus(coin(0))
        pg.keyboard.press(" ")
        pg.keyboard.press("ArrowRight")
        pg.keyboard.press(" ")
        check(pg.locator(".board-host .pz-cs-coin.on").count() == 2 and pg.get_attribute(coin(0), "aria-pressed") == "true" and pg.evaluate("document.querySelector(\".board-host .pz-cs-coin[data-i='0'] .pz-cs-coinon\").textContent") == "⚖",
              "Space bật 2 xu trên cân, phân biệt bằng KÝ HIỆU ⚖ (không chỉ màu) + aria-pressed")
        check("Đang chuẩn bị lần cân 1: 2 xu trên cân" in pg.inner_text(".board-host .pz-cs-caption"), "dòng mô tả 'Đang chuẩn bị lần cân 1: 2 xu trên cân'", pg.inner_text(".board-host .pz-cs-caption"))
        pg.keyboard.press("Enter")
        gk = E.game()
        check(len(records(gk)) == 1 and [i for i in range(n_t) if records(gk)[0][0][i]] == [0, 1], "Enter = Cân: nhóm {1, 2} đã ghi", records(gk))
        pg.click(".board-host .pz-cs-open")
        pg.click(".board-host .pz-cs-cbtn[data-i='0']")
        pg.click(".board-host .pz-cs-cbtn[data-i='0']")
        check(pg.inner_text(".board-host .pz-cs-cbtn[data-i='0'] .pz-cs-cstate") == "nhẹ" and pg.get_attribute(".board-host .pz-cs-cbtn[data-i='0']", "aria-label") == "Xu 1: nhẹ" and pg.is_disabled(".board-host .pz-cs-cok"),
              "lưới Kết luận: chạm 2 lần xu 1 = 'nhẹ'; 'Chốt' vô hiệu cho tới khi đặt đủ mọi xu")
        pg.keyboard.press("Escape")

        # ---- gợi ý tô sáng
        E.start(tid, "chong", "medium", SEED + 66)
        pg.click(".toolbar button:has-text('Gợi ý')")
        pg.wait_for_selector(".hint-panel:not([hidden]) .hint-text")
        pg.click(".hint-panel button:has-text('Chi tiết hơn')")
        h2 = pg.evaluate("[...document.querySelectorAll('.board-host .pz-cs-stk.hint')].length")
        check(h2 >= 2 and all("đang được gợi ý" in (pg.get_attribute(stk(i), "aria-label") or "") for i in range(E.game()["data"]["n"]) if pg.locator(stk(i) + ".hint").count()), "gợi ý mức 2 tô các chồng nghi (%d), aria-label nói 'đang được gợi ý'" % h2)
        pg.click(".hint-panel button:has-text('Chi tiết hơn')")
        check("xu từ chồng" in pg.inner_text(".hint-panel .hint-text") and pg.locator(".hint-panel .why li").count() >= 3, "mức 3: 'Lấy … xu từ chồng …' + ≥ 3 dòng 'vì sao'")
        pg.click(".hint-panel button:has-text('Áp dụng nước này')")
        check(pg.locator(".board-host .pz-cs-stk.hint").count() == 0 and len(records(E.game())) == 1, "áp dụng gợi ý = một lần cân thật; xoá tô sáng")

        # ---- chế độ đối thủ qua liên kết seed o=: dồn quá nhiều chồng vào một kết quả là mất an toàn
        pg.evaluate("location.hash = '#/new/coinscale?size=chong&tier=hard&seed=%d&o=mode:adv&go=1'" % (SEED + 67))
        pg.wait_for_selector(".board-host .pz-cs-stk", timeout=30000)
        pg.wait_for_function("/#\\/play\\//.test(location.hash)", timeout=30000)
        g = E.game()
        d = g["data"]
        check(d["mode"] == "adv" and d["secret"] is None and "Đối thủ thích nghi" in pg.inner_text(".board-host .pz-cs-mode"), "liên kết có o=mode:adv → ván đối thủ: không có bí mật định sẵn, chip 'Đối thủ thích nghi'", (d["mode"], d["secret"]))
        ui_weigh(pg, {"take": [0] * (d["n"] - 1) + [1]})                 # chỉ lấy 1 xu từ chồng cuối: nhóm "dư 0" gồm n − 1 chồng > (c+1)^(k−1)
        g = E.game()
        check(g["mistakes"] == 1 and len(consistent(g)) >= 1, "dồn n − 1 chồng vào một kết quả: +1 lỗi (mất an toàn); kết quả đối thủ nhất quán với ≥ 1 bí mật vật lý (%d)" % len(consistent(g)), (g["mistakes"], len(consistent(g))))
        pg.click(".toolbar button:has-text('Gợi ý')")
        pg.wait_for_selector(".hint-panel:not([hidden]) .hint-text")
        check("không còn cách cân nào chắc chắn" in pg.inner_text(".hint-panel .hint-text"), "gợi ý mức 1 nói thế đã mất an toàn", pg.inner_text(".hint-panel .hint-text"))
        pg.click(".hint-panel button:has-text('Chi tiết hơn')")
        pg.click(".hint-panel button:has-text('Chi tiết hơn')")
        check("Quay về trước lần cân thứ 1" in pg.inner_text(".hint-panel .hint-text") and pg.locator(".hint-panel button:has-text('Áp dụng nước này')").count() == 1, "gợi ý mức 3: 'Quay về trước lần cân thứ 1' + nút áp dụng (truncate)")
        for _ in range(d["k"] - 1):
            ui_weigh(pg, {"take": [0] * (d["n"] - 1) + [1]})
        g = E.game()
        cons = consistent(g)
        check(len(cons) >= 2 and len(records(g)) == d["k"], "thế đã mất: sau hết lượt vẫn còn ≥ 2 bí mật (%d) — đối thủ không để lọt" % len(cons), (len(cons), len(records(g))))
        ui_conclude(pg, {"stack": cons[0]})
        g = E.game()
        check(g["status"] == "playing" and pg.locator(".board-host .pz-cs-reopen:not([hidden])").count() == 1, "đối thủ: kết luận bất kỳ cũng KHÔNG tính giải (còn ≥ 2 khả năng)", g["status"])
        res = pg.evaluate("""() => { const c = Puz.ui.app.ctx(), id = decodeURIComponent(/#\\/play\\/([^?]+)/.exec(location.hash)[1]), g = c.getGame(id); let n = 0;
          while (g.undoStack.length) { g.undo(); n++; if (n > 40) break; }
          let s = 0; while (g.status === 'playing' && s < 20) { const h = g.hint(3); if (!h || !h.action) break; g.applyHint(h); s++; } return { status: g.status, steps: s }; }""")
        check(res["status"] == "solved", "hoàn tác về đầu rồi giải bằng gợi ý ở chế độ đối thủ → solved (%d bước)" % res["steps"], res)
        pg.wait_for_selector("dialog[open]", timeout=10000)
        pg.keyboard.press("Escape")
        pg.wait_for_selector("dialog[open]", state="detached", timeout=10000)

        # ---- Puzzle mới: options + nhãn "Phiên bản"
        pg.evaluate("location.hash = '#/new/coinscale'")
        pg.wait_for_selector(".ng-opt", timeout=15000)
        sizes = pg.evaluate("[...document.querySelectorAll('.chips .chip')].filter(c => /Chồng xu|hai loại|Xu hai loại/i.test(c.textContent)).length")
        check(sizes >= 2 and pg.locator(".ng-opt .chip").count() == 2 and pg.locator(".ng-opt label").first.inner_text() == "Chế độ", "Puzzle mới: 2 phiên bản + hàng 'Chế độ' 2 chip", sizes)
        pg.click(".ng-opt .chip:has-text('Đối thủ thích nghi')")
        check("đối thủ chọn kết quả khó nhất" in pg.inner_text(".ng-opt .hint"), "chọn 'Đối thủ thích nghi' hiện ghi chú của lựa chọn")

        # ---- trình soạn
        pg.evaluate("location.hash = '#/create/coinscale'")
        pg.wait_for_selector(".pz-cs-ed", timeout=15000)
        pg.wait_for_function("document.querySelector('.cr-status') && /Có chiến lược chắc chắn/.test(document.querySelector('.cr-status').innerText)", timeout=20000)
        txt = pg.inner_text("#main")
        check("✓ Có chiến lược chắc chắn trong 1 lần cân" in txt and pg.locator(".pz-cs-ed .pz-cs-cbtn").count() == 10, "trình soạn mặc định: 10 chồng × 9 xu, 1 lần, 10 nút chọn chồng giả; vỏ báo '✓ Có chiến lược chắc chắn trong 1 lần cân'", txt[-300:])
        pg.click(".pz-cs-ed .chip:has-text('Xu hai loại')")
        pg.wait_for_function("document.querySelector('.cr-status') && /Có chiến lược chắc chắn trong 3 lần/.test(document.querySelector('.cr-status').innerText)", timeout=20000)
        check(pg.locator(".pz-cs-ed .pz-cs-cbtn").count() == 4 and "Số lần cân ít nhất để xác định chắc chắn 4 xu: 3" in pg.inner_text(".pz-cs-ed"), "đổi sang 'Xu hai loại': mặc định 4 xu, 3 lần, nói 'ít nhất … 3'; 4 nút loại từng xu")
        pg.click(".pz-cs-ed .chip:has-text('Đối thủ thích nghi')")
        check(pg.locator(".pz-cs-ed .pz-cs-cbtn").count() == 0, "chế độ đối thủ: ẩn phần chọn bí mật cố định")
        pg.click(".pz-cs-ed .pz-cs-step[aria-label='Tăng']")
        pg.click(".pz-cs-ed .pz-cs-step[aria-label='Tăng']")
        pg.wait_for_function("document.querySelector('.cr-status') && /Không|không|✗/.test(document.querySelector('.cr-status').innerText)", timeout=20000)
        check("✗" in pg.inner_text(".cr-status"), "6 xu với 3 lần cân: vỏ báo '✗ …' (không đủ — cần 4 lần)", pg.inner_text(".cr-status"))
        pg.focus(".pz-cs-ed .chip:has-text('Bí mật cố định')")
        pg.keyboard.press("Enter")
        fo = pg.evaluate(JS_FOCUS)
        check(not fo["inBody"] and fo["txt"].startswith("Bí mật cố định") and fo["pressed"] == "true", "chip 'Bí mật cố định' bằng Enter: focus ở lại đúng chip, không rơi về BODY", fo)
        pg.evaluate("location.hash = '#/'")
    finally:
        E.close()
        br.close()


# ---------------------------------------------------------------------------------------------- chạy trên trình duyệt của check.py
def run(P, check, section, tid):
    pg = P.pg
    br = pg.context.browser

    # ======================================================================= vẽ bàn (chồng xu)
    section("  — bàn chồng xu: vẽ đúng theo state")
    P.start(tid, "chong", "medium", SEED + 40)
    g = P.game()
    d = g["data"]
    n = d["n"]
    check(pg.locator(".board-host .pz-cs-stk").count() == n and d["form"] == "stack" and d["mode"] == "fixed", "bàn %d chồng vẽ đúng %d bộ chọn (chong, %d lần, cố định)" % (n, n, d["k"]), (pg.locator(".board-host .pz-cs-stk").count(), d["form"]))
    check(stat_text(pg) == "Còn %d / %d lần cân" % (d["k"], d["k"]) and "Bí mật cố định" in pg.inner_text(".board-host .pz-cs-mode") and "chồng × %d xu" % d["c"] in pg.inner_text(".board-host .pz-cs-stats"), "thông số: 'Còn k / k lần cân', 'n chồng × c xu', 'Bí mật cố định'", pg.inner_text(".board-host .pz-cs-stats"))
    labels = pg.evaluate("[...document.querySelectorAll('.board-host .pz-cs-stk')].map(c => c.getAttribute('aria-label'))")
    check(all(labels[i] == "Chồng %d (%d xu), chưa cân lần nào" % (i + 1, d["c"]) for i in range(n)), "aria-label mỗi chồng từ type.describeCell", labels[:2])
    check(pg.get_attribute(".board-host .pz-cs-lcd", "role") == "img" and lcd_text(pg) == "0 g" and "Chưa cân lần nào" in pg.inner_text(".board-host .pz-cs-caption"), "màn hình cân: role=img, '0 g', 'Chưa cân lần nào'")
    check(pg.get_attribute(".board-host .pz-cs-tray", "role") == "group" and pg.locator(".board-host .pz-cs-stk[tabindex='0']").count() == 1, "khay role=group, đúng 1 chồng có tabindex 0 (roving)")
    check(pg.is_disabled(".board-host .pz-cs-weigh") and "Chọn số xu lấy" in pg.inner_text(".board-host .pz-cs-reason"), "chưa chọn xu: nút Cân vô hiệu kèm lý do")

    section("  — chồng xu: bấm +/−, lý do vô hiệu, xoá lựa chọn")
    pg.click(pm(0, "+"))
    pg.click(pm(0, "+"))
    pg.click(pm(1, "+"))
    check(pg.inner_text(stk(0) + " .pz-cs-stkval") == "2" and pg.inner_text(stk(1) + " .pz-cs-stkval") == "1" and pg.locator(".board-host .pz-cs-stk.has").count() == 2, "bấm +: chồng 1 lấy 2 xu, chồng 2 lấy 1 xu; chồng đang lấy có viền dày")
    check(pg.locator(stk(0) + " .pz-cs-dot.on").count() == 2 and pg.locator(stk(1) + " .pz-cs-dot.on").count() == 1, "chấm xu: số chấm tô = số xu lấy (hình, không chỉ màu)")
    check("Đang chuẩn bị lần cân 1: lấy 3 xu" in pg.inner_text(".board-host .pz-cs-caption") and "nếu toàn xu thật sẽ là 30 g" in pg.inner_text(".board-host .pz-cs-caption") and lcd_text(pg) == "— g", "dòng mô tả 'lấy 3 xu … toàn xu thật sẽ là 30 g'", pg.inner_text(".board-host .pz-cs-caption"))
    check(not pg.is_disabled(".board-host .pz-cs-weigh") and pg.inner_text(".board-host .pz-cs-reason").strip() == "", "đã chọn xu: nút Cân bật, không còn lý do")
    pg.click(pm(0, "-"))
    check(pg.inner_text(stk(0) + " .pz-cs-stkval") == "1", "bấm −: giảm còn 1")
    pg.click(".board-host .pz-cs-clear")
    check(pg.evaluate("[...document.querySelectorAll('.board-host .pz-cs-stkval')].every(e => e.textContent === '0')") and pg.is_disabled(".board-host .pz-cs-weigh") and pg.is_disabled(".board-host .pz-cs-clear"), "'Xoá lựa chọn': mọi chồng về 0, Cân và Xoá vô hiệu")
    hs = pg.evaluate("[...document.querySelectorAll('.board-host .pz-cs-act, .board-host .pz-cs-pm')].map(b => [Math.round(b.getBoundingClientRect().width), Math.round(b.getBoundingClientRect().height)])")
    check(len(hs) >= 3 + 2 * n and all(w >= 44 and h_ >= 44 for w, h_ in hs), "nút Cân / Xoá / Kết luận và mọi nút +/− cao & rộng ≥ 44 px (%d nút)" % len(hs), [x for x in hs if x[0] < 44 or x[1] < 44][:3])

    # ======================================================================= cân thật + oracle vật lý
    section("  — cân: số gam = vật lý độc lập, nhật ký, hoàn tác")
    take = [i % (d["c"] + 1) for i in range(n)]
    take[0] = 1
    for i, t in enumerate(take):
        for _ in range(t):
            pg.click(pm(i, "+"))
    pg.click(".board-host .pz-cs-weigh")
    g = P.game()
    tk, res = records(g)[0]
    want = phys_stack(take, d["secret"])
    check(tk == take and grams_of(d, (tk, res)) == want and lcd_text(pg).replace(" ", "") == str(want) + "g", "số gam của lần cân = vật lý độc lập (chồng giả %d): %d g; màn hình số khớp" % (d["secret"] + 1, want), (tk, res, want, lcd_text(pg)))
    check(pg.locator(".board-host .pz-cs-logrow").count() == 1 and ("%d g" % want).replace(",", " ") in pg.inner_text(".board-host .pz-cs-logres").replace(" ", " ") or str(want) in pg.inner_text(".board-host .pz-cs-logrow").replace(" ", "").replace(" ", ""), "nhật ký có dòng 'Lần 1: lấy … → %d g' kèm mức nền 'toàn xu thật'" % want, pg.inner_text(".board-host .pz-cs-logrow"))
    check(stat_text(pg).startswith("Còn %d / %d" % (d["k"] - 1, d["k"])), "'Còn %d / %d lần cân' sau lần cân đầu" % (d["k"] - 1, d["k"]), stat_text(pg))
    pg.click(".toolbar button:has-text('Hoàn tác')")
    check(len(records(P.game())) == 0 and pg.locator(".board-host .pz-cs-logrow").count() == 0 and lcd_text(pg) == "0 g", "Hoàn tác: nhật ký trống, màn hình về '0 g'")

    # ======================================================================= tương phản, co giãn
    section("  — tương phản (sáng + tối), co giãn 360 px với 40 chồng và 6 xu")
    low = []
    for theme in ("light", "dark"):
        pg.evaluate("t => { document.documentElement.dataset.theme = t }", theme)
        for fg, bg, lab in (("--pz-cs-lcd-ink", "--pz-cs-lcd", "chữ số trên màn hình"), ("--pz-cs-lcd-dim", "--pz-cs-lcd", "nhãn màn hình"), ("--pz-cs-coin-ink", "--pz-cs-coin", "chữ trên xu"), ("--pz-cs-pan-ink", "--pz-cs-pan", "chữ trên khay"), ("--text", "--elev", "chữ thẻ chồng"),
                            ("--pz-cs-on", "--elev", "ký hiệu ⚖ trên thẻ")):
            c = pg.evaluate("""([fg, bg]) => { const f = document.createElement('i'), b = document.createElement('i'); f.style.color = 'var(' + fg + ')'; b.style.color = 'var(' + bg + ')'; document.body.append(f, b); const o = [getComputedStyle(f).color, getComputedStyle(b).color]; f.remove(); b.remove(); return o; }""", [fg, bg])
            r = ratio(rgb(c[0]), rgb(c[1]))
            if r < 4.5:
                low.append("%s %s = %.2f" % (theme, lab, r))
        c = pg.evaluate("""() => { const f = document.createElement('i'), k = document.createElement('i'); f.style.color = 'var(--pz-cs-coin-edge)'; k.style.color = 'var(--pz-cs-pan)'; document.body.append(f, k); const o = [getComputedStyle(f).color, getComputedStyle(k).color]; f.remove(); k.remove(); return o; }""")
        if ratio(rgb(c[0]), rgb(c[1])) < 3:
            low.append("%s viền xu / khay < 3:1" % theme)
    pg.evaluate("t => { document.documentElement.dataset.theme = t }", "light")
    check(not low, "tương phản --pz-cs-* ≥ 4,5:1 (chữ) / ≥ 3:1 (viền xu) ở giao diện sáng và tối", low)

    ctx = br.new_context(viewport={"width": 360, "height": 740}, service_workers="block", reduced_motion="reduce")
    p2 = ctx.new_page()
    errs = []
    p2.on("pageerror", lambda e: errs.append(str(e)))
    p2.goto(P.url, wait_until="load")
    p2.wait_for_function("document.body.classList.contains('ready')", timeout=30000)
    p2.evaluate("location.hash = '#/new/coinscale?size=chong&tier=hard&seed=%d&o=mode:adv&go=1'" % (SEED + 70))
    p2.wait_for_selector(".board-host .pz-cs-stk", timeout=30000)
    p2.wait_for_timeout(300)
    m = p2.evaluate("""() => { const cs = [...document.querySelectorAll('.board-host .pz-cs-stk')].map(c => { const r = c.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }),
      bt = [...document.querySelectorAll('.board-host .pz-cs-pm')].map(c => { const r = c.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
      return { n: cs.length, minw: Math.min(...cs.map(x => x[0])), minbw: Math.min(...bt.map(x => x[0])), minbh: Math.min(...bt.map(x => x[1])), sw: document.documentElement.scrollWidth, iw: innerWidth, tray: document.querySelector('.board-host .pz-cs-tray').getBoundingClientRect().right }; }""")
    check(m["n"] >= 20 and m["minbw"] >= 44 and m["minbh"] >= 44 and m["sw"] <= m["iw"] + 1 and m["tray"] <= m["iw"] + 1, "360 px, bàn %d chồng: mọi nút +/− ≥ 44×44 px, trang không tràn ngang" % m["n"], m)
    bad = p2.evaluate("""() => { const W = innerWidth, bad = []; for (const el of document.querySelectorAll('.board-host *')) { const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) bad.push(el.className + ' ' + Math.round(r.left) + '..' + Math.round(r.right)); } return bad.slice(0, 5); }""")
    check(not bad, "360 px: không phần tử nào của bàn chồng xu ra ngoài khung", bad)
    p2.evaluate("location.hash = '#/new/coinscale?size=hailoai&tier=expert&seed=%d&o=mode:adv&go=1'" % (SEED + 71))
    p2.wait_for_selector(".board-host .pz-cs-coin", timeout=30000)
    p2.wait_for_timeout(500)
    m2 = p2.evaluate("""() => { const cs = [...document.querySelectorAll('.board-host .pz-cs-coin')].map(c => { const r = c.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }), W = innerWidth, bad = [];
      for (const el of document.querySelectorAll('.board-host *')) { const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) bad.push(el.className); }
      return { n: cs.length, minw: Math.min(...cs.map(x => x[0])), minh: Math.min(...cs.map(x => x[1])), sw: document.documentElement.scrollWidth, iw: W, bad: bad.slice(0, 4) }; }""")
    check(m2["n"] == 6 and m2["minw"] >= 44 and m2["minh"] >= 44 and m2["sw"] <= m2["iw"] + 1 and not m2["bad"], "360 px, bàn 6 xu hai loại: mọi xu ≥ 44×44 px, không tràn ngang", m2)
    p2.evaluate("location.hash = '#/create/coinscale'")
    p2.wait_for_selector(".pz-cs-ed", timeout=15000)
    p2.wait_for_timeout(400)
    ov = p2.evaluate("[document.documentElement.scrollWidth, innerWidth]")
    check(ov[0] <= ov[1] + 1, "360 px: trình soạn không tràn ngang", ov)
    check(not errs, "không lỗi JS ở ngữ cảnh 360 px + giảm chuyển động", errs)
    ctx.close()

    # ======================================================================= WebKit iPhone 13 (chạm thật)
    section("  — WebKit iPhone 13: chạm +, xu, Cân")
    box = {}
    th = threading.Thread(target=lambda: box.update(webkit_touch(P.url)))
    th.start()
    th.join(180)
    if box.get("err") and ("Executable doesn't exist" in box["err"] or "browserType.launch" in box["err"]):
        print("  (bỏ qua WebKit: %s)" % box["err"].splitlines()[0][:100])
    else:
        check(box.get("ok") and box.get("val") == "2" and box.get("log") == 1 and box.get("on") == 2 and box.get("log2") == 1 and box["overflow"][0] <= box["overflow"][1] + 1 and not box.get("errs"),
              "iPhone 13 (WebKit): chạm + (2 xu, 1 xu), Cân → 1 dòng nhật ký; ván hai loại: chạm 2 xu, Cân → 1 dòng; không tràn ngang, không lỗi JS", box)

    edge_p6b(P, check, section, tid)
