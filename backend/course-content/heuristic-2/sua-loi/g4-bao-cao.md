# Báo cáo rà soát nhóm g4 — Bài 7, 8, 9 và mục Bài 7–9 của đáp án

Tệp vá: `sua-loi/g4.json` — **34 bản vá**: Bài 7 (15), Bài 8 (3), Bài 9 (12), đáp án (4).
Theo nhãn: `[LOGIC]` 14 · `[SỐ]` 10 · `[MÂU THUẪN]` 7 · `[NHỎ]` 1 · `[THAM CHIẾU]` 1 · `[MÃ]` 1.
Lần chạy cuối: `ap-dung-sua-loi.py --thu sua-loi/g4.json` → **áp được 34 · đã áp từ trước 0 · lỗi 0**.
Cách kiểm: ví dụ làm tay Bài 7 chạy lại bằng python (λ = 60 và 120, vét cạn tối ưu); 2-opt/Or-opt/đếm lân cận Bài 9 bằng python; GRASP/chèn/regret/first-improvement dựng lại bằng node/python trên bộ sinh `ship1` và TSP ngẫu nhiên của trang thực hành (không phải mã C++ gốc, nên chỉ dùng để phân định *logic*, không đổi số đo của bài).

## Mục đã biết được giao

| Mục | Kết luận | Bằng chứng ngắn |
|---|---|---|
| 29 | **Xác nhận** | λ = 120: bước 3 đơn 4 (−840) lấn đơn 2 (−1 100) → `[4,1,3]` t = 77, tổng **9 200** (λ = 60 → 10 500 = tối ưu vét cạn). Đã sửa đáp án 7.1. |
| 30 (nửa sau) | **Xác nhận** | 40 220 là chèn với **λ = 0**, không phải chèn bằng tỉ số. Sửa tiêu đề + dòng hậu quả của cạm bẫy 3. (Nửa đầu — Bài 6 §6.3 — ngoài phạm vi, xem dưới.) |
| 31 | **Xác nhận** | Δt = đi vòng + s_j ≥ s_j > 0 nên p/Δt không bùng nổ; chính §2.3 ghi Δt ≈ s_j rồi vẫn kết luận "bùng nổ". Dựng lại trên `ship1` (n=120, 40 test): chèn theo p/Δt 14 265, p/(Δt+1) 14 321, λ = 16 → 14 291; chỉ λ = 0 sụp (7 270). Hạ "bắt buộc" xuống đúng mức ở §2.3 và §10. |
| 32 | **Một phần** | (a) "~1,5 lần" vs "gấp đôi" ở §3.3: xác nhận, thống nhất theo ~1,5. (b) Đáp án 7.3 "+2–4 %" nằm trong "2–5 %" của bài → không thật sự mâu thuẫn, chỉ làm rõ. (c) Regret thuần v⁽¹⁾−v⁽²⁾ trên P1: xác nhận (0,52× chèn rẻ nhất; v⁽¹⁾+0,5·regret = 1,02×) — bài không có bảng đo regret nào, nên chỉ hạ mức khẳng định + thêm cảnh báo, không đổi số. ("5 %" vs "+2,43 %" của Bài 6: ngoài phạm vi.) |
| 33 | **Một phần** | Xác nhận: mã §3.4 chặn k ≤ 4 nên không thể ra kết quả k = 5, 10 của §5.2 (sửa chú thích mã); "GRASP trên greedy vô dụng" chỉ khớp quanh k = 3 (dựng lại, tỉ lệ so với greedy tỉ số: k=2 → 1,035; k=3 → 0,997; k=4 → 0,971; k=5 → 0,935; k=10 → 0,82) → thêm lời hạ mức. Không sửa: "+6 % của GRASP-chèn" và thang λ (số đo theo bộ sinh khác, không đổi được). |
| 34 | **Xác nhận** | Chu trình 5 điểm có n(n−3)/2 = 5 nước 2-opt khác nhau, Δ = 0, +10, −10, −10, +10 → **hai** nước cải thiện (đều ra 50). Sửa đáp án 9.2 và đề 9.2 ("xác nhận chỉ có đúng một nước"). |
| 36 | **Xác nhận** | 1,277 = 24 240/18 980 = tệ nhất/tốt nhất trong 20 lần; so với 14 656 thì +65 %. Sửa 4 chỗ (§1.6, §7.5, §8, §9) thành "kém chỗ dừng tốt nhất 28 %" — đúng cách Bài 13/14 đã viết. |
| 37 | **Một phần** | §4.1/§4.3: dựng lại số lần tính Δ của 2-opt (n = 40/100/200, Manhattan; best = 1): first-improvement quay lại từ đầu danh sách **cố định** chỉ 0,73/0,71/0,71; **xáo trộn** 0,37/0,24/0,14 (2,7–7× ít hơn) → giữ "2–5 lần", thêm điều kiện xáo trộn. §7.2–7.3: **không sửa** (xem "Cần tác giả quyết định"). |
| 38 (Bài 9) | **Xác nhận** | Chèn là (n−m)(m+1) (ví dụ 1 590 và đáp án 9.1c đã dùng m+1); Or-opt ví dụ ghi 3·14·15 = 630 trong khi công thức ≈ 3m² = 588; đếm đúng 182+156+132 = **470** (371 nếu gộp nước trùng); đáp án 9.1b 420 → 338. "relocate m² vs (m−1)²" không có trong Bài 9 (là Bài 11). Tổng "≈ 23 000" vẫn đúng (22 941). |

## Lỗi mới tự tìm ra
- **Bài 9 intro + M5:** "luôn dừng ở chỗ *chưa tối ưu*" mâu thuẫn §1.6 (ví dụ leo đồi dừng đúng ở tối ưu 50) → "luôn dừng ở một cực trị cục bộ, không bảo đảm tối ưu".
- **Bài 9 §1.6:** lập luận "chu vi 40 + chèn 10 ⇒ mọi tuyến ≥ 50" có khe hở; thêm lập luận chặt (mọi cặp điểm cách ≥ 10, tuyến có 5 chặng).
- **Bài 7 mở đầu:** "+6,5 % nhiều hơn mọi metaheuristic" — cùng cơ sở thì SA +7,34 %, ALNS +7,28 % lớn hơn; chỉ đúng khi so với phần metaheuristic cộng thêm lên trên chèn (+0,7–0,8 %).
- **Bài 7 §4.4:** "Ba khách" nhưng ví dụ chỉ có hai. **§5.2:** +5,7 % của Bài 3 là chiến lược (B) so với (A), không phải biểu diễn chuỗi phẳng. **§5.3 và §8 cạm bẫy 4:** "số liệu … đo ra thì kém hơn" nhưng ca 2607 chỉ lập luận (không có số đo hướng gom cụm) → hạ mức.
- **Bài 8 mục ⑥:** "từ 100 lên 1 000 gần như không đổi" trái bảng §5.1 (+29 %).
- **Đáp án 9.1b:** xem trên.

## Cần tác giả quyết định
1. **Bài 9 §7.2–7.3 (TSP n=200, 20 lần ngẫu nhiên: 18 980/24 240/20 723 so với 14 656):** dựng lại bằng 2-opt hội tụ từ điểm ngẫu nhiên (n=100/200, Manhattan và Euclid) cho tệ nhất/tốt nhất chỉ 1,07–1,11, trung bình hơn NN+2-opt 2–8 %; "99 500 nước" = 5 × C(200,2) = 5 lượt quét (trong thử nghiệm của tôi 2-opt từ láng giềng gần nhất hội tụ sau 4–5 lượt, nên *không* chứng tỏ "chưa hội tụ"). Mã `tsp-sandbox` không có trong repo → không đổi số. Đề xuất: nêu rõ biến thể 2-opt/giới hạn lượt của lab, hoặc đo lại.
2. **Đáp án 8.4** ("trung bình thấp hơn 1–2 %, cực đại của 200 mẫu cao hơn 3–4 %"): theo công thức bài (μ + σ·E[max Z], E[max₄₀]=2,16, E[max₂₀₀]=2,75) và +0,99 % của §4.1 thì cực đại 200 mẫu chỉ cỡ +1,5–1,8 %. Cần tác giả đo lại hoặc bỏ con số.
3. **Bài 7 §3.3 / §10 / đáp án 7.3:** nếu có số đo regret thật thì đưa bảng vào bài; nếu không, giữ cảnh báo đã thêm. Hệ số "~1,5 lần" của regret cũng chưa đo (thực tế gần 1× vì cùng O(n·m)).

## Chưa phân định được
- **Chèn rẻ nhất 63 920 (λ = 80, +4,1 %; Bài 6 §6.3) vs 65 425 (+6,5 %; Bài 7 §1/§6.1, Bài 8 §4.1, Bài 9 §6.2)** — cùng bộ 60 test seed 777 n=120 (greedy tỉ số = 61 419,7 ở cả hai nơi). Tương tự leo đồi từ greedy tỉ số: 64 490 (+5,0 %, Bài 6) vs "~64 200" (+4,5 %, Bài 9 §6.2). Cần nói `p1_compare` dùng λ/cấu hình nào.
- Bài 7 §2.4 "27 000 phép → 0,12 ms" vs 0,08 ms đo ở Bài 8 §4.1 (cùng bậc, không sửa). Đáp án 9.3 "ít vòng hơn, ~30–40 %": dựng lại cho 55–65 % số bước.

## Phát hiện ngoài phạm vi
- **Bài 6 §6.3:** "(40 220 — thua cả greedy tiền nhất)" sai: greedy tiền nhất = 37 876 < 40 220 (Bài 5 §7, bảng "tiền nhất 37 876").
- **Bài 6 §6.4** ("Giá trị này có thể rất nhỏ … p_j/Δt_j bùng nổ", ô "Chi phí là delta (~0) → giá mờ") và dòng tóm tắt "λ là ĐIỀU KIỆN CẦN cho chèn": cùng lỗi như Bài 7 §2.3 (Δt ≥ s_j; chỉ λ = 0 sụp) — nên đồng bộ với Bài 7 đã vá.
- **Bài 3 §6** (mục 12 đã biết): +5,7 % là (B) so với (A), không đo biểu diễn D; Bài 7 §5.2 đã trích theo đúng nghĩa đó.

## Nội dung thực hành có thể trích lại chỗ vừa sửa (`backend/fastapi/webapp/courses/heuristic-practice-2/data/`)
- `bai-09-lan-can-leo-doi.js`: tomTat "chuyển đoạn ≈ 630" → 470; luận ~l.214 "(b) Chuyển đoạn L ≤ 3: xấp xỉ 3·m·(m+1) = 1 260" (m=20; đếm đúng Σ(m−L+1)(m−L) = 380+342+306 = 1 028); "thường nhanh hơn 2–5 lần" (tomTat ~l.89, trắc nghiệm ~l.133, lab ~l.554 — thêm điều kiện xáo trộn). Luận 9.2 (l2) đã đúng (5 nước).
- `bai-08-grasp.js`: tomTat ~l.85–87 và trắc nghiệm ~l.144 ("GRASP trên greedy … vô dụng", "k = 2–5 là điểm ngọt, k = 10 …") — cân nhắc thêm "ở mức k của lab".
- `bai-07-chen-gom-cum.js`: tomTat ~l.56 và trắc nghiệm regret ~l.121–129 (cân nhắc thêm cảnh báo regret thuần trên bài chọn lọc); l.55 (λ = 0 → 40 220) đã đúng; λ = 120 (l.166–169) đã đúng 9 200.
