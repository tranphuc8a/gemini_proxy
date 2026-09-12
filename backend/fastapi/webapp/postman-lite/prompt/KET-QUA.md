# Postman Lite — Kết quả xử lý `prompt.md`

Tài liệu bàn giao, viết cho người/phiên làm việc tiếp theo trên app này.

## 1. Lỗi CORS — nguyên nhân & cách sửa

**Nguyên nhân:** không phải bug của code. Postman thật là ứng dụng native, không có
origin nên không chịu same-origin policy. Postman-lite chạy `fetch()` trong tab, nên
mọi request cross-origin đều bị chặn nếu server đích không trả `Access-Control-Allow-Origin`.

Ba hệ quả kèm theo, trước đây đều âm thầm:

| Triệu chứng | Nguyên nhân |
|---|---|
| Tab Cookies không có tác dụng | Trình duyệt cấm JS đặt header `Cookie` |
| Tab Headers thiếu header | Response cross-origin chỉ lộ 6 header CORS-safelisted |
| Một số API trả 4xx lạ | Preflight `OPTIONS` tự phát sinh |

**Cách sửa:** thêm forward proxy phía FastAPI — đúng vai trò Postman Desktop Agent.

### Backend mới

```
POST {API_PREFIX}/proxy/request   # gửi hộ 1 request, trả nguyên response
GET  {API_PREFIX}/proxy/status    # proxy có bật không, host cho phép, giới hạn size
```

- `src/adapter/input/controllers/proxy_controller.py` — router mỏng
- `src/application/usecases/http_proxy_usecase.py` — logic forward (httpx)
- `src/domain/vo/proxy_vo.py` — `ProxyRequest` / `ProxyResponse`
- `tests/adapter/input/controller/test_proxy_controller.py` — 15 test (respx, không ra mạng)

Body đi/về dưới dạng **text nếu là UTF-8 hợp lệ, ngược lại base64** — nên ảnh, PDF,
file nhị phân đều không bị hỏng.

### Config mới (`config.py` + `.env.example`)

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PROXY_ENABLED` | `true` | Tắt toàn bộ proxy |
| `PROXY_ALLOWED_HOSTS` | `*` | Danh sách host cho phép, hỗ trợ `*.internal` |
| `PROXY_TIMEOUT_SECONDS` | `60` | |
| `PROXY_MAX_BYTES` | `10485760` | Vượt thì cắt bớt và báo `truncated` |
| `PROXY_VERIFY_TLS` | `false` | Để test server self-signed |

> ⚠️ **Cảnh báo bảo mật (SSRF).** Đây là forward proxy: cái gì backend gọi được thì
> người dùng API cũng gọi được, kể cả `localhost` và LAN — đó là chủ ý, vì use case
> chính là test API chạy trên máy mình. Metadata cloud (`169.254.169.254`,
> `metadata.google.internal`) và mọi scheme ngoài http/https bị chặn cứng.
> **Nếu deploy backend ra Internet: đặt `PROXY_ENABLED=false` hoặc ghim `PROXY_ALLOWED_HOSTS`.**

### Frontend: 3 chế độ gửi (chọn ở thanh header)

- **Auto** (mặc định) — thử gửi thẳng; nếu `fetch` ném `TypeError` (CORS/DNS/refused,
  trình duyệt cố tình không nói rõ) thì tự gửi lại qua proxy và báo cho người dùng.
  Nếu request có header bị cấm (vd `Cookie`) thì đi thẳng proxy, khỏi thử vô ích.
- **Direct** — `fetch` thuần.
- **Proxy** — luôn qua backend.

**Tự dò API prefix:** `.env` của repo này đặt `API_PREFIX=` (rỗng) nên route nằm ở
`/proxy/status`, không phải `/api/v1/proxy/status`. Client thử lần lượt
`proxyBaseUrl` → `apiPrefix` đã lưu → `/api/v1` → gốc, rồi nhớ cái nào trả đúng
envelope. Sửa tay được trong ⚙️ Cài đặt.

## 2. Bug đã sửa

| File cũ | Vấn đề |
|---|---|
| `env.js` vs `storage.js` | **Hai key localStorage khác nhau** cho environment → Export ra file mà Import không khôi phục được. Nay dùng chung `Storage`, có `migrate()` gộp key cũ |
| `env.js:26` | Chọn environment **ghi đè vĩnh viễn** `{{VAR}}` trong ô nhập → đổi env lần 2 không còn tác dụng. Nay chỉ thay lúc gửi, form giữ nguyên template |
| `app.js:512` | cURL sinh ra **thiếu `\` nối dòng** → lệnh copy ra shell đọc thành nhiều lệnh rời, `curl: no URL specified` |
| `curl-parser.js:178` | `shellSplit` biến `\`+xuống dòng thành token `"\n"`, token này rơi vào luật "token không phải flag là URL" → **ghi đè URL**. Mọi lệnh curl nhiều dòng (Copy as cURL) đều parse sai |
| `curl-parser.js` | `--compressed`, `-k`, `-L` bị coi là "có tham số" nên **nuốt mất token kế tiếp** |
| `index.html:105` | `#curlPreview` nằm nhầm trong tab Auth |
| `response-viewer.js:57` | `new Blob([text])` từ chuỗi đã decode → **preview ảnh luôn hỏng**; body nhị phân bị ép decode UTF-8 |
| `storage.js:134` | `setItem` vượt quota ném lỗi giữa lúc gửi → hiện "Lỗi gửi request" dù response đã về. Nay bắt quota, cắt bớt lịch sử rồi thử lại |
| `sidebar.js:215` | `querySelectorAll('[data-action]')` **toàn document** → bắt nhầm nút trong modal Environment, listener chồng chất mỗi lần render |
| `sidebar.js:105` | Collection khớp tên thì **ẩn sạch con** của nó |
| `sidebar.js:395` | Kéo collection vào chính con của nó → nhánh đó rớt khỏi root và **biến mất khỏi sidebar** |
| `app.js:694` | `loadHistoryItem` ghi thẳng DOM → tag status/time/size và tab Raw/Preview giữ nội dung request trước |
| `app.js:653/836` | `loadRequest`/`clearForm` không reset auth → **token của request cũ rò sang request mới** |
| `app.js:590,186` | `innerHTML` với dữ liệu chưa escape (tên env, URL từ cURL) |
| `app.js:343` | Param bị **nối thêm** vào query có sẵn thay vì thay thế → `?page=1&page=2` |
| `app.js:380` | `btoa()` chỉ nhận Latin-1 → Basic auth với tài khoản có dấu thì ném lỗi |
| `index.html:5` | `maximum-scale=1` chặn pinch-zoom |
| `styles.css` | `#responseBody { display:none }` khiến dòng placeholder không bao giờ hiện |

## 3. Tính năng bổ sung

- Hủy request (`AbortController`), timeout cấu hình được, khóa nút Send khi đang gửi
- Phím tắt: `Ctrl+Enter` gửi · `Ctrl+S` lưu · `Ctrl+B` ẩn/hiện sidebar · `Esc` đóng modal
- Đồng bộ 2 chiều URL ⇄ tab Params; thêm method `HEAD`, `OPTIONS`
- Bật/tắt từng dòng key-value bằng checkbox; badge đếm số dòng trên mỗi tab
- Response: tô màu theo status, syntax highlight JSON, tìm trong body, tải body,
  bật/tắt wrap, preview ảnh/PDF/HTML (iframe `sandbox` rỗng, không chạy script)
- Toast + hộp thoại xác nhận không chặn UI, thay cho `alert`/`confirm`
- History: lọc theo URL/method, xóa từng dòng, xóa cả lịch sử
- Import: chọn file hoặc dán JSON, chọn **Ghi đè** hay **Gộp**; "Xóa tất cả" mời tải backup trước
- Nhân bản request; thêm request trực tiếp vào collection từ cây
- Badge cảnh báo `{{VAR}}` chưa có giá trị, ngay cạnh ô chọn environment
- Modal ⚙️ Cài đặt: API prefix, proxy URL, timeout, số history, follow redirect,
  nút "Kiểm tra proxy"

## 4. Kiến trúc frontend hiện tại

```
toast.js          thông báo + confirm (Promise)
storage.js        nguồn dữ liệu duy nhất: collections/requests/history/environments/settings
env.js            EnvManager — thay {{VAR}} lúc gửi, dò biến thiếu
http-client.js    prepare() thuần → sendDirect | sendProxy; dò proxy; multipart; base64
curl-parser.js    parse() và build() — nghịch đảo của nhau
sidebar.js        cây collection + history
response-viewer.js render response từ **bytes** (không phải string)
search.js         ô tìm kiếm sidebar
app.js            điều phối DOM
```

Điểm cần giữ: `HttpClient.prepare()` là hàm **thuần**, không chạm DOM — nên lệnh curl
in ra luôn khớp đúng request thật sự gửi đi.

## 5. Chạy & test

```powershell
# Backend (proxy)
cd backend\fastapi
.\.venv\Scripts\python.exe -m uvicorn src.main:app --port 6789
# App:  http://localhost:6789/webapp/postman-lite/

# Test backend  -> 212 passed
.\.venv\Scripts\python.exe -m pytest -q

# Test logic frontend (thuần Node, không cần cài gì) -> 29 passed
cd webapp\postman-lite
node tests\logic.test.js
```

`tests/logic.test.js` nạp các file app vào sandbox `node:vm` với `localStorage` giả,
phủ: parse/build cURL, ghép URL/params, thay biến env, dò proxy, quy tắc Storage
(quota, xóa đệ quy, chống vòng lặp cây, import/export).

## 6. Việc chưa làm / lưu ý

- **Chưa có test DOM.** Repo không có jsdom/playwright và CLAUDE.md cấm tự thêm
  dependency. Phần `app.js`/`sidebar.js` đụng DOM mới chỉ được kiểm tra tĩnh
  (đối chiếu mọi `getElementById` với id trong `index.html`) — nên **mở app bấm thử
  một lượt** trước khi tin tuyệt đối.
- **Chưa chạy thử trên trình duyệt thật** trong phiên này: môi trường chặn gọi mạng
  ra `localhost`, nên chỉ smoke test in-process bằng `TestClient`
  (index.html + 9 script + css đều trả 200, app hiện trong portal).
- History và saved request **lưu cả token/password** trong localStorage, và Export
  đưa chúng vào file JSON. Cẩn thận khi chia sẻ file export.
- Upload file qua proxy hoạt động (multipart được dựng tay rồi base64), nhưng
  file lớn sẽ đi qua bộ nhớ 2 lần — chưa stream.
- `-d @file` trong cURL không nạp được (trình duyệt không đọc đường dẫn); app báo
  rõ thay vì im lặng bỏ qua.
