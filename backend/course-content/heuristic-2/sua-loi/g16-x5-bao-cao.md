# Báo cáo g16 — cụm X5 (Bài 20, 20B, 21, 22, 23 + `tai-lieu/*` + mục dap-an 20–23)

Tệp vá: `sua-loi/g16-x5.json` — **45 bản vá** (Bài 20: 15 · Bài 21: 10 · Bài 22: 4 · Bài 23: 1 · dap-an: 2 · cheatsheet 4 · checklist 2 · mẫu nhật ký 3 · mẫu báo cáo 2 · tài liệu tham khảo 2 · Bài 20B và từ điển: 0). Mọi bản vá mang nhãn `[QUYẾT ĐỊNH]`/`[LOGIC]`/`[MÂU THUẪN]`/`[NHỎ]`.
`ap-dung-sua-loi.py --thu sua-loi/g16-x5.json` → **áp được 45 · lỗi 0** (chạy chung sau g14 + g15 cũng lỗi 0). **Chưa áp thật.**
Trang thực hành đã đồng bộ (Edit nhỏ nhất, không đổi id/số câu/đáp án/logic lab): `bai-20`, `bai-21`, `bai-22`, `bai-23`. `bai-20b`: không có chỗ nào phải đổi. `kiem.js --bai=bai-20…,bai-23` → **Đạt — 98 mục** (lab chạy qua bộ chấm đều xanh).

## Từng mục quyết định

| Mục | Kết quả |
|---|---|
| 1 An/Bình | Đã thi hành. "ba phiên bản" → "hai (greedy và SA)" ở mở đầu và bảng §1.1; bảng §1.4 ghi ≈ 1,5 giờ (30+60) và ≈ 1,6 giờ (15+80); câu "Bình gõ code ít hơn" → "tương đương … khác biệt ở thứ tự việc". |
| 2 §4.1 (30 vs 15 phút) | Đã thi hành: thêm câu nêu hai mức. |
| 3 §3.3 "miễn phí" | Đã thi hành ("không tốn điểm nào — miễn là ô đích trống và ≤ 720"); practice `l2` (mẫu + tiêu chí) đồng bộ. Thêm cùng điều kiện ở tóm tắt §8 của Bài 21. |
| 4 dap-an 20.1 | Đã thi hành (nêu "theo mã p2.h gốc; không có trong repo"). |
| 5a §6 "Định cỡ" | Đã thi hành: "Định cỡ (bước ②–③ của Bài 20)". Tiêu đề đổi nên `outline` dẫn xuất của bài cần sinh lại nếu dùng. |
| 5b mở đầu Bài 21 | Đã thi hành; số kiểm ở Bài 22 §1.1: khung ngày 31 +3,27 % > beam +3,15 %. **Mở rộng cùng lý do**: câu "hơn toàn bộ Phần 4 cộng lại" ở Bài 21 §1.1 và "lớn hơn mọi metaheuristic cộng lại" ở Bài 20 §1.3 (+ practice `bai-20` tomTat, q1) → so với beam (−2,43 %). |
| 5c dòng #3 | Đã thi hành (greedy ≈ 1 512 từ 2607/02 §1.4; lời giải cuối (32 915 840 − 1 434 274)/20 722 = 1 519,2). |
| 5d dap-an 21.2/21.3 | Đã thi hành, **tính lại bằng code**: LP Dantzig với 293 nhà chia đều 6 loại → 35 606 095 / 33 969 920 / 33 410 863 (+0,10/0,08/0,07 % so với 35 571 464 / 33 943 173 / 33 388 769); mô phỏng 300 thể hiện ≈ 35,61/33,97/33,41 triệu; E[nhà phân biệt] = 294,91, P(trùng nhà) = 2,95 % ≈ 29,5/1000 (bài đo 293 và 27). Ghi cách tính; 22.\*/23.\* vẫn là bài mở. |
| 6a "dư 2,4×" | Đã thi hành; ghi 528/461 ≈ 1,15 (điều phối viết 461/528 ≈ 1,15 — đúng là 528/461; 461/528 = 0,87). Practice `bai-22` đồng bộ "mảng hành động không tràn (461/528)". |
| 6b `waste` | Đã thi hành (chú thích dưới dòng log: 74,8 × 135 ≈ 10 100 phút dọn). |
| 6c σ ngoại lệ | Đã thi hành ở md và practice `bai-22` (tomTat + lời giải mẫu của câu về che khuất/quy trình xoá). |
| 7 dư địa → độ hở | Đã thi hành mọi chỗ có chữ "dư địa": Bài 20 (×6), Bài 21 (×5), mẫu nhật ký, mẫu báo cáo; thêm đổi tên mục từ điển (Độ hở = optimality gap, (cận trên − nghiệm)/nghiệm), "Khoảng cách" → "Độ hở" ở checklist, cheatsheet, mẫu báo cáo, Bài 23 §6.5. Bài 22 và Bài 20B không có chữ "dư địa". Practice `bai-20/21/23` đồng bộ (tên biến lab `duDia` giữ nguyên, chỉ đổi lời văn). τ: nhãn "cận tham chiếu (τ = 7)" thêm ở Bài 20 (§1.2, §7), Bài 21 §7.3, Bài 22 (biểu đồ), cheatsheet; practice `bai-20` q3/tomTat. |
| 8a checklist | Đã thi hành: ô tick "6 câu hỏi 18B — 30 phút" đặt trước "Chọn biểu diễn" (giai đoạn 2). |
| 8b nhật ký | **Chọn khác chữ của điều phối** (xem dưới). |
| 8c tham khảo | Đã thi hành: "từ những năm 2000"; thêm chú thích số chương chưa đối chiếu; `chapter-16` giữ. |
| 9 | Mốc 30 714 270 không đổi; Bài 20B, 23 chỉ áp định nghĩa chung (không có bản vá riêng cho 20B). |

## Chọn khác điều phối (+ lý do)

- **8b (mẫu nhật ký):** quyết định ghi "để Ví dụ 3 xảy ra **sau** Ví dụ 1". Theo số liệu thì ngược lại: lỗi `bestV = 0.0` (1 076 → 59 614) phải sửa **trước** thì chèn rẻ nhất mới ra 61 001 ở Ví dụ 1 (09-16). Đã đổi ngày Ví dụ 3 thành 2026-09-15, nối đúng thứ tự ("lần hiệu chuẩn ở Ví dụ 1 mới đưa lên 65 425") và ghi λ = 164 ≠ 142 là của từng lần thử. Không đổi số nào. Nếu điều phối thật sự muốn "sau", cần một câu chuyện khác (không bịa được).
- **Cheatsheet "T−45 phút: đóng băng" → "T−20 phút … (Bài 4B §7)":** hệ quả của quyết định X1 #9 (lịch tuyệt đối ở 4B §7). Nếu X1 chọn lịch khác thì sửa lại dòng này.
- **Cheatsheet `seed 1..300 HUAN LUYEN` → `1..600`:** g9 đã đổi Bài 20B sang 1..600, cheatsheet bị sót.

## Ngoài phạm vi (không vá)

- Còn chữ "dư địa" ở bài người khác: Bài 4B, Bài 12, Bài 18B, dap-an 18.3 (mục Bài 18), `2605/*`, `2607/03`, `2607/05`, `case-2609/*`, và 2607/03 §9 "dư 2,4×" (X6 #5). Bài 18 giữ hai khái niệm riêng.
- Lưu ý cho tác giả: độ hở theo cận **chứng minh được** (τ = 0, 35 571 464) so với v1 là **15,8 %** — sát/vượt mốc 15 % của bảng Bài 18 §6; kết luận "thiếu tìm kiếm" (5–15 %) ở Bài 20/21 dựa vào mức tham chiếu τ = 7 (đã gắn nhãn, không đổi kết luận).
- Từ điển (`tu-dien-thuat-ngu`) không có mục nào thuộc quyết định X5; không vá.
