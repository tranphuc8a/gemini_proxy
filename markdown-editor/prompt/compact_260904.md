# Markdown Editor - Compact Handoff

**Ngày:** 2026-09-04  
**Workspace:** `C:\Users\tranphuc8a\Desktop\gemini_proxy`  
**Project:** `markdown-editor`  
**Branch:** `main`

## Mục tiêu dự án

Ứng dụng Markdown editor thuần frontend bằng React + TypeScript + Vite, có:

- Editor và live preview GitHub-style.
- GFM: table, task list, link, image, HTML, math/KaTeX, Mermaid.
- Quản lý file/folder dạng cây.
- Admin bằng secret key; anonymous chỉ view.
- Undo/redo, history, scroll sync.
- LocalStorage mặc định và tùy chọn đồng bộ FastAPI backend.

## Milestone 1/2 đã có

- React 18, TypeScript, Vite, Zustand.
- `react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex`.
- File tree CRUD cơ bản.
- Admin key hiện tại: `markdown-editor-admin-2024`.
- Auto-save localStorage với key `markdown-editor-data`.
- Backend FastAPI đã có API markdown storage:
  - `GET /api/v1/markdown/files`
  - `PUT /api/v1/markdown/files`
- Backend storage hỗ trợ JSON hoặc MySQL:
  - `MARKDOWN_STORAGE_BACKEND=json|mysql`
  - `MARKDOWN_JSON_FILE=data/markdown-files.json`
  - `MARKDOWN_ADMIN_KEY=markdown-editor-admin-2024`
  - MySQL dùng `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` hiện có.
- PUT backend yêu cầu header `X-Admin-Key`.
- Frontend API URL mặc định: `http://localhost:6789/api/v1/markdown/files`; override bằng `VITE_MARKDOWN_API_URL`.

## Milestone 3 đã triển khai

Yêu cầu nguồn: [prompt-03.md](prompt-03.md)

### Toolbar/layout

- Toolbar có undo/redo, view mode, import/export, PDF/PNG/JPG, backend storage, scroll sync, dark mode, admin status.
- View mode: `Editor`, `Both`, `Preview`.
- Divider giữa editor/preview kéo được bằng pointer.
- Divider giới hạn editor width 20%-80%, lưu trong Zustand.
- Sidebar có thể collapse/expand.
- Fullscreen workspace ẩn header.
- Để tránh bị kẹt fullscreen, có nút thoát nổi góc phải dưới và phím `Escape` thoát fullscreen khi Help không mở.

### File management

- `selectedFolderId` được dùng để tạo file/folder vào folder đang chọn, không còn chỉ tạo ở root.
- `moveNode(nodeId, parentId)` và `copyNode(nodeId, parentId)` trong store.
- Copy recursive toàn bộ folder con, tạo ID mới.
- Chặn move node vào chính nó hoặc descendant của nó.
- UI: click folder để chọn destination; hover node có rename/copy/move/delete.
- Copy/move hiện dùng folder đang selected làm destination.

### Mermaid

- Dependency đã nâng từ Mermaid 10 lên `mermaid@^11.17.2`.
- `MermaidDiagram` dùng `mermaid.initialize()` và `mermaid.run()`.
- Có `ResizeObserver` để render lại khi pane/divider thay đổi kích thước.
- Dùng `securityLevel: strict`.

### Scroll/focus

- Preview scroll phát event `preview-scroll` để editor sync.
- Editor scroll phát event `editor-scroll` để preview sync.
- Double-click preview phát `preview-focus-editor`; editor focus và đặt caret theo vị trí tương đối.
- Cần kiểm tra thực tế với document dài vì mapping preview block -> editor line hiện là heuristic theo viewport/line ratio, chưa phải source map chính xác tuyệt đối.

### Code blocks

- Code block có class `language-xxx` được render bằng `react-syntax-highlighter` Prism.
- Có nút `Copy` dùng `navigator.clipboard.writeText()`.
- Mermaid block được xử lý riêng trước syntax highlighting.

### Export/import

- Import nhận `.md`, `.markdown`, đọc bằng `FileReader` vào editor hiện tại.
- Export Markdown tải `document.md`.
- Export rendered preview bằng:
  - `html2canvas`
  - `jspdf`
  - PDF, PNG, JPG
- Cần test thêm với image external/CORS và document rất dài.

### Responsive

- Toolbar cho phép wrap trên mobile.
- Split layout chuyển thành column dưới 768px.
- Divider chuyển sang row-resize trên mobile.
- Help modal có responsive padding.

## Cấu trúc source quan trọng

Từ thư mục `markdown-editor/`:

```text
src/
  App.tsx                         # shell, sidebar/fullscreen, split divider
  App.css                         # layout, fullscreen, divider, responsive
  store.ts                        # Zustand state/actions/tree operations
  types.ts                        # FileNode, EditorState
  components/
    Header.tsx                    # toolbar, import/export/storage/view actions
    Header.css
    Sidebar.tsx                   # file creation in selected folder
    Sidebar.css
    FileTree.tsx                  # recursive tree, rename/copy/move/delete
    FileTree.css
    Editor.tsx                    # textarea, keyboard, editor scroll events
    Editor.css
    Preview.tsx                   # Markdown, Mermaid, syntax highlighting, sync
    Preview.css
    AuthModal.tsx / AuthModal.css
    HelpModal.tsx / HelpModal.css # floating ? and fullscreen exit button
  services/
    markdownStorage.ts            # frontend FastAPI load/save
  vite-env.d.ts

package.json                     # dependencies/scripts
README.md                         # project docs + backend storage config
USER_GUIDE.md                     # user-facing usage guide
MILESTONE_3_REPORT.md             # milestone summary
prompt/
  prompt-01.md
  prompt-02.md
  prompt-03.md
  compact_260904.md               # this handoff
```

Backend additions are in the repository root:

```text
backend/fastapi/src/
  main.py                         # registers markdown_storage_controller
  application/config/config.py    # markdown storage settings
  adapter/input/controllers/
    markdown_storage_controller.py
```

## Dependency hiện tại

Production dependencies trong `package.json`:

- `react`, `react-dom`
- `react-markdown`
- `remark-gfm`, `remark-math`, `rehype-katex`
- `mermaid: ^11.17.2`
- `zustand`
- `html2canvas`
- `jspdf`
- `react-syntax-highlighter`

Dev dependencies có TypeScript/Vite/ESLint và `@types/react-syntax-highlighter`.

## Validation đã chạy

Từ `markdown-editor/`:

```powershell
npm install
npm run type-check
npm run build
```

Kết quả gần nhất:

- `npm install`: thành công.
- `npm run type-check`: pass.
- `npm run build`: pass.
- Diagnostics các file chính: không có lỗi.
- FastAPI `compileall`: đã pass trước đó.

Lưu ý terminal PowerShell có thể đang giữ cwd ở `markdown-editor`; nếu cần chạy từ repo root, dùng `cd markdown-editor` trước npm command.

## Trạng thái Git lúc tạo handoff

Các thay đổi liên quan dự án gồm:

- Modified: `package.json`, `package-lock.json`.
- Modified: `src/App.tsx`, `src/App.css`, `src/store.ts`, `src/types.ts`.
- Modified: `src/components/Editor.tsx`, `FileTree.tsx`, `Header.tsx`, `Header.css`, `Preview.tsx`, `Preview.css`, `Sidebar.tsx`.
- Added: `src/components/HelpModal.tsx`, `HelpModal.css`.
- Added/changed: backend markdown storage controller/config/registration.
- Added: `MILESTONE_3_REPORT.md`, `USER_GUIDE.md`.
- `prompt.md` và các tài liệu cũ đã được rename/move vào `prompt/` trong workspace hiện tại; không tự ý revert.
- `.codegraph/` có thể tồn tại do tooling; không thuộc phạm vi feature.

## Điểm cần kiểm tra tiếp

1. Chạy app và kiểm tra Mermaid thật trên các cú pháp flowchart, sequence, class, state, gantt, git và lỗi cú pháp.
2. Kiểm tra Mermaid sau khi kéo divider nhiều lần; đảm bảo SVG không biến lại thành source code.
3. Kiểm tra copy code trên browser không hỗ trợ Clipboard API hoặc khi chạy không secure context; nên có fallback/error feedback nếu cần.
4. Kiểm tra move/copy UX với nested folder, root folder, copy folder vào chính descendant.
5. Cải thiện double-click preview focus bằng source mapping nếu yêu cầu “đúng 100%” thay vì heuristic hiện tại.
6. Kiểm tra export PNG/JPG/PDF với dark mode, long document, external images và Mermaid SVG.
7. Chạy FastAPI để test thật GET/PUT JSON; test MySQL khi có database.
8. Cân nhắc debounce `setContent`: hiện mỗi keystroke thêm một history entry, có thể làm history/localStorage lớn.
9. Cân nhắc đồng bộ backend tự động khi `backendStorage` bật; hiện toolbar có nút Load/Save thủ công.
10. Có thể bổ sung test unit cho tree helpers, store actions và markdown rendering.

## Cách tiếp quản nhanh

```powershell
cd C:\Users\tranphuc8a\Desktop\gemini_proxy\markdown-editor
npm install
npm run type-check
npm run build
npm run dev
```

Mở URL Vite hiển thị, thường là `http://localhost:5173`.

Đăng nhập admin bằng key `markdown-editor-admin-2024` để test chỉnh sửa/file operations.

Nếu đang fullscreen: click nút mũi tên xanh góc phải dưới hoặc nhấn `Escape`.

## Nguyên tắc khi tiếp tục

- Đọc file này trước khi mở rộng phạm vi.
- Kiểm tra file hiện tại trước khi sửa vì user/formatter có thể đã thay đổi `package.json` hoặc prompt layout.
- Giữ thay đổi nhỏ và chạy `npm run type-check` sau mỗi lát sửa quan trọng.
- Không revert thay đổi người dùng hoặc các rename trong `prompt/`.
- Không commit hoặc tạo branch nếu chưa được yêu cầu.
