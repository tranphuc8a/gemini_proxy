# -*- coding: utf-8 -*-
"""Đo Markdown Editor Pro (bản build đang phục vụ: backend/fastapi/webapp/tranphuc8a/markdown-editor-pro) trong Edge thật.

    python perf_me.py doc-2k [--modes split,editor,reading] [--keys 21] [--history 15] [--headed]

Không đụng repo: phục vụ thư mục build bằng http.server ở cổng trống; API quản trị được giả bằng page.route;
tài liệu dài nạp sẵn vào localStorage (khoá markdown-editor:files) trước khi mở trang.
"""
import argparse
import json
import os
import re
import time

from playwright.sync_api import sync_playwright

import perfcommon as C

WHEELS = int(os.environ.get("WHEELS", "40"))
APP_DIR = os.path.join(C.REPO, r"backend\fastapi\webapp\tranphuc8a\markdown-editor-pro")

READY = r"""
(() => {
  window.__t = {};
  const tick = () => {
    const now = performance.now();
    const ta = document.querySelector('textarea.editor-input');
    if (ta && ta.value.length > 1000 && !__t.editor) __t.editor = now;
    const body = document.querySelector('.preview-scroll .markdown-body');
    if (body && body.querySelector('[data-line]') && !__t.preview) {
      __t.preview = now;
      new MutationObserver(() => { __t.lastMut = performance.now(); __t.muts = (__t.muts || 0) + 1; }).observe(body, {childList: true});
    }
    const rd = document.querySelector('.reading-article');
    if (rd && rd.querySelector('[data-line]') && !__t.reading) __t.reading = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();
"""


def para_target(md):
    """Một dòng văn xuôi ở giữa tài liệu (ngoài khối code), trả (offset cuối dòng, dòng bắt đầu đoạn 1-based)."""
    lines = md.split("\n")
    fence = False
    cands = []
    for i, ln in enumerate(lines):
        if re.match(r"^\s{0,3}(```|~~~)", ln):
            fence = not fence
            continue
        if not fence and re.match(r"^[A-ZĐÀ-Ỹ][^|>#\-\d$]", ln) and (i == 0 or lines[i - 1].strip() == "") and "$" not in ln:
            cands.append(i)
    i = min(cands, key=lambda k: abs(k - len(lines) // 2))
    off = sum(len(x) + 1 for x in lines[:i]) + len(lines[i])
    return off, i + 1


def renderer_private_mb(browser):
    """Bộ nhớ riêng (private bytes) của các tiến trình renderer — gồm cả chuỗi ngoài heap V8 (giá trị textarea là external string của Blink)."""
    try:
        b = browser.new_browser_cdp_session()
        info = b.send("SystemInfo.getProcessInfo")["processInfo"]
        pids = [str(x["id"]) for x in info if x.get("type") == "renderer"]
        b.detach()
        if not pids:
            return None
        import subprocess
        outp = subprocess.run(["powershell", "-NoProfile", "-Command", "(Get-Process -Id %s | Measure-Object PrivateMemorySize64 -Sum).Sum" % ",".join(pids)], capture_output=True, text=True).stdout.strip()
        return round(int(outp) / 1048576, 1)
    except Exception as e:
        return str(e)


def run(doc, modes, keys, history, headed, keys_split=None):
    md = open(os.path.join(C.HERE, "docs", doc + ".md"), encoding="utf-8").read()
    proc, port = C.serve(APP_DIR)
    base = f"http://127.0.0.1:{port}/"
    res = {"doc": doc, "lines": md.count("\n"), "kb": round(len(md.encode()) / 1024)}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel="msedge", headless=not headed, args=["--enable-precise-memory-info"])
            for mode in modes:
                ctx = browser.new_context(viewport={"width": 1440, "height": 900}, service_workers="block")
                ctx.route("**/markdown/admin/session", lambda r: r.fulfill(status=200, content_type="application/json", body='{"session":"tok"}'))
                ctx.route("**/markdown/backends", lambda r: r.fulfill(status=200, content_type="application/json", body="[]"))
                if os.environ.get("NOIMG"):
                    ctx.route("https://img.example.test/**", lambda r: r.abort())
                else:
                    ctx.route("https://img.example.test/**", lambda r: r.fulfill(status=200, content_type="image/png", body=C.IMG))
                page = ctx.new_page()
                page.goto(base + "manifest.webmanifest")
                view = "editor" if mode == "editor" else "split"
                page.evaluate("""([md, view]) => {
                  localStorage.setItem('markdown-editor:files', JSON.stringify({version: 2, currentFileId: 'doc', expandedFolders: ['root'],
                    files: [{id: 'root', name: 'My Documents', type: 'folder', children: [{id: 'doc', name: 'long.md', type: 'file', parentId: 'root', content: md}]}]}));
                  localStorage.setItem('markdown-editor:settings', JSON.stringify({theme: 'light', viewMode: view, scrollSync: true, showLineNumbers: SHOWLN, wordWrap: true, sidebarTab: TAB, sidebarCollapsed: false}));
                  localStorage.setItem('markdown-editor:admin-session', 'tok');
                }""".replace("SHOWLN", os.environ.get("SHOWLN", "true")).replace("TAB", "'" + os.environ.get("TAB", "files") + "'"), [md, view])
                page.add_init_script(C.OBSERVERS)
                page.add_init_script(READY)
                if os.environ.get("CV"):
                    # THỬ NGHIỆM: content-visibility cho mọi khối cấp cao của preview/reading (không sửa repo — chỉ chèn CSS lúc đo)
                    page.add_init_script("document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.markdown-body > * { content-visibility: auto; contain-intrinsic-size: auto 120px; }'; document.head.append(s); });")
                cdp = ctx.new_cdp_session(page)
                cdp.send("Performance.enable")
                r = {}
                t_wall = time.time()
                page.goto(base + ("index.html?read=1" if mode == "reading" else "index.html"), wait_until="load", timeout=600000)
                # chờ yên: không long task và không đổi DOM preview trong 1,5 s
                deadline = time.time() + 900
                while time.time() < deadline:
                    s = page.evaluate("""() => { const now = performance.now(); const lt = window.__lt; const lastLt = lt.length ? lt[lt.length-1].s + lt[lt.length-1].d : 0;
                      return {now, lastLt, t: window.__t, loading: document.querySelectorAll('.mermaid-loading').length, admin: !!document.querySelector('.status-role.is-admin')}; }""")
                    t = s["t"]
                    ok = (t.get("reading") if mode == "reading" else t.get("editor") and (mode == "editor" or t.get("preview")))
                    if ok and s["now"] - max(s["lastLt"], t.get("lastMut", 0)) > 1500 and s["loading"] == 0:
                        break
                    time.sleep(0.25)
                r["open"] = {"editor_ms": round(t.get("editor", 0)), "preview_ms": round(t.get("preview", 0)), "reading_ms": round(t.get("reading", 0)), "settled_ms": round(max(s["lastLt"], t.get("lastMut", 0))),
                             "wall_s": round(time.time() - t_wall, 1), "admin": s["admin"], "lt": C.summarize_lt(page.evaluate("window.__lt"), 0, s["now"])}
                r["mem_after_open"] = C.heap(cdp)
                r["mem_after_open"]["rendererPrivateMB"] = renderer_private_mb(browser)

                if mode in ("split", "editor"):
                    off, pline = para_target(md)
                    page.evaluate("""(off) => { const ta = document.querySelector('textarea.editor-input'); ta.focus(); ta.setSelectionRange(off, off); ta.blur(); ta.focus(); }""", off)
                    time.sleep(0.3)
                    nk = keys_split if (mode == "split" and keys_split) else keys
                    marker = "zqx" * (nk // 3) + "z" * (nk % 3)
                    t0 = page.evaluate("performance.now()")
                    page.keyboard.type(marker, delay=150)
                    t1 = page.evaluate("performance.now()")
                    lat = C.key_latency(page.evaluate("window.__ev"), t0, t1 + 50)
                    r["typing"] = {"keys": nk, "delay_ms": 150, "wall_ms": round(t1 - t0), "lat_p50": round(C.pct(lat, 50)), "lat_p95": round(C.pct(lat, 95)), "lat_max": round(max(lat or [0])),
                                   "events_over16": len(lat), "lt": C.summarize_lt(page.evaluate("window.__lt"), t0, t1)}
                    if mode == "split":
                        # độ trễ preview: từ phím cuối tới khi đoạn trong preview chứa dấu
                        tq = None
                        dl = time.time() + 600
                        while time.time() < dl:
                            v = page.evaluate("""([L, m]) => { const el = document.querySelector('.preview-scroll [data-line="' + L + '"]'); return el && el.textContent.includes(m) ? performance.now() : 0; }""", [pline, marker])
                            if v:
                                tq = v
                                break
                            time.sleep(0.1)
                        # chờ yên
                        time.sleep(1.0)
                        dl = time.time() + 600
                        while time.time() < dl:
                            s = page.evaluate("() => { const lt = window.__lt; return {now: performance.now(), last: lt.length ? lt[lt.length-1].s + lt[lt.length-1].d : 0}; }")
                            if s["now"] - s["last"] > 1500:
                                break
                            time.sleep(0.25)
                        r["typing"]["preview_update_ms"] = round(tq - t1) if tq else None
                        r["typing"]["lt_incl_render"] = C.summarize_lt(page.evaluate("window.__lt"), t0, s["now"])
                    else:
                        time.sleep(1.5)
                    r["mem_after_typing"] = C.heap(cdp)

                    # cuộn: khung editor (kéo theo đồng bộ cuộn sang preview) rồi khung preview
                    for name, sel in (("scroll_editor", "textarea.editor-input"), ("scroll_preview", ".preview-scroll")):
                        if mode == "editor" and name == "scroll_preview":
                            continue
                        box = page.locator(sel).bounding_box()
                        page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
                        page.evaluate("document.querySelector('%s').scrollTop = 0" % sel)
                        time.sleep(0.5)
                        t0 = page.evaluate("(window.__startFrames(), performance.now())")
                        for _ in range(WHEELS):
                            page.mouse.wheel(0, 400)
                            time.sleep(0.02)
                        time.sleep(0.6)
                        fr = page.evaluate("window.__stopFrames()")
                        t1 = page.evaluate("performance.now()")
                        r[name] = dict(C.summarize_frames(fr), lt=C.summarize_lt(page.evaluate("window.__lt"), t0, t1))

                    if mode == "editor" and history:
                        before = C.heap(cdp)["heapMB"]
                        pb = renderer_private_mb(browser)
                        for _ in range(history):
                            page.keyboard.type("a")
                            time.sleep(0.75)          # > HISTORY_DEBOUNCE_MS (600) ⇒ mỗi lần là một bước hoàn tác = một bản sao toàn văn
                        after = C.heap(cdp)["heapMB"]
                        pa = renderer_private_mb(browser)
                        r["history_private"] = {"before_MB": pb, "after_MB": pa, "delta_MB": round(pa - pb, 1) if isinstance(pa, float) and isinstance(pb, float) else None}
                        r["history"] = {"commits": history, "heap_before_MB": before, "heap_after_MB": after, "delta_MB": round(after - before, 1), "per_commit_MB": round((after - before) / history, 2)}

                if mode == "reading":
                    sel = ".reading-scroll"
                    box = page.locator(sel).bounding_box()
                    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
                    time.sleep(0.5)
                    t0 = page.evaluate("(window.__startFrames(), performance.now())")
                    for _ in range(WHEELS):
                        page.mouse.wheel(0, 400)
                        time.sleep(0.02)
                    time.sleep(0.6)
                    fr = page.evaluate("window.__stopFrames()")
                    t1 = page.evaluate("performance.now()")
                    r["scroll_reading"] = dict(C.summarize_frames(fr), lt=C.summarize_lt(page.evaluate("window.__lt"), t0, t1))

                # autosave: thời gian một lần flushPersist (Ctrl+S gọi thẳng flushPersist) — đo bằng long task quanh phím
                if mode == "editor":
                    t0 = page.evaluate("performance.now()")
                    page.keyboard.press("Control+s")
                    time.sleep(0.8)
                    r["ctrl_s"] = C.summarize_lt(page.evaluate("window.__lt"), t0 - 5, t0 + 800)
                    r["ctrl_s"]["saveState_error"] = page.evaluate("!!document.querySelector('.status-save.is-error')")
                res[mode] = r
                ctx.close()
            browser.close()
    finally:
        proc.terminate()
    return res


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("doc")
    ap.add_argument("--modes", default="split,editor,reading")
    ap.add_argument("--keys", type=int, default=21)
    ap.add_argument("--keys-split", type=int, default=0)
    ap.add_argument("--history", type=int, default=15)
    ap.add_argument("--headed", action="store_true")
    a = ap.parse_args()
    out = run(a.doc, a.modes.split(","), a.keys, a.history, a.headed, a.keys_split)
    C.dump("me-%s%s.json" % (a.doc, os.environ.get("SUFFIX", "")), out)
    print(json.dumps(out, ensure_ascii=False, indent=1))
