#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Chup anh va kiem tra trang cua khoa nay. May moc nam o engine/chup.py.

Chay:   python -m http.server 8788 --bind 127.0.0.1     # o mot cua so khac
        python shot.py
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(HERE)), "engine"))
import chup

CONG = 8788

SHOTS = [
    ("home-sang",  "",                                        1440, 1600, "light"),
    ("home-toi",   "",                                        1440, 1600, "dark"),
    ("bai-sang",   "#/bai/bai-02-do-tre-thong-luong-capacity", 1440, 1700, "light"),
    ("bai-toi",    "#/bai/bai-20-partitioning-sharding",       1440, 1700, "dark"),
    ("tailieu",    "#/tai-lieu/so-lieu-can-nho",               1440, 1500, "light"),
    ("dienthoai",  "#/bai/bai-10-caching-can-ban",             412,  1100, "light"),
    ("timkiem",    "?q=sharding",                              1440, 900,  "light"),
]

KIEM = [
    ("", [
        ("the trang chu", 'class="home"'),
        ("the the loai", 'class="kpi"'),
        ("muc luc trai", 'class="nav-i'),
        ("mo ta lo trinh", "Hệ phân tán"),
    ]),
    ("#/bai/bai-02-do-tre-thong-luong-capacity", [
        ("cong thuc KaTeX", 'class="katex'),
        ("to mau ma nguon", 'class="hljs-'),
        ("boc bang", 'class="tw"'),
        ("hop chu y", "cal-"),
        ("khoi ma co nut chep", 'class="cw'),
        ("hinh ASCII", "cw diag"),
        ("muc luc trong bai", 'class="toc-h"'),
        ("neo tieu de", 'class="anch"'),
        ("lien ket noi bo", 'href="#/bai/'),
    ]),
    ("#/bai/bai-33-raft-di-sau", [
        ("hop chu y", "cal-"),
        ("lien ket bai khac", 'href="#/bai/'),
    ]),
    ("#/do-an/p3-replicated-kv", [
        ("noi dung do an", "Raft"),
        ("khoi ma", 'class="cw'),
    ]),
    ("?q=sharding", [
        ("co ket qua", 'class="r-i'),
        ("khop dung bai ve sharding", "sharding"),
        ("to sang tu khoa", "<mark>"),
    ]),
    ("?q=nhat+quan", [
        ("go KHONG DAU van ra ket qua", 'class="r-i'),
        ("to sang tren ban co dau", "<mark>"),
    ]),
    ("?q=zzkhongcogi", [("bao khong tim thay", "srch-empty")]),
]

if __name__ == "__main__":
    sys.exit(1 if chup.chay(HERE, CONG, SHOTS, KIEM) else 0)
