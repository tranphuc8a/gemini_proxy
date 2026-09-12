# SQL Administrator — Compact Handoff (12/09/2026)

Tóm tắt ngữ cảnh + công việc đã làm, để phiên làm việc sau tiếp quản được ngay.

## Yêu cầu của phiên này

Theo `sql-administrator/prompt/prompt.md`: viết ứng dụng web thuần FE làm công cụ quản trị
MySQL/MariaDB (kiểu phpMyAdmin/Adminer), hỗ trợ đăng nhập tới host/port/user/password bất kỳ, giữ
phiên tới khi logout, kiến trúc web thuần + tối đa thêm RESTful API, BE dựa trên `backend/fastapi`.

## Quyết định kiến trúc

**Trình duyệt không nói được giao thức wire của MySQL** (chỉ có `fetch`/`WebSocket`), nên bắt buộc
phải có một REST bridge — đúng như phpMyAdmin cần PHP. Đã giữ bridge càng mỏng càng tốt:

- FE `/sql-administrator`: React 18 + TS strict + Vite 8 + Zustand + Vitest (trùng toolchain
  `markdown-editor` của repo). Toàn bộ state UI, phân trang, sort, lịch sử query, theme nằm ở browser.
- BE: module mới trong `backend/fastapi`, theo đúng hexagonal sẵn có (`ports → usecase → adapters`),
  **không có schema/migration/bảng nào của riêng nó**.

## Đã tạo những gì

**FE — `sql-administrator/` (~3.900 dòng TS/TSX)**

| Vùng | File |
|---|---|
| Vỏ + state | `src/App.tsx`, `src/store.ts`, `src/types.ts` |
| Thư viện | `src/lib/api.ts`, `sql.ts`, `format.ts`, `storage.ts` |
| Màn hình | `ConnectScreen`, `Topbar`, `Sidebar`, `TableBrowser`, `StructureView`, `SqlConsole`, `ServerView` |
| Dùng chung | `DataGrid`, `RowEditor`, `ConfirmDialog` + `useConfirm`, `Toasts`, `Icons` |
| Style | `src/styles/tokens.css` (light/dark), `src/styles/app.css` |
| Test | `src/test/{api,sql,format,storage,store}.test.ts` |

**BE — `backend/fastapi/src/` (file mới)**

```
domain/vo/sqladmin_vo.py                 domain/utils/sql_identifier.py, sql_script.py
application/ports/input/sql_admin_input_port.py
application/ports/output/sql_gateway_output_port.py, sql_session_output_port.py
application/usecases/sql_admin_usecase.py
adapter/input/controllers/sql_admin_controller.py    adapter/factory/sql_admin_factory.py
adapter/output/sqlgateway/{mysql_gateway,session_store,crypto}.py
```

Sửa: `src/main.py` (đăng ký router + shutdown hook đóng pool), `config.py` (7 setting `SQLADMIN_*`),
`requirements.txt` (thêm `cryptography>=42`).

## Cơ chế phiên (điểm cần nhớ nhất)

Yêu cầu "giữ phiên tới khi logout" được giải bằng 3 lớp:

1. Browser chỉ giữ **token opaque 32 byte** trong `localStorage['sqladmin.token']`. **Không bao giờ**
   lưu mật khẩu ở browser; form login chỉ nhớ host/port/user/database.
2. `FileSessionStore` giữ session trong RAM và mirror ra `data/sqladmin-sessions.json`; mật khẩu đích
   được **seal bằng AES-GCM**, khoá dẫn xuất từ `SQLADMIN_SECRET_KEY` (PBKDF2-SHA256, 120k vòng).
   → restart backend vẫn còn phiên. Đổi secret = vô hiệu hoá toàn bộ phiên cũ (cố ý).
3. `MySqlGateway` giữ 1 pool aiomysql/session, tạo lazy, đóng khi logout hoặc app shutdown.

Reload trang → `GET /sessions/current`; nhận 401 thì xoá token và quay về màn hình login.

## Mô hình an toàn

Đây là công cụ quản trị nên **chạy SQL tuỳ ý chính là tính năng**. Phòng thủ nhắm vào injection vào
SQL *do app sinh ra* và vào thao tác nhầm:

- Mọi giá trị người dùng đều **bind `%s`**, không nối chuỗi — kể cả browse/count/insert/update/delete/export.
- Identifier qua `quote_identifier()` (backtick, nhân đôi backtick trong tên, chặn NUL, giới hạn 64).
- Cột sort phải có thật trong bảng; hướng sort chỉ `asc`/`desc`; charset/collation khớp `^[A-Za-z0-9_]{1,64}$`.
- Không cho drop `mysql`, `information_schema`, `performance_schema`, `sys`.
- Update/delete luôn có key + `LIMIT 1`. Bảng không PK và quá rộng → UI để read-only.
- Drop/truncate bắt gõ đúng tên đối tượng mới cho bấm.
- Kết quả bị cap theo `max_rows` / `SQLADMIN_MAX_ROWS`, có cờ `truncated`.

## Kết quả kiểm thử

| Bộ | Lệnh | Kết quả |
|---|---|---|
| FE | `npm test` | **125 pass** |
| FE | `npm run lint` / `npm run typecheck` / `npm run build` | sạch, build 48 KB + react 140 KB (gzip ~59 KB) |
| BE domain utils | `pytest tests/domain` | **40 pass** |
| BE session/crypto | `pytest tests/adapter/output/sqlgateway` | **20 pass** |
| BE usecase | `pytest tests/application/test_sql_admin_usecase.py` | **55 pass** |
| BE router | `pytest tests/adapter/input/controller/test_sql_admin_controller.py` | **25 pass** |

Smoke test xuyên toàn bộ stack thật (router → usecase → aiomysql thật, không stub): connect tới
cổng không ai nghe trả 502 đúng envelope; thiếu token → 401; token lạ → 401; logout token lạ →
200 `{disconnected:false}`; port 70000 → 422; OpenAPI có đủ 14 path. Tất cả pass.

**Chưa chạy được E2E với MySQL thật**: máy này không có MySQL local (`localhost:3306` timeout) và
không có Docker. `.env` có trỏ tới một instance Aiven từ xa nhưng chưa đụng vào — cần người dùng
đồng ý trước.

## Lưu ý môi trường

- `API_PREFIX` trong `backend/fastapi/.env` đang **rỗng**, nên endpoint thực tế là
  `http://localhost:6789/sqladmin/...` (không phải `/api/v1/...`). FE mặc định proxy `/sqladmin`
  qua `VITE_DEV_API_TARGET` nên dev không dính CORS.
- Vite dev server của FE này chạy cổng **5174** (markdown-editor đã chiếm 5173).
- Phải dùng `typescript-eslint` v8 + `@eslint/js`; hai gói `@typescript-eslint/*` v6 xung đột peer
  với eslint 9 (đã gỡ khỏi `package.json`).
- `tsconfig.node.json` là composite project nên không được đặt `noEmit`, phải `emitDeclarationOnly`.

## Điểm còn mở

- Chưa có E2E với database thật (xem trên).
- Chưa có màn hình **tạo/sửa bảng** bằng form (hiện phải dùng SQL console). Đây là khoảng trống lớn
  nhất so với phpMyAdmin.
- Chưa có import file SQL (chỉ có export).
- Chưa có kill process trong màn hình Server (chỉ xem).
- Chưa có quản lý user/grant.
- `SHOW GLOBAL STATUS`/`VARIABLES` đang lọc cứng theo danh sách khoá trong `sql_admin_usecase.py`
  (`_STATUS_KEYS`, `_VARIABLE_KEYS`) — muốn xem thêm thì thêm vào đó.
- Bridge chưa có xác thực riêng: ai gọi được `/sqladmin/sessions` là thử kết nối được tới mọi host
  mà server định tuyến tới. Cần đặt sau auth + TLS trước khi mở ra ngoài localhost.

## Nợ kỹ thuật có sẵn (không phải do phiên này)

`pytest tests` toàn bộ **fail ở bước collect** với 4 file test cũ import module đã đổi chỗ:
`src.adapter.db`, `src.adapter.gemini`, `src.adapter.repositories`. Đã xác nhận là lỗi có trước,
không liên quan tới thay đổi của phiên này, nên không sửa. Vì vậy hãy chạy pytest **theo path cụ
thể** như bảng trên, đừng chạy `pytest tests` trần.

## Cách tiếp quản nhanh

```bash
# BE
cd backend/fastapi && .\.venv\Scripts\Activate.ps1 && .\run_fastapi.ps1

# FE (terminal khác)
cd sql-administrator && npm install && npm run dev   # http://localhost:5174
```

Đọc `prompt/PROJECT_STRUCTURE.md` để nắm layout + hợp đồng REST (14 endpoint), `README.md` để cài đặt.

## Nguyên tắc khi tiếp tục

- Giữ FE "thuần": logic nghiệp vụ mới nên nằm ở browser; chỉ thêm endpoint khi thật sự cần server.
- Mọi SQL sinh ra ở BE: giá trị **bind**, identifier **quote + validate**. Test usecase assert đúng
  chuỗi SQL sinh ra — thêm case mới ở `tests/application/test_sql_admin_usecase.py` khi đổi SQL.
- Thao tác phá huỷ phải đi qua `useConfirm` với `requireText`.
- Giữ `types.ts` khớp 1:1 với `domain/vo/sqladmin_vo.py`.
