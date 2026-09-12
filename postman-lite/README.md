# Postman Lite Pro

API client chạy trong trình duyệt: nhiều tab, collection runner, test script, import
Postman/OpenAPI, sinh code, và đồng bộ workspace lên backend FastAPI.

Bản kế nhiệm của app thuần HTML/JS ở `backend/fastapi/webapp/postman-lite/` — bản cũ
vẫn chạy được và không bị đụng tới.

## Chạy

```powershell
# 1. Backend (bắt buộc: cung cấp /proxy để vượt CORS và /postman để đồng bộ)
cd backend\fastapi
.\.venv\Scripts\python.exe -m uvicorn src.main:app --reload --port 6789

# 2a. Dev, có hot reload
cd postman-lite
npm install
npm run dev            # http://localhost:5175

# 2b. Hoặc build rồi dùng luôn qua backend
npm run build          # ghi thẳng vào backend/fastapi/webapp/postman-lite-pro/
# → http://localhost:6789/webapp/postman-lite-pro/
```

`npm run build` **là toàn bộ bước deploy** — Vite ghi trực tiếp vào thư mục mà
webapp controller phục vụ.

## Lệnh

| Lệnh | Việc |
|---|---|
| `npm run dev` | Dev server cổng 5175, proxy `/proxy`, `/postman`, `/api` sang `localhost:6789` |
| `npm run build` | Typecheck + build vào `../backend/fastapi/webapp/postman-lite-pro` |
| `npm test` | Vitest (58 test cho tầng `lib/` và store) |
| `npm run lint` | ESLint, `--max-warnings 0` |
| `npm run typecheck` | `tsc --noEmit` |

## Vì sao cần backend

Trình duyệt không gọi được API không trả header CORS — Postman thật là app native nên
không vướng. App này gửi qua `POST /proxy/request` của FastAPI khi cần:

| Chế độ | Hành vi |
|---|---|
| **Auto** (mặc định) | Gửi thẳng; gặp `TypeError` (CORS/DNS/refused) thì tự gửi lại qua proxy và báo cho bạn. Nếu request có header bị cấm (`Cookie`, `Referer`…) thì đi thẳng proxy luôn |
| **Direct** | `fetch` thuần |
| **Proxy** | Luôn qua backend |

Đi qua proxy còn được thêm: gửi được mọi header, và **đọc được đủ response header**
(cross-origin `fetch` chỉ lộ 6 header safelisted).

App tự dò API prefix (`""`, `/api/v1`, `/api`) vì `API_PREFIX` là lựa chọn lúc deploy —
`.env` của repo này để rỗng.

## Tính năng

**Soạn & gửi** — nhiều tab (mỗi tab là một *draft*, sửa không đụng bản đã lưu, có chấm
báo chưa lưu), URL ⇄ Params đồng bộ hai chiều, bật/tắt từng dòng key-value, auth
Basic/Bearer/API key, body JSON/Text/XML/form/multipart, hủy request, timeout.

**Environment** — `{{BIẾN}}` dùng được ở URL, header, cookie, auth, body. Chỉ thay lúc
gửi nên form giữ nguyên template; badge cảnh báo biến chưa có giá trị.

**Extract** — lấy giá trị từ response (`data.token`, `items[0].id`, header, status) ghi
vào biến environment, để request sau dùng luôn.

**Test script** — cú pháp `pm.test` / `pm.expect` / `pm.response` / `pm.environment`.
Chạy trong **Web Worker**: không chạm được DOM hay localStorage, và vòng lặp vô hạn bị
`terminate()` thay vì treo tab.

**Collection runner** — chạy tuần tự cả collection (kể cả collection con), báo cáo
pass/fail, xuất kết quả JSON. Biến do request trước extract ra được request sau dùng.

**Import / Export** — nhận Postman Collection v2.x và OpenAPI 3 / Swagger 2 (tự nhận
diện định dạng; mỗi `tag` thành một collection con, server URL vào `{{BASE_URL}}`),
export ngược ra Postman v2.1.

**Sinh code** — cURL, fetch, axios, Python requests, Java OkHttp. Dùng chung hàm
`prepare()` với bộ gửi nên snippet luôn khớp request thật.

**Workspace** — lưu collection/request/environment lên backend, mở lại từ máy khác,
link chia sẻ chỉ-đọc, lịch sử lưu trên server.

**UX** — `Ctrl+K` command palette, theme sáng/tối, diff hai response, panel kéo giãn.

| Phím | Việc |
|---|---|
| `Ctrl+Enter` | Gửi request |
| `Ctrl+S` | Lưu request |
| `Ctrl+K` | Command palette |
| `Ctrl+T` / `Ctrl+W` | Mở / đóng tab |
| `Ctrl+B` | Ẩn/hiện sidebar |

## API backend

| Endpoint | Việc |
|---|---|
| `POST /proxy/request` | Gửi hộ một HTTP request |
| `GET /proxy/status` | Proxy có bật không (app dùng để dò prefix) |
| `POST /postman/workspaces` | Tạo workspace → `{id, access_key}` |
| `GET\|PUT\|DELETE /postman/workspaces/{id}` | Đọc / lưu / xóa (header `X-Workspace-Key`) |
| `POST /postman/workspaces/{id}/share` | Bật / thu hồi link chia sẻ |
| `GET /postman/shared/{token}` | Đọc workspace được chia sẻ, không cần key |
| `…/history` | `GET` / `POST` / `DELETE` lịch sử phía server |

Cấu hình trong `backend/fastapi/.env`:

```env
POSTMAN_STORAGE_BACKEND=json     # json (mặc định, không cần DB) | mysql
POSTMAN_JSON_FILE=data/postman-workspaces.json
POSTMAN_MAX_HISTORY=500
```

Bản `mysql` tự `CREATE TABLE IF NOT EXISTS` khi dùng lần đầu — **không có Alembic
migration**, đúng ràng buộc trong CLAUDE.md.

## Bảo mật cần biết

- **Access key chỉ hiện một lần** lúc tạo workspace. Server chỉ giữ SHA-256, nên lộ file
  JSON hay dump bảng cũng không mở được workspace.
- **Link chia sẻ không kèm environment** — đó là chỗ chứa token và mật khẩu. Chỉ
  collection và request bị lộ.
- **Lưu bằng khoá lạc quan**: mỗi lần lưu khai báo `revision` nó dựa trên. Nếu người khác
  đã lưu trước, server từ chối và trả về bản hiện tại để bạn merge — thay vì im lặng ghi
  đè công của họ.
- `/proxy/request` là **forward proxy**: cái gì backend gọi được thì người dùng API cũng
  gọi được. Nếu deploy public, đặt `PROXY_ENABLED=false` hoặc ghim `PROXY_ALLOWED_HOSTS`.

## Cấu trúc

```
src/lib/     api · sender · curl · codegen · importers · env · extract
             testRunner · storage · tree · diff · util
src/store.ts zustand: dữ liệu, tabs, runner, workspace
src/components/  Topbar · Sidebar · RequestPanel · ResponsePanel
                 Dialogs · CommandPalette · KeyValueEditor · Modal · Toasts · Icons
src/styles/  tokens.css (dùng chung vốn từ với sql-administrator) · app.css
```

Nguyên tắc giữ khi sửa: **`lib/` thuần, không chạm DOM**. Nhờ vậy `prepare()` dùng được
cho cả bộ gửi lẫn bộ sinh code, và toàn bộ logic test được bằng Vitest mà không cần render.
