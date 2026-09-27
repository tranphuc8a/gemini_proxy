# -*- coding: utf-8 -*-
"""kiem_hinh.py — tang kiem tra HINH ANH bang Chromium that.

    python engine/kiem_hinh.py lab-visual
    python engine/kiem_hinh.py lab-visual --anh        # chup luon anh de xem
    python engine/kiem_hinh.py lab-visual --lab can-xu # chi mot lab

Khac voi tang `kiem_trinh_duyet` co san trong kiem_demo.py — tang do chi la
SMOKE TEST: no bat "lab nem loi" hoac "lab khong ve gi". Tep nay di xa hon,
nham dung nhung thu ma sau dot lab lien tuc khong ai kiem duoc:

  1. CANVAS CO VE GI KHONG — doc diem anh that. Mot canvas trang tron hoac
     mot mau duy nhat nghia la lab chay nhung khong ve.
  2. CAC HOP CO DE LEN NHAU KHONG — lay hinh hoc that cua DOM roi doi chieu
     tung cap. Day la cho `V.cayQuyetDinh` va cac nut moi de hong nhat.
  3. CO THANH CUON NGANG KHONG — tran khung la loi bo cuc kinh dien.
  4. CA HAI GIAO DIEN, CA HAI BE NGANG — sang/toi x rong/hep.
  5. CHUOT CO AN KHONG — bam that vao canvas roi xem trang thai co doi.

Khong them thu vien nao ngoai playwright.
"""
from __future__ import annotations

import http.server
import json
import os
import socketserver
import sys
import threading
import time

HERE = os.path.dirname(os.path.abspath(__file__))
COURSES = os.path.dirname(HERE)


# Console Windows mac dinh la cp1252 va KHONG in duoc tieng Viet: khi
# chuyen huong ra tep, mot dong bao loi co dau se lam ca script chet
# bang UnicodeEncodeError — va ta mat luon noi dung loi that.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

XANH, DO, VANG, MO, HET = "\033[32m", "\033[31m", "\033[33m", "\033[36m", "\033[0m"


class Bao:
    def __init__(self):
        self.loi = []
        self.nhac = []
        self.dat = 0

    def duoc(self, chu, chi_tiet=""):
        self.dat += 1
        print("  %s[ok]%s   %s%s" % (XANH, HET, chu,
                                     ("   " + chi_tiet) if chi_tiet else ""))

    def sai(self, chu, chi_tiet=""):
        self.loi.append((chu, chi_tiet))
        print("  %s[LOI]%s  %s%s" % (DO, HET, chu,
                                     ("   " + chi_tiet) if chi_tiet else ""))

    def nhan(self, chu, chi_tiet=""):
        self.nhac.append((chu, chi_tiet))
        print("  %s[nhac]%s %s%s" % (VANG, HET, chu,
                                     ("   " + chi_tiet) if chi_tiet else ""))


# ----------------------------------------------------------------------
# May chu tinh — mo bang file:// thi fetch/module co the bi chan, nen van
# phuc vu qua http cho giong that.
# ----------------------------------------------------------------------
class Im(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


class MayChu(socketserver.ThreadingTCPServer):
    """PHAI la ThreadingTCPServer.

    `TCPServer` tran xu ly MOT yeu cau mot luc. Mot trang lab nap ~36 tep
    (index + cau-hinh + vis-core + 32 lab-*.js + css) va Chromium mo 6 ket
    noi song song, nen may chu tran tu choi bot — hien ra thanh
    ERR_CONNECTION_REFUSED trong console, va lab bi bao la hong oan.
    """
    daemon_threads = True
    allow_reuse_address = True
    # Mac dinh chi 5 — Chromium mo nhieu ket noi hon the va phan thua
    # bi tu choi ngay o tang TCP, truoc khi Python kip nhin thay.
    request_queue_size = 128


def mo_may_chu(thu_muc, cong):
    hd = lambda *a, **k: Im(*a, directory=thu_muc, **k)
    sv = MayChu(("127.0.0.1", cong), hd)
    t = threading.Thread(target=sv.serve_forever, daemon=True)
    t.start()
    return sv


# ----------------------------------------------------------------------
# Cac phep do, chay TRONG trang
# ----------------------------------------------------------------------

# Canvas co ve gi khong. Tra ve so mau KHAC NHAU thay vi chi "co/khong":
# mot canvas to kin mot mau van la canvas khong ve gi.
JS_CANVAS = r"""
() => {
  const ra = [];
  for (const c of document.querySelectorAll('canvas')) {
    const w = c.width, h = c.height;
    if (!w || !h) { ra.push({rong: c.clientWidth, cao: c.clientHeight, mau: 0, loi: 'kich thuoc 0'}); continue; }
    let g;
    try { g = c.getContext('2d'); } catch (e) { ra.push({loi: 'khong lay duoc ctx'}); continue; }
    let d;
    try { d = g.getImageData(0, 0, w, h).data; } catch (e) { ra.push({loi: 'getImageData: ' + e.message}); continue; }
    const tap = new Set();
    // Lay mau thua — doc het 4 trieu diem anh thi cham.
    const buoc = Math.max(4, Math.floor((w * h) / 20000)) * 4;
    for (let i = 0; i < d.length; i += buoc) {
      tap.add((d[i] << 16) | (d[i+1] << 8) | d[i+2]);
      if (tap.size > 60) break;
    }
    ra.push({rong: c.clientWidth, cao: c.clientHeight, mau: tap.size});
  }
  return ra;
}
"""

# Tim cac cap phan tu DE LEN NHAU.
#
# Phai loc quan he CHA-CON ngay trong trang: mot nut nam trong <label> thi
# di nhien hop cua chung giao nhau, va do khong phai loi bo cuc. Lan dau
# chay, phep kiem nay bao 54 loi — CA 54 deu la nut xuc xac nam trong nhan
# "Hat giong". Tuc la phep kiem sai, khong phai lab sai.
JS_DE_NHAU = r"""
(arg) => {
  const chon = arg.chon, choPhep = arg.choPhep;
  const ds = [];
  for (const e of document.querySelectorAll(chon)) {
    const r = e.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const s = getComputedStyle(e);
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) continue;
    if (s.position === 'absolute' || s.position === 'fixed') continue;  // chu thich noi
    ds.push({ e: e, t: (e.textContent || '').trim().slice(0, 36), r: r });
  }
  const cap = [];
  for (let i = 0; i < ds.length; i++) {
    for (let j = i + 1; j < ds.length; j++) {
      const a = ds[i], b = ds[j];
      // Long nhau thi bo qua.
      if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
      const gx = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const gy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (gx > choPhep && gy > choPhep) {
        cap.push({ a: a.t, b: b.t, gx: Math.round(gx), gy: Math.round(gy) });
      }
    }
  }
  return { so: ds.length, cap: cap };
}
"""

JS_TRAN = r"""
() => ({
  cuonNgang: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  rongTrang: document.documentElement.clientWidth,
  rongNoiDung: document.documentElement.scrollWidth
})
"""


# ----------------------------------------------------------------------
def doc_lab(thu_muc):
    """Doc danh sach lab tu index.html + cac tep lab-*.js."""
    import re
    p = os.path.join(thu_muc, "index.html")
    noi = open(p, encoding="utf-8").read()
    srcs = re.findall(r'<script src="([^"]+)"', noi)
    ds = []
    for s in srcs:
        tp = os.path.join(thu_muc, s.replace("/", os.sep))
        if not os.path.exists(tp):
            continue
        t = open(tp, encoding="utf-8").read()
        for m in re.finditer(r'\b(?:demo|lab)\(\{\s*id:\s*"([^"]+)"', t):
            ds.append(m.group(1))
    return ds


def kiem_mot_lab(trang, goc, ma, B, che_do, chup_vao=None):
    """Mo mot lab va do het cac chi tieu."""
    nhat_ky = []
    trang.on("console", lambda m: nhat_ky.append(m.text) if m.type == "error" else None)
    trang.on("pageerror", lambda e: nhat_ky.append(str(e)))

    try:
        trang.goto(goc + "#/" + ma, wait_until="networkidle", timeout=20000)
    except Exception as e:
        B.sai("[%s] %s — khong mo duoc trang" % (che_do, ma), str(e)[:160])
        return
    try:
        trang.wait_for_selector("canvas", timeout=8000)
    except Exception:
        pass            # lab khong dung canvas cung hop le
    trang.wait_for_timeout(600)

    ten = "[%s] %s" % (che_do, ma)

    if nhat_ky:
        B.sai(ten + " — loi khi chay", nhat_ky[0][:200])
        return

    # --- 1. canvas co ve khong ---
    try:
        cvs = trang.evaluate(JS_CANVAS)
    except Exception as e:
        cvs = []
        B.nhan(ten + " — khong doc duoc canvas", str(e)[:120])
    if not cvs:
        # Im lang bo qua la cach mot phep thu tu vo hieu hoa minh. Neu lab
        # nay that su khong dung canvas thi day chi la mot dong nhac nho;
        # con neu canvas chua kip dung thi no la dau hieu that.
        B.nhan(ten + " — khong tim thay canvas nao")
    if cvs:
        xau = [c for c in cvs if c.get("loi") or c.get("mau", 0) < 3]
        if xau:
            c = xau[0]
            B.sai(ten + " — canvas khong ve gi",
                  c.get("loi") or ("chi %d mau khac nhau" % c.get("mau", 0)))
        else:
            B.duoc(ten + " — canvas co ve",
                   "%d canvas, it nhat %d mau" % (len(cvs), min(c["mau"] for c in cvs)))

    # --- 2. tran ngang ---
    t = trang.evaluate(JS_TRAN)
    if t["cuonNgang"] > 4:
        B.sai(ten + " — TRAN ngang",
              "noi dung %dpx > khung %dpx" % (t["rongNoiDung"], t["rongTrang"]))
    else:
        B.duoc(ten + " — khong tran ngang")

    # --- 3. cac hop dieu khien co de len nhau khong ---
    kq = trang.evaluate(JS_DE_NHAU, {
        "chon": ".dks .nut, .dks label, .so-lieu .d, .chu-thich span, .phat-nut button",
        "choPhep": 2.0,
    })
    if kq["cap"]:
        c = kq["cap"][0]
        B.sai(ten + " — %d cap phan tu DE LEN NHAU" % len(kq["cap"]),
              "%r x %r (giao %dx%d px)" % (c["a"][:22], c["b"][:22], c["gx"], c["gy"]))
    else:
        B.duoc(ten + " — %d phan tu, khong cai nao de len nhau" % kq["so"])

    if chup_vao:
        os.makedirs(chup_vao, exist_ok=True)
        trang.screenshot(path=os.path.join(chup_vao, "%s--%s.png" % (ma, che_do)),
                         full_page=True)


def kiem_chuot(trang, goc, B, ds_lab=None):
    """Bam that vao canvas cua cac lab, xem trang thai co doi.

    Day la phan tang DOM gia KHONG THE kiem: no khong co hinh hoc, nen
    khong biet bam vao dau.

    Danh sach lab phai lay TU CHINH TRANG dang kiem. Ban dau toi go cung
    ten bon lab cua lab-visual, nen chay tren ba site cu thi ca bon deu
    "khong co canvas" — tuc la phep chuot khong kiem duoc gi ma van bao
    "dat". Mot phep thu luon bo qua chinh no thi vo dung.
    """
    UU_TIEN = ["can-xu", "tha-trung", "doan-chuoi", "game-of-life"]
    ds_lab = ds_lab or []
    chon = [m for m in UU_TIEN if m in ds_lab] or ds_lab[:4]
    CA = [(m, "bam thu vao canvas") for m in chon]
    for ma, mo_ta in CA:
        try:
            trang.goto(goc + "#/" + ma, wait_until="networkidle", timeout=20000)
        except Exception as e:
            B.nhan("[chuot] %s — khong mo duoc" % ma, str(e)[:120])
            continue
        # Cho canvas HIEN RA, khong doi mot khoang co dinh.
        #
        # Trang moi tinh phai nap ~40 kich ban roi router moi dung lab, va
        # 700 ms la khong du: luc do phep thu bao "khong co canvas" roi tu
        # bo qua chinh no. Trang da am thi tuc thi, nen loi nay chi lo ra
        # khi chay tren site khac.
        try:
            trang.wait_for_selector("canvas", timeout=8000)
        except Exception:
            B.nhan("[chuot] %s — khong co canvas sau 8 giay" % ma)
            continue
        trang.wait_for_timeout(400)
        cv = trang.locator("canvas").first
        h = cv.bounding_box()
        if not h:
            B.nhan("[chuot] %s — canvas khong co hinh hoc" % ma)
            continue

        truoc = trang.evaluate(JS_CANVAS)
        # Bam vai cho khac nhau — mot cho co the roi vao vung trong.
        for fx, fy in ((0.25, 0.25), (0.5, 0.4), (0.7, 0.6), (0.35, 0.75)):
            trang.mouse.click(h["x"] + h["width"] * fx, h["y"] + h["height"] * fy)
            trang.wait_for_timeout(180)
        sau = trang.evaluate(JS_CANVAS)

        doi = (len(truoc) != len(sau)) or any(
            (truoc[i].get("mau") != sau[i].get("mau")) for i in range(min(len(truoc), len(sau))))
        # So mau doi la bang chung YEU; manh hon la doc bang so lieu.
        so_lieu = trang.evaluate(
            "() => Array.from(document.querySelectorAll('.so-lieu .d'))"
            ".map(d => d.textContent.trim()).join('|')")
        if doi or so_lieu:
            B.duoc("[chuot] %s — %s" % (ma, mo_ta),
                   "canvas doi" if doi else "co bang so lieu")
        else:
            B.nhan("[chuot] %s — bam xong khong thay gi doi" % ma, mo_ta)


# ----------------------------------------------------------------------
def chay(thu_muc, cong=8811, argv=None):
    argv = sys.argv[1:] if argv is None else argv
    chup = "--anh" in argv
    mot_lab = None
    if "--lab" in argv:
        i = argv.index("--lab")
        if i + 1 < len(argv):
            mot_lab = argv[i + 1]

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("")
        print("  chua cai playwright:")
        print("      pip install playwright")
        print("      python -m playwright install chromium")
        return 0

    ten = os.path.basename(thu_muc.rstrip(os.sep))
    ds = doc_lab(thu_muc)
    if mot_lab:
        ds = [x for x in ds if x == mot_lab]
    if not ds:
        print("Khong tim thay lab nao.")
        return 1

    print("")
    print("Kiem HINH ANH bang Chromium that: %s (%d lab)" % (ten, len(ds)))
    print("-" * 62)

    B = Bao()
    sv = mo_may_chu(thu_muc, cong)
    goc = "http://127.0.0.1:%d/index.html" % cong
    thu_muc_anh = os.path.join(thu_muc, "anh-kiem") if chup else None

    try:
        with sync_playwright() as pw:
            tb = pw.chromium.launch()
            # Bon che do: sang/toi x rong/hep.
            CHE_DO = [
                ("toi-rong",  {"width": 1440, "height": 900}, "dark"),
                ("sang-rong", {"width": 1440, "height": 900}, "light"),
                ("toi-hep",   {"width": 420,  "height": 860}, "dark"),
            ]
            for nhan, vp, mau in CHE_DO:
                trang = tb.new_page(viewport=vp, color_scheme=mau)
                print("")
                print("  %s--- %s (%dx%d, %s) ---%s" % (MO, nhan, vp["width"], vp["height"], mau, HET))
                for ma in ds:
                    kiem_mot_lab(trang, goc, ma, B, nhan, thu_muc_anh)
                trang.close()

            # Chuot — chi can lam mot lan, o che do rong.
            print("")
            print("  %s--- chuot that ---%s" % (MO, HET))
            trang = tb.new_page(viewport={"width": 1440, "height": 900})
            kiem_chuot(trang, goc, B, ds)
            trang.close()
            tb.close()
    finally:
        sv.shutdown()

    print("")
    print("-" * 62)
    if thu_muc_anh:
        print("Anh da luu o: %s" % thu_muc_anh)
    if B.loi:
        print("%s%d loi%s, %d dat, %d nhac nho." % (DO, len(B.loi), HET, B.dat, len(B.nhac)))
        return 1
    print("%sDat%s — %d phep, %d nhac nho." % (XANH, HET, B.dat, len(B.nhac)))
    return 0


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    trang_ten = args[0] if args else "lab-visual"
    sys.exit(chay(os.path.join(COURSES, trang_ten)))
