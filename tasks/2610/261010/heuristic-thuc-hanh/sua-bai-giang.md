# Sửa lỗi bài giảng `heuristic-2` — bàn giao (10/10/2026)

Yêu cầu: "Duyệt lại tính logic, độ chính xác, điểm sai, mâu thuẫn… của bài giảng rồi chỉnh sửa lại." Sau đó chủ dự án uỷ quyền: "Thay tôi quyết định phần *Cần tác giả quyết định*, lựa chọn giải pháp phù hợp với bạn."

Kết quả: **658 bản vá** áp vào `backend/course-content/heuristic-2.json`, trên **59/61 bài**; nội dung trang thực hành đã đồng bộ (32/32 tệp). Các mục "cần tác giả quyết định" đã được **chốt thay tác giả** (bảng dưới). **Chưa nạp vào database, chưa commit.**

## Đã làm gì

| Việc | Chi tiết |
|---|---|
| Đợt 1 — rà soát | 13 tác tử độc lập (g1…g13, mỗi nhóm vài bài) tự đọc, tự tính lại bằng code (python/node/g++), tự kiểm chứng danh sách 47 nhóm lỗi trong `phat-hien-bai-giang.md` (không tin sẵn), rồi viết bản vá + báo cáo. Điều phối vá thêm g14 (bảng "bốn đòn bẩy" Bài 21/2607-01 là ước tính trước khi đo) và g15 (Bài 6 §6.4 "p/Δt bùng nổ" cho khớp Bài 7 §2.3). → 513 bản vá. |
| Đợt 2 — quyết định thay tác giả | Điều phối chốt từng mục (`sua-loi/QUYET-DINH-THAY-TAC-GIA.md`), 6 tác tử (X1…X6, theo cụm bài) thi hành: `g16-x1…x6.json` (143 bản vá) + `g17-dieu-phoi.json` (2). Mỗi tác tử cũng đồng bộ `data/*.js` của cụm mình. |
| Nhãn bản vá | SỐ 160 · LOGIC 144 · QUYẾT ĐỊNH 133 · MÂU THUẪN 92 · THAM CHIẾU 74 · NHỎ 42 · MÃ 13. |
| Không vá | `case-2609/04-implementation`, `bai-tap` (đã đối chiếu, không có chỗ sai kiểm chứng được). |
| Nguyên tắc | Chỉ sửa cái SAI/MÂU THUẪN kiểm chứng được. **Số đo thực nghiệm không tái lập được (mã C++ gốc không có trong repo) giữ nguyên**, thêm câu nêu cơ sở / hạ mức; số suy ra được thì tính lại bằng code rồi sửa. Không bịa số/nguồn. |
| Dấu vết | Markdown nguồn không nằm trong repo ⇒ **các tệp vá là dấu vết duy nhất**: `backend/course-content/heuristic-2/sua-loi/g*.json` (`{bai, old, new, ly_do}`, mỗi bản vá có bằng chứng/quyết định) + `g*-bao-cao.md` (báo cáo từng nhóm). |
| Công cụ | `backend/course-content/heuristic-2/ap-dung-sua-loi.py [--thu] sua-loi/g*.json` — mỗi `old` phải xuất hiện đúng một lần; giữ CRLF. **Áp theo thứ tự `sort -V`, đúng một lần, trên bản gốc**: bản vá g16 sửa đè chữ do g1–g15 chèn, nên chạy lại toàn bộ trên bundle đã vá sẽ báo lỗi giả. Tái tạo/kiểm: `git show <commit gốc>:backend/course-content/heuristic-2.json` → bundle tạm → áp lại 658 bản vá ⇒ 0 lỗi, giống hệt bundle hiện tại (đã thử với 656 bản vá trước g17). |

## Lỗi đáng kể đã sửa (chọn lọc)

**Số / phép tính**
- Đầu vào D1: 32 tập con → 14 hợp lệ, tối ưu **100** (không phải 90), tham lam theo giá trị kém **40 %** (không phải 33 %).
- Bài 2: 10¹⁸/10⁹ = 31,7 năm (không 36); 10²⁴ → 32 *triệu* năm (không 36 tỉ); "một ngày tối đa 12 nhà" → **11** (12×60+11 = 731 > 720; Held–Karp 11 nhà = 247 808 phép); n = 18 (100 ms), +6 sau 10 s.
- Bài 4: cỡ mẫu N ≈ **43 000** với Δ = 36,3 (không 41 000); hệ số chồng lấn 0,5175 (không "~70 %").
- Ca 2605: tổng "+10,27 %" (các thành phần cộng ra 11,98 % — bảng trộn bước thang với ablation); 93,2 % (không 93,7); Gergov 1999 là 3-xấp xỉ (không 2); v1→v4 +2,47 %; N = 3 000–5 000.
- Bài 22: +6,94 %; 8,72 % và 7,17 % khác cơ sở (cùng cơ sở 6,69 %); Bài 17 §2.1 "10³⁰" → 1,3·10³⁵; Bài 16 112 → 1 : 9 400; Bài 13 T(6000)=1745, T(12000)=761; 2607/03 §6 "~4,3 triệu" → ≈ 4,6 triệu (0,2 + 3 × (0,22 + 1,24)).
- Tốc độ máy: Bài kiểm tra đầu vào/Bài 1/Bài 3 thống nhất theo Bài 2 (10⁹ phép/s ⇒ 100 ms ≈ 10⁸; "an toàn" 10⁷ chừa lề ~10×). Số giờ khoá: **68 h** (lõi 66 + 2 Phần 0; +13 h nếu làm cả bài mở rộng) thay cho 72 h, bảng tuần cộng khớp.

**Logic**
- **Bài 22 §8.3 ngược chiều:** bổ trợ ⇒ tổng ablation *lớn hơn* lợi ích thật; thay thế ⇒ nhỏ hơn.
- "3/4 cải tiến lớn nhất đến từ đọc mã grader" (Bài 20/23/2607-05) không khớp ablation (3,08 · 2,43 · 2,43 · 0,45 %) → câu mới theo số thật; "80 %/70 %/35·35·15·15" ở Cách học/Bản đồ tính lại từ ablation.
- "ρ chính là λ": chỉ đúng khi f là điểm *gộp*; f ròng thì ρ ≈ 90 ≠ λ ≈ 1 420 (Bài 16, 23).
- Bài 7 §2.3/Bài 6 §6.4: ở P1 Δt ≥ s_j > 0 nên p/Δt *không* bùng nổ; chỉ λ = 0 làm chèn sụp (40 220 là chèn λ = 0, không phải chèn bằng tỉ số; và 40 220 > greedy tiền nhất 37 876).
- Bài 17B: P(B) → **80 %** (không → 1); Bài 12: double-bridge "thường", không "chắc chắn" thoát; Bài 15 sơ đồ double-bridge P1-P4-P3-P2 (đổi 4 cạnh; P1-P3-P2-P4 chỉ 3 cạnh).
- Bài 9: chu trình 5 điểm có **hai** nước 2-opt cải thiện; Or-opt đếm 470 (không 630); Bài 1 §5.3 "đổi 2 món" thực ra đổi 3 ô; Bài 1 §6.3 quy tắc M > max pᵢ (không pᵢ/wᵢ) cho 0/1.
- Bài 18: BHH chỉ là ước lượng, không phải cận dưới; chỉ **τ = 0 (92,5 %)** là cận chứng minh được, τ = 7/9,5 là "mức tham chiếu"; ngưỡng hành động chuẩn ở Bài 18 §6 (> 30 % / 15–30 % / 5–15 % / 2–5 % / < 2 %), Bài 20 §8.3 và Bài 23 §4 đã đồng bộ.
- Ca 2605: "LNS +3,0 % ở 2607" nhầm — đó là bài P2 (ship 5 ngày) của khoá (Bài 17 §8); đề 2607 không thử LNS.

**Mâu thuẫn / tham chiếu / mã**
- Cờ biên dịch: Bài 19B/20 đồng bộ theo Bài 19 (`-Wreturn-type` nằm sẵn trong `-Wall`, bật mặc định ở C++); đánh số phiên bản solver theo Bài 22 (v1…v7); khoá "không dùng heap"; đề cương thiếu 17B, mô tả Bài 22 gán sai v2/v3/v5.
- 74 tham chiếu chéo sai đã đọc lại bài được trích rồi sửa; 5 câu "trích" không có trong bài gốc đã thay bằng diễn giải.
- Mã (13): Bài 3 §8.2 (điều kiện sang ngày dùng 6 ngày thay vì 5), `-DCRIT=5` (không 6) ở 2605/04, `typedef` Bài 19, Bài 8 chú thích mã chặn k ≤ 4, mã reactive Tabu Bài 14 (`(int)(TT*1.2)` kẹt khi TT ≤ 4 → `TT = min(TTmax, max(TT+1, (int)(TT*1.2)))`, đã kiểm bằng node + g++)…

**Không xác nhận / một phần (từ danh sách 47 nhóm ban đầu):** "68 %" (2605) đúng là 67,51 % làm tròn; Bài 21 §6.2 20 700×1 520 + 1,43 M ≈ 32,9 M khớp lời giải cuối (không phải lỗi); đáp án 7.3 "+2–4 %" nằm trong "2–5 %".

## Đồng bộ trang thực hành

32/32 tệp `data/*.js` đã sửa (≈ 200 chỗ qua hai đợt): tomTat, trắc nghiệm, tự luận, `de` lab nhắc lại số/khẳng định cũ; không đổi id, số câu, đáp án đúng ngoài những chỗ bài giảng đã đổi. Đổi logic lab (hai chỗ): lab `chan-doan-ket` Bài 12 (ngưỡng 20 % → 15 % theo §3.3) và lời giải tham chiếu `doubleBridge` Bài 15 (3 → 4 cạnh; tỉ lệ ILS mặc định 1,0677, vẫn đạt mức cao nhất). Lab `hai-opt-ngan-sach` Bài 19 giữ biến thể `left > 0` (đã ghi chú trong đề).

## Đã quyết định thay tác giả (10/10) — ai muốn đổi thì sửa tiếp bằng bản vá mới

| Nhóm | Quyết định đã áp |
|---|---|
| **Số đo "20 lần 2-opt từ điểm ngẫu nhiên"** (18 980/24 240/20 723 vs 14 656; 1,277) — Bài 9, 12, 13, 14, 15, cheatsheet | **Giữ số đo gốc**, thêm câu nêu cơ sở: mã gốc không còn trong repo; dựng lại độc lập (2-opt quét tới hội tụ, Manhattan, n = 200) cho tệ nhất/tốt nhất ≈ 1,06–1,11, NN+2-opt tốt hơn trung bình ngẫu nhiên ≈ 3–5 %, ở n = 200 chỉ ngang lần tốt nhất trong 20; n = 600–1 000 thường thắng cả lần tốt nhất. "Thắng cả 20 lần" → "thắng trung bình / thường thắng, khi n đủ lớn". |
| **63 920 vs 65 425; 64 490 vs ~64 200**; λ "1 220 + 200" | Giữ số; ghi rõ Bài 6 dùng λ = 80, Bài 7 dùng λ đã hiệu chuẩn lại (≈ 88, nhật ký mẫu), kết quả nhạy với λ. "1 220 + 200" thay bằng số có nguồn (λ thực nghiệm ≈ 1 420; giá/phút loại máy biên ≈ 1 367 chưa tính OT). |
| **Đáp án 8.4; regret** | 8.4: thay "+3–4 %" bằng giá trị tính theo công thức của bài **≈ +1,5–1,8 %** (E[max₂₀₀] = 2,746). Regret: "~1,5×" → "cùng bậc O(n·m)", "2–5 %" ghi là kỳ vọng chưa đo; Bài 17 §5.2 khớp Bài 7. |
| **Bài tập 10.1** | Đổi sang đảo đoạn [2..3] của `[5,2,8,1,9]` ⇒ `[5,2,1,8,9]` = 17, Δ = **−12** (đề cũ Δ = 0 không phân biệt được dấu sai). Kiểm bằng code với số liệu đề. |
| **Bài 16 §7 bảng W** | Giữ số; chú thích: SCORE bảng = 300 test, §7.1(c) = 40 test; cột thời gian là số đo thô; số đáng tin cho W=32, B=10 là 14,5 ms. |
| **Bài 22 §8.5 / §4.4 / §10** | Bỏ hệ số "dư 2,4×" (528/461 ≈ 1,15); nhãn `waste` ghi chưa đối chiếu được; σ ghi là ngoại lệ (giữ dù −0,01 %). 2607/03 §9 cùng ghi chú. |
| **Bài 20 mốc & kể chuyện** | Mốc greedy = **30 714 270**, độ hở 10,5 % (v2 = 31 718 184 ⇒ 7,0 %). "An hai phiên bản"; thời gian gõ code An ≈ 1,5 h, Bình ≈ 1,6 h ("tương đương, khác ở thứ tự việc"); bước ② 15 phút (bài mẫu) vs 30 phút (đầy đủ). Đáp án 20.1 ghi "theo mã p2.h gốc, không có trong repo". |
| **Bài 21** | "Bước ③ Định cỡ" → "bước ②–③ của Bài 20"; "Ba trong bảy sự thật đáng hơn toàn bộ metaheuristic" → "một vài… ngang cả" (ngày 31 +3,27 % > beam +3,15 %); đòn bẩy #3 "~1 450" ghi là ước tính (đo thật greedy ≈ 1 512, C ≈ 1 519); **dap-an 21.2/21.3** thêm đáp số tính lại được: ba cận 35 606 095 / 33 969 920 / 33 410 863 (+0,10/0,08/0,07 % so với số đo), ≈ 294,9 nhà phân biệt, ≈ 2,95 % xuất phát trùng nhà. |
| **"Dư địa" ↔ "độ hở"** | **Độ hở = (cận trên − cơ sở)/cơ sở** (đại lượng của ngưỡng Bài 18 §6); mọi chỗ trước đây gọi là "dư địa" cho đại lượng này đổi thành "độ hở" (Bài 12, 20, 21, 23, tài liệu, 2605, 2607, practice). Bài 18 giữ hai khái niệm riêng (§1.4 "dư địa" = 1 − LB/UB; §2 "độ hở" = (UB−LB)/LB). |
| **Số giờ, rubric, lời hứa** | 68 h (xem trên); rubric xuất sắc `-Wall -Wextra -Wshadow -Wconversion`; "không có con số nào là ước lượng" → "mọi con số là số đo hoặc tính được; ước lượng được nói rõ"; "tự chạy lại" → "kèm cách đo; số đo gốc ghi rõ"; Cách học §4.2 mô tả đúng quy ước tên (tiếng Việt không dấu); `common/` thêm `stats.h`. |
| **Bài 3** | Tiêu chí 4 của C `O(n)` (§2 không có sắp xếp); §8.2 giữ `+1`, thêm chú thích `MAX_NEXTDAY = SO_NGAY_TOI_DA − 1`; đáp án 3.1 (chọn ③) và §7.1 giữ. |
| **Bài 4B / 19B** | "Hỏi 6 câu" Δ = 30 % gắn nhãn *giả định minh hoạ*, thêm đo thật 2609 (+6,67 %; EV ≈ 2,0 < 3,0), §2.1 "đứng đầu *với các giả định này*"; lịch theo 4B §7 (chẩn đoán T−50…T−35, đóng băng T−20), 4B §6/19B §7/cheatsheet khớp; quy trình 19B §7 bỏ bước ⑤ (đối chiếu vét cạn) để vừa ô 15 phút; "~90 % bug" → "phần lớn". |
| **`-O2` thiếu `return` (19B, 2609)** | Giữ "chạy êm, 0 nước đi, 7 369" là số đo bản dựng gốc, thêm: hành vi không xác định, tuỳ trình biên dịch (g++ 14 mã tối thiểu: `-O0` Illegal instruction, `-O2` Segmentation fault). 2609/03 §2.4 "1,4 %" = chênh κ; Gale–Ryser thêm điều kiện. |
| **Bài 13–15** | 13 §5.2/đáp án 13.4: "tăng chậm dần ≈ 1 320 → 670 → 570 điểm mỗi bậc 10×, chưa bão hoà"; làm rõ hàm của nước Đảo; λ/T_end là giá trị hiệu chuẩn riêng của từng bài; Bài 14 §3.3 "khoảng giữa √n và n/10" + sửa mã reactive; Bài 15 l4 giữ. |
| **Bài 17–19** | Regret (khớp Bài 7); "Ropke & Pisinger" → "được dùng nhiều nhất trong họ ALNS"; bỏ "Dorigo & Stützle chương 3"; "250 000 nơron" → "cỡ 10⁵"; bỏ số chương 15/16 ở 17B; elitist + bay hơi (kiểm bằng mô phỏng: P(A–C) < 10⁻³ sau vòng 10 so với ≈ 1 397 khi không bay hơi); Bài 19 §3.2 top-K bằng mảng chỉ lợi nhờ hằng số khi K nhỏ; 18B §7.3 hạ mức chuỗi 1,205 → 0,24 %; κ(vuông) "đo trên lưới, chính xác 2/3". |
| **Tài liệu** | Checklist giai đoạn 2 thêm ô "6 câu hỏi 18B"; mẫu nhật ký: Ví dụ 3 đổi ngày 2026-09-15 (lỗi `bestV = 0.0` phải sửa trước thì chèn rẻ nhất mới ra 61 001 ở Ví dụ 1), λ = 164 khác λ = 142; "TopCoder Marathon từ những năm 2000"; `chapter-16` giữ, ghi chưa đối chiếu. |
| **Ca 2605 / 2607** | 1,551 vs 1,5276/1,3959: ghi chú dùng số ở 02 §5; `-DNSTRAT` giả định `#ifndef`; `final_validation.txt` chưa kiểm; MiniMalloc hạ mức; "cả 23 bài lõi"; 2607/03 §6 ≈ 4,6 triệu (giả định `nfCache` dựng riêng từng preset; dùng chung ⇒ ≈ 4,1); 2605/03 §8.2 thêm ghi chú "bỏ eff" 15 440 068 (−0,16 % so với v3) ≠ v3 15 398 908 (−0,43 % so với v4). |

## Còn chưa phân định được (không sửa — cần mã/log gốc hoặc lựa chọn của tác giả)

1. **Số đo từ mã gốc không còn trong repo** (chỉ hạ mức/ghi cơ sở, không đổi): 18 980/24 240/20 723, 63 920/65 425/64 490, đáp án 5.3–5.5/6.3/6.5/18.3, 16 W-bảng, 0,85×, 0,60 (−2 %), 3 331 ms/7 183 ms, tỉ lệ chấp nhận 0,42/0,21, 154/372 ms…
2. **Bài 4 §7.2** ghi SA 20,96 ms / ALNS 14,89 ms, **Bài 13 §5** ghi 15,96 / 10,47 ms cho cùng điểm/sem — chưa phân định.
3. **Ca 2605:** peak/LB 1,551 vs 1,5276/1,3959; ba giá trị 1,0734/1,0788/1,0841 (ba cơ sở khác nhau); 2605/02 §3.1 gọi CRIT 8 là "luỹ thừa 2" trong khi v3 là √2; 03 §6.4 cột cộng 99/100; thời gian 149/372 · 153/389 · 154/451.
4. **2607/01 §5** đòn bẩy #3 "~1 450 → ~1 530" chưa rõ 1 450 là baseline nào (đã ghi "ước tính").
5. **Độ hở theo cận chứng minh được** (τ = 0, 35 571 464) so với v1 là 15,8 % — sát hoặc vượt mốc 15 % của Bài 18 §6; kết luận "thiếu tìm kiếm" ở Bài 20/21 đang dựa trên mức tham chiếu τ = 7.
6. **Mô tả `-O2`** của `int move()` (2609): phụ thuộc phiên bản trình biên dịch, không tái lập được bằng mã tối thiểu.
7. Đáp án 1.5 (`p1.h`), 20.1 (`p2.h`): mã gốc không có trong repo. "≈ 6 : 1" còn ở nhiều bài (nguồn ghi "khoảng 6 : 1", thực 6,5–6,7) — không mâu thuẫn, chưa đồng bộ.
8. Bài 18 §1.4 / 4B "Nhắc lại ④" / 2609 "dư địa ~0,25 %" dùng nghĩa 1 − x/UB (giữ).

## Việc cần làm tiếp

1. **Nạp lại bundle:** `python backend/fastapi/tools/manage_courses.py import backend/course-content/heuristic-2.json` (dev: đặt `DB_URL=sqlite+aiosqlite:///…`; DB thật do chủ dự án tự chạy — việc này **ghi đè** chỉnh sửa tay qua trang Quản lý, nếu có). Tôi không ghi DB thật. `outline/words/minutes` trong bundle tính lại khi nạp (Bài 21 §6 đổi tiêu đề).
2. Muốn đổi một quyết định ở bảng trên: thêm bản vá `sua-loi/g18-*.json` (hoặc sửa qua CMS) và đồng bộ `heuristic-practice-2/data/`; chạy `node …/heuristic-practice-2/kiem.js`.
3. Lỗi có sẵn từ trước, không do đợt này: `heuristic-course-2/check.py` báo 7 bản sao engine lệch CRLF/LF (`python engine/sync.py heuristic-course-2` rồi `git checkout` lại 6 tệp ngoài `mo-lien-ket.js` nếu không muốn nhiễu diff).
4. Chưa commit (nhánh `lab/261009`).
