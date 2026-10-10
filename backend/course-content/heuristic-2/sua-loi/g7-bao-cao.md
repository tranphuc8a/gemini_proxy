# Báo cáo rà soát nhóm g7 — Bài 16 (Beam), Bài 17 (LNS/ALNS), Bài 17B (Bầy đàn) + mục tương ứng của `dap-an`

Tệp vá: `sua-loi/g7.json` — **38 bản vá**, `ap-dung-sua-loi.py --thu` cho: *áp được 38 · đã áp từ trước 0 · lỗi 0* (đã thử áp hai lần liên tiếp trong bộ nhớ: lần hai 0 áp / 38 "đã áp" ⇒ idempotent).

Theo nhãn: **SỐ 17 · LOGIC 16 · MÂU THUẪN 4 · NHỎ 1**. Theo bài: Bài 16 = 19, Bài 17 = 4, Bài 17B = 6, dap-an = 9 (16.1, 16.2, 16.4, 16.5, 17.1, 17.2, 17B.1 ×2, 17B.4).
Mọi bản vá đều tự mô phỏng bằng python (beam làm tay, liệt kê tập con LNS, C(260,16)·16!, ACO elitist nhiều vòng, SE) trước khi sửa.

## Mục đã biết được giao
| Mục | Kết luận | Bằng chứng |
|---|---|---|
| 17 — 17B §1.6 "A–B > 95 %" / đáp án 17B.1 "P(B)→1" | **Xác nhận** | mô phỏng 40 vòng: P(B)=72,2→73,9→75,7→77,3→78,5→…→**80,0 %** (=0,25/0,3125); P(D)→20 % vì D–A cũng thuộc tour tốt; P(B)+P(D) > 95 % ở vòng 4 |
| 17 — §1.7 điều 2 "vài chục vòng … nghìn lần" | **Xác nhận** | không bay hơi: tỉ số mùi = 1 + k/11 ⇒ k=30 → 3,73; cần k≈10 989 để gấp 1 000; P(chọn A–C)<10⁻³ cần k≈1 397 |
| 17 — §7 "cột"/"hàng" | **Xác nhận** | cột cuối của hàng chỉ có 1 ô; câu nói về "bốn cái tên" ⇒ đọc cả hàng |
| 17 — đáp án 17B.1 | **Xác nhận** (+ lỗi phụ mới, xem dưới) | |
| 17 — đáp án 17B.4 | **Xác nhận** | tập quét {0,1…1,3} không có F=1,0; F=1,1 không thuộc nhóm nào |
| 19 (nửa 17B) | **Xác nhận** (cột/hàng, 17B.4) | như trên |
| 46 — Bài 17 §2.1 "10³⁰" | **Xác nhận** | C(260,16)·16! = 2,72·10³⁸; ÷2 080 = 1,31·10³⁵ (đáp án 17.1 "35 bậc" đúng, nhưng viết "= 10³⁸" sai → vá nhẹ) |
| 46 — đáp án 17.2 (Q=0,60 kém ~2 %) | **Chưa phân định** | số đo gốc không tái lập; chỉ thêm câu nêu cơ sở/giới hạn |
| 47 — Bài 16 §6.1 (beam thua chèn) | **Một phần** | số 64 273/65 425 là đo của lab gốc (giữ); lời giải thích "vì nối vào cuối" hạ thành "một lý do hợp lý" + nêu phụ thuộc dữ liệu/ρ |
| 47 — đáp án 16.4 (0,85; 2–4 %) | **Một phần** | không tái lập; hạ khẳng định, nêu phép đo ship1 (0,97–0,98; 0,3 %) |
| 47 — §1.4 luật phá hoà | **Xác nhận** | ba phương án B→D, C→D, C→B hoà tiền lẫn đồng hồ; thêm luật "hoà nốt lấy cái đứng trước trong bảng" (khớp mô phỏng) |
| 47 — §2.4 vs §2.6 (3 % vs 2 %) | **Ngoài phạm vi** | nằm ở Bài 15 (`chance(0.03)` §2.4, `chance(0.02)` §2.6); Bài 17 chỉ dùng 2 % nhất quán |

Quyết định thống nhất số 5 (ρ vs λ): **đã xử lý** ở Bài 16 §4.3, §4.4, cạm bẫy 1, §11, từ điển, đáp án 16.2. Bằng chứng từ `2607/03`: f = Σvᵢ là giá trị **ròng** (vᵢ = p + OT − λ·cᵢ), λ ≈ **1 420** còn ρ tối ưu = **90** (khác 16 lần); bỏ hẳn ρ chỉ mất 0,15 % (bảng §4.3) / −0,10 % (ablation). "ρ = λ" và "thiếu ρ ⇒ thoái hoá thành greedy" chỉ đúng khi f là điểm **gộp** (P1: `tien`). Đã thêm điều kiện đó, không bỏ ý chính.

## Lỗi mới tự tìm ra
1. **Bài 17 §1.3**: "bốn thay đổi, ba bước đầu lỗ" — {F,G,A,B}→{F,G,C,D,E} khác nhau **5** phần tử; đi từng bước 1080→1040→1000→1035→1070→1105 = **4** bước lỗ. Đầu bài cũng nói "năm chỗ". Sửa hai chỗ.
2. **Bài 16 §1.5 điều 1**: ví dụ tự mâu thuẫn — với cách chấm "tiền đã thu" của §1.4, **W=1 cũng ra 300**; chỉ khi chấm "nghìn/phút" (§1.2) thì W=1→260, W=2→300. Thêm câu làm rõ, không đổi bảng.
3. **Bài 16 §1.4**: "hơn 13 % tiền" — 300/260 = +15,4 % (13 % là 40/300). Sửa.
4. **Bài 16 §6.2** "beam **là** thành phần mạnh nhất" ↔ §11 "mạnh thứ hai"; bảng 2607/03 §7: khung ngày 31 = −3,08 % > beam = phạt thời gian chết = −2,43 %. Sửa heading + nêu bảng.
5. **Đáp án 16.5** "~30 % thời gian lãng phí": W nhân đôi, chi phí ∝ W ⇒ lãng phí → **50 %** (46,7 % khi K=3). Sửa.
6. **Đáp án 16.1**: "tất cả" = 4 + 9×12 = **112** (120 là cận trên; tầng 1 chỉ có gốc). **16.2**: 58 103 < greedy 61 420 nên không phải "gần bằng greedy".
7. **Đáp án 17B.1**: "phải có ρ đủ lớn, nếu không hội tụ quá sớm" **ngược chiều** — tỉ số mùi sau 5 vòng: 1,5 (ρ=0,05) … 6,6 (0,5) … 10 102 (0,9); ρ lớn mới hội tụ sớm.
8. **Bài 17 M2** "3 toán tử phá" ↔ §4, §6.1, §11, 17.5 đều **4**. **Đáp án 17.1** "10²⁵×2·10¹³ = 10³⁸" (thực 2,7·10³⁸).
9. **"Tối đa 12 nhà/ngày" (chuyển từ g12) — XÁC NHẬN SAI, đúng là 11**: nhà ở ô phân biệt (2607/01 §2.1) ⇒ mỗi nhà ≥ 1 phút đi; sₘᵢₙ = 60 ⇒ 12 nhà cần ≥ 12·60+11 = 731 > 720; 11 nhà cần ≥ 670 ≤ 720. Đã vá Bài 16 §5.1 (câu, chú thích mã, "≤ 11 phần tử") và Bài 17B §8.2 (3 chỗ) + tóm tắt §11; mảng `take[13]` giữ nguyên (dư ô).

## Cần tác giả quyết định / chưa phân định được
- **Bài 16 §7 bảng W**: cột thời gian (31, 40, 56, 27, 40, 41 ms) không đơn điệu theo W và mâu thuẫn với §7.1(c)/2607/03 §5 (W32/B10 = **14,5 ms**, W10/B6 = 3,4 ms); cùng cấu hình W=32,B=10 có SCORE 32 979 370 (bảng, "300 test") và 32 907 685 (§7.1c, "40 test"). Không có dữ liệu gốc ⇒ **không sửa số**; đề nghị tác giả ghi rõ tập test và đơn vị thời gian (một beam hay cả đường ống nhiều preset).
- **Bài 17B §1.7 điều 2 / elitist**: với cập nhật elitist *có* bay hơi, P(A–C)<10⁻³ chỉ sau ≈10 vòng (τ_xấu→0 theo cấp số nhân) — nhanh hơn nhiều so với không bay hơi (≈1 400 vòng). Luận điểm "bay hơi giữ cho khỏi bị khoá" đúng về khả năng *đổi tuyến* khi tìm được tuyến tốt hơn, nhưng cần nói thêm vì sao (cận τ_min kiểu MMAS). Chưa sửa vì là quyết định sư phạm.
- **Làm tròn 17B §1.3**: 0,04/0,3525 = 11,35 % → 11,3 %; bài ghi 11,4 % (4 chỗ) để tổng = 100 %. Không sửa.
- **Bài 17 §5.2** "regret tốt hơn 1–3 %, đắt gấp đôi" ↔ Bài 7 §3.3 (2–5 % trên dữ liệu cụm, chi phí ~1,5×; chính Bài 7 cũng nói "gấp đôi" ở bảng). Để nhóm Bài 7 quyết rồi đồng bộ.
- Chưa kiểm chứng được (cần tài liệu ngoài): "phá theo quan hệ là mạnh nhất theo Ropke & Pisinger (2006)"; "Dorigo & Stützle chương 3 có đúng ví dụ này"; "bộ não kiến 250 000 nơron, ít hơn con ruồi" (nguồn tìm được: kiến 50–150 nghìn, ruồi giấm ~100–250 nghìn); "~0 %" ở bảng §8.1 Bài 17 thực ra +0,7 % (không có ý nghĩa thống kê).
- DE F=0 "đứng im": thực ra v=a chỉ không sinh giá trị toạ độ mới (độ toè chỉ giảm); diễn đạt lỏng, không sửa.

## Phát hiện ngoài phạm vi
- `khoa-hoc/bai-02-vi-sao-kho` (~dòng 426 "mỗi ngày ≤ 12 nhà", bài tập 2.4 "tối đa 12 ngôi nhà (720/60 = 12)"), `dap-an` 2.4 ("12 nhà, Held–Karp 144×4096"), `bai-23-tu-danh-gia` (~dòng 299 "tối đa 12 ngôi nhà … Held–Karp"), `2607/03` §3.1 và §3.2 ("tối đa 12 ngôi nhà (720/60)", "≤ 12 phần tử"): cùng lỗi 12→11 (nhóm phụ trách cần đồng bộ; tính lại Held–Karp 11 nhà nếu cần).
- Bài 15 §2.4 (`chance(0.03)`) vs §2.6 (`chance(0.02)`).
- 2607/03 §3.4 nói "ρ = 90 khớp tốt với lý thuyết" nhưng không nói f là ròng ⇒ nhóm 2607/Bài 23 §1.3 xem lại "ρ chính là λ".

## Bài thực hành `heuristic-practice-2/data/*.js` có thể đang trích lại chỗ vừa sửa
- `bai-16-beam-search.js`: dòng ~60 "(hơn 13 %)"; ~74 "(300 − 260)/300 = 13,3 %"; ~93 "tỉ lệ 1 : 8 738" (nay 112 → 1 : 9 400); ~214 "khoảng 30 % thời gian bị lãng phí" → 50 %; ~203 "beam … mạnh nhất"/"mất 2,43 %"; ~230/416 luật phá hoà ("hoà thì t nhỏ hơn, rồi chỉ số đơn nhỏ hơn" — khớp luật mới); ~123 "ρ không phải xác suất … vì đã có λ" và mọi chỗ "ρ = λ"; từ khoá "12 ngôi nhà", "take[13]".
- `bai-17-lns-alns.js`: ~71 và ~97 "bốn thay đổi / ba bước đầu đều lỗ" → năm/bốn; ~191 chú thích "Bài giảng §2.1 viết cỡ 10³⁰ lần" (nay bài giảng đã là 10³⁵ — bỏ chú thích); ~73 "mạnh nhất theo Ropke & Pisinger"; ~202 "đáp án 17.2 … kém hơn khoảng 2 %".
- `bai-17b-bay-dan-tien-hoa.js`: ~72, ~172, ~208, ~214 "nghiệm chỉ ~12 phần tử", "12 phần tử; 720 phút" → ≤ 11; ~182–183 (đã nêu P(B)→80 %, khớp bản vá); từ khoá "95 %", "nghìn lần", "ρ đủ lớn", "F = 1,0".
- `ca-2607.js`, `bai-22-bay-phien-ban.js`, `bai-23-tu-danh-gia.js`, `bai-02-vi-sao-kho.js`: từ khoá "12 ngôi nhà", "720/60", "mạnh thứ hai/mạnh nhất" (beam).

## Kết quả lần chạy cuối
```
PYTHONUTF8=1 python ap-dung-sua-loi.py --thu sua-loi/g7.json
áp được 38 · đã áp từ trước 0 · lỗi 0
```
