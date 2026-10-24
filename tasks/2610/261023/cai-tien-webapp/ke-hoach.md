# Tổng hợp 8 thiết kế — đợt cải tiến web app (23/10/2026)

> Nguồn: `designs/<key>.md` (md-render, md-share, md-sync, wiki-sync-ai, perf-md, json-editor, puzzle-lo-coin, puzzle-camel-bike). Tổng cộng ≈ 173 việc, khoảng 16 việc cỡ L/XL. Không sửa repo.
> Viết tắt: `PY=backend/fastapi/.venv/Scripts/python.exe` · `PT="cd backend/fastapi && .venv/Scripts/python.exe -m pytest"` · `WA=backend/fastapi/webapp/tranphuc8a` · `ME=markdown-editor` · `LPS=$WA/logic-puzzle-suite`.

**Sáu điều bản tổng hợp phát hiện thêm (đã kiểm khi tổng hợp):**
1. gemini-chat (`frontend/src/components/MarkdownRenderer.tsx:229-230`) dùng `remarkMath` + `rehypeKatex` trần, nên dính đúng lỗi `\[ \]`/`\( \)` của editor. Không thiết kế nào phủ.
2. Hai thiết kế puzzle cùng mở rộng hợp đồng nhưng khác tên (`kind` vs `goal`, `grade` vs `quality`), cùng chiếm "HUONG-DAN-ENGINE.md mục 11", cùng thêm vào Daily → phải gộp thành một (mục 1.6).
3. Daily (`core/daily.js:7,27`): chỉ `forDay(today)` được gọi (`ui/app.js:122`, `ui/home.js:10`), nên các ngày đã qua không bị tính lại. Nhưng thêm id vào `ORDER` sẽ đổi loại của chính ngày triển khai và mọi ngày sau. Câu "không đổi lịch đã phát" của puzzle-lo-coin chỉ đúng một nửa.
4. KaTeX chép cục bộ (~590 KB) cho Wiki đụng ngân sách "vỏ < 900 KB" ở `personal-wiki/check.py:180`.
5. Repo không định nghĩa "CW1 v1/v2, CW2, CW3" hay "lạc đà V1/V2" ở đâu cả (`tasks/my-apps/app-8.md:812-823` chỉ là danh sách V2). Cách hiểu của thiết kế là suy đoán.
6. Việc 1 của wiki (`serve_asset` chèn cấu hình cho `…/index.html`) đổi hành vi cho mọi app, và là tiền đề của link chia sẻ markdown.

---

## 1. Việc chung và xung đột

### 1.1 Markdown Editor Pro: một pipeline hiển thị (md-render × perf-md × md-share × md-sync)

| Tệp nóng | Thiết kế sửa | Cách giải |
|---|---|---|
| `src/components/MarkdownView.tsx` | md-render 1, 3–8, 12, 14 · perf 8 (tách plugin/components, BlockedMarkdownView) · md-share V9 (`links='shared'`) | Tạo **`src/lib/markdownPipeline.ts`** một lần, đầu đợt M2. Tệp giữ danh sách remark/rehype, components và tuỳ chọn `{links, blockMode, theme}`. MarkdownView, BlockedMarkdownView, SmartFormatModal, ReadingSurface, SharePage đều lấy từ đây. `links='shared'` là một tuỳ chọn, không phải nhánh riêng. |
| `src/lib/rehypeEnhance.ts` + sanitizeSchema | md-render 1 (className `math-*`, `div.math-block[data-line]`), 6 · perf 7 (`blockMode`, `data-slug`) | Sửa tuần tự M2 rồi M5. Mỗi thuộc tính thêm vào schema đi kèm test "sanitize vẫn giữ". |
| `ReadingView.tsx` | perf 3, 4, 11 · md-share V10 (tách ReadingSurface) | perf 4 (M1) → md-share V10 (M3) → perf 11 thay renderer **bên trong ReadingSurface** (M5). Trang chia sẻ hưởng luôn. |
| `store.ts`, `persistence.ts` | md-sync F4 (L) · perf 3 (saveState, selector), 13 (hoàn tác bằng bản vá) · md-render 3 (tài liệu chào) | perf 3 làm trước (thay đổi cơ học), rồi md-sync F4, rồi perf 13 (perf-md đã tự hoãn 12–13). Đổi nội dung welcome (md-render 3) thì phần đối chiếu của md-sync phải nhận **tập hash của mọi phiên bản welcome cũ**, nếu không welcome bản cũ sẽ bị đẩy lên như tài liệu người dùng. |
| `Header.tsx`, `CommandPalette.tsx`, `App.tsx`, `StatusBar.tsx` | md-render 14 · md-share V12 · md-sync F8 (SyncStatus) · perf 3, 9, 13 | perf 3 (selector hẹp, `useIdleValue`) làm trước mọi thay đổi menu. "Share…" đặt trong File; "Sync" là menu riêng (F8 bỏ "Save to backend"). |
| `scripts/*.py` | kiem-hieu-nang (perf 1), kiem-hien-thi (md-render 16), kiem-chia-se (V14), kiem-dong-bo (F11), kiem-pwa (F11 sửa) | Dùng một helper chung `scripts/_kiem_chung.py`: uvicorn + SQLite tạm + khoá giả + `MONGO_URI=""` + msedge. kiem-pwa chuyển sang kiểm IndexedDB đúng một lần, ở M4b; các đợt trước phải giữ 25/25. |

**Quy tắc ghép:**
- **Thứ tự plugin cố định**, ghi trong markdownPipeline.ts và có test khẳng định thứ tự:
  - `prepareMarkdown` (normalizeMath, `@startuml` → rào, front matter; giữ nguyên số dòng);
  - remark `[gfm, math, mathPromote, alerts, citations, highlight]`;
  - rehype `[raw, styleGuard, svgImage, enhance, sanitize, katex]`. styleGuard và svgImage phải đứng trước sanitize.
- **Toán × render theo khối:**
  - `prepareMarkdown` chạy **theo từng khối và nhớ đệm theo text của khối**. Không chạy trên cả tài liệu mỗi phím, vì 41 ms/300 KB đã vượt ngân sách gõ.
  - `splitBlocks` (perf 6) phải coi các vùng sau là "chưa đóng": rào ```/~~~; `$$`; dòng `\[` đứng riêng cho tới `\]`; `\begin{ENV}` ở đầu dòng cho tới `\end{ENV}`; `@startxxx…@endxxx`; front matter đầu tệp.
  - Offset `display`/`generated` của normalizeMath tính tương đối trong khối.
  - Bất biến phải có test: `concat(prepare(khối)) == prepare(cả tài liệu)`, và render từng khối == render cả tài liệu, trên kho ca toán ở md-render §1.2/§3.1.
  - Việc nào của md-render thêm cấu trúc nhiều dòng thì phải thêm ca vào `blocks.test.ts`.
- **Hiệu năng là cổng:** perf 1 (kiem-hieu-nang.py) làm ngay ở M0. Mỗi plugin md-render phải qua `--nguong`, không chậm hơn mốc quá 10 %. normalizeMath ≤ 0,2 ms/KB.
- **Xuất HTML/PDF/PNG:** `renderAll()` + `.is-exporting` (perf 9) phải ép render cả MermaidDiagram (đang chờ IntersectionObserver, perf 10) và PlantUmlDiagram, và chờ font KaTeX (md-render 15). ServerDiagram ở chế độ ask thì xuất ra chỗ giữ.
- **Trang chia sẻ:**
  - Phải có md-render 7 (`rehypeStyleGuard`) trước khi mở cho người ẩn danh.
  - Sơ đồ trên trang chia sẻ chỉ vẽ offline, không gọi `/diagram`.
  - CSP của md-share đã có `font-src 'self' data:` (md-share.md:298). Nếu làm perf 18 (Worker) thì cần thêm `worker-src 'self'`, và Worker không được tạo từ blob.
- **Xuất bản:** chỉ chạy `build-webapps.mjs --only markdown-editor` trên nhánh đã ghép, ở cuối mỗi đợt. Các tệp `assets/index-*.js` sinh ra luôn xung đột khi ghép.

### 1.2 Backend /markdown: md-share × md-sync (× /diagram của md-render)
- **Quyền quản trị:** cả hai cần. Gộp thành một việc **B0**, làm một lần ở đợt nào chạm trước:
  - thêm dependency `require_markdown_admin`;
  - đổi `_check_admin` thành `check_markdown_admin`, giữ alias;
  - so khoá bằng `secrets.compare_digest`;
  - đếm sai 20 lần/10 phút nếu Q1 duyệt.
  md-sync B11 dùng B0, không dùng `_check_admin` cũ.
- **Quyền đọc:** md-sync cho `/markdown/sync/changes` và `/markdown/docs/{id}` "quyền đọc như GET /files". Nếu kho còn công khai thì mọi tài liệu đọc được qua hai đường này, và liên kết "riêng tư" mất nghĩa. Giải: một cờ `MARKDOWN_PUBLIC_READ` áp cho cả `/files`, `/sync/changes`, `/docs/{id}`. Lịch sử, thùng rác và danh sách liên kết luôn chỉ quản trị.
- **Băm:**
  - Backend: `share_links.content_hash` và `line_patch.sha256_hex` gộp thành một hàm trong `application/utils`.
  - Client: ShareDialog (báo "đã khác bản chụp") dùng chung `sha256Hex` có dự phòng JS thuần của md-sync F1, vì crypto.subtle không có trên http. Đặt ở `src/lib/hash.ts`; thiết kế nào làm trước thì tạo.
- **Chế độ live:** `MarkdownDocumentReaderPort` của md-share và `MarkdownDocsInputPort.get_document` của md-sync là cùng một thứ → dùng cổng của md-sync. Live chỉ làm sau M4.
- **docId:** liên kết khoá theo id trong cây cục bộ. md-sync (a) đổi "id lạ" khi chuyển đổi dữ liệu cũ, và (b) `root`/`welcome` trùng id trên mọi máy, nên hai máy cùng chia sẻ welcome.md sẽ đè liên kết của nhau. Giải:
  - VO của md-share dùng đúng regex id của md-sync B2;
  - cấm chia sẻ `root`;
  - bảng đổi id của B10 cập nhật luôn `markdown_shares.doc_id`.
- **Giới hạn kích thước:** bản chụp 2 MB, tài liệu 3,5 MB, push 4 MB, trần Vercel 4,5 MB (phần thoát JSON cho `\n` và `"` làm thân to thêm). Gom vào một khối cấu hình `MARKDOWN_*` có chú thích. Client tự tách op khi thân vượt 4 MB. Có test biên.
- **Tệp dùng chung:** `config.py`, `.env.example`, `main.py` (đăng ký 3 router mới: markdown_share, markdown_docs, diagram) — sửa tuần tự. Tên thư mục thống nhất: `adapter/output/markdown_share/` và `adapter/output/markdown_docs/`.
- **Kho JSON trên Vercel nằm ở /tmp theo từng instance** (wiki đã nêu, chưa kiểm). Nếu đúng, nó cũng làm chết liên kết chia sẻ, lịch sử và cờ chuyển đổi của md-sync. Cần một lần xác minh và một quyết định (Q2) chung cho wiki và markdown.
- **Thứ tự:** md-share trước md-sync, vì md-share cỡ M, cho giá trị thấy ngay và không đổi dữ liệu. md-sync tách hai đợt:
  - 4a backend: deploy an toàn, vì chuyển đổi chỉ chạy khi client mới gọi `/markdown/sync`, còn PUT cũ vẫn chạy;
  - 4b frontend.

### 1.3 Khoảng trống cần vá tạm (không thiết kế nào đề xuất)
Ba lỗi mất dữ liệu đang xảy ra hôm nay: ghi đè giữa các máy, localStorage vượt 5,24 triệu ký tự thì hỏng ngầm, "Load from backend" thay cây mà không hỏi. md-sync sửa tận gốc nhưng là việc lớn. Đề xuất thêm **một việc vá cỡ S vào M1**, không đổi backend:
- hỏi xác nhận trước "Load from backend";
- hiện banner đỏ khi `writeRaw` gặp QuotaExceeded (persistence.ts:41-48);
- thêm dòng cảnh báo "Save to backend ghi đè cả kho".

### 1.4 Personal Wiki ↔ Algorithm Notebook (md-render × perf-md × wiki-sync-ai)
- **Tệp nóng:**
  - `core/markdown.js`: md-render 17 (toán), perf W2 (`M.blocks`);
  - `ui/editor.js`: perf W1, W3; md-render 18 (hydrate);
  - `ui/app.js`: wiki 4, 5, 10;
  - `index.html` và `sw.js`: wiki 5, 8, 9, 10; md-render 18; perf W3;
  - `check.py`: wiki 3, 12; perf W4; md-render 18.
- **Toán trước, khối sau:**
  - `M.blocks` phải coi `$$`, `\[`, `\begin{ENV}`, ```math, ```mermaid là vùng chưa đóng. perf-md hiện chỉ ghi "HTML/$$ giữ cũng vô hại", chưa đủ.
  - Cache khối của W3 lưu HTML **trước** khi hydrate.
  - `rich.hydrate(container)` chỉ chạy trên nút vừa chèn, đánh dấu bằng `data-hydrated`, chạy lại không đổi kết quả.
- **Notebook đi kèm từng đợt:** đợt nào sửa markdown.js thì chạy `algorithm-notebook/sync.py` và tao-pwa của cả hai app, nếu không `sync.py --kiem` sẽ đỏ. Gộp md-render 19 với perf N1 thành một việc. Luật "không sinh công thức ngoài ý muốn" (lib-string.js:185) vào cùng đợt toán.
- **AI ↔ toán:**
  - Prompt `/ai/wiki` nói rõ toán viết bằng `$…$`/`$$…$$`.
  - Bản Python của `maskCode/parseLinks` phải che cả vùng toán, để `[[` trong TeX không bị hiểu là liên kết.
  - Bản JS và bản Python dùng chung một tệp fixture JSON.
- **Ngân sách vỏ:** KaTeX cục bộ ~590 KB cộng vỏ hiện tại sẽ vượt 900 KB (check.py:180). Đặt ở `assets/vendor/katex/`, nạp lười, tính ngân sách riêng, precache riêng (chốt ở Q5). Notebook kiểm tương tự.
- **Việc 1 của wiki là thay đổi toàn cục.** `serve_asset` chèn cấu hình cho `…/index.html` thì mọi app đổi hành vi theo: markdown-editor-pro, notebook, LPS, portal, khoá học. Vì vậy làm ở đợt đầu và kiểm hồi quy các app đó. Nó còn là tiền đề của md-share:
  - dưới PWA (start_url là `index.html`), liên kết có thể mang dạng `…/index.html#share=`;
  - khi không có cấu hình, `resolveApiBase()` trả `''` (runtimeConfig.ts:52-58), sai nếu API_PREFIX=/api/v1;
  - `shareLinkFor` nên dựng URL thư mục `./`, không dùng `index.html`.
- **QR:** `_portal/assets/js/core/qr.js` sẽ có 3 bản: bản gốc, bản chép cho wiki (việc 5), bản TS của md-share (V13). Mỗi bản có test so ma trận với bản gốc trên cùng đầu vào.

### 1.5 gemini-chat (`frontend/`) — bị bỏ sót
- `MarkdownRenderer.tsx:229-230` dùng `[remarkGfm, remarkMath]` + `[rehypeKatex]`, không có bước chuẩn hoá. Vì vậy câu trả lời Gemini viết `\[ \]`, `\( \)`, `$$x$$` một dòng hay giá `$5…$10` đều hỏng y như ở editor.
- Giải:
  - viết `mathDelimiters.ts` và `remarkMathPromote.ts` dạng thuần;
  - chép sang `frontend/src/lib/` kèm script đồng bộ + kiểm khác biệt (giống `engine/sync.py`);
  - dùng chung bộ vectơ test.
- Lưu ý streaming: chuẩn hoá chạy trên chuỗi chưa hoàn chỉnh, nên ca `\[` chưa đóng phải giữ nguyên chữ.

### 1.6 Logic Puzzle Suite: gộp thành MỘT hợp đồng (puzzle-lo-coin A1–A5 × puzzle-camel-bike việc 1)

| Khía cạnh | lo-coin | camel-bike | Hợp nhất |
|---|---|---|---|
| Loại | `kind ∈ static/interactive/optimize` | `goal:"optimize"` | Chỉ dùng `def.kind` (mặc định `static`). `def.objective {sense,label,unit}` bắt buộc khi `kind=optimize`. Bỏ `goal`. |
| Chấm điểm | `grade(puzzle,state,counters) → {stars,value,best,unit,text}` | `check()` trả thêm `value/best/quality…` | Một hàm `def.grade(puzzle,state,counters) → {value, best, quality∈[0,1], stars 0–3, valueText, bestText, text}`. Helper `Puz.grade.fromRatio(value,best,sense)` dùng cho camel/xe máy/Bachet. Lights Out (par) và CW1 (phạt hoàn tác, gợi ý mức 3) tự đặt `stars`. `check()` vẫn thuần `{solved, complete?}`. HUD của loại optimize gọi `grade` để hiện giá trị hiện có. |
| Lịch sử | `record.grade` | `record.quality/value` | `record.grade` (một object) |
| Hộp thoại "Đã giải" | ô "Điểm tối ưu" | ô "Chất lượng" | Một ô "Điểm tối ưu": sao + "value / best unit". Giữ nguyên 4 ô cũ (check.py:367). |
| Nhãn | `sizeLabel`, `moveLabel` | `mistakeLabel` | Có cả ba, đều tuỳ chọn |
| Kết thúc ván | CW1 `conclude`, Bachet `submit` | `submit` + `truncate`, `core/plan.js` | `core/plan.js` dùng chung (đọc kế hoạch, appendDiff, truncateDiff, submitDiff). Quy ước: `solved` cần cờ "đã nộp/đã kết luận" nằm trong state, để `solution.v` chứa cờ đó (app-worker.js:37, Reveal). `conclude` = submit kèm tham số. |
| Sinh đề | `options` + liên kết seed `o=` | dùng cỡ | `options` dùng chung. camel (xa nhất / chở tới D) và xe máy (cách hiểu A/B) có thể dùng options thay cho cỡ; chốt khi cài. |
| Gợi ý | `hint(…, settings)` | gợi ý cuối là `submit`; nhánh hỏng dùng `truncate` | Có cả hai. `mistakes` = số nước làm mất khả năng thắng chắc / đạt tối ưu (CW1, camel); các loại khác để 0. |
| Kiểm | check.py tầng 3 dùng `min(4, len(replay)−1)`; app-worker lặp qua options | solve_by_hints kết thúc bằng submit | Sửa check.py và app-worker một lần. |
| Tài liệu | HUONG-DAN mục 11 | HUONG-DAN mục 11 | **Một** mục 11: "Puzzle tương tác, tối ưu, options, grade". |
| Daily | thêm vào cuối ORDER | thêm vào cuối ORDER | Một commit cuối, thứ tự chốt một lần. Đổi `ORDER` thành danh sách có phiên bản theo ngày bắt đầu (`[{tu:"…", ids:[…]}]`), để ngày triển khai không đổi loại giữa chừng. |

Gộp các việc trên thành đợt P1 (A1–A5 + camel việc 1). Mẫu vàng Lights Out (B1) phải chạy trước mọi thay đổi engine LO.

### 1.7 JSON Editor — độc lập
Không chung tệp với vùng nào nên chạy song song được. Chỉ chung nguyên tắc:
- hoàn tác là một bước mới (`datVanBan`);
- cột số dòng ảo dùng cùng kỹ thuật với perf 12 (chia sẻ cách làm, không chia sẻ mã).

`kiem-hinh.py` bấm nút theo tên, nên phải giữ nguyên tên truy cập của nút.

### 1.8 Quy tắc chung cho mọi đợt
- Sửa tệp nào của personal-wiki / algorithm-notebook / logic-puzzle-suite / _portal thì chạy `tao-pwa.py` của app đó.
- Không gọi Gemini thật: `/ai/wiki` chỉ test bằng FakeModel. Không ghi Aiven: DDL lúc chạy chỉ xảy ra khi chủ dự án deploy.
- Tệp nhiều regex (mathDelimiters, sua-json, jsonpath, regex-sinh, plantuml) chỉ ghi bằng Write/Edit, rồi chạy `node --check` và test ngay.
- Mỗi đợt kết thúc bằng `tasks/2610/<yymmdd>/<tên>/ban-giao.md`.

---

## 2. Thứ tự giao theo đợt
Có bốn luồng:
- **M**: markdown-editor + backend /markdown + gemini-chat;
- **W**: wiki + notebook;
- **J**: JSON;
- **P**: puzzle.

Các luồng chạy song song được; trong một luồng thì làm tuần tự. W1 chạm tệp toàn cục nên phải xong trước M3.

### Luồng M
| Đợt | Việc (mã trong thiết kế) | Cỡ | Phụ thuộc | Lệnh kiểm |
|---|---|---|---|---|
| M0 Mốc + khung đo | md-render 0; perf 1; ghi mốc 367 vitest và pytest -q | S–M | — | `cd $ME && npm test && npm run type-check && npm run lint`; `$PY $ME/scripts/kiem-hieu-nang.py --bao-cao` |
| M1 Thắng nhanh + vá an toàn | perf 2, 3, 4, 5; việc vá ở §1.3 | M | M0 | npm test/type-check/lint; `kiem-hieu-nang.py --nguong` (doc-10k chỉ editor p50 ≤ 80 ms, chế độ đọc p95 ≤ 50 ms); `node scripts/build-webapps.mjs --only markdown-editor && node scripts/build-webapps.mjs --check`; `$PY $ME/scripts/kiem-pwa.py` |
| M2 Toán P0 + chặn style | tạo markdownPipeline.ts; md-render 1, 2, 3, 7 | M | M1; Q5 (riêng mhchem) | vitest render (≥ 40 vectơ, `katex-error` = 0, số dòng giữ nguyên); `--nguong` không chậm hơn mốc quá 10 %; build + kiem-pwa |
| M2b Toán cho gemini-chat | chép mathDelimiters + mathPromote, thêm script đồng bộ | S | M2 | `cd frontend && npm test && npm run type-check && npm run lint && npm run build`; `node scripts/build-webapps.mjs --only <tên app chat>` rồi `--check` |
| M3 Liên kết chia sẻ | B0; md-share V1–V12, V14, V15 (V13, V16, V17a theo Q1) | L | W1, M2 (việc 7), perf 4; Q1, Q2 | `$PT tests/application/test_share_links.py tests/application/test_markdown_share_usecase.py tests/adapter/output/markdownshare tests/adapter/input/controller/test_markdown_share_controller.py tests/adapter/input/controller/test_markdown_storage_controller.py -q`, rồi `$PT -q`; vitest; `$PY $ME/scripts/kiem-chia-se.py`; kiem-pwa 25/25 |
| M4a Đồng bộ delta — backend | md-sync B1–B8, B10, B11 (ghi lịch sử ngay từ ngày đầu; `MARKDOWN_LEGACY_PUT=allow` cho tới M4b) | L | M3 (B0, hàm băm); Q2, Q3 | `$PT -q tests/application/test_line_patch.py tests/application/test_markdown_docs_*.py tests/adapter/output/markdown_docs tests/adapter/input/controller/test_markdown_docs_controller.py tests/adapter/input/controller/test_markdown_storage_controller.py`; rồi toàn bộ pytest |
| M4b Đồng bộ delta — frontend | md-sync F1–F8, F11 (phần P1) | XL | M4a, M1 (perf 3) | vitest (hai thiết bị + máy chủ giả); `$PY $ME/scripts/kiem-dong-bo.py` (A→B; ngoại tuyến; sửa 1 dòng tài liệu 1 MB thì thân push < 2 KB; tải lại 200 tài liệu/7,4 MB; PUT cũ → 409); kiem-pwa (IndexedDB); build |
| M5 Render theo khối | perf 6, 7, 8, 9, 10, 11 (prepare theo khối, xem §1.1) | L | M2, M3 (ReadingSurface) | blocks.test (khối == cả tài liệu, có ca toán); `--nguong` (doc-10k chia đôi p95 ≤ 150 ms, preview ≤ 400 ms, mở ≤ 2,5 s); `node scripts/audit-webapps.mjs`; kiem-chia-se; build |
| M6 Định dạng LLM | md-render 4, 5, 6, 8, 15 | M | M5 | vitest từng plugin + ca trong blocks.test; `--nguong`; build |
| M7 PlantUML offline | md-render 9, 10, 11, 12, 16 | L | M5; Q4 | vectơ dịch; `$PY $ME/scripts/kiem-hien-thi.py`; build; kiem-pwa |
| M8 Đồng bộ P2 | md-sync B9, F9, F10, F12 | L | M4b | pytest retention; vitest conflict/history; kiem-dong-bo (khôi phục tạo bản mới) |
| M9 Trình soạn lớn | perf 12 + 13, hoặc perf 17 (CM6) | M–L | M4b (store), M5; Q6 | `kiem-hieu-nang.py --nguong --nang`; store.test; kiem-pwa |
| M10 Sơ đồ qua máy chủ + chế độ live | md-render 13, 14; md-share V17b | M | M7, M4a; Q4, Q1 | pytest diagram (httpx.MockTransport, không gọi mạng thật); vitest diagramClient |

### Luồng W
| Đợt | Việc | Cỡ | Phụ thuộc | Lệnh kiểm |
|---|---|---|---|---|
| W1 Sửa đồng bộ | wiki 1, 2, 3 | S–M | — | `$PT tests/adapter/input/controller/test_webapp_controller.py -q`; `node $WA/personal-wiki/kiem.js`; `PYTHONUTF8=1 $PY $WA/personal-wiki/check.py --dong-bo --song-sot` (có biến thể `API_PREFIX=""` + `index.html?source=pwa`; hoàn nguyên một trong hai sửa thì phải đỏ); tao-pwa. Hồi quy toàn cục: `$PY $ME/scripts/kiem-pwa.py`, `_portal/check.py --tinh`, `algorithm-notebook/check.py --tinh`, `logic-puzzle-suite/check.py --tinh`. Chủ dự án tự curl `/wiki/backends` trên production. |
| W2 UX đồng bộ + hiệu năng nhanh | wiki 4 (việc 5 tuỳ chọn); perf W1 | M | W1 | `check.py --chuc-nang --dong-bo --co-gian`; tao-pwa |
| W3 AI soạn note | wiki 6, 7 (backend, làm lúc nào cũng được), 8–12 | L | W1 (việc 2 xuất `Wiki.api`) | `$PT -q -k "ai_wiki or ai_controller"`; kiem.js (xếp hạng 10.000 note < 100 ms); `check.py --ai` rồi `--tat-ca` |
| W4 Toán Wiki (không thư viện) + Notebook | md-render 17; phần sửa dữ liệu của 19 | M | W1 | kiem.js (vectơ + XSS qua data-tex); `$PY $WA/algorithm-notebook/sync.py && $PY $WA/algorithm-notebook/sync.py --kiem`; `node $WA/algorithm-notebook/kiem-lib.js`; tao-pwa cả hai app |
| W5 Render theo khối ở Wiki | perf W2, W3, W4, N1 | M | W4 | kiem.js (blocks == render cả note, có ca toán); `check.py --hieu-nang` (p95 ≤ 120 ms); đồng bộ notebook + notebook `check.py --tinh` |
| W6 Hydrate KaTeX/mermaid | md-render 18; phần còn lại của 19 | M | W5; Q5 | `check.py --tinh --chuc-nang --co-gian --song-sot` (ngân sách vỏ tách riêng vendor); notebook `check.py --tat-ca`; tao-pwa |

### Luồng J
| Đợt | Việc | Cỡ | Phụ thuộc | Lệnh kiểm |
|---|---|---|---|---|
| J1 Lỗi + nền + hoàn tác | 1, 2, 3 | M | — | `node $WA/json-editor/kiem.js` (133 phép cũ + mới); `$PY $WA/json-editor/check.py --tinh --chuc-nang`; `$PY $WA/kiem-hinh.py json-editor` |
| J2 Metadata khi gập (Cây) | 9, 10 | S | J1 | kiem.js phần tom-tat; `check.py --chuc-nang` (360 px) |
| J3 Schema: kiểm | 8, 22, 23, 25, 26 (+24 tuỳ Q8) | L | J1 | `kiem.js schema` (≥ 300 ca); `check.py --chuc-nang` (lỗi bấm tới được vị trí, ReDoS báo hết giờ) |
| J4 Schema: sinh mẫu + suy schema | 27–31 | L | J3 | kiem.js (sinh⇄kiểm, suy⇄kiểm, cùng seed ra cùng kết quả); `check.py --chuc-nang` |
| J5 Tài liệu lớn | 4, 5, 6, 7, 11, 12, 13 | L | J1, việc 8; Q6 | `JE_PERF_SLACK=1 $PY $WA/json-editor/check.py --hieu-nang 10` (input 1 MB < 50 ms, mở Xem 10 MB < 1,5 s) |
| J6 Tìm/thay, JSONPath, định dạng, sửa JSON hỏng | 14–21 | L | J5 | kiem.js (≥ 60 biểu thức JSONPath, ≥ 30 ca sửa); `check.py --chuc-nang` |
| J7 Tài liệu | 32 | S | J6 | `check.py --tat-ca`; `node $WA/kiem-tat.js` |

### Luồng P
| Đợt | Việc | Cỡ | Phụ thuộc | Lệnh kiểm |
|---|---|---|---|---|
| P1 Hợp đồng hợp nhất | A1–A5 + camel 1 (xem §1.6) | M–L | Q7 | `node $LPS/kiem.js core && node $LPS/kiem.js` (929 phép cũ); `$PY $LPS/check.py --tat-ca`; tao-pwa |
| P2 Lights Out P0/P1 | B1–B6 | M | P1 | `node $LPS/kiem.js lightsout` (mẫu vàng); `check.py --chuc-nang --co-gian` |
| P3 CW1 | C1–C6 | XL | P1; Q7 | `kiem.js coinbalance`; `check.py --tat-ca` |
| P4 Lạc đà V1 | camel 2–6 | XL | P1 | `kiem.js camel` (có vét cạn trong test); `check.py --tat-ca` |
| P5 Xe máy | camel 7–9 | XL | P1 | `kiem.js motorbike`; `check.py --chuc-nang --co-gian` |
| P6 CW2 + CW3 | E1–E3, F1–F5 | XL | P1; Q7 | `kiem.js bachet`, `kiem.js coinscale`; `check.py --tat-ca` |
| P7 Lights Out biến thể | D1–D6 | L | P2 | `kiem.js lightsoutx`; `check.py --co-gian --hieu-nang` |
| P8 Lạc đà V2 + Daily + bàn giao | camel 10, 11; G1 | M | P3–P7 | `check.py --tat-ca`; kiem.js; tao-pwa |

**Thứ tự đề xuất khi chỉ một người làm:** M0 → W1 → M1 (kèm perf W1) → M2 → M2b → J1 → P1 → P2 → M3 → M4a → M4b → W3 → J2 → J3 → M5 → W4 → W5 → P3 → J4 → M6 → M7 → P4 → J5 → M8 → P5 → W6 → J6 → M9 → P6 → P7 → M10 → P8 → J7.

Nguyên tắc sắp: lỗi và mất dữ liệu trước, rồi tới yêu cầu trực tiếp của chủ dự án, cuối cùng là phần nâng cao.

---

## 3. Quyết định chủ dự án phải chốt (8)

**Q1. Quyền đọc và khoá quản trị của kho markdown** (gộp md-share Q8, Q9 và câu "ai đọc lịch sử" của md-sync)
- (a) Giữ đọc công khai, chỉ nhắc đặt khoá mạnh.
- (b) Thêm cờ `MARKDOWN_PUBLIC_READ` (mặc định true) áp cho `/files`, `/sync/changes`, `/docs/{id}`. Lịch sử, thùng rác, danh sách liên kết chỉ quản trị. Gia cố khoá: `compare_digest`, đếm số lần sai, cảnh báo khi dùng khoá mặc định.
- (c) Như (b), nhưng mặc định đóng và từ chối khoá mặc định ngoài môi trường dev.
- **Đề xuất (b)**, đồng thời chủ dự án xác nhận ngay `MARKDOWN_ADMIN_KEY` trên production; nếu chưa đặt thì chọn (c). Lý do: khoá mặc định nằm công khai trong repo, và liên kết "riêng tư" chỉ có nghĩa khi kho đã đóng.

**Q2. Hạ tầng dữ liệu khi deploy** (gộp câu "tạo bảng" của md-share/md-sync và câu "kho trên Vercel" của wiki)
- (a) Tạo bảng lúc chạy bằng CREATE TABLE IF NOT EXISTS (như /wiki) cho markdown_shares, markdown_docs, markdown_doc_revisions, markdown_meta. Đặt `WIKI_STORAGE_BACKEND` và kho markdown mặc định là mysql (hoặc mongo) trên Vercel. Thử DDL trên DB thử trước.
- (b) Một migration Alembic 0007 gộp mọi bảng mới, kho mysql.
- (c) Giữ json làm mặc định, chỉ cảnh báo.
- **Đề xuất (a).** Lý do: đúng mẫu đang chạy, bảng cũ không bị đụng nên quay lui được. Còn json ở /tmp làm đồng bộ wiki, liên kết chia sẻ và lịch sử chết ngẫu nhiên (cần curl `/wiki/backends` để xác minh).

**Q3. Gói đồng bộ markdown**
- (a) Nhận nguyên đề xuất md-sync, chia 2 đợt (M4, M8):
  - IndexedDB ngay;
  - merge 3 chiều, đụng nhau thì hỏi;
  - lịch sử keyframe + delta, giữ 50 bản + 1 bản/ngày trong 90 ngày + bản có tên;
  - tự đồng bộ nền;
  - lần đầu khác nhau thì giữ cả hai;
  - client cũ PUT thì trả 409.
- (b) Như (a) nhưng giữ localStorage (workspace vượt 5,24 triệu ký tự vẫn hỏng ngầm).
- (c) Mới-hơn-thắng từng tài liệu như /wiki, không có lịch sử.
- **Đề xuất (a).** Lý do: trần localStorage đã đo trên Edge thật; mới-hơn-thắng làm mất cả một phiên sửa; yêu cầu gốc có "version".

**Q4. Sơ đồ (PlantUML, dot, vega-lite)**
- (a) Mặc định dịch PlantUML offline sang Mermaid, kèm nút "Vẽ chính xác" gọi `/diagram` dùng Kroki công khai. Client mặc định "ask". Trang chia sẻ chỉ vẽ offline.
- (b) Như (a) nhưng tự dựng Kroki bằng docker.
- (c) Chỉ dịch offline; dot và vega-lite vẫn hiện thành khối mã.
- **Đề xuất (a).** Lý do: chạy được trong PWA và riêng tư theo mặc định; Vercel không chạy được plantuml.jar; nội dung chỉ rời máy chủ khi người dùng bấm.

**Q5. Toán: luật `$`, mhchem, thư viện cho Wiki/Notebook (áp cả gemini-chat)**
- (a) Luật pandoc đầy đủ + mhchem (+8,4 KB gzip). Wiki/Notebook chép KaTeX cục bộ (~590 KB, nạp lười, ngân sách vendor riêng ngoài 900 KB); mermaid nạp lười từ cdnjs.
- (b) Như (a) nhưng KaTeX và mermaid đều nạp lười từ cdnjs có SRI; offline thì hiện TeX nguyên văn.
- (c) Luật pandoc, không mhchem; Wiki chỉ hiện TeX nguyên văn có định dạng.
- **Đề xuất (a).** Lý do: sửa được lỗi giá tiền trong câu trả lời ChatGPT, và Wiki/Notebook là app offline. Hệ quả cần ghi vào bàn giao: tài liệu cũ viết `$ x $` (có khoảng trắng sát dấu) sẽ thành chữ thường.

**Q6. Trình soạn cho tài liệu rất lớn**
- (a) Không thêm thư viện. MD làm gutter ảo + hoàn tác bằng bản vá (trần ~55 ms/phím ở 10k dòng, ~120 ms ở 30k). JSON có chế độ Xem ảo chỉ đọc (tự vào khi > 1,5 MB), tắt ngắt dòng mặc định, nháp lớn lưu IndexedDB.
- (b) Thêm CodeMirror 6 cho MD ngay (~130–150 KB gzip, cần đo lại); JSON như (a).
- (c) MD quyết CM6 sau M5, dựa trên số đo lại; JSON như (a).
- **Đề xuất (c).** Lý do: phần lớn độ giật nằm ở preview và việc chạy mỗi phím, sửa được mà không cần phụ thuộc mới. JSON là app viết tay nên không nạp thư viện.

**Q7. Puzzle: cách hiểu nhãn, hợp đồng, Daily**
Repo không định nghĩa các nhãn này. Thiết kế đang hiểu như sau:
- CW1 = cân đĩa tìm xu giả. Các phiên bản: biết nặng / nặng-hoặc-nhẹ / có xu chuẩn / chỉ cần chỉ ra xu; chế độ xu cố định hoặc đối thủ thích nghi.
- CW2 = bộ quả cân Bachet.
- CW3 = cân điện tử: chồng xu giả; xu hai loại (tương ứng "đoán chuỗi nhị phân").
- Lạc đà V1 = một con (đi xa nhất / chở tới đích); V2 = đoàn lạc đà (một chiều / phải quay về).

Lựa chọn:
- (a) Cách hiểu trên là đúng; dùng hợp đồng hợp nhất ở §1.6; đưa 5 loại mới vào Daily bằng ORDER có phiên bản theo ngày.
- (b) Cách hiểu đúng, nhưng không đưa loại mới vào Daily.
- (c) Chủ dự án mô tả lại CW1 v1/v2, CW2, CW3, V1/V2 trước P3–P6 (P1, P2 vẫn làm được ngay).
- **Đề xuất (a)** nếu cách hiểu đúng; phần nào sai thì (c). Lý do: đổi định nghĩa sau khi đã viết engine + board cỡ XL rất tốn.

**Q8. Phạm vi đợt này (~173 việc)**
- (a) Làm đủ mọi thiết kế theo mục 2.
- (b) Làm bản cốt lõi mỗi vùng trước, xét lại sau khi giao. Tạm hoãn:
  - md-render P3 và `/diagram` (M10);
  - md-share V13, V17, V18;
  - md-sync P2 (M8);
  - perf 15–18;
  - JSON việc 24 (unevaluated*) và phần khó của RFC 9535 / regex-sinh;
  - Lights Out D5–D6, lạc đà V2, coinscale chế độ kế hoạch.
- (c) Chỉ sửa lỗi + P0 (W1, M1, M2, J1, P2).
- **Đề xuất (b).** Lý do: giữ được chu trình "kế hoạch → duyệt → sửa → kiểm" cho từng đợt mà mọi yêu cầu gốc vẫn được phủ.

**Coi là đã chấp nhận nếu chủ dự án không phản đối** (mặc định của các thiết kế):
- md-share: chỉ snapshot; token đi qua header `X-Share-Token`; trang xem là `#share=` trong app; mỗi tài liệu một liên kết; hết hạn tuỳ chọn (mặc định không bao giờ); trần 2 MB; không có xem trước OG.
- markdown-editor: giao diện tiếng Anh, thông báo lỗi backend tiếng Việt.
- wiki: sửa cả backend lẫn `hasApi`; giữ `API_PREFIX` rỗng; AI không sửa note cũ; K = 25 kèm tuỳ chọn "chỉ gửi tiêu đề".
- JSON: lỗi format mặc định ở mức cảnh báo; kiểm/sinh chạy trong Worker từ Blob; một schema hiện tại; JSONPath tập con RFC 9535; tự viết ca test.
- puzzle:
  - options/grade như §1.6;
  - CW1 ngân sách lần cân cứng, hoàn tác được nhưng bị ghi nhận;
  - 3 loại xu riêng; lightsoutx là loại riêng; k ∈ {2,3,5}; bàn tự nhập tới 20;
  - xe máy mặc định cách hiểu A, có thêm B; lạc đà ăn cả khi quay về; km nguyên; nộp kế hoạch + chấm chất lượng; dùng BigInt.
- perf: tài liệu có footnote đi đường render cũ; giữ công tắc `render=full` trong 1–2 đợt.

---

## 4. Dependency mới đề xuất (gộp)

| Tên | Vùng | Lý do | Cỡ | Phương án không phụ thuộc | Đề xuất |
|---|---|---|---|---|---|
| `katex` khai báo tường minh + `katex/contrib/mhchem` | markdown-editor (cả frontend nếu áp) | `\ce`, `\pu`; mã hiện đã import CSS của katex mà chưa khai báo | katex: 0 byte (đã có 0.16.47 qua rehype-katex); mhchem: +34 KB min / 8,4 KB gzip | Bỏ mhchem, `\ce` vẫn báo đỏ | Có |
| KaTeX chép cục bộ | Personal Wiki, Algorithm Notebook | Hiện toán khi offline | ~590 KB (JS 76 KB gzip, CSS, 20 tệp woff2) | TeX nguyên văn có định dạng; hoặc nạp từ cdnjs có SRI như khoá học | Có (Q5) |
| mermaid nạp từ cdnjs | Personal Wiki, Algorithm Notebook | ```mermaid trong note và trong đầu ra AI | Chỉ tải khi có sơ đồ | Hiện khối mã | Có; offline thì hiện mã |
| CodeMirror 6 (@codemirror/*, @lezer/*) | markdown-editor | Vượt trần của textarea (48 ms/phím ở 10k dòng, 112 ms ở 30k) | Ước ~130–150 KB gzip (chưa đo) | perf 12–13 (gutter ảo, hoàn tác bằng bản vá) | Quyết sau M5 (Q6) |
| Dịch vụ Kroki (phụ thuộc lúc chạy, không phải gói) | backend /diagram | Vẽ PlantUML/dot/vega-lite chính xác | — (httpx đã có) | Chỉ dịch offline sang Mermaid | Tuỳ Q4 |
| @viz-js/viz | markdown-editor | Vẽ dot offline | ~1,4 MB WASM | Kroki, hoặc tự dịch dot→mermaid | Không |
| dompurify dùng trực tiếp | markdown-editor | SVG inline | 29 KB (đã có qua mermaid) | `<img src=data:image/svg+xml>` | Không |
| JSON-Schema-Test-Suite (dữ liệu test bên thứ ba) | json-editor | Độ phủ đặc tả | ~300–500 KB | Tự viết ca cùng khuôn | Không (chạy thử một lần nếu được phép tải) |

Không tính là dependency: BigInt (Safari ≥ 14), IndexedDB, Worker từ Blob, bản chép `qr.js` của cổng. md-share, md-sync, wiki, JSON và puzzle không thêm gói nào.

---

## 5. Phản biện độ đầy đủ

### 5.1 Yêu cầu chưa được phủ hoặc phủ hời hợt
1. **gemini-chat và câu "tất cả: lag"** (mục 1 đã kiểm):
   - Câu trả lời Gemini hiển thị trực tiếp ở gemini-chat, nhưng không thiết kế nào sửa toán ở đó.
   - Câu "tất cả: lag với md rất dài" mới chỉ được đo trên 3 app. Chưa đo gemini-chat (render cả câu trả lời dài, có streaming) và trang khoá học (`courses/engine/hien-thi.js`).
2. **"Định dạng của Gemini/Claude/ChatGPT":**
   - Thiết kế liệt kê theo Gemini và ChatGPT; không có danh sách riêng cho Claude.
   - Không nói tới TikZ hay `\begin{tikzcd}`.
   - Khối biểu đồ (vega-lite, chart) chỉ vẽ được qua máy chủ; chọn Q4(c) thì không phủ.
   - "Ký hiệu" được hiểu là mhchem + macro; emoji `:shortcode:` để ở P3.
   - Nên lấy 5–10 câu trả lời thật của mỗi LLM làm kho ca kiểm.
3. **PlantUML** chỉ vẽ xấp xỉ. Gantt, deployment, timing và activity cú pháp cũ rơi về khối mã kèm thông báo. Nếu chủ dự án muốn "đúng như plantuml.com" thì phải có Kroki.
4. **Liên kết chia sẻ** chỉ là snapshot: chủ sửa tài liệu thì người nhận không thấy bản mới (live để tới M10). Độ riêng tư phụ thuộc Q1.
5. **Đồng bộ markdown:** từ M4b tới M8, khi hai máy đụng cùng dòng thì app tự "giữ cả hai", nên sẽ sinh tệp trùng. Lịch sử chỉ nằm trên máy chủ, không có bản cục bộ.
6. **Đồng bộ wiki:** bản sửa mới kiểm cục bộ, chưa kiểm production. Nếu Vercel dùng json ở /tmp thì với chủ dự án đồng bộ vẫn "không chạy" cho tới khi xong Q2.
7. **AI của wiki:**
   - Chưa thử Gemini thật (đúng quy tắc), nên chất lượng "note md đẹp" và mức tuân schema chưa đo.
   - "Liên kết thông minh" dựa trên xếp hạng từ vựng (idf), không bắt được đồng nghĩa hay cặp Việt–Anh (vd "vùng chứa" vs "container").
   - Chỉ gửi tối đa 40 ứng viên cho kho có thể tới 100k note.
   - Đề xuất một bộ 10 ghi chép mẫu chấm tay khi chủ dự án cho phép gọi thật.
8. **Puzzle:**
   - Nhãn CW/V là suy đoán (Q7).
   - "Hoàn thiện Lights Out" được hiểu là bất biến + đuổi đèn + biến thể + par, chưa đối chiếu với danh sách lỗi/thiếu cụ thể của chủ dự án.
   - Mục "phối hợp chia sẻ xăng" trong app-8.md gần như trùng lạc đà V2 nhưng không được nhắc tới.
9. **JSON:** không hỗ trợ `$ref` tới URL ngoài (app offline) — cần ghi rõ. Tài liệu 10 MB chỉ mượt sau J5.
10. **Thiết bị thật:** mọi số đo đều từ một máy dev (Edge 155, Windows). Chưa thử điện thoại, chưa thử Safari (CSP meta, html2canvas, scroll anchoring, BigInt).

### 5.2 Kết luận chỉ là suy đoán, chưa kiểm
| Kết luận | Vùng | Cách kiểm |
|---|---|---|
| Production không đặt `MARKDOWN_ADMIN_KEY` | md-share | Chủ dự án xem biến môi trường trên Vercel |
| Kho JSON nằm ở /tmp theo từng instance trên Vercel | wiki (ảnh hưởng cả md-share, md-sync) | curl `<prod>/wiki/backends` và `/markdown/backends` |
| Quyền CREATE và max_allowed_packet trên Aiven đủ | wiki, md-share, md-sync | Chạy DDL trên DB thử |
| INSERT tới Aiven mất 30–80 ms/lượt, nên PUT 211 nút vượt 10 s | md-sync | Đo trên DB thử |
| difflib trên Vercel đủ nhanh | md-sync | Đo lúc cold start |
| Font KaTeX bị mất trong tệp HTML xuất ra | md-render | Việc 15–16 |
| Header CORS của kroki.io/plantuml.com | md-render | Không cần nếu đi qua proxy |
| CSP qua meta chạy trên Safari; Mermaid/KaTeX không cần `unsafe-eval` (mới grep) | md-share | kiem-chia-se.py + thử Safari |
| Hoàn tác dựa vào `beforeinput historyUndo`; Worker từ Blob chạy khi phục vụ qua máy chủ | json-editor | `check.py --chuc-nang` qua http |
| CM6 nặng ~130–150 KB gzip | perf-md | Build thử |
| LB2 tối ưu (đúng trên 638 407 trạng thái, chưa có chứng minh); tham lam CW1 đúng ngoài miền đã thử; tối ưu của xe máy khi không chia hết; Conway–Guy với n > 6 | puzzle | Giữ phép vét cạn trong test; chỉ dùng theo cách an toàn |
| Cú pháp Mermaid 11.17.2 (`participant @{type}`) dùng được | md-render | `mermaid.parse` trong test |
| check.py của wiki ping MongoDB thật | wiki | Đặt `MONGO_URI=""` (việc 3) |
| "Thêm vào cuối ORDER không đổi lịch đã phát" (lo-coin) vs "đổi lịch tương lai" (camel) | puzzle | Đã đọc daily.js: quá khứ không bị tính lại, ngày triển khai và các ngày sau đổi → dùng ORDER có phiên bản |
| KaTeX trong vendor có bị tính vào ngân sách 900 KB hay không (vòng cộng ở check.py:180) | tổng hợp | Đọc vòng cộng của check.py trước W6 |
| Máy yếu chậm hơn "nhiều lần"; JSON Editor nặng gấp ~3; puzzle thêm 150–250 KB | perf, json, puzzle | Đo sau khi cài |

### 5.3 Rủi ro lớn nhất
1. **Dữ liệu thật và bảo mật markdown khi deploy.** Năm thứ chồng lên nhau: khoá mặc định công khai, kho đọc công khai, các endpoint mới (push/restore/share), chuyển đổi lười ghi vào Aiven, đổi kho cục bộ sang IndexedDB. Sai một bước là lộ hoặc mất tài liệu. Giảm bằng cách:
   - chốt Q1 trước M3;
   - deploy M4a khi chưa có client mới (chuyển đổi chỉ chạy khi client mới gọi);
   - thử chuyển đổi trên bản sao SQLite;
   - giữ nguyên bảng cũ;
   - chép sang IndexedDB và đọc lại kiểm trước, rồi mới xoá khoá v2; giữ LocalStorageDocStore làm dự phòng.
2. **Điểm nóng mã markdown-editor** (MarkdownView, rehypeEnhance, store, Header, ReadingView) bị 4 thiết kế cùng sửa, dễ làm vỡ 367 test vitest và xung đột khi ghép. Giảm bằng cách: làm tuần tự đúng mục 2, dùng một markdownPipeline, lấy kiem-hieu-nang làm cổng, chỉ build trên nhánh đã ghép.
3. **Render theo khối gặp toán/sơ đồ nhiều dòng** có thể hiển thị sai mà không báo lỗi (cắt giữa `\begin{align}` có dòng trống, front matter, `@startuml`). Giảm bằng: bất biến concat, kho ca dùng chung, footnote đi đường cũ, công tắc `render=full`.
4. **Vỏ chung của puzzle và Daily** — có thể làm hỏng 5 loại cũ, liên kết seed, Daily. Giảm bằng: làm P1 một lần, có mẫu vàng, chạy `check.py --tat-ca`, dùng ORDER có phiên bản.
5. **Khối lượng:** ~173 việc (~16 cỡ L/XL) so với chu trình duyệt từng bước, cộng nguy cơ làm sai nhãn CW/V. Giảm bằng: Q8 chọn (b), chốt Q7 trước P3.

---

## 6. Quyết định đã chốt (chủ dự án, 23/10/2026)

| # | Chốt |
|---|---|
| Q1 | **Kho markdown mặc định ĐÓNG** (`MARKDOWN_PUBLIC_READ` mặc định false): đọc `/files`, `/sync/changes`, `/docs/{id}` cần quyền quản trị; lịch sử/thùng rác/danh sách link chỉ quản trị; gia cố khoá (`compare_digest`, sai 20 lần/10 phút → 429, từ chối khoá mặc định ngoài dev). |
| Q2 | Tạo bảng lúc chạy (CREATE TABLE IF NOT EXISTS) như /wiki; kho mặc định trên Vercel là mysql. Agent chỉ test SQLite; DDL thật chỉ chạy khi chủ dự án deploy. |
| Q3 | Gói đồng bộ markdown đầy đủ + IndexedDB (delta/bản vá dòng, merge 3 chiều hỏi khi đụng, lịch sử 50 bản + 1/ngày 90 ngày + bản đặt tên, khôi phục = bản mới, tự đồng bộ nền, PUT cũ → 409). |
| Q4 | PlantUML dịch offline sang Mermaid + nút "Vẽ chính xác" qua `/diagram` → Kroki công khai (phần /diagram thuộc nhóm hoãn). Trang chia sẻ chỉ vẽ offline. |
| Q5 | Luật pandoc đầy đủ + mhchem; Wiki/Notebook chép KaTeX cục bộ nạp lười (ngân sách vendor riêng); mermaid nạp lười từ cdnjs. |
| Q6 | Quyết CodeMirror 6 sau M5 dựa trên số đo lại; JSON Editor không thư viện (Xem ảo > 1,5 MB, nháp lớn ở IndexedDB). |
| Q7 | Cách hiểu CW1/CW2/CW3, lạc đà V1/V2, xe máy (cách hiểu A mặc định) là đúng; đưa 5 loại mới vào Daily bằng ORDER có phiên bản theo ngày. |
| Q8 | **Cốt lõi trước.** Hoãn: M10 (`/diagram`, share live), md-share V13/V17b/V18, M8 (đồng bộ P2), perf 15–18, JSON việc 24 + phần khó RFC 9535/regex-sinh, Lights Out D5–D6, lạc đà V2, coinscale chế độ kế hoạch. |

Các mặc định ngầm ở cuối §3 coi như đã chấp nhận.

## 7. Kế hoạch thi công theo làn
- **Làn A** (markdown-editor/ + frontend/ + backend /markdown): M0 → M1 → M2 → M2b → M3 → M4a → M4b → M5 → M6 → M7 (phần offline).
- **Làn B** (app viết tay + backend /wiki, /ai/wiki): W1 → W2 → J1 → P1 → P2 → W3 → J2 → J3 → W4 → W5 → P3 → J4 → P4 → P5 → W6 → P6 → P7 (cốt lõi) → P8 (cốt lõi).
- Đợt 1 = M0–M2b ∥ W1, W2, J1, P1, P2. Mỗi đợt con: agent cài → agent kiểm độc lập → sửa (≤ 2 vòng). Không commit nếu chủ dự án chưa yêu cầu.

### 7.1 Ghi chú chuyển tiếp giữa các đợt (agent đợt sau BẮT BUỘC đọc)
- **Mọi đợt:** đọc bàn giao các đợt trước cùng làn ở `dot/*.md` trước khi bắt đầu.
- **M1** (từ `dot/M0.md`):
  - Đầu đợt, TRƯỚC khi sửa mã, ghi lại mốc bằng `kiem-hieu-nang.py --ghi-moc` (trung vị 3 lần, doc-2k/10k). Mốc M0 đo lúc làn B làm CPU 100 % và điều kiện "yên" đã sửa sau khi ghi. Số trước/sau của M1 phải đo trong cùng điều kiện.
  - Nâng `DOT_HIEN_TAI='M1'` để bật ngưỡng M1; cuối đợt chạy `--ghi-moc`.
  - Sửa thêm 2 lỗi app M0 phát hiện (có bằng chứng trong M0.md):
    1. khung welcome.md vẽ trước khi hydrate;
    2. `restoreAdminSession` bị TIMEOUT_MS 10 s huỷ khi luồng chính bận lúc mở tài liệu rất lớn, nên app rơi về chỉ-xem.
  - Cổng `--nguong`: dùng trung vị 3 lần; nhiễu ±35 %. Nếu chỉ vượt trong khoảng nhiễu thì ghi rõ, đừng sửa ngưỡng cho vừa.
- **M2, M5:** perf 8–11 phải xem lại `SAN_SANG`/`cho_yen` trong kiem-hieu-nang.py. Lý do: khi mermaid chờ IntersectionObserver, `.mermaid-loading` không bao giờ hết.
- **M4b:** `NAP` trong kiem-hieu-nang.py và kiem-pwa.py phải đổi khi kho chuyển sang IndexedDB. Chuyển kiem-pwa sang `_kiem_chung.py` lúc đó.
- **M4a, M4b, M5, M7** (từ `dot/M3.md`):
  - B0 xong: mọi route quản trị mới dùng `Depends(require_markdown_admin)`; route ĐỌC tài liệu (`/sync/changes`, `/docs/{id}`) dùng
    `Depends(require_markdown_reader)` (kho mặc định đóng, khách nhận 403 `markdown_private`). Cả hai ở `adapter/input/controllers/markdown_admin.py`;
    `_check_admin` cũ giờ là alias **async** (phải `await`). Test controller phải `markdown_admin.reset_for_tests()` (bộ đếm sai theo IP sống cả tiến trình).
  - Dùng chung, đừng viết lại: regex id `domain/vo/markdown_ids.DOC_ID_PATTERN` (B2), băm `application/utils/hashing.sha256_hex` (`line_patch`),
    client `markdown-editor/src/lib/hash.ts` (`sha256Hex`, có bản JS thuần) — KHÔNG phải `src/sync/hash.ts` như md-sync.md ghi.
    Thêm `MARKDOWN_DOC_MAX_BYTES`/push vào khối `MARKDOWN_*` đã có chú thích ngân sách trong `config.py`. B10 đổi id thì cập nhật cả `markdown_shares.doc_id` (3 kho).
  - Thân lỗi: client đọc `data.code` qua `StorageError` (`services/markdownStorage.ts`); `loadMarkdownFiles` gửi phiên quản trị; 429 không làm mất phiên.
  - M5/M7: trang chia sẻ (`src/share/SharePage.tsx`) dùng `ReadingSurface` với `links="shared"` — renderer mới đặt BÊN TRONG ReadingSurface; sơ đồ ở trang này
    chỉ được vẽ offline (khi có `/diagram` thì tắt cho `links="shared"`). CSP meta ở `src/boot.ts`: Worker cần `worker-src 'self'` (không blob). `kiem-chia-se.py` (31 phép) phải xanh.
- **M4a, M4b, M5, M7** (từ `dot/M3V.md`, vá M3):
  - Kho liên kết có thêm `MarkdownShareConflict` (cổng ra) → use case đổi thành 409 `markdown_share_conflict`; B10 (`rename_docs`) vẫn bỏ qua id đã có liên kết. Liên kết **hết hạn** khi chia sẻ lại được cấp **token mới** (201), không hồi sinh token cũ.
  - Lỗi kho ở đường đọc công khai (`GET /markdown/shared`) là 503 `markdown_share_unavailable`, không kèm `str(exc)`: đường công khai mới nào cũng phải bọc lỗi kho kiểu `store_unavailable` (SQLAlchemy ghi `[parameters: (<token>,)]` vào thông điệp). `main.generic_exception_handler` vẫn trả `str(exc)` cho mọi route khác.
  - `X-Admin-Key` không còn trần 200 (chỉ `check_markdown_admin` so độ dài); `is_local_request` dùng `ipaddress` (nhận `::ffff:127.x`). `client_address` vẫn tin `X-Real-IP` (quyết định chờ chủ dự án, `dot/M3V.md`).
  - `markdown-editor/src/lib/share.ts`: `parseShareHash` trả `null` khi token rỗng (`#share` là neo, không phải liên kết); `scanDocumentRefs` tuyến tính, có oracle fuzz `src/lib/__tests__/shareScanReference.ts` — đổi luật quét thì sửa cả hai. Mọi neo `#…` mới trong trình soạn (md-sync, TOC) phải đi qua `parseShareHash` mà không bị coi là liên kết.
  - `kiem-chia-se.py` giờ 33 phép (phép 9 = neo `#share`; chủ mới gõ được, ô soạn của khách chỉ đọc).
- **W2, W3** (từ `dot/W1.md`):
  - Dùng `Wiki.api` (`has/base/url/refresh/read`), không đọc `__WEBAPP_CONFIG__` lần nữa.
  - Tầng 6 `--dong-bo` chạy 3 biến thể và có cơ chế đột biến `PW_HOAN_NGUYEN`. Phải giữ cả hai.
- **W4, W5, W6** (từ `dot/W3.md`):
  - Luật vùng toán + `[[liên kết]]` hiện có HAI bản khớp nhau: `personal-wiki/assets/js/core/compose.js` (`mathRanges`, `blankMath`, `defangMath`, `parseLinks`)
    và `backend/fastapi/src/application/utils/wiki_links.py`. Cả hai chạy chung bộ ca `personal-wiki/kiem-lien-ket.json` (kiem.js + `pytest -k ai_wiki`).
  - `notes.js maskCode/parseLinks` (có bản chép ở notebook) CHƯA che toán. Khi W4 dựng toán trong `markdown.js`, hãy dùng đúng luật `compose.mathRanges`.
    Đổi luật thì sửa cả bản Python và thêm ca vào fixture.
  - Giữ tầng `check.py --ai` và đột biến `PW_HOAN_NGUYEN=ai-khong-kiem`. W6 hydrate KaTeX/mermaid nên áp cả cho xem trước `.aic-md` của `#/ai`.
- **J3, J4, J5, J6, J7** (từ `dot/J2.md`):
  - Tóm tắt nhánh (nút nhóm 100 con, placeholder gập của Xem ảo, dòng kết quả) dùng `JE.tomTat` (`assets/tom-tat.js`: `tomTatNut`, `moTaNut`, `dinhDangByte`, `doDaiByte`); `xemTruoc/truongNoiBat` đã chuyển sang đó (JE_THU re-export).
  - Metadata cây chỉ dựng cho hàng GẤP (`taoMeta` → `ganMeta`, lười lúc gấp qua `capNhatMeta` trong `batTat`) với ngân sách `JE_APP.hangSo.NGAN_SACH {ve, hang}` (đối tượng sống; đặt lại ở `veCay` và khi mở nhánh). Hàng dựng mới của J5 phải đi chung đường này; `n._meta`: 0 chưa, 1 chưa đo (đo khi rê chuột/focus), 2 đủ, 3 đã thử/quá lớn.
  - Cache `WeakMap` của `doDaiByte/thongKeNhanh` đúng vì mô hình JSON không bao giờ sửa tại chỗ (mọi `datTai/xoaTai/…` sao nông) — đừng thêm đường sửa tại chỗ.
  - `check.py`: module thuần mới thêm vào `THU_TU_SCRIPT` (hiện je-chung → tom-tat → json-editor) và tuple kiểm "không DOM/storage/đồng hồ"; `--chuc-nang --chi=<hàm,hàm>` chạy riêng nhóm Edge (vd `meta_nhanh_gap`). `.o { min-width: 0 }` đã sửa lỗi tràn ngang 360 px có sẵn — hàng cây mới phải co được (min-width 0 + ellipsis).
- **M4a — ĐỌC TRƯỚC KHI BẮT ĐẦU (24/10, điều phối viên):** một agent M4a trước đó bị dừng giữa chừng (để thêm rào bảo vệ DB) và đã để lại trong cây làm việc phần cài DỞ, chưa có `dot/M4a.md`, chưa qua kiểm độc lập, chưa chắc đã xanh test: `markdown_docs_factory.py`, `markdown_docs_controller.py`, `adapter/output/markdown_docs/{json,mysql,mongo}_repository.py` + `legacy_reader.py`, `ports/{input,output}/markdown_docs_*_port.py`, `usecases/markdown_docs_usecase.py`, `utils/{line_patch,history_retention,sync_paging}.py`, `domain/vo/markdown_docs_vo.py`, các test `test_line_patch.py`, `test_markdown_docs_push.py`, `test_markdown_docs_vo.py`, `test_markdown_docs_repositories.py`, `tests/support/markdown_docs.py` (có thể còn sửa dở `config.py`, `main.py`, `.env.example`). **Đừng làm lại từ đầu và đừng xoá:** đọc kỹ từng tệp, đối chiếu với `thiet-ke/md-sync.md` (B1–B8, B10, B11), giữ cái đúng, sửa/hoàn thiện cái thiếu hoặc sai (không tin test sẵn có — kiểm xem chúng có thật sự kiểm gì), rồi làm nốt phần còn thiếu (route push/pull/lịch sử/khôi phục, chuyển đổi lười, MARKDOWN_LEGACY_PUT, cờ MARKDOWN_PUBLIC_READ, bảng đổi id → markdown_shares.doc_id, test, docs). Ghi trong `dot/M4a.md` phần nào kế thừa, phần nào viết lại và vì sao. Chạy `git status` để thấy hết tệp; đường dẫn trên có thể chưa đủ.
- **M4b, M8 (từ `dot/M4a.md`, backend đồng bộ đã xong; API ở `docs/markdown-sync-api.md`):**
  - Hợp đồng: op `{id, kind, baseRev, set?, content | patch+baseHash, hash, deleted?, updatedAt}` → kết quả `ok | conflict | rejected`; `conflict.record` KHÔNG có `content` khi chỉ đụng `meta`; `md_patch_mismatch` → gửi lại nguyên văn; `md_migrating` (503, `Retry-After: 2`) → thử lại; `reset:true` → đối chiếu lại; bản ghi do chính `device` ghi về không kèm chữ (có `hash`).
  - `src/sync/lineDiff.ts` phải áp đúng `backend/fastapi/tests/fixtures/markdown_patches.json` và sinh patch cùng định dạng (đã kiểm chéo 400 ca mỗi chiều với `nhap/md-sync/proto-diff.mjs`); băm = `src/lib/hash.ts` (surrogate lẻ → máy chủ `md_bad_content`: chuẩn hoá bằng `toWellFormed()`).
  - `MARKDOWN_LEGACY_PUT` mặc định `allow`: bản app cũ còn ghi được vào KHO CŨ, không vào kho mới. Khi M4b xong và mọi máy đã nâng cấp, chủ dự án đặt `reject` (409 `md_legacy_client`); client mới KHÔNG được gọi `PUT /markdown/files`.
  - Đẩy ≤ ~50 op/yêu cầu (MySQL xa: mỗi op vài lượt khứ hồi; trần 200 op / 4 MB chữ). Ghi `deviceId` ổn định (`^[A-Za-z0-9_.:-]{1,64}$`).
  - `GET /markdown/docs/{id}` không tự chuyển đổi; `changes`/`push` mới chuyển. Lần đầu chạm kho mysql tạo 3 bảng + chép cây cũ.
  - **Sửa sau kiểm M4a (24/10):** (1) tổng chữ của các `conflict` trong MỘT phản hồi push ≤ 3 MB (`PAGE_BYTES`, tính `size + 400`/bản ghi, theo thứ tự op); bản không vừa về với `record.content = null` + `contentOmitted: true` → client PHẢI `GET /markdown/docs/{id}` lấy chữ rồi mới gộp (đừng coi `content` rỗng là văn bản rỗng); conflict chỉ đụng `meta` vẫn không có chữ và không có cờ. (2) `GET /sync/changes?since=0` luôn kèm chữ, kể cả bản do chính `device` ghi; chỉ kéo tăng dần (`since>0`) mới bỏ chữ của bản chính mình. (3) Tên thiết bị `legacy` dành riêng (422). (4) Máy chủ tự quyết định lưu delta hay nguyên văn trong lịch sử (tài liệu nhiều dòng lặp có thể bị lưu nguyên văn) — client không phụ thuộc vào đó.
  - M8 (restore/trash/đặt tên bản chưa có route): thêm `restore` bằng một `PushOp` tổng hợp + `origin="restore"`/`restoredFrom` qua `_remember` → `_write_text_revision`; chính sách giữ (50 + 1/ngày × 90 + bản có tên) và dọn tombstone/`horizon` ĐÃ chạy trong đường ghi (có test).
- **M5, M6, M7, M8 (từ `dot/M4b.md`, đồng bộ frontend đã xong, 24/10):**
  - `MARKDOWN_LEGACY_PUT` **mặc định nay là `reject`** (thay gạch M4a ở trên): chỉ chữ `allow` mới cho PUT cũ; app mới KHÔNG gọi `PUT /files`; `saveMarkdownFiles`/`loadMarkdownFiles`/`VITE_MARKDOWN_API_URL` đã gỡ.
  - Kho cục bộ = IndexedDB (`src/sync/docStore.ts`); mọi ghi tài liệu đi qua `src/sync/workspace.ts` (baseline + outbox cùng giao dịch; `commitRemote` từ chối khi nút đã bị gõ sau lúc engine đọc). Đừng ghi thẳng DocStore/localStorage từ store hay component. `flushPersist` chỉ ghi tài liệu đổi; `files` có thể bị thay NGUYÊN cây khi nhận thay đổi từ xa (`applyRemoteDocs`) → cache theo khối (M5) phải khoá theo văn bản, không theo định danh nút. `docsReady=false` lúc khởi động: cây là bộ khung (chỉ có chữ tài liệu đang mở, ≤ 512 KB), `setContent` và thao tác cây bị từ chối tới khi nạp xong.
  - Test: jsdom không có IndexedDB → đường dự phòng localStorage (khoá v2, ghi đồng bộ); muốn thử đường IDB dùng `setDocStoreOpener(async () => new MemoryDocStore())`. Engine: `src/sync/__tests__/fakeServer.ts` (`FakeServer`, `Device`, `manual: true`).
  - Tên truy cập của chỉ báo đồng bộ là `Backend status: …` (đừng đặt tên bắt đầu bằng "Sync": các kiem-* tìm nút menu bằng `^Sync`). Mọi script kiem-* dùng `_kiem_chung.py` (env chặn DB thật: `RATE_LIMIT_BACKEND=memory`, mọi `*_STORAGE_BACKEND=json`). Giữ xanh: `kiem-pwa.py` 59, `kiem-chia-se.py` 34, `kiem-dong-bo.py` 42 phép.
  - `kiem-hieu-nang.py`: `NAP` dựng IndexedDB + ảnh khởi động v3 (tài liệu > 512 KB: khung đầu chưa có chữ). Mốc `hieu-nang-moc.json` CHƯA ghi lại: doc-2k chỉ-editor, khung đầu 384 ms (mốc M1 276 ms), yên 1.254 ms (+39 %), trong nhiễu ±35 % — M5 nên `--ghi-moc` lại đầu đợt nếu số đo không còn so được.
  - M8: `SyncPanel` đang là chỗ trả lời xung đột (3 nút, KHÔNG có diff, KHÔNG gộp tay; "Use the server's" bỏ chữ cục bộ, không giữ bản) → thay bằng `ConflictModal` + `DiffView` (F9) và `stash` cục bộ 30 ngày. Điểm nối: `engine.resolveConflict(id, 'mine'|'server'|'both')`; xung đột nằm ở `OutboxEntry.conflict` (kèm chữ máy chủ). `PushOp` chưa có `origin`. Chưa có phối hợp giữa hai TAB cùng máy (cùng IndexedDB, cùng deviceId).
- **J4, J5, J6, J7 (từ `dot/J3.md`, Schema kiểm đã xong):**
  - `vi-tri.js` (việc 8) đã ĐỦ cho J5/J6: `chiSoDong, dongCuaViTri, timViTri, timNhieuViTri, duongTaiViTri, taoBoQuetKhoi (+ ketQua, duongCuaKhoi), loiNhe`. Khoá trùng lấy cái cuối; khối chưa đóng `viTriDong = -1`, `dongDong = soDong`; `khoiCuaDong[dòng-1]` chỉ gán khối NHIỀU dòng. `timViTri` chịu JSON dở dang. Dùng thẳng, đừng viết lại.
  - Module thuần mới (regex-sinh, schema-sinh, schema-suy, tim-kiem, jsonpath, sua-json): vào `index.html` sau `schema-kiem.js` và TRƯỚC `chay-nen.js`, vào `THU_TU_SCRIPT` + `MODULE_THUAN` của `check.py`; tự vào `JE_NGUON` nên Worker nhận luôn. Sinh / suy trong Worker: thêm loại lệnh vào `xuLy` của `chay-nen.js` (hàm TỰ CHỨA vì được `toString()` nhúng vào Blob).
  - J4: cổng `JE.schema.kiemNut(nut, v, bd)` + `bd.nutTheoConTro("#/properties/x")`; `bienDich(schema, {draft, thuVien})`. Khung phải tab Schema (`.sc-phai`, `#sc-tom`, `#sc-loi`) là chỗ thêm “Sinh dữ liệu mẫu”; tuỳ chọn sinh lưu ở `json-editor:schema-tuy-chon.sinh` (ui-schema giữ nguyên trường lạ). `JE.uiSchema = {ketQua(), soLan(), chay(), nhaySchema(), viDu}`.
  - JE_APP mới: `datHuyHieuCay(Map)`, `tabDuLieuGan()`, `denDuong(duong, {tab:"cay"|"soan"|"tu-dong", chon:"gia-tri"|"khoa"})`, sự kiện `mo-tep`, `hangSo.NGUONG_KIEM_TU_DONG` (1 MB), `hangSo.CHAY_NEN {han, nganLuongChinh}` (đối tượng sống).
  - Đã hoãn (Q8): `unevaluatedProperties/Items` (cảnh báo + bỏ qua); không tải `$ref` ngoài (ghi trong giao diện). Chưa có tầng `check.py --hieu-nang` (J5); kiểm schema 10 MB chưa đo.
  - Test: nhóm `kiem/*.js` được phép trả Promise (`kiem.js` đã await). Phép đo hiệu năng dùng `C.hieuChuan(f)` + `max(mốc × JE_PERF_SLACK, k × đo chuẩn)` — các làn song song làm máy bận ×3, mốc ms cứng sẽ đỏ giả.
  - Ghi mã có regex / `\` bằng Write/Edit, KHÔNG dùng heredoc `python - <<EOF` (mất một dấu `\`, `\b` thành backspace). Tràn ngăn xếp trong vm của kiem/chung.js có thể ném `RangeError` của realm khác: kiểm theo tên / thông báo, đừng chỉ `instanceof`.
- **TĂNG TỐC — áp dụng cho MỌI agent chưa chạy xong (24/10, điều phối viên; chủ dự án yêu cầu đẩy nhanh):**
  - **Người kiểm:** KHÔNG chạy lại bộ kiểm đầy đủ của agent cài (pytest toàn bộ, `check.py --tat-ca`, `kiem-hieu-nang`, `kiem-pwa` nếu diff không chạm PWA/service worker). Tin kết quả đầy đủ trong báo cáo của agent cài — 20+ lượt kiểm độc lập tới giờ đều tái lập đúng số của họ — và lệnh kiểm tổng cuối đợt chạy lại mọi thứ một lần. Việc của người kiểm là ĐỌC diff, tự dựng đầu vào xấu/kịch bản tấn công/đột biến (đó mới là chỗ tìm ra lỗi thật), và chạy lệnh HẸP liên quan đúng phần diff (một tệp test, một tầng). Chỉ chạy bộ lớn khi nghi ngờ hồi quy ở chỗ diff chạm tới.
  - **Agent cài / sửa:** chạy bộ đầy đủ ĐÚNG MỘT LẦN, ở cuối, khi các lệnh hẹp đã xanh; không chạy lại bộ đầy đủ chỉ vì sửa tài liệu.
  - Đừng chờ nhàn rỗi: chạy lệnh dài trong nền và làm việc khác (viết bàn giao, đọc code) trong lúc chờ.
- **P4–P8 (từ `dot/P3.md`, CW1 `coinbalance` đã xong, 24/10):** mẫu loại `interactive` thật để bắt chước là `logic-puzzle-suite/assets/js/puzzles/coinbalance.js` + `ui/boards/coinbalance.js` (oracle tất định trong `moveFor`, `Puz.plan`, `mistakes` = mất thế thắng, grade tự đặt sao, `def.lib` cho bàn/test). Kiểm HẸP một loại trong trình duyệt (không backend, không DB, ~30–60 s): `PYTHONUTF8=1 backend/fastapi/.venv/Scripts/python.exe tasks/2610/261023/cai-tien-webapp/nhap/puzzle-lo-coin/chay-rieng.py <id loại> [vong-doi|ban|hoc|di-dong]`; `check.py --chuc-nang --co-gian` vẫn chạy ĐÚNG MỘT LẦN cuối đợt. Loại có tuỳ chọn làm đổi độ khó phải để `generate` chọn tham số theo điểm (giữ ≥ 90 % đạt bậc ở MỌI tổ hợp, test quét cả hai chế độ) và nên có kiểm đột biến sau khi test xanh. `coinbalance` CHƯA vào Daily — P8 thêm một phiên bản `SCHEDULE` (có sẵn đủ 4 bậc cho phiên bản mặc định `nn3`) và đổi phép kiểm `coinbalance — CHƯA vào Daily` trong `kiem/coinbalance.js`. Ghi chú người chơi (`autonote`/`state.c`) của CW1 chưa làm (xem `dot/P3.md` lệch 7). Lần chạy đầu của `edge_p3` (cửa sổ Edge thứ hai) từng hết hạn 30 s một lần khi máy bận — chạy lại trước khi nghi mã.
- **P3 sửa sau kiểm (24/10, `dot/P3.md` mục "Sửa sau kiểm") — dặn P4–P8:** (1) chip HUD của vỏ LUÔN là `game.counters.moves` (số lần gọi `act`, hoàn tác không giảm): `moveLabel` phải gọi đúng bộ đếm đó ("Số thao tác"), đừng đặt theo đại lượng riêng của loại (CW1 từng ghi "Số lần cân" → mâu thuẫn dòng "Còn r / k lần cân" của bàn); `mistakeLabel` phải nêu mọi thứ `mistakes()` cộng. (2) Hook mới tuỳ chọn `def.sizeText(puzzle)` → nhãn cỡ cho đề tự nhập (vỏ mặc định nối khoá `puzzle.size` = "13×3"). (3) Bàn dựng lại vùng bằng `replaceChildren`: bọc `keepFocus(root, fn)` + lưới nhiều nút roving tabindex dựng một lần (mẫu trong `ui/boards/coinbalance.js`), id mỗi bàn duy nhất. (4) Đối thủ phá hoà bằng băm CÓ seed: `validate` phải truyền `p.seed` để dựng lại đúng `p.solution`. (5) Số đo sửa: `chay-rieng.py <loại> ban` mất 1–3 phút (54 s máy rảnh, 170 s máy bận), không phải 30–60 s. (6) Việc VỎ CHUNG để dành lượt kiểm tổng cuối làn (không riêng CW1): "Xem lời giải từng bước" mở được giữa ván và không bị phạt ở mọi loại — replay lộ lời giải / xu giả cố định; cần quyết chặn giữa ván hay tính như gợi ý mức 3 / Reveal.
- **W5, W6 (từ `dot/W4.md`, toán Wiki/Notebook không thư viện đã xong, 24/10):** luật vùng toán nằm ở MỘT chỗ trong JS: `personal-wiki/assets/js/core/notes.js mathRanges` (`compose.js` dùng lại; bản Python `wiki_links.math_ranges` khớp, chung `kiem-lien-ket.json`) — đổi luật thì sửa cả hai + thêm ca, rồi `algorithm-notebook/sync.py` + `tao-pwa.py` cả hai app. `markdown.js` dựng `span.math` / `div.math.math-d` với TeX nguyên văn trong `data-tex` (`&#10;` thay xuống dòng; W6 PHẢI đọc `getAttribute("data-tex")`, không đọc innerHTML) và ```mermaid → `pre.code.mmd`. Mọi vùng toán dừng ở dòng trống nên `M.blocks` chia theo dòng trống không cắt toán (chỉ rào ``` / ~~~ là vùng chưa đóng); cần ranh giới khối nhiều dòng thì dùng `W.markdown.mathBlocks(lines)`. Cache khối khoá theo văn bản khối, lưu HTML trước hydrate. Trang và đồ thị phải thấy cùng tập `[[liên kết]]` quanh toán (toán thắng; `kiem.js` có fuzz "trang ⇔ đồ thị" — đừng làm lệch). `check.py --toan` (wiki và notebook, ≈ 25 s) + đột biến `PW_HOAN_NGUYEN=toan-khoi-png|toan-khong-thoat`; chế độ soạn "Xem" được NHỚ làm cài đặt, bước kiểm nào đổi chế độ phải trả lại trước khi tạo ghi chú mới.
- **W6 (từ `dot/W5.md`, render theo khối ở Wiki đã xong, 24/10):** xem trước của editor là các `<div class="mdb">` (một khối `M.blocks` mỗi div), vá theo tiền tố/hậu tố chung; tiêu đề mang `data-hid` (id gốc) + `id` do `fixHeadingIds` đặt. Hydrate KaTeX/mermaid vào hook có sẵn `U.rich.hydrate(phầnTửKhốiMới[])` (cuối `renderPreview`; chỉ nhận khối MỚI, khối giữ lại đã mang kết quả; đánh `data-hydrated`, chạy lại không đổi); cache khối giữ HTML TRƯỚC hydrate. Đổi cách cắt khối thì `kiem.js` mục "theo khối" (38 ca + 4.000 ngẫu nhiên) và `check.py --khoi` là rào chắn. `check.py --dai` = kịch bản note 400k gõ giữa note (p95 ≤ 120 ms, sát sàn textarea: máy đông dùng `PW_PERF_SLACK=2`).
- **P3 sửa sau kiểm, bổ sung (24/10, lượt chạy lại; chi tiết `dot/P3.md` "Sửa sau kiểm") — dặn P4–P8:** (7) Nút vừa bấm mà TỰ vô hiệu / ẩn / bị gỡ (Cân, Xoá đĩa, Chốt kết luận, Mở lại…) thả focus về BODY ở Chromium — bọc `keepFocusAfter(fn, to)` (mẫu trong `ui/boards/coinbalance.js`) và kiểm bằng probe `document.activeElement` sau Enter, không chỉ sau chuột. (8) Test trình duyệt: hộp thoại "Đã giải" mở BẤT ĐỒNG BỘ — chờ `dialog[open] h2:has-text('Đã giải')` rồi mới `Escape` (không `wait_for_timeout` cố định, thua khi máy bận). (9) `chay-rieng.py` nay dùng `listen(256)` (mặc định `listen(5)` làm Windows từ chối kết nối → "ERR_CONNECTION_REFUSED" và exit 1 dù mọi phép đạt); số đo bộ đầy đủ sau sửa P3: `check.py --chuc-nang --co-gian` 1 002 đạt (`coinbalance` +22), `kiem.js` 1 250 phép.
- **J5, J6, J7 (từ `dot/J4.md`, sinh dữ liệu mẫu + suy schema đã xong, 24/10):** module mới `regex-sinh.js` (`JE.taoRng`, `JE.regexSinh`), `schema-sinh.js` (`JE.schemaSinh.sinhMau/sinhFormat`), `schema-suy.js` (`JE.schemaSuy`) đều vào `JE_NGUON` nên Worker nhận; `chay-nen.js xuLy` có thêm lệnh `sinh` / `suy`; `schema-kiem.js` thêm `bd.giaiRefTu(co, ref, kw)`. Giao diện: nút `#sc-sinh-mo` (khung `#sc-sinh`), `#sc-suy` (+ băng `#sc-suy-hoi`) ở tab Schema; việc nền dùng CHUNG Worker với kiểm (lệnh mới huỷ lệnh cũ) nên ai thêm lệnh nền cho tab Schema phải đi qua `batDauNen` trong `ui-schema.js` (có `dangNen` / `kiemBiHuy`; callback lệnh bị huỷ nhận `{huy:true}`).
  - **Ngân sách assets 400 KB chỉ còn ~33 KB (367 KB)**: J5/J6 sẽ vượt — nâng `NGAN_SACH_ASSETS` trong `check.py` (đề xuất 600 KB, ghi lý do) ngay khi thêm tệp đầu tiên.
  - Công cụ Bash ăn một nửa dấu `\` kể cả trong heredoc `<<'EOF'` (J4 dính 3 lần) → mã có regex / `\` ghi bằng Write/Edit, script vá cũng ghi bằng Write rồi `node` chạy tệp. `RegExp.test` có thể NÉM (V8 biên dịch lười, "too large") → mọi chỗ chạy pattern người dùng phải `try/catch`.
  - Bộ kiểm: `C.kho` (mọi ca của `C.chaySchema`) cho test mới tái dùng schema J3, chạy lọc một nhóm thì tự nạp im lặng (`C.datIm`). Bước kiểm lại che lỗi "đoán sai rồi cứu bằng thử lại": muốn bắt thì đếm "đúng ngay lần đầu" (`soLanThuNut === soBuocNut`); `nhap/json-editor/j4-dot-bien.js [k/n]` = 34 đột biến (bắt hết sau khi thêm phép đó).
  - Cùng seed chỉ cho cùng mẫu trong CÙNG phiên bản mã; pattern nhìn trước/sau chỉ may rủi + kiểm lại (thường báo `khongDamBao`); việc 24 (unevaluated*) vẫn hoãn nên bộ sinh không xét chúng.
- **P5–P8 (từ `dot/P4.md`, lạc đà V1 `camel` đã xong, 24/10):** mẫu loại `optimize` thật để bắt chước là `logic-puzzle-suite/assets/js/puzzles/camel.js` + `ui/boards/camel.js` (HUONG-DAN-ENGINE.md mục 11.10). Điểm đáng dùng lại cho xe máy / Bachet: (1) kế hoạch `Puz.plan` + action `steps {ops}` (cả lô = một diff) và macro chỉ là BỘ DỰNG thao tác đi cùng đường đó; (2) `def.sim.preview(puzzle, state, action) → {ok, error, after}` để bàn xem trước và hiện lý do lỗi mà không tự cài luật; (3) gợi ý ba nhánh (mất tối ưu → `truncate` về tiền tố tối ưu dài nhất bằng tìm nhị phân; đã đạt → `submit`; còn đường → chặng kế của kế hoạch tiếp nối), kế hoạch tiếp nối phải gộp mỗi đoạn lấy/đặt liền nhau theo TẢI THẬT và chỉ phụ thuộc trạng thái chuẩn hoá thì vòng "áp dụng gợi ý" mới luôn kết thúc; (4) `objective` tĩnh nên nếu một loại có hai đơn vị (km / quả) thì để `unit = ""` và cho `valueText`/`bestText` tự kèm đơn vị; (5) bàn dựng trục bằng HTML định vị theo % (SVG co theo bề rộng làm chữ nhỏ ở 280 px) và nhãn gần mép phải phải LẬT sang trái (`.flip`) để không tràn khung; (6) tên lớp CSS của bàn phải duy nhất trong bàn — `.pz-cm-load` từng trùng giữa nút "Lấy" và thẻ tải của lạc đà làm Playwright bấm nhầm phần tử. Kiểm hẹp: `PYTHONUTF8=1 backend/fastapi/.venv/Scripts/python.exe tasks/2610/261023/cai-tien-webapp/nhap/puzzle-lo-coin/chay-rieng.py camel [vong-doi|ban|hoc|di-dong]` (~2,5 phút tầng `ban`). `camel` CHƯA vào Daily (P8 thêm một phiên bản `SCHEDULE`, đổi phép kiểm "CHƯA vào Daily" trong `kiem/camel.js`; đã có đủ 4 bậc cho cả hai bài). Đề xuất cập nhật skill `ban-do-ung-dung` / metadata.json (liệt kê Lạc đà chở chuối) để P8 làm một lần cùng Daily; V2 đoàn lạc đà HOÃN (bản ghi đã chừa chỉ số lạc đà W = 3).
