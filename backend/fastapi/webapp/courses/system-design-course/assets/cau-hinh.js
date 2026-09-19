/* ==========================================================================
   Học System Design — cấu hình riêng của khoá.
   Nạp SAU content.js và TRƯỚC app.js. Engine dùng chung đọc window.CAU_HINH.
   ========================================================================== */
window.CAU_HINH = {

  tenNgan: "Học System Design",
  tieuDe:  "Học System Design — Từ số 0 đến kiến trúc production",
  khoaLuu: "sd",

  heroTieuDe: "Học <u>System Design</u> từ số 0 đến kiến trúc production",
  heroMoTa:
    "58 bài giảng tiếng Việt dẫn bạn từ “viết đúng” sang “thiết kế được”: ước lượng năng lực, " +
    "dữ liệu và nhất quán, hệ phân tán, vận hành production — kèm <b>6 đồ án bắt buộc</b> " +
    "phải xây, phá và đo thật.",
  heroNut: [
    { href: "#/bai/00-de-cuong", text: "Xem đề cương" },
    { href: "#/do-an/do-an",     text: "Sáu đồ án", icon: "layers" }
  ],

  kpi: function (s) {
    return [
      [s.files, "tài liệu"],
      [s.lessons, "bài giảng"],
      ["~" + Math.round(s.minutes / 60), "giờ đọc"],
      [(s.words / 1000).toFixed(0) + "k", "từ nội dung"]
    ];
  },

  loTrinhTieuDe: "Lộ trình khoá học",
  boTienTo: /^Giai đoạn \d+ — /,
  soThe: function (i, icon) {
    return i === 0 ? icon("compass") : String(i - 1);
  },

  doAnLat:    [1, 2],
  doAnTieuDe: "Sáu đồ án bắt buộc",
  doAnPhu:    "khoá học hoàn thành bằng việc XÂY",
  doAnMoTa:   "mỗi đồ án phải có: tài liệu thiết kế 11 mục, hệ thống chạy được, " +
              "benchmark tìm nút thắt, <b>fault injection</b>, ADR và tự chấm.",

  traCuuChiSo:  2,
  traCuuTieuDe: "Tài liệu tra cứu",
  traCuuPhu:    "mở khi đang làm bài",

  goiYTimKiem: [
    "bai/bai-02-do-tre-thong-luong-capacity",
    "bai/bai-10-caching-can-ban",
    "tai-lieu/so-lieu-can-nho",
    "bai/bai-26-mo-hinh-nhat-quan"
  ],

  moTaNhom: {
    "Bắt đầu": "Khoá học dành cho ai, học thế nào, bản đồ kiến thức, bài kiểm tra đầu vào và lịch 24 tuần.",
    "GĐ 0":    "Nền tảng: số liệu để ước lượng, máy tính & hệ điều hành, mạng, và cấu trúc dữ liệu xác suất.",
    "GĐ 1":    "Khối xây dựng: API & idempotency, phân rã service, gateway, cân bằng tải, cache, hàng đợi, CDN, realtime, ADR.",
    "GĐ 2":    "Dữ liệu & mở rộng: database bên trong, transaction, replication, sharding, event-driven, nhất quán, CAP.",
    "GĐ 3":    "Hệ phân tán: mô hình hỏng, đồng hồ & nhân quả, Raft, linearizability, giao dịch phân tán, Spanner, kiểm thử.",
    "GĐ 4":    "Vận hành production: SLO & error budget, resilience, observability, tail latency, DR, bảo mật, chi phí, review.",
    "GĐ 5":    "Chuyên sâu: di trú không downtime, LSM & CRDT, đa vùng, hệ địa lý, hệ ML/AI, formal methods, capstone.",
    "Đồ án":   "Sáu đồ án bắt buộc từ URL shortener tới hệ thống toàn cầu — nơi kiến thức rời rạc dính lại thành năng lực.",
    "Tra cứu": "Số liệu cần nhớ, cheatsheet, checklist thiết kế, khung đánh giá, mẫu ADR và thứ tự đọc tài liệu."
  }
};
