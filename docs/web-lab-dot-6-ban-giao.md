# Đợt 6 — bàn giao

Ngày 2026-09-25. Đọc cùng [`web-lab-visualize.md`](web-lab-visualize.md) (ngữ
cảnh kỹ thuật) và [`web-lab-ke-hoach.md`](web-lab-ke-hoach.md) (lộ trình).

---

## Làm được gì

Site `courses/lab-visual/` từ **25 → 28 lab**. Engine mọc thêm một nguyên hàm.

| Lab | Nhóm | Điều nó cho thấy |
|---|---|---|
| **Đua optimizer** (`lab-optimizer.js`) | Tối ưu hoá & heuristic | SGD · Momentum · RMSProp · Adam trên 5 mặt lỗi |
| **Đấu trường metaheuristic** (`lab-dautruong.js`) | Tối ưu hoá & heuristic | leo đồi · tôi luyện · GA · PSO, **cùng ngân sách gọi hàm** |
| **Giảm chiều** (`lab-giamchieu.js`) | Học máy & dữ liệu *(nhóm mới)* | PCA · MDS · t-SNE · chiếu ngẫu nhiên |

**Engine:** `V.khungNhieu(cv, {so, cot, le, leTren, leDuoi, khoang, caoNhan})` —
chia canvas thành lưới khung con, mỗi khung tự mang sẵn `le` (dùng thẳng cho
`V.bieuDo`) và `leLuoi` (cho `V.luoiO`), cộng `nen/vien/nhan/soPhu/trong/chua`.
Kèm `leTrai`/`lePhai` cho `V.luoiO`. Tự kiểm tra nguyên hàm: **41 → 59 mục**.

---

## Ba chỗ lệch so với kế hoạch — và vì sao

### 1. Không có UMAP

Kế hoạch ghi *"t-SNE vs UMAP vs PCA"*. Bản dựng là **PCA · MDS · t-SNE · chiếu
ngẫu nhiên**.

Cài UMAP đúng nghĩa cần cả một bộ máy riêng (đại số fuzzy simplicial set + tối
ưu hoá bằng lấy mẫu âm). Viết tay một thứ gần giống rồi **dán nhãn "UMAP"** thì
sai với người học — họ sẽ rút ra kết luận về UMAP từ một thứ không phải UMAP.
Thay bằng MDS (SMACOF) và chiếu ngẫu nhiên: cả hai cài đúng được trong vài chục
dòng, và mỗi cái đẩy được một luận điểm riêng —

- **SMACOF** có bất biến chứng minh được (ứng suất không bao giờ tăng), nên
  tầng kiểm số đối chiếu được *giải thuật*, không chỉ một con số.
- **Chiếu ngẫu nhiên** là mốc đối chứng "không học gì cả". Trên bộ *Lưới* nó
  đạt tương quan toàn cục 0,51–0,87 mà không hề nhìn dữ liệu — hữu ích để biết
  một con số cao thì *chưa* chứng minh phương pháp thông minh.

### 2. Luận điểm của lab đấu trường bị chính số đo bác bỏ

Kế hoạch (và bản viết đầu của tôi) ghi sẵn: *"đổi địa hình thì thứ hạng đảo
lộn — đó là nội dung định lý không có bữa ăn trưa miễn phí"*.

Đo thật trên 5 địa hình × 8 hạt giống: **PSO thắng gần như sạch mọi ô.** Luận
điểm không đứng được.

Phải sửa hai chỗ cài đặt yếu của chính mình trước:

- **Leo đồi** → `(1+1)-ES` với **quy tắc 1/5 của Rechenberg**: cứ 10 lần đề
  xuất thì xem tỉ lệ thành công, trên 1/5 thì nới bước, dưới thì co bước. Bản
  cũ chỉ co bước sau 25 lần thất bại liên tiếp rồi khởi động lại từ đầu.
- **Tôi luyện** → bước đề xuất **co theo nhiệt độ**. Bản cũ giữ bước cố định
  0,77 bất kể nhiệt, nên khi đã lạnh thì mọi đề xuất đều bị từ chối và nó đứng
  im — đó là lý do nó về bét ở mọi địa hình.

Đo lại thì phép đảo mới hiện ra, và nó **theo ngân sách, không theo địa hình**:

| Địa hình | ngân sách ≤ 2 000 | ngân sách ≥ 6 000 |
|---|---|---|
| Cầu | leo đồi thắng **8/8** | leo đồi thắng **0/8** |
| Ackley | leo đồi thắng **8/8** | leo đồi thắng **0/8** |

Cùng địa hình, cùng hạt giống, cùng thuật toán — chỉ ngân sách đổi. Lab được
viết lại quanh phép đảo đó, và hai preset `★ Cầu · ngân sách 2 000` /
`★ Cầu · ngân sách 20 000` đưa nó về đúng một cú bấm.

Phần *không có bữa ăn trưa miễn phí* cũng được viết lại cho đúng: định lý nói
về trung bình trên **mọi** hàm mục tiêu, nó **không** hứa rằng thứ hạng sẽ đảo
trên vài hàm chuẩn quen thuộc — hàm chuẩn đều có cấu trúc.

> **Bài học cho đợt sau: viết sẵn kết luận vào kế hoạch rồi đi dựng lab để minh
> hoạ nó là làm ngược.** Đo trước, viết sau.

### 3. Ngân sách của lab giảm chiều

Mặc định 300 điểm là quá nặng: tua 3 giây chỉ đi được 65 vòng, tức kéo thanh tua
đến đâu cũng không tới nơi. Hạ xuống **150 điểm**, `toiDa` 600 → 250, tắt phóng
đại t-SNE ở vòng 50 thay vì 100.

---

## Ba bug thật bị lộ ra và đã sửa

### 1. Đấu trường ăn gian ngân sách

GA và PSO đánh giá **cả quần thể** trong một bước. Khi ngân sách không chia hết
cho cỡ quần thể, chúng tiêu **lố tới 23 lần gọi hàm** so với leo đồi và tôi
luyện — đúng cái lời hứa mà cả lab lấy làm nền tảng.

Không thấy ở lần đo đầu vì `6000 / 24 = 250` chẵn. Ô **Vượt ngân sách** trên màn
hình bắt được nó ngay khi hạ ngân sách xuống 1 000.

Sửa: `danhGia()` trả `null` khi hết ngân sách; vòng lặp quần thể của GA giữ
nguyên cá thể đời trước cho những ô chưa kịp đánh giá, vòng lặp PSO `break`.

### 2. Mặt "yên ngựa" của lab optimizer không có cận dưới

`f = x² − 0,6y²` — mọi thuật toán chỉ việc chạy ra vô cực, nên "cuộc đua" là xem
ai chạy xa hơn. Bảng số liệu đo được: hai thuật toán *phát nổ*, một cái dừng ở
−2 640.

Thay bằng `f = (x²−1)² + 0,3y²`: vẫn có điểm yên ngựa đúng tại gốc (Hessian
`f_xx = −4 < 0`, `f_yy = 0,6 > 0`), nhưng có **hai đáy thật** ở `(±1, 0)` với
`f = 0`. Giờ cuộc đua có vạch đích, và cái đáng xem là *ai thoát khỏi điểm yên
ngựa trước*: ở bước 60 SGD còn ở `f ≈ 1,1` (chưa nhúc nhích) trong khi RMSProp
đã xuống `2×10⁻²⁰`.

### 3. Chốt chặn chống-tua-bị-cắt chưa bao giờ chạy

Đợt 3 thêm vào `chayToi()` một chốt: nếu ngân sách tua cắt giữa chừng thì ném
lỗi thay vì lặng lẽ đọc trạng thái sai. **Nó chưa bao giờ kích hoạt.**

DOM giả lưu `innerHTML` vào `_html` nhưng `chuTrong()` chỉ đọc `_text` và các nút
con, nên nhãn bộ phát (`"bước 65 / 600"`) **biến mất hoàn toàn** khỏi mọi phép
đo — `buocHienTai()` trả `NaN` cho **mọi lab**, kể cả Collatz.

Sửa `chuTrong()` đọc thêm `_html` (bỏ thẻ). Ngay lập tức bắt được:

- Phép **N-body** ghi *"sau 2 000 bước"* nhưng thực tế lâu nay chỉ đọc tới
  **bước 385** (100 vật = 4 950 cặp/bước, không lọt ngân sách tua 3 giây).
- Phép **Boids** xin 1 200 bước, đo được 1 153–1 210 tuỳ tải máy → **chập chờn**:
  cùng một mã nguồn, kết quả đổi theo tải máy.
- Chốt chặn bắt nhầm trường hợp **xong sớm hợp lệ** (Schelling ngưỡng 0 thì
  không ai chuyển nhà → xong ở bước 1). Thêm `daXong()` để phân biệt.

**Sửa đúng gốc rễ, không hạ quy mô phép thử.** Phản xạ đầu tiên của tôi là hạ
N-body xuống 40 vật và Boids xuống 900 bước. Nhưng như vậy là **sửa phép đo cho
vừa cái thước**: ngân sách 3 giây tồn tại để bảo vệ **tab của người dùng**, nó
không có lý do gì ràng buộc một bộ kiểm tra chạy ngầm. Thay bằng: `hanTua` đọc
được từ `CAU_HINH_VIS.hanTua`, và `thu-nhanh.js` nới nó lên **120 giây** trước khi
nạp kịch bản. Hai phép thử giữ nguyên quy mô gốc (100 vật, 1 200 bước), sản phẩm
thật giữ nguyên ngân sách 3 giây, và chốt chặn vẫn bắt được lab **không bao giờ
chạy xong** — chỉ thôi không bắt lab chậm nữa.

> **Bẫy thứ tự: `H.noiNganSachTua()` phải gọi SAU `H.napTheoIndex()`.**
> `cau-hinh.js` của mỗi trang gán `window.CAU_HINH_VIS` bằng một **đối tượng
> mới**, nên gọi trước thì bị ghi đè sạch. Tôi đã mắc đúng lỗi này: ba lần chạy
> lại đều xanh, nhưng là **nhờ máy rảnh chứ không nhờ bản vá** — `hanTua` lúc đó
> vẫn là `undefined`. Kiểm lại bằng cách in `H.window.CAU_HINH_VIS.hanTua` sau khi
> nạp. Bài học: **ba lần xanh liên tiếp không chứng minh bản vá có tác dụng**;
> phải đo thẳng cái mình vừa sửa.

`courses/engine/thu-nhanh.js` cố ý **không** nới ngân sách: tầng DOM giả chỉ cần
biết lab không ném lỗi, không cần chạy trọn, nên giữ ngân sách mặc định cho
nhanh (28 lab mất ~100 giây).

---

## Trạng thái kiểm tra

```bash
cd backend/fastapi/webapp/courses
python engine/sync.py --kiem                 # bản sao khớp nguồn
node engine/thu-engine.js                    # 59 nguyên hàm engine
node engine/thu-nhanh.js lab-visual          # 80 mục DOM giả
cd lab-visual && node kiem-so.js             # 112 phép đối chiếu số
cd lab-visual && python check.py --tinh      # cả 5 tầng
cd backend/fastapi && ./.venv/Scripts/python.exe -m pytest tests/ -q
```

| Tầng | Kết quả |
|---|---|
| Tĩnh (Python) | xanh, 28 lab, id không trùng |
| Nguyên hàm engine | **59 mục** đạt |
| DOM giả `lab-visual` | **80 mục** đạt |
| Đối chiếu số `lab-visual` | **112 phép** khớp (chạy 3 lần, ổn định) |
| Ba site còn lại | xanh (`ai-everything-visual` 101 · `heuristic-visual` 53 · `system-design-visual` 23) |
| Pytest backend | **640 passed** |
| Chromium (playwright) | **chưa cài** → tự bỏ qua |

**Đợt này không cần phép thử phủ định nhân tạo:** bộ kiểm đã tự bắt được ba lỗi
thật ở trên, đó là bằng chứng mạnh hơn.

---

## Điều CHƯA làm, phải nói rõ

> **Chưa có lab nào trong 28 lab được mở bằng trình duyệt thật.** Đúng như năm
> đợt trước.

Tầng đối chiếu số rất chắc về *thuật toán*, nhưng nó **không** kiểm được:

- **Bố cục** — `V.khungNhieu` là nguyên hàm mới, cả ba lab đợt này đều dựa vào
  nó để chia canvas. Canvas trong DOM giả chỉ **đếm số lần gọi**, không dựng
  hình, nên khung có chồng lên nhau hay tràn ra ngoài thì không ai biết.
- **Màu** — giao diện sáng và tối, bảng màu `V.thangMau` cho nền địa hình và
  cho điểm dữ liệu liên tục.
- **Chuột** — `K[i].chua(x, y)` chưa được bấm thử lần nào.
- **Chữ đè lên nhau** — nhãn khung, `soPhu`, nhãn trục biểu đồ nằm chung canvas.

Muốn đóng lỗ hổng này thì cài `playwright` (tầng 5 đã viết sẵn, đang tự bỏ qua).
**Chưa cài — quy ước dự án là không thêm dependency mà chưa hỏi.**

Ngoài ra:

- `courses/engine/` vẫn thiếu `kiem.py`, `chup.py`, `build.py` mà 3 thư mục
  `*-course` đang import.
- Ba khoá cũ (`ai-everything-visual`, `heuristic-visual`, `system-design-visual`)
  vẫn nằm trong `chua_dong_bo` của `dong-bo.json` — chưa dùng engine v2.
- **Chưa commit phần đợt 6.** Mốc cuối trên `main` là `6015bfc` (bạn tự commit,
  gồm 25 lab đợt 1–5 và bản nháp đầu của `lab-dautruong.js`). Cây làm việc hiện
  có 13 tệp chưa commit — toàn bộ phần viết ở trên.

---

## Gợi ý đợt 7

Engine chưa có nguyên hàm nào bị **hai lab trở lên** chép tay, nên theo nguyên
tắc "không viết trước một thứ chưa có hai lab cần nó", đợt 7 nên là **đợt củng
cố** thay vì thêm lab:

1. Cài `playwright`, bật tầng 5, mở thật 28 lab — **việc đáng làm nhất lúc này**.
2. Đồng bộ engine v2 cho 3 khoá cũ → 68 lab cũ dùng được `V.bieuDo`.
3. Bổ sung `kiem.py` / `chup.py` / `build.py` cho `*-course`.
