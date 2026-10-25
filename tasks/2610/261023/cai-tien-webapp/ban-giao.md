# Bàn giao — đợt cải tiến web app (22–23/10/2026)

**Trạng thái: xong đợt 1 thi công (M0, M1, M2, M2b ∥ W1, W2, J1, P1, P2). Kiểm tổng 23/10 tối: cả 20 lệnh kiểm đều xanh. Lỗi
blocking cuối của M2 (`normalizeMath` bậc hai với `<?`, `<!X`, `<![CDATA[` không đóng) đã sửa ở M2 phiên 5, kèm 5 đường bậc hai
cùng mẫu. Không còn blocking đã biết. Còn 1 ngưỡng hiệu năng để M5 làm. M2 phiên 2–5 + M2b chưa commit. Việc kế tiếp: đợt 2
(ke-hoach.md §7).** Q1–Q8 đã chốt theo đề xuất (ke-hoach.md §6).

## Yêu cầu gốc (tóm tắt)
- Markdown Editor Pro: toán `\[ \]`; link chia sẻ chỉ đọc cho người ẩn danh; PlantUML; thêm định dạng toán/ký hiệu/sơ đồ của Gemini/Claude/ChatGPT; version + đồng bộ chỉ gửi phần đổi.
- Personal Wiki: đồng bộ không chạy; AI từ dữ liệu thô → note md đẹp + liên kết tới chủ đề có sẵn.
- Tất cả: lag với md rất dài.
- JSON Editor: JSON Schema (kiểm + sinh mẫu hợp lệ ngẫu nhiên); gập hiện preview/metadata; tìm/sửa/định dạng.
- Logic Puzzle: hoàn thiện Lights Out; cân xu CW1 (v1 biết nặng, v2 không biết), CW2 (ít quả cân nhất), CW3 (cân điện tử); lạc đà chở chuối V1/V2; nhóm đi bộ + xe máy.

## Tệp trong thư mục này
- `ke-hoach.md` — bản tổng hợp: việc chung/xung đột, 4 luồng M/W/J/P chia đợt kèm lệnh kiểm, 8 quyết định, dependency, phản biện; §7 = làn thi công + ghi chú chuyển tiếp (bắt buộc đọc).
- `thiet-ke/<vùng>.md` — thiết kế chi tiết 8 vùng (hiện trạng có path:line, phát hiện, thiết kế, danh sách việc đánh số mà `ke-hoach.md` tham chiếu).
- `dot/<mã>.md` — bàn giao từng đợt con (đã làm, tệp, lệnh kiểm, lệch thiết kế, còn tồn). Đọc bản cùng làn trước khi làm đợt sau.
- `nhap/<vùng>/` — script đo/thử đã dùng. Một số còn trỏ đường dẫn scratch cũ, phải sửa đường dẫn trước khi chạy lại.

## Phát hiện quan trọng nhất của pha thiết kế (đã kiểm)
- Wiki đồng bộ hỏng: `apiBase` rỗng (API_PREFIX trống) bị coi là "không có máy chủ"; `index.html` gọi đích danh không được chèn `__WEBAPP_CONFIG__`. → **đã sửa ở W1/W2.**
- Markdown: `\[ \]`/`\( \)` bị micromark coi là ký tự thoát; `$$x$$` một dòng thành inline; `$5…$10` thành công thức giả; gemini-chat dính cùng lỗi. → **đã sửa ở M2/M2b.**
- Markdown lưu máy chủ = ghi đè cả cây, không kiểm phiên bản; `GET /markdown/files` công khai; khoá quản trị mặc định công khai. → M1 mới vá tạm (hỏi trước khi "Load from backend", banner quota). Phần còn lại ở M3/M4a/M4b.
- Hiệu năng: MD Editor 10k dòng mở 24 s, gõ p95 10 s; Wiki 9k dòng gõ p95 656 ms. → M1/W2 đã cắt phần rẻ. Render theo khối ở M5/W5.
- JSON Editor: 1 MB treo 3,4 s, 10 MB 31 s; nháp > 5 MB mất không báo. → J1 sửa lỗi đúng/sai. Tài liệu lớn để J5.

## Đợt 1 (thi công) — kết quả

### Đợt con
| Đợt | Trạng thái | Đã làm · số đo trước → sau |
| --- | --- | --- |
| M0 | đạt | Khung đo Edge thật `markdown-editor/scripts/kiem-hieu-nang.py` (`--bao-cao`, `--nguong`, `--ghi-moc`, 16 phép tự kiểm). Bộ sinh tài liệu giống từng byte bản JS. Mốc `hieu-nang-moc.json`. Mốc kiểm: vitest 367, pytest 1895. |
| W1 | đạt | Wiki đồng bộ chạy lại: backend chèn cấu hình cho `…/index.html` gọi đích danh (cả start_url PWA); `apiBase ""` được coi là có máy chủ; 404 không mã → `wiki_no_api` (giữ khoá kho); thêm `Wiki.api`. `check.py --dong-bo` chạy 3 biến thể, có Edge. pytest 1904 → 1906. |
| M1 | đạt (1 ngưỡng chuyển M5) | CodeBlock tô màu bằng class (nhanh ≈ 13×); bỏ việc O(n) khỏi mỗi phím; chế độ đọc + neo cuộn dùng tìm nhị phân. Vá tạm mất dữ liệu: hỏi trước khi "Load from backend", banner quota đầy, cảnh báo ghi đè. Sửa 2 lỗi M0 tìm ra (khung welcome vẽ trước hydrate, phiên quản trị bị huỷ). Số đo: doc-10k chỉ-editor gõ p50 168 → 72 ms; cuộn chế độ đọc p95 doc-2k 124 → 18 ms, doc-10k 3.013 → ~90 ms (đích 50 ms). |
| W2 | đạt | UX đồng bộ: thông điệp riêng cho từng tình huống (file/no_config/offline/lost/no_api/ephemeral), chip trạng thái, tự chọn kho bền, QR + liên kết `#/join/<mã>`. Gõ chế độ Sửa note 407k ký tự: p95 112 → 56 ms, long task 21 → 0. Chế độ Chia đôi vẫn ~1,1 s (để W5). |
| J1 | đạt | Sửa lỗi truy vấn/so sánh với khoá kế thừa và `__proto__`; sắp khoá; `dem` viết lặp (chịu 20.000 cấp). Thêm `je-chung.js` + cổng `JE_APP`. Hoàn tác thống nhất ↶ ↷. Tab trong ô soạn có lối thoát Esc. Bộ kiểm: kiem.js 133 → 241 phép; thêm `check.py`. |
| P1 | đạt | Hợp đồng puzzle hợp nhất: kind interactive/optimize, `grade` + sao, `options` trong liên kết seed, `core/plan.js`, Daily theo phiên bản. Mẫu vàng 126 tổ hợp khớp. kiem.js 929 → 1.063 phép; check.py 830 → 874. |
| P2 | đạt | Lights Out: bất biến khi vô nghiệm (tô trong trình soạn), mẫu bấm im lặng, bản đồ lời giải, gợi ý đuổi đèn (bảng hàng cuối), par + grade. Mẫu vàng 340 + 40. kiem.js 1.103 phép; check.py 904. |
| M2 | đạt (sửa sau kiểm vòng 3, phiên 5) | Thêm `markdownPipeline.ts` (một pipeline, thứ tự plugin ghim bằng test). Toán: `\[ \]`, `\( \)`, `$$x$$` một dòng → khối, luật pandoc cho `$`, mhchem, macro `\label/\eqref`. Thêm `rehypeStyleGuard`. 61 vectơ render, `katex-error` = 0. Phiên 2–4 gỡ 15 đường bậc hai + một đường n^1.5. Phiên 5 gỡ 8 đường bậc hai còn sót: `<?`/`<!X`/CDATA không đóng 256 KB 15,5 s → 14 ms; dấu mở chung dấu đóng; tìm lại sau vùng bỏ qua. 30 ca bệnh lý, đầu ra không đổi trên 1,06 triệu đầu vào. vitest 367 → 729 (tính cả M2b). Build `92827c9b8e24`. |
| M2b | đạt | gemini-chat dùng chung `mathDelimiters`/`remarkMathPromote`/`katexOptions`/`mathVectors`. Script `scripts/sync-math.mjs` chép + `--kiem` báo lệch. Thêm mhchem + macro. `frontend/scripts/kiem-toan-edge.py` 9 phép, có ca streaming. frontend vitest 181 → 353; bundle +13,8 KB gzip. |

### Bộ kiểm tổng (23/10 18:00–18:40, chạy một lần, `PYTHONUTF8=1`, `MONGO_URI=""`)
Cây làm việc = HEAD `8c06996` + phần chưa commit của M2 phiên 2–4 và M2b. Bản xuất bản: markdown-editor-pro build `65b8053d95b6`, gemini-chat `index-DRrYwY8f.js`.

| Lệnh | Kết quả |
| --- | --- |
| `backend/fastapi: pytest -q` | exit 0 — **1906 passed**, 4 skipped (163 s) |
| `markdown-editor: npm test` · `type-check` · `lint` | exit 0 — **35 tệp / 721 test** (98 s) · xanh · 0 cảnh báo |
| `frontend: npm test` · `type-check` · `lint` | exit 0 — **17 tệp / 353 test** (103 s) · xanh · xanh |
| `node scripts/build-webapps.mjs --check` | exit 0 — 7 app ok, không gốc API cứng |
| `node scripts/sync-math.mjs --kiem` (thêm) | exit 0 — 4 bản sao khớp nguồn |
| `node …/kiem-tat.js` | exit 0 — **3.228 phép / 8 app**. Trong đó logic-puzzle-suite 1.103, personal-wiki 214, json-editor 241 (chính là 3 lệnh kiem.js riêng), code-studio 964, quan-ly-chi-tieu 520, chi-tieu 84, algorithm-notebook 66, design-pattern 36 |
| `node …/personal-wiki/kiem.js` · `node …/json-editor/kiem.js` | exit 0 — 214 phép · 241 phép |
| `markdown-editor/scripts/kiem-pwa.py` | exit 0 — **Đạt 57 · SAI 0** (81 s) |
| `frontend/scripts/kiem-toan-edge.py` (thêm) | exit 0 — Đạt 9 · SAI 0 |
| `check.py --tinh`: personal-wiki · json-editor · algorithm-notebook · logic-puzzle-suite · _portal | exit 0 cả 5 — 11 · 12 · 14 · 16 · 16 đạt, 0 sai |
| `kiem-hieu-nang.py --bao-cao --chi doc-2k,doc-10k` | exit 0 — 6 lượt, 0 lượt hỏng, 0 pageerror (238 s; M0 mất 445 s) |

Không lệnh nào đỏ nên kiểm tổng không sửa gì. Không chạy lại `check.py --tat-ca` của từng app và không đo doc-30k (theo chỉ dẫn tiết kiệm; các đợt con đã chạy, số ở `dot/*.md`).

### Hiệu năng Markdown Editor Pro: M0 → sau đợt 1 (Edge 155 headless, 1440×900)
Hai cột không đo trong cùng điều kiện. M0 là trung vị 3 lần, đo lúc máy bận (nhiễu ±35 %). "Sau đợt 1" là 1 lần, máy rảnh (CPU nền ≈ 8 %).
Ở doc-2k chia đôi, lượt đo đầu chạy lúc trình duyệt còn nguội, nên "mở" của doc-2k cao hơn mốc M1 (khung đầu có editor 282 → 517 ms).

| Chỉ số | doc-2k M0 → sau | doc-10k M0 → sau |
| --- | --- | --- |
| Chia đôi — mở: khung đầu có editor | 0,82 → 0,52 s | 1,42 → **0,31 s** |
| … khung đầu có preview tài liệu | 2,11 → 3,11 s | 5,46 → 5,26 s |
| … tới khi yên | 4,46 → 6,12 s | 19,3 → **12,9 s** |
| … long task lớn nhất | 0,90 → 1,40 s | 5,03 → 3,78 s |
| Chia đôi — gõ p50 / p95 | 1.640 / 2.552 → **560 / 856 ms** | 9.992 / 12.120 → **2.672 / 4.272 ms** |
| … số phím gõ được trong 60 s | 21 → 21 | 7 → 20 |
| … preview cập nhật sau phím cuối | 4,18 → **1,18 s** | 23,9 → **5,52 s** |
| Chia đôi — cuộn preview p95 / khung > 50 ms | 36 / 0,7 % → 36 / 0,6 % | 108 / 59,8 % → 72 / 51,4 % |
| Chỉ editor — khung đầu | 1,17 → **0,27 s** | 1,44 → **0,35 s** |
| Chỉ editor — gõ p50 / p95 | 56 / 72 → 48 / 72 ms | 152 / 216 → **72 / 80 ms** |
| Chế độ đọc — khung đầu có bài | 3,29 → 2,27 s | 11,8 → 6,59 s |
| … tới khi yên / long task lớn nhất | 11,9 / 2,92 → 5,64 / 1,66 s | 75,2 / 15,1 → **14,9 / 5,65 s** |
| Chế độ đọc — cuộn p50 / p95 | 18 / 125 → 18 / **18 ms** | 200 / 2.774 → 36 / **89 ms** |
| … khung > 50 ms | 30,1 → 0,7 % | 98,7 → 36,4 % |
| Hoàn tác 10 bước (renderer tăng) | — → 2,4 MB | +7,5–9,1 → 8,2 MB |

So với ngưỡng M1: doc-10k chỉ-editor gõ p50 72 ≤ 80 ms **đạt**. Cuộn chế độ đọc doc-2k p95 18 ≤ 34 ms **đạt**. Cuộn chế độ đọc
doc-10k p95 89 ms > 50 ms **chưa đạt**, chuyển M5. JSON thô ở `%TEMP%/mdpro-hieu-nang/ket-qua-20261023-183246.json`.

### Còn tồn
1. ~~BLOCKING (M2): `normalizeMath` bậc hai với `<?`, `<!X`, `<![CDATA[` không đóng~~ → **đã sửa ở M2 phiên 5** (`dot/M2.md` "Sửa
   sau kiểm (phiên 5)").
   - Ba nhánh được tách khỏi `HTML_TAG` và tìm bằng `nextIndex`. Lỗi nhỏ cùng loại (``includes('`')`` cho mỗi `\(`) cũng đã sửa. Rà
     cả mô-đun theo cùng mẫu, tìm và sửa thêm 4 đường: `trim()` quét khoảng trắng cuối, `restBlank`/`atLineStart` của dấu đóng
     chung, lượt tìm lại sau vùng bỏ qua.
   - Số đo, 256 KB: `<!a` 15.501 → 13,5 ms; mỗi đoạn một `<?` 2.265 → 20,5 ms; `\( ă ` + backtick 828 → 18 ms. Tài liệu thật
     doc-2k/doc-10k giữ nguyên (1,0/4,0 ms).
   - Đầu ra không đổi trên 1,06 triệu đầu vào ngẫu nhiên. +8 ca bệnh lý: đỏ 8/8 trên bản cũ (bản sao), xanh trên bản sửa.
   - Đã `sync-math.mjs`, test cả hai app, xuất bản lại cả hai app (markdown-editor-pro `92827c9b8e24`, gemini-chat
     `index-5hTNGPNP.js`), `kiem-pwa.py` 57/0, `kiem-toan-edge.py` 9/0.
2. Ngưỡng cuộn chế độ đọc doc-10k p95 ≤ 50 ms (đo được 89 ms) → M5 (perf 9/11, `content-visibility` + dựng theo khối). Chủ dự án cần chấp nhận rõ độ lệch này.
3. Mốc `hieu-nang-moc.json` vẫn là mốc M1, ghi lúc máy bận. Chạy `kiem-hieu-nang.py --nguong --ghi-moc` khi máy rảnh, trước M5 (≈ 25 phút).
4. **Chưa commit** phần M2 phiên 2–5 và M2b: nguồn ở `markdown-editor/`, `frontend/`, `scripts/sync-math.mjs`; bản xuất bản `markdown-editor-pro` (`92827c9b8e24`) và `gemini-chat` (`index-5hTNGPNP.js`); `dot/M2.md`, `dot/M2b.md`.
   - Index đang stage dở: một bản build trung gian của markdown-editor-pro và vài tệp M2. Khi commit, phải `git add -A` đủ các đường dẫn trên để index khớp cây. Đừng commit riêng phần đang stage.
5. Giới hạn đã biết của `normalizeMath` (chi tiết ở `dot/M2.md` "Còn tồn"), áp dụng cho cả gemini-chat:
   - mã thụt lề trong mục danh sách;
   - `listContext` không tắt khi một dòng cột 0 kết thúc danh sách;
   - bẫy `$$ chữ` lan qua container khác;
   - giá hậu tố `5$/tháng … 10$/tháng` trong cùng đoạn.
   Gemini stream kiểu `$$ x^2 +` hiện khối rỗng một nhịp.
6. Ghi chú cho đợt sau (ke-hoach §7.1 và `dot/M2.md`):
   - M5: `splitBlocks` phải coi các vùng toán là chưa đóng; offset tính tương đối trong khối; bất biến `concat(prepare(khối)) == prepare(cả tài liệu)`; xem lại `SAN_SANG`/`cho_yen`.
   - M4b: dùng `KNOWN_WELCOME_SHA256`; đổi `NAP` khi kho chuyển sang IndexedDB.
   - M3: `links='shared'` là một tuỳ chọn của `markdownComponents`; cân nhắc `contain: paint` cho `.markdown-body`.
   - M6: điền 4 ô plugin còn trống đúng thứ tự.
7. Việc còn lại theo app:
   - Wiki: Chia đôi vẫn chậm (W5); chưa quét QR bằng camera thật.
   - JSON: hoàn tác qua menu chuột phải chưa kiểm được bằng trình duyệt.
   - Puzzle: options cho camel/xe máy (P4/P5); CSV lịch sử chưa có cột điểm.
   - Mã không tên ngôn ngữ được vẽ thành `<code>` không có `<pre>` (M6).
   - `kiem-toan-edge.py` chưa vào CI.
   - Skill `ban-do-ung-dung` chưa cập nhật.

### Việc chủ dự án cần tự làm
- **Production:**
  - đặt `MARKDOWN_ADMIN_KEY` thật (khoá mặc định đang công khai);
  - `curl <prod>/wiki/backends` và `<prod>/markdown/backends` để biết kho JSON có nằm ở `/tmp` tạm trên Vercel không;
  - đặt `WIKI_STORAGE_BACKEND=mysql|mongo` trên Vercel. Wiki giờ cảnh báo khi máy chủ chỉ có kho tạm.
- **Thử trên điện thoại/máy thật** (chưa đợt nào làm, gồm cả Safari):
  - Wiki: nối 2 máy bằng QR/liên kết `#/join/…`, chip đồng bộ, banner lỗi, mở PWA đã cài khi offline;
  - Markdown Editor: mở/gõ/cuộn tài liệu dài, chế độ đọc, toán `\[ \]`/`\ce`, banner quota, hỏi trước "Load from backend";
  - gemini-chat: toán khi đang stream;
  - Lights Out: công tắc "Đuổi đèn", par/sao, bất biến trong trình soạn;
  - JSON Editor: ↶ ↷, Ctrl+Z giữa phần gõ tay và Định dạng, Esc rồi Tab.
- **Quyết định:**
  - commit (mục 4);
  - chấp nhận ngưỡng chế độ đọc 10k (mục 2);
  - ghi vào `CLAUDE.md` + skill `webapp-react` quy tắc "sửa `mathDelimiters`/`remarkMathPromote`/`katexOptions`/`mathVectors` ⇒ `node scripts/sync-math.mjs` + test frontend + xuất bản lại cả hai app", và đưa `frontend/src/lib/*` vào bảng tệp sinh ra;
  - thêm `kiem-hieu-nang.py`, json-editor `check.py`, `kiem-toan-edge.py` vào bảng lệnh.

## Việc tiếp theo — đợt 2
- Làn A: **M3** liên kết chia sẻ → **M4a** đồng bộ delta backend → **M4b** đồng bộ delta frontend + IndexedDB → **M5** render theo khối.
- Làn B: **W3** AI soạn note → **J2** metadata khi gập → **J3** Schema: kiểm → **W4** toán Wiki + Notebook → **W5** render theo khối ở Wiki.
- Lệnh kiểm từng đợt ở `ke-hoach.md` §2. Mỗi đợt con: agent cài → agent kiểm độc lập → sửa (≤ 2 vòng) → `dot/<mã>.md`. Không commit khi chủ dự án chưa yêu cầu.

## Sự cố ghi nhận trong đợt 2 (24/10) — người kiểm M3 có thể đã thử nối DB thật

- Trong lúc kiểm M3 (lượt kiểm lại 01:05–01:42), agent kiểm chạy một script nháp ngoài pytest **không đặt `DB_URL` / `RATE_LIMIT_BACKEND`**. Mã backend nạp `backend/fastapi/.env` và `build_rate_limiter` ở chế độ `auto` chọn bộ đếm `database`, nên **đã thử nối Aiven MySQL thật**.
- Nhật ký của nó: `shared counter failed (TimeoutError); counts in memory` → kết nối hết giờ, nên rất có thể **không có bản ghi nào được ghi** (chỉ bộ đếm tạm trong bộ nhớ). Chưa chứng minh được.
- Cái có thể bị ghi nếu kết nối thành công: bảng `rate_limit_hits (limiter, subject, bucket, hits, expires_at)` — `CREATE TABLE IF NOT EXISTS` + `INSERT … ON DUPLICATE KEY UPDATE hits = hits + 1` (`adapter/output/ratelimit/database_rate_limiter.py`). Không có bảng markdown/wiki nào bị chạm bởi script đó.
- **Chủ dự án nên tự kiểm (chỉ đọc):** trên Aiven chạy `SELECT limiter, subject, COUNT(*) FROM rate_limit_hits GROUP BY limiter, subject ORDER BY 3 DESC LIMIT 20;` và xem có hàng nào có `limiter` liên quan markdown (tên có chữ `markdown`/`share`/`admin`) với `expires_at` quanh 24/10 01:05–01:42 (giờ máy dev) hay không. Có thì bảng chỉ chứa bộ đếm tạm, tự hết hạn; không có thì script chưa ghi gì.
- Đã khắc phục cho phần còn lại của đợt 2: mọi prompt agent (cài, kiểm, sửa, kiểm tổng) nay có mục **BẢO VỆ DATABASE THẬT** bắt buộc đặt `DB_URL=sqlite…`, `MONGO_URI=`, `RATE_LIMIT_BACKEND=memory`, `AI_ENABLED=false`, `*_STORAGE_BACKEND=json` cho MỌI tiến trình import mã backend, kể cả script nháp. Đề xuất thêm: sửa `build_rate_limiter(auto)` để không chọn `database` khi đang chạy dưới pytest/không có cờ rõ ràng (chủ dự án quyết).

## Làn Wiki (24/10) — kết quả
- W1–W6 xong; kiểm tổng 25/10: wiki `kiem.js` 388/388, `check.py --tat-ca` 451 đạt + 2 đỏ thời gian do máy bận (chạy lại đúng phép: 0 sai); notebook `kiem.js` 71, `kiem-lib` hợp lệ, `check.py` 0 sai (gồm 115 mẫu C++), `sync.py --kiem` khớp.
- Sửa nhỏ: phép "lưu ghi chú giữa kho lớn" trong `personal-wiki/check.py` nay theo `PW_PERF_SLACK`.
- Còn lại: mermaid thật/SRI chưa thử có mạng; hydrate note 400k chậm (~12 s); PNG không vẽ KaTeX. Chủ dự án tự thử điện thoại, Safari, offline thật. Chi tiết: `dot/WIKI-tong.md`, `dot/W6.md`.

## M6 — Định dạng của LLM (25/10)
Xong: alerts/callout, dấu trích dẫn LLM, ==mark==, ```mmd, tên tệp khối mã, front matter, SVG thành img data:, xuất HTML font tuyệt đối. Kiểm: type-check/lint/build/--check sạch; kiem-dinh-dang 31/0, kiem-pwa 59/0; vitest đủ trừ 1 ca hết giờ do máy bận (chạy riêng đạt). Chi tiết: dot/M6.md.
