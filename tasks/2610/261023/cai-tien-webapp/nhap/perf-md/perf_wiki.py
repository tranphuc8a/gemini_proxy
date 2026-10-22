# -*- coding: utf-8 -*-
"""Đo Personal Wiki (backend/fastapi/webapp/tranphuc8a/personal-wiki, viết tay) trong Edge thật với một ghi chú rất dài.

    python perf_wiki.py wiki-12k [--keys 21]

Không đụng repo: phục vụ thư mục app bằng http.server ở cổng trống; ghi chú được nạp qua chính API của app (Wiki.repo) vào IndexedDB của
hồ sơ trình duyệt tạm.
"""
import argparse
import json
import os
import re
import time

from playwright.sync_api import sync_playwright

import perfcommon as C

APP_DIR = os.path.join(C.REPO, r"backend\fastapi\webapp\tranphuc8a\personal-wiki")

PREV_OBS = r"""
() => { const p = document.querySelector('.ed-prev'); window.__pm = {n: 0, last: 0};
  new MutationObserver(() => { __pm.n++; __pm.last = performance.now(); }).observe(p, {childList: true}); }
"""


def para_offset(md):
    lines = md.split("\n")
    fence = False
    cands = []
    for i, ln in enumerate(lines):
        if re.match(r"^\s{0,3}(```|~~~)", ln):
            fence = not fence
            continue
        if not fence and re.match(r"^[A-ZĐÀ-Ỹ][^|>#\-\d$]", ln) and (i == 0 or lines[i - 1].strip() == ""):
            cands.append(i)
    i = min(cands, key=lambda k: abs(k - len(lines) // 2))
    return sum(len(x) + 1 for x in lines[:i]) + len(lines[i])


def wait_quiet(page, ms=1200, limit=300):
    dl = time.time() + limit
    while time.time() < dl:
        s = page.evaluate("() => { const lt = window.__lt; return {now: performance.now(), last: lt.length ? lt[lt.length-1].s + lt[lt.length-1].d : 0, pm: (window.__pm||{}).last || 0}; }")
        if s["now"] - max(s["last"], s["pm"]) > ms:
            return s["now"]
        time.sleep(0.2)
    return None


def run(doc, keys, headed):
    md = open(os.path.join(C.HERE, "docs", doc + ".md"), encoding="utf-8").read()
    proc, port = C.serve(APP_DIR)
    url = f"http://127.0.0.1:{port}/index.html"
    res = {"doc": doc, "lines": md.count("\n"), "kb": round(len(md.encode()) / 1024), "chars": len(md)}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel="msedge", headless=not headed)
            ctx = browser.new_context(viewport={"width": 1440, "height": 900}, service_workers="block")
            ctx.route("https://img.example.test/**", lambda r: r.fulfill(status=200, content_type="image/png", body=C.IMG))
            page = ctx.new_page()
            page.add_init_script(C.OBSERVERS)
            page.goto(url)
            page.wait_for_function("document.body.dataset.route", timeout=60000)
            nid = page.evaluate("""async (md) => { const s = await Wiki.store.openBest('personal-wiki'); const r = Wiki.repo.create(s); await r.open();
                const res = await r.save({title: 'Ghi chú rất dài', content: md, tags: ['perf']}); return res.note.id; }""", md)
            stored = page.evaluate("""async (id) => { const s = await Wiki.store.openBest('personal-wiki'); const r = Wiki.repo.create(s); await r.open(); const n = await r.get(id); return n.content.length; }""", nid)
            res["stored_chars"] = stored
            page.reload()
            page.wait_for_function("document.body.dataset.route", timeout=60000)
            time.sleep(1)
            cdp = ctx.new_cdp_session(page)
            cdp.send("Performance.enable")
            for mode in ("split", "edit"):
                r = {}
                page.evaluate("location.hash = '#/notes'")
                time.sleep(0.8)
                page.evaluate("(m) => Wiki.ui.setPref ? Wiki.ui.setPref('mode', m) : null", mode)
                t0 = page.evaluate("performance.now()")
                page.evaluate("(id) => { location.hash = '#/n/' + id; }", nid)
                try:
                    page.wait_for_function("(n) => { const t = document.querySelector('.ed-ta'); return !!(t && t.value.length >= n && (document.querySelector('.ed-main').dataset.mode === 'edit' || document.querySelector('.ed-prev').childElementCount > 0)); }", arg=stored, timeout=60000, polling=100)
                except Exception:
                    print("STATE", page.evaluate("(n) => { const t = document.querySelector('.ed-ta'); const m = document.querySelector('.ed-main'); const pv = document.querySelector('.ed-prev'); return {hash: location.hash, route: document.body.dataset.route, ta: t && t.value.length, n, mode: m && m.dataset.mode, kids: pv && pv.childElementCount}; }", stored))
                    raise
                t_vis = page.evaluate("performance.now()")
                page.evaluate(PREV_OBS)
                tq = wait_quiet(page)
                r["open"] = {"visible_ms": round(t_vis - t0), "settled_ms": round((tq or 0) - t0), "lt": C.summarize_lt(page.evaluate("window.__lt"), t0, tq or t_vis), "mode": page.evaluate("document.querySelector('.ed-main').dataset.mode")}
                r["mem_after_open"] = C.heap(cdp)
                off = para_offset(md[:stored])
                page.evaluate("(off) => { const ta = document.querySelector('.ed-ta'); ta.focus(); ta.setSelectionRange(off, off); ta.blur(); ta.focus(); }", off)
                time.sleep(0.3)
                marker = "zqx" * (keys // 3) + "z" * (keys % 3)
                t0 = page.evaluate("performance.now()")
                page.keyboard.type(marker, delay=150)
                t1 = page.evaluate("performance.now()")
                lat = C.key_latency(page.evaluate("window.__ev"), t0, t1 + 50)
                tq = wait_quiet(page)
                pm = page.evaluate("window.__pm")
                r["typing"] = {"keys": keys, "wall_ms": round(t1 - t0), "lat_p50": round(C.pct(lat, 50)), "lat_p95": round(C.pct(lat, 95)), "lat_max": round(max(lat or [0])), "events_over16": len(lat),
                               "lt": C.summarize_lt(page.evaluate("window.__lt"), t0, t1), "lt_incl_render": C.summarize_lt(page.evaluate("window.__lt"), t0, tq or t1),
                               "preview_renders": pm["n"], "preview_update_ms": round(pm["last"] - t1) if pm["last"] else None}
                for name, sel in (("scroll_editor", ".ed-ta"), ("scroll_preview", ".ed-prev")):
                    if mode == "edit" and name == "scroll_preview":
                        continue
                    box = page.locator(sel).bounding_box()
                    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + min(box["height"] / 2, 300))
                    time.sleep(0.4)
                    t0 = page.evaluate("(window.__startFrames(), performance.now())")
                    for _ in range(40):
                        page.mouse.wheel(0, 400)
                        time.sleep(0.02)
                    time.sleep(0.6)
                    fr = page.evaluate("window.__stopFrames()")
                    t1 = page.evaluate("performance.now()")
                    r[name] = dict(C.summarize_frames(fr), lt=C.summarize_lt(page.evaluate("window.__lt"), t0, t1))
                # Lưu (Ctrl+S): ghi note thật + chỉ mục đảo + thẻ + liên kết
                t0 = page.evaluate("performance.now()")
                page.keyboard.press("Control+s")
                page.wait_for_function("() => document.querySelector('.save') && document.querySelector('.save').disabled", timeout=120000)
                t1 = page.evaluate("performance.now()")
                tq = wait_quiet(page)
                r["save"] = {"ms": round(t1 - t0), "lt": C.summarize_lt(page.evaluate("window.__lt"), t0 - 5, tq or t1)}
                r["mem_after"] = C.heap(cdp)
                res[mode] = r
            browser.close()
    finally:
        proc.terminate()
    return res


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("doc")
    ap.add_argument("--keys", type=int, default=21)
    ap.add_argument("--headed", action="store_true")
    a = ap.parse_args()
    out = run(a.doc, a.keys, a.headed)
    C.dump("wiki-%s.json" % a.doc, out)
    print(json.dumps(out, ensure_ascii=False, indent=1))
