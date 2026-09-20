# Web Lab trực quan

Phòng thí nghiệm cho những thứ **không hình dung nổi bằng chữ**: thuật toán, hệ
động lực, quy trình. Khác với ba trang `*-visual` kia — vốn là phụ lục của một
khoá học — trang này **đứng một mình**.

> **Không Node, không npm, không thư viện ngoài.** HTML + CSS + JavaScript thuần.
> Mọi thuật toán **chạy thật trong trình duyệt bạn**, không phải hoạt hình dàn dựng.

---

## Chạy

**Nhanh nhất:** nhấp đúp [`index.html`](index.html). Chạy được bằng `file://` vì
không có `fetch` nào.

```bash
python -m http.server 8792 --bind 127.0.0.1
# mở http://127.0.0.1:8792
```

---

## Lab

| Nhóm | Lab | Điều nó cho thấy |
|---|---|---|
| **Giả thuyết Collatz** | Collatz 3n+1 — bốn cách nhìn cùng một quy tắc | ① quỹ đạo · ② cây ngược · ③ hoa văn xếp chồng · ④ bản đồ thời gian dừng |

Bốn chế độ trong cùng một lab, đổi bằng ô chọn đầu tiên:

- **① Quỹ đạo** — một số, một hành trình. Tắt trục log để thấy vì sao cần trục log:
  một cái đỉnh duy nhất nuốt hết phần còn lại. `n = 27` → 111 bước, vọt lên 9232.
- **② Cây ngược** — nhìn từ đích. Nhánh `×2` luôn có nên cây dài; nhánh `(x−1)/3`
  hiếm nên cây phân nhánh thưa. Chứng minh Collatz ⇔ chứng minh cây này chạm tới
  mọi số nguyên dương.
- **③ Hoa văn** — mỗi quỹ đạo là một sợi; xếp chồng thì thân chung dày lên. Độ dày
  chính là số quỹ đạo đi qua đó.
- **④ Bản đồ** — ô càng đậm càng lâu về 1. Nếu thời gian dừng là ngẫu nhiên thì bản
  đồ phải là nhiễu trắng. Nó **không** — có vệt, có sọc.

---

## Dùng

| | |
|---|---|
| `Space` | chạy / tạm dừng |
| `→` | một bước |
| `R` | đặt lại |
| `F` | toàn màn hình |
| **Chép liên kết** | URL giữ nguyên **mọi tham số** đang xem — gửi cho người khác là họ thấy đúng thứ bạn thấy |
| **Lưu ảnh** | PNG khung hình hiện tại |
| **Ghi video** | `.webm` trong lúc chạy (trình duyệt nào hỗ trợ `captureStream` mới hiện nút) |
| **Tập trung** | ẩn mục lục, khung vẽ ăn hết bề ngang |

Cách dùng đúng: **trước khi kéo một thanh trượt, hãy dự đoán điều sẽ xảy ra.**

---

## Kiểm tra

```bash
python check.py --tinh     # tĩnh + chạy thật trên DOM giả (chỉ cần Python + Node)
python check.py            # thêm tầng Chromium, cần: pip install playwright
```

---

## Thêm lab mới

Engine nằm ở [`../engine/`](../engine/README.md) — **đừng sửa `assets/vis-core.js`
hay `assets/vis.css` ở đây**, chúng là bản sao, sửa xong chạy `sync.py` là mất.

1. Viết `assets/lab-<tên>.js`, chép khung của
   [`assets/lab-collatz.js`](assets/lab-collatz.js) (lab tham chiếu, dùng hết API).
2. Thêm `<script src="assets/lab-<tên>.js">` vào [`index.html`](index.html).
3. Khai báo nhóm mới trong `nhomThuTu` của [`assets/cau-hinh.js`](assets/cau-hinh.js)
   nếu muốn nó đứng đúng thứ tự (quên thì lab vẫn hiện, chỉ xếp sau).
4. `python check.py --tinh`.
