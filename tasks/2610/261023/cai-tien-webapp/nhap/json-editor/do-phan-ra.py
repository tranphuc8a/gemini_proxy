# -*- coding: utf-8 -*-
"""do-phan-ra.py — tach chi phi go phim / nap van ban lon trong json-editor (Edge that)."""
import http.server, socketserver, threading, os, sys, json, functools

APP = r"C:/Users/tranphuc8a/Desktop/gemini_proxy/backend/fastapi/webapp/tranphuc8a/json-editor"
HERE = os.path.dirname(os.path.abspath(__file__))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

class Im(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
class MC(socketserver.ThreadingTCPServer):
    daemon_threads = True; allow_reuse_address = True
sv = MC(("127.0.0.1", 0), functools.partial(Im, directory=APP))
port = sv.server_address[1]
threading.Thread(target=sv.serve_forever, daemon=True).start()

JS = r"""
async (s) => {
  const raf = () => new Promise(r => requestAnimationFrame(() => r()));
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const out = {};
  async function goTrong(ta, lan) {
    ta.focus();
    const g = Math.floor(ta.value.length / 2); ta.setSelectionRange(g, g);
    const ds = [];
    for (let i = 0; i < lan; i++) {
      const t0 = performance.now();
      document.execCommand('insertText', false, ' ');
      await raf();
      ds.push(performance.now() - t0);
      await sleep(250); // de debounce 180ms chay XONG ngoai vung do
    }
    ds.sort((a, b) => a - b);
    return +ds[Math.floor(ds.length / 2)].toFixed(1);
  }
  // (a) textarea tran, khong listener
  const ta = document.createElement('textarea');
  ta.style.cssText = 'position:fixed;left:0;top:0;width:600px;height:400px;white-space:pre;font:13px monospace';
  document.body.appendChild(ta);
  let t0 = performance.now(); ta.value = s; await raf(); out.a_nap_textarea_tran = +(performance.now() - t0).toFixed(1);
  out.a_go_textarea_tran = await goTrong(ta, 7);
  // (a2) textarea tran, wrap mem (mac dinh)
  ta.style.whiteSpace = 'pre-wrap';
  await raf();
  out.a2_go_textarea_wrap = await goTrong(ta, 7);
  ta.remove();
  // (b) localStorage.setItem
  t0 = performance.now();
  try { localStorage.setItem('do-thu', s); out.b_localStorage_ms = +(performance.now() - t0).toFixed(1); }
  catch (e) { out.b_localStorage_ms = 'NEM LOI: ' + e.name; }
  try { localStorage.removeItem('do-thu'); } catch (e) {}
  // (c) app: nap
  const nhap = document.querySelector('#nhap');
  t0 = performance.now(); nhap.value = s; out.c_gan_value = +(performance.now() - t0).toFixed(1);
  t0 = performance.now(); nhap.dispatchEvent(new Event('input')); out.c_su_kien_input_dong_bo = +(performance.now() - t0).toFixed(1);
  await raf(); await raf();
  out.c_so_the_so_dong = document.querySelectorAll('#so-dong div').length;
  await sleep(1500);
  out.c_go_app = await goTrong(nhap, 7);
  // (d) an cot so dong
  document.querySelector('#so-dong').style.display = 'none';
  await raf();
  out.d_go_app_khong_so_dong = await goTrong(nhap, 7);
  document.querySelector('#so-dong').style.display = '';
  // white-space cua #nhap
  out.e_white_space_nhap = getComputedStyle(nhap).whiteSpace;
  return out;
}
"""

from playwright.sync_api import sync_playwright
with sync_playwright() as pw:
    try:
        tb = pw.chromium.launch(channel="msedge"); kenh = "msedge"
    except Exception:
        tb = pw.chromium.launch(); kenh = "chromium"
    print("Trinh duyet:", kenh, tb.version)
    kq = {}
    for nhan in ["1MB"]:
        s = open(os.path.join(HERE, "mau-%s.json" % nhan), encoding="utf-8").read()
        trang = tb.new_page(viewport={"width": 1440, "height": 900})
        trang.goto("http://127.0.0.1:%d/index.html" % port, wait_until="load")
        trang.evaluate("() => { try { localStorage.clear(); } catch(e){} }")
        trang.reload(wait_until="load")
        kq[nhan] = trang.evaluate(JS, s)
        print(nhan, json.dumps(kq[nhan], ensure_ascii=False, indent=1))
        trang.close()
    # 10MB: chi localStorage + textarea tran
    s = open(os.path.join(HERE, "mau-10MB.json"), encoding="utf-8").read()
    trang = tb.new_page(viewport={"width": 1440, "height": 900})
    trang.goto("http://127.0.0.1:%d/index.html" % port, wait_until="load")
    r = trang.evaluate(r"""async (s) => {
      const raf = () => new Promise(r => requestAnimationFrame(() => r()));
      const out = {};
      try { localStorage.setItem('do-thu', s); out.localStorage = 'ok'; } catch (e) { out.localStorage = 'NEM LOI: ' + e.name; }
      try { localStorage.removeItem('do-thu'); } catch (e) {}
      const ta = document.createElement('textarea');
      ta.style.cssText = 'position:fixed;left:0;top:0;width:600px;height:400px;white-space:pre;font:13px monospace';
      document.body.appendChild(ta);
      let t0 = performance.now(); ta.value = s; await raf(); out.nap_textarea_tran = +(performance.now() - t0).toFixed(1);
      ta.focus(); const g = Math.floor(s.length/2); ta.setSelectionRange(g, g);
      const ds = [];
      for (let i = 0; i < 5; i++) { t0 = performance.now(); document.execCommand('insertText', false, ' '); await raf(); ds.push(performance.now() - t0); }
      ds.sort((a,b)=>a-b); out.go_textarea_tran = +ds[2].toFixed(1);
      // dem dong bang indexOf trong trinh duyet
      t0 = performance.now(); let n = 1; for (let k = s.indexOf('\n'); k >= 0; k = s.indexOf('\n', k + 1)) n++; out.dem_dong_ms = +(performance.now() - t0).toFixed(1); out.so_dong = n;
      t0 = performance.now(); JSON.parse(s); out.parse_ms = +(performance.now() - t0).toFixed(1);
      return out;
    }""", s)
    print("10MB", json.dumps(r, ensure_ascii=False, indent=1))
    trang.close()
    tb.close()
sv.shutdown(); sv.server_close()
