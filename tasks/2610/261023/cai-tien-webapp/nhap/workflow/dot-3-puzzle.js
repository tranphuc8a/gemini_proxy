export const meta = {
  name: 'cai-tien-puzzle',
  description: 'Làn puzzle độc lập (chạy song song với đợt 2): P3 cân đĩa CW1, P4 lạc đà V1, P5 đi bộ + xe máy, P6a CW2 Bachet, P6b CW3 cân điện tử, P7 Lights Out biến thể, P8 Daily + bàn giao; mỗi đợt con có kiểm độc lập',
  phases: [
    { title: 'Puzzle', detail: 'P3 → P4 → P5 → P6a → P6b → P7 → P8' },
    { title: 'Kiểm tổng', detail: 'một lượt kiểm đầy đủ cho app puzzle + bàn giao' },
  ],
}

const ROOT = 'tasks/2610/261023/cai-tien-webapp'
const PY = 'backend/fastapi/.venv/Scripts/python.exe'
const LPS = 'backend/fastapi/webapp/tranphuc8a/logic-puzzle-suite'

const DECISIONS = 'Quyết định đã chốt (ke-hoach.md §6): Q7 cách hiểu puzzle ĐÚNG — CW1 = cân đĩa tìm xu giả (biết nặng hơn / không biết nặng hay nhẹ / có xu chuẩn / chỉ cần chỉ ra xu; chế độ xu cố định theo seed hoặc đối thủ thích nghi), CW2 = bộ quả cân Bachet (ít quả cân nhất; cân hai đĩa 1,3,9,27…), CW3 = cân điện tử (n chồng xu có một chồng giả; xu hai loại khối lượng), lạc đà V1 = một con chở từ kho (đi xa nhất / chở tới đích), xe máy = cách hiểu A mặc định (xem thiết kế) + B tuỳ chọn; đưa 5 loại mới (coinbalance, bachet, coinscale, camel, motorbike) vào Daily bằng lịch có phiên bản theo ngày — việc này CHỈ làm ở P8. Q8 cốt lõi trước — HOÃN: Lights Out D5–D6 (trình soạn biến thể, bàn 12–20), lạc đà V2 (đoàn lạc đà), coinscale chế độ kế hoạch (không thích nghi). Các mặc định ngầm cuối ke-hoach §3 đã duyệt (options/grade như §1.6; CW1 ngân sách lần cân cứng, hoàn tác được nhưng bị ghi nhận; 3 loại xu riêng; lightsoutx là loại riêng, k ∈ {2,3,5}, bàn tự nhập tới 20; lạc đà ăn cả khi quay về, km nguyên, nộp kế hoạch + chấm chất lượng; dùng BigInt).'

const CONTEXT = [
  'BỐI CẢNH: đây là LÀN PUZZLE ĐỘC LẬP, chạy song song với đợt 2 (markdown/wiki/json) trong CÙNG cây làm việc. Đợt 1 đã xong và được chủ dự án commit (HEAD 1c4f5c3): P1 (hợp đồng puzzle hợp nhất: def.kind static|interactive|optimize, objective, def.grade, options, core/plan.js, Daily có lịch phiên bản) và P2 (Lights Out hoàn thiện: bất biến, đuổi đèn, par) đã xong và đạt kiểm độc lập. Thay đổi mới của bạn xem bằng `git diff HEAD` (+ `git status` cho tệp mới); chủ dự án có thể tự commit giữa chừng.',
  'Đọc ' + ROOT + '/ke-hoach.md §1.6 (hợp đồng hợp nhất), §6, §7.1 (ghi chú chuyển tiếp — đặc biệt các gạch về puzzle/P1/P2), ' + ROOT + '/dot/P1.md, ' + ROOT + '/dot/P2.md và bàn giao các đợt puzzle đã xong ở ' + ROOT + '/dot/P*.md; ' + LPS + '/HUONG-DAN-ENGINE.md (mục 11 là hợp đồng mới); thiết kế ' + ROOT + '/thiet-ke/puzzle-lo-coin.md và ' + ROOT + '/thiet-ke/puzzle-camel-bike.md; spec tasks/my-apps/app-8.md.',
  'BẢO VỆ DATABASE THẬT (BẮT BUỘC): app puzzle chạy offline, không cần backend. Đừng import mã backend và đừng chạy uvicorn trong làn này. Nếu một phép kiểm buộc phải import mã backend (không nên), đặt NGAY TRONG LỆNH DB_URL=sqlite+aiosqlite:///<tệp tạm> MONGO_URI= RATE_LIMIT_BACKEND=memory và mọi *_STORAGE_BACKEND=json (backend/fastapi/.env trỏ tới MySQL/Mongo thật và mã backend tự nạp nó). Không đọc/in .env.',
  'TIẾT KIỆM + TĂNG TỐC (chủ dự án yêu cầu đẩy nhanh; phiên trước từng chạm hạn mức): chạy lệnh HẸP khi đang làm (node kiem.js <loại>, một board check); bộ đầy đủ (check.py --chuc-nang --co-gian) ĐÚNG MỘT LẦN ở cuối đợt con khi lệnh hẹp đã xanh; KHÔNG chạy check.py --tat-ca (để dành lượt kiểm tổng cuối làn) và KHÔNG chạy kiem-tat.js hay bộ kiểm của app khác (đợt 2 đang sửa các app đó song song — phép kiểm đỏ của chúng không phải của bạn). Chạy lệnh dài trong nền và làm việc khác (viết bàn giao) trong lúc chờ. NGƯỜI KIỂM: không chạy lại bộ đầy đủ của agent cài (tin báo cáo — các lượt kiểm trước đều tái lập đúng); việc của bạn là đọc diff, tự đối chiếu công thức/solver bằng vét cạn độc lập, tự dựng ca xấu/đột biến, và chạy lệnh hẹp liên quan.',
].join('\n')

const RULES = [
  'Luật:',
  '- Theo CLAUDE.md và skill webapp-thuan (app viết tay, JS thuần, không build, không thư viện/CDN ngoài; tên hàm/biến theo thói quen của tệp). Hành vi mới có test; tính năng giao diện có phép kiểm trình duyệt thật (Edge channel="msedge" qua Playwright; bộ check.py của app đã có Chromium + Pixel 5 + WebKit) — mở rộng check.py và thêm check_board_<loại>.py.',
  '- KHÔNG commit, KHÔNG lệnh git làm đổi cây/chỉ mục (add, stash, checkout, reset, restore, clean, switch, commit). Chỉ đọc git.',
  '- Không thêm dependency. Tệp sinh ra chỉ đổi qua công cụ sinh: sau khi sửa tệp nào của app phải chạy tao-pwa.py; bản chép từ personal-wiki chỉ đổi bằng sync.py. Tệp nhiều regex/dấu \\ ghi bằng Write/Edit rồi node --check/test ngay. Mọi chuỗi từ người dùng/dữ liệu vào innerHTML phải qua hàm thoát.',
  '- 5 loại cũ + Lights Out (P2) KHÔNG được đổi: cùng seed → cùng puzzle (mẫu vàng kiem/app-vang.js, kiem/lightsout-vang.js phải khớp). Đừng thêm loại mới vào Daily trước P8. Engine thuần (chạy được trong Web Worker và bằng node); mỗi loại có solver/par hoặc tối ưu kiểm bằng VÉT CẠN ĐỘC LẬP với cỡ nhỏ; công thức trong thiết kế phải được kiểm lại bằng chương trình (thiết kế ghi rõ chỗ nào chưa chứng minh — chỉ dùng theo cách an toàn).',
  '- Chỉ làm làn puzzle: không sửa tệp ngoài ' + LPS + ' và ' + ROOT + ' (đợt 2 đang sửa markdown-editor, backend, personal-wiki, json-editor, algorithm-notebook song song). Không sửa skill .claude/skills/* hay CLAUDE.md: ghi đề xuất vào dot/<mã>.md. Khi cần ghi vào ' + ROOT + '/ke-hoach.md §7.1 hoặc ban-giao.md: chỉ THÊM vào cuối (cat >>), không viết lại.',
  '- Việc nào trong thiết kế không làm hoặc cố ý bỏ thì ghi rõ lý do. Nếu thiết kế sai/thiếu, chọn cách an toàn nhất và ghi vào "lệch thiết kế".',
].join('\n')

const IMPL = {
  type: 'object',
  properties: {
    ma: { type: 'string' },
    xong: { type: 'array', items: { type: 'string' } },
    bo_qua: { type: 'array', items: { type: 'object', properties: { viec: { type: 'string' }, ly_do: { type: 'string' } }, required: ['viec', 'ly_do'] } },
    tep: { type: 'array', items: { type: 'string' } },
    kiem: { type: 'array', items: { type: 'object', properties: { lenh: { type: 'string' }, dat: { type: 'boolean' }, ket_qua: { type: 'string' } }, required: ['lenh', 'dat', 'ket_qua'] } },
    lech_thiet_ke: { type: 'array', items: { type: 'string' } },
    con_ton: { type: 'array', items: { type: 'string' } },
    so_do: { type: 'string' },
  },
  required: ['ma', 'xong', 'bo_qua', 'tep', 'kiem', 'lech_thiet_ke', 'con_ton'],
}
const VERIFY = {
  type: 'object',
  properties: {
    dat: { type: 'boolean' },
    blocking: { type: 'array', items: { type: 'object', properties: { tep: { type: 'string' }, mo_ta: { type: 'string' }, bang_chung: { type: 'string' } }, required: ['tep', 'mo_ta', 'bang_chung'] } },
    nho: { type: 'array', items: { type: 'string' } },
    kiem: { type: 'array', items: { type: 'object', properties: { lenh: { type: 'string' }, dat: { type: 'boolean' }, tom_tat: { type: 'string' } }, required: ['lenh', 'dat', 'tom_tat'] } },
  },
  required: ['dat', 'blocking', 'nho', 'kiem'],
}

const kiemLoai = (t) => 'node ' + LPS + '/kiem.js ' + t + ' && node ' + LPS + '/kiem.js (toàn bộ, gồm mẫu vàng) ; ' + PY + ' ' + LPS + '/check.py --tinh ; ' + PY + ' ' + LPS + '/check.py --chuc-nang --co-gian (kèm check_board_' + t + '.py; MỘT lần cuối) ; ' + PY + ' ' + LPS + '/tao-pwa.py'

const COMMON_TASK = 'Làm theo hợp đồng hợp nhất của P1 (HUONG-DAN-ENGINE.md mục 11): def.kind, def.objective (nếu optimize), def.grade → {value,best,quality,stars,valueText,bestText,text}, options + liên kết seed o=, hint(…,settings), core/plan.js dùng chung; engine thuần đăng ký Puz.types.register (chạy được trong Worker), sinh theo seed + độ khó (0–10 + 4 bậc), kiểm đề, I/O (JSON/TXT/CSV), solver/chiến lược tối ưu + hint 3 mức có giải thích "vì sao", replay, board ui/boards/<loại>.js tương tác, trình soạn, check_board_<loại>.py, kiem.js <loại> (có vét cạn độc lập), mục tương ứng trong HUONG-DAN-ENGINE.md, liên kết algorithm.links dùng id có thật, tao-pwa.py. CHƯA thêm vào Daily (P8). '

const BATCHES = [
  { ma: 'P3', ten: 'CW1 — cân đĩa tìm xu giả (loại coinbalance)', thietKe: ['puzzle-lo-coin'],
    viec: 'puzzle-lo-coin C1–C6. ' + COMMON_TASK + 'Chi tiết: loại `coinbalance`, kind interactive; options: biến thể (biết nặng hơn / nặng-hoặc-nhẹ / có xu chuẩn / chỉ cần chỉ ra xu) và chế độ (xu cố định theo seed / đối thủ thích nghi nhất quán với mọi kết quả trước); lõi toán DP minimax trên lớp trạng thái U/H/L/G (cận thông tin 3^k KHÔNG đủ — thiết kế đã nêu), oracle; ngân sách lần cân CỨNG, hoàn tác được nhưng bị ghi nhận (không cho "câu" kết quả); gợi ý = phép cân tốt nhất theo lý thuyết thông tin có giải thích; cây quyết định tối ưu (trace); sao theo hoàn tác/gợi ý mức 3; kiểm bằng vét cạn với n nhỏ (12 xu 3 lần là ca kinh điển).',
    kiem: kiemLoai('coinbalance') },
  { ma: 'P4', ten: 'Lạc đà chở chuối V1 — đi xa nhất (loại camel)', thietKe: ['puzzle-camel-bike'],
    viec: 'puzzle-camel-bike việc 2–6 (lạc đà V1; việc 1 = P1 đã xong; V2 đoàn lạc đà HOÃN). ' + COMMON_TASK + 'Chi tiết: loại `camel`, kind optimize; luật: một lạc đà, kho chuối ở A, sức chở C, ăn 1 quả/km KỂ CẢ khi quay về, vị trí km nguyên, được đặt kho trung gian ở mọi km; hai bài "đi xa nhất" và "chở tới đích D"; lời giải tối ưu theo đoạn (B chuối cần ceil(B/C) chuyến chở → 2·ceil(B/C)−1 quả/km, ranh giới đoạn khi B giảm tới bội số C); bộ sinh chọn số sao cho đáp án km nguyên trùng đáp án liên tục (đề tự nhập hiện cả 533 và 533⅓); bàn chơi trục 1 chiều: người chơi lập kế hoạch (đi tới x, đặt/lấy chuối, quay lại), mô phỏng kiểm luật (sức chở, tiêu hao, không âm), nộp kế hoạch → chất lượng so tối ưu (100 % hiện nhãn "Tối ưu!"); ô Lỗi đếm "nước làm mất tối ưu"; bộ đánh giá nước đi (LB2) khớp tối ưu — kiểm bằng vét cạn/DP rời rạc độc lập.',
    kiem: kiemLoai('camel') },
  { ma: 'P5', ten: 'Nhóm đi bộ + xe máy (loại motorbike)', thietKe: ['puzzle-camel-bike'],
    viec: 'puzzle-camel-bike việc 7–9. ' + COMMON_TASK + 'Chi tiết: loại `motorbike`, kind optimize; n người đi bộ từ A đến B hết 1 giờ, k xe máy chở thêm 1 người, tốc độ xe gấp m lần đi bộ, được quay lại đón và BỎ XE bên đường (người đi sau nhặt lên đi tiếp); mặc định cách hiểu A (người lái là người trong nhóm), cách hiểu B là tuỳ chọn (options); mô phỏng hướng sự kiện bằng số hữu tỉ BigInt (không sai số); biểu đồ không–thời gian hoặc dòng thời gian sự kiện nơi người chơi xếp hành động (chở, thả, quay lại, bỏ xe ở x, nhặt xe); tổng thời gian = thời điểm người cuối tới B, so tối ưu; solver: lịch đưa-đón kinh điển, tiếp sức/bỏ xe (chỉ tối ưu khi m ≤ 3 — thiết kế đã đo), cận dưới LP; đề không chia hết: cho chơi kèm cảnh báo "chưa biết tối ưu chính xác" (ô Lỗi để 0). Công thức phải được kiểm lại bằng tìm kiếm/LP độc lập cho n,k nhỏ.',
    kiem: kiemLoai('motorbike') },
  { ma: 'P6a', ten: 'CW2 — bộ quả cân ít nhất (loại bachet)', thietKe: ['puzzle-lo-coin'],
    viec: 'puzzle-lo-coin E1–E3. ' + COMMON_TASK + 'Chi tiết: loại `bachet`, kind optimize; hai chế độ: chọn BỘ quả cân để cân được mọi khối lượng 1..N (quả cân đặt được cả hai đĩa → 1,3,9,27…; chỉ một đĩa → luỹ thừa 2) và ĐẶT quả cân để cân một vật cho trước; chấm theo số quả cân tối thiểu (par); lời giải tối ưu kiểm bằng vét cạn độc lập; board + trình soạn + check_board_bachet.py.',
    kiem: kiemLoai('bachet') },
  { ma: 'P6b', ten: 'CW3 — cân điện tử xác định khối lượng (loại coinscale)', thietKe: ['puzzle-lo-coin'],
    viec: 'puzzle-lo-coin F1–F5 (chế độ KẾ HOẠCH không thích nghi của F2 HOÃN theo Q8; phần thích nghi vẫn làm). ' + COMMON_TASK + 'Chi tiết: loại `coinscale`, kind interactive/optimize theo thiết kế; hai biến thể: n chồng xu có một chồng giả (lấy i xu từ chồng i — 1 lần cân) và mỗi xu thuộc hai loại khối lượng {a,b} (xác định chính xác từng xu với ít lần cân nhất; chiến lược thích nghi; cận thông tin); điểm = số lần cân so tối ưu; minimax thích nghi ở n = 7 quá chậm cho luồng chính → chạy trong Worker hoặc giới hạn cỡ (thiết kế đã nêu); kiểm bằng vét cạn n nhỏ.',
    kiem: kiemLoai('coinscale') },
  { ma: 'P7', ten: 'Lights Out biến thể (loại lightsoutx)', thietKe: ['puzzle-lo-coin'],
    viec: 'puzzle-lo-coin D1–D4 (D5 trình soạn biến thể và D6 bàn 12–20 HOÃN theo Q8). ' + COMMON_TASK + 'Chi tiết: loại RIÊNG `lightsoutx` (giữ nguyên Lights Out cổ điển, Daily, thống kê, mẫu vàng); engine Lights Out tổng quát (luật lân cận khác, lưới xuyến quấn mép, ô bị khoá, mod 2) + GF(3), GF(5) với nhớ khử và đuổi đèn mod p; options (luật, xuyến, số trạng thái k ∈ {2,3,5}, ô khoá) + hiệu chỉnh độ khó theo bậc; sinh tới cỡ 10, tự nhập tới 20; board k mức, ô khoá, xuyến; giải thích vô nghiệm/bất biến cho biến thể nếu thiết kế yêu cầu; kiểm bằng vét cạn độc lập cho bàn nhỏ.',
    kiem: kiemLoai('lightsoutx') },
  { ma: 'P8', ten: 'Daily + tích hợp + bàn giao puzzle', thietKe: ['puzzle-lo-coin', 'puzzle-camel-bike'],
    viec: 'puzzle-lo-coin G1 (+ phần bàn giao của puzzle-camel-bike): thêm các loại mới (coinbalance, bachet, coinscale, camel, motorbike, và lightsoutx nếu G1 nêu) vào Daily bằng lịch có phiên bản theo ngày bắt đầu (core/daily.js SCHEDULE của P1; ngày bắt đầu = ngày hôm nay theo máy; lịch hôm nay/quá khứ KHÔNG đổi — có test như P1), thống kê theo loại/bậc, tích hợp trang chủ/menu/danh mục, liên kết sang Algorithm Notebook theo id có thật (binary-search, coin-change, ternary-search, gaussian-elimination… thêm mục Notebook nếu nhỏ, không thì ghi vào bàn giao), metadata.json của app, HUONG-DAN-ENGINE.md cập nhật mục các loại mới, README/khung bàn giao tasks/2610/<yymmdd>/logic-puzzle-suite-moi/ban-giao.md (tiếng Việt, cô đọng): mỗi loại mới làm gì, công thức đã kiểm bằng gì, hạn chế đã biết (nhãn CW/V là cách hiểu đã chốt ở Q7; xe máy không chia hết; Nonogram/Safari/điện thoại chưa thử), lệnh kiểm.',
    kiem: 'node ' + LPS + '/kiem.js ; ' + PY + ' ' + LPS + '/check.py --tinh ; ' + PY + ' ' + LPS + '/check.py --chuc-nang ; ' + PY + ' ' + LPS + '/tao-pwa.py' },
]

const files = b => b.thietKe.map(k => ROOT + '/thiet-ke/' + k + '.md').join(', ')

function implPrompt(b) {
  return [
    'Bạn là agent THI CÔNG đợt con ' + b.ma + ' — ' + b.ten + ' — trong đợt cải tiến web app của monorepo C:/Users/tranphuc8a/Desktop/gemini_proxy (Windows, Git Bash). Kế hoạch đã được chủ dự án DUYỆT; bạn được phép sửa mã trong ' + LPS + '.',
    CONTEXT,
    'Thiết kế chi tiết: ' + files(b) + ' (đọc mục các việc được giao + phần thiết kế tương ứng). Skill: .claude/skills/webapp-thuan, ban-do-ung-dung (chỉ đọc).',
    DECISIONS,
    '',
    'NHIỆM VỤ: ' + b.viec,
    '',
    'LỆNH KIỂM PHẢI XANH (exit 0) trước khi kết thúc: ' + b.kiem,
    '',
    RULES,
    '',
    'Kết thúc: ghi bàn giao ngắn gọn tiếng Việt vào ' + ROOT + '/dot/' + b.ma + '.md (đã làm gì, tệp đổi, lệnh kiểm + kết quả thật, công thức đã kiểm bằng gì, lệch thiết kế, còn tồn, ghi chú cho đợt puzzle sau). Nếu có điều đợt puzzle sau cần biết, thêm một gạch đầu dòng vào CUỐI ' + ROOT + '/ke-hoach.md (cat >>). Trả về đối tượng có cấu trúc.',
  ].join('\n')
}

function verifyPrompt(b, impl) {
  return [
    'Bạn là người KIỂM ĐỘC LẬP cho đợt con ' + b.ma + ' — ' + b.ten + ' — trong monorepo C:/Users/tranphuc8a/Desktop/gemini_proxy. KHÔNG sửa mã (chỉ tạo tệp nháp ngoài repo).',
    CONTEXT,
    'Thiết kế: ' + files(b) + '; bàn giao của đợt: ' + ROOT + '/dot/' + b.ma + '.md.',
    DECISIONS,
    'Nhiệm vụ đợt: ' + b.viec,
    'Báo cáo của agent cài (đừng tin, hãy kiểm): ' + JSON.stringify(impl),
    '',
    'Việc của bạn:',
    '1. Xem diff (`git diff HEAD`, `git status`; chỉ xét tệp trong ' + LPS + ' và ' + ROOT + '; bỏ qua tệp của đợt 2 đang chạy song song).',
    '2. Tự đối chiếu công thức/solver/par bằng chương trình độc lập CỦA BẠN (vét cạn riêng, không dùng mã của agent cài) trên cỡ nhỏ, và dò ca biên: seed cũ → puzzle cũ (5 loại + Lights Out không đổi), options khác mặc định, đề tự nhập xấu, đầu vào cực đại, Worker, hoàn tác/replay, hint có sai không, điểm sao có hợp lý không, solved có đúng không, người chơi có "câu" được kết quả (interactive) không.',
    '3. Chạy lệnh HẸP liên quan đúng diff (không chạy lại bộ đầy đủ): ví dụ node ' + LPS + '/kiem.js <loại> và check_board_<loại>.py. Lệnh đầy đủ của đợt để tham khảo: ' + b.kiem,
    '4. Tìm cả: lỗi giao diện (360 px, bàn phím/trình đọc màn hình cơ bản, chuỗi vào innerHTML không thoát), độ phức tạp bậc hai/chạy chặn luồng chính, test giả tạo (thử đột biến nếu nghi), vi phạm CLAUDE.md/webapp-thuan (thư viện ngoài, quên tao-pwa.py, thêm vào Daily sớm).',
    '5. Chỉ đánh "blocking" khi có bằng chứng cụ thể (tệp:dòng, số đo, kịch bản tái hiện) và đáng sửa ngay; góp ý nhỏ để ở "nho".',
  ].join('\n')
}

function fixPrompt(b, ver) {
  return [
    'Bạn là agent SỬA cho đợt con ' + b.ma + ' — ' + b.ten + ' (monorepo C:/Users/tranphuc8a/Desktop/gemini_proxy). Người kiểm độc lập tìm ra các vấn đề blocking dưới đây. Sửa đúng gốc (rà luôn chỗ cùng mẫu lỗi), kèm test chứng minh (đỏ trên bản cũ, xanh trên bản mới), chạy lại lệnh kiểm của đợt tới khi xanh (bộ đầy đủ ĐÚNG MỘT LẦN), rồi cập nhật ' + ROOT + '/dot/' + b.ma + '.md (mục "Sửa sau kiểm").',
    CONTEXT,
    'Thiết kế: ' + files(b) + '. ' + DECISIONS,
    'Vấn đề: ' + JSON.stringify(ver.blocking),
    'Góp ý nhỏ (sửa nếu rẻ): ' + JSON.stringify(ver.nho),
    'Lệnh kiểm: ' + b.kiem,
    RULES,
  ].join('\n')
}

async function runBatch(b) {
  const impl = b.skipImpl
    ? { ma: b.ma, xong: ['Đã cài ở lượt trước — xem ' + ROOT + '/dot/' + b.ma + '.md. Cây làm việc có thể chứa bản sửa dở của lượt trước: đọc diff.'], bo_qua: [], tep: [], kiem: [], lech_thiet_ke: [], con_ton: [] }
    : await agent(implPrompt(b), { label: b.ma + ' · cài', phase: 'Puzzle', schema: IMPL })
  if (!impl) { log(b.ma + ': agent cài không trả kết quả'); return { ma: b.ma, ten: b.ten, trang_thai: 'loi_cai' } }
  const fixes = []
  let ver = null
  for (let round = 0; round < 3; round++) {
    if (round === 0 && b.knownBlocking) {
      ver = { dat: false, blocking: b.knownBlocking, nho: b.knownNho || [], kiem: [] }
    } else {
    ver = await agent(verifyPrompt(b, fixes.length ? { ...impl, sua: fixes } : impl), { label: b.ma + ' · kiểm' + (round ? ' #' + (round + 1) : ''), phase: 'Puzzle', schema: VERIFY })
    }
    if (!ver || ver.dat || !ver.blocking.length || round === 2) break
    const fix = await agent(fixPrompt(b, ver), { label: b.ma + ' · sửa #' + (round + 1), phase: 'Puzzle', schema: IMPL })
    if (fix) fixes.push(fix)
  }
  const ok = !!(ver && (ver.dat || !ver.blocking.length))
  log(b.ma + ' (' + b.ten + '): ' + (ok ? 'ĐẠT kiểm độc lập' : 'CÒN VẤN ĐỀ sau ' + fixes.length + ' vòng sửa'))
  return { ma: b.ma, ten: b.ten, trang_thai: ok ? 'dat' : 'con_van_de', impl, fixes, ver }
}

// LƯỢT CHẠY LẠI SAU LỖI 502 THỨ HAI (24/10 ~09:00): P3 đã cài + đã kiểm vòng 1 (1 blocking, dưới đây); vòng sửa #1 bị ngắt giữa chừng (~240 bước, có thể đã sửa dở trong cây).
const P3_BLOCKING = [
  { tep: 'logic-puzzle-suite/assets/js/puzzles/coinbalance.js:643 (moveLabel "Số lần cân") + assets/js/ui/play.js:52 và :185', mo_ta: 'Chip HUD nhãn "Số lần cân" hiển thị game.counters.moves (số lần gọi act: cân + kết luận + mở lại, KHÔNG giảm khi hoàn tác), không phải số lần cân trong state. Mâu thuẫn với dòng "Còn r / k lần cân" của bàn ngay bên cạnh và có thể vượt ngân sách k. Sửa tối thiểu: đổi moveLabel thành "Số thao tác", hoặc cho vỏ đọc một hàm đếm riêng của loại (đúng hơn: chip = số lần cân trong state). Phải sửa trước khi P4–P8 bắt chước mẫu moveLabel này. check_board_coinbalance.py hiện chỉ khẳng định g["moves"] == 1 sau lần cân đầu nên không bắt được lỗi — thêm phép kiểm.', bang_chung: 'Probe Playwright (nn3 n=12, k=3, chuỗi hint mức 3): bước 4 (kết luận, solved) → [moves(game)=4, số lần cân trong state=3], chip "Số lần cân=4" trong khi ngân sách là 3; nn3 n=5: cân → undo → cân lại → chip 2 trong khi bàn ghi "Còn 2 / 3" (state chỉ 1 lần cân); kết luận trượt → chip 3; "Mở lại để cân tiếp" → chip 4.' },
]
const P3_NHO = [
  'mistakeLabel "Lần cân mất an toàn" cũng đếm kết luận chưa chứng minh (kết luận sai ở nn3 → "Lần cân mất an toàn=1" dù không lần cân nào mất an toàn). Đổi nhãn thành "Sai sót" hoặc tương đương.',
  'A11y bàn phím: focus rơi về BODY sau khi kích hoạt chip "Đặt vào" bằng Enter và sau khi chọn xu trong bảng Kết luận (drawConclude/drawTarget/editor render() dựng lại toàn bộ DOM bằng replaceChildren); lưới xu của bảng Kết luận không có roving tabindex/mũi tên (chọn xu số N mất N lần Tab, tới 81). Sửa: cập nhật tại chỗ hoặc focus lại nút tương ứng; thêm roving tabindex + mũi tên cho lưới xu.',
  'advResult (puzzle.js:188-189) lấy top = outs[0] rồi đọc top.need; nếu state hỏng không còn nhánh khả dĩ thì ném TypeError — thêm `if (!outs.length) return 2`.',
  'Test thiếu: grade nhánh slack `used > bestV` (đề tự nhập có k > k*), cells của từng bước replay, tie-break nhiều-khả-năng-hơn của đối thủ.',
  'validate(p).solution khác p.solution ở chế độ đối thủ (fromInput seed=null → tie-break rng khác): vô hại, chỉ ghi chú trong dot/P3.md. Replay luôn mở được không bị phạt: hành vi vỏ chung, chỉ ghi nhận.',
]
const PARTIAL_NOTE = ' LƯU Ý: lượt chạy trước bị ngắt giữa chừng bởi lỗi 502 của dịch vụ; nếu đã có thay đổi dở trong cây làm việc cho đợt này (xem git status/git diff HEAD) thì ĐỪNG làm lại từ đầu và đừng xoá: đọc, giữ cái đúng, sửa cái sai, làm nốt cái thiếu, rồi ghi rõ trong dot/<mã>.md phần nào kế thừa và phần nào viết lại.'
const BATCHES_RUN = BATCHES.map(b => b.ma === 'P3'
  ? { ...b, skipImpl: true, knownBlocking: P3_BLOCKING, knownNho: P3_NHO }
  : { ...b, viec: b.viec + PARTIAL_NOTE })

const results = []
for (const b of BATCHES_RUN) results.push(await runBatch(b))

phase('Kiểm tổng')
const tong = await agent([
  'Bạn là người KIỂM TỔNG làn puzzle (monorepo C:/Users/tranphuc8a/Desktop/gemini_proxy). Không còn agent puzzle nào sửa song song (đợt 2 vẫn có thể đang sửa app khác — bỏ qua phép kiểm đỏ ngoài app puzzle).',
  CONTEXT,
  'Kết quả từng đợt con: ' + JSON.stringify(results.map(r => ({ ma: r.ma, ten: r.ten, trang_thai: r.trang_thai, con_ton: r.impl && r.impl.con_ton, blocking_con: r.ver && r.ver.blocking }))),
  'Việc: (1) chạy MỘT lần bộ kiểm đầy đủ của app puzzle (PYTHONUTF8=1): node ' + LPS + '/kiem.js ; ' + PY + ' ' + LPS + '/check.py --tat-ca ; ' + PY + ' ' + LPS + '/tao-pwa.py --kiem ; và ghi kết quả thật. (2) Phép kiểm đỏ: tìm nguyên nhân; lỗi nhỏ rõ ràng do làn puzzle (quên tao-pwa, test ghim cũ) thì SỬA và chạy lại đúng phép đó; lỗi lớn thì ghi lại, không sửa liều. Không commit, không lệnh git đổi cây/chỉ mục. (3) Ghi ' + ROOT + '/dot/PUZZLE-tong.md (tiếng Việt, cô đọng): bảng đợt con + trạng thái, số phép kiểm trước/sau (trước làn này: kiem.js 1.103, check.py --tat-ca 904), hạn chế đã biết, việc còn tồn, những gì chủ dự án nên tự thử (điện thoại thật, Safari, đọc màn hình), và THÊM (cat >>) một đoạn ngắn "Làn puzzle (24/10) — kết quả" vào cuối ' + ROOT + '/ban-giao.md. Trả về tóm tắt tiếng Việt (markdown) gửi chủ dự án.',
  'Luật: không sửa CLAUDE.md/skill; mọi thứ khác như các đợt trước. ' + RULES,
].join('\n'), { label: 'Kiểm tổng puzzle', phase: 'Kiểm tổng' })

return { results, tong }
