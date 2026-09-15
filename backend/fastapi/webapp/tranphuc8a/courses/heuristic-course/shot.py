#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Chup anh va kiem tra trang bang Chromium co san (khong can them thu vien).

Chay:   python -m http.server 8777 --bind 127.0.0.1     # o mot cua so khac
        python shot.py
"""
import glob
import os
import subprocess
import sys
import tempfile
import urllib.request

BASE = "http://127.0.0.1:8777/"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "_shots")

CAND = (glob.glob(os.path.expanduser(
            "~/AppData/Local/ms-playwright/chromium_headless_shell-*/"
            "chrome-headless-shell-win64/chrome-headless-shell.exe"))
        or glob.glob(os.path.expanduser(
            "~/AppData/Local/ms-playwright/chromium-*/chrome-win64/chrome.exe")))
if not CAND:
    sys.exit("khong tim thay chromium")
CHROME = CAND[0]
SHELL = "headless-shell" in CHROME

SHOTS = [
    ("home-sang",    "",                              1440, 1500, "light"),
    ("home-toi",     "",                              1440, 1500, "dark"),
    ("bai-toi",      "#/khoa-hoc/bai-04-do-luong",    1440, 1700, "dark"),
    ("bai-sang",     "#/khoa-hoc/bai-18-can-tren-can-duoi", 1440, 1700, "light"),
    ("case-sang",    "#/2605/03-de-xuat-cai-tien",    1440, 1700, "light"),
    ("dienthoai",    "#/khoa-hoc/bai-05-greedy",      412,  1100, "light"),
    ("timkiem",      "?q=cuc+tri+cuc+bo",             1440, 900,  "light"),
]


def serve_ok():
    for p in ("index.html", "assets/content.js", "assets/app.js", "assets/app.css"):
        try:
            r = urllib.request.urlopen(BASE + p, timeout=5)
            print("  %-20s %s  %d bytes" % (p, r.status, len(r.read())))
        except Exception as e:
            sys.exit("  %-20s LOI: %s" % (p, e))


def shot(name, route, w, h, theme):
    png = os.path.join(OUT, name + ".png")
    prof = tempfile.mkdtemp(prefix="chr-")
    cmd = [
        CHROME, "--disable-gpu", "--hide-scrollbars",
        "--no-sandbox", "--force-device-scale-factor=1",
        "--user-data-dir=" + prof,
        "--window-size=%d,%d" % (w, h),
        "--screenshot=" + png,
        "--virtual-time-budget=7000",
        "--force-color-profile=srgb",
    ]
    if not SHELL:
        cmd.insert(1, "--headless=new")
    url = BASE + ("?theme=" + theme) + route
    cmd.append(url)
    r = subprocess.run(cmd, capture_output=True, timeout=90)
    ok = os.path.exists(png)
    print("  %-12s %-38s %s" % (name, route or "(trang chu)",
                                "%d KB" % (os.path.getsize(png) // 1024) if ok else "THAT BAI"))
    if not ok:
        print(r.stderr.decode("utf8", "replace")[-500:])


def dump(route, needles):
    """Dung --dump-dom de xac nhan JS chay xong va dung duoc noi dung."""
    prof = tempfile.mkdtemp(prefix="chr-")
    cmd = [CHROME, "--disable-gpu", "--no-sandbox",
           "--user-data-dir=" + prof, "--virtual-time-budget=7000",
           "--dump-dom", BASE + route]
    if not SHELL:
        cmd.insert(1, "--headless=new")
    r = subprocess.run(cmd, capture_output=True, timeout=90)
    html = r.stdout.decode("utf8", "replace")
    print("\n  DOM %s  (%d KB)" % (route or "(trang chu)", len(html) // 1024))
    bad = 0
    for label, s in needles:
        n = html.count(s)
        flag = "OK " if n else "!! "
        if not n:
            bad += 1
        print("    %s %-26s %d" % (flag, label, n))
    return bad


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    print("Kiem tra may chu:")
    serve_ok()

    print("\nKiem tra DOM sau khi JS chay:")
    bad = 0
    bad += dump("", [
        ("the trang chu", 'class="home"'),
        ("the the loai", 'class="kpi"'),
        ("muc luc trai", 'class="nav-i'),
        ("mo ta lo trinh", "Metaheuristic"),
    ])
    bad += dump("#/khoa-hoc/bai-04-do-luong", [
        ("cong thuc KaTeX", 'class="katex'),
        ("to mau ma nguon", 'class="hljs-'),
        ("boc bang", 'class="tw"'),
        ("hop chu y", "cal-"),
        ("khoi ma co nut chep", 'class="cw'),
        ("hinh ASCII", "cw diag"),
        ("muc luc trong bai", 'class="toc-h"'),
        ("neo tieu de", 'class="anch"'),
        ("lien ket noi bo", 'href="#/khoa-hoc/'),
    ])
    bad += dump("#/2605/03-de-xuat-cai-tien", [
        ("cong thuc KaTeX", 'class="katex'),
        ("bang", "<table"),
        ("lien ket ca nghien cuu", 'href="#/2605/'),
        ("lien ket sang khoa hoc", 'href="#/khoa-hoc/'),
    ])

    print("\nKiem tra tim kiem (co dau va khong dau):")
    bad += dump("?q=ablation", [
        ("co ket qua", 'class="r-i'),
        ("khop dung bai ve ablation", "ablation"),
        ("to sang tu khoa", "<mark>"),
    ])
    bad += dump("?q=can+duoi", [
        ("go KHONG DAU van ra ket qua", 'class="r-i'),
        ("to sang tren ban co dau", "<mark>"),
    ])
    bad += dump("?q=zzkhongcogi", [("bao khong tim thay", "srch-empty")])

    print("\nChup anh:")
    for s in SHOTS:
        shot(*s)

    print("\n%s" % ("CO %d MUC KHONG DAT" % bad if bad else "Tat ca kiem tra DOM deu dat."))
