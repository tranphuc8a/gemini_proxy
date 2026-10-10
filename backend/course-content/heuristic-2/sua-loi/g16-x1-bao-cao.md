# Báo cáo cụm X1 — nhập môn + Bài 3 + Bài 4B + Bài 19B + ca 2609

Tệp vá: `sua-loi/g16-x1.json` — **29 bản vá** (chỉ số `[0]…[28]` như `ap-dung-sua-loi.py` in ra), nhãn đều bắt đầu `[QUYẾT ĐỊNH]`.
`ap-dung-sua-loi.py --thu sua-loi/g16-x1.json` → **áp được 29 · đã áp từ trước 0 · lỗi 0** (chưa áp thật).
Trang thực hành đã đồng bộ: `bai-03-bieu-dien-nghiem`, `bai-04b-phan-bo-cong-suc`, `bai-19b-go-loi-heuristic`, `ca-2609` → `kiem.js --bai=…` **xanh (88 mục, exit 0)**.

## Quyết định → thi hành

| # | Nội dung | Bản vá | Ghi chú |
|:--:|---|---|---|
| 1 | Số giờ | `gioi-thieu` [0]; `00-de-cuong` [2],[3],[4],[5],[6] | Cộng từ tiêu đề: lõi 10/12/11/14/8/11 = 66 h + 2 h Phần 0 = **68 h** (không phải 72); +13 h mở rộng → ≈ 81 h. Phần 3: 12→11, Phần 4: 16→14, Phần 6: 12→11. Bảng tuần: cột Giờ = tổng giờ các bài trong tuần (6,5/5,5/3/3,5/5,5×6/8,5/8 = 68). 68/6 ≈ 11,3 → "≈ 12 tuần" và 68/20 = 3,4 → "≈ 4 tuần" vẫn đúng, giữ. Không đổi giờ từng bài. |
| 2 | `-Wshadow -Wconversion` | `00-de-cuong` [7] | **Cách học không có rubric** → chỉ vá Đề cương. |
| 3 | "không có con số nào là ước lượng" | `gioi-thieu` [1]; `00-de-cuong` [8] | Đề cương §9.1 bản hiện tại viết "không có con số nào … mà không kèm cách tái lập" (không phải chữ "ước lượng") → thay bằng đúng câu đã chốt, giữ câu sau. |
| 4 | Cách học §4.2, `stats.h` | `02-cach-hoc` [9],[10] | `stats.h` có `Stats`, `reportLine`, `compareLine` (theo Bài 4). |
| 5 | Bài 3 §5 C `O(n log n)` | `bai-03` [11] | §2 không có sắp xếp ("tốn O(n) để nhóm lại") → **O(n)**. |
| 6 | Bài 3 §8.2 | `bai-03` [12] | Giữ điều kiện; thêm chú thích `MAX_NEXTDAY = SO_NGAY_TOI_DA − 1` (Bài 19 §9.1, Bài 22 §3.1), tương đương. Chỉ ở văn (bảng), không đụng mã. |
| 7 | Đáp án 3.1, §7.1 | không | Giữ như chốt. `dap-an` mục Bài 3 không cần vá. |
| 8 | 4B Δ = 30 % | `bai-04b` [13],[15] | Gắn nhãn "giả định minh hoạ"; thêm số đo 2609 (+6,67 %; 34/200 = 17 % test vượt giờ của v3, mới 0). **Tính lại: EV = 0,15 × 6,67 / 0,5 ≈ 2,0 < 3,0** của đọc mã grader. §2.1 viết lại theo ý chốt. |
| 9 | Lịch 4B §6 ↔ §7 ↔ 19B §7 | `bai-04b` [14],[16],[17],[18]; `bai-19b` [24] | Theo lịch tuyệt đối §7: chẩn đoán T−50…T−35, ablation/tinh chỉnh T−35…T−20, đóng băng T−20, kiểm định T−20…T−5, nộp T−5 (§6 viết lại, Cạm bẫy 6 → T−20). Bảng §2 (bộ chấm 1,0 h, cận trên 0,5 h) ≠ §7 (30/15 phút): không đổi số, thêm một câu giải thích. |
| 10 | 19B "90 %", 3 331/7 183 ms | `bai-19b` [20],[21] | "~90 %" → "phần lớn bug"; thêm câu hai mẫu khác nhau (200 test / 3 000 seed). |
| 11 | UB `-O2` | `bai-19b` [19],[22],[23]; `case-2609/tong-quan` [25]; `02-giai-phap-hien-tai` [26] | Giữ "chạy êm, 0 nước đi, 7 369" như số đo của bản dựng gốc; thêm "UB, tuỳ trình biên dịch/phiên bản — g++ 14: `-O0` Illegal instruction, `-O2` Segmentation fault". Practice: 19B (tomTat, q1, l2) + ca-2609 (tomTat, q10). |
| 12 | 2609/03 §2.4, §3.3 | `case-2609/03` [27],[28] | 1,4 % = κ: (0,6598−0,6504)/0,6504 = 1,445 %; điểm kém 3,6 % (seed 1) / 6,4 % (seed 1015) — tính lại từ bảng §2.4. Gale–Ryser: "(chỉ khi (R, c) thoả điều kiện — xem §6.1)". Practice: ca-2609 q7. |

## Chỗ chọn khác / chọn thêm (nhỏ)
- **#9, 19B §7:** tổng các bước là đúng 20 phút nên giữ "20 phút" làm bản đầy đủ; khớp ô 15 phút của 4B §7 bằng cách **bỏ bước ⑤** (đối chiếu vét cạn, 5 phút — theo 19B §4.1 nó kiểm hạ tầng, nên làm sớm sau khi dựng bộ chấm): 2+2+5+3+3 = 15. Đây là lựa chọn của tôi; nếu muốn bỏ bước khác thì sửa [24] và [18].
- **#1:** bảng tuần để cột Giờ = tổng thực từng tuần (không ép 6 h/tuần); tuần 11–12 nặng hơn (8,5/8 h), có ghi chú.
- **#10:** practice `bai-19b` q8 và tomTat nhầm 3 331 ms với seed H=178 (7 183 ms) → tách cho đúng hai mẫu.

## Ngoài phạm vi (không vá)
- `tai-lieu/cheatsheet` (cụm X5) dòng "T−45 phút: đóng băng bản tốt nhất" → nên đổi thành T−20 cho khớp 4B §6 mới.
- Giới thiệu "mọi tuyên bố 'cải thiện X %' đều kèm lệnh để tự chạy lại": vài số đo gốc không còn mã trong repo; giữ vì quyết định không đề cập.
- 4B "Nhắc lại ④" ("97 % trần thì dư địa còn 3 %") dùng nghĩa 1 − x/UB của Bài 18 §1.4 → giữ, không đổi thành "độ hở"; 2609 tổng quan/03 §6.2 "dư địa ~0,25 %" cũng vậy.
- Bản đồ kiến thức (03) và `case-2609/01, 04`: không có chỗ nào thuộc quyết định → không vá.
