export const meta = {
  name: 'cai-tien-json',
  description: 'Làn JSON Editor độc lập (song song với đợt 2 và làn puzzle): J4 sinh dữ liệu mẫu + suy schema, J5 tài liệu lớn, J6 tìm/thay + JSONPath + định dạng + sửa JSON hỏng, J7 tài liệu; mỗi đợt con có kiểm độc lập',
  phases: [
    { title: 'JSON', detail: 'J4 → J5 → J6 → J7' },
    { title: 'Kiểm tổng', detail: 'một lượt kiểm đầy đủ cho json-editor + bàn giao' },
  ],
}

const ROOT = 'tasks/2610/261023/cai-tien-webapp'
const PY = 'backend/fastapi/.venv/Scripts/python.exe'
const JE = 'backend/fastapi/webapp/tranphuc8a/json-editor'
const WA = 'backend/fastapi/webapp/tranphuc8a'

const DECISIONS = 'Quyết định đã chốt (ke-hoach.md §6): Q6 JSON Editor viết tay, KHÔNG thư viện: chế độ Xem ảo chỉ đọc khi tài liệu > 1,5 MB, tắt ngắt dòng mặc định, nháp lớn lưu IndexedDB. Q8 cốt lõi trước — HOÃN: việc 24 (unevaluatedProperties/unevaluatedItems) và phần khó của JSONPath RFC 9535 + regex-sinh (sinh chuỗi từ pattern phức tạp: chỉ làm tập con đơn giản, pattern không sinh được thì báo "không đảm bảo"). Mặc định ngầm đã duyệt (ke-hoach §3): lỗi format mặc định ở mức cảnh báo; kiểm/sinh chạy trong Worker từ Blob; một schema hiện tại; JSONPath tập con RFC 9535; tự viết ca test; không $ref tới URL ngoài (app offline).'

const CONTEXT = [
  'BỐI CẢNH: đây là LÀN JSON EDITOR ĐỘC LẬP, chạy song song với đợt 2 (markdown/wiki), làn puzzle trong CÙNG cây làm việc. Đã xong và đạt kiểm độc lập: J1 (sửa lỗi + hoàn tác thống nhất + JE_APP), J2 (xem trước khi gập), J3 (JSON Schema kiểm: schema-kiem.js, chay-nen.js Worker, vi-tri.js, ui-schema.js tab Schema, khung kiểm khung-kiem.js). Thay đổi mới của bạn xem bằng `git diff HEAD` (+ `git status`); chủ dự án có thể tự commit giữa chừng.',
  'Đọc ' + ROOT + '/ke-hoach.md §1.7, §6, §7.1 (đặc biệt các gạch về J1/J2/J3 và "TĂNG TỐC"), ' + ROOT + '/dot/J1.md, J2.md, J3.md, J3-nho-chua-sua.md nếu có; thiết kế ' + ROOT + '/thiet-ke/json-editor.md (danh sách việc đánh số 1–32; mục các việc được giao); skill .claude/skills/webapp-thuan.',
  'BẢO VỆ DATABASE THẬT: app JSON chạy offline, không cần backend. Đừng import mã backend, đừng chạy uvicorn trong làn này. Nếu buộc phải, đặt NGAY TRONG LỆNH DB_URL=sqlite+aiosqlite:///<tệp tạm> MONGO_URI= RATE_LIMIT_BACKEND=memory và mọi *_STORAGE_BACKEND=json; không đọc/in .env.',
  'TIẾT KIỆM + TĂNG TỐC: chạy lệnh HẸP khi đang làm (node kiem.js <nhóm>, một nhóm check.py); bộ rộng ĐÚNG MỘT LẦN ở cuối đợt con. KHÔNG chạy kiem-tat.js đủ 8 app (đợt 2 và puzzle đang sửa app khác — đỏ của chúng không phải của bạn); dùng `node ' + WA + '/kiem-tat.js json-editor khung` nếu cần kiểm khung. Chạy lệnh dài trong nền và làm việc khác trong lúc chờ. NGƯỜI KIỂM: không chạy lại bộ đầy đủ của agent cài (các lượt kiểm trước đều tái lập đúng số); việc của bạn là đọc diff, tự dựng đầu vào xấu/đột biến/đối chiếu độc lập (vd so với một cài đặt tham chiếu viết lại riêng, vét cạn cỡ nhỏ), chạy lệnh hẹp liên quan.',
].join('\n')

const RULES = [
  'Luật:',
  '- Theo CLAUDE.md và skill webapp-thuan (JS/CSS thuần, không build, không thư viện/CDN ngoài; tên hàm/biến tiếng Việt không dấu theo thói quen của tệp json-editor; module thuần kiểm bằng node; mở được bằng file://). Hành vi mới có test; tính năng giao diện có phép kiểm trình duyệt thật (Edge channel="msedge" qua Playwright, check.py của json-editor) — mở rộng check.py. Giữ tên truy cập các nút (kiem-hinh.py bấm theo tên). Kết thúc kiem.js bằng dòng "Đạt — …" (khung-kiem.js).',
  '- KHÔNG commit, KHÔNG lệnh git làm đổi cây/chỉ mục (add, stash, checkout, reset, restore, clean, switch, commit). Chỉ đọc git.',
  '- Không thêm dependency. Mọi chuỗi từ người dùng/dữ liệu vào innerHTML phải qua hàm thoát. Hoàn tác = bước mới (datVanBan) theo J1. Tệp nhiều regex/dấu \\ ghi bằng Write/Edit rồi node --check/test ngay. Mọi regex chạy trên dữ liệu người dùng phải tuyến tính (đã nhiều lần gặp lỗi bậc hai) — thêm ca bệnh lý. Lưu ý V8 trên Node v24 làm hỏng khoá một ký tự (`\\`, `"`) qua vòng JSON.stringify → JSON.parse: fuzz phải đối chiếu từ văn bản gốc.',
  '- Chỉ làm làn JSON: không sửa tệp ngoài ' + JE + ' và ' + ROOT + ' (đợt 2: markdown-editor, backend, personal-wiki, algorithm-notebook; làn puzzle: logic-puzzle-suite chạy song song). Không sửa skill .claude/skills/* hay CLAUDE.md: ghi đề xuất vào dot/<mã>.md. Khi cần ghi vào ' + ROOT + '/ke-hoach.md §7.1 hoặc ban-giao.md: chỉ THÊM vào cuối (cat >>), không viết lại. Sau khi sửa tệp nào của app: chạy tao-pwa.py nếu app có (kiểm xem json-editor có PWA không).',
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

const KIEM_CHUNG = 'node ' + JE + '/kiem.js ; ' + PY + ' ' + JE + '/check.py --tinh --chuc-nang ; ' + PY + ' ' + WA + '/kiem-hinh.py json-editor'

const BATCHES = [
  { ma: 'J4', ten: 'Sinh dữ liệu mẫu hợp lệ theo schema + suy schema từ dữ liệu', thietKe: ['json-editor'],
    viec: 'json-editor việc 27–31. (1) Bộ SINH dữ liệu mẫu ngẫu nhiên hợp lệ theo schema, có seed (cùng seed → cùng kết quả): tôn trọng type/enum/const/min-max/độ dài/format/required + một số optional, $ref/$defs đệ quy có giới hạn độ sâu, combinator (oneOf chọn đúng một, anyOf, allOf gộp, not, if/then/else), pattern: chỉ tập con đơn giản (regex-sinh phức tạp HOÃN theo Q8 — pattern không sinh được thì báo "không đảm bảo", đừng bịa); sinh xong TỰ KIỂM lại bằng bộ kiểm của J3, thử lại tối đa N lần, báo phần không đảm bảo được. (2) SUY schema từ dữ liệu (infer): kiểu, required, enum nhỏ, format đoán được, mảng đồng nhất, gộp nhiều mẫu. (3) Giao diện trong tab Schema: nút "Sinh dữ liệu mẫu" (số lượng, seed, độ sâu, xem trước rồi chèn/thay), nút "Suy schema từ dữ liệu"; chạy trong Worker (chay-nen.js) với hạn giờ; hoàn tác là bước mới. Kiểm: sinh⇄kiểm (mọi mẫu sinh ra phải qua validator của J3, trên bộ schema đa dạng — dùng các schema trong kiem/ của J3), suy⇄kiểm (dữ liệu gốc phải hợp lệ với schema suy ra), cùng seed ra cùng kết quả, ca bệnh lý (schema đệ quy sâu, oneOf mâu thuẫn không sinh được, pattern lạ), Edge thật cho giao diện.',
    kiem: 'node ' + JE + '/kiem.js schema && node ' + JE + '/kiem.js ; ' + PY + ' ' + JE + '/check.py --tinh --chuc-nang (MỘT lần cuối) ; ' + PY + ' ' + WA + '/kiem-hinh.py json-editor' },
  { ma: 'J5', ten: 'Tài liệu JSON lớn (không treo, Xem ảo, nháp lớn)', thietKe: ['json-editor'],
    viec: 'json-editor việc 4, 5, 6, 7, 11, 12, 13 (đọc mục các việc này trong thiết kế; bảng đo ở đầu thiết kế). Vấn đề đã đo: dán/mở JSON 1 MB treo 3,4 s, 10 MB treo 31 s; textarea không sửa mượt tài liệu > ~1,5 MB; tab Cây với mảng lớn rất chậm và nặng DOM (hàng triệu nút); nháp > ~5 MB không lưu mà không báo, tải lại hiện bản cũ; dem() đệ quy tràn ngăn xếp. Làm: phân tích/định dạng không chặn luồng chính (chia lát hoặc Worker), Xem ảo chỉ đọc khi > 1,5 MB (cuộn ảo, số dòng ảo cùng kỹ thuật như perf 12 — chia sẻ cách làm, không chia sẻ mã), cây ảo hoá/phân nhóm mảng lớn (vd nhóm 100 phần tử), tắt ngắt dòng mặc định cho tài liệu lớn, nháp lớn lưu IndexedDB (try/catch, báo rõ khi không lưu được, không âm thầm), thông báo khi đang xử lý. Mục tiêu từ thiết kế: input 1 MB < 50 ms (không chặn), mở Xem 10 MB < 1,5 s, kiểm schema 10 MB < 3 s (đo và báo số thật; không nới ngưỡng cho vừa). Thêm tầng check.py --hieu-nang [N] (IndexedDB thật, in số đo, có hệ số máy chậm JE_PERF_SLACK) và --file nếu thiết kế yêu cầu.',
    kiem: 'node ' + JE + '/kiem.js ; ' + PY + ' ' + JE + '/check.py --tinh --chuc-nang ; JE_PERF_SLACK=1 ' + PY + ' ' + JE + '/check.py --hieu-nang 10 (MỘT lần, báo số trước/sau) ; ' + PY + ' ' + WA + '/kiem-hinh.py json-editor' },
  { ma: 'J6', ten: 'Tìm/thay, JSONPath, định dạng, sửa JSON hỏng', thietKe: ['json-editor'],
    viec: 'json-editor việc 14–21 (việc 24 HOÃN; phần khó của RFC 9535 HOÃN — làm tập con đã nêu trong thiết kế). Tìm/thay (văn bản và cây, tô sáng, trước/sau, thay một/tất cả, regex, phân biệt hoa thường, từ nguyên, đếm kết quả, hoàn tác = một bước), đi tới dòng / đường dẫn (JSON Pointer và JSONPath), JSONPath tập con (kể cả các cú pháp hiện thiếu và lỗi phân tích đã nêu ở J1/thiết kế), định dạng (thụt 2/4/tab, nén, sắp khoá, escape/unescape chuỗi, đóng/gỡ chuỗi lồng trên vùng chọn), SỬA JSON hỏng (dấu phẩy thừa, nháy đơn, khoá không nháy, comment, thiếu ngoặc đóng, NaN/Infinity…; xem trước thay đổi rồi áp; không đoán bừa khi mơ hồ — báo), số dòng, dán JSON lớn. Mọi regex/bộ phân tích trên dữ liệu người dùng phải tuyến tính; kiểm với ≥ 60 biểu thức JSONPath và ≥ 30 ca sửa JSON hỏng, tự viết (không thư viện), có fuzz đối chiếu độc lập (nhớ cảnh báo khoá một ký tự dưới Node v24).',
    kiem: 'node ' + JE + '/kiem.js ; ' + PY + ' ' + JE + '/check.py --tinh --chuc-nang (MỘT lần cuối) ; ' + PY + ' ' + WA + '/kiem-hinh.py json-editor' },
  { ma: 'J7', ten: 'Tài liệu + bàn giao JSON Editor', thietKe: ['json-editor'],
    viec: 'json-editor việc 32: cập nhật metadata.json của app, viết HUONG-DAN-SCHEMA.md (tiếng Việt: các từ khoá hỗ trợ, ví dụ, giới hạn đã biết — không $ref URL ngoài, unevaluated* chưa hỗ trợ, regex-sinh hạn chế), README/ghi chú của app, và bàn giao tasks/2610/<yymmdd hôm nay>/json-editor-moi/ban-giao.md (tiếng Việt, cô đọng: JSON Editor giờ làm được gì; công cụ kiểm; hạn chế; việc chủ dự án cần quyết). Đề xuất (KHÔNG tự sửa) cập nhật bảng lệnh CLAUDE.md và skill ban-do-ung-dung cho check.py/kiem-khung.js/khung-kiem.js/kiem-tat.js [lọc] — ghi vào dot/J7.md. Rà cuối toàn app: tab/nút đã có tên truy cập; không URL ngoài; kích thước vỏ trong ngân sách của check.py --tinh.',
    kiem: 'node ' + JE + '/kiem.js ; ' + PY + ' ' + JE + '/check.py --tinh ; ' + PY + ' ' + WA + '/kiem-hinh.py json-editor' },
]

const files = b => b.thietKe.map(k => ROOT + '/thiet-ke/' + k + '.md').join(', ')

function implPrompt(b) {
  return [
    'Bạn là agent THI CÔNG đợt con ' + b.ma + ' — ' + b.ten + ' — trong đợt cải tiến web app của monorepo C:/Users/tranphuc8a/Desktop/gemini_proxy (Windows, Git Bash). Kế hoạch đã được chủ dự án DUYỆT; bạn được phép sửa mã trong ' + JE + '.',
    CONTEXT,
    'Thiết kế chi tiết: ' + files(b) + '.',
    DECISIONS,
    '',
    'NHIỆM VỤ: ' + b.viec,
    '',
    'LỆNH KIỂM PHẢI XANH (exit 0) trước khi kết thúc: ' + b.kiem,
    '',
    RULES,
    '',
    'Kết thúc: ghi bàn giao ngắn gọn tiếng Việt vào ' + ROOT + '/dot/' + b.ma + '.md (đã làm gì, tệp đổi, lệnh kiểm + kết quả thật, số đo, lệch thiết kế, còn tồn, ghi chú cho đợt JSON sau). Nếu có điều đợt JSON sau cần biết, thêm một gạch đầu dòng vào CUỐI ' + ROOT + '/ke-hoach.md (cat >>). Trả về đối tượng có cấu trúc.',
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
    '1. Xem diff (`git diff HEAD`, `git status`; chỉ xét tệp trong ' + JE + ' và ' + ROOT + '; bỏ qua tệp của các làn khác).',
    '2. Tự đối chiếu bằng chương trình độc lập CỦA BẠN (cài đặt tham chiếu viết lại riêng, vét cạn cỡ nhỏ, fuzz vi sai — nhớ khoá một ký tự dưới Node v24), dò ca biên và đầu vào xấu: bậc hai/chạy chặn luồng chính (đo 64 KB vs 256 KB), tràn ngăn xếp, dữ liệu 1–10 MB, Unicode/emoji/surrogate lẻ, __proto__/constructor, hoàn tác, XSS qua innerHTML, tên truy cập nút, 360 px.',
    '3. Chạy lệnh HẸP liên quan đúng diff (không chạy lại bộ đầy đủ). Lệnh đầy đủ của đợt để tham khảo: ' + b.kiem,
    '4. Tìm cả: test giả tạo (thử đột biến nếu nghi), kiem.js có thể xanh giả khi một nhóm treo, vi phạm CLAUDE.md/webapp-thuan (thư viện ngoài, URL ngoài, eval/new Function).',
    '5. Chỉ đánh "blocking" khi có bằng chứng cụ thể (tệp:dòng, số đo, kịch bản tái hiện) và đáng sửa ngay; góp ý nhỏ để ở "nho".',
  ].join('\n')
}

function fixPrompt(b, ver) {
  return [
    'Bạn là agent SỬA cho đợt con ' + b.ma + ' — ' + b.ten + ' (monorepo C:/Users/tranphuc8a/Desktop/gemini_proxy). Người kiểm độc lập tìm ra các vấn đề blocking dưới đây. Sửa đúng gốc (rà luôn chỗ cùng mẫu lỗi), kèm test chứng minh (đỏ trên bản cũ, xanh trên bản mới), chạy lại lệnh kiểm của đợt tới khi xanh (bộ rộng ĐÚNG MỘT LẦN), rồi cập nhật ' + ROOT + '/dot/' + b.ma + '.md (mục "Sửa sau kiểm").',
    CONTEXT,
    'Thiết kế: ' + files(b) + '. ' + DECISIONS,
    'Vấn đề: ' + JSON.stringify(ver.blocking),
    'Góp ý nhỏ (sửa nếu rẻ): ' + JSON.stringify(ver.nho),
    'Lệnh kiểm: ' + b.kiem,
    RULES,
  ].join('\n')
}

async function runBatch(b) {
  const impl = await agent(implPrompt(b), { label: b.ma + ' · cài', phase: 'JSON', schema: IMPL })
  if (!impl) { log(b.ma + ': agent cài không trả kết quả'); return { ma: b.ma, ten: b.ten, trang_thai: 'loi_cai' } }
  const fixes = []
  let ver = null
  for (let round = 0; round < 3; round++) {
    ver = await agent(verifyPrompt(b, fixes.length ? { ...impl, sua: fixes } : impl), { label: b.ma + ' · kiểm' + (round ? ' #' + (round + 1) : ''), phase: 'JSON', schema: VERIFY })
    if (!ver || ver.dat || !ver.blocking.length || round === 2) break
    const fix = await agent(fixPrompt(b, ver), { label: b.ma + ' · sửa #' + (round + 1), phase: 'JSON', schema: IMPL })
    if (fix) fixes.push(fix)
  }
  const ok = !!(ver && (ver.dat || !ver.blocking.length))
  log(b.ma + ' (' + b.ten + '): ' + (ok ? 'ĐẠT kiểm độc lập' : 'CÒN VẤN ĐỀ sau ' + fixes.length + ' vòng sửa'))
  return { ma: b.ma, ten: b.ten, trang_thai: ok ? 'dat' : 'con_van_de', impl, fixes, ver }
}

const results = []
for (const b of BATCHES) results.push(await runBatch(b))

phase('Kiểm tổng')
const tong = await agent([
  'Bạn là người KIỂM TỔNG làn JSON Editor (monorepo C:/Users/tranphuc8a/Desktop/gemini_proxy). Không còn agent JSON nào sửa song song (các làn khác có thể vẫn chạy — bỏ qua phép kiểm đỏ ngoài json-editor).',
  CONTEXT,
  'Kết quả từng đợt con: ' + JSON.stringify(results.map(r => ({ ma: r.ma, ten: r.ten, trang_thai: r.trang_thai, con_ton: r.impl && r.impl.con_ton, blocking_con: r.ver && r.ver.blocking }))),
  'Việc: (1) chạy MỘT lần bộ kiểm đầy đủ json-editor (PYTHONUTF8=1): node ' + JE + '/kiem.js ; ' + PY + ' ' + JE + '/check.py --tat-ca ; node ' + WA + '/kiem-tat.js json-editor khung ; ' + PY + ' ' + WA + '/kiem-hinh.py json-editor ; ghi kết quả thật. (2) Phép kiểm đỏ: tìm nguyên nhân; lỗi nhỏ rõ ràng do làn JSON (quên cập nhật, test ghim cũ) thì SỬA và chạy lại đúng phép đó; lỗi lớn thì ghi lại, không sửa liều. Không commit, không lệnh git đổi cây/chỉ mục. (3) Ghi ' + ROOT + '/dot/JSON-tong.md (tiếng Việt, cô đọng): bảng đợt con + trạng thái, số phép kiểm trước/sau (trước làn này: kiem.js 1.161, check.py 177), số đo hiệu năng tài liệu lớn, hạn chế đã biết, việc còn tồn, những gì chủ dự án nên tự thử (JSON lớn thật, điện thoại), và THÊM (cat >>) một đoạn ngắn "Làn JSON (24/10) — kết quả" vào cuối ' + ROOT + '/ban-giao.md. Trả về tóm tắt tiếng Việt (markdown) gửi chủ dự án.',
  RULES,
].join('\n'), { label: 'Kiểm tổng JSON', phase: 'Kiểm tổng' })

return { results, tong }
