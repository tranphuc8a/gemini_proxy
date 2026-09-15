# Kết quả — 4 nhóm lỗi (2026-09-15)

Nhánh: `task/260914`. Tài liệu ghi **nguyên nhân gốc**, **chỗ sửa**, **cách kiểm chứng**.

> ### Đính chính phiên trước
> Phiên 260914 tôi báo 8 test `test_proxy_controller.py` fail là do lệch phiên bản
> `respx`/`httpx`. **Sai.** Chúng đang bắt đúng lỗi #3 dưới đây. Giờ 631/631 test pass.

---

## 1. sql-administrator & mongo-administrator

### 1a. Session không sống lâu

**Nguyên nhân.** Store *không* có TTL — session vốn sống tới khi logout, đúng như
mong muốn. Vấn đề là **nơi lưu**: mirror là một file JSON, mà trên serverless file
đó nằm trong thư mục tạm riêng của từng instance. Request sau rơi vào instance
khác, không thấy session, user phải đăng nhập lại.

**Cách sửa.** Mirror trở thành pluggable như mọi store khác —
[`sessionstore/records.py`](backend/fastapi/src/adapter/output/sessionstore/records.py)
với `json` / `mysql` / `mongo`, chọn bằng `ADMIN_SESSION_BACKEND`. Một bảng
`admin_sessions` phục vụ cả hai administrator, tách nhau bằng cột `kind`.

Nội dung **không đổi**: mỗi bản ghi vẫn được niêm phong AES-GCM trước khi tới
module này, nên bảng không bao giờ chứa mật khẩu đọc được.

Đồng thời bọc lỗi ở cả hai chiều đọc/ghi: mirror hỏng thì **mất tính bền**, chứ
không được chặn việc đăng nhập đang diễn ra.

**Kiểm chứng.** 12 test trong `tests/adapter/output/sessionstore/` — mỗi test tạo
store, đăng nhập, **vứt store đi**, tạo store mới trên cùng backing và kiểm tra
session còn đó (đó là "restart" dưới góc nhìn của store). Gồm cả: đổi secret là
vô hiệu hoá session, và session của SQL không lọt sang MongoDB.

### 1b. Backup & restore

Không dùng `mysqldump`/`mongodump` được — process không có client binary và trên
serverless cũng không có chỗ cài. Nên dump được dựng từ chính các truy vấn mà
server đã trả lời.

| | sql-administrator | mongo-administrator |
|---|---|---|
| Định dạng | `.sql` | Extended JSON |
| Gồm | bảng, dữ liệu, view, function/procedure | document, index |
| Tuỳ chọn | schema/data/view/routine riêng biệt, `DROP IF EXISTS`, giới hạn dòng | document/index riêng biệt, giới hạn document |
| Restore | chạy từng câu, báo lỗi theo câu | chèn theo lô 500, báo lỗi theo collection |

**Ba lỗi chỉ MySQL thật mới lộ ra** (SQLite trong test suite không thể bắt được):

1. **`sql_require_primary_key`.** `set_primary_key` làm drop-rồi-add bằng 2 câu.
   Server quản lý (Aiven) từ chối bước drop, nên bước add báo *"Multiple primary
   key defined"* — thông báo chẳng liên quan gì tới lỗi thật. Giờ gộp thành **một
   câu ALTER**: `DROP PRIMARY KEY, ADD PRIMARY KEY (...)`. Bảng không bao giờ ở
   trạng thái thiếu khoá, và thao tác trở thành nguyên tử.
2. **`ANSI_QUOTES`.** Server này chạy với `ANSI_QUOTES`, nên `SHOW CREATE TABLE`
   sinh `"authors"` chứ không phải `` `authors` ``. Dump lại ghi đè
   `SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO'`, xoá mất `ANSI_QUOTES` — **dump không
   đọc lại được bằng chính nó**. Giờ sql_mode của server đi kèm dump, như mysqldump.
3. **Restore xoá nhầm database nguồn.** Dump ghi
   `DROP VIEW IF EXISTS \`db_nguồn\`.\`v\``. Restore vào database **khác** sẽ đi
   xoá view/routine của database **gốc**. Giờ mọi tên trong dump đều không
   qualify schema — `USE` quyết định nơi đến, và dump chuyển được giữa các schema.

Restore là thao tác phá huỷ nên có hai lớp chặn: UI bắt gõ đúng tên database, và
server **độc lập** từ chối nếu `confirm_database` không khớp mục tiêu.

### 1c. Cập nhật bảng, view, khoá, routine

22 usecase + 22 endpoint mới. Mọi câu lệnh được **ráp từ các phần đã kiểm tra**,
không bao giờ từ chuỗi của client — endpoint duy nhất nhận SQL thô là `/query`,
và một form dựng DDL không được phép trở thành cái thứ hai.

- **Bảng**: tạo, đổi tên, thêm/sửa/xoá cột (dùng `CHANGE COLUMN` nên đổi tên cột
  cũng làm ở đây), đặt vị trí `FIRST`/`AFTER`.
- **Khoá & index**: đặt/xoá khoá chính (giữ đúng **thứ tự cột** — khoá (a,b) khác
  khoá (b,a) vì quy tắc tiền tố trái), tạo/xoá index và khoá ngoại kèm
  `ON DELETE`/`ON UPDATE`.
- **View**: liệt kê, đọc định nghĩa, tạo/thay thế, xoá. Thân view bị ép phải là
  **đúng một câu SELECT**.
- **Routine**: liệt kê function/procedure kèm tham số, đọc thân, tạo/thay thế,
  xoá, gọi procedure. Endpoint này nhận SQL nguyên khối (thân routine là một câu
  chứa đầy dấu chấm phẩy, không thể ráp từ các mảnh) nên **được kiểm**: chỉ chấp
  nhận `CREATE FUNCTION`/`CREATE PROCEDURE`.
- **Trigger**: chỉ xem.

Cái không thể kiểm tự động được (kiểu cột, giá trị mặc định) thì kiểm **hình
dạng**: [`sql_ddl.py`](backend/fastapi/src/domain/utils/sql_ddl.py) chấp nhận
`DECIMAL(10,2) UNSIGNED` và `ENUM('a','b')` nhưng từ chối `INT; DROP TABLE users`.

**Giao diện.** Hai tab mới trong sql-administrator:
- **Objects** — view / function & procedure / trigger.
- **Backup** — sao lưu và phục hồi, có cảnh báo khi dump bị cắt bớt.
- **Structure** thêm khối "Sửa cấu trúc": thêm/sửa/xoá cột, khoá chính, index, FK.

mongo-administrator thêm tab **Backup**.

---

## 2. light-grid v2 và v3

**Nguyên nhân chính — một dòng CSS.** `light-grid-shared/theme.css` thiếu
`[hidden] { display: none !important }`. Thuộc tính `hidden` dựa vào rule của
user-agent, mà `.card { display: flex }` là một class nên **thắng**. Hậu quả:

- **v3 hiện cả 6 tab chồng lên nhau** — đúng cái "vỡ hình" được báo;
- v2 hiện panel "Băng ghi" khi chưa ghi gì.

v1 không dính vì nó dùng `style.display` thay cho `hidden`.

**Lỗi thứ hai — bảng màu không theo theme.** Ô "tắt" dùng màu tối cố định, nên ở
theme sáng số trên ô gần như không đọc được. Giờ mỗi bảng màu có cặp
`off`/`offLight`, và **màu chữ được suy ra từ độ sáng của chính ô** (hệ số WCAG),
nên đúng cho mọi tổ hợp bảng màu × theme — kể cả bảng "Giấy", vốn là bàn cờ sáng
nằm trên theme tối.

**Công cụ FE đã áp dụng.** Không unit test nào thấy được lỗi bố cục, nên tôi thêm
[`scripts/audit-webapps.mjs`](scripts/audit-webapps.mjs): mở app thật trong
Chromium, bấm **mọi nút**, chọn **mọi option**, chuyển **mọi tab**, ở 2 kích thước
màn hình, rồi kiểm 4 bất biến — không có gì `hidden` mà vẫn hiện, không cuộn
ngang, mỗi lúc chỉ một tab panel hiện, không control nào ném lỗi.

Chính script này tìm ra cả hai lỗi trên. Playwright **không** phải dependency của
repo (không có `package.json` ở root, và tải ~100MB browser là quá đáng với một
checkout chỉ cần backend) — chạy bằng:

```bash
npm i -D playwright && npx playwright install chromium   # ở thư mục bất kỳ
NODE_PATH=/đường/dẫn/node_modules node scripts/audit-webapps.mjs
```

---

## 3. postman-lite-pro gọi API qua backend bị lỗi

**Nguyên nhân.** [`http_proxy_usecase.py`](backend/fastapi/src/application/usecases/http_proxy_usecase.py)
gọi `validate_target(request.url)` — hàm này trả về **hostname**, không phải URL —
rồi đưa thẳng kết quả vào `httpx.request()`. httpx đọc `api.example.com` như một
đường dẫn **tương đối** và gửi request tới `/api.example.com`. Mọi lệnh gọi qua
proxy đều hỏng.

**Cách sửa.** Tách hai việc: validate trả lời "có được phép gọi không", còn URL để
gọi vẫn là URL client gửi. Docstring của `validate_target` giờ nói rõ nó **không**
trả về URL, kèm lý do.

15/15 test proxy pass.

---

## 4. Mongo option hoạt động thật

Không có bug API — đã đối chiếu `pymongo 4.18.1` (`find` là sync trả cursor, còn
lại là coroutine): code khớp. Ba việc đã làm để nó thật sự dùng được:

1. **Client cache theo event loop, không theo process.** Một `AsyncMongoClient`
   gắn với loop tạo ra nó; dùng lại qua loop khác sẽ báo *"Event loop is closed"*
   hoặc treo. Uvicorn chạy dài chỉ có một loop, nhưng serverless, `asyncio.run` và
   pytest thì mỗi thứ một loop — đúng những môi trường lỗi này xuất hiện.
2. **Endpoint kiểm tra kết nối thật.**
   [`storage_controller.py`](backend/fastapi/src/adapter/input/controllers/storage_controller.py):
   `GET /storage/backends` **kết nối** chứ không đọc config, và
   `POST /storage/mongo/ping` là nút "test connection". Lỗi trả về **nguyên văn
   của driver**: "Authentication failed", "getaddrinfo ENOTFOUND" và "connection
   refused" cần ba cách sửa khác nhau, chỉ văn bản gốc mới nói được là cái nào.
3. **Cả ba picker giờ nói thật.** `/markdown/backends`, `/postman/backends` và
   `/graphs/_backends` đều uỷ quyền cho kiểm tra trên. Trước đây báo "available"
   chỉ vì `MONGO_URI` có giá trị — URI sai thì mãi tới lúc save đầu tiên mới biết.

Backend JSON cũng tự báo khi nó nằm trong thư mục tạm, kèm cảnh báo dữ liệu
**không bền** qua mỗi lần deploy.

**Còn lại phía bạn:** đặt `MONGO_URI` (+ `MONGO_DATABASE`) trong `.env`. Máy này
không có Docker/MongoDB local nên tôi **chưa chạy được kiểm chứng đầu-cuối thật**
với Mongo — đường đi được phủ bằng `tests/support/fake_mongo.py`. Sau khi đặt URI,
bấm "test connection" trong app hoặc gọi `POST /storage/mongo/ping`.

---

## Kiểm thử

| Nơi | Kết quả |
|---|---|
| Backend (`pytest`) | **631 pass, 0 fail** |
| MySQL 8.4.8 thật (`tools/live_sqladmin_check.py`) | **34/34 pass** |
| sql-administrator | 134 pass |
| mongo-administrator | 166 pass |
| markdown-editor | 206 pass |
| graphuc | 117 pass |
| postman-lite | 67 pass |
| Audit trình duyệt (8 app × 2 kích thước) | 2 findings (xem dưới) |
| Lint + typecheck mọi app | sạch |

### Kiểm chứng trên MySQL thật

[`backend/fastapi/tools/live_sqladmin_check.py`](backend/fastapi/tools/live_sqladmin_check.py)
chạy trong database dùng-một-lần `gp_sqladmin_selftest` và **xoá nó trong
`finally`** — các schema sẵn có không bị đụng tới. 34 kiểm tra phủ toàn bộ DDL,
view, routine và một vòng backup → restore → so sánh.

```bash
cd backend/fastapi
PYTHONPATH=. .venv/Scripts/python.exe tools/live_sqladmin_check.py
```

Suite unit chạy trên SQLite — đó là lý do nó nhanh và không cần cài gì, và cũng là
lý do nó không thể bắt ba lỗi ở mục 1b.

---

## Việc còn mở

- **Hai lỗi responsive có sẵn**, audit phát hiện, **ngoài phạm vi lần này** nên
  tôi chưa sửa: `markdown-editor-pro` cuộn ngang 178px và `postman-lite-pro` cuộn
  ngang 276px ở màn hình 420px.
- **Mongo chưa được kiểm chứng đầu-cuối thật** (xem mục 4).
- Trigger mới chỉ xem được; tạo/sửa trigger cần `DELIMITER` nên vẫn phải dùng tab
  Console.
- Dump không bao gồm user và grant — `information_schema` không cho biết những
  thứ đó theo cách dùng được ở đây.

## Cấu hình mới

```
ADMIN_SESSION_BACKEND=json     # json | mysql | mongo — dùng mysql/mongo trên serverless
MONGO_URI=                     # để trống là mongo option báo không dùng được
MONGO_DATABASE=gemini_proxy
```

Giải thích đầy đủ nằm trong `backend/fastapi/.env.example`.

## Tệp mới đáng nhớ

```
backend/fastapi/src/adapter/output/sessionstore/records.py    # session bền qua restart
backend/fastapi/src/adapter/input/controllers/storage_controller.py  # kiểm tra kết nối thật
backend/fastapi/src/domain/utils/sql_ddl.py                   # ráp DDL từ phần đã kiểm
backend/fastapi/src/domain/utils/sql_dump.py                  # viết/đọc dump, hiểu DELIMITER
backend/fastapi/tools/live_sqladmin_check.py                  # kiểm chứng trên MySQL thật
scripts/audit-webapps.mjs                                     # audit webapp bằng trình duyệt
sql-administrator/src/components/{ObjectsView,BackupView,SchemaEditor}.tsx
mongo-administrator/src/components/BackupView.tsx
```
