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

## Cách đã xử lý

**1. Biến wukong thành app thật.** Thêm `index.html` (trang chủ liệt kê ba phần
chạy được: chơi với máy, xem ván cờ, giải thế cờ) và `metadata.json`. Ba app này
tự chứa — chỉ nạp file trong thư mục của chúng, không đụng `xqdb/`.

**2. `vercel.json` với `excludeFiles`.** Loại khỏi function bundle:

- phần không phục vụ web của wukong: `xqdb`, `res`, `pgn`, `docs`, `integration`,
  `puzzle_generator`, `opening_book_generator`, `xiangqi_pgn_parser`
- mã nguồn các web app (`frontend/`, `markdown-editor/`, …) — backend không cần,
  chỉ cần bản build đã nằm trong `webapp/`
- `tests/`, `alembic/`, `tools/`, `__pycache__`

Kết quả: **204 MB → 106 MB**.

**3. Tách requirements.** `pytest`, `pytest-asyncio`, `pytest-cov`, `respx`,
`alembic` chuyển sang `requirements-dev.txt`. Bỏ `google-auth`: module duy nhất
nhắc tới nó (`gemini_client_native.py`) không được ai import, và gói đó không hề
cung cấp `google.generativeai` hay `google.ai.generativelanguage`.

## Kiểm tra trước khi deploy

```bash
node scripts/check-vercel-bundle.mjs
```

Script áp chính glob trong `vercel.json` lên danh sách file git sẽ đưa lên
GitHub, dùng cùng thư viện match (`minimatch`) mà Vercel dùng, rồi báo:

- dung lượng thực sự được đóng gói, so với giới hạn
- các thư mục lớn nhất còn lại
- **thư mục nào trong `webapp/` không có index file** — tức được đóng gói nhưng
  không bao giờ phục vụ ai

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
- **Key của `functions` là glob khớp đường dẫn function**, tương đối với project
  root. Ở đây là `backend/fastapi/src/main.py`. Nếu đổi **Root Directory** trong
  dashboard Vercel thì phải sửa key này, nếu không cấu hình sẽ không áp dụng.
- Tài liệu Vercel ghi giới hạn tiêu chuẩn là 500 MB, nhưng build thực tế của dự
  án này bị chặn ở **225 MB**. Lấy con số trong log build làm chuẩn.
- Giải pháp triệt để hơn là cho Vercel serve `/webapp/*` như static hosting và
  chỉ để API trong function. Chưa làm, vì đánh đổi: static hosting không chèn
  được runtime config vào `index.html` (xem
  [webapp-runtime-config.md](webapp-runtime-config.md)) — tuy trên Vercel
  `API_PREFIX` đang rỗng nên same-origin vẫn đúng.
