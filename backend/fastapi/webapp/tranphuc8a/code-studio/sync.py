#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Chep ma dung chung cua Code Studio sang cac app khac (khong build, khong phu thuoc ngoai).

Nguon that: thu muc nay (tranphuc8a/code-studio/). Moi ban trong assets/cs/ cua app dich la ban sao
-- sua o do se mat khi chay lai lenh nay. App dich hien co:
  · courses/heuristic-practice-2  -> assets/cs/   (IDE C/C++ online: trinh soan, dinh dang, goi y, chay online, kho doan ma)

    python sync.py          # chep sang moi app dich
    python sync.py --thu    # chi bao se lam gi, khong ghi
    python sync.py --kiem   # kiem tra ban sao co lech nguon khong (exit code 1 neu lech -- dung cho CI)
"""
import io
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
WEBAPP = os.path.dirname(os.path.dirname(HERE))          # backend/fastapi/webapp

# (tep nguon tuong doi voi thu muc nay, ten tep dich)
TEP = [
    ("assets/core/langs.js", "langs.js"),
    ("assets/core/tokenize.js", "tokenize.js"),
    ("assets/core/format.js", "format.js"),
    ("assets/core/format-ext.js", "format-ext.js"),
    ("assets/core/complete.js", "complete.js"),
    ("assets/core/project.js", "project.js"),
    ("assets/core/store.js", "store.js"),
    ("assets/core/runner.js", "runner.js"),
    ("assets/ui/editor.js", "editor.js"),
    ("assets/editor.css", "editor.css"),
]
# app dich: (duong dan tuong doi voi webapp/, thu muc con nhan tep)
DICH = [("courses/heuristic-practice-2", "assets/cs")]

BANG_HIEU = (
    "/* ==========================================================================\n"
    "   FILE SINH RA - DUNG SUA O DAY.\n"
    "   Nguon that: tranphuc8a/code-studio/{nguon}\n"
    "   Sua o do roi chay: python tranphuc8a/code-studio/sync.py\n"
    "   ========================================================================== */\n"
)


def doc(p):
    with io.open(p, encoding="utf-8", newline="") as f:
        return f.read()


def noi_dung_dich(nguon_rel):
    s = doc(os.path.join(HERE, nguon_rel.replace("/", os.sep)))
    return BANG_HIEU.replace("{nguon}", nguon_rel) + s.replace("\r\n", "\n")


def main():
    thu = "--thu" in sys.argv
    kiem = "--kiem" in sys.argv
    lech = 0
    for app, con in DICH:
        thu_muc = os.path.join(WEBAPP, app.replace("/", os.sep), con.replace("/", os.sep))
        for nguon_rel, ten in TEP:
            nguon = os.path.join(HERE, nguon_rel.replace("/", os.sep))
            dich = os.path.join(thu_muc, ten)
            if not os.path.exists(nguon):
                print("THIEU nguon: %s" % nguon_rel)
                lech += 1
                continue
            moi = noi_dung_dich(nguon_rel)
            cu = doc(dich).replace("\r\n", "\n") if os.path.exists(dich) else None
            if cu == moi:
                continue
            if kiem:
                print("LECH: %s/%s/%s" % (app, con, ten))
                lech += 1
            elif thu:
                print("se ghi: %s/%s/%s" % (app, con, ten))
            else:
                os.makedirs(thu_muc, exist_ok=True)
                with io.open(dich, "w", encoding="utf-8", newline="\n") as f:
                    f.write(moi)
                print("da ghi: %s/%s/%s" % (app, con, ten))
    if kiem:
        print("OK - cac ban sao khop nguon." if not lech else "%d tep lech nguon (chay: python tranphuc8a/code-studio/sync.py)" % lech)
        return 1 if lech else 0
    return 1 if lech else 0


if __name__ == "__main__":
    sys.exit(main())
