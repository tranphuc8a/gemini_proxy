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

## 17 mô phỏng

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
   └── assets/
       ├── vis.css               giao diện (cùng bảng màu với web/)
       ├── vis-core.js           khung: điều khiển, canvas, RNG tái lập, định tuyến
       ├── vis-1-toan.js         gradient descent · softmax · entropy/KL · PCA
       ├── vis-2-hoc-may.js      bias-variance · k-NN · k-means · ROC
       ├── vis-3-hoc-sau.js      hàm kích hoạt · mạng neuron · tích chập
       ├── vis-4-hien-dai.js     attention · BPE · khuếch tán
       └── vis-5-tim-kiem.js     A* · bandit
```

### Thêm demo mới

Tạo file `vis-6-*.js`, nạp nó trong `index.html` **sau** `vis-core.js`, và gọi:

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
