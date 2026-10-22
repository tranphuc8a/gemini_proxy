# HIỆU NĂNG với tệp Markdown rất dài — Markdown Editor Pro + Personal Wiki (+ Algorithm Notebook)

Pha: HIỂU + THIẾT KẾ (chưa sửa mã repo). Ngày 22/10/2026. Yêu cầu của chủ dự án: *"performance tệ (lag giật) với file md quá dài"*.

Ký hiệu: **[đo]** = số đo thật (lệnh + tệp kết quả ghi bên cạnh) · **[mã]** = đọc nguồn, có dẫn `tệp:dòng` · **[suy đoán]** = chưa kiểm.

Mọi tệp nháp nằm ở `…/scratchpad/perf-md/` (dưới đây gọi `<S>`). Repo không bị sửa: `git status` sạch sau pha này; junction
`<S>/node_modules → markdown-editor/node_modules` đã gỡ bằng `cmd //c rmdir` (không `rm -rf`).

---

## 0. Tóm tắt một trang

| | Hiện tại (doc 10.000 dòng, 494 KB) | Nguyên nhân chính | Sau thiết kế (mục tiêu) |
| --- | --- | --- | --- |
| Gõ ở chế độ chia đôi (MD Editor) | mỗi phím p95 **10,2 s**, có lúc treo 12,6 s | Mỗi lần ngừng gõ 120 ms → render **lại toàn bộ** tài liệu đồng bộ trên luồng chính (parse + KaTeX + **tô màu code kiểu inline-style** + commit 220k nút DOM) | p95 ≤ 120 ms (trần là chính `<textarea>`: 72 ms) |
| Gõ ở chế độ chỉ editor | p50 104 ms | `getDocumentStats` mỗi phím + gutter 10k dòng + `<textarea>` gốc 48 ms | ≈ 50–60 ms |
| Mở tài liệu | 24 s mới yên (long task 5,1 s) | render một khối liền | màn đầu ≤ 2 s, phần còn lại dựng dần không long task > 300 ms |
| Cuộn preview | p50 50 ms/khung (20 fps) | 220k nút DOM, dựng/vẽ lại phía main thread | 16,7 ms (đã thử `content-visibility`: p50 16,7, janky 36→4) |
| Cuộn chế độ đọc | p95 **1,85 s**/khung | `measure()` mỗi khung cuộn: mỗi tiêu đề `querySelectorAll('[id]')` cả bài (O(H×N)) | ≤ 33 ms |
| Bộ nhớ hoàn tác | +2,7 MB mỗi bước ở doc 30k (200 bước ≈ 540 MB) | `history` giữ **ảnh chụp toàn văn** | ≤ 0,05 MB/bước (lưu bản vá) |
| Personal Wiki: gõ ở chia đôi (note 407k ký tự) | p95 656 ms, mỗi phím một lần render 550–650 ms | render lại toàn note + `innerHTML` toàn bộ + `setStatus` đếm từ/thẻ mỗi phím | p95 ≤ 100 ms |

Bốn thay đổi đem lại phần lớn lợi ích (theo thứ tự nên làm):
1. **CodeBlock tô màu bằng class thay inline-style** (`useInlineStyles={false}` + CSS sinh từ theme): một dòng đổi chính, render khối code nhanh **13–18 lần** [đo `bench-rsh.mjs`: doc-2k 1.497 → 118 ms; doc-10k 8.883 → 487 ms].
2. **Bỏ việc nặng khỏi đường đi mỗi phím** (thống kê, mục lục, bảng lệnh, `saveState`) — chi phí app ở doc 30k từ ~176 ms/phím xuống vài ms.
3. **Render tăng dần theo khối** (tách khối an toàn → mỗi khối một component memo + key ổn định → chỉ khối vừa sửa render lại; dựng dần khi mở; `content-visibility`). Bản mẫu đã chạy: kết quả **giống hệt** render cả tài liệu trên 3 tài liệu sinh + 19/20 ca khó (ca lệch: footnote — có phương án); gõ một phím chỉ còn **1 khối** phải render.
4. **Chế độ đọc**: bỏ truy vấn DOM bậc hai trong `measure()`; dùng chung bộ render khối.

Giới hạn cứng phải biết: một `<textarea>` TRẦN (không React, không xử lý) đã tốn **48 ms/phím ở 10k dòng, 112 ms/phím ở 30k dòng** trên máy này [đo `perf_baseline.py`, cả wrap lẫn no-wrap]. Muốn mượt ở ≥ 20k dòng phải đổi trình soạn sang loại ảo hoá (CodeMirror 6 — **chưa là dependency**, cần chủ dự án quyết; xem §8).

---

## 1. Phương pháp đo (tái lập được)

Máy: Windows 10, Edge 155 (Playwright 1.63, `channel="msedge"`, headless mới), node 24.11. Viewport 1440×900.

| Tệp nháp (`<S>/`) | Làm gì |
| --- | --- |
| `mkdoc.mjs` | Sinh `docs/doc-2k.md` (2.000 dòng, 103 KB), `doc-10k.md` (10.000 dòng, 494 KB), `doc-30k.md` (30.000 dòng, 1,5 MB), `wiki-12k.md` (9.000 dòng, 407k ký tự, dưới trần 500k của wiki). Trộn heading, đoạn văn Việt/Anh có đậm/nghiêng/code/link, danh sách/việc cần làm, bảng 3–5 cột, khối code 8 ngôn ngữ (doc-30k: 774 khối), toán inline `$…$` + khối `$$…$$` (258 khối ở 30k), trích dẫn, ảnh https (181) + 1 ảnh data URL, mermaid (2/5/10). |
| `gen.mjs` | Transpile `markdown-editor/src/lib/{rehypeEnhance,markdown,tree,paneSync,id}.ts` THẬT sang `gen/` (TypeScript `transpileModule`). |
| `bench-me.mjs` | Đo pipeline `MarkdownView` từng bước trong node (plugin thật). |
| `bench-rsh.mjs` | react-syntax-highlighter 16.1.1: `useInlineStyles` true/false. |
| `bench-wiki.js` | Trình dựng wiki `core/markdown.js` thật + việc mỗi phím của `ui/editor.js`. |
| `perf_me.py` | Edge thật, **bản build đang phục vụ** `backend/fastapi/webapp/tranphuc8a/markdown-editor-pro` (cùng commit `1bf8b4c` với nguồn) qua `http.server` cổng trống; API quản trị giả bằng `page.route` (`/markdown/admin/session` → `{"session":"tok"}`), tài liệu nạp sẵn vào `localStorage["markdown-editor:files"]`. Đo: mở (khung hình đầu có editor / preview, thời điểm yên), độ trễ gõ (Event Timing API: input → khung hình kế, gộp theo `interactionId` như INP), long task (`PerformanceObserver('longtask')`), thời gian preview cập nhật, khung hình khi cuộn (rAF), heap/nút DOM (CDP `Performance.getMetrics`), **bộ nhớ riêng của tiến trình renderer** (CDP `SystemInfo.getProcessInfo` + `Get-Process`). Biến: `SHOWLN`, `TAB`, `NOIMG`, `CV`, `WHEELS`. |
| `perf_wiki.py` | Edge thật, Personal Wiki qua `http.server`; note dài nạp bằng chính `Wiki.repo.save`. |
| `perf_baseline.py` | `<textarea>` trần chứa cùng tài liệu (mốc trình duyệt). |
| `prof_me.py` | CDP Profiler khi gõ / khi render / khi cuộn; gộp self-time theo hàm, in đoạn mã của bản build quanh vị trí để nhận diện. |
| `blocks-proto.mjs`, `split.mjs`, `blocks-wiki.mjs` | Bản mẫu "render theo khối" + so khác biệt với render cả tài liệu (MD Editor và Wiki). |

Gõ thử: 21 ký tự (`zqx…`) ở **giữa** một đoạn văn giữa tài liệu, cách nhau 150 ms (≈ 80 từ/phút). Với doc 10k/30k ở chế độ chia đôi chỉ gõ 4/2 ký tự vì mỗi phím treo hàng chục giây.
Kết quả thô: `<S>/out/*.json` (`me-doc-2k.json`, `me-doc-10k.json`, `me-doc-30k.json`, `me-doc-10k-noimg.json`, `me-doc-10k-cv.json`, `me-doc-*-noln.json`, `me-doc-*-outline.json`, `wiki-wiki-12k.json`, `baseline*.json`, `bench-*.json`, `blocks-*.json`), hồ sơ CPU `out/prof-*.txt`.

---

## 2. Hiện trạng — số đo

### 2.1 Markdown Editor Pro trong Edge [đo `perf_me.py`]

| Chỉ số | doc-2k (103 KB) | doc-10k (494 KB) | doc-30k (1,5 MB) |
| --- | --- | --- | --- |
| **Mở, chia đôi**: khung đầu có editor | 1,36 s | 2,0 s | 9,2 s |
| … tới khi yên (preview xong) | 5,6 s | 24,2 s | **86,2 s** |
| … long task tổng / lớn nhất | 5,0 s / 0,96 s | 22,9 s / 5,1 s | 84,6 s / 22,7 s |
| Nút DOM / heap JS / bộ nhớ riêng renderer | 49k / 21 MB / – | 220k / 58 MB / 466 MB | 665k / 151 MB / **1,2 GB** |
| **Gõ, chia đôi**: trễ mỗi phím p50 / p95 / max | 64 ms / **2,5 s** / 3,2 s | 200 ms / **10,2 s** / 12,4 s | 640 ms / 1,3 s (*) |
| … thời gian thật để gõ 21 / 4 / 2 phím (lý thuyết 3,15 / 0,6 / 0,3 s) | **46,6 s** | 45,6 s | 2,7 s + preview cập nhật sau **37,6 s** |
| … long task lớn nhất khi gõ | 3,1 s | 12,6 s | 37,2 s |
| **Gõ, chỉ editor**: p50 / p95 / max | 56 / 80 / 136 ms | 104 / 136 / 216 ms | **288 / 336 / 560 ms** |
| Mở chỉ editor (khung đầu) | 0,77 s | 1,44 s | 5,8 s (long task 5,3 s) |
| Cuộn editor (chia đôi, kéo theo đồng bộ cuộn): p50 / p95 / khung > 50 ms | 16,7 / 33 / 2 | 33 / 100 / 36 trên 114 | 133 / 250 / 80 trên 96 |
| Cuộn preview: p50 / p95 / khung > 50 ms | 16,7 / 33 / 0 | 50 / 67 / 36 trên 111 | 117 / 233 / 81 trên 90 |
| Cuộn editor ở chế độ chỉ editor | mượt | mượt | p95 33 ms |
| **Chế độ đọc**: tới khi yên / long task max | 8,3 s / 1,75 s | 51,5 s / 10,9 s | (không đo — dự kiến vài phút) |
| … cuộn: p50 / p95 / khung > 50 ms | 16,7 / 83 / 40 trên 134 | **183 / 1.850** / 77 trên 79 | – |
| … nút DOM (app ẩn bên dưới + bài đọc) | 86k | 401k / 745 MB riêng | – |
| Hoàn tác: bộ nhớ riêng tăng sau 10 bước (mỗi bước = dừng gõ > 600 ms) | – | +10,4 MB (1,04 MB/bước) | **+27,1 MB (2,7 MB/bước)** |
| Ctrl+S (`flushPersist`, `JSON.stringify` + `localStorage`) | < 50 ms | < 50 ms | 2 long task, max 71 ms; không lỗi quota |

(*) chỉ gõ 2 phím; phím thứ hai rơi vào lúc render toàn bộ bắt đầu.

Thí nghiệm A/B (doc-10k trừ khi ghi khác):

| Thí nghiệm | Kết quả | Kết luận |
| --- | --- | --- |
| Tắt số dòng (`SHOWLN=false`), chỉ editor | 10k: p50 104 → 88 ms; 30k: 288 → 288 ms; mở 30k 5,8 → 3,2 s | Gutter tốn ~15 ms/phím ở 10k và ~2,6 s khi mở 30k; ở 30k phần lớn chi phí mỗi phím nằm chỗ khác (thống kê) |
| Mở tab Mục lục (`TAB=outline`), chỉ editor | 10k: p50 104 → 112, max 336; 30k: p50 288 → **392**, max 736 ms | `Outline` tính lại + vẽ lại toàn bộ mỗi phím |
| Chặn ảnh (`NOIMG=1`), cuộn preview | p50 66 ms, 70 long task | Ảnh lười **không** phải nguyên nhân cuộn giật |
| Chèn CSS `.markdown-body > * {content-visibility:auto}` (`CV=1`) | cuộn preview p50 50 → **16,7**, khung > 50 ms 36 → **4**, long task 47 → 3; mở 24,2 → 21,2 s | Cuộn giật do dựng/vẽ cây DOM khổng lồ phía main thread; `content-visibility` chữa được |

### 2.2 Mốc trình duyệt: `<textarea>` trần [đo `perf_baseline.py`]

| Tài liệu | wrap mềm p50 / p95 | không wrap p50 / p95 |
| --- | --- | --- |
| doc-2k | 24 / 40 ms | – |
| doc-10k | 48 / 72 ms | 48 / 72 ms |
| doc-30k | 112 / 152 ms (mỗi phím 1 long task ~100 ms) | 112 / 128 ms |

⇒ Phần app thêm vào (chỉ editor): 2k ≈ +32 ms, 10k ≈ +56 ms, 30k ≈ +176 ms mỗi phím. Phần trình duyệt không bỏ được nếu vẫn dùng `<textarea>`.

### 2.3 Hồ sơ CPU [đo `prof_me.py`]

- **Gõ chỉ editor, doc-30k, 10 phím** (`out/prof-30k-editor.txt`): `(program)` (việc gốc của trình duyệt: textarea, style, layout) 39 %; **`getDocumentStats` và các hàm con** (`pr`=getDocumentStats, `lr`=scanLines, `ur`=slugify, `dr`=stripInlineMarkdown, map/forEach của scanLines/extractHeadings) ≈ **25 %** (~118 ms/phím); React reconcile (gutter 30k phần tử) ≈ 10 %; GC 6 %; React đọc lại `textarea.value` 1,4 triệu ký tự (`Ve`) 2,3 %; `lineAtOffset` vòng từng ký tự (`mr`) 2 %.
- **Một lần render preview, doc-2k** (`out/prof-2k-split.txt`): **1,39 s** nằm ở hai hàm vô danh trong `index-*.js:77` — chính là `createElement` của react-syntax-highlighter: `Object.keys(stylesheet).reduce(… split('.').forEach(… includes …))` chạy **cho từng token** (`node_modules/react-syntax-highlighter/dist/esm/create-element.js:80-95`, nhánh `useInlineStyles`); chunk `markdown-*.js` (micromark/unified/katex) 0,86 s.
- **Cuộn preview, doc-10k** (`out/prof-10k-scroll.txt`): 79 % `(program)`, JS của app ~0 % ⇒ chi phí là dựng/vẽ cây DOM, không phải mã app.

### 2.4 Pipeline từng bước trong node [đo `bench-me.mjs`, trung vị 3 lần; CodeBlock/Mermaid thay bằng thẻ đánh dấu]

| Bước (ms) | doc-2k | doc-10k | doc-30k |
| --- | --- | --- | --- |
| react-markdown đầy đủ → chuỗi (không gồm tô màu code, không gồm DOM) | 1.158 | 7.240 | 23.910 |
| s1 parse micromark + GFM + math | 254 | 1.446 | 7.977 |
| s2 mdast → hast | 73 | 304 | 852 |
| s3 rehype-raw | 69 | 405 | 1.169 |
| s4 rehypeEnhance | 85 | 232 | 821 |
| s5 sanitize | 53 | 268 | 906 |
| s6 KaTeX | 300 | 1.520 | 5.506 |
| s7 hast → JSX | 202 | 1.083 | 4.347 |
| s8 React SSR của cây | 200 | 631 | 3.998 |
| refractor tô màu mọi khối (chỉ tách token) | 26 (52 khối) | 55 (291) | 241 (774) |
| **react-syntax-highlighter tạo phần tử, inline-style (hiện tại)** [`bench-rsh.mjs`] | **1.497** | **8.883** | – |
| … `useInlineStyles=false` | 118 | 487 | – |
| Phần tử hast / mốc `data-line` | 17k / 637 | 81k / 3.120 | 256k / 10.793 |
| **Mỗi phím** `getDocumentStats` | 11,8 | 32,8 | **129** |
| **Mỗi phím** `extractHeadings` (chạy 2–3 lần/phím, §3) | 2,2 | 6,5 | 20,3 |
| **Mỗi phím** `content.split('\n')` (≥ 2 lần/phím) | 0,6 | 1,3 | 9,0 |
| Autosave `JSON.stringify` toàn bộ tệp | 0,8 | 4,0 | 9,3 |
| Một bản sao trong `history` (UTF-16, có tiếng Việt) / 200 bản | 0,2 / 35 MB | 0,8 / 169 MB | 2,6 / **528 MB** |

### 2.5 Personal Wiki [đo `bench-wiki.js`, `perf_wiki.py` với `wiki-12k` 407k ký tự, 9.000 dòng]

| Chỉ số | Giá trị |
| --- | --- |
| `M.render` cả note (node) | 150 ms (không tô màu: 106 ms) — nhanh hơn pipeline MD Editor ~45 lần |
| `setStatus()` mỗi phím (node): `extractCards` + `words` (+ `same`) | 9,6 + **34** + 0 = **44 ms** |
| Mở note (chia đôi): thấy / yên / long task max | 1,3 s / 2,4 s / 617 ms |
| **Gõ chia đôi**: p50 / p95 / max | 88 / **656** / 768 ms; 21 phím mất 17,0 s (lý thuyết 3,15 s); **21 lần render preview**, mỗi lần một long task 550–670 ms |
| Gõ chỉ "Sửa": p50 / p95 / max | 96 / 112 / 120 ms (≈ textarea gốc ~48 ms + setStatus ~44 ms) |
| Cuộn editor / preview | mượt (16,7 ms), DOM 60k nút |
| Lưu (Ctrl+S: chỉ mục đảo + thẻ + liên kết) | 250 ms, long task 149 ms — chấp nhận được, chỉ khi lưu |

Algorithm Notebook dùng **cùng** `core/markdown.js` (chép bằng `algorithm-notebook/sync.py`); ghi chú cá nhân ≤ 100.000 ký tự (`algorithm-notebook/assets/js/data/user.js:9`); xem trước chỉ bật bằng nút và khi bật thì **ẩn textarea** (`assets/js/ui/detail.js:88`) nên nhánh render mỗi phím ở `detail.js:87` thực tế không chạy. ⇒ Không có vấn đề riêng; chỉ nhận cải tiến của `markdown.js` qua `sync.py`. [mã]

### 2.6 Bản mẫu "render theo khối" [đo `blocks-proto.mjs`, `blocks-wiki.mjs`]

| | doc-2k | doc-10k | doc-30k | wiki-12k (wiki) |
| --- | --- | --- | --- | --- |
| Số khối | 335 | 1.698 | 5.058 | 1.549 |
| Kích thước khối p50 / max (ký tự) | 236 / 1.075 | 218 / 1.442 | 228 / 1.844 | – |
| `splitBlocks` (ms, nóng) | 4,5 | 10,4 | 22,9 | 6,9 |
| Render mọi khối từ đầu (ms) vs cả tài liệu | 2.987 vs 1.464 (JIT nguội) | 6.878 vs 6.296 | 17.820 vs 23.910 | 142 vs 164 |
| **Kết quả giống render cả tài liệu** (sau chuẩn hoá id tiêu đề) | ✅ | ✅ | (không so — 24 s) | ✅ |
| `data-line` tuyệt đối khớp | ✅ | ✅ | – | – |
| **Gõ 1 phím giữa tài liệu**: tách lại + render | 3 + 9 ms, **1 khối** | 8,6 + 34 ms (*), 1 khối | 30 + 34 ms (*), 1 khối | **15,7 ms**, 1 khối |

(*) bản mẫu nối lại toàn bộ chuỗi HTML + regex dời `data-line` cho mọi khối (O(n)); thiết kế thật không làm vậy (wrapper mang dòng bắt đầu, React chỉ đụng khối đổi).

20 ca khó (danh sách lỏng, danh sách số cách dòng, rào code lồng trong mục danh sách, rào có dòng trống, rào `~~~` chứa ```` ``` ````, `$$` có dòng trống, `<details>` chứa markdown,
chú thích HTML nhiều dòng, `<div>` lồng nhau, code thụt lề, setext, bảng, trích dẫn, tiêu đề trùng, `---`/`***`, việc cần làm, **link tham chiếu** (nối định nghĩa vào khối),
giá tiền `$5`, mermaid có dòng trống): **19/20 giống hệt**; lệch duy nhất **footnote** (đánh số cục bộ theo khối) — xử lý ở §5.1.F.

---

## 3. Phát hiện (nút thắt, xếp theo mức hại)

1. **[cao] Render lại toàn bộ tài liệu mỗi lần ngừng gõ 120 ms, đồng bộ, không chia nhỏ.** `Preview.tsx:19` (`RENDER_DEBOUNCE_MS = 120`), `:36-39` (debounce), `:117` → `MarkdownView.tsx:76-79` một `<ReactMarkdown>` cho cả tài liệu (react-markdown 9 chạy `processor.runSync` ngay trong render — không ngắt được). Người gõ 150 ms/phím ⇒ gần như phím nào cũng kích hoạt một lần render 3 s (2k) / 12 s (10k) / 37 s (30k). Đây chính là "lag giật". [đo §2.1]
2. **[cao] Tô màu khối code bằng inline-style của react-syntax-highlighter**: `CodeBlock.tsx:60-68` dùng `style={styleFor(...)}` (mặc định `useInlineStyles=true`) ⇒ `create-element.js:80-95` tính lại danh sách selector của **cả** stylesheet cho **từng** token (~0,3 ms/token). Chiếm ~60 % một lần render doc-2k. `CodeBlock` không `memo` nên mỗi lần Preview render là tô lại mọi khối. [đo §2.3, §2.4]
3. **[cao] Việc O(n) chạy mỗi phím, ngoài debounce**:
   - `StatusBar.tsx:25` `getDocumentStats(content)` mỗi phím (129 ms ở 30k; nó lại gọi `extractHeadings` và `scanLines` hai lần — `lib/markdown.ts:102-119`). `ReadingView.tsx:89,92` cũng vậy khi đang đọc.
   - `CommandPalette.tsx:103` gọi `extractHeadings(content)` + dựng lại danh sách lệnh **mỗi phím kể cả khi bảng lệnh đóng** (luôn được mount ở `App.tsx:234`; `useMemo` phụ thuộc `content`, không phụ thuộc `open`; `if (!open) return null` ở `:134` đứng sau).
   - `Outline.tsx:10` tính + vẽ lại toàn bộ mục lục mỗi phím (đo: +104 ms/phím ở 30k).
   - `FindReplace.tsx:23` `findMatches` trên toàn văn mỗi phím khi hộp tìm mở.
   - `store.ts:204-207` `schedulePersist` gọi `set({saveState:'saving'})` mỗi phím (lần `set` thứ hai mỗi phím ⇒ mọi selector chạy lại); `setContent` (`store.ts:218-228`) thay cây `files` mỗi phím ⇒ `Header` (`Header.tsx:93-100`), `Sidebar`, `FileTree`, `StatusBar`, `CommandPalette` đều render lại.
   [mã + đo §2.1, §2.3]
4. **[cao] Gutter và "gương" đo dòng của editor dựng lại toàn bộ mỗi phím**: `EditorPane.tsx:57` `content.split('\n')`; `:503-511` một `<div>` cho **mỗi** dòng (30k phần tử mỗi phím); `:543-551` gương thêm ≤ 6.000 `<div>` và `:66-89` đo `offsetTop` của từng dòng trong rAF sau **mỗi** phím (cưỡng bức layout); quá 6.000 dòng thì tắt đo (`MAX_MEASURED_LINES`, `:30`) nên đồng bộ cuộn kém chính xác. Mở doc-30k chỉ editor mất 5,8 s chủ yếu vì gutter. `lineAtOffset` (`lib/markdown.ts:122-129`) duyệt từng ký tự mỗi `keyup/click/select`. [mã + đo]
5. **[cao] Chế độ đọc cuộn giật bậc hai**: `ReadingView.tsx:205-206` mỗi sự kiện cuộn → rAF `measure()` → với **mỗi** tiêu đề gọi `headingElement()` (`:96-101`) = `Array.from(article.querySelectorAll('[id]')).find(...)` (duyệt cả bài) rồi `getBoundingClientRect` ⇒ O(số tiêu đề × số phần tử) mỗi khung. Thêm: chế độ đọc render cả tài liệu **lần thứ hai** trong khi app bên dưới chỉ `visibility:hidden` (`App.css:21-23`) ⇒ 401k nút ở 10k. [mã + đo p95 1,85 s]
6. **[vừa] Cuộn preview giật vì cây DOM khổng lồ** (220k/665k nút): hồ sơ CPU 79 % là việc gốc của trình duyệt; `content-visibility:auto` cho các khối cấp cao đưa p50 về 16,7 ms. Không phải do ảnh (thí nghiệm `NOIMG`). [đo]
7. **[vừa] Hoàn tác lưu ảnh chụp toàn văn**: `store.ts:242-253` (`history` ≤ 200 chuỗi đầy đủ). 2,7 MB/bước ở doc 30k (chuỗi `textarea.value` là external string của Blink nên heap JS **không** thấy — phải đo bộ nhớ tiến trình). Nguy cơ sập tab trên điện thoại sau một buổi sửa. [đo]
8. **[vừa] Mermaid render lại khi key vị trí đổi**: hast-util-to-jsx-runtime đặt key `tên-thẻ-thứ-tự` (`pre-5`…) ⇒ thêm/bớt một khối code phía trên làm mọi sơ đồ phía dưới nhận `source` khác hoặc bị mount lại (`MermaidDiagram.tsx:43-70`: effect theo `[source, theme]`, không có cache SVG). [mã]
9. **[vừa] Neo đồng bộ cuộn**: `paneSync.ts:107-123` `querySelectorAll('[data-line]')` + `getBoundingClientRect` từng phần tử (10.8k ở 30k) sau mỗi render và **mỗi ảnh tải xong** (`Preview.tsx:53-54`, listener `load` capture, không gộp); `offsetForLine/lineForOffset` (`:69-104`) dò tuyến tính. [mã]
10. **[thấp] Lưu localStorage**: debounce 800 ms (`store.ts:35`), `JSON.stringify` mọi tệp: 9 ms + ghi ở 30k — đo Ctrl+S 71 ms, không lỗi quota ở 1,4M ký tự. Chưa cần đổi; ghi nhận rủi ro quota khi có nhiều tệp lớn (§9).
11. **[cao, Wiki] Render lại toàn note + `innerHTML` toàn bộ sau 140 ms ngừng gõ**: `ui/editor.js:155-165` (`schedulePreview` → `renderPreview` → `prev.innerHTML = M.render(...)`). 150 ms JS + parse HTML 765 KB + layout ⇒ 550–650 ms mỗi lần. [đo]
12. **[vừa, Wiki] `setStatus()` mỗi phím**: `ui/editor.js:49` (`changed()` → `setStatus()` ngay) → `:209` `F.extractCards(id, content)` + `words(content)` (regex `\p{L}` cả note → mảng mọi từ) = 44 ms/phím ở 407k ký tự. [đo]
13. **[cao, cả hai] Giới hạn của `<textarea>`**: 48/112 ms mỗi phím ở 10k/30k dòng ngay cả khi trang không làm gì (§2.2). Chỉ trình soạn ảo hoá (chỉ dựng dòng đang thấy) vượt được. Wiki bị chặn ở 500k ký tự (`core/notes.js:25`) nên tối đa ~50 ms — chấp nhận được.

Không phải nút thắt (đã kiểm): ghi IndexedDB nháp của wiki (500 ms, không thấy long task khi gõ chỉ "Sửa" ngoài chi phí mỗi phím); chỉ mục tìm kiếm wiki chỉ cập nhật khi Lưu (250 ms); cuộn trong wiki mượt; `setNodeContent` (~0 ms).

---

## 4. Mục tiêu (trước → sau) và cách giữ bằng test

| Kịch bản (Edge headless, 1440×900, máy dev này) | Trước | Mục tiêu sau | Ngưỡng test hồi quy (× `MD_PERF_SLACK`/`PW_PERF_SLACK`, mặc định 1, máy chậm 3) |
| --- | --- | --- | --- |
| MD: doc-10k chia đôi, gõ 21 phím: trễ p95 | 10,2 s | ≤ 100 ms | p95 ≤ 150 ms; long task max ≤ 150 ms |
| MD: doc-10k preview cập nhật sau phím cuối | (sau 12 s treo) | ≤ 300 ms | ≤ 400 ms |
| MD: doc-2k chia đôi, gõ: p95 | 2,5 s | ≤ 50 ms | ≤ 80 ms |
| MD: doc-10k chỉ editor: p50 | 104 ms | ≤ 60 ms | p50 ≤ 80 ms |
| MD: doc-30k chỉ editor: p50 | 288 ms | ≈ 120 ms (trần textarea 112) | p50 ≤ 180 ms (chạy với `--nang`) |
| MD: doc-10k mở: khung đầu có nội dung preview | 24 s mới có | ≤ 2 s | ≤ 2,5 s; sau đó không long task > 300 ms; dựng xong ≤ 30 s |
| MD: doc-10k cuộn preview: khung > 50 ms | 36/111 | ≤ 5 % | ≤ 10 % |
| MD: doc-10k cuộn chế độ đọc: p95 | 1.850 ms | ≤ 33 ms | ≤ 50 ms |
| MD: hoàn tác doc-10k, 10 bước: bộ nhớ riêng tăng | +10,4 MB | ≤ 1 MB | ≤ 5 MB |
| Wiki: note 407k chia đôi, gõ: p95 | 656 ms | ≤ 80 ms | ≤ 120 ms; mỗi lần cập nhật preview long task ≤ 100 ms |
| Wiki: gõ chỉ "Sửa": p50 | 96 ms | ≈ 55 ms | ≤ 80 ms |

Ngưỡng dùng **hệ số máy chậm** giống `code-studio/kiem.js:13` (`CS_PERF_SLACK`). Mọi phép đo trình duyệt in bảng số + ghi JSON để so giữa các lần.

---

## 5. Thiết kế chi tiết

### 5.1 Markdown Editor Pro (`markdown-editor/`)

#### A. Khối code: class thay inline-style (việc 2)

- `CodeBlock.tsx`: `<SyntaxHighlighter useInlineStyles={false} … className={`prism-${key}`}>`; bọc `memo` (so `language/source/theme/contrastBackground`).
- `src/lib/prismCss.ts` (thuần, có test): `prismThemeToCss(style: Record<string, CSSProperties>, scope: string): string` — đổi object theme của react-syntax-highlighter (`oneLight`, `oneDark`, và bản đã qua `withContrast` cho chế độ đọc — `CodeBlock.tsx:25-35` giữ nguyên) thành CSS:
  khoá là tên token đơn (`comment`, `keyword`, …) → `.${scope} .token.${k}`; khoá có selector (`.language-css .token.string`, `code[class*="language-"]`, …) → `.${scope} ${k}`; camelCase → kebab-case; bỏ `background` của `pre/code` gốc (CodeBlock tự đặt `transparent`).
  `ensurePrismSheet(key, css)`: chèn một `<style data-prism="key">` vào `<head>` một lần (Map key → true). Khoá = `theme|background`.
- Xuất HTML (`exporters.ts:35-71`) đã chép mọi luật CSS cùng origin từ `document.styleSheets` ⇒ thẻ `<style>` chèn động vẫn được chép; html2canvas đọc computed style ⇒ PDF/PNG giữ màu. Cần một phép kiểm xuất HTML có màu token.
- Lợi kỳ vọng: −90 % chi phí khối code (đo: 1.497 → 118 ms ở doc-2k); một lần render doc-2k trong trình duyệt ~3 s → ~1,4 s **ngay cả trước khi có render theo khối**.

#### B. Đường đi mỗi phím chỉ còn việc rẻ (việc 3)

- `src/hooks/useIdleValue.ts`: `useIdleValue<T>(value, delayMs = 400)` — trả giá trị cũ cho tới khi `value` đứng yên `delayMs` (setTimeout; dọn khi unmount).
- `StatusBar.tsx`: `const settled = useIdleValue(content, 400); const stats = useMemo(() => getDocumentStats(settled), [settled])`.
- `lib/markdown.ts`: viết lại `getDocumentStats` **một lượt** (đếm dòng/ký tự/không-khoảng-trắng/từ/đoạn bằng vòng `charCodeAt`; tiêu đề + khối code bằng một lần `scanLines`) — giữ nguyên kiểu trả về và kết quả (test so với bản cũ trên 3 tài liệu sinh + các ca hiện có trong `lib/__tests__/markdown.test.ts`). Mục tiêu 30k: 129 → ≤ 25 ms (và không còn chạy mỗi phím).
  `lineAtOffset`: đếm `\n` bằng vòng `indexOf` thay vòng từng ký tự.
- `Outline.tsx`, `ReadingView.tsx:89,92`: dùng `useIdleValue(content, 300)` trước `extractHeadings/getDocumentStats`.
- `CommandPalette.tsx:43-112`: `useMemo` trả `[]` khi `!open` và thêm `open` vào phụ thuộc; khi mở dùng `content` hiện tại.
- `FindReplace.tsx:23`: `useIdleValue(value, 150)` cho `findMatches`.
- `store.ts` `schedulePersist`: chỉ `set({saveState:'saving'})` khi trạng thái khác `'saving'`.
- Giảm render lại theo `files`: `Header` chọn `fileName`/`breadcrumb` bằng selector trả chuỗi/mảng tên với `useShallow` (`zustand/react/shallow`, có sẵn ở zustand 4.5.7 đang cài); `StatusBar` chọn `fileName` (chuỗi); `Sidebar`/`FileTree`/`CommandPalette` dùng selector `treeShape(files)` (cache theo WeakMap của từng nút, bỏ qua `content`) để không đổi tham chiếu khi chỉ nội dung đổi.
- Lợi kỳ vọng: doc-30k chỉ editor p50 288 → ~130 ms (còn textarea 112 + gutter, gutter xử lý ở C); doc-10k 104 → ~65 ms.

#### C. Editor: gutter ảo + đo dòng tăng dần (việc 6) — *làm sau quyết định CodeMirror (§8)*

- `src/lib/lineMetrics.ts` (thuần):
  ```ts
  export interface LineChange { from: number; oldCount: number; newCount: number }   // chỉ số dòng 0-based
  export function changedLines(prev: string, next: string): LineChange               // tiền tố/hậu tố chung, đếm '\n' bằng indexOf — không split cả tài liệu
  export class LineMetrics {
    constructor(lineHeight: number)
    reset(heights: number[]): void
    splice(change: LineChange, newHeights: number[]): void
    topOf(line: number): number            // 1-based; mảng tổng tiền tố tính lười khi bẩn (O(n) số học, ~0,1 ms ở 30k)
    lineAt(y: number): number              // tìm nhị phân
    get total(): number
  }
  export function estimateRows(text: string, cols: number): number   // ước lượng khi chưa đo (font mono)
  ```
- `EditorPane.tsx`: bỏ gương toàn văn và `MAX_MEASURED_LINES`. Một `<div class="editor-measure">` ẩn cùng font/bề rộng: chỉ đo **các dòng vừa đổi** (thường 1–3) bằng `offsetHeight`; `wrap=off` thì mọi dòng = `lineHeight` (không đo). Đổi bề rộng (ResizeObserver) ⇒ đặt lại bằng ước lượng rồi đo lại theo lát 1.000 dòng/khung (`requestIdleCallback` → fallback `setTimeout`).
  Gutter chỉ vẽ dòng trong `[lineAt(scrollTop) − 20, lineAt(scrollTop + clientHeight) + 20]`, `position:absolute; top: topOf(n)`; trạng thái cuộn cập nhật theo rAF. Đồng bộ cuộn dùng `metrics.topOf/lineAt` thay mảng `anchors` 6.000 phần tử. `syncCaret` không còn kéo theo vẽ lại 30k phần tử.
- Lợi kỳ vọng: mở doc-30k chỉ editor 5,8 → ≤ 1 s; mỗi phím −15 ms (10k) / phần gutter (30k); đồng bộ cuộn chính xác cả trên 6.000 dòng.

#### D. Hoàn tác bằng bản vá (việc 7) — *làm sau quyết định CodeMirror*

- `src/lib/history.ts` (thuần): `diffPatch(a, b): Patch` với `Patch = {at, removed, inserted}` (tiền tố/hậu tố chung, so theo lát 1.024 ký tự bằng `===` rồi tinh từng ký tự); `applyPatch`, `invertPatch`; `HistoryStack {undo: Patch[], redo: Patch[], bytes}` với trần `HISTORY_LIMIT = 200` **và** trần byte `HISTORY_BYTES = 8 MB` (bỏ bước cũ nhất khi vượt).
- `store.ts`: thay `history: string[]`/`historyIndex` bằng `historyBase` (nội dung lúc commit cuối) + `undoStack`/`redoStack`; `commitHistory` đẩy `diffPatch(historyBase, currentContent)`; `undo/redo` áp bản vá (vẫn qua `setNodeContent` + `schedulePersist` như cũ — hoàn tác vẫn là một sửa đổi mới, đúng quy tắc đồng bộ của dự án). Selector cho Header: `canUndo`/`canRedo` dạng số (`undoDepth`, `redoDepth`).
- Sửa các test đặt `history: [DOC], historyIndex: 0` (`__tests__/readingMode.test.tsx:51-52`, …) sang helper `resetHistory(DOC)`.
- Lợi: 2,7 MB/bước → vài byte–KB/bước; 540 MB → ≤ 8 MB trần.

#### E. Render tăng dần theo khối (việc 8–11) — trọng tâm

**E1. Tách khối — `src/lib/blocks.ts` (thuần, bản mẫu `<S>/split.mjs` đã chạy)**
```ts
export interface MdBlock { start: number; end: number; text: string; key: string }   // start/end: dòng 1-based
export interface SplitResult { blocks: MdBlock[]; defs: string[]; hasFootnotes: boolean; lineCount: number }
export function splitBlocks(src: string): SplitResult
```
Quy tắc cắt (chỉ cắt **trước** một dòng có chữ đứng sau dòng trống, khi mọi trạng thái sau đều "đóng"):
1. Trong rào code ```` ``` ````/`~~~` (≤ 3 dấu cách thụt, cùng ký tự, đóng bằng độ dài ≥ mở; rào backtick có info chứa backtick thì không phải rào) → không cắt.
2. Trong khối toán `$$` (mở: `^ {0,3}\${2,}[^$]*$`; đóng: `^ {0,3}\${2,}\s*$` dài ≥ mở) → không cắt. (`$$x$$` một dòng không mở khối — khớp micromark-extension-math.)
3. Khối HTML loại 1–5 (`<script|pre|style|textarea`, `<!--`, `<?`, `<!X`, `<![CDATA[`) tới khi gặp điều kiện kết thúc → không cắt.
4. Độ sâu thẻ chứa (`details|div|section|table|figure|blockquote|ul|ol|dl|center|article|aside|nav|header|footer|main|picture|video|audio`) mở − đóng > 0 → không cắt (giữ `<details>` có markdown bên trong).
5. Dòng kế thụt ≥ 2 dấu cách / tab (tiếp nối mục danh sách, code thụt lề) → không cắt.
6. Dòng kế là mục danh sách và dòng có chữ trước đó là mục danh sách / dòng thụt → không cắt (giữ danh sách lỏng là một danh sách).
7. Dòng định nghĩa `^ {0,3}\[\^?label\]:` → ghi vào `defs`; `hasFootnotes` nếu có `[^…]:`.

Khoá ổn định: `key = \`${idOf(text)}-${lần xuất hiện}\`` với `idOf` là `Map<string, number>` cấp số tăng dần (gom rác theo "thế hệ": xoá các chuỗi không còn trong 3 lần tách gần nhất khi Map > 2 × số khối). Cùng nội dung ⇒ cùng khoá ⇒ React giữ nguyên instance dù khối dời vị trí.
Chi phí đo: 4,5 / 10,4 / 22,9 ms cho 2k / 10k / 30k. (Tối ưu tuỳ chọn ở việc 16: tách lại từ khối chứa chỗ sửa.)

**E2. `rehypeEnhance` chế độ khối (việc 9)** — `lib/rehypeEnhance.ts`:
- Thêm tuỳ chọn `blockMode?: boolean`. Khi bật: `data-line` giữ số dòng **tương đối trong khối** (đúng như hiện nay vì mỗi khối parse riêng); tiêu đề **không** gắn `id`, thay bằng `data-slug="<slug gốc>"`; neo `heading-anchor` không có `href`.
- `sanitizeSchema`: thêm `'data-slug'` vào `'*'` (cạnh `'data-line'`, `rehypeEnhance.ts:144`).
- `src/lib/headingIds.ts`: `dedupeSlugs(slugs: string[]): string[]` (thuần, cùng quy tắc `-n` với `extractHeadings` ở `lib/markdown.ts:86-95`) + `assignHeadingIds(root: HTMLElement, prefix: string)`: duyệt `h1..h6[data-slug]` theo thứ tự DOM, đặt `id` và `href` của neo; bỏ qua nếu danh sách slug không đổi so với lần trước (so chuỗi nối). React không quản lý `id/href` này (không bao giờ là prop) nên không bị ghi đè. Outline (`document.getElementById(slug)`) và chế độ đọc (`READING_ID_PREFIX + slug`) giữ nguyên hành vi.

**E3. `BlockedMarkdownView` (việc 10)** — `src/components/BlockedMarkdownView.tsx`:
```tsx
interface Props { source: string; theme: 'light'|'dark'; codeBackground?: string; idPrefix?: string; progressive?: boolean }
// nội bộ:
const MarkdownBlock = memo(function MarkdownBlock({ text, defs, ... }) {
  return <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={blockPlugins(idPrefix)} components={components} urlTransform={markdownUrlTransform}>
           {defs ? text + '\n\n' + defs : text}</ReactMarkdown>
}, (a, b) => a.text === b.text && a.defs === b.defs && a.theme === b.theme && a.codeBackground === b.codeBackground)
// render:
<>{split.blocks.map(b => <div className="md-block" data-block-line={b.start} key={b.key}><MarkdownBlock text={b.text} defs={needsDefs(b) ? defsText : ''} … /></div>)}</>
```
- `MarkdownView.tsx` tách phần dùng chung (`REMARK_PLUGINS`, `rehypePlugins(idPrefix, blockMode)`, `useMarkdownComponents(theme, codeBackground)`) để hai view dùng **cùng** plugin/components; `MarkdownView` (cả tài liệu) vẫn dùng cho Smart format (`SmartFormatModal.tsx:369`, văn bản ngắn).
- `defs` (link tham chiếu): chỉ nối vào khối có ký tự `[`; `defsText` thay đổi ⇒ chỉ các khối đó render lại.
- **Footnote** (`hasFootnotes`): v1 dùng đường cũ `MarkdownView` cho cả tài liệu (đúng 100 %, chậm như hiện nay chỉ với tài liệu có footnote) — xem F.
- `useLayoutEffect` sau mỗi commit: `assignHeadingIds(article, idPrefix)`.
- `Preview.tsx`:
  - thay `<MarkdownView source={debounced}>` bằng `<BlockedMarkdownView source={debounced} progressive>`; debounce giữ 120 ms (giờ mỗi lần chỉ render khối đổi).
  - `onDoubleClick` (`:85-90`): `line = Number(wrap.dataset.blockLine) + Number(block.dataset.line) − 1` với `wrap = target.closest('[data-block-line]')`.
  - tick checkbox (`:93-106`) giữ nguyên (dựa thứ tự checkbox trong DOM).
- `lib/paneSync.ts`: `collectBlockAnchors(container)` đọc `.md-block[data-block-line]` (wrapper không bị `content-visibility` bỏ qua nên `getBoundingClientRect` rẻ) + neo cuối = `lineCount`; `offsetForLine/lineForOffset` đổi sang **tìm nhị phân**. Gộp `refreshAnchors` bằng rAF (một lần mỗi khung dù nhiều ảnh tải xong).
- CSS (`index.css`/`Preview.css`): `.md-block` là `display:block` trơn, không padding/border ⇒ margin con vẫn gộp như hiện nay (khoảng cách giữ nguyên).
- Lợi kỳ vọng: gõ ở doc-10k từ p95 10,2 s → ≤ 100 ms (tách 10 ms + React so 1.700 phần tử memo ~ vài ms + render 1 khối ~5 ms, sau debounce); doc-30k preview cập nhật ≤ 300 ms.

**E4. Dựng dần + `content-visibility` + bảo vệ xuất (việc 11)**
- `src/lib/progressive.ts` (thuần): `nextBatch(order: number[], done: Set<string>, budgetMs, avgMsPerBlock)` chọn lô kế tiếp; `orderFrom(index, n)` thứ tự ưu tiên: khối quanh vị trí đang xem trước (dòng đồng bộ cuộn / con trỏ), rồi xuống dưới, rồi lên trên.
- `BlockedMarkdownView` (`progressive`): lần đầu chỉ render các khối trong khoảng nhìn thấy (+ đệm); khối chưa dựng là `<div class="md-block is-pending" data-block-line style={{height: est}}>` (`est = số dòng × 1,6em`); mỗi lát (rIC, fallback `setTimeout(16)`) dựng thêm một lô với ngân sách ~12 ms, tự điều chỉnh kích thước lô theo thời gian lô trước. Khối **mới** (vừa sửa) luôn dựng ngay. Đếm tiến độ qua `onProgress` (hiện chấm nhỏ "Đang dựng 40 %" ở thanh preview).
- CSS: `.md-block > :not(h1,h2,h3,h4,h5,h6) { content-visibility: auto; contain-intrinsic-size: auto 3em; }` — **không** áp cho tiêu đề vì `.heading-anchor` dùng `margin-left:-1em` (`index.css:420-424`) sẽ bị cắt bởi paint containment; áp lên phần tử con (không lên wrapper) để margin giữa các khối vẫn gộp.
- `src/lib/previewController.ts`: sổ đăng ký giống `editorSelection` — `renderAll(): Promise<void>` (ép dựng hết, chờ commit) và cờ `exporting`. `Header.tsx:149-164` `withPreview` gọi `await renderAll()` + thêm lớp `.is-exporting` (tắt `content-visibility`) trước khi đọc `.markdown-body`, gỡ sau khi xong. In (`window.print`) cũng đi qua `renderAll` (lệnh "Print" trong bảng lệnh).
- Lợi kỳ vọng: mở doc-10k: khung đầu có preview ≤ 2 s, phần còn lại dựng trong nền không long task > 300 ms; cuộn preview p50 50 → 16,7 ms (đã đo bằng CSS chèn).

**E5. Chế độ đọc (việc 4 + 13)**
- Việc 4 (độc lập, làm sớm): `ReadingView.tsx` dựng `headingEls: HTMLElement[]` **một lần** sau mỗi commit (một `querySelectorAll('h1,…,h6')`), `tops` tính lại chỉ khi ResizeObserver/ảnh/bài đổi (gộp rAF); `onScroll` chỉ tính `progress` + tìm nhị phân `activeHeadingIndex` trên `tops` (không chạm DOM); `elementById` dùng `article.querySelector('#' + CSS.escape(id))`. Lợi: p95 1,85 s → ≤ 33 ms.
- Việc 13: `ReadingView` dùng `BlockedMarkdownView` (cùng dựng dần + `content-visibility`) với `idPrefix = READING_ID_PREFIX`; mở chế độ đọc doc-10k từ 51 s → khung đầu ≤ 2 s.

#### F. Footnote trong chế độ khối (việc 15, tuỳ chọn)
`splitBlocks` thu nhãn footnote theo thứ tự **tham chiếu đầu tiên** (như GFM). Khối có `[^x]` được nối định nghĩa liên quan rồi qua plugin `rehypeFootnoteBlocks({numbers})`: bỏ `section[data-footnotes]` cục bộ, đổi số hiển thị/`id`/`href` của `a[data-footnote-ref]` theo số toàn cục. Khối định nghĩa render rỗng; thêm một khối tổng hợp cuối `FootnotesSection` = render "[^a] [^b] …\n\n" + mọi định nghĩa rồi chỉ giữ `section`. Test so khác biệt với render cả tài liệu phải bằng nhau. Cho tới khi làm việc này: tài liệu có footnote đi đường cũ (E3).

#### G. Mermaid (việc 12)
`MermaidDiagram.tsx`: cache mô-đun `Map<theme + '\0' + source, {svg} | {error}>` (LRU 100) — state khởi tạo đọc cache (mount lại không nháy "Rendering diagram…", không render lại); hàng đợi tuần tự cho `mermaid.render`; IntersectionObserver (`rootMargin: '1000px'`) chỉ render khi gần màn hình (khi `exporting`/`renderAll` thì render ngay); khung chờ có `min-height` để không giật bố cục.

#### H. Worker (việc 18, tuỳ chọn, chỉ khi cần mở 30k nhanh hơn)
Sau E, gõ phím đã rẻ; worker chỉ giảm CPU luồng chính khi **mở** (parse + KaTeX ≈ 60 % pipeline). `src/workers/mdWorker.ts` chạy `unified` (remark-parse, gfm, math, remark-rehype, rehype-raw, rehypeEnhance, sanitize, katex) → trả hast theo lô khối; luồng chính `toJsxRuntime`. Vite hỗ trợ sẵn `new Worker(new URL(...), {type:'module'})` (không thêm dependency); `make-sw.mjs` phải precache chunk worker; jsdom không có Worker ⇒ đường dự phòng chạy luồng chính.

#### I. Lựa chọn CodeMirror 6 (việc 17, cần quyết)
Xem §8. Nếu chọn: C và D bị thay (CM6 có gutter ảo, wrap, lịch sử theo thay đổi, `lineBlockAt` cho đồng bộ cuộn, tìm/thay); `editorCommands.ts` (hàm thuần trên `{value,start,end}`) giữ được qua một bộ chuyển đổi tạo `ChangeSpec` tối thiểu. Phần preview (A, B, E–G) không phụ thuộc lựa chọn này.

### 5.2 Personal Wiki (`backend/fastapi/webapp/tranphuc8a/personal-wiki`, viết tay — giữ thói quen tệp: JS ES5, tên tiếng Anh/Việt như tệp đang sửa)

#### W1. `setStatus` rẻ mỗi phím (việc W1)
`ui/editor.js`: tách `setStatus()` thành `setDirtyState()` (chỉ `isDirty()` + nhãn "Chưa lưu" + `saveBtn.disabled`, chạy mỗi phím) và `updateCounts()` (đếm từ + thẻ ôn) chạy qua `U.debounce(…, 300)` và ngay sau `fill()`/`save()`. `words()` đổi sang vòng đếm không tạo mảng (giữ cùng định nghĩa `[\p{L}\p{N}]+`: dùng `regex.exec` vòng lặp đếm). Lợi: −44 ms/phím ở 407k ký tự.

#### W2. Trình dựng theo khối — `core/markdown.js` (việc W2)
- Thêm `M.blocks(md) → [{start, text}]` theo cùng quy tắc tách §E1 (rút gọn: wiki **không** hiểu HTML thô và không có `$$` ⇒ chỉ cần rào code, tiếp nối danh sách, dòng thụt; giữ thêm quy tắc HTML/`$$` cũng vô hại vì gộp không bao giờ làm sai). Bản mẫu chứng minh `blocks.map(render).join('') === render(md)` (bỏ `id` tiêu đề) trên doc-2k, wiki-12k và 7 ca khó [đo `blocks-wiki.mjs`].
- `M.dedupeIds(ids) → ids` (thuần) cho hậu kỳ id tiêu đề (`h-slug`, `h-slug-2`, … — giống `renderBlocks` `state.ids` ở `core/markdown.js:143`).
- Chạy cả trong node (`kiem.js`).

#### W3. Vá DOM preview theo khối (việc W3)
`ui/editor.js` `renderPreview()` (`:160-165`):
```js
var pv = { keys: [], els: [], cache: new Map(), ver: -1 };   // cache: text → html; xoá khi repo.version() đổi (liên kết [[…]] phụ thuộc kho)
function renderPreview() {
  if (repo.version() !== pv.ver) { pv.cache.clear(); pv.ver = repo.version(); }
  var bl = M.blocks(st.cur.content), keys = keysOf(bl);          // khoá = id(text) + lần xuất hiện, như §E1
  // tiền tố/hậu tố chung giữa pv.keys và keys → chỉ thay đoạn giữa
  … tạo phần tử mới bằng <template>.innerHTML = cache-or-render(text) bọc <div class="mdb">; replaceWith/insertBefore; giữ scrollTop
  fixHeadingIds(prev);                                            // M.dedupeIds trên h1..h6 theo thứ tự
}
```
Lần đầu (mở note) vẫn dựng hết một lượt (150 ms + DOM 60k nút — đo mở 1,3 s chấp nhận được). CSS `app.css`: `.ed-prev .mdb > :not(h1,h2,h3,h4,h5,h6){content-visibility:auto;contain-intrinsic-size:auto 3em}`.
Lợi: mỗi lần cập nhật preview 550–650 ms → ~16 ms JS + vá 1 khối; gõ chia đôi p95 656 → ≤ 80 ms.
Sau khi sửa: chạy `tao-pwa.py` (đóng dấu `sw.js`), và vì `core/markdown.js` dùng chung: `algorithm-notebook/sync.py` + `algorithm-notebook/tao-pwa.py` + `node algorithm-notebook/kiem.js`.

#### W4. Test hồi quy hiệu năng wiki (việc W4)
- `kiem.js`: (a) so khác biệt `M.blocks` + render từng khối == `M.render` (bỏ id) trên các ca + một note sinh 400k ký tự (sinh tất định trong test); (b) thời gian: `M.blocks(400k) ≤ 25 ms × PW_PERF_SLACK`, "gõ 1 phím" (tách + render 1 khối) ≤ 30 ms × slack.
- `check.py --hieu-nang`: thêm kịch bản "ghi chú dài" (note 400k ký tự nạp qua `Wiki.repo.save`, chia đôi, gõ 21 phím cách 150 ms): p95 ≤ 120 ms × slack, long task mỗi lần cập nhật preview ≤ 100 ms × slack; in bảng số.

### 5.3 Algorithm Notebook
Không sửa giao diện. Nhận `core/markdown.js` mới qua `sync.py` (việc N1); kiểm `kiem.js`, `kiem-lib.js`, `check.py --tinh`.

---

## 6. Danh sách việc (theo thứ tự phụ thuộc; mỗi việc một lượt agent)

| # | Việc | Tệp | Kiểm | Cỡ |
| --- | --- | --- | --- | --- |
| 1 | **Khung đo hiệu năng MD Editor** (chỉ đo, in bảng + JSON; `--nguong` mới so ngưỡng): sinh tài liệu tất định (port `mkdoc.mjs` sang Python trong script), phục vụ `dist/` bằng `http.server` cổng trống, giả `/markdown/admin/session` + `/markdown/backends`, nạp `localStorage`, đo mở/gõ (Event Timing)/long task/preview cập nhật/cuộn/chế độ đọc/bộ nhớ renderer. Ghi số mốc "trước" vào tài liệu bàn giao. | `markdown-editor/scripts/kiem-hieu-nang.py` (mới) | chạy `--bao-cao` trên doc-2k/10k: số khớp §2.1 ±30 % | M |
| 2 | **CodeBlock dùng class** + `memo` + CSS sinh từ theme (cả bản tương phản của chế độ đọc) | `src/components/CodeBlock.tsx`, `src/lib/prismCss.ts` (mới), `src/lib/__tests__/prismCss.test.ts` (mới), `src/__tests__/components.test.tsx` | vitest: CSS có `.token.keyword` cho sáng/tối/tương phản; khối code ra `span.token` không có `style=color`; test hiệu năng: 52 khối doc-2k ≤ 250 ms × slack; xuất HTML giữ màu; `npm run type-check && lint && test` | S |
| 3 | **Bỏ việc O(n) khỏi mỗi phím**: `useIdleValue`; `getDocumentStats` một lượt (kết quả y hệt bản cũ); `lineAtOffset` nhanh; StatusBar/Outline/ReadingView/FindReplace dùng giá trị đứng yên; CommandPalette chỉ tính khi mở; `saveState` chỉ đổi khi khác; selector hẹp (`useShallow`, `treeShape`) cho Header/StatusBar/Sidebar/FileTree/CommandPalette | `src/hooks/useIdleValue.ts` (mới), `src/lib/markdown.ts`, `src/components/{StatusBar,Outline,ReadingView,FindReplace,CommandPalette,Header,Sidebar,FileTree}.tsx`, `src/store.ts`, `src/lib/tree.ts` (`treeShape`) | `markdown.test.ts`: stats mới == stats cũ trên doc sinh 2k + ca có sẵn; test hiệu năng `getDocumentStats(30k) ≤ 40 ms × slack`; components test: bảng lệnh mở vẫn có nhóm "Headings"; status bar cập nhật sau 400 ms (fake timers); khung đo việc 1: chỉ editor doc-10k p50 ≤ 80 ms | M |
| 4 | **Chế độ đọc: bỏ truy vấn DOM bậc hai** khi cuộn (cache phần tử tiêu đề + `tops`, tìm nhị phân, `CSS.escape`) | `src/components/ReadingView.tsx`, `src/lib/reading.ts` (+ `activeHeadingIndex` nhị phân nếu cần) | `readingMode.test.tsx`, `reading.test.ts`; khung đo: cuộn đọc doc-2k p95 ≤ 33 ms, doc-10k ≤ 50 ms | S |
| 5 | **Neo đồng bộ cuộn**: gộp `refreshAnchors` theo rAF; `offsetForLine/lineForOffset` tìm nhị phân | `src/lib/paneSync.ts`, `src/components/Preview.tsx`, `src/lib/__tests__/paneSync.test.ts` | test cũ + test nhị phân == tuyến tính trên 10.000 neo ngẫu nhiên | S |
| 6 | **`splitBlocks` + test khác biệt** (port `<S>/split.mjs`): khối, `defs`, `hasFootnotes`, khoá ổn định, gom rác Map | `src/lib/blocks.ts` (mới), `src/lib/__tests__/blocks.test.ts` (mới), `src/test/longDoc.ts` (mới: sinh tài liệu tất định) | 20 ca §2.6 + doc sinh 2k: render từng khối (react-dom/server) == render cả tài liệu (chuẩn hoá id/khoảng trắng), `data-line` tuyệt đối khớp; khoá giữ nguyên khi chèn khối phía trên; `splitBlocks(30k) ≤ 60 ms × slack` | M |
| 7 | **`rehypeEnhance` chế độ khối + `headingIds`** (`data-slug`, không id/href; schema cho `data-slug`; `dedupeSlugs`, `assignHeadingIds`) | `src/lib/rehypeEnhance.ts`, `src/lib/headingIds.ts` (mới), `src/lib/__tests__/{rehypeEnhance,headingIds}.test.ts` (mới) | slug + hậu tố `-n` khớp `extractHeadings` trên doc sinh; id/href đặt đúng trong jsdom | S |
| 8 | **`BlockedMarkdownView` + gắn vào Preview** (memo theo khối, wrapper `data-block-line`, `defs`, footnote → đường cũ, hậu kỳ id, nhấp đúp tính dòng tuyệt đối, neo theo khối) | `src/components/BlockedMarkdownView.tsx` (mới), `src/components/MarkdownView.tsx` (tách phần dùng chung), `src/components/Preview.tsx`, `src/lib/paneSync.ts` (`collectBlockAnchors`), `src/index.css` | components test: sửa 1 đoạn ⇒ chỉ 1 `MarkdownBlock` render lại (đếm qua prop test `onBlockRender`); Outline bấm → cuộn tới đúng `id`; nhấp đúp → dòng đúng; tick checkbox vẫn sửa nguồn; tài liệu có footnote ra giống cũ; khung đo: doc-10k gõ chia đôi p95 ≤ 150 ms | M |
| 9 | **Dựng dần + `content-visibility` + bảo vệ xuất/in** | `src/lib/progressive.ts` (mới) + test, `src/lib/previewController.ts` (mới), `BlockedMarkdownView.tsx`, `src/components/Header.tsx` (`withPreview`), `CommandPalette.tsx` (in), `src/index.css` | fake timers: dựng hết sau N lát, khối quanh vị trí xem dựng trước, khối mới dựng ngay; xuất HTML doc sinh 2k chứa đủ mọi khối; khung đo: mở doc-10k khung đầu ≤ 2,5 s, không long task > 300 ms sau đó, cuộn preview khung > 50 ms ≤ 10 % | M |
| 10 | **Mermaid**: cache SVG, hàng đợi tuần tự, IntersectionObserver, `min-height` | `src/components/MermaidDiagram.tsx`, test mới (mock `mermaid`) | mount lại cùng nguồn không gọi `render` lần 2; sơ đồ ngoài màn hình không render cho tới khi giao cắt (mock IO); `renderAll` ép render | S |
| 11 | **Chế độ đọc dùng `BlockedMarkdownView`** | `src/components/ReadingView.tsx` | `readingMode.test.tsx`; khung đo: mở đọc doc-10k khung đầu ≤ 2,5 s | S |
| 12 | **Quyết định CodeMirror 6** (§8) — không mã; nếu "không": làm 13–14; nếu "có": làm 17 thay 13–14 | – | – | – |
| 13 | **Editor: gutter ảo + `LineMetrics`** (bỏ gương toàn văn, bỏ `MAX_MEASURED_LINES`) | `src/lib/lineMetrics.ts` (mới) + test, `src/components/EditorPane.tsx`, `EditorPane.css` | unit: `changedLines`, `splice/topOf/lineAt` (30k dòng, splice+tops ≤ 5 ms × slack); components: gutter chỉ có ~(dòng thấy + 40) phần tử, số đúng sau cuộn (measurer giả trong jsdom); khung đo: mở doc-30k chỉ editor ≤ 1,5 s | M |
| 14 | **Hoàn tác bằng bản vá + trần byte** | `src/lib/history.ts` (mới) + test, `src/store.ts`, `src/components/Header.tsx`, các test đặt `history:` (`__tests__/readingMode.test.tsx`, …) | `store.test.ts` hành vi undo/redo cũ giữ nguyên; diff 1,4M ký tự ≤ 15 ms × slack; 200 bước trên doc 30k giữ ≤ 8 MB; khung đo: 10 bước doc-10k bộ nhớ riêng tăng ≤ 5 MB | M |
| 15 | (tuỳ chọn) Footnote đánh số toàn cục trong chế độ khối (§5.1.F) | `src/lib/blocks.ts`, `src/lib/rehypeFootnoteBlocks.ts` (mới), `BlockedMarkdownView.tsx` + test | test khác biệt ca footnote == render cả tài liệu | M |
| 16 | (tuỳ chọn) `splitBlocks` tăng dần (tách lại từ khối chứa chỗ sửa tới khi khớp lại) | `src/lib/blocks.ts` + test | kết quả == tách lại toàn bộ trên 1.000 lần sửa ngẫu nhiên; 30k: ≤ 3 ms/phím | M |
| 17 | (nếu chủ dự án đồng ý) Trình soạn CodeMirror 6 thay `<textarea>` | `package.json`, `src/components/EditorPane.tsx`, `src/lib/cmAdapter.ts` (mới), test | toàn bộ test editor; khung đo: doc-30k gõ p95 ≤ 50 ms | L |
| 18 | (tuỳ chọn) Worker parse | `src/workers/mdWorker.ts`, `BlockedMarkdownView.tsx`, `scripts/make-sw.mjs` (kiểm precache) | đường dự phòng jsdom; `kiem-pwa.py` offline vẫn đạt | M |
| 19 | **Xuất bản + kiểm tổng MD Editor**: `node scripts/build-webapps.mjs --only markdown-editor` + `--check`, `kiem-pwa.py`, `kiem-hieu-nang.py --nguong`, `scripts/audit-webapps.mjs`; bàn giao `tasks/2610/<ngày>/perf-md/ban-giao.md` (bảng trước/sau) | – | mọi lệnh xanh | S |
| W1 | Wiki: `setStatus` tách rẻ/đếm trễ | `personal-wiki/assets/js/ui/editor.js` | `check.py --chuc-nang` (trạng thái "Chưa lưu", số từ, số thẻ vẫn đúng sau 300 ms); `tao-pwa.py`; `check.py --tinh` | S |
| W2 | Wiki: `M.blocks` + `M.dedupeIds` + test khác biệt/hiệu năng | `personal-wiki/assets/js/core/markdown.js`, `personal-wiki/kiem.js` | `node …/personal-wiki/kiem.js` (ca + note sinh 400k; ngưỡng × `PW_PERF_SLACK`) | S |
| W3 | Wiki: vá DOM preview theo khối + CSS `content-visibility` | `personal-wiki/assets/js/ui/editor.js`, `personal-wiki/assets/css/app.css` | `check.py --chuc-nang --song-sot --co-gian` (XSS vẫn không chạy, mục lục bên cạnh cuộn tới đúng id, liên kết ma vẫn bấm được); `tao-pwa.py` | M |
| W4 | Wiki: kịch bản "ghi chú dài" trong `check.py --hieu-nang` | `personal-wiki/check.py` | chạy `--hieu-nang`: p95 gõ ≤ 120 ms × slack | S |
| N1 | Notebook nhận `markdown.js` mới | chạy `algorithm-notebook/sync.py`, `tao-pwa.py` | `sync.py --kiem`, `node …/algorithm-notebook/kiem.js`, `kiem-lib.js`, `check.py --tinh` | S |

Thứ tự gợi ý: 1 → 2 → 3 → 4 → 5 (thắng nhanh, độc lập) → 6 → 7 → 8 → 9 → 10 → 11 → 12 → (13, 14 | 17) → 19. Wiki W1 → W2 → W3 → W4 → N1 làm song song được với nhánh MD Editor.

---

## 7. Biến phép đo thành test hồi quy

1. **vitest (node/jsdom), chạy trong `npm test`** — ngưỡng thời gian chỉ trên hàm thuần, đo trung vị 3 lần sau một lần làm nóng, nhân `Number(process.env.MD_PERF_SLACK) || 1`:
   `splitBlocks(30k) ≤ 60 ms`, `getDocumentStats(30k) ≤ 40 ms`, `LineMetrics` splice+tops 30k ≤ 5 ms, `diffPatch` 1,4M ký tự ≤ 15 ms, tô màu 52 khối doc-2k (class) ≤ 250 ms; cộng **test bất biến không phụ thuộc máy**: số `MarkdownBlock` render lại khi sửa 1 đoạn = 1; gutter chỉ dựng ≤ 100 phần tử; bộ nhớ lịch sử ≤ 8 MB (tính bằng tổng độ dài bản vá).
   Tài liệu dài sinh tất định trong `src/test/longDoc.ts` (không commit tệp 1,5 MB).
2. **Trình duyệt thật** `markdown-editor/scripts/kiem-hieu-nang.py [--nguong] [--nang] [--chi doc-2k,doc-10k]` (Edge `channel="msedge"`, như `kiem-pwa.py`): ngưỡng §4 nhân `MD_PERF_SLACK`; `--nang` thêm doc-30k. In bảng, ghi `scripts/__perf__/ket-qua-<ngày>.json` vào thư mục tạm (không commit). Không gọi Gemini, không cần backend thật.
3. **Wiki**: `kiem.js` (thuần, `PW_PERF_SLACK`) + `check.py --hieu-nang` kịch bản ghi chú dài.
4. Chỉ số dùng: Event Timing (độ trễ tới khung hình kế, gộp theo `interactionId`), long task, khung rAF > 50 ms, `SystemInfo.getProcessInfo` + bộ nhớ riêng tiến trình (heap JS **không** thấy chuỗi của textarea).

---

## 8. Phụ thuộc mới

**Không bắt buộc thêm phụ thuộc nào** cho việc 1–16, 18–19, W1–W4, N1 (refractor/react-syntax-highlighter, zustand `useShallow`, Worker của Vite đều đã có).

Tuỳ chọn duy nhất cần chủ dự án quyết — **CodeMirror 6** cho Markdown Editor Pro (việc 17):
- Lý do: `<textarea>` có trần 48 ms (10k) / 112 ms (30k) mỗi phím trên máy này, không bỏ được bằng tối ưu mã app; điện thoại còn chậm hơn nhiều lần [suy đoán].
- Kích thước: `@codemirror/view` (kèm `@codemirror/state`, style-mod, w3c-keyname, crelt, find-cluster-break) **242 KB min / 77 KB gzip** [bundlephobia]; thêm `@codemirror/commands`, `@codemirror/language`, `@codemirror/lang-markdown` (+ `@lezer/markdown`, `@lezer/common`, `@lezer/highlight`), `@codemirror/search` ⇒ tổng ước lượng **~400–450 KB min / ~130–150 KB gzip** [suy đoán, đo lại khi duyệt]. Chunk vào bản build → `make-sw.mjs` precache thêm.
- Phương án không phụ thuộc: việc 13 + 14 (gutter ảo, đo dòng tăng dần, hoàn tác bản vá) — đạt ≈ trần textarea (doc-10k ~55 ms, doc-30k ~120 ms mỗi phím).
- Personal Wiki/Notebook: **không** đề xuất (app viết tay không nạp thư viện; note ≤ 500k ký tự ⇒ trần ~50 ms chấp nhận được).

---

## 9. Rủi ro

- **Tách khối sai ngữ nghĩa** ở cấu trúc lạ (HTML thô không cân bằng, danh sách lỏng phức tạp, thẻ tuỳ biến) ⇒ hiển thị khác render cả tài liệu. Giảm: quy tắc bảo thủ (chỉ cắt khi mọi trạng thái đóng), test khác biệt trên kho ca + tài liệu sinh, footnote đi đường cũ; công tắc ẩn `localStorage["markdown-editor:render"]="full"` để quay về đường cũ khi có báo lỗi.
- **`content-visibility`**: cắt nội dung tràn của phần tử được áp (đã loại tiêu đề vì neo `margin-left:-1em`); KaTeX khối hoặc bảng tràn ngang có wrapper cuộn riêng nên ổn — cần kiểm `audit-webapps.mjs` + ảnh chụp; html2canvas/in phải chạy sau `renderAll` + `.is-exporting`.
- **Dựng dần làm nhảy cuộn** khi khối phía trên vị trí xem thay placeholder (Chrome có scroll anchoring; Safari không) ⇒ ưu tiên dựng quanh vị trí xem rồi xuống dưới trước, lên trên sau; placeholder ước lượng theo số dòng.
- **Ctrl+F của trình duyệt** không thấy khối chưa dựng (sẽ thấy sau khi dựng xong trong nền); nội dung `content-visibility:auto` vẫn tìm được.
- **id tiêu đề do hậu kỳ DOM đặt**: nếu sau này ai đó cho React quản lý `id` thì sẽ ghi đè — ghi chú rõ trong mã + test.
- **Selector `useShallow`/`treeShape`** sai có thể làm cây tệp không cập nhật khi đổi tên/di chuyển — test FileTree hiện có phải giữ xanh.
- **Đổi cấu trúc `history`** chạm nhiều test (đặt `history:` trực tiếp) — làm sau quyết định CM6 để khỏi làm hai lần.
- **Số đo phụ thuộc máy**: ngưỡng có hệ số `*_PERF_SLACK`; test bất biến (số khối render lại, số phần tử gutter) không phụ thuộc máy là chốt chính.
- **Quota localStorage** khi có nhiều tệp lớn (~5–10 MB/origin): hiện đo 1,4M ký tự vẫn lưu được; nhiều tệp cỡ này sẽ "Not saved" — ngoài phạm vi, có thể chuyển tệp sang IndexedDB sau (hỏi chủ dự án).
- Wiki: cache HTML theo khối phải xoá khi kho đổi (`repo.version()`) vì `[[liên kết]]` giải theo kho; quên ⇒ liên kết ma/không ma hiển thị sai đến khi sửa khối.

---

## 10. Lệnh kiểm

Hiện trạng (tái lập, từ `<S>`; tạo junction `cmd //c "mklink /J node_modules C:\Users\tranphuc8a\Desktop\gemini_proxy\markdown-editor\node_modules"`, gỡ bằng `cmd //c "rmdir node_modules"`):
```
node mkdoc.mjs && node gen.mjs
node bench-me.mjs ; node bench-rsh.mjs doc-2k doc-10k ; node bench-wiki.js ; node blocks-proto.mjs ; node blocks-wiki.mjs
PYTHONUTF8=1 …/backend/fastapi/.venv/Scripts/python.exe perf_me.py doc-2k
PYTHONUTF8=1 …/python.exe perf_me.py doc-10k --keys-split 4 --history 10
PYTHONUTF8=1 …/python.exe perf_me.py doc-30k --modes split,editor --keys-split 2 --history 10
PYTHONUTF8=1 CV=1 SUFFIX=-cv …/python.exe perf_me.py doc-10k --modes split --keys-split 1
PYTHONUTF8=1 …/python.exe perf_wiki.py wiki-12k ; …/python.exe perf_baseline.py doc-2k doc-10k doc-30k
PYTHONUTF8=1 …/python.exe prof_me.py doc-30k editor
```
Sau khi cài (từ gốc repo):
```
cd markdown-editor && npm run type-check && npm run lint && npm test
MD_PERF_SLACK=1 backend/fastapi/.venv/Scripts/python.exe markdown-editor/scripts/kiem-hieu-nang.py --nguong [--nang]
node scripts/build-webapps.mjs --only markdown-editor && node scripts/build-webapps.mjs --check
backend/fastapi/.venv/Scripts/python.exe markdown-editor/scripts/kiem-pwa.py
node scripts/audit-webapps.mjs
node backend/fastapi/webapp/tranphuc8a/personal-wiki/kiem.js
backend/fastapi/.venv/Scripts/python.exe backend/fastapi/webapp/tranphuc8a/personal-wiki/tao-pwa.py
backend/fastapi/.venv/Scripts/python.exe backend/fastapi/webapp/tranphuc8a/personal-wiki/check.py --tinh --chuc-nang --song-sot --co-gian --hieu-nang
backend/fastapi/.venv/Scripts/python.exe backend/fastapi/webapp/tranphuc8a/algorithm-notebook/sync.py && …/algorithm-notebook/sync.py --kiem
backend/fastapi/.venv/Scripts/python.exe backend/fastapi/webapp/tranphuc8a/algorithm-notebook/tao-pwa.py
node backend/fastapi/webapp/tranphuc8a/algorithm-notebook/kiem.js && node backend/fastapi/webapp/tranphuc8a/algorithm-notebook/kiem-lib.js
backend/fastapi/.venv/Scripts/python.exe backend/fastapi/webapp/tranphuc8a/algorithm-notebook/check.py --tinh
```

---

## 11. Cần chủ dự án quyết

1. **Trình soạn CodeMirror 6 cho Markdown Editor Pro?** (a) Không — giữ `<textarea>`, làm việc 13–14 (trần ~55 ms ở 10k, ~120 ms ở 30k); (b) Có — thêm ~130–150 KB gzip, mượt ở mọi cỡ, thay việc 13–14 bằng việc 17; (c) Để sau khi xong 1–11 rồi đo lại. **Đề xuất: (c)** — phần lớn "lag giật" nằm ở preview và việc mỗi phím, sửa được không cần phụ thuộc.
2. **Footnote trong chế độ khối**: (a) tài liệu có footnote dùng đường render cũ (đúng, chậm như hiện nay); (b) làm việc 15 (đánh số toàn cục); (c) chấp nhận đánh số theo khối. **Đề xuất: (a) trước, (b) nếu chủ dự án hay dùng footnote trong tài liệu dài.**
3. **Có làm Worker parse (việc 18) không?** Chỉ giúp lúc *mở* tài liệu rất dài. **Đề xuất: chưa** — đánh giá lại sau việc 9 bằng `kiem-hieu-nang.py --nang`.
4. **Công tắc quay về render cũ** (`localStorage["markdown-editor:render"]="full"`) có giữ trong bản phát hành không? **Đề xuất: giữ 1–2 đợt rồi bỏ.**
5. Thứ tự ưu tiên giữa MD Editor và Wiki. **Đề xuất:** MD Editor việc 1–5 + Wiki W1 trước (thắng nhanh, mỗi việc S), sau đó khối (6–11) và W2–W4.
