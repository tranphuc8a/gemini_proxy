# Engine trực quan

Khung dùng chung cho mọi trang `*-visual` trong `courses/`. **Đây là nguồn thật.**
Mọi bản `*/assets/vis-core.js` và `*/assets/vis.css` đều là bản sao do
[`sync.py`](sync.py) chép ra — sửa ở đó sẽ mất.

> **Không Node, không npm, không thư viện ngoài** cho phần chạy trên trình duyệt.
> Node chỉ dùng cho công cụ kiểm tra ở máy phát triển.

---

## Tệp trong thư mục này

| Tệp | Vai trò |
|---|---|
| [`vis-core.js`](vis-core.js) | Engine. Điều khiển, canvas, bộ phát, tham số, router, xuất ảnh/video |
| [`vis.css`](vis.css) | Giao diện + biến màu. Mỗi trang đè bảng màu riêng bằng `assets/chu-de.css` |
| [`sync.py`](sync.py) | Chép engine sang các trang đích khai báo trong `dong-bo.json` |
| [`dong-bo.json`](dong-bo.json) | Trang nào nhận engine v2, trang nào cố ý chưa đồng bộ |
| [`kiem_demo.py`](kiem_demo.py) | Module mà `check.py` của từng trang gọi vào |
| [`thu-nhanh.js`](thu-nhanh.js) | Chạy thật engine + mọi lab trong Node trên DOM/canvas giả |
| [`thu-engine.js`](thu-engine.js) | Tự kiểm tra các nguyên hàm engine, không qua lab nào |

---

## Lệnh

```bash
python sync.py                 # chép sang các trang trong dong-bo.json
python sync.py lab-visual      # chỉ một trang
python sync.py --tat-ca        # mọi thư mục *-visual
python sync.py --thu           # chỉ báo sẽ làm gì, không ghi
python sync.py --kiem          # bản sao có lệch nguồn không (exit 1 nếu lệch)

node thu-engine.js             # tự kiểm tra nguyên hàm engine
node thu-nhanh.js lab-visual   # chạy thật mọi lab của một trang, không cần trình duyệt
cd ../lab-visual && node kiem-so.js           # đối chiếu số với giá trị chuẩn

cd ../lab-visual && python check.py --tinh    # kiểm tra đầy đủ, không cần trình duyệt
```

---

> **Không dùng Web Worker.** Worker không tạo được từ trang `file://` (Chrome chặn),
> mà chạy offline là lời hứa của dự án. Việc nặng thì **chia nhỏ theo bước của bộ
> phát** — lab Mandelbrot vẽ từng hàng thay vì cả khung, và đó là cách đúng ở đây:
> vẫn tạm dừng được, vẫn có thanh tiến độ, vẫn tua được.

## Năm tầng kiểm tra

`check.py` của mỗi trang chạy tuần tự, bỏ qua tầng nào thiếu công cụ:

1. **Tĩnh** — chỉ cần Python. Thứ tự nạp script, tệp thiếu/thừa, trường bắt buộc
   của mỗi lab, id trùng, bản sao engine lệch nguồn.
2. **Nguyên hàm engine** — cần Node. `thu-engine.js` kiểm thẳng băm không gian
   (đối chiếu với duyệt vét cạn trên 10 cấu hình), số ngẫu nhiên tái lập được, đổi
   màu CSS, thang màu — những thứ hỏng âm thầm mà không lab nào báo lỗi.
3. **Chạy thật trên DOM giả** — cần Node. Nạp đúng những tệp `index.html` khai
   báo, dựng mục lục, mở **từng lab**, bấm Chạy, bơm khung hình, đảo qua mọi lựa
   chọn của ô chọn đầu tiên, tua, và kiểm tra permalink. Bắt được lỗi runtime,
   biến chưa khai báo, lab ném ngoại lệ, bộ phát không vẽ.
   **Không** bắt được lỗi hình học — canvas ở tầng này chỉ đếm số lần gọi.
4. **Đối chiếu số** — chạy `<trang>/kiem-so.js` nếu trang có tệp đó. Nó dùng
   `thu-nhanh.js` làm **thư viện** (`require` nó thì nó không chạy test), mở từng
   lab, đặt tham số, tua tới cuối, đọc bảng số liệu trên màn hình rồi so với giá
   trị tính độc lập. Tầng 2 chứng minh lab *không nổ*; tầng này chứng minh nó
   *tính đúng*. Trang chưa có tệp thì bỏ qua, không tính là lỗi.
5. **Trình duyệt thật** — cần `pip install playwright`. Mở Chromium, bắt lỗi
   console thật. Chưa cài thì tầng này tự bỏ qua kèm một dòng nhắc.

Mọi tầng trả exit code khác 0 khi có lỗi.

---

## Viết một lab mới

Chép khung của [`../lab-visual/assets/lab-collatz.js`](../lab-visual/assets/lab-collatz.js)
— đó là lab tham chiếu, dùng hết mọi thứ engine có.

```js
demo({
  id: "ma-lab", nhom: "Tên nhóm", mon: "L02",
  ten: "Tên hiển thị",
  moTa: "Một câu nói rõ người xem sẽ <b>thấy</b> điều gì.",
  dung: function (host) {
    var V = window.VIS;

    var TS = V.thamSo([...], { doi: function () { apDung(); }, preset: [...] });
    var cv = V.veBangCo({ rong: 820, tiLe: 0.64, veLai: function () { apDung(); } });
    var S  = V.soLieu();
    var P  = V.phat({ bang: cv, datLai: ..., buoc: ..., ve: ..., nhan: ... });

    var r = V.khung(host, {
      bang: cv, ve: [cv], dieuKhien: [P.dk(), TS.dk(), S.el], giaiThich: "..."
    });
    r.trai.classList.add("co");     // canvas co giãn theo khung
  }
});
```

Rồi thêm `<script src="assets/lab-....js">` vào `index.html` và chạy `check.py`.

### API engine

**Điều khiển** — `V.truot`, `V.nut`, `V.chon`, `V.danhDau`, `V.nhapSo`, `V.hatGiong`

**Tham số khai báo** — `V.thamSo(lieuDo, {doi, preset})` → `{gt, dk(), dat(), datLai(), apDung()}`.
Khai báo một lần, engine lo giao diện + trạng thái + đọc/ghi URL. Mỗi mục nhận
`hien: function (gt) {...}` để ẩn/hiện theo chế độ.
Kiểu: `so` `chon` `bat` `nhap` `hat` `nhom`.

**Canvas** — `V.veBang(w,h)` cố định · `V.veBangCo({rong,tiLe,veLai})` co giãn ·
`V.veLuoi` · `V.mau("ac")` đọc biến CSS · `V.thangMau(t)` thang màu chuyển

**Biểu đồ** — `V.bieuDo(cv, {x, y, le, luoi})`. Trục, lưới, nhãn số cả hai trục,
trục log, `duong()` `doan()` `diem()` `cot()` `cotDay()` `moc()` `chu()`.
Đừng tự vẽ trục nữa: 22/22 tệp lab cũ đều chép tay đoạn này (620 lần gọi
`fillText`), và đó chính là lý do nó được đưa vào engine.

`cot(x, v, rong, mau)` vẽ một cột, `cotDay(dem, xMin, xMax, mau)` vẽ cả
histogram từ mảng đếm — `rong` tính theo **đơn vị trục x**, nên tổ chức đồ giữ
đúng tỉ lệ khi đổi kích thước canvas.

Đặt `x.hienSo = false` hoặc `y.hienSo = false` để bỏ nhãn số của trục đó,
`x.vach` để đổi số vạch, `x.dinhDang` / `y.dinhDang` để đổi cách viết số.

Nhiều biểu đồ trên **một** canvas thì cho mỗi cái một `le` khác nhau (lab
Monte Carlo và lab giới hạn trung tâm chia đôi khung theo cách đó).

**Bảng tích luỹ** — `V.bangTichLuy(cv)` cho lab vẽ chồng dần (hoa văn, bản đồ
nhiệt tính dần, quỹ đạo quần thể). Giữ một canvas phụ, chỉ vẽ phần mới rồi dán
cả tấm lên:

```js
var BTL = V.bangTichLuy(cv);
// trong ve(k):
BTL.toi(k, function (g, i) { /* vẽ mục thứ i, hệ toạ độ logic */ });
nen(cv); BTL.dan();
// trong datLai():
BTL.xoa();
```

Đổi kích thước canvas thì nó tự xoá và đếm lại từ 0 — lần `toi()` kế tiếp vẽ
lại toàn bộ, đúng ý nghĩa.

**Lưới ô** — `V.luoiO(cv, {cot, hang, le, leTren, leDuoi})` cho mọi lab dùng
lưới tế bào. Mỗi ô là **một điểm ảnh** trong một `ImageData` nhỏ, phóng to lên
canvas bằng **một** lệnh `drawImage` (đã tắt làm mềm để ô sắc cạnh). Lưới
400×400 vẽ hết bằng một lệnh, thay vì 160 000 lệnh `fillRect`.

```js
var L = V.luoiO(cv, { cot: 200, hang: 150, le: 10, leTren: 26 });
L.bangMau([V.mau("bg2"), V.mau("ac"), V.mau("ba")]);   // chỉ số màu
L.tuMang(trangThai);      // Uint8Array chỉ số màu — đường nhanh nhất
L.dat(c, r, 2);           // hoặc tô từng ô
L.dan(); L.vien();
var o = L.oTai(x, y);     // điểm ảnh -> {c, r, i} hoặc null
```

`leDuoi` chừa chỗ cho một biểu đồ nằm dưới lưới trong cùng canvas — lab thấm
và lab Schelling dùng cách đó.

**Màu** — `V.mauSo("#0d7490")` → `[13, 116, 144, 255]`, cho những chỗ phải ghi
thẳng vào `ImageData`.

**Hệ tác tử** — `V.hat({soToiDa, rong, cao, banKinh, vien})` cho mọi lab bầy đàn.
Giữ mảng `x/y/vx/vy/loai/so`, xử lý mép (`vien: "vong"` nối vòng hoặc `"chan"` dội
lại), và quan trọng nhất là **băm không gian**: truy vấn láng giềng O(n) thay vì
O(n²). Không có nó thì mọi lab bầy đàn chết ở khoảng 2000 tác tử.

```js
var HT = V.hat({ soToiDa: 4000, rong: 200, cao: 140, banKinh: 7, vien: "vong" });
HT.them(x, y, vx, vy, loai);
HT.dungBam();                         // MỘT lần mỗi bước, trước khi hỏi
HT.quanh(i, 7, function (j, dx, dy, d2) { ... });   // dx,dy đã tính đường vòng
HT.tien(1);                           // đổi chỗ + xử lý mép
```

> **Đừng tạo closure trong vòng nóng.** `HT.quanh(i, r, function (j) {...})` viết
> thế này sẽ tạo một closure mới cho **từng tác tử, từng bước**. Với 3000 tác tử ở
> 60 fps là 180 000 closure mỗi giây. Khai báo hàm một lần bên ngoài và dùng biến
> tích luỹ ở phạm vi ngoài — xem `lab-boids.js`.

**Đồ thị / mạng lưới** — `V.doThi(cv, {soToiDa, le, leTren, leDuoi})` cho lab làm
việc trên mạng. Lưu nút/cạnh (tra cứu cạnh **O(1)** nhờ bảng khoá), hai bố cục
sẵn, đổi toạ độ và bắt chuột. Toạ độ nút giữ trong `[0,1]²` nên đổi kích thước
canvas **không** phải tính lại bố cục.

```js
var DT = V.doThi(cv, { soToiDa: 400, le: 24, leTren: 28 });
DT.themNut(); DT.themCanh(0, 1);
DT.boCucTron();                 // hoặc DT.boCucLoXo(260, hạtGiống)
DT.veCanh(V.mau("bd"), 1, 0.7);
DT.veNut(function (i) { return V.mau("ac"); }, 9);
var i = DT.nutTai(chuột.x, chuột.y);
var ds = DT.danhSachKe();       // duyệt nhiều thì giữ lại, đừng gọi mỗi khung
```

`boCucLoXo` là O(n²) mỗi vòng — chạy **một lần** lúc dựng đồ thị, đừng gọi trong
vòng vẽ. Nó nhận hạt giống nên bố cục tái lập được.

**Số** — `V.soGon(v)` nhãn gọn cho trục: `12,3k` · `4,5 triệu` · `1,2×10¹²`

**Bộ phát** — `V.phat({datLai, buoc, ve, toiDa, tocDo, nhan, lap, bang, tua, hanTua, anh, phucHoi, chuKy})`.
`bang` bật nút lưu PNG và ghi video. `anh`/`phucHoi` bật tua theo mốc — bắt buộc
với sim nặng, nếu không mỗi lần tua phải diễn lại từ bước 0.

**Ngân sách mỗi khung hình.** `tocDo` là số bước mỗi giây, nhưng engine không biết
*một* bước đắt bao nhiêu — có thể là ba phép tính, cũng có thể là một hàng
Mandelbrot 500 vòng lặp. Nên mỗi khung có ngân sách `hanKhung` (mặc định **12 ms**);
hết hạn thì bỏ phần còn lại của khung đó thay vì để trang đứng hình.

**Ngân sách tua.** Tua là diễn lại từng bước, mà chi phí mỗi bước **phụ thuộc tham
số người dùng đặt** — một lưới 300×300 hay 3000 tác tử có thể ngốn hàng trăm giây và
đóng băng tab. Nên mỗi lần tua có ngân sách `hanTua` (mặc định **3000 ms**); hết
ngân sách thì dừng lại ở đó và thanh tua nhảy về đúng chỗ đã tới. Lab nào một bước
đã quá đắt (nấm nhầy: 28 ms) thì đặt `tua: false` — tua không cho được gì.

**Khác** — `V.rng(hat)` ngẫu nhiên tái lập được · `V.soLieu()` bảng số liệu ·
`V.khung(host, o)` bố cục + thanh công cụ

### Tắt bớt tính năng

Trong `assets/cau-hinh.js` của trang:

```js
tinhNang: { permalink: true, xuat: true, toanManHinh: true, tapTrung: true, phimTat: true }
```

---

## Ba khoá cũ chưa đồng bộ

`ai-everything-visual`, `heuristic-visual`, `system-design-visual` vẫn chạy bản
engine v1 riêng của chúng — **cố ý**, xem `dong-bo.json`. Engine v2 giữ nguyên
toàn bộ API v1, và `thu-nhanh.js` đã xác nhận cả 68 lab của ba khoá chạy sạch,
nên đồng bộ chỉ là thêm tên vào `dich` rồi chạy `sync.py` và mở lại kiểm tra.
