# Đợt 8 — bàn giao

**Ngày:** 2026-09-27 · **Nhánh:** `lab/dot-7-va-kiem-trinh-duyet`

Bốn lab câu đố về **trạng thái và đường đi**. `lab-visual` đi từ 32 lên **36 lab**.

---

## 1. Đã làm gì

| Mã | Lab | Tệp | Điều nó cho thấy |
|---|---|---|---|
| L33 | Quân mã — hai ô kề nhau mà tốn 4 nước | `assets/lab-quanma.js` | khoảng cách trên đồ thị **không phải** khoảng cách hình học |
| L34 | Thử chìa khoá — không so được hai chìa với nhau | `assets/lab-chiakhoa.js` | "Θ(n log n) tốt hơn Θ(n²)" là phát biểu về n → ∞, không nói gì về n = 24 |
| L35 | Tìm chai thuốc độc — mỗi người thử là một bit | `assets/lab-thuocdoc.js` | người × vòng ≥ log₂(số chai); phép OR làm **mất** thông tin |
| L36 | Tháp Hà Nội — đồ thị trạng thái là tam giác Sierpinski | `assets/lab-hanoi.js` | 2ⁿ−1 chính là **độ dài một cạnh** của một fractal |

Cả bốn nằm trong nhóm **"Câu đố quyết định"** cùng với L29–L32 của đợt 7.

---

## 2. Con số đã đo

Tất cả đều đo trước khi viết chữ, và đều kiểm lại được trong `kiem-so.js`.

### L33 — quân mã

BFS thật trên bàn cờ, không dùng công thức đóng (công thức đóng chỉ đúng trên
bàn **vô hạn**; chính cái biên làm quân mã phải đi vòng).

| Từ a1 | Cách (Chebyshev) | Số nước |
|---|:--:|:--:|
| → b2 — kề chéo | 1 ô | **4** |
| → e3 | 4 ô | **2** |
| → h8 — góc đối góc | 7 ô | 6 |

Đi xa gấp bốn mà tốn **nửa** số nước. Ô xa nhất theo cỡ bàn:
**4×4 (16 ô) → 5 nước · 5×5 (25 ô) → 4 nước · 8×8 (64 ô) → 6 nước.**
Bàn to gấp bốn chỉ tốn thêm một nước, còn bàn 5×5 **to hơn 4×4 mà dễ đi hơn**.

### L34 — thử chìa khoá

Trung bình 8 hạt giống, cột cuối là *số hạt mà ngẫu nhiên thắng*:

| n | vét cạn | ngẫu nhiên | tỉ lệ | thắng |
|:--:|--:|--:|:--:|:--:|
| 24 | 159 | 210 | 0,76× | **0/8** |
| 40 | 400 | 408 | 0,98× | 4/8 |
| 48 | 650 | 541 | 1,20× | 7/8 |
| 56 | 750 | 655 | 1,15× | **8/8** |
| 120 | 3 670 | 1 668 | **2,20×** | 8/8 |

Cận dưới `⌈log₃(n!)⌉` = 50 phép ở n = 24 — cả hai cách đều nằm trên nó.

### L35 — tìm thuốc độc

1 000 chai, 1 chai độc: cần `⌈log₂ 1000⌉` = **10 bit**. `10 người × 1 ngày`,
`2 người × 5 ngày`, `1 người × 10 ngày` đều đủ — **người và ngày đổi cho nhau
được**. 9 bit thì thiếu, và thiếu là hỏng hẳn chứ không "kém chính xác một chút".

Hai chai độc thì mọi thứ đổ vỡ, vì dãy người chết là phép **OR** của hai mã:

| n | cận dưới ⌈log₂ C(n,2)⌉ | mã ngẫu nhiên đầu tiên dùng được | chênh |
|:--:|:--:|:--:|:--:|
| 8 | 5 | 10 | +5 |
| 16 | 7 | **18** | +11 |
| 32 | 9 | 25 | +16 |

Khoảng cách **giãn ra** theo n. Cận dưới đếm số câu trả lời, nhưng nó không
biết rằng phép OR làm mất thông tin.

### L36 — tháp Hà Nội

Công thức tổng quát (cấu hình đầu **tuỳ ý**): duyệt từ đĩa to nhất xuống; đĩa
nào chưa đúng chỗ thì cộng `2^i` rồi đổi đích cho tầng dưới.

Đối chiếu với BFS chạy trên **toàn bộ** đồ thị trạng thái:

| n | số cấu hình | số chỗ lệch |
|:--:|:--:|:--:|
| 3 | 27 | **0** |
| 5 | 243 | **0** |
| 8 | 6 561 | **0** |

Và đồ thị trạng thái là tam giác Sierpinski cấp n với 3ⁿ đỉnh — ba góc là ba
cấu hình "tất cả trên một cọc", đường ngắn nhất giữa hai góc chạy dọc **một
cạnh**, dài đúng 2ⁿ−1.

---

## 3. Ba lần đo bác bỏ điều đã định viết

Đây là phần đáng đọc nhất của đợt này.

### 3.1 "Bàn 4×4 có ô quân mã không bao giờ tới được" — **sai**

Bàn 4×4 **liên thông**: 0 ô chết. Chỉ **3×3** mới có ô cô lập — ô giữa, vì cả
tám nước mã xuất phát từ đó đều rơi ra ngoài bàn.

Tệ hơn: `min` của tham số "cạnh bàn cờ" đang là **4**, nên người dùng *không
thể* bấm tới cái bàn mà lab đang nói tới. Một lab nói điều người đọc không
kiểm chứng được thì tệ hơn một lab không nói gì.

Đã hạ `min` về 3, đổi tên preset, và thay đoạn chữ bằng thứ đo được (bảng "ô
xa nhất theo cỡ bàn" ở trên) — cùng một bài học, nhưng đúng.

### 3.2 "Hai đường cắt nhau ở n ≈ 48" — **không phải một điểm**

Chỗ lật là một **dải**, và nó xê dịch theo hạt giống. Biểu đồ đang đánh dấu
chỗ giao **đầu tiên**, mà với hai đường chạy sát nhau và còn nhiễu thì chỗ đó
nhảy lung tung — có hạt báo n = 26, có hạt báo n = 46.

Nay đánh dấu chỗ **dứt khoát**: n nhỏ nhất mà từ đó trở lên ngẫu nhiên thắng ở
*mọi* cỡ đã đo. Và phần chữ nói thẳng rằng cái dải nhoè ấy **chính là** bản
chất của thuật toán ngẫu nhiên — nó không có một con số, nó có một phân phối.

`kiem-so.js` cũng đổi theo: ngưỡng cũ `vét cạn > ngẫu nhiên × 2` phụ thuộc hạt
giống (1,94× ở hạt mặc định, 2,20× khi trung bình 8 hạt). Một phép thử
xanh-đỏ theo hạt giống thì không kiểm gì cả. Nay kiểm **ngẫu nhiên thắng ở cả
sáu hạt** ở n = 120, và **không thắng hết** ở n = 40.

### 3.3 Phép nhúng Sierpinski của Hà Nội — tập điểm đúng, **cạnh sai**

Cách nhúng đầu tiên đặt đĩa `i` vào góc `GOC[dia[i]]` ở mỗi tầng. Tập **điểm**
ra đúng là tập điểm Sierpinski, nên tấm hình *trông* hoàn toàn đúng. Nhưng
**cạnh** thì nối lung tung qua cả hình:

| | cạnh dài nhất (n = 5) | tổng độ dài |
|---|:--:|:--:|
| không hoán vị | **0,577** | 22,03 |
| có hoán vị | **0,036** | 12,63 |

0,577 là hơn **nửa** chiều ngang tam giác.

Lý do: trong tam giác con `T_c` (đĩa to nhất ở cọc c), góc ứng với "mọi đĩa nhỏ
hơn đều ở cọc p" **không** nằm ở góc hình học p. Cạnh nối `T_0` với `T_2` là
nước chuyển đĩa to 0 → 2, mà nước đó chỉ hợp lệ khi mọi đĩa nhỏ hơn đều ở cọc
**1**. Quy tắc đúng: vào tam giác con của cọc c thì **giữ c, đổi chỗ hai cọc
kia**.

> **Điều đáng ghi nhớ:** mắt thường không bắt được lỗi này, vì đám điểm không
> đổi. Cái bắt được là **đường đi ngắn nhất** — giữa hai góc nó phải chạy dọc
> một cạnh, mà ảnh chụp cho thấy nó zic-zac xuyên qua ruột tam giác. Tức là
> tầng kiểm tự động (đếm màu, đếm chồng lấn, đếm tràn ngang) **xanh hết** ở cả
> hai phiên bản. Chỉ có mắt người nhìn vào một *bất biến đã biết trước* mới bắt
> được.

---

## 4. Lỗi bố cục bắt được bằng mắt

Tầng `kiem_hinh.py` xanh cả ba lần, nhưng ảnh chụp vẫn cho thấy hai chỗ hỏng:

1. **Hà Nội** — tháp bị dồn xuống góc trái dưới, cả nửa trái phía trên bỏ
   trống. `hDia` bị chặn ở 20px và đáy tháp ghim ở `0,86·H`, nên với n = 5
   chồng đĩa chỉ cao 100px trong khi còn ~420px trống. Đã cho đĩa cao tới 46px
   và **căn giữa theo chiều dọc**.

2. **Thử chìa khoá** — hàng "ổ" cách hàng "chìa" tới 83px, tức nó nằm **sát
   nhãn của cách kế tiếp**. Đọc lướt qua là nhóm nhầm. Đã kéo hai hàng của
   cùng một cách lại gần nhau, dồn phần thừa xuống làm khe ngăn cách, đưa nhãn
   cách lên **trên cả hai hàng**, và thêm nhãn `chìa` / `ổ` ngay bên trái từng
   hàng.

---

## 5. Engine không mọc thêm gì

`V.lanSong` từng được đề xuất cho đợt này. Đếm lại: chỉ **một** lab (quân mã)
thật sự lan sóng BFS trên lưới — Hà Nội dựng đồ thị Sierpinski chứ không lan
sóng. Quy tắc "chỉ tách nguyên hàm khi đếm được ≥ 2 lab chép tay" nên chưa tách.

Thứ duy nhất engine nhận thêm là `p.sau` cho preset (làm ở đợt 7, vẫn chưa
commit): preset trước đây chỉ áp `p.gt`, nên những trạng thái **không nằm
trong tham số** — vị trí quân cờ, cấu hình đĩa — bị im lặng bỏ qua.

---

## 6. Trạng thái kiểm tra

| Tầng | Kết quả |
|---|---|
| Tĩnh (`lab-visual/check.py --tinh`) | **Đạt** — 0 lỗi, 0 nhắc nhở |
| Nguyên hàm engine (`thu-engine.js`) | **Đạt** |
| DOM giả (`thu-nhanh.js lab-visual`) | **Đạt** — 99 mục, 36/36 lab |
| Đối chiếu số (`kiem-so.js`) | **Đạt** — **190 phép** (trước: 141) |
| Hình ảnh (`kiem_hinh.py lab-visual`) | **Đạt** — **328 phép, 0 nhắc nhở** |
| Ba ứng dụng (`tranphuc8a/kiem-tat.js`) | **Đạt** — 178 phép |
| Ba site `*-visual` còn lại | **Đạt** — mỗi site 1 nhắc nhở (cố ý chưa đồng bộ engine v2) |

---

## 7. Còn nợ

1. **Ba site `*-course` có `check.py` chưa bao giờ chạy được.**
   `ai-everything-course`, `heuristic-course`, `system-design-course` đều
   `import kiem` từ `engine/kiem.py` — **tệp đó không tồn tại**, và đường dẫn
   `sys.path` cũng trỏ sai một cấp (`webapp/engine` thay vì
   `webapp/courses/engine`). Cùng lỗi ở `build.py` và `shot.py` của cả ba.
   Đây là nợ cũ, không phải do đợt 8. Sửa cho tử tế cần viết mới
   `engine/kiem.py` cho site kiểu *nội dung* (`content.json`), khác hẳn
   `kiem_demo.py` vốn dành cho site kiểu *lab*.

2. **`pytest` chưa cài ở máy này** (`requirements-dev.txt` có khai báo, CI chạy
   được). Đợt 8 không đụng tệp Python nào của backend, nên không chạy lại.

3. **Đồng bộ engine v2 sang ba khoá cũ** — vẫn cố ý để nguyên, xem
   `engine/dong-bo.json`.

---

## 8. Việc tiếp theo

**Đợt 9 — Ngẫu nhiên và hội tụ:** chuỗi Markov (sự hội tụ về phân phối dừng),
Bloom filter. **Đợt 10:** nhận dạng chữ số viết tay bằng FNN/CNN giả lập, sinh
dữ liệu thủ tục và huấn luyện ngay trong trình duyệt.
