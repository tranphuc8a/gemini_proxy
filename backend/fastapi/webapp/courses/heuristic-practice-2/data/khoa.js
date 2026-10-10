/* Mục lục các bài thực hành, sinh từ bundle heuristic-2 rồi chỉnh tay.
   giang = slug bài giảng trong khoá `heuristic-2`; demo = id mô phỏng ở heuristic-visual-2. */
(function (root) {
  "use strict";
  var TH = root.TH || (root.TH = {});
  TH.khoa = {
  "phan": [
    {
      "id": "bat-dau",
      "ten": "Bắt đầu",
      "mota": "Đo trình độ đầu vào trước khi vào bài.",
      "bai": [
        "kiem-tra-dau-vao"
      ]
    },
    {
      "id": "p1",
      "ten": "Phần 1 — Tư duy tối ưu",
      "mota": "Mô hình hoá, vì sao khó, biểu diễn nghiệm, đo lường.",
      "bai": [
        "bai-01-mo-hinh-hoa",
        "bai-02-vi-sao-kho",
        "bai-03-bieu-dien-nghiem",
        "bai-04-do-luong",
        "bai-04b-phan-bo-cong-suc"
      ]
    },
    {
      "id": "p2",
      "ten": "Phần 2 — Xây dựng nghiệm",
      "mota": "Greedy, giá mờ, chèn/gom cụm, GRASP.",
      "bai": [
        "bai-05-greedy",
        "bai-06-gia-mo",
        "bai-07-chen-gom-cum",
        "bai-08-grasp"
      ]
    },
    {
      "id": "p3",
      "ten": "Phần 3 — Cải thiện nghiệm",
      "mota": "Lân cận, leo đồi, delta evaluation, toán tử, cực trị cục bộ.",
      "bai": [
        "bai-09-lan-can-leo-doi",
        "bai-10-delta-evaluation",
        "bai-11-toan-tu-kinh-dien",
        "bai-12-cuc-tri-cuc-bo"
      ]
    },
    {
      "id": "p4",
      "ten": "Phần 4 — Metaheuristic",
      "mota": "SA, Tabu, ILS/VNS, Beam, LNS/ALNS, bầy đàn.",
      "bai": [
        "bai-13-simulated-annealing",
        "bai-14-tabu-search",
        "bai-15-ils-vns",
        "bai-16-beam-search",
        "bai-17-lns-alns",
        "bai-17b-bay-dan-tien-hoa"
      ]
    },
    {
      "id": "p5",
      "ten": "Phần 5 — Kỹ năng thực chiến",
      "mota": "Cận trên/dưới, C++ thi đấu, gỡ lỗi, quy trình 8 bước, tinh chỉnh tham số.",
      "bai": [
        "bai-18-can-tren-can-duoi",
        "bai-18b-cau-truc-ham-muc-tieu",
        "bai-19-ky-thuat-cpp",
        "bai-19b-go-loi-heuristic",
        "bai-20-quy-trinh-8-buoc",
        "bai-20b-tinh-chinh-tham-so"
      ]
    },
    {
      "id": "p6",
      "ten": "Phần 6 — Capstone",
      "mota": "Mổ xẻ đề thật, bảy phiên bản solver, tự đánh giá.",
      "bai": [
        "bai-21-mo-xe-de-thi",
        "bai-22-bay-phien-ban",
        "bai-23-tu-danh-gia"
      ]
    },
    {
      "id": "ca",
      "ten": "Ca nghiên cứu đề thi thật",
      "mota": "Đọc hiểu và vận dụng: ba đề đã được giải và đo đạc đầy đủ.",
      "bai": [
        "ca-2605",
        "ca-2607",
        "ca-2609"
      ]
    }
  ],
  "bai": {
    "kiem-tra-dau-vao": {
      "so": "",
      "ten": "Bài kiểm tra đầu vào",
      "tag": "",
      "phut": 10,
      "giang": "khoa-hoc/01-kiem-tra-dau-vao",
      "demo": [],
      "loai": "dau-vao"
    },
    "bai-01-mo-hinh-hoa": {
      "so": "1",
      "ten": "Từ \"đúng\" sang \"tốt\": mô hình hoá bài toán tối ưu",
      "tag": "",
      "phut": 49,
      "giang": "khoa-hoc/bai-01-mo-hinh-hoa",
      "demo": [],
      "loai": "bai"
    },
    "bai-02-vi-sao-kho": {
      "so": "2",
      "ten": "Vì sao không giải chính xác được: bùng nổ tổ hợp & NP-hard",
      "tag": "",
      "phut": 36,
      "giang": "khoa-hoc/bai-02-vi-sao-kho",
      "demo": [
        "bung-no-to-hop"
      ],
      "loai": "bai"
    },
    "bai-03-bieu-dien-nghiem": {
      "so": "3",
      "ten": "Biểu diễn nghiệm: quyết định quan trọng nhất",
      "tag": "",
      "phut": 37,
      "giang": "khoa-hoc/bai-03-bieu-dien-nghiem",
      "demo": [
        "bieu-dien-nghiem"
      ],
      "loai": "bai"
    },
    "bai-04-do-luong": {
      "so": "4",
      "ten": "Đo lường: dựng bộ chấm và làm thực nghiệm tử tế",
      "tag": "★ trọng tâm",
      "phut": 36,
      "giang": "khoa-hoc/bai-04-do-luong",
      "demo": [
        "do-luong-ablation"
      ],
      "loai": "bai"
    },
    "bai-04b-phan-bo-cong-suc": {
      "so": "04B",
      "ten": "Phân bổ công sức: tiền nằm ở đâu trong một đề heuristic",
      "tag": "mở rộng",
      "phut": 19,
      "giang": "khoa-hoc/bai-04b-phan-bo-cong-suc",
      "demo": [
        "phan-bo-cong-suc"
      ],
      "loai": "bai"
    },
    "bai-05-greedy": {
      "so": "5",
      "ten": "Greedy và nghệ thuật chọn chỉ số",
      "tag": "★ trọng tâm",
      "phut": 34,
      "giang": "khoa-hoc/bai-05-greedy",
      "demo": [
        "greedy-chi-so"
      ],
      "loai": "bai"
    },
    "bai-06-gia-mo": {
      "so": "6",
      "ten": "Giá mờ (shadow price): định giá một phút, một đồng, một mét",
      "tag": "★ trọng tâm",
      "phut": 33,
      "giang": "khoa-hoc/bai-06-gia-mo",
      "demo": [
        "gia-mo-lambda"
      ],
      "loai": "bai"
    },
    "bai-07-chen-gom-cum": {
      "so": "7",
      "ten": "Chèn, tiết kiệm, gom cụm: ba họ heuristic xây dựng",
      "tag": "",
      "phut": 31,
      "giang": "khoa-hoc/bai-07-chen-gom-cum",
      "demo": [
        "chen-va-tiet-kiem"
      ],
      "loai": "bai"
    },
    "bai-08-grasp": {
      "so": "8",
      "ten": "Ngẫu nhiên hoá & đa khởi động (GRASP)",
      "tag": "",
      "phut": 24,
      "giang": "khoa-hoc/bai-08-grasp",
      "demo": [
        "grasp-rcl"
      ],
      "loai": "bai"
    },
    "bai-09-lan-can-leo-doi": {
      "so": "9",
      "ten": "Lân cận & leo đồi",
      "tag": "",
      "phut": 40,
      "giang": "khoa-hoc/bai-09-lan-can-leo-doi",
      "demo": [
        "leo-doi"
      ],
      "loai": "bai"
    },
    "bai-10-delta-evaluation": {
      "so": "10",
      "ten": "Đánh giá tăng dần: bí quyết tăng tốc 1000 lần",
      "tag": "★ trọng tâm",
      "phut": 27,
      "giang": "khoa-hoc/bai-10-delta-evaluation",
      "demo": [
        "delta-evaluation"
      ],
      "loai": "bai"
    },
    "bai-11-toan-tu-kinh-dien": {
      "so": "11",
      "ten": "Bộ toán tử kinh điển: 2-opt, Or-opt, swap, relocate",
      "tag": "",
      "phut": 24,
      "giang": "khoa-hoc/bai-11-toan-tu-kinh-dien",
      "demo": [
        "toan-tu-2opt"
      ],
      "loai": "bai"
    },
    "bai-12-cuc-tri-cuc-bo": {
      "so": "12",
      "ten": "Cực trị cục bộ: chẩn đoán và thoát ra",
      "tag": "★ trọng tâm",
      "phut": 23,
      "giang": "khoa-hoc/bai-12-cuc-tri-cuc-bo",
      "demo": [
        "dia-hinh-toi-uu"
      ],
      "loai": "bai"
    },
    "bai-13-simulated-annealing": {
      "so": "13",
      "ten": "Simulated Annealing",
      "tag": "",
      "phut": 28,
      "giang": "khoa-hoc/bai-13-simulated-annealing",
      "demo": [
        "simulated-annealing"
      ],
      "loai": "bai"
    },
    "bai-14-tabu-search": {
      "so": "14",
      "ten": "Tabu Search",
      "tag": "",
      "phut": 24,
      "giang": "khoa-hoc/bai-14-tabu-search",
      "demo": [
        "tabu-search"
      ],
      "loai": "bai"
    },
    "bai-15-ils-vns": {
      "so": "15",
      "ten": "ILS & VNS: hai khung đơn giản mà mạnh",
      "tag": "",
      "phut": 24,
      "giang": "khoa-hoc/bai-15-ils-vns",
      "demo": [],
      "loai": "bai"
    },
    "bai-16-beam-search": {
      "so": "16",
      "ten": "Beam Search: tìm kiếm trên cây có kiểm soát",
      "tag": "",
      "phut": 30,
      "giang": "khoa-hoc/bai-16-beam-search",
      "demo": [
        "beam-search"
      ],
      "loai": "bai"
    },
    "bai-17-lns-alns": {
      "so": "17",
      "ten": "LNS & ALNS: phá và xây lại",
      "tag": "",
      "phut": 29,
      "giang": "khoa-hoc/bai-17-lns-alns",
      "demo": [
        "lns-alns"
      ],
      "loai": "bai"
    },
    "bai-17b-bay-dan-tien-hoa": {
      "so": "17B",
      "ten": "Bầy đàn & tiến hoá: đàn kiến, di truyền, DE, PSO",
      "tag": "mở rộng",
      "phut": 39,
      "giang": "khoa-hoc/bai-17b-bay-dan-tien-hoa",
      "demo": [
        "dan-kien",
        "di-truyen",
        "tien-hoa-vi-phan",
        "bay-dan-pso",
        "dua-thuat-toan"
      ],
      "loai": "bai"
    },
    "bai-18-can-tren-can-duoi": {
      "so": "18",
      "ten": "Cận trên & cận dưới: biết mình còn cách tối ưu bao xa",
      "tag": "★ trọng tâm",
      "phut": 24,
      "giang": "khoa-hoc/bai-18-can-tren-can-duoi",
      "demo": [
        "can-tren-can-duoi"
      ],
      "loai": "bai"
    },
    "bai-18b-cau-truc-ham-muc-tieu": {
      "so": "18B",
      "ten": "Đọc cấu trúc hàm mục tiêu: khi heuristic là câu trả lời sai",
      "tag": "mở rộng",
      "phut": 33,
      "giang": "khoa-hoc/bai-18b-cau-truc-ham-muc-tieu",
      "demo": [
        "cau-truc-bien-duyen"
      ],
      "loai": "bai"
    },
    "bai-19-ky-thuat-cpp": {
      "so": "19",
      "ten": "Kỹ thuật C++ cho bài heuristic",
      "tag": "",
      "phut": 30,
      "giang": "khoa-hoc/bai-19-ky-thuat-cpp",
      "demo": [],
      "loai": "bai"
    },
    "bai-19b-go-loi-heuristic": {
      "so": "19B",
      "ten": "Gỡ lỗi lời giải heuristic: khi chương trình chạy nhưng điểm sai",
      "tag": "mở rộng",
      "phut": 21,
      "giang": "khoa-hoc/bai-19b-go-loi-heuristic",
      "demo": [
        "trieu-chung-go-loi"
      ],
      "loai": "bai"
    },
    "bai-20-quy-trinh-8-buoc": {
      "so": "20",
      "ten": "Quy trình 8 bước tấn công một đề mới",
      "tag": "★ trọng tâm",
      "phut": 26,
      "giang": "khoa-hoc/bai-20-quy-trinh-8-buoc",
      "demo": [],
      "loai": "bai"
    },
    "bai-20b-tinh-chinh-tham-so": {
      "so": "20B",
      "ten": "Tinh chỉnh tham số mà không tự lừa mình",
      "tag": "mở rộng",
      "phut": 22,
      "giang": "khoa-hoc/bai-20b-tinh-chinh-tham-so",
      "demo": [
        "qua-khop-seed"
      ],
      "loai": "bai"
    },
    "bai-21-mo-xe-de-thi": {
      "so": "21",
      "ten": "Mổ xẻ đề thi thật",
      "tag": "",
      "phut": 25,
      "giang": "khoa-hoc/bai-21-mo-xe-de-thi",
      "demo": [],
      "loai": "bai"
    },
    "bai-22-bay-phien-ban": {
      "so": "22",
      "ten": "Xây solver qua 7 phiên bản",
      "tag": "",
      "phut": 28,
      "giang": "khoa-hoc/bai-22-bay-phien-ban",
      "demo": [],
      "loai": "bai"
    },
    "bai-23-tu-danh-gia": {
      "so": "23",
      "ten": "Tự đánh giá & con đường đi tiếp",
      "tag": "",
      "phut": 25,
      "giang": "khoa-hoc/bai-23-tu-danh-gia",
      "demo": [],
      "loai": "bai"
    },
    "ca-2605": {
      "so": "",
      "ten": "Bài 2605 — Xếp bộ nhớ tensor",
      "tag": "ca nghiên cứu",
      "phut": 140,
      "giang": "2605/tong-quan",
      "demo": [],
      "loai": "ca"
    },
    "ca-2607": {
      "so": "",
      "ten": "Bài 2607 — Định tuyến chọn lọc",
      "tag": "ca nghiên cứu",
      "phut": 86,
      "giang": "2607/tong-quan",
      "demo": [],
      "loai": "ca"
    },
    "ca-2609": {
      "so": "",
      "ten": "Bài 2609 — Entropy của vũ trụ",
      "tag": "ca nghiên cứu",
      "phut": 45,
      "giang": "case-2609/tong-quan",
      "demo": [],
      "loai": "ca"
    }
  }
};
  if (typeof module !== "undefined" && module.exports) module.exports = TH.khoa;
})(typeof globalThis !== "undefined" ? globalThis : this);
