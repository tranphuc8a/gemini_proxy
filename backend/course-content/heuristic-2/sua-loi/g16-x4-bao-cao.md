# Báo cáo cụm X4 (Bài 16, 17, 17B, 18, 18B, 19) — thi hành quyết định thay tác giả

Tệp vá: `sua-loi/g16-x4.json` — **13 bản vá**, tất cả nhãn `[QUYẾT ĐỊNH]`. `ap-dung-sua-loi.py --thu sua-loi/g16-x4.json` → *áp được 13 · đã áp từ trước 0 · lỗi 0* (chạy hai lần liên tiếp trong một lệnh: lần hai 13 "đã áp" ⇒ idempotent). **Chưa áp thật** vào bundle. Bản vá khớp nguyên văn bản md2 (md2 trùng bundle hiện tại cho cả 7 tài liệu của cụm).

## Mỗi mục quyết định

| # | Quyết định | Kết quả | Bản vá |
|---|---|---|---|
| 1 | Bài 16 §7 bảng W | **Đã thi hành.** Giữ số; thêm hộp ⚠️ dưới bảng: SCORE bảng = 300 test, §7.1(c) = 40 test (nên W=32,B=10 ra hai số); cột thời gian là số đo thô, không đơn điệu, lệch nguồn (W10/B6 nguồn 3,4 ms, bảng 40 ms); số đáng tin cho W=32,B=10 = 14,5 ms. | #1 |
| 2 | Bài 17 §5.2 regret | **Đã thi hành.** "1–3 %, đắt gấp đôi" → "kỳ vọng 2–5 % (Bài 7 §3.3), chi phí cùng bậc O(n·m), chưa có phép đo riêng". **Chọn khác nhỏ:** không ghi hệ số chi phí (Bài 7 đang ghi "~1,5 lần" và X2 sắp đổi) để khỏi lệch dù X2 viết thế nào. Sửa cả dòng tóm tắt §11. | #2, #3 |
| 3 | Ropke & Pisinger; Dorigo & Stützle ch. 3 | **Đã thi hành.** Bài 17 §4.3 và §11: "mạnh nhất" → "được dùng nhiều nhất trong họ ALNS; thứ hạng phụ thuộc bài toán". Câu "Dorigo & Stützle chương 3" nằm ở **Bài 17B** (không phải Bài 17) → vá ở đó, bỏ số chương và bỏ "có đúng ví dụ này". | #4, #5, #8 |
| 4 | 17B nơron + số chương Đọc thêm | **Đã thi hành.** "250 000 nơron, ít hơn ruồi" → "cỡ 10^5 nơron" (bỏ so sánh ruồi). "Chương 15/16" → chỉ nêu chủ đề, trỏ bảng ở Tài liệu tham khảo. | #6, #7 |
| 5 | 17B §1.7 elitist có bay hơi | **Đã thi hành sau khi tự mô phỏng.** Mạng 4 thành phố §1.1, elitist, Q=1, tuyến tốt nhất dài 11: ρ=0,5 → P(A–C) = 9,8 % (vòng 1) … 0,068 % (vòng 10; vòng 9 còn 0,136 %) ⇒ < 10⁻³ lần đầu ở **vòng 10**; ρ=0 → vòng 1 396–1 397 (khớp "≈ 1 400"). τ cạnh dẫn đầu → Q/(ρL) = 0,1818 (mô phỏng 0,1826 ở vòng 10). Thêm: tuyến mới ngắn hơn 10 % vượt mùi cũ sau 1 vòng (ρ=0,5), 6–7 vòng (ρ=0,1), còn ρ=0 cần ≈ 0,9·N vòng. **Chọn diễn đạt khác điều phối một chút:** câu thêm nói thẳng bay hơi làm đàn khoá *nhanh hơn* (để không mâu thuẫn tiêu đề "bay hơi giữ cho đàn không bị khoá"), rồi nêu lý do nó vẫn có ích (mùi bị chặn nên đổi hướng nhanh). Không nêu "MMAS/τ_min" vì không kiểm được. | #9 |
| 6 | Bài 19 §3.2 top-K | **Đã thi hành.** Câu mở bỏ "nhanh hơn sort"; câu cuối: mỗi `push` O(K) (heap O(log K)), tổng O(nK), "chỉ lợi nhờ hằng số nhỏ khi K nhỏ", dẫn §1.1 (n=400, K=24 thì sắp xếp ít phép hơn); không nêu ngưỡng. (Mã `push` quét tới K ô khi v không lọt nên O(K) mỗi lần là đúng.) | #12, #13 |
| 7 | 18B §7.3 và κ(vuông) | **Đã thi hành.** §7.3: tách "1,205 = tỉ lệ số nước đi" khỏi "0,24 % = khoảng cách tới trần điểm", ghi bước suy luận không kiểm lại được từ mã; bỏ từ "dư địa" ở đây để khỏi lẫn "độ hở"/"dư địa" của Bài 18. κ: bài chưa có chú thích → thêm "đo trên lưới; chính xác 2/3 ≈ 0,6667" (2/3 tính lại bằng python). Chebyshev giữ nguyên. | #10, #11 |
| 8 | Lab `hai-opt-ngan-sach` | **Giữ**, không đụng lời giải/bộ chấm. | — |
| 9 | dap-an 18.3 / 19.x | **Giữ.** Đã đọc cả mục Bài 16–19 của dap-an: không có chỗ nào nhắc lại phần bị sửa (17B.1 đã nêu τ → Q/(Lρ) = 0,182, khớp bản vá #9) ⇒ **không có bản vá dap-an** và **không có bản vá Bài 18**. | — |

## Đồng bộ trang thực hành (`heuristic-practice-2/data/`)
Sửa nhỏ, không đổi id/số câu/đáp án/lab: `bai-16` q8.giaiThich (ghi chú cột thời gian, 300 vs 40 test); `bai-17` tomTat (Ropke, regret 2–5 %); `bai-17b` q2.giaiThich (câu bay hơi elitist); `bai-18b` tomTat (1,205 vs 0,24 %) + `giaiThich` κ (2/3); `bai-19` l1.mau + tieuChi (bỏ "K < log n"). `bai-18` không đổi. **`node …/kiem.js --bai=bai-16-beam-search,bai-17-lns-alns,bai-17b-bay-dan-tien-hoa,bai-18-can-tren-can-duoi,bai-18b-cau-truc-ham-muc-tieu,bai-19-ky-thuat-cpp` → Đạt, 113 mục (bằng trước khi sửa), exit 0.**

## Ngoài phạm vi (không vá)
- **dap-an mục Bài 5.5** ("regret +1–3 % / +3–5 % gom cụm") và **Bài 7 §3.3 "~1,5 lần"** (cụm X2) còn lệch với "2–5 %, chưa đo" mà Bài 17 nay nhắc tới; mục dap-an 7.3 ("+0,5–1,5 % / +2–4 %") cũng khác con số của 5.5 — cần X2 đồng bộ.
- **Tài liệu tham khảo** (cụm X5): bảng không có chapter-15; chú thích "số chương chưa đối chiếu" do X5 thêm — Bài 17B đã trỏ về bảng đó.
- Bảng "Bốn đòn bẩy"/Bài 22 nhắc beam −2,43 %: không đụng.

Ghi chú quy trình: tôi lỡ chạy một lệnh `git status --short` (chỉ đọc, không đổi gì) để xem bundle; ngoài ra không chạy git, không đụng bundle/DB/`dem.js`/`khoa.js`/tệp vá cũ.
