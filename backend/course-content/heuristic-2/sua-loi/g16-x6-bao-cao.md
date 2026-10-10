# Báo cáo g16 — cụm X6 (ca nghiên cứu 2605 + 2607)

Tệp vá: `sua-loi/g16-x6.json` — **18 bản vá** (2605/01: 2 · tong-quan: 2 · 00: 2 · 02: 1 · 03: 3 · 04: 2 · 06: 2 · 2607/01: 1 · 2607/03: 2 · 2607/05: 1), đều nhãn `[QUYẾT ĐỊNH]`.
Kiểm: `ap-dung-sua-loi.py --thu sua-loi/g16-x6.json` → **áp được 18 · đã áp từ trước 0 · lỗi 0** (chưa áp thật; người điều phối áp). Bản vá áp tuần tự lên bundle hiện tại (đã gồm g11/g12).
Trang thực hành: `data/ca-2605.js` (3 chỗ), `data/ca-2607.js` (2 chỗ); `kiem.js --bai=ca-2605,ca-2607` → **đạt 77 mục**.

## Từng mục quyết định

| # | Mục | Thi hành |
|---|---|---|
| 1 | 2605/01 §3.1 "1,551" | **Đã** — bản vá 1: ghi chú dưới khối mã nêu 1,551 vs bảng 02 §5 (1,5276 / 1,3959 ≈ "1,40"), chưa truy được nguồn, dùng số ở 02 §5. |
| 2 | 2605/04 `-DNSTRAT=1` + `final_validation.txt` | **Đã** — bản vá 11 (ghi chú `#ifndef` ở §7, ngay dưới bảng NSTRAT=6/2); bản vá 3 (tong-quan: tệp không có trong cây §3, chưa kiểm được; 04 không tự nhắc tệp này). |
| 3 | 2605/03 §12.2 MiniMalloc; 06 "cả 23 bài" | **Đã** — bản vá 9 (hạ mức: "ý tưởng gần với các bộ giải bin-packing hai phía; chưa kiểm chứng cụ thể ở MiniMalloc"); bản vá 13 (06) và **4 (tong-quan, cùng câu — sửa thêm cho đồng nhất)**. |
| 4 | 2607/03 §6 "~4,3 triệu" | **Đã** — bản vá 16 → "≈ 4,6 triệu (= 0,2 + 3 × (0,22 + 1,24); coi `nfCache` dựng riêng cho từng preset)". Tính lại: 205 000 + 3 × (223 000 + 1 240 000) = 4 594 000. |
| 5 | 2607/03 §9 "`act[]` dư 2,4×" | **Đã** — bản vá 17 (không khớp 461/528 ≈ 1,15×; chưa đối chiếu log gốc). §2 SA "vài nghìn lần đánh giá" giữ. |
| 6 | 2607/01 §5 đòn bẩy #3 | **Đã** — bản vá 15 (ước tính; đo thật greedy ≈ 1 512–1 514, đề xuất ≈ 1 519, dẫn 02 §1.4, §6). Hai số tính lại từ bảng 02 §6. |
| 7 | "Dư địa" → "độ hở" | **Đã** — bản vá 2 (01 §4.3 bảng; nhãn thêm "= `peak/LB` − 1"), 5–6 (00), 7 (02), 10 (03 §12.3), 12 (04 §8), 14 (06), 18 (2607/05 §3.5). Practice: ca-2605 q4 + tiêu chí l1; ca-2607 l3. **Giữ** hai chỗ nghĩa khác: 2605/03 §9 mục 3 ("còn nhiều dư địa" — phân mảnh, không là % tới cận) và 2607/03 đầu bài ("~2,6× dư địa so với 100 ms" — hệ số an toàn thời gian). |
| 8 | Ghi chú cơ sở đã có | **Kiểm lại:** ba giá trị peak/LB (03 §2.3: 1,0734 · 1,0788 · 1,0841) và các mốc thời gian (tong-quan ⚠️: 149/153/154, 372/389/451, 121/152) **còn đúng**, không đổi. Riêng **"bỏ eff" ≠ v3 không có ghi chú** trong bản hiện tại → xem "Chọn khác (a)". |

## Chọn khác điều phối (và vì sao)

- **(a) Bản vá 8 (2605/03 §8.2):** quyết định #8 coi ghi chú "bỏ eff ≠ v3" là đã có, nhưng bản md hiện tại chỉ có ghi chú ba giá trị peak/LB. Thêm một ghi chú một câu dưới bảng ablation (15 440 068 = −0,16 % so với v3 = 15 398 908 = −0,43 % so với v4; hai cấu hình khác nhau, chưa đối chiếu mã gốc). Không đổi số nào.
- **(b) Bản vá 16:** bảng "× 3 preset" không nêu rõ phần nào nhân ba; chọn cách đọc của g12 (nfCache và beam 31 ngày là chi phí mỗi preset, 3 dòng đầu dựng một lần) và ghi giả định vào ô. Nếu `nfCache` dùng chung thì ≈ 4,1 triệu — cả hai cách đều không ra 4,3.
- **(c) Bản vá 18:** "độ hở còn lại **tới mức tham chiếu**" (BHH không phải cận) để khỏi gây hiểu là cận chứng minh được.
- **(d) ca-2607 l3.mau:** "dư địa … 7,5 %" đổi thành "độ hở … tối đa ≈ 8,1 % (= 35 571 464 / 32 915 840 − 1; tính theo cận τ = 0 thì là 7,5 %)" — theo định nghĩa chung độ hở chia cho cơ sở (nghiệm), không chia cho cận; 8,1 % tính lại bằng code từ hai số có sẵn trong bài.

## Ngoài phạm vi / còn lại

- 2605/02 §3.1 bảng quét gọi CRIT 8 là "nhóm luỹ thừa 2" trong khi v3 (CRIT=8, 04 §5.1) là phân lớp √2 — không đổi theo quyết định #8; vẫn là một chỗ mơ hồ.
- 2605/03 §6.4 (cột 99/100) và 1,551 vẫn cần bản ghi gốc; chỉ có ghi chú, không có số mới.
- 2607/01 §5: "+3…5 %" của đòn bẩy #3 xuất phát từ ~1 450 → ~1 530 (chưa rõ 1 450 là baseline nào); không đổi.
- Bài 21 (bảng đòn bẩy, dòng tương ứng) và Bài 22 §8.5 (hệ số 2,4×) thuộc X5; hai chỗ tham chiếu chéo trong bản vá 15, 17 đã chừa sẵn cho khớp.
- Đã chạy nhầm một lệnh `git status` chỉ đọc khi kiểm bundle (không thay đổi gì).
