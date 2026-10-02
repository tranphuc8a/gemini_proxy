# Quản lý khoá học

Trang quản trị nội dung khoá học trong database, chạy trên API `/courses` của FastAPI.
Mọi thay đổi đi qua API — cùng quy tắc kiểm tra, cùng cơ chế tăng `version` — nên
trang khoá học thấy thay đổi ngay ở lần tải sau (ETag) và tìm kiếm phía server
không giữ chỉ mục cũ.

## Mở

```text
http://<backend>/webapp/courses/quan-ly-khoa-hoc/
```

Đăng nhập bằng `COURSE_ADMIN_KEY` (biến môi trường của backend). Khoá được đổi lấy một
token phiên (`POST /courses/admin/verify`, hết hạn sau `COURSE_SESSION_HOURS` giờ);
trình duyệt chỉ giữ token, **không giữ khoá**. Đổi khoá trên server là thu hồi mọi phiên.
Token được làm mới khi mở lại trang, nhưng chỉ trong `COURSE_SESSION_MAX_DAYS` ngày (mặc
định 7) kể từ lần nhập khoá — token lỡ bị lộ không sống mãi được.

Backend **không có khoá mặc định**: chưa đặt `COURSE_ADMIN_KEY` thì quản trị tắt, trang
báo "Máy chủ chưa bật quản trị khoá học". Token cất trong localStorage theo đúng máy chủ
đã cấp (`qlkh.phien@<gốc API>.token`), không bao giờ bị gửi sang máy chủ khác.
`?api=` chỉ được nghe khi API ở máy cục bộ (`localhost`, `127.0.0.1`, `[::1]`) hoặc trang mở
từ `file://`; trỏ ra máy chủ khác thì bị bỏ qua (cảnh báo trong console) — để một đường link
lạ không khiến trang đọc bài từ máy chủ của người khác.

## Trang đọc của khoá

Mọi khoá — kể cả khoá vừa tạo ở đây — có nút **Mở trang khoá học ↗** dưới tiêu đề, trỏ
vào [Thư viện khoá học](../khoa-hoc/) (`../khoa-hoc/?khoa=<slug>`); bản nháp là **Xem trước
bản nháp ↗** (`&nhap=1`, trang đọc gửi kèm token phiên của trang này). Không cần dựng thư
mục hay điền `config.webapp`. `config.webapp` chỉ dành cho khoá có trang riêng dựng sẵn
trong `webapp/` (ví dụ `courses/system-design-course`): khi trang đó có thật thì thêm nút
**Trang riêng ↗**, còn không thì một dòng nhắc thay cho link hỏng.

## Làm được gì

| Khu vực | Việc |
|---|---|
| Danh sách | mọi khoá, kể cả bản nháp · ＋ Khoá mới · Nạp bundle JSON (thay toàn bộ khoá cùng slug) |
| Thông tin | tiêu đề, phụ đề, biểu tượng, mô tả, cấu hình JSON · **xuất bản / nháp** (nháp: API công khai trả 404) · thống kê · mở trang khoá học · xuất bundle · xoá (gõ lại slug) |
| Cấu trúc & bài | cây section → nhóm → bài · ↑ ↓ sắp xếp · chuyển bài sang nhóm khác · bỏ khỏi mục lục / đưa lại · thêm, sửa, xoá section và nhóm · **Lưu cấu trúc** một lần cho mọi thay đổi |
| Sửa bài | tiêu đề, slug, loại, nhãn, meta JSON, markdown + xem trước · bài mới trong một nhóm · xoá bài |
| Tìm kiếm thử | đúng API trang khoá học dùng (`/courses/{slug}/search`) |

Bundle lớn hơn **4,5 MB** (giới hạn thân request của Vercel — khoá AI là 8,4 MB) không
nạp được qua trang khi backend chạy trên Vercel; dùng CLI:

```bash
cd backend/fastapi
python tools/manage_courses.py import ../course-content/ai-everything.json --yes
```

## Kiểm tra

```bash
python check.py          # FastAPI thật trên SQLite tạm + Chromium
python check.py --anh    # kèm ảnh chụp vào _shots/
```

Mỗi thao tác trên giao diện được **đối chiếu bằng API**: đăng nhập (khoá sai bị từ chối,
trình duyệt giữ token chứ không giữ khoá), sửa thông tin, chuyển nháp (API công khai trả
404), đổi thứ tự nhóm, sửa bài, xem trước, tạo bài mới ở cuối nhóm, xoá bài, tìm kiếm,
xuất bundle, tạo khoá, nạp bundle từ tệp, xoá khoá (gõ sai slug thì không xoá), tải lại
trang vẫn còn phiên, và không có lỗi console.
