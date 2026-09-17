# Trang học đại khoá AI

Giao diện web cho [đại khoá học Trí tuệ nhân tạo](../README.md) —
**15 môn · 218 bài giảng · 8 đồ án · 6 học kỳ**.

> **Chỉ có front-end.** Không Node, không npm, không framework, không bước biên dịch.

---

## Chạy thử

**Nhanh nhất:** nhấp đúp [`index.html`](index.html). Chạy được ngay vì toàn bộ nội
dung đã nhúng sẵn vào `assets/content.js` — trang **không dùng `fetch`** nên không
vướng chặn CORS của giao thức `file://`.

**Khuyến nghị:**

```bash
cd ai-everything-course/web
python -m http.server 8790 --bind 127.0.0.1
# mở http://127.0.0.1:8790
```

> ℹ️ Lần đầu mở cần mạng để nạp `marked`, `KaTeX`, `highlight.js` và `mermaid` từ cdnjs.

---

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
│   ├── app.css         hệ thống giao diện (nhấn hồng sen #9d174d)
│   ├── app.js          định tuyến · dựng markdown · mermaid · tìm kiếm · tiến độ
│   └── content.js      ★ TỰ SINH — toàn bộ nội dung nhúng sẵn
├── build.py            sinh lại content.js; CŨNG LÀ NƠI KHAI BÁO THỨ TỰ HỌC
├── check.py            kiểm liên kết hỏng / hàng rào mã lẻ / công thức lệch
└── shot.py             kiểm thử + chụp ảnh bằng Chromium có sẵn
```

---

## Cập nhật nội dung

Trang **không** đọc trực tiếp tệp `.md` lúc chạy. Sau khi sửa bất kỳ bài nào:

```bash
cd ai-everything-course/web
python build.py      # sinh lại assets/content.js
python check.py      # kiểm liên kết và cú pháp
```

**Thêm bài mới** → thêm tên file vào danh sách `MON` trong `build.py`.

> 📌 `build.py` **đã khai báo đủ 218 bài**. Bài chưa soạn được báo là "thiếu" và bỏ
> qua — trang vẫn chạy bình thường và tự hiển thị bài mới ngay khi file xuất hiện.
> Chỉ số KPI trên trang chủ hiện **số bài đã soạn / tổng số bài dự kiến**, để tiến
> độ luôn trung thực.

### Kiểm thử

```bash
python -m http.server 8790 --bind 127.0.0.1   # cửa sổ 1
python shot.py                                 # cửa sổ 2
```

`shot.py` dùng Chromium có sẵn (từ bộ cài Playwright) — **không cài thêm thư viện nào**.
Nó nạp trang bằng trình duyệt thật, xác nhận JavaScript chạy xong và dựng đúng nội
dung (gồm cả sơ đồ mermaid đã được vẽ thành SVG), rồi chụp ảnh vào `_shots/`.

---

## Quan hệ với các trang khác trong kho

| | Nội dung | Màu nhấn |
|---|---|---|
| [`samsung/web`](../../samsung/web/README.md) | khoá Heuristic + 2 ca nghiên cứu | tím chàm `#5b4bd6` |
| [`system-design/web`](../../system-design/web/README.md) | khoá System Design + 6 đồ án | xanh mòng két `#0e7490` |
| **`ai-everything-course/web`** | đại khoá AI, 15 môn + 8 đồ án | **hồng sen `#9d174d`** |
| [`ai-everything-course/visual`](../visual/README.md) | 17 mô phỏng tương tác | hồng sen |

> ⚠️ Ba trang đầu dùng **cùng một engine** (`app.js`, `app.css`), hiện đang **bị nhân
> bản**. Sửa lỗi engine ở một bên phải chép sang hai bên kia. Nếu thêm khoá thứ tư,
> nên tách engine ra một thư mục dùng chung và để mỗi trang chỉ giữ `index.html` +
> `content.js` + cấu hình màu.

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

**Nội dung nhúng sẵn thay vì `fetch`** để mở được bằng `file://` — trình duyệt chặn
`fetch` trên giao thức này nhưng không chặn `<script src>`.

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
