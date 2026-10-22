# Logic Puzzle Suite — puzzle TỐI ƯU HOÁ: "Lạc đà chở chuối" + "Đi bộ & xe máy" (bản thiết kế, chưa sửa mã)

Vùng: `backend/fastapi/webapp/tranphuc8a/logic-puzzle-suite` (gọi tắt `LPS/`). Ngày 23/10/2026. Pha HIỂU + THIẾT KẾ — chưa đụng tệp nào trong repo.
Mọi con số dưới đây có ghi **[đã kiểm]** là kết quả chạy script nháp ở
`C:/Users/tranphuc8a/AppData/Local/Temp/claude/c--Users-tranphuc8a-Desktop-gemini-proxy/2fd2853d-4c94-4034-a078-2b6358d957ee/scratchpad/puzzle-camel-bike/`
(`camel.js`, `camel-big.js`, `camel-lb2.js`, `camel-plan.js`, `camelN.js`, `camelN3.js`, `convoy.js`, `bike.js`, `bike-search2.js`, đầu ra `*.out`). Ghi **[suy đoán]** là chưa chứng minh/chưa chạy.

---

## 0. Tóm tắt

- Thêm 2 loại puzzle mới theo đúng hợp đồng `HUONG-DAN-ENGINE.md`: **`camel`** (Lạc đà chở chuối, V1 một con: "đi xa nhất" và "chở tới đích D"; V2 đoàn N con: "một chiều" và "phải về") và **`motorbike`** (Đi bộ & xe máy).
- Cả hai là puzzle **tối ưu hoá**: không có đúng/sai, mà có **giá trị** (km, số chuối, giờ) so với **tối ưu**. Cần một mở rộng hợp đồng nhỏ, tổng quát: `def.goal = "optimize"` + `def.objective`, `check()` trả thêm `value/best/quality`, ván kết thúc khi người chơi **Nộp** kế hoạch (action `submit`), `game.record()` ghi `quality`. Trạng thái = **kế hoạch** mã hoá thành mảng số nguyên dung lượng cố định (helper chung `core/plan.js`).
- Toán đã kiểm bằng script:
  - Lạc đà V1: dạng đóng liên tục + **QHĐ rời rạc theo km** (tối ưu đúng — khớp vét cạn mọi kế hoạch ở 17+10 bộ nhỏ). Ví dụ kinh điển 3000/1000/1000: liên tục 533⅓, **rời rạc 533**; xa nhất 1533⅓ / **1533**.
  - **Bộ đánh giá LB2** (tối ưu còn đạt được từ trạng thái BẤT KỲ, kèm kế hoạch cụ thể) — khớp vét cạn trên **638 407** trạng thái đạt được + 1 500 trạng thái giữa chừng, 0 lệch. Đây là nền cho gợi ý "đúng và có ích".
  - Lạc đà V2: một chiều **C·H_N = C(1+1/2+…+1/N)**; phải về **C(1+1/3+…+1/(2N−1))** (bằng đúng bài 1 con chở N·C!). Vét cạn khớp ở N=2 (C=2…6), N=3 (C=6 một chiều = 11); mô phỏng chiến lược đến N=6.
  - Xe máy (cách hiểu A — người lái trong nhóm): cận dưới LP **chặt**: m ≥ 3 → đưa-đón, T* = (m(2g−1)+1)/(m(m+2g−1)), g = n/k − 1; m ≤ 3 → tiếp sức bỏ xe, T* = 1 − (2k/n)(1 − 1/m). Khớp LP ở 88 bộ (n,k,m), mô phỏng hữu tỉ ra **đúng từng phân số**. **"Bỏ xe thường tốt hơn" là SAI khi m > 3** (xe máy thật m ≈ 6–8 → đưa-đón thắng).
- Thứ tự cài: mở rộng hợp đồng → engine camel (2 việc) → bàn camel → engine motorbike (2 việc) → bàn motorbike → camel V2 → tích hợp. 11 việc, mỗi việc một lượt agent.

---

## 1. Hiện trạng (đã đọc, có dẫn chứng)

> Lưu ý: `codegraph explore "Puz.types.register conformance game.record …"` trả về ký hiệu của `wukong-xiangqi-main` (không đúng vùng) — chỉ mục chưa phủ tốt app này, nên tôi đọc trực tiếp tệp.

| Điều | Dẫn chứng |
| --- | --- |
| Thêm loại = 1 engine thuần `puzzles/<id>.js` + test `kiem/<id>.js` + board `ui/boards/<id>.js` + css + `check_board_<id>.py`; vỏ tự nhận qua `Puz.types.all()` | `LPS/HUONG-DAN-ENGINE.md` mục đầu + mục 10 |
| 19 hàm bắt buộc, 10 thuộc tính bắt buộc; không có khái niệm "tối ưu" | `LPS/assets/js/core/types.js:9-11`, `:13-28` |
| state = `{v:[số nguyên nhỏ], c}`; mọi thao tác là diff `[trường, i, cũ, mới]`, undo = hàm ngược | `LPS/assets/js/core/game.js:15-21` (applyDiff), `HUONG-DAN-ENGINE.md` mục 1 |
| `act()` tự kết thúc ván ngay khi `check().solved` | `game.js:69-84` (dòng 82 `if (chk.solved) finish("solved")`), `:97` (redo) |
| Bản ghi lịch sử chỉ có time/mistakes/hints/moves/result — không có "chất lượng" | `game.js:139-144` |
| Reveal = `diffTo(solution.v)` rồi `finish("revealed")` ⇒ `solution` phải cùng hình dạng `state.v` | `game.js:122-130` |
| Hộp thoại "Đã giải" có đúng 4 ô Thời gian/Lỗi/Gợi ý/Độ khó; chip HUD "Số lần điền sai" | `LPS/assets/js/ui/play.js:89`, `:58`, `:174` |
| Màn Tạo puzzle gắn nhãn cứng "Có đúng một nghiệm / nhiều nghiệm / vô nghiệm" theo `status` | `LPS/assets/js/ui/create.js:8-10`, `:36-44` |
| Worker chỉ nạp tệp có `data-pz`; test mô phỏng worker đòi `check(replay…).solved` | `LPS/index.html:108-122`, `LPS/kiem/app-worker.js:19`, `:37` |
| `check.py` vòng đời chung mọi loại: gợi ý mức 3 "Áp dụng" = **1 nước**; lặp gợi ý tới `solved` (≤ 700); hộp thoại phải có 4 chữ trên | `LPS/check.py:330`, `:287-293`, `:362-367` |
| Daily xoay vòng theo `ORDER` cố định, chỉ số = ngày mod `ORDER.length` | `LPS/assets/js/core/daily.js:7`, `:27` |
| Matrix của `trace` hiển thị `String(v)` ⇒ ô chuỗi ("13/25") được | `LPS/assets/js/ui/treeview.js:62-75` |
| Spec gốc: "Optimization Puzzle" thuộc nhóm QHĐ (#25); V2 liệt kê "Lạc đà chở chuối đi xa nhất", "Phối hợp chia sẻ xăng cho xe đi xa nhất", "Nhóm n người đi bộ có thêm xe máy tới đích nhanh nhất" | `tasks/my-apps/app-8.md:635`, `:798-826` |
| Bàn giao 17/10: 5 loại, 929 phép `kiem.js`, `check.py --tat-ca` 830 đạt; sửa tệp nào cũng chạy `tao-pwa.py` | `tasks/2610/261017/logic-puzzle-suite/ban-giao.md` mục 1, 5, 7 |
| Algorithm Notebook KHÔNG có mục LP/simplex hay bài jeep; có `ternary-search`, `gaussian-elimination`, `binary-search`, `coin-change` | `grep id:` trên `algorithm-notebook/assets/data/lib-*.js` |

---

## 2. Phát hiện

1. **[cao] Hợp đồng chưa có puzzle "chấm điểm".** `solved` ⇒ kết thúc ngay (`game.js:82`), lịch sử không có chất lượng (`game.js:139-144`), nhãn trình soạn nói "nghiệm" (`create.js:8-10`). Cần mở rộng nhỏ (mục 3) — chạm 4 tệp lõi/vỏ.
2. **[cao] Gợi ý cho puzzle tối ưu cần biết "từ đây còn đạt tối ưu không".** Với lạc đà, tôi tìm được bộ đánh giá **LB2** chính xác trên mọi trạng thái đã thử (0/638 407 lệch) — gợi ý luôn là một kế hoạch thật (đã mô phỏng), "mất tối ưu" được phát hiện và sửa bằng **quay về bước j** (action `truncate`). Với xe máy, tối ưu từ một kế hoạch dở dang tổng quát khó ⇒ gợi ý theo **lịch mẫu, khớp tiền tố bất biến đổi tên** (nói rõ giới hạn).
3. **[cao] Rời rạc ≠ liên tục.** Bộ số kinh điển 3000/1000/1000 cho 533⅓ (liên tục) nhưng **533** (km nguyên); C nhỏ lệch nặng (B=6, C=2: rời rạc 2 so với 3,07) **[đã kiểm]**. ⇒ Bộ sinh chọn C là bội của bội chung nhỏ nhất các số lẻ 1,3,…,2k−1 (15, 105, 315…) để hai đáp án trùng nhau; đề tự nhập vẫn chấm theo tối ưu rời rạc (đúng luật km nguyên) và giải thích phần ⅓.
4. **[cao] Giả thuyết "mẹo bỏ xe thường tốt hơn" sai với xe máy.** Theo LP (chặt): bỏ xe/tiếp sức chỉ tối ưu khi **m ≤ 3**; m > 3 thì đưa-đón (một người lái chạy liên tục) tốt hơn; m = 3 hoà. Ví dụ n=4, k=1, m=5: đưa-đón 31,2 phút, tiếp sức 36 phút **[đã kiểm]**. (Xe đạp ≈ 15 km/h so với đi bộ 5 km/h ⇒ m ≈ 3 — đúng ngưỡng.)
5. **[vừa] Trường hợp không chia hết chưa có tối ưu đóng.** n=5, k=1, m=2: cận LP 0,8 giờ; tìm kiếm có cấu trúc tìm được lịch **lai** 0,824 (tốt hơn cả đưa-đón 0,833 lẫn tiếp sức) **[đã kiểm, lưới 1/48]** ⇒ tối ưu thật nằm trong [0,8; 0,824]. Bộ sinh chỉ phát đề chia hết (k | n khi m ≥ 3; 2k | n khi m ≤ 3); đề tự nhập không chia hết → cảnh báo "chỉ biết cận dưới".
6. **[vừa] Lạc đà V2 "phải về" = bài 1 con chở N·C** (cùng C·Σ1/(2i−1)); "một chiều" lớn hơn (C·H_N). Chiến lược "phải về" cần **kho dọc đường** cho con quay về (hoặc con trước chờ) **[đã kiểm bằng mô phỏng số nguyên]**.
7. **[vừa] Ràng buộc của test sẵn có** buộc thiết kế: lời giải (`solution.v`) phải chứa cờ "đã nộp" để `check(replay).solved` (`app-worker.js:37`) và Reveal; gợi ý mức 3 cuối cùng phải là `submit` để `solve_by_hints` kết thúc (`check.py:287-293`); hộp thoại giữ 4 chữ cũ và thêm "Chất lượng" (`check.py:367`).
8. **[thấp] Daily**: thêm id vào `ORDER` làm đổi `n % ORDER.length` ⇒ đổi lịch Daily các ngày tương lai (`daily.js:27`). Vùng coin weighing cũng có thể thêm ⇒ cần chốt thứ tự một lần.
9. **[thấp] Số hữu tỉ chính xác cho xe máy cần `BigInt`** (mẫu số nhân lên qua mỗi lần "gặp"). Không phải thư viện; có từ Chrome 67/Firefox 68/Safari 14. Viết dạng `BigInt(x)` (không dùng literal `1n`) để giữ cú pháp ES5 như phần còn lại.

---

## 3. Mở rộng hợp đồng: puzzle tối ưu hoá (`goal: "optimize"`) — tối thiểu, tổng quát

### 3.1 Siêu dữ liệu (tuỳ chọn; vắng = "solve", hành vi cũ giữ nguyên)

```js
goal: "optimize",
objective: { sense: "max" | "min", label: "Quãng đường xa nhất", unit: "km" },
mistakeLabel: "Nước làm mất tối ưu"      // tuỳ chọn, cho chip HUD (mặc định "Số lần điền sai")
```
`types.js`: thêm `GOALS = ["solve", "optimize"]`; `conformance` báo lỗi nếu `goal` lạ, hoặc `goal === "optimize"` mà thiếu `objective.sense ∈ {max,min}` / `objective.label`. Danh sách 19 hàm KHÔNG đổi (puzzle tối ưu vẫn cài đủ).
Vùng coin weighing nếu cần "tương tác với đối thủ" thì thêm giá trị `goal` khác (vd `"interactive"`) — vỏ chỉ rẽ nhánh theo `"optimize"`; "số lần cân so với tối ưu" của họ cũng dùng được đúng cơ chế `quality` này.

### 3.2 Trạng thái = kế hoạch (`core/plan.js`, ~60 dòng, có `data-pz`)

```
state.v = [ submitted (0|1), len, rec_0 (W số), rec_1 (W số), …, rec_{cap−1} ]     // độ dài cố định 2 + cap·W, ô thừa = 0
state.c = null
```
API thuần: `Puz.plan.layout(cap, W)`, `read(state, W) → [[…W số]…]`, `appendDiff(state, W, cap, recs, label) → diff|null` (null nếu tràn), `truncateDiff(state, W, n, label)` (đặt len và xoá về 0 phần sau — trạng thái luôn chuẩn), `submitDiff(state)`. Vì độ dài cố định nên `applyDiff/reverseDiff/diffTo` (`game.js:15-29`) dùng y nguyên, undo/redo/tự lưu/replay chạy như cũ. Engine nào cũng dùng (và coin weighing — dãy lần cân — dùng được).

### 3.3 Action chung + `check()`

- `{k:"submit"}` → diff `v[0]: 0→1` (chỉ khi `complete`). `{k:"truncate", n}` → quay kế hoạch về n bước (gợi ý dùng; người chơi dùng qua nút "Quay về sau bước i"). Action riêng của từng loại thì thêm bản ghi.
- `check(puzzle, state)` của loại tối ưu trả thêm:
  ```
  { solved, conflicts: [], filled: len, total: <số bước của kế hoạch tối ưu>,
    complete: bool, value: number|null, best: number, quality: 0..1 (3 chữ số),
    valueText: "1 480 km", bestText: "1 533 km" }
  ```
  `solved = submitted && complete`. `quality = value/best` (max) hoặc `best/value` (min); `best = 0` thì `quality = value === 0 ? 1 : 0`… (lạc đà "chở tới D" có thể tối ưu = 0 ở đề tự nhập).

### 3.4 Ngữ nghĩa các hàm còn lại cho loại tối ưu (ghi vào `HUONG-DAN-ENGINE.md` mục 11 mới)

| Hàm | Ngữ nghĩa |
| --- | --- |
| `solution` | MỘT kế hoạch tối ưu + `submitted = 1` (Reveal điền nó; `check(solution).solved === true`, `quality === 1`) |
| `validate/fromInput.status` | `"unique"` = biết **chính xác** giá trị tối ưu; `"multiple"` + `warnings` = chỉ biết cận (vd xe máy không chia hết). `count` = 1. Mới (mọi loại dùng được): `statusText`, `statusKind` (`ok|warn|bad`) để vỏ không in "Có đúng một nghiệm" |
| `mistakes(p, s, diff)` | số nước làm **mất tối ưu** nếu engine xác định chắc chắn (lạc đà: LB2 trước = best, sau < best); không xác định được thì 0 (xe máy) |
| `hint` | "Sai" = trạng thái không còn đạt tối ưu ⇒ hint nói trước, `action = {k:"truncate", n: j}` với j = tiền tố dài nhất còn đạt tối ưu; còn đạt ⇒ nước kế tiếp của một kế hoạch tối ưu; đã đạt giá trị tối ưu ⇒ mức 3 là `{k:"submit"}`. `cells` = **chỉ số bước** trong kế hoạch (board tô bước), `regions.positions` = vị trí trên trục để tô |
| `replay` | các bước của `solution`, mỗi diff = 1 "chuyến"/1 lệnh có lời giải thích; bước cuối "Nộp kế hoạch" |
| `describeCell(p, s, i)` | mô tả bước i ("Bước 3: đi tới km 200, còn chở 800 quả") |

### 3.5 Thay đổi lõi/vỏ (ít nhất có thể)

| Tệp | Thay đổi |
| --- | --- |
| `core/types.js` | `GOALS`, kiểm `goal/objective` trong `conformance` (+ xuất `GOALS`) |
| `core/plan.js` (mới, `data-pz`) | helper 3.2 |
| `core/game.js` `record()` | nếu `type.goal === "optimize"`: `rec.quality`, `rec.value` từ `type.check(puzzle, g.state)` (3 dòng). Bản ghi cũ không đổi |
| `ui/play.js` | chip HUD dùng `def.mistakeLabel` nếu có; dòng trạng thái + hộp thoại thêm ô **"Chất lượng"** ("96 % — 1 480/1 533 km", "Tối ưu!" khi 1) — vẫn giữ 4 ô cũ |
| `ui/create.js` | `var st = r.statusText ? [r.statusKind || "ok", r.statusText] : STATUS[r.status];` |
| `index.html` | thẻ `data-pz` cho `core/plan.js`, `puzzles/camel.js`, `puzzles/motorbike.js`; thẻ board + css |
| `HUONG-DAN-ENGINE.md` | mục 11 "Puzzle tối ưu hoá" (3.1–3.4 + test bắt buộc 3.6) |
| `kiem/core.js` (hoặc `kiem/core-plan.js`) | test `plan.js` (append/truncate/hoàn tác), `conformance` với `goal`, `record().quality` |
| `core/stats.js`/`statsview.js` | *(để sau, tuỳ chọn)* chất lượng trung bình, số ván đạt tối ưu |

### 3.6 Test bắt buộc thêm cho loại tối ưu
(a) `check(solution)` solved & quality 1; (b) **giá trị tối ưu đối chiếu nguồn độc lập** (vét cạn cỡ nhỏ / LP / mô phỏng hữu tỉ viết riêng trong test); (c) vòng "hint 3 → áp dụng" từ trạng thái đầu VÀ từ trạng thái có chèn nước làm mất tối ưu ⇒ kết thúc `solved` với **quality = 1**; (d) mọi diff (append/truncate/submit) hoàn lại bằng `reverseDiff`; (e) kế hoạch đầy dung lượng → `moveFor` trả null, không ném.

---

## 4. Lạc đà chở chuối (`camel`)

### 4.1 Luật chính xác (V1 — một lạc đà) — đề xuất mặc định

1. Trục một chiều, vị trí là **số km nguyên** 0 (A), 1, 2, …; chuối là số nguyên quả. Lúc đầu ở A có **B** quả, lạc đà ở A, không chở gì.
2. Lạc đà chở tối đa **C** quả. Mỗi km nó đi (tới hay **quay về** đều vậy) nó **ăn 1 quả lấy từ chính số nó đang chở**; không đủ chuối để ăn cho quãng định đi thì không đi được. (Biến thể "chỉ ăn khi có chở" — xem câu hỏi 2.)
3. Ở km bất kỳ (kể cả A) được **đặt** bớt chuối xuống thành kho hoặc **lấy** chuối từ kho tại chỗ (không vượt C). Kho không hỏng, không ai ăn.
4. Mục tiêu (2 chế độ, chọn ở "cỡ"): **Đi xa nhất** — điểm xa A nhất lạc đà từng tới; **Chở tới đích D** — số chuối có ở km D (kho D + phần đang chở nếu đứng ở D) khi nộp.
5. "Chuối bỏ lại" = chuối nằm ở kho sau lưng không bao giờ được gom (chỉ hiển thị, không phạt riêng).

### 4.2 Lời giải

**Chặn trên (lập luận luồng) — đúng cho mọi kế hoạch.** Xét đoạn [x, x+1]. Lạc đà bắt đầu bên trái, kết thúc bên phải ⇒ đi qua theo chiều tới f lần, chiều lùi f−1 lần. Mỗi lượt tới chở ≤ C và ăn 1 trên đoạn; mỗi lượt lùi phải mang ≥ 1 quả (để ăn). Gọi S_x là số chuối có thể dồn tới x. Lượng dồn sang x+1:
```
S_{x+1} ≤ g(S_x),   g(S) = max_{f ≥ 1} [ min(S, f·C) − (2f − 1) ]
```
`g` không giảm ⇒ **tham lam theo từng km là tối ưu** (luôn giữ S lớn nhất); và đạt được bằng đưa-đón. Vậy:
- Rời rạc (luật 4.1): S_0 = B, S_{x+1} = g(S_x); **xa nhất** = max_x (x + min(S_x, C)); **tới D** = S_D. `g` tự quyết định *bỏ lại* phần thừa (min(S, fC)) — vd S = 1001, C = 1000 thì bỏ 1 quả, đi 1 chuyến (999) tốt hơn 2 chuyến (998).
- Liên tục (dạng đóng): khi S ∈ ((k−1)C, kC] cần k = ⌈S/C⌉ chuyến ⇒ tiêu **2k−1 quả/km**; pha k kéo dài tới khi S rơi xuống (k−1)C:
  ```
  độ dài pha đầu  L_k = (B − (k−1)C)/(2k − 1)        (k = ⌈B/C⌉)
  các pha sau     C/(2j − 1),  j = k−1, …, 1
  xa nhất         = (B − (k−1)C)/(2k−1) + C·(1 + 1/3 + … + 1/(2k−3))      (B = kC ⇒ C·Σ_{j≤k} 1/(2j−1))
  tới D           : đi các pha cho tới D, trừ (2j−1)·(quãng còn lại) ở pha chứa D
  ```
  Đây chính là "bài jeep vượt sa mạc" (một chiều) với nhiên liệu = chuối.
- Hai đáp án trùng nhau khi mọi ranh giới pha là số nguyên: C chia hết cho lcm(1,3,…,2k−1) (k=2: 3; k=3: 15; k=4: 105; k=5: 315) và B − (k−1)C chia hết cho 2k−1.

**Kiểm [đã kiểm]:** vét cạn MỌI kế hoạch rời rạc (trạng thái chuẩn hoá, đồ thị không chu trình vì mỗi km ăn 1) khớp QHĐ ở 17 bộ "xa nhất" (B ≤ 15, C ≤ 6) + 7 bộ lớn hơn (18/6 … 27/9; bộ 27/9 có 301 633 trạng thái) + 11 + 5 bộ "tới D" — `camel.out`, `camel-big.out`, `camel-lb2.out`.

### 4.3 Ví dụ số [đã kiểm — `camel.out`, `camel-plan.out`]

| B / C (/ D) | Liên tục | Rời rạc (luật game) | Pha (liên tục) | Số bước kế hoạch gọn |
| --- | --- | --- | --- | --- |
| 3000 / 1000, xa nhất | 4600/3 ≈ 1533,33 | **1533** | 3 chuyến × 200 · 2 × 333⅓ · 1 × 1000 | 20 |
| 3000 / 1000 / D=1000 | 1600/3 ≈ 533,33 | **533** | ranh giới 200, 533⅓ | 21 |
| 2500 / 1000 / D=1000 | 1300/3 ≈ 433,33 | 433 | 3ch [0→100], 2ch [100→433⅓] | 21 |
| 30 / 15, xa nhất | 20 | 20 | 2 × 5 · 1 × 15 | 9 |
| 30 / 15 / D=10 | 10 | 10 | | 10 |
| 45 / 15, xa nhất | 23 | 23 | 3 × 3 · 2 × 5 · 1 × 15 | 20 |
| 45 / 15 / D=15 | 8 | 8 | ranh giới 3, 8 | 21 |
| 40 / 15, xa nhất (pha đầu lẻ) | 22 | 22 | 3 × 2 · 2 × 5 · 1 × 15 | 20 |
| 420 / 105, xa nhất | 176 | 176 | 4×15 · 3×21 · 2×35 · 1×105 | 35 |
| 1575 / 315, xa nhất | 563 | 563 | 5×35 · 4×45 · 3×63 · 2×105 · 1×315 | 54 |
| 1575 / 315 / D=300 | 263 | 263 | | 55 |
| 100 / 30, xa nhất | 332/7 ≈ 47,43 | 47 | 4 × 10/7 · … | 35 |

Kế hoạch tối ưu 3000/1000 tới D (rời rạc): 3 chuyến tới km 200 (lấy 1000, đi 200, để 600, về; lần 3 không về) ⇒ 2000 ở km 200; 2 chuyến tới km 533 (lấy 1000, đi 333, để 334, về; lấy 1000, đi 333 ⇒ 667+334 = 1001) ⇒ **bỏ lại 1**, chở 1000 đi 467 km ⇒ 533.

### 4.4 Bộ đánh giá LB2 — "từ trạng thái này còn đạt tối đa bao nhiêu, và đi thế nào"

Trạng thái chuẩn hoá: (p, d[]) — gộp phần đang chở vào kho tại p (đổi chở ↔ kho tại chỗ không tốn gì). Hành trình ứng viên: **p → R → L → quét**, với R ∈ {p} ∪ {kho phía phải p}, L ∈ {p} ∪ {kho phía trái p}:
1. *Đi tới R* (lấy thức ăn phía phải khi không đủ để lùi): đoạn tới [x,x+1] ăn 1 quả lấy ở **vị trí nhỏ nhất còn chuối trong [p..x]**.
2. *Lùi về L* (gom kho cũ): đoạn lùi [x−1,x] ăn 1 quả lấy ở **vị trí nhỏ nhất còn chuối trong [x..R]**. Kiểm sức chở C cả hai chiều.
3. *Quét từ L* bằng QHĐ `S_{x+1} = g(S_x) + d[x+1]` (kho phía trước được cộng khi đi qua).
Giá trị = max qua mọi (R, L) (với "xa nhất": thêm max(R, điểm xa đã tới)). Độ phức tạp O(#kho² · M) — 12 ms ở B=3000, C=1000, M=1535 có 5 kho **[đã kiểm]**.
LB2 là **kế hoạch dựng được** (luôn ≤ tối ưu thật). **[đã kiểm]** LB2 = tối ưu vét cạn trên **mọi** trạng thái đạt được của 15 bộ (638 407 trạng thái, `camel-lb2.out`); và 4 000 tiền tố ngẫu nhiên (1 500 so vét cạn) — kế hoạch tiếp nối sinh ra **chạy bằng bộ mô phỏng luật** ra đúng giá trị dự đoán 4000/4000 (`camel-plan.out`). Bản LB1 (chỉ lùi, không "đi tới lấy thức ăn") sai ở 45 trạng thái — lý do có bước R. Chưa có chứng minh hình thức **[suy đoán: đúng tổng quát]** ⇒ hint dùng LB2 theo cách an toàn: chỉ khẳng định "còn đạt tối ưu" khi LB2 = best (chắc chắn đúng vì là kế hoạch thật); khi LB2 < best thì quay về tiền tố cuối có LB2 = best (luôn tồn tại vì trạng thái đầu có LB2 = best) và nói "bộ gợi ý không tìm được đường tới tối ưu từ đây". Tiền tố "còn tối ưu" là tính chất đơn điệu ⇒ **tìm nhị phân** (≤ 8 lần LB2 cho 160 bước).

### 4.5 Kế hoạch gọn (chặng theo pha) — dùng cho `solution`, `replay`, gợi ý mức 3

Từ đống S ở x (lạc đà ở x, chuẩn hoá): f = số chuyến QHĐ chọn; kéo dài chặng ℓ km khi f không đổi, không gặp kho giữa đường, chuyến đầy đi-về được (f>1 ⇒ 2ℓ ≤ C), chuyến cuối đủ ăn (P − (f−1)C ≥ ℓ, P = min(S, fC)). Mỗi chặng: (f−1) × [LẤY C, ĐI y, ĐẶT C−2ℓ, ĐI x] + [LẤY P−(f−1)C, ĐI y, ĐẶT phần dư]. Kết quả bằng QHĐ theo km. **[đã kiểm]** 3 000 bộ (B, C, D) ngẫu nhiên: mô phỏng = QHĐ, 0 sai, nhiều nhất 78 bước (`camel-plan.out`) ⇒ dung lượng kế hoạch **cap = 160 bước** đủ.

### 4.6 Engine `assets/js/puzzles/camel.js`

- Đăng ký: `id:"camel"`, `name:"Lạc đà chở chuối"`, `family:"Mathematical Puzzle"`, `category:"QHĐ"`, `icon:"🐪"`, `goal:"optimize"`, `objective` theo chế độ (max km / max quả), `mistakeLabel:"Nước làm mất tối ưu"`.
- `sizes`: `far` "1 lạc đà — đi xa nhất" (default, 4 bậc) · `deliver` "1 lạc đà — chở tới đích D" (4 bậc) · *(việc 10)* `convoy` "Đoàn lạc đà — một chiều" · `convoy-return` "Đoàn lạc đà — phải về".
- `puzzle.data = { mode, camels:1, B, C, D|null, cap:160, maxX, best, bestCont:"4600/3", phases:[{loads, from, to}] }`; `initial.v = [0, 0, 0…]` (2 + 160×3 số); bản ghi bước W = 3: `[lạc đà, op, đối số]`, op 1 = ĐI tới x, 2 = LẤY n, 3 = ĐẶT n (chỉ số lạc đà để V2 dùng chung định dạng, V1 luôn 0).
- Action: `{k:"step", op, n|x}` · `{k:"trip", to}` (macro "chuyến tiếp tế": lấy đầy, đi tới, để lại phần thừa giữ đủ ăn để về, về — 1 diff) · `{k:"run"}` (đi hết sức về phía trước) · `{k:"truncate", n}` · `{k:"submit"}`. `moveFor` mô phỏng kế hoạch mới; không hợp lệ ⇒ null. Lý do lỗi cho board: hàm phụ thuần `def.sim.preview(puzzle, state, action) → {ok, error, after}` (board gọi trực tiếp, không cần sửa vỏ).
- `generate(seed, {sizeId, tier})`: chọn họ tham số theo bậc (tất định qua `rng.fork`), tất cả **ranh giới nguyên** ⇒ rời rạc = liên tục:

  | Bậc | Họ tham số (ví dụ) | Điểm (công thức gợi ý, chỉnh khi cài) |
  | --- | --- | --- |
  | Dễ | k=2: C = 3t (6…30), B = 2C | `1 + 1,7(k−1) + 1,4·[pha đầu lẻ] + 0,6·[tới D] + 1,5·[ranh giới không nguyên]` |
  | Vừa | k=3: C = 15t (15…60), B = 3C | ⇒ Dễ 2,7–3,3; Vừa 4,4–5,0 |
  | Khó | k=3 pha đầu lẻ (B = 2C + 5r) hoặc k=4 (C=105, 210) | 5,8–6,7 |
  | Chuyên gia | k=5 (C=315) hoặc k=4 pha đầu lẻ hoặc bộ "không nguyên" kiểu 3000/1000 (phải bỏ lại chuối) | ≥ 7,5 |

  D (chế độ tới D) chọn sau ranh giới pha cuối và < xa nhất để mọi pha đều cần. Điểm là hàm tất định của (k, pha lẻ, chế độ, không nguyên) ⇒ đạt bậc ~100 %, đơn điệu.
- `fromInput({mode, B, C, D})`: số nguyên, giới hạn B ≤ 20 000, C ≤ 2 000, maxX ≤ 5 000 (để LB2 < 1 s); `statusText` "✓ Tối ưu rời rạc: 533 quả (liên tục 533⅓)"; cảnh báo khi C quá nhỏ làm lệch xa liên tục.
- `solve`: `{status:"unique", count:1, solution, value:best, steps:[{technique:"Pha k chuyến", text}], techniques, nodes: số km QHĐ, bestCont}`.
- `hint(level)` (dựa LB2 trên trạng thái hiện tại):
  - mất tối ưu ⇒ mọi mức: "Từ trạng thái này tối đa còn X (tối ưu Y). Nước làm mất tối ưu là bước j+1 (…)", mức 3 `action:{k:"truncate", n:j}`, `cells:[j]`.
  - mức 1: cấu trúc, không lộ số đích — "Kho xa nhất có S quả ⇒ cần k = ⌈S/C⌉ chuyến ⇒ mỗi km tốn 2k−1 quả. Hãy dời cả kho tới chỗ số chuối vừa còn đúng (k−1)·C." (hoặc "Còn kho ở km L sau lưng đáng gom; muốn lùi phải lấy thức ăn ở km R trước").
  - mức 2: chỉ ra điểm: "Kho kế tiếp nên ở km y: (S − (k−1)C)/(2k−1) = ℓ".
  - mức 3: macro chuyến kế tiếp `{k:"trip"…}` hoặc bước lẻ + `why` (số ăn, số để lại, vì sao bỏ lại r quả). Đạt best ⇒ `{k:"submit"}`.
- `mistakes`: 1 nếu LB2 trước = best và sau < best.
- `constraintView`: biến f_x (số lượt qua đoạn, gộp theo pha), S_x; ràng buộc S_{x+1} ≤ min(S_x, f·C) − (2f−1), 0 ≤ tải ≤ C, ăn 1/km; tóm tắt "B quả, C, k pha…".
- `trace`: `kind:"matrix"`, mỗi bước 1 pha: bảng [km, chuối đầu pha, số chuyến k, quả/km 2k−1, dài pha] (+ dòng "bỏ lại r"), ≤ 60 bước.
- `toText`/`fromText`: `"camel far B=3000 C=1000"` / `"camel deliver B=3000 C=1000 D=1000"` (chấp nhận tiếng Việt "xa nhất", "tới D"); `toFile.initialState = "B=3000;C=1000;D=1000"`, `solution` = kế hoạch dạng chuỗi; `fromFile` dựng lại qua `fromInput`.
- `algorithm.steps`: (1) mô hình rời rạc, (2) luồng qua một đoạn ⇒ 2f−1, (3) QHĐ theo km, đơn điệu ⇒ tham lam, (4) dạng đóng/bài jeep, (5) bỏ lại chuối khi ranh giới lẻ. `links`: `binary-search` (kiểm "X có đạt được không" là đơn điệu), `coin-change` (QHĐ một chiều) — hoặc bỏ trống tới khi Notebook có mục jeep (câu hỏi 8).
- `difficultyNote`: nêu đúng công thức điểm.

### 4.7 Bàn chơi `ui/boards/camel.js` + `board-camel.css`

```
┌ B = 45 quả ở A · chở tối đa 15 · ăn 1 quả/km (cả khi quay về) · Mục tiêu: đi xa nhất ┐
│ Trục km (SVG, co theo cqw): vạch 0…maxX; kho = cột + số; 🐪 + thanh tải "9/15"          │
│ Dải "zigzag" (thu gọn được): ngang = km, dọc = bước ⇒ thấy rõ các pha đưa-đón            │
│ Đang ở km 3 · chở 9/15 · kho tại đây 6 · đã tới xa nhất 3                                │
│ [Lấy __ ][Đầy] [Đặt __ ][Hết] [Đi tới km __ ][−][+]  → xem trước: "tốn 2, còn chở 7"    │
│ Nhanh: [Chuyến tiếp tế tới km…] [Đi hết sức]                                             │
│ Kế hoạch: 1. Lấy 15 · 2. Đi tới 3 · 3. Đặt 9 · …   [Quay về sau bước i]  [Nộp kế hoạch]  │
```
- Chọn km: chạm vào trục (Pointer Events, `touch-action:none` trên trục), ô số, phím mũi tên ±1 / PageUp-PageDown ±10; xem trước luôn do `def.sim.preview` tính (board không tự cài luật).
- Tô: `highlight(cells,"hint")` = các bước trong danh sách + `regions.positions` trên trục; `"replay"` tô chuyến đang chiếu.
- `describeCell(i)` cho từng dòng kế hoạch; vùng kế hoạch `role="list"`, trục `role="slider"` (aria-valuenow = km chọn).
- Giá trị tối ưu KHÔNG hiện sẵn (chỉ ở gợi ý mức ≥ 2 và hộp thoại kết thúc).
- `editor`: chọn chế độ, nhập B, C, D (ô số + nút mẫu "Kinh điển 3000/1000/1000", "Gọn 45/15"), hiện ngay tối ưu rời rạc/liên tục.
- `check_board_camel.py`: nguồn sự thật độc lập = luật viết lại bằng Python (`fractions` không cần; số nguyên) kiểm state sau mỗi thao tác UI; macro chuyến tiếp tế ra đúng kho; nộp → hộp thoại có "Chất lượng"; co giãn 280–1920; màu riêng `--pz-camel-*` tương phản ≥ 4,5:1.

### 4.8 V2 — đoàn N lạc đà (cùng engine `camel`, các cỡ `convoy`, `convoy-return`)

**Luật chung:** N lạc đà ở A, mỗi con chở đầy C (tổng N·C, A không còn chuối). Ăn 1 quả/km khi đi (cả lùi), từ phần mình chở; chuyển chuối giữa các con **ở cùng km** (đặt xuống/lấy lên — dùng chung cơ chế kho); đi tới/lùi tuỳ ý. Thời gian không tính (thứ tự lệnh tự do).
- **V2a một chiều:** con hỗ trợ dừng ở đâu cũng được (không cần về). Giá trị = km xa nhất một con nào đó tới.
- **V2b phải về:** khi nộp, mọi con trừ một phải ở A. Giá trị như trên.

**Công thức + dẫn xuất (LP theo khoảng cách giữa các điểm quay đầu δ_j):** tại km y, chuối cần cho mọi quãng sau y phải do các con đang ở y mang qua, mỗi con ≤ C.
- V2a: Σ_{l≥i} (N−l+1)·δ_l ≤ (N−i+1)·C ∀i ⇒ tham lam δ_l = C/(N−l+1) ⇒ **D* = C·(1 + 1/2 + … + 1/N) = C·H_N**. Chiến lược: đi cùng nhau δ; một con đổ hết phần còn lại cho các con khác đầy lại rồi dừng.
- V2b: mỗi con quay về phải đi lại quãng ⇒ hệ số 2(N−l)+1: Σ_{l≥i} (2(N−l)+1)·δ_l ≤ (N−i+1)·C ⇒ δ_l = C/(2(N−l)+1) ⇒ **D* = C·(1 + 1/3 + … + 1/(2N−1))** — trùng bài một con chở N·C. Chiến lược cần **kho dọc đường**: tại x_j con hỗ trợ j giữ δ_j để về tới x_{j−1}, và để lại (N−1−j)·δ_j cho các con quay về sau. (Hệ số của Σδ đều dương ⇒ tham lam tối ưu cho LP — chứng minh bằng đổi biến u_j = tổng tiền tố.)

**Kiểm [đã kiểm — `camelN.out`, `convoy.js`]:** vét cạn mọi kế hoạch (có kho, có đi lùi): V2a N=2 C=2,4,6 → 3, 6, 9 = C·H_2; **N=3 C=6 → 11 = 6·H_3** (97 111 trạng thái); V2b N=2 C=3,6 → 4, 8 = C·4/3. Ca không nguyên luôn ≤ công thức, thường bằng phần nguyên (N=3, C=4: 7 và 6; N=3, C=5/6 phải về: 7 và 9; N=4, C=3: 6; N=2, C=3/5) — ngoại lệ khi C quá nhỏ: N=3, C=2 phải về → 2 (công thức 3,07). Mô phỏng số nguyên chiến lược đạt đúng công thức: V2a N=4 C=12 → 25, N=6 C=60 → 147; V2b N=3 C=15 → 23, N=4 C=105 → 176, N=5 C=315 → 563, các con hỗ trợ về A với 0 quả. V2b N=3 C=15 chưa vét cạn được (quá lớn) **[suy đoán dựa LP + mô phỏng]**.
**Bộ sinh:** V2a N=2…5, C bội của lcm(1..N) (2, 6, 12, 60); V2b N=2…5, C bội của lcm lẻ (3, 15, 105, 315).
**Bàn chơi V2:** mỗi con một hàng trên trục (chọn con đang điều khiển bằng nút/phím 1–N), nút "Chuyển n quả cho con j" (= đặt + lấy, 1 diff), "Cả đoàn đi tới km x" (macro). **Gợi ý V2:** chưa có bộ đánh giá tổng quát nhiều con ⇒ theo kế hoạch mẫu, khớp tiền tố bất biến hoán đổi tên lạc đà; lệch ⇒ `truncate` về chỗ lệch (nói rõ "lệch khỏi kế hoạch mẫu"). `mistakes` = 0.

---

## 5. Đi bộ & xe máy (`motorbike`)

### 5.1 Hai cách hiểu — đề xuất mặc định A

Chuẩn hoá: AB = 1, đi bộ tốc độ 1 (hết 1 giờ), xe tốc độ m; mục tiêu cực tiểu **T = lúc người cuối cùng tới B**.
- **A (mặc định — "người trong nhóm lái")**: n người, k xe; ai cũng lái được; xe chở **2 người của nhóm** (lái + 1 sau); được quay lại đón, **bỏ xe bên đường**, người phía sau nhặt lên đi tiếp; người lái cũng phải tới B.
- **B ("xe ôm")**: mỗi xe có tài xế NGOÀI nhóm, chở 1 người; tài xế không cần tới B; bỏ xe vô nghĩa.
Lý do chọn A: yêu cầu nói "bỏ xe bên đường … người phía sau nhặt lên" — chỉ có nghĩa khi người trong nhóm lái được. B làm cỡ thứ hai.

### 5.2 Lời giải

**Lịch đưa-đón kinh điển** (1 xe, g lượt khách, mỗi khách đi xe x, đi bộ 1−x, xe chạy liên tục): mỗi chu kỳ điểm đón tiến 2x/(m+1) ⇒ 2x(g−1)/(m+1) + x = 1 ⇒
```
x = (m+1)/(m+2g−1),    T_dd(g) = x/m + 1 − x = (m(2g−1) + 1) / (m(m + 2g − 1))
```
**Cận dưới LP (cách hiểu A)** — biến trung bình mỗi người: r (km đi xe chiều tới), s (km đi xe chiều lùi); mỗi xe: F (km tới), K (km lùi); c = k/n:
```
(1) 1 − r + s + (r+s)/m ≤ T     thời gian mỗi người (đi bộ ≥ 1 − r + s)
(2) n·r ≤ 2·k·F                 ghế chiều tới: 2 người/xe
(3) n·s ≥ k·K                   km lùi của xe cần một người của nhóm lái
(4) F − K ≤ 1,  (5) F + K ≤ m·T, (6) r − s ≤ 1, mọi biến ≥ 0
```
Mọi lịch đều thoả (lấy trung bình là hợp lệ vì ràng buộc tuyến tính, đối xứng). Khử ⇒ T ≥ 1 − c(1+1/m) − c·F·(1 − 3/m) với F ≤ (mT+1)/2:
- **m > 3**: F càng lớn càng tốt ⇒ F = (mT+1)/2 ⇒ **T* = T_dd(g), g = n/k − 1** (mỗi xe một người lái chạy liên tục, chở lần lượt g người còn lại; người lái tới cùng khách cuối).
- **m < 3**: F = 1, s = 0 ⇒ **T* = 1 − (2k/n)(1 − 1/m)** (tiếp sức: xe chỉ đi tới, luôn chở 2, mỗi người đi xe 2k/n quãng, bỏ xe cho cặp sau).
- **m = 3**: hai lịch bằng nhau. n ≤ 2k: T* = 1/m.
Đạt được khi: m ≥ 3 cần k | n; m ≤ 3 cần 2k | n.
**Cách hiểu B:** cùng LP nhưng (2) n·r ≤ k·F và bỏ (3) ⇒ **T* = T_dd(n/k)**, đạt khi k | n.

**Kiểm [đã kiểm — `bike.out`]:** giải LP bằng liệt kê đỉnh cho 88 bộ (n,k,m ∈ {2; 2,5; 3; 4; 5; 6; 8; 10}) — sai khác lớn nhất với công thức 1,1·10⁻¹⁶ (A) và 1,1·10⁻¹⁶ (B). Mô phỏng hướng sự kiện bằng phân số BigInt ra **đúng từng phân số**, mọi người tới cùng lúc:

| Ca | Lịch | T (giờ) | phút | Ghi chú |
| --- | --- | --- | --- | --- |
| A n=4 k=1 m=5 | đưa-đón | 13/25 | 31,2 | tiếp sức: 3/5 = 36 phút (kém hơn) |
| A n=4 k=1 m=2 | tiếp sức | 3/4 | 45 | đưa-đón: 11/14 ≈ 47,1 phút (kém hơn) |
| A n=6 k=1 m=3 | tiếp sức = đưa-đón | 7/9 | 46,7 | ngưỡng m = 3 |
| A n=6 k=2 m=5 | đưa-đón | 2/5 | 24 | |
| A n=9 k=3 m=6 | đưa-đón | 19/54 | 21,1 | |
| A n=8 k=2 m=7 | đưa-đón | 3/7 | 25,7 | |
| A n=3 k=1 m=4 | đưa-đón | 13/28 | 27,9 | |
| A n=8 k=2 m=2 | tiếp sức | 3/4 | 45 | |
| B n=3 k=1 m=5 | xe ôm | 13/25 | 31,2 | |
| B n=6 k=2 m=4 | xe ôm | 7/12 | 35 | |

Lịch chi tiết A n=4, k=1, m=5 (g = 3, x = 3/5): P1 lái + P2 đi 0 → 3/5 (t = 3/25), thả P2; quay lại gặp P3 ở 1/5 (t = 1/5); chở tới 4/5 (t = 8/25), thả P3; quay lại gặp P4 ở 2/5 (t = 2/5); chở tới B (t = 13/25). P2 đi bộ 2/5 tới B lúc 13/25, P3 đi bộ 1/5 tới lúc 13/25.

**Không chia hết [đã kiểm — `bike-search2.out`]:** tìm kiếm có cấu trúc (đưa-đón nhiều chặng + bỏ xe cuối, lưới 1/48): n=3 k=1 m=2 → tốt nhất 0,7006 (≈ đưa-đón 0,7; cận LP 0,6667); **n=5 k=1 m=2 → 0,8241** (lai, tốt hơn đưa-đón 0,8333; cận LP 0,8). ⇒ tối ưu đúng chưa biết. Không lịch nào thấp hơn LP (kiểm hợp lý tính đúng của LP/bộ mô phỏng).

### 5.3 Bộ mô phỏng hướng sự kiện (luật lệnh của bàn chơi)

- Thực thể: người P1..Pn (đang đi bộ / đứng chờ / trên xe / đã tới), xe X1..Xk (đỗ ở x từ t / đang chạy). Người rảnh **luôn đi bộ về B**.
- Kế hoạch = mỗi xe một hàng lệnh (mã hoá chung trong `state.v`, bản ghi W = 4: `[xe, op, a, b]`):
  `LẤY XE p (+q)` (xe đang đỗ; p, q đang đi bộ phía sau xe đi tới, ai tới trước đứng chờ; p lái) · `CHỞ TỚI x` (x = a/G trên lưới) · `ĐÓN p` (chạy tới gặp người đang đi bộ p — đuổi theo nếu p ở trước: (x_p − x)/(m−1); quay lại nếu p ở sau: (x − x_p)/(m+1)) · `XUỐNG p` (p xuống đi bộ; người lái xuống thì người sau lái; hết người ⇒ xe đỗ = **bỏ xe**).
- Hết lệnh mà còn người trên xe ⇒ tự chạy về B (mọi kế hoạch luôn có T hữu hạn ⇒ điểm hiện trực tiếp).
- Xử lý theo thứ tự thời điểm sẵn sàng nhỏ nhất; người bị "giữ chỗ" ngay khi một xe nhận lệnh ĐÓN/LẤY XE với họ ⇒ không hai xe tranh một người; lỗi rõ ràng: "P3 đang ngồi xe khác lúc đó", "P2 đã đi qua chỗ xe", "xe hết chỗ", "P4 tới B trước khi gặp".
- Số hữu tỉ BigInt (`Q(n,d)` rút gọn gcd), hiển thị "13/25 giờ ≈ 31 phút 12 giây". Lưới G = bội của (m_num + (2g−1)·m_den) và n/gcd(n,2k), nâng lên ≥ 24 vạch (điểm thả tối ưu (m+1+2j)/(m+2g−1) và 2k/n nằm trên lưới); điểm gặp không cần nằm trên lưới.
- Nguyên mẫu đã chạy: `simulate()` trong `bike.js` (≈ 90 dòng) — dùng làm khung cho engine.

### 5.4 Engine `assets/js/puzzles/motorbike.js`

- `id:"motorbike"`, `name:"Đi bộ & xe máy"`, `family:"Mathematical Puzzle"`, `category:"Tối ưu (LP)"` (trường tự do — câu hỏi 8), `icon:"🛵"`, `goal:"optimize"`, `objective:{sense:"min", label:"Thời điểm người cuối tới B", unit:"giờ"}`.
- `sizes`: `nhom` "Người trong nhóm lái (được bỏ xe)" (default) · `xeom` "Xe ôm — tài xế ngoài nhóm".
- `data = { interp, n, k, m:[num,den], G, best:"13/25", bestNum, regime:"dua-don"|"tiep-suc"|"ca-hai"|"chi-can", lb:"…", distKm:5 (hiển thị) }`; `state.v` = `[nộp, len, 64 × 4 số]`.
- Action: `{k:"cmd", bike, op, a, b}` · `{k:"pop"}` · `{k:"truncate", n}` · `{k:"submit"}`. Hàm phụ cho board: `def.sim.run(puzzle, state) → {ok, T, arrivals, segments:[{who, t0,x0,t1,x1, mode}], events, error}` và `def.sim.options(puzzle, state, bike) → [{action, label, preview}]` (danh sách lệnh hợp lệ kế tiếp — board chỉ việc hiện).
- `generate` (chỉ đề biết tối ưu đúng): Dễ — k=1, n=3 (m 3…6, đưa-đón g=2) hoặc n=4 m=2 (tiếp sức 2 cặp); Vừa — k=1, n=4 (m ≥ 3, g=3) hoặc n=6 m=2; Khó — k=2, n=6 (g=2) hoặc n=8 m=2; Chuyên gia — k=2…3, n=8…12 (g=3), hoặc m=3 (hai lịch cùng tối ưu). Điểm = f(số lệnh của lịch tối ưu, k, chế độ) — hiệu chỉnh khi cài để ≥ 90 % đúng bậc.
- `fromInput({interp, n ≤ 12, k ≤ 4, m = "5" | "5/2"})`: chia hết ⇒ `status:"unique"`; không ⇒ `status:"multiple"` + cảnh báo "Chưa biết tối ưu chính xác; chấm so với cận dưới LP X — lịch tốt nhất app biết: Y" (`statusText`).
- `solve`: lịch tối ưu (hoặc tốt nhất biết) + `steps` giải thích; `trace`: `kind:"matrix"` — bảng sự kiện [t, x, sự kiện] của lịch tối ưu (≤ 60 bước); `constraintView`: đúng LP mục 5.2 (biến r_i, s_i, F_b, K_b, T; 6 họ ràng buộc; tóm tắt "ràng buộc (5) xe chạy liên tục và (1) mọi người tới cùng lúc là chặt").
- `hint` (theo lịch mẫu, **khớp tiền tố bất biến đổi tên người/xe**: người được gán vai theo thứ tự xuất hiện trên từng xe; chấp nhận mọi lịch mẫu của chế độ, m = 3 có hai họ):
  - lệch ⇒ "Kế hoạch rẽ khỏi lịch tối ưu ở lệnh j (…) — từ đó trở đi chưa chắc đạt được T*" + `truncate`;
  - mức 1: "m = 5 > 3: đưa-đón tốt hơn bỏ xe — giữ một người lái chạy liên tục, mọi người đi xe một quãng như nhau";
  - mức 2: "Thả khách đầu ở 3/5 quãng (để quãng đi xe bằng nhau: x = (m+1)/(m+2g−1))";
  - mức 3: lệnh kế tiếp + `why` (phương trình gặp nhau, thời điểm tới); đã đạt T* ⇒ `submit`.
  - Giới hạn (nói trong `difficultyNote`/luật): một lịch tối ưu khác dạng mẫu vẫn được điểm 100 % khi nộp, nhưng gợi ý có thể bảo quay lại.
- `mistakes` = 0. `toText`: `"motorbike nhom n=4 k=1 m=5"`.
- `algorithm.steps`: đưa-đón kinh điển; LP và hai chế độ; ngưỡng m = 3; xe ôm; trường hợp không chia hết. `links`: `ternary-search` (quãng đi xe x tối ưu hàm đơn đỉnh), `gaussian-elimination` (giải đỉnh LP).

### 5.5 Bàn chơi `ui/boards/motorbike.js` + `board-motorbike.css`

```
┌ 4 người · 1 xe (2 chỗ) · xe nhanh gấp 5 · đi bộ cả quãng mất 60 phút ┐
│ Biểu đồ không–thời gian (SVG): ngang = vị trí A→B, dọc = thời gian ↓  │
│  người: đường mảnh có nhãn; xe: đường dày, mỗi xe một kiểu nét;       │
│  xe đỗ: chấm dọc; điểm sự kiện có nhãn; vạch ngang "người cuối tới"    │
│ Quyết định — Xe 1 lúc 7′12″ ở 3/5 quãng, trên xe: P1 (lái)            │
│  [Chở tới…] (chạm trục / thanh trượt theo lưới) [Thả P2]               │
│  [Quay lại đón P3 → gặp ở 1/5 lúc 12′] [Bỏ xe tại đây] [Xoá lệnh cuối] │
│ Lệnh: X1: Lấy xe P1+P2 · Chở tới 3/5 · Thả P2 · Đón P3 …               │
│ Tới nơi: P1 31′12″ · … · Người cuối 31′12″ (13/25 giờ)   [Nộp kế hoạch]│
```
- Nút lệnh lấy từ `def.sim.options` (mỗi nút có xem trước ảnh hưởng: điểm gặp, thời điểm); xem trước vẽ nét đứt trên biểu đồ.
- Bàn phím: Tab qua nút lệnh, ←/→ chỉnh vị trí theo lưới, Enter xác nhận; biểu đồ có `aria-label` tóm tắt + bảng sự kiện ẩn cho trình đọc màn hình.
- Không dựa vào màu: xe phân biệt bằng kiểu nét + nhãn; tương phản ≥ 4,5:1 với `--pz-motorbike-*`.
- `editor`: chọn cách hiểu, n, k, m; hiện T*, chế độ, cận LP, cảnh báo không chia hết.
- `check_board_motorbike.py`: nguồn sự thật độc lập = bộ mô phỏng viết lại bằng Python `fractions.Fraction`, so T hiển thị sau một lịch nhập qua UI; nộp lịch tối ưu → "Chất lượng 100 %".

---

## 6. Danh sách việc (thứ tự phụ thuộc; mỗi việc một lượt agent)

1. **Mở rộng hợp đồng tối ưu** — `core/types.js`, `core/plan.js` (mới), `core/game.js`, `ui/play.js`, `ui/create.js`, `index.html` (thẻ plan.js), `HUONG-DAN-ENGINE.md` mục 11, `kiem/core-plan.js`. Kiểm: `node kiem.js core` + `node kiem.js` (929 phép cũ vẫn xanh) + `check.py --chuc-nang` (5 loại cũ không đổi hành vi).
2. **camel — lõi toán** (`puzzles/camel.js` phần nội bộ: mô phỏng luật, g/QHĐ, dạng đóng phân số, kế hoạch gọn, LB2 + kế hoạch tiếp nối) + `kiem/camel.js` phần 1 (vét cạn độc lập viết lại trong test: QHĐ = vét cạn ở ≥ 15 bộ; LB2 = vét cạn trên mọi trạng thái đạt được ở ≥ 8 bộ; kế hoạch gọn/tiếp nối chạy bằng mô phỏng = giá trị dự đoán trên ≥ 2 000 bộ ngẫu nhiên; bảng 4.3).
3. **camel — hàm hợp đồng phần A**: `generate/fromInput/validate/solve/difficulty/newState/isGiven/moveFor/check/mistakes/describeCell/toText/fromText/toFile/fromFile`, đăng ký `register`. Test: conformance, tất định, bậc ≥ 90 % + đơn điệu (20 seed × cỡ × bậc), ngân sách thời gian, diff hoàn lại, đầu vào xấu không ném, vòng tròn nhập/xuất.
4. **camel — hàm hợp đồng phần B**: `hint` 3 mức + nhánh mất tối ưu, `replay`, `constraintView`, `trace`, nội dung `algorithm`/`rules`. Test: vòng hint (có chèn nước làm mất tối ưu ngẫu nhiên) ⇒ solved, quality 1, ≤ total·3 bước; mức 1 không chứa km đích của mức 3; replay ⇒ solved; không chữ rác.
5. **camel — nối vào app**: 2 thẻ `index.html`, `node kiem.js app` (mô phỏng worker), `tao-pwa.py`.
6. **camel — bàn chơi** `ui/boards/camel.js`, `assets/css/board-camel.css`, `check_board_camel.py`. Kiểm: `check.py --chuc-nang` (vòng đời chung + bàn riêng), `--co-gian`.
7. **motorbike — lõi toán** (`puzzles/motorbike.js` nội bộ: phân số BigInt, mô phỏng sự kiện, dạng đóng, LP liệt kê đỉnh, lịch mẫu đưa-đón A/tiếp sức A/xe ôm B, chọn lưới G) + `kiem/motorbike.js` phần 1 (LP độc lập trong test — vd giải theo đối ngẫu/khử tham số — khớp công thức; mô phỏng lịch mẫu = phân số đúng; kế hoạch ngẫu nhiên không bao giờ thấp hơn LP; bảng 5.2).
8. **motorbike — hàm hợp đồng** (đủ 19 hàm, `sim.run/options`, hint khớp tiền tố bất biến đổi tên) + test (như việc 3+4) + 2 thẻ `index.html` + `node kiem.js app` + `tao-pwa.py`.
9. **motorbike — bàn chơi** biểu đồ không–thời gian `ui/boards/motorbike.js`, `board-motorbike.css`, `check_board_motorbike.py`. Kiểm: `check.py --chuc-nang`, `--co-gian`.
10. **camel V2 — đoàn lạc đà**: cỡ `convoy`/`convoy-return` trong engine + bàn (nhiều hàng, chuyển chuối), test (vét cạn N=2 C≤6 & N=3 C=6 độc lập trong test; mô phỏng chiến lược tới N=5).
11. **Tích hợp + tài liệu**: (nếu duyệt) thêm id vào cuối `core/daily.js ORDER` theo thứ tự đã chốt với vùng coin weighing; thống kê "chất lượng TB" (tuỳ chọn); `check.py --tat-ca`; `tao-pwa.py`; cập nhật skill `ban-do-ung-dung`, bàn giao `tasks/2610/<ngày>/logic-puzzle-suite-toi-uu/ban-giao.md`.

---

## 7. Rủi ro

- Chạm lõi/vỏ (`game.js`, `play.js`, `create.js`, `types.js`) — có thể làm vỡ 5 loại cũ ⇒ việc 1 phải chạy lại toàn bộ `kiem.js` + `check.py --chuc-nang`.
- Va chạm với vùng coin weighing (cùng đề xuất mở rộng hợp đồng, cùng thêm vào `ORDER`) ⇒ chốt chung `goal` + `core/plan.js` + thứ tự Daily trước khi cài.
- LB2 đúng trên 638 407 trạng thái nhỏ nhưng **chưa có chứng minh** ⇒ chỉ dùng theo cách an toàn (mục 4.4); test giữ phép vét cạn để bắt hồi quy.
- Gợi ý xe máy/V2 theo lịch mẫu có thể bảo "quay lại" khi người chơi đang theo một lịch tối ưu khác dạng.
- Bàn xe máy (biểu đồ + nhiều nút lệnh) khó dùng trên màn 280–360 px ⇒ thiết kế xếp dọc, nút ≥ 44 px, biểu đồ cuộn dọc.
- BigInt: trình duyệt rất cũ (Safari < 14) không chạy được loại `motorbike`.
- Người chơi nhầm rời rạc/liên tục (533 vs 533⅓) ⇒ luật ghi rõ "km nguyên", lời giải nêu cả hai.
- Đề tự nhập lớn (B 20 000, maxX 5 000) làm LB2/hint chậm ⇒ giới hạn ở `fromInput`, đo trong test (≤ 1 s).
- Kế hoạch dài vượt dung lượng (160 bước lạc đà, 64 lệnh xe máy) ⇒ `moveFor` trả null + board báo "kế hoạch tối đa … bước — hãy đi chặng dài hơn".
- Daily đổi lịch các ngày tương lai khi thêm id (`daily.js:27`).

---

## 8. Lệnh kiểm

```bash
# script nháp (đã chạy, kết quả ở *.out cùng thư mục)
SCR=C:/Users/tranphuc8a/AppData/Local/Temp/claude/c--Users-tranphuc8a-Desktop-gemini-proxy/2fd2853d-4c94-4034-a078-2b6358d957ee/scratchpad/puzzle-camel-bike
node $SCR/camel.js; node --max-old-space-size=6000 $SCR/camel-lb2.js; node $SCR/camel-plan.js
node $SCR/camelN.js; node $SCR/camelN3.js 3 6; node $SCR/convoy.js; node $SCR/bike.js; node $SCR/bike-search2.js
# sau khi cài
LPS=backend/fastapi/webapp/tranphuc8a/logic-puzzle-suite
node $LPS/kiem.js core && node $LPS/kiem.js camel && node $LPS/kiem.js motorbike && node $LPS/kiem.js app && node $LPS/kiem.js
backend/fastapi/.venv/Scripts/python.exe $LPS/tao-pwa.py
backend/fastapi/.venv/Scripts/python.exe $LPS/check.py --tinh
backend/fastapi/.venv/Scripts/python.exe $LPS/check.py --chuc-nang
backend/fastapi/.venv/Scripts/python.exe $LPS/check.py --co-gian
backend/fastapi/.venv/Scripts/python.exe $LPS/check.py --tat-ca
```
(Đặt `PYTHONUTF8=1` khi chạy script in tiếng Việt trên Windows; `PUZ_PERF_SLACK=3` nếu máy chậm.)

---

## 9. Câu hỏi cho chủ dự án (kèm đề xuất)

1. **Xe máy — người lái là ai?** A (người trong nhóm, bỏ xe được) / B (xe ôm) / cả hai. *Đề xuất:* A mặc định, B là cỡ thứ hai.
2. **Lạc đà ăn khi nào?** mọi km (cả khi về, kiểu bài jeep) / chỉ khi có chở. *Đề xuất:* mọi km (bài kinh điển; mọi số liệu trên theo luật này).
3. **Km nguyên hay phân số?** *Đề xuất:* km nguyên + bộ sinh chọn số để trùng đáp án liên tục; đề tự nhập chấm theo tối ưu rời rạc, hiện thêm dạng đóng liên tục.
4. **Kết thúc ván tối ưu:** "Nộp" → tính là giải xong kèm chất lượng / chỉ "giải xong" khi đạt tối ưu. *Đề xuất:* Nộp + chất lượng (100 % ⇒ nhãn "Tối ưu!"); lịch sử ghi `quality`.
5. **V2 đoàn lạc đà:** làm cả "một chiều" và "phải về"? *Đề xuất:* cả hai, sau V1 (việc 10).
6. **Xe máy đề tự nhập không chia hết:** cho chơi (chấm so với cận dưới, cảnh báo) / từ chối. *Đề xuất:* cho chơi kèm cảnh báo.
7. **Daily:** đưa 2 loại mới vào xoay vòng? *Đề xuất:* có, thêm cuối `ORDER` sau khi chốt thứ tự với vùng coin weighing (chấp nhận lịch Daily tương lai đổi).
8. **Algorithm Notebook / category:** thêm mục "jeep-problem", "linear-programming" vào Notebook và category mới "Tối ưu (LP)"? *Đề xuất:* tạm liên kết `binary-search`, `coin-change`, `ternary-search`, `gaussian-elimination`; thêm mục Notebook ở đợt sau.
9. **BigInt** (Safari ≥ 14) cho số hữu tỉ chính xác — chấp nhận? *Đề xuất:* chấp nhận.
10. **"Lỗi" của lạc đà = nước làm mất tối ưu** (đếm được chính xác nhờ LB2)? *Đề xuất:* có; xe máy để 0.
