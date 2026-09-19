#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gom khoa hoc System Design thanh assets/content.js.

Chay:  python build.py
Nho noi dung duoc nhung san, trang chay duoc ca khi mo bang file://
"""

import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

# engine dung chung: ghi content.js (runtime) + content.json (cong cu)
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(HERE)), "engine"))
import xuat
ROOT = os.path.dirname(HERE)            # .../system-design
OUT = os.path.join(HERE, "assets", "content.js")

K = "khoa-hoc"
G0 = K + "/giai-doan-0-nen-tang"
G1 = K + "/giai-doan-1-kien-truc-loi"
G2 = K + "/giai-doan-2-du-lieu-mo-rong"
G3 = K + "/giai-doan-3-he-phan-tan"
G4 = K + "/giai-doan-4-van-hanh"
G5 = K + "/giai-doan-5-chuyen-sau"


def L(path, title=None, kind="lesson", tag=None):
    return {"path": path, "title": title, "kind": kind, "tag": tag}


def lessons(folder, names, tags=None):
    tags = tags or {}
    return [L("%s/%s" % (folder, n), None, "lesson", tags.get(n)) for n in names]


CORE = "★ trọng tâm"
ADD = "★ bổ sung"

TREE = [
    {
        "id": "khoa-hoc",
        "title": "Khoá học System Design",
        "sub": "Từ số 0 đến kiến trúc production · 58 bài",
        "icon": "compass",
        "groups": [
            {"title": "Bắt đầu", "short": "Bắt đầu", "items": [
                L(K + "/README.md", "Giới thiệu khoá học", "intro"),
                L(K + "/00-tong-quan/00-de-cuong.md", None, "intro"),
                L(K + "/00-tong-quan/01-kiem-tra-dau-vao.md", None, "intro"),
                L(K + "/00-tong-quan/02-cach-hoc.md", None, "intro"),
                L(K + "/00-tong-quan/03-ban-do-kien-thuc.md", None, "intro"),
                L(K + "/00-tong-quan/04-lich-hoc-24-tuan.md", None, "intro"),
            ]},
            {"title": "Giai đoạn 0 — Nền tảng", "short": "GĐ 0", "items": lessons(G0, [
                "bai-01-system-design-la-gi.md",
                "bai-02-do-tre-thong-luong-capacity.md",
                "bai-03-may-tinh-va-he-dieu-hanh.md",
                "bai-04-mang-can-ban.md",
                "bai-05-cau-truc-du-lieu-xac-suat.md",
            ], {"bai-02-do-tre-thong-luong-capacity.md": CORE,
                "bai-05-cau-truc-du-lieu-xac-suat.md": ADD})},
            {"title": "Giai đoạn 1 — Kiến trúc lõi", "short": "GĐ 1", "items": lessons(G1, [
                "bai-06-thiet-ke-api.md",
                "bai-07-monolith-microservices.md",
                "bai-08-gateway-bff-service-mesh.md",
                "bai-09-can-bang-tai.md",
                "bai-10-caching-can-ban.md",
                "bai-11-kien-truc-bat-dong-bo.md",
                "bai-12-rate-limiting-backpressure.md",
                "bai-13-object-storage-cdn.md",
                "bai-14-realtime-va-push.md",
                "bai-15-quy-trinh-kien-truc-adr.md",
            ], {"bai-06-thiet-ke-api.md": CORE,
                "bai-08-gateway-bff-service-mesh.md": ADD,
                "bai-10-caching-can-ban.md": CORE,
                "bai-11-kien-truc-bat-dong-bo.md": CORE,
                "bai-14-realtime-va-push.md": ADD})},
            {"title": "Giai đoạn 2 — Dữ liệu & mở rộng", "short": "GĐ 2", "items": lessons(G2, [
                "bai-16-database-internals.md",
                "bai-17-transaction-isolation.md",
                "bai-18-mo-hinh-hoa-du-lieu.md",
                "bai-19-replication.md",
                "bai-20-partitioning-sharding.md",
                "bai-21-distributed-caching.md",
                "bai-22-search-indexing.md",
                "bai-23-queue-durable-log.md",
                "bai-24-event-driven.md",
                "bai-25-idempotency-outbox.md",
                "bai-26-mo-hinh-nhat-quan.md",
                "bai-27-cap-pacelc.md",
                "bai-28-oltp-olap-cdc.md",
                "bai-29-lab-capacity-design.md",
            ], {"bai-16-database-internals.md": CORE,
                "bai-17-transaction-isolation.md": CORE,
                "bai-19-replication.md": CORE,
                "bai-20-partitioning-sharding.md": CORE,
                "bai-25-idempotency-outbox.md": ADD,
                "bai-26-mo-hinh-nhat-quan.md": CORE,
                "bai-28-oltp-olap-cdc.md": ADD})},
            {"title": "Giai đoạn 3 — Hệ phân tán", "short": "GĐ 3", "items": lessons(G3, [
                "bai-30-mo-hinh-hong.md",
                "bai-31-dong-ho-thu-tu-nhan-qua.md",
                "bai-32-bau-leader-rsm.md",
                "bai-33-raft-di-sau.md",
                "bai-34-paxos-consensus.md",
                "bai-35-linearizability.md",
                "bai-36-giao-dich-phan-tan.md",
                "bai-37-he-thong-phoi-hop.md",
                "bai-38-database-toan-cau.md",
                "bai-39-kiem-thu-he-phan-tan.md",
                "bai-40-lab-case-study.md",
            ], {"bai-30-mo-hinh-hong.md": CORE,
                "bai-33-raft-di-sau.md": CORE,
                "bai-36-giao-dich-phan-tan.md": CORE,
                "bai-39-kiem-thu-he-phan-tan.md": ADD})},
            {"title": "Giai đoạn 4 — Vận hành production", "short": "GĐ 4", "items": lessons(G4, [
                "bai-41-sli-slo-error-budget.md",
                "bai-42-resilience-patterns.md",
                "bai-43-observability.md",
                "bai-44-hieu-nang-tail-latency.md",
                "bai-45-disaster-recovery.md",
                "bai-46-kien-truc-bao-mat.md",
                "bai-47-multi-tenancy.md",
                "bai-48-cloud-va-chi-phi.md",
                "bai-49-architecture-review.md",
                "bai-50-trinh-bay-design.md",
            ], {"bai-41-sli-slo-error-budget.md": CORE,
                "bai-42-resilience-patterns.md": CORE,
                "bai-47-multi-tenancy.md": ADD,
                "bai-49-architecture-review.md": CORE,
                "bai-50-trinh-bay-design.md": ADD})},
            {"title": "Giai đoạn 5 — Kiến trúc chuyên sâu", "short": "GĐ 5", "items": lessons(G5, [
                "bai-51-tien-hoa-di-tru.md",
                "bai-52-he-du-lieu-nang-cao.md",
                "bai-53-quy-mo-toan-cau.md",
                "bai-54-he-thong-dia-ly.md",
                "bai-55-he-thong-ml-ai.md",
                "bai-56-formal-methods.md",
                "bai-57-case-study-tron-ven.md",
                "bai-58-capstone.md",
            ], {"bai-54-he-thong-dia-ly.md": ADD,
                "bai-55-he-thong-ml-ai.md": ADD})},
        ],
    },
    {
        "id": "do-an",
        "title": "Sáu đồ án bắt buộc",
        "sub": "Khoá học hoàn thành bằng việc XÂY",
        "icon": "layers",
        "groups": [
            {"title": "Đồ án", "short": "Đồ án", "items": [
                L(K + "/do-an/README.md", "Tổng quan 6 đồ án", "exercise"),
                L(K + "/do-an/p1-url-shortener.md", None, "exercise"),
                L(K + "/do-an/p2-news-feed.md", None, "exercise"),
                L(K + "/do-an/p3-replicated-kv.md", None, "exercise", "khó nhất"),
                L(K + "/do-an/p4-order-payment.md", None, "exercise"),
                L(K + "/do-an/p5-production-platform.md", None, "exercise"),
                L(K + "/do-an/p6-capstone-global.md", None, "exercise", "capstone"),
            ]},
        ],
    },
    {
        "id": "tai-lieu",
        "title": "Tài liệu tra cứu",
        "sub": "Mở khi đang thiết kế",
        "icon": "book",
        "groups": [
            {"title": "Tra cứu nhanh", "short": "Tra cứu", "items": [
                L(K + "/tai-lieu/so-lieu-can-nho.md", "Số liệu cần nhớ", "ref"),
                L(K + "/tai-lieu/cheatsheet.md", "Cheatsheet", "ref"),
                L(K + "/tai-lieu/checklist-lam-bai.md", "Checklist thiết kế", "ref"),
                L(K + "/tai-lieu/khung-danh-gia.md", "Khung đánh giá", "ref"),
                L(K + "/tai-lieu/tu-dien-thuat-ngu.md", "Từ điển thuật ngữ", "ref"),
                L(K + "/tai-lieu/mau-adr.md", "Mẫu ADR", "ref"),
                L(K + "/tai-lieu/mau-nhat-ky.md", "Mẫu nhật ký học", "ref"),
                L(K + "/tai-lieu/thu-tu-doc.md", "Thứ tự đọc tài liệu", "ref"),
                L(K + "/tai-lieu/tai-lieu-tham-khao.md", "Tài liệu tham khảo", "ref"),
            ]},
        ],
    },
]

# ---------------------------------------------------------------------------
FENCE = re.compile(r"^\s*(```|~~~)")


def strip_fences(md):
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
    meta = {}
    head = "\n".join(md.split("\n")[:8])
    m = re.search(r"Bài\s+(\d+)\s*/\s*58", head)
    if m:
        meta["no"] = int(m.group(1))
    m = re.search(r"Thời lượng:\s*([^·\n*]+)", head)
    if m:
        meta["hours"] = m.group(1).strip().rstrip("·").strip()
    m = re.search(r"Độ khó:\s*([★☆⭐]+)", head)
    if m:
        s = m.group(1)
        meta["level"] = s.count("★") + s.count("⭐")
    m = re.search(r"Giai đoạn\s+(\d)", head)
    if m:
        meta["stage"] = int(m.group(1))
    return meta


def outline(md):
    res = []
    for line in strip_fences(md).split("\n"):
        m = re.match(r"^(#{2,3})\s+(.+?)\s*$", line)
        if m:
            res.append({"d": len(m.group(1)),
                        "t": re.sub(r"[*`_]", "", m.group(2)).strip()})
    return res


def stats(md):
    body = strip_fences(md)
    words = len(re.findall(r"[^\s]+", body))
    code_lines, inside = 0, False
    for line in md.split("\n"):
        if FENCE.match(line):
            inside = not inside
            continue
        if inside:
            code_lines += 1
    return words, code_lines, max(2, int(round(words / 170.0 + code_lines / 22.0)))


SLUG_PREFIX = {"khoa-hoc": "bai", "do-an": "do-an", "tai-lieu": "tai-lieu"}


def make_slug(rel, section_id, used):
    base = os.path.basename(rel)[:-3]
    parent = os.path.basename(os.path.dirname(rel))
    if base.lower() == "readme":
        base = "gioi-thieu" if parent == K else parent
    slug = "%s/%s" % (SLUG_PREFIX.get(section_id, section_id), base)
    if slug in used:
        n = 2
        while "%s-%d" % (slug, n) in used:
            n += 1
        slug = "%s-%d" % (slug, n)
    used.add(slug)
    return slug


def main():
    docs, order, missing, slugs, used = {}, [], [], {}, set()

    for section in TREE:
        for group in section["groups"]:
            for item in group["items"]:
                rel = item["path"]
                full = os.path.join(ROOT, rel)
                if not os.path.exists(full):
                    missing.append(rel)
                    continue
                md = open(full, encoding="utf-8").read()
                words, code_lines, minutes = stats(md)
                title = item["title"] or extract_title(md, os.path.basename(rel)[:-3])
                slug = make_slug(rel, section["id"], used)
                slugs[slug] = rel
                docs[rel] = {
                    "id": rel, "slug": slug, "title": title,
                    "kind": item["kind"], "tag": item["tag"],
                    "section": section["id"], "group": group["short"],
                    "meta": extract_meta(md), "outline": outline(md),
                    "words": words, "codeLines": code_lines,
                    "minutes": minutes, "md": md,
                }
                order.append(rel)

    if missing:
        print("!! Thieu file:", file=sys.stderr)
        for m in missing:
            print("   " + m, file=sys.stderr)

    nav = []
    for section in TREE:
        groups = []
        for group in section["groups"]:
            ids = [i["path"] for i in group["items"] if i["path"] in docs]
            if ids:
                groups.append({"title": group["title"], "short": group["short"], "items": ids})
        nav.append({"id": section["id"], "title": section["title"],
                    "sub": section["sub"], "icon": section["icon"], "groups": groups})

    payload = {
        "nav": nav, "slugs": slugs, "order": order, "docs": docs,
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
    print("  %d tai lieu (%d bai giang), %d tu, ~%d gio doc, %.2f MB + %.2f MB"
          % (s["files"], s["lessons"], s["words"], round(s["minutes"] / 60),
             n_js / 1048576.0, n_json / 1048576.0))


if __name__ == "__main__":
    main()
