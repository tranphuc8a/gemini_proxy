# Logic Puzzle Suite — bàn giao 17/10/2026

Làm theo `tasks/my-apps/app-8.md` (tiêu đề trong tệp ghi "Ứng dụng 13"). Chủ dự án đã duyệt: **đủ spec, 4 giai đoạn** (loại V2 và khoá PIN/sinh trắc học ngoài phạm vi); Logic Grid dùng manh mối **cơ bản + "hoặc" + thứ tự**. Offline thuần (không backend), JS thuần không build, không thêm thư viện.

## 1. Ở đâu, chạy thế nào
- Nguồn: `backend/fastapi/webapp/tranphuc8a/logic-puzzle-suite/` → `http://localhost:6789/webapp/tranphuc8a/logic-puzzle-suite/` (PWA; cài được trên HTTPS/localhost). Mở bằng `file://` vẫn chơi được nhưng không có service worker và việc sinh puzzle chạy trên luồng chính.
- Lớp (vùng tên `Puz`): `assets/js/core` thuần (`rng`, `util`, `csp`, `types`, `game`, `stats`, `daily`, `progress`, `files`, `gen`) → `puzzles/` (5 engine) → `data` (IndexedDB `schema/store/zip/user/backup`) → `ui` (vỏ + `boards/<loại>.js`). Worker sinh puzzle: `assets/js/worker/gen.js`. CSS: `tokens/base` (chép từ personal-wiki bằng `sync.py`) + `app.css` (khung, từ Algorithm Notebook) + `puzzle.css` (riêng, có bộ biến `--pz-*` sáng/tối) + `board-<loại>.css`.
- **Sửa tệp nào của app cũng phải chạy** `backend/fastapi/.venv/Scripts/python.exe …/logic-puzzle-suite/tao-pwa.py` (đóng dấu `sw.js`; `check.py --tinh` báo lỗi nếu quên). Đã cập nhật: skill `ban-do-ung-dung`, `.claude/CLAUDE.md`, bộ nhớ `logic-puzzle-suite-app.md`.
- **Thêm một loại puzzle mới:** `HUONG-DAN-ENGINE.md` (hợp đồng đầy đủ + danh sách việc ở mục 10). Vỏ tự nhận loại mới qua `Puz.types.all()`.

## 2. Đã làm đủ spec (đối chiếu `app-8.md`)
Năm puzzle V1 **Sudoku, N-Queens, Lights Out, Nonogram, Logic Grid** · giao diện chung `Puzzle Type` (`generate/fromInput/validate/solve/difficulty/hint/replay…`) và **CSP engine chung** (`core/csp.js`) · **seed** (cùng loại+cỡ+bậc+seed → cùng puzzle, kể cả qua liên kết `#/new/<loại>?seed=…&go=1`) · **điểm khó 0–10** + 4 bậc · trạng thái puzzle (đầu / hiện tại / ứng viên / lời giải) · **undo/redo** (hàm ngược trên diff, không chụp ảnh) · **ứng viên/pencil** (Sudoku: bật/tắt, tự gạt, xoá, tự ghi) · **hint 3 mức + Reveal**, mỗi gợi ý mức 3 có "vì sao" · **solver** (0/1/nhiều nghiệm, số bước, kỹ thuật dùng) · **replay lời giải** ◀ ▶ + tự chạy · thống kê mỗi ván · thống kê cá nhân theo loại/bậc + biểu đồ 14 ngày · **streak** + mục tiêu ngày · **tự đề xuất bậc** · **Daily Puzzle** tất định theo ngày · **yêu thích + bộ sưu tập** · **puzzle tự nhập** + trình soạn trực quan cho cả 5 loại + **Logic Builder** (`Alice != Red`, `Bob = Blue`, thứ tự, "hoặc") + kiểm nghiệm duy nhất/nhiều nghiệm · **Constraint View** (biến/miền/ràng buộc) · **giải thích thuật toán** + liên kết sang Algorithm Notebook (`backtracking`, `gaussian-elimination`…) · **trực quan hoá bộ giải** (cây tìm kiếm SVG / các bước khử Gauss) · nhập/xuất **JSON (đúng định dạng spec) / TXT / CSV**, chia sẻ tệp qua Web Share · sao lưu `backup_YYYYMMDD.zip` + khôi phục (gộp/thay thế) · timer + tạm dừng (che bàn) + restart · **offline**.

## 3. Kiến trúc đáng nhớ
- **Hợp đồng loại puzzle** (`HUONG-DAN-ENGINE.md`): mỗi loại là một đối tượng đăng ký `Puz.types.register({...})` với `generate(seed,{sizeId,tier})`, `fromInput`, `validate`, `solve`, `difficulty`, `moveFor`, `check`, `mistakes`, `hint(level)`, `replay`, `constraintView`, `trace`, `toFile/fromFile/toText/fromText`… + siêu dữ liệu (luật, cỡ, bậc sinh được, giải thích thuật toán, cách tính độ khó). `Puz.types.conformance` kiểm hợp đồng.
- **Trạng thái và thao tác:** `state = {v:[…], c:[…]|null}`; mọi thao tác là **diff** `[trường, chỉ số, cũ, mới]` → undo/redo, đếm lỗi, tự lưu, replay dùng chung cho mọi loại; người chơi → engine qua **action** (`{k:"set"|"cand"|"press"|"fill"|"cycle"…}`).
- **Ván chơi** (`core/game.js`): đồng hồ có tạm dừng, `act/undo/redo/hint/applyHint/reveal/restart/serialize/restore/record`.
- **Sinh/giải nặng chạy trong Web Worker** (`core/gen.js`); worker CHỈ nạp các tệp có `data-pz` trong `index.html` (đã từng thiếu `game.js` — bài học ghi ở hợp đồng; `kiem/app-worker.js` mô phỏng đúng ngữ cảnh này). Không có Worker thì chạy tại chỗ sau một nhịp (kết quả y hệt vì engine tất định).
- **Dữ liệu** (IndexedDB `logic-puzzle-suite`): `puzzles`, `collections`, `games` (ván dở, sống sót qua sập máy), `history`, `drafts` (nháp trình soạn), `meta` (thiết lập). Kết thúc ván = **một giao dịch** (ghi lịch sử + xoá ván dở). Tự lưu ván: sau thay đổi 0,4 s, mỗi 5 s, `pagehide`, khi rời màn. Cài đặt đổi có hiệu lực **ngay trong RAM**, ghi đĩa sau (hoàn lại nếu lỗi).
- **Quy tắc UX chốt:** mở lại đúng puzzle đang chơi dở (liên kết seed, Chơi lại từ lịch sử) → **tiếp tục ván cũ**, không chất ván trùng; người chơi chủ động mở một ván dở → chạy tiếp ngay; tạm dừng chủ động / tự tạm dừng khi rời tab → che bàn.

## 4. Năm puzzle (cỡ · bậc sinh được · cách chấm độ khó)
Bậc ghi ở `sizes[].tiers` là bậc **thật sự sinh được ≥ 90 %** theo đo (bậc không quảng cáo thì `generate` trả bậc gần nhất và ghi đúng `puzzle.tier`).
| Loại | Cỡ → bậc | Độ khó dựa trên | Gợi ý |
| --- | --- | --- | --- |
| **Sudoku** 9×9 | bốn bậc | kỹ thuật người khó nhất cần (single, cặp/bộ ba, pointing/claiming, X-Wing, Swordfish, XY-Wing), số lần dùng, số lần đoán, ô trống | giải thích bằng ô/hàng/cột/block ("R5C7 chỉ còn 1 ứng viên {2}…"); khi hết kỹ thuật thì nói thật là "đoán/phản chứng" |
| **N-Queens** | 6: dễ,vừa · 8,10,12: dễ,vừa,khó · 16: bốn bậc (tự nhập N 4–24) | số hậu người chơi phải đặt, số nút quay lui, N | hàng bị ép; hậu sai báo trước |
| **Lights Out** | 3: dễ,vừa,khó · 4: dễ,vừa · 5,6,7: bốn bậc (tự nhập tới 10×10) | số lần bấm tối thiểu (khử Gauss GF(2)) và cỡ | nghiệm ít bấm nhất tính lại từ trạng thái hiện tại; bình thường nhiều nghiệm (không cảnh báo) |
| **Nonogram** | 5: dễ,vừa · 10,15: bốn bậc (tự nhập tới 25×25) | số vòng suy luận dòng, số lần đoán, mật độ | theo dòng/cột (chồng lấn…); bế tắc thì "phản chứng"/"đoán" nói rõ |
| **Logic Grid** | 3×3: dễ,vừa · 3×4: tới khó · 4×4, 4×5, 5×5: bốn bậc | mô phỏng người giải: loại trừ → một manh mối → kết hợp → giả định-bác bỏ → thử-sai; loại manh mối (hoặc/thứ tự) | chỉ ra manh mối cần nhìn rồi chuỗi suy luận |

## 5. Kiểm
| Lệnh (Python = `backend/fastapi/.venv/Scripts/python.exe`) | Phủ |
| --- | --- |
| `node …/kiem.js [loại\|core\|app]` | **929 phép**: lõi (PRNG đối chiếu bản viết lại độc lập, CSP đối chiếu OEIS A000170, ván/undo/đồng hồ), kho dữ liệu (47+, giao dịch nguyên tử, sao lưu zip hỏng/sai app), mô-đun cá nhân (Daily, streak, đề xuất, nhập/xuất, CSV chặn công thức), mô phỏng worker, và test từng engine: Sudoku 123, N-Queens 144, Lights Out 158, Nonogram 135, Logic Grid 150 — mỗi engine có **bộ vét cạn độc lập** và đề công bố khi có nguồn, hint chạy thật tới khi giải xong (có chèn nước sai), tất định, đơn điệu độ khó, đầu vào xấu không ném lỗi |
| `check.py --tinh` | cú pháp, `kiem.js`, tham chiếu, biểu tượng, manifest, dấu `sw.js`, **tương phản ≥ 4,5:1** cho mọi cặp màu token + `--pz-*` trên mọi nền ô/tô sáng (sáng + tối) |
| `check.py --chuc-nang` | Chromium máy tính + **Pixel 5** + **WebKit iPhone 13**: vỏ, vòng đời từng loại (seed, gợi ý 3 mức, hoàn tác, tạm dừng, tải lại giữa ván, giải xong, replay, Reveal, bỏ ván, thống kê), thư viện/bộ sưu tập/xuất–nhập JSON giữa hai trình duyệt/CSV/sao lưu–khôi phục–xoá sạch, trang Học (Constraint View, Show Solver), và `check_board_<loại>.py` (mỗi bàn ~100–140 phép: thao tác, cảm ứng, bàn phím, co giãn, màu riêng, trình soạn) |
| `check.py --song-sot` | **sập renderer** (`chrome://crash`) giữa ván → khôi phục nguyên trạng; đóng thẻ sát nước đi; nháp trình soạn; **offline** (worker sinh puzzle nạp từ cache, chơi, sinh đề, sao lưu); "Có bản mới → Tải lại" không chiếm ván |
| `check.py --co-gian` | dữ liệu xấu nhất (tên dài không ngắt chữ, HTML/JS độc trong tên puzzle/bộ) × 9 bề rộng (280→1920) × 24 màn + bàn chơi 5 loại × Chromium/WebKit/Firefox; menu/hộp thoại trong màn hình; **XSS không chạy** |
| `check.py --hieu-nang [N]` | IndexedDB thật, 10.000 ván lịch sử + 2.000 puzzle: sinh puzzle trong Worker, độ đơ khung hình, khởi động nguội, mở từng màn |
| `check.py --tat-ca` | cả sáu tầng một lượt |

**Lỗi thật do tầng kiểm bắt được và đã sửa:** (1) điều hướng nhanh làm màn dựng chậm **đè lên** màn mới (hàng đợi điều hướng có số thứ tự); (2) kết quả kiểm tra cũ của trình soạn vẫn bật "Chơi thử" trong lúc chờ kiểm lại; (3) `csp.js` gán nhầm "dead" cho nhánh bị cắt bởi `maxNodes` (agent N-Queens phát hiện; có test đối chiếu lần chạy đầy đủ và đã kiểm test bắt được lỗi cũ); (4) **replay hỏng trên trình duyệt** vì worker không nạp `game.js` mà N-Queens/Lights Out gọi `Puz.game.applyDiff` — node thì chạy ổn nên test engine không thấy → thêm `kiem/app-worker.js`; (5) chữ "null" lọt vào khung gợi ý/replay/hộp thoại "Đã giải" (`replaceChildren(null)`); (6) `setSetting` chỉ cập nhật RAM sau khi ghi đĩa → bật/tắt rồi đổi màn ngay có thể vẽ bàn bằng giá trị cũ; (7) mở lại cùng puzzle chất đống ván dở trùng; (8) bảng màu `--pz-*` ban đầu của tôi chưa đủ tương phản (chữ báo lỗi trên nền tô); (9) nút "Tạm dừng" cao 36 px trên điện thoại (ghi đè nhầm); (10) cảnh báo "nhiều nghiệm" hiện cho Lights Out dù là bình thường; (11) khung "Kiểm tra đề" nằm dưới bàn soạn trên điện thoại. Cạm bẫy nhắc lại: **heredoc bash làm mất dấu `\`** — đã làm hỏng `check.py` hai lần khi tôi chèn mã bằng heredoc; chỉ dùng Edit/Write.

## 6. Số đo thật (lượt `--tat-ca` cuối, Chromium headless, máy dev Windows)
- Sinh puzzle trong Worker (đầu-cuối, 5 seed mỗi ô, cỡ mặc định, mọi bậc sinh được): chậm nhất **192 ms** (Logic Grid 4×4 chuyên gia; trung vị 139 ms); Sudoku ≤ 96 ms; N-Queens, Lights Out, Nonogram ≤ 26 ms. Các agent đo riêng (20–100 seed mỗi ô, nhiều cỡ): Logic Grid 5×5 chuyên gia trung vị ~0,4 s, tệ nhất ~1 s; 5×5 khó tệ nhất 1,5 s chạy riêng nhưng tới 6,1 s khi bốn tiến trình tranh CPU (vượt ngân sách 4 s của hợp đồng trong điều kiện đó; test nới được bằng `PUZ_PERF_SLACK`).
- **Giao diện không đơ khi sinh liên tục**: khoảng cách lớn nhất giữa hai khung hình **21 ms**.
- Kho 10.000 ván lịch sử + 2.000 puzzle + 40 bộ: nạp 1,1 s; **khởi động nguội 0,33 s**; JS heap 11 MB; mở trang chủ 20 ms, thống kê 145 ms, thư viện 111 ms (phân trang 60 dòng), cài đặt 80 ms; tính thống kê tổng hợp + streak trên 10.000 ván: 23 ms + 8 ms.
- Dung lượng vỏ + engine + bàn: **862 KB** (< 2 MB).
- **Chưa đo** trên điện thoại thật.

## 7. Kết quả chạy lần cuối
`check.py --tat-ca`: **830 đạt, 0 sai**, exit 0 — tầng 1: 16 · tầng 2: 773 · tầng 3: 23 · tầng 4: 6 · tầng 5: 12 (trong đó `kiem.js` 929 phép chạy ở tầng 1). Tầng 2 từng sai 1 lần ở lượt trước ("bật lại Tô ô xung đột"): đó là điều kiện đua thật của `setSetting` (mục 5, lỗi 6), đã sửa, chạy lại riêng bàn N-Queens 100/100 rồi chạy lại cả `--tat-ca`.

## 8. Giới hạn & nợ đã biết
- **Chưa thử trên iPhone/Samsung thật**, chưa cài PWA qua HTTPS thật, chưa thử trình đọc màn hình (NVDA/VoiceOver) — chỉ có `aria-label`, vai trò lưới, phím mũi tên và kiểm bằng DOM. Firefox chỉ ở tầng co giãn. Cử chỉ **giữ lâu** (N-Queens chấm, Lights Out xem trước chữ thập) chỉ thử được bằng CDP trên Chromium và sự kiện tổng hợp trên WebKit.
- **Nonogram 25×25 trên điện thoại** khó dùng: ô nhỏ, một ngón kéo luôn là tô (cuộn bằng hai ngón/thanh cuộn/nút +−). Ảnh nhiễu 25×25 mật độ 30–50 % không đếm hết nghiệm trong ngân sách → báo "chưa xác định hết" (không treo).
- **Sudoku:** chưa có kỹ thuật chuỗi (coloring, W-Wing, XYZ-Wing, Unique Rectangle, ALS) nên bậc Khó dồn quanh 7,0–7,2 và Chuyên gia thực chất là "cần đoán"; gợi ý mức 3 của kỹ thuật nâng cao có thể dài.
- **Hint "đoán"** (khi logic cạn) chọn nước theo lời giải và nói rõ điều đó; không phải suy luận trực tiếp. Lights Out từ chối bàn đã tắt hết sẵn. N-Queens sinh chỉ cỡ 6/8/10/12/16 (N khác chỉ qua tự nhập).
- Hai thẻ trình duyệt chơi cùng một ván sẽ ghi đè nhau (chưa có khoá ván theo thẻ); dữ liệu khác thì tự đồng bộ qua `BroadcastChannel`.
- Đề xuất độ khó dùng mốc thời gian tham chiếu **ước lượng** (`core/progress.js`), không phải số đo.
- Hiệu chỉnh độ khó từng loại là công thức do tác giả engine chọn rồi chỉnh theo đo (không có chuẩn công bố); đổi trọng số thì tập bậc quảng cáo sẽ đổi.
- Gợi ý cải tiến lõi từ báo cáo engine (chưa làm): `csp.solve` thêm tuỳ chọn `branch` (chỉ phân nhánh biến thật), luật "chỉ còn một chỗ" trong `alldiff`, `reviseTest` dừng sớm — Logic Grid đang tự cài những phần này riêng.
- Đề công bố dùng trong test Sudoku (Arto Inkala 2012, đề "chống vét cạn" của Wikipedia) được agent nhớ từ trí nhớ; test chỉ dùng chúng vì bộ DLX độc lập xác nhận đúng một nghiệm trùng đáp án. Logic Grid không có đề công bố — test dùng ví dụ spec đếm tay và vét cạn.
- Chưa commit (theo quy ước): thư mục `logic-puzzle-suite/`, `tasks/2610/261017/logic-puzzle-suite/`, `.claude/CLAUDE.md`, skill `ban-do-ung-dung`. Thư mục app có thể có `__pycache__/` do `check_board_*.py` (lệnh xoá bị từ chối trong phiên này) — xoá tay được.

## 9. Việc kế tiếp gợi ý
1. Thử trên máy thật qua HTTPS: cài PWA, bàn phím ảo, Nonogram lớn, giữ lâu; kiểm bằng trình đọc màn hình.
2. Loại V2 (Minesweeper, Kakuro, KenKen, Sliding…) theo `HUONG-DAN-ENGINE.md` mục 10 — vỏ không phải sửa.
3. Kỹ thuật chuỗi cho Sudoku Chuyên gia; khoá ván theo thẻ trình duyệt; Daily có bảng xếp hạng/đồng bộ nếu sau này bật backend.
4. Kết nối với #11 Heuristic Playground: Constraint View đã sẵn để mở rộng thành "xem CSP của bất kỳ puzzle".
