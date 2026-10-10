#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kiem tra trang Thuc hanh Heuristic (courses/heuristic-practice-2). Khong can FastAPI: trang tinh, mo bang may chu http tam.

    python check.py --tinh     # tinh: tep, <script>, metadata, cu phap JS, node kiem.js (logic + noi dung + lab)
    python check.py            # + trinh duyet that (Edge, roi Chromium): trac nghiem, tu luan, ghi chu, lab JS (Web Worker),
                               #   IDE JavaScript, sao luu, giao dien sang/toi, dien thoai 390 px
    python check.py --cpp      # + bien dich C++ THAT bang Clang-WASM (lan dau tai ~25 MB tu jsDelivr, vai phut)
    python check.py --chi-cpp  # chi tang C++ that (lap lai nhanh khi sua cpp.js / lab C++)
    python check.py --anh      # chup anh vao _shots/

Dung python cua backend/fastapi/.venv (co playwright). Thoat 1 neu co muc SAI.
"""
import functools
import http.server
import io
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time

HERE = os.path.dirname(os.path.abspath(__file__))
os.environ.setdefault("PYTHONUTF8", "1")

dat, hong, bo = [], [], []


def ok(m):
    dat.append(m); print("  [ok]  " + m)


def sai(m):
    hong.append(m); print("  [SAI] " + m)


def bo_qua(m):
    bo.append(m); print("  [--]  " + m)


def kiem(ten, dk, chi_tiet=""):
    (ok if dk else sai)(ten if dk or not chi_tiet else ten + "  →  " + chi_tiet)


# ----------------------------------------------------------------------------- tang tinh
def tang_tinh():
    print("\nTANG 1 — tinh")
    html = io.open(os.path.join(HERE, "index.html"), encoding="utf-8").read()
    srcs = re.findall(r'<script src="([^"]+)"', html)
    thieu = [s for s in srcs if not os.path.isfile(os.path.join(HERE, s))]
    kiem("index.html: %d <script>, tep nao cung ton tai" % len(srcs), not thieu, ", ".join(thieu))
    css = re.findall(r'<link rel="stylesheet" href="([^"]+)"', html)
    kiem("index.html: stylesheet ton tai", all(os.path.isfile(os.path.join(HERE, s)) for s in css))
    ngoai = [s for s in srcs + css if re.match(r"^(https?:)?//", s)]
    kiem("khong nap thu vien/phong ngoai trong index.html (chi trinh bien dich C++ nap luc can, tu cpp.js)", not ngoai, ", ".join(ngoai))
    md = json.load(io.open(os.path.join(HERE, "metadata.json"), encoding="utf-8"))
    kiem("metadata.json co title, description, icon, tags", all(md.get(k) for k in ("title", "description", "icon", "tags")))

    node = shutil.which("node")
    if not node:
        bo_qua("khong co node — bo qua kiem cu phap JS va kiem.js")
        return
    loi_cu_phap = []
    for goc, _, tep in os.walk(HERE):
        if "_shots" in goc or "node_modules" in goc:
            continue
        for t in tep:
            if t.endswith(".js"):
                r = subprocess.run([node, "--check", os.path.join(goc, t)], capture_output=True, text=True)
                if r.returncode:
                    loi_cu_phap.append(t + ": " + (r.stderr.strip().splitlines() or ["?"])[-1][:100])
    kiem("moi tep .js qua node --check", not loi_cu_phap, "; ".join(loi_cu_phap[:3]))

    tong = sum(os.path.getsize(os.path.join(g, t)) for g, _, ts in os.walk(HERE) if "_shots" not in g and "__pycache__" not in g for t in ts)
    kiem("kich thuoc trang %.0f KB (tran 3 000 KB — Root Directory cua Vercel)" % (tong / 1024.0), tong < 3000 * 1024)

    print("\n  --- node kiem.js (logic thuan + noi dung + lab qua bo cham) ---")
    r = subprocess.run([node, "kiem.js"], cwd=HERE, capture_output=True, text=True, encoding="utf-8", errors="replace")
    cuoi = [l for l in r.stdout.splitlines() if l.strip()][-1:] or [""]
    kiem("node kiem.js: %s" % cuoi[0].strip()[:110], r.returncode == 0, "\n".join([l for l in r.stdout.splitlines() if "[SAI]" in l][:6]))


# ----------------------------------------------------------------------------- may chu tam
class May:
    def __init__(self):
        class Q(http.server.SimpleHTTPRequestHandler):
            def log_message(self, *a):
                pass
        class Srv(http.server.ThreadingHTTPServer):
            request_queue_size = 256        # mac dinh 5: trinh duyet mo ~20 ket noi cung luc → ERR_CONNECTION_REFUSED
            daemon_threads = True
        self.srv = Srv(("127.0.0.1", 0), functools.partial(Q, directory=HERE))
        self.port = self.srv.server_address[1]
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.goc = "http://127.0.0.1:%d/index.html" % self.port

    def dong(self):
        self.srv.shutdown()


def mo_trinh_duyet(pw):
    for kenh in ("msedge", "chrome", None):
        try:
            return pw.chromium.launch(channel=kenh, headless=True) if kenh else pw.chromium.launch(headless=True)
        except Exception:
            continue
    return None


def chuan(s):
    return re.sub(r"\s+", " ", re.sub(r"[`*]", "", s)).strip()


def chon_dap_an(pg, cau, i):
    """Tra loi dung cau thu i (the .cau thu i) qua giao dien that."""
    the = pg.locator(".cau").nth(i)
    if cau["loai"] == "so":
        the.locator("input").fill(str(cau["dapAn"]).replace(".", ","))
        the.get_by_role("button", name="Kiểm tra").click()
        return True
    ndung = [cau["dung"]] if cau["loai"] == "mot" else cau["dung"]
    van = the.locator(".lc .nd").all_inner_texts()
    for k in ndung:
        muc = chuan(cau["chon"][k])
        vt = [j for j, t in enumerate(van) if chuan(t) == muc]
        if not vt:
            return False
        the.locator(".lc").nth(vt[0]).click()
    if cau["loai"] == "nhieu":
        the.get_by_role("button", name="Kiểm tra").click()
    return True


def tang_trinh_duyet(chup, co_cpp):
    print("\nTANG 2 — trinh duyet that")
    try:
        from playwright.sync_api import sync_playwright
    except Exception:
        bo_qua("chua cai playwright (dung backend/fastapi/.venv/Scripts/python.exe)")
        return
    may = May()
    anh = os.path.join(HERE, "_shots")
    if chup:
        os.makedirs(anh, exist_ok=True)
    loi_console = []
    with sync_playwright() as pw:
        br = mo_trinh_duyet(pw)
        if not br:
            bo_qua("khong mo duoc Edge/Chromium")
            may.dong()
            return
        ctx = br.new_context(viewport={"width": 1280, "height": 900})
        pg = ctx.new_page()
        pg.on("console", lambda m: loi_console.append(m.text[:200]) if m.type == "error" else None)
        pg.on("pageerror", lambda e: loi_console.append("pageerror: " + str(e)[:200]))

        # ---- trang chu
        pg.goto(may.goc + "#/")
        try:
            pg.wait_for_selector(".the-bai", timeout=40000)
        except Exception:
            sai("trang chu khong hien the bai sau 40 s — console: " + " | ".join(loi_console[:4]))
            br.close(); may.dong()
            return
        n_khoa = pg.evaluate("() => TH.ui.tatCaId.length")
        n_the = pg.locator(".the-bai:not(.the-ide)").count()
        kiem("trang chu: %d the bai / %d bai trong khoa.js" % (n_the, n_khoa), n_the == n_khoa)
        kiem("thanh ben: %d bai + 4 cong cu" % n_khoa, pg.locator("#side .nav-i").count() == n_khoa + 4)
        co_dem = pg.evaluate("() => Object.keys(TH.dem || {}).length")
        kiem("data/dem.js: so cau/lab cho %d bai (chip tren the bai)" % co_dem, co_dem == n_khoa)
        if chup:
            pg.screenshot(path=os.path.join(anh, "trang-chu.png"))

        ds_id = pg.evaluate("() => TH.ui.tatCaId")
        # ---- tai du bai
        tai_loi = []
        for i in ds_id:
            try:
                pg.evaluate("id => TH.ui.napBai(id).then(b => b.id)", i)
            except Exception as e:  # noqa: BLE001
                tai_loi.append(i + ": " + str(e).splitlines()[0][:80])
        kiem("nap duoc noi dung %d/%d bai qua script dong" % (n_khoa - len(tai_loi), n_khoa), not tai_loi, "; ".join(tai_loi[:3]))
        bai = "bai-05-greedy"
        du_lieu = pg.evaluate("id => { const b = TH.bai.lay(id); return {trac: b.trac, luan: b.luan, lab: b.lab.map(l => ({id: l.id, js: l.loiGiai.js, cpp: l.loiGiai.cpp || null, khoi: l.khoiDau.js, bt: l.bienThe ? l.bienThe.length : 0, muc: (l.muc || []).length}))}; }", bai)

        # ---- trac nghiem: lan dau co mot cau SAI co y
        pg.goto(may.goc + "#/bai/" + bai)
        pg.wait_for_selector(".cau", timeout=10000)
        trac = du_lieu["trac"]
        kiem("bai %s: %d cau trac nghiem hien ra" % (bai, len(trac)), pg.locator("#muc-trac .cau").count() == len(trac))
        sai_idx = next((i for i, c in enumerate(trac) if c["loai"] == "mot"), None)
        da_tra = True
        for i, c in enumerate(trac):
            if i == sai_idx:
                the = pg.locator(".cau").nth(i)
                van = the.locator(".lc .nd").all_inner_texts()
                dung_txt = chuan(c["chon"][c["dung"]])
                j = next(j for j, t in enumerate(van) if chuan(t) != dung_txt)
                the.locator(".lc").nth(j).click()
                kiem("tra loi SAI: the co .sai va hien dap an dung", the.locator(".lc.sai").count() == 1 and the.locator(".phan-hoi.bad").count() == 1 and the.locator(".lc.dung").count() == 1)
            else:
                da_tra = chon_dap_an(pg, c, i) and da_tra
        kiem("tra loi dung moi cau con lai bang giao dien (mot / nhieu / so, xao dap an)", da_tra)
        pg.wait_for_selector("text=Làm lại 1 câu sai", timeout=5000)
        kiem("tong ket: %d/%d va nut 'Lam lai 1 cau sai'" % (len(trac) - 1, len(trac)), pg.locator("text=Tổng cả bài: đang đúng %d/%d" % (len(trac) - 1, len(trac))).count() == 1)
        pg.get_by_role("button", name="Làm lại 1 câu sai").click()
        kiem("'Lam lai cau sai' chi hien dung 1 cau", pg.locator("#muc-trac .cau").count() == 1)
        chon_dap_an(pg, trac[sai_idx], 0)
        pg.wait_for_selector("text=Tổng cả bài: đang đúng %d/%d" % (len(trac), len(trac)), timeout=5000)
        ok("lam lai cau sai dung → %d/%d" % (len(trac), len(trac)))
        tdo = pg.evaluate("id => JSON.parse(localStorage.getItem('th2:tdo/' + id)).v", bai)
        kiem("tien do luu o localStorage: trac nghiem %s" % tdo.get("t"), tdo["t"]["d"] == len(trac) and tdo["t"]["n"] == len(trac))
        pg.reload()
        pg.wait_for_selector(".cau")
        kiem("tai lai trang: dau 'Lan truoc: dung' hien tren cau hoi", pg.locator(".chip.ok:has-text('Lần trước: đúng')").count() == len(trac))

        # ---- tu luan
        luan = du_lieu["luan"]
        the = pg.locator("#muc-luan .cau").first
        the.locator("textarea").fill("Tôi nghĩ tỉ số đo hiệu quả, không đo độ vừa vặn.")
        pg.wait_for_timeout(700)
        the.get_by_role("button", name="Xem đáp án mẫu").click()
        kiem("tu luan: xem dap an mau hien %d tieu chi tu cham" % len(luan[0]["tieuChi"]), the.locator(".tieu-chi input").count() == len(luan[0]["tieuChi"]))
        the.locator(".tieu-chi input").nth(0).check()
        the.locator(".tieu-chi input").nth(1).check()
        kiem("tu cham: chip 'Tu cham: 2/%d y'" % len(luan[0]["tieuChi"]), the.locator(".chip:has-text('Tự chấm: 2/%d' )" % len(luan[0]["tieuChi"])).count() == 1)
        pg.reload()
        pg.wait_for_selector("#muc-luan .cau")
        kiem("tai lai: van nho noi dung da viet va 2 tick",
             pg.locator("#muc-luan .cau").first.locator("textarea").input_value().startswith("Tôi nghĩ") and pg.locator("#muc-luan .cau").first.locator(".tieu-chi input:checked").count() == 2)

        # ---- ghi chu
        ta = pg.locator("#muc-ghi-chu textarea")
        ta.fill("**Điều chưa rõ:** vì sao 0/1 thì gãy?")
        pg.wait_for_timeout(700)
        pg.goto(may.goc + "#/ghi-chu")
        pg.wait_for_selector("text=vì sao 0/1 thì gãy")
        ok("ghi chu tu luu va hien o 'Ghi chu cua toi'")

        # ---- lien ket tu trang bai
        pg.goto(may.goc + "#/bai/" + bai)
        pg.wait_for_selector(".lk-bar")
        hrefs = pg.evaluate("() => [...document.querySelectorAll('.lk-bar a')].map(a => a.getAttribute('href'))")
        kiem("trang bai co lien ket sang bai giang + mo phong + IDE: %s" % ", ".join(hrefs)[:110],
             any("heuristic-course-2/#/khoa-hoc/" + bai in h for h in hrefs) and any("heuristic-visual-2/#/greedy-chi-so" in h for h in hrefs) and "#/ide" in hrefs)

        # ---- lab JS qua giao dien
        lab = du_lieu["lab"][0]
        pg.goto(may.goc + "#/lab/%s/%s" % (bai, lab["id"]))
        pg.wait_for_selector(".ed-ta")
        pg.fill(".ed-ta", lab["khoi"])
        pg.get_by_role("button", name="Nộp bài").click()
        pg.wait_for_selector(".kq-lab .sao", timeout=60000)
        mo = pg.locator(".kq-lab b").first.inner_text()
        kiem("lab '%s': khung ban dau → '%s'" % (lab["id"], mo), re.match(r"Mức [01]/", mo) is not None)
        pg.fill(".ed-ta", lab["js"])
        pg.get_by_role("button", name="Nộp bài").click()
        pg.wait_for_function("() => /Mức 3\\/3/.test(document.querySelector('.kq-lab')?.innerText || '')", timeout=60000)
        ok("lab '%s': loi giai tham chieu JS → muc cao nhat qua Web Worker that" % lab["id"])
        kiem("lab: co kiem dinh Bai 4 (SE) va bang tung test", pg.locator(".kq-lab:has-text('2·SE')").count() == 1 and pg.locator(".bang-test tbody tr").count() == 10)
        luu = pg.evaluate("([b, l]) => JSON.parse(localStorage.getItem('th2:lab/' + b + '/' + l)).v.muc", [bai, lab["id"]])
        kiem("muc dat luu lai (%s)" % luu, luu == 3)
        pg.locator(".bt-tab button").nth(2).click()
        pg.get_by_role("button", name="Nộp bài").click()
        pg.wait_for_function("() => /Mức 1\\/3/.test(document.querySelector('.kq-lab')?.innerText || '')", timeout=60000)
        ok("lab: bien the 'Subset-sum' → tiSo khong thang giaTri (muc 1/3) — dung nhu Bai 5 §6.1")
        pg.fill(".ed-ta", "while (true) {}")
        pg.get_by_role("button", name="Nộp bài").click()
        pg.wait_for_selector("text=Quá giờ", timeout=30000)
        ok("lab: vong lap vo han bi dung hang ('Qua gio'), trang van song")
        pg.fill(".ed-ta", "\n\nthrow new Error('hỏng');")
        pg.get_by_role("button", name="Chạy thử").click()
        pg.wait_for_selector("text=Error: hỏng", timeout=15000)
        kiem("chay thu: loi JS hien kem so dong", pg.locator("text=dòng 3").count() >= 1)
        if chup:
            pg.screenshot(path=os.path.join(anh, "lab.png"))

        # ---- moi lab, moi lai giai JS tham chieu, qua Web Worker THAT cua trinh duyet
        print("  ... chay moi lab (loi giai JS tham chieu) bang Web Worker that — vai chuc giay")
        tom_lab = pg.evaluate("""async () => {
            const kq = [];
            for (const id of TH.ui.tatCaId) {
              const b = await TH.ui.napBai(id);
              for (const l of (b.lab || [])) {
                const vd = TH.vande.lay(l.vanDe), run = TH.chayJs.taoTrinhChay();
                const r = await TH.cham.chayLab(l, vd, (inp, c) => run.chay(l.loiGiai.js, inp, c.gioiHan));
                const k = await TH.cham.chayLab(l, vd, (inp, c) => run.chay(l.khoiDau.js, inp, c.gioiHan));
                run.dung();
                kq.push({ ten: id + '/' + l.id, muc: r.muc, toiDa: r.mucToiDa, ms: Math.round(r.msLonNhat), khoi: k.muc,
                          loi: r.hopLe ? '' : ((r.tests.find(t => !t.ok) || {}).loi || '') });
              }
            }
            return kq; }""")
        kem = [t for t in tom_lab if t["muc"] != t["toiDa"]]
        chua = [t for t in tom_lab if t["khoi"] == t["toiDa"]]
        cham = sorted(tom_lab, key=lambda t: -t["ms"])[:3]
        kiem("%d lab: loi giai JS tham chieu dat muc cao nhat trong trinh duyet that" % len(tom_lab), not kem,
             "; ".join("%s %s/%s %s" % (t["ten"], t["muc"], t["toiDa"], t["loi"][:50]) for t in kem[:4]))
        kiem("%d lab: khung khoi dau khong tu qua" % len(tom_lab), not chua, "; ".join(t["ten"] for t in chua[:4]))
        ok("lab cham nhat: " + ", ".join("%s %d ms/test" % (t["ten"], t["ms"]) for t in cham))

        # ---- IDE JavaScript
        pg.goto(may.goc + "#/ide")
        pg.wait_for_selector(".ed-ta")
        pg.select_option("select[aria-label='Ngôn ngữ']", "js")
        pg.fill(".ed-ta", "const t = readInput().split(/\\s+/).map(Number);\nprint(t[0] + t[1]);\nlog('dbg');")
        pg.fill("textarea[aria-label='Dữ liệu vào (stdin)']", "20 22")
        pg.get_by_role("button", name="Chạy", exact=True).click()
        pg.wait_for_function("() => /42/.test(document.querySelector('.o-ra')?.textContent || '')", timeout=15000)
        kiem("IDE JavaScript: print → stdout '42', log → stderr", "dbg" in pg.locator(".o-ra.err").inner_text())
        pg.fill("input[aria-label='Tên đoạn mã']", "thu nghiem")
        pg.wait_for_timeout(700)
        pg.reload()
        pg.wait_for_selector(".ed-ta")
        kiem("IDE: ten, ngon ngu, ma, stdin nho qua lan tai lai",
             pg.input_value("input[aria-label='Tên đoạn mã']") == "thu nghiem" and pg.input_value("select[aria-label='Ngôn ngữ']") == "js" and pg.input_value("textarea[aria-label='Dữ liệu vào (stdin)']") == "20 22")
        pg.fill(".ed-ta", "while(true){}")
        pg.select_option("select[aria-label='Giới hạn thời gian chạy']", "2000")
        pg.get_by_role("button", name="Chạy", exact=True).click()
        pg.wait_for_selector("text=Quá giờ", timeout=10000)
        ok("IDE: vong lap vo han bi dung sau 2 giay")
        # phim tat
        pg.fill(".ed-ta", "print('ctrl-enter')")
        pg.focus(".ed-ta")
        pg.keyboard.press("Control+Enter")
        pg.wait_for_selector("text=ctrl-enter", timeout=10000)
        ok("IDE: Ctrl+Enter chay ma")
        if chup:
            pg.screenshot(path=os.path.join(anh, "ide.png"))

        # ---- sao luu / khoi phuc
        goi = pg.evaluate("() => JSON.stringify(TH.ui.luu.xuat())")
        n_khoa_luu = pg.evaluate("() => TH.ui.luu.khoa('').length")
        pg.evaluate("() => TH.ui.luu.khoa('').forEach(k => TH.ui.luu.xoa(k))")
        kiem("xoa het du lieu → 0 khoa", pg.evaluate("() => TH.ui.luu.khoa('').length") == 0)
        tmp = os.path.join(HERE, "_sao-luu-thu.json")
        io.open(tmp, "w", encoding="utf-8").write(goi)
        pg.goto(may.goc + "#/huong-dan")
        pg.wait_for_selector("text=Khôi phục từ tệp")
        pg.set_input_files("input[type=file]", tmp)
        pg.wait_for_selector("text=Đã khôi phục", timeout=5000)
        os.remove(tmp)
        kiem("khoi phuc tu tep sao luu: %d khoa quay lai" % n_khoa_luu, pg.evaluate("() => TH.ui.luu.khoa('').length") == n_khoa_luu)

        # ---- giao dien sang/toi
        pg.goto(may.goc + "#/")
        pg.wait_for_selector(".the-bai")
        truoc = pg.evaluate("() => document.documentElement.getAttribute('data-theme')")
        pg.locator(".hdr .ic-btn[aria-label*='giao diện']").click()
        sau = pg.evaluate("() => document.documentElement.getAttribute('data-theme')")
        kiem("nut sang/toi doi data-theme (%s → %s)" % (truoc, sau), truoc != sau and sau in ("light", "dark"))
        if chup:
            pg.screenshot(path=os.path.join(anh, "trang-chu-theme.png"))
        # ---- PWA: luu truoc roi mo offline mot bai CHUA TUNG MO
        pg.goto(may.goc + "#/huong-dan")
        pg.wait_for_selector("text=Lưu toàn bộ bài để dùng offline")
        pg.evaluate("() => navigator.serviceWorker.ready.then(r => !!r.active)")
        pg.wait_for_timeout(800)
        pg.get_by_role("button", name="Lưu toàn bộ bài để dùng offline").click()
        pg.wait_for_timeout(3000)
        n_cache = pg.evaluate("async () => { const k = (await caches.keys()).filter(x => x.startsWith('th2-app-')); if (!k.length) return 0; return (await (await caches.open(k[0])).keys()).length; }")
        kiem("PWA: service worker luu %d tep (th2-app-*), gom %d bai" % (n_cache, n_khoa), n_cache >= n_khoa + 15)
        ctx.set_offline(True)
        pg.goto(may.goc + "#/bai/bai-10-delta-evaluation")
        pg.reload()
        try:
            pg.wait_for_selector("#muc-trac", timeout=15000)
            ok("offline: mo duoc bai chua tung mo — trang + noi dung lay tu bo nho dem")
        except Exception:
            sai("offline: khong mo duoc bai tu bo nho dem")
        ctx.set_offline(False)
        ctx.close()

        # ---- dien thoai 390 px
        print("  ... dien thoai 390 x 844")
        ctx = br.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
        mp = ctx.new_page()
        mp.on("console", lambda m: loi_console.append("[mobile] " + m.text[:200]) if m.type == "error" else None)
        mp.on("pageerror", lambda e: loi_console.append("[mobile] pageerror: " + str(e)[:200]))
        for ten, h in [("trang chu", "#/"), ("bai", "#/bai/" + bai), ("lab", "#/lab/%s/%s" % (bai, lab["id"])), ("IDE", "#/ide"), ("ghi chu", "#/ghi-chu"), ("huong dan", "#/huong-dan")]:
            mp.goto(may.goc + h)
            mp.reload()
            mp.wait_for_selector("main h1, main h2", timeout=15000)
            mp.wait_for_timeout(500)
            tran = mp.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
            nho = mp.evaluate("""() => [...document.querySelectorAll('main button, main a.btn, main select, main input, .hdr .ic-btn')]
                .filter(e => e.offsetParent !== null && !e.hidden).map(e => e.getBoundingClientRect())
                .filter(r => r.height > 0 && r.height < 36).length""")
            kiem("390 px · %s: khong cuon ngang (%+d px), vung cham < 36 px: %d" % (ten, tran, nho), tran <= 1 and nho == 0)
            if chup:
                mp.screenshot(path=os.path.join(anh, "mobile-%s.png" % ten.replace(" ", "-")))
        mp.goto(may.goc + "#/ide")
        mp.wait_for_selector(".ed-keys button")
        kiem("dien thoai: hang phim ky hieu { } ( ) ; … duoi o soan ma", mp.locator(".ed-keys button").count() >= 10 and mp.locator(".ed-keys").first.is_visible())
        mp.goto(may.goc + "#/lab/%s/%s" % (bai, lab["id"]))
        mp.wait_for_selector(".seg")
        mp.get_by_role("tab", name="Mã").click()
        kiem("dien thoai: lab co 3 ngan (De bai | Ma | Ket qua), chuyen duoc", mp.locator("[data-pane='ma'].hien").count() == 1 and mp.locator("[data-pane='de'].hien").count() == 0)
        ctx.close()

        if co_cpp:
            tang_cpp(br, may, du_lieu, bai, loi_console, chup, anh)
        br.close()
    may.dong()
    if loi_console:
        for l in loi_console[:6]:
            sai("console: " + l)
    else:
        ok("khong co loi console / pageerror trong ca phien")


# ----------------------------------------------------------------------------- C++ that
def tang_cpp(br, may, du_lieu, bai, loi_console, chup, anh):
    print("\nTANG 3 — C++ that (Clang → WebAssembly trong trinh duyet; lan dau tai ~25 MB, co the mat vai phut)")
    ctx = br.new_context(viewport={"width": 1280, "height": 900})
    pg = ctx.new_page()
    pg.set_default_timeout(280000)
    pg.on("console", lambda m: loi_console.append("[cpp] " + m.text[:200]) if m.type == "error" else None)
    pg.on("pageerror", lambda e: loi_console.append("[cpp] pageerror: " + str(e)[:200]))
    t0 = time.time()
    pg.goto(may.goc + "#/ide")
    pg.wait_for_selector(".ed-ta")
    pg.fill(".ed-ta", '#include <bits/stdc++.h>\nusing namespace std;\nint main() { int a, b; scanf("%d %d", &a, &b); printf("tong=%d\\n", a + b); fprintf(stderr, "dbg\\n"); return 0; }')
    pg.fill("textarea[aria-label='Dữ liệu vào (stdin)']", "40 2")
    pg.get_by_role("button", name="Chạy", exact=True).click()
    pg.wait_for_selector("dialog.hop[open]", timeout=15000)
    kiem("lan dau bien dich: hop thoai xin phep tai trinh bien dich (~25 MB)", pg.locator("dialog.hop:has-text('25 MB')").count() == 1)
    pg.get_by_role("button", name="Tải và dùng").click()
    pg.wait_for_function("() => /tong=42/.test(document.querySelector('.o-ra')?.textContent || '')", timeout=280000)
    ok("IDE C++: bien dich (bits/stdc++.h) + chay + stdin → 'tong=42' sau %.0f giay (gom tai trinh bien dich)" % (time.time() - t0))
    kiem("stderr (fprintf) tach rieng khoi stdout", "dbg" in pg.locator(".o-ra.err").inner_text())
    pg.get_by_role("tab", name="Thông tin").click()
    kiem("tab Thong tin: thoi gian bien dich/chay, ma thoat 0", pg.locator(".thong-tin:has-text('Mã thoát')").count() == 1 and pg.locator(".thong-tin dd:text-is('0')").count() >= 1)
    co_cache = pg.evaluate("async () => (await caches.keys()).filter(k => k.startsWith('th2-clang-')).length")
    kiem("trinh bien dich da luu vao Cache Storage (dung duoc offline)", co_cache == 1)

    pg.fill(".ed-ta", "int main() { int x = ; return y; }")
    pg.get_by_role("button", name="Chạy", exact=True).click()
    pg.wait_for_selector(".chuan-doan li.error", timeout=120000)
    kiem("loi bien dich: danh sach chan doan + danh dau dong loi o le", pg.locator(".chuan-doan li.error").count() >= 1 and pg.locator(".ed-gut .ed-err").count() >= 1)
    pg.fill(".ed-ta", "int main() { for(;;){} }")
    pg.select_option("select[aria-label='Giới hạn thời gian chạy']", "2000")
    pg.get_by_role("button", name="Chạy", exact=True).click()
    pg.wait_for_selector("text=Quá giờ", timeout=120000)
    ok("IDE C++: vong lap vo han bi giet worker sau 2 giay")
    pg.fill(".ed-ta", "#include <cstdio>\nstatic long long f(long long n){ return n ? 1 + f(n - 1) : 0; }\nint main() { printf(\"%lld\\n\", f(150000)); }")
    pg.get_by_role("button", name="Chạy", exact=True).click()
    pg.wait_for_function("() => /150000/.test(document.querySelector('.o-ra')?.textContent || '')", timeout=120000)
    ok("IDE C++: de quy sau 150 000 tang (stack 8 MB) chay duoc")

    # clock(), mang tinh lon, in so 64 bit, stdin lon — nhung thu mot lap trinh vien thi dau hay dung
    for ten, ma, vao, mong in [
        ("clock()", '#include <bits/stdc++.h>\nint main(){ clock_t c = clock(); long long s = 0; for (int i = 0; i < 2000000; i++) s += i % 7; printf("%lld %d\\n", s, (int)(clock() >= c)); }', "", "5999995 1"),
        ("mang tinh 4 trieu phan tu", '#include <cstdio>\nstatic int a[4000000];\nint main(){ for (int i = 0; i < 4000000; i += 1000) a[i] = i; long long s = 0; for (int i = 0; i < 4000000; i += 1000) s += a[i]; printf("%lld\\n", s); }', "", "7998000000"),
        ("in so 64 bit", '#include <cstdio>\nint main(){ unsigned long long x = 18446744073709551615ULL; printf("%llu %u\\n", x, 4000000000u); }', "", "18446744073709551615 4000000000"),
        ("stdin 200 000 so (cin)", '#include <bits/stdc++.h>\nint main(){ std::ios::sync_with_stdio(false); std::cin.tie(nullptr); long long n, s = 0; std::cin >> n; for (long long i = 0; i < n; i++) { long long x; std::cin >> x; s += x; } std::cout << s << "\\n"; }',
         "200000\n" + " ".join(str(i) for i in range(200000)) + "\n", "19999900000"),
    ]:
        pg.fill(".ed-ta", ma)
        pg.fill("textarea[aria-label='Dữ liệu vào (stdin)']", vao)
        pg.get_by_role("button", name="Chạy", exact=True).click()
        try:
            pg.wait_for_function("m => (document.querySelector('.o-ra')?.textContent || '').includes(m)", arg=mong, timeout=120000)
            ok("IDE C++: %s" % ten)
        except Exception:
            sai("IDE C++: %s — ket qua: %r" % (ten, pg.locator(".o-ra").first.inner_text()[:100]))

    # lab C++ qua giao dien: loi giai tham chieu cua bai mau
    lab = [l for l in du_lieu["lab"] if l["cpp"]][0]
    pg.goto(may.goc + "#/lab/%s/%s" % (bai, lab["id"]))
    pg.wait_for_selector(".ed-ta")
    pg.get_by_role("button", name="C++", exact=True).click()
    pg.fill(".ed-ta", lab["cpp"])
    pg.get_by_role("button", name="Nộp bài").click()
    pg.wait_for_function("() => /Mức 3\\/3/.test(document.querySelector('.kq-lab')?.innerText || '')", timeout=280000)
    ok("lab C++ '%s' qua giao dien: loi giai tham chieu → muc cao nhat (bien dich Clang-WASM + 10 test)" % lab["id"])
    # moi lab con lai co C++: bien dich + cham bang chinh bo cham cua trang (tung lab mot, co han 4 phut moi lab)
    ds = pg.evaluate("async () => { const r = []; for (const id of TH.ui.tatCaId) { const b = await TH.ui.napBai(id); (b.lab || []).forEach(l => { if (l.loiGiai.cpp) r.push([id, l.id]); }); } return r; }")
    kem, t_bd = [], time.time()
    for k, (bid, lid) in enumerate(ds):
        kq = pg.evaluate("""async ([bid, lid]) => {
            const b = await TH.ui.napBai(bid), l = b.lab.find(x => x.id === lid), vd = TH.vande.lay(l.vanDe);
            const hen = new Promise(ok => setTimeout(() => ok(null), 240000));
            const r = await Promise.race([TH.cham.chayLab(l, vd, TH.cpp.trinhChayLab(l.loiGiai.cpp, { hanNhan: 2 })), hen]);
            if (!r) return { muc: -1, toiDa: 0, loi: 'qua 240 s' };
            return { muc: r.muc, toiDa: r.mucToiDa, ms: Math.round(r.msLonNhat), loi: r.hopLe ? '' : ((r.tests.find(t => !t.ok) || {}).loi || '').slice(0, 120) }; }""", [bid, lid])
        if kq["muc"] != kq["toiDa"]:
            kem.append("%s/%s %s/%s %s" % (bid, lid, kq["muc"], kq["toiDa"], kq["loi"]))
        if (k + 1) % 10 == 0:
            print("      ... %d/%d lab C++ (%.0f s)" % (k + 1, len(ds), time.time() - t_bd))
    kiem("%d lab C++: loi giai C++ tham chieu dat muc cao nhat bang Clang-WASM that (%.0f s)" % (len(ds), time.time() - t_bd), not kem, "; ".join(kem[:4]))
    if chup:
        pg.screenshot(path=os.path.join(anh, "lab-cpp.png"))
    ctx.close()


def chi_cpp(chup):
    """Chi tang C++ that (khong chay lai tang giao dien) — de lap lai nhanh khi sua cpp.js / lab C++."""
    print("\nTANG 2' — chi C++ that")
    from playwright.sync_api import sync_playwright
    may = May()
    anh = os.path.join(HERE, "_shots")
    if chup:
        os.makedirs(anh, exist_ok=True)
    loi_console = []
    with sync_playwright() as pw:
        br = mo_trinh_duyet(pw)
        pg = br.new_context().new_page()
        pg.goto(may.goc + "#/")
        pg.wait_for_selector(".the-bai")
        bai = "bai-05-greedy"
        du_lieu = pg.evaluate("id => TH.ui.napBai(id).then(b => ({lab: b.lab.map(l => ({id: l.id, cpp: l.loiGiai.cpp || null}))}))", bai)
        tang_cpp(br, may, du_lieu, bai, loi_console, chup, anh)
        br.close()
    may.dong()
    for l in loi_console[:6]:
        sai("console: " + l)


def main():
    tinh = "--tinh" in sys.argv
    chup = "--anh" in sys.argv
    co_cpp = "--cpp" in sys.argv
    if "--chi-cpp" in sys.argv:
        chi_cpp(chup)
    else:
        tang_tinh()
        if not tinh:
            tang_trinh_duyet(chup, co_cpp)
    print("\n" + "=" * 62)
    print("%d dat, %d SAI, %d bo qua" % (len(dat), len(hong), len(bo)))
    for m in hong:
        print("  SAI: " + m)
    return 1 if hong else 0


if __name__ == "__main__":
    sys.exit(main())
