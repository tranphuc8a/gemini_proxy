#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kiem tra mot trang lab truc quan. Dung chung cho moi thu muc *-visual.

Moi trang co mot check.py mong manh goi vao day:

    import kiem_demo
    kiem_demo.chay(HERE, 8791)

# Console Windows mac dinh la cp1252 va KHONG in duoc tieng Viet: khi
# chuyen huong ra tep, mot dong bao loi co dau se lam ca script chet
# bang UnicodeEncodeError — va ta mat luon noi dung loi that.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


Hai tang kiem tra:

  TANG 1 — tinh, khong can gi ngoai Python (luon chay)
     - index.html nap cau-hinh.js TRUOC vis-core.js
     - moi <script src> deu ton tai; moi assets/*.js deu duoc nap
     - cu phap JS (qua `node --check`, neu may co Node)
     - moi lab khai bao du id/nhom/ten/dung, khong trung id
     - ban sao engine (vis-core.js…, pwa.js, sw.js o goc) khop courses/engine/;
       trang trong nhom "pwa": manifest + bieu tuong (engine/tao_pwa.py)

  TANG 2 — mo that bang trinh duyet (chi khi da cai playwright)
     - mo tung lab, bat loi console va loi khi ve
     - kiem tra lab co ve ra gi khong (khung .d-body khong rong)
     - doc offline (trang trong nhom "pwa"): worker dieu khien trang, tat mang
       tai lai van mo

     pip install playwright && python -m playwright install chromium
     python check.py        # tu dung may chu tinh, khong phai mo cua so khac

Tra ve exit code khac 0 khi co loi — dung duoc trong CI.
"""
import http.server
import io
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

DO = "\033[31m"
XANH = "\033[32m"
VANG = "\033[33m"
MO = "\033[90m"
HET = "\033[0m"
if os.name == "nt" and not os.environ.get("WT_SESSION"):
    try:                                  # bat mau ANSI tren console Windows cu
        import ctypes
        ctypes.windll.kernel32.SetConsoleMode(
            ctypes.windll.kernel32.GetStdHandle(-11), 7)
    except Exception:
        DO = XANH = VANG = MO = HET = ""


class Bao(object):
    """Gom loi va canh bao, in ra mot lan o cuoi."""

    def __init__(self):
        self.loi = []
        self.canh = []

    def sai(self, muc, chi_tiet=""):
        self.loi.append((muc, chi_tiet))
        print("  %s[LOI]%s  %s%s" % (DO, HET, muc, ("  " + chi_tiet) if chi_tiet else ""))

    def nhac(self, muc, chi_tiet=""):
        self.canh.append((muc, chi_tiet))
        print("  %s[nhac]%s %s%s" % (VANG, HET, muc, ("  " + chi_tiet) if chi_tiet else ""))

    def duoc(self, muc):
        print("  %s[ok]%s   %s" % (XANH, HET, muc))


# ----------------------------------------------------------------------
# Tang 1 — kiem tra tinh
# ----------------------------------------------------------------------

def doc(p):
    with io.open(p, encoding="utf-8") as f:
        return f.read()


def kiem_index(thu_muc, B):
    p = os.path.join(thu_muc, "index.html")
    if not os.path.exists(p):
        B.sai("thieu index.html")
        return []
    html = doc(p)
    srcs = re.findall(r'<script[^>]+src="([^"]+)"', html)

    if not srcs:
        B.sai("index.html khong nap script nao")
        return []

    ten = [os.path.basename(s) for s in srcs]
    if "cau-hinh.js" in ten and "vis-core.js" in ten:
        if ten.index("cau-hinh.js") > ten.index("vis-core.js"):
            B.sai("cau-hinh.js phai nap TRUOC vis-core.js",
                  "engine doc window.CAU_HINH_VIS ngay khi chay")
        else:
            B.duoc("thu tu nap script dung")
    elif "vis-core.js" not in ten:
        B.sai("index.html khong nap vis-core.js")

    thieu = []
    for s in srcs:
        if s.startswith("http"):
            continue
        if not os.path.exists(os.path.join(thu_muc, s.replace("/", os.sep))):
            thieu.append(s)
    if thieu:
        B.sai("script khai bao nhung khong co tep", ", ".join(thieu))
    else:
        B.duoc("moi <script src> deu ton tai (%d tep)" % len(srcs))

    # moi tep js trong assets/ deu phai duoc nap, khong thi la tep chet
    tm_assets = os.path.join(thu_muc, "assets")
    if os.path.isdir(tm_assets):
        co_tren_dia = set(f for f in os.listdir(tm_assets) if f.endswith(".js"))
        du_thua = sorted(co_tren_dia - set(ten))
        if du_thua:
            B.nhac("tep js khong duoc index.html nap", ", ".join(du_thua))

    return [s for s in srcs if not s.startswith("http")]


def thongDiepLoi(stderr):
    """Lay dong '<Kieu>Error: ...' trong stderr cua node, bo qua stack trace
    va dong '   Node.js vXX' o cuoi."""
    for d in (stderr or "").splitlines():
        d = d.strip()
        if re.match(r"^\w*Error\b", d):
            return d
    return "loi cu phap"


def viTriLoi(stderr):
    """Dong dau stderr cua node co dang '<duong dan>:<so dong>'."""
    dong = (stderr or "").strip().splitlines()
    if dong:
        m = re.search(r":(\d+)\s*$", dong[0])
        if m:
            return " dong " + m.group(1)
    return ""


def kiem_cu_phap(thu_muc, srcs, B):
    try:
        subprocess.run(["node", "--version"], capture_output=True, check=True)
    except Exception:
        B.nhac("khong tim thay Node — bo qua kiem tra cu phap JS")
        return
    hong = []
    for s in srcs:
        if not s.endswith(".js"):
            continue
        p = os.path.join(thu_muc, s.replace("/", os.sep))
        if not os.path.exists(p):
            continue
        r = subprocess.run(["node", "--check", p], capture_output=True, text=True)
        if r.returncode != 0:
            hong.append("%s%s: %s" % (s, viTriLoi(r.stderr), thongDiepLoi(r.stderr)))
    if hong:
        for h in hong:
            B.sai("cu phap JS hong", h)
    else:
        B.duoc("cu phap JS sach (node --check)")


def kiem_chay_thu(thu_muc, B):
    """Chay that engine + cac lab trong Node tren DOM gia (engine/thu-nhanh.js).

    Day la tang bat loi runtime ma khong can trinh duyet: bien chua khai bao,
    lab nem ngoai le, bo phat khong ve gi, permalink khong ghi duoc.
    """
    kich_ban = os.path.join(HERE, "thu-nhanh.js")
    if not os.path.exists(kich_ban):
        B.nhac("khong co engine/thu-nhanh.js — bo qua chay thu")
        return
    try:
        subprocess.run(["node", "--version"], capture_output=True, check=True)
    except Exception:
        B.nhac("khong tim thay Node — bo qua chay thu")
        return
    trang = os.path.basename(thu_muc.rstrip(os.sep))
    r = subprocess.run(["node", kich_ban, trang], capture_output=True, text=True)
    for d in (r.stdout or "").splitlines():
        d = d.strip()
        if d.startswith("[LOI]"):
            B.sai("chay thu: " + d[5:].strip())
    if r.returncode != 0 and not any("chay thu" in m for m, _ in B.loi):
        dong = (r.stderr or r.stdout or "").strip().splitlines()
        B.sai("chay thu that bai", dong[-1] if dong else "khong ro")
    elif r.returncode == 0:
        so_ok = (r.stdout or "").count("[ok]")
        B.duoc("chay thu tren DOM gia: %d muc dat" % so_ok)


def kiem_engine(B):
    """Chay engine/thu-engine.js — tu kiem tra cac nguyen ham cua engine.

    Bam khong gian, so ngau nhien, doi mau: nhung thu hong am tham, khong
    lab nao bao loi ma ket qua thi sai. Kiem thang o day.
    """
    kich_ban = os.path.join(HERE, "thu-engine.js")
    if not os.path.exists(kich_ban):
        return
    try:
        subprocess.run(["node", "--version"], capture_output=True, check=True)
    except Exception:
        return
    r = subprocess.run(["node", kich_ban], capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    ra = (r.stdout or "") + (r.stderr or "")
    for d in ra.splitlines():
        d = d.strip()
        if d.startswith("[SAI]"):
            B.sai("nguyen ham engine: " + d[5:].strip())
    if r.returncode == 0:
        B.duoc("nguyen ham engine: %d muc dat" % ra.count("[ok]"))
    elif not any("nguyen ham engine" in m for m, _ in B.loi):
        dong = ra.strip().splitlines()
        B.sai("thu-engine.js that bai", dong[-1] if dong else "khong ro")


def kiem_so(thu_muc, B):
    """Chay <trang>/kiem-so.js neu trang co — doi chieu CON SO voi gia tri chuan.

    Tang 'chay thu' chi chung minh lab khong nem loi. Tang nay tra loi cau
    hoi khac: con so lab in ra co dung khong. Trang nao chua co tep thi bo
    qua, khong coi la loi.
    """
    kich_ban = os.path.join(thu_muc, "kiem-so.js")
    if not os.path.exists(kich_ban):
        return
    try:
        subprocess.run(["node", "--version"], capture_output=True, check=True)
    except Exception:
        B.nhac("khong tim thay Node — bo qua doi chieu so")
        return
    r = subprocess.run(["node", kich_ban], capture_output=True, text=True,
                       cwd=thu_muc, encoding="utf-8", errors="replace")
    ra = (r.stdout or "") + (r.stderr or "")
    for d in ra.splitlines():
        d = d.strip()
        if d.startswith("[SAI]"):
            B.sai("doi chieu so: " + d[5:].strip())
    if r.returncode == 0:
        B.duoc("doi chieu so: %d phep khop gia tri chuan" % ra.count("[ok]"))
    elif not any("doi chieu so" in m for m, _ in B.loi):
        dong = ra.strip().splitlines()
        B.sai("doi chieu so that bai", dong[-1] if dong else "khong ro")


RE_KHAI_BAO = re.compile(r'\b(?:demo|lab)\s*\(\s*\{')


def gom_lab(thu_muc, srcs, B):
    """Doc cac khai bao demo({...}) / lab({...}) va kiem tra truong bat buoc."""
    ds = []
    for s in srcs:
        if not s.endswith(".js") or os.path.basename(s) in ("vis-core.js", "cau-hinh.js"):
            continue
        p = os.path.join(thu_muc, s.replace("/", os.sep))
        if not os.path.exists(p):
            continue
        noi = doc(p)
        for m in RE_KHAI_BAO.finditer(noi):
            khoi = noi[m.end():m.end() + 2500]
            def lay(truong):
                mm = re.search(truong + r'\s*:\s*"([^"]*)"', khoi)
                return mm.group(1) if mm else None
            ma = lay("id")
            if not ma:
                B.sai("mot lab khong co id", "%s, vi tri %d" % (s, m.start()))
                continue
            muc = {
                "id": ma, "ten": lay("ten"), "nhom": lay("nhom"),
                "tep": s, "co_dung": bool(re.search(r'\bdung\s*:\s*function', khoi)),
            }
            for truong in ("ten", "nhom"):
                if not muc[truong]:
                    B.sai("lab '%s' thieu truong %s" % (ma, truong), s)
            if not muc["co_dung"]:
                B.sai("lab '%s' thieu ham dung(host)" % ma, s)
            ds.append(muc)

    if not ds:
        B.sai("khong tim thay lab nao")
        return ds

    dem = {}
    for d in ds:
        dem[d["id"]] = dem.get(d["id"], 0) + 1
    trung = sorted(k for k, v in dem.items() if v > 1)
    if trung:
        B.sai("id lab bi trung", ", ".join(trung))
    else:
        B.duoc("%d lab, id khong trung" % len(ds))
    return ds


def kiem_ban_sao_engine(thu_muc, B):
    """Ban sao engine trong assets/ con khop nguon courses/engine/ khong."""
    sys.path.insert(0, HERE)
    try:
        import sync
    except Exception as e:
        B.nhac("khong nap duoc engine/sync.py", str(e))
        return
    trang = os.path.basename(thu_muc.rstrip(os.sep))
    ch = sync.doc_cau_hinh()
    if trang in ch.get("chua_dong_bo", []):
        B.nhac("trang nay CO Y chua dong bo engine v2", "xem engine/dong-bo.json")
        return
    import kiem_pwa
    for dat, msg in kiem_pwa.tinh(thu_muc):
        if dat:
            B.duoc(msg)
        else:
            B.sai(msg)


def kiem_danh_sach(thu_muc, ds, B, ghi=False):
    """danh-sach.json: chi muc lab cho o "tim moi thu" cua portal (Ctrl+K), sinh tu chinh
    cac khai bao demo({...}). Trang chua co tep nay thi khong vao chi muc; --ghi-danh-sach
    ghi (lai) tep."""
    p = os.path.join(thu_muc, "danh-sach.json")
    muon = [{"id": d["id"], "ten": d["ten"], "nhom": d["nhom"]} for d in ds]
    if ghi:
        with io.open(p, "w", encoding="utf-8") as f:
            f.write(json.dumps(muon, ensure_ascii=False, indent=1) + "\n")
        B.duoc("ghi danh-sach.json: %d lab" % len(muon))
        return
    if not os.path.exists(p):
        return
    try:
        with io.open(p, encoding="utf-8") as f:
            co = json.load(f)
    except ValueError as e:
        B.sai("danh-sach.json khong doc duoc", str(e))
        return
    if co != muon:
        B.sai("danh-sach.json lech cac lab", "chay `python check.py --tinh --ghi-danh-sach`")
    else:
        B.duoc("danh-sach.json khop %d lab (o tim moi thu cua portal)" % len(muon))


def kiem_cau_hinh(thu_muc, B):
    p = os.path.join(thu_muc, "assets", "cau-hinh.js")
    if not os.path.exists(p):
        B.nhac("khong co assets/cau-hinh.js", "engine se dung toan bo mac dinh")
        return
    noi = doc(p)
    if "window.CAU_HINH_VIS" not in noi:
        B.sai("cau-hinh.js khong gan window.CAU_HINH_VIS")
    else:
        B.duoc("cau-hinh.js hop le")


# ----------------------------------------------------------------------
# Tang 2 — mo that bang trinh duyet (tuy chon)
# ----------------------------------------------------------------------

class _ImLang(http.server.SimpleHTTPRequestHandler):
    """Khong in tung yeu cau ra man hinh — 32 lab la hang tram dong rac."""

    def log_message(self, *a):
        pass


def _dung_may_chu(thu_muc, cong):
    """Dung may chu tinh trong mot luong nen.

    Truoc day tep nay KHONG dung may chu: tai lieu bao nguoi dung tu chay
    `python -m http.server` o cua so khac. Quen mot cai la ca tang bao
    ERR_CONNECTION_REFUSED cho moi lab, va thong bao do khong he cho thay
    nguyen nhan that. Tu dung lay thi khong quen duoc.

    Tra ve (server, cong_that) hoac (None, 0) neu khong mo noi cong nao.
    """
    import socketserver
    import threading

    for thu in range(cong, cong + 12):
        try:
            hd = lambda *a, **k: _ImLang(*a, directory=thu_muc, **k)

            # PHAI la ThreadingTCPServer: mot trang lab nap ~36 tep va
            # Chromium mo 6 ket noi song song. May chu tran (mot yeu cau
            # mot luc) se tu choi bot, va lab bi bao hong oan bang
            # ERR_CONNECTION_REFUSED.
            class _MayChu(socketserver.ThreadingTCPServer):
                daemon_threads = True
                allow_reuse_address = True
                request_queue_size = 128

            sv = _MayChu(("127.0.0.1", thu), hd)
        except OSError:
            continue        # cong dang ban, thu cong ke tiep
        threading.Thread(target=sv.serve_forever, daemon=True).start()
        return sv, thu
    return None, 0


def kiem_trinh_duyet(thu_muc, cong, ds, B, loc_nhom=None):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        B.nhac("chua cai playwright — bo qua kiem tra bang trinh duyet",
               "pip install playwright && python -m playwright install chromium")
        return

    sv, cong_that = _dung_may_chu(thu_muc, cong)
    if sv is None:
        B.sai("khong mo duoc cong nao tu %d den %d" % (cong, cong + 11))
        return

    goc = "http://127.0.0.1:%d/index.html" % cong_that
    can = [d for d in ds if not loc_nhom or d["nhom"] == loc_nhom]
    print("")
    print("  %sMo %d lab bang Chromium tai %s%s" % (MO, len(can), goc, HET))

    import tao_pwa
    co_pwa = os.path.basename(os.path.normpath(thu_muc)) in tao_pwa.cac_trang()
    try:
        _kiem_qua_trinh_duyet(sync_playwright, goc, can, B, co_pwa)
    finally:
        sv.shutdown()
        sv.server_close()


def _kiem_qua_trinh_duyet(sync_playwright, goc, can, B, co_pwa=False):
    with sync_playwright() as pw:
        tb = pw.chromium.launch()
        trang = tb.new_page(viewport={"width": 1440, "height": 900})
        for d in can:
            nhat_ky = []
            trang.on("console", lambda m: nhat_ky.append(m.text) if m.type == "error" else None)
            trang.on("pageerror", lambda e: nhat_ky.append(str(e)))
            try:
                trang.goto(goc + "#/" + d["id"], wait_until="networkidle", timeout=15000)
                trang.wait_for_timeout(700)
                if trang.locator(".d-body .loi").count():
                    nhat_ky.append(trang.locator(".d-body .loi").inner_text())
                if not trang.locator(".d-body").inner_html().strip():
                    nhat_ky.append("khung .d-body rong — lab khong ve gi")
            except Exception as e:
                nhat_ky.append("khong mo duoc trang: %s" % e)
            if nhat_ky:
                B.sai("lab '%s' loi khi chay" % d["id"], nhat_ky[0][:220])
            else:
                B.duoc("lab '%s' chay sach" % d["id"])
        if can:
            _kiem_nhung(trang, goc, can, B)
        if can and co_pwa:
            _kiem_offline(tb, goc + "#/" + can[0]["id"], B)
        tb.close()


def _kiem_offline(tb, url, B):
    """Doc offline + cai ung dung (engine/kiem_pwa.py) trong context moi."""
    import kiem_pwa
    ctx = tb.new_context(viewport={"width": 1440, "height": 900})
    try:
        for dat, msg in kiem_pwa.trinh_duyet(ctx, ctx.new_page(), url, ".d-head h1"):
            if dat:
                B.duoc(msg)
            else:
                B.sai(msg)
    finally:
        ctx.close()


def _kiem_nhung(trang, goc, can, B):
    """Che do nhung trong bai giang (?nhung=1) va lien ket 'Hoc ly thuyet' (cau-hinh baiHoc)."""
    trang.goto(goc + "?nhung=1&theme=dark#/" + can[0]["id"], wait_until="networkidle", timeout=15000)
    kq = trang.evaluate("""() => ({
        nhung: document.documentElement.classList.contains('nhung'),
        theme: document.documentElement.getAttribute('data-theme'),
        an: ['.hdr', '.side'].every(s => !document.querySelector(s) || getComputedStyle(document.querySelector(s)).display === 'none'),
        h1: !!document.querySelector('.d-head h1'),
        nut: [...document.querySelectorAll('.cong-cu .cg span')].map(s => s.textContent)})""")
    dung = kq["nhung"] and kq["theme"] == "dark" and kq["an"] and kq["h1"]
    if dung and "Tập trung" not in kq["nut"] and "Mở trang đầy đủ" in kq["nut"]:
        B.duoc("che do nhung (?nhung=1): an header + muc luc, theo ?theme=, co nut mo trang day du")
    else:
        B.sai("che do nhung (?nhung=1) sai", str(kq)[:220])
    bai = trang.evaluate("() => (window.CAU_HINH_VIS && window.CAU_HINH_VIS.baiHoc) || {}")
    ids = [d["id"] for d in can if d["id"] in bai]
    if not ids:
        return
    trang.goto(goc + "#/" + ids[0], wait_until="networkidle", timeout=15000)
    lk = trang.eval_on_selector_all(".d-bai a", "e => e.map(a => a.getAttribute('href'))")
    muon = [b["url"] for b in bai[ids[0]]]
    if lk == muon:
        B.duoc("lab '%s': %d lien ket 'Hoc ly thuyet' toi bai giang" % (ids[0], len(lk)))
    else:
        B.sai("lab '%s': lien ket 'Hoc ly thuyet' khong khop cau hinh" % ids[0], "%s != %s" % (lk, muon))


# ----------------------------------------------------------------------

def chay(thu_muc, cong=8791, argv=None):
    argv = sys.argv[1:] if argv is None else argv
    loc_nhom = None
    if "--nhom" in argv:
        i = argv.index("--nhom")
        if i + 1 < len(argv):
            loc_nhom = argv[i + 1]
    mo_trinh_duyet = "--tinh" not in argv

    ten = os.path.basename(thu_muc.rstrip(os.sep))
    print("")
    print("Kiem tra trang: %s" % ten)
    print("-" * 58)

    B = Bao()
    srcs = kiem_index(thu_muc, B)
    kiem_cau_hinh(thu_muc, B)
    kiem_cu_phap(thu_muc, srcs, B)
    kiem_ban_sao_engine(thu_muc, B)
    ds = gom_lab(thu_muc, srcs, B)
    if ds:
        kiem_danh_sach(thu_muc, ds, B, "--ghi-danh-sach" in argv)
    kiem_engine(B)
    kiem_chay_thu(thu_muc, B)
    kiem_so(thu_muc, B)

    if mo_trinh_duyet and ds:
        kiem_trinh_duyet(thu_muc, cong, ds, B, loc_nhom)

    print("-" * 58)
    if B.loi:
        print("%s%d loi%s, %d nhac nho." % (DO, len(B.loi), HET, len(B.canh)))
        sys.exit(1)
    print("%sDat%s — khong loi, %d nhac nho." % (XANH, HET, len(B.canh)))
    sys.exit(0)


if __name__ == "__main__":
    chay(os.getcwd())
