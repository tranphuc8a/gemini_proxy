# M3 — góp ý nhỏ của người kiểm độc lập (CHƯA sửa)

M3 đạt kiểm độc lập (0 blocking, 23/10 22:11). Các điểm dưới đây người kiểm ghi ở mục "nhỏ"; workflow không sửa vì không có vòng sửa blocking.
Đề xuất: gom thành một đợt vá nhỏ "M3-vá" sau đợt 2 (hoặc trước khi deploy M3). Xếp theo mức đáng sửa.

## Nên sửa trước khi deploy
1. **Hồi quy trong trình soạn:** bấm neo `#` của heading tên "Share" (`rehypeEnhance.ts:124` sinh `href="#share"`) hoặc liên kết `[x](#share)` ở xem trước → bị đẩy sang trang "Link not available". Gốc: `parseShareHash('#share')` và `('#share=')` trả địa chỉ chia sẻ với token rỗng. Sửa: token rỗng thì không coi là địa chỉ chia sẻ; thêm test.
2. **Token lọt vào log và thân 500:** lỗi kho ở đường đọc công khai (vd MySQL/Aiven rớt kết nối giữa `SELECT … WHERE token = :token`) → `generic_exception_handler` (main.py) ghi `logger.exception` và trả `str(exc)` cho khách; thông điệp SQLAlchemy chứa `[parameters: (<token>,)]`. Trái md-share §3.3. Sửa: bọc lỗi kho ở đường đọc công khai thành lỗi chung không kèm chi tiết.
3. **`is_local_request`** (`markdown_admin.py:116-126`) so `client.host` với `{127.0.0.1, ::1, localhost}` → `::ffff:127.0.0.1` / `127.0.0.2` không được nhận là cục bộ, khoá mặc định bị từ chối ngay trên máy dev. Sửa: `ipaddress.ip_address(host).is_loopback`.
4. **`X-Admin-Key` `max_length=200`:** khoá dài hơn thì `/admin/verify` luôn 422, không mở khoá được. Ghi chú trong `.env.example`/README hoặc nâng trần.

## Nên sửa
5. **Làm mới (Update snapshot) liên kết ĐÃ HẾT HẠN** hồi sinh đúng token cũ (`markdown_share_usecase.py:112-116`) → ai còn giữ link cũ đọc lại được; hộp thoại không cảnh báo. Cảnh báo hoặc cấp token mới khi bản cũ đã hết hạn.
6. **`scanDocumentRefs`** (`src/lib/share.ts:153-162`) có thể bậc hai trên đầu vào xấu (dòng dài toàn `[` không có `]`; nhiều `<a` không có `>`); chạy mỗi lần mở hộp thoại (chỉ quản trị). Làm tuyến tính + thêm ca bệnh lý.
7. **ShareDialog:** mỗi lần `refresh()` danh sách, đối tượng `mine` đổi danh tính → effect (dòng 135-139) đặt lại ô Title, mất tiêu đề đang gõ dở.
8. **MySQL:** hai `docId` chỉ khác hoa/thường → `IntegrityError` tự tạo (`mysql_repository.py:119-123`) → 500 không có `data.code`. Đổi thành 409/400 kèm mã (vd `markdown_share_conflict`).

## Ghi chú / tài liệu
9. `client_address` tin `X-Real-IP`: đổi header là né được bộ đếm sai khoá/token (đã thử: sau 20 lần sai → 429, đổi header → 403). Ổn trên Vercel (nền tảng ghi header); tự dựng thì cần proxy ghi đè.
10. Kho `mysql` không tự đặt mặc định theo `VERCEL`; chủ phải đặt `MARKDOWN_STORAGE_BACKEND=mysql`.
11. `GET /markdown/shared?backend=mysql|mongo` bởi khách cũng kích hoạt `CREATE TABLE IF NOT EXISTS` lần đầu mỗi tiến trình (không chỉ lần chia sẻ đầu của chủ như M3.md viết) — idempotent, sửa câu trong tài liệu.
12. Lỗi từ dependency đường đọc công khai (backend sai → 400, query quá dài → 422) không mang `no-store`/`X-Robots-Tag` (vô hại).
13. App cũ `webapp/tranphuc8a/markdown-editor` (build cũ, ghi cứng `http://localhost:6789` + khoá mặc định) giờ luôn nhận 403 `markdown_private` — app gần như chết; cân nhắc gỡ khỏi portal.
14. SKILL `ban-do-ung-dung` ghi "43 tệp, 817 test" nhưng thực tế 821.
15. `frame-ancestors` (chống nhúng iframe) không đặt được bằng meta CSP; cần header ở `webapp_controller` (ngoài phạm vi M3).
16. `graph_storage_controller` (graphuc) vẫn so khoá bằng `==`, không giới hạn số lần sai (ngoài phạm vi).
17. Hạ tầng test: `npm test` mặc định lúc máy tải nặng từng báo "Failed to start forks worker … Timeout" dù test đạt; chạy lại `npx vitest run --maxWorkers=3` thì xanh.
