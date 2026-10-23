#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kiểm Markdown Editor Pro cài về máy và chạy offline — Edge/Chrome THẬT + máy chủ THẬT.

    backend\\fastapi\\.venv\\Scripts\\python.exe markdown-editor\\scripts\\kiem-pwa.py [--anh <thư-mục>]

Cần bản đã xuất bản (`node scripts/build-webapps.mjs --only markdown-editor`) và playwright.

Kịch bản (một trình duyệt, một origin, để service worker và localStorage sống xuyên suốt):
  1. mở trang → service worker cài xong và LƯU ĐỦ mọi tệp (kể cả chunk mermaid/PDF, không chỉ tệp index.html nhắc tới)
  2. manifest + biểu tượng tải được; hộp thoại "Use offline" từ menu File báo "Ready offline"
  3. đăng nhập quản trị bằng khoá thật, soạn một tài liệu
  4. TẮT máy chủ + mất mạng → tải lại: trang mở từ bộ nhớ đệm, vẫn là quản trị (token đã lưu), sửa được
  5. offline: KaTeX và sơ đồ Mermaid (chunk tải lười) vẫn vẽ ra; không có yêu cầu nào tới /webapp/ bị hỏng
  6. tải lại offline lần nữa → nội dung vừa sửa còn nguyên
  7. máy chủ chạy lại với khoá KHÁC (mô phỏng đổi khoá) rồi có mạng → phiên bị từ chối → về chế độ chỉ xem, có thông báo
  8. khách (chưa mở khoá) offline: đọc được, KHÔNG sửa được
  9. (đợt M1, ngữ cảnh mới, máy chủ chạy lại) khung hình đầu là tài liệu đã lưu chứ không phải welcome.md; khối code tô màu
     bằng class (không style màu inline) và "Export HTML" giữ luật màu; màu từng token (cả token lồng nhau của HTML/JSX/bash/
     C++/CSS/PHP) ở preview VÀ trong tệp Export HTML trùng y hệt màu chế độ inline cũ gán cho đúng danh sách lớp đó
     (đáp án: scripts/mau-token-inline.cjs, dùng createStyleObject của thư viện);
     menu Sync có dòng cảnh báo "ghi đè cả kho";
     "Load from backend" hỏi xác nhận (huỷ thì giữ nguyên, đồng ý thì nạp); localStorage đầy → banner đỏ + hỏi trước khi
     rời trang, dọn chỗ rồi lưu lại thì banner tắt; chế độ đọc tài liệu dài: cuộn cập nhật tiến độ + mục đang đọc, bấm
     mục lục nhảy đúng tiêu đề; luồng chính bận 9,9 s khi đang kiểm phiên, trả lời về sau 10,5 s → vẫn là quản trị
 10. (đợt M2, toán kiểu LLM + chặn style) tài liệu có \\( \\), \\[ \\], \\begin{align} trần, $$x$$ một dòng, "$$ chữ"
     hai dòng, mhchem, \\eqref, giá $5/$10: preview đủ số công thức hiển thị/nội dòng, 0 katex-error, giá tiền là chữ;
     khối toán là div.math-block[data-line] đúng dòng nguồn, nhấp đúp khối toán → con trỏ editor về đúng dòng, tiêu đề
     sau toán giữ data-line; style="background-image:url(…)" bị bỏ (0 yêu cầu tới máy theo dõi) còn màu giữ,
     position:fixed bị bỏ; chế độ đọc và tệp Export HTML có cùng công thức; welcome.md (ngữ cảnh mới) có ví dụ toán

AN TOÀN: máy chủ chạy với DB_URL trỏ SQLite trong thư mục tạm và MONGO_URI rỗng (ghi đè .env); khoá quản trị trong
phép kiểm là chuỗi giả của chính script này, không phải khoá thật.
Trả exit code khác 0 nếu có phép kiểm sai.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
BE = os.path.join(REPO, "backend", "fastapi")
APP_PATH = "/webapp/tranphuc8a/markdown-editor-pro/"
PY = os.path.join(BE, ".venv", "Scripts", "python.exe")
if not os.path.exists(PY):
    PY = sys.executable

KEY_A = "kiem-pwa-khoa-gia-A"
KEY_B = "kiem-pwa-khoa-gia-B"

G, R, X = "\033[32m", "\033[31m", "\033[0m"
passed: list[str] = []
failed: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> bool:
    (passed if ok else failed).append(name)
    print(f"  {G + '[ok]' + X if ok else R + '[SAI]' + X}  {name}" + (f"  — {detail}" if detail and not ok else ""))
    return ok


class Server:
    """uvicorn thật + SQLite tạm; dừng/chạy lại được trên CÙNG cổng (cùng origin) với khoá quản trị tuỳ chọn."""

    def __init__(self):
        self.tmp = tempfile.mkdtemp(prefix="mdpro-pwa-")
        with socket.socket() as s:
            s.bind(("127.0.0.1", 0))
            self.port = s.getsockname()[1]
        self.base = f"http://127.0.0.1:{self.port}"
        self.proc = None
        self.log = None

    def start(self, admin_key: str):
        env = dict(os.environ)
        env.update({
            "DB_URL": "sqlite+aiosqlite:///" + os.path.join(self.tmp, "dev.sqlite3").replace("\\", "/"),
            "DATA_DIR": self.tmp, "MONGO_URI": "", "API_PREFIX": "/api/v1", "PYTHONUTF8": "1", "AI_ENABLED": "false",
            "MARKDOWN_ADMIN_KEY": admin_key, "PYTHONPATH": BE,
            # dây an toàn thứ hai: nếu DB_URL bị bỏ qua, các trường DB_* trỏ vào hư vô thay vì MySQL thật trong .env
            "DB_HOST": "127.0.0.1", "DB_PORT": "9", "DB_USERNAME": "kiem", "DB_PASSWORD": "kiem", "DB_DATABASE": "kiem",
        })
        self.log = open(os.path.join(self.tmp, "server.log"), "a", encoding="utf-8")
        self.proc = subprocess.Popen([PY, "-m", "uvicorn", "src.main:app", "--host", "127.0.0.1", "--port", str(self.port), "--log-level", "warning"],
                                     cwd=BE, env=env, stdout=self.log, stderr=subprocess.STDOUT)
        for _ in range(120):
            try:
                urllib.request.urlopen(self.base + "/webapp/_api/list", timeout=1).read()
                return self
            except Exception:
                if self.proc.poll() is not None:
                    break
                time.sleep(0.5)
        self.stop()
        raise RuntimeError("Máy chủ không khởi động được:\n" + open(os.path.join(self.tmp, "server.log"), encoding="utf-8", errors="replace").read()[-1500:])

    def stop(self):
        if self.proc and self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=8)
            except Exception:
                self.proc.kill()
        self.proc = None
        if self.log:
            self.log.close()
            self.log = None

    def cleanup(self):
        self.stop()
        shutil.rmtree(self.tmp, ignore_errors=True)


def launch(pw):
    for kw in ({"channel": "msedge"}, {"channel": "chrome"}, {}):
        try:
            return pw.chromium.launch(**kw), kw.get("channel", "chromium")
        except Exception:
            continue
    return None, None


# lỗi mạng là điều CHỦ Ý khi tắt máy chủ; chỉ lỗi khác mới đáng báo
EXPECTED_NOISE = ("net::ERR_", "Failed to load resource", "Cannot reach the backend", "Failed to fetch")

OFFLINE_MARKER_JS = """async () => {
  const scope = new URL('./', document.baseURI).href;
  for (const name of await caches.keys()) {
    if (!name.startsWith('mdpro:' + scope + ':')) continue;
    const hit = await (await caches.open(name)).match(scope + '__offline-ready.json');
    if (hit) return await hit.json();
  }
  return null;
}"""


def main() -> int:
    shots = None
    if "--anh" in sys.argv:
        shots = sys.argv[sys.argv.index("--anh") + 1]
        os.makedirs(shots, exist_ok=True)
    try:
        from playwright.sync_api import sync_playwright
    except Exception:
        print("Thiếu playwright (pip install playwright) — bỏ qua phép kiểm trình duyệt")
        return 2

    srv = Server()
    try:
        srv.start(KEY_A)
        with sync_playwright() as pw:
            browser, which = launch(pw)
            if browser is None:
                print("Không tìm thấy Edge/Chrome/Chromium cho Playwright")
                return 2
            print(f"Markdown Editor Pro — PWA offline ({which}) · {srv.base}{APP_PATH}")
            try:
                run(browser, srv, shots)
                srv.start(KEY_A)
                run_m1(browser, srv, shots)
                run_m2(browser, srv, shots)
            finally:
                browser.close()
    finally:
        srv.cleanup()

    print(f"\n{'=' * 60}\nĐạt {len(passed)} · SAI {len(failed)}")
    for n in failed:
        print(f"  - {n}")
    return 1 if failed else 0


def run(browser, srv: Server, shots: str | None) -> None:
    url = srv.base + APP_PATH
    ctx = browser.new_context(viewport={"width": 1280, "height": 800}, service_workers="allow")
    page = ctx.new_page()
    errors: list[str] = []
    failed_requests: list[str] = []
    page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type == "error" and not any(n in m.text for n in EXPECTED_NOISE) else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on("requestfailed", lambda r: failed_requests.append(r.url) if "/webapp/" in r.url else None)

    def snap(name):
        if shots:
            page.screenshot(path=os.path.join(shots, name + ".png"))

    def editor_text():
        return page.input_value(".editor-input")

    # --- 1. cài worker và lưu đủ tệp
    print("  · lần mở đầu tiên: service worker cài và lưu bản offline")
    page.goto(url, wait_until="load")
    page.wait_for_selector(".editor-input")
    marker = None
    for _ in range(180):
        marker = page.evaluate(OFFLINE_MARKER_JS)
        if marker:
            break
        page.wait_for_timeout(500)
    check("service worker cài xong và ghi dấu 'sẵn sàng offline'", marker is not None, "hết 90 giây mà chưa có dấu")
    n_files = (marker or {}).get("files", 0)
    check(f"lưu ĐỦ mọi tệp của bản build ({n_files} tệp, không tệp nào lỗi)", n_files >= 300 and (marker or {}).get("failed", 1) == 0, json.dumps(marker))
    sw_url = srv.base + APP_PATH + "sw.js"
    r = ctx.request.get(sw_url)
    check("sw.js phục vụ đúng kiểu JavaScript, đã điền build id và danh sách tệp (không còn placeholder)",
          r.ok and "javascript" in r.headers.get("content-type", "") and "__BUILD__" not in r.text() and "__PRECACHE__" not in r.text(), r.headers.get("content-type", ""))
    page.reload(wait_until="load")
    page.wait_for_selector(".editor-input")
    page.wait_for_function("() => navigator.serviceWorker.controller !== null", timeout=10000)
    check("sau khi tải lại, trang do service worker điều khiển", True)

    # --- 2. manifest, biểu tượng, hộp thoại
    mf = ctx.request.get(srv.base + APP_PATH + "manifest.webmanifest")
    mj = mf.json() if mf.ok else {}
    icons_ok = mf.ok and all(ctx.request.get(srv.base + APP_PATH + i["src"]).ok for i in mj.get("icons", [])) and len(mj.get("icons", [])) >= 3
    check("manifest tải được: tên, start_url/scope tương đối, standalone, biểu tượng 192/512/maskable đều có thật",
          mf.ok and mj.get("display") == "standalone" and mj.get("start_url") == "./" and mj.get("scope") == "./" and icons_ok and {i["purpose"] for i in mj["icons"]} >= {"any", "maskable"})
    check("index.html liên kết manifest + theme-color + apple-touch-icon",
          page.locator('link[rel="manifest"]').count() == 1 and page.locator('meta[name="theme-color"]').count() == 1 and page.locator('link[rel="apple-touch-icon"]').count() == 1)

    page.get_by_role("button", name="File", exact=False).first.click()
    page.get_by_role("button", name="Install app / use offline").click()
    page.wait_for_selector('[role="dialog"][aria-labelledby="install-title"]')
    status = page.inner_text(".install-status")
    check("menu File → 'Install app / use offline…' mở hộp thoại, báo 'Ready offline' kèm số tệp", "Ready offline" in status and str(n_files) in status, status)
    snap("01-hop-thoai-offline")
    page.keyboard.press("Escape")
    page.wait_for_selector('[aria-labelledby="install-title"]', state="detached")
    check("Esc đóng hộp thoại", True)

    # --- 3. đăng nhập quản trị, soạn
    print("  · đăng nhập quản trị (khoá thật của máy chủ thử), soạn tài liệu")
    page.click("button.role-chip")
    page.fill("#admin-key", KEY_A)
    page.click('button:has-text("Unlock")')
    page.wait_for_selector("button.role-chip.is-admin", timeout=10000)
    check("mở khoá quản trị bằng khoá thật → chip 'Admin'", True)
    page.fill(".editor-input", "# Bản nháp trên máy bay\n\nmột")
    page.keyboard.press("Control+s")
    page.wait_for_timeout(300)
    saved = page.evaluate("() => localStorage.getItem('markdown-editor:files') || ''")
    check("tài liệu đã lưu vào localStorage của trình duyệt", "Bản nháp trên máy bay" in saved)

    # --- 4. tắt máy chủ + mất mạng
    print("  · TẮT máy chủ và mất mạng, tải lại")
    srv.stop()
    ctx.set_offline(True)
    page.wait_for_timeout(200)
    page.reload(wait_until="domcontentloaded")
    page.wait_for_selector(".editor-input", timeout=15000)
    check("tải lại khi máy chủ đã tắt và mất mạng: trang vẫn mở (từ bộ nhớ đệm của worker)", True)
    check("nội dung còn nguyên sau khi tải lại offline", "Bản nháp trên máy bay" in editor_text())
    page.wait_for_selector("button.role-chip.is-admin", timeout=15000)
    ro = page.get_attribute(".editor-input", "readonly")
    check("offline vẫn là quản trị (token đã lưu được tin tạm) → ô soạn KHÔNG chỉ-đọc", ro is None)
    snap("02-offline-quan-tri")

    # --- 5. sửa offline, KaTeX + Mermaid
    page.fill(".editor-input", "# Offline\n\nCông thức $x^2 + y^2$\n\n```mermaid\ngraph TD\n  A[Mất mạng] --> B[Vẫn vẽ được]\n```\n\nhai")
    check("gõ được khi offline", "Mất mạng" in editor_text())
    page.wait_for_selector(".markdown-body .katex", timeout=20000)
    check("KaTeX vẽ được offline (font KaTeX lấy từ bộ nhớ đệm)", page.locator(".markdown-body .katex").count() >= 1)
    page.wait_for_selector(".mermaid-diagram svg", timeout=30000)
    check("sơ đồ Mermaid vẽ được offline (chunk tải lười đã được lưu sẵn)", page.locator(".mermaid-diagram svg").count() >= 1)
    check("không có yêu cầu nào tới /webapp/ bị hỏng khi offline (mọi tệp do worker phục vụ)", not failed_requests, ", ".join(failed_requests[:3]))
    snap("03-offline-katex-mermaid")
    page.keyboard.press("Control+s")
    page.wait_for_timeout(300)

    # --- 6. tải lại offline lần nữa
    page.reload(wait_until="domcontentloaded")
    page.wait_for_selector(".editor-input", timeout=15000)
    check("tải lại offline lần hai: nội dung vừa sửa còn nguyên", "Vẫn vẽ được" in editor_text())

    # --- 7. đổi khoá rồi có mạng lại
    print("  · máy chủ chạy lại với khoá KHÁC, rồi có mạng")
    srv.start(KEY_B)
    ctx.set_offline(False)
    page.wait_for_selector("button.role-chip:not(.is-admin)", timeout=20000)
    check("có mạng lại, máy chủ từ chối token cũ (khoá đã đổi) → về chế độ chỉ xem", True)
    check("có thông báo 'Admin session expired — switched to view-only mode'", "Admin session expired" in page.inner_text("body"))
    check("ô soạn chuyển sang chỉ-đọc", page.get_attribute(".editor-input", "readonly") is not None)
    check("nội dung vẫn còn (chỉ mất quyền sửa, không mất dữ liệu)", "Vẫn vẽ được" in editor_text())
    snap("04-het-phien-chi-xem")

    # --- 8. khách offline
    print("  · khách (chưa mở khoá) offline")
    page.evaluate("() => localStorage.removeItem('markdown-editor:admin-session')")
    srv.stop()
    ctx.set_offline(True)
    page.reload(wait_until="domcontentloaded")
    page.wait_for_selector(".editor-input", timeout=15000)
    check("khách offline: đọc được tài liệu đã lưu", "Vẫn vẽ được" in editor_text())
    check("khách offline KHÔNG sửa được (vẫn chỉ-đọc, không có token để tin)", page.get_attribute(".editor-input", "readonly") is not None and page.locator("button.role-chip.is-admin").count() == 0)

    check("không lỗi console/pageerror bất ngờ suốt phiên (trừ lỗi mạng chủ ý)", not errors, " | ".join(errors[:3]))
    ctx.close()


# ---------------------------------------------------------------------------------------------------------------------
# 9. Đợt M1 (perf-md 2–5 + vá tạm mất dữ liệu ke-hoach §1.3 + hai lỗi M0 phát hiện)
# ---------------------------------------------------------------------------------------------------------------------
STORED_DOC = "# Tài liệu đã lưu\n\nViết từ lần trước.\n\n```ts\nconst answer: number = 42 // chú thích\nexport function f() { return 'chuỗi' }\n```\n"

SEED_JS = """(doc) => {
  if (!sessionStorage.getItem('__m1_seeded')) {
    sessionStorage.setItem('__m1_seeded', '1');
    localStorage.setItem('markdown-editor:files', JSON.stringify({version: 2, currentFileId: 'mine', expandedFolders: ['root'],
      files: [{id: 'root', name: 'Docs', type: 'folder', children: [{id: 'mine', name: 'mine.md', type: 'file', parentId: 'root', content: doc}]}]}));
  }
  // What the first frames show: rAF runs right before a paint, so the first value seen here is the first painted.
  window.__first = {};
  const tick = () => {
    const ta = document.querySelector('.editor-input');
    if (ta && window.__first.editor === undefined) window.__first.editor = ta.value;
    const pv = document.querySelector('.preview-scroll .markdown-body');
    if (pv && pv.textContent.trim() && window.__first.preview === undefined) window.__first.preview = pv.textContent;
    if (window.__first.editor === undefined || window.__first.preview === undefined) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}"""

# Màu token: tài liệu có nhiều token LỒNG NHAU (lá mang lớp của cha lẫn của nó: "token tag attr-name", "token macro
# property directive keyword"…). Bản M1 đầu tiên làm đổi màu 45/99 token loại này; đáp án là chế độ inline gốc.
COLOUR_BLOCKS = [
    ("html", '<!DOCTYPE html>\n<div class="box" id=\'main\' data-x=1><a href="/x?a=1&amp;b=2">link</a><br/></div>\n<style>.a { color: red; }</style>\n<script>const x = 1; if (x) { alert("hi") }</script>\n<!-- chú thích -->'),
    ("bash", 'echo "hi $HOME"; cd /tmp && export X=1\ntest -f a && printf \'%s\' b\nfor f in *.md; do wc -l "$f"; done # đếm'),
    ("jsx", 'const A = () => <div className="a" onClick={() => go(1)}>{name}<B x={2} {...rest} /></div>'),
    ("cpp", '#include <vector>\n#define MAX(a, b) ((a) > (b) ? (a) : (b))\ntemplate <typename T> class Box { public: T v; };\nint main() { std::vector<int> v{1, 2}; return MAX(v[0], 3); }'),
    ("css", '@media (max-width: 600px) { .a > b:hover, #id::before { color: #fff !important; content: "x"; } }'),
    ("php", '<?php\nfunction f(int $x): string { return "v=$x" . strtoupper(\'a\'); }\n?>'),
]
COLOUR_DOC = "# Màu khối code\n\n" + "\n\n".join(f"```{fence}\n{src}\n```" for fence, src in COLOUR_BLOCKS) + "\n"

# Lớp của từng span trong từng khối (bỏ lớp luật prism-tN) — đầu vào của đáp án.
COLOUR_CLASSES_JS = """(selector) => Array.from(document.querySelectorAll(selector)).map((block) =>
  Array.from(block.querySelectorAll('.prismjs code span')).map((s) => s.className.split(' ').filter((c) => c && !c.startsWith('prism-t'))))"""

# So từng token: Edge tính màu token của app, rồi tính màu một span "thăm dò" mang đúng style inline cũ đặt ngay cạnh
# (cùng cha nên cùng kế thừa) — hai bên phải trùng. Khung khối code so riêng với một div thăm dò mang style inline cũ.
COLOUR_PROBE_JS = """([selector, answer]) => {
  const props = ['color', 'font-style', 'font-weight', 'text-decoration-line', 'background-color', 'cursor', 'opacity'];
  const wprops = ['color', 'font-family', 'font-size', 'line-height', 'white-space', 'tab-size', 'direction', 'text-align',
                  'word-break', 'word-spacing', 'hyphens', 'padding-left', 'overflow-x', 'border-top-left-radius', 'text-shadow'];
  const read = (el, list) => { const cs = getComputedStyle(el); return list.map((p) => cs.getPropertyValue(p)).join(' | '); };
  const blocks = Array.from(document.querySelectorAll(selector));
  const out = { blocks: blocks.length, tokens: 0, nested: 0, styled: 0, diffs: [], wrapper: [] };
  blocks.forEach((block, b) => {
    const styles = answer.blocks[b];
    const wrap = block.querySelector('.prismjs');
    const spans = Array.from(wrap.querySelectorAll('code span'));
    if (!styles || spans.length !== styles.length) { out.diffs.push('block ' + b + ': ' + spans.length + ' span, đáp án ' + (styles || []).length); return; }
    const pw = document.createElement('div');
    pw.setAttribute('style', answer.wrapper);
    wrap.parentNode.insertBefore(pw, wrap);
    if (read(pw, wprops) !== read(wrap, wprops)) out.wrapper.push('block ' + b + ': ' + read(wrap, wprops) + ' ≠ ' + read(pw, wprops));
    pw.remove();
    spans.forEach((span, i) => {
      out.tokens += 1;
      if (styles[i]) out.styled += 1;
      if (span.className.split(' ').filter((c) => c && c !== 'token' && !c.startsWith('prism-t')).length > 1) out.nested += 1;
      if (span.getAttribute('style')) out.diffs.push('[' + span.className + '] có style inline');
      const probe = document.createElement('span');
      probe.setAttribute('style', styles[i]);
      probe.textContent = span.textContent;
      span.parentNode.insertBefore(probe, span);
      const got = read(span, props), want = read(probe, props);
      probe.remove();
      if (got !== want) out.diffs.push('[' + span.className + '] ' + JSON.stringify(span.textContent) + ': ' + got + ' ≠ ' + want);
    });
  });
  return out;
}"""


def inline_answer(theme: str, class_lists: list) -> dict:
    """Style chế độ inline gốc cho từng danh sách lớp (react-syntax-highlighter trong node_modules của markdown-editor)."""
    payload = json.dumps({"theme": theme, "blocks": class_lists})
    done = subprocess.run(["node", os.path.join(HERE, "mau-token-inline.cjs")], input=payload, capture_output=True,
                          text=True, encoding="utf-8", timeout=120)
    if done.returncode != 0:
        raise RuntimeError("mau-token-inline.cjs: " + done.stderr[-500:])
    return json.loads(done.stdout)


def colour_report(res: dict) -> str:
    return (f"{res['blocks']} khối, {res['tokens']} token ({res['nested']} lồng nhau), lệch {len(res['diffs'])}"
            + (": " + " | ".join(res["diffs"][:4]) if res["diffs"] else "")
            + (" | khung: " + " | ".join(res["wrapper"][:2]) if res["wrapper"] else ""))


# Mô phỏng dot/M0.md mục 6 (mở tài liệu rất lớn trên máy bận): ngay sau khi gửi yêu cầu kiểm phiên, luồng chính bận
# 9,9 s, và trả lời về lúc ~10,5 s (máy chủ cũng chậm vì máy bận). Hẹn giờ 10 s kiểu cũ đếm cả lúc bận nên huỷ yêu cầu
# ở giây thứ 10 → chỉ xem; hẹn giờ mới chỉ đếm lúc trang rảnh (~2 s) nên đợi được trả lời.
BUSY_MS = 9900
REPLY_DELAY_S = 10.5
BUSY_JS = """() => {
  const original = window.fetch;
  window.fetch = function (input, init) {
    const url = String((input && input.url) || input);
    const pending = original.apply(this, arguments);
    if (url.includes('/markdown/admin/session') && !window.__busyDone) {
      window.__busyDone = true;
      setTimeout(() => { const t = performance.now(); while (performance.now() - t < __BUSY_MS__) {} window.__busyEnd = Date.now(); }, 0);
    }
    return pending;
  };
}"""

FILL_STORAGE_JS = """() => {
  let i = 0;
  const big = 'x'.repeat(512 * 1024);
  try { for (;;) { localStorage.setItem('__junk' + i, big); i++; } } catch (e) {}
  let size = 256 * 1024;
  while (size >= 256) {
    try { localStorage.setItem('__junk' + i, 'x'.repeat(size)); i++; } catch (e) { size = Math.floor(size / 2); }
  }
  return i;
}"""

CLEAR_JUNK_JS = """() => { for (const k of Object.keys(localStorage)) if (k.startsWith('__junk')) localStorage.removeItem(k); }"""


def run_m1(browser, srv: Server, shots: str | None) -> None:
    import _tai_lieu_thu as T

    print("  · đợt M1: khung đầu, tô màu bằng class, xuất HTML, menu Sync, quota, chế độ đọc, phiên khi luồng chính bận")
    url = srv.base + APP_PATH
    ctx = browser.new_context(viewport={"width": 1280, "height": 800}, service_workers="block", accept_downloads=True)
    ctx.add_init_script(f"({SEED_JS})({json.dumps(STORED_DOC)})")
    page = ctx.new_page()
    errors: list[str] = []
    dialogs: list[tuple[str, str]] = []
    page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type == "error" and not any(n in m.text for n in EXPECTED_NOISE) else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    answer = {"accept": False}

    def on_dialog(d):
        dialogs.append((d.type, d.message))
        d.accept() if answer["accept"] else d.dismiss()

    page.on("dialog", on_dialog)

    def snap(name):
        if shots:
            page.screenshot(path=os.path.join(shots, name + ".png"))

    # --- khung hình đầu (lỗi M0 #1)
    page.goto(url, wait_until="load")
    page.wait_for_function("() => window.__first && window.__first.editor !== undefined && window.__first.preview !== undefined", timeout=20000)
    first = page.evaluate("() => window.__first")
    check("khung hình đầu: ô soạn đã là tài liệu đã lưu (không vẽ welcome.md trước)", first["editor"] == STORED_DOC, repr(first["editor"][:60]))
    check("khung hình đầu: preview đã là tài liệu đã lưu", "Tài liệu đã lưu" in first["preview"] and "Welcome to Markdown Editor" not in first["preview"], first["preview"][:60])

    # --- đăng nhập
    page.click("button.role-chip")
    page.fill("#admin-key", KEY_A)
    page.click('button:has-text("Unlock")')
    page.wait_for_selector("button.role-chip.is-admin", timeout=10000)

    # --- khối code: class + bảng màu sinh từ theme (perf-md việc 2)
    page.wait_for_selector(".preview-scroll .code-block span.token.keyword", timeout=20000)
    code = page.evaluate("""() => {
      const block = document.querySelector('.preview-scroll .code-block');
      const wrap = block.querySelector('.prismjs');
      const tokens = Array.from(block.querySelectorAll('span.token'));
      const kw = block.querySelector('span.token.keyword');
      const cm = block.querySelector('span.token.comment');
      return {
        scope: Array.from(wrap.classList).find((c) => c.startsWith('prism-')) || '',
        inline: tokens.filter((t) => /color/.test(t.getAttribute('style') || '')).length,
        tokens: tokens.length,
        kw: getComputedStyle(kw).color, base: getComputedStyle(wrap).color,
        cmStyle: cm ? getComputedStyle(cm).fontStyle : '',
        sheet: !!document.querySelector('style[data-prism]'),
      };
    }""")
    check("khối code: token là span.token có class, KHÔNG có màu inline; có <style data-prism> của theme",
          code["tokens"] > 5 and code["inline"] == 0 and code["sheet"] and code["scope"].startswith("prism-"), json.dumps(code))
    check("khối code: màu token lấy từ bảng màu (từ khoá khác màu chữ thường, chú thích in nghiêng)",
          code["kw"] != code["base"] and code["cmStyle"] == "italic", json.dumps(code))

    # --- Export HTML giữ luật màu
    page.get_by_role("button", name="File", exact=False).first.click()
    with page.expect_download(timeout=20000) as dl:
        page.get_by_role("button", name="Export HTML").click()
    html = open(dl.value.path(), encoding="utf-8").read()
    kw_rule = re.search(r'class="token keyword (prism-t\d+)"', html)
    check("Export HTML: tệp xuất có span class=\"token keyword prism-tN\" và luật màu .prism-… .prism-tN đi kèm",
          kw_rule is not None and re.search(r"\.prism-[a-z0-9_-]+ \." + kw_rule.group(1) + r"\b", html) is not None, html[:200])

    # --- màu từng token (cả token lồng nhau) == chế độ inline cũ: preview và tệp Export HTML
    page.fill(".editor-input", COLOUR_DOC)
    page.wait_for_function(f"() => document.querySelectorAll('.preview-scroll .code-block').length === {len(COLOUR_BLOCKS)} && "
                           "Array.from(document.querySelectorAll('.preview-scroll .code-block')).every((b) => b.querySelector('span.token'))",
                           timeout=30000)
    page.wait_for_timeout(500)
    scope = page.evaluate("() => Array.from(document.querySelector('.preview-scroll .prismjs').classList).find((c) => c.startsWith('prism-'))")
    colour_theme = "dark" if scope.startswith("prism-dark") else "light"
    answer_colours = inline_answer(colour_theme, page.evaluate(COLOUR_CLASSES_JS, ".preview-scroll .code-block"))
    res = page.evaluate(COLOUR_PROBE_JS, [".preview-scroll .code-block", answer_colours])
    check(f"preview: màu từng token (HTML/bash/JSX/C++/CSS/PHP) trùng y hệt chế độ inline cũ — {res['tokens']} token, {res['nested']} lồng nhau",
          res["blocks"] == len(COLOUR_BLOCKS) and res["tokens"] > 150 and res["nested"] > 40 and res["styled"] > 100 and not res["diffs"] and not res["wrapper"],
          colour_report(res))
    page.get_by_role("button", name="File", exact=False).first.click()
    with page.expect_download(timeout=20000) as dl:
        page.get_by_role("button", name="Export HTML").click()
    exported = open(dl.value.path(), encoding="utf-8").read()
    viewer = ctx.new_page()
    viewer.set_content(exported, wait_until="load")
    res = viewer.evaluate(COLOUR_PROBE_JS, [".code-block", inline_answer(colour_theme, viewer.evaluate(COLOUR_CLASSES_JS, ".code-block"))])
    viewer.close()
    check(f"Export HTML: mở tệp xuất, màu từng token vẫn trùng y hệt chế độ inline cũ — {res['tokens']} token",
          res["blocks"] == len(COLOUR_BLOCKS) and res["tokens"] > 150 and not res["diffs"] and not res["wrapper"], colour_report(res))
    page.fill(".editor-input", STORED_DOC)
    page.wait_for_timeout(300)

    # --- menu Sync: cảnh báo + Save to backend (máy chủ thật, kho json tạm)
    page.get_by_role("button", name=re.compile(r"^Sync")).click()
    page.get_by_role("button", name=re.compile(r"Backend sync")).click()   # bật đồng bộ (lệnh đóng menu)
    page.get_by_role("button", name=re.compile(r"^Sync")).click()
    note = page.get_by_role("note").inner_text()
    check("menu Sync có dòng cảnh báo 'Save to backend overwrites the whole server copy…'", "overwrites the whole server copy" in note, note)
    page.get_by_role("button", name=re.compile(r"Save to backend")).click()
    page.wait_for_selector("text=Saved files to backend", timeout=15000)
    check("Save to backend (máy chủ thật) chạy được", True)

    # --- Load from backend hỏi trước
    page.fill(".editor-input", STORED_DOC + "\nSửa cục bộ chưa lưu lên máy chủ.\n")
    page.keyboard.press("Control+s")
    answer["accept"] = False
    dialogs.clear()
    page.get_by_role("button", name=re.compile(r"^Sync")).click()
    page.get_by_role("button", name=re.compile(r"Load from backend")).click()
    page.wait_for_timeout(500)
    asked = [m for t, m in dialogs if t == "confirm"]
    check("Load from backend hỏi xác nhận trước (nói rõ thay mọi tài liệu cục bộ, sửa chưa lưu sẽ mất)",
          len(asked) == 1 and "replaces" in asked[0] and "will be lost" in asked[0], repr(dialogs))
    check("bấm Huỷ: tài liệu cục bộ giữ nguyên", "Sửa cục bộ chưa lưu" in page.input_value(".editor-input"))
    answer["accept"] = True
    page.get_by_role("button", name=re.compile(r"^Sync")).click()
    page.get_by_role("button", name=re.compile(r"Load from backend")).click()
    page.wait_for_selector("text=Loaded files from backend", timeout=15000)
    check("bấm Đồng ý: nạp bản trên máy chủ", True)
    answer["accept"] = False

    # --- localStorage đầy → banner đỏ (vá tạm §1.3)
    page.get_by_text("mine.md").first.click()
    page.wait_for_function("() => document.querySelector('.editor-input').value.includes('Tài liệu đã lưu')", timeout=10000)
    filled = page.evaluate(FILL_STORAGE_JS)
    page.fill(".editor-input", STORED_DOC + "\n" + ("Thêm nhiều chữ để vượt hạn mức. " * 300))
    page.wait_for_selector('[role="alert"].storage-banner', timeout=10000)
    banner = page.inner_text('[role="alert"].storage-banner')
    check(f"localStorage đầy ({filled} khoá rác): banner đỏ 'Browser storage is full — … not saved' hiện ra",
          "Browser storage is full" in banner and "not saved" in banner, banner)
    bg = page.evaluate("() => getComputedStyle(document.querySelector('.storage-banner')).backgroundColor")
    check("banner có nền đỏ (token --danger)", bg.replace(" ", "") in ("rgb(207,34,46)", "rgb(248,81,73)"), bg)
    snap("05-banner-quota")
    dialogs.clear()
    page.close(run_before_unload=True)
    page.wait_for_timeout(800)
    check("đang lỗi quota: rời trang thì trình duyệt hỏi trước (beforeunload), huỷ thì ở lại",
          any(t == "beforeunload" for t, _ in dialogs) and not page.is_closed(), repr(dialogs))
    page.evaluate(CLEAR_JUNK_JS)
    page.get_by_role("button", name="Try saving again").click()
    page.wait_for_selector('[role="alert"].storage-banner', state="detached", timeout=5000)
    saved = page.evaluate("() => localStorage.getItem('markdown-editor:files') || ''")
    check("dọn chỗ rồi 'Try saving again': banner tắt, bản mới đã nằm trong localStorage", "vượt hạn mức" in saved)

    # --- chế độ đọc tài liệu dài (perf-md việc 4)
    md = T.sinh("doc-2k")
    page.fill(".editor-input", md)
    page.get_by_role("button", name="Reading mode").click()
    page.wait_for_function("() => document.querySelectorAll('.reading-article h2').length > 30", timeout=60000)
    page.wait_for_timeout(1500)
    page.mouse.move(640, 450)
    for _ in range(12):
        page.mouse.wheel(0, 800)
        page.wait_for_timeout(60)
    page.wait_for_timeout(600)
    pos = page.evaluate("""() => ({
      progress: Number(document.querySelector('.reading-progress').getAttribute('aria-valuenow')),
    })""")
    # The bar steps aside while scrolling down; the pointer near the top brings it back, as for a reader.
    page.mouse.move(640, 8)
    page.wait_for_selector(".reading:not(.is-bar-hidden)", timeout=5000)
    page.wait_for_timeout(400)
    page.get_by_role("button", name="Table of contents").click()
    toc = page.evaluate("""() => {
      const items = Array.from(document.querySelectorAll('.reading-toc-item'));
      return { count: items.length, active: items.findIndex((b) => b.getAttribute('aria-current') === 'location') };
    }""")
    check("chế độ đọc: cuộn xuống thì tiến độ tăng và mục đang đọc trong mục lục chuyển xuống",
          pos["progress"] > 0 and toc["active"] > 0, json.dumps({**pos, **toc}))
    target = min(30, toc["count"] - 1)
    label = page.locator(".reading-toc-item").nth(target).inner_text()
    page.locator(".reading-toc-item").nth(target).click()
    page.wait_for_timeout(1500)
    landed = page.evaluate("""(label) => {
      const scroller = document.querySelector('.reading-scroll');
      const h = Array.from(document.querySelectorAll('.reading-article h1, .reading-article h2, .reading-article h3'))
        .find((el) => el.textContent.includes(label.trim()));  // the heading also holds its hover anchor
      return h ? Math.round(h.getBoundingClientRect().top - scroller.getBoundingClientRect().top) : null;
    }""", label)
    check(f"chế độ đọc: bấm mục lục '{label[:30]}…' → tiêu đề nằm ở đầu khung đọc", landed is not None and 0 <= landed <= 200, str(landed))
    page.keyboard.press("Escape")

    # --- phiên quản trị khi luồng chính bận (lỗi M0 #2)
    token = page.evaluate("() => localStorage.getItem('markdown-editor:admin-session')")
    page2 = ctx.new_page()
    page2.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page2.add_init_script("(" + BUSY_JS.replace("__BUSY_MS__", str(BUSY_MS)) + ")()")
    sent = {}

    def slow_session(route):
        sent["t"] = time.time()
        reply = route.fetch()
        time.sleep(max(0.0, REPLY_DELAY_S - (time.time() - sent["t"])))
        route.fulfill(response=reply)

    page2.route("**/markdown/admin/session", slow_session)
    page2.goto(url, wait_until="load")
    page2.wait_for_function("() => window.__busyEnd !== undefined", timeout=40000)
    page2.wait_for_timeout(3000)
    admin = page2.locator("button.role-chip.is-admin").count() == 1
    check(f"luồng chính bận {BUSY_MS / 1000:g} s, trả lời kiểm phiên về sau {REPLY_DELAY_S:g} s: vẫn là quản trị (hẹn giờ chỉ đếm lúc trang rảnh)",
          bool(token) and admin, f"token={'có' if token else 'không'} admin={admin}")
    page2.close()

    check("đợt M1: không lỗi console/pageerror bất ngờ", not errors, " | ".join(errors[:3]))
    ctx.close()


# ---------------------------------------------------------------------------------------------------------------------
# 10. Đợt M2 (md-render 1, 2, 3, 7: toán kiểu LLM, luật pandoc, mhchem, khối toán có data-line, chặn style nguy hiểm)
# ---------------------------------------------------------------------------------------------------------------------
# Dòng nguồn (1-based): 5 \[ … \], 9 \begin{align} trần, 14 $$x$$ một dòng, 16 "$$ x^2 +" … "y^2 = z^2 $$", 25 tiêu đề sau.
M2_DOC = r"""# Toán kiểu LLM

Năng lượng \( E = mc^2 \) và giá $5 và $10 vẫn là chữ.

\[
\int_0^1 x^2 \, dx = \frac{1}{3}
\]

\begin{align}
a &= b \\
c &= d
\end{align}

$$x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$$

$$ x^2 +
y^2 = z^2 $$

Hoá học $\ce{2H2 + O2 -> 2H2O}$, nhãn \(\eqref{eq:a}\), giữa câu \[ a^2 \] vẫn hiển thị.

<span id="sg" style="color: rgb(200, 0, 0); background-image: url(https://tracker.invalid/p.png)">kiểu chữ đỏ</span>

<div id="fx" style="position: fixed; top: 0; left: 0; width: 100%">lớp phủ giả</div>

## Sau toán
"""
M2_BLOCK_LINES = ["5", "9", "14", "16"]
M2_DISPLAY = 5   # 4 khối + \[ a^2 \] giữa câu
M2_INLINE = 3    # \( E = mc^2 \), \ce, \eqref

M2_COUNT_JS = """(root) => {
  const el = document.querySelector(root);
  if (!el) return null;
  const display = el.querySelectorAll('.katex-display').length;
  return {
    display, inline: el.querySelectorAll('.katex').length - display,
    errors: el.querySelectorAll('.katex-error').length + (el.innerHTML.includes('#cc0000') ? 1 : 0),
    blocks: Array.from(el.querySelectorAll('div.math-block')).map((b) => b.getAttribute('data-line')),
    blocksWithKatex: Array.from(el.querySelectorAll('div.math-block')).filter((b) => b.querySelector('.katex-display')).length,
    h2: (Array.from(el.querySelectorAll('h2')).find((h) => h.textContent.includes('Sau toán')) || {getAttribute: () => null}).getAttribute('data-line'),
    text: el.textContent,
    ce: Array.from(el.querySelectorAll('annotation')).some((a) => a.textContent.includes('\\\\ce{')),
  };
}"""


def run_m2(browser, srv: Server, shots: str | None) -> None:
    print("  · đợt M2: toán kiểu LLM (\\( \\), \\[ \\], align trần, $$ một dòng, mhchem, giá tiền), khối toán có data-line, chặn style")
    url = srv.base + APP_PATH
    ctx = browser.new_context(viewport={"width": 1280, "height": 800}, service_workers="block", accept_downloads=True)
    ctx.add_init_script(f"({SEED_JS})({json.dumps(M2_DOC)})")
    page = ctx.new_page()
    errors: list[str] = []
    tracker: list[str] = []
    page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type == "error" and not any(n in m.text for n in EXPECTED_NOISE) else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    ctx.on("request", lambda r: tracker.append(r.url) if "tracker.invalid" in r.url else None)

    def snap(name):
        if shots:
            page.screenshot(path=os.path.join(shots, name + ".png"))

    page.goto(url, wait_until="load")
    page.wait_for_function(f"() => document.querySelectorAll('.preview-scroll .katex-display').length >= {M2_DISPLAY}", timeout=30000)
    page.wait_for_timeout(300)
    got = page.evaluate(M2_COUNT_JS, ".preview-scroll .markdown-body")
    summary = json.dumps({k: v for k, v in (got or {}).items() if k != "text"}, ensure_ascii=False)
    check(f"preview: {M2_DISPLAY} công thức hiển thị (\\[ \\], align trần, $$x$$ một dòng, \"$$ chữ\" hai dòng, \\[ \\] giữa câu) + {M2_INLINE} nội dòng, 0 katex-error",
          bool(got) and got["display"] == M2_DISPLAY and got["inline"] == M2_INLINE and got["errors"] == 0, summary)
    check("preview: giá tiền \"$5 và $10\" vẫn là chữ (luật pandoc), \\ce (mhchem) vẽ được",
          bool(got) and "giá $5 và $10 vẫn là chữ" in got["text"] and got["ce"], summary)
    check(f"preview: mỗi khối toán là div.math-block[data-line] đúng dòng nguồn {M2_BLOCK_LINES}; tiêu đề sau toán giữ data-line 25",
          bool(got) and got["blocks"] == M2_BLOCK_LINES and got["blocksWithKatex"] == len(M2_BLOCK_LINES) and got["h2"] == "25", summary)
    snap("06-toan-llm")

    # Nhấp đúp một khối toán → con trỏ editor về đúng dòng nguồn (cần data-line trên khối; trước M2 KaTeX xoá mất).
    page.locator('.preview-scroll div.math-block[data-line="9"]').dblclick()
    page.wait_for_timeout(400)
    line = page.evaluate("() => { const t = document.querySelector('.editor-input'); return t.value.slice(0, t.selectionStart).split('\\n').length; }")
    check("nhấp đúp khối toán (align, dòng 9) → con trỏ editor nhảy tới dòng 9", line == 9, f"dòng {line}")

    style = page.evaluate("""() => {
      const span = document.getElementById('sg');
      const div = Array.from(document.querySelectorAll('.preview-scroll div')).find((d) => d.textContent === 'lớp phủ giả');
      return {
        color: span && getComputedStyle(span).color, bg: span && getComputedStyle(span).backgroundImage,
        attr: span && span.getAttribute('style'), pos: div && getComputedStyle(div).position, divAttr: div && div.getAttribute('style'),
      };
    }""")
    check("style=\"…url(…)\" trong HTML thô: bỏ khai báo url (không tải ảnh theo dõi), giữ màu chữ",
          style["color"] == "rgb(200, 0, 0)" and style["bg"] == "none" and "url" not in (style["attr"] or "") and not tracker,
          json.dumps({**style, "tracker": tracker[:2]}, ensure_ascii=False))
    check("style=\"position: fixed…\" bị bỏ (không phủ được giao diện app)", style["pos"] == "static", json.dumps(style, ensure_ascii=False))

    # Chế độ đọc dùng chung pipeline.
    page.get_by_role("button", name="Reading mode").click()
    page.wait_for_function(f"() => document.querySelectorAll('.reading-article .katex-display').length >= {M2_DISPLAY}", timeout=30000)
    rd = page.evaluate(M2_COUNT_JS, ".reading-article")
    check("chế độ đọc: cùng số công thức, khối toán có data-line, 0 katex-error",
          bool(rd) and rd["display"] == M2_DISPLAY and rd["inline"] == M2_INLINE and rd["errors"] == 0 and rd["blocks"] == M2_BLOCK_LINES,
          json.dumps({k: v for k, v in (rd or {}).items() if k != "text"}, ensure_ascii=False))
    snap("07-toan-che-do-doc")
    page.keyboard.press("Escape")
    page.wait_for_timeout(300)

    # Export HTML chép DOM đã vẽ: công thức đi theo, ảnh theo dõi thì không.
    page.get_by_role("button", name="File", exact=False).first.click()
    with page.expect_download(timeout=20000) as dl:
        page.get_by_role("button", name="Export HTML").click()
    exported = open(dl.value.path(), encoding="utf-8").read()
    n_display = exported.count('class="katex-display"')
    check("Export HTML: tệp xuất có đủ công thức (katex-display, math-block) và không có URL theo dõi",
          n_display >= M2_DISPLAY and 'class="math-block"' in exported and "tracker.invalid" not in exported, f"katex-display={n_display}")

    # welcome.md của ngữ cảnh mới (chưa lưu gì) có ví dụ toán và vẽ không lỗi.
    fresh = browser.new_context(viewport={"width": 1280, "height": 800}, service_workers="block")
    wp = fresh.new_page()
    wp.on("pageerror", lambda e: errors.append(f"pageerror (welcome): {e}"))
    wp.goto(url, wait_until="load")
    wp.wait_for_function("() => document.querySelectorAll('.preview-scroll .katex-display').length >= 2", timeout=30000)
    wc = wp.evaluate(M2_COUNT_JS, ".preview-scroll .markdown-body")
    check("welcome.md (ngữ cảnh mới): mục Math vẽ \\( \\), \\[ \\], align trần, \\ce, giá tiền là chữ — 0 katex-error",
          bool(wc) and wc["display"] == 2 and wc["inline"] == 3 and wc["errors"] == 0 and wc["ce"] and "Prices stay prices: $5 and $10." in wc["text"],
          json.dumps({k: v for k, v in (wc or {}).items() if k != "text"}, ensure_ascii=False))
    fresh.close()

    check("đợt M2: không lỗi console/pageerror bất ngờ", not errors, " | ".join(errors[:3]))
    ctx.close()


if __name__ == "__main__":
    sys.exit(main())
