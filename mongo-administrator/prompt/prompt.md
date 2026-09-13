Viết cho tôi dự án ứng dụng web thuần FE tự chọn công nghệ nhưng hỗ trợ yêu cầu/tính năng sau:
1. Tính năng chính: cung cấp công cụ quản trị hệ cơ sở dữ liệu NoSQL (mongoDB...) tương tự như mongo-express/mongo-compass nhưng giao diện web
2. Tính năng thiết yếu: Hỗ trợ connect/đăng nhập tới host/port/username/password bất kỳ, lưu phiên đăng nhập cho tới khi user đăng xuất
3. Yêu cầu kiến trúc: Ứng dụng web thuần, cùng lắm sử dụng thêm restful api


Nếu cần sự hỗ trợ từ phía BE:
1. Đọc hiểu kiến trúc FastAPI đã được implement tại backend\fastapi
2. Chỉ hỗ trợ Restful API


Yêu cầu output:
- Một file mô tả cấu trúc project
- Các file khác là nội dung từng file trong dự án
- Có file readme hướng dẫn cài đặt môi trường, build and run
- Base directory: /mongo-administrator
- Có compact lại context và công việc vào mongo-administrator\prompt sau khi thực hiện xong

Steps:
0. Đọc prompt và lập plan thực hiện
1. Phân tích yêu cầu
2. Thiết kế giải pháp
3. Implementation
4. Selftest & Unittest
5. Report

Sử dụng codegraph nếu cần đọc hiểu mã nguồn (để tiết kiệm token)
