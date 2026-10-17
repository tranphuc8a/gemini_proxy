#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Chép các mô-đun dùng chung từ Personal Wiki sang Algorithm Notebook (hai app viết tay, không build, mỗi app tự chứa đủ để chạy offline).

    backend\\fastapi\\.venv\\Scripts\\python.exe backend\\fastapi\\webapp\\tranphuc8a\\algorithm-notebook\\sync.py          # chép
    ... sync.py --kiem        # chỉ kiểm: các bản chép còn khớp nguồn (exit 1 nếu lệch)

NGUỒN THẬT của các tệp dưới đây là personal-wiki; ĐỪNG sửa bản chép ở đây (sửa ở nguồn rồi chạy lại sync.py).
Khác nguồn đúng những chỗ ghi trong TRANSFORMS: đổi tên miền `Wiki` → `Algo`, khoá lưu cài đặt, tiền tố cache, địa chỉ [[liên kết]]."""
import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(os.path.dirname(HERE), "personal-wiki")

# (tệp, [(chuỗi cũ, chuỗi mới), …]) — `\bWiki\b` → `Algo` luôn được áp dụng cho tệp .js
FILES = [
    ("assets/css/tokens.css", []),
    ("assets/css/base.css", []),
    ("assets/js/core/text.js", []),
    ("assets/js/core/notes.js", []),            # markdown.js dùng parseLinks / maskCode / plainSnippet
    ("assets/js/core/highlight.js", []),
    ("assets/js/core/markdown.js", [
        ('href="#/n/', 'href="#/a/'),
        ('href="#/new?title=', 'href="#/mine/new?name='),
        ("Chưa có note này — bấm để tạo", "Chưa có mục này — bấm để tạo"),
    ]),
    ("assets/js/data/store.js", []),
    ("assets/js/data/zip.js", []),
    ("assets/js/ui/dom.js", [('"pw:prefs"', '"an:prefs"')]),
    ("assets/js/ui/pwa.js", [('prefix = "wiki:"', 'prefix = "algo:"')]),
]
BANNER = "/* BẢN CHÉP từ personal-wiki bằng sync.py — đừng sửa ở đây. */\n"


def transform(rel, text):
    for _, pairs in [f for f in FILES if f[0] == rel]:
        for old, new in pairs:
            if old not in text:
                raise SystemExit("%s: không thấy %r — nguồn đã đổi, sửa TRANSFORMS trong sync.py" % (rel, old))
            text = text.replace(old, new)
    if rel.endswith(".js"):
        text = re.sub(r"\bWiki\b", "Algo", text)
        text = BANNER + text
    return text


def read(path):
    with io.open(path, encoding="utf-8", newline="") as f:
        return f.read().replace("\r\n", "\n")


def main():
    check = "--kiem" in sys.argv
    bad = 0
    for rel, _ in FILES:
        want = transform(rel, read(os.path.join(SRC, *rel.split("/"))))
        dest = os.path.join(HERE, *rel.split("/"))
        have = read(dest) if os.path.exists(dest) else None
        if have == want:
            continue
        if check:
            print("LỆCH: " + rel)
            bad += 1
        else:
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with io.open(dest, "w", encoding="utf-8", newline="\n") as f:
                f.write(want)
            print("chép " + rel)
    if check:
        print("Các bản chép khớp nguồn." if not bad else "%d tệp lệch — chạy sync.py" % bad)
        return 1 if bad else 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
