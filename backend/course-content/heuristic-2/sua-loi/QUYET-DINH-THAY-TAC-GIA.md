# Quyết định thay tác giả (10/10/2026) — danh sách thi hành

Chủ dự án đã uỷ quyền cho người điều phối chốt các mục "Cần tác giả quyết định" (`../../../../tasks/2610/261010/heuristic-thuc-hanh/sua-bai-giang.md`). Tệp này ghi **quyết định đã chốt**; mỗi tác tử thi hành đúng cụm của mình.

## Nguyên tắc chung (bắt buộc)

1. **Số suy ra được (cộng, %, đếm, công thức)** → tính lại bằng code rồi sửa. **Số đo thực nghiệm không tái lập được** (mã C++ gốc không có trong repo) → **không đổi số**, chỉ thêm câu nêu cơ sở / hạ mức khẳng định. **Không bịa số, nguồn, trích dẫn.**
2. Bản vá nhỏ nhất đủ làm cho đúng; giữ giọng văn, cấu trúc, TeX, bảng, hộp `> 📌/⚠️`. Chỗ có số xuất hiện nhiều nơi (mở đầu, thân, tóm tắt, bảng thuật ngữ, đáp án) → sửa mọi nơi trong **các bài bạn sở hữu**.
3. Mỗi bản vá một `ly_do` bắt đầu bằng nhãn `[SỐ]/[LOGIC]/[MÂU THUẪN]/[THAM CHIẾU]/[MÃ]/[NHỎ]/[QUYẾT ĐỊNH]` + bằng chứng/quyết định. Nhãn `[QUYẾT ĐỊNH]` dùng khi bản vá thi hành một quyết định ở dưới.
4. **Quyền sở hữu:** chỉ vá các bài (slug) được giao. `khoa-hoc/dap-an` chia theo mục `## Bài N` — chỉ vá mục của bài bạn (cụ thể ở cụm). Chỗ ngoài cụm → ghi báo cáo "Ngoài phạm vi", đừng vá.
5. **Quy trình mỗi tác tử:**
   a. Đọc cụm của bạn ở dưới + (các) mục liên quan trong `sua-loi/g*-bao-cao.md` (chi tiết vấn đề, bằng chứng).
   b. Đọc bài giảng ĐÃ VÁ (bản hiện tại) ở `C:\Users\TRANPH~1\AppData\Local\Temp\claude\c--Users-tranphuc8a-Desktop-gemini-proxy\ecb3004f-40aa-49db-8dd3-b13dda001252\scratchpad\md2\` (slug đổi `/` thành `__`; chỉ đọc). `old` của bản vá phải khớp **nguyên văn** bản này (đúng một lần trong bài; các bản vá cùng bài áp tuần tự).
   c. Viết **một tệp vá** `backend/course-content/heuristic-2/sua-loi/g16-<mã cụm>.json` (định dạng `[{bai, old, new, ly_do}]`; Write tool; TeX trong JSON phải thoát `\\`). Kiểm: `cd backend/course-content/heuristic-2 && PYTHONUTF8=1 python ap-dung-sua-loi.py --thu sua-loi/g16-<mã cụm>.json` → lỗi 0. **KHÔNG chạy lệnh áp thật** (không `--thu` bị cấm): người điều phối áp sau để tránh ghi đè đồng thời lên bundle.
   d. **Đồng bộ trang thực hành** `backend/fastapi/webapp/courses/heuristic-practice-2/data/<id>.js` của các bài bạn vừa đổi (tomTat, trắc nghiệm, tự luận, `de` lab): sửa chỗ nhắc lại nội dung cũ cho khớp bản vá mới (Edit nhỏ nhất; KHÔNG TeX trong data; không đổi id/số câu/đáp án đúng trừ khi bài giảng đổi; không đổi logic lab trừ khi cụm nói rõ). Chạy `cd C:\Users\tranphuc8a\Desktop\gemini_proxy && node backend/fastapi/webapp/courses/heuristic-practice-2/kiem.js --bai=<id,id…>` phải xanh.
   e. Viết báo cáo ngắn `sua-loi/g16-<mã cụm>-bao-cao.md` (tiếng Việt, ≤ 1 trang): mỗi mục quyết định → đã thi hành thế nào (bản vá số mấy) / không thi hành được và vì sao / chỗ bạn chọn khác điều phối (+ lý do) / ngoài phạm vi.
6. Cấm: sửa bundle, `data/dem.js`, `data/khoa.js`, mã app, bài giảng ngoài cụm, tệp vá cũ; chạy git; ghi database; in khoá API; cài thư viện. Windows/Git Bash: heredoc làm mất `\` → dùng Write/Edit hoặc chuỗi raw Python; UTF-8 (`PYTHONUTF8=1`). Tiếng Việt có dấu.
7. Nếu khi đọc ngữ cảnh thấy quyết định dưới đây **không hợp** (vd bài đã nói khác, số thực ra sai chiều), chọn phương án nhỏ nhất đúng và ghi lý do trong báo cáo — đừng áp máy móc.

## Định nghĩa dùng chung giữa các cụm

- **"Độ hở"** := (cận trên − cơ sở) / cơ sở; đây là đại lượng mà ngưỡng hành động ở **Bài 18 §6** dùng. **"Dư địa"** trong Bài 20/21/23/22, checklist, mẫu nhật ký, 2605/2607 khi chỉ phần trăm còn lại tới cận trên → đổi thành "độ hở" (hoặc "độ hở tới cận trên"). Bài 18 giữ nguyên hai khái niệm riêng của nó (§1.4 "dư địa" = 1 − LB/UB; §2 "độ hở" = (UB−LB)/LB) — không đụng.
- **Mốc greedy P3 của Bài 20** = **30 714 270** (v1); v2 (greedy 31 ngày) = 31 718 184. Đã áp; đừng hoàn tác.
- **Cận τ:** chỉ τ = 0 (92,5 %) là cận chứng minh được; τ = 7, 9,5 là "mức tham chiếu".
- Ablation chuẩn (Bài 22 §8.1): ngày 31 −3,08 %; beam −2,43 %; phạt thời gian chết −2,43 %; di chuyển chết −0,45 %; multi-start −0,22 %; ρ −0,10 %; σ −0,01 %.

---

## Cụm X1 — nhập môn + Bài 3 + 4B + 19B + ca 2609 (mã `x1`)

**Bài sở hữu:** `khoa-hoc/gioi-thieu`, `khoa-hoc/00-de-cuong`, `khoa-hoc/02-cach-hoc`, `khoa-hoc/03-ban-do-kien-thuc`, `khoa-hoc/bai-03-bieu-dien-nghiem`, `khoa-hoc/bai-04b-phan-bo-cong-suc`, `khoa-hoc/bai-19b-go-loi-heuristic`, mọi `case-2609/*`. **dap-an:** mục Bài 3.
**Trang thực hành:** `bai-03-bieu-dien-nghiem`, `bai-04b-phan-bo-cong-suc`, `bai-19b-go-loi-heuristic`, `ca-2609`.

1. **Số giờ khoá (g1 #1):** tổng giờ ghi ở Giới thiệu/Đề cương/Cách học/Bản đồ phải **bằng tổng giờ ghi ở tiêu đề các bài** (lõi 10/12/11/14/8/11 = 66 h + 2 h Phần 0; bài mở rộng ghi riêng) và **bảng tuần phải cộng khớp** (hiện 11×6+12 = 78 h so với "6 h/tuần × 12 tuần"). Chỉnh các số **tổng** và bảng tuần (không chỉnh giờ từng bài); nêu rõ cách tính (lõi / +Phần 0 / +mở rộng). Nếu không khớp bằng một cách chỉnh đơn giản → nêu cả hai số ("≈ X h lõi, ≈ Y h nếu làm cả bài mở rộng") thay vì ép.
2. **Rubric "xuất sắc"** (Đề cương/Cách học) ghi `-Wall -Wextra` → `-Wall -Wextra -Wshadow -Wconversion` (chuẩn của Bài 19 §8).
3. **"Không có con số nào là ước lượng"** (Giới thiệu, Đề cương §9.1) → "Mọi con số là số đo hoặc tính được từ số đo; chỗ nào là ước lượng (Bài 2) đều được nói rõ là ước lượng."
4. **Cách học §4.2** quy ước "tên biến tiếng Anh" trong khi mã bài dùng tiếng Việt không dấu: sửa quy ước cho khớp thực tế ("mã trong bài dùng tên tiếng Việt không dấu cho ví dụ; bạn có thể dùng tiếng Anh, miễn nhất quán"). **§3** liệt kê `common/` thiếu `stats.h` → thêm.
5. **Bài 3 §5 bảng:** tiêu chí 4 của C ghi `O(n log n)` còn §2 mô tả C là `O(n)` → đọc cả hai, thống nhất theo cái đúng với cách C được mô tả ở §2 (nếu §2 có sắp xếp thì `O(n log n)`; nếu không thì `O(n)`).
6. **Bài 3 §8.2:** giữ nguyên điều kiện `soNgayDaSang + 1 >= SO_NGAY_TOI_DA`; chỉ thêm chú thích trong mã/văn: ở mã thật (Bài 22/19) hằng là `MAX_NEXTDAY = SO_NGAY_TOI_DA − 1` (số lần sang ngày) và so sánh `>=` — hai cách viết tương đương.
7. **Đáp án 3.1 (chọn ③ địa phương):** giữ nguyên. **Bài 3 §7.1 (43 vs 75):** giữ (đã nêu chi phí giả định).
8. **Bài 4B §2 "Hỏi 6 câu" Δ = 30 % (EV 9,0):** gắn nhãn rõ đây là **giả định minh hoạ**; thêm số đo thật của ca 2609 (≈ +6,67 %, kèm ≈ 17 % do gỡ lỗi TLE — đọc 2609 để chép đúng); sửa §2.1 "đứng đầu" thành "đứng đầu **với các giả định này**; số đo 2609 cho Δ nhỏ hơn nhiều nên thứ hạng thực tế đổi theo điểm xuất phát — quy tắc dùng EV mới là điều cần nhớ". Giữ cấu trúc bảng EV.
9. **Lịch Bài 4B §6 ↔ §7 ↔ Bài 19B §7:** thống nhất theo **lịch tuyệt đối ở 4B §7** (chẩn đoán 190–205, đóng băng 220–240 trong đề 240 phút = đóng băng ≈ T−20, chẩn đoán ≈ T−50…T−35). Sửa 4B §6 (T−45/T−15) và 19B §7 ("20 phút") cho khớp; đọc kỹ 3 chỗ + bảng §2 (bộ chấm 1,0 giờ…) trước khi sửa, sửa ít nhất có thể.
10. **19B §2.3 "ba chỗ bắt được ~90 % bug":** → "phần lớn bug" (không nguồn cho 90 %). **19B §5:** thêm một câu nêu "xấu nhất 3 331 ms (200 test) và 7 183 ms (3 000 seed, 2609/02 §4.1) là hai mẫu khác nhau".
11. **`-O2` của `int move()` thiếu `return` (19B §6/§8, 2609/02 B1, 2609 tổng quan):** giữ "chạy êm, 0 nước đi, điểm 7 369" như **số đo của bản dựng gốc** nhưng thêm: "hành vi là *hành vi không xác định*: tuỳ trình biên dịch/phiên bản — mã tối thiểu với g++ 14 cho `-O0` ra Illegal instruction, `-O2` ra Segmentation fault". Đồng bộ ca-2609 `q10`, tomTat.
12. **2609/03 §2.4** "kim cương kém đĩa tròn 1,4 %": nói rõ đó là **κ** (điểm kém 3,6 %/6,4 % — đọc bài chép đúng). **§3.3 Gale–Ryser:** thêm "(chỉ khi (R, c) thoả điều kiện — xem §6.1)".

## Cụm X2 — Bài 6–12 (mã `x2`)

**Bài sở hữu:** `khoa-hoc/bai-06-gia-mo`, `bai-07-chen-gom-cum`, `bai-08-grasp`, `bai-09-lan-can-leo-doi`, `bai-10-delta-evaluation`, `bai-11-toan-tu-kinh-dien`, `bai-12-cuc-tri-cuc-bo`. **dap-an:** mục Bài 6, 7, 8, 9, 10, 11, 12.
**Trang thực hành:** `bai-06-gia-mo`, `bai-07-chen-gom-cum`, `bai-08-grasp`, `bai-09-lan-can-leo-doi`, `bai-10-delta-evaluation`, `bai-11-toan-tu-kinh-dien`, `bai-12-cuc-tri-cuc-bo`.

1. **"20 lần 2-opt từ điểm ngẫu nhiên: 18 980 / 24 240 / 20 723 so với 14 656; phân tán 1,277; 99 500 nước"** (Bài 9 §7.2–7.5, Bài 12 §1/§6.1–6.2/§10, đáp án 9.x/12.1/12.2; Bài 15 do cụm X3): **giữ số đo** nhưng (a) thêm một câu nêu cơ sở ở chỗ số xuất hiện đầu tiên mỗi bài: "đây là số đo từ mã gốc (không còn trong repo); dựng lại độc lập bằng 2-opt quét tới hội tụ trên bộ sinh Manhattan cho độ phân tán nhỏ hơn (tệ nhất/tốt nhất ≈ 1,07–1,11) và nghiệm NN+2-opt vẫn tốt hơn trung bình ngẫu nhiên 2–8 %; kết luận định tính (khởi tạo tốt thắng đa khởi động ngẫu nhiên khi n lớn) giữ nguyên, độ lớn phụ thuộc cách cài đặt"; (b) "thắng cả 20 lần ngẫu nhiên" → "thắng trung bình các lần ngẫu nhiên (trong số đo gốc: cả 20 lần)". Chi tiết: `g4-bao-cao.md` (mục "Cần tác giả quyết định" 1) và `g5-bao-cao.md`.
2. **Bài 6 §6.3 (63 920, +4,1 %, λ = 80) vs Bài 7 §1/§6.1, Bài 8 §4.1, Bài 9 §6.2 (65 425, +6,5 %); leo đồi 64 490 vs ~64 200:** giữ mọi số; thêm ở Bài 6 §6.3 và Bài 7 §1 một câu: "hai số đo của cùng bộ 60 test (seed 777, n = 120) ở các bài khác nhau; Bài 6 dùng λ = 80, Bài 7 dùng λ đã hiệu chuẩn lại (≈ 88, nhật ký mẫu); kết quả nhạy với λ — chưa đối chiếu được mã gốc, đừng so trực tiếp". (Kiểm: nhật ký mẫu ở tài liệu có "hạ λ 142 → 88 → 65 425"; nếu bài khẳng định khác, bám bài và hạ mức.)
3. **Bài 6 §7.3 "λ ≈ 1 220 + 200 = 1 420":** không truy được nguồn → thay phân rã bằng số có nguồn: "λ thực nghiệm ≈ 1 420 (2607/03 §2.3); phân rã '1 220 + 200' chỉ là cách nhớ trực giác (giá/phút loại máy biên ≈ 1 367 chưa tính thưởng OT)". Đồng bộ practice bai-06 (`q3.giaiThich`, `l4.mau`).
4. **Đáp án 8.4** ("cực đại của 200 mẫu cao hơn 3–4 %"): thay bằng giá trị **tính theo chính công thức của bài** (μ + σ·E[max Z], E[max₄₀] = 2,16, E[max₂₀₀] = 2,75 và +0,99 % của §4.1) — tính lại bằng code và ghi cách tính; nêu "≈ +1,5–1,8 % theo công thức (không phải đo)". Đồng bộ bai-08 (`l2.hoi/mau`).
5. **Bài 7 §3.3/§10/đáp án 7.3 regret:** "~1,5 lần" → "cùng bậc O(n·m), cỡ 1–1,5 lần (chưa đo)"; "2–5 %" giữ ở mức "kỳ vọng, chưa có bảng đo trong bài" (đã làm một phần — đọc bản hiện tại, chỉ bổ sung chỗ còn nói khẳng định).
6. **Bài tập 10.1 (đáp án Δ = 0 kiểm chứng yếu):** theo đề xuất của g5: đổi sang đảo đoạn [2..3] của `[5, 2, 8, 1, 9]` — Δ = d(2,1) + d(8,9) − d(2,8) − d(1,9) = −12, tuyến mới 17 = 29 − 12. **Kiểm lại bằng code với toạ độ/khoảng cách của đề 10.1** trước khi viết; nếu đề dùng số liệu khác thì làm tương tự với số liệu của đề (Δ ≠ 0, dấu sai sẽ không cho cùng kết quả). Sửa đề + đáp án + đồng bộ practice bai-10 nếu nhắc.
7. **Bài 11 §3.5** "min(28 mẫu) ≈ 25 200" không có trong log §3.4: thêm "(không có trong log §3.4; dựng lại cho chiều 'B tốt hơn A' đúng, độ lớn chưa kiểm)". **§4.2** "≈ 6 : 1" → nếu là số suy ra thì sửa thành ≈ 6,5 : 1 (thực 6,5–6,7); "−2,6 triệu vs −2,11 triệu đo ở preset 1" thêm "(2,2 nghìn phút chết là ước lượng)". **0,48 triệu** giữ (làm tròn của "~330 phút").
8. **Bài 12 §6.1:** lệnh chạy n = 1500 nhưng bảng không có hàng n = 1500 → thêm "(hàng n = 1500 không có trong bảng)" hoặc bỏ 1500 khỏi lệnh (chọn cách bài ủng hộ).
9. **Lab `chan-doan-ket` (Bài 12)**: đã đồng bộ 15 % — giữ. **Đáp án 9.3 / Bài 7 §2.4:** giữ.

## Cụm X3 — Bài 13–15 (mã `x3`)

**Bài sở hữu:** `khoa-hoc/bai-13-simulated-annealing`, `bai-14-tabu-search`, `bai-15-ils-vns`. **dap-an:** mục Bài 13, 14, 15.
**Trang thực hành:** `bai-13-simulated-annealing`, `bai-14-tabu-search`, `bai-15-ils-vns`.

1. **Bài 13 §5.2 + đáp án 13.4** ("lợi ích tăng theo log, không bão hoà / gần tuyến tính"): từ chính bảng: +1 029 (10k→60k), +471 (→300k), +300 (→1M) ⇒ ≈ 1 319, 673, 577 điểm mỗi bậc 10× — độ dốc giảm một nửa. Sửa: "tăng **chậm dần** theo log: mỗi bậc 10× mang thêm ít điểm hơn bậc trước (≈ 1 319 → 673 → 577); chưa bão hoà trong khoảng đã đo". Tính lại bằng code.
2. **Bài 13 §4.1 vs §4.2** (nước "Đảo" "đánh giá qua λ" trong khi SA dùng tiền thuần): thêm câu làm rõ hàm dùng cho từng loại nước (đọc cả hai mục; chọn cách nhỏ nhất đúng).
3. **Bài 13 T_end = 1** (dòng cuối) vs công thức hiệu chuẩn T_end = |Δ|min/ln 1000 (⇒ |Δ|min ≈ 6,9) và **λ = 164** ở §4.2 vs "80–100" (Bài 9), "120" (Bài 6), "142 → 88" (Bài 4): thêm một câu "mỗi bài dùng λ/T_end của lần hiệu chuẩn riêng, không phải hằng của đồ án; đừng so trực tiếp".
4. **Bài 14 §3.3** "vừa (√n đến n/10)" ngược chiều khi n < 100 → "khoảng giữa √n và n/10 (với n ≥ 100 thì √n ≤ n/10)". **Mã reactive `(int)(TT*1.2)`** không tăng được khi TT ≤ 4 → `TT = max(TT + 1, (int)(TT * 1.2))` (nhãn [MÃ]); sửa mô tả đi kèm nếu có.
5. **Bài 15 — "20 lần ngẫu nhiên" (dòng khởi tạo / §2.3):** áp cùng quyết định số 1 của cụm X2 (giữ số đo; thêm câu cơ sở "mã gốc không còn trong repo, dựng lại độc lập cho độ phân tán nhỏ hơn…"; hạ "chắc thắng" thành "thường thắng"). Bản vá g6 đã ghi "không tái lập"; chỉ bổ sung cho khớp văn bản của Bài 12/9.
6. **Bài 15 l4 "exchange là loại duy nhất đổi tập"**: giữ (đúng trong bộ N₁..N₅ của §3.3 / bài tập 15.3).

## Cụm X4 — Bài 16–19 (mã `x4`)

**Bài sở hữu:** `khoa-hoc/bai-16-beam-search`, `bai-17-lns-alns`, `bai-17b-bay-dan-tien-hoa`, `bai-18-can-tren-can-duoi`, `bai-18b-cau-truc-ham-muc-tieu`, `bai-19-ky-thuat-cpp`. **dap-an:** mục Bài 16, 17, 17B, 18, 18B, 19.
**Trang thực hành:** `bai-16-beam-search`, `bai-17-lns-alns`, `bai-17b-bay-dan-tien-hoa`, `bai-18-can-tren-can-duoi`, `bai-18b-cau-truc-ham-muc-tieu`, `bai-19-ky-thuat-cpp`.

1. **Bài 16 §7 bảng W:** cột thời gian (31, 40, 56, 27, 40, 41 ms) không đơn điệu và lệch §7.1(c)/2607-03 §5 (W32/B10 = 14,5 ms, W10/B6 = 3,4 ms); cùng cấu hình W=32,B=10 có SCORE 32 979 370 ("300 test") và 32 907 685 ("40 test"). Giữ số; thêm chú thích dưới bảng: "SCORE trung bình 300 test (§7) và 40 test (§7.1c) nên khác nhau; cột thời gian của bảng là số đo thô (máy/chế độ chạy khác nhau giữa các dòng) — chỉ dùng đọc xu hướng thô; số đáng tin cho W = 32, B = 10 là 14,5 ms (§7.1c)".
2. **Bài 17 §5.2** "regret tốt hơn 1–3 %, đắt gấp đôi" ↔ Bài 7 §3.3: sửa cho khớp Bài 7 (kỳ vọng 2–5 %, chi phí cùng bậc, chưa có phép đo riêng — đọc Bài 7 §3.3 bản hiện tại).
3. **Bài 17 "phá theo quan hệ là mạnh nhất theo Ropke & Pisinger (2006)"** không kiểm chứng được → "thường được dùng nhiều nhất trong họ ALNS (Ropke & Pisinger 2006); thứ hạng thật phụ thuộc bài toán". "Dorigo & Stützle chương 3 có đúng ví dụ này" → bỏ số chương / nêu "xem Dorigo & Stützle, *Ant Colony Optimization*" nếu bài ghi thế (không khẳng định chương).
4. **Bài 17B** "bộ não kiến 250 000 nơron, ít hơn con ruồi" → "cỡ 10⁵ nơron" (nguồn tìm được: loài kiến 50–150 nghìn; con số 250 000 không nhất quán) — bỏ so sánh với con ruồi nếu không giữ được. **17B §Đọc thêm** "Chương 15 — Ant Colony, Chương 16 — Evolutionary" mâu thuẫn bảng ở Tài liệu tham khảo (`chapter-16` = Hybrid/Matheuristics) → bỏ số chương, chỉ nêu chủ đề ("các chương về Ant Colony và Evolutionary trong kho `samsung/metaheuristic`; xem bảng ở Tài liệu tham khảo").
5. **Bài 17B §1.7 điều 2 (elitist có bay hơi):** thêm một câu: "với cập nhật elitist *có* bay hơi, P(A–C) < 10⁻³ chỉ sau ≈ 10 vòng (nhanh hơn nhiều so với ≈ 1 400 vòng khi không bay hơi); bay hơi vẫn có ích để tránh khoá sớm ở bài nhiều tối ưu cục bộ" **chỉ nếu bạn tự kiểm lại được bằng mô phỏng ngắn** (g7 đã tính: không bay hơi k ≈ 1 397; có bay hơi ≈ 10 vòng); nếu không kiểm lại được thì bỏ.
6. **Bài 19 §3.2:** câu mở "K ≪ n … nhanh hơn sort" mâu thuẫn câu cuối đoạn "nhanh hơn khi K < log n" → thống nhất: chèn vào mảng đã sắp xếp tốn O(K) mỗi lần (so với heap O(log K)) nên chỉ lợi nhờ hằng số nhỏ khi K nhỏ; không nêu ngưỡng số cụ thể nếu bài không đo.
7. **Bài 18B §7.3:** thêm làm rõ "1,205 là tỉ lệ số nước đi; 0,24 % là khoảng cách tới trần điểm; bước suy luận giữa hai số này không kiểm lại được từ mã" (hạ mức). **Chebyshev (§4.2):** giữ. **κ(vuông) = 0,6668 vs 2/3:** thêm "(đo trên lưới; chính xác 2/3 = 0,6667)" nếu chưa có.
8. **Lab `hai-opt-ngan-sach` (Bài 19):** giữ biến thể `left > 0` đã ghi chú — **không đổi** lời giải/bộ chấm.
9. **dap-an 18.3 / 19.x (số đo không có mã):** giữ.

## Cụm X5 — Bài 20–23 + tài liệu (mã `x5`)

**Bài sở hữu:** `khoa-hoc/bai-20-quy-trinh-8-buoc`, `bai-20b-tinh-chinh-tham-so`, `bai-21-mo-xe-de-thi`, `bai-22-bay-phien-ban`, `bai-23-tu-danh-gia`, mọi `tai-lieu/*` (cheatsheet, checklist, mẫu nhật ký, mẫu báo cáo, tài liệu tham khảo, từ điển…). **dap-an:** mục Bài 20, 21, 22, 23.
**Trang thực hành:** `bai-20-quy-trinh-8-buoc`, `bai-20b-tinh-chinh-tham-so`, `bai-21-mo-xe-de-thi`, `bai-22-bay-phien-ban`, `bai-23-tu-danh-gia`.

1. **Bài 20 §1.4 "An ba phiên bản" / "Bình gõ code ít hơn An (~1,5 giờ so với ~2 giờ)":** từ bảng §1.1/§1.2 An ≈ 30 + 60 phút (1,5 giờ), Bình ≈ 15 + 80 phút (≈ 1,6 giờ); bảng chỉ có hai phiên bản (greedy, SA). Sửa: "hai phiên bản"; và câu so sánh thành "lượng thời gian gõ code **tương đương** (≈ 1,5 giờ so với ≈ 1,6 giờ); khác biệt nằm ở thứ tự việc, không phải khối lượng code". Chép lại đúng ý của §1.4 (đọc kỹ).
2. **Bài 20 §4.1 "30 phút" cho 6 câu hỏi 18B vs bước ② 15 phút (§1.2):** thêm "(bài mẫu §1.2 chỉ dùng 15 phút vì đồ án nhỏ; 30 phút là mức đầy đủ)" — hoặc cách nhỏ nhất đúng.
3. **Bài 20 §3.3** "sau lần dọn cuối thì thời gian đó miễn phí": đồng bộ với Bài 21 đã hạ ("không tốn điểm nào — miễn là ô đích trống và ≤ 720"). Đồng bộ practice bai-20 `l2`.
4. **Đáp án 20.1** (bốn quan sát về `p2.h` không kiểm được): giữ, thêm "(theo mã p2.h gốc; không có trong repo)". 
5. **Bài 21:** (a) §6 "Bước ③ — Định cỡ": trong Bài 20 bước ③ là dựng bộ chấm → đổi thành "Định cỡ (bước ②–③ của Bài 20)"; (b) mở đầu "Ba trong bảy sự thật đáng hơn toàn bộ phần metaheuristic" → "Một vài trong bảy sự thật đáng giá ngang cả phần metaheuristic (khung ngày 31: +3,27 % > beam +3,15 %)" — kiểm lại số hai chỗ này ở Bài 22 §1.1; (c) bảng "Bốn đòn bẩy" dòng #3 "giá/phút ~1 450 → ~1 530": thêm "(ước tính; đo thật greedy ≈ 1 512, C ≈ 1 519)"; (d) **dap-an 21.2/21.3** hiện ghi "bài mở — chấm theo rubric" nhưng có đáp số kiểm được (ba cận ở §7.2; §4.6: ≈ 293 nhà phân biệt, ≈ 27/1000 xuất phát trùng nhà): thêm "đáp số mong đợi" — **chỉ các số tính lại được từ bài** (tính bằng code/đọc bài), kèm cách tính.
6. **Bài 22:** (a) §8.5 "mảng hành động dư 2,4× (461 max / 528 chỗ)": 528/461 ≈ 1,15× — bỏ hệ số "2,4×" khỏi Bài 22, thêm "(hệ số 'dư 2,4×' ở 2607/03 §9 không khớp 461/528 ≈ 1,15; chưa đối chiếu được log gốc)"; (b) §4.4 dòng `v3-hỏng: cleaned=74.8 waste=771`: thêm "(nhãn `waste` chưa đối chiếu được với 22 320 = dọn + đi + chết: 74,8 nhà ≈ 10 100 phút dọn)"; (c) §10 "Xoá mọi thành phần đóng góp < 0,05 %" → thêm "(ngoại lệ: σ, −0,01 %, bản cuối vẫn giữ)". Đồng bộ practice bai-22 nếu nhắc.
7. **"Dư địa" → "độ hở"** theo định nghĩa chung (đầu tệp) trong mọi bài/tài liệu bạn sở hữu (Bài 20 §8.3/§6/§7, Bài 21 §7.3 "còn 7,0 % dư địa", Bài 22, Bài 23 §4, checklist, mẫu nhật ký "dư địa ___ %", mẫu báo cáo…) — grep `dư địa` trong md2; **không** đổi chỗ "dư địa" mang nghĩa khác (vd "dư địa cải tiến thuật toán" nói chung không có số). Practice bai-20/21/23 tương ứng.
8. **Tài liệu:** (a) checklist giai đoạn 2 thiếu bước "6 câu hỏi cấu trúc hàm mục tiêu (Bài 18B), 30 phút" (Bài 20 §4.1 đặt trong bước ②) → thêm một ô tick; (b) mẫu nhật ký: Ví dụ 1 (2026-09-16: chèn rẻ nhất 61 001 → 65 425 khi hạ λ 142 → 88) và Ví dụ 3 (2026-09-17: chèn chỉ 1 076 → 59 614, "sau khi hiệu chuẩn λ: 65 425") — thứ tự/λ lệch: đọc cả ba ví dụ, sửa ngày/diễn tả để Ví dụ 3 xảy ra **sau** Ví dụ 1 một cách nhất quán, không đổi số; (c) tài liệu tham khảo: "TopCoder Marathon Match (từ 2006)" → "(từ những năm 2000)"; mục `chapter-16` giữ (Bài 17B đã bỏ số chương ở cụm X4); thêm chú thích "số chương theo kho `samsung/metaheuristic`, chưa đối chiếu".
9. **Bài 20 mốc** — đã áp 30 714 270; đừng đổi. **Bài 20B, 23:** không có mục mới; chỉ áp định nghĩa chung ("độ hở", τ).

## Cụm X6 — ca 2605 + ca 2607 (mã `x6`)

**Bài sở hữu:** mọi `2605/*` và `case-2605/*` (xem `ls md2` với tiền tố `2605__`, `case-2605__`), mọi `2607/*`. **dap-an:** không.
**Trang thực hành:** `ca-2605`, `ca-2607`.

1. **2605/01 §3.1** "max_size = 64 → peak/LB 1,551 (tệ nhất)" vs 2605/02 §5 (v0 tệ nhất 1,5276; đề xuất 1,3959 ≈ "1,40" ở 01 §4.3, 03 §12): thêm "(01 §3.1 nêu 1,551; bảng 02 §5 cùng thước đo cho v0 tệ nhất 1,5276 và đề xuất 1,3959; chưa đối chiếu được nguồn của 1,551 — dùng số ở 02 §5)".
2. **2605/04 §5.1–5.2 vs §7:** thêm ở §7: "lệnh `-DNSTRAT=1` ở §5.1–5.2 giả định `#define NSTRAT` được bọc `#ifndef NSTRAT`; nếu không, cờ dòng lệnh bị ghi đè và -Wall báo redefined". **`bench/final_validation.txt`** (tong-quan/04 trỏ tới nhưng cây §3 không liệt kê): thêm "(tệp này không có trong cây ở §3; chưa kiểm được)".
3. **2605/03 §12.2** "hai phía… dùng trong MiniMalloc": hạ mức → "ý tưởng gần với các bộ giải bin-packing hai phía; chưa kiểm chứng cụ thể ở MiniMalloc". **2605/06 mở đầu "cả 23 bài"** → "cả 23 bài lõi (chưa kể các bài mở rộng B)".
4. **2607/03 §6 "× 3 preset ~4,3 triệu":** cộng các dòng của bảng ra ≈ 4,6 triệu (3 × (1,24 + 0,22) + 0,2 = 4,58) → sửa thành "≈ 4,6 triệu" (số suy ra). Đọc bảng để chắc cộng đúng trước khi sửa; nếu bảng khác thì bám bảng.
5. **2607/03 §9 "act[] dư 2,4×"** (Bài 22 §8.5: 461/528 ≈ 1,15×): thêm "(không khớp 461/528 ≈ 1,15× ở Bài 22 §8.5; chưa đối chiếu được log gốc)". **2607/02 §3** "SA ngân sách vài nghìn lần đánh giá": giữ.
6. **2607/01 §5 bảng "bốn đòn bẩy" dòng #3** "giá/phút ~1 450 → ~1 530": thêm "(ước tính; đo thật greedy ≈ 1 512–1 514, C ≈ 1 519)" — đồng bộ ý với Bài 21 (cụm X5 làm dòng tương ứng ở Bài 21).
7. **"Dư địa" → "độ hở"** theo định nghĩa chung trong mọi `2605/*`, `2607/*` bạn sở hữu (grep `dư địa` trong md2) khi nó chỉ % còn lại tới cận trên. Practice ca-2605/ca-2607 tương ứng.
8. **Ba giá trị peak/LB √2 (1,0734/1,0788/1,0841), ablation "bỏ eff" ≠ v3, thời gian 149/372 · 153/389 · 154/451:** đã có ghi chú cơ sở (g11) — **không đổi thêm**; chỉ kiểm lại ghi chú còn đúng.
