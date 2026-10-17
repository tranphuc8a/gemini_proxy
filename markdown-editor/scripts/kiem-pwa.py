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

AN TOÀN: máy chủ chạy với DB_URL trỏ SQLite trong thư mục tạm và MONGO_URI rỗng (ghi đè .env); khoá quản trị trong
phép kiểm là chuỗi giả của chính script này, không phải khoá thật.
Trả exit code khác 0 nếu có phép kiểm sai.
"""
from __future__ import annotations

import json
import os
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


if __name__ == "__main__":
    sys.exit(main())
