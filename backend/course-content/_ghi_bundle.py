# -*- coding: utf-8 -*-
"""Ghi một bundle khoá học vào backend/course-content/<slug>.json.

Dùng chung cho các `<slug>/build.py` (sinh bundle từ thư mục markdown nguồn).
Bundle là định dạng `content.json` cũ cộng khối "course" (tiêu đề, mô tả, biểu
tượng…). Khối "course" của tệp đang có được GIỮ NGUYÊN: build.py chỉ biết nội
dung, còn tiêu đề và mô tả là của người quản lý khoá.

Sau khi ghi, nạp vào database:

    python backend/fastapi/tools/manage_courses.py import backend/course-content/<slug>.json
"""

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))


def ghi(payload, slug):
    path = os.path.join(HERE, slug + ".json")
    course = {}
    if os.path.exists(path):
        try:
            with open(path, encoding="utf-8") as f:
                course = json.load(f).get("course") or {}
        except (OSError, ValueError):
            course = {}
    out = {"course": course or {"slug": slug, "title": slug}}
    for key in ("nav", "slugs", "order", "docs", "stats"):
        out[key] = payload[key]
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write("\n")
    return path, os.path.getsize(path)
