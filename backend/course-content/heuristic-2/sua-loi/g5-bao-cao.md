# Báo cáo rà soát nhóm g5 — Bài 10, 11, 12 + mục Bài 10–12 của đáp án

Tệp vá: `sua-loi/g5.json` — **28 bản vá**: Bài 10 (7), Bài 11 (13), Bài 12 (7), đáp án (1).
Theo nhãn: MÂU THUẪN 10 · LOGIC 10 · SỐ 4 · THAM CHIẾU 2 · MÃ 1 · NHỎ 1.
Kiểm chứng bằng code tự viết (Python + g++): công thức Δ 2-opt/Or-opt/chèn/bỏ/swap so với tính lại từ đầu, ví dụ làm tay §6 Bài 11 (liệt kê mọi nước Or-opt), double-bridge, mô phỏng TSP Manhattan n=50…1000 (2-opt hội tụ, danh sách ứng viên, ILS).

## Mục đã biết được giao
- **35 (đáp án 11.2): xác nhận.** D→B = |50−30| = 20 chứ không phải 10; tuyến `kho→A→C→D→B→E` dài 80, Δ=0. Liệt kê toàn bộ nước Or-opt L=2 (thuận/đảo chiều, bỏ đảo tại chỗ): không nước nào Δ<0; chỉ L=3 [C,D,E]→sau A cho 70 (Δ=−10). Sửa đáp án và đổi đề 11.2 sang L=3.
- **38 (Bài 10/11): một phần.**
  - Hai bộ "năm toán tử": xác nhận (vá mở đầu Bài 11 + "xoá/chèn" ở Bài 12 ⑤).
  - Exchange "duy nhất" đổi tập: xác nhận (vá §2.5, §9).
  - Bất đẳng thức tam giác chỉ cho ≤: xác nhận; có phản ví dụ Manhattan Δ=0 (a=(0,0), b=(4,4), c=(4,3), d=(0,1): 14=14). "Euclid vs Manhattan" **không phải lỗi** (phép chứng minh đúng với mọi chuẩn khi cạnh là đoạn thẳng) — đã sửa phát biểu cho khớp.
  - "+7,0 %" vs Bài 9: xác nhận (7,0 % = 65 718/61 420, so với greedy tỉ số; riêng leo đồi chỉ +0,45 % / +4,5 %). Đã ghi rõ cơ sở.
  - "1 157 lần ở đồ án" vs sandbox n=200: xác nhận (213 381 485/184 355 = 1 157,4; vá mở đầu Bài 10). Manhattan "mọi bài": xác nhận là nói quá (hạ mức, 2 chỗ).
  - Ví dụ 10.1 Δ=0: xác nhận là Δ=0 (29→29), nhưng không sai — xem "Cần tác giả quyết định".
  - "min(28 mẫu) ≈ 25 200": không phân định được (xem dưới).
  - "Tăng tốc 'vài nghìn / vài triệu' trong 100 ms", công thức (n−m)·m: ngoài phạm vi / không phải lỗi (đúng với n=600).
- **42 (Bài 12): xác nhận hai điểm, một điểm không tái lập.**
  - Ngưỡng 10 % vs 5 %: vá thành 5 %, và đồng bộ các mốc về Bài 18 §6 (15 % / 5–15 %).
  - Sơ đồ double-bridge: xác nhận. Mã ghép P1 P4 P3 P2 (đổi đủ 4 cạnh, hai chu trình xen kẽ = double-bridge thật); P1 P3 P2 P4 chỉ đổi 3 cạnh (1 979/2 000 bộ thử). Sửa sơ đồ theo mã.
  - Đáp án 12.1/12.2: **không tái lập được**, không sửa (xem dưới).

## Lỗi mới tự tìm ra
- Bài 10 §3.1: "chu trình kín không có trường hợp biên" sai với cặp (0,m−1) (công thức cho −2d, 3 000/3 000 phép thử sai) → loại cặp đó.
- Bài 10 §3.2: công thức Or-opt thiếu giả thiết k<i hoặc k>i+L (sai ở mọi k∈[i,i+L]).
- Bài 11 §3.2–3.3: (a) suy luận "điều kiện cần" nhảy bước; (b) "chỉ cần quét một trường hợp" chỉ đúng nếu quét cả hai chiều chu trình — mã chỉ quét chiều thuận; với K=n−1 vẫn sót nước cải thiện ở 3/5 bộ dữ liệu (0/5 khi quét hai chiều). Đã sửa lời + thêm ghi chú dưới mã.
- Bài 11: tham chiếu sai "Bài 9 §7.2" (đúng §5.2) và "Bài 9 §9" (đúng §8). Bảng thuật ngữ gọi swap là "swap / exchange" trong khi exchange là toán tử khác.
- Bài 12 §4.3: "buộc phải dùng ① hoặc ④" bỏ sót ② (Tabu). §7.1: "đảm bảo thoát lưu vực" nói quá (ILS n=200: 3–39/1 000 vòng vẫn rơi về độ dài cũ) → hạ mức.

## Cần tác giả quyết định (không sửa)
1. **Bài tập 10.1** (đáp án Δ=0): kiểm chứng yếu vì dấu sai cũng cho 0. Đề xuất đảo đoạn [2..3] của `[5,2,8,1,9]`: Δ = d(2,1)+d(8,9)−d(2,8)−d(1,9) = −12, tuyến mới 17 = 29−12.
2. **Số đo "20 lần 2-opt từ điểm ngẫu nhiên" (Bài 12 §1, §6.1–6.2, §10; đáp án 12.1/12.2; trùng ở Bài 9 §7.2–7.5, Bài 15 dòng khởi tạo).** Mã `tsp.cpp` không có trong repo. Tôi cài 2-opt quét mọi cặp tới hội tụ (Manhattan, toạ độ 0–999; NN→2-opt cho 14 732, 5 lượt, 98 500 phép — gần khớp 14 656 / 99 500 của bài): 20 lần ngẫu nhiên cho phân tán chỉ 1,08–1,12 (n=200; bài: 1,277), 1,03–1,06 (n=600; bài: 1,158), 1,04–1,05 (n=1000; đáp án: 1,10–1,13); lần tốt nhất xấp xỉ NN+2-opt (0,95–1,02×), không "tệ hơn 29,5 %". Xu hướng "giảm khi n tăng" vẫn đúng. Số đếm cực trị phân biệt: n=50 ≈ 416–476 (đáp án ~200–400); n=200 ≈ 466–530/1 000 (đáp án "gần 1 000"; va chạm độ dài nguyên — §6.3 đã nói là chặn dưới). Kết luận "khởi tạo tốt thắng chạy lại" cần tác giả xác nhận lại bản 2-opt đã đo hoặc hạ mức khẳng định ("đừng bao giờ khởi động từ nghiệm ngẫu nhiên").

## Chưa phân định được
- Bài 11 §3.5 "min(28 mẫu) ≈ 25 200" không có trong log §3.4. Mô phỏng của tôi (NN từ 28 thành phố khởi đầu + ứng viên K=10) cho min thấp hơn 2-opt đầy đủ ~3 %, nên chiều "B tốt hơn A" đúng; độ lớn không kiểm được.
- Bài 11 §4.2: 330 phút × 1 420 = 0,469 triệu (bài ghi 0,48; nguồn 2607/02 §5 cũng 0,48, sai số trong "~330"); 3,1 − 0,48 = −2,6 triệu không khớp −2,11 triệu đo ở preset 1 (2,2k phút chết là ước lượng). Tỉ giá "≈ 6 : 1" (thực 6,5–6,7). Không sửa số thực nghiệm.
- Bài 12 §6.1: lệnh chạy n=1500 nhưng bảng không có hàng n=1500.

## Phát hiện ngoài phạm vi
- **Bài 15 §2.7**: sơ đồ `Sau: P1 ─ P3 ─ P2 ─ P4` — cùng lỗi như Bài 12 §7.1 (3 cạnh, không phải 4-opt); Bài 15 §2.7/dòng 403 cũng nói double-bridge "không hoàn tác được" (nên đồng bộ hạ mức). Bài 15 dòng 239 `N₅ = exchange … cái duy nhất đổi TẬP` cùng vấn đề "duy nhất" như Bài 11 §2.5.
- **Bài 8 dòng 292**: "Bài 12 §3 sẽ quay lại" công thức σ·E[max_N Z] (chạy N lần báo cái tốt nhất) — Bài 12 §3 không có nội dung đó (tham chiếu treo).
- **Bài 23 dòng 69, 216** và **2605/06 dòng 385**: gắn "1 157 lần" với đồ án / "TSP trong khoá"; số này đo trên sandbox TSP n=200 (Bài 10 §1), không phải đồ án.
- **Bài 9 §6.2 vs Bài 6 §6.3**: leo đồi từ greedy tỉ số "~64 200 (+4,5 %)" vs "64 490 (+5,0 %)" (cùng thao tác, khác λ?).

## Bài thực hành `heuristic-practice-2/data/*.js` cần đồng bộ
- `bai-10-delta-evaluation.js`: "0,03 ms" (dòng ~106) → 0,04 ms.
- `bai-11-toan-tu-kinh-dien.js`: `ref: "Bài tập 11.2, §6"` (id `l4`, dòng ~220: dùng L=2 — vẫn đúng với dữ liệu nhưng đề gốc đã đổi sang L=3); "duy nhất" (dòng ~582, exchange); câu về định lý §2.1 (dòng ~74, ~106) — theorem nay phát biểu "không dài thêm".
- `bai-12-cuc-tri-cuc-bo.js`: "> 20 %" và "5–20 %" (dòng ~183–189); các câu "chắc chắn thoát / đảm bảo ra khỏi lưu vực" về double-bridge (dòng ~218–226, ~264–267).

## Kết quả `ap-dung-sua-loi.py --thu sua-loi/g5.json`
`áp được 28 · đã áp từ trước 0 · lỗi 0`
