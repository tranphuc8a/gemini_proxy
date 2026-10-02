#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sinh bundle khoá OPIc — backend/course-content/opic.json — từ thư mục content/.

    python build.py
    python ../../fastapi/tools/manage_courses.py import ../opic.json      # nạp vào database

Trang webapp/courses/opic-course KHÔNG đọc tệp này: nó tải
/courses/opic/bundle từ API (nội dung trong database) rồi chuyển về dạng riêng
của nó bằng OPICL.tuBundle (assets/logic.js).

Bundle dùng ĐÚNG định dạng chung của mọi khoá (nav/order/docs + khối "course"),
nên khoá OPIc được quản lý bằng cùng API, cùng CLI, cùng trang quản lý:
    section "huong-dan"  — một nhóm, mỗi bài hướng dẫn là một tài liệu kind="guide"
    section "chu-de"     — mỗi chủ đề là một nhóm (short = id chủ đề, meta = icon,
                           uuTien, moTa, thuTu); mỗi câu hỏi là một tài liệu
                           kind="script": title = câu hỏi tiếng Việt, md = các câu
                           nói (mỗi dòng một câu), meta = {en, dang, phut, bo, so}
    course.config        — {dang, bo}: định nghĩa 8 dạng câu hỏi và 2 bộ script

NGUON SU THAT la thu muc content/:
    content/scripts/NN-<chu-de>.md     moi tep = mot chu de, nhieu cau hoi + script mau
    content/huong-dan/NN-<slug>.md     bai huong dan (markdown)

Dinh dang tep chu de:

    ---
    id: am-nhac            ten: Âm nhạc        icon: 🎵
    thu-tu: 3              uu-tien: 1          mo-ta: ...
    ---
    ## A17 · Câu hỏi tiếng Việt
    - en: English question
    - dang: mieu-ta            (gioi-thieu | mieu-ta | thoi-quen | so-sanh | kinh-nghiem | y-kien | dien | tinh-huong)
    - phut: 1                  (tuy chon — mac dinh theo dang)

    Moi dong con lai la MOT cau noi. Dong dang "(Call 1 – ...)" la chi dan san khau.

Tra exit code 1 neu noi dung co loi (thieu truong, trung id, dang la...).
"""
import json
import os
import re
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
NOI_DUNG = os.path.join(HERE, "content")
SLUG = "opic"
BUNDLE = os.path.join(os.path.dirname(HERE), SLUG + ".json")
WEBAPP_META = os.path.join(os.path.dirname(os.path.dirname(HERE)), "fastapi", "webapp", "courses",
                           "opic-course", "metadata.json")

DANG = {
    "gioi-thieu":  {"ten": "Giới thiệu bản thân",          "phut": 1,   "mo_ta": "Câu 1 của mọi đề. Tên, tuổi, công việc, tính cách, sở thích — 5–7 câu, có mở – thân – kết."},
    "mieu-ta":     {"ten": "Miêu tả",                       "phut": 1,   "mo_ta": "Tả người, nơi chốn, đồ vật. Nói 5–9 câu: giới thiệu chung → vài chi tiết → lý do thích / cảm giác."},
    "thoi-quen":   {"ten": "Thói quen / việc thường làm",   "phut": 1,   "mo_ta": "Việc thường làm, theo trình tự: trước → trong → sau. 5–8 câu, dùng usually / first / then / after that."},
    "so-sanh":     {"ten": "So sánh xưa – nay / hai thứ",   "phut": 1.5, "mo_ta": "Nửa đầu nói về quá khứ (used to), nửa sau nói về hiện tại, kết bằng một câu nhận xét. 7–10 câu."},
    "kinh-nghiem": {"ten": "Kể trải nghiệm",                "phut": 2,   "mo_ta": "Khi nào – ở đâu – với ai → chuyện gì xảy ra → cảm xúc → bài học rút ra. 7–10 câu, thì quá khứ."},
    "y-kien":      {"ten": "Ý kiến / bình luận",            "phut": 1.5, "mo_ta": "Nêu quan điểm, 2–3 lý do, một ví dụ cụ thể, kết luận. Nếu bí thì nói sâu một điểm."},
    "dien":        {"ten": "Diễn (role-play)",              "phut": 1.5, "mo_ta": "Câu 11–12. Chỉ mình bạn nói: chào → nêu tình huống → hỏi / đề nghị 3–4 điều → cảm ơn. Nhắc lại ý đầu dây bên kia."},
    "tinh-huong":  {"ten": "Giải quyết tình huống",         "phut": 1.5, "mo_ta": "Câu 13. Nêu vấn đề → đưa ra 2 giải pháp → hỏi phương án nào được → kết thúc lịch sự."},
}

BO = {
    "A": {"ten": "Bộ A — tự nhiên (IM+)", "nhan_vat": "Son, 23 tuổi, kỹ sư phần mềm tại Samsung R&D Hà Nội, sống một mình",
          "mo_ta": "Script tiếng Anh tự nhiên, có từ nối, có cảm xúc. Dài hơn mức cần (8–10 câu); học ý và cách nói, rồi rút ngắn về 5–7 câu của mình."},
    "B": {"ten": "Bộ B — cơ bản (IM)", "nhan_vat": "Toàn, 33 tuổi, kỹ sư phần mềm, có vợ và hai con",
          "mo_ta": "Câu ngắn, cấu trúc đơn giản, đúng 5–8 câu — vừa mức IM. Dễ thuộc, dễ nói đủ 1 phút."},
}

# ---------------------------------------------------------------- doc tep chu de
def doc_front_matter(text):
    m = re.match(r"^---\n(.*?)\n---\n?", text, re.S)
    if not m:
        return {}, text
    meta = {}
    for line in m.group(1).split("\n"):
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip()
    return meta, text[m.end():]


def so_hien_thi(qid):
    """A08 -> 8 · AR01 -> R1 · B045b -> 45b"""
    m = re.match(r"^(A|AR|B)(\d+)([a-z]?)$", qid)
    if not m:
        return qid
    return ("R" if m.group(1) == "AR" else "") + str(int(m.group(2))) + m.group(3)


def doc_chu_de(path, loi):
    text = open(path, encoding="utf-8").read().replace("\r\n", "\n")
    meta, body = doc_front_matter(text)
    ten_tep = os.path.basename(path)
    for k in ("id", "ten", "icon", "thu-tu", "uu-tien", "mo-ta"):
        if k not in meta:
            loi.append("%s: thieu truong '%s' trong front matter" % (ten_tep, k))
    chu_de = {
        "id": meta.get("id", ten_tep), "ten": meta.get("ten", ""), "icon": meta.get("icon", ""),
        "thuTu": int(meta.get("thu-tu", 99)), "uuTien": int(meta.get("uu-tien", 2)), "moTa": meta.get("mo-ta", ""),
    }
    cau_hoi = []
    cur = None
    for line in body.split("\n"):
        m = re.match(r"^##\s+(\S+)\s+·\s+(.+?)\s*$", line)
        if m:
            cur = {"id": m.group(1), "vi": m.group(2), "en": "", "dang": "", "phut": None, "cau": []}
            cau_hoi.append(cur)
            continue
        if cur is None:
            if line.strip():
                loi.append("%s: dong ngoai cau hoi: %r" % (ten_tep, line[:60]))
            continue
        m = re.match(r"^-\s+(\w+):\s*(.*)$", line)
        if m and not cur["cau"]:
            k, v = m.group(1), m.group(2).strip()
            if k == "phut":
                cur["phut"] = float(v)
            else:
                cur[k] = v
            continue
        if line.strip():
            cur["cau"].append(line.strip())
    for q in cau_hoi:
        q["bo"] = "A" if q["id"].startswith("A") else "B"
        q["so"] = so_hien_thi(q["id"])
        q["chuDe"] = chu_de["id"]
        if q["dang"] not in DANG:
            loi.append("%s: %s co dang la '%s'" % (ten_tep, q["id"], q["dang"]))
        if not q["en"]:
            loi.append("%s: %s thieu cau hoi tieng Anh (- en:)" % (ten_tep, q["id"]))
        if len([c for c in q["cau"] if not re.match(r"^\(.*\)$", c)]) < 3:
            loi.append("%s: %s co it hon 3 cau" % (ten_tep, q["id"]))
        if q["phut"] is None:
            q["phut"] = DANG.get(q["dang"], {"phut": 1})["phut"]
        tu = sum(len(c.split()) for c in q["cau"] if not re.match(r"^\(.*\)$", c))
        q["tu"] = tu
        q["giay"] = int(round(tu / 130.0 * 60))          # ~130 tu/phut khi noi binh thuong
    return chu_de, cau_hoi


# ---------------------------------------------------------------- doc bai huong dan
FENCE = re.compile(r"^\s*(```|~~~)")


def bo_fence(md):
    out, inside = [], False
    for line in md.split("\n"):
        if FENCE.match(line):
            inside = not inside
            continue
        if not inside:
            out.append(line)
    return "\n".join(out)


def doc_huong_dan(path, loi):
    text = open(path, encoding="utf-8").read().replace("\r\n", "\n")
    ten_tep = os.path.basename(path)
    m = re.match(r"^(\d+)-(.+)\.md$", ten_tep)
    if not m:
        loi.append("%s: ten tep huong dan phai dang NN-slug.md" % ten_tep)
        return None
    thu_tu, slug = int(m.group(1)), m.group(2)
    h1 = re.search(r"^#\s+(.+?)\s*$", text, re.M)
    if not h1:
        loi.append("%s: thieu tieu de H1" % ten_tep)
    ten = h1.group(1).strip() if h1 else slug
    outline = []
    for line in bo_fence(text).split("\n"):
        mm = re.match(r"^(#{2,3})\s+(.+?)\s*$", line)
        if mm:
            outline.append({"d": len(mm.group(1)), "t": re.sub(r"[*`_]", "", mm.group(2)).strip()})
    # tom tat: doan van dau tien sau H1, bo markdown
    body = text[h1.end():] if h1 else text
    tom_tat = ""
    for para in re.split(r"\n\s*\n", body):
        p = para.strip()
        if p and not p.startswith(("#", ">", "-", "|", "```", "*", "1.")):
            tom_tat = re.sub(r"[*`_\[\]]", "", p).replace("\n", " ")
            break
    words = len(re.findall(r"\S+", bo_fence(text)))
    return {"slug": slug, "thuTu": thu_tu, "ten": ten, "md": text, "outline": outline,
            "tomTat": tom_tat[:220], "tu": words, "phut": max(1, int(round(words / 200.0)))}


# ---------------------------------------------------------------- gom
def doc_tat_ca():
    """Tra ve (payload, loi). check.py cung goi ham nay."""
    loi = []
    chu_de, cau_hoi = [], []
    tm = os.path.join(NOI_DUNG, "scripts")
    for f in sorted(os.listdir(tm)):
        if f.endswith(".md"):
            cd, qs = doc_chu_de(os.path.join(tm, f), loi)
            chu_de.append(cd)
            cau_hoi.extend(qs)
    chu_de.sort(key=lambda c: c["thuTu"])
    ids = [q["id"] for q in cau_hoi]
    for d in sorted(set(i for i in ids if ids.count(i) > 1)):
        loi.append("id cau hoi trung: %s" % d)
    cd_ids = [c["id"] for c in chu_de]
    for d in sorted(set(i for i in cd_ids if cd_ids.count(i) > 1)):
        loi.append("id chu de trung: %s" % d)

    huong_dan = []
    tm = os.path.join(NOI_DUNG, "huong-dan")
    if os.path.isdir(tm):
        for f in sorted(os.listdir(tm)):
            if f.endswith(".md"):
                hd = doc_huong_dan(os.path.join(tm, f), loi)
                if hd:
                    huong_dan.append(hd)
    huong_dan.sort(key=lambda h: h["thuTu"])
    slugs = [h["slug"] for h in huong_dan]
    for d in sorted(set(s for s in slugs if slugs.count(s) > 1)):
        loi.append("slug huong dan trung: %s" % d)

    # lien ket {{script:ID}} trong huong dan phai tro toi cau hoi co that
    id_set = set(ids)
    for h in huong_dan:
        for ref in re.findall(r"\{\{script:([A-Za-z0-9]+)\}\}", h["md"]):
            if ref not in id_set:
                loi.append("huong-dan/%s: {{script:%s}} khong ton tai" % (h["slug"], ref))
        for ref in re.findall(r"\{\{huong-dan:([a-z0-9-]+)\}\}", h["md"]):
            if ref not in slugs:
                loi.append("huong-dan/%s: {{huong-dan:%s}} khong ton tai" % (h["slug"], ref))

    so_a = sum(1 for q in cau_hoi if q["bo"] == "A")
    so_b = sum(1 for q in cau_hoi if q["bo"] == "B")
    payload = {
        "chuDe": chu_de,
        "cauHoi": cau_hoi,
        "dang": {k: {"ten": v["ten"], "phut": v["phut"], "moTa": v["mo_ta"]} for k, v in DANG.items()},
        "bo": {k: {"ten": v["ten"], "nhanVat": v["nhan_vat"], "moTa": v["mo_ta"]} for k, v in BO.items()},
        "huongDan": huong_dan,
        "thongKe": {
            "chuDe": len(chu_de), "cauHoi": len(cau_hoi), "boA": so_a, "boB": so_b,
            "cau": sum(len(q["cau"]) for q in cau_hoi), "tu": sum(q["tu"] for q in cau_hoi),
            "huongDan": len(huong_dan), "phutDoc": sum(h["phut"] for h in huong_dan),
        },
    }
    return payload, loi


def _course_header():
    """Khối "course": giữ nguyên bản đang có trong opic.json (người quản lý có thể
    đã sửa tiêu đề / mô tả), không có thì lấy từ metadata.json của trang."""
    if os.path.exists(BUNDLE):
        try:
            with open(BUNDLE, encoding="utf-8") as f:
                cu = json.load(f).get("course")
            if cu:
                return cu
        except (OSError, ValueError):
            pass
    meta = {}
    try:
        with open(WEBAPP_META, encoding="utf-8") as f:
            meta = json.load(f)
    except (OSError, ValueError):
        pass
    return {
        "slug": SLUG,
        "title": meta.get("title", "Khoá luyện thi OPIc"),
        "subtitle": "hướng dẫn · script mẫu · luyện nói",
        "description": meta.get("description", ""),
        "icon": meta.get("icon", "🎙️"),
        "published": True,
    }


def bundle_tu_payload(payload):
    """Dạng riêng của trang OPIc -> bundle chung (nav/order/docs). Nghịch đảo của
    OPICL.tuBundle trong webapp/courses/opic-course/assets/logic.js."""
    docs, order = {}, []
    hd_items = []
    for h in payload["huongDan"]:
        doc_id = "huong-dan/" + h["slug"]
        hd_items.append(doc_id)
        # outline/words: the API recomputes both from md with the same rules; they
        # are kept here so the bundle file stands on its own (kiem-nhanh.js reads
        # it directly), like the other courses' bundles.
        docs[doc_id] = {"id": doc_id, "slug": "huong-dan/" + h["slug"], "title": h["ten"], "kind": "guide",
                        "tag": None, "meta": {"thuTu": h["thuTu"], "tomTat": h["tomTat"]},
                        "outline": h["outline"], "words": h["tu"], "md": h["md"]}
    groups = []
    for cd in payload["chuDe"]:
        items = []
        for q in (q for q in payload["cauHoi"] if q["chuDe"] == cd["id"]):
            items.append(q["id"])
            docs[q["id"]] = {"id": q["id"], "slug": "script/" + q["id"], "title": q["vi"], "kind": "script",
                             "tag": None, "meta": {"en": q["en"], "dang": q["dang"], "phut": q["phut"],
                                                   "bo": q["bo"], "so": q["so"]},
                             "outline": [], "words": q["tu"], "md": "\n".join(q["cau"]) + "\n"}
        groups.append({"title": cd["ten"], "short": cd["id"], "items": items,
                       "meta": {"icon": cd["icon"], "uuTien": cd["uuTien"], "moTa": cd["moTa"], "thuTu": cd["thuTu"]}})
    nav = [
        {"id": "huong-dan", "title": "Hướng dẫn", "sub": "%d bài" % len(hd_items), "icon": "book",
         "groups": [{"title": "Hướng dẫn", "short": "HD", "items": hd_items, "meta": {}}]},
        {"id": "chu-de", "title": "Chủ đề", "sub": "%d chủ đề · %d câu" % (len(groups), len(payload["cauHoi"])),
         "icon": "layers", "groups": groups},
    ]
    for sec in nav:
        for g in sec["groups"]:
            order.extend(g["items"])
    course = _course_header()
    # Thu tu cac dang / bo ghi RIENG thanh mang: MySQL luu object JSON voi khoa
    # da sap xep (theo do dai roi theo byte), nen thu tu khoa cua `dang` khong
    # song sot qua database — bo loc "Dang" se ra "dien, y-kien, mieu-ta…".
    course["config"] = dict(course.get("config") or {}, dang=payload["dang"], bo=payload["bo"],
                            dangThuTu=list(payload["dang"]), boThuTu=list(payload["bo"]),
                            webapp="courses/opic-course", engine="opic")
    s = payload["thongKe"]
    return {
        "course": course,
        "nav": nav,
        "slugs": {docs[i]["slug"]: i for i in order},
        "order": order,
        "docs": {i: docs[i] for i in order},
        "stats": {"chuDe": s["chuDe"], "cauHoi": s["cauHoi"], "boA": s["boA"], "boB": s["boB"],
                  "cau": s["cau"], "huongDan": s["huongDan"]},
    }


def ghi(payload):
    bundle = bundle_tu_payload(payload)
    with open(BUNDLE, "w", encoding="utf-8", newline="\n") as f:
        json.dump(bundle, f, ensure_ascii=False, indent=1)
        f.write("\n")
    return os.path.getsize(BUNDLE)


def main():
    payload, loi = doc_tat_ca()
    if loi:
        print("NOI DUNG CO LOI (%d):" % len(loi), file=sys.stderr)
        for l in loi:
            print("  - " + l, file=sys.stderr)
        sys.exit(1)
    n = ghi(payload)
    s = payload["thongKe"]
    print("da ghi %s" % os.path.relpath(BUNDLE))
    print("  %d chu de · %d cau hoi (A %d · B %d) · %d cau · %d tu · %d bai huong dan · %.0f KB"
          % (s["chuDe"], s["cauHoi"], s["boA"], s["boB"], s["cau"], s["tu"], s["huongDan"], n / 1024.0))
    print("  nap vao database: python ../../fastapi/tools/manage_courses.py import ../opic.json")


if __name__ == "__main__":
    main()
