# -*- coding: utf-8 -*-
"""kiem-hinh.py — kiem HINH ANH ba ung dung tu viet bang Chromium that.

    python kiem-hinh.py              # ca ba
    python kiem-hinh.py json-editor  # mot cai
    python kiem-hinh.py --anh        # kem chup anh

Vi sao can rieng tep nay: `kiem.js` cua moi ung dung CO Y chi kiem ham
thuan — no khong cham DOM. Nghia la toan bo phan giao dien chua duoc kiem
gi ca, va ba ung dung nay THUAN GIAO DIEN hon lab nhieu.

Cung bo phep do voi courses/engine/kiem_hinh.py:
  1. trang co nem loi khong
  2. cac hop co de len nhau khong (loc quan he cha-con)
  3. co tran ngang khong
  4. sang/toi x rong/hep
  5. bam thu vao cac nut chinh, xem co no khong

Them mot phep rieng cho ung dung: NUT BAM PHAI DU TO DE CHAM TAY. Duoi
44x44 px la kho bam tren dien thoai — day la nguong WCAG khuyen nghi.
"""
from __future__ import annotations

import http.server
import os
import socketserver
import sys
import threading

HERE = os.path.dirname(os.path.abspath(__file__))

XANH, DO, VANG, MO, HET = "\033[32m", "\033[31m", "\033[33m", "\033[36m", "\033[0m"

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


class Im(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


class MayChu(socketserver.ThreadingTCPServer):
    """Phai la Threading + hang doi lon — xem ghi chu trong courses/engine."""
    daemon_threads = True
    allow_reuse_address = True
    request_queue_size = 128


JS_DE_NHAU = r"""
(arg) => {
  const ds = [];
  for (const e of document.querySelectorAll(arg.chon)) {
    const r = e.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const s = getComputedStyle(e);
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) continue;
    if (s.position === 'absolute' || s.position === 'fixed') continue;
    ds.push({ e: e, t: (e.textContent || '').trim().slice(0, 36), r: r });
  }
  const cap = [];
  for (let i = 0; i < ds.length; i++) {
    for (let j = i + 1; j < ds.length; j++) {
      const a = ds[i], b = ds[j];
      if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
      const gx = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const gy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (gx > arg.choPhep && gy > arg.choPhep) {
        cap.push({ a: a.t, b: b.t, gx: Math.round(gx), gy: Math.round(gy) });
      }
    }
  }
  return { so: ds.length, cap: cap };
}
"""

JS_TRAN = r"""
() => ({
  cuon: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  rongTrang: document.documentElement.clientWidth,
  rongNoiDung: document.documentElement.scrollWidth
})
"""

# Nut qua nho thi khong bam duoc bang ngon tay. 44x44 la nguong WCAG 2.5.5.
JS_NUT_NHO = r"""
(nguong) => {
  const nho = [];
  for (const b of document.querySelectorAll('button, .nut, .the, .tab-n, .o-nhom')) {
    const r = b.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const s = getComputedStyle(b);
    if (s.display === 'none' || s.visibility === 'hidden') continue;
    if (r.height < nguong) {
      nho.push({ t: (b.textContent || '').trim().slice(0, 22),
                 w: Math.round(r.width), h: Math.round(r.height) });
    }
  }
  return nho;
}
"""


class Bao:
    def __init__(self):
        self.loi = []
        self.nhac = []
        self.dat = 0

    def duoc(self, c, ct=""):
        self.dat += 1
        print("  %s[ok]%s   %s%s" % (XANH, HET, c, ("   " + ct) if ct else ""))

    def sai(self, c, ct=""):
        self.loi.append((c, ct))
        print("  %s[LOI]%s  %s%s" % (DO, HET, c, ("   " + ct) if ct else ""))

    def nhan(self, c, ct=""):
        self.nhac.append((c, ct))
        print("  %s[nhac]%s %s%s" % (VANG, HET, c, ("   " + ct) if ct else ""))


def kiem_mot(trang, goc, ten_ud, B, che_do, chup_vao=None):
    nhat_ky = []
    trang.on("console", lambda m: nhat_ky.append(m.text) if m.type == "error" else None)
    trang.on("pageerror", lambda e: nhat_ky.append(str(e)))

    try:
        trang.goto(goc, wait_until="networkidle", timeout=20000)
    except Exception as e:
        B.sai("[%s] %s — khong mo duoc" % (che_do, ten_ud), str(e)[:150])
        return
    trang.wait_for_timeout(700)

    ten = "[%s] %s" % (che_do, ten_ud)
    if nhat_ky:
        B.sai(ten + " — loi khi chay", nhat_ky[0][:200])
        return
    B.duoc(ten + " — nap sach, khong loi console")

    t = trang.evaluate(JS_TRAN)
    if t["cuon"] > 4:
        B.sai(ten + " — TRAN ngang",
              "%dpx > %dpx" % (t["rongNoiDung"], t["rongTrang"]))
    else:
        B.duoc(ten + " — khong tran ngang")

    kq = trang.evaluate(JS_DE_NHAU, {
        "chon": "button, .nut, .the, .tab-n, .o-nhom, .o-tom, .han-dat, .khoan, label",
        "choPhep": 2.0,
    })
    if kq["cap"]:
        c = kq["cap"][0]
        B.sai(ten + " — %d cap DE LEN NHAU" % len(kq["cap"]),
              "%r x %r (%dx%d px)" % (c["a"][:20], c["b"][:20], c["gx"], c["gy"]))
    else:
        B.duoc(ten + " — %d phan tu, khong cai nao de len nhau" % kq["so"])

    nho = trang.evaluate(JS_NUT_NHO, 30)
    if nho:
        B.nhan(ten + " — %d nut cao duoi 30px, kho cham tay" % len(nho),
               "%r %dx%d" % (nho[0]["t"], nho[0]["w"], nho[0]["h"]))

    if chup_vao:
        os.makedirs(chup_vao, exist_ok=True)
        trang.screenshot(path=os.path.join(chup_vao, "%s--%s.png" % (ten_ud, che_do)),
                         full_page=True)


def kiem_bam(trang, goc, ten_ud, B):
    """Bam qua cac nut / tab chinh, xem co nem loi khong.

    Khong khang dinh ket qua DUNG — chi khang dinh KHONG NO. Do la gioi
    han that su cua tang nay va phai noi ro.
    """
    nhat_ky = []
    trang.on("pageerror", lambda e: nhat_ky.append(str(e)))
    trang.on("console", lambda m: nhat_ky.append(m.text) if m.type == "error" else None)
    try:
        trang.goto(goc, wait_until="networkidle", timeout=20000)
    except Exception as e:
        B.nhan("[bam] %s — khong mo duoc" % ten_ud, str(e)[:120])
        return
    trang.wait_for_timeout(500)

    # Tab / the loc truoc, roi cac nut khong pha huy du lieu.
    dem = 0
    for chon in [".tab-n", ".the"]:
        n = trang.locator(chon)
        for i in range(min(n.count(), 8)):
            try:
                n.nth(i).click(timeout=2500)
                trang.wait_for_timeout(120)
                dem += 1
            except Exception:
                pass
    for nhan in ["Định dạng", "Nén", "Sắp khoá", "Chạy", "So sánh"]:
        b = trang.get_by_role("button", name=nhan)
        try:
            if b.count():
                b.first.click(timeout=2500)
                trang.wait_for_timeout(150)
                dem += 1
        except Exception:
            pass

    if nhat_ky:
        B.sai("[bam] %s — bam xong sinh loi" % ten_ud, nhat_ky[0][:180])
    else:
        B.duoc("[bam] %s — bam %d cho, khong cho nao nem loi" % (ten_ud, dem))


def chay(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    chup = "--anh" in argv
    chon = [a for a in argv if not a.startswith("--")]

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("\n  chua cai playwright:\n      pip install playwright"
              "\n      python -m playwright install chromium")
        return 0

    ud = sorted(d for d in os.listdir(HERE)
                if os.path.isdir(os.path.join(HERE, d))
                and os.path.exists(os.path.join(HERE, d, "kiem.js")))
    if chon:
        ud = [d for d in ud if d in chon]
    if not ud:
        print("Khong tim thay ung dung nao co kiem.js.")
        return 1

    print("")
    print("Kiem HINH ANH %d ung dung bang Chromium that" % len(ud))
    print("-" * 62)

    B = Bao()
    sv = MayChu(("127.0.0.1", 8833), lambda *a, **k: Im(*a, directory=HERE, **k))
    threading.Thread(target=sv.serve_forever, daemon=True).start()
    thu_muc_anh = os.path.join(HERE, "anh-kiem") if chup else None

    try:
        with sync_playwright() as pw:
            tb = pw.chromium.launch()
            for nhan, vp, mau in [
                ("toi-rong", {"width": 1440, "height": 900}, "dark"),
                ("sang-rong", {"width": 1440, "height": 900}, "light"),
                ("toi-hep", {"width": 420, "height": 860}, "dark"),
            ]:
                trang = tb.new_page(viewport=vp, color_scheme=mau)
                print("")
                print("  %s--- %s (%dx%d, %s) ---%s"
                      % (MO, nhan, vp["width"], vp["height"], mau, HET))
                for d in ud:
                    kiem_mot(trang, "http://127.0.0.1:8833/%s/index.html" % d,
                             d, B, nhan, thu_muc_anh)
                trang.close()

            print("")
            print("  %s--- bam thu ---%s" % (MO, HET))
            trang = tb.new_page(viewport={"width": 1440, "height": 900})
            for d in ud:
                kiem_bam(trang, "http://127.0.0.1:8833/%s/index.html" % d, d, B)
            trang.close()
            tb.close()
    finally:
        sv.shutdown()
        sv.server_close()

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
    sys.exit(chay())
