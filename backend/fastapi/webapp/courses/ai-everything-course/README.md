# Trang học đại khoá AI

Giao diện web cho [đại khoá học Trí tuệ nhân tạo](../README.md) —
**15 môn · 218 bài giảng · 8 đồ án · 6 học kỳ**.

> **Chỉ có front-end.** Không Node, không npm, không framework, không bước biên dịch.

---

## Chạy thử

Nội dung **không còn nằm trong trang**: nó ở database (bảng `courses`, `course_docs`…),
và trang hỏi API `/courses/ai-everything/…` của chính FastAPI. Vì vậy mở trang qua backend:

```bash
cd backend/fastapi
uvicorn src.main:app --port 6789          # rồi mở http://127.0.0.1:6789/webapp/courses/ai-everything-course/
```

Database chưa có khoá này thì nạp bundle (một lần):

```bash
cd backend/fastapi
DB_URL=sqlite+aiosqlite:///data/dev.sqlite3 python tools/manage_courses.py init-db   # chỉ khi dùng SQLite cục bộ
python tools/manage_courses.py import ../course-content/ai-everything.json                   # thêm --yes nếu đích là MySQL thật
```

Trang mở từ máy chủ tĩnh (`python -m http.server`) hay `file://` thì thêm
`?api=http://127.0.0.1:6789` vào địa chỉ để trỏ tới API (chỉ nhận API ở máy cục bộ, xem `engine/README.md`). Muốn chạy **hoàn toàn offline**:
`python tools/manage_courses.py export ai-everything --js -o webapp/courses/ai-everything-course/assets/content.js`
rồi thêm lại `<script src="assets/content.js">` trước `cau-hinh.js` — engine thấy
`window.COURSE` thì dùng nó thay cho API.

> ℹ️ Lần đầu mở cần mạng để nạp `marked`, `KaTeX`, `highlight.js` từ cdnjs.

## Tính năng

| Nhóm | |
|---|---|
| **Đọc** | KaTeX cho công thức · **mermaid cho sơ đồ** · tô màu cú pháp + nút chép · hình vẽ ASCII giữ nguyên · bảng cuộn ngang được · hộp chú ý đổi màu theo biểu tượng (📖 📌 ⚠️ ⚖️ 🕐) · mục lục trong bài bám mục đang đọc · liên kết chéo giữa các bài được viết lại thành đường đi trong trang |
| **Học** | đánh dấu đã học · vòng tròn tiến độ · thanh tiến độ theo từng môn · thẻ "học tiếp" · ghi chú riêng mỗi bài · đánh dấu sao · bài trước/tiếp · số phút đọc + thời lượng + độ khó + **trục** |
| **Tìm kiếm** | toàn văn · **gõ không dấu vẫn ra** (`hoc sau` → "học sâu") · chỉ khớp đầu từ · xếp hạng tiêu đề > đầu mục > nội dung |
| **Khác** | sáng/tối · đáp ứng tới 400 px · in được · `?q=...` và `?theme=dark` chia sẻ được |

### Phím tắt

| | |
|---|---|
| <kbd>Ctrl</kbd>+<kbd>K</kbd> / <kbd>/</kbd> | tìm kiếm |
| <kbd>↑</kbd><kbd>↓</kbd><kbd>↵</kbd> | chọn và mở kết quả |
| <kbd>[</kbd> / <kbd>]</kbd> | bài trước / bài tiếp |
| <kbd>Esc</kbd> | đóng |

Tiến độ, ghi chú và đánh dấu lưu trong `localStorage` — không máy chủ, không tài khoản.

---

## Bản đồ tệp

```
web/
├── index.html          khung trang + bộ biểu tượng SVG
├── assets/
│   ├── app.css         ★ BẢN SAO của engine/app.css — đừng sửa ở đây
│   ├── app.js          ★ BẢN SAO của engine/app.js  — đừng sửa ở đây
│   ├── chu-de.css      RIÊNG — bảng màu (nhấn hồng sen #9d174d)
│   └── cau-hinh.js     RIÊNG — window.CAU_HINH (trang chủ, mô tả môn, gợi ý tìm) · khoaHoc = "ai-everything" (slug trong database)
└── check.py            mỏng — gọi ../engine/kiem_khoa_hoc.py (tĩnh + FastAPI thật + Chromium)
```

---

## Cập nhật nội dung

Sửa trực tiếp trong database — không còn bước build cho trang:

| Cách | Khi nào |
|---|---|
| Trang [Quản lý khoá học](../quan-ly-khoa-hoc/) | sửa bài, sắp xếp mục lục, xuất bản / ẩn, nạp / xuất bundle |
| `python tools/manage_courses.py …` (trong `backend/fastapi`) | nạp bundle lớn (vượt 4,5 MB thân request của Vercel), sao lưu, script |
| API `PUT /courses/ai-everything/docs/{id}`, `PUT /courses/ai-everything/structure` | tự động hoá |
| `/admin` (sqladmin) | sửa nhanh một hàng |

Mọi đường ghi đều tăng `version` của khoá, nên trình duyệt xác thực lại manifest
(ETag) và chỉ mục tìm kiếm phía server được dựng lại — không có bản cache cũ.

Bundle `backend/course-content/ai-everything.json` là bản sao lưu dạng tệp (định dạng
`content.json` cũ cộng khối `course`). Thư mục markdown nguồn **không có trong repo**;
nếu có, `backend/course-content/ai-everything/build.py <thu-muc-nguon>` sinh lại bundle.

### Kiểm thử

```bash
python check.py --tinh    # tĩnh: index.html, bản sao engine, khoaHoc, bundle
python check.py           # + FastAPI thật trên SQLite tạm, nạp bundle, mở bằng Chromium
python check.py --anh     # như trên, chụp ảnh vào _shots/
```

Tầng trình duyệt không dùng mock: nó dựng uvicorn với `DB_URL` trỏ vào một SQLite tạm,
nạp bundle bằng `manage_courses.py`, rồi mở trang qua route `/webapp/…` của FastAPI
(`API_PREFIX=/api/v1`). Logic dùng chung ở [`engine/kiem_khoa_hoc.py`](../engine/kiem_khoa_hoc.py).

## Quan hệ với các trang khác trong kho

| | Nội dung | Màu nhấn |
|---|---|---|
| [`samsung/web`](../../samsung/web/README.md) | khoá Heuristic + 2 ca nghiên cứu | tím chàm `#5b4bd6` |
| [`system-design/web`](../../system-design/web/README.md) | khoá System Design + 6 đồ án | xanh mòng két `#0e7490` |
| **`ai-everything-course/web`** | đại khoá AI, 15 môn + 8 đồ án | **hồng sen `#9d174d`** |
| [`ai-everything-course/visual`](../visual/README.md) | **33 mô phỏng tương tác** | hồng sen |
| [`courses/engine`](../../engine/README.md) | engine dùng chung của ba trang trên | — |

> ✅ Ba trang đầu dùng **cùng một engine**, và engine đó **đã được tách ra**
> [`courses/engine/`](../../engine/README.md). Mỗi khoá chỉ còn giữ `index.html`,
> `cau-hinh.js` và `chu-de.css` (nội dung nằm trong database); `app.js` / `app.css` là **bản sao**
> do `python engine/sync.py` chép xuống. Sửa engine thì sửa ở `engine/` rồi chạy
> `sync.py`; `python engine/sync.py --kiem` bắt được bản sao bị lệch.

### Khác biệt của bản này so với hai bản kia

```
   · nav[0] có 16 nhóm (Chương trình + 15 môn) thay vì 7 giai đoạn
   · huy hiệu thẻ: i=0 → la bàn, i≥1 → số môn "01".."15"
   · chip số bài dùng meta.of (số bài CỦA MÔN đó), không phải tổng toàn khoá
   · thêm chip "Trục A/B/C/D" lấy từ siêu dữ liệu bài
   · KPI hiện "đã soạn / dự kiến" khi khoá chưa hoàn tất
   · NẠP MERMAID và vẽ sơ đồ sau khi nội dung đã vào DOM
   · trang chủ CHỊU ĐƯỢC mục chưa có file nào (bỏ qua thay vì lỗi)
```

---

## Ghi chú kỹ thuật

**Nội dung tải từ API thay vì nhúng sẵn.** Trước đây toàn bộ khoá nằm trong `assets/content.js` để mở được bằng `file://`. Cái giá là trang nào cũng tải cả khoá (8 MB với khoá AI) và lập chỉ mục tìm kiếm trên trình duyệt. Giờ trang chỉ tải manifest, từng bài khi mở, và hỏi server khi tìm. Chế độ offline vẫn còn qua `manage_courses.py export --js` (xem *Chạy thử*).

**Mermaid phải vẽ SAU khi nội dung vào DOM.** Hàm `render()` trả về một cây DOM rời;
mermaid không vẽ được trên cây rời. Vì vậy `veMermaid()` được gọi trong `viewDoc`
sau khi đã gán `innerHTML`. Sơ đồ hỏng không được làm vỡ trang — khối lỗi tự
chuyển về hiển thị mã nguồn.

**Công thức toán được rút ra trước khi dựng markdown**, thay bằng thẻ giữ chỗ
`<span>` (không phải `<div>`) để công thức khối vẫn đặt được bên trong khối trích
dẫn và ô bảng.

**Bỏ dấu tiếng Việt bằng bảng tra 1 ký tự → 1 ký tự**, giữ nguyên độ dài chuỗi nên
vị trí khớp dùng thẳng được cho bản gốc khi cắt trích đoạn và tô sáng.

**Biểu tượng dùng `<symbol viewBox="0 0 24 24">`**, không dùng `<g>`. Thiếu `viewBox`
thì trình duyệt vẽ hệ toạ độ 24×24 ở tỉ lệ 1:1 rồi cắt bớt — icon trông to và bị xén.

**Tránh `text-transform: uppercase` ở cỡ chữ nhỏ:** dấu thanh tiếng Việt nằm trên/dưới
chữ cái nên biến mất ở 10–11 px.

---

## Nội dung nằm ở đâu

| | Trước | Bây giờ |
|---|---|---|
| Nội dung | `assets/content.js` + `content.json` nhúng trong trang (8,4 MB) | database: `courses` / `course_sections` / `course_groups` / `course_docs` |
| Trang tải khi mở | toàn bộ khoá | **manifest**: mục lục + siêu dữ liệu, không markdown (≈ 24 KB gzip) |
| Mở một bài | đã có sẵn | `GET /courses/ai-everything/docs/{id}` — một bài, có ETag |
| Tìm kiếm | lập chỉ mục cả khoá trên trình duyệt | `GET /courses/ai-everything/search?q=` — xếp hạng phía server, cùng quy tắc |
| Bundle tệp | sinh bởi `build.py` trong thư mục này | `backend/course-content/ai-everything.json` — ngoài Root Directory của Vercel |

Tiến độ, ghi chú, đánh dấu sao vẫn trong `localStorage` (khoá theo `id` bài — không
đổi khi chuyển sang database, nên tiến độ cũ của người học được giữ nguyên).

