Viết cho tôi dự án ứng dụng web thuần FE tự chọn công nghệ nhưng hỗ trợ yêu cầu/tính năng sau:
1. Tính năng chính: editor soạn thảo văn bản và preview định dạng markdown
2. Tính năng thiết yếu: Hỗ trợ lưu/quản lý file theo cây thư mục
3. Người dùng: Admin (authen bằng secret key) có quyền thêm sửa xóa, anonymous user chỉ có quyền view preview
4. Yêu cầu chi tiết: Xây một web app (không dùng BE) hỗ trợ các chức năng cơ bản của một trình soạn thảo định dạng markdown
5. Hỗ trợ các loại định dạng đặc biệt khác: markdown image, markdown link, markdown tables, markdown html, markmath (công thức toán học), markdown mermaid (sơ đồ)
6. Định dạng markdown theo theme của github (tôi thấy theme này là đẹp nhất)
7. Các tính năng bổ sung: undo, redo, history actions, synchronize scroll position between editor and preview...

Yêu cầu output:
- Một file mô tả cấu trúc project
- Các file khác là nội dung từng file trong dự án
- Có file readme hướng dẫn cài đặt môi trường, build and run
- Base directory: /markdown-editor

Steps:
0. Đọc prompt và lập plan thực hiện
1. Phân tích yêu cầu
2. Thiết kế giải pháp
3. Implementation
4. Selftest & Unittest
5. Report
