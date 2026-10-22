# JSON Editor — thiết kế đợt nâng cấp: JSON Schema, xem trước khi gập, tìm kiếm/trình soạn, JSON lớn

Vùng: `backend/fastapi/webapp/tranphuc8a/json-editor` (app viết tay, JS thuần, không build, mở được bằng `file://`).
Pha: HIỂU + THIẾT KẾ. **Chưa sửa tệp nào trong repo.** Mọi số đo dưới đây chạy ngày 22/10/2026 trên máy chủ dự án
(Windows 10, Node 24.11, Edge 155.0.4283.62 qua Playwright `channel="msedge"`). Script đo nằm ở
`…/scratchpad/json-editor/` (`do-hieu-nang.js`, `do-trinh-duyet.py`, `do-phan-ra.py`, `nguyen-mau-quet.js`, `thu-loi.js`,
`thu-hoan-tac.py`, `thu-file.py`; `do-hieu-nang.js` sinh lại `mau-1MB.json`/`mau-10MB.json` theo seed 42).

Ký hiệu: **[đã kiểm]** = đọc mã có dẫn dòng hoặc chạy lệnh có kết quả; **[suy đoán]** = chưa chạy, cần xác nhận khi cài.

---

## 1. Hiện trạng

### 1.1 Tệp và kích thước [đã kiểm: `wc`]

| Tệp | Dòng | Byte | Vai trò |
| --- | --: | --: | --- |
| `index.html` | 129 | 5 545 | vỏ: thanh công cụ (dòng 19–30), 5 tab (33–39), các khung (43–113), chân trang (116–123), **một** script (127) |
| `assets/json-editor.js` | 2 205 | 86 757 | toàn bộ logic + giao diện trong **một IIFE**; hàm thuần phơi qua `window.JE_THU` (2159–2175) |
| `assets/kieu.css` | 453 | 15 958 | biến màu sáng/tối (4–68), soạn (178–260), cây (262–400) |
| `kiem.js` | 594 | 30 966 | nạp `json-editor.js` vào `vm` với DOM giả (16–79), **133 phép** trên hàm thuần |
| `metadata.json` | — | 1 652 | mô tả cho cổng `_portal` |

Không có `check.py`, không PWA, không API backend. `kiem-hinh.py json-editor` (Chromium thường, không phải Edge — `kiem-hinh.py:248`)
chỉ kiểm "không nổ / không chồng / không tràn": **10 phép đạt** [đã kiểm]. `node kiem.js`: **133 đạt** [đã kiểm].

### 1.2 Quy ước đặt tên [đã kiểm]

- Định danh và chú thích trong `json-editor.js`/`kieu.css`/`kiem.js`: **tiếng Việt không dấu** (`doc`, `veCay`, `xemTruoc`, `lichSu`,
  `.vung-soan`, `.lop-mau`). Chuỗi hiện cho người dùng: tiếng Việt có dấu.
- HTML escape: `thoat()` (`json-editor.js:375`); mọi chuỗi dữ liệu vào `innerHTML` đều qua `thoat`.
- Mã mới **giữ thói quen này** (CLAUDE.md: "theo đúng thói quen của tệp đang sửa"); tên từ khoá JSON Schema giữ tiếng Anh vì là dữ liệu.

### 1.3 Bản đồ module trong `json-editor.js` [đã kiểm]

| Mục | Dòng | Nội dung |
| --- | --- | --- |
| 1. Đọc và báo lỗi | 53–267 | `doc()` (150) gọi `JSON.parse`, đoán dòng/cột từ 4 dạng thông báo (`viTriLoi` 74); cột số dòng `veSoDong` (218) dựng **một `<div>` cho mỗi dòng**, gom khối 64 |
| 2. Biến đổi | 269–329 | `dinhDang(thut)` (272), `nen` (279), `sapKhoa` (288), `thoatChuoi` (299 — *gỡ* một lớp chuỗi), `sauKhiDoi` (324) |
| 3. Cây | 331–977 | trạng thái gập/mở theo đường dẫn (343), dựng lười nhánh gập (434–483) nhưng **mở nhánh là dựng hết mọi con** (473–483); sửa tại chỗ (`moSua` 816, `luuSua` 924), bàn phím ARIA tree (2094–2117) |
| 3b. Hàm thuần sửa theo đường dẫn | 979–1278 | `capNhatTai` sao nông đường đi (1020), `datTai/doiTenKhoa/themVao/xoaTai/diChuyen`, `doiKieu/docGiaTri`, `doThut` (1213), `vietTheoKieu` (1231), `anhXaDuong` (1244) |
| Xem trước nhánh gập | 1280–1359 | `truongNoiBat` (1309: name/title/ten/id…), `tomTatObject` (1324), `xemTruoc` (1338, ~60 ký tự) |
| 3c. Lịch sử | 1361–1417 | **ảnh chụp toàn văn bản** (100 bước, trần 40 M ký tự), `hoanTac/lamLai` |
| 4. Truy vấn | 1419–1517 | `truyVan` (1429): `$`, `.k`, `[n]`, `[*]`, `..k`, `['k']` |
| 5. So sánh | 1519–1586 | `khacNhau` (1526) so cây theo đường dẫn (mảng theo chỉ số) |
| 6. Thống kê | 1588–1628 | `veThongKe` (1591) |
| 7. Lưu nháp | 1630–1639 | `localStorage["json-editor:nhap"]`, **nuốt mọi lỗi** (1635) |
| 8. Tô màu cú pháp | 1641–1928 | lớp `<pre>` dưới textarea trong suốt; tô theo dòng; chỉ vẽ lại khối đổi (`capNhatHang` 1843); **tắt khi > 300 KB** (`GIOI_HAN_MAU` 1659) |
| 9. Nối dây | 1930–2205 | `khiNhap` (1934: `veSoDong` đồng bộ mỗi phím + `doc/veCay/luuNhap` debounce 180 ms), Tab chèn 2 dấu cách (1957–1969), phím tắt toàn trang (2141–2154) |

### 1.4 Các chế độ [đã kiểm]

| Chế độ | Có | Thiếu |
| --- | --- | --- |
| ✎ Soạn | textarea + lớp tô màu (≤ 300 KB), số dòng, đoán dòng/cột lỗi + gạch đỏ ký tự lỗi, "dòng, cột" ở chân trang | tìm/thay, đi tới dòng, gập, ngắt dòng tuỳ chọn (luôn `pre-wrap`, `kieu.css:214` → số dòng lệch khi dòng dài) |
| 🌳 Cây | dựng lười, sửa giá trị/kiểu/tên khoá, thêm/xoá/đổi chỗ, bàn phím, hoàn tác 100 bước, xem trước nhánh gập | tìm/thay, chia nhóm mảng lớn, kích thước nhánh |
| 🔎 Truy vấn | JSONPath tối giản, kết quả là văn bản `<pre>` | lọc, lát cắt, chỉ số âm, hợp; bấm kết quả để nhảy tới nút |
| ⇄ So sánh | diff cây (thứ tự khoá không tính) | bấm để nhảy; LCS cho mảng (ngoài phạm vi đợt này) |
| 📊 Thống kê | số nút, lá, object, mảng, độ sâu, kích thước, đếm theo kiểu | — |

### 1.5 Hoàn tác [đã kiểm]

- Cây: lịch sử riêng `lichSu` (ảnh chụp văn bản + trạng thái gập/mở + nút chọn). Ghi khi: sửa trên cây, Định dạng, Nén, Sắp khoá,
  Thoát chuỗi, Mở tệp (`ghiLichSu()` gọi ở 274, 281, 314, 646, 1975, 1988).
- Soạn: dùng hoàn tác gốc của textarea. **Gán `nhap.value` xoá ngăn hoàn tác gốc**, còn phím tắt hoàn tác của app chỉ chạy ở tab Cây
  (`if (oHien !== "cay" …) return;` dòng 2148). Kết quả **[đã kiểm, Playwright Edge]**: gõ `{"b":1,"a":[1,2]}` → bấm Định dạng → Ctrl+Z
  trong textarea: **không đổi gì**; phải sang tab Cây bấm "↶ Hoàn tác" mới về bản cũ (`thu-hoan-tac.py`).

### 1.6 Xem trước khi gập — hiện có [đã kiểm]

`htmlGiaTri` (390–401) hiện `{ }`/`[ ]` + "N khoá/phần tử" + `xemTruoc` (chỉ khi nhánh gập; CSS `kieu.css:321–326`).
Kết quả thật với `[{"id":1,"name":"Phúc","tags":[1,2]},{"id":2,"name":"An"}]`: xem trước
`['[0] name: "Phúc" …', 'name: "Phúc"', '1, 2', 'name: "An"']`, đếm `['2 phần tử','3 khoá','2 phần tử','2 khoá']`.
Không có: kích thước, kiểu phần tử của mảng, nhiều trường; **chế độ Soạn không gập được**.

### 1.7 Kiểm kê yêu cầu (3) "search, editor, format…" [đã kiểm]

| Tính năng | Soạn | Cây | Ghi chú |
| --- | --- | --- | --- |
| Tìm + tô sáng + trước/sau | ✗ (chỉ Ctrl+F của trình duyệt) | ✗ (nhánh gập chưa dựng DOM → Ctrl+F trình duyệt không thấy) | |
| Thay thế | ✗ | ✗ | |
| Regex | ✗ | ✗ | |
| Tìm theo đường dẫn/JSONPath | — | tab Truy vấn (tối giản, kết quả không bấm được) | lỗi: §2 #6, #9 |
| Đi tới dòng / đường dẫn | ✗ / ✗ | ✗ | |
| Định dạng 2/4/tab | chỉ 2 (`dinhDang(2)` dòng 1971; Ctrl+Shift+F) | sửa cây giữ thụt đang dùng (`doThut`) | |
| Thu gọn (minify) | ✓ Nén | — | |
| Sắp xếp khoá | ✓ nhưng ép thụt 2 (1977) và **mất khoá `__proto__`** | — | §2 #8 |
| Escape / unescape chuỗi | chỉ *gỡ* một lớp ("Thoát chuỗi" — tên dễ hiểu nhầm) | — | |
| Sửa JSON hỏng (phẩy thừa, nháy đơn, comment) | ✗ | — | |
| Số dòng | ✓ (lệch khi ngắt dòng mềm; chậm khi lớn) | — | §2 #1 |
| Dán JSON lớn | 1 MB treo 2,2 s; 10 MB treo 31 s | mở cây 10 MB 8,5 s | §2 #1–#4 |
| Gập mã + placeholder | ✗ | ✓ (xem trước ngắn) | |

### 1.8 Hiệu năng đo thật

**Node — hàm thuần của app** [đã kiểm: `node do-hieu-nang.js`; dữ liệu: mảng object lồng 3 cấp, thụt 2]

| Thao tác (ms) | 1 MB (1,24 M ký tự, 63 710 dòng) | 10 MB (12,37 M ký tự, 631 695 dòng) |
| --- | --: | --: |
| `JSON.parse` | 17 | 96 |
| `JSON.stringify(v,null,2)` / nén | 17 / 15 | 110 / 75 |
| `doThut` (chạy ở **mỗi** lần sửa trên cây) | 44 | 273 |
| `dem` (chạy ở **mỗi** `veCay`) | 31 | 205 |
| `truyVan $..name` | 29 | 111 |
| `khacNhau` | 99 | 981 |
| `toMau` toàn văn | 207 | — |
| một lần sửa trên cây (`datTai` + `vietTheoKieu`) | 78 | 725 |

**Edge 155 — trang thật** [đã kiểm: `do-trinh-duyet.py`, `do-phan-ra.py`]

| Thao tác | 1 MB | 10 MB |
| --- | --: | --: |
| gán `value` + sự kiện `input` (đồng bộ) | **3 398 ms** (riêng `input`: 2 162 ms → `veSoDong` dựng 64 706 thẻ) | **31 287 ms** |
| gõ một phím (trung vị, app) | 87–272 ms (272 khi debounce 180 ms rơi vào) | 2 268 ms |
| gõ một phím trong **textarea trần không listener** | 97–113 ms | **1 634 ms** |
| mở tab Cây (mặc định gập từ cấp 2) | 1 134 ms, 96 396 phần tử DOM | **8 484 ms, 955 451 phần tử DOM** |
| "Mở hết" | 8 156 ms, 592 625 phần tử DOM | (không đo — quá chậm) |
| sửa 1 giá trị trên cây (Enter → vẽ xong) | 923 ms | **13 403 ms** |
| quay lại tab Soạn | 2 053 ms | 23 562 ms |
| `localStorage.setItem` cả văn bản | 18 ms | **QuotaExceededError** (nháp không được lưu) |

Kết luận đo: textarea của trình duyệt **tự nó** đã tốn ~0,1 s/phím ở 1 MB và ~1,6 s/phím ở 10 MB, nên không thể "sửa thô 10 MB mượt"
bằng textarea; phải có **chế độ xem ảo** (chỉ dựng dòng nhìn thấy) + sửa qua cây / sửa khối. Phần chậm do app gây ra (số dòng, cây dựng hết,
`dem`/`doThut` lặp) sửa được.

**Nguyên mẫu thuật toán đề xuất** [đã kiểm: `node nguyen-mau-quet.js`, mã nháp không vào repo]

| Thuật toán | 1 MB | 10 MB |
| --- | --: | --: |
| `chiSoDong` (Uint32Array đầu dòng) | 6 ms | 65 ms |
| `quetKhoi` (quét ngoặc biết chuỗi → khối gập) | 11 ms (13 189 khối) | 121 ms (130 597 khối) |
| `doDaiByte` (UTF-8 của JSON nén, không tạo chuỗi; khớp `Buffer.byteLength`) | ~27 ms lần đầu*, 0 ms có cache | ~380 ms lần đầu*, 0 ms có cache |
| `timViTri(duong)` (vị trí văn bản của một đường dẫn) | 5–10 ms | 43–90 ms |

\* số in ra gồm cả `JSON.parse`; đã trừ ước lượng.

**Môi trường `file://` Edge** [đã kiểm: `thu-file.py`]: Worker tạo từ `Blob` chạy được (`ok 42`); IndexedDB ghi được 12 MB; localStorage chạy.
Backend không đặt CSP cho `/webapp/*` (`grep Content-Security-Policy` chỉ thấy `course_controller.py:451`) → Blob worker cũng chạy khi phục vụ qua máy chủ [đã kiểm bằng grep; chưa chạy qua máy chủ].

---

## 2. Phát hiện

| # | Mức | Phát hiện | Bằng chứng |
| --- | --- | --- | --- |
| 1 | cao | Dán/mở JSON lớn treo trang: 1 MB 3,4 s, 10 MB 31 s — `veSoDong` dựng 1 thẻ/dòng ngay trong sự kiện `input` | `json-editor.js:218–258, 1937`; đo `c_su_kien_input_dong_bo 2162`, `c_so_the_so_dong 64706` |
| 2 | cao | Textarea trần đã ~1,6 s/phím ở 10 MB → sửa thô tài liệu lớn bằng textarea là bất khả; cần chế độ xem ảo | `do-phan-ra.out.txt`: `go_textarea_tran 1634.1` |
| 3 | cao | Cây với mảng lớn: mở 8,5 s / 955 k phần tử DOM (10 MB); "Mở hết" 8,2 s (1 MB); sửa 1 ô 13,4 s (10 MB) — dựng mọi con, vẽ lại cả cây, `dem` + `doThut` mỗi lần | `json-editor.js:473–483, 485–512 (503), 645–651, 1213–1233` + bảng đo |
| 4 | cao | Bản nháp > ~5 MB **không lưu, không báo**; tải lại trang sẽ hiện bản nháp **cũ hơn** còn sót | `json-editor.js:1634–1636`; đo `QuotaExceededError`, `luu: 0` |
| 5 | vừa | Ctrl+Z ở Soạn không hoàn tác Định dạng/Nén/Sắp khoá/Thoát chuỗi/Mở tệp | `json-editor.js:2148`; Playwright: `hoan_tac_duoc: false` |
| 6 | vừa | Truy vấn trả thuộc tính nguyên mẫu: `$.toString`, `$.o.constructor` → function; `$.mang.length` → 3 (dùng `in`) | `json-editor.js:1481`; `thu-loi.js` |
| 7 | vừa | So sánh dùng `in`: `{constructor:1}` vs `{}` báo "đổi" thay vì "bớt"; `{}` vs `{toString:1}` báo "đổi" thay vì "thêm" | `json-editor.js:1539–1540`; `thu-loi.js` |
| 8 | vừa | Sắp khoá **làm mất khoá `__proto__`** (gán thường) và ép thụt 2 | `json-editor.js:292, 1977`; `thu-loi.js`: `{"b":1,"__proto__":{"x":1}}` → `{"b":1}` |
| 9 | vừa | JSONPath thiếu chỉ số âm, lát cắt, hợp, lọc, `..*`; `['a]b']` lỗi; đường dẫn kết quả không thoát (`$['a.b']` hiện `$.a.b`) | `json-editor.js:1429–1502`; `thu-loi.js` |
| 10 | vừa | Không có tìm/thay/regex/đi tới dòng/đường dẫn trong app | §1.7 |
| 11 | thấp | Xem trước nhánh gập thiếu kích thước, kiểu phần tử; Soạn không gập | `json-editor.js:390–401, 1338–1359` |
| 12 | thấp | Định dạng cố định 2; không có escape; không sửa JSON hỏng; Tab chèn 2 dấu cách bất kể kiểu thụt | `json-editor.js:1961, 1971` |
| 13 | thấp | `dem` đệ quy tràn ngăn xếp ở độ sâu 20 000 (JSON.parse vẫn đọc được) → `veCay` ném lỗi | `thu-loi.js`: `Maximum call stack size exceeded` |
| 14 | thấp | Phím Tab bị giữ trong textarea, không có đường thoát bằng bàn phím (WCAG 2.1.2) | `json-editor.js:1957–1969` |
| 15 | thấp | App chưa có kiểm chức năng trên trình duyệt thật; `kiem-hinh.py` dùng Chromium và chỉ kiểm "không nổ" | `kiem-hinh.py:173–213, 248` |

Có thể tham khảo (không chép mã, khác quy ước tên): thanh tìm/thay + đi tới dòng + tô vết theo vùng nhìn thấy của Code Studio
`code-studio/assets/ui/editor.js:395–470, 482–510` (chế độ không ngắt dòng → toạ độ dòng = `padT + i·lh`).

---

## 3. Thiết kế

### 3.0 Nguyên tắc

1. Không thư viện ngoài, không CDN. Mọi thuật toán tự viết; **không `eval`/`new Function`** (bộ lọc JSONPath tự phân tích).
2. Logic tách thành **module thuần** (kiểm bằng node), giao diện nói chuyện với lõi qua một "cổng" `JE_APP`.
3. Văn bản trong `#nhap` vẫn là nguồn sự thật duy nhất (giữ triết lý hiện tại, `json-editor.js:17–23`).
4. Tài liệu lớn: chỉ dựng phần nhìn thấy; việc O(n) chạy lười / chia lát / trong Worker.
5. Mỗi tính năng giao diện có phép kiểm Edge thật trong `check.py` mới.

### 3.1 Cấu trúc module mới

```text
json-editor/
  index.html                 nạp theo thứ tự: je-chung → (module thuần) → json-editor (lõi) → ui-*
  assets/
    je-chung.js      [mới]   không gian JE + sổ nguồn JE_NGUON (cho Worker) + tiện ích thuần dùng chung
    tom-tat.js       [mới]   tomTatNut, doDaiByte, demNut (cache WeakMap); xemTruoc/truongNoiBat chuyển sang đây
    vi-tri.js        [mới]   con trỏ JSON ⇄ vị trí văn bản, đường dẫn tại con trỏ, quét khối gập, lint khoá trùng/số mất chính xác
    tim-kiem.js      [mới]   tìm/thay trong văn bản và trong cây giá trị
    jsonpath.js      [mới]   JSONPath (tập con RFC 9535) + cú pháp cũ + JSON Pointer
    sua-json.js      [mới]   sửa JSON hỏng thành danh sách sửa nhỏ nhất
    schema-format.js [mới]   kiểm + sinh các format (date-time, email, uuid…)
    schema-kiem.js   [mới]   biên dịch + kiểm JSON Schema (2020-12, tương thích draft-07/06/04)
    regex-sinh.js    [mới]   phân tích tập con regex ECMAScript → sinh chuỗi khớp
    schema-sinh.js   [mới]   sinh dữ liệu mẫu ngẫu nhiên có seed theo schema
    schema-suy.js    [mới]   suy ra schema từ dữ liệu
    chay-nen.js      [mới]   chạy kiểm/sinh trong Worker từ Blob, có hạn giờ; dự phòng luồng chính
    json-editor.js   [sửa]   lõi hiện có + cổng JE_APP + hoàn tác thống nhất + số dòng/tô màu ảo + cây chia nhóm
    ui-xem.js        [mới]   chế độ Xem ảo của tab Soạn: số dòng, tô màu, gập khối + placeholder, sửa khối
    ui-tim.js        [mới]   thanh tìm/thay (Soạn + Xem + Cây), đi tới dòng/đường dẫn
    ui-sua.js        [mới]   hộp "Sửa JSON hỏng" (xem trước → áp dụng)
    ui-schema.js     [mới]   tab Schema: soạn schema, kiểm, danh sách lỗi, sinh mẫu, suy schema
    kieu.css         [sửa]
  kiem.js            [sửa]   giữ 133 phép cũ; nạp thêm kiem/*.js; nhận bộ lọc `node kiem.js schema`
  kiem/chung.js      [mới]   nạp các tệp assets theo thứ tự index.html vào vm (DOM giả hiện có), hàm kiem/bang
  kiem/*.js          [mới]   vi-tri, tom-tat, tim-kiem, jsonpath, sua-json, schema-1..3, regex-sinh, schema-sinh, schema-suy, chay-nen
  check.py           [mới]   Edge thật: --tinh | --chuc-nang | --hieu-nang [MB] | --file | --tat-ca
  HUONG-DAN-SCHEMA.md [mới]  bảng từ khoá hỗ trợ / không hỗ trợ, giới hạn sinh mẫu
```

**Khuôn module thuần** (đăng ký nguồn để gửi sang Worker mà không cần `fetch` — `fetch` tệp bị chặn trên `file://`):

```js
(function (khai) {
  khai(typeof globalThis !== "undefined" ? globalThis : this);
  var g = typeof globalThis !== "undefined" ? globalThis : this;
  (g.JE_NGUON || (g.JE_NGUON = [])).push(khai);      // chay-nen.js ghép "(" + f + ")(self);" thành Blob
})(function (root) {
  "use strict";
  var JE = root.JE || (root.JE = {});
  /* … hàm thuần: không DOM, không storage, không đồng hồ … */
  JE.viTri = { timViTri: timViTri /* … */ };
  if (typeof module !== "undefined" && module.exports) module.exports = JE.viTri;
});
```

**Cổng `JE_APP`** (thêm vào cuối `json-editor.js`, dùng bởi `ui-*.js`):

```js
window.JE_APP = {
  layVanBan(), layDuLieu(), hopLe(),                    // trạng thái hiện tại (đã doc() đúng văn bản đang có)
  datVanBan(sMoi, { nhan, giuChon, viTriChon }),         // MỌI lần máy ghi văn bản đi qua đây: ghi lịch sử + sauKhiDoi()
  apDungGoc(gocMoi, phep, duongChon, nhan),              // sửa theo mô hình (đang có: apDung) + nhãn bước
  denDuong(duong, { tab: "cay"|"soan"|"tu-dong", chon: "gia-tri"|"khoa" }),  // mở tổ tiên/nhóm, focus, tô nháy
  denViTri(bd, kt),                                      // chọn đoạn trong textarea hoặc Xem, cuộn tới
  denDong(n),
  dangKy(suKien, ham),     // "doi-du-lieu" (sau mỗi doc()), "doi-tab", "doi-chon" (con trỏ đổi)
  thongBao(chu, loai),     // chân trang / thông báo cây
  hangSo: { NGUONG_XEM, NHOM_CON, … }
};
```

### 3.2 Hoàn tác thống nhất (sửa phát hiện #5)

- `datVanBan` = `ghiLichSu({nhan})` → `nhap.value = sMoi` → `mayVuaGhi = true` → `sauKhiDoi()`. Định dạng, Nén, Sắp khoá, Gỡ/Đóng chuỗi,
  Mở tệp, Thay tất cả, Sửa JSON hỏng, Dùng dữ liệu mẫu, Sửa khối đều đi qua đây. `lichSu` thêm trường `nhan` ("Định dạng"…), nút ↶/↷
  có `title="Hoàn tác: Định dạng"`.
- Nút ↶ ↷ chuyển lên thanh công cụ đầu trang (dùng chung mọi tab; giữ `#cay-hoan-tac/#cay-lam-lai` làm bí danh để test cũ còn đúng).
- Ctrl+Z trong textarea: `keydown` đặt `choHoanTac = true`; `beforeinput` có `inputType === "historyUndo"` đặt lại `false` (trình duyệt tự lo);
  `setTimeout(0)`: nếu vẫn `true` ⇒ ngăn hoàn tác gốc không còn gì ⇒ gọi `hoanTac()` của app. Tương tự Ctrl+Y / Ctrl+Shift+Z với `historyRedo`.
  [suy đoán: Chrome/Edge không phát `beforeinput historyUndo` khi ngăn trống — phải kiểm ở check.py trước khi dựa vào; nếu sai, dùng cờ
  `mayVuaGhi` (đặt `false` ở `input` do người gõ) làm điều kiện.]
- Lịch sử vẫn là ảnh chụp văn bản (app không đồng bộ nhiều thiết bị nên quy tắc "hàm ngược" của dự án không áp dụng); trần 40 M ký tự giữ nguyên.

### 3.3 Tài liệu lớn và trình soạn

**Hằng số** (đặt ở `JE_APP.hangSo`, test đọc lại được):

| Hằng | Giá trị đề xuất | Lý do |
| --- | --- | --- |
| `NGUONG_XEM` | 1,5 MB ký tự | textarea 1,3 MB ≈ 0,1 s/phím (đo); trên mức này mở mặc định ở chế độ Xem |
| `GIOI_HAN_MAU_BOC` | 300 KB (giữ) | tô màu khi **có** ngắt dòng mềm (đường cũ, vẽ toàn văn) |
| `NHOM_CON` | 100 | cây chia nhóm `[0 … 99]` khi nhánh > 100 con |
| `NGUONG_MO_HET` | 20 000 nút | "Mở hết" quá ngưỡng thì hỏi / chỉ mở tới cấp 3 |
| `NGUONG_KIEM_TU_DONG` | 1 MB | tự kiểm schema mỗi lần sửa; lớn hơn thì bấm "Kiểm" |
| `TRAN_KET_QUA` | 10 000 | trần kết quả tìm / truy vấn / lỗi schema hiển thị |
| `DONG_DAI_TOI_DA` | 5 000 ký tự | Xem cắt dòng quá dài, hiện "… (+N ký tự)" |

**A. Số dòng ảo + không ngắt dòng mặc định** (sửa #1)
- `#nhap`/`.lop-mau`: `white-space: pre` mặc định; nút "↩ Ngắt dòng" (Alt+Z), nhớ ở `localStorage["json-editor:ngat-dong"]`.
- Không ngắt dòng ⇒ dòng `i` nằm ở `padT + i·lh` (lấy `lh` từ `getComputedStyle`). `#so-dong` chỉ chứa ~`ceil(h/lh)+20` thẻ đặt trong một khối
  `transform: translateY(...)`; tổng số dòng đếm bằng vòng `indexOf` (đã đo 4,5 ms/1 MB) trong `requestAnimationFrame`, không trong `input`.
  Dòng lỗi tô theo chỉ số. Có ngắt dòng ⇒ giữ đường cũ (số dòng theo dòng thật, ghi rõ giới hạn đã biết).
- Mục tiêu: sự kiện `input` sau khi dán 1 MB < 50 ms (trước: 2 162 ms).

**B. Lớp tô màu ảo** — khi không ngắt dòng: chỉ tô các dòng nhìn thấy (+20 dòng đệm) bằng `toMauDong` hiện có (hàm thuần, không đổi);
`haiChamSau` tính lười cho dòng nhìn thấy (nhìn tối đa 50 dòng tiếp). Trần tô màu nâng từ 300 KB lên `NGUONG_XEM`. Có ngắt dòng ⇒ đường cũ.

**C. Chế độ Xem (tab Soạn có hai mặt "✎ Sửa | 👁 Xem")** — `ui-xem.js`
- Bộ dựng ảo chỉ đọc: `chiSo = vi-tri.chiSoDong(s)` (Uint32Array); `dsHien: Int32Array` = các dòng thật đang hiện (bỏ dòng trong khối gập),
  dựng lại O(n) khi gập/mở (≈ vài ms với 631 k dòng). Khung cuộn có khối đệm cao `dsHien.length·lh`; nếu > 15 000 000 px (giới hạn Firefox ≈ 17,9 M)
  thì đổi tỉ lệ cuộn (ánh xạ tuyến tính scrollTop → dòng).
- Mỗi khung hình dựng ~60 hàng: số dòng · mũi tên gập · nội dung `toMauDong` (cắt `DONG_DAI_TOI_DA`). Bấm đúp / Enter trên hàng ⇒ sang Sửa
  đúng vị trí (nếu văn bản ≤ `NGUONG_XEM`), còn lớn hơn thì mở "Sửa khối".
- Tự vào Xem khi văn bản > `NGUONG_XEM` + băng thông báo: "Tài liệu lớn (12,4 MB): đang ở chế độ Xem — sửa trên Cây hoặc 'Sửa khối'. [Vẫn sửa
  văn bản thô (chậm)]". Văn bản nén một dòng > 1 MB: băng "Một dòng 10 MB — bấm Định dạng để xem và gập".
- **Sửa khối** (tài liệu lớn): trên hàng mở khối, nút "✎ Sửa khối" mở hộp textarea chỉ chứa đoạn `[bd, kt)` của khối; Lưu ⇒ kiểm
  `JSON.parse(đoạn)` (nếu tài liệu đang hợp lệ) ⇒ `datVanBan(s.slice(0,bd) + moi + s.slice(kt))` — **giữ nguyên định dạng phần còn lại**.

**D. Lưu nháp bền** (sửa #4): `luuNhap` bắt `QuotaExceededError` ⇒ `removeItem(KHOA)` (không để bản cũ sống lại) + ghi
`json-editor:nhap-qua-lon = {kichThuoc, luc}` + băng cảnh báo "Bản nháp 12,4 MB quá lớn để tự lưu — hãy Tải về". Tuỳ quyết định Q7:
văn bản > 2 MB lưu vào IndexedDB (`json-editor`/`nhap`, đã thử ghi 12 MB trên `file://`), localStorage chỉ giữ cờ. Ghi nháp lớn dùng debounce 1 s.

**E. Cây cho dữ liệu lớn** (sửa #3)
- Nhánh có > `NHOM_CON` con: dựng các **nút nhóm** `[0 … 99]`, `[100 … 199]` (object: "khoá 1–100") gập sẵn; nhóm là `treeitem` (có
  `aria-level`, phím mũi tên đi qua bình thường). Trạng thái mở nhóm lưu ở `trangThaiNhom[khoaDuong(cha) + "#" + i]`; `anhXaDuong` cho xoá/chuyển
  chỉ số tự kéo nhóm theo. Hàm thuần mới: `chiaNhom(soCon, co) → [{bd, kt}]`, `nhomCua(chiSo, co)`.
- `dem` viết lại **lặp** (không đệ quy, sửa #13) và cache theo object (`WeakMap`) — `capNhatTai` sao nông nên nhánh không đổi giữ nguyên
  danh tính ⇒ cache sống qua các lần sửa.
- "Mở hết" khi tổng nút > `NGUONG_MO_HET`: hỏi "Dựng 50 521 nút (~8 s)? [Mở tới cấp 3] [Vẫn mở hết]".
- Sửa một ô trên cây với tài liệu > `NGUONG_XEM`: thay vì `vietTheoKieu` cả tài liệu, dùng `vi-tri.timViTri` để **ghép chuỗi tại chỗ** đoạn giá
  trị (giữ định dạng, O(vị trí)); `doThut` chỉ đoán trên 200 dòng đầu.
- Mục tiêu 10 MB: mở tab Cây < 800 ms, < 20 000 phần tử DOM; sửa 1 ô < 1,5 s.

### 3.4 `vi-tri.js` — con trỏ JSON ⇄ vị trí văn bản

```text
chiSoDong(s) → Uint32Array                       đầu mỗi dòng
dongCuaViTri(chiSo, i) → số dòng (tìm nhị phân)
timViTri(s, duong) → {khoaBd, khoaKt, bd, kt} | null     duong = mảng khoá/chỉ số; quét từ đầu, nhảy qua giá trị bằng đếm ngoặc biết chuỗi
timNhieuViTri(s, dsDuong) → Map(khoaDuong → {…})          MỘT lượt quét cho nhiều đích (cây tiền tố các đường dẫn) — dùng cho lỗi schema
duongTaiViTri(s, i) → {duong, vungGiaTri}                 đường dẫn tại con trỏ (thanh trạng thái, "gập khối tại con trỏ")
taoBoQuetKhoi() → { chay(s, nganSachKyTu) → xong? , ketQua() }   quét chia lát (≈2 M ký tự/lát), giữ ngăn xếp giữa các lát
   ketQua: soKhoi; mỗi khối k: dongMo[k], dongDong[k], viTriMo[k], viTriDong[k], loai[k] (1 object, 2 mảng), sau[k], cha[k],
           soCon[k], khoaBd[k]/khoaKt[k] (khoá trong cha) hoặc chiSo[k]; khoiCuaDong: Int32Array (khối mở ở dòng đó, -1)
   duongCuaKhoi(k) → đi ngược cha[] (giải mã khoá lười bằng JSON.parse lát cắt)
loiNhe(s) → [{loai:"khoa-trung"|"so-lam-tron", bd, kt, thongBao}]   khoá trùng (JSON.parse lặng lẽ giữ cái sau) và số > 2^53 / số mất chữ số
```

Chịu được JSON hỏng: `taoBoQuetKhoi` không ném lỗi (ngoặc lệch thì bỏ qua), dùng được cho Xem khi tài liệu đang lỗi.
Mục tiêu (nguyên mẫu đã đo): quét khối 10 MB ≈ 120 ms, `timViTri` ≤ 90 ms ở cuối 10 MB.

### 3.5 Gập → xem trước / metadata (yêu cầu 2)

`tom-tat.js`:

```text
tomTatNut(v, { gioiHan = 60 }) → {
  kieu: "object"|"array", so,                     // số khoá / phần tử
  byte,                                           // doDaiByte(v): UTF-8 của JSON NÉN (đúng bằng Buffer.byteLength(JSON.stringify(v)))
  khoaDau: ["id","name","email"],                 // object: tối đa 3 khoá đầu
  noiBat: 'name: "Phúc"',                         // truongNoiBat (đã có)
  kieuCon: "object×2 100, null×8",                // mảng: đếm kiểu phần tử (lấy mẫu tối đa 1 000 phần tử, ghi "≈" nếu lấy mẫu)
  xemTruoc: '[0] name: "A" …',                    // xemTruoc (đã có)
  nut, sau                                        // demNut lười (cache) — chỉ cho tooltip
}
doDaiByte(v)   cache WeakMap theo object; đếm byte thoát chuỗi đúng như JSON.stringify (", \\, ký tự điều khiển 2/6 byte, UTF-8 2–4 byte)
dinhDangByte(n) → "740 B" | "3,4 KB" | "7,08 MB"   (dùng lại coChu, dấu phẩy thập phân kiểu vi)
```

**Cây** (nhánh gập): `{ } 12 khoá · 3,4 KB  name: "Phúc" · id, email, …` — số và kích thước chữ nhỏ màu `--m-mo`; `title`/`aria-label` đầy đủ:
"object · 12 khoá · 3 482 byte khi nén · sâu 3 cấp · 57 nút · khoá: id, name, email, tags, …". Mảng: `[ ] 2 108 phần tử · 1,2 MB · object×2 100, null×8 · [0] name: "A" …`.
Hộp kiểm "Kích thước" cạnh "Hiện kiểu" (nhớ). Kích thước chỉ tính cho **hàng đang hiển thị** (lười, cache).

**Soạn — chế độ Xem**: hàng mở khối đang gập hiện `"items": [⟨ 2 108 phần tử · 1,2 MB · object×2 100 ⟩]`; placeholder là `<button>` (bấm ⇒ mở),
lấy số liệu từ mô hình qua `duongCuaKhoi(k)` khi JSON hợp lệ; khi JSON lỗi chỉ có `soCon` từ bộ quét + "≈ N ký tự".
Lệnh: mũi tên ▸/▾ ở rãnh, "Gập tới cấp: 1 2 3 4 | Mở hết", Ctrl+Shift+[ / ] (từ Sửa: gập khối chứa con trỏ ⇒ chuyển sang Xem, cuộn tới đó).

### 3.6 Tìm kiếm, thay thế, đường dẫn, định dạng (yêu cầu 3)

**`tim-kiem.js`** (thuần):

```text
taoRegex(q, {hoaThuong, caTu, regex}) → RegExp("…", "gu" + (hoaThuong?"":"i")) | {loi}
timTrongVanBan(s, q, tuyChon, tran=20000) → [{bd, kt}]           (bỏ khớp rỗng, như code-studio)
thayTrongVanBan(s, dsKhop|q, thay, tuyChon) → {s, soThay}        ($1… khi regex)
timTrongGiaTri(goc, q, {phamVi:"khoa"|"gia-tri"|"ca-hai", kieu:[…], …}, tran) → [{duong, noi:"khoa"|"gia-tri", bd, kt}]
   duyệt LẶP theo thứ tự tài liệu (= thứ tự hiện trên cây); giá trị so trên giaTriNgan (chuỗi không nháy, số dạng String)
thayTrongGiaTri(goc, dsKhop, thay, tuyChon) → {goc, soThay, boQua:[{duong, lyDo}]}
   chỉ thay chuỗi giá trị và tên khoá (đổi tên trùng ⇒ bỏ qua + báo); một lần apDungGoc ⇒ một bước hoàn tác
```

**`ui-tim.js`** — một thanh dùng chung (Ctrl+F tìm, Ctrl+H thay, F3/Shift+F3, Esc đóng): ô tìm · `Aa` · `ab|` · `.*` · "3/120" · ↑ ↓ ·
ô thay · "Thay" · "Thay tất cả"; ở Cây thêm chọn phạm vi Khoá/Giá trị/Cả hai.
- Soạn/Sửa: khớp tô bằng lớp tô màu ảo (chỉ vùng nhìn thấy), khớp hiện tại = vùng chọn textarea + `denViTri`. Văn bản > 300 KB khi đang ngắt dòng:
  chỉ chọn + cuộn (không tô).
- Xem: tô trên hàng đang dựng; nhảy tới khớp tự mở các khối gập chứa dòng đó (`khoiCuaDong` → `cha`).
- Cây: nhảy = mở tổ tiên + nhóm chứa chỉ số, dựng dần (không `veCay` toàn bộ), focus, `<mark>` trong `.khoa`/`.gt` (thoát HTML trước, chèn
  `<mark>` theo `bd/kt` sau); các hàng khác đang hiển thị có khớp cũng tô (tra `Set` khoá đường dẫn O(1)).
- Ctrl+G "Đi tới dòng" (Soạn/Xem). Regex chạy trên luồng chính (giống code-studio), trần 20 000 khớp.

**`jsonpath.js`** — tập con RFC 9535, giữ cú pháp cũ:

```text
phanTich(chuoi) → AST | ném {thongBao, cot}     chấp nhận: $  .ten  ['ten']  ["t\"en"]  [0]  [-1]  [1:5:2]  [0,2]  ['a','b']  .*  [*]
                                                ..ten  ..*  ..[0]  [?(@.gia < 10 && @.tags)]  [?@.ten == 'A']  JSON Pointer "/a/0"
                                                thiếu "$" ở đầu vẫn nhận ("a.b" ⇒ "$.a.b")
bieuThuc lọc: || && ! ( )  == != < <= > >=  =~ /regex/  ;  toán hạng: chuỗi, số, true/false/null, @…, $…;
              hàm length() count() match() search() value()  (ngữ nghĩa "Nothing" theo RFC 9535 §2.3.5)
chay(goc, chuoiHoacAst, tran) → [{duong:[…], v, chuan:"$['items'][3]", hien:"$.items[3]"}]
```
Chỉ thuộc tính **riêng** (`hasOwnProperty`) — sửa #6. `truyVan` cũ thành lớp bọc trả `{d: hien, v}` để giữ phép kiểm cũ.
**UI Truy vấn**: danh sách kết quả (đường dẫn + xem trước một dòng) — bấm ⇒ `denDuong` (Cây hoặc Văn bản, theo nút); "Tô trên cây"; "Chép kết quả (JSON)".

**Đi tới đường dẫn + đường dẫn tại con trỏ**: ô nhỏ ở thanh trạng thái nhận `$.a[0]` hoặc `/a/0` ⇒ `denDuong`. Ở Soạn, con trỏ đứng yên 300 ms ⇒
`duongTaiViTri` (bỏ qua khi > `NGUONG_XEM`) ⇒ hiện `$.items[3].email` + nút chép (JSON Pointer / JSONPath).

**Định dạng và chuỗi**: nút "⇥ Định dạng" + chọn `2 | 4 | Tab` (nhớ `json-editor:thut`, Ctrl+Shift+F dùng lựa chọn); Sắp khoá giữ kiểu thụt đang có
và dùng `datKhoa` (giữ `__proto__`, sửa #8); "⌫ Gỡ chuỗi" (tên mới của Thoát chuỗi) và "⎘ Đóng thành chuỗi" (`JSON.stringify(text)`), cả hai áp lên
**vùng chọn** nếu có; trên cây, giá trị chuỗi chứa JSON object/mảng có thao tác "{ } Giải chuỗi lồng" (và ngược lại "Đóng thành chuỗi").
Tab trong textarea chèn theo kiểu thụt đang dùng; Esc rồi Tab thì rời ô (sửa #14).

**`sua-json.js`** — sửa JSON hỏng:

```text
suaJson(s, { gopNhieuGiaTri:false }) → { vanBan, sua:[{bd, kt, thay, dong, cot, moTa}], conLoi: null | {dong, cot, thongBao} }
```
1. Tiền xử lý: BOM; rào markdown ```` ```json … ``` ````; JSONP `ten(...)`/`ten(...);`; `var x = …;`.
2. Tách từ tố khoan dung (giữ `[bd,kt)`): ngoặc, `:` `,`, chuỗi `"…"`/`'…'`, số (cả `+1`, `.5`, `5.`, `0x1F`, `NaN`, `Infinity`), định danh
   (`true/false/null/True/False/None/undefined`/khoá không nháy), chú thích `//…`, `/*…*/`, `#…`.
3. Đệ quy xuống có phục hồi, phát **sửa nhỏ nhất**: bỏ chú thích · nháy đơn → nháy kép (thoát lại) · thoát xuống dòng/tab thô trong chuỗi · `\'`/`\x41` →
   hợp lệ · thêm nháy cho khoá · `True/False/None/undefined` → `true/false/null/null` · `NaN/Infinity` → `null` (cảnh báo mất giá trị) ·
   chuẩn số (`+1`→`1`, `.5`→`0.5`, `5.`→`5`, `0x1F`→`31`, `007`→`7`) · bỏ phẩy thừa trước `}`/`]` · thêm phẩy thiếu giữa hai giá trị · thêm `:` thiếu ·
   bỏ ngoặc đóng thừa · thêm ngoặc đóng thiếu ở cuối (đúng thứ tự ngăn xếp) · tuỳ chọn gộp nhiều giá trị gốc (NDJSON) thành mảng.
4. Áp từ cuối lên đầu ⇒ **bố cục của người dùng giữ nguyên**; `JSON.parse` lại; còn lỗi thì trả `conLoi`.
Bất biến test: JSON hợp lệ ⇒ `sua` rỗng và `vanBan === s`; sửa hai lần = sửa một lần.
**`ui-sua.js`**: khi JSON lỗi, chân trang có "🩹 Sửa lỗi" ⇒ hộp liệt kê "dòng 3: Bỏ dấu phẩy thừa" (bấm ⇒ tới chỗ) + xem trước trước/sau quanh mỗi chỗ ⇒
"Áp dụng" (`datVanBan`, một bước hoàn tác).

### 3.7 JSON Schema — kiểm (yêu cầu 1a)

**Draft**: chuẩn chính **2020-12**; tương thích **2019-09, draft-07, 06, 04** (chọn theo `$schema` của schema gốc: chứa `draft-04/06/07` ⇒ chế độ 07,
`2019-09` ⇒ 2019, còn lại/không có ⇒ 2020-12; người dùng ép được trong UI). Không `$schema` mà `items` là mảng ⇒ hiểu kiểu draft-07 + cảnh báo.

**API** (`schema-kiem.js`, không gian `JE.schema`):

```text
bienDich(schema, { draft:"tu-dong"|"2020-12"|"2019-09"|"07", thuVien:{[$id]: schema} }) → BD
   BD = { goc, che, bangNut: Map(uri#conTro → nút), neo: Map(uri#ten → nút), id: WeakMap(nút → số), canChuThich: bool,
          loiSchema:[LoiSchema], canhBao:[LoiSchema] }
kiem(duLieu, bdHoacSchema, { format:"canh-bao"|"loi"|"bo-qua", toiDa:200, dungSom:false }) →
   { hopLe, loi:[Loi], canhBao:[Loi], catBot:bool, thoiGianMs }
kiemNut(nutSchema, giaTri, bd, conTroGoc) → {hopLe, loi}         // dùng bởi bộ sinh (kiểm cục bộ một nhánh)
tuKhoaHoTro → [{tu, draft, ghiChu}]                              // UI + HUONG-DAN-SCHEMA.md đọc từ đây
Loi = { conTro:"/items/3/email", duong:["items",3,"email"], hien:"$.items[3].email",
        conTroSchema:"#/properties/items/items/properties/email/format", tuKhoa:"format",
        thongBao:"Không phải email hợp lệ: “abc”", muc:"loi"|"canh-bao", chiTiet:{…}, con:[Loi]? }   // con: lỗi của nhánh anyOf/oneOf
LoiSchema = { conTroSchema, thongBao, goiY? }   // ví dụ: "Từ khoá lạ “requried” — có phải “required”?"
```

**Biên dịch**: đi khắp schema, gán số cho từng nút (WeakMap), ghi `#`+JSON Pointer của mọi nút con, `$anchor` (và `$dynamicAnchor`),
`$id` tương đối giải theo URI cơ sở của cha (bộ giải URI tối giản theo RFC 3986 §5.2). `$ref` giải lười + cache. Ref ngoài tài liệu: tìm trong
`thuVien` theo `$id`; không có ⇒ lỗi schema "Không tải được $ref ngoài (ứng dụng chạy offline)". Con trỏ: giải mã `~1`→`/`, `~0`→`~`, phần trăm.
Lint schema (thay cho meta-schema): kiểu giá trị từ khoá (`required` mảng chuỗi duy nhất, `minimum` số, `pattern` biên dịch được với cờ `u`,
`type` thuộc 7 tên…); từ khoá lạ ⇒ cảnh báo + gợi ý bằng khoảng cách Levenshtein ≤ 2 tới từ khoá đã biết.

**Đánh giá**: hàm `danhGia(nut, v, ngucanh, conTro, conTroSchema) → {ok, loi, chuThich?}` (chuThich = `{khoa: Set|true, phanTu: số|true, chua: Set}` chỉ
khi `canChuThich` — schema có `unevaluated*`). Chống vòng: ngăn xếp cặp `(id nút, conTro)`; gặp lại ⇒ lỗi "Vòng $ref không tiến vào dữ liệu" (schema
đệ quy theo dữ liệu như cây vẫn chạy). Cache regex, cache ref. Trần `toiDa` lỗi ⇒ `catBot: true`.

**Từ khoá hỗ trợ** (ký hiệu thông báo, giá trị dài cắt bằng `catNgan`):

| Từ khoá | Ghi chú ngữ nghĩa | Thông báo (mẫu) |
| --- | --- | --- |
| `true`/`false` (schema boolean) | | "Schema false: không giá trị nào hợp lệ ở đây" |
| `type` (chuỗi/mảng) | `integer` = số không phần lẻ (1.0 là integer) | "Sai kiểu: cần string, đang là number (42)" |
| `enum`, `const` | bằng nhau sâu (khoá riêng, không kể thứ tự khoá) | "Chỉ nhận một trong: "a", "b", "c"" · "Phải bằng đúng 5" |
| `properties`, `patternProperties`, `additionalProperties` | additional = khoá không khớp properties/pattern | "Khoá “foo” không được phép (additionalProperties: false)" — con trỏ trỏ tới **khoá** |
| `required` | con trỏ = object cha; `chiTiet.khoa` | "Thiếu khoá bắt buộc “email”" |
| `propertyNames` | kiểm tên khoá như chuỗi | "Tên khoá “Foo” không hợp lệ: …" |
| `minProperties`/`maxProperties` | | "Cần ít nhất 2 khoá, đang có 1" |
| `prefixItems` + `items` (2020-12); `items` mảng + `additionalItems` (07/2019) | `items:false` sau tuple | "Thừa phần tử [3] (chỉ cho phép 3 phần tử theo prefixItems)" |
| `minItems`/`maxItems` | | "Cần ít nhất 1 phần tử, đang có 0" |
| `uniqueItems` | khoá chuẩn hoá (sắp khoá) ⇒ Map, O(n) | "Phần tử [4] trùng với [1]" |
| `contains`, `minContains`, `maxContains` | `minContains: 0` hợp lệ | "Không phần tử nào khớp contains" · "Cần ≥ 2 phần tử khớp contains, có 1" |
| `minimum`/`maximum`/`exclusiveMinimum`/`exclusiveMaximum` | dạng số (06+) và dạng boolean (04) | "Phải ≥ 0, đang là -1" · "Phải > 0" |
| `multipleOf` | nhân thang thập phân theo số chữ số lẻ của cả hai rồi so nguyên; quá 15 chữ số ⇒ sai số tương đối 1e-12 | "Phải là bội của 0.01" |
| `minLength`/`maxLength` | đếm **code point** (cặp surrogate = 1) | "Cần ít nhất 3 ký tự, đang có 2" |
| `pattern` | `new RegExp(p, "u")`, tìm (không neo) | "Không khớp mẫu ^[A-Z]{3}$" |
| `format` | date-time, date, time, duration, email, idn-email, hostname, idn-hostname, ipv4, ipv6, uri, uri-reference, iri, iri-reference, uuid, regex, json-pointer, relative-json-pointer, uri-template; format lạ ⇒ bỏ qua + ghi chú. Mức theo tuỳ chọn `canh-bao` (mặc định đề xuất) / `loi` / `bo-qua` | "Không phải email hợp lệ" · "Không phải ngày giờ RFC 3339" |
| `allOf` | gộp lỗi các nhánh sai | |
| `anyOf` | sai hết ⇒ một lỗi tổng + `con` = lỗi nhánh "gần đúng nhất" (ít lỗi nhất, đường dẫn sâu nhất) xếp đầu | "Không khớp lựa chọn nào trong anyOf (3)" |
| `oneOf` | khớp 0 hoặc ≥ 2 | "Khớp 2 lựa chọn (#0, #2) trong oneOf — chỉ được đúng một" |
| `not` | | "Không được khớp schema trong not" |
| `if`/`then`/`else` | lỗi then/else kèm tiền tố | "Vì khớp điều kiện if: …" |
| `$ref`, `$defs`, `definitions`, `$anchor`, `$id` | 2020-12: anh em của `$ref` vẫn áp dụng; ≤ 07: bị bỏ qua (cảnh báo) | "Không tìm thấy $ref “#/defs/x”" |
| `dependentRequired`, `dependentSchemas`, `dependencies` (07) | | "Có “credit_card” thì phải có “billing_address”" |
| `unevaluatedProperties`, `unevaluatedItems` | **làm** (việc riêng, Q4): chú thích từ properties/pattern/additional/items/prefixItems/contains và từ nhánh **đúng** của allOf/anyOf/oneOf/if-then-else/dependentSchemas/$ref | "Khoá “x” không được khai báo ở đâu (unevaluatedProperties: false)" |
| `$dynamicRef`/`$recursiveRef` | xấp xỉ: giải như `$ref` tĩnh tới `$dynamicAnchor` cùng tài nguyên + cảnh báo "hỗ trợ một phần" | |
| `title`, `description`, `default`, `examples`, `deprecated`, `readOnly`, `writeOnly`, `$comment`, `content*` | chú thích, không kiểm (`default`/`examples` dùng cho bộ sinh) | |

**Format** (`schema-format.js`, dùng chung kiểm + sinh): date-time RFC 3339 (`T`/`Z` không phân biệt hoa thường, kiểm ngày thật kể cả 29/02 năm nhuận,
giây 60 cho phép), date, time (bắt buộc múi giờ như bộ test 2020-12), duration ISO 8601, email (dot-atom/quoted local @ hostname hoặc `[IP]`),
hostname RFC 1123 (nhãn 1–63, tổng ≤ 253), ipv4 (không số 0 dẫn đầu), ipv6 (dạng nén `::` và IPv4 nhúng), uri (tuyệt đối, ký tự RFC 3986),
uri-reference, uuid (8-4-4-4-12), regex (`new RegExp(s,"u")`), json-pointer, relative-json-pointer; idn-*/iri-* xấp xỉ (cho phép Unicode).

**Hiệu năng & an toàn**: kiểm 1 MB mục tiêu < 300 ms, 10 MB < 3 s [suy đoán — đo ở việc 22]. `pattern` do người dùng viết có thể quay lui thảm hoạ
(ReDoS) ⇒ kiểm/sinh chạy trong **Worker từ Blob** (`chay-nen.js`) có hạn giờ 8 s ⇒ `terminate()` + thông báo "Kiểm quá lâu — có thể do pattern quay lui
thảm hoạ"; không có Worker ⇒ luồng chính (văn bản ≤ 1 MB) kèm cảnh báo.

**`chay-nen.js`**: `taoTho()` ghép `JE_NGUON.map(f => "(" + f + ")(self);")` + vòng nhận tin ⇒ `Blob` ⇒ `new Worker(URL.createObjectURL(...))`;
`chay(loai, duLieu, hanMs) → Promise` (loai: `kiem` | `sinh` | `suy`); mỗi lệnh có số thứ tự, bỏ kết quả cũ khi lệnh mới tới; dữ liệu gửi đi là **văn bản**
(Worker tự `JSON.parse`, tránh chép cấu trúc 10 MB hai lần) [suy đoán về lợi ích — đo ở việc 25].

**UI tab "✓ Schema"** (`ui-schema.js`, tab thứ 6 sau Truy vấn; thanh tab đã cuộn ngang `kieu.css:121–127`):

```text
[📂 Mở schema] [Ví dụ ▾] [✨ Suy ra từ dữ liệu] [⇥ Định dạng] | Draft [Tự động ▾] Format [Cảnh báo ▾] [☑ Tự kiểm] [✓ Kiểm ngay]
┌ Schema (textarea + số dòng, lỗi JSON/lint ở dưới) ─┬ [Lỗi dữ liệu (3)] [Sinh dữ liệu mẫu] ─────────────────────────┐
│ { "$schema": "https://json-schema.org/…",          │ ⛔ $.items[3].email  Không phải email hợp lệ: “abc”  [Cây][Văn bản] │
│   "type": "object", …                              │ ⛔ $  Thiếu khoá bắt buộc “meta”                    ▸ schema: #/required │
└────────────────────────────────────────────────────┴───────────────────────────────────────────────────────────┘
```
- Màn hẹp (≤ 720 px): hai khung xếp dọc. Danh sách lỗi là `<ul>` các `<button>`; bấm hàng ⇒ `denDuong` tới tab dùng gần nhất (mặc định Cây);
  nút [Cây]/[Văn bản] chọn rõ; "▸ schema" ⇒ chọn đúng từ khoá trong ô schema (`vi-tri.timViTri` trên văn bản schema).
- Vị trí văn bản cho cả danh sách lỗi tính bằng **một lượt** `timNhieuViTri` (lười, khi bấm "Văn bản" lần đầu).
- Cây: hàng có lỗi có viền đỏ trái + huy hiệu "⛔ 2" (`title` = các thông báo); tra `Map(khoaDuong → [Loi])`.
- Chân trang (mọi tab): huy hiệu "Schema ✓" / "Schema: 3 lỗi" / "Schema hỏng" — bấm ⇒ tab Schema.
- Tự kiểm sau mỗi `doi-du-lieu` (debounce 400 ms) khi văn bản ≤ `NGUONG_KIEM_TU_DONG`.
- **Lưu cạnh dữ liệu**: `json-editor:schema` (văn bản schema, như bản nháp dữ liệu), `json-editor:schema-tuy-chon` ({draft, format, tuDong, sinh}).
  Mở tệp có `$schema` của json-schema.org (hoặc có `properties`/`$defs` ở gốc mà không có dữ liệu khác) ⇒ thông báo "Tệp này trông như schema —
  [Mở làm schema]". (Thư viện nhiều schema + `$ref` chéo theo `$id`: để đợt sau, Q9.)

### 3.8 JSON Schema — sinh dữ liệu mẫu (yêu cầu 1b)

**PRNG có seed**: `taoRng(seed)` — băm chuỗi seed bằng cyrb53 ⇒ mulberry32; API `soThuc() soNguyen(a,b) chon(ds) tron(ds) xacSuat(p)`.
Cùng seed + cùng schema + cùng tuỳ chọn ⇒ **cùng kết quả** (test). Seed mặc định hiện trong ô, nút 🎲 đổi seed.

```text
sinhMau(schema|bd, { seed, soLuong:1, tiLeTuyChon:0.5, doSauToiDa:6, mangToiDa:5, dungViDu:0.3, thuLai:20, draft, thuVien }) →
  { giaTri,                       // soLuong > 1 ⇒ mảng các mẫu
    hopLe, loi:[Loi],             // kết quả validator trên đầu ra cuối
    khongDamBao:[{conTroSchema, lyDo}],   // phần không đảm bảo được, nói rõ
    soLanThu, seed }
```

Thuật toán `sinh(nut, ngucanh)` (ngucanh: rng, độ sâu, ngăn xếp ref, con trỏ):
1. `$ref` ⇒ giải; độ sâu > `doSauToiDa` hoặc ref đã có ≥ 2 lần trong ngăn xếp ⇒ **chế độ tối thiểu**: object chỉ khoá bắt buộc, mảng `minItems`,
   nhánh anyOf/oneOf ưu tiên nhánh không chứa ref về tổ tiên (phân tích trước khi sinh) hoặc nhánh nguyên thuỷ/`null`.
2. `const` ⇒ trả; `enum` ⇒ chọn (khi cần duy nhất thì chọn không lặp); `examples`/`default` hợp lệ ⇒ dùng với xác suất `dungViDu`.
3. Chọn kiểu: `type` ∩ kiểu suy từ `enum/const`; không có `type` ⇒ suy từ từ khoá (properties ⇒ object, items ⇒ mảng, pattern/minLength ⇒ chuỗi,
   minimum ⇒ số), không suy được ⇒ chọn ngẫu nhiên nguyên thuỷ.
4. Số: miền [lo, hi] từ minimum/maximum/exclusive* (thiếu biên thì quanh biên còn lại ±100, không biên ⇒ [0, 1000]); `multipleOf m` ⇒ chọn k ∈
   [ceil(lo/m), floor(hi/m)] rồi `k·m` làm tròn theo số chữ số lẻ của m; miền rỗng ⇒ `khongDamBao` "minimum > maximum".
5. Chuỗi: `pattern` ⇒ `regex-sinh` (điều chỉnh độ dài theo min/maxLength); `format` ⇒ bộ sinh format; không có ⇒ ghép từ trong kho từ tiếng Việt/ASCII
   cho đủ độ dài (đếm code point). Có cả pattern và format ⇒ sinh theo pattern rồi kiểm format, thử lại.
6. Mảng: n ∈ [minItems, min(maxItems, minItems + mangToiDa)]; `prefixItems` trước, phần còn lại theo `items` (`items:false` ⇒ n = độ dài tuple);
   `contains` ⇒ đặt ≥ `minContains` (mặc định 1) phần tử sinh từ gộp(items, contains) ở vị trí ngẫu nhiên; `maxContains` ⇒ các phần tử khác phải không
   khớp contains (kiểm, thử lại); `uniqueItems` ⇒ tập khoá chuẩn hoá, sinh lại phần tử trùng tối đa K lần; không đủ giá trị khác nhau ⇒ `khongDamBao`.
7. Object: khoá = required ∪ (mỗi property tuỳ chọn với xác suất `tiLeTuyChon`) ∪ bao đóng `dependentRequired`; thiếu `minProperties` ⇒ thêm property tuỳ
   chọn, rồi khoá sinh theo `patternProperties` (regex-sinh), rồi khoá thêm theo `additionalProperties`/`propertyNames` (tên `khoa_1`… phải qua
   propertyNames); thừa `maxProperties` ⇒ bỏ khoá tuỳ chọn; `dependentSchemas` của khoá có mặt ⇒ gộp vào.
8. Tổ hợp: `allOf` ⇒ **gộp** (properties hợp, required hợp, min lấy lớn nhất, max lấy nhỏ nhất, type/enum giao, pattern ⇒ giữ tất cả để kiểm) rồi sinh;
   xung đột ⇒ `khongDamBao`. `anyOf` ⇒ trộn nhánh, sinh gộp(cha, nhánh), nhận cái đầu tiên hợp lệ với cả nút. `oneOf` ⇒ như anyOf nhưng chỉ nhận khi
   **đúng một** nhánh khớp. `not` ⇒ sinh phần còn lại, nhận khi không khớp `not`. `if/then/else` ⇒ tung đồng xu: sinh gộp(cha, if, then) nhận khi khớp
   if và then, hoặc gộp(cha, else) nhận khi không khớp if; hỏng ⇒ thử nhánh kia.
9. Mỗi nút: sinh ⇒ `kiemNut` cục bộ ⇒ sai thì thử lại tối đa 8 lần (rút số ngẫu nhiên mới). Cuối cùng kiểm **toàn bộ**; sai ⇒ thử lại cả mẫu với seed
   dẫn xuất `seed#1…#thuLai`; vẫn sai ⇒ trả lần ít lỗi nhất + `hopLe:false` + `loi`.

**`regex-sinh.js`**:

```text
phanTich(nguon) → { ast, khongHoTro:[…] } | ném {thongBao, cot}
sinhChuoi(ast, rng, { lapToiDa:8, doDaiMin, doDaiMax, nhom }) → chuỗi
sinhTheoMau(nguon, rng, tuyChon) → { chuoi, khop, canhBao }      // khop kiểm bằng new RegExp(nguon, "u").test
```
Hỗ trợ: ký tự thường, thoát `\d \w \s \D \W \S \t \n \r \. \\ \uXXXX \u{…} \xXX`, lớp `[a-z0-9_]`/`[^…]`, `.`, nhóm bắt/không bắt/đặt tên, `|`,
`* + ? {n} {n,} {n,m}` (kể cả lười), neo `^ $`, tham chiếu ngược `\1 \k<ten>`, `\p{L}`/`\p{N}` xấp xỉ bằng tập mẫu. Không hỗ trợ (bỏ qua khi sinh rồi kiểm
lại, ghi `khongHoTro`): nhìn trước/nhìn sau `(?= (?! (?<= (?<!`, `\b \B` (xấp xỉ). Vũ trụ ký tự cho `.`/lớp phủ định: ASCII in được + vài chữ tiếng Việt.
Mẫu không neo: chuỗi khớp đầy đủ vẫn chứa một khớp ⇒ hợp lệ; thiếu độ dài thì đệm ký tự ngẫu nhiên phía không neo. Độ dài: tính trước `minLen/maxLen`
từng nút AST để chọn số lần lặp trong ngân sách.

**UI "Sinh dữ liệu mẫu"** (khung phải tab Schema): seed [____] 🎲 · số mẫu [1] · khoá tuỳ chọn [50 %] · độ sâu [6] · [Sinh] ⇒ xem trước có tô màu +
báo cáo: "✔ Hợp lệ theo schema (2 lần thử)" hoặc "⚠ Không đảm bảo: #/properties/code/pattern dùng nhìn trước (?=…)"; nút [Dùng làm dữ liệu]
(`datVanBan`, một bước hoàn tác) · [Chép] · [Tải về] · [Sinh lại seed+1]. Chạy qua `chay-nen`.

### 3.9 Suy ra schema từ dữ liệu (điểm cộng)

```text
suySchema(duLieu, { draft:"2020-12"|"07", chat:false, batBuoc:"moi-lan-xuat-hien"|"khong", enumToiDa:0, dinhDang:true,
                    mauToiDa:1000, dongKhoaThem:false }) → schema
```
Hai bước: (1) **tóm tắt gộp** theo đường dẫn — đếm kiểu; object: khoá → {số lần có mặt, tóm tắt con}; mảng: tóm tắt phần tử gộp, độ dài min/max (lấy mẫu
đều tối đa `mauToiDa` phần tử, tất định); chuỗi: cờ "mọi mẫu khớp format X", tập giá trị khác nhau (có trần), độ dài; số: integer?, min/max.
(2) **phát schema**: nhiều kiểu nguyên thuỷ ⇒ `type: ["string","null"]`; object lẫn mảng ⇒ `anyOf`; `required` = khoá có mặt ở mọi object cùng vị trí;
`chat:true` thêm min/max, minLength/maxLength, `enum` khi ≤ `enumToiDa` giá trị khác nhau; `dongKhoaThem` ⇒ `additionalProperties:false`. Có `$schema`.
Bất biến test: `kiem(duLieu, suySchema(duLieu)).hopLe === true` với mọi bộ dữ liệu test (và với mẫu 1 MB).
UI: nút "✨ Suy ra từ dữ liệu" (hỏi trước khi ghi đè schema đang có; ghi bằng `execCommand("insertText")` để Ctrl+Z trong ô schema hoàn tác được).

### 3.10 Lưu trữ (localStorage, mọi lần đọc/ghi bọc try/catch)

| Khoá | Nội dung |
| --- | --- |
| `json-editor:nhap` (có) | văn bản dữ liệu (≤ ~5 MB; lớn hơn ⇒ IndexedDB hoặc chỉ cờ, Q7) |
| `json-editor:nhap-qua-lon` | `{kichThuoc, luc}` khi không lưu được |
| `json-editor:sang` (có) | giao diện |
| `json-editor:ngat-dong`, `json-editor:thut`, `json-editor:cay-kich-thuoc` | tuỳ chọn trình soạn / cây |
| `json-editor:schema`, `json-editor:schema-tuy-chon` | schema + tuỳ chọn kiểm/sinh |

---

## 4. Danh sách việc (theo thứ tự phụ thuộc; mỗi việc một lượt cài + kiểm)

Kích cỡ: S ≈ < 200 dòng, M ≈ 200–600 dòng, L > 600 dòng (đã chia nhỏ để không còn L).

| # | Việc | Tệp | Kiểm | Cỡ |
| --- | --- | --- | --- | --- |
| 1 | Sửa 5 lỗi đã xác minh: `vaoKhoa`/`khacNhau` dùng `hasOwnProperty` (#6, #7); `chayTruyVan` không nổ khi giá trị không stringify được; `sapKhoa` dùng `datKhoa` + giữ kiểu thụt (`doThut`) (#8); `dem` viết lặp (#13) | `assets/json-editor.js`, `kiem.js` | phép mới: `$.toString`/`$.o.constructor`/`$.mang.length` không khớp; diff `{constructor:1}` vs `{}` = "bot"; sắp khoá giữ `__proto__` + thụt 4; `dem` độ sâu 20 000; 133 phép cũ vẫn đạt | S |
| 2 | Hạ tầng: `je-chung.js` (JE, `JE_NGUON`, `coRieng`, `catNgan`, `moTaDuong`, `conTroSangDuong`/`duongSangConTro`, `bangNhauSau`, `khoaChuan`); `kiem/chung.js` nạp mọi script theo thứ tự `index.html`; `kiem.js` chạy `kiem/*.js` + bộ lọc đối số; cổng `JE_APP`; `check.py` khung (`--tinh`: thứ tự script, `node --check` mọi asset, ngân sách ≤ 400 KB assets, không URL ngoài, không `eval`/`new Function`) | `index.html`, `assets/je-chung.js`, `assets/json-editor.js`, `kiem.js`, `kiem/chung.js`, `kiem/je-chung.js`, `check.py` | `node kiem.js` đạt; `check.py --tinh` đạt; `kiem-hinh.py json-editor` 10 phép | M |
| 3 | Hoàn tác thống nhất: `datVanBan`, nhãn bước, nút ↶↷ ở đầu trang (bí danh nút cũ), Ctrl+Z/Y ở Soạn rơi về lịch sử app (`beforeinput historyUndo`) | `assets/json-editor.js`, `index.html`, `kieu.css`, `check.py` | Edge: gõ → Định dạng → Ctrl+Z trong textarea ⇒ về bản trước; gõ thêm sau Định dạng ⇒ Ctrl+Z gỡ chữ vừa gõ trước rồi mới tới Định dạng; Ctrl+Y làm lại | M |
| 4 | Số dòng ảo + `white-space: pre` mặc định + nút/Alt+Z "Ngắt dòng" (nhớ); đếm dòng ra khỏi sự kiện `input` | `assets/json-editor.js` (§số dòng, §nối dây), `kieu.css`, `index.html`, `check.py --hieu-nang` | Edge: `input` sau khi gán 1 MB < 50 ms (trước 2 162); số thẻ trong `#so-dong` < 200; dòng lỗi tô đúng sau khi cuộn; ngắt dòng bật ⇒ hành vi cũ | M |
| 5 | Lớp tô màu ảo khi không ngắt dòng (chỉ dòng nhìn thấy, `haiChamSau` lười); trần tô màu = `NGUONG_XEM` | `assets/json-editor.js` (§8), `kieu.css`, `kiem.js` | node: `toMau` cũ không đổi (phép cũ); Edge: 1 MB có tô màu, khớp từng ký tự với textarea ở đầu/giữa/cuối (so toạ độ caret với span), gõ 1 phím 1 MB p50 < 150 ms | M |
| 6 | Lưu nháp bền: bắt quota, xoá bản cũ, cờ + băng cảnh báo; (Q7) IndexedDB cho > 2 MB; debounce nháp lớn | `assets/json-editor.js` (§7), `index.html`, `check.py` | Edge: dán 10 MB ⇒ có cảnh báo, tải lại không hiện bản cũ (hoặc hiện đúng bản 10 MB nếu IndexedDB); localStorage bị chặn ⇒ app vẫn chạy | S |
| 7 | Cây chia nhóm 100 con, nút nhóm là treeitem, trạng thái nhóm qua `anhXaDuong`; `dem` cache WeakMap; chặn "Mở hết" > 20 000; sửa ô tài liệu lớn bằng ghép chuỗi tại chỗ (sau việc 8 thì bật) | `assets/json-editor.js` (§3, §3b), `kieu.css`, `kiem.js` (`chiaNhom`, `nhomCua`), `check.py` | node: chiaNhom/nhomCua/anhXa nhóm; Edge: mở Cây 10 MB < 800 ms và < 20 000 phần tử DOM; phím ↑↓→← qua nhóm; xoá phần tử trong nhóm giữ focus đúng | M |
| 8 | `vi-tri.js`: `chiSoDong`, `dongCuaViTri`, `timViTri`, `timNhieuViTri`, `duongTaiViTri`, `taoBoQuetKhoi` (chia lát), `duongCuaKhoi`, `loiNhe` | `assets/vi-tri.js`, `index.html`, `kiem/vi-tri.js` | node: đối chiếu `timViTri` với `JSON.parse(lát cắt)` cho mọi đường dẫn của 50 JSON ngẫu nhiên (khoá có `"`, `\`, Unicode, `__proto__`); quét khối khớp đếm ngoặc; chia lát cho kết quả giống quét một lần; JSON hỏng không ném; 10 MB quét < 300 ms | M |
| 9 | `tom-tat.js`: `tomTatNut`, `doDaiByte` (WeakMap), `demNut`, `dinhDangByte`; chuyển `xemTruoc`/`truongNoiBat` sang, `JE_THU` re-export | `assets/tom-tat.js`, `assets/json-editor.js`, `index.html`, `kiem/tom-tat.js` | node: `doDaiByte(v) === Buffer.byteLength(JSON.stringify(v))` trên 200 giá trị ngẫu nhiên (emoji, ký tự điều khiển, ` `); phép xemTruoc cũ vẫn đạt | S |
| 10 | Cây: metadata nhánh gập (số · kích thước · kiểu con · xem trước), tooltip + `aria-label` đầy đủ, hộp kiểm "Kích thước" | `assets/json-editor.js` (`htmlGiaTri`, `nhanNut`), `kieu.css`, `index.html`, `check.py` | Edge: nhánh gập hiện "12 khoá · 3,4 KB"; mở ra thì ẩn; 360 px không tràn ngang; `kiem-hinh.py` đạt | S |
| 11 | `ui-xem.js` phần 1: khung Xem ảo chỉ đọc (số dòng, tô màu từng dòng, cắt dòng dài, đổi tỉ lệ cuộn), nút "Sửa ⇄ Xem" giữ vị trí, tự vào Xem > `NGUONG_XEM`, băng tài liệu lớn / một dòng | `assets/ui-xem.js`, `assets/json-editor.js` (JE_APP), `index.html`, `kieu.css`, `check.py` | Edge: 10 MB mở Xem < 1,5 s; cuộn tới cuối: mỗi khung < 50 ms; bấm đúp dòng N ⇒ Sửa ở đúng dòng N (≤ ngưỡng) | M |
| 12 | `ui-xem.js` phần 2: gập khối (quét chia lát), mũi tên ở rãnh, placeholder `tomTatNut` (JSON lỗi ⇒ `soCon`), "Gập tới cấp N / Mở hết", Ctrl+Shift+[ ] từ Sửa | `assets/ui-xem.js`, `kieu.css`, `check.py` | Edge: gập `items` 10 MB < 50 ms, số dòng sau khối đúng; placeholder đúng số phần tử + byte; JSON hỏng vẫn gập được | M |
| 13 | Sửa khối trong Xem (hộp sửa đoạn, ghép chuỗi, kiểm parse, một bước hoàn tác) | `assets/ui-xem.js`, `assets/json-editor.js`, `check.py` | Edge: 10 MB sửa một khối ⇒ phần còn lại giữ nguyên byte-cho-byte; Ctrl+Z về bản trước | S |
| 14 | `tim-kiem.js`: `taoRegex`, `timTrongVanBan`, `thayTrongVanBan`, `timTrongGiaTri`, `thayTrongGiaTri` | `assets/tim-kiem.js`, `index.html`, `kiem/tim-kiem.js` | node: khớp rỗng không lặp vô hạn; regex sai ⇒ `{loi}`; cả từ với tiếng Việt; thay `$1`; thứ tự kết quả cây = thứ tự tài liệu; đổi tên khoá trùng ⇒ bỏ qua có báo | M |
| 15 | `ui-tim.js` cho Soạn + Xem: Ctrl+F/H, F3, Aa/ab\|/.*, đếm, tô (lớp màu ảo / hàng Xem), thay một/tất cả (một bước hoàn tác), Ctrl+G tới dòng | `assets/ui-tim.js`, `index.html`, `kieu.css`, `check.py` | Edge: 1 MB tìm "Hà Nội" đếm đúng, F3 cuộn tới; Thay tất cả ⇒ Ctrl+Z một lần về cũ; Xem: nhảy tới khớp trong khối gập tự mở | M |
| 16 | `ui-tim.js` cho Cây: phạm vi khoá/giá trị, mở tổ tiên + nhóm, `<mark>` (thoát HTML trước), trước/sau, thay giá trị/đổi tên khoá hàng loạt | `assets/ui-tim.js`, `assets/json-editor.js` (render có tô), `kieu.css`, `check.py` | Edge: tìm khớp nằm trong nhánh gập sâu + nhóm [200…299] ⇒ hiện và focus; chuỗi `<img onerror>` trong dữ liệu không thực thi; thay tất cả = 1 bước hoàn tác | M |
| 17 | `jsonpath.js` (RFC 9535 tập con + cú pháp cũ + JSON Pointer, chỉ khoá riêng, đường dẫn chuẩn hoá); `truyVan` cũ bọc lại | `assets/jsonpath.js`, `assets/json-editor.js`, `index.html`, `kiem/jsonpath.js` | node: bảng ≥ 60 biểu thức (lấy ví dụ trong RFC 9535 §1.5 + ca biên: `['a]b']`, `[-1]`, `[::-1]`, lọc so sánh chuỗi/số, Nothing); phép truyVan cũ đạt | M |
| 18 | UI Truy vấn (kết quả bấm được ⇒ Cây/Văn bản, tô trên cây, chép) + ô "Đi tới đường dẫn" + đường dẫn tại con trỏ ở chân trang (chép Pointer/JSONPath) | `assets/ui-tim.js` hoặc `assets/json-editor.js` (§4), `index.html`, `kieu.css`, `check.py` | Edge: bấm kết quả `$.items[1500].email` ⇒ focus đúng nút trong nhóm; ở Soạn chọn đúng đoạn giá trị; con trỏ trong giá trị ⇒ chân trang hiện đúng đường dẫn | S |
| 19 | Định dạng 2/4/Tab (nhớ), Ctrl+Shift+F theo lựa chọn; Gỡ chuỗi (đổi tên) + Đóng thành chuỗi, áp lên vùng chọn; thao tác cây "Giải chuỗi lồng"; Tab theo kiểu thụt, Esc+Tab thoát ô | `assets/json-editor.js`, `index.html`, `kieu.css`, `kiem.js`, `check.py` | node: đóng rồi gỡ = bản gốc; Edge: định dạng tab, vùng chọn; `kiem-hinh.py` vẫn bấm được nút tên "Định dạng" | S |
| 20 | `sua-json.js` | `assets/sua-json.js`, `index.html`, `kiem/sua-json.js` | node: ≥ 30 ca hỏng có đáp án chính xác (phẩy thừa, nháy đơn, chú thích 3 kiểu, khoá không nháy, Python literal, NaN, thiếu phẩy, thiếu ngoặc, JSONP, rào markdown, BOM, xuống dòng thô); bất biến: JSON hợp lệ không đổi, sửa hai lần = một lần; 1 MB hỏng < 500 ms | M |
| 21 | `ui-sua.js`: nút "🩹 Sửa lỗi" khi JSON lỗi ⇒ hộp xem trước danh sách sửa ⇒ Áp dụng | `assets/ui-sua.js`, `index.html`, `kieu.css`, `check.py` | Edge: dán JSON có phẩy thừa + chú thích ⇒ Sửa lỗi ⇒ hợp lệ, bố cục giữ nguyên; Ctrl+Z về bản hỏng | S |
| 22 | `schema-kiem.js` phần 1: `bienDich` (draft, `$id`/`$anchor`/`$ref` cục bộ + `thuVien`, con trỏ, chống vòng), lint schema + gợi ý gõ sai; từ khoá type/enum/const, số, chuỗi (code point, pattern), mảng (prefixItems/items/min/max/unique/contains), object (properties/pattern/additional/required/propertyNames/min/max); `Loi` + thông báo tiếng Việt | `assets/je-chung.js`, `assets/schema-kiem.js`, `index.html`, `kiem/schema-1.js` | node: ≥ 150 ca dạng `{schema, tests:[{data, valid}]}` + kiểm `conTro`/`conTroSchema`/`tuKhoa` của lỗi; ref vòng `{"$ref":"#"}` ⇒ lỗi chứ không treo; 1 MB < 300 ms (in số đo) | M |
| 23 | `schema-format.js` + phần 2: allOf/anyOf/oneOf/not (best-match + `con`), if/then/else, dependentRequired/dependentSchemas/dependencies, format 3 mức, tương thích 07/04 (items mảng, additionalItems, anh em `$ref`, exclusive boolean) | `assets/schema-format.js`, `assets/schema-kiem.js`, `index.html`, `kiem/schema-2.js` | node: ≥ 150 ca (mỗi format ≥ 5 đúng + 5 sai, gồm 29/02, ipv6 nén, email quoted); cùng schema chạy chế độ 07 và 2020-12 cho kết quả đúng chuẩn từng bản | M |
| 24 | Phần 3 (Q4): chú thích + `unevaluatedProperties`/`unevaluatedItems`; `$dynamicRef`/`$recursiveRef` xấp xỉ + cảnh báo | `assets/schema-kiem.js`, `kiem/schema-3.js` | node: ≥ 50 ca (unevaluated qua allOf/anyOf/if-then-else/$ref, nhánh sai không đóng góp, lồng nhau); không chậm hơn > 15 % khi schema không có unevaluated | M |
| 25 | `chay-nen.js`: Worker từ Blob (`JE_NGUON`), hạn giờ + terminate, bỏ kết quả cũ, dự phòng luồng chính | `assets/chay-nen.js`, `index.html`, `kiem/chay-nen.js`, `check.py` | node: mô phỏng worker (chạy mã blob trong vm, gửi/nhận tin); Edge (`file://` và http): kiểm với pattern `(a+)+$` trên chuỗi dài ⇒ hết giờ có thông báo, trang không treo | S |
| 26 | `ui-schema.js`: tab Schema (soạn, mở/dán/ví dụ/định dạng, lưu, draft/format/tự kiểm), danh sách lỗi ⇒ Cây/Văn bản/vị trí trong schema, huy hiệu lỗi trên cây, huy hiệu chân trang, phát hiện tệp schema khi Mở | `assets/ui-schema.js`, `index.html`, `kieu.css`, `check.py` | Edge: dán schema + dữ liệu sai ⇒ 3 lỗi đúng; bấm lỗi ⇒ nút đúng có focus (Cây) / đoạn đúng được chọn (Văn bản); sửa dữ liệu ⇒ tự kiểm lại; 360 px xếp dọc không tràn; tải lại giữ schema; `kiem-hinh.py` (tab mới) đạt | M |
| 27 | `regex-sinh.js` | `assets/regex-sinh.js`, `index.html`, `kiem/regex-sinh.js` | node: ≥ 80 mẫu × 20 seed: chuỗi sinh ra khớp `RegExp(…,"u")`, độ dài nằm trong min/max khi có thể; mẫu dùng nhìn trước ⇒ `khongHoTro` | M |
| 28 | `schema-sinh.js` phần 1: PRNG + kiểu nguyên thuỷ/format/pattern/độ dài, mảng, object (required + tuỳ chọn, pattern/additional, propertyNames, min/max), `$ref` + độ sâu, kiểm cục bộ + thử lại | `assets/schema-sinh.js`, `index.html`, `kiem/schema-sinh.js` | node: tất định theo seed; mọi schema "thoả được" trong kiem/schema-1 ⇒ mẫu hợp lệ; schema đệ quy (cây) dừng ở độ sâu | M |
| 29 | `schema-sinh.js` phần 2: allOf (gộp), anyOf/oneOf/not/if-then-else, uniqueItems/contains, thử lại toàn cục, `khongDamBao`, nhiều mẫu | `assets/schema-sinh.js`, `kiem/schema-sinh.js` | node: thuộc tính "mẫu hợp lệ hoặc `khongDamBao` không rỗng" cho mọi schema trong kiem/schema-1..3; oneOf luôn khớp đúng một; schema mâu thuẫn (`minimum>maximum`, `not:{}`) ⇒ báo, không treo | M |
| 30 | UI sinh mẫu trong tab Schema (seed/số mẫu/tỉ lệ/độ sâu, xem trước, báo cáo, Dùng làm dữ liệu/Chép/Tải về/Sinh lại) qua `chay-nen` | `assets/ui-schema.js`, `kieu.css`, `check.py` | Edge: Sinh ⇒ "Hợp lệ theo schema"; Dùng làm dữ liệu ⇒ kiểm 0 lỗi, Ctrl+Z về cũ; cùng seed ⇒ cùng kết quả | S |
| 31 | `schema-suy.js` + nút "✨ Suy ra từ dữ liệu" (hỏi trước khi ghi đè, hoàn tác được trong ô schema) | `assets/schema-suy.js`, `assets/ui-schema.js`, `index.html`, `kiem/schema-suy.js`, `check.py` | node: `kiem(d, suySchema(d)).hopLe` cho 100 JSON ngẫu nhiên + mẫu 1 MB; format chỉ gắn khi mọi mẫu khớp; Edge: bấm ⇒ schema + 0 lỗi | M |
| 32 | Tài liệu: `metadata.json` (mô tả, tag `json-schema`, `sinh-du-lieu`, `tim-thay`, `gap-ma`), `HUONG-DAN-SCHEMA.md`, dòng json-editor trong skill `ban-do-ung-dung`, `CLAUDE.md` bảng lệnh (check.py), `tasks/2610/<ngày>/json-editor/ban-giao.md` | các tệp nêu | `check.py --tinh` (metadata hợp lệ), `kiem-tat.js` đạt | S |

**Đường ngắn nếu muốn Schema trước** (vẫn đúng phụ thuộc): 1 → 2 → 3 → 8 → 22 → 23 → 25 → 26 → 27 → 28 → 29 → 30 → 31, rồi 4–7, 9–21, 24, 32.
Lưu ý: tuyên bố "chạy với 10 MB" chỉ đúng sau 4–7 và 11–12.

---

## 5. Kiểm

### 5.1 Lệnh

```bash
node backend/fastapi/webapp/tranphuc8a/json-editor/kiem.js            # mọi phép thuần (133 cũ + mới)
node backend/fastapi/webapp/tranphuc8a/json-editor/kiem.js schema     # chỉ nhóm schema (bộ lọc mới)
node backend/fastapi/webapp/tranphuc8a/kiem-tat.js                    # mọi app viết tay
for f in backend/fastapi/webapp/tranphuc8a/json-editor/assets/*.js; do node --check "$f"; done
backend/fastapi/.venv/Scripts/python.exe backend/fastapi/webapp/tranphuc8a/kiem-hinh.py json-editor
backend/fastapi/.venv/Scripts/python.exe backend/fastapi/webapp/tranphuc8a/json-editor/check.py --tinh
backend/fastapi/.venv/Scripts/python.exe backend/fastapi/webapp/tranphuc8a/json-editor/check.py --chuc-nang
backend/fastapi/.venv/Scripts/python.exe backend/fastapi/webapp/tranphuc8a/json-editor/check.py --hieu-nang 10   # in số đo; JE_PERF_SLACK=3 cho máy chậm
backend/fastapi/.venv/Scripts/python.exe backend/fastapi/webapp/tranphuc8a/json-editor/check.py --file          # mở bằng file://
backend/fastapi/.venv/Scripts/python.exe backend/fastapi/webapp/tranphuc8a/json-editor/check.py --tat-ca
```

### 5.2 `check.py` (mới, Edge `channel="msedge"`, phục vụ thư mục app bằng `http.server` cổng trống — không cần backend)

- `--tinh`: thứ tự script khớp danh sách, `node --check`, ngân sách dung lượng, không URL ngoài/`eval`/`new Function`, mọi `innerHTML =` trong `ui-*.js`
  nằm trong hàm có `thoat(`/`esc(` (heuristic như các app khác), metadata hợp lệ.
- `--chuc-nang` (1440×900 sáng/tối + 360×740): mỗi việc UI thêm một khối phép (đã liệt kê ở cột "Kiểm"); localStorage bị chặn (init script ném lỗi) ⇒
  app vẫn chạy; dữ liệu XSS (`"<img src=x onerror=…>"` trong khoá/giá trị/thông báo lỗi schema) không thực thi.
- `--hieu-nang [MB]`: sinh JSON tất định **trong trang** (không lưu tệp 10 MB vào repo), đo và so ngân sách (× `JE_PERF_SLACK`):

| Đo | Trước (đo 22/10) | Ngân sách |
| --- | --: | --: |
| `input` sau gán 1 MB | 2 162 ms | < 50 ms |
| gõ 1 phím 1 MB (p50) | 87–272 ms | < 150 ms (textarea tự tốn ~100) |
| mở Xem 10 MB | — | < 1 500 ms |
| mở tab Cây 10 MB | 8 484 ms | < 800 ms, < 20 000 phần tử DOM |
| sửa 1 ô cây 10 MB | 13 403 ms | < 1 500 ms |
| gập khối 10 MB | — | < 50 ms |
| kiểm schema 1 MB / 10 MB (Worker) | — | < 300 ms / < 3 000 ms |
| sinh 1 mẫu schema 30 thuộc tính | — | < 200 ms |

- `--file`: mở `index.html` qua `file://`: nạp sạch, Worker từ Blob chạy, kiểm + sinh chạy.

---

## 6. Phụ thuộc mới

**Không có.** Mọi phần tự viết (đúng quy tắc app viết tay). Để tham khảo kích cỡ nếu dùng thư viện (không đề xuất dùng): Ajv 2020 + ajv-formats
≈ 120–150 KB nén nhỏ; json-schema-faker ≈ 400 KB+ (kéo theo faker); randexp ≈ 20 KB. Phần tự viết ước ≈ 160 KB chưa nén (schema-kiem ~40,
schema-sinh ~28, regex-sinh ~12, schema-format ~10, schema-suy ~8, vi-tri ~12, jsonpath ~16, sua-json ~14, tim-kiem ~5, tom-tat ~5, chay-nen ~4)
+ UI ≈ 70 KB ⇒ assets từ ~108 KB lên ~340 KB [ước lượng].

## 7. Cần chủ dự án quyết

1. **Gập trong trình soạn văn bản** — (a) chế độ "Xem" ảo chỉ đọc có gập + placeholder, sửa ở "Sửa"/Cây/"Sửa khối" (**đề xuất**: M, chạy được 10 MB);
   (b) tự viết trình soạn đầy đủ thay textarea (XL, rủi ro IME/chọn chữ/trình đọc màn hình); (c) chỉ gập ở Cây.
2. **Ngưỡng tài liệu lớn tự sang Xem** — 1 MB / **1,5 MB (đề xuất)** / 3 MB / không tự chuyển.
3. **Ngắt dòng mềm mặc định** — **tắt + nút Alt+Z (đề xuất**, để số dòng và tô màu ảo chính xác) / giữ bật như hiện nay.
4. **unevaluatedProperties/unevaluatedItems** — **làm, việc 24 riêng (đề xuất)** / bỏ, báo "không hỗ trợ".
5. **Mức của `format`** — **cảnh báo (đề xuất)** / lỗi / bỏ qua (đúng chuẩn "annotation" của 2020-12).
6. **Bộ test JSON-Schema-Test-Suite chính thức** — **tự viết ca cùng khuôn (đề xuất)** / chép tập con có ghim phiên bản vào `kiem/du-lieu/` (dữ liệu bên thứ ba,
   ~300–500 KB, cần đồng ý) / tải khi chạy (cần mạng).
7. **Nháp > ~5 MB** — **IndexedDB (đề xuất**, đã thử trên `file://` Edge) / chỉ cảnh báo, không lưu.
8. **Worker từ Blob cho kiểm/sinh có hạn giờ** — **có (đề xuất**, đã thử trên `file://`) / luồng chính.
9. **Lưu schema** — **một schema hiện tại cạnh bản nháp (đề xuất v1)** / thư viện nhiều schema + `$ref` chéo theo `$id` (v2).
10. **JSONPath** — **tập con RFC 9535 + giữ cú pháp cũ (đề xuất)** / chỉ sửa lỗi, giữ tối giản.
11. **Thứ tự đợt** — nền + hiệu năng trước (1–13) / **Schema trước theo đường ngắn (đề xuất nếu ưu tiên tính năng)**.

## 8. Rủi ro

- Ngữ nghĩa JSON Schema nhiều góc khuất (`$dynamicRef`, `unevaluated*`, `$id` lồng, regex ECMA-262 với cờ `u`); không có bộ test chính thức thì có thể sót —
  giảm bằng ca tự viết theo đặc tả + phép thuộc tính (sinh ⇄ kiểm, suy ⇄ kiểm).
- ReDoS từ `pattern`/regex tìm kiếm của người dùng: Worker + hạn giờ chặn được khi kiểm/sinh; thanh tìm kiếm chạy luồng chính vẫn có thể treo với regex độc.
- Ngưỡng hiệu năng đo trên một máy (Edge 155); điện thoại/máy yếu chậm hơn nhiều ⇒ ngân sách nhân `JE_PERF_SLACK`.
- Số dòng/tô màu ảo cần `white-space: pre`; người quen ngắt dòng mềm sẽ thấy khác; bật ngắt dòng thì giữ giới hạn cũ.
- `JSON.parse` làm tròn số > 2^53 và đổi `1.50`→`1.5`: kiểm/sinh/sửa trên cây dùng giá trị đã làm tròn (đã ghi ở bàn giao 08/10); `loiNhe` chỉ cảnh báo.
- Hoàn tác dựa vào `beforeinput historyUndo` — hành vi khác nhau giữa Chromium/Firefox/Safari; cần phép kiểm và đường dự phòng.
- Placeholder kích thước/byte tính lười trên nhánh khổng lồ (gốc 10 MB ≈ 0,4 s lần đầu) — cache WeakMap; nếu `capNhatTai` đổi cách sao chép thì cache mất tác dụng.
- Bộ sinh với allOf/not/oneOf phức tạp có thể không tìm được mẫu: phải báo `khongDamBao` trung thực, không giả "hợp lệ".
- Dung lượng app tăng ~3 lần; cần ngân sách trong `check.py --tinh`.
- `kiem-hinh.py` bấm nút theo tên ("Định dạng", "Nén", "Sắp khoá", "Chạy", "So sánh") — đổi tên/gom menu phải giữ tên truy cập hoặc sửa danh sách.
- Tách module + cổng `JE_APP` là tái cấu trúc tệp 2 205 dòng: làm từng bước, 133 phép cũ phải xanh sau mỗi việc.
