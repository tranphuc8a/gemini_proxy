# Báo cáo g13 — tài liệu tra cứu (`tai-lieu/*`, 6 bài)

Tệp vá: `sua-loi/g13.json` — **19 bản vá**, đều `old` xuất hiện đúng một lần.
`ap-dung-sua-loi.py --thu sua-loi/g13.json` → `áp được 19 · đã áp từ trước 0 · lỗi 0`.

## 1. Số bản vá

| Nhãn | Số | Bài / mục |
|---|---:|---|
| [SỐ] | 4 | cheatsheet: bảng số test Bài 4, "−38 %" của chèn λ=0, beam "+4,7 %"; checklist: hàng "1 ngày (8 h)" cộng 485 phút |
| [LOGIC] | 5 | cheatsheet: E[max] của GRASP (Bài 8), "ρ ≈ λ" ×2 (Bài 16), "> 30 % → mô hình sai"; checklist: cùng ngưỡng |
| [MÂU THUẪN] | 2 | cheatsheet: "Ngân sách 100 ms ≈ 10⁷" vs Bài 2; bảng K=1 → 200 vs công thức có ln K |
| [NHỎ] | 3 | cheatsheet: Δt_bỏ ≤ 0 (Bài 17), tiêu đề cột "Cách cận trên", "ảo giác ≈" → "≲" |
| [THAM CHIẾU] | 5 | checklist: ghi chú đối ứng 7 giai đoạn ↔ 8 bước Bài 20; từ điển: "Hàm thay thế" (Bài 10 → 4B, 13), "Bài toán định hướng"/OP (→ 1, 2), TOP (21 → 2) |

Theo tệp: cheatsheet 12 · checklist 3 · từ điển 4 · mẫu nhật ký 0 · mẫu báo cáo 0 · tài liệu tham khảo 0.

## 2. Đã đối chiếu và KHÔNG sửa (khớp bài gốc)

- Cheatsheet: mọi công thức delta (Bài 10), bảng toán tử (Bài 11), 1 157 lần / 28,9×, SA (Bài 13), tabu (TT, mã), beam (W, B), ALNS (+10/+5/+1, 0,8/0,2, sàn 0,05, q 15–35 %), BHH (0,7124 / 0,92), 6 câu 18B, quy trình 20 phút 19B, bảng 20B (55×, 200×30→20×200→3×600→1×300), 8 bước và % (tổng 100), P3 v1…v6 (Δ bước tính lại đúng: +3,27 / −0,08 / +3,15 / +0,47 / +0,22), TSP, năng suất 4B (6,2 / 1,15 / 0,81 / 0,11 tính lại đúng), "greedy giá mờ 59 775" (= 59 774,9, Bài 4 §7.2).
- Checklist: các ngưỡng 18 §6, thứ tự thử Bài 20 §8.1, chốt an toàn Bài 20 §10.1, bảng "khi bị kẹt" (mọi dòng trỏ đúng bài), hàng 4 giờ (240) và 1 tuần (40 h).
- Mẫu nhật ký: số liệu 4 ví dụ khớp Bài 4 §8, Bài 11 §4, Bài 22 §8 (−22 %, −6,4 %, 6:1, −1,33 → −2,43 %, −60 dòng, ~30 % thời gian). Mẫu báo cáo: liên kết tới đề cương §6 (rubric) đúng, 5 tiêu chí Bài 3, ngưỡng 0,05 % khớp Bài 22 §10, "2–3 trang" khớp Bài 22 §10.
- Tài liệu tham khảo: tác giả / năm / tạp chí / tập của các bài báo ở §3–§4 và sách ở §2 khớp kiến thức của tôi và khớp mục "Đọc thêm" trong từng bài giảng và `2607/05` (không thấy chỗ nào sai chắc chắn). Liên kết `../../expe/2607/research/…` trỏ tới bài ca nghiên cứu có trong khoá; liên kết `../../metaheuristic/…` trỏ ra ngoài khoá (tệp nguồn của kho, không mở được trong web).

## 3. Mục đã biết (1–47)

Không mục nào giao riêng cho g13. Các mục chạm vào tài liệu tra cứu: #24 (ρ = λ → đã vá theo quyết định số 5), #30 (40 220 ↔ −38 % → đã vá phía cheatsheet), #40 (K=1 → chỉ thêm chú thích), #23 (ngưỡng — cheatsheet/checklist đã đúng chuẩn Bài 18 §6), #21 (cờ — cheatsheet/checklist đã đúng chuẩn Bài 19).

## 4. Cần tác giả quyết định

1. **Mẫu nhật ký, thứ tự ngày/số liệu:** "Ví dụ 1" (2026-09-16: chèn rẻ nhất 61 001 → 65 425 khi hạ λ 142 → 88) đã chạy được, nhưng "Ví dụ 3" (2026-09-17: chèn chỉ 1 076 → 59 614, "sau khi hiệu chuẩn λ: 65 425") kể lỗi xảy ra sau đó. Ngoài ra Ví dụ 3 dùng λ = 164 (trùng Bài 13 §4.2) còn Ví dụ 1 / Bài 4 §8.2 / Bài 6 dùng λ_LP = 142. Đề xuất: đổi ngày Ví dụ 3 sớm hơn Ví dụ 1 và bỏ câu "Sau khi hiệu chuẩn λ: 65 425" (hoặc nối 59 614 → 61 001), thống nhất một giá trị λ_LP. (Bài 4 §8.2 dùng chung Ví dụ 1.)
2. **Tài liệu tham khảo, `chapter-16`:** bảng ghi "chapter-16 = Hybrid / Matheuristics", Bài 17B (§Đọc thêm) ghi "Chương 15 — Ant Colony, Chương 16 — Evolutionary". Không có kho `gemini/metaheuristic` để kiểm. Bảng cũng không liệt kê `chapter-9` (GRASP) dù Bài 8 trích nó, và `chapter-2/3/4` (Bài 2, 18 trích).
3. **Tài liệu tham khảo, "TopCoder Marathon Match (từ 2006)":** theo trí nhớ của tôi Marathon Match có từ khoảng 2003; chưa đủ chắc để sửa — nên tra lại.
4. **Checklist giai đoạn 2** thiếu bước "6 câu hỏi cấu trúc hàm mục tiêu (Bài 18B), 30 phút" mà Bài 20 §4.1 đặt trong bước ② (cheatsheet có nêu riêng). Đề xuất thêm một ô tick vào giai đoạn 2.
5. **"Dư địa" / "khoảng cách":** mẫu nhật ký ghi "dư địa ___ %", checklist ghi "(cận trên − cơ sở)/cơ sở", Bài 18 §1.4 gọi 1 − LB/UB là "dư địa" (12,2 %) còn §2 gọi (UB−LB)/LB là "độ hở" (13,9 %). Nên chọn một định nghĩa duy nhất cho mẫu.

## 5. Chưa phân định được

- `arXiv:2512.16865` (Shen, Zhou, Lei & Wu 2025): không có mạng để kiểm; cùng thông tin xuất hiện nhất quán ở `2607/05`.
- Số đo thực nghiệm ở bảng "số liệu tham chiếu" (P1, P3, TSP) chỉ đối chiếu được với bài giảng, không tái lập được.

## 6. Phát hiện ngoài phạm vi (cheatsheet/checklist đang khớp một chỗ bài gốc nằm trong danh sách lỗi)

- **Bài 7 §2.3 (mục 31):** cheatsheet "điểm chèn = p − λΔt — bắt buộc dùng λ, không dùng tỉ số" và checklist giai đoạn 5 mục 3 "(bắt buộc dùng λ, không dùng tỉ số)". Không vá theo bản sai; cập nhật khi Bài 7 sửa.
- **Bài 8 (mục 33):** cheatsheet "GRASP trên greedy: −0,01 %. GRASP trên chèn: +7,58 %" và checklist "GRASP không cải thiện | heuristic nền còn yếu".
- **Bài 9/12 (mục 36, 42):** bảng TSP cheatsheet "phân tán cực trị cục bộ 1,277 / 1,158" (số phụ thuộc cách cài 2-opt).
- **Bài 14 (mục 44):** cheatsheet mã `tabuUntil = buoc + TT` / `> buoc` (cấm TT−1 bước), từ điển "Tabu tenure: số bước một nước đi bị cấm".
- **Bài 18/18B (mục 18, 19, 26):** cheatsheet "cận trên τ=7: 33 943 173" ở bảng P3 (τ=7 không phải cận chứng minh được) và "L∞ ❌" (chỉ đúng theo hai trục gốc).
- **Bài 20B (mục 40):** bảng K=1 → 200 và công thức ln K nằm trong chính Bài 20B §1.2; cheatsheet chỉ thêm chú thích, bài gốc vẫn cần sửa.
- **Bài 4B §1 ↔ Bài 20 §3.1 (mới, không có trong danh sách):** "di chuyển chết cuối ngày (−0,45 %)" xếp loại "mô hình hoá" ở Bài 4B nhưng là phát hiện từ "đọc mã grader" ở Bài 20 §3.1 → ảnh hưởng 6,2 vs 1,15 %/giờ ở cheatsheet (cheatsheet theo Bài 4B; nếu đổi loại: đọc mã = 3,53 %/1,5 giờ ≈ 2,35 %/giờ).
- **Bài 11 (mới):** §3.2 nói K = 5–20, tóm tắt (và cheatsheet) nói K = 8–16.
- **Bài 4 (mới):** tóm tắt "cải thiện 10 % → 30 test" không khớp bảng §3.3 ngay trên (8 test ở σ/x̄ = 10 %; 30 là mức tối thiểu thực dụng).
- **Kiểm tra đầu vào A2 (mục 2):** bảng "100 ms ~10⁷" cần cùng lời giải thích "ngân sách an toàn" như đã thêm vào cheatsheet.

## 7. Nội dung bài thực hành có thể trích lại chỗ vừa sửa

Không thấy tệp nào trong `heuristic-practice-2/data/` trích trực tiếp các tài liệu tra cứu. Từ khoá nên rà nếu muốn đồng bộ: `bai-08-grasp.js` ("√(2 ln N)", "E[max"), `bai-16-beam-search.js` ("ρ", "giá mờ"), `bai-06-gia-mo.js` / `bai-07-chen-gom-cum.js` ("40 220", "−38"), `bai-20b-tinh-chinh-tham-so.js` ("ln K", "200 test"), `bai-04-do-luong.js` ("800 test", "30 test").
