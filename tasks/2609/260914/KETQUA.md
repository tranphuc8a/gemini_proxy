# Kết quả — task 2609/260914

Ngày: 2026-09-14 · Nhánh: `task/260914`

Đã làm hết 5 phần trong `prompt.md`. Tài liệu này ghi lại **nguyên nhân gốc**,
**chỗ sửa** và **cách kiểm chứng**, để phiên sau vào việc được ngay.

---

## 1. Lỗi `[Errno 30] Read-only file system: '/var/task/data'`

**Nguyên nhân.** Bốn kho JSON đều resolve đường dẫn theo `Path.cwd() / "data/…"`.
Trên Vercel, code được giải nén vào `/var/task` và mount **read-only**; chỉ `/tmp`
ghi được. Local không lỗi vì `cwd` là thư mục dự án và ghi được bình thường.

**Cách sửa.** Thêm `src/application/utils/data_paths.py` — một chỗ duy nhất quyết
định thư mục ghi được, theo thứ tự:

1. `DATA_DIR` (env hoặc `.env`) — đặt rồi mà không ghi được thì **báo lỗi to**,
   không im lặng fallback: cấu hình sai phải lộ ra ngay.
2. `./data` — nếu **probe ghi thử thành công**.
3. Thư mục tạm của hệ thống.

Chọn bằng cách **thử ghi** chứ không đoán theo nền tảng: container root-only, CI
runner bị khoá và Vercel đều hỏng giống nhau và đều cần cùng một fallback.

`seeded_data_path()` copy file dữ liệu có sẵn trong bundle sang thư mục ghi được
ở lần dùng đầu — nhờ đó deployment vẫn ship được dữ liệu khởi tạo mà vẫn nhận ghi.

**Bốn chỗ đã đổi:**

- `adapter/input/controllers/markdown_storage_controller.py`
- `adapter/output/postman/json_repository.py`
- `adapter/output/sqlgateway/session_store.py`
- `adapter/output/mongogateway/session_store.py`

**⚠️ Giới hạn phải biết.** `/tmp` trên serverless sống đúng bằng vòng đời instance
và **không chia sẻ giữa các instance**. Trên Vercel, kho JSON chỉ là chỗ nháp,
không phải nơi lưu trữ. Muốn dữ liệu sống qua redeploy thì phải dùng backend
`mysql` hoặc `mongo` — chính là lý do phần 3 quan trọng.

**Kiểm chứng:** `tests/application/test_data_paths.py` (8 test), gồm cả trường hợp
`cwd` read-only và trường hợp `DATA_DIR` sai.

> Không tìm thấy `vercel.json` trong repo — cấu hình deploy nằm ngoài (dashboard
> Vercel). Bản sửa này là **phát hiện lúc chạy**, nên đúng bất kể deploy kiểu gì.

---

## 2. markdown-editor

### 2a. Reload là mất quyền admin

**Nguyên nhân.** `src/services/markdownStorage.ts` cố ý chỉ giữ admin key trong
một biến module — đúng về bảo mật, nhưng mất sạch khi reload.

**Cách sửa.** Đổi key lấy **session token**:

- `src/application/utils/admin_session.py` (backend, dùng chung): token =
  `base64url(json({exp, nonce})) + "." + base64url(hmac_sha256(secret, part))`,
  với `secret = sha256(salt + ":" + admin_key)`.
- `POST /markdown/admin/verify` giờ trả về token; thêm `POST /markdown/admin/session`
  để kiểm tra token đã lưu lúc tải trang và cấp token mới.
- Frontend lưu **token** (không lưu key) vào `localStorage`, tự khôi phục trong
  `hydrate()`.

Ba tính chất quan trọng: key không bao giờ rời máy chủ; token **có hạn**; và
**đổi admin key là vô hiệu hoá mọi token** (vì key được trộn vào khoá ký) — nên
"đổi key" thực sự là một cách thu hồi, dù không có danh sách phiên phía server.

`salt` khác nhau giữa các app, nên token của graphuc không mở được markdown-editor
kể cả khi hai bên dùng chung key.

### 2b. Popup Sync tự ẩn trước khi kịp chọn kho

**Nguyên nhân.** `Header.tsx:311` — `<div className="menu-popover" onClick={() => setOpen(false)}>`
đóng menu khi click vào **bất kỳ** thứ gì bên trong, kể cả `<select>`. Bấm vào
select → menu unmount → dropdown biến mất.

**Cách sửa.** `Menu` chỉ đóng khi click trúng `.menu-item` (một *lệnh*), bỏ qua
phần tử có `data-menu-keep-open` (một *tuỳ chọn đang chỉnh*). Đồng thời thay
`<select>` bằng nhóm radio menu-item — dropdown gốc nằm trong popover là popover
lồng popover, tránh hẳn thì tốt hơn.

**Kiểm chứng:** 3 test regression trong `src/__tests__/components.test.tsx`.

---

## 3. Ba kho lưu trữ: json / mysql / mongo

> Tiêu đề trong prompt ghi "json/mysql/mariadb", phần thân ghi "mysql/mongodb".
> Đã làm theo phần thân. MariaDB dùng chung driver với MySQL nên backend `mysql`
> phục vụ luôn cả hai.

**Backend mới:** `src/adapter/output/mongostore/client.py` — một `AsyncMongoClient`
cho cả process, cấu hình bằng `MONGO_URI` / `MONGO_DATABASE`. Khác hẳn
`mongogateway`, vốn là cầu nối tới server mà người dùng mongo-administrator đăng
nhập vào.

| App | Trước | Sau |
|---|---|---|
| markdown-editor | json, mysql | json, **mysql (có thứ tự)**, **mongo** |
| postman-lite-pro | json, mysql (cấu hình server) | json, mysql, **mongo**, **chọn theo từng request** |
| graphuc (mới) | — | json, mysql, mongo |

Điểm đáng chú ý:

- **Sửa luôn một lỗi tiềm ẩn**: bảng `markdown_files` không lưu thứ tự, nên đọc
  lại từ DB có thể ra cây bị đảo lộn thứ tự anh em. Đã thêm cột `sort_order`
  (kèm `ALTER TABLE` có bọc try/except cho bảng đã tồn tại) và áp dụng cho cả
  mongo.
- **Mỗi backend là một kho riêng**, không phải ba khung nhìn của một kho. Với
  postman, `workspace id` + access key được sinh ra trong đúng một kho — nên
  backend giờ là thuộc tính của `WorkspaceLink`, cố định lúc tạo/kết nối.
- Mỗi app có endpoint `/…/backends` báo kho nào thật sự dùng được, để picker
  không chào `mongo` trên deployment không có MongoDB rồi mới báo lỗi lúc lưu.

**Kiểm chứng:** `tests/support/fake_mongo.py` — bản giả in-memory của phần PyMongo
async mà code thật sự gọi (filter `$in`, `$set`, sort/skip/limit, projection,
`count_documents`, upsert). Nhờ nó, bộ test repository của postman chạy **cùng một
suite trên cả ba backend**, và logic serialise/phân trang/cắt lịch sử của adapter
mongo chạy thật chứ không phải mock.

---

## 4. Ba app light-grid

Cả ba trước đây gần như trùng nhau (~150 dòng mỗi app), và "solver" của v3 chỉ là
placeholder in ra danh sách ô đang sáng, còn ô "Rank" hiển thị
`min(rows*cols, rows+cols)` — một con số đoán, không phải hạng ma trận.

**Engine dùng chung:** `webapp/tranphuc8a/light-grid-shared/` (không có
`index.html` nên portal không liệt kê, nhưng vẫn serve được như tài nguyên tĩnh):

| File | Việc |
|---|---|
| `geometry.js` | 9 hình bàn: chữ nhật, xuyến, vành khuyên, kim cương, tam giác, lục giác, vòng lục giác, chữ thập, hình tròn |
| `rules.js` | 13 luật tác động + dựng **ma trận nước đi** `A` |
| `gf2.js` | Khử Gauss trên GF(2) có ghi vết, hạng, hạt nhân, hạt nhân trái, giải `A·x = b`, tìm lời giải ít nước nhất |
| `board.js` | Trạng thái, undo/redo, xáo bàn, JSON, mã hoá URL |
| `render.js` | SVG (vuông + hex), 6 bảng màu, 5 hình quân cờ, xuất SVG/PNG |
| `theme.css` | Token thiết kế dùng chung |

**Ba app giờ khác hẳn nhau:**

- **v1 · Playground** — để chơi. Chọn hình bàn, luật, số trạng thái mỗi ô (2–6),
  bảng màu, hình quân cờ, xem trước nước bấm. Ván mới được sinh bằng cách **bấm
  ngẫu nhiên từ bàn đã tắt**, nên luôn giải được; "ngẫu nhiên hoàn toàn" là lựa
  chọn riêng có ghi rõ rủi ro. Có gợi ý, tự giải, đồng hồ, kỷ lục theo cấu hình.
- **v2 · Lab** — để thí nghiệm. Mẫu dựng sẵn, chế độ vẽ tay, **băng ghi nước đi**
  có thanh tua, hạng/số chiều nhân/số lời giải cập nhật theo thời gian thực,
  **chạy hàng loạt** hàng trăm bàn để đo tỉ lệ giải được so với dự đoán lý thuyết,
  đồ thị số đèn sáng, import/export/share.
- **v3 · Research** — để hiểu. Toàn bộ tập nghiệm, **mẫu im lặng** (bấm thử để tự
  kiểm chứng), **bất biến** chứng minh một bàn là bất khả thi, ma trận A dạng
  bitmap kèm RREF, **chạy lại từng phép biến đổi hàng**, mô phỏng đuổi đèn, xuất
  ma trận CSV, và phần lý thuyết gắn số liệu của chính bàn đang mở.

**Kiểm chứng.** Engine được đối chiếu với kết quả kinh điển của Lights Out:

| Bàn (luật Cross) | Hạng | Số chiều nhân |
|---|---|---|
| 3×3 | 9 | 0 |
| 4×4 | 12 | 4 |
| 5×5 | 23 | 2 (đúng 4 lời giải) |
| 6×6 | 36 | 0 |
| 9×9 | 73 | 8 |

Bàn 5×5 sáng hết đèn: lời giải ngắn nhất **đúng 15 nước** — khớp kết quả đã biết.
Đã xác minh `A·x = b`, mọi mẫu im lặng thoả `A·q = 0`, và 200 bàn xáo ngẫu nhiên
đều giải được (0 ngoại lệ). Script kiểm chứng nằm trong
`light-grid-shared/README.md`.

---

## 5. graphuc (phần chính)

Project mới ở `/graphuc` — Vite + React + TypeScript + zustand, khớp với các app
anh em. Xuất bản vào `webapp/tranphuc8a/graphuc`.

Quyết định thiết kế, API máy chủ và cấu trúc thư mục: xem `graphuc/README.md`.
Tóm tắt những gì đã có so với yêu cầu trong prompt:

| Yêu cầu | Trạng thái |
|---|---|
| Định nghĩa cấu trúc dữ liệu lưu đồ thị | `src/types.ts` — một mô hình cho mọi loại sơ đồ, `kind` quyết định ràng buộc |
| Nhiều loại đồ thị | 14 kiểu: đơn/đa/có hướng/DAG/flow/cây/nhị phân/BST/heap/danh sách liên kết/trie/máy trạng thái/activity/tự do |
| Nhãn, label, note trên đỉnh và cạnh | ✓ kèm trọng số, sức chứa, luồng, dấu (badge) |
| Lưu local + backend json/mysql/mongo | ✓ local tự lưu; server tuỳ chọn, chọn kho trong thư viện |
| Authenticate bằng admin-token | ✓ dùng chung cơ chế session token với markdown-editor |
| Import/export json, pdf, png | ✓ và thêm SVG, DOT (Graphviz), ma trận kề CSV |
| History undo/redo | ✓ mọi thay đổi đi qua một hàm `commit` duy nhất |
| Format màu, hình đỉnh, loại cạnh | ✓ 9 hình đỉnh, 4 kiểu nét, 3 dáng cạnh, 5 kiểu mũi tên, độ cong, màu |
| Diagram chuẩn khác (activity/flow/state-machine) | ✓ kèm mẫu dựng sẵn |

**Thêm ngoài yêu cầu** (vì app là để *học* thuật toán):

- 7 bố cục tự động, tôn trọng đỉnh được ghim.
- 8 thuật toán chạy **từng bước** với canvas tô sáng theo: BFS, DFS, Dijkstra,
  sắp xếp tô-pô, MST (Kruskal), thành phần liên thông, kiểm tra 2-phân, tìm chu
  trình. Mỗi bước có một câu giải thích.
- Trình kiểm tra ràng buộc theo kiểu, bấm vào là chọn đúng chỗ sai. Kiểm tra BST
  dùng **phương pháp khoảng** — so với con trực tiếp là cách kiểm sai kinh điển,
  nó chấp nhận một cháu bên trái lớn hơn gốc.

---

## Kiểm thử

| Nơi | Lệnh | Kết quả |
|---|---|---|
| Backend | `cd backend/fastapi && .venv/Scripts/python.exe -m pytest tests -q` | **546 pass, 8 fail** |
| markdown-editor | `npx vitest run --pool=threads --no-isolate` | 206 pass |
| postman-lite | `npm test` | 67 pass |
| graphuc | `npx vitest run --pool=threads --no-isolate` | 117 pass |
| Lint | cả 3 app | sạch |
| Typecheck | cả 3 app | sạch |

### Hai vấn đề môi trường (không do task này)

1. **8 test `test_proxy_controller.py` fail** — `respx` và `httpx` trong venv
   không khớp phiên bản: respx nhận được `Request('GET', '/api.example.com')`,
   tức URL bị parse sai trước khi tới mock. Đã xác nhận bằng `git stash` là
   **fail y hệt trước khi sửa gì**. Cần nâng/hạ phiên bản `respx`/`httpx` —
   tách thành việc riêng.
2. **`vitest` với pool `forks` mặc định hay timeout khi khởi động worker** trên
   máy Windows này (jsdom khởi tạo ~10s/file). Chạy
   `npx vitest run --pool=threads --no-isolate` thì 100% pass và nhanh hơn ~6 lần.
   Cân nhắc đặt `pool: 'threads'` trong `vite.config.ts` của các app.

---

## Việc còn mở

- Nâng cấp `respx`/`httpx` để 8 test proxy xanh trở lại.
- Chưa mở app bằng trình duyệt thật để xem bằng mắt — mới kiểm ở mức
  test + build + FastAPI serve đúng file. Nên mở
  `/webapp/tranphuc8a/graphuc/` và 3 app light-grid để soát UI.
- Nếu deploy Vercel và muốn dữ liệu bền: đặt `MONGO_URI` (hoặc dùng MySQL đang
  có) rồi chuyển các app sang backend đó. Kho JSON trên Vercel **không bền**.
- `postman-lite` chưa có test cho picker backend mới (phần store/dialog); backend
  thì đã có.

## Tệp mới đáng nhớ

```
backend/fastapi/src/application/utils/data_paths.py       # nơi được phép ghi file
backend/fastapi/src/application/utils/admin_session.py    # token admin ký HMAC
backend/fastapi/src/adapter/output/mongostore/client.py   # MongoDB của chính deployment
backend/fastapi/src/adapter/output/postman/mongo_repository.py
backend/fastapi/src/adapter/input/controllers/graph_storage_controller.py
backend/fastapi/tests/support/fake_mongo.py               # PyMongo async giả, in-memory
backend/fastapi/webapp/tranphuc8a/light-grid-shared/      # engine chung của 3 app đèn
graphuc/                                                   # webapp mới
```
