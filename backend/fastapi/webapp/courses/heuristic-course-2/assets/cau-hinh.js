/* ==========================================================================
   Học Heuristic — cấu hình riêng của khoá.
   Nạp SAU content.js và TRƯỚC app.js. Engine dùng chung đọc window.CAU_HINH.
   ========================================================================== */
window.CAU_HINH = {

  tenNgan: "Học Heuristic",
  tieuDe:  "Học Heuristic — Từ cơ bản đến chuyên sâu",
  khoaLuu: "hh",                       /* giữ nguyên "hh" — khoá này đã có người
                                          học và tiến độ cũ nằm dưới tiền tố đó */
  khoaHoc: "heuristic-2",            /* slug của khoá trong database — engine gọi /courses/heuristic-2/… */

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

  /* Học song song: nút "Thực hành" / "Mô phỏng" ở đầu mỗi bài + ở trang chủ (engine/mo-lien-ket.js).
     Ánh xạ bài giảng → bài thực hành cùng tên ở ../heuristic-practice-2 (data/khoa.js của trang đó là nguồn thật). */
  moDun: ["pwa", "ai-khach", "mo-offline", "mo-on-tap", "mo-ai", "mo-so-tay", "mo-ban-do", "mo-doc", "mo-thanh-tich", "mo-lien-ket"],
  lienKet: (function () {
    var TH = "../heuristic-practice-2/", VIS = "../heuristic-visual-2/#/";
    var DEMO = {
    "khoa-hoc/bai-02-vi-sao-kho": [["bung-no-to-hop", "Bùng nổ tổ hợp"]],
    "khoa-hoc/bai-03-bieu-dien-nghiem": [["bieu-dien-nghiem", "Biểu diễn nghiệm"]],
    "khoa-hoc/bai-04-do-luong": [["do-luong-ablation", "Bao nhiêu test là đủ?"]],
    "khoa-hoc/bai-04b-phan-bo-cong-suc": [["phan-bo-cong-suc", "Phân bổ công sức"]],
    "khoa-hoc/bai-05-greedy": [["greedy-chi-so", "Greedy — bốn họ chỉ số"]],
    "khoa-hoc/bai-06-gia-mo": [["gia-mo-lambda", "Giá mờ λ"]],
    "khoa-hoc/bai-07-chen-gom-cum": [["chen-va-tiet-kiem", "Chèn · tiếc nuối · tiết kiệm"]],
    "khoa-hoc/bai-08-grasp": [["grasp-rcl", "GRASP — RCL"]],
    "khoa-hoc/bai-09-lan-can-leo-doi": [["leo-doi", "Leo đồi"]],
    "khoa-hoc/bai-10-delta-evaluation": [["delta-evaluation", "Đánh giá delta"]],
    "khoa-hoc/bai-11-toan-tu-kinh-dien": [["toan-tu-2opt", "Các toán tử 2-opt…"]],
    "khoa-hoc/bai-12-cuc-tri-cuc-bo": [["dia-hinh-toi-uu", "Địa hình tối ưu"]],
    "khoa-hoc/bai-13-simulated-annealing": [["simulated-annealing", "Simulated annealing"]],
    "khoa-hoc/bai-14-tabu-search": [["tabu-search", "Tabu search"]],
    "khoa-hoc/bai-16-beam-search": [["beam-search", "Beam search"]],
    "khoa-hoc/bai-17-lns-alns": [["lns-alns", "LNS & ALNS"]],
    "khoa-hoc/bai-17b-bay-dan-tien-hoa": [["dan-kien", "Đàn kiến"], ["di-truyen", "Giải thuật di truyền"], ["tien-hoa-vi-phan", "Tiến hoá vi phân"], ["bay-dan-pso", "Bầy hạt PSO"], ["dua-thuat-toan", "Đua bốn thuật toán"]],
    "khoa-hoc/bai-18-can-tren-can-duoi": [["can-tren-can-duoi", "Cận trên, cận dưới"]],
    "khoa-hoc/bai-18b-cau-truc-ham-muc-tieu": [["cau-truc-bien-duyen", "Biên duyên"]],
    "khoa-hoc/bai-19b-go-loi-heuristic": [["trieu-chung-go-loi", "Bốn triệu chứng gỡ lỗi"]],
    "khoa-hoc/bai-20b-tinh-chinh-tham-so": [["qua-khop-seed", "Quá khớp seed"]]
    };
    return [
      {
        ten: "Thực hành", trangChu: TH,
        url: function (slug) {
          var m = /^khoa-hoc\/(bai-\d+b?-[a-z0-9-]+)$/.exec(slug);
          if (m) return TH + "#/bai/" + m[1];
          if (slug === "khoa-hoc/01-kiem-tra-dau-vao") return TH + "#/bai/kiem-tra-dau-vao";
          if (slug === "khoa-hoc/02-cach-hoc") return { href: TH + "#/ide", ten: "Không muốn cài đặt? Dùng IDE C/C++ online" };
          m = /^(2605|2607)\//.exec(slug);
          if (m) return TH + "#/bai/ca-" + m[1];
          if (/^case-2609\//.test(slug)) return TH + "#/bai/ca-2609";
          if (slug === "khoa-hoc/lab-p3-aircon") return TH + "#/bai/bai-21-mo-xe-de-thi";
          if (slug === "khoa-hoc/bai-tap" || slug === "khoa-hoc/dap-an") return TH;
          return null;
        }
      },
      {
        ten: "Mô phỏng",
        url: function (slug) {
          var ds = DEMO[slug];
          return ds ? ds.map(function (d) { return { href: VIS + d[0], ten: "Mô phỏng: " + d[1] }; }) : null;
        }
      }
    ];
  })(),

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
