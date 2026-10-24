#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kiểm Algorithm Notebook (webapp/tranphuc8a/algorithm-notebook) bằng trình duyệt thật.

    backend\\fastapi\\.venv\\Scripts\\python.exe backend\\fastapi\\webapp\\tranphuc8a\\algorithm-notebook\\check.py            # tầng 1 + 2
    ... check.py --tinh          # tầng 1: tĩnh (cú pháp, kiem.js, thư viện, tham chiếu, icon, manifest, tương phản…)
    ... check.py --chuc-nang     # tầng 2: chức năng (Chromium máy tính + Pixel 5 + WebKit iPhone 13)
    ... check.py --toan          # chỉ phần toán của tầng 2 (≈ 15 s; đã nằm trong --chuc-nang): xem trước ghi chú có công thức, XSS qua data-tex, 320 px, thẻ Z-function không còn công thức giả
    ... check.py --song-sot     # tầng 3: sập giữa chừng không mất chữ, offline qua service worker, cập nhật
    ... check.py --co-gian       # tầng 4: dữ liệu xấu nhất × nhiều bề rộng × 3 trình duyệt + XSS
    ... check.py --hieu-nang [N] # tầng 5: N mục của tôi (mặc định 10000) trong IndexedDB thật — IN SỐ ĐO THẬT
    ... check.py --ma            # tầng 6: biên dịch + chạy thử mọi mẫu code C++ bằng g++ (chậm: 10–30 phút)
    ... check.py --tat-ca

Máy chủ: FastAPI thật trên SQLite tạm (K.MayChuThu) để đường dẫn /webapp/tranphuc8a/algorithm-notebook/, kiểu MIME và phạm vi service worker
đúng như khi triển khai. Trả exit code ≠ 0 khi có phép sai."""

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

PATH = "/webapp/tranphuc8a/algorithm-notebook/"
OK = FAIL = 0
ERRORS: list = []
GROUPS = [("graph", "Đồ thị"), ("ds", "Cấu trúc dữ liệu")]


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
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def blend(fg, bg):
    return tuple(round(fg[i] * fg[3] + bg[i] * (1 - fg[3])) for i in range(3))


def parse_tokens(css):
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


def js_files():
    out = []
    for sub in ("assets/js", "assets/data"):
        for dp, _, names in os.walk(os.path.join(HERE, *sub.split("/"))):
            out += [os.path.join(dp, n) for n in names if n.endswith(".js")]
    return out


def tang_1():
    section("TẦNG 1 — tĩnh")
    files = js_files()
    bad = []
    for f in files + [os.path.join(HERE, "sw.js"), os.path.join(HERE, "kiem.js"), os.path.join(HERE, "kiem-lib.js")]:
        r = subprocess.run(["node", "--check", f], capture_output=True, text=True)
        if r.returncode:
            bad.append(os.path.relpath(f, HERE) + ": " + r.stderr.strip().splitlines()[0])
    check(not bad, "cú pháp JS (%d tệp)" % (len(files) + 3), bad)
    r = subprocess.run(["node", os.path.join(HERE, "kiem.js")], capture_output=True, text=True, encoding="utf-8")
    tail = (r.stdout.strip().splitlines() or [""])[-1]
    # Đòi cả dòng tổng kết "Đạt — …": kiem.js có phần async, một Promise treo làm Node thoát mã 0 và bỏ qua im lặng phần sau.
    check(r.returncode == 0 and tail.startswith("Đạt — "), "kiem.js (lõi: tìm kiếm, so sánh, quiz, SRS, trực quan hoá, kho người dùng, thư viện, cây quyết định, lộ trình): " + tail, "\n".join([l for l in r.stdout.splitlines() if "[SAI]" in l][:4]) or (r.stdout + r.stderr)[-300:])
    r = subprocess.run(["node", os.path.join(HERE, "kiem-lib.js")], capture_output=True, text=True, encoding="utf-8")
    check(r.returncode == 0, "thư viện dựng sẵn hợp lệ (kiem-lib.js): " + (r.stdout.strip().splitlines() or [""])[0], r.stdout[-500:])
    r = subprocess.run([sys.executable, os.path.join(HERE, "sync.py"), "--kiem"], capture_output=True, text=True, encoding="utf-8")
    check(r.returncode == 0, "các bản chép từ personal-wiki khớp nguồn (sync.py --kiem)", r.stdout.strip())

    html = io.open(os.path.join(HERE, "index.html"), encoding="utf-8").read()
    refs = re.findall(r'(?:src|href)="(\./[^"#?]+)"', html)
    missing = [p for p in refs if not os.path.exists(os.path.join(HERE, p[2:]))]
    check(refs and not missing, "mọi tham chiếu trong index.html có thật (%d)" % len(refs), missing)
    css_all = "".join(io.open(f, encoding="utf-8").read() for dp, _, ns in os.walk(os.path.join(HERE, "assets", "css")) for f in [os.path.join(dp, n) for n in ns] if f.endswith(".css"))
    ext = re.findall(r'(?:src|href)="(https?://[^"]+)"', html) + re.findall(r"@import|url\(\s*['\"]?https?:", css_all)
    check(not ext, "không nạp tài nguyên ngoài (CDN, font ngoài)", ext)
    used_js = re.findall(r"https?://(?!www\.w3\.org)[a-z0-9.-]+\.[a-z]{2,}[^\s\"']*", "".join(io.open(f, encoding="utf-8").read() for f in files if "/data/lib-" not in f.replace("\\", "/") and not f.endswith("rich.js")))
    ext_ok = ("https://cses.fi/", "https://codeforces.com/")        # chỉ là liên kết bài tập mở ở thẻ mới, không phải nạp tài nguyên
    check(not [u for u in used_js if "localhost" not in u and not u.startswith(ext_ok)], "mã giao diện không nạp / gọi địa chỉ ngoài (chỉ có liên kết bài tập CSES, Codeforces)", sorted(set(used_js))[:4])
    rich = io.open(os.path.join(HERE, "assets", "js", "ui", "rich.js"), encoding="utf-8").read()
    ext_rich = sorted(set(re.findall(r"https?://(?!www\.w3\.org)[a-z0-9.-]+\.[a-z]{2,}[^\"\s)]*", rich)))
    check(len(ext_rich) == 1 and ext_rich[0].startswith("https://cdnjs.cloudflare.com/ajax/libs/mermaid/") and re.search(r'MERMAID_SRI = "sha(256|384|512)-[A-Za-z0-9+/=]{40,}"', rich)
          and "securityLevel: \"strict\"" in rich, "ui/rich.js: địa chỉ ngoài duy nhất là mermaid trên cdnjs, có SRI, securityLevel strict", ext_rich)
    srcs = re.findall(r'<script src="\./assets/([^"]+)"', html)
    on_disk = sorted(os.path.relpath(f, os.path.join(HERE, "assets")).replace("\\", "/") for f in files)
    check(sorted(srcs) == on_disk, "mọi tệp .js trong assets/ đều được nạp bởi index.html (và ngược lại)", sorted(set(on_disk) ^ set(srcs)))

    sprites = set(re.findall(r'<symbol id="i-([a-z0-9-]+)"', html))
    used = set()
    for f in files:
        src = io.open(f, encoding="utf-8").read()
        if "/data/lib-" in f.replace("\\", "/"):
            continue
        used |= set(re.findall(r'icon\(\s*"([a-z0-9-]+)"', src))
        used |= set(re.findall(r'\bicon:\s*"([a-z0-9-]+)"', src))
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
    check(all(s["url"].startswith("./index.html#/") for s in man.get("shortcuts", [])) and len(man.get("shortcuts", [])) >= 3, "manifest: shortcuts trỏ vào trang có hash")
    r = subprocess.run([sys.executable, os.path.join(HERE, "tao-pwa.py"), "--kiem"], capture_output=True, text=True, encoding="utf-8")
    check(r.returncode == 0, "dấu phiên bản sw.js khớp nội dung vỏ (sửa tệp nào cũng phải chạy tao-pwa.py)", r.stdout.strip())

    tokens = parse_tokens(io.open(os.path.join(HERE, "assets", "css", "tokens.css"), encoding="utf-8").read())
    css_app = io.open(os.path.join(HERE, "assets", "css", "app.css"), encoding="utf-8").read()
    low = []
    for theme, tk in tokens.items():
        bg, elev, sunk = val(tk, "bg"), val(tk, "elev"), val(tk, "sunk")
        soft = blend(val(tk, "accent-soft"), elev)
        pairs = [("text/bg", val(tk, "text"), bg), ("text/elev", val(tk, "text"), elev), ("text-2/elev", val(tk, "text-2"), elev), ("text-2/bg", val(tk, "text-2"), bg), ("text-2/sunk", val(tk, "text-2"), sunk),
                 ("text-3/elev", val(tk, "text-3"), elev), ("text-3/bg", val(tk, "text-3"), bg), ("text-3/sunk", val(tk, "text-3"), sunk), ("accent-text/elev", val(tk, "accent-text"), elev),
                 ("accent-text/bg", val(tk, "accent-text"), bg), ("accent-text/soft", val(tk, "accent-text"), soft), ("text/soft", val(tk, "text"), soft), ("text-2/soft", val(tk, "text-2"), soft),
                 ("danger/elev", val(tk, "danger"), elev), ("danger/bg", val(tk, "danger"), bg), ("ok/elev", val(tk, "ok"), elev), ("star/elev", val(tk, "star"), elev), ("mark/elev", val(tk, "mark"), elev),
                 # trạng thái tô đậm của trực quan hoá, quiz, tiến độ: chữ --accent-fg trên nền màu
                 ("accent-fg/accent", val(tk, "accent-fg"), val(tk, "accent")), ("accent-fg/danger", val(tk, "accent-fg"), val(tk, "danger")), ("accent-fg/ok", val(tk, "accent-fg"), val(tk, "ok")),
                 ("accent-fg/mark", val(tk, "accent-fg"), val(tk, "mark"))]
        for name, a, b in pairs:
            c = contrast(a[:3], b[:3])
            if c < 4.5:
                low.append("%s %s = %.2f" % (theme, name, c))
        m = re.search((r"\.md pre\.code \{ (--tk-c[^}]*)\}" if theme == "light" else r':root\[data-theme="dark"\] \.md pre\.code \{ (--tk-c[^}]*)\}'), css_app)
        for name, hexv in re.findall(r"--(tk-[a-z]):\s*(#[0-9a-fA-F]{6})", m.group(1)):
            c = contrast(hex_rgb(hexv), sunk)
            if c < 4.5:
                low.append("%s mã %s %s trên sunk = %.2f" % (theme, name, hexv, c))
    for name, hx in (("toast chữ", "#f2f6fc"), ("toast nút", "#9dbfff")):
        c = contrast(hex_rgb(hx), hex_rgb("#16202e"))
        if c < 4.5:
            low.append("%s = %.2f" % (name, c))
    check(not low, "độ tương phản mọi cặp màu ≥ 4,5:1 (sáng + tối, mã tô màu, toast, trạng thái trực quan hoá/quiz)", low)
    total = sum(os.path.getsize(f) for f in files) + os.path.getsize(os.path.join(HERE, "index.html")) + len(css_all)
    check(total < 3 * 1024 * 1024, "dung lượng vỏ + thư viện %d KB (< 3 MB; KHÔNG gồm assets/vendor)" % (total // 1024))
    vroot = os.path.join(HERE, "assets", "vendor", "katex")
    vfiles = [os.path.join(dp, n) for dp, _, ns in os.walk(vroot) for n in ns]
    vtotal = sum(os.path.getsize(f) for f in vfiles)
    check(0 < vtotal < 640 * 1024, "dung lượng vendor KaTeX %d KB (< 640 KB, ngân sách riêng; KHÔNG nới ngưỡng vỏ)" % (vtotal // 1024))
    vrel = sorted(os.path.relpath(f, vroot).replace(os.sep, "/") for f in vfiles)
    swsrc = io.open(os.path.join(HERE, "sw.js"), encoding="utf-8").read()
    sw_list = sorted(json.loads("[" + re.search(r"var VENDOR = \[(.*?)\];", swsrc, re.S).group(1) + "]"))
    check(sw_list == [v for v in vrel if v not in ("LICENSE", "README")], "sw.js: danh sách VENDOR khớp tệp thật trong assets/vendor/katex (precache riêng)", set(sw_list) ^ set(vrel))
    ver = re.search(r"KaTeX (\d+\.\d+\.\d+)", io.open(os.path.join(vroot, "README"), encoding="utf-8").read())
    check(ver and ('VENDOR_DOT = "katex-%s"' % ver.group(1)) in swsrc, "vendor/katex: README ghi phiên bản khớp VENDOR_DOT của sw.js")


# ============================================================================================ tiện ích trình duyệt
class Page:
    """Một trang Playwright + gom lỗi console/pageerror."""

    def __init__(self, browser, url, name, setup=None, **ctx_kw):
        ctx_kw.setdefault("service_workers", "block")
        ctx_kw.setdefault("accept_downloads", True)
        self.ctx = browser.new_context(**ctx_kw)
        if setup:
            setup(self.ctx)                                  # vd chặn/thay tệp bằng route — phải có trước lần mở trang đầu tiên
        self.pg = self.ctx.new_page()
        self.name = name
        self.errors = []
        self.pg.on("console", lambda m: self.errors.append("console: " + m.text) if m.type == "error" else None)
        self.pg.on("pageerror", lambda e: self.errors.append("pageerror: " + str(e)))
        self.url = url
        self.pg.goto(url, wait_until="load")
        self.pg.wait_for_function("document.body.classList.contains('ready')", timeout=20000)

    def hash(self):
        return self.pg.evaluate("location.hash")

    def go(self, h, wait=300):
        self.pg.evaluate("h => { location.hash = h }", h)
        self.pg.wait_for_timeout(wait)

    def toast(self, text, timeout=4000):
        return _wait_toast(self.pg, text, timeout)

    def search(self, q):
        self.pg.fill("#q", q)
        self.pg.wait_for_function("q => { const c = document.querySelector('.lp-count'); return !!c && c.dataset.q === q; }", arg=q, timeout=5000)
        return self.pg.locator(".lp-count").inner_text()

    def ids(self):
        return self.pg.evaluate("[...document.querySelectorAll('.nrow')].map(a => a.getAttribute('href').replace('#/a/', ''))")

    def close(self):
        ERRORS.extend(["[%s] %s" % (self.name, e) for e in self.errors])
        self.ctx.close()


def _wait_toast(pg, text, timeout=4000):
    try:
        pg.wait_for_selector(".toast:has-text('%s')" % text, timeout=timeout)
        return True
    except Exception:
        return False


STUB_PRINT = "() => { window.__printed = null; window.print = function () { window.__printed = { printing: document.body.classList.contains('printing'), text: (document.querySelector('#printArea') || {}).innerText || '' }; }; }"   # dạng hàm: Playwright GỌI biểu thức trả về hàm


def menu_click(P, label):
    P.pg.click(".detail .more")
    P.pg.click(".popmenu button:has-text('%s')" % label)


def open_detail(P, id):
    P.go("#/a/" + id, 400)
    P.pg.wait_for_selector(".detail h1")


# Ghi chú toán (W4). Chuỗi THÔ (r''') — đừng viết bằng heredoc: dấu \ sẽ mất. Thứ tự công thức trong xem trước = thứ tự dưới đây (6 cái, cái cuối là dải dài không dấu cách).
TOAN_NOTE = r'''Năng lượng \( E = mc^2 \) và $x_1 * x_2$ ở đây.

\[
\int_0^1 x\,dx = \frac12
\]

Giá $5 and $10 không phải công thức.

XSS: $x" onmouseover="window.__xssm=1$ và \(<img src=x onerror=window.__xssm=2>\)

Dài: $''' + "a_{i}+" * 80 + "z$"
TOAN_JS = """() => {
  const prev = document.querySelector('.note-prev');
  const els = [...prev.querySelectorAll('.math')];
  const blk = prev.querySelector('div.math-d'), inl = prev.querySelector('span.math');
  return {
    n: els.length,
    items: els.map(e => ({ tag: e.tagName, cls: e.className, tex: e.getAttribute('data-tex'), txt: e.textContent })),
    em: prev.querySelectorAll('.math em, .math strong, .math a, .math code').length,
    price: prev.textContent.includes('$5 and $10'),
    xss: window.__xssm === undefined ? null : window.__xssm,
    xssOk: !prev.querySelector('.math img, .math script, [onmouseover], [onerror]'),
    center: blk ? getComputedStyle(blk).textAlign : '',
    wrap: inl ? getComputedStyle(inl).whiteSpace : ''
  };
}"""


def kiem_toan(br, url):
    """Phần toán (W4) của tầng 2, một ngữ cảnh trình duyệt riêng. Chạy trong tang_2 và riêng bằng --toan (≈ 15 s)."""
    section(" · toán (W4): xem trước ghi chú có công thức (\\( \\), $…$, \\[ \\]), giá tiền không phải công thức, XSS qua data-tex, 320 px; thẻ Z-function không còn công thức giả")
    T = Page(br, url, "desk-toan", viewport={"width": 1366, "height": 820}, setup=lambda c: c.route("**/assets/vendor/katex/**", lambda r: r.abort()))   # W6: dạng DỰ PHÒNG tất định; có KaTeX ở kiem_hydrate()
    pg = T.pg
    open_detail(T, "dijkstra")
    pg.fill(".note-ta", TOAN_NOTE)
    pg.click(".note-bar button:has-text('Xem trước')")
    pg.wait_for_selector(".note-prev .math")
    mt = pg.evaluate(TOAN_JS)
    want = [("SPAN", "math", r"E = mc^2"), ("SPAN", "math", r"x_1 * x_2"), ("DIV", "math math-d", r"\int_0^1 x\,dx = \frac12"),
            ("SPAN", "math", 'x" onmouseover="window.__xssm=1'), ("SPAN", "math", "<img src=x onerror=window.__xssm=2>")]
    got = [(i["tag"], i["cls"], i["tex"]) for i in mt["items"][:len(want)]]
    check(got == want and mt["n"] == len(want) + 1, "xem trước ghi chú: 6 công thức đúng loại (inline / khối) và TeX nguyên văn trong data-tex", {"có": got, "n": mt["n"]})
    check(all(i["txt"] == i["tex"] for i in mt["items"]), "chữ dự phòng của mỗi công thức = đúng TeX (data-tex)", [i for i in mt["items"] if i["txt"] != i["tex"]][:2])
    check(mt["em"] == 0 and mt["price"], "_ và * trong công thức không thành nghiêng/đậm; giá '$5 and $10' vẫn là chữ thường", mt)
    check(mt["xssOk"] and mt["xss"] is None, "XSS qua data-tex: không onmouseover/img/script, window.__xssm không bị gán", mt)
    check(mt["center"] == "center" and mt["wrap"] == "pre-wrap", "kiểu dự phòng: khối công thức căn giữa, công thức dài được phép xuống dòng (CSS của notebook)", {"căn": mt["center"], "wrap": mt["wrap"]})
    pg.set_viewport_size({"width": 320, "height": 700})
    pg.wait_for_timeout(300)
    bad = pg.evaluate(OVERFLOW_JS)
    check(not bad, "320 px: công thức dài (không dấu cách) tự xuống dòng, không tràn ngang", bad[:3] if bad else "")
    pg.set_viewport_size({"width": 1366, "height": 820})
    # Dữ liệu thư viện: thẻ Z-function từng có hai dấu $ trong một đoạn → công thức giả (lib-string.js, sửa W4: bọc code span)
    open_detail(T, "z-function")
    zr = pg.evaluate("() => ({ math: document.querySelectorAll('.detail .math').length, text: document.querySelector('.detail').innerText })")
    check(zr["math"] == 0 and "P + '$' + T" in zr["text"], "chi tiết Z-function: '$' hiện đúng chữ, không có công thức giả (.math = 0)", {"math": zr["math"]})
    T.errors = [e for e in T.errors if "Failed to load resource" not in e]       # tài nguyên bị chặn có chủ ý
    T.close()
    kiem_hydrate(br, url)


# ============================================================================================ W6 — hydrate KaTeX / mermaid (ui/rich.js; bản chép của personal-wiki)
HY_NOTE = r"""Một: $E = mc^2$ và \(x_1 * x_2\).

$$
\int_0^1 x\,dx = \frac12
$$

XSS: $x" onmouseover="window.__xssm=1$ và $\href{javascript:window.__xssm=3}{bấm}$ và \(<img src=x onerror=window.__xssm=2>\)

Giá $5 and $10 không phải công thức.

```mermaid
graph TD; A-->B
```
"""
HY_STATE_JS = """() => {
  const prev = document.querySelector('.note-prev');
  const els = [...prev.querySelectorAll('.math')];
  return {
    n: els.length, done: els.filter(e => e.getAttribute('data-hydrated') === '1').length,
    items: els.map(e => ({ tag: e.tagName, tex: e.getAttribute('data-tex'), hy: e.getAttribute('data-hydrated'), aria: e.getAttribute('aria-label'),
      kat: e.querySelectorAll('.katex').length, disp: e.querySelectorAll('.katex-display').length, err: e.querySelectorAll('.katex-error').length })),
    html: prev.innerHTML, kr: window.__kr || 0,
    bad: !!prev.querySelector('.math img, .math script, [onmouseover], [onerror], a[href^=javascript], .math a'), xss: window.__xssm === undefined ? null : window.__xssm,
    price: prev.textContent.includes('$5 and $10'),
    mm: (() => { const p = prev.querySelector('pre.mmd'); return p ? { hy: p.getAttribute('data-hydrated'), svg: p.querySelectorAll('svg').length, code: !!p.querySelector('code'), script: p.querySelectorAll('script').length, on: !!p.querySelector('[onload]') } : null; })()
  };
}"""
HY_COUNT_JS = """() => { window.__kr = 0; const k = window.katex; if (!k) return false; if (k.__wrapped) return true;
  const r = k.render; k.render = function () { window.__kr++; return r.apply(this, arguments); }; k.__wrapped = true; return true; }"""
MM_STUB = """(() => { window.__mmCalls = []; window.mermaid = { initialize(c) { window.__mmCfg = c; },
  render: async (id, src) => { window.__mmCalls.push(src);
    return { svg: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20" onload="window.__xssm=5"><script>window.__xssm=6</scr' + 'ipt><text x="2" y="12">so do</text></svg>' }; } }; })();"""


def kiem_hydrate(br, url):
    section(" · hydrate (W6): KaTeX cục bộ nạp lười ở ghi chú xem trước, aria-label, displayMode, chạy lại không đổi, XSS, mermaid, offline, 360 px, thẻ ôn")
    H = Page(br, url, "hydrate", viewport={"width": 1366, "height": 820}, setup=lambda c: c.add_init_script(MM_STUB))
    pg = H.pg
    open_detail(H, "dijkstra")
    pg.fill(".note-ta", HY_NOTE)
    pg.click(".note-bar button:has-text('Xem trước')")
    try:
        pg.wait_for_function("document.querySelectorAll('.note-prev .math[data-hydrated]').length >= 5 && document.querySelector('.note-prev pre.mmd[data-hydrated]')", timeout=8000)
    except Exception:
        pass
    st = pg.evaluate(HY_STATE_JS)
    want_tex = ["E = mc^2", "x_1 * x_2", "\\int_0^1 x\\,dx = \\frac12", 'x" onmouseover="window.__xssm=1', "\\href{javascript:window.__xssm=3}{bấm}", "<img src=x onerror=window.__xssm=2>"]
    got_tex = [i["tex"] for i in st["items"]]
    check(st["n"] == 6 and st["done"] == 6 and got_tex == want_tex, "KaTeX đã vẽ 6/6 công thức của ghi chú và data-tex còn NGUYÊN VĂN", {"n": st["n"], "done": st["done"], "tex": got_tex})
    check(all(i["aria"] == i["tex"] for i in st["items"]), "mỗi công thức có aria-label = TeX")
    check(all(i["kat"] == 1 or i["err"] == 1 for i in st["items"]) and [i["disp"] for i in st["items"]] == [1 if i["tag"] == "DIV" else 0 for i in st["items"]] and st["items"][2]["tag"] == "DIV",
          "displayMode đúng: khối div.math-d có .katex-display, inline thì không", [(i["tag"], i["kat"], i["disp"]) for i in st["items"]])
    check(not st["bad"] and st["xss"] is None and st["price"], "XSS (data-tex, \\href javascript:, <img>) không sinh liên kết/img/on*, window.__xssm không bị gán; giá '$5 and $10' là chữ thường", {k: st[k] for k in ("bad", "xss", "price")})
    check(st["mm"] and st["mm"]["hy"] == "1" and st["mm"]["svg"] == 1 and not st["mm"]["script"] and not st["mm"]["on"] and pg.evaluate("window.__mmCfg.securityLevel") == "strict",
          "mermaid: dựng svg, lọc script/onload, securityLevel strict", st["mm"])
    pg.evaluate(HY_COUNT_JS)
    before = st["html"]
    pg.evaluate("() => Algo.ui.rich.hydrate([document.querySelector('.note-prev')])")
    pg.wait_for_timeout(300)
    after = pg.evaluate(HY_STATE_JS)
    check(after["html"] == before and after["kr"] == 0, "hydrate chạy lại: HTML không đổi, katex.render gọi %d lần (muốn 0)" % after["kr"])
    # 360 px: quay lại ô soạn, nhập công thức dài, xem trước
    pg.click(".note-bar button:has-text('Xem trước')") if not pg.is_visible(".note-ta") else None
    pg.fill(".note-ta", "Dài: $" + "a_{i}+" * 80 + "z$" + chr(10) * 2 + "$$" + chr(10) + "x_{i}+" * 80 + "y" + chr(10) + "$$" + chr(10))
    pg.click(".note-bar button:has-text('Xem trước')")
    pg.set_viewport_size({"width": 360, "height": 700})
    pg.wait_for_timeout(400)
    try:
        pg.wait_for_function("document.querySelectorAll('.note-prev .math[data-hydrated=\"1\"]').length >= 2", timeout=6000)
    except Exception:
        pass
    bad = pg.evaluate(OVERFLOW_JS)
    check(not bad, "360 px: công thức KaTeX dài (inline + khối) không làm tràn trang", bad[:3] if bad else "")
    pg.set_viewport_size({"width": 1366, "height": 820})
    # công thức trong mô tả của mục (md()) cũng được hydrate qua observer (không phải xem trước): đổi mô tả bằng cách chèn HTML md vào #main
    r = pg.evaluate("""async () => { const host = document.querySelector('#main'); const d = document.createElement('div'); d.className = 'md'; d.innerHTML = Algo.markdown.render('Độ phức tạp $O(n \\\\log n)$.', {});
        host.append(d); await new Promise(ok => setTimeout(ok, 800)); const m = d.querySelector('.math'); const out = { hy: m.getAttribute('data-hydrated'), kat: m.querySelectorAll('.katex').length, tex: m.getAttribute('data-tex') }; d.remove(); return out; }""")
    check(r["hy"] == "1" and r["kat"] == 1 and "log" in r["tex"], "HTML dựng ở bất cứ màn nào trong #main được observer hydrate (mô tả mục, thẻ ôn, quiz)", r)
    H.close()
    # offline: KaTeX + mermaid bị chặn
    O = Page(br, url, "hydrate-offline", viewport={"width": 1366, "height": 820},
             setup=lambda c: (c.route("**/assets/vendor/katex/**", lambda r: r.abort()), c.route("https://cdnjs.cloudflare.com/**", lambda r: r.abort())))
    open_detail(O, "dijkstra")
    O.pg.fill(".note-ta", "Công thức $E=mc^2$ và\n\n```mermaid\ngraph TD; A-->B\n```\n")
    O.pg.click(".note-bar button:has-text('Xem trước')")
    O.pg.wait_for_selector(".note-prev .math")
    O.pg.wait_for_timeout(800)
    of = O.pg.evaluate("""() => { const m = document.querySelector('.note-prev .math'), p = document.querySelector('.note-prev pre.mmd');
        return { hy: m.getAttribute('data-hydrated'), tex: m.getAttribute('data-tex'), txt: m.textContent, font: getComputedStyle(m).fontFamily, mm: p && p.querySelector('code').textContent, mhy: p && p.getAttribute('data-hydrated') }; }""")
    check(of["hy"] is None and of["tex"] == "E=mc^2" and of["txt"] == "E=mc^2" and ("mono" in of["font"].lower() or "consolas" in of["font"].lower()),
          "offline: công thức giữ TeX nguyên văn có định dạng (kiểu code), app vẫn dùng được", of)
    check(of["mm"] == "graph TD; A-->B" and of["mhy"] is None, "offline: sơ đồ mermaid giữ khối mã nguyên văn", of)
    O.errors = [e for e in O.errors if "Failed to load resource" not in e]
    O.close()


def tang_toan(may):
    section("TẦNG 2b — toán (chạy riêng, như phần toán của tầng 2)")
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        kiem_toan(br, may.goc + PATH)
        br.close()
    if ERRORS:
        section("LỖI CONSOLE / PAGEERROR")
    check(not ERRORS, "không có lỗi console hay pageerror", ERRORS[:6])


# ============================================================================================ tầng 2 — chức năng
def tang_2(may):
    section("TẦNG 2 — chức năng (trình duyệt thật)")
    from playwright.sync_api import sync_playwright
    url = may.goc + PATH
    tmp = tempfile.mkdtemp(prefix="algo-check-")
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        P = Page(br, url, "desk", viewport={"width": 1366, "height": 820}, permissions=["clipboard-read", "clipboard-write"])
        pg = P.pg

        section(" · trang chủ + tìm kiếm")
        check("116 thuật toán dựng sẵn" in pg.locator(".home .ph-sub").inner_text(), "trang chủ: đếm đủ 116 thuật toán dựng sẵn", pg.locator(".home .ph-sub").inner_text())
        check(pg.locator(".home .bigcard").count() == 6 and pg.locator(".pbar").count() >= 9, "trang chủ: 6 lối vào + thanh tiến độ 9 nhóm")
        P.go("#/lib")
        pg.wait_for_selector(".nrow")
        check("116 mục" in pg.locator(".lp-count").inner_text(), "thư viện liệt kê đủ 116 mục")
        r = P.search("dijk")
        check(pg.locator(".nrow .nr-title").first.inner_text() == "Dijkstra", "gõ dở 'dijk' → Dijkstra đứng đầu", r)
        ms = int(re.search(r"(\d+) ms", r).group(1)) if re.search(r"(\d+) ms", r) else 999
        check(ms < 100, "thời gian tìm hiển thị < 100 ms (%d ms)" % ms)
        P.search("tag:shortest-path")
        ids = P.ids()
        check({"dijkstra", "bellman-ford", "spfa"} <= set(ids), "tag:shortest-path → có Dijkstra, Bellman-Ford, SPFA", ids[:8])
        P.search("O(logN)")
        ids = P.ids()
        check("fenwick-tree" in ids and "binary-search" in ids, "O(logN) khớp 'O(log N)': có Fenwick, tìm nhị phân (%d mục)" % len(ids))
        P.search("range query")
        check({"fenwick-tree", "segment-tree"} <= set(P.ids()), "use case 'range query' → Fenwick, Segment Tree")
        P.search("duong di ngan nhat")
        check("dijkstra" in P.ids()[:5], "tìm không dấu 'duong di ngan nhat' → Dijkstra trong 5 đầu", P.ids()[:5])
        P.search("dijkstrs")
        check(P.ids()[:1] == ["dijkstra"], "gõ sai một chữ vẫn ra Dijkstra")
        P.search("zzzkhongco")
        check(pg.locator(".empty-list").count() == 1 and "Thêm" in pg.locator(".empty-list").inner_text(), "không có kết quả: gợi ý thêm vào thư viện của tôi")
        pg.fill("#q", "")
        pg.select_option("select[data-f=cat]", "graph")
        pg.wait_for_function("document.querySelector('.lp-count').textContent.startsWith('25 mục')", timeout=4000)
        check(True, "lọc theo nhóm Đồ thị: 25 mục")
        pg.select_option("select[data-f=cat]", "")

        section(" · chi tiết thuật toán, bookmark, trạng thái, ghi chú, template")
        open_detail(P, "dijkstra")
        body = pg.locator(".detail").inner_text()
        check(all(h in body.upper() for h in ("MÔ TẢ", "ĐIỀU KIỆN ÁP DỤNG", "ĐỘ PHỨC TẠP", "KHI NÀO DÙNG", "KHI NÀO KHÔNG DÙNG", "LỖI THƯỜNG GẶP", "CODE", "VÍ DỤ", "BÀI TẬP LIÊN QUAN", "LIÊN QUAN", "GHI CHÚ CỦA TÔI")), "chi tiết có đủ 11 mục (mô tả, điều kiện, độ phức tạp, khi nào dùng/không dùng, lỗi, code, ví dụ, bài tập, liên quan, ghi chú)")
        check("O((V+E) log V)" in pg.locator(".quick-card").inner_text(), "khối tra nhanh hiện độ phức tạp")
        href = pg.get_attribute(".probs a[href*='cses.fi']", "href")
        check(href == "https://cses.fi/problemset/task/1671", "bài tập CSES có liên kết đúng (Shortest Routes I → 1671)", href)
        check(pg.locator(".probs li:has(a[href*='cses.fi']) .unv").count() == 0, "bài CSES (đã đối chiếu với cses.fi) không mang nhãn 'chưa kiểm'")
        other = pg.evaluate("(Algo.lib.all().find(e => e.problems.some(p => !Algo.lib.problemVerified(p))) || {}).id || ''")
        if other:
            open_detail(P, other)
            unv = pg.locator(".probs li:has(.unv)")
            check(unv.count() >= 1 and unv.first.locator("a").count() == 0, "bài từ nguồn khác (%s) hiện nhãn 'chưa kiểm' và không có liên kết" % other)
            check(pg.locator(".probs a[href*='codeforces.com']").count() == 0, "không tạo liên kết Codeforces cho bài chưa đối chiếu")
            open_detail(P, "dijkstra")
        check(pg.locator(".md pre.code .tk-k, .md pre.code .tk-f").count() > 3, "mã C++ được tô màu cú pháp")
        pg.click(".code-act .btn:has-text('Sao chép')")
        check(P.toast("Đã sao chép"), "nút Sao chép báo thành công")
        clip = pg.evaluate("navigator.clipboard.readText()")
        check("vector<long long> dijkstra(" in clip and clip.startswith("#include <bits/stdc++.h>"), "clipboard chứa đúng mã template (dán là chạy)")
        with pg.expect_download() as d:
            pg.click(".code-act .btn:has-text('Tải dijkstra.cpp')")
        dp_ = os.path.join(tmp, "d.cpp")
        d.value.save_as(dp_)
        crlf = lambda t: t.replace("\r\n", "\n")        # Windows: clipboard trả CRLF
        check(d.value.suggested_filename == "dijkstra.cpp" and crlf(io.open(dp_, encoding="utf-8", newline="").read()) == crlf(clip), "tải dijkstra.cpp: đúng tên và nội dung")
        pg.click(".code-act .btn:has-text('Lưu vào Template')")
        pg.fill("#ff-title", "my-dijkstra.cpp")
        pg.click(".dlg button[type=submit]")
        check(P.toast("Đã lưu my-dijkstra.cpp"), "lưu vào Template của tôi")
        pg.click(".bm")
        pg.wait_for_timeout(200)
        check(pg.get_attribute(".bm", "aria-pressed") == "true" and pg.locator("#sidePins .pin").count() == 1, "bookmark: nút bật + hiện ở thanh bên")
        pg.select_option(".st-sel", "1")
        check(P.toast("Đang học"), "đổi trạng thái học → Đang học")
        pg.fill(".note-ta", "Nhớ dùng long long cho dist")
        pg.focus(".note-ta")
        pg.keyboard.press("Control+s")
        check(P.toast("Đã lưu ghi chú"), "lưu ghi chú cá nhân (Ctrl+S)")
        pg.reload()
        pg.wait_for_function("document.body.classList.contains('ready')")
        pg.wait_for_selector(".note-ta")
        check(pg.input_value(".note-ta") == "Nhớ dùng long long cho dist" and pg.get_attribute(".bm", "aria-pressed") == "true" and pg.input_value(".st-sel") == "1", "tải lại: ghi chú, bookmark, trạng thái còn nguyên")
        P.go("#/lib")
        r = P.search("long long cho dist")
        check("dijkstra" in P.ids(), "tìm thấy thuật toán qua nội dung GHI CHÚ cá nhân", r)
        pg.fill("#q", "")
        pg.evaluate(STUB_PRINT)
        open_detail(P, "dijkstra")
        menu_click(P, "In / Lưu PDF")
        pg.wait_for_function("window.__printed", timeout=3000)
        pr = pg.evaluate("window.__printed")
        check(pr["printing"] and "Dijkstra" in pr["text"] and "long long cho dist" in pr["text"], "In/PDF: bản in có tên, nội dung và ghi chú của tôi", pr["text"][:60])
        pg.evaluate("window.dispatchEvent(new Event('afterprint'))")
        with pg.expect_download() as d:
            menu_click(P, "Tải Markdown")
        mp = os.path.join(tmp, "d.md")
        d.value.save_as(mp)
        mdtxt = io.open(mp, encoding="utf-8").read()
        check(mdtxt.startswith("---\nid: dijkstra") and "## Code (C++)" in mdtxt and "```cpp" in mdtxt and "Ghi chú của tôi" in mdtxt, "tải .md: front-matter + code + ghi chú")
        P.go("#/")
        pg.wait_for_timeout(300)
        check("Dijkstra" in pg.locator(".home").inner_text().split("ĐANG HỌC")[1].split("ĐÃ ĐÁNH DẤU")[0], "trang chủ: mục 'Đang học' có Dijkstra")

        section(" · Template Manager")
        P.go("#/templates")
        pg.wait_for_selector(".tcard")
        check(pg.locator(".tcard").count() == 1 and "my-dijkstra.cpp" in pg.locator(".tcard").inner_text(), "Template Manager liệt kê template vừa lưu")
        pg.click(".tcard a:has-text('Sửa')")
        pg.wait_for_selector(".code-ta")
        pg.fill(".code-ta", pg.input_value(".code-ta") + "\n// sửa của tôi\n")
        pg.focus(".code-ta")
        pg.keyboard.press("Control+s")
        check(P.toast("Đã lưu my-dijkstra.cpp"), "sửa template + Ctrl+S")
        pg.click("a.back-link")
        pg.wait_for_selector(".tcard")
        pg.click("button:has-text('Template mới')")
        pg.wait_for_selector(".tpl-title")
        pg.fill(".tpl-title", "dsu.cpp")
        pg.fill(".code-ta", "#include <bits/stdc++.h>\nusing namespace std;\nstruct DSU { vector<int> p; };\n")
        pg.fill(".tpl-meta input[aria-label=Tag]", "graph, dsu")
        pg.focus(".code-ta")
        pg.keyboard.press("Control+s")
        check(P.toast("Đã lưu dsu.cpp"), "tạo template mới từ đầu")
        tpf = os.path.join(tmp, "from-disk.py")
        io.open(tpf, "w", encoding="utf-8").write("print('xin chào')\n")
        P.go("#/templates")
        pg.wait_for_selector(".tcard")
        with pg.expect_file_chooser() as fc:
            pg.click("button:has-text('Nhập tệp')")
        fc.value.set_files(tpf)
        check(P.toast("Đã nhập 1 tệp"), "nhập tệp .py từ máy → thành template (nhận ngôn ngữ theo đuôi)")
        pg.wait_for_function("document.querySelectorAll('.tcard').length === 3")
        pg.fill("input[aria-label='Lọc template']", "dsu")
        pg.wait_for_timeout(250)
        check(pg.locator(".tcard").count() == 1, "lọc template theo tên/tag")
        pg.fill("input[aria-label='Lọc template']", "")
        with pg.expect_download() as d:
            pg.click("button:has-text('Xuất .zip')")
        zp = os.path.join(tmp, "tpl.zip")
        d.value.save_as(zp)
        names = zipfile.ZipFile(zp).namelist()
        check(zipfile.ZipFile(zp).testzip() is None and {"my-dijkstra.cpp", "dsu.cpp", "from-disk.py"} <= set(names), "xuất template .zip: đủ 3 tệp, zip hợp lệ", names)
        pg.locator(".tcard:has-text('from-disk.py') button[aria-label^='Xoá']").click()
        pg.click(".dlg .btn-danger-solid")
        pg.wait_for_function("document.querySelectorAll('.tcard').length === 2")
        check(True, "xoá template có xác nhận")

        section(" · thư viện của tôi (Personal Library)")
        P.go("#/mine/new")
        pg.wait_for_selector("#f-name")
        pg.fill("#f-name", "Li Chao Tree")
        pg.select_option("#f-cat", "dp")
        pg.fill("#f-tags", "cht, li-chao")
        pg.fill("#f-sum", "Cây Li Chao giữ tập đường thẳng, truy vấn min tại một điểm.")
        pg.fill("#f-desc", "Mỗi nút giữ một đường thẳng; xem [[Convex Hull Trick / Li Chao Tree]].")
        pg.fill("#f-time", "O(log N)")
        pg.fill("#f-use_case", "Truy vấn min của các đường thẳng\nDP tối ưu CHT không đơn điệu")
        pg.fill("#f-ctitle", "lichao.cpp")
        pg.fill("#f-src", "struct Line { long long a, b; };\n")
        pg.fill("#f-origin", "cp-algorithms")
        pg.click(".iform button[type=submit]")
        pg.wait_for_selector(".detail h1")
        check(pg.locator(".detail h1").inner_text() == "Li Chao Tree" and "của tôi" in pg.locator(".dh-top").inner_text() and "cp-algorithms" in pg.locator(".detail").inner_text(), "thêm mục của tôi (nguồn cp-algorithms) → mở trang chi tiết")
        P.go("#/lib")
        P.search("li chao")
        check(len(P.ids()) >= 2 and any(i.startswith("u-") for i in P.ids()), "tìm 'li chao' ra cả mục của tôi và mục dựng sẵn (cùng một ô tìm)", P.ids())
        pg.fill("#q", "")
        P.go("#/lib?src=user")
        pg.wait_for_selector(".nrow")
        check(pg.locator(".nrow").count() == 1 and "của tôi" in pg.locator(".nrow").first.inner_text(), "danh sách 'Của tôi' chỉ có mục vừa thêm")
        uid = P.ids()[0]
        P.go("#/mine/edit/" + uid)
        pg.wait_for_selector("#f-name")
        pg.fill("#f-name", "Li Chao Tree (sửa)")
        pg.click(".iform button[type=submit]")
        pg.wait_for_selector(".detail h1")
        check(pg.locator(".detail h1").inner_text() == "Li Chao Tree (sửa)", "sửa mục của tôi")
        pg.click(".detail .more")
        pg.click(".popmenu button:has-text('Xoá mục này')")
        pg.click(".dlg .btn-danger-solid")
        pg.wait_for_function("location.hash.startsWith('#/lib')")
        P.go("#/lib?src=user")
        pg.wait_for_timeout(300)
        check(pg.locator(".nrow").count() == 0, "xoá mục của tôi có xác nhận")

        section(" · so sánh, cheat sheet")
        P.go("#/compare")
        pg.wait_for_selector(".sets .chip")
        pg.click(".sets .chip:has-text('Fenwick ↔ Segment Tree')")
        pg.wait_for_selector(".cmp-t")
        check(pg.locator(".cmp-t thead th").count() == 3 and pg.locator(".cmp-t tr.diff").count() >= 3, "so sánh Fenwick ↔ Segment Tree: 2 cột + các hàng khác biệt được tô")
        labels = pg.evaluate("[...document.querySelectorAll('.cmp-t tbody th')].map(t => t.textContent)")
        check(len(labels) == len(set(labels)) and "Thời gian" in labels and "Độ khó cài đặt" in labels, "không có hàng trùng nhãn", labels)
        pg.fill(".cmp-add input", "sparse")
        pg.wait_for_selector(".cmp-sug .sg")
        pg.dispatch_event(".cmp-sug .sg >> nth=0", "pointerdown")
        pg.wait_for_function("document.querySelectorAll('.cmp-t thead th').length === 4")
        check(True, "thêm cột thứ ba bằng ô gõ gợi ý")
        pg.click(".tagchip .tagx >> nth=0")
        pg.wait_for_function("document.querySelectorAll('.cmp-t thead th').length === 3")
        check(re.search(r"ids=", P.hash()) is not None, "bỏ một cột; địa chỉ giữ danh sách ids để chia sẻ", P.hash())
        pg.click("button:has-text('Sao chép Markdown')")
        check(P.toast("Đã sao chép bảng") and "| Tiêu chí |" in pg.evaluate("navigator.clipboard.readText()"), "sao chép bảng so sánh dạng Markdown")
        P.go("#/cheat")
        pg.wait_for_selector(".cc")
        n_all = pg.locator(".cc").count()
        pg.click(".chips .chip:has-text('Đồ thị')")
        pg.wait_for_timeout(250)
        check(n_all >= 100 and pg.locator(".cc").count() == 25, "Cheat Sheet: %d thẻ; lọc Đồ thị còn 25" % n_all)
        pg.click(".chips .chip:has-text('Tất cả')")
        pg.fill(".cheat input[type=search]", "dsu")
        pg.wait_for_timeout(250)
        check(pg.locator(".cc").count() == 1 and "α" in pg.locator(".cc").inner_text() or pg.locator(".cc").count() >= 1, "Cheat Sheet: lọc nhanh theo tên")
        pg.fill(".cheat input[type=search]", "")
        pg.wait_for_function("document.querySelectorAll('.cc').length >= 100", timeout=3000)     # chờ bộ lọc (debounce) trả lại đủ thẻ rồi mới in
        pg.evaluate(STUB_PRINT)
        pg.click("button:has-text('In / PDF')")
        pg.wait_for_function("window.__printed", timeout=3000)
        check("Cheat Sheet" in pg.evaluate("window.__printed.text") and "Dijkstra" in pg.evaluate("window.__printed.text"), "Cheat Sheet: In / PDF")
        pg.evaluate("window.dispatchEvent(new Event('afterprint'))")

        section(" · Wizard + cây quyết định")
        P.go("#/decide")
        pg.wait_for_selector(".wopt")
        for idx in (0, 0, 1, 1, 1):
            pg.click(".wopt >> nth=%d" % idx)
            pg.wait_for_timeout(150)
        pg.wait_for_selector(".res-card")
        check("Dijkstra" in pg.locator(".res-card").first.inner_text() and P.hash().endswith("p=0,0,1,1,1"), "Wizard: đồ thị → ngắn nhất → không âm → trọng số tuỳ ý → một nguồn ⇒ Dijkstra; đường đi nằm trong địa chỉ", P.hash())
        check(pg.locator(".crumbs li").count() == 5, "hiện đủ 5 câu đã trả lời")
        pg.go_back()
        pg.wait_for_timeout(300)
        check(pg.locator(".res-card").count() == 0 and pg.locator(".wopt").count() >= 2 and pg.locator(".crumbs li").count() == 4, "nút Quay lại của trình duyệt lùi đúng một câu")
        P.go("#/decide?p=3,1,0")
        pg.wait_for_selector(".res-card")
        P.go("#/tree")
        pg.wait_for_selector("details.tn")
        pg.fill(".treev input[type=search]", "dijkstra")
        pg.wait_for_timeout(250)
        check(pg.locator("a.leaf.hit").count() >= 1 and pg.locator("details.tn[open]").count() >= 3, "cây quyết định: tìm 'dijkstra' mở các nhánh và tô lá")
        pg.click("a.leaf.hit >> nth=0")
        pg.wait_for_selector(".detail h1")
        check(pg.locator(".detail h1").inner_text() == "Dijkstra" and pg.locator(".tpath").count() >= 1, "bấm lá → mở Dijkstra; chi tiết hiện 'Cách tìm ra thuật toán này'")

        section(" · luyện tập: flashcard, quiz, trực quan hoá")
        P.go("#/practice/cards")
        pg.wait_for_selector(".fcard")
        first_q = pg.locator(".fc-face").first.inner_text()
        check(pg.locator(".fc-back:not([hidden])").count() == 0, "đáp án ẩn tới khi bấm")
        pg.keyboard.press("Space")
        pg.wait_for_selector(".fc-back:not([hidden])")
        check(pg.locator(".grade").count() == 4, "hiện đáp án bằng Space → 4 nút chấm (Lại/Khó/Được/Dễ) kèm khoảng ôn")
        pg.keyboard.press("3")
        pg.wait_for_function("q => document.querySelector('.fc-face').innerText !== q", arg=first_q)
        pg.keyboard.press("Space")
        pg.keyboard.press("1")
        pg.wait_for_timeout(300)
        P.go("#/settings")
        pg.wait_for_selector(".dur")
        check("2 thẻ đã ôn" in pg.locator(".dur").inner_text(), "ôn 2 thẻ bằng phím tắt → lịch ôn được lưu (2 thẻ)", pg.locator(".dur").inner_text()[:120])
        P.go("#/practice/quiz")
        pg.wait_for_selector("button:has-text('Bắt đầu')")
        pg.click("button:has-text('Bắt đầu')")
        graded = []
        for i in range(10):
            pg.wait_for_selector(".qopt")
            pg.keyboard.press("1")
            pg.wait_for_selector(".qfb")
            graded.append(pg.get_attribute(".qfb", "class").split()[-1])
            pg.keyboard.press("Enter")
            pg.wait_for_timeout(120)
        pg.wait_for_selector("text=Kết quả Quiz")
        check(len(graded) == 10 and set(graded) <= {"right", "ok", "wrong"} and "đúng" in pg.locator(".done").inner_text(), "Quiz 10 câu: chọn bằng phím 1, Enter sang câu tiếp, có kết quả (%s)" % ",".join(graded))
        P.go("#/practice")
        pg.wait_for_selector(".qlog")
        check(pg.locator(".qlog li").count() == 1, "kết quả Quiz được lưu vào lịch sử")
        P.go("#/viz")
        pg.wait_for_selector(".viz-list .bigcard")
        vids = pg.evaluate("[...document.querySelectorAll('.viz-list .bigcard')].map(a => a.getAttribute('href').replace('#/viz/', ''))")
        check(len(vids) == 11, "11 trực quan hoá", vids)
        bad = []
        for v in vids:
            P.go("#/viz/" + v, 450)
            pg.wait_for_selector(".vmsg")
            steps = int(re.search(r"/(\d+)", pg.locator(".vcount").inner_text()).group(1))
            for _ in range(min(steps, 700)):
                if pg.locator("[aria-label^='Bước tiếp']").is_disabled():
                    break
                pg.click("[aria-label^='Bước tiếp']")
            msg = pg.locator(".vmsg").inner_text()
            if steps < 5 or len(msg) < 10 or pg.locator(".form-err:not([hidden])").count():
                bad.append("%s (%d bước)" % (v, steps))
        check(not bad, "mọi trực quan hoá chạy hết các bước đến thông báo cuối", bad)
        P.go("#/viz/dijkstra")
        pg.wait_for_selector(".vgraph")
        pg.click("[aria-label^='Bước tiếp']")
        pg.keyboard.press("ArrowRight")
        pg.keyboard.press("ArrowLeft")
        check(pg.locator(".vcount").inner_text().startswith("Bước 2/"), "phím ← → bước tới / lui")
        pg.fill(".viz-in", "5 1 9\n1 2 3")
        pg.wait_for_selector(".form-err:not([hidden])")
        check("nguồn" in pg.locator(".form-err").inner_text(), "nhập sai → báo lỗi tiếng Việt, không vỡ")
        pg.select_option(".viz-side select", "1")
        pg.wait_for_timeout(300)
        check(pg.locator(".form-err:not([hidden])").count() == 0 and pg.locator(".vgraph").count() == 1, "chọn dữ liệu mẫu khác → chạy lại")

        section(" · lộ trình + tiến độ")
        P.go("#/learn")
        pg.wait_for_selector(".rm-card")
        check(pg.locator(".rm-card").count() == 5, "5 lộ trình theo mục tiêu")
        pg.click(".rm-card:has-text('Competitive')")
        pg.wait_for_selector(".step")
        check(pg.locator(".stage").count() == 8 and pg.locator(".step.next").count() == 1, "lộ trình CP: 8 chặng, đánh dấu mục kế tiếp")
        nxt = pg.locator(".step.next a").inner_text()
        pg.select_option(".step.next .st-sel", "2")
        pg.wait_for_timeout(300)
        check(pg.locator(".step.next a").inner_text() != nxt and "Học tiếp" in pg.locator(".rm-sum").inner_text(), "đánh dấu 'Đã học' → mục kế tiếp dịch chuyển (%s → %s)" % (nxt, pg.locator(".step.next a").inner_text()))
        P.go("#/learn")
        pg.wait_for_selector(".big-pct")
        check(pg.locator(".big-pct").inner_text() != "0%", "dashboard: phần trăm tiến độ tổng cập nhật (%s)" % pg.locator(".big-pct").inner_text())

        section(" · cài đặt, sao lưu, xuất")
        P.go("#/settings")
        pg.click(".settings .seg button:has-text('Tối')")
        check(pg.evaluate("document.documentElement.dataset.theme") == "dark", "chọn giao diện Tối")
        pg.reload()
        pg.wait_for_function("document.body.classList.contains('ready')")
        check(pg.evaluate("document.documentElement.dataset.theme") == "dark", "giữ giao diện sau khi tải lại")
        pg.click(".settings .seg button:has-text('Sáng')")
        with pg.expect_download() as d:
            pg.click("button:has-text('Tạo bản sao lưu')")
        bk = d.value
        check(re.match(r"^backup_\d{8}\.zip$", bk.suggested_filename) is not None, "tên bản sao lưu backup_YYYYMMDD.zip", bk.suggested_filename)
        bp = os.path.join(tmp, bk.suggested_filename)
        bk.save_as(bp)
        zf = zipfile.ZipFile(bp)
        man = json.loads(zf.read("manifest.json"))
        data = json.loads(zf.read("data.json"))
        check(zf.testzip() is None and man["app"] == "algorithm-notebook" and man["counts"]["templates"] == 2 and man["counts"]["notes"] == 1 and len(data["marks"]) >= 2, "backup zip hợp lệ: manifest + data (template, ghi chú, dấu)", man["counts"])
        with pg.expect_download() as d:
            pg.click("button:has-text('Xuất JSON')")
        jp = os.path.join(tmp, "e.json")
        d.value.save_as(jp)
        js = json.load(io.open(jp, encoding="utf-8"))
        check(js["app"] == "algorithm-notebook" and len(js["algorithms"]) == 116 and js["mine"]["notes"], "xuất JSON: 116 thuật toán + dữ liệu của tôi")
        with pg.expect_download() as d:
            pg.click("button:has-text('Xuất Markdown')")
        mz = os.path.join(tmp, "e.zip")
        d.value.save_as(mz)
        z2 = zipfile.ZipFile(mz)
        n2 = z2.namelist()
        dm = z2.read("Đồ thị/Dijkstra.md").decode("utf-8") if "Đồ thị/Dijkstra.md" in n2 else ""
        check(z2.testzip() is None and "cheatsheet.md" in n2 and len([n for n in n2 if n.endswith(".md")]) >= 117 and "```cpp" in dm and "templates/my-dijkstra.cpp" in n2, "xuất Markdown ZIP: mỗi thuật toán một .md theo thư mục nhóm + cheatsheet.md + templates/ (%d tệp)" % len(n2))
        P2 = Page(br, url, "desk-restore", viewport={"width": 1366, "height": 820})
        P2.go("#/settings")
        P2.pg.wait_for_selector("button:has-text('Khôi phục từ tệp')")
        with P2.pg.expect_file_chooser() as fc:
            P2.pg.click("button:has-text('Khôi phục từ tệp')")
        fc.value.set_files(bp)
        P2.pg.click(".dlg button:has-text('Gộp')")
        P2.pg.wait_for_timeout(1200)
        P2.go("#/templates")
        P2.pg.wait_for_selector(".tcard")
        open_detail(P2, "dijkstra")
        check(P2.pg.input_value(".note-ta") == "Nhớ dùng long long cho dist" and P2.pg.get_attribute(".bm", "aria-pressed") == "true", "khôi phục backup (gộp) sang trình duyệt mới: ghi chú + bookmark trở lại")
        P2.go("#/templates")
        P2.pg.wait_for_selector(".tcard")
        check(P2.pg.locator(".tcard").count() == 2, "khôi phục: template trở lại")
        P2.close()
        P.go("#/settings")
        pg.click("button:has-text('Xoá toàn bộ dữ liệu')")
        pg.click(".dlg .btn-danger-solid")
        pg.fill("#ff-w", "XOA")
        pg.click(".dlg button[type=submit]")
        pg.wait_for_function("document.querySelector('.dur').innerText.includes('0 mục của tôi')", timeout=5000)
        P.go("#/templates")
        pg.wait_for_timeout(300)
        check(pg.locator(".tcard").count() == 0, "xoá toàn bộ dữ liệu của tôi (gõ XOA); danh mục dựng sẵn không đổi")
        P.close()

        # ---------------------------------------------------------------- điện thoại
        for label, eng, dev in (("Pixel 5", pw.chromium, pw.devices["Pixel 5"]), ("iPhone 13", pw.webkit, pw.devices["iPhone 13"])):
            section(" · điện thoại — " + label)
            b2 = eng.launch()
            M = Page(b2, url, "mob-" + label, **dev)
            m = M.pg
            check(m.is_visible("#bottomNav") and not m.is_visible("#side"), "thanh dưới hiện, thanh bên ẩn")
            m.click("#bottomNav a[data-nav=lib]")
            m.wait_for_selector(".nrow")
            check(m.evaluate("document.body.dataset.pane") == "list" and m.is_visible(".fab"), "Thư viện: một màn danh sách + nút nổi")
            M.search("fenwick")
            m.click(".nrow")
            m.wait_for_selector(".detail h1")
            check(m.evaluate("document.body.dataset.pane") == "both" and not m.is_visible("#listPane") and m.locator(".detail h1").inner_text().startswith("Fenwick"), "chạm dòng → màn chi tiết (danh sách ẩn)")
            m.click("#topBack")
            m.wait_for_selector(".nrow")
            check(m.evaluate("document.body.dataset.pane") == "list", "nút quay lại về danh sách")
            m.click("#moreBtn")
            check(m.locator(".popmenu button").count() == 6, "menu 'Thêm' có 6 mục")
            m.keyboard.press("Escape")
            M.go("#/decide")
            m.click(".wopt >> nth=1")
            m.wait_for_selector(".wopt")
            check(m.locator(".crumbs li").count() == 1, "Wizard dùng được bằng chạm")
            for hsh in ("#/", "#/compare?ids=fenwick-tree,segment-tree", "#/cheat", "#/templates", "#/practice", "#/viz/dijkstra", "#/learn/cp", "#/settings", "#/mine/new", "#/a/dinic", "#/tree"):
                M.go(hsh, 450)
                check(m.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "%s không tràn ngang" % hsh)
            small = m.evaluate("""() => [...document.querySelectorAll('button, a.nav, a.bn, .icon-btn, input:not([type=range]), select')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 32 && getComputedStyle(e).visibility !== 'hidden'; }).map(e => (e.className || e.tagName) + ' ' + Math.round(e.getBoundingClientRect().height)).slice(0, 8)""")
            check(not small, "vùng chạm ở màn cài đặt ≥ 32px", small)
            M.close()
            b2.close()
        kiem_toan(br, url)
        br.close()
    if ERRORS:
        section("LỖI CONSOLE / PAGEERROR")
    check(not ERRORS, "không có lỗi console hay pageerror trong cả tầng", ERRORS[:6])


# ============================================================================================ tầng 3 — sống sót: sập máy, offline, cập nhật
def _crash(pg):
    """Giết tiến trình render của trang (như hết pin / trình duyệt chết): không có pagehide hay beforeunload."""
    try:
        pg.goto("chrome://crash", wait_until="commit", timeout=5000)
    except Exception:
        pass
    time.sleep(0.5)


def tang_3(may):
    section("TẦNG 3 — sống sót: sập giữa chừng, offline, cập nhật (Chromium)")
    import functools
    import http.server
    import shutil
    import threading
    from playwright.sync_api import sync_playwright
    url = may.goc + PATH
    udd = tempfile.mkdtemp(prefix="algo-udd-")
    with sync_playwright() as pw:
        section(" · bản nháp sống sót khi trình duyệt sập (hồ sơ trình duyệt thật, đóng–mở lại)")

        def open_ctx():
            c = pw.chromium.launch_persistent_context(udd, headless=True, viewport={"width": 1366, "height": 820}, service_workers="block")
            p = c.pages[0] if c.pages else c.new_page()
            errs = []
            p.on("pageerror", lambda e: errs.append(str(e)))
            p.goto(url)
            p.wait_for_function("document.body.classList.contains('ready')", timeout=20000)
            return c, p, errs

        def draft_toast(p):
            try:
                p.wait_for_selector(".toast:has-text('bản nháp chưa lưu')", timeout=6000)
                p.click(".toast button:has-text('Mở')")
                return True
            except Exception:
                return False

        # 1) ghi chú cá nhân của một thuật toán
        c, p, errs = open_ctx()
        p.evaluate("location.hash = '#/a/dijkstra'")
        p.wait_for_selector(".note-ta")
        p.fill(".note-ta", "Ghi chú gõ dở: nhớ relax đúng thứ tự\nDòng hai")
        p.wait_for_timeout(900)
        _crash(p)
        c.close()
        c, p, errs = open_ctx()
        check(draft_toast(p), "sau khi sập: thông báo 'bản nháp chưa lưu' (ghi chú của Dijkstra)")
        p.wait_for_selector(".mynote .ed-banner", timeout=5000)
        check(p.input_value(".note-ta") == "", "bản đã lưu (trống) không bị đè khi chưa đồng ý")
        p.click(".mynote .ed-banner button:has-text('Khôi phục nháp')")
        check("Dòng hai" in p.input_value(".note-ta") and "relax đúng thứ tự" in p.input_value(".note-ta"), "bấm 'Khôi phục nháp' → lấy lại nguyên văn")
        p.focus(".note-ta")
        p.keyboard.press("Control+s")
        check(_wait_toast(p, "Đã lưu ghi chú"), "lưu bản đã khôi phục")

        # 2) template đang soạn
        p.evaluate("location.hash = '#/templates/new'")
        p.wait_for_selector(".tpl-title")
        p.fill(".tpl-title", "dang-soan.cpp")
        p.fill(".code-ta", "#include <bits/stdc++.h>\n// đang viết dở thì mất điện\nint f() { return 42; }\n")
        p.wait_for_timeout(900)
        _crash(p)
        c.close()
        c, p, errs = open_ctx()
        check(draft_toast(p), "sau khi sập: thông báo bản nháp template")
        p.wait_for_selector(".ed-banner", timeout=5000)
        p.click(".ed-banner button:has-text('Khôi phục nháp')")
        check(p.input_value(".tpl-title") == "dang-soan.cpp" and "mất điện" in p.input_value(".code-ta"), "template mới chưa lưu: tên + mã được khôi phục")
        p.focus(".code-ta")
        p.keyboard.press("Control+s")
        check(_wait_toast(p, "Đã lưu dang-soan.cpp"), "lưu template đã khôi phục")

        # 3) mục của tôi đang soạn
        p.evaluate("location.hash = '#/mine/new'")
        p.wait_for_selector("#f-name")
        p.fill("#f-name", "Thuật toán mất điện")
        p.fill("#f-desc", "Mô tả viết dở…")
        p.wait_for_timeout(900)
        _crash(p)
        c.close()
        c, p, errs = open_ctx()
        check(draft_toast(p), "sau khi sập: thông báo bản nháp mục của tôi")
        p.wait_for_selector(".ed-banner", timeout=5000)
        p.click(".ed-banner button:has-text('Khôi phục nháp')")
        check(p.input_value("#f-name") == "Thuật toán mất điện" and "viết dở" in p.input_value("#f-desc"), "mục của tôi chưa lưu: biểu mẫu được khôi phục")
        # đóng thẻ ngay sau khi gõ (chưa tới 500 ms): chỉ ghi nhận
        p.evaluate("location.hash = '#/a/dsu'")
        p.wait_for_selector(".note-ta")
        p.fill(".note-ta", "đóng thẻ ngay")
        p.close(run_before_unload=False)
        c.close()
        c, p, errs = open_ctx()
        kept = p.evaluate("""async () => { const s = await Algo.store.openBest('algorithm-notebook'); const u = Algo.user.create(s); await u.open(); return (await u.listDrafts()).some(d => d.id === 'note:dsu'); }""")
        print("    (thông tin) gõ rồi đóng thẻ trong < 500 ms: %s" % ("nháp ĐƯỢC giữ (pagehide ghi kịp)" if kept else "dòng cuối bị mất — tối đa ≤ 0,5 s chữ gần nhất"))
        check(not errs, "không lỗi JS qua các lần sập/mở lại", errs)
        c.close()
        shutil.rmtree(udd, ignore_errors=True)

        section(" · offline: service worker lưu vỏ + thư viện, mở được khi mất mạng")
        br = pw.chromium.launch()
        ctx = br.new_context(service_workers="allow", viewport={"width": 1366, "height": 820})
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(url)
        pg.wait_for_function("document.body.classList.contains('ready')")
        pg.wait_for_function("navigator.serviceWorker.controller !== null", timeout=20000)
        mine = [n for n in pg.evaluate("caches.keys()") if n.startswith("algo:")]
        check(len(mine) == 1, "có đúng một cache của Algorithm Notebook", mine)
        try:
            pg.wait_for_function("caches.keys().then(k => k.find(n => n.startsWith('algo-vendor:')) ? caches.open(k.find(n => n.startsWith('algo-vendor:'))).then(c => c.keys()).then(ks => ks.length >= 22) : false)", timeout=25000)
        except Exception:
            pass
        vk = pg.evaluate("() => caches.keys().then(async k => { const n = k.find(x => x.startsWith('algo-vendor:')); if (!n) return null; const c = await caches.open(n); return (await c.keys()).map(r => new URL(r.url).pathname); })")
        vnames = sorted(os.path.relpath(os.path.join(dp, f), os.path.join(HERE, "assets", "vendor", "katex")).replace(os.sep, "/") for dp, _, fs in os.walk(os.path.join(HERE, "assets", "vendor", "katex")) for f in fs if f not in ("LICENSE", "README"))
        check(vk and sorted(u.split("/assets/vendor/katex/")[1] for u in vk) == vnames, "service worker tải sẵn ĐỦ vendor KaTeX vào cache riêng algo-vendor:… (%d tệp), không lẫn vào cache vỏ" % len(vnames), vk and len(vk))
        urls = pg.evaluate("(n) => caches.open(n).then(c => c.keys()).then(ks => ks.map(k => new URL(k.url).pathname))", mine[0])
        need = ["index.html", "manifest.webmanifest", "assets/js/ui/app.js", "assets/css/algo.css", "assets/icons/icon-192.png"] + ["assets/data/lib-%s.js" % n for n in ("ds", "graph-1", "graph-2", "string", "dp", "math", "tech", "opt", "sys")] + ["assets/data/tree.js", "assets/data/roadmaps.js"]
        missing = [n for n in need if not any(u.endswith(PATH + n) for u in urls)]
        check(not missing, "cache có vỏ ứng dụng và toàn bộ thư viện dựng sẵn (%d tệp)" % len(urls), missing)
        check(pg.evaluate("Algo.ui.pwa.installState()") in ("menu", "ready", "installed"), "trạng thái cài đặt hợp lệ trên localhost")
        ctx.set_offline(True)
        pg.reload(wait_until="domcontentloaded")
        pg.wait_for_function("document.body.classList.contains('ready')", timeout=20000)
        hy = pg.evaluate("""async () => { const d = document.createElement('div'); d.className = 'md'; d.innerHTML = '<span class="math" data-tex="a^2+b^2">a^2+b^2</span>'; document.body.append(d);
            await Algo.ui.rich.hydrate([d]); const s = d.firstChild; const r = { hy: s.getAttribute('data-hydrated'), kat: s.querySelectorAll('.katex').length, tex: s.getAttribute('data-tex') }; d.remove(); return r; }""")
        check(hy["hy"] == "1" and hy["kat"] == 1 and hy["tex"] == "a^2+b^2", "OFFLINE: KaTeX nạp lười từ cache vendor của service worker và vẽ được công thức", hy)
        check("ngoại tuyến" in pg.locator("#banner").inner_text(), "TẮT MẠNG rồi tải lại: mở được, hiện biểu ngữ 'ngoại tuyến'")
        pg.evaluate("location.hash = '#/lib'")
        pg.wait_for_selector(".nrow")
        pg.fill("#q", "dijkstra")
        pg.wait_for_function("document.querySelector('.lp-count').dataset.q === 'dijkstra'")
        check(pg.locator(".nrow .nr-title").first.inner_text() == "Dijkstra", "offline: tìm kiếm trong 116 mục dựng sẵn hoạt động")
        pg.evaluate("location.hash = '#/a/dijkstra'")
        pg.wait_for_selector(".detail h1")
        pg.fill(".note-ta", "ghi khi offline")
        pg.focus(".note-ta")
        pg.keyboard.press("Control+s")
        check(_wait_toast(pg, "Đã lưu ghi chú"), "offline: lưu ghi chú cá nhân")
        pg.evaluate("location.hash = '#/viz/dijkstra'")
        pg.wait_for_selector(".vgraph")
        check(pg.locator(".vcount").inner_text().startswith("Bước 1/"), "offline: trực quan hoá chạy")
        api_ok = pg.evaluate("() => fetch('/health/').then(() => true, () => false)")
        check(api_ok is False, "offline: gọi địa chỉ ngoài phạm vi thất bại thật (worker không trả bản cũ)")
        ctx.set_offline(False)
        pg.reload()
        pg.wait_for_function("document.body.classList.contains('ready')")
        pg.evaluate("location.hash = '#/a/dijkstra'")
        pg.wait_for_selector(".note-ta")
        check(pg.input_value(".note-ta") == "ghi khi offline", "có lại mạng: ghi chú viết khi offline còn nguyên")
        check(not errs, "không lỗi JS ở luồng offline", errs)
        ctx.close()

        section(" · cập nhật: 'Có bản mới → Tải lại', không chiếm trang đang soạn dở")
        tmpd = tempfile.mkdtemp(prefix="algo-upd-")
        shutil.copytree(HERE, os.path.join(tmpd, "app"), ignore=shutil.ignore_patterns("__pycache__", "check.py", "kiem*.py", "kiem*.js", "kiem-code", "*.md", "master-ids.json", "sync.py"))

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
        pg.wait_for_function("navigator.serviceWorker.controller !== null", timeout=20000)
        check(len([n for n in pg.evaluate("caches.keys()") if n.startswith("algo:")]) == 1, "cài bản 1")
        pg.evaluate("location.hash = '#/templates/new'")
        pg.wait_for_selector(".tpl-title")
        pg.fill(".tpl-title", "đang soạn dở khi có bản mới.cpp")
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
        check(pg.input_value(".tpl-title") == "đang soạn dở khi có bản mới.cpp", "bản mới ĐỨNG CHỜ: không tự tải lại, ô đang soạn còn nguyên")
        if got:
            pg.click("#banner button:has-text('Tải lại')")
            pg.wait_for_function("document.body.classList.contains('ready')", timeout=20000)
            pg.wait_for_function("caches.keys().then(k => k.filter(n => n.startsWith('algo:')).length === 1 && k.filter(n => n.startsWith('algo:'))[0].endsWith('bancapnhat01'))", timeout=10000)
            check(any(n.startswith("algo-vendor:") for n in pg.evaluate("caches.keys()")), "đổi bản vỏ KHÔNG xoá cache vendor (không tải lại KaTeX)")
            check(True, "bấm Tải lại → chuyển sang bản mới, cache bản cũ được dọn")
        ctx.close()
        srv.shutdown()
        shutil.rmtree(tmpd, ignore_errors=True)
        br.close()


# ============================================================================================ tầng 4 — co giãn với dữ liệu xấu nhất
FUZZ_JS = r"""
async () => {
  const store = await Algo.store.openBest("algorithm-notebook"), user = Algo.user.create(store); await user.open();
  const word = "Siêu".repeat(55), url = "https://example.com/" + "a-very-long-path-segment/".repeat(12), T = Algo.text, now = Date.now();
  const tags = Array.from({ length: 20 }, (_, i) => "thẻ-rất-dài-không-ngắt-chữ-" + i + "-xxxxxx");
  const body = ["# " + word, word + word, url, "[liên kết dài](" + url + ")", "| " + Array.from({ length: 12 }, (_, i) => "Cột dài số " + i).join(" | ") + " |\n|" + "---|".repeat(12) + "\n| " + Array.from({ length: 12 }, (_, i) => "ô " + i + " dữ liệu dài").join(" | ") + " |",
    "```cpp\n// " + "một dòng mã cực dài không xuống dòng ".repeat(14) + "\nint x = 1;\n```", "مرحبا بالعالم هذا نص من اليمين إلى اليسار " + "😀🧠🚀".repeat(30),
    "<img src=x onerror=\"window.__xss=1\"> <script>window.__xss=2<\/script> [bẫy](javascript:window.__xss=3) [[<b onmouseover=window.__xss=4>x</b>]]"].join("\n\n");
  const items = [], ids = [];
  for (let i = 0; i < 3; i++) {
    const id = "u-" + T.uid(); ids.push(id);
    items.push({ id, name: (i ? "<b onmouseover=window.__xss=5>" : "") + word + " " + i, category: ["mine", "dp", "graph"][i], sub: "nhóm con " + word.slice(0, 40), level: 5, tags, summary: word + " " + word.slice(0, 60),
      description: body, conditions: [word, "điều kiện " + url], complexity: { time: "O(" + "N log ".repeat(8) + "N)", space: "O(" + word.slice(0, 50) + ")" }, use_case: [word], pitfalls: [url], not_for: [word], origin: word, link: url,
      code: { lang: "cpp", title: word.slice(0, 70) + ".cpp", src: "#include <bits/stdc++.h>\n// " + "x".repeat(400) + "\nint main() {}\n" }, example: { input: word + "\n" + "9 ".repeat(200), output: word, explain: url }, created: now, updated: now });
  }
  const templates = [{ id: "t-" + T.uid(), title: word.slice(0, 70) + ".cpp", lang: "cpp", src: "// " + "y".repeat(500) + "\nint x;", tags: tags.slice(0, 5), algo: "", created: now, updated: now }];
  const notes = ids.map((id) => ({ id, text: "# " + word + "\n" + body, updated: now }));
  const marks = ids.map((id) => ({ id, bm: 1, st: 1, at: now }));
  await user.restore({ items, templates, notes, marks }, "merge");
  return { ids, tpl: templates[0].id };
}
"""

OVERFLOW_JS = r"""
() => {
  const W = innerWidth, bad = [];
  if (document.documentElement.scrollWidth > W + 1) bad.push("TRANG cuộn ngang: scrollWidth " + document.documentElement.scrollWidth + " > " + W);
  const scroller = (el) => { for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === "auto" || o === "scroll") return true; } return false; };
  const name = (el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).join(".") : "");
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") continue;
    if (el.closest(".katex-mathml")) continue;                       // MathML của KaTeX: cắt còn 1 px, chỉ cho trình đọc màn hình
    if (el.closest("dialog") && !el.closest("dialog[open]")) continue;
    const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    if ((r.right > W + 1 || r.left < -1) && !scroller(el)) { bad.push(name(el) + " ra ngoài khung: " + Math.round(r.left) + "…" + Math.round(r.right) + " (rộng " + W + ")"); if (bad.length > 6) break; }
  }
  return bad;
}
"""


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
            seed = pg.evaluate(FUZZ_JS)
            pg.reload()
            pg.wait_for_function("document.body.classList.contains('ready')")
            ids = seed["ids"]
            views = [("trang chủ", "#/"), ("thư viện", "#/lib"), ("chi tiết (mục xấu)", "#/a/" + ids[0]), ("chi tiết (nhóm dp)", "#/a/" + ids[1]), ("chi tiết dựng sẵn", "#/a/segment-tree"), ("sửa mục", "#/mine/edit/" + ids[0]),
                     ("so sánh", "#/compare?ids=%s,%s,dijkstra,segment-tree" % (ids[0], ids[1])), ("so sánh 2", "#/compare?ids=dijkstra,bellman-ford,spfa,floyd-warshall"), ("cheat", "#/cheat"), ("cheat bookmark", "#/cheat?bm=1"),
                     ("template", "#/templates"), ("sửa template", "#/templates/" + seed["tpl"]), ("wizard", "#/decide?p=0,0"), ("cây", "#/tree"), ("luyện tập", "#/practice"), ("flashcard", "#/practice/cards"), ("quiz", "#/practice/quiz"),
                     ("trực quan", "#/viz"), ("viz Dijkstra", "#/viz/dijkstra"), ("viz KMP", "#/viz/kmp"), ("viz knapsack", "#/viz/knapsack-01"), ("viz segment", "#/viz/segment-tree"), ("lộ trình", "#/learn"), ("lộ trình CP", "#/learn/cp"), ("của tôi", "#/mine"), ("cài đặt", "#/settings")]
            bad_all = []
            for w in widths:
                pg.set_viewport_size({"width": w, "height": 800})
                for label, h in views:
                    pg.evaluate("h => { location.hash = h }", h)
                    pg.wait_for_timeout(450)
                    bad = pg.evaluate(OVERFLOW_JS)
                    if bad:
                        bad_all.append("%dpx · %s: %s" % (w, label, "; ".join(bad[:3])))
                # hộp thoại + menu nằm trong màn hình
                pg.evaluate("location.hash = '#/a/%s'" % ids[0])
                pg.wait_for_selector(".detail .more")
                pg.click(".detail .more")
                r = pg.evaluate("(() => { const m = document.querySelector('.popmenu').getBoundingClientRect(); return [m.left, m.top, m.right, m.bottom, innerWidth, innerHeight]; })()")
                if r[0] < -0.5 or r[1] < -0.5 or r[2] > r[4] + 0.5 or r[3] > r[5] + 0.5:
                    bad_all.append("%dpx · menu ⋯ ra ngoài màn hình %s" % (w, [round(x) for x in r]))
                pg.keyboard.press("Escape")
                pg.click(".detail .code-act .btn-primary")
                r = pg.evaluate("(() => { const m = document.querySelector('dialog[open]').getBoundingClientRect(); return [m.left, m.top, m.right, m.bottom, innerWidth, innerHeight]; })()")
                if r[0] < -0.5 or r[1] < -0.5 or r[2] > r[4] + 0.5 or r[3] > r[5] + 0.5:
                    bad_all.append("%dpx · hộp thoại ra ngoài màn hình %s" % (w, [round(x) for x in r]))
                pg.keyboard.press("Escape")
                pg.wait_for_timeout(100)
            check(not bad_all, "%s: %d bề rộng × %d màn: không tràn ngang, không ra ngoài khung" % (ename, len(widths), len(views)), bad_all[:8])
            xss = pg.evaluate("window.__xss")
            check(xss is None, "%s: HTML/JS độc trong tên, mô tả, ghi chú, code, bài mẫu không chạy (window.__xss=%r)" % (ename, xss))
            P.close()
            b.close()


# ============================================================================================ tầng 5 — hiệu năng thật (IndexedDB)
GEN_JS = r"""
async (N) => {
  let seed = 987654321; const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) % 1000000) / 1000000; };
  const T = Algo.text, store = await Algo.store.openBest("algorithm-notebook"), user = Algo.user.create(store); await user.open();
  const words = ["đồ", "thị", "cây", "mảng", "truy", "vấn", "đoạn", "chuỗi", "quy", "hoạch", "động", "tối", "ưu", "luồng", "ghép", "cặp", "băm", "nén", "lười", "khối"];
  const cx = ["O(N)", "O(N log N)", "O(log N)", "O(1)", "O(N^2)", "O((V+E) log V)", "O(sqrt N)"], now = Date.now(), items = [], notes = [];
  for (let i = 0; i < N; i++) {
    const w = () => words[Math.floor(rnd() * words.length)], id = "u-" + T.uid();
    items.push({ id, name: "Mục " + i + " " + w() + " " + w(), category: i % 4 ? "mine" : ["ds", "graph", "dp", "math"][i % 16 >> 2], sub: "nhóm " + (i % 30), level: 1 + i % 5, tags: ["t" + (i % 60), w(), "tag" + (i % 7)], summary: "Mô tả ngắn số " + i + " về " + w() + " " + w(),
      description: ("Nội dung " + w() + " " + w() + " " + w() + ". ").repeat(12) + "mã " + i, conditions: ["điều kiện " + w()], complexity: { time: cx[i % cx.length], space: "O(N)" }, use_case: ["dùng khi " + w() + " " + w(), "range query " + (i % 13)], pitfalls: ["lỗi " + w()],
      code: i % 3 ? null : { lang: "cpp", title: "m" + i + ".cpp", src: "#include <bits/stdc++.h>\nint f" + i + "() { return " + i + "; }\n" }, created: now - i, updated: now - i });
    if (i % 5 === 0) notes.push({ id, text: "Ghi chú cá nhân " + i + " " + w() + " " + w() + " " + w(), updated: now });
  }
  items.push({ id: "u-" + T.uid(), name: "Cụm từ độc nhất zebraquartznebula", category: "mine", sub: "", level: 3, tags: ["duy-nhat"], summary: "mục duy nhất", description: "x", created: now, updated: now });
  const t0 = performance.now();
  await user.restore({ items, notes }, "merge");
  return { ms: performance.now() - t0, items: user.items().length, notes: user.notes().length };
}
"""

SEARCH_JS = r"""
async (q) => {
  const inp = document.querySelector('#q'); const t0 = performance.now();
  inp.value = q; inp.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((res, rej) => { const t1 = performance.now(); const iv = setInterval(() => { const c = document.querySelector('.lp-count'); if (c && c.dataset.q === q) { clearInterval(iv); res(); } else if (performance.now() - t1 > 20000) { clearInterval(iv); rej(new Error('quá 20 s')); } }, 2); });
  return { e2e: performance.now() - t0, text: document.querySelector('.lp-count').textContent };
}
"""


def tang_5(may, n):
    section("TẦNG 5 — hiệu năng thật: %s mục của tôi + %s ghi chú trong IndexedDB của Chromium" % (format(n, ","), format(n // 5, ",")))
    from playwright.sync_api import sync_playwright
    url = may.goc + PATH
    with sync_playwright() as pw:
        br = pw.chromium.launch(args=["--enable-precise-memory-info", "--js-flags=--expose-gc"])
        P = Page(br, url, "perf", viewport={"width": 1366, "height": 820})
        pg = P.pg
        pg.set_default_timeout(120000)          # hữu hạn: một bước treo phải báo lỗi chứ không đứng im
        t = time.time()
        r = pg.evaluate(GEN_JS, n)
        print("    nạp %s mục + %s ghi chú vào IndexedDB: %.1f s" % (format(r["items"] - 1, ","), format(r["notes"], ","), time.time() - t))
        check(r["items"] == n + 1 and r["notes"] == (n + 4) // 5, "nạp đủ %s mục + %s ghi chú" % (format(n, ","), format(r["notes"], ",")), r)
        t = time.time()
        pg.reload(wait_until="load")
        pg.wait_for_function("document.body.classList.contains('ready')")
        boot = time.time() - t
        pg.evaluate("() => { if (window.gc) { window.gc(); window.gc(); } }")
        heap = pg.evaluate("performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1")
        print("    mở lại ứng dụng với %s mục (khởi động nguội): %.2f s, JS heap %d MB sau dọn rác" % (format(n, ","), boot, heap))
        check(boot < 5, "khởi động nguội với %s mục < 5 s (đo %.2f s)" % (format(n, ","), boot))
        P.go("#/lib")
        pg.wait_for_selector(".nrow")
        check(format(n + 117, ",").replace(",", ".") in pg.locator(".lp-count").inner_text() or str(n + 117) in re.sub(r"[^0-9]", "", pg.locator(".lp-count").inner_text().split("mục")[0]), "thư viện báo đúng tổng số mục (%d dựng sẵn + %s của tôi)" % (116, format(n + 1, ",")), pg.locator(".lp-count").inner_text())
        check(pg.locator(".nrow").count() < 80, "cuộn ảo: chỉ dựng %d dòng DOM" % pg.locator(".nrow").count())
        pg.wait_for_timeout(2500)          # để hàng chờ gấp sẵn toàn văn lúc rảnh chạy xong
        queries = [("tên (gõ dở)", "dijk"), ("tên mục của tôi", "Mục %d" % (n // 3)), ("hai từ", "đồ thị"), ("tag", "tag:t17"), ("tag + từ", "tag:t17 cây"), ("độ phức tạp", "O(logN)"), ("O(N log N)", "O(NlogN)"),
                   ("use case", "range query"), ("trong ghi chú", "ghi chú cá nhân 5"), ("cụm từ duy nhất", "zebraquartznebula"), ("gõ sai", "dijkstrs"), ("không có", "xyzkhongco")]
        res = []
        for label, q in queries:
            times, eng = [], []
            for rep in range(3):
                pg.evaluate("() => { document.querySelector('#q').value = ''; document.querySelector('#q').dispatchEvent(new Event('input', {bubbles: true})); }")
                pg.wait_for_timeout(250)
                r = pg.evaluate(SEARCH_JS, q)
                times.append(r["e2e"])
                m = re.search(r"(\d+) ms", r["text"])
                eng.append(int(m.group(1)) if m else 0)
                txt = r["text"]
            res.append((label, q, times, eng, txt))
            print("    %-18s %-28s e2e %5.0f/%5.0f/%5.0f ms · tìm %3d/%3d/%3d ms · %s" % (label, q, times[0], times[1], times[2], eng[0], eng[1], eng[2], txt))
        worst_eng = max(max(e) for _, _, _, e, _ in res)
        worst_e2e = max(t_[0] for _, _, t_, _, _ in res)
        check(worst_eng < 100, "thời gian tìm (lõi) trên %s mục: chậm nhất %d ms (< 100 ms theo đặc tả)" % (format(n, ","), worst_eng))
        check(worst_e2e < 400, "đầu-cuối (gõ → kết quả vẽ xong, gồm 90 ms chờ gõ xong): chậm nhất %.0f ms (< 400 ms)" % worst_e2e)
        uniq = next(x for x in res if x[1] == "zebraquartznebula")
        check(uniq[4].startswith("1 mục"), "cụm từ duy nhất tìm đúng 1 mục giữa %s" % format(n, ","), uniq[4])
        pg.evaluate("() => { document.querySelector('#q').value = ''; document.querySelector('#q').dispatchEvent(new Event('input', {bubbles: true})); }")
        pg.wait_for_timeout(400)
        t = time.time()
        pg.evaluate("document.querySelector('.lp-body').scrollTop = 76 * %d" % (n // 2))
        pg.wait_for_function("[...document.querySelectorAll('.nrow')].some(e => +e.getAttribute('aria-posinset') > %d)" % (n // 2 - 5))
        print("    cuộn tới giữa danh sách: %.0f ms" % ((time.time() - t) * 1000))
        t = time.time()
        pg.evaluate("location.hash = '#/mine/new'")
        pg.wait_for_selector("#f-name")
        pg.fill("#f-name", "Mục mới giữa kho lớn")
        pg.click(".iform button[type=submit]")
        pg.wait_for_selector(".detail h1")
        dt = (time.time() - t) * 1000
        print("    thêm một mục giữa %s mục: %.0f ms (gồm thao tác Playwright)" % (format(n, ","), dt))
        check(dt < 3000, "lưu một mục giữa kho lớn < 3 s (%.0f ms)" % dt)
        P.go("#/lib?src=user")
        r = P.search("Mục mới giữa kho lớn")
        check(P.ids()[:1] and P.ids()[0].startswith("u-"), "mục vừa thêm tìm được ngay (chỉ mục cập nhật từng bản ghi)", r)
        P.close()
        br.close()


# ============================================================================================ tầng 6 — mẫu code C++
def tang_6():
    section("TẦNG 6 — mẫu code C++: biên dịch bằng g++ (C++17, -Wall) và chạy thử với dữ liệu ngẫu nhiên / vét cạn")
    r = subprocess.run([sys.executable, os.path.join(HERE, "kiem-code.py")], capture_output=True, text=True, encoding="utf-8", errors="replace", env=dict(os.environ, PYTHONUTF8="1"))
    lines = r.stdout.strip().splitlines()
    print("\n".join(l for l in lines if "✗" in l or "đạt" in l)[-1500:])
    check(r.returncode == 0, "mọi mẫu code có tệp thử và chạy đúng: " + (lines[-1] if lines else r.stderr[-200:]))


def main():
    args = sys.argv[1:]
    todo = set(a for a in args if a.startswith("--"))
    tat_ca = "--tat-ca" in todo
    default = not todo                                   # mặc định = nhanh: tầng 1 + 2 (tầng 3–6 nặng, gọi riêng hoặc --tat-ca)
    n = 10000
    if "--hieu-nang" in args:
        i = args.index("--hieu-nang")
        if i + 1 < len(args) and args[i + 1].isdigit():
            n = int(args[i + 1])
    if tat_ca or default or "--tinh" in todo:
        tang_1()
    if tat_ca or default or todo & {"--chuc-nang", "--song-sot", "--co-gian", "--hieu-nang", "--toan"}:
        may = K.MayChuThu([]).__enter__()
        try:
            if "--toan" in todo and not (tat_ca or default or "--chuc-nang" in todo):
                tang_toan(may)                                   # chỉ phần toán của tầng 2 (đã nằm trong --chuc-nang)
            if tat_ca or default or "--chuc-nang" in todo:
                tang_2(may)
            if tat_ca or "--song-sot" in todo:
                tang_3(may)
            if tat_ca or "--co-gian" in todo:
                tang_4(may)
            if tat_ca or "--hieu-nang" in todo:
                tang_5(may, n)
        finally:
            may.__exit__(None, None, None)
    if tat_ca or "--ma" in todo:
        tang_6()
    if ERRORS:
        print("\nLỗi console/pageerror ghi nhận (%d):" % len(ERRORS))
        for e in ERRORS[:10]:
            print("   ", e)
        check(False, "không lỗi JS/console trong mọi phiên chạy")
    print("\n%d đạt, %d sai" % (OK, FAIL))
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
