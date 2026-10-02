/* ==========================================================================
   Thư viện khoá học — cấu hình CHUNG cho mọi khoá trong database.

   Các trang *-course có cau-hinh.js viết tay cho đúng một khoá. Trang này thì
   không: khoá vừa tạo ở trang Quản lý khoá học chưa có thư mục, chưa có cấu
   hình — nên mọi thứ riêng của khoá (tên, phụ đề, biểu tượng, mô tả) engine lấy
   từ chính khoá học trong database khi manifest về.

     ?khoa=<slug>   đọc khoá đó bằng engine dùng chung (assets/app.js)
     ?khoa=…&nhap=1 bản nháp — engine gửi kèm token phiên của trang Quản lý
     (không có)     danh mục mọi khoá học (assets/thu-vien.js)

   Nạp TRƯỚC thu-vien.js; thu-vien.js mới quyết định nạp engine hay vẽ danh mục.
   ========================================================================== */
(function () {
  "use strict";
  var m = location.search.match(/[?&]khoa=([^&#]*)/);
  var slug = m ? decodeURIComponent(m[1].replace(/\+/g, " ")).trim() : "";
  if (!slug) {
    window.THU_VIEN = true;
    return;
  }
  window.CAU_HINH = {
    khoaHoc: slug,
    /* Tiến độ, ghi chú, đánh dấu cất theo từng khoá — hai khoá cùng host không
       được ghi đè nhau. */
    khoaLuu: "kh-" + slug,

    /* Không có tenNgan / tieuDe / heroMoTa: engine lấy từ database. */
    loTrinhTieuDe: "Lộ trình",
    /* Section đầu là lộ trình; mọi section sau nó thành thẻ "phần khác" — khoá
       mới không có quy ước "đồ án" hay "tra cứu" như các khoá dựng tay. */
    doAnLat: [1, 1000],
    doAnTieuDe: "Các phần khác",
    doAnPhu: "",
    doAnMoTa: "",
    traCuuChiSo: -1
  };
})();
