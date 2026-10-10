# Báo cáo cụm X2 (Bài 6–12 + dap-an) — thi hành quyết định thay tác giả

Tệp vá: `sua-loi/g16-x2.json` — **25 bản vá** (`[QUYẾT ĐỊNH]` 21 · `[SỐ]` 3 · `[THAM CHIẾU]` 1). `ap-dung-sua-loi.py --thu sua-loi/g16-x2.json` → `áp được 25 · đã áp từ trước 0 · lỗi 0` (chưa áp thật). Số bản vá đánh từ 1 theo thứ tự trong tệp.
Trang thực hành đã đồng bộ: `bai-06 … bai-12` (chỉ sửa chữ; id, số câu, đáp án đúng, lab không đổi). `kiem.js --bai=bai-06,…,bai-12` → **Đạt — 124 mục**, không `[SAI]`.

## Từng mục quyết định

| # | Nội dung | Kết quả |
|---|---|---|
| 1 | 20 lần 2-opt ngẫu nhiên (18 980/24 240/20 723, 1,277, 99 500) | **Đã thi hành** — #8, #9 (Bài 9 §7.2–7.3), #14–#19 (Bài 12 §1, bảng, §6.1, §6.2b, cạm bẫy 2, §10), #24–#25 (đáp án 12.1/12.2). Đáp án 9.x không nhắc số này → không có gì để vá. **Chọn khác một chỗ:** câu cơ sở dùng số do tôi tự dựng lại bằng C++ (2-opt quét tới hội tụ, Manhattan, toạ độ 0–999, 100 bộ n = 200): tệ nhất/tốt nhất ≈ **1,06–1,11** (p10–p90), NN+2-opt tốt hơn trung bình ngẫu nhiên **cỡ 3–5 %**, chỉ ngang lần tốt nhất ở n = 200 (trung vị 0,996), n = 600–1 000 thường thắng cả lần tốt nhất — thay cho "1,07–1,11 / 2–8 %" của quyết định, vì đó là số đã kiểm. Thêm: "đừng bao giờ khởi động từ ngẫu nhiên" → "thường không nên" (#17, #19); "(khi n đủ lớn)". Đáp án 12.2: đếm theo độ dài phụ thuộc thang toạ độ (≈ 450/500 với 0–999, ≈ 70–95 với 0–99), băm cả dãy đỉnh ≈ 900–1 000 ở cả n = 50 và 200 — "n = 50 chỉ 200–400" không tái lập; giữ số đo, ghi cơ sở. |
| 2 | 63 920 (λ = 80) vs 65 425; 64 490 vs ~64 200 | **Đã thi hành** — #1 (Bài 6 §6.3), #3 (Bài 7 §1). Đã kiểm nhật ký mẫu Ví dụ 1: "hạ λ 142 → 88, 61 001 → 65 425" nên câu "λ ≈ 88" bám đúng. Không thêm vào Bài 9 §6.2 (đã trỏ trong ghi chú Bài 6). |
| 3 | Bài 6 §7.3 "1 220 + 200" | **Đã thi hành** — #2 + practice bai-06 (`q3.giaiThich`, `l4.mau`, tomTat). Nguồn đã đối chiếu: 2607/03 §2.3 (loại máy biên 1 366,7; quét thực nghiệm tối ưu 1 420). |
| 4 | Đáp án 8.4 | **Đã thi hành** — #22 + practice bai-08 (`l2.hoi/mau`). Tính bằng code: E[max₄₀] = 2,1608, E[max₂₀₀] = 2,7460; cực đại 200 mẫu = c·[1 + 1,27·0,0099 + 0,27·m] → **+1,3 % (m = 0), +1,5 % (m = 1 %), +1,8 % (m = 2 %)**; ghi "≈ +1,5–1,8 % theo công thức (không phải đo)" kèm cách tính và cận m = 0. |
| 5 | Regret "~1,5 lần", "2–5 %" | **Đã thi hành** — #4–#6 (Bài 7 §3.3: ô bảng + ghi chú chi phí), #21 (đáp án 7.3). §10 và practice bai-07 đã hạ mức từ trước → không vá. |
| 6 | Bài tập 10.1 | **Đã thi hành** — #10 (đề), #23 (đáp án) + practice bai-10 `l1`. Kiểm bằng code với số liệu của đề: 29 → `[5,2,1,8,9]` = 17, Δ = 1+1−6−8 = **−12**; các biến thể công thức sai cho +12 / −13 / −5 / +16 (đều ≠ −12), còn đề cũ [1..3] đảo dấu vẫn ra 0. |
| 7 | Bài 11 §3.5 / §4.2 | **Đã thi hành** — #11 (25 200 + lời hạ mức), #12 (≈ 6,5 : 1; −2,6 vs −2,11 triệu; 2 200 phút là ước lượng), #13 (tóm tắt §9) + practice bai-11. 0,48 triệu giữ. Chọn thêm: "đo được" → "ước tính" vì số suy ra từ ước lượng. |
| 8 | Bài 12 §6.1 (n = 1500) | **Đã thi hành** — #16: giữ lệnh, ghi "hàng n = 1500 không có trong bảng" (cách ít mất dữ liệu nhất). |
| 9 | Lab `chan-doan-ket`, đáp án 9.3, Bài 7 §2.4 | **Giữ**, không đụng. |

## Việc ngoài danh sách (đã làm, nhỏ)
- #7 `[THAM CHIẾU]` Bài 8 §5.1: bỏ "Bài 12 §3 sẽ quay lại" (Bài 12 §3 không có σ·E[max]; g5 đã ghi tham chiếu treo).
- #20 Bài 12 §3.3 "gần hết dư địa" → "độ hở" (theo định nghĩa chung; practice bai-12 đồng bộ). Không đụng "dư địa" của Bài 18 §1.4.

## Ngoài phạm vi (không vá)
- Cùng chuỗi "20 lần ngẫu nhiên / 1,277 / 18 980–24 240": **Bài 13 dòng 39** ("kém chỗ tốt nhất 28 %") và `tai-lieu/cheatsheet` dòng 337 (bảng 1,277 / 1,158) — nên thêm "số đo gốc" cho khớp (X3/X5); Bài 15 do X3.
- "≈ 6 : 1" còn ở `2607/02, 03, 04, 05, tong-quan`, Bài 4, Bài 22, `cheatsheet`, `mau-nhat-ky` — nguồn làm tròn "khoảng 6 : 1" nên vẫn không mâu thuẫn với "≈ 6,5 : 1", nhưng X5/X6 có thể muốn đồng bộ.
- Bài 17 §5.2 (regret 1–3 %) do X4 sửa theo Bài 7 §3.3 hiện tại.
- Dựng lại thí nghiệm nằm ở scratchpad (`x2/dung_lai.cpp`, `dem_cuc_tri.cpp`, `tinh.py`), không đưa vào repo.
