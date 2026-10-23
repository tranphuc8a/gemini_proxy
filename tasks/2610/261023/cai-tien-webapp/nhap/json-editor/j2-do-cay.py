# -*- coding: utf-8 -*-
"""Đo thời gian dựng tab Cây (veCay) trên thư mục app tuỳ chọn: HEAD hay bản mới. Chỉ máy chủ tĩnh + Edge, không chạm backend / DB.
   python do_cay.py <thư-mục-app> <MB> [lần]"""
import functools
import http.server
import json
import socketserver
import statistics
import sys
import threading

from playwright.sync_api import sync_playwright

thu_muc, mb = sys.argv[1], float(sys.argv[2])
lan = int(sys.argv[3]) if len(sys.argv) > 3 else 3


class Im(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


sv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(Im, directory=thu_muc))
threading.Thread(target=sv.serve_forever, daemon=True).start()
url = "http://127.0.0.1:%d/index.html" % sv.server_address[1]

# Bộ sinh tất định (LCG) chạy TRONG trang: mảng bản ghi có đủ kiểu; ~mb MB văn bản nén.
SINH = """(mb) => {
  let h = 42; const r = () => (h = (h * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const tu = ['Hà Nội', 'Phúc', 'An', 'Bình', 'alpha', 'beta', 'gamma', 'x'.repeat(30)];
  const bg = []; let len = 0, i = 0;
  while (len < mb * 1048576) {
    const b = { id: i, name: tu[Math.floor(r() * tu.length)] + ' ' + i, email: 'u' + i + '@vi-du.vn', active: r() < .5, score: Math.round(r() * 1e4) / 100,
      tags: Array.from({ length: Math.floor(r() * 5) }, () => tu[Math.floor(r() * tu.length)]),
      address: { city: tu[Math.floor(r() * tu.length)], zip: String(10000 + Math.floor(r() * 89999)), geo: { lat: r(), lng: r() } },
      notes: r() < .3 ? null : 'ghi chú ' + 'lorem ipsum '.repeat(Math.floor(r() * 6)) };
    bg.push(b); len += 220 + (b.tags.length * 8); i++;
  }
  return JSON.stringify(bg);
}"""

with sync_playwright() as pw:
    tb = pw.chromium.launch(channel="msedge")
    ctx = tb.new_context(viewport={"width": 1440, "height": 900})
    p = ctx.new_page()
    loi = []
    p.on("pageerror", lambda e: loi.append(str(e)))
    p.goto(url, wait_until="load")
    p.wait_for_function("() => !!window.JE_APP")
    s = p.evaluate(SINH, mb)
    print("doc %.2f MB, %d chars" % (len(s.encode("utf-8")) / 1048576, len(s)))
    p.evaluate("(s) => { JE_APP.datVanBan(s, { nhan: 'Đo' }); }", s)
    p.wait_for_timeout(500)
    co_kt = p.evaluate("() => !!document.querySelector('#cay-kich-thuoc')")
    p.evaluate("() => JE_APP.chuyenTab('cay')")           # lần đầu (dựng cây)
    p.wait_for_timeout(300)
    ket = {}
    for che in ([True, False] if co_kt else [None]):
        if che is not None:
            p.evaluate("(b) => { document.querySelector('#cay-kich-thuoc').checked = b; }", che)
        ds = []
        for _ in range(lan):
            # ép veCay chạy lại từ đầu bằng hộp kiểm "Hiện kiểu" (bật rồi tắt); đo lần ở trạng thái bật
            p.evaluate("() => document.querySelector('#cay-kieu').click()")
            p.wait_for_timeout(80)
            ms = p.evaluate("() => { const t = performance.now(); document.querySelector('#cay-kieu').click(); return performance.now() - t; }")
            ds.append(round(ms))
            p.wait_for_timeout(80)
        n = p.evaluate("() => document.querySelectorAll('#cay *').length")
        dm = p.evaluate("() => document.querySelectorAll('#cay .dem-byte').length")
        ket["kich-thuoc=%s" % che] = {"ms": ds, "trung_vi": int(statistics.median(ds)), "phan_tu_dom": n, "dem_byte": dm}
    print(json.dumps(ket, ensure_ascii=False))
    print("loi:", loi[:2])
    tb.close()
sv.shutdown()
