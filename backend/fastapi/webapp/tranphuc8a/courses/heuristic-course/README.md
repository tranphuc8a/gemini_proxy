# Trang học trực tuyến

Giao diện web cho khoá **Heuristic từ cơ bản đến chuyên sâu** và hai ca nghiên cứu
đề thi thật (2605, 2607).

> **Chỉ có front-end.** Không Node, không npm, không framework, không bước biên dịch.
> Chỉ HTML + CSS + JavaScript thuần.

---

## Chạy thử

### Cách 1 — mở thẳng (nhanh nhất)

Nhấp đúp vào [`index.html`](index.html).

Chạy được ngay vì toàn bộ 51 tài liệu đã được nhúng sẵn vào `assets/content.js`
dưới dạng một biến JavaScript — trang **không dùng `fetch`**, nên không vướng
chặn CORS của giao thức `file://`.

### Cách 2 — qua máy chủ cục bộ (khuyến nghị)

```bash
cd samsung/web
python -m http.server 8777 --bind 127.0.0.1
# mở http://127.0.0.1:8777
```

Cách này cần thiết nếu bạn muốn các liên kết tới **tệp mã nguồn** (`solution.cpp`,
`judge.cpp`…) mở đúng.

### Cách 3 — đưa lên mạng

Toàn bộ thư mục là trang tĩnh, chép thẳng lên GitHub Pages / Netlify / Cloudflare
Pages là chạy. Không cần cấu hình gì.

> ℹ️ Trang nạp `marked`, `KaTeX` và `highlight.js` từ **cdnjs**, nên lần đầu mở cần
> có mạng. Sau đó trình duyệt sẽ lưu đệm.

---

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
│   ├── app.css         hệ thống giao diện (token màu, prose, đáp ứng)
│   ├── app.js          bộ định tuyến, dựng markdown, tìm kiếm, tiến độ
│   └── content.js      ★ TỰ SINH — 51 tài liệu nhúng sẵn (0,85 MB)
├── build.py            sinh lại content.js từ các tệp .md
├── check.py            kiểm tra liên kết hỏng / hàng rào mã lẻ / công thức lệch
├── shot.py             chụp ảnh & kiểm thử trong trình duyệt thật
└── _shots/             ảnh chụp (không đưa vào git)
```

---

## Cập nhật nội dung

Nội dung **không** được đọc trực tiếp từ các tệp `.md` lúc chạy — nó được nhúng sẵn.
Sau khi sửa bất kỳ tệp markdown nào của khoá học hay ca nghiên cứu:

```bash
cd samsung/web
python build.py      # sinh lại assets/content.js
python check.py      # kiểm tra liên kết và cú pháp
```

`build.py` cũng là nơi khai báo **thứ tự học** và cách nhóm bài. Thêm tài liệu mới
thì thêm một dòng `L("đường/dẫn.md")` vào biến `TREE`.

### Kiểm thử

```bash
python -m http.server 8777 --bind 127.0.0.1   # cửa sổ 1
python shot.py                                 # cửa sổ 2
```

`shot.py` dùng Chromium có sẵn (từ bộ cài Playwright) — **không cài thêm thư viện nào**.
Nó tải trang bằng trình duyệt thật, xác nhận JavaScript chạy xong và dựng đúng nội dung
(công thức, tô màu mã, bảng, hộp chú ý, liên kết, tìm kiếm), rồi chụp ảnh vào `_shots/`.

---

## Vài ghi chú kỹ thuật

**Vì sao nhúng nội dung thay vì `fetch`?** Để mở được bằng `file://`. Trình duyệt chặn
`fetch` trên giao thức này, nhưng `<script src>` thì không. Đổi lại là mỗi lần sửa
markdown phải chạy `build.py`.

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
