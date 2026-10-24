export const meta = {
  name: 'cai-tien-wiki-w6',
  description: 'Làn Wiki độc lập (song song với đợt 2, game, JSON): W6 hydrate KaTeX/mermaid cho Personal Wiki + Algorithm Notebook; có kiểm độc lập và kiểm tổng',
  phases: [
    { title: 'Wiki', detail: 'W6 cài → kiểm → sửa' },
    { title: 'Kiểm tổng', detail: 'kiểm đầy đủ personal-wiki + algorithm-notebook' },
  ],
}

const ROOT = 'tasks/2610/261023/cai-tien-webapp'
const PY = 'backend/fastapi/.venv/Scripts/python.exe'
const WA = 'backend/fastapi/webapp/tranphuc8a'
const PW = WA + '/personal-wiki'
const AN = WA + '/algorithm-notebook'

const CONTEXT = [
  'BỐI CẢNH: LÀN WIKI ĐỘC LẬP, chạy song song với đợt 2 (markdown-editor), làn game (logic-puzzle-suite) và làn JSON (json-editor) trong CÙNG cây làm việc. Đã xong và đạt kiểm độc lập: W1–W5 (đồng bộ, AI soạn note, toán không thư viện W4: markdown.js dựng span.math / div.math.math-d với data-tex; render theo khối W5: .mdb + hook U.rich.hydrate). Thay đổi mới của bạn xem bằng `git diff HEAD` + `git status`; chủ dự án có thể tự commit giữa chừng.',
  'Đọc ' + ROOT + '/ke-hoach.md §6 (Q5 = phương án (a)), §7.1 (đặc biệt hai gạch W6 từ dot/W4.md và dot/W5.md, và gạch "TĂNG TỐC"), ' + ROOT + '/dot/W4.md, ' + ROOT + '/dot/W5.md; thiết kế ' + ROOT + '/thiet-ke/md-render.md việc 18 và 19; skill .claude/skills/webapp-thuan và ban-do-ung-dung (chỉ đọc).',
  'BẢO VỀ DATABASE THẬT: app Wiki chạy offline; check.py của nó dựng máy chủ thử với SQLite tạm. Nếu phải chạy mã backend, đặt NGAY TRONG LỆNH DB_URL=sqlite+aiosqlite:///<tệp tạm> MONGO_URI= RATE_LIMIT_BACKEND=memory và mọi *_STORAGE_BACKEND=json; không đọc/in backend/fastapi/.env.',
  'TĂNG TỐC: chạy lệnh HẸP khi làm; bộ rộng ĐÚNG MỘT LẦN ở cuối. KHÔNG chạy kiem-tat.js đủ 8 app (các làn khác đang sửa app khác). NGƯỜI KIỂM: không chạy lại bộ đầy đủ của agent cài; đọc diff, tự dựng đầu vào xấu/đột biến, chạy lệnh hẹp.',
].join('\n')

const RULES = [
  'Luật:',
  '- Theo CLAUDE.md và skill webapp-thuan: JS thuần, không build. Ứng dụng viết tay không nạp thư viện/CDN ngoài TRỪ những chỗ đã có: Pyodide, mermaid, katex — nên W6 được dùng đúng KaTeX (chép CỤC BỘ vào assets/vendor/katex/, nạp lười) và mermaid (nạp lười từ cdnjs có SRI; offline thì hiện khối mã nguyên văn). KHÔNG `npm install`, KHÔNG thêm dependency: lấy tệp KaTeX từ bản đã cài sẵn (vd markdown-editor/node_modules/katex) và ghi nguồn + phiên bản + giấy phép vào assets/vendor/katex/README.',
  '- Hydrate: chọn .math (span/div), đọc getAttribute("data-tex") (KHÔNG đọc innerHTML), displayMode = classList.contains("math-d"); thay NỘI DUNG nút, giữ data-tex; đánh data-hydrated; chạy lại không đổi gì. KaTeX: throwOnError:false, trust:false, strict:"ignore", macro \\label/\\eqref/\\ref như editor. Thêm aria-label khi hydrate. Hook: U.rich.hydrate(phầnTửKhốiMới[]) cuối renderPreview (chỉ nhận khối MỚI; khối giữ lại đã mang kết quả; cache khối lưu HTML TRƯỚC hydrate). Mọi chuỗi từ người dùng vào innerHTML phải qua hàm thoát; mermaid chạy securityLevel strict. Dùng cho: xem trước editor, chế độ đọc/chi tiết, xuất (PNG vẽ canvas: khối công thức phải vẽ được — đã có nhánh div.math), và Notebook (detail.js).',
  '- Ngân sách: vendor KaTeX tách riêng khỏi vỏ (đọc vòng cộng ở check.py trước, KHÔNG nới ngưỡng vỏ cho vừa; nâng/tách ngưỡng chỉ khi có lý do ghi rõ); service worker cache vendor đúng cách; offline vẫn mở được app và hiện TeX nguyên văn có định dạng khi KaTeX chưa tải.',
  '- Sửa tệp nào của personal-wiki hay algorithm-notebook phải chạy tao-pwa.py của app đó; bản chép markdown.js/notes.js/rich.js sang Notebook chỉ đổi bằng algorithm-notebook/sync.py (+ sync.py --kiem). Tệp nhiều regex/dấu \\ ghi bằng Write/Edit rồi node --check/test ngay. Mọi regex chạy trên dữ liệu người dùng phải tuyến tính.',
  '- KHÔNG commit, KHÔNG lệnh git làm đổi cây/chỉ mục. Chỉ làm trong ' + PW + ', ' + AN + ' và ' + ROOT + '. Không sửa skill/CLAUDE.md: ghi đề xuất vào dot/W6.md. Khi cần ghi vào ke-hoach.md §7.1 hoặc ban-giao.md: chỉ THÊM vào cuối (cat >>).',
  '- Việc không làm thì ghi rõ lý do. Thiết kế sai/thiếu thì chọn cách an toàn nhất, ghi "lệch thiết kế".',
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

const TASK = 'W6 — md-render việc 18 + 19. (18) Wiki: tạo ui/rich.js (hydrate KaTeX/mermaid theo hợp đồng ở phần Luật), nối vào ui/editor.js (hook cuối renderPreview, chỉ khối MỚI), ui/views.js (chế độ đọc), ui/exporters.js (xuất), index.html (nạp lười), chép KaTeX cục bộ vào assets/vendor/katex/ (css + js + fonts cần, tối thiểu), tao-pwa.py; mở rộng check.py: hydrate đúng (data-tex nguyên, aria-label, displayMode), chạy lại không đổi (data-hydrated), XSS qua data-tex/mermaid, offline (chặn mạng: vẫn hiện TeX nguyên văn có định dạng, app dùng được), ngân sách vendor tách riêng, 360 px, hiệu năng gõ ghi chú dài KHÔNG tệ đi (so số đo W5: p95 103 ms ở 400k ký tự) — hydrate chỉ khối mới. (19) Notebook: sync.py (+rich.js), sửa lib-string.js chỗ `$` (dòng ~185) nếu còn chữ `$` giả, luật kiem-lib.js, nối detail.js/exporters.js, tao-pwa.py; check.py --toan/--tat-ca của Notebook xanh. Đo thực tế bằng Edge thật, in số.'
const KIEM = 'node ' + PW + '/kiem.js ; ' + PY + ' ' + PW + '/check.py --tinh --chuc-nang --co-gian --song-sot (MỘT lần cuối; PW_PERF_SLACK=2 nếu máy bận) ; node ' + AN + '/kiem.js ; node ' + AN + '/kiem-lib.js ; ' + PY + ' ' + AN + '/check.py --tinh --toan ; ' + PY + ' ' + AN + '/sync.py --kiem ; tao-pwa.py của cả hai app'

function implPrompt() {
  return ['Bạn là agent THI CÔNG đợt con W6 trong monorepo C:/Users/tranphuc8a/Desktop/gemini_proxy (Windows, Git Bash). Kế hoạch đã được chủ dự án DUYỆT; bạn được phép sửa mã trong ' + PW + ' và ' + AN + '.', CONTEXT, 'NHIỆM VỤ: ' + TASK, 'LỆNH KIỂM PHẢI XANH trước khi kết thúc: ' + KIEM, RULES,
    'Kết thúc: ghi bàn giao tiếng Việt ngắn gọn vào ' + ROOT + '/dot/W6.md (đã làm gì, tệp đổi, lệnh kiểm + kết quả thật, số đo, lệch thiết kế, còn tồn). Trả về đối tượng có cấu trúc.'].join('\n')
}
function verifyPrompt(impl) {
  return ['Bạn là người KIỂM ĐỘC LẬP cho đợt con W6 trong monorepo C:/Users/tranphuc8a/Desktop/gemini_proxy. KHÔNG sửa mã (chỉ tạo tệp nháp ngoài repo).', CONTEXT, 'Nhiệm vụ đợt: ' + TASK, 'Báo cáo của agent cài (đừng tin, hãy kiểm): ' + JSON.stringify(impl),
    'Việc của bạn: (1) xem diff của ' + PW + ' và ' + AN + ' (bỏ qua tệp của làn khác). (2) tự dựng đầu vào xấu: data-tex chứa </script>/"/\'/&#10;/emoji, công thức không đóng, 1.000 công thức trong một ghi chú, mermaid độc hại (click handler, javascript:), mạng bị chặn, KaTeX lỗi, hydrate chạy hai lần, khối được giữ lại sau khi gõ, xuất PNG có công thức; bậc hai/treo luồng chính (đo 64 KB vs 256 KB); vendor có bị tính vào vỏ không; service worker cache; offline. (3) chạy lệnh HẸP liên quan, không chạy lại bộ đầy đủ. (4) test giả tạo (thử đột biến nếu nghi), vi phạm CLAUDE.md (thư viện ngoài ngoài katex/mermaid, npm install, URL ngoài). (5) "blocking" chỉ khi có bằng chứng cụ thể (tệp:dòng, số đo, kịch bản tái hiện); góp ý nhỏ để ở "nho".'].join('\n')
}
function fixPrompt(ver) {
  return ['Bạn là agent SỬA cho đợt con W6 (monorepo C:/Users/tranphuc8a/Desktop/gemini_proxy). Người kiểm độc lập tìm ra vấn đề blocking dưới đây. Sửa đúng gốc (rà chỗ cùng mẫu lỗi), kèm test đỏ→xanh, chạy lại lệnh kiểm (bộ rộng ĐÚNG MỘT LẦN), cập nhật ' + ROOT + '/dot/W6.md (mục "Sửa sau kiểm").', CONTEXT, 'Vấn đề: ' + JSON.stringify(ver.blocking), 'Góp ý nhỏ (sửa nếu rẻ): ' + JSON.stringify(ver.nho), 'Lệnh kiểm: ' + KIEM, RULES].join('\n')
}

const impl = await agent(implPrompt(), { label: 'W6 · cài', phase: 'Wiki', schema: IMPL })
const fixes = []
let ver = null
if (impl) {
  for (let round = 0; round < 3; round++) {
    ver = await agent(verifyPrompt(fixes.length ? { ...impl, sua: fixes } : impl), { label: 'W6 · kiểm' + (round ? ' #' + (round + 1) : ''), phase: 'Wiki', schema: VERIFY })
    if (!ver || ver.dat || !ver.blocking.length || round === 2) break
    const fix = await agent(fixPrompt(ver), { label: 'W6 · sửa #' + (round + 1), phase: 'Wiki', schema: IMPL })
    if (fix) fixes.push(fix)
  }
}
const ok = !!(ver && (ver.dat || !ver.blocking.length))
log('W6: ' + (ok ? 'ĐẠT kiểm độc lập' : 'CÒN VẤN ĐỀ hoặc agent cài lỗi'))

phase('Kiểm tổng')
const tong = await agent(['Bạn là người KIỂM TỔNG làn Wiki (monorepo C:/Users/tranphuc8a/Desktop/gemini_proxy). Bỏ qua phép kiểm đỏ ngoài personal-wiki và algorithm-notebook.', CONTEXT,
  'Kết quả W6: ' + JSON.stringify({ ok, con_ton: impl && impl.con_ton, blocking_con: ver && ver.blocking }),
  'Việc: (1) chạy MỘT lần (PYTHONUTF8=1): node ' + PW + '/kiem.js ; ' + PY + ' ' + PW + '/check.py --tat-ca ; node ' + AN + '/kiem.js ; node ' + AN + '/kiem-lib.js ; ' + PY + ' ' + AN + '/check.py --tat-ca ; ' + PY + ' ' + AN + '/sync.py --kiem; ghi kết quả thật. (2) Phép kiểm đỏ: lỗi nhỏ rõ ràng do làn Wiki thì SỬA và chạy lại đúng phép đó; lỗi lớn thì ghi, không sửa liều. (3) Ghi ' + ROOT + '/dot/WIKI-tong.md (tiếng Việt, cô đọng: kết quả, số phép kiểm trước/sau, hạn chế, việc chủ dự án nên tự thử: điện thoại thật, Safari, offline thật) và THÊM (cat >>) đoạn ngắn "Làn Wiki (24/10) — kết quả" vào cuối ' + ROOT + '/ban-giao.md. Trả về tóm tắt tiếng Việt gửi chủ dự án.', RULES].join('\n'), { label: 'Kiểm tổng Wiki', phase: 'Kiểm tổng' })

return { ok, impl, fixes, ver, tong }
