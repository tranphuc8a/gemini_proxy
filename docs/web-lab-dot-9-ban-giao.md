# Đợt 9 — bàn giao

**Ngày:** 2026-09-28 · **Nhánh:** `lab/dot-7-va-kiem-trinh-duyet`

Hai lab về **ngẫu nhiên và hội tụ**. `lab-visual` đi từ 36 lên **38 lab**.

Đợt này có một đặc điểm đáng ghi: **bốn lần đo bác bỏ điều đã định viết**, và
hai trong bốn lần là *lỗi của chính phép đo*, không phải của lý thuyết.

---

## 1. Đã làm gì

| Mã | Lab | Tệp | Điều nó cho thấy |
|---|---|---|---|
| L37 | Chuỗi Markov — hội tụ, khe phổ, thời gian trộn | `assets/lab-markov.js` | một con số của **ma trận** đoán trước được hành vi của **quá trình** |
| L38 | Bloom filter — công thức mô tả trung bình, không phải lời hứa | `assets/lab-bloom.js` | công thức giả định k hàm băm **độc lập**; bỏ giả định ấy thì mất khả năng cam kết |

Cả hai nằm trong nhóm mới **“Ngẫu nhiên & hội tụ”**.

---

## 2. Con số đã đo

### L37 — chuỗi Markov

Hai cụm 3 đỉnh nối nhau bằng một cạnh yếu (“cầu”). Kéo cầu xuống:

| cầu | \|λ₂\| | khe = 1−\|λ₂\| | t_trộn (tới 1%) | **t_trộn × khe** |
|---:|---:|---:|---:|---:|
| 0,5 | 0,333 | 0,667 | 4 | **2,67** |
| 0,1 | 0,818 | 0,182 | 20 | **3,64** |
| 0,02 | 0,961 | 0,039 | 98 | **3,84** |
| 0,005 | 0,990 | 0,0099 | 392 | **3,90** |
| 0,001 | 0,998 | 0,0020 | 1957 | **3,91** |

Khe đi qua **bốn bậc độ lớn**, t_trộn phình **489 lần**, mà tích vẫn kẹt trong
một khoảng hẹp. Đó là toàn bộ luận điểm: **đo một trị riêng là biết trước phải
chạy bao nhiêu bước**, không cần chạy thử.

Xích tuần hoàn (vòng n đỉnh, không tự lập): khe **đúng bằng 0**, ba khởi đầu
dao động mãi mãi. Thêm ε tự lập thì khe bật khỏi 0 theo công thức đóng
`1 − |ε + (1−ε)·e^(2πi/n)|`:

| n | ε=0,01 | ε=0,05 | ε=0,2 | ε=0,5 |
|---:|---:|---:|---:|---:|
| **2** | **0,0200** | 0,1000 | 0,4000 | 1,0000 |
| 6 | 0,0050 | 0,0240 | 0,0835 | 0,1340 |
| 12 | 0,0013 | 0,0064 | 0,0217 | 0,0341 |

### L38 — Bloom filter

160 hạt giống, 4 000 phép thử mỗi hạt (m = 1024, k = 5, n = 200; công thức = 0,0942):

| | trung bình | σ | **dao động** (σ/tb) | 10–90% | lệch công thức >10% |
|---|---:|---:|---:|---|---:|
| băm tốt | 0,0945 | 0,0089 | **9%** | 0,0835 … 0,1072 | **29%** số lần |
| băm xấu | 0,1081 | 0,0418 | **39%** | 0,0580 … 0,1645 | **81%** số lần |

Trung bình chỉ lệch 15%, nhưng **độ dao động gấp 4,3 lần**. Và ở **43%** số
hạt, băm xấu lại cho tỉ lệ *thấp hơn*.

---

## 3. Bốn lần đo bác bỏ điều đã định viết

### 3.1 “Băm xấu đắt hơn công thức 4–8%” — sai, vì đo một hạt giống

Phép đo đầu tiên lấy trung bình 12 hạt và ra “+4,3% … +8,0%”. Viết vào lab,
chạy thử, và biểu đồ **nói ngược lại**: ở hạt 3 băm xấu cho 0,048 còn băm tốt
0,097 — rẻ hơn gấp đôi.

Đo lại qua 160 hạt: **43%** số hạt thì băm xấu rẻ hơn thật. Nên luận điểm đúng
không phải *“đắt hơn”* mà là **“không đoán trước được”**. Công thức vẫn mô tả
đúng cái trung bình, nhưng nó **mất tư cách làm một lời hứa** — và với một bộ
lọc chặn truy vấn đĩa hay lọc spam, “trung bình thì ổn” không phải điều bạn cần
biết.

### 3.2 Đo bằng dải min–max — sai lần hai, ngay khi đang sửa lần một

Bản sửa đầu vẽ **dải min–max** qua 8 hạt giống. Nhưng min–max là thống kê
**cực trị**: nó chỉ có thể phình ra khi lấy thêm mẫu.

| số hạt | 8 | 16 | 40 | 80 |
|---|---:|---:|---:|---:|
| băm tốt | 22% | 36% | 47% | 48% |
| băm xấu | 147% | 206% | 192% | 194% |

Con số hiện trên màn hình đổi theo `SO_HAT` mà người đọc không có cách nào
biết. Tệ nhất là ô *“số k mà băm xấu rẻ hơn”*: nó lật từ **11/12** (8 hạt)
xuống **8/12** (16 hạt) rồi **1/12** (24 hạt). Một con số trông rất chắc chắn
mà thật ra là nhiễu — đúng loại thứ lab này tồn tại để chống lại.

Nay dùng **hệ số biến thiên** (σ / trung bình), là ước lượng có hội tụ (11,5% ở
20 hạt so với 11,1% ở 160 hạt), và vẽ dải **10–90%** thay cho min–max.

### 3.3 “Khe phổ = 2ε” — đo trên xích 2 đỉnh, đem áp cho vòng n đỉnh

Công thức đúng là `1 − |ε + (1−ε)·e^(2πi/n)|`. Ở n = 6, ε = 0,01 nó cho
**0,0050** chứ không phải 0,0200 — **lệch gấp bốn**. `2ε` chỉ là trường hợp
riêng n = 2, khi ω = −1.

> **Và đây mới là phần đáng ghi:** ô *Kiểm* của lab chỉ in `"thực tế …"` khi
> lệch, chứ **không báo SAI**. Nên nó lệch ở *mọi* giá trị tự lập, ngay trên
> màn hình, mà không ai để ý — kể cả tôi, cho tới khi `kiem-so.js` đổ. Một ô
> kiểm không biết kêu thì không phải ô kiểm. Đây là lần thứ **năm** chủ đề này
> quay lại trong dự án.

### 3.4 Cả hai hàm đo phổ đều hỏng ở lần viết đầu

**`|λ₂|`:** lặp luỹ thừa mà không trừ trung bình mỗi vòng thì một chút thành
phần dọc theo phân phối dừng rò rỉ vào. Thành phần ấy có trị riêng 1 nên
**không bao giờ tắt**, và sau vài trăm vòng nó nuốt hết — phép đo báo
|λ₂| = 1 cho **mọi** xích, kể cả xích trộn trong 3 bước.

**Vector khởi đầu:** `[1,−1,0,…]` **trực giao sẵn** với mode chậm của xích hai
cụm, vì các đỉnh trong cùng cụm có hàng giống hệt nhau — nên `vP = 0` ngay
bước đầu, và phép đo báo khe = **1,0** cho đúng cái xích trộn **chậm nhất**
(t_trộn = 1957). Phải khởi đầu ngẫu nhiên, và thử vài lần lấy cái lớn nhất.

Hai lỗi này sai theo **hai hướng ngược nhau**, nên không lỗi nào lộ ra khi
nhìn riêng lẻ.

---

## 4. Ba lần phép thử đo đúng thứ không đáng đo

Khác với mục 3 (lab sai), đây là `kiem-so.js` sai:

1. **`chayToi(160)`** trên một lab có thanh tua dài **50 bước**
   (`datToiDa = 2·t_trộn + 10`). Đổi sang đo ở hai mốc và kiểm **tỉ lệ co** —
   vốn mới là điều lab khẳng định (hội tụ theo cấp số nhân).
2. **Ngưỡng tuyệt đối đặt lên một lần chạy đơn** của Bloom: 800 phép thử cho
   biên độ lấy mẫu ±2 điểm phần trăm, cộng biến thiên theo hạt giống — ở hạt 3
   đo được 12,375% so với công thức 9,415%, lệch 31%. Con số đáng kiểm là
   **trung bình 20 hạt** (9,56%, lệch 1,5%).
3. **`10^0 = 1` dùng làm “cầu nối yếu”** — nó nặng *bằng* cạnh trong cụm, nên
   xích thành đều tăm tắp và chẳng còn nút cổ chai nào. Giá trị đúng là
   `10^(−0,301) = 0,5`.

Cả ba đều xanh-đỏ theo vận may chứ không theo tính đúng.

---

## 5. Trạng thái kiểm tra

| Tầng | Kết quả |
|---|---|
| Tĩnh (`lab-visual/check.py --tinh`) | **Đạt** — 0 lỗi, 0 nhắc nhở |
| Nguyên hàm engine (`thu-engine.js`) | **Đạt** |
| DOM giả (`thu-nhanh.js lab-visual`) | **Đạt** — 104 mục, 38/38 lab |
| Đối chiếu số (`kiem-so.js`) | **Đạt** — **221 phép** (trước: 190) |
| Hình ảnh (`kiem_hinh.py lab-visual`) | **Đạt** — **346 phép, 0 nhắc nhở** |
| Ba ứng dụng (`tranphuc8a/kiem-tat.js`) | **Đạt** — 178 phép |

---

## 6. Còn nợ

Không đổi so với đợt 8:

1. **Ba site `*-course` có `check.py` chưa bao giờ chạy được** — `import kiem`
   từ `engine/kiem.py`, tệp đó không tồn tại, và `sys.path` trỏ sai một cấp.
   Cần viết mới một bộ kiểm cho site kiểu *nội dung* (`content.json`).
2. **`pytest` chưa cài ở máy này** (CI chạy được). Đợt 9 không đụng tệp Python
   nào của backend.
3. **Đồng bộ engine v2 sang ba khoá cũ** — vẫn cố ý để nguyên.

---

## 7. Việc tiếp theo

**Đợt 10 — nhận dạng chữ số viết tay, đầu cuối:** vẽ số bằng chuột → FNN và CNN
giả lập cùng đoán, softmax hiện độ tự tin từng lớp. Sinh dữ liệu thủ tục và
huấn luyện ngay trong trình duyệt. Đây là lab **XL** đầu tiên, và là lab đầu
tiên có phần huấn luyện thật.
