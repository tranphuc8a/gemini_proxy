# Báo cáo rà soát nhóm g9 — Bài 19B, Bài 20, đáp án Bài 20, Bài 20B

Tệp vá: `sua-loi/g9.json` — **33 bản vá**: Bài 19B 5 · Bài 20 13 · đáp án (mục Bài 20) 1 · Bài 20B 14.
Theo nhãn: `[SỐ]` 14 · `[LOGIC]` 8 · `[MÂU THUẪN]` 10 · `[NHỎ]` 1. Kết quả `--thu` cuối: **áp được 33 · đã áp từ trước 0 · lỗi 0**.
Công cụ kiểm: g++ 14.0.1 (MinGW) chạy thật; python tính lại (tích phân số + Monte Carlo cho E[max], đếm knapsack n=6); đối chiếu 2605/2607/2609, Bài 4/4B/18/19/21/22, lab-p3, cheatsheet.

## Mục đã biết được giao

| Mục | Kết luận | Bằng chứng ngắn |
|---|---|---|
| **21** (19B) | **Xác nhận cả hai ý** | Bộ cờ: 19B §6.1 `-Wall -Wextra -Wreturn-type -Wshadow` ≠ Bài 19 §8 / Bài 20 §10.1 `-Wall -Wextra -Wshadow -Wconversion` → đồng bộ theo Bài 19. "Không cờ nào cảnh báo": **sai** — g++ 14.0.1, hàm `move` của bài, không cờ nào / `-Wall -Wextra` / `-Wshadow -Wconversion` đều in `[-Wreturn-type]` (`int f(){}` → "no return statement…"; `int f(int){if..}` → "control reaches end…"); chỉ `-Wno-return-type` mới im. `-O0` → `ud2`, exit 132 (đúng như bài). Sửa luôn "Không cảnh báo" ở đoạn mở đầu thành "không cảnh báo nào lọt vào mắt". |
| **22** (Bài 20) | Xác nhận 4/5, **một mục không đúng như ghi** | (a) "tiếng rưỡi đầu": xác nhận — greedy lúc 15:05 = sau 65 phút → "hơn một tiếng đầu". (b) "ba trong bốn": xác nhận sai — xem mục 25. (c) §6 "30 phút": xác nhận — §1.2 cho bước ④ 15 phút, §2 cho 5 % → "cỡ 15 phút". (d) đáp án 20.1: xác nhận → "Bốn quan sát". (e) **§10.3 "+3,86 %": KHÔNG sai** — 31 900 896 / 30 714 270 = +3,863 % (2607/03 §4.2, §6); "+0,46 %" của người ghi dùng mốc 31 755 020 là mốc **không có nguồn**: chỉ có trong Bài 20, còn mọi nguồn khác (2607/02, 2607/03 §6, tong-quan, Bài 22 v1, lab-p3 `v0_greedy`, cheatsheet) ghi greedy P3 = **30 714 270**. Sửa mốc trong Bài 20 (§1.2, §1.3, §1.4, §6, §7): 31 755 020 → 30 714 270; dư địa 6,9 % → **10,5 %**; "+3,66 %" → **+7,17 %**. Dãy cải tiến ở bước ⑥ chính là thang v1→v6 của Bài 22 nên mốc phải là bản 30 ngày. |
| **40** (Bài 20B) | **Xác nhận cả ba ý** | (a) K=1: công thức ×ln K cho 0 (K=2: 139 < 200); bảng ghi 200 là quy tắc Bài 4 → thêm điều kiện K≥3 / hệ số max(1, ln K), gắn nhãn dòng. K=20/100/500 tính lại 599/921/1 243 ≈ 600/920/1 240 (đúng). (b) seed 1..300 vs vòng 3 = 3×600 test → dải huấn luyện **1..600** (§3, §8 ②). (c) bảng §1.1 thấp: **nguyên nhân thật** là bảng khớp công thức khi **N=100** (SE=1,0: 1,79/2,45/3,04/3,53) chứ không phải N=30; "tương quan" không giải thích được vì dòng kiểm lại cũng dùng N=30. Tính lại E[max] chính xác (SE=1,826): 2,12/3,41/4,58/5,54 → bảng 2,1/3,4/4,6/5,5; viết lại lời giải thích (√(2 ln K) là cận trên tiệm cận: 3,04 so với 2,51 độ lệch chuẩn ở K=100). |
| **23** (Bài 20 §8.3) | **Xác nhận** | Bài 18 §6: >30 % → mô hình sai; 15–30 % → Phần 2. Bài 20 tự đặt 20 %. → "> 30 % (Bài 18 §6)". |
| **25** (Bài 20 §3.1) | **Xác nhận** | Bảng ablation 2607/03 §7: bốn dòng lớn nhất = 3,08 · 2,43 · 2,43 · 0,45 (tổng 8,39). Chỉ **hai** (khung 31 ngày; di chuyển chết — theo chính §3.3 của bài) đến từ đọc mã ⇒ 2/4, chiếm 3,53/8,39 = **42 %**. Bảng dưới câu đó là bốn *phát hiện* trong mã, không phải bốn cải tiến lớn nhất. Đã sửa câu. |

## Lỗi mới tự tìm
- 19B §4.1 "ở n=6 thì greedy cũng tối ưu": sai (Bài 1 §3.4 greedy sai 40 % ở n=5); đo 3 000 thể hiện n=6: tối ưu 70–78 % → "thường".
- Bài 20 §1.2 ⑧ "0 vi phạm / 500 test": nguồn 2607 ghi **1 000** test, 5 họ seed (500 là ngưỡng checklist) → "1 000".
- Bài 20 §2 "phân bổ là số thật … buổi chiều của Bình": từ bảng §1.2 tính ra 11/8/17/8/6/44/6/0 % ≠ 10/10/15/5/5/40/10/5 → "xấp xỉ".
- 20B §4.1 "cùng ngân sách" (60 so với 4 096 lần chạy) → sửa cơ sở so sánh (1/70 ngân sách, nhiều giá trị gấp 15 lần).
- 20B §5 "|Δ ablation| là cận trên cho lợi ích tinh chỉnh": không phải định lý (Δ = f(θ hiện tại) − f(tắt)) → "cận trên thực dụng" + điều kiện; đổi "tối đa" thành "thường … cỡ".
- 20B §6.1: câu dẫn nói "bù cho nhau" nhưng ví dụ beam + phạt là **bổ trợ** (mỗi cái −2,43 %, thời gian chết 269→~770) → tách bổ trợ/thay thế; tổng 7 dòng ablation 8,72 % > chênh lệch thật 6,69 % (cùng cơ sở).

## Cần tác giả quyết định
1. **Mốc 31 755 020 của Bài 20**: nếu đó là số đo riêng của một greedy khác thì hoàn tác nhóm bản vá về mốc (bảng ④, ⑤, Chỗ 3, §1.4, §6, §7). Phương án khác: dùng greedy 31 ngày = 31 718 184 (Bài 21 §7.3, lab-p3 `starter`) → dư địa 7,0 %, tăng +3,78 % — nhưng khi đó "khai thác 31 ngày" không còn là cải tiến đầu tiên ở bước ⑥.
2. Bài 20 §1.4 "Bình gõ code ít hơn An (~1,5 giờ so với ~2 giờ)": từ bảng §1.1/§1.2 An ≈ 30 + 60 phút (1,5 giờ), Bình ≈ 15 + 80 phút (≈ 1,6 giờ); An "ba phiên bản" nhưng bảng chỉ có hai (greedy, SA). Chưa sửa (cần quyết định cách kể).
3. 19B §2.3 "ba chỗ bắt được ~90 % bug": con số không có nguồn → đề xuất "phần lớn bug".
4. Bài 20 §4.1 "30 phút" cho 6 câu hỏi 18B so với bước ② 15 phút ở §1.2.
5. Đáp án 20.1: bốn quan sát về `p2.h` không kiểm được (không có mã trong repo).

## Chưa phân định được
- 19B §6/§8 "`-O2` chạy êm, 0 nước đi, điểm 7 369": không tái lập được (mã bench 2609 không có trong repo). Mẫu tối thiểu ở g++ 14 cho thấy `-O2` đúng là **xoá thân hàm** (asm rỗng) nhưng chương trình **segfault** thay vì chạy êm — kết quả phụ thuộc inline/bố cục. Giữ nguyên.
- 19B §5: "xấu nhất 3 331 ms" (200 test) và seed xấu nhất trong 3 000 seed (7 183 ms, 2609/02 §4.1) là hai mẫu khác nhau; không mâu thuẫn nhưng dễ đọc nhầm.

## Phát hiện ngoài phạm vi
- **Bài 21 §7.3**: "nghiệm cơ sở v1 = 31 718 184 … còn 7,0 %" — theo Bài 22 (chuẩn) v1 = 30 714 270 (31 718 184 là v2) → đồng bộ với Bài 20 (10,5 %) hoặc ghi rõ "greedy 31 ngày".
- **2609/02 §4.1** (B1): "Lỗi im lặng — không cảnh báo nếu không bật `-Wreturn-type`" — sai như 19B (g++ bật mặc định).
- **Bài 19 §8** (nhóm g8): bảng cờ nên nêu `-Wall` đã chứa `-Wreturn-type`; 19B đã trỏ về đây.
- **Bài 23 §3 "3/4 cải tiến lớn nhất đến từ đọc mã"**, 2607/05 §5, 2607/03 §1: theo ablation chỉ 2/4 (42 %); Bài 4B §1 xếp "di chuyển chết" là mô hình hoá (nếu theo đó chỉ 1/4, 37 %).

## Nội dung bài thực hành có thể cần đồng bộ (`backend/fastapi/webapp/courses/heuristic-practice-2/data/`)
- `bai-19b-go-loi-heuristic.js`: dòng ~102 "không cảnh báo"; dòng ~210/214 (`-Wreturn-type`, `-O0/-O2`).
- `bai-20-quy-trinh-8-buoc.js`: "31 755 020" (dòng 63, 97, 99), "6,9 %" (63, 99, 103, 107, 111), "> 20 %" (65, 111, 167, 195), "0 vi phạm trên ≥ 500 test" (67, 171) — chỉ phần ">20 %", mốc và dư địa cần đổi; ngưỡng ≥ 500 giữ.
- `bai-20b-tinh-chinh-tham-so.js`: dòng 70 ("bảng đo thật chỉ ra ~3 %", lời giải thích tương quan; bảng 1,8/2,5/3,0/3,5), 74 và 151 ("cận trên" của |Δ ablation|), 115 (K=1 → 228 test: khớp bản vá), 212 (dải huấn luyện đủ lớn: khớp 1..600).
- `bai-21-mo-xe-de-thi.js` / `bai-22-bay-phien-ban.js`: không trích 31 755 020.
