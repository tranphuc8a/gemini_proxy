# graphuc

Trình vẽ đồ thị phục vụ học **cấu trúc dữ liệu và giải thuật**. Vẽ đồ thị, cây,
danh sách liên kết, heap, trie và các sơ đồ chuẩn; chạy thuật toán từng bước
ngay trên hình vừa vẽ.

```bash
npm install
npm run dev        # http://localhost:5175
npm test
npm run lint
npm run typecheck
npm run build      # -> dist/
```

Xuất bản vào bộ sưu tập web app của FastAPI:

```bash
node ../scripts/build-webapps.mjs --only graphuc
# -> backend/fastapi/webapp/tranphuc8a/graphuc
```

## Ý tưởng thiết kế

**Một mô hình dữ liệu cho mọi loại sơ đồ.** Đồ thị vô hướng, DAG, cây nhị phân,
danh sách liên kết, trie, máy trạng thái — tất cả đều là *đỉnh có toạ độ và cạnh
nối chúng*. Chúng khác nhau ở **ràng buộc**, không phải ở cấu tạo. Vì vậy chỉ có
một kiểu `GraphNode`, một kiểu `GraphEdge`, và một trường `kind` quyết định luật
nào được kiểm tra. Nhờ đó một sơ đồ hoạt động xuất ra rồi nhập lại vẫn sửa được
như một đồ thị bình thường, và biến một cây thành đồ thị tổng quát không cần
bước chuyển đổi nào.

**Ràng buộc được *báo* chứ không *chặn*.** Từ chối cú bấm khiến cây tạm thời có
chu trình sẽ làm trình vẽ không dùng được — việc vẽ thường phải đi qua trạng thái
tạm sai mới tới được hình mong muốn. Thay vào đó, bảng bên phải liệt kê chỗ đang
sai và bấm vào là chọn đúng chỗ đó. Đổi kiểu cũng **không bao giờ xoá gì**: biến
một đồ thị có chu trình thành cây sẽ giữ nguyên chu trình rồi báo cho người dùng.

**Cục bộ trước, máy chủ là tuỳ chọn.** Mọi thay đổi tự lưu vào `localStorage`,
nên app chạy được khi không có backend nào cả. Lưu lên máy chủ cần admin token
và cho chọn một trong ba kho: JSON, MySQL, MongoDB.

**Mọi thay đổi đều hoàn tác được.** Tất cả đi qua đúng một hàm `commit` trong
store — đó là chỗ đẩy checkpoint, đóng dấu `updatedAt`, chạy lại validate và hẹn
giờ lưu. Một action nào đó set thẳng `document` sẽ tạo ra thay đổi không hoàn tác
được, và đó là lỗi một trình soạn thảo không được phép có.

## Cấu trúc

| Đường dẫn | Việc |
|---|---|
| `src/types.ts` | Mô hình tài liệu: node, edge, annotation, kind |
| `src/lib/graph.ts` | Truy vấn cấu trúc (kề, bậc, chu trình, thành phần) và **luật của từng kiểu** |
| `src/lib/layout.ts` | 7 bố cục tự động: cây, phân tầng, toả tròn, vòng tròn, lưới, hai phía, lực hút/đẩy |
| `src/lib/algorithms.ts` | BFS, DFS, Dijkstra, tô-pô, MST, thành phần, 2-phân, tìm chu trình — trả về **từng bước** |
| `src/lib/geometry.ts` | Đường viền đỉnh, đường đi của cạnh, hit-test, khung bao |
| `src/lib/templates.ts` | 14 mẫu dựng sẵn |
| `src/lib/exporters.ts` | JSON, SVG, PNG, PDF, DOT, ma trận kề CSV |
| `src/services/graphStorage.ts` | localStorage + API máy chủ + phiên admin |
| `src/store.ts` | Zustand: tài liệu, lịch sử, lựa chọn, công cụ |
| `src/components/Canvas.tsx` | Mặt vẽ SVG và toàn bộ xử lý con trỏ |

## API máy chủ

`backend/fastapi/src/adapter/input/controllers/graph_storage_controller.py`

| Endpoint | Việc |
|---|---|
| `GET /graphs/_backends` | Kho nào deployment này phục vụ được |
| `POST /graphs/_admin/verify` | Đổi admin key lấy session token |
| `POST /graphs/_admin/session` | Kiểm tra token đã lưu, cấp token mới |
| `GET /graphs` | Danh sách đồ thị (không kèm bản vẽ) |
| `GET /graphs/{id}` | Một đồ thị đầy đủ |
| `PUT /graphs/{id}` | Tạo hoặc ghi đè (cần admin) |
| `DELETE /graphs/{id}` | Xoá (cần admin) |

Mọi endpoint nhận `?backend=json|mysql|mongo`. **Mỗi kho là một kho riêng** —
đồ thị lưu ở kho nào chỉ thấy được ở kho đó.

Cấu hình: `GRAPHUC_STORAGE_BACKEND`, `GRAPHUC_JSON_FILE`, `GRAPHUC_ADMIN_KEY`,
`GRAPHUC_SESSION_HOURS`, và `MONGO_URI` / `MONGO_DATABASE` cho kho mongo. Xem
`backend/fastapi/.env.example`.

## Bảo mật của admin token

Admin key **không bao giờ** nằm trong bundle và **không bao giờ** được lưu ở phía
trình duyệt. Người dùng gõ nó một lần, máy chủ đối chiếu rồi trả về một token ký
HMAC chỉ chứa thời hạn — đó mới là thứ nằm trong `localStorage`. Khoá ký được dẫn
xuất từ chính admin key cộng với một "salt" riêng cho từng app, nên:

- đổi `GRAPHUC_ADMIN_KEY` là vô hiệu hoá mọi token đang lưu hành (không cần danh
  sách phiên phía máy chủ);
- token của graphuc không mở khoá được markdown-editor, kể cả khi hai app dùng
  chung một key.

Mọi so sánh chữ ký dùng `hmac.compare_digest` — dùng `==` sẽ để lộ tiền tố chữ ký
qua thời gian thực thi.

## Cấu hình lúc chạy

App đọc API base lúc chạy chứ không đóng băng lúc build, vì bundle được copy vào
bộ sưu tập FastAPI và phục vụ từ chính origin đó. Xem `docs/webapp-runtime-config.md`.
Luôn để `VITE_API_BASE=` **rỗng**.
