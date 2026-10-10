# Báo cáo nhóm g11 — ca nghiên cứu 2605 (xếp bộ nhớ tensor)

Tệp vá: `sua-loi/g11.json` — **99 bản vá**, đủ 8 bài (06: 39 · 03: 14 · 05: 14 · 00: 12 · 02: 12 · tong-quan: 3 · 01: 3 · 04: 2).
Theo nhãn: `[THAM CHIẾU]` 39 · `[SỐ]` 33 · `[MÂU THUẪN]` 12 · `[LOGIC]` 10 · `[NHỎ]` 4 · `[MÃ]` 1.
Kiểm: `python ap-dung-sua-loi.py --thu sua-loi/g11.json` → **áp được 99 · đã áp từ trước 0 · lỗi 0** (gộp cả g1…g13: 508 bản vá, 0 lỗi, không nhóm nào khác đụng 2605).

## Mục đã biết (phat-hien-bai-giang.md, mục 27) — kiểm chứng

| Mục | Kết luận | Bằng chứng / cách xử lý |
|---|---|---|
| Tổng "+10,27 %" vs thành phần 11,98 % | **Xác nhận** | 6,93+2,33+1,65+0,64+0,43 = 11,98: trộn bước thang (6,93 · 0,64 · 0,43) với số ablation (2,33 · 1,65). Thay bằng thang 03 §1: 6,93 · 2,03 (v1→v3) · 0,43 · 0,64, nhân dồn 1,10270 (tong-quan, 03 §2, §13). |
| 90 % / 93,7 % / 93,2 % | **Xác nhận** | Đúng 1 350 993/1 449 573 = 93,2 % (6,8 % cho portfolio); 93,7 = 9,57/(9,57+0,64). Sửa 06 (4 chỗ), 02 §2 ("9,2 %" → 9,57 %), 00 §5② ("+9,2 %" → +9,1 %). |
| "68 %" vs 67,5 % | **Không xác nhận** | 978 559/1 449 573 = 67,51 % → làm tròn 68 % là đúng; không sửa. |
| Gergov "3×" vs "5× 1996 / 2× 1999" | **Xác nhận (05 sai)** | Gergov 1999 là **3-xấp xỉ** (tóm tắt STOC'03: "previous work showed OPT < 3L"; Buchsbaum cải thành 2+ε nên không thể là 2). Sửa 05 §2.3 (2 chỗ + "2×"→"(2+ε)×") và 02 §4 (nêu 5× rồi 3×). |
| TelaMalloc/MiniMalloc ASPLOS 2022/2024 vs '23 | **Xác nhận (02 sai)** | Tra dblp/ACM: TelaMalloc = ASPLOS 2023 Vol. 1; MiniMalloc = ASPLOS '23 Vol. 4 (repo google/minimalloc ghi 2023). Sửa 02 §4 theo 05. |
| Thời gian 121 vs 152 ms; tệ nhất 372/389/451 | **Một phần — không phân định** | 121 chỉ có ở lần kiểm cuối (04: 121 vs 154), 152 được các phép tính ủng hộ (15 %, 85 %, 6,1×). Không đổi số đo; ghi khoảng + cơ sở ở tong-quan và 00, hạ "nhanh hơn" → "cùng cỡ thời gian" (02 §5, 03 đầu bài). |
| N "~4 000"/"3 000–5 000"/"5 000" | **Xác nhận một phần** | 01 §2.1 (và ca-2605 thực hành) là 3 000–5 000; sửa tong-quan, 00 §4. 5 000 chỉ là cận trên (MAXN). |
| Bảng số lần thắng cộng 99 | **Xác nhận** | 56+16+13+6+3+5 = 99; thêm ghi chú (03 §6.4), không đoán số. |
| Thống kê "13 · 3 · 5 · 2" | **Xác nhận** | Đếm lại 23 bài: 12 ✅ · 1 (Bài 11, nửa-nửa) · 1 🔄 (Bài 7) · 2 ❌ · 5 ➖ · 2 ⚠️ = 23; dòng cũ đếm Bài 11 hai lần, bỏ Bài 7. Đã viết lại. |
| v1→v4 "+2,64 %" | **Xác nhận** | 15 465 394/15 092 960 − 1 = +2,468 % (hoán vị chữ số) → +2,47 %. |
| "chậm 4×" vs 4,5× | **Xác nhận** | 199/44 = 4,52 → 00 sửa thành 4,5×. |
| "Ba kỹ thuật thất bại" nhưng liệt kê bốn | **Xác nhận** | 00 §5③ → "Bốn". |

## Lỗi mới tự tìm ra (ngoài danh sách)

- **[MÃ] 04 §5.1**: v2 ghi `-DCRIT=6` (start tăng dần, thấp hơn FFD 3,2 %); v2 = size×√duration = **CRIT 5** (+0,35 %). Sửa.
- **Tham chiếu sai tới khoá** (đã đọc từng bài): Bài 12 "§9" → §8; "Bài 22 §8/§8.2" (không có câu đó; câu ở Bài 12 §8 cạm bẫy 2 / Bài 8 §8 cạm bẫy 5); Bài 19 §2/§6/§6.5/§6.6 → §3/§7/§7.5/§7.6 và bảng 7 dòng ở 06 (Bài 19 không có radix sort, không có mẹo `>> 4`); Bài 16 §3 → §5.1; Bài 2 §7 → §6.2; Bài 18 §3 → §2.1; 01 §5 → §4.3; 02 §5 → §2; 03 §3 → 02 §3.2 (04 §5.4); "checklist Bài 23" thực là Bài 20 §10.
- **Câu trích không có trong bài được trích**: Bài 2 ("ràng buộc nguyên vẹn…"), Bài 13 §2 ("cảnh quan liên tục"), Bài 17 §8 ("tôn trọng cấu trúc của nghiệm"; Bài 17 chỉ có điều kiện kích thước q ≥ 10) — thay bằng diễn giải có ghi rõ. 06 còn tự mâu thuẫn "Bài 17 §8 đã có câu này" vs "cần thêm vào Bài 17".
- **"LNS +3,0 % ở 2607"** (03 §7.3, 05 §5 ×3, 06 Bài 17): P2 là bài *ship hàng 5 ngày của khoá* (Bài 17 §8: chèn→chèn+LNS +3,00 %, +8,86 % so với lấp đầy từng ngày); đề 2607 (P3) không thử LNS. 06 còn đảo "P2 = 8,86 %, 2607 = 3,0 %".
- **Số**: 05 (h_max/L)^(1/7) = 0,48 không phải 0,45; 06 biên lớp [2896,…) → [2897,…) (đã chạy `sizeLevelSqrt2`, 0 sai lệch với ⌊2·log₂x⌋ tới 10⁵); "300 TC × 3 họ seed" = 3×100; "0/5000" → 0/N; eff/size nhỏ "1,8–3,0" → 1,3–5 (tính từ bộ sinh); 02 "+7,3 %" cho FFD → +6,9 %; 02 "hơn Best-Fit trung bình 3,2 %" (thực 3,2/0,7/0,2, TB 1,4 %); 02 "+0,63 %" → 0,64; 03 LNS "~9 %" (dòng log cuối +13,6 %); 03 §10 "17× an toàn" thiếu nói là theo TB (worst-case 4,4×); 06 "λ cho +7 %" → 2,43 % (ablation 2607).
- **Logic**: 06 Bài 3 gán tính hợp lệ cho *vector offset* (thực ra do First-Fit làm bộ giải mã, Bài 3 §4.2–4.3); 05 FFD "tối ưu" (không); 03 §6.3 nhiễu 1..96 chỉ vượt ≤ 1 lớp khi eff ≳ 232; 03 §9 "Alignment KHÔNG phải vấn đề" (chỉ trung bình, ngoại lệ chế độ nhỏ); 06 Bài 18 "93 % trần → dừng" trái bảng Bài 18 §6 (độ hở 7,5 % = vùng 5–15 %); 06 Bài 7 "bài học nêu đúng gom cụm" trong khi Bài 7 §5.3 cảnh báo gom cụm cứng.
- **Việc điều phối giao thêm**: (1) 01 §4.3 trích Bài 18 cạm bẫy 4 — đã trích lại theo bản g8 ("nếu cận lỏng, khoảng cách lớn chưa chắc nghĩa là bạn còn xa tối ưu"). (2) 06 Bài 10 "1 157 lần" → thí nghiệm 2-opt TSP 200 điểm của Bài 10 §1 (213 381 485/184 355 = 1 157,4). (3) 2605 **không** dùng BHH/τ của Bài 18 §3–§4; chỉ có hai chỗ viện "Bài 18 §3" (05 §3.4, 06) — đã sửa về §2.1 và nêu rõ Bài 18 gọi đáp số bài nới lỏng là *cận trên*.

## Cần tác giả quyết định / chưa phân định được

1. 01 §3.1 "max_size = 64 → peak/LB 1,551 (tệ nhất)" vs 02 §5 (tệ nhất: v0 1,5276; đề xuất 1,3959 ≈ "1,40" ở 01 §4.3, 03 §12): không khớp số nào — chưa rõ lời giải/cơ sở của 1,551.
2. Cấu hình "phân lớp √2 + thời gian" (CRIT=8, FIT=0) có ba giá trị `peak/LB`: 1,0734 (03 §2.3, 06 Bài 5/11) · 1,0788 (02 §3.1, 20 TC) · 1,0841 (03 §1 v3, 100 TC); và 02 §3.1 gọi CRIT 8 là "luỹ thừa 2" trong khi v3 là √2. Chỉ thêm ghi chú cơ sở (03 §2.3).
3. Ablation "bỏ eff" (15 440 068) ≠ v3 (15 398 908) dù v3 = v4 trừ eff (−0,16 % vs −0,43 %): hai phép đo khác cấu hình.
4. Thời gian đề xuất 149/372 (02, 03 §5.3) · 153/389 (03 §6.5, §10: 6,5×, 2,6×) · 154/451 (04: 2,2×) — số đo không tái lập; giữ nguyên, đã ghi khoảng.
5. 03 §6.4: cột 99/100, và "lớp tỉ lệ 4" không thuộc 6 chiến lược chốt — cần bản ghi gốc.
6. 04 §5.1/§5.2 dùng `-DNSTRAT=1` nhưng §7 nói `#define NSTRAT 6` ở dòng 45: nếu không bọc `#ifndef` thì cờ dòng lệnh bị ghi đè (và -Wall cảnh báo redefined) — cần xem `solution.cpp`.
7. 04/tong-quan trỏ `bench/final_validation.txt` nhưng cây thư mục 04 §3 không liệt kê. 03 §12.2 "hai phía… dùng trong MiniMalloc" chưa kiểm chứng được. 06 mở đầu "cả 23 bài" trong khi khoá còn 4B/17B/18B/19B/20B.
8. Thuật ngữ: ở 2605 LB là *cận dưới của peak* (= cận trên của điểm); Bài 18 gọi "cận dưới" là một nghiệm — đã làm rõ ở 05/06, có thể cần một câu chung ở 01 §4.3.

## Phát hiện ngoài phạm vi

- `khoa-hoc/bai-12` §4.3 đề "Nhớ lại Bài 1: *cực trị cục bộ là tính chất của cặp…*" — đúng nguồn là Bài 1 §5.3 (OK), chỉ lưu ý không phải Bài 9.
- `bai-19` không có radix sort / mẹo "offset ⋮ 16": nếu muốn 2605/06 "xác nhận Bài 19" đầy đủ thì nên bổ sung vào Bài 19 (quyết định sư phạm).

## Bài thực hành có thể đang trích lại chỗ vừa sửa (`heuristic-practice-2/data/`)

- `ca-2605.js`: tomTat/"~150 ms"; q7 "First-Fit thắng Best-Fit **trung bình 3,2 %** (ở cả ba chỉ số)" (đúng: 3,2 % ở size giảm dần, TB ≈ 1,4 %); q8 "ở bài **2607 LNS cho +3,0 %**" và giải thích "Ở 2607 nghiệm là tuyến đường" (→ P2 của khoá); tomTat "hai phần ba" (OK, 67,5 %); tomTat 4 "peak/LB 1,0734" (OK nhưng khác thang 03 §1).
- `ca-2607.js` dòng ~59: "LNS lại cho **+3,0 %** ở đây nhưng −9 % ở 2605" (cùng nhầm 2607/P2).
- Từ khoá để rà: `+3,0 %`, `trung bình 3,2`, `bài 2607`, `93,7`, `90 %`, `2,64`, `13 xác nhận`, `Bài 22 §8`, `Bài 17 §8`.
