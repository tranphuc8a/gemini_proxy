# Web Lab visualize — ngữ cảnh & trạng thái

Tài liệu bàn giao cho phiên làm việc sau. Cập nhật: 2026-09-20.

## Mục tiêu

Webapp trực quan hoá những thứ khó hình dung — thuật toán, hệ động lực, quy trình.
Chủ đề đã có trong plan: giả thuyết Collatz, mô phỏng heuristic (leo đồi, tôi luyện,
đàn kiến, di truyền, tiến hoá), thí nghiệm sinh tồn xã hội.

## Phát hiện quan trọng khi khảo sát repo

1. **Đã có sẵn engine + 68 lab.** Ba trang `courses/*-visual` chạy trên một engine
   chung (`vis-core.js`, 489 dòng, không thư viện ngoài). Trong đó `heuristic-visual`
   đã có **21 lab** phủ gần hết danh sách heuristic trong plan — kể cả "đua 4 thuật
   toán trên cùng ngân sách". Không cần làm lại phần này.
2. **`courses/engine/` chưa từng tồn tại.** `vis-core.js` tự khai là "file sinh ra"
   từ đó, `check.py` của cả 6 thư mục khoá đều `import` từ đó — nhưng thư mục chưa
   bao giờ được commit. Hệ quả: engine bị nhân bản 3 bản giống hệt, và **toàn bộ
   check.py đang gãy**.
3. **Bug đường dẫn trong `check.py` của 3 khoá cũ** — dùng `dirname(dirname(HERE))`
   nên trỏ vào `webapp/engine` thay vì `courses/engine`. Dư một cấp. *Chưa sửa* —
   xem mục Việc còn lại.

## Đã làm

### `courses/engine/` — nguồn thật, mới dựng

| Tệp | Vai trò |
|---|---|
| `vis-core.js` | Engine v2. Giữ **nguyên vẹn toàn bộ API v1** |
| `vis.css` | Giao diện, nền là bản gốc + khối "ENGINE v2" nối thêm |
| `sync.py` | Chép engine sang trang đích; `--thu` `--kiem` `--tat-ca` |
| `dong-bo.json` | Hiện chỉ `lab-visual`. 3 khoá cũ nằm ở `chua_dong_bo` (cố ý) |
| `kiem_demo.py` | Module `check.py` gọi vào — thứ còn thiếu bấy lâu |
| `thu-nhanh.js` | Chạy thật engine + mọi lab trong Node trên DOM/canvas giả |
| `README.md` | API engine + cách viết lab mới |

### Engine v2 — phần thêm so với v1

| Yêu cầu ban đầu | Cách giải |
|---|---|
| Xem như video/ảnh động | Bộ phát cũ đã có play/pause/step/tua; **thêm** lưu PNG và ghi `.webm` qua `MediaRecorder` |
| Custom tham số | `V.thamSo(lieuDo)` — khai báo một lần → tự sinh UI + trạng thái + đặt lại + đọc/ghi URL. Mỗi mục có `hien(gt)` để ẩn/hiện theo chế độ |
| Tốc độ chạy | Đã có; nới trần lên ~1M bước/giây |
| Giao diện | Đã có sáng/tối; **thêm** chế độ tập trung, toàn màn hình, canvas co giãn (`V.veBangCo`) |
| Trải nghiệm | **Thêm** phím tắt (Space/→/R/F), permalink, preset kịch bản, tua theo mốc (`anh`/`phucHoi`) thay vì diễn lại từ bước 0 |
| Cấu hình | `cau-hinh.js` thêm khối `tinhNang` bật/tắt từng thứ |

Kiểu tham số: `so` `chon` `bat` `nhap` `hat` `nhom`.
Điều khiển mới: `V.nhapSo`, `V.hatGiong`, `V.soLieu`.

### Hai nguyên hàm rút ra từ đo đạc, không phải từ dự đoán

Đếm trên 69 lab hiện có:

- `fillText` xuất hiện **620 lần trong 22/22 tệp lab** — mọi lab đều chép tay
  đoạn vẽ trục, lưới và nhãn số → rút thành **`V.bieuDo`** (trục, lưới, trục
  log, `duong/doan/diem/moc/chu`), kèm `V.soGon` cho nhãn.
- Bộ đệm canvas phụ để vẽ chồng dần lặp ở **4 tệp** → rút thành
  **`V.bangTichLuy`** (`toi/dan/xoa`, tự xử lý đổi kích thước).

`createImageData` chỉ xuất hiện ở 2 tệp nên **chưa** rút — chờ đủ căn cứ.
Lab Collatz đã được refactor sang dùng cả hai, và đó là cách chúng được kiểm chứng.

### Trường `category` cho metadata (xuyên suốt)

`collection` do scanner suy từ cây thư mục nên mọi app dưới `courses/` đều
giống nhau; chỉ bản thân app mới biết nó **là** khoá học hay lab. Nên thêm
`category` thành trường thật:

- `webapp_controller.py` — `AppMetadata.category`, đọc từ `metadata.json`,
  có trong `/_api/list` và được tính điểm trong `/_api/search`
- `portal.js` / `portal.html` / `portal.css` — bộ lọc, huy hiệu bấm được, sắp
  xếp "Theo thể loại", tham số URL `?cat=`
- 7 `metadata.json` trong `courses/` — đủ `title` / `description` / `category` /
  `tags` / `icon`. Hai thể loại: **Khoá học** (3) và **Lab trực quan** (4).

### `courses/lab-visual/` — site lab độc lập, mới dựng

Không gắn khoá học nào. Bảng màu teal riêng (`chu-de.css`), cấu hình riêng.

Lab mẫu **Collatz** (`assets/lab-collatz.js`) — cố ý dùng hết mọi tính năng để làm
bản tham chiếu. Bốn chế độ trong một lab: quỹ đạo · cây ngược · hoa văn xếp chồng ·
bản đồ thời gian dừng. Có 6 preset, tham số ẩn/hiện theo chế độ, hover đọc ô trên
bản đồ, bộ đệm tích luỹ cho hai chế độ vẽ chồng.

## Kiểm tra — trạng thái hiện tại

```bash
cd backend/fastapi/webapp/courses
node engine/thu-nhanh.js <ten-trang>        # chạy thật, không cần trình duyệt
cd lab-visual && python check.py --tinh     # đầy đủ, không cần trình duyệt
python engine/sync.py --kiem                # bản sao có lệch nguồn không
```

Kết quả lần chạy cuối — **69 lab trên 4 site, tất cả xanh**:

| Site | Số mục đạt | Lỗi |
|---|:--:|:--:|
| `lab-visual` | 6 | 0 |
| `heuristic-visual` | 33 | 0 |
| `ai-everything-visual` | 63 | 0 |
| `system-design-visual` | 16 | 0 |

Đã kiểm tra ngược: chèn lỗi runtime cố ý → `check.py` trả exit 1 và chỉ đúng chỗ.

Ba tầng kiểm tra: **tĩnh** (Python) → **DOM giả** (Node) → **Chromium** (playwright,
chưa cài nên tự bỏ qua). Tầng DOM giả không bắt được lỗi hình học — canvas ở đó chỉ
đếm số lần gọi.

## Việc còn lại

**Đã xử lý xong**

- ~~Bug đường dẫn `check.py` của 3 khoá `*-visual`~~ — đã bỏ bớt một `dirname`.
  Cả 4 trang `*-visual` giờ chạy `check.py --tinh` xanh.

**Còn lại**

- `courses/engine/` vẫn **thiếu `kiem.py`, `chup.py`, `build.py`** mà 3 thư mục
  `*-course` đang import → `check.py`/`shot.py`/`build.py` của chúng còn gãy.
  Đây là công cụ cho trang khoá học, không phải cho engine lab.
- Đồng bộ engine v2 cho 3 khoá cũ: thêm tên vào `dong-bo.json` → `dich`, chạy
  `sync.py`, rồi `thu-nhanh.js` từng trang. API tương thích ngược đã xác nhận.
  Làm xong thì 68 lab cũ dùng được `V.bieuDo`, bỏ bớt được rất nhiều mã trùng.
- Lộ trình đề tài tiếp theo: xem [`web-lab-ke-hoach.md`](web-lab-ke-hoach.md).
- Xuất GIF: cố tình bỏ, vì mã hoá GIF không thư viện là quá nhiều việc. Hiện có
  PNG + WebM.
- Cân nhắc cài playwright khi số lab vượt ~15 — tầng DOM giả không bắt được lỗi
  hình học.
