# Phụ lục trực quan

Mô phỏng **tương tác** cho [đại khoá học Trí tuệ nhân tạo](../README.md) —
những thứ không trình bày được bằng văn bản.

> **Không Node, không npm, không thư viện ngoài.** HTML + CSS + JavaScript thuần.
> Mọi mô phỏng tự tính toán trong trình duyệt bạn.

---

## Chạy

**Nhanh nhất:** nhấp đúp [`index.html`](index.html). Chạy được bằng `file://` vì
không có `fetch` nào.

```bash
cd ai-everything-course/visual
python -m http.server 8791 --bind 127.0.0.1
# mở http://127.0.0.1:8791
```

---

## 33 mô phỏng

| Nhóm | Demo | Môn | Điều nó cho thấy |
|---|---|:--:|---|
| **Toán nền tảng** | Gradient descent trên mặt mất mát | M02 | ngưỡng phân kỳ của learning rate · vì sao cần momentum · điểm xuất phát quyết định kết quả ở hàm phi lồi |
| | Softmax và nhiệt độ | M02 | cùng một công thức $e^{\cdot/T}$ dùng ở 3 nơi khác nhau |
| | Entropy, cross-entropy và KL | M02 | `H(P,Q) = H(P) + KL(P‖Q)` · **KL không đối xứng** |
| | PCA: trục chính và phép chiếu | M02 | hai cách nhìn PCA · **bẫy thang đo** |
| **Học máy** | Quá khớp, bias–variance, chính quy hoá | M03 | ‖w‖ nổ khi quá khớp · λ kéo nó lại · nhiều dữ liệu cũng chữa được |
| | k-NN: ranh giới theo k | M03 | k = 1 bám nhiễu · k lớn bỏ qua cấu trúc |
| | k-means từng bước | M04 | hai pha luân phiên · phụ thuộc khởi tạo · **hỏng trên dữ liệu vành khăn** |
| | Ngưỡng, ROC và bẫy accuracy | M03 | 95 % accuracy mà **không hơn đoán bừa** |
| **Học sâu** | Hàm kích hoạt và đạo hàm | M05 | `0,25¹⁰ ≈ 10⁻⁶` — gradient tiêu biến, tính bằng số |
| | Mạng neuron học ranh giới | M05 | **backprop thật, huấn luyện trong trình duyệt** · không lớp ẩn thì không giải được xoắn ốc |
| | Tích chập: bộ lọc làm gì | M07 | một bộ lọc chỉ là 9 con số · tổng = 0 → phát hiện biên |
| **AI hiện đại** | Attention: ma trận QKᵀ | M06 | tắt `√d` + tăng chiều → **softmax bão hoà** → gradient chết |
| | BPE: tokenizer được học thế nào | M06 | **huấn luyện BPE thật** · đo chi phí token tiếng Việt vs tiếng Anh |
| | Mô hình khuếch tán | M09 | **score chính xác bằng công thức** · ít bước lấy mẫu → phân bố sai |
| **Tìm kiếm & quyết định** | BFS, Dijkstra, tham lam và A\* | M01 | đếm ô mở rộng · `h ≡ 0` biến A\* thành Dijkstra |
| | Bandit: khám phá và khai thác | M08 | ε = 0 → hối tiếc tuyến tính mãi mãi |
| **Hệ thống & đánh giá** | Độ tin cậy của chuỗi nhiều bước | M12 | `0,95³⁰ = 0,215` · kiểm từng bước đưa 0,99³⁰ = 0,740 — **gộp bước rẻ hơn** |
| | RAG: trần do truy hồi đặt ra | M12 | `recall 0,70 × sinh 0,90 = 0,63` · **+15 recall đáng giá gấp ~3,9 lần +5 sinh** |
| | Đệm KV: bộ nhớ quyết định thông lượng | M13 | `2·L·n_kv·d_head·byte` · GQA đổi 231 chuỗi lấy 17 |
| | Hiệu chỉnh và ngưỡng từ chối | M14/M03 | ECE · ngưỡng Chow `p* = (C_sai − C_từ_chối)/(V + C_sai)` · **scaling nhiệt độ không đổi argmax** |
| | Độ phân giải: bạn đo được gì | M15/M13 | `n ≈ 16σ²/Δ²` · ★ **E[max] của 100 lần quét = +2,51 SD thuần nhiễu** |
| | Công bằng: định lý bất khả | M14 | `FPR = [p/(1−p)]·[(1−PPV)/PPV]·(1−FNR)` — **kiểm bằng số ngay trên trang** |
| | Goodhart và tối ưu quá mức | M14/M08 | khoảng cách proxy↔thật tăng theo n · đỉnh ở `t* = (Aρ/2B)²` ⚖️ |
| **Học sâu** *(bổ sung)* | Lan truyền ngược từng bước | M05 | quy tắc chuỗi trên đồ thị · ★ bão hoà sigmoid vs ReLU, thấy bằng số |
| | Trường thu nhận | M07 | `RF += (k−1)·dil·∏stride` · ★ vì sao nhiều lớp 3×3 thắng một lớp 11×11 |
| **Học máy** *(bổ sung)* | Rò rỉ dữ liệu | M04 | 4 kiểu rò rỉ · ★ điểm offline TĂNG trong khi điểm thật GIẢM |
| **Tìm kiếm** *(bổ sung)* | Q-learning trên lưới | M08 | Bellman lan giá trị ngược từ đích · ★ ε=0 ⇒ không học được |
| **AI hiện đại** *(bổ sung)* | RLHF — vì sao phải phạt KL | M09 | điểm RM tăng mãi, chất lượng thật đạt đỉnh rồi giảm ⚖️ |
| | Quy luật tỷ lệ — C = 6ND | M09 | `N* = √(C/120)` · ★ GPT-3 lẽ ra nhỏ hơn **3,4 lần** |
| | Giải mã: nhiệt độ, top-k, top-p | M06 | vì sao top-p thích nghi tốt hơn top-k |
| | Suy diễn tiến và lùi | M11 | cùng luật, khác chi phí · Rete · phủ định như thất bại |
| **Hệ thống & đánh giá** *(bổ sung)* | Năm cách vẽ cùng một dữ liệu | M10 | cắt trục · bỏ sai số · chọn hạt giống tốt nhất · baseline yếu |
| | Trôi dữ liệu | M13 | PSI/độ tin cậy/độ chính xác · ★ càng chính xác thì càng **muộn** |

---

## Nguyên tắc thiết kế

```
   ① MỖI DEMO PHẢI PHÁ ĐƯỢC.
      Không demo nào chỉ để "trông đẹp". Mỗi cái đều có ít nhất một tham số mà
      khi kéo tới cực trị sẽ làm thuật toán HỎNG một cách có ý nghĩa.

   ② TÍNH TOÁN THẬT, KHÔNG HOẠT HÌNH.
      Mạng neuron được huấn luyện bằng backprop viết tay. BPE được huấn luyện
      trên văn bản thật. Bộ lấy mẫu khuếch tán dùng score CHÍNH XÁC của hỗn hợp
      Gauss. Không có animation dàn dựng.

   ③ NÓI RÕ CHỖ NÀO LÀ DÀN DỰNG.
      Demo attention dùng vector Q, K sinh giả lập — và bài viết nói rõ điều đó.
      Cấu trúc toán là thật; ngữ nghĩa cụ thể thì không.

   ④ MỖI DEMO NỐI VỀ BÀI GIẢNG CỤ THỂ.
      Không phải "xem cho vui" mà là phụ lục của một bài học có thể mở ngay.
```

---

## Cách dùng đúng

> 📌 **Trước khi kéo một thanh trượt, hãy dự đoán điều sẽ xảy ra.** Rồi kéo và so.
> Mỗi lần dự đoán sai là một lần mô hình tư duy của bạn được sửa — và đó là toàn
> bộ giá trị của trang này. Xem mà không dự đoán thì chỉ là xem hoạt hình.

Mỗi demo có mục **giải thích** ở dưới, trong đó nêu **các thí nghiệm nên làm** theo
thứ tự. Làm hết chúng thay vì kéo ngẫu nhiên.

---

## Bản đồ tệp

```
   visual/
   ├── index.html                khung trang, nạp các file demo
   ├── check.py                  kiểm mọi demo bằng Chromium headless
   └── assets/
       ├── vis.css               giao diện (cùng bảng màu với web/)
       ├── vis-core.js           khung: điều khiển, canvas, RNG tái lập, định tuyến
       ├── vis-1-toan.js         gradient descent · softmax · entropy/KL · PCA
       ├── vis-2-hoc-may.js      bias-variance · k-NN · k-means · ROC
       ├── vis-3-hoc-sau.js      hàm kích hoạt · mạng neuron · tích chập
       ├── vis-4-hien-dai.js     attention · BPE · khuếch tán
       ├── vis-5-tim-kiem.js     A* · bandit
       ├── vis-6-he-thong.js     độ tin cậy chuỗi · trần RAG · đệm KV
       ├── vis-7-danh-gia.js     hiệu chỉnh & ngưỡng · độ phân giải
       ├── vis-8-an-toan.js      công bằng bất khả · Goodhart
       ├── vis-9-hoc-sau-sau.js  backprop · trường thu nhận · rò rỉ dữ liệu
       ├── vis-10-mo-hinh-lon.js Q-learning · RLHF · quy luật tỷ lệ · giải mã
       ├── vis-11-ky-hieu-va-doc.js  thẩm định thí nghiệm · suy diễn · trôi dữ liệu
       ├── chu-de.css            RIÊNG — bảng màu (hồng sen #9d174d)
       └── cau-hinh.js           RIÊNG — window.CAU_HINH_VIS
```

★ `vis.css` và `vis-core.js` giờ là **bản sao** của
[`courses/engine/`](../../engine/README.md), dùng chung với
[`samsung/visual`](../../samsung/visual/README.md) và
[`system-design/visual`](../../system-design/visual/README.md).
Sửa engine thì sửa ở `engine/` rồi chạy `python engine/sync.py`.

**Độ phủ theo môn:** cả **15/15 môn** đều có ít nhất một demo
(trước đợt bổ sung, M10 và M11 chưa có demo nào).

### Kiểm tra

```bash
python -m http.server 8791 --bind 127.0.0.1   # ở một cửa sổ khác
python check.py [--shot]
```

`check.py` mở **từng** demo bằng Chromium headless và kiểm: demo có ném lỗi không
(`vis-core.js` chèn `<div class="loi">` khi `dung()` ném) · có vẽ được gì không ·
có bảng điều khiển không · và ★ **liên kết tới bài giảng có trỏ tới file CÓ THẬT không**.
Lần chạy đầu tiên của nó đã bắt được một liên kết chết và một lỗi số liệu trong bài giảng.

### Thêm demo mới

Tạo file `vis-12-*.js`, nạp nó trong `index.html` **sau** `vis-core.js`, và gọi:

```js
demo({
  id: "ten-duong-dan",          // dùng trong URL: #/ten-duong-dan
  nhom: "Học sâu",              // phải khớp một nhóm trong NHOM_THU_TU của vis-core
  mon: "M05",
  ten: "Tên hiển thị",
  moTa: "Một câu nói rõ demo này cho thấy gì.",
  lienKet: '<a href="../web/index.html#/bai/...">M05 b.4</a>',
  dung: function (host) {
    var cv = VIS.veBang(500, 400);
    // ... vẽ ...
    VIS.khung(host, { ve: [cv], dieuKhien: [...], giaiThich: "..." });
  }
});
```

API có sẵn trong `VIS`: `veBang` (canvas có xử lý màn hình nét cao và hệ toạ độ
toán học) · `truot` `chon` `danhDau` `nut` (điều khiển) · `rng` (số ngẫu nhiên
**tái lập được**) · `vongLap` (hoạt hình) · `thangMau` `veLuoi` `mau` (vẽ) ·
`khung` (bố cục chuẩn).

---

## Ghi chú kỹ thuật

**Số ngẫu nhiên tái lập được.** `VIS.rng(hat)` dùng LCG đơn giản — cùng hạt giống
cho cùng dãy số trên mọi trình duyệt. Nhờ vậy khi bạn kéo một thanh trượt, **chỉ
thứ bạn kéo thay đổi**, không phải cả dữ liệu. Nếu dùng `Math.random()` thì không
so sánh được gì.

**Canvas có xử lý `devicePixelRatio`.** Không có nó, hình bị mờ trên màn hình
Retina/HiDPI.

**Không LaTeX.** Trang này không nạp KaTeX, nên công thức được viết bằng HTML
(`<code>`, ký tự Unicode). Bài giảng đầy đủ ở [`web/`](../web/README.md) mới có KaTeX.

**Mạng neuron chạy đồng bộ trên luồng chính.** Với kiến trúc lớn nhất (3 lớp × 12)
và 220 điểm, một bước mất vài ms — chấp nhận được. Nếu thêm demo nặng hơn, cân nhắc
Web Worker.

---

**Trang khoá học:** [`../web/index.html`](../web/index.html) ·
**Đại khoá học:** [`../README.md`](../README.md)
