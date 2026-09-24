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
              "Học máy & dữ liệu"],

  chanTrang: 'Web Lab trực quan · <a href="../../index.html">về trang chủ</a> · ' +
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
  bitrateGhi: 8000000
};
