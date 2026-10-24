# Logic Puzzle Suite — hợp đồng cho một LOẠI PUZZLE (engine + board)

Tài liệu này là **hợp đồng** giữa lõi/vỏ app và từng loại puzzle (Sudoku, N-Queens, Lights Out, Nonogram, Logic Grid, và các loại V2 sau này).
Thêm puzzle mới = thêm đúng các tệp dưới đây, **không sửa lõi** (`assets/js/core`), không sửa tệp của loại khác.

| Tệp (tạo mới) | Việc |
| --- | --- |
| `assets/js/puzzles/<id>.js` | **Engine thuần** (không DOM, chạy trong node và Web Worker): sinh, kiểm, giải, độ khó, gợi ý, replay, nhập/xuất. Gọi `Puz.types.register({...})`. |
| `kiem/<id>.js` | Test node: `module.exports = function (t) { … }`. Chạy: `node kiem.js <id>`. Phải có **nguồn sự thật độc lập** (mục 8). |
| `assets/js/ui/boards/<id>.js` + `assets/css/board-<id>.css` | Giao diện bàn chơi + trình soạn (làm sau khi vỏ app có, mục 9). |

Phong cách mã: ES5 thuần (`var`, `function`; không `class`/mũi tên/template literal) cho khớp phần còn lại và Safari cũ; bọc `(function (root) { "use strict"; … })(typeof globalThis !== "undefined" ? globalThis : this);`;
chuỗi hiển thị cho người dùng bằng **tiếng Việt**, định danh trong mã bằng tiếng Anh; chú thích đầu tệp nói rõ cách chọn thiết kế (xem `core/*.js`, `Algorithm Notebook` để bắt chước giọng). Không thư viện ngoài. Không `Math.random()`, `Date.now()` trong sinh/giải (xem mục 6).

Có sẵn để dùng: `Puz.rng` (seed, `create(seed).int/range/pick/shuffle/chance/fork`), `Puz.util` (bậc độ khó, `puzzleId`, `popcount`, `bitsOf`…), `Puz.csp` (bộ giải CSP tổng quát, xem đầu `core/csp.js`), `Puz.game` (một ván; `applyDiff`, `reverseDiff`, `diffTo`), `Puz.types` (sổ đăng ký + `optionsOf`/`compactOptions`), `Puz.plan` (trạng thái = kế hoạch, mục 11), `Puz.grade` (chấm sao, mục 11).

**Chạy trong Web Worker:** việc nặng (`generate`, `fromInput`, `replay`, `constraintView`, `trace`) được vỏ đẩy sang worker (`core/gen.js` → `worker/gen.js`). Worker CHỈ nạp các tệp có thuộc tính `data-pz` trong `index.html` (hiện: `rng`, `util`, `csp`, `types`, `grade`, `plan`, `game` và mọi `puzzles/*.js`); thêm loại mới nghĩa là thêm thẻ `<script src="./assets/js/puzzles/<id>.js" data-pz>`. Engine KHÔNG được dùng thứ gì ngoài danh sách đó (không `Puz.text`, `Puz.stats`, `Puz.ui`…). `kiem/app-worker.js` mô phỏng đúng ngữ cảnh này (vm trống chỉ nạp các tệp `data-pz`) và gọi mọi hàm trên từng loại — **chạy `node kiem.js app` sau khi thêm loại mới**; test engine thường chạy trong node với đủ lõi nên KHÔNG bắt được lỗi thiếu phụ thuộc trong worker (đã từng xảy ra với `Puz.game.applyDiff`).
Đọc `core/game.js` trước: nó quyết định hình dạng state/diff/action.

## 1. Dữ liệu

**puzzle** (JSON thuần, chỉ số/chuỗi/mảng/đối tượng — để gửi qua `postMessage`, lưu IndexedDB, xuất JSON):

```
{ v: 1, type: "<id>", id: Puz.util.puzzleId(p), seed: <uint32 | null nếu tự nhập>, sizeId: "<id kích cỡ>", size: <params của kích cỡ: 9 | {w,h} | {n} | …>,
  tier: "easy|medium|hard|expert|custom", score: <0..10, 1 chữ số thập phân>,
  data:    { … phần TĨNH của đề, mỗi loại tự định: manh mối nonogram, danh mục + clue của logic grid, … },
  initial: { v: [ … ] },          // trạng thái đầu: các ô cho sẵn (cố định) hoặc bàn xáo (lights out)
  solution:{ v: [ … ] } | null,   // một lời giải đầy đủ, CÙNG HÌNH DẠNG state.v (null nếu vô nghiệm)
  meta:    { name?, source?, note? } }
```

**state** = `{ v: [...ô...], c: [...bitmask ứng viên...] | null }` — `v` luôn là mảng số nguyên phẳng; `c` chỉ loại nào có ghi chú ứng viên (pencil mark) mới dùng, độ dài = `v.length`.
Mọi giá trị trong `v`/`c` là **số nguyên nhỏ** (để so sánh bằng `===` và JSON gọn).

**diff** = `{ d: [[trường, chỉ số, giá trị cũ, giá trị mới], …], label? }`, trường là `"v"` hoặc `"c"`. `Puz.game` áp diff xuôi/ngược để undo/redo (hàm ngược, không chụp ảnh).

**action** (UI → engine): đối tượng `{ k: "<kiểu>", … }` do **loại puzzle quy định** và ghi rõ ở đầu tệp engine (ví dụ Sudoku: `{k:"set", i, val}`, `{k:"cand", i, bit}`, `{k:"clearcand", i}`, `{k:"autocand"}`; Lights Out: `{k:"press", i}`; Nonogram: `{k:"fill", cells:[…], val}`).
`moveFor` đổi action thành diff.

## 2. Siêu dữ liệu (thuộc tính bắt buộc của đối tượng đăng ký)

| Thuộc tính | Nội dung |
| --- | --- |
| `id` | chữ thường, không dấu, vd `"sudoku"`, `"nqueens"`, `"lightsout"`, `"nonogram"`, `"logicgrid"` |
| `name` | tên hiển thị tiếng Việt/Anh quen thuộc ("Sudoku", "N-Queens", "Lights Out", "Nonogram", "Logic Grid") |
| `family` | một trong `Puz.types.FAMILIES` ("Grid Puzzle", "Constraint Puzzle", "Graph Puzzle", "Mathematical Puzzle", "Deduction Puzzle", "Search / State Puzzle") |
| `category` | nhóm thuật toán (spec #25): "Ràng buộc" · "Tìm kiếm" · "Đại số tuyến tính" · "Suy diễn" · "Lý thuyết số" · "QHĐ" |
| `icon` | một ký tự/emoji dùng làm biểu tượng thẻ |
| `blurb` | 1 câu giới thiệu |
| `rules` | mảng chuỗi — luật chơi, mỗi ý một chuỗi |
| `sizes` | `[{ id, label, params, default?: true, tiers?: ["easy",…] }]` — đúng MỘT mục `default`; `params` là cái truyền xuống `puzzle.size`; `tiers` liệt kê các bậc **thật sự sinh được** ở cỡ đó (bỏ trống = cả bốn) |
| `algorithm` | `{ title, steps: [{title, text}], links: [{id, label}] }` — màn "Giải thích thuật toán" (spec #26). `links[].id` phải là **id có thật** trong `../algorithm-notebook/assets/data/lib-*.js` (vd `backtracking`, `gaussian-elimination`, `two-sat`, `bitmask-dp`, `branch-and-bound`, `dfs`) |
| `difficultyNote` | 1–2 câu: điểm 0–10 dựa trên những yếu tố nào (spec #6) |

## 3. Hàm bắt buộc

Mọi hàm **thuần** (không sửa đối số, không dùng toàn cục), tất định.

| Hàm | Trả về |
| --- | --- |
| `generate(seed, {sizeId, tier})` | `puzzle` đầy đủ (mục 1). **Tất định**: cùng `(seed, sizeId, tier)` → cùng puzzle từng bit. Đề sinh ra có **nghiệm duy nhất** (trừ Lights Out, mục 7). Điểm `score` phải rơi vào khoảng của `tier` (`Puz.util.TIERS`); thử lại bằng các dòng `rng.fork("try"+k)` với ngân sách **đếm bằng lần thử/nút tìm kiếm, KHÔNG bằng thời gian** (thời gian làm kết quả không lặp lại được). |
| `fromInput(input)` | Dựng puzzle từ dữ liệu người dùng tự nhập (trình soạn): `{ ok, puzzle, errors:[chuỗi], warnings:[chuỗi], status:"none"\|"unique"\|"multiple", count }`. `ok=false` khi đề hỏng (mâu thuẫn, sai định dạng); `status:"multiple"` là **cảnh báo**, vẫn `ok=true` (spec #13). `tier:"custom"`, `score` tính bằng `difficulty`. |
| `validate(puzzle)` | `{ ok, errors:[], status, count (đếm tới 2), solution?:{v} }` — kiểm đề hợp lệ + đếm nghiệm. |
| `solve(puzzle, opts)` | `{ status:"none"\|"unique"\|"multiple", count, solution:{v}\|null, steps:[{technique, text}], techniques:{tên:số lần}, nodes, … }`. `opts.limit` (mặc định 2) là số nghiệm tối đa cần đếm. Phải nhanh: đề bất kỳ hợp lệ giải/đếm ≤ 1 s. |
| `difficulty(puzzle)` | số 0–10 (1 chữ số thập phân), hàm tất định của đề (kích thước, số ràng buộc, kỹ thuật cần dùng, độ sâu tìm kiếm… — ghi vào `difficultyNote`). |
| `newState(puzzle)` | `{v: copy initial.v, c: null \| mảng 0}` |
| `isGiven(puzzle, i)` | ô `i` cố định (không sửa được)? |
| `moveFor(puzzle, state, action, settings)` | `diff` hoặc `null` (không hợp lệ / không đổi gì). `settings` có thể có `autoRemove` (tự gạt ứng viên). Không đụng ô cho sẵn. |
| `check(puzzle, state)` | `{ solved, conflicts:[chỉ số ô vi phạm luật HIỆN TẠI], filled, total }`. `solved` = state thoả MỌI luật (không nhất thiết trùng `puzzle.solution` — đề tự nhập có thể nhiều nghiệm). |
| `mistakes(puzzle, state, diff)` | số **nước sai MỚI** trong diff (gọi **trước** khi áp diff), so với `puzzle.solution`. Loại không có khái niệm sai trả 0. |
| `hint(puzzle, state, level, settings)` | xem mục 4. `settings` (tham số thứ 4, mục 11) = cài đặt của ván (`game.settings()`); loại không cần thì bỏ qua. |
| `replay(puzzle)` | `[{ text, why?, diff:{d}, cells:[…], technique? }]`: chuỗi bước giải từ `newState(puzzle)` tới lúc `check(...).solved`; áp tuần tự các `diff` phải ra một state thoả `check`. Mỗi bước có `text` tiếng Việt giải thích (spec #14). |
| `constraintView(puzzle)` | `{ summary, variables:[{name, domain, count?}], constraints:[chuỗi], counts:{variables, constraints, …} }` — màn Constraint View (spec #24). Biến nhiều (≥ 40) thì gộp nhóm (`count`). |
| `trace(puzzle, opts)` | trực quan hoá bộ giải (spec #27): `{kind:"tree", nodes:[{id,parent,label,status}], truncated, note}` hoặc `{kind:"matrix", title, steps:[{text, matrix:[[…]], pivot?:[r,c]}], note}`. `status` ∈ `fail|dead|ok|solution`. Giới hạn ≤ 600 nút / ≤ 60 bước. |
| `describeCell(puzzle, state, i)` | chuỗi tiếng Việt cho `aria-label` của ô (vd "Hàng 5, cột 7, ô trống, ứng viên 1 3 7"). |
| `toFile(puzzle)` / `fromFile(obj)` | định dạng chia sẻ (spec #29): `{ type, seed, difficulty:score, size, initialState:"<chuỗi>", solution:"<chuỗi>", metadata:{…} }`. `fromFile` **không tin** `difficulty`/`solution` trong tệp: dựng lại qua `fromInput` rồi trả `{ok, puzzle, errors, warnings}`. |
| `toText(puzzle)` / `fromText(text)` | dạng văn bản đọc được/chép tay (Sudoku: lưới chữ số + `.`; N-Queens: lưới `.`/`Q`…). `fromText(toText(p))` phải cho lại đề có cùng `initial` và `data`. `fromText` chấp nhận cả dạng gọn (Sudoku 81 ký tự `530070000…`) và bỏ qua khoảng trắng/ký tự trang trí; trả `{ok, puzzle, errors, warnings}`. |

## 4. Gợi ý (Hint) — phần làm nên khác biệt "học" so với "chơi" (spec #10–11)

`hint(puzzle, state, level, settings)` trả:

```
{ level, text, why:[chuỗi…], cells:[chỉ số ô để tô sáng], regions?:{…tuỳ loại}, technique?:"tên kỹ thuật", action?:{k:…}, none?:true }
```

- **Mức 1** — hướng: chỉ nói nên nhìn vào đâu, KHÔNG nói đáp án ("Hãy tập trung vào hàng 5", "Hãy tìm một ô trong block trung tâm chỉ còn một ứng viên"). `cells` = vùng cần nhìn.
- **Mức 2** — chỉ ra ô và điều đã biết ("R5C7 chỉ còn 1 ứng viên: {2}") nhưng chưa điền. `cells` = ô đó.
- **Mức 3** — nước đi + **vì sao** (`why`, vài dòng: "Hàng 5 đã có …, cột 7 đã có …, block đã có … → chỉ còn 2"). Có `action` để nút "Áp dụng" gọi `game.act(action)`.
- **Mức 4 (Reveal)** do `game.reveal()` — không phải việc của `hint`.
- Hint phải **đúng và có ích**: (a) mọi hint mức 3 là một suy luận **hợp lệ** từ trạng thái hiện tại (không chỉ "đọc từ lời giải"); (b) từ bất kỳ trạng thái không sai nào, áp dụng hint mức 3 lặp lại sẽ **giải xong** đề (test mục 8 kiểm bằng cách chạy thật, mọi seed mẫu); (c) nếu trạng thái đang có ô **sai** (khác `solution` hoặc vi phạm luật), hint nói đó trước ("Có ô đang điền sai: …") với `action` xoá/sửa ô ấy; (d) không còn gì để gợi ý (đã xong) → `{ level, text:"…", none:true }`.
- Cùng trạng thái + cùng mức → cùng hint (tất định) — để tới mức 2/3 vẫn nhất quán với mức 1 đã cho.

## 5. Độ khó (spec #6)

Điểm 0–10 do `difficulty(puzzle)`; bậc theo `Puz.util.TIERS` (Dễ <3.5, Vừa <5.5, Khó <7.5, Chuyên gia ≥7.5). Mỗi loại chọn yếu tố và trọng số riêng nhưng phải: **đơn điệu theo bậc** (trung bình điểm Dễ < Vừa < Khó < Chuyên gia trên ≥ 20 seed), và `generate(…, tier)` đạt đúng khoảng của bậc ở **≥ 90 %** seed với mọi `(size, tier)` được `sizes[].tiers` quảng cáo (số còn lại ghi `puzzle.tier` = bậc thật theo điểm — trung thực, không gán nhãn sai).

## 6. Tất định và hiệu năng

- Chỉ dùng `Puz.rng` cho ngẫu nhiên; chia dòng bằng `fork("nhãn")` để đổi một bước không làm lệch bước khác. Không `Math.random`, `Date`, `performance.now` trong `generate`/`solve`/`hint`.
- Ngân sách: `generate` ≤ **1,5 s** trung vị và ≤ **4 s** xấu nhất trên 20 seed cho mọi `(size, tier)` (đo trong test, nới bằng `PUZ_PERF_SLACK`); `solve`/`validate` đề tự nhập ≤ **1 s** (có `maxNodes` → trả `status:"multiple"` kèm cảnh báo "chưa xác định hết" nếu cạn ngân sách, không treo).
- Engine chạy được trong **Web Worker** (`importScripts`): không đụng `window`/`document`.

## 7. Ghi chú theo loại (đã thống nhất với chủ dự án)

- **Sudoku** 9×9. Bộ giải kỹ thuật người (single, cặp/bộ ba, pointing/claiming, X-Wing…, rồi đoán) để chấm độ khó và sinh hint giải thích; bộ giải bitmask nhanh để đếm nghiệm; ứng viên (pencil) `c[i]` là bitmask bit `d` = chữ số `d` (1..9); `autoRemove` gạt ứng viên ở hàng/cột/block khi điền.
- **N-Queens** cỡ 6/8/10/12/16 (+ tự nhập N 4–24): đề = bàn có sẵn vài hậu cố định, người chơi đặt nốt; sinh bằng cách bỏ dần hậu khỏi một lời giải mà vẫn **duy nhất** lời giải; có `trace` cây quay lui.
- **Lights Out** 3×3 … 7×7 (+ chữ nhật): luật chữ thập; sinh bằng cách bấm ngẫu nhiên từ bàn tắt (luôn giải được); `solution.v` = bàn tắt hết, `data.presses` = tập bấm ít nhất; số nghiệm = 2^(chiều của nhân) — **nhiều nghiệm là bình thường, không cảnh báo**; dùng khử Gauss GF(2) (có thể chép/tham khảo `../light-grid-shared/gf2.js`), `trace` kiểu `matrix` ghi từng bước khử.
  Đợt P2 (23/10/2026, `kiem/lightsout-hoc.js`, mẫu vàng `kiem/lightsout-vang.js` 340 puzzle sinh + 40 bàn tự nhập — seed cũ ra đúng puzzle cũ, KHÔNG ghi thêm trường vào puzzle cổ điển):
  **bất biến** khi vô nghiệm — `info.obstruction = {cells, size, lit, minimal, text}` trong `validate/solve/fromInput` (+ `errors[1]`), hint `none` tô các ô đó
  (y ∈ ker A ít ô nhất có y·b lẻ; A đối xứng nên ker Aᵀ = ker A); `constraintView().sections` = mẫu bấm im lặng (cơ sở hạt nhân), mọi lời giải khi ≤ 16, bất biến
  (`learn.js` vẽ `sections` tuỳ chọn cho mọi loại: `[{title, note?, items:[chuỗi | {text, grid:["#.#",…]}]}]`); bước cuối `trace` nêu hạt nhân; bước đầu `replay`
  là **bản đồ lời giải** (`cells` = mọi ô cần bấm, `map`); **kiểu gợi ý** `settings.loHint` = `"min"` (mặc định, như cũ) | `"chase"` (đuổi đèn: pha 1 bấm dưới đèn sáng
  đầu tiên, pha 2 tra bảng hàng cuối T·t = r chọn chính tắc ít ô nhất rồi từ điển — 5×5 khớp bảng kinh điển; nhận ra "pha 2 đang dở" nên trùng thủ tục tay, ≤ 2N − w nước);
  bàn có công tắc (nhớ ở `localStorage["puz:lo-hint"]`); **par + grade** (mục 11.4): `objective {min, "lần bấm"}`, 3★ = K lần bấm, 2★ ≤ K + ⌈K/4⌉, 1★ còn lại, chưa xong 0★;
  `def.lib` = hàm thuần cho bàn/test (`obstruction`, `chaseStep`, `chaseTop`, `par`, `parStars`, `cross`, `hintStyle`).
- **Cân đồng xu** (`coinbalance`, đợt P3 24/10/2026, loại `interactive` đầu tiên có bàn thật — xem mục 11.9): n xu, MỘT xu giả, cân đĩa, k lần cân cứng; phải CHỨNG MINH xu giả (và nặng/nhẹ nếu phiên bản đòi), đoán may không tính.
  6 phiên bản (`sizes`, nhãn "Phiên bản": biết nặng 2/3 lần · nặng-hay-nhẹ 3/4 lần · +xu chuẩn · chỉ chỉ ra xu), tuỳ chọn `mode` = `fixed` (xu giả cố định theo seed) | `adv` (đối thủ thích nghi).
  Lõi toán = DP minimax trên lớp xu U/H/L/G (cận thông tin 3^k KHÔNG đủ: 13 xu/3 lần có 26 ≤ 27 khả năng nhưng không giải được); kiểm bằng vét cạn tường minh (n ≤ 5, k ≤ 3), vét cạn mức tập giả thuyết (biên Dyson tới k = 3),
  mô phỏng khối lượng và "mọi xu giả có thể đều bị chiến lược tối ưu tìm ra" (`kiem/coinbalance.js`, `check_board_coinbalance.py`).
- **Nonogram** 5×5 / 10×10 / 15×15: `state.v` 0 = chưa biết, 1 = tô, 2 = gạch; đề sinh từ ảnh ngẫu nhiên tất định và phải có nghiệm duy nhất; bộ giải theo dòng (overlap, chốt, gạch…) rồi quay lui; hint nói theo dòng/cột.
- **Logic Grid** `cats × items`: manh mối `=`, `≠`, "A hoặc B" và so sánh/liền kề cho nhóm **có thứ tự** (vị trí, tuổi); sinh manh mối rồi **tỉa** tới mức vừa đủ duy nhất; có Builder (nhập `Alice != Red`, `Bob = Blue`, `Alice left-of Bob`…) → bài toán ràng buộc (dùng `Puz.csp`); `constraintView` liệt kê biến/miền/ràng buộc; hint dựa trên lan truyền ràng buộc nên giải thích được.

## 8. Test bắt buộc (`kiem/<id>.js`) — nguồn sự thật ĐỘC LẬP, không tự đối chiếu với chính mình

1. `conformance` đã được `kiem.js` chạy; thêm: mọi `sizes[].tiers` hợp lệ, `algorithm.links[].id` có thật trong `../algorithm-notebook/assets/data/lib-*.js` (đọc tệp và tìm `id: "<id>"`).
2. **Bộ giải vét cạn độc lập** (viết riêng trong test, đơn giản, chậm, chỉ dùng cho cỡ nhỏ) đếm nghiệm; so với `solve`/`validate` trên ≥ 200 đề ngẫu nhiên cỡ nhỏ (cả đề nhiều nghiệm, vô nghiệm, duy nhất).
3. **Đề/đáp án đã biết từ nguồn công bố** (ghi rõ nguồn trong test): vd Sudoku `530070000600195000098000060800060003400803001700020006060000280000419005000080079` (ví dụ kinh điển Wikipedia, lời giải `534678912672195348198342567859761423426853791713924856961537284287419635345286179`); số nghiệm N-Queens (4→2, 5→10, 6→4, 7→40, 8→92, 9→352, 10→724 — OEIS A000170); Lights Out 5×5 nhân 2 chiều ⇒ 4 nghiệm, 3×3 và 6×6 duy nhất, 4×4 nhân 4 chiều; không nêu số bạn không chắc nguồn.
4. `generate`: tất định (2 lần giống hệt), nghiệm duy nhất đếm bằng bộ giải VÉT CẠN/độc lập trên cỡ nhỏ và bằng `solve` trên cỡ lớn, `score` trong khoảng bậc (≥ 90 %), đơn điệu theo bậc, ngân sách thời gian (mục 6).
5. `moveFor`/`check`/`mistakes`: mọi diff áp rồi hoàn lại bằng `Puz.game.reverseDiff` ra đúng state cũ; `check(solution)` là solved; không sửa được ô cho sẵn; `conflicts` chỉ ra đúng ô vi phạm.
6. **Hint**: từ đề ngẫu nhiên, lặp "hint mức 3 → áp dụng" tới khi xong (có chèn một nước sai ngẫu nhiên giữa chừng để kiểm nhánh sửa lỗi) — phải giải xong, mỗi bước là diff hợp lệ, không quá `total * 3` bước; mức 1 không lộ giá trị (không chứa chữ số/đáp án cụ thể của ô sẽ điền ở mức 3 — kiểm bằng chuỗi `text`); mức 2 được nêu ô và điều đã biết về ô đó (Sudoku: tập ứng viên, đúng ví dụ spec "R5C7 chỉ còn 1 ứng viên: {2}") nhưng chưa nói "điền X".
7. `replay`: áp tuần tự ra state `solved`; mỗi bước có `text`.
8. `toFile/fromFile`, `toText/fromText`: vòng tròn không đổi (`initial`, `data`); đầu vào xấu (thiếu trường, sai độ dài, ký tự lạ, rỗng) → `ok:false` + lỗi tiếng Việt, **không ném ngoại lệ**.
9. `fromInput`: đề tự nhập vô nghiệm / nhiều nghiệm / duy nhất cho `status` đúng (đối chiếu vét cạn).
10. `constraintView`, `trace`: đúng hình dạng mục 3, giới hạn kích thước.
11. Với nội dung tiếng Việt (rules, algorithm, hint, replay): không chuỗi rỗng, không `undefined`/`null`/`NaN` lọt vào chữ.

Báo cáo kết quả bằng **số đo thật** (ms, số seed đã thử, tỉ lệ đạt bậc). Nếu có phần chưa kiểm hoặc chưa làm được, nói rõ — đừng khẳng định chưa thử.

## 9. Board (giao diện) — tệp `assets/js/ui/boards/<id>.js` + `assets/css/board-<id>.css`

Đã có sẵn trong vỏ (`index.html` nạp đúng hai tệp này cho mỗi loại; hiện là tệp giữ chỗ — hãy ghi đè). Vỏ lo: tiêu đề, độ khó, đồng hồ, tạm dừng (che bàn + `inert`), hoàn tác/làm lại, nút Gợi ý + khung hiển thị gợi ý, replay, tự lưu ván, hộp thoại giải xong. **Board chỉ vẽ bàn và nhận thao tác.**

`Puz.boards["<id>"] = { mount(host, env), editor(host, env) }` (`Puz.boards` đã được khởi tạo bởi `ui/common.js`; viết `Puz.boards.sudoku = {...}` trong IIFE như các tệp ui khác).

**mount(host, env) → view**
- `env = { game, puzzle, type, U, readOnly, settings(), announce(chữ) }`. `game` là `Puz.game` (đọc `game.state`, nghe `game.on(function (ev) {…})` với `ev.type` ∈ `change`|`status`|`hint`|`solved`, gửi thao tác bằng `game.act(action)` — kết quả `{ok, reason?, mistakes?, check?}`); `U` = `Puz.ui` (`h`, `icon`, `toast`, `isTyping`, `debounce`…); `settings()` trả `{autoRemove, showConflicts, highlightSame, autoPause, confirmReveal, dailyGoal}` (đọc lại mỗi lần cần, người dùng có thể đổi giữa ván); `announce` đọc to cho trình đọc màn hình ("Điền 5 vào R3C4").
- `readOnly === true` (replay hoặc ván đã xong): vẽ nhưng **không** gửi action, không bắt phím điền.
- Trả `view = { destroy(), refresh(), highlight(cells, kind), focus() }`. `refresh()` vẽ lại toàn bộ từ `game.state` (vỏ gọi khi replay đổi state ngoài `act`). `highlight(cells, kind)` tô các ô (chỉ số `i` như `state.v`) với `kind` ∈ `"hint"` (gợi ý), `"replay"` (bước replay), `null`/mảng rỗng = xoá; không đổi trạng thái logic. `destroy()` gỡ mọi listener (`game.on` trả hàm huỷ; `keydown` trên document nếu dùng).
- Board **không** giữ trạng thái logic riêng (ô đang chọn, chế độ ghi chú là trạng thái GIAO DIỆN thì được). Mọi thay đổi nội dung bàn đi qua `game.act`, để undo/redo, đếm lỗi, tự lưu, giải xong đều tự chạy. Sau `act` thất bại với `reason: "paused"` thì không báo lỗi (vỏ đang che bàn).
- Hiển thị: ô sai/xung đột theo `type.check(puzzle, game.state).conflicts` **chỉ khi** `settings().showConflicts`; "tô cùng giá trị" chỉ khi `settings().highlightSame`; ô cho sẵn (`type.isGiven`) có kiểu khác ô người chơi điền.
- Bàn co theo bề rộng khung: `host` đã có `container-type: inline-size`; dùng `cqw`/`min()`/CSS grid để kích thước ô tự co; không tràn ngang ở 280–1920 px (kiểm bằng `check.py --co-gian`); điều khiển bấm được (số, chế độ, xoá…) cao ≥ 44 px, ô bàn thì co theo cỡ nhưng vẫn bấm được trên điện thoại; mọi nút có `aria-label`/chữ.
- Bàn phím: mỗi ô là phần tử focus được (roving `tabindex`), mũi tên di chuyển, `aria-label` = `type.describeCell(puzzle, state, i)` (cập nhật khi đổi), vùng bàn có `role="grid"` hoặc tương đương. Phím tắt riêng của loại (Sudoku: 1–9 điền, Shift+số ghi chú, 0/Delete xoá) chỉ bắt khi focus nằm trong bàn và không đang gõ trong ô nhập.
- Cảm ứng: dùng Pointer Events (`pointerdown/move/up`) với `touch-action: none` trên vùng kéo (Nonogram kéo tô nhiều ô). Không dựa vào hover.
- Màu: chỉ dùng token (`var(--text)`, `var(--elev)`, `var(--border)`, `var(--accent)`…) và biến `--pz-*` đã định nghĩa sẵn sáng/tối trong `puzzle.css`: `--pz-cell`, `--pz-cell-given`, `--pz-line`, `--pz-line-strong`, `--pz-given`, `--pz-user`, `--pz-select`, `--pz-same`, `--pz-peer`, `--pz-hint`, `--pz-conflict`, `--pz-conflict-text`, `--pz-replay`, `--pz-good`, `--pz-note`. Cần màu riêng thì khai báo biến `--pz-<id>-*` trong `board-<id>.css` kèm bản `:root[data-theme="dark"]` và `@media (prefers-color-scheme: dark){:root:not([data-theme])…}`, và **đảm bảo chữ ≥ 4,5:1 trên nền** (check.py tầng 1 đo `--pz-*` chung; màu riêng bạn tự đo bằng test). Tiền tố lớp CSS: `.pz-<id>-…` để không đụng loại khác.
- An toàn: mọi chuỗi từ dữ liệu (tên mục logic grid, clue…) vào DOM qua `textContent`/`h()`; không dùng `innerHTML` với dữ liệu người dùng.
- Hiệu năng: vẽ lại theo diff khi có thể (`ev.diff.d` liệt kê ô đổi) thay vì dựng lại toàn bộ; Nonogram 25×25 và Sudoku phải phản hồi tức thì.

**editor(host, env) → editorView** (trình soạn của màn "Tạo puzzle", spec #21–23)
- `env = { input, puzzle, onChange(input), U, ctx, type }`. Nếu có `env.puzzle` thì khởi tạo trình soạn từ puzzle đó (để "Sửa bản sao"); nếu có `env.input` (bản nháp đã khôi phục) thì dùng nó; không có gì thì bắt đầu trống/mặc định. Mỗi lần người dùng sửa, gọi `env.onChange(input)` với `input` là **đối tượng JSON thuần đúng dạng `type.fromInput(input)` nhận** — vỏ sẽ gọi `fromInput` (trong worker, sau 450 ms) để hiện trạng thái nghiệm/độ khó; `onChange` cũng được gọi một lần khi mở.
- Trả `{ getInput(), destroy() }`. Trình soạn trực quan theo loại: Sudoku bấm ô nhập số cho sẵn (+ dán 81 ký tự), N-Queens chọn N và bấm đặt hậu cho sẵn, Lights Out chọn cỡ và bấm bật/tắt đèn, Nonogram vẽ ảnh (kéo) hoặc nhập clue, Logic Grid Builder: danh sách nhóm/mục (thêm/xoá/đổi tên, đánh dấu nhóm có thứ tự) + ô nhập manh mối DSL từng dòng có báo lỗi dòng nào sai.
- Cùng quy tắc co giãn/bàn phím/màu/an toàn như `mount`.

## 10. Thêm một loại puzzle mới (V2: Minesweeper, Kakuro, Sliding…) — danh sách việc

1. `assets/js/puzzles/<id>.js` (engine thuần, mục 1–7) + `kiem/<id>.js` (mục 8, có nguồn sự thật độc lập) — `node kiem.js <id>` xanh.
2. Thêm hai thẻ vào `index.html`: `<script src="./assets/js/puzzles/<id>.js" data-pz></script>` (cạnh các engine khác) và `<script src="./assets/js/ui/boards/<id>.js"></script>`, cộng `<link rel="stylesheet" href="./assets/css/board-<id>.css">`.
3. `assets/js/ui/boards/<id>.js` + `assets/css/board-<id>.css` (mục 9), kèm `check_board_<id>.py` có hàm `run(P, check, section, tid)` — `check.py` tự nạp mọi tệp tên đó.
4. Nếu muốn Daily Puzzle xoay vòng cả loại mới: thêm MỘT phiên bản mới ở cuối `SCHEDULE` trong `core/daily.js` — `{ tu: "<ngày trong tương lai>", ids: <ids phiên bản trước> + id mới ở cuối }` (mục 11.8). KHÔNG sửa phiên bản cũ: đổi danh sách đang dùng là đổi lịch Daily của hôm nay và mọi ngày đã phát.
5. `node kiem.js app` (mô phỏng worker), `python tao-pwa.py`, rồi `python check.py --tat-ca`.
Vỏ (home, new, play, learn, create, library, stats) tự nhận loại mới qua `Puz.types.all()` — không cần sửa. Loại tương tác / tối ưu / có tuỳ chọn: đọc mục 11 trước.

## 11. Puzzle tương tác, tối ưu, options, grade (đợt P1, 23/10/2026)

Mở rộng **tuỳ chọn, tương thích ngược**: loại không khai báo gì ở mục này chạy y như cũ (mẫu vàng `kiem/app-vang.js`: 126 tổ hợp của 5 loại cũ, cùng seed → cùng puzzle).
Một hợp đồng chung cho cả họ "cân xu" (CW1–CW3, Lights Out par) và họ "tối ưu" (lạc đà, xe máy) — không có `goal`, `quality` hay `step()` riêng.
Ví dụ chạy được: hai loại giả trong `kiem/mau/loai-gia.js` (`giatoiuu` optimize có options; `giadoan` interactive có oracle + đối thủ thích nghi).

### 11.1 Thuộc tính tuỳ chọn (conformance kiểm kiểu)

| Thuộc tính | Nội dung |
| --- | --- |
| `kind` | `"static"` (mặc định khi vắng) · `"interactive"` (mỗi nước nhận phản hồi từ oracle: cân xu, đoán) · `"optimize"` (không đúng/sai, nộp kế hoạch, chấm theo mức gần tối ưu). `Puz.types.kindOf(def)`. |
| `objective` | `{ sense: "max"\|"min", label: "Quãng đường xa nhất", unit: "km" }` — **bắt buộc khi `kind:"optimize"`**; loại khác khai báo được (vd cân xu: `{sense:"min", label:"Số lần cân", unit:"lần"}`) để vỏ có đơn vị khi hiện điểm. `unit` là chuỗi, có thể rỗng. |
| `grade(puzzle, state, counters)` | xem 11.4 — **bắt buộc khi `kind:"optimize"`**, tuỳ chọn với loại khác (Lights Out par, CW1). |
| `options` | xem 11.3. |
| `sizeLabel` | nhãn thay cho "Cỡ bàn" ở Puzzle mới / Học ("Phiên bản"). |
| `moveLabel` | `title` của chip "Số nước đi" trên HUD. Chip này LUÔN hiện `game.counters.moves` = số lần gọi `act` (mọi action, kể cả kết luận/mở lại; **hoàn tác không làm giảm**) — nên đặt tên đúng bộ đếm ("Số thao tác", "Số món đã chọn"), KHÔNG đặt tên một đại lượng riêng của loại ("Số lần cân"): đại lượng đó trong state (vd `plan.count`) sẽ khác con số trên chip và mâu thuẫn với bàn (đã gặp ở CW1, sửa sau kiểm P3). Muốn hiện số riêng của loại thì để bàn tự vẽ. |
| `mistakeLabel` | `title` của chip "Số lần điền sai" = `counters.mistakes` = tổng `mistakes()` của mọi nước ("Sai sót", "Nước làm mất tối ưu"); nếu `mistakes()` cộng nhiều thứ (CW1: lần cân mất an toàn + kết luận chưa chứng minh) thì nhãn phải nêu cả hai. |
| `sizeText(puzzle)` | tuỳ chọn, hàm → chuỗi: nhãn cỡ của đề TỰ NHẬP (không có `sizeId` khớp `sizes`) trong tiêu đề/Thư viện ("13 xu + chuẩn · 3 lần cân"); vắng = vỏ nối các khoá của `puzzle.size` ("13×3", không tự giải thích). Vỏ bắt lỗi và rơi về cách cũ; đề sinh ra vẫn dùng `sizes[].label`. |

Dùng `goal` là lỗi conformance (tên cũ của thiết kế camel — đã gộp vào `kind`).

### 11.2 Trạng thái = kế hoạch: `Puz.plan` (`core/plan.js`, data-pz)

Puzzle "dãy hành động rồi nộp/kết luận" không có lưới ô cố định, nhưng `game.js` chỉ biết `state.v` độ dài cố định + diff. Mã hoá:

```
state.v = [ nộp, len, p_0 … p_{extra−1}, rec_0 (W số), …, rec_{cap−1} ]       L = Puz.plan.layout(cap, W, extra)
```

- `nộp` 0/1 — **cờ "đã nộp / đã kết luận" nằm TRONG state**, nên `solution.v` chứa cờ ⇒ Reveal (`diffTo(solution.v)`) và `check(solution).solved` chạy đúng; `kiem/app-worker.js` đòi `check(replay).solved`.
- `len` bản ghi đang dùng; ô sau bản ghi cuối luôn 0 (dạng chuẩn ⇒ cùng kế hoạch, cùng mảng). `p_*` = tham số của lần nộp: **kết luận = nộp kèm tham số** (`submitDiff(state, L, [xu + 1, nặng])`).
- API: `empty(L)`, `build(L, recs, submitted, ps)` (cho `initial`/`solution`), `read`, `record`, `count`, `isSubmitted`, `params`, `valid(state, L)`;
  `appendDiff(state, L, rec|recs, label)`, `truncateDiff(state, L, n, label)` (quay về n bước; khi đã nộp thì đồng thời **mở lại** — `n = len` chỉ mở lại),
  `submitDiff(state, L, ps, label)`. Mọi hàm *Diff trả `null` khi không hợp lệ (tràn `cap`, đã nộp, sai hình dạng) — `moveFor` trả thẳng null, `game.act` coi là noop.
- Action chung nên dùng: `{k:"submit"}`, `{k:"truncate", n}`; action riêng (`weigh`, `trip`, `cmd`…) thêm bản ghi. Mỗi action = MỘT diff ⇒ hoàn tác/làm lại/tự lưu/khôi phục/replay dùng y nguyên.
- **Oracle phải tất định và kết quả ghi vào diff** (không có kênh quan sát ngoài state): cố định = bí mật trong `puzzle.data` (sinh từ seed; lộ qua JSON — chấp nhận với app cá nhân);
  đối thủ = hàm thuần của lịch sử trong `state.v` (phá hoà bằng `Puz.rng.create(hash(...))`). Làm lại / khôi phục áp lại đúng kết quả cũ.
- Trạng thái giao diện tạm (xu đang đặt trên đĩa trước khi bấm "Cân", km đang chọn) là trạng thái **board**, không vào `state`.

### 11.3 `options` — tham số sinh đề ngoài (cỡ, bậc)

```
options: [{ id: "mode", label: "Chế độ", choices: [{ id: "fixed", label: "Xu giả cố định" }, { id: "adv", label: "Đối thủ thích nghi", note: "…" }], default: "fixed" }]
```

- `id` khớp `/^[a-z][a-z0-9-]{0,23}$/`, id lựa chọn `/^[A-Za-z0-9][A-Za-z0-9-]{0,23}$/` (không `:` `,` — dùng trong liên kết; không `_` đầu — chặn `__proto__`); ≥ 2 lựa chọn; `default` là một id lựa chọn.
- `generate(seed, {sizeId, tier, options})`: vỏ truyền `options` **dạng gọn** (chỉ lựa chọn khác mặc định) và chỉ cho loại có `def.options`; Daily không truyền (dùng mặc định).
  Engine chuẩn hoá bằng `Puz.types.optionsOf(def, o.options)` (thiếu/lạ → mặc định), **ghi lựa chọn KHÁC mặc định vào `puzzle.data`** (⇒ `puzzleId` khác, yêu thích/thư viện phân biệt được)
  và trả `puzzle.options = Puz.types.compactOptions(def, full)` (`{}` khi toàn mặc định). Lựa chọn = mặc định tường minh ⇒ cùng puzzle với không truyền.
- Liên kết seed: `#/new/<id>?size=&tier=&seed=&o=mode:adv,rule:x&go=1` (`Puz.types.encodeOptions` theo thứ tự khai báo; `decodeOptions` bỏ rác, không ném).
  Không có `o=` = mặc định ⇒ liên kết cũ giữ nghĩa; loại không có options thì liên kết y hệt dạng cũ.
- Vỏ: Puzzle mới thêm một hàng chip mỗi option (`.ng-opt`), "Chơi tiếp" giữ lựa chọn của ván vừa xong.

### 11.4 `grade` — điểm tối ưu (sao), một hàm duy nhất

```
grade(puzzle, state, counters) → { value, best, quality, stars, valueText, bestText, text }
```

- `value`/`best`: số hữu hạn hoặc `null` (chưa có giá trị), đơn vị = `objective.unit`. `quality` ∈ [0, 1] (3 chữ số; 1 = tối ưu). `stars` nguyên 0..3.
  `valueText`/`bestText`: số đã định dạng **không kèm đơn vị** (vỏ ghép "1 480 / 1 533 km"); `text`: một câu ("Tối ưu!", "Đạt 96 % mức tối ưu").
- Thuần, tất định; `counters` = bản sao `{moves, mistakes, undos, hints:{1,2,3}, revealed}` (để phạt hoàn tác / gợi ý mức 3).
- Theo tỉ lệ: `Puz.grade.fromRatio(value, best, sense, {digits?, fmt?})` — max: value/best, min: best/value, bằng/vượt tối ưu → 1, null → 0.
  Ngưỡng mặc định `starsFor`: 3★ quality = 1 (sau làm tròn 3 chữ số, nên lệch số thực vẫn là tối ưu), 2★ ≥ 0,9, 1★ > 0, 0★ = 0. Dùng cho lạc đà, xe máy, Bachet.
- Tự đặt sao: Lights Out (par: 3★ = K nước, 2★ ≤ K + ⌈K/4⌉…), CW1 (3★ thắng không hoàn tác/đúng k*, 2★ có hoàn tác hoặc gợi ý mức 3) — vẫn trả ĐỦ trường (lấy `fromRatio` rồi đặt lại `stars`, `text`).
- Vỏ không tin engine: `game.grade()` = `Puz.grade.normalize(def.grade(...))` (kẹp, điền chữ thiếu; ném lỗi → null, ván vẫn kết thúc được).
  `game.record("solved")` thêm `record.grade` (một đối tượng); ván revealed/abandoned không có grade; loại không có `grade` giữ đúng các trường cũ.
- Hiển thị: HUD loại `optimize` có chip giá trị hiện có (`.hud-score`, chỉ `valueText` — KHÔNG lộ tối ưu khi đang chơi); hộp thoại "Đã giải" giữ 4 ô cũ + ô **"Điểm tối ưu"**
  (sao + "giá trị / tối ưu đơn vị", `.stat-grade`) + dòng `text`; dòng trạng thái sau khi xong; sao trong dòng lịch sử ở Thống kê.
- Test của loại: `Puz.grade.errors(def.grade(...))` rỗng (đủ trường, không chữ rác); `grade(solution)` có `quality === 1` với loại optimize.

### 11.5 Ngữ nghĩa các hàm hợp đồng với loại interactive / optimize

| Hàm | Ngữ nghĩa |
| --- | --- |
| `check` | vẫn thuần `{ solved, conflicts, filled, total, complete? }`. `solved = đã nộp && complete` (optimize) hoặc `đã kết luận && kết luận bị lịch sử ÉP BUỘC` (interactive — đoán may không tính). `total` = số bước của kế hoạch tối ưu. Giá trị/điểm KHÔNG nằm ở đây mà ở `grade`. |
| `solution` | MỘT kế hoạch tối ưu (với interactive: ván chơi tối ưu chống chính oracle đó) + cờ đã nộp. |
| `mistakes(p, s, diff)` | số nước làm **mất khả năng thắng chắc / mất tối ưu**, nếu engine xác định chắc chắn (CW1, lạc đà); kết luận/nộp sai bằng chứng = 1; không xác định được thì 0 (xe máy). |
| `hint(p, s, level, settings)` | trạng thái đã mất tối ưu / kết luận chưa chứng minh ⇒ nói trước, mức 3 `action:{k:"truncate", n:j}` (j = tiền tố dài nhất còn tối ưu; n = len khi chỉ cần mở lại); còn tối ưu ⇒ nước kế tiếp của một kế hoạch tối ưu; đã đạt tối ưu ⇒ mức 3 là `{k:"submit"}` (hoặc kết luận) — để vòng "gợi ý → áp dụng" của check.py kết thúc. `settings` cho kiểu gợi ý (Lights Out: ít bấm nhất / đuổi đèn). |
| `replay` | các bước của `solution`, bước cuối là "Nộp" / "Kết luận". |
| `fromInput`/`validate` | `status:"unique"` = biết chính xác giá trị tối ưu / có chiến lược chắc chắn; `"multiple"` + `warnings` = chỉ biết cận. Thêm `statusText` + `statusKind` (`ok\|warn\|bad`): màn Tạo puzzle in câu này thay cho "Có đúng một nghiệm". |
| `describeCell(p, s, i)` | `i` là chỉ số bước/bản ghi (hoặc xu) theo cách board dùng `highlight`. |

### 11.6 Test bắt buộc thêm (`kiem/<id>.js`, ngoài mục 8)

(a) `check(solution).solved` và `grade(solution).quality === 1` (optimize); (b) giá trị tối ưu đối chiếu **nguồn độc lập** viết riêng trong test (vét cạn cỡ nhỏ / LP / mô phỏng hữu tỉ);
(c) vòng "gợi ý mức 3 → áp dụng" từ trạng thái đầu VÀ từ trạng thái có chèn nước làm mất tối ưu ⇒ `solved` với quality 1, ≤ `total·3` bước;
(d) mọi diff (thêm/quay về/nộp/mở lại) hoàn lại bằng `reverseDiff`, trạng thái luôn `Puz.plan.valid`; (e) kế hoạch đầy dung lượng → `moveFor` trả null, không ném;
(f) interactive: oracle tất định (làm lại/khôi phục cho đúng kết quả cũ), đối thủ luôn nhất quán và giữ được ≥ 2 khả năng khi người chơi đi sai, đoán may không được tính giải;
(g) mỗi lựa chọn của `options`: puzzle.options gọn đúng, id khác đề mặc định, tất định — `kiem/app-worker.js` tự lặp qua mọi lựa chọn trong ngữ cảnh worker;
(h) `Puz.grade.errors(grade(...))` rỗng. Mẫu đầy đủ: `kiem/core-hop-dong.js` với hai loại giả.

### 11.7 check.py

- Vòng đời chung (`tuong_loai`) kiểm HUD dùng nhãn của loại, ô "Điểm tối ưu" chỉ có ở loại có `grade` (loại cũ giữ đúng 4 ô).
- Tầng 3 (sập máy) áp `min(4, số bước replay − 1)` gợi ý trước khi "sập", nên loại có lời giải ngắn không bị giải xong trước.
- `hop_dong()` (tầng 2, Edge `channel="msedge"`): chèn hai loại giả vào trang thật (Blob `<script data-pz>` — trang và worker cùng nạp) và kiểm options/`o=`, nhãn, HUD, hint nhận settings, "Điểm tối ưu", `record.grade`, sao ở Thống kê, `statusText` ở Tạo puzzle, Daily không đổi.

### 11.8 Daily có phiên bản

`core/daily.js` dùng `SCHEDULE = [{ tu: "1970-01-01", ids: [5 loại cũ] }, …]`: ngày d dùng phiên bản cuối có `tu ≤ d`, xoay vòng tính từ `tu`
(phiên bản đầu bắt đầu ngày số 0 nên trùng hệt công thức cũ). Thêm loại vào Daily = thêm phiên bản mới ở cuối với `tu` **trong tương lai** và `ids` = danh sách cũ + id mới ở cuối.
`kiem/personal.js` kiểm: lịch từ 2020-01-01 tới trước phiên bản thứ hai trùng hệt bản cũ, hôm nay không đổi, hình dạng SCHEDULE đúng quy tắc, phiên bản giả định không đổi các ngày trước `tu`.
`Puz.daily.ORDER` = ids của phiên bản mới nhất (thứ tự hiển thị các loại). Đợt P1 CHƯA thêm loại nào vào Daily.

### 11.9 Ví dụ thật: `coinbalance` (đợt P3) — những quyết định đáng bắt chước

- **Trạng thái** = `Puz.plan.layout(k, C+1, 2)` với `C = n + ref`: mỗi bản ghi `[đĩa của xu 0…C−1 (0 ngoài · 1 trái · 2 phải), kết quả (1 trái nặng hơn · 2 cân bằng · 3 phải nặng hơn)]`; kết luận = nộp kèm `[xu + 1, hướng]`. Action `weigh` / `conclude` / `truncate`.
- **Oracle trong `moveFor`**: cố định = `data.secret {coin, heavy}`; đối thủ = hàm thuần của lịch sử (kết quả khó nhất theo DP: cần nhiều lần cân nhất, hoà → nhiều khả năng hơn, hoà → `Puz.rng` từ băm `(data, seed, lịch sử, đĩa)`).
  Kết quả nằm TRONG diff ⇒ hoàn tác / làm lại / khôi phục / replay giữ nguyên. Chứng minh "đối thủ không để lọt": thế đã mất (`!solv`) ⇒ nhánh có `need > r−1` luôn tồn tại và được chọn ⇒ tới hết lượt còn ≥ 2 khả năng (test chơi ngẫu nhiên).
- **`check.solved` = đã kết luận VÀ bị lịch sử ép buộc** (chỉ còn đúng một giả thuyết, khớp xu + hướng); kết luận chưa chứng minh ⇒ `mistakes` = 1, ván tiếp tục, gợi ý mức 3 = `{k:"truncate", n:len}` (mở lại). `conflicts` chỉ khi kết luận MÂU THUẪN với chính các lần cân.
- **`mistakes`** = lần cân làm mất khả năng thắng chắc (một kết quả khả dĩ thành thế không giải được trong số lần còn lại) khi thế trước đó còn giải được; khi đã mất thì không tính lại. Hint khi đã mất: nói trước, nêu lần cân đầu tiên làm mất an toàn + vì sao, mức 3 = `truncate`.
- **grade** (tự đặt sao, vẫn trả đủ trường): value = số lần cân trong state, best = k* (DP); 3★ = thắng chắc chắn không hoàn tác, không gợi ý mức 3, không lần cân mất an toàn; 2★ = có hoàn tác hoặc gợi ý mức 3; 1★ = thắng mà có sai sót (lần cân mất an toàn — có thể là thắng nhờ may — hoặc một lần kết luận chưa được chứng minh rồi phải mở lại; `counters.mistakes` gộp cả hai nên chữ của grade/nhãn HUD nêu cả hai) hoặc dùng nhiều hơn k*; 0★ = chưa xong.
- **Độ khó** = `0,6 + 9·(0,55·sức ép + 0,45·độ hẹp phép cân đầu)` (+ 0,5 đối thủ) — sức ép = khả năng/3^k, độ hẹp = 1 − tỉ lệ phép cân đầu CÒN AN TOÀN (12 xu / 3 lần: 1/6; 39 xu / 4 lần: 1/19); `generate` chọn n trong các n có điểm nằm trong bậc ⇒ 100 % đạt bậc ở cả hai chế độ.
- **Bàn**: xu đang đặt lên đĩa là trạng thái GIAO DIỆN; thông báo kết quả bằng chữ + ◀ ＝ ▶ (không chỉ hình/màu); nút Cân vô hiệu kèm lý do. Trình soạn nói giới hạn "tối đa N xu" bằng `type.lib.maxN` (hàm thuần, nhớ đệm).
- **Chip HUD**: vỏ hiện `counters.moves` (số lần gọi act, hoàn tác không giảm) — CW1 gọi là "Số thao tác", còn "Còn r / k lần cân" là dòng riêng của bàn (đếm trong state). Đừng đặt `moveLabel` theo đại lượng của loại (xem 11.1).
- **Đối thủ & seed**: phá hoà của đối thủ băm `(data, seed, lịch sử, đĩa)` ⇒ `validate(p)` dựng lại bằng `p.seed` để ra ĐÚNG `p.solution`; `fromText/fromFile` bỏ seed (đề nhập lại là đề tự nhập, seed 0) — đối thủ phá hoà khác nhưng vẫn hợp lệ (cả hai lời giải đều `solved`). Replay/Reveal luôn lấy `p.solution` của chính đề đang chơi. `advResult` trên state hỏng (không còn nhánh khả dĩ) trả 2 thay vì ném lỗi.
- **Trợ năng bàn phím** (mẫu cho bàn có vùng vẽ lại bằng `replaceChildren`): vùng vẽ lại cả hàng bọc bằng `keepFocus(root, fn)` (nhớ vị trí phần tử đang focus, vẽ xong focus lại phần tử cùng vị trí / láng giềng bật gần nhất); lưới nút nhiều phần tử (khay xu, lưới Kết luận) dựng MỘT lần, roving tabindex + `navKey` (mũi tên/Home/End), đổi trạng thái tại chỗ. Nút vừa bấm mà TỰ vô hiệu / ẩn / bị gỡ (Cân, Xoá đĩa, Chốt kết luận, Mở lại để cân tiếp) bọc bằng `keepFocusAfter(fn, to)` — focus đang ở trong bàn mà mất (về BODY / nút bị vô hiệu) thì chuyển tới việc kế tiếp (khay xu, nút "Mở lại"); focus đã sang hộp thoại "Đã giải" thì để nguyên. Mỗi bàn mount dùng id riêng (`aria-describedby` không trùng khi hai bàn cùng tồn tại).
- **Còn mở (vỏ chung, không riêng CW1)**: "Xem lời giải từng bước" mở được giữa ván và không bị phạt ở mọi loại (kể cả Lights Out, CW1) — replay lộ lời giải/xu giả cố định; quyết định chung (chặn giữa ván, hay tính như gợi ý mức 3 / Reveal) để ở lượt kiểm tổng cuối làn.
- `def.lib` (không thuộc hợp đồng chung): `solv/need/bestWeighing/safeWeighings/classesOf/countsOf/coinsFor/records/concluded/playOptimal/lostAt/maxN/strategyTree/whyUnsafe…` cho bàn và test.
