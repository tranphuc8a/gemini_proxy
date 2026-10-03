/* ==========================================================================
   Web Lab trực quan — cấu hình riêng của trang này.
   Nạp TRƯỚC vis-core.js. Engine dùng chung đọc window.CAU_HINH_VIS.
   ========================================================================== */
window.CAU_HINH_VIS = {
  tieuDe:  "Web Lab trực quan",
  khoaLuu: "vis-lab-theme",

  heroTieuDe: "Web <u>Lab</u> trực quan",
  heroMoTa:
    "Phòng thí nghiệm cho những thứ <b>không hình dung nổi bằng chữ</b>: thuật toán, " +
    "hệ động lực, quy trình. Mỗi lab chạy <b>thuật toán thật</b> ngay trong trình duyệt — " +
    "chỉnh được tham số, tua được như xem video, xuất được ảnh và video.",
  heroGhiChu:
    "💡 <b>Cách dùng đúng:</b> trước khi kéo một thanh trượt, hãy <b>dự đoán</b> điều sẽ xảy ra. " +
    "Mỗi lần dự đoán sai là một lần mô hình tư duy của bạn được sửa.",

  /* Thang màu chuyển (bản đồ nhiệt, hoa văn). Khớp với bảng màu ở chu-de.css. */
  thangMau: [[0.00, [236, 254, 255]],
             [0.35, [103, 232, 249]],
             [0.65, [  8, 145, 178]],
             [1.00, [  8,  51,  68]]],

  nhomThuTu: ["Giả thuyết Collatz", "Hệ động lực & hỗn loạn",
              "Tự động tế bào", "Bầy đàn & tác tử",
              "Toán & số học", "Xác suất & ngẫu nhiên",
              "Mạng lưới & phân tán",
              "Xã hội & trò chơi", "Tối ưu hoá & heuristic",
              "Học máy & dữ liệu",
              "Câu đố quyết định"],

  chanTrang: 'Web Lab trực quan · <a href="../../">về trang chủ</a> · ' +
             'không dùng thư viện ngoài · chạy được offline',

  /* Bật/tắt tính năng engine. Bỏ hẳn khoá nào = bật (mặc định). */
  tinhNang: {
    permalink:    true,   // ghi tham số vào URL để chia sẻ đúng trạng thái
    xuat:         true,   // nút lưu PNG / ghi video WebM
    toanManHinh:  true,
    tapTrung:     true,
    phimTat:      true
  },

  fpsGhi: 30,
  bitrateGhi: 8000000,

  /* "🎓 Học lý thuyết" trên đầu mỗi lab: bài giảng giải thích đúng hiện tượng đó.
     Chiều ngược lại — lab chạy ngay trong bài — là khối ```lab <id>``` trong markdown
     của bài (engine/hien-thi.js). */
  baiHoc: {
    "raft": [
      { ten: "System Design · Bài 33 — Raft: đi sâu", url: "../system-design-course/#/bai/bai-33-raft-di-sau" },
      { ten: "Bài 32 — Bầu leader và replicated state machine", url: "../system-design-course/#/bai/bai-32-bau-leader-rsm" }
    ],
    "bam-nhat-quan": [
      { ten: "System Design · Bài 20 — Partitioning và sharding", url: "../system-design-course/#/bai/bai-20-partitioning-sharding" }
    ],
    "kien-truc": [
      { ten: "System Design · Bài 2 — Độ trễ, thông lượng, capacity planning", url: "../system-design-course/#/bai/bai-02-do-tre-thong-luong-capacity" },
      { ten: "System Design · Bài 10 — Caching căn bản", url: "../system-design-course/#/bai/bai-10-caching-can-ban" },
      { ten: "System Design · Bài 11 — Kiến trúc bất đồng bộ: queue", url: "../system-design-course/#/bai/bai-11-kien-truc-bat-dong-bo" },
      { ten: "System Design · Bài 19 — Replication", url: "../system-design-course/#/bai/bai-19-replication" },
      { ten: "System Design · Bài 29 — Lab: Capacity design", url: "../system-design-course/#/bai/bai-29-lab-capacity-design" }
    ],
    "bloom": [
      { ten: "System Design · Bài 5 — Cấu trúc dữ liệu xác suất", url: "../system-design-course/#/bai/bai-05-cau-truc-du-lieu-xac-suat" }
    ],
    "gioi-han-trung-tam": [
      { ten: "AI · Bài 13 — Biến ngẫu nhiên và phân phối", url: "../ai-everything-course/#/bai/m02-bai-13-bien-ngau-nhien-va-phan-phoi" }
    ],
    "markov": [
      { ten: "AI · Quá trình quyết định Markov", url: "../ai-everything-course/#/bai/m08-bai-03-qua-trinh-quyet-dinh-markov" }
    ],
    "dua-optimizer": [
      { ten: "AI · Bài 9 — Thuật toán tối ưu hiện đại", url: "../ai-everything-course/#/bai/m05-bai-09-thuat-toan-toi-uu-hien-dai" },
      { ten: "Bài 11 — Tối ưu liên tục và gradient descent", url: "../ai-everything-course/#/bai/m02-bai-11-toi-uu-lien-tuc-va-gradient-descent" }
    ],
    "giam-chieu": [
      { ten: "AI · Bài 5 — Giảm chiều trong thực tế", url: "../ai-everything-course/#/bai/m04-bai-05-giam-chieu-trong-thuc-te" },
      { ten: "Bài 7 — Trị riêng, SVD và PCA", url: "../ai-everything-course/#/bai/m02-bai-07-tri-rieng-svd-va-pca" }
    ],
    "dau-truong": [
      { ten: "Heuristic · Bài 13 — Simulated Annealing", url: "../heuristic-course-2/#/khoa-hoc/bai-13-simulated-annealing" },
      { ten: "AI · Tối ưu cục bộ và metaheuristic", url: "../ai-everything-course/#/bai/m01-bai-08-toi-uu-cuc-bo-va-metaheuristic" }
    ],
    "boids": [
      { ten: "Heuristic · Bài 17B — Bầy đàn & tiến hoá", url: "../heuristic-course-2/#/khoa-hoc/bai-17b-bay-dan-tien-hoa" }
    ]
  }
};
