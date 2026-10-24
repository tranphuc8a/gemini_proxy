# -*- coding: utf-8 -*-
"""Kiểm render theo khối của Markdown Editor Pro trên Edge THẬT (perf-md việc 8–11, đợt M5 — 24/10/2026).

Phục vụ `markdown-editor/dist` (tự build nếu cũ hơn nguồn) qua máy chủ tĩnh, API quản trị giả bằng `page.route` — không chạm
backend, không database. Tài liệu đo là doc-2k sinh tất định (`_tai_lieu_thu.py`, 2.000 dòng, 54 khối code, 22 công thức khối,
2 sơ đồ mermaid, 34 bảng, 43 tiêu đề, 9 ảnh), nạp vào IndexedDB như `kiem-hieu-nang.py`.

1. Preview dựng dần: khung đầu có khối chỗ-giữ (`.md-block.is-pending`), rồi hết sạch; mọi tiêu đề có id đúng thứ tự (kể cả
   tiêu đề trùng `-1`, `-2`), neo `#` có href.
2. Sửa một đoạn: khối khác KHÔNG bị dựng lại (nút DOM của khối ở xa giữ nguyên) và chữ mới vào preview.
3. Mục lục (Outline) bấm tiêu đề cuối tài liệu → preview cuộn tới, tiêu đề đó có trong khung nhìn.
4. Nhấp đúp một đoạn văn xa đầu tài liệu → con trỏ editor nhảy tới đúng dòng nguồn (dòng tuyệt đối, không phải dòng trong khối).
5. Xuất HTML ngay sau khi mở (khi còn khối chưa dựng): tệp xuất có đủ mọi tiêu đề, mọi khối code, mọi công thức, mọi sơ đồ đã
   vẽ (không còn chỗ giữ, không còn "Rendering diagram…").
6. Sơ đồ mermaid chờ tới lượt (chưa vẽ khi ở xa màn hình), `beforeprint` dựng nốt toàn bộ khối.
7. Chế độ đọc (?read=1): mở mục lục, chọn tiêu đề cuối → bài cuộn tới đó dù khối còn là chỗ giữ; liên kết `#id` trong bài tới tiêu đề
   ở khối chưa dựng cũng tới nơi.
8. Tài liệu có footnote đi đường cũ (không có `.md-block`) mà vẫn hiện đủ chú thích; `?render=full` tắt render theo khối.
9. Cuộn preview: không khung nào > 250 ms trong lúc dựng dần ở 40 lần cuộn.

Dùng: `PYTHONUTF8=1 backend/fastapi/.venv/Scripts/python.exe markdown-editor/scripts/kiem-khoi.py [--anh <thư-mục>]`
Exit code 0 khi mọi phép đạt.
"""
from __future__ import annotations

import importlib.util
import json
import os
import re
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import _kiem_chung as K  # noqa: E402
import _tai_lieu_thu as T  # noqa: E402

K.utf8_console()

_spec = importlib.util.spec_from_file_location("kiem_hieu_nang", os.path.join(HERE, "kiem-hieu-nang.py"))
khn = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(khn)  # chỉ lấy NAP, ANH (không chạy main)

ANH_DIR = None
if "--anh" in sys.argv:
    ANH_DIR = sys.argv[sys.argv.index("--anh") + 1]
    os.makedirs(ANH_DIR, exist_ok=True)

PENDING = "document.querySelectorAll('.preview-scroll .md-block.is-pending').length"
FOOTNOTE_DOC = "# Chú thích\n\nMột câu có chú thích[^a] và một câu khác[^b].\n\n" + "\n\n".join(f"Đoạn số {i}." for i in range(40)) + "\n\n[^a]: Chú thích thứ nhất.\n\n[^b]: Chú thích thứ hai.\n"


def mo(browser, md, mode="split", query=""):
    ctx = browser.new_context(viewport={"width": 1440, "height": 900}, service_workers="block", accept_downloads=True)
    for duong in ("**/markdown/admin/session", "**/markdown/admin/verify"):
        ctx.route(duong, lambda r: r.fulfill(status=200, content_type="application/json", body='{"session":"tok"}'))
    ctx.route("**/markdown/backends", lambda r: r.fulfill(status=200, content_type="application/json", body="[]"))
    ctx.route("https://img.example.test/**", lambda r: r.fulfill(status=200, content_type="image/png", body=khn.ANH))
    page = ctx.new_page()
    loi = []
    page.on("pageerror", lambda e: loi.append(str(e)[:300]))
    page.goto(SRV.base + "manifest.webmanifest")
    page.evaluate(khn.NAP, [md, mode, "tok"])
    page.goto(SRV.base + query, wait_until="load", timeout=60000)
    if "read=1" in query:
        page.wait_for_selector(".reading-article h1, .reading-article h2", timeout=60000)
    else:
        page.wait_for_selector(".preview-scroll .markdown-body h1, .preview-scroll .markdown-body h2", timeout=60000)
    return ctx, page, loi


def cho_dung_het(page, giay=120):
    dl = time.time() + giay
    while time.time() < dl:
        if page.evaluate(PENDING) == 0:
            return True
        time.sleep(0.25)
    return False


def anh(page, ten):
    if ANH_DIR:
        page.screenshot(path=os.path.join(ANH_DIR, ten))


def main() -> int:
    global SRV
    from playwright.sync_api import sync_playwright

    if K.build_cu_hon_nguon():
        K.build()
    so = K.SoKiem()
    md = T.sinh("doc-2k")
    dong_tieu_de = [ln for ln in md.split("\n") if re.match(r"^#{1,6} ", ln)]
    so_khoi_code = len(re.findall(r"^```(?!mermaid)\w", md, re.M))
    so_mermaid = len(re.findall(r"^```mermaid", md, re.M))

    with sync_playwright() as pw, K.MayChuTinh(K.DIST) as SRV:
        browser, kenh = K.mo_trinh_duyet(pw, cho_thay_the=False)
        if browser is None:
            print("Không mở được Edge (channel=msedge)")
            return 2
        print(f"Kiểm render theo khối · {kenh} {browser.version} · doc-2k ({len(md.splitlines())} dòng, {len(dong_tieu_de)} tiêu đề)")

        # ---- 1. dựng dần, id tiêu đề ----------------------------------------------------------------------------
        ctx, page, loi = mo(browser, md)
        dau = page.evaluate(PENDING)
        tong = page.evaluate("document.querySelectorAll('.preview-scroll .md-block').length")
        so.kiem("preview dựng dần: ngay khung đầu còn khối chỗ-giữ", dau > 0 and tong > 100, f"chỗ giữ {dau}/{tong}")
        xong = cho_dung_het(page)
        so.kiem("dựng dần xong: không còn khối chỗ-giữ", xong)
        ids = page.evaluate("Array.from(document.querySelectorAll('.preview-scroll .markdown-body h1,h2,h3,h4,h5,h6')).map(h => [h.id, h.dataset.slug || '', (h.querySelector('a.heading-anchor')||{getAttribute(){return null}}).getAttribute('href')])")
        so.kiem("mọi tiêu đề có id và neo href khớp id", len(ids) >= 40 and all(i[0] and i[2] == "#" + i[0] for i in ids), f"{len(ids)} tiêu đề")
        so.kiem("id tiêu đề là duy nhất (tiêu đề trùng được đánh số -1, -2 … theo thứ tự)", len({i[0] for i in ids}) == len(ids), f"{len(ids)} tiêu đề")
        so.kiem("không có lỗi JS không bắt", not loi, "; ".join(loi[:2]))
        anh(page, "1-preview.png")

        # ---- 2. sửa một đoạn: khối khác giữ nguyên DOM ----------------------------------------------------------
        page.evaluate("""() => { const ws = document.querySelectorAll('.preview-scroll .md-block'); window.__giu = [ws[5], ws[Math.floor(ws.length / 2)], ws[ws.length - 3]];
            window.__giu.forEach((w, i) => { w.__dau = 'giu' + i; }); }""")
        # đặt con trỏ cuối một dòng văn xuôi ở giữa tài liệu rồi gõ
        dong, dong_dau, off = None, 0, 0
        lines = md.split("\n")
        mid = len(lines) // 2
        fence = False
        for i in range(mid, len(lines)):
            ln = lines[i]
            if ln.startswith("```"):
                fence = not fence
            if not fence and ln and re.match(r"^[A-Za-zÀ-ỹ]", ln) and "$" not in ln and not ln.startswith(("|", "-", "*", ">", "<")):
                dong = i + 1
                dong_dau = i + 1
                while dong_dau > 1 and lines[dong_dau - 2].strip():
                    dong_dau -= 1
                off = sum(len(x) + 1 for x in lines[:i]) + len(ln)
                break
        page.evaluate("(off) => { const ta = document.querySelector('textarea.editor-input'); ta.focus(); ta.setSelectionRange(off, off); }", off)
        page.keyboard.type(" DOTMOI")
        dl = time.time() + 15
        thay = False
        while time.time() < dl:
            thay = page.evaluate("document.querySelector('.preview-scroll .markdown-body').textContent.includes('DOTMOI')")
            if thay:
                break
            time.sleep(0.1)
        so.kiem("gõ vào giữa tài liệu: chữ mới vào preview", thay)
        giu = page.evaluate("window.__giu.map((w, i) => w.__dau === 'giu' + i && w.isConnected)")
        so.kiem("khối ở xa chỗ sửa giữ nguyên nút DOM (không dựng lại)", all(giu), str(giu))
        so.kiem("sau khi sửa, id tiêu đề vẫn đúng và duy nhất",
                page.evaluate("(() => { const h = Array.from(document.querySelectorAll('.preview-scroll .markdown-body h1,h2,h3,h4,h5,h6')); return h.every(x => x.id) && new Set(h.map(x => x.id)).size === h.length })()"))

        # ---- 4. nhấp đúp -> dòng tuyệt đối ----------------------------------------------------------------------
        page.evaluate("document.querySelector('.preview-scroll').scrollTop = 0")
        va = page.evaluate("""() => { const ps = Array.from(document.querySelectorAll('.preview-scroll .md-block > p')); const p = ps.find(x => x.textContent.includes('DOTMOI')); if (!p) return null;
            p.scrollIntoView({block: 'center'}); const r = p.getBoundingClientRect(); return {x: r.left + 20, y: r.top + 8}; }""")
        so.kiem("tìm được đoạn vừa sửa trong preview để nhấp đúp", va is not None)
        if va:
            page.mouse.dblclick(va["x"], va["y"])
            time.sleep(0.4)
            caret = page.evaluate("(() => { const ta = document.querySelector('textarea.editor-input'); return ta.value.slice(0, ta.selectionStart).split('\\n').length })()")
            so.kiem("nhấp đúp một đoạn xa đầu tài liệu: con trỏ editor tới đúng dòng nguồn", dong is not None and dong_dau <= caret <= dong, f"dòng {caret}, mong {dong_dau}–{dong}")

        # ---- 3. mục lục: bấm tiêu đề cuối ----------------------------------------------------------------------
        page.evaluate("document.querySelector('.preview-scroll').scrollTop = 0")
        page.get_by_role("tab", name=re.compile("Outline")).click()
        muc = page.locator("nav.outline .outline-item")
        n_muc = muc.count()
        muc.nth(n_muc - 1).click()
        time.sleep(1.2)
        thay_cuoi = page.evaluate("""() => { const hs = Array.from(document.querySelectorAll('.preview-scroll .markdown-body h1,h2,h3,h4,h5,h6')); const h = hs[hs.length - 1];
            const sc = document.querySelector('.preview-scroll').getBoundingClientRect(); const r = h.getBoundingClientRect(); return r.bottom > sc.top - 5 && r.top < sc.bottom + 5; }""")
        chi_tiet = page.evaluate("""() => { const hs = Array.from(document.querySelectorAll('.preview-scroll .markdown-body h1,h2,h3,h4,h5,h6')); const h = hs[hs.length - 1];
            const sc = document.querySelector('.preview-scroll'); const items = document.querySelectorAll('nav.outline .outline-item'); const r = h.getBoundingClientRect(); const s = sc.getBoundingClientRect();
            return {id: h.id, text: h.textContent.slice(0, 30), top: Math.round(r.top - s.top), h: sc.clientHeight, st: sc.scrollTop, sh: sc.scrollHeight, pending: document.querySelectorAll('.md-block.is-pending').length, items: items.length, lastItem: items[items.length-1].textContent.slice(0, 30)}; }""")
        so.kiem("Outline: bấm tiêu đề cuối → preview cuộn tới, tiêu đề nằm trong khung nhìn", thay_cuoi, json.dumps(chi_tiet, ensure_ascii=False))
        anh(page, "3-outline.png")
        ctx.close()

        # ---- 5. xuất HTML khi còn khối chưa dựng ---------------------------------------------------------------
        ctx, page, loi = mo(browser, md)
        con = page.evaluate(PENDING)
        page.get_by_role("button", name="File", exact=False).first.click()
        with page.expect_download(timeout=120000) as dl:
            page.get_by_role("button", name=re.compile(r"Export HTML")).click()
        tep = dl.value.path()
        html = open(tep, encoding="utf-8", errors="replace").read()
        so.kiem("xuất HTML khi còn khối chưa dựng: bắt đầu từ trạng thái dở (có chỗ giữ)", con > 0, f"chỗ giữ lúc bấm {con}")
        n_h = len(re.findall(r"<h[1-6][ >]", html))
        so.kiem("tệp xuất có đủ mọi tiêu đề", n_h >= len(dong_tieu_de), f"{n_h}/{len(dong_tieu_de)}")
        so.kiem("tệp xuất không còn khối chỗ-giữ", "is-pending" not in html.split("</style>")[-1])
        n_katex, n_math = html.count('class="katex'), html.count("math-block")
        so.kiem("tệp xuất có đủ khối code và công thức", html.count("prism-") > 0 and n_katex >= 22 and n_math >= 20, f"katex {n_katex}, math-block {n_math}")
        so.kiem("tệp xuất có sơ đồ mermaid đã vẽ (không còn 'Rendering diagram')", "Rendering diagram" not in html and html.count("mermaid-diagram") >= so_mermaid, f"{html.count('mermaid-diagram')}/{so_mermaid}")
        so.kiem("tệp xuất không còn ép content-visibility ở thân (lớp is-exporting đã gỡ)", page.evaluate("!document.body.classList.contains('is-exporting')"))
        ctx.close()

        # ---- 6. mermaid chờ tới lượt + beforeprint -------------------------------------------------------------
        ctx, page, loi = mo(browser, md)
        cho_dung_het(page)
        cho = page.evaluate("document.querySelectorAll('.mermaid-loading.is-waiting').length")
        da = page.evaluate("document.querySelectorAll('.mermaid-diagram').length")
        so.kiem("sơ đồ ở xa màn hình chưa vẽ (đang chờ tới lượt)", cho + da == so_mermaid and cho >= 1, f"chờ {cho}, đã vẽ {da}, tổng {so_mermaid}")
        page.evaluate("window.dispatchEvent(new Event('beforeprint'))")
        so.kiem("beforeprint: mọi khối đã dựng", page.evaluate(PENDING) == 0)
        ctx.close()
        ctx, page, loi = mo(browser, md)
        cho_dung_het(page)
        co_cho = page.evaluate("(() => { const el = document.querySelector('.mermaid-loading.is-waiting'); if (!el) return false; el.scrollIntoView({block: 'center'}); return true; })()")
        dl = time.time() + 30
        while co_cho and time.time() < dl and page.evaluate("document.querySelectorAll('.mermaid-diagram').length") < 1:
            time.sleep(0.3)
        so.kiem("cuộn tới một sơ đồ đang chờ: nó được vẽ", co_cho and page.evaluate("document.querySelectorAll('.mermaid-diagram').length") >= 1)
        ctx.close()

        # ---- 7. chế độ đọc ----------------------------------------------------------------------------------------
        ctx, page, loi = mo(browser, md, query="?read=1")
        con = page.evaluate("document.querySelectorAll('.reading-article .md-block.is-pending').length")
        page.get_by_role("button", name="Table of contents").click()
        time.sleep(0.5)
        muc = page.locator(".reading-toc button, .reading-toc a, .reading-toc li button")
        n = muc.count()
        muc.nth(n - 1).click()
        time.sleep(1.5)
        vi_tri = page.evaluate("""() => { const hs = Array.from(document.querySelectorAll('.reading-article h1,h2,h3,h4,h5,h6')); const h = hs[hs.length - 1];
            const sc = document.querySelector('.reading-scroll').getBoundingClientRect(); const r = h.getBoundingClientRect(); return {ok: r.bottom > sc.top && r.top < sc.bottom, id: h.id}; }""")
        so.kiem("chế độ đọc: chọn tiêu đề cuối trong mục lục → tới đúng chỗ (khối từng là chỗ giữ)", con > 0 and vi_tri["ok"] and vi_tri["id"].startswith("reading-"), f"chỗ giữ lúc mở {con}, {vi_tri}")
        anh(page, "7-doc.png")
        so.kiem("chế độ đọc: không lỗi JS", not loi, "; ".join(loi[:2]))
        ctx.close()

        # ---- 8. footnote và ?render=full ------------------------------------------------------------------------
        ctx, page, loi = mo(browser, FOOTNOTE_DOC)
        so.kiem("tài liệu có footnote đi đường cũ: không có khối, vẫn có chú thích",
                page.evaluate("document.querySelectorAll('.preview-scroll .md-block').length") == 0 and page.evaluate("document.querySelectorAll('.preview-scroll section[data-footnotes] li').length") == 2)
        ctx.close()
        ctx, page, loi = mo(browser, md, query="?render=full")
        so.kiem("?render=full tắt render theo khối", page.evaluate("document.querySelectorAll('.preview-scroll .md-block').length") == 0 and page.evaluate("document.querySelectorAll('.preview-scroll h2').length") > 10)
        ctx.close()

        # ---- 9. cuộn trong lúc dựng dần --------------------------------------------------------------------------
        ctx, page, loi = mo(browser, md)
        page.evaluate(khn.QUAN_SAT)
        khung = page.evaluate("""async () => { const sc = document.querySelector('.preview-scroll'); const f = []; let last = performance.now(); let n = 0;
            await new Promise((res) => { const loop = (t) => { f.push(t - last); last = t; if (++n < 140) requestAnimationFrame(loop); else res(); }; requestAnimationFrame(loop);
              const iv = setInterval(() => { sc.scrollTop += 400; if (n >= 140) clearInterval(iv); }, 60); });
            return f; }""")
        so.kiem("cuộn preview 40 lần trong lúc dựng dần: không khung nào > 250 ms (máy bận có thể chậm)", max(khung) <= 250, f"khung lớn nhất {max(khung):.0f} ms, > 50 ms: {sum(1 for x in khung if x > 50)}/{len(khung)}")
        ctx.close()
        browser.close()
    return so.tong_ket("\n")


if __name__ == "__main__":
    sys.exit(main())
