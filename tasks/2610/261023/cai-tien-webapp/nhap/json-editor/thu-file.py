import os, sys, json, pathlib
sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright
url = pathlib.Path(os.path.abspath("thu-file.html")).as_uri()
with sync_playwright() as pw:
    tb = pw.chromium.launch(channel="msedge")
    p = tb.new_page()
    p.goto(url)
    p.wait_for_timeout(2500)
    print(json.dumps(p.evaluate("() => window.ketQua")))
    tb.close()
