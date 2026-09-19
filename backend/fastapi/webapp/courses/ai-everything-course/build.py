#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gom dai khoa hoc AI thanh assets/content.js.

Chay:  python build.py
Noi dung duoc nhung san nen trang chay duoc ca khi mo bang file://

DAY CUNG LA NOI KHAI BAO THU TU HOC. Them bai moi -> them ten file vao MON.
File chua ton tai se duoc bao "thieu" va bo qua (trang van chay).
"""

import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

# engine dung chung: ghi content.js (runtime) + content.json (cong cu)
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(HERE)), "engine"))
import xuat
ROOT = os.path.dirname(HERE)                      # .../ai-everything-course
OUT = os.path.join(HERE, "assets", "content.js")

CT = "00-chuong-trinh"
DA = "do-an"
TL = "tai-lieu"
DT = "de-thi"


def L(path, title=None, kind="lesson", tag=None):
    return {"path": path, "title": title, "kind": kind, "tag": tag}


# ---------------------------------------------------------------------------
# 15 mon hoc: (ma, thu_muc, tieu_de, viet_tat, [ten file bai giang])
# ---------------------------------------------------------------------------
MON = [
    ("M01", "mon-01-nhap-mon-ai", "M01 — Nhập môn Trí tuệ nhân tạo", "M01", [
        "bai-01-tri-tue-nhan-tao-la-gi",
        "bai-02-lich-su-ai-va-ba-mua-dong",
        "bai-03-tac-tu-thong-minh-va-moi-truong",
        "bai-04-bieu-dien-bai-toan-khong-gian-trang-thai",
        "bai-05-tim-kiem-mu",
        "bai-06-tim-kiem-co-thong-tin-a-sao",
        "bai-07-tim-kiem-doi-khang-tro-choi",
        "bai-08-toi-uu-cuc-bo-va-metaheuristic",
        "bai-09-bai-toan-thoa-rang-buoc",
        "bai-10-bon-truong-phai-ai",
        "bai-11-do-luong-tri-tue-va-benchmark",
        "bai-12-toan-canh-ai-hien-dai",
    ]),
    ("M02", "mon-02-toan-va-lap-trinh", "M02 — Toán học & Lập trình cho AI", "M02", [
        "bai-01-python-cho-khoa-hoc-du-lieu",
        "bai-02-numpy-va-tinh-toan-vector-hoa",
        "bai-03-hieu-nang-bo-nho-do-phuc-tap",
        "bai-04-vector-va-khong-gian-vector",
        "bai-05-tich-vo-huong-chuan-va-goc",
        "bai-06-ma-tran-va-bien-doi-tuyen-tinh",
        "bai-07-tri-rieng-svd-va-pca",
        "bai-08-dao-ham-va-gradient",
        "bai-09-quy-tac-chuoi-va-dao-ham-tu-dong",
        "bai-10-jacobian-hessian-va-do-cong",
        "bai-11-toi-uu-lien-tuc-va-gradient-descent",
        "bai-12-xac-suat-can-ban",
        "bai-13-bien-ngau-nhien-va-phan-phoi",
        "bai-14-bayes-va-uoc-luong-tham-so",
        "bai-15-ly-thuyet-thong-tin",
        "bai-16-thong-ke-cho-thi-nghiem-ai",
    ]),
    ("M03", "mon-03-hoc-may-co-giam-sat", "M03 — Học máy có giám sát", "M03", [
        "bai-01-bai-toan-hoc-may",
        "bai-02-hoi-quy-tuyen-tinh",
        "bai-03-gradient-descent-trong-thuc-te",
        "bai-04-bias-variance-va-tong-quat-hoa",
        "bai-05-chinh-quy-hoa",
        "bai-06-hoi-quy-logistic-va-cross-entropy",
        "bai-07-phan-loai-nhieu-lop-va-softmax",
        "bai-08-knn-va-hoc-dua-tren-mau",
        "bai-09-naive-bayes-va-goc-nhin-sinh",
        "bai-10-svm-va-kernel",
        "bai-11-cay-quyet-dinh-va-ensemble",
        "bai-12-danh-gia-mo-hinh-va-chi-so",
        "bai-13-hieu-chinh-xac-suat-va-bat-dinh",
        "bai-14-quy-trinh-du-an-hoc-may",
    ]),
    ("M04", "mon-04-khai-pha-du-lieu", "M04 — Khai phá dữ liệu & Kỹ nghệ dữ liệu", "M04", [
        "bai-01-vong-doi-du-lieu",
        "bai-02-thu-thap-va-lay-mau",
        "bai-03-kham-pha-du-lieu-eda",
        "bai-04-lam-sach-va-du-lieu-thieu",
        "bai-05-giam-chieu-trong-thuc-te",
        "bai-06-do-tuong-dong-va-loi-nguyen-so-chieu",
        "bai-07-phan-cum-kmeans-va-phan-cap",
        "bai-08-phan-cum-mat-do-va-danh-gia",
        "bai-09-luat-ket-hop",
        "bai-10-phat-hien-di-thuong",
        "bai-11-ky-thuat-dac-trung",
        "bai-12-pipeline-du-lieu",
        "bai-13-ro-ri-du-lieu",
        "bai-14-chat-luong-va-quan-tri-du-lieu",
    ]),
    ("M05", "mon-05-hoc-sau", "M05 — Học sâu & Mạng neuron", "M05", [
        "bai-01-tu-tuyen-tinh-den-phi-tuyen",
        "bai-02-perceptron-va-mlp",
        "bai-03-ham-kich-hoat",
        "bai-04-lan-truyen-nguoc",
        "bai-05-khoi-tao-trong-so",
        "bai-06-ham-mat-mat-va-tang-dau-ra",
        "bai-07-chuan-hoa-batchnorm-layernorm",
        "bai-08-chinh-quy-hoa-trong-hoc-sau",
        "bai-09-thuat-toan-toi-uu-hien-dai",
        "bai-10-lich-learning-rate-va-sieu-tham-so",
        "bai-11-mang-tich-chap-cnn",
        "bai-12-mang-hoi-quy-rnn-lstm-gru",
        "bai-13-mang-rat-sau-va-ket-noi-tat",
        "bai-14-gpu-va-do-chinh-xac-hon-hop",
        "bai-15-huan-luyen-phan-tan",
        "bai-16-double-descent-va-tong-quat-hoa",
        "bai-17-canh-quan-mat-mat-va-ntk",
        "bai-18-go-loi-mang-neuron",
    ]),
    ("M06", "mon-06-nlp", "M06 — Xử lý ngôn ngữ tự nhiên", "M06", [
        "bai-01-ngon-ngu-va-thach-thuc",
        "bai-02-tien-xu-ly-va-tach-tu",
        "bai-03-tokenization-hien-dai",
        "bai-04-mo-hinh-ngon-ngu-n-gram",
        "bai-05-bieu-dien-tu-tfidf-word2vec",
        "bai-06-khong-gian-ngu-nghia",
        "bai-07-seq2seq-va-attention",
        "bai-08-tu-attention-den-self-attention",
        "bai-09-kien-truc-transformer",
        "bai-10-ma-hoa-vi-tri-va-chi-tiet-thiet-ke",
        "bai-11-huan-luyen-truoc-bert-va-gpt",
        "bai-12-tinh-chinh-va-hoc-chuyen-giao",
        "bai-13-sinh-van-ban-va-giai-ma",
        "bai-14-danh-gia-trong-nlp",
        "bai-15-nlp-tieng-viet",
        "bai-16-da-ngu-va-dich-may",
    ]),
    ("M07", "mon-07-thi-giac-may-tinh", "M07 — Thị giác máy tính", "M07", [
        "bai-01-anh-so-va-bieu-dien",
        "bai-02-xu-ly-anh-co-ban",
        "bai-03-dac-trung-thu-cong-sift-hog",
        "bai-04-tich-chap-va-hinh-hoc-tensor",
        "bai-05-kien-truc-cnn-kinh-dien",
        "bai-06-tang-cuong-du-lieu",
        "bai-07-hoc-chuyen-giao-trong-thi-giac",
        "bai-08-phat-hien-doi-tuong",
        "bai-09-danh-gia-phat-hien-iou-map",
        "bai-10-phan-doan-anh",
        "bai-11-uoc-luong-tu-the-va-theo-vet",
        "bai-12-vision-transformer",
        "bai-13-hoc-tu-giam-sat-trong-thi-giac",
        "bai-14-mo-hinh-da-phuong-thuc-clip",
        "bai-15-thi-giac-3d-va-nerf",
        "bai-16-video-va-thi-giac-thoi-gian",
    ]),
    ("M08", "mon-08-hoc-tang-cuong", "M08 — Học tăng cường", "M08", [
        "bai-01-bai-toan-hoc-tang-cuong",
        "bai-02-bandit-va-kham-pha-khai-thac",
        "bai-03-qua-trinh-quyet-dinh-markov",
        "bai-04-quy-hoach-dong-va-bellman",
        "bai-05-monte-carlo-va-td",
        "bai-06-q-learning-va-sarsa",
        "bai-07-xap-xi-ham-va-dqn",
        "bai-08-policy-gradient",
        "bai-09-actor-critic-va-ppo",
        "bai-10-khong-gian-lien-tuc-va-off-policy",
        "bai-11-rl-dua-tren-mo-hinh",
        "bai-12-kham-pha-nang-cao-va-phan-thuong-thua",
        "bai-13-mcts-va-alphago",
        "bai-14-rlhf-va-hoc-tu-so-thich",
    ]),
    ("M09", "mon-09-mo-hinh-nen-tang", "M09 — Mô hình sinh & Mô hình nền tảng", "M09", [
        "bai-01-mo-hinh-sinh-la-gi",
        "bai-02-mo-hinh-tu-hoi-quy",
        "bai-03-gan",
        "bai-04-vae-va-elbo",
        "bai-05-mo-hinh-khuech-tan",
        "bai-06-sinh-co-dieu-kien-va-guidance",
        "bai-07-hoc-tuong-phan-va-bieu-dien",
        "bai-08-mo-hinh-nen-tang",
        "bai-09-kien-truc-llm-hien-dai",
        "bai-10-du-lieu-huan-luyen-llm",
        "bai-11-quy-luat-ty-le",
        "bai-12-attention-hieu-qua-va-ngu-canh-dai",
        "bai-13-co-che-suy-dien-va-ao-giac",
        "bai-14-huan-luyen-llm-quy-mo-lon",
        "bai-15-toi-uu-suy-dien-va-luong-tu-hoa",
        "bai-16-tinh-chinh-chi-dan-rlhf-dpo",
        "bai-17-danh-gia-mo-hinh-nen-tang",
        "bai-18-nang-luc-noi-troi-va-tranh-cai",
    ]),
    ("M10", "mon-10-bai-bao-kinh-dien", "M10 — Mổ xẻ bài báo kinh điển", "M10", [
        "bai-01-cach-doc-mot-bai-bao",
        "bai-02-tham-dinh-tuyen-bo-va-bang-chung",
        "bai-03-doc-phan-thi-nghiem-va-ablation",
        "bai-04-nen-mong-perceptron-den-backprop",
        "bai-05-thi-giac-lenet-den-resnet",
        "bai-06-chuoi-lstm-den-attention",
        "bai-07-transformer-doc-tung-phuong-trinh",
        "bai-08-ky-nguyen-huan-luyen-truoc",
        "bai-09-scaling-laws-va-tranh-luan",
        "bai-10-mo-hinh-sinh-gan-vae-diffusion",
        "bai-11-rl-dqn-alphago-ppo",
        "bai-12-alignment-instructgpt-dpo",
        "bai-13-bai-viet-quan-diem",
        "bai-14-tu-doc-den-tai-lap",
    ]),
    ("M11", "mon-11-he-chuyen-gia", "M11 — Hệ chuyên gia & Biểu diễn tri thức", "M11", [
        "bai-01-tri-thuc-va-bieu-dien",
        "bai-02-logic-menh-de-va-vi-tu",
        "bai-03-suy-dien-tu-dong",
        "bai-04-he-luat-suy-dien-tien-va-lui",
        "bai-05-he-chuyen-gia-co-dien",
        "bai-06-giai-thich-va-truy-vet",
        "bai-07-ontology-va-mo-hinh-hoa-mien",
        "bai-08-rdf-owl-va-web-ngu-nghia",
        "bai-09-do-thi-tri-thuc",
        "bai-10-nhung-do-thi-tri-thuc",
        "bai-11-suy-luan-duoi-bat-dinh",
        "bai-12-neuro-symbolic",
    ]),
    ("M12", "mon-12-ky-nghe-llm", "M12 — Kỹ nghệ LLM ứng dụng", "M12", [
        "bai-01-toan-canh-mo-hinh-hien-dai",
        "bai-02-nguyen-ly-nhin-tu-nguoi-dung",
        "bai-03-ky-thuat-prompt-nen-tang",
        "bai-04-prompt-nang-cao-va-chuoi-suy-luan",
        "bai-05-cua-so-ngu-canh-va-quan-ly",
        "bai-06-dau-ra-co-cau-truc",
        "bai-07-goi-cong-cu-tool-use",
        "bai-08-tac-tu-va-vong-lap",
        "bai-09-rag-nen-tang",
        "bai-10-rag-nang-cao",
        "bai-11-mcp-model-context-protocol",
        "bai-12-skill-workflow-va-to-chuc-nang-luc",
        "bai-13-he-da-tac-tu",
        "bai-14-danh-gia-he-thong-llm",
        "bai-15-llm-lam-giam-khao",
        "bai-16-toi-uu-chi-phi-va-do-tre",
        "bai-17-an-toan-ung-dung-va-prompt-injection",
        "bai-18-mau-thiet-ke-va-chong-loi",
    ]),
    ("M13", "mon-13-mlops", "M13 — MLOps & Hệ thống AI production", "M13", [
        "bai-01-vong-doi-he-thong-ai",
        "bai-02-quan-ly-thi-nghiem-va-phien-ban",
        "bai-03-quan-ly-du-lieu-va-feature-store",
        "bai-04-pipeline-huan-luyen-tai-lap",
        "bai-05-kiem-thu-he-thong-ml",
        "bai-06-dong-goi-va-trien-khai",
        "bai-07-phuc-vu-suy-dien-va-mo-rong",
        "bai-08-phuc-vu-llm-chuyen-sau",
        "bai-09-giam-sat-va-kha-nang-quan-sat",
        "bai-10-phat-hien-troi-du-lieu",
        "bai-11-troi-mo-hinh-va-danh-gia-truc-tuyen",
        "bai-12-chi-phi-va-hieu-qua-tai-nguyen",
        "bai-13-quan-tri-tuan-thu-va-kiem-toan",
        "bai-14-kien-truc-tham-chieu",
    ]),
    ("M14", "mon-14-an-toan-ai", "M14 — An toàn, Căn chỉnh & Đạo đức AI", "M14", [
        "bai-01-vi-sao-an-toan-ai",
        "bai-02-phan-loai-rui-ro",
        "bai-03-van-de-can-chinh",
        "bai-04-ao-giac-va-do-tin-cay",
        "bai-05-reward-hacking-va-goodhart",
        "bai-06-jailbreak-va-phong-thu",
        "bai-07-cong-bang-va-thien-lech",
        "bai-08-rieng-tu-va-bao-mat-du-lieu",
        "bai-09-giai-thich-va-dien-giai-co-che",
        "bai-10-danh-gia-an-toan-va-red-teaming",
        "bai-11-tac-dong-xa-hoi-va-kinh-te",
        "bai-12-quan-tri-luat-phap-va-tieu-chuan",
    ]),
    ("M15", "mon-15-phuong-phap-nghien-cuu", "M15 — Phương pháp nghiên cứu khoa học", "M15", [
        "bai-01-nghien-cuu-la-gi",
        "bai-02-tim-va-chon-de-tai",
        "bai-03-khao-sat-tai-lieu",
        "bai-04-thiet-ke-thi-nghiem",
        "bai-05-phan-tich-va-trinh-bay-ket-qua",
        "bai-06-viet-bai-bao-khoa-hoc",
        "bai-07-tai-lap-va-khoa-hoc-mo",
        "bai-08-phan-bien-va-xuat-ban",
        "bai-09-trinh-bay-va-poster",
        "bai-10-dao-duc-nghien-cuu-va-su-nghiep",
    ]),
]


def nhom_mon(ma, thu_muc, tieu_de, viet_tat, files):
    items = [L(thu_muc + "/README.md", tieu_de + " — đề cương", "intro")]
    items += [L("%s/bai-giang/%s.md" % (thu_muc, f)) for f in files]
    return {"title": tieu_de, "short": viet_tat, "items": items}


TREE = [
    {
        "id": "khoa-hoc",
        "title": "Đại khoá học Trí tuệ nhân tạo",
        "sub": "15 môn · 218 bài · 6 học kỳ",
        "icon": "compass",
        "groups": [
            {"title": "Chương trình", "short": "CT", "items": [
                L("README.md", "Giới thiệu đại khoá học", "intro"),
                L(CT + "/00-tong-quan-dai-khoa.md", None, "intro"),
                L(CT + "/01-ban-do-mon-hoc.md", None, "intro"),
                L(CT + "/02-lo-trinh-6-ky.md", None, "intro"),
                L(CT + "/03-kiem-tra-dau-vao.md", None, "intro"),
                L(CT + "/04-cach-hoc-va-danh-gia.md", None, "intro"),
                L(CT + "/05-moi-truong-cong-cu.md", None, "intro"),
                L(CT + "/06-nguyen-tac-bien-soan.md", None, "intro"),
            ]},
        ] + [nhom_mon(*m) for m in MON],
    },
    {
        "id": "do-an",
        "title": "Tám đồ án bắt buộc",
        "sub": "Kiến thức dính lại thành năng lực",
        "icon": "layers",
        "groups": [
            {"title": "Đồ án", "short": "Đồ án", "items": [
                L(DA + "/README.md", "Tổng quan đồ án", "intro"),
                L(DA + "/d1-phan-loai-tu-dau.md", None, "project"),
                L(DA + "/d2-tu-du-lieu-ban-toi-bo-du-lieu.md", None, "project"),
                L(DA + "/d3-cai-lai-kien-truc-tu-bai-bao.md", None, "project"),
                L(DA + "/d4-tac-tu-rl.md", None, "project"),
                L(DA + "/d5-tinh-chinh-llm.md", None, "project"),
                L(DA + "/d6-do-thi-tri-thuc-va-llm.md", None, "project"),
                L(DA + "/d7-he-thong-ai-production.md", None, "project"),
                L(DA + "/d8-capstone-nghien-cuu.md", None, "project"),
            ]},
        ],
    },
    {
        "id": "tai-lieu",
        "title": "Tài liệu & đề thi",
        "sub": "Mở khi đang làm bài",
        "icon": "book",
        "groups": [
            {"title": "Tra cứu nhanh", "short": "Tra cứu", "items": [
                L(TL + "/README.md", "Mục lục tài liệu", "ref"),
                L(TL + "/tu-dien-thuat-ngu.md", "Từ điển thuật ngữ Việt–Anh", "ref"),
                L(TL + "/cong-thuc-can-nho.md", "Công thức cần nhớ", "ref"),
                L(TL + "/so-lieu-can-nho.md", "Số liệu cần nhớ", "ref"),
                L(TL + "/danh-sach-t3.md", "40 khái niệm phải đạt T3", "ref"),
                L(TL + "/thu-vien-bai-bao.md", "Thư viện 42 bài báo", "ref"),
                L(TL + "/checklist-du-an-ai.md", "Checklist dự án AI", "ref"),
                L(TL + "/mau-nhat-ky.md", "Mẫu nhật ký học", "ref"),
                L(TL + "/mau-tom-tat-bai-bao.md", "Mẫu tóm tắt phê bình", "ref"),
                L(TL + "/mau-tien-dang-ky.md", "Mẫu tiền đăng ký thí nghiệm", "ref"),
                L(TL + "/mau-the-ghi-nho.md", "Mẫu thẻ ghi nhớ", "ref"),
            ]},
            {"title": "Đề thi", "short": "Đề thi", "items":
                [L(DT + "/README.md", "Hướng dẫn đề thi", "ref")] +
                [L("%s/%s-%s.md" % (DT, m[0].lower(), k), None, "exam")
                 for m in MON for k in ("giua-ky", "cuoi-ky")]
            },
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
    """Doc sieu du lieu tu khoi trich dan o dau bai."""
    meta = {}
    head = "\n".join(md.split("\n")[:9])
    m = re.search(r"\bM(\d{2})\b", head)
    if m:
        meta["mon"] = int(m.group(1))
    m = re.search(r"Bài\s+(\d+)\s*/\s*(\d+)", head)
    if m:
        meta["no"] = int(m.group(1))
        meta["of"] = int(m.group(2))
    m = re.search(r"Thời lượng[^:]*:\s*([^·\n*]+)", head)
    if m:
        meta["hours"] = m.group(1).strip().rstrip("·").strip()
    m = re.search(r"Độ khó:\s*([★☆⭐]+)", head)
    if m:
        s = m.group(1)
        meta["level"] = s.count("★") + s.count("⭐")
    m = re.search(r"\*\*Trục:\*\*\s*([A-D])", head)
    if m:
        meta["truc"] = m.group(1)
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
        if parent == "ai-everything-course" or rel == "README.md":
            base = "gioi-thieu"
        elif parent == "bai-giang":
            base = os.path.basename(os.path.dirname(os.path.dirname(rel)))
        else:
            base = parent
    elif parent == "bai-giang":
        # bai-01-... cua M05 -> m05-bai-01-...
        mon = os.path.basename(os.path.dirname(os.path.dirname(rel)))
        m = re.match(r"mon-(\d+)", mon)
        if m:
            base = "m%s-%s" % (m.group(1), base)
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

    nav = []
    for section in TREE:
        groups = []
        for group in section["groups"]:
            ids = [i["path"] for i in group["items"] if i["path"] in docs]
            if ids:
                groups.append({"title": group["title"], "short": group["short"], "items": ids})
        nav.append({"id": section["id"], "title": section["title"],
                    "sub": section["sub"], "icon": section["icon"], "groups": groups})

    tong_bai = sum(len(m[4]) for m in MON)
    payload = {
        "nav": nav, "slugs": slugs, "order": order, "docs": docs,
        "stats": {
            "files": len(docs),
            "words": sum(d["words"] for d in docs.values()),
            "minutes": sum(d["minutes"] for d in docs.values()),
            "lessons": sum(1 for d in docs.values() if d["kind"] == "lesson"),
            "lessonsPlanned": tong_bai,
            "subjects": len(MON),
        },
    }

    n_js, n_json = xuat.ghi(payload, os.path.dirname(OUT))

    s = payload["stats"]
    print("da ghi assets/content.js + assets/content.json")
    print("  %d tai lieu · %d/%d bai giang · %d tu · ~%d gio doc · %.2f MB + %.2f MB"
          % (s["files"], s["lessons"], s["lessonsPlanned"], s["words"],
             round(s["minutes"] / 60), n_js / 1048576.0, n_json / 1048576.0))
    if missing:
        print("  %d file chua soan (trang van chay, se tu hien khi co file):"
              % len(missing), file=sys.stderr)
        for m in missing[:5]:
            print("    " + m, file=sys.stderr)
        if len(missing) > 5:
            print("    ... va %d file nua" % (len(missing) - 5), file=sys.stderr)


if __name__ == "__main__":
    main()
