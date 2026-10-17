#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Dựng phần PWA của Algorithm Notebook: biểu tượng và ĐÓNG DẤU phiên bản vào sw.js.

    backend\\fastapi\\.venv\\Scripts\\python.exe backend\\fastapi\\webapp\\tranphuc8a\\algorithm-notebook\\tao-pwa.py            # chỉ đóng dấu
    ... tao-pwa.py --icons          # vẽ lại biểu tượng (cần Pillow) rồi đóng dấu
    ... tao-pwa.py --kiem           # chỉ kiểm: dấu trong sw.js còn khớp nội dung vỏ không (exit 1 nếu lệch)

Vì sao phải đóng dấu: trình duyệt chỉ cài service worker mới khi BYTE của sw.js đổi. PHIEN_BAN là dấu băm nội dung vỏ
(index.html, manifest, assets/css|js|data|icons) — đổi tệp nào thì dấu đổi theo. CRLF/LF được chuẩn hoá trước khi băm.
"""
import hashlib
import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ICONS = os.path.join(HERE, "assets", "icons")
SW = os.path.join(HERE, "sw.js")
TEXT_EXT = {".html", ".css", ".js", ".json", ".webmanifest"}
DAU_RE = re.compile(r'^var PHIEN_BAN = "[^"]*";', re.M)


def tep_vo():
    out = ["index.html", "manifest.webmanifest"]
    for sub in ("assets/css", "assets/js", "assets/data", "assets/icons"):
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
    """Cây quyết định: một nút gốc, hai nhánh, bốn lá. kieu: 'trong' = nền bo góc trong suốt; 'tran' = nền tràn viền (maskable)."""
    from PIL import Image, ImageDraw
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if kieu == "trong":
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=ACCENT)
    else:
        d.rectangle([0, 0, s, s], fill=ACCENT)
    k = 0.52 if kieu == "tran" else 0.62                      # maskable: Android cắt tới ~80% nên hình phải nằm gọn trong vùng an toàn
    ox = oy = s * (1 - k) / 2
    P = lambda x, y: (ox + k * s * x, oy + k * s * y)
    root, l1, r1 = P(0.5, 0.1), P(0.25, 0.48), P(0.75, 0.48)
    leaves = [P(0.1, 0.9), P(0.4, 0.9), P(0.6, 0.9), P(0.9, 0.9)]
    w = int(s * k * 0.06)
    for a, b in ((root, l1), (root, r1), (l1, leaves[0]), (l1, leaves[1]), (r1, leaves[2]), (r1, leaves[3])):
        d.line([a, b], fill=(255, 255, 255, 215), width=w)
    r = s * k * 0.085
    for (x, y), alpha in zip([root, l1, r1] + leaves, (255, 235, 235, 200, 200, 200, 200)):
        layer = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        ImageDraw.Draw(layer).ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, alpha))
        img = Image.alpha_composite(img, layer)
    return img.resize((size, size), Image.LANCZOS)


def ve_bieu_tuong():
    os.makedirs(ICONS, exist_ok=True)
    for ten, size, kieu in (("icon-192.png", 192, "trong"), ("icon-512.png", 512, "trong"), ("icon-maskable.png", 512, "tran"), ("apple-touch-icon.png", 180, "tran")):
        path = os.path.join(ICONS, ten)
        ve_logo(size, kieu).save(path, optimize=True)
        print("  %-22s %dx%d %s %d B" % (ten, size, size, kieu, os.path.getsize(path)))


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
    print("Đóng dấu sw.js: " + dong_dau())
    return 0


if __name__ == "__main__":
    sys.exit(main())
