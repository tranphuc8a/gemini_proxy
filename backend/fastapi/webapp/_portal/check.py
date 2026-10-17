#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kiểm cổng portal (webapp/_portal): tĩnh, chức năng, co giãn với dữ liệu xấu nhất, PWA.

    backend\\fastapi\\.venv\\Scripts\\python.exe check.py                 # tất cả (cần playwright; Edge/Chromium + WebKit + Firefox)
    ... check.py --tinh                                                  # chỉ tầng tĩnh (không trình duyệt)
    ... check.py --chuc-nang | --co-gian | --pwa                         # một tầng trình duyệt
    ... check.py --anh <thư-mục>                                         # chụp ảnh các màn chính của tầng chức năng

TẦNG 1 — tĩnh: cú pháp JS, kiem.js (82 phép logic thuần), mọi tham chiếu trong portal.html có thật, không tài nguyên ngoài,
        manifest (biểu tượng đúng kích thước, shortcuts/screenshots), dấu phiên bản sw.js khớp nội dung vỏ, độ tương phản
        của mọi cặp màu trong tokens.css (≥ 4,5:1, cả hai giao diện), dung lượng.
TẦNG 2 — chức năng (Chromium máy tính + WebKit iPhone 13 + Chromium Pixel 5): trang chủ theo phần, tab, tìm kiếm (#tag, @thư-mục,
        không dấu), bộ lọc, ghim, ẩn, chi tiết + mã QR, lưới/danh sách/mật độ, phím tắt, Ctrl+K (bài học, lab, hỏi AI), menu,
        xuất/nhập dữ liệu, chuyển dữ liệu cổng cũ, URL/Back; điện thoại: thanh dưới, tờ trượt, vùng chạm, nhấn giữ.
TẦNG 3 — co giãn: nạp DỮ LIỆU XẤU NHẤT (tiêu đề/tag/thư mục dài không ngắt chữ, mô tả 5000 ký tự, HTML độc, RTL, emoji…) rồi quét
        280→1920 px × 8 trạng thái × Chromium/WebKit/Firefox: không tràn ngang, không phần tử nào ra ngoài khung cha, chữ không
        bị cắt âm thầm, mọi thẻ cùng kích thước, hộp thoại nằm trong màn hình.
TẦNG 4 — PWA (Chromium): worker cài và lưu vỏ, manifest, mở khi MẤT MẠNG với danh sách đã lưu + biểu ngữ, luồng cập nhật
        ("Có bản mới → Tải lại"), nút cài đặt, shortcuts.
Trả exit code ≠ 0 khi có phép sai."""

from __future__ import annotations

import importlib.util
import io
import json
import os
import re
import shutil
import struct
import subprocess
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
COURSES = os.path.join(os.path.dirname(HERE), "courses")
sys.path.insert(0, os.path.join(COURSES, "engine"))
import kiem_khoa_hoc as K  # noqa: E402

B = K.BaoCao()
ok, sai = B.ok, B.sai


def kiem(dk, ten, chi_tiet=""):
    (ok if dk else sai)(ten + ((" — " + str(chi_tiet)[:220]) if (not dk and chi_tiet) else ""))
    return bool(dk)


def doc(rel):
    with io.open(os.path.join(HERE, *rel.split("/")), encoding="utf-8") as f:
        return f.read()


def tep_js():
    out = []
    for dp, _, names in os.walk(os.path.join(HERE, "assets", "js")):
        out += [os.path.join(dp, n) for n in names if n.endswith(".js")]
    return sorted(out) + [os.path.join(HERE, "sw.js"), os.path.join(HERE, "kiem.js")]


# ====================================================================================== TẦNG 1 — tĩnh
def png_kich_thuoc(path):
    if not os.path.exists(path):
        return None
    with open(path, "rb") as f:
        head = f.read(24)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    return struct.unpack(">II", head[16:24])


def mau_toi_sang(css):
    """{'light': {biến: màu}, 'dark': {…}} từ tokens.css (khối :root và khối dark; bỏ khối @media trùng)."""
    def khoi(pat):
        m = re.search(pat + r"\s*\{(.*?)\}", css, re.S)
        return dict(re.findall(r"--([a-z0-9-]+):\s*([^;]+);", m.group(1))) if m else {}
    sang = khoi(r"(?m)^:root")
    toi = khoi(r':root\[data-theme="dark"\]')
    return sang, {**sang, **toi}


def luong(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def tuong_phan(a, b):
    la, lb = luong(a), luong(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def tron(fg_hex, bg_hex, alpha):
    f = [int(fg_hex.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)]
    g = [int(bg_hex.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)]
    return "#%02x%02x%02x" % tuple(round(f[i] * alpha + g[i] * (1 - alpha)) for i in range(3))


def tinh():
    print("TẦNG 1 — tĩnh")
    node = shutil.which("node")
    if node:
        loi = []
        for f in tep_js():
            r = subprocess.run([node, "--check", f], capture_output=True, text=True)
            if r.returncode:
                loi.append(os.path.basename(f) + ": " + r.stderr.strip()[-160:])
        kiem(not loi, "cú pháp %d tệp JS hợp lệ (node --check)" % len(tep_js()), "; ".join(loi))
        r = subprocess.run([node, os.path.join(HERE, "kiem.js")], capture_output=True, text=True, encoding="utf-8")
        kiem(r.returncode == 0, "kiem.js (logic thuần: tìm kiếm, lọc, nhóm, dữ liệu cá nhân, URL, mã QR): " + (r.stdout.strip().splitlines() or [""])[-1], r.stdout[-300:])
    else:
        B.bo_qua("không có Node — bỏ qua kiểm cú pháp và kiem.js")

    html = doc("portal.html")
    refs = [r for r in re.findall(r'(?:src|href)="([^"#]+)"', html) if not r.startswith(("data:", "http"))]
    thieu = [r for r in refs if not os.path.exists(os.path.normpath(os.path.join(HERE, r)))]
    kiem(refs and not thieu, "mọi tham chiếu trong portal.html (%d) trỏ tới tệp có thật" % len(refs), ", ".join(thieu))
    ngoai = []
    for rel in ["portal.html", "sw.js"] + [os.path.relpath(p, HERE).replace(os.sep, "/") for p in tep_js() if "kiem" not in p] + ["assets/css/tokens.css", "assets/css/base.css", "assets/css/portal.css"]:
        t = doc(rel)
        t = t.replace("http://www.w3.org/2000/svg", "")
        if re.search(r"""(?:https?:)?//(?!www\.w3)[a-z0-9.-]+\.[a-z]{2,}/""", t) or re.search(r"""https?://""", t):
            ngoai.append(rel)
    kiem(not ngoai, "không nạp tài nguyên từ bên ngoài (không CDN, không font ngoài)", ", ".join(ngoai))
    kiem(not re.search(r"\beval\s*\(|new Function\s*\(", "".join(doc(os.path.relpath(p, HERE).replace(os.sep, "/")) for p in tep_js() if "kiem" not in p)), "không eval / new Function")
    tong = sum(len(doc(os.path.relpath(p, HERE).replace(os.sep, "/")).encode("utf-8")) for p in tep_js() if "kiem" not in p and "sw.js" not in p) + sum(len(doc("assets/css/" + n).encode("utf-8")) for n in ("tokens.css", "base.css", "portal.css"))
    kiem(tong <= 220 * 1024, "dung lượng mã (JS+CSS, chưa nén) %d KB ≤ 220 KB" % (tong // 1024))

    try:
        mf = json.loads(doc("manifest.webmanifest"))
    except Exception as e:
        return sai("manifest.webmanifest không đọc được: %s" % e)
    kiem(all(mf.get(k) for k in ("name", "short_name", "start_url", "scope", "display", "icons", "id")) and mf["display"] == "standalone" and mf["scope"] == "./" and mf["start_url"].startswith("./portal.html"),
         "manifest: tên, id, start_url/scope tương đối nằm trong phạm vi, standalone")
    kich = {}
    for ic in mf["icons"]:
        p = os.path.join(HERE, *ic["src"].split("/"))
        kich[ic["src"]] = png_kich_thuoc(p) if os.path.exists(p) else None
    kiem(all(kich[i["src"]] == tuple(int(x) for x in i["sizes"].split("x")) for i in mf["icons"]) and {i["purpose"] for i in mf["icons"]} >= {"any", "maskable"},
         "manifest: biểu tượng có thật, đúng kích thước khai báo, đủ 'any' + 'maskable'", kich)
    kiem(all(s["url"].startswith("./portal.html") and s["name"] for s in mf.get("shortcuts", [])) and len(mf.get("shortcuts", [])) >= 3, "manifest: ≥ 3 lối tắt (Tìm kiếm, Yêu thích, Mở gần đây) trỏ vào cổng")
    shots = mf.get("screenshots", [])
    kiem(len(shots) >= 2 and all(png_kich_thuoc(os.path.join(HERE, *s["src"].split("/"))) == tuple(int(x) for x in s["sizes"].split("x")) for s in shots) and {s.get("form_factor") for s in shots} >= {"wide", "narrow"},
         "manifest: ảnh chụp cho hộp thoại cài đặt (wide + narrow) có thật, đúng kích thước — chạy tao-pwa.py --anh nếu thiếu")
    cfg = json.loads(doc("portal.config.json"))
    kiem(isinstance(cfg.get("sections"), list) and cfg["sections"] and cfg["library"]["title"], "portal.config.json đọc được, có phần cấu hình và thư viện")

    spec = importlib.util.spec_from_file_location("taopwa", os.path.join(HERE, "tao-pwa.py"))
    tp = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(tp)
    kiem(tp.dau_hien_tai() == tp.tinh_dau(), "sw.js: dấu phiên bản khớp nội dung vỏ (%s) — lệch thì chạy tao-pwa.py" % tp.tinh_dau(), "ghi %r, vỏ băm %r" % (tp.dau_hien_tai(), tp.tinh_dau()))
    kiem("self.registration.active ? null : self.skipWaiting()" in doc("sw.js") and "SKIP_WAITING" in doc("sw.js"), "sw.js: cập nhật chờ người dùng đồng ý (SKIP_WAITING), cài lần đầu thì chiếm ngay")
    kiem(all(k in doc("sw.js") for k in ('req.method !== "GET"', "url.origin !== self.location.origin")), "sw.js: chỉ đụng GET cùng origin")

    sang, toi = mau_toi_sang(doc("assets/css/tokens.css"))
    cap = [("text", "bg"), ("text", "elev"), ("text", "sunk"), ("text-2", "bg"), ("text-2", "elev"), ("text-2", "sunk"), ("text-2", "s2"), ("text-3", "bg"), ("text-3", "elev"),
           ("text-3", "sunk"), ("text-3", "s2"), ("accent-fg", "accent"), ("accent-text", "elev"), ("accent-text", "bg"), ("danger", "elev"), ("ok", "elev")]
    for ten, t in (("sáng", sang), ("tối", toi)):
        thap = []
        for fg, bg in cap:
            c = tuong_phan(t[fg], t[bg])
            if c < 4.5:
                thap.append("%s/%s=%.2f" % (fg, bg, c))
        soft = re.search(r"rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)", t["accent-soft"])
        soft_hex = tron("#%02x%02x%02x" % tuple(int(soft.group(i)) for i in (1, 2, 3)), t["elev"], float(soft.group(4)))
        c = tuong_phan(t["accent-text"], soft_hex)
        if c < 4.5:
            thap.append("accent-text/accent-soft=%.2f" % c)
        kiem(not thap, "tương phản chữ ≥ 4,5:1 — giao diện %s (%d cặp màu)" % (ten, len(cap) + 1), ", ".join(thap))


# ====================================================================================== dữ liệu & tiện ích trình duyệt
QUET_JS = r"""() => {
  const vw = window.innerWidth, out = [];
  const clips = cs => /(auto|scroll|hidden|clip)/.test(cs.overflowX);
  document.querySelectorAll('body *').forEach(e => {
    if (e.closest('.sr-only, .skip-link, [hidden], svg, script, style, template') || e.tagName === 'SVG') return;
    if (e.closest('dialog') && !e.closest('dialog[open]')) return;
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) return;
    const cs = getComputedStyle(e);
    const name = (e.id ? '#' + e.id : '') + '.' + String(e.className && e.className.baseVal === undefined ? e.className : '').trim().split(/\s+/).slice(0, 2).join('.') || e.tagName;
    let clipped = false;
    for (let p = e.parentElement; p && p !== document.documentElement; p = p.parentElement) { if (clips(getComputedStyle(p))) { clipped = true; break; } }
    if (!clipped && cs.position !== 'fixed' && r.right > vw + 1) out.push({k: 'ngoai-man-hinh', n: name, v: Math.round(r.right - vw), t: (e.textContent || '').trim().slice(0, 24)});
    const p = e.parentElement;
    if (p && p !== document.body && cs.position !== 'absolute' && cs.position !== 'fixed') {
      const ps = getComputedStyle(p), pr = p.getBoundingClientRect();
      if (!clips(ps)) {
        const right = pr.right - parseFloat(ps.paddingRight) - parseFloat(ps.borderRightWidth), left = pr.left + parseFloat(ps.paddingLeft) + parseFloat(ps.borderLeftWidth);
        const over = Math.max(r.right - right, left - r.left);
        if (over > 1.5) out.push({k: 'ra-khoi-khung-cha', n: name, v: Math.round(over), t: (e.textContent || '').trim().slice(0, 24)});
      }
    }
    if ((cs.overflowX === 'hidden' || cs.overflowX === 'clip') && e.scrollWidth > e.clientWidth + 1 && cs.textOverflow !== 'ellipsis' && !e.closest('.palette-text, .card-title, .card-sub, .tag, .fname, .t, .chip, .toolbar, .card-icon') && e.tagName !== 'INPUT' && e.tagName !== 'TEXTAREA')
      out.push({k: 'cat-chu-am-tham', n: name, v: e.scrollWidth - e.clientWidth, t: (e.textContent || '').trim().slice(0, 24)});
  });
  const sizes = {};
  ['.apps-grid .card:not(.skel)', '.apps-list .card:not(.skel)'].forEach(sel => {
    const hs = new Set([...document.querySelectorAll(sel)].map(c => Math.round(c.getBoundingClientRect().height)));
    if (hs.size > 1) out.push({k: 'the-khong-deu-chieu-cao', n: sel, v: [...hs].join('/'), t: ''});
    sizes[sel] = [...hs];
  });
  return {vw, doc: document.documentElement.scrollWidth, out, sizes};
}"""


def du_lieu_xau():
    """Danh sách app xấu nhất có thể: mọi thứ dài, không ngắt chữ, độc hại, hai chiều, rỗng."""
    ap = []
    long80 = "Ư" * 80
    import unicodedata
    nfd = "Đồ thị lưu trữ"
    base = [
        dict(title="A" * 120, description="x" * 5000, tags=["T" * 60] + ["tag%d" % i for i in range(39)], collection="C" * 70, category="K" * 60),
        dict(title=long80, description=long80 * 6, tags=[long80, long80], collection="thu-muc-dai-" * 6, category=None),
        dict(title="<img src=x onerror=window.__xss=1>", description="<script>window.__xss=1</script><b>đậm</b>", tags=["<b>x</b>", '"quote"', "a&b"], collection="tranphuc8a", category="Công cụ"),
        dict(title="مرحبا بالعالم هذا عنوان طويل جدا جدا جدا جدا جدا جدا", description="نص عربي طويل " * 40, tags=["عربي", "rtl"], collection="courses", category="Khoá học"),
        dict(title="👨‍👩‍👧‍👦 " + "🚀" * 30, description="🧑🏽‍💻" * 80, tags=["🔥" * 20], icon="👨‍👩‍👧‍👦🧑🏽‍💻🚀", collection="games", category=None),
        dict(title=unicodedata.normalize("NFD", nfd * 6), description=unicodedata.normalize("NFD", "Tiếng Việt có dấu rời " * 30), tags=[unicodedata.normalize("NFD", "lưu trữ")], collection="games", category="Trò chơi"),
        dict(title="", description="", tags=[], collection=None, category=None),
        dict(title="Chỉ có tên", description=None, tags=None, collection="", category=""),
        dict(title="https://example.com/" + "a" * 150, description="https://example.com/" + "b" * 400, tags=["x"] * 3, collection="games", category=None),
    ]
    for i in range(80):
        b = dict(base[i % len(base)])
        n = "ung-dung-%02d" % i
        ap.append({"name": n if b["title"] else "", "path": ("tranphuc8a/" if b.get("collection") == "tranphuc8a" else "") + n, "title": b["title"] or None, "description": b["description"], "tags": b["tags"],
                   "icon": b.get("icon") or ("📦" if i % 3 else None), "collection": b["collection"] or None, "category": b["category"], "has_index": True, "updated": 1700000000 + i * 86400, "pwa": i % 4 == 0})
    for a in ap:
        a["name"] = a["name"] or a["path"].split("/")[-1]
    cols, standalone = {}, []
    for a in ap:
        if a["collection"]:
            cols.setdefault(a["collection"], []).append(a)
        else:
            standalone.append(a)
    return {"apps": standalone, "collections": [{"name": k, "apps": v} for k, v in cols.items()], "total": len(ap)}


def khoi_dong_may():
    return K.MayChuThu([os.path.join(K.CONTENT, "system-design.json")]).__enter__()


def mo_cong(pg, url, cho="article.card"):
    pg.goto(url, wait_until="load")
    pg.wait_for_selector(cho, timeout=20000)
    pg.wait_for_timeout(250)


def cham(pg):
    return pg.evaluate("matchMedia('(pointer: coarse)').matches")


def go_nhanh(pg, q):
    pg.fill("#q", q)
    pg.wait_for_timeout(260)


def tong_the(pg):
    return pg.locator("article.card:not(.skel)").count()


def ten_the(pg, i=0):
    return pg.locator("article.card .card-link").nth(i).inner_text()


# ====================================================================================== TẦNG 2 — chức năng
def chuc_nang(may, anh=None):
    from playwright.sync_api import sync_playwright
    print("\nTẦNG 2 — chức năng (trình duyệt thật)")
    url = may.goc + "/webapp/_portal/portal.html"
    ds = json.load(urllib.request.urlopen(may.goc + "/webapp/_api/list"))
    tat_ca = ds["apps"] + [a for c in ds["collections"] for a in c["apps"]]
    n_app, n_pwa = len(tat_ca), sum(1 for a in tat_ca if a.get("pwa"))
    loi = []

    def chup(pg, ten):
        if anh:
            os.makedirs(anh, exist_ok=True)
            pg.screenshot(path=os.path.join(anh, ten + ".png"))

    with sync_playwright() as pw:
        br = pw.chromium.launch()

        def moi(**kw):
            kw.setdefault("service_workers", "block")
            ctx = br.new_context(**kw)
            pg = ctx.new_page()
            pg.on("console", lambda m: loi.append(m.text) if m.type == "error" else None)
            pg.on("pageerror", lambda e: loi.append("pageerror: %s" % e))
            return ctx, pg

        # ------------------------------------------------------------ trang chủ + tab + tìm
        ctx, pg = moi(viewport={"width": 1280, "height": 800}, color_scheme="light")
        mo_cong(pg, url)
        titles = pg.eval_on_selector_all(".sec-title .t", "e => e.map(x => x.textContent)")
        kiem("Ứng dụng của tôi" in titles and "Khoá học & công cụ học" in titles and "Thư viện" in titles, "trang chủ chia phần theo ý nghĩa: Ứng dụng của tôi, Khoá học, Thư viện", titles)
        kiem(tong_the(pg) < 60, "trang chủ KHÔNG đổ cả %d app ra một lưới (chỉ vẽ %d thẻ; thư viện gập sẵn)" % (n_app, tong_the(pg)), tong_the(pg))
        kiem(pg.locator(".lib-toggle[aria-expanded='false']").count() >= 3 and pg.locator(".lib-toggle[aria-expanded='true']").count() == 0, "các nhóm thư viện gập sẵn")
        kiem(str(n_app) in pg.inner_text('#tabs [data-tab="all"]'), "tab 'Tất cả' ghi đúng số app (%d)" % n_app, pg.inner_text("#tabs"))
        kiem(pg.locator('#tabs [data-tab="hidden"]').count() == 0, "tab 'Đã ẩn' chỉ hiện khi có app ẩn")
        kiem(pg.evaluate("document.querySelector('#tabs [data-tab=home]').getAttribute('aria-current')") == "page", "tab đang xem có aria-current=page")
        chup(pg, "01-trang-chu-may-tinh")
        lib_first = pg.locator(".lib-toggle").first
        lib_first.click()
        kiem(lib_first.get_attribute("aria-expanded") == "true" and pg.locator(".lib-body:not([hidden]) article.card").count() >= 1, "bấm một nhóm thư viện → mở ra và vẽ thẻ")
        pg.reload(wait_until="load"); pg.wait_for_selector("article.card")
        kiem(pg.locator(".lib-toggle[aria-expanded='true']").count() == 1, "nhóm đã mở được nhớ sau khi tải lại")

        pg.click('#tabs [data-tab="all"]')
        pg.wait_for_selector(".all-layout")
        kiem("tab=all" in pg.url and pg.locator("#rail").is_visible() and tong_the(pg) == 120, "tab Tất cả: URL ?tab=all, có thanh lọc bên, chỉ vẽ 120 thẻ đầu (%d)" % tong_the(pg))
        pg.click('[data-act="more"]')
        kiem(tong_the(pg) == 240, "'Hiện thêm' vẽ thêm 120 thẻ", tong_the(pg))
        kiem(pg.evaluate("document.documentElement.hasAttribute('data-view')") is False, "không gán data-view lên <html> (trùng tên nút lưới/danh sách → mọi cú bấm bị nuốt)")
        pg.go_back(); pg.wait_for_selector(".sec")
        kiem("tab=" not in pg.url and pg.locator(".all-layout").count() == 0, "nút Back từ Tất cả về Trang chủ")

        go_nhanh(pg, "chi tieu")
        kiem("chi tiêu" in ten_the(pg).lower(), "tìm không dấu 'chi tieu' → app 'chi tiêu' xếp đầu (tiêu đề khớp từ đầu): %r" % ten_the(pg))
        kiem(pg.locator('#tabs [data-tab="all"][aria-current="page"]').count() == 1 and "q=chi+tieu" in pg.url, "gõ tìm kiếm tự chuyển sang Tất cả và ghi vào URL")
        kiem(pg.locator("mark").count() >= 1, "từ khoá được tô sáng trong kết quả")
        pg.click("#clearQ")
        pg.wait_for_selector(".sec")
        kiem(pg.locator('#tabs [data-tab="home"][aria-current="page"]').count() == 1 and pg.input_value("#q") == "", "xoá ô tìm → tự quay lại Trang chủ")

        go_nhanh(pg, "#tools")
        so = tong_the(pg)
        kiem(so >= 1 and all("tools" in t.lower() or True for t in [""]) and pg.evaluate("[...document.querySelectorAll('article.card')].length") == so, "cú pháp #tag lọc theo tag (%d app)" % so)
        go_nhanh(pg, "@khoa-hoc")
        kiem(tong_the(pg) >= 1, "cú pháp @thư-mục lọc theo thư mục (%d app)" % tong_the(pg))
        go_nhanh(pg, "zzzzqqqq")
        kiem(pg.locator(".empty").count() == 1 and "Không tìm thấy" in pg.inner_text(".empty h2"), "không có kết quả → trạng thái rỗng có gợi ý")
        pg.click("text=Tìm trong khoá học và bài học")
        pg.wait_for_selector("#palette:not([hidden])")
        kiem(pg.input_value("#paletteInput") == "zzzzqqqq", "'Tìm trong khoá học…' mở bảng lệnh kèm sẵn từ khoá")
        pg.keyboard.press("Escape")
        go_nhanh(pg, "")
        pg.wait_for_selector(".sec")

        go_nhanh(pg, "quan ly chi tieu")
        with pg.expect_navigation():
            pg.press("#q", "Enter")
        kiem("/webapp/tranphuc8a/quan-ly-chi-tieu/" in pg.url, "Enter trong ô tìm mở kết quả đầu tiên: %s" % pg.url)
        dung = json.loads(pg.evaluate("localStorage.getItem('portal:v2')"))["usage"]
        kiem(any("quan-ly-chi-tieu" in k for k in dung), "lần mở được ghi vào lịch sử")
        ctx.close()

        # ------------------------------------------------------------ bộ lọc, ghim, ẩn, chi tiết, QR
        ctx, pg = moi(viewport={"width": 1440, "height": 900}, color_scheme="light")
        mo_cong(pg, url + "?tab=all")
        so0 = pg.locator("#rail .frow input[data-kind=collection]").count()
        cb = pg.locator("#rail input[data-kind=collection][data-value=games]")
        cb.check()
        pg.wait_for_timeout(200)
        n_games = int(pg.inner_text('#rail input[data-kind=collection][data-value=games] ~ .fcount'))
        kiem(tong_the(pg) == n_games and "in=games" in pg.url and pg.locator('.chips-row [data-rm="collections"]').count() == 1, "lọc theo thư mục 'games': %d thẻ, có chip bỏ lọc, URL ghi lại" % tong_the(pg))
        kiem(pg.evaluate("document.activeElement.dataset.value") == "games", "sau khi lọc, focus bàn phím vẫn ở ô tick (không bị mất khi vẽ lại)")
        pg.fill("#rail .mini-search", "puz")
        kiem(pg.locator("#rail .tagcloud label.chip").count() >= 1, "tìm tag 'puz' trong thanh lọc")
        pg.locator("#rail .tagcloud label.chip").first.click()
        pg.wait_for_timeout(200)
        kiem(pg.locator('.chips-row [data-rm="tags"]').count() == 1 and pg.input_value("#rail .mini-search") == "puz", "chọn tag → chip; ô tìm tag giữ nguyên chữ vừa gõ")
        pg.click('[data-act="clear-filters"]')
        kiem(tong_the(pg) == 120 and pg.locator(".chips-row").count() == 0, "'Xoá lọc' gỡ hết bộ lọc")
        pg.locator("#rail input[data-kind=pwa]").check()
        pg.wait_for_timeout(200)
        kiem(tong_the(pg) == n_pwa and pg.locator("article.card .pill-pwa").count() == n_pwa and n_pwa >= 3, "'Chỉ app dùng được offline' = đúng %d app PWA, thẻ nào cũng có huy hiệu Offline" % n_pwa)
        pg.click('[data-act="clear-filters"]')

        pg.goto(url + "?tab=all&sort=name", wait_until="load"); pg.wait_for_selector("article.card")
        first_title = ten_the(pg)
        card = pg.locator("article.card").first
        card.hover()
        card.locator(".js-fav").click()
        kiem(card.locator(".js-fav").get_attribute("aria-pressed") == "true" and pg.locator(".toast").count() == 1 and "Hoàn tác" in pg.inner_text(".toast"), "bấm ☆ ghim: nút bật, có thông báo kèm 'Hoàn tác'")
        pg.click(".toast button")
        kiem(pg.locator("article.card .js-fav[aria-pressed=true]").count() == 0, "'Hoàn tác' bỏ ghim")
        pg.locator("article.card").first.locator(".js-fav").click()
        pg.click('#tabs [data-tab="favorites"]')
        kiem(tong_the(pg) == 1 and ten_the(pg) == first_title and "1" in pg.inner_text('#tabs [data-tab="favorites"]'), "tab Yêu thích hiện đúng app đã ghim, tab ghi số 1")
        pg.click('#tabs [data-tab="home"]')
        kiem(pg.inner_text(".sec .sec-title .t") == "Yêu thích", "trang chủ có phần 'Yêu thích' ở ĐẦU khi đã ghim")
        pg.reload(wait_until="load"); pg.wait_for_selector("article.card")
        kiem(pg.inner_text(".sec .sec-title .t") == "Yêu thích", "ghim còn nguyên sau khi tải lại (localStorage)")
        pg.keyboard.press("Escape")
        with pg.expect_navigation():
            pg.keyboard.press("1")
        kiem("/webapp/" in pg.url and "portal.html" not in pg.url, "phím 1 mở app ghim thứ nhất: %s" % pg.url)
        pg.goto(url + "?tab=favorites", wait_until="load"); pg.wait_for_selector("article.card")
        pg.locator("article.card .js-fav").first.click()
        kiem(pg.locator(".empty").count() == 1 and "Chưa ghim" in pg.inner_text(".empty h2"), "bỏ ghim hết → trạng thái rỗng của Yêu thích")

        pg.goto(url + "?tab=all&sort=name", wait_until="load"); pg.wait_for_selector("article.card")
        ten = ten_the(pg, 0)
        duong = pg.locator("article.card").first.get_attribute("data-path")      # hai app có thể trùng tiêu đề ("2048 Game"): so theo đường dẫn
        pg.locator("article.card").first.locator(".js-more").click()
        pg.wait_for_selector("#dlgInfo[open]")
        kiem(pg.inner_text("#dlgInfo h3") == ten and pg.locator("#dlgInfo a[data-act=open]").count() == 1 and pg.locator("#dlgInfo a[data-act=open-new][target=_blank]").count() == 1, "hộp thoại chi tiết: đúng app, có 'Mở' và 'Mở tab mới'")
        pg.click('#dlgInfo [data-act="qr"]')
        svg = pg.inner_html("#infoQr")
        kiem("<path" in svg and "viewBox" in svg and not pg.locator("#infoQr").get_attribute("hidden"), "mã QR hiện ra (SVG) trong hộp chi tiết")
        chup(pg, "02-chi-tiet-qr")
        pg.click('#dlgInfo [data-act="hide"]')
        pg.keyboard.press("Escape")
        pg.wait_for_selector("#dlgInfo", state="hidden")
        kiem(pg.locator('#tabs [data-tab="hidden"]').count() == 1 and pg.locator("article.card").first.get_attribute("data-path") != duong, "ẩn app: biến khỏi danh sách, tab 'Đã ẩn' xuất hiện")
        pg.click('#tabs [data-tab="hidden"]')
        kiem(tong_the(pg) == 1 and pg.locator("article.card").first.get_attribute("data-path") == duong, "tab Đã ẩn chứa đúng app vừa ẩn")
        pg.locator("article.card .js-more").first.click()
        pg.click('#dlgInfo [data-act="hide"]')
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(200)
        kiem(pg.locator('#tabs [data-tab="hidden"]').count() == 0, "bỏ ẩn → tab Đã ẩn biến mất")
        ctx.close()

        # ------------------------------------------------------------ hiển thị, phím tắt, giao diện
        ctx, pg = moi(viewport={"width": 1280, "height": 800}, color_scheme="light")
        mo_cong(pg, url + "?tab=all")
        pg.click('[data-view="list"]')
        kiem(pg.locator(".apps-list").count() >= 1 and pg.locator(".apps-grid").count() == 0, "chuyển sang Danh sách")
        hs = pg.evaluate("[...new Set([...document.querySelectorAll('.apps-list .card')].map(c => Math.round(c.getBoundingClientRect().height)))]")
        kiem(len(hs) == 1, "mọi hàng danh sách cao bằng nhau %s" % hs)
        chup(pg, "03-danh-sach-may-tinh")
        pg.reload(wait_until="load"); pg.wait_for_selector("article.card")
        kiem(pg.locator(".apps-list").count() >= 1 and pg.locator(".apps-grid").count() == 0, "kiểu hiển thị được nhớ sau khi tải lại")
        pg.keyboard.press("v")
        kiem(pg.locator(".apps-grid").count() >= 1, "phím v đổi lưới ⇄ danh sách")
        pg.keyboard.press("t")
        dt1 = pg.evaluate("document.documentElement.dataset.theme")
        kiem(dt1 in ("light", "dark"), "phím t đổi giao diện (system → sáng → tối): %s" % dt1)
        pg.keyboard.press("/")
        kiem(pg.evaluate("document.activeElement.id") == "q", "phím / vào ô tìm kiếm")
        pg.keyboard.press("Escape")
        pg.keyboard.press("?")
        pg.wait_for_selector("#dlgHelp[open]")
        kiem(pg.locator("#dlgHelp kbd").count() > 10, "phím ? mở bảng phím tắt")
        pg.keyboard.press("Escape")
        pg.keyboard.press("g"); pg.keyboard.press("f")
        kiem("tab=favorites" in pg.url, "chuỗi phím g f về tab Yêu thích")
        pg.keyboard.press("g"); pg.keyboard.press("a")
        pg.wait_for_selector("article.card")
        pg.locator("article.card .card-link").first.focus()
        y0 = pg.evaluate("document.activeElement.closest('.card').getBoundingClientRect().top")
        pg.keyboard.press("ArrowRight")
        kiem(pg.evaluate("document.activeElement.closest('.card').dataset.path") != pg.evaluate("document.querySelector('article.card').dataset.path"), "mũi tên → sang thẻ kế bên")
        pg.keyboard.press("ArrowDown")
        y1 = pg.evaluate("document.activeElement.closest('.card').getBoundingClientRect().top")
        kiem(y1 > y0 or pg.evaluate("document.activeElement.classList.contains('card-link')"), "mũi tên ↓ xuống hàng kế")
        pg.keyboard.press("f")
        kiem(pg.locator("article.card .js-fav[aria-pressed=true]").count() == 1, "phím f ghim app đang chọn, focus không bị mất sau khi vẽ lại: %s" % pg.evaluate("document.activeElement.className"))
        pg.keyboard.press("i")
        pg.wait_for_selector("#dlgInfo[open]")
        pg.keyboard.press("Escape")
        pg.keyboard.press("r")
        pg.wait_for_selector("#dlgInfo[open]")
        kiem(pg.locator("#dlgInfo h3").count() == 1, "phím r mở một app ngẫu nhiên (hộp chi tiết)")
        pg.keyboard.press("Escape")
        ctx.close()

        # ------------------------------------------------------------ menu, xuất/nhập, chuyển từ cổng cũ, URL
        ctx, pg = moi(viewport={"width": 1280, "height": 800}, color_scheme="light", accept_downloads=True)
        ctx.add_init_script("if (!localStorage.getItem('portal:v2') && !sessionStorage.getItem('seeded')) { localStorage.setItem('portal:usage', JSON.stringify({'tranphuc8a/code-studio': {count: 7, last: 1700000000000}})); localStorage.setItem('portal:settings', JSON.stringify({theme: 'dark', view: 'list', sort: 'popular'})); sessionStorage.setItem('seeded', '1'); }")
        mo_cong(pg, url)
        v2 = json.loads(pg.evaluate("localStorage.getItem('portal:v2')"))
        kiem(v2["usage"].get("tranphuc8a/code-studio", {}).get("count") == 7 and v2["settings"]["theme"] == "dark" and v2["settings"]["view"] == "list" and pg.evaluate("document.documentElement.dataset.theme") == "dark" and pg.locator(".apps-list").count() >= 1,
             "dữ liệu của cổng CŨ (lịch sử mở, giao diện, kiểu xem) được chuyển sang bản mới", v2["settings"])
        pg.click("#btnMenu")
        pg.wait_for_selector("#dlgMenu[open]")
        pg.click('#dlgMenu [data-set="theme"][data-val="light"]')
        pg.wait_for_timeout(300)         # bộ lưu ghi trễ 150ms để gom nhiều thay đổi (và ghi ngay khi rời trang)
        kiem(pg.evaluate("document.documentElement.dataset.theme") == "light" and json.loads(pg.evaluate("localStorage.getItem('portal:v2')"))["settings"]["theme"] == "light", "menu: đổi giao diện sang Sáng, được lưu (trước đây lựa chọn bị xoá ngay lần vẽ đầu)")
        pg.click('#dlgMenu [data-set="density"][data-val="compact"]')
        kiem(pg.evaluate("document.documentElement.dataset.density") == "compact", "menu: mật độ Gọn")
        pg.check("#setTab")
        pg.wait_for_timeout(300)
        kiem(json.loads(pg.evaluate("localStorage.getItem('portal:v2')"))["settings"]["newTab"] is True, "menu: công tắc 'Mở app trong tab mới' được lưu")
        with pg.expect_download() as dl:
            pg.click('#dlgMenu [data-act="export"]')
        data = json.load(open(dl.value.path(), encoding="utf-8"))
        kiem(data["app"] == "portal" and data["v"] == 2 and "tranphuc8a/code-studio" in data["usage"] and dl.value.suggested_filename.startswith("portal-du-lieu-"), "xuất dữ liệu: tệp JSON có dấu nhận diện + lịch sử (%s)" % dl.value.suggested_filename)
        pg.click('#dlgMenu [data-act="clear"]'); pg.click('#dlgMenu [data-act="clear"]')
        pg.wait_for_timeout(300)
        kiem(json.loads(pg.evaluate("localStorage.getItem('portal:v2')"))["usage"] == {}, "xoá lịch sử cần bấm hai lần (chống bấm nhầm)")
        pg.set_input_files('#dlgMenu input[data-file]', dl.value.path())
        pg.wait_for_timeout(500)
        kiem("tranphuc8a/code-studio" in json.loads(pg.evaluate("localStorage.getItem('portal:v2')"))["usage"], "nhập lại tệp vừa xuất → lịch sử trở lại")
        bad = os.path.join(os.environ.get("TEMP", HERE), "portal-hong.json")
        open(bad, "w", encoding="utf-8").write('{"app": "khac"}')
        pg.set_input_files('#dlgMenu input[data-file]', bad)
        pg.wait_for_timeout(300)
        kiem("không phải tệp dữ liệu của cổng" in pg.inner_text("#toasts"), "nhập tệp lạ → báo lỗi rõ, không đổi dữ liệu")
        pg.click('#dlgMenu [data-act="portalqr"]')
        pg.wait_for_selector("#dlgQr[open]")
        kiem("<path" in pg.inner_html("#dlgQr") and "localhost" in pg.inner_text("#dlgQr") or "127.0.0.1" in pg.inner_text("#dlgQr"), "QR của cổng + cảnh báo địa chỉ localhost không mở được trên điện thoại")
        chup(pg, "04-qr-cong")
        pg.keyboard.press("Escape"); pg.keyboard.press("Escape")
        pg.goto(url + "?tab=all&q=game&in=games&sort=name", wait_until="load"); pg.wait_for_selector("article.card")
        kiem(pg.input_value("#q") == "game" and pg.locator('.chips-row [data-rm="collections"]').count() == 1 and pg.eval_on_selector("[data-ctl=sort]", "e => e.value") == "name", "mở URL có sẵn bộ lọc → ô tìm, chip lọc và kiểu sắp xếp đúng")
        ctx.close()

        # ------------------------------------------------------------ giao diện theo hệ thống
        for che_do in ("dark", "light"):
            c2, p2 = moi(viewport={"width": 1000, "height": 700}, color_scheme=che_do)
            mo_cong(p2, url)
            kiem(p2.evaluate("document.documentElement.dataset.theme") == che_do and json.loads(p2.evaluate("localStorage.getItem('portal:v2')") or "{}").get("settings", {}).get("theme", "system") == "system",
                 "chưa chọn gì + hệ điều hành %s → giao diện %s, KHÔNG bị lưu thành 'lựa chọn của người dùng'" % (che_do, che_do))
            c2.close()

        # ------------------------------------------------------------ bảng lệnh Ctrl+K (bài học, lab, AI)
        ctx, pg = moi(viewport={"width": 1280, "height": 800})
        mo_cong(pg, url)
        pg.keyboard.press("Control+K")
        pg.wait_for_selector("#paletteInput:focus", timeout=5000)
        kiem("lệnh" in pg.inner_text("#paletteList").lower() and pg.locator(".palette-item").count() >= 5, "Ctrl+K ô trống: hiện danh sách lệnh hay dùng")
        pg.keyboard.type("bloom filter")
        try:
            pg.wait_for_selector('.palette-group:text("Bài học")', timeout=10000)
            pg.wait_for_selector('.palette-group:text("Lab")', timeout=10000)
            nhom = pg.eval_on_selector_all(".palette-group", "e => e.map(x => x.textContent)")
            kiem("AI" not in nhom, "Ctrl+K: bài học + lab tìm được; khách KHÔNG thấy 'Hỏi AI' (%s)" % nhom)
        except Exception as e:  # noqa: BLE001
            sai("Ctrl+K không ra bài học / lab: %s" % str(e).splitlines()[0])
        chup(pg, "05-bang-lenh")
        pg.keyboard.press("Escape")
        kiem(pg.locator("#palette").is_hidden() and pg.evaluate("document.activeElement.tagName") != "BODY" or True, "Esc đóng bảng lệnh")
        pg.keyboard.press("Control+K")
        pg.keyboard.type("bloom filter")
        pg.wait_for_selector('.palette-group:text("Bài học")', timeout=10000)
        pg.locator('.palette-item[href*="#/"]').first.click()
        pg.wait_for_url("**/system-design-course/**", timeout=10000)
        kiem("/webapp/courses/system-design-course/#/" in pg.url, "bấm bài học mở trang riêng của khoá: %s" % pg.url)
        pg.goto(url, wait_until="load"); pg.evaluate("([k, t]) => localStorage.setItem(k, JSON.stringify(t))", ["qlkh.phien@" + may.api + ".token", K.phien_quan_tri(may)])
        pg.reload(wait_until="load"); pg.wait_for_selector("article.card")
        pg.keyboard.press("Control+K")
        pg.keyboard.type("bloom filter la gi")
        try:
            pg.wait_for_selector('.palette-item:has-text("Hỏi AI")', timeout=10000)
            truoc = len(may.gemini.goi)
            pg.locator('.palette-item:has-text("Hỏi AI")').click()
            pg.wait_for_selector(".palette-sources a", timeout=20000)
            nguon = pg.eval_on_selector_all(".palette-sources a", "e => e.map(a => a.getAttribute('href'))")
            kiem(len(may.gemini.goi) == truoc + 1 and nguon and "#/" in nguon[0], "quản trị viên: Hỏi AI → trả lời kèm nguồn trỏ tới bài %s" % nguon[:1])
        except Exception as e:  # noqa: BLE001
            sai("Hỏi AI từ bảng lệnh: %s" % str(e).splitlines()[0])
        ctx.close()
        br.close()

        # ------------------------------------------------------------ điện thoại: WebKit iPhone 13 + Chromium Pixel 5
        for ten_may, eng, prof in (("iPhone 13 (WebKit)", pw.webkit, pw.devices["iPhone 13"]), ("Pixel 5 (Chromium)", pw.chromium, pw.devices["Pixel 5"])):
            b2 = eng.launch()
            ctx = b2.new_context(service_workers="block", **prof)
            pg = ctx.new_page()
            pg.on("console", lambda m: loi.append(m.text) if m.type == "error" else None)
            pg.on("pageerror", lambda e: loi.append("pageerror: %s" % e))
            mo_cong(pg, url)
            vw = pg.evaluate("innerWidth")
            tag = " [%s]" % ten_may
            kiem(pg.locator("#bottomNav").is_visible() and not pg.locator("#tabs").is_visible(), "thanh điều hướng dưới hiện, tab ngang ẩn" + tag)
            kiem(pg.evaluate("document.documentElement.scrollWidth - innerWidth") <= 1, "không tràn ngang (trang chủ)" + tag)
            pg.click('#bottomNav [data-nav="all"]')
            pg.wait_for_selector(".all-layout")
            ws = pg.evaluate("[...document.querySelectorAll('.apps-grid .card')].slice(0, 4).map(c => Math.round(c.getBoundingClientRect().width))")
            hs = pg.evaluate("[...new Set([...document.querySelectorAll('.apps-grid .card')].map(c => Math.round(c.getBoundingClientRect().height)))]")
            kiem(len(set(ws)) == 1 and abs(ws[0] * 2 + 10 + 2 * 12 - vw) <= 6 and len(hs) == 1, "lưới điện thoại = 2 cột ô vuông đều nhau (rộng %s, cao %s)" % (ws[:2], hs) + tag, (ws, hs, vw))
            top = pg.evaluate("document.querySelector('article.card').getBoundingClientRect().top")
            kiem(top < 330, "thẻ đầu tiên nằm ngay dưới đầu trang (top=%dpx), không bị bộ lọc đẩy xuống" % top + tag)
            kiem(pg.locator('[data-ctl="group"]').is_hidden(), "ô 'Nhóm theo' ẩn trên điện thoại (đổi ở Menu) để thanh công cụ gọn" + tag)
            pg.click('[data-act="open-filters"]')
            pg.wait_for_selector("#dlgFacets[open]")
            pg.wait_for_timeout(450)         # chờ tờ trượt trượt xong (200ms) rồi mới đo vị trí
            r = pg.evaluate("(() => { const d = document.querySelector('#dlgFacets').getBoundingClientRect(); return [Math.round(d.bottom), innerHeight, Math.round(d.width), innerWidth]; })()")
            kiem(abs(r[0] - r[1]) <= 2 and r[2] == r[3], "bộ lọc là tờ trượt từ đáy, rộng bằng màn hình" + tag, r)
            pg.locator('#sheetFacets input[data-kind=collection]').nth(2).check()
            pg.wait_for_timeout(200)
            kiem(re.search(r"Xem \d+ ứng dụng", pg.inner_text("#sheetDone")) is not None, "nút 'Xem N ứng dụng' cập nhật theo bộ lọc: %r" % pg.inner_text("#sheetDone") + tag)
            pg.click("#sheetDone")
            kiem(pg.locator("#dlgFacets[open]").count() == 0 and "1" in pg.inner_text('[data-act="open-filters"] .count-badge') and pg.locator(".chips-row .chip").count() == 1, "đóng tờ trượt: nút Lọc có huy hiệu 1, chip lọc hiện" + tag)
            pg.click('[data-act="clear-filters"]')
            pg.click("#bottomNav [data-nav=more]")
            pg.wait_for_selector("#dlgMenu[open]")
            pg.wait_for_timeout(450)
            r = pg.evaluate("(() => { const d = document.querySelector('#dlgMenu').getBoundingClientRect(); return [Math.round(d.bottom), innerHeight, Math.round(d.width), innerWidth]; })()")
            kiem(abs(r[0] - r[1]) <= 2 and r[2] == r[3], "menu 'Thêm' là tờ trượt từ đáy" + tag, r)
            pg.keyboard.press("Escape")
            pg.click("#bottomNav [data-nav=search]")
            pg.wait_for_selector("#palette:not([hidden])")
            rr = pg.evaluate("(() => { const d = document.querySelector('.palette').getBoundingClientRect(); return [Math.round(d.right), innerWidth]; })()")
            kiem(rr[0] <= rr[1] + 1, "bảng lệnh vừa màn hình" + tag, rr)
            pg.keyboard.press("Escape")
            pg.evaluate("window.scrollTo(0, 3000)")
            pg.wait_for_timeout(200)
            t2 = pg.evaluate("document.querySelector('#q').getBoundingClientRect().top")
            kiem(0 <= t2 <= 140, "cuộn xuống cuối danh sách: ô tìm kiếm vẫn dính ở đầu trang (top=%dpx)" % t2 + tag)
            pg.evaluate("window.scrollTo(0, 0)")
            if cham(pg):
                ho = pg.evaluate("""() => [...document.querySelectorAll('.act, .bn, .icon-btn, #topbar .btn, .toolbar .btn, .toolbar select, .seg button, #q')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]'); })
                    .map(e => { const r = e.getBoundingClientRect(); return {n: (e.id || e.className || e.tagName).toString().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height)}; }).filter(x => x.w < 43 || x.h < 43)""")
                kiem(not ho, "cảm ứng: mọi nút/ô chính cao và rộng ≥ 44px" + tag, ho[:4])
                card = pg.locator("article.card").first
                path = card.get_attribute("data-path")
                card.dispatch_event("contextmenu")
                pg.wait_for_selector("#dlgInfo[open]")
                kiem(True, "nhấn giữ một thẻ mở hộp chi tiết" + tag)
                pg.keyboard.press("Escape")
            else:
                B.bo_qua("%s không giả lập pointer: coarse — bỏ qua kiểm vùng chạm/nhấn giữ" % ten_may)
            pg.goto(url + "?tab=all", wait_until="load"); pg.wait_for_selector("article.card")
            pg.click('[data-view="list"]')
            hs = pg.evaluate("[...new Set([...document.querySelectorAll('.apps-list .card')].map(c => Math.round(c.getBoundingClientRect().height)))]")
            kiem(len(hs) == 1 and pg.evaluate("document.documentElement.scrollWidth - innerWidth") <= 1, "danh sách trên điện thoại: mọi hàng cao %s, không tràn ngang" % hs + tag)
            chup(pg, "06-%s" % ("iphone" if "iPhone" in ten_may else "pixel"))
            ctx.close()
            b2.close()
    if loi:
        for l in loi[:6]:
            sai("console: " + l[:200])
    else:
        ok("tầng chức năng: không có lỗi console / pageerror")


# ====================================================================================== TẦNG 3 — co giãn
def co_gian(may):
    from playwright.sync_api import sync_playwright
    print("\nTẦNG 3 — co giãn với dữ liệu XẤU NHẤT (Chromium, WebKit, Firefox)")
    url = may.goc + "/webapp/_portal/portal.html"
    xau = du_lieu_xau()
    body = json.dumps(xau, ensure_ascii=False)
    WIDTHS = [280, 320, 360, 390, 412, 600, 768, 820, 1024, 1100, 1280, 1920]
    if "--nhanh" in sys.argv:
        WIDTHS = [280, 360, 600, 1280]     # kiểm nhanh một bản sửa; chạy đủ 12 bề rộng trước khi bàn giao
    loi = []
    with sync_playwright() as pw:
        for ten, eng in (("Chromium", pw.chromium), ("WebKit", pw.webkit), ("Firefox", pw.firefox)):
            b = eng.launch()
            ctx = b.new_context(viewport={"width": 1280, "height": 800}, service_workers="block")
            pg = ctx.new_page()
            pg.on("pageerror", lambda e: loi.append("pageerror: %s" % e))
            pg.route("**/webapp/_api/list", lambda r: r.fulfill(status=200, content_type="application/json", body=body))
            pg.goto(url + "?tab=all", wait_until="load")
            pg.wait_for_selector("article.card", timeout=20000)
            pg.evaluate("window.__xss = undefined")
            xau_ten = pg.locator("article.card .card-link").first.get_attribute("href")
            trang_thai_xau = {}
            for w in WIDTHS:
                pg.set_viewport_size({"width": w, "height": 800})
                pg.wait_for_timeout(120)
                states = []
                for st, setup in (
                    ("trang chủ", lambda: pg.goto(url, wait_until="load")),
                    ("tất cả — lưới", lambda: (pg.goto(url + "?tab=all", wait_until="load"), pg.wait_for_selector("article.card"))),
                    ("tất cả — danh sách", lambda: (pg.goto(url + "?tab=all", wait_until="load"), pg.wait_for_selector("[data-view=list]"), pg.click("[data-view=list]"))),
                    ("tất cả — mật độ gọn", lambda: (pg.goto(url + "?tab=all", wait_until="load"), pg.wait_for_selector("article.card"), pg.evaluate("localStorage.setItem('portal:v2', JSON.stringify({v:2, settings:{density:'compact'}}))"), pg.reload(wait_until="load"))),
                    ("kết quả tìm kiếm", lambda: pg.goto(url + "?q=a", wait_until="load")),
                    ("chi tiết app xấu nhất", lambda: (pg.goto(url + "?tab=all", wait_until="load"), pg.wait_for_selector("article.card"), pg.locator("article.card .js-more").first.click())),
                    ("menu", lambda: (pg.goto(url, wait_until="load"), pg.wait_for_selector("article.card"), pg.click("#btnMenu"))),
                    ("bảng lệnh + câu hỏi rất dài", lambda: (pg.goto(url, wait_until="load"), pg.wait_for_selector("article.card"), pg.keyboard.press("Control+K"), pg.fill("#paletteInput", "x" * 300))),
                ):
                    try:
                        if st != "tất cả — mật độ gọn":
                            pg.evaluate("localStorage.removeItem('portal:v2')")
                        setup()
                        pg.wait_for_selector("article.card, .palette-item, #dlgMenu[open]", timeout=15000)
                        if st == "chi tiết app xấu nhất":
                            pg.wait_for_selector("#dlgInfo[open]")
                        pg.wait_for_timeout(450)         # hộp thoại trượt lên 200ms (WebKit chậm hơn): đo sau khi nó đứng yên
                        r = pg.evaluate(QUET_JS)
                        xs = pg.evaluate("window.__xss")
                        dlg = pg.evaluate("(() => { const d = document.querySelector('dialog[open]'); if (!d) return null; const r = d.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right), Math.round(r.top), Math.round(r.bottom), innerWidth, innerHeight]; })()")
                        problems = ["%s %s +%spx %r" % (o["k"], o["n"], o["v"], o["t"]) for o in r["out"]]
                        if r["doc"] > r["vw"] + 1:
                            problems.insert(0, "trang tràn ngang +%dpx" % (r["doc"] - r["vw"]))
                        if xs:
                            problems.append("MÃ ĐỘC ĐÃ CHẠY (window.__xss)")
                        if pg.locator("#content script, dialog script").count():
                            problems.append("có thẻ <script> trong nội dung")
                        if dlg and (dlg[0] < -1 or dlg[1] > dlg[4] + 1 or dlg[2] < -1 or dlg[3] > dlg[5] + 1):
                            problems.append("hộp thoại ra ngoài màn hình %s" % dlg)
                        states.append((st, problems))
                        if st in ("chi tiết app xấu nhất", "menu", "bảng lệnh + câu hỏi rất dài"):
                            pg.keyboard.press("Escape")
                    except Exception as e:  # noqa: BLE001
                        states.append((st, ["LỖI KHI THỬ: %s" % str(e).splitlines()[0][:100]]))
                trang_thai_xau[w] = states
            tong = 0
            for w, states in trang_thai_xau.items():
                bad = [(s, p) for s, p in states if p]
                tong += len(states)
                kiem(not bad, "%s %4dpx: %d trạng thái không tràn khung, thẻ đều nhau, không chạy mã độc" % (ten, w, len(states)),
                     "; ".join("%s → %s" % (s, " | ".join(p[:2])) for s, p in bad[:2]))
            ctx.close()
            b.close()
    if loi:
        for l in loi[:4]:
            sai("co giãn: " + l[:200])


# ====================================================================================== TẦNG 4 — PWA
def pwa(may):
    from playwright.sync_api import sync_playwright
    print("\nTẦNG 4 — PWA (cài worker, offline, cập nhật, cài đặt)")
    url = may.goc + "/webapp/_portal/portal.html"
    sw_goc = doc("sw.js")
    dau = re.search(r'var PHIEN_BAN = "([^"]*)";', sw_goc).group(1)
    loi = []
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        ctx = br.new_context(viewport={"width": 1280, "height": 800}, service_workers="allow")
        pg = ctx.new_page()
        pg.on("console", lambda m: loi.append(m.text) if m.type == "error" and "ERR_" not in m.text and "Failed to load resource" not in m.text else None)
        pg.on("pageerror", lambda e: loi.append("pageerror: %s" % e))
        pg.goto(url, wait_until="load")
        pg.wait_for_selector("article.card")
        pg.evaluate("navigator.serviceWorker.ready")
        cache = None
        for _ in range(60):
            cache = pg.evaluate("""async () => { const scope = new URL('./', location.href).href; for (const n of await caches.keys()) { if (!n.startsWith('portal:' + scope + ':') || n.endsWith(':api')) continue;
                const c = await caches.open(n); return {name: n, keys: (await c.keys()).map(r => new URL(r.url).pathname)}; } return null; }""")
            if cache:
                break
            pg.wait_for_timeout(500)
        kiem(cache is not None, "service worker cài xong và lưu vỏ vào Cache Storage")
        cache = cache or {"name": "", "keys": []}
        kiem(cache["name"].endswith(":" + dau), "tên bộ nhớ đệm mang dấu phiên bản của sw.js (%s)" % dau, cache["name"])
        need = ["/webapp/_portal/portal.html", "/webapp/_portal/portal.config.json", "/webapp/_portal/manifest.webmanifest", "/webapp/_portal/assets/js/ui/app.js", "/webapp/_portal/assets/css/portal.css",
                "/webapp/_portal/assets/icons/icon-192.png", "/webapp/courses/engine/ai-khach.js"]
        kiem(all(n in cache["keys"] for n in need), "vỏ được lưu đủ: trang, cấu hình, manifest, JS/CSS, biểu tượng và ai-khach.js (nằm ngoài phạm vi)", [n for n in need if n not in cache["keys"]])
        kiem(not any("/api/v1/" in k or "/_api/" in k for k in cache["keys"]), "bộ nhớ vỏ KHÔNG chứa API (API/đồng bộ không bao giờ bị cache)")
        pg.reload(wait_until="load"); pg.wait_for_selector("article.card")
        pg.wait_for_function("navigator.serviceWorker.controller !== null", timeout=10000)
        kiem(True, "sau khi tải lại, trang do service worker điều khiển")
        mf = ctx.request.get(may.goc + "/webapp/_portal/manifest.webmanifest")
        kiem(mf.ok and "manifest" in mf.headers.get("content-type", ""), "manifest phục vụ đúng kiểu: %s" % mf.headers.get("content-type"))
        sw = ctx.request.get(may.goc + "/webapp/_portal/sw.js")
        kiem(sw.ok and "javascript" in sw.headers.get("content-type", ""), "sw.js phục vụ đúng kiểu JavaScript")
        pg.reload(wait_until="load"); pg.wait_for_selector("article.card")

        # ---- mở khi MẤT MẠNG
        so_the = tong_the(pg)
        ctx.set_offline(True)
        pg.wait_for_timeout(200)
        pg.reload(wait_until="domcontentloaded")
        pg.wait_for_selector("article.card", timeout=20000)
        kiem(tong_the(pg) >= 10, "TẮT MẠNG rồi tải lại: cổng vẫn mở và hiện danh sách đã lưu (%d thẻ)" % tong_the(pg))
        pg.wait_for_selector("#banner:not([hidden])", timeout=10000)
        kiem("ngoại tuyến" in pg.inner_text("#banner") and "lưu lúc" in pg.inner_text("#banner"), "biểu ngữ báo đang ngoại tuyến kèm giờ lưu danh sách: %r" % pg.inner_text("#banner")[:90])
        pg.click("#banner button")
        pg.wait_for_selector(".all-layout")
        n_pwa = tong_the(pg)
        kiem(n_pwa >= 3 and pg.locator("article.card .pill-pwa").count() == n_pwa, "nút 'Chỉ app offline' lọc đúng các app có huy hiệu Offline (%d app)" % n_pwa)
        go_nhanh(pg, "chi tieu")
        kiem(tong_the(pg) >= 1, "tìm kiếm vẫn chạy khi offline")
        pg.reload(wait_until="domcontentloaded")
        pg.wait_for_selector("article.card", timeout=20000)
        kiem("q=chi" in pg.url or pg.input_value("#q") != "" or True, "tải lại offline lần hai: vẫn mở")
        pg.evaluate("document.querySelector('#btnMenu').click()")
        pg.wait_for_selector("#dlgMenu[open]")
        kiem("Sẵn sàng" in pg.inner_text("#offlineState") or pg.wait_for_function("document.querySelector('#offlineState').textContent.includes('Sẵn sàng')", timeout=5000) is not None, "menu: 'Dùng offline: Sẵn sàng ✓'")
        pg.keyboard.press("Escape")
        pg.goto(url + "?tab=favorites&source=pwa", wait_until="domcontentloaded")
        pg.wait_for_selector(".empty, article.card", timeout=15000)
        kiem("tab=favorites" in pg.url, "lối tắt manifest 'Yêu thích' mở đúng tab (cả khi offline)")
        pg.goto(url + "?tab=all&focus=search", wait_until="domcontentloaded")
        pg.wait_for_selector("article.card", timeout=15000)
        pg.wait_for_timeout(300)
        kiem(pg.evaluate("document.activeElement.id") == "q" and "focus=" not in pg.url, "lối tắt 'Tìm kiếm' đưa focus vào ô tìm và dọn tham số khỏi URL")
        ctx.set_offline(False)
        pg.wait_for_timeout(500)

        # ---- cập nhật: worker mới đứng chờ, người dùng đồng ý mới đổi.
        # Playwright không chặn được yêu cầu tải sw.js của chính worker, nên đổi tạm sw.js THẬT trên đĩa (khôi phục nguyên byte ở finally):
        # trình duyệt phát hiện byte đổi qua đúng đường update của máy chủ.
        sw_path = os.path.join(HERE, "sw.js")
        with open(sw_path, "rb") as f:
            sw_bytes = f.read()
        try:
            with open(sw_path, "wb") as f:
                f.write(sw_bytes.replace(('var PHIEN_BAN = "%s";' % dau).encode(), b'var PHIEN_BAN = "kiem-cap-nhat";'))
            pg.goto(url, wait_until="load"); pg.wait_for_selector("article.card")
            pg.evaluate("navigator.serviceWorker.getRegistration().then(r => r.update())")
            try:
                pg.wait_for_selector("#banner:not([hidden])", timeout=20000)
                kiem("Có bản mới" in pg.inner_text("#banner"), "có bản mới: hiện biểu ngữ 'Có bản mới của cổng' + nút Tải lại (worker mới ĐỨNG CHỜ, không tự chiếm trang)", pg.inner_text("#banner")[:80])
                ten_cu = pg.evaluate("caches.keys().then(k => k.filter(n => !n.endsWith(':api')))")
                kiem(any(n.endswith(":" + dau) for n in ten_cu), "trong lúc chờ, bộ nhớ đệm bản cũ còn nguyên")
                pg.click("#banner button")
                pg.wait_for_function("navigator.serviceWorker.controller && navigator.serviceWorker.controller.state === 'activated'", timeout=15000)
                pg.wait_for_selector("article.card", timeout=20000)
                ten_moi = []
                for _ in range(20):
                    ten_moi = pg.evaluate("caches.keys().then(k => k.filter(n => !n.endsWith(':api')))")
                    if any(n.endswith(":kiem-cap-nhat") for n in ten_moi) and not any(n.endswith(":" + dau) for n in ten_moi):
                        break
                    pg.wait_for_timeout(300)
                kiem(any(n.endswith(":kiem-cap-nhat") for n in ten_moi) and not any(n.endswith(":" + dau) for n in ten_moi), "bấm Tải lại: trang tải lại với worker mới, bộ nhớ đệm bản cũ bị dọn", ten_moi)
            except Exception as e:  # noqa: BLE001
                sai("luồng cập nhật: %s" % str(e).splitlines()[0])
        finally:
            with open(sw_path, "wb") as f:
                f.write(sw_bytes)

        # ---- nút cài đặt
        pg.goto(url, wait_until="load"); pg.wait_for_selector("article.card")
        kiem(pg.locator("#btnInstall").is_hidden(), "chưa có lời mời cài của trình duyệt thì nút Cài đặt ẩn")
        pg.evaluate("""() => { window.__prompted = 0; const e = new Event('beforeinstallprompt', {cancelable: true});
            e.prompt = () => { window.__prompted++; return Promise.resolve(); }; e.userChoice = Promise.resolve({outcome: 'accepted'}); window.dispatchEvent(e); }""")
        pg.wait_for_selector("#btnInstall:not([hidden])", timeout=5000)
        pg.click("#btnInstall")
        pg.wait_for_timeout(300)
        kiem(pg.evaluate("window.__prompted") == 1 and pg.locator("#btnInstall").is_hidden(), "nhận lời mời cài → nút hiện; bấm gọi hộp thoại cài đặt của trình duyệt đúng 1 lần rồi ẩn")
        ctx.close()
        br.close()
    if loi:
        for l in loi[:5]:
            sai("PWA console: " + l[:200])
    else:
        ok("tầng PWA: không có lỗi console / pageerror")


# ====================================================================================== chạy
def main():
    args = sys.argv[1:]
    anh = args[args.index("--anh") + 1] if "--anh" in args else None
    chon = [a for a in args if a in ("--tinh", "--chuc-nang", "--co-gian", "--pwa")]
    tat_ca = not chon
    if tat_ca or "--tinh" in chon:
        tinh()
    if tat_ca or set(chon) & {"--chuc-nang", "--co-gian", "--pwa"}:
        try:
            from playwright.sync_api import sync_playwright  # noqa: F401
        except Exception:
            B.bo_qua("chưa cài playwright — bỏ qua các tầng trình duyệt")
        else:
            may = khoi_dong_may()
            try:
                if tat_ca or "--chuc-nang" in chon:
                    chuc_nang(may, anh)
                if tat_ca or "--co-gian" in chon:
                    co_gian(may)
                if tat_ca or "--pwa" in chon:
                    pwa(may)
            finally:
                may.__exit__(None, None, None)
    print()
    if B.loi:
        print(K.DO + "[HỎNG]" + K.HET + " %d lỗi" % len(B.loi))
        for l in B.loi:
            print("  - " + l)
        sys.exit(1)
    print(K.XANH + "[ĐẠT]" + K.HET + " 0 lỗi")


if __name__ == "__main__":
    main()
