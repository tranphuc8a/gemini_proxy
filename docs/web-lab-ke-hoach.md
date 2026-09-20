# Web Lab — kế hoạch đề tài

Lộ trình cho `courses/lab-visual/`. Cập nhật: 2026-09-20.
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
| **Cột / histogram** | ❌ đợt 1 mở |
| **Lưới ô nhanh (ImageData)** | ❌ đợt 2 mở |
| **Hệ tác tử + băm không gian** | ❌ đợt 3 mở |
| **Đồ thị / mạng lưới** | ❌ đợt 4 mở |
| **Web Worker** | ❌ đợt 5 mở |
| **Nhiều khung so sánh** | ❌ đợt 6 mở |

---

## 4. Các đợt

### Đợt 1 — không cần engine mới (mở `B.cot()`)

Chạy được ngay hôm nay với `V.bieuDo` + `V.bangTichLuy`. Chỉ thiếu vẽ cột.

| Lab | Điều nó cho thấy | Công |
|---|---|:--:|
| **Sơ đồ phân nhánh logistic map** | `r` tăng dần → 1 điểm → 2 → 4 → hỗn loạn. Cửa ngõ vào chaos trong 30 giây | S |
| **Fourier epicycles** | Tổng các vòng tròn quay vẽ ra hình bất kỳ. Dễ lan truyền nhất trong danh sách | M |
| **Monte Carlo π (kim Buffon)** | Ngẫu nhiên → hằng số chính xác; kèm đường hội tụ `1/√n` | S |
| **Định lý giới hạn trung tâm** | Cộng bất kỳ phân phối nào lại đều ra chuông. Cần `B.cot()` | S |
| **Xoắn ốc Ulam** | Số nguyên tố "ngẫu nhiên" nhưng vẽ xoắn ốc thì hiện đường chéo | S |

**Engine phải mọc:** `B.cot(x, cao, mau)` và `B.cotChum(...)` cho histogram.
Nhỏ, nhưng đợt 1 dùng 2/5 lab và về sau gần như lab nào cũng cần.

### Đợt 2 — lưới ô

| Lab | Điều nó cho thấy | Công |
|---|---|:--:|
| **Schelling segregation** | Thiên kiến rất nhẹ → phân ly hoàn toàn. "Aha" xã hội học mạnh nhất | M |
| **Game of Life** | Kinh điển; kèm thư viện hình mẫu (glider, gun) | S |
| **Rule 30 / Rule 110** | Quy tắc 1 chiều sinh ra ngẫu nhiên; 110 là Turing-đầy-đủ | S |
| **Percolation & ngưỡng tới hạn** | Chuyển pha đột ngột — kéo qua ngưỡng là thấy | M |
| **Đống cát tự tổ chức tới hạn** | Phân phối luỹ thừa mọc ra từ quy tắc tầm thường | M |
| **Kiến Langton** | 104 bước hỗn loạn rồi đột nhiên xây "đường cao tốc" | S |

**Engine phải mọc:** `V.luoiO(cv, {cot, hang})` — tô ô qua `ImageData` thay vì
`fillRect` từng ô. Bản đồ Collatz hiện dùng `fillRect` cho 120k ô; `ImageData`
nhanh hơn một bậc và là điều kiện để lưới 500×500 chạy mượt.

### Đợt 3 — tác tử & hạt

| Lab | Điều nó cho thấy | Công |
|---|---|:--:|
| **Thí nghiệm sinh tồn xã hội** *(chủ đề gốc)* | Tài nguyên, sinh sản, cạnh tranh → bất bình đẳng tự mọc | L |
| **Boids** | 3 luật đơn giản → hành vi bầy đàn | M |
| **Dịch tễ SIR/SEIR** | R₀, miễn dịch cộng đồng, siêu lây nhiễm | M |
| **Kẹt xe ma & nghịch lý Braess** | Mở thêm đường làm kẹt hơn | M |
| **Nấm nhầy Physarum** | Bầy đàn tự tìm đường ngắn nhất | L |

**Engine phải mọc:** `V.hat()` — mảng tác tử + băm không gian cho truy vấn lân
cận. Không có nó thì mọi lab bầy đàn đều là O(n²) và chết ở 2000 tác tử.

> **Lưu ý cho "thí nghiệm sinh tồn xã hội":** đây là lab rủi ro nhất trong danh
> sách. Nó thoả tiêu chí 1–4 nhưng dễ rơi vào cảnh "một đám chấm chạy loạn, đẹp
> mà không hiểu gì". Bắt buộc phải thiết kế phần **đọc được kết quả** trước phần
> mô phỏng: hệ số Gini theo thời gian, tháp dân số, cây phả hệ. Đừng viết dòng
> mô phỏng nào trước khi biết sẽ vẽ biểu đồ gì.

### Đợt 4 — đồ thị & mạng lưới

| Lab | Điều nó cho thấy | Công |
|---|---|:--:|
| **Đồng thuận Raft** | Kéo để ngắt mạng, giết node, xem bầu lại leader. Gần như không có bản tiếng Việt | L |
| **Thế giới nhỏ & mạng vô hướng tỉ lệ** | Sáu độ phân cách; vì sao hub xuất hiện | M |
| **Lan truyền tin trên mạng xã hội** | Buồng vọng, ngưỡng lan truyền | M |
| **Băm nhất quán** | Thêm/xoá node → bao nhiêu khoá phải di chuyển | S |

**Engine phải mọc:** `V.doThi()` — bố cục (lò xo hoặc tròn) + vẽ nút/cạnh + bắt
chuột để kéo nút.

### Đợt 5 — tính toán nặng

| Lab | Điều nó cho thấy | Công |
|---|---|:--:|
| **Phản ứng–khuếch tán (Gray–Scott)** | Vân da báo từ 2 phương trình | M |
| **Mandelbrot / Julia** | Kéo `c` để thấy Julia biến hình theo | M |
| **Con lắc kép & Lorenz** | Lệch 0,0001° → phân kỳ hoàn toàn | S |
| **N-body & điểm Lagrange** | Hiệu ứng súng cao su hấp dẫn | M |

**Engine phải mọc:** `V.thoNen()` — chạy bước mô phỏng trong Web Worker, bộ phát
nhận kết quả bất đồng bộ. Đây là thay đổi **kiến trúc**, không phải tiện ích: nó
đổi giao kèo của `phat()` từ đồng bộ sang có thể bất đồng bộ. Nên làm sớm hơn
nếu thấy lab đợt 2–3 bắt đầu giật.

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

1. `B.cot()` → **logistic map** → **Fourier epicycles**
   (hai lab đẹp nhất, rẻ nhất, chứng minh engine đủ dùng)
2. `V.luoiO` → **Schelling** → **Life** → **percolation**
3. `V.hat` → **SIR** → **boids** → **sinh tồn xã hội**
4. `V.thoNen` → **Gray–Scott** → **Mandelbrot**
5. `V.doThi` → **Raft**
6. `V.khungNhieu` → **đua optimizer**

Đợt 1–2 làm site đủ dày để công bố. Đợt 3 trở đi là chiều sâu.

## 6. Định nghĩa "xong" cho một lab

Không tính là xong nếu thiếu bất kỳ mục nào:

- [ ] Khai báo tham số bằng `V.thamSo`, **không** tự ghép slider với biến trạng thái
- [ ] Ít nhất **2 preset** — một cái "bình thường", một cái làm nó hỏng
- [ ] Bộ phát có `toiDa` đúng, tua được; sim nặng thì có `anh`/`phucHoi`
- [ ] Canvas dùng `V.veBangCo` + `r.trai.classList.add("co")`
- [ ] Bảng số liệu nói được **con số then chốt**, không chỉ "bước thứ k"
- [ ] Khối `giaiThich` trả lời được: nhìn cái gì, vặn cái gì, và **điều bất ngờ là gì**
- [ ] `python check.py --tinh` xanh
- [ ] Mở thật trong trình duyệt, cả giao diện sáng lẫn tối, cả màn hình hẹp

## 7. Rủi ro đã biết

| Rủi ro | Cách chặn |
|---|---|
| Lab đẹp mà không dạy được gì | Viết khối `giaiThich` **trước** khi viết mô phỏng. Không nghĩ ra "điều bất ngờ" thì bỏ đề tài |
| Tầng DOM giả không bắt được lỗi hình học | Vẫn phải mở thật một lần mỗi lab; cân nhắc cài playwright khi số lab vượt ~15 |
| Engine phình theo từng lab | Chỉ đưa vào engine khi **đếm được ≥ 2 lab** đang chép tay cùng một đoạn |
| Ba khoá cũ trôi khỏi engine | `python engine/sync.py --kiem` trả exit 1 khi bản sao lệch — nối vào CI |
