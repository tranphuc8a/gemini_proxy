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

---

## Lệnh

```bash
python sync.py                 # chép sang các trang trong dong-bo.json
python sync.py lab-visual      # chỉ một trang
python sync.py --tat-ca        # mọi thư mục *-visual
python sync.py --thu           # chỉ báo sẽ làm gì, không ghi
python sync.py --kiem          # bản sao có lệch nguồn không (exit 1 nếu lệch)

node thu-nhanh.js lab-visual   # chạy thật mọi lab của một trang, không cần trình duyệt

cd ../lab-visual && python check.py --tinh    # kiểm tra đầy đủ, không cần trình duyệt
```

---

## Ba tầng kiểm tra

`check.py` của mỗi trang chạy tuần tự, dừng ở tầng nào có sẵn công cụ:

1. **Tĩnh** — chỉ cần Python. Thứ tự nạp script, tệp thiếu/thừa, trường bắt buộc
   của mỗi lab, id trùng, bản sao engine lệch nguồn.
2. **Chạy thật trên DOM giả** — cần Node. Nạp đúng những tệp `index.html` khai
   báo, dựng mục lục, mở **từng lab**, bấm Chạy, bơm khung hình, đảo qua mọi lựa
   chọn của ô chọn đầu tiên, tua, và kiểm tra permalink. Bắt được lỗi runtime,
   biến chưa khai báo, lab ném ngoại lệ, bộ phát không vẽ.
   **Không** bắt được lỗi hình học — canvas ở tầng này chỉ đếm số lần gọi.
3. **Trình duyệt thật** — cần `pip install playwright`. Mở Chromium, bắt lỗi
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

**Biểu đồ** — `V.bieuDo(cv, {x, y, le, luoi})`. Trục, lưới, nhãn số, trục log,
`duong()` `doan()` `diem()` `moc()` `chu()`. Đừng tự vẽ trục nữa: 22/22 tệp lab
cũ đều chép tay đoạn này (620 lần gọi `fillText`), và đó chính là lý do nó
được đưa vào engine.

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

**Số** — `V.soGon(v)` nhãn gọn cho trục: `12,3k` · `4,5 triệu` · `1,2×10¹²`

**Bộ phát** — `V.phat({datLai, buoc, ve, toiDa, tocDo, nhan, lap, bang, anh, phucHoi, chuKy})`.
`bang` bật nút lưu PNG và ghi video. `anh`/`phucHoi` bật tua theo mốc — bắt buộc
với sim nặng, nếu không mỗi lần tua phải diễn lại từ bước 0.

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
