# Báo cáo kết quả — Ứng dụng web Quản lý chi tiêu

2026-10-06 · Người đọc: chủ dự án (đã đọc `prompt.md`). Chi tiết thiết kế: `design.md`; tiến độ: `implement-progress.md`.

## 1. Tóm tắt

Đã làm xong ứng dụng **Quản lý chi tiêu** thay cho nhật ký chi tiêu viết tay trong PDF, xuất bản tại
`backend/fastapi/webapp/tranphuc8a/quan-ly-chi-tieu/` (mở ở `/webapp/tranphuc8a/quan-ly-chi-tieu/`). Ứng dụng cũ `tranphuc8a/chi-tieu` không bị đụng tới.

- **Nhập nhanh một dòng** như viết ghi chú: `57/2 bún đậu hôm qua` → chi 57.000 chia đôi, hôm qua, Ăn uống. Hiểu `57k`, `61.5k`, `1,5tr`, `19.485.250`, `3.520K`, `87k - 50k`.
- **Chia tiền với bạn cùng phòng** thay cho phép tính tay `(439,5 − 182)/2`: ai trả, ai tham gia, số nợ từng người, tin nhắn quyết toán sao chép được, ghi khoản đã thanh toán.
- Báo cáo tuần/tháng/năm, chi theo danh mục / ngày / **T2–T6·T7·CN** (đúng cách nhật ký cũ chia), ngân sách, giao dịch định kỳ (hỏi xác nhận, không tự ghi), **sổ tiết kiệm** (đáo hạn, lãi dự kiến, thuế, tất toán, tái tục), máy tính chia hoá đơn trọ.
- **Ba chế độ lưu trữ**: Máy này (localStorage, chạy cả bằng `file://`), Máy chủ · MySQL, Máy chủ · MongoDB. Hai thiết bị sửa cùng lúc không mất dữ liệu; mất mạng không mất khoản vừa nhập.
- Responsive điện thoại ↔ máy tính, sáng/tối, tiếng Việt, không thư viện ngoài.

## 2. Đối chiếu yêu cầu

| Nhóm | Kết quả |
|---|---|
| FR-01…08 ghi chép (nhập nhanh, số tiền kiểu Việt, ngày, nhập hàng loạt, gợi ý & mẫu nhanh, danh sách/tìm/lọc/hoàn tác, định kỳ) | ✅ đủ |
| FR-10…13 chia tiền (chi chung, dòng tiền ≠ chi của tôi, sổ nợ + quyết toán, máy tính hoá đơn) | ✅ đủ |
| FR-20…21 tài khoản & sổ tiết kiệm | ✅ đủ |
| FR-30 ngân sách | ✅ |
| FR-40…43 báo cáo (kỳ, danh mục, ngày, thứ, 12 tháng, top, sao chép, in) | ✅ — in bằng `Ctrl+P` có CSS riêng nhưng **chưa xem bản in** |
| FR-50…56 lưu trữ & đồng bộ (3 chế độ, chuyển/sao chép giữa kho, trạng thái, sao lưu/CSV, nhắc sao lưu, kho nào dùng được) | ✅ — MySQL/Mongo xem §5 |
| FR-60…64, FR-70 giao diện, phím tắt, mẫu/dữ liệu mẫu, danh mục | ✅ |
| Bước 1–7 trong `prompt.md` | ✅ (5 tài liệu `.md` + mã + test + báo cáo) |

Ngoài phạm vi (như đã nêu ở `requirements.md` §2): đăng nhập/đa người dùng, đính kèm ảnh chứng từ, OCR, đa tiền tệ, PWA offline, mã hoá đầu cuối.

## 3. Bằng chứng

| Kiểm | Kết quả |
|---|---|
| **Số liệu thật trong PDF** (trang 8, 10, 16, 17, 19, 20, 21, 22, 24, 27) | **10/10 ra đúng**: Phúc chuyển 128.750 / 124.250 / 215.250 / 89.250 ₫; hoá đơn trọ 2.828.000 ₫/người; lãi 1.252.500 / 1.033.200 / 970.000 ₫; sau thuế 589.000 ₫; `87k − 50k` = 37.000 ₫ |
| `kiem.js` (logic thuần + động cơ đồng bộ với máy chủ giả) | 430 đạt, gồm ~2.600 bộ ngẫu nhiên có hạt giống (chia không lệch đồng; gộp **giao hoán, kết hợp, lũy đẳng**) |
| pytest `/spending` | 91 đạt (usecase, cả 3 kho chạy chung một bộ test, controller, **đua ghi đồng thời**) |
| pytest toàn bộ backend | **993 đạt** (902 cũ + 91 mới) |
| Server thật + HTTP | tạo/đọc/lưu/409/`since`/xoá cho kho json và mysql; tiếng Việt + emoji + khoá lạ (`$where`, `a.b`) lưu rồi đọc lại nguyên vẹn |
| Trình duyệt thật (Edge) | 4 cỡ màn × 7 màn hình không tràn ngang, nút chính ≥ 44 px, mọi nút có tên truy cập; nhập nhanh, XSS, sáng/tối, tải lại, tải file; **2 thiết bị**: nối bằng mã, cùng thêm → gộp đủ, cùng sửa → bản muộn thắng, xoá lan sang thiết bị kia; **offline → online**; mở bằng `file://` |
| Tương phản WCAG AA | 17 cặp màu ≥ 4,5:1 ở cả hai chủ đề |
| Quy mô 10.000 giao dịch (2,2 MB) | tải + vẽ 306–680 ms · tìm 11 ms (lần đầu 222 ms) · mỗi lần sửa 75–82 ms *(đo trên máy tính)* |

Tất cả chạy bằng một lệnh: `backend\fastapi\.venv\Scripts\python.exe quan-ly-chi-tieu\selftest\run.py` → **160 đạt · 0 sai · 1 bỏ qua**.

## 4. Lỗi thật mà các bộ kiểm đã bắt (đã sửa)

1. `parse("1..2")` đọc thành 12.000 ₫ → từ chối số hỏng.
2. `22/04: Rút sổ tiết kiệm 7.718.147` (dòng thật trong PDF) bị nhập thành *khoản chi* 7,7 triệu → nay bị đánh dấu "không hiểu — nhập ở mục Chuyển".
3. `file://` chưa điền địa chỉ máy chủ vẫn gọi `fetch('file:///…')` → lỗi CORS ồn ào; nay engine không gọi.
4. Hai cặp màu chủ đề sáng dưới 4,5:1 (4,44 và 4,42) → tối hơn.
5. Tìm `com` ra "Techcombank" → chỉ khớp đầu từ.
6. Dòng giao dịch trên điện thoại: tiêu đề và mô tả dính liền chữ (`Mì cayĂn uống`).
7. Tìm 260 ms và mỗi lần sửa ~196 ms với 10.000 khoản (serialize cả sổ 3 lần/lần sửa; tách từ lại mọi giao dịch mỗi phím) → 10 ms / 82 ms.
8. Chữ "Danh mục" trong hộp thoại không có kiểu nhãn; nhãn trục biểu đồ `333,3k` → 4 vạch lưới tròn (100k, 200k…).

## 5. Chưa kiểm được / rủi ro còn lại

- **MongoDB thật và MySQL thật chưa được chạy.** MySQL chạy qua SQLite (cùng câu SQL portable), Mongo qua `fake_mongo`. Tôi không ghi vào cơ sở dữ liệu Aiven của bạn. Muốn kiểm Mongo thật: đặt `SELFTEST_MONGO_URI` rồi chạy `selftest/run.py --only api` (ghi vào DB `qlct_selftest`, rồi xoá).
  - MySQL: dữ liệu có emoji (biểu tượng danh mục) cần database/kết nối `utf8mb4`; sổ gần 4 MB cần `max_allowed_packet` ≥ 4 MB (mặc định MySQL 5.7 là đúng 4 MB).
- Chưa thử trên **Safari/iOS, Firefox** và điện thoại thật (chỉ Edge, giả lập cỡ màn + cảm ứng). Hiệu năng 10.000 giao dịch đo trên máy tính, chưa đo trên điện thoại tầm trung.
- Chưa xem bản in (`Ctrl+P`), chưa thử trình đọc màn hình thật (đã kiểm: mọi nút có tên, `aria-live`, `<dialog>` có nhãn).
- **Đồng hồ lệch**: gộp theo `updatedAt` của máy; hai máy lệch nhiều phút/giờ có thể chọn nhầm "bản muộn hơn".
- Mỗi sổ là một tài liệu ≤ 4 MB (≈ 20.000 giao dịch); app cảnh báo từ 3 MB nhưng chưa có công cụ "chuyển năm cũ ra file".
- Khoá truy cập lưu trong `localStorage` để tự đồng bộ (như postman): không dùng chế độ máy chủ trên máy lạ.
- Phát hiện sẵn có (ngoài phạm vi, **không sửa**): `GET /storage/backends` công khai trả cả tên database và host MySQL (vd `…aivencloud.com`), và hiển thị `DB_HOST` ngay cả khi đang dùng `DB_URL`. UI mới không nhắc lại chuỗi này.

## 6. Cách làm việc — những điều bạn nên biết

- `CLAUDE.md` của bạn ghi "trình bày kế hoạch, chờ duyệt" trước khi sửa mã. Phiên này không tương tác được nên tôi coi `prompt.md` (nêu rõ bước 4 lập kế hoạch rồi bước 5 triển khai) là sự đồng ý, và để kế hoạch trong `implementation-plan.md`. Mọi thứ nằm trong thư mục mới hoặc là phần cộng thêm; **không commit** gì. `git status` cho thấy các file đã ở trạng thái *staged* mà tôi không chạy `git add`.
- Một tác tử phụ làm backend theo hợp đồng ở `design.md` §5; tôi đọc báo cáo, xem diff các file có sẵn (`main.py`, `config.py`, `.env.example`, `README.md`, `fake_mongo.py` — chỉ thêm), chạy lại test và toàn suite.
- Môi trường: cài PyMuPDF vào venv tạm (đọc PDF) và Playwright vào `backend/fastapi/.venv` (đã khai báo trong `requirements-dev.txt`). Không thêm dependency vào `requirements.txt`.
- Mật khẩu wifi ở trang 3 của PDF không được chép vào tài liệu hay dữ liệu mẫu. Nên đổi nó vì file PDF đã chứa nó.
- Dữ liệu mẫu trong app là dữ liệu giả sinh ra (gắn thẻ `#mau`, xoá được bằng một nút), không phải dữ liệu thật trong PDF.

## 7. Việc nên làm tiếp (theo giá trị)

1. Chạy `selftest` với `SELFTEST_MONGO_URI` và một MySQL thật (không phải Aiven production) một lần.
2. Thử trên điện thoại thật; nếu cần dùng offline hoàn toàn ngay cả khi tải trang: thêm service worker (PWA).
3. Ba kho "workspace + khoá + revision" (postman, spending, markdown…) giống nhau đến 80 %: gom thành một kho tài liệu dùng chung là việc dọn dẹp đáng làm — chưa làm vì sẽ phải sửa app postman đang chạy tốt.
4. Công cụ "chuyển giao dịch năm cũ ra file" khi sổ gần 4 MB; nhập ảnh chứng từ nếu thật sự cần.
