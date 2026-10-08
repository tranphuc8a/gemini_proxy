---
name: webapp-thuan
description: Quy ước làm ứng dụng web viết tay (JS/CSS thuần, không build, không thư viện) trong backend/fastapi/webapp — module thuần kiểm bằng node, khuôn kiem.js, mở bằng file://, PWA, kiểm bố cục bằng kiem-hinh.py, metadata.json. Dùng khi sửa/thêm app như quan-ly-chi-tieu, json-editor, chi-tieu, design-pattern, trang khoá học.
---

# Ứng dụng web viết tay

Nguồn = bản phục vụ; **không có bước build**. Mở được bằng `file://` (dữ liệu ở `localStorage`); khi phục vụ qua máy chủ thì
`window.__WEBAPP_CONFIG__.apiBase` cho biết gốc API. Không CDN/thư viện ngoài (ngoại lệ đã có: Pyodide, mermaid, KaTeX ở trang khoá học).

## Khuôn thư mục

```text
<app>/index.html          vỏ trang; nạp script theo thứ tự (module thuần trước, giao diện sau)
<app>/metadata.json       title, description, tags, icon (+ category tuỳ chọn) — cổng _portal đọc
<app>/assets/*.js|css     mã
<app>/kiem.js             kiểm bằng node (khuôn dưới); kiem-tat.js tự chạy mọi thư mục có kiem.js
```

## Mẫu module thuần (kiểm được bằng node)

```js
(function (root) {
  "use strict";
  var QL = root.QL || (root.QL = {});          // hoặc không gian tên của app
  /* … hàm thuần: không DOM, không storage, không đọc đồng hồ (nhận `today` làm tham số) … */
  QL.ten = { ham: ham };
  if (typeof module !== "undefined" && module.exports) module.exports = QL.ten;
})(typeof globalThis !== "undefined" ? globalThis : this);
```

Tách **logic** (tiền, ngày, gộp dữ liệu, tách câu, chọn kết quả) khỏi **giao diện**; logic được kiểm kỹ bằng `kiem.js`
(`kiem(tên, điều_kiện, chi_tiết)`, in `[ok]`/`[SAI]`, `process.exit(1)` khi sai). Phần dùng DOM (`ui.js`, `views.js`, `dialogs.js`, `app.js`)
chỉ chạy trong trình duyệt; kiểm bằng Playwright thật (Edge: `channel="msedge"`).

## An toàn và độ bền

- Mọi chuỗi từ người dùng/AI/dữ liệu vào `innerHTML` đi qua hàm thoát HTML (`esc`). Không `eval`/`new Function`.
- `localStorage` bọc try/catch (có thể bị chặn); chạy tiếp được khi không lưu được và nói rõ cho người dùng.
- Ghi cục bộ trước, đồng bộ sau (debounce); 409 → gộp theo bản ghi (LWW + bia mộ xoá) rồi thử lại. Hoàn tác = hàm ngược tạo bản ghi **mới hơn**.
- Tiền luôn số nguyên đồng (`money.allocate` chia phần dư lớn nhất, tổng luôn khớp). Ngày dạng `YYYY-MM-DD`, tính theo giờ máy.
- Kích thước: `quan-ly-chi-tieu` có trần 350 KB (kiểm tĩnh `selftest/static_checks.py`); các app khác nên gọn.

## PWA (chỉ `quan-ly-chi-tieu` và các trang khoá học)

`manifest.webmanifest` + `sw.js` ở **gốc app** (phạm vi = thư mục) + `pwa.js`. Service worker chỉ xử lý GET cùng origin dưới phạm vi app và **không bao giờ**
chạm API đồng bộ. Cài được cần HTTPS (hoặc máy chủ chạy trên máy). iOS: app màn hình chính có `localStorage` riêng.

## Kiểm bố cục

`backend/fastapi/.venv/Scripts/python.exe backend/fastapi/webapp/tranphuc8a/kiem-hinh.py <app> [--anh]` — Playwright: lỗi console, phần tử chồng nhau,
tràn ngang, bấm thử các tab/nút chính; ảnh vào `tranphuc8a/anh-kiem/`. Responsive tối thiểu 360 px không cuộn ngang; vùng chạm ≥ 44 px; tương phản chữ ≥ 4,5:1
cả sáng/tối; tôn trọng `prefers-reduced-motion`.

## Thêm app mới

Tạo thư mục (tên `[A-Za-z0-9_-]`) có `index.html` + `metadata.json` (thư mục chứa nhiều app con thì không có `index.html`: cổng gom thành "bộ sưu tập").
Thêm `kiem.js` để `kiem-tat.js` tự chạy. Cần API riêng: controller + use case + factory (xem skill `backend-fastapi`).
