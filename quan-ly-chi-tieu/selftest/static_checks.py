# -*- coding: utf-8 -*-
"""Kiểm tĩnh: tương phản màu WCAG AA từ các token trong kieu.css, cú pháp JS, metadata.json,
không có URL/địa chỉ loopback bị đóng cứng, không tải mã từ bên ngoài."""
from __future__ import annotations

import json
import os
import re
import shutil
import struct
import subprocess


def _lum(hexc: str) -> float:
    h = hexc.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def contrast(a: str, b: str) -> float:
    la, lb = sorted((_lum(a), _lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def tokens(css: str, block_start: str) -> dict[str, str]:
    i = css.index(block_start)
    j = css.index("}", i)
    return dict(re.findall(r"--([\w-]+):\s*(#[0-9a-fA-F]{3,8})", css[i:j]))


PAIRS = [("text", "bg"), ("text", "surface"), ("text2", "surface"), ("text2", "bg"), ("text3", "surface"), ("text3", "bg"), ("text3", "surface2"),
         ("accent", "surface"), ("on-accent", "accent"), ("accent", "accent-bg"), ("chi", "surface"), ("chi", "chi-bg"), ("thu", "surface"),
         ("thu", "thu-bg"), ("warn", "warn-bg"), ("chuyen", "surface"), ("danger", "surface")]


def run(app_dir: str, check, head) -> None:
    head("TẦNG 0 — kiểm tĩnh (tương phản AA, cú pháp, metadata, không mã ngoài)")
    css = open(os.path.join(app_dir, "assets", "kieu.css"), encoding="utf-8").read()
    light = tokens(css, ":root {")
    dark = {**light, **tokens(css, ':root[data-theme="dark"] {')}
    for name, t in (("sáng", light), ("tối", dark)):
        bad = [f"{a}/{b}={contrast(t[a], t[b]):.2f}" for a, b in PAIRS if contrast(t[a], t[b]) < 4.5]
        check(f"tương phản chữ ≥ 4,5:1 ở chủ đề {name} ({len(PAIRS)} cặp màu)", not bad, ", ".join(bad))

    node = shutil.which("node")
    files = [f for f in os.listdir(os.path.join(app_dir, "assets")) if f.endswith(".js")] + ["kiem.js"]
    if node:
        bad = []
        for f in files:
            p = os.path.join(app_dir, f if f == "kiem.js" else os.path.join("assets", f))
            if subprocess.run([node, "--check", p], capture_output=True).returncode != 0:
                bad.append(f)
        check(f"cú pháp {len(files)} file JS hợp lệ (node --check)", not bad, ", ".join(bad))

    meta = json.load(open(os.path.join(app_dir, "metadata.json"), encoding="utf-8"))
    check("metadata.json đủ title/description/tags/icon (portal đọc)", all(meta.get(k) for k in ("title", "description", "tags", "icon")))

    html = open(os.path.join(app_dir, "index.html"), encoding="utf-8").read()
    srcs = re.findall(r'(?:src|href)="([^"]+)"', html)
    ext = [s for s in srcs if re.match(r"^(https?:)?//", s)]
    check("index.html không nạp script/CSS từ bên ngoài", not ext, ", ".join(ext))
    order = [s for s in srcs if s.endswith(".js")]
    check("thứ tự nạp script: module thuần trước ui/views/app", order.index("assets/store.js") < order.index("assets/ui.js") < order.index("assets/views.js") < order.index("assets/dialogs.js") < order.index("assets/app.js"))

    loop = []
    total = 0
    for f in files:
        p = os.path.join(app_dir, f if f == "kiem.js" else os.path.join("assets", f))
        src = open(p, encoding="utf-8").read()
        total += len(src.encode("utf-8"))
        if f != "kiem.js" and re.search(r"(localhost|127\.0\.0\.1)(:\d+)?", src.replace("vd http://localhost:6789/api/v1", "").replace("http://localhost:6789/api/v1", "")):
            loop.append(f)
        if f != "kiem.js" and re.search(r"\beval\s*\(|new Function\s*\(", src):
            loop.append(f + ":eval")
    check("không có địa chỉ loopback đóng cứng, không eval/new Function", not loop, ", ".join(loop))
    css_b = len(css.encode("utf-8"))
    check(f"kích thước tài nguyên ≤ 300 KB (JS không tính kiem.js {(total - os.path.getsize(os.path.join(app_dir, 'kiem.js'))) // 1024} KB + CSS {css_b // 1024} KB)",
          (total - os.path.getsize(os.path.join(app_dir, "kiem.js")) + css_b) <= 300 * 1024)
    pwa(app_dir, html, check)


def png_size(path: str):
    try:
        with open(path, "rb") as f:
            head = f.read(24)
    except OSError:
        return None
    if len(head) < 24 or head[:8] != b"\x89PNG\r\n\x1a\n" or head[12:16] != b"IHDR":
        return None
    return struct.unpack(">II", head[16:24])


def pwa(app_dir: str, html: str, check) -> None:
    """Cài được như ứng dụng: manifest hợp lệ, icon đúng kích thước, mọi tệp service worker sẽ lưu đều có thật."""
    try:
        man = json.load(open(os.path.join(app_dir, "manifest.webmanifest"), encoding="utf-8"))
    except (OSError, ValueError) as e:
        return check("manifest.webmanifest đọc được", False, str(e))
    check("manifest: tên, start_url/scope tương đối, display standalone, màu nền/chủ đạo",
          bool(man.get("name") and man.get("short_name")) and man.get("start_url") == "./" and man.get("scope") == "./"
          and man.get("display") == "standalone" and bool(man.get("theme_color") and man.get("background_color")))
    bad = []
    for ic in man.get("icons", []):
        n = int(ic["sizes"].split("x")[0])
        if png_size(os.path.join(app_dir, *ic["src"].split("/"))) != (n, n):
            bad.append(ic["src"])
    purposes = {ic.get("purpose") for ic in man.get("icons", [])}
    check("manifest: icon 192/512 + maskable có thật, đúng kích thước", not bad and {"any", "maskable"} <= purposes and len(man.get("icons", [])) >= 3, ", ".join(bad))
    touch = re.search(r'<link rel="apple-touch-icon" href="([^"]+)"', html)
    check("index.html: link manifest + apple-touch-icon 180×180 (iOS không đọc icon trong manifest)",
          '<link rel="manifest" href="manifest.webmanifest">' in html and bool(touch) and png_size(os.path.join(app_dir, *touch.group(1).split("/"))) == (180, 180))
    needed = sorted(set(re.findall(r'(?:src|href)="(assets/[^"]+)"', html)))
    missing = [p for p in needed if not os.path.isfile(os.path.join(app_dir, *p.split("/")))]
    check(f"sw.js sẽ lưu {len(needed)} tệp assets/* mà index.html nhắc tới — đủ tệp, không thiếu cái nào (thiếu một cái là cài worker thất bại)", bool(needed) and not missing, ", ".join(missing))
    sw = os.path.join(app_dir, "sw.js")
    node = shutil.which("node")
    ok = os.path.isfile(sw) and (not node or subprocess.run([node, "--check", sw], capture_output=True).returncode == 0)
    check("sw.js ở gốc app, cú pháp hợp lệ", ok)
    src = open(sw, encoding="utf-8").read() if os.path.isfile(sw) else ""
    check("sw.js chỉ xử lý GET, cùng origin, dưới phạm vi app (API đồng bộ nằm ngoài nên không bao giờ bị lưu)",
          all(g in src for g in ('req.method !== "GET"', "url.origin !== self.location.origin", "url.pathname.indexOf(DUONG_DAN) !== 0")))
