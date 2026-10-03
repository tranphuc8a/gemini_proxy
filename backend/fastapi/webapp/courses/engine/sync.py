#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Chep engine tu courses/engine/ sang assets/ cua cac trang dich.

Nguon that la thu muc nay. Moi ban trong */assets/ deu la ban sao — sua o
do se mat khi chay lai lenh nay.

Cac bo engine, khai bao trong dong-bo.json:
  · vis-core.js + vis.css   -> cac trang lab *-visual        (khoa "tep"/"dich")
  · app.js + app.css + hien-thi.js/.css -> trang doc bai     (khoa "khoa_hoc")
  · hien-thi.js/.css        -> trang Quan ly khoa hoc         (khoa "quan_ly")
  · pwa.js -> assets/, sw.js -> GOC trang ("vao": ".")     (khoa "pwa", "pwa_goc")
  Moi khoa khac co dang {"tep": [...], "dich": [...], "vao"?: "assets"} cung la
  mot bo; "vao" la thu muc con cua trang nhan tep (mac dinh assets/).

    python sync.py                 # chep sang moi trang trong dong-bo.json
    python sync.py lab-visual      # chi mot trang (tu biet trang thuoc bo nao)
    python sync.py --tat-ca        # moi thu muc *-visual + moi trang khoa hoc
    python sync.py --thu           # chi bao se lam gi, khong ghi
    python sync.py --kiem          # kiem tra ban sao co lech nguon khong
                                   #   (exit code 1 neu lech — dung cho CI)

Khong phu thuoc thu vien ngoai.
"""
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
COURSES = os.path.dirname(HERE)

BANG_HIEU = (
    "/* ==========================================================================\n"
    "   FILE SINH RA — DUNG SUA O DAY.\n"
    "   Nguon that: courses/engine/{ten}\n"
    "   Sua o do roi chay: python engine/sync.py\n"
    "   ========================================================================== */\n"
)


def doc_cau_hinh():
    p = os.path.join(HERE, "dong-bo.json")
    if not os.path.exists(p):
        return {"tep": ["vis-core.js", "vis.css"], "dich": []}
    with io.open(p, encoding="utf-8") as f:
        return json.load(f)


def moi_trang_visual():
    ds = []
    for ten in sorted(os.listdir(COURSES)):
        d = os.path.join(COURSES, ten)
        if not os.path.isdir(d) or ten == "engine":
            continue
        if os.path.isdir(os.path.join(d, "assets")) and ten.endswith("-visual"):
            ds.append(ten)
    return ds


def noi_dung_dich(ten_tep):
    """Noi dung nguon + bang hieu 'file sinh ra' o dau."""
    with io.open(os.path.join(HERE, ten_tep), encoding="utf-8", newline="") as f:
        goc = f.read()
    return BANG_HIEU.format(ten=ten_tep) + goc


def chay(dich, tep, thu=False, chi_kiem=False, vao="assets"):
    """Chep `tep` vao <trang>/<vao>/ cua moi trang. vao=".": goc cua trang (sw.js
    phai nam o day — pham vi mac dinh cua service worker la thu muc chua no)."""
    so_ghi = so_lech = so_bo_qua = 0
    for trang in dich:
        if not os.path.isdir(os.path.join(COURSES, trang, "assets")):
            print("  [bo qua] %-26s khong co thu muc assets/" % trang)
            so_bo_qua += 1
            continue
        thu_muc = os.path.normpath(os.path.join(COURSES, trang, vao))
        nhan = trang if vao in (".", "") else trang + "/" + vao
        for ten in tep:
            nguon = os.path.join(HERE, ten)
            if not os.path.exists(nguon):
                print("  [LOI]    khong tim thay nguon engine/%s" % ten)
                so_lech += 1
                continue
            moi = noi_dung_dich(ten)
            ra = os.path.join(thu_muc, ten)
            cu = None
            if os.path.exists(ra):
                with io.open(ra, encoding="utf-8", newline="") as f:
                    cu = f.read()
            if cu == moi:
                print("  [khop]   %s/%s" % (nhan, ten))
                continue
            if chi_kiem:
                print("  [LECH]   %s/%s" % (nhan, ten))
                so_lech += 1
                continue
            if thu:
                print("  [se ghi] %s/%s" % (nhan, ten))
                so_ghi += 1
                continue
            with io.open(ra, "w", encoding="utf-8", newline="") as f:
                f.write(moi)
            print("  [ghi]    %s/%s  (%d byte)" % (nhan, ten, len(moi.encode("utf-8"))))
            so_ghi += 1
    return so_ghi, so_lech, so_bo_qua


def _cac_nhom(ch):
    """(ten, tep, dich, vao) cua moi bo khai bao kieu {"tep", "dich", "vao"?} ngoai bo goc."""
    out = []
    for ten, v in ch.items():
        if isinstance(v, dict) and isinstance(v.get("tep"), list) and isinstance(v.get("dich"), list):
            out.append((ten, v["tep"], v["dich"], v.get("vao", "assets")))
    return out


def cac_bo(ch, ten_rieng, tat_ca):
    """[(tep, dich, vao)] cho tung bo engine. Trang dat ten rieng di vao (moi) bo co no."""
    vis_tep = ch.get("tep", ["vis-core.js", "vis.css"])
    nhom = _cac_nhom(ch)
    out = []
    if ten_rieng:
        da_khai = set(ch.get("dich", []))
        for _ten, _tep, dich, _vao in nhom:
            da_khai.update(dich)
        da_chon = set()
        for ten, tep, dich, vao in nhom:
            # trang *-course CHUA khai bao o dau thi mac dinh nhan engine doc bai (trang da
            # khai bao nhu opic-course co app.js rieng — khong duoc ghi de)
            chon = [t for t in ten_rieng
                    if t in dich or (ten == "khoa_hoc" and t.endswith("-course") and t not in da_khai)]
            if chon and tep:
                out.append((tep, chon, vao))
                da_chon.update(chon)
        con_lai = [t for t in ten_rieng if t in ch.get("dich", []) or t not in da_chon]
        if con_lai:
            out.insert(0, (vis_tep, con_lai, "assets"))
        return out
    bo_vis = moi_trang_visual() if tat_ca else ch.get("dich", [])
    if bo_vis:
        out.append((vis_tep, bo_vis, "assets"))
    for _ten, tep, dich, vao in nhom:
        if dich and tep:
            out.append((tep, list(dich), vao))
    return out


def ban_sao_lech(trang):
    """Tep engine `trang` phai nhan (theo dong-bo.json) ma thieu hoac khac nguon, dang
    "assets/app.js", "sw.js"… Rong = khop het. check.py cua cac trang dung de bao som."""
    lech = []
    for tep, _dich, vao in cac_bo(doc_cau_hinh(), [trang], False):
        for ten in tep:
            nhan = ten if vao in (".", "") else vao + "/" + ten
            ra = os.path.join(COURSES, trang, vao, ten)
            if not os.path.exists(ra):
                lech.append(nhan + " (thieu)")
                continue
            with io.open(ra, encoding="utf-8", newline="") as f:
                if f.read() != noi_dung_dich(ten):
                    lech.append(nhan)
    return lech


def main(argv):
    ch = doc_cau_hinh()
    thu = "--thu" in argv
    chi_kiem = "--kiem" in argv
    tat_ca = "--tat-ca" in argv
    ten_rieng = [a for a in argv if not a.startswith("-")]

    bo = cac_bo(ch, ten_rieng, tat_ca)
    if not bo:
        print("Khong co trang dich nao. Them vao engine/dong-bo.json hoac dung --tat-ca.")
        return 0

    so_ghi = so_lech = so_bo_qua = 0
    for tep, dich, vao in bo:
        print("Nguon : courses/engine/  (%s)" % ", ".join(tep))
        print("Dich  : %s%s%s" % (", ".join(dich), "  (goc trang)" if vao in (".", "") else "",
                                 "   [CHI THU]" if thu else ""))
        print("")
        g, l, b = chay(dich, tep, thu=thu, chi_kiem=chi_kiem, vao=vao)
        so_ghi, so_lech, so_bo_qua = so_ghi + g, so_lech + l, so_bo_qua + b
        print("")

    if chi_kiem:
        if so_lech:
            print("LECH: %d tep khac nguon. Chay `python sync.py` de dong bo." % so_lech)
            return 1
        print("Moi ban sao khop nguon.")
        return 0

    print("Xong: %d tep %s, %d trang bo qua." % (so_ghi, "se ghi" if thu else "da ghi", so_bo_qua))
    if so_lech:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
