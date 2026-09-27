# Web Lab — kế hoạch đề tài

Lộ trình cho `courses/lab-visual/`. Cập nhật: 2026-09-27 (sau đợt 7).
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
| Nhiều khung so sánh | ✅ `V.khungNhieu` — đợt 6 đã mở |

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

### ✅ Đợt 6 — XONG (2026-09-25)

Cả 3 lab đã dựng và kiểm tra. Site hiện có **28 lab**.

**Engine đã mọc thêm:** `V.khungNhieu` — chia canvas thành lưới khung con, mỗi
khung tự mang sẵn `le` (cho `V.bieuDo`) và `leLuoi` (cho `V.luoiO`), cộng
`nen/vien/nhan/soPhu/trong/chua`. Kèm `leTrai`/`lePhai` cho `V.luoiO`. **19 mục
tự kiểm tra mới** trong `thu-engine.js` (41 → 59).

#### Các lab đã dựng

| Lab | Điều nó cho thấy |
|---|---|
| **Đua optimizer** | SGD · Momentum · RMSProp · Adam trên 5 mặt lỗi. Bước 60 trên yên ngựa: SGD còn ở f ≈ 1,1 trong khi RMSProp đã xuống 2×10⁻²⁰ |
| **Đấu trường metaheuristic** | Leo đồi · tôi luyện · GA · PSO, **cùng ngân sách gọi hàm**. Cùng địa hình, cùng hạt giống, chỉ đổi ngân sách → **người thắng đổi** |
| **Giảm chiều** | PCA · MDS · t-SNE · chiếu ngẫu nhiên. Bộ "quả cầu đều" không có cụm nào, t-SNE vẫn vẽ ra cụm |

#### Lệch so với kế hoạch, và vì sao

**Kế hoạch ghi "t-SNE vs UMAP vs PCA". UMAP không có trong bản dựng.** Cài
UMAP đúng nghĩa cần cả một bộ máy riêng (đại số fuzzy simplicial set + tối ưu
hoá bằng lấy mẫu âm), và viết tay một thứ gần giống rồi **dán nhãn "UMAP"**
thì sai với người học. Thay bằng **MDS (SMACOF)** và **chiếu ngẫu nhiên**:
cả hai cài đúng được trong vài chục dòng, và mỗi cái đẩy được một luận điểm
riêng (SMACOF có bất biến kiểm được; chiếu ngẫu nhiên cho thấy "không học
gì" đôi khi đủ tốt).

**Luận điểm của đấu trường đã bị số đo bác bỏ một lần rồi viết lại.** Bản
đầu viết sẵn "đổi địa hình thì thứ hạng đảo lộn". Đo thật trên 5 địa hình × 8
hạt giống: **PSO thắng gần như sạch mọi ô**. Phải sửa hai chỗ cài đặt yếu của
mình (leo đồi → (1+1)-ES với quy tắc 1/5 của Rechenberg; tôi luyện cho bước
đề xuất **co theo nhiệt độ**) rồi đo lại, và lúc đó mới hiện ra phép đảo
thật — **theo ngân sách, không phải theo địa hình**:

| Địa hình | ngân sách ≤ 2 000 | ngân sách ≥ 6 000 |
|---|---|---|
| Cầu | leo đồi thắng **8/8** | leo đồi thắng **0/8** |
| Ackley | leo đồi thắng **8/8** | leo đồi thắng **0/8** |

Bài học rút ra cho chính mình: **viết sẵn kết luận vào kế hoạch rồi đi dựng
lab để minh hoạ nó là làm ngược.** Đo trước, viết sau.

#### Ba bug thật bị lộ ra và đã sửa

1. **Đấu trường ăn gian ngân sách.** GA và PSO đánh giá cả quần thể trong một
   bước, nên khi ngân sách không chia hết cho cỡ quần thể chúng tiêu **lố tới
   23 lần gọi hàm** — đúng cái lời hứa mà lab lấy làm nền tảng. Không thấy ở
   lần đo đầu vì 6 000 / 24 = 250 chẵn. Ô *Vượt ngân sách* trên màn hình bắt
   được nó ngay khi hạ ngân sách xuống 1 000.
2. **Mặt "yên ngựa" của lab optimizer không có cận dưới** (`f = x² − 0,6y²`),
   nên "cuộc đua" chỉ là xem ai chạy ra vô cực nhanh hơn: hai thuật toán
   "phát nổ", một cái dừng ở −2 640. Thay bằng `f = (x²−1)² + 0,3y²` — vẫn có
   điểm yên ngựa tại gốc, nhưng có **hai đáy thật** ở (±1, 0).
3. **DOM giả không đọc được chữ ghi bằng `innerHTML`** — xem phần dưới.

#### Một lỗ hổng trong chính bộ kiểm tra

Đợt 3 thêm chốt chặn chống-tua-bị-cắt vào `chayToi()`: nếu ngân sách tua
cắt giữa chừng thì ném lỗi thay vì lặng lẽ đọc trạng thái sai. **Nó chưa bao
giờ chạy.** DOM giả lưu `innerHTML` vào `_html` nhưng `chuTrong()` chỉ đọc
`_text` và các nút con, nên nhãn bộ phát ("bước 65 / 600") **biến mất hoàn
toàn** khỏi mọi phép đo — `buocHienTai()` trả `NaN` cho **mọi lab**, kể cả
Collatz. Sửa `chuTrong()` đọc thêm `_html` (bỏ thẻ). Ngay lập tức bắt được hai
thứ:

- Phép **N-body** ghi "sau 2 000 bước" nhưng thực tế lâu nay chỉ đọc tới
  **bước 385** (100 vật = 4 950 cặp/bước, không lọt ngân sách tua 3 giây). Hạ
  xuống 40 vật để nó chạy trọn thật.
- Chốt chặn bắt nhầm trường hợp **xong sớm hợp lệ** (Schelling ngưỡng 0 thì
  không ai chuyển nhà → xong ở bước 1). Thêm `daXong()` để phân biệt.

**Không cần phép thử phủ định nhân tạo ở đợt này**: bộ kiểm đã tự bắt được
ba lỗi thật ở trên, đó là bằng chứng mạnh hơn.

---

### ✅ Đợt 7 — XONG (2026-09-27)

Cả 4 lab đã dựng và kiểm tra. Site hiện có **32 lab**. Bàn giao chi tiết — kể cả **bốn lần số đo bác bỏ câu tôi đã viết** và ba bug thật — ở
[`web-lab-dot-7-ban-giao.md`](web-lab-dot-7-ban-giao.md).

Engine mọc: `V.cayQuyetDinh` · `V.canThongTin` · `V.choiThu`. Tự kiểm tra nguyên hàm **59 → 96 mục**.

#### Kế hoạch ban đầu của đợt (giữ lại để đối chiếu)


Một nhóm hoàn toàn mới với site: **câu đố quyết định**. 93 lab hiện có
không có cái nào thuộc loại này.

| Lab | Điều nó cho thấy | Công |
|---|---|:--:|
| **Cân xu tìm xu giả** | Mỗi lần cân cho **3 kết cục**, nên 12 xu cần ≥ log₃(24) = 2,9 → **3 lần**. Cân thích ứng vs cân định sẵn trước | M |
| **Thả trứng tìm tầng cao nhất** | Với 2 trứng / 100 tầng, trực giác nói √100 = 10; đáp số đúng là **14** — và vì sao nó là số tam giác | M |
| **Đoán chuỗi n số (Mastermind)** | Thuật toán 5 nước của Knuth; so **minimax vs entropy vs đoán bừa**; n = 5 cần mấy lần | L |
| **Dồn hạt — bài thi tối ưu hoá** | ★ entropy trông như tốn N² nhưng tính đúng bằng **O(H+W)**; điểm tụ tối ưu là **trung vị**, không phải trung bình; bạn tự chơi rồi so điểm với thuật toán | L |

**Engine phải mọc — hai nguyên hàm, cả hai đều đếm được ≥ 2 lab cần:**

* `V.cayQuyetDinh` — dựng / bố cục / vẽ / đi theo **cây quyết định**, đo chiều sâu,
  và vẽ sẵn **cận dưới lý thuyết thông tin** (log_b của số kết cục).
  Cần bởi **5 lab**: cân xu, thả trứng, Mastermind, thuốc độc, thử chìa khoá.
* `V.choiThu` — chế độ **người dùng tự chơi**: nhận nước đi, chấm điểm so với
  chính sách tối ưu, giữ lịch sử, cho hoàn tác. **Đây là thứ biến lab thành
  game** — đúng chỗ danh sách ý tưởng nhắm tới. Cần bởi **≥ 5 lab**.

**Về lab "Dồn hạt"** — đây chính là hai ý số 8 và 9 trong danh sách
(*"giải bài expert entropy"* + *"lab game: tạo môi trường, user chọn giải pháp,
tính score"*). Luật chơi, lấy từ đề bài gốc:

* Lưới H×W với H, W ∈ [80, 180]; **30–50 % ô có hạt** (N ≈ 2 000 – 16 000).
* **Entropy** = tổng khoảng cách Manhattan của **mọi cặp hạt**.
* Mỗi lượt đẩy một hạt sang ô kề; ngân sách **40·H·W** nước. **Mỗi ô chỉ chứa
  được một hạt** — không chồng lên nhau được.
* Điểm = `10⁶ · ratio² + (ngân sách còn lại)/100`, với
  `ratio = (E₀ − E₁)/E₀`.

Bốn điểm đáng dựng:

1. **Entropy trông như tốn N²** (tới 10⁸ phép) nhưng Manhattan **tách được theo
   trục**: `Σ|yᵢ−yⱼ| + Σ|xᵢ−xⱼ|`, mỗi vế tính bằng đếm theo hàng/cột → **O(H+W)**.
   Đây là con số `kiem-so.js` đối chiếu được **tuyệt đối**: vét cạn N² phải khớp
   công thức tới từng đơn vị.
2. Điểm tụ tối ưu là **trung vị theo từng trục**, không phải trung bình — hệ quả
   trực tiếp của Manhattan, và là chỗ trực giác hay sai.
3. Không chồng hạt được, nên kết quả là một **quả cầu Manhattan** (hình thoi)
   xếp chặt, không phải một điểm.
4. Tối ưu lý thuyết là **một khối duy nhất** (entropy đếm cả cặp khác cụm), nhưng
   **ngân sách nước đi** có thể làm 2–3 khối tốt hơn. Cùng bài học "ngân sách đổi
   thì người thắng đổi" của đợt 6, ở một bài toán khác hẳn.

> **Không gắn tên công ty nào vào lab.** Đề gốc đến từ một kỳ thi nội bộ; lab
> mô tả nó như *một bài thi lập trình tối ưu hoá*, không quy cho bên nào — vừa
> tránh lộ nguồn, vừa không ngụ ý liên kết với một sản phẩm thương mại nào.

### ✅ Đợt 8 — XONG (2026-09-27)

Bốn lab: **L33 quân mã**, **L34 thử chìa khoá**, **L35 tìm thuốc độc**,
**L36 tháp Hà Nội**. Lab-visual: 32 → **36 lab**. `kiem-so.js`: 141 → **190
phép đối chiếu**. Tầng hình: **328 phép, 0 nhắc nhở**.

| Lab | Điều nó cho thấy | Đã đo |
|---|---|---|
| **L33 quân mã** | khoảng cách trên đồ thị ≠ khoảng cách hình học | a1→b2 (kề chéo) = **4 nước**, a1→e3 (xa gấp bốn) = **2**. Ô xa nhất: 4×4 → 5, 5×5 → 4, 8×8 → 6 |
| **L34 thử chìa khoá** | Θ(n log n) không nói gì về n nhỏ | n = 24 vét cạn thắng **8/8** hạt; n = 40 hoà **4/8**; n ≥ 56 thua **0/8**; n = 120 chậm hơn **2,2×** |
| **L35 tìm thuốc độc** | người × vòng ≥ log₂(số chai) | 1000 chai: 10×1, 2×5, 1×10 đều đủ; 9 bit **thiếu**. Hai chai độc: cận 7 bit, mã ngẫu nhiên cần **18** |
| **L36 tháp Hà Nội** | đồ thị trạng thái **đúng bằng** tam giác Sierpinski | công thức tổng quát khớp BFS ở **cả 6561** cấu hình n = 8; đường ngắn nhất giữa hai góc chạy dọc **một cạnh**, dài đúng 2ⁿ−1 |

**Ba điều đo được đã bác bỏ điều định viết:**

1. *"Preset bàn 4×4 có ô quân mã không bao giờ tới được"* — **sai**. Bàn 4×4
   **liên thông**, 0 ô chết. Chỉ 3×3 mới có ô cô lập (ô giữa, vì cả tám nước
   mã từ đó đều rơi ra ngoài bàn), mà `min` cạnh bàn lại đang là 4 — tức
   người dùng **không kiểm chứng được điều lab nói**. Đã hạ min về 3, đổi
   preset, và thay đoạn chữ bằng thứ đo được: bàn 5×5 (25 ô) **dễ đi hơn**
   bàn 4×4 (16 ô).
2. *"Chỗ hai đường cắt nhau ở n ≈ 48"* — chỗ lật **không phải một điểm mà là
   một dải**, và nó xê dịch theo hạt giống. Biểu đồ từng đánh dấu chỗ giao
   **đầu tiên**, vốn nhảy lung tung. Nay đánh dấu chỗ **dứt khoát**: n nhỏ
   nhất mà từ đó trở lên ngẫu nhiên thắng ở mọi cỡ đã đo.
3. *Phép nhúng Sierpinski của Hà Nội* — tập **điểm** đúng, nên tấm hình
   *trông* đúng, nhưng **cạnh** thì nối lung tung qua cả hình: cạnh dài nhất
   0,577 (hơn nửa chiều ngang tam giác) thay vì 0,036. Mắt thường không bắt
   được vì đám điểm không đổi; cái bắt được là **đường đi ngắn nhất** — nó
   phải chạy dọc một cạnh, mà ảnh chụp cho thấy nó zic-zac xuyên ruột.

**Engine không mọc thêm gì.** `V.lanSong` từng được đề xuất cho đợt này:
đếm lại thì chỉ **một** lab (quân mã) thật sự lan sóng BFS trên lưới — Hà Nội
dựng đồ thị Sierpinski chứ không lan sóng. Chưa đủ hai lab thì chưa tách.
Thứ duy nhất thêm vào engine là `p.sau` cho preset (đã làm ở đợt 7, xem dưới).

### ✅ Đợt 9 — XONG (2026-09-28)

Hai lab: **L37 chuỗi Markov**, **L38 Bloom filter**. Lab-visual: 36 → **38 lab**.
`kiem-so.js`: 190 → **221 phép**. Tầng hình: **346 phép, 0 nhắc nhở**.
*(“Địa hình thật cho heuristic” vẫn bỏ — chồng lấn nặng với L27/L28.)*

| Lab | Điều nó cho thấy | Đã đo |
|---|---|---|
| **L37 chuỗi Markov** | một con số của **ma trận** đoán trước được hành vi của **quá trình** | kéo cầu nối cho khe phổ chạy qua **bốn bậc độ lớn** (0,667 → 0,002) thì t_trộn phình **489 lần** (4 → 1957), mà tích `t_trộn × khe` vẫn kẹt trong **[2,7 ; 3,9]** |
| **L38 Bloom filter** | công thức mô tả **trung bình**, không phải **lời hứa** | băm tốt: dao động 9%, lệch công thức >10% ở **29%** số lần · băm xấu: dao động **39%**, lệch >10% ở **81%** số lần — mà trung bình chỉ lệch 15% |

**Engine không mọc thêm gì.** `V.lanSong` lại được cân nhắc rồi lại bỏ: Markov
không lan sóng BFS, nó lặp luỹ thừa ma trận. Vẫn chưa đủ hai lab chép tay.

**Bốn lần đo bác bỏ điều đã định viết** — nhiều nhất trong một đợt:

1. *“Băm xấu đắt hơn công thức 4–8%.”* Đo **một** hạt giống. Ở hạt 3 nó lại
   **rẻ hơn gấp đôi**. Qua 160 hạt: trung bình chỉ lệch 15%, còn **43%** số
   hạt thì băm xấu rẻ hơn thật. Luận điểm đúng là **“không đoán trước được”**,
   không phải “đắt hơn”.
2. *Đo bằng dải min–max.* Sai lần hai, ngay khi đang sửa lần một. min–max là
   thống kê **cực trị** — nó chỉ phình ra khi lấy thêm mẫu (đo được: 22% ở 8
   hạt → 48% ở 80 hạt), nên con số hiện trên màn hình đổi theo `SO_HAT` mà
   người đọc không biết. Tệ nhất là ô *“số k mà băm xấu rẻ hơn”*: lật từ
   **11/12** xuống **8/12** rồi **1/12** chỉ vì tăng số hạt — nhiễu đội lốt sự
   thật. Nay dùng **hệ số biến thiên** (σ/trung bình), là ước lượng có hội tụ.
3. *“Khe phổ = 2ε.”* Đo trên xích **2 đỉnh** rồi đem áp cho vòng **n đỉnh**.
   Công thức đúng là `1 − |ε + (1−ε)·e^(2πi/n)|`; ở n = 6, ε = 0,01 thì ra
   **0,0050** chứ không phải 0,0200 — **lệch gấp bốn**. Và ô *Kiểm* của lab chỉ
   in “thực tế …” chứ không báo SAI, nên nó lệch ở **mọi** giá trị mà không ai
   để ý. Một ô kiểm không biết kêu thì không phải ô kiểm.
4. *Hai hàm đo `|λ₂|` và `thoiGianTron` đều hỏng ở lần viết đầu.* `|λ₂|` không
   trừ trung bình mỗi vòng → thành phần dọc theo phân phối dừng rò rỉ vào, mà
   nó có trị riêng 1 nên không bao giờ tắt → **mọi** xích đều báo |λ₂| = 1, kể
   cả xích trộn trong 3 bước. Và vector khởi đầu cố định `[1,−1,0,…]` **trực
   giao sẵn** với mode chậm của xích hai cụm (các đỉnh cùng cụm có hàng giống
   hệt nhau), nên phép đo báo khe = 1 cho đúng cái xích trộn chậm nhất.

**Và ba lần phép thử đo đúng thứ không đáng đo:** `chayToi(160)` trên lab có
thanh tua dài 50 bước; một ngưỡng tuyệt đối đặt lên **một lần chạy đơn** của
Bloom (800 phép thử, biên độ ±2 điểm phần trăm); và `10^0 = 1` dùng làm “cầu
nối yếu” trong khi nó nặng **bằng** cạnh trong cụm.

### Đợt 10 — Nhận dạng chữ số viết tay, đầu cuối

| Lab | Điều nó cho thấy | Công |
|---|---|:--:|
| **Vẽ số bằng chuột → mạng đoán** | ★ FNN vs CNN trên **cùng chữ bạn vừa viết**; softmax hiện độ tự tin từng lớp | XL |

---

## 4b. Phân loại danh sách ý tưởng ngày 2026-09-27

16 ý tưởng, đối chiếu với **93 lab đã có** trên 4 site và với 5 tiêu chí ở mục 1.

### ✅ Nhận — đủ tiêu chí, không trùng lab nào (9 ý)

Cân xu · thả trứng · đoán chuỗi số · thuốc độc · thử chìa khoá · tháp Hà Nội ·
hai quân mã · Bloom filter · chuỗi Markov. Đã xếp vào đợt 7–9 ở trên.

### ⚠ Nhận có điều kiện (2 ý)

**"Heuristic trên vùng đồi núi thật sự"** — phần *thuật toán* **đã có 7 lab**:
`dia-hinh-toi-uu`, `leo-doi`, `simulated-annealing`, `dan-kien`, `di-truyen`,
`bay-dan-pso`, `dua-thuat-toan` (heuristic-visual) và `dau-truong` (lab-visual).
Thứ **duy nhất** còn mới là chính **địa hình**: thay hàm chuẩn (Rastrigin,
Ackley…) bằng địa hình fractal sinh bằng diamond-square, vẽ bóng đổ kiểu bản
đồ địa hình. Đề xuất: **không dựng lab mới**, mà thêm địa hình fractal làm
một lựa chọn trong `dau-truong` — công nhỏ, không đẻ thêm lab trùng.

**"CNN + FNN + softmax nhận dạng chữ số"** — các *thành phần* đều đã có trong
`ai-everything-visual`: `cnn-duong-ong`, `tich-chap`, `truong-thu-nhan`,
`mang-lan-truyen-tien`, `huan-luyen-mlp`, `backprop-tung-buoc`,
`softmax-nhiet-do`. Cái **chưa có** là mạch đầu-cuối: *bạn vẽ một chữ số bằng
chuột rồi xem nó được phân loại*. Đó mới là phần đáng dựng.

> **Vấn đề chưa có lời giải: lấy dữ liệu huấn luyện ở đâu?** Dự án hứa
> *chạy offline bằng `file://`, không thư viện ngoài*, và `vercel-bundle-size.md`
> cho thấy kích thước gói đang là vấn đề sống. Nhúng MNIST thật là thêm
> hàng trăm KB dữ liệu vào repo.
>
> **Đề xuất:** sinh dữ liệu huấn luyện **bằng nét vẽ thủ tục** (mỗi chữ số là
> vài đoạn cong, jitter affine ngẫu nhiên), huấn luyện ngay trong trình duyệt.
> Không tệp dữ liệu nào, và **bản thân việc nó hỏng lại là bài học**: mạng huấn
> luyện trên chữ viết tổng hợp sẽ **đoán tệ hẳn** trên chữ viết tay thật của bạn —
> đó chính là *trôi phân phối*, và site đã có lab `troi-du-lieu` để nối sang.
>
> **Đã chốt (2026-09-27): sinh thủ tục, huấn luyện trong trình duyệt.**

### ✅ Đã rõ — hai ý "bài expert" gộp thành một lab (2 ý)

Đề bài đã đọc. Cả hai ý — *"giải bài entropy"* và *"lab game: tạo môi trường,
user chọn giải pháp, tính score"* — là **hai nửa của cùng một lab**: lab
**Dồn hạt** ở đợt 7 vừa trình bày lời giải thuật toán, vừa cho người dùng tự
chơi rồi chấm điểm theo đúng công thức của đề. Chi tiết ở phần đợt 7.

Có thêm bài expert khác thì dựng thêm lab theo cùng khuôn — `V.choiThu` là hạ
tầng dùng chung.

### ❌ Không phải lab (3 ý)

Mục 1 nói rõ: *"Chủ đề rớt tiêu chí không phải là chủ đề tồi — nó chỉ là
bài viết, không phải lab."* Ba ý này không có **núm để vặn** và không có
**điều bất ngờ** — chúng là **ứng dụng** hoặc **tài liệu**, nên thuộc
`webapp/` chứ không thuộc `courses/*-visual/`:

| Ý | Nó thật ra là gì | Chỗ đúng |
|---|---|---|
| Web JSON editor thân thiện | công cụ | `webapp/tranphuc8a/` — cạnh `markdown-editor-pro` |
| Design pattern cheat sheet | tài liệu tra cứu | trang tĩnh, hoặc một `*-course` |
| Ứng dụng quản lý chi tiêu | ứng dụng có dữ liệu riêng | dự án riêng — cần lưu trữ, không chạy `file://` được |

**✅ ĐÃ LÀM XONG (2026-09-27)** — cả ba đều ở `webapp/tranphuc8a/`, **178 phép kiểm**,
204 KB tổng cộng. Bàn giao: [`ba-ung-dung-ngoai-lab.md`](ba-ung-dung-ngoai-lab.md).

| Ứng dụng | Đường dẫn | Phép kiểm |
|---|---|:--:|
| JSON Editor | `tranphuc8a/json-editor` | 58 |
| Mẫu thiết kế | `tranphuc8a/design-pattern` | 36 |
| Chi tiêu | `tranphuc8a/chi-tieu` | 84 |

Chúng giữ nguyên ràng buộc của `courses/` (không thư viện ngoài, chạy `file://`,
có `kiem.js`) — 60–80 KB mỗi cái, so với `markdown-editor-pro` là 7,5 MB.

---

## 5. Thứ tự đề xuất

1. ~~`B.cot()` → **logistic map** → **Fourier epicycles**~~ ✅ xong
2. ~~`V.luoiO` → **Schelling** → **Life** → **percolation**~~ ✅ xong
3. ~~`V.hat` → **SIR** → **boids** → **sinh tồn xã hội**~~ ✅ xong
4. ~~`V.thoNen` → **Gray–Scott** → **Mandelbrot**~~ ✅ xong (không cần Worker)
5. ~~`V.doThi` → **Raft**~~ ✅ xong
6. ~~`V.khungNhieu` → **đua optimizer**~~ ✅ xong
7. `V.cayQuyetDinh` + `V.choiThu` → **cân xu** → **thả trứng** → **đoán chuỗi số** → **dồn hạt**  ← ✅ xong
7b. Ba ứng dụng ngoài lab (JSON editor · cheat sheet · quản lý chi tiêu)
8. (dùng lại) → **thuốc độc** → **thử chìa khoá** → **Hà Nội** → **hai quân mã**
9. **chuỗi Markov** → **Bloom filter**
10. **vẽ số bằng chuột → mạng đoán** (cần chốt nguồn dữ liệu trước)

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
