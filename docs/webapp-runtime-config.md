# Cấu hình runtime cho web app collection

> Dành cho người thêm hoặc bảo trì một web app trong `backend/fastapi/webapp/`.

## Vấn đề

Vite thay `import.meta.env.VITE_*` bằng **chuỗi literal lúc build**. Giá trị đó
đến từ file `.env` trên máy build — không phải từ môi trường nơi ứng dụng được
chạy.

Trong repo này có hai loại cấu hình về bản chất không thể đồng bộ:

| | Quyết định khi nào | Ví dụ |
|---|---|---|
| `API_PREFIX` | FastAPI **khởi động** | `` (rỗng) hoặc `/api/v1` |
| `VITE_API_BASE` | `vite build` **chạy** | `http://localhost:8000` |

Vì chỉ backend được deploy, còn web app chỉ là thư mục `dist/` được copy vào,
nên mọi URL đóng băng lúc build sẽ sai ngay khi deploy đi nơi khác. Đó là lý do
các bundle từng gọi về `localhost:8000` trên production.

Web app lại được serve từ **chính FastAPI, cùng origin**. Nên đóng băng một
absolute URL vào bundle vừa thừa vừa sai.

## Giải pháp

Backend chèn cấu hình thật vào trang lúc serve; frontend đọc lúc chạy.

```
                   ┌─ window.__WEBAPP_CONFIG__  ← server chèn (ưu tiên cao nhất)
resolveApiBase() ──┼─ import.meta.env.VITE_*    ← dev server / deploy độc lập
                   └─ '' (cùng origin)          ← mặc định
```

### Phía backend

`webapp_controller` chèn một thẻ `<script>` ngay sau `<head>`, **trước** mọi
script của app:

```html
<script>window.__WEBAPP_CONFIG__=Object.freeze({"apiBase":"","webappBase":"/webapp"});</script>
```

Cấu hình cũng lấy được qua `GET /webapp/_api/config` (hữu ích khi app chạy trên
Vite dev server nên không nhận được thẻ chèn).

Một app có thể bổ sung khoá riêng qua `"config"` trong `metadata.json`:

```json
{
  "title": "My App",
  "icon": "🧭",
  "config": { "featureFlag": true }
}
```

### Phía frontend

Mỗi project có `runtimeConfig.ts` (trong `src/lib/` hoặc `src/services/`):

```ts
import { resolveApiBase } from './runtimeConfig'

const apiBase = () => resolveApiBase(import.meta.env?.VITE_API_BASE)
const url = `${apiBase()}/sqladmin/databases`
```

**Lưu ý quan trọng**: `apiBase` rỗng là một **câu trả lời hợp lệ** (nghĩa là
"cùng origin, không prefix"), không phải "chưa cấu hình". `resolveApiBase` phân
biệt bằng `typeof === 'string'` chứ không dùng truthy — hiểu nhầm chỗ này sẽ
khiến mọi request quay về URL của máy build.

## Thêm một web app mới

1. Trong project, dùng `resolveApiBase()` thay cho `import.meta.env` trực tiếp.
   Copy `runtimeConfig.ts` từ một project sẵn có.
2. Để `VITE_API_BASE=` **rỗng** trong `.env`. Dev dùng proxy của `vite.config.ts`.
3. Build ra `dist/` (đừng trỏ `outDir` thẳng vào `webapp/` — xem phần Cạm bẫy).
4. Khai báo ánh xạ trong `scripts/build-webapps.mjs`:

   ```js
   { name: 'my-app', dest: 'tranphuc8a/my-app' }
   ```

5. Thêm `metadata.json` vào thư mục đích (`title`, `description`, `tags`, `icon`).

## Lệnh

```bash
node scripts/build-webapps.mjs                    # build + publish tất cả
node scripts/build-webapps.mjs --only sql-administrator
node scripts/build-webapps.mjs --skip-build       # chỉ copy dist/ sẵn có
node scripts/build-webapps.mjs --check            # chỉ kiểm tra, không sửa gì
node scripts/build-webapps.mjs --list             # xem bảng ánh xạ
```

Script **quét bundle sau khi publish** và thoát với mã lỗi nếu tìm thấy địa chỉ
loopback kèm port (`localhost:6789`, `127.0.0.1:5173`…). Đó chính là hình dạng
của một API base bị đóng băng lúc build. Loopback **không có port** được bỏ qua
vì nhiều thư viện dùng `http://localhost` làm placeholder khi thiếu
`window.location`.

Script cũng **giữ lại `metadata.json` đang có ở thư mục đích**, kể cả khi bản
build mang theo một bản khác trong `public/` — bản trong collection mới là bản
portal đọc và là bản người ta sửa tay.

## Cạm bẫy

**Đừng trỏ `outDir` thẳng vào `webapp/`.** `postman-lite` từng làm vậy
(`outDir: '../backend/fastapi/webapp/postman-lite-pro'`) và gặp hai vấn đề: app
rơi vào sai đường dẫn (ngoài collection `tranphuc8a/`), và `emptyOutDir: true`
xoá sạch thư mục đích kể cả file thuộc về collection. Build ra `dist/` rồi để
script publish.

**Admin key không được đặt trong biến `VITE_*`.** Giá trị đó bị biên dịch vào
JavaScript mà mọi người truy cập đều tải về. `markdown-editor` từng có
`VITE_MARKDOWN_ADMIN_KEY`; giờ người dùng tự nhập key, backend xác thực qua
`POST {API_PREFIX}/markdown/admin/verify`, và key chỉ nằm trong bộ nhớ của tab
đó — không ghi vào storage, không nằm trong bundle.

## Kiểm chứng

`backend/fastapi/tests/adapter/input/controller/test_webapp_controller.py` phủ
phần backend: chèn đúng vị trí, đúng thứ tự, theo đúng `API_PREFIX` lúc chạy,
chống thoát thẻ `</script>`, và chặn path traversal ở endpoint config.

Mỗi frontend có `runtimeConfig.test.ts` phủ thứ tự ưu tiên — trong đó có trường
hợp dễ sai nhất: chuỗi rỗng được chèn phải thắng giá trị build-time.
