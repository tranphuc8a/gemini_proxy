/* ==========================================================================
   Học Heuristic — cấu hình riêng của khoá.
   Nạp SAU content.js và TRƯỚC app.js. Engine dùng chung đọc window.CAU_HINH.
   ========================================================================== */
window.CAU_HINH = {

  tenNgan: "Học Heuristic",
  tieuDe:  "Học Heuristic — Từ cơ bản đến chuyên sâu",
  khoaLuu: "hh",                       /* giữ nguyên "hh" — khoá này đã có người
                                          học và tiến độ cũ nằm dưới tiền tố đó */

  heroTieuDe: "Học <u>heuristic</u> từ kiến thức giải thuật cơ bản",
  heroMoTa:
    "23 bài giảng tiếng Việt dẫn bạn từ “viết đúng” sang “viết tốt”: mô hình hoá, " +
    "đo lường tử tế, greedy có chỉ số, metaheuristic — rồi áp dụng vào <b>hai đề thi thật</b> " +
    "đã được giải và đo đạc đầy đủ.",
  heroNut: [
    { href: "#/khoa-hoc/00-de-cuong", text: "Xem đề cương" },
    { href: "#/2605/tong-quan",       text: "Ca nghiên cứu", icon: "layers" }
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
  boTienTo: /^Phần \d+ — /,
  soThe: function (i, icon) {
    return i === 0 ? icon("compass") : i === 7 ? icon("note") : String(i);
  },

  /* Ở khoá này các ca nghiên cứu nằm từ nav[2] trở đi, còn tra cứu ở nav[1]. */
  doAnLat:    [2, 99],
  doAnTieuDe: "Ca nghiên cứu đề thi thật",
  doAnPhu:    "áp dụng toàn bộ khoá học",
  doAnMoTa:   "nghiên cứu đầy đủ: phát biểu đề, khảo sát giải pháp, thiết kế cải tiến, " +
              "cài đặt C++ và các thí nghiệm <b>thất bại</b> kèm nguyên nhân.",

  traCuuChiSo:  1,
  traCuuTieuDe: "Tài liệu tra cứu",
  traCuuPhu:    "mở khi đang làm bài",

  goiYTimKiem: [
    "khoa-hoc/bai-05-greedy",
    "khoa-hoc/bai-18-can-tren-can-duoi",
    "tai-lieu/cheatsheet",
    "2605/06-lien-he-khoa-hoc"
  ],

  moTaNhom: {
    "Bắt đầu":  "Khoá học dành cho ai, học thế nào, bản đồ kiến thức và bài kiểm tra đầu vào.",
    "Phần 1":   "Mô hình hoá bài toán, vì sao không giải chính xác được, biểu diễn nghiệm và — quan trọng nhất — cách đo lường tử tế.",
    "Phần 2":   "Sinh ra nghiệm đầu tiên: greedy và nghệ thuật chọn chỉ số, giá mờ, chèn/gom cụm, ngẫu nhiên hoá GRASP.",
    "Phần 3":   "Cải thiện nghiệm có sẵn: lân cận, leo đồi, đánh giá tăng dần, bộ toán tử kinh điển và cách thoát cực trị cục bộ.",
    "Phần 4":   "Năm khung metaheuristic: Simulated Annealing, Tabu, ILS & VNS, Beam Search, LNS & ALNS.",
    "Phần 5":   "Kỹ năng phòng thi: dựng cận trên/dưới, kỹ thuật C++ khi bị cấm thư viện, quy trình 8 bước tấn công đề mới.",
    "Phần 6":   "Mổ xẻ một đề thi thật, xây solver qua bảy phiên bản có đo đạc, và tự đánh giá năng lực.",
    "Bài tập":  "Bộ bài tập kèm đáp án chi tiết và lab mã nguồn chạy được."
  }
};
