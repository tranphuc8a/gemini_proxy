#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Dựng phần PWA của cổng: biểu tượng, ảnh chụp cho hộp thoại cài đặt, và ĐÓNG DẤU phiên bản vào sw.js.

    backend\\fastapi\\.venv\\Scripts\\python.exe backend\\fastapi\\webapp\\_portal\\tao-pwa.py            # chỉ đóng dấu
    ... tao-pwa.py --icons          # vẽ lại biểu tượng (cần Pillow) rồi đóng dấu
    ... tao-pwa.py --anh            # chụp lại assets/shots/*.png bằng Chromium thật (cần playwright) rồi đóng dấu
    ... tao-pwa.py --kiem           # chỉ kiểm: dấu trong sw.js còn khớp nội dung vỏ không (exit 1 nếu lệch)

Vì sao phải đóng dấu: sw.js là một tệp tĩnh. Trình duyệt chỉ cài worker mới khi BYTE của sw.js đổi; nếu sửa giao diện mà sw.js
không đổi, máy đã cài sẽ không bao giờ biết có bản mới. PHIEN_BAN là dấu băm nội dung vỏ (portal.html, cấu hình, manifest,
assets/css, assets/js, assets/icons) nên đổi tệp nào thì dấu đổi theo. Xuống dòng CRLF/LF được chuẩn hoá trước khi băm
(git autocrlf trên Windows không được làm dấu lệch).
"""
import hashlib
import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ICONS = os.path.join(HERE, "assets", "icons")
SHOTS = os.path.join(HERE, "assets", "shots")
SW = os.path.join(HERE, "sw.js")
TEXT_EXT = {".html", ".css", ".js", ".json", ".webmanifest"}
DAU_RE = re.compile(r'^var PHIEN_BAN = "[^"]*";', re.M)


def tep_vo():
    """Các tệp mà người dùng tải về để chạy cổng (không gồm ảnh chụp cài đặt, sw.js và công cụ kiểm)."""
    out = ["portal.html", "portal.config.json", "manifest.webmanifest"]
    for sub in ("assets/css", "assets/js", "assets/icons"):
        for dp, _, names in os.walk(os.path.join(HERE, *sub.split("/"))):
            for n in names:
                out.append(os.path.relpath(os.path.join(dp, n), HERE).replace(os.sep, "/"))
    return sorted(out)


def tinh_dau():
    h = hashlib.sha256()
    for rel in tep_vo():
        with open(os.path.join(HERE, *rel.split("/")), "rb") as f:
            data = f.read()
        if os.path.splitext(rel)[1] in TEXT_EXT:
            data = data.replace(b"\r\n", b"\n")
        h.update(rel.encode("utf-8") + b"\0" + data + b"\1")
    return h.hexdigest()[:12]


def dau_hien_tai():
    with io.open(SW, encoding="utf-8") as f:
        m = re.search(r'^var PHIEN_BAN = "([^"]*)";', f.read(), re.M)
    return m.group(1) if m else None


def dong_dau():
    moi = tinh_dau()
    with io.open(SW, encoding="utf-8", newline="") as f:
        s = f.read()
    if not DAU_RE.search(s):
        raise SystemExit('sw.js không có dòng `var PHIEN_BAN = "…";`')
    ra = DAU_RE.sub('var PHIEN_BAN = "%s";' % moi, s, count=1)
    if ra != s:
        with io.open(SW, "w", encoding="utf-8", newline="") as f:
            f.write(ra)
    return moi


# ------------------------------------------------------------------------------------------ biểu tượng
ACCENT = (33, 89, 214, 255)
SS = 4  # vẽ phóng 4 lần rồi thu nhỏ cho mịn


def ve_logo(size, kieu):
    """Lưới 2×2 các ô bo góc (cùng hình với logo trong trang). kieu: 'trong' = nền bo góc trong suốt; 'tran' = nền tràn viền."""
    from PIL import Image, ImageDraw
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if kieu == "trong":
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=ACCENT)
    else:
        d.rectangle([0, 0, s, s], fill=ACCENT)
    vung = s * (0.46 if kieu == "tran" else 0.56)          # maskable: Android cắt tới ~80% nên hình phải nằm gọn trong vùng an toàn
    gap = vung * 0.12
    cell = (vung - gap) / 2
    x0 = y0 = (s - vung) / 2
    for i, alpha in enumerate((255, 184, 184, 115)):
        cx, cy = x0 + (i % 2) * (cell + gap), y0 + (i // 2) * (cell + gap)
        layer = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        ImageDraw.Draw(layer).rounded_rectangle([cx, cy, cx + cell, cy + cell], radius=int(cell * 0.24), fill=(255, 255, 255, alpha))
        img = Image.alpha_composite(img, layer)
    return img.resize((size, size), Image.LANCZOS)


def ve_bieu_tuong():
    os.makedirs(ICONS, exist_ok=True)
    for ten, size, kieu in (("icon-192.png", 192, "trong"), ("icon-512.png", 512, "trong"), ("icon-maskable.png", 512, "tran"), ("apple-touch-icon.png", 180, "tran")):
        path = os.path.join(ICONS, ten)
        ve_logo(size, kieu).save(path, optimize=True)
        print("  %-22s %dx%d %s %d B" % (ten, size, size, kieu, os.path.getsize(path)))


# ------------------------------------------------------------------------------------------ ảnh chụp cài đặt
def chup_anh():
    sys.path.insert(0, os.path.join(os.path.dirname(HERE), "courses", "engine"))
    import kiem_khoa_hoc as K
    from playwright.sync_api import sync_playwright
    os.makedirs(SHOTS, exist_ok=True)
    may = K.MayChuThu([os.path.join(K.CONTENT, "system-design.json")]).__enter__()
    try:
        url = may.goc + "/webapp/_portal/portal.html"
        with sync_playwright() as pw:
            b = pw.chromium.launch()
            for ten, kw in (("wide", dict(viewport={"width": 1280, "height": 800}, color_scheme="light")),
                            ("narrow", dict(viewport={"width": 390, "height": 844}, color_scheme="light", device_scale_factor=1, is_mobile=True, has_touch=True))):
                ctx = b.new_context(service_workers="block", **kw)
                pg = ctx.new_page()
                pg.goto(url, wait_until="load")
                pg.wait_for_selector("article.card", timeout=20000)
                pg.wait_for_timeout(500)
                pg.screenshot(path=os.path.join(SHOTS, ten + ".png"))
                print("  %s.png %d B" % (ten, os.path.getsize(os.path.join(SHOTS, ten + ".png"))))
                ctx.close()
            b.close()
    finally:
        may.__exit__(None, None, None)


def main():
    if "--kiem" in sys.argv:
        hien, moi = dau_hien_tai(), tinh_dau()
        if hien != moi:
            print("LỆCH: sw.js ghi %r nhưng nội dung vỏ băm ra %r — chạy tao-pwa.py để đóng dấu lại." % (hien, moi))
            return 1
        print("Dấu phiên bản khớp: " + moi)
        return 0
    if "--icons" in sys.argv:
        print("Vẽ biểu tượng:")
        ve_bieu_tuong()
    if "--anh" in sys.argv:
        print("Chụp ảnh cài đặt:")
        chup_anh()
    print("Đóng dấu sw.js: " + dong_dau())
    return 0


if __name__ == "__main__":
    sys.exit(main())
