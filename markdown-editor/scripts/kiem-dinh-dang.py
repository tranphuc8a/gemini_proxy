# -*- coding: utf-8 -*-
"""Kiểm định dạng của LLM trên Edge THẬT (md-render việc 4, 5, 6, 8, 15 — đợt M6, 25/10/2026).

Phục vụ `markdown-editor/dist` (tự build nếu cũ hơn nguồn) qua máy chủ tĩnh, API quản trị giả bằng `page.route` — không
chạm backend, không database. Tài liệu thử gồm: front matter, 5 loại alert + callout gập, dấu trích dẫn LLM, ==mark==,
```svg và <svg onload>, khối mã có tên tệp, ```mmd, công thức.

1. Alert: 5 loại + bí danh có lớp đúng; tiêu đề và chữ đạt tương phản 4.5:1 so với nền THẬT (màu tính ra của trình duyệt),
   ở cả sáng và tối; biểu tượng (mask) có; callout `-` đóng, bấm tiêu đề thì mở.
2. Trích dẫn: `sup.llm-cite` đúng số, không rác `[cite…`/`【…】` ngoài code; ==mark== có nền, tương phản đạt.
3. SVG: ảnh `img[src^="data:image/svg+xml"]` THẬT SỰ tải được (naturalWidth > 0); không có phần tử svg của người dùng;
   `<svg onload>` không chạy (biến cờ không được đặt) và không thành thuộc tính.
4. Khối mã có tên tệp (title="…", js:app.js), front matter là khối gập "Front matter" đóng sẵn, ```mmd vẽ ra sơ đồ.
5. Xuất HTML: mọi `url(` trong @font-face của tệp xuất là tuyệt đối (http/https), có alert/trích dẫn trong tệp; mở lại tệp xuất
   (file:// ) vẫn có alert có màu.

Dùng: `PYTHONUTF8=1 backend/fastapi/.venv/Scripts/python.exe markdown-editor/scripts/kiem-dinh-dang.py [--anh <thư-mục>]`
Exit code 0 khi mọi phép đạt.
"""
from __future__ import annotations

import importlib.util
import os
import re
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import _kiem_chung as K  # noqa: E402

K.utf8_console()

_spec = importlib.util.spec_from_file_location("kiem_hieu_nang", os.path.join(HERE, "kiem-hieu-nang.py"))
khn = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(khn)  # chỉ lấy NAP, ANH (không chạy main)

ANH_DIR = None
if "--anh" in sys.argv:
    ANH_DIR = sys.argv[sys.argv.index("--anh") + 1]
    os.makedirs(ANH_DIR, exist_ok=True)

TAI_LIEU = """---
title: Thử định dạng
tags: [llm, md]
---

# Định dạng của LLM

> [!NOTE]
> Một **ghi chú** với [liên kết](https://example.test).

> [!TIP]
> Mẹo hay.

> [!IMPORTANT]
> Điều quan trọng.

> [!WARNING] Cẩn thận kẻo ngã
> Cảnh báo.

> [!CAUTION]
> Nguy hiểm.

> [!faq]- Câu hỏi gập sẵn
> Câu trả lời ẩn.

> [!hint]+ Gợi ý mở sẵn
> Nội dung mở.

Sự thật thứ nhất [cite: 1, 2] và thứ hai 【4:0†source】 và `[cite: 9]` giữ nguyên.[cite_start] Hết :contentReference[oaicite:0]{index=0}.

Chữ ==được tô sáng== và `==không tô==`.

$$x^2 + y^2 = z^2$$

Có công thức nội dòng $a_1 + b_1$.

```python title="main.py"
print("xin chào")
```

```js:app.js
let a = 1
```

```svg
<svg viewBox="0 0 40 20" width="80" height="40"><rect width="40" height="20" fill="#5b5bd6"/><circle cx="20" cy="10" r="6" fill="#fff"/></svg>
```

Giữa câu <svg viewBox="0 0 10 10" width="20" height="20" onload="window.__pwn_inline=1"><circle cx="5" cy="5" r="4" fill="green"/></svg> rồi tiếp.

<svg viewBox="0 0 10 10" width="30" height="30" onload="window.__pwn=1"><script>window.__pwn_script=1</script><circle cx="5" cy="5" r="4" fill="red"/></svg>

```mmd
graph TD
  A[Bắt đầu] --> B[Kết thúc]
```
"""

JS_TUONG_PHAN = """() => {
  const lum = (c) => { const m = c.match(/[\\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]) };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) };
  const out = [];
  for (const el of document.querySelectorAll('.preview-scroll .markdown-alert')) {
    const cs = getComputedStyle(el);
    const title = el.querySelector('.markdown-alert-title');
    const ts = getComputedStyle(title);
    const before = getComputedStyle(title, '::before');
    const body = el.querySelector('p:not(.markdown-alert-title)');
    out.push({
      kind: [...el.classList].find((c) => /^markdown-alert-(note|tip|important|warning|caution)$/.test(c)),
      tag: el.tagName.toLowerCase(),
      bg: cs.backgroundColor,
      titleRatio: ratio(ts.color, cs.backgroundColor),
      bodyRatio: body ? ratio(getComputedStyle(body).color, cs.backgroundColor) : null,
      mask: before.maskImage || before.webkitMaskImage || '',
      title: title.textContent.trim()
    });
  }
  return out;
}"""


def mo(browser, md, anh_ten=None):
    ctx = browser.new_context(viewport={"width": 1280, "height": 1000}, service_workers="block", accept_downloads=True)
    for duong in ("**/markdown/admin/session", "**/markdown/admin/verify"):
        ctx.route(duong, lambda r: r.fulfill(status=200, content_type="application/json", body='{"session":"tok"}'))
    ctx.route("**/markdown/backends", lambda r: r.fulfill(status=200, content_type="application/json", body="[]"))
    page = ctx.new_page()
    loi = []
    page.on("pageerror", lambda e: loi.append(str(e)[:300]))
    page.on("dialog", lambda d: (loi.append("dialog: " + d.message), d.dismiss()))
    page.goto(SRV.base + "manifest.webmanifest")
    page.evaluate(khn.NAP, [md, "split", "tok"])
    page.goto(SRV.base, wait_until="load", timeout=60000)
    page.wait_for_selector(".preview-scroll .markdown-body h1", timeout=60000)
    # dựng dần: chờ hết khối chỗ-giữ
    dl = time.time() + 60
    while time.time() < dl and page.evaluate("document.querySelectorAll('.preview-scroll .md-block.is-pending').length") > 0:
        time.sleep(0.2)
    return ctx, page, loi


def main() -> int:
    global SRV
    from playwright.sync_api import sync_playwright

    if K.build_cu_hon_nguon():
        K.build()
    so = K.SoKiem()
    with sync_playwright() as pw, K.MayChuTinh(K.DIST) as SRV:
        browser, kenh = K.mo_trinh_duyet(pw, cho_thay_the=False)
        if browser is None:
            print("Không mở được Edge (channel=msedge)")
            return 2
        print(f"Kiểm định dạng LLM · {kenh} {browser.version}")
        ctx, page, loi = mo(browser, TAI_LIEU)
        P = ".preview-scroll .markdown-body"

        # ---- 1. alert -------------------------------------------------------------------------------------------
        for chu_de in ("sang", "toi"):
            if chu_de == "toi":
                page.evaluate("document.documentElement.setAttribute('data-theme', 'dark')")
                time.sleep(0.3)
            thong_tin = page.evaluate(JS_TUONG_PHAN)
            loai = sorted({t["kind"] for t in thong_tin})
            so.kiem(f"[{chu_de}] 7 callout: đủ 5 loại (kể cả bí danh faq→important, hint→tip)", len(thong_tin) == 7 and loai == ["markdown-alert-caution", "markdown-alert-important", "markdown-alert-note", "markdown-alert-tip", "markdown-alert-warning"], f"{len(thong_tin)} callout, {loai}")
            so.kiem(f"[{chu_de}] tiêu đề đạt tương phản 4.5:1 so với nền thật", all(t["titleRatio"] >= 4.5 for t in thong_tin), ", ".join(f"{t['kind'][15:]}={t['titleRatio']:.1f}" for t in thong_tin))
            so.kiem(f"[{chu_de}] chữ thân đạt 4.5:1", all(t["bodyRatio"] is None or t["bodyRatio"] >= 4.5 for t in thong_tin), ", ".join(f"{t['bodyRatio']:.1f}" for t in thong_tin if t["bodyRatio"]))
            so.kiem(f"[{chu_de}] mỗi tiêu đề có biểu tượng (mask-image)", all(t["mask"] and t["mask"] != "none" for t in thong_tin), str([t["mask"][:20] for t in thong_tin][:2]))
            if ANH_DIR:
                page.locator(P).screenshot(path=os.path.join(ANH_DIR, f"dinh-dang-{chu_de}.png"))
        page.evaluate("document.documentElement.setAttribute('data-theme', 'light')")
        so.kiem("tiêu đề tuỳ chỉnh của GitHub-style (`[!WARNING] Cẩn thận…`) giữ nguyên chữ", page.evaluate("[...document.querySelectorAll('.markdown-alert-warning .markdown-alert-title')].some(t => t.textContent.trim() === 'Cẩn thận kẻo ngã')"))
        so.kiem("callout gập `[!faq]-`: <details> đóng; `[!hint]+`: mở sẵn", page.evaluate("(() => { const d = [...document.querySelectorAll('details.markdown-alert')]; return d.length === 2 && d[0].open === false && d[1].open === true })()"))
        page.locator("details.markdown-alert >> nth=0 >> summary").click()
        so.kiem("bấm tiêu đề callout gập: mở ra và thấy nội dung", page.evaluate("(() => { const d = document.querySelector('details.markdown-alert'); const p = d.querySelector('p:not(.markdown-alert-title)'); return d.open && p.getBoundingClientRect().height > 0 })()"))
        so.kiem("dấu `[!NOTE]` không còn trong chữ hiển thị", "[!" not in page.evaluate(f"document.querySelector('{P}').textContent"))

        # ---- 2. trích dẫn, mark ---------------------------------------------------------------------------------
        sups = page.evaluate(f"[...document.querySelectorAll('{P} sup.llm-cite')].map(s => s.textContent)")
        so.kiem("trích dẫn thành sup: [1, 2] và [4]", sups == ["[1, 2]", "[4]"], str(sups))
        chu = page.evaluate(f"document.querySelector('{P}').textContent")
        so.kiem("không còn rác [cite_start] / contentReference / 【…】 ngoài code; code span giữ `[cite: 9]`", "cite_start" not in chu and "oaicite" not in chu and "【" not in chu and "[cite: 9]" in chu)
        mark = page.evaluate(f"(() => {{ const m = document.querySelector('{P} mark'); const cs = getComputedStyle(m); return {{t: m.textContent, bg: cs.backgroundColor}} }})()")
        so.kiem("==mark== thành <mark> có nền màu", mark["t"] == "được tô sáng" and mark["bg"] not in ("rgba(0, 0, 0, 0)", "transparent"), str(mark))
        so.kiem("`==không tô==` trong code span giữ nguyên", page.evaluate(f"[...document.querySelectorAll('{P} code')].some(c => c.textContent === '==không tô==')"))

        # ---- 3. SVG ---------------------------------------------------------------------------------------------
        time.sleep(0.5)
        imgs = page.evaluate(f"[...document.querySelectorAll('{P} img[src^=\"data:image/svg+xml\"]')].map(i => [i.complete, i.naturalWidth, i.naturalHeight])")
        so.kiem("3 bản vẽ SVG thành <img data:> và tải được (naturalWidth > 0)", len(imgs) == 3 and all(i[0] and i[1] > 0 for i in imgs), str(imgs))
        svgs = page.evaluate(f"[...document.querySelectorAll('{P} svg')].filter(s => !s.closest('.code-copy') && !s.closest('.mermaid-diagram')).length")
        so.kiem("không còn phần tử <svg> do người dùng viết (chỉ biểu tượng của ứng dụng + sơ đồ mermaid)", svgs == 0, f"{svgs}")
        co = page.evaluate("[window.__pwn, window.__pwn_inline, window.__pwn_script]")
        so.kiem("<svg onload> và <script> trong SVG KHÔNG chạy", co == [None, None, None], str(co))
        so.kiem("không có phần tử nào mang thuộc tính onload", page.evaluate("document.querySelectorAll('[onload]').length") == 0)
        so.kiem("bản vẽ trong ```svg có nút 'View source' (chữ mã vẫn đọc được)", page.evaluate(f"(() => {{ const d = document.querySelector('{P} details.md-svg-source'); return !!d && d.querySelector('summary').textContent === 'View source' && d.textContent.includes('<rect') }})()"))
        if ANH_DIR:
            page.locator(P).screenshot(path=os.path.join(ANH_DIR, "dinh-dang-svg.png"))

        # ---- 4. tên tệp, front matter, mmd ---------------------------------------------------------------------
        ten = page.evaluate(f"[...document.querySelectorAll('{P} .code-block-file')].map(e => e.textContent)")
        so.kiem("khối mã hiện tên tệp: main.py (title=…) và app.js (js:app.js)", ten == ["main.py", "app.js"], str(ten))
        fm = page.evaluate(f"(() => {{ const d = document.querySelector('{P} details.md-front-matter'); return d ? [d.open, d.querySelector('summary').textContent, d.textContent.includes('title: Thử định dạng')] : null }})()")
        so.kiem("front matter là khối gập 'Front matter' đóng sẵn, không thành <hr>/<h2>", fm == [False, "Front matter", True] and page.evaluate(f"document.querySelectorAll('{P} hr, {P} h2').length") == 0, str(fm))
        dl = time.time() + 30
        mm = 0
        while time.time() < dl:
            mm = page.evaluate(f"document.querySelectorAll('{P} .mermaid-diagram svg').length")
            if mm:
                break
            page.evaluate(f"document.querySelector('{P} .mermaid-loading, {P} .mermaid-diagram')?.scrollIntoView()")
            time.sleep(0.3)
        so.kiem("```mmd vẽ ra sơ đồ mermaid", mm == 1, f"{mm}")
        so.kiem("công thức KaTeX vẫn đủ (1 khối + 1 nội dòng, không lỗi)", page.evaluate(f"[document.querySelectorAll('{P} .katex-display').length, document.querySelectorAll('{P} .katex').length, document.querySelectorAll('{P} .katex-error').length]") == [1, 2, 0])
        so.kiem("không có lỗi JS không bắt, không có hộp thoại", not loi, "; ".join(loi[:3]))

        # ---- 5. xuất HTML -------------------------------------------------------------------------------------------
        page.get_by_role("button", name="File", exact=False).first.click()
        with page.expect_download(timeout=120000) as dl_info:
            page.get_by_role("button", name=re.compile(r"Export HTML")).click()
        thu_muc = tempfile.mkdtemp(prefix="kiem-dinh-dang-")
        tep = os.path.join(thu_muc, "xuat.html")
        dl_info.value.save_as(tep)
        html = open(tep, encoding="utf8").read()
        faces = re.findall(r"@font-face\s*\{[^}]*\}", html)
        urls = [u for f in faces for u in re.findall(r"url\(\s*\"?'?([^)\"']+)", f)]
        tuong_doi = [u for u in urls if not re.match(r"^(https?:|data:)", u)]
        so.kiem("tệp xuất: có @font-face (KaTeX) và mọi url() trong đó là tuyệt đối", len(faces) >= 10 and urls and not tuong_doi, f"{len(faces)} face, {len(urls)} url, tương đối: {tuong_doi[:2]}")
        so.kiem("tệp xuất chứa alert, trích dẫn, mark, ảnh SVG, front matter", all(x in html for x in ("markdown-alert-note", "llm-cite", "<mark>", "data:image/svg+xml", "md-front-matter")))
        so.kiem("tệp xuất không chứa onload/<script> của người dùng", "onload=" not in html.replace("window.__pwn", "").split("<body>")[1] if "<body>" in html else False)
        # Mở lại tệp xuất như một trang riêng (file://): alert có màu, ảnh svg tải được, font KaTeX tải được qua mạng cục bộ?
        # (font tuyệt đối trỏ về máy chủ thử đang chạy — vẫn sống trong lúc kiểm).
        trang = ctx.new_page()
        hong = []
        # Máy chủ thật có CORSMiddleware allow_origins=["*"] (backend/fastapi/src/main.py) nên font tuyệt đối tải được từ trang
        # file://; máy chủ tĩnh của bộ kiểm thì không. Giả đúng tiêu đề ấy cho font để phép thử phản ánh môi trường thật.
        def them_cors(route):
            r = route.fetch()
            route.fulfill(response=r, headers={**r.headers, "access-control-allow-origin": "*"})
        trang.route("**/*.woff2", them_cors)
        trang.on("requestfailed", lambda r: hong.append(f"{r.url[-40:]} {r.failure}"))
        trang.on("console", lambda m: hong.append(m.text[:120]) if m.type == "error" else None)
        trang.goto("file:///" + tep.replace("\\", "/"), wait_until="load")
        kq = trang.evaluate("""() => { const a = document.querySelector('.markdown-alert-note'); const cs = getComputedStyle(a); const i = document.querySelector('img[src^=\"data:image/svg+xml\"]'); return {bg: cs.backgroundColor, w: i ? i.naturalWidth : 0} }""")
        so.kiem("mở lại tệp xuất (file://): alert có nền, ảnh SVG tải được", kq["bg"] not in ("rgba(0, 0, 0, 0)", "transparent") and kq["w"] > 0, str(kq))
        font_ok = trang.evaluate("document.fonts.ready.then(() => [...document.fonts].some(f => f.family.includes('KaTeX') && f.status === 'loaded'))")
        so.kiem("mở lại tệp xuất khi còn mạng/máy chủ: font KaTeX tải được từ URL tuyệt đối", font_ok is True, f"{font_ok} {hong[:3]}")
        ctx.close()
        browser.close()
    return so.tong_ket("Định dạng LLM (Edge thật)")


if __name__ == "__main__":
    sys.exit(main())
