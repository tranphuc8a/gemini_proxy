# Code Studio — API chạy mã (`/run`) và kho đoạn mã (`/codestore`)

Backend cho trình soạn thảo mã trên web. Hai việc độc lập:

* **`/run`** — biên dịch và chạy mã qua một "nhà cung cấp" do **người dùng chọn** cho từng lần chạy.
* **`/codestore`** — lưu "đoạn mã" (1 tệp) và "dự án" (nhiều tệp) trên máy chủ, đồng bộ giữa các thiết bị.
  Lưu ở `localStorage` của trình duyệt thì **không liên quan backend**; chạy bằng Clang-WASM trong trình duyệt cũng vậy.

Tiền tố là `settings.API_PREFIX` (mặc định `/api/v1`). Thành công trả **JSON trần** (như `/ai/*`); lỗi trả phong bì chung
`{status_code, message, data: {code, …}}` — client phân biệt lỗi bằng `data.code`, người đọc thông báo tiếng Việt ở `message`.
Mọi phản hồi có `Cache-Control: no-store`.

Mã nguồn: `controllers/run_controller.py`, `usecases/run_usecase.py`, `adapter/output/run/*`;
`controllers/codestore_controller.py`, `usecases/codestore_usecase.py`, `adapter/output/codestore/*`;
bộ đếm tốc độ: `ports/output/rate_limiter_port.py`, `utils/rate_limiter.py`, `adapter/output/ratelimit/*`, `adapter/factory/rate_limit_factory.py` (mục 3).

---

## 1. `/run`

Backend triển khai trên Vercel (serverless: không có g++/javac, không sandbox được), nên có 4 adapter cho cổng ra
`CodeExecutorPort`:

| id | `kind` | Là gì | Nhiều tệp | `compileArgs` | Giới hạn thời gian |
|---|---|---|---|---|---|
| `piston` | remote | [Piston](https://github.com/engineer-man/piston) **tự dựng** (máy công cộng emkc.org đã chỉ cho người trong danh sách trắng từ 15/02/2026 → mặc định để trống, tắt) | python, javascript (đã kiểm với Piston thật; gói `gcc`/`java` của Piston chỉ biên dịch tệp vào nên C/C++/Java nhiều tệp bị từ chối `run_multifile_unsupported`) | **bỏ qua** (Piston không có) | theo `runTimeoutMs`/`compileTimeoutMs` |
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
lộ khoá hay địa chỉ nội bộ. Giới hạn theo địa chỉ: `RUN_RATE_PER_MIN` (mặc định 20/phút/IP; phiên quản trị được miễn); đếm chung giữa các instance khi `RATE_LIMIT_BACKEND` là `database`/`mongo` (mục 3).
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

Tệp compose, script cài runtime và hướng dẫn nằm ở **`deploy/code-runner/`** (xem `README.md` ở đó: yêu cầu máy, bảo mật, lưu ý Windows/WSL2, gỡ cài).

```bash
# Piston — ĐÃ chạy thật (17/10/2026)
cd deploy/code-runner/piston && docker compose -p cs-piston up -d && ./cai-runtime.sh        # gcc python node java (thêm: ./cai-runtime.sh go rust)
# backend/fastapi/.env:  RUN_PISTON_URL=http://localhost:2000/api/v2      (adapter gọi {RUN_PISTON_URL}/execute)
RUN_PISTON_URL=http://localhost:2000/api/v2 backend/fastapi/.venv/Scripts/python.exe backend/fastapi/tools/kiem_nha_cung_cap_that.py piston
```

```bash
# Judge0 — compose + judge0.conf.example trong deploy/code-runner/judge0 (xem README ở đó). ĐÃ kiểm: các container lên, xác thực X-Auth-Token đúng (200) / sai (401).
# CHƯA chạy được mã trên máy thử: Judge0 1.13.x cần cgroup v1 (máy thử là cgroup v2 → bài nộp trả "Internal Error … /box/script.py").
cd deploy/code-runner/judge0 && cp judge0.conf.example judge0.conf   # đổi mật khẩu + AUTHN_TOKEN
docker compose -p cs-judge0 up -d db redis && sleep 10 && docker compose -p cs-judge0 up -d
# backend:  RUN_JUDGE0_URL=http://localhost:2358  RUN_JUDGE0_KEY=<AUTHN_TOKEN>  RUN_JUDGE0_KEY_HEADER=X-Auth-Token
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
 "files": [{"path": "main.cpp", "content": "…"}], "meta": {"tuỳ": "ý ≤ 32 KB"},
 "updatedAt": 1790000000000, "deleted": false}
```

`meta` là đối tượng tuỳ ý, **≤ 32 KB** (đo `json.dumps(meta, ensure_ascii=False)` theo byte UTF-8; tăng từ 8 KB ngày 17/10/2026 để chứa bộ test). Code Studio dùng các khoá
`mainFile`, `folders`, `std`, `opt`, `stdin`, `stdinTruncated`, `args`, `compileArgs`, `javaMain`, `openTabs`, `activeFile`, `pinned`, `tags`, **`tests`** (≤ 30 ca `{id,name,input,expected}`) và
**`testMode`** (`lines` mặc định bị bỏ khỏi meta; `tokens`/`float`/`exact`); khoá lạ được giữ nguyên. Khi quá giới hạn, client cắt dần: thẻ đang mở → khoá lạ → thẻ gắn nhãn → `stdin` → `folders` → `args` → `compileArgs` → **ca test cuối** (dữ liệu người dùng soạn tay đứng cuối).

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
| `DELETE /codestore/{id}` | `X-Codestore-Key` | `{"deleted": true}` — xoá cả không gian **và mọi liên kết chia sẻ của nó** |
| `POST /codestore/{id}/items/{itemId}/share` | `X-Codestore-Key` | tạo (hoặc làm mới) liên kết chia sẻ **chỉ đọc** → `201 {"token", "sharedAt", "updatedAt"}` (xem mục dưới) |
| `GET /codestore/{id}/shares` | `X-Codestore-Key` | `{"shares": [{"token","itemId","name","sharedAt","updatedAt"}]}` |
| `DELETE /codestore/{id}/items/{itemId}/share` | `X-Codestore-Key` | thu hồi → `{"revoked": true}` |
| `GET /codestore/shared/{token}` | **không cần khoá** | `{"item": {id, kind, name, language, files, meta, updatedAt}, "sharedAt"}` — bản **chụp** của bản ghi |

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
  từng bản ghi, và một trang **không bao giờ kết thúc giữa hai bản cùng `serverUpdatedAt`** (hai `PUT` rơi vào cùng vài mili-giây có
  thể đóng dấu trùng nhau, mà lần gọi sau hỏi "lớn hơn hẳn" con trỏ nên bản thứ hai sẽ rơi mất): trang đó ngắn đi cho tới trước
  nhóm trùng, nên một trang có thể ít hơn 200 bản dù `more:true`. *(Lỗi này lộ ra ở kiểm tích hợp ngày 17/10: 250 bản đẩy lên, 249 bản
  về — đã sửa, có test hồi quy.)*

**Hạn mức**: tối đa `CODESTORE_MAX_ITEMS` (2000) bản ghi / không gian, **tính cả bia mộ**. Đầy thì bia mộ cũ hơn
`CODESTORE_TOMBSTONE_DAYS` (90 ngày) bị dọn để lấy chỗ; vẫn đầy → `400 codestore_workspace_full`. Cập nhật bản ghi đã có luôn được.
Một thiết bị offline quá thời hạn bia mộ có thể làm bản ghi đã xoá sống lại (không còn bia mộ để chặn) — chấp nhận được.
Nhập sai khoá: 20 lần / 10 phút / IP rồi `429` (kể cả khoá đúng, trong thời gian chờ).

| HTTP | `data.code` |
|---|---|
| 400 | `codestore_bad_item` (kèm `itemId`), `codestore_bad_clock` (đồng hồ thiết bị lệch hơn 1 ngày), `codestore_too_large`, `codestore_workspace_full`, `codestore_bad_backend`, `codestore_too_many_shares` (kèm `limit`) |
| 401 | `codestore_key_required`, `codestore_bad_key` |
| 404 | `codestore_not_found` (trả trước 401, như `/spending`), `codestore_item_not_found` (chia sẻ bản ghi chưa có trên máy chủ hoặc đã xoá; kèm `itemId`), `codestore_share_not_found` (thu hồi bản ghi chưa chia sẻ; đọc token lạ / đã thu hồi) |
| 422 | sai schema: quá 100 bản ghi, bản ghi > 512 K ký tự, `id`/`kind`/`language` sai dạng, `itemId` sai dạng, token dài quá 100 ký tự… |
| 429 | `codestore_rate_limited` (kèm `Retry-After`): tạo không gian, nhập sai khoá, đọc liên kết chia sẻ quá nhanh, dò token |
| 503 | `codestore_backend_unavailable` (chọn `mongo` khi chưa có `MONGO_URI`) |

**Lưu trữ**: `json` — tệp `CODESTORE_JSON_FILE` qua `data_paths` (trên serverless là thư mục tạm, chỉ là nháp; liên kết chia sẻ nằm trong mục
`shares` của từng không gian, và chỉ mục token dựng lại trong bộ nhớ khi nạp);
`mysql` — bảng `codestore_workspaces`, `codestore_items`, `codestore_shares` tự tạo `CREATE TABLE IF NOT EXISTS` (không Alembic; `codestore_shares`:
khoá chính `token`, khoá duy nhất `(workspace_id, item_id)`); `mongo` — collection cùng tên (`codestore_shares` có `_id` = token và chỉ mục duy nhất
`(workspace_id, item_id)`), bản ghi và bản chụp lưu thành chuỗi JSON `payload_json` / `payload` để khoá `$`/`.` trong `meta` không bị Mongo hiểu nhầm.

### Liên kết chia sẻ chỉ đọc

Chủ không gian (người có khoá) gửi **một bản ghi** cho người không có khoá: một đường dẫn chứa `token`. Mỗi kho là một nơi riêng nên
liên kết phải **kèm `?backend=`** của kho đã tạo nó (mặc định như mọi điểm cuối khác).

| Việc | Chi tiết |
|---|---|
| Tạo | `POST …/{id}/items/{itemId}/share?backend=` (khoá). Chụp **bản đang lưu trên máy chủ** của bản ghi: phải tồn tại và chưa bị xoá, chưa đồng bộ lên máy chủ → `404 codestore_item_not_found`. Chưa có liên kết → `201`. Đã có → `200`, **làm mới bản chụp, giữ nguyên token và `sharedAt`**, `updatedAt` = lúc làm mới |
| Liệt kê | `GET …/{id}/shares` (khoá) → `shares`, mới chia sẻ nhất trước. `name` là tên lúc chụp |
| Thu hồi | `DELETE …/{id}/items/{itemId}/share` (khoá) → `{"revoked": true}`; chưa chia sẻ → `404 codestore_share_not_found`. Chia sẻ lại sau khi thu hồi cho token **mới** (token cũ chết hẳn) |
| Đọc | `GET …/shared/{token}?backend=` — **công khai, không khoá**. `Cache-Control: no-store` |

`GET …/shared/{token}` trả `{"item": {"id","kind","name","language","files":[{"path","content"}],"meta","updatedAt"}, "sharedAt"}`.
`meta` giữ những gì cần để chạy lại (`stdin`, `args`, `compileArgs`, `folders`…) nhưng **bỏ `pinned`, `openTabs`, `activeFile`** (trạng thái trình soạn của chủ).
Không có `workspaceId`, khoá, `deleted`, `serverUpdatedAt`. Token lạ, sai dạng và đã thu hồi đều trả **cùng một** `404 codestore_share_not_found`
với cùng một thông báo (không ai phân biệt được "chưa từng có" với "đã thu hồi").

* **Token** = `secrets.token_urlsafe(16)`: 128 bit ngẫu nhiên, 22 ký tự `[A-Za-z0-9_-]`. Chính nó là **khoá đọc**, nên lưu thô (chủ cần liệt kê lại để dựng liên kết) và
  **không bao giờ ghi log** (mã ứng dụng không log token; xem lưu ý về nhật ký truy cập của máy chủ HTTP ở mục bảo mật). Tra token là tra theo **chỉ mục** (khoá chính / `_id` / từ điển), không quét.
* **Thu hồi tự động**: một bản ghi bị xoá (`PUT` bia mộ thắng bản đang lưu — bia mộ thua một bản sửa mới hơn thì **không** thu hồi) và việc xoá cả không gian (`DELETE /codestore/{id}`) thu hồi mọi liên kết liên quan.
  Bản ghi sống lại sau khi xoá **không** làm liên kết cũ sống lại; phải chia sẻ lại.
* **Hạn mức**: tối đa `CODESTORE_MAX_SHARES` (50) liên kết đang hoạt động / không gian (vượt → `400 codestore_too_many_shares`; làm mới liên kết đã có thì không tính thêm); bản chụp ≤ 512 KB
  vì bản ghi nguồn đã ≤ 512 KB. Đọc công khai: `CODESTORE_SHARE_READS_PER_MIN` (120) lượt / phút / IP; đọc token **sai** 20 lần / 10 phút / IP rồi `429` (kể cả token đúng trong lúc chờ).
  Hai bộ đếm này **tách khỏi** bộ đếm khoá sai của không gian, để một liên kết đã thu hồi mà nhiều người cùng IP mở không khoá chủ ra khỏi không gian của mình.

**Mô hình bảo mật — ai đọc được gì**

| Người | Đọc được | Không đọc được |
|---|---|---|
| Có `workspaceId` + khoá | mọi bản ghi, mọi liên kết (kèm token), tạo/thu hồi liên kết | — |
| Có `token` | **một** bản chụp (tên, mã, `meta` chạy lại), tại thời điểm chủ chụp | các bản ghi khác, bản đang sửa, trạng thái trình soạn, không gian, khoá, hay danh sách liên kết |
| Chỉ có `workspaceId` | gì cũng không (cần khoá) | — |

Vì sao **bản chụp** thay vì liên kết sống tới bản ghi: (1) chủ chọn **lúc nào** công bố — đang gõ dở, dán nhầm khoá API vào mã, rồi xoá đi thì người nhận vẫn chỉ thấy bản đã chụp, và muốn đổi
phải chủ động chia sẻ lại; (2) liên kết sống buộc đường đọc công khai phải chạm vào bản đang đồng bộ giữa các thiết bị (gộp "thắng sau cùng", bia mộ), nên một lỗi ở đó lộ dữ liệu
chưa định công bố; bản chụp là một hàng tĩnh, không bao giờ đổi sau khi tạo cho tới lần chia sẻ lại; (3) đọc là một lần tra theo chỉ mục, không phụ thuộc trạng thái đồng bộ.
Cái giá: người nhận không thấy chỗ chủ sửa tiếp cho tới khi chủ chia sẻ lại (token giữ nguyên nên đường dẫn đã gửi vẫn dùng được).
Nhớ rằng **ai có token là đọc được** — như một liên kết "ai có đường dẫn" của Google Drive; muốn dừng thì thu hồi. Token nằm trong **đường dẫn** nên có thể xuất hiện trong nhật ký truy cập của proxy/máy chủ HTTP
(uvicorn, Vercel) và trong lịch sử trình duyệt; phía giao diện nên đặt token ở phần sau `#` của trang xem (không gửi tới máy chủ khi tải trang) hoặc `Referrer-Policy: no-referrer`.

---

## 3. Bộ đếm tốc độ dùng chung nhiều instance

Backend chạy serverless (Vercel, nhiều instance, mỗi instance một bộ nhớ riêng) nên bộ đếm trong bộ nhớ (`FailureWindow`) chỉ **làm chậm** kẻ lạm dụng:
mỗi instance đếm riêng. Các giới hạn của `/run` (`RUN_RATE_PER_MIN`) và `/codestore` (tạo không gian / IP / giờ, nhập sai khoá 20 lần / 10 phút, đọc liên kết chia sẻ, đọc token sai)
đi qua một cổng `RateLimiterPort` (`retry_after(khoá)`, `add(khoá)`, `reset`; bất đồng bộ) với 3 adapter, chọn bằng `RATE_LIMIT_BACKEND`:

| Giá trị | Đếm ở đâu | Ghi chú |
|---|---|---|
| `memory` | bộ nhớ instance (`FailureWindow`, cửa sổ trượt chính xác) | mặc định khi phát triển và khi chạy test |
| `database` | bảng `rate_limit_hits (limiter, subject, bucket, hits, expires_at)` của chính CSDL SQL của ứng dụng; tự tạo `CREATE TABLE IF NOT EXISTS` (không Alembic) | đếm nguyên tử bằng một câu upsert đúng phương ngữ: MySQL `INSERT … ON DUPLICATE KEY UPDATE hits = hits + 1`, SQLite/PostgreSQL `ON CONFLICT … DO UPDATE`; hỏi là một `SELECT` trên khoá chính |
| `mongo` | collection `rate_limits` của `MONGO_URI`, `_id = <bộ đếm>:<băm>:<xô>`, chỉ mục TTL trên `expire_at` | `update_one` với `$inc` + `$setOnInsert` + `upsert` (nguyên tử); **`auto` không bao giờ chọn mongo** — người vận hành phải chủ động |
| `auto` (mặc định) | `database` khi CSDL của ứng dụng là MySQL thật: `DB_URL` không phải `sqlite…` (`DB_URL` trong môi trường thắng trong `.env`, như cách dựng engine), hoặc không đặt `DB_URL` (các trường `DB_*` mô tả một máy chủ MySQL); `memory` khi `DB_URL` là SQLite hoặc khi đang chạy pytest (`TESTING`, `PYTEST_CURRENT_TEST`, module `pytest` đã nạp) | |

**Cửa sổ**: bộ đếm bền không giữ dấu thời gian từng sự kiện mà chia thời gian thành **xô** dài `cửa sổ / 6` giây (≥ 1 giây), mỗi (khoá, xô) một số đếm; số sự kiện của một cửa sổ là tổng các xô còn chạm vào
nó. Một xô sống tới khi **hết cuối xô** rời khỏi cửa sổ, nên một sự kiện được nhớ lâu hơn bản trượt chính xác tối đa một xô (1/6 cửa sổ) và **không bao giờ ngắn hơn**:
giới hạn không bao giờ lỏng hơn cấu hình. `Retry-After` là thời điểm xô cũ nhất đủ để tổng xuống dưới hạn mức hết hạn (≥ 1 giây). Ví dụ `/run` 20/phút → xô 10 giây, bị chặn có thể phải chờ tới 70 giây.
**Khoá không lưu thô**: bảng/collection chỉ giữ SHA-256 của khoá (địa chỉ IP), không giữ địa chỉ. Hàng/tài liệu hết hạn bị dọn (SQL: bộ đếm xoá hàng chết của mình mỗi lần `add` nhưng tối đa 1 lần/phút; Mongo: chỉ mục TTL).

**Hỏi trước, đếm sau**: nơi gọi hỏi `retry_after` rồi mới `add`, nên lượt bị từ chối không tự đếm. Hai instance cùng thấy "còn chỗ" rồi cùng `add` thì vượt hạn mức vài lượt ở mép — đây là cái phanh chống lạm dụng, không phải đồng hồ đo chính xác.

**Fail-open có kiểm soát** (`FailOpenRateLimiter`): lỗi hoặc chậm quá `RATE_LIMIT_TIMEOUT_S` (2 giây) của bộ đếm dùng chung **không bao giờ** làm sập `/run` hay `/codestore`. Instance đó ghi **một** dòng cảnh báo
(chỉ tên lớp lỗi, tên bộ đếm và thời gian chờ — không có thông điệp của driver, nên không lộ tên máy, người dùng, URI hay khoá), đếm trong **bộ nhớ của chính nó** 30 giây, rồi thử lại bộ đếm dùng chung (khi nó sống lại thì ghi một dòng `info`).
Trong 30 giây đó CSDL hỏng không bị hỏi nữa, nên một CSDL treo chỉ tốn một lần chờ `RATE_LIMIT_TIMEOUT_S`, không phải mỗi yêu cầu một lần. Lưu ý: khi dùng `auto` trên máy dev không có MySQL và không đặt `DB_URL`, bộ đếm sẽ cảnh báo mỗi 30 giây
— đặt `RATE_LIMIT_BACKEND=memory` hoặc `DB_URL=sqlite…`. `RATE_LIMIT_BACKEND=mongo` mà `MONGO_URI` rỗng → cảnh báo và đếm trong bộ nhớ.

Chưa đổi: giới hạn của `/ai/*` (`ai_usecase.py`), `/courses/admin/*` và đấu trường vẫn dùng `FailureWindow` trong bộ nhớ.

## 4. Biến môi trường

Đều có mặc định an toàn trong `Settings`, mẫu ở `backend/fastapi/.env.example`.

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `RUN_ENABLED` | `true` | công tắc tắt toàn bộ `/run` |
| `RUN_DEFAULT_PROVIDER` | `wandbox` | provider mặc định (nếu dùng được) |
| `RUN_PISTON_URL` / `RUN_PISTON_KEY` | rỗng / rỗng | rỗng = chưa cấu hình (tắt); khoá gửi ở header `Authorization` |
| `RUN_JUDGE0_URL` / `RUN_JUDGE0_KEY` / `RUN_JUDGE0_KEY_HEADER` | rỗng / rỗng / `X-Auth-Token` | rỗng = chưa cấu hình |
| `RUN_JUDGE0_LANGUAGE_IDS` | rỗng | ghi đè id, `cpp=105,python=100` |
| `RUN_WANDBOX_URL` / `RUN_WANDBOX_COMPILERS` | `https://wandbox.org/api` / rỗng | ghi đè tên compiler |
| `RUN_LOCAL_ENABLED` | `false` | bật `local` (**không phải sandbox**, cần phiên quản trị) |
| `RUN_LOCAL_GCC` `_GXX` `_JAVAC` `_JAVA` `_PYTHON` `_NODE` | rỗng (tìm trong `PATH`) | đường dẫn công cụ |
| `RUN_RATE_PER_MIN` | `20` | lượt chạy / phút / IP |
| `RATE_LIMIT_BACKEND` | `auto` | nơi đếm các giới hạn của `/run` và `/codestore`: `memory` · `database` · `mongo` · `auto` (mục 3) |
| `RATE_LIMIT_TIMEOUT_S` | `2` | một lần gọi bộ đếm dùng chung quá giờ này thì coi là lỗi và đếm trong bộ nhớ (fail-open) |
| `RUN_HTTP_TIMEOUT_S` | `30` | trần cho một lần gọi HTTP tới provider (thực tế = min(trần, biên dịch + chạy + 5 s)) |
| `CODESTORE_STORAGE_BACKEND` | `json` | kho mặc định |
| `CODESTORE_JSON_FILE` | `data/codestore.json` | |
| `CODESTORE_MAX_ITEMS` | `2000` | bản ghi / không gian |
| `CODESTORE_WORKSPACES_PER_HOUR` | `10` | không gian mới / IP / giờ |
| `CODESTORE_TOMBSTONE_DAYS` | `90` | tuổi tối thiểu để bia mộ bị dọn |
| `CODESTORE_MAX_SHARES` | `50` | liên kết chia sẻ đang hoạt động / không gian |
| `CODESTORE_SHARE_READS_PER_MIN` | `120` | lượt đọc công khai một liên kết / phút / IP (token sai: 20 / 10 phút / IP, cố định) |

---

## 5. Giới hạn đã biết, điều chưa kiểm chứng

* **Đã thử với dịch vụ thật ngày 16/10/2026** (chương trình Hello nhỏ, qua chính `/run`; kịch bản ở `backend/fastapi/tools/kiem_nha_cung_cap_that.py`):
  * **Wandbox** (không cần khoá): C, C++, Python, Java, JavaScript, Go, Rust đều chạy đúng; nhiều tệp C/C++/Python/Java. Chậm (build Java/Rust
    15–40 s) nên adapter đợi ≥ 60 s (và Vercel cần `maxDuration` ≥ 60, đã đặt ở `vercel.json`). Java: dịch vụ biên dịch `prog.java` rồi chạy lớp `Main`
    nên `public` ở lớp cấp cao bị bỏ (kèm cảnh báo trong `warnings`), `package` bị từ chối (`run_multifile_unsupported`); JS/Go/Rust một tệp.
  * **Judge0 CE công cộng** (`RUN_JUDGE0_URL=https://ce.judge0.com`, giới hạn tốc độ): 7 ngôn ngữ đơn tệp và nhiều tệp (C, C++, Python, Java kể cả `package`,
    JavaScript) đều đúng. Phát hiện: ở chế độ nhiều tệp `source_code` **phải trống** (nội dung bất kỳ → `{"source_code":["must be blank"]}`); Java phải
    biên dịch `-d out` rồi chạy `-cp out` thì `package` mới tìm được lớp. Phiên bản runtime của máy công cộng cũ (GCC 9.2, Python 3.8, Node 12, Go 1.13, Rust 1.40).
  * **Piston công cộng (emkc.org) không dùng được**: từ 15/02/2026 chỉ cho người trong danh sách trắng (mọi lời gọi trả `Public Piston API is now whitelist only…`;
    adapter báo `run_provider_rejected` đúng). Muốn dùng Piston hãy tự dựng (mục dưới) và đặt `RUN_PISTON_URL`.
  * **Piston tự dựng** (17/10/2026, Docker trong WSL2 Ubuntu 24.04, ảnh `ghcr.io/engineer-man/piston`, gcc 10.2.0 · python 3.12.0 · node 20.11.1 · java 15.0.2 · go 1.16.2 · rust 1.68.2):
    C, C++, Python, Java, JavaScript, Go, Rust một tệp và Python/JavaScript nhiều tệp **đều đúng** qua `tools/kiem_nha_cung_cap_that.py piston`. Phát hiện & sửa: gói `gcc`/`java` chỉ biên dịch tệp vào
    (`main.cpp.cpp`, không giữ thư mục con) nên C/C++/Java nhiều tệp trước đây trả lỗi biên dịch khó hiểu → adapter giờ khai `multiFileLanguages = python, javascript` và từ chối phần còn lại ngay (`run_multifile_unsupported`). Ảnh Piston không có `curl` (healthcheck dùng `node`) và Piston không gửi header CORS (nơi chạy "Piston của bạn (URL)" gọi thẳng từ trình duyệt cần reverse proxy thêm CORS; đường qua backend thì không).
  * **Judge0 tự dựng** (17/10/2026, cùng máy thử, cgroup v2): bốn container lên và xác thực `X-Auth-Token` đúng (200) / sai (401), nhưng **bài nộp trả `Internal Error` (`/box/script.py`)** vì `isolate` của Judge0 1.13 cần cgroup v1
    — nên **chưa chạy thật được mã** trên Judge0 tự dựng; adapter đã chạy thật với Judge0 CE công cộng ở trên. Cách bật cgroup v1: `deploy/code-runner/README.md`.
* Wandbox không có cờ "biên dịch hỏng": adapter suy ra từ việc phản hồi **không có trường `program_*`** mà `status` ≠ 0.
  Wandbox cũng không báo "quá giờ": coi là hết giờ khi bị kill sau ≥ 90% thời gian cho phép.
* Piston bỏ qua `compileArgs`; Judge0 không có hạn biên dịch riêng; Wandbox dùng giới hạn cố định của dịch vụ.
* `local`: không giới hạn bộ nhớ/tiến trình/mạng trên Windows. **`rlimit` trên POSIX đã kiểm trên Linux thật** (WSL Ubuntu 24.04, 16/10/2026): lõi tắt, kích thước tệp 64 MB,
  1024 tệp mở, 1 GB bộ nhớ cho chương trình native đều có hiệu lực (4 test `posix_only` trong `test_run_local_executor.py`; Windows bỏ qua). Không phải sandbox — xem mục bảo mật.
* **Kho thật đã kiểm** (kịch bản hai thiết bị hội tụ qua backend thật, 16/10/2026): `tools/kiem_mysql_that.py` (MariaDB 12.0.2 tạm, 71 phép kiểm, máy chủ ghi 259 INSERT) và
  `tools/kiem_mongo_that.py` (mongod 8.0.4 tạm trong WSL, 102 phép kiểm, 259 insert). Không bao giờ chạm database của dự án. Kiểm provider chạy mã thật: `tools/kiem_nha_cung_cap_that.py`.
* `PUT /codestore` trả lại **bản máy chủ đang giữ** cho các `id` đã gửi; nếu bản đó lớn hơn bản gửi (một thiết bị khác đã đẩy bản ≤ 512 KB),
  phản hồi có thể tới vài MB. Trường hợp thường gặp nhỏ hơn nhiều.
* Giới hạn tốc độ của `/run` và `/codestore` đếm ở nơi `RATE_LIMIT_BACKEND` chọn (mục 3): ở `memory` mỗi instance đếm riêng — làm chậm lạm dụng, không chặn được kẻ tấn công phân tán; ở `database`/`mongo` các instance
  đếm chung, nhưng "hỏi rồi mới đếm" cho phép vượt vài lượt ở mép và bộ đếm bền là xô 1/6 cửa sổ (chặt hơn cửa sổ trượt chính xác tối đa một xô). `/ai/*` vẫn đếm trong bộ nhớ.
* **Bộ đếm bền đã kiểm trên CSDL thật** (17/10/2026), qua `tools/kiem_bo_dem_that.py` do hai công cụ trên gọi: MariaDB 12.0.2 (hai đối tượng + một tiến trình con cùng đếm một khoá: 100 lượt đồng thời → tổng đúng 100; chờ đúng `Retry-After`
  (đồng hồ thật) thì hết bị chặn; dọn hàng hết hạn; CSDL chết thì fail-open) và mongod 8.0.4 (cùng các phép kiểm, thêm chỉ mục TTL thật). Cả hai chạy luôn kịch bản tích hợp với `RATE_LIMIT_BACKEND` = `database` / `mongo`:
  máy chủ thật đếm khoá sai và token sai vào bảng/collection đó (20 lượt mỗi loại rồi `429`). **Chưa thử**: Aiven MySQL thật (không bao giờ chạm), nhiều instance Vercel thật, TTL của Mongo tự xoá (mất tới ~60 giây sau `expire_at`; truy vấn không phụ thuộc vào việc đó).
* **Liên kết chia sẻ có giao diện trong Code Studio** (17/10/2026): bảng lệnh/menu ⋯ › "Chia sẻ liên kết chỉ đọc…" (cần đã bật đồng bộ — liên kết trỏ tới bản chụp trên máy chủ; mở hộp thoại là lưu + đẩy mục lên rồi chụp),
  liên kết dạng `…/code-studio/index.html#share=<token>&backend=<kho>` (token **sau `#`**: không lên máy chủ, không vào nhật ký truy cập/Referer). Mở liên kết: trang **chỉ xem** (không dựng IDE, không đọc/ghi thư viện, localStorage hay IndexedDB của người xem; một lời gọi duy nhất
  `GET /codestore/shared/{token}`, không kèm khoá), trình soạn chỉ đọc, `noindex`. Nút "Nhân bản về thư viện của tôi" → `#clone=…`: IDE đầy đủ nhập bản chụp thành mục **mới** (id mới, tên + " (bản chia sẻ)", bỏ ghim/thẻ đang mở) rồi mở. "Cập nhật bản chia sẻ" giữ nguyên token; "Thu hồi" làm token chết.
  Đã kiểm trình duyệt thật (Edge/Firefox/WebKit, `check.py`) và qua backend thật ở cả ba kho (`shareScenario` trong `kiem-tich-hop.js`, `kiem_mysql_that.py`, `kiem_mongo_that.py`).

## 6. Kiểm

```text
cd backend/fastapi
.venv/Scripts/python.exe -m pytest tests/application/test_run_inputs.py tests/application/test_run_usecase.py \
  tests/application/test_codestore_usecase.py tests/application/test_codestore_shares.py tests/application/test_rate_limit_wiring.py \
  tests/adapter/output/run tests/adapter/output/codestore tests/adapter/output/ratelimit \
  tests/adapter/input/controller/test_run_controller.py tests/adapter/input/controller/test_codestore_controller.py -q
```

Bộ đếm: `tests/adapter/output/ratelimit/test_rate_limiters.py` chạy **một hợp đồng chung** cho `memory`, `database` (SQLite trong bộ nhớ) và `mongo` (`fake_mongo`) — hạn mức, `Retry-After`, hết hạn,
khoá độc lập, reset, nhiều instance chung một kho, đếm đồng thời không mất lượt, khoá lưu dạng băm, dọn hàng — cộng toán xô và các kiểm fail-open (kho ném lỗi, kho treo, thông điệp lỗi không lọt vào log);
`test_rate_limit_wiring.py` kiểm `auto` chọn đúng và `/run`, `/codestore` thật sự dùng bộ đếm đó (hai instance chung hạn mức; kho chết thì vẫn phục vụ).

`tests/adapter/output/run/test_run_local_executor.py` chạy chương trình thật (g++, gcc, javac+java, node, python) với mã nhỏ vô hại và
tự bỏ qua nhóm nào thiếu công cụ. Không test nào gọi mạng hay chạm MySQL/Mongo thật (SQLite trong bộ nhớ, `tests/support/fake_mongo.py`).
