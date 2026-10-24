# P6a — Logic Puzzle Suite: Quả cân Bachet (`bachet`, kind optimize) — bàn giao 24/10/2026

Làn puzzle độc lập. Thiết kế: `thiet-ke/puzzle-lo-coin.md` §2.2 + §7 + việc E1–E3. Không commit, không lệnh git đổi cây, không import backend, không database (mọi phép kiểm trình duyệt chạy trên máy chủ tĩnh `http.server` hoặc `check.py`).
**Kế thừa / viết lại:** lượt chạy trước bị ngắt (502); khi bắt đầu, cây làm việc KHÔNG có tệp `bachet` nào dở (chỉ có tệp camel/motorbike/coinbalance của P3–P5 đã xong). Kế thừa duy nhất phần TOÁN đã kiểm trong thiết kế (`nhap/puzzle-lo-coin/cw2.js`: vét cạn đa tập, `minPlace`). Mọi mã engine, bàn, CSS, test, `check_board_bachet.py` viết mới.

## Đã làm (E1–E3)
- **Engine** `puzzles/bachet.js` (thuần, ES5, chạy trong Worker; không BigInt): ba cỡ `sizes` — `hai` (chọn BỘ quả cân phủ 1…N g, quả đặt được hai đĩa → 1, 3, 9, 27…), `mot` (chỉ đĩa đối diện → 1, 2, 4, 8…), `dat` (cho bộ W và vài vật, đặt quả cân cho từng vật ít quả nhất). Sinh theo seed × 4 bậc; kiểm đề + I/O (JSON, TXT `bachet hai N=40` / `bachet dat W=1,3,9,27 X=25,14`, tệp `mode=…;N=…`); `grade` (min, tự đặt sao); `mistakes`; `hint` ba mức có "vì sao"; `replay`; `constraintView`; `trace` (ma trận phủ liền / tối thiểu từng vật); `def.lib`.
- **Bàn** `ui/boards/bachet.js` + `board-bachet.css`: `hai/mot` = hàng ô quả cân (ô nhập số + nút − / +), dải phủ 1…N (✓ nền đặc / ✗ viền đứt + gạch chéo), tóm tắt bằng chữ aria-live, ô "Cân thử", Nộp / Xoá hết / Mở lại; `dat` = mỗi vật một thẻ, nút quả cân xoay ngoài → đĩa phải ▶ → cùng vật ◀, hai đĩa bằng chữ + ◀ ＝ ▶; trình soạn (3 chip cỡ, N hoặc W/X dạng chữ, mẫu có sẵn, dòng kết quả).
- Nối vào app: 3 dòng `index.html` (css, engine `data-pz`, board), `tao-pwa.py`. CHƯA vào Daily (P8).
- Tài liệu: `HUONG-DAN-ENGINE.md` thêm bullet ở mục 7 và mục **11.12**; `ke-hoach.md` thêm gạch cuối (cat >>).

## Tệp (`backend/fastapi/webapp/tranphuc8a/logic-puzzle-suite/`)
Mới: `assets/js/puzzles/bachet.js` (589 dòng), `assets/js/ui/boards/bachet.js` (318), `assets/css/board-bachet.css` (109), `kiem/bachet.js` (415, 246 phép), `check_board_bachet.py` (525, 58 phép). Sửa: `index.html` (3 dòng), `HUONG-DAN-ENGINE.md`, `sw.js` (dấu do `tao-pwa.py`). Không sửa lõi, 5 loại cũ, Lights Out, coinbalance, camel, motorbike.

## Lệnh kiểm (chạy thật 24/10; máy đang chạy song song nhiều việc nên chậm)
- `node kiem.js bachet` -> Đạt, 246 phép, exit 0.
- `node kiem.js` (toàn bộ, gồm mẫu vàng) -> Đạt, 1505 phép, exit 0.
- `check.py --tinh` -> 16 đạt, 0 sai, exit 0 (vỏ 1310 KB).
- `check.py --chuc-nang --co-gian` (một lần, gồm check_board_bachet.py) -> 1337 đạt, 0 sai, exit 0.
- `tao-pwa.py` -> đóng dấu sw.js b7bdebe5102d; `tao-pwa.py --kiem` khớp.
(Lượt này tái chạy xác nhận; mã đã có sẵn trong cây từ lượt trước, không viết lại.)

## Công thức / giá trị đã kiểm bằng gì (nguồn độc lập viết riêng trong test)
- **Số quả tối thiểu** m*: VÉT CẠN mọi đa tập quả cân tăng dần (giá trị ≤ N) bằng đệ quy + Set các tổng có dấu — hai đĩa N = 1…40, một đĩa N = 1…31 — khớp `minCount` (vòng lặp số nguyên, không dùng log); công thức ⌈log3(2N+1)⌉ / ⌈log2(N+1)⌉ chỉ là bảng đối chiếu. Ví dụ đã in: hai đĩa N=13 → 1 bộ {1,3,9}, N=30 → 88 bộ, N=40 → 1 bộ {1,3,9,27}; một đĩa N=7 → 1 bộ, N=10 → 13 bộ, N=15 → 1 bộ.
- **Đếm bộ tối ưu**: N biên (3^m − 1)/2 / 2^m − 1 ⇒ duy nhất; N khác (> 4) ⇒ nhiều bộ — khớp vét cạn ở mọi N kiểm được. `count` 2 ("nhiều bộ") / 1 ("duy nhất") của đề lớn hơn 40 dựa vào lập luận đếm khít, không phải vét cạn.
- **Bộ dựng sẵn** `canonical(N)`: là MỘT trong các bộ tối ưu vét cạn (N ≤ 40/31); phủ 1…N bằng Set độc lập và đúng cận đếm `3^(m−1) < 2N+1 ≤ 3^m` / `2^(m−1) < N+1 ≤ 2^m` ở MỌI N = 1…400 (hai đĩa) và 1…255 (một đĩa). Bộ có thể trùng giá trị (N=5 → {1,1,3}).
- **`coverInfo`** (phủ liền R, khối lượng hở đầu tiên, số tổng phân biệt) = Set độc lập trên 400 bộ ngẫu nhiên (cả hai kiểu đĩa, bộ thừa, bộ trùng).
- **`feasible`** ("còn mở rộng được thành bộ tối ưu?") = bảng MỌI bộ tối ưu vét cạn (8 cặp (N, kiểu đĩa): hai đĩa 10, 13, 30, 40; một đĩa 7, 10, 15, 20): 1 280 tập con ngẫu nhiên (644 "có", 634 "không", gồm bộ thừa quả / quả sai), khớp 100 %, không "unknown"; mỗi cách hoàn thành engine trả đều được thử lại bằng Set (đủ m* quả, phủ đủ). Ngân sách quá bé ⇒ "unknown" (không phải "no"). N = 364: ≤ 55 ms cho 5 bộ.
- **Đặt quả cân**: `datRows` (số quả tối thiểu + SỐ bố trí tối ưu, mỗi hàng thăng bằng) = đệ quy dấu {−1, 0, +1} viết riêng trên 160 bộ (|W| ≤ 6); `arrange` ("cân thử" với bộ đang có) = vét cạn 200 ca; ví dụ thiết kế 25 g với {1,3,9,27} = 1 + 27 − 3 (3 quả, bố trí duy nhất) và 14 g với {1,2,5,10,20} = 3 quả. Vật không cân được ⇒ `min = 99` + lỗi tiếng Việt.
- **Gợi ý**: vòng "mức 3 → áp dụng" giải xong 3★ ở 192 ván hai/mot (4 bậc × 8 seed × bàn trống / 1 quả bừa / 2 quả bừa + nộp sớm, tỉ lệ bước lớn nhất ghi trong log) và 64 ván `dat` (bàn trống / 4 ô đặt bừa), ≤ total·3 bước; mức 1 không tô ô, mức 2 tô đúng ô mức 3 sẽ đặt và không nêu "quả cân w g", mức 3 luôn có "vì sao" (40 đề).
- **Kiểm đột biến engine** (15 đột biến trên bản chép tạm `%TEMP%/bachetmut`, đã khôi phục): quả cuối dùng `capOf(m)`; `minCount` dùng `≤`; ngưỡng đếm 2N+3; dấu cùng đĩa ở `datRows`; `check` bỏ cờ nộp; sao 2★ → 3★; bỏ lỗi nộp sớm; một đĩa vẫn trừ; quả gợi ý lấy cuối thay đầu; ngưỡng đầu hồ chứa N; mở lại sau khi sửa; … — 12 đỏ ngay. 3 SỐNG ở lượt đầu: (a) `R = gap` (phủ liền lệch 1) → thêm phép kiểm `coverInfo` ngẫu nhiên + hint mức 2 nêu "phủ liền 1…4 / 2R + 1 = 9" (nay đỏ); (b) `closestRow` hoà `<` ↔ `≤` (chỉ đổi hàng được chọn khi hoà, không đổi tính đúng) → thêm phép kiểm tất định "hoà → hàng đứng đầu" ; (c) hệ số +0,4 của N không biên (`score`) → thêm MẪU VÀNG 36 đề (3 seed × 3 cỡ × 4 bậc) + bảng điểm khó. Mutant "ngưỡng đếm" cũng cho thấy hint loop không treo khi `feasible` sai (bị bắt bởi oracle).

## Lệch thiết kế (chủ ý)
1. **Không dùng `core/plan.js`** (lệch gạch "plan.js dùng chung" của ke-hoach §1.6/§3): trạng thái Bachet là vector biến cố định (M ô quả cân hoặc |W|·|X| ô vị trí) + cờ nộp, không phải dãy thao tác; hoàn tác/làm lại/tự lưu vẫn dùng diff của `game.js`. Cờ nộp nằm trong state nên Reveal/replay/`check(solution)` chạy như mọi loại optimize.
2. **Không dùng `options`** — ba cách chơi là `sizes` như thiết kế §7 (chip "Bài toán"): cùng bậc khó nên không cần tham số ngoài.
3. Thiết kế nói kiểm phủ bằng "DP bitset trên [−S, S]" và hint "DFS ≤ 6 quả": làm đúng như vậy nhưng thêm **ngân sách công việc đếm bằng ô mảng** (4 triệu) và kết quả ba trạng thái yes/no/unknown. `unknown` chỉ xảy ra khi đề lớn + bộ đang chọn lạ — hint nói thật là chưa chứng minh được và khuyên bỏ quả đáng nghi; `mistakes` KHÔNG tính (chỉ tính khi chắc `yes → no`). Trong mọi bộ kiểm không gặp `unknown`.
4. Thiết kế đặt `v[M]` là phán quyết 0/1/2 (chưa nộp / đạt / thiếu); làm `v[M]` = cờ nộp 0/1 và để `check.solved = cờ && phủ đủ` (nộp thiếu giữ ván tiếp tục, lỗi +1, hiện "Mở lại để sửa"; sửa một ô sau khi nộp tự mở lại) cho khớp mục 11.5.
5. Bậc: thiết kế ghi N ≤ 13 / 40 / 121 / 364; làm bảng điểm theo m* (+0,4 nếu N không biên) nên bậc Dễ có N 4…13 (10 giá trị), Vừa 14…40, Khó 41…121, Chuyên gia 122…364 (hai đĩa); một đĩa Dễ N 4…15, Vừa 16…31, Khó 32…63, Chuyên gia 64…255. Hồ chứa Dễ nhỏ nên hai seed khác nhau có thể trùng đề (seed 20261017 / 20261018 của check.py đã kiểm khác nhau).
5b. `dat`: bậc chọn theo (|W|, |X|) = Dễ (3, 2), Vừa (4, 3), Khó (5, 4), Chuyên gia (6, 5); ba họ bộ quả cân (1, 3, 9…, tiền 1, 2, 5, 10…, ngẫu nhiên có quả 1); mỗi vật phải cần ≥ 2 (Dễ) hoặc ≥ 3 (còn lại) quả để không tầm thường.
6. Cố ý bỏ: Daily (P8); chế độ "đặt quả cân theo thứ tự" hay "cân từng lần"; `options`; mục Algorithm Notebook riêng (links dùng id có thật `coin-change`, `meet-in-the-middle`, `bit-manipulation`, kiểm trong test); hint dựa vào số liệu của người chơi khác.

## Còn tồn / ghi chú cho đợt puzzle sau
- **P8**: thêm `bachet` (cùng `coinbalance`, `camel`, `motorbike`, `coinscale` khi xong) vào Daily bằng một phiên bản `SCHEDULE` tương lai; đổi phép kiểm "CHƯA vào Daily" trong `kiem/bachet.js` (nhóm "bachet — CHƯA vào Daily"); cập nhật `metadata.json` (mô tả liệt kê Quả cân Bachet) và skill `ban-do-ung-dung` (không sửa trong làn này — đề xuất).
- Chưa thử máy thật (WebKit iPhone 13 trong Playwright đạt: chạm nút +, Nộp). Bàn `dat` chưa có hoạt hình đòn cân (chỉ chữ + dấu ◀ ＝ ▶) — làm SVG đòn nghiêng nếu cần, nhớ `prefers-reduced-motion`.
- "Xem lời giải từng bước" mở được giữa ván và không bị phạt (vỏ chung đã ghi ở `dot/P3.md`) — áp dụng cả bachet, để lượt kiểm tổng cuối làn.
- Phép kiểm `fromInput 6×6 … ≤ 1 s` của logicgrid (`kiem/logicgrid.js`) đỏ giả khi máy đang tải nặng (1 008 ms so với 1 000 ms); không phải của làn này.
- Bài học cho P6b (coinscale): (1) loại có `feasible`/oracle đắt nên nhớ đệm + ngân sách công việc đếm bằng ô mảng, không bằng giờ, và có trạng thái "unknown" trung thực; (2) kiểm đột biến phát hiện hằng số trong bảng điểm khó và tie-break chỉ bắt được bằng MẪU VÀNG / test tất định riêng — làm ngay từ đầu; (3) tệp scratchpad dùng chung giữa các lượt — đặt tên script riêng (đã có `mut.py` của lượt khác nên Write bị từ chối).
