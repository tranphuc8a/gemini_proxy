# Web Lab visualize — ngữ cảnh & trạng thái

Tài liệu bàn giao cho phiên làm việc sau. Cập nhật: 2026-09-24 (sau đợt 5).

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

### Đợt 1 của lộ trình — đã xong

5 lab mới: **logistic map** (3 chế độ) · **Fourier epicycles** (vẽ tay bằng chuột) ·
**xoắn ốc Ulam** (Ulam + Sacks) · **Monte Carlo π** (ném điểm + kim Buffon) ·
**giới hạn trung tâm** (5 nguồn, có một nguồn làm định lý gãy). Site hiện 6 lab.

Engine mọc thêm: `B.cot()` / `B.cotDay()`, nhãn số trục ngang, `x.hienSo` /
`y.hienSo` / `x.vach`, `datTocDo()` đồng bộ thanh trượt.

**Hai bug thật lộ ra khi làm đợt này:**

1. **Thanh tua chưa từng tồn tại ở 5/6 lab.** `dk()` chỉ dựng nó khi `toiDa` đã
   biết lúc dựng giao diện, nhưng hầu hết lab gọi `datToiDa()` sau đó trong
   `apDung()`. Nay luôn dựng sẵn rồi ẩn, `datToiDa()` mở ra.
2. **Harness kéo nhầm slider.** Nó lấy `input[type=range]` cuối cùng làm thanh tua,
   trong khi thứ tự thật là `[tua] [tốc độ]` rồi mới tới tham số. Test "tua" xưa nay
   kéo nhầm một slider tham số — và chính nó che mất bug số 1.

### Tầng kiểm tra thứ ba: đối chiếu số

`lab-visual/kiem-so.js` chạy xuyên qua **mã lab thật**, đọc bảng số liệu trên màn
hình rồi so với giá trị tính độc lập: π(60000) = 6057 bằng sàng riêng, Collatz 27
→ 111 bước đỉnh 9232, chu kỳ logistic tại r = 2,8 / 3,2 / 3,5 / 3,83, σ của phân
phối đều = 1/√12, sai số Fourier khi dùng 1 vòng so với 100 vòng. **17 phép, tất
cả khớp.** Đã kiểm tra ngược: chèn lỗi sàng → exit 1.

`thu-nhanh.js` giờ dùng được như **thư viện** (`require` nó thì không chạy test),
đó là cách `kiem-so.js` mượn lại bộ DOM giả.

### Đợt 2 — đã xong

6 lab mới: **Schelling** · **Game of Life** · **256 luật một chiều** · **thấm** ·
**đống cát** · **kiến Langton**. Site hiện **12 lab**.

Engine mọc thêm `V.luoiO`: mỗi ô là một điểm ảnh trong một `ImageData` nhỏ, phóng
to lên canvas bằng **một** lệnh `drawImage`. Lưới 400×400 vẽ hết một lệnh thay vì
160 000 lệnh `fillRect`. Kèm `V.mauSo` và tuỳ chọn `leDuoi`.

**Một bug thật lộ ra:** lab thấm ban đầu dùng nút ảo bờ trên/bờ dưới trong
union-find. Nút ảo **gộp mọi cụm chạm bờ trên thành một**, làm "cụm lớn nhất"
sai hẳn. Thay bằng cờ chạm-bờ trên mỗi gốc cụm.

**Một phép thử ngược vô hiệu:** lần đầu mình định kiểm tra tầng đối chiếu bằng
cách đảo hai lân cận của luật 90 — nhưng luật 90 đối xứng trái-phải nên đó là
một thay đổi vô nghĩa. Phải chọn chỗ thực sự bất đối xứng (luật bảo toàn hạt
của đống cát) thì test mới đỏ.

### Đợt 3 — đã xong

5 lab mới: **đàn chim** · **dịch tễ SIR** · **kẹt xe ma + nghịch lý Braess** ·
**nấm nhầy** · **sinh tồn xã hội**. Site hiện **17 lab**.

Engine mọc thêm `V.hat`: mảng tác tử + băm không gian, truy vấn láng giềng O(n).

**Hai bug thật lộ ra:**

1. **Băm không gian bỏ sót láng giềng tại chỗ nối vòng** — 319/2500 tác tử. Nguyên
   nhân: ô băm không lát đúng miền. Bắt được nhờ `thu-engine.js` đối chiếu với duyệt
   vét cạn trên 10 cấu hình.
2. **Tua đóng băng tab tới 140 giây.** Chi phí mỗi bước phụ thuộc tham số, nên
   chỉnh `toiDa` từng lab không giải quyết được. Sửa ở engine bằng **ngân sách 3 giây**
   cho mỗi lần tua.

**Hai bài học về phương pháp:**

- **Đo một lần là không đủ.** Lần đo đầu (tất cả lab trong một tiến trình) báo
  rằng tối ưu hoá làm mọi thứ chậm đi. Đo lại độc lập, trung vị 3 lần: boids thực
  ra nhanh lên 7,0 → 2,9 ms/bước.
- **Phép thử có thể chạy sai tham số mà vẫn xanh.** Hàm `dat()` trong `kiem-so.js`
  đặt `.value` cho ô **danh dấu** — vô tác dụng, vì ô danh dấu đọc `.checked`. Ba phép
  đối chiếu đã chạy với tham số sai. Nay `chayToi()` cũng xác nhận đã tới đúng bước,
  vì ngân sách tua có thể cắt ngắn **âm thầm**.

### Tầng kiểm tra thứ tư: tự kiểm tra nguyên hàm engine

`engine/thu-engine.js` kiểm thẳng các nguyên hàm, không qua lab nào: băm không gian
đối chiếu với duyệt vét cạn trên 10 cấu hình (kể cả ô to hơn cả miền, miền dẹt),
số ngẫu nhiên tái lập được, đổi màu CSS, thang màu. **25 mục.**

### Đợt 4 — đã xong

4 lab mới: **băm nhất quán** · **thế giới nhỏ & mạng vô hướng tỉ lệ** ·
**lan truyền trên mạng** · **đồng thuận Raft**. Site hiện **21 lab**.

Engine mọc thêm `V.doThi`: nút/cạnh với tra cứu cạnh O(1), bố cục tròn và bố cục
lò xo, đổi toạ độ, bắt chuột.

**Không có bug lớn nào ở đợt này** — khác hẳn ba đợt trước. Lý do có vẻ là
`thu-engine.js`: nguyên hàm `V.doThi` được kiểm 16 mục *trước khi* lab nào dựng
lên nó, nên các lỗi kiểu như băm không gian ở đợt 3 không có cơ hội lọt xuống lab.

**Lab tự kiểm tra lời hứa của chính nó.** Lab Raft đếm số lần vi phạm tính an
toàn cốt lõi (hai lãnh đạo cùng nhiệm kỳ) và in ra bảng số liệu. `kiem-so.js` kiểm
con số đó ở ba mức mất tin. Thử ngược: bỏ luật quá bán → 32 lần vi phạm ở mạng tệ.
Đây là kiểu kiểm tra mạnh nhất trong cả dự án, vì nó kiểm **tính chất**, không
phải một con số cụ thể.

**Vài con số đối chiếu:** bỏ 1 trong 6 máy — `băm % N` chuyển 83,1% (lý thuyết
83,33), băm nhất quán 16,9% (lý thuyết 16,67). Hệ số cụm vòng thuần khớp *chính
xác* `3(k−2)/(4(k−1))` ở k = 4, 6, 8, 10.

### Đợt 5 — đã xong

4 lab mới: **Mandelbrot & Julia** · **phản ứng khuếch tán Gray–Scott** ·
**hiệu ứng cánh bướm** (con lắc kép + Lorenz) · **N-body & điểm Lagrange**.
Site hiện **25 lab**.

**Web Worker đã bị bỏ, có lý do.** Worker không tạo được từ trang `file://`, mà
chạy offline là lời hứa của dự án. Đo lại thì chỉ Mandelbrot mới nặng thật (~2,5
*giây* cho cả khung), và chia nhỏ theo hàng giải quyết trọn vẹn — bộ phát sẵn có
đã làm đúng việc đó.

**Thay vào đó sửa một lỗ hổng thật:** `phat` tính số bước mỗi khung hình mà không
xem đồng hồ. Nay có `hanKhung` (mặc định 12 ms). Khung hình tệ nhất của cả 25 lab
sau khi sửa: **6,7 ms**.

**Lần đầu tầng đối chiếu bắt được LỖI NỘI DUNG.** Preset Julia tên "liền khối"
dùng `c = −0,8 + 0,156i` — giá trị đó nằm *ngoài* tập Mandelbrot, nên tập Julia
của nó là bụi chứ không liền khối. Nhìn hình không phân biệt được. Đã đổi sang thỏ
Douady, và giữ giá trị cũ làm preset dạy học *"⚠ Trông liền mà là bụi"*.

**Hai bẫy khác của phép thử, cùng một gốc — hàm parse số:**

- `soThuc()` nuốt chữ `e`, nên đọc `"4.10e-12"` thành `4.10` — sai 12 bậc độ lớn
  mà phép thử vẫn im lặng. Thêm `soKhoaHoc()`.
- Harness **bấm nút phát vô điều kiện**; với lab `tuTin: true` (tự chạy ngay) thì
  một cái bấm là *tạm dừng*, và phép thử kết luận ngược. Nay `batDauChay()` xem
  class `dang` trên nút trước khi bấm.

Tính cả đợt trước, **mọi lần phép thử báo sai đều là lỗi của phép thử hoặc của
nội dung — chưa lần nào là lỗi engine.** Có vẻ `thu-engine.js` đang làm đúng việc.

## Kiểm tra — trạng thái hiện tại

```bash
cd backend/fastapi/webapp/courses
node engine/thu-nhanh.js <ten-trang>        # chạy thật, không cần trình duyệt
cd lab-visual && python check.py --tinh     # đầy đủ, không cần trình duyệt
python engine/sync.py --kiem                # bản sao có lệch nguồn không
```

Kết quả lần chạy cuối — **93 lab trên 4 site, tất cả xanh** (cộng 41 mục tự kiểm
tra nguyên hàm engine):

| Site | Chạy thử | Đối chiếu số | Lỗi |
|---|:--:|:--:|:--:|
| `lab-visual` (25 lab) | 71 | 87 | 0 |
| `heuristic-visual` (21 lab) | 53 | — | 0 |
| `ai-everything-visual` (39 lab) | 101 | — | 0 |
| `system-design-visual` (8 lab) | 23 | — | 0 |

Đã kiểm tra ngược: chèn lỗi runtime cố ý → `check.py` trả exit 1 và chỉ đúng chỗ.

Năm tầng: **tĩnh** (Python) → **nguyên hàm engine** (`thu-engine.js`) → **DOM giả**
(`thu-nhanh.js`) → **đối chiếu số** (`kiem-so.js`) → **Chromium** (playwright, chưa cài nên tự bỏ qua). Tầng DOM giả không bắt được
lỗi hình học — canvas ở đó chỉ đếm số lần gọi.

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
