#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""Kiểm toán trong gemini-chat bằng Edge thật (Playwright, channel="msedge") — đợt M2b, ke-hoach §1.5.

Phục vụ BẢN XUẤT BẢN `backend/fastapi/webapp/tranphuc8a/gemini-chat/` bằng một máy chủ nhỏ trên cổng trống: chèn
`window.__WEBAPP_CONFIG__` vào index.html như webapp_controller, và giả API `/api/*` (hội thoại, tin nhắn, `/ai/*`,
`/gemini/stream` trả SSE từng mẩu, có một khoảng dừng ngay lúc `\[` đang mở). Không gọi Gemini thật, không đụng
database, không cần backend.

Các phép:
  1. câu trả lời cũ kiểu ChatGPT (`\( \)`, `\[ \]`, align trần, giá `$49`, `\ce`, `\eqref`) hiện đúng số công thức,
     0 lỗi KaTeX, giá tiền vẫn là chữ;
  2. đang stream, `\[` chưa đóng: vẫn là chữ, không nuốt phần trước, 0 lỗi; xong stream: thành khối display;
  3. `$$x$$` một dòng (kiểu Gemini) thành khối; 0 lỗi trang (pageerror).

  backend/fastapi/.venv/Scripts/python.exe frontend/scripts/kiem-toan-edge.py [--anh <thư-mục>] [--hien]

Exit 0 khi mọi phép đạt, 1 nếu có phép sai. Build trước: node scripts/build-webapps.mjs --only frontend
"""
import json
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP_DIR = ROOT / "backend" / "fastapi" / "webapp" / "tranphuc8a" / "gemini-chat"
APP_URL = "/webapp/tranphuc8a/gemini-chat/"
CONFIG = {"apiBase": "/api", "webappBase": "/webapp"}

# Câu trả lời cũ trong hội thoại (giống STREAM_ANSWERS[0] của mathVectors.ts): 3 display, 6 inline.
CU = "\n".join([
    r"Nghiệm của phương trình \( ax^2 + bx + c = 0 \) là:",
    "",
    r"\[",
    r"x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}",
    r"\]",
    "",
    r"Với biệt thức \( \Delta = b^2 - 4ac \):",
    "",
    r"1. Nếu \( \Delta > 0 \), có hai nghiệm phân biệt.",
    r"2. Nếu \( \Delta = 0 \), có nghiệm kép \[ x = -\frac{b}{2a} \]",
    "",
    "Khóa học giá $49 và sách $15, tổng $64.",
    "",
    r"\begin{align}",
    r"f(x) &= x^2 + 2x \\",
    r"&= (x+1)^2 - 1",
    r"\end{align}",
    "",
    r"Phản ứng \(\ce{2H2 + O2 -> 2H2O}\), xem \(\eqref{eq:1}\).",
])

# Lần gửi 1: dừng DUNG giây sau mẩu thứ hai, lúc `\[` đang mở.
DUNG = 2.5
STREAM_1 = [
    r"Ta có \( a = 2 \).",
    "\n\n" + r"\[" + "\n" + r"x = \frac{-b",
    r" \pm \sqrt{b^2-4ac}}{2a}" + "\n" + r"\]" + "\n\n" + r"Giá $5 và $10. Phản ứng \(\ce{H2O}\).",
]
# Lần gửi 2: kiểu Gemini, `$$x$$` một mình trên dòng.
STREAM_2 = ["Phương trình:\n\n", r"$$E = mc^2$$", "\n\nvới $c$ là tốc độ ánh sáng."]


def envelope(data):
    return {"status_code": 200, "message": "OK", "data": data}


NOW = int(time.time())
CONV = {"id": "c1", "name": "Toán M2b", "created_at": NOW - 3600, "updated_at": NOW - 60, "messages_count": 2}
MESSAGES = [  # mới nhất trước (order=desc), app tự đảo lại
    {"id": "m2", "conversation_id": "c1", "role": "model", "created_at": NOW - 60, "content": CU},
    {"id": "m1", "conversation_id": "c1", "role": "user", "created_at": NOW - 70, "content": "Giải phương trình bậc hai?"},
]
AI_STATUS = {"enabled": True, "access": "public", "allowed": True, "needs": None, "admin": False,
             "model": "gemini-gia", "limits": {"perMinute": 30, "perDay": 300}}
AI_MODELS = {"default": "gemini-gia", "source": "kiem", "admin": False, "models": [
    {"id": "gemini-gia", "label": "Gemini giả", "tier": "flash", "preview": False, "alias": False,
     "adminOnly": False, "default": True, "allowed": True}]}


class MayChu(BaseHTTPRequestHandler):
    so_lan_gui = 0
    khoa = threading.Lock()

    def log_message(self, *_):
        pass

    def _json(self, body, status=200):
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _khong_co(self):
        self._json({"status_code": 404, "message": "Không có", "data": {"code": "not_found"}}, 404)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path.startswith("/api/"):
            api = path[len("/api"):]
            if api == "/ai/status":
                return self._json(AI_STATUS)
            if api == "/ai/models":
                return self._json(AI_MODELS)
            if api == "/conversations":
                return self._json(envelope({"data": [CONV], "first_id": "c1", "last_id": "c1", "has_more": False}))
            if api == "/conversations/c1":
                return self._json(envelope(CONV))
            if api == "/conversations/c1/messages":
                return self._json(envelope({"data": MESSAGES, "first_id": "m2", "last_id": "m1", "has_more": False}))
            if api == "/conversations/c1/messages/recent":
                return self._json(envelope(list(reversed(MESSAGES))))
            return self._khong_co()
        if not path.startswith(APP_URL):
            return self._khong_co()
        rel = path[len(APP_URL):] or "index.html"
        file = (APP_DIR / rel).resolve()
        if APP_DIR.resolve() not in file.parents or not file.is_file():
            return self._khong_co()
        data = file.read_bytes()
        if rel == "index.html":
            tag = "<script>window.__WEBAPP_CONFIG__=Object.freeze(%s);</script>" % json.dumps(CONFIG)
            html = data.decode("utf-8")
            head = html.lower().find("<head")
            close = html.find(">", head) + 1
            data = (html[:close] + tag + html[close:]).encode("utf-8")
        types = {".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
                 ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
                 ".json": "application/json"}
        self.send_response(200)
        self.send_header("Content-Type", types.get(file.suffix, "application/octet-stream"))
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        length = int(self.headers.get("Content-Length") or 0)
        self.rfile.read(length)
        if path != "/api/gemini/stream":
            return self._khong_co()
        with MayChu.khoa:
            MayChu.so_lan_gui += 1
            lan = MayChu.so_lan_gui
        manh = STREAM_1 if lan == 1 else STREAM_2
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        for i, part in enumerate(manh):
            self.wfile.write(("data: %s\n\n" % json.dumps(part, ensure_ascii=False)).encode("utf-8"))
            self.wfile.flush()
            time.sleep(DUNG if (lan == 1 and i == 1) else 0.15)
        self.wfile.write(('event: done\ndata: {"message_id": "s%d"}\n\n' % lan).encode("utf-8"))
        self.wfile.flush()


DEM_JS = r"""(el) => {
  const display = el.querySelectorAll('.katex-display').length;
  const copy = el.cloneNode(true);
  copy.querySelectorAll('.katex').forEach((n) => n.replaceWith(document.createTextNode('«' + (n.querySelector('annotation')?.textContent ?? '?') + '»')));
  return {
    display,
    inline: el.querySelectorAll('.katex').length - display,
    errors: el.querySelectorAll('.katex-error').length + (el.innerHTML.includes('#cc0000') ? 1 : 0),
    text: copy.textContent,
  };
}"""

CUOI = ".chat-message-assistant .markdown-body >> nth=-1"


def main():
    args = sys.argv[1:]
    anh = None
    if "--anh" in args:
        anh = Path(args[args.index("--anh") + 1])
        anh.mkdir(parents=True, exist_ok=True)
    hien = "--hien" in args
    if not (APP_DIR / "index.html").is_file():
        print("Chưa có bản xuất bản. Chạy: node scripts/build-webapps.mjs --only frontend")
        return 1

    from playwright.sync_api import sync_playwright

    server = ThreadingHTTPServer(("127.0.0.1", 0), MayChu)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = "http://127.0.0.1:%d" % server.server_address[1]

    ket_qua = []

    def ghi(ten, dat, chi_tiet=""):
        ket_qua.append(dat)
        print(("ĐẠT  " if dat else "SAI  ") + ten + ((" — " + chi_tiet) if chi_tiet else ""))

    loi_trang = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel="msedge", headless=not hien)
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page.on("pageerror", lambda e: loi_trang.append(str(e)))
            page.goto(base + APP_URL, wait_until="domcontentloaded")
            page.get_by_text("Toán M2b").first.click()
            page.wait_for_selector(".chat-message-assistant .katex", timeout=30000)

            # 1. Câu trả lời cũ kiểu ChatGPT.
            c = page.locator(CUOI).evaluate(DEM_JS)
            ghi("tin cũ kiểu ChatGPT: 3 display, 6 inline, 0 lỗi KaTeX",
                (c["display"], c["inline"], c["errors"]) == (3, 6, 0), json.dumps({k: c[k] for k in ("display", "inline", "errors")}))
            ghi("giá tiền vẫn là chữ ($49, $15, $64)", "giá $49 và sách $15, tổng $64." in c["text"])
            ghi("không còn \\( hay \\[ trần trên màn hình", "\\(" not in c["text"] and "\\[" not in c["text"])
            hien_thi = page.locator(CUOI).evaluate(
                "(el) => Array.from(el.querySelectorAll('.katex-html')).map((n) => n.textContent)")
            ghi("macro \\eqref hiện thành (eq:1), mhchem \\ce vẽ ra H₂O (không lỗi)",
                "(eq:1)" in hien_thi[-1] and any("H2O" in s.replace("​", "") or "2H" in s for s in hien_thi),
                json.dumps(hien_thi[-2:], ensure_ascii=False))
            if anh:
                page.screenshot(path=str(anh / "1-tin-cu.png"), full_page=True)

            # 2. Gửi câu hỏi; máy chủ dừng lúc `\[` đang mở.
            # antd's autosize keeps a hidden measuring <textarea> beside the real one.
            box = page.locator('textarea:not([aria-hidden="true"])').last
            box.fill("Cho a = 2, tính x?")
            box.press("Enter")
            page.wait_for_function(
                "() => { const all = document.querySelectorAll('.chat-message-assistant .markdown-body');"
                " const el = all[all.length - 1]; return el && el.textContent.includes('frac{-b'); }",
                timeout=15000)
            t0 = time.time()
            giua = page.locator(CUOI).evaluate(DEM_JS)
            ghi("đang stream, \\[ chưa đóng: vẫn là chữ (0 display), công thức trước còn nguyên (1 inline), 0 lỗi",
                (giua["display"], giua["inline"], giua["errors"]) == (0, 1, 0) and "x = \\frac{-b" in giua["text"],
                json.dumps(giua, ensure_ascii=False))
            ghi("ảnh chụp giữa stream lấy trong khoảng dừng của máy chủ", time.time() - t0 < DUNG, "%.2f s" % (time.time() - t0))
            if anh:
                page.locator(CUOI).scroll_into_view_if_needed()
                page.screenshot(path=str(anh / "2-giua-stream.png"), full_page=True)
            page.wait_for_function(
                "() => { const all = document.querySelectorAll('.chat-message-assistant .markdown-body');"
                " const el = all[all.length - 1]; return el && el.textContent.includes('Phản ứng') && el.querySelector('.katex-display'); }",
                timeout=15000)
            page.wait_for_timeout(300)
            xong = page.locator(CUOI).evaluate(DEM_JS)
            ghi("xong stream: \\[ \\] thành 1 display, 2 inline (gồm \\ce), 0 lỗi, giá $5 và $10 là chữ",
                (xong["display"], xong["inline"], xong["errors"]) == (1, 2, 0) and "Giá $5 và $10." in xong["text"],
                json.dumps(xong, ensure_ascii=False))

            # 3. Kiểu Gemini: $$x$$ một dòng.
            box.fill("Công thức năng lượng?")
            box.press("Enter")
            page.wait_for_function(
                "() => { const all = document.querySelectorAll('.chat-message-assistant .markdown-body');"
                " const el = all[all.length - 1]; return el && el.textContent.includes('tốc độ ánh sáng'); }",
                timeout=15000)
            page.wait_for_timeout(300)
            g = page.locator(CUOI).evaluate(DEM_JS)
            ghi("$$x$$ một dòng (Gemini) thành khối: 1 display, 1 inline, 0 lỗi",
                (g["display"], g["inline"], g["errors"]) == (1, 1, 0), json.dumps(g, ensure_ascii=False))
            if anh:
                page.locator(CUOI).scroll_into_view_if_needed()
                page.screenshot(path=str(anh / "3-xong.png"), full_page=True)
            ghi("không có lỗi trang (pageerror)", not loi_trang, "; ".join(loi_trang)[:300])
            browser.close()
    finally:
        server.shutdown()

    dat = sum(1 for x in ket_qua if x)
    print("\nĐạt %d · SAI %d" % (dat, len(ket_qua) - dat))
    return 0 if ket_qua and all(ket_qua) else 1


if __name__ == "__main__":
    os.environ.setdefault("PYTHONUTF8", "1")
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    sys.exit(main())
