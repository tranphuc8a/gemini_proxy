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

## Cách đã xử lý

**1. Biến wukong thành app thật.** Thêm `index.html` (trang chủ liệt kê ba phần
chạy được: chơi với máy, xem ván cờ, giải thế cờ) và `metadata.json`. Ba app này
tự chứa — chỉ nạp file trong thư mục của chúng, không đụng `xqdb/`.

**2. `backend/fastapi/vercel.json` với `excludeFiles`.** Loại khỏi bundle:

- phần không phục vụ web của wukong: `xqdb` (65 MB), `res`, `pgn`, `docs`,
  `integration`, `puzzle_generator`, `opening_book_generator`, `xiangqi_pgn_parser`
- `tests/`, `alembic/`, `tools/`, `data/`
- `webapp/**/*.map` — source map không ai đọc trên production

Không cần loại `frontend/`, `markdown-editor/`… vì chúng nằm **ngoài** Root
Directory nên vốn đã không vào bundle.

Kết quả: **179.1 MB → 103.7 MB**, cộng deps ≈ **120 MB / 225 MB**.

> **`excludeFiles` tối đa 256 ký tự.** Schema của Vercel chặn ở đó, và deployment
> bị từ chối trước cả khi build. Nên glob phải gọn: chỉ liệt kê thứ thật sự
> nặng, gom nhiều thư mục vào một nhóm `{a,b,c}`. Các pattern như
> `**/__pycache__/**` hay `**/node_modules/**` là vô ích ở đây — những thư mục đó
> không được git theo dõi nên vốn đã không có trong repo. Script kiểm tra sẽ báo
> lỗi nếu chuỗi vượt 256 ký tự.

> **Đừng dùng `!(backend)/**` để "giữ mọi thứ trừ backend".** Đã thử: minimatch
> khớp cả `backend/...` với pattern đó, nên nó loại sạch chính phần cần giữ.
> Negation `!(...)` chỉ an toàn ở segment giữa, ví dụ
> `.../wukong-xiangqi-main/!(src|apps)/**`. Bản đang dùng liệt kê tường minh để
> không phụ thuộc vào extglob.

**3. Tách requirements.** `pytest`, `pytest-asyncio`, `pytest-cov`, `respx`,
`alembic` chuyển sang `requirements-dev.txt`. Bỏ `google-auth`: module duy nhất
nhắc tới nó (`gemini_client_native.py`) không được ai import, và gói đó không hề
cung cấp `google.generativeai` hay `google.ai.generativelanguage`.

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
