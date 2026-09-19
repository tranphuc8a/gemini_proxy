#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Chup anh va kiem tra trang cua khoa nay. May moc nam o engine/chup.py.

Chay:   python -m http.server 8790 --bind 127.0.0.1     # o mot cua so khac
        python shot.py
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(HERE)), "engine"))
import chup

CONG = 8790

SHOTS = [
    ("home-sang",  "",                                              1440, 2100, "light"),
    ("home-toi",   "",                                              1440, 2100, "dark"),
    ("bai-sang",   "#/bai/m02-bai-02-numpy-va-tinh-toan-vector-hoa", 1440, 1700, "light"),
    ("bai-toi",    "#/bai/m01-bai-06-tim-kiem-co-thong-tin-a-sao",  1440, 1700, "dark"),
    ("so-do",      "#/bai/01-ban-do-mon-hoc",                       1440, 1800, "light"),
    ("dien-thoai", "#/bai/m01-bai-03-tac-tu-thong-minh-va-moi-truong", 412, 1100, "light"),
    ("tim-kiem",   "?q=gradient",                                   1440, 900,  "light"),
]

KIEM = [
    ("", [
        ("the trang chu",       'class="home"'),
        ("the the loai (KPI)",  'class="kpi"'),
        ("muc luc trai",        'class="nav-i'),
        ("mo ta mon hoc",       "backprop"),
        ("du 15 mon",           "M15"),
        ("khoi do an",          "Tám đồ án"),
    ]),
    ("#/bai/m02-bai-02-numpy-va-tinh-toan-vector-hoa", [
        ("cong thuc KaTeX",     'class="katex'),
        ("to mau ma nguon",     'class="hljs-'),
        ("boc bang cuon ngang", 'class="tw"'),
        ("hop chu y",           "cal-"),
        ("khoi ma co nut chep", 'class="cw'),
        ("hinh ASCII",          "cw diag"),
        ("muc luc trong bai",   'class="toc-h"'),
        ("neo tieu de",         'class="anch"'),
        ("lien ket noi bo",     'href="#/bai/'),
    ]),
    ("#/bai/01-ban-do-mon-hoc", [
        ("so do mermaid da ve", "<svg"),
        ("bang",                "<table"),
        ("lien ket bai khac",   'href="#/bai/'),
    ]),
    ("#/bai/m01-bai-06-tim-kiem-co-thong-tin-a-sao", [
        ("cong thuc KaTeX", 'class="katex'),
        ("bang", "<table"),
        ("hop chu y", "cal-"),
    ]),
    ("?q=gradient", [
        ("co ket qua", 'class="r-i'),
        ("to sang tu khoa", "<mark>"),
    ]),
    ("?q=hoc sau", [
        ("go KHONG DAU van ra ket qua", 'class="r-i'),
        ("to sang tren ban co dau", "<mark>"),
    ]),
    ("?q=zzkhongcogi", [("bao khong tim thay", "srch-empty")]),
]

if __name__ == "__main__":
    sys.exit(1 if chup.chay(HERE, CONG, SHOTS, KIEM) else 0)
