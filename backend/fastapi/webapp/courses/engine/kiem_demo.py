#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kiem tra mot trang lab truc quan. Dung chung cho moi thu muc *-visual.

Moi trang co mot check.py mong manh goi vao day:

    import kiem_demo
    kiem_demo.chay(HERE, 8791)

Hai tang kiem tra:

  TANG 1 — tinh, khong can gi ngoai Python (luon chay)
     - index.html nap cau-hinh.js TRUOC vis-core.js
     - moi <script src> deu ton tai; moi assets/*.js deu duoc nap
     - cu phap JS (qua `node --check`, neu may co Node)
     - moi lab khai bao du id/nhom/ten/dung, khong trung id
     - ban sao engine trong assets/ con khop voi courses/engine/

  TANG 2 — mo that bang trinh duyet (chi khi da cai playwright)
     - mo tung lab, bat loi console va loi khi ve
     - kiem tra lab co ve ra gi khong (khung .d-body khong rong)

     pip install playwright && python -m playwright install chromium
     python -m http.server 8791 --bind 127.0.0.1    # o mot cua so khac
     python check.py

Tra ve exit code khac 0 khi co loi — dung duoc trong CI.
"""
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
    lech = []
    for ten in ch.get("tep", []):
        ra = os.path.join(thu_muc, "assets", ten)
        if not os.path.exists(ra):
            lech.append(ten + " (thieu)")
            continue
        if doc(ra) != sync.noi_dung_dich(ten):
            lech.append(ten)
    if lech:
        B.sai("ban sao engine lech nguon", ", ".join(lech) + " — chay `python engine/sync.py`")
    else:
        B.duoc("ban sao engine khop courses/engine/")


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

def kiem_trinh_duyet(thu_muc, cong, ds, B, loc_nhom=None):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        B.nhac("chua cai playwright — bo qua kiem tra bang trinh duyet",
               "pip install playwright && python -m playwright install chromium")
        return

    goc = "http://127.0.0.1:%d/index.html" % cong
    can = [d for d in ds if not loc_nhom or d["nhom"] == loc_nhom]
    print("")
    print("  %sMo %d lab bang Chromium tai %s%s" % (MO, len(can), goc, HET))

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
        tb.close()


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
    kiem_chay_thu(thu_muc, B)

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
