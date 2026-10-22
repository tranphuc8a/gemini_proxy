# Logic Puzzle Suite — hoàn thiện Lights Out + họ trò Cân đồng xu (CW1/CW2/CW3)

Pha HIỂU + THIẾT KẾ (chưa sửa mã). App: `backend/fastapi/webapp/tranphuc8a/logic-puzzle-suite/` (gọi tắt `LPS/`).
Đã đọc: `LPS/HUONG-DAN-ENGINE.md`, `tasks/my-apps/app-8.md`, `tasks/2610/261017/logic-puzzle-suite/ban-giao.md`, engine + board + test Lights Out,
lõi `core/game.js`, `core/types.js`, vỏ `ui/play.js`, `ui/newgame.js`, `ui/app.js`, `ui/common.js`, `kiem.js`, `kiem/app-worker.js`, `check.py` (vòng đời chung),
app cũ `light-grid-shared/v1/v2/v3`. Mọi con số "đã kiểm" lấy từ script trong `scratchpad/puzzle-lo-coin/` (mục 2, phụ lục).
Ký hiệu: **[đã kiểm]** = đọc mã/chạy lệnh; **[suy đoán]** = chưa kiểm; **[tài liệu]** = kết quả công bố, chưa kiểm bằng máy.

---

## 0. Tóm tắt

- **Lights Out hiện tại** đúng và chắc cho bản cổ điển (chữ thập, chữ nhật, 2 trạng thái, khử Gauss GF(2) đóng gói bit, nghiệm ít bấm nhất bằng duyệt nhân theo mã Gray), nhưng **thiếu**: bất biến giải thích vì sao vô nghiệm, gợi ý kiểu "đuổi đèn", par/chấm sao, xuyến, lân cận khác, k trạng thái, ô khoá, bàn > 10. Đề xuất 11 hạng mục, ưu tiên P0→P3 (mục 5).
- **Cân đồng xu**: chưa có gì (spec chỉ ghi ở danh sách V2, `tasks/my-apps/app-8.md:812,819`). Thiết kế **3 loại puzzle**: `coinbalance` (CW1 cân đĩa tìm xu giả, có chế độ đối thủ thích nghi), `bachet` (CW2 bộ quả cân ít nhất), `coinscale` (CW3 cân điện tử: chồng xu giả, xu hai loại thích nghi/không thích nghi).
- **Hợp đồng engine KHÔNG cần `step()` mới**: `moveFor` đã là `step` nếu oracle **tất định** (xu giả cố định trong `puzzle.data`, hoặc đối thủ là hàm thuần của lịch sử) và **kết quả cân được ghi vào diff/state** — undo/redo/tự lưu/khôi phục/replay/Reveal chạy nguyên vẹn. Chỉ cần **5 mở rộng tuỳ chọn, tương thích ngược** (mục 4): `options` khi sinh, `grade` (chấm sao cho loại tối ưu), `hint(…, settings)`, nhãn (`kind`, `sizeLabel`, `moveLabel`), và sửa 2 giả định trong `check.py`.
- Mọi công thức đã kiểm bằng script node: biên Dyson `3^k`, `(3^k−3)/2`, `(3^k−1)/2`, `(3^k+1)/2` khớp DP và vét cạn tường minh; Bachet `⌈log3(2N+1)⌉`/`⌈log2(N+1)⌉` khớp vét cạn N ≤ 40; cân điện tử: không thích nghi m(n) = 1,2,3,3,4,5,5 (n=1..7), thích nghi A(n) = 1,2,3,3,4,**4**,5 — **thích nghi thắng ở n = 6**.
- Không thêm dependency nào.

---

## 1. Hiện trạng [đã kiểm]

### 1.1 Hợp đồng và vỏ


| Điểm | Dẫn chứng |
| --- | --- |
| Loại puzzle = đối tượng đăng ký với 19 hàm bắt buộc, `conformance` kiểm | `LPS/assets/js/core/types.js:10-28` |
| Ván chơi: `act` → `type.moveFor` → diff; undo/redo là hàm ngược; `reveal` điền `puzzle.solution.v` | `core/game.js:69-84, 87-99, 122-131` |
| `hint` gọi `type.hint(puzzle, state, level)` — **không** truyền settings | `core/game.js:113` |
| `record` (lịch sử) không có trường điểm/sao | `core/game.js:139-144` |
| Sinh đề chỉ nhận `{sizeId, tier}`; vỏ không có tuỳ chọn khác | `ui/app.js:116-118`, `ui/newgame.js:24-27,41`, liên kết seed `ui/common.js:43-45` |
| Hộp thoại "Đã giải" chỉ có thời gian/lỗi/gợi ý/độ khó | `ui/play.js:87-97` |
| `finishGame` chỉ kiểm `id` + `result` → trường thêm (vd `grade`) được lưu nguyên | `data/user.js:131-135` |
| Worker chỉ nạp tệp `data-pz`; `kiem/app-worker.js` mô phỏng | `index.html:108-122`, `kiem/app-worker.js:7-40` |
| `check.py` vòng đời chung: áp gợi ý rồi **Hoàn tác/Làm lại**; tầng 3 áp **4 gợi ý** rồi giả định ván chưa xong | `check.py:296-337`, `check.py:693-709` |
| Daily xoay vòng danh sách cố định | `core/daily.js:7` |
| Thêm loại mới không sửa vỏ (home/new/play/learn/create tự nhận) | `HUONG-DAN-ENGINE.md:153-160` |

### 1.2 Lights Out trong LPS (`LPS/assets/js/puzzles/lightsout.js`, 447 dòng)


| Có | Dẫn chứng |
| --- | --- |
| Luật chữ thập, **cắt ở mép** (không xuyến) | `lightsout.js:42-50` |
| Bàn 2..10 (`MAX_D = 10`), sinh 3..7 | `:25`, `:410-416` |
| Chỉ nhận ô 0/1 | `:125` |
| Khử Gauss–Jordan GF(2) đóng gói Uint32; nghiệm ít bấm nhất duyệt 2^nhân theo mã Gray tới nhân 22 chiều, quá thì `minimal = false` | `:56-114`, `:26` |
| Vô nghiệm: chỉ nói "không có lời giải (khoảng 1/2^nhân bàn giải được)", **không chỉ ra vì sao** | `:217-220` |
| Hint 3 mức theo nghiệm ít bấm nhất tính lại từ trạng thái hiện tại | `:281-295` |
| Replay = các ô của nghiệm ít bấm nhất; trace kiểu ma trận ≤ 60 bước; constraintView | `:296-356` |
| Độ khó theo K bấm tối thiểu và cỡ | `:131-140` |
| Board: đèn khác cả hình dạng, giữ 300 ms xem trước chữ thập, trình soạn bật/tắt đèn + chọn cỡ; hiện "Ít nhất K lần bấm" | `ui/boards/lightsout.js:1-9, 81, 199-` |
| Test 158 phép: vét cạn 2^(w·h) ≤ 4×5, đuổi đèn độc lập tới 10×10, số chiều nhân công bố | `kiem/lightsout.js:72,102,140` |

### 1.3 So với app cũ `light-grid-*` [đã kiểm qua `metadata.json`, đầu tệp mã]


| App cũ | Có mà LPS chưa có |
| --- | --- |
| `light-grid-shared` (`README.md:19-31`, `geometry.js`, `rules.js`) | 9 hình bàn (chữ nhật, **xuyến**, vành khuyên, kim cương, tam giác, lục giác…), **13 luật** (Cross, X, 8 kề, **mã**, hàng/cột, bàn cờ, bán kính…), `states` 2..6 (mod k: `board.js:4-6,105-110`) |
| v1 Playground | chọn hình/luật/số trạng thái; **nhưng gợi ý/tự giải bị tắt khi states ≠ 2** (`light-grid-v1/js/app.js:155-175`) → LPS có thể làm tốt hơn bằng GF(p) |
| v2 Lab | băng ghi nước + thanh tua, thí nghiệm hàng loạt (tỉ lệ giải được, phân bố số nước), xuất PNG, chia sẻ URL |
| v3 Research (`light-grid-v3/js/app.js:10-21`) | toàn bộ tập nghiệm, **mẫu im lặng** (cơ sở hạt nhân, bấm thử), **bất biến** chứng minh vô nghiệm, ma trận bitmap + RREF, **đuổi đèn** |

Kết luận: phần "học" mà LPS còn thiếu so với v3 là **bất biến, mẫu im lặng, đuổi đèn**; phần "chơi" còn thiếu so với v1 là **biến thể** (xuyến/luật/k/ô khoá). Hình bàn không vuông (lục giác, tam giác) và thí nghiệm hàng loạt nên **để ở light-grid** (ngoài phạm vi LPS).

### 1.4 Cân đồng xu

Chưa có tệp nào; spec liệt kê ở V2: "Coin/weight puzzles" và "Game đoán chuỗi nhị phân mô phỏng bài toán coin weighing" (`app-8.md:812,819`). Bàn giao gợi ý loại V2 theo `HUONG-DAN-ENGINE.md` mục 10 (`ban-giao.md:69`).

---

## 2. Kiểm công thức bằng script (scratch) [đã kiểm]

Script ở `scratchpad/puzzle-lo-coin/`: `cw1.js`, `cw1time.js`, `cw1diff.js`, `cw2.js`, `cw3.js`, `cw3b.js`, `cw3c.js`, `cw3d.js`, `cw3e.js`, `lo.js`, `lo2.js`, `lo3.js` (kết quả `*.out`).

### 2.1 CW1 — cân đĩa (DP trên trạng thái đếm lớp)

Mô hình: mỗi xu thuộc một lớp **U** (có thể nặng hoặc nhẹ), **H** (chỉ có thể nặng), **L** (chỉ có thể nhẹ), **G** (chắc thật). Trạng thái = (u, h, l, g) **đóng** dưới phép cân
(lệch trái: U/H bên trái → H, U/L bên phải → L, còn lại → G; thăng bằng: mọi xu trên đĩa → G). Số khả năng = 2u + h + l.

| k | biết nặng | nặng/nhẹ, phải nói hướng, **không** xu chuẩn | + 1 xu chuẩn | chỉ cần tìm xu, không chuẩn | chỉ tìm, có chuẩn |
| --- | --- | --- | --- | --- | --- |
| 1 | 3 | 0 | 1 | 1 | 2 |
| 2 | 9 | 3 (n=1,2 **không** được) | 4 | 4 (n=2 không được) | 5 |
| 3 | 27 | **12** (n=1,2 không) | 13 | 13 (n=2 không) | 14 |
| 4 | ≥45 (vòng lặp cắt 45; lý thuyết 81) | 39 | 40 | 40 | 41 |
| công thức | 3^k | (3^k−3)/2 | (3^k−1)/2 | (3^k−1)/2 | (3^k+1)/2 |

- Vét cạn **tường minh** (gán từng xu trái/phải/ngoài, n ≤ 5, k ≤ 3, đủ 4 biến thể × có/không chuẩn): **90 trường hợp, lệch 0** so với DP.
- **Cận thông tin không đủ**: 13 xu/3 lần không chuẩn có 26 ≤ 27 khả năng nhưng **không giải được**; 40 xu/4 lần: 80 ≤ 81 nhưng không giải được → hint phải dùng DP thật, không chỉ "chia 3 phần ≤ 3^(r−1)".
- 12 xu/3 lần: trong **6** lớp phép cân đầu chỉ **1** an toàn (4 với 4); 39/4: 1/19; 8/3: 3/4. Tỉ lệ này giảm đều khi n tiến tới biên → thước đo độ khó tự nhiên (bảng đầy đủ: `cw1diff.js`).
- Tham lam "chọn phép cân có nhánh lớn nhất nhỏ nhất" **không sai** trong miền u,h,l ≤ 8, g ≤ 3, k ≤ 3; đối thủ "giữ nhánh đông nhất" cũng **chưa để lọt** người chơi trong miền đó. Ngoài miền **chưa kiểm** → engine dùng DP minimax, tham lam chỉ để diễn giải.
- Thời gian DP lạnh: 39 xu/4 lần 23 ms, 40+chuẩn/4 lần 25 ms, 81 biết nặng 3 ms. Cây chiến lược: 12/3 = 37 nút, 39/4 = 118, 40+chuẩn/4 = 120 (≤ 600 của `trace`).

### 2.2 CW2 — quả cân Bachet

- m* = ⌈log3(2N+1)⌉ (quả cân đặt được cả hai đĩa) và ⌈log2(N+1)⌉ (một đĩa) **đúng với mọi N = 1..40** (vét cạn mọi bộ tăng dần).
- Bộ tối ưu **duy nhất** khi N = (3^m−1)/2 (hai đĩa: 13 → {1,3,9}, 40 → {1,3,9,27}) hoặc N = 2^m−1 (một đĩa: 7, 15); N khác có nhiều đáp án (hai đĩa N=30: 88 bộ; N=10: 9 bộ) → kiểm bằng phủ, không so một đáp án.
- Đặt quả cân ít nhất: 25 g với {1,3,9,27} = 27 − 3 + 1 (3 quả); 14 g với {1,2,5,10,20} = 20 − 5 − 1 (3 quả).

### 2.3 CW3 — cân điện tử

- Xu hai loại (vd 10 g/9 g), cân tập con biết số xu giả trong tập:
  - **Không thích nghi** m(n) (tìm ma trận phát hiện, DFS phá đối xứng, vét hết): n=1..7 → **1, 2, 3, 3, 4, 5, 5** (ví dụ n=4: {1,2} {1,3} {2,3,4}). n = 8 chưa chạy xong (> 8 phút).
  - **Thích nghi** A(n) (minimax trên tập vector còn nhất quán): n=1..7 → **1, 2, 3, 3, 4, 4, 5**. A(6) = 4 < m(6) = 5, kiểm lại độc lập bằng cách dựng cây rồi mô phỏng đủ 64 vector: 0 sai, sâu nhất 4. A(7): chứng minh "4 lần không đủ" mất 14 s, tìm chiến lược 5 lần 185 ms.
  - Tiệm cận ~2n/log2 n cho cả hai (Erdős–Rényi 1963; Lindström, Cantor–Mills 1966) — **[tài liệu]**.
- Chồng xu giả: 1 chồng giả, lấy i xu từ chồng i → 1 lần cân (n=10: đúng); nhiều chồng giả bất kỳ, lấy 2^(i−1) xu → đúng (n=6). Tập "tổng con phân biệt" có phần tử lớn nhất nhỏ nhất: n=3..6 → 4, 7, 13, 24 (vd [3,5,6,7], [3,6,11,12,13]) — khớp dãy Conway–Guy **[tài liệu: OEIS A005318]**.

### 2.4 Lights Out

- Số chiều nhân (chữ thập, chữ nhật, mod 2), n = 2..20: `0,0,4,2,0,0,0,8,0,6,0,0,4,0,8,2,0,16,0` (khớp test hiện có cho 3/4/5/6 và README light-grid cho 9×9 = 8).
- Xuyến mod 2, n=3..12: `4,0,8,8,0,0,4,16,0,16`. Mod 3 chữ nhật, n=2..12: `1,0,2,3,0,0,4,2,0,3,6`. Mod 5, n=2..9: `0,0,2,2,0,0,0,2`. Luật X: `2,0,4,4,0,0,2,8,0` (n=2..10); 8 kề: `3,0,0,9,0,0,15,0,0`; mã: `0,0,0,4,4,8,4,0` (n=3..10); chữ thập lớn (bán kính 2): `4,4,4,0,2,4,6,0` (n=3..10).
- Đối chiếu độc lập (đếm hạt nhân bằng vét cạn p^N trên 12 cấu hình nhỏ, gồm xuyến/mã/X/8 kề/mod 3/mod 5/chữ thập lớn): **12/12 khớp**.
- Đuổi đèn tổng quát mod p: đuổi xuống → giải T·t = −r (T: w×w, hàng 1 → dư hàng cuối) → bấm t ở hàng 1 → đuổi lại: **1400/1400 bàn tắt hết** (5×5, 4×4, 6×5, 7×7, 9×9; mod 2/3/5). Bảng 5×5 mod 2 tính ra **khớp bảng kinh điển** (10001→ô 1,2; 01010→1,4; 11100→2; 00111→4; 10110→5; 01101→1; 11011→3).
- Bàn sáng hết, ít bấm nhất: 3×3..7×7 = 5, 4, **15**, 28, 33.
- Thời gian khử Uint8 (không đóng gói): 20×20 mod 2 68 ms, 20×20 mod 3 137 ms, 15×15 mod 5 30 ms → mod p lớn phải **khử một lần rồi nhớ** (mục 5.2).

---

## 3. Phát hiện chính

1. **[cao]** Hợp đồng hiện tại đã đủ cho puzzle tương tác có oracle **nếu** kết quả oracle được ghi vào diff và oracle tất định; thứ thiếu thật là: tham số sinh ngoài cỡ/bậc (chế độ đối thủ, luật Lights Out), điểm tối ưu (sao), và settings cho hint. Không cần `step()` riêng — thêm kênh quan sát ngoài state sẽ phá undo/tự lưu/replay.
2. **[cao]** Lights Out không giải thích vô nghiệm (`lightsout.js:217-220`); với ma trận đối xứng, véc-tơ hạt nhân y có y·b ≠ 0 là **bằng chứng ngắn** ("số đèn sáng trên tập ô này luôn lẻ") — rẻ vì đã có khử Gauss.
3. **[vừa]** Hint Lights Out chỉ "đọc nghiệm ít bấm nhất" (`:291-293`) — đúng nhưng không dạy được kỹ thuật tay; đuổi đèn đã có bản độc lập trong test (`kiem/lightsout.js:72,140`) và đã kiểm tổng quát mod p.
4. **[vừa]** Không có "par": board hiện K (`ui/boards/lightsout.js:81`) nhưng giải xong không chấm theo K.
5. **[vừa]** Biến thể (xuyến, luật, k, ô khoá, bàn lớn) cần tổng quát hoá engine: `crossCells` cứng (`:42-50`), `analyze` chỉ 0/1 (`:125`), cỡ ≤ 10 (`:25`); board nhân bản luật chữ thập (`ui/boards/lightsout.js:26-34`).
6. **[cao]** Đổi engine Lights Out có nguy cơ **đổi puzzle của seed cũ** (Daily đã phát, liên kết seed, yêu thích vì `puzzleId` băm `data`) → phải chụp **mẫu vàng** trước khi refactor và chỉ ghi trường mới khi khác mặc định.
7. **[cao]** CW1: phải dùng DP minimax (cận 3^k không đủ: 13/3, 40/4); đối thủ thích nghi = chọn kết quả làm ván con khó nhất (theo DP), hoà thì nhánh đông hơn, hoà nữa thì rng(seed, lịch sử) — vẫn tất định, luôn nhất quán.
8. **[vừa]** `check.py` có 2 giả định không đúng cho loại ngắn (≤ 4 nước ở cỡ mặc định/bậc dễ): tầng 3 áp đúng 4 gợi ý rồi đòi "giải tiếp" (`check.py:693,705,709`).
9. **[vừa]** Chế độ "xu giả cố định" + Hoàn tác cho phép "câu" kết quả; khoá Hoàn tác thì vỡ vòng đời chung (`check.py:332-337`) → chọn: cho hoàn tác nhưng **ghi nhận** trong `grade`.
10. **[thấp]** CW3 thích nghi: chứng minh thế thua ở n = 7 tốn 14 s → giới hạn chế độ thích nghi n ≤ 6 (A(6) lạnh 71 ms); thiết kế không thích nghi tới n ≤ 7 (bảng m(n) đã tính sẵn).
11. **[thấp]** `algorithm.links` phải là id có thật; không có id "minimax" — dùng `ternary-search`, `backtracking`, `branch-and-bound`, `coin-change`, `meet-in-the-middle`, `gaussian-elimination`, `bitmask-dp`, `bit-manipulation` (đã liệt kê id thật trong `algorithm-notebook/assets/data/lib-*.js`).

---

## 4. Mở rộng hợp đồng tối thiểu (tương thích ngược)

### 4.1 Mẫu "puzzle tương tác có oracle" — KHÔNG thêm hàm bắt buộc

- `moveFor(puzzle, state, action)` của hành động hỏi oracle (vd `{k:"weigh", L, R}`) **tính luôn kết quả** và ghi vào diff (ô kết quả trong `state.v`). Oracle phải là hàm thuần của `(puzzle, state, action)`:
  - *cố định*: bí mật nằm trong `puzzle.data.secret` (sinh từ seed; không phải bí mật mật mã — lộ qua JSON/devtools, chấp nhận với app cá nhân);
  - *đối thủ*: chọn kết quả theo DP từ lịch sử trong `state.v`, phá hoà bằng `Puz.rng.create(hash(puzzle.seed|puzzle.id, lịch sử))`.
- Hệ quả: redo/khôi phục/replay áp lại **đúng** kết quả cũ; `diffTo`/Reveal dùng được nếu `solution.v` = **ván chơi tối ưu** (log phép cân của chiến lược tối ưu chống lại chính oracle đó + kết luận).
- `check` tính lại tập khả năng từ log (rẻ); `solved` = đã kết luận **và** kết luận bị ép buộc bởi lịch sử (tập khả năng còn đúng 1 — không chấp nhận đoán may).
- `mistakes(diff)` = 1 khi phép cân **mất an toàn** (một kết quả nào đó dẫn tới thế không giải được trong số lần còn lại) hoặc kết luận sai/chưa đủ chứng cứ.
- Hoàn tác: cho phép (vòng đời chung giữ nguyên); `grade` phạt nếu `counters.undos > 0` ở chế độ cố định.
- Trạng thái giao diện tạm (xu đang đặt trên đĩa trước khi bấm "Cân") là trạng thái **board**, không vào `state` (như "ô đang chọn").

### 4.2 Các mở rộng (đều tuỳ chọn)


| Mã | Mở rộng | Tệp | Kích thước |
| --- | --- | --- | --- |
| E1 | `def.options = [{id, label, choices:[{id,label,note?}], default}]`; `generate(seed, {sizeId, tier, options})`; engine ghi lựa chọn **khác mặc định** vào `puzzle.data` và trả `puzzle.options` (đối tượng gọn) để vỏ dựng lại liên kết seed | `core/types.js` (conformance), `ui/newgame.js` (thêm hàng chip mỗi option), `ui/app.js` `begin` (truyền `options`), `ui/common.js` `seedHash` (thêm `o=mode:adv,rule:x`), `ui/newgame.js` đọc `q.o`; Daily dùng mặc định | ~40 dòng |
| E2 | `def.grade(puzzle, state, counters) → {stars:0..3, value, best, unit, text}` | `core/game.js` `record` thêm `grade` khi có; `ui/play.js` `showSolved` thêm ô "Điểm tối ưu"; (sau) `ui/statsview.js` trung bình sao | ~25 dòng |
| E3 | `type.hint(puzzle, state, level, settings)` (tham số thứ 4) | `core/game.js:113` | 1 dòng |
| E4 | Nhãn: `def.kind ∈ {"static","interactive","optimize"}` (chỉ để hiển thị/test), `def.sizeLabel` ("Phiên bản"), `def.moveLabel` ("Lần cân") | `ui/newgame.js:41`, `ui/play.js:174` | ~6 dòng |
| E5 | Kiểm/tài liệu: conformance kiểm kiểu thuộc tính tuỳ chọn; `HUONG-DAN-ENGINE.md` mục 11 "Puzzle tương tác & tối ưu"; `kiem/app-worker.js` thêm vòng mỗi option; `check.py` tầng 3 áp `min(4, len(replay)−1)` gợi ý, vòng đời chung bỏ giả định ≥ 5 nước | `HUONG-DAN-ENGINE.md`, `kiem/app-worker.js`, `check.py` | ~30 dòng |

Lý do không làm `step(state, action) → observation`: quan sát ngoài state không đi qua diff ⇒ hoàn tác/làm lại/tự lưu/khôi phục sau sập/replay đều phải viết lại; `moveFor` đã thuần và chạy trên luồng chính trong vài ms (DP 40 xu/4 lần: 25 ms lạnh, sau đó nhớ đệm).

---

## 5. Lights Out — danh sách hoàn thiện có ưu tiên

| Ưu tiên | Hạng mục | Giá trị | Cần mở rộng | Cỡ |
| --- | --- | --- | --- | --- |
| P0 | **LO-0** Mẫu vàng: chụp `id` + `initial` của `generate` (20 seed × mọi cỡ × bậc) vào test trước khi đụng engine | chặn đổi puzzle cũ | — | S |
| P0 | **LO-1** Bất biến khi vô nghiệm: y ∈ ker(Aᵀ), y·b ≠ 0, chọn y ít ô nhất; `validate/fromInput/solve/hint` trả `info.obstruction = {cells, text}`; trình soạn tô ô | dạy "vì sao không giải được" | — | S+S |
| P0 | **LO-2** Mẫu im lặng: cơ sở hạt nhân + liệt kê mọi nghiệm khi ≤ 16 trong `constraintView`; bước cuối `trace` nêu hạt nhân | phần "Research" còn thiếu | — | S |
| P0 | **LO-3** Bản đồ lời giải: bước replay đầu tiên có `cells` = mọi ô cần bấm + chữ "cần bấm K ô: …" | xem toàn cục lời giải | — | S |
| P1 | **LO-4** Gợi ý "Đuổi đèn" (công tắc trên bàn: *Ít bấm nhất* / *Đuổi đèn*), bảng hàng 1 tính bằng giải T·t = −r | kỹ thuật giải tay | E3 | M |
| P1 | **LO-5** Par + sao: 3★ = đúng K nước, 2★ ≤ K + ⌈K/4⌉, 1★ còn lại; hiện "Par K" | thử thách số bước | E2 | S |
| P2 | **LO-6** Engine tổng quát `spec = {w,h,rule,topo,k,mask}`: luật cross/x/king/knight/plus2, chữ nhật/xuyến, k ∈ {2,3,5}, ô khoá; GF(2) giữ đóng gói, GF(3/5) Uint8 + **khử một lần, nhớ ma trận biến đổi E** (mỗi bàn O(N²)); nghiệm ít bấm nhất = min Σx_i trên coset, duyệt k^nhân ≤ 2^22, quá thì leo đồi + `minimal:false` | biến thể | — | M+M |
| P2 | **LO-7** Loại `lightsoutx` "Lights Out biến thể" (cùng tệp engine, đăng ký thứ hai) với `options` rule/topo/k/holes, cỡ 4..10; độ khó theo K, N, |mẫu bấm|, k; hiệu chỉnh bậc bằng đo | chơi biến thể, giữ Lights Out cổ điển + Daily nguyên vẹn | E1 | M |
| P2 | **LO-8** Board: đèn k mức (số cung tô 0..k−1 + màu token), ô khoá (không focus, `aria-label` "ô khoá"), dấu quấn mép khi xuyến, xem trước mẫu bấm lấy từ `type.lib.pattern(puzzle,i)` (bỏ bản sao luật ở board) | | — | M |
| P2 | **LO-9** Trình soạn: chọn luật/topo/k, vẽ ô khoá, chế độ **"soạn bằng bấm"** (luôn giải được), bất biến sống | | — | M |
| P3 | **LO-10** Bàn lớn 12–20 (tự nhập; sinh tới 10): khung cuộn + nút zoom như Nonogram; ngân sách hint ≤ 50 ms (mod 2) / ≤ 100 ms (mod 3) | | — | M |
| P3 | **LO-11** Trang Học: minh hoạ đuổi đèn + bảng 5×5 (đã kiểm khớp kinh điển) | | — | S |

Ngoài phạm vi (giữ ở light-grid): bàn lục giác/tam giác/vành khuyên, luật hàng/cột/bán kính, thí nghiệm hàng loạt, "lit-only σ⁺" (phi tuyến). k = 4, 6 (vành Z_k, không phải trường) để sau — cần chuẩn Hermite/Smith.

### 5.1 Chi tiết thuật toán

- **Bất biến**: với cross/x/king/knight/plus2 trên chữ nhật/xuyến, A đối xứng ⇒ ker(Aᵀ) = ker(A) = cơ sở đã có từ khử (`analyse` dựng `basis`, `lightsout.js:90-96`). Bàn b vô nghiệm ⇔ ∃ y trong cơ sở với y·b ≠ 0 (mod p). Duyệt tổ hợp cơ sở (≤ 2^nhân, nhân ≤ 22) chọn y có ít ô nhất mà y·b ≠ 0. Lời: mod 2 — "Mỗi lần bấm đảo một số **chẵn** đèn trong tập tô đỏ (vì y·A = 0), nên tính chẵn lẻ của số đèn sáng trong tập không đổi; bàn tắt hết có 0 (chẵn) nhưng bàn này có s (lẻ)". Mod p — "tổng Σ y_i·b_i (mod p) không đổi".
- **Đuổi đèn (chỉ cross + chữ nhật + không ô khoá)**: pha 1 với mỗi hàng r < h−1, ô (r,c) có giá trị s ≠ 0 → bấm (r+1,c) (p−s) lần; pha 2 nếu hàng cuối dư r ≠ 0: giải T·t = −r (T dựng bằng w lần đuổi trên bàn trống, nhớ theo (w,h,p)); bấm t ở hàng 1 rồi quay lại pha 1. Hint mức 1: "Đuổi đèn: hàng 2 còn đèn sáng — bấm ngay dưới mỗi đèn"; mức 2: ô; mức 3: nước + vì sao. Pha 2 mức 3: "Hàng cuối còn mẫu 10001 → tra bảng: bấm ô 1, 2 ở hàng 1 rồi đuổi lại" (với 5×5 mod 2 đúng bảng kinh điển). Số nước ≤ 2N − w (đạt điều kiện test "≤ total·3"). Luật/topo khác: công tắc ẩn, dùng ít bấm nhất.
- **Cache khử**: khoá `w,h,rule,topo,k,maskHash` → `{E, pivots, rank, basis}` (LRU 8). Giải bàn b: y = E·b; vô nghiệm nếu y[rank..] ≠ 0; x0 từ pivot; min trên coset.
- **Tương thích**: puzzle cổ điển giữ `data = {w,h,presses}`; chỉ thêm `rule/topo/k/mask` khi khác mặc định; luồng rng của cổ điển không đổi (nhánh biến thể dùng `rng.fork("var")`).

---

## 6. CW1 `coinbalance` — Cân đĩa tìm xu giả

Siêu dữ liệu: `id:"coinbalance"`, name "Cân đồng xu", family "Deduction Puzzle", category "Suy diễn", icon "⚖️", `kind:"interactive"`, `sizeLabel:"Phiên bản"`, `moveLabel:"Nước"`,
links `ternary-search`, `backtracking`, `branch-and-bound`.

### 6.1 Phiên bản (`sizes`) và tuỳ chọn


| id | nhãn | n tối đa (k) | bậc |
| --- | --- | --- | --- |
| `nang2` | Biết xu giả NẶNG hơn · 2 lần cân | 9 | dễ, vừa |
| `nang3` | Biết nặng · 3 lần | 27 | dễ…khó |
| `nn3` (mặc định) | Không biết nặng/nhẹ · 3 lần · phải nói nặng/nhẹ | 12 | 4 bậc |
| `nnc3` | như trên + 1 xu chuẩn | 13 | vừa…chuyên gia |
| `tim3` | Không biết nặng/nhẹ · chỉ cần chỉ ra xu · 3 lần | 13 | vừa…chuyên gia |
| `nn4` | Không biết nặng/nhẹ · 4 lần | 39 | khó, chuyên gia |

`options`: `mode` = `fixed` ("Xu giả cố định theo seed", mặc định) | `adv` ("Đối thủ thích nghi"). Bậc → n: dễ ≈ n có tỉ lệ phép cân đầu an toàn ≥ 2/3; vừa; khó; chuyên gia = n = biên (an toàn 1/6…1/19). Nếu **không** làm E1: Dễ/Vừa/Khó = cố định, Chuyên gia = đối thủ.

### 6.2 Dữ liệu

```
puzzle.data = { n, k, fake: "heavy"|"either", ref: 0|1, dir: 0|1, mode: "fixed"|"adv", secret: {coin, heavy:0|1} | null }
C = n + ref  (xu chuẩn, nếu có, mang chỉ số n)
state.v (độ dài k·(C+1) + 2, số nguyên nhỏ):
  khe j (j = 0..k−1) ở vị trí o = j·(C+1): v[o+i] = đĩa của xu i (0 ngoài, 1 trái, 2 phải), v[o+C] = kết quả (0 chưa cân, 1 trái nặng hơn, 2 thăng bằng, 3 phải nặng hơn)
  v[k·(C+1)] = xu kết luận + 1 (0 = chưa), v[k·(C+1)+1] = 0 | 1 nặng | 2 nhẹ
state.c = null  (giai đoạn sau: ghi chú người chơi, bit0 "có thể nặng", bit1 "có thể nhẹ", bit2 "chắc thật")
initial.v = toàn 0;  solution.v = log của chiến lược tối ưu chống oracle + kết luận
```

Action: `{k:"weigh", L:[i…], R:[i…]}` (rời nhau, |L| = |R| ≥ 1, còn lượt) · `{k:"conclude", coin, heavy?}` · (sau) `{k:"autonote"}`.

### 6.3 Thuật toán

- `classes(puzzle, state)` → lớp U/H/L/G từng xu (mô phỏng log); `cls(weighing)` → (u1,h1,l1,g1 | u2,h2,l2,g2), triệt tiêu xu chuẩn trùng hai bên.
- `solvable(s, r, goal)` DP nhớ đệm trên `(u,h,l,min(g,u+h+l), r, goal)`; `need(s)` = r nhỏ nhất giải được; `best(s, r)` = phép cân an toàn có nhánh lớn nhất nhỏ nhất, hoà thì cân bằng entropy, hoà nữa thì thứ tự từ điển; ánh xạ lớp → chỉ số xu thấp nhất của mỗi lớp (tất định).
- Oracle: *fixed* — dấu khối lượng theo `secret`; *adv* — trong 3 kết quả có tập khả năng khác rỗng chọn max theo (need, |H|, rng). Bảo đảm: luôn nhất quán; người chơi có phép cân không an toàn ⇒ đối thủ giữ được ≥ 2 khả năng tới hết lượt.
- Ngân sách **cứng** k (hết lượt thì `weigh` → null, board báo "Hết lượt cân — hãy kết luận"). Thế thua: hint chỉ ra phép cân **đầu tiên** làm mất an toàn và gợi ý Hoàn tác.
- Độ khó: hàm của R = H0/3^k, tỉ lệ phép cân an toàn dọc chiến lược tối ưu, biến thể (`either` > `heavy`; `ref` giảm), `adv` cộng điểm — hiệu chỉnh để đạt bậc ≥ 90 % và đơn điệu (như các engine khác).

### 6.4 Gợi ý (ví dụ 12 xu, đầu ván)

- Mức 1: "Còn 24 khả năng và 3 lần cân. Mỗi lần cân có 3 kết quả nên sau lần này mỗi nhánh phải còn ≤ 9 khả năng — hãy chia thành ba nhóm khoảng 8." (`cells` = mọi xu chưa rõ)
- Mức 2: "Đặt 4 xu *chưa rõ* lên mỗi đĩa, để 4 xu ngoài."
- Mức 3: "Cân {1,2,3,4} với {5,6,7,8}." `why`: từng nhánh (lệch trái → 8 khả năng 1–4 nặng / 5–8 nhẹ, còn 2 lần ≥ đủ, có 4 xu chắc thật làm mốc…) + **vì sao phép khác hỏng** ("5 với 5: lệch → 10 khả năng > 9"; "3 với 3: thăng bằng → 6 xu = 12 khả năng > 9"). `action` = weigh.
- Đã đủ thông tin → "Hãy kết luận" / "Xu 7" / action conclude. Có kết luận sai → nói trước.

### 6.5 Hàm còn lại

`validate/solve/fromInput`: status `unique` = có chiến lược chắc chắn trong k (count 1), `none` = không (lời: "13 xu, 3 lần, không xu chuẩn: 26 ≤ 27 khả năng nhưng không chiến lược nào chắc chắn — tối đa (3^k−3)/2 = 12"). `replay` = chiến lược tối ưu chống oracle (mỗi bước có `why`). `trace` = `{kind:"tree"}` toàn bộ cây chiến lược (≤ 120 nút ở 40 xu/4 lần). `constraintView`: biến (xu giả, hướng), ràng buộc mỗi lần cân `dấu(Σtrái − Σphải) = kết quả`, số khả năng vs 3^k. `toText`: các dòng `khoá: giá trị` (`xu: 12`, `lần cân: 3`, `xu giả: nặng hoặc nhẹ`, `xu chuẩn: không`, `nói nặng/nhẹ: có`, `chế độ: cố định`, `mã: 7n`); `fromText` chấp nhận cả khoá ASCII (`n,k,fake,ref,dir,mode,secret`). `grade`: 3★ nếu thắng không hoàn tác (cố định) / đúng k* lần (đối thủ), 2★ nếu có hoàn tác hoặc gợi ý mức 3, 1★ còn lại. `describeCell`: "Xu 5, đã cân 2 lần (trái, ngoài)" (không lộ suy luận).

### 6.6 Board

SVG cân đòn (đòn nghiêng trái/phải/ngang sau khi cân, tắt chuyển động nếu `prefers-reduced-motion`); khay xu dạng lưới nút ≥ 44 px (n ≤ 40), chip chọn "Đặt vào: Trái | Phải | Ngoài" rồi chạm xu (phím L/R/0, mũi tên, Enter = Cân); nút **Cân** (vô hiệu + lý do: lệch số xu, đĩa trống, hết lượt), **Xoá đĩa**, **Kết luận…** (chọn xu + Nặng/Nhẹ); nhật ký "Lần 2: {1,2,3} ⚖ {4,5,9} → Trái nặng hơn" với biểu tượng hình (không chỉ màu); "Còn r/k lần cân". `highlight(cells)` = chỉ số xu. Trình soạn: n, k, loại xu giả, xu chuẩn, nói hướng, chế độ, xu giả (cố định) → `fromInput`, hiện "Có chiến lược chắc chắn / Không thể (giới hạn Dyson)".

---

## 7. CW2 `bachet` — Bộ quả cân ít nhất

Siêu dữ liệu: name "Quả cân Bachet", family "Mathematical Puzzle", category "Lý thuyết số", icon "🏋", `kind:"optimize"`, links `coin-change`, `meet-in-the-middle`, `bit-manipulation`.

- `sizes`: `hai` (mặc định, quả cân đặt được hai đĩa) · `mot` (chỉ một đĩa) · `dat` (đặt quả cân cho vật cho trước). Bậc → N: dễ N ≤ 13, vừa ≤ 40, khó ≤ 121 (N không phải biên → nhiều đáp án), chuyên gia ≤ 364 hoặc `dat` với bộ không phải luỹ thừa.
- **Chọn bộ** (`hai`/`mot`): `data = {pan:"two"|"one", N, slots:M = m*+2}`; `state.v` = M giá trị (0 trống, 1..N) + `v[M]` phán quyết (0 chưa nộp, 1 đạt, 2 thiếu). Action `{k:"set", i, val}`, `{k:"submit"}`. `check.solved` = `v[M] === 1` (phủ đủ 1..N); `grade` = số quả vs m* (3★ = m*, 2★ = m*+1, 1★ còn lại); `mistakes` = nộp khi chưa phủ. Kiểm phủ: DP bitset trên [−S, S], O(m·S).
  Lời giải dựng: hai đĩa {1,3,…,3^(m*−2), N − (3^(m*−1)−1)/2}; một đĩa {1,2,…,2^(m*−2), N − (2^(m*−1)−1)} (đều phủ liền mạch vì quả cuối ≤ 2R+1 / ≤ R+1).
  Hint: mức 1 "Với m quả, hai đĩa cân tối đa (3^m−1)/2 ⇒ cần ít nhất m*"; mức 2 "đang phủ liền 1..R; quả tiếp theo tối đa 2R+1 để không hở"; mức 3 đặt ô i = giá trị + vì sao; bộ hiện tại không thể hoàn thành với m* quả (DFS ≤ 6 quả) → nói trước, action xoá quả sai.
- **Đặt quả cân** (`dat`): `data = {W:[…], X:[x1..xq]}`; `state.v` = q·|W| vị trí (0 ngoài, 1 đĩa đối diện, 2 cùng đĩa với vật) + phán quyết; solved khi mọi vật thăng bằng và đã nộp; `grade` = Σ quả dùng vs Σ tối thiểu (DFS 3^|W|, |W| ≤ 7). Hint: tam phân cân bằng (với luỹ thừa 3) hoặc DFS.
- Board: hàng ô số (stepper + nhập `inputmode=numeric`), **dải phủ 1..N** (ô đạt/hở khác hoa văn), nút Nộp; chế độ đặt: mỗi vật một cân mini, chạm quả cân để xoay ngoài → đĩa kia → cùng đĩa.

---

## 8. CW3 `coinscale` — Cân điện tử

Siêu dữ liệu: name "Cân điện tử", family "Mathematical Puzzle", category "Lý thuyết số" (hoặc "Lý thuyết thông tin" — chờ quyết), icon "🔢", `kind:"interactive"`, links `meet-in-the-middle`, `gaussian-elimination`, `bitmask-dp`, `backtracking`.

| size | Nội dung | Mô hình | Tối ưu |
| --- | --- | --- | --- |
| `chong1` (mặc định) | S chồng, mỗi chồng c xu, **một** chồng giả nặng hơn δ đã biết | tương tác: `{k:"weigh", take:[số xu mỗi chồng]}` → số gam; `{k:"conclude", stack}` | k* = ⌈log_{c+1} S⌉ — **[lập luận]** mỗi lần cân chỉ có c+1 số đọc khả dĩ (đếm lá) và dựng được bằng mã cơ số c+1; c ≥ S−1 → 1 lần (script: S=10 đúng). Test F1 phải vét cạn S ≤ 9, c ≤ 3 |
| `chongN` | số chồng giả **bất kỳ**, đúng **1** lần cân, mỗi chồng ≤ c xu | tối ưu tĩnh: chọn số xu mỗi chồng có tổng con phân biệt | max nhỏ nhất = Conway–Guy 1,2,4,7,13,24 (S=1..6); `grade` theo max vs CG(S) |
| `hailoai` | n xu (10 g hoặc 9 g, số xu giả tuỳ ý), cân **thích nghi** | tương tác: `{k:"weigh", set:[…]}` → gam; `{k:"conclude", fake:[…]}` | A(n) = 1,2,3,3,4,4 (n=1..6), ngân sách = A(n), đối thủ minimax |
| `kehoach` | như trên nhưng **lập kế hoạch trước** (không thích nghi) | tối ưu tĩnh: ma trận m×n 0/1 | m(n) = 1,2,3,3,4,5,5 (n=1..7); `grade` = số hàng vs m(n) |

- State: như CW1 (khe log cố định độ dài + kết quả là số gam; kết luận) hoặc ma trận + phán quyết cho loại tĩnh. Đối thủ `hailoai`: chọn số đọc giữ tập vector nhất quán khó nhất (minimax nhớ đệm theo bitset ≤ 64 vector).
- Hint `kehoach`: chỉ ra **một cặp** vector khác nhau cho cùng số đọc ("xu 2 giả" và "xu 3 giả" đều cho …) → mức 3 thêm hàng tách được nhiều cặp nhất (tham lam, luôn kết thúc vì hàng đơn vị luôn tách; `grade` cho biết có tối ưu không).
- Board: chồng xu có stepper "lấy x xu" + màn hình số; `hailoai`: chạm xu để cho lên cân + màn hình; kết luận đánh dấu từng xu thật/giả; `kehoach`: lưới ô chọn m×n, thêm/xoá hàng, khung "cặp trùng" sống.

---

## 9. Danh sách việc (thứ tự phụ thuộc; mỗi việc = 1 lượt agent: cài + kiểm + `tao-pwa.py` nếu đụng tệp app)

Pha A — mở rộng hợp đồng: A1 → A5. Pha B — Lights Out P0/P1: B1 → B6. Pha C — CW1: C1 → C6. Pha D — Lights Out P2/P3: D1 → D6. Pha E — CW2: E1 → E3. Pha F — CW3: F1 → F5. Pha G — tích hợp: G1.
(Chi tiết từng việc ở đối tượng trả về; tóm tắt:)

| # | Việc | Tệp chính | Kiểm |
| --- | --- | --- | --- |
| A1 | conformance kiểm thuộc tính tuỳ chọn (`options`, `grade`, `kind`, `sizeLabel`, `moveLabel`) | `core/types.js`, `kiem/core.js` | `node kiem.js core` |
| A2 | `hint(...,settings)` + `record.grade` | `core/game.js`, `kiem/core.js` | `node kiem.js core` |
| A3 | `options` trong vỏ: chip ở Puzzle mới, `begin`, `seedHash` `o=`, đọc `q.o` | `ui/newgame.js`, `ui/app.js`, `ui/common.js` | `check.py --chuc-nang` (thêm phép cho loại có options sau C3) |
| A4 | Hộp thoại "Đã giải" hiện `grade`; nhãn `sizeLabel`/`moveLabel` | `ui/play.js`, `ui/newgame.js` | `check.py --chuc-nang` |
| A5 | Tài liệu mục 11 + `app-worker` vòng options + `check.py` tầng 3 `min(4, replay−1)` | `HUONG-DAN-ENGINE.md`, `kiem/app-worker.js`, `check.py` | `node kiem.js app`, `check.py --song-sot` |
| B1 | Mẫu vàng Lights Out | `kiem/lightsout.js` | `node kiem.js lightsout` |
| B2 | Bất biến (engine) | `puzzles/lightsout.js`, `kiem/lightsout.js` | vét cạn: y·A=0, y·b≠0; bàn vô nghiệm 4×4 |
| B3 | Bất biến (trình soạn tô ô) + mẫu im lặng trong constraintView/trace + bản đồ lời giải replay | `ui/boards/lightsout.js`, `puzzles/lightsout.js`, `check_board_lightsout.py` | `check.py --chuc-nang` |
| B4 | Hint đuổi đèn (engine) | `puzzles/lightsout.js`, `kiem/lightsout.js` | vòng hint-chase giải xong mọi bàn ≤ 7×7; bảng 5×5 kinh điển |
| B5 | Công tắc kiểu gợi ý trên bàn | `ui/boards/lightsout.js`, `check_board_lightsout.py` | `check.py --chuc-nang` |
| B6 | Par + `grade` Lights Out | `puzzles/lightsout.js`, `ui/boards/lightsout.js` | test sao |
| C1 | Lõi toán CW1 (lớp, DP, best, oracle) | `puzzles/coinbalance.js`, `kiem/coinbalance.js` | bảng Dyson + vét cạn n ≤ 5 |
| C2 | Đăng ký loại: state/action/moveFor/check/mistakes/newState/describeCell | như trên | đảo diff, đối thủ nhất quán, mistakes |
| C3 | generate/difficulty/sizes/options + validate/solve/fromInput + I/O; thêm `data-pz` | như trên + `index.html` | bậc ≥ 90 %, tất định, `node kiem.js app` |
| C4 | hint/replay/trace/constraintView | như trên | vòng hint cả hai chế độ, cây ≤ 600 |
| C5 | Board chơi | `ui/boards/coinbalance.js`, `css/board-coinbalance.css`, `index.html` | `check.py --chuc-nang --co-gian` |
| C6 | Trình soạn + `check_board_coinbalance.py` | như trên + `check_board_coinbalance.py` | `check.py --tat-ca` |
| D1 | Engine tổng quát luật/topo/ô khoá (mod 2) | `puzzles/lightsout.js`, `kiem/lightsoutx.js` | vét cạn hạt nhân 12 cấu hình, mẫu vàng giữ nguyên |
| D2 | GF(3), GF(5) + cache E + đuổi đèn mod p | như trên | 1400 bàn đuổi mod p, min Σx vét cạn nhỏ |
| D3 | Loại `lightsoutx` + options + sinh/hiệu chỉnh bậc | như trên | bậc ≥ 90 % mọi tổ hợp quảng cáo |
| D4 | Board k mức/ô khoá/xuyến (dùng chung board) | `ui/boards/lightsout.js`, `css/board-lightsout.css` | `check_board_lightsout.py` |
| D5 | Trình soạn biến thể + soạn bằng bấm | như trên | `check.py --chuc-nang` |
| D6 | Bàn lớn 12–20, zoom/cuộn, ngân sách hint | như trên | `check.py --co-gian --hieu-nang` |
| E1 | Engine `bachet` chọn bộ | `puzzles/bachet.js`, `kiem/bachet.js` | công thức N ≤ 40 vét cạn |
| E2 | `bachet` đặt quả cân + hint/grade | như trên | DFS vs vét cạn 3^|W| |
| E3 | Board + trình soạn + check | `ui/boards/bachet.js`, css, `check_board_bachet.py`, `index.html` | `check.py --tat-ca` |
| F1 | `coinscale` chồng xu (tương tác + tĩnh) | `puzzles/coinscale.js`, `kiem/coinscale.js` | giải mã cơ số c+1, CG(S) |
| F2 | `coinscale` hai loại thích nghi + kế hoạch | như trên | A(n), m(n) vét cạn độc lập |
| F3 | hint/replay/trace/IO cho cả 4 phiên bản | như trên | vòng hint, app-worker |
| F4 | Board coinscale | `ui/boards/coinscale.js`, css, `index.html` | `check.py --chuc-nang` |
| F5 | Trình soạn + `check_board_coinscale.py` | như trên | `check.py --tat-ca` |
| G1 | Daily ORDER (nếu duyệt), bàn giao, bộ nhớ, skill `ban-do-ung-dung` | `core/daily.js`, `tasks/2610/<ngày>/…/ban-giao.md` | `check.py --tat-ca` |

---

## 10. Rủi ro

1. Sửa vỏ chung (E1–E4) có thể làm hỏng 5 loại hiện có → chạy `check.py --tat-ca` sau A3/A4; liên kết seed cũ (không có `o=`) phải ra đúng puzzle cũ.
2. Refactor Lights Out đổi puzzle của seed cũ (Daily, yêu thích) → mẫu vàng (B1) trước mọi thay đổi engine; chỉ ghi trường biến thể khi khác mặc định.
3. Hiệu năng luồng chính: hint/moveFor chạy ngoài worker. Mod 3 20×20 khử 137 ms nếu không nhớ đệm; coinscale thích nghi n=7 chứng minh thua 14 s → giới hạn n ≤ 6.
4. Chế độ cố định không giữ bí mật (JSON, devtools, `toText`) — chấp nhận, ghi rõ.
5. Hoàn tác ở chế độ cố định cho phép "câu" kết quả → chỉ phạt qua `grade`, không chặn (giữ vòng đời chung).
6. Độ khó loại mới không có chuẩn công bố → hiệu chỉnh theo đo; danh sách bậc quảng cáo có thể đổi.
7. Màu riêng `--pz-<id>-*` phải đạt 4,5:1 (check.py tầng 1 chỉ đo `--pz-*` chung).
8. Dung lượng: +3 engine +3 board ước ~150–250 KB **[suy đoán]**, vẫn < 2 MB.
9. Chưa thử máy thật (như bàn giao cũ); cân đòn có hoạt hình — kiểm `prefers-reduced-motion`.
10. Kết quả "[tài liệu]" (tiệm cận 2n/log2 n, Conway–Guy) chỉ dùng trong lời giải thích, không dùng làm nguồn sự thật của test.

## 11. Lệnh kiểm

```
node backend/fastapi/webapp/tranphuc8a/logic-puzzle-suite/kiem.js core
node backend/fastapi/webapp/tranphuc8a/logic-puzzle-suite/kiem.js app
node backend/fastapi/webapp/tranphuc8a/logic-puzzle-suite/kiem.js lightsout     # + lightsoutx, coinbalance, bachet, coinscale
backend/fastapi/.venv/Scripts/python.exe backend/fastapi/webapp/tranphuc8a/logic-puzzle-suite/tao-pwa.py
backend/fastapi/.venv/Scripts/python.exe backend/fastapi/webapp/tranphuc8a/logic-puzzle-suite/check.py --tinh
backend/fastapi/.venv/Scripts/python.exe backend/fastapi/webapp/tranphuc8a/logic-puzzle-suite/check.py --chuc-nang
backend/fastapi/.venv/Scripts/python.exe backend/fastapi/webapp/tranphuc8a/logic-puzzle-suite/check.py --co-gian
backend/fastapi/.venv/Scripts/python.exe backend/fastapi/webapp/tranphuc8a/logic-puzzle-suite/check.py --tat-ca
node <scratch>/puzzle-lo-coin/cw1.js   # (và cw2.js, cw3.js, lo.js, lo2.js, lo3.js) — đối chiếu công thức
```

## Phụ lục — trích kết quả script

```
cw1.js  : k=3 → 27 | 12 (n lỗi [1,2]) | 13 | 13 (n lỗi [2]) | 14 ; k=4 → … | 39 | 40 | 40 | 41 ; vét cạn n≤5,k≤3: 90 trường hợp, lệch 0
          12 xu/3 lần: phép cân đầu an toàn 1/6 ; 39/4: 1/19 ; 13+chuẩn/3: 2/20
cw1time : 39 xu/4 lần 23 ms ; 40+chuẩn/4 25 ms ; 40/4 (không được) 5 ms ; 81 biết nặng/4 3 ms
cw2.js  : công thức đúng N=1..40 ; N=40 hai đĩa duy nhất {1,3,9,27} ; N=30 hai đĩa 88 bộ ; N=15 một đĩa duy nhất {1,2,4,8}
cw3.js  : m(n) n=1..7 = 1,2,3,3,4,5,5 (n=7: 27,9 s) ; A(n) n=1..5 = 1,2,3,3,4 ; cw3c: A(6)=4 (71 ms) ; cw3d: cây 6 xu 0/64 sai ; cw3e: A(7)=5
lo.js   : nhân n=2..20 = 0,0,4,2,0,0,0,8,0,6,0,0,4,0,8,2,0,16,0 ; bàn sáng hết 3..7 = 5,4,15,28,33 ; khử 20×20 mod3 137 ms
lo2.js  : 12/12 cấu hình hạt nhân khớp vét cạn ; lo3.js: đuổi đèn mod p 1400 đạt, 0 lỗi
```
