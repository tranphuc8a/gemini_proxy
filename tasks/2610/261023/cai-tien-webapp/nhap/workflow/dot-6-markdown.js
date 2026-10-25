export const meta = {
  name: 'cai-tien-markdown-m6-m7',
  description: 'Làn Markdown tiếp theo: M6 định dạng LLM (alerts/callout, trích dẫn, ==mark==, SVG, xuất HTML) rồi M7 PlantUML dịch offline sang Mermaid; mỗi đợt con có kiểm độc lập, "không đạt" cũng tính là chưa xong',
  phases: [
    { title: 'Markdown', detail: 'M6 → M7' },
    { title: 'Kiểm tổng', detail: 'kiểm đầy đủ markdown-editor + bàn giao' },
  ],
}

const ROOT = 'tasks/2610/261023/cai-tien-webapp'
const PY = 'backend/fastapi/.venv/Scripts/python.exe'
const ME = 'markdown-editor'

const CONTEXT = [
  'BỐI CẢNH: LÀN MARKDOWN (markdown-editor/, React + Vite, nguồn ở thư mục gốc repo; bản xuất bản ở backend/fastapi/webapp/tranphuc8a/markdown-editor-pro/ chỉ do `node scripts/build-webapps.mjs --only markdown-editor` sinh ra — đừng sửa assets/index-*.js). Chạy song song với các làn JSON (json-editor), game (logic-puzzle-suite) và bước kiểm tổng đợt 2. Đã xong và nằm trong git: M0–M5 (toán M2: markdownPipeline.ts với thứ tự plugin ghim bằng test, rehypeStyleGuard, mathDelimiters; chia sẻ M3; đồng bộ M4a/M4b; render theo khối M5: blocks.ts, BlockedMarkdownView, previewController). Thay đổi mới xem bằng `git diff HEAD` + `git status`; chủ dự án có thể tự commit giữa chừng.',
  'Đọc ' + ROOT + '/ke-hoach.md §6 (Q4 = phương án (a): dịch PlantUML offline sang Mermaid; phần "Vẽ chính xác" qua /diagram + Kroki thuộc M10 — KHÔNG làm), §7.1 (đặc biệt các gạch M5/M6/M7 và "TĂNG TỐC"), ' + ROOT + '/dot/M2.md, M5.md, M4b.md; thiết kế ' + ROOT + '/thiet-ke/md-render.md (bảng việc 1–16, mục các việc được giao); skill .claude/skills/webapp-react và ban-do-ung-dung (chỉ đọc).',
  'BẢO VỆ DATABASE THẬT: mọi script kiểm của markdown-editor chạy qua scripts/_kiem_chung.py (máy chủ thử với SQLite tạm, đã ép DB_URL/MONGO_URI=/RATE_LIMIT_BACKEND=memory/*_STORAGE_BACKEND=json). Nếu phải chạy mã backend bằng tay, đặt NGAY TRONG LỆNH DB_URL=sqlite+aiosqlite:///<tệp tạm> MONGO_URI= RATE_LIMIT_BACKEND=memory và mọi *_STORAGE_BACKEND=json; không đọc/in backend/fastapi/.env.',
  'TĂNG TỐC + MÁY ĐANG BẬN (nhiều làn chạy song song): chạy lệnh HẸP khi làm (`npx vitest run <tệp>`); `npm test` đầy đủ ĐÚNG MỘT LẦN ở cuối và dùng `--pool=forks --maxWorkers=2` (các ca hết giờ 5 s chập chờn khi máy bận — chạy lại riêng tệp đỏ trước khi kết luận). Các bộ trình duyệt dài (kiem-hieu-nang.py, kiem-pwa.py) chỉ chạy khi diff chạm tới chúng. KHÔNG chạy kiem-tat.js đủ 8 app. NGƯỜI KIỂM: không chạy lại bộ đầy đủ của agent cài; đọc diff, tự dựng đầu vào xấu/đột biến, chạy lệnh hẹp.',
].join('\n')

const RULES = [
  'Luật:',
  '- Theo CLAUDE.md và skill webapp-react: sửa NGUỒN ở markdown-editor/, rồi build. Hành vi mới có vitest; tính năng giao diện có phép kiểm Edge thật (Playwright channel="msedge"). KHÔNG thêm dependency (Q4: bộ dịch PlantUML tự viết; mermaid đã có sẵn). KHÔNG `npm install`.',
  '- Bảo mật: mọi chuỗi từ người dùng/AI/dữ liệu vào HTML phải qua sanitizer; thứ tự plugin của markdownPipeline.ts được ghim bằng test — thêm plugin mới phải sửa test thứ tự có chủ đích; SVG từ người dùng KHÔNG BAO GIỜ thành phần tử `svg` trong DOM (chỉ `img[src^="data:image/svg+xml"]`), `<svg onload>` không thành thuộc tính; mermaid giữ securityLevel strict.',
  '- Mọi regex/bộ phân tích chạy trên dữ liệu người dùng phải TUYẾN TÍNH (M2 đã gỡ 23 đường bậc hai): thêm ca bệnh lý 256 KB (dòng toàn ký tự mở, không đóng, lặp) và đo. Số dòng của tài liệu phải được giữ nguyên qua prepareMarkdown (cuộn đồng bộ và render theo khối M5 dựa vào đó). Không làm render theo khối (blocks.ts) chậm đi: đo lại với tài liệu mẫu.',
  '- KHÔNG commit, KHÔNG lệnh git làm đổi cây/chỉ mục (add, stash, checkout, reset, restore, clean, switch, commit). Chỉ làm trong ' + ME + ', bản build do script sinh, và ' + ROOT + '. Không sửa skill/CLAUDE.md: ghi đề xuất vào dot/<mã>.md. Khi cần ghi vào ke-hoach.md §7.1 hoặc ban-giao.md: chỉ THÊM vào cuối (cat >>). Không đụng json-editor, logic-puzzle-suite, personal-wiki, algorithm-notebook, backend (các làn khác).',
  '- Việc không làm thì ghi rõ lý do. Thiết kế sai/thiếu thì chọn cách an toàn nhất, ghi "lệch thiết kế". Báo số đo thật; KHÔNG nới ngưỡng cho vừa.',
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

const TEST_CMD = 'cd ' + ME + ' && npm test -- --pool=forks --maxWorkers=2 && npm run type-check && npm run lint'
const PUB = 'node scripts/build-webapps.mjs --only markdown-editor && node scripts/build-webapps.mjs --check'

const BATCHES = [
  { ma: 'M6', ten: 'Định dạng của LLM (alerts, trích dẫn, ==mark==, SVG, xuất HTML)',
    viec: 'md-render việc 4, 5, 6, 8, 15. (4) GitHub alerts `> [!NOTE]` (5 loại + bí danh) và callout Obsidian `> [!tip]-` (gập) + CSS sáng/tối đủ tương phản: src/lib/remarkAlerts.ts. (5) Dấu trích dẫn rác của LLM (4 kiểu, ví dụ 【1†source】, [cite: 1], ⟦…⟧ — đọc thiết kế): src/lib/remarkLlmCitations.ts, không đụng code span. (6) `==mark==` (remarkHighlight.ts), bí danh ```mmd = mermaid, front matter giữ nguyên số dòng, tên tệp khối mã (rehypeCodeMeta.ts, CodeBlock.tsx, schema data-meta). (8) SVG: ```svg và <svg> thô → `<img src="data:image/svg+xml...">` (rehypeSvgImage.ts): không còn phần tử svg của người dùng; `<svg onload>` không thành thuộc tính. (15) Xuất HTML: URL font tuyệt đối (+ tuỳ chọn nhúng) trong src/lib/exporters.ts, test hàm thuần. Plugin mới đăng ký trong markdownPipeline.ts, cập nhật test thứ tự một cách có chủ đích. Mỗi plugin có vitest (ca biên, XSS, không đụng code span/khối toán M2), cộng ca trong blocks.test để render theo khối không đổi nghĩa. Số dòng giữ nguyên. Sau cùng build + --check + kiem-pwa.py.',
    kiem: TEST_CMD + ' ; ' + PUB + ' ; ' + PY + ' ' + ME + '/scripts/kiem-pwa.py (nếu diff chạm tới vỏ/PWA)' },
  { ma: 'M7', ten: 'PlantUML dịch offline sang Mermaid',
    viec: 'md-render việc 9, 10, 11, 12, 16 (phần offline của Q4(a); việc 13, 14 /diagram + Kroki là M10 — KHÔNG làm). (9) Bộ dịch src/lib/diagrams/plantuml/{index,common,sequence}.ts: lõi + sequence (participant/actor, mũi tên ->, -->, ->>, alt/opt/loop/par/group, note, activate, autonumber…). (10) {classDiagram,state}.ts. (11) {activity (kiểu mới, if/else/while/repeat/fork lồng ≥ 3 cấp),usecase,mindmap}.ts. Mỗi bộ dịch: vectơ vào→ra đặt trong test (≥ 15 ca/loại + ca lỗi), cú pháp KHÔNG hỗ trợ trả lỗi rõ ràng (Unsupported) chứ không đoán bừa; tuyến tính, không bậc hai (ca bệnh lý 256 KB); nhiều @startuml trong một khối. (12) Component PlantUmlDiagram.tsx: nhận nguồn PlantUML, dịch, đưa cho mermaid (đường vẽ của MermaidDiagram hiện có, strict); `@startuml…@enduml` trần (không rào) → thành rào code trong prepareMarkdown (GIỮ số dòng); nối vào MarkdownView; Unsupported → CodeBlock + thông báo ngắn cạnh khối; CSS. Phải chạy cả ở trang chia sẻ (M3) và chế độ đọc, và trong render theo khối (blocks.ts — xem M5: sơ đồ trong một khối không được vẽ lại khi gõ ở khối khác). (16) Kiểm trình duyệt thật: scripts/kiem-hien-thi.py (Edge, máy chủ thử qua _kiem_chung.py, tài liệu mẫu có mọi định dạng M2/M6/M7: đếm .katex-display/katex-error, svg mermaid, alert, img SVG, khối PlantUML được vẽ, Unsupported hiện đúng, cuộn đồng bộ tới khối toán, xuất HTML có KaTeX, chụp ảnh) rồi build + --check + kiem-pwa.py (PlantUML và KaTeX hoạt động offline). Mermaid thật chạy trong Edge nên phép kiểm chạy nó thật.',
    kiem: TEST_CMD + ' ; ' + PUB + ' ; ' + PY + ' ' + ME + '/scripts/kiem-hien-thi.py ; ' + PY + ' ' + ME + '/scripts/kiem-pwa.py' },
]

function implPrompt(b) {
  return ['Bạn là agent THI CÔNG đợt con ' + b.ma + ' — ' + b.ten + ' — trong monorepo C:/Users/tranphuc8a/Desktop/gemini_proxy (Windows, Git Bash). Kế hoạch đã được chủ dự án DUYỆT; bạn được phép sửa mã trong ' + ME + ' và build lại bản xuất bản.', CONTEXT, 'NHIỆM VỤ: ' + b.viec + ' LƯU Ý: lượt chạy trước bị ngắt giữa chừng bởi lỗi 502 của dịch vụ; nếu cây làm việc đã có thay đổi dở cho đợt này (xem git status/git diff HEAD trong markdown-editor/src/lib, src/components, src/lib/diagrams) thì ĐỪNG làm lại từ đầu và đừng xoá: đọc kỹ, giữ cái đúng, sửa cái sai, làm nốt cái thiếu, ghi rõ trong dot/<mã>.md phần nào kế thừa.', 'LỆNH KIỂM PHẢI XANH (exit 0) trước khi kết thúc: ' + b.kiem, RULES,
    'Kết thúc: ghi bàn giao tiếng Việt ngắn gọn vào ' + ROOT + '/dot/' + b.ma + '.md (đã làm gì, tệp đổi, lệnh kiểm + kết quả thật, số đo, lệch thiết kế, còn tồn, ghi chú cho đợt sau). Trả về đối tượng có cấu trúc.'].join('\n')
}
function verifyPrompt(b, impl) {
  return ['Bạn là người KIỂM ĐỘC LẬP cho đợt con ' + b.ma + ' — ' + b.ten + ' — trong monorepo C:/Users/tranphuc8a/Desktop/gemini_proxy. KHÔNG sửa mã (chỉ tạo tệp nháp ngoài repo).', CONTEXT, 'Nhiệm vụ đợt: ' + b.viec, 'Báo cáo của agent cài (đừng tin, hãy kiểm): ' + JSON.stringify(impl),
    'Việc của bạn: (1) xem diff của ' + ME + ' (bỏ qua tệp của làn khác). (2) tự dựng đầu vào xấu: XSS qua mọi plugin mới (alert/callout, trích dẫn, mark, svg, PlantUML, tên tệp khối mã, data-meta), bậc hai (đo 64 KB vs 256 KB trên dòng toàn ký tự mở/không đóng), số dòng có còn nguyên sau prepareMarkdown không, thứ tự plugin, code span/khối toán M2 có bị đụng không, render theo khối (M5) có còn đúng và nhanh không, trang chia sẻ M3 có vẽ được không, PlantUML sai cú pháp/rất lớn/lồng sâu/nhiều @startuml. (3) chạy lệnh HẸP liên quan, không chạy lại bộ đầy đủ. (4) test giả tạo (thử đột biến nếu nghi), vi phạm CLAUDE.md. (5) Đặt dat=true CHỈ khi mọi phép kiểm trong phạm vi đợt thật sự đạt; số đo hiệu năng đỏ do máy bận thì ghi rõ trong nho nhưng KHÔNG tự đánh đạt. "blocking" chỉ khi có bằng chứng cụ thể (tệp:dòng, số đo, kịch bản tái hiện); góp ý nhỏ để ở "nho".'].join('\n')
}
function fixPrompt(b, ver) {
  return ['Bạn là agent SỬA cho đợt con ' + b.ma + ' (monorepo C:/Users/tranphuc8a/Desktop/gemini_proxy). Người kiểm độc lập chưa cho đạt; sửa đúng gốc các vấn đề dưới đây (rà chỗ cùng mẫu lỗi), kèm test đỏ→xanh, chạy lại lệnh kiểm (bộ rộng ĐÚNG MỘT LẦN), cập nhật ' + ROOT + '/dot/' + b.ma + '.md (mục "Sửa sau kiểm").', CONTEXT, 'Vấn đề blocking: ' + JSON.stringify(ver.blocking), 'Điểm chưa đạt/góp ý (sửa những điểm thật sự làm dat=false hoặc rẻ): ' + JSON.stringify(ver.nho), 'Lệnh kiểm: ' + b.kiem, RULES].join('\n')
}

async function runBatch(b) {
  const impl = await agent(implPrompt(b), { label: b.ma + ' · cài', phase: 'Markdown', schema: IMPL })
  if (!impl) { log(b.ma + ': agent cài không trả kết quả'); return { ma: b.ma, ten: b.ten, trang_thai: 'loi_cai' } }
  const fixes = []
  let ver = null
  let nullRetry = 0
  for (let round = 0; round < 3; round++) {
    ver = await agent(verifyPrompt(b, fixes.length ? { ...impl, sua: fixes } : impl), { label: b.ma + ' · kiểm' + (round ? ' #' + (round + 1) : ''), phase: 'Markdown', schema: VERIFY })
    if (!ver) { if (nullRetry++ < 2) { log(b.ma + ': người kiểm bị lỗi dịch vụ, chạy lại lần ' + nullRetry); round--; continue } break }
    if (ver.dat || round === 2) break
    const fix = await agent(fixPrompt(b, ver), { label: b.ma + ' · sửa #' + (round + 1), phase: 'Markdown', schema: IMPL })
    if (fix) fixes.push(fix)
  }
  const ok = !!(ver && ver.dat)
  log(b.ma + ' (' + b.ten + '): ' + (ok ? 'ĐẠT kiểm độc lập' : 'CHƯA ĐẠT sau ' + fixes.length + ' vòng sửa'))
  return { ma: b.ma, ten: b.ten, trang_thai: ok ? 'dat' : 'chua_dat', impl, fixes, ver }
}

const results = []
for (const b of BATCHES) results.push(await runBatch(b))

phase('Kiểm tổng')
const tong = await agent(['Bạn là người KIỂM TỔNG làn Markdown M6–M7 (monorepo C:/Users/tranphuc8a/Desktop/gemini_proxy). Bỏ qua phép kiểm đỏ ngoài markdown-editor.', CONTEXT,
  'Kết quả từng đợt con: ' + JSON.stringify(results.map(r => ({ ma: r.ma, trang_thai: r.trang_thai, con_ton: r.impl && r.impl.con_ton, nho_con: r.ver && r.ver.nho, blocking_con: r.ver && r.ver.blocking }))),
  'Việc: (1) chạy MỘT lần: cd ' + ME + ' && npm test -- --pool=forks --maxWorkers=2 && npm run type-check && npm run lint ; ' + PUB + ' ; ' + PY + ' ' + ME + '/scripts/kiem-hien-thi.py ; ' + PY + ' ' + ME + '/scripts/kiem-pwa.py ; ' + PY + ' ' + ME + '/scripts/kiem-chia-se.py ; ghi kết quả thật. (2) Phép kiểm đỏ: lỗi nhỏ rõ ràng do làn này thì SỬA và chạy lại đúng phép đó; lỗi lớn hoặc hiệu năng thì ghi, không sửa liều. (3) Ghi ' + ROOT + '/dot/M6-M7-tong.md (tiếng Việt, cô đọng: kết quả, số phép kiểm trước/sau, hạn chế, việc chủ dự án nên tự thử: dán câu trả lời thật của Claude/ChatGPT/Gemini, PlantUML thật, điện thoại) và THÊM (cat >>) đoạn ngắn "Làn Markdown M6–M7 (24/10) — kết quả" vào cuối ' + ROOT + '/ban-giao.md. Trả về tóm tắt tiếng Việt gửi chủ dự án.', RULES].join('\n'), { label: 'Kiểm tổng M6-M7', phase: 'Kiểm tổng' })

return { results, tong }
