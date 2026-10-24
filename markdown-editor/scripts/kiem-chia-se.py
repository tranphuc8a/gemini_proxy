# -*- coding: utf-8 -*-
"""Kiểm liên kết chia sẻ chỉ đọc của Markdown Editor Pro trên Edge thật (md-share V14, đợt M3 — 23/10/2026).

Máy chủ uvicorn THẬT (SQLite tạm, `DATA_DIR` tạm, `MONGO_URI=""`, khoá quản trị giả, cổng trống — xem `_kiem_chung.MayChuThat`)
phục vụ BẢN ĐÃ XUẤT BẢN `backend/fastapi/webapp/tranphuc8a/markdown-editor-pro/` (chạy `node scripts/build-webapps.mjs --only
markdown-editor` trước). Kho markdown để mặc định ĐÓNG (`MARKDOWN_PUBLIC_READ` mặc định false, Q1).

1. Ngữ cảnh A (chủ): mở app, mở khoá quản trị, bật Backend sync (2 tài liệu lên máy chủ), mở hộp thoại "Share read-only link…", tạo liên kết.
2. Ngữ cảnh B (ẩn danh, trình duyệt khác, cho phép service worker): mở liên kết. Tiêu đề, KaTeX, Mermaid, tô màu code, bảng,
   ảnh data đều hiện; XSS không chạy; liên kết nội bộ thành chữ; liên kết ngoài noopener/noreferrer; meta robots + CSP; CSP
   chặn script chèn vào (inline và từ origin lạ) và không chặn tài nguyên nào của app; không đăng ký service worker; không ghi
   kho cục bộ; API trả no-store + X-Robots-Tag; không request nào mang token trong URL; KHÔNG thấy tài liệu khác (GET /files
   → 403 markdown_private); 360 px không cuộn ngang.
3. A sửa tài liệu → B vẫn thấy bản cũ (snapshot); hộp thoại báo "changed since this snapshot"; A Update snapshot → B thấy bản
   mới, token giữ nguyên.
4. API chia sẻ không trả lời (mất mạng giữa chừng) → B thấy "You're offline", không có nội dung cũ.
5. A (đã có service worker) mở liên kết của mình rồi máy chủ tắt → trang báo lỗi/ngoại tuyến, KHÔNG hiện nội dung đã cache
   (service worker không bao giờ cache API chia sẻ).
6. A thu hồi → B tải lại thấy "doesn't exist, has expired, or was revoked".
7. Token sai 20 lần → lần 21 bị 429 (Retry-After) và trang báo phải chờ.
8. Khách bấm "Replace this device's copy…" trên kho riêng tư → báo rõ, mở hộp thoại mở khoá, không nạp gì.
9. (M3V) Neo `#share` / `#share=` trong trình soạn (tiêu đề "Share", `[x](#share)`) KHÔNG phải liên kết chia sẻ: không tải lại,
   không sang trang "Link not available".

Dùng: `PYTHONUTF8=1 backend/fastapi/.venv/Scripts/python.exe markdown-editor/scripts/kiem-chia-se.py [--anh <thư-mục>]`
Exit code 0 khi mọi phép đạt.
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from _kiem_chung import APP_PATH, BAN_XUAT, MayChuThat, SoKiem, mo_trinh_duyet, utf8_console  # noqa: E402

DOC = r"""# Báo cáo chia sẻ

Công thức Euler $e^{i\pi}+1=0$ và một khối:

$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$

```mermaid
flowchart LR
  A[Bắt đầu] --> B[Kết thúc]
```

```ts
const answer: number = 42 // chú thích
```

| Cột | Giá trị |
| --- | --- |
| a | 1 |

![chấm](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==)

<script>window.__xss=1</script>
<img src=x onerror="window.__xss=2">

[evil](javascript:window.__xss=3) · [khác](khac.md) · [ngoài](https://example.com)
"""
SECRET = "MAT-KHAU-KHONG-DUOC-LO-7731"
OTHER = f"# Tài liệu riêng khác\n\n{SECRET}\n"
EDIT_MARK = "Đoạn mới sau khi chia sẻ."

SEED_JS = """([doc, other]) => {
  if (sessionStorage.getItem('__share_seeded')) return;
  sessionStorage.setItem('__share_seeded', '1');
  localStorage.setItem('markdown-editor:files', JSON.stringify({version: 2, currentFileId: 'file-chia-se-1', expandedFolders: ['root'],
    files: [{id: 'root', name: 'Docs', type: 'folder', children: [
      {id: 'file-chia-se-1', name: 'Báo cáo.md', type: 'file', parentId: 'root', content: doc},
      {id: 'file-rieng-2', name: 'Riêng.md', type: 'file', parentId: 'root', content: other}]}]}));
}"""

# Mọi vi phạm CSP từ lúc trang bắt đầu (trước cả mã của app).
CSP_WATCH_JS = """() => {
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => {
    window.__csp.push({directive: e.violatedDirective || e.effectiveDirective, blocked: String(e.blockedURI || ''), sample: String(e.sample || '')});
  });
}"""

TOKEN_IN_LINK = re.compile(r"#share=([A-Za-z0-9_-]{22})&backend=json$")


def main() -> int:
    utf8_console()
    shots = None
    if "--anh" in sys.argv:
        shots = sys.argv[sys.argv.index("--anh") + 1]
        os.makedirs(shots, exist_ok=True)
    try:
        from playwright.sync_api import sync_playwright
    except Exception:
        print("Thiếu playwright — bỏ qua phép kiểm trình duyệt")
        return 2
    if not os.path.isfile(os.path.join(BAN_XUAT, "index.html")):
        print("Chưa có bản xuất bản — chạy: node scripts/build-webapps.mjs --only markdown-editor")
        return 2

    so = SoKiem()
    srv = MayChuThat()
    try:
        srv.start()
        print(f"Máy chủ thật: {srv.base} (kho json tạm ở {srv.tmp})")
        with sync_playwright() as pw:
            browser, kenh = mo_trinh_duyet(pw)
            if browser is None:
                print("Không mở được Edge/Chrome")
                return 2
            print(f"Trình duyệt: {kenh}")
            try:
                chay(browser, srv, so, shots)
            finally:
                browser.close()
    except Exception as error:  # noqa: BLE001 - một lỗi giữa chừng là một phép SAI, kèm nhật ký máy chủ
        so.kiem("kịch bản chạy hết không ngoại lệ", False, f"{type(error).__name__}: {error}\n{srv.nhat_ky()[-1500:]}")
    finally:
        srv.cleanup()
    return so.tong_ket("\nkiem-chia-se: ")


def chay(browser, srv: MayChuThat, so: SoKiem, shots: str | None) -> None:
    def snap(page, name):
        if shots:
            page.screenshot(path=os.path.join(shots, name + ".png"), full_page=False)

    # ------------------------------------------------------------------ 1. chủ tạo liên kết
    print("· 1. chủ (ngữ cảnh A) tạo liên kết")
    ctx_a = browser.new_context(viewport={"width": 1280, "height": 800}, service_workers="allow")
    ctx_a.add_init_script(f"({SEED_JS})({json.dumps([DOC, OTHER])})")
    a = ctx_a.new_page()
    a.on("dialog", lambda d: d.accept())
    a.goto(srv.app_url, wait_until="load")
    a.wait_for_selector(".editor-input", timeout=20000)
    a.click("button.role-chip")
    a.fill("#admin-key", srv.khoa)
    a.click('button:has-text("Unlock")')
    a.wait_for_selector("button.role-chip.is-admin", timeout=15000)

    # Đưa cả hai tài liệu lên máy chủ (bật Backend sync: lần gặp đầu tiên gửi những gì chỉ có ở máy này): người ẩn danh
    # KHÔNG được thấy tài liệu thứ hai qua bất cứ đường nào.
    a.get_by_role("button", name=re.compile(r"^Sync")).click()
    a.get_by_role("button", name=re.compile(r"Backend sync")).click()
    a.wait_for_selector('button.status-sync:has-text("Synced")', timeout=30000)
    req = urllib.request.Request(srv.api + "/markdown/sync/changes?since=0&backend=json&device=md-kiem", headers={"X-Admin-Key": srv.khoa})
    with urllib.request.urlopen(req, timeout=10) as r:
        on_server = sorted(item["id"] for item in json.loads(r.read().decode("utf-8"))["items"])
    so.kiem("bật Backend sync: cả hai tài liệu đã lên máy chủ (đồng bộ delta, không PUT cả kho)", "file-chia-se-1" in on_server and "file-rieng-2" in on_server, str(on_server))

    def open_dialog():
        a.get_by_role("button", name="File", exact=False).first.click()
        a.get_by_role("button", name=re.compile(r"Share read-only link")).click()
        a.wait_for_selector(".share-panel", timeout=10000)

    open_dialog()
    a.wait_for_selector(".share-panel button:has-text('Create link'):not([disabled])", timeout=15000)
    so.kiem("hộp thoại báo kho json ở thư mục tạm (persistent:false)", a.locator(".share-panel", has_text="temporary file").count() == 1)
    so.kiem("hộp thoại cảnh báo liên kết tới tài liệu khác", a.locator(".share-panel", has_text="point to other documents").count() == 1
            or a.locator(".share-panel", has_text="link points to other documents").count() == 1)
    snap(a, "a-hop-thoai-truoc")
    a.click(".share-panel button:has-text('Create link')")
    a.wait_for_selector("#share-url", timeout=15000)
    link = a.input_value("#share-url")
    m = TOKEN_IN_LINK.search(link)
    so.kiem("liên kết có dạng …/markdown-editor-pro/#share=<22 ký tự>&backend=json (thư mục, không index.html)",
            bool(m) and link.startswith(srv.base + APP_PATH + "#share="), link)
    token = m.group(1) if m else ""
    snap(a, "a-hop-thoai-sau")
    a.keyboard.press("Escape")

    # ------------------------------------------------------------------ 2. người ẩn danh mở
    print("· 2. người ẩn danh (ngữ cảnh B) mở liên kết")
    ctx_b = browser.new_context(viewport={"width": 1280, "height": 800}, service_workers="allow")
    ctx_b.add_init_script(f"({CSP_WATCH_JS})()")
    b = ctx_b.new_page()
    requests: list[str] = []
    shared_headers: list[dict] = []
    dialogs: list[str] = []
    page_errors: list[str] = []
    b.on("request", lambda r: requests.append(r.url))
    b.on("response", lambda r: shared_headers.append(r.headers) if "/markdown/shared" in r.url else None)
    b.on("dialog", lambda d: (dialogs.append(d.message), d.dismiss()))
    b.on("pageerror", lambda e: page_errors.append(str(e)))
    b.goto(link, wait_until="load")
    b.wait_for_selector(".reading-article h1", timeout=20000)
    b.wait_for_selector(".reading-article .katex", timeout=20000)
    b.wait_for_selector(".reading-article .mermaid-diagram svg", timeout=30000)
    b.wait_for_selector(".reading-article .code-block span.token", timeout=20000)
    b.wait_for_timeout(800)
    snap(b, "b-trang-xem")

    info = b.evaluate("""() => {
      const art = document.querySelector('.reading-article');
      const img = art.querySelector('img[src^="data:image/png"]');
      const ext = art.querySelector('a[href="https://example.com"]');
      const meta = (sel) => document.querySelector(sel)?.getAttribute('content') || '';
      return {
        h1: art.querySelector('h1')?.textContent || '',
        title: document.title,
        katex: art.querySelectorAll('.katex').length, display: art.querySelectorAll('.katex-display').length,
        katexErr: art.querySelectorAll('.katex-error').length,
        mermaidErr: art.querySelectorAll('.mermaid-error').length,
        table: !!art.querySelector('table td'),
        img: img ? img.naturalWidth : -1,
        xss: typeof window.__xss,
        dead: Array.from(art.querySelectorAll('span.md-dead-link')).map((n) => n.textContent),
        linkToOther: !!art.querySelector('a[href="khac.md"]'),
        jsLinks: /javascript:/i.test(art.innerHTML),
        extRel: ext ? ext.rel : '',
        robots: meta('meta[name="robots"]'), referrer: meta('meta[name="referrer"]'),
        csp: meta('meta[http-equiv="Content-Security-Policy"]'),
        editor: !!document.querySelector('.editor-input'),
        exitBtn: !!document.querySelector('[aria-label="Exit reading mode"]'),
        workspace: localStorage.getItem('markdown-editor:files'),
        text: document.body.innerText,
        csp0: window.__csp.slice(),
      };
    }""")
    so.kiem("tiêu đề tài liệu và tiêu đề tab đúng (tiêu đề liên kết = tên tệp)",
            "Báo cáo chia sẻ" in info["h1"] and info["title"] == "Báo cáo · Shared (read-only)",
            f"{info['h1']!r} / {info['title']!r}")
    so.kiem("toán vẽ đúng: ≥ 2 công thức KaTeX, có khối display, 0 katex-error",
            info["katex"] >= 2 and info["display"] >= 1 and info["katexErr"] == 0, f"katex={info['katex']} display={info['display']} err={info['katexErr']}")
    so.kiem("Mermaid vẽ ra <svg> (offline, trong trình duyệt), không lỗi", info["mermaidErr"] == 0)
    so.kiem("code được tô màu, có bảng, ảnh data hiện", info["table"] and info["img"] > 0, f"table={info['table']} img={info['img']}")
    so.kiem("XSS không chạy (script, onerror, javascript:) và không có hộp thoại", info["xss"] == "undefined" and not dialogs and not info["jsLinks"],
            f"__xss={info['xss']} dialogs={dialogs}")
    so.kiem("liên kết tới tài liệu khác thành span.md-dead-link", "khác" in info["dead"] and not info["linkToOther"], repr(info["dead"]))
    so.kiem("liên kết ngoài có rel noopener + noreferrer", "noopener" in info["extRel"] and "noreferrer" in info["extRel"], info["extRel"])
    so.kiem("meta robots noindex + referrer no-referrer + meta CSP (script-src 'self', không unsafe-eval)",
            "noindex" in info["robots"] and info["referrer"] == "no-referrer" and "script-src 'self'" in info["csp"] and "unsafe-eval" not in info["csp"],
            f"{info['robots']!r} {info['csp'][:80]!r}")
    so.kiem("không vi phạm CSP nào từ tài nguyên của app (chunk, font KaTeX, Mermaid…)", not info["csp0"], json.dumps(info["csp0"])[:300])
    so.kiem("trang xem không có trình soạn, không nút thoát, không ghi kho cục bộ",
            not info["editor"] and not info["exitBtn"] and info["workspace"] is None)
    so.kiem("không thấy nội dung tài liệu khác trên trang", SECRET not in info["text"])
    so.kiem("không lỗi JS trên trang xem", not page_errors, "; ".join(page_errors)[:300])

    injected = b.evaluate("""async () => {
      const inline = document.createElement('script');
      inline.textContent = 'window.__injected = 1';
      document.body.appendChild(inline);
      const foreign = document.createElement('script');
      foreign.src = 'https://example.com/la.js';
      document.body.appendChild(foreign);
      await new Promise((r) => setTimeout(r, 400));
      return {ran: typeof window.__injected, csp: window.__csp.slice()};
    }""")
    directives = [v["directive"] for v in injected["csp"]]
    so.kiem("CSP chặn script chèn vào: inline không chạy, script từ origin lạ bị chặn (có securitypolicyviolation)",
            injected["ran"] == "undefined" and sum(1 for d in directives if d.startswith("script-src")) >= 2, json.dumps(injected)[:300])

    regs = b.evaluate("async () => (await navigator.serviceWorker.getRegistrations()).length")
    so.kiem("trang xem KHÔNG đăng ký service worker", regs == 0, f"{regs} bản đăng ký")
    hdr = shared_headers[-1] if shared_headers else {}
    so.kiem("GET /markdown/shared: Cache-Control no-store + X-Robots-Tag noindex",
            "no-store" in hdr.get("cache-control", "") and "noindex" in hdr.get("x-robots-tag", ""), json.dumps(hdr)[:200])
    so.kiem("không request nào mang token trong URL (token chỉ đi qua header X-Share-Token)",
            bool(token) and not any(token in u for u in requests), "\n".join(u for u in requests if token in u)[:300])
    private = b.evaluate("""async (api) => {
      const r = await fetch(api + '/markdown/files?backend=json', {credentials: 'omit'});
      let code = null; try { code = (await r.json()).data?.code } catch {}
      return {status: r.status, code};
    }""", srv.api)
    so.kiem("người ẩn danh không đọc được kho: GET /markdown/files → 403 markdown_private (Q1)",
            private == {"status": 403, "code": "markdown_private"}, json.dumps(private))

    b.set_viewport_size({"width": 360, "height": 740})
    b.wait_for_timeout(400)
    wide = b.evaluate("() => ({doc: document.documentElement.scrollWidth, win: window.innerWidth, "
                      "col: (() => { const s = document.querySelector('.reading-scroll'); return s ? s.scrollWidth - s.clientWidth : 0 })()})")
    so.kiem("360 px: không cuộn ngang (trang và cột đọc)", wide["doc"] <= wide["win"] and wide["col"] <= 1, json.dumps(wide))
    snap(b, "b-360")
    b.set_viewport_size({"width": 1280, "height": 800})

    # ------------------------------------------------------------------ 3. snapshot + update
    print("· 3. snapshot: chủ sửa → người xem vẫn thấy bản cũ; Update snapshot → thấy bản mới")
    a.fill(".editor-input", DOC + "\n" + EDIT_MARK + "\n")
    a.keyboard.press("Control+s")
    b.reload(wait_until="load")
    b.wait_for_selector(".reading-article h1", timeout=20000)
    so.kiem("chủ sửa xong, người xem tải lại vẫn thấy bản chụp cũ", EDIT_MARK not in b.inner_text(".reading-article"))
    open_dialog()
    a.wait_for_selector(".share-panel button:has-text('Update snapshot'):not([disabled])", timeout=15000)
    a.wait_for_selector(".share-panel >> text=changed since this snapshot", timeout=10000)
    so.kiem("hộp thoại báo 'The document changed since this snapshot'", True)
    a.click(".share-panel button:has-text('Update snapshot')")
    a.wait_for_selector("text=Snapshot updated", timeout=15000)
    same = a.input_value("#share-url") == link
    a.keyboard.press("Escape")
    b.reload(wait_until="load")
    b.wait_for_selector(f".reading-article >> text={EDIT_MARK}", timeout=20000)
    so.kiem("Update snapshot: người xem thấy bản mới, liên kết (token) giữ nguyên", same)

    # ------------------------------------------------------------------ 4. API không trả lời
    print("· 4. API chia sẻ không trả lời → 'You're offline'")
    ctx_b.route("**/markdown/shared**", lambda route: route.abort("internetdisconnected"))
    b.reload(wait_until="load")
    b.wait_for_selector("h1.share-status-title", timeout=20000)
    head = b.inner_text("h1.share-status-title")
    so.kiem("API không tới được: báo 'You're offline', không hiện nội dung cũ",
            "offline" in head.lower() and b.locator(".reading-article").count() == 0 and EDIT_MARK not in b.inner_text("body"), head)
    snap(b, "b-offline")
    ctx_b.unroute("**/markdown/shared**")

    # ------------------------------------------------------------------ 5. chủ có SW, máy chủ tắt
    print("· 5. chủ (có service worker) mở liên kết của mình, máy chủ tắt → không hiện bản cache")
    sw_ready = a.evaluate("""async () => {
      if (!('serviceWorker' in navigator)) return 'none';
      const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 20000))]);
      return reg && reg.active ? 'active' : 'pending';
    }""")
    own = ctx_a.new_page()
    own.goto(link, wait_until="load")
    own.wait_for_selector(f".reading-article >> text={EDIT_MARK}", timeout=20000)
    controlled = own.evaluate("() => !!navigator.serviceWorker.controller")
    srv.stop()
    try:
        own.reload(wait_until="load")
        own.wait_for_selector("h1.share-status-title", timeout=20000)
        shown = own.inner_text("body")
        so.kiem(f"máy chủ tắt: trang (do SW {'phục vụ' if controlled else 'không phục vụ'}, SW {sw_ready}) báo lỗi/ngoại tuyến, KHÔNG hiện nội dung đã cache",
                own.locator(".reading-article").count() == 0 and EDIT_MARK not in shown and controlled, f"controlled={controlled} sw={sw_ready}")
    except Exception as error:  # noqa: BLE001
        so.kiem("máy chủ tắt: trang của chủ (qua SW) vẫn mở được và báo lỗi", False, f"{type(error).__name__}: {error}")
    finally:
        srv.start()
    own.close()

    # ------------------------------------------------------------------ 6. thu hồi
    print("· 6. chủ thu hồi → người xem thấy 'revoked'")
    a.reload(wait_until="load")
    a.wait_for_selector("button.role-chip.is-admin", timeout=20000)
    open_dialog()
    a.wait_for_selector(".share-panel button:has-text('Revoke link')", timeout=15000)
    a.click(".share-panel button:has-text('Revoke link')")
    a.wait_for_selector("text=Link revoked", timeout=15000)
    a.keyboard.press("Escape")
    b.reload(wait_until="load")
    b.wait_for_selector("[role=alert]", timeout=20000)
    msg = b.inner_text("[role=alert]")
    so.kiem("đã thu hồi: 'This link doesn't exist, has expired, or was revoked by its owner.'",
            "doesn't exist, has expired, or was revoked" in msg and b.locator(".reading-article").count() == 0, msg)
    snap(b, "b-thu-hoi")

    # ------------------------------------------------------------------ 7. token sai bị giới hạn
    print("· 7. token sai bị giới hạn")
    statuses = []
    for _ in range(21):
        r = ctx_b.request.get(srv.api + "/markdown/shared?backend=json", headers={"X-Share-Token": "w" * 22})
        statuses.append((r.status, r.headers.get("retry-after")))
    # Lần tải lại sau khi thu hồi (bước 6) đã là 1 token sai từ cùng địa chỉ, nên 429 tới ở lần thứ 20 của vòng này.
    first = next((i for i, (s, _) in enumerate(statuses) if s == 429), None)
    so.kiem("token sai: 404 cho tới khi đủ 20 lần sai trong 10 phút, rồi 429 có Retry-After",
            first is not None and 18 <= first <= 20 and all(s == 404 for s, _ in statuses[:first])
            and (statuses[first][1] or "").isdigit(), repr(statuses))
    b.reload(wait_until="load")
    b.wait_for_selector("[role=alert]", timeout=20000)
    so.kiem("trang xem báo phải chờ ('Try again in … seconds') khi bị giới hạn", "Try again in" in b.inner_text("[role=alert]"), b.inner_text("[role=alert]"))
    # Chính chủ (khoá quản trị) không bị khoá theo bộ đếm token sai: đó là bộ đếm khác.
    req = urllib.request.Request(srv.api + "/markdown/shares?backend=json", headers={"X-Admin-Key": srv.khoa})
    with urllib.request.urlopen(req, timeout=10) as r:
        so.kiem("bộ đếm token sai không khoá quản trị (GET /markdown/shares vẫn 200)", r.status == 200)

    # ------------------------------------------------------------------ 8. khách bấm "Replace this device's copy…"
    print("· 8. khách (trình soạn, chưa mở khoá) bấm Replace this device's copy trên kho riêng tư")
    guest = ctx_b.new_page()
    asked: list[str] = []
    guest.on("dialog", lambda d: (asked.append(d.message), d.accept()))
    guest.goto(srv.app_url, wait_until="load")
    guest.wait_for_selector(".editor-input", timeout=20000)
    guest.get_by_role("button", name=re.compile(r"^Sync")).click()
    guest.get_by_role("button", name=re.compile(r"Backend sync")).click()
    guest.get_by_role("button", name=re.compile(r"^Sync")).click()
    guest.get_by_role("button", name=re.compile(r"Replace this device")).click()
    guest.wait_for_selector("text=This server's documents are private", timeout=15000)
    auth_open = guest.locator("#admin-key").count() == 1
    so.kiem("khách bấm Replace this device's copy: báo rõ kho riêng tư + mở hộp thoại mở khoá, không hỏi 'thay tài liệu', không nạp gì",
            auth_open and not asked and SECRET not in guest.inner_text("body"), f"auth={auth_open} dialogs={asked}")
    snap(guest, "khach-load-rieng-tu")
    guest.close()

    # ------------------------------------------------------------------ 9. neo "#share" không phải liên kết chia sẻ (M3V)
    print("· 9. neo #share trong trình soạn không nhảy sang trang liên kết")
    # Chủ (đã mở khoá) mới gõ được: ô soạn của khách chỉ đọc.
    anchor = ctx_a.new_page()
    anchor_errors: list[str] = []
    anchor.on("pageerror", lambda e: anchor_errors.append(str(e)))
    anchor.goto(srv.app_url, wait_until="load")
    anchor.wait_for_selector("button.role-chip.is-admin", timeout=20000)
    anchor.wait_for_selector(".editor-input:not([readonly])", timeout=20000)
    nl = chr(10)
    anchor.fill(".editor-input", f"# Share{nl}{nl}đoạn văn{nl}{nl}[đi tới](#share) và [rỗng](#share=){nl}")
    anchor.wait_for_selector('.preview-pane a[href="#share"]', timeout=15000)
    anchor.evaluate("() => { window.__khong_tai_lai = 'con' }")
    anchor.click('.preview-pane .markdown-body p a[href="#share"]')
    anchor.wait_for_timeout(600)
    after_link = anchor.evaluate("() => ({keep: window.__khong_tai_lai, hash: location.hash})")
    anchor.click('.preview-pane .markdown-body p a[href="#share="]')
    anchor.wait_for_timeout(600)
    anchor.locator(".preview-pane h1 .heading-anchor").dispatch_event("click")
    anchor.wait_for_timeout(600)
    anchor.evaluate("() => { location.hash = '#share' }")
    anchor.wait_for_timeout(600)
    state = anchor.evaluate("""() => ({
      keep: window.__khong_tai_lai, hash: location.hash,
      editor: !!document.querySelector('.editor-input'),
      sharePage: !!document.querySelector('h1.share-status-title'),
      notAvailable: document.body.innerText.includes('Link not available'),
      robots: !!document.querySelector('meta[data-share-hardening]'),
    })""")
    so.kiem("bấm [x](#share) trong xem trước: vẫn là trình soạn, không tải lại trang",
            after_link["keep"] == "con" and after_link["hash"] == "#share", json.dumps(after_link))
    so.kiem("bấm [x](#share=), neo tiêu đề 'Share' và đặt location.hash='#share': không tải lại, không 'Link not available', không gia cố trang chia sẻ",
            state["keep"] == "con" and state["editor"] and not state["sharePage"] and not state["notAvailable"] and not state["robots"] and not anchor_errors,
            json.dumps(state) + " " + "; ".join(anchor_errors)[:200])
    snap(anchor, "neo-share-trinh-soan")
    anchor.close()

    ctx_a.close()
    ctx_b.close()


if __name__ == "__main__":
    sys.exit(main())
