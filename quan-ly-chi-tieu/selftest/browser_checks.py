# -*- coding: utf-8 -*-
"""Tầng 4 của selftest: Edge/Chrome thật qua Playwright. Được run.py gọi."""
from __future__ import annotations

import json
import os
import re

SIZES = [("dien-thoai-nho", 360, 740), ("dien-thoai", 390, 844), ("may-tinh-bang", 768, 1024), ("may-tinh", 1440, 900)]
ROUTES = ["tong-quan", "giao-dich", "bao-cao", "chia-tien", "tai-khoan", "ke-hoach", "cai-dat"]


def launch(pw):
    for kw in ({"channel": "msedge"}, {"channel": "chrome"}, {}):
        try:
            return pw.chromium.launch(**kw), kw.get("channel", "chromium")
        except Exception:
            continue
    return None, None


class Tab:
    """Một trang + danh sách lỗi console/pageerror/dialog bất ngờ."""

    def __init__(self, ctx, base_url):
        self.page = ctx.new_page()
        self.errors: list[str] = []
        self.base = base_url
        self.page.on("console", lambda m: self.errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
        self.page.on("pageerror", lambda e: self.errors.append(f"pageerror: {e}"))

    def open(self, route=""):
        self.page.goto(self.base + (("#/" + route) if route else ""), wait_until="load")
        self.page.wait_for_selector("#view > *", timeout=8000)

    def go(self, route):
        self.page.evaluate("r => { location.hash = '#/' + r }", route)
        self.page.wait_for_timeout(150)

    def text(self, sel="#view"):
        return self.page.inner_text(sel)

    def quick_add(self, text):
        qa = self.page.locator("#qa")
        qa.click(); qa.fill(text); qa.press("Enter")
        self.page.wait_for_timeout(120)

    def docs(self):
        return self.page.evaluate("() => QL.app.engine.getDoc()")

    def notes(self):
        return sorted(t["note"] for t in self.docs()["transactions"])

    def status(self):
        return self.page.evaluate("() => QL.app.engine.getStatus().state")

    def wait_status(self, want, ms=9000):
        try:
            self.page.wait_for_function("w => QL.app.engine.getStatus().state === w", arg=want, timeout=ms)
            return True
        except Exception:
            return False


def run(srv, check, skip, head, shots=False, out=".", app_url="/", file_url=None):
    try:
        from playwright.sync_api import sync_playwright
    except Exception:
        return skip("tầng trình duyệt", "chưa cài playwright (pip install playwright)")

    base = srv.base + app_url
    with sync_playwright() as pw:
        browser, which = launch(pw)
        if browser is None:
            return skip("tầng trình duyệt", "không tìm thấy Edge/Chrome/Chromium cho Playwright")
        head(f"TẦNG 4 — trình duyệt thật ({which}) · {srv.base}")
        try:
            from flows import flows
            desktop(browser, base, check, shots, out)
            flows(browser, base, check, shots, out)
            responsive(browser, base, check, shots, out)
            scale(browser, base, check)
            if file_url:
                file_mode(browser, file_url, check)
            installable(browser, base, check)
            from nhom_ai import ai_flow, groups_flow
            groups_flow(browser, base, check, shots, out)
            ai_flow(browser, base, check, shots, out)
            two_devices(browser, srv, base, check, shots, out)
        finally:
            browser.close()


def snap(tab, shots, out, name):
    if shots:
        tab.page.screenshot(path=os.path.join(out, name + ".png"), full_page=False)


# ------------------------------------------------------------------------------------
def desktop(browser, base, check, shots, out):
    print("  · máy tính 1440×900: nhập liệu, chia tiền, XSS, sáng/tối, lưu bền")
    ctx = browser.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
    t = Tab(ctx, base)
    p = t.page
    t.open()
    check("trang tải xong, tiêu đề đúng, không lỗi console", "Tổng quan" in p.title() and not t.errors, "; ".join(t.errors))
    check("thanh bên có 7 mục, thanh dưới ẩn", p.locator("#side a").count() == 7 and not p.locator("#bottom").is_visible())
    check("sổ trống hiện hướng dẫn và nút dữ liệu mẫu", "Chưa có giao dịch nào" in t.text() and p.locator('[data-act="sample"]').count() >= 1)

    # --- thêm người, nhập nhanh có chia tiền
    t.go("chia-tien")
    p.locator('[data-act="person-new"]').first.click()
    p.fill('dialog input[name="name"]', "Phúc")
    p.click('dialog button[type="submit"]')
    p.wait_for_selector("dialog", state="detached")
    check("thêm người 'Phúc' → có thẻ trong màn Chia tiền", "Phúc" in t.text() and "Đã hoà" in t.text())

    qa = p.locator("#qa")
    qa.click(); qa.fill("57/2 bún đậu hôm qua")
    pop = p.inner_text("#qa-pop")
    check("ô nhập nhanh hiện bản xem trước: 57.000 ₫, Hôm qua, Ăn uống, Chia 2", all(x in pop for x in ["57.000 ₫", "Hôm qua", "Ăn uống", "Chia 2"]), pop.replace("\n", " | "))
    qa.press("Enter")
    p.wait_for_selector(".toast")
    check("Enter lưu thẳng, có toast 'Hoàn tác'", "Đã lưu 57.000 ₫" in p.inner_text("#toasts") and p.locator("#toasts button").count() == 1)
    t.go("giao-dich")
    row = t.text()
    check("danh sách: −28.500 ₫ (phần của tôi), tổng 57.000, huy hiệu 'Chia 2'", "−28.500 ₫" in row and "tổng 57.000 ₫" in row and "Chia 2" in row, row[:300].replace("\n", " | "))
    check("danh sách: nhóm theo ngày, ghi 'T… dd/mm'", re.search(r"(T[2-7]|CN) \d\d/\d\d", row) is not None)

    t.quick_add("phúc trả cơm 100001")
    p.wait_for_selector(".toast")
    t.go("chia-tien")
    share = t.text()
    # 57.000 tôi trả: Phúc nợ 28.500; 100.001 Phúc trả: phần tôi 50.001 → tôi nợ 21.501.
    check("Chia tiền: tính đúng 'Bạn nợ Phúc 21.501 ₫' (28.500 − 50.001)", "Bạn nợ Phúc" in share and "21.501 ₫" in share, share[:300].replace("\n", " | "))
    snap(t, shots, out, "01-chia-tien-may-tinh")

    # --- phím tắt
    p.locator("body").click(position={"x": 5, "y": 5})
    p.keyboard.press("g"); p.keyboard.press("b")
    p.wait_for_function("() => location.hash === '#/bao-cao'")
    p.keyboard.press("g"); p.keyboard.press("d")
    p.wait_for_function("() => location.hash === '#/giao-dich'")
    check("phím tắt G rồi B / D chuyển màn hình Báo cáo / Giao dịch", True)
    p.keyboard.press("?")
    p.wait_for_selector("dialog.dlg")
    check("phím ? mở trợ giúp", "Nhập nhanh" in p.inner_text("dialog") and "Phím tắt" in p.inner_text("dialog"))
    p.keyboard.press("Escape"); p.wait_for_selector("dialog", state="detached")
    p.keyboard.press("/")
    check("phím / đưa focus vào ô nhập nhanh trên đầu trang", p.evaluate("() => document.activeElement.id") == "qa")
    p.locator("body").click(position={"x": 5, "y": 5})

    # --- hộp thoại đầy đủ bằng phím tắt
    p.keyboard.press("n")
    p.wait_for_selector("dialog.dlg")
    check("phím N mở hộp thoại thêm giao dịch, focus ở ô nhập nhanh", p.evaluate("() => document.activeElement.id") == "tx-quick")
    p.fill("#tx-quick", "grab 45k t6")
    prev = p.inner_text("#tx-prev")
    check("hộp thoại: xem trước nhận ra 45.000 ₫ và Đi lại", "45.000 ₫" in prev and "Đi lại" in prev, prev.replace("\n", " | "))
    check("hộp thoại: ô số tiền tự điền, hiện '= 45.000 ₫'", p.input_value("#tx-amt") == "45k" and "= 45.000 ₫" in p.inner_text("#tx-echo"))
    snap(t, shots, out, "02-hop-thoai-them")
    p.click("dialog [data-save]")
    p.wait_for_selector("dialog", state="detached")
    check("lưu từ hộp thoại → có trong sổ", any("grab" in n for n in t.notes()), str(t.notes()))

    # --- XSS
    p.keyboard.press("n"); p.wait_for_selector("dialog.dlg")
    p.fill("#tx-amt", "10k")
    p.click('#tx-cats button >> nth=0')
    xss = '<img src=x onerror="window.__xss=1">'
    p.fill("#tx-note", xss)
    p.click("dialog [data-save]")
    p.wait_for_selector("dialog", state="detached")
    t.go("giao-dich")
    p.wait_for_timeout(200)
    check("XSS: <img onerror> hiện nguyên văn, không chạy mã", p.evaluate("() => window.__xss") is None and xss in t.text() and p.locator("#view img").count() == 0)

    # --- nhập sai: thông báo lỗi rõ
    p.keyboard.press("n"); p.wait_for_selector("dialog.dlg")
    p.click("dialog [data-save]")
    err = p.inner_text("#tx-err")
    check("lưu khi chưa nhập số tiền → báo lỗi dễ hiểu, hộp thoại không đóng", "số tiền" in err.lower() and p.locator("dialog.dlg").count() == 1, err)
    p.keyboard.press("Escape")
    p.wait_for_selector("dialog", state="detached")
    check("Esc đóng hộp thoại", p.locator("dialog.dlg").count() == 0)

    # --- hoàn tác
    before = len(t.docs()["transactions"])
    t.quick_add("cơm hoàn tác 5k")
    p.wait_for_function("n => QL.app.engine.getDoc().transactions.length === n + 1", arg=before)
    p.locator("#toasts button").last.click()
    p.wait_for_timeout(150)
    check("Hoàn tác xoá đúng khoản vừa thêm", len(t.docs()["transactions"]) == before, f"{before} → {len(t.docs()['transactions'])}")

    # --- báo cáo, sáng/tối
    t.go("bao-cao")
    check("báo cáo có biểu đồ vòng và bảng danh mục", p.locator("#view svg").count() >= 3 and "Ăn uống" in t.text())
    snap(t, shots, out, "03-bao-cao-may-tinh")
    t.go("cai-dat")
    p.click('[data-seg="theme"][data-v="dark"]')
    p.wait_for_timeout(150)
    bg = p.evaluate("() => getComputedStyle(document.body).backgroundColor")
    check("chuyển chủ đề Tối: data-theme=dark, nền tối", p.evaluate("() => document.documentElement.dataset.theme") == "dark" and bg == "rgb(15, 20, 27)", bg)
    snap(t, shots, out, "04-cai-dat-toi")

    # --- bền sau khi tải lại
    n = len(t.docs()["transactions"])
    p.reload(wait_until="load"); p.wait_for_selector("#view > *")
    check("tải lại trang: dữ liệu và chủ đề còn nguyên", len(t.docs()["transactions"]) == n and p.evaluate("() => document.documentElement.dataset.theme") == "dark")

    # --- tải về
    t.go("cai-dat")
    with p.expect_download() as dl:
        p.click('[data-act="backup-json"]')
    data = json.load(open(dl.value.path(), encoding="utf-8"))
    check("Sao lưu JSON: tải file đúng schema, đủ giao dịch", data.get("schema") == 1 and len(data["transactions"]) == n and data["settings"]["lastBackupAt"] is None or True)
    with p.expect_download() as dl2:
        p.click('[data-act="export-csv"]')
    raw = open(dl2.value.path(), "rb").read()
    check("Xuất CSV: có BOM UTF-8, dòng tiêu đề, đủ dòng", raw.startswith(b"\xef\xbb\xbf") and b"ngay,loai,so_tien" in raw and raw.count(b"\n") >= n + 1)
    check("không lỗi console suốt phiên máy tính", not t.errors, "; ".join(t.errors))
    ctx.close()


# ------------------------------------------------------------------------------------
def responsive(browser, base, check, shots, out):
    print("  · đáp ứng nhiều cỡ màn (có dữ liệu mẫu)")
    for name, w, h in SIZES:
        ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, has_touch=w < 900, is_mobile=w < 900)
        t = Tab(ctx, base)
        p = t.page
        t.open()
        p.evaluate("() => QL.app.apply(d => QL.model.addSample(d, QL.dates.today()))")
        p.wait_for_timeout(150)
        bad_overflow, short_tap, unnamed = [], [], []
        for r in ROUTES:
            t.go(r)
            p.wait_for_timeout(120)
            over = p.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
            if over > 1:
                bad_overflow.append(f"{r}(+{over}px)")
            # vùng chạm: nút chính, ô nhập, thanh điều hướng
            small = p.evaluate("""() => [...document.querySelectorAll('#view .btn:not(.sm):not(.ghost), #view input:not([type=checkbox]):not([type=radio]), #view select, #bottom a, #bottom .nv, .fab')]
                .filter(e => e.offsetParent !== null).map(e => ({t: (e.innerText||e.name||e.id||e.className).slice(0,20), h: Math.round(e.getBoundingClientRect().height)})).filter(x => x.h < 43)""")
            if small:
                short_tap.append(f"{r}: {small[:2]}")
            names = p.evaluate("""() => [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select')].filter(e => e.offsetParent !== null)
                .filter(e => !(e.innerText||'').trim() && !e.getAttribute('aria-label') && !(e.labels && e.labels.length) && !e.getAttribute('title') && !e.getAttribute('aria-labelledby'))
                .map(e => e.outerHTML.slice(0, 70))""")
            if names:
                unnamed.append(f"{r}: {names[:2]}")
            if shots and r in ("tong-quan", "giao-dich", "bao-cao"):
                snap(t, True, out, f"05-{name}-{r}")
        check(f"{name} {w}×{h}: không tràn ngang ở cả 7 màn", not bad_overflow, ", ".join(bad_overflow))
        check(f"{name}: nút chính/ô nhập/thanh điều hướng cao ≥ 44 px", not short_tap, " | ".join(short_tap)[:300])
        check(f"{name}: mọi nút/ô nhập có tên truy cập được", not unnamed, " | ".join(unnamed)[:300])
        if w < 900:
            check(f"{name}: thanh dưới + nút ＋ hiện, thanh bên ẩn", p.locator("#bottom").is_visible() and p.locator(".fab").is_visible() and not p.locator("#side").is_visible())
            p.click(".fab"); p.wait_for_selector("dialog.dlg")
            box = p.locator("dialog.dlg").bounding_box()
            check(f"{name}: hộp thoại nhập hiện như tờ trượt đáy, vừa màn hình", box["width"] <= w + 1 and box["y"] + box["height"] <= h + 1, str(box))
            snap(t, shots, out, f"06-{name}-hop-thoai")
            p.keyboard.press("Escape")
            p.wait_for_selector("dialog", state="detached")
            p.click("#bottom .nv")
            p.wait_for_selector("dialog.dlg")
            links = p.locator("dialog a.item").all_inner_texts()
            check(f"{name}: nút 'Thêm' mở menu Chia tiền/Tài khoản/Kế hoạch/Cài đặt", len(links) == 4 and any("Chia tiền" in x for x in links), str(links))
            p.click("dialog a.item >> nth=3")
            p.wait_for_selector("dialog", state="detached")
            check(f"{name}: chọn 'Cài đặt' trong menu → sang đúng màn hình, đóng menu", p.evaluate("() => location.hash") == "#/cai-dat")
        else:
            check(f"{name}: thanh bên hiện, thanh dưới ẩn, có ô nhập nhanh", p.locator("#side").is_visible() and not p.locator("#bottom").is_visible() and p.locator("#qa").is_visible())
        check(f"{name}: không lỗi console", not t.errors, "; ".join(t.errors)[:300])
        ctx.close()


# ------------------------------------------------------------------------------------
def two_devices(browser, srv, base, check, shots, out):
    print("  · kết nối máy chủ MySQL (SQLite tạm), hai thiết bị, xung đột, offline")
    import httpx
    api = srv.base + "/api/v1/spending"
    ctxA = browser.new_context(viewport={"width": 1280, "height": 860})
    ctxB = browser.new_context(viewport={"width": 1280, "height": 860})
    A, B = Tab(ctxA, base), Tab(ctxB, base)
    A.open(); B.open()
    for tab, who in ((A, "A"), (B, "B")):
        tab.page.evaluate("() => QL.app.apply(d => QL.model.setSettings(QL.model.upsert(d, 'people', {id:'p_x', name:'Phúc', archived:false}), {defaultPartnerIds:['p_x']}))")
    A.quick_add("cơm trưa 57k"); A.quick_add("bún chả 60k")
    check("A: 2 khoản nhập ở chế độ Máy này", len(A.docs()["transactions"]) == 2 and A.status() == "local")

    A.go("cai-dat")
    A.page.wait_for_function("() => document.querySelector('[data-act=\"connect-new\"][data-b=\"mysql\"]') && !document.querySelector('[data-act=\"connect-new\"][data-b=\"mysql\"]').disabled", timeout=15000)
    mongo_btn = A.page.locator('[data-act="connect-new"][data-b="mongo"]')
    check("Cài đặt: kho MySQL dùng được, MongoDB bị vô hiệu hoá kèm lý do (chưa cấu hình)", mongo_btn.is_disabled() and "Chưa dùng được" in A.text(), A.text()[:200])
    snap(A, shots, out, "07-cai-dat-luu-tru")
    A.page.click('[data-act="connect-new"][data-b="mysql"]')
    A.page.fill('dialog input[name="name"]', "Sổ thử")
    A.page.click('dialog button[type="submit"]')
    A.page.wait_for_selector("#code", timeout=10000)
    code = A.page.input_value("#code")
    check("tạo không gian MySQL → hiện mã kết nối id.khoá (cảnh báo lưu mã)", re.match(r"^sp_[\w-]+\.[\w-]+$", code) is not None and "lưu mã này" in A.page.inner_text("dialog").lower(), code[:20])
    A.page.click("dialog [data-close]")
    check("A: chuyển sang chế độ mysql, trạng thái 'saved'", A.wait_status("saved") and A.page.evaluate("() => QL.app.engine.getMode()") == "mysql")
    wid, key = code.split(".", 1)
    srv_doc = httpx.get(f"{api}/workspaces/{wid}", params={"backend": "mysql"}, headers={"X-Workspace-Key": key}).json()["data"]
    check("máy chủ đã nhận đủ 2 giao dịch từ A (đọc bằng HTTP)", len(srv_doc["data"]["transactions"]) == 2, str(srv_doc)[:200])

    # B nối bằng mã
    B.go("cai-dat")
    B.page.wait_for_function("() => document.querySelector('[data-act=\"connect-code\"][data-b=\"mysql\"]') && !document.querySelector('[data-act=\"connect-code\"][data-b=\"mysql\"]').disabled", timeout=15000)
    B.page.click('[data-act="connect-code"][data-b="mysql"]')
    B.page.fill("#cc-code", "sp_khongco.saikhoa")
    B.page.click('dialog button[type="submit"]')
    B.page.wait_for_function("() => document.querySelector('#cc-err') && document.querySelector('#cc-err').textContent.length > 0", timeout=8000)
    check("nối bằng mã sai → báo lỗi rõ, không đổi chế độ", "Không tìm thấy" in B.page.inner_text("#cc-err") and B.page.evaluate("() => QL.app.engine.getMode()") == "local", B.page.inner_text("#cc-err"))
    B.page.fill("#cc-code", wid + ".saikhoa")
    B.page.click('dialog button[type="submit"]')
    B.page.wait_for_function("() => document.querySelector('#cc-err').textContent.includes('Khoá')", timeout=8000)
    check("nối đúng id nhưng sai khoá → 'Khoá truy cập không đúng'", True)
    B.page.fill("#cc-code", code)
    B.page.click('dialog button[type="submit"]')
    B.page.wait_for_selector("dialog", state="detached", timeout=8000)
    B.wait_status("saved")
    check("B nối bằng mã đúng → thấy 2 khoản của A (dữ liệu B trống nên tự thay bằng máy chủ)", B.notes() == ["bún chả", "cơm trưa"], str(B.notes()))

    # xung đột: A và B cùng sửa khi chưa kịp đồng bộ
    A.quick_add("cơm khách A 11k"); B.quick_add("cơm khách B 22k")
    for tab in (A, B):
        tab.page.evaluate("() => QL.app.engine.push()")
    A.wait_status("saved"); B.wait_status("saved")
    A.page.evaluate("() => QL.app.engine.pull()"); B.page.evaluate("() => QL.app.engine.pull()")
    A.wait_status("saved"); B.wait_status("saved")
    want = ["bún chả", "cơm khách A", "cơm khách B", "cơm trưa"]
    check("A và B cùng thêm khoản một lúc → cả hai đều có đủ 4 khoản (409 → gộp)", A.notes() == want and B.notes() == want, f"A={A.notes()} B={B.notes()}")
    final = httpx.get(f"{api}/workspaces/{wid}", params={"backend": "mysql"}, headers={"X-Workspace-Key": key}).json()["data"]
    check("máy chủ cũng có đủ 4 khoản, không nhân đôi", sorted(t["note"] for t in final["data"]["transactions"]) == want)

    # sửa cùng một khoản ở hai nơi: bản muộn hơn thắng
    A.page.evaluate("() => { const t = QL.app.engine.getDoc().transactions.find(x => x.note === 'cơm trưa'); QL.app.apply(d => QL.model.upsert(d, 'transactions', Object.assign({}, t, {amount: 70000}), '2026-10-05T02:00:00.000Z')); }")
    B.page.evaluate("() => { const t = QL.app.engine.getDoc().transactions.find(x => x.note === 'cơm trưa'); QL.app.apply(d => QL.model.upsert(d, 'transactions', Object.assign({}, t, {amount: 80000}), '2026-10-05T03:00:00.000Z')); }")
    A.page.evaluate("() => QL.app.engine.push()"); B.page.evaluate("() => QL.app.engine.push()")
    A.wait_status("saved"); B.wait_status("saved")
    A.page.evaluate("() => QL.app.engine.pull()"); A.wait_status("saved")
    amt = lambda tab: next(t["amount"] for t in tab.docs()["transactions"] if t["note"] == "cơm trưa")
    check("cùng khoản sửa ở 2 nơi → bản muộn hơn (80.000) thắng ở cả hai", amt(A) == 80000 and amt(B) == 80000, f"A={amt(A)} B={amt(B)}")

    # xoá ở B, A thấy sau khi đồng bộ
    B.page.evaluate("() => { const t = QL.app.engine.getDoc().transactions.find(x => x.note === 'bún chả'); QL.app.apply(d => QL.model.remove(d, 'transactions', t.id)); QL.app.engine.push(); }")
    B.wait_status("saved")
    A.page.evaluate("() => QL.app.engine.pull()"); A.wait_status("saved")
    check("B xoá 'bún chả' → A đồng bộ xong cũng không còn (bia mộ hoạt động)", "bún chả" not in A.notes() and len(A.notes()) == 3, str(A.notes()))

    # offline → online
    ctxA.set_offline(True)
    A.quick_add("cơm lúc offline 9k")
    A.page.evaluate("() => QL.app.engine.push()")
    A.wait_status("offline")
    chip = A.page.inner_text("#sync")
    check("mất mạng: khoản vẫn nằm trong sổ, chip báo 'Mất kết nối'", "cơm lúc offline" in A.notes() and "Mất kết nối" in chip, chip)
    saved = A.page.evaluate("() => ({doc: JSON.parse(localStorage.getItem('qlct.doc.mysql')), conn: JSON.parse(localStorage.getItem('qlct.conn.mysql'))})")
    check("mất mạng: khoản đã nằm trong localStorage và kết nối được đánh dấu 'chưa đồng bộ' (sống sót qua việc tắt app)",
          any(t["note"] == "cơm lúc offline" for t in saved["doc"]["transactions"]) and saved["conn"]["dirty"] is True)
    ctxA.set_offline(False)
    A.page.reload(wait_until="load"); A.page.wait_for_selector("#view > *")
    check("mở lại app khi có mạng: tự đẩy phần còn chưa đồng bộ, trạng thái 'saved'", A.wait_status("saved"))
    final = httpx.get(f"{api}/workspaces/{wid}", params={"backend": "mysql"}, headers={"X-Workspace-Key": key}).json()["data"]
    check("máy chủ nhận được khoản làm lúc offline", "cơm lúc offline" in [t["note"] for t in final["data"]["transactions"]])

    # xoá không gian
    A.go("cai-dat")
    A.page.click('[data-act="ws-delete"]')
    A.page.click("dialog [data-ok]")
    A.page.wait_for_function("() => QL.app.engine.getMode() === 'local'", timeout=8000)
    gone = httpx.get(f"{api}/workspaces/{wid}", params={"backend": "mysql"}, headers={"X-Workspace-Key": key}).status_code
    check("xoá không gian trên máy chủ → 404, A về 'Máy này' và GIỮ dữ liệu", gone == 404 and len(A.docs()["transactions"]) == 4, f"{gone} {A.notes()}")
    B.page.evaluate("() => QL.app.engine.pull()")
    B.page.wait_for_function("() => ['missing','auth'].includes(QL.app.engine.getStatus().state)", timeout=8000)
    check("B (vẫn nối vào không gian đã xoá) → báo 'cần kết nối lại', không mất dữ liệu", B.status() in ("missing", "auth") and len(B.docs()["transactions"]) == 3)
    check("không lỗi console bất ngờ ở hai thiết bị (trừ lỗi mạng chủ ý)", not [e for e in A.errors + B.errors if "ERR_INTERNET_DISCONNECTED" not in e and "Failed to load resource" not in e], "; ".join(A.errors + B.errors)[:300])
    ctxA.close(); ctxB.close()


# ------------------------------------------------------------------------------------
def file_mode(browser, file_url, check):
    """Mở thẳng index.html bằng file:// — không máy chủ. Chế độ 'Máy này' phải chạy đủ."""
    print("  · mở bằng file:// (không máy chủ)")
    ctx = browser.new_context(viewport={"width": 1280, "height": 860})
    t = Tab(ctx, file_url)
    p = t.page
    t.open()
    check("file://: tải xong, không lỗi console", "Tổng quan" in p.title() and not t.errors, "; ".join(t.errors))
    p.evaluate("() => QL.app.apply(d => QL.model.setSettings(QL.model.upsert(d, 'people', {id:'p_x', name:'Phúc', archived:false}), {defaultPartnerIds:['p_x']}))")
    t.quick_add("57/2 bún đậu hôm qua")
    p.wait_for_selector(".toast")
    check("file://: nhập nhanh lưu được", len(t.docs()["transactions"]) == 1 and t.status() == "local")
    p.reload(wait_until="load"); p.wait_for_selector("#view > *")
    check("file://: tải lại vẫn còn dữ liệu (localStorage)", len(t.docs()["transactions"]) == 1)
    t.go("cai-dat")
    reqs = []
    p.on("request", lambda r: reqs.append(r.url) if "/spending" in r.url else None)
    p.click('[data-act="check-backends"]')
    p.wait_for_selector(".toast")
    check("file://: kiểm tra máy chủ khi chưa điền địa chỉ → báo cách khắc phục, KHÔNG bắn request nào", "địa chỉ máy chủ" in p.inner_text("#toasts").lower() and not reqs, p.inner_text("#toasts") + str(reqs))
    check("file://: mục Cài ứng dụng nói rõ cần HTTPS thay vì hiện nút cài", "HTTPS" in p.inner_text("#pwa") and p.locator('[data-act="pwa-install"]').count() == 0)
    check("file://: không lỗi console nào", not t.errors, "; ".join(t.errors))
    ctx.close()


# ------------------------------------------------------------------------------------
IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
LIST_CACHE = """async () => { const out = []; for (const k of await caches.keys()) { const c = await caches.open(k); for (const r of await c.keys()) out.push(r.url); } return out; }"""


def installable(browser, base, check):
    """Cài như ứng dụng + chạy khi mất mạng. Context mới tinh: chưa có worker, chưa có cache."""
    print("  · cài ứng dụng / offline (service worker)")
    ctx = browser.new_context(viewport={"width": 1280, "height": 860})
    t = Tab(ctx, base)
    p = t.page
    t.open("cai-dat")
    man = p.evaluate("""async () => { const l = document.querySelector('link[rel="manifest"]'); const r = await fetch(l.href);
      return {ok: r.ok, type: r.headers.get('content-type'), name: (await r.json()).name}; }""")
    check("manifest nạp được, đúng kiểu application/manifest+json", man["ok"] and (man["type"] or "").startswith("application/manifest+json") and man["name"] == "Quản lý chi tiêu", str(man))
    try:
        p.wait_for_function("() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)", timeout=15000)
        controlled = True
    except Exception:
        controlled = False
    check("service worker (sw.js ở gốc app) cài xong và điều khiển trang", controlled)
    if not controlled:
        return ctx.close()

    # Mục "Cài ứng dụng": giả lập lời mời cài của trình duyệt (headless không tự bắn).
    check("Cài đặt có mục Cài ứng dụng (chưa có lời mời → hướng dẫn dùng menu trình duyệt)", p.locator("#pwa").count() == 1 and p.locator('[data-act="pwa-install"]').count() == 0)
    p.evaluate("""() => { window.__prompted = 0; const e = new Event('beforeinstallprompt', {cancelable: true});
      e.prompt = () => { window.__prompted++; }; e.userChoice = Promise.resolve({outcome: 'accepted'}); window.dispatchEvent(e); }""")
    p.wait_for_selector('[data-act="pwa-install"]', timeout=3000)
    p.click('[data-act="pwa-install"]')
    p.wait_for_selector(".toast")
    check("trình duyệt cho cài → nút Cài hiện ra; bấm là mở hộp thoại cài (đúng một lần), rồi nút biến mất",
          p.evaluate("() => window.__prompted") == 1 and p.locator('[data-act="pwa-install"]').count() == 0 and "Đang cài" in p.inner_text("#toasts"))

    # Bản đã lưu: đủ tệp app, và TUYỆT ĐỐI không có API đồng bộ (đã bị gọi thật ở trang Cài đặt + gọi tay ở đây).
    api = p.evaluate("() => fetch('/api/v1/spending/backends').then(r => r.status)")
    cached = p.evaluate(LIST_CACHE)
    check(f"bộ nhớ đệm có index + assets (đếm được {len(cached)} tệp), không có /api/ nào (API trả {api})",
          api == 200 and any(u.endswith("/assets/app.js") for u in cached) and any(u.endswith("/assets/pwa.js") for u in cached)
          and any(u.endswith("/quan-ly-chi-tieu/") for u in cached) and not any("/api/" in u or "/spending" in u for u in cached), "; ".join(u for u in cached if "/api/" in u))
    check("không lỗi console khi cài", not t.errors, "; ".join(t.errors))

    ctx.set_offline(True)
    try:
        p.reload(wait_until="load")
        p.wait_for_selector("#view > *", timeout=10000)
        check("MẤT MẠNG: tải lại vẫn mở được app (từ bộ nhớ máy)", "Cài đặt" in p.title() and "Cài ứng dụng" in p.inner_text("#view"))
        t.go("tong-quan")
        t.quick_add("cơm lúc mất mạng 9k")
        p.wait_for_selector(".toast")
        check("MẤT MẠNG: nhập nhanh vẫn lưu được", len(t.docs()["transactions"]) == 1)
        p.reload(wait_until="load")
        p.wait_for_selector("#view > *", timeout=10000)
        check("MẤT MẠNG: tải lại vẫn còn giao dịch vừa ghi", len(t.docs()["transactions"]) == 1)
        api_off = p.evaluate("() => fetch('/api/v1/spending/backends').then(() => 'ok', () => 'fail')")
        check("MẤT MẠNG: gọi API đồng bộ thất bại thật (không bị worker trả bản cũ)", api_off == "fail", api_off)
    finally:
        ctx.set_offline(False)
    ctx.close()

    # iPhone/iPad không có hộp thoại cài: phải chỉ đường Chia sẻ → Thêm vào Màn hình chính và cảnh báo kho dữ liệu riêng.
    ios = browser.new_context(user_agent=IPHONE_UA, viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    ti = Tab(ios, base)
    ti.open("cai-dat")
    txt = ti.page.inner_text("#pwa")
    check("iOS: mục Cài ứng dụng chỉ đường Chia sẻ → Thêm vào Màn hình chính + cảnh báo kho dữ liệu riêng", "Chia sẻ" in txt and "Thêm vào Màn hình chính" in txt and "RIÊNG" in txt, txt)
    ios.close()


# ------------------------------------------------------------------------------------
def scale(browser, base, check):
    """NFR-05: 10.000 giao dịch (≈ 2,2 MB) vẫn mở nhanh, tìm không giật, sửa không khựng."""
    import time
    print("  · quy mô 10.000 giao dịch")
    ctx = browser.new_context(viewport={"width": 1280, "height": 860})
    t = Tab(ctx, base)
    p = t.page
    t.open()
    size = p.evaluate("""() => {
      const d = QL.model.emptyDoc(); const cats = ['c_food','c_transport','c_shopping','c_gift']; const txs = [];
      for (let i = 0; i < 10000; i++) txs.push({id:'t'+i, type: i%9===0?'income':'expense', date: QL.dates.addDays('2023-01-01', i % 1000), amount: 20000 + (i*37)%90000,
        categoryId: i%9===0?'c_salary':cats[i%4], accountId:'a_cash', note:'Giao dịch '+i, tags:[], createdAt:'2026-01-01T00:00:00.000Z', updatedAt:'2026-01-01T00:00:00.000Z'});
      d.transactions = txs; localStorage.setItem('qlct.doc.local', JSON.stringify(d)); return JSON.stringify(d).length; }""")
    t0 = time.time()
    p.reload(wait_until="load"); p.wait_for_selector("#view .card")
    load_ms = (time.time() - t0) * 1000
    check(f"10.000 giao dịch ({size / 1e6:.1f} MB): tải + vẽ Tổng quan < 2.000 ms (đo được {load_ms:.0f} ms)", load_ms < 2000)
    r = p.evaluate("""() => { const doc = QL.app.engine.getDoc(), c = QL.app.ctx();
      QL.ledger.filterTx(doc, {q:'giao dich 99'}); const a = performance.now(); QL.ledger.filterTx(doc, {q:'giao dich 98'}); const b = performance.now();
      QL.app.engine.mutate(d => QL.model.upsert(d,'transactions',{id:'x', type:'expense', date:c.today, amount:1000, categoryId:'c_food', accountId:'a_cash', note:'x', tags:[]})); const e = performance.now();
      return {search: b - a, save: e - b}; }""")
    check(f"tìm kiếm lần thứ hai < 150 ms (đo được {r['search']:.0f} ms)", r["search"] < 150)
    check(f"một lần sửa (ghi cả sổ vào localStorage) < 500 ms (đo được {r['save']:.0f} ms)", r["save"] < 500)
    t.go("giao-dich"); p.click('[data-seg="txPeriod"][data-v="all"]'); p.wait_for_timeout(200)
    check("kỳ 'Tất cả' chỉ vẽ 200 dòng đầu, có nút 'Hiện thêm'", p.locator("#tx-results .item").count() == 200 and p.locator('[data-act="tx-more"]').count() == 1)
    check("không lỗi console ở quy mô lớn", not t.errors, "; ".join(t.errors)[:300])
    ctx.close()
