# -*- coding: utf-8 -*-
"""Mốc so sánh: một <textarea> TRẦN (không React, không xử lý gì) chứa cùng tài liệu — đo độ trễ gõ do chính trình duyệt.
Nếu mốc này đã chậm thì phải ảo hoá trình soạn (CodeMirror 6…); nếu nhanh thì chi phí nằm ở mã của app.

    python perf_baseline.py doc-10k doc-30k
"""
import json
import os
import sys
import time

from playwright.sync_api import sync_playwright

import perfcommon as C

PAGE = """<!doctype html><meta charset=utf-8><style>body{margin:0;font:14px/1.6 Consolas,monospace}
textarea{position:absolute;left:280px;top:90px;width:560px;height:760px;font:inherit;padding:16px;border:0;resize:none;white-space:pre-wrap}</style>
<textarea spellcheck=false wrap=soft></textarea>"""


def para_offset(md):
    lines = md.split("\n")
    i = len(lines) // 2
    while lines[i].strip() == "" or lines[i].startswith(("|", "`", "#", "$", "-", ">")):
        i += 1
    return sum(len(x) + 1 for x in lines[:i]) + len(lines[i])


def main(docs):
    out = {}
    with sync_playwright() as p:
        b = p.chromium.launch(channel="msedge")
        for doc in docs:
            md = open(os.path.join(C.HERE, "docs", doc + ".md"), encoding="utf-8").read()
            for variant in ("plain", "nowrap"):
                ctx = b.new_context(viewport={"width": 1440, "height": 900})
                page = ctx.new_page()
                page.add_init_script(C.OBSERVERS)
                page.route("http://baseline.test/", lambda r: r.fulfill(status=200, content_type="text/html", body=PAGE))
                page.goto("http://baseline.test/")
                page.evaluate("(md) => { document.querySelector('textarea').value = md; }", md)
                if variant == "nowrap":
                    page.evaluate("() => { const t = document.querySelector('textarea'); t.setAttribute('wrap', 'off'); t.style.whiteSpace = 'pre'; }")
                if variant == "onInput_split":
                    # chỉ thêm: mỗi phím đọc .value và split dòng (việc tối thiểu mà EditorPane làm)
                    page.evaluate("() => { const t = document.querySelector('textarea'); t.addEventListener('input', () => { window.__n = t.value.split('\\n').length; }); }")
                off = para_offset(md)
                page.evaluate("(off) => { const ta = document.querySelector('textarea'); ta.focus(); ta.setSelectionRange(off, off); ta.blur(); ta.focus(); }", off)
                time.sleep(0.5)
                t0 = page.evaluate("performance.now()")
                page.keyboard.type("zqx" * 7, delay=150)
                t1 = page.evaluate("performance.now()")
                lat = C.key_latency(page.evaluate("window.__ev"), t0, t1 + 50)
                out["%s/%s" % (doc, variant)] = {"lat_p50": round(C.pct(lat, 50)), "lat_p95": round(C.pct(lat, 95)), "lat_max": round(max(lat or [0])), "events_over16": len(lat),
                                                 "lt": C.summarize_lt(page.evaluate("window.__lt"), t0, t1)}
                ctx.close()
        b.close()
    C.dump("baseline2.json", out)
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    main(sys.argv[1:] or ["doc-10k", "doc-30k"])
