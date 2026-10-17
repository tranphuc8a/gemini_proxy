# -*- coding: utf-8 -*-
"""Kiểm riêng của bàn LIGHTS OUT (assets/js/ui/boards/lightsout.js + assets/css/board-lightsout.css) bằng trình duyệt thật.

check.py nạp tệp này và gọi run(P, check, section, tid) sau khi chạy vòng đời chung của mọi loại (xem tang_2). P là Page của check.py (P.pg = Playwright page).
Phần nào cần ngữ cảnh khác (nhiều bề rộng, giảm chuyển động, WebKit iPhone 13) thì tự mở thêm bằng cùng lớp Page: type(P)(browser, P.url, tên, **tuỳ chọn).

Nguồn sự thật ĐỘC LẬP: luật chữ thập được viết lại ở đây bằng khoảng cách Manhattan <= 1 (không dùng engine) để so với state sau mỗi lần bấm."""

from __future__ import annotations

import threading

SEED = 20261017


# ---------------------------------------------------------------------------------------------- tiện ích
def cross(w, h, i):
    """Tập ô bị đảo khi bấm ô i — suy từ hình học: các ô cách ô i đúng 0 hoặc 1 bước (Manhattan)."""
    r, c = divmod(i, w)
    return set(j for j in range(w * h) if abs(j // w - r) + abs(j % w - c) <= 1)


def rgb(s):
    import re
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
  const g = Puz.ui.app.ctx().getGame(id);
  return { id: g.id, w: g.puzzle.data.w, h: g.puzzle.data.h, presses: g.puzzle.data.presses, v: g.state.v.slice(), moves: g.counters.moves, status: g.status,
           initial: g.puzzle.initial.v.slice(), hint: g.lastHint };
}"""
JS_DOM = "() => [...document.querySelectorAll('.board-host .pz-lo-cell')].map(c => c.classList.contains('on') ? 1 : 0)"

JS_CONTRACT = r"""() => {
  const T = Puz.types.get('lightsout'), made = T.fromInput({ w: 3, h: 3, v: [0, 1, 0, 1, 1, 1, 0, 1, 0] }), p = made.puzzle, out = {};
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:0;top:0;width:320px;z-index:99999;background:#fff;';
  const host = document.createElement('div'); host.className = 'board-host'; wrap.append(host);
  const host2 = document.createElement('div'); host2.className = 'board-host'; wrap.append(host2);
  document.body.append(wrap);
  const mk = (g, ro, hostEl) => Puz.boards.lightsout.mount(hostEl, { game: g, puzzle: p, type: T, U: Puz.ui, readOnly: ro, settings: () => ({}), announce: () => {} });
  const idxs = (hostEl, cls) => [...hostEl.querySelectorAll('.pz-lo-cell.' + cls)].map(c => +c.dataset.i).sort((a, b) => a - b);
  const dom = (hostEl) => [...hostEl.querySelectorAll('.pz-lo-cell')].map(c => c.classList.contains('on') ? 1 : 0);
  const g = Puz.game.create(p, {}), v = mk(g, false, host);
  v.highlight([4], 'hint'); out.hint = idxs(host, 'hint');
  v.highlight([0, 1, 3], 'replay'); out.replay = idxs(host, 'replay'); out.hintGone = idxs(host, 'hint');
  v.highlight([], null); out.cleared = idxs(host, 'hint').concat(idxs(host, 'replay'));
  g.act({ k: 'press', i: 0 }); out.extAct = dom(host); out.extState = g.state.v.slice();
  Puz.game.applyDiff(g.state, [['v', 8, g.state.v[8], g.state.v[8] ? 0 : 1], ['v', 2, g.state.v[2], g.state.v[2] ? 0 : 1]], false);
  v.refresh(); out.refresh = dom(host); out.refreshState = g.state.v.slice();
  // readOnly
  const g2 = Puz.game.create(p, {}), v2 = mk(g2, true, host2), cell = host2.querySelector('.pz-lo-cell[data-i="4"]'), r = cell.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  const ev = (t) => cell.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 3, pointerType: 'mouse', isPrimary: true, clientX: x, clientY: y, button: 0 }));
  ev('pointerover'); out.hoverRo = host2.querySelectorAll('.pz-lo-cell.xp, .pz-lo-cell.xp-c').length;
  ev('pointerdown'); ev('pointerup');
  cell.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
  out.roMoves = g2.counters.moves; out.roDom = dom(host2); out.roState = g2.state.v.slice(); out.roAria = host2.querySelector('.pz-lo-grid').getAttribute('aria-readonly');
  v2.destroy();
  // destroy
  const keep = host.querySelector('.pz-lo-cell[data-i="8"]'); out.beforeDestroyOn = keep.classList.contains('on');
  v.destroy(); const res = g.act({ k: 'press', i: 8 });
  out.afterDestroyOn = keep.classList.contains('on'); out.hostEmpty = host.children.length === 0; out.actAfterOk = !!res.ok;
  wrap.remove();
  return out;
}"""


def gstate(pg):
    return pg.evaluate(JS_GAME)


def dom_v(pg):
    return pg.evaluate(JS_DOM)


def cell(i):
    return ".board-host .pz-lo-cell[data-i='%d']" % i


def stats(pg):
    return [t.strip() for t in pg.evaluate("[...document.querySelectorAll('.board-host .pz-lo-stat')].map(e => e.textContent)")]


def fire(pg, sel, typ, dx=0, dy=0, pid=7):
    """Bắn một Pointer Event cảm ứng tổng hợp vào giữa phần tử (dx, dy = lệch toạ độ)."""
    return pg.evaluate("""([sel, typ, dx, dy, pid]) => {
      const el = document.querySelector(sel), r = el.getBoundingClientRect(), x = r.left + r.width / 2 + dx, y = r.top + r.height / 2 + dy;
      el.dispatchEvent(new PointerEvent(typ, { bubbles: true, cancelable: true, pointerId: pid, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, button: 0, buttons: typ === 'pointerup' ? 0 : 1 }));
      return [x, y];
    }""", [sel, typ, dx, dy, pid])


def pv(pg, expr):
    """Giá trị tính toán (computed) của biến màu / thuộc tính, thành chuỗi rgb(...)."""
    return pg.evaluate("""(css) => { const p = document.createElement('i'); p.style.color = css; document.body.append(p); const c = getComputedStyle(p).color; p.remove(); return c; }""", expr)


def webkit_touch(url):
    """Chạy trong luồng riêng (Playwright đồng bộ không lồng được trong luồng đang chạy): WebKit + iPhone 13, thao tác CHẠM thật."""
    out = {"ok": False, "err": ""}
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as pw:
            br = pw.webkit.launch()
            ctx = br.new_context(**pw.devices["iPhone 13"], service_workers="block")
            pg = ctx.new_page()
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            pg.goto(url, wait_until="load")
            pg.wait_for_function("document.body.classList.contains('ready')", timeout=30000)
            pg.evaluate("location.hash = '#/new/lightsout?size=5&tier=easy&seed=%d&go=1'" % (SEED + 31))
            pg.wait_for_selector(".board-host .pz-lo-grid", timeout=30000)
            pg.wait_for_timeout(300)
            out["before"] = pg.evaluate(JS_GAME)
            pg.tap(cell(12))
            pg.wait_for_timeout(350)
            out["after"] = pg.evaluate(JS_GAME)
            out["dom"] = pg.evaluate(JS_DOM)
            out["overflow"] = pg.evaluate("[document.documentElement.scrollWidth, innerWidth, document.querySelector('.board-host .pz-lo-grid').getBoundingClientRect().right]")
            out["cell"] = pg.evaluate("(() => { const r = document.querySelector('.board-host .pz-lo-cell').getBoundingClientRect(); return [r.width, r.height]; })()")
            pg.tap(cell(0))
            pg.wait_for_timeout(250)
            pg.tap(cell(0))
            pg.wait_for_timeout(250)
            out["twice"] = pg.evaluate(JS_GAME)
            # giữ ≥ 300 ms: hiện chữ thập, nhả thì bấm (cảm ứng tổng hợp vì Playwright không có "giữ")
            fire(pg, cell(18), "pointerdown", pid=11)
            pg.wait_for_timeout(450)
            out["hold_xp"] = pg.evaluate("[document.querySelectorAll('.board-host .pz-lo-cell.xp').length, document.querySelectorAll('.board-host .pz-lo-cell.xp-c').length]")
            fire(pg, cell(18), "pointerup", pid=11)
            pg.wait_for_timeout(250)
            out["held"] = pg.evaluate(JS_GAME)
            out["xp_after"] = pg.evaluate("document.querySelectorAll('.board-host .pz-lo-cell.xp, .board-host .pz-lo-cell.xp-c').length")
            # trình soạn: chạm bật một đèn
            pg.evaluate("location.hash = '#/create/lightsout'")
            pg.wait_for_selector(".pz-lo-ed-grid", timeout=15000)
            pg.wait_for_timeout(300)
            before_lit = pg.locator(".pz-lo-ed-grid .pz-lo-cell.on").count()
            pg.tap(".pz-lo-ed-grid .pz-lo-cell[data-i='3']")
            pg.wait_for_timeout(300)
            out["ed"] = [before_lit, pg.locator(".pz-lo-ed-grid .pz-lo-cell.on").count(), pg.evaluate("[document.documentElement.scrollWidth, innerWidth]")]
            out["errs"] = errs
            out["ok"] = True
            br.close()
    except Exception as e:  # noqa: BLE001
        out["err"] = "%s: %s" % (type(e).__name__, e)
    return out


# ---------------------------------------------------------------------------------------------- kiểm
def run(P, check, section, tid):
    pg = P.pg
    PageCls = type(P)
    br = pg.context.browser

    # ======================================================================= vẽ bàn
    section("  — bàn chơi: vẽ đúng theo state")
    P.start(tid, "5", "easy", SEED + 40)
    g = gstate(pg)
    w, h, n = g["w"], g["h"], g["w"] * g["h"]
    cells = pg.locator(".board-host .pz-lo-cell").count()
    check(cells == n and w == 5 and h == 5, "bàn 5×5 vẽ đúng %d nút" % n, (cells, w, h))
    check(pg.get_attribute(".board-host .pz-lo-grid", "role") == "grid" and pg.locator(".board-host .pz-lo-row[role=row]").count() == h and pg.locator(".board-host [role=gridcell]").count() == n,
          "vùng bàn role=grid > %d hàng role=row > %d ô role=gridcell" % (h, n))
    check(dom_v(pg) == g["v"] and sum(g["v"]) > 0, "ô sáng trong DOM khớp state (%d đèn sáng)" % sum(g["v"]), (dom_v(pg), g["v"]))
    st = stats(pg)
    K = len(g["presses"])
    check(st[0].startswith(str(sum(g["v"])) + " đèn sáng") and st[1].startswith("0 lần bấm") and st[2] == "Ít nhất %d lần bấm" % K, "số đèn sáng, số lần bấm và 'Ít nhất K lần bấm' (K = %d) hiển thị đúng" % K, st)
    labels = pg.evaluate("[...document.querySelectorAll('.board-host .pz-lo-cell')].map(c => c.getAttribute('aria-label'))")
    check(all(labels[i].startswith("Hàng %d, cột %d, đèn %s" % (i // w + 1, i % w + 1, "bật" if g["v"][i] else "tắt")) for i in range(n)), "aria-label mỗi ô: hàng, cột, đèn bật/tắt (từ type.describeCell)", labels[:3])

    section("  — đèn bật/tắt phân biệt không chỉ bằng màu")
    on_i, off_i = g["v"].index(1), g["v"].index(0)
    probe = """(i) => { const c = document.querySelector(".board-host .pz-lo-cell[data-i='" + i + "']"), s = getComputedStyle(c), core = getComputedStyle(c.querySelector('.core')), rays = getComputedStyle(c.querySelector('.rays')), lit = getComputedStyle(c.querySelector('.pz-lo-lit'));
      return { bg: s.backgroundColor, ink: s.color, edge: s.borderTopColor, coreFill: core.fill, raysOp: rays.opacity, litOp: lit.opacity, litImg: lit.backgroundImage, label: c.getAttribute('aria-label') }; }"""
    on, off = pg.evaluate(probe, on_i), pg.evaluate(probe, off_i)
    check(float(on["raysOp"]) > 0.9 and float(off["raysOp"]) < 0.1, "đèn BẬT có 8 tia, đèn TẮT không (hình dạng khác)", (on["raysOp"], off["raysOp"]))
    check(on["coreFill"] not in ("none", "rgba(0, 0, 0, 0)") and off["coreFill"] in ("none", "rgba(0, 0, 0, 0)"), "đèn BẬT là đĩa đặc, đèn TẮT là vòng rỗng", (on["coreFill"], off["coreFill"]))
    check("đèn bật" in on["label"] and "đèn tắt" in off["label"], "nhãn đọc màn hình nói rõ bật/tắt")
    # độ sáng thang xám: ô bật (nền vàng) và ô tắt (nền tối) phải khác nhau rõ (>= 3:1) kể cả khi mù màu
    hi, base = rgb(pv(pg, "var(--pz-lo-on-hi)")), rgb(pv(pg, "var(--pz-lo-on)"))
    offbg = rgb(off["bg"])
    check(min(ratio(hi, offbg), ratio(base, offbg)) >= 3, "độ sáng ô bật so với ô tắt >= 3:1 (khác nhau cả ở thang xám)", (round(ratio(hi, offbg), 2), round(ratio(base, offbg), 2)))

    # ======================================================================= bấm
    section("  — bấm ô: đảo đúng chữ thập")
    def press_check(i, label):
        before = gstate(pg)
        pg.click(cell(i))
        pg.wait_for_timeout(60)
        after = gstate(pg)
        flipped = set(j for j in range(n) if before["v"][j] != after["v"][j])
        expect = cross(w, h, i)
        check(flipped == expect and len(flipped) == len(expect), "bấm %s (ô %d) đảo đúng %d ô" % (label, i, len(expect)), (sorted(flipped), sorted(expect)))
        check(dom_v(pg) == after["v"], "  … DOM vẽ lại khớp state sau khi bấm %s" % label)
        return before, after

    press_check(12, "giữa")
    press_check(0, "góc trên-trái")
    press_check(2, "cạnh trên")
    press_check(24, "góc dưới-phải")
    g1 = gstate(pg)
    check(g1["moves"] == 4, "đếm lần bấm: sau 4 lần bấm moves = 4", g1["moves"])
    st = stats(pg)
    check(st[1].startswith("4 lần bấm") and st[0].startswith(str(sum(g1["v"])) + " đèn sáng"), "chip 'lần bấm' và 'đèn sáng' cập nhật theo ván", st)
    pg.click(cell(12))
    pg.click(cell(12))
    g2 = gstate(pg)
    check(g2["v"] == g1["v"] and g2["moves"] == 6, "bấm cùng một ô hai lần → trở lại như cũ (và tính 2 lần bấm)", (g2["moves"],))
    pg.click(".toolbar button:has-text('Hoàn tác')")
    g3 = gstate(pg)
    check(dom_v(pg) == g3["v"] and g3["v"] != g2["v"], "Hoàn tác: bàn vẽ lại khớp state")
    pg.click(".toolbar button:has-text('Làm lại')")
    check(dom_v(pg) == gstate(pg)["v"] == g2["v"], "Làm lại: bàn vẽ lại khớp state")

    # ======================================================================= xem trước chữ thập
    section("  — trợ giúp thị giác: tô chữ thập sẽ bị đảo")
    pg.hover(cell(12))
    pg.wait_for_timeout(120)
    xp = pg.evaluate("[...document.querySelectorAll('.board-host .pz-lo-cell.xp, .board-host .pz-lo-cell.xp-c')].map(c => +c.dataset.i).sort((a, b) => a - b)")
    check(xp == sorted(cross(w, h, 12)) and pg.locator(".board-host .pz-lo-cell.xp-c").count() == 1, "rê chuột vào ô giữa: tô đúng 5 ô (1 ô tâm + 4 kề)", xp)
    pg.hover(cell(0))
    pg.wait_for_timeout(120)
    xp = pg.evaluate("[...document.querySelectorAll('.board-host .pz-lo-cell.xp, .board-host .pz-lo-cell.xp-c')].map(c => +c.dataset.i).sort((a, b) => a - b)")
    check(xp == sorted(cross(w, h, 0)), "rê vào góc: chỉ tô 3 ô", xp)
    pg.mouse.move(2, 2)
    pg.wait_for_timeout(120)
    check(pg.locator(".board-host .pz-lo-cell.xp, .board-host .pz-lo-cell.xp-c").count() == 0, "rời bàn: bỏ tô")
    before = gstate(pg)
    fire(pg, cell(6), "pointerdown", pid=21)
    pg.wait_for_timeout(450)
    cnt = pg.evaluate("[document.querySelectorAll('.board-host .pz-lo-cell.xp').length, document.querySelectorAll('.board-host .pz-lo-cell.xp-c').length]")
    check(cnt == [4, 1], "cảm ứng: giữ ≥ 300 ms hiện chữ thập (không cần hover)", cnt)
    fire(pg, cell(6), "pointerup", pid=21)
    pg.wait_for_timeout(120)
    after = gstate(pg)
    flipped = set(j for j in range(n) if before["v"][j] != after["v"][j])
    check(flipped == cross(w, h, 6) and pg.locator(".board-host .pz-lo-cell.xp, .board-host .pz-lo-cell.xp-c").count() == 0, "… nhả ngón tay trên đúng ô thì bấm và bỏ tô")
    before = gstate(pg)
    fire(pg, cell(6), "pointerdown", pid=22)
    fire(pg, cell(6), "pointermove", dx=40, dy=0, pid=22)
    fire(pg, cell(6), "pointerup", dx=40, dy=0, pid=22)
    pg.wait_for_timeout(120)
    check(gstate(pg)["v"] == before["v"], "cảm ứng: kéo ngón tay đi xa (>10 px) thì huỷ, không bấm nhầm")
    before = gstate(pg)
    fire(pg, cell(6), "pointerdown", pid=23)
    pg.wait_for_timeout(450)
    fire(pg, cell(6), "pointercancel", pid=23)
    pg.wait_for_timeout(100)
    check(gstate(pg)["v"] == before["v"] and pg.locator(".board-host .pz-lo-cell.xp-c").count() == 0, "pointercancel (trình duyệt lấy cử chỉ cuộn) → không bấm, bỏ tô")

    # ======================================================================= bàn phím
    section("  — bàn phím: mũi tên + Space/Enter")
    P.start(tid, "5", "easy", SEED + 41)
    g = gstate(pg)
    check(pg.locator(".board-host .pz-lo-cell[tabindex='0']").count() == 1, "roving tabindex: đúng một ô tabindex=0")
    pg.focus(cell(0))
    pg.keyboard.press("ArrowRight")
    check(pg.evaluate("document.activeElement.dataset.i") == "1", "→ sang ô 1")
    pg.keyboard.press("ArrowDown")
    check(pg.evaluate("document.activeElement.dataset.i") == str(1 + w), "↓ xuống ô %d" % (1 + w))
    pg.keyboard.press("ArrowLeft")
    pg.keyboard.press("ArrowLeft")
    check(pg.evaluate("document.activeElement.dataset.i") == str(w), "← ở cột đầu thì đứng yên (ô %d)" % w)
    pg.keyboard.press("ArrowUp")
    pg.keyboard.press("ArrowUp")
    check(pg.evaluate("document.activeElement.dataset.i") == "0", "↑ ở hàng đầu thì đứng yên (ô 0)")
    pg.keyboard.press("End")
    check(pg.evaluate("document.activeElement.dataset.i") == str(w - 1), "End → cuối hàng")
    pg.keyboard.press("Home")
    check(pg.evaluate("document.activeElement.dataset.i") == "0", "Home → đầu hàng")
    check(pg.locator(".board-host .pz-lo-cell[tabindex='0']").count() == 1 and pg.evaluate("document.activeElement.getAttribute('tabindex')") == "0", "tabindex=0 đi theo ô đang focus")
    pg.keyboard.press("ArrowRight")
    pg.keyboard.press("ArrowDown")                       # ô w+1 = ô 6
    xp = pg.evaluate("[...document.querySelectorAll('.board-host .pz-lo-cell.xp, .board-host .pz-lo-cell.xp-c')].map(c => +c.dataset.i).sort((a, b) => a - b)")
    check(xp == sorted(cross(w, h, 6)), "focus bàn phím cũng tô chữ thập", xp)
    before = gstate(pg)
    pg.keyboard.press("Space")
    after = gstate(pg)
    check(set(j for j in range(n) if before["v"][j] != after["v"][j]) == cross(w, h, 6) and after["moves"] == 1, "Space bấm ô đang focus (ô 6): đảo chữ thập, moves = 1")
    check(pg.evaluate("document.activeElement.dataset.i") == "6", "sau khi bấm, focus vẫn ở ô vừa bấm (DOM không dựng lại)")
    lab = pg.get_attribute(cell(6), "aria-label")
    check(lab.startswith("Hàng 2, cột 2, đèn " + ("bật" if after["v"][6] else "tắt")), "aria-label cập nhật theo state mới", lab)
    pg.keyboard.press("ArrowRight")
    before = after
    pg.keyboard.press("Enter")
    after = gstate(pg)
    check(set(j for j in range(n) if before["v"][j] != after["v"][j]) == cross(w, h, 7), "Enter cũng bấm ô đang focus (ô 7)")
    pg.keyboard.press("Tab")
    check(pg.evaluate("!document.activeElement.classList.contains('pz-lo-cell')"), "Tab rời khỏi lưới (một điểm dừng Tab cho cả bàn)")

    # ======================================================================= gợi ý
    section("  — highlight: gợi ý tô ô cần bấm")
    P.start(tid, "5", "easy", SEED + 42)
    pg.click(".toolbar button:has-text('Gợi ý')")
    pg.wait_for_selector(".hint-panel:not([hidden])")
    h1 = gstate(pg)["hint"]
    hl = pg.evaluate("[...document.querySelectorAll('.board-host .pz-lo-cell.hint')].map(c => +c.dataset.i).sort((a, b) => a - b)")
    check(h1 and h1["cells"] and hl == sorted(h1["cells"]) and len(hl) == w, "hint mức 1: tô đúng cả hàng gợi ý (%d ô)" % len(hl), (hl, h1 and h1["cells"]))
    check(pg.evaluate("getComputedStyle(document.querySelector('.board-host .pz-lo-cell.hint'), '::after').borderTopStyle") == "dashed", "ô được gợi ý có viền NÉT ĐỨT (không chỉ màu)")
    pg.click(".hint-panel button:has-text('Chi tiết hơn')")
    pg.click(".hint-panel button:has-text('Chi tiết hơn')")
    h3 = gstate(pg)["hint"]
    hl = pg.evaluate("[...document.querySelectorAll('.board-host .pz-lo-cell.hint')].map(c => +c.dataset.i)")
    check(h3["level"] == 3 and hl == [h3["action"]["i"]], "hint mức 3: chỉ tô đúng ô action.i = %s" % h3["action"]["i"], (hl, h3["action"]))
    lab = pg.get_attribute(cell(h3["action"]["i"]), "aria-label")
    check("gợi ý" in lab, "ô được gợi ý có nói 'gợi ý' trong nhãn đọc màn hình", lab)
    pg.click(".hint-panel button:has-text('Áp dụng nước này')")
    after = gstate(pg)
    check(pg.locator(".board-host .pz-lo-cell.hint").count() == 0 and after["moves"] == 1 and dom_v(pg) == after["v"], "áp dụng gợi ý: bỏ tô, bàn đảo chữ thập")

    # ======================================================================= giải thật qua giao diện
    section("  — giải ván nhỏ bằng cách bấm đúng các ô trong data.presses")
    P.start(tid, "3", "easy", SEED + 43)
    g = gstate(pg)
    presses = g["presses"]
    w3 = g["w"]
    for k, i in enumerate(presses):
        pg.click(cell(i))
        pg.wait_for_timeout(40)
    pg.wait_for_selector("dialog[open] h2:has-text('Đã giải')", timeout=10000)
    gs = gstate(pg)
    check(gs["status"] == "solved" and sum(gs["v"]) == 0 and gs["moves"] == len(presses), "bấm %d ô trong data.presses → ván 'solved', mọi đèn tắt" % len(presses), (gs["status"], gs["moves"]))
    check(pg.locator("dialog[open] .stat-grid").count() == 1, "hộp thoại 'Đã giải!' hiện")
    pg.keyboard.press("Escape")
    pg.wait_for_selector("dialog[open]", state="detached")
    check(dom_v(pg) == [0] * (w3 * g["h"]) and pg.locator(".board-host .pz-lo-grid.is-solved").count() == 1 and pg.locator(".board-host .pz-lo-grid.is-locked").count() == 1, "bàn đã giải: tối hết, viền xanh 'is-solved', khoá thao tác")
    pg.click(cell(0))
    check(gstate(pg)["moves"] == len(presses) and dom_v(pg) == [0] * (w3 * g["h"]), "bàn đã giải không nhận thêm lần bấm")
    pg.click(".play-status button:has-text('Replay')")
    toast = ""
    try:                                                   # chờ panel replay HOẶC một thông báo lỗi (toast tự tắt sau ~4,5 s nên đọc ngay khi hiện)
        pg.wait_for_function("document.querySelector('.replay-panel:not([hidden])') || document.querySelector('.toast')", timeout=20000)
        toast = pg.evaluate("[...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | ')")
    except Exception:  # noqa: BLE001
        pass
    replay_ok = pg.locator(".replay-panel:not([hidden])").count() == 1
    check(replay_ok, "vỏ dựng được replay lời giải (engine.replay chạy trong Web Worker) rồi mới vẽ lên bàn", toast)
    if replay_ok:
        pg.click(".replay-panel button:has-text('Sau')")
        pg.wait_for_timeout(150)
        rp = pg.evaluate("[...document.querySelectorAll('.board-host .pz-lo-cell.replay')].map(c => +c.dataset.i).sort((a, b) => a - b)")
        check(pg.locator(".board-host .pz-lo-grid[aria-readonly=true]").count() == 1 and set(rp) == cross(w3, g["h"], presses[0]), "replay bước 1: bàn chỉ-đọc, tô (xanh, nét liền) đúng các ô vừa đổi (%d ô)" % len(rp), rp)
        check(pg.evaluate("getComputedStyle(document.querySelector('.board-host .pz-lo-cell.replay'), '::after').borderTopStyle") == "solid", "replay viền NÉT LIỀN (khác gợi ý nét đứt)")
        check(dom_v(pg) != [0] * (w3 * g["h"]), "replay: view.refresh() vẽ lại từ state của replay (sau bước 1 còn đèn sáng)")
        pg.click(".replay-panel button[aria-label='Tới cuối']")
        pg.wait_for_timeout(150)
        check(dom_v(pg) == [0] * (w3 * g["h"]), "replay: tới bước cuối → bàn tắt hết")
        pg.click(".replay-panel button[aria-label='Về đầu']")
        pg.wait_for_timeout(150)
        check(dom_v(pg) == g["initial"], "replay: về đầu → đúng bàn ban đầu")
        before = dom_v(pg)
        pg.click(cell(0))
        check(dom_v(pg) == before, "replay (readOnly): bấm ô không đổi bàn")
        pg.click(".replay-panel button:has-text('Thoát replay')")

    # ======================================================================= hợp đồng view (mount trực tiếp, không qua vỏ)
    section("  — hợp đồng view: highlight / refresh / readOnly / destroy (mount trực tiếp)")
    d = pg.evaluate(JS_CONTRACT)
    check(d["hint"] == [4] and d["replay"] == [0, 1, 3] and d["cleared"] == [], "highlight(cells, 'hint'|'replay'|null): tô đúng ô, kind mới thay kind cũ, null xoá", (d["hint"], d["replay"], d["cleared"]))
    check(d["extAct"] == d["extState"], "game.act gọi từ bên ngoài (không qua bàn): bàn tự vẽ lại theo ev.diff", (d["extAct"], d["extState"]))
    check(d["refresh"] == d["refreshState"], "refresh() vẽ lại từ game.state khi state đổi ngoài act (replay)", (d["refresh"], d["refreshState"]))
    check(d["roMoves"] == 0 and d["roDom"] == d["roState"] and d["roAria"] == "true", "readOnly: bấm chuột + Space không gửi action (moves=0), aria-readonly=true")
    check(d["afterDestroyOn"] == d["beforeDestroyOn"] and d["hostEmpty"] and d["actAfterOk"], "destroy(): gỡ listener game.on (ô cũ không đổi nữa), làm rỗng host, game vẫn dùng được")
    check(d["hoverRo"] == 0, "readOnly: rê chuột không tô chữ thập (không thể bấm)")

    # ======================================================================= màu sắc: tương phản của --pz-lo-*
    section("  — tương phản màu riêng của bàn (đo từ giá trị tính toán thật)")
    P.start(tid, "5", "easy", SEED + 44)
    low = []
    for theme in ("light", "dark"):
        pg.evaluate("t => { document.documentElement.dataset.theme = t }", theme)
        pg.wait_for_timeout(250)
        col = {k: rgb(pv(pg, "var(--%s)" % k)) for k in ("pz-lo-panel", "pz-lo-off", "pz-lo-off-edge", "pz-lo-off-ink", "pz-lo-on", "pz-lo-on-hi", "pz-lo-on-edge", "pz-lo-on-ink", "pz-lo-xp-ring", "pz-lo-xp-in", "star", "pz-good", "accent", "bg", "pz-line-strong")}
        pairs = [("ký hiệu ô tắt / nền ô tắt >= 4.5", col["pz-lo-off-ink"], col["pz-lo-off"], 4.5),
                 ("ký hiệu ô bật / nền vàng (đậm) >= 4.5", col["pz-lo-on-ink"], col["pz-lo-on"], 4.5), ("ký hiệu ô bật / nền vàng (nhạt) >= 4.5", col["pz-lo-on-ink"], col["pz-lo-on-hi"], 4.5),
                 ("viền ô tắt / nền bàn >= 3", col["pz-lo-off-edge"], col["pz-lo-panel"], 3.0),
                 ("khung bàn / nền trang >= 3", col["pz-line-strong"], col["bg"], 3.0), ("viền gợi ý (--star) / nền bàn >= 3", col["star"], col["pz-lo-panel"], 3.0),
                 ("viền replay (--pz-good) / nền bàn >= 3", col["pz-good"], col["pz-lo-panel"], 3.0), ("vòng focus (--accent) / nền bàn >= 3", col["accent"], col["pz-lo-panel"], 3.0)]
        if max(ratio(col["pz-lo-on"], col["pz-lo-panel"]), ratio(col["pz-lo-on-edge"], col["pz-lo-panel"])) < 3:
            low.append("%s ranh giới ô bật (nền vàng hoặc viền) / nền bàn < 3" % theme)
        for name, a, b, need in pairs:
            r = ratio(a, b)
            if r < need:
                low.append("%s %s = %.2f" % (theme, name, r))
        # ô tắt: ranh giới ô so với nền bàn — nền ô HOẶC viền ô phải >= 3:1 (viền đã kiểm ở trên); xem trước chữ thập: vòng đôi trắng + vòng màu nên ít nhất một vòng >= 3:1 trên mọi nền ô
        for nm, bgc in (("ô tắt", col["pz-lo-off"]), ("ô bật đậm", col["pz-lo-on"]), ("ô bật nhạt", col["pz-lo-on-hi"])):
            best = max(ratio(col["pz-lo-xp-in"], bgc), ratio(col["pz-lo-xp-ring"], bgc))
            if best < 3:
                low.append("%s vòng xem trước trên %s = %.2f" % (theme, nm, best))
    pg.evaluate("t => { document.documentElement.dataset.theme = t }", "light")
    check(not low, "mọi cặp màu riêng của bàn đạt (chữ/ký hiệu >= 4,5:1; viền/khung/vòng >= 3:1) ở chế độ sáng và tối", low)

    # ======================================================================= co giãn
    section("  — co giãn 280–1920 px, không tràn ngang")
    for width in (280, 360, 768, 1280, 1920):
        Q = PageCls(br, P.url, "lo-%d" % width, viewport={"width": width, "height": 800})
        try:
            ok_all, why, cell7 = True, [], 0
            for size in ("7", "3"):
                Q.start(tid, size, "easy", SEED + 50)
                m = Q.pg.evaluate("""() => { const g = document.querySelector('.board-host .pz-lo-grid').getBoundingClientRect(), c = document.querySelector('.board-host .pz-lo-cell').getBoundingClientRect(),
                  host = document.querySelector('.board-host').getBoundingClientRect();
                  return { sw: document.documentElement.scrollWidth, iw: innerWidth, right: g.right, left: g.left, host: host.width, cell: c.width, cellh: c.height }; }""")
                if m["sw"] > m["iw"] or m["right"] > m["iw"] + 0.5 or m["left"] < -0.5:
                    ok_all = False
                    why.append((size, m))
                if size == "7":
                    cell7 = m["cell"]
                    if m["cell"] < 28 or abs(m["cell"] - m["cellh"]) > 1:
                        ok_all = False
                        why.append(("ô nhỏ hoặc không vuông", size, m))
            check(ok_all, "bàn chơi %d px: 7×7 và 3×3 không tràn ngang, ô 7×7 >= 28 px và vuông (đo %.1f px)" % (width, cell7), why)
            Q.go("#/create/lightsout", 400)
            try:
                Q.pg.wait_for_selector(".pz-lo-ed-grid", timeout=10000)
            except Exception:  # noqa: BLE001 — hiếm: IndexedDB đọc bản nháp chậm lúc nhiều ngữ cảnh chạy song song; thử mở lại một lần
                Q.go("#/", 300)
                Q.go("#/create/lightsout", 600)
                Q.pg.wait_for_selector(".pz-lo-ed-grid", timeout=20000)
            for _ in range(5):
                Q.pg.click(".pz-lo-dim >> nth=0 >> button[aria-label^='Tăng']")
            Q.pg.wait_for_timeout(200)
            m = Q.pg.evaluate("""() => { const g = document.querySelector('.pz-lo-ed-grid').getBoundingClientRect(), c = document.querySelector('.pz-lo-ed-grid .pz-lo-cell').getBoundingClientRect();
              return { n: document.querySelectorAll('.pz-lo-ed-grid .pz-lo-cell').length, sw: document.documentElement.scrollWidth, iw: innerWidth, right: g.right, cell: c.width }; }""")
            need = 28 if width >= 360 else 20
            check(m["n"] == 100 and m["sw"] <= m["iw"] and m["right"] <= m["iw"] + 0.5 and m["cell"] >= need, "trình soạn %d px: 10×10 không tràn ngang, ô %.1f px (>= %d)" % (width, m["cell"], need), m)
        finally:
            Q.close()

    # ======================================================================= giảm chuyển động
    section("  — chuyển động: có lật nhẹ, tắt khi prefers-reduced-motion")
    P.start(tid, "5", "easy", SEED + 45)
    pg.click(cell(12))
    pg.wait_for_timeout(40)
    anim = pg.evaluate("[...document.querySelectorAll('.board-host .pz-lo-cell.flip')].map(c => getComputedStyle(c).animationName)")
    check(len(anim) >= 3 and all(a == "pz-lo-flip" for a in anim), "mặc định: các ô vừa đảo có hoạt ảnh lật (pz-lo-flip)", anim)
    R = PageCls(br, P.url, "lo-reduced", viewport={"width": 900, "height": 800}, reduced_motion="reduce")
    try:
        R.start(tid, "5", "easy", SEED + 45)
        R.pg.click(cell(12))
        R.pg.wait_for_timeout(40)
        d = R.pg.evaluate("""() => { const c = document.querySelector(".board-host .pz-lo-cell[data-i='12']"), s = getComputedStyle(c), r = getComputedStyle(c.querySelector('.rays'));
          return { anim: s.animationName, flip: c.classList.contains('flip'), tr: s.transitionDuration, trRays: r.transitionDuration }; }""")
        def secs(txt):
            return max(float(x.strip().rstrip("s")) for x in txt.split(","))
        check(d["anim"] == "none" and not d["flip"] and secs(d["tr"]) <= 0.001 and secs(d["trRays"]) <= 0.001, "prefers-reduced-motion: không hoạt ảnh, chuyển tiếp <= 1 ms (tức tắt)", d)
        R.pg.click(".toolbar button:has-text('Gợi ý')")
        R.pg.wait_for_selector(".hint-panel:not([hidden])")
        ha = R.pg.evaluate("getComputedStyle(document.querySelector('.board-host .pz-lo-cell.hint'), '::after').animationName")
        check(ha == "none", "prefers-reduced-motion: viền gợi ý không nhấp nháy", ha)
    finally:
        R.close()

    # ======================================================================= trình soạn
    section("  — trình soạn: cỡ, bật/tắt đèn, ngẫu nhiên, kiểm tra đề")
    P.go("#/create/lightsout", 400)
    pg.wait_for_selector(".pz-lo-ed-grid", timeout=10000)
    pg.click(".ph-act button:has-text('Làm mới')")
    pg.click("dialog[open] button:has-text('Bắt đầu lại')")
    pg.wait_for_timeout(500)

    def ed_lit():
        return pg.evaluate("[...document.querySelectorAll('.pz-lo-ed-grid .pz-lo-cell')].map(c => c.classList.contains('on') ? 1 : 0)")

    def wait_status(timeout=15000):
        pg.wait_for_function("(() => { const t = document.querySelector('.cr-status').textContent; return t.trim().length > 0 && t.indexOf('Đang kiểm tra') < 0; })()", timeout=timeout)

    def sel(which):
        return ".pz-lo-dim >> nth=%d >> select" % which

    check(pg.locator(".pz-lo-ed-grid .pz-lo-cell").count() == 25 and sum(ed_lit()) == 0, "mở trình soạn trống: bàn 5×5, chưa bật đèn nào")
    check("ít nhất một đèn" in pg.inner_text(".pz-lo-info"), "có chữ hướng dẫn 'hãy bật ít nhất một đèn'", pg.inner_text(".pz-lo-info"))
    wait_status()
    check(pg.locator(".cr-status .form-err").count() >= 1 and "tắt hết" in pg.inner_text(".cr-status") and pg.locator(".create-side button:has-text('Chơi thử')").is_disabled(), "bàn tắt hết sẵn → vỏ báo lỗi và khoá 'Chơi thử'", pg.inner_text(".cr-status"))
    check(pg.get_attribute(".pz-lo-ed-grid", "role") == "grid" and pg.locator(".pz-lo-ed-grid [role=gridcell]").count() == 25 and pg.locator(".pz-lo-ed-grid .pz-lo-cell[tabindex='0']").count() == 1, "lưới soạn: role=grid, 25 gridcell, một tabindex=0")
    for i in (7, 11, 12, 13, 17):
        pg.click(".pz-lo-ed-grid .pz-lo-cell[data-i='%d']" % i)
    check(ed_lit() == [1 if i in (7, 11, 12, 13, 17) else 0 for i in range(25)] and "5 trên 25" in pg.inner_text(".pz-lo-info"), "bấm 5 ô: bật đúng 5 đèn, hiện '5 trên 25 đèn đang sáng'", pg.inner_text(".pz-lo-info"))
    wait_status()
    txt = pg.inner_text(".cr-status")
    check(pg.locator(".cr-diff").count() == 1 and pg.locator(".cr-status .form-err").count() == 0 and ("nghiệm" in txt or "cách giải" in txt) and not pg.locator(".create-side button:has-text('Chơi thử')").is_disabled(), "bàn chữ thập (giải được): trạng thái kiểm tra hiện số nghiệm + độ khó, mở khoá 'Chơi thử'", txt.replace("\n", " | "))
    pg.keyboard.press("Escape")
    pg.click(".pz-lo-ed-grid .pz-lo-cell[data-i='7']")
    check(ed_lit()[7] == 0 and sum(ed_lit()) == 4, "bấm lại ô đang sáng thì tắt")
    pg.click(".pz-lo-ed-grid .pz-lo-cell[data-i='7']")
    # bàn phím trong trình soạn
    pg.focus(".pz-lo-ed-grid .pz-lo-cell[data-i='0']")
    pg.keyboard.press("ArrowRight")
    pg.keyboard.press("ArrowDown")
    pg.keyboard.press("Space")
    check(ed_lit()[6] == 1 and pg.evaluate("document.activeElement.dataset.i") == "6", "trình soạn: mũi tên + Space bật ô 6 và giữ focus")
    pg.keyboard.press("Enter")
    check(ed_lit()[6] == 0, "trình soạn: Enter bật/tắt ô đang focus")
    lab = pg.get_attribute(".pz-lo-ed-grid .pz-lo-cell[data-i='7']", "aria-label")
    check(lab.startswith("Hàng 2, cột 3, đèn bật"), "trình soạn: aria-label ô nói bật/tắt", lab)

    # đổi cỡ giữ nguyên các đèn còn nằm trong bàn mới
    pg.select_option(sel(0), "3")
    pg.wait_for_timeout(150)
    n3 = pg.locator(".pz-lo-ed-grid .pz-lo-cell").count()
    check(n3 == 9, "đổi rộng 5 → 3 (đang 'Bàn vuông'): cao đổi theo, còn 9 ô", n3)
    check(ed_lit() == [1 if i in (5, 7, 8) else 0 for i in range(9)], "thu nhỏ 5×5 → 3×3 giữ các đèn ở (hàng,cột) cũ", ed_lit())
    pg.select_option(sel(0), "4")
    pg.wait_for_timeout(150)
    lit4 = ed_lit()
    expect4 = [0] * 16
    for (r, c) in ((1, 2), (2, 1), (2, 2)):
        expect4[r * 4 + c] = 1
    check(pg.locator(".pz-lo-ed-grid .pz-lo-cell").count() == 16 and lit4 == expect4, "phóng 3×3 → 4×4 giữ đèn cũ, ô mới tắt", lit4)
    pg.select_option(sel(0), "3")
    pg.wait_for_timeout(100)
    pg.click("button:has-text('Tắt hết')")
    for i in (1, 3, 4, 5, 7):
        pg.click(".pz-lo-ed-grid .pz-lo-cell[data-i='%d']" % i)
    wait_status()
    txt = pg.inner_text(".cr-status")
    check("Có đúng một nghiệm" in txt and pg.locator(".cr-diff").count() == 1, "3×3 chữ thập: 'Có đúng một nghiệm' + độ khó", txt.replace("\n", " | "))
    pg.click(".create-side button:has-text('Chơi thử')")
    pg.wait_for_selector(".board-host .pz-lo-grid", timeout=15000)
    gp = gstate(pg)
    check(gp["w"] == 3 and gp["h"] == 3 and gp["initial"] == [0, 1, 0, 1, 1, 1, 0, 1, 0] and gp["presses"] == [4], "'Chơi thử': ván mở đúng bàn đã soạn (onChange phát đúng dạng {w,h,v}); K = 1 (bấm ô giữa)", (gp["initial"], gp["presses"]))
    pg.click(cell(4))
    pg.wait_for_selector("dialog[open] h2:has-text('Đã giải')", timeout=10000)
    check(True, "chơi thử rồi giải bằng một lần bấm ô giữa → 'Đã giải'")
    pg.keyboard.press("Escape")

    # ngẫu nhiên luôn giải được, tắt hết, hình chữ nhật, giới hạn
    P.go("#/create/lightsout", 500)
    pg.wait_for_selector(".pz-lo-ed-grid", timeout=10000)
    pg.select_option(sel(0), "4")
    pg.wait_for_timeout(150)
    good = 0
    for _ in range(5):
        pg.click("button:has-text('Bàn ngẫu nhiên')")
        wait_status()
        if sum(ed_lit()) >= 1 and pg.locator(".cr-diff").count() == 1 and pg.locator(".cr-status .form-err").count() == 0:
            good += 1
    check(good == 5, "'Bàn ngẫu nhiên' 4×4 (chỉ 1/16 bàn bất kỳ giải được): 5/5 lần ra bàn có đèn sáng VÀ giải được (%d/5)" % good)
    pg.click("button:has-text('Tắt hết')")
    wait_status()
    check(sum(ed_lit()) == 0 and "ít nhất một đèn" in pg.inner_text(".pz-lo-info") and pg.locator(".cr-status .form-err").count() >= 1, "'Tắt hết' → 0 đèn, chữ hướng dẫn và lỗi từ vỏ")
    pg.click("button:has-text('Bàn vuông')")
    check(pg.get_attribute("button:has-text('Bàn vuông')", "aria-pressed") == "false", "nút 'Bàn vuông' tắt được (aria-pressed=false)")
    pg.select_option(sel(1), "6")
    pg.wait_for_timeout(150)
    check(pg.locator(".pz-lo-ed-grid .pz-lo-cell").count() == 24 and pg.get_attribute(".pz-lo-ed-grid", "aria-colcount") == "4" and pg.get_attribute(".pz-lo-ed-grid", "aria-rowcount") == "6", "bàn chữ nhật 4×6: 24 ô, aria-colcount=4, aria-rowcount=6")
    pg.click(".pz-lo-ed-grid .pz-lo-cell[data-i='0']")
    pg.click(".pz-lo-ed-grid .pz-lo-cell[data-i='1']")
    pg.click(".pz-lo-ed-grid .pz-lo-cell[data-i='4']")
    wait_status()
    pg.select_option(sel(0), "2")
    pg.wait_for_timeout(100)
    check(pg.locator(".pz-lo-dim >> nth=0 >> button[aria-label^='Giảm']").is_disabled() and pg.locator(".pz-lo-ed-grid .pz-lo-cell").count() == 12, "rộng = 2: nút '−' khoá; bàn 2×6 = 12 ô")
    pg.select_option(sel(1), "10")
    check(pg.locator(".pz-lo-dim >> nth=1 >> button[aria-label^='Tăng']").is_disabled(), "cao = 10: nút '+' khoá")
    pg.click("button:has-text('Bàn vuông')")
    check(pg.locator(".pz-lo-ed-grid .pz-lo-cell").count() == 4, "bật lại 'Bàn vuông' khi rộng ≠ cao (2×10) thì làm vuông ngay theo chiều rộng (2×2 = 4 ô)", pg.locator(".pz-lo-ed-grid .pz-lo-cell").count())
    heights = pg.evaluate("[...document.querySelectorAll('.create-body .pz-lo-ed .btn, .create-body .pz-lo-ed select')].map(e => [e.textContent.trim().slice(0, 14), Math.round(e.getBoundingClientRect().height)])")
    check(len(heights) >= 7 and all(hh >= 44 for _, hh in heights), "mọi nút/ô chọn của trình soạn cao >= 44 px (%d điều khiển)" % len(heights), [x for x in heights if x[1] < 44])

    # bản nháp được khôi phục từ env.input; sửa bản sao từ env.puzzle
    pg.click("button:has-text('Tắt hết')")
    pg.select_option(sel(0), "4")
    pg.wait_for_timeout(100)
    for i in (5, 6, 9):
        pg.click(".pz-lo-ed-grid .pz-lo-cell[data-i='%d']" % i)
    pg.wait_for_timeout(900)
    dims_before, lit_before = pg.locator(".pz-lo-ed-grid .pz-lo-cell").count(), ed_lit()
    P.reload()
    P.go("#/create/lightsout", 500)
    pg.wait_for_selector(".pz-lo-ed-grid", timeout=10000)
    check(pg.locator(".pz-lo-ed-grid .pz-lo-cell").count() == dims_before and ed_lit() == lit_before, "tải lại trang: bản nháp khôi phục đúng cỡ và các đèn (khởi tạo từ env.input)", (dims_before, sum(lit_before)))
    v = [0] * 12
    for j in cross(4, 3, 5):
        v[j] = 1
    pid = pg.evaluate("""async (v) => { const t = Puz.types.get('lightsout'), r = t.fromInput({ w: 4, h: 3, v: v }); if (!r.ok) return 'loi:' + r.errors.join('|');
      await Puz.ui.app.ctx().user.savePuzzle(r.puzzle, { name: 'Bàn kiểm thử', source: 'custom' }); return r.puzzle.id; }""", v)
    P.go("#/create/lightsout?edit=" + pid, 600)
    pg.wait_for_selector(".pz-lo-ed-grid", timeout=10000)
    check(pg.locator(".pz-lo-ed-grid .pz-lo-cell").count() == 12 and pg.get_attribute(".pz-lo-ed-grid", "aria-colcount") == "4" and ed_lit() == v and pg.get_attribute("button:has-text('Bàn vuông')", "aria-pressed") == "false",
          "'Sửa bản sao': trình soạn mở puzzle 4×3 đã lưu (khởi tạo từ env.puzzle), giữ nguyên các đèn, không ép vuông", (ed_lit(), v))

    # dọn những gì phần kiểm này đã thêm vào kho dữ liệu của phiên (để các phép kiểm sau trong check.py không bị lệch): puzzle đã lưu, bản nháp
    P.go("#/", 400)
    pg.evaluate("""async (pid) => { const u = Puz.ui.app.ctx().user; if (pid && pid.indexOf('loi:') !== 0) await u.removePuzzle(pid); await u.dropDraft('edit:lightsout'); }""", pid)

    # ======================================================================= WebKit + chạm
    section("  — WebKit (iPhone 13): chạm thật")
    res = {}
    th = threading.Thread(target=lambda: res.update(webkit_touch(P.url)))
    th.start()
    th.join(180)
    check(res.get("ok"), "WebKit iPhone 13 chạy được kịch bản chạm", res.get("err"))
    if res.get("ok"):
        b0, a0 = res["before"], res["after"]
        wn, hn = b0["w"], b0["h"]
        check(set(j for j in range(wn * hn) if b0["v"][j] != a0["v"][j]) == cross(wn, hn, 12) and a0["moves"] == 1 and res["dom"] == a0["v"], "chạm ô giữa: đảo đúng chữ thập, moves = 1, DOM khớp")
        check(res["twice"]["moves"] == 3 and res["twice"]["v"] == a0["v"], "chạm cùng một ô hai lần → trở lại như cũ")
        check(res["hold_xp"] == [4, 1] and res["xp_after"] == 0, "giữ ngón tay ≥ 300 ms: hiện chữ thập 5 ô; nhả thì bỏ tô", (res["hold_xp"], res["xp_after"]))
        check(set(j for j in range(wn * hn) if res["twice"]["v"][j] != res["held"]["v"][j]) == cross(wn, hn, 18), "… và nhả ngón tay thì bấm (ô 18)")
        check(res["overflow"][0] <= res["overflow"][1] and res["overflow"][2] <= res["overflow"][1] + 0.5 and res["cell"][0] >= 40, "iPhone 13: không tràn ngang, ô 5×5 rộng %.0f px" % res["cell"][0], res["overflow"])
        check(res["ed"][0] == 0 and res["ed"][1] == 1 and res["ed"][2][0] <= res["ed"][2][1], "iPhone 13: chạm ô trong trình soạn bật đèn; trang không tràn ngang", res["ed"])
        check(not res["errs"], "WebKit: không lỗi console/pageerror", res["errs"][:3])
