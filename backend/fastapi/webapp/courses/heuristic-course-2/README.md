# Trang học trực tuyến

Giao diện web cho khoá **Heuristic từ cơ bản đến chuyên sâu** và hai ca nghiên cứu
đề thi thật (2605, 2607).

> **Chỉ có front-end.** Không Node, không npm, không framework, không bước biên dịch.
> Chỉ HTML + CSS + JavaScript thuần.

---

## Chạy thử

Nội dung **không còn nằm trong trang**: nó ở database (bảng `courses`, `course_docs`…),
và trang hỏi API `/courses/heuristic-2/…` của chính FastAPI. Vì vậy mở trang qua backend:

```bash
cd backend/fastapi
uvicorn src.main:app --port 6789          # rồi mở http://127.0.0.1:6789/webapp/courses/heuristic-course-2/
```

Database chưa có khoá này thì nạp bundle (một lần):

```bash
cd backend/fastapi
DB_URL=sqlite+aiosqlite:///data/dev.sqlite3 python tools/manage_courses.py init-db   # chỉ khi dùng SQLite cục bộ
python tools/manage_courses.py import ../course-content/heuristic-2.json                   # thêm --yes nếu đích là MySQL thật
```

Trang mở từ máy chủ tĩnh (`python -m http.server`) hay `file://` thì thêm
`?api=http://127.0.0.1:6789` vào địa chỉ để trỏ tới API (chỉ nhận API ở máy cục bộ, xem `engine/README.md`). Muốn chạy **hoàn toàn offline**:
`python tools/manage_courses.py export heuristic-2 --js -o webapp/courses/heuristic-course-2/assets/content.js`
rồi thêm lại `<script src="assets/content.js">` trước `cau-hinh.js` — engine thấy
`window.COURSE` thì dùng nó thay cho API.

> ℹ️ Lần đầu mở cần mạng để nạp `marked`, `KaTeX`, `highlight.js` từ cdnjs.

## Tính năng

### Đọc

| | |
|---|---|
| **Công thức toán** | KaTeX, cả công thức khối và trong dòng (1 703 công thức trong dòng, 124 khối) |
| **Mã nguồn** | tô màu cú pháp C++/bash/python, nút **chép** ở mỗi khối |
| **Hình vẽ ASCII** | nhận diện riêng, không tô màu, giữ nguyên khoảng trắng, cuộn ngang được |
| **Bảng** | 2 042 dòng bảng, tự cuộn ngang trên màn nhỏ, số không bị ngắt dòng |
| **Hộp chú ý** | khối trích dẫn tự đổi màu theo biểu tượng: 📖 tham chiếu · 📌 điểm mấu chốt · ⚠️ cảnh báo · ❌ phản bác · ✅ xác nhận |
| **Mục lục trong bài** | cột phải, tự làm nổi mục đang đọc |
| **Liên kết nội bộ** | 300 liên kết giữa các tài liệu được viết lại thành đường đi trong trang — bấm là nhảy, không rơi ra ngoài |

### Học

| | |
|---|---|
| **Theo dõi tiến độ** | đánh dấu đã học từng bài; vòng tròn ở thanh trên, thanh tiến độ theo từng phần |
| **Học tiếp** | trang chủ nhớ bài đang đọc dở |
| **Ghi chú riêng** | mỗi bài một ô ghi chú, tự lưu |
| **Đánh dấu xem lại** | gắn sao những bài cần quay lại |
| **Bài trước / tiếp** | điều hướng tuyến tính theo đúng thứ tự học |
| **Thời lượng** | mỗi bài hiện số phút đọc ước tính, thời lượng đề xuất và độ khó |

Mọi thứ lưu trong `localStorage` của trình duyệt — không có máy chủ, không có tài khoản.

### Tìm kiếm

Nhấn <kbd>Ctrl</kbd>+<kbd>K</kbd> hoặc <kbd>/</kbd>.

- Tìm toàn văn trên cả 51 tài liệu (98 000 từ)
- **Gõ không dấu vẫn ra**: `can duoi` → tìm thấy “cận dưới”, `cuc tri cuc bo` → “cực trị cục bộ”
- Chỉ khớp ở **đầu từ**, nên từ ngắn như “bộ” không khớp nhầm vào giữa “sandbox”
- Xếp hạng: khớp tiêu đề > khớp đầu mục > khớp nội dung
- Trích đoạn đã gỡ sạch cú pháp markdown và tô sáng từ khoá

### Phím tắt

| Phím | Việc |
|---|---|
| <kbd>Ctrl</kbd>+<kbd>K</kbd> / <kbd>/</kbd> | mở tìm kiếm |
| <kbd>↑</kbd> <kbd>↓</kbd> <kbd>↵</kbd> | chọn và mở kết quả |
| <kbd>[</kbd> / <kbd>]</kbd> | bài trước / bài tiếp |
| <kbd>Esc</kbd> | đóng |

### Khác

- **Sáng / tối**, mặc định theo hệ thống
- **Đáp ứng** tới bề rộng 400 px (mục lục thành ngăn kéo)
- **In được** (ẩn mọi thành phần điều hướng)
- Đường dẫn chia sẻ được: `?q=ablation` mở sẵn kết quả tìm kiếm, `?theme=dark` ép giao diện tối

---

## Bản đồ tệp

```
web/
├── index.html          khung trang + bộ biểu tượng SVG
├── assets/
│   ├── app.css         ★ BẢN SAO của engine/app.css — đừng sửa ở đây
│   ├── app.js          ★ BẢN SAO của engine/app.js  — đừng sửa ở đây
│   ├── chu-de.css      RIÊNG — bảng màu (nhấn tím chàm #5b4bd6)
│   └── cau-hinh.js     RIÊNG — window.CAU_HINH (trang chủ, mô tả phần, gợi ý tìm) · khoaHoc = "heuristic-2" (slug trong database)
├── check.py            mỏng — gọi ../engine/kiem_khoa_hoc.py (tĩnh + FastAPI thật + Chromium)
└── _shots/             ảnh chụp (không đưa vào git)
```

---

## Cập nhật nội dung

Sửa trực tiếp trong database — không còn bước build cho trang:

| Cách | Khi nào |
|---|---|
| Trang [Quản lý khoá học](../quan-ly-khoa-hoc/) | sửa bài, sắp xếp mục lục, xuất bản / ẩn, nạp / xuất bundle |
| `python tools/manage_courses.py …` (trong `backend/fastapi`) | nạp bundle lớn (vượt 4,5 MB thân request của Vercel), sao lưu, script |
| API `PUT /courses/heuristic-2/docs/{id}`, `PUT /courses/heuristic-2/structure` | tự động hoá |
| `/admin` (sqladmin) | sửa nhanh một hàng |

Mọi đường ghi đều tăng `version` của khoá, nên trình duyệt xác thực lại manifest
(ETag) và chỉ mục tìm kiếm phía server được dựng lại — không có bản cache cũ.

Bundle `backend/course-content/heuristic-2.json` là bản sao lưu dạng tệp (định dạng
`content.json` cũ cộng khối `course`). Thư mục markdown nguồn **không có trong repo**;
nếu có, `backend/course-content/heuristic-2/build.py <thu-muc-nguon>` sinh lại bundle.

### Kiểm thử

```bash
python check.py --tinh    # tĩnh: index.html, bản sao engine, khoaHoc, bundle
python check.py           # + FastAPI thật trên SQLite tạm, nạp bundle, mở bằng Chromium
python check.py --anh     # như trên, chụp ảnh vào _shots/
```

Tầng trình duyệt không dùng mock: nó dựng uvicorn với `DB_URL` trỏ vào một SQLite tạm,
nạp bundle bằng `manage_courses.py`, rồi mở trang qua route `/webapp/…` của FastAPI
(`API_PREFIX=/api/v1`). Logic dùng chung ở [`engine/kiem_khoa_hoc.py`](../engine/kiem_khoa_hoc.py).

## Vài ghi chú kỹ thuật

**Nội dung tải từ API thay vì nhúng sẵn.** Trước đây toàn bộ khoá nằm trong `assets/content.js` để mở được bằng `file://`. Cái giá là trang nào cũng tải cả khoá (8 MB với khoá AI) và lập chỉ mục tìm kiếm trên trình duyệt. Giờ trang chỉ tải manifest, từng bài khi mở, và hỏi server khi tìm. Chế độ offline vẫn còn qua `manage_courses.py export --js` (xem *Chạy thử*).

**Công thức toán được rút ra trước khi dựng markdown.** Nếu để markdown xử lý trước,
dấu `\\` trong môi trường `cases` của LaTeX sẽ bị nuốt thành `\`. Bộ dựng thay mỗi
công thức bằng một thẻ giữ chỗ, dựng markdown, rồi mới gọi KaTeX điền vào.
Thẻ giữ chỗ dùng `<span>` (không phải `<div>`) để công thức khối vẫn đặt được bên
trong khối trích dẫn và ô bảng.

**Bỏ dấu tiếng Việt bằng bảng tra 1 ký tự → 1 ký tự**, không dùng `normalize("NFD")`.
Nhờ giữ nguyên độ dài chuỗi, vị trí tìm được trên bản không dấu dùng thẳng được cho
bản gốc để cắt trích đoạn và tô sáng — và nhanh hơn hẳn trên 770 nghìn ký tự.

**Tiếng Việt và chữ viết hoa cỡ nhỏ.** Giao diện tránh `text-transform: uppercase` ở
cỡ chữ nhỏ: dấu thanh nằm trên/dưới chữ cái nên biến mất ở 10–11 px, khiến
“PHẦN 1 — TƯ DUY TỐI ƯU” gần như không đọc được.

---

## Nội dung nằm ở đâu

| | Trước | Bây giờ |
|---|---|---|
| Nội dung | `assets/content.js` + `content.json` nhúng trong trang (1,4 MB) | database: `courses` / `course_sections` / `course_groups` / `course_docs` |
| Trang tải khi mở | toàn bộ khoá | **manifest**: mục lục + siêu dữ liệu, không markdown (≈ 6 KB gzip) |
| Mở một bài | đã có sẵn | `GET /courses/heuristic-2/docs/{id}` — một bài, có ETag |
| Tìm kiếm | lập chỉ mục cả khoá trên trình duyệt | `GET /courses/heuristic-2/search?q=` — xếp hạng phía server, cùng quy tắc |
| Bundle tệp | sinh bởi `build.py` trong thư mục này | `backend/course-content/heuristic-2.json` — ngoài Root Directory của Vercel |

Tiến độ, ghi chú, đánh dấu sao vẫn trong `localStorage` (khoá theo `id` bài — không
đổi khi chuyển sang database, nên tiến độ cũ của người học được giữ nguyên).

## Phụ lục trực quan

Khoá này có một trang mô phỏng tương tác riêng: [`../visual/`](../visual/README.md) — **16 demo**, thuật toán chạy thật trong trình duyệt, không thư viện ngoài.

```bash
cd ../visual
python -m http.server 8781 --bind 127.0.0.1
```
