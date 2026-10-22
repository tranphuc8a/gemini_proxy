# -*- coding: utf-8 -*-
"""do-trinh-duyet.py — do hieu nang json-editor trong Edge that voi JSON 1 MB / 10 MB.
Chi doc tep app; phuc vu thu muc app bang http.server tren cong trong.
"""
import http.server, socketserver, threading, os, sys, json, functools

APP = r"C:/Users/tranphuc8a/Desktop/gemini_proxy/backend/fastapi/webapp/tranphuc8a/json-editor"
HERE = os.path.dirname(os.path.abspath(__file__))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

class Im(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

class MC(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = True

sv = MC(("127.0.0.1", 0), functools.partial(Im, directory=APP))
port = sv.server_address[1]
threading.Thread(target=sv.serve_forever, daemon=True).start()

JS_NAP = r"""
async (s) => {
  const nhap = document.querySelector('#nhap');
  const raf = () => new Promise(r => requestAnimationFrame(() => r()));
  const t0 = performance.now();
  nhap.value = s;
  nhap.dispatchEvent(new Event('input'));
  const tDongBo = performance.now() - t0;
  await raf(); await raf();
  const tVe = performance.now() - t0;
  // cho doc() (debounce 180ms) xong
  const t1 = performance.now();
  while (!/den (ok|loi)/.test(document.querySelector('#den').className) && performance.now() - t1 < 20000) {
    await new Promise(r => setTimeout(r, 20));
  }
  const tDoc = performance.now() - t0;
  let luu = -1;
  try { luu = (localStorage.getItem('json-editor:nhap') || '').length; } catch (e) { luu = -2; }
  return { tDongBo, tVe, tDoc, trangThai: document.querySelector('#trang-thai').textContent,
           luu, dai: s.length, mau: document.querySelector('#vung-soan').classList.contains('co-mau') };
}
"""

JS_GO = r"""
async (lan) => {
  const nhap = document.querySelector('#nhap');
  const raf = () => new Promise(r => requestAnimationFrame(() => r()));
  nhap.focus();
  const giua = Math.floor(nhap.value.length / 2);
  nhap.setSelectionRange(giua, giua);
  const ds = [];
  for (let i = 0; i < lan; i++) {
    const t0 = performance.now();
    document.execCommand('insertText', false, ' ');
    await raf();
    ds.push(performance.now() - t0);
  }
  ds.sort((a, b) => a - b);
  return { trungVi: ds[Math.floor(ds.length / 2)], max: ds[ds.length - 1], p90: ds[Math.floor(ds.length * 0.9)] };
}
"""

JS_TAB = r"""
async (ten) => {
  const raf = () => new Promise(r => requestAnimationFrame(() => r()));
  const t0 = performance.now();
  document.querySelector('.tab-n[data-o="' + ten + '"]').click();
  await raf(); await raf();
  return { ms: performance.now() - t0, nut: document.querySelectorAll('#cay .n').length,
           dom: document.getElementsByTagName('*').length };
}
"""

JS_BAM = r"""
async (sel) => {
  const raf = () => new Promise(r => requestAnimationFrame(() => r()));
  const t0 = performance.now();
  document.querySelector(sel).click();
  await raf(); await raf();
  return { ms: performance.now() - t0, nut: document.querySelectorAll('#cay .n').length,
           dom: document.getElementsByTagName('*').length };
}
"""

JS_SUA_CAY = r"""
async () => {
  // sua mot gia tri la tren cay: mo o sua o nut la dau tien co .gt roi Enter
  const raf = () => new Promise(r => requestAnimationFrame(() => r()));
  const gt = document.querySelector('#cay .n .n .gt') || document.querySelector('#cay .gt');
  if (!gt) return { ms: -1 };
  gt.click();
  await raf();
  const o = document.querySelector('#cay .o-nhap');
  if (!o) return { ms: -2 };
  o.value = o.value + '1';
  const t0 = performance.now();
  o.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await raf(); await raf();
  return { ms: performance.now() - t0 };
}
"""

from playwright.sync_api import sync_playwright

kq = {}
with sync_playwright() as pw:
    try:
        tb = pw.chromium.launch(channel="msedge")
        kenh = "msedge"
    except Exception as e:
        tb = pw.chromium.launch()
        kenh = "chromium"
    print("Trinh duyet:", kenh, tb.version)
    for nhan in ["1MB", "10MB"]:
        s = open(os.path.join(HERE, "mau-%s.json" % nhan), encoding="utf-8").read()
        trang = tb.new_page(viewport={"width": 1440, "height": 900})
        loi = []
        trang.on("pageerror", lambda e: loi.append(str(e)))
        trang.goto("http://127.0.0.1:%d/index.html" % port, wait_until="load")
        trang.evaluate("() => { try { localStorage.clear(); } catch(e){} }")
        trang.reload(wait_until="load")
        r = {}
        r["nap"] = trang.evaluate(JS_NAP, s)
        r["go"] = trang.evaluate(JS_GO, 15)
        r["tab_cay"] = trang.evaluate(JS_TAB, "cay")
        r["sua_cay"] = trang.evaluate(JS_SUA_CAY)
        if nhan == "1MB":
            r["mo_het"] = trang.evaluate(JS_BAM, "#cay-mo")
            r["dong_het"] = trang.evaluate(JS_BAM, "#cay-dong")
        r["tab_thongke"] = trang.evaluate(JS_TAB, "thongke")
        r["tab_soan"] = trang.evaluate(JS_TAB, "soan")
        r["dinh_dang"] = trang.evaluate(JS_BAM, "#nut-dinh-dang")
        r["loi_trang"] = loi[:3]
        kq[nhan] = r
        print("\n===", nhan, "===")
        print(json.dumps(r, ensure_ascii=False, indent=1))
        trang.close()
    tb.close()

sv.shutdown(); sv.server_close()
open(os.path.join(HERE, "do-trinh-duyet.out.json"), "w", encoding="utf-8").write(json.dumps(kq, ensure_ascii=False, indent=1))
