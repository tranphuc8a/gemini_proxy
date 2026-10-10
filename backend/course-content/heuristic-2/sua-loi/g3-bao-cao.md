# Báo cáo rà soát nhóm g3 — Bài 4B, Bài 5, Bài 6, đáp án Bài 5–6

Tệp vá: `sua-loi/g3.json` — **27 bản vá**. `ap-dung-sua-loi.py --thu sua-loi/g3.json` → `áp được 27 · đã áp từ trước 0 · lỗi 0`.
Mọi số suy ra đã tính lại bằng code (mô phỏng ví dụ P1, vét cạn cái túi, bảng λ, ablation 2607).

## 1. Số bản vá theo nhãn

| Nhãn | Số | Bài / mục |
|---|---:|---|
| `[SỐ]` | 9 | 4B §7 (35/37/28 %), 4B §1.1 (56 lần), 4B §11 (8 việc); Bài 6 M5/§2/§11 (~5 % → 2,43 %); đáp án 5.1, 5.2, 6.2 |
| `[LOGIC]` | 8 | 4B §7 ("một nửa số điểm"), 4B §8 (SA 56 lần); Bài 5 §3.2 + §11 (−c ≠ nearest neighbour), §4.3 + §11 ("nhỏ nhất"); Bài 6 §7 ("nhiều điểm nhất"), §7.4 (cơ sở 1 561 phút) |
| `[MÂU THUẪN]` | 5 | 4B §2 vs §7 (thứ tự) và nhãn "EV cao nhất"; Bài 5 tiêu đề Cạm bẫy 3 (`>` ↔ `>=`); Bài 6 §6.3 (40 220); đáp án 5.4 (thu hẹp ↔ nới rộng) |
| `[THAM CHIẾU]` | 1 | 4B §7 ("bước ⑧" → quy trình 8 bước; "hai ô" → "ba ô") |
| `[NHỎ]` | 4 | Bài 5: "hơn 30 %" → đúng 30 %, hai tiêu đề Lab "bốn" → "ba", tie-break "chỉ số bé hơn" → số thứ tự |

## 2. Mục đã biết được giao

- **Mục 16 (Bài 4B) — xác nhận cả ba ý.** (a) §2 "làm điều kiện cần trước" ↔ §7 đặt đọc grader/6 câu trước bộ chấm: sửa §2 (điều kiện cần trước mọi *cải tiến*; hai việc chỉ cần đọc là ngoại lệ) và nhãn §7. (b) 25+30+30 = 85 phút = 35,4 %; 90 = 37,5 %; 65 = 27,1 % (bài ghi 35/37/28). (c) bảng §2 có 8 dòng, 6 dòng có EV.
- **Mục 30, nửa đầu (Bài 6 §6.3) — xác nhận.** λ = 0 chính là greedy tiền nhất = 37 876 < 40 220; chèn λ = 0 hơn greedy tiền nhất 6,2 % và thua greedy tỉ số 34,5 %.
- **Mục 32, nửa đầu (Bài 6) — xác nhận.** "~5 %" (§2, M5, §11) không có nguồn; ablation 2607 cho số hạng phạt −2,43 % (32 116 796/32 915 840), khớp Bài 4B, Bài 22, 2607/03 §7. Đã đổi cả ba chỗ thành +2,43 %.

## 3. Lỗi mới tự tìm ra

- **Đáp án 5.1 sai:** từ đơn 4 (t=18) tỉ số đơn 3 = 162,2 cao nhất, không phải đơn 1 (90,9). Kết quả đúng **9 700** (không phải 9 200). Bốn lần xuất phát cho 10 500 / 8 500 / 8 500 / 9 700 (tối ưu vét cạn = 10 500).
- **Đáp án 5.2:** 35 % không thoả đề ">40 %". Thay bằng W=100, X(52,51), Y(50,50), Z(50,50): greedy 52, tối ưu 100, sai 48 % (kiểm bằng code).
- **Đáp án 5.4:** "khoảng cách thu hẹp" trong khi −15,9 % so với −12,9 % là nới rộng.
- **Đáp án 6.2:** ngưỡng hoà vốn của đề là 250 000/192 ≈ 1 302 (không phải 1 389); "máy m=5" không có trong đề.
- **Bài 5 §3.2/§11:** −c_j (c = d+s) không trùng nearest neighbour (ở bước t=40 của §5.2 −c chọn đơn 2, gần nhất chọn đơn 3). **§4.3/§11:** "phản ví dụ nhỏ nhất" sai (có phản ví dụ 2 món W=3: X(2,1), Y(3,3) → 2 so với 3).
- **Bài 4B §8:** "gấp 56 lần" là so với tinh chỉnh; so với tìm kiếm (SA) chỉ 7,6 lần. **§1.1:** 56 là tỉ số năng suất, tổng là 9,3 lần.
- **Bài 6 §7:** "nhiều điểm nhất" sai (khung ngày 31 = 3,08 % > 2,43 %); bảng 1 561 → 88 phút lẫn 720 phút của khung ngày thứ 31 (đã thêm một câu nêu cơ sở).

## 4. Cần tác giả quyết định (không sửa)

1. **4B §2, dòng "Hỏi 6 câu" Δ = 30 %** (EV 9,0): 2609 đo được +6,67 % (cộng gỡ 17 % TLE; cách cận trên ~6 % → 0,24 %). Nếu Δ ≈ 6,67 % thì EV = 2,0 < 3,0 của đọc grader và §2.1 ("đứng đầu") sai. Đề xuất: nêu 30 % là giả định hoặc đổi số và viết lại §2.1.
2. **4B §6 ↔ §7 ↔ 19B §7:** §6 đóng băng ở T−45 và chạy chẩn đoán ở T−15, nhưng quy trình ở 19B §7 dài 20 phút; §7 xếp chẩn đoán 190–205 và đóng băng 220–240. Cần một lịch duy nhất. Cũng bảng §2 (bộ chấm 1,0 giờ, cận trên 0,5 giờ) ≠ §7 (30 và 15 phút).
3. **Bài 6 §7.3** (λ ≈ 1 220 + 200): không truy được nguồn; 2607/03 §2.3 cho p/(s+τ) của loại máy biên = 1 367 (chưa có OT, vì OT nằm ở tử số) và thực nghiệm 1 420. Đề xuất bỏ phân rã hoặc nêu nguồn của 1 220.
4. **Bài 6 §6.4** ("p/Δt bùng nổ") cùng họ với mục 31 (Bài 7 §2.3): Δt = đi vòng + s_j; nếu s_j ≥ 5 thì không bùng nổ. Hai bài nên đổi cùng một cách.

## 5. Chưa phân định được

Số đo thực nghiệm không có mã gốc: đáp án 5.3 (α ≈ 1,0–1,2), 5.4 (59 452), 5.5 (regret +1–3 % / +3–5 %, lệch nhẹ với Bài 5 §3.4 "2–5 %"), 6.3 (λ ~88 → ~110–120, trong khi bảng §6.1 cho 100 / 80), 6.5 (+0,3–0,8 %). Bài 6 §6.3 chèn tốt nhất 63 920 (λ cố định 80) ↔ Bài 4 §8 / Bài 16 chèn rẻ nhất 65 425 (có thể do `doGiaMoQuet` chọn λ theo từng test).

## 6. Phát hiện ngoài phạm vi

- `khoa-hoc/03-ban-do-kien-thuc`: "…nguồn gốc của 5 % điểm số" (giá mờ) → nên là +2,43 %. Họ số "~5 %" còn ở Bài 1 §9 ("mô hình sai làm mất ~5 %") và Bài 3 (`viTri` không reset, "~5 %"), 2607/02 ("greedy → beam +5 %"; v2→v4 thực +3,06 %) — không ablation nào ủng hộ.
- `2607__tong-quan`: "1 561 → ~88 phút" cùng vấn đề cơ sở (1 561 có 720 phút của khung ngày thứ 31).
- Bài 7 §8 cạm bẫy 3 (mục 30, nửa sau): theo Bài 6 §6.3, 63 920 là chèn với λ = 80 và 40 220 là chèn với λ = 0 (không phải với tỉ số).

## 7. Nội dung bài thực hành cần đồng bộ (`heuristic-practice-2/data/…`)

- `bai-04b-phan-bo-cong-suc.js` dòng 85: "35 % … 37 % … 28 %" → 35 / 37,5 / 27 %.
- `bai-05-greedy.js`: dòng 9 "Phản ví dụ nhỏ nhất" → "nhỏ"; dòng 124 (`l1.mau`): "7/6, 5/5, 5/5 … chỉ sai 30 % vì X nhỏ hơn nửa túi" — sai (X = 6/10 > nửa túi; lý do đúng: sai < 1 − w_X/W).
- `bai-06-gia-mo.js`: dòng 66 "khoảng +5 % điểm" → +2,43 %; dòng 93, 202 ("khoảng 1 220") nếu tác giả đổi §7.3.
