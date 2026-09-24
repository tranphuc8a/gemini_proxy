# Web Lab — kế hoạch đề tài

Lộ trình cho `courses/lab-visual/`. Cập nhật: 2026-09-24 (sau đợt 5).
Ngữ cảnh và trạng thái kỹ thuật: [`web-lab-visualize.md`](web-lab-visualize.md).

---

## 1. Nguyên tắc chọn đề tài

Một chủ đề đáng làm lab khi thoả **ít nhất 3/5**:

1. **Có "aha"** — người xem thấy điều phản trực giác.
2. **Có núm để vặn** — tham số đổi thì hành vi đổi rõ rệt, không phải hoạt hình một chiều.
3. **Trạng thái nhìn thấy được** — mô tả được bằng 2D/lưới/đồ thị.
4. **Chạy nổi trong trình duyệt** — vài chục ms mỗi bước, không cần máy chủ.
5. **Chữ viết bó tay** — đọc một đoạn văn là hiểu thì không cần lab.

Chủ đề rớt tiêu chí không phải là chủ đề tồi — nó chỉ là bài viết, không phải lab.

## 2. Nguyên tắc xếp thứ tự

Không xếp theo "cái nào hay nhất" mà theo **cái nào ép engine mọc thêm một
năng lực dùng lại được**. Mỗi đợt dưới đây gom những lab cùng đòi một thứ, để
thứ đó chỉ phải viết một lần rồi 4–6 lab sau dùng chung.

Nguyên tắc ngược lại cũng quan trọng: **không viết trước một thứ chưa có hai
lab cần nó.** `V.bieuDo` và `V.bangTichLuy` được thêm vào engine vì đếm được
22 tệp và 4 tệp đang chép tay chúng — không phải vì đoán trước.

## 3. Engine hiện có

| Năng lực | Trạng thái |
|---|---|
| Bộ phát (chạy/dừng/bước/tua/tốc độ/lặp) | ✅ |
| Tham số khai báo + ẩn hiện theo chế độ + permalink | ✅ |
| Biểu đồ: trục, lưới, nhãn, log, đường, mốc | ✅ `V.bieuDo` |
| Bảng tích luỹ (vẽ chồng dần) | ✅ `V.bangTichLuy` |
| Canvas co giãn, toàn màn hình, tập trung | ✅ |
| Xuất PNG, ghi video WebM | ✅ |
| Ngẫu nhiên tái lập, preset, phím tắt | ✅ |
| Cột / histogram | ✅ `B.cot` `B.cotDay` — đợt 1 đã mở |
| Nhãn số trên **trục ngang** | ✅ đợt 1 đã mở (trước chỉ có trục dọc) |
| Đối chiếu số tự động | ✅ `kiem-so.js` — đợt 1 đã mở |
| Lưới ô nhanh (ImageData) | ✅ `V.luoiO` — đợt 2 đã mở |
| Hệ tác tử + băm không gian | ✅ `V.hat` — đợt 3 đã mở |
| Ngân sách thời gian cho mỗi lần tua | ✅ đợt 3 đã mở |
| Tự kiểm tra nguyên hàm engine | ✅ `engine/thu-engine.js` — đợt 3 đã mở |
| Đồ thị / mạng lưới | ✅ `V.doThi` — đợt 4 đã mở |
| ~~Web Worker~~ | ⛔ **bỏ có chủ đích** — xem đợt 5 |
| Ngân sách thời gian cho mỗi khung hình | ✅ đợt 5 đã mở |
| **Nhiều khung so sánh** | ❌ đợt 6 mở |

---

## 4. Các đợt

### ✅ Đợt 1 — XONG (2026-09-24)

Cả 5 lab đã dựng và kiểm tra. Site hiện có **6 lab**.

| Lab | Điều nó cho thấy | Trạng thái |
|---|---|:--:|
| **Logistic map** | 3 chế độ: sơ đồ phân nhánh · mạng nhện · dãy số. Cửa sổ chu kỳ 3 giữa hỗn loạn | ✅ |
| **Fourier epicycles** | Kéo số vòng từ 1 lên; **vẽ tay bằng chuột** rồi để máy dựng lại | ✅ |
| **Xoắn ốc Ulam** | Kiểu Ulam + Sacks; bật hợp số để thấy đường chéo là *chỗ trống* | ✅ |
| **Monte Carlo π** | Ném điểm + kim Buffon, kèm dải sai số 95% co theo `1/√n` | ✅ |
| **Giới hạn trung tâm** | 5 nguồn, trong đó Pareto α=1,2 **làm định lý gãy** | ✅ |

**Engine đã mọc thêm:** `B.cot()` / `B.cotDay()` cho histogram · nhãn số trên
trục ngang (trước chỉ trục dọc có) · `x.hienSo` / `y.hienSo` / `x.vach` ·
`datTocDo()` đồng bộ luôn thanh trượt.

**Hai bug thật bị lộ ra và đã sửa:**

1. `dk()` chỉ dựng thanh tua khi `toiDa` đã biết *lúc dựng giao diện*, nhưng hầu
   hết lab gọi `datToiDa()` sau đó trong `apDung()` → **5/6 lab chưa từng có thanh
   tua**, kể cả Collatz.
2. Harness lấy `input[type=range]` cuối cùng làm thanh tua, nhưng thứ tự thật là
   `[tua] [tốc độ]` rồi mới tới slider tham số → test "tua" xưa nay kéo nhầm slider
   tham số, và chính nó che mất bug số 1.

### ✅ Đợt 2 — XONG (2026-09-24)

Cả 6 lab đã dựng và kiểm tra. Site hiện có **12 lab**.

| Lab | Điều nó cho thấy | Trạng thái |
|---|---|:--:|
| **Schelling** | Ngưỡng 3/8 — ai cũng chịu làm thiểu số — vẫn phân ly hoàn toàn | ✅ |
| **Game of Life** | 6 luật, 6 hình mẫu; bấm chuột sửa từng ô khi tạm dừng | ✅ |
| **256 luật một chiều** | Kèm bảng 8 quy tắc vẽ ra — toàn bộ định nghĩa của luật | ✅ |
| **Thấm** | Mở dần từng ô, thấy cụm lớn nhất nhảy vọt đúng tại p = 0,5927 | ✅ |
| **Đống cát** | Tổ chức đồ log–log thẳng ⇒ luật luỹ thừa; kèm kiểm tra bảo toàn hạt | ✅ |
| **Kiến Langton** | 6 luật turmite; dò được lúc đường cao tốc bắt đầu | ✅ |

**Engine đã mọc thêm:** `V.luoiO` — mỗi ô là một điểm ảnh trong `ImageData`
nhỏ, phóng to lên canvas bằng **một** lệnh `drawImage` (tắt làm mềm để ô sắc
cạnh). Kèm `V.mauSo` đổi chuỗi CSS thành ba số, và `leDuoi` để chừa chỗ cho
biểu đồ nằm dưới lưới trong cùng một canvas.

**Một bug thật bị lộ ra và đã sửa:** lab thấm ban đầu dùng hai nút ảo (bờ trên,
bờ dưới) trong union-find để dò thấu. Nhưng nút ảo **gộp mọi cụm chạm bờ trên
thành một**, khiến "cụm lớn nhất" bị thổi phồng. Thay bằng hai cờ chạm-bờ lưu
trên mỗi gốc cụm.

### ✅ Đợt 3 — XONG (2026-09-24)

Cả 5 lab đã dựng và kiểm tra. Site hiện có **17 lab**.

**Engine đã mọc thêm:** `V.hat` — mảng tác tử + **băm không gian** cho truy vấn
láng giềng O(n) thay vì O(n²), kèm xử lý mép nối vòng/dội lại.

**Hai bug thật bị lộ ra và đã sửa:**

1. **Băm không gian bỏ sót láng giềng ở chỗ nối vòng.** Lấy bề rộng ô = bán kính rồi
   làm tròn lên số ô thì ô cuối bị hụt (miền 100, ô 7 → 15 ô phủ 105), nên phép quét
   “lùi một ô” không đủ xa ngay tại đường nối. 319/2500 tác tử mất láng giềng.
   Sửa: chia số ô trước, bề rộng = miền / số ô.
2. **Tua có thể đóng băng tab 140 giây.** Tua là diễn lại từng bước, mà chi phí mỗi
   bước lại **phụ thuộc tham số người dùng đặt** — không thể chỉnh `toiDa` cho từng
   lab mà xong. Sửa ở engine: mỗi lần tua có **ngân sách 3 giây**, hết thì dừng lại ở
   đó và thanh tua nhảy về đúng chỗ đã tới.

**Một bài học về đo đạc:** lần đo đầu tiên chạy tất cả lab trong MỘT tiến trình và
cho kết quả nhiễu tới mức báo rằng tối ưu hoá làm mọi thứ **chậm đi**. Đo lại, mỗi lab
một tiến trình riêng, trung vị của 3 lần: boids thực ra đã nhanh lên 7,0 → 2,9 ms/bước.

#### Các lab đã dựng

| Lab | Điều nó cho thấy | Công |
|---|---|:--:|
| **Thí nghiệm sinh tồn xã hội** *(chủ đề gốc)* | Tài nguyên, sinh sản, cạnh tranh → bất bình đẳng tự mọc | L |
| **Boids** | 3 luật đơn giản → hành vi bầy đàn | M |
| **Dịch tễ SIR/SEIR** | R₀, miễn dịch cộng đồng, siêu lây nhiễm | M |
| **Kẹt xe ma & nghịch lý Braess** | Mở thêm đường làm kẹt hơn | M |
| **Nấm nhầy Physarum** | Bầy đàn tự tìm đường ngắn nhất | L |

Số đo chi phí mỗi bước (trung vị 3 lần, mỗi lần một tiến trình riêng):
nấm nhầy 27,7 ms · dịch tễ 4,7 · đàn chim 2,9 · sinh tồn 0,84 · Life 0,45 ·
Schelling 0,12 · kẹt xe 0,04 · thấm 0,03 · đống cát 0,01.

> **Lưu ý cho "thí nghiệm sinh tồn xã hội":** đây là lab rủi ro nhất trong danh
> sách. Nó thoả tiêu chí 1–4 nhưng dễ rơi vào cảnh "một đám chấm chạy loạn, đẹp
> mà không hiểu gì". Bắt buộc phải thiết kế phần **đọc được kết quả** trước phần
> mô phỏng: hệ số Gini theo thời gian, tháp dân số, cây phả hệ. Đừng viết dòng
> mô phỏng nào trước khi biết sẽ vẽ biểu đồ gì.

### ✅ Đợt 4 — XONG (2026-09-24)

Cả 4 lab đã dựng và kiểm tra. Site hiện có **21 lab**.

**Engine đã mọc thêm:** `V.doThi` — lưu trữ nút/cạnh với tra cứu cạnh O(1), bố cục
tròn và bố cục lò xo (Fruchterman–Reingold), đổi toạ độ, bắt chuột. 16 mục tự kiểm
tra mới trong `thu-engine.js`, trong đó có bất biến *tổng bậc = 2 × số cạnh*.

**Vài con số đối chiếu đẹp nhất của cả dự án nằm ở đợt này:**

- Bỏ 1 trong 6 máy: `băm % N` phải chuyển **83,1%** (lý thuyết 83,33), băm nhất
  quán chỉ **16,9%** (lý thuyết 16,67).
- Hệ số cụm của vòng thuần khớp **chính xác** công thức `3(k−2)/(4(k−1))` ở cả
  k = 4, 6, 8, 10.
- Raft **chưa bao giờ** có hai lãnh đạo cùng nhiệm kỳ, ở cả ba mức mất tin
  4% / 30% / 55%. Bỏ luật quá bán đi thì con số đó lập tức thành 32 lần vi phạm.

#### Các lab đã dựng

| Lab | Điều nó cho thấy | Công |
|---|---|:--:|
| **Đồng thuận Raft** | Kéo để ngắt mạng, giết node, xem bầu lại leader. Gần như không có bản tiếng Việt | L |
| **Thế giới nhỏ & mạng vô hướng tỉ lệ** | Sáu độ phân cách; vì sao hub xuất hiện | M |
| **Lan truyền tin trên mạng xã hội** | Buồng vọng, ngưỡng lan truyền | M |
| **Băm nhất quán** | Thêm/xoá node → bao nhiêu khoá phải di chuyển | S |

> **Một điều đáng ghi lại:** lab Raft tự đếm số lần **vi phạm tính an toàn** của
> chính nó (hai lãnh đạo cùng nhiệm kỳ) và in ra màn hình. Nhờ vậy `kiem-so.js`
> kiểm được *lời hứa của thuật toán*, chứ không chỉ kiểm "lab có chạy không".
> Lab nào có một tính chất phải luôn đúng thì nên làm như thế.

### ✅ Đợt 5 — XONG (2026-09-24)

Cả 4 lab đã dựng và kiểm tra. Site hiện có **25 lab**.

**Kế hoạch nói `V.thoNen` (Web Worker). Đã bỏ, có lý do:**

1. **Worker không tạo được từ trang `file://`** (Chrome chặn với `SecurityError`).
   Mà "nhấp đúp `index.html` là chạy" là lời hứa ghi trong mọi README của dự án.
2. **Đo lại thì chỉ Mandelbrot mới thật sự nặng**: vẽ cả khung tốn ~2,5 *giây*.
   Gray–Scott 14 ms/bước, N-body 150 vật 8 ms, con lắc/Lorenz gần như miễn phí.
3. **Chia nhỏ theo hàng giải quyết trọn vẹn** — và bộ phát sẵn có đã làm đúng việc
   đó: một bước = một hàng, 9 ms. Trang mượt, tạm dừng được, có thanh tiến độ.

**Thay vào đó engine mọc thêm thứ thật sự thiếu:** `phat` tính `n = dt × tocDo`
bước mỗi khung hình mà **không hề xem đồng hồ** — đúng loại lỗi đã sửa cho đường
*tua* ở đợt 3, nhưng đường *chạy* thì chưa. Nay mỗi khung có ngân sách `hanKhung`
(mặc định 12 ms). Đo lại: khung hình tệ nhất của cả 25 lab là **6,7 ms**.

#### Các lab đã dựng

| Lab | Điều nó cho thấy | Công |
|---|---|:--:|
| **Phản ứng–khuếch tán (Gray–Scott)** | Vân da báo từ 2 phương trình | M |
| **Mandelbrot / Julia** | Kéo `c` để thấy Julia biến hình theo | M |
| **Con lắc kép & Lorenz** | Lệch 0,0001° → phân kỳ hoàn toàn | S |
| **N-body & điểm Lagrange** | Hiệu ứng súng cao su hấp dẫn | M |

> **Một lỗi kiến thức bị tầng đối chiếu bắt.** Preset Julia tên "liền khối" dùng
> `c = −0,8 + 0,156i`. Giá trị đó nằm **ngoài** tập Mandelbrot (thoát sau 252 vòng),
> nên tập Julia của nó là **bụi** chứ không liền khối — nhìn thì không phân biệt
> được. Đã đổi sang thỏ Douady `−0,123 + 0,745i`, và giữ giá trị cũ lại làm một
> preset dạy học: *"⚠ Trông liền mà là bụi"*.
>
> Đây là lần đầu tầng đối chiếu bắt được **lỗi nội dung** chứ không phải lỗi mã.

### Đợt 6 — so sánh nhiều khung

| Lab | Điều nó cho thấy | Công |
|---|---|:--:|
| **Đua optimizer** | SGD vs Momentum vs RMSProp vs Adam trên cùng mặt lỗi | M |
| **Đấu trường metaheuristic** | Mở rộng bản đã có ở `heuristic-visual`, cho chọn địa hình | L |
| **t-SNE vs UMAP vs PCA** | Thấy t-SNE "bịa" ra cụm không có thật | L |

**Engine phải mọc:** `V.khungNhieu()` — nhiều canvas chung một bộ phát, chung
một hạt giống, chung một ngân sách. Đây là thứ khiến site khác biệt: hầu hết
trang trên mạng chỉ demo từng thuật toán riêng lẻ.

---

## 5. Thứ tự đề xuất

1. ~~`B.cot()` → **logistic map** → **Fourier epicycles**~~ ✅ xong
2. ~~`V.luoiO` → **Schelling** → **Life** → **percolation**~~ ✅ xong
3. `V.hat` → **SIR** → **boids** → **sinh tồn xã hội**  ← **tiếp theo**
4. ~~`V.thoNen` → **Gray–Scott** → **Mandelbrot**~~ ✅ xong (không cần Worker)
5. ~~`V.doThi` → **Raft**~~ ✅ xong
6. `V.khungNhieu` → **đua optimizer**  ← **tiếp theo**

Đợt 1–2 xong — 12 lab, site đủ dày để công bố. Đợt 3 trở đi là chiều sâu.

## 6. Định nghĩa "xong" cho một lab

Không tính là xong nếu thiếu bất kỳ mục nào:

- [ ] Khai báo tham số bằng `V.thamSo`, **không** tự ghép slider với biến trạng thái
- [ ] Ít nhất **2 preset** — một cái "bình thường", một cái làm nó hỏng
- [ ] Bộ phát có `toiDa` đúng, tua được; sim nặng thì có `anh`/`phucHoi`
- [ ] Canvas dùng `V.veBangCo` + `r.trai.classList.add("co")`
- [ ] Bảng số liệu nói được **con số then chốt**, không chỉ "bước thứ k"
- [ ] Khối `giaiThich` trả lời được: nhìn cái gì, vặn cái gì, và **điều bất ngờ là gì**
- [ ] Thêm ít nhất **một con số kiểm được bằng nguồn khác** vào `kiem-so.js`
- [ ] `python check.py --tinh` xanh
- [ ] Mở thật trong trình duyệt, cả giao diện sáng lẫn tối, cả màn hình hẹp

## 7. Rủi ro đã biết

| Rủi ro | Cách chặn |
|---|---|
| Lab đẹp mà không dạy được gì | Viết khối `giaiThich` **trước** khi viết mô phỏng. Không nghĩ ra "điều bất ngờ" thì bỏ đề tài |
| Tầng DOM giả không bắt được lỗi hình học | Vẫn phải mở thật một lần mỗi lab; cân nhắc cài playwright khi số lab vượt ~15 |
| Lab tính ra số sai mà vẫn "chạy sạch" | `kiem-so.js` — mỗi lab phải có ít nhất một con số đối chiếu được với nguồn độc lập |
| Engine phình theo từng lab | Chỉ đưa vào engine khi **đếm được ≥ 2 lab** đang chép tay cùng một đoạn |
| Ba khoá cũ trôi khỏi engine | `python engine/sync.py --kiem` trả exit 1 khi bản sao lệch — nối vào CI |
