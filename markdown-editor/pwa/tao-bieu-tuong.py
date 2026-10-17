#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Vẽ biểu tượng cài đặt (PWA) cho Markdown Editor Pro — hình học thuần, không cần font.

    backend\\fastapi\\.venv\\Scripts\\python.exe markdown-editor\\pwa\\tao-bieu-tuong.py

Ghi vào public/icons/ (Vite chép nguyên sang dist/ khi build):
  icon-192.png, icon-512.png   biểu tượng thường: nền bo góc, chữ M + mũi tên xuống (dấu hiệu Markdown)
  icon-maskable.png            nền tràn viền, hình thu vào ~66% — Android cắt theo hình tròn / giọt nước
  apple-touch-icon.png         180×180 nền tràn viền — iOS tự bo góc và không chịu nền trong suốt

Màu nền = --accent của index.css (#5b5bd6). Cần Pillow (đã có trong venv backend).
"""
import os

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "public", "icons")
ACCENT = (91, 91, 214, 255)
WHITE = (255, 255, 255, 255)
SS = 4  # vẽ phóng 4 lần rồi thu nhỏ để cạnh mịn

# (tên tệp, cạnh, "trong" = nền trong suốt bo góc; "tran" = nền tràn viền)
ICONS = [("icon-192.png", 192, "trong", 0.60), ("icon-512.png", 512, "trong", 0.60),
         ("icon-maskable.png", 512, "tran", 0.46), ("apple-touch-icon.png", 180, "tran", 0.56)]


def glyph(d, cx, cy, w, color):
    """Chữ M rộng w (gồm hai nét xiên) và mũi tên xuống ở bên phải, căn giữa quanh (cx, cy)."""
    h = w * 0.62
    stroke = max(2, int(w * 0.13))
    left, top, bottom = cx - w / 2, cy - h / 2, cy + h / 2
    mw = w * 0.62                     # phần chữ M chiếm 62% bề rộng, còn lại là mũi tên
    pts = [(left, bottom), (left, top), (left + mw / 2, top + h * 0.5), (left + mw, top), (left + mw, bottom)]
    d.line(pts, fill=color, width=stroke, joint="curve")
    for x, y in (pts[0], pts[-1]):
        d.ellipse([x - stroke / 2, y - stroke / 2, x + stroke / 2, y + stroke / 2], fill=color)
    ax = left + mw + (w - mw) * 0.62  # trục mũi tên
    d.line([(ax, top + h * 0.05), (ax, bottom - h * 0.22)], fill=color, width=stroke)
    ah = h * 0.26
    d.polygon([(ax - ah, bottom - h * 0.30), (ax + ah, bottom - h * 0.30), (ax, bottom + h * 0.02)], fill=color)


def draw(size, kind, scale):
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if kind == "trong":
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=ACCENT)
    else:
        d.rectangle([0, 0, s, s], fill=ACCENT)
    glyph(d, s / 2, s / 2, s * scale, WHITE)
    return img.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, size, kind, scale in ICONS:
        path = os.path.join(OUT, name)
        draw(size, kind, scale).save(path)
        print(f"{name:22s} {size}x{size} {kind:5s} {os.path.getsize(path)} B")


if __name__ == "__main__":
    main()
