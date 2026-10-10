# Báo cáo nhóm g1 — Giới thiệu, Đề cương, Kiểm tra đầu vào, Cách học, Bản đồ kiến thức, Bài 1, Bài tập, Đáp án Bài 1

Tệp vá: `sua-loi/g1.json` — **44 bản vá**: MÂU THUẪN 13 · SỐ 12 · THAM CHIẾU 12 · NHỎ 4 · LOGIC 3 · MÃ 0.
Theo bài: 01-kiem-tra-dau-vao 5 · bai-01-mo-hinh-hoa 16 · dap-an (mục Bài 1) 4 · 02-cach-hoc 3 · 03-ban-do-kien-thuc 6 · 00-de-cuong 10 · gioi-thieu 0 · bai-tap 0 (đã đối chiếu, không thấy sai).
`ap-dung-sua-loi.py --thu sua-loi/g1.json` → **áp được 44 · lỗi 0**; chạy chung với g1…g12 → áp được 489 · lỗi 0 (không đè lên bản vá nhóm khác).

## Mục đã biết (1–7)
1. **Xác nhận.** Liệt kê 32 tập con: 14 hợp lệ, tối ưu {B,D,E} = 100; tham lam theo giá trị (A = 60) kém 40 %, không phải 33 %. Viết lại D1 liền mạch.
2. **Xác nhận.** Bảng A2 ghi 100 ms ≈ 10⁷ trong khi Bài 2 và B-1 dùng 10⁹/s; A3 "2²⁰ ≈ 10 ms" (đúng ~1 ms ở 10⁹/s) lệch với "2⁶⁰ → 36 năm" (1,15×10⁹ s / 3,156×10⁷ = 36,5 năm). Giữ số cũ làm cột "an toàn", thêm cột trần lý thuyết (theo Bài 2) + giải thích hệ số ~10; A3 nêu 1–20 ms. (Đáp án 2.2 "10⁷ cho 100 ms" thuộc nhóm Bài 2.)
3. **Xác nhận, mở rộng.** {B,C}→{B,D,E} đổi 3 ô, không phải 2: chạy lại mọi nghiệm, lân cận "đổi ≤ 2 ô" còn cực trị cục bộ {A}=60, {B,C}, {B,D,E}; "≤ 3 ô" chỉ còn {B,D,E}; "thêm/bớt 1 món" có 4 cực trị ({A} cũng kẹt — bài không khẳng định chỉ có 2 nên không sửa). Sửa nhãn lân cận ở §5.3, BT 1.2, bổ sung đáp án 1.2. Tiêu đề §3.4(c) "đổi một món" → "thêm hoặc bớt một món".
4. **Xác nhận.** Phản ví dụ w=100, p=100, W=99, M=1,1 (> max p/w = 1) cho 98,9 > 0. Với cân nặng nguyên M > max pᵢ là đủ (kiểm bằng code trên 5 món: M=7 → tối ưu mở rộng vượt cân; M≥10 và 61 → hợp lệ).
5. **Xác nhận cả ba** (§4.4c → §3.4c; "ví dụ 5 món ở §4" → §3; "ba lớp ở §3.2" → §4.3) + thêm "ví dụ §4" ở §5.3.
6. **Xác nhận.** Đoạn mã §7.2 không có kiểm đơn lặp/`continue`; sửa BT 1.5 theo đoạn mã. Đáp án 1.5 bổ sung "đổi S, C hay f?" (S, C giữ nguyên, đổi f). Không có `p1.h` trong repo để đối chiếu.
7. **Xác nhận.** 10¹⁸¹ = 5²⁶⁰ là của P2 (260 đơn × 5 ngày); 300 nhà × 31 ngày: 32³⁰⁰ ≈ 10⁴⁵¹, 300! ≈ 10⁶¹⁴. Sửa để nêu đúng nguồn.

## Lỗi mới tự tìm ra
- Bài 1 §3.3: hứa "liệt kê hết 32 tập", "tổng cân nặng giảm dần" nhưng bảng chỉ 8 dòng, không theo thứ tự; 9 tập hợp lệ vắng mặt đều ≤ 80 điểm (đã nêu).
- §3.4(b)/§12 "biết chắc chưa tối ưu" quá mức (trường hợp (ii)); hạ xuống "gần như chắc chắn".
- Bài 1 §6.3 "(dùng ở Bài 13, 17)" sai: hai bài đó không dùng mẹo phạt (Bài 13 §4.2 còn nói SA dùng hàm tiền); đổi sang Bài 6 §8.1. §8.4 "Bài 2 sẽ cho thấy tỉ số hỏng" sai: Bài 2 không nói greedy; đổi sang Bài 5 §4.3, §6.1.
- Đáp án 1.1 (lớp nào, ngân sách bão hoà) và 1.3 (nửa sau "bị huỷ") bỏ ngỏ → bổ sung ngắn.
- Kiểm tra đầu vào B1 và Bản đồ §3: nói heap dùng ở Bài 7/16; cả khoá không có heap (Bài 16 §5, Bài 19 §3.2 chọn top-K bằng chèn vào mảng đã sắp xếp). Sửa cả hai.
- Đề cương: thiếu Bài 17B (đếm mở rộng chỉ 4/5; tiêu đề Phần 4 lệch Giới thiệu); sơ đồ thiếu 4B, 17B và xếp 19B/20B trước 19/20; bảng bài toán xuyên suốt ghi P1 "Bài 3" (Bài 1 §7 mô hình hoá P1; chính Đề cương tuần 1 cũng vậy) và P2 "Bài 9" (Bài 3 có lab p2 + bài tập P2); mô tả Bài 22 gán sai v2/v3/v5 (chuẩn Bài 22: v2 khung ngày 31, v3 giá mờ + phạt thời gian chết, v5 di chuyển chết); mô tả Bài 18 và S6 nói "cận tổ hợp / bound tổ hợp", BHH như một loại cận (Bài 18: ba kỹ thuật nới lỏng; BHH chỉ là ước lượng; cận dưới là nghiệm đối chứng) — đã đồng bộ.
- Cách học §6/§7 và Bản đồ §4: "80 % từ Phần 2–3", "70 % cho Bài 5–6", bảng 35/35/15/15 "đo ở Bài 22" — Bài 22 không có phân rã này. Tính lại từ ablation Bài 22 §8.1 + phân loại Bài 4B §1 (tổng 8,72): 35,3 % đọc mã grader / 33,0 % mô hình hoá + giá mờ / 27,9 % beam / 3,8 % tinh chỉnh / local search 0 %; "gần 70 % ở Phần 1–2" (68,3 %). Đã sửa và ghi rõ nguồn + cảnh báo ablation chồng lấn. Bản đồ ④ "5 %" → "+2,43 %" (đồng bộ g3). Lộ trình rút gọn bỏ sót Bài 7 → thêm vào "rất nên".
- Bài 1 §1.3/§9 "~5 %" (mô hình sai): không có nguồn (đồng bộ cách xử lý của g2 ở Bài 3) → bỏ số; nêu con số gần nhất có nguồn (bỏ phí khung ngày 31 = −3,08 %, Bài 22 §8.1).

## Cần tác giả quyết định (không sửa)
1. **Số giờ.** Giới thiệu/Đề cương: 2+10+12+12+16+8+12 = 72 h. Cộng từ tiêu đề các bài: lõi 10/12/**11**/**14**/8/**11** = 66 h (+2 h Phần 0 = 68); bài mở rộng 13 h khớp "+13 h". Bảng tuần 11×6 + 12 = **78** h, trong khi "học đều 6 h/tuần → 12 tuần" ngụ ý tuần 12 = 6 h. Cần quyết định "72 h" có gồm lab/đồ án không rồi chỉnh số.
2. Rubric "xuất sắc" ghi build sạch `-Wall -Wextra`; Bài 19 (M5, §8) chuẩn `-Wall -Wextra -Wshadow -Wconversion`.
3. Giới thiệu "Nguyên tắc 1" và Đề cương §9.1 ("không có con số nào là ước lượng") quá mức: Bài 2 chủ ý dùng ước lượng bậc độ lớn.
4. Cách học §4.2 quy ước "tên biến tiếng Anh" nhưng mã trong bài dùng tên không dấu tiếng Việt (`chiPhi`, `viTri`…); §3 liệt kê `common/` thiếu `stats.h` (Bài 4 dùng).
5. Bài 7 xếp "rất nên" là đề xuất của tôi.
6. Đáp án 1.5 "điểm greedy thường tăng nhẹ; local search khó hơn" — không kiểm được (thiếu `p1.h`). Nếu `p1.h` thật có `continue` cho đơn lặp, thêm lại vào đoạn trích §7.2.

## Chưa phân định được
- Tỉ trọng 35/33/28/4 phụ thuộc cách phân loại (ranh giới "mô hình hoá" và "giá mờ" ở Bài 4B §1) và các dòng ablation chồng lấn (Bài 22 §8.3) — chỉ định hướng.
- "Mô hình sai ~5 %": không có số đo nào; cần tác giả nếu có nguồn.

## Phát hiện ngoài phạm vi
- **Bài 21 §6.3**: "| 1 | **Triệt tiêu thời gian chết** | mỗi phút chết mất ~1 450 điểm, **không phải 200** | **+4…6 %** |" — ước tính trước khi đo, trong khi ablation số hạng phạt chỉ +2,43 % (Bài 22 §8.1); nên ghi rõ "ước tính" hoặc đối chiếu số đo.
- Ghi chú điều phối: "một ngày tối đa 12 nhà" (Bài 2 BT 2.4, đáp án 2.4, ca 2607) thực là 11 — không có trong các bài của g1.

## Bài thực hành cần đồng bộ (`backend/fastapi/webapp/courses/heuristic-practice-2/data/`)
- `kiem-tra-dau-vao.js` dòng ~60 (giaiThich câu heap: "heap chọn ứng viên tốt nhất ở heuristic chèn (Bài 7) và giữ top-K… Beam Search (Bài 16)"); dòng 9, 35 (bảng "An toàn: 100 ms ≈ 10⁷…") vẫn khớp cột "an toàn", có thể thêm cột trần lý thuyết 10⁸/10⁹/10¹⁰. D1 và A3 ("cỡ ms") đã đúng.
- `bai-01-mo-hinh-hoa.js`: §5.3 (dòng ~130, câu q9 ~223–232, lab N_d d=1,2,3) đã nhất quán với nhãn "đổi tối đa 3 món"; kiểm không có câu hỏi nào dùng ngưỡng M > max p/w.
