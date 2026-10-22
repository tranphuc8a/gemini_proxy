# Markdown Editor Pro — quản lý phiên bản + đồng bộ thông minh (thiết kế, CHƯA cài)

Vùng: `markdown-editor/` (nguồn React, xuất bản thành `webapp/tranphuc8a/markdown-editor-pro`) + `backend/fastapi` (`/markdown/*`).
Pha: hiểu + thiết kế. Không tệp nào trong repo bị sửa. Script đo đạc nằm ở `scratchpad/md-sync/`.

Chủ dự án nói: *"save to BE là post lại toàn bộ data chứ không post only changes"*. **Đúng, đã kiểm.** Tệ hơn nữa: lưu là
**ghi đè cả kho** mà không kiểm phiên bản, nên một máy có thể xoá bài của máy khác mà không ai hay. Với workspace mục tiêu
(200 tài liệu, vài tài liệu 1 MB), cả lưu lên máy chủ lẫn lưu cục bộ đều đã **hỏng ngầm**.

---

## 0. Tóm tắt khuyến nghị

1. **Kho mới theo từng tài liệu** `markdown_docs`. Mỗi nút (tệp/thư mục) là một bản ghi `{id, kind, parentId, name, content, hash,
   rev, contentRev, metaRev, deleted, updatedAt, serverUpdatedAt, device}`. Máy chủ ghi bằng **so-sánh-rồi-ghi (CAS) trên `rev`**.
   Không dùng "mới hơn thắng" như `/wiki`, vì với văn bản dài cách đó làm mất cả một phiên sửa.
2. **Đẩy delta**: `POST /markdown/sync/push` chỉ chở các tài liệu đã đổi. Nếu tài liệu > 4 KB và có bản gốc, gửi **patch dòng**
   (Myers tự viết) kèm `baseHash` và `hash` kết quả (SHA-256) để máy chủ kiểm. Đổi tên hay chuyển thư mục chỉ gửi siêu dữ liệu.
   Số đo: sửa 1 dòng trong tài liệu 1 MB gửi **434 B**, so với **7,40 MB** hiện nay.
3. **Kéo theo con trỏ**: `GET /markdown/sync/changes?since=` dùng `serverUpdatedAt` và trễ 2 s, cắt trang không lọt bản ghi.
   Phần này chép mẫu `/wiki`. Bản ghi do chính máy này ghi thì không kèm nội dung, để khỏi tải lại thứ vừa gửi.
4. **Xung đột** giải ở máy khách bằng **merge 3 chiều theo dòng**. Gốc của merge là *bản bóng* (shadow): bản đã đồng bộ lần cuối,
   giữ trong IndexedDB.
   - Hai bên sửa chỗ khác nhau thì tự gộp.
   - Đụng cùng chỗ thì mở hộp thoại: giữ bản tôi / lấy bản máy chủ / **giữ cả hai** / gộp tay.
   - Sửa nội dung thắng xoá. Đổi tên hay chuyển chỗ không cần tombstone, vì danh tính là `id` chứ không phải đường dẫn.
5. **Lịch sử phía máy chủ** `markdown_doc_revisions`:
   - Mỗi lần nội dung đổi thêm một hàng.
   - Hàng lưu **delta xuôi so với keyframe gần nhất**, nên khôi phục bản nào cũng chỉ cần 2 lần đọc. Bản nhỏ lưu toàn văn, có zlib.
   - Các bản cùng máy trong 10 phút được gộp làm một.
   - Giữ 50 bản gần nhất + 1 bản/ngày trong 90 ngày + bản có tên (giữ mãi). Keyframe được giữ khi còn hàng phụ thuộc.
   - Số đo: 50 phiên bản của tài liệu 1 MB tốn 4,2 KB delta, so với 47,7 MB nếu lưu toàn văn.
6. **Khôi phục = tạo bản mới hơn** (`origin:"restore"`, `restoredFrom`) qua CAS, đúng quy tắc trong CLAUDE.md. Xem diff giữa hai
   phiên bản tính ở trình duyệt.
7. **Kho cục bộ chuyển sang IndexedDB**: tài liệu, bản bóng, hàng đợi gửi (outbox), con trỏ. Lý do: localStorage của Edge thật
   chỉ nhận **5.242.879 ký tự**, mà workspace mẫu cần 6,43 triệu. localStorage chỉ còn giữ cài đặt và một "ảnh khởi động" nhỏ.
8. **Tương thích ngược**:
   - Dữ liệu cũ (`markdown_files` / tệp JSON) được chuyển một lần, lười, có cờ, không đụng bảng cũ.
   - `GET /markdown/files` dựng cây từ kho mới.
   - `PUT /markdown/files` của bản app cũ trả 409 `md_legacy_client`, thay vì ghi đè.
   - Phía máy khách: localStorage v2 chuyển sang IndexedDB, rồi lần đồng bộ đầu đối chiếu theo hash.
9. **Không thêm dependency**. Diff, patch, merge, SHA-256 dự phòng đều tự viết, nguyên mẫu đã chạy đúng. Máy chủ dùng
   `difflib`/`zlib`/`hashlib` của thư viện chuẩn.
10. **Cho thiết kế chia sẻ (md-share)**: cổng `MarkdownDocsInputPort.get_document(id, backend)` trả bản mới nhất theo `id`.
    `contentRev`/`hash` dùng làm ETag cho chế độ "live".

---

## 1. Hiện trạng (đã kiểm, kèm dẫn chứng)

### 1.1 Máy khách gửi gì, khi nào

| Điều | Dẫn chứng |
| --- | --- |
| Lưu lên máy chủ = `PUT {filesUrl}?backend=<json\|mysql\|mongo>`, thân `JSON.stringify({ files })`: **cả cây**, gồm `content` của mọi tệp | `markdown-editor/src/services/markdownStorage.ts:222-234` |
| Hàm gọi: `saveBackendStorage` gửi `get().files` (toàn bộ) | `markdown-editor/src/store.ts:579-582` |
| **Chỉ chạy khi bấm tay** "Save to backend" trong menu Sync. Không có tự động, hẹn giờ hay đẩy khi có mạng lại | `markdown-editor/src/components/Header.tsx:177-187`, `:335-337` |
| "Backend sync enabled" chỉ là cờ: bật nút và hiện huy hiệu "Backend" ở thanh trạng thái, ngoài ra không làm gì | `Header.tsx:302-305`; `StatusBar.tsx:35-40`; `store.ts:558-561` |
| Ctrl+S chỉ lưu cục bộ (`flushPersist` + "Saved locally") | `markdown-editor/src/App.tsx:328-332`; `CommandPalette.tsx:74` |
| "Load from backend" **thay hẳn** cây cục bộ (`set({ files, currentFileId: null, … })`). Không hỏi lại, không gộp, nên sửa chưa lưu là mất | `store.ts:568-577`; `Header.tsx:332-334` |
| Hết giờ chờ máy chủ: 10 s | `markdownStorage.ts:19`, `:198-211` |
| Kiểu nút: `{id, name, type, content?, children?, parentId?}`. Không có `rev`, `updatedAt` hay `hash` | `markdown-editor/src/types.ts:3-10` |
| `id` sinh bằng `createId(prefix)` = `prefix-<ms36>-<đếm36>-<ngẫu nhiên>`. Riêng `root` và `welcome` **cố định**, giống nhau trên mọi máy | `src/lib/id.ts:8-11`; `store.ts:132-146` |
| Cây hiển thị đã được sắp (thư mục trước, tên tự nhiên) nên thứ tự anh em lúc lưu **không có nghĩa** với giao diện | `components/FileTree.tsx:19`; `lib/tree.ts:154-161` |
| Mọi chỗ đổi nội dung đều qua `setContent` (trình soạn, ô tick ở preview, Smart format). Đổi cấu trúc qua các action của store | `EditorPane.tsx:122,521`; `Preview.tsx:103`; `SmartFormatModal.tsx:184`; `store.ts:330-454` |

### 1.2 Máy chủ lưu gì

Toàn bộ nằm trong **một controller**, không có use case, port hay adapter:
`backend/fastapi/src/adapter/input/controllers/markdown_storage_controller.py:1-323`.

| Kho | Cách ghi | Dẫn chứng |
| --- | --- | --- |
| json | `path.write_text(document.model_dump_json(indent=2))`: **một blob cả cây**, ghi thẳng, không qua tệp tạm | `:315-318` |
| mysql | Bảng `markdown_files(id, name, node_type, content LONGTEXT, parent_id, sort_order)`. Mỗi lần lưu: `DELETE FROM markdown_files` rồi INSERT **từng nút** (N lượt khứ hồi), commit cuối | `:152-161`, `:187-200` |
| mongo | `delete_many({})` rồi `insert_many`. **Không nguyên tử**: lỗi giữa chừng là mất kho, đọc xen giữa thấy kho rỗng | `:220-237` |
| Phản hồi PUT | `response_model=MarkdownDocument`, trả lại **cả cây** | `:305-323` |
| Đọc | `GET /markdown/files` **không cần quyền** | `:293-302` |
| Quyền ghi | `X-Admin-Key` hoặc `X-Admin-Session` (HMAC, salt `markdown-editor`) | `:82-98` |
| Xung đột | **Không có**: không `rev`, không `If-Match`, không so dấu thời gian | toàn tệp |
| Lịch sử | **Không có** | toàn tệp |

Tái hiện bằng `scratchpad/md-sync/thu-ghi-de.py` (TestClient, kho json trong thư mục tạm, DB_URL SQLite):

```text
1) GET không cần khoá quản trị: 200
2) PUT của B trả 200 → kho còn: {'a': 'A0', 'b': 'B1 (máy B)'}
   sửa của A ở 'a' mất: True | tài liệu 'c' của A mất: True
3) Phản hồi PUT dài 288 byte = trả lại cả cây
4) Tệp kho json: một blob cả cây, có thụt lề: ['files']
```

### 1.3 Lưu cục bộ, lịch sử cục bộ

| Điều | Dẫn chứng |
| --- | --- |
| Cả cây (gồm mọi nội dung) nằm ở **một khoá** `localStorage["markdown-editor:files"]` `{version:2, files, currentFileId, expandedFolders}` | `src/lib/persistence.ts:4`, `:81-83` |
| Ghi lại toàn bộ sau 800 ms kể từ mỗi lần sửa (`AUTOSAVE_DEBOUNCE_MS`) | `store.ts:35`, `:204-208`, `:613-626` |
| Hết hạn mức thì `setItem` ném lỗi, `writeRaw` nuốt lỗi và trả `false`, chỉ có `saveState='error'`. **Bản cũ vẫn nằm đó**: tải lại trang là mất các sửa sau thời điểm vượt hạn mức | `persistence.ts:41-48`; `store.ts:619-625` |
| "Lịch sử phiên bản cục bộ" **không có**. Chỉ có ngăn hoàn tác trong RAM, ≤ 200 ảnh chụp **toàn văn**, làm lại từ đầu mỗi khi đổi tệp, không lưu qua lần tải lại | `store.ts:32-34`, `:242-280`, `:289-303` |
| Kiểm PWA đang dựa vào `localStorage['markdown-editor:files']` | `markdown-editor/scripts/kiem-pwa.py:239-240` |
| Bảy tệp test `vi.mock('../services/markdownStorage', …)` liệt kê tên export | `src/__tests__/{store,components,inbox,install,readingMode,responsive,smartFormat}.test.*` |

### 1.4 Số đo (đã chạy)

`node scratchpad/md-sync/do-payload.mjs` sinh workspace giả: 200 tài liệu tất định, chữ Việt lẫn Anh. Gồm 150 tài liệu 2–10 KB,
40 tài liệu 20–60 KB, 6 tài liệu 200 KB và 4 tài liệu 1 MB; tổng 7,26 MB.

| Đại lượng | Giá trị |
| --- | --- |
| Thân PUT hiện tại (UTF-8) | **7,40 MB** (gzip 1,51 MB) |
| Phản hồi PUT | ≈ 7,40 MB nữa |
| Vượt trần thân yêu cầu/phản hồi Vercel 4,5 MB (repo có `backend/fastapi/vercel.json`, các use case khác ghi chú trần này: `wiki_usecase.py:60`, `config.py:119`) | **Có**: lưu chắc chắn hỏng trên Vercel |
| `localStorage["markdown-editor:files"]` | 6,43 triệu ký tự |
| Trần localStorage **Edge 155 thật** (`do-localstorage.py`, Playwright `channel="msedge"`), một khoá | **5.242.879 ký tự**, ASCII hay tiếng Việt như nhau → lưu cục bộ **hỏng** |
| IndexedDB, cùng trình duyệt | ghi + đọc 7,4 triệu ký tự đúng, 232 ms, hạn mức 10 GB |
| `JSON.stringify` cả cây (mỗi lần lưu cục bộ) | 74 ms (node 24) |
| Sửa 1 dòng, tài liệu 7,4 KB | gửi nguyên văn 7,8 KB, **patch 376 B** (diff 1,2 ms, áp lại đúng) |
| Sửa 1 dòng, tài liệu 0,95 MB | gửi nguyên văn 0,97 MB, **patch 434 B** (diff 14,5 ms, áp lại đúng) |
| Đổi tên / chuyển thư mục | 121 B |
| Viết lại 30 % dòng của tài liệu 1 MB | patch tự bỏ cuộc → gửi nguyên văn (74 ms) |
| Merge 3 chiều, hai sửa khác chỗ, tài liệu 1 MB | 0 xung đột, 21 ms |
| Cùng một dòng, hai bên sửa khác nhau | 1 xung đột (đúng) |
| Lịch sử 50 bản (mỗi bản sửa 1 dòng) của tài liệu 1 MB | toàn văn 47,7 MB, zlib toàn văn ≈ 10,8 MB, **delta 4,2 KB** |
| `difflib` (máy chủ) trên 1 MB: sửa 1 / 10 / 30 % dòng (`do-difflib.py`, *chưa* cắt đầu đuôi chung) | 55 / 77 / 251 ms, áp lại đúng |
| SHA-256: `hashlib` 1 MB / WebCrypto 1 MB / **JS thuần** 1,2 MB (`do-sha.mjs`, khớp `node:crypto`) | 7 / 13 / 54 ms |
| Nguyên mẫu `proto-diff.mjs` tự kiểm | 7/7 ca cố định (gồm CRLF, rỗng), 500/500 ca ngẫu nhiên (patch và merge) |

Mốc test hiện tại: pytest markdown + wiki **168 đạt**; vitest `markdownStorage.test.ts` + `store.test.ts` **54 đạt**.

### 1.5 Mẫu `/wiki` của Personal Wiki (để so và dùng lại)

| Mẫu | Dẫn chứng | Dùng lại? |
| --- | --- | --- |
| Bản ghi `{id, kind, updatedAt, deleted, data}`, máy chủ không đọc `data` | `domain/vo/wiki_vo.py:38-52` | Dùng *hình dạng* (tombstone bỏ nội dung, `serverUpdatedAt`). Không dùng `data` mờ, vì máy chủ cần `content` để áp patch và làm lịch sử |
| Mới hơn thắng, hoà thì xoá thắng (`wins`) | `wiki_vo.py:67-76` | **Không**. Thay bằng CAS theo `rev` + merge 3 chiều. Sửa thắng xoá |
| Ghi nguyên tử tại kho: `UPDATE … WHERE` mang luật | `adapter/output/wiki/mysql_repository.py:84-93`, `:229-262`; mongo `:120-150` | **Có**: cùng kỹ thuật, điều kiện là `rev = :expected` |
| Con trỏ `serverUpdatedAt`, `SYNC_LAG_MS=2000`, mỗi bản ghi trong một yêu cầu một dấu, không cắt trang giữa hai dấu trùng | `application/usecases/wiki_usecase.py:22-27`, `:165-199`, `:251-255` | **Có**, chép nguyên luật. Nên tách thành hàm thuần dùng chung (xem B7) |
| Giới hạn: ≤ 200 bản ghi/lần, thân ≤ 4 MB, trang ≤ 3 MB, đồng hồ lệch ≤ 1 ngày | `wiki_vo.py:26-33`; `wiki_usecase.py:59-61` | **Có**, chỉnh số |
| Tombstone hết hạn 90 ngày, dọn khi kho gần đầy | `wiki_usecase.py:263-282` | Có, thêm *đường chân trời* để báo máy khách quá cũ (xem 3.4) |
| Factory theo kho, json/mysql/mongo, `available_backends` kết nối thật | `adapter/factory/wiki_factory.py:42-115`, `:118-164` | Có |
| Kho JSON: khoá asyncio, ghi tệp tạm rồi đổi tên, ghi lại cả tệp | `adapter/output/wiki/json_repository.py:1-17` | Có (+ tách lịch sử ra tệp theo tài liệu) |
| Vòng đồng bộ máy khách: đẩy hàng đợi → kéo theo con trỏ. Lùi lại 15 s × 2ⁿ (tối đa 5 phút), tôn trọng `Retry-After`. Kích hoạt: sửa xong 3 s, có mạng lại, trang hiện lại, hẹn 90 s. Bản ghi lỗi thì bỏ qua, không chặn hàng | `webapp/tranphuc8a/personal-wiki/assets/js/data/sync.js:101-125`, `:176-226` | Có (viết lại bằng TS) |
| Quyền: khoá không gian `X-Wiki-Key` | `wiki_controller.py:35-44` | Không. Markdown giữ **phiên quản trị** như hiện nay |
| Lịch sử | không có | — |

Lịch sử khoá học có tiền lệ: giữ 30 bản mỗi bài (`adapter/output/mysql/repositories/course_repository.py:91`). Ở đó cũng có
409 + `current` khi xung đột (`application/usecases/course_usecase.py:564-577`).

---

## 2. Phát hiện

| # | Phát hiện | Mức | Dẫn chứng |
| --- | --- | --- | --- |
| P1 | Lưu lên máy chủ gửi **cả cây 7,4 MB** và nhận lại 7,4 MB, kể cả khi chỉ sửa 1 ký tự | cao | 1.1, 1.4 |
| P2 | **Mất dữ liệu giữa các máy**: PUT ghi đè cả kho, không kiểm phiên bản (đã tái hiện: sửa và tài liệu mới của máy A biến mất) | cao | 1.2, `thu-ghi-de.py` |
| P3 | **Lưu cục bộ hỏng ngầm** khi workspace > 5,24 triệu ký tự: chỉ báo `saveState='error'`, tải lại là mất các sửa sau thời điểm vượt | cao | `persistence.ts:41-48`, đo Edge |
| P4 | Trên Vercel, cây > 4,5 MB **không lưu được** (thân yêu cầu và phản hồi đều vượt trần) | cao | 1.4 |
| P5 | "Load from backend" thay cây cục bộ mà không hỏi, không gộp | cao | `store.ts:568-577` |
| P6 | Kho mongo xoá rồi chèn, không nguyên tử. Kho json ghi thẳng, không qua tệp tạm | vừa | `markdown_storage_controller.py:235-237`, `:318` |
| P7 | MySQL chèn từng nút: với 211 nút trên Aiven ở xa, *suy đoán* 6–17 s (30–80 ms/lượt, **chưa đo**), có thể vượt 10 s chờ của máy khách | vừa | `:192-197`; `markdownStorage.ts:19` |
| P8 | Không có lịch sử phiên bản, cả cục bộ lẫn máy chủ | vừa | 1.2, 1.3 |
| P9 | `GET /markdown/files` công khai: ai cũng đọc được cả kho. Kho mới phải quyết lịch sử/thùng rác công khai hay không | vừa | `:293-302` |
| P10 | Ngăn hoàn tác giữ ≤ 200 ảnh chụp toàn văn: tài liệu 1 MB tốn tới ~200 MB RAM *(suy luận từ mã, chưa đo)*. Ngoài phạm vi, ghi lại | thấp | `store.ts:242-253` |
| P11 | `crypto.subtle` chỉ có ở *secure context* (HTTPS/localhost). Bản deploy chưa xác nhận HTTPS (`ban-do-ung-dung` mục 5), nên cần SHA-256 dự phòng thuần JS (đã viết thử, 54 ms/1,2 MB) | vừa | `do-sha.mjs` |
| P12 | Nút `root`/`welcome` cố định trên mọi máy: khi đối chiếu lần đầu, `welcome.md` mặc định đừng đẩy lên | thấp | `store.ts:132-146` |
| P13 | Bản app cũ đang mở (PWA cache) vẫn có thể `PUT /files` sau khi nâng cấp. Phải chặn, kẻo ghi đè kho mới | cao | `pwa/sw.js` mạng-trước cho `index.html` (bàn giao 17/10 dòng 13) |

---

## 3. Thiết kế chi tiết

### 3.1 Mô hình dữ liệu

**Bản ghi tài liệu** (một tệp hoặc thư mục), giống nhau ở cả ba kho:

```text
DocRecord {
  id: str                # ^[A-Za-z0-9_.:-]{1,80}$, so khớp chính xác (utf8mb4_bin)
  kind: "file"|"folder"  # không đổi được sau khi tạo
  parentId: str|null     # null = gốc. Máy chủ KHÔNG ép toàn vẹn tham chiếu (giống _rows_to_tree: mồ côi lên gốc)
  name: str              # ≤ 255
  content: str|null      # chỉ tệp, chưa xoá. ≤ MAX_DOC_BYTES UTF-8
  hash: str              # sha256 hex của content (UTF-8); "" cho thư mục/tombstone
  size: int              # byte UTF-8
  rev: int               # tăng 1 mỗi lần bản ghi đổi (CAS trên trường này)
  contentRev: int        # rev của lần cuối content đổi
  metaRev: int           # rev của lần cuối name/parentId đổi
  deleted: bool          # tombstone: content=null, hash=""
  createdAt, updatedAt: int  # ms; updatedAt = đồng hồ máy sửa (để hiển thị)
  serverUpdatedAt: int   # ms máy chủ, dùng cho con trỏ kéo
  device: str            # máy ghi lần cuối (chặn tải lại thứ mình vừa gửi + nhãn lịch sử)
}
```

- Đổi tên hay chuyển thư mục là sửa `name`/`parentId` trên **cùng `id`**: không cần tombstone. Xoá thư mục thì máy khách gửi
  tombstone cho thư mục và **mọi hậu duệ** (mỗi nút một op, mỗi op ~100 B).
- Không có `sort_order`, vì giao diện tự sắp (1.1). Gốc được sắp tất định: `root` trước, rồi theo tên.
- Có cột `space` (`'default'`) trong khoá chính, để sau này nhiều không gian không phải `ALTER`. Cột này không lộ ra API.

**Hàng lịch sử** (chỉ khi nội dung đổi, khi xoá, hoặc khi khôi phục):

```text
Revision { docId, rev, kind, name, parentId, deleted, hash, size,
           encoding: "full"|"delta"|"none", compressed: bool, baseRev: int|null,   # delta: so với keyframe baseRev
           body: str,                       # toàn văn | JSON hunk | "" ; zlib+base64 nếu compressed
           origin: "edit"|"merge"|"restore"|"import"|"migrate"|"delete",
           restoredFrom: int|null, label: str|null, device, savedAt (ms máy chủ), updatedAt (ms máy khách) }
```

### 3.2 Định dạng patch (dùng chung TS ↔ Python)

- Tách dòng bằng `split('\n')`, nối bằng `'\n'`. Hai ngôn ngữ cho kết quả giống hệt: giữ `\r`, giữ dòng rỗng cuối.
- `patch = { v: 1, h: [[o, d, [dòng chèn…]], …] }`: thay `d` dòng của bản gốc, bắt đầu từ dòng `o` (0-based), bằng các dòng chèn.
  Hunk tăng dần theo `o`, không chồng nhau. Áp từ cuối lên đầu.
- Máy khách tạo patch bằng **Myers O((N+M)·D)**:
  - cắt phần đầu/đuôi chung, gán số cho dòng;
  - trần `D = 2000`; quá trần, hoặc patch > 60 % nguyên văn, thì gửi nguyên văn.
  - Nguyên mẫu: `scratchpad/md-sync/proto-diff.mjs`, khoảng 90 dòng.
- Máy chủ chỉ **áp** patch, và tự kiểm ba điều:
  1. `baseHash` phải bằng `hash` hiện tại;
  2. mọi hunk nằm trong biên;
  3. `sha256(kết quả)` phải bằng `hash` trong op.

  Sai bất kỳ điều nào thì op bị `rejected/md_patch_mismatch`, và máy khách gửi lại nguyên văn.
- Delta trong lịch sử dùng cùng định dạng hunk, máy chủ tạo bằng `difflib.SequenceMatcher(autojunk=False)` sau khi cắt đầu
  đuôi chung. Thư viện chuẩn, không thêm gì.

### 3.3 API (tiền tố `API_PREFIX`; mọi câu trả lời `Cache-Control: no-store`; lỗi dùng phong bì chung `{message, data:{code}}`)

| Phương thức + đường | Quyền | Việc |
| --- | --- | --- |
| `GET /markdown/sync/changes?since=&limit=&device=&backend=` | như `GET /files` (công khai, hoặc theo `MARKDOWN_PUBLIC_READ` của md-share) | Bản ghi có `serverUpdatedAt > since`, cũ trước, trang ≤ 200 bản / ≤ 3 MB. Trả `{items, cursor, more, horizon, reset}`. `since=0`: bỏ tombstone. Bản ghi có `device == ?device` thì **không kèm `content`** |
| `POST /markdown/sync/push?backend=` | quản trị (`X-Admin-Session`/`X-Admin-Key`) | Thân `{device, ops[≤200]}`, ≤ 4 MB. Trả `{results[], serverTime}`. Từng op xử lý **độc lập**. Thân sai dạng thì 400 cả yêu cầu |
| `GET /markdown/docs/{id}?backend=` | như đọc | Bản mới nhất kèm `content`. 404 `md_doc_not_found` nếu không có hoặc đã xoá. **md-share dùng đường này** |
| `GET /markdown/docs/{id}/revisions?before=&limit=&backend=` | quản trị (đề xuất, Q5) | Danh sách siêu dữ liệu, mới trước |
| `GET /markdown/docs/{id}/revisions/{rev}?backend=` | quản trị | `{rev, content, name, …}` (dựng lại từ keyframe + delta) |
| `POST /markdown/docs/{id}/restore?backend=` `{rev, baseRev, device}` | quản trị | Tạo `rev` mới = nội dung của `rev` cũ, nếu đang xoá thì bỏ xoá. CAS theo `baseRev`, lệch thì `conflict` kèm bản hiện tại. Trả bản ghi kèm `content` |
| `PATCH /markdown/docs/{id}/revisions/{rev}` `{label}` | quản trị | Đặt hoặc bỏ tên phiên bản (bản có tên giữ mãi). Tuỳ chọn |
| `GET /markdown/trash?backend=` | quản trị | Tài liệu đã xoá còn lịch sử: `{id, name, deletedAt, lastRev}` |
| `GET /markdown/files` (cũ) | như cũ | Sau khi chuyển đổi: **dựng cây từ kho mới** (đọc được với bản app cũ và chế độ live của md-share) |
| `PUT /markdown/files` (cũ) | quản trị | Sau khi chuyển đổi: **409 `md_legacy_client`** "Bản Markdown Editor này đã cũ — tải lại trang để dùng đồng bộ mới" (cấu hình `MARKDOWN_LEGACY_PUT=reject\|allow`, mặc định `reject`). Trước khi chuyển đổi: như cũ |

**Op trong `push`**:

```jsonc
{ "id": "file-…", "kind": "file", "baseRev": 7,          // 0 = tài liệu mới
  "set": { "name": "x.md", "parentId": "folder-1" },      // tuỳ chọn: chỉ các trường siêu dữ liệu đã đổi
  "content": "…" | "patch": {"v":1,"h":[…]}, "baseHash": "…",   // tuỳ chọn: một trong hai
  "hash": "<sha256 nội dung kết quả>",                     // bắt buộc khi có content/patch
  "deleted": true | false,                                 // tuỳ chọn
  "updatedAt": 1761000000000 }
```

**Kết quả từng op**:

- `ok`: `{id, status:"ok", rev, contentRev, metaRev, hash, serverUpdatedAt}`. Không vọng lại nội dung.
- `conflict`: `{id, status:"conflict", parts:["content"|"meta"|"deleted"], record}`. `record` kèm `content` trừ khi chỉ xung đột `meta`.
- `rejected`: `{id, status:"rejected", code, message}`, với `code ∈ md_patch_mismatch, md_hash_mismatch, md_doc_too_large,
  md_kind_changed, md_bad_name, md_space_full, md_bad_clock`.

**Giới hạn** (đặt ở `markdown_docs_vo.py`):

| Tên | Giá trị |
| --- | --- |
| `MAX_OPS_PER_PUSH` | 200 |
| `MAX_PUSH_BYTES` | 4.000.000 |
| `MAX_DOC_BYTES` | 3.500.000 (một tài liệu và một trang kéo đều < 4,5 MB) |
| `MAX_DOCS` | 20.000 (tombstone tính vào) |
| `PAGE_ITEMS` / `PAGE_BYTES` | 200 / 3.000.000 |
| `MAX_CLOCK_AHEAD_MS` | 1 ngày |
| `SYNC_LAG_MS` | 2000 |

### 3.4 Thuật toán phía máy chủ (use case `MarkdownDocsUseCase`)

**push(op)**: lặp tối đa 3 lần (để chịu tranh chấp CAS):

```text
cur = repo.get(space, op.id)
if cur is None:
    if op.patch: rejected md_patch_mismatch            # không có gốc để áp
    rec = mới(rev=1, contentRev=1, metaRev=1, deleted=op.deleted or False)  # xoá thứ chưa từng có: vẫn lưu tombstone
    if not repo.insert(space, rec): continue           # máy khác vừa chèn cùng id → quyết lại
    ghi lịch sử (rev 1, origin "edit"|"import"); ok
if cur.kind != op.kind: rejected md_kind_changed
new_content = op.content ?? (op.patch ? áp(cur.content, op.patch) sau khi kiểm op.baseHash == cur.hash : None)
if new_content is not None and sha256(new_content) != op.hash: rejected md_hash_mismatch/md_patch_mismatch
# Bất biến lặp (idempotent): gửi lại một op đã áp mà mất phản hồi thì không thành xung đột giả
if trạng_thái_kết_quả(op, cur) == trạng_thái(cur): ok(cur)
parts = []
if đổi nội dung and cur.contentRev > op.baseRev: parts += ["content"]
if đổi meta và giá trị khác cur and cur.metaRev > op.baseRev: parts += ["meta"]
if op.deleted is True and not cur.deleted and cur.contentRev > op.baseRev: parts += ["deleted"]   # bên kia vừa sửa cái tôi xoá
if cur.deleted and op.deleted is not False and đổi nội dung: parts += ["deleted"]                  # bên kia vừa xoá cái tôi sửa
if parts: conflict(parts, cur)
rec = cur + thay đổi; rec.rev = cur.rev+1; contentRev/metaRev = rec.rev nếu phần đó đổi; tombstone thì content=None, hash=""
rec.serverUpdatedAt = now + chỉ_số_op; rec.device = body.device
if not repo.cas_write(space, rec, expected_rev=cur.rev): continue
if nội dung đổi hoặc deleted đổi: history.append(...)    # 3.5
ok(rec)
```

- Hai thay đổi **khác phần** đến cùng lúc được máy chủ tự gộp, không cần khứ hồi. Ví dụ: máy A đổi tên, máy B sửa nội dung, cả hai
  `baseRev=7`. Op đến sau vẫn qua, vì `metaRev` và `contentRev` được kiểm riêng.
- Kiểm cả yêu cầu trước khi ghi: số op, tổng byte, `MAX_DOC_BYTES`, đồng hồ, `name` không rỗng và không có `/`. Sai dạng thì 400
  cả yêu cầu, giống wiki.
- Ghi tài liệu và ghi lịch sử nằm trong **một giao dịch** ở MySQL. JSON và Mongo không có giao dịch: nếu ghi lịch sử hỏng thì
  ghi log và bỏ qua. Lịch sử thiếu một hàng chứ tài liệu không mất.
- `_make_room` như wiki: gần đầy `MAX_DOCS` thì dọn tombstone quá hạn trước, rồi mới trả 400 `md_space_full`.

**changes(since)**:

- Dùng nguyên luật phân trang và cắt trang của `wiki_usecase.list_items` (`:165-199`).
- `horizon` là mốc dọn tombstone xa nhất từng chạy (lưu ở `markdown_meta`). Nếu `0 < since < horizon` thì trả `reset:true`:
  máy khách đã vắng mặt lâu hơn hạn tombstone nên phải đối chiếu lại toàn bộ (3.7.4).

**restore(id, rev, baseRev)**:

- Dựng lại `content(rev)` rồi ghi như một op nội dung, `origin:"restore"`, `restoredFrom:rev`, và đặt `deleted=false`.
- Phục hồi cả `name`/`parentId` của bản đó nếu tài liệu đang bị xoá.
- Không bao giờ chép đè hàng cũ: luôn tạo `rev` mới. Muốn "hoàn tác khôi phục" thì khôi phục tiếp bản trước đó.

**Chuyển đổi dữ liệu cũ (lười, một lần)**: `ensure_migrated(backend)` chạy trước `changes`/`push`/`files`.

- Nếu `markdown_meta['migrated_v1']` chưa có: đọc kho cũ (json `MARKDOWN_JSON_FILE` / bảng `markdown_files` / collection
  `markdown_files`), làm phẳng cây và chèn mỗi nút `rev=1, origin="migrate", device="legacy"`. Lịch sử: keyframe rev 1.
- Rồi đặt cờ, kèm số nút và thời điểm.
- `id` không khớp mẫu thì đổi sang id mới. Bảng đổi id lưu trong cờ, máy khách dùng khi đối chiếu.
- Có khoá: asyncio cho json; ghi cờ trước bằng `INSERT …` với khoá chính ở mysql/mongo, ai chèn được cờ thì người đó chuyển.
- **Không xoá, không sửa** dữ liệu cũ, để quay lui được.

### 3.5 Lịch sử: keyframe + delta xuôi, gộp, chính sách giữ

**Ghi** (mỗi lần nội dung đổi ở `rev = r`):

1. Gộp: hàng mới nhất `L` có cùng `device`, `origin=="edit"`, `encoding=="delta"`, không có `label`, và `now - L.savedAt < COALESCE`
   (10 phút) → xoá `L`. Không hàng nào phụ thuộc một delta, nên xoá luôn an toàn.
2. `K` = keyframe mới nhất (`encoding=="full"`). Lưu **toàn văn** nếu một trong các điều sau đúng:
   - chưa có `K`;
   - `size < 2 KB`;
   - `r - K.rev ≥ KEYFRAME_EVERY` (50);
   - delta(K → mới) > 50 % nguyên văn.

   Ngoài ra lưu `delta`, `baseRev = K.rev`.
3. `body` > 32 KB thì nén zlib + base64, đặt `compressed = true`.
4. Tài liệu bị xoá thì thêm hàng `encoding:"none", deleted:true, origin:"delete"`. Nội dung trước khi xoá chính là hàng có nội
   dung ngay trước đó.

**Dựng lại** `content(rev)`: hàng `full` thì giải nén. Hàng `delta` thì đọc thêm keyframe `baseRev` rồi áp hunk: **2 lần đọc**,
không có chuỗi dài.

**Giữ** (chạy sau mỗi lần ghi lịch sử của *tài liệu đó*; mỗi tài liệu ≤ ~300 hàng nên đọc siêu dữ liệu rẻ):

- 50 hàng mới nhất (`KEEP_RECENT`);
- hàng mới nhất của mỗi ngày (múi `MARKDOWN_HISTORY_TZ`, mặc định +07:00) trong 90 ngày (`DAILY_DAYS`);
- mọi hàng có `label`;
- keyframe của **mọi hàng delta đang giữ**;
- trần cứng 300 hàng: vượt thì bỏ dần hàng theo-ngày cũ nhất.

Tài liệu xoá: lịch sử giữ đến khi tombstone hết hạn (90 ngày, `MARKDOWN_TOMBSTONE_DAYS`). Khi đó dọn cả tombstone lẫn lịch sử.
Việc dọn chạy theo nhịp, tối đa 6 giờ một lần mỗi tiến trình, gắn vào đường push. Mốc dọn được ghi thành `horizon`.

### 3.6 Lưu trữ ba kho

| Kho | Cấu trúc |
| --- | --- |
| **mysql** (tạo theo yêu cầu bằng `CREATE TABLE IF NOT EXISTS`, như wiki; id `utf8mb4_bin` trên MySQL) | `markdown_docs(space, id, kind, parent_id, name, content LONGTEXT NULL, hash CHAR(64), size INT, rev INT, content_rev INT, meta_rev INT, deleted INT, created_at BIGINT, updated_at BIGINT, server_updated_at BIGINT, device VARCHAR(64), PRIMARY KEY(space,id))` + chỉ mục `(space, server_updated_at)`. `markdown_doc_revisions(space, doc_id, rev, kind, name, parent_id, deleted, hash, size, encoding, compressed, base_rev, body LONGTEXT, origin, restored_from, label, device, saved_at, updated_at, PRIMARY KEY(space,doc_id,rev))`. `markdown_meta(space, k, v TEXT, PRIMARY KEY(space,k))`. CAS: `UPDATE markdown_docs SET …, rev=:rev WHERE space=:s AND id=:id AND rev=:expected`. Chèn trùng khoá thì `IntegrityError` → quyết lại. Câu lệnh SQL thuần, để test chạy trên SQLite |
| **mongo** | `markdown_docs` (`_id="<space>:<id>"`), `markdown_doc_revisions` (`_id="<space>:<id>:<rev>"`), `markdown_meta`. Chỉ mục `(space, serverUpdatedAt)` và `(space, docId, rev)`. CAS: `update_one({_id, rev: expected}, {$set: …})`. `fake_mongo` đã hỗ trợ `$lt/$gt/$in/$set/$inc/upsert/sort/limit` (`tests/support/fake_mongo.py:21-45`, `:133-158`) |
| **json** | `data/markdown-docs.json` (`MARKDOWN_DOCS_JSON_FILE`): `{version:1, spaces:{default:{meta, docs:{id: rec}}}}`. Ghi tệp tạm rồi đổi tên, có khoá asyncio, ghi lại cả tệp (như wiki). Lịch sử tách ra `data/markdown-history/<space>/<sha1(id)[:16]>.json`, mỗi tài liệu một tệp, vì `:` trong id không hợp lệ trên Windows. Đường dẫn qua `seeded_data_path`, như các kho JSON khác |

Port ra `MarkdownDocsRepositoryPort` có các hàm sau:

- tài liệu: `get(space, id)`, `get_many(space, ids)`, `list_since(space, since, limit, include_deleted)`, `list_live(space)`,
  `insert(space, rec) -> bool`, `cas_write(space, rec, expected_rev) -> bool`, `count(space)`;
- tombstone: `purge_tombstones(space, before) -> list[id]`;
- lịch sử: `add_revision`, `list_revisions(space, id, before, limit)`, `get_revision(space, id, rev)`,
  `delete_revisions(space, id, revs)`, `latest_keyframe(space, id)`, `set_label(space, id, rev, label)`;
- meta: `get_meta(space, k)`, `put_meta_if_absent(space, k, v) -> bool`, `put_meta(space, k, v)`.

Port ra thứ hai `LegacyMarkdownReaderPort.read_tree(backend)` bọc mã đọc cũ, chỉ dùng cho chuyển đổi.

### 3.7 Máy khách

#### 3.7.1 Mô-đun mới (TS, phần lớn thuần)

| Tệp | Nội dung |
| --- | --- |
| `src/sync/hash.ts` | `sha256Hex(text)`: dùng `crypto.subtle` nếu có, không thì bản JS thuần (từ `do-sha.mjs`) |
| `src/sync/lineDiff.ts` | `diffLines`, `makePatch`, `applyPatch`, `merge3` (từ `proto-diff.mjs`, thêm kiểu); `diffRows(a,b,context=3)` cho giao diện |
| `src/sync/records.ts` | Kiểu `DocRecord`, `LocalDoc`, `Shadow`, `OutboxEntry`. `treeToRecords(files)`. `buildTree(records)`: mồ côi lên gốc, phá **chu trình** do hai máy chuyển chéo, gốc sắp tất định. `diffTrees(prev, next)`: các id đổi tên/cha/nội dung, mới, và bị xoá (gồm hậu duệ) |
| `src/sync/docStore.ts` | Giao diện `DocStore` có 4 kho: `docs`, `shadows`, `outbox`, `meta`. Ba bản cài: `IdbDocStore` (IndexedDB, mặc định), `MemoryDocStore` (test), `LocalStorageDocStore` (dự phòng khi IndexedDB hỏng, định dạng v2 cũ). Kèm `migrateFromLocalStorage()` |
| `src/services/markdownSync.ts` | Gọi HTTP: `changes`, `push`, `getDoc`, `revisions`, `revision`, `restore`, `setLabel`, `trash`. Header quản trị **được truyền vào**, không import từ `markdownStorage`, để khỏi vỡ 7 tệp test đang `vi.mock` mô-đun đó |
| `src/sync/engine.ts` | Vòng đồng bộ (3.7.3); trạng thái `{phase, pending, lastSync, error, conflicts[], blocked[]}`; `now()`, `start()`, `stop()` |
| `src/sync/reconcile.ts` | Đối chiếu lần đầu hoặc khi `reset` (3.7.4) |
| `src/components/{SyncStatus,ConflictModal,DiffView,HistoryPanel,TrashModal,ReconcileModal}.tsx` | Giao diện (3.7.5) |

#### 3.7.2 Nối vào store

- **Một chỗ chặn duy nhất**: `flushPersist` (đã chạy sau 800 ms kể từ mỗi lần sửa) so cây vừa lưu với cây hiện tại bằng `diffTrees`.
  Rồi nó chỉ ghi các tài liệu đổi vào `DocStore` và đánh dấu outbox (gộp theo id: 1000 lần gõ vào một tài liệu = 1 op). Cách này
  bắt được mọi đường sửa (1.1), kể cả action viết sau này, mà không phải cài cắm từng action.
- `applyRemote(records)` là action mới. Nó đặt `files` và đồng thời cập nhật "cây vừa lưu", nên `diffTrees` không đẩy ngược lại
  những gì vừa kéo về.
- Tài liệu đang mở bị đổi từ xa:
  - chưa sửa cục bộ → thay nội dung, giữ vị trí con trỏ (kẹp vào độ dài mới) và báo "Updated from another device";
  - đang sửa → merge (3.7.3).
- **Khởi động**:
  - `localStorage` giữ cài đặt và một "ảnh khởi động" nhỏ `{version:3, tree không nội dung, currentFileId, expandedFolders,
    current:{id, content ≤ 512 KB}}`, để khung hình đầu vẫn là tài liệu đang mở như hôm nay.
  - IndexedDB nạp phần còn lại (~250 ms với 7,4 MB). `setCurrentFile` chờ `docsReady`.
  - Lần đầu: IndexedDB rỗng mà có localStorage v2 → chép sang, kiểm đọc lại được, rồi mới thay khoá v2 bằng ảnh khởi động
    (giải phóng hạn mức).
- Người xem (không quản trị): chỉ kéo, không đẩy.
- Đẩy bị 401/403 thì gọi `recheckAdminSession`. Bị từ chối thì hạ về chỉ-xem (đường đã có, `store.ts:172-183`), outbox giữ nguyên.

#### 3.7.3 Vòng đồng bộ

`cycle()` chạy một lượt một lúc. Đang chạy mà có yêu cầu mới thì đặt `again` để chạy tiếp:

1. **Đẩy**: lấy ≤ 200 mục outbox, ≤ 3,5 MB, thư mục cha trước (theo chuỗi `parentId`). Với mỗi mục, so `LocalDoc` (`L`) với
   `Shadow` (`S`):
   - `baseRev = S?.rev ?? 0`;
   - `set` = các trường meta khác `S`;
   - nội dung: `L.hash ≠ S.hash` thì gửi `patch` nếu `S` có nội dung, tài liệu > 4 KB và `makePatch` không bỏ cuộc; ngoài ra
     gửi `content`; cờ `forceFull` (sau `md_patch_mismatch`) thì luôn gửi `content`;
   - xoá cục bộ: `S` tồn tại thì gửi `{deleted:true}`; chưa từng lên máy chủ thì chỉ bỏ mục outbox.

   Xử lý kết quả:
   - `ok` → `S` = trạng thái đã gửi + rev mới. Nếu `L` đã đổi trong lúc chờ (số `version` của mục khác) thì mục vẫn bẩn.
   - `conflict` → xử lý như kéo về bản ghi `record` (bước 2).
   - `rejected` → `md_patch_mismatch` thì đặt `forceFull`; mã khác thì đưa mục vào `blocked[]` (hiện trong bảng Sync) và
     không chặn các mục khác.
2. **Kéo**: `changes(since=cursor, device)` đến hết `more`. Với mỗi bản ghi `R`, `L`/`S` như trên, `dirty` = có trong outbox:
   - `R.deleted`:
     - không bẩn → xoá cục bộ;
     - bẩn **nội dung** → *sửa thắng xoá*: giữ, đặt mục outbox `deleted:false` với `baseRev = R.rev`, và báo;
     - chỉ bẩn meta → chấp nhận xoá.
   - Chưa có `L` → tạo từ `R`. Thiếu `content` mà hash khác thì gọi `getDoc`.
   - Không bẩn → ghi đè `L` bằng `R`, `S = R`.
   - Bẩn:
     - meta: bên mình thắng (gửi lại với `baseRev` mới);
     - nội dung, nếu `R.contentRev > S.contentRev`: `merge3(S.content, L.content, R.content)`.
       - Sạch → `L = merged`, `S = R`, mục còn bẩn (sẽ đẩy bản đã gộp).
       - Đụng → `conflicts[id] = R`, `L` giữ nguyên, `S` giữ nguyên làm gốc; mục bị **tạm giữ** đến khi người dùng chọn.
   - `reset:true` → chạy đối chiếu (3.7.4).
   - Lưu `cursor` sau mỗi trang.
3. **Kích hoạt** (theo wiki):
   - 3 s sau lần lưu cục bộ có tài liệu bẩn;
   - `online` sau 0,5 s;
   - trang hiện lại khi lần đồng bộ cuối đã quá 60 s;
   - mỗi 90 s khi trang đang hiện;
   - nút "Sync now".

   Lỗi mạng: lùi 15 s × 2ⁿ, tối đa 5 phút; tôn trọng `Retry-After`. Ngoại tuyến thì `phase:"offline"` và outbox nằm chờ trong
   IndexedDB.
4. `deviceId = "md-" + ngẫu nhiên 10 ký tự`, lưu ở `meta` và localStorage. Nhãn máy lấy từ trình duyệt + hệ điều hành
   ("Edge · Windows").

#### 3.7.4 Đối chiếu lần đầu / sau `reset` / khi đổi kho json↔mysql↔mongo

Kéo toàn bộ (`since=0`), rồi so theo `id`:

| Tình huống | Cách xử lý |
| --- | --- |
| Hash giống | Nhận `S = R`, không gửi gì |
| Chỉ có ở máy này | Đẩy như mới, **trừ** `welcome.md` nguyên bản. Nếu máy chủ đã có tài liệu, bỏ `welcome` cục bộ |
| Chỉ có trên máy chủ | Tải về. Hộp thoại có tuỳ chọn "Xoá chúng khỏi máy chủ" (vì trước đây máy này có thể đã xoá mà máy chủ không biết) |
| Khác nhau, không có gốc chung | Mặc định **giữ cả hai**: bản máy chủ giữ `id`, bản máy này thành "name (this device).md" mới. Có nút làm hàng loạt "Prefer server" / "Prefer this device" |
| Meta khác (tên `root`…) | Máy chủ thắng |
| Sau `reset` (vắng mặt quá hạn tombstone) | Tài liệu từng đồng bộ (`S` có) mà máy chủ không còn → coi như đã bị xoá ở xa, trừ khi đang bẩn (bẩn thì đẩy như mới) |

Hộp thoại `ReconcileModal` chỉ hiện khi có mục "khác nhau" hoặc "chỉ có trên máy chủ". Còn lại chạy lặng lẽ.
Đổi kho thì xoá `shadows` + `cursor` rồi đối chiếu lại: mỗi kho là một nơi riêng, như `/wiki`.

#### 3.7.5 Giao diện (chuỗi giao diện **tiếng Anh** cho khớp app hiện tại; câu báo lỗi phía máy chủ tiếng Việt theo quy ước)

- **Thanh trạng thái** thay huy hiệu "Backend" bằng `SyncStatus`: "Synced 2 min ago" / "Syncing… (3)" / "Offline — 5 changes
  queued" / "⚠ 1 conflict". Bấm vào mở bảng Sync.
- **Menu Sync**: "Backend sync: on/off" (bật là đồng bộ nền), chọn kho (giữ `listBackends`, đổi kho thì cảnh báo), "Sync now",
  "Conflicts (n)…", "Trash…", "Replace this device's copy with the server's…" (huỷ dữ liệu, phải xác nhận; thay cho "Load from
  backend" cũ), "Version history…". Bỏ "Save to backend".
- **ConflictModal**:
  - hiện `DiffView` hai cột (một cột trên điện thoại) giữa bản máy này và bản máy chủ, có ghi rev, máy, giờ;
  - nút: *Keep mine* (đẩy `L` với `baseRev = R.rev`; bản máy chủ vẫn còn trong lịch sử) / *Use server's* (`L` cũ lưu ở kho `stash`
    cục bộ 30 ngày, xem được ở History) / *Keep both* (bản của tôi thành tài liệu mới "name (conflict 2026-10-22 14:03).md") /
    *Merge manually* (mở trình soạn với dấu `<<<<<<< This device` / `=======` / `>>>>>>> Server`; nút "Mark resolved" bị khoá
    khi còn dấu).
  - Cây tệp gắn ⚠ cho tài liệu đang xung đột.
- **HistoryPanel** (ngăn bên phải; mở bằng bảng lệnh "Show version history" và Ctrl+Alt+H):
  - danh sách theo ngày: giờ, máy, `+x/−y` dòng, huy hiệu `restored from #n` / `merged` / tên phiên bản;
  - chọn một bản → xem render (`MarkdownView`) hoặc diff với bản hiện tại hay bản liền trước (inline / hai cột);
  - so hai bản bất kỳ (chọn A và B);
  - hành động: *Restore this version* (quản trị, tạo bản mới), *Copy as new document*, *Download .md*, *Name this version*.
  - Ngoại tuyến hay chưa bật đồng bộ thì chỉ hiện các bản `stash` cục bộ.
- **DiffView**: dựng hàng từ hunk, 3 dòng ngữ cảnh, gập đoạn không đổi ("⋯ 120 unchanged lines"). Tối đa 400 hàng thì có "Show
  more". Tô thêm phần đổi trong dòng là tuỳ chọn, để sau.
- **TrashModal**: tài liệu đã xoá (`GET /markdown/trash`), nút "Restore", gọi `restore` với rev nội dung cuối.

### 3.8 Hiệu năng, bộ nhớ

- Đẩy một dòng của tài liệu 1 MB: diff 14,5 ms + SHA-256 13 ms (WebCrypto) hoặc 54 ms (JS thuần), thân ~0,5 KB.
- Kéo lần đầu 7,4 MB: 3 trang ≤ 3 MB. Ghi IndexedDB ~250 ms.
- `diffTrees` mỗi 800 ms: so 211 nút. Chuỗi bất biến nên phần lớn là so tham chiếu, O(1).
- Bản bóng nhân đôi dung lượng IndexedDB (~15 MB): không đáng kể so với hạn mức 10 GB đã đo.
- Máy chủ cắt đầu đuôi chung trước `difflib` (nguyên mẫu cho thấy ca 1 dòng gần như tức thì). Tài liệu > 50.000 dòng thì luôn lưu
  keyframe, khỏi diff.

### 3.9 Service worker / PWA

`sw.js` chỉ đụng GET cùng origin dưới phạm vi app. Các đường `/markdown/sync/*`, `/markdown/docs/*` nằm dưới `API_PREFIX`, nên
**không được cache** (giữ đúng luật trong CLAUDE.md). Không sửa mẫu `pwa/sw.js`. Ngoại tuyến thì outbox nằm trong IndexedDB và
gửi khi có mạng.

### 3.10 Chỗ nối với md-share

- `MarkdownDocsInputPort.get_document(id, backend) -> DocRecord` và `GET /markdown/docs/{id}`. Chế độ "live" đọc bản mới nhất.
  `hash`/`contentRev` dùng làm ETag.
- Chế độ "snapshot" của md-share không phụ thuộc kho này.
- Sau khi cài: bỏ ghi chú "Hãy Save to backend trước" ở md-share §3.11, vì tài liệu tự đồng bộ.

---

## 4. Danh sách việc (thứ tự phụ thuộc; mỗi việc một lượt agent)

| # | Việc | Tệp | Kiểm | Cỡ |
| --- | --- | --- | --- | --- |
| B1 | Tiện ích patch dòng + băm phía máy chủ | `src/application/utils/line_patch.py` (`split_lines`, `apply_patch`, `make_delta` = difflib + cắt đầu đuôi, `sha256_hex`), `tests/application/test_line_patch.py` | pytest: round-trip ngẫu nhiên 500 ca; CRLF, rỗng, dòng cuối rỗng; hunk ngoài biên → `ValueError`; **fixture patch sinh bởi TS** (`tests/fixtures/markdown_patches.json`, chép tay từ `proto-diff.mjs`) áp đúng | S |
| B2 | VO + port | `src/domain/vo/markdown_docs_vo.py`, `src/application/ports/output/markdown_docs_repository_port.py`, `src/application/ports/input/markdown_docs_input_port.py`, `tests/domain/test_markdown_docs_vo.py` | pytest: id sai mẫu, op vừa `content` vừa `patch`, `patch` thiếu `baseHash`, > 200 op, `kind` lạ → lỗi xác thực | S |
| B3 | Kho JSON + bộ test hợp đồng | `src/adapter/output/markdown_docs/__init__.py`, `json_repository.py`, `tests/adapter/output/markdown_docs/test_markdown_docs_repositories.py` (tham số hoá theo kho) | pytest: insert trùng → False; CAS sai rev → False; `list_since` thứ tự (stamp, id) + `include_deleted`; lịch sử thêm/đọc/xoá/keyframe mới nhất; meta `put_if_absent`; ghi tệp tạm rồi đổi tên; tệp hỏng → `.corrupt` | M |
| B4 | Kho MySQL (SQLite trong test) | `src/adapter/output/markdown_docs/mysql_repository.py`, thêm tham số vào test hợp đồng | pytest hợp đồng chạy với `sqlite+aiosqlite` tạm; DDL có `utf8mb4_bin` chỉ khi dialect là mysql; tranh chấp insert → `IntegrityError` → thử lại | M |
| B5 | Kho Mongo | `src/adapter/output/markdown_docs/mongo_repository.py`, tham số `fake_mongo` | pytest hợp đồng với `fake_mongo.install` | S |
| B6 | Use case: push | `src/application/usecases/markdown_docs_usecase.py` (phần ghi), `tests/application/test_markdown_docs_push.py` | pytest (kho JSON `tmp_path`, đồng hồ giả): tạo / sửa / patch đúng / `md_patch_mismatch` / `md_hash_mismatch`; xung đột content; **meta và content khác phần tự gộp**; xoá vs sửa (2 chiều); gửi lại cùng op → `ok`, không xung đột giả; tombstone bỏ content; giới hạn byte/op/doc; đồng hồ lệch; `md_space_full` sau khi dọn tombstone | L |
| B7 | Use case: changes + phân trang | cùng tệp + `src/application/utils/sync_paging.py` (hàm thuần cắt trang, chép luật `wiki_usecase.py:173-198`), `tests/application/test_markdown_docs_changes.py` | pytest: trang không cắt giữa hai stamp trùng; `since=0` bỏ tombstone; `device` → bản của mình không có content; `horizon` → `reset:true`; trang ≤ 3 MB vẫn có ít nhất 1 bản | M |
| B8 | Lịch sử: ghi + dựng lại + liệt kê | cùng tệp, `tests/application/test_markdown_docs_history.py` | pytest: mỗi lần đổi nội dung một hàng; gộp cùng máy < 10 phút (đồng hồ giả); keyframe theo 4 luật; nén khi > 32 KB; **dựng lại mọi rev đang giữ = bản gốc** (so với nhật ký ghi trong test); hàng `delete` | M |
| B9 | Giữ phiên bản + restore + trash + dọn tombstone | cùng tệp, `tests/application/test_markdown_docs_retention.py` | pytest: 200 lần sửa trải 120 ngày → còn 50 gần nhất + 1/ngày trong 90 ngày + bản có tên + keyframe cần thiết, mọi bản còn đều dựng lại được; restore tạo rev mới `origin=restore`, `restoredFrom`; restore khi `baseRev` cũ → conflict; restore tài liệu đã xoá; tombstone quá hạn → dọn cả lịch sử, `horizon` tăng | M |
| B10 | Chuyển đổi dữ liệu cũ + hành vi đường cũ | `src/adapter/output/markdown_docs/legacy_reader.py`, use case `ensure_migrated`, sửa `markdown_storage_controller.py` (GET dựng từ kho mới khi đã chuyển; PUT → 409 `md_legacy_client`), `tests/application/test_markdown_docs_migration.py` + thêm ca vào `test_markdown_storage_controller.py` | pytest: cây cũ (json / sqlite / fake_mongo) → đúng số nút, `rev=1`, lịch sử rev 1; chạy hai lần không nhân đôi; id lạ được đổi + bảng đổi; bảng cũ không đổi một byte; sau chuyển đổi `PUT /files` 409, `GET /files` trả cây từ kho mới; `MARKDOWN_LEGACY_PUT=allow` giữ hành vi cũ; **mọi test cũ của tệp vẫn xanh** | M |
| B11 | Factory + controller + cấu hình + tài liệu API | `src/adapter/factory/markdown_docs_factory.py`, `src/adapter/input/controllers/markdown_docs_controller.py`, `src/main.py` (include_router), `src/application/config/config.py` (biến `MARKDOWN_*` mới), `tests/adapter/input/controller/test_markdown_docs_controller.py`, `docs/markdown-sync-api.md` | pytest: push không phiên → 403; phiên hợp lệ → 200; history/restore/trash cần quản trị; `no-store`; 400 khi thân sai; `?backend=mongo` thiếu URI → 503; **toàn bộ pytest backend xanh** | M |
| F1 | Băm + diff/patch/merge (TS) | `src/sync/hash.ts`, `src/sync/lineDiff.ts`, `src/sync/__tests__/hash.test.ts`, `lineDiff.test.ts` | vitest: SHA-256 thuần JS khớp vector chuẩn ("", "abc", tiếng Việt, 70.000 "ệ"); round-trip 500 ca ngẫu nhiên; CRLF; bỏ cuộc khi D > trần; merge3: khác chỗ / cùng thay đổi / đụng dòng / cùng chèn một điểm / xoá vs sửa; `diffRows` gập ngữ cảnh; **patch fixture giống hệt tệp fixture của B1** | M |
| F2 | Bản ghi + cây | `src/sync/records.ts`, `src/sync/__tests__/records.test.ts` | vitest: `buildTree` mồ côi → gốc, chu trình A↔B bị phá, gốc `root` trước; `diffTrees` phát hiện đổi nội dung / tên / cha / mới / xoá cả hậu duệ / chép thư mục (id mới) | S |
| F3 | Kho cục bộ | `src/sync/docStore.ts`, `src/sync/__tests__/docStore.test.ts` | vitest với `MemoryDocStore` + `LocalStorageDocStore` (jsdom): outbox gộp theo id + `version`; chuyển từ localStorage v2 (và khoá legacy) giữ đủ tài liệu; IndexedDB hỏng → dự phòng localStorage. IndexedDB thật kiểm ở F11 (không thêm `fake-indexeddb`) | M |
| F4 | Nối store | `src/store.ts`, `src/lib/persistence.ts` (ảnh khởi động v3), `src/__tests__/store.test.ts` (sửa phần persistence) | vitest: `flushPersist` chỉ ghi tài liệu đổi + outbox; `applyRemote` không sinh outbox; khởi động từ ảnh v3 hiện đúng tài liệu ngay khung đầu; v2 cũ vẫn mở được; **toàn bộ 367 test cũ + type-check + lint xanh** | L |
| F5 | Client HTTP | `src/services/markdownSync.ts`, `src/services/markdownSync.test.ts` | vitest (fetch giả): URL đủ `backend`/`device`/`since`; header quản trị truyền vào; mã lỗi → `SyncError{status, code, retryAfter}`; hết giờ 10 s | S |
| F6 | Bộ máy đồng bộ | `src/sync/engine.ts`, `src/sync/__tests__/engine.test.ts`, `src/sync/__tests__/fakeServer.ts` (máy chủ giả trong bộ nhớ, đúng luật 3.4) | vitest với **hai thiết bị + máy chủ giả**: sửa A hiện ở B; ngoại tuyến xếp hàng rồi gửi một op/tài liệu; patch chỉ khi > 4 KB; `md_patch_mismatch` → gửi nguyên văn; khác chỗ tự gộp; đụng → `conflicts`; sửa thắng xoá; đổi tên + sửa nội dung song song; chặn tải lại bản của mình; lùi lại + `Retry-After`; 403 → dừng đẩy; `rejected` không chặn hàng | L |
| F7 | Đối chiếu lần đầu | `src/sync/reconcile.ts`, `src/components/ReconcileModal.tsx`, test tương ứng | vitest: 4 nhóm (giống / chỉ ở đây / chỉ ở máy chủ / khác); `welcome` nguyên bản không đẩy; mặc định giữ cả hai; đổi kho → đối chiếu lại; `reset` → tài liệu đã đồng bộ mà máy chủ không còn thì xoá cục bộ trừ khi bẩn | M |
| F8 | Trạng thái + menu Sync | `src/components/SyncStatus.tsx`, `Header.tsx`, `StatusBar.tsx`, `CommandPalette.tsx`, `App.tsx` (khởi động engine), `src/__tests__/sync-ui.test.tsx` | vitest: 4 trạng thái hiển thị đúng; "Sync now" gọi `engine.now`; "Replace this device's copy" hỏi xác nhận; người xem không thấy nút đẩy; **thêm mock cho mô-đun mới ở các test đang mock storage nếu cần** | M |
| F9 | DiffView + ConflictModal | `src/components/DiffView.tsx` (+css), `ConflictModal.tsx` (+css), `src/__tests__/conflict.test.tsx` | vitest: bốn lựa chọn ra đúng op/tài liệu; "Mark resolved" khoá khi còn dấu; gập ngữ cảnh; bẫy tiêu điểm (`useFocusTrap`) | M |
| F10 | HistoryPanel + Trash | `src/components/HistoryPanel.tsx` (+css), `TrashModal.tsx`, `src/__tests__/history.test.tsx` | vitest (fetch giả): nhóm theo ngày; xem / diff hai bản; Restore gọi API rồi áp bản ghi trả về; Copy as new; khách không thấy Restore; điện thoại một cột | M |
| F11 | Kiểm trình duyệt thật + xuất bản | `markdown-editor/scripts/kiem-dong-bo.py` (mới), `markdown-editor/scripts/kiem-pwa.py` (đổi phép kiểm localStorage → IndexedDB) | Edge thật, FastAPI thật với `DB_URL` SQLite tạm + kho json tạm, hai context: (1) A sửa → B thấy; (2) B `set_offline` sửa → có mạng → đẩy; (3) cùng tài liệu khác dòng → tự gộp; cùng dòng → hộp thoại; (4) **thân push khi sửa 1 dòng của tài liệu 1 MB < 2 KB** (bắt request); (5) lịch sử: diff + restore tạo bản mới; (6) workspace 200 tài liệu / 7,4 MB tải lại không mất chữ; (7) bản cũ `PUT /files` → 409. Rồi `node scripts/build-webapps.mjs --only markdown-editor` + `--check` | M |
| F12 | Bàn giao | `tasks/2610/<ngày>/markdown-sync/ban-giao.md`, cập nhật `.claude/skills/ban-do-ung-dung/SKILL.md` (dòng markdown-editor-pro + bảng API), `.claude/skills/webapp-react/SKILL.md` (cạm bẫy IndexedDB / mock) | đọc lại; mọi lệnh kiểm trong tài liệu chạy được | S |

B1–B11 và F1–F3 chạy song song được. F4 cần F2+F3. F6 cần F1–F5. F7–F10 cần F6. F11 cần tất cả.

---

## 5. Rủi ro

1. **Đổi kho cục bộ sang IndexedDB** là thay đổi lớn nhất về máy khách. Lỗi ở đây có thể làm mất dữ liệu chưa đồng bộ.
   Giảm rủi ro bằng ba cách:
   - chép trước, xác minh, rồi mới xoá khoá v2;
   - giữ đường dự phòng `LocalStorageDocStore`;
   - F11 có ca tải lại 7,4 MB.
2. **Triển khai lên Aiven** tự tạo 3 bảng mới. Lần gọi `/markdown/sync/*` đầu tiên **chép dữ liệu cũ sang** (ghi vào DB thật khi
   chủ dự án deploy). Bảng `markdown_files` cũ không bị đụng, nên quay lui được. Phải nói rõ trước khi deploy. Agent không chạy
   trên DB thật.
3. **Bản app cũ đang mở** sẽ nhận 409 khi lưu. Thông báo cần dễ hiểu, không làm mất bản cục bộ (bản cũ chỉ hiện toast, dữ liệu
   vẫn ở localStorage của nó). Bản cũ `webapp/tranphuc8a/markdown-editor` (lỗi thời) cũng mất khả năng lưu.
4. **Đồng hồ máy khách** chỉ dùng để hiển thị (`updatedAt`). Không dùng để phân định thắng thua, nên lệch giờ không gây mất dữ
   liệu (khác `/wiki`).
5. **Nhiều tiến trình serverless**: CAS ở DB nên an toàn. Kho JSON trên serverless vẫn chỉ là nháp (như mọi kho JSON khác).
6. **Chuỗi JS có surrogate lẻ**: `TextEncoder` thay bằng U+FFFD, còn Python từ chối, nên hash lệch. Máy chủ kiểm mã hoá UTF-8
   như `wiki_usecase.json_bytes` và trả `rejected`. Máy khách chuẩn hoá bằng `toWellFormed()` nếu có.
7. **Gộp tự động sai ngữ nghĩa**: hai sửa khác dòng vẫn có thể mâu thuẫn ý. Cách xử lý:
   - chấp nhận như git;
   - báo "Merged changes from another device", có "View diff";
   - lịch sử máy chủ còn cả hai bản.
8. **Chu trình / mồ côi** do chuyển chéo hay xoá thư mục song song: `buildTree` tự sửa khi hiển thị. Phía quản trị đẩy một op sửa
   meta để kho hội tụ.
9. **Tài liệu > 3,5 MB** không đồng bộ được: báo rõ trong bảng Sync. Hiện nay cả cây > 4,5 MB đã hỏng, nên vẫn là cải thiện.
10. **Bảy tệp test** `vi.mock('../services/markdownStorage')`: mô-đun mới không import từ đó. Khởi động engine nằm sau cờ
    `backendStorage`, nên các test đó không gọi mạng.
11. **Chi phí `difflib`** trên máy chủ yếu (Vercel): 55–250 ms cho mỗi tài liệu 1 MB đổi, *chưa đo trên Vercel*. Cắt đầu đuôi
    chung + giới hạn 50.000 dòng làm keyframe. Nếu vẫn chậm, đổi sang Myers bản Python (chép từ TS).
12. **Khối lượng**: 23 việc, khoảng 3 L + nhiều M. Nên làm theo đợt:
    - đợt 1: B1–B11 + F1–F8 + phần đồng bộ của F11, cùng bàn giao. Đồng bộ delta, đối chiếu lần đầu, trạng thái. Xung đột đụng
      dòng tạm xử lý tự động theo "giữ cả hai", chưa có hộp thoại.
    - đợt 2: F9, F10 (hộp thoại xung đột, lịch sử, diff, khôi phục, thùng rác), phần còn lại của F11, F12.

---

## 6. Lệnh kiểm

```bash
# đã chạy trong pha này (scratch, không đụng repo)
node "$S/md-sync/proto-diff.mjs"                     # 7/7 + 500/500
node "$S/md-sync/do-payload.mjs"                     # số đo mục 1.4
node "$S/md-sync/do-sha.mjs"
PYTHONUTF8=1 backend/fastapi/.venv/Scripts/python.exe "$S/md-sync/do-difflib.py"
PYTHONUTF8=1 backend/fastapi/.venv/Scripts/python.exe "$S/md-sync/do-localstorage.py"      # Edge thật
cd backend/fastapi && DB_URL="sqlite+aiosqlite:///$S/md-sync/x.db" PYTHONUTF8=1 .venv/Scripts/python.exe "$S/md-sync/thu-ghi-de.py"
cd backend/fastapi && DB_URL="sqlite+aiosqlite:///$S/md-sync/x.db" .venv/Scripts/python.exe -m pytest -q tests/adapter/input/controller/test_markdown_storage_controller.py tests/application/test_wiki_usecase.py tests/adapter/output/wiki/test_wiki_repositories.py   # 168 đạt
cd markdown-editor && npx vitest run src/services/markdownStorage.test.ts src/__tests__/store.test.ts   # 54 đạt

# sau khi cài
cd backend/fastapi && .venv/Scripts/python.exe -m pytest -q tests/application/test_line_patch.py tests/application/test_markdown_docs_*.py tests/adapter/output/markdown_docs tests/adapter/input/controller/test_markdown_docs_controller.py tests/adapter/input/controller/test_markdown_storage_controller.py
cd backend/fastapi && .venv/Scripts/python.exe -m pytest -q                       # toàn bộ (>1.000 test)
cd markdown-editor && npm test && npm run type-check && npm run lint && npm run build
backend/fastapi/.venv/Scripts/python.exe markdown-editor/scripts/kiem-dong-bo.py  # Edge thật, 2 thiết bị, FastAPI + SQLite tạm
backend/fastapi/.venv/Scripts/python.exe markdown-editor/scripts/kiem-pwa.py
node scripts/build-webapps.mjs --only markdown-editor && node scripts/build-webapps.mjs --check
```

(`$S` = `C:/Users/TRANPH~1/AppData/Local/Temp/claude/c--Users-tranphuc8a-Desktop-gemini-proxy/2fd2853d-4c94-4034-a078-2b6358d957ee/scratchpad`)

---

## 7. Phụ thuộc mới

**Không có.** Các phương án đã cân nhắc và *không* đề xuất:

| Thư viện | Cỡ ước lượng | Vì sao không |
| --- | --- | --- |
| `diff` (jsdiff) / `diff-match-patch` | ~20–40 KB min | Myers dòng + merge3 tự viết ~4 KB, đã chạy đúng 500/500 ca. Diff mức ký tự chưa cần (patch dòng đã nhỏ ×20.000) |
| `fake-indexeddb` (dev) | ~200 KB | Thay bằng `MemoryDocStore` sau giao diện `DocStore`. IndexedDB thật kiểm bằng Playwright (F11) |
| `idb` / `dexie` | 3 KB / 90 KB | Bọc IndexedDB tay khoảng 120 dòng là đủ (Personal Wiki đã làm vậy bằng JS thuần) |

Máy chủ chỉ dùng thư viện chuẩn: `difflib`, `zlib`, `hashlib`, `base64`.

---

## 8. Cần chủ dự án quyết

| # | Câu hỏi | Lựa chọn | Đề xuất |
| --- | --- | --- | --- |
| Q1 | Chuyển kho cục bộ sang IndexedDB ngay đợt này? | a) Có · b) Giữ localStorage (workspace > 5,24 triệu ký tự vẫn hỏng) | **a** (P3 đã kiểm) |
| Q2 | Xung đột cùng tài liệu | a) Merge 3 chiều tự động, đụng thì hỏi · b) Luôn giữ cả hai bản · c) Mới hơn thắng (như wiki) | **a** |
| Q3 | Lưu lịch sử | a) Keyframe + delta (gọn ~1.000×) · b) Toàn văn nén zlib mỗi bản (đơn giản, ~5× nhỏ hơn toàn văn) | **a** |
| Q4 | Chính sách giữ | 50 gần nhất + 1/ngày × 90 ngày + bản có tên giữ mãi; gộp cùng máy 10 phút; tombstone 90 ngày (đổi được qua `MARKDOWN_HISTORY_*`) | **như đề xuất** |
| Q5 | Lịch sử / thùng rác ai đọc được? | a) Chỉ quản trị · b) Công khai như `GET /files` | **a**: nội dung đã xoá không nên lộ |
| Q6 | `PUT /markdown/files` của bản cũ sau chuyển đổi | a) 409 · b) Vẫn ghi (ghi đè kho mới, nguy hiểm) · c) Dịch thành op | **a** |
| Q7 | Đồng bộ nền khi bật "Backend sync" | a) Tự động (3 s sau khi gõ, khi có mạng, 90 s) · b) Chỉ nút "Sync now" | **a** |
| Q8 | Lần đối chiếu đầu, tài liệu khác nhau | a) Giữ cả hai · b) Máy chủ thắng · c) Máy này thắng | **a** (+ nút hàng loạt) |
| Q9 | Tạo bảng | a) Tự tạo khi cần (như `/wiki`) · b) Alembic `0007_markdown_docs` | **a** (bảng cũ cũng tự tạo) |
| Q10 | Lịch sử cục bộ khi không dùng máy chủ | a) Chỉ `stash` khi chọn "Use server's" · b) 20 bản/tài liệu trong IndexedDB | **a** (b để sau) |
| Q11 | Ngôn ngữ chuỗi giao diện mới | a) Tiếng Anh như app hiện tại · b) Tiếng Việt | **a** |
| Q12 | Chia đợt | a) Đợt 1 đồng bộ delta, đợt 2 giao diện lịch sử/xung đột · b) Một đợt | **a** |
