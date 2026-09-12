# Markdown Editor — Compact Handoff

**Ngày:** 2026-09-12
**Workspace:** `C:\Users\tranphuc8a\Desktop\gemini_proxy`
**Project:** `markdown-editor`
**Branch:** `head/260909`
**Tiếp nối:** [compact_260904.md](compact_260904.md)

## Yêu cầu của phiên này

Test dự án và nâng cấp tính năng, feature, giao diện, trải nghiệm người dùng.

## Kết quả kiểm thử

| Loại | Số check | Trạng thái |
| --- | --- | --- |
| Unit/component (Vitest + Testing Library) | 191 | pass |
| Browser smoke (Playwright) | 50 | pass |
| Browser interaction (Playwright) | 21 | pass |
| Backend round-trip (Playwright + stub API) | 13 | pass |
| `npm run type-check` | — | pass |
| `npm run lint` | — | pass (0 warning) |
| `npm run build` | — | pass |

Test infrastructure mới: **Vitest 5 + jsdom + Testing Library**. Config nằm trong
`vite.config.ts` (khối `test`), setup ở `src/test/setup.ts`.

Script Playwright là công cụ kiểm thử tạm trong scratchpad, **không** commit vào repo.
Nếu cần dựng lại: chạy `npm run dev`, mở browser, làm theo checklist trong
[USER_GUIDE.md](../USER_GUIDE.md).

## Bug đã sửa

Những lỗi này tồn tại trong bản Milestone 3 và đã được sửa:

1. **Mermaid render vòng lặp.** `mermaid.run()` + `ResizeObserver`: mỗi lần render làm
   node đổi kích thước → observer bắn lại → render lại vô hạn. Nay dùng `mermaid.render()`
   trả về chuỗi SVG, không cần observer.
2. **History phình vô hạn.** Mỗi keystroke đẩy một entry vào `history` rồi ghi cả mảng
   xuống localStorage mỗi 5s. Nay gộp theo debounce 600 ms, giới hạn 200 entry.
3. **`isAdmin` được lưu xuống localStorage.** `saveToStorage` serialize toàn bộ state,
   `loadFromStorage` spread ngược lại → sửa localStorage là lên admin. Nay `isAdmin` chỉ
   nằm trong bộ nhớ, và settings đọc từ storage bị lọc theo danh sách khoá đã biết.
4. **Phím tắt gắn vào `document`.** Ctrl+Z/Tab bắt ở cấp document nên Tab phá tab-navigation
   toàn app và Ctrl+Z trong ô rename lại undo nội dung editor. Nay gắn vào chính textarea.
5. **ID trùng.** `createFile` dùng `'file-' + Date.now()`; hai file tạo trong cùng
   millisecond có cùng id → mọi thao tác cây tác động lên cả hai. Nay dùng `createId()`.
6. **`copyNode` cho phép copy folder vào chính nó**, tạo nhánh lồng vô hạn.
7. **Scroll sync feedback loop** giữa hai pane (guard `syncingRef` chỉ chặn một chiều).
8. **Syntax highlighter luôn dùng theme tối** kể cả ở light mode; Mermaid không theo theme.
9. **`body.dark-mode`** có CSS nhưng không nơi nào gán class → các rule đó chết.
10. **CSS markdown không có scope**, `h1`, `p`, `table`… là selector toàn cục, rò rỉ vào
    UI chrome. Nay scope hết vào `.markdown-body`.
11. **Export luôn tên `document.md`** thay vì tên file đang mở.
12. **PDF export** vẽ lại toàn bộ canvas mỗi trang với offset âm → file phình theo số
    trang và cắt ngang dòng. Nay cắt canvas thành tile đúng khổ trang.
13. **Không có fallback clipboard** khi chạy ngoài secure context.
14. **`tsc -b` emit `vite.config.js` cạnh `vite.config.ts`**, mà Vite ưu tiên `.js` —
    nên `npm run dev` chạy config cũ. Nay emit vào `node_modules/.tmp`, file sinh ra đã
    untrack và thêm vào `.gitignore`.
15. **Script `lint` hỏng** (`--ext` không còn với flat config, và parser mặc định không
    đọc được TypeScript). Nay dùng `typescript-eslint`.
16. **Thiếu `aria-label`** trên vài nút chỉ có icon.
17. **Thiếu `katex.min.css`** sau khi viết lại Preview (phát hiện và sửa ngay trong phiên).
18. **`rehype-sanitize` xoá class `heading-anchor`** và đổi id thành `user-content-*`,
    làm hỏng anchor link trong tài liệu và tra cứu của Outline.

## Tính năng mới

### Soạn thảo
- Thanh công cụ định dạng đầy đủ + phím tắt; các lệnh **toggle** chứ không chèn mù.
- Enter tiếp tục list/quote, tự đánh số lại, Enter trên item rỗng thì outdent rồi thoát.
- Tab/Shift+Tab indent nhiều dòng; Ctrl+D nhân đôi; Alt+↑/↓ di chuyển; Ctrl+Shift+K xoá.
- Gõ dấu ngoặc khi đang bôi đen thì **bọc** selection thay vì thay thế.
- Dán URL lên selection → link; dán/kéo ảnh → nhúng base64; kéo file `.md` → chèn nội dung.
- Find & Replace (Ctrl+F / Ctrl+H) có case / whole-word / regex.
- Gutter số dòng **đo thật** bằng mirror div ẩn, nên vẫn khớp khi bật word wrap.

### Preview
- **Scroll sync theo dòng nguồn** thay vì theo phần trăm. `rehypeEnhance` đóng dấu
  `data-line` lên mọi block; `paneSync.ts` nội suy giữa các anchor. Đo được sai số
  ~1.5% trên tài liệu dài trộn heading/table (trước là heuristic tỉ lệ viewport).
- Double-click block trong preview → đặt caret đúng dòng nguồn (test: dòng 31 → 31).
- Tick checkbox trong preview sửa `- [ ]` trong source.
- Hỗ trợ **HTML nội tuyến** (rehype-raw + rehype-sanitize) — trước đây không render.
- Heading anchor, nút Copy cho từng code block, hiển thị lỗi Mermaid kèm source.

### Workspace
- **Command palette** (Ctrl+Shift+P) fuzzy search lệnh + file + heading.
- **Outline panel** dựng từ heading, click để nhảy.
- File tree **drag & drop**, rename inline, lọc theo tên, tự tránh trùng tên
  (`notes.md` → `notes (2).md`), nhớ folder đang mở.
- **Status bar**: trạng thái lưu, số từ/dòng, thời gian đọc, vị trí caret, zoom.
- Theme light/dark/**system**, sidebar và pane resize được, chế độ toàn màn hình.
- Export thêm **HTML self-contained** và **print stylesheet** thật.

## Thay đổi kiến trúc

Logic thuần được tách khỏi component để test được:

```text
src/lib/
  tree.ts            # thao tác cây file
  editorCommands.ts  # biến đổi text trên một selection
  markdown.ts        # heading, thống kê, tìm kiếm, ánh xạ dòng/offset
  paneSync.ts        # event bus + nội suy anchor cho scroll sync
  rehypeEnhance.ts   # data-line, heading id, sanitize schema
  persistence.ts     # localStorage có version + migration
  exporters.ts       # md/html/pdf/ảnh + clipboard fallback
  fuzzy.ts           # xếp hạng cho command palette
  id.ts              # sinh id không trùng
```

`src/components/Editor.tsx` và `Editor.css` đã bị thay bằng `EditorPane.tsx`/`.css`
(đã `git rm`).

### Storage schema

Đổi từ một khoá `markdown-editor-data` sang hai khoá:

- `markdown-editor:files` — `{ version: 2, files, currentFileId, expandedFolders }`
- `markdown-editor:settings` — chỉ các khoá trong `Settings`

`loadFiles`/`loadSettings` tự migrate từ khoá cũ (kể cả `isDarkMode` → `theme`) rồi xoá
khoá cũ. Đã có test cho đường migration này.

## Toolchain

`package.json` khai báo `vite@^8.2.2` nhưng `node_modules` còn Vite 5, và
`@vitejs/plugin-react@4` không hỗ trợ Vite 8. Đã đồng bộ:

- `vite@8.2.2` + `@vitejs/plugin-react@^6.1.1`
- `minify: 'esbuild'` → `minify: true` (Vite 8 dùng rolldown/oxc, không còn kèm esbuild)
- `manualChunks` chuyển sang dạng hàm (rolldown yêu cầu)

Build: **1m15s → ~6s**. Entry chunk: **2.5 MB → 87 kB**; tổng eager ~954 kB (~250 kB gzip).
Mermaid, html2canvas, jsPDF và các grammar Prism đều nạp theo nhu cầu.

## Phím tắt đáng chú ý

| Phím | Hành động |
| --- | --- |
| Ctrl+Shift+P | Command palette (luôn dùng được) |
| Ctrl+K | Chèn link khi đang ở editor; mở palette khi focus ở nơi khác |
| Ctrl+\\ | Đổi Editor / Both / Preview |
| Ctrl+/ | Mở Help |
| Ctrl+F, Ctrl+H | Find, Find & Replace |
| Ctrl+G | Nhảy tới dòng |
| F11, Esc | Vào/ra chế độ toàn màn hình |

## Điểm còn mở

1. **Mermaid + export ảnh/PDF**: html2canvas chụp được SVG của Mermaid, nhưng chưa test
   với ảnh external bị CORS chặn. `exportPdf`/`exportImage` đặt `crossOrigin` trong
   `onclone`; nếu ảnh không có CORS header, canvas vẫn bị taint và export sẽ báo lỗi.
   Đã có toast báo lỗi, chưa có fallback bỏ qua ảnh lỗi.
2. **`chunk-FOHPRMQF` 662 kB** trong dist — của Mermaid, chỉ tải khi có diagram. Có thể
   giảm thêm nếu cần bằng cách chỉ đăng ký các loại diagram thật sự dùng.
3. **`markdown` chunk 598 kB** phần lớn là KaTeX. Có thể lazy-load `rehype-katex` khi
   tài liệu thực sự có `$`, nhưng sẽ làm pipeline render phức tạp hơn.
4. **`npm audit`** còn 6 cảnh báo high, tất cả từ `minimatch` (ReDoS) trong nhánh dev
   dependency. Không ảnh hưởng bundle production.
5. **MySQL backend** chưa test thật (cần database). JSON contract đã test round-trip bằng
   stub server đúng shape của `markdown_storage_controller.py`, bao gồm cả trường hợp
   nhánh MySQL trả `children: []` trên file và `content: null` trên folder — `normalizeTree`
   xử lý được.
6. **Tài liệu cũ** `GETTING_STARTED.md`, `QUICK_REFERENCE.md`, `START_HERE.md`,
   `prompt/FILE_LISTING.md`, `prompt/PROJECT_STRUCTURE.md`, `prompt/IMPLEMENTATION_REPORT.md`
   chưa rà lại theo phiên bản mới — có thể còn mô tả cấu trúc cũ.
7. Chưa có CI chạy `npm test`; workflow trong `.github/` chưa được đụng tới.

## Cách tiếp quản nhanh

```powershell
cd C:\Users\tranphuc8a\Desktop\gemini_proxy\markdown-editor
npm install
npm run type-check
npm run lint
npm test
npm run dev
```

Mở URL Vite in ra (thường `http://localhost:5173`). Mở khoá chỉnh sửa bằng nút
**View only** ở góc phải trên, key mặc định `markdown-editor-admin-2024`.

## Nguyên tắc khi tiếp tục

- Đọc file này trước khi mở rộng phạm vi.
- Logic mới nên đặt vào `src/lib/` kèm test, thay vì nhét vào component.
- Chạy `npm run type-check && npm run lint && npm test` sau mỗi lát sửa quan trọng.
- Không revert thay đổi người dùng hoặc các rename trong `prompt/`.
- Không commit hoặc tạo branch nếu chưa được yêu cầu.
