# Bàn giao 17/10 (đợt 2) — Cổng portal viết lại từ đầu

**Chưa commit** (nhánh `lab/261010_2`). Thay thế hoàn toàn cổng cũ (`portal.js`, `palette.js`, `portal.css` đã xoá). Cổng ở `backend/fastapi/webapp/_portal/`, mở tại `/webapp/_portal/portal.html`.

## Vì sao viết lại (đo trên dữ liệu thật: 261 app, 9 thư mục)
- Thẻ có 5 cỡ chiều cao trên máy tính, 9–10 cỡ trên điện thoại (do số dòng tag/huy hiệu quyết định); 226/261 app có > 5 tag, tag dài tới 30 ký tự; 226 mô tả là câu tự sinh.
- 18 app của chủ dự án + 13 khoá học bị chìm trong 240 app demo bên thứ ba trong một lưới phẳng; thanh lọc chiếm gần nửa màn hình điện thoại; ô tìm bị cắt chữ; nút `⌕` trống.
- Ba lỗi cũ ẩn: lựa chọn sáng/tối bị xoá ngay lần vẽ đầu; chọn mỗi "Thể loại" thì nút xoá lọc không hiện; `sticky` hỏng vì `body` cao đúng 100%.

## Kết quả
**Trang chủ** chia phần theo ý nghĩa: ⭐ Yêu thích → 🕘 Mở gần đây → Ứng dụng của tôi → Khoá học & công cụ học → Thư viện (240 app bên thứ ba, gập theo thư mục). Cấu hình ở `portal.config.json` (phần, nhãn, thứ tự) — sửa tay, không cần đụng mã. Tab **Tất cả / Yêu thích / Đã ẩn**; tìm hoặc lọc thì trang chủ nhường chỗ cho danh sách kết quả, xoá hết thì quay lại.

**Thẻ không bao giờ đổi kích thước**: chiều cao là hằng số CSS (`--card-h`, `--tile-h`, `--row-h`); tiêu đề 1 dòng, mô tả 2 dòng, hàng tag 1 dòng không xuống hàng ("+N" cho phần thừa), chữ dài cắt bằng dấu ba chấm + `title`. **Lưới ⇄ Danh sách** (và mật độ Thoải mái/Gọn) chọn được, nhớ theo máy. Điện thoại: lưới thành **ô vuông 2 cột** kiểu màn hình ứng dụng, thanh điều hướng dưới (Trang chủ · Tất cả · Tìm · Yêu thích · Thêm), bộ lọc là **tờ trượt từ đáy** có nút "Xem N ứng dụng", nhấn giữ một thẻ = chi tiết, vùng chạm ≥ 44 px (trừ chữ trong thẻ), `dvh`/vùng an toàn, ô nhập 16 px (iOS không tự phóng to).

**Tiện ích**: ghim ⭐ (kèm "Hoàn tác"), ẩn app, lịch sử mở & "hay mở nhất", chi tiết app (mô tả đầy đủ, mọi tag bấm để lọc, ngày cập nhật, số lần mở), sao chép liên kết, chia sẻ, **mã QR** (tự viết `core/qr.js`, không thư viện; có cảnh báo khi địa chỉ là localhost vì điện thoại không mở được), app ngẫu nhiên, **tìm không dấu** với `#tag`, `@thư-mục`, `loai:thể-loại`, Enter mở kết quả đầu (Shift+Enter: tab mới), bộ lọc thư mục/thể loại/tag (bất kỳ/đủ mọi)/"chỉ app dùng được offline", huy hiệu **Offline** và **Mới**, xuất/nhập dữ liệu cá nhân (JSON), chuyển dữ liệu từ cổng cũ, theo dõi nhiều tab (sự kiện `storage`), **phím tắt** (`/` `?` `g h|a|f` mũi tên `f` `i` `h` `1…9` `r` `v` `t`), **Ctrl+K** tìm app + khoá học + bài học + lab + hỏi AI + lệnh (đổi giao diện, tới tab, cài đặt…).

**PWA**: manifest đủ (id, icon any/maskable, 3 lối tắt Tìm kiếm/Yêu thích/Gần đây, ảnh chụp wide+narrow), `sw.js` lưu vỏ + `ai-khach.js` + danh sách app (offline vẫn thấy danh sách đã lưu kèm biểu ngữ "lưu lúc …", lọc "chỉ app offline"), **cập nhật chờ người dùng đồng ý** ("Có bản mới — Tải lại"), nút Cài đặt tự bật khi trình duyệt cho phép, hướng dẫn iOS, `storage.persist()`. `PHIEN_BAN` trong `sw.js` là dấu băm nội dung vỏ: **sửa bất cứ tệp nào của cổng thì chạy** `backend\fastapi\.venv\Scripts\python.exe backend\fastapi\webapp\_portal\tao-pwa.py` (`--icons` vẽ lại biểu tượng, `--anh` chụp lại ảnh cài đặt); `check.py` báo lỗi nếu quên.

**Backend**: `/webapp/_api/list` có thêm `updated` (mtime lớn nhất của `index.html`/`metadata.json`) và `pwa` (app có `manifest` + `sw.js` ở gốc) — `webapp_controller.py`, 4 test mới (25 test controller đạt). Nhãn "Mới" chỉ hiện khi app mới là thiểu số (≤ 30%): mtime đổi hàng loạt khi clone/deploy.

## Kiểm
- `node backend/fastapi/webapp/_portal/kiem.js` — **86 phép** logic thuần (tìm kiếm, lọc, sắp xếp, nhóm, dữ liệu cá nhân, URL, mã QR). QR được kiểm bằng một bộ **giải mã viết riêng** trong test (đa thức sửa lỗi Reed–Solomon triệt tiêu, BCH của định dạng, đọc lại đúng chuỗi UTF-8 ở mọi ranh giới sức chứa v1…v10 + 60 chuỗi ngẫu nhiên).
- `backend\fastapi\.venv\Scripts\python.exe backend\fastapi\webapp\_portal\check.py [--tinh|--chuc-nang|--co-gian|--pwa] [--anh <thư-mục>]` (`--co-gian --nhanh` = chỉ 4 bề rộng, để kiểm nhanh một bản sửa) — **171 phép đạt, 0 lỗi** (chạy đủ ≈ 9 phút); backend 1709 test đạt. 4 tầng: tĩnh (cú pháp, tham chiếu, không tài nguyên ngoài, manifest, dấu `sw.js`, **tương phản ≥ 4,5:1 của mọi cặp màu**), chức năng (Chromium máy tính + **WebKit iPhone 13** + **Chromium Pixel 5**), **co giãn với dữ liệu xấu nhất** (tiêu đề/tag/thư mục dài không ngắt chữ, mô tả 5000 ký tự, HTML độc, RTL, emoji ghép, NFD… × 12 bề rộng 280→1920 px × 8 trạng thái × Chromium/WebKit/Firefox), PWA (cài worker, mở khi mất mạng, luồng cập nhật, nút cài).
- Lỗi thật tìm ra nhờ bộ kiểm trong lúc làm: thuộc tính `data-view` gán lên `<html>` trùng nút lưới/danh sách nên `closest()` nuốt mọi cú bấm; `dataset.file` rỗng nên nút Nhập không chạy; chuỗi emoji dài tràn ô biểu tượng; chip lọc nhanh lòi khỏi khung cha; tiêu đề danh sách bị flex cột kéo giãn trong WebKit; nhãn `@khoa-hoc` không khớp "Khoá học" (so theo slug); mất focus bàn phím khi vẽ lại thanh lọc.

## Quyết định cần biết
- Trang chủ **không còn** là một lưới phẳng 261 app; muốn khác thì sửa `portal.config.json` (phần, nhãn, thứ tự) hoặc dùng tab "Tất cả".
- Dữ liệu cá nhân (ghim, ẩn, lịch sử, cài đặt) lưu ở `localStorage["portal:v2"]` của TRÌNH DUYỆT — chưa đồng bộ giữa các thiết bị; dùng Xuất/Nhập để chuyển.
- Cổng cũ không còn: URL cũ `?q=&tags=&in=&cat=&sort=` vẫn dùng được.

## Chưa làm / chưa kiểm
- **Chưa thử trên điện thoại thật** (Samsung, iPhone, Tecno Pova): đã kiểm bằng WebKit iPhone 13/SE, Chromium Pixel 5/Galaxy S9+ giả lập (cảm ứng, vùng an toàn, bàn phím ảo chưa thể giả lập). Nếu còn thấy vỡ, gửi kiểu máy + ảnh chụp.
- PWA cần **HTTPS** khi deploy (chưa xác nhận); chưa thử cài thật trên iOS/Android; mã QR chưa quét bằng camera thật.
- Đồng bộ ghim/lịch sử giữa thiết bị chưa có (cần API lưu theo người dùng).
- `scripts/audit-webapps.mjs` vẫn không chạy được (thiếu Playwright cho Node).
