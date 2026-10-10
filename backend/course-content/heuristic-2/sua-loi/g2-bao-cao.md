# Báo cáo rà soát nhóm g2 — Bài 2, 3, 4 và đáp án Bài 2–4

Tệp vá: `sua-loi/g2.json` — **44 bản vá** (Bài 2: 12 · Bài 3: 15 · Bài 4: 7 · `khoa-hoc/dap-an`: 10).
Theo nhãn: SỐ 19 · LOGIC 13 · NHỎ 5 · MÂU THUẪN 3 · THAM CHIẾU 2 · MÃ 2.
`ap-dung-sua-loi.py --thu sua-loi/g2.json` → **áp được 44 · đã áp từ trước 0 · lỗi 0**.
Mọi con số trong bảng/đáp án đã tính lại bằng Python (big-int) hoặc g++ (mô phỏng bộ giải mã Bài 3 §8.2).

## Kiểm chứng danh sách lỗi đã biết

| Mục | Kết luận | Bằng chứng ngắn |
|---|---|---|
| 8 (Bài 2 bảng §2.1) | **xác nhận** | 10¹⁸/10⁹ = 31,7 năm (36 năm là của riêng 2⁶⁰; 20! → 77 năm). 10²⁴ → 3,17×10⁷ năm = 32 **triệu** năm (không phải 36 tỉ); §2.2 tự tính ra 32 triệu rồi biện hộ cho bảng sai → sửa cả bảng lẫn đoạn biện hộ |
| 9 (bảng §7.3) | **xác nhận** | 25!/10! = 4,27×10¹⁸; 30!/15! = 2,03×10²⁰ |
| 10 (mở đầu, §3.3) | **xác nhận** | 15 vòng ở máy nhanh 10⁹ lần = 2×10⁶ s ≈ 23 ngày; 63 triệu năm cần 24 vòng. "100 000 lần tuổi vũ trụ" → ≈ 1,4–2,3×10⁴ (tuổi thật 4,35×10¹⁷ s) |
| 11 (đáp án 2.1d, 2.2) | **xác nhận** | Σ₍ₖ≤₁₀₎ 60!/(60−k)! = 2,79×10¹⁷ → 8,8 năm. 2.2: 100 ms = 10⁸ phép → n = 18 (n=19: 1,9×10⁸); 10 s → n = 24 ⇒ +6. Đáp án cũ sai cả với ngân sách 10⁷ (n = 15, không phải 16–17) |
| 12 (Bài 3 §2.1/§5/§11) | **xác nhận** | §6 chỉ so 3 thủ tục dựng nghiệm; BT 3.4 còn ghi "(A) và (B) dùng cùng một biểu diễn". 5,69 % = (B−A)/A; so với B thì A thấp hơn 5,38 %. Hạ 4 chỗ khẳng định ("§6 đo, và D thắng rõ"…), không đổi số |
| 13 (Bài 3 §8.2) | **xác nhận** | Mô phỏng: SO_NGAY_TOI_DA = 5 → mã cũ dùng **6** ngày, mã sửa 5. Dòng "tính lại chiPhi" là no-op (lý do ghi trong bảng sai). Đơn chi phí 150 > ngân sách 100 vẫn lọt (t = 150) → hạ "không bao giờ" thành có điều kiện |
| 14 (Bài 3 đáp án + §3.3 + §7.1) | **xác nhận** 3.5(a), 3.1, §7.1; **một phần** §3.3 | 3.5(a): {A} (A=10, B=20, ngân sách 100) không có mã; chỉ nghiệm cực đại giải mã đúng. §3.3: "đóng miễn phí" đúng về cấu trúc, sai khi có ràng buộc cỡ nhóm (BT 3.2) → thêm điều kiện. §7.1: D(90) = 55 + B→D, mà bài chỉ nêu D→C = 8 |
| 15 (Bài 4) | **xác nhận cả bốn** | Hệ số chồng lấn ∫min(f₁,f₂) = 0,5175 (không phải ~70 %). §7.3(a): Δ = 36,3, N = 60·(976,5/36,3)² = 43 417 (kể cả Δ = 37 cũng ra 41 790). Đáp án 4.1: so theo cặp → N > 23,06 ⇒ 24. Đáp án 4.4: 5 625/65 425 = 8,6 % (cơ sở của §5.1–5.2), +9,4 % là trên bản đã tắt |

**Về "tối đa 12 nhà/ngày" (chuyển từ g12):** xác nhận = 11. Nhà ở các ô phân biệt (2607/01 §2.1), mỗi nhà ≥ 60 phút, giữa hai nhà ≥ 1 phút: 12 nhà ≥ 731 > 720. Đã sửa Bài 2 §9, BT 2.4 và đáp án 2.4 (11²·2¹¹ = 247 808 ≈ 0,25 ms; 31 ngày ≈ 7,7 ms; 93 lần ≈ 23 ms ⇒ bỏ kết luận "sát 100 ms"). §4.3 "cỡ 12–15" là chung chung, giữ; tóm tắt Bài 2 không nêu số này.

## Lỗi mới tự tìm ra
- Bài 2 §4.3 và BT 2.4 trỏ "Bài 16 / Bài 21" làm nền cho Held–Karp từng bài con — hai bài đó không có; đúng là **Bài 23 §6.3**. Đáp án 2.4 trỏ "Bài 23 §5.3" (không tồn tại) → §6.3.
- Bài 2 §6.1: "n ≤ 20 → vét cạn" trái với 20! ≈ 2,4×10¹⁸ của chính bài (vét cạn hoán vị chỉ tới n ≈ 12).
- Đáp án 2.4 thêm hệ số "3 preset" không có trong đề.
- Bài 3 §2: mảng `order` của cách C không phải cùng nghiệm 3-7-1 / 5-2 / 9-4-6 (là thứ tự tăng theo mã đơn); tiêu đề "ba cách" nhưng có bốn; Cạm bẫy 2 chỉ khử hệ số n trong 2n; đáp án 3.2 bỏ ý "có dư thừa không" (34 650 mã / 5 775 cách chia = ×6); đáp án 3.4 dùng "+6,5 %" (P1) và "+~2 %" (không nguồn) cộng với A→B = +5,69 % của P2.
- Bài 3 §8.2: "đọc nhầm `viTri` không reset làm mất ~5 % điểm" không có nguồn (ablation 2607: khung ngày 31 −3,08 %, beam −2,43 %, phạt −2,43 %, di chuyển chết −0,45 %; 2607/tong-quan ghi mục này là "quyết định cách mô hình hoá", không kèm %) → hạ, không thay bằng số khác.
- Bài 4: §3.3 "đi xuống mỗi hàng chênh giảm một nửa" sai ở hàng 5 %→2 %; tóm tắt "cải thiện 10 % → 30 test" lệch bảng (8 test); đáp án 4.2 bỏ cột `sd`.

## Cần tác giả quyết định
1. **Đáp án 3.1, ý "tiêu chí nào"**: tôi chọn ③ (địa phương) dựa vào Bài 3 §9 cạm bẫy 2 — dư thừa không phải tiêu chí riêng. Tác giả xác nhận hoặc chọn khác.
2. **Ví dụ §7.1**: số liệu (B→D→C = 43 so với B→C→D = 75) không khớp bất kỳ bản đồ Manhattan nào (cần ≥ 75 − d(C,D)). Đã nêu rõ chi phí giả định và tính không đối xứng; nếu muốn ví dụ "thật" thì đổi số.
3. **§8.2**: tôi sửa điều kiện thành `soNgayDaSang + 1 >= SO_NGAY_TOI_DA` (hằng = tổng số ngày). Mã thật ở Bài 22/19 dùng `MAX_NEXTDAY = 30` (số lần sang ngày) với `>=` — nếu muốn thống nhất, đổi tên hằng thay vì thêm `+1`.
4. **M4 "bằng số liệu thực nghiệm"**: chỉ được đáp ứng gián tiếp; muốn đủ cần một lab đặt biểu diễn A/B/C/D cạnh nhau.
5. Bảng §5: tiêu chí 4 của C ghi O(n log n), §2 cách C ghi O(n) — chưa thống nhất.

## Chưa phân định được / giữ nguyên
- Mọi số đo thực nghiệm (12,9 %, 540 ms, bảng p2_compare/p1_compare, ablation): giữ; các số suy ra từ chúng (SE, %, N) đã khớp.
- Đáp án 4.3 ("SA lệch trái nhẹ") không tái lập được (mã p1_compare không có trong repo).
- Ý 1 §5 Bài 2 ("một bài NP-hard giải được thì tất cả giải được") chính xác chỉ cho NP-đầy đủ; để nguyên vì Bài 2 tuyên bố "mức trực giác". "10²⁰⁰" (P1, n=120) thật là 1,8×10¹⁹⁹ và "21 ngày" (n=40) thật là 20,4 — chấp nhận làm tròn.

## Phát hiện ngoài phạm vi
- **Bài 1 §1.3 và §9**: cùng khẳng định không nguồn "mô hình sai (reset vị trí mỗi ngày) làm mất ~5 % điểm" — cần hạ như đã làm ở Bài 3 §8.2.
- **Bài 1 §1.2**: "Bài 2 sẽ cho bạn thấy số lời giải có thể là khoảng 10¹⁸¹" cho 300 nhà × 31 ngày — Bài 2 chỉ tính 10¹⁸¹ cho P2 (5²⁶⁰); P3 lớn hơn nhiều (300! ≈ 10⁶¹⁴).
- **Bài 7 §5.2**: "Biểu diễn 'chuỗi phẳng' ở Bài 3 chính là route-first, cluster-second — và nó thắng trên P2 với +5,7 %" — +5,7 % là B so A (hai thủ tục dựng nghiệm), cùng lỗi mục 12.
- **"Tối đa 12 nhà/ngày"** còn ở: Bài 16 (§ cấu trúc dữ liệu, "tối đa 12 ngôi nhà"), Bài 17B (~"Với nghiệm 12 phần tử"), **Bài 23 §6.3** (12²·2¹² = 590 000 ≈ 0,6 ms → 11²·2¹¹ = 247 808 ≈ 0,25 ms), 2607/03 (§ 115 "720/60", §131 "26 byte").
- Bài 4 §5.2 "chậm hơn 30 %" vs Bài 22 "chiếm ~30 % thời gian chạy" (hai cách nói khác nhau: ~43 % hay 30 %) — nhỏ, để nguyên.

## Bài thực hành có thể đang trích lại chỗ vừa sửa (`backend/fastapi/webapp/courses/heuristic-practice-2/data/`)
- `bai-02-vi-sao-kho.js`: câu hỏi/đáp án BT 2.4 (~dòng 245–248: "tối đa 12 ngôi nhà", "n = 12", "144 × 4 096 = 589 824", "0,6 ms", "93 lần … 55 ms") → 11 nhà / 247 808 / 0,25 ms / 7,7 ms / 23 ms; dòng ~194 "matheuristic ở Bài 16" → Bài 23 §6.3. (BT 2.1d/2.2 trong tệp này đã dùng số đúng.)
- `bai-04-do-luong.js` (~dòng 246): "≈ 41 000 … phụ thuộc làm tròn 37" → 43 000 với Δ = 36,3; (~dòng 253): đáp án ablation 9,4 % / 8,6 %.
- `bai-03-bieu-dien-nghiem.js` (dòng 51 tóm tắt "+5,7 %", 171–181 đáp án 3.1–3.2): đã nhất quán, chỉ cần kiểm lại nếu đổi ý ③ ở mục 1.
- `kiem-tra-dau-vao.js`: "36 năm" cho 2⁶⁰ đúng, không cần sửa.
