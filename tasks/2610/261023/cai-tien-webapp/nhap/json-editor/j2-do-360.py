# -*- coding: utf-8 -*-
"""Chẩn đoán tràn ngang ở 360 px, chạy trên thư mục app tuỳ chọn (HEAD hay bản mới). Không chạm backend / DB."""
import functools
import http.server
import json
import socketserver
import sys
import threading

from playwright.sync_api import sync_playwright

thu_muc = sys.argv[1]


class Im(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


sv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(Im, directory=thu_muc))
threading.Thread(target=sv.serve_forever, daemon=True).start()
url = "http://127.0.0.1:%d/index.html" % sv.server_address[1]

nhieu = {"du_lieu": {"nguoi_dung_rat_dai_ten": [{"ho_va_ten": "Nguyễn Văn Một Cái Tên Rất Dài", "email": "nguyen.van@vi-du.vn", "tags": [1, 2, 3]}] * 3,
                     "cau_hinh": {"giao_dien": {"mau": "toi", "co_chu": 14}, "ngon_ngu": "vi", "thong_bao": [True, False]}}}
with sync_playwright() as pw:
    tb = pw.chromium.launch(channel="msedge")
    for ten, doc in (("co-du-lieu", nhieu), ("rong", {"a": 1})):
        ctx = tb.new_context(viewport={"width": 360, "height": 740}, color_scheme="dark")
        p = ctx.new_page()
        p.goto(url, wait_until="load")
        p.wait_for_function("() => !!window.JE_APP")
        p.fill("#nhap", json.dumps(doc, ensure_ascii=False, separators=(",", ":")))
        p.wait_for_timeout(260)
        p.click('.tab-n[data-o="cay"]')
        p.wait_for_timeout(120)
        kq = p.evaluate("""() => {
            const rong = document.documentElement.clientWidth, tran = document.documentElement.scrollWidth - rong;
            const quaRong = [];
            for (const e of document.querySelectorAll('body *')) {
              const r = e.getBoundingClientRect();
              if (r.width > 0 && r.right > rong + 1) quaRong.push((e.id ? '#' + e.id : '') + '.' + String(e.className).slice(0, 30) + ' ' + e.tagName + ' r=' + Math.round(r.right) + ' w=' + Math.round(r.width));
            }
            return { rong, tran, quaRong: quaRong.slice(0, 8), tab: document.querySelector('.tab').getBoundingClientRect().width };
        }""")
        print(ten, json.dumps(kq, ensure_ascii=False))
        ctx.close()
    tb.close()
sv.shutdown()
