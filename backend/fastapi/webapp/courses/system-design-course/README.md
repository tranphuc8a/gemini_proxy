# Trang học System Design

Giao diện web cho khoá [`system-design/khoa-hoc`](../khoa-hoc/README.md) —
**58 bài giảng · 6 đồ án · 9 tài liệu tra cứu**.

> **Chỉ có front-end.** Không Node, không npm, không framework, không bước biên dịch.
> HTML + CSS + JavaScript thuần.

---

## Chạy thử

**Nhanh nhất:** nhấp đúp [`index.html`](index.html). Chạy được ngay vì toàn bộ 80 tài
liệu đã nhúng sẵn vào `assets/content.js` — trang **không dùng `fetch`** nên không vướng
chặn CORS của giao thức `file://`.

**Khuyến nghị** (để liên kết tới tệp khác trong kho mở đúng):

```bash
cd system-design/web
python -m http.server 8788 --bind 127.0.0.1
# mở http://127.0.0.1:8788
```

**Đưa lên mạng:** chép cả thư mục lên GitHub Pages / Netlify / Cloudflare Pages.
Không cần cấu hình.

> ℹ️ Lần đầu mở cần mạng để nạp `marked`, `KaTeX`, `highlight.js` từ cdnjs.

---

## Tính năng

| Nhóm | |
|---|---|
| **Đọc** | KaTeX cho công thức · tô màu cú pháp + nút chép · hình vẽ ASCII giữ nguyên · 2 229 dòng bảng cuộn ngang được · hộp chú ý tự đổi màu theo biểu tượng (📖 📌 ⚠️ ❌ ✅) · mục lục trong bài bám mục đang đọc · **496 liên kết chéo giữa các bài được viết lại thành đường đi trong trang** |
| **Học** | đánh dấu đã học · vòng tròn tiến độ · thanh tiến độ theo từng giai đoạn · thẻ "học tiếp" · ghi chú riêng mỗi bài · đánh dấu sao · bài trước/tiếp · số phút đọc + thời lượng + độ khó |
| **Tìm kiếm** | toàn văn 75 000 từ · **gõ không dấu vẫn ra** (`nhat quan` → "nhất quán") · chỉ khớp đầu từ · xếp hạng tiêu đề > đầu mục > nội dung |
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
│   ├── chu-de.css      RIÊNG — bảng màu (nhấn xanh mòng két #0e7490)
│   ├── cau-hinh.js     RIÊNG — window.CAU_HINH (trang chủ, mô tả nhóm, gợi ý tìm)
│   └── content.js      ★ TỰ SINH — 80 tài liệu nhúng sẵn (0,79 MB)
├── build.py            sinh lại content.js; CŨNG LÀ NƠI KHAI BÁO THỨ TỰ HỌC
├── check.py            mỏng — gọi ../../engine/kiem.py
└── shot.py             mỏng — khai báo tuyến đường, gọi ../../engine/chup.py
```

---

## Cập nhật nội dung

Trang **không** đọc trực tiếp tệp `.md` lúc chạy. Sau khi sửa bất kỳ bài nào:

```bash
cd system-design/web
python build.py      # sinh lại assets/content.js
python check.py      # kiểm liên kết và cú pháp
```

Thêm bài mới → thêm tên tệp vào biến `TREE` trong `build.py`.

### Kiểm thử

```bash
python -m http.server 8788 --bind 127.0.0.1   # cửa sổ 1
python shot.py                                 # cửa sổ 2
```

`shot.py` dùng Chromium có sẵn (từ bộ cài Playwright) — **không cài thêm thư viện nào**.
Nó nạp trang bằng trình duyệt thật, xác nhận JavaScript chạy xong và dựng đúng nội dung,
rồi chụp ảnh vào `_shots/`.

---

## Quan hệ với trang [`samsung/web`](../../samsung/web/README.md)

Hai trang dùng **cùng một engine** (`app.js`, `app.css`), khác nhau ở:

| | `samsung/web` | `system-design/web` |
|---|---|---|
| Nội dung | khoá Heuristic + 2 ca nghiên cứu | khoá System Design + 6 đồ án |
| Màu nhấn | tím chàm `#5b4bd6` | xanh mòng két `#0e7490` |
| Cấu trúc `TREE` | 4 mục | 3 mục |

> ✅ Engine **đã được tách ra** [`courses/engine/`](../../engine/README.md) và dùng
> chung cho cả ba khoá. `app.js` / `app.css` ở đây là **bản sao** do
> `python engine/sync.py` chép xuống — đừng sửa tại chỗ. Khác biệt giữa các khoá
> nằm hết ở `assets/cau-hinh.js` và `assets/chu-de.css`.

---

## Ghi chú kỹ thuật

**Nội dung nhúng sẵn thay vì `fetch`** để mở được bằng `file://` — trình duyệt chặn
`fetch` trên giao thức này nhưng không chặn `<script src>`.

**Công thức toán được rút ra trước khi dựng markdown**, thay bằng thẻ giữ chỗ `<span>`
(không phải `<div>`) để công thức khối vẫn đặt được bên trong khối trích dẫn và ô bảng.

**Bỏ dấu tiếng Việt bằng bảng tra 1 ký tự → 1 ký tự**, giữ nguyên độ dài chuỗi nên vị trí
khớp dùng thẳng được cho bản gốc khi cắt trích đoạn và tô sáng.

**Biểu tượng dùng `<symbol viewBox="0 0 24 24">`**, không dùng `<g>`. Thiếu `viewBox` thì
trình duyệt vẽ hệ toạ độ 24×24 ở tỉ lệ 1:1 rồi cắt bớt — icon trông to và bị xén.

**Tránh `text-transform: uppercase` ở cỡ chữ nhỏ:** dấu thanh tiếng Việt nằm trên/dưới
chữ cái nên biến mất ở 10–11 px.

---

## Hai định dạng nội dung

`build.py` sinh **hai** file từ cùng một dữ liệu, cả hai đều là **file sinh ra** —
nguồn sự thật vẫn là các file `.md`:

| File | Dùng để | Vì sao cần |
|---|---|---|
| `assets/content.js` | **runtime** — trang web đọc | Mở bằng `file://` thì **không `fetch()` được** `.json`, nên nội dung phải đến bằng một thẻ `<script>`. Minify một dòng cho nhẹ. |
| `assets/content.json` | **công cụ** — đọc, diff, xử lý | Định dạng đẹp, thụt lề 2, khoá giữ nguyên thứ tự. Đổi một câu trong bài giảng thì diff chỉ hiện đúng dòng đó. **Trang web không dùng file này.** |

```bash
python build.py          # sinh cả hai, luôn khớp nhau
```

> ⚠️ **Đừng sửa `content.json` để cập nhật nội dung** — lần `build.py` sau sẽ ghi đè.
> Sửa file `.md` tương ứng rồi chạy lại `build.py`.

---

## Phụ lục trực quan

Khoá này có một trang mô phỏng tương tác riêng: [`../visual/`](../visual/README.md) — **8 demo**, thuật toán chạy thật trong trình duyệt, không thư viện ngoài.

```bash
cd ../visual
python -m http.server 8782 --bind 127.0.0.1
```
