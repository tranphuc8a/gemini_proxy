# Báo cáo rà soát nhóm g8 — Bài 18, Bài 18B, Bài 19 và mục "Bài 18/19" của đáp án

**Kết quả**: 45 bản vá (`g8.json`) — 19 `[LOGIC]`, 8 `[SỐ]`, 7 `[MÂU THUẪN]`, 6 `[MÃ]`, 3 `[NHỎ]`, 2 `[THAM CHIẾU]`.
Theo bài: Bài 18 (24), Bài 19 (10), Bài 18B (6), `khoa-hoc/dap-an` (5: 18.1, 18.2, 18.4, 19.4).
`ap-dung-sua-loi.py --thu sua-loi/g8.json` → **áp được 45 · đã áp từ trước 0 · lỗi 0** (chạy chung với g2–g10, g12: 342 · 0 · 0, không đụng nhau).
Phương pháp: tính lại bằng python (đơn hàng 32 tập con, LP, %), biên dịch thật bằng g++ 14.0.1 `-std=c++17 -O2 -Wall -Wextra -Wshadow -Wconversion` mọi đoạn mã C++ của Bài 19 và `canTrenLP` của Bài 18; mô phỏng bộ sinh `tui` (khớp 0,113 % ở n=100) để kiểm đáp án 18.2.

## Mục đã biết — kết luận
- **18 (Bài 18) — xác nhận cả 7 ý.** (a) BHH gọi "cận dưới": sai, chính đáp án 18.4 cho BHH = 344 > đo được 119,8; sửa M3, tiêu đề §4, §4.1 (thêm ⚠️), §4.2–4.3, §11. (b) τ=7/9,5 không phải cận (g12 cũng xác nhận): 32 915 840/35 571 464 = **92,5 %** (τ=0, cận thật); 97,0 %/98,6 % chỉ so với mức tham chiếu — sửa §3.3 (cột, dòng 7,0, ⚠️), sơ đồ mở đầu, §11. (c) §9 cạm bẫy 4 ngược logic (OPT ≤ UB nên khoảng cách nhỏ với cận hợp lệ luôn ⇒ gần tối ưu; cận lỏng chỉ làm khoảng cách *lớn*): đã đảo. (d) §1.4 vs §2: 12,2 % = 2 040/16 740 (mẫu số UB), 13,9 % = 2 040/14 700 (mẫu số LB) — đúng cả hai, thêm câu làm rõ. (e) §8.1: 3 620/14 700 = 24,6 %, không phải 14 % (14 % là phần cắt dở 2 040/14 700) — sửa. (f) §4.2: 0,92·√(1,58·10⁶) = 1 156,4 → 1 156, kéo theo 354 phút, 503 000 điểm (vẫn 1,5 %) — đồng bộ g12 (2607/05 §3.5). (g) Đáp án 18.2: n=300 → mô phỏng **0,016 %** (n=10: 4,8 %; n=30: 0,87 %; n=100: 0,113 %), "0,04 %" là ngoại suy 1/n — sửa ~0,02 % và "ít nhất như O(1/n)".
- **19 (nửa 18B)**: *Sáu hạt {0,3,4,10}* — xác nhận, đổi "Bốn hạt" (31 cả hai cách). *358* — xác nhận mâu thuẫn: C(32 400, 15 905) ≈ 10^9748,7 tính cho lưới đủ 180×180 (360 phần tử), còn 358 = H+W của test seed 1015 (case-2609/01 §3) — chỉ làm rõ nguồn, không đổi số. *Chebyshev* — một phần, **không sửa**: bảng hỏi "tách theo trục" (hai trục gốc) nên ❌ đúng; lối vòng xoay 45° (max(|a|,|b|) = (|a+b|+|a−b|)/2) chỉ là thông tin thêm (xem "Cần tác giả quyết định").
- **20 (Bài 19)**: *`uint64_t`* — xác nhận (`error: 'uint64_t' does not name a type`), đổi sang `typedef` `u64/u32`. *`OpBudget nganSach(30000000)`* — xác nhận cả hai: C++17 báo "no matching function" (chỉ C++20 hợp lệ); `left > 0` chạy 299 999 vòng → `{}` và `>= 0` (đúng 300 000 vòng, đã chạy). *`push`* — một phần: mã giữ K giá trị LỚN nhất (đúng với "v lớn = tốt") nhưng với 8 khoảng cách của §1.1 trả 31·23·17 (xa nhất) và mảng static = 0 làm giá trị âm không lọt; thêm chú thích chiều + khởi tạo, chạy lại ra 4·4·6. *KB vs KiB* — xác nhận, thêm câu quy ước (cả hai đúng theo quy ước riêng; 0,22 MB khớp 2607/03 thập phân). *Hệ số 2–3 và ≥ 2* — xác nhận mơ hồ: chỉ khớp (100/40 = 2,5; 100/37,8 = 2,6×) khi cùng một lề; ghi rõ "không nhân thêm".

## Quyết định thống nhất (cho các nhóm khác)
1. **Bảng §6 giữ nguyên** (không tự mâu thuẫn). Độ hở = (UB − LB)/LB. Ngưỡng chuẩn: **> 30 %** mô hình hoá sai hoặc cận quá lỏng (→ Bài 1) · **15–30 %** heuristic xây dựng yếu (→ Phần 2) · **5–15 %** thiếu tìm kiếm (→ Phần 3–4) · **2–5 %** cần tinh chỉnh · **< 2 %** gần chạm trần, cân nhắc dừng. Bài 20 §8.3 và Bài 23 §4 đang ghi "> 20 %" → đổi thành > 30 %.
2. **Cờ cảnh báo chuẩn**: `-Wall -Wextra -Wshadow -Wconversion` (debug: `-fsanitize=address,undefined`). Đã thử g++ 14: `-Wreturn-type` **bật mặc định ở C++ và nằm trong `-Wall`** (không cờ vẫn in `[-Wreturn-type]`); `-Wsign-compare` nằm trong `-Wall`; `-Wconversion` không gồm `-Wsign-conversion`. Bài 19 §8 đúng, không sửa.

## Lỗi mới tự tìm ra (đã vá)
- Bài 18: M2 ghi "cận tổ hợp" (không có trong bài; §2.1/§11 là Lagrange). §4.3 kết luận "3 % → không đáng bỏ thêm một tuần" trái bảng §6 (2–5 % = cần tinh chỉnh) — viết lại cho khớp bảng. Sơ đồ mở đầu gọi 33,9 M là "trần" (thực là mức tham chiếu; cận thật 35,6 M ⇒ còn ≤ 8,1 %). Đáp án 18.1 "0,179 × 4 200 = 11 250" (thực 11 251,8; chính xác 5/28 × 4 200 = 750). Đáp án 18.4: kết luận "tuyến đã rất chặt" không suy ra được từ một mốc BHH không phải cận — thay bằng "cần so với TSP tối ưu của 14 điểm". Đáp án 19.4 tự mâu thuẫn ("ổn định hơn nhiều khi có tải nền … vẫn dao động").
- Bài 18B: sơ đồ ● §1 lệch (hạt 4–6 nằm dưới vị trí 9, 10, 13; đã sửa về 8, 9, 12); khẳng định "giải chính xác bằng Frank–Wolfe" cho hàm **lõm** vượt bằng chứng (FW chỉ tới một đỉnh, cực trị cục bộ; bằng chứng là thực nghiệm 16 điểm xuất phát) — thêm ⚠️ ở §6.2 và hạ câu ở §12.
- Bài 19: tham chiếu sai "Bài 13 §7.3" → §6.3 (Threshold Accepting); "Bài 14 §3.3" → §3.2 (bảng cấm/dấu thời gian).

## Cần tác giả quyết định / Chưa phân định được
- 18B §4.2 Chebyshev: có thể thêm một dòng ghi chú về lối xoay 45° (lưới xoay chỉ còn các ô cùng tính chẵn lẻ). Không sửa vì bảng đúng theo định nghĩa.
- 18B §7.3: "chi phí thực/cận dưới = 1,205 ⇒ dư địa tối ưu số nước đi chỉ 0,24 % điểm" — 1,205 là tỉ lệ nước đi, 0,24 % là khoảng cách tới trần điểm; chuỗi suy luận không nêu rõ, không kiểm được (không có mã). "Trần" 0,24 % lấy từ FW — chỉ là cận chứng minh được nếu FW toàn cục (liên quan g12, ca 2609).
- 18B §6.3 κ(vuông) = 0,6668 so với giá trị chính xác 2/3 = 0,6667 (đo trên lưới, giữ nguyên). Bài 19 §3.2 mở câu "K ≪ n … nhanh hơn sort" rồi cuối đoạn "nhanh hơn khi K < log n" — chưa sửa. Đáp án 18.3 (UB P1 72–74 nghìn; 11 %/10 %/9,5 %), 19.2 (35–50 ms vs 8–12 ms), "mt19937 chậm hơn 3–5 lần": không có mã/dữ liệu để kiểm.

## Phát hiện ngoài phạm vi
- `2605__01-phat-bieu-de-bai` §4.3 trích cạm bẫy 4: *"cận lỏng thì khoảng cách nhỏ chưa chắc nghĩa là gần tối ưu — và ngược lại."* → sửa thành "cận lỏng thì khoảng cách **lớn** chưa chắc nghĩa là còn xa tối ưu" (đúng ý ví dụ peak/LB = 1,40).
- `khoa-hoc__00-de-cuong` (mô tả Bài 18): "nới lỏng LP, nới lỏng ràng buộc, **cận tổ hợp**, hằng số BHH" → "nới lỏng Lagrange", và BHH là ước lượng.
- `khoa-hoc__bai-19b-go-loi-heuristic` §6/§6.1: bộ cờ `-Wall -Wextra -Wreturn-type -Wshadow` và "không cờ nào cảnh báo nếu quên `-Wreturn-type`" → đồng bộ theo quyết định 2.
- Bài 20 §8.3, Bài 23 §4: ngưỡng > 20 % → > 30 % (quyết định 1). `00-de-cuong`/Bài 2 §8/`03-ban-do-kien-thuc` ("10⁹⁷⁴⁹ → 358 biến") vẫn khớp sau bản vá (không đổi số).

## Bài thực hành có thể đang trích lại chỗ vừa sửa (`backend/fastapi/webapp/courses/heuristic-practice-2/data/`)
- `bai-18-can-tren-can-duoi.js`: ~dòng 37 ("đạt 97,0 % của cận τ = 7 và 98,6 % của cận τ = 9,5"); ~114 và ~174 ("n = 5 một món chiếm cỡ 14 % tổng" → món ≈ 24 %, phần dở dang 13,9 %); các câu BHH ~131–139, 184–202 ("cận dưới BHH"); ~145–151 (cận lỏng / cạm bẫy 4).
- `bai-23-tu-danh-gia.js` ~dòng 87: "khoảng cách nhỏ so với một cận lỏng chưa chắc nghĩa là gần tối ưu (cạm bẫy 4)".
- `bai-18b-cau-truc-ham-muc-tieu.js`: ~47 ("358 biến"), ~168 ("Sáu hạt … 0, 3, 4, 10"), ~49 (0,24 %), các chỗ nói Frank–Wolfe "chính xác".
- `bai-19-ky-thuat-cpp.js`: ~95 (Threshold Accepting), ~96 và ~236–238 (625/156 KB — đúng theo KiB), ~157–165 (top-K), ~248 (typedef `uint64_t`), ~260–263 ("hệ số an toàn ≥ 2", "≈ 40 ms").
