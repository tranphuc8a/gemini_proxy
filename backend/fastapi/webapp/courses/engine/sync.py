#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Chep engine tu courses/engine/ sang assets/ cua cac trang dich.

Nguon that la thu muc nay. Moi ban trong */assets/ deu la ban sao — sua o
do se mat khi chay lai lenh nay.

    python sync.py                 # chep sang cac trang trong dong-bo.json
    python sync.py lab-visual      # chi mot trang
    python sync.py --tat-ca        # moi thu muc *-visual tim thay duoc
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


def chay(dich, tep, thu=False, chi_kiem=False):
    so_ghi = so_lech = so_bo_qua = 0
    for trang in dich:
        thu_muc = os.path.join(COURSES, trang, "assets")
        if not os.path.isdir(thu_muc):
            print("  [bo qua] %-26s khong co thu muc assets/" % trang)
            so_bo_qua += 1
            continue
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
                print("  [khop]   %s/assets/%s" % (trang, ten))
                continue
            if chi_kiem:
                print("  [LECH]   %s/assets/%s" % (trang, ten))
                so_lech += 1
                continue
            if thu:
                print("  [se ghi] %s/assets/%s" % (trang, ten))
                so_ghi += 1
                continue
            with io.open(ra, "w", encoding="utf-8", newline="") as f:
                f.write(moi)
            print("  [ghi]    %s/assets/%s  (%d byte)" % (trang, ten, len(moi.encode("utf-8"))))
            so_ghi += 1
    return so_ghi, so_lech, so_bo_qua


def main(argv):
    ch = doc_cau_hinh()
    tep = ch.get("tep", ["vis-core.js", "vis.css"])
    thu = "--thu" in argv
    chi_kiem = "--kiem" in argv
    tat_ca = "--tat-ca" in argv
    ten_rieng = [a for a in argv if not a.startswith("-")]

    if ten_rieng:
        dich = ten_rieng
    elif tat_ca:
        dich = moi_trang_visual()
    else:
        dich = ch.get("dich", [])

    if not dich:
        print("Khong co trang dich nao. Them vao engine/dong-bo.json hoac dung --tat-ca.")
        return 0

    print("Nguon : courses/engine/  (%s)" % ", ".join(tep))
    print("Dich  : %s%s" % (", ".join(dich), "   [CHI THU]" if thu else ""))
    print("")
    so_ghi, so_lech, so_bo_qua = chay(dich, tep, thu=thu, chi_kiem=chi_kiem)
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
