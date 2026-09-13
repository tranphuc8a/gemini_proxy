# Mongo Administrator — Compact Handoff (13/09/2026)

## Yêu cầu của phiên này

Từ `mongo-administrator/prompt/prompt.md`: viết web app thuần FE làm công cụ quản trị
MongoDB (kiểu mongo-express / Compass), connect được tới host/port/user/password bất kỳ,
giữ phiên đăng nhập cho tới khi user logout, kiến trúc web thuần + tối đa là RESTful API.
Base directory `/mongo-administrator`. Được phép dùng BE `backend/fastapi` nếu cần.

## Quyết định kiến trúc

1. **Bắt buộc có REST bridge.** Trình duyệt không mở được raw TCP socket, MongoDB nói
   binary wire protocol, và Atlas Data API đã bị khai tử → không có đường HTTP nào khác.
   Bridge là phần server tối thiểu: giữ driver, giữ credential, expose đúng những gì UI cần.
2. **Nhân bản khuôn `sqladmin` có sẵn** thay vì thiết kế mới. BE `backend/fastapi` đã giải
   đúng bài toán này cho MySQL (`/sqladmin` + `sql-administrator`), kể cả cơ chế seal session.
   Module `mongoadmin` đi song song, **không sửa code cũ**.
3. **Driver: `pymongo.AsyncMongoClient` (pymongo >= 4.13), KHÔNG dùng Motor.**
   Motor deprecated và EOL từ 05/2026; API async native của pymongo là bản thay thế.
4. **FE: React 18 + TS + Vite + zustand**, đồng bộ với `sql-administrator` để dùng chung
   quy ước, token CSS và cách test. Không UI framework, không editor library.
5. **Đọc dùng POST, không dùng GET.** filter/projection/pipeline là JSON document; nhét vào
   query string thì URL không đọc nổi, đụng giới hạn độ dài, mà cũng chẳng cache được.

## Đã tạo những gì

### FE — `/mongo-administrator` (43 file)

- `src/lib/ejson.ts` — **file quan trọng nhất**. Parser quét từng ký tự (không phải regex)
  cho cú pháp mongosh: key không quote, nháy đơn, dấu phẩy thừa, comment `//`, `ObjectId(…)`,
  `ISODate(…)`, `NumberLong(…)`, `/regex/i` → Extended JSON chuẩn. `toShell` in ngược lại
  cùng cách viết đó, nên editor round-trip được.
  *Lý do dùng scanner:* regex không phân biệt được `ObjectId(` trong string và ngoài string
  (`{note: "call ObjectId(x) later"}` — có test riêng cho ca này).
- `src/store.ts` — toàn bộ state trong 1 zustand store. Mọi lời gọi API đi qua helper `guard`:
  bật/tắt `busy`, bắt `ApiError` → toast, gặp 401 → xoá token + về màn login. Hai ngoại lệ
  cố ý không toast: `connect` (lỗi thuộc về form login) và `bootstrap` (token cũ không đáng báo).
- `src/lib/api.ts`, `format.ts`, `storage.ts`, `types.ts`
- 13 component: ConnectScreen, Topbar, Sidebar, DocumentBrowser, DocumentEditor, IndexView,
  AggregateConsole, StatsView, ServerView, JsonEditor, ConfirmDialog, useConfirm, Toasts, Icons
- `styles/tokens.css` + `app.css` — light/dark, tô màu cell theo kiểu BSON
- 5 file test vitest

### BE — `/backend/fastapi` (11 file mới, 4 file sửa)

```
domain/utils/mongo_json.py          396  codec Extended JSON v2 + validate namespace
domain/utils/mongo_uri.py           198  build/parse/redact connection string (pure python)
domain/vo/mongoadmin_vo.py          210  VO request/response
ports/input/mongo_admin_input_port.py   139
ports/output/mongo_gateway_output_port.py  201
ports/output/mongo_session_output_port.py   44
usecases/mongo_admin_usecase.py     786  toàn bộ nghiệp vụ
adapter/output/mongogateway/mongo_gateway.py  446  AsyncMongoClient + dịch lỗi driver
adapter/output/mongogateway/session_store.py  179  session in-memory + mirror file đã seal
adapter/factory/mongo_admin_factory.py   69
adapter/input/controllers/mongo_admin_controller.py  347  26 route
```

Sửa: `src/main.py` (router + shutdown hook), `config.py` (`MONGOADMIN_*`),
`requirements.txt` (`pymongo>=4.13`), `.env.example` + `.env`.

## Cơ chế phiên (điểm cần nhớ nhất)

- `POST /sessions` → probe (`hello` + `buildInfo`) → cấp token `secrets.token_urlsafe(32)`.
- Browser chỉ lưu **token** vào `localStorage`. Password không bao giờ vào browser.
- Server: `FileMongoSessionStore` giữ session trong RAM + mirror ra
  `data/mongoadmin-sessions.json`. **Cả URI là credential** (khác sqladmin chỉ seal password),
  nên seal nguyên URI bằng AES-GCM qua `sqlgateway/crypto.py` dùng chung.
  Host/port/username để nguyên cho dễ đọc.
- Hệ quả: restart backend **không** logout ai. Đổi `MONGOADMIN_SECRET_KEY` = kill switch,
  vô hiệu hoá toàn bộ session. Thiếu `cryptography` thì tự tắt mirror chứ không ghi
  credential trần. Session **không có expiry** — đúng yêu cầu đề bài.

## Mô hình an toàn

Đặt rào ở chỗ người dùng dễ nhầm, không đặt ở chỗ chỉ gây phiền:

- Không drop được `admin` / `local` / `config` (cờ `allow_reserved_database_drop` mở được)
- Không drop được index `_id_`
- `update_one` / `delete_one` **bắt buộc có filter** — `update_one({})` ghi đè lên document
  bất kỳ mà server trả về đầu tiên
- `delete_many({})` bị từ chối, phải đi qua route truncate tường minh
- Replacement document không được `many=true`
- Trộn `$set` với field thường bị chặn ở domain (MongoDB báo lỗi này rất muộn và khó hiểu)
- Validate tên db/collection trước mọi I/O (`$`, null byte, `system.*`, quá dài)
- UI bắt gõ đúng tên trước khi drop
- Count không filter dùng `estimated_document_count` (giống Compass), vì `count_documents({})`
  quét cả collection
- Dịch lỗi driver **một lần duy nhất** ở gateway → `UnauthorizedError` / `GatewayTimeoutError` /
  `ConflictError` / `NotFoundError` / `BadRequestError`. Không tầng nào phía trên import pymongo.

## Kết quả kiểm thử

```
BE:  476 passed (229 test mới)
     - test_mongo_utils.py              84
     - test_mongo_admin_usecase.py      90
     - test_mongo_admin_controller.py   43
     - test_mongo_session_store.py      12
FE:  157 passed  (ejson 47, store 47, api 27, format+storage 36)
lint: sạch (--max-warnings 0)
typecheck: sạch
build: 68 KB gzip tổng
self-test toàn stack thật (router → factory → MongoGateway → pymongo): 21/21 check pass
```

Không suite nào cần MongoDB server: usecase test chạy trên `FakeGateway` ghi lại lời gọi,
controller test thay usecase qua `dependency_overrides`.

## Lưu ý môi trường

- `API_PREFIX` trong `backend/fastapi/.env` hiện là **rỗng** → route là `/mongoadmin/...`
  chứ không phải `/api/v1/mongoadmin/...`. FE để `VITE_API_BASE` rỗng là khớp.
- Dev server FE chạy port **5175** (sql-administrator đang dùng 5174).
- `pymongo 4.18.1` đã cài vào `backend/fastapi/.venv`.
- Bash tool trên máy này **nuốt backslash trong heredoc** (kể cả `<<'EOF'`). File nào có
  escape/regex thì dùng Write tool, hoặc dựng backslash bằng `chr(92)` trong Python.

## Điểm còn mở

1. **Chưa chạy thật với MongoDB.** Máy không có `mongod` lẫn Docker. Đã self-test toàn stack
   thật nhưng trỏ vào endpoint chết → chứng minh được đấu nối và dịch lỗi, **không** chứng minh
   được một query thành công. Việc đầu tiên khi có server thật: connect → browse → insert →
   edit → delete → index → aggregate bằng tay.
2. `?with_stats=true` tốn 1 round trip mỗi collection, cap ở 60 collection. Nếu cần nhanh hơn
   thì gom bằng `$collStats` một lần.
3. `$out` / `$merge` trong console aggregate **không bị chặn** — chúng ghi dữ liệu.
4. Chưa có quản trị replica set / sharding (`rs.*`, balancer) và chưa có quản lý user/role.
5. Chưa copy `dist/` vào `backend/fastapi/webapp/` (sql-administrator cũng chưa) — hướng dẫn
   đã có trong README, chưa làm vì chưa được yêu cầu.

## Cách tiếp quản nhanh

```bash
# BE
cd backend/fastapi
.venv/Scripts/activate
python -m uvicorn src.main:app --reload --port 6789
# kiểm tra: http://localhost:6789/docs → mục "mongo-administrator", 21 path

# FE (terminal khác)
cd mongo-administrator
npm install
npm run dev        # http://localhost:5175
```

## Nguyên tắc khi tiếp tục

- Không sửa code `sqladmin` / các module cũ — `mongoadmin` đi song song.
- Thêm nghiệp vụ thì sửa `usecase`, không sửa `controller`; thêm thao tác driver thì mở rộng
  `MongoGatewayOutputPort` trước, rồi mới implement trong gateway.
- Mọi lỗi driver phải được dịch trong `mongo_gateway.py`, không để pymongo rò lên tầng trên.
- Test usecase bằng `FakeGateway` — assert vào **lời gọi gateway**, không assert vào kết quả giả.
- FE: component chỉ đọc slice và gọi action; state server nằm hết trong `store.ts`.
