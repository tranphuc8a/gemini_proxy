# Postman Lite Pro — Bàn giao

Viết cho phiên làm việc tiếp theo. Chi tiết dùng app xem [../README.md](../README.md).

## Yêu cầu ban đầu

App thuần ở `backend/fastapi/webapp/postman-lite/` "tính năng thì oke nhưng khá xấu và
trải nghiệm người dùng còn kém". Yêu cầu: dựng app mới bằng framework, làm lại chức năng
cũ và bổ sung nhiều tính năng hơn (ví dụ lưu collection vào backend), đặt vào repo
`postman-lite`.

## Quyết định đã chốt với người dùng

| Câu hỏi | Chốt |
|---|---|
| Stack | React 18 + TS + Vite + Zustand + Vitest — bám đúng `sql-administrator/` |
| Deploy | App mới ở `/webapp/postman-lite-pro/`, **giữ nguyên** app thuần ở `/webapp/postman-lite/` |
| Lưu trữ | **Cả hai**, chọn bằng `POSTMAN_STORAGE_BACKEND=json\|mysql` |
| Tính năng | Cả 4 nhóm: chạy & kiểm thử · nhập/xuất & sinh code · UX cao cấp · chia sẻ & lịch sử server |
| Cách làm | Làm một mạch, không chia giai đoạn |

## Đã làm

**Backend** (hexagonal, bám đúng khuôn `sql_admin_*`):

```
src/domain/vo/postman_vo.py                          VO + giới hạn kích thước
src/application/ports/input/postman_input_port.py
src/application/ports/output/postman_repository_port.py
src/application/usecases/postman_usecase.py          access key, revision, share
src/adapter/output/postman/json_repository.py        mặc định, không cần DB
src/adapter/output/postman/mysql_repository.py       CREATE TABLE IF NOT EXISTS
src/adapter/factory/postman_factory.py               chọn backend theo env
src/adapter/input/controllers/postman_controller.py  /postman/*
```

Config mới: `POSTMAN_STORAGE_BACKEND`, `POSTMAN_JSON_FILE`, `POSTMAN_MAX_HISTORY`.
Router đã đăng ký trong `src/main.py`. `/proxy/request` (làm ở phiên trước) được tái
dùng nguyên vẹn.

**Frontend**: `postman-lite/` — 12 module `lib/`, 1 store Zustand, 10 component.

## Ba chỗ dễ phá nếu sửa tiếp

1. **`lib/` phải thuần, không chạm DOM.** `prepare()` được dùng chung bởi bộ gửi và bộ
   sinh code — đó là lý do snippet copy ra luôn khớp request thật. Nhét DOM vào là hỏng
   cả hai tính chất đó lẫn khả năng test.

2. **`SANDBOX_SOURCE` trong `testRunner.ts` là một chuỗi, cố ý.** Cùng một nguồn được
   nhúng vào Web Worker và dùng cho nhánh fallback (jsdom lúc test, trình duyệt cũ không
   có Worker). Tách đôi ra là hai nhánh sẽ lệch nhau lúc nào không biết.

3. **Tab giữ *draft*, không giữ bản đã lưu.** `dirty` so sánh draft với `requests[]` bỏ
   qua `createdAt`/`updatedAt`. Cho tab trỏ thẳng vào object đã lưu là gõ một phím cũng
   ghi đè collection.

## Bẫy đã gặp, đừng gặp lại

- **`API_PREFIX` rỗng trong `.env` của repo này** → route thật là `/postman/...`, không
  phải `/api/v1/postman/...`. `lib/api.ts` dò lần lượt `""` → `/api/v1` → `/api` và nhớ
  kết quả. Đừng hardcode.
- **SQLite in-memory dùng chung cho cả bộ test**, mà bảng của `mysql_repository` tạo bằng
  raw SQL nên `Base.metadata.drop_all` của conftest không đụng tới. Test phải dùng id
  riêng cho từng case — xem fixture `ws_id`.
- **`Uint8Array` không gán được vào `BlobPart`** với lib TS mới (có thể là
  `SharedArrayBuffer`). Dùng `toBlobPart()` trong `lib/util.ts`.
- **`--max-warnings 0`** làm cảnh báo `react-refresh/only-export-components` thành lỗi
  lint. Hàm không phải component thì để trong `lib/`, đừng export từ file component.

## Kiểm chứng

```powershell
cd backend\fastapi;    .\.venv\Scripts\python.exe -m pytest -q   # 247 passed
cd postman-lite;       npm run typecheck && npm run lint && npm test && npm run build
                                                                 # 58 passed, build OK
cd backend\fastapi\webapp\postman-lite; node tests\logic.test.js  # 29 passed (app cũ)
```

Đã smoke test in-process bằng `TestClient`: `index.html` + 4 asset + `metadata.json` trả
200, app hiện trong portal, `/proxy/status` 200, tạo → lưu (revision 1→2) → xóa workspace
chạy đúng.

## Chưa làm / còn nợ

- **Chưa mở được trên trình duyệt thật.** Môi trường phiên này chặn gọi mạng tới
  localhost. Phần logic đã test kỹ, nhưng **phần nhìn và tương tác thì chưa ai xem** —
  mở `http://localhost:6789/webapp/postman-lite-pro/` bấm thử một lượt trước khi tin.
- **Không có test render component.** Vitest + Testing Library đã cài sẵn (kế thừa
  package.json của sql-administrator) nhưng mới chỉ test `lib/` và store.
- `prompt()` / `confirm()` gốc của trình duyệt vẫn còn ở vài chỗ trong `Sidebar.tsx` và
  `Dialogs.tsx` (đổi tên collection, xác nhận xóa). Nên thay bằng modal cho đồng bộ.
- **Chưa có auto-sync định kỳ** — `autoSync` mới chỉ kéo về lúc mở app, đẩy lên vẫn phải
  bấm tay. Có ô cài đặt sẵn nếu muốn làm tiếp.
- Import OpenAPI chỉ đọc JSON; file `.yaml` phải tự chuyển sang JSON trước.
- Upload file qua proxy đi qua bộ nhớ hai lần (dựng multipart rồi base64) — chưa stream.

## Ghi chú khác

- `backend/fastapi/data/` đã được thêm vào `.gitignore`: chứa session của sql-administrator
  và workspace của app này, đều là dữ liệu máy cục bộ có secret.
- Build ra `backend/fastapi/webapp/postman-lite-pro/` **được commit** (giống `gemini-chat`),
  vì FastAPI phục vụ thẳng thư mục đó. `postman-lite/node_modules` và `dist` thì không.
