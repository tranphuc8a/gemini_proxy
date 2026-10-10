# Báo cáo thi hành cụm X3 — Bài 13, 14, 15 (+ mục tương ứng ở đáp án)

Tệp vá: `sua-loi/g16-x3.json` — **13 bản vá** (Bài 13: #1–#7 · Bài 14: #8–#11 · Bài 15: #12 · đáp án: #13).
`ap-dung-sua-loi.py --thu sua-loi/g16-x3.json` → **áp được 13 · đã áp từ trước 0 · lỗi 0** (chưa áp thật; bundle không bị đụng).
Trang thực hành: `kiem.js --bai=bai-13-simulated-annealing,bai-14-tabu-search,bai-15-ils-vns` → **Đạt — 97 mục** (0 SAI).

## Từng mục quyết định

| # | Quyết định | Kết quả | Bản vá |
|---|---|---|---|
| 1 | Bài 13 §5.2 + đáp án 13.4 ("không bão hoà / gần tuyến tính") | **Đã thi hành.** Tính lại bằng code từ bảng: 1 029/log₁₀6 = 1 322,4; 471/log₁₀5 = 673,8; 300/log₁₀(10/3) = 573,7 điểm mỗi bậc 10×. Ghi "chậm dần … ≈ 1 320 → 670 → 570, chưa bão hoà trong khoảng đã đo". Sửa cả dòng tóm tắt §9 và đề 13.4 (hỏi thêm số điểm mỗi bậc). | #4 (§5.2), #6 (§9), #7 (đề 13.4), #13 (đáp án 13.4) |
| 2 | Bài 13 §4.1 vs §4.2 (Đảo "qua λ" vs SA dùng tiền) | **Đã thi hành**, cách nhỏ nhất đúng, suy ra chỉ từ bài: thêm chú thích dưới bảng — Thêm/Bỏ/Đổi chấm tiền thuần; Đảo có Δ tiền = 0 nên (theo §2.1) luôn được nhận, muốn phân biệt tốt/xấu thì cộng −λ·dt (hàm thay thế, theo nguyên tắc cuối §4.2); `lambda` mặc định 0. Không khẳng định gì về mã C++ gốc. | #2 |
| 3 | T_end = 1 vs công thức; λ = 164 vs bài khác | **Đã thi hành** (hạ mức, không thống nhất): ghi chú cuối §7 (T_end = 1 ⇒ \|Δ\|min = ln 1000 ≈ 6,9; mỗi lần hiệu chuẩn có tham số riêng) + chú thích ngắn ở §4.2. Các λ khác đã đối chiếu từng chỗ trong bản bài: Bài 9 "80–100", Bài 6 ví dụ 120 và lab chèn 80, Bài 4 "142 → 88". | #5 (§7), #3 (§4.2) |
| 4 | Bài 14 §3.3 "√n đến n/10"; mã reactive `(int)(TT*1.2)` | **Đã thi hành.** Hàng bảng: "khoảng giữa √n và n/10; với n ≥ 100 thì √n ≤ n/10". Mã [MÃ] + đoạn giải thích đi kèm. | #9, #10, #11 |
| 5 | Bài 15 "20 lần ngẫu nhiên" (§2.3) | **Đã thi hành**: nêu cơ sở (số đo từ mã gốc, không còn trong repo; dựng lại độc lập cho độ phân tán nhỏ hơn, NN+2-opt thường thắng *trung bình* ngẫu nhiên ≈ 2–8 %, còn lần *tốt nhất* trong 20 thì ngang/đảo chiều ở n = 100–200 — khớp số g6 đã đo), "thắng" → "thường thắng". Văn bản khớp quyết định số 1 của X2. | #12 |
| 6 | Bài 15 l4 "exchange là loại duy nhất đổi tập" | **Giữ**, không vá (đúng trong bộ N₁..N₅ §3.3 / bài tập 15.3). | — |

## Chỗ tôi chọn khác điều phối

- **Mã reactive (#10):** điều phối ghi `TT = max(TT + 1, (int)(TT * 1.2))`. Tôi giữ thêm `std::min(TTmax, …)`: `TT = std::min(TTmax, std::max(TT + 1, (int)(TT * 1.2)))`. Bỏ `min` thì TT có thể vượt TTmax (bản gốc có trần).
- **Số độ dốc (#4):** điều phối ghi ≈ 1 319 / 673 / 577; code cho 1 322 / 674 / 574 → bài ghi làm tròn tới chục (bảng chỉ có số "~"): 1 320 / 670 / 570.
- **Mở rộng theo nguyên tắc chung số 2:** thêm câu nêu cơ sở cho số đo "18 980–24 240, 28 %" ở **Bài 13 ③ (#1)** và **Bài 14 ③ (#8)** (cùng số của Bài 9/12, vốn chưa có trong cụm X3; giữ số, thêm "mã gốc không còn trong repo; dựng lại cho tệ nhất/tốt nhất ≈ 1,07–1,11").

## Kiểm mã reactive (node + g++ 14.0.1, scratchpad)

Mô phỏng đúng đoạn mã trong bài (`phatHienLap()` điều khiển từ ngoài): công thức cũ **kẹt** ở TT = 1, 2, 3, 4 sau 100 lần phát hiện lặp (`(int)(TT*1.2)` = TT với TT ≤ 4); công thức mới từ mọi TT khởi đầu 1…6 đi 1→2→…→10→12→14→15 (TTmax = 15). Quét vét cạn TTmax ≤ 300: mới không vượt TTmax, tăng nghiêm ngặt khi TT < TTmax; nhánh giảm `(int)(TT*0.9)` không dưới TTmin và luôn giảm ≥ 1 (15 → 2 với TTmin = 2). Lỗi 0. Cũng kiểm bằng code: √n ≤ n/10 ⇔ n ≥ 100; ln 1000 = 6,908.

## Đồng bộ trang thực hành

- `data/bai-13-simulated-annealing.js`: `tomTat[5]`, `l3.mau`, `l3.tieuChi` ("gần tuyến tính, không bão hoà" → "chậm dần … chưa bão hoà"; thêm độ dốc 1 320/670/570). Không đổi id, số câu, đáp án, lab.
- `data/bai-14-tabu-search.js`: một mệnh đề ở `tomTat` (tabu phản ứng, chặn dưới +1).
- `data/bai-15-ils-vns.js`: không đổi — không có chỗ nhắc lại "20 lần ngẫu nhiên".

## Ngoài phạm vi / ghi nhận

- Bài 9 §7, Bài 12 §1/§6/§10, đáp án 9.x/12.1/12.2: do X2 (cùng quyết định số 1); Bài 13/14/15 chỉ trỏ lại số đo, đã thêm cơ sở như trên.
- Bài 4 §7.2: bảng ghi SA 20,96 ms / ALNS 14,89 ms, còn Bài 13 §5 ghi 15,96 / 10,47 ms cho cùng điểm/sem (g6 đã nêu; chưa phân định, không thuộc X3).
- `tai-lieu/cheatsheet`, `tu-dien-thuat-ngu` (quy ước TT − 1): thuộc X5; md2 không có mã reactive ở đó.
- Lỡ chạy một lệnh `git status` (chỉ đọc) lúc kiểm trạng thái bundle; không có lệnh git ghi nào.
