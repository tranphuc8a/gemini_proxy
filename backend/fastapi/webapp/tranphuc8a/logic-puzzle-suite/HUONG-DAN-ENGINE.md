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

Có sẵn để dùng: `Puz.rng` (seed, `create(seed).int/range/pick/shuffle/chance/fork`), `Puz.util` (bậc độ khó, `puzzleId`, `popcount`, `bitsOf`…), `Puz.csp` (bộ giải CSP tổng quát, xem đầu `core/csp.js`), `Puz.game` (một ván; `applyDiff`, `reverseDiff`, `diffTo`), `Puz.types`.

**Chạy trong Web Worker:** việc nặng (`generate`, `fromInput`, `replay`, `constraintView`, `trace`) được vỏ đẩy sang worker (`core/gen.js` → `worker/gen.js`). Worker CHỈ nạp các tệp có thuộc tính `data-pz` trong `index.html` (hiện: `rng`, `util`, `csp`, `types`, `game` và mọi `puzzles/*.js`); thêm loại mới nghĩa là thêm thẻ `<script src="./assets/js/puzzles/<id>.js" data-pz>`. Engine KHÔNG được dùng thứ gì ngoài danh sách đó (không `Puz.text`, `Puz.stats`, `Puz.ui`…). `kiem/app-worker.js` mô phỏng đúng ngữ cảnh này (vm trống chỉ nạp các tệp `data-pz`) và gọi mọi hàm trên từng loại — **chạy `node kiem.js app` sau khi thêm loại mới**; test engine thường chạy trong node với đủ lõi nên KHÔNG bắt được lỗi thiếu phụ thuộc trong worker (đã từng xảy ra với `Puz.game.applyDiff`).
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
| `hint(puzzle, state, level)` | xem mục 4. |
| `replay(puzzle)` | `[{ text, why?, diff:{d}, cells:[…], technique? }]`: chuỗi bước giải từ `newState(puzzle)` tới lúc `check(...).solved`; áp tuần tự các `diff` phải ra một state thoả `check`. Mỗi bước có `text` tiếng Việt giải thích (spec #14). |
| `constraintView(puzzle)` | `{ summary, variables:[{name, domain, count?}], constraints:[chuỗi], counts:{variables, constraints, …} }` — màn Constraint View (spec #24). Biến nhiều (≥ 40) thì gộp nhóm (`count`). |
| `trace(puzzle, opts)` | trực quan hoá bộ giải (spec #27): `{kind:"tree", nodes:[{id,parent,label,status}], truncated, note}` hoặc `{kind:"matrix", title, steps:[{text, matrix:[[…]], pivot?:[r,c]}], note}`. `status` ∈ `fail|dead|ok|solution`. Giới hạn ≤ 600 nút / ≤ 60 bước. |
| `describeCell(puzzle, state, i)` | chuỗi tiếng Việt cho `aria-label` của ô (vd "Hàng 5, cột 7, ô trống, ứng viên 1 3 7"). |
| `toFile(puzzle)` / `fromFile(obj)` | định dạng chia sẻ (spec #29): `{ type, seed, difficulty:score, size, initialState:"<chuỗi>", solution:"<chuỗi>", metadata:{…} }`. `fromFile` **không tin** `difficulty`/`solution` trong tệp: dựng lại qua `fromInput` rồi trả `{ok, puzzle, errors, warnings}`. |
| `toText(puzzle)` / `fromText(text)` | dạng văn bản đọc được/chép tay (Sudoku: lưới chữ số + `.`; N-Queens: lưới `.`/`Q`…). `fromText(toText(p))` phải cho lại đề có cùng `initial` và `data`. `fromText` chấp nhận cả dạng gọn (Sudoku 81 ký tự `530070000…`) và bỏ qua khoảng trắng/ký tự trang trí; trả `{ok, puzzle, errors, warnings}`. |

## 4. Gợi ý (Hint) — phần làm nên khác biệt "học" so với "chơi" (spec #10–11)

`hint(puzzle, state, level)` trả:

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
4. Nếu muốn Daily Puzzle xoay vòng cả loại mới: thêm id vào `ORDER` trong `core/daily.js` (cuối danh sách, KHÔNG xen giữa — đổi thứ tự là đổi lịch Daily đã phát).
5. `node kiem.js app` (mô phỏng worker), `python tao-pwa.py`, rồi `python check.py --tat-ca`.
Vỏ (home, new, play, learn, create, library, stats) tự nhận loại mới qua `Puz.types.all()` — không cần sửa.
