---
name: webapp-react
description: Làm việc với các ứng dụng React/Vite của dự án (gemini-chat, markdown-editor-pro, sql/mongo-administrator, postman-lite-pro, graphuc, casio) — nguồn nằm ở thư mục gốc repo, build và xuất bản bằng scripts/build-webapps.mjs, đọc API base lúc chạy, test vitest, lint, client AI dùng chung. Dùng khi sửa bất kỳ app React nào.
---

# Ứng dụng React (bản build)

| Nguồn (gốc repo) | Xuất bản thành (dưới `backend/fastapi/webapp/`) |
| --- | --- |
| `frontend/` | `tranphuc8a/gemini-chat` |
| `markdown-editor/` | `tranphuc8a/markdown-editor-pro` |
| `sql-administrator/` | `tranphuc8a/sql-administrator` |
| `postman-lite/` | `tranphuc8a/postman-lite-pro` |
| `mongo-administrator/` | `tranphuc8a/mongo-administrator` |
| `graphuc/`, `casio-fx580vnx/` | `tranphuc8a/graphuc`, `tranphuc8a/casio-fx580vnx` |

Bảng chính thức: `scripts/build-webapps.mjs` (`--list`). Bản `webapp/gemini-chat`, `webapp/postman-lite-pro`, `webapp/tranphuc8a/markdown-editor` là **bản cũ** không còn build.

## Quy trình

1. Sửa ở thư mục nguồn (React 18 + TS + Vite; chat dùng antd; markdown dùng zustand). `npm install` đã có sẵn `node_modules`.
2. `npm run type-check && npm run lint && npm test` (vitest + Testing Library; lint chạy `--max-warnings 0`).
3. `node scripts/build-webapps.mjs --only <tên-thư-mục-nguồn>` — build rồi chép vào webapp, **giữ `metadata.json` của đích**. Cuối script có bước kiểm: bản xuất bản
   không được chứa gốc API cứng (localhost…). `--check` chỉ kiểm, `--skip-build` chỉ chép `dist/`, `--list` xem bảng.
4. Kiểm bố cục thật: `scripts/audit-webapps.mjs` (420 px), hoặc Playwright tự viết (nhớ phục vụ bằng `http.server` nhỏ, ES module không chạy ở `file://`).

Đừng sửa `webapp/**/assets/index-*.js` — mất khi build lại.

## Gốc API lúc chạy

`vite.config.ts` đặt `base: './'`. Máy chủ chèn `window.__WEBAPP_CONFIG__ = {apiBase, webappBase}` vào `index.html`; code đọc qua `src/lib/runtimeConfig.ts`
(app chat: `services/apiClient.ts` → `BASE_URL`). Không gõ cứng URL máy chủ. Chi tiết: `docs/webapp-runtime-config.md`.

## Client AI trong app React

Cùng một giao thức với `ai-khach.js` (xem skill `them-tinh-nang-ai`): `src/lib/ai.ts` (SQL/Mongo/Postman) hoặc `src/services/aiService.ts` (chat).
Danh tính lấy từ `localStorage` theo gốc API tuyệt đối: `qlkh.phien@<gốc>.token` → `X-Admin-Session`, `ai.phien@<gốc>` → `X-AI-Session`,
`ai.model@<gốc>` → `X-AI-Model`. Câu trả lời `/ai/*` là JSON trần; lỗi dùng phong bì `{message, data:{code}}`.
Chat: danh sách model **lấy từ máy chủ** (`useAiModels` → `GET /ai/models`; dòng Pro hiện mờ cho người không phải quản trị) — đừng ghim tên model trong mã hay test.

## Cạm bẫy

- Test chat/so sánh model mock `aiService` (`vi.mock`) — thêm hàm mới vào `aiService` thì thêm vào mock ở `ChatArea.test.tsx`.
- `markdown-editor` có hộp thư nhập `?import=1` + `localStorage["markdown-editor:inbox"]` (chat và sổ tay khoá học gửi tài liệu sang); giữ nguyên hợp đồng này.
- Markdown Editor chỉ cho sửa/lưu khi là quản trị viên; người xem chỉ đọc (chế độ đọc phải dùng được cho cả hai).
