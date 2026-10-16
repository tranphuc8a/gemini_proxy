#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kiem tra Code Studio bang trinh duyet THAT (Edge) + backend THAT (tu khoi dong, DB tam, khong cham DB that).

    python check.py --tinh     # tinh: tep, <script>, node --check, node kiem.js (logic thuan)
    python check.py            # + trinh duyet that: soan ma, goi y, dinh dang, chay (trinh duyet JS; may chu `local` C++/Java), du an, thu vien, zip, dong bo 2 thiet bi, dien thoai
    python check.py --anh      # chup anh vao _shots/
    python check.py --wasm     # + chay Python (Pyodide) va C++ (Clang-WASM) TRONG TRINH DUYET (can mang toi jsDelivr, tai vai chuc MB)
    python check.py --trinh-duyet=firefox|webkit   # cung kich ban tren Firefox / WebKit (can: python -m playwright install firefox webkit)

Dung python cua backend/fastapi/.venv (co playwright). Backend duoc khoi dong voi:
  DB_URL=sqlite tam, MONGO_URI rong, RUN_LOCAL_ENABLED=true, COURSE_ADMIN_KEY ngau nhien, CODESTORE_* tro vao tep tam.
KHONG goi Piston/Judge0/Wandbox cong cong. Thoat 1 neu co muc SAI.
"""
import io
import json
import os
import re
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", "..", "..", ".."))
BE = os.path.join(REPO, "backend", "fastapi")
PY = os.path.join(BE, ".venv", "Scripts", "python.exe")
if not os.path.exists(PY):
    PY = sys.executable
os.environ.setdefault("PYTHONUTF8", "1")
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

dat, hong, bo = [], [], []


def ok(m):
    dat.append(m); print("  [ok]  " + m)


def sai(m):
    hong.append(m); print("  [SAI] " + m)


def bo_qua(m):
    bo.append(m); print("  [--]  " + m)


def kiem(ten, dk, chi_tiet=""):
    (ok if dk else sai)(ten if dk or not chi_tiet else ten + "  ->  " + str(chi_tiet))


# ----------------------------------------------------------------------------- tang tinh
def tang_tinh():
    print("\nTANG 1 - tinh")
    md_ok = False
    try:
        import json
        md = json.load(io.open(os.path.join(HERE, "metadata.json"), encoding="utf-8"))
        md_ok = all(md.get(k) for k in ("title", "description", "icon", "tags"))
    except Exception:
        pass
    kiem("metadata.json co title, description, icon, tags", md_ok)
    html = io.open(os.path.join(HERE, "index.html"), encoding="utf-8").read()
    srcs = re.findall(r'<script[^>]+src="([^"]+)"', html)
    css = re.findall(r'<link[^>]+href="([^"]+\.css)"', html)
    thieu = [s for s in srcs + css if not os.path.isfile(os.path.join(HERE, s))]
    kiem("index.html: %d <script> + %d css, tep nao cung ton tai" % (len(srcs), len(css)), not thieu, ", ".join(thieu))
    ngoai = [s for s in srcs + css if re.match(r"^(https?:)?//", s)]
    kiem("index.html khong nap thu vien/phong ngoai (CDN chi nap luc can: Clang/Pyodide/clang-format... khi nguoi dung dong y)", not ngoai, ", ".join(ngoai))
    try:
        mf = json.load(io.open(os.path.join(HERE, "manifest.webmanifest"), encoding="utf-8"))
        thieu_icon = [i["src"] for i in mf.get("icons", []) if not os.path.isfile(os.path.join(HERE, i["src"]))]
        kiem("manifest.webmanifest: name, start_url, scope, 3 bieu tuong (any 192/512 + maskable) deu ton tai", mf.get("name") and mf.get("start_url") == "./" and mf.get("scope") == "./" and len(mf.get("icons", [])) >= 3 and not thieu_icon, ", ".join(thieu_icon))
    except Exception as e:
        sai("manifest.webmanifest doc duoc: " + str(e)[:100])
    sw = io.open(os.path.join(HERE, "sw.js"), encoding="utf-8").read()
    kiem("sw.js: chi xu ly GET cung origin duoi pham vi app, khong nhac toi /api/ (API dong bo khong bao gio bi cache)", 'req.method !== "GET"' in sw and "url.origin !== self.location.origin" in sw and "DUONG_DAN) !== 0" in sw and "/api/" not in sw.replace("(/api/v1/codestore/…, /api/v1/run/…)", ""))
    node = shutil.which("node")
    if not node:
        bo_qua("khong co node - bo qua node --check va kiem.js")
        return
    loi = []
    for goc, _, tep in os.walk(HERE):
        if "_shots" in goc:
            continue
        for t in tep:
            if t.endswith(".js"):
                r = subprocess.run([node, "--check", os.path.join(goc, t)], capture_output=True, text=True)
                if r.returncode:
                    loi.append(t + ": " + (r.stderr.strip().splitlines() or ["?"])[-1][:90])
    kiem("moi tep .js qua node --check", not loi, "; ".join(loi[:3]))
    r = subprocess.run([node, "kiem.js"], cwd=HERE, capture_output=True, text=True, encoding="utf-8", errors="replace")
    cuoi = [l for l in r.stdout.splitlines() if l.strip()][-1:] or [""]
    kiem("node kiem.js: %s" % cuoi[0].strip()[:110], r.returncode == 0, "\n".join([l for l in r.stdout.splitlines() if "[SAI]" in l][:6]))
    r = subprocess.run([PY, os.path.join(HERE, "sync.py"), "--kiem"], capture_output=True, text=True, encoding="utf-8", errors="replace")
    kiem("sync.py --kiem: ban sao assets/cs/ cua heuristic-practice-2 khop nguon", r.returncode == 0, r.stdout.strip()[:200])


# ----------------------------------------------------------------------------- backend that
def cong_trong():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p


class May:
    """Khoi dong uvicorn that voi moi truong an toan; dung de phuc vu trang + /run + /codestore."""
    def __init__(self):
        self.tmp = tempfile.mkdtemp(prefix="cs-check-")
        self.khoa = secrets.token_urlsafe(12)
        self.port = cong_trong()
        env = dict(os.environ, PYTHONUTF8="1", DB_URL="sqlite+aiosqlite:///" + self.tmp.replace("\\", "/") + "/dev.sqlite3", MONGO_URI="",
                   API_PREFIX="/api/v1", RUN_LOCAL_ENABLED="true", COURSE_ADMIN_KEY=self.khoa, CODESTORE_STORAGE_BACKEND="json",
                   CODESTORE_JSON_FILE=os.path.join(self.tmp, "codestore.json"), AI_ENABLED="false")
        self.log = open(os.path.join(self.tmp, "uvicorn.log"), "w", encoding="utf-8")
        self.p = subprocess.Popen([PY, "-m", "uvicorn", "src.main:app", "--port", str(self.port), "--log-level", "warning"], cwd=BE, env=env, stdout=self.log, stderr=subprocess.STDOUT)
        self.api = "http://127.0.0.1:%d/api/v1" % self.port
        self.goc = "http://127.0.0.1:%d/webapp/tranphuc8a/code-studio/" % self.port
        t0 = time.time()
        while time.time() - t0 < 60:
            try:
                urllib.request.urlopen(self.api + "/run/providers", timeout=2).read(); return
            except Exception:
                if self.p.poll() is not None:
                    raise RuntimeError("uvicorn thoat som, xem " + os.path.join(self.tmp, "uvicorn.log"))
                time.sleep(0.4)
        raise RuntimeError("uvicorn khong len sau 60 giay")

    def dong(self):
        try:
            subprocess.run(["taskkill", "/T", "/F", "/PID", str(self.p.pid)], capture_output=True)
        except Exception:
            self.p.kill()
        try:
            self.log.close()
        except Exception:
            pass
        shutil.rmtree(self.tmp, ignore_errors=True)


def mo_trinh_duyet(pw):
    khac = [a.split("=", 1)[1] for a in sys.argv if a.startswith("--trinh-duyet=")]
    if khac and khac[0] in ("firefox", "webkit"):             # kiem cheo: Firefox (Gecko) hoac WebKit (nhu Safari)
        return getattr(pw, khac[0]).launch(headless=True)
    for kenh in ("msedge", "chrome", None):
        try:
            return pw.chromium.launch(channel=kenh, headless=True) if kenh else pw.chromium.launch(headless=True)
        except Exception:
            continue
    return None


# ----------------------------------------------------------------------------- tang trinh duyet
def ev(pg, js, arg=None):
    return pg.evaluate(js, arg) if arg is not None else pg.evaluate(js)


def gt(pg):
    return ev(pg, "() => CS.app.ed.getValue()")


def thay_ma(pg, code):
    ev(pg, "c => CS.app.ed.replaceAllText(c)", code)


def tao_doan_ma(pg, ngon, ten=""):
    pg.click('[data-cmd="palette"]')
    pg.fill(".cs-pal input", "Đoạn mã mới")
    pg.keyboard.press("Enter")
    pg.wait_for_selector("dialog.cs-dlg select")
    pg.select_option("dialog.cs-dlg select", ngon)
    if ten:
        pg.fill("dialog.cs-dlg input", ten)
    pg.click("dialog.cs-dlg button:has-text('Tạo')")
    pg.wait_for_selector("dialog.cs-dlg", state="detached")
    pg.wait_for_function("l => CS.app.S.item && CS.app.S.item.language === l", arg=ngon)


def chon_noi_chay(pg, id_):
    pg.select_option("#cs-target", id_)


def chay_va_doi(pg, timeout=60000):
    pg.click('button[data-cmd="run"]')
    pg.wait_for_function("() => !!document.querySelector('.cs-runst .pill.ok, .cs-runst .pill.bad')", timeout=timeout)
    return ev(pg, "() => ({cls: document.querySelector('.cs-runst .pill').className, label: document.querySelector('.cs-runst .pill').textContent, out: document.querySelector('.cs-out').textContent})")


def doi_bo_test(pg, timeout=60000):
    """Cho bo test chay xong (het 'dang chay' va co dong tom tat that su)."""
    pg.wait_for_function("() => !CS.app.S.running && !!document.querySelector('.cs-tsum .pill') && !document.querySelector('.cs-tsum .pill.busy')", timeout=timeout)


def them_test(pg, vao, ra):
    """Bam '+ Them test' va dien dau vao / dap an vao the moi nhat; tra ve so ca hien co."""
    n = pg.locator(".cs-tc").count()
    pg.click('.cs-thead button:has-text("+ Thêm test")')
    pg.wait_for_function("n => document.querySelectorAll('.cs-tc').length === n", arg=n + 1)
    the = pg.locator(".cs-tc").nth(n)
    the.locator("textarea").nth(0).fill(vao)
    the.locator("textarea").nth(1).fill(ra)
    return n + 1


def phan_quyet(pg):
    return ev(pg, "() => [...document.querySelectorAll('.cs-tc .pill')].map(p => p.getAttribute('data-v')).join(',')")


def tang_trinh_duyet(chup, wasm):
    from playwright.sync_api import sync_playwright
    print("\nTANG 2 - trinh duyet that (Edge) + backend that")
    may = May()
    anh = os.path.join(HERE, "_shots")
    if chup:
        os.makedirs(anh, exist_ok=True)
    loi_console = []
    try:
        with sync_playwright() as p:
            br = mo_trinh_duyet(p)
            if not br:
                bo_qua("khong mo duoc trinh duyet (Edge/Chrome/Chromium)")
                return
            # service_workers=block: neu co worker dang dieu khien trang thi page.route khong chan duoc fetch tren WebKit (may chu AI gia). PWA duoc kiem o ctxp rieng.
            ctx = br.new_context(viewport={"width": 1280, "height": 860}, service_workers="block")
            pg = ctx.new_page()
            pg.set_default_timeout(20000)
            pg.on("console", lambda m: loi_console.append(m.text[:200]) if m.type == "error" else None)
            pg.on("pageerror", lambda e: loi_console.append("pageerror: " + str(e)[:200]))
            pg.goto(may.goc)
            pg.wait_for_selector(".cse-ta")
            pg.evaluate("k => sessionStorage.setItem('cs:adminKey', k)", may.khoa)
            pg.wait_for_function("() => CS.app.S.item && CS.app.S.serverTargets !== null")      # doan ma dau tien + danh sach noi chay da nap
            pg.click(".cse-ta")
            pg.wait_for_function("() => /Dòng \\d+/.test(document.querySelector('.cs-status').textContent)")

            # ---------------- tai trang + to mau
            kiem("lan dau: tu tao doan ma C++ mau, co to mau cu phap", ev(pg, "() => CS.app.S.item && CS.app.S.item.language") == "cpp" and pg.locator(".cse-hl .t-kw, .cse-hl .t-ty").count() > 0)
            kiem("thanh trang thai co dong/cot + ngon ngu C++", "C++" in pg.locator(".cs-status").inner_text() and "Dòng" in pg.locator(".cs-status").inner_text())
            provs = ev(pg, "() => (CS.app.S.serverTargets || []).map(p => p.id + ':' + p.available)")
            kiem("danh sach noi chay cua may chu nap duoc (piston/judge0/wandbox/local), local dung duoc", any(x == "local:true" for x in provs), str(provs))
            opts = pg.locator("#cs-target option").all_inner_texts()
            kiem("hop 'Noi chay' co: trinh duyet + may chu (nhieu lua chon)", len(opts) >= 3, str(opts))

            # ---------------- tu dong dong ngoac, thut, goi y
            pg.click(".cse-ta"); pg.keyboard.press("Control+a"); pg.keyboard.press("Delete")
            pg.keyboard.type("int main() {")
            pg.keyboard.press("Enter")
            v = gt(pg)
            kiem("go '{' tu dong them '}' va Enter tach dong, thut 4 dau cach", v == "int main() {\n    \n}", repr(v))
            pg.keyboard.type('printf("hi')
            v = gt(pg)
            kiem("tu dong dong nhay kep va ngoac tron", v.endswith('printf("hi")') or v.endswith('printf("hi")\n}') or 'printf("hi")' in v, repr(v))
            pg.keyboard.press("Control+a"); pg.keyboard.press("Delete")
            pg.keyboard.type("vector<int> v;")
            pg.keyboard.press("Enter")
            pg.keyboard.type("v.pu")
            pg.wait_for_selector(".cse-pop:not([hidden]) .cse-it")
            primero = pg.locator(".cse-pop .cse-il").first.inner_text()
            kiem("go 'v.pu' (v la vector<int>) -> goi y push_back dau tien", primero == "push_back", primero)
            pg.keyboard.press("Enter")
            kiem("Enter chap nhan goi y", "v.push_back" in gt(pg))
            pg.keyboard.press("Control+a"); pg.keyboard.press("Delete")
            pg.keyboard.type("for")
            pg.wait_for_selector(".cse-pop:not([hidden])")
            kiem("goi y co mau (snippet) 'for' trong danh sach", pg.locator(".cse-pop .cse-ik.snippet").count() >= 1)
            pg.keyboard.press("Escape")

            # ---------------- dinh dang ma xau
            xau = "#include <iostream>\nusing namespace std;int main(){int n;cin>>n;for(int i=0;i<n;i++){if(i%2==0){cout<<i<<endl;}else cout<<\"odd\";}return 0;}"
            thay_ma(pg, xau)
            pg.click('button[data-cmd="format"]')
            pg.wait_for_function("() => CS.app.ed.getValue().indexOf('\\n    int n;') >= 0")
            dep = gt(pg)
            kiem("dinh dang: ma xau dinh chum thanh khoi, thut dung, khoang trang dung", "int main() {\n    int n;\n    cin >> n;\n    for (int i = 0; i < n; i++) {" in dep, repr(dep[:160]))
            pg.focus(".cse-ta"); pg.keyboard.press("Control+z")
            kiem("Ctrl+Z hoan tac dinh dang trong MOT buoc (tra ma cu)", gt(pg) == xau)
            thay_ma(pg, xau)
            pg.focus(".cse-ta"); pg.keyboard.press("Shift+Alt+F")
            pg.wait_for_function("() => CS.app.ed.getValue().indexOf('\\n    int n;') >= 0")
            ok("phim tat Shift+Alt+F dinh dang")

            # ---------------- tim / thay
            pg.keyboard.press("Control+h")
            pg.fill(".cse-q", "cout")
            pg.wait_for_function("() => /\\d\\/\\d/.test(document.querySelector('.cse-cnt').textContent) || /\\d+$/.test(document.querySelector('.cse-cnt').textContent)")
            pg.wait_for_selector(".cse-m.f")
            n_kq = pg.locator(".cse-m.f").count()
            kiem("Ctrl+H: tim 'cout' to sang cac cho khop (%d)" % n_kq, n_kq >= 2)
            pg.fill(".cse-r", "std::cout")
            pg.click('.cse-fb[data-f="all"]')
            kiem("Thay tat ca 'cout' -> 'std::cout'", gt(pg).count("std::cout") >= 2)
            pg.keyboard.press("Escape")

            # ---------------- chay JavaScript trong trinh duyet
            tao_doan_ma(pg, "javascript", "thu js")
            thay_ma(pg, 'const t = readInput().split(/\\s+/).map(Number);\nprint(t[0] + t[1]);\nconsole.error("dbg");')
            pg.click('.cs-ptab[data-ptab="input"]')
            pg.fill('textarea[aria-label^="Dữ liệu vào"]', "20 22")
            chon_noi_chay(pg, "browser")
            r = chay_va_doi(pg)
            kiem("chay JS trong trinh duyet: print -> '42', stderr co 'dbg'", "ok" in r["cls"] and "42" in r["out"] and "dbg" in r["out"], str(r))
            thay_ma(pg, "while(true){}")
            pg.click('.cs-ptab[data-ptab="config"]')
            pg.select_option('select[aria-label="Giới hạn thời gian chạy"]', "2000")
            r = chay_va_doi(pg, 20000)
            kiem("vong lap vo han bi dung sau 2 giay (bao qua gio)", "bad" in r["cls"] and ("Quá giờ" in r["label"] or "giờ" in r["label"]), str(r))
            thay_ma(pg, "print('ctrl-enter')")
            pg.click('.cs-ptab[data-ptab="output"]')
            pg.focus(".cse-ta"); pg.keyboard.press("Control+Enter")
            pg.wait_for_function("() => /ctrl-enter/.test(document.querySelector('.cs-out')?.textContent || '')")
            ok("Ctrl+Enter chay ma")
            thay_ma(pg, "const a = 1;\n\nthrow new Error('hong o dong 3');\n")
            r = chay_va_doi(pg)
            dong = ev(pg, "() => (CS.app.S.diags.filter(d => d.severity === 'error')[0] || {}).line")
            kiem("loi JS luc chay: bao dung dong 3 (moi trinh duyet dinh dang stack khac nhau)", "bad" in r["cls"] and dong == 3, "%s dong=%s" % (r["label"], dong))

            # ---------------- bo test: nhieu ca (vao -> dap an), phan quyet AC/WA/TLE/RE, dung giua chung
            thay_ma(pg, 'const t = readInput().split(/\\s+/).map(Number);\nprint(t[0] + t[1]);\n')
            pg.click('.cs-ptab[data-ptab="tests"]')
            kiem("the 'Bo test' khi chua co ca nao: co huong dan, nut 'Chay tat ca' bi khoa, the nhan an",
                 pg.locator(".cs-tempty").count() == 1 and pg.locator(".cs-thead .btn.run").is_disabled() and pg.locator('.cs-ptab[data-ptab="tests"] .n.t').is_hidden())
            for vao, ra in [("1 2", "3"), ("10 20", "30"), ("5 5", "11")]:
                them_test(pg, vao, ra)
            kiem("3 ca duoc ghi vao meta.tests (di cung doan ma), the nhan hien 3",
                 ev(pg, "() => (CS.app.S.item.meta.tests || []).map(c => c.input + '=>' + c.expected).join('|')") == "1 2=>3|10 20=>30|5 5=>11" and pg.locator('.cs-ptab[data-ptab="tests"] .n.t').inner_text() == "3")
            chon_noi_chay(pg, "browser")
            pg.click(".cs-thead .btn.run"); doi_bo_test(pg)
            v = phan_quyet(pg)
            kiem("chay tat ca: moi ca nhan DUNG stdin cua no -> AC, AC, WA (ca 3 mong doi 11, ra 10)", v == "AC,AC,WA", v)
            tom = pg.locator(".cs-tsum").inner_text()
            kiem("tom tat '2/3 dung' + the nhan 2/3 do + nut Dung an, nut Chay hien lai", "2/3 đúng" in tom and pg.locator('.cs-ptab[data-ptab="tests"] .n.t.bad').inner_text() == "2/3" and pg.locator(".cs-thead .btn.stop").is_hidden() and pg.locator(".cs-thead .btn.run").is_visible(), tom)
            ca3 = pg.locator(".cs-tc").nth(2)
            kiem("ca sai tu mo ra bang so dong: dong khac to mau, mong doi 11 / nhan 10", ca3.locator(".cs-diff tr.x").count() == 1 and ca3.locator(".cs-diff tr.x").inner_text().split()[-2:] == ["11", "10"], ca3.inner_text()[:200])
            ca3.locator('button:has-text("Dùng đầu ra này làm đáp án")').click()
            kiem("'Dung dau ra nay lam dap an': ca 3 thanh AC ngay (khong chay lai), meta.tests cap nhat, the nhan 3/3 xanh",
                 phan_quyet(pg) == "AC,AC,AC" and ev(pg, "() => CS.app.S.item.meta.tests[2].expected") == "10" and pg.locator('.cs-ptab[data-ptab="tests"] .n.t.ok').inner_text() == "3/3")
            pg.locator(".cs-tc").nth(0).locator("textarea").nth(1).fill("4")
            kiem("sua dap an -> cham lai NGAY khong can chay lai (ca 1 thanh WA)", phan_quyet(pg) == "WA,AC,AC" and "2/3 đúng" in pg.locator(".cs-tsum").inner_text())
            pg.locator(".cs-tc").nth(0).locator("textarea").nth(1).fill("3.0000001")
            pg.select_option(".cs-thead select", "float")
            kiem("doi cach so sanh sang 'so thuc': lech 1e-7 coi la dung ngay, luu meta.testMode", phan_quyet(pg) == "AC,AC,AC" and ev(pg, "() => CS.app.S.item.meta.testMode") == "float")
            pg.select_option(".cs-thead select", "lines")
            kiem("tro lai 'tung dong': WA lai, meta khong con testMode (mac dinh)", phan_quyet(pg) == "WA,AC,AC" and ev(pg, "() => 'testMode' in CS.app.S.item.meta") is False)
            pg.locator(".cs-tc").nth(0).locator("textarea").nth(1).fill("3")
            pg.locator(".cs-tc").nth(1).locator("textarea").nth(0).fill("7 8")
            kiem("sua du lieu vao cua mot ca: ket qua cu cua ca do bi bo (chua chay), ca khac giu nguyen", phan_quyet(pg) == "AC,NONE,AC", phan_quyet(pg))
            pg.locator(".cs-tc").nth(1).locator('button[aria-label^="Chạy test"]').click(); doi_bo_test(pg)
            kiem("chay rieng ca 2: chi ca do co ket qua moi (15 != 30 -> WA), cac ca khac khong doi", phan_quyet(pg) == "AC,WA,AC", phan_quyet(pg))
            thay_ma(pg, "while(true){}")
            pg.locator(".cs-tc").nth(0).locator('button[aria-label^="Chạy test"]').click(); doi_bo_test(pg, 30000)
            kiem("vong lap vo han: ca do la TLE (qua gio) sau ~2 giay, khong treo trang", phan_quyet(pg).split(",")[0] == "TLE", phan_quyet(pg))
            thay_ma(pg, "throw new Error('x');")
            pg.locator(".cs-tc").nth(0).locator('button[aria-label^="Chạy test"]').click(); doi_bo_test(pg)
            kiem("chuong trinh nem loi: RE kem noi dung loi", phan_quyet(pg).split(",")[0] == "RE" and "x" in pg.locator(".cs-tc").nth(0).locator(".cs-tc-err").first.inner_text(), pg.locator(".cs-tc").nth(0).inner_text()[:160])
            thay_ma(pg, "while(true){}")
            pg.click(".cs-thead .btn.run")
            pg.wait_for_selector(".cs-thead .btn.stop:not([hidden])")
            pg.click(".cs-thead .btn.stop")
            doi_bo_test(pg, 15000)
            kiem("bam Dung giua bo test: ca dang chay + cac ca sau deu 'Chua chay', het trang thai dang chay, nut Chay hien lai", phan_quyet(pg) == "SKIP,SKIP,SKIP" and ev(pg, "() => CS.app.S.running") is None and pg.locator('button[data-cmd="run"]').is_visible(), phan_quyet(pg))
            pg.click('[data-cmd="save"]')
            da_luu = 0
            for _ in range(40):                       # vong evaluate (wait_for_function async lam ket trang thu hai trong Edge headless)
                da_luu = ev(pg, "() => CS.app.Store.get(CS.app.S.item.id).then(x => ((x && x.meta.tests) || []).length)")
                if da_luu == 3:
                    break
                time.sleep(0.25)
            kiem("bo test duoc luu vao thu vien cung doan ma (Store.get)", da_luu == 3, str(da_luu))
            pg.locator(".cs-tc").nth(2).locator('button[aria-label^="Xoá test"]').click()
            kiem("xoa mot ca: con 2 ca, the nhan 2", pg.locator(".cs-tc").count() == 2 and pg.locator('.cs-ptab[data-ptab="tests"] .n.t').inner_text() == "2")
            pg.locator(".cs-tc").nth(0).locator('button[aria-label^="Nhân đôi"]').click()
            pg.wait_for_function("() => document.querySelectorAll('.cs-tc').length === 3")
            kiem("nhan doi ca: ban sao nam ngay sau ban goc, giu du lieu", ev(pg, "() => CS.app.S.item.meta.tests.map(c => c.name).join('|')").count("(bản sao)") == 1 and ev(pg, "() => CS.app.S.item.meta.tests[1].input") == ev(pg, "() => CS.app.S.item.meta.tests[0].input"))
            if chup:
                pg.screenshot(path=os.path.join(anh, "00-bo-test.png"))

            # ---------------- chay C++ tren may chu (local) + loi bien dich
            tao_doan_ma(pg, "cpp", "thu cpp may chu")
            chon_noi_chay(pg, "server:local")
            r = chay_va_doi(pg)
            kiem("chay C++ tren may chu (g++ that): 'Hello, World!'", "ok" in r["cls"] and "Hello, World!" in r["out"], str(r))
            thay_ma(pg, "int main() {\n    int x = ;\n    return y;\n}\n")
            r = chay_va_doi(pg)
            kiem("loi bien dich C++: bao 'Loi bien dich', co dau loi o le", "bad" in r["cls"] and "biên dịch" in r["label"] and pg.locator(".cse-gm.error").count() >= 1, str(r))
            pg.click('.cs-ptab[data-ptab="problems"]')
            kiem("tab 'Van de' liet ke loi, bam nhay toi dong", pg.locator(".cs-probs li").count() >= 1)
            pg.locator(".cs-probs li").first.click()
            pg.wait_for_function("() => CS.app.S.cursor && CS.app.S.cursor.line === 2")
            ok("bam loi nhay toi dong 2 trong trinh soan")
            if chup:
                pg.screenshot(path=os.path.join(anh, "01-loi-bien-dich.png"))

            # ---------------- AI giai thich loi. May chu that tat AI (AI_ENABLED=false) -> khong hien gi; roi dung may chu AI GIA (page.route),
            # KHONG BAO GIO goi Gemini that.
            pg.click('.cs-ptab[data-ptab="output"]')
            for _ in range(24):
                if ev(pg, "() => CS.app.ai.state.avail") is False:
                    break
                time.sleep(0.25)
            tat_ai = ev(pg, "() => CS.app.ai.state.avail") is False
            khong_nut = pg.locator('.cs-runst button:has-text("Giải thích bằng AI")').count() == 0
            pg.click('.cs-ptab[data-ptab="problems"]')
            kiem("may chu tat AI: tab Ket qua khong co nut 'Giai thich bang AI', tab Van de khong co the AI", tat_ai and khong_nut and pg.locator(".cs-ai").count() == 0)
            ai_goi, ai_tt, ai_che_do = [], {"allowed": False}, {"xss": False, "loi": False}

            def ai_gia(route, request):
                url = request.url.split("?")[0]
                if url.endswith("/ai/status"):
                    body = {"enabled": True, "allowed": ai_tt["allowed"], "needs": None if ai_tt["allowed"] else "code"}
                elif url.endswith("/ai/session"):
                    ai_goi.append(("session", request.post_data, ""))
                    ai_tt["allowed"] = True
                    body = {"session": "TOK-GIA", "expiresAt": int(time.time()) + 3600}
                elif url.endswith("/ai/code/explain"):
                    ai_goi.append(("explain", request.post_data, request.headers.get("x-ai-session", "")))
                    if ai_che_do["loi"]:
                        route.fulfill(status=429, headers={"Retry-After": "17"}, content_type="application/json",
                                      body=json.dumps({"status_code": 429, "message": "Quá nhiều lượt", "data": {"code": "ai_rate_limited", "retryAfter": 17}}))
                        return
                    body = {"summary": "Thiếu giá trị khởi tạo và biến y chưa khai báo.",
                            "items": [{"line": 2, "title": "<img src=x onerror=window.__xss=1>" if ai_che_do["xss"] else "Thiếu giá trị sau dấu =", "why": "Sau '=' phải có biểu thức. <b>đậm</b>", "fix": "Viết int x = 0;"},
                                      {"line": 3, "title": "y chưa khai báo", "why": "Biến y không tồn tại.", "fix": "Dùng x."}],
                            "patch": {"line": 2, "endLine": 3, "replacement": "    int x = 0;\n    return x;"}, "cached": False}
                else:
                    route.continue_()
                    return
                route.fulfill(status=200, content_type="application/json", body=json.dumps(body))
            pg.route("**/api/v1/ai/**", ai_gia)         # page.route (route cua context khong chan duoc fetch cua trang da mo tren WebKit)
            ev(pg, "() => { const s = CS.app.ai.state; s.avail = null; s.availAt = 0; s.client = null; }")      # coi nhu may chu vua bat AI
            pg.click('.cs-ptab[data-ptab="output"]')
            pg.wait_for_selector('.cs-runst button:has-text("Giải thích bằng AI")')
            ok("may chu bat AI: dong trang thai o tab Ket qua co nut 'Giai thich bang AI' sau lan chay loi")
            pg.click('.cs-runst button:has-text("Giải thích bằng AI")')
            pg.wait_for_selector(".cs-ai-unlock input")
            kiem("AI can ma truy cap: tab Van de hien o nhap ma, CHUA goi explain", not any(g[0] == "explain" for g in ai_goi))
            pg.fill(".cs-ai-unlock input", "ma-gia")
            pg.click('.cs-ai-unlock button[type="submit"]')
            pg.wait_for_selector(".cs-ai-items li")
            goi = [g for g in ai_goi if g[0] == "explain"]
            yc = json.loads(goi[0][1]) if goi else {}
            kiem("mo khoa xong tu dong hoi AI: token phien di kem header; yeu cau dung hop dong (cpp, compile, ma hien tai, chan doan)",
                 len(goi) == 1 and goi[0][2] == "TOK-GIA" and sorted(yc) == ["code", "diagnostics", "filename", "kind", "language", "stderr"] and yc["language"] == "cpp" and yc["kind"] == "compile" and yc["code"] == gt(pg) and len(yc["diagnostics"]) >= 1 and yc["filename"].endswith(".cpp"), str(yc)[:200])
            kiem("ket qua: tom tat + 2 muc co nut 'dong N' + de xuat sua hien dang so sanh (2 dong cu, 2 dong moi)",
                 pg.locator(".cs-ai-sum").count() == 1 and pg.locator(".cs-ai-items li").count() == 2 and pg.locator(".cs-ai-items .chip").count() == 2 and pg.locator(".cs-ai-diff .del").count() == 2 and pg.locator(".cs-ai-diff .add").count() == 2)
            pg.locator(".cs-ai-items .chip").first.click()
            pg.wait_for_function("() => CS.app.S.cursor && CS.app.S.cursor.line === 2")
            ok("bam 'dong 2' trong ket qua AI nhay toi dong 2 cua trinh soan")
            truoc = gt(pg)
            pg.click('.cs-ai-patch button:has-text("Áp dụng đề xuất")')
            sau = gt(pg)
            kiem("Ap dung de xuat: dong 2-3 duoc thay dung, cac dong khac nguyen", sau == "int main() {\n    int x = 0;\n    return x;\n}\n", repr(sau))
            kiem("sau khi ap: dau loi cu bi xoa, the AI bao 'Da ap dung' va het nut Ap dung", ev(pg, "() => CS.app.S.diags.length") == 0 and pg.locator(".cs-ai .cs-tc-ok").count() == 1 and pg.locator('.cs-ai-patch button:has-text("Áp dụng đề xuất")').count() == 0)
            pg.focus(".cse-ta"); pg.keyboard.press("Control+z")
            kiem("Ctrl+Z hoan tac de xuat AI trong MOT buoc (tra ma cu)", gt(pg) == truoc)
            pg.click('.cs-ai-h button:has-text("Hỏi lại")')
            pg.wait_for_selector('.cs-ai-patch button:has-text("Áp dụng đề xuất")')
            goc = gt(pg)
            thay_ma(pg, goc + "// them\n")
            pg.click('.cs-ai-patch button:has-text("Áp dụng đề xuất")')
            kiem("ma da doi tu luc hoi AI: KHONG ap de xuat (ma giu nguyen) va co thong bao", gt(pg) == goc + "// them\n" and pg.locator(".cs-toast", has_text="Mã đã đổi").count() >= 1)
            ai_che_do["xss"] = True
            thay_ma(pg, goc + "// v2\n")
            pg.click('.cs-ai-h button:has-text("Hỏi lại")')
            pg.wait_for_function("() => /<img/.test(document.querySelector('.cs-ai-items')?.textContent || '')")
            kiem("chuoi AI tra ve chua HTML chi hien nhu chu: khong chen the <img>/<b>, khong chay script",
                 pg.locator(".cs-ai-items li img, .cs-ai-items li b, .cs-ai img").count() == 0 and ev(pg, "() => window.__xss") is None and "<b>đậm</b>" in pg.locator(".cs-ai-items li").first.inner_text())
            ai_che_do["loi"] = True
            thay_ma(pg, goc + "// v3\n")
            pg.click('.cs-ai-h button:has-text("Hỏi lại")')
            pg.wait_for_selector(".cs-ai .cs-tc-bad")
            kiem("het luot (429): the AI bao ro 'thu lai sau 17 giay', co nut Thu lai, khong ap gi", "17 giây" in pg.locator(".cs-ai .cs-tc-bad").inner_text() and pg.locator('.cs-ai-h button:has-text("Thử lại")').count() == 1 and gt(pg) == goc + "// v3\n")
            thay_ma(pg, goc)
            pg.evaluate("() => { CS.app.ai.reset(true); }")

            # ---------------- bo test tren may chu (g++ that): loi bien dich dung ca bo, roi ca dung
            pg.click('.cs-ptab[data-ptab="tests"]')
            them_test(pg, "1 2", "3"); them_test(pg, "4 5", "9")
            pg.click(".cs-thead .btn.run"); doi_bo_test(pg, 90000)
            kiem("loi bien dich: ca 1 la CE, ca 2 bi bo qua (khong bien dich lai tung ca)", phan_quyet(pg) == "CE,SKIP", phan_quyet(pg))
            kiem("CE dua chan doan len the 'Van de' va co nut mo the do", ev(pg, "() => CS.app.S.diags.length") >= 1 and pg.locator('.cs-tc button:has-text("Xem ở thẻ Vấn đề")').count() == 1)
            thay_ma(pg, '#include <iostream>\nint main() { int a, b; std::cin >> a >> b; std::cout << a + b << "\\n"; }\n')
            pg.click('[data-cmd="palette"]'); pg.fill(".cs-pal input", "Chạy bộ test"); pg.keyboard.press("Enter")
            pg.wait_for_function("() => !!CS.app.S.running")
            doi_bo_test(pg, 90000)
            tom = pg.locator(".cs-tsum").inner_text()
            kiem("lenh 'Chay bo test' (bang lenh): g++ that, moi ca nhan stdin rieng -> AC, AC, tom tat 2/2 dung", phan_quyet(pg) == "AC,AC" and "2/2 đúng" in tom and pg.locator('.cs-ptab[data-ptab="tests"] .n.t.ok').inner_text() == "2/2", phan_quyet(pg) + " | " + tom)

            # ---------------- du an C++ nhieu tep
            pg.click('[data-cmd="palette"]'); pg.fill(".cs-pal input", "Dự án mới"); pg.keyboard.press("Enter")
            pg.wait_for_selector("dialog.cs-dlg .cs-tpl")
            pg.locator("dialog.cs-dlg .cs-tpl button", has_text="C++ · nhiều tệp").first.click()
            pg.fill("dialog.cs-dlg input", "du an cpp")
            pg.click("dialog.cs-dlg button:has-text('Tạo dự án')")
            pg.wait_for_selector("dialog.cs-dlg", state="detached")
            pg.wait_for_function("() => CS.app.S.item && CS.app.S.item.kind === 'project' && CS.app.S.item.files.length >= 3")
            n_tep = ev(pg, "() => CS.app.S.item.files.length")
            kiem("du an C++ nhieu tep: cay tep hien thu muc + tep (%d tep)" % n_tep, pg.locator(".cs-tree .cs-node").count() >= n_tep, pg.locator(".cs-tree .cs-node").count())
            chon_noi_chay(pg, "server:local")
            r = chay_va_doi(pg)
            kiem("chay du an C++ nhieu tep (bien dich moi .cpp + header) tren may chu: thanh cong", "ok" in r["cls"] and len(r["out"].strip()) > 0, str(r))
            if pg.locator('.cs-act [data-side="explorer"][aria-pressed="false"]').count():
                pg.click('.cs-act [data-side="explorer"]')
            pg.locator('.cs-shead .acts button[title^="Tệp mới"]').click()
            pg.fill("dialog.cs-dlg input", "src/extra.cpp")
            pg.click("dialog.cs-dlg button:has-text('Tạo')")
            pg.wait_for_selector("dialog.cs-dlg", state="detached")
            pg.wait_for_function("() => CS.app.S.item.files.some(f => f.path === 'src/extra.cpp') && CS.app.S.active === 'src/extra.cpp'")
            ok("tao tep moi src/extra.cpp trong du an, mo thanh tep")
            pg.locator('.cs-node[data-path="src/extra.cpp"]').press("F2")
            pg.fill("dialog.cs-dlg input", "src/phu.cpp")
            pg.click("dialog.cs-dlg button:has-text('Đổi')")
            pg.wait_for_selector("dialog.cs-dlg", state="detached")
            kiem("doi ten tep (F2) cap nhat cay + thanh tep", ev(pg, "() => CS.app.S.item.files.some(f => f.path === 'src/phu.cpp') && !CS.app.S.item.files.some(f => f.path === 'src/extra.cpp') && CS.app.S.tabs.indexOf('src/phu.cpp') >= 0"))
            pg.locator('.cs-node[data-path="src/phu.cpp"]').press("Delete")
            pg.click("dialog.cs-dlg button:has-text('Xoá')")
            pg.wait_for_selector("dialog.cs-dlg", state="detached")
            kiem("xoa tep (Delete) co hoi xac nhan", not ev(pg, "() => CS.app.S.item.files.some(f => f.path === 'src/phu.cpp')"))
            if chup:
                pg.screenshot(path=os.path.join(anh, "02-du-an-cpp.png"))

            # ---------------- du an Java co package
            pg.click('[data-cmd="palette"]'); pg.fill(".cs-pal input", "Dự án mới"); pg.keyboard.press("Enter")
            pg.wait_for_selector("dialog.cs-dlg .cs-tpl")
            pg.locator("dialog.cs-dlg .cs-tpl button", has_text="Java · có package").first.click()
            pg.click("dialog.cs-dlg button:has-text('Tạo dự án')")
            pg.wait_for_selector("dialog.cs-dlg", state="detached")
            pg.wait_for_function("() => CS.app.S.item && CS.app.S.item.language === 'java' && CS.app.S.item.files.length >= 2")
            chon_noi_chay(pg, "server:local")
            r = chay_va_doi(pg, 90000)
            kiem("chay du an Java co package (javac + java) tren may chu: thanh cong", "ok" in r["cls"] and len(r["out"].strip()) > 0, str(r))

            # ---------------- thu vien
            pg.click('.cs-act [data-side="library"]')
            pg.wait_for_selector(".cs-item")
            n_muc = pg.locator(".cs-item").count()
            kiem("thu vien liet ke %d doan ma/du an" % n_muc, n_muc >= 5)
            pg.fill('.cs-sbody input[type="search"]', "thu js")
            pg.wait_for_function("() => document.querySelectorAll('.cs-item').length === 1")
            ok("tim trong thu vien theo ten loc con 1 muc")
            pg.fill('.cs-sbody input[type="search"]', "")
            pg.wait_for_function("() => document.querySelectorAll('.cs-item').length >= 5")
            pg.locator(".cs-item", has_text="thu js").first.click(button="right")
            pg.locator(".cs-menu button", has_text="Ghim").click()
            pg.wait_for_timeout(400)
            kiem("ghim len dau thu vien", "thu js" in pg.locator(".cs-item .t").first.inner_text())

            # ---------------- zip: xuat va nhap lai
            pg.locator(".cs-item", has_text="du an cpp").first.click()
            pg.wait_for_function("() => CS.app.S.item.name === 'du an cpp'")
            n0 = ev(pg, "() => CS.app.S.item.files.length")
            id0 = ev(pg, "() => CS.app.S.item.id")
            noi_dung0 = ev(pg, "() => JSON.stringify(CS.app.S.item.files.map(f => [f.path, f.content]).sort())")
            pg.click('[data-cmd="more"]')
            with pg.expect_download() as d:
                pg.locator(".cs-menu button", has_text="Xuất dự án").click()
            duong = os.path.join(may.tmp, "xuat.zip"); d.value.save_as(duong)
            kiem("xuat .zip: tep co chu ky PK, kich thuoc > 200 B", open(duong, "rb").read(4) == b"PK\x03\x04" and os.path.getsize(duong) > 200)
            pg.click('[data-cmd="more"]')
            with pg.expect_file_chooser() as fc:
                pg.locator(".cs-menu button", has_text="Nhập .zip").click()
            fc.value.set_files(duong)
            pg.wait_for_function("i => CS.app.S.item && CS.app.S.item.id !== i", arg=id0, timeout=15000)
            noi_dung1 = ev(pg, "() => JSON.stringify(CS.app.S.item.files.map(f => [f.path, f.content]).sort())")
            kiem("nhap lai .zip: du an moi (id khac) co du %d tep, noi dung tung tep giong het" % n0, noi_dung1 == noi_dung0 and ev(pg, "() => CS.app.S.item.files.length") == n0)

            # ---------------- dong bo giua hai thiet bi (kho json THAT)
            pg.click('.cs-status [data-cmd="storage"]')
            pg.wait_for_selector("dialog.cs-dlg select")
            pg.locator("dialog.cs-dlg select").first.select_option("server")
            pg.locator("dialog.cs-dlg button:has-text('Tạo không gian mới')").click()
            pg.wait_for_selector("dialog.cs-dlg pre")
            thong_tin = pg.locator("dialog.cs-dlg pre").inner_text()
            m = re.search(r"Mã không gian:\s*(\S+)\s+Khoá bí mật:\s*(\S+)", thong_tin)
            kiem("tao khong gian dong bo: nhan ma + khoa bi mat", bool(m), thong_tin[:80])
            ws, kh = (m.group(1), m.group(2)) if m else ("", "")
            pg.click("dialog.cs-dlg button:has-text('Đã lưu')")
            pg.wait_for_selector("dialog.cs-dlg", state="detached")
            pg.wait_for_function("() => { const s = CS.app.Store.sync; return s && s.status === 'idle' && s.isConnected() && CS.app.Store.lib.dirty().length === 0 }", timeout=30000)
            ok("thiet bi A da day het muc len may chu (kho JSON): khong con muc chua dong bo")
            # thiet bi B: ngu canh moi
            ctx2 = br.new_context(viewport={"width": 1280, "height": 860})
            pb = ctx2.new_page(); pb.set_default_timeout(20000)
            pb.on("pageerror", lambda e: loi_console.append("[B] pageerror: " + str(e)[:200]))
            pb.goto(may.goc); pb.wait_for_selector(".cse-ta")
            pb.click('.cs-status [data-cmd="storage"]')
            try:
                pb.wait_for_selector("dialog.cs-dlg select")
            except Exception:
                print("    [chan doan B]", ev(pb, "() => ({booted: !!CS.app.booted, dlgs: [...document.querySelectorAll('dialog')].map(d => d.open + ':' + d.innerText.slice(0, 60)), toasts: [...document.querySelectorAll('.cs-toast')].map(t => t.textContent), status: document.querySelector('.cs-status').innerText.replace(/\\n/g, ' | '), mode: CS.app.S.settings.storage.mode})"))
                raise
            pb.locator("dialog.cs-dlg select").first.select_option("server")
            pb.fill('dialog.cs-dlg input[aria-label="Mã không gian làm việc"]', ws)
            pb.fill('dialog.cs-dlg input[aria-label="Khoá bí mật"]', kh)
            pb.locator("dialog.cs-dlg button:has-text('Kết nối mã + khoá')").click()
            pb.wait_for_selector("dialog.cs-dlg", state="detached", timeout=30000)
            n_a = ev(pg, "async () => (await CS.app.Store.list()).length")
            for _ in range(40):                       # vong lap don gian (wait_for_function voi ham bat dong bo lam ket trang o dau Edge headless)
                n_b = ev(pb, "() => CS.app.Store.lib.listSync().length")
                if n_b >= n_a:
                    break
                pb.wait_for_timeout(500)
            kiem("thiet bi B ket noi bang ma + khoa: nhan du %d muc cua A" % n_a, n_b >= n_a, "%s vs %s" % (n_b, n_a))
            # B doi ten mot muc, dong bo; A dong bo ve
            ev(pb, "async () => { const it = (await CS.app.Store.list()).filter(x => x.name === 'thu js')[0]; it.name = 'thu js (B sua)'; await CS.app.Store.put(it); await CS.app.Store.sync.syncNow(); }")
            ev(pg, "async () => { await CS.app.Store.sync.syncNow(); }")
            ten_a = ev(pg, "async () => (await CS.app.Store.list()).map(x => x.name)")
            kiem("A sua o B (doi ten) hoi tu ve A sau khi dong bo", "thu js (B sua)" in ten_a, str(ten_a[:6]))
            # A xoa, B nhan bia mo
            ev(pg, "async () => { const it = (await CS.app.Store.list()).filter(x => x.name === 'thu cpp may chu')[0]; await CS.app.Store.remove(it.id); await CS.app.Store.sync.syncNow(); }")
            ev(pb, "async () => { await CS.app.Store.sync.syncNow(); }")
            ten_b = ev(pb, "async () => (await CS.app.Store.list()).map(x => x.name)")
            kiem("A xoa -> bia mo lan sang B", "thu cpp may chu" not in ten_b)
            ctx2.close()

            # ---------------- chia se lien ket CHI DOC: tao (A) -> xem o ngu canh an danh (khong khoa) -> nhan ban -> cap nhat -> thu hoi
            ten_goc = ev(pg, "() => CS.app.S.item.name")
            id_goc = ev(pg, "() => CS.app.S.item.id")
            noi_dung_goc = ev(pg, "() => JSON.stringify(CS.app.S.item.files.map(f => [f.path, f.content]).sort())")
            pg.click('[data-cmd="palette"]'); pg.fill(".cs-pal input", "Chia sẻ liên kết"); pg.keyboard.press("Enter")
            pg.wait_for_selector('dialog.cs-dlg button:has-text("Tạo liên kết chỉ đọc")')
            pg.click('dialog.cs-dlg button:has-text("Tạo liên kết chỉ đọc")')
            pg.wait_for_selector("dialog.cs-dlg .cs-shd-link input")
            lk = pg.locator("dialog.cs-dlg .cs-shd-link input").input_value()
            m_lk = re.search(r"#share=([A-Za-z0-9_-]{16,})&backend=json$", lk)
            kiem("chia se: hop thoai tao lien ket co token chi o SAU dau #, kem kho json", bool(m_lk) and "?" not in lk and lk.split("#")[0].find(m_lk.group(1)) < 0 if m_lk else False, lk)
            tok = m_lk.group(1) if m_lk else ""
            pg.keyboard.press("Escape")
            pg.wait_for_selector("dialog.cs-dlg", state="detached")
            with urllib.request.urlopen(may.api + "/codestore/shared/" + tok + "?backend=json", timeout=10) as r_lk:
                cong_khai = json.loads(r_lk.read().decode("utf-8")); tieu_de = r_lk.headers.get("Cache-Control", "")
            kiem("API cong khai (khong khoa) tra ban chup, Cache-Control no-store, khong lo khoa/ma khong gian", cong_khai["item"]["name"] == ten_goc and "no-store" in tieu_de and kh not in json.dumps(cong_khai) and ws not in json.dumps(cong_khai), tieu_de)

            ctx3 = br.new_context(viewport={"width": 1280, "height": 860})
            pv = ctx3.new_page(); pv.set_default_timeout(20000)
            yc_codestore = []
            pv.on("request", lambda rq: yc_codestore.append((rq.method, rq.url.split("/codestore/")[1].split("?")[0][:12], "x-codestore-key" in {k.lower() for k in rq.headers})) if "/codestore/" in rq.url else None)
            pv.on("pageerror", lambda e: loi_console.append("[xem] pageerror: " + str(e)[:200]))
            pv.goto(lk); pv.wait_for_selector(".cs-sh-ed .cse-ta")
            kiem("trang xem: tieu de = ten muc, chi hien thi (khong dung IDE), co chip 'Chi doc'", pv.locator(".cs-sh-t").inner_text() == ten_goc and pv.locator(".cs-top").count() == 0 and "Chỉ đọc" in pv.locator(".cs-sh-m").inner_text())
            ro = ev(pv, "() => document.querySelector('.cs-sh-ed .cse-ta').readOnly")
            truoc_xem = ev(pv, "() => document.querySelector('.cs-sh-ed .cse-ta').value")
            pv.click(".cs-sh-ed .cse-ta"); pv.keyboard.type("zzz"); pv.keyboard.press("Backspace")
            kiem("trang xem: o soan CHI DOC, go phim khong doi noi dung, co to mau cu phap", ro is True and ev(pv, "() => document.querySelector('.cs-sh-ed .cse-ta').value") == truoc_xem and pv.locator(".cs-sh-ed .cse-hl i").count() > 0)
            if pv.locator(".cs-sh-tab").count() > 1:
                pv.locator(".cs-sh-tab").nth(1).click()
                kiem("du an nhieu tep: bam the tep doi noi dung o soan, van chi doc", ev(pv, "() => document.querySelector('.cs-sh-ed .cse-ta').value") != truoc_xem and ev(pv, "() => document.querySelector('.cs-sh-ed .cse-ta').readOnly") is True)
            luu_tru = ev(pv, "() => ({ls: Object.keys(localStorage), ss: Object.keys(sessionStorage)})")
            kiem("nguoi xem khong bi ghi gi vao localStorage/sessionStorage (khong thu vien, khong cai dat)", luu_tru["ls"] == [] and luu_tru["ss"] == [], str(luu_tru))
            kiem("chi 1 loi goi /codestore/: GET .../shared/<token>, KHONG kem khoa (khong cham khong gian)", len(yc_codestore) == 1 and yc_codestore[0][0] == "GET" and yc_codestore[0][1].startswith("shared/") and yc_codestore[0][2] is False, str(yc_codestore))
            if chup:
                pv.screenshot(path=os.path.join(anh, "05-xem-chia-se.png"))
            pv.click('button:has-text("Nhân bản về thư viện của tôi")')
            pv.wait_for_function("() => typeof CS !== 'undefined' && CS.app && CS.app.S && CS.app.S.item && /bản chia sẻ/.test(CS.app.S.item.name)")        # trang vua tai lai: CS co the chua co
            kiem("nhan ban: IDE day du mo ban sao MOI (id khac, ten them '(ban chia se)'), dung noi dung, dia chi het #",
                 ev(pv, "() => CS.app.S.item.id") != id_goc and ev(pv, "() => CS.app.S.item.name") == ten_goc + " (bản chia sẻ)" and ev(pv, "() => JSON.stringify(CS.app.S.item.files.map(f => [f.path, f.content]).sort())") == noi_dung_goc and ev(pv, "() => location.hash") == "")
            pv.wait_for_timeout(300)
            pv.reload(); pv.wait_for_selector(".cse-ta")
            kiem("sau khi tai lai KHONG nhan ban them lan nua (thu vien cua nguoi xem co dung 1 ban sao)", ev(pv, "async () => (await CS.app.Store.list()).filter(x => /bản chia sẻ/.test(x.name)).length") == 1)

            # chu doi ten roi 'Cap nhat ban chia se': lien ket GIU NGUYEN, nguoi xem thay ban moi
            pg.fill(".cs-title", ten_goc + " v2"); pg.keyboard.press("Tab")
            pg.click('[data-cmd="palette"]'); pg.fill(".cs-pal input", "Chia sẻ liên kết"); pg.keyboard.press("Enter")
            pg.wait_for_selector('dialog.cs-dlg button:has-text("Cập nhật bản chia sẻ")')
            lk2 = pg.locator("dialog.cs-dlg .cs-shd-link input").input_value()
            pg.click('dialog.cs-dlg button:has-text("Cập nhật bản chia sẻ")')
            pg.wait_for_selector('dialog.cs-dlg button:has-text("Cập nhật bản chia sẻ"):not([disabled])')
            pv2 = ctx3.new_page(); pv2.set_default_timeout(20000)
            pv2.goto(lk); pv2.wait_for_selector(".cs-sh-t")
            kiem("cap nhat ban chia se: lien ket giu nguyen, nguoi xem thay ten moi", lk2 == lk and pv2.locator(".cs-sh-t").inner_text() == ten_goc + " v2", pv2.locator(".cs-sh-t").inner_text())
            pv2.close()

            # thu hoi
            pg.click('dialog.cs-dlg button:has-text("Thu hồi liên kết")')
            pg.click('dialog.cs-dlg button:has-text("Thu hồi"):not(:has-text("liên kết"))')
            pg.wait_for_selector('dialog.cs-dlg button:has-text("Tạo liên kết chỉ đọc")')
            pg.keyboard.press("Escape")
            try:
                urllib.request.urlopen(may.api + "/codestore/shared/" + tok + "?backend=json", timeout=10)
                code_sau = 200
            except urllib.error.HTTPError as e_http:
                code_sau = e_http.code
            pv3 = ctx3.new_page(); pv3.set_default_timeout(20000)
            pv3.goto(lk); pv3.wait_for_selector(".cs-sh-note.bad")
            kiem("thu hoi: API tra 404, trang xem bao 'khong ton tai/da thu hoi' va KHONG hien ma", code_sau == 404 and "thu hồi" in pv3.locator(".cs-sh-note").inner_text() and pv3.locator(".cs-sh-ed .cse-ta").count() == 0)
            ctx3.close()

            # ---------------- PWA: service worker luu app, API khong bi cache, mo lai duoc khi mat mang (ngu canh moi => dang ky moi)
            ctxp = br.new_context(viewport={"width": 1280, "height": 860})
            pw_ = ctxp.new_page(); pw_.set_default_timeout(25000)
            pw_.on("pageerror", lambda e: loi_console.append("[pwa] pageerror: " + str(e)[:200]))
            pw_.goto(may.goc); pw_.wait_for_function("() => CS.app.booted && CS.app.S.item")
            pw_.evaluate("() => navigator.serviceWorker.ready.then(() => true)")
            pw_.wait_for_function("() => caches.keys().then(ks => ks.some(k => k.startsWith('codestudio:')))")
            info = ev(pw_, "async () => { const k = (await caches.keys()).filter(x => x.startsWith('codestudio:'))[0]; const c = await caches.open(k); const urls = (await c.keys()).map(r => new URL(r.url).pathname); return {n: urls.length, urls: urls, has: !!(await c.match(location.pathname)), scope: (await navigator.serviceWorker.ready).scope}; }")
            nho = [u for u in info["urls"] if "/api/" in u]
            html_ = io.open(os.path.join(HERE, "index.html"), encoding="utf-8").read()
            can = set(re.findall(r'(?:src|href)="(assets/[^"]+)"', html_)) | {"manifest.webmanifest"}
            goc_ = "/webapp/tranphuc8a/code-studio/"
            thieu_ = sorted(p for p in can if goc_ + p not in info["urls"])
            kiem("PWA: service worker dang ky, luu %d tep gom MOI tep index.html nhac toi + manifest, khong tep /api/ nao" % info["n"], info["has"] and not thieu_ and not nho and info["scope"].endswith("/code-studio/") and len(can) >= 20, "thieu=%s api=%s" % (thieu_[:3], nho[:2]))
            kiem("PWA: <link rel=manifest> + theme-color + apple-touch-icon co trong trang", ev(pw_, "() => !!document.querySelector('link[rel=manifest]') && !!document.querySelector('meta[name=theme-color]') && !!document.querySelector('link[rel=apple-touch-icon]')"))
            pw_.evaluate("async () => { await CS.app.Store.put(CS.project.createSnippet({name: 'chi co offline', language: 'python', content: 'print(1)\\n'})); }")
            if "--trinh-duyet=webkit" in sys.argv:
                bo_qua("PWA offline + reload: Playwright-WebKit khong ho tro set_offline + reload (kiem tren Edge/Firefox)")
            else:
                ctxp.set_offline(True)
                pw_.reload()
                pw_.wait_for_selector(".cse-ta")
                pw_.wait_for_function("() => CS.app.booted && CS.app.S.item")
                ten_off = ev(pw_, "async () => (await CS.app.Store.list()).map(x => x.name)")
                kiem("PWA: mat mang van mo lai duoc Code Studio, du lieu cuc bo (IndexedDB) con nguyen", "chi co offline" in ten_off, str(ten_off[:5]))
                pw_.evaluate("() => { document.querySelector('[data-cmd=sidebar]'); }")
                r_off = ev(pw_, "() => { CS.app.S.settings.run.target.javascript = 'browser'; return true; }")
                tao_doan_ma(pw_, "javascript", "off js")
                thay_ma(pw_, "print('chay offline: ' + (6 * 7))")
                chon_noi_chay(pw_, "browser")
                r = chay_va_doi(pw_)
                kiem("PWA: mat mang chay JavaScript trong trinh duyet van duoc", "ok" in r["cls"] and "chay offline: 42" in r["out"], str(r))
                ctxp.set_offline(False)
            ctxp.close()

            # ---------------- giao dien sang/toi + dien thoai
            ev(pg, "() => document.documentElement.setAttribute('data-theme', 'dark')")
            pg.wait_for_timeout(100)
            bg = ev(pg, "() => getComputedStyle(document.body).backgroundColor")
            kiem("giao dien toi: nen toi", bool(re.match(r"rgb\((\d+), (\d+), (\d+)\)", bg)) and sum(int(x) for x in re.findall(r"\d+", bg)[:3]) < 200, bg)
            if chup:
                pg.screenshot(path=os.path.join(anh, "03-toi.png"))
            ev(pg, "() => document.documentElement.removeAttribute('data-theme')")
            ctxm = br.new_context(viewport={"width": 390, "height": 800}, has_touch=True, is_mobile=True)
            pm = ctxm.new_page(); pm.set_default_timeout(20000)
            pm.on("pageerror", lambda e: loi_console.append("[mobile] pageerror: " + str(e)[:200]))
            pm.goto(may.goc); pm.wait_for_selector(".cse-ta")
            # body an cuon nen do truc tiep: vung lam viec / thanh tren / bang duoi khong duoc rong hon man hinh
            tran = ev(pm, "() => Math.max(...['.cs-app', '.cs-top', '.cs-work', '.cs-center', '.cs-edwrap', '.cs-panel'].map(s => document.querySelector(s).scrollWidth)) - window.innerWidth")
            nut_het = ev(pm, "() => [...document.querySelectorAll('.cs-top button.ic, .cs-top button.btn')].filter(b => b.offsetParent).every(b => b.getBoundingClientRect().right <= window.innerWidth + 1)")
            kiem("dien thoai 390 px: khong tran ngang (%+d px), moi nut thanh tren nam trong man hinh" % tran, tran <= 1 and nut_het)
            kiem("dien thoai: nut Chay hien, hang phim ky hieu duoi o soan", pm.locator('button[data-cmd="run"]').is_visible() and pm.locator(".cse-keys button").count() >= 10 and pm.locator(".cse-keys").first.is_visible())
            pm.click('[data-cmd="drawer"]')
            kiem("dien thoai: nut menu mo thanh ben (ngan keo)", pm.locator(".cs-work.drawer .cs-side").count() == 1)
            vung = ev(pm, "() => { const r = document.querySelector('button[data-cmd=run]').getBoundingClientRect(); return Math.min(r.width, r.height); }")
            kiem("dien thoai: vung cham nut Chay >= 34 px (%.0f)" % vung, vung >= 34)
            pm.click(".cs-drawer-bg", position={"x": 375, "y": 400})                      # dong ngan keo
            pm.click('.cs-ptab[data-ptab="tests"]')
            pm.click('.cs-thead button:has-text("+ Thêm test")')
            pm.locator(".cs-tc textarea").first.fill("x" * 200 + "\n" + "y" * 100)
            tran2 = ev(pm, "() => Math.max(...['.cs-app', '.cs-center', '.cs-panel', '.cs-thead', '.cs-tc'].map(s => document.querySelector(s).scrollWidth)) - window.innerWidth")
            cot = ev(pm, "() => getComputedStyle(document.querySelector('.cs-tc-io')).gridTemplateColumns.split(' ').length")
            nut_thap = ev(pm, "() => Math.min(...[...document.querySelectorAll('.cs-thead .btn, .cs-tc .btn')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect().height))")
            kiem("dien thoai: the 'Bo test' khong tran ngang (%+d px), dau vao/dap an xep 1 cot (%d), nut cham >= 34 px (%.0f)" % (tran2, cot, nut_thap), tran2 <= 1 and cot == 1 and nut_thap >= 34)
            if chup:
                pm.screenshot(path=os.path.join(anh, "04-dien-thoai.png"))
            ctxm.close()

            if wasm:
                tang_wasm(pg, may, chup, anh)

            # 1 dong "429" la CO CHU Y: may chu AI gia tra 429 de thu duong loi het luot; Chrome ghi moi phan hoi loi vao console
            loi_that = [l for l in loi_console if not re.search(r"status of 429", l)]
            kiem("khong co loi console / pageerror (ca 3 ngu canh)", not loi_that, "; ".join(loi_that[:4]))
            ctx.close(); br.close()
    finally:
        may.dong()


def tang_wasm(pg, may, chup, anh):
    print("\nTANG 3 - chay TRONG TRINH DUYET: Python (Pyodide) + C++ (Clang-WASM)  [can mang toi jsDelivr]")
    pg.set_default_timeout(280000)
    tao_doan_ma(pg, "python", "thu py")
    chon_noi_chay(pg, "browser")
    thay_ma(pg, "import sys\nn = int(sys.stdin.read())\nprint('binh phuong =', n * n)")
    pg.click('.cs-ptab[data-ptab="input"]'); pg.fill('textarea[aria-label^="Dữ liệu vào"]', "12")
    pg.click('button[data-cmd="run"]')
    pg.wait_for_selector("dialog.cs-dlg button:has-text('Tải')")
    pg.click("dialog.cs-dlg button:has-text('Tải')")
    pg.wait_for_function("() => !!document.querySelector('.cs-runst .pill.ok, .cs-runst .pill.bad')", timeout=280000)
    out = ev(pg, "() => document.querySelector('.cs-out').textContent + ' || ' + document.querySelector('.cs-runst').innerText.replace(/[\\r\\n]+/g, ' ')")
    kiem("Python (Pyodide) trong trinh duyet: stdin 12 -> 'binh phuong = 144'", "binh phuong = 144" in out, out[:120])
    tao_doan_ma(pg, "cpp", "thu cpp wasm")
    chon_noi_chay(pg, "browser")
    thay_ma(pg, '#include <bits/stdc++.h>\nint main() { int a, b; scanf("%d %d", &a, &b); printf("tong=%d\\n", a + b); return 0; }')
    pg.click('.cs-ptab[data-ptab="input"]'); pg.fill('textarea[aria-label^="Dữ liệu vào"]', "40 2")
    pg.click('button[data-cmd="run"]')
    pg.wait_for_selector("dialog.cs-dlg button:has-text('Tải')")
    pg.click("dialog.cs-dlg button:has-text('Tải')")
    pg.wait_for_function("() => !!document.querySelector('.cs-runst .pill.ok, .cs-runst .pill.bad')", timeout=280000)
    out = ev(pg, "() => document.querySelector('.cs-out').textContent + ' || ' + document.querySelector('.cs-runst').innerText.replace(/[\\r\\n]+/g, ' ')")
    kiem("C++ (Clang-WASM) trong trinh duyet: 'tong=42'", "tong=42" in out, out[:120])


def main():
    tinh_thoi = "--tinh" in sys.argv
    tang_tinh()
    if not tinh_thoi:
        tang_trinh_duyet("--anh" in sys.argv, "--wasm" in sys.argv)
    print("\n" + "=" * 60)
    print("Dat %d - SAI %d - BO QUA %d" % (len(dat), len(hong), len(bo)))
    return 1 if hong else 0


if __name__ == "__main__":
    sys.exit(main())
