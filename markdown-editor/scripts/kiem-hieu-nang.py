#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Khung đo hiệu năng Markdown Editor Pro trong Edge THẬT (perf-md việc 1, md-render việc 0 — đợt M0, 23/10/2026).

    backend\\fastapi\\.venv\\Scripts\\python.exe markdown-editor\\scripts\\kiem-hieu-nang.py [tuỳ chọn]

      --bao-cao            in bảng số đo (mặc định khi không có --nguong)
      --nguong             so với ngưỡng tuyệt đối của đợt hiện tại + so với mốc (hieu-nang-moc.json); vượt ⇒ exit 1
      --nang               thêm doc-30k (1,5 MB) — rất chậm ở M0: ≈ 27 phút, riêng chế độ đọc 30k ≈ 22 phút
      --chi doc-2k,doc-10k chỉ đo những tài liệu này          --che-do split,editor,reading   chỉ đo những chế độ này
      --lap N              đo N lần, lấy trung vị từng chỉ số (mặc định 3 khi --nguong/--ghi-moc — cùng mã, hai lần đo
                           lệch tới ±35 %, máy bận thì +50–95 %; xem tasks/2610/261023/cai-tien-webapp/dot/M0.md)
      --dot M1             đợt dùng để chọn ngưỡng tuyệt đối (mặc định DOT_HIEN_TAI trong tệp này)
      --dung-sai 0.10      dung sai so với mốc (10 % — ke-hoach §1.1 "không chậm hơn mốc quá 10 %")
      --ghi-moc            ghi số đo lần này làm mốc (gộp vào hieu-nang-moc.json; chỉ khi chạy bằng Edge)
      --nguon dist|ban-xuat   đo markdown-editor/dist (mặc định, tự build nếu cũ hơn nguồn) hay bản đã xuất bản
      --may-chu that       phục vụ bản xuất bản qua uvicorn THẬT (SQLite tạm, khoá giả) thay vì http.server + API giả
      --build / --khong-build   ép build / cấm build dist     --json <tệp>  nơi ghi kết quả JSON
      --tu-kiem            chỉ chạy phần tự kiểm thuần (bộ sinh tài liệu, phép so ngưỡng) rồi thoát
      --headed             mở cửa sổ trình duyệt để xem

  Biến môi trường: MD_PERF_SLACK (hệ số máy chậm, mặc định 1; máy yếu hoặc đang bận đặt 1,5–3) nhân mọi trần khi --nguong.

Cách đo (giống `tasks/2610/261023/cai-tien-webapp/nhap/perf-md/perf_me.py` của pha thiết kế, để số còn so được với
perf-md.md §2.1): tài liệu sinh tất định (`_tai_lieu_thu.py`, từng byte giống mkdoc.mjs) nạp sẵn vào
localStorage["markdown-editor:files"]; viewport 1440×900, service worker chặn; API quản trị giả bằng `page.route`
(`/markdown/admin/session` → token) — hoặc máy chủ thật với `--may-chu that`; ảnh `img.example.test` trả PNG giả.
  · mở: khung hình đầu có editor / preview / bài đọc CỦA TÀI LIỆU ĐO (không phải welcome.md vẽ trước hydrate); "yên" =
    1,5 s không long task, không tài nguyên mạng, không đổi DOM con của preview, không còn sơ đồ đang vẽ
  · gõ: tối đa 21 ký tự cách 150 ms vào cuối một đoạn văn giữa tài liệu (dừng sớm khi quá ngân sách 60 s — tài liệu lớn
    ở chế độ chia đôi treo hàng chục giây mỗi phím); trễ mỗi phím = Event Timing gộp CHỈ theo interactionId (như INP);
    phím không có sự kiện ≥ 16 ms được tính là 16 ms. (perf_me.py gộp cả sự kiện input không có interactionId thành
    nhóm riêng nên p50 chia đôi của thiết kế — 64 ms ở doc-2k — bị pha loãng; p95/max vẫn so được.)
  · preview cập nhật: từ lúc trình duyệt nhận phím cuối (keydown.timeStamp) tới khi đoạn trong preview chứa chữ vừa gõ
  · cuộn: 40 lần lăn chuột 400 px, đo khung rAF (p50/p95, % khung > 50 ms)
  · hoàn tác: bộ nhớ riêng của renderer trang đang đo tăng sau N bước (mỗi bước = dừng gõ > 600 ms) — nhiễu, chỉ tham khảo
Kết quả JSON ghi vào thư mục tạm của hệ thống (không commit). Không gọi Gemini, không chạm database thật.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import platform
import re
import statistics
import struct
import subprocess
import sys
import tempfile
import time
import zlib

import _kiem_chung as K
import _tai_lieu_thu as T

K.utf8_console()

# ---------------------------------------------------------------------------------------------------------------------
# Ngưỡng — chỉnh ở đây khi mỗi đợt mở cổng của mình
# ---------------------------------------------------------------------------------------------------------------------
DOT = ["M0", "M1", "M2", "M2b", "M3", "M4a", "M4b", "M5", "M6", "M7", "M8", "M9", "M10"]
DOT_HIEN_TAI = "M1"  # đợt đang thi công. Đợt nào đạt ngưỡng của mình thì nâng giá trị này (ke-hoach §2, luồng M).
MOC_PATH = os.path.join(K.HERE, "hieu-nang-moc.json")
DUNG_SAI = 0.10

# (khoá "<tài liệu>.<chế độ>.<chỉ số>", trần, áp từ đợt, nguồn). Số lấy từ perf-md.md §4 + ke-hoach §2.
# Khung rAF lượng tử 16,7 ms nên "≤ 33 ms" viết thành 34 (khung đôi = 33,3 ms).
NGUONG = [
    ("doc-10k.editor.go_p50", 80, "M1", "perf-md §4, việc 3: doc-10k chỉ editor p50 ≤ 80 ms"),
    ("doc-2k.reading.cuon_doc_p95", 34, "M1", "perf-md việc 4: cuộn chế độ đọc doc-2k p95 ≤ 33 ms"),
    ("doc-10k.reading.cuon_doc_p95", 50, "M1", "perf-md §4, việc 4: cuộn chế độ đọc doc-10k p95 ≤ 50 ms"),
    ("doc-2k.split.go_p95", 80, "M5", "perf-md §4: doc-2k chia đôi gõ p95 ≤ 80 ms"),
    ("doc-10k.split.go_p95", 150, "M5", "perf-md §4, việc 8: doc-10k chia đôi gõ p95 ≤ 150 ms"),
    ("doc-10k.split.go_lt_max_ms", 150, "M5", "perf-md §4: long task khi gõ ≤ 150 ms"),
    ("doc-10k.split.preview_cap_nhat_ms", 400, "M5", "perf-md §4: preview cập nhật ≤ 400 ms"),
    ("doc-10k.split.mo_preview_ms", 2500, "M5", "perf-md §4, việc 9: khung đầu có preview ≤ 2,5 s"),
    ("doc-10k.split.mo_lt_max_sau_preview_ms", 300, "M5", "perf-md §4: sau khung đầu không long task > 300 ms"),
    ("doc-10k.split.mo_yen_ms", 30000, "M5", "perf-md §4: dựng xong ≤ 30 s"),
    ("doc-10k.split.cuon_preview_janky_pct", 10, "M5", "perf-md §4, việc 9: cuộn preview khung > 50 ms ≤ 10 %"),
    ("doc-10k.reading.mo_doc_ms", 2500, "M5", "perf-md việc 11: mở chế độ đọc khung đầu ≤ 2,5 s"),
    ("doc-30k.editor.go_p50", 180, "M9", "perf-md §4: doc-30k chỉ editor p50 ≤ 180 ms (--nang)"),
    ("doc-30k.editor.mo_editor_ms", 1500, "M9", "perf-md việc 13: mở doc-30k chỉ editor ≤ 1,5 s (--nang)"),
    ("doc-10k.editor.lich_su_tang_mb", 5, "M9", "perf-md §4, việc 14: hoàn tác 10 bước tăng ≤ 5 MB"),
]

# chỉ số → (nhãn, đơn vị, sàn tuyệt đối khi so mốc, có so với mốc không). Sàn che lượng tử đo: Event Timing làm tròn
# 8 ms, khung rAF 16,7 ms; số đo nhiễu (bộ nhớ, max) không so mốc.
CHI_SO = {
    "mo_editor_ms": ("Mở: khung đầu có editor", "ms", 300, True),
    "mo_preview_ms": ("Mở: khung đầu có preview", "ms", 300, True),
    "mo_doc_ms": ("Mở: khung đầu có bài đọc", "ms", 300, True),
    "mo_yen_ms": ("Mở: tới khi yên", "ms", 500, True),
    "mo_lt_max_ms": ("Mở: long task lớn nhất", "ms", 100, True),
    "mo_lt_max_sau_preview_ms": ("Mở: long task lớn nhất sau khung preview đầu", "ms", 100, True),
    "dom_nut": ("Nút DOM sau khi mở", "nút", 2000, True),
    "heap_mb": ("Heap JS sau khi mở", "MB", 5, False),
    "renderer_mb": ("Bộ nhớ riêng các renderer sau khi mở", "MB", 50, False),
    "go_phim": ("Gõ: số phím đã gõ (ngân sách 60 s)", "phím", 0, False),
    "go_p50": ("Gõ: trễ mỗi phím p50", "ms", 24, True),
    "go_p95": ("Gõ: trễ mỗi phím p95", "ms", 32, True),
    "go_max": ("Gõ: trễ lớn nhất", "ms", 0, False),
    "go_wall_ms": ("Gõ: thời gian thật cho cả lượt gõ", "ms", 0, False),
    "go_lt_max_ms": ("Gõ: long task lớn nhất trong lúc gõ", "ms", 50, True),
    "preview_cap_nhat_ms": ("Preview cập nhật sau phím cuối", "ms", 150, True),
    "go_lt_max_gom_render_ms": ("Gõ: long task lớn nhất (gồm render sau đó)", "ms", 50, True),
    "cuon_editor_p50": ("Cuộn editor: khung p50", "ms", 17, True),
    "cuon_editor_p95": ("Cuộn editor: khung p95", "ms", 17, True),
    "cuon_editor_janky_pct": ("Cuộn editor: khung > 50 ms", "%", 5, True),
    "cuon_preview_p50": ("Cuộn preview: khung p50", "ms", 17, True),
    "cuon_preview_p95": ("Cuộn preview: khung p95", "ms", 17, True),
    "cuon_preview_janky_pct": ("Cuộn preview: khung > 50 ms", "%", 5, True),
    "cuon_doc_p50": ("Cuộn chế độ đọc: khung p50", "ms", 17, True),
    "cuon_doc_p95": ("Cuộn chế độ đọc: khung p95", "ms", 17, True),
    "cuon_doc_janky_pct": ("Cuộn chế độ đọc: khung > 50 ms", "%", 5, True),
    "lich_su_tang_mb": ("Hoàn tác N bước: bộ nhớ riêng renderer tăng", "MB", 0, False),
    "ctrl_s_lt_max_ms": ("Ctrl+S: long task lớn nhất", "ms", 50, True),
    "loi_trang": ("Lỗi JS không bắt (pageerror)", "lỗi", 0, False),
}

HANG = {
    "split": ["mo_editor_ms", "mo_preview_ms", "mo_yen_ms", "mo_lt_max_ms", "mo_lt_max_sau_preview_ms", "dom_nut", "heap_mb", "renderer_mb",
              "go_phim", "go_p50", "go_p95", "go_max", "go_wall_ms", "go_lt_max_ms", "preview_cap_nhat_ms", "go_lt_max_gom_render_ms",
              "cuon_editor_p50", "cuon_editor_p95", "cuon_editor_janky_pct", "cuon_preview_p50", "cuon_preview_p95", "cuon_preview_janky_pct", "loi_trang"],
    "editor": ["mo_editor_ms", "mo_yen_ms", "mo_lt_max_ms", "dom_nut", "heap_mb", "go_phim", "go_p50", "go_p95", "go_max", "go_wall_ms", "go_lt_max_ms",
               "cuon_editor_p50", "cuon_editor_p95", "cuon_editor_janky_pct", "lich_su_tang_mb", "ctrl_s_lt_max_ms", "loi_trang"],
    "reading": ["mo_doc_ms", "mo_yen_ms", "mo_lt_max_ms", "dom_nut", "heap_mb", "cuon_doc_p50", "cuon_doc_p95", "cuon_doc_janky_pct", "loi_trang"],
}
TEN_CHE_DO = {"split": "Chia đôi (split)", "editor": "Chỉ editor", "reading": "Chế độ đọc (?read=1, nền split)"}
SU_KIEN_PHIM = ("keydown", "keypress", "keyup", "input", "beforeinput")


def slack() -> float:
    try:
        v = float(os.environ.get("MD_PERF_SLACK", "") or 1)
        return v if v > 0 else 1.0
    except ValueError:
        return 1.0


# ---------------------------------------------------------------------------------------------------------------------
# Phần thuần (tự kiểm được không cần trình duyệt)
# ---------------------------------------------------------------------------------------------------------------------
def pct(values, p):
    if not values:
        return 0
    v = sorted(values)
    k = min(len(v) - 1, max(0, int(round(p / 100 * (len(v) - 1)))))
    return v[k]


def tom_tat_khung(frames):
    frames = frames[1:] if len(frames) > 1 else frames
    n = len(frames)
    janky = sum(1 for f in frames if f > 50)
    return {"khung": n, "p50": round(pct(frames, 50), 1), "p95": round(pct(frames, 95), 1), "max": round(max(frames) if frames else 0, 1),
            "janky_gt50": janky, "janky_pct": round(100 * janky / n, 1) if n else 0}


def tom_tat_lt(lts, t0, t1):
    xs = [x for x in lts if t0 <= x["s"] <= t1]
    return {"so": len(xs), "tong_ms": round(sum(x["d"] for x in xs)), "max_ms": round(max([x["d"] for x in xs] or [0]))}


def tre_phim(evs, t0, t1, so_phim):
    """Trễ mỗi phím = max duration các sự kiện cùng interactionId (như INP). Trả (danh sách đã bù, số phím có sự kiện ≥ 16 ms).

    Event Timing chỉ báo sự kiện ≥ 16 ms: phím nhanh hơn không có mục nào ⇒ bù bằng 16 (cận trên) cho đủ `so_phim`."""
    theo_id: dict = {}
    khong_id = []
    for e in evs:
        if e["s"] < t0 or e["s"] > t1 or e["n"] not in SU_KIEN_PHIM:
            continue
        if e.get("id"):
            theo_id[e["id"]] = max(theo_id.get(e["id"], 0), e["d"])
        else:
            khong_id.append(e["d"])
    vals = list(theo_id.values()) if theo_id else khong_id
    co = len(vals)
    return vals + [16.0] * max(0, so_phim - co), co


def thu_tu_dot(dot: str) -> int:
    if dot not in DOT:
        raise ValueError(f"Đợt lạ: {dot} (biết: {', '.join(DOT)})")
    return DOT.index(dot)


def so_nguong(chi_so: dict, dot: str, he_so: float, nguong=None):
    """Ngưỡng tuyệt đối có hiệu lực ở `dot`. Trả (vi_pham, dat, bo_qua) — mỗi mục (khoá, giá trị, trần đã nhân hệ số, nguồn)."""
    vi_pham, dat, bo_qua = [], [], []
    for khoa, tran, tu, nguon in (NGUONG if nguong is None else nguong):
        if thu_tu_dot(tu) > thu_tu_dot(dot):
            continue
        tran_k = tran * he_so
        if khoa not in chi_so:
            bo_qua.append((khoa, None, tran_k, nguon))
            continue
        v = chi_so[khoa]
        (dat if isinstance(v, (int, float)) and v <= tran_k else vi_pham).append((khoa, v, tran_k, nguon))
    return vi_pham, dat, bo_qua


def so_moc(chi_so: dict, moc: dict, dung_sai: float, he_so: float):
    """So từng chỉ số có `so_moc` với mốc: cho phép max(mốc×(1+dung sai), mốc+sàn) × hệ số. Trả (vi_pham, dat)."""
    vi_pham, dat = [], []
    for khoa, m in sorted(moc.items()):
        ten = khoa.rsplit(".", 1)[-1]
        spec = CHI_SO.get(ten)
        if not spec or not spec[3] or not isinstance(m, (int, float)) or khoa not in chi_so:
            continue
        cho_phep = max(m * (1 + dung_sai), m + spec[2]) * he_so
        v = chi_so[khoa]
        (dat if isinstance(v, (int, float)) and v <= cho_phep else vi_pham).append((khoa, v, round(cho_phep, 1), m))
    return vi_pham, dat


def trung_vi(cac_lan: list[dict]) -> dict:
    """Gộp nhiều lần đo: trung vị của các giá trị số; chỉ số không lần nào đo được ⇒ None."""
    khoa = sorted({k for lan in cac_lan for k in lan})
    out = {}
    for k in khoa:
        so = [lan[k] for lan in cac_lan if isinstance(lan.get(k), (int, float))]
        out[k] = round(statistics.median(so), 1) if so else None
    return out


def tu_kiem(nang: bool = False) -> int:
    """Phần thuần: bộ sinh tài liệu giống mkdoc.mjs + logic ngưỡng/mốc. Trả số phép sai (in chi tiết khi sai)."""
    so = K.SoKiem(im_khi_dat=True)
    loi = T.tu_kiem(["doc-2k", "doc-10k"] + (["doc-30k"] if nang else []))
    so.kiem("tài liệu sinh tất định, từng byte giống mkdoc.mjs (sha256 ghim)", not loi, "; ".join(loi))
    so.kiem("pct: p50/p95 trên 1..100", pct(list(range(1, 101)), 50) == 51 and pct(list(range(1, 101)), 95) == 95 and pct([], 50) == 0)
    k = tom_tat_khung([0, 16.7, 16.7, 60, 16.7, 100])
    so.kiem("tóm tắt khung: bỏ khung đầu, đếm khung > 50 ms và %", k["khung"] == 5 and k["janky_gt50"] == 2 and k["janky_pct"] == 40.0, str(k))
    evs = [{"n": "keydown", "s": 10, "d": 40, "id": 1}, {"n": "keyup", "s": 12, "d": 56, "id": 1}, {"n": "input", "s": 11, "d": 70, "id": 0},
           {"n": "keydown", "s": 200, "d": 24, "id": 2}, {"n": "click", "s": 300, "d": 99, "id": 3}, {"n": "keydown", "s": 9000, "d": 500, "id": 4}]
    vals, co = tre_phim(evs, 0, 1000, 4)
    so.kiem("trễ phím: gộp theo interactionId, bỏ sự kiện ngoài khung giờ/không phải phím, bù 16 ms cho phím nhanh",
            sorted(vals) == [16.0, 16.0, 24, 56] and co == 2, f"{vals} {co}")
    ng = [("doc-10k.editor.go_p50", 80, "M1", "t"), ("doc-10k.split.go_p95", 150, "M5", "t"), ("doc-30k.editor.go_p50", 180, "M1", "t")]
    cs = {"doc-10k.editor.go_p50": 90, "doc-10k.split.go_p95": 9000}
    vp, d, bq = so_nguong(cs, "M1", 1.0, ng)
    so.kiem("ngưỡng: chỉ áp ngưỡng của đợt ≤ đợt hiện tại; vượt trần ⇒ vi phạm; tài liệu không đo ⇒ bỏ qua",
            [x[0] for x in vp] == ["doc-10k.editor.go_p50"] and not d and [x[0] for x in bq] == ["doc-30k.editor.go_p50"], f"{vp} {d} {bq}")
    vp, d, _ = so_nguong(cs, "M1", 1.2, ng)
    so.kiem("ngưỡng: hệ số máy chậm nhân trần (90 ≤ 80×1,2)", not vp and len(d) == 1, f"{vp}")
    vp, _, _ = so_nguong(cs, "M0", 1.0, ng)
    so.kiem("ngưỡng: ở M0 chưa ngưỡng nào của M1 có hiệu lực", not vp)
    vp, _, _ = so_nguong({"doc-10k.editor.go_p50": None}, "M1", 1.0, ng[:1])
    so.kiem("ngưỡng: chỉ số không đo được (None) là vi phạm", len(vp) == 1)
    moc = {"doc-2k.split.go_p95": 1000, "doc-2k.split.cuon_preview_p95": 16.7, "doc-2k.split.go_max": 10, "doc-2k.split.mo_yen_ms": 5000}
    vp, d = so_moc({"doc-2k.split.go_p95": 1101, "doc-2k.split.cuon_preview_p95": 33.3, "doc-2k.split.go_max": 99999, "doc-2k.split.mo_yen_ms": None}, moc, 0.10, 1.0)
    so.kiem("mốc: chậm hơn > 10 % ⇒ vi phạm; sàn tuyệt đối che lượng tử khung; chỉ số không so mốc thì bỏ; None ⇒ vi phạm",
            sorted(x[0] for x in vp) == ["doc-2k.split.go_p95", "doc-2k.split.mo_yen_ms"] and [x[0] for x in d] == ["doc-2k.split.cuon_preview_p95"], f"{vp} {d}")
    vp, _ = so_moc({"doc-2k.split.go_p95": 1099}, moc, 0.10, 1.0)
    so.kiem("mốc: chậm hơn ≤ 10 % vẫn đạt", not vp)
    vp, _ = so_moc({"doc-2k.split.go_p95": 2500}, moc, 0.10, 3.0)
    so.kiem("mốc: hệ số máy chậm nhân phần cho phép", not vp)
    so.kiem("trung vị nhiều lần đo", trung_vi([{"a": 1, "b": None}, {"a": 3, "b": None}, {"a": 2}]) == {"a": 2, "b": None})
    so.kiem("thời điểm yên không sớm hơn khung đầu (phần dựng/vẽ không phải long task) hay tài nguyên cuối",
            thoi_diem_yen({"lastLt": 1150, "lastRes": 900, "t": {"editor": 2681}}) == 2681
            and thoi_diem_yen({"lastLt": 1150, "lastRes": 3000.4, "t": {"editor": 2681, "lastMut": 10}}) == 3000)
    mg = mong_doi(T.sinh("doc-2k"))
    so.kiem("dấu nhận tài liệu đo: tiêu đề đầu của doc-2k ('1. …'), không phải welcome.md; độ dài đúng",
            mg["tieuDe"].startswith("1. ") and len(mg["tieuDe"]) == 20 and mg["dai"] == 91816, str(mg))
    off, dong = dong_dich(T.sinh("doc-2k"))
    ln = T.sinh("doc-2k").split("\n")[dong - 1]
    so.kiem("dòng gõ thử: văn xuôi giữa tài liệu, không có $, offset ở cuối dòng",
            900 <= dong <= 1100 and "$" not in ln and T.sinh("doc-2k")[:off].endswith(ln), f"dòng {dong}: {ln[:40]}")
    so.kiem("ngưỡng khai báo hợp lệ (đợt biết, chỉ số có nhãn, khoá đúng dạng)",
            all(t in DOT and n.rsplit(".", 1)[-1] in CHI_SO and n.split(".")[0] in T.TAI_LIEU and n.split(".")[1] in HANG for n, _, t, _ in NGUONG)
            and DOT_HIEN_TAI in DOT and all(x in CHI_SO for rows in HANG.values() for x in rows))
    if so.sai:
        so.tong_ket("Tự kiểm: ")
    else:
        print(f"  [ok]  tự kiểm thuần: {len(so.dat)} phép đạt")
    return len(so.sai)


# ---------------------------------------------------------------------------------------------------------------------
# Đo trong trình duyệt
# ---------------------------------------------------------------------------------------------------------------------
def _png(w, h, rgb=(91, 91, 214)):
    raw = b"".join(b"\x00" + bytes(rgb) * w for _ in range(h))

    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


ANH = _png(400, 200)

# Bộ quan sát cài trước khi trang chạy: long task, event timing (độ trễ input → khung hình kế), đếm khung hình.
QUAN_SAT = r"""
(() => {
  window.__lt = []; window.__ev = []; window.__phim = [];
  try { performance.setResourceTimingBufferSize(20000); } catch (e) {}
  // timeStamp = lúc trình duyệt nhận phím (không phải lúc handler chạy) — mốc cho "preview cập nhật sau phím cuối".
  addEventListener('keydown', (e) => { window.__phim.push(e.timeStamp); }, true);
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push({s: e.startTime, d: e.duration}); }).observe({type: 'longtask', buffered: true}); } catch (e) {}
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__ev.push({n: e.name, s: e.startTime, d: e.duration, id: e.interactionId || 0}); }).observe({type: 'event', durationThreshold: 16, buffered: true}); } catch (e) {}
  window.__frames = null;
  window.__startFrames = () => { window.__frames = []; let last = performance.now(); const loop = (t) => { if (!window.__frames) return; window.__frames.push(t - last); last = t; requestAnimationFrame(loop); }; requestAnimationFrame(loop); };
  window.__stopFrames = () => { const f = window.__frames || []; window.__frames = null; return f; };
})();
"""

# Mốc thời gian mở trang: khung đầu có editor / preview / bài đọc CỦA TÀI LIỆU ĐO. Trước khi hydrate, app vẽ một khung
# với tài liệu chào (welcome.md, có [data-line]) — đã thấy bằng Edge 23/10 — nên nhận diện theo tiêu đề đầu tiên của tài
# liệu đo (`__mong.tieuDe`) và độ dài textarea (`__mong.dai`), không theo [data-line] như perf_me.py.
# GHI CHÚ cho perf 8–11 (render theo khối): nếu preview dựng dần hay mermaid chờ IntersectionObserver thì xem lại điều
# kiện "yên" trong cho_yen() (đang chờ hết .mermaid-loading và 1,5 s không long task/không đổi DOM con của preview).
SAN_SANG = r"""
(() => {
  window.__t = {};
  const mong = window.__mong || {dai: 1000, tieuDe: ''};
  const coTieuDe = (el) => { const h = el && el.querySelector('h1,h2,h3,h4,h5,h6'); return !!h && h.textContent.includes(mong.tieuDe); };
  const tick = () => {
    const now = performance.now();
    const ta = document.querySelector('textarea.editor-input');
    if (!__t.editor && ta && ta.value.length >= mong.dai / 2) __t.editor = now;
    const body = document.querySelector('.preview-scroll .markdown-body');
    if (!__t.preview && coTieuDe(body)) {
      __t.preview = now;
      new MutationObserver(() => { __t.lastMut = performance.now(); }).observe(body, {childList: true});
    }
    const rd = document.querySelector('.reading-article');
    if (!__t.reading && coTieuDe(rd)) __t.reading = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();
"""


def mong_doi(md):
    """Dấu nhận ra tài liệu đo: độ dài + 20 ký tự đầu của tiêu đề đầu tiên (không phải welcome.md)."""
    tieu_de = next((ln.lstrip("#").strip() for ln in md.split("\n") if ln.startswith("#")), "")
    return {"dai": len(md), "tieuDe": tieu_de[:20]}

NAP = """([md, view, token]) => {
  localStorage.setItem('markdown-editor:files', JSON.stringify({version: 2, currentFileId: 'doc', expandedFolders: ['root'],
    files: [{id: 'root', name: 'My Documents', type: 'folder', children: [{id: 'doc', name: 'long.md', type: 'file', parentId: 'root', content: md}]}]}));
  localStorage.setItem('markdown-editor:settings', JSON.stringify({theme: 'light', viewMode: view, scrollSync: true, showLineNumbers: true,
    wordWrap: true, sidebarTab: 'files', sidebarCollapsed: false}));
  localStorage.setItem('markdown-editor:admin-session', token);
}"""


def dong_dich(md):
    """Một dòng văn xuôi ở giữa tài liệu (ngoài khối code, không có `$`): trả (offset cuối dòng, số dòng 1-based)."""
    lines = md.split("\n")
    fence = False
    cands = []
    for i, ln in enumerate(lines):
        if re.match(r"^\s{0,3}(```|~~~)", ln):
            fence = not fence
            continue
        if not fence and re.match(r"^[A-ZĐÀ-Ỹ][^|>#\-\d$]", ln) and (i == 0 or lines[i - 1].strip() == "") and "$" not in ln:
            cands.append(i)
    i = min(cands, key=lambda k: abs(k - len(lines) // 2))
    return sum(len(x) + 1 for x in lines[:i]) + len(lines[i]), i + 1


def renderer_pids(browser) -> set:
    """PID các tiến trình renderer hiện có của trình duyệt (CDP SystemInfo.getProcessInfo); lỗi ⇒ tập rỗng."""
    try:
        b = browser.new_browser_cdp_session()
        info = b.send("SystemInfo.getProcessInfo")["processInfo"]
        b.detach()
        return {str(x["id"]) for x in info if x.get("type") == "renderer"}
    except Exception:
        return set()


def bo_nho_tung_renderer(browser) -> dict:
    """{pid: MB bộ nhớ riêng} của từng renderer — gồm cả chuỗi ngoài heap V8 (giá trị textarea là external string của
    Blink, heap JS không thấy). Chỉ Windows (Get-Process); lỗi ⇒ {}."""
    pids = renderer_pids(browser)
    if not pids or os.name != "nt":
        return {}
    try:
        out = subprocess.run(["powershell", "-NoProfile", "-Command",
                              "Get-Process -Id %s | ForEach-Object { '{0}={1}' -f $_.Id, $_.PrivateMemorySize64 }" % ",".join(sorted(pids))],
                             capture_output=True, text=True, timeout=30).stdout
        return {k: round(int(v) / 1048576, 1) for k, v in (ln.strip().split("=", 1) for ln in out.splitlines() if "=" in ln)}
    except Exception:
        return {}


def renderer_cua_trang(browser):
    """(pid, MB) của renderer lớn nhất = renderer của trang đang đo (tài liệu dài + hàng chục nghìn nút DOM).
    Không lọc theo "PID mới sinh": Chromium giữ sẵn một renderer dự phòng và trang mới lấy luôn tiến trình đó."""
    m = bo_nho_tung_renderer(browser)
    if not m:
        return None, None
    pid = max(m, key=m.get)
    return pid, m[pid]


def heap(cdp):
    try:
        cdp.send("HeapProfiler.collectGarbage")
    except Exception:
        pass
    m = {x["name"]: x["value"] for x in cdp.send("Performance.getMetrics")["metrics"]}
    return {"heapMB": round(m.get("JSHeapUsedSize", 0) / 1048576, 1), "nodes": int(m.get("Nodes", 0))}


class Mang:
    """Đếm yêu cầu mạng đang bay (ảnh giả, chunk mermaid…) — "yên" phải chờ cả mạng: dưới tải nặng, ảnh do page.route
    trả chậm làm luồng chính rảnh > 1,5 s giữa chừng và điều kiện yên cũ báo sớm (đã gặp: doc-10k "yên" 7,6 s thay vì ~19 s)."""

    def __init__(self, page):
        self.dang_bay = 0
        self.cuoi = time.time()
        page.on("request", self._bat_dau)
        page.on("requestfinished", self._xong)
        page.on("requestfailed", self._xong)

    def _bat_dau(self, _r):
        self.dang_bay += 1
        self.cuoi = time.time()

    def _xong(self, _r):
        self.dang_bay = max(0, self.dang_bay - 1)
        self.cuoi = time.time()

    def yen(self, giay=1.5):
        return self.dang_bay == 0 and time.time() - self.cuoi > giay


def cho_yen(page, mode, han_s, mang=None):
    """Chờ: đã có mốc của chế độ + 1,5 s không long task, không đổi DOM con của preview, không yêu cầu mạng nào
    + không còn sơ đồ đang vẽ."""
    deadline = time.time() + han_s
    s = {}
    while time.time() < deadline:
        s = page.evaluate("""() => { const now = performance.now(); const lt = window.__lt; const lastLt = lt.length ? lt[lt.length-1].s + lt[lt.length-1].d : 0;
          let lastRes = 0; for (const e of performance.getEntriesByType('resource')) lastRes = Math.max(lastRes, e.responseEnd);
          return {now, lastLt, lastRes, t: window.__t, loading: document.querySelectorAll('.mermaid-loading').length,
                  admin: !!document.querySelector('.status-role.is-admin')}; }""")
        t = s["t"]
        ok = t.get("reading") if mode == "reading" else (t.get("editor") and (mode == "editor" or t.get("preview")))
        if ok and s["now"] - max(s["lastLt"], s["lastRes"], t.get("lastMut", 0)) > 1500 and s["loading"] == 0 and (mang is None or mang.yen()):
            s["het_gio"] = False
            return s
        time.sleep(0.25)
    s["het_gio"] = True
    return s


def thoi_diem_yen(s):
    """Lúc trang yên = muộn nhất trong: long task cuối, tài nguyên mạng cuối, đổi DOM preview cuối, khung đầu của editor/preview/bài đọc
    (khung đầu có thể đến sau long task cuối: phần dựng/vẽ của trình duyệt không được tính là long task)."""
    t = s.get("t", {})
    return round(max(s.get("lastLt", 0), s.get("lastRes", 0), t.get("lastMut", 0), t.get("editor", 0), t.get("preview", 0), t.get("reading", 0)))


def cho_quan_tri(page, giay):
    """Chờ app tự khôi phục phiên quản trị (yêu cầu kiểm phiên có thể còn treo tới TIMEOUT_MS = 10 s sau khi trang đã yên)."""
    try:
        page.wait_for_selector(".status-role.is-admin", timeout=giay * 1000)
        return True
    except Exception:
        return False


def mo_khoa(page, nguon, han_s):
    """Mở khoá quản trị qua giao diện (chip vai trò → khoá → Unlock), như kiem-pwa.py. Chỉ bấm chip CHƯA là admin —
    chip admin bấm vào là đăng xuất."""
    ms = han_s * 1000
    page.click("button.role-chip:not(.is-admin)", timeout=ms)
    page.fill("#admin-key", nguon["khoa"], timeout=ms)
    page.click('button:has-text("Unlock")', timeout=ms)
    page.wait_for_selector("button.role-chip.is-admin", timeout=ms)
    time.sleep(1.0)


def cuon(page, sel, wheels):
    box = page.locator(sel).bounding_box()
    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    page.evaluate("(sel) => { document.querySelector(sel).scrollTop = 0 }", sel)
    time.sleep(0.5)
    t0 = page.evaluate("(window.__startFrames(), performance.now())")
    for _ in range(wheels):
        page.mouse.wheel(0, 400)
        time.sleep(0.02)
    time.sleep(0.6)
    fr = page.evaluate("window.__stopFrames()")
    t1 = page.evaluate("performance.now()")
    return dict(tom_tat_khung(fr), lt=tom_tat_lt(page.evaluate("window.__lt"), t0, t1))


def do_che_do(browser, nguon, md, mode, a):
    """Một lượt đo (tài liệu × chế độ) trong một context mới. Trả (chỉ số phẳng, số liệu thô)."""
    ctx = browser.new_context(viewport={"width": 1440, "height": 900}, service_workers="block")
    try:
        if not nguon["that"]:
            for duong in ("**/markdown/admin/session", "**/markdown/admin/verify"):
                ctx.route(duong, lambda r: r.fulfill(status=200, content_type="application/json", body='{"session":"tok"}'))
            ctx.route("**/markdown/backends", lambda r: r.fulfill(status=200, content_type="application/json", body="[]"))
        ctx.route("https://img.example.test/**", lambda r: r.fulfill(status=200, content_type="image/png", body=ANH))
        page = ctx.new_page()
        loi = []
        page.on("pageerror", lambda e: loi.append(str(e)[:300]))
        mang = Mang(page)
        page.goto(nguon["url"] + "manifest.webmanifest")
        page.evaluate(NAP, [md, "editor" if mode == "editor" else "split", nguon["token"]])
        page.add_init_script(QUAN_SAT)
        page.add_init_script("window.__mong = " + json.dumps(mong_doi(md), ensure_ascii=False) + ";")
        page.add_init_script(SAN_SANG)
        cdp = ctx.new_cdp_session(page)
        cdp.send("Performance.enable")
        tho = {}
        t_wall = time.time()
        page.goto(nguon["url"] + ("?read=1" if mode == "reading" else ""), wait_until="load", timeout=a.han * 1000)
        s = cho_yen(page, mode, a.han, mang)
        t = s.get("t", {})
        lts = page.evaluate("window.__lt")
        yen = thoi_diem_yen(s) if not s["het_gio"] else None
        tho["mo"] = {"editor_ms": round(t.get("editor", 0)), "preview_ms": round(t.get("preview", 0)), "reading_ms": round(t.get("reading", 0)),
                     "yen_ms": yen, "het_gio": s["het_gio"], "wall_s": round(time.time() - t_wall, 1), "admin": s.get("admin"),
                     "lt": tom_tat_lt(lts, 0, s.get("now", 0))}
        mem = heap(cdp)
        pid_trang, mb_trang = renderer_cua_trang(browser)
        tho["bo_nho_sau_mo"] = dict(mem, rendererPrivateMB=mb_trang, renderer_pid=pid_trang)
        cs = {"mo_yen_ms": yen, "mo_lt_max_ms": tho["mo"]["lt"]["max_ms"], "dom_nut": mem["nodes"], "heap_mb": mem["heapMB"]}
        if mode == "reading":
            cs["mo_doc_ms"] = tho["mo"]["reading_ms"] or None
        else:
            cs["mo_editor_ms"] = tho["mo"]["editor_ms"] or None
        if mode == "split":
            cs["mo_preview_ms"] = tho["mo"]["preview_ms"] or None
            cs["mo_lt_max_sau_preview_ms"] = tom_tat_lt(lts, t.get("preview", 0) or 1e12, s.get("now", 0))["max_ms"] if t.get("preview") else None
            cs["renderer_mb"] = tho["bo_nho_sau_mo"]["rendererPrivateMB"]

        if mode in ("split", "editor"):
            tho["mo"]["mo_khoa_lai"] = False
            if s.get("admin") is not True and not cho_quan_tri(page, 12):
                # Đã gặp ở doc-30k (23/10): luồng chính bận > 10 s lúc mở nên bộ hẹn giờ 10 s của restoreAdminSession
                # (services/markdownStorage.ts TIMEOUT_MS) huỷ yêu cầu trước khi kịp đọc trả lời ⇒ app về chỉ-xem.
                # Người dùng sẽ bấm Unlock — script làm đúng như vậy rồi đo tiếp, và ghi lại.
                mo_khoa(page, nguon, a.han)
                tho["mo"]["mo_khoa_lai"] = True
            if page.evaluate("document.querySelector('textarea.editor-input').readOnly"):
                raise RuntimeError("Không vào được chế độ quản trị (ô soạn chỉ-đọc) — số đo gõ sẽ vô nghĩa")
            off, dong = dong_dich(md)
            page.evaluate("(off) => { const ta = document.querySelector('textarea.editor-input'); ta.focus(); ta.setSelectionRange(off, off); ta.blur(); ta.focus(); }", off)
            time.sleep(0.3)
            mau = ("zqx" * 8)[:a.phim]
            t0 = page.evaluate("performance.now()")
            t_bat_dau = time.time()
            go = ""
            for i, ch in enumerate(mau):
                # keyboard.type(ch) = keydown+keyup liền nhau; nhịp 150 ms đặt GIỮA các phím (type(..., delay=150) của
                # Playwright lại chờ 150 ms giữa keydown và keyup của cùng một phím).
                page.keyboard.type(ch)
                go += ch
                if i == len(mau) - 1 or time.time() - t_bat_dau > a.ngan_sach_go:
                    break
                time.sleep(0.15)
            wall_ms = round((time.time() - t_bat_dau) * 1000)
            phim_ts = [x for x in page.evaluate("window.__phim") if x >= t0]
            t1 = max(phim_ts) if phim_ts else page.evaluate("performance.now()")
            if go not in page.evaluate("document.querySelector('textarea.editor-input').value"):
                raise RuntimeError("Chữ gõ thử không vào ô soạn")
            evs = page.evaluate("window.__ev")
            lat, co = tre_phim(evs, t0, t1 + 50, len(go))
            lt_go = tom_tat_lt(page.evaluate("window.__lt"), t0, t1)
            # cách gộp của perf_me.py (sự kiện không interactionId thành nhóm riêng) — chỉ để đối chiếu với số của thiết kế
            cu: dict = {}
            for e in evs:
                if t0 <= e["s"] <= t1 + 50 and e["n"] in SU_KIEN_PHIM:
                    k = e.get("id") or (e["n"], round(e["s"]))
                    cu[k] = max(cu.get(k, 0), e["d"])
            tho["go"] = {"phim": len(go), "wall_ms": wall_ms, "p50": round(pct(lat, 50)), "p95": round(pct(lat, 95)), "max": round(max(lat or [0])),
                         "phim_co_su_kien_tren16": co, "lt": lt_go, "dong": dong,
                         "kieu_perf_me": {"nhom": len(cu), "p50": round(pct(list(cu.values()), 50)), "p95": round(pct(list(cu.values()), 95))}}
            cs.update({"go_phim": len(go), "go_wall_ms": tho["go"]["wall_ms"], "go_p50": tho["go"]["p50"], "go_p95": tho["go"]["p95"],
                       "go_max": tho["go"]["max"], "go_lt_max_ms": lt_go["max_ms"]})
            if mode == "split":
                tq = None
                dl = time.time() + a.han
                while time.time() < dl:
                    v = page.evaluate("""([L, m]) => { const el = document.querySelector('.preview-scroll [data-line="' + L + '"]');
                        return el && el.textContent.includes(m) ? performance.now() : 0; }""", [dong, go])
                    if v:
                        tq = v
                        break
                    time.sleep(0.1)
                time.sleep(1.0)
                dl = time.time() + a.han
                while time.time() < dl:
                    st = page.evaluate("() => { const lt = window.__lt; return {now: performance.now(), last: lt.length ? lt[lt.length-1].s + lt[lt.length-1].d : 0}; }")
                    if st["now"] - st["last"] > 1500:
                        break
                    time.sleep(0.25)
                tho["go"]["preview_cap_nhat_ms"] = round(tq - t1) if tq else None
                tho["go"]["lt_gom_render"] = tom_tat_lt(page.evaluate("window.__lt"), t0, st["now"])
                cs["preview_cap_nhat_ms"] = tho["go"]["preview_cap_nhat_ms"]
                cs["go_lt_max_gom_render_ms"] = tho["go"]["lt_gom_render"]["max_ms"]
            else:
                time.sleep(1.5)
            for ten, sel in (("cuon_editor", "textarea.editor-input"), ("cuon_preview", ".preview-scroll")):
                if mode == "editor" and ten == "cuon_preview":
                    continue
                r = cuon(page, sel, a.cuon)
                tho[ten] = r
                cs.update({ten + "_p50": r["p50"], ten + "_p95": r["p95"], ten + "_janky_pct": r["janky_pct"]})
            if mode == "editor" and a.lich_su:
                # Ép GC trước mỗi lần lấy mẫu: bộ nhớ riêng dao động hàng chục MB theo rác của lượt gõ/cuộn trước đó.
                # Dù vậy chỉ số vẫn nhiễu (bộ cấp phát giữ trang đã giải phóng) — không so mốc, không làm ngưỡng.
                heap(cdp)
                time.sleep(0.5)
                truoc = bo_nho_tung_renderer(browser).get(pid_trang)
                for _ in range(a.lich_su):
                    page.keyboard.type("a")
                    time.sleep(0.75)  # > HISTORY_DEBOUNCE_MS (600) ⇒ mỗi lần là một bước hoàn tác
                heap(cdp)
                time.sleep(0.5)
                sau = bo_nho_tung_renderer(browser).get(pid_trang)
                tang = round(sau - truoc, 1) if isinstance(sau, float) and isinstance(truoc, float) else None
                tho["lich_su"] = {"buoc": a.lich_su, "truoc_MB": truoc, "sau_MB": sau, "tang_MB": tang}
                cs["lich_su_tang_mb"] = tang
            if mode == "editor":
                t0 = page.evaluate("performance.now()")
                page.keyboard.press("Control+s")
                time.sleep(0.8)
                tho["ctrl_s"] = tom_tat_lt(page.evaluate("window.__lt"), t0 - 5, t0 + 800)
                tho["ctrl_s"]["loi_luu"] = page.evaluate("!!document.querySelector('.status-save.is-error')")
                cs["ctrl_s_lt_max_ms"] = tho["ctrl_s"]["max_ms"]
        if mode == "reading":
            r = cuon(page, ".reading-scroll", a.cuon)
            tho["cuon_doc"] = r
            cs.update({"cuon_doc_p50": r["p50"], "cuon_doc_p95": r["p95"], "cuon_doc_janky_pct": r["janky_pct"]})
        tho["loi_trang"] = loi
        cs["loi_trang"] = len(loi)
        return cs, tho
    finally:
        ctx.close()


def chuan_bi_nguon(a):
    """Chọn bản build cần đo; build lại dist nếu cũ hơn nguồn (trừ khi --khong-build)."""
    if a.may_chu == "that":
        return K.BAN_XUAT, "ban-xuat (uvicorn thật)"
    if a.nguon == "ban-xuat":
        return K.BAN_XUAT, "ban-xuat"
    cu = K.build_cu_hon_nguon()
    if a.build or cu:
        if cu and not a.build:
            print(f"  · dist cũ hơn nguồn ({', '.join(cu[:3])}{'…' if len(cu) > 3 else ''})")
        if a.khong_build:
            raise RuntimeError("dist/ cũ hơn nguồn mà có --khong-build — số đo sẽ không phải của mã đang sửa")
        K.build()
    return K.DIST, "dist"


def git_commit():
    try:
        r = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=K.REPO, capture_output=True, text=True, timeout=10)
        sua = subprocess.run(["git", "status", "--porcelain", "--", "markdown-editor/src"], cwd=K.REPO, capture_output=True, text=True, timeout=30).stdout.strip()
        return r.stdout.strip() + ("+sửa" if sua else "")
    except Exception:
        return None


def do_tat_ca(a, docs, modes):
    from playwright.sync_api import sync_playwright

    thu_muc, ten_nguon = chuan_bi_nguon(a)
    cac_lan, tho_lan = [], []
    loi_do: dict = {}
    srv_that = tinh = None
    with sync_playwright() as pw:
        browser, kenh = K.mo_trinh_duyet(pw, headless=not a.headed, args=["--enable-precise-memory-info"], cho_thay_the=not (a.nguong or a.ghi_moc))
        if browser is None:
            raise RuntimeError("Không mở được Edge (channel=msedge)" + ("" if (a.nguong or a.ghi_moc) else "/Chrome/Chromium"))
        phien_ban = browser.version
        try:
            if a.may_chu == "that":
                srv_that = K.MayChuThat().start()
                nguon = {"url": srv_that.app_url, "token": srv_that.phien_quan_tri(), "khoa": srv_that.khoa, "that": True}
            else:
                tinh = K.MayChuTinh(thu_muc).__enter__()
                nguon = {"url": tinh.base, "token": "tok", "khoa": K.KHOA_GIA, "that": False}
            print(f"Markdown Editor Pro — đo hiệu năng · {kenh} {phien_ban} · {ten_nguon} · {nguon['url']}")
            for lan in range(a.lap):
                cs_lan, tho = {}, {}
                for doc in docs:
                    md = T.sinh(doc)
                    for mode in modes:
                        t = time.time()
                        print(f"  · {'lần %d · ' % (lan + 1) if a.lap > 1 else ''}{doc} · {mode} …", end="", flush=True)
                        try:
                            cs, r = do_che_do(browser, nguon, md, mode, a)
                        except Exception as e:  # một lượt hỏng không xoá kết quả các lượt khác
                            loi_do[f"{doc}.{mode}"] = f"{type(e).__name__}: {str(e)[:300]}"
                            print(f" HỎNG sau {time.time() - t:.0f} s — {loi_do[f'{doc}.{mode}']}", flush=True)
                            continue
                        cs_lan.update({f"{doc}.{mode}.{k}": v for k, v in cs.items()})
                        tho[f"{doc}.{mode}"] = r
                        ghi = [" (HẾT GIỜ chờ yên)" if r["mo"]["het_gio"] else "", f" ({len(r['loi_trang'])} lỗi trang)" if r["loi_trang"] else "",
                               " (phiên quản trị lúc mở bị huỷ — đã Unlock lại)" if r["mo"].get("mo_khoa_lai") else ""]
                        print(f" {time.time() - t:.0f} s" + "".join(ghi), flush=True)
                cac_lan.append(cs_lan)
                tho_lan.append(tho)
        finally:
            browser.close()
            if tinh:
                tinh.__exit__(None, None, None)
            if srv_that:
                srv_that.cleanup()
    return {"thoi_diem": dt.datetime.now().isoformat(timespec="seconds"), "dot": a.dot, "commit": git_commit(), "trinh_duyet": f"{kenh} {phien_ban}", "loi_do": loi_do,
            "nguon": ten_nguon, "may": platform.platform(), "slack": slack(), "lap": a.lap,
            "tai_lieu": {d: dict(T.thong_ke(T.sinh(d)), sha256=T.sha256(T.sinh(d))) for d in docs},
            "chi_so": trung_vi(cac_lan) if a.lap > 1 else cac_lan[0], "cac_lan": cac_lan, "tho": tho_lan}


# ---------------------------------------------------------------------------------------------------------------------
# In bảng, mốc
# ---------------------------------------------------------------------------------------------------------------------
def doc_moc():
    try:
        with open(MOC_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def _so(v, don_vi):
    if v is None:
        return "—"
    if isinstance(v, float) and don_vi in ("MB", "%") or (isinstance(v, float) and v != int(v)):
        return f"{v:,.1f}".replace(",", " ")
    return f"{int(round(v)):,}".replace(",", " ")


def in_bang(kq, moc):
    cs = kq["chi_so"]
    docs = list(kq["tai_lieu"])
    m = (moc or {}).get("chi_so", {})
    print(f"\nKết quả ({kq['trinh_duyet']}, {kq['nguon']}, commit {kq['commit']}, {kq['thoi_diem']}"
          + (f", trung vị {kq['lap']} lần" if kq["lap"] > 1 else "") + ")")
    print("  Tài liệu: " + " · ".join(f"{d} = {kq['tai_lieu'][d]['dong']:,} dòng / {kq['tai_lieu'][d]['kb']} KB".replace(",", ".") for d in docs))
    if m:
        print(f"  Ngoặc: chênh so với mốc {moc.get('dot')} ({moc.get('ngay')}); + là chậm hơn.")
    rong = 18
    for mode, hang in HANG.items():
        if not any(f"{d}.{mode}.{hang[0]}" in cs for d in docs):
            continue
        print(f"\n  {TEN_CHE_DO[mode]:<52}" + "".join(f"{d:>{rong}}" for d in docs))
        for ten in hang:
            nhan, dv = CHI_SO[ten][0], CHI_SO[ten][1]
            o = []
            for d in docs:
                k = f"{d}.{mode}.{ten}"
                if k not in cs:
                    o.append(f"{'':>{rong}}")
                    continue
                s = _so(cs[k], dv)
                mk = m.get(k)
                if isinstance(mk, (int, float)) and isinstance(cs[k], (int, float)) and mk and CHI_SO[ten][3]:
                    s += f" ({(cs[k] - mk) / mk * 100:+.0f}%)"
                o.append(f"{s:>{rong}}")
            print(f"    {nhan + ' (' + dv + ')':<50}" + "".join(o))


def ghi_moc(kq):
    cu = doc_moc() or {}
    chi_so = dict(cu.get("chi_so", {}))
    chi_so.update({k: v for k, v in kq["chi_so"].items()})
    moc = {
        "ghi_chu": "Mốc hiệu năng Markdown Editor Pro trên máy dev (Edge headless 1440×900). Ghi bằng kiem-hieu-nang.py --ghi-moc; "
                   "--nguong so với tệp này (dung sai 10 %, sàn tuyệt đối theo CHI_SO, nhân MD_PERF_SLACK). Mỗi đợt kết thúc ghi lại mốc.",
        "dot": kq["dot"], "ngay": kq["thoi_diem"], "commit": kq["commit"], "trinh_duyet": kq["trinh_duyet"], "nguon": kq["nguon"], "may": kq["may"],
        "lap": kq["lap"], "tai_lieu": {**cu.get("tai_lieu", {}), **kq["tai_lieu"]}, "chi_so": dict(sorted(chi_so.items())),
    }
    with open(MOC_PATH, "w", encoding="utf-8", newline="\n") as f:
        json.dump(moc, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"\n  · đã ghi mốc: {os.path.relpath(MOC_PATH, K.REPO)}")


def kiem_nguong(kq, moc, a):
    he_so = slack()
    cs = kq["chi_so"]
    so = K.SoKiem()
    print(f"\nNgưỡng tuyệt đối (đợt {a.dot}, MD_PERF_SLACK={he_so:g}):")
    vp, dat, bq = so_nguong(cs, a.dot, he_so)
    for khoa, v, tran, nguon in dat + vp:
        dung = (khoa, v, tran, nguon) in dat
        so.kiem(f"{khoa} = {_so(v, '')} {'≤' if dung else 'vượt trần'} {tran:g}  ({nguon})", dung)
    for khoa, _, _, nguon in bq:
        print(f"  [bỏ qua] {khoa} — không đo lần này ({nguon})")
    if not (dat or vp):
        print("  (chưa có ngưỡng tuyệt đối nào có hiệu lực ở đợt này)")
    loi = {k: v for k, v in cs.items() if k.endswith(".loi_trang") and v}
    so.kiem("không có lỗi JS không bắt (pageerror) trong lúc đo", not loi, json.dumps(loi))
    if moc and moc.get("chi_so"):
        if moc.get("trinh_duyet", "").split(" ")[0] != kq["trinh_duyet"].split(" ")[0]:
            print(f"  ! mốc đo bằng {moc.get('trinh_duyet')}, lần này {kq['trinh_duyet']}")
        vp, dat = so_moc(cs, moc["chi_so"], a.dung_sai, he_so)
        print(f"So với mốc {moc.get('dot')} ({moc.get('ngay')}, dung sai {a.dung_sai * 100:g} % hoặc sàn tuyệt đối, × {he_so:g}): {len(dat)} chỉ số đạt")
        for khoa, v, cho_phep, m in vp:
            so.kiem(f"{khoa} = {_so(v, '')} > {cho_phep:g} (mốc {_so(m, '')})", False)
    else:
        print(f"  (chưa có mốc {os.path.relpath(MOC_PATH, K.REPO)} — bỏ phần so mốc)")
    return so.tong_ket("\nNgưỡng: ")


def main() -> int:
    ap = argparse.ArgumentParser(description="Đo hiệu năng Markdown Editor Pro trong Edge thật", formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--bao-cao", action="store_true")
    ap.add_argument("--nguong", action="store_true")
    ap.add_argument("--nang", action="store_true")
    ap.add_argument("--chi", default="")
    ap.add_argument("--che-do", default="split,editor,reading")
    ap.add_argument("--lap", type=int, default=0, help="số lần đo, lấy trung vị (mặc định 3 khi --nguong/--ghi-moc, 1 khi chỉ báo cáo)")
    ap.add_argument("--dot", default=DOT_HIEN_TAI)
    ap.add_argument("--dung-sai", type=float, default=DUNG_SAI)
    ap.add_argument("--ghi-moc", action="store_true")
    ap.add_argument("--nguon", choices=("dist", "ban-xuat"), default="dist")
    ap.add_argument("--may-chu", choices=("tinh", "that"), default="tinh")
    ap.add_argument("--build", action="store_true")
    ap.add_argument("--khong-build", action="store_true")
    ap.add_argument("--json", default="")
    ap.add_argument("--tu-kiem", action="store_true")
    ap.add_argument("--headed", action="store_true")
    ap.add_argument("--phim", type=int, default=21, help="số ký tự gõ thử (tối đa 24)")
    ap.add_argument("--ngan-sach-go", type=float, default=60.0, help="giây; quá thì thôi gõ tiếp")
    ap.add_argument("--lich-su", type=int, default=10, help="số bước hoàn tác khi đo bộ nhớ (0 = bỏ)")
    ap.add_argument("--cuon", type=int, default=40, help="số lần lăn chuột khi đo cuộn")
    ap.add_argument("--han", type=int, default=600, help="giây chờ tối đa cho mỗi lần mở/cập nhật")
    a = ap.parse_args()
    a.phim = max(1, min(24, a.phim))
    a.lap = a.lap if a.lap > 0 else (3 if (a.nguong or a.ghi_moc) else 1)
    try:
        thu_tu_dot(a.dot)
    except ValueError as e:
        print(e)
        return 2

    if tu_kiem(a.nang):
        return 1
    if a.tu_kiem:
        return 0

    docs = [d.strip() for d in a.chi.split(",") if d.strip()] or (["doc-2k", "doc-10k"] + (["doc-30k"] if a.nang else []))
    modes = [m.strip() for m in a.che_do.split(",") if m.strip()]
    la = [d for d in docs if d not in T.TAI_LIEU or d == "wiki-12k"] + [m for m in modes if m not in HANG]
    if la:
        print(f"Không biết: {', '.join(la)} (tài liệu: doc-2k, doc-10k, doc-30k; chế độ: {', '.join(HANG)})")
        return 2
    try:
        kq = do_tat_ca(a, docs, modes)
    except Exception as e:  # lỗi đo (không mở được trình duyệt, không vào được quản trị…) — không phải "chậm"
        print(f"\n[SAI] không đo được: {e}")
        return 1

    out = a.json or os.path.join(tempfile.gettempdir(), "mdpro-hieu-nang", f"ket-qua-{dt.datetime.now():%Y%m%d-%H%M%S}.json")
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(kq, f, ensure_ascii=False, indent=1)
    moc = doc_moc()
    if a.bao_cao or not a.nguong:
        in_bang(kq, moc)
    print(f"\n  · JSON: {out}")
    ma = kiem_nguong(kq, moc, a) if a.nguong else 0
    if a.ghi_moc:
        ghi_moc(kq)
    if kq["loi_do"]:
        print(f"\n[SAI] {len(kq['loi_do'])} lượt đo hỏng (số đo thiếu):")
        for k, v in kq["loi_do"].items():
            print(f"  - {k}: {v}")
        return 1
    return ma


if __name__ == "__main__":
    sys.exit(main())
