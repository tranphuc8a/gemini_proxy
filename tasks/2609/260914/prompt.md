

Fix một số issue của các web application.

1. Issue không save được json file của một số webapp:
- Danh sách webapp dính lỗi: postman-lite, markdown-editor...
- Tính năng lỗi: save data to backend as json file
- Lỗi: [Errno 30] Read-only file system: '/var/task/data'
- Trạng thái lỗi: Không lỗi khi chạy local, chỉ bị lỗi sau khi deploy vercel


2. markdown-editor web app issues
- Không lưu session đăng nhập, mỗi khi reload lại phải nhập admin token để thực hiện với quyền admin
- Popup sync khi hiển thị, chưa kịp chọn loại storage (json, database) đã bị ẩn đi => Không đổi được


3. Nâng cấp một số webapp cho phép lưu 3 loại db: json/mysql/mariadb
- Ngoài việc cho phép lưu json file thì
- Cho phép lựa chọn lưu vào database mysql
- Cho phép lựa chọn lưu vào database mongodb
=> Mở rộng backend fast-api


4. Cải thiện 3 webapp lightout games:
- Path: backend\fastapi\webapp\tranphuc8a\light-grid-v*
- Nâng cấp giao diện và trải nghiệm người dùng
- Bổ sung thêm những tính năng khác để học tập/nghiên cứu bài toán lightout
- Cho phép chọn thêm cấu hình/hình dạng khác (ring, hexagon...)
- Tô màu bàn cờ, thêm các loại quân cờ...
- Brain storming thêm những feature khác wow và bùng nổ hơn...


5. Xây dựng webapp mới (phần chính):
- Tên: graphuc, đường dẫn: \graphuc
- Chức năng chính: Một webapp giúp hỗ trợ vẽ các loại đồ thị học tập cấu trúc dữ liệu và giải thuật
- Công nghệ: Tùy chọn
- Giao diện và trải nghiệm tốt
- Một số chức năng chi tiết:
+ Định nghĩa cấu trúc dữ liệu lưu đồ thị
+ Hỗ trợ vẽ nhiều loại đồ thị khác nhau: đơn đồ thị, đa đồ thị, có hướng, vô hướng, DAG, flow, có trọng số, không trọng số, cây, danh sách liên kết, heap, cây nhị phân, trie...
+ Cho phép gắn nhãn, label, notes... lên đỉnh và cạnh
+ Cho phép lưu đồ thị đã vẽ vào local/backend json/mysql/mongo
+ Authenticate bằng admin-token
+ Import và export đồ thị ra các loại: json code, pdf, png...
+ Trình editor cho phép history action: undo, redo...
+ Format màu sắc, hình dạng đỉnh, loại cạnh (liền, khuyết...)... như canvas
+ Tính năng phụ bổ sung: Hỗ trợ vẽ một số đồ thị/diagram chuẩn khác như activity/flow/state-machine...

