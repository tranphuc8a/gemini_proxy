#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gom toan bo tai lieu markdown thanh mot file assets/content.js duy nhat.

Chay:  python build.py
Ket qua: web/assets/content.js  (window.COURSE = {...})

Nho co content.js, trang web chay duoc ngay ca khi mo bang file:// —
khong can dung web server, khong can fetch, khong can npm.
"""

import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

# engine dung chung: ghi content.js (runtime) + content.json (cong cu)
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(HERE)), "engine"))
import xuat
ROOT = os.path.dirname(HERE)            # .../gemini
OUT = os.path.join(HERE, "assets", "content.js")

C = "heuristic-course-from-basic-to-expert"
R7 = "expe/2607/research"
R5 = "expe/2605/research"


def L(path, title=None, kind="lesson", tag=None):
    return {"path": path, "title": title, "kind": kind, "tag": tag}


# ---------------------------------------------------------------------------
# Cay dieu huong — thu tu hoc tap da duoc bien tap thu cong
# ---------------------------------------------------------------------------
TREE = [
    {
        "id": "khoa-hoc",
        "title": "Khoá học Heuristic",
        "sub": "Từ cơ bản đến chuyên sâu · 23 bài + 1 mở rộng",
        "icon": "compass",
        "groups": [
            {
                "title": "Bắt đầu",
                "short": "Bắt đầu",
                "items": [
                    L(f"{C}/README.md", "Giới thiệu khoá học", "intro"),
                    L(f"{C}/00-tong-quan/00-de-cuong.md", None, "intro"),
                    L(f"{C}/00-tong-quan/01-kiem-tra-dau-vao.md", None, "intro"),
                    L(f"{C}/00-tong-quan/02-cach-hoc.md", None, "intro"),
                    L(f"{C}/00-tong-quan/03-ban-do-kien-thuc.md", None, "intro"),
                ],
            },
            {
                "title": "Phần 1 — Tư duy tối ưu",
                "short": "Phần 1",
                "items": [
                    L(f"{C}/phan-1-tu-duy-toi-uu/bai-01-mo-hinh-hoa.md"),
                    L(f"{C}/phan-1-tu-duy-toi-uu/bai-02-vi-sao-kho.md"),
                    L(f"{C}/phan-1-tu-duy-toi-uu/bai-03-bieu-dien-nghiem.md"),
                    L(f"{C}/phan-1-tu-duy-toi-uu/bai-04-do-luong.md", None, "lesson", "★ trọng tâm"),
                ],
            },
            {
                "title": "Phần 2 — Xây dựng nghiệm",
                "short": "Phần 2",
                "items": [
                    L(f"{C}/phan-2-xay-dung-nghiem/bai-05-greedy.md", None, "lesson", "★ trọng tâm"),
                    L(f"{C}/phan-2-xay-dung-nghiem/bai-06-gia-mo.md", None, "lesson", "★ trọng tâm"),
                    L(f"{C}/phan-2-xay-dung-nghiem/bai-07-chen-gom-cum.md"),
                    L(f"{C}/phan-2-xay-dung-nghiem/bai-08-grasp.md"),
                ],
            },
            {
                "title": "Phần 3 — Cải thiện nghiệm",
                "short": "Phần 3",
                "items": [
                    L(f"{C}/phan-3-cai-thien-nghiem/bai-09-lan-can-leo-doi.md"),
                    L(f"{C}/phan-3-cai-thien-nghiem/bai-10-delta-evaluation.md", None, "lesson", "★ trọng tâm"),
                    L(f"{C}/phan-3-cai-thien-nghiem/bai-11-toan-tu-kinh-dien.md"),
                    L(f"{C}/phan-3-cai-thien-nghiem/bai-12-cuc-tri-cuc-bo.md", None, "lesson", "★ trọng tâm"),
                ],
            },
            {
                "title": "Phần 4 — Metaheuristic",
                "short": "Phần 4",
                "items": [
                    L(f"{C}/phan-4-metaheuristic/bai-13-simulated-annealing.md"),
                    L(f"{C}/phan-4-metaheuristic/bai-14-tabu-search.md"),
                    L(f"{C}/phan-4-metaheuristic/bai-15-ils-vns.md"),
                    L(f"{C}/phan-4-metaheuristic/bai-16-beam-search.md"),
                    L(f"{C}/phan-4-metaheuristic/bai-17-lns-alns.md"),
                    L(f"{C}/phan-4-metaheuristic/bai-17b-bay-dan-tien-hoa.md",
                      None, "lesson", "mở rộng"),
                ],
            },
            {
                "title": "Phần 5 — Kỹ năng thực chiến",
                "short": "Phần 5",
                "items": [
                    L(f"{C}/phan-5-ky-nang-thuc-chien/bai-18-can-tren-can-duoi.md", None, "lesson", "★ trọng tâm"),
                    L(f"{C}/phan-5-ky-nang-thuc-chien/bai-19-ky-thuat-cpp.md"),
                    L(f"{C}/phan-5-ky-nang-thuc-chien/bai-20-quy-trinh-8-buoc.md", None, "lesson", "★ trọng tâm"),
                ],
            },
            {
                "title": "Phần 6 — Capstone",
                "short": "Phần 6",
                "items": [
                    L(f"{C}/phan-6-capstone/bai-21-mo-xe-de-thi.md"),
                    L(f"{C}/phan-6-capstone/bai-22-bay-phien-ban.md"),
                    L(f"{C}/phan-6-capstone/bai-23-tu-danh-gia.md"),
                ],
            },
            {
                "title": "Bài tập & Lab",
                "short": "Bài tập",
                "items": [
                    L(f"{C}/bai-tap/README.md", "Bộ bài tập", "exercise"),
                    L(f"{C}/bai-tap/dap-an.md", "Đáp án & lời giải", "exercise"),
                    L(f"{C}/code/p3-aircon/README.md", "Lab P3 — Thợ vệ sinh điều hoà", "exercise"),
                ],
            },
        ],
    },
    {
        "id": "tai-lieu",
        "title": "Tài liệu tra cứu",
        "sub": "Dùng khi đang làm bài",
        "icon": "book",
        "groups": [
            {
                "title": "Tra cứu nhanh",
                "short": "Tra cứu",
                "items": [
                    L(f"{C}/tai-lieu/cheatsheet.md", "Cheatsheet", "ref"),
                    L(f"{C}/tai-lieu/tu-dien-thuat-ngu.md", "Từ điển thuật ngữ", "ref"),
                    L(f"{C}/tai-lieu/checklist-lam-bai.md", "Checklist làm bài", "ref"),
                    L(f"{C}/tai-lieu/mau-nhat-ky.md", "Mẫu nhật ký thực nghiệm", "ref"),
                    L(f"{C}/tai-lieu/mau-bao-cao.md", "Mẫu báo cáo", "ref"),
                    L(f"{C}/tai-lieu/tai-lieu-tham-khao.md", "Tài liệu tham khảo", "ref"),
                ],
            },
        ],
    },
    {
        "id": "case-2605",
        "title": "Ca nghiên cứu 2605",
        "sub": "ML Tensor Buffer Planner · +10,27 %",
        "icon": "layers",
        "groups": [
            {
                "title": "Bài 2605 — Xếp bộ nhớ tensor",
                "short": "2605",
                "items": [
                    L(f"{R5}/README.md", "Tổng quan kết quả", "case"),
                    L(f"{R5}/00-huong-dan-doc.md", None, "case"),
                    L(f"{R5}/01-phat-bieu-de-bai.md", None, "case"),
                    L(f"{R5}/02-giai-phap-hien-tai.md", None, "case"),
                    L(f"{R5}/03-de-xuat-cai-tien.md", None, "case", "★ cốt lõi"),
                    L(f"{R5}/04-implementation/README.md", "Cài đặt & tái lập", "case"),
                    L(f"{R5}/05-lien-he-bai-toan.md", None, "case"),
                    L(f"{R5}/06-lien-he-khoa-hoc.md", None, "case", "★ cốt lõi"),
                ],
            },
        ],
    },
    {
        "id": "case-2607",
        "title": "Ca nghiên cứu 2607",
        "sub": "Thợ vệ sinh điều hoà · +7,17 %",
        "icon": "route",
        "groups": [
            {
                "title": "Bài 2607 — Định tuyến chọn lọc",
                "short": "2607",
                "items": [
                    L(f"{R7}/README.md", "Tổng quan kết quả", "case"),
                    L(f"{R7}/01-phat-bieu-de-bai.md", None, "case"),
                    L(f"{R7}/02-giai-phap-hien-tai.md", None, "case"),
                    L(f"{R7}/03-de-xuat-cai-tien.md", None, "case", "★ cốt lõi"),
                    L(f"{R7}/04-implementation/README.md", "Cài đặt & tái lập", "case"),
                    L(f"{R7}/05-lien-he-bai-toan.md", None, "case"),
                ],
            },
        ],
    },
]


# ---------------------------------------------------------------------------
# Phan tich markdown
# ---------------------------------------------------------------------------
FENCE = re.compile(r"^\s*(```|~~~)")


def strip_fences(md):
    """Bo cac khoi code de khong dem tu / khong bat heading nham."""
    out, inside = [], False
    for line in md.split("\n"):
        if FENCE.match(line):
            inside = not inside
            continue
        if not inside:
            out.append(line)
    return "\n".join(out)


def extract_title(md, fallback):
    m = re.search(r"^#\s+(.+?)\s*$", md, re.M)
    return m.group(1).strip() if m else fallback


def extract_meta(md):
    """Doc khoi trich dan metadata ngay sau tieu de (neu co).

    Vi du:  > **Phần 1 · Bài 4/23** · Thời lượng: 3 giờ · Độ khó: ⭐⭐☆☆☆
    """
    meta = {}
    head = "\n".join(md.split("\n")[:8])
    m = re.search(r"Bài\s+(\d+)\s*/\s*23", head)
    if m:
        meta["no"] = int(m.group(1))
    m = re.search(r"Thời lượng:\s*([^·\n*]+)", head)
    if m:
        meta["hours"] = m.group(1).strip().rstrip("·").strip()
    m = re.search(r"Độ khó:\s*([★☆⭐]+)", head)
    if m:
        s = m.group(1)
        meta["level"] = s.count("★") + s.count("⭐")
    return meta


def outline(md):
    """Danh sach heading cap 2 (dung cho o tim kiem va xem truoc)."""
    res = []
    for line in strip_fences(md).split("\n"):
        m = re.match(r"^(#{2,3})\s+(.+?)\s*$", line)
        if m:
            text = re.sub(r"[*`_]", "", m.group(2)).strip()
            res.append({"d": len(m.group(1)), "t": text})
    return res


def stats(md):
    body = strip_fences(md)
    words = len(re.findall(r"[^\s]+", body))
    code_lines = 0
    inside = False
    for line in md.split("\n"):
        if FENCE.match(line):
            inside = not inside
            continue
        if inside:
            code_lines += 1
    # tieng Viet ~170 tu/phut cho van ban ky thuat; code doc cham hon nhieu
    minutes = words / 170.0 + code_lines / 22.0
    return words, code_lines, max(2, int(round(minutes)))


SLUG_PREFIX = {
    "khoa-hoc": "khoa-hoc",
    "tai-lieu": "tai-lieu",
    "case-2605": "2605",
    "case-2607": "2607",
}


def make_slug(rel, section_id, used):
    """URL ngan gon, on dinh: <phan>/<ten-file>."""
    base = os.path.basename(rel)[:-3]
    parent = os.path.basename(os.path.dirname(rel))
    if base.lower() == "readme":
        base = "gioi-thieu" if parent in (C, "") else parent
    if base == "research":                 # README cua thu muc research
        base = "tong-quan"
    if parent == "p3-aircon":
        base = "lab-p3-aircon"
    slug = "%s/%s" % (SLUG_PREFIX.get(section_id, section_id), base)
    if slug in used:                       # chong trung, gan nhu khong bao gio xay ra
        n = 2
        while "%s-%d" % (slug, n) in used:
            n += 1
        slug = "%s-%d" % (slug, n)
    used.add(slug)
    return slug


# ---------------------------------------------------------------------------
def main():
    docs = {}
    order = []
    missing = []
    slugs = {}
    used_slugs = set()

    for section in TREE:
        for group in section["groups"]:
            for item in group["items"]:
                rel = item["path"]
                full = os.path.join(ROOT, rel)
                if not os.path.exists(full):
                    missing.append(rel)
                    continue
                with open(full, encoding="utf-8") as fh:
                    md = fh.read()
                words, code_lines, minutes = stats(md)
                fallback = os.path.basename(rel)[:-3]
                title = item["title"] or extract_title(md, fallback)
                slug = make_slug(rel, section["id"], used_slugs)
                slugs[slug] = rel
                docs[rel] = {
                    "id": rel,
                    "slug": slug,
                    "title": title,
                    "kind": item["kind"],
                    "tag": item["tag"],
                    "section": section["id"],
                    "group": group["short"],
                    "meta": extract_meta(md),
                    "outline": outline(md),
                    "words": words,
                    "codeLines": code_lines,
                    "minutes": minutes,
                    "md": md,
                }
                order.append(rel)

    if missing:
        print("!! Thieu file:", file=sys.stderr)
        for m in missing:
            print("   " + m, file=sys.stderr)

    # cay dieu huong rut gon (khong kem noi dung) de client dung
    nav = []
    for section in TREE:
        groups = []
        for group in section["groups"]:
            ids = [i["path"] for i in group["items"] if i["path"] in docs]
            if ids:
                groups.append({"title": group["title"], "short": group["short"], "items": ids})
        nav.append({
            "id": section["id"],
            "title": section["title"],
            "sub": section["sub"],
            "icon": section["icon"],
            "groups": groups,
        })

    payload = {
        "nav": nav,
        "slugs": slugs,
        "order": order,
        "docs": docs,
        "stats": {
            "files": len(docs),
            "words": sum(d["words"] for d in docs.values()),
            "minutes": sum(d["minutes"] for d in docs.values()),
            "lessons": sum(1 for d in docs.values() if d["kind"] == "lesson"),
        },
    }

    n_js, n_json = xuat.ghi(payload, os.path.dirname(OUT))

    s = payload["stats"]
    print("da ghi assets/content.js + assets/content.json")
    print("  %d tai lieu, %d tu, ~%d gio doc, %.1f MB + %.1f MB"
          % (s["files"], s["words"], round(s["minutes"] / 60),
             n_js / 1048576.0, n_json / 1048576.0))
if __name__ == "__main__":
    main()
