# Markdown Editor Pro: liên kết chia sẻ CHỈ ĐỌC một tài liệu (thiết kế, chưa cài)

Ngày 22/10/2026 · pha HIỂU + THIẾT KẾ · không sửa tệp nào trong repo.
Nguồn app: `markdown-editor/` (React + Vite, bản build) → xuất bản thành `backend/fastapi/webapp/tranphuc8a/markdown-editor-pro/`.
Backend: `backend/fastapi` (`/markdown/*`).

## 0. Tóm tắt khuyến nghị

- **Chế độ ẢNH CHỤP (snapshot)** do quản trị viên gửi thẳng từ trình soạn (`docId`, `title`, `content` trong thân POST). Không bắt
  phải "Save to backend" trước, vì lưu là **ghi đè cả cây**, có thể xoá bài của thiết bị khác. "Theo bản mới nhất" (live) để pha sau, tuỳ chọn.
- **Mỗi tài liệu có một liên kết** (`docId` là duy nhất). Chia sẻ lại thì làm mới bản chụp và **giữ token**. Token = `secrets.token_urlsafe(16)` (128 bit).
  Mỗi kho có tối đa 50 liên kết. Có thể đặt hết hạn (không bao giờ / 1 / 7 / 30 ngày).
- Endpoint mới nằm trong một controller riêng `markdown_share_controller.py` theo lục giác: use case → port → 3 adapter json/mysql/mongo.
  Quyền tạo, liệt kê và thu hồi dùng **chính phiên quản trị markdown** (`X-Admin-Session` / `X-Admin-Key`). Đọc thì công khai, đếm theo IP.
- **Trang xem nằm trong chính app**: `…/markdown-editor-pro/#share=<token>&backend=<kho>`, cùng dạng `#share=` của Code Studio.
  `main.tsx` rẽ nhánh trước khi dựng trình soạn. Trang xem không đăng ký service worker, không đọc kho cục bộ hay phiên quản trị của người xem.
  Nó dùng lại **đúng** pipeline `MarkdownView` (GFM, KaTeX, Mermaid `strict`, rehype-sanitize) và giao diện chế độ đọc.
- Token **không bao giờ nằm trong URL mà máy chủ nhìn thấy**. Trang dùng `#`. API đọc nhận token qua header `X-Share-Token` (khác Code Studio,
  ở đó token nằm trong path và lọt vào access log). Thu hồi theo `docId`.
- Trang xem được gia cố: meta `robots noindex`, `referrer no-referrer`, **CSP bằng meta chèn lúc khởi động**. API trả `no-store` + `X-Robots-Tag`.
  Liên kết nội bộ tới tài liệu khác bị vô hiệu (hiện thành chữ). Ảnh `data:` đi cùng bản chụp (tính vào trần 2 MB).
- Phần dùng chung với Code Studio: tách một module thuần `application/utils/share_links.py` (sinh token, băm nội dung, lỗi 429, bộ chặn
  đọc công khai). Code Studio **giữ nguyên** trong đợt này; refactor sang module chung là việc tuỳ chọn.
- **Trước khi bật cho người ngoài, chủ dự án cần biết hai điều** (xem §2): (1) toàn bộ kho markdown hiện **ai cũng đọc được**
  (`GET /markdown/files` không cần quyền); (2) khoá quản trị mặc định `markdown-editor-admin-2024` in công khai trong repo, và `.env` cục bộ không đặt khoá khác.

---

## 1. Hiện trạng (đã kiểm, kèm dẫn chứng)

### 1.1 Backend `/markdown/*`

| Điều | Dẫn chứng |
| --- | --- |
| Cả tính năng nằm trong **một controller**, không có use case/port/adapter (khác kiến trúc lục giác của phần còn lại) | `backend/fastapi/src/adapter/input/controllers/markdown_storage_controller.py:1-323` |
| Ba kho chọn bằng `?backend=json\|mysql\|mongo`; mặc định `MARKDOWN_STORAGE_BACKEND` | `markdown_storage_controller.py:41,69-75`; `src/application/config/config.py:51-56` |
| **Một cây tài liệu toàn cục cho mỗi kho** (không có không gian/người dùng). `PUT /markdown/files` **xoá hết rồi chèn lại cả cây** | `markdown_storage_controller.py:187-200` (MySQL `DELETE FROM markdown_files`), `220-237` (Mongo `delete_many({})`), `315-318` (JSON ghi đè tệp) |
| `GET /markdown/files` **công khai**, không kiểm quyền; test khẳng định điều này | `markdown_storage_controller.py:293-302`; `tests/adapter/input/controller/test_markdown_storage_controller.py:130-132`; `markdown-editor/README.md:332` ("Reads are public") |
| Ghi cần quản trị: khoá thô `X-Admin-Key` **hoặc** token HMAC `X-Admin-Session` (đổi khoá ở `/markdown/admin/verify`, làm mới ở `/admin/session`, salt `markdown-editor`, mặc định 12 giờ) | `markdown_storage_controller.py:35-37,82-98,258-290`; `src/application/utils/admin_session.py` |
| So khoá bằng `==` (không hằng thời gian) và **không có giới hạn số lần sai** | `markdown_storage_controller.py:90` |
| Khoá mặc định `markdown-editor-admin-2024` nằm trong code, `.env.example` và README | `config.py:53`; `backend/fastapi/.env.example:200`; `markdown-editor/README.md:134` |
| `.env` cục bộ **không có biến `MARKDOWN_*` nào** (đếm tên biến, không in giá trị) | lệnh `grep -c -i markdown backend/fastapi/.env` → `0` |
| Bảng MySQL tự tạo bằng `CREATE TABLE IF NOT EXISTS` (không Alembic), `id VARCHAR(255)` là khoá chính | `markdown_storage_controller.py:152-172` |
| Lỗi dùng `HTTPException` (chuỗi tiếng Anh, `data: null`), không có `data.code` | `markdown_storage_controller.py:72-74,97-98`; envelope ở `src/main.py:117-120` |
| Router đăng ký với `API_PREFIX` | `src/main.py:6,68` |

### 1.2 Mẫu chia sẻ của Code Studio (để dùng lại)

| Điều | Dẫn chứng |
| --- | --- |
| 4 route: `POST/DELETE …/items/{itemId}/share`, `GET …/shares`, `GET /codestore/shared/{token}` (công khai, khai báo trước route có tham số) | `codestore_controller.py:73-86,114-149` |
| Luật: bản chụp; chia sẻ lại giữ token và `sharedAt`; ≤ 50 liên kết; xoá bản ghi hoặc không gian thì thu hồi; token lạ, sai dạng và đã thu hồi trả **cùng một** 404; đọc 120 lượt/phút/IP, token sai 20 lần/10 phút/IP (tách khỏi bộ đếm khoá sai); token không bao giờ ghi log | `codestore_usecase.py:20-26,74-76,337-397`; `codestore_factory.py:75-93`; `docs/code-studio-api.md:223-263` |
| `public_item` bỏ trường riêng tư (`pinned/openTabs/activeFile`), không có workspace hay đồng hồ máy chủ | `codestore_usecase.py:109-117`; `codestore_vo.py:36` |
| Bảng `codestore_shares`: khoá chính `token`, `UNIQUE (workspace_id, item_id)`, `name` và ngày là cột để liệt kê mà không đọc bản chụp | `adapter/output/codestore/mysql_repository.py:54-68` |
| Mongo: `_id` = token, chỉ mục duy nhất tạo trong try/except | `adapter/output/codestore/mongo_repository.py:14-17,92-97` |
| Giao diện: `#share=<token>&backend=` (token sau `#`), hộp thoại có Chép / Mở / Cập nhật bản chụp / Thu hồi + danh sách liên kết khác | `webapp/tranphuc8a/code-studio/assets/core/share.js:1-40`, `assets/ui/share.js:14-84`, `assets/ui/share-view.js` |
| Điểm yếu đã ghi nhận: token trong **path** của API → có thể lọt vào access log của uvicorn/Vercel | `docs/code-studio-api.md:262-263` |

### 1.3 Frontend `markdown-editor/`

| Điều | Dẫn chứng |
| --- | --- |
| Đồng bộ là **thủ công, cả cây**: "Load from backend" thay toàn bộ cây cục bộ; "Save to backend" PUT cả cây (chỉ khi là quản trị) | `src/store.ts:568-582`; `src/services/markdownStorage.ts:213-234`; menu `src/components/Header.tsx:299-339` |
| Phiên quản trị: token trong `localStorage['markdown-editor:admin-session']`; `adminHeaders()` là hàm **riêng** của module | `src/services/markdownStorage.ts:22,33,53-65` |
| Gốc API lấy lúc chạy (`window.__WEBAPP_CONFIG__.apiBase`) | `src/services/runtimeConfig.ts:110-136` |
| ID tài liệu do client sinh: `<prefix>-<base36 time>-<counter>-<rand>` (`welcome`, `root` cho mặc định) | `src/lib/id.ts:8-11`; `src/store.ts:132-146` |
| Một pipeline hiển thị cho cả preview và chế độ đọc: `rehypeRaw → rehypeEnhance → rehypeSanitize(schema) → rehypeKatex`; Mermaid `securityLevel:'strict'`; liên kết ngoài mở `_blank` + `noopener noreferrer` | `src/components/MarkdownView.tsx:16-18,39-48,66`; `src/components/MermaidDiagram.tsx:14-19` |
| Schema làm sạch cho phép `style` trên **mọi** thẻ, `clobberPrefix: ''`; ảnh `data:image/*` chỉ được giữ cho `<img>` | `src/lib/rehypeEnhance.ts:5-18,117-169` (dòng 144) |
| Chế độ đọc (`?read=1`) đọc **trực tiếp** từ store của trình soạn và ghi cờ `?read=1` lên URL. Comment "from a shared link" thực ra mở tài liệu **của chính người xem** | `src/components/ReadingView.tsx:56-65`; `src/readingStore.ts:54-65`; `src/App.tsx:70-71` |
| Hộp thư `?import=1` + `localStorage['markdown-editor:inbox']` (hợp đồng phải giữ) | `src/lib/inbox.ts:1-50` |
| Giao diện app bằng **tiếng Anh** (menu, toast, palette) | `Header.tsx:255-339`, `CommandPalette.tsx:49-89` |

### 1.4 PWA, phục vụ trang, bảo mật trang

| Điều | Dẫn chứng |
| --- | --- |
| `initPwa()` gọi vô điều kiện, **mọi người** vào trang (bản production, http/https) đều đăng ký SW, rồi SW lưu ≈ 425 tệp / 5,5 MB | `src/main.tsx:7`; `src/lib/pwa.ts:126-146`; bàn giao `tasks/2610/261017/portal-markdown-chi-tieu/ban-giao.md:18` |
| SW chỉ đụng GET cùng origin **dưới phạm vi app**; API (`/api/v1/markdown/...`) nằm ngoài nên không bao giờ bị cache. Khoá cache bỏ query (`?read=1` = cùng trang) | `markdown-editor/pwa/sw.js:11-14,35,112-121` |
| Máy chủ chèn `<script>window.__WEBAPP_CONFIG__=…</script>` **inline** vào `<head>` của `index.html`; không có header CSP/X-Frame/Referrer cho webapp (chỉ trang tài sản khoá học có CSP) | `src/adapter/input/controllers/webapp_controller.py:177-204`; `grep Content-Security-Policy src/` → chỉ `course_controller.py:451` |
| Kích thước bản build: entry `index-*.js` 219 KB, `markdown-*.js` 612 KB (remark/rehype/katex), `react-*.js` 133 KB | `ls -la …/markdown-editor-pro/assets` |
| Rủi ro CSP thấp: bản build **không có** `new Function(`. `Function('return this')` chỉ là nhánh dự phòng của lodash (không chạy khi có `self`). Chữ `eval(` chỉ nằm trong regex ngữ pháp Prism (`pure-*.js`, `sas-*.js`) | lệnh grep trên `assets/*.js` (§7) |

### 1.5 Mốc test hiện tại (đã chạy)

- `pytest tests/adapter/input/controller/test_markdown_storage_controller.py tests/application/test_codestore_shares.py tests/adapter/input/controller/test_codestore_controller.py -q` → **85 passed** (8,5 s).
- `cd markdown-editor && npx vitest run` → **367 passed / 21 tệp** (≈ 123 s).

---

## 2. Phát hiện

| # | Mức | Phát hiện | Hệ quả cho thiết kế |
| --- | --- | --- | --- |
| P1 | **cao** | Kho markdown **đọc công khai toàn bộ** (§1.1) | "Chia sẻ một trang" hôm nay không thêm riêng tư: người ngoài vốn đã đọc được mọi thứ qua "Load from backend". Liên kết chia sẻ chỉ thật sự có nghĩa khi kho được đóng lại. Đề xuất cờ `MARKDOWN_PUBLIC_READ` (mặc định `true` để giữ tương thích), chủ dự án quyết định có lật hay không (việc V17) |
| P2 | **cao** | Khoá quản trị mặc định công khai (`config.py:53`, README:134). `.env` cục bộ không đặt khoá. Môi trường triển khai **chưa kiểm** (suy đoán: nếu Vercel cũng không đặt thì ai cũng là quản trị) | Quyền tạo liên kết = quyền quản trị. Cần chủ dự án xác nhận biến môi trường production; đề xuất thêm bộ đếm khoá sai + so sánh hằng thời gian + cảnh báo khi dùng khoá mặc định (việc V16) |
| P3 | vừa | Lưu = ghi đè cả cây; không có hợp nhất | Bản chụp **không** được lấy từ kho máy chủ (bắt lưu trước có thể xoá bài của thiết bị khác). Lấy nội dung từ thân POST |
| P4 | vừa | `initPwa()` vô điều kiện | Người xem ẩn danh sẽ tải 5,5 MB bộ nhớ đệm offline chỉ để đọc một trang → trang xem **không** đăng ký SW |
| P5 | vừa | Không có CSP; config được chèn bằng script inline | CSP qua header cho cả app cần nonce và sẽ đụng mọi tính năng (PDF/PNG…). Trước mắt: CSP **meta chèn khi vào chế độ chia sẻ** (sau khi config đã chạy) |
| P6 | vừa | Token Code Studio nằm trong path API | Markdown dùng header `X-Share-Token` để token không vào access log |
| P7 | thấp | Schema cho `style` trên mọi thẻ | Tác giả là quản trị viên (đáng tin), nhưng nếu dán HTML lạ thì có thể vẽ lớp phủ `position:fixed` hoặc chèn ảnh nền theo dõi. CSP `img-src` giới hạn phần tải; ghi vào rủi ro, chưa đổi schema chung |
| P8 | thấp | ReadingView gắn chặt vào store của trình soạn và cờ `?read=1` | Tách phần trình bày `ReadingSurface` (props) để trang chia sẻ dùng lại |
| P9 | thấp | Liên kết tương đối `[x](khac.md)` và ảnh tương đối vốn đã hỏng trong app (không có kho tài sản) | Trang chia sẻ hiện chúng thành chữ hoặc chỗ giữ ảnh. Hộp thoại cảnh báo trước khi chia sẻ |
| P10 | thấp | Xoá tài liệu cục bộ, máy chủ không biết (local-first) | Không tự thu hồi. Hộp thoại đánh dấu liên kết "mồ côi" (`docId` không còn trong cây) để chủ tự thu hồi |

---

## 3. Thiết kế chi tiết

### 3.1 Mô hình

- **Liên kết** = `(token, docId, title, mode, sharedAt, updatedAt, expiresAt?, bytes, contentHash, content)`, một hàng/tài liệu ở mỗi kho.
- `mode` hiện chỉ có `"snapshot"`. Cột dành sẵn cho `"live"` (pha sau) để khỏi phải `ALTER TABLE` trên MySQL; `CREATE TABLE IF NOT EXISTS` không tự thêm cột.
- Mỗi kho (json/mysql/mongo) là một nơi riêng, giống `/codestore`. Liên kết luôn kèm `&backend=`.
- Tạo/liệt kê/thu hồi: chỉ quản trị viên. Đọc: ai có token.
- Bản chụp không bao giờ đổi cho tới lần "Update snapshot" kế tiếp (giữ token). Thu hồi rồi tạo lại thì ra **token mới**.
- Hết hạn: `expiresAt` (ms) hoặc `null`. Hết hạn thì đọc trả cùng 404 như đã thu hồi. Liên kết hết hạn vẫn chiếm chỗ trong hạn mức
  cho tới khi bị làm mới hoặc thu hồi; khi hạn mức đầy, use case dọn liên kết hết hạn trước rồi mới từ chối.

### 3.2 API (tiền tố `API_PREFIX`, mặc định `/api/v1`)

| Method + path | Quyền | Vào | Ra |
| --- | --- | --- | --- |
| `POST /markdown/shares?backend=` | quản trị (`X-Admin-Session` hoặc `X-Admin-Key`) | `{"docId", "title", "content", "expiresInDays": null\|1\|7\|30, "mode": "snapshot"}` | `201` (mới) / `200` (làm mới, giữ token + `sharedAt`): `{"token","docId","title","mode","sharedAt","updatedAt","expiresAt","bytes","contentHash"}` |
| `GET /markdown/shares?backend=` | quản trị | — | `{"shares":[summary…], "limits":{"maxShares":50,"maxBytes":2000000}, "persistent": true}`. Mới chia sẻ trước; **không** có `content` |
| `DELETE /markdown/shares?backend=&docId=<urlencoded>` | quản trị | — | `{"revoked": true}`; chưa có → 404 `markdown_share_not_found` |
| `GET /markdown/shared?backend=` + header `X-Share-Token: <token>` | **công khai** | — | `{"title","content","mode","sharedAt","updatedAt","expiresAt"}` |

- Mọi phản hồi có `Cache-Control: no-store`. Đọc công khai có thêm `X-Robots-Tag: noindex, nofollow, noarchive` và `X-Content-Type-Options: nosniff`.
- Đọc công khai **không** trả `docId`, token, `contentHash`, `bytes`, tên kho, thư mục cha hay đường dẫn trong cây (tên thư mục có thể riêng tư).
- Pydantic: `docId` 1–255 ký tự; `title` 1–200; `content` ≤ 4.000.000 ký tự (trần cứng theo body 4,5 MB của Vercel). Trần **byte** cấu hình được, kiểm ở use case.
  Header `X-Share-Token` dài ≤ 100. Token sai dạng vẫn trả 404 (không trả 422) để không phân biệt được.
- Mã lỗi (envelope `{status_code, message, data:{code,…}}`; thông báo tiếng Việt theo quy ước backend):

| HTTP | `data.code` |
| --- | --- |
| 400 | `markdown_share_too_large` (+`limit`, `bytes`), `markdown_share_bad_input` (ký tự điều khiển trong `docId`/`title`, tiêu đề rỗng sau khi cắt), `markdown_too_many_shares` (+`limit`), `markdown_bad_backend`, `markdown_share_bad_expiry` |
| 403 | phiên/khoá quản trị sai (giữ cách hiện tại của `_check_admin`) |
| 404 | `markdown_share_not_found` (đọc token lạ/sai dạng/thu hồi/hết hạn, cùng một thông báo; thu hồi `docId` chưa chia sẻ) |
| 422 | sai schema (quá dài…) |
| 429 | `markdown_rate_limited` + `retryAfter` + header `Retry-After` |
| 503 | `markdown_backend_unavailable` (chọn mongo khi chưa có `MONGO_URI`) |

Lý do dùng header thay vì path: token là khoá đọc. Ở trang, token nằm sau `#` nên trình duyệt không gửi lên máy chủ. Nếu API đọc lại đặt token
trong path thì token vẫn rơi vào access log của uvicorn/Vercel (đã ghi ở `docs/code-studio-api.md:262`). Header không bị log mặc định.
Đổi lại, API này khác Code Studio. Chủ dự án quyết ở Q2.

### 3.3 Domain, port, use case

`src/domain/vo/markdown_share_vo.py`

```python
MAX_SHARE_CHARS = 4_000_000          # trần Pydantic; trần byte thật là cấu hình
ShareMode = Literal["snapshot"]      # "live" thêm ở pha sau
class MarkdownShareIn(BaseModel):    # thân POST
    docId: str = Field(..., min_length=1, max_length=255)
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(default="", max_length=MAX_SHARE_CHARS)
    expiresInDays: Optional[Literal[1, 7, 30]] = None
    mode: ShareMode = "snapshot"
class MarkdownShareSummary(BaseModel):
    token: str; doc_id: str; title: str; mode: str
    shared_at: int; updated_at: int; expires_at: Optional[int] = None
    bytes: int; content_hash: str
class MarkdownShareRecord(MarkdownShareSummary):
    content: Optional[str] = None    # None chỉ cho "live" (pha sau)
```

`src/application/ports/output/markdown_share_repository_port.py` (ABC, bất đồng bộ):
`get_by_doc(doc_id) -> Summary|None` · `save(record) -> Summary` (đã có thì **giữ token và shared_at**, chỉ thay title/content/updated_at/expires_at/bytes/hash)
· `count() -> int` · `list() -> [Summary]` (shared_at giảm dần, hoà thì theo doc_id; không đọc content) · `get(token) -> Record|None` (tra theo chỉ mục)
· `delete_by_doc(doc_id) -> bool` · `purge_expired(now) -> int`.
Input port `markdown_share_input_port.py` theo mẫu `codestore_input_port.py`.

`src/application/usecases/markdown_share_usecase.py` (`MarkdownShareUseCase`). Hàm khởi tạo nhận
`repository, clock=now_ms, token_factory=new_share_token, max_shares=50, max_bytes=2_000_000, read_limiter=None, miss_limiter=None, persistent=True`.

- `create_or_refresh(req) -> (created: bool, summary)`:
  1. Cắt khoảng trắng `title`. Từ chối nếu rỗng, nếu có ký tự điều khiển (Unicode `Cc`, như `codestore_usecase._has_control`), hoặc nếu `docId` có ký tự điều khiển.
  2. `bytes = len(content.encode("utf-8"))`; vượt `max_bytes` → 400 `markdown_share_too_large`.
  3. `existing = get_by_doc`. Chưa có và `count() >= max` thì `purge_expired(now)`, đếm lại, vẫn đầy → 400 `markdown_too_many_shares`.
  4. `expires_at = now + days*86400000` hoặc `None`. `content_hash = sha256(content)`.
  5. `save(Record(token=existing.token if existing else token_factory(), shared_at=existing.shared_at if existing else now, updated_at=now, …))`.
- `list_shares() -> {"shares", "limits", "persistent"}`. Mỗi mục thêm `expired: bool` theo `clock()`.
- `revoke(doc_id)` → `delete_by_doc`; không có → 404.
- `read_shared(token, ip)`:
  1. `guard.admit(ip)` (§3.6): token sai đang bị phạt → 429; đọc quá nhanh → 429; rồi đếm lượt đọc.
  2. Token sai dạng (`^[A-Za-z0-9_-]{16,100}$`), không tìm thấy, hoặc đã hết hạn → `guard.missed(ip)` rồi ném 404 `SHARE_NOT_FOUND`
     (một chuỗi duy nhất: "Liên kết chia sẻ không tồn tại, đã hết hạn hoặc đã bị thu hồi").
  3. Trả `{"title","content","mode","sharedAt","updatedAt","expiresAt"}`.
- **Không bao giờ log token hay nội dung.** Lỗi phía kho thì log tên lớp lỗi, không kèm tham số.

### 3.4 Lưu trữ

**JSON** (`src/adapter/output/markdownshare/json_repository.py`): tệp `MARKDOWN_SHARES_JSON_FILE` (mặc định `data/markdown-shares.json`) qua `seeded_data_path`.

```json
{"version": 1, "shares": {"<token>": {"docId": "file-…", "title": "…", "mode": "snapshot", "sharedAt": 0,
  "updatedAt": 0, "expiresAt": null, "bytes": 1234, "contentHash": "<sha256>", "content": "# …"}}}
```

Toàn bộ nằm trong RAM, có chỉ mục `doc_id → token`, khoá bằng `asyncio.Lock`. Ghi ra tệp tạm rồi `os.replace`. Tệp hỏng thì đổi tên thành `.corrupt` và bắt đầu rỗng
(chép cách làm ở `codestore/json_repository.py:30-80`). Trường hợp xấu nhất 50 × 2 MB = 100 MB ghi lại mỗi lần chia sẻ. Ghi vào rủi ro; nếu lo thì hạ `MARKDOWN_SHARE_MAX_BYTES` cho kho JSON.

**MySQL** (`mysql_repository.py`), tạo lúc dùng lần đầu bằng `CREATE TABLE IF NOT EXISTS`, cùng cách với `markdown_files` và `codestore_shares`:

```sql
CREATE TABLE IF NOT EXISTS markdown_shares (
    token VARCHAR(64) NOT NULL PRIMARY KEY,
    doc_id VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    mode VARCHAR(16) NOT NULL,
    shared_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    expires_at BIGINT NULL,
    bytes INTEGER NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    content LONGTEXT NULL,
    UNIQUE (doc_id)
)
```

`save` làm theo `codestore/mysql_repository.py:277-309`: `UPDATE … WHERE doc_id` → không khớp hàng nào thì `INSERT`, gặp `IntegrityError` (hai yêu cầu cùng tạo) thì rollback và thử lại một lần.
Liệt kê chỉ `SELECT` các cột tóm tắt (không đọc `content`). Câu lệnh SQL chỉ dùng cú pháp chung có tham số, nên test chạy được trên SQLite.
`UNIQUE` trên `VARCHAR(255)` utf8mb4 = 1020 byte: MySQL 8 InnoDB DYNAMIC cho tới 3072 byte. Khoá chính `markdown_files.id VARCHAR(255)` đang chạy được, nên giới hạn này ổn.

**Mongo** (`mongo_repository.py`): collection `markdown_shares`, `_id` = token, các trường snake_case như cột SQL. Chỉ mục duy nhất `doc_id` tạo bằng try/except
(như `codestore/mongo_repository.py:92-97`). Liệt kê dùng projection loại `content`. Test bằng `tests/support/fake_mongo.py`.

### 3.5 Factory, cấu hình, controller

- `src/adapter/factory/markdown_share_factory.py`: `resolve_backend` (AppException có `code`), mỗi kho cache một use case, bộ đếm dùng chung qua
  `build_rate_limiter("markdown_share_reads", MARKDOWN_SHARE_READS_PER_MIN, 60)` và `("markdown_share_misses", 20, 600)`, `reset_for_tests()`.
  `persistent` của kho JSON: thêm hàm công khai nhỏ `data_paths.is_temporary_data_root()`, cùng logic với `codestore_factory._json_status`
  (`codestore_factory.py:130-141`). Code Studio giữ nguyên.
- `config.py` + `.env.example` + `backend/fastapi/README.md`: `MARKDOWN_SHARES_JSON_FILE="data/markdown-shares.json"`, `MARKDOWN_MAX_SHARES=50`,
  `MARKDOWN_SHARE_MAX_BYTES=2_000_000`, `MARKDOWN_SHARE_READS_PER_MIN=120`.
- Kiểm quyền: đổi `_check_admin` trong `markdown_storage_controller.py` thành hàm công khai `check_markdown_admin`, giữ `_check_admin = check_markdown_admin`
  để test cũ chạy nguyên. Vẫn đọc `os.getenv("MARKDOWN_ADMIN_KEY")` vì test dùng `monkeypatch.setenv`.
  Thêm dependency `require_markdown_admin(x_admin_key=Header(None, max_length=200), x_admin_session=Header(None, max_length=600))`.
- `src/adapter/input/controllers/markdown_share_controller.py`: `APIRouter(prefix="/markdown", tags=["markdown-share"])`, bốn route ở §3.2, `client_address(request)`
  (`admin_auth.py:95-103`), JSONResponse kèm header. Đăng ký ở `src/main.py` cạnh `markdown_storage_controller`.

### 3.6 Phần dùng chung với Code Studio

`src/application/utils/share_links.py` (thuần, không biết HTTP):

```python
SHARE_TOKEN_BYTES = 16                                  # 128 bit
TOKEN_SHAPE = re.compile(r"^[A-Za-z0-9_-]{16,100}$")
def new_share_token() -> str: return secrets.token_urlsafe(SHARE_TOKEN_BYTES)
def content_hash(text: str) -> str: return hashlib.sha256(text.encode("utf-8")).hexdigest()
def rate_limited(code: str, message: str, wait: int) -> AppException   # 429 + retryAfter + Retry-After
class PublicReadGuard:
    def __init__(self, reads: LimiterLike | None, misses: LimiterLike | None, *, code: str): ...
    async def admit(self, ip: str) -> None    # đang bị phạt vì token sai → 429; đọc quá nhanh → 429; rồi đếm lượt đọc
    async def missed(self, ip: str) -> None   # đếm một token sai
```

Ngữ nghĩa sao y `codestore_usecase.read_shared` (`codestore_usecase.py:380-397`). Không làm: một bảng `share_links` chung cho mọi app,
vì phải di chuyển dữ liệu `codestore_shares` đang chạy. Tuỳ chọn V18: cho `CodestoreUseCase.read_shared` và `create_share` dùng `PublicReadGuard`/`new_share_token`,
có 85 test hiện có che chắn.
Phía giao diện dùng lại **định dạng** `#share=<token>&backend=<kho>` (Code Studio là JS thuần, không chung mã được) và mã QR viết tay của cổng
(`_portal/assets/js/core/qr.js`, 11 KB, phiên bản 1–10, ≤ 271 byte) chuyển sang TS.

### 3.7 Frontend

**Tệp mới / sửa** (nguồn `markdown-editor/src/`):

1. `lib/share.ts` (thuần):
   - `TOKEN_RE`, `parseShareHash(hash) → {token, backend} | null` (backend nằm trong `json|mysql|mongo`, decode an toàn).
   - `shareHashFor(token, backend)`, `shareLinkFor(pageUrl, token, backend)` (bỏ `?…` và `#…` của trang hiện tại).
   - `classifyHref(href) → 'anchor' | 'external' | 'internal' | 'blocked'`: `#…` / `http(s):`, `mailto:`, `tel:` / tương đối / rỗng.
   - `scanDocumentRefs(markdown) → {internalLinks, relativeImages, externalImages, dataImages}`: regex đơn giản cho `[..](..)`, `![..](..)`,
     `<a href>`, `<img src>`, bỏ qua khối code. Chỉ dùng để cảnh báo.
   - `utf8Bytes(text)`, `shareTitleFromName(name)` (bỏ `.md`/`.markdown`/`.txt`, cắt 200 ký tự).
2. `services/shareClient.ts`: `createShare(input, backend)`, `listShares(backend)`, `revokeShare(docId, backend)`, `readShared(token, backend)`.
   Lớp `ShareError {code, status, retryAfter}` đọc envelope `{message, data:{code, retryAfter}}`. Hết giờ sau 10 s như `markdownStorage.request`.
   `readShared` gửi `X-Share-Token`, `credentials: 'omit'`, `cache: 'no-store'`, **không** gửi header quản trị.
   `services/markdownStorage.ts` xuất thêm `adminSessionHeaders()` (bọc `adminHeaders()` hiện có).
3. `components/MarkdownView.tsx`: thêm prop `links?: 'app' | 'shared'` (mặc định `'app'` = hành vi hiện tại). Khi `'shared'`:
   - `a`: `internal`/`blocked` → `<span class="md-dead-link" title="Links to another document that isn't part of this share">`. `external` → giữ `_blank` + `noopener noreferrer`. `anchor` giữ nguyên.
   - `img`: thêm `referrerPolicy="no-referrer"`; `src` tương đối → `<span class="md-missing-image">[image: alt]</span>`.
   - ô task: `disabled`.
4. `components/ReadingSurface.tsx` (tách từ `ReadingView.tsx`): nhận `content`, `title`, `onClose?`, `ariaLabel`, `barActions?: ReactNode`, `links`, `footer?`.
   Không có `onClose` thì ẩn nút thoát và phím Esc chỉ đóng bảng điều khiển. `ReadingView` trở thành vỏ mỏng đọc từ store như cũ.
   `readingStore` thêm `loadSettings()` để nạp cài đặt đọc mà **không** đụng `?read=1`.
5. `boot.ts` (mới, kiểm được) và `main.tsx`:

   ```ts
   const share = parseShareHash(location.hash)
   if (share) { hardenSharePage(apiOrigin); import('./share/SharePage').then(m => render(<m.default {...share} />)) }
   else { initPwa(); render(<App />) }
   window.addEventListener('hashchange', () => { if (!!parseShareHash(location.hash) !== !!share) location.reload() })
   ```

   `hardenSharePage` chèn vào đầu `<head>`: `<meta name="robots" content="noindex,nofollow,noarchive">`, `<meta name="referrer" content="no-referrer">` và
   `<meta http-equiv="Content-Security-Policy">` với
   `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' https:; font-src 'self' data:; connect-src 'self' <origin API nếu khác>; manifest-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'`.
   Script config inline đã chạy trước đó nên không bị chặn. Bản đầu `App` vẫn import tĩnh, chỉ `SharePage` tải lười. Tải lười cả `App` là tối ưu tuỳ chọn.
6. `share/SharePage.tsx` + `.css`: trạng thái `loading | ready | notFound | rateLimited(retryAfter) | offline | error`. Khi sẵn sàng thì dùng `ReadingSurface`
   (`links='shared'`, không nút thoát), `document.title = "<title> · Shared (read-only)"`. Nút trên thanh: Contents, Text settings (có sẵn),
   **Download .md** (`exportMarkdown`), **Print**. Dòng phụ "Read-only · shared <ngày> · updated <ngày> · expires <ngày>".
   Thông báo lỗi bằng tiếng Anh như app: không tìm thấy / hết hạn / thu hồi → "This link doesn't exist, has expired, or was revoked by its owner."
   Lỗi có `role="alert"`, có nút "Try again" khi offline hoặc khi bị 429.
7. `components/ShareDialog.tsx` + `.css` (theo mẫu `InstallModal`: `role="dialog"`, `aria-modal`, `useFocusTrap`):
   - Chưa mở tài liệu → "Open a document first". Chưa là quản trị → giải thích và nút "Unlock admin mode…" (mở `AuthModal`).
   - Mở hộp thoại thì gọi `listShares(backendStorageType)`. Tìm `mine` theo `currentFileId`.
   - **Chưa có liên kết**: ô Title (mặc định theo tên tệp), chọn Expires (Never/1 day/7 days/30 days), dòng dung lượng "1.2 MB of 2 MB" (đỏ và khoá nút khi vượt),
     cảnh báo từ `scanDocumentRefs` ("3 links point to other documents. Viewers will see them as plain text." / "2 images load from other sites."),
     nút **Create link**.
   - **Đã có**: ô URL chỉ đọc + **Copy** (`navigator.clipboard`, dự phòng chọn chữ) + **Open** + **QR** (tuỳ chọn V12) + "Snapshot from <ngày>".
     Nếu `sha256(currentContent) !== contentHash` (chỉ khi có `crypto.subtle`) thì báo "The document changed since this snapshot".
     Có thêm **Update snapshot** và **Revoke link…** (hỏi lại: "Anyone holding the link will lose access. Sharing again creates a different link.").
   - `<details>` "Other shared documents (n)": tiêu đề, ngày, Copy, Revoke. Đánh dấu "not in this editor" nếu `docId` không còn trong cây cục bộ.
   - Cảnh báo `persistent:false`: "This server keeps links in a temporary file. They stop working when it restarts. Choose MySQL or MongoDB under Storage."
   - Ghi chú: "Anyone with the link can read this snapshot, but cannot edit it or see your other documents. Don't share secrets."
8. Nối dây: `App.tsx` thêm state `shareOpen` + `<ShareDialog>`. `Header.tsx` thêm mục **"Share read-only link…"** (`IconLink2`) vào menu File (sau Export HTML).
   `CommandPalette.tsx` thêm `share` khi đang mở một tệp. Store **không** đổi.
9. (Tuỳ chọn) `lib/qr.ts`: chuyển `_portal/assets/js/core/qr.js` sang TS (`encode(text) → {size, modules}`, `toSvg`). Dialog hiện SVG khi bấm "QR".

### 3.8 Bảo mật trang xem

- **XSS**: một pipeline duy nhất như hiện tại (§1.3), làm sạch **sau** `rehypeRaw`, KaTeX `trust:false` mặc định, Mermaid `strict` (DOMPurify).
  Tiêu đề chỉ đi vào React text và `document.title`, không bao giờ vào `dangerouslySetInnerHTML`.
- **CSP**: dùng meta ở chế độ chia sẻ (§3.7-5). Theo spec, meta CSP có hiệu lực từ lúc được chèn. Phép kiểm trên Edge sẽ thử chèn một script inline
  sau khi trang nạp để chứng minh CSP đang chặn (V13). Không có `unsafe-eval` (xem §1.4). Nếu Edge cho thấy Mermaid cần thì chỉ nới đúng chỗ đó và ghi lại.
  `frame-ancestors` không đặt được bằng meta. Nếu muốn chống nhúng iframe thì cần header ở `webapp_controller` (Q3).
- **noindex**: URL có `#` không được máy tìm kiếm lập chỉ mục riêng. Thêm meta robots, và API có `X-Robots-Tag`.
- **Referrer**: `no-referrer` (meta) cộng `referrerPolicy` trên ảnh. Phần `#token` vốn không bao giờ vào Referer.
- **OG / xem trước**: token nằm sau `#` nên máy chủ không biết đang mở tài liệu nào, và không có OG theo từng tài liệu (xem trước chỉ hiện "Markdown Editor").
  Muốn có xem trước thì phải đưa token vào path để máy chủ dựng trang HTML. Khi đó token vào log và bot xem trước (Zalo/Facebook/Slack) sẽ đọc tiêu đề.
  Khuyến nghị không làm (Q4).
- **Ẩn danh**: đọc công khai không cookie (`credentials:'omit'`), không gửi header quản trị hay token AI, giới hạn theo IP.
- **Token**: 128 bit, so khớp bằng tra chỉ mục. Ai có liên kết là đọc được (như "anyone with the link" của Google Drive). Muốn dừng thì thu hồi. Liên kết nằm trong lịch sử trình duyệt.

### 3.9 Ảnh nhúng và liên kết nội bộ

| Trường hợp | Trình soạn hôm nay | Trang chia sẻ |
| --- | --- | --- |
| Ảnh `data:image/*` (dán/kéo thả) | hiện | **hiện**, nằm trong bản chụp (tính vào trần 2 MB; hộp thoại báo dung lượng) |
| Ảnh `https://…` | hiện | hiện; trình duyệt người xem tải từ máy chủ đó (`no-referrer`). Hộp thoại cảnh báo |
| Ảnh tương đối `./a.png` | hỏng (không có kho tài sản) | chữ giữ chỗ `[image: alt]` |
| `[x](#muc)` | cuộn | cuộn (tiền tố id của chế độ đọc) |
| `[x](https://…)` | tab mới | tab mới, `noopener noreferrer` |
| `[x](khac.md)` / `[x](/duong-dan)` | mở 404 trong tab mới | **chữ thường** có tooltip; hộp thoại cảnh báo trước |
| `javascript:` | bị làm sạch thành rỗng | chữ thường |

Chia sẻ cả thư mục hay gói nhiều tài liệu có liên kết qua lại: **ngoài phạm vi** (có thể làm sau bằng `mode:"bundle"`).

### 3.10 PWA / service worker

- Trang chia sẻ **không gọi `initPwa()`**, nên không đăng ký SW và không tải 5,5 MB.
- Chủ (đã cài app) mở liên kết của chính mình: SW sẵn có phục vụ trang (network-first, khoá bỏ query, `#` không gửi lên). API `/api/v1/markdown/shared`
  nằm ngoài phạm vi SW nên **không bao giờ bị cache** (`sw.js:115`). Offline thì trang báo "You're offline", không hiện bản cũ.
- Không sửa `pwa/sw.js`. Build lại thì `make-sw.mjs` tự thêm chunk `SharePage-*.js` vào danh sách precache.

### 3.11 Tuỳ chọn (chờ quyết)

- **Chế độ live** (V17b): `mode:"live"` thì `content = NULL`. Lúc tạo, máy chủ kiểm `docId` có trong cây đã lưu của kho đó (404 `markdown_doc_not_found`:
  "Hãy Save to backend trước"). Lúc đọc, tra lại cây qua `MarkdownDocumentReaderPort.get_file(doc_id)` (json: đọc tệp và đi cây; mysql: `SELECT … WHERE id=:id`;
  mongo: `find_one`). Thiếu tài liệu hoặc tài liệu đã thành thư mục thì trả cùng 404. Trần byte kiểm cả lúc đọc. Cái giá: phụ thuộc thao tác lưu cả cây
  vốn làm bằng tay, nên người dùng dễ hiểu nhầm là "sửa xong người xem thấy ngay".
- **`MARKDOWN_PUBLIC_READ`** (V17a): `false` thì `GET /markdown/files` cần quyền quản trị. Giao diện: khách bấm "Load from backend" sẽ thấy
  "This server's documents are private". Khi đó liên kết chia sẻ là đường duy nhất cho người ngoài.
- **Gia cố khoá quản trị** (V16): `secrets.compare_digest`, bộ đếm sai 20 lần/10 phút/IP cho `/markdown/admin/verify` và các route ghi,
  log cảnh báo một lần khi khoá đang là giá trị mặc định.

---

## 4. Danh sách việc (thứ tự phụ thuộc; mỗi việc một lượt agent)

| # | Việc | Tệp | Kiểm | Cỡ |
| --- | --- | --- | --- | --- |
| V1 | VO + port ra/vào + helper dùng chung `share_links.py` | `src/domain/vo/markdown_share_vo.py`, `src/application/ports/output/markdown_share_repository_port.py`, `src/application/ports/input/markdown_share_input_port.py`, `src/application/utils/share_links.py`, `tests/application/test_share_links.py` | pytest test mới: token 22 ký tự `[A-Za-z0-9_-]`, không lặp; `content_hash`; `PublicReadGuard` (phạt token sai trước, đếm đọc, ip rỗng thì bỏ qua); VO từ chối `expiresInDays=3` | S |
| V2 | Kho JSON | `src/adapter/output/markdownshare/__init__.py`, `json_repository.py`, `tests/adapter/output/markdownshare/test_repositories.py` (phần json) | làm mới giữ token + shared_at; duy nhất theo doc; thứ tự liệt kê; liệt kê không có content; xoá; `purge_expired`; tệp hỏng → `.corrupt`; ghi nguyên tử | M |
| V3 | Kho MySQL | `src/adapter/output/markdownshare/mysql_repository.py`, mở rộng test V2 bằng tham số hoá (SQLite) | cùng bộ hợp đồng V2 + hai lần lưu đồng thời cùng `docId` → một hàng (nhánh `IntegrityError`) | M |
| V4 | Kho Mongo | `src/adapter/output/markdownshare/mongo_repository.py`, test tham số hoá với `fake_mongo` | cùng bộ hợp đồng; gọi `create_index(doc_id unique)` | S |
| V5 | Use case | `src/application/usecases/markdown_share_usecase.py`, `tests/application/test_markdown_share_usecase.py` | xem §5.1 (≈ 25 test, cả vòng đời trên 3 kho) | M |
| V6 | Factory + cấu hình + controller + đăng ký router + `check_markdown_admin` | `src/adapter/factory/markdown_share_factory.py`, `src/application/utils/data_paths.py` (+`is_temporary_data_root`), `src/application/config/config.py`, `.env.example`, `src/adapter/input/controllers/markdown_share_controller.py`, `markdown_storage_controller.py` (đổi tên + alias), `src/main.py`, `tests/adapter/input/controller/test_markdown_share_controller.py` | §5.2; `test_markdown_storage_controller.py` vẫn xanh; toàn bộ pytest | M |
| V7 | Lõi thuần frontend | `markdown-editor/src/lib/share.ts`, `src/lib/__tests__/share.test.ts` | vitest: parse/compose hash, `shareLinkFor` bỏ `?`/`#`, `classifyHref`, `scanDocumentRefs` (bỏ qua khối code), `utf8Bytes` tiếng Việt | S |
| V8 | Client HTTP | `src/services/shareClient.ts`, `src/services/shareClient.test.ts`, `src/services/markdownStorage.ts` (xuất `adminSessionHeaders`) | vitest với `fetch` giả: header quản trị + `?backend=`; `readShared` dùng `X-Share-Token`, `credentials:'omit'`, không có header quản trị; envelope → `ShareError`; hết giờ | S |
| V9 | `MarkdownView` thêm `links='shared'` | `src/components/MarkdownView.tsx`, `src/__tests__/markdownViewShared.test.tsx` | vitest: liên kết nội bộ thành span, `javascript:` không còn `<a>`, `<script>`/`onerror`/`<iframe>` bị bỏ, `referrerpolicy`, ô task disabled; chế độ `'app'` không đổi (test cũ xanh) | S |
| V10 | Tách `ReadingSurface` khỏi `ReadingView` + `readingStore.loadSettings` | `src/components/ReadingSurface.tsx`, `src/components/ReadingView.tsx`, `src/readingStore.ts`, `src/__tests__/readingSurface.test.tsx` | `readingMode.test.tsx` xanh nguyên; test mới: không `onClose` thì không có nút thoát, Esc không đổi URL, `?read=1` không xuất hiện | M |
| V11 | Trang xem + khởi động | `src/boot.ts`, `src/main.tsx`, `src/share/SharePage.tsx`, `src/share/SharePage.css`, `src/__tests__/sharePage.test.tsx`, `src/__tests__/boot.test.ts` | vitest: có hash thì không gọi `initPwa` và có meta robots/referrer/CSP; không hash thì gọi `initPwa`; SharePage hiện tiêu đề và nội dung, 404/429/offline ra đúng thông báo, Download .md gọi `exportMarkdown` | M |
| V12 | Hộp thoại chia sẻ + nối dây | `src/components/ShareDialog.tsx`, `ShareDialog.css`, `src/App.tsx`, `src/components/Header.tsx`, `src/components/CommandPalette.tsx`, `src/__tests__/shareDialog.test.tsx` (mock `shareClient`) | vitest: khách thấy lời mời mở khoá; quản trị tạo → thấy URL + Copy; đã có → Update/Revoke (có hỏi lại); vượt dung lượng → khoá nút; cảnh báo liên kết nội bộ; liên kết mồ côi; cảnh báo `persistent:false`; rồi `npm run type-check && npm run lint` | M |
| V13 | (tuỳ chọn) QR | `src/lib/qr.ts`, `src/lib/__tests__/qr.test.ts`, `ShareDialog.tsx` | vitest: ma trận khớp mẫu chuẩn sinh từ `_portal/assets/js/core/qr.js` bằng node (fixture); URL 110 ký tự vừa phiên bản ≤ 10 | S |
| V14 | Build, xuất bản, kiểm Edge thật | `markdown-editor/scripts/kiem-chia-se.py` (mới, theo khuôn `kiem-pwa.py`); xuất bản `webapp/tranphuc8a/markdown-editor-pro/` bằng script | §5.4; chạy lại `kiem-pwa.py` (hồi quy PWA); `node scripts/build-webapps.mjs --only markdown-editor` rồi `--check` | M |
| V15 | Tài liệu + bàn giao | `docs/markdown-share-api.md` (mới), `markdown-editor/README.md` (mục Sharing + sửa đoạn khoá cũ), `backend/fastapi/README.md` (bảng route + env), `.claude/skills/ban-do-ung-dung/SKILL.md` (dòng app + bảng endpoint), `webapp/tranphuc8a/markdown-editor-pro/metadata.json` (mô tả), `tasks/2610/<ngày>/markdown-share/ban-giao.md` | đọc lại; `node scripts/build-webapps.mjs --check` | S |
| V16 | (chờ Q9) Gia cố khoá quản trị markdown | `markdown_storage_controller.py`, `markdown_share_controller.py`, `tests/…/test_markdown_storage_controller.py` | sai 20 lần → 429 có `Retry-After`; đúng khoá vẫn qua ở IP khác; `compare_digest`; log cảnh báo một lần với khoá mặc định | S |
| V17 | (chờ Q1/Q8) a) `MARKDOWN_PUBLIC_READ`; b) chế độ live | a) `config.py`, `markdown_storage_controller.py`, `markdownStorage.ts`, `Header.tsx` + test; b) `markdown_document_reader_port.py`, adapter, use case, dialog + test | a) `false` → GET /files 403 khi không có phiên, 200 khi có; giao diện báo đúng. b) live đọc bản đã lưu mới nhất, thiếu tài liệu → 404 | S / M |
| V18 | (chờ Q10) Code Studio dùng `share_links` | `codestore_usecase.py` | 85 test chia sẻ/controller hiện có xanh, không đổi hành vi | S |

---

## 5. Test

### 5.1 Use case (`tests/application/test_markdown_share_usecase.py`, kho JSON trên `tmp_path`, `Clock` giả, `MemoryRateLimiter`)

- Tạo trả token 22 ký tự, cờ `created=True`, `sharedAt == updatedAt == now`. Token lấy từ `token_factory` được tiêm vào.
- Chia sẻ lại cùng `docId`: token và `sharedAt` giữ nguyên; `content`, `title`, `updatedAt`, `contentHash` mới; `created=False`.
- Hai tài liệu → hai token khác nhau.
- Trần byte tính theo UTF-8 (chuỗi tiếng Việt nhiều byte vượt trần dù số ký tự thấp hơn) → 400 có `limit`.
- Tiêu đề rỗng sau khi cắt, hoặc có ký tự điều khiển; `docId` có `\n` → 400 `markdown_share_bad_input`.
- Hạn mức: liên kết thứ 51 bị từ chối; làm mới liên kết đã có không tính thêm; hạn mức đầy nhưng có liên kết hết hạn thì liên kết đó bị dọn và lần tạo được chấp nhận.
- Liệt kê: mới nhất trước, không có `content`, có `bytes`/`contentHash`/`expired`; `limits` và `persistent` đúng.
- Thu hồi xong thì đọc 404; thu hồi lần hai 404; chia sẻ lại sau khi thu hồi ra token mới, token cũ chết hẳn.
- Đọc chỉ trả đúng 6 khoá (`title, content, mode, sharedAt, updatedAt, expiresAt`), không có `docId`, `token`, `contentHash`.
- Token lạ, sai dạng (`"../x"`, 101 ký tự), đã thu hồi, hết hạn → cùng mã, cùng thông báo.
- Bộ đếm đọc: N lượt rồi 429 kèm `retryAfter`. Token sai bị đếm, sau 20 lần thì cả token đúng cũng phải chờ. Token đúng không bao giờ bị đếm là sai.
- `caplog` mức DEBUG trong cả vòng đời: không chứa token, không chứa nội dung.
- Vòng đời đầu-cuối tham số hoá trên ba kho (json / mysql trên SQLite / mongo giả).

### 5.2 Controller (`tests/adapter/input/controller/test_markdown_share_controller.py`, `from src.main import app`, `reset_for_tests`, `monkeypatch settings`)

- POST/GET/DELETE không có quyền → 403. Có `X-Admin-Key` → được. Có `X-Admin-Session` lấy từ `/markdown/admin/verify` → được.
- POST lần đầu 201, lần hai 200, đúng dạng phản hồi. Header `Cache-Control: no-store`.
- `GET /markdown/shared` với `X-Share-Token`: 200 khi không có quyền; header có `no-store`, `X-Robots-Tag` chứa `noindex`, `nosniff`. Thiếu header → 404 (không phải 422).
- Token trong path `/markdown/shared/<token>` → 404 hoặc 405 (khẳng định không có route nhận token trong path).
- `?backend=postgres` → 400 `markdown_bad_backend`; mongo chưa cấu hình → 503 `markdown_backend_unavailable`.
- `title` 201 ký tự → 422. `content` vượt trần cấu hình (đặt nhỏ trong test) → 400 `markdown_share_too_large`.
- Gọi quá giới hạn đọc → 429, có `Retry-After`.
- Route mới không làm hỏng `/markdown/files`, `/markdown/backends`, `/markdown/admin/*` (bộ test cũ chạy cùng).

### 5.3 Vitest (frontend)

Như cột "Kiểm" của V7–V13. Quy tắc dự án: mọi test `vi.mock('../services/markdownStorage')` có chạm tới chia sẻ phải thêm `adminSessionHeaders` vào mock.
Hiện có 7 tệp mock module này: `components`, `inbox`, `install`, `readingMode`, `responsive`, `smartFormat`, `store`.
Mục tiêu sau khi xong: ≥ 367 + khoảng 60 test, type-check sạch, lint 0 cảnh báo.

### 5.4 Edge thật (`markdown-editor/scripts/kiem-chia-se.py`, Playwright `channel="msedge"`)

Máy chủ uvicorn thật trên cổng trống: `DB_URL=sqlite+aiosqlite:///<tmp>`, `DATA_DIR=<tmp>`, `MONGO_URI=""`, `AI_ENABLED=false`, `MARKDOWN_ADMIN_KEY=<chuỗi giả>`,
`MARKDOWN_JSON_FILE`/`MARKDOWN_SHARES_JSON_FILE` trong tmp. Tắt tiến trình khi xong. Cần bản đã xuất bản.

1. Ngữ cảnh A (chủ): mở app, mở khoá quản trị, tạo tài liệu có tiêu đề, `$e^{i\pi}+1=0$`, khối `$$…$$`, flowchart Mermaid, khối code `ts`, bảng,
   một ảnh `data:image/png`, `<script>window.__xss=1</script>`, `<img src=x onerror="window.__xss=2">`, `[evil](javascript:window.__xss=3)`, `[khác](khac.md)`, `[ngoài](https://example.com)`.
2. File → Share read-only link… → Create link → đọc URL trong ô; khẳng định dạng `…/markdown-editor-pro/#share=<22>&backend=json`.
3. Ngữ cảnh B (ẩn danh, kho trống, `service_workers="allow"`): mở URL. Khẳng định: tiêu đề đúng; có `.katex`; Mermaid ra `svg`; code được tô màu;
   ảnh data hiện; `window.__xss` là `undefined` và không có hộp thoại `alert`; `khac.md` là `span.md-dead-link`; liên kết ngoài có `rel` chứa `noopener` và `noreferrer`;
   có meta robots `noindex` và meta CSP; thử chèn `<script>` inline sau khi nạp xong thì **không chạy**; không có sự kiện `securitypolicyviolation` từ tài nguyên của app;
   `navigator.serviceWorker.getRegistrations()` rỗng; header phản hồi của `/markdown/shared` có `no-store` và `X-Robots-Tag`;
   không request nào chứa token trong URL (lắng nghe `page.on('request')`); ở bề rộng 360 px thì `scrollWidth <= innerWidth`.
4. A sửa tài liệu. B tải lại vẫn thấy bản cũ (snapshot). A bấm Update snapshot. B tải lại thấy bản mới, token không đổi.
5. A thu hồi. B tải lại thấy thông báo "doesn't exist, has expired, or was revoked".
6. B offline (`context.set_offline(True)`) tải lại → "You're offline". Không có nội dung cũ.
7. A (đã có SW từ lần mở app) mở liên kết của chính mình rồi tắt máy chủ và tải lại → báo offline/lỗi, **không** hiện nội dung đã cache (chứng minh SW không cache API).
8. Hồi quy: `kiem-pwa.py` vẫn 25/25.

Trả exit code khác 0 nếu có phép sai. Tuỳ chọn `--anh <thư-mục>` chụp màn hình trang xem ở 360/768/1280 px, theme sáng/tối.

---

## 6. Rủi ro

1. **Khoá quản trị mặc định** công khai và `.env` cục bộ không đặt khoá. Nếu production cũng vậy thì người lạ tạo được liên kết, và ghi đè được cả kho (rủi ro này đã có từ trước).
2. **Kho vốn đọc công khai**: chủ dự án có thể tưởng chia sẻ là "riêng tư". Tài liệu và hộp thoại phải nói rõ. Chỉ khi chọn `MARKDOWN_PUBLIC_READ=false` thì kho mới thật sự đóng.
3. Kho JSON trên serverless nằm ở thư mục tạm, máy chủ khởi động lại là liên kết chết. Có cảnh báo `persistent:false`. Production nên dùng MySQL/Mongo.
4. Bảng `markdown_shares` sẽ **tự tạo trên MySQL thật (Aiven)** lần đầu chủ dự án chia sẻ, theo đúng mẫu hiện có. Agent không bao giờ chạy lệnh này trên DB thật; test chỉ dùng SQLite.
5. Tệp JSON chứa toàn bộ bản chụp, xấu nhất khoảng 100 MB ghi lại mỗi lần chia sẻ.
6. CSP bằng meta chèn qua JS: Chromium/Firefox tôn trọng; Safari chưa kiểm. Mermaid/KaTeX có thể cần nới (đã grep: chưa thấy `eval` thật). `frame-ancestors` không có tác dụng.
7. Tách `ReadingView` có thể làm hỏng 367 test hiện có; V10 phải giữ nguyên hành vi `?read=1`.
8. Rẽ nhánh ở `main.tsx`: dán liên kết chia sẻ vào tab trình soạn đang mở (chỉ đổi `#`) cần `hashchange` → reload. Thiếu thì người dùng thấy nhầm trạng thái.
9. Token: chuyển tiếp liên kết = trao quyền đọc; nằm trong lịch sử trình duyệt. Header `X-Share-Token` tránh được access log, nhưng proxy nào log header thì vẫn thấy.
10. Ảnh ngoài làm lộ IP người xem cho máy chủ ảnh. `style` cho phép lớp phủ giả mạo nếu chủ dán HTML lạ (P7).
11. Xoá tài liệu không tự thu hồi liên kết (P10). Người dùng có thể quên liên kết mồ côi.
12. Giao diện tiếng Anh trong khi thông báo lỗi backend tiếng Việt (frontend đổi theo `data.code`, chỉ hiện chuỗi máy chủ khi gặp mã lạ).
13. Body 4,5 MB của Vercel: 2 MB nội dung cộng phần thoát JSON vẫn dưới trần. Tăng `MARKDOWN_SHARE_MAX_BYTES` quá 2 MB là nguy hiểm.

## 7. Lệnh kiểm

```bash
# đã chạy trong pha này
backend/fastapi/.venv/Scripts/python.exe -m pytest tests/adapter/input/controller/test_markdown_storage_controller.py tests/application/test_codestore_shares.py tests/adapter/input/controller/test_codestore_controller.py -q   # 85 passed
cd markdown-editor && npx vitest run                                                     # 367 passed / 21 files
grep -l "new Function(" backend/fastapi/webapp/tranphuc8a/markdown-editor-pro/assets/*.js   # (trống)
grep -c -i markdown backend/fastapi/.env                                                  # 0

# sau khi cài
cd backend/fastapi && .venv/Scripts/python.exe -m pytest tests/application/test_share_links.py tests/application/test_markdown_share_usecase.py tests/adapter/output/markdownshare tests/adapter/input/controller/test_markdown_share_controller.py tests/adapter/input/controller/test_markdown_storage_controller.py -q
cd backend/fastapi && .venv/Scripts/python.exe -m pytest -q
cd markdown-editor && npm test && npm run type-check && npm run lint && npm run build
node scripts/build-webapps.mjs --only markdown-editor && node scripts/build-webapps.mjs --check
backend/fastapi/.venv/Scripts/python.exe markdown-editor/scripts/kiem-chia-se.py [--anh <thư-mục>]
backend/fastapi/.venv/Scripts/python.exe markdown-editor/scripts/kiem-pwa.py
```

## 8. Cần chủ dự án quyết

| # | Câu hỏi | Lựa chọn | Đề xuất |
| --- | --- | --- | --- |
| Q1 | Ảnh chụp hay theo bản mới nhất? | a) chỉ snapshot · b) snapshot + live (theo bản đã "Save to backend") · c) chỉ live | **a** bây giờ; b sau nếu cần (cột `mode` đã chừa sẵn) |
| Q2 | Token gửi lên API đọc qua đâu? | a) header `X-Share-Token` · b) path như Code Studio | **a** (không vào access log) |
| Q3 | Trang xem đặt ở đâu? | a) trong app `#share=` · b) trang tĩnh riêng `share.html` · c) trang máy chủ dựng | **a** (dùng lại đúng pipeline, PWA không đổi, token sau `#`) |
| Q4 | Có cần xem trước OG khi dán link vào chat? | a) không · b) có (token vào path, bot đọc được tiêu đề) | **a** |
| Q5 | Hết hạn | a) không bao giờ / 1 / 7 / 30 ngày · b) không hỗ trợ | **a**, mặc định "không bao giờ" |
| Q6 | Số liên kết mỗi tài liệu | a) một (làm mới giữ token) · b) nhiều (mỗi người nhận một liên kết) | **a** |
| Q7 | Tạo bảng MySQL | a) `CREATE TABLE IF NOT EXISTS` lúc chạy · b) Alembic 0007 | **a** (cùng mẫu `markdown_files`/`codestore_shares`) |
| Q8 | Đóng kho đọc công khai? | a) giữ công khai · b) thêm `MARKDOWN_PUBLIC_READ` (mặc định true), chủ tự lật · c) đóng ngay | **b** |
| Q9 | Khoá quản trị | a) chỉ nhắc đặt `MARKDOWN_ADMIN_KEY` mạnh trên production · b) a + bộ đếm sai + so sánh hằng thời gian + cảnh báo khoá mặc định · c) b + từ chối khoá mặc định khi không phải dev | **b** (và xác nhận biến môi trường production) |
| Q10 | Tách phần chung với Code Studio | a) chỉ thêm `share_links.py`, Code Studio để sau · b) refactor Code Studio ngay · c) chép mẫu, không tách | **a** |
| Q11 | Mã QR trong hộp thoại | a) chuyển `qr.js` của cổng sang TS (≈ 11 KB, không phụ thuộc) · b) không làm | **a** (việc S, tuỳ chọn) |
| Q12 | Ngôn ngữ giao diện chia sẻ | a) tiếng Anh như cả app · b) tiếng Việt | **a** |
| Q13 | Trần dung lượng một bản chụp | 1 MB · **2 MB** · 3 MB | **2 MB** (ảnh `data:` vừa phải, dưới trần Vercel) |

Phụ thuộc mới: **không có**. QR tự viết (chuyển từ cổng); hash dùng `crypto.subtle` có sẵn; backend chỉ dùng thư viện chuẩn và các gói đã có.
