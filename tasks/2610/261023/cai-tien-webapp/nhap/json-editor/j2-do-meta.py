# -*- coding: utf-8 -*-
"""Đo chi phí THUẦN của metadata nhánh gấp (tomTatNut + moTaNut + moTaAria) trên mọi nhánh cấp 2 của tài liệu ~mb MB, trong Edge.
   Không chạm backend / DB. python j2-do-meta.py <thư-mục-app mới> <MB> [lần]"""
import functools
import http.server
import json
import socketserver
import statistics
import sys
import threading

from playwright.sync_api import sync_playwright

thu_muc, mb = sys.argv[1], float(sys.argv[2])
lan = int(sys.argv[3]) if len(sys.argv) > 3 else 5


class Im(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


src = open(__file__.replace("j2-do-meta.py", "j2-do-cay.py"), encoding="utf-8").read()
i = src.index('SINH = """') + len('SINH = """')
SINH = src[i:src.index('"""', i)]

sv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(Im, directory=thu_muc))
threading.Thread(target=sv.serve_forever, daemon=True).start()
url = "http://127.0.0.1:%d/index.html" % sv.server_address[1]

DO = """() => {
  const goc = JSON.parse(window.__s), T = JE_THU;
  const nh = [];
  for (let i = 0; i < goc.length; i++) { const b = goc[i]; for (const k in b) if (b[k] !== null && typeof b[k] === 'object') nh.push([i, k, b[k]]); }
  const dem = (f) => { const t = performance.now(); let x = 0; for (const [i, k, v] of nh) x += f(i, k, v); return [Math.round(performance.now() - t), x]; };
  const chung = { con: window.__ngan || 1e9 };
  const ts = [];
  const a = dem((i, k, v) => T.xemTruoc(v).length);
  const b = dem((i, k, v) => { const t = T.tomTatNut(v, { byte: true, ngan: chung }); ts.push(t); return 1; });
  const c = dem((i, k, v) => 0);
  const t0 = performance.now(); let y = 0; for (let j = 0; j < ts.length; j++) y += T.moTaNut(ts[j], '$[1].k').length;
  const t1 = performance.now(); for (let j = 0; j < ts.length; j++) y += T.moTaAria(ts[j]).length;
  const t2 = performance.now();
  return { nhanh: nh.length, xemTruocCu: a[0], tomTatNut: b[0], moTaNut: Math.round(t1 - t0), moTaAria: Math.round(t2 - t1), y: y };
}"""

with sync_playwright() as pw:
    tb = pw.chromium.launch(channel="msedge")
    kq = []
    for _ in range(lan):
        ctx = tb.new_context(viewport={"width": 1440, "height": 900})
        p = ctx.new_page()
        p.goto(url, wait_until="load")
        p.wait_for_function("() => !!window.JE_APP")
        s = p.evaluate(SINH, mb)
        p.evaluate("(s) => { window.__s = s; window.__ngan = " + (sys.argv[4] if len(sys.argv) > 4 else "0") + "; }", s)
        kq.append(p.evaluate(DO))
        ctx.close()
    print(json.dumps(kq))
    print("ok")
    tb.close()
sv.shutdown()
