import os, time, json
from playwright.sync_api import sync_playwright
import perfcommon as C
APP_DIR = os.path.join(C.REPO, r"backend\fastapi\webapp\tranphuc8a\personal-wiki")
md = open("docs/wiki-12k.md", encoding="utf-8").read()
proc, port = C.serve(APP_DIR)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel="msedge")
        ctx = b.new_context(viewport={"width": 1440, "height": 900}, service_workers="block")
        page = ctx.new_page()
        page.goto(f"http://127.0.0.1:{port}/index.html")
        page.wait_for_function("document.body.dataset.route", timeout=60000)
        nid = page.evaluate("""async (md) => { const s = await Wiki.store.openBest('personal-wiki'); const r = Wiki.repo.create(s); await r.open();
                const res = await r.save({title: 'Ghi chú rất dài', content: md, tags: ['perf']}); return res.note.id; }""", md)
        page.reload(); page.wait_for_function("document.body.dataset.route", timeout=60000); time.sleep(1)
        page.evaluate("(id) => { location.hash = '#/n/' + id; }", nid)
        time.sleep(15)
        print(page.evaluate("""(n) => { const t = document.querySelector('.ed-ta'); const m = document.querySelector('.ed-main'); const pv = document.querySelector('.ed-prev');
           return {route: document.body.dataset.route, hash: location.hash, ta: t && t.value.length, n, mode: m && m.dataset.mode, prevKids: pv && pv.childElementCount, prefs: localStorage.getItem('pw:prefs'), body: document.body.innerText.slice(0, 300)}; }""", len(md)))
        b.close()
finally:
    proc.terminate()
