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
| --- | --- |
| Danh sách khoá | mọi khoá, kể cả bản nháp; chọn bằng chuột hoặc bàn phím; ô lọc khi có từ 5 khoá · **＋ Khoá mới** từ mẫu (Trống · Khoá học cơ bản · Theo chủ đề), slug tự sinh từ tiêu đề · **Nạp bundle JSON** (trùng slug thì hỏi, bản cũ vào thùng rác) · **🗑 Thùng rác** |
| Thông tin | tiêu đề, phụ đề, biểu tượng, mô tả, cấu hình JSON (báo lỗi ngay cạnh ô) · **xuất bản / nháp** (nháp: API công khai trả 404) · thống kê · mở trang đọc / trang riêng · **Nhân bản…** (bản nháp, đủ bài và tệp) · xuất bundle kèm tệp · xoá (gõ lại slug) vào thùng rác |
| Cấu trúc & bài | cây section → nhóm → bài · **kéo-thả** bài, nhóm, section · ↑ ↓ (tiêu điểm đi theo dòng) và ⇄ "chuyển tới…" thay cho kéo-thả bằng bàn phím · lọc bài (gõ không dấu) · thu gọn nhóm (nhớ theo khoá) · hộp thoại section (id kiểm tra tại chỗ, sửa được id + biểu tượng) và nhóm · **Lưu cấu trúc** một lần |
| Soạn bài | ba chế độ **Soạn · Chia đôi · Xem**; xem trước dùng CHUNG bộ dựng với trang đọc (KaTeX, mermaid, tô màu mã, hộp chú ý, link giữa các bài, ảnh của khoá) · thanh công cụ (đậm, nghiêng, tiêu đề, link tới bài khác chọn từ danh sách, ảnh, khối mã, công thức, hộp chú ý, bảng) · **dán hoặc kéo ảnh vào ô soạn** là tải lên khoá và chèn sẵn · **bản nháp tự lưu trên máy** (đóng tab, mất mạng, hết phiên vẫn khôi phục được, kèm xem khác biệt) · thuộc tính (tiêu đề, slug, loại, nhãn, meta) báo lỗi cạnh ô |
| ⋯ của một bài | mở trên trang đọc · **lịch sử** 30 bản (xem khác biệt, đưa bản cũ vào trình soạn) · nhân bản · **đổi id** (tiến độ người học đi theo) · xoá vào thùng rác (báo trước bài nào đang link tới) |
| Tệp | tải lên (kéo-thả hoặc chọn; ảnh, pdf, txt, csv, json, zip, mp3, mp4, py, ipynb; ≤ 3 MB) · biết tệp dùng trong bài nào · chép markdown · xoá (cảnh báo khi còn bài dùng). Tệp của khoá nháp chỉ quản trị viên xem được |
| Kiểm tra liên kết | link hỏng giữa các bài (đường dẫn `.md`, `#/slug`) và tới `assets/…`, theo từng bài; bấm là mở bài, chọn sẵn dòng có link |
| Tìm kiếm thử | đúng API trang khoá học dùng; tô sáng từ khoá; bấm kết quả mở bài trong tab Cấu trúc |
| Thùng rác | khoá và bài đã xoá, giữ 30 ngày · khôi phục khoá (slug đã có khoá khác thì hỏi slug mới) · khôi phục bài về đúng nhóm cũ · xoá hẳn |

**Không mất việc đang làm.** Thông tin, cây và bài đang sửa chung một chốt "chưa lưu": đổi
khoá, ↻, thùng rác, khoá mới, khoá phiên, đóng tab đều hỏi trước. Lưu kèm `If-Match`: ai đó
(hoặc tab khác) vừa lưu thì trang hỏi — tải bản trên server, ghi đè, hay xem lại (bài có hiện
khác biệt từng dòng). Hết phiên giữa chừng thì màn đăng nhập hiện **đè lên** ứng dụng; nhập
lại khoá rồi bấm Lưu tiếp. Token tự làm mới khi còn dưới 30 phút.

**Địa chỉ theo trạng thái:** `#/<slug>/<tab>/<id bài>` (tab: `info`, `tree`, `files`, `links`,
`search`) và `#/~thung-rac` — F5 giữ nguyên chỗ, gửi link được cho người khác.

**Phím tắt:** `Ctrl+S` lưu (bài đang soạn › cây › thông tin) · `Ctrl+B` / `Ctrl+I` đậm /
nghiêng · `Tab` trong ô soạn là thụt lề (`Esc` rồi `Tab` để rời ô) · `Esc` đóng hộp thoại.

**Điện thoại:** danh sách khoá thành ngăn kéo (☰); cây và trình soạn là hai màn ("← Mục lục"
để quay về); màn cảm ứng có nút đủ lớn và điều khiển luôn hiện. Nút ☀ / ☾ / ◐ đổi giao diện
sáng / tối / theo hệ điều hành.

Bundle lớn hơn **4,5 MB** (giới hạn thân request của Vercel — khoá AI là 8,4 MB) không
nạp được qua trang khi backend chạy trên Vercel; dùng CLI:

```bash
cd backend/fastapi
python tools/manage_courses.py import ../course-content/ai-everything.json --yes
```

## Mã nguồn

| Tệp | Phần |
| --- | --- |
| `assets/app.js` | lõi `window.QL`: phiên, gọi API, hộp thoại, chốt "chưa lưu", địa chỉ, danh sách khoá, thông tin, tìm thử, tạo / nhân bản / nạp, thùng rác |
| `assets/cay.js` | tab Cấu trúc: cây, kéo-thả, hộp thoại section / nhóm / bài mới |
| `assets/soan.js` | trình soạn: xem trước, bản nháp trên máy, lưu và xung đột, lịch sử, khác biệt (Myers) |
| `assets/tep.js` | tab Tệp và Kiểm tra liên kết |
| `assets/hien-thi.js`, `hien-thi.css` | **bản sao** từ `../engine/` (`python ../engine/sync.py`) — đừng sửa ở đây |

## Kiểm tra

```bash
python check.py          # FastAPI thật trên SQLite tạm + Chromium
python check.py --anh    # kèm ảnh chụp vào _shots/
```

73 phép thử, mỗi thao tác trên giao diện được **đối chiếu bằng API**: đăng nhập (khoá sai,
token chứ không phải khoá), chọn khoá bằng bàn phím, URL theo khoá / tab / bài, chốt "chưa
lưu" (đổi khoá, ↻), xung đột thông tin và bài, tìm thử, kéo-thả nhóm và bài, lọc, thu gọn,
hộp thoại section / nhóm / bài mới, xem trước (KaTeX, hộp chú ý, mã), Ctrl+S, meta sai, bản
nháp sau khi tải lại trang, lịch sử, đổi slug / id, nhân bản, tải ảnh lên, kiểm tra liên kết,
xoá bài đang được link rồi khôi phục, hết phiên giữa chừng, khoá từ mẫu, link trang đọc,
nhân bản khoá, nạp và nạp đè, xoá / khôi phục khoá (cả khi trùng slug), markdown độc hại,
`?api=` lạ, nút sáng / tối, điện thoại 390 px — và không có lỗi console.
