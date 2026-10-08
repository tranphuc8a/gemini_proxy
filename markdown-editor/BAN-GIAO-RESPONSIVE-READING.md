# Bàn giao: responsive/mobile + Chế độ đọc (09/10/2026)

## Đã làm
- **Responsive** (`lib/responsive.ts`, `hooks/useViewport.ts`): layout `phone` (<768 hoặc cảm ứng nằm ngang) / `tablet` (<1024) / `desktop`; header 3 bậc `compact|medium|full`, lệnh không vừa chuyển vào menu "⋯".
  - `.app` có `grid-template-columns: minmax(0,1fr)` + `100dvh`; viewport meta `interactive-widget=resizes-content, viewport-fit=cover`.
  - Sidebar dưới 1024px = drawer (`components/Drawer.tsx`, bẫy focus `hooks/useFocusTrap.ts`), đóng khi chọn file/backdrop/Esc. State `layout/drawerOpen/phonePane` trong store, **không** lưu.
  - Phone + chế độ Both: một pane + nút Editor | Preview (`PaneSwitch.tsx`); khách xem preview, admin xem editor.
  - Input ≥16px trên phone/cảm ứng (index.css; editor dùng biến `--editor-fs`), nút ≥40px khi `pointer: coarse`, nút ẩn-khi-hover hiện khi `hover: none`, popover heading `position: fixed`.
- **Chế độ đọc** (`components/ReadingView.tsx`, `readingStore.ts`, `lib/reading.ts`): nút sách ở header, command palette, `Ctrl+Alt+V`, `?read=1`. Cài đặt lưu ở `localStorage["markdown-editor:reading"]`. Heading id có tiền tố `reading-`.
- Sửa lỗi cũ: ảnh `data:` (dán ảnh) bị react-markdown bỏ → `markdownUrlTransform`; fence `js/ts/py/sh/html…` không tô màu → `lib/codeLanguages.ts`; dòng code đầu bị thụt.
- Renderer dùng chung: `components/MarkdownView.tsx` (preview + chế độ đọc).

## Thêm tính năng mới (vd. AI smart format)
- Nút header: thêm một mục vào mảng `actions` trong `Header.tsx` (`inlineFrom` quyết định khi nào vào menu "⋯").
- Nút toolbar định dạng: `FormatToolbar.tsx` + case trong `runAction` của `EditorPane.tsx`.
- Lệnh palette: mảng `actions` trong `CommandPalette.tsx`.
- Modal: theo mẫu `HelpModal`/`AuthModal` (`.overlay` + `.panel`, state ở `App.tsx`).

## Kiểm
`npm test` (288), `npm run type-check`, `npm run lint`, `node scripts/build-webapps.mjs --only markdown-editor`, `--check`, `scripts/audit-webapps.mjs tranphuc8a/markdown-editor-pro` (cần NODE_PATH tới playwright).
