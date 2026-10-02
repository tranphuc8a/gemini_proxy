# Thư viện khoá học — trang đọc chung

Trang đọc **mọi** khoá học trong database, kể cả khoá vừa tạo ở
[trang Quản lý khoá học](../quan-ly-khoa-hoc/) — không cần dựng thư mục hay viết
`cau-hinh.js` cho từng khoá.

| Địa chỉ | Hiện gì |
|---|---|
| `/webapp/courses/khoa-hoc/` | danh mục mọi khoá đã xuất bản (quản trị viên đang đăng nhập thấy cả bản nháp) |
| `/webapp/courses/khoa-hoc/?khoa=<slug>` | đọc khoá đó: mục lục, bài, tìm kiếm phía server, tiến độ, ghi chú |
| `…?khoa=<slug>&nhap=1` | xem trước bản nháp — gửi kèm token phiên của trang Quản lý (cùng máy chủ) |

Trang Quản lý có nút **Mở trang khoá học ↗** (hoặc **Xem trước bản nháp ↗**) trỏ vào đây
cho mọi khoá. Khoá có trang riêng dựng sẵn (`config.webapp`, ví dụ
`courses/system-design-course`) thì có thêm nút **Trang riêng ↗**, và danh mục trỏ sang
trang riêng — chỉ khi trang đó có thật (đối chiếu `/webapp/_api/list`). Một
`config.webapp` trỏ vào thư mục không tồn tại bị bỏ qua, không thành link hỏng.

## Cách chạy

- `assets/cau-hinh.js` đọc `?khoa=`: có thì đặt `window.CAU_HINH` chung (tiến độ cất
  theo `kh-<slug>`), không có thì bật chế độ danh mục.
- `assets/thu-vien.js` nạp `assets/app.js` (engine dùng chung, bản sao do
  `engine/sync.py` chép — đừng sửa) hoặc vẽ danh mục.
- Engine thấy trang không có `tenNgan` / `tieuDe` / `heroMoTa` thì lấy tên, phụ đề, biểu
  tượng, mô tả từ chính khoá học trong database khi manifest về.

## Kiểm tra

```bash
python check.py          # FastAPI thật + SQLite tạm + Chromium
python check.py --anh    # + ảnh chụp vào _shots/
```

Dựng lại đúng tình huống: tạo khoá qua API (có `config.webapp` hỏng), mở danh mục, đọc
khoá, mở bài, tìm kiếm, khoá không tồn tại, bản nháp với và không có token, không lỗi console.
