export const meta = {
  name: 'cai-tien-dot-2',
  description: 'Thi công đợt 2: làn A (M3 liên kết chia sẻ, M4a đồng bộ delta backend, M4b frontend + IndexedDB, M5 render theo khối) ∥ làn B (W3 AI soạn note, J2 metadata khi gập, J3 JSON Schema kiểm, W4 toán Wiki/Notebook, W5 render theo khối Wiki); mỗi đợt con có kiểm độc lập',
  phases: [
    { title: 'Làn A', detail: 'markdown-editor + backend /markdown: M3 → M4a → M4b → M5' },
    { title: 'Làn B', detail: 'wiki/json/notebook + /ai/wiki: W3 → J2 → J3 → W4 → W5' },
    { title: 'Kiểm tổng', detail: 'chạy lại toàn bộ bộ kiểm, cập nhật bàn giao' },
  ],
}

const ROOT = 'tasks/2610/261023/cai-tien-webapp'
const PY = 'backend/fastapi/.venv/Scripts/python.exe'
const WA = 'backend/fastapi/webapp/tranphuc8a'
const PT = 'cd backend/fastapi && .venv/Scripts/python.exe -m pytest'

const LANE_A = 'Làn A: markdown-editor/ (nguồn React), bản build backend/fastapi/webapp/tranphuc8a/markdown-editor-pro/, backend /markdown (controller/usecase/port/adapter/vo markdown_*, markdown_share, markdown_docs + test).'
const LANE_B = 'Làn B: backend/fastapi/webapp/tranphuc8a/{personal-wiki,algorithm-notebook,json-editor}/, backend /ai/wiki (use case + route + test).'

const DECISIONS = 'Quyết định đã chốt (ke-hoach.md §6): Q1 kho markdown mặc định ĐÓNG (MARKDOWN_PUBLIC_READ mặc định false; /files, /sync/changes, /docs/{id} cần quản trị; lịch sử/thùng rác/danh sách link chỉ quản trị; gia cố khoá compare_digest + sai 20 lần/10 phút → 429 + từ chối khoá mặc định ngoài dev); Q2 tạo bảng lúc chạy (CREATE TABLE IF NOT EXISTS như /wiki) + kho mysql mặc định khi deploy — agent chỉ test SQLite; Q3 đồng bộ md đầy đủ + IndexedDB (delta/bản vá dòng, merge 3 chiều hỏi khi đụng, lịch sử 50 bản + 1/ngày 90 ngày + bản đặt tên, khôi phục = bản mới, tự đồng bộ nền, lần đầu khác nhau giữ cả hai, PUT cũ → 409); Q4 PlantUML dịch offline (phần /diagram hoãn); Q5 pandoc + mhchem, Wiki/Notebook chép KaTeX cục bộ nạp lười (ở W6, không phải đợt này); Q6 CodeMirror quyết sau M5; Q8 cốt lõi trước — HOÃN: md-share V13 (QR), V17b (live), V18; md-sync P2 (M8: B9, F9, F10, F12); perf 15–18; JSON việc 24 (unevaluated*) + phần khó RFC 9535/regex-sinh. Mặc định ngầm cuối §3 đã duyệt (md-share: chỉ snapshot, token qua header X-Share-Token, trang xem #share= trong app, mỗi tài liệu một liên kết, hết hạn tuỳ chọn, trần 2 MB, không OG; wiki AI: không sửa note cũ, K = 25 + tuỳ chọn chỉ gửi tiêu đề; JSON: kiểm/sinh trong Worker từ Blob, một schema hiện tại; perf: footnote đi đường cũ, giữ công tắc render=full).'

const CONTEXT = [
  'BỐI CẢNH: đợt 1 đã xong và được chủ dự án commit (HEAD 1c4f5c3). Đợt 2 đã chạy một phần rồi bị ngắt (lỗi 502 của dịch vụ, sau đó dừng để thêm rào bảo vệ DB); cây làm việc hiện CHỨA, đã đạt kiểm độc lập: M3 + M3V (liên kết chia sẻ), W3 (/ai/wiki), J2 (xem trước khi gập), J3 (JSON Schema kiểm), M4a (backend đồng bộ delta); và M4b (frontend đồng bộ + IndexedDB: đã cài xong, đang chờ kiểm độc lập). Hai lượt chạy bị ngắt bởi lỗi 502 của dịch vụ nên có thể còn thay đổi dở của W4/M5/W5. Thay đổi của đợt 2 xem bằng `git diff HEAD` (+ `git status` cho tệp mới). Chủ dự án có thể tự commit giữa chừng — khi đó dựa vào danh sách tệp trong dot/<mã>.md và `git log`.',
  'BẢO VỆ DATABASE THẬT (BẮT BUỘC, kể cả với script nháp "chỉ để dò" hay đo thử): backend/fastapi/.env trỏ tới MySQL/Mongo thật (Aiven) và mã backend TỰ NẠP .env, nên MỌI tiến trình python/node import mã backend (uvicorn, TestClient, script đo, pytest ngoài lệnh chuẩn, build_rate_limiter, factory…) phải chạy với đủ các biến sau đặt NGAY TRONG LỆNH: DB_URL=sqlite+aiosqlite:///<tệp tạm> MONGO_URI= RATE_LIMIT_BACKEND=memory và mọi biến *_STORAGE_BACKEND liên quan (MARKDOWN_STORAGE_BACKEND=json WIKI_STORAGE_BACKEND=json CODESTORE_STORAGE_BACKEND=json…); với script nháp/uvicorn tự dựng thêm AI_ENABLED=false (KHÔNG đặt AI_ENABLED=false khi chạy pytest chuẩn của repo — một số test như test_send_message_endpoint cần AI bật, tests/conftest.py đã chặn gọi Gemini thật). Trước khi chạy một script nháp chạm mã backend, tự hỏi "nó có đọc .env không?" — nếu có thì đặt biến. Không đọc/in nội dung .env. Lần trước một người kiểm lỡ chạy script nháp không đặt biến, build_rate_limiter(auto) đã thử nối Aiven thật (hết giờ nên có lẽ không ghi, nhưng không chứng minh được) — tuyệt đối không lặp lại. Nếu nghi đã lỡ chạm DB thật: DỪNG việc đó, ghi rõ vào báo cáo (mục con_ton/nho) kèm lệnh đã chạy; đừng chạy lại.',
  'Đọc ' + ROOT + '/ke-hoach.md §1 (phần liên quan), §2, §6, §7, §7.1 (ghi chú chuyển tiếp BẮT BUỘC), ' + ROOT + '/ban-giao.md (mục Đợt 1), và bàn giao các đợt trước cùng làn ở ' + ROOT + '/dot/*.md.',
  'TIẾT KIỆM (phiên trước từng chạm hạn mức): chạy mỗi bộ kiểm nặng (pytest toàn bộ, check.py nhiều tầng, kiem-hieu-nang, kiem-pwa) càng ít lần càng tốt — một lần cuối khi đã xanh các lệnh hẹp; không đo doc-30k; khi đang sửa dùng lệnh hẹp (một tệp test, một tầng).',
].join('\n')

const RULES = (mine, other) => [
  'Luật:',
  '- Theo CLAUDE.md của dự án và skill liên quan (.claude/skills/backend-fastapi, webapp-react, webapp-thuan, them-tinh-nang-ai). Hành vi mới có test; tính năng giao diện có phép kiểm trình duyệt thật (Edge qua Playwright, channel="msedge") — mở rộng bộ kiểm sẵn có của app.',
  '- KHÔNG commit, KHÔNG lệnh git làm đổi cây/chỉ mục (add, stash, checkout, reset, restore, clean, switch, commit). Chỉ đọc git.',
  '- KHÔNG gọi Gemini thật (test dùng tests/support/fake_ai.py). KHÔNG kết nối database thật, KHÔNG sửa backend/fastapi/.env, KHÔNG in khoá bí mật. Chạy backend thì DB_URL=sqlite+aiosqlite:///<tệp tạm>, MONGO_URI="", cổng trống (không 6789), tắt tiến trình khi xong. DDL lúc chạy chỉ được kiểm trên SQLite (và tuỳ chọn mongomock nếu repo đã có).',
  '- Không thêm dependency mới. Tệp sinh ra chỉ đổi qua công cụ sinh (build-webapps.mjs, tao-pwa.py, sync.py, sync-math.mjs). Tệp nhiều regex/dấu \\ ghi bằng Write/Edit, rồi node --check / chạy test ngay.',
  '- Mọi chuỗi từ người dùng/AI/dữ liệu vào innerHTML phải qua hàm thoát. Service worker không bao giờ cache API đồng bộ/chia sẻ. Hoàn tác/khôi phục = tạo bản ghi mới hơn, không khôi phục ảnh chụp.',
  '- SONG SONG: agent khác đang làm ' + other + ' trong CÙNG cây. Bạn thuộc ' + mine + ' Không sửa tệp riêng của làn kia. Tệp backend dùng chung (src/config.py hoặc tương đương, main.py/app factory, adapter/factory/*, .env.example, requirements) có thể bị cả hai làn sửa: đọc lại ngay trước khi sửa, chỉ Edit đúng đoạn nhỏ của mình, không viết lại cả tệp. Phép kiểm đỏ do phần dở dang của làn kia thì ghi lại kèm bằng chứng, đừng sửa hộ.',
  '- Việc nào trong thiết kế không làm hoặc cố ý bỏ thì ghi rõ lý do; không lặng lẽ bỏ. Nếu phát hiện chỗ thiết kế sai/thiếu, chọn cách an toàn nhất, ghi vào "lệch thiết kế".',
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

const ME_KIEM = 'cd markdown-editor && npm test && npm run type-check && npm run lint'
const ME_BUILD = 'node scripts/build-webapps.mjs --only <markdown-editor> && node scripts/build-webapps.mjs --check'

const A = [
  { ma: 'M3', ten: 'Liên kết chia sẻ chỉ đọc cho người ẩn danh (+ đóng kho, gia cố khoá)', thietKe: ['md-share', 'md-render'], skill: 'backend-fastapi, webapp-react',
    viec: 'ke-hoach §1.2 việc B0 (dependency require_markdown_admin; _check_admin → check_markdown_admin giữ alias; secrets.compare_digest; đếm sai 20 lần/10 phút/IP → 429 Retry-After; từ chối/cảnh báo khoá mặc định ngoài dev theo Q1) + md-share V1–V12, V14, V15, V16 và V17a với MARKDOWN_PUBLIC_READ mặc định FALSE (Q1): /files (và sau này /sync/changes, /docs/{id}) cần quản trị; giao diện khách bấm "Load from backend" phải báo rõ cần mở khoá. Tuân §1.2: hàm băm dùng chung (application/utils phía backend; src/lib/hash.ts phía client có dự phòng JS thuần vì crypto.subtle không có trên http), VO id dùng đúng regex id mà md-sync B2 sẽ dùng, cấm chia sẻ `root`, giới hạn kích thước gom vào khối cấu hình MARKDOWN_* có chú thích, tạo bảng lúc chạy (Q2). Trang xem công khai #share=<token> trong app (tách ReadingSurface từ ReadingView theo §1.1), không đăng ký/không cần quản trị, credentials:"omit", sơ đồ chỉ vẽ offline, rehypeStyleGuard (M2) bắt buộc, CSP theo thiết kế (font-src self data:), noindex. shareLinkFor dựng URL thư mục ./ (không index.html) — §1.4. Bỏ V13 (QR), V17b (live), V18 theo Q8. Cuối đợt build + xuất bản.',
    kiem: PT + ' tests/application/test_share_links.py tests/application/test_markdown_share_usecase.py tests/adapter/output/markdownshare tests/adapter/input/controller/test_markdown_share_controller.py tests/adapter/input/controller/test_markdown_storage_controller.py -q (tên tệp test theo thiết kế, có thể khác — miễn phủ đủ), rồi ' + PT + ' -q ; ' + ME_KIEM + ' ; ' + PY + ' markdown-editor/scripts/kiem-chia-se.py (tạo mới: chủ tạo link → người ẩn danh ở ngữ cảnh trình duyệt khác mở xem được, toán/mermaid vẽ đúng, không thấy tài liệu khác, thu hồi → 404, token sai bị giới hạn, CSP chặn script lạ) ; ' + ME_BUILD + ' ; ' + PY + ' markdown-editor/scripts/kiem-pwa.py' },
  { ma: 'M4a', ten: 'Đồng bộ delta + lịch sử — backend', thietKe: ['md-sync', 'md-share'], skill: 'backend-fastapi',
    viec: 'md-sync B1–B8, B10, B11 (cổng/kho tài liệu theo từng bản ghi có revision/hash, push delta + bản vá dòng kèm hash gốc, pull theo con trỏ, tombstone, lịch sử phiên bản ghi NGAY từ ngày đầu theo chính sách Q3 (keyframe + delta), chuyển đổi lười từ cây cũ chỉ chạy khi client mới gọi /markdown/sync, MARKDOWN_LEGACY_PUT=allow cho tới M4b, kho json/mysql/mongo với bảng tạo lúc chạy (Q2), B11 dùng B0 của M3 chứ không dùng _check_admin cũ). Quyền đọc /markdown/sync/changes, /markdown/docs/{id} theo cờ MARKDOWN_PUBLIC_READ (mặc định đóng, Q1). Cổng đọc tài liệu theo id phải phục vụ được md-share sau này (§1.2 "chế độ live" — chưa bật live). Bảng đổi id của B10 cập nhật luôn markdown_shares.doc_id. Giới hạn kích thước theo khối MARKDOWN_* của M3 (push 4 MB, tài liệu 3,5 MB, trần Vercel 4,5 MB). Không đụng frontend ở đợt này. Thử chuyển đổi trên bản sao SQLite có dữ liệu kiểu cũ (cây lớn) và chứng minh PUT cũ vẫn chạy.',
    kiem: PT + ' -q tests/application/test_line_patch.py tests/application/test_markdown_docs_*.py tests/adapter/output/markdown_docs tests/adapter/input/controller/test_markdown_docs_controller.py tests/adapter/input/controller/test_markdown_storage_controller.py (tên theo thiết kế, có thể khác), rồi ' + PT + ' -q' },
  { ma: 'M4b', ten: 'Đồng bộ delta + lịch sử — frontend (IndexedDB)', thietKe: ['md-sync', 'perf-md'], skill: 'webapp-react',
    viec: 'md-sync F1–F8, F11 (phần P1): kho cục bộ IndexedDB (chép sang IndexedDB rồi ĐỌC LẠI KIỂM trước khi xoá khoá localStorage v2; giữ LocalStorageDocStore làm dự phòng khi IndexedDB không có/bị chặn — cửa sổ riêng tư), hàng đợi offline, push delta + bản vá dòng cho tài liệu lớn (sha256Hex dùng chung src/lib/hash.ts của M3), pull theo con trỏ, merge 3 chiều theo dòng (đụng → hộp chọn; từ giờ tới M8 không có bản cục bộ lịch sử), lần đầu khác nhau giữ cả hai, tự đồng bộ nền, menu Sync riêng + SyncStatus (F8 bỏ "Save to backend"; gỡ các cảnh báo vá tạm của M1 khi đã thay thế), đối chiếu tài liệu chào phải nhận tập hash LEGACY_WELCOME_SHA256 (M2) để không đẩy welcome cũ lên như tài liệu người dùng; sau đợt này đặt MARKDOWN_LEGACY_PUT về chế độ trả 409 cho client cũ như Q3. Sửa NAP trong kiem-hieu-nang.py và chuyển kiem-pwa.py sang _kiem_chung.py + kiểm IndexedDB (ke-hoach §7.1). Cuối đợt build + xuất bản.',
    kiem: ME_KIEM + ' (vitest có hai thiết bị + máy chủ giả, merge, offline) ; ' + PY + ' markdown-editor/scripts/kiem-dong-bo.py (tạo mới, backend thật SQLite: A→B; ngoại tuyến rồi nối lại; sửa 1 dòng tài liệu 1 MB thì thân push < 2 KB; tải 200 tài liệu/7,4 MB; client PUT cũ → 409; chuyển localStorage → IndexedDB không mất dữ liệu) ; ' + PT + ' -q tests/adapter/input/controller/test_markdown_docs_controller.py tests/adapter/input/controller/test_markdown_storage_controller.py ; ' + ME_BUILD + ' ; ' + PY + ' markdown-editor/scripts/kiem-pwa.py' },
  { ma: 'M5', ten: 'Render theo khối (chỉ vẽ lại khối đổi) + lười sơ đồ', thietKe: ['perf-md', 'md-render'], skill: 'webapp-react',
    viec: 'perf-md việc 6, 7, 8, 9, 10, 11 theo ke-hoach §1.1 "Toán × render theo khối": splitBlocks coi các vùng ```/~~~, $$, dòng \\[ đứng riêng tới \\], \\begin{ENV} đầu dòng tới \\end{ENV}, @startxxx…@endxxx, front matter là chưa đóng; prepareMarkdown chạy theo khối và nhớ theo text khối; bất biến có test: concat(prepare(khối)) == prepare(cả tài liệu) và render từng khối == render cả tài liệu trên kho ca toán của md-render (blocks.test.ts); rehypeEnhance chế độ khối + headingIds; BlockedMarkdownView gắn vào Preview và vào ReadingSurface (M3) → trang chia sẻ hưởng luôn; dựng dần + content-visibility + bảo vệ xuất/in (renderAll + .is-exporting ép vẽ mermaid đang chờ IntersectionObserver, chờ font KaTeX); Mermaid cache SVG theo hash nguồn + hàng đợi + IntersectionObserver; xem lại SAN_SANG/cho_yen trong kiem-hieu-nang.py (§7.1); tài liệu có footnote đi đường render cũ; giữ công tắc render=full. TRƯỚC khi sửa: ghi lại mốc bằng kiem-hieu-nang.py --ghi-moc (doc-2k/10k, trung vị 3) để số trước/sau cùng điều kiện; nâng DOT_HIEN_TAI=M5. Cuối đợt build + xuất bản.',
    kiem: ME_KIEM + ' (blocks.test: khối == cả tài liệu, có ca toán/sơ đồ) ; ' + PY + ' markdown-editor/scripts/kiem-hieu-nang.py --nguong --chi doc-2k,doc-10k (mục tiêu: doc-10k chia đôi gõ p95 ≤ 150 ms, preview cập nhật ≤ 400 ms, mở ≤ 2,5 s, chế độ đọc cuộn p95 ≤ 50 ms; không đạt thì báo số thật + lý do, không nới ngưỡng) ; node scripts/audit-webapps.mjs ; ' + PY + ' markdown-editor/scripts/kiem-chia-se.py ; ' + ME_BUILD + ' ; ' + PY + ' markdown-editor/scripts/kiem-pwa.py' },
]

const B = [
  { ma: 'W3', ten: 'AI soạn note từ dữ liệu thô (POST /ai/wiki)', thietKe: ['wiki-sync-ai'], skill: 'them-tinh-nang-ai, backend-fastapi, webapp-thuan',
    viec: 'wiki-sync-ai việc 6–12 (việc 13 = cập nhật skill/CLAUDE.md thì ghi đề xuất vào bàn giao, không tự sửa CLAUDE.md): use case + route POST /ai/wiki qua AiUseCase.ask (quyền AI_ACCESS, schema JSON đầu ra, chống chèn lệnh, kiểm lại đầu ra: liên kết [[…]]/[[loại::…]] chỉ trỏ tới tiêu đề ứng viên có thật hoặc được đề xuất tạo note mới rõ ràng, có thể tách nhiều note, cache, chọn model qua X-AI-Model); client: chọn trước top-K = 25 note liên quan bằng chỉ mục cục bộ (tiêu đề + tag + đoạn trích ngắn; tuỳ chọn "chỉ gửi tiêu đề"), xếp hạng 10.000 note < 100 ms; xem trước rồi mới áp; AI không sửa note cũ; dùng Wiki.api (W1), lấy token AI theo cách các app khác (ai.phien@<gốc API>); offline/không có máy chủ → nút ẩn hoặc báo rõ. ke-hoach §1.4 "AI ↔ toán": prompt nói toán viết bằng $…$/$$…$$; bản Python maskCode/parseLinks che cả vùng toán; JS và Python dùng chung một tệp fixture JSON. Test với FakeModel + kiem.js + check.py --ai (tầng mới, Gemini giả qua page.route). Chạy tao-pwa.py.',
    kiem: PT + ' -q -k "ai_wiki or ai_controller" ; node ' + WA + '/personal-wiki/kiem.js ; PYTHONUTF8=1 ' + PY + ' ' + WA + '/personal-wiki/check.py --ai (tầng mới) rồi --tat-ca ; ' + PY + ' ' + WA + '/personal-wiki/tao-pwa.py ; cuối cùng ' + PT + ' -q' },
  { ma: 'J2', ten: 'JSON Editor: metadata/preview khi gập (Cây)', thietKe: ['json-editor'], skill: 'webapp-thuan',
    viec: 'json-editor việc 9, 10: khi gập một nút ở chế độ Cây hiện preview/metadata giàu hơn (kiểu, số khoá/phần tử, vài khoá/giá trị đầu, kích thước byte, đường dẫn) — thoát HTML đúng, không làm chậm cây lớn; dùng je-chung.js của J1; giữ tên truy cập các nút; 360 px vẫn gọn.',
    kiem: 'node ' + WA + '/json-editor/kiem.js ; ' + PY + ' ' + WA + '/json-editor/check.py --tinh --chuc-nang ; ' + PY + ' ' + WA + '/kiem-hinh.py json-editor' },
  { ma: 'J3', ten: 'JSON Schema: kiểm dữ liệu (viết tay)', thietKe: ['json-editor'], skill: 'webapp-thuan',
    viec: 'json-editor việc 8, 22, 23, 25, 26 (việc 24 unevaluated* HOÃN theo Q8): bộ kiểm JSON Schema viết tay (draft 2020-12 + tương thích draft-07; các từ khoá theo thiết kế; $ref/$defs/definitions cục bộ có ref vòng; format mặc định mức cảnh báo; pattern có chống ReDoS bằng giới hạn thời gian/Worker báo hết giờ), lỗi kèm JSON pointer + thông báo tiếng Việt + bấm tới vị trí trong Cây/Soạn (vi-tri.timViTri — việc 8, mở luôn JE_APP.denDuong cho tab Soạn mà J1 để false), chạy trong Worker từ Blob, một schema hiện tại (nhập/dán/lưu cạnh dữ liệu). Không $ref tới URL ngoài (ghi rõ trong giao diện/bàn giao).',
    kiem: 'node ' + WA + '/json-editor/kiem.js schema (≥ 300 ca) && node ' + WA + '/json-editor/kiem.js ; ' + PY + ' ' + WA + '/json-editor/check.py --tinh --chuc-nang (lỗi bấm tới được vị trí, ReDoS báo hết giờ, Worker chạy khi phục vụ qua máy chủ) ; ' + PY + ' ' + WA + '/kiem-hinh.py json-editor' },
  { ma: 'W4', ten: 'Toán cho Wiki/Notebook (không thư viện) + sửa dữ liệu Notebook', thietKe: ['md-render', 'perf-md'], skill: 'webapp-thuan',
    viec: 'md-render việc 17 (toán trong personal-wiki/assets/js/core/markdown.js: \\[ \\], \\( \\), $…$, $$…$$ với luật pandoc như M2 — không biến \\[ thành [, không biến _ trong công thức thành nghiêng; hiện TeX nguyên văn có định dạng/đánh dấu data-tex để W6 hydrate KaTeX sau; XSS qua data-tex phải chặn) + phần sửa dữ liệu của việc 19 (Algorithm Notebook: dữ liệu có $ dễ thành công thức giả, vd lib-string.js:185 — sửa dữ liệu hoặc luật để không sinh công thức ngoài ý muốn). Chuẩn bị cho W5: M.blocks sau này phải coi $$, \\[, \\begin{ENV}, ```math, ```mermaid là vùng chưa đóng (§1.4). Sửa markdown.js thì chạy algorithm-notebook/sync.py rồi sync.py --kiem và tao-pwa.py của CẢ HAI app.',
    kiem: 'node ' + WA + '/personal-wiki/kiem.js (vectơ toán + XSS qua data-tex) ; ' + PY + ' ' + WA + '/algorithm-notebook/sync.py && ' + PY + ' ' + WA + '/algorithm-notebook/sync.py --kiem ; node ' + WA + '/algorithm-notebook/kiem-lib.js ; node ' + WA + '/algorithm-notebook/kiem.js ; PYTHONUTF8=1 ' + PY + ' ' + WA + '/personal-wiki/check.py --tinh --chuc-nang ; ' + PY + ' ' + WA + '/algorithm-notebook/check.py --tinh ; tao-pwa.py cả hai app' },
  { ma: 'W5', ten: 'Render theo khối ở Wiki (+ Notebook nhận markdown.js mới)', thietKe: ['perf-md'], skill: 'webapp-thuan',
    viec: 'perf-md việc W2, W3, W4, N1: M.blocks + M.dedupeIds (coi $$, \\[, \\begin{ENV}, ```math, ```mermaid, HTML khối là vùng chưa đóng) + test khác biệt (render theo khối == render cả note, có ca toán của W4) và hiệu năng; vá DOM preview theo khối + content-visibility (cache khối lưu HTML TRƯỚC khi hydrate; nút mới đánh dấu data-hydrated, chạy lại không đổi kết quả); kịch bản ghi chú dài trong check.py --hieu-nang; Notebook nhận markdown.js mới qua sync.py. Chạy tao-pwa.py cả hai app.',
    kiem: 'node ' + WA + '/personal-wiki/kiem.js (blocks == render cả note, có ca toán) ; PYTHONUTF8=1 ' + PY + ' ' + WA + '/personal-wiki/check.py --hieu-nang (mục tiêu: note 9.000 dòng chế độ Chia đôi gõ p95 ≤ 120 ms; báo số trước/sau) --chuc-nang --co-gian ; ' + PY + ' ' + WA + '/algorithm-notebook/sync.py --kiem ; ' + PY + ' ' + WA + '/algorithm-notebook/check.py --tinh ; tao-pwa.py cả hai app' },
]

const files = b => b.thietKe.map(k => ROOT + '/thiet-ke/' + k + '.md').join(', ')

function implPrompt(b, mine, other) {
  return [
    'Bạn là agent THI CÔNG đợt con ' + b.ma + ' — ' + b.ten + ' — trong đợt cải tiến web app (đợt 2) của monorepo C:/Users/tranphuc8a/Desktop/gemini_proxy (Windows, shell Bash là Git Bash). Kế hoạch đã được chủ dự án DUYỆT; bạn được phép sửa mã trong phạm vi đợt này.',
    CONTEXT,
    'Thiết kế chi tiết: ' + files(b) + ' (đọc mục các việc được giao + phần thiết kế tương ứng). Skill: ' + b.skill + '.',
    DECISIONS,
    '',
    'NHIỆM VỤ: ' + b.viec,
    '',
    'LỆNH KIỂM PHẢI XANH (exit 0) trước khi kết thúc: ' + b.kiem,
    '',
    RULES(mine, other),
    '',
    'Kết thúc: ghi bàn giao ngắn gọn tiếng Việt vào ' + ROOT + '/dot/' + b.ma + '.md (đã làm gì, tệp đổi, lệnh kiểm + kết quả thật, lệch thiết kế, việc còn tồn, số đo trước/sau nếu có, ghi chú cho đợt sau). Nếu có điều đợt sau CÙNG LÀN cần biết, thêm một gạch đầu dòng vào ' + ROOT + '/ke-hoach.md §7.1 (chỉ Edit đoạn đó). Trả về đối tượng có cấu trúc.',
  ].join('\n')
}

function verifyPrompt(b, impl, mine, other) {
  return [
    'Bạn là người KIỂM ĐỘC LẬP cho đợt con ' + b.ma + ' — ' + b.ten + ' — trong monorepo C:/Users/tranphuc8a/Desktop/gemini_proxy. KHÔNG sửa mã (chỉ tạo tệp nháp ngoài repo).',
    CONTEXT,
    'Thiết kế: ' + files(b) + '; kế hoạch ' + ROOT + '/ke-hoach.md; bàn giao của đợt: ' + ROOT + '/dot/' + b.ma + '.md.',
    DECISIONS,
    'Nhiệm vụ đợt: ' + b.viec,
    'Báo cáo của agent cài (đừng tin, hãy kiểm): ' + JSON.stringify(impl),
    '',
    'Việc của bạn:',
    '1. Xem diff các tệp của đợt (`git diff HEAD`, `git status`; chỉ xét tệp thuộc ' + mine + ' Bỏ qua tệp của làn kia — ' + other + ').',
    '2. TỰ chạy lại lệnh kiểm của đợt (kể cả lint/type-check): ' + b.kiem,
    '3. Tìm: lỗi đúng/sai và hồi quy; lỗ hổng bảo mật (quyền truy cập, rò rỉ dữ liệu qua đường mới, XSS, CSP, chèn lệnh AI, giới hạn tốc độ); mất dữ liệu (chuyển đổi kho, đồng bộ, xung đột, tombstone); độ phức tạp bậc hai trên đầu vào xấu; việc thiết kế bị bỏ sót mà không ghi lý do; test giả tạo (luôn xanh, không kiểm gì — thử đột biến nếu nghi ngờ); vi phạm CLAUDE.md (innerHTML không thoát, dependency chưa duyệt, sửa tay tệp sinh ra, quên tao-pwa.py/sync, gọi Gemini/DB thật, SW cache API, hoàn tác bằng ảnh chụp).',
    '4. Chỉ đánh "blocking" khi có bằng chứng cụ thể (tệp:dòng, output lệnh hoặc kịch bản tái hiện) và đáng sửa ngay. Góp ý nhỏ để ở "nho". Phép kiểm đỏ do làn kia thì ghi rõ, KHÔNG tính là blocking.',
  ].join('\n')
}

function fixPrompt(b, ver, mine, other) {
  return [
    'Bạn là agent SỬA cho đợt con ' + b.ma + ' — ' + b.ten + ' (monorepo C:/Users/tranphuc8a/Desktop/gemini_proxy). Người kiểm độc lập tìm ra các vấn đề blocking dưới đây. Sửa đúng gốc (rà luôn các chỗ cùng mẫu lỗi), kèm test chứng minh (đỏ trên bản cũ, xanh trên bản mới), chạy lại toàn bộ lệnh kiểm của đợt tới khi xanh, rồi cập nhật ' + ROOT + '/dot/' + b.ma + '.md (mục "Sửa sau kiểm").',
    CONTEXT,
    'Thiết kế: ' + files(b) + '. ' + DECISIONS,
    'Vấn đề: ' + JSON.stringify(ver.blocking),
    'Góp ý nhỏ (sửa nếu rẻ): ' + JSON.stringify(ver.nho),
    'Lệnh kiểm: ' + b.kiem,
    RULES(mine, other),
  ].join('\n')
}

async function runBatch(b, phaseName, mine, other) {
  const impl = b.skipImpl
    ? { ma: b.ma, xong: ['Đã cài ở lượt trước — xem ' + ROOT + '/dot/' + b.ma + '.md. Cây làm việc có thể chứa bản sửa dở của lượt trước: đọc diff.'], bo_qua: [], tep: [], kiem: [], lech_thiet_ke: [], con_ton: [] }
    : await agent(implPrompt(b, mine, other), { label: b.ma + ' · cài', phase: phaseName, schema: IMPL })
  if (!impl) { log(b.ma + ': agent cài không trả kết quả'); return { ma: b.ma, ten: b.ten, trang_thai: 'loi_cai' } }
  const fixes = []
  let ver = null
  for (let round = 0; round < 3; round++) {
    if (round === 0 && b.knownBlocking) {
      ver = { dat: false, blocking: b.knownBlocking, nho: b.knownNho || [], kiem: [] }
    } else {
      ver = await agent(verifyPrompt(b, fixes.length ? { ...impl, sua: fixes } : impl, mine, other), { label: b.ma + ' · kiểm' + (round ? ' #' + (round + 1) : ''), phase: phaseName, schema: VERIFY })
    }
    if (!ver || ver.dat || !ver.blocking.length || round === 2) break
    const fix = await agent(fixPrompt(b, ver, mine, other), { label: b.ma + ' · sửa #' + (round + 1), phase: phaseName, schema: IMPL })
    if (fix) fixes.push(fix)
  }
  const ok = !!(ver && (ver.dat || !ver.blocking.length))
  log(b.ma + ' (' + b.ten + '): ' + (ok ? 'ĐẠT kiểm độc lập' : 'CÒN VẤN ĐỀ sau ' + fixes.length + ' vòng sửa'))
  return { ma: b.ma, ten: b.ten, trang_thai: ok ? 'dat' : 'con_van_de', impl, fixes, ver }
}

async function runLane(batches, phaseName, mine, other) {
  const out = []
  for (const b of batches) out.push(await runBatch(b, phaseName, mine, other))
  return out
}

// M3 đã đạt kiểm độc lập (2 lần). Góp ý nhỏ của người kiểm được vá ở M3V (trước M4a, vì cùng chạm /markdown).
const M3V = {
  ma: 'M3V', ten: 'Vá góp ý của người kiểm M3 (token lọt log, #share, is_local_request…)', thietKe: ['md-share'],
  viec: 'Sửa các góp ý đã chốt của người kiểm độc lập M3, liệt kê trong ' + ROOT + '/dot/M3-nho-chua-sua.md (mục 1–8, 11, 14) — đọc tệp đó; mỗi mục kèm test đỏ→xanh. Thứ tự ưu tiên: (1) parseShareHash("#share") / ("#share=") phải KHÔNG coi là địa chỉ chia sẻ (token rỗng) — bấm neo heading "Share" hay [x](#share) trong trình soạn không được nhảy sang "Link not available"; (2) token/tham số không được lọt vào log hay thân 500: bọc lỗi kho ở đường đọc công khai thành lỗi chung không kèm str(exc) (kiểm bằng repo giả ném lỗi chứa token); (3) is_local_request dùng ipaddress.ip_address(host).is_loopback (::ffff:127.0.0.1, 127.0.0.2…); (4) X-Admin-Key max_length 200: nâng trần hoặc báo rõ lỗi + ghi chú .env.example/README; (5) làm mới liên kết ĐÃ HẾT HẠN: cấp token mới (hoặc cảnh báo rõ trong hộp thoại) — chọn cách an toàn hơn, ghi lại; (6) scanDocumentRefs (src/lib/share.ts) tuyến tính + ca bệnh lý (dòng 60.000 ký tự "[" không "]"; "<a " lặp 30.000 lần; đo 64 KB vs 256 KB); (7) ShareDialog không mất tiêu đề đang gõ khi refresh() danh sách; (8) MySQL hai docId chỉ khác hoa/thường → 409/400 kèm data.code (markdown_share_conflict) thay vì 500; (11) sửa câu tài liệu M3.md về CREATE TABLE ở đường đọc công khai; (14) số liệu vitest trong skill ban-do-ung-dung. THÊM từ lần kiểm lại: client_address tin X-Real-IP theo chiều ngược — gửi 20 khoá sai kèm X-Real-IP của nạn nhân làm nạn nhân bị khoá: cân nhắc chỉ tin X-Real-IP khi có biến cấu hình bật proxy tin cậy (mặc định theo cách an toàn cho Vercel — kiểm tài liệu Vercel trong repo/README trước khi đổi mặc định; nếu không chắc, giữ nguyên hành vi và ghi rõ quyết định cho chủ dự án thay vì đổi). Không làm mục 9, 10, 12, 13, 15–17 (ngoài phạm vi/chủ dự án quyết). Cuối đợt build + xuất bản markdown-editor-pro.',
  kiem: PT + ' tests/application/test_markdown_share_usecase.py tests/adapter/input/controller/test_markdown_share_controller.py tests/adapter/input/controller/test_markdown_storage_controller.py tests/adapter/output/markdownshare -q (cộng test mới), rồi ' + PT + ' -q ; ' + ME_KIEM + ' ; ' + PY + ' markdown-editor/scripts/kiem-chia-se.py ; ' + ME_BUILD + ' ; ' + PY + ' markdown-editor/scripts/kiem-pwa.py',
}
// LƯỢT CHẠY LẠI SAU LỖI 502 THỨ HAI (24/10 ~09:00): đã đạt kiểm độc lập: M3, M3V, W3, J2, J3, M4a. M4b đã cài xong (dot/M4b.md), chỉ còn kiểm độc lập.
const PARTIAL_NOTE = ' LƯU Ý: lượt chạy trước bị ngắt giữa chừng bởi lỗi 502 của dịch vụ; nếu đã có thay đổi dở trong cây làm việc cho đợt này (xem git status/git diff HEAD, đối chiếu danh sách tệp trong thiết kế) thì ĐỪNG làm lại từ đầu và đừng xoá: đọc, giữ cái đúng, sửa cái sai, làm nốt cái thiếu, rồi ghi rõ trong dot/<mã>.md phần nào kế thừa và phần nào viết lại.'
const withNote = b => ({ ...b, viec: b.viec + PARTIAL_NOTE })
const A_REST = [
  { ...A.find(b => b.ma === 'M4b'), skipImpl: true },
  withNote(A.find(b => b.ma === 'M5')),
]
// W3: đã cài + đã có hai lượt kiểm; ba lỗi blocking dưới đây là kết quả kiểm gần nhất — vào thẳng vòng sửa.
const W3_BLOCKING = [
  { tep: 'backend/fastapi/src/application/ai_usecase (parse_json) + tests/application/test_ai_usecase.py:237, test_ai_wiki_usecase.py:238', mo_ta: 'parse_json (dùng chung cho MỌI tính năng AI, kể cả /ai/wiki) cắt rào bằng re.sub(r"^```[a-zA-Z]*\\s*|\\s*```$", "", body) — bậc hai trên chuỗi khoảng trắng dài nằm trong câu trả lời bọc rào ```. Chạy đồng bộ trong event loop (result = parse(completion.text)) nên một câu trả lời model chứa dải khoảng trắng 20–200 KB làm đứng cả máy chủ (mọi route) 4–36 giây. Sửa: cắt rào bằng tay, tuyến tính (strip, startswith ```, bỏ dòng đầu hoặc chữ ngôn ngữ, rstrip, endswith ```). Test đang đỏ: test_parse_json_stays_linear_on_whitespace_inside_a_fence (20.000 dấu cách ~3,7 s, ngưỡng 0,3 s) và test_a_hostile_answer_is_checked_in_linear_time (32 s, ngưỡng 2,5 s). Rà luôn mọi regex khác trên đường parse/kiểm đầu ra AI có cùng mẫu.', bang_chung: 'pytest -q: 2 test trên FAILED với thời gian nêu trên (người kiểm 01:22)' },
  { tep: 'tests/application/test_ai_wiki_usecase.py:87; personal-wiki/kiem-lien-ket.json; assets/js/core/compose.js:268 (verify) và :291-296 (plan)', mo_ta: 'Fixture dùng chung JS⇄Python chưa cập nhật theo bản Python: test_links_match_the_shared_fixture đọc fx["verify"] nhưng tệp JSON chỉ có parseLinks, defangMath, rewriteLinks, titleKey, normTag → KeyError. Bản JS chưa có phần tương đương seal_links/verify_links; compose.verify và plan chỉ làm defangMath rồi rewriteLinks, nên khi gỡ một liên kết lồng nhau thì phép thay thế tạo ra liên kết sống tới tiêu đề không tồn tại. Đây là bước kiểm lại cuối của trang trước khi lưu/đồng bộ, vi phạm yêu cầu "liên kết chỉ trỏ tới tiêu đề có thật hoặc chủ đề mới được đề xuất rõ ràng". Sửa: đưa JS về cùng thuật toán với Python (seal/verify), thêm mục "verify" vào fixture dùng chung với ca lồng nhau (vd C.verify("A [[ngoài [[Bịa]] cuối]] B", ()=>null) hiện cho "A [[ngoài Bịa cuối]] B" còn Python đòi "[ [ngoài Bịa cuối] ]"), thống nhất kết quả hai bên, test cả hai phía; cũng kiểm thứ tự defang_math trước rewrite_links ở máy chủ (alias do model viết kết thúc bằng "\\" không được làm mất vùng toán).', bang_chung: 'pytest -k ai_wiki: KeyError: "verify" ở test_ai_wiki_usecase.py:87; node C.verify như trên (người kiểm 01:22)' },
  { tep: 'personal-wiki/assets/js/core/notes.js (maskCode; chép sang algorithm-notebook bằng sync.py), bị gọi từ compose.js defangMath/blankMath/parseLinks', mo_ta: 'Bản Python đã viết lại luật code nội tuyến thành một lượt tuyến tính (mask_inline_code), nhưng bản JS vẫn dùng regex cũ /(`+)(?!`)([^\\n]*?[^`\\n])\\1(?!`)/g — bậc hai trên dải dấu huyền. Câu trả lời AI cho phép tới 40.000 ký tự × 5 ghi chú; plan() gọi maskCode ít nhất 3 lần mỗi ghi chú → treo luồng chính của trang. Sửa: chuyển maskCode sang bản tuyến tính (cùng thuật toán với Python), chạy algorithm-notebook/sync.py + sync.py --kiem, tao-pwa.py của CẢ HAI app, thêm ca bệnh lý vào kiem.js (dải dấu huyền 5.000 → 40.000, đo tuyến tính) và vào fixture dùng chung nếu hợp lý.', bang_chung: 'node: C.defangMath("## A\\n\\nx " + "`".repeat(N)): N=5.000 → 188 ms, 10.000 → 728 ms, 20.000 → 2.796 ms, 40.000 → 6.856 ms (người kiểm 01:22)' },
]
const B_REST = [
  withNote({ ...B.find(b => b.ma === 'W4'), viec: B.find(b => b.ma === 'W4').viec + ' Agent W4 trước đó đã làm việc ~1 giờ (hơn 400 bước) trước khi bị ngắt, nên rất có thể cây đã có phần lớn W4 (personal-wiki/assets/js/core/markdown.js, notes.js, kiem.js, check.py, algorithm-notebook qua sync.py…) nhưng chưa có dot/W4.md và chưa qua kiểm: hãy ĐỌC KỸ phần đó trước.' }),
  withNote(B.find(b => b.ma === 'W5')),
]

const [laneA, laneB] = await parallel([
  () => runLane(A_REST, 'Làn A', LANE_A, LANE_B),
  () => runLane(B_REST, 'Làn B', LANE_B, LANE_A),
])

phase('Kiểm tổng')
const all = [...(laneA || []), ...(laneB || [])]
const tong = await agent([
  'Bạn là người KIỂM TỔNG đợt 2 của đợt cải tiến web app (monorepo C:/Users/tranphuc8a/Desktop/gemini_proxy). Hai làn đã xong; không còn agent nào sửa song song.',
  CONTEXT,
  'Kết quả từng đợt con: ' + JSON.stringify(all.map(r => ({ ma: r.ma, ten: r.ten, trang_thai: r.trang_thai, con_ton: r.impl && r.impl.con_ton, blocking_con: r.ver && r.ver.blocking }))),
  'Bàn giao từng đợt con ở ' + ROOT + '/dot/*.md.',
  'Việc:',
  '1. Chạy lại TOÀN BỘ bộ kiểm MỘT lần, ghi kết quả thật (PYTHONUTF8=1): ' + PT + ' -q ; ' + ME_KIEM + ' ; cd frontend && npm test && npm run type-check && npm run lint ; node scripts/sync-math.mjs --kiem ; node scripts/build-webapps.mjs --check ; node ' + WA + '/kiem-tat.js ; node ' + WA + '/logic-puzzle-suite/kiem.js ; node ' + WA + '/personal-wiki/kiem.js ; node ' + WA + '/json-editor/kiem.js ; node ' + WA + '/algorithm-notebook/kiem.js ; ' + PY + ' ' + WA + '/algorithm-notebook/sync.py --kiem ; ' + PY + ' markdown-editor/scripts/kiem-pwa.py ; ' + PY + ' markdown-editor/scripts/kiem-chia-se.py ; ' + PY + ' markdown-editor/scripts/kiem-dong-bo.py ; ' + PY + ' frontend/scripts/kiem-toan-edge.py ; check.py --tinh của personal-wiki, json-editor, algorithm-notebook, logic-puzzle-suite, _portal ; ' + PY + ' markdown-editor/scripts/kiem-hieu-nang.py --bao-cao --chi doc-2k,doc-10k (so với mốc M0 và sau đợt 1 trong ban-giao.md).',
  '2. Phép kiểm đỏ: tìm nguyên nhân; lỗi nhỏ rõ ràng do đợt 2 (quên tao-pwa/sync, build lệch, test ghim cũ) thì SỬA và chạy lại phép đó; lỗi lớn thì ghi lại, không sửa liều. Không commit, không lệnh git đổi cây/chỉ mục.',
  '3. Cập nhật ' + ROOT + '/ban-giao.md: đổi dòng Trạng thái; thêm mục "Đợt 2 (thi công) — kết quả" cô đọng: mỗi đợt con 1–3 dòng, bảng hiệu năng M0 → sau đợt 1 → sau đợt 2 (Markdown Editor + Wiki), kết quả bộ kiểm tổng, việc còn tồn/blocking chưa sửa, việc chủ dự án cần tự làm (deploy theo thứ tự an toàn: biến môi trường MARKDOWN_ADMIN_KEY/MARKDOWN_PUBLIC_READ/kho mysql → backend (M3, M4a) → client (M4b); kiểm production; thử điện thoại), đợt tiếp (đợt 3: M6 định dạng LLM, M7 PlantUML offline, W6 KaTeX/mermaid Wiki, J4 sinh mẫu + suy schema, J5–J6, P3–P8 puzzle mới, M9 quyết CodeMirror).',
  'Trả về tóm tắt tiếng Việt (markdown) gửi chủ dự án: bảng đợt con + trạng thái, kết quả bộ kiểm tổng, số hiệu năng, việc còn tồn, những gì nên tự thử trên trình duyệt, thứ tự deploy an toàn.',
].join('\n'), { label: 'Kiểm tổng đợt 2', phase: 'Kiểm tổng' })

return { laneA, laneB, tong }
