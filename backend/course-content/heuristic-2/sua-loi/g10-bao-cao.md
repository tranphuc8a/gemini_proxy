# Báo cáo rà soát g10 — Bài 21, 22, 23, lab-p3-aircon, dap-an (Bài 21–23 + Ghi chú chung)

Tệp vá: `sua-loi/g10.json` — **34 bản vá**, kiểm bằng `ap-dung-sua-loi.py --thu` (cả khi chạy chung với g2/g3/g4/g7/g9/g12: `áp được 245 · lỗi 0`); riêng g10: `áp được 34 · đã áp từ trước 0 · lỗi 0`.
Theo nhãn: SỐ 7 · LOGIC 6 · MÂU THUẪN 3 · THAM CHIẾU 9 · NHỎ 9 · MÃ 0.
Theo bài: Bài 21 = 15, Bài 22 = 6, Bài 23 = 8, lab-p3-aircon = 4, dap-an = 1.

## Mục đã biết được giao

| Mục | Kết luận | Bằng chứng ngắn |
|---|---|---|
| 39 · Bài 22 §8.3 ngược logic | **Xác nhận** (2 vá) | Với A, B: tổng ablation − lợi ích = G(AB) − G(A) − G(B): dương khi bổ trợ, âm khi thay thế. Bài nói "bổ trợ ⇒ nhỏ hơn" và "gánh đỡ ⇒ lớn hơn" — ngược. Dữ liệu là bổ trợ (bỏ beam hay bỏ phạt đều −2,43 %). Đã sửa cơ chế; "thay thế" nay nêu `tailFill` ↔ phạt (§8.2). |
| 39 · §1.4 hai cơ sở % | **Xác nhận** | 8,72 % tính trên bản đầy đủ, 7,17 % tính trên v1; cùng cơ sở: 2 201 570/32 915 840 = **6,69 %**. Kết luận vẫn đúng (mạnh hơn); đã thêm nói rõ cơ sở. Tổng 3,0835+2,4331+2,4275+0,4465+0,2171+0,0981+0,0149 = 8,7206. |
| 39 · §1.1 "+6,93 %" | **Xác nhận** | 2 130 106/30 714 270 = 6,9352 % ⇒ 6,94 %. Các ô Δ khác đúng. |
| 39 · §8.5 "dư 2,4× (461/528)" | **Một phần / chưa phân định** | 528/461 = 1,15×, nhưng "act[] dư 2,4×" còn nằm độc lập ở 2607/03 §9. Một trong ba số (461, 528, 2,4) sai; không có dữ liệu gốc ⇒ không sửa (xem mục quyết định). |
| 39 · đánh số phiên bản | **Xác nhận**, đã đồng bộ | Bài 21 §7.1 (nhãn dòng in ra + 1 câu nối `p3_v0`=v1, `p3_starter`=v2), §7.3 ("v1"→"v2"; thêm dư địa so với v1 = 30 714 270 là 10,5 %, cùng khoảng 5–15 % — đồng bộ g9/Bài 20), lab-p3-aircon (nhãn v0/v1, mốc 5 %/7 %) theo Bài 22. Tên tệp `p3_v0`/`v0_greedy.cpp` giữ nguyên. |
| 41 · Bài 21 §4.2 | **Xác nhận** | OT = 200·(T_end−480) chỉ khi mọi bước đáp xuống nhà; di chuyển rỗng giữa ngày không thuộc khoảng nào (ô trống `return` trước khi cộng; `startMin` kế lấy sau lần đi rỗng) ⇒ mất 200 đ/phút, đúng §4.3(a). Đã thêm điều kiện. |
| 41 · §4.3(b) "miễn phí hoàn toàn" | **Xác nhận** | Vẫn chốt B (`gCurMin > 720`) và ô đích phải trống (Quan sát 4). Đã đổi "không tốn điểm nào — miễn là…". |
| 41 · §6.1 "chọn lọc 54 %" | **Một phần** | Số đúng (157/293 = 53,6 %); chỉ mơ hồ chiều. Đã làm rõ "chỉ phục vụ ~54 % số nhà". |
| 41 · §6.3 ~1 450 vs λ ≈ 1 420 | **Xác nhận** (+ g12 đồng ý) | Cùng một đại lượng, hai số; 1 420 được preset {1360,1420,1480}, 2607/03 §2.3, Bài 22 ủng hộ. Dòng #3 ("giá/phút ~1 450 → 1 530") là đại lượng khác (Σp/Σs = 1 469), giữ. |
| 41 · §6.2 20 700×1 520+1,43 M ≈ 32,9 M ≠ 31,7 M | **Không xác nhận là lỗi số** | 31,48 M + 1,43 M = 32,89 M khớp lời giải cuối 32 915 840 (2607/02 §6: phút vệ sinh 20 722, OT 1 434 274 ⇒ giá/phút 1 519). 31,7 M chỉ là v2. Đã ghi rõ đối tượng ở tiêu đề §6.2. |
| 41 · lab "≥ 32 900 000 (vượt v0 7 %)" | **Xác nhận** | 1,07 × 30 714 270 = 32 864 269; 32 900 000 = +7,12 %. Giữ số tròn, sửa nhãn "≈ 7,1 % (mốc đúng 7 % là 32 864 269)". |
| 23 · ngưỡng (nửa Bài 23 §4) | **Xác nhận** | Bài 18 §6: > 30 % mới là "mô hình sai hoặc cận lỏng"; 15–30 % là "heuristic xây dựng yếu". Đã đổi 20 % → 30 % (+ "thử cận chặt hơn"). |
| 24 · "ρ chính là λ" (Bài 23 §1.3) | **Xác nhận** | Đúng khi f là điểm gộp (ví dụ A/B; lab P1 dùng `beamSearch(…, lambda, lambda)`); ở đồ án f = Σ(p+OT−λc) đã ròng, ρ = 90 ≠ λ = 1 420. Đã nêu điều kiện, giữ ý chính. |
| 25 · "3/4 cải tiến lớn nhất từ đọc mã" | **Xác nhận** ('3/4' sai; câu mới không đếm) | 4 dòng ablation lớn nhất: ngày 31 (3,08), beam (2,43), phạt (2,43), di chuyển chết (0,45). Beam và phạt là thuật toán/mô hình Lagrange; ngày 31 chắc chắn từ đọc mã. Di chuyển chết xếp loại không đồng nhất: 2607/tong-quan, Bài 20 §3.1, Bài 22 §6.1 coi khởi từ quan sát đọc mã; Bài 4B §1 xếp "mô hình hoá" (g9). Nên Bài 23 §3 ② nay viết: "cải tiến lớn nhất (ngày 31, −3,08 %) chỉ có trong mã; di chuyển chết (−0,45 %) cũng khởi từ một quan sát đọc mã (Bài 21)" — số "hai trong bốn" (g12) hay "một" (Bài 4B) tuỳ cách xếp loại. |

## Lỗi mới tự tìm ra (đã vá)

- **Bài 21 §5.3** công thức ràng buộc đếm trùng quãng đi vào nhà đầu ngày (số hạng `d(pos,h_a)` + tổng bắt đầu từ i=a). Đã sửa thành `d(pos,h_a) + s_{h_a} + Σ_{i=a+1}^{b}` và định nghĩa `a, b, pos`.
- **Bài 21 §5.2** "Bảng giá không đơn điệu": giá tăng nghiêm ngặt; cái không đơn điệu là p/s.
- **Bài 21 §6.1** "293×135 = 39 600" (đúng 39 555).
- **Bài 21 §7.2 / §7.3, Bài 22 §1.1, Bài 23 §6.5**: τ = 7 và 9,5 là cận *tham chiếu*, chỉ τ = 0 chứng minh được (Bài 18 §3.3). Đã thêm ghi chú/nhãn; số không đổi. Tái lập gần đúng bằng mô phỏng 300 thể hiện: 35,62 / 33,97 / 33,41 M so với 35,57 / 33,94 / 33,39 M (lệch < 0,15 %).
- **Bài 22 §6.2** "Ba lớp an toàn" nhưng bảng 4 hàng.
- **Bài 23 §1.2** "1 157× trong đồ án": số đo của Bài 10 là TSP n=200 (lab `tsp-sandbox`), không phải P3.
- **Bài 23 §6.3** "tối đa 12 nhà/ngày" ⇒ **11** (12×60+11 = 731 > 720; do g12 chuyển, đã tự kiểm); Held–Karp 11²·2¹¹ ≈ 248 000 phép ≈ 0,25 ms.
- **Bài 23 §1.4** dùng "che khuất" cho hiện tượng ngược (đã đổi "bổ trợ"); **§7** "40 thuật ngữ" thực 47.
- **dap-an Ghi chú chung** thiếu cấu hình TSP sandbox (`./bin/tsp <n> 42`).

## Cần tác giả quyết định (không sửa)

1. Bài 22 §8.5 "mảng hành động dư 2,4× (461 max / 528 chỗ)": nếu 528 là sức chứa và 2,4× đúng thì mức dùng tối đa ≈ 220, không phải 461. Cần số từ log gốc.
2. Bài 22 §10 "Xoá mọi thành phần đóng góp < 0,05 %" nhưng bản cuối giữ σ (−0,01 %). Đề xuất: đổi thành "≈ 0 %" hoặc nêu σ là ngoại lệ có chủ ý.
3. Bài 22 §4.4 dòng `v3-hỏng: cleaned=74.8 waste=771`: 74,8 nhà ≈ 10 100 phút dọn thì phút chết phải cỡ 10⁴ (22 320 = vệ sinh + di chuyển + chết); 771 ≈ 74,8 × 10 trông như `travel`. Nhãn cột có thể sai.
4. dap-an: 21.2/21.3 ghi "bài mở — chấm theo rubric" nhưng có đáp số kiểm được (ba cận §7.2; §4.6: ≈ 293 nhà phân biệt, ≈ 27/1000 xuất phát trùng nhà). Đề xuất thêm đáp số mong đợi.
5. Bài 21 §6 "Bước ③ — Định cỡ": trong Bài 20 bước ③ là dựng bộ chấm; không có bước "định cỡ". Đề xuất "Bước ②–③" hoặc bỏ số.
6. Bài 21 mở đầu "Ba trong bảy sự thật đáng hơn toàn bộ phần metaheuristic": số liệu chỉ ủng hộ khung ngày 31 (+3,27 %) > beam (+3,15 %).

## Chưa phân định được

- Cùng cấu hình "1 preset W=24" (cùng SCORE 32 844 376): 9,50 ms (Bài 22 §1.1, §7) vs 8,6 ms (§7.1, §8.5, Bài 20 §10.2, 2607/03 §9). Khác giao thức đo (2607/03 nói "nhỏ nhất trên 6 lần chạy" cho 27,4 ms). Không sửa.
- Bài 22 §6.3 "≈ 108 phút": 154 279/1 420 = 108,6 (nên 109) — bỏ qua.

## Phát hiện ngoài phạm vi (chuyển nhóm phụ trách)

- **Bài 2 §2.4 và đáp án 2.4 (g2)**: "tối đa 12 ngôi nhà (720/60 = 12)", "144×4096 = 589 824 ≈ 0,6 ms; 93 lần → 55 ms" ⇒ 11 nhà: 247 808 ≈ 0,25 ms; 93 lần ≈ 23 ms. **Bài 2 §2** còn viết "Con số này sẽ rất quan trọng ở Bài 16 và Bài 21 — … giải chính xác từng bài con" nhưng Bài 16/21 không bàn matheuristic (chỉ Bài 23 §6.3).
- **00-de-cuong** (mô tả Bài 22): "v2 greedy+λ → v3 +lấp đầy ngày → v5 +tái định vị" lệch Bài 22 (v2 = +ngày 31, v3 = λ+phạt, v5 = di chuyển chết).
- **Bài 1** (dòng "Bài 21 sẽ kể… mất ~5 % điểm", và "Câu chuyện thật (Bài 21)… ~5 %"): Bài 21 không có con số 5 % cho mô hình sai (chỉ +3,27 % từ khung ngày 31).
- **02-cach-hoc** ("Bài 22: 80 % điểm số đến từ Phần 2–3") và **03-ban-do-kien-thuc** (bảng ~35/35/15/15 "đo ở Bài 22"): Bài 22 không có phân rã này; local search ở P3 làm điểm giảm.
- **Bài 10** mở đầu "Trong đồ án cuối khoá, tỉ lệ đo được là 1 157 lần" (đo ở sandbox TSP).
- **Ca 2607**: 01 §2.2 "Bảng giá không đơn điệu"; 01 §2.3 công thức ràng buộc đếm trùng; 03 §4.1 "Ba lớp an toàn" bảng 4 hàng; 03 §3.1 "tối đa 12 nhà"; 05 §5 "ba trong bốn cải tiến" (đã có trong mục 25).
- **cheatsheet** bảng P3 ghi "cận trên τ=7" (đồng bộ nhãn "cận tham chiếu" nếu muốn).

## Bài thực hành `heuristic-practice-2/data/` cần đồng bộ

- `bai-23-tu-danh-gia.js`: dòng ~8 ("nhanh hơn 1 157 lần trong đồ án" → TSP 200 điểm, Bài 10); ~9 ("ρ cùng loại với λ" → thêm điều kiện f gộp/ròng); ~51 (giải thích ablation "các thành phần còn lại vẫn gánh đỡ… đó là bản chất của 'che khuất'" → bổ trợ).
- `bai-02-vi-sao-kho.js` dòng ~245 và `ca-2607.js` dòng ~137: "tối đa 12 nhà".
- `bai-21-mo-xe-de-thi.js` dòng ~217, ~351: "≈ 39 600" (giữ được; chính xác 39 555).
- `bai-22-bay-phien-ban.js`: đã dùng +6,94 % (dòng ~84) và cơ chế bổ trợ (dòng ~141–145, 192–193) — khớp bản vá; dòng ~128 và ~205 nói "che khuất" đúng nghĩa (thay thế).

## Lần chạy cuối

`PYTHONUTF8=1 python ap-dung-sua-loi.py --thu sua-loi/g10.json` → `áp được 34 · đã áp từ trước 0 · lỗi 0`.
