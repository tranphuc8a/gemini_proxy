#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Chup anh va kiem tra trang cua khoa nay. May moc nam o engine/chup.py.

Chay:   python -m http.server 8777 --bind 127.0.0.1     # o mot cua so khac
        python shot.py
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(HERE)), "engine"))
import chup

CONG = 8777

SHOTS = [
    ("home-sang",    "",                                    1440, 1500, "light"),
    ("home-toi",     "",                                    1440, 1500, "dark"),
    ("bai-toi",      "#/khoa-hoc/bai-04-do-luong",          1440, 1700, "dark"),
    ("bai-sang",     "#/khoa-hoc/bai-18-can-tren-can-duoi", 1440, 1700, "light"),
    ("case-sang",    "#/2605/03-de-xuat-cai-tien",          1440, 1700, "light"),
    ("dienthoai",    "#/khoa-hoc/bai-05-greedy",            412,  1100, "light"),
    ("timkiem",      "?q=cuc+tri+cuc+bo",                   1440, 900,  "light"),
]

KIEM = [
    ("", [
        ("the trang chu", 'class="home"'),
        ("the the loai", 'class="kpi"'),
        ("muc luc trai", 'class="nav-i'),
        ("mo ta lo trinh", "Metaheuristic"),
    ]),
    ("#/khoa-hoc/bai-04-do-luong", [
        ("cong thuc KaTeX", 'class="katex'),
        ("to mau ma nguon", 'class="hljs-'),
        ("boc bang", 'class="tw"'),
        ("hop chu y", "cal-"),
        ("khoi ma co nut chep", 'class="cw'),
        ("hinh ASCII", "cw diag"),
        ("muc luc trong bai", 'class="toc-h"'),
        ("neo tieu de", 'class="anch"'),
        ("lien ket noi bo", 'href="#/khoa-hoc/'),
    ]),
    ("#/2605/03-de-xuat-cai-tien", [
        ("cong thuc KaTeX", 'class="katex'),
        ("lien ket ca nghien cuu", 'href="#/2605/'),
        ("lien ket sang khoa hoc", 'href="#/khoa-hoc/'),
    ]),
    ("?q=ablation", [
        ("co ket qua", 'class="r-i'),
        ("khop dung bai ve ablation", "ablation"),
        ("to sang tu khoa", "<mark>"),
    ]),
    ("?q=can+duoi", [
        ("go KHONG DAU van ra ket qua", 'class="r-i'),
        ("to sang tren ban co dau", "<mark>"),
    ]),
    ("?q=zzkhongcogi", [("bao khong tim thay", "srch-empty")]),
]

if __name__ == "__main__":
    sys.exit(1 if chup.chay(HERE, CONG, SHOTS, KIEM) else 0)
