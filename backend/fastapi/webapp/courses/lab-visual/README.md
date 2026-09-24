# Web Lab trực quan

Phòng thí nghiệm cho những thứ **không hình dung nổi bằng chữ**: thuật toán, hệ
động lực, quy trình. Khác với ba trang `*-visual` kia — vốn là phụ lục của một
khoá học — trang này **đứng một mình**.

> **Không Node, không npm, không thư viện ngoài.** HTML + CSS + JavaScript thuần.
> Mọi thuật toán **chạy thật trong trình duyệt bạn**, không phải hoạt hình dàn dựng.
> (Node chỉ dùng cho công cụ kiểm tra ở máy phát triển.)

---

## Chạy

**Nhanh nhất:** nhấp đúp [`index.html`](index.html). Chạy được bằng `file://` vì
không có `fetch` nào.

```bash
python -m http.server 8792 --bind 127.0.0.1
# mở http://127.0.0.1:8792
```

---

## 25 lab

| Nhóm | Lab | Điều nó cho thấy |
|---|---|---|
| **Giả thuyết Collatz** | Collatz 3n+1 — bốn cách nhìn | quỹ đạo · cây ngược · hoa văn xếp chồng · bản đồ thời gian dừng |
| **Hệ động lực & hỗn loạn** | Logistic map — đường vào hỗn loạn | sơ đồ phân nhánh · mạng nhện · dãy số · ★ **cửa sổ chu kỳ 3** nằm giữa hỗn loạn |
| **Tự động tế bào** | Game of Life | 6 luật, 6 hình mẫu · ★ **R-pentomino**: 5 ô chạy 1103 thế hệ · bấm chuột sửa từng ô |
| | 256 luật một chiều của Wolfram | ★ luật **90** vẽ Sierpiński, **30** cho ra ngẫu nhiên, **110** là Turing đầy đủ |
| | Thấm — chuyện gì xảy ra tại 59,27% | mở dần từng ô · ★ cụm lớn nhất **nhảy vọt** đúng tại ngưỡng |
| | Đống cát tự tổ chức tới hạn | ★ tổ chức đồ log–log **thẳng** ⇒ không có cỡ trận lở điển hình |
| | Kiến Langton | ★ 10 000 bước hỗn loạn rồi **đột nhiên** xây đường cao tốc chu kỳ 104 |
| **Bầy đàn & tác tử** | Đàn chim (boids) | ★ tắt từng luật một để thấy luật nào giữ đàn lại · độ đồng hướng là một **chuyển pha** |
| | Dịch tễ SIR | ★ **miễn dịch cộng đồng** nhìn thấy được · "làm phẳng đường cong" không phải ẩn dụ |
| | Kẹt xe ma & nghịch lý Braess | ★ đường vòng không đèn vẫn kẹt · ★ **mở thêm đường, ai cũng chậm hơn 15 phút** |
| | Nấm nhầy Physarum | ★ mạng lưới chỉ sống trong một **dải hẹp** của tốc độ bay hơi |
| **Hệ động lực & hỗn loạn** | Phản ứng khuếch tán Gray–Scott | ★ vân da báo từ **hai con số**; Turing đề xuất 1952 |
| | Hiệu ứng cánh bướm | ★ đo được: phân kỳ theo hàm mũ, và chính xác gấp triệu lần chỉ **trì hoãn** |
| | Hấp dẫn N vật & điểm Lagrange | ★ L4/L5 ổn định khi μ < 0,0385 — chỗ một triệu tiểu hành tinh Trojan đang nằm |
| **Toán & số học** | Mandelbrot & Julia | ★ bấm để phóng to vô hạn · ★ preset **"trông liền mà là bụi"** |
| **Toán & số học** | Fourier — vẽ hình bằng vòng tròn quay | kéo số vòng từ 1 lên · ★ **vẽ tay bằng chuột** rồi để máy dựng lại |
| | Xoắn ốc Ulam — trật tự trong số nguyên tố | ★ bật hợp số để thấy đường chéo là **chỗ trống** |
| **Xác suất & ngẫu nhiên** | Monte Carlo — ngẫu nhiên ra hằng số | ném điểm · kim Buffon · ★ sai số co theo **1/√n**, thêm 1 chữ số phải thử **gấp 100** |
| | Giới hạn trung tâm | n = 1 → 2 → 5 · ★ phân phối **đuôi nặng làm định lý gãy** |
| **Mạng lưới & phân tán** | Băm nhất quán | ★ bỏ 1 trong 6 máy: `băm % N` chuyển **83%** khoá, băm nhất quán chỉ **17%** |
| | Thế giới nhỏ & mạng vô hướng tỉ lệ | ★ đổi **3%** quan hệ → đường đi sụp 63%, cụm chỉ giảm 10% |
| | Lan truyền trên mạng | ★ chỉ đủ vắc-xin cho 10% — **tiêm cho ai?** Mẹo "bạn của người ngẫu nhiên" |
| | Đồng thuận Raft | ★ bấm chuột **giết máy** và **cắt mạng**; giết quá nửa thì cụm đứng hình |
| **Xã hội & trò chơi** | Schelling — phân ly | ★ ngưỡng **3/8** (ai cũng chịu làm thiểu số) vẫn phân ly hoàn toàn |
| | Sinh tồn xã hội (Sugarscape) | ★ Gini **0,48** dù không ai bóc lột ai; tắt chênh lệch bẩm sinh + địa lý → **0,26** |
### Chi tiết vài chỗ đáng chú ý

- **Collatz** — tắt trục log để thấy vì sao cần trục log: một đỉnh duy nhất nuốt
  hết phần còn lại. `n = 27` → 111 bước, vọt lên 9232.
- **Logistic map** — thu khoảng r về 3,82–3,86: giữa vùng hỗn loạn hiện ra chu kỳ 3,
  và bên trong nó lại là một sơ đồ phân nhánh y hệt thu nhỏ.
- **Game of Life** — R-pentomino chỉ 5 ô nhưng quẫy 1103 thế hệ mới chịu dừng.
  Không có cách nào biết trước con số đó ngoài việc chạy thử.
- **256 luật một chiều** — bảng 8 quy tắc vẽ ngay bên phải *là toàn bộ định nghĩa*
  của luật. Luật 184 là mô hình kẹt xe: mật độ dưới 0,5 thì thoát, trên 0,5 thì kẹt.
- **Thấm** — tăng cạnh lưới từ 60 lên 220 và so: lưới càng lớn bước nhảy càng dốc
  đứng. Đó chính là định nghĩa của một chuyển pha.
- **Đống cát** — thả ở giữa cho ra hoa văn fractal; thả ngẫu nhiên cho ra trạng thái
  tới hạn. Bảng số liệu có dòng **kiểm tra bảo toàn hạt** — một bất biến chính xác.
- **Fourier** — chọn chế độ ✏️ rồi giữ chuột vẽ hình khép kín bất kỳ (chữ ký cũng
  được). Bảng số liệu cho **sai số còn lại** — câu trả lời định lượng cho "bao
  nhiêu vòng là đủ".
- **Monte Carlo** — đây là lý do Monte Carlo *không* dùng để tính π thật, nhưng
  lại là công cụ duy nhất khả thi ở hàng trăm chiều: sai số `1/√n`
  **không phụ thuộc số chiều**.
- **Giới hạn trung tâm** — chọn Pareto α=1,2: phương sai vô hạn nên định lý không
  áp dụng được, và tổ chức đồ **không** thành chuông dù n = 40. Thu nhập, quy mô
  thành phố, thiệt hại bảo hiểm đều có đuôi nặng như thế.
- **Schelling** — hạ ngưỡng xuống 0/8 thì không ai nhúc nhích. Ngưỡng làm mô hình
  gãy nằm rất thấp, và đó mới là điều đáng sợ.
- **Đàn chim** — tắt cả ba lực: không thành đàn. Bật mỗi “đi cùng hướng”: độ đồng
  hướng đi từ 0,43 (300 bước) lên 0,86 (1000 bước). Cùng loại toán với nam châm.
- **Dịch tễ** — kéo tỉ lệ tiêm lên từng nấc: đỉnh dịch tụt trước, rồi tới khoảng 70%
  dịch **không bùng nổi** dù 30% dân vẫn có thể mắc. Bảng số liệu đo **R thực tế**.
- **Braess** — hai con số tính tay được: chưa có cầu **65 phút**, mở cầu miễn phí thành
  **80 phút**. Seoul 2005 và New York 1990 đều từng đóng một trục và giao thông tốt lên.
- **Nấm nhầy** — đẩy bay hơi lên 0,28 thì vết tan trước khi kịp hút ai; hạ xuống 0,008
  thì cả khung sáng đều. Mạng chỉ xuất hiện ở khoảng giữa.
- **Sinh tồn xã hội** — ba nút bấm tách được hai nguồn của bất bình đẳng. Chúng
  **không cộng tuyến tính**: bỏ riêng từng cái chỉ bớt vài phần trăm (0,48 → 0,41 hoặc
  0,44), bỏ cả hai mới sụp hẳn xuống **0,26**.
- **Băm nhất quán** — kéo **số bản sao ảo** từ 1 lên 200: lệch tải đi từ 299% xuống
  18%, mà số khoá phải chuyển thì *không* tăng theo. Đó là chỗ mẹo này ăn tiền.
- **Thế giới nhỏ** — kéo p rất chậm từ 0. Hệ số cụm của vòng thuần khớp chính xác
  công thức `3(k−2)/(4(k−1))`, và bảng số liệu tự báo khi bạn **đang ở vùng thế
  giới nhỏ**.
- **Lan truyền** — trên mạng có siêu nút, tiêm 10% ngẫu nhiên gần như vô dụng. Tiêm
  cho hub thì hiệu quả nhưng đòi biết trước cả mạng. Mẹo **bạn của người ngẫu nhiên**
  không cần biết gì mà gần bằng cách tốt nhất — nghịch lý bạn bè.
- **Raft** — giết 2 trong 5 máy: cụm vẫn chạy. Giết máy thứ 3: **đứng hình**, vì thà
  dừng còn hơn sai. Cắt mạng thành hai phe: phe thiểu số bầu mãi không xong.
- **Mandelbrot** — vẽ **từng hàng** chứ không cả khung, vì cả khung tốn ~2,5 *giây*.
  Bấm preset *⚠ Trông liền mà là bụi*: `c = −0,8 + 0,156i` trông có cấu trúc nhưng
  nằm ngoài tập Mandelbrot — tập Julia của nó là bụi, phần "đặc" chỉ 0,9% khung.
  **Nhìn không phân biệt được, phải tính.**
- **Gray–Scott** — mỗi hình mẫu chỉ là đặt lại **hai con số** f và k. Kéo hệ số lan
  của V lên bằng U và xem hoa văn tan hết: cơ chế Turing cần chất ức chế lan nhanh hơn.
- **Hiệu ứng cánh bướm** — trục dọc là thang log, nên phân kỳ hàm mũ thành **đường
  thẳng**, và độ dốc chính là số mũ Lyapunov. Kéo chênh lệch ban đầu xuống 10⁻¹²:
  vẫn tách, chỉ muộn hơn.
- **N-body** — leapfrog giữ năng lượng trôi dưới 2% sau 2000 bước, khác hẳn Euler.
  L2 (vòng đứt nét, *không* ổn định) là chỗ kính James Webb đang đậu và phải đốt
  nhiên liệu chỉnh vị trí mãi.

---

## Dùng

| | |
|---|---|
| `Space` | chạy / tạm dừng |
| `→` | một bước |
| `R` | đặt lại |
| `F` | toàn màn hình |
| **Chép liên kết** | URL giữ nguyên **mọi tham số** đang xem — gửi cho người khác là họ thấy đúng thứ bạn thấy |
| **Lưu ảnh** | PNG khung hình hiện tại |
| **Ghi video** | `.webm` trong lúc chạy (trình duyệt nào hỗ trợ `captureStream` mới hiện nút) |
| **Tập trung** | ẩn mục lục, khung vẽ ăn hết bề ngang |

Cách dùng đúng: **trước khi kéo một thanh trượt, hãy dự đoán điều sẽ xảy ra.**

---

## Kiểm tra

```bash
python check.py --tinh     # tĩnh + nguyên hàm engine + DOM giả + đối chiếu số
python check.py            # thêm tầng Chromium, cần: pip install playwright
node kiem-so.js            # chỉ riêng phần đối chiếu số
```

[`kiem-so.js`](kiem-so.js) là tầng riêng của trang này: nó chạy xuyên qua **đúng mã
lab thật**, đọc bảng số liệu trên màn hình, rồi so với giá trị tính độc lập —
π(60000) = 6057 bằng sàng riêng, Collatz 27 → 111 bước đỉnh 9232, chu kỳ logistic
tại r = 2,8 / 3,2 / 3,5 / 3,83, σ của phân phối đều = 1/√12, luật 90 cho ra
2^popcount(n) ô đen ở hàng n, đống cát bảo toàn hạt, kiến Langton đối chiếu với một
bản cài đặt độc lập, Braess ra đúng 65 và 80 phút, hệ số cụm vòng thuần khớp
`3(k−2)/(4(k−1))`, Raft không bao giờ có hai lãnh đạo cùng nhiệm kỳ, tỉ lệ điểm
trong tập Mandelbrot khớp diện tích đã biết 1,506…  **87 phép, tất cả khớp.**

> **Bẫy đã gặp:** `chayToi(k)` có thể **không tới được bước k** — bộ phát có ngân
> sách 3 giây cho mỗi lần tua để không đóng băng tab. Nay nó xác nhận và báo lỗi rõ
> thay vì im lặng đo sai. Tương tự, `dat()` phải đặt `.checked` cho ô danh dấu — đặt
> `.value` là không làm gì cả, và ba phép đối chiếu đã từng chạy với tham số sai.

Tầng "chạy thử" chỉ chứng minh lab **không nổ**; tầng này chứng minh nó **tính đúng**.

> **Thêm lab mới thì thêm một khối đối chiếu vào `kiem-so.js`.** Mỗi lab nên có ít
> nhất một con số kiểm được bằng nguồn khác.

---

## Thêm lab mới

Engine nằm ở [`../engine/`](../engine/README.md) — **đừng sửa `assets/vis-core.js`
hay `assets/vis.css` ở đây**, chúng là bản sao, sửa xong chạy `sync.py` là mất.

1. Viết `assets/lab-<tên>.js`, chép khung của
   [`assets/lab-collatz.js`](assets/lab-collatz.js) (lab tham chiếu, dùng hết API).
2. Thêm `<script src="assets/lab-<tên>.js">` vào [`index.html`](index.html).
3. Khai báo nhóm mới trong `nhomThuTu` của [`assets/cau-hinh.js`](assets/cau-hinh.js)
   nếu muốn nó đứng đúng thứ tự (quên thì lab vẫn hiện, chỉ xếp sau).
4. Thêm khối đối chiếu vào [`kiem-so.js`](kiem-so.js).
5. `python check.py --tinh`.

Lộ trình đề tài tiếp theo: [`docs/web-lab-ke-hoach.md`](../../../../../docs/web-lab-ke-hoach.md).
