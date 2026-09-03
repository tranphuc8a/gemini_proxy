Nhận xét của khách hàng và cải tiến ứng dụng web markdown-editor milestone 3:

0. Cần sắp xếp lại thanh công cụ, bổ sung thêm các icon
1. Fix issue của file management: hiện tại chỉ tạo được các file/folder ngoài thư mục gốc chứ chưa tạo được file/folder nằm trong một folder khác. Ngoài ra hãy thêm chức năng move và copy file/folder.
2. Chức năng hiển thị sơ đồ mermaid đã hoạt động tương đối oke nhưng mới chỉ đúng chỉ khi load lần đầu, khi kéo thanh devider ở giữa thì lại bị vỡ sơ đồ và quay lại trạng thái mã nguồn. Phiên bản mermaid chưa mới nhất và có nhiều sơ đồ và cú pháp mermaid còn chưa được support.
3. Bổ sung view mode full screen và cho phép collapse/expand sidebar quản lý file.
4. Chức năng sync scrollbar position hoạt động chưa oke lắm, mới chỉ sync được từ bên preview sang bên editor mà position cũng chưa chính xác 100%, còn bị lệch. Bổ sung thêm các chức năng:
4.1. Sync position theo chiều ngược: từ bên editor sang bên preview
4.2. Kích đúp vào một vị trí bên preview thì con trỏ bên editor focus nhấp nháy vào đúng vị trí bên editor
5. Bổ sung thêm chức năng markdown viewer cho các phần mã nguồn/src code đặc biệt theo ngôn ngữ lập trình, được bao bọc trong khối "```languague ... ```". Bên cạnh đó bổ sung button copy để copy nội dung trong những khối này (tương tự như github ấy).
6. Chức năng xuất bản nâng cao: export trang preview sang các định dạng pdf và hình ảnh (jpg/png) như định dạng đẹp hiện tại của preview.
7. Responsive cho thiết bị di động.

Hãy lập plan thực hiện và update cho milestones này theo những nhận xét và yêu cầu mới từ khách hàng
