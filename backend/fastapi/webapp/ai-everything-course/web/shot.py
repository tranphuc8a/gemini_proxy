#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Chup anh va kiem tra trang bang Chromium co san (khong can them thu vien).

Chay:   python -m http.server 8790 --bind 127.0.0.1     # o mot cua so khac
        python shot.py
"""
import glob
import os
import subprocess
import sys
import tempfile
import urllib.request

BASE = "http://127.0.0.1:8790/"
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
    ("home-sang",  "",                                              1440, 2100, "light"),
    ("home-toi",   "",                                              1440, 2100, "dark"),
    ("bai-sang",   "#/bai/m02-bai-02-numpy-va-tinh-toan-vector-hoa", 1440, 1700, "light"),
    ("bai-toi",    "#/bai/m01-bai-06-tim-kiem-co-thong-tin-a-sao",  1440, 1700, "dark"),
    ("so-do",      "#/bai/01-ban-do-mon-hoc",                       1440, 1800, "light"),
    ("dien-thoai", "#/bai/m01-bai-03-tac-tu-thong-minh-va-moi-truong", 412, 1100, "light"),
    ("tim-kiem",   "?q=gradient",                                   1440, 900,  "light"),
]

NEEDLE_HOME = [
    ("the trang chu",       'class="home"'),
    ("the the loai (KPI)",  'class="kpi"'),
    ("muc luc trai",        'class="nav-i'),
    ("mo ta mon hoc",       "backprop"),
    ("du 15 mon",           "M15"),
    ("khoi do an",          "Tám đồ án"),
]

NEEDLE_BAI = [
    ("cong thuc KaTeX",     'class="katex'),
    ("to mau ma nguon",     'class="hljs-'),
    ("boc bang cuon ngang", 'class="tw"'),
    ("hop chu y",           "cal-"),
    ("khoi ma co nut chep", 'class="cw'),
    ("hinh ASCII",          "cw diag"),
    ("muc luc trong bai",   'class="toc-h"'),
    ("neo tieu de",         'class="anch"'),
    ("lien ket noi bo",     'href="#/bai/'),
]

NEEDLE_SODO = [
    ("so do mermaid da ve", "<svg"),
    ("bang",                "<table"),
    ("lien ket bai khac",   'href="#/bai/'),
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
        "--virtual-time-budget=9000",
        "--force-color-profile=srgb",
    ]
    if not SHELL:
        cmd.insert(1, "--headless=new")
    cmd.append(BASE + ("?theme=" + theme) + route)
    r = subprocess.run(cmd, capture_output=True, timeout=120)
    ok = os.path.exists(png)
    print("  %-12s %-52s %s" % (name, route or "(trang chu)",
                                "%d KB" % (os.path.getsize(png) // 1024) if ok else "THAT BAI"))
    if not ok:
        print(r.stderr.decode("utf8", "replace")[-500:])


def dump(route, needles):
    """Dung --dump-dom de xac nhan JS chay xong va dung duoc noi dung."""
    prof = tempfile.mkdtemp(prefix="chr-")
    cmd = [CHROME, "--disable-gpu", "--no-sandbox",
           "--user-data-dir=" + prof, "--virtual-time-budget=9000",
           "--dump-dom", BASE + route]
    if not SHELL:
        cmd.insert(1, "--headless=new")
    r = subprocess.run(cmd, capture_output=True, timeout=120)
    html = r.stdout.decode("utf8", "replace")
    print("\n  DOM %s  (%d KB)" % (route or "(trang chu)", len(html) // 1024))
    bad = 0
    for label, s in needles:
        n = html.count(s)
        if not n:
            bad += 1
        print("    %s %-26s %d" % ("OK " if n else "!! ", label, n))
    return bad


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    print("Kiem tra may chu:")
    serve_ok()

    print("\nKiem tra DOM sau khi JS chay:")
    bad = 0
    bad += dump("", NEEDLE_HOME)
    bad += dump("#/bai/m02-bai-02-numpy-va-tinh-toan-vector-hoa", NEEDLE_BAI)
    bad += dump("#/bai/01-ban-do-mon-hoc", NEEDLE_SODO)
    bad += dump("#/bai/m01-bai-06-tim-kiem-co-thong-tin-a-sao", [
        ("cong thuc KaTeX", 'class="katex'),
        ("bang", "<table"),
        ("hop chu y", "cal-"),
    ])

    print("\nKiem tra tim kiem (co dau va khong dau):")
    bad += dump("?q=gradient", [
        ("co ket qua", 'class="r-i'),
        ("to sang tu khoa", "<mark>"),
    ])
    bad += dump("?q=hoc sau", [
        ("go KHONG DAU van ra ket qua", 'class="r-i'),
        ("to sang tren ban co dau", "<mark>"),
    ])
    bad += dump("?q=zzkhongcogi", [("bao khong tim thay", "srch-empty")])

    print("\nChup anh:")
    for s in SHOTS:
        shot(*s)

    print("\n%s" % ("CO %d MUC KHONG DAT" % bad if bad else "Tat ca kiem tra DOM deu dat."))
