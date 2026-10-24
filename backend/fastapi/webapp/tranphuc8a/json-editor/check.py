#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kiểm JSON Editor (webapp/tranphuc8a/json-editor) — tĩnh + Edge thật.

    backend\\fastapi\\.venv\\Scripts\\python.exe backend\\fastapi\\webapp\\tranphuc8a\\json-editor\\check.py              # = --tinh --chuc-nang
    ... check.py --tinh        # tĩnh: thứ tự script, node --check, kiem.js, ngân sách, không URL ngoài / eval, metadata, tên nút
    ... check.py --chuc-nang   # Edge (channel="msedge"): nạp sạch 1440 sáng/tối + 360, hoàn tác thống nhất, lỗi đợt J1,
                               # Tab / Esc+Tab, cổng JE_APP, localStorage bị chặn, XSS, metadata nhánh gấp ở tab Cây (J2),
                               # tab Schema (J3): lỗi bấm tới Cây / văn bản / schema, huy hiệu, tuỳ chọn, ví dụ, dữ liệu lớn,
                               # ReDoS báo hết giờ + Worker chạy khi phục vụ qua máy chủ, mở tệp trông như schema, 360 px
    ... check.py --file        # mở index.html bằng file:// (Worker từ Blob, kiểm schema, ReDoS hết giờ)
    ... check.py --tat-ca      # mọi tầng đang có (tĩnh + chức năng + file)
    ... check.py --chuc-nang --chi=meta_nhanh_gap,xss   # chỉ vài nhóm phép Edge (tên hàm trong tang_chuc_nang)

Máy chủ: http.server phục vụ CHÍNH thư mục app trên cổng trống (app không gọi API nào). Exit code ≠ 0 khi có phép sai.
Tầng --hieu-nang của thiết kế sẽ thêm ở đợt J5 (tài liệu lớn)."""

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

# Thứ tự nạp bắt buộc (index.html): je-chung → module thuần (tom-tat…) → json-editor (lõi + JE_APP) → ui-*.
THU_TU_SCRIPT = ["assets/je-chung.js", "assets/tom-tat.js", "assets/vi-tri.js", "assets/schema-format.js", "assets/schema-kiem.js",
                 "assets/regex-sinh.js", "assets/schema-sinh.js", "assets/schema-suy.js", "assets/chay-nen.js", "assets/json-editor.js"]
# Module THUẦN (khuôn je-chung.js, đẩy vào JE_NGUON để Worker ghép lại): không DOM / storage / đồng hồ.
MODULE_THUAN = ("je-chung.js", "tom-tat.js", "vi-tri.js", "schema-format.js", "schema-kiem.js", "regex-sinh.js", "schema-sinh.js", "schema-suy.js")
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
    kiem_js = [os.path.join(HERE, "kiem.js"), os.path.join(HERE, "..", "khung-kiem.js"), os.path.join(HERE, "..", "kiem-khung.js")] + [os.path.join(HERE, "kiem", n) for n in sorted(os.listdir(os.path.join(HERE, "kiem"))) if n.endswith(".js")]
    hong = []
    for f in js + kiem_js:
        r = subprocess.run(["node", "--check", f], capture_output=True, text=True, encoding="utf-8")
        if r.returncode:
            hong.append(os.path.relpath(f, HERE) + ": " + (r.stderr.strip().splitlines() or ["?"])[0])
    check(not hong, "node --check: %d tệp JS (assets + kiem)" % len(js + kiem_js), hong)

    r = subprocess.run(["node", os.path.join(HERE, "kiem.js")], capture_output=True, text=True, encoding="utf-8", cwd=HERE)
    duoi = (r.stdout.strip().splitlines() or [""])[-1]
    # Đòi cả dòng tổng kết "Dat — …": kiem.js chạy nhóm bất đồng bộ; một Promise treo làm Node thoát mã 0 mà BỎ QUA im lặng mọi nhóm sau.
    check(r.returncode == 0 and duoi.startswith("Dat — "), "node kiem.js: " + duoi,
          "\n".join([l for l in r.stdout.splitlines() if "[SAI]" in l][:5])
          or ("kiem.js thoát mã %d, dòng cuối không phải 'Dat — …' (thoát sớm / nhóm treo?) " % r.returncode) + r.stderr[-300:])

    # Kiểm chính bộ kiểm: nhóm treo / thoát sớm phải ra ĐỎ (kiem-khung.js dựng bản sao + nhóm giả trong thư mục tạm, không đụng app).
    r = subprocess.run(["node", os.path.join(HERE, "..", "kiem-khung.js")], capture_output=True, text=True, encoding="utf-8", cwd=os.path.join(HERE, ".."))
    duoi = (r.stdout.strip().splitlines() or [""])[-1]
    check(r.returncode == 0 and duoi.startswith("Dat — "), "node kiem-khung.js (kiem.js / kiem-tat.js không xanh giả khi nhóm treo, thoát sớm): " + duoi,
          "\n".join([l for l in r.stdout.splitlines() if "[SAI]" in l][:5]) or r.stderr[-400:])

    tong = sum(os.path.getsize(os.path.join(HERE, "assets", n)) for n in os.listdir(os.path.join(HERE, "assets")))
    check(tong <= NGAN_SACH_ASSETS, "ngân sách assets %d KB ≤ %d KB" % (tong // 1024, NGAN_SACH_ASSETS // 1024))

    css = "".join(doc("assets/" + n) for n in os.listdir(os.path.join(HERE, "assets")) if n.endswith(".css"))
    ngoai = re.findall(r'(?:src|href)="(https?://[^"]+)"', html) + re.findall(r"@import|url\(\s*['\"]?https?:", css)
    ma = {os.path.basename(f): io.open(f, encoding="utf-8").read() for f in js}
    for ten, s in ma.items():
        # URL của json-schema.org chỉ là ĐỊNH DANH ($schema trong ví dụ / thông báo), không bao giờ được tải.
        ngoai += [ten + ": " + u for u in re.findall(r"https?://[^\s\"'`)]+", s) if "json-schema.org" not in u]
    check(not ngoai, "không nạp / gọi địa chỉ ngoài (CDN, font, API)", ngoai[:4])
    mang = [ten for ten, s in ma.items() if re.search(r"\bfetch\s*\(|XMLHttpRequest|WebSocket|importScripts|sendBeacon|new\s+EventSource", s)]
    check(not mang, "không có API mạng (fetch / XHR / WebSocket / importScripts / sendBeacon) — kiểm schema không tải $ref từ mạng", mang)
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

    # Module thuần (je-chung, tom-tat…) không được chạm DOM / storage / đồng hồ — Worker sau này ghép lại từ JE_NGUON.
    ban = []
    for ten in MODULE_THUAN:
        ma_thuan = re.sub(r"/\*.*?\*/", "", doc("assets/" + ten), flags=re.S)
        ma_thuan = re.sub(r"//[^\n]*", "", ma_thuan)
        if re.search(r"\bdocument\b|\bwindow\b|localStorage|sessionStorage|Date\.now|performance\.now|\.innerHTML", ma_thuan):
            ban.append(ten)
    check(not ban, "module thuần (%s) không dùng DOM / storage / đồng hồ" % ", ".join(MODULE_THUAN), ban)

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


def tang_file():
    """--file: mở index.html bằng file:// (không máy chủ)."""
    section("FILE — index.html mở bằng file:// (Edge)")
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        check(False, "có playwright (backend/fastapi/.venv)")
        return
    with sync_playwright() as pw:
        tb = pw.chromium.launch(channel="msedge")
        schema_file(tb)
        tb.close()
    check(not LOI_TRANG, "không có lỗi console / pageerror (file://)", LOI_TRANG[:4])


def tang_chuc_nang(chi=None):
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
            for f in (nap_sach, hoan_tac, tab_va_esc, loi_dot_j1, cong_je_app, luu_tru_bi_chan, xss, meta_nhanh_gap,
                      cong_schema, schema_tab, schema_tuy_chon, schema_xss, schema_360, schema_lon_redos, schema_hien_them, schema_mo_tep, schema_luu_tru_chan,
                      sinh_giao_dien, sinh_benh_ly, suy_giao_dien, sinh_360):
                if not chi or f.__name__ in chi:
                    f(tb, url)
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


# ============================================================================================ metadata nhánh gấp (J2)
CHON_N = ".n[data-p='%s']"


def _dong(duong):
    return (CHON_N % duong) + " > .dong"


def _hien(p, sel):
    """Phần tử có hiện thật (display ≠ none, có kích thước) không."""
    return p.evaluate("""s => { const e = document.querySelector(s); if (!e) return false;
        const r = e.getBoundingClientRect(); return getComputedStyle(e).display !== 'none' && r.width > 0 && r.height > 0; }""", sel)


def _byte_nen(v):
    return len(json.dumps(v, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))


def meta_nhanh_gap(tb, url):
    section(" · metadata / xem trước nhánh gấp ở tab Cây (việc 9, 10)")
    goc = {"nguoi": [{"id": 1, "name": "Phúc", "email": "p@x.vn", "tags": ["a", "b"], "x": 1}, {"id": 2, "name": "An"}],
           "o": {"mang": [1, 2, 3, "a", None]}, "meta": {"phien_ban": 3}}
    T = Trang(tb, url, "meta-gap")
    p = T.p
    T.dien(J(goc))
    T.tab("cay")
    p.wait_for_timeout(80)
    d0 = '["nguoi",0]'
    cd = lambda v: p.evaluate("b => JE_THU.dinhDangByte(b)", _byte_nen(v))

    # 1. Hàng gấp mặc định (cấp 2 trở xuống): số khoá, kích thước, xem trước giàu hơn.
    check(p.inner_text(_dong(d0) + " > .dem") == "5 khoá", "hàng gấp [nguoi][0]: “5 khoá” (giữ chữ cũ)", p.inner_text(_dong(d0) + " > .dem"))
    check(p.inner_text(_dong(d0) + " > .dem-byte") == "· " + cd(goc["nguoi"][0]),
          "kích thước khi nén = byte JSON nén thật (%d B → “%s”)" % (_byte_nen(goc["nguoi"][0]), cd(goc["nguoi"][0])),
          p.inner_text(_dong(d0) + " > .dem-byte"))
    check(p.inner_text(_dong(d0) + " > .xem-truoc") == 'name: "Phúc" · id, email, tags, …',
          "xem trước: trường nổi bật + vài khoá còn lại", p.inner_text(_dong(d0) + " > .xem-truoc"))
    check(p.locator(_dong(d0) + " > .kieu-con").count() == 0, "object không có “kiểu phần tử” (chỉ mảng có)")
    tt = T.title(_dong(d0))
    check(tt.startswith("$.nguoi[0] · object · 5 khoá · ") and tt.endswith(" byte khi nén) · sâu 2 cấp · 8 nút · khoá: id, name, email, …"),
          "tooltip: đường dẫn · kiểu · số khoá · kích thước · sâu · số nút · khoá đầu", tt)
    nhan = p.get_attribute(CHON_N % d0, "aria-label")
    check(nhan.startswith("phần tử 0: object 5 khoá, ") and nhan.endswith(" khi nén, sâu 2 cấp, 8 nút"),
          "tên truy cập treeitem: giữ phần đầu cũ, thêm kích thước / sâu / nút", nhan)

    # 2. Mảng gấp: kiểu phần tử.
    dm = '["o","mang"]'
    check(p.inner_text(_dong(dm) + " > .dem") == "5 phần tử" and p.inner_text(_dong(dm) + " > .kieu-con") == "number×3, null×1, string×1",
          "mảng gấp: “5 phần tử” + kiểu phần tử “number×3, null×1, string×1”", p.inner_text(_dong(dm) + " > .kieu-con"))
    check(p.inner_text(_dong(dm) + " > .xem-truoc") == '1, 2, 3 …' and "kiểu phần tử: number×3" in T.title(_dong(dm)),
          "mảng gấp: xem trước giá trị đầu; tooltip nêu kiểu phần tử")

    # 3. Mở ra thì ẩn, gấp lại thì hiện; bấm vào chữ metadata cũng mở.
    check(_hien(p, _dong(d0) + " > .dem-byte") and _hien(p, _dong(d0) + " > .xem-truoc"), "đang gấp: kích thước + xem trước hiện")
    p.click(_dong(d0) + " > .dem-byte")
    p.wait_for_timeout(40)
    check(p.get_attribute(CHON_N % d0, "aria-expanded") == "true" and not _hien(p, _dong(d0) + " > .dem-byte")
          and not _hien(p, _dong(d0) + " > .xem-truoc"), "bấm vào kích thước → mở nhánh; mở rồi thì kích thước + xem trước ẩn")
    p.click((CHON_N % d0) + " > .mo-dong")
    p.wait_for_timeout(40)
    check(p.get_attribute(CHON_N % d0, "aria-expanded") == "false" and _hien(p, _dong(d0) + " > .dem-byte"), "gấp lại → hiện lại")

    # 4. Hàng dựng khi đang MỞ (nguoi, cấp 1) rồi mới gấp: metadata dựng lười lúc gấp.
    dn = '["nguoi"]'
    check(p.locator(_dong(dn) + " > .dem-byte").count() == 0, "hàng đang mở không dựng metadata (không tốn gì)")
    p.click((CHON_N % dn) + " > .mo-dong")
    p.wait_for_timeout(40)
    check(p.inner_text(_dong(dn) + " > .dem-byte") == "· " + cd(goc["nguoi"]) and p.inner_text(_dong(dn) + " > .kieu-con") == "object×2"
          and _hien(p, _dong(dn) + " > .dem-byte"), "vừa gấp một hàng đang mở → metadata hiện (kích thước đúng, object×2)", p.inner_text(_dong(dn) + " > .dem-byte"))
    check(T.title(_dong(dn)).startswith("$.nguoi · mảng · 2 phần tử · "), "… kèm tooltip mảng", T.title(_dong(dn)))

    # 5. Đóng hết: gốc cũng có metadata.
    p.click("#cay-dong")
    p.wait_for_timeout(60)
    check(p.inner_text(_dong("[]") + " > .dem") == "3 khoá" and p.inner_text(_dong("[]") + " > .dem-byte") == "· " + cd(goc)
          and T.title(_dong("[]")).startswith("$ · object · 3 khoá · "), "Đóng hết: gốc hiện “3 khoá · %s” và tooltip bắt đầu bằng “$”" % cd(goc))
    p.click("#cay-mo")
    p.wait_for_timeout(60)

    # 6. Hộp kiểm “Kích thước”: tắt → không dựng; nhớ qua lần tải lại.
    check(p.is_checked("#cay-kich-thuoc"), "hộp kiểm “Kích thước” mặc định bật")
    p.click("#cay-dong")
    p.uncheck("#cay-kich-thuoc")
    p.wait_for_timeout(60)
    check(p.locator(".dem-byte").count() == 0 and p.locator("#cay .xem-truoc").count() > 0, "tắt “Kích thước” → không còn kích thước nào, xem trước vẫn còn")
    check("byte" not in T.title(_dong("[]")) and "sâu" not in T.title(_dong("[]")) and T.title(_dong("[]")).startswith("$ · object · 3 khoá"),
          "… tooltip không nói kích thước (không tính), vẫn có đường dẫn + số khoá", T.title(_dong("[]")))
    p.reload(wait_until="load")
    p.wait_for_function("() => !!window.JE_APP")
    T.tab("cay")
    check(not p.is_checked("#cay-kich-thuoc") and p.locator(".dem-byte").count() == 0, "tải lại trang: vẫn tắt (nhớ trong localStorage)")
    p.check("#cay-kich-thuoc")
    p.click("#cay-dong")
    p.wait_for_timeout(60)
    check(p.locator(".dem-byte").count() >= 1, "bật lại → kích thước hiện lại")
    check(not T.loi, "không lỗi console / pageerror", T.loi[:2])
    T.dong()

    # 7. Dữ liệu độc: khoá / giá trị có thẻ HTML, dấu nháy; tooltip + tên truy cập chỉ là văn bản.
    T = Trang(tb, url, "meta-xss")
    p = T.p
    doc_hai = {"l1": {"a": {"<img src=x onerror=window.__xss=1>": 1, "b\"c' onmouseover=window.__xss=2 x=\"": "<svg onload=window.__xss=3>",
                            "ten": "\"><script>window.__xss=4</script>", "m": [{"<b>": 1}]}}}
    T.dien(J(doc_hai))
    T.tab("cay")
    p.wait_for_timeout(100)
    da = '["l1","a"]'                                   # cấp 2: gấp mặc định, metadata chứa khoá / giá trị độc
    p.hover(_dong(da))
    chu_a = p.inner_text(_dong(da) + " > .xem-truoc")
    tt_a = T.title(_dong(da))
    aria_a = p.get_attribute(CHON_N % da, "aria-label") or ""
    check("<script>" in chu_a + tt_a and "onmouseover=wi" in tt_a and "<img src=x onerror=" in tt_a,
          "khoá / giá trị độc trong metadata: hiện NGUYÊN VĂN như văn bản (xem trước / tooltip)", (chu_a + " | " + tt_a)[:140])
    check(p.evaluate("() => window.__xss === undefined") and p.locator("#cay img, #cay svg, #cay script, #cay b").count() == 0
          and p.evaluate("() => document.querySelectorAll('[onerror],[onload],[onmouseover]').length") == 0 and "onmouseover" not in aria_a,
          "… không phần tử HTML nào được tạo, không thuộc tính on* nào, không mã nào chạy")
    p.click((CHON_N % da) + " > .mo-dong")
    p.wait_for_timeout(50)
    p.click((CHON_N % da) + " > .mo-dong")
    p.wait_for_timeout(50)
    check(p.evaluate("() => window.__xss === undefined") and p.locator("#cay img, #cay svg, #cay script").count() == 0 and not T.loi,
          "… và vẫn không chạy gì sau khi mở rồi gấp lại", T.loi[:1])
    T.dong()

    # 8. 360 px: gọn, không tràn; kiểu phần tử nhường chỗ (còn trong tooltip).
    T = Trang(tb, url, "meta-360", viewport={"width": 360, "height": 740}, color_scheme="dark")
    p = T.p
    JS_HINH = """() => {
        const cay = document.querySelector('#cay'); const dongs = [...cay.querySelectorAll('.n.dong-lai > .dong')];
        const cao = Math.max(...dongs.map(d => d.getBoundingClientRect().height));
        return { so: dongs.length, cao: cao, tranCay: cay.scrollWidth - cay.clientWidth,
                 tranTrang: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                 kieuCon: [...cay.querySelectorAll('.kieu-con')].some(e => getComputedStyle(e).display !== 'none'),
                 byte: [...cay.querySelectorAll('.n.dong-lai > .dong > .dem-byte')].every(e => e.getBoundingClientRect().width > 0) };
    }"""
    ban = {"du_lieu": {"nguoi": [{"ho_ten": "Nguyễn Văn Một Cái Tên Rất Dài", "email": "nguyen.van@vi-du.vn", "tags": [1, 2, 3]}] * 3,
                       "cai_dat": {"giao_dien": {"mau": "toi"}, "ngon_ngu": "vi", "thong_bao": [True, False]},
                       "dai": list(range(30))}}
    T.dien(J(ban))
    T.tab("cay")
    p.wait_for_timeout(100)
    hinh = p.evaluate(JS_HINH)
    check(hinh["so"] >= 3 and hinh["tranTrang"] <= 1 and hinh["tranCay"] <= 1 and hinh["cao"] <= 30 and not hinh["kieuCon"] and hinh["byte"],
          "360 px: %d hàng gấp ở cấp 2, mỗi hàng 1 dòng (cao tối đa %d px), cây không cuộn ngang (trang %d, cây %d), kiểu phần tử nhường chỗ, kích thước vẫn hiện"
          % (hinh["so"], hinh["cao"], hinh["tranTrang"], hinh["tranCay"]), hinh)
    check("kiểu phần tử: number×30" in T.title(_dong('["du_lieu","dai"]')) and T.title(_dong('["du_lieu","dai"]')).startswith("$.du_lieu.dai · mảng · 30 phần tử"),
          "360 px: kiểu phần tử ẩn trên hàng nhưng còn nguyên trong tooltip", T.title(_dong('["du_lieu","dai"]'))[:90])
    # Khoá rất dài ở cấp sâu: hàng tự cuộn ngang TRONG cây, trang không tràn (trước đợt này .o kéo cả trang rộng ra 395 px).
    dai = {"du_lieu": {"nguoi_dung_rat_dai_ten_khoa": [{"ho_va_ten": "Nguyễn Văn Một", "tags": [1, 2, 3]}] * 3, "cau_hinh": {"giao_dien": {"mau": "toi"}}}}
    T.tab("soan")
    T.dien(J(dai))
    T.tab("cay")
    p.wait_for_timeout(100)
    hinh2 = p.evaluate(JS_HINH)
    check(hinh2["tranTrang"] <= 1 and hinh2["byte"],
          "360 px, khoá rất dài + metadata: trang KHÔNG tràn ngang (%d px; hàng quá rộng cuộn trong cây: %d px; khoá dài tự xuống dòng như trước)" % (hinh2["tranTrang"], hinh2["tranCay"]), hinh2)
    check(not T.loi, "360 px: không lỗi console", T.loi[:2])
    T.dong()

    # 9. localStorage bị chặn: bật / tắt “Kích thước” vẫn chạy.
    chan = """Object.defineProperty(window, 'localStorage', { configurable: true,
        get() { throw new DOMException('bị chặn', 'SecurityError'); } });"""
    T = Trang(tb, url, "meta-chan-ls", init=chan)
    p = T.p
    T.dien(J(goc))
    T.tab("cay")
    p.uncheck("#cay-kich-thuoc")
    p.check("#cay-kich-thuoc")
    p.wait_for_timeout(60)
    check(p.locator(".dem-byte").count() >= 1 and not T.loi, "localStorage bị chặn: bật / tắt “Kích thước” vẫn chạy, không lỗi", T.loi[:2])
    T.dong()

    # 10. Tài liệu lớn: vượt ngân sách vẽ → hàng sau chưa có kích thước, rê chuột / focus thì có.
    T = Trang(tb, url, "meta-ngan-sach")
    p = T.p
    ngan_ve = p.evaluate("() => JE_APP.hangSo.NGAN_SACH.ve")
    n = int(ngan_ve * 0.6)
    lon = '{"a":{"b":[' + ",".join(["0"] * n) + ']},"c":{"d":[' + ",".join(["0"] * n) + ']},"e":{"f":[1,2]}}'
    t0 = p.evaluate("""(s) => { const t = performance.now(); JE_APP.datVanBan(s, { nhan: 'Tài liệu lớn' }); JE_APP.chuyenTab('cay'); return Math.round(performance.now() - t); }""", lon)
    p.wait_for_timeout(100)
    cob = lambda d: p.locator(_dong(d) + " > .dem-byte").count()
    check(cob('["a","b"]') == 1 and cob('["c","d"]') == 0 and cob('["e","f"]') == 0,
          "tài liệu %d nút (> ngân sách vẽ %d): hàng đầu có kích thước, hàng sau chưa (đã dừng đo, không treo trang) — ghi + vẽ cây %d ms"
          % (2 * n + 12, ngan_ve, t0), [cob('["a","b"]'), cob('["c","d"]'), cob('["e","f"]')])
    check("sâu" not in T.title(_dong('["c","d"]')) and T.title(_dong('["c","d"]')).startswith("$.c.d · mảng · %s phần tử" % format(n, ",").replace(",", ".")),
          "hàng chưa đo: tooltip vẫn có đường dẫn + số phần tử, không bịa kích thước", T.title(_dong('["c","d"]'))[:80])
    p.hover(_dong('["c","d"]') + " > .dem")
    p.wait_for_timeout(150)
    check(cob('["c","d"]') == 1 and p.inner_text(_dong('["c","d"]') + " > .dem-byte") == "· " + p.evaluate("b => JE_THU.dinhDangByte(b)", 2 * n + 1)
          and "byte khi nén" in T.title(_dong('["c","d"]')), "rê chuột vào hàng chưa đo → đo riêng hàng đó, kích thước đúng (%d B)" % (2 * n + 1))
    p.focus(CHON_N % '["e","f"]')
    p.wait_for_timeout(60)
    check(cob('["e","f"]') == 1, "focus bàn phím vào hàng chưa đo → cũng đo")
    check(not T.loi, "không lỗi console / pageerror", T.loi[:2])
    T.dong()

    # 11. Hàng quá lớn so với ngân sách TỪNG HÀNG: thử MỘT lần rồi thôi, không thử lại ở mỗi lần rê chuột.
    T = Trang(tb, url, "meta-hang-lon")
    p = T.p
    p.evaluate("() => { JE_APP.hangSo.NGAN_SACH.ve = 100; JE_APP.hangSo.NGAN_SACH.hang = 50; }")
    p.evaluate("(s) => { JE_APP.datVanBan(s, { nhan: 'Hàng lớn' }); JE_APP.chuyenTab('cay'); }", '{"x":{"y":[%s]}}' % ",".join(["0"] * 300))
    p.wait_for_timeout(80)
    dy = _dong('["x","y"]')
    check(p.locator(dy + " > .dem-byte").count() == 0, "ngân sách vẽ 100 nút < 301: hàng chưa có kích thước")
    p.hover(dy + " > .dem")
    p.wait_for_timeout(80)
    check(p.locator(dy + " > .dem-byte").count() == 0 and "quá lớn để đo" in T.title(dy) and T.title(dy).startswith("$.x.y · mảng · 300 phần tử"),
          "rê chuột: ngân sách hàng 50 cũng không đủ → vẫn không bịa kích thước, tooltip nói “quá lớn để đo”", T.title(dy)[:90])
    p.hover("#cay-mo")
    p.evaluate("() => { JE_APP.hangSo.NGAN_SACH.hang = 1e9; }")
    p.hover(dy + " > .dem")
    p.wait_for_timeout(80)
    check(p.locator(dy + " > .dem-byte").count() == 0, "đã thử một lần thì không thử lại ở lần rê chuột sau (dù ngân sách nới ra)")
    p.evaluate("() => { JE_APP.hangSo.NGAN_SACH.ve = 250000; }")
    p.click("#cay-kieu")
    p.click("#cay-kieu")                      # vẽ lại cây (veCay): ngân sách mới, hàng được đo lại từ đầu
    p.wait_for_timeout(80)
    check(p.locator(dy + " > .dem-byte").count() == 1, "vẽ lại cây với ngân sách đủ → hàng được đo (trạng thái “đã thử” chỉ thuộc về lần vẽ cũ)")
    check(not T.loi, "không lỗi console / pageerror", T.loi[:2])
    T.dong()


# ============================================================================================ JSON Schema (J3)
SC_NGUOI = {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "required": ["id", "ten", "meta"],
            "properties": {"id": {"type": "integer", "minimum": 1}, "ten": {"type": "string", "minLength": 2},
                           "email": {"type": "string", "format": "email"}}}
DU_SAI = {"id": 0, "ten": "A", "email": "abc"}                  # 3 lỗi (id, ten, thiếu meta) + 1 cảnh báo (email)
DU_DUNG = {"id": 1, "ten": "Ab", "meta": {}, "email": "a@b.co"}


def _lan(p):
    return p.evaluate("() => JE.uiSchema.soLan()")


def _cho_kiem(T, n0, timeout=7000):
    """Chờ MỘT lượt kiểm mới (soLan tăng) và không còn 'đang kiểm'."""
    return T.cho("n0 => JE.uiSchema.soLan() > n0 && document.querySelector('#sc-tom').dataset.tt !== 'dang'", n0, timeout)


def _tt(p):
    return p.evaluate("() => document.querySelector('#sc-tom').dataset.tt")


def _dat_schema(T, sc, cho=True):
    """Sang tab Schema, dán schema (fill → sự kiện input), chờ kiểm xong."""
    p = T.p
    n0 = _lan(p)
    T.tab("schema")
    p.fill("#sc-nhap", sc if isinstance(sc, str) else J(sc, 2))
    return _cho_kiem(T, n0) if cho else True


def _dat_du_lieu(T, du, cho_kiem=True):
    p = T.p
    n0 = _lan(p)
    p.evaluate("d => JE_APP.datVanBan(d, { nhan: 'Dữ liệu thử' })", du if isinstance(du, str) else J(du, 2))
    return _cho_kiem(T, n0) if cho_kiem else True


def _chon(p, sel="#nhap"):
    return p.evaluate("s => { const n = document.querySelector(s); return n.value.slice(n.selectionStart, n.selectionEnd); }", sel)


def _hang_du_lieu(p):
    """Các hàng lỗi DỮ LIỆU (có nút Cây/Văn bản, không phải cảnh báo): [[hien, thongBao]]."""
    return p.evaluate("""() => Array.from(document.querySelectorAll('#sc-loi li.sc-hang:not(.canh)')).filter(li => li.querySelector('.sc-hd'))
        .map(li => [li.querySelector('.sc-duong').textContent, li.querySelector('.sc-tb').textContent])""")


def _hang_loc(p, hien, canh=False):
    sel = "#sc-loi li.sc-hang" + (".canh" if canh else ":not(.canh)")
    return p.locator(sel).filter(has=p.locator(".sc-duong", has_text=re.compile("^" + re.escape(hien) + "$")))


def _huy_hieu(p, duong_json):
    return p.evaluate("s => { const e = document.querySelector(s + ' > .dong > .huy-hieu-loi'); return e ? [e.textContent, e.title] : null; }", CHON_N % duong_json)


def _san_sang_moi(p, tb, url, ten="schema", **kw):
    return Trang(tb, url, ten, **kw)


def schema_tab(tb, url):
    section(" · tab Schema: kiểm, lỗi bấm tới được vị trí, huy hiệu cây + chân trang (việc 8, 22, 23, 26)")
    T = Trang(tb, url, "schema-tab")
    p = T.p
    ds_tab = p.evaluate("() => Array.from(document.querySelectorAll('.tab-n')).map(b => b.dataset.o)")
    check(ds_tab == ["soan", "cay", "loc", "sosanh", "thongke", "schema"] and p.get_attribute('.tab-n[data-o="schema"]', "role") == "tab",
          "có tab “✓ Schema” là tab thứ 6, role=tab", ds_tab)
    T.dien(J(DU_SAI, 2))
    check(_dat_schema(T, SC_NGUOI) and _tt(p) == "loi", "dán schema + dữ liệu sai → trạng thái loi", _tt(p))

    hang = _hang_du_lieu(p)
    mong = {"$.id": "Phải ≥ 1, đang là 0", "$.ten": "Cần ít nhất 2 ký tự, đang có 1", "$": "Thiếu khoá bắt buộc “meta”"}
    check(len(hang) == 3 and all(any(h[0] == k and v in h[1] for h in hang) for k, v in mong.items()),
          "ĐÚNG 3 lỗi: id (minimum), ten (minLength), thiếu meta (required)", hang)
    canh = p.evaluate("() => Array.from(document.querySelectorAll('#sc-loi li.sc-hang.canh')).map(li => li.querySelector('.sc-duong').textContent + ' ' + li.querySelector('.sc-tb').textContent)")
    check(len(canh) == 1 and "$.email" in canh[0] and "Không phải email hợp lệ" in canh[0], "format email sai chỉ là CẢNH BÁO (mặc định mức cảnh báo)", canh)
    tom = p.inner_text("#sc-tom")
    check("3 lỗi dữ liệu" in tom and "1 cảnh báo" in tom and "draft 2020-12" in tom, "tóm tắt: 3 lỗi · 1 cảnh báo · draft 2020-12", tom)
    chan = p.inner_text("#sc-chan")
    check(p.is_visible("#sc-chan") and chan == "Schema: 3 lỗi" and p.get_attribute("#sc-chan", "data-tt") == "loi", "huy hiệu chân trang “Schema: 3 lỗi”", chan)
    check(p.evaluate("() => JE.chayNen.thongKe.soWorker >= 1 && JE.chayNen.thongKe.soLuongChinh === 0 && JE.chayNen.coWorker()"),
          "kiểm chạy trong Worker (khi phục vụ qua máy chủ), không rơi về luồng chính")

    # --- bấm lỗi → Cây
    _hang_loc(p, "$.id").locator('button[data-hd="cay"]').click()
    p.wait_for_timeout(150)
    act = p.evaluate("() => { const a = document.activeElement; return a && a.getAttribute('data-p'); }")
    check(act == '["id"]' and p.evaluate("() => JE_APP.tabHien()") == "cay", "nút [Cây] của lỗi $.id → tab Cây, focus đúng nút", act)
    # --- bấm lỗi → Văn bản
    T.tab("schema")
    _hang_loc(p, "$.ten").locator('button[data-hd="soan"]').click()
    p.wait_for_timeout(150)
    check(p.evaluate("() => JE_APP.tabHien()") == "soan" and _chon(p) == '"A"' and p.evaluate("() => document.activeElement.id") == "nhap",
          "nút [Văn bản] của lỗi $.ten → tab Soạn, đoạn chọn đúng là \"A\"", _chon(p))
    T.tab("schema")
    _hang_loc(p, "$").locator('button[data-hd="soan"]').click()
    p.wait_for_timeout(150)
    check(_chon(p) == "{" and p.evaluate("() => document.querySelector('#nhap').selectionStart") == 0, "lỗi ở gốc ($, thiếu meta) → chọn dấu { mở object", _chon(p))
    # --- bấm lỗi → vị trí trong schema
    T.tab("schema")
    _hang_loc(p, "$.id").locator('button[data-hd="schema"]').click()
    p.wait_for_timeout(150)
    check(p.evaluate("() => JE_APP.tabHien()") == "schema" and _chon(p, "#sc-nhap") == '"minimum"', "nút [▸ schema] của lỗi $.id → chọn đúng từ khoá \"minimum\" trong ô schema", _chon(p, "#sc-nhap"))
    _hang_loc(p, "$").locator('button[data-hd="schema"]').click()
    p.wait_for_timeout(100)
    check(_chon(p, "#sc-nhap") == '"required"', "lỗi thiếu meta → [▸ schema] chọn \"required\"", _chon(p, "#sc-nhap"))
    # --- nút chính: tới tab dữ liệu dùng gần nhất
    _hang_loc(p, "$.ten").locator("button.sc-chinh").click()
    p.wait_for_timeout(150)
    check(p.evaluate("() => JE_APP.tabHien()") == "soan" and _chon(p) == '"A"', "bấm cả hàng lỗi → tab dữ liệu dùng gần nhất (Soạn) và chọn đoạn", _chon(p))
    T.tab("cay")
    T.tab("schema")
    _hang_loc(p, "$.id").locator("button.sc-chinh").click()
    p.wait_for_timeout(150)
    check(p.evaluate("() => JE_APP.tabHien()") == "cay" and p.evaluate("() => document.activeElement.getAttribute('data-p')") == '["id"]', "…và sau khi dùng Cây thì bấm hàng lỗi đưa về Cây", None)

    # --- huy hiệu trên cây
    T.tab("cay")
    hid = _huy_hieu(p, '["id"]')
    hten = _huy_hieu(p, '["ten"]')
    hgoc = _huy_hieu(p, "[]")
    check(hid and hid[0] == "⛔ 1" and "Phải ≥ 1" in hid[1] and hten and hten[0] == "⛔ 1" and hgoc and hgoc[0] == "⛔ 1" and "Thiếu khoá bắt buộc" in hgoc[1],
          "cây: hàng có lỗi có huy hiệu “⛔ 1” + tooltip thông báo (id, ten, gốc)", [hid, hten, hgoc])
    check(p.evaluate("() => document.querySelectorAll('.n.co-loi-schema').length") == 3 and
          p.evaluate("s => getComputedStyle(document.querySelector(s + ' > .dong')).boxShadow", CHON_N % '["id"]') != "none",
          "cây: 3 hàng có viền đỏ bên trái (co-loi-schema)")
    p.click(CHON_N % "[]" + " > .mo-dong")
    p.wait_for_timeout(100)
    hgoc2 = _huy_hieu(p, "[]")
    check(hgoc2 and hgoc2[0] == "⛔ 3" and "2 lỗi ở bên trong" in hgoc2[1], "gấp gốc lại → huy hiệu gộp cả lỗi bên trong “⛔ 3”", hgoc2)
    p.click(CHON_N % "[]" + " > .mo-dong")

    # --- sửa dữ liệu → tự kiểm lại
    n0 = _lan(p)
    p.evaluate("d => JE_APP.datVanBan(d, { nhan: 'Sửa đúng' })", J(DU_DUNG, 2))
    ok = _cho_kiem(T, n0)
    check(ok and _tt(p) == "ok" and p.inner_text("#sc-chan") == "Schema ✓" and p.locator(".huy-hieu-loi").count() == 0 and p.locator(".n.co-loi-schema").count() == 0,
          "sửa dữ liệu cho đúng → tự kiểm lại: “Schema ✓”, huy hiệu cây biến mất", [_tt(p), p.inner_text("#sc-chan")])
    check("Hợp lệ theo schema" in p.inner_text("#sc-tom"), "tóm tắt “✓ Hợp lệ theo schema”")

    # --- tải lại: giữ schema
    p.reload(wait_until="load")
    p.wait_for_function("() => !!window.JE_APP && !!window.JE.uiSchema", timeout=10000)
    T.cho("() => document.querySelector('#sc-tom').dataset.tt === 'ok'", None, 6000)
    luu = p.input_value("#sc-nhap")
    check(luu.strip() != "" and json.loads(luu) == SC_NGUOI and _tt(p) == "ok", "tải lại trang: schema còn nguyên (lưu cạnh dữ liệu) và tự kiểm lại → ok", _tt(p))
    T.dong()


def schema_tuy_chon(tb, url):
    section(" · tab Schema: tuỳ chọn Draft / Format / Tự kiểm, lỗi schema, ví dụ, định dạng")
    T = Trang(tb, url, "schema-tuy-chon")
    p = T.p
    T.dien(J(DU_SAI, 2))
    _dat_schema(T, SC_NGUOI)
    n0 = _lan(p)
    p.select_option("#sc-format", "loi")
    check(_cho_kiem(T, n0) and len(_hang_du_lieu(p)) == 4 and any(h[0] == "$.email" for h in _hang_du_lieu(p)), "Format = Lỗi → email sai thành lỗi thứ 4", _hang_du_lieu(p))
    n0 = _lan(p)
    p.select_option("#sc-format", "bo-qua")
    _cho_kiem(T, n0)
    check(len(_hang_du_lieu(p)) == 3 and p.locator("#sc-loi li.sc-hang.canh").count() == 0, "Format = Bỏ qua → không còn cảnh báo email")
    p.select_option("#sc-format", "loi")
    p.wait_for_timeout(300)
    p.reload(wait_until="load")
    p.wait_for_function("() => !!window.JE_APP && !!window.JE.uiSchema", timeout=10000)
    check(p.input_value("#sc-format") == "loi" and p.input_value("#sc-draft") == "tu-dong" and p.is_checked("#sc-tu-kiem"), "tuỳ chọn Format nhớ qua tải lại (localStorage)", p.input_value("#sc-format"))
    T.tab("schema")
    p.select_option("#sc-format", "canh-bao")

    # --- Draft: cùng schema, hai kết quả khác nhau
    tuple_sc = {"type": "array", "prefixItems": [{"type": "string"}], "items": False}
    _dat_du_lieu(T, "[1]", cho_kiem=False)
    _dat_schema(T, tuple_sc)
    kq = p.evaluate("() => JE.uiSchema.ketQua().loi.map(e => e.tuKhoa)")
    check(kq == ["type"], "2020-12: prefixItems[0] kiểu string bắt lỗi type ở phần tử 0", kq)
    n0 = _lan(p)
    p.select_option("#sc-draft", "07")
    _cho_kiem(T, n0)
    kq = p.evaluate("() => JE.uiSchema.ketQua().loi.map(e => e.tuKhoa)")
    check(kq == ["items"] and "draft 07" in p.inner_text("#sc-tom") and p.evaluate("() => JE.uiSchema.ketQua().canhBaoSchema.length") >= 1,
          "ép draft-07: prefixItems bị bỏ qua (có cảnh báo), items:false từ chối phần tử", kq)
    p.select_option("#sc-draft", "tu-dong")

    # --- Tự kiểm tắt
    _dat_schema(T, SC_NGUOI)
    p.uncheck("#sc-tu-kiem")
    p.wait_for_timeout(100)
    n0 = _lan(p)
    p.evaluate("d => JE_APP.datVanBan(d, { nhan: 'X' })", J(DU_DUNG, 2))
    p.wait_for_timeout(900)
    check(_lan(p) == n0 and "kết quả cũ" in p.inner_text("#sc-tom") and p.inner_text("#sc-chan") == "Schema: chưa kiểm lại" and p.locator(".huy-hieu-loi").count() == 0,
          "tắt “Tự kiểm”: sửa dữ liệu KHÔNG kiểm lại; báo kết quả cũ, huy hiệu cây tắt", [_lan(p), n0, p.inner_text("#sc-chan")])
    n0 = _lan(p)
    p.click("#sc-kiem-ngay")
    check(_cho_kiem(T, n0) and _tt(p) == "ok", "“Kiểm ngay” kiểm lại → ok", _tt(p))
    p.check("#sc-tu-kiem")
    p.wait_for_timeout(300)

    # --- schema hỏng JSON
    _dat_schema(T, '{"type": ')
    check(_tt(p) == "hong-json" and "dòng" in p.inner_text("#sc-trang-thai") and "loi" in (p.get_attribute("#sc-trang-thai", "class") or "") and p.inner_text("#sc-chan") == "Schema hỏng",
          "schema không phải JSON: trạng thái hong-json, dòng trạng thái báo dòng/cột, chân trang “Schema hỏng”", p.inner_text("#sc-trang-thai"))
    # --- lỗi schema (pattern sai) → bấm tới đúng từ khoá
    _dat_schema(T, '{\n  "type": "string",\n  "pattern": "("\n}')
    hang_sc = p.evaluate("() => Array.from(document.querySelectorAll('#sc-loi li.sc-hang:not(.canh)')).filter(li => !li.querySelector('.sc-hd')).map(li => li.querySelector('.sc-duong').textContent)")
    check(_tt(p) == "hong-schema" and hang_sc == ["#/pattern"] and p.inner_text("#sc-chan") == "Schema hỏng · 1 lỗi", "pattern sai → hong-schema, lỗi ở #/pattern, chân trang “Schema hỏng · 1 lỗi”", [_tt(p), hang_sc])
    p.locator("#sc-loi li.sc-hang button.sc-chinh").first.click()
    p.wait_for_timeout(100)
    check(_chon(p, "#sc-nhap") == '"pattern"', "bấm lỗi schema → chọn đúng từ khoá \"pattern\" trong ô schema", _chon(p, "#sc-nhap"))
    # --- gõ sai từ khoá → gợi ý
    _dat_schema(T, '{"requried": ["a"], "properties": {"a": {"tyep": "string"}}}')
    canh_sc = p.inner_text("#sc-loi")
    check("có phải “required”" in canh_sc and "có phải “type”" in canh_sc and _tt(p) == "ok", "từ khoá gõ sai → cảnh báo kèm gợi ý “có phải required / type”", canh_sc[:200])
    # --- $ref ngoài
    _dat_schema(T, {"$ref": "https://example.com/other.json"})
    check(_tt(p) == "hong-schema" and "Không tải được $ref ngoài (ứng dụng chạy offline)" in p.inner_text("#sc-loi"), "$ref tới địa chỉ ngoài: báo rõ không tải được (offline)", p.inner_text("#sc-loi")[:160])
    check("không tải $ref" in p.inner_text(".sc-ho-tro").lower() or "không tải $ref" in p.evaluate("() => document.querySelector('.sc-ho-tro').textContent.toLowerCase()"),
          "giao diện ghi rõ giới hạn: không tải $ref tới địa chỉ ngoài")
    # --- dữ liệu hỏng / trống
    _dat_schema(T, SC_NGUOI)
    _dat_du_lieu(T, "{bad")
    check(_tt(p) == "du-lieu-loi" and "chưa là JSON hợp lệ" in p.inner_text("#sc-tom") and p.inner_text("#sc-chan") == "Schema: chờ JSON hợp lệ", "dữ liệu hỏng JSON → báo sửa ở tab Soạn, không kiểm", p.inner_text("#sc-tom"))
    _dat_du_lieu(T, "")
    check(_tt(p) == "chua-du-lieu", "dữ liệu trống → chua-du-lieu", _tt(p))
    # --- ví dụ: chèn schema + dữ liệu mẫu có lỗi khi ô Soạn trống
    n0 = _lan(p)
    p.select_option("#sc-vi-du", "0")
    check(_cho_kiem(T, n0) and "Người dùng" in p.input_value("#sc-nhap") and p.evaluate("() => JE_APP.layVanBan().indexOf('khong-phai-email') >= 0") and _tt(p) == "loi",
          "chọn ví dụ “Người dùng”: chèn schema và (vì ô Soạn trống) dữ liệu mẫu có lỗi → có lỗi", _tt(p))
    check(len(_hang_du_lieu(p)) == 6, "ví dụ cho ĐÚNG 6 lỗi dữ liệu (id, ten, tuoi, vaiTro, tags[1], thua)", [h[0] for h in _hang_du_lieu(p)])
    # --- định dạng schema + Ctrl+Z trong ô schema
    _dat_schema(T, '{"type":"object","properties":{"a":{"type":"integer"}}}')
    p.click("#sc-dinh-dang")
    p.wait_for_timeout(120)
    dd = p.input_value("#sc-nhap")
    check(dd.count("\n") >= 6 and json.loads(dd)["properties"]["a"]["type"] == "integer", "“Định dạng schema” → JSON nhiều dòng, cùng nội dung", dd[:60])
    p.keyboard.press("Control+z")
    p.wait_for_timeout(120)
    check(p.input_value("#sc-nhap") == '{"type":"object","properties":{"a":{"type":"integer"}}}', "Ctrl+Z trong ô schema hoàn tác Định dạng (ghi bằng execCommand)", p.input_value("#sc-nhap")[:60])
    # --- bảng từ khoá
    check(p.evaluate("() => document.querySelectorAll('#sc-ho-tro tr').length") > 15 and "unevaluatedProperties" in p.evaluate("() => document.querySelector('#sc-ho-tro').textContent"),
          "bảng “Từ khoá hỗ trợ” có > 15 dòng, ghi rõ unevaluated* chưa hỗ trợ")
    T.dong()


def schema_xss(tb, url):
    section(" · tab Schema: dữ liệu độc trong schema / dữ liệu / thông báo lỗi không thực thi")
    T = Trang(tb, url, "schema-xss")
    p = T.p
    ten = "<img src=x onerror=window.__xss=1>"
    sc = {"type": "object", "properties": {ten: {"type": "integer"}, "b": {"enum": ["<svg onload=window.__xss=2>"]}}, "additionalProperties": False, "required": ["<script>window.__xss=3</script>"]}
    du = {ten: "<img src=x onerror=window.__xss=4>", "b": "<iframe src=javascript:window.__xss=5>", "<b onclick=window.__xss=6>x</b>": 1}
    T.dien(J(du, 2))
    _dat_schema(T, sc)
    n = len(_hang_du_lieu(p))
    p.locator("#sc-loi li.sc-hang:not(.canh) button[data-hd='cay']").first.click()
    T.tab("cay")
    p.click("#cay-mo")
    T.tab("schema")
    p.wait_for_timeout(200)
    check(n >= 4 and p.evaluate("() => window.__xss === undefined") and p.locator("img").count() == 0 and p.locator("svg").count() == 0 and p.locator("iframe").count() == 0 and p.locator("#sc-loi script").count() == 0,
          "tên khoá / giá trị / thông báo chứa <img onerror>, <svg onload>, <iframe>, <script>: không phần tử nào được tạo, không mã nào chạy (%d lỗi)" % n)
    tt_cay = p.evaluate("() => Array.from(document.querySelectorAll('.huy-hieu-loi')).map(e => e.title).join('|')")
    check("<img" in tt_cay and p.evaluate("() => document.querySelectorAll('.n img, .n svg').length") == 0, "tooltip huy hiệu cây giữ nguyên chữ (không phân tích HTML)")
    T.dong()


def schema_360(tb, url):
    section(" · tab Schema: 360 px xếp dọc, không tràn ngang")
    T = Trang(tb, url, "schema-360", viewport={"width": 360, "height": 740}, color_scheme="dark")
    p = T.p
    T.dien(J(DU_SAI, 2))
    _dat_schema(T, SC_NGUOI)
    tran = p.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
    hinh = p.evaluate("""() => { const a = document.querySelector('.sc-trai').getBoundingClientRect(), b = document.querySelector('.sc-phai').getBoundingClientRect();
        return { daiTrai: a.width, daiPhai: b.width, phaiDuoiTrai: b.top >= a.bottom - 1, chanPhai: document.querySelector('#sc-chan').getBoundingClientRect().right }; }""")
    check(tran <= 1 and hinh["phaiDuoiTrai"] and hinh["daiTrai"] <= 361 and hinh["daiPhai"] <= 361, "hai khung xếp dọc, trang không tràn ngang (%dpx)" % tran, hinh)
    check(hinh["chanPhai"] <= 361 and p.is_visible("#sc-chan"), "huy hiệu chân trang nằm gọn trong 360 px", hinh["chanPhai"])
    p.locator("#sc-loi li.sc-hang:not(.canh)").first.scroll_into_view_if_needed()
    check(p.locator("#sc-loi li.sc-hang").count() == 4 and p.is_visible("#sc-loi li.sc-hang >> nth=0"), "danh sách lỗi cuộn được, hàng đầu hiện")
    T.dong()


def schema_lon_redos(tb, url):
    section(" · tab Schema: dữ liệu lớn (> 1 MB không tự kiểm), ReDoS báo hết giờ, Worker chạy khi phục vụ qua máy chủ")
    T = Trang(tb, url, "schema-lon")
    p = T.p
    p.evaluate("() => JE_APP.datVanBan(JSON.stringify(Array.from({ length: 190000 }, (_, i) => i)), { nhan: 'Mảng lớn' })")
    kich = p.evaluate("() => JE_APP.layVanBan().length")
    n0 = _lan(p)
    T.tab("schema")
    p.fill("#sc-nhap", '{"type": "array", "items": {"type": "integer", "minimum": 1}}')
    T.cho("n0 => JE.uiSchema.soLan() > n0 && document.querySelector('#sc-tom').dataset.tt !== 'dang'", n0, 8000)
    check(kich > 1024 * 1024 and _tt(p) == "can-bam" and "Kiểm ngay" in p.inner_text("#sc-tom"), "dữ liệu %.2f MB (> 1 MB): không tự kiểm, báo “bấm Kiểm ngay”" % (kich / 1048576), [kich, _tt(p)])
    n0 = _lan(p)
    t0 = p.evaluate("() => performance.now()")
    p.click("#sc-kiem-ngay")
    ok = _cho_kiem(T, n0, 15000)
    ms = p.evaluate("t0 => performance.now() - t0", t0)
    hang = _hang_du_lieu(p)
    info("kiểm %.2f MB (190 000 số) trong Worker: %.0f ms tổng (gồm gửi + chạy + dựng danh sách)" % (kich / 1048576, ms))
    check(ok and _tt(p) == "loi" and len(hang) == 1 and hang[0][0] == "$[0]" and p.evaluate("() => JE.chayNen.thongKe.soLuongChinh === 0 && JE.chayNen.thongKe.soWorker >= 1"),
          "“Kiểm ngay” kiểm đủ dữ liệu lớn trong Worker: 1 lỗi ở $[0] (0 < 1)", [_tt(p), hang])
    T.dong()

    # --- ReDoS
    T = Trang(tb, url, "schema-redos")
    p = T.p
    p.evaluate("() => { JE_APP.hangSo.CHAY_NEN.han = 1500; }")
    du = {"s": "a" * 42 + "b"}
    sc = {"type": "object", "properties": {"s": {"pattern": "(a+)+$"}}}
    T.dien(J(du))
    n0 = _lan(p)
    t0 = p.evaluate("() => performance.now()")
    T.tab("schema")
    p.fill("#sc-nhap", J(sc))
    ok = _cho_kiem(T, n0, 9000)
    ms = p.evaluate("t0 => performance.now() - t0", t0)
    info("ReDoS (a+)+$ trên 42 ký tự: báo hết giờ sau %.0f ms (hạn 1500 + debounce 400)" % ms)
    check(ok and _tt(p) == "het-gio" and "quá lâu" in p.inner_text("#sc-tom") and p.inner_text("#sc-chan") == "Schema: hết giờ" and p.evaluate("() => JE.chayNen.thongKe.soHetGio === 1"),
          "pattern quay lui thảm hoạ: báo “Kiểm quá lâu”, chân trang “Schema: hết giờ”", [_tt(p), p.inner_text("#sc-tom")[:80]])
    t1 = p.evaluate("() => performance.now()")
    r = p.evaluate("() => 21 * 2")
    check(r == 42 and p.evaluate("t1 => performance.now() - t1", t1) < 400, "trang KHÔNG treo trong lúc Worker bị ReDoS (luồng chính vẫn đáp ứng)")
    T.tab("soan")
    p.click("#nhap")
    p.keyboard.type(" ")
    check(p.evaluate("() => document.querySelector('#nhap').value.endsWith(' ')"), "vẫn gõ được vào ô Soạn sau khi hết giờ")
    n0 = _lan(p)
    T.tab("schema")
    p.fill("#sc-nhap", J({"type": "object", "properties": {"s": {"pattern": "^a+b$"}}}))
    ok = _cho_kiem(T, n0, 9000)
    check(ok and _tt(p) == "ok" and p.evaluate("() => JE.chayNen.thongKe.soWorker >= 2 && JE.chayNen.thongKe.soLuongChinh === 0"), "sửa pattern lành → kiểm lại bằng Worker MỚI, ra ok (phục hồi sau hết giờ)", _tt(p))
    T.dong()


def schema_mo_tep(tb, url):
    section(" · tab Schema: mở tệp trông như schema → gợi ý “Dùng làm schema”")
    T = Trang(tb, url, "schema-tep")
    p = T.p
    T.dien('{"x": 1}')
    noi_dung = J(SC_NGUOI, 2)
    p.set_input_files("#tep", files=[{"name": "nguoi.schema.json", "mimeType": "application/json", "buffer": noi_dung.encode("utf-8")}])
    ok = T.cho("() => !document.querySelector('#sc-goi-y').hidden", None, 3000)
    check(ok and "nguoi.schema.json" in p.inner_text("#sc-goi-y-chu") and T.cho_gt(noi_dung), "mở tệp có $schema: hiện gợi ý “trông như một JSON Schema”, dữ liệu đã nhận nội dung tệp", p.inner_text("#sc-goi-y-chu"))
    p.click("#sc-goi-y-dung")
    p.wait_for_timeout(250)
    check(json.loads(p.input_value("#sc-nhap")) == SC_NGUOI and T.cho_gt('{"x": 1}') and p.evaluate("() => JE_APP.tabHien()") == "schema" and p.evaluate("() => document.querySelector('#sc-goi-y').hidden"),
          "“Dùng làm schema”: schema = nội dung tệp, dữ liệu trả về bản cũ, sang tab Schema, ẩn gợi ý", T.gt())
    # tệp dữ liệu thường: không gợi ý
    p.set_input_files("#tep", files=[{"name": "du-lieu.json", "mimeType": "application/json", "buffer": b'{"ten": "x", "properties": [1, 2]}'}])
    p.wait_for_timeout(400)
    check(p.evaluate("() => document.querySelector('#sc-goi-y').hidden"), "tệp dữ liệu thường: không gợi ý")
    # properties/$defs ở gốc không $schema
    p.set_input_files("#tep", files=[{"name": "s2.json", "mimeType": "application/json", "buffer": b'{"type": "object", "properties": {"a": {"type": "string"}}}'}])
    check(T.cho("() => !document.querySelector('#sc-goi-y').hidden", None, 3000), "tệp có properties ở gốc (không có $schema) cũng được gợi ý")
    p.click("#sc-goi-y-bo")
    check(p.evaluate("() => document.querySelector('#sc-goi-y').hidden") and p.input_value("#nhap").find('"properties"') >= 0, "“Giữ làm dữ liệu”: ẩn gợi ý, dữ liệu giữ nội dung tệp")
    T.dong()


def schema_hien_them(tb, url):
    section(" · tab Schema: danh sách > 300 hàng — nút “Hiện thêm” (300 → 600 → 700, hết thì mất nút)")
    T = Trang(tb, url, "schema-hien-them")
    p = T.p
    T.dien('{"a": 1}')
    ok = _dat_schema(T, {"khoa_la_%d" % i: 1 for i in range(700)})            # 700 cảnh báo schema (từ khoá lạ) trong MỘT nhóm
    hang = lambda: p.locator("#sc-loi li.sc-hang").count()
    nut = p.locator("#sc-loi li.sc-them button")
    check(ok and hang() == 300 and nut.count() == 1 and "còn 400" in nut.inner_text(), "700 cảnh báo: chỉ vẽ 300 hàng, nút “Hiện thêm 300 (còn 400)”", [hang(), nut.count() and nut.inner_text()])
    nut.click()
    check(hang() == 600 and nut.count() == 1 and "Hiện thêm 100 (còn 100)" == nut.inner_text(), "bấm lần 1: 600 hàng, nút còn “Hiện thêm 100 (còn 100)”", [hang(), nut.count() and nut.inner_text()])
    nut.click()
    check(hang() == 700 and nut.count() == 0, "bấm lần 2: đủ 700 hàng, nút biến mất", [hang(), nut.count()])
    check(p.locator("#sc-loi li.sc-nhom").count() == 1, "chỉ một dòng tiêu đề nhóm (không nhân đôi khi hiện thêm)", p.locator("#sc-loi li.sc-nhom").count())
    T.dong()


def schema_luu_tru_chan(tb, url):
    section(" · tab Schema khi localStorage bị chặn")
    chan = """Object.defineProperty(window, 'localStorage', { configurable: true,
        get() { throw new DOMException('bị chặn', 'SecurityError'); } });"""
    T = Trang(tb, url, "schema-chan-ls", init=chan)
    p = T.p
    T.dien(J(DU_SAI, 2))
    ok = _dat_schema(T, SC_NGUOI)
    p.select_option("#sc-format", "loi")
    p.wait_for_timeout(500)
    check(ok and not T.loi and len(_hang_du_lieu(p)) >= 3, "localStorage ném lỗi: tab Schema vẫn nạp, kiểm, đổi tuỳ chọn, không lỗi console", T.loi[:2])
    T.dong()


# ============================================================================================ Sinh dữ liệu mẫu + suy schema (J4)
DU_VD = {"id": 1, "ten": "An", "email": "an@vd.vn", "ngay": "2024-01-05", "tags": ["a", "b"], "diaChi": {"quan": "1"}}


def _sinh_lan(p):
    return p.evaluate("() => JE.uiSchema.sinh.soLan()")


def _sinh_tt(p):
    return p.evaluate("() => document.querySelector('#sc-sinh-bao').dataset.tt")


def _cho_sinh(T, n0, timeout=9000):
    """Chờ MỘT kết quả sinh mới (soLan tăng) và không còn 'đang sinh'."""
    return T.cho("n0 => JE.uiSchema.sinh.soLan() > n0 && document.querySelector('#sc-sinh-bao').dataset.tt !== 'dang'", n0, timeout)


def _xem(p):
    return p.evaluate("() => document.querySelector('#sc-sinh-xem').textContent")


def _van_ban_sinh(p):
    return p.evaluate("() => JE.uiSchema.sinh.text()")


def _bam_sinh(T, sel="#sc-sinh-chay", timeout=9000):
    """Bấm một nút sinh và chờ kết quả mới; trả về văn bản mẫu."""
    p = T.p
    n0 = _sinh_lan(p)
    p.click(sel)
    _cho_sinh(T, n0, timeout)
    return _van_ban_sinh(p)


def _hop_le_trong_trang(p):
    """Kiểm LẠI mẫu đang xem bằng bộ kiểm J3 với format ở mức 'loi' (độc lập với bộ sinh)."""
    return p.evaluate("""() => { const d = JSON.parse(JE.uiSchema.sinh.text()), sc = JSON.parse(document.querySelector('#sc-nhap').value);
        return JE.schema.kiem(d, sc, { format: 'loi' }).hopLe; }""")


def sinh_giao_dien(tb, url):
    section(" · tab Schema: Sinh dữ liệu mẫu — xem trước, báo cáo, seed, số mẫu, khoá tuỳ chọn, Dùng làm dữ liệu + hoàn tác, Chép, Tải (việc 30)")
    T = Trang(tb, url, "sinh-ui", permissions=["clipboard-read", "clipboard-write"], accept_downloads=True)
    p = T.p
    T.dien(J(DU_SAI, 2))
    _dat_schema(T, SC_NGUOI)
    nut = p.get_by_role("button", name=re.compile("Sinh dữ liệu mẫu"))
    check(nut.count() == 1 and p.is_hidden("#sc-sinh") and nut.get_attribute("aria-expanded") == "false",
          "nút “Sinh dữ liệu mẫu” (đúng 1 nút) có sẵn; khung sinh ẩn lúc đầu (aria-expanded=false)")
    n0 = _sinh_lan(p)
    nut.click()
    ok = _cho_sinh(T, n0)
    bao = p.inner_text("#sc-sinh-bao")
    check(ok and p.is_visible("#sc-sinh") and nut.get_attribute("aria-expanded") == "true" and _sinh_tt(p) == "ok" and "Hợp lệ theo schema" in bao and "lần thử" in bao,
          "bấm nút → mở khung và sinh ngay: báo “✔ Hợp lệ theo schema (… lần thử)”", [_sinh_tt(p), bao])
    mau1 = _van_ban_sinh(p)
    d = json.loads(mau1)
    check(isinstance(d, dict) and {"id", "ten", "meta"} <= set(d) and _xem(p) == mau1 and _hop_le_trong_trang(p),
          "xem trước = đúng văn bản mẫu, đủ khoá bắt buộc (id, ten, meta), và kiểm LẠI bằng bộ kiểm độc lập: hợp lệ (format ở mức lỗi)", mau1[:120])
    check(p.evaluate("() => JE.chayNen.thongKe.soWorker >= 2 && JE.chayNen.thongKe.soLuongChinh === 0"), "sinh chạy trong Worker (khi phục vụ qua máy chủ), không rơi về luồng chính")
    check(p.locator("#sc-sinh-xem span").count() > 5 and p.evaluate("() => !document.querySelector('#sc-sinh-dung').disabled && !document.querySelector('#sc-sinh-chep').disabled && !document.querySelector('#sc-sinh-tai').disabled"),
          "xem trước có tô màu (span m-…), các nút Dùng / Chép / Tải bật lên")

    # --- cùng seed → cùng kết quả; seed khác → khác
    mau1b = _bam_sinh(T)
    p.fill("#sc-sinh-seed", "hat-khac")
    mau2 = _bam_sinh(T)
    p.fill("#sc-sinh-seed", "mau-1")
    mau3 = _bam_sinh(T)
    check(mau1b == mau1 and mau3 == mau1 and mau2 != mau1, "cùng seed → cùng kết quả (3 lần), seed khác → khác", [mau1[:60], mau2[:60]])

    # --- số mẫu
    p.fill("#sc-sinh-so", "3")
    mau_n = _bam_sinh(T)
    arr = json.loads(mau_n)
    check(isinstance(arr, list) and len(arr) == 3 and "3 mẫu" in p.inner_text("#sc-sinh-bao") and p.evaluate("() => JE.uiSchema.sinh.ketQua().hopLe"),
          "số mẫu = 3 → mảng 3 mẫu, báo “3 mẫu”, đều hợp lệ", p.inner_text("#sc-sinh-bao"))
    p.fill("#sc-sinh-so", "1")

    # --- khoá tuỳ chọn 0 % / 100 %
    p.fill("#sc-sinh-tile", "0")
    k0 = list(json.loads(_bam_sinh(T)).keys())
    p.fill("#sc-sinh-tile", "100")
    k100 = list(json.loads(_bam_sinh(T)).keys())
    check(k0 == ["id", "ten", "meta"] and "email" in k100, "khoá tuỳ chọn 0 % → chỉ khoá bắt buộc; 100 % → có cả “email”", [k0, k100])
    p.fill("#sc-sinh-tile", "50")

    # --- schema đổi sau khi sinh → xem trước bị làm mờ + nhắc
    sc_cu = p.input_value("#sc-nhap")
    p.fill("#sc-nhap", sc_cu.replace('"minLength": 2', '"minLength": 3'))
    ok = T.cho("() => document.querySelector('#sc-sinh-xem').classList.contains('cu')", None, 2000)
    check(ok and "schema đã đổi" in p.inner_text("#sc-sinh-bao") and not p.is_disabled("#sc-sinh-dung"), "sửa schema sau khi sinh: xem trước bị làm mờ, nhắc “schema đã đổi — bấm Sinh để cập nhật” (nút vẫn dùng được)", p.inner_text("#sc-sinh-bao"))
    p.fill("#sc-nhap", sc_cu)
    mau_moi = _bam_sinh(T)
    check(not p.evaluate("() => document.querySelector('#sc-sinh-xem').classList.contains('cu')") and "schema đã đổi" not in p.inner_text("#sc-sinh-bao") and _sinh_tt(p) == "ok", "sinh lại → hết mờ, hết nhắc", p.inner_text("#sc-sinh-bao"))

    # --- Dùng làm dữ liệu → hợp lệ, một bước hoàn tác mới
    antoan = _bam_sinh(T)
    check(T.gt() == J(DU_SAI, 2), "(trước khi dùng) dữ liệu vẫn là bản sai cũ", T.gt()[:60])
    n1 = _lan(p)
    p.click("#sc-sinh-dung")
    check(T.cho_gt(antoan), "“Dùng làm dữ liệu” → ô Soạn nhận đúng văn bản mẫu", T.gt()[:60])
    ok = _cho_kiem(T, n1)
    check(ok and _tt(p) == "ok" and p.inner_text("#sc-chan") == "Schema ✓" and p.evaluate("() => JE_APP.lichSu().nhanHoanTac") == "Sinh dữ liệu mẫu",
          "dùng làm dữ liệu → tự kiểm: “Schema ✓” (0 lỗi); lịch sử có MỘT bước mới “Sinh dữ liệu mẫu”", [_tt(p), p.evaluate("() => JE_APP.lichSu().nhanHoanTac")])
    p.locator("#sc-sinh-dung").focus()
    p.keyboard.press("Control+z")
    check(T.cho_gt(J(DU_SAI, 2)), "Ctrl+Z → về đúng dữ liệu cũ (hoàn tác = bước riêng)", T.gt()[:60])
    p.keyboard.press("Control+y")
    check(T.cho_gt(antoan), "Ctrl+Y → làm lại mẫu vừa dùng")

    # --- Sinh lại (seed+1), đổi seed ngẫu nhiên
    p.fill("#sc-sinh-seed", "mau-1")
    a = _bam_sinh(T)
    b = _bam_sinh(T, "#sc-sinh-lai")
    check(p.input_value("#sc-sinh-seed") == "mau-2" and a == mau1 and b != a, "“Sinh lại (seed+1)”: seed mau-1 → mau-2 và ra mẫu khác", [p.input_value("#sc-sinh-seed")])
    p.fill("#sc-sinh-seed", "abc")
    _bam_sinh(T, "#sc-sinh-lai")
    check(p.input_value("#sc-sinh-seed") == "abc1", "seed không kết thúc bằng số → thêm “1” (abc → abc1)", p.input_value("#sc-sinh-seed"))
    cu = p.input_value("#sc-sinh-seed")
    _bam_sinh(T, "#sc-sinh-doi")
    moi = p.input_value("#sc-sinh-seed")
    check(moi != cu and re.fullmatch(r"[a-z0-9]{1,6}", moi) and _sinh_tt(p) == "ok" and _hop_le_trong_trang(p), "🎲 đổi seed ngẫu nhiên rồi sinh: mẫu hợp lệ", [cu, moi])

    # --- Chép + Tải
    p.click("#sc-sinh-chep")
    p.wait_for_timeout(200)
    clip = p.evaluate("() => navigator.clipboard.readText()")
    mong = _van_ban_sinh(p)
    check(clip.replace("\r\n", "\n") == mong, "“Chép mẫu” → clipboard chứa đúng văn bản mẫu (Windows có thể đổi \\n thành \\r\\n khi đọc lại)", repr(clip[:50]) + " ≠ " + repr(mong[:50]))
    with p.expect_download() as dl:
        p.click("#sc-sinh-tai")
    tep = dl.value
    noi_dung = io.open(tep.path(), encoding="utf-8").read()
    check(tep.suggested_filename == "du-lieu-mau.json" and noi_dung == _van_ban_sinh(p), "“Tải mẫu về” → tệp du-lieu-mau.json đúng nội dung mẫu", tep.suggested_filename)

    # --- nhớ tuỳ chọn qua tải lại
    p.fill("#sc-sinh-seed", "luu-1")
    p.fill("#sc-sinh-so", "2")
    p.fill("#sc-sinh-tile", "30")
    p.fill("#sc-sinh-sau", "4")
    p.press("#sc-sinh-sau", "Enter")
    p.wait_for_timeout(600)
    p.select_option("#sc-format", "loi")
    p.wait_for_timeout(300)
    p.reload(wait_until="load")
    p.wait_for_function("() => !!window.JE_APP && !!window.JE.uiSchema", timeout=10000)
    p.click('.tab-n[data-o="schema"]')
    tc = p.evaluate("() => ({ seed: document.querySelector('#sc-sinh-seed').value, so: document.querySelector('#sc-sinh-so').value, tile: document.querySelector('#sc-sinh-tile').value, sau: document.querySelector('#sc-sinh-sau').value, mo: !document.querySelector('#sc-sinh').hidden, fmt: document.querySelector('#sc-format').value })")
    check(tc == {"seed": "luu-1", "so": "2", "tile": "30", "sau": "4", "mo": False, "fmt": "loi"}, "tải lại: tuỳ chọn sinh (seed, số mẫu, %, độ sâu) được nhớ, khung sinh đóng, Format “lỗi” vẫn còn (không ghi đè nhau)", tc)
    luu = json.loads(p.evaluate("() => localStorage.getItem('json-editor:schema-tuy-chon')"))
    check(luu.get("sinh", {}).get("seed") == "luu-1" and luu.get("format") == "loi", "khoá json-editor:schema-tuy-chon chứa cả draft/format/tuDong lẫn “sinh”", luu)
    # đóng/mở lại khung
    nut = p.get_by_role("button", name=re.compile("Sinh dữ liệu mẫu"))
    nut.click()
    p.wait_for_timeout(100)
    nut.click()
    check(p.is_hidden("#sc-sinh") and nut.get_attribute("aria-expanded") == "false", "bấm nút lần nữa → đóng khung")
    check(not T.loi, "không lỗi console / pageerror", T.loi[:2])
    T.dong()


def sinh_benh_ly(tb, url):
    section(" · tab Schema: sinh trong ca bệnh lý — mâu thuẫn, trống, JSON hỏng, ReDoS hết giờ, XSS, mẫu lớn bị cắt khi xem, huỷ chéo với việc nền khác")
    T = Trang(tb, url, "sinh-benh-ly")
    p = T.p
    T.dien(J(DU_SAI, 2))
    # --- chưa có schema
    T.tab("schema")
    p.click("#sc-sinh-mo")
    p.wait_for_timeout(150)
    check(p.is_visible("#sc-sinh") and _sinh_tt(p) == "loi" and "Chưa có schema" in p.inner_text("#sc-sinh-bao") and p.is_disabled("#sc-sinh-dung"), "chưa có schema → báo “Chưa có schema”, nút Dùng tắt", p.inner_text("#sc-sinh-bao"))
    # --- schema hỏng JSON
    _dat_schema(T, '{"type": "object",', cho=False)
    p.click("#sc-sinh-chay")
    p.wait_for_timeout(200)
    check(_sinh_tt(p) == "loi" and "không phải JSON hợp lệ" in p.inner_text("#sc-sinh-bao"), "schema hỏng JSON → báo rõ, không chạy Worker", p.inner_text("#sc-sinh-bao"))
    # --- mâu thuẫn
    _dat_schema(T, {"type": "integer", "minimum": 5, "maximum": 1})
    mau = _bam_sinh(T)
    bao = p.inner_text("#sc-sinh-bao")
    check(_sinh_tt(p) == "khong-dam-bao" and "Không đảm bảo" in bao and "Miền số rỗng" in bao and mau != "" and not p.is_disabled("#sc-sinh-dung"),
          "schema mâu thuẫn (minimum 5 > maximum 1): báo “Không đảm bảo” + lý do “Miền số rỗng”, vẫn cho xem mẫu gần đúng", bao[:140])
    check(p.locator("#sc-sinh-bao li").count() >= 1, "lý do liệt kê thành danh sách (li)")
    # --- XSS
    xss = "<img src=x onerror=window.__xss=1>"
    _dat_schema(T, {"enum": [xss]})
    mau = _bam_sinh(T)
    check(json.loads(mau) == xss and p.evaluate("() => window.__xss === undefined") and p.locator("#sc-sinh-xem img").count() == 0 and p.locator("img").count() == 0 and xss in _xem(p),
          "mẫu chứa <img onerror>: hiện thành CHỮ trong xem trước, không tạo phần tử, không chạy mã")
    # --- ReDoS: pattern có nhìn trước; sinh ra chuỗi a×40, RegExp thật kiểm → quay lui thảm hoạ → hết giờ
    p.evaluate("() => { JE_APP.hangSo.CHAY_NEN.han = 1500; }")
    _dat_schema(T, {"type": "string", "pattern": "^(?!(a+)+b)a{40,}$"})
    n0 = _sinh_lan(p)
    t0 = p.evaluate("() => performance.now()")
    p.click("#sc-sinh-chay")
    ok = _cho_sinh(T, n0, 9000)
    ms = p.evaluate("t0 => performance.now() - t0", t0)
    info("sinh với pattern ReDoS: báo hết giờ sau %.0f ms (hạn 1500)" % ms)
    check(ok and _sinh_tt(p) == "het-gio" and "Sinh quá lâu" in p.inner_text("#sc-sinh-bao") and p.evaluate("() => JE.chayNen.thongKe.soHetGio >= 1"), "pattern quay lui thảm hoạ: báo “Sinh quá lâu”, hết giờ có kiểm soát", [_sinh_tt(p), p.inner_text("#sc-sinh-bao")[:80]])
    r = p.evaluate("() => 21 * 2")
    check(r == 42 and p.evaluate("() => performance.now()") - t0 < 6000, "trang KHÔNG treo trong lúc Worker bị ReDoS")
    n_w = p.evaluate("() => JE.chayNen.thongKe.soWorker")
    _dat_schema(T, {"type": "string", "pattern": "^[a-z]{4}$"})
    _bam_sinh(T)
    check(_sinh_tt(p) == "ok" and p.evaluate("n => JE.chayNen.thongKe.soWorker > n && JE.chayNen.thongKe.soLuongChinh === 0", n_w), "sửa pattern lành → sinh lại bằng Worker MỚI, ra ok (phục hồi sau hết giờ)", _sinh_tt(p))
    p.evaluate("() => { JE_APP.hangSo.CHAY_NEN.han = 8000; }")
    # --- mẫu lớn: xem trước bị cắt, nhưng Dùng làm dữ liệu dùng ĐỦ
    _dat_schema(T, {"type": "array", "minItems": 30000, "maxItems": 30000, "items": {"type": "integer", "minimum": 100000, "maximum": 999999}})
    n0 = _sinh_lan(p)
    mau = _bam_sinh(T, timeout=20000)
    xem = _xem(p)
    check(len(mau) > 200000 and "đã cắt khi xem" in xem and len(xem) < len(mau) and _sinh_tt(p) == "ok",
          "mẫu 30 000 phần tử (%d KB): xem trước bị cắt ở 200 KB kèm ghi chú" % (len(mau) // 1024), [len(mau), len(xem)])
    p.click("#sc-sinh-dung")
    p.wait_for_timeout(500)
    check(p.evaluate("() => JE_APP.layVanBan().length") == len(mau), "“Dùng làm dữ liệu” dùng ĐỦ mẫu (không phải bản cắt)", p.evaluate("() => JE_APP.layVanBan().length"))
    T.dong()

    # --- huỷ chéo: sinh rồi suy ngay trong cùng một lượt → sinh báo “đã dừng”, suy chạy xong, không treo "đang"
    T = Trang(tb, url, "sinh-huy-cheo")
    p = T.p
    T.dien(J(DU_VD, 2))
    _dat_schema(T, SC_NGUOI)
    p.click("#sc-sinh-mo")
    _cho_sinh(T, -1)
    n0 = _sinh_lan(p)
    p.evaluate("() => { JE.uiSchema.sinh.chay(); JE.uiSchema.suy(); }")
    ok = T.cho("() => document.querySelector('#sc-sinh-bao').dataset.tt !== 'dang' && !document.querySelector('#sc-suy').disabled", None, 9000)
    check(ok and _sinh_tt(p) in ("chua", "ok"), "sinh + suy cùng lúc: bên bị thay không kẹt ở “Đang sinh…”, nút suy mở lại", [_sinh_tt(p), p.inner_text("#sc-sinh-bao")[:80]])
    T.cho("() => document.querySelector('#sc-tom').dataset.tt !== 'dang'", None, 9000)
    check(_tt(p) != "dang", "kiểm bị huỷ bởi việc nền được chạy lại (khung tóm tắt không kẹt “Đang kiểm…”)", _tt(p))
    check(not T.loi, "không lỗi console / pageerror", T.loi[:2])
    T.dong()


def suy_giao_dien(tb, url):
    section(" · tab Schema: Suy schema từ dữ liệu — ghi vào ô schema, hỏi trước khi ghi đè, hoàn tác trong ô, Chặt chẽ, draft 07, dữ liệu lỗi / lớn (việc 31)")
    T = Trang(tb, url, "suy-ui")
    p = T.p
    T.dien(J(DU_VD, 2))
    T.tab("schema")
    nut = p.get_by_role("button", name=re.compile("Suy schema từ dữ liệu"))
    check(nut.count() == 1 and p.input_value("#sc-nhap") == "", "nút “Suy schema từ dữ liệu” (đúng 1 nút); ô schema đang trống")
    n0 = _lan(p)
    nut.click()
    T.cho("() => document.querySelector('#sc-nhap').value.trim() !== ''", None, 6000)
    _cho_kiem(T, n0)
    sc = json.loads(p.input_value("#sc-nhap"))
    props = sc.get("properties", {})
    check(sc.get("$schema") == "https://json-schema.org/draft/2020-12/schema" and props.get("email", {}).get("format") == "email" and props.get("ngay", {}).get("format") == "date" and props.get("tags", {}).get("items") == {"type": "string"} and set(sc.get("required", [])) == set(DU_VD),
          "ô schema nhận schema suy ra: $schema 2020-12, email → format email, ngay → date, tags.items string, required đủ", list(props))
    check(p.is_hidden("#sc-suy-hoi") and _tt(p) == "ok" and "Hợp lệ theo schema" in p.inner_text("#sc-tom"), "ô schema trống thì ghi thẳng (không hỏi); tự kiểm: dữ liệu gốc hợp lệ với schema suy ra")
    check(p.evaluate("() => JE.chayNen.thongKe.soWorker >= 2 && JE.chayNen.thongKe.soLuongChinh === 0"), "suy chạy trong Worker")
    sc1 = p.input_value("#sc-nhap")

    # --- hỏi trước khi ghi đè
    du2 = dict(DU_VD, moi=5)
    _dat_du_lieu(T, J(du2, 2), cho_kiem=False)
    T.tab("schema")
    nut.click()
    ok = T.cho("() => !document.querySelector('#sc-suy-hoi').hidden", None, 6000)
    check(ok and "sẽ bị thay" in p.inner_text("#sc-suy-hoi-chu") and p.input_value("#sc-nhap") == sc1, "ô schema đã có nội dung: hiện băng “sẽ bị thay…”, schema CHƯA đổi", p.inner_text("#sc-suy-hoi-chu")[:80])
    p.click("#sc-suy-bo")
    check(p.is_hidden("#sc-suy-hoi") and p.input_value("#sc-nhap") == sc1, "“Huỷ” → ẩn băng, schema nguyên vẹn")
    nut.click()
    T.cho("() => !document.querySelector('#sc-suy-hoi').hidden", None, 6000)
    n0 = _lan(p)
    p.click("#sc-suy-dong-y")
    T.cho("() => JSON.parse(document.querySelector('#sc-nhap').value).properties.moi", None, 4000)
    sc2 = json.loads(p.input_value("#sc-nhap"))
    check(sc2["properties"]["moi"] == {"type": "integer"} and p.is_hidden("#sc-suy-hoi"), "“Ghi đè schema” → schema có thêm khoá “moi” (integer), băng ẩn", list(sc2.get("properties", {})))
    _cho_kiem(T, n0)
    check(_tt(p) == "ok", "sau khi ghi đè: tự kiểm lại → ok", _tt(p))
    p.locator("#sc-nhap").focus()
    p.keyboard.press("Control+z")
    p.wait_for_timeout(150)
    check(p.input_value("#sc-nhap") == sc1, "Ctrl+Z trong ô schema → về đúng schema trước khi ghi đè (execCommand insertText)", p.input_value("#sc-nhap")[:60])

    # --- Chặt chẽ + draft 07
    p.check("#sc-suy-chat")
    nut.click()
    T.cho("() => !document.querySelector('#sc-suy-hoi').hidden", None, 6000)
    p.click("#sc-suy-dong-y")
    T.cho("() => JSON.parse(document.querySelector('#sc-nhap').value).properties.id.minimum !== undefined", None, 4000)
    sc3 = json.loads(p.input_value("#sc-nhap"))
    check(sc3["properties"]["id"].get("minimum") == 1 and sc3["properties"]["ten"].get("minLength") == 2 and sc3["properties"]["tags"].get("minItems") == 2,
          "bật “Chặt chẽ” → có minimum / minLength / minItems theo dữ liệu", sc3["properties"]["id"])
    check(p.evaluate("() => JSON.parse(localStorage.getItem('json-editor:schema-tuy-chon')).suyChat") is True, "“Chặt chẽ” được nhớ trong tuỳ chọn lưu")
    p.uncheck("#sc-suy-chat")
    p.select_option("#sc-draft", "07")
    p.wait_for_timeout(300)
    nut.click()
    T.cho("() => !document.querySelector('#sc-suy-hoi').hidden", None, 6000)
    p.click("#sc-suy-dong-y")
    T.cho("() => JSON.parse(document.querySelector('#sc-nhap').value).$schema.indexOf('draft-07') >= 0", None, 4000)
    check(json.loads(p.input_value("#sc-nhap"))["$schema"] == "http://json-schema.org/draft-07/schema#", "Draft 07 ở thanh công cụ → schema suy ra có $schema draft-07")
    p.select_option("#sc-draft", "tu-dong")

    # --- dữ liệu hỏng / trống
    sc_truoc = p.input_value("#sc-nhap")
    _dat_du_lieu(T, '{"a": ', cho_kiem=False)
    T.tab("schema")
    nut.click()
    ok = T.cho("() => /chưa là JSON hợp lệ/.test(document.querySelector('#trang-thai').textContent)", None, 2500)
    check(ok and p.input_value("#sc-nhap") == sc_truoc and p.is_hidden("#sc-suy-hoi") and not p.is_disabled("#sc-suy"), "dữ liệu chưa là JSON hợp lệ: báo, schema giữ nguyên, nút không kẹt")
    _dat_du_lieu(T, "", cho_kiem=False)
    T.tab("schema")
    nut.click()
    ok = T.cho("() => /Chưa có dữ liệu/.test(document.querySelector('#trang-thai').textContent)", None, 2500)
    check(ok and p.input_value("#sc-nhap") == sc_truoc, "dữ liệu trống: báo “Chưa có dữ liệu”, schema giữ nguyên")

    # --- dữ liệu lớn > 1 MB: không tự kiểm nhưng suy vẫn chạy trong Worker
    p.evaluate("() => JE_APP.datVanBan(JSON.stringify(Array.from({ length: 190000 }, (_, i) => i)), { nhan: 'Mảng lớn' })")
    T.tab("schema")
    p.fill("#sc-nhap", "")
    p.wait_for_timeout(200)
    sl0 = p.evaluate("() => JE.chayNen.thongKe.soLuongChinh")
    t0 = p.evaluate("() => performance.now()")
    nut.click()
    T.cho("() => document.querySelector('#sc-nhap').value.trim() !== ''", None, 15000)
    ms = p.evaluate("t0 => performance.now() - t0", t0)
    info("suy từ 1,1 MB (190 000 số) trong Worker: %.0f ms" % ms)
    sc4 = json.loads(p.input_value("#sc-nhap"))
    check(sc4.get("type") == "array" and sc4.get("items") == {"type": "integer"} and p.evaluate("sl0 => JE.chayNen.thongKe.soLuongChinh === sl0", sl0), "dữ liệu 1,1 MB: suy ra {array, items integer} trong Worker (không rơi về luồng chính)", sc4)
    check(not T.loi, "không lỗi console / pageerror", T.loi[:2])
    T.dong()


def sinh_360(tb, url):
    section(" · tab Schema: Sinh / Suy ở 360 px — khung xếp dọc, không tràn ngang, nút trong màn hình")
    T = Trang(tb, url, "sinh-360", viewport={"width": 360, "height": 740}, color_scheme="dark")
    p = T.p
    T.dien(J(DU_SAI, 2))
    _dat_schema(T, SC_NGUOI)
    p.click("#sc-sinh-mo")
    _cho_sinh(T, -1)
    tran = p.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
    ngoai = p.evaluate("""() => Array.from(document.querySelectorAll('#sc-sinh button, #sc-sinh input, .sc-thanh button, .sc-thanh label')).filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > 361 || r.left < -1); }).map(e => e.id || e.textContent.trim().slice(0, 20))""")
    kt = p.evaluate("() => { const s = document.querySelector('#sc-sinh').getBoundingClientRect(), x = document.querySelector('#sc-sinh-xem').getBoundingClientRect(); return { rongKhung: s.width, rongXem: x.width }; }")
    check(tran <= 1 and not ngoai and kt["rongKhung"] <= 361 and kt["rongXem"] <= 361, "360 px: trang không tràn ngang, mọi nút / ô của khung sinh và thanh công cụ nằm trong màn hình (%dpx)" % tran, [ngoai, kt])
    p.locator("#sc-sinh-xem").scroll_into_view_if_needed()
    check(p.is_visible("#sc-sinh-xem") and p.is_visible("#sc-sinh-dung"), "xem trước + nút Dùng làm dữ liệu cuộn tới được")
    check(not T.loi, "không lỗi console / pageerror", T.loi[:2])
    T.dong()


def schema_file(tb, url=None):
    """--file: mở index.html bằng file:// — nạp sạch, Worker từ Blob chạy được, kiểm + hết giờ hoạt động."""
    section(" · mở bằng file:// (Worker từ Blob, kiểm schema, ReDoS hết giờ)")
    furl = "file:///" + os.path.join(HERE, "index.html").replace("\\", "/")
    T = Trang(tb, furl, "file")
    p = T.p
    p.wait_for_timeout(200)
    check(not T.loi, "nạp bằng file:// không lỗi console / pageerror", T.loi[:2])
    T.dien(J(DU_SAI, 2))
    ok = _dat_schema(T, SC_NGUOI)
    st = p.evaluate("() => JE.chayNen.thongKe")
    check(ok and _tt(p) == "loi" and len(_hang_du_lieu(p)) == 3 and p.evaluate("() => JE.chayNen.coWorker()") and st["soWorker"] >= 1 and st["soLuongChinh"] == 0,
          "file://: kiểm schema chạy trong Worker (Blob), ra 3 lỗi đúng", [_tt(p), st])
    p.evaluate("() => { JE_APP.hangSo.CHAY_NEN.han = 1500; }")
    _dat_du_lieu(T, J({"s": "a" * 42 + "b"}), cho_kiem=False)
    n0 = _lan(p)
    p.fill("#sc-nhap", J({"type": "object", "properties": {"s": {"pattern": "(a+)+$"}}}))
    ok = _cho_kiem(T, n0, 9000)
    check(ok and _tt(p) == "het-gio", "file://: ReDoS (a+)+$ báo hết giờ, trang không treo", _tt(p))
    # J4: sinh + suy trên file:// (Worker từ Blob đã ghép cả regex-sinh, schema-sinh, schema-suy)
    p.evaluate("() => { JE_APP.hangSo.CHAY_NEN.han = 8000; }")
    _dat_schema(T, SC_NGUOI)
    p.click("#sc-sinh-mo")
    ok = _cho_sinh(T, -1)
    check(ok and _sinh_tt(p) == "ok" and _hop_le_trong_trang(p) and p.evaluate("() => JE.chayNen.thongKe.soLuongChinh === 0"),
          "file://: “Sinh dữ liệu mẫu” chạy trong Worker (Blob), mẫu hợp lệ theo schema", _sinh_tt(p))
    _dat_du_lieu(T, J(DU_VD, 2), cho_kiem=False)
    p.fill("#sc-nhap", "")
    p.click("#sc-suy")
    T.cho("() => document.querySelector('#sc-nhap').value.trim() !== ''", None, 8000)
    sc = json.loads(p.input_value("#sc-nhap") or "{}")
    check(sc.get("type") == "object" and sc.get("properties", {}).get("email", {}).get("format") == "email" and p.evaluate("() => JE.chayNen.thongKe.soLuongChinh === 0"),
          "file://: “Suy schema từ dữ liệu” chạy trong Worker, ra schema đúng (email → format email)", list(sc.get("properties", {})))
    T.dong()


def cong_schema(tb, url):
    section(" · cổng JE_APP cho Schema: denDuong tab Soạn, huy hiệu cây, hằng số")
    T = Trang(tb, url, "cong-schema")
    p = T.p
    can = ["datHuyHieuCay", "tabDuLieuGan", "denDuong"]
    thieu = p.evaluate("can => can.filter(k => typeof JE_APP[k] !== 'function')", can)
    check(not thieu and p.evaluate("() => JE_APP.hangSo.NGUONG_KIEM_TU_DONG === 1048576 && JE_APP.hangSo.CHAY_NEN.han === 8000 && typeof JE.viTri.timViTri === 'function' && typeof JE.schema.kiem === 'function'"),
          "JE_APP có datHuyHieuCay / tabDuLieuGan; hangSo.NGUONG_KIEM_TU_DONG = 1 MB, CHAY_NEN.han = 8000; JE.viTri + JE.schema có trong trang", thieu)
    # Trang mới mở ở Soạn: rời Soạn sang tab khác (vd Schema) thì tab dữ liệu "dùng gần nhất" là Soạn, KHÔNG phải Cây mặc định
    # (trước: chỉ ghi nhận tab VÀO → Soạn → Schema → bấm hàng lỗi nhảy sang Cây dù người dùng chỉ dùng Soạn).
    p.evaluate("() => JE_APP.chuyenTab('loc')")
    check(p.evaluate("() => JE_APP.tabDuLieuGan()") == "soan", "rời Soạn (tab mở sẵn) sang tab khác → tabDuLieuGan = Soạn, không phải Cây", p.evaluate("() => JE_APP.tabDuLieuGan()"))
    p.evaluate("() => JE_APP.chuyenTab('soan')")
    T.dien('{\n  "x": [1, 2],\n  "ten": "Phúc"\n}')
    ok = p.evaluate("() => JE_APP.denDuong([\"x\", 1], { tab: \"soan\" })")
    check(ok and _chon(p) == "2" and p.evaluate("() => JE_APP.tabHien()") == "soan", "denDuong([x, 1], {tab:'soan'}) → chọn đúng đoạn giá trị \"2\" trong ô Soạn", _chon(p))
    ok = p.evaluate("() => JE_APP.denDuong([\"ten\"], { tab: \"soan\", chon: \"khoa\" })")
    check(ok and _chon(p) == '"ten"', "denDuong(…, {chon:'khoa'}) → chọn token khoá kèm dấu nháy", _chon(p))
    check(p.evaluate("() => JE_APP.denDuong([\"khong\"], { tab: \"soan\" })") is False, "denDuong tới đường dẫn không có → false")
    p.evaluate("() => JE_APP.chuyenTab('cay')")
    p.evaluate("() => JE_APP.chuyenTab('loc')")
    ok = p.evaluate("() => JE_APP.denDuong([\"ten\"], { tab: \"tu-dong\" })")
    check(ok and p.evaluate("() => JE_APP.tabHien()") == "cay" and p.evaluate("() => JE_APP.tabDuLieuGan()") == "cay", "tab 'tu-dong' đi tới tab dữ liệu dùng gần nhất (Cây)")
    p.evaluate("() => JE_APP.chuyenTab('soan')")
    p.evaluate("() => JE_APP.chuyenTab('loc')")
    ok = p.evaluate("() => JE_APP.denDuong([\"ten\"], { tab: \"tu-dong\" })")
    check(ok and p.evaluate("() => JE_APP.tabHien()") == "soan" and _chon(p) == '"Phúc"', "…và Soạn khi vừa dùng Soạn", _chon(p))
    # JSON đang lỗi: Soạn vẫn tìm được vị trí
    T.dien('{"a": [1, 2')
    ok = p.evaluate("() => JE_APP.denDuong([\"a\", 1], { tab: \"soan\" })")
    check(ok and _chon(p) == "2", "denDuong tab Soạn dùng được cả khi JSON đang lỗi (thiếu ngoặc đóng)", _chon(p))
    # huy hiệu qua cổng
    T.dien('{"u": {"v": 1}}')
    T.tab("cay")
    p.evaluate("() => JE_APP.datHuyHieuCay(new Map([[JSON.stringify(['u', 'v']), { a: ['thử'], b: 0 }], [JSON.stringify(['u']), { a: [], b: 1 }]]))")
    check(_huy_hieu(p, '["u","v"]') and p.locator(".huy-hieu-loi").count() >= 1, "datHuyHieuCay(Map) → hàng $.u.v có huy hiệu, cập nhật tại chỗ không vẽ lại cây")
    p.evaluate("() => JE_APP.datHuyHieuCay(null)")
    check(p.locator(".huy-hieu-loi").count() == 0, "datHuyHieuCay(null) → xoá hết huy hiệu")
    T.dong()


# ============================================================================================ main
def main(argv):
    chi = None
    for a in argv:
        if a.startswith("--chi="):                      # chạy riêng vài nhóm phép Edge: --chi=meta_nhanh_gap,xss
            chi = set(a[6:].split(","))
    co = set(a for a in argv if a.startswith("--") and not a.startswith("--chi="))
    if not co or "--tat-ca" in co:
        co |= {"--tinh", "--chuc-nang"}
        if "--tat-ca" in co:
            co.add("--file")
    print("Kiểm JSON Editor — " + " ".join(sorted(co)))
    if "--tinh" in co:
        tang_tinh()
    if "--chuc-nang" in co:
        tang_chuc_nang(chi)
    if "--file" in co:
        tang_file()
    print("\n%d đạt, %d sai" % (OK, FAIL))
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
