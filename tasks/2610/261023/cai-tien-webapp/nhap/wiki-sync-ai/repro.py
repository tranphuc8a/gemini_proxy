# -*- coding: utf-8 -*-
"""Tái hiện lỗi đồng bộ Personal Wiki trên backend thật (uvicorn, SQLite tạm, kho JSON tạm, cổng trống).

Không chạm database thật: DB_URL -> SQLite tạm, MONGO_URI rỗng, GEMINI_URL trỏ cổng chết.
Chạy:  PYTHONUTF8=1 backend/fastapi/.venv/Scripts/python.exe <tệp này>
"""
import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

REPO = r"C:\Users\tranphuc8a\Desktop\gemini_proxy"
FASTAPI = os.path.join(REPO, "backend", "fastapi")
PY = os.path.join(FASTAPI, ".venv", "Scripts", "python.exe")
SCRATCH = os.path.dirname(os.path.abspath(__file__))
PATH = "/webapp/tranphuc8a/personal-wiki/"
RESULTS = []


def log(ok, msg, detail=""):
    RESULTS.append((ok, msg, detail))
    print(("  [OK]  " if ok else "  [!!]  ") + msg + (("  -> " + str(detail)) if detail != "" else ""), flush=True)


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


class Server:
    def __init__(self, api_prefix, name):
        self.api_prefix = api_prefix
        self.name = name

    def __enter__(self):
        self.tmp = tempfile.mkdtemp(prefix="wiki-repro-", dir=SCRATCH)
        self.port = free_port()
        env = dict(os.environ)
        env.update({
            "DB_URL": "sqlite+aiosqlite:///" + os.path.join(self.tmp, "db.sqlite3").replace("\\", "/"),
            "TESTING": "false",
            "API_PREFIX": self.api_prefix,
            "MONGO_URI": "",
            "GEMINI_URL": "http://127.0.0.1:9",
            "GEMINI_API_KEY": "kiem-thu",
            "AI_ACCESS": "admin",
            "AI_ACCESS_CODE": "",
            "WIKI_STORAGE_BACKEND": "json",
            "WIKI_JSON_FILE": os.path.join(self.tmp, "wiki.json"),
            "DATA_DIR": self.tmp,
            "PYTHONIOENCODING": "utf-8",
        })
        self.log = open(os.path.join(self.tmp, "uvicorn.log"), "w", encoding="utf-8")
        self.proc = subprocess.Popen([PY, "-m", "uvicorn", "src.main:app", "--host", "127.0.0.1", "--port", str(self.port)],
                                     cwd=FASTAPI, env=env, stdout=self.log, stderr=subprocess.STDOUT)
        self.base = "http://127.0.0.1:%d" % self.port
        deadline = time.time() + 60
        while time.time() < deadline:
            try:
                with urllib.request.urlopen(self.base + "/health/", timeout=2) as r:
                    if r.status == 200:
                        return self
            except Exception:
                time.sleep(0.4)
        raise RuntimeError("uvicorn không lên")

    def __exit__(self, *a):
        self.proc.terminate()
        try:
            self.proc.wait(10)
        except Exception:
            self.proc.kill()
        self.log.close()


def get(url):
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def config_of(html):
    m = re.search(r"window\.__WEBAPP_CONFIG__=Object\.freeze\((\{.*?\})\);", html)
    return json.loads(m.group(1)) if m else None


def settings_text(pg):
    pg.evaluate("location.hash = '#/settings'")
    pg.wait_for_selector(".settings")
    pg.wait_for_timeout(1200)
    return pg.locator(".settings section.set:has(h2:has-text('Đồng bộ'))").inner_text()


def new_note(pg, title, body):
    pg.click("#newBtn" if pg.is_visible("#newBtn") else "#topNew")
    pg.wait_for_selector(".ed-title")
    pg.fill(".ed-title", title)
    pg.fill(".ed-ta", body)
    pg.focus(".ed-ta")
    pg.keyboard.press("Control+s")
    pg.wait_for_selector(".toast:has-text('Đã lưu')", timeout=5000)
    pg.wait_for_timeout(300)


SYNC_IDLE = "(() => { const s = Wiki.sync.instance && Wiki.sync.instance.state(); return !!s && s.configured && s.phase === 'idle' && s.pending === 0 && s.last > 0; })()"


def open_page(br, url, patch_sync=False, sw="block"):
    ctx = br.new_context(service_workers=sw, viewport={"width": 1280, "height": 820})
    if patch_sync:
        # Mô phỏng bản sửa phía client: "có máy chủ" = có cấu hình được chèn, không phải apiBase khác rỗng.
        def handle(route):
            resp = route.fetch()
            body = resp.text().replace("available: !!apiBase", "available: true")
            route.fulfill(response=resp, body=body)
        ctx.route(re.compile(r".*/assets/js/data/sync\.js.*"), handle)
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    reqs = []
    pg.on("request", lambda r: reqs.append(r.method + " " + r.url) if "/wiki" in r.url and "/webapp/" not in r.url else None)
    pg.goto(url, wait_until="load")
    pg.wait_for_function("document.body.classList.contains('ready')", timeout=15000)
    return ctx, pg, errs, reqs


def main():
    from playwright.sync_api import sync_playwright

    print("=== Kịch bản 1: API_PREFIX rỗng (đúng như backend/fastapi/.env dòng 15) ===")
    with Server("", "rong") as s:
        st, html = get(s.base + PATH)
        cfg = config_of(html)
        log(st == 200 and cfg is not None, "GET " + PATH + " có chèn __WEBAPP_CONFIG__", cfg)
        log(cfg is not None and cfg.get("apiBase") == "", "apiBase được chèn là chuỗi RỖNG", cfg and repr(cfg.get("apiBase")))
        st2, html2 = get(s.base + PATH + "index.html?source=pwa")
        log(config_of(html2) is None, "GET " + PATH + "index.html?source=pwa (start_url của PWA) KHÔNG có __WEBAPP_CONFIG__", "status %d" % st2)
        log(get(s.base + "/wiki/backends")[0] == 200, "router /wiki gắn ở gốc: GET /wiki/backends -> 200")
        log(get(s.base + "/api/v1/wiki/backends")[0] == 404, "GET /api/v1/wiki/backends -> 404 (không có tiền tố)")

        with sync_playwright() as pw:
            br = pw.chromium.launch(channel="msedge", headless=True)
            ctx, pg, errs, reqs = open_page(br, s.base + PATH)
            avail = pg.evaluate("Wiki.sync.instance.state().available")
            txt = settings_text(pg)
            pg.screenshot(path=os.path.join(SCRATCH, "kb1-settings-api-prefix-rong.png"), full_page=False)
            log(avail is False, "Edge, mở qua máy chủ: Wiki.sync.instance.state().available", avail)
            log("Cần mở app qua máy chủ" in txt, "Cài đặt → Đồng bộ hiện câu 'Cần mở app qua máy chủ…' dù ĐANG mở qua máy chủ", txt.replace("\n", " | ")[:160])
            log(not any("/wiki/backends" in r for r in reqs), "không có request nào tới /wiki/* (panel không hề hỏi máy chủ)", reqs)
            ctx.close()

            print("--- 1b: cùng máy chủ, vá client (available = có cấu hình) -> luồng người dùng đầy đủ ---")
            ctxA, A, errA, reqA = open_page(br, s.base + PATH, patch_sync=True)
            ctxB, B, errB, reqB = open_page(br, s.base + PATH, patch_sync=True)
            new_note(A, "Repro một", "nối tới [[Repro hai]] zebrakiwi")
            new_note(A, "Repro hai", "nội dung hai")
            settings_text(A)
            A.click("button:has-text('Tạo kho đồng bộ mới')")
            A.click(".dlg .btn-primary")
            A.wait_for_selector(".code-in", timeout=10000)
            code = A.input_value(".code-in")
            log(re.match(r"^default\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$", code) is not None, "A tạo kho, nhận mã nối", code[:14] + "…")
            A.click(".dlg [data-close]")
            A.wait_for_function(SYNC_IDLE, timeout=20000)
            settings_text(B)
            B.click("button:has-text('Nối vào kho có sẵn')")
            B.fill("#ff-code", code)
            B.click(".dlg button[type=submit]")
            B.wait_for_function(SYNC_IDLE, timeout=20000)
            B.evaluate("location.hash = '#/notes'")
            B.wait_for_selector(".nrow")
            B.wait_for_timeout(400)
            n = B.locator(".nrow").count()
            log(n == 2, "B nối bằng mã: kéo về đủ 2 note", n)
            log(all("/wiki/" in r and "/api/v1" not in r for r in reqA + reqB) and len(reqA) > 0, "request đồng bộ đi tới /wiki/* ở gốc (đúng với API_PREFIX rỗng)", (reqA + reqB)[:3])
            log(not errA and not errB, "không có pageerror", errA + errB)
            ctxA.close(); ctxB.close()
            br.close()

    print("=== Kịch bản 2: API_PREFIX=/api/v1 (giống check.py) nhưng mở bằng start_url của PWA (index.html?source=pwa) ===")
    with Server("/api/v1", "v1") as s:
        with sync_playwright() as pw:
            br = pw.chromium.launch(channel="msedge", headless=True)
            ctx, pg, errs, reqs = open_page(br, s.base + PATH)
            log(pg.evaluate("Wiki.sync.instance.state().available") is True, "mở " + PATH + ": available = true (đường mà check.py đi)")
            ctx.close()
            ctx, pg, errs, reqs = open_page(br, s.base + PATH + "index.html?source=pwa")
            avail = pg.evaluate("Wiki.sync.instance.state().available")
            has_cfg = pg.evaluate("typeof window.__WEBAPP_CONFIG__")
            txt = settings_text(pg)
            pg.screenshot(path=os.path.join(SCRATCH, "kb2-settings-start-url-pwa.png"), full_page=False)
            log(avail is False and has_cfg == "undefined", "mở index.html?source=pwa: không có cấu hình, available = false", (has_cfg, avail))
            log("Cần mở app qua máy chủ" in txt, "PWA đã cài luôn thấy 'Cần mở app qua máy chủ…'", txt.replace("\n", " | ")[:120])
            ctx.close()

            print("--- 2b: service worker: cài từ trang /, rồi mở start_url -> SW (mạng trước) vẫn nhận index.html không cấu hình ---")
            ctx, pg, errs, reqs = open_page(br, s.base + PATH, sw="allow")
            pg.wait_for_function("navigator.serviceWorker && navigator.serviceWorker.controller !== null", timeout=20000)
            cached = pg.evaluate("""async () => { const ks = await caches.keys(); const c = await caches.open(ks.find(k => k.startsWith('wiki:')));
                const r = await c.match(location.origin + '%sindex.html'); return r ? (await r.text()).includes('__WEBAPP_CONFIG__') : null; }""" % PATH)
            log(cached is False, "bản index.html SW lưu lúc cài (TRANG) KHÔNG có __WEBAPP_CONFIG__ (dùng khi offline)", cached)
            pg.goto(s.base + PATH + "index.html?source=pwa", wait_until="load")
            pg.wait_for_function("document.body.classList.contains('ready')", timeout=15000)
            log(pg.evaluate("typeof window.__WEBAPP_CONFIG__") == "undefined", "qua SW, start_url vẫn không có cấu hình")
            ctx.close()
            br.close()

    bad = [r for r in RESULTS if not r[0]]
    print("\n%d dòng, %d dòng 'không như kỳ vọng'" % (len(RESULTS), len(bad)))


if __name__ == "__main__":
    main()
