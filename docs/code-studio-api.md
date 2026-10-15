# Code Studio — API chạy mã (`/run`) và kho đoạn mã (`/codestore`)

Backend cho trình soạn thảo mã trên web. Hai việc độc lập:

* **`/run`** — biên dịch và chạy mã qua một "nhà cung cấp" do **người dùng chọn** cho từng lần chạy.
* **`/codestore`** — lưu "đoạn mã" (1 tệp) và "dự án" (nhiều tệp) trên máy chủ, đồng bộ giữa các thiết bị.
  Lưu ở `localStorage` của trình duyệt thì **không liên quan backend**; chạy bằng Clang-WASM trong trình duyệt cũng vậy.

Tiền tố là `settings.API_PREFIX` (mặc định `/api/v1`). Thành công trả **JSON trần** (như `/ai/*`); lỗi trả phong bì chung
`{status_code, message, data: {code, …}}` — client phân biệt lỗi bằng `data.code`, người đọc thông báo tiếng Việt ở `message`.
Mọi phản hồi có `Cache-Control: no-store`.

Mã nguồn: `controllers/run_controller.py`, `usecases/run_usecase.py`, `adapter/output/run/*`;
`controllers/codestore_controller.py`, `usecases/codestore_usecase.py`, `adapter/output/codestore/*`.

---

## 1. `/run`

Backend triển khai trên Vercel (serverless: không có g++/javac, không sandbox được), nên có 4 adapter cho cổng ra
`CodeExecutorPort`:

| id | `kind` | Là gì | Nhiều tệp | `compileArgs` | Giới hạn thời gian |
|---|---|---|---|---|---|
| `piston` | remote | [Piston](https://github.com/engineer-man/piston), mặc định máy công cộng emkc.org | mọi ngôn ngữ | **bỏ qua** (Piston không có) | theo `runTimeoutMs`/`compileTimeoutMs` |
| `judge0` | remote | Judge0 CE (phải tự đặt `RUN_JUDGE0_URL`) | c, cpp, java, python, javascript, ruby, php, bash (chế độ multi-file: zip + `language_id` 89) | có (`compiler_options`) | chỉ `runTimeoutMs`; không có hạn biên dịch riêng |
| `wandbox` | remote | wandbox.org, không cần khoá | c, cpp, python | có (`compiler-option-raw`) | cố định của dịch vụ, bỏ qua cả hai |
| `local` | local | chương trình **cài trên máy chủ** (g++, gcc, javac+java, python, node) | có | có (chỉ C/C++) | có |

### `GET /run/providers` (công khai, không gọi mạng ra ngoài)

```json
{"providers": [{"id": "piston", "label": "Piston", "kind": "remote", "available": true, "reason": "",
                "languages": ["c","cpp","java","python","javascript","typescript","go","rust","csharp","kotlin","php","ruby","bash"],
                "multiFile": true, "multiFileLanguages": ["c","cpp", "…"], "needsSession": false}, …],
 "default": "piston"}
```

`available:false` kèm `reason` tiếng Việt (chưa đặt `RUN_JUDGE0_URL`, `local` chưa bật hoặc không thấy trình biên dịch,
`RUN_ENABLED=false`…). `languages` là những gì provider **thật sự** chạy được (Wandbox không có Kotlin; `local` chỉ có cái nào
tìm thấy trên máy). `multiFileLanguages` là các ngôn ngữ nhận > 1 tệp; `default` là `RUN_DEFAULT_PROVIDER` nếu dùng được, nếu
không thì provider dùng được đầu tiên. `needsSession:true` = cần phiên quản trị (`local`).

### `POST /run`

```json
{"provider": "piston", "language": "cpp",
 "files": [{"name": "main.cpp", "content": "…"}, {"name": "src/util.h", "content": "…"}],
 "mainFile": "main.cpp", "stdin": "", "args": [], "compileArgs": ["-std=c++20", "-O2"],
 "runTimeoutMs": 5000, "compileTimeoutMs": 15000}
```

| Trường | Quy tắc |
|---|---|
| `provider` | **id** (≤ 32 ký tự), không phân biệt hoa/thường. Client không bao giờ gửi URL (chống SSRF) |
| `language` | `c cpp java python javascript typescript go rust csharp kotlin php ruby bash`; nhận cả bí danh (`C++`, `py`, `js`, `c#`, `sh`…) |
| `files` | 1–64 tệp; mỗi tệp ≤ 128 KB, tổng ≤ 256 KB (đếm **byte** UTF-8). Tên chỉ `[A-Za-z0-9_.-]` + `/` cho thư mục con (≤ 8 cấp); cấm `..`, đường dẫn tuyệt đối, `\`, ký tự lạ, thành phần bắt đầu bằng `-` hoặc kết thúc bằng `.`, tên thiết bị Windows (`CON`, `NUL`…), trùng tên (không phân biệt hoa/thường), tệp trùng tên thư mục → `400 run_bad_file` |
| `mainFile` | tệp vào chương trình; mặc định theo quy ước (`main.cpp`, `Main.java`, `main.py`…), rồi tệp đầu có đuôi đúng ngôn ngữ |
| `stdin` | ≤ 64 KB |
| `args` | ≤ 16 phần tử, mỗi cái ≤ 200 ký tự, không chứa NUL; **không bao giờ qua shell** |
| `compileArgs` | ≤ 16; **chỉ** các cờ trong danh sách cho phép (dưới đây), cờ khác → `400 run_bad_flag` (kèm `data.flag`) |
| `runTimeoutMs` / `compileTimeoutMs` | mặc định 5000 / 15000, **trần** 15000 / 30000 (vượt thì cắt xuống trần), sàn 100 |

Cờ biên dịch được phép: `-std=<id>`, `-O0 -O1 -O2 -O3`, `-Wall`, `-Wextra`, `-Wpedantic`, `-pedantic`, `-Werror`, `-g`, `-pthread`,
`-lm`, `-D<TÊN>[=giá trị]` (giá trị chỉ `[A-Za-z0-9_.+-]`), `-I<thư mục tương đối>` (không `..`, không bắt đầu `/`).
Mọi cờ khác (`-include`, `-o`, `-Wl,…`, `-fplugin=…`, `-x`, `-L`…) bị từ chối vì một cờ biên dịch là một dạng mã.

**Phản hồi 200** (cả khi mã của người dùng lỗi):

```json
{"ok": true, "provider": "piston", "language": "cpp", "version": "10.2.0",
 "compile": {"ran": true, "ok": true, "stdout": "", "stderr": "", "code": 0, "signal": null, "ms": 412, "timedOut": false, "truncated": false},
 "run":     {"ran": true, "ok": true, "stdout": "42\n", "stderr": "", "code": 0, "signal": null, "ms": 3, "timedOut": false, "truncated": false},
 "error": null, "warnings": []}
```

* `compile` là `null` với ngôn ngữ thông dịch. Biên dịch hỏng → `compile.ok=false`, `run.ran=false`.
* `error` khác `null` khi `ok=false`: `compile_error`, `compile_timeout`, `run_timeout`, `runtime_error` (kèm `message` tiếng Việt).
  Chương trình in nhiều (đã cắt) mà thoát 0 vẫn là `ok:true` với `truncated:true`.
* Mỗi luồng `stdout`/`stderr` giữ tối đa **1 MiB**, phần thừa bị cắt và đặt `truncated:true` (với mọi provider).
* `warnings`: điều provider không làm được (ví dụ Piston bỏ qua `compileArgs`).
* `ms`: thời gian provider báo; nếu không báo thì là thời gian cả lần gọi (gồm mạng) cho `run`, và 0 cho `compile`.

**Lỗi** (phong bì chung):

| HTTP | `data.code` | Khi nào |
|---|---|---|
| 400 | `run_unknown_provider`, `run_language_unsupported`, `run_bad_file`, `run_too_large`, `run_bad_arg`, `run_bad_flag`, `run_no_source`, `run_multifile_unsupported` | yêu cầu sai |
| 403 | `admin_required` | provider `local` mà không có phiên quản trị (`X-Admin-Session` hoặc `X-Admin-Key`) |
| 422 | — | sai kiểu / vượt độ dài của schema (chưa vào use case) |
| 429 | `run_rate_limited` (kèm `Retry-After`, `data.retryAfter`), `run_busy` (`local`: đang chạy 2 lần cùng lúc) | quá nhiều lượt |
| 503 | `run_disabled` (`RUN_ENABLED=false`), `run_provider_disabled` (provider chưa dùng được; `message` là lý do) | |
| 502 | `run_provider_unavailable` (sập, 5xx, phản hồi không đọc được), `run_provider_rejected` (từ chối: sai khoá, bị giới hạn tốc độ, runtime lạ…) | lỗi hạ tầng |
| 504 | `run_provider_timeout` | provider trả lời quá chậm |

Lỗi 502/504 có `data.provider` và, nếu có, `data.detail` (câu của provider đã **xoá URL và khoá**, ≤ 200 ký tự). Không bao giờ
lộ khoá hay địa chỉ nội bộ. Giới hạn theo địa chỉ: `RUN_RATE_PER_MIN` (mặc định 20/phút/IP; phiên quản trị được miễn).
Mã nguồn người dùng **không bị ghi log**.

### Mô hình bảo mật của `/run`

1. **Provider chọn bằng id**, địa chỉ nằm trong cấu hình máy chủ → client không biến backend thành cổng tới host tuỳ ý.
2. **Không gì tới provider mà chưa được kiểm**: tên tệp, kích thước, cờ biên dịch (danh sách cho phép), NUL trong tham số.
3. **Provider từ xa** tự cách ly mã; backend chỉ chuyển tiếp. Phản hồi bị cắt ở 1 MiB mỗi luồng.
4. **`local` KHÔNG phải sandbox.** Nó chạy mã tuỳ ý **với quyền của người dùng chạy backend** (tệp, mạng, khoá `.env` đều trong
   tầm với). Vì vậy: mặc định **tắt** (`RUN_LOCAL_ENABLED=false`); khi bật vẫn **bắt buộc phiên quản trị**; tuyệt đối đừng bật trên
   máy chủ mà người lạ truy cập được. Những gì nó làm chỉ để tránh tai nạn, không chống kẻ xấu:
   thư mục tạm riêng mỗi lần chạy (xoá sau, kể cả khi lỗi) · `subprocess` với **list**, không shell · môi trường sạch (`PATH` tối thiểu,
   `HOME`/`TMP` trỏ vào thư mục tạm; không kế thừa khoá API) · quá giờ → giết **cả cây tiến trình** (`killpg` / `taskkill /T`) ·
   đọc đầu ra có chặn 1 MiB · POSIX có thêm `rlimit` (core, CPU, kích thước tệp, số tệp mở, bộ nhớ cho chương trình native —
   Windows không có) · tối đa 2 lần chạy đồng thời. Không có chặn mạng, không chặn tiến trình con, không chroot/container.
5. Chạy `local` bằng `subprocess` trong luồng riêng (không dùng asyncio subprocess, vốn không chạy trên vòng lặp Selector mà
   uvicorn chọn trên Windows khi `--reload`).

### Dựng provider tự chủ bằng Docker

**Piston** (khuyên dùng: không phụ thuộc máy công cộng, tự nâng hạn thời gian):

```bash
docker run --privileged -dit -p 2000:2000 -v piston-data:/piston --name piston \
  -e PISTON_RUN_TIMEOUT=15000 -e PISTON_COMPILE_TIMEOUT=30000 -e PISTON_RUN_CPU_TIME=15000 -e PISTON_COMPILE_CPU_TIME=30000 \
  ghcr.io/engineer-man/piston
for l in gcc python node java; do curl -s -X POST localhost:2000/api/v2/packages -H 'Content-Type: application/json' \
  -d "{\"language\":\"$l\",\"version\":\"*\"}"; done          # cài runtime (gcc = c + c++)
# backend:  RUN_PISTON_URL=http://localhost:2000/api/v2      (adapter gọi {RUN_PISTON_URL}/execute)
```

**Judge0 CE** (cần cgroup v1 với bản 1.13; xem tài liệu Judge0 nếu máy dùng cgroup v2):

```bash
wget https://github.com/judge0/judge0/releases/download/v1.13.1/judge0-v1.13.1.zip && unzip judge0-v1.13.1.zip && cd judge0-v1.13.1
# sửa judge0.conf: POSTGRES_PASSWORD, REDIS_PASSWORD; muốn có khoá thì AUTHN_HEADER=X-Auth-Token và AUTHN_TOKEN=<khoá>
docker-compose up -d db redis && sleep 10 && docker-compose up -d
# backend:  RUN_JUDGE0_URL=http://localhost:2358  RUN_JUDGE0_KEY=<khoá>  RUN_JUDGE0_KEY_HEADER=X-Auth-Token
```

Id ngôn ngữ Judge0 khác nhau giữa các bản: mặc định là của CE 1.13.0 (`cpp=54`, `python=71`…); đổi bằng
`RUN_JUDGE0_LANGUAGE_IDS=cpp=105,c=103,python=100` (xem `GET /languages` của máy bạn). Tên compiler Wandbox đổi khi họ gỡ bản
cũ: ghi đè bằng `RUN_WANDBOX_COMPILERS=cpp=gcc-head`.

**`local` trên laptop**: `RUN_LOCAL_ENABLED=true` và đặt `COURSE_ADMIN_KEY` (để có phiên quản trị); tìm trình biên dịch trong `PATH`,
hoặc chỉ rõ bằng `RUN_LOCAL_GXX=C:\devtools\mingw64\bin\g++.exe`…

---

## 2. `/codestore`

Không có tài khoản: một **không gian làm việc** = `workspaceId` + **khoá bí mật** (như `/spending`). Khoá sinh ngẫu nhiên
(`secrets.token_urlsafe(24)`), trả **một lần** khi tạo, máy chủ chỉ lưu SHA-256. Mỗi kho (`json`, `mysql`, `mongo`) là một nơi
riêng: không gian tạo ở kho nào chỉ tồn tại ở kho đó. Chọn kho bằng `?backend=json|mysql|mongo`, mặc định `CODESTORE_STORAGE_BACKEND`.

Một **bản ghi** (`item`):

```json
{"id": "k9x2…", "kind": "snippet", "name": "Sắp xếp nổi bọt", "language": "cpp",
 "files": [{"path": "main.cpp", "content": "…"}], "meta": {"tuỳ": "ý ≤ 8 KB"},
 "updatedAt": 1790000000000, "deleted": false}
```

Máy chủ thêm `serverUpdatedAt` (đồng hồ máy chủ lúc lưu) khi trả về. `id` khớp `[A-Za-z0-9_.:-]{1,80}`; `kind` là `snippet`
(đúng 1 tệp) hoặc `project` (1–200 tệp); `language` ≤ 32 ký tự `[A-Za-z0-9_+#.-]`; `name` ≤ 200 ký tự, không ký tự điều khiển;
`updatedAt` do **thiết bị** đặt (mili giây). Đường dẫn tệp được chuẩn hoá (`\` → `/`, bỏ `./` và `//`) và bị từ chối nếu có
`..`, tuyệt đối (`/x`, `C:\x`), kết thúc bằng `/`, ký tự điều khiển, hoặc trùng nhau (không phân biệt hoa/thường). Bản ghi
`deleted:true` là **bia mộ**: máy chủ bỏ `files` và `meta`, giữ phần còn lại.

| Endpoint | Khoá | Việc |
|---|---|---|
| `GET /codestore/backends` | — | `{"default": "json", "backends": [{"id","label","available","reason","persistent"}]}` — kiểm bằng cách **kết nối thật**, không lộ tên host/DB/lỗi driver. `persistent:false` = dữ liệu mất khi máy chủ khởi động lại (JSON trong thư mục tạm) |
| `POST /codestore/workspaces?backend=` | — | `201 {"workspaceId": "cs_…", "key": "…"}`; `CODESTORE_WORKSPACES_PER_HOUR` lần/IP/giờ |
| `GET /codestore/{id}/items?since=<ms>&limit=` | `X-Codestore-Key` | `{"items": […], "serverTime": <ms>, "more": false}` — bản ghi có `serverUpdatedAt > since` |
| `PUT /codestore/{id}/items` | `X-Codestore-Key` | thân `{"items": […]}` (≤ 100 bản ghi/lần, mỗi bản ≤ 512 KB, tổng ≤ 2 MB) → `{"items": […], "serverTime": <ms>}` |
| `DELETE /codestore/{id}` | `X-Codestore-Key` | `{"deleted": true}` — xoá cả không gian |

Khoá cũng nhận ở `Authorization: Bearer <khoá>`. `workspaceId` khớp `[A-Za-z0-9_-]{1,64}` (sai → 422).

**Gộp (`PUT`)** — theo từng bản ghi, *last-writer-wins*, do **kho** thực hiện nguyên tử (không phải đọc-so-ghi ở use case):

* `updatedAt` lớn hơn thắng. **Hoà `updatedAt`**: bia mộ thắng bản sửa; còn lại giữ bản đang lưu (đẩy lại cùng một bản ghi không đổi gì).
  *(Chú ý: đề bài ghi "hoà thì `id` lớn hơn", nhưng hai bản của cùng một bản ghi có cùng `id` nên luật đó không phân định được; đã thay bằng luật trên.)*
* Bản sửa **mới hơn** bia mộ thì làm sống lại bản ghi; bản sửa **cũ hơn** bia mộ thì bị bỏ.
* Cùng một `id` hai lần trong một yêu cầu: giữ bản thắng theo luật trên.
* Một bản ghi sai làm cả yêu cầu bị từ chối, không lưu gì.
* Phản hồi `items` là **bản mà máy chủ đang giữ** cho các `id` vừa gửi (kể cả khi nó khác bản bạn gửi) — thiết bị nhận lấy bản đó.

**Đồng bộ (`GET`)** — lần đầu `since=0` (hoặc bỏ qua), các lần sau gửi lại nguyên `serverTime` của lần trước:

* `since` so với `serverUpdatedAt` (đồng hồ máy chủ), **không** phải `updatedAt` của thiết bị: bản sửa cũ nhưng đẩy lên muộn vẫn tới.
* `serverTime` **lùi 2 giây** so với đồng hồ thật: một lần ghi bắt đầu trước lúc hỏi nhưng lưu sau lúc hỏi sẽ không bị bỏ sót.
  Hệ quả: bản ghi vừa lưu trong 2 giây gần nhất có thể xuất hiện lại ở lần hỏi sau — vô hại vì gộp là idempotent.
* **Phân trang**: tối đa 200 bản ghi và ~3 MB một lần. Khi còn nữa, `more:true` và `serverTime` là **con trỏ** (`serverUpdatedAt`
  của bản cuối) — gọi lại ngay với `since=serverTime` cho tới khi `more:false`. Một lần `PUT` gán `serverUpdatedAt` khác nhau cho
  từng bản ghi để ranh giới trang không cắt ngang hai bản cùng mốc.

**Hạn mức**: tối đa `CODESTORE_MAX_ITEMS` (2000) bản ghi / không gian, **tính cả bia mộ**. Đầy thì bia mộ cũ hơn
`CODESTORE_TOMBSTONE_DAYS` (90 ngày) bị dọn để lấy chỗ; vẫn đầy → `400 codestore_workspace_full`. Cập nhật bản ghi đã có luôn được.
Một thiết bị offline quá thời hạn bia mộ có thể làm bản ghi đã xoá sống lại (không còn bia mộ để chặn) — chấp nhận được.
Nhập sai khoá: 20 lần / 10 phút / IP rồi `429` (kể cả khoá đúng, trong thời gian chờ).

| HTTP | `data.code` |
|---|---|
| 400 | `codestore_bad_item` (kèm `itemId`), `codestore_bad_clock` (đồng hồ thiết bị lệch hơn 1 ngày), `codestore_too_large`, `codestore_workspace_full`, `codestore_bad_backend` |
| 401 | `codestore_key_required`, `codestore_bad_key` |
| 404 | `codestore_not_found` (trả trước 401, như `/spending`) |
| 422 | sai schema: quá 100 bản ghi, bản ghi > 512 K ký tự, `id`/`kind`/`language` sai dạng… |
| 429 | `codestore_rate_limited` (kèm `Retry-After`) |
| 503 | `codestore_backend_unavailable` (chọn `mongo` khi chưa có `MONGO_URI`) |

**Lưu trữ**: `json` — tệp `CODESTORE_JSON_FILE` qua `data_paths` (trên serverless là thư mục tạm, chỉ là nháp);
`mysql` — bảng `codestore_workspaces`, `codestore_items` tự tạo `CREATE TABLE IF NOT EXISTS` (không Alembic); `mongo` — collection cùng tên,
bản ghi lưu thành chuỗi JSON `payload_json` để khoá `$`/`.` trong `meta` không bị Mongo hiểu nhầm.

---

## 3. Biến môi trường

Đều có mặc định an toàn trong `Settings`, mẫu ở `backend/fastapi/.env.example`.

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `RUN_ENABLED` | `true` | công tắc tắt toàn bộ `/run` |
| `RUN_DEFAULT_PROVIDER` | `piston` | provider mặc định (nếu dùng được) |
| `RUN_PISTON_URL` / `RUN_PISTON_KEY` | `https://emkc.org/api/v2/piston` / rỗng | khoá gửi ở header `Authorization` |
| `RUN_JUDGE0_URL` / `RUN_JUDGE0_KEY` / `RUN_JUDGE0_KEY_HEADER` | rỗng / rỗng / `X-Auth-Token` | rỗng = chưa cấu hình |
| `RUN_JUDGE0_LANGUAGE_IDS` | rỗng | ghi đè id, `cpp=105,python=100` |
| `RUN_WANDBOX_URL` / `RUN_WANDBOX_COMPILERS` | `https://wandbox.org/api` / rỗng | ghi đè tên compiler |
| `RUN_LOCAL_ENABLED` | `false` | bật `local` (**không phải sandbox**, cần phiên quản trị) |
| `RUN_LOCAL_GCC` `_GXX` `_JAVAC` `_JAVA` `_PYTHON` `_NODE` | rỗng (tìm trong `PATH`) | đường dẫn công cụ |
| `RUN_RATE_PER_MIN` | `20` | lượt chạy / phút / IP |
| `RUN_HTTP_TIMEOUT_S` | `30` | trần cho một lần gọi HTTP tới provider (thực tế = min(trần, biên dịch + chạy + 5 s)) |
| `CODESTORE_STORAGE_BACKEND` | `json` | kho mặc định |
| `CODESTORE_JSON_FILE` | `data/codestore.json` | |
| `CODESTORE_MAX_ITEMS` | `2000` | bản ghi / không gian |
| `CODESTORE_WORKSPACES_PER_HOUR` | `10` | không gian mới / IP / giờ |
| `CODESTORE_TOMBSTONE_DAYS` | `90` | tuổi tối thiểu để bia mộ bị dọn |

---

## 4. Giới hạn đã biết, điều chưa kiểm chứng

* **Chưa gọi thử provider ngoài nào thật.** Mọi test dùng `httpx.MockTransport`; hình dạng yêu cầu/phản hồi viết theo tài liệu của
  Piston/Judge0/Wandbox. Cần thử một lần với dịch vụ thật trước khi tin: nhất là Piston công cộng (có thể đòi khoá), id ngôn ngữ
  Judge0 của bản bạn dùng, tên compiler Wandbox, chế độ multi-file của Judge0 (các script `compile`/`run` giả định `g++`,
  `javac`, `python3`, `node`… có trong `PATH` của máy Judge0), và thư mục con trong tên tệp của Piston.
* Wandbox không có cờ "biên dịch hỏng": adapter suy ra từ việc phản hồi **không có trường `program_*`** mà `status` ≠ 0.
  Wandbox cũng không báo "quá giờ": coi là hết giờ khi bị kill sau ≥ 90% thời gian cho phép.
* Piston bỏ qua `compileArgs`; Judge0 không có hạn biên dịch riêng; Wandbox dùng giới hạn cố định của dịch vụ.
* `local`: không giới hạn bộ nhớ/tiến trình/mạng trên Windows; trên POSIX `rlimit` là phần chưa chạy thử trong bộ test này (chỉ chạy được
  trên Windows). Không phải sandbox — xem mục bảo mật.
* `PUT /codestore` trả lại **bản máy chủ đang giữ** cho các `id` đã gửi; nếu bản đó lớn hơn bản gửi (một thiết bị khác đã đẩy bản ≤ 512 KB),
  phản hồi có thể tới vài MB. Trường hợp thường gặp nhỏ hơn nhiều.
* `/run` đếm lượt trong bộ nhớ từng instance (như `/ai/*`): làm chậm lạm dụng, không chặn được kẻ tấn công phân tán.

## 5. Kiểm

```text
cd backend/fastapi
.venv/Scripts/python.exe -m pytest tests/application/test_run_inputs.py tests/application/test_run_usecase.py \
  tests/application/test_codestore_usecase.py tests/adapter/output/run tests/adapter/output/codestore \
  tests/adapter/input/controller/test_run_controller.py tests/adapter/input/controller/test_codestore_controller.py -q
```

`tests/adapter/output/run/test_run_local_executor.py` chạy chương trình thật (g++, gcc, javac+java, node, python) với mã nhỏ vô hại và
tự bỏ qua nhóm nào thiếu công cụ. Không test nào gọi mạng hay chạm MySQL/Mongo thật (SQLite trong bộ nhớ, `tests/support/fake_mongo.py`).
