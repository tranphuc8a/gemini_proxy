# Kích thước bundle khi deploy Vercel

> Đọc khi build Vercel báo `Total bundle size exceeds the maximum function size`.

## Vấn đề

Vercel đóng gói **mọi file trong project** vào serverless function — tài liệu
Python nói rõ *"There is no automatic tree-shaking for Python"* — rồi từ chối
deploy nếu vượt giới hạn (225 MB trong lần build đã gặp lỗi).

Repo này đặc biệt dễ vỡ vì `backend/fastapi/webapp/` là một bộ sưu tập web app
tĩnh: chỉ cần copy thêm một bản build vào đó là bundle phình ra, dù mã nguồn
Python vẫn chỉ ~800 KB.

## Lần vỡ đầu tiên (2026-09-20)

| | |
|---|---|
| Bundle Vercel báo | 267.88 MB → 234.04 MB sau khi tối ưu deps |
| Giới hạn | 225 MB |
| `webapp/` | **217 MB** |
| Mã nguồn Python | 814 KB |
| Python dependencies | ~16 MB |

Thủ phạm lớn nhất là `webapp/wukong-xiangqi-main`: **99.7 MB** mà **không tạo ra
app nào**. Đó là repo nguồn của một dự án cờ tướng bị copy nguyên si — 65 MB cơ
sở dữ liệu ván cờ (`.zip`), script Python sinh dữ liệu, PDF tài liệu. Không có
`index.html` ở cấp nào mà scanner tìm tới, nên portal không thấy nó, không route
nào chạm tới nó, nhưng nó vẫn được đóng gói.

## Điều quan trọng nhất: Root Directory không phải repo root

Vercel dò entrypoint FastAPI ở `main.py` hoặc `src/main.py` **tương đối với
project root**. Trong repo này, file duy nhất khớp là
`backend/fastapi/src/main.py` — repo root không có `main.py` lẫn `src/main.py`.

Suy ra **Root Directory của project Vercel là `backend/fastapi`**. Hệ quả:

| | |
|---|---|
| `vercel.json` phải nằm ở | `backend/fastapi/vercel.json` |
| `functions` key | `src/main.py` |
| glob `excludeFiles` tương đối với | `backend/fastapi/` |
| thư mục ngoài root (`frontend/`, `markdown-editor/`…) | **không hề vào bundle** |

Lần sửa đầu tiên đặt `vercel.json` ở repo root với key
`backend/fastapi/src/main.py`. Vercel **không đọc file đó**, và cũng **không báo
lỗi gì** — bundle sau tối ưu vẫn đúng 234 MB như trước, chênh nhau 0.01 MB. Dấu
hiệu nhận ra: con số không nhúc nhích thì cấu hình không được áp dụng, chứ không
phải glob sai.

## `excludeFiles` KHÔNG hoạt động với preset này

Đã thử hai lần, hai cấu hình khác nhau:

| Lần | `vercel.json` ở | `functions` key | Bundle sau optimize |
|---|---|---|---|
| 1 | repo root | `backend/fastapi/src/main.py` | 234.04 MB |
| 2 | `backend/fastapi/` | `src/main.py` (đúng entrypoint) | **234.03 MB** |

Chênh 0,01 MB. Vercel **không báo lỗi gì** về cấu hình — nó chỉ im lặng bỏ qua.

Phép tính xác nhận:

```
source trong backend/fastapi (git tracked) : 179.1 MB
Vercel báo sau optimize                    : 234.03 MB
→ dependencies                             :  54.9 MB
```

Nếu `excludeFiles` có tác dụng, source phải là 103.7 MB và tổng 158.6 MB. Nó
không phải vậy: **mọi file bị "loại" đều được đóng gói**.

Kết luận: với **Python framework preset** (zero-config FastAPI), `excludeFiles`
không có hiệu lực. Tài liệu `vercel.json` mô tả nó cho function nói chung, và ví
dụ trong tài liệu Python dùng `app.py` ở root — có thể nó chỉ áp dụng cho
function khai báo trong thư mục `/api`.

**Đừng dựa vào `excludeFiles` để giảm bundle ở dự án này.** Chỉ có hai cách thật
sự hiệu quả:

1. **Đưa file ra khỏi Root Directory** (`backend/fastapi/`). Bất cứ thứ gì ngoài
   đó đều không vào bundle — đó là lý do `frontend/`, `markdown-editor/`… vốn đã
   không bị tính.
2. **Nâng trần bằng Large Functions**: đặt biến môi trường
   `VERCEL_SUPPORT_LARGE_FUNCTIONS=1` trong Project Settings. Yêu cầu Fluid
   compute với Active CPU (bật mặc định cho project mới), hỗ trợ Python, nâng
   giới hạn lên **5 GB**. Không dùng được với Secure Compute hoặc Static IPs.

Ghi chú về con số: tài liệu Vercel nói giới hạn Python là **500 MB**, nhưng build
thực tế của dự án này bị chặn ở **225 MB**. Lấy con số trong log làm chuẩn.

## Đã làm được gì

**1. Biến wukong thành app thật.** `webapp/wukong-xiangqi-main` trước đây chiếm
99.7 MB mà **không tạo ra app nào** — không có `index.html` ở cấp nào scanner tìm
tới. Đã thêm trang chủ liệt kê ba phần chạy được (chơi với máy, xem ván cờ, giải
thế cờ) và `metadata.json`. Ba app này tự chứa, chỉ nạp file trong thư mục của
chúng, không đụng `xqdb/`.

**2. Tách requirements.** `pytest`, `pytest-asyncio`, `pytest-cov`, `respx`,
`alembic` sang `requirements-dev.txt`; bỏ `google-auth` (module duy nhất nhắc
tới nó không được ai import, và gói đó không cung cấp `google.generativeai`).
Bundle **trước** optimize giảm 267.88 → 257.42 MB. Sau optimize thì không đổi —
Vercel tự cắt phần dư thừa, nên phần này chủ yếu giúp môi trường dev gọn hơn.

**3. `backend/fastapi/vercel.json`** với `functions` key đúng entrypoint. Giữ
lại dù `excludeFiles` hiện không có tác dụng: key đúng là điều kiện cần cho mọi
cấu hình function khác (`maxDuration`, `memory`…), và nếu Vercel hỗ trợ
`excludeFiles` cho preset này sau, nó sẽ chạy ngay.

## Kết quả: đã deploy được (2026-09-20)

Bật **Large Functions**. Log build xác nhận:

```
Function "src/main.py" exceeds the standard size limit; enabling large functions (beta).
Build Completed in /vercel/output [15s]
Deployment completed
```

Cách bật:

1. Vercel → Project → **Settings → Environment Variables**
2. `VERCEL_SUPPORT_LARGE_FUNCTIONS` = `1`, cho Production và Preview
3. **Settings → Functions → Fluid compute** phải đang bật (Large Functions yêu cầu
   Fluid compute với Active CPU)
4. Redeploy, bỏ tick *Use existing Build Cache*

Trần nâng từ 225 MB lên **5 GB**. Bundle hiện tại 234 MB ≈ 5% trần mới.

Dòng log đó còn xác nhận một điều: Vercel gọi function là `"src/main.py"` — đúng
key trong `vercel.json`. Nên `excludeFiles` bị bỏ qua **không phải vì key sai**.

### Đã kiểm chứng trên production

| | |
|---|---|
| `GET /health/` | `{"status":"ok","service":"gemini-proxy-fastapi"}` |
| `GET /webapp/_api/config` | `{"apiBase":"","webappBase":"/webapp"}` |
| `GET /webapp/_api/search?q=wukong` | 1 kết quả, `has_index: true`, icon 🐵 |

`apiBase: ""` đúng như mong đợi vì `API_PREFIX` rỗng — các webapp gọi API
same-origin.

### Điều cần biết về đánh đổi

Large Functions là **beta**. Deploy hiện phụ thuộc vào nó: tắt biến môi trường
đó, hoặc beta kết thúc, là vỡ lại. `check-vercel-bundle.mjs` nhắc điều này mỗi
lần chạy, kèm số MB cần cắt để không còn phụ thuộc (hiện ~9 MB).

Muốn độc lập hoàn toàn với beta: chuyển
`webapp/wukong-xiangqi-main/{xqdb,res,pgn,docs,integration,puzzle_generator,
opening_book_generator,xiangqi_pgn_parser}` (73 MB dữ liệu nguồn, không phục vụ
web) ra ngoài `backend/fastapi/`. File vẫn trong repo, vẫn xem được trên GitHub,
nhưng ngoài Root Directory thì không vào bundle: 234 → 161 MB.

Large Functions cũng không dùng được nếu project bật Secure Compute hoặc
Static IPs.

## Kiểm tra trước khi deploy

```bash
node scripts/check-vercel-bundle.mjs
```

Script đọc `backend/fastapi/vercel.json` (đúng file Vercel dùng), áp glob lên
danh sách file git sẽ đưa lên GitHub bằng cùng thư viện match (`minimatch`) mà
Vercel dùng, rồi báo:

- dung lượng thực sự được đóng gói, so với giới hạn
- các thư mục lớn nhất còn lại
- **thư mục nào trong `webapp/` không có index file** — tức được đóng gói nhưng
  không bao giờ phục vụ ai

Và dừng ngay với lỗi rõ ràng khi:

- `functions` key không trỏ tới file nào có thật trong Root Directory
- không có `vercel.json` trong Root Directory
- `excludeFiles` dài quá 256 ký tự

Thoát với mã lỗi khi vượt giới hạn, hoặc khi mã nguồn đã chiếm quá 80% (vì
dependencies còn cộng thêm phía trên). Dùng được trong CI.

```bash
node scripts/check-vercel-bundle.mjs --limit 225   # đổi ngưỡng
node scripts/check-vercel-bundle.mjs --top 20      # liệt kê nhiều thư mục hơn
```

## Khi thêm app mới vào collection

1. Chạy `node scripts/build-webapps.mjs` như thường lệ.
2. Chạy `node scripts/check-vercel-bundle.mjs` **trước khi commit**.
3. Nếu nó cảnh báo một thư mục "no index file": hoặc thêm `index.html` cho nó,
   hoặc thêm vào `excludeFiles`.

## Những điều đã tra và cần nhớ

- **`.vercelignore` không dùng được ở đây.** Tài liệu Vercel: *"These ignored
  files are only relevant when using Vercel CLI."* Deployment từ Git clone toàn
  bộ repo, nên chỉ `vercel.json` mới có tác dụng.
- **Key của `functions` phải là entrypoint Vercel đã resolve**, tương đối với
  Root Directory. Ở đây là `src/main.py`. Một key không khớp file nào sẽ bị **bỏ
  qua trong im lặng** — không lỗi, không cảnh báo, chỉ là cấu hình không có tác
  dụng. Đây là cái bẫy đã làm mất một vòng deploy.
- **Chỉ có một `vercel.json` duy nhất, ở `backend/fastapi/`.** Bản ở repo root đã
  bị xoá: nó không bao giờ được đọc, và sự tồn tại của nó khiến người ta sửa nhầm
  file rồi tưởng đã xong.
- Tài liệu Vercel ghi giới hạn tiêu chuẩn là 500 MB, nhưng build thực tế của dự
  án này bị chặn ở **225 MB**. Lấy con số trong log build làm chuẩn.
- Giải pháp triệt để hơn là cho Vercel serve `/webapp/*` như static hosting và
  chỉ để API trong function. Chưa làm, vì đánh đổi: static hosting không chèn
  được runtime config vào `index.html` (xem
  [webapp-runtime-config.md](webapp-runtime-config.md)) — tuy trên Vercel
  `API_PREFIX` đang rỗng nên same-origin vẫn đúng.
