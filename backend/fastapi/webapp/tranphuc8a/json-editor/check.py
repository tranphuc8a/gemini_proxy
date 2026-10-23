#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kiểm JSON Editor (webapp/tranphuc8a/json-editor) — tĩnh + Edge thật.

    backend\\fastapi\\.venv\\Scripts\\python.exe backend\\fastapi\\webapp\\tranphuc8a\\json-editor\\check.py              # = --tinh --chuc-nang
    ... check.py --tinh        # tĩnh: thứ tự script, node --check, kiem.js, ngân sách, không URL ngoài / eval, metadata, tên nút
    ... check.py --chuc-nang   # Edge (channel="msedge"): nạp sạch 1440 sáng/tối + 360, hoàn tác thống nhất, lỗi đợt J1,
                               # Tab / Esc+Tab, cổng JE_APP, localStorage bị chặn, XSS
    ... check.py --tat-ca      # mọi tầng đang có

Máy chủ: http.server phục vụ CHÍNH thư mục app trên cổng trống (app không gọi API nào). Exit code ≠ 0 khi có phép sai.
Các tầng --hieu-nang / --file của thiết kế sẽ thêm ở đợt J5 (tài liệu lớn) và J3 (Worker)."""

from __future__ import annotations

import functools
import http.server
import io
import json
import os
import re
import socketserver
import subprocess
import sys
import threading

HERE = os.path.dirname(os.path.abspath(__file__))
OK = FAIL = 0
LOI_TRANG: list = []

# Thứ tự nạp bắt buộc (index.html): je-chung → module thuần → json-editor (lõi + JE_APP) → ui-*.
THU_TU_SCRIPT = ["assets/je-chung.js", "assets/json-editor.js"]
NGAN_SACH_ASSETS = 400 * 1024
# kiem-hinh.py bấm nút THEO TÊN — đổi tên là bộ kiểm bố cục im lặng bỏ qua nút đó.
TEN_NUT_KIEM_HINH = ["Định dạng", "Nén", "Sắp khoá", "Chạy", "So sánh"]

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def check(cond, msg, detail=""):
    global OK, FAIL
    if cond:
        OK += 1
        print("  ✓ " + msg)
    else:
        FAIL += 1
        print("  ✗ " + msg + ((" — " + str(detail)) if detail != "" else ""))
    return bool(cond)


def info(msg):
    print("  · " + msg)


def section(t):
    print("\n" + t)


def doc(p):
    return io.open(os.path.join(HERE, p), encoding="utf-8").read()


# ============================================================================================ tĩnh
def tang_tinh():
    section("TĨNH")
    html = doc("index.html")
    srcs = re.findall(r'<script\s+src="([^"]+)"', html)
    check(srcs[:len(THU_TU_SCRIPT)] == THU_TU_SCRIPT, "thứ tự script trong index.html: " + " → ".join(THU_TU_SCRIPT), srcs)
    tren_dia = sorted("assets/" + n for n in os.listdir(os.path.join(HERE, "assets")) if n.endswith(".js"))
    check(sorted(srcs) == tren_dia, "mọi assets/*.js đều được index.html nạp (và ngược lại)", sorted(set(srcs) ^ set(tren_dia)))
    ui = [s for s in srcs if os.path.basename(s).startswith("ui-")]
    loi = [s for s in srcs if not os.path.basename(s).startswith("ui-") and ui and srcs.index(s) > srcs.index(ui[0])]
    check(not loi, "ui-*.js nạp sau mọi module lõi (%d tệp ui)" % len(ui), loi)

    js = [os.path.join(HERE, *s.split("/")) for s in tren_dia]
    kiem_js = [os.path.join(HERE, "kiem.js")] + [os.path.join(HERE, "kiem", n) for n in sorted(os.listdir(os.path.join(HERE, "kiem"))) if n.endswith(".js")]
    hong = []
    for f in js + kiem_js:
        r = subprocess.run(["node", "--check", f], capture_output=True, text=True, encoding="utf-8")
        if r.returncode:
            hong.append(os.path.relpath(f, HERE) + ": " + (r.stderr.strip().splitlines() or ["?"])[0])
    check(not hong, "node --check: %d tệp JS (assets + kiem)" % len(js + kiem_js), hong)

    r = subprocess.run(["node", os.path.join(HERE, "kiem.js")], capture_output=True, text=True, encoding="utf-8", cwd=HERE)
    duoi = (r.stdout.strip().splitlines() or [""])[-1]
    check(r.returncode == 0, "node kiem.js: " + duoi, "\n".join([l for l in r.stdout.splitlines() if "[SAI]" in l][:5]) or r.stderr[-400:])

    tong = sum(os.path.getsize(os.path.join(HERE, "assets", n)) for n in os.listdir(os.path.join(HERE, "assets")))
    check(tong <= NGAN_SACH_ASSETS, "ngân sách assets %d KB ≤ %d KB" % (tong // 1024, NGAN_SACH_ASSETS // 1024))

    css = "".join(doc("assets/" + n) for n in os.listdir(os.path.join(HERE, "assets")) if n.endswith(".css"))
    ngoai = re.findall(r'(?:src|href)="(https?://[^"]+)"', html) + re.findall(r"@import|url\(\s*['\"]?https?:", css)
    ma = {os.path.basename(f): io.open(f, encoding="utf-8").read() for f in js}
    for ten, s in ma.items():
        ngoai += [ten + ": " + u for u in re.findall(r"https?://[^\s\"'`)]+", s)]
    check(not ngoai, "không nạp / gọi địa chỉ ngoài (CDN, font, API)", ngoai[:4])
    ev = [ten for ten, s in ma.items() if re.search(r"\beval\s*\(|new\s+Function\b|setTimeout\(\s*['\"]", s)]
    check(not ev, "không eval / new Function / setTimeout(chuỗi)", ev)

    # Heuristic như các app khác: mọi innerHTML / insertAdjacentHTML trong ui-*.js nằm trong hàm có gọi thoat( / esc(.
    vi_pham = []
    for ten, s in ma.items():
        if not ten.startswith("ui-"):
            continue
        for m in re.finditer(r"\.innerHTML\s*=|insertAdjacentHTML\(", s):
            dau = s.rfind("function", 0, m.start())
            if "thoat(" not in s[dau:m.start() + 400] and "esc(" not in s[dau:m.start() + 400]:
                vi_pham.append("%s:%d" % (ten, s.count("\n", 0, m.start()) + 1))
    check(not vi_pham, "innerHTML trong ui-*.js đều đi kèm hàm thoát HTML (%d tệp ui)" % len(ui), vi_pham[:4])

    try:
        meta = json.loads(doc("metadata.json"))
        ok = isinstance(meta.get("title"), str) and meta["title"] and isinstance(meta.get("description"), str) \
            and isinstance(meta.get("tags"), list) and all(isinstance(t, str) for t in meta["tags"]) and meta.get("icon")
        check(ok, "metadata.json hợp lệ (title, description, tags, icon)")
    except Exception as e:
        check(False, "metadata.json đọc được", e)

    nut = [re.sub(r"<[^>]+>", "", t).strip() for t in re.findall(r"<button[^>]*>(.*?)</button>", html, re.S)]
    thieu = [t for t in TEN_NUT_KIEM_HINH if not any(t in n for n in nut)]
    check(not thieu, "giữ tên nút mà kiem-hinh.py bấm theo tên: " + ", ".join(TEN_NUT_KIEM_HINH), thieu)
    check('id="nut-hoan-tac"' in html and 'id="nut-lam-lai"' in html and 'id="cay-hoan-tac"' in html and 'id="cay-lam-lai"' in html,
          "nút ↶ ↷ ở đầu trang + giữ bí danh #cay-hoan-tac / #cay-lam-lai")


# ============================================================================================ máy chủ
class _Im(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class _MayChu(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = True
    request_queue_size = 64


def mo_may_chu():
    sv = _MayChu(("127.0.0.1", 0), functools.partial(_Im, directory=HERE))
    threading.Thread(target=sv.serve_forever, daemon=True).start()
    return sv, "http://127.0.0.1:%d/index.html" % sv.server_address[1]


# ============================================================================================ trình duyệt
class Trang:
    """Một ngữ cảnh Edge mới (bộ nhớ sạch) + gom lỗi console / pageerror."""

    def __init__(self, tb, url, ten, init=None, **kw):
        kw.setdefault("viewport", {"width": 1440, "height": 900})
        self.ctx = tb.new_context(**kw)
        if init:
            self.ctx.add_init_script(init)
        self.p = self.ctx.new_page()
        self.ten = ten
        self.loi = []
        self.p.on("console", lambda m: self.loi.append("console: " + m.text) if m.type == "error" else None)
        self.p.on("pageerror", lambda e: self.loi.append("pageerror: " + str(e)))
        self.p.on("response", lambda r: self.loi.append("http %d %s" % (r.status, r.url)) if r.status >= 400 else None)
        self.p.goto(url, wait_until="load")
        self.p.wait_for_function("() => !!window.JE_APP", timeout=10000)

    def gt(self):
        return self.p.input_value("#nhap")

    def cho(self, bieu_thuc, arg=None, timeout=2500):
        try:
            self.p.wait_for_function(bieu_thuc, arg=arg, timeout=timeout)
            return True
        except Exception:
            return False

    def cho_gt(self, mong, timeout=2500):
        return self.cho("m => document.querySelector('#nhap').value === m", mong, timeout)

    def dien(self, s):
        """Điền như người dán: fill + chờ qua debounce 180 ms để doc() chạy."""
        self.p.fill("#nhap", s)
        self.p.wait_for_timeout(260)

    def tab(self, o):
        self.p.click('.tab-n[data-o="%s"]' % o)
        self.p.wait_for_timeout(80)

    def title(self, sel):
        return self.p.get_attribute(sel, "title") or ""

    def tat(self, sel):
        return self.p.eval_on_selector(sel, "b => b.disabled")

    def dong(self):
        LOI_TRANG.extend("[%s] %s" % (self.ten, e) for e in self.loi)
        self.ctx.close()


def J(v, thut=None):
    """Giống JSON.stringify(v, null, thut) của JS (ensure_ascii=False, dấu phân cách như JS)."""
    if thut is None:
        return json.dumps(v, ensure_ascii=False, separators=(",", ":"))
    return json.dumps(v, ensure_ascii=False, indent=thut)


def tang_chuc_nang():
    section("CHỨC NĂNG — Edge thật (channel=\"msedge\")")
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        check(False, "có playwright (backend/fastapi/.venv)")
        return
    sv, url = mo_may_chu()
    try:
        with sync_playwright() as pw:
            tb = pw.chromium.launch(channel="msedge")
            nap_sach(tb, url)
            hoan_tac(tb, url)
            tab_va_esc(tb, url)
            loi_dot_j1(tb, url)
            cong_je_app(tb, url)
            luu_tru_bi_chan(tb, url)
            xss(tb, url)
            tb.close()
    finally:
        sv.shutdown()
        sv.server_close()
    check(not LOI_TRANG, "không có lỗi console / pageerror trong mọi phép trên", LOI_TRANG[:4])


def nap_sach(tb, url):
    section(" · nạp sạch (1440 sáng, 1440 tối, 360 tối)")
    for ten, vp, mau in [("1440-sang", {"width": 1440, "height": 900}, "light"),
                         ("1440-toi", {"width": 1440, "height": 900}, "dark"),
                         ("360-toi", {"width": 360, "height": 740}, "dark")]:
        T = Trang(tb, url, ten, viewport=vp, color_scheme=mau)
        p = T.p
        p.wait_for_timeout(200)
        tran = p.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
        hien = p.evaluate("""() => ['#nut-hoan-tac', '#nut-lam-lai'].every(s => {
            const r = document.querySelector(s).getBoundingClientRect(); return r.width >= 30 && r.height >= 30; })""")
        check(not T.loi and tran <= 1 and hien and T.tat("#nut-hoan-tac") and T.tat("#nut-lam-lai"),
              "[%s] nạp không lỗi, không tràn ngang (%dpx), ↶ ↷ hiện ≥ 30 px và đang tắt" % (ten, tran), T.loi[:2])
        T.dong()


def hoan_tac(tb, url):
    section(" · hoàn tác thống nhất (việc 3)")
    T = Trang(tb, url, "hoan-tac")
    p = T.p
    go_tay = '{"b":1,"a":[1,2]}'
    dd = J({"b": 1, "a": [1, 2]}, 2)

    p.click("#nhap")
    p.keyboard.type(go_tay)
    p.wait_for_timeout(260)
    check(T.gt() == go_tay, "gõ JSON vào ô Soạn")
    p.click("#nut-dinh-dang")
    check(T.gt() == dd and "Định dạng" in T.title("#nut-hoan-tac") and not T.tat("#nut-hoan-tac"),
          "Định dạng → nút ↶ đầu trang bật, title “%s”" % T.title("#nut-hoan-tac"))
    p.click("#nhap")
    p.keyboard.press("Control+z")
    check(T.cho_gt(go_tay), "Ctrl+Z TRONG textarea ngay sau Định dạng → về bản vừa gõ (trước: không đổi gì)", repr(T.gt()[:40]))
    check("Làm lại: Định dạng" in T.title("#nut-lam-lai") and not T.tat("#nut-lam-lai"), "↷ bật, title “Làm lại: Định dạng”", T.title("#nut-lam-lai"))
    p.keyboard.press("Control+y")
    check(T.cho_gt(dd), "Ctrl+Y trong textarea → Định dạng lại", repr(T.gt()[:40]))
    p.keyboard.press("Control+z")
    T.cho_gt(go_tay)
    p.keyboard.press("Control+Shift+z")
    check(T.cho_gt(dd), "Ctrl+Shift+Z cũng làm lại")

    # Gõ thêm sau Định dạng: Ctrl+Z gỡ chữ vừa gõ TRƯỚC (hoàn tác gốc), rồi mới tới Định dạng.
    p.click("#nhap")
    p.keyboard.press("Control+End")
    p.keyboard.type("x")
    p.wait_for_timeout(60)
    so_truoc = p.evaluate("() => JE_APP.lichSu().soHoanTac")
    check(T.gt() == dd + "x", "gõ thêm “x” sau Định dạng")
    p.keyboard.press("Control+z")
    check(T.cho_gt(dd) and p.evaluate("() => JE_APP.lichSu().soHoanTac") == so_truoc,
          "Ctrl+Z lần 1 → chỉ gỡ “x” (hoàn tác gốc của trình duyệt, lịch sử app không đổi)", repr(T.gt()[-12:]))
    p.keyboard.press("Control+z")
    check(T.cho_gt(go_tay), "Ctrl+Z lần 2 → hết ngăn gốc, rơi về lịch sử app: bỏ Định dạng", repr(T.gt()[:40]))

    # Gõ một thay đổi mới thì ngăn làm lại của app bị xoá.
    check(not T.tat("#nut-lam-lai"), "trước khi gõ: ↷ đang bật")
    p.keyboard.press("End")
    p.keyboard.type(" ")
    p.wait_for_timeout(60)
    check(T.tat("#nut-lam-lai") and T.tat("#cay-lam-lai"), "gõ thay đổi mới → ↷ (đầu trang + tab Cây) tắt")

    # Nút đầu trang dùng được ở tab khác.
    T.dien(go_tay)
    p.click("#nut-dinh-dang")
    T.tab("thongke")
    p.click("#nut-hoan-tac")
    check(T.cho_gt(go_tay), "tab Thống kê: bấm ↶ đầu trang → hoàn tác Định dạng")
    p.click("#nut-lam-lai")
    check(T.cho_gt(dd), "tab Thống kê: bấm ↷ → làm lại")
    T.tab("soan")

    # Nén: focus đang ở NÚT (không ở textarea) → Ctrl+Z vẫn hoàn tác.
    p.click("#nut-nen")
    check(T.gt() == go_tay and "Nén" in T.title("#nut-hoan-tac"), "Nén → một bước “Nén”")
    p.keyboard.press("Control+z")
    check(T.cho_gt(dd), "Ctrl+Z khi focus ở nút Nén → hoàn tác Nén", p.evaluate("() => document.activeElement.id"))

    # Sắp khoá: giữ __proto__ và kiểu thụt 4.
    s4 = '{\n    "b": 1,\n    "__proto__": {\n        "x": 1\n    },\n    "a": [\n        2\n    ]\n}'
    mong = '{\n    "__proto__": {\n        "x": 1\n    },\n    "a": [\n        2\n    ],\n    "b": 1\n}'
    T.dien(s4)
    p.click("#nut-sap-khoa")
    check(T.gt() == mong, "Sắp khoá → giữ khoá __proto__ và thụt 4 (trước: mất khoá, ép thụt 2)", repr(T.gt()[:60]))
    p.keyboard.press("Control+z")
    check(T.cho_gt(s4), "Ctrl+Z → bỏ Sắp khoá")

    # Thoát chuỗi.
    T.dien('"{\\"a\\":1}"')
    p.click("#nut-thoat")
    check(T.gt() == '{"a":1}' and "Thoát chuỗi" in T.title("#nut-hoan-tac"), "Thoát chuỗi → một bước có nhãn")
    p.click("#nut-hoan-tac")
    check(T.cho_gt('"{\\"a\\":1}"'), "↶ → bỏ Thoát chuỗi")

    # Mở tệp.
    truoc = T.gt()
    p.set_input_files("#tep", files=[{"name": "thu.json", "mimeType": "application/json", "buffer": b'{"tu":"tep"}'}])
    check(T.cho_gt('{"tu":"tep"}') and "thu.json" in p.inner_text("#co-tep") and "Mở tệp" in T.title("#nut-hoan-tac"),
          "Mở tệp → nội dung tệp, một bước “Mở tệp thu.json”", T.title("#nut-hoan-tac"))
    p.click("#nhap")
    p.keyboard.press("Control+z")
    check(T.cho_gt(truoc), "Ctrl+Z trong textarea → về nội dung trước khi mở tệp",
          "%r (mong %r) · %s" % (T.gt()[:30], truoc[:30], p.evaluate("() => JSON.stringify(JE_APP.lichSu())")))

    # Sửa trên cây vẫn hoàn tác được bằng Ctrl+Z ở tab Cây (hành vi cũ) và hiện nhãn.
    s = '{\n  "a": 1,\n  "b": [1, 2]\n}'
    T.dien(s)
    T.tab("cay")
    p.click('.n[data-p=\'["a"]\'] > .dong .gt')
    p.fill(".o-sua .o-nhap", "5")
    p.keyboard.press("Enter")
    check(T.cho("() => document.querySelector('#nhap').value.includes('\"a\": 5')"), "cây: sửa a = 5 ghi vào văn bản")
    check("Sửa giá trị" in T.title("#nut-hoan-tac") and "Sửa giá trị" in T.title("#cay-hoan-tac"), "nhãn “Sửa giá trị” ở cả ↶ đầu trang và bí danh tab Cây")
    p.focus('.n[data-p=\'["a"]\']')
    p.keyboard.press("Control+z")
    check(T.cho_gt(s), "Ctrl+Z ở tab Cây → về văn bản cũ, giữ nguyên định dạng gốc")
    p.click("#cay-lam-lai")
    check(T.cho("() => document.querySelector('#nhap').value.includes('\"a\": 5')"), "bí danh #cay-lam-lai vẫn làm lại được")
    T.dong()

    # Nút ↶ khi đã gõ sau lần máy ghi: bước đầu chỉ bỏ phần đã gõ ("Sửa tay"), không nhảy qua nó.
    T = Trang(tb, url, "sua-tay")
    p = T.p
    T.dien(go_tay)
    p.click("#nut-dinh-dang")
    p.click("#nhap")
    p.keyboard.press("Control+End")
    p.keyboard.type("  ")
    p.click("#nut-hoan-tac")
    check(T.cho_gt(dd) and "Làm lại: Sửa tay" in T.title("#nut-lam-lai"),
          "gõ sau Định dạng rồi bấm ↶ → bỏ phần vừa gõ trước (↷ “Làm lại: Sửa tay”)", T.title("#nut-lam-lai"))
    p.click("#nut-hoan-tac")
    check(T.cho_gt(go_tay), "bấm ↶ lần nữa → bỏ Định dạng")
    T.dong()

    # Bước gõ cũ của trình duyệt đã "chết" sau khi máy ghi .value: không bao giờ được để Ctrl+Z gốc chạm tới
    # (đo thật: Edge chèn lại đoạn JSON cũ vào nội dung mới). Mọi trạng thái thấy được phải là trạng thái có thật.
    T = Trang(tb, url, "buoc-chet")
    p = T.p
    a = '{\n    "b": 1,\n    "a": 2\n}'
    a_sap = '{\n    "a": 2,\n    "b": 1\n}'
    chuoi = '"{\\"a\\":1}"'
    tep = '{"tu":"tep"}'
    T.dien(a)
    p.click("#nut-sap-khoa")
    p.keyboard.press("Control+z")
    T.dien(chuoi)
    p.click("#nut-thoat")
    p.click("#nut-hoan-tac")
    p.set_input_files("#tep", files=[{"name": "t.json", "mimeType": "application/json", "buffer": tep.encode()}])
    T.cho_gt(tep)
    hop_le = {"", a, a_sap, chuoi, '{"a":1}', tep}
    thay = []
    p.click("#nhap")
    for _ in range(5):
        p.keyboard.press("Control+z")
        p.wait_for_timeout(80)
        thay.append(T.gt())
    la = [v for v in thay if v not in hop_le]
    check(not la and thay[0] == chuoi, "5 lần Ctrl+Z sau chuỗi dán / Sắp khoá / Thoát chuỗi / Mở tệp: mọi trạng thái đều có thật, không ghép đoạn cũ",
          [v[:40] for v in thay])
    T.dong()

    # Ghi lại hành vi THẬT của Edge trên một textarea TRẦN (thiết kế chỉ suy đoán về beforeinput): đây là lý do app
    # so văn bản với bản máy ghi thay vì dựa vào sự kiện.
    T = Trang(tb, url, "tham-do")
    p = T.p
    p.evaluate("""() => { const t = document.createElement('textarea'); t.id = 'tho'; document.body.appendChild(t);
        window.__bi = []; t.addEventListener('beforeinput', e => window.__bi.push(e.inputType)); }""")
    p.click("#tho")
    p.keyboard.press("Control+z")
    p.wait_for_timeout(60)
    rong = p.evaluate("() => window.__bi.splice(0)")
    p.keyboard.type("ab")
    p.evaluate("() => { document.querySelector('#tho').value = 'MAY GHI'; window.__bi.length = 0; }")
    p.keyboard.press("Control+z")
    p.wait_for_timeout(60)
    sau_gan = p.evaluate("() => [window.__bi.splice(0), document.querySelector('#tho').value]")
    info("Edge (textarea trần): Ctrl+Z khi ngăn gốc trống → beforeinput %s; sau khi gán .value → beforeinput %s, văn bản %r"
         % (rong or "không có", sau_gan[0] or "không có", sau_gan[1]))
    T.dong()


def tab_va_esc(tb, url):
    section(" · Tab thụt theo kiểu văn bản, Esc rồi Tab thì rời ô (WCAG 2.1.2)")
    T = Trang(tb, url, "tab")
    p = T.p
    s4 = '{\n    "a": 1\n}'
    T.dien(s4)
    p.evaluate("() => { const n = document.querySelector('#nhap'); n.focus(); n.setSelectionRange(1, 1); }")
    p.keyboard.press("Tab")
    check(T.gt() == "{    \n    \"a\": 1\n}", "văn bản thụt 4 → Tab chèn 4 dấu cách (trước: luôn 2)", repr(T.gt()[:12]))
    p.keyboard.press("Control+z")
    check(T.cho_gt(s4), "Tab chèn bằng execCommand → Ctrl+Z gốc gỡ được")
    st = '{\n\t"a": 1\n}'
    T.dien(st)
    p.evaluate("() => { const n = document.querySelector('#nhap'); n.focus(); n.setSelectionRange(1, 1); }")
    p.keyboard.press("Tab")
    check(T.gt() == "{\t\n\t\"a\": 1\n}", "văn bản thụt tab → Tab chèn ký tự tab", repr(T.gt()[:6]))
    p.keyboard.press("Escape")
    p.keyboard.press("Tab")
    p.wait_for_timeout(50)
    roi = p.evaluate("() => document.activeElement && document.activeElement.id")
    check(roi != "nhap" and T.gt() == "{\t\n\t\"a\": 1\n}", "Esc rồi Tab → focus rời ô soạn, văn bản không đổi (focus: %s)" % roi)
    p.focus("#nhap")
    p.keyboard.press("Escape")
    p.keyboard.press("Shift+Tab")
    p.wait_for_timeout(50)
    roi2 = p.evaluate("() => document.activeElement && document.activeElement.id")
    check(roi2 != "nhap", "Esc rồi Shift+Tab → cũng rời ô (phím Shift đứng giữa không làm mất trạng thái Esc)")
    p.focus("#nhap")
    p.keyboard.press("Escape")
    p.keyboard.press("ArrowLeft")
    p.keyboard.press("Tab")
    check(p.evaluate("() => document.activeElement.id") == "nhap", "Esc, phím khác, rồi Tab → lại thụt lề như thường (Esc chỉ có tác dụng ngay trước Tab)")
    T.dong()


def loi_dot_j1(tb, url):
    section(" · lỗi đã xác minh (việc 1) trên trang thật")
    T = Trang(tb, url, "loi-j1")
    p = T.p
    T.dien('{"a":1,"mang":[1,2,3],"o":{"x":1},"constructor":"rieng"}')
    T.tab("loc")
    kq = {}
    for q in ["$.toString", "$.mang.length", "$.o.constructor", "$.constructor", "$.mang[1]"]:
        p.fill("#loc-duong", q)
        p.click("#loc-chay")
        kq[q] = p.inner_text("#loc-ket")
    check(all(kq[q] == "Không khớp nút nào." for q in ["$.toString", "$.mang.length", "$.o.constructor"]),
          "Truy vấn $.toString / $.mang.length / $.o.constructor → “Không khớp nút nào.” (trước: hàm / 3 / lỗi split)",
          {q: kq[q][:30] for q in kq})
    check('"rieng"' in kq["$.constructor"] and "1 kết quả" in kq["$.mang[1]"], "khoá RIÊNG tên constructor và chỉ số mảng vẫn ra kết quả")

    def so_sanh(trai, phai):
        T.tab("soan")
        T.dien(trai)
        T.tab("sosanh")
        p.fill("#ss-nhap", phai)
        p.click("#ss-chay")
        return p.evaluate("() => [...document.querySelectorAll('#ss-ket .hang-kh')].map(e => e.className.replace('hang-kh ', '') + ' ' + e.querySelector('.duong').textContent)")
    r1 = so_sanh('{"constructor":1}', "{}")
    r2 = so_sanh("{}", '{"toString":1}')
    check(r1 == ["bot $.constructor"] and r2 == ["them $.toString"],
          "So sánh {constructor:1} vs {} = bớt; {} vs {toString:1} = thêm (trước: “đổi”)", [r1, r2])

    # JSON lồng 20 000 cấp: JSON.parse đọc được; cây, thống kê, định dạng, so sánh, truy vấn không được ném lỗi ra trang.
    sau = "[" * 20000 + "]" * 20000
    T.tab("soan")
    T.dien(sau)
    T.tab("cay")
    p.wait_for_timeout(150)
    tom = p.inner_text("#cay-tom")
    check("sâu 19999" in tom and not T.loi, "cây với JSON lồng 20 000 cấp: dựng được, “%s” (trước: dem() tràn ngăn xếp)" % tom, T.loi[:1])
    T.tab("thongke")
    check("cấp" in p.inner_text("#tk-ket") and not T.loi, "tab Thống kê với JSON lồng 20 000 cấp: không lỗi", T.loi[:1])
    T.tab("soan")
    p.click("#nut-dinh-dang")
    p.wait_for_timeout(100)
    tt = p.inner_text("#trang-thai")
    check(not T.loi, "Định dạng JSON lồng 20 000 cấp: không ném lỗi ra trang (trạng thái: %s)" % tt[:70], T.loi[:1])
    T.tab("sosanh")
    p.fill("#ss-nhap", sau)                 # so với CHÍNH NÓ: khacNhau phải đi hết 20 000 cấp
    p.click("#ss-chay")
    ss = p.inner_text("#ss-ket")
    T.tab("loc")
    p.fill("#loc-duong", "$..x")
    p.click("#loc-chay")
    check(not T.loi, "So sánh / Truy vấn trên JSON lồng 20 000 cấp: không ném lỗi ra trang (so sánh: %s · truy vấn: %s)"
          % (ss[:45], p.inner_text("#loc-ket")[:45]), T.loi[:1])
    T.dong()


def cong_je_app(tb, url):
    section(" · cổng JE_APP (việc 2)")
    T = Trang(tb, url, "je-app")
    p = T.p
    can = ["layVanBan", "layDuLieu", "hopLe", "datVanBan", "apDungGoc", "hoanTac", "lamLai", "lichSu",
           "chuyenTab", "tabHien", "denDuong", "denViTri", "denDong", "dangKy", "thongBao"]
    thieu = p.evaluate("can => can.filter(k => typeof JE_APP[k] !== 'function')", can)
    check(not thieu and p.evaluate("() => !!(window.JE && JE.chung && Array.isArray(window.JE_NGUON))"),
          "JE_APP đủ %d hàm; JE.chung + JE_NGUON có trong trang" % len(can), thieu)
    p.evaluate("() => { window.__dl = 0; JE_APP.dangKy('doi-du-lieu', () => window.__dl++); }")
    p.evaluate("""() => JE_APP.datVanBan('{\\n  "x": [1, 2]\\n}', { nhan: "Thử cổng" })""")
    check("Thử cổng" in T.title("#nut-hoan-tac") and p.evaluate("() => window.__dl") >= 1,
          "datVanBan → một bước “Thử cổng”, sự kiện doi-du-lieu đã bắn")
    ok = p.evaluate("""() => JE_APP.denDuong(["x", 1])""")
    p.wait_for_timeout(80)
    act = p.evaluate("() => { const a = document.activeElement; return a && a.getAttribute('data-p'); }")
    check(ok and act == '["x",1]' and p.evaluate("() => JE_APP.tabHien()") == "cay",
          "denDuong([\"x\", 1]) → sang tab Cây, focus đúng nút", act)
    p.evaluate("() => JE_APP.denDong(2)")
    sel = p.evaluate("() => { const n = document.querySelector('#nhap'); return [n.selectionStart, document.activeElement === n]; }")
    check(sel == [2, True] and p.evaluate("() => JE_APP.tabHien()") == "soan", "denDong(2) → tab Soạn, con trỏ đầu dòng 2", sel)
    p.click("#nhap")
    p.keyboard.press("End")
    p.keyboard.type(" ")
    dl = p.evaluate("() => window.__dl")
    p.wait_for_timeout(300)
    check(p.evaluate("() => window.__dl") > dl, "gõ phím → sau debounce bắn doi-du-lieu")
    T.dong()


def luu_tru_bi_chan(tb, url):
    section(" · localStorage bị chặn (cửa sổ riêng tư / chính sách)")
    chan = """Object.defineProperty(window, 'localStorage', { configurable: true,
        get() { throw new DOMException('bị chặn', 'SecurityError'); } });"""
    T = Trang(tb, url, "chan-ls", init=chan)
    p = T.p
    check(not T.loi, "nạp không lỗi khi localStorage ném lỗi", T.loi[:1])
    T.dien('{"b":1,"a":2}')
    p.click("#nut-sap-khoa")
    check(T.gt() == '{"a":2,"b":1}', "Sắp khoá vẫn chạy (giữ dạng nén một dòng)", T.gt())
    p.keyboard.press("Control+z")
    check(T.cho_gt('{"b":1,"a":2}') and not T.loi, "hoàn tác vẫn chạy, không lỗi", T.loi[:1])
    T.dong()


def xss(tb, url):
    section(" · dữ liệu độc (XSS) không thực thi")
    T = Trang(tb, url, "xss")
    p = T.p
    doc_hai = '{"<img src=x onerror=window.__xss=1>":"<img src=x onerror=window.__xss=2>","a":[{"<svg onload=window.__xss=3>":1}]}'
    T.dien(doc_hai)
    T.tab("cay")
    p.click("#cay-mo")
    T.tab("loc")
    p.fill("#loc-duong", "$[*]")
    p.click("#loc-chay")
    T.tab("sosanh")
    p.fill("#ss-nhap", "{}")
    p.click("#ss-chay")
    T.tab("thongke")
    p.evaluate("() => JE_APP.thongBao('<img src=x onerror=window.__xss=4>')")
    p.wait_for_timeout(250)
    check(p.evaluate("() => window.__xss === undefined") and p.locator("img").count() == 0,
          "khoá / giá trị / thông báo chứa <img onerror>, <svg onload>: không phần tử nào được tạo, không mã nào chạy")
    T.dong()


# ============================================================================================ main
def main(argv):
    co = set(a for a in argv if a.startswith("--"))
    if not co or "--tat-ca" in co:
        co |= {"--tinh", "--chuc-nang"}
    print("Kiểm JSON Editor — " + " ".join(sorted(co)))
    if "--tinh" in co:
        tang_tinh()
    if "--chuc-nang" in co:
        tang_chuc_nang()
    print("\n%d đạt, %d sai" % (OK, FAIL))
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
