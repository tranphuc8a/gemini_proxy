"""Đo trần localStorage của Edge thật (một origin http://127.0.0.1:<cổng>), và IndexedDB có giữ được 7,4 MB không.

Chạy: backend/fastapi/.venv/Scripts/python.exe do-localstorage.py   (không đụng repo, không mạng ngoài)
"""
import http.server
import socket
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).parent
(HERE / "trang.html").write_text("<!doctype html><meta charset=utf-8><title>ls</title>", encoding="utf-8")


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class Quiet(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(HERE), **k)

    def log_message(self, *a):
        pass


port = free_port()
httpd = socketserver.TCPServer(("127.0.0.1", port), Quiet)
threading.Thread(target=httpd.serve_forever, daemon=True).start()

JS_LS = """() => {
  // tìm nhị phân số ký tự lớn nhất ghi được vào MỘT khoá (khoá 'k')
  localStorage.clear()
  let lo = 0, hi = 20_000_000
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2)
    try { localStorage.setItem('k', 'a'.repeat(mid)); lo = mid } catch (e) { hi = mid - 1 }
    localStorage.removeItem('k')
  }
  // ký tự tiếng Việt (ngoài ASCII) có bị tính khác không?
  let lo2 = 0, hi2 = 20_000_000
  while (lo2 < hi2) {
    const mid = Math.floor((lo2 + hi2 + 1) / 2)
    try { localStorage.setItem('k', 'ệ'.repeat(mid)); lo2 = mid } catch (e) { hi2 = mid - 1 }
    localStorage.removeItem('k')
  }
  return { ascii: lo, vietnamese: lo2 }
}"""

JS_IDB = """async () => {
  const big = 'ệ'.repeat(3_700_000) + 'a'.repeat(3_700_000)
  const db = await new Promise((res, rej) => { const r = indexedDB.open('t', 1); r.onupgradeneeded = () => r.result.createObjectStore('s'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
  const t0 = performance.now()
  await new Promise((res, rej) => { const tx = db.transaction('s', 'readwrite'); tx.objectStore('s').put(big, 'x'); tx.oncomplete = res; tx.onerror = () => rej(tx.error) })
  const back = await new Promise((res, rej) => { const tx = db.transaction('s'); const g = tx.objectStore('s').get('x'); g.onsuccess = () => res(g.result); g.onerror = () => rej(g.error) })
  const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null
  return { ok: back.length === big.length, chars: big.length, ms: Math.round(performance.now() - t0), quotaMB: est ? Math.round(est.quota / 1048576) : null }
}"""

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    page = browser.new_page()
    page.goto(f"http://127.0.0.1:{port}/trang.html")
    print("Edge", browser.version)
    print("localStorage, một khoá:", page.evaluate(JS_LS))
    print("IndexedDB 7,4 triệu ký tự:", page.evaluate(JS_IDB))
    browser.close()
httpd.shutdown()
