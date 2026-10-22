# -*- coding: utf-8 -*-
"""Hồ sơ CPU (CDP Profiler) khi gõ ở chế độ chỉ-editor của Markdown Editor Pro: gộp self-time theo hàm, in đoạn mã nguồn (bản build) quanh vị trí
để nhận diện hàm (bản build không có source map). python prof_me.py doc-30k [editor|split]"""
import collections
import os
import sys
import time

from playwright.sync_api import sync_playwright

import perfcommon as C
import perf_me as P


def main(doc, view):
    md = open(os.path.join(C.HERE, "docs", doc + ".md"), encoding="utf-8").read()
    proc, port = C.serve(P.APP_DIR)
    base = f"http://127.0.0.1:{port}/"
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(channel="msedge")
            ctx = b.new_context(viewport={"width": 1440, "height": 900}, service_workers="block")
            ctx.route("**/markdown/admin/session", lambda r: r.fulfill(status=200, content_type="application/json", body='{"session":"tok"}'))
            ctx.route("**/markdown/backends", lambda r: r.fulfill(status=200, content_type="application/json", body="[]"))
            ctx.route("https://img.example.test/**", lambda r: r.fulfill(status=200, content_type="image/png", body=C.IMG))
            page = ctx.new_page()
            page.goto(base + "manifest.webmanifest")
            page.evaluate("""([md, view]) => {
              localStorage.setItem('markdown-editor:files', JSON.stringify({version: 2, currentFileId: 'doc', expandedFolders: ['root'],
                files: [{id: 'root', name: 'My Documents', type: 'folder', children: [{id: 'doc', name: 'long.md', type: 'file', parentId: 'root', content: md}]}]}));
              localStorage.setItem('markdown-editor:settings', JSON.stringify({theme: 'light', viewMode: view, scrollSync: true, showLineNumbers: true, wordWrap: true, sidebarTab: 'files'}));
              localStorage.setItem('markdown-editor:admin-session', 'tok');
            }""", [md, view])
            page.goto(base + "index.html")
            page.wait_for_selector(".status-role.is-admin", timeout=600000)
            time.sleep(8 if view == "editor" else float(os.environ.get("OPEN_WAIT", "20")))
            off, _ = P.para_target(md)
            page.evaluate("(off) => { const ta = document.querySelector('textarea.editor-input'); ta.focus(); ta.setSelectionRange(off, off); ta.blur(); ta.focus(); }", off)
            cdp = ctx.new_cdp_session(page)
            cdp.send("Profiler.enable")
            cdp.send("Profiler.setSamplingInterval", {"interval": 200})
            cdp.send("Profiler.start")
            if os.environ.get("SCROLL"):
                sel = os.environ.get("SCROLL")
                box = page.locator(sel).bounding_box()
                page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
                for _ in range(15):
                    page.mouse.wheel(0, 400)
                    time.sleep(0.03)
                time.sleep(0.5)
            elif view == "editor":
                page.keyboard.type("zqxzqxzqxz", delay=60)   # < debounce (120 ms) ⇒ chỉ đo phần chạy mỗi phím
                time.sleep(0.05)
            else:
                page.keyboard.type("z")
                time.sleep(float(os.environ.get("RENDER_WAIT", "6")))
            prof = cdp.send("Profiler.stop")["profile"]
            b.close()
    finally:
        proc.terminate()
    nodes = {n["id"]: n for n in prof["nodes"]}
    dt = collections.Counter()
    samples, deltas = prof["samples"], prof["timeDeltas"]
    for sid, d in zip(samples, deltas):
        dt[sid] += d
    agg = collections.Counter()
    for nid, us in dt.items():
        cf = nodes[nid]["callFrame"]
        key = (cf["functionName"] or "(anon)", cf["url"].rsplit("/", 1)[-1], cf["lineNumber"], cf["columnNumber"])
        agg[key] += us
    total = sum(agg.values())
    byfile = collections.Counter()
    for (fn, url, ln, col), us in agg.items():
        byfile[url if url else fn] += us
    print("theo tệp:", ", ".join("%s %.0f ms (%.0f%%)" % (k[:30], v / 1000, 100 * v / total) for k, v in byfile.most_common(10)))
    print("tổng mẫu: %.0f ms" % (total / 1000))
    srcs = {}
    for (fn, url, ln, col), us in agg.most_common(18):
        snip = ""
        if url.endswith(".js"):
            path = os.path.join(P.APP_DIR, "assets", url)
            if os.path.exists(path):
                if path not in srcs:
                    srcs[path] = open(path, encoding="utf-8").read().split("\n")
                line = srcs[path][ln] if ln < len(srcs[path]) else ""
                snip = line[max(0, col - 10): col + 110].replace("\n", " ")
        print("%7.1f ms %5.1f%%  %-22s %s:%d:%d  %s" % (us / 1000, 100 * us / total, fn[:22], url[:28], ln, col, snip))


if __name__ == "__main__":
    v = sys.argv[2] if len(sys.argv) > 2 else "editor"
    main(sys.argv[1] if len(sys.argv) > 1 else "doc-30k", "split" if v == "scroll" else v)
