# Báo cáo rà soát nhóm g6 — Bài 13, 14, 15 (+ đáp án 13–15)

Tệp vá: `sua-loi/g6.json` — **27 bản vá**: `[LOGIC]` 10 · `[MÂU THUẪN]` 10 · `[SỐ]` 5 · `[NHỎ]` 2.
Theo bài: Bài 13 = 6 · Bài 14 = 9 · Bài 15 = 10 (gồm đề 15.1) · đáp án (15.1) = 2.
Kết quả `ap-dung-sua-loi.py --thu sua-loi/g6.json`: **áp được 27 · đã áp từ trước 0 · lỗi 0**.
Đã tính lại: bảng Metropolis, T₀/T_end, lịch hạ nhiệt, mọi con số §5 của Bài 13, đáp án 13.1; mô phỏng ví dụ tabu §4 (Python, đúng quy ước mã §3.2); số phép/thời gian §5.1; các % ở §5 Bài 15; thí nghiệm ILS (C++, n = 100) cho mục 45.

## Mục đã biết

- **43 — xác nhận.** T_k = 4000·(1/4000)^(k/60000): T(6000) = 1745,2, T(12000) = 761,5, T(60000) = 1,0. Bản gốc 2500/1560 (cùng tỉ lệ 0,625) dẫn tới T_end ≈ 36,4 chứ không phải 1,0. Sửa hai dòng giữa (giữ f và tỉ lệ chấp nhận), nêu tham số nhật ký mẫu. Số bước SA trong 16 ms: Bài 13 nhất quán 60 000 ở ba chỗ (§5.2 bảng tuyến tính, §7, §9) ⇒ sửa Bài 14 (§5.1 hai chỗ, bảng, tóm tắt, "gấp 100 lần" → "khoảng 60 lần").
- **44 — xác nhận cả ba ý.** (1) Bước 2: tốt nhất là swap(2,4)=55, swap(1,2)=60 không phải nước tốt nhất; cái bẫy xảy ra ở **bước 3** (50 bị cấm, chọn 57) ⇒ chuyển lời giải thích sang bước 3. (2) Off-by-one: `tabuUntil = buoc + TT` + `biCam: > buoc` chỉ chặn TT−1 bước (TT=1 không chặn gì); bảng ví dụ khớp quy ước của mã ⇒ giữ mã và bảng, ghi rõ quy ước ở §3.2 và từ điển. (3) §5.1: 1,68 triệu lần đánh giá ≈ 2 ms chỉ đúng nếu mỗi lần = 1 phép đơn giản; bảng cùng mục, đáp án 14.3 (~15 ms) và "ít bước hơn 100 lần" đều ủng hộ 16 ms ⇒ giữ 16 ms, sửa phép quy đổi (≈10 phép/lần × 1,7·10⁶ = 1,7·10⁷ phép ≈ 17 ms, chuẩn 10⁹/s của Bài 2).
- **45 — xác nhận một phần, đã hạ khẳng định.** Thí nghiệm (TSP n=100, ILS 300 vòng, 10 bộ phân bố đều + 10 bộ gom cụm; "hoàn tác" = nghiệm sau local search trùng đúng tập cạnh với nghiệm trước nhiễu loạn):
  - Tỉ lệ vòng bị hoàn tác (đều / cụm), đảo đoạn vs double-bridge 4 cạnh (A D C B): 2-opt gặp-là-đổi 38 %/42 % vs 3,7 %/4,6 %; 2-opt + Or-opt 70 %/73 % vs 27 %/27,5 %; 2-opt chọn nước tốt nhất 99,9 %/99,8 % vs 96,7 %/97,6 %.
  - Độ dài cuối (tỉ số so với tốt nhất tìm được): gặp-là-đổi 1,0103 vs 1,0078 (đều), 1,0014 vs 1,0033 (cụm); 2-opt+Or-opt 1,0023 vs 1,0000, 1,0000 vs 1,0001 ⇒ chênh < 0,3 %, đảo đoạn còn nhỉnh hơn trên dữ liệu cụm; best-improvement cả hai kém (1,0447/1,0269 đều; 1,0126/1,0071 cụm).
  - Đúng: một nước 2-opt hoàn tác được đảo đoạn (30/30); **không** nước 2-opt (0/30) hay Or-opt L≤3 (0/30) đơn lẻ nào hoàn tác được double-bridge 4 cạnh. Sai: "local search buộc phải chấp nhận cấu hình mới / đảm bảo thoát lưu vực / đảo đoạn KHÔNG dùng được" — chuỗi nhiều nước cải thiện vẫn đưa về đúng cực trị cũ, và chất lượng cuối gần như không khác. Đã hạ ở §2.7, tóm tắt, đề 15.1, đáp án 15.1 (đáp án gốc còn thiếu "cách kiểm chứng bằng thực nghiệm" mà đề yêu cầu — đã bổ sung).
  - Sơ đồ "P1 ─ P3 ─ P2 ─ P4" chỉ đổi **3 cạnh** (A C B D), mâu thuẫn "4-opt"; mã `doubleBridge` Bài 12 ghép A+D+C+B = P1 ─ P4 ─ P3 ─ P2 (4 cạnh) ⇒ sửa sơ đồ.
  - **§6 vs §3.3 — xác nhận.** Ví dụ §6 dùng bộ của `leoDoi` (Bài 9 §5.2: 2-opt, Or-opt L=1, chèn, exchange), khác §3.3 và BT 15.3 ⇒ thêm ghi chú nêu rõ, không đổi ví dụ.
- **Nhắn từ g5 (3 ý) — đã xử lý.** (1) Sơ đồ §2.7 đã đồng bộ theo mã (P1 ─ P4 ─ P3 ─ P2, 4 cạnh; đo trực tiếp: A D C B đổi 4 cạnh, A C B D đổi 3) và hạ "không bị hoàn tác" như Bài 12 §7.1 (thí nghiệm của g6 cho 4–5 % → 97 % vòng bị hoàn tác tuỳ cách cài local search, cùng chiều với 3–39/1000 của g5). (2) §3.3 "N₅ … cái duy nhất đổi TẬP": xác nhận (Bài 9 §3.2 có Chèn/Bỏ; ví dụ §6 của chính Bài 15 chèn đơn E) ⇒ vá giới hạn trong "danh sách này", nói rõ chèn/bỏ cũng đổi tập. (3) §2.3 "Bài 12 đo được khởi tạo tốt thắng 20 lần ngẫu nhiên": tự chạy lại (TSP phân bố đều, 10 bộ/cỡ, 2-opt hội tụ): n=100 cái tốt nhất trong 20 lần ngẫu nhiên **tốt hơn** NN+2-opt 3,3 % (gặp-là-đổi) / 2,0 % (chọn nước tốt nhất), NN chỉ thắng 2/10 và 1/10 bộ; n=200: −0,4 % / +0,6 %, NN thắng 4/10 và 7/10 ⇒ không đúng chung; hạ "đo được" → "báo cáo", nêu điều kiện. **Bài 12 (§6.2, tóm tắt) còn nguyên khẳng định này — g5/g4 nên đồng bộ.**
- **Nhắn từ g7 (`chance(0.03)` §2.4 vs `0.02` §2.6): không sửa.** Hai ví dụ độc lập (§2.4 là đoạn minh hoạ tiêu chí, §2.6 là cài đặt TSP cụ thể, văn bản §2.6 cũng nói "nước 2 %"), cả hai nằm trong khoảng 2–5 % ở bảng và tóm tắt; không có chỗ nào nói chúng là cùng một cấu hình.

## Lỗi mới tự tìm ra
Bài 13: §2.2 ô T=10 ghi 10⁻⁴⁴ (đúng 3,7·10⁻⁴⁴); "đường cong bốn cột" nhưng có 5 cột; §9 "tụt 35 %" (đúng 35,56 % ≈ 36 %); §8 cạm bẫy 2 "không đổi kết quả" nói quá (cắt ở 3T bỏ đuôi xác suất < 5 %). Bài 15: §2.3 dựa vào số đo Bài 12 không tái lập (xem nhắn g5 ở trên); §3.3 "duy nhất đổi TẬP" mâu thuẫn với §6; ví dụ §6 nhận nước k=2 "không tăng điểm" trong khi khung §3.2 chỉ nhận khi f(y) > f(x) ⇒ thêm điều kiện ngầm (f tính thời gian / `leoDoi`); đề 15.1 coi "đảo đoạn thì không (tốt)" là tiền đề ⇒ hạ.

## Cần tác giả quyết định (không sửa)
1. **Bài 13 §5.2 + đáp án 13.4:** "lợi ích tăng theo log, không bão hoà / gần tuyến tính". Từ chính bảng: +1029 (10k→60k), +471 (→300k), +300 (→1M) ⇒ ≈1319, 673, 577 điểm mỗi bậc 10 — độ dốc giảm một nửa. Đề xuất: "tăng chậm dần, xấp xỉ theo log; chưa thấy bão hoà tới 10⁶ bước".
2. **Bài 13 §4.1 vs §4.2:** nước "Đảo" "đánh giá qua λ" trong khi §4.2 nói hàm mục tiêu của SA là tiền thuần (Δ=0 cho 2-opt). Cần nói rõ hàm dùng cho từng loại nước.
3. **Bài 13:** T_end=1 (lấy theo dòng cuối) so với công thức hiệu chuẩn T_end=|Δ|min/ln 1000 (⇒ |Δ|min≈6,9); λ=164 ở §4.2 so với Bài 9 "80–100", Bài 6 "120", Bài 4 "142→88" (chắc là các phiên bản lab khác nhau).
4. **Bài 14 §3.3:** "vừa (√n đến n/10)" bị ngược với n < 100; mã reactive `(int)(TT*1.2)` không tăng được khi TT ≤ 4.

## Chưa phân định được
Tỉ lệ chấp nhận 0,42/0,21 ở nhật ký mẫu §7 (giữ nguyên, là số mẫu); độ dài tuyệt đối "~16 ms/1 000 bước Tabu" và "16 ms/60 000 bước SA" (số đo, mã không có trong repo).

## Phát hiện ngoài phạm vi
- **Bài 12 §6.2/tóm tắt:** "khởi tạo tốt thắng 20 lần ngẫu nhiên" (14 656 vs 18 980) không tái lập (xem trên).
- **Bài 12 §7.1:** g5 đã vá sơ đồ và câu "đảm bảo thoát lưu vực"; còn dòng tóm tắt cuối Bài 12 "double-bridge = nước 4-opt mà 2-opt/Or-opt KHÔNG hoàn tác được" — nên thêm "đơn lẻ / một nước" cho khớp.
- **Bài 4 (bảng §7.2):** `simulated anneal … sem= 337.4 20.96ms`, `ALNS … 14.89ms`, trong khi Bài 13 §5 cùng điểm/sem ghi 15.96 ms / 10.47 ms — hai lần chạy khác nhau hay gõ nhầm?
- `tai-lieu/cheatsheet` (dòng ~179–181, mẫu `tabuUntil > buoc`/`buoc + TT`) và `tai-lieu/tu-dien-thuat-ngu` ("Tabu tenure — Số bước một nước đi bị cấm"): cùng quy ước TT−1 như Bài 14 §3.2.

## Bài thực hành có thể đang trích lại (`backend/fastapi/webapp/courses/heuristic-practice-2/data/`)
- `bai-14-tabu-search.js`: "cỡ 10⁵ so với 10³ bước trong cùng 16 ms" (khoảng dòng 191, 233) → ~6·10⁴.
- `bai-15-ils-vns.js`: "duy nhất đổi TẬP" (dòng ~160, 224); "P1–P3–P2–P4" + "4-opt" (dòng ~188, 191), hàm `doubleBridge` (dòng ~406, 473: `slice(0,a)+slice(b,c)+slice(a,b)+slice(c)` = A C B D, chỉ 3 cạnh), "Local search buộc phải chấp nhận cấu hình mới" (dòng ~188), đề 15.1 "là nhiễu loạn tốt … thì không" (dòng ~186), "ngay bước đầu nó nhận ra… đảo lại" (dòng ~188), bộ lân cận N₃/N₄ (dòng ~222).
- `bai-13-simulated-annealing.js`: không thấy trích nhật ký T=2500/1560; không cần đồng bộ.
- Mã thí nghiệm mục 45 nằm ở scratchpad `g6/ils.cpp` (tạm, không vào repo).
