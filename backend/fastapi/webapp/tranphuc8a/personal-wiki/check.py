#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kiểm Personal Wiki (webapp/tranphuc8a/personal-wiki) bằng trình duyệt thật.

    backend\\fastapi\\.venv\\Scripts\\python.exe backend\\fastapi\\webapp\\tranphuc8a\\personal-wiki\\check.py              # tầng 1 + 2
    ... check.py --tinh          # tầng 1: tĩnh (không cần trình duyệt)
    ... check.py --chuc-nang     # tầng 2: chức năng (Chromium máy tính + điện thoại + WebKit iPhone)
    ... check.py --song-sot      # tầng 3: sập giữa chừng không mất chữ; offline qua service worker; PWA
    ... check.py --co-gian       # tầng 4: dữ liệu xấu nhất × nhiều bề rộng (không tràn ngang)
    ... check.py --hieu-nang [N] # tầng 5: N note (mặc định 100000) trong IndexedDB thật: tìm kiếm < 1 s? — IN SỐ ĐO THẬT
    ... check.py --dong-bo       # tầng 6: đồng bộ qua /wiki (cần máy chủ + SQLite tạm) — 3 biến thể: API_PREFIX=/api/v1; API_PREFIX trống
                                 #         + A mở start_url PWA index.html?source=pwa (Chromium); biến thể đó trên Edge thật (msedge)
    ... check.py --tat-ca

Máy chủ: FastAPI thật trên SQLite tạm (K.MayChuThu), nên đường dẫn /webapp/tranphuc8a/personal-wiki/, kiểu MIME và phạm vi service worker
đúng như khi triển khai; MONGO_URI="" để không ping MongoDB thật trong .env. Trả exit code ≠ 0 khi có phép sai.

Kiểm đột biến (chứng minh bộ kiểm bắt được lỗi cũ — phải ĐỎ):
    PW_HOAN_NGUYEN=may-chu   ... check.py --dong-bo --song-sot   # máy chủ không chèn cấu hình cho …/index.html gọi đích danh (22/10)
    PW_HOAN_NGUYEN=may-khach ... check.py --dong-bo              # sync.js coi apiBase "" là "không có máy chủ" (22/10)
    PW_HOAN_NGUYEN=tieu-de   ... check.py --chuc-nang --dong-bo  # ô tiêu đề note mới điền sẵn "Chưa đặt tên" (gốc chỗ tầng 6 chập chờn, 23/10)
    PW_HOAN_NGUYEN=dem-moi-phim  ... check.py --chuc-nang        # mỗi phím lại đếm từ + thẻ ôn trên cả note (perf-md W1, W2 23/10)
    PW_HOAN_NGUYEN=bieu-ngu-chet ... check.py --chuc-nang --dong-bo  # lỗi đồng bộ dừng hẳn không lên biểu ngữ (mã chết cũ, W2 23/10)
    PW_HOAN_NGUYEN=noi-cung-the  ... check.py --chuc-nang        # liên kết nối mở trong thẻ đang ở #/settings/sync bị bỏ qua, mã treo lại (sửa sau kiểm W2)
"""

from __future__ import annotations

import io
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
WEBAPP = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(WEBAPP, "courses", "engine"))
import kiem_khoa_hoc as K  # noqa: E402

PATH = "/webapp/tranphuc8a/personal-wiki/"
START_URL = "index.html?source=pwa"                         # start_url của manifest: PWA đã cài mở đúng địa chỉ này
SYNC_SECTION = ".settings section.set:has(h2:text-is('Đồng bộ giữa các thiết bị'))"
OK = FAIL = 0
ERRORS: list = []

# Máy chủ thử không chạm dịch vụ thật: .env có thể đặt MONGO_URI thật, và /wiki/backends (Cài đặt → Đồng bộ) sẽ PING nó.
ENV_AN_TOAN = {"MONGO_URI": ""}

# ---------------------------------------------------------------- kiểm đột biến: tạm gỡ một bản sửa để chứng minh bộ kiểm bắt được lỗi cũ
# PW_HOAN_NGUYEN=may-chu   máy chủ thử chạy với việc 1 bị gỡ: …/index.html gọi đích danh KHÔNG được chèn __WEBAPP_CONFIG__ (vá lúc nạp bằng
#                          sitecustomize.py trong thư mục tạm qua PYTHONPATH — không sửa tệp nào của repo).
# PW_HOAN_NGUYEN=may-khach trang nhận BẢN SAO sync.js với việc 2 bị gỡ: apiBase "" lại bị coi là "không có máy chủ" (thay bằng route).
# PW_HOAN_NGUYEN=tieu-de   trang nhận BẢN SAO editor.js với bản sửa 23/10 bị gỡ: ô tiêu đề note mới lại điền sẵn "Chưa đặt tên" (route) —
#                          --chuc-nang đỏ CHẮC CHẮN (không còn phụ thuộc may rủi về nhịp), --dong-bo dừng ở "A: tạo ghi chú 1".
# Khi đặt biến này, các tầng nói trên PHẢI đỏ. Bình thường không đặt.
HOAN_NGUYEN = os.environ.get("PW_HOAN_NGUYEN", "").strip()

SITECUSTOMIZE_HOAN_NGUYEN = r'''
import importlib.abc, importlib.util, sys
_TEN = "src.adapter.input.controllers.webapp_controller"
class _GoBanSua(importlib.abc.MetaPathFinder):
    def find_spec(self, name, path=None, target=None):
        if name != _TEN:
            return None
        sys.meta_path.remove(self)
        spec = importlib.util.find_spec(name)
        goc = spec.loader.exec_module
        def exec_module(module):
            goc(module)
            module._is_entry_document = lambda target: False
            sys.stderr.write("[PW_HOAN_NGUYEN=may-chu] index.html goi dich danh KHONG duoc chen cau hinh\n")
        spec.loader.exec_module = exec_module
        return spec
sys.meta_path.insert(0, _GoBanSua())
'''


def env_may_chu(extra=None):
    """Biến môi trường cho K.MayChuThu: luôn chặn MongoDB thật; thêm bản vá hoàn nguyên nếu PW_HOAN_NGUYEN=may-chu."""
    env = dict(ENV_AN_TOAN)
    env.update(extra or {})
    if HOAN_NGUYEN == "may-chu":
        d = tempfile.mkdtemp(prefix="wiki-hoan-nguyen-")
        with io.open(os.path.join(d, "sitecustomize.py"), "w", encoding="utf-8") as f:
            f.write(SITECUSTOMIZE_HOAN_NGUYEN)
        env["PYTHONPATH"] = d + (os.pathsep + os.environ["PYTHONPATH"] if os.environ.get("PYTHONPATH") else "")
    return env


def sync_js_hoan_nguyen():
    """Bản sao sync.js với việc 2 bị gỡ (biểu thức cũ `available: !!apiBase`)."""
    s = io.open(os.path.join(HERE, "assets", "js", "data", "sync.js"), encoding="utf-8").read()
    for a, b in (("available: hasApi,", "available: !!apiBase,"), ("var hasApi = opt.apiBase != null;", "var hasApi = !!opt.apiBase;")):
        if s.count(a) != 1:
            raise SystemExit("PW_HOAN_NGUYEN=may-khach: không tìm thấy đúng một chỗ " + a)
        s = s.replace(a, b)
    return s


def editor_js_hoan_nguyen():
    """Bản sao editor.js với bản sửa 23/10 bị gỡ (ô tiêu đề note mới / nháp tiêu đề trống lại thành "Chưa đặt tên")."""
    s = io.open(os.path.join(HERE, "assets", "js", "ui", "editor.js"), encoding="utf-8").read()
    for pat in (r'\n[ \t]*if \(!String\(query\.title \|\| ""\)\.trim\(\)\) note\.title = "";[^\n]*', r'\n[ \t]*if \(!String\(d\.note\.title \|\| ""\)\.trim\(\)\) dn\.title = "";[^\n]*'):
        s, n = re.subn(pat, "", s)
        if n != 1:
            raise SystemExit("PW_HOAN_NGUYEN=tieu-de: không tìm thấy đúng một chỗ " + pat)
    return s


def _ban_sao(rel, cu, moi, ten):
    """Bản sao một tệp của app với đúng MỘT chỗ `cu` thay bằng `moi` (kiểm đột biến)."""
    s = io.open(os.path.join(HERE, *rel.split("/")), encoding="utf-8").read()
    if s.count(cu) != 1:
        raise SystemExit("PW_HOAN_NGUYEN=%s: không tìm thấy đúng một chỗ %s" % (ten, cu))
    return s.replace(cu, moi)


def app_js_noi_cung_the():
    """Bản sao app.js với bản sửa sau kiểm W2 bị gỡ (nhánh #/join không buộc dựng lại màn; mã từ liên kết không bị bỏ khi rời / sau khi dựng)."""
    s = io.open(os.path.join(HERE, "assets", "js", "ui", "app.js"), encoding="utf-8").read()
    for pat in (r'\n[ \t]*if \(current && current\.key === "settings/sync"\) current\.key = "";[^\n]*',
                r'\n[ \t]*if \(key !== "settings/sync"\) pendingJoin = "";[^\n]*',
                r'\n[ \t]*if \(key === "settings/sync"\) pendingJoin = "";[^\n]*'):
        s, n = re.subn(pat, "", s)
        if n != 1:
            raise SystemExit("PW_HOAN_NGUYEN=noi-cung-the: không tìm thấy đúng một chỗ " + pat)
    return s


def setup_hoan_nguyen(ctx):
    """Gắn route thay tệp của chế độ đột biến (gọi cho MỌI trang do lớp Page mở, trước lần tải đầu tiên)."""
    def thay(pat, body):
        ctx.route(pat, lambda route: route.fulfill(status=200, content_type="text/javascript; charset=utf-8", body=body))
    if HOAN_NGUYEN == "dem-moi-phim":                        # W2/perf W1 bị gỡ: mỗi phím lại đếm từ + thẻ ôn (quét cả note)
        thay("**/personal-wiki/assets/js/ui/editor.js*", _ban_sao("assets/js/ui/editor.js", "function changed() { queueDraft(); setDirtyState(); countsSoon(); schedulePreview(); }",
                                                                  "function changed() { queueDraft(); setStatus(); schedulePreview(); }", HOAN_NGUYEN))
    elif HOAN_NGUYEN == "bieu-ngu-chet":                     # W2 bị gỡ: biểu ngữ "sync" lại là mã chết (lỗi đồng bộ chỉ thấy trong Cài đặt)
        thay("**/personal-wiki/assets/js/ui/app.js*", _ban_sao("assets/js/ui/app.js", 'else if (syncStop) showBanner("sync", syncStop);', "", HOAN_NGUYEN))
    elif HOAN_NGUYEN == "noi-cung-the":                      # sửa sau kiểm W2 bị gỡ: liên kết nối trong thẻ đang ở #/settings/sync bị bỏ qua, mã treo lại
        thay("**/personal-wiki/assets/js/ui/app.js*", app_js_noi_cung_the())
    if HOAN_NGUYEN == "may-khach":
        src = sync_js_hoan_nguyen()
        ctx.route("**/personal-wiki/assets/js/data/sync.js*", lambda route: route.fulfill(status=200, content_type="text/javascript; charset=utf-8", body=src))
    elif HOAN_NGUYEN == "tieu-de":
        src_ed = editor_js_hoan_nguyen()
        ctx.route("**/personal-wiki/assets/js/ui/editor.js*", lambda route: route.fulfill(status=200, content_type="text/javascript; charset=utf-8", body=src_ed))


def check(cond, msg, detail=""):
    global OK, FAIL
    if cond:
        OK += 1
        print("  ✓ " + msg)
    else:
        FAIL += 1
        print("  ✗ " + msg + ((" — " + str(detail)) if detail != "" else ""))
    return bool(cond)


def section(t):
    print("\n" + t)


# ============================================================================================ tầng 1 — tĩnh
def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def lum(c):
    def f(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (f(x) for x in c)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def blend(fg_rgba, bg):
    r, g, b, a = fg_rgba
    return tuple(round(fg_rgba[i] * a + bg[i] * (1 - a)) for i in range(3))


def parse_tokens(css):
    """→ {"light": {...}, "dark": {...}} từ khối :root và :root[data-theme="dark"]."""
    def block(sel_re):
        m = re.search(sel_re + r"\s*\{(.*?)\n\}", css, re.S | re.M)
        return dict(re.findall(r"--([a-z0-9-]+):\s*([^;]+);", m.group(1))) if m else {}
    return {"light": block(r"^:root"), "dark": block(r':root\[data-theme="dark"\]')}


def val(tok, name):
    v = tok[name].strip()
    if v.startswith("#"):
        return hex_rgb(v)
    m = re.match(r"rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)", v)
    return (int(m.group(1)), int(m.group(2)), int(m.group(3)), float(m.group(4)))


def tang_1():
    section("TẦNG 1 — tĩnh")
    files = []
    for dp, _, names in os.walk(os.path.join(HERE, "assets")):
        for n in names:
            files.append(os.path.join(dp, n))
    js = [f for f in files if f.endswith(".js")]
    bad = []
    for f in js + [os.path.join(HERE, "sw.js"), os.path.join(HERE, "kiem.js")]:
        r = subprocess.run(["node", "--check", f], capture_output=True, text=True)
        if r.returncode:
            bad.append(os.path.relpath(f, HERE) + ": " + r.stderr.strip().splitlines()[0])
    check(not bad, "cú pháp JS (%d tệp)" % (len(js) + 2), bad)

    r = subprocess.run(["node", os.path.join(HERE, "kiem.js")], capture_output=True, text=True, encoding="utf-8")
    tail = (r.stdout.strip().splitlines() or [""])[-1]
    check(r.returncode == 0, "kiem.js (logic thuần: văn bản, markdown+XSS, tìm kiếm, thẻ, đồ thị, zip, kho, sao lưu): " + tail, (r.stdout + r.stderr)[-600:])

    html = io.open(os.path.join(HERE, "index.html"), encoding="utf-8").read()
    refs = re.findall(r'(?:src|href)="(\./[^"#?]+)"', html)
    missing = [p for p in refs if not os.path.exists(os.path.join(HERE, p[2:]))]
    check(refs and not missing, "mọi tham chiếu trong index.html có thật (%d)" % len(refs), missing)
    ext = re.findall(r'(?:src|href)="(https?://[^"]+)"', html) + re.findall(r"@import|url\(\s*['\"]?https?:", "".join(io.open(f, encoding="utf-8").read() for f in files if f.endswith(".css")))
    check(not ext, "không nạp tài nguyên ngoài (CDN, font ngoài)", ext)
    used_js = re.findall(r"https?://(?!www\.w3\.org)[a-z0-9.-]+\.[a-z]{2,}", "".join(io.open(f, encoding="utf-8").read() for f in js if "graph-worker" not in f))
    check(not [u for u in used_js if "localhost" not in u], "mã JS không gọi địa chỉ ngoài cứng", sorted(set(used_js))[:5])

    sprites = set(re.findall(r'<symbol id="i-([a-z0-9-]+)"', html))
    used = set()
    for f in js:
        src = io.open(f, encoding="utf-8").read()
        used |= set(re.findall(r'icon\(\s*"([a-z0-9-]+)"', src))
        used |= set(re.findall(r'\bicon:\s*"([a-z0-9-]+)"', src))
        used |= set(re.findall(r'\["[a-z0-9]+",\s*"[^"]*",\s*"([a-z0-9-]+)"\]', src if f.endswith("editor.js") else ""))
    miss = sorted(used - sprites)
    check(not miss, "mọi biểu tượng dùng trong mã có trong bộ symbol (%d dùng / %d có)" % (len(used), len(sprites)), miss)

    man = json.load(io.open(os.path.join(HERE, "manifest.webmanifest"), encoding="utf-8"))
    from PIL import Image
    probs = []
    for ic in man["icons"]:
        p = os.path.join(HERE, ic["src"])
        if not os.path.exists(p):
            probs.append(ic["src"] + " thiếu")
            continue
        w, h = Image.open(p).size
        if "%dx%d" % (w, h) != ic["sizes"]:
            probs.append("%s là %dx%d, khai %s" % (ic["src"], w, h, ic["sizes"]))
    check(not probs and man["scope"] == "./" and man["display"] == "standalone" and any(i["purpose"] == "maskable" for i in man["icons"]), "manifest: biểu tượng đúng kích thước, có maskable, scope ./, standalone", probs)
    sc = [s["url"] for s in man.get("shortcuts", [])]
    check(len(sc) >= 3 and all(u.startswith("./index.html#/") for u in sc), "manifest: shortcuts trỏ vào trang có hash", sc)

    r = subprocess.run([sys.executable, os.path.join(HERE, "tao-pwa.py"), "--kiem"], capture_output=True, text=True, encoding="utf-8")
    check(r.returncode == 0, "dấu phiên bản sw.js khớp nội dung vỏ (sửa tệp nào cũng phải chạy tao-pwa.py)", r.stdout.strip())

    tokens = parse_tokens(io.open(os.path.join(HERE, "assets", "css", "tokens.css"), encoding="utf-8").read())
    low = []
    for theme, tk in tokens.items():
        bg, elev, sunk = val(tk, "bg"), val(tk, "elev"), val(tk, "sunk")
        soft = blend(val(tk, "accent-soft"), elev)
        pairs = [("text/bg", val(tk, "text"), bg), ("text/elev", val(tk, "text"), elev), ("text-2/elev", val(tk, "text-2"), elev), ("text-2/bg", val(tk, "text-2"), bg),
                 ("text-2/sunk", val(tk, "text-2"), sunk), ("text-3/elev", val(tk, "text-3"), elev), ("text-3/bg", val(tk, "text-3"), bg), ("text-3/sunk", val(tk, "text-3"), sunk),
                 ("accent-text/elev", val(tk, "accent-text"), elev), ("accent-text/bg", val(tk, "accent-text"), bg), ("accent-text/soft", val(tk, "accent-text"), soft),
                 ("accent-fg/accent", val(tk, "accent-fg"), val(tk, "accent")), ("danger/elev", val(tk, "danger"), elev), ("danger/bg", val(tk, "danger"), bg),
                 ("accent-fg/danger (nút xoá, huy hiệu)", val(tk, "accent-fg"), val(tk, "danger")), ("ok/elev", val(tk, "ok"), elev), ("star/elev", val(tk, "star"), elev), ("mark/elev", val(tk, "mark"), elev),
                 ("text/soft", val(tk, "text"), soft)]
        for name, a, b in pairs:
            c = contrast(a[:3], b[:3])
            if c < 4.5:
                low.append("%s %s = %.2f" % (theme, name, c))
        # tô màu mã (app.css) trên nền --sunk
        css = io.open(os.path.join(HERE, "assets", "css", "app.css"), encoding="utf-8").read()
        m = re.search((r"\.md pre\.code \{ (--tk-c[^}]*)\}" if theme == "light" else r':root\[data-theme="dark"\] \.md pre\.code \{ (--tk-c[^}]*)\}'), css)
        for name, hexv in re.findall(r"--(tk-[a-z]):\s*(#[0-9a-fA-F]{6})", m.group(1)):
            c = contrast(hex_rgb(hexv), sunk)
            if c < 4.5:
                low.append("%s mã %s %s trên sunk = %.2f" % (theme, name, hexv, c))
    toast_bg = hex_rgb("#16202e")
    for name, hx in (("toast chữ", "#f2f6fc"), ("toast nút", "#9dbfff")):
        c = contrast(hex_rgb(hx), toast_bg)
        if c < 4.5:
            low.append("%s = %.2f" % (name, c))
    check(not low, "độ tương phản mọi cặp màu ≥ 4,5:1 (sáng + tối, mã tô màu, toast)", low)

    total = sum(os.path.getsize(f) for f in files) + os.path.getsize(os.path.join(HERE, "index.html"))
    check(total < 900 * 1024, "dung lượng vỏ ứng dụng %d KB (< 900 KB)" % (total // 1024))


# ============================================================================================ tiện ích trình duyệt
class Page:
    """Một trang Playwright + gom lỗi console/pageerror."""

    def __init__(self, pw_browser, url, name, setup=None, **ctx_kw):
        ctx_kw.setdefault("service_workers", "block")
        ctx_kw.setdefault("accept_downloads", True)
        self.ctx = pw_browser.new_context(**ctx_kw)
        setup_hoan_nguyen(self.ctx)                          # kiểm đột biến (PW_HOAN_NGUYEN); bình thường không làm gì
        if setup:
            setup(self.ctx)                                  # vd chặn/thay tệp bằng route — phải có trước lần mở trang đầu tiên
        self.pg = self.ctx.new_page()
        self.name = name
        self.errors = []
        self.pg.on("console", lambda m: self.errors.append("console: " + m.text) if m.type == "error" else None)
        self.pg.on("pageerror", lambda e: self.errors.append("pageerror: " + str(e)))
        self.url = url
        self.pg.goto(url, wait_until="load")
        self.pg.wait_for_function("document.body.classList.contains('ready')", timeout=15000)

    def hash(self):
        return self.pg.evaluate("location.hash")

    def go(self, h):
        self.pg.evaluate("h => { location.hash = h }", h)
        self.pg.wait_for_timeout(250)

    def count_text(self):
        return self.pg.locator(".lp-count").inner_text()

    def toast(self, text, timeout=4000):
        try:
            self.pg.wait_for_selector(".toast:has-text('%s')" % text, timeout=timeout)
            return True
        except Exception:
            return False

    def close(self):
        ERRORS.extend(["[%s] %s" % (self.name, e) for e in self.errors])
        self.ctx.close()


# ---------------------------------------------------------------- tạo ghi chú mới (dùng ở mọi tầng)
# Kẽ hở cũ (tầng 6 đỏ/xanh chập chờn, 23/10 — đã bắt tận tay bằng log sự kiện trang khi chạy song song có tải):
#  · GỐC: editor.js tự focus sau 30 ms vào (ô tiêu đề nếu trống, không thì ô nội dung); ô tiêu đề note mới lại bị điền sẵn "Chưa đặt tên"
#    (đã sửa ở editor.js) nên nhịp đó focus Ô NỘI DUNG. fill của Playwright = focus+select rồi MỘT lượt CDP insertText: nhịp 30 ms rơi vào
#    giữa là "Đồng bộ hai" vào ô nội dung, fill nội dung ghi đè, tiêu đề còn "Chưa đặt tên" → B thiếu "Đồng bộ hai", liên kết mờ.
#  · Báo "thành công" bằng toast "Đã lưu" — toast của ghi chú TRƯỚC sống 4,5 s (dom.js), nên ghi chú sau "đạt" mà chưa hề lưu/lưu sai.
#  · fill('.ed-title') / fill('.ed-ta') theo selector toàn trang, chỉ đòi có một .ed-title mới — không ràng buộc vào CHÍNH trình soạn mới.
# Cách làm bây giờ: đánh dấu mọi .ed-title/.toast đang có → bấm "Ghi chú mới" → chờ trang chỉ còn ĐÚNG MỘT .ed-title và nó mới, hash là
# #/n/<id>?new=1, ô đó đã nhận focus (nhịp 30 ms đã chạy) → điền qua handle của CHÍNH trình soạn đó → đọc lại giá trị → Ctrl+S → chờ
# trạng thái ĐÃ LƯU của chính ghi chú đó: hash thành #/n/<id> (save() gọi replaceState), .ed-status "✓ Đã lưu", tiêu đề trong ô = tiêu đề
# đã lưu (save() ghi lại từ bản đã lưu), và một toast "Đã lưu" MỚI.
MARK_OLD_JS = "() => { document.querySelectorAll('.ed-title, .toast').forEach(e => { e.__cu = true; }); return location.hash; }"
NEW_EDITOR_JS = """prev => {
  const ts = [...document.querySelectorAll('.ed-title')], m = location.hash.match(/^#\\/n\\/([^?]+)\\?(?:.*&)?new=1(?:&|$)/);
  if (location.hash === prev || !m || ts.length !== 1 || ts[0].__cu) return false;
  const ed = ts[0].closest('.ed');
  return ed && document.activeElement === ts[0] ? { ed: ed, id: decodeURIComponent(m[1]) } : false;
}"""
NEW_EDITOR_STATE_JS = """() => { const ts = [...document.querySelectorAll('.ed-title')];
  return { hash: location.hash, titles: ts.length, moi: ts.filter(e => !e.__cu).length, focus: document.activeElement ? (document.activeElement.className || document.activeElement.tagName) : null }; }"""
READ_EDITOR_JS = """ed => ({ connected: ed.isConnected, title: ed.querySelector('.ed-title').value, body: ed.querySelector('.ed-ta').value,
  tags: [...ed.querySelectorAll('.tagchip .tagname')].map(b => b.textContent.replace(/^#/, '')),
  status: (ed.querySelector('.ed-status .st') || {}).textContent || '' })"""
SAVED_JS = """([ed, id, title]) => {
  const st = ed.querySelector('.ed-status .st.ok');
  return ed.isConnected && location.hash === '#/n/' + id && !!st && st.textContent.includes('Đã lưu')
    && ed.querySelector('.ed-title').value === title
    && [...document.querySelectorAll('.toast')].some(t => !t.__cu && t.textContent.includes('Đã lưu'));
}"""


BLANK_NOTE_JS = """() => { const t = document.querySelector('.ed-title'), a = document.activeElement;
  return { title: t.value, ph: t.placeholder, focus: a ? (a.className || a.tagName) : null, save: document.querySelector('.ed .save').disabled,
           status: (document.querySelector('.ed-status .st') || {}).textContent || '' }; }"""


def _note_fail(P, what, detail):
    print("    (new_note ở %s: %s — %s)" % (getattr(P, "name", "trang"), what, json.dumps(detail, ensure_ascii=False)[:400]))
    return False


def new_note(P, title, body, tags=(), timeout=10000):
    """Tạo + lưu một ghi chú qua giao diện. True chỉ khi CHÍNH ghi chú vừa tạo đã lưu với đúng tiêu đề/nội dung/tag (xem ghi chú ở trên)."""
    pg = P.pg
    prev = pg.evaluate(MARK_OLD_JS)
    pg.click("#newBtn" if pg.is_visible("#newBtn") else "#topNew")
    try:
        h = pg.wait_for_function(NEW_EDITOR_JS, arg=prev, timeout=timeout)
    except Exception:
        return _note_fail(P, "không thấy đúng một trình soạn MỚI đã nhận focus", pg.evaluate(NEW_EDITOR_STATE_JS))
    ed = h.get_property("ed").as_element()
    note_id = h.get_property("id").json_value()
    ed.query_selector(".ed-title").fill(title)
    ed.query_selector(".ed-ta").fill(body)
    tag_in = ed.query_selector(".tag-in")
    for t in tags:
        tag_in.fill(t)
        tag_in.press("Enter")
    got = ed.evaluate(READ_EDITOR_JS)
    want = {"connected": True, "title": title, "body": body, "tags": list(tags)}
    if any(got[k] != v for k, v in want.items()):
        return _note_fail(P, "giá trị trong trình soạn khác giá trị đã điền", {"muốn": want, "có": got})
    ed.query_selector(".ed-ta").focus()
    pg.keyboard.press("Control+s")
    try:
        pg.wait_for_function(SAVED_JS, arg=[ed, note_id, title.strip()], timeout=timeout)
    except Exception:
        return _note_fail(P, "chưa thấy trạng thái đã lưu của ghi chú " + note_id[:8], dict(ed.evaluate(READ_EDITOR_JS), hash=pg.evaluate("location.hash")))
    return True


SAVED_OPEN_JS = """() => { const eds = document.querySelectorAll('.ed'), st = eds.length === 1 && eds[0].querySelector('.ed-status .st.ok');
  return !!st && st.textContent.includes('Đã lưu') && [...document.querySelectorAll('.toast')].some(t => !t.__cu && t.textContent.includes('Đã lưu')); }"""


def luu(P, bam=None, timeout=10000):
    """Lưu ghi chú đang mở (Ctrl+S trong ô nội dung, hoặc bấm `bam`) và chờ CHÍNH lần lưu này xong: .ed-status "✓ Đã lưu" và một toast
    "Đã lưu" MỚI — toast của lần lưu trước còn sống 4,5 s nên không được tính."""
    pg = P.pg
    pg.evaluate("() => document.querySelectorAll('.toast').forEach(e => { e.__cu = true; })")
    if bam:
        pg.click(bam)
    else:
        pg.focus(".ed-ta")
        pg.keyboard.press("Control+s")
    try:
        pg.wait_for_function(SAVED_OPEN_JS, timeout=timeout)
        return True
    except Exception:
        return _note_fail(P, "lưu ghi chú đang mở chưa xong", {"hash": pg.evaluate("location.hash"), "status": pg.evaluate("(document.querySelector('.ed-status') || {}).textContent || null")})


PROBE = "document.querySelector('.gv')._probe()"


def graph_settled(pg, tries=40):
    """Chờ bố cục lực đẩy ngừng chuyển động (hai lần đo cách nhau 250 ms giống nhau) rồi trả vị trí các nút."""
    last = None
    cur = None
    for _ in range(tries):
        cur = pg.evaluate(PROBE)
        key = [(round(n["x"]), round(n["y"])) for n in cur["nodes"]] + [round(cur["k"], 3)]
        if key == last:
            return cur
        last = key
        pg.wait_for_timeout(250)
    return cur


class Bare:
    """Bọc một trang không do lớp Page tạo để dùng với new_note/luu (cần .pg; .name để in chẩn đoán)."""

    def __init__(self, pg, name="trang"):
        self.pg = pg
        self.name = name


TITLES_JS = """() => ({ rows: [...document.querySelectorAll('.nrow .nr-title')].map(e => e.textContent), hash: location.hash,
  q: (document.querySelector('#q') || {}).value || '', sync: Wiki.sync.instance ? Wiki.sync.instance.state() : null })"""


def open_row(P, title):
    """Mở ghi chú theo tiêu đề từ danh sách và CHỜ tới khi trình soạn đúng ghi chú đó (danh sách vẽ lại khi đồng bộ đổi dữ liệu).

    Không ném ngoại lệ: khi không mở được thì ghi một phép SAI (kèm trạng thái thật của trang) và trả False — người gọi dừng phần
    phụ thuộc nhưng các tầng/biến thể sau vẫn chạy và dòng tổng vẫn được in."""
    row = ".nrow:has(.nr-title:text-is('%s'))" % title
    try:
        P.pg.wait_for_selector(row, timeout=10000)
    except Exception:
        return check(False, "%s: mở ghi chú '%s' từ danh sách" % (P.name, title),
                     "không có dòng đó — " + json.dumps(P.pg.evaluate(TITLES_JS), ensure_ascii=False)[:600])
    for _ in range(3):
        P.pg.locator(row).click()
        try:
            P.pg.wait_for_function("t => { const i = document.querySelector('.ed-title'); return !!i && i.value === t; }", arg=title, timeout=4000)
            return True
        except Exception:
            P.pg.evaluate("location.hash = '#/notes'")
            P.pg.wait_for_selector(".nrow")
    return check(False, "%s: mở ghi chú '%s' từ danh sách" % (P.name, title), "bấm 3 lần, trình soạn không hiện đúng ghi chú đó")


def menu_click(P, label):
    P.pg.click(".ed .more")
    P.pg.click(".popmenu button:has-text('%s')" % label)


# ---------------------------------------------------------------- perf-md W1: mỗi phím chỉ làm việc rẻ, đếm từ/thẻ trễ 300 ms
# Bất biến không phụ thuộc máy: số lần gọi Wiki.flash.extractCards trong một tràng phím (bản cũ: MỘT lần MỖI phím), và khoảng cách từ phím cuối tới
# lần số đếm đổi (≥ debounce). Đếm qua móc vào đối tượng Wiki.flash (editor.js gọi F.extractCards lúc chạy nên móc có hiệu lực).
W1_HOOK_JS = """() => { const F = Wiki.flash; if (!F.__goc) F.__goc = F.extractCards; window.__ec = 0;
  F.extractCards = function () { window.__ec++; return F.__goc.apply(this, arguments); };
  const ta = document.querySelector('.ed-ta'), cnt = document.querySelector('.ed-status .cnt');
  window.__lastInput = 0; window.__cntAt = 0;
  ta.addEventListener('input', () => { window.__lastInput = performance.now(); });
  new MutationObserver(() => { window.__cntAt = performance.now(); }).observe(cnt, { childList: true, characterData: true, subtree: true }); }"""
W1_STATE_JS = """() => ({ st: document.querySelector('.ed-status .st').textContent, cnt: document.querySelector('.ed-status .cnt').textContent, ec: window.__ec,
  save: document.querySelector('.ed .save').disabled, gap: window.__cntAt && window.__lastInput ? window.__cntAt - window.__lastInput : null })"""
# số từ hiển thị phải đúng định nghĩa cũ (regex \\p{L}\\p{N}) trên nội dung hiện tại của ô soạn
W1_COUNT_OK_JS = """(cards) => { const v = document.querySelector('.ed-ta').value, n = (v.match(/[\\p{L}\\p{N}]+/gu) || []).length;
  return document.querySelector('.ed-status .cnt').textContent === n.toLocaleString('vi-VN') + ' từ' + (cards ? ' · ' + cards + ' thẻ ôn' : ''); }"""


def editor_status_w1(P):
    section(" · trình soạn: mỗi phím chỉ cập nhật 'Chưa lưu'; số từ + thẻ ôn đếm trễ 300 ms sau phím cuối (perf-md W1)")
    pg = P.pg
    pg.wait_for_selector(".ed-status .cnt")
    goc = pg.input_value(".ed-ta")
    check(pg.evaluate(W1_COUNT_OK_JS, 0), "mở ghi chú: số từ đếm ngay, đúng định nghĩa cũ", pg.locator(".ed-status").inner_text())
    pg.evaluate(W1_HOOK_JS)
    pg.click(".ed-ta")
    pg.keyboard.press("Control+End")
    pg.keyboard.type(" một hai ba bốn", delay=25)
    s = pg.evaluate(W1_STATE_JS)
    check("Chưa lưu" in s["st"] and s["save"] is False, "gõ: 'Chưa lưu' + nút Lưu bật ngay (việc rẻ chạy mỗi phím)", s)
    check(s["ec"] <= 2, "tràng 15 phím cách 25 ms: đếm thẻ ôn %d lần (bản cũ: 15 lần — mỗi phím quét cả note)" % s["ec"], s)
    try:
        pg.wait_for_function(W1_COUNT_OK_JS, arg=0, timeout=4000)
        ok_cnt = True
    except Exception:
        ok_cnt = False
    s = pg.evaluate(W1_STATE_JS)
    check(ok_cnt and s["gap"] is not None and s["gap"] >= 250, "ngừng gõ: số từ cập nhật đúng, %s ms sau phím cuối (≥ 300 ms debounce)" % (round(s["gap"]) if s["gap"] else "?"), s)
    pg.keyboard.type("\nQ: Câu hỏi W1?\nA: Đáp án W1", delay=10)
    try:
        pg.wait_for_function(W1_COUNT_OK_JS, arg=1, timeout=4000)
        ok_card = True
    except Exception:
        ok_card = False
    check(ok_card, "thêm Q:/A: → sau khi ngừng gõ hiện '· 1 thẻ ôn' (thẻ đếm trễ cùng số từ)", pg.evaluate(W1_STATE_JS))
    pg.fill(".ed-ta", goc)                                   # trả nội dung về như đã lưu: không để lại nháp/thẻ ảnh hưởng các phần sau
    s = pg.evaluate(W1_STATE_JS)
    check("Đã lưu" in s["st"] and s["save"] is True, "trả chữ về như bản đã lưu: trạng thái về '✓ Đã lưu' ngay, nút Lưu tắt", s)
    try:
        pg.wait_for_function(W1_COUNT_OK_JS, arg=0, timeout=4000)
        ok_back = True
    except Exception:
        ok_back = False
    check(ok_back, "…số từ/thẻ trở lại như cũ sau 300 ms", pg.evaluate(W1_STATE_JS))
    pg.evaluate("() => { const F = Wiki.flash; if (F.__goc) { F.extractCards = F.__goc; delete F.__goc; } }")


# ---------------------------------------------------------------- W2: đồng bộ dễ tìm + thông điệp đúng tình huống (máy chủ /wiki GIẢ qua route)
# Luồng đồng bộ thật (hai thiết bị, máy chủ FastAPI) nằm ở tầng 6; ở đây chỉ dựng đúng các tình huống khó tạo bằng máy chủ thật:
# kho tạm, mất kho, địa chỉ không có API, mở file://, trang thiếu cấu hình.
class FakeWiki:
    """Máy chủ /wiki giả cho một ngữ cảnh trình duyệt (ctx.route("**/wiki/**", fake.handle)). items: ok | lost | no_api."""

    BEN = {"default": "json", "backends": [{"id": "json", "label": "Tệp JSON", "available": True, "persistent": True, "reason": ""},
                                           {"id": "mysql", "label": "MySQL", "available": True, "persistent": True, "reason": ""},
                                           {"id": "mongo", "label": "MongoDB", "available": False, "persistent": True, "reason": "Máy chủ chưa cấu hình MongoDB"}]}
    TAM = {"default": "json", "backends": [{"id": "json", "label": "Tệp JSON", "available": True, "persistent": False, "reason": "Thư mục tạm"},
                                           {"id": "mysql", "label": "MySQL", "available": False, "persistent": True, "reason": "Không kết nối được MySQL"},
                                           {"id": "mongo", "label": "MongoDB", "available": False, "persistent": True, "reason": "Máy chủ chưa cấu hình MongoDB"}]}
    TRON = {"default": "json", "backends": [TAM["backends"][0], BEN["backends"][1], BEN["backends"][2]]}

    def __init__(self, backends=None):
        self.backends = backends or self.BEN
        self.items = "ok"
        self.calls = []

    def handle(self, route):
        import urllib.parse
        req = route.request
        p = urllib.parse.urlparse(req.url).path
        rest = p[p.find("/wiki/") + 6:]
        self.calls.append(req.method + " " + rest)

        def js(status, body):
            route.fulfill(status=status, content_type="application/json", body=json.dumps(body, ensure_ascii=False))
        if rest == "backends":
            return js(200, self.backends)
        if rest == "workspaces":
            return js(201, {"workspaceId": "wk_fake", "key": "khoa-gia"})
        if self.items == "lost":
            return js(404, {"status_code": 404, "message": "Không gian làm việc không tồn tại", "data": {"code": "wiki_not_found"}})
        if self.items == "no_api":
            return js(404, {"detail": "Not Found"})
        if req.method == "PUT":
            return js(200, {"items": (json.loads(req.post_data or "{}") or {}).get("items", []), "serverTime": 2})
        return js(200, {"items": [], "serverTime": 1, "more": False})


SEED_SYNC_JS = """async (c) => { const s = await Wiki.store.openBest('personal-wiki'); const r = Wiki.repo.create(s); await r.open();
  await r.setMeta('sync', c); await r.setMeta('syncCursor', 0); await r.setMeta('syncLast', 0); }"""
CHIP_JS = """() => { const c = document.querySelector('#syncChip'); return c ? { hidden: c.hidden, visible: !!c.offsetParent, kind: c.dataset.kind,
  text: c.querySelector('.sc-t').textContent, label: c.getAttribute('aria-label') } : null; }"""
BANNER_JS = """() => { const b = document.querySelector('#banner'); return { hidden: b.hidden, text: b.innerText, sync: !!b.querySelector('[data-bn=sync]') }; }"""


def _sync_box(pg):
    return re.sub(r"\s+", " ", pg.locator(SYNC_SECTION).inner_text())


# Chân thanh bên ("← Cổng ứng dụng") phải nằm ở ĐÁY thanh bên dù chỉ báo đồng bộ hiện hay ẩn (lỗi cũ: luật ".syncchip + .side-foot" vẫn áp khi
# chip [hidden] — file://, thiếu cấu hình, lúc mới mở — nên chân thanh bên trôi lên giữa).
FOOT_JS = """() => { const s = document.querySelector('#side'), f = document.querySelector('#side .side-foot'), c = document.querySelector('#syncChip');
  if (!s || !f || getComputedStyle(s).display === 'none') return null;
  const a = s.getBoundingClientRect(), b = f.getBoundingClientRect(), pb = parseFloat(getComputedStyle(s).paddingBottom) || 0;
  return { chipHidden: !c || c.hidden, sideBottom: Math.round(a.bottom - pb), footBottom: Math.round(b.bottom), gap: Math.round(a.bottom - pb - b.bottom) }; }"""
# Toast mới (chưa đánh dấu) có chữ t — đánh dấu mọi toast đang có bằng MARK_TOASTS_JS trước thao tác cần kiểm.
MARK_TOASTS_JS = "() => { document.querySelectorAll('.toast').forEach(e => { e.__cu = true; }); }"
NEW_TOASTS_JS = "t => [...document.querySelectorAll('.toast')].filter(e => !e.__cu && e.textContent.includes(t)).length"
OPEN_DLG_JS = """() => { const d = document.querySelector('dialog[open]'), i = d && d.querySelector('#ff-code');
  return { hash: location.hash, href: location.href, val: i ? i.value : '', hint: d ? d.innerText.replace(/\\s+/g, ' ') : '' }; }"""


def _mo_lien_ket_cung_the(Pg, code, cho_hop=True, timeout=4000):
    """Dán liên kết nối vào thanh địa chỉ của CHÍNH thẻ này (chỉ đổi hash, không tải lại trang). → (có hộp 'Nối' mở, {hash, href, val, hint})."""
    pg = Pg.pg
    pg.evaluate(MARK_TOASTS_JS)
    pg.evaluate("h => { location.hash = h }", "#/join/" + code)
    hop = False
    if cho_hop:
        try:
            pg.wait_for_selector("dialog[open] #ff-code", timeout=timeout)
            hop = True
        except Exception:
            hop = False
    else:
        pg.wait_for_timeout(500)
    return hop, pg.evaluate(OPEN_DLG_JS)


def _huy_hop(pg):
    """Đóng hộp thoại đang mở (nếu có) bằng nút Huỷ."""
    if pg.locator("dialog[open] button:has-text('Huỷ')").count():
        pg.click("dialog[open] button:has-text('Huỷ')")
        pg.wait_for_timeout(200)


def tang_2_dong_bo(br, P, url, may):
    section(" · đồng bộ: dễ tìm (đầu Cài đặt, neo #/settings/sync, chỉ báo ở thanh bên) + thông điệp đúng từng tình huống (W2)")
    pg = P.pg
    P.go("#/notes")
    pg.wait_for_function("() => { const c = document.querySelector('#syncChip'); return c && c.dataset.kind === 'off'; }", timeout=5000)
    ch = pg.evaluate(CHIP_JS)
    check(ch["visible"] and ch["text"] == "Bật đồng bộ", "thanh bên (1366 px): chỉ báo đồng bộ 'Bật đồng bộ' khi chưa nối kho", ch)
    pg.click("#syncChip")
    pg.wait_for_selector(SYNC_SECTION + " .sync-backend", timeout=8000)
    st = pg.evaluate("""() => ({ hash: location.hash, first: (document.querySelector('.settings section.set h2') || {}).textContent,
      focus: document.activeElement ? document.activeElement.id : '', top: Math.round(document.querySelector('#set-sync').getBoundingClientRect().top) })""")
    check(st["hash"] == "#/settings/sync" and st["first"] == "Đồng bộ giữa các thiết bị", "bấm chỉ báo → #/settings/sync; mục Đồng bộ là mục ĐẦU của Cài đặt", st)
    check(st["focus"] == "set-sync-h", "neo #/settings/sync đưa focus tới tiêu đề mục Đồng bộ (trình đọc màn hình đọc đúng chỗ)", st)
    ft = pg.evaluate(FOOT_JS)
    check(bool(ft) and not ft["chipHidden"] and abs(ft["gap"]) <= 2, "thanh bên: chỉ báo đồng bộ hiện → '← Cổng ứng dụng' vẫn ở đáy thanh bên (ngay dưới chỉ báo)", ft)
    sel = pg.input_value(SYNC_SECTION + " .sync-backend")
    check(sel == "json" and pg.locator(SYNC_SECTION + " [data-sync=ephemeral]").count() == 0,
          "máy chủ thật (JSON bền là mặc định): chọn sẵn 'json', không cảnh báo kho tạm", (sel, _sync_box(pg)[:160]))

    # ---- kho tạm / chọn kho bền (máy chủ giả)
    fake = FakeWiki(FakeWiki.TAM)
    Q = Page(br, url + "#/settings/sync", "desk-dong-bo", setup=lambda c: c.route("**/wiki/**", fake.handle), viewport={"width": 1366, "height": 820})
    q = Q.pg
    q.wait_for_selector(SYNC_SECTION + " [data-sync=ephemeral]", timeout=8000)
    txt = _sync_box(q)
    check("chỉ có kho tạm" in txt and "Hãy sao lưu" in txt and q.input_value(SYNC_SECTION + " .sync-backend") == "json",
          "máy chủ CHỈ có kho tạm: cảnh báo 'chỉ có kho tạm … Hãy sao lưu', vẫn chọn được JSON", txt[:200])
    q.click(SYNC_SECTION + " button:has-text('Tạo kho đồng bộ mới')")
    q.wait_for_selector("dialog[open]")
    dlg = re.sub(r"\s+", " ", q.locator("dialog[open]").inner_text())
    check("Tạo kho tạm?" in dlg and "KHO TẠM" in dlg and q.locator("dialog[open] button:has-text('Vẫn tạo kho tạm')").count() == 1,
          "bấm Tạo khi chỉ có kho tạm: hộp xác nhận nói rõ 'KHO TẠM' (nút 'Vẫn tạo kho tạm')", dlg[:200])
    q.click("dialog[open] button:has-text('Huỷ')")
    q.wait_for_timeout(200)
    check(not any(c.startswith("POST workspaces") for c in fake.calls), "Huỷ → không tạo kho nào", fake.calls)
    fake.backends = FakeWiki.TRON
    Q.go("#/notes")
    Q.go("#/settings/sync")
    q.wait_for_selector(SYNC_SECTION + " .sync-backend", timeout=8000)
    check(q.input_value(SYNC_SECTION + " .sync-backend") == "mysql" and q.locator(SYNC_SECTION + " [data-sync=ephemeral]").count() == 0,
          "mặc định của máy chủ là kho tạm nhưng có MySQL bền → chọn sẵn MySQL, không cảnh báo", q.input_value(SYNC_SECTION + " .sync-backend"))
    q.select_option(SYNC_SECTION + " .sync-backend", "json")
    q.wait_for_selector(SYNC_SECTION + " [data-sync=ephemeral]", timeout=3000)
    check("Nơi lưu này là kho tạm" in _sync_box(q), "tự chọn JSON (kho tạm) → cảnh báo 'Nơi lưu này là kho tạm'", _sync_box(q)[:200])

    # ---- liên kết nối mở trong CHÍNH thẻ đang ở #/settings/sync (lỗi cũ: nhánh "cùng màn" của app.js bỏ qua → không hộp, không toast, mã treo
    # lại tới lần mở Cài đặt sau rồi bật hộp "Nối" bất ngờ). Ca thật: máy tính đang ở Cài đặt → Đồng bộ, dán liên kết nhận qua chat vào chính thẻ đó.
    LINK = "json.wk_lienket.khoa-lien-ket"
    hop, sj = _mo_lien_ket_cung_the(Q, LINK)
    check(hop and sj["val"] == LINK and sj["hash"] == "#/settings/sync" and LINK not in sj["href"],
          "thẻ ĐANG ở #/settings/sync mở liên kết nối (chỉ đổi hash): hộp 'Nối' bật ngay, điền sẵn mã, địa chỉ về #/settings/sync (mã không nằm lại)",
          {k: v[:80] for k, v in sj.items()})
    _huy_hop(q)
    check(not any("wk_lienket" in c for c in fake.calls) and not q.evaluate("Wiki.sync.instance.state().configured"),
          "…không tự nối (Huỷ → không gọi kho trong liên kết, máy vẫn chưa nối)", [c for c in fake.calls if "wk_lienket" in c])
    Q.go("#/notes")
    Q.go("#/settings")
    q.wait_for_selector(SYNC_SECTION + " .sync-backend", timeout=8000)
    q.wait_for_timeout(300)
    n_dlg = q.locator("dialog[open]").count()
    check(n_dlg == 0, "mở Cài đặt lần sau: KHÔNG có hộp 'Nối' nào bật ra (mã từ liên kết không treo lại)", q.evaluate(OPEN_DLG_JS)["hint"][:120] if n_dlg else "")
    _huy_hop(q)
    Q.go("#/settings/sync")
    q.wait_for_selector(SYNC_SECTION + " .sync-backend", timeout=8000)

    # ---- rớt mạng khi bảng đang mở và ĐÃ hỏi được danh sách nơi lưu → 'ngoại tuyến', không mời Tạo/Nối (đều cần mạng); có mạng lại → như cũ
    Q.ctx.set_offline(True)
    try:
        q.wait_for_selector(SYNC_SECTION + " [data-sync=offline]", timeout=4000)
    except Exception:
        pass
    check(q.locator(SYNC_SECTION + " [data-sync=offline]").count() == 1 and q.locator(SYNC_SECTION + " button:has-text('Tạo kho đồng bộ mới')").count() == 0
          and q.locator(SYNC_SECTION + " button:has-text('Nối vào kho có sẵn')").count() == 0,
          "rớt mạng khi bảng đang mở (đã có danh sách nơi lưu): 'Đang ngoại tuyến', không còn nút Tạo kho / Nối (bấm chỉ ra lỗi mạng)", _sync_box(q)[:160])
    Q.ctx.set_offline(False)
    try:
        q.wait_for_selector(SYNC_SECTION + " .sync-backend", timeout=4000)
    except Exception:
        pass
    check(q.locator(SYNC_SECTION + " button:has-text('Tạo kho đồng bộ mới')").count() == 1 and q.locator(SYNC_SECTION + " [data-sync=offline]").count() == 0,
          "có mạng lại: bảng tự vẽ lại ô chọn nơi lưu + nút Tạo kho (không cần tải lại)", _sync_box(q)[:160])

    # ---- mất kho thật → biểu ngữ + thông điệp 'nối lại'; địa chỉ không có API → 'thử lại'; sửa xong → hết biểu ngữ
    q.evaluate(SEED_SYNC_JS, {"ws": "wk_fake", "key": "khoa-gia", "backend": "json"})
    fake.items = "lost"
    Q.go("#/notes")
    q.reload()
    q.wait_for_function("document.body.classList.contains('ready')")
    q.wait_for_function("Wiki.sync.instance.state().fatal === true", timeout=10000)
    q.wait_for_timeout(100)
    bn, ch = q.evaluate(BANNER_JS), q.evaluate(CHIP_JS)
    check(not bn["hidden"] and "Đồng bộ đã dừng" in bn["text"] and "nối lại" in bn["text"] and bn["sync"],
          "kho mất thật (404 wiki_not_found): BIỂU NGỮ 'Đồng bộ đã dừng … nối lại' có nút 'Mở Đồng bộ' (trước đây lỗi chỉ thấy trong Cài đặt)", bn)
    check(ch["kind"] == "fatal" and ch["text"] == "Mất kho đồng bộ", "chỉ báo thanh bên: 'Mất kho đồng bộ'", ch)
    if bn["sync"]:
        q.click("#banner [data-bn=sync]")
    else:                                                    # (đột biến bieu-ngu-chet) không có nút: tự tới neo để các phép sau vẫn chạy
        Q.go("#/settings/sync")
    q.wait_for_selector(SYNC_SECTION + " [data-sync=lost]", timeout=5000)
    txt = _sync_box(q)
    check(Q.hash() == "#/settings/sync" and q.locator(SYNC_SECTION + " button:has-text('Nối lại bằng mã')").count() == 1 and "vẫn còn nguyên" in txt,
          "bấm 'Mở Đồng bộ' → #/settings/sync: thông điệp mất kho + nút 'Nối lại bằng mã…' + 'ghi chú trên máy vẫn còn nguyên'", (Q.hash(), txt[:200]))
    fake.items = "no_api"
    q.evaluate("Wiki.sync.instance.now()")
    q.wait_for_selector(SYNC_SECTION + " [data-sync=no_api]", timeout=8000)
    bn, txt = q.evaluate(BANNER_JS), _sync_box(q)
    check("không có API đồng bộ" in bn["text"] and "không có API đồng bộ" in txt and q.locator(SYNC_SECTION + " button:has-text('Thử lại')").count() == 1
          and q.locator(SYNC_SECTION + " button:has-text('Nối lại bằng mã')").count() == 0,
          "địa chỉ không có API (404 không mã): biểu ngữ + mục Đồng bộ nói 'không có API đồng bộ', nút 'Thử lại', KHÔNG mời nối lại", (bn["text"][:120], txt[:200]))
    fake.items = "ok"
    q.click(SYNC_SECTION + " button:has-text('Thử lại')")
    q.wait_for_function("() => { const s = Wiki.sync.instance.state(); return s.phase === 'idle' && !s.fatal && s.last > 0; }", timeout=10000)
    q.wait_for_timeout(100)
    bn, ch = q.evaluate(BANNER_JS), q.evaluate(CHIP_JS)
    check(bn["hidden"] and ch["kind"] == "ok" and "đồng bộ" in ch["text"].lower(), "máy chủ trả lời bình thường lại + 'Thử lại' → biểu ngữ tắt, chỉ báo '%s'" % ch["text"], (bn, ch))

    # ---- máy ĐÃ nối kho (json.wk_fake.khoa-gia), thẻ ở #/settings/sync: liên kết của CÙNG kho viết kiểu mã cũ "default." → 'đã nối đúng kho',
    # không mời "THAY kho đó" (so theo mã kho + khoá, không so cả chuỗi); liên kết kho KHÁC → hộp ghi rõ sẽ THAY, Huỷ thì giữ kho cũ
    hop, sj = _mo_lien_ket_cung_the(Q, "default.wk_fake.khoa-gia", cho_hop=False)
    n_ok = q.evaluate(NEW_TOASTS_JS, "đã nối đúng kho này")
    check(n_ok == 1 and q.locator("dialog[open]").count() == 0 and sj["hash"] == "#/settings/sync",
          "đã nối json.<kho>.<khoá>, mở liên kết default.<cùng kho>.<khoá>: toast 'đã nối đúng kho này', KHÔNG hộp 'THAY kho đó'", (n_ok, sj["hint"][:120]))
    _huy_hop(q)
    hop, sj = _mo_lien_ket_cung_the(Q, "json.wk_khac.khoa-khac")
    check(hop and sj["val"] == "json.wk_khac.khoa-khac" and "THAY kho đó" in sj["hint"], "đã nối kho, mở liên kết của kho KHÁC: hộp 'Nối' điền sẵn và nói rõ sẽ THAY kho đó", sj["hint"][:200])
    _huy_hop(q)
    check(q.evaluate("Wiki.sync.instance.code()") == "json.wk_fake.khoa-gia", "…Huỷ → vẫn nối kho cũ", q.evaluate("Wiki.sync.instance.code()"))
    # 404 do chính máy chủ giả trả (mất kho / không có API) làm trình duyệt ghi "Failed to load resource" — cố ý, không phải lỗi của app
    Q.errors = [e for e in Q.errors if "status of 404" not in e]
    Q.close()

    # ---- mở bằng file:// → nói đúng lý do
    from pathlib import Path
    F = Page(br, Path(HERE, "index.html").as_uri() + "#/settings/sync", "file", viewport={"width": 1366, "height": 820})
    F.pg.wait_for_selector(SYNC_SECTION + " [data-sync=file]", timeout=8000)
    txt, ch = _sync_box(F.pg), F.pg.evaluate(CHIP_JS)
    check("mở tệp trực tiếp (file://)" in txt and "/webapp/tranphuc8a/personal-wiki/" in txt and ch["hidden"],
          "mở bằng file://: 'Bạn đang mở tệp trực tiếp (file://) … mở app qua máy chủ …/personal-wiki/'; không hiện chỉ báo đồng bộ", (txt[:200], ch))
    ft = F.pg.evaluate(FOOT_JS)
    check(bool(ft) and ft["chipHidden"] and abs(ft["gap"]) <= 2, "file:// (chỉ báo ẩn): '← Cổng ứng dụng' vẫn ở ĐÁY thanh bên, không trôi lên giữa", ft)
    F.pg.wait_for_timeout(300)
    hop, sj = _mo_lien_ket_cung_the(F, "json.wk_tep.khoa-tep", cho_hop=False)
    n1 = F.pg.evaluate(NEW_TOASTS_JS, "chỉ dùng được khi mở app qua máy chủ")
    check(n1 == 1 and sj["hash"] == "#/settings/sync" and "wk_tep" not in sj["href"] and F.pg.locator("dialog[open]").count() == 0,
          "file://, thẻ đang ở #/settings/sync mở liên kết nối: báo NGAY 'Liên kết nối chỉ dùng được khi mở app qua máy chủ', địa chỉ đã xoá mã", (n1, sj["hash"]))
    F.go("#/notes")
    F.pg.evaluate(MARK_TOASTS_JS)
    F.go("#/settings")
    F.pg.wait_for_selector(SYNC_SECTION + " [data-sync=file]", timeout=8000)
    F.pg.wait_for_timeout(300)
    n2 = F.pg.evaluate(NEW_TOASTS_JS, "chỉ dùng được khi mở app qua máy chủ")
    check(n2 == 0, "…mở Cài đặt lần sau: không còn toast liên kết nối (mã không treo lại)", n2)
    F.close()

    # ---- http(s) nhưng trang KHÔNG có cấu hình (vd máy chủ tĩnh khác) → 'thiếu cấu hình' + Tải lại + ./
    raw = io.open(os.path.join(HERE, "index.html"), "rb").read()
    G = Page(br, url + "#/settings/sync", "no-config", setup=lambda c: c.route(url, lambda r: r.fulfill(status=200, content_type="text/html; charset=utf-8", body=raw)),
             viewport={"width": 1366, "height": 820})
    G.pg.wait_for_selector(SYNC_SECTION + " [data-sync=no_config]", timeout=8000)
    txt = _sync_box(G.pg)
    check(G.pg.evaluate("typeof window.__WEBAPP_CONFIG__") == "undefined" and "không nhận được địa chỉ API" in txt
          and G.pg.locator(SYNC_SECTION + " button:has-text('Tải lại trang')").count() == 1 and G.pg.locator(SYNC_SECTION + " a[href='./']").count() == 1,
          "http không có cấu hình máy chủ: 'Trang không nhận được địa chỉ API' + nút 'Tải lại trang' + liên kết ./ (khác thông điệp file://)", txt[:200])
    check("file://" not in txt and "ngoại tuyến" not in txt, "…không lẫn với thông điệp file:// hay ngoại tuyến", txt[:200])
    G.close()


# ============================================================================================ tầng 2 — chức năng
def tang_2(may):
    section("TẦNG 2 — chức năng (trình duyệt thật)")
    from playwright.sync_api import sync_playwright
    url = may.goc + PATH
    tmp = tempfile.mkdtemp(prefix="wiki-check-")
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        P = Page(br, url, "desk", viewport={"width": 1366, "height": 820})
        pg = P.pg

        section(" · khởi động + ghi chú cơ bản")
        check(pg.evaluate("document.body.dataset.route") == "home" and pg.locator(".welcome").count() == 1, "trang chủ rỗng: có lời mời tạo ghi chú")

        # Lỗi cũ (có từ lúc tạo app): ô tiêu đề của note mới điền sẵn chữ "Chưa đặt tên" (normalizeNote) → note chưa gõ gì đã "Chưa lưu",
        # rời đi thì giữ nháp; nhịp focus 30 ms nhảy sang ô nội dung; lưu chỉ nội dung thì tiêu đề thành "Chưa đặt tên" thay vì dòng đầu.
        # Đó cũng là gốc chỗ tầng 6 đỏ chập chờn: fill tiêu đề của Playwright bị nhịp focus đó cắt ngang, chữ rơi vào ô nội dung.
        section(" · ghi chú mới: ô tiêu đề trống + con trỏ ở tiêu đề; chưa gõ gì thì không có gì để lưu; chỉ nội dung → tiêu đề lấy dòng đầu")
        pg.click("#newBtn")
        pg.wait_for_selector(".ed-title")
        pg.wait_for_timeout(250)                             # qua nhịp tự focus 30 ms của editor.js
        st0 = pg.evaluate(BLANK_NOTE_JS)
        check(st0["title"] == "" and st0["ph"] == "Tiêu đề" and st0["focus"] == "ed-title",
              "ghi chú mới: ô tiêu đề TRỐNG (chữ mờ 'Tiêu đề', không điền sẵn 'Chưa đặt tên'), con trỏ ở ô tiêu đề", st0)
        check(st0["save"] is True and "trống" in st0["status"], "ghi chú mới chưa gõ gì: nút Lưu tắt, trạng thái 'Ghi chú trống' (không phải 'Chưa lưu')", st0)
        P.go("#/")
        pg.wait_for_timeout(400)
        check(pg.locator(".toast:has-text('bản nháp')").count() == 0 and pg.locator(".welcome").count() == 1, "rời ghi chú mới chưa gõ gì: không giữ bản nháp, không tạo ghi chú")
        Q = Page(br, url, "desk-tieu-de", viewport={"width": 1366, "height": 820})   # ngữ cảnh riêng (IndexedDB riêng): không đụng dữ liệu của P
        Q.pg.click("#newBtn")
        Q.pg.wait_for_selector(".ed-title")
        Q.pg.wait_for_timeout(250)                           # qua nhịp tự focus 30 ms (điền trước nhịp đó thì focus có thể nhảy giữa chừng)
        Q.pg.fill(".ed-ta", "Dòng đầu thành tiêu đề\n\nphần thân của ghi chú")
        check(luu(Q) and Q.pg.input_value(".ed-title") == "Dòng đầu thành tiêu đề",
              "lưu ghi chú chỉ có nội dung: tiêu đề tự lấy từ dòng đầu (không thành 'Chưa đặt tên')", Q.pg.input_value(".ed-title"))
        Q.close()

        check(new_note(P, "Alpha note", "# Alpha\n\nHello world quokka. Links to [[Beta note]] and [[depends_on::Gamma note]].\n\nQ: Capital of France?\nA: Paris\n", ["x", "y"]), "tạo + lưu ghi chú (Ctrl+S) hiện thông báo")
        check(re.match(r"#/n/[0-9a-f-]{36}$", P.hash()) is not None, "sau khi lưu, địa chỉ là #/n/<id> (bỏ ?new=1)", P.hash())
        alpha = P.hash().split("/")[-1]
        check(pg.locator(".nrow").count() == 1 and "Alpha note" in pg.locator(".nrow").first.inner_text(), "danh sách hiện ghi chú vừa tạo")
        check("Đã lưu" in pg.locator(".ed-status").inner_text(), "thanh trạng thái: Đã lưu")
        try:                                                 # bản xem trước vẽ lại 140 ms sau thay đổi cuối (thêm tag) — Ctrl+S có thể xong trước nhịp đó
            pg.wait_for_function("document.querySelectorAll('.ed-prev a.wl.ghost').length === 2", timeout=3000)
        except Exception:
            pass
        check(pg.locator(".ed-prev a.wl.ghost").count() == 2, "xem trước: 2 liên kết mờ (note chưa có)", pg.locator(".ed-prev a.wl.ghost").count())
        check(pg.locator(".tagchip").count() == 2, "tag hiện thành chip (#x, #y)")

        section(" · liên kết [[…]], backlink, quan hệ")
        pg.click(".ed-prev a.wl.ghost >> nth=0")
        pg.wait_for_selector(".ed-title")
        check(pg.input_value(".ed-title") == "Beta note", "bấm liên kết mờ → mở note mới với tiêu đề đã điền", pg.input_value(".ed-title"))
        pg.fill(".ed-ta", "Beta body about quokka. See [[Alpha note]].")
        check(luu(P), "lưu Beta")
        beta = P.hash().split("/")[-1]
        pg.wait_for_timeout(300)
        back = pg.locator(".ed-side .sp").first.inner_text()
        check("Alpha note" in back, "Beta có backlink từ Alpha (liên kết mờ được giải khi note ra đời)", back)
        P.go("#/n/" + alpha)
        pg.wait_for_selector(".ed-prev a.wl")
        pg.wait_for_timeout(300)
        check(pg.locator(".ed-prev a.wl:not(.ghost)").count() == 1 and pg.locator(".ed-prev a.wl.ghost").count() == 1, "Alpha: Beta đã thành liên kết thật, Gamma vẫn mờ")
        side = pg.locator(".ed-side").inner_text()
        check("Phụ thuộc vào" in side and "Chưa có note" in side and "Gamma note" in side, "bảng liên kết: quan hệ có kiểu (depends_on) + liên kết mờ", side[:300])
        sel = pg.locator(".relform select")
        sel.select_option("parent_of")
        pg.fill(".relform input", "Beta")
        pg.dispatch_event(".rsug button >> nth=0", "pointerdown")
        pg.wait_for_timeout(200)
        pg.focus(".ed-ta")
        pg.keyboard.press("Control+s")
        pg.wait_for_timeout(500)
        check("Là cha của" in pg.locator(".ed-side").inner_text(), "thêm quan hệ parent_of qua bảng, lưu được")
        P.go("#/n/" + beta)
        pg.wait_for_timeout(500)
        check("Alpha note" in pg.locator(".ed-side .sp").first.inner_text(), "Beta thấy Alpha ở 'được tham chiếu' sau khi thêm quan hệ")

        section(" · [[ gợi ý, đổi tên cập nhật liên kết")
        P.go("#/n/" + beta)
        pg.wait_for_selector(".ed-ta")
        pg.click(".ed-ta")
        pg.keyboard.press("Control+End")
        pg.keyboard.type(" and [[Alp")
        pg.wait_for_selector(".suggest .sg", timeout=3000)
        check("Alpha note" in pg.locator(".suggest").inner_text(), "gõ [[Alp → gợi ý Alpha note")
        pg.keyboard.press("Enter")
        pg.wait_for_timeout(150)
        check("[[Alpha note]]" in pg.input_value(".ed-ta"), "Enter chèn tên đầy đủ và đóng ]]", pg.input_value(".ed-ta")[-40:])
        pg.fill(".ed-title", "Beta renamed")
        pg.focus(".ed-ta")
        pg.keyboard.press("Control+s")
        check(P.toast("tên cũ"), "đổi tên: thông báo đã cập nhật [[liên kết]] tới tên cũ")
        P.go("#/n/" + alpha)
        pg.wait_for_selector(".ed-ta")
        check("[[Beta renamed]]" in pg.input_value(".ed-ta"), "Alpha tự được sửa [[Beta note]] → [[Beta renamed]]")

        section(" · tìm kiếm")
        P.go("#/notes")
        pg.wait_for_selector("#q")

        def search(q):
            pg.fill("#q", q)
            pg.wait_for_function("q => { const c = document.querySelector('.lp-count'); return c && c.dataset.q === q && !c.textContent.startsWith('Lỗi'); }", arg=q, timeout=4000)
            return pg.locator(".lp-count").inner_text()
        for q, want, what in (("quokka", "2 kết quả", "toàn văn: 'quokka' khớp 2 ghi chú"), ("tag:x", "1 kết quả", "tag:x khớp 1"), ('"Capital of"', "1 kết quả", "cụm từ trong ngoặc kép khớp 1"),
                              ("Paris", "1 kết quả", "từ chỉ có trong thân note"), ("alpha", "2 kết quả", "'alpha' có ở tiêu đề Alpha và thân Beta (liên kết) → 2"), ("quok", "2 kết quả", "tiền tố 'quok' cũng khớp (gõ dở vẫn thấy)"),
                              ("capital tag:y", "1 kết quả", "tổ hợp từ + tag"), ("zzzkhongco", "0 kết quả", "không có kết quả → 0 kết quả")):
            r = search(q)
            check(want in r, what, r)
        check(pg.locator(".empty-list").count() == 1 and "Tạo ghi chú" in pg.locator(".empty-list").inner_text(), "không có kết quả: trạng thái trống kèm nút tạo ghi chú từ câu tìm")
        search("alpha")
        check(pg.locator(".nrow .nr-title").first.inner_text() == "Alpha note", "xếp hạng: khớp ở tiêu đề đứng trước khớp trong thân", pg.locator(".nrow .nr-title").first.inner_text())
        check("<mark>" in pg.locator(".nrow .nr-sn").first.inner_html(), "đoạn trích tô đậm từ khoá")
        pg.fill("#q", "")
        pg.wait_for_timeout(300)

        section(" · ghim, lưu trữ, thùng rác")
        P.go("#/n/" + alpha)
        pg.wait_for_selector(".fav")
        pg.click(".ed .fav")
        pg.wait_for_timeout(500)
        check(pg.locator("#sidePins .pin").count() == 1, "ghim → hiện ở thanh bên")
        menu_click(P, "Lưu trữ")
        pg.wait_for_timeout(500)
        check(P.hash().startswith("#/notes"), "lưu trữ → về danh sách")
        P.go("#/notes?status=archived")
        pg.wait_for_selector(".nrow")
        check(pg.locator(".nrow").count() == 1, "mục Lưu trữ có 1 ghi chú")
        pg.click(".nrow")
        pg.wait_for_selector(".ed-banner:not([hidden])")
        pg.click(".ed-banner button:has-text('Bỏ lưu trữ')")
        pg.wait_for_timeout(500)
        P.go("#/notes")
        pg.wait_for_timeout(300)
        check(pg.locator(".nrow").count() == 2, "bỏ lưu trữ → quay lại danh sách đang dùng (2)")
        P.go("#/n/" + beta)
        pg.wait_for_selector(".ed .more")
        menu_click(P, "Chuyển vào thùng rác")
        pg.click(".dlg .btn-danger-solid")
        pg.wait_for_timeout(600)
        P.go("#/notes?status=trashed")
        pg.wait_for_selector(".nrow")
        check("còn 30 ngày" in pg.locator(".nrow").first.inner_text(), "thùng rác giữ 30 ngày: dòng ghi 'còn 30 ngày'", pg.locator(".nrow").first.inner_text())
        pg.click(".nrow")
        pg.wait_for_selector(".ed-banner:not([hidden])")
        check(pg.locator(".ed-title").get_attribute("readonly") is not None, "note trong thùng rác chỉ đọc")
        pg.click(".ed-banner button:has-text('Khôi phục')")
        pg.wait_for_timeout(500)
        P.go("#/notes")
        pg.wait_for_timeout(300)
        check(pg.locator(".nrow").count() == 2, "khôi phục từ thùng rác")
        P.go("#/n/" + beta)
        pg.wait_for_selector(".ed .more")
        menu_click(P, "Chuyển vào thùng rác")
        pg.click(".dlg .btn-danger-solid")
        pg.wait_for_timeout(500)
        P.go("#/n/" + beta)
        pg.wait_for_selector(".ed-banner:not([hidden])")
        pg.click(".ed-banner button:has-text('Xoá hẳn')")
        pg.click(".dlg .btn-danger-solid")
        pg.wait_for_timeout(600)
        P.go("#/notes")
        pg.wait_for_timeout(300)
        check(pg.locator(".nrow").count() == 1, "xoá hẳn có xác nhận → còn 1 ghi chú")
        P.go("#/n/" + alpha)
        pg.wait_for_selector(".ed-prev a.wl")
        pg.wait_for_timeout(300)
        check(pg.locator(".ed-prev a.wl.ghost").count() == 2, "sau khi xoá hẳn Beta, liên kết tới nó mờ lại")

        section(" · ghi chú ngày, sách, thẻ ôn")
        P.go("#/daily")
        pg.wait_for_selector(".ed-ta")
        check(re.match(r"#/n/[0-9a-f-]{36}\?daily=\d{4}-\d{2}-\d{2}", P.hash()) is not None, "#/daily mở ghi chú ngày xác định", P.hash())
        tpl = pg.input_value(".ed-ta")
        check(tpl.strip() != "" and "##" in tpl, "ghi chú ngày có mẫu", tpl[:60])
        pg.locator("#sideNav a[data-nav=notes]").click()
        pg.wait_for_timeout(300)
        check(pg.locator(".nrow").count() == 1, "ghi chú ngày chưa có nội dung thì chưa được lưu")
        P.go("#/daily")
        pg.wait_for_selector(".ed-ta")
        pg.fill(".ed-ta", pg.input_value(".ed-ta") + "\nHôm nay học cấu trúc dữ liệu.\n")
        check(luu(P), "viết vào ghi chú ngày rồi lưu")
        P.go("#/notes")
        pg.wait_for_timeout(300)
        check(pg.locator(".nrow").count() == 2, "ghi chú ngày xuất hiện trong danh sách")

        P.go("#/books")
        pg.click("button:has-text('Thêm sách') >> nth=0")
        pg.fill("#ff-title", "Clean Code")
        pg.fill("#ff-author", "Robert C. Martin")
        pg.click(".dlg button[type=submit]")
        pg.wait_for_selector("h1:has-text('Clean Code')")
        pg.click("button:has-text('Chương')")
        pg.fill("#ff-name", "Functions")
        pg.click(".dlg button[type=submit]")
        pg.wait_for_selector(".ed-title")
        check("Clean Code" in pg.input_value(".ed-title") and "Functions" in pg.input_value(".ed-title"), "thêm chương: ghi chú 'Sách — Chương' nối ngược về sách", pg.input_value(".ed-title"))
        P.go("#/books")
        pg.click(".book")
        pg.wait_for_selector("h1:has-text('Clean Code')")
        pg.click("button:has-text('Trích dẫn')")
        pg.fill("#ff-text", "Functions should do one thing. They should do it well. They should do it only.")
        pg.click(".dlg button[type=submit]")
        pg.wait_for_selector("h2:has-text('Trích dẫn (1)')", timeout=5000)
        check(True, "thêm trích dẫn: sách hiện 'Trích dẫn (1)'")
        check(pg.locator("h2:has-text('Chương (1)')").count() == 1, "sách hiện 'Chương (1)'")

        P.go("#/review")
        pg.wait_for_selector(".fcard")
        check("Capital of France" in pg.locator(".fc-face").first.inner_text(), "ôn tập: thẻ hiện câu hỏi từ Q:")
        check(pg.locator(".fc-back:not([hidden])").count() == 0, "đáp án ẩn cho tới khi bấm")
        pg.click("button:has-text('Hiện đáp án')")
        check("Paris" in pg.locator(".fc-back").inner_text(), "bấm → hiện đáp án (từ A:)")
        pg.click(".grade.g2")
        pg.wait_for_selector(".done", timeout=4000)
        P.go("#/")
        pg.wait_for_timeout(500)
        check(pg.locator("#badgeS:not([hidden])").count() == 0, "chấm điểm xong: huy hiệu số thẻ đến hạn biến mất")

        section(" · đồ thị")
        check(new_note(P, "Delta note", "Nối tới [[Alpha note]] để có cạnh trong đồ thị.", ["x"]), "tạo Delta nối tới Alpha")
        editor_status_w1(P)
        P.go("#/graph")
        pg.wait_for_function("document.querySelector('.gv') && document.querySelector('.gv')._probe().nodes.length >= 2", timeout=8000)
        pr = graph_settled(pg)
        check(len(pr["nodes"]) >= 3, "đồ thị vẽ các note có liên kết (%d nút)" % len(pr["nodes"]))
        box = pg.locator(".gv-canvas").bounding_box()
        alpha_node = next((n for n in pr["nodes"] if n["title"] == "Alpha note"), None)
        check(alpha_node is not None, "Alpha note là một nút")
        k0 = pr["k"]
        pg.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        pg.mouse.wheel(0, -300)
        pg.wait_for_timeout(200)
        k1 = pg.evaluate("document.querySelector('.gv')._probe().k")
        check(k1 > k0, "cuộn chuột để zoom (k %.2f → %.2f)" % (k0, k1))
        pg.mouse.move(box["x"] + 40, box["y"] + 40)
        pg.mouse.down()
        pg.mouse.move(box["x"] + 140, box["y"] + 90, steps=6)
        pg.mouse.up()
        pg.wait_for_timeout(200)
        p2 = pg.evaluate("document.querySelector('.gv')._probe()")
        check(p2["x"] != pr["x"] or p2["y"] != pr["y"], "kéo thả để di chuyển (pan)")
        pg.click("[data-a=fit]")
        # Vùng bấm của một nút chỉ 6 px: bố cục còn nhích (máy bận) giữa lúc đo và lúc bấm là trượt. Đo lại + bấm lại tối đa 3 lần
        # (chập chờn có từ trước W2: 1/3 lượt đỏ khi máy đang chạy bộ kiểm khác song song, 23/10).
        for _ in range(3):
            p3 = graph_settled(pg)
            n3 = next(n for n in p3["nodes"] if n["title"] == "Alpha note")
            pg.mouse.click(box["x"] + n3["x"], box["y"] + n3["y"])
            try:
                pg.wait_for_function("location.hash.includes('/n/')", timeout=3000)
                break
            except Exception:
                pass
        check(P.hash().endswith(alpha), "bấm vào nút → mở đúng ghi chú", P.hash())
        P.go("#/graph")
        pg.wait_for_selector(".gv-chips .chip")
        pg.click("[data-a=list]")
        pg.wait_for_selector(".gv-list .gl")
        n_before = pg.locator(".gv-list .gl").count()
        pg.click(".gv-chips .chip[data-tag='x']")
        pg.wait_for_timeout(500)
        n_after = pg.locator(".gv-list .gl").count()
        check(n_after < n_before, "ẩn tag #x → bớt nút (%d → %d)" % (n_before, n_after))
        pg.click(".gv-chips .chip[data-tag='x']")
        pg.wait_for_timeout(500)
        check(pg.locator(".gv-list .gl").count() == n_before, "hiện lại tag #x → đủ nút")
        pg.fill(".gv-find", "alpha")
        pg.wait_for_timeout(300)
        check(pg.input_value(".gv-find") == "alpha", "ô lọc/tìm nút nhận chữ")

        section(" · xuất, sao lưu, khôi phục, in, ảnh")
        P.go("#/settings")
        pg.wait_for_selector("button:has-text('Xuất JSON')")
        with pg.expect_download() as d:
            pg.click("button:has-text('Xuất JSON')")
        jp = os.path.join(tmp, "export.json")
        d.value.save_as(jp)
        raw = io.open(jp, encoding="utf-8").read()
        data = json.loads(raw)
        notes = data["notes"] if isinstance(data, dict) else data
        check(len(notes) >= 3 and any(n["title"] == "Alpha note" for n in notes), "xuất JSON: %d ghi chú, có Alpha" % len(notes), raw[:120])
        check(all(k in notes[0] for k in ("title", "content", "created_at", "updated_at", "tags", "status")), "JSON có đủ trường title/content/created_at/updated_at/tags/status")
        with pg.expect_download() as d:
            pg.click("button:has-text('Xuất Markdown')")
        mp = os.path.join(tmp, "export-md.zip")
        d.value.save_as(mp)
        zf = zipfile.ZipFile(mp)
        check(zf.testzip() is None and any(n.endswith(".md") for n in zf.namelist()), "xuất Markdown ZIP: mỗi note một .md, zip hợp lệ (%d tệp)" % len(zf.namelist()))
        alpha_md = next(zf.read(n).decode("utf-8") for n in zf.namelist() if "Alpha" in n)
        check(alpha_md.startswith("---") and "tags:" in alpha_md and "[[Beta renamed]]" in alpha_md, "tệp .md có front-matter + [[liên kết]]", alpha_md[:100])
        with pg.expect_download() as d:
            pg.click("button:has-text('Tạo bản sao lưu')")
        bk = d.value
        check(re.match(r"^backup_\d{8}\.zip$", bk.suggested_filename) is not None, "tên bản sao lưu backup_YYYYMMDD.zip", bk.suggested_filename)
        bp = os.path.join(tmp, bk.suggested_filename)
        bk.save_as(bp)
        names = zipfile.ZipFile(bp).namelist()
        check(zipfile.ZipFile(bp).testzip() is None and "manifest.json" in names and "notes.jsonl" in names, "backup zip hợp lệ: manifest + notes.jsonl", names)

        P.go("#/n/" + alpha)
        pg.wait_for_selector(".ed .more")
        pg.evaluate("() => { window.print = function () { window.__printed = { printing: document.body.classList.contains('printing'), text: (document.querySelector('#printArea') || {}).innerText || '' }; }; }")   # dạng hàm: một biểu thức trả về hàm sẽ bị Playwright GỌI luôn
        menu_click(P, "In / Lưu PDF")
        pg.wait_for_function("window.__printed", timeout=3000)
        pr_ = pg.evaluate("window.__printed")
        check(pr_["printing"] and "Alpha note" in pr_["text"] and "Capital of France" in pr_["text"], "In/PDF: dựng bản in riêng và gọi hộp thoại in", pr_["text"][:80])
        pg.evaluate("window.dispatchEvent(new Event('afterprint'))")
        check(pg.locator("#printArea").count() == 0 and not pg.evaluate("document.body.classList.contains('printing')"), "dọn bản in sau khi in xong")
        pg.emulate_media(media="print")
        pg.evaluate("document.body.classList.add('printing'); var a=document.createElement('div'); a.id='printArea'; a.className='md print-doc'; a.textContent='x'; document.body.append(a)")
        vis_print = pg.evaluate("[...document.body.children].filter(e => getComputedStyle(e).display !== 'none' && e.tagName !== 'SCRIPT').map(e => e.id || e.tagName)")
        check(vis_print == ["printArea"], "CSS in: chỉ #printArea hiện, mọi thứ khác ẩn", vis_print)
        pg.evaluate("document.querySelector('#printArea').remove(); document.body.classList.remove('printing')")
        pg.emulate_media(media="screen")
        with pg.expect_download() as d:
            menu_click(P, "Tải ảnh PNG")
        ip = os.path.join(tmp, "note.png")
        d.value.save_as(ip)
        from PIL import Image
        im = Image.open(ip)
        colors = len(im.convert("RGB").getcolors(maxcolors=100000) or [0] * 99999)
        check(im.format == "PNG" and im.size[0] >= 600 and im.size[1] >= 200 and colors > 5, "xuất ảnh PNG %dx%d, %d màu (không rỗng)" % (im.size[0], im.size[1], colors))
        with pg.expect_download() as d:
            menu_click(P, "Tải Markdown")
        check(d.value.suggested_filename.endswith(".md"), "xuất một ghi chú ra .md", d.value.suggested_filename)

        tang_2_dong_bo(br, P, url, may)

        section(" · cài đặt: giao diện bền qua tải lại")
        P.go("#/settings")
        pg.wait_for_selector(".settings")
        pg.click(".settings .seg button:has-text('Tối')")
        check(pg.evaluate("document.documentElement.dataset.theme") == "dark", "chọn giao diện Tối")
        pg.reload()
        pg.wait_for_function("document.body.classList.contains('ready')")
        check(pg.evaluate("document.documentElement.dataset.theme") == "dark", "giữ giao diện sau khi tải lại")

        section(" · khôi phục sao lưu vào trình duyệt mới")
        P2 = Page(br, url, "desk-restore", viewport={"width": 1366, "height": 820})
        P2.go("#/settings")
        P2.pg.wait_for_selector("button:has-text('Khôi phục từ tệp')")
        with P2.pg.expect_file_chooser() as fc:
            P2.pg.click("button:has-text('Khôi phục từ tệp')")
        fc.value.set_files(bp)
        P2.pg.click(".dlg button:has-text('Gộp')")
        P2.pg.wait_for_timeout(1200)
        P2.go("#/notes")
        P2.pg.wait_for_timeout(500)
        check(P2.pg.locator(".nrow").count() >= 2, "khôi phục từ backup (gộp): ghi chú quay lại (%d)" % P2.pg.locator(".nrow").count())
        P2.go("#/review")
        P2.pg.wait_for_timeout(600)
        check("Capital of France" in (P2.pg.locator(".fcard").inner_text() if P2.pg.locator(".fcard").count() else "") or P2.pg.locator(".done").count() == 1, "thẻ ôn được khôi phục theo")
        P2.close()
        P.close()

        # ---------------------------------------------------------------- điện thoại (Chromium Pixel 5 + WebKit iPhone 13)
        for label, eng, dev in (("Pixel 5", pw.chromium, pw.devices["Pixel 5"]), ("iPhone 13", pw.webkit, pw.devices["iPhone 13"])):
            section(" · điện thoại — " + label)
            b2 = eng.launch()
            M = Page(b2, url, "mob-" + label, **dev)
            mp_ = M.pg
            check(mp_.is_visible("#bottomNav") and not mp_.is_visible("#side"), "thanh dưới hiện, thanh bên ẩn")
            check(mp_.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "trang chủ không tràn ngang")
            mp_.click("#topNew")
            mp_.wait_for_selector(".ed-title")
            check(not mp_.is_visible("#bottomNav") and not mp_.is_visible("#top"), "màn soạn: toàn màn hình (ẩn thanh trên + thanh dưới)")
            mp_.fill(".ed-title", "Ghi từ điện thoại")
            mp_.fill(".ed-ta", "Nội dung gõ trên điện thoại với #tag và [[Liên kết]].")
            mp_.focus(".ed-ta")
            check(luu(M, bam=".save"), "lưu bằng nút Lưu")
            check(not mp_.is_visible(".modes button[data-mode=split]") and mp_.evaluate("document.querySelector('.ed-main').dataset.mode") != "split", "điện thoại: không có chế độ chia đôi")
            mp_.click(".modes button[data-mode=preview]")
            mp_.wait_for_selector(".ed-prev a.wl.ghost")
            check(mp_.is_visible(".ed-prev") and not mp_.is_visible(".ed-ta"), "chế độ Xem: chỉ hiện bản dựng")
            mp_.click(".ed-top .back")
            mp_.wait_for_selector(".nrow")
            check(mp_.evaluate("document.body.dataset.pane") == "list" and mp_.locator(".nrow").count() == 1, "nút quay lại → danh sách một màn")
            check(mp_.is_visible(".fab"), "danh sách có nút nổi tạo ghi chú")
            mp_.click(".nrow")
            mp_.wait_for_selector(".ed-title")
            check(mp_.input_value(".ed-title") == "Ghi từ điện thoại", "chạm dòng → mở ghi chú")
            for hsh in ("#/graph", "#/review", "#/books", "#/tags", "#/settings"):
                M.go(hsh)
                mp_.wait_for_timeout(500)
                check(mp_.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "%s không tràn ngang" % hsh)
            small = mp_.evaluate("""() => [...document.querySelectorAll('button, a.nav, a.bn, .icon-btn, input, select')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 32) && getComputedStyle(e).visibility !== 'hidden'; }).map(e => (e.className || e.tagName) + ' ' + Math.round(e.getBoundingClientRect().height)).slice(0, 8)""")
            check(not small, "vùng chạm ở màn cài đặt ≥ 32px (nút/ô nhập)", small)
            # điện thoại không có thanh bên: trạng thái đồng bộ nằm trong menu "Thêm", bấm là tới mục Đồng bộ (W2)
            M.go("#/notes")
            mp_.click("#moreBtn")
            item = mp_.locator(".popmenu button:has-text('Đồng bộ:')")
            itxt = item.inner_text() if item.count() else ""
            check("Đồng bộ: Bật đồng bộ" in itxt, "menu Thêm có mục 'Đồng bộ: Bật đồng bộ'", itxt)
            if item.count():
                item.click()
                mp_.wait_for_selector(SYNC_SECTION, timeout=5000)
                check(M.hash() == "#/settings/sync" and mp_.evaluate("document.querySelector('.settings section.set h2').textContent") == "Đồng bộ giữa các thiết bị",
                      "bấm mục đó → #/settings/sync, Đồng bộ là mục đầu", M.hash())
            M.close()
            b2.close()
        br.close()
    if ERRORS:
        section("LỖI CONSOLE / PAGEERROR")
    check(not ERRORS, "không có lỗi console hay pageerror trong cả tầng", ERRORS[:6])


# ============================================================================================ tầng 3 — sống sót: sập máy, offline, cập nhật
def _crash(ctx, pg):
    """Giết tiến trình render của trang (như hết pin / trình duyệt chết). Không gọi pagehide hay beforeunload."""
    try:
        pg.goto("chrome://crash", wait_until="commit", timeout=5000)
    except Exception:
        pass
    time.sleep(0.5)                                          # trang đã chết: không dùng pg.wait_for_timeout


def tang_3(may):
    section("TẦNG 3 — sống sót: sập giữa chừng, offline, cập nhật (Chromium)")
    import functools
    import http.server
    import shutil
    import threading
    from playwright.sync_api import sync_playwright
    url = may.goc + PATH
    udd = tempfile.mkdtemp(prefix="wiki-udd-")
    with sync_playwright() as pw:
        # ------------------------------------------------------------------ sập renderer khi đang soạn
        section(" · bản nháp sống sót khi trình duyệt sập (hồ sơ trình duyệt thật, đóng–mở lại)")

        def open_ctx():
            c = pw.chromium.launch_persistent_context(udd, headless=True, viewport={"width": 1366, "height": 820}, service_workers="block")
            p = c.pages[0] if c.pages else c.new_page()
            errs = []
            p.on("pageerror", lambda e: errs.append(str(e)))
            return c, p, errs
        c, p, errs = open_ctx()
        p.goto(url)
        p.wait_for_function("document.body.classList.contains('ready')")
        p.click("#newBtn")
        p.wait_for_selector(".ed-title")
        p.fill(".ed-title", "Chưa kịp lưu")
        p.fill(".ed-ta", "Dòng một\nDòng hai — gõ xong rồi sập nguồn")
        p.wait_for_timeout(900)
        _crash(c, p)
        c.close()
        c, p, errs = open_ctx()
        p.goto(url)
        p.wait_for_function("document.body.classList.contains('ready')")
        got = False
        try:
            p.wait_for_selector(".toast:has-text('bản nháp chưa lưu')", timeout=5000)
            got = True
        except Exception:
            pass
        check(got, "mở lại sau khi sập: có thông báo 'bản nháp chưa lưu'")
        if got:
            p.click(".toast button:has-text('Mở')")
            p.wait_for_selector(".ed-title")
            p.wait_for_timeout(300)
            check(p.input_value(".ed-title") == "Chưa kịp lưu" and "gõ xong rồi sập nguồn" in p.input_value(".ed-ta"), "ghi chú MỚI chưa lưu: tiêu đề + nội dung được khôi phục nguyên vẹn", (p.input_value(".ed-title"), p.input_value(".ed-ta")[:50]))
            check("Chưa lưu" in p.locator(".ed-status").inner_text(), "trạng thái vẫn là 'Chưa lưu' (không tự coi là đã lưu)")
            check(luu(Bare(p, "sập")), "lưu bản đã khôi phục")
        # ghi chú đã lưu + sửa dở rồi sập
        p.evaluate("location.hash = '#/notes'")
        p.wait_for_selector(".nrow")
        p.click(".nrow")
        p.wait_for_selector(".ed-ta")
        p.fill(".ed-ta", "Dòng một\nDòng hai — gõ xong rồi sập nguồn\nDòng ba chưa lưu")
        p.wait_for_timeout(900)
        _crash(c, p)
        c.close()
        c, p, errs = open_ctx()
        p.goto(url)
        p.wait_for_function("document.body.classList.contains('ready')")
        p.evaluate("location.hash = '#/notes'")
        p.wait_for_selector(".nrow")
        p.click(".nrow")
        p.wait_for_selector(".ed-banner:not([hidden])", timeout=5000)
        check("bản nháp chưa lưu" in p.locator(".ed-banner").inner_text(), "ghi chú ĐÃ lưu, sửa dở rồi sập: banner đề nghị khôi phục nháp")
        check("Dòng ba chưa lưu" not in p.input_value(".ed-ta"), "bản đã lưu không bị đè khi chưa đồng ý")
        p.click(".ed-banner button:has-text('Khôi phục nháp')")
        p.wait_for_timeout(300)
        check("Dòng ba chưa lưu" in p.input_value(".ed-ta"), "bấm 'Khôi phục nháp' → lấy lại dòng gõ dở")
        # ngắt ngay sau khi gõ (chưa tới 500 ms debounce): chỉ ghi nhận kết quả
        p.fill(".ed-ta", p.input_value(".ed-ta") + "\nDòng bốn gõ rồi tắt ngay")
        p.close(run_before_unload=False)
        c.close()
        c, p, errs = open_ctx()
        p.goto(url)
        p.wait_for_function("document.body.classList.contains('ready')")
        p.evaluate("location.hash = '#/notes'")
        p.wait_for_selector(".nrow")
        p.click(".nrow")
        p.wait_for_selector(".ed-ta")
        p.wait_for_timeout(500)
        flushed = "Dòng bốn" in p.input_value(".ed-ta") or p.locator(".ed-banner:has-text('Dòng')").count() > 0
        draft_has = p.evaluate("""async () => { const s = await Wiki.store.openBest('personal-wiki'); const r = Wiki.repo.create(s); await r.open(); const ds = await r.listDrafts(); return ds.some(d => d.note && d.note.content.includes('Dòng bốn')); }""")
        print("    (thông tin) gõ rồi đóng thẻ trong < 500 ms: %s" % ("nháp ĐƯỢC giữ (pagehide ghi kịp)" if draft_has else "dòng cuối bị mất — tối đa ≤ 0,5 s chữ gần nhất"))
        check(not errs, "không lỗi JS qua các lần sập/mở lại", errs)
        c.close()
        shutil.rmtree(udd, ignore_errors=True)

        # ------------------------------------------------------------------ offline qua service worker
        section(" · offline: service worker lưu vỏ, mở được khi mất mạng")
        br = pw.chromium.launch()
        ctx = br.new_context(service_workers="allow", viewport={"width": 1366, "height": 820})
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(url)
        pg.wait_for_function("document.body.classList.contains('ready')")
        pg.wait_for_function("navigator.serviceWorker.controller !== null", timeout=15000)
        names = pg.evaluate("caches.keys()")
        mine = [n for n in names if n.startswith("wiki:")]
        check(len(mine) == 1, "có đúng một cache của Wiki", names)
        urls = pg.evaluate("(n) => caches.open(n).then(c => c.keys()).then(ks => ks.map(k => new URL(k.url).pathname))", mine[0])
        for need in ("index.html", "manifest.webmanifest", "assets/js/ui/app.js", "assets/js/core/graph-worker.js", "assets/css/app.css", "assets/icons/icon-192.png"):
            check(any(u.endswith(PATH + need) for u in urls), "cache có " + need)
        check(not any("/api/" in u for u in urls), "cache KHÔNG có API nào (đồng bộ không bao giờ bị lưu đệm)")
        # PWA mở bằng bản index.html worker lưu lúc cài: bản đó phải mang cấu hình máy chủ, nếu không app tưởng không có máy chủ (lỗi gốc 22/10)
        cached = pg.evaluate("([n, u]) => caches.open(n).then(c => c.match(u)).then(r => r ? r.text() : '')", [mine[0], may.goc + PATH + "index.html"])
        check("__WEBAPP_CONFIG__" in cached, "bản index.html service worker lưu lúc cài CÓ __WEBAPP_CONFIG__ (PWA mở offline vẫn biết có máy chủ)",
              "bản lưu không có cấu hình" if cached else "không thấy index.html trong cache")
        check(pg.evaluate("window.Wiki.ui.pwa.installState()") in ("menu", "ready", "installed"), "trạng thái cài đặt hợp lệ trên localhost (secure context)", pg.evaluate("Wiki.ui.pwa.installState()"))
        check(new_note(Bare(pg), "Viết khi còn mạng", "nội dung online"), "tạo ghi chú khi còn mạng")
        ctx.set_offline(True)
        pg.reload(wait_until="domcontentloaded")
        pg.wait_for_function("document.body.classList.contains('ready')", timeout=15000)
        check(pg.locator(".boot").count() == 0 and pg.evaluate("document.body.dataset.route") in ("home", "notes", "n"), "TẮT MẠNG rồi tải lại: ứng dụng vẫn mở được từ cache")
        check("ngoại tuyến" in pg.locator("#banner").inner_text(), "hiện biểu ngữ 'đang ngoại tuyến'", pg.locator("#banner").inner_text())
        check(pg.evaluate("typeof window.__WEBAPP_CONFIG__ === 'object' && Wiki.sync.instance.state().available === true"),
              "offline: trang lấy từ cache vẫn có cấu hình máy chủ (đồng bộ available, chờ có mạng)")
        pg.evaluate("location.hash = '#/notes'")
        pg.wait_for_selector(".nrow")
        check(pg.locator(".nrow").count() == 1, "ghi chú đã tạo vẫn còn khi offline (IndexedDB)")
        check(new_note(Bare(pg), "Viết khi mất mạng", "nội dung offline [[Viết khi còn mạng]]"), "tạo + lưu ghi chú khi OFFLINE")
        pg.evaluate("location.hash = '#/graph'")
        pg.wait_for_function("document.querySelector('.gv') && document.querySelector('.gv')._probe().nodes.length >= 2", timeout=8000)
        check(True, "đồ thị (dùng Web Worker) dựng được khi offline")
        pg.goto(may.goc + PATH + START_URL, wait_until="domcontentloaded")
        pg.wait_for_function("document.body.classList.contains('ready')", timeout=15000)
        check(True, "mở bằng start_url của PWA (.../%s) khi offline cũng được" % START_URL)
        st = pg.evaluate("() => ({ cfg: typeof window.__WEBAPP_CONFIG__ === 'object' && window.__WEBAPP_CONFIG__ ? window.__WEBAPP_CONFIG__.apiBase : null, "
                         "available: !!(Wiki.sync.instance && Wiki.sync.instance.state().available), has: !!(Wiki.api && Wiki.api.has) })")
        check(st["cfg"] == may.api_prefix and st["available"] and st["has"],
              "offline qua start_url PWA: trang có cấu hình apiBase=%r, Wiki.api.has, đồng bộ available" % may.api_prefix, st)
        pg.evaluate("location.hash = '#/settings'")
        pg.wait_for_selector(SYNC_SECTION)
        try:                                                 # bảng chờ đọc xong khoá kho trên máy rồi mới vẽ (W2: state().loaded)
            pg.wait_for_selector(SYNC_SECTION + " [data-sync]", timeout=5000)
        except Exception:
            pass
        txt = pg.locator(SYNC_SECTION).inner_text()
        check("ngoại tuyến" in txt and "Cần mở app qua máy chủ" not in txt,
              "offline: Cài đặt → Đồng bộ báo 'ngoại tuyến', KHÔNG báo 'Cần mở app qua máy chủ'", re.sub(r"\s+", " ", txt)[:160])
        api_ok = pg.evaluate("""() => fetch('/health/').then(() => true, () => false)""")
        check(api_ok is False, "khi offline, gọi API ngoài phạm vi thất bại thật (worker không trả bản cũ)")
        ctx.set_offline(False)
        pg.reload()
        pg.wait_for_function("document.body.classList.contains('ready')")
        pg.evaluate("location.hash = '#/notes'")
        pg.wait_for_selector(".nrow")
        check(pg.locator(".nrow").count() == 2, "có lại mạng: dữ liệu viết khi offline còn nguyên (2 ghi chú)")
        check(not errs, "không lỗi JS ở luồng offline", errs)
        ctx.close()

        # ------------------------------------------------------------------ cập nhật phiên bản
        section(" · cập nhật: 'Có bản mới → Tải lại', không chiếm trang đang soạn dở")
        tmpd = tempfile.mkdtemp(prefix="wiki-upd-")
        shutil.copytree(HERE, os.path.join(tmpd, "app"), ignore=shutil.ignore_patterns("__pycache__", "check.py", "kiem.js"))

        class Quiet(http.server.SimpleHTTPRequestHandler):
            def log_message(self, *a):
                pass
        srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=os.path.join(tmpd, "app")))
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        base = "http://127.0.0.1:%d/" % srv.server_address[1]
        ctx = br.new_context(service_workers="allow", viewport={"width": 1366, "height": 820})
        pg = ctx.new_page()
        pg.goto(base + "index.html")
        pg.wait_for_function("document.body.classList.contains('ready')")
        pg.wait_for_function("navigator.serviceWorker.controller !== null", timeout=15000)
        v1 = [n for n in pg.evaluate("caches.keys()") if n.startswith("wiki:")]
        check(len(v1) == 1, "cài bản 1", v1)
        pg.click("#newBtn")
        pg.wait_for_selector(".ed-title")
        pg.fill(".ed-title", "Đang soạn dở khi có bản mới")
        swp = os.path.join(tmpd, "app", "sw.js")
        src = io.open(swp, encoding="utf-8").read()
        io.open(swp, "w", encoding="utf-8", newline="").write(re.sub(r'var PHIEN_BAN = "[^"]*";', 'var PHIEN_BAN = "bancapnhat01";', src, count=1))
        pg.evaluate("navigator.serviceWorker.getRegistration().then(r => r.update())")
        got = True
        try:
            pg.wait_for_selector("#banner:has-text('Có bản mới')", timeout=15000)
        except Exception:
            got = False
        check(got, "có bản mới → hiện biểu ngữ 'Có bản mới của ứng dụng'")
        check(pg.input_value(".ed-title") == "Đang soạn dở khi có bản mới", "bản mới ĐỨNG CHỜ: không tự tải lại, ô đang soạn còn nguyên")
        check([n for n in pg.evaluate("caches.keys()") if n.startswith("wiki:")] != [] and len(pg.evaluate("caches.keys()")) == 2, "đã tải sẵn bản mới vào cache riêng (2 cache cùng tồn tại)")
        if got:
            pg.click("#banner button:has-text('Tải lại')")
            pg.wait_for_function("document.body.classList.contains('ready')", timeout=15000)
            pg.wait_for_function("caches.keys().then(k => k.length === 1 && k[0].endsWith('bancapnhat01'))", timeout=10000)
            check(True, "bấm Tải lại → chuyển sang bản mới, cache bản cũ được dọn")
            pg.evaluate("location.hash = '#/notes'")
            pg.wait_for_timeout(300)
        ctx.close()
        srv.shutdown()
        shutil.rmtree(tmpd, ignore_errors=True)
        br.close()


# ============================================================================================ tầng 4 — co giãn với dữ liệu xấu nhất
FUZZ_JS = r"""
async () => {
  const store = await Wiki.store.openBest("personal-wiki");
  const repo = Wiki.repo.create(store); await repo.open();
  const longWord = "Siêu".repeat(60), url = "https://example.com/" + "a-very-long-path-segment/".repeat(12);
  const tags = Array.from({ length: 30 }, (_, i) => "thẻ-rất-dài-không-ngắt-chữ-" + i + "-" + "x".repeat(8));
  const heads = Array.from({ length: 60 }, (_, i) => "#".repeat(1 + (i % 4)) + " Mục lục dài dòng số " + i + " " + "chữ ".repeat(8)).join("\n\n");
  const body = [
    "# " + longWord, longWord + longWord, url, "[liên kết dài](" + url + ")",
    "| " + Array.from({ length: 12 }, (_, i) => "Cột rất dài số " + i).join(" | ") + " |\n|" + "---|".repeat(12) + "\n| " + Array.from({ length: 12 }, (_, i) => "ô " + i + " " + "dữ liệu ".repeat(5)).join(" | ") + " |",
    "```js\n// " + "một dòng mã cực dài không xuống dòng ".repeat(12) + "\nconst x = 1;\n```",
    "![ảnh hỏng](https://example.invalid/" + "x".repeat(200) + ".png)",
    "مرحبا بالعالم هذا نص من اليمين إلى اليسار " + "😀🧠🚀".repeat(40),
    "<img src=x onerror=\"window.__xss=1\"> <script>window.__xss=2<\/script> [bẫy](javascript:window.__xss=3) [[<b onmouseover=window.__xss=4>x</b>]]",
    "Q: " + "Câu hỏi rất dài ".repeat(30) + "\nA: " + longWord,
    "- [ ] việc " + "dài ".repeat(60), "> " + "trích dẫn ".repeat(80), heads
  ].join("\n\n");
  const long = await repo.save({ title: longWord, content: body + " [[" + "Liên kết tới note không có " + "dài ".repeat(20) + "]]", tags, fav: true });
  const notes = [];
  for (let i = 0; i < 40; i++) notes.push({ title: (i % 3 ? "Tiêu đề thường " : longWord + " ") + i, content: "nội dung " + i + " " + longWord + " [[" + longWord + " 1]]", tags: tags.slice(0, 1 + (i % 12)) });
  await repo.bulkAdd(notes);
  const book = await repo.save({ title: "Sách " + longWord, kind: "book", content: "Tác giả: " + longWord, tags: ["sach"] });
  await repo.save({ title: "Chương " + longWord, kind: "chapter", content: "x", tags: ["sach"], rel: [{ t: "child_of", id: book.note.id }] });
  return { long: long.note.id, book: book.note.id };
}
"""

OVERFLOW_JS = r"""
() => {
  const W = innerWidth, bad = [];
  if (document.documentElement.scrollWidth > W + 1) bad.push("TRANG cuộn ngang: scrollWidth " + document.documentElement.scrollWidth + " > " + W);
  const scroller = (el) => { for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === "auto" || o === "scroll" || p.classList.contains("gv-area")) return true; } return false; };
  const name = (el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).join(".") : "");
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") continue;
    if (el.closest("dialog") && !el.closest("dialog[open]")) continue;
    const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    if ((r.right > W + 1 || r.left < -1) && !scroller(el)) { bad.push(name(el) + " ra ngoài khung: " + Math.round(r.left) + "…" + Math.round(r.right) + " (rộng " + W + ")"); if (bad.length > 6) break; }
  }
  return bad;
}
"""


def _fuzz_views(ids):
    return [("trang chủ", "#/"), ("danh sách", "#/notes"), ("ghi chú dài — sửa", "#/n/%s" % ids["long"]), ("đồ thị", "#/graph"), ("ôn tập", "#/review"), ("sách", "#/books"),
            ("trang sách", "#/book/%s" % ids["book"]), ("tag", "#/tags"), ("cài đặt", "#/settings")]


def tang_4(may):
    section("TẦNG 4 — co giãn: dữ liệu xấu nhất × bề rộng × trình duyệt (không tràn ngang, hộp thoại nằm trong màn hình)")
    from playwright.sync_api import sync_playwright
    url = may.goc + PATH
    with sync_playwright() as pw:
        engines = [("Chromium", pw.chromium, [280, 320, 360, 390, 768, 900, 1024, 1280, 1920]), ("WebKit", pw.webkit, [320, 390, 1024]), ("Firefox", pw.firefox, [320, 390, 1280])]
        for ename, eng, widths in engines:
            try:
                b = eng.launch()
            except Exception as e:
                print("  (bỏ qua %s: %s)" % (ename, str(e).splitlines()[0]))
                continue
            P = Page(b, url, "fuzz-" + ename, viewport={"width": 1280, "height": 800})
            pg = P.pg
            pg.set_default_timeout(15000)
            ids = pg.evaluate(FUZZ_JS)
            pg.reload()
            pg.wait_for_function("document.body.classList.contains('ready')")
            bad_all = []
            for w in widths:
                pg.set_viewport_size({"width": w, "height": 800})
                for label, h in _fuzz_views(ids):
                    pg.evaluate("h => { location.hash = h }", h)
                    pg.wait_for_timeout(900 if "graph" in h else 450)
                    modes = [None]
                    if "/n/" in h:
                        pg.wait_for_selector(".modes")
                        modes = ["edit", "preview"] + (["split"] if pg.is_visible(".modes button[data-mode=split]") else [])   # chia đôi chỉ khi khung nội dung đủ rộng (≥ 720 px)
                    for mode in modes:
                        if mode:
                            pg.click(".modes button[data-mode=%s]" % mode)
                            pg.wait_for_timeout(250)
                        bad = pg.evaluate(OVERFLOW_JS)
                        if bad:
                            bad_all.append("%dpx · %s%s: %s" % (w, label, (" [%s]" % mode) if mode else "", "; ".join(bad[:3])))
                # hộp thoại + menu nằm trong màn hình
                pg.evaluate("location.hash = '#/n/%s'" % ids["long"])
                pg.wait_for_selector(".ed .more")
                pg.click(".ed .more")
                r = pg.evaluate("(() => { const m = document.querySelector('.popmenu').getBoundingClientRect(); return [m.left, m.top, m.right, m.bottom, innerWidth, innerHeight]; })()")
                if r[0] < -0.5 or r[1] < -0.5 or r[2] > r[4] + 0.5 or r[3] > r[5] + 0.5:
                    bad_all.append("%dpx · menu ⋯ ra ngoài màn hình %s" % (w, [round(x) for x in r]))
                pg.keyboard.press("Escape")
                pg.click(".ed .more")
                pg.click(".popmenu button:has-text('Thông tin')")
                r = pg.evaluate("(() => { const m = document.querySelector('dialog[open]').getBoundingClientRect(); return [m.left, m.top, m.right, m.bottom, innerWidth, innerHeight]; })()")
                if r[0] < -0.5 or r[1] < -0.5 or r[2] > r[4] + 0.5 or r[3] > r[5] + 0.5:
                    bad_all.append("%dpx · hộp thoại ra ngoài màn hình %s" % (w, [round(x) for x in r]))
                pg.keyboard.press("Escape")
                pg.wait_for_timeout(100)
            check(not bad_all, "%s: %d bề rộng × %d màn: không tràn ngang, không ra ngoài khung" % (ename, len(widths), len(_fuzz_views(ids))), bad_all[:8])
            xss = pg.evaluate("window.__xss")
            check(xss is None, "%s: HTML/JS độc trong ghi chú không chạy (window.__xss=%r)" % (ename, xss))
            P.close()
            b.close()


# ============================================================================================ tầng 6 — đồng bộ qua /wiki (hai thiết bị, máy chủ thật)
SYNC_IDLE = "(() => { const s = Wiki.sync.instance && Wiki.sync.instance.state(); return !!s && s.configured && s.phase === 'idle' && s.pending === 0 && s.last > 0; })()"


def _http(method, url, key=None, body=None):
    import urllib.error
    import urllib.request
    req = urllib.request.Request(url, method=method, data=(json.dumps(body).encode("utf-8") if body is not None else None))
    if key:
        req.add_header("X-Wiki-Key", key)
    if body is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, {k.lower(): v for k, v in r.headers.items()}, json.loads(r.read().decode("utf-8") or "null")
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        try:
            return e.code, {k.lower(): v for k, v in e.headers.items()}, json.loads(raw)
        except Exception:
            return e.code, {k.lower(): v for k, v in e.headers.items()}, raw


# Đếm listener "online" gắn SAU lúc móc (app.js, pwa.js, sync.js đã gắn lúc khởi động nên không tính): gắn thêm → +1, gỡ → -1.
ONLINE_HOOK_JS = """() => { const add = window.addEventListener, rm = window.removeEventListener; window.__online = new Set(); window.__offline = new Set();
  window.addEventListener = function (t, f, o) { if (t === 'online') window.__online.add(f); if (t === 'offline') window.__offline.add(f); return add.call(this, t, f, o); };
  window.removeEventListener = function (t, f, o) { if (t === 'online') window.__online.delete(f); if (t === 'offline') window.__offline.delete(f); return rm.call(this, t, f, o); }; }"""


def _tieu_de_may_chu(api, key):
    """[(tiêu đề, đã xoá)] của mọi bản ghi trong kho — để chẩn đoán; không ném ngoại lệ khi máy chủ trả lỗi/thân không phải JSON."""
    try:
        st, _, body = _http("GET", api + "/items?since=0", key)
    except Exception as e:
        return "không đọc được kho: %s" % e
    if not isinstance(body, dict) or not isinstance(body.get("items"), list):
        return "HTTP %s: %s" % (st, str(body)[:120])
    return [((i.get("data") or {}).get("title"), i.get("deleted")) for i in body["items"]]


CONFIG_PROBE = ("() => ({ cfg: typeof window.__WEBAPP_CONFIG__ === 'object' && window.__WEBAPP_CONFIG__ ? window.__WEBAPP_CONFIG__.apiBase : null, "
                "available: !!(Wiki.sync.instance && Wiki.sync.instance.state().available), has: !!(Wiki.api && Wiki.api.has), base: Wiki.api ? Wiki.api.base : null })")

# Các biến thể của tầng 6. (2) là đúng cấu hình máy thật (.env để API_PREFIX trống) + PWA đã cài (mở start_url index.html?source=pwa):
# hai lỗi gốc 22/10 chỉ lộ ra ở đây — bản cũ của tầng 6 chỉ chạy (1) nên xanh dù đồng bộ hỏng.
BIEN_THE_6 = [
    ("/api/v1", "", None, "biến thể 1 — API_PREFIX=/api/v1, A và B mở …/personal-wiki/ (Chromium)"),
    ("", START_URL, None, "biến thể 2 — API_PREFIX trống (như .env), A mở start_url PWA …/%s, B mở …/ (Chromium)" % START_URL),
    ("", START_URL, "msedge", "biến thể 2 trên Edge thật (channel=msedge)"),
]


def tang_6(api_prefix="/api/v1", start_a="", channel=None, nhan=""):
    section("TẦNG 6 — đồng bộ: hai thiết bị + máy chủ FastAPI thật (kho JSON ở thư mục tạm, không đụng database thật)" + ("\n  " + nhan if nhan else ""))
    from playwright.sync_api import sync_playwright
    tmp = tempfile.mkdtemp(prefix="wiki-sync-")
    may = K.MayChuThu([], api_prefix=api_prefix, env=env_may_chu({"WIKI_STORAGE_BACKEND": "json", "WIKI_JSON_FILE": os.path.join(tmp, "wiki.json")})).__enter__()
    try:
        url = may.goc + PATH
        with sync_playwright() as pw:
            try:
                br = pw.chromium.launch(channel=channel) if channel else pw.chromium.launch()
            except Exception as e:                           # Edge chưa cài: nói rõ, không lặng lẽ bỏ qua
                check(False, "mở được trình duyệt %s" % channel, str(e).splitlines()[0])
                return
            A = Page(br, url + start_a, "sync-A", viewport={"width": 1366, "height": 820})
            B = Page(br, url, "sync-B", viewport={"width": 1366, "height": 820})

            def dung(ly_do=""):
                """Dừng biến thể này sớm (phép SAI đã được ghi): đóng trang, gom lỗi console; biến thể sau vẫn chạy."""
                if ly_do:
                    print("    (dừng biến thể: %s)" % ly_do)
                A.close()
                B.close()
                br.close()

            wiki_reqs = []
            for P in (A, B):
                P.pg.on("request", lambda r: wiki_reqs.append(r.url[len(may.goc):].split("?")[0]) if "/wiki/" in r.url and r.url.startswith(may.goc) else None)
            # trước mọi thao tác: cả hai trang biết có máy chủ, đúng gốc API (lỗi gốc: apiBase "" → "không có máy chủ"; index.html không có cấu hình)
            probes = [(P, P.pg.evaluate(CONFIG_PROBE)) for P in (A, B)]
            ready = True
            for P, st in probes:
                where = ("…/" + start_a) if P is A and start_a else "…/personal-wiki/"
                ready &= check(st["cfg"] == api_prefix, "%s mở %s: trang nhận __WEBAPP_CONFIG__.apiBase = %r" % (P.name, where, api_prefix), st)
                ready &= check(st["has"] and st["base"] == api_prefix and st["available"], "%s: Wiki.api = {has: true, base: %r}, đồng bộ available" % (P.name, api_prefix), st)
            if not ready:
                A.go("#/settings")
                A.pg.wait_for_selector(SYNC_SECTION)
                print("    (Cài đặt → Đồng bộ ở A: %s)" % re.sub(r"\s+", " ", A.pg.locator(SYNC_SECTION).inner_text())[:160])
                return dung()
            st, hd, bk = _http("GET", may.api + "/wiki/backends")
            mongo = next((b for b in (bk or {}).get("backends", []) if b.get("id") == "mongo"), {}) if isinstance(bk, dict) else {}
            check(st == 200 and mongo.get("available") is False and "chưa cấu hình" in mongo.get("reason", ""),
                  "máy chủ thử không cấu hình MongoDB (MONGO_URI=\"\") — /wiki/backends không ping MongoDB thật trong .env", (st, mongo))
            # mở Cài đặt nhiều lần không dồn listener "online" của bảng đồng bộ (trước đây mỗi lần mở gắn thêm một, chỉ gỡ ở sự kiện online kế tiếp)
            A.pg.evaluate(ONLINE_HOOK_JS)
            for _ in range(3):
                A.go("#/settings")
                A.pg.wait_for_selector(SYNC_SECTION)
                A.go("#/notes")
            n_on = A.pg.evaluate("[window.__online.size, window.__offline.size]")
            check(n_on == [1, 1], "mở Cài đặt 3 lần: bảng đồng bộ giữ đúng 1 listener 'online' + 1 'offline' (không dồn theo số lần mở)", n_on)
            # new_note chỉ đạt khi CHÍNH ghi chú đó đã lưu đúng tiêu đề/nội dung (không còn dựa vào toast "Đã lưu" của ghi chú trước)
            if not (check(new_note(A, "Đồng bộ một", "nối tới [[Đồng bộ hai]]\n\nQ: Thủ đô của Pháp?\nA: Paris\n", ["sync"]), "A: tạo ghi chú 1")
                    and check(new_note(A, "Đồng bộ hai", "nội dung hai quokka", ["sync"]), "A: tạo ghi chú 2")):
                return dung("A chưa tạo được đủ 2 ghi chú — mọi phép đồng bộ phía sau dựa vào chúng")
            A.go("#/settings")
            A.pg.wait_for_selector("button:has-text('Tạo kho đồng bộ mới')")
            check("Đồng bộ giữa các thiết bị" in A.pg.locator(".settings").inner_text(), "Cài đặt có mục đồng bộ")
            A.pg.click("button:has-text('Tạo kho đồng bộ mới')")
            A.pg.click(".dlg .btn-primary")
            A.pg.wait_for_selector(".code-in")
            code = A.pg.input_value(".code-in")
            # máy chủ thử mặc định kho json → mã nối ghi rõ "json." (đổi WIKI_STORAGE_BACKEND về sau, mã cũ vẫn trỏ đúng kho)
            check(re.match(r"^json\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$", code) is not None, "tạo kho: nhận mã nối ghi rõ nơi lưu json.<kho>.<khoá>", code[:20] + "…")
            # W2 (việc 5): liên kết nối + mã QR trong hộp mã nối; liên kết luôn là địa chỉ THƯ MỤC (A ở biến thể 2 đang mở index.html?source=pwa)
            link = A.pg.input_value(".code-dlg .link-in")
            check(link == url + "#/join/" + code, "hộp mã nối có liên kết …/personal-wiki/#/join/<mã> (địa chỉ thư mục, không index.html, không ?source=pwa)", link[:90])
            qr = A.pg.evaluate("() => { const s = document.querySelector('.code-dlg .qr-box svg'); return s ? { paths: s.querySelectorAll('path').length, vb: s.getAttribute('viewBox'), w: Math.round(s.getBoundingClientRect().width) } : null; }")
            check(bool(qr) and qr["paths"] == 1 and qr["w"] >= 120, "hộp mã nối có mã QR của liên kết (SVG một đường, rộng %s px)" % (qr or {}).get("w"), qr)
            A.pg.set_viewport_size({"width": 320, "height": 640})
            A.pg.wait_for_timeout(250)
            r = A.pg.evaluate("() => { const m = document.querySelector('dialog[open]').getBoundingClientRect(), q = document.querySelector('.code-dlg .qr-box svg').getBoundingClientRect(); return [m.left, m.right, innerWidth, document.documentElement.scrollWidth, q.left, q.right]; }")
            check(r[0] >= -0.5 and r[1] <= r[2] + 0.5 and r[3] <= r[2] + 1 and r[4] >= r[0] and r[5] <= r[1],
                  "màn 320 px: hộp mã nối và mã QR nằm gọn trong bề ngang, trang không cuộn ngang", [round(x) for x in r])
            A.pg.set_viewport_size({"width": 1366, "height": 820})
            A.pg.click(".dlg [data-close]")
            A.pg.wait_for_function(SYNC_IDLE, timeout=20000)
            A.pg.wait_for_timeout(100)
            ch = A.pg.evaluate(CHIP_JS)
            check(bool(ch) and ch["kind"] == "ok" and not ch["hidden"] and "đồng bộ" in ch["text"].lower(), "A: chỉ báo ở thanh bên '%s' sau khi đồng bộ xong" % (ch or {}).get("text"), ch)
            want = api_prefix + "/wiki/"
            check(wiki_reqs and all(u.startswith(want) for u in wiki_reqs), "mọi yêu cầu đồng bộ của trang đi tới %s… (đúng API_PREFIX của máy chủ)" % want, sorted(set(wiki_reqs))[:6])
            ws = code.split(".")[1]
            key = code.split(".", 2)[2]
            api = may.api + "/wiki/" + ws
            st, hd, body = _http("GET", api + "/items?since=0", key)
            check(st == 200 and len(body["items"]) == 2 and body["more"] is False and "no-store" in hd.get("cache-control", ""), "máy chủ giữ đúng 2 bản ghi A đã gửi (thẻ chưa ôn không gửi), Cache-Control: no-store", (st, len(body["items"]) if isinstance(body, dict) else body))
            kinds = sorted({i["kind"] for i in body["items"]})
            check(kinds == ["note"], "bản ghi là kind=note (thẻ chưa ôn không cần gửi)", kinds)
            check(_http("GET", api + "/items?since=0")[0] == 401 and _http("GET", api + "/items?since=0", "sai-khoa")[0] == 401, "không khoá / sai khoá → 401")
            check(_http("GET", may.api + "/wiki/khongco/items?since=0", key)[0] in (401, 404), "kho không tồn tại bị từ chối")

            B.go("#/settings")
            B.pg.wait_for_selector("button:has-text('Nối vào kho có sẵn')")
            B.pg.click("button:has-text('Nối vào kho có sẵn')")
            B.pg.fill("#ff-code", code)
            B.pg.click(".dlg button[type=submit]")
            B.pg.wait_for_function(SYNC_IDLE, timeout=20000)
            B.go("#/notes")
            B.pg.wait_for_selector(".nrow")
            B.pg.wait_for_timeout(300)
            check(B.pg.locator(".nrow").count() == 2, "B nối kho: kéo về đủ 2 ghi chú")

            # W2 (việc 5): thiết bị C nối bằng LIÊN KẾT (như quét mã QR): hộp "Nối" điền sẵn, địa chỉ đã xoá mã, không tự nối — bấm Nối mới nối
            C = Page(br, link, "sync-C", viewport={"width": 1366, "height": 820})
            try:
                C.pg.wait_for_selector("#ff-code", timeout=8000)
                hop = True
            except Exception:
                hop = False
            sc = C.pg.evaluate("() => ({ hash: location.hash, href: location.href, val: (document.querySelector('#ff-code') || {}).value || '', configured: Wiki.sync.instance.state().configured })")
            check(hop and sc["val"] == code and sc["hash"] == "#/settings/sync" and code not in sc["href"] and not sc["configured"],
                  "C mở liên kết nối: hộp 'Nối' điền sẵn đúng mã, địa chỉ thành #/settings/sync (mã không nằm lại), CHƯA tự nối", {k: (v if k != "val" else v[:12] + "…") for k, v in sc.items()})
            if hop:
                C.pg.click(".dlg button[type=submit]")
                C.pg.wait_for_function(SYNC_IDLE, timeout=20000)
                C.go("#/notes")
                C.pg.wait_for_selector(".nrow")
                C.pg.wait_for_timeout(300)
                check(C.pg.locator(".nrow").count() == 2, "C bấm Nối: kéo về đủ 2 ghi chú (nối bằng liên kết)")
            C.close()

            if not open_row(B, "Đồng bộ một"):
                return dung("B không mở được ghi chú đã kéo về")
            B.pg.wait_for_selector(".ed-prev a.wl")
            try:                                             # bản xem trước vẽ lại sau ~debounce: cho nó một nhịp trước khi kết luận
                B.pg.wait_for_selector(".ed-prev a.wl:not(.ghost)", timeout=3000)
            except Exception:
                pass
            linked = B.pg.locator(".ed-prev a.wl:not(.ghost)").count() == 1
            check(linked, "B: liên kết [[Đồng bộ hai]] đã được giải",
                  "" if linked else "B: %s · máy chủ: %s" % (
                      json.dumps(B.pg.evaluate("() => Wiki.sync.instance && [...document.querySelectorAll('.nrow .nr-title')].map(e => e.textContent)"), ensure_ascii=False),
                      _tieu_de_may_chu(api, key)))
            B.pg.fill("#q", "")

            # B sửa → A nhận
            B.pg.fill(".ed-ta", B.pg.input_value(".ed-ta") + "\nB đã thêm zebraquartz\n")
            check(luu(B), "B: lưu bản sửa (trạng thái ✓ Đã lưu của chính lần lưu này)")
            B.pg.wait_for_function(SYNC_IDLE, timeout=20000)
            B.pg.evaluate("Wiki.sync.instance.now()")
            B.pg.wait_for_function(SYNC_IDLE, timeout=20000)
            A.pg.evaluate("Wiki.sync.instance.now()")
            A.pg.wait_for_function(SYNC_IDLE, timeout=20000)
            A.go("#/notes")
            A.pg.wait_for_selector(".nrow")
            A.pg.fill("#q", "zebraquartz")
            A.pg.wait_for_function("q => document.querySelector('.lp-count').dataset.q === q", arg="zebraquartz")
            check("1 kết quả" in A.pg.locator(".lp-count").inner_text(), "A tìm thấy dòng mà B vừa thêm (đồng bộ hai chiều + chỉ mục cập nhật)")
            A.pg.fill("#q", "")

            # B mất mạng → sửa → có mạng lại
            B.ctx.set_offline(True)
            B.pg.wait_for_timeout(300)
            B.go("#/notes")
            B.pg.wait_for_selector(".nrow")
            if not open_row(B, "Đồng bộ hai"):
                B.ctx.set_offline(False)
                return dung("B không mở được ghi chú để sửa khi offline")
            B.pg.wait_for_selector(".ed-ta")
            B.pg.fill(".ed-ta", "viết khi B offline quokka")
            check(luu(B), "B offline: lưu bản sửa vào máy")
            check(B.pg.evaluate("Wiki.sync.instance.state().phase") in ("offline", "idle", "error"), "B offline: vẫn lưu được, đồng bộ chờ")
            pend = B.pg.evaluate("Wiki.sync.instance.state().pending")
            B.ctx.set_offline(False)
            B.pg.evaluate("Wiki.sync.instance.now()")
            B.pg.wait_for_function(SYNC_IDLE, timeout=25000)
            st, hd, body = _http("GET", api + "/items?since=0", key)
            two = next(i for i in body["items"] if i["data"].get("title") == "Đồng bộ hai")
            check("viết khi B offline" in two["data"]["content"], "có mạng lại: bản sửa lúc offline lên máy chủ", two["data"]["content"][:40])

            # xoá ở A (thùng rác rồi xoá hẳn) → B xoá theo
            A.go("#/notes")
            A.pg.wait_for_selector(".nrow")
            if not open_row(A, "Đồng bộ một"):
                return dung("A không mở được ghi chú để xoá")
            A.pg.wait_for_selector(".ed .more")
            menu_click(A, "Chuyển vào thùng rác")
            A.pg.click(".dlg .btn-danger-solid")
            A.pg.wait_for_timeout(500)
            A.go("#/notes?status=trashed")
            A.pg.wait_for_selector(".nrow")
            A.pg.click(".nrow")
            A.pg.wait_for_selector(".ed-banner:not([hidden])")
            A.pg.click(".ed-banner button:has-text('Xoá hẳn')")
            A.pg.click(".dlg .btn-danger-solid")
            A.pg.wait_for_function(SYNC_IDLE, timeout=20000)
            A.pg.evaluate("Wiki.sync.instance.now()")
            A.pg.wait_for_function(SYNC_IDLE, timeout=20000)
            B.pg.evaluate("Wiki.sync.instance.now()")
            B.pg.wait_for_function(SYNC_IDLE, timeout=20000)
            B.go("#/notes")
            B.pg.wait_for_timeout(500)
            check(B.pg.locator(".nrow").count() == 1, "A xoá hẳn → B cũng mất ghi chú đó (tombstone)")
            st, hd, body = _http("GET", api + "/items?since=0", key)
            tomb = [i for i in body["items"] if i["deleted"]]
            check(len(tomb) == 1 and tomb[0]["data"] == {}, "máy chủ giữ tombstone, không giữ nội dung", tomb[:1])

            # ghi chú rất lớn (~1,2 MB UTF-8) vẫn đồng bộ được
            big = ("Tiếng Việt có dấu: ắ ằ ẳ ẵ ặ ế ề ể ễ ệ " * 25000)[:400000]
            A.go("#/notes")
            A.pg.evaluate("async (txt) => { const store = await Wiki.store.openBest('personal-wiki'); const repo = Wiki.repo.create(store); await repo.open(); await repo.save({ title: 'Ghi chú khổng lồ', content: txt }); }", big)
            A.pg.reload()
            A.pg.wait_for_function("document.body.classList.contains('ready')")
            A.pg.evaluate("Wiki.sync.instance.now()")
            A.pg.wait_for_function(SYNC_IDLE, timeout=30000)
            st, hd, body = _http("GET", api + "/items?since=0&limit=500", key)
            huge = [i for i in body["items"] if i["data"].get("title") == "Ghi chú khổng lồ"]
            check(len(huge) == 1 and len(huge[0]["data"]["content"]) == 400000, "ghi chú 400.000 ký tự (≈ 1 MB UTF-8) đồng bộ lên máy chủ nguyên vẹn")

            # ngắt + xoá kho
            A.go("#/settings")
            A.pg.wait_for_selector("button:has-text('Xoá kho trên máy chủ')")
            A.pg.click("button:has-text('Xoá kho trên máy chủ')")
            A.pg.click(".dlg .btn-danger-solid")
            A.pg.wait_for_selector("button:has-text('Tạo kho đồng bộ mới')", timeout=8000)
            check(_http("GET", api + "/items?since=0", key)[0] in (401, 404), "xoá kho: máy chủ không còn kho đó")
            A.go("#/notes")
            A.pg.wait_for_timeout(300)
            check(A.pg.locator(".nrow").count() >= 2, "sau khi xoá kho trên máy chủ, ghi chú trên máy A còn nguyên")
            B.pg.evaluate("Wiki.sync.instance.now()")
            B.pg.wait_for_function("Wiki.sync.instance.state().fatal === true", timeout=15000)
            # W2: lỗi dừng hẳn hiện NGOÀI Cài đặt (trước đây nhánh biểu ngữ 'sync' là mã chết — chỉ thấy lỗi khi tự mở Cài đặt)
            B.go("#/notes")
            B.pg.wait_for_timeout(150)
            bn = B.pg.evaluate(BANNER_JS)
            check(not bn["hidden"] and "Đồng bộ đã dừng" in bn["text"] and bn["sync"], "B đang ở danh sách: biểu ngữ 'Đồng bộ đã dừng …' có nút 'Mở Đồng bộ'", bn)
            ch = B.pg.evaluate(CHIP_JS)
            check(bool(ch) and ch["kind"] == "fatal" and ch["text"] == "Mất kho đồng bộ", "B: chỉ báo thanh bên 'Mất kho đồng bộ'", ch)
            if bn["sync"]:
                B.pg.click("#banner [data-bn=sync]")
            else:
                B.go("#/settings/sync")
            B.pg.wait_for_selector(SYNC_SECTION + " [data-sync=lost]", timeout=8000)
            check(B.hash() == "#/settings/sync" and B.pg.locator(SYNC_SECTION + " button:has-text('Nối lại bằng mã')").count() == 1,
                  "bấm 'Mở Đồng bộ' → #/settings/sync: thông điệp mất kho + nút 'Nối lại bằng mã…'", B.hash())
            check("nối lại" in B.pg.locator(".settings").inner_text(), "B được báo kho đã mất và cần nối lại (không lặp thử vô hạn)")
            A.close()
            B.close()
            br.close()
    finally:
        may.__exit__(None, None, None)
        import shutil
        shutil.rmtree(tmp, ignore_errors=True)


# ============================================================================================ tầng 5 — hiệu năng thật (IndexedDB)
GEN_JS = r"""
async (N) => {
  // PRNG có hạt giống → lần nào chạy cũng cùng dữ liệu
  let seed = 123456789; const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) % 1000000) / 1000000; };
  const syl = ["ba","ko","li","mu","ta","re","so","vin","han","qua","dre","fol","gen","hix","jur","lem","nox","pri","sed","tuv","wal","zor","bra","cle","dim","exo","fra","glo"];
  const vocab = []; const seen = new Set();
  while (vocab.length < 6000) { let w = ""; const n = 2 + Math.floor(rnd() * 2); for (let i = 0; i < n; i++) w += syl[Math.floor(rnd() * syl.length)]; if (!seen.has(w)) { seen.add(w); vocab.push(w); } }
  ["học","tập","ghi","chú","thuật","toán","dữ","liệu","kiến","trúc","đồ","thị","cơ","sở","mạng","lập","trình"].forEach((w, i) => vocab[i * 3 + 7] = w);
  const cum = []; let tot = 0; for (let r = 1; r <= vocab.length; r++) { tot += 1 / r; cum.push(tot); }
  const pick = () => { const x = rnd() * tot; let lo = 0, hi = cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < x) lo = m + 1; else hi = m; } return vocab[lo]; };
  const tags = Array.from({ length: 300 }, (_, i) => "tag" + i);
  const store = await Wiki.store.openBest("personal-wiki");
  const repo = Wiki.repo.create(store); await repo.open();
  const t0 = performance.now(); const now = Date.now();
  const list = [];
  for (let i = 0; i < N; i++) {
    const title = "Ghi chú " + i + " " + pick() + " " + pick();
    let body = "";
    for (let s = 0; s < 4; s++) { let sent = ""; for (let w = 0; w < 9 + Math.floor(rnd() * 6); w++) sent += pick() + " "; body += sent.trim() + ". "; }
    if (i % 20 === 0 && i > 40) body += " Xem [[Ghi chú " + Math.floor(rnd() * i) + " " + "]] ";
    if (i === 77777 % N) body += " cụm từ duy nhất zebra-quartz-nebula ";
    const tg = [tags[Math.floor(rnd() * tags.length)]]; if (rnd() < 0.4) tg.push(tags[Math.floor(rnd() * tags.length)]);
    list.push({ title, content: body, tags: tg, created_at: now - i * 1000, updated_at: now - i * 1000 });
  }
  let last = 0;
  await repo.bulkAdd(list, { onProgress: (p) => { last = p.done; } });
  return { ms: performance.now() - t0, added: last, size: repo.size(), top: vocab.slice(0, 3) };
}
"""

SEARCH_JS = r"""
async (q) => {
  const inp = document.querySelector('#q'); const t0 = performance.now();
  inp.value = q; inp.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((res, rej) => { const t1 = performance.now(); const iv = setInterval(() => { const c = document.querySelector('.lp-count'); if (c && c.dataset.q === q && /kết quả/.test(c.textContent)) { clearInterval(iv); res(); } else if (performance.now() - t1 > 20000) { clearInterval(iv); rej(new Error('quá 20 s')); } }, 4); });
  return { e2e: performance.now() - t0, text: document.querySelector('.lp-count').textContent };
}
"""


def tang_5(may, n):
    section("TẦNG 5 — hiệu năng thật: %s ghi chú trong IndexedDB của Chromium" % format(n, ","))
    from playwright.sync_api import sync_playwright
    url = may.goc + PATH
    with sync_playwright() as pw:
        br = pw.chromium.launch(args=["--enable-precise-memory-info", "--js-flags=--expose-gc"])
        P = Page(br, url, "perf", viewport={"width": 1366, "height": 820})
        pg = P.pg
        pg.set_default_timeout(0)
        t = time.time()
        r = pg.evaluate(GEN_JS, n)
        dt = time.time() - t
        print("    nạp %s ghi chú: %.1f s (%.0f ghi chú/s)" % (format(r["added"], ","), dt, r["added"] / max(0.001, dt)))
        check(r["added"] == n and r["size"] >= n, "bulkAdd nạp đủ %s ghi chú" % format(n, ","), r)
        top = r["top"]
        t = time.time()
        pg.reload(wait_until="load")
        pg.wait_for_function("document.body.classList.contains('ready')")
        boot = time.time() - t
        heap_raw = pg.evaluate("performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1")
        pg.evaluate("() => { if (window.gc) { window.gc(); window.gc(); } }")
        heap = pg.evaluate("performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1")
        print("    mở lại ứng dụng (khởi động nguội, đọc đầu %s note): %.2f s, JS heap %d MB (sau dọn rác; trước đó %d MB)" % (format(n, ","), boot, heap, heap_raw))
        check(boot < 5, "khởi động nguội với %s note < 5 s (đo %.2f s)" % (format(n, ","), boot))
        P.go("#/notes")
        pg.wait_for_selector(".nrow")
        cnt = pg.locator(".lp-count").inner_text()
        check(str(n) in re.sub(r"[^0-9]", "", cnt.split("ghi")[0]), "danh sách báo đúng số ghi chú", cnt)
        rows0 = pg.locator(".nrow").count()
        check(rows0 < 80, "cuộn ảo: chỉ dựng %d dòng DOM dù có %s ghi chú" % (rows0, format(n, ",")))
        t = time.time()
        pg.evaluate("document.querySelector('.lp-body').scrollTop = 76 * %d" % (n // 2))
        pg.wait_for_function("[...document.querySelectorAll('.nrow')].some(e => +e.getAttribute('aria-posinset') > %d)" % (n // 2 - 5))
        print("    cuộn tới giữa danh sách: %.0f ms" % ((time.time() - t) * 1000))
        pg.evaluate("document.querySelector('.lp-body').scrollTop = 0")
        queries = [("từ rất phổ biến", top[0]), ("từ phổ biến 2", top[1]), ("từ phổ biến 3", top[2]), ("tiền tố", top[0][:3]), ("từ có dấu", "thuật"), ("hai từ", "thuật toán"),
                   ("cụm từ duy nhất", "zebra-quartz-nebula"), ("tag", "tag17"), ("tag + từ", "tag17 thuật"), ("tiêu đề cụ thể", "Ghi chú %d" % (n // 3)), ("không có", "xyzkhongco")]
        res = []
        for label, q in queries:
            times = []
            txt = ""
            for rep in range(3):
                pg.evaluate("() => { document.querySelector('#q').value = ''; document.querySelector('#q').dispatchEvent(new Event('input', {bubbles: true})); }")
                pg.wait_for_timeout(300)
                r = pg.evaluate(SEARCH_JS, q)
                times.append(r["e2e"])
                txt = r["text"]
            res.append((label, q, times, txt))
            print("    %-18s %-26s lần đầu %6.0f ms · lần 2-3 %6.0f/%6.0f ms · %s" % (label, q, times[0], times[1], times[2], txt))
        worst = max(t_[0] for _, _, t_, _ in res)
        warm = max(max(t_[1:]) for _, _, t_, _ in res)
        check(worst < 1000, "tìm kiếm trên %s ghi chú: LẦN ĐẦU chậm nhất %.0f ms (< 1000 ms, gồm 130 ms debounce)" % (format(n, ","), worst))
        check(warm < 1000, "tìm kiếm: các lần sau chậm nhất %.0f ms (< 1000 ms)" % warm)
        uniq = next(x for x in res if x[1] == "zebra-quartz-nebula")
        check("1 kết quả" in uniq[3], "cụm từ duy nhất tìm đúng 1 ghi chú giữa %s" % format(n, ","), uniq[3])
        pg.evaluate("() => { document.querySelector('#q').value = ''; document.querySelector('#q').dispatchEvent(new Event('input', {bubbles: true})); }")
        pg.wait_for_timeout(400)
        t = time.time()
        ok = new_note(P, "Ghi chú mới giữa kho lớn", "nội dung thử độ trễ lưu với %s ghi chú" % format(n, ","), ["perf"])
        dt = (time.time() - t) * 1000
        print("    tạo + lưu một ghi chú mới giữa %s ghi chú: %.0f ms (gồm thao tác nhập của Playwright)" % (format(n, ","), dt))
        check(ok and dt < 3000, "lưu một ghi chú giữa kho lớn < 3 s (%.0f ms)" % dt)
        P.close()
        br.close()


def chay(ten, fn, *args):
    """Chạy một tầng/biến thể; ngoại lệ không lường trước (vd Playwright hết giờ chờ) thành một phép SAI có vết lỗi, thay vì làm main()
    dừng giữa chừng — các tầng/biến thể còn lại vẫn chạy và dòng tổng "N đạt, M sai" luôn được in."""
    try:
        fn(*args)
    except Exception as e:
        import traceback
        vet = ["%s:%d" % (f.name, f.lineno) for f in traceback.extract_tb(e.__traceback__) if os.path.basename(f.filename) == os.path.basename(__file__)]
        check(False, "%s chạy hết không ném ngoại lệ" % ten, "%s: %s · tại %s" % (type(e).__name__, (str(e).splitlines() or [""])[0][:300], " ← ".join(reversed(vet[-4:]))))


def main():
    args = sys.argv[1:]
    todo = set(a for a in args if a.startswith("--"))
    tat_ca = "--tat-ca" in todo
    default = not todo
    if tat_ca or default or "--tinh" in todo:
        tang_1()
    if HOAN_NGUYEN:
        print("!! PW_HOAN_NGUYEN=%s — kiểm đột biến: một bản sửa bị gỡ tạm, phép kiểm mới PHẢI đỏ" % HOAN_NGUYEN)
        if HOAN_NGUYEN not in ("may-chu", "may-khach", "tieu-de", "dem-moi-phim", "bieu-ngu-chet", "noi-cung-the"):
            raise SystemExit("PW_HOAN_NGUYEN chỉ nhận may-chu, may-khach, tieu-de, dem-moi-phim, bieu-ngu-chet hoặc noi-cung-the")
    needs_server = tat_ca or default or todo & {"--chuc-nang", "--song-sot", "--co-gian", "--hieu-nang"}
    if needs_server:
        may = K.MayChuThu([], env=env_may_chu()).__enter__()
        try:
            if tat_ca or default or "--chuc-nang" in todo:
                chay("tầng 2", tang_2, may)
            if "--song-sot" in todo or tat_ca:
                chay("tầng 3", tang_3, may)
            if "--co-gian" in todo or tat_ca:
                chay("tầng 4", tang_4, may)
            if "--hieu-nang" in todo or tat_ca:
                chay("tầng 5", tang_5, may, next((int(a) for a in args if a.isdigit()), 100000))
        finally:
            may.__exit__(None, None, None)
    if "--dong-bo" in todo or tat_ca:
        for prefix, start, channel, nhan in BIEN_THE_6:
            chay("tầng 6 (%s)" % nhan.split(" — ")[0], tang_6, prefix, start, channel, nhan)
    print("\n%d đạt, %d sai" % (OK, FAIL))
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
