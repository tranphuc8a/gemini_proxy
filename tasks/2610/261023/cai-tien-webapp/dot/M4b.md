# M4b — Đồng bộ delta + lịch sử, frontend (IndexedDB) (24/10/2026, làn A, đợt 2)

**Trạng thái: xong F1–F8, F11 (phần P1); đã sửa sau kiểm độc lập — xem mục "Sửa sau kiểm" cuối tệp (số liệu ở các bảng trên là của bản đầu).** Chưa commit. Build xuất bản hiện tại `6072167a6a8f` (`webapp/tranphuc8a/markdown-editor-pro/`, `build-webapps.mjs --check` exit 0, 7 app ok).
Không chạm database thật: mọi tiến trình backend chạy với `DB_URL` SQLite tạm, `MONGO_URI=""`, `RATE_LIMIT_BACKEND=memory`, `AI_ENABLED=false`, mọi `*_STORAGE_BACKEND=json`; không đọc/in `.env`. Không gọi Gemini.
Thiết kế: `thiet-ke/md-sync.md` (§3.7, F1–F8, F11). API: `docs/markdown-sync-api.md`. Backend (M4a) không đổi trừ **mặc định `MARKDOWN_LEGACY_PUT` → `reject`** (xem dưới).

## Đã làm
| Việc | Kết quả |
|---|---|
| F1 | `src/sync/lineDiff.ts` (Myers có trần D, patch hunk, `merge3`), áp đúng `backend/fastapi/tests/fixtures/markdown_patches.json` (15 ca) và sinh cùng định dạng; băm = `src/lib/hash.ts` của M3 (`sha256Hex`, có bản JS thuần); `src/sync/text.ts` (`wellFormed`: surrogate lẻ → U+FFFD trước khi băm/gửi) |
| F2 | `src/sync/records.ts`: `LocalDoc`/`Shadow`/`OutboxEntry`/`ServerRecord`, `treeToDocs`, `diffTrees` (nút đổi/mới/xoá cả hậu duệ; chữ `undefined` = "chưa nạp", không bao giờ là sửa), `buildTree` (mồ côi lên gốc, phá chu trình ở id nhỏ nhất như máy chủ, `root` trước) |
| F3 | `src/sync/docStore.ts`: `DocStore` (docs, shadows, outbox, meta; `commit` nguyên tử). `IdbDocStore` (mặc định), `MemoryDocStore` (test), `LocalStorageDocStore` (dự phòng: tài liệu vẫn ở khoá v2 **đồng bộ** như cũ, bookkeeping ở `markdown-editor:sync`; shadow > 32 KB giữ hash không giữ chữ) |
| lớp mới | `src/sync/workspace.ts` — người ghi DUY NHẤT: baseline (bản ghi đã ghi), `capture()` so cây với baseline và ghi chỉ nút đổi + đánh dấu outbox **cùng giao dịch**; `commitRemote()` áp thay đổi từ xa nhưng TỪ CHỐI (false) nếu nút đã bị gõ sau lúc engine đọc; ghi lỗi → ghi lại từ trạng thái HIỆN TẠI (không từ commit cũ); `reconcileBoot` |
| F4 | `store.ts`: `hydrate` đồng bộ vẽ khung đầu từ khoá v2 hoặc **ảnh khởi động v3** (`{version:3, seq, tree, currentFileId, expandedFolders, current:{id,content≤512 KB}}`), rồi mở IndexedDB: kho rỗng + v2 → chép, **đọc lại so từng chữ**, rồi mới thay khoá v2 bằng ảnh v3; lỗi/đọc lại lệch → giữ v2, chạy tiếp bằng dự phòng. `flushPersist` chỉ ghi tài liệu đổi. `docsReady=false` tới khi nạp xong (sửa/thao tác cây bị từ chối; chọn tệp được hoãn). `seq` trong ảnh v3 và trong IDB: ảnh v3 mới hơn IDB (đóng tab giữa giao dịch) → lấy cây + chữ tài liệu đang mở của ảnh. Ảnh v3 dùng khoá `tree` (không `files`): bản app cũ đọc vào thấy "không có workspace" thay vì ghi đè rỗng |
| F5 | `src/services/markdownSync.ts`: `SyncApi` (`changes`/`push`/`getDoc`), `createHttpSyncApi` (header quản trị truyền vào, `no-store`, `credentials:'omit'`, hết giờ 30 s, `SyncError{status,code,retryAfter,offline}`, câu tiếng Anh cho mã đã biết) |
| F6 | `src/sync/engine.ts`: đẩy (≤ 50 op / ≤ 3,5 MB chữ mỗi yêu cầu, patch khi > 4 KB, `md_patch_mismatch` → nguyên văn, lỗi từng op **chặn riêng** (`blocked`) không chặn hàng), kéo theo con trỏ (`cursor:<backend>`), merge 3 chiều theo dòng, sửa thắng xoá hai chiều, bỏ qua bản đã biết (theo `rev/contentRev/metaRev/deleted`), `contentOmitted` → `getDoc`; nền: 3 s sau khi gõ yên, `online` 0,5 s, tab hiện lại sau > 60 s, 90 s; lùi 15 s × 2ⁿ ≤ 5 phút + `Retry-After`; 401/403 → `recheckAdminSession`; khách: chỉ kéo |
| F7 | `reconcile` (lần đầu / `reset` / đổi kho): giống → nhận; chỉ ở đây → đẩy (trang chào nguyên bản — kể cả hai bản cũ qua `KNOWN_WELCOME_SHA256` — KHÔNG đẩy, và nhường bản của máy chủ); chỉ ở máy chủ → tải; khác không gốc chung → mặc định **giữ cả hai** ("name (this device).md"), hoặc "Prefer server"/"Prefer this device"; sau `reset`: đã đồng bộ mà máy chủ không còn → xoá cục bộ trừ khi đang sửa; tuỳ chọn xoá bản chỉ-ở-máy-chủ. `ReconcileModal` chỉ hiện khi có gì để quyết |
| F8 | `SyncStatus` (thay huy hiệu "Backend": *Synced 2 min ago / Syncing… (3) / Offline — 5 changes queued / ⚠ 1 conflict / …*), `SyncPanel` (xung đột: Keep mine / Use the server's / Keep both; tài liệu bị máy chủ từ chối + "Try again"), menu Sync (**bỏ "Save to backend"**, "Load from backend" → "Replace this device's copy with the server's…" hỏi sau khi đã hỏi máy chủ, nêu số thay đổi chưa gửi sẽ mất; "Sync now"; "Conflicts (n)…"), bảng lệnh (Sync now / Sync status…). **Gỡ các vá tạm của M1**: hỏi xác nhận "Load from backend", dòng cảnh báo "ghi đè cả kho". Giữ `StorageBanner` (còn đúng khi dự phòng localStorage đầy; nay nói đúng "chỉ cài đặt không lưu được, tài liệu thì có" khi tài liệu ở IndexedDB) |
| F11 | `scripts/kiem-dong-bo.py` (mới, 42 phép), `kiem-pwa.py` chuyển sang `_kiem_chung.py` + kiểm IndexedDB (57 → 59 phép), `kiem-hieu-nang.py` sửa `NAP`, `kiem-chia-se.py` đổi sang luồng mới (33 → 34 phép), `_kiem_chung.py` thêm `RATE_LIMIT_BACKEND=memory` + mọi `*_STORAGE_BACKEND=json` vào môi trường máy chủ thử |
| backend | `MARKDOWN_LEGACY_PUT` mặc định **`reject`** (config.py, `.env.example`, README, `docs/markdown-sync-api.md`); chỉ chữ `allow` mới cho PUT cũ (gõ sai → đóng); test: mặc định 409 sau khi chuyển đổi, `allow` là opt-out, giá trị lạ → 409, mặc định của `Settings` là `reject` |

## Lệnh kiểm (kết quả thật, 24/10)
| Lệnh | Kết quả |
|---|---|
| `cd markdown-editor && npm test && npm run type-check && npm run lint` | exit 0 — **52 tệp / 1.061 test** (218 s; trước đợt 849 / 43), tsc sạch, eslint 0 cảnh báo |
| `backend/fastapi/.venv/Scripts/python.exe markdown-editor/scripts/kiem-dong-bo.py` | exit 0 — **Đạt 42 · SAI 0** (≈ 85 s, Edge 155 thật + uvicorn thật + SQLite qua kho "mysql") |
| `cd backend/fastapi && pytest -q tests/adapter/input/controller/test_markdown_docs_controller.py tests/adapter/input/controller/test_markdown_storage_controller.py` | exit 0 — 107 passed. Bộ rộng hơn (thêm `test_line_patch`, `test_markdown_docs_*`, `adapter/output/markdown_docs`, `test_markdown_docs_vo`, `test_markdown_share_controller`): **403 passed** |
| `node scripts/build-webapps.mjs --only markdown-editor` rồi `--check` | exit 0 / exit 0 (7 app ok, không gốc API cứng, kiểm toán service worker sạch) |
| `markdown-editor/scripts/kiem-pwa.py` | exit 0 — **Đạt 59 · SAI 0** |
| `markdown-editor/scripts/kiem-chia-se.py` (giữ xanh) | exit 0 — Đạt 34 · SAI 0 |
| **Không chạy**: `pytest` toàn bộ (đợt này chỉ đổi mặc định cấu hình + một hàm của controller; mọi test nhắc `MARKDOWN_LEGACY_PUT` nằm trong hai tệp đã chạy), `check.py` của app khác, `kiem-hieu-nang --nguong` | tiết kiệm theo chỉ dẫn |

`kiem-dong-bo.py` phủ: A→B không nút lưu; trang chào nguyên bản không lên máy chủ; ngoại tuyến → đúng 1 op cho 3 lần sửa → A nhận; khác dòng tự gộp, cùng dòng "⚠ 1 conflict" → bảng Sync → Keep mine; 360 px không tràn ngang với chỉ báo dài nhất; **sửa 1 dòng tài liệu 1,16 MB → thân push 382 B (patch)**; 200 tài liệu / 8,89 MB (cố ý nặng hơn 7,4 MB của thiết kế): máy mới kéo hết trong 1,3–2,6 s, từng tài liệu đúng SHA-256, tải lại không mất, localStorage chỉ còn ảnh 11 KB (so với 8,9 triệu ký tự); client cũ `PUT /markdown/files` → 409 `md_legacy_client`, `GET /files` dựng lại từ kho mới; v2 → IndexedDB (kể cả tài liệu > 512 KB, emoji, dấu `\`, thư mục con) rồi tải lại; không có IndexedDB → dự phòng v2, không ghi ảnh rỗng đè; cả phiên không có `PUT /markdown/files` và không pageerror.

## Số đo (Edge 155, máy dev bận — nhiễu ±35 %)
- Đẩy sửa 1 dòng tài liệu 1,16 MB: **382 B** (hiện nay 7,4 MB cả cây). Kéo 200 tài liệu / 8,89 MB vào IndexedDB: 1,3–2,6 s. Ảnh khởi động localStorage: 11 KB.
- `kiem-hieu-nang.py` doc-2k chỉ-editor, 3 lần: mở khung đầu có editor **384 ms** (mốc M1 276 ms, +39 %), tới yên 1.254 ms (+39 %), long task lớn nhất 387 ms (+23 %); gõ p50 40 ms (−17 %), cuộn p95 18,2 ms (±0). Chưa ghi lại mốc (`--ghi-moc` không chạy); không đo doc-10k/30k.

## Lệch thiết kế (đã chọn cách an toàn)
1. **F9 chưa làm** (Q8: thuộc M8): xung đột trả lời ở `SyncPanel` bằng 3 nút, không `DiffView`, không "Merge manually". "Use the server's" bỏ chữ cục bộ **không giữ bản** (thiết kế có `stash` 30 ngày; "từ giờ tới M8 không có bản cục bộ lịch sử") — bảng nói rõ "yours is discarded"; "Keep both" là đường không mất chữ.
2. Thêm lớp `Workspace` (thiết kế không có): cần để store và engine không đè nhau (CAS ở biên, ghi tuần tự, ghi lại từ trạng thái hiện tại). Thêm `seq` + `reconcileBoot` để chịu việc đóng tab giữa giao dịch IndexedDB.
3. `baseRev` gửi **theo từng phần** (`contentRev` cho chữ/xoá/hồi sinh, `metaRev` cho tên/chỗ) và shadow sau `ok` chỉ nhận phần op đã mang (chỗ máy chủ gộp tên của máy khác vào mà không báo): thiết kế dùng một `S.rev`. Phát hiện nhờ ca test "đổi tên ở A + sửa chữ ở B" (đổi tên bị hoàn lại). "Bản đã biết" cũng xét theo từng phần chứ không chỉ `rev`.
4. Bản ghi xung đột nằm trong `OutboxEntry.conflict` (sống qua tải lại), không trong `meta`.
5. `ReconcileModal` chỉ hiện khi có tài liệu khác nhau, hoặc (sau `reset`) có bản chỉ-ở-máy-chủ trong lúc máy có tài liệu của người dùng; thiết kế: "khác nhau hoặc chỉ-có-trên-máy-chủ" — máy mới tinh tải mọi thứ mà không phải bấm gì. Tuỳ chọn "xoá bản chỉ-ở-máy-chủ" chỉ ở `reset`.
6. Mỗi yêu cầu push ≤ 50 op (thiết kế 200; lời dặn của M4a); hết giờ 30 s (thiết kế 10 s: trang kéo ≤ 3 MB).
7. `loadMarkdownFiles`/`saveMarkdownFiles` và `VITE_MARKDOWN_API_URL` gỡ hẳn (app mới không gọi GET/PUT `/files`). `beforeunload` chỉ hỏi khi quota đầy cho **tài liệu** (trước: cả khi chỉ cài đặt).
8. Tên truy cập chỉ báo đồng bộ `Backend status: …` (không "Sync…": hai script kiem-* tìm nút menu bằng `^Sync`).
9. `MARKDOWN_LEGACY_PUT` fail-closed: không phải đúng chữ `allow` → `reject`.

## Bỏ qua có lý do
- F9, F10, F12 (M8 / Q8). Mốc `hieu-nang-moc.json` không ghi lại (số đo trên máy bận, nhiễu lớn). `audit-webapps.mjs` không chạy (không thêm thư viện, không đổi gốc API).
- Không thử MySQL/Aiven thật (không được phép): kho "mysql" kiểm bằng SQLite qua cùng mã SQL; DDL thật chạy khi chủ dự án triển khai.

## Còn tồn / việc chủ dự án
- **Deploy** (nhắc lại `dot/M4a.md`): đặt `MARKDOWN_ADMIN_KEY` riêng, `MARKDOWN_STORAGE_BACKEND=mysql`; lần bật Backend sync đầu tiên tạo 3 bảng + chép cây cũ (thử DDL trên DB thử trước). Sau khi bản mới ra, bản app cũ còn mở sẽ nhận 409 khi lưu (dữ liệu cục bộ của nó còn nguyên). Muốn cho bản cũ ghi tiếp vào kho cũ: `MARKDOWN_LEGACY_PUT=allow`.
- **Hai TAB cùng máy** dùng chung IndexedDB và `deviceId`, không phối hợp (sửa cùng tài liệu ở cả hai: bản ghi sau thắng ở IndexedDB; đồng bộ lên máy chủ thì xử lý như hai thiết bị). Chưa có `BroadcastChannel`/khoá.
- Chưa thử Safari/iOS, điện thoại thật, HTTPS thật (IndexedDB trên Safari chế độ riêng tư; `crypto.subtle` có bản JS thuần dự phòng). Máy dùng bản xuất bản cũ nhận bản mới theo cơ chế service worker hiện có (không có thông báo "bản mới").
- Người dùng cũ có workspace v2 > 5,24 triệu ký tự (đã hỏng ngầm trước đây) sẽ chỉ có phần đã lưu được: đợt này không cứu được phần đã mất.
- Bản app cũ chạy lại SAU khi đã chuyển sang v3 (ví dụ mở một bản cache cũ) sẽ ghi lại khoá v2 chỉ với trang chào; bản mới ưu tiên IndexedDB nên không mất, nhưng sửa làm ở bản cũ đó không vào kho.

## Ghi chú cho đợt sau
Xem `ke-hoach.md` §7.1, gạch "M5, M6, M7, M8 (từ dot/M4b.md)". Điểm chính: mọi ghi tài liệu qua `Workspace`; `files` có thể bị thay nguyên cây khi có thay đổi từ xa; test đường IndexedDB bằng `setDocStoreOpener`; engine bằng `FakeServer` + `Device`; giữ xanh `kiem-pwa` 59 / `kiem-chia-se` 34 / `kiem-dong-bo` 42.

## Sửa sau kiểm (24/10, agent sửa — người kiểm độc lập: 1 blocking + 10 góp ý nhỏ)

### Blocking — bộ gom lô push đếm sai cỡ nên có thể kẹt đồng bộ vĩnh viễn
- **Gốc**: `buildOps` (1) cộng `text.length` (đơn vị UTF-16) trong khi máy chủ tính **byte UTF-8 + 200 mỗi op** và từ chối CẢ yêu cầu bằng 400 `md_push_too_large` khi > 4.000.000; (2) kiểm trần chỉ TRƯỚC khi thêm mục nên mục cuối có thể vượt trần cả một tài liệu; (3) không ai xử lý 400 đó: `fail()` lùi rồi dựng lại ĐÚNG lô cũ (thứ tự outbox cố định) nên lần nào cũng 400, mọi tài liệu của lô và các lô sau không bao giờ lên.
  Tái hiện trên Edge thật + máy chủ thật (bản xuất bản cũ, `kiem-dong-bo.py --chi-lo-lon`): 8 tài liệu × 450.000 ký tự tiếng Việt = 3,6 triệu ký tự = 5.040.016 byte → "Sync problem — 9 changes waiting", 5 lần liền cùng một yêu cầu 5.041.816 byte bị từ chối, 0 tài liệu lên máy chủ.
- **Sửa** (`src/sync/engine.ts`):
  1. `opWeight(op)` = đúng công thức `MarkdownDocsUseCase._op_weight` + 200 (byte UTF-8 của `content`, hoặc của các dòng `patch` + 4 mỗi dòng + 16 mỗi hunk), dùng `utf8Bytes` (chính xác, không cấp phát) của `lib/share.ts`.
  2. `buildOps` kiểm **sau khi biết op**: `ops.length > 0 && bytes + weight > pushBudget` → để mục đó sang yêu cầu sau (`more`); một op đứng một mình luôn đi (≤ 3,5 MB + 200 < 4 MB). Mục không vừa chưa gây tác dụng phụ nào (drop/block chỉ ghi khi `continue`).
  3. `pushBatch`: gặp 400 `md_push_too_large` thì **chia đôi lô gửi lại** (đệ quy), và **học** `pushBudget = max(64 KB, nửa cỡ lô vừa bị từ chối)` cho các lô sau (máy chủ cấu hình `MARKDOWN_PUSH_MAX_BYTES` thấp hơn 4 MB không làm mỗi vòng tốn hai yêu cầu hỏng). Op bị từ chối ngay cả khi đi một mình → kết quả `rejected md_push_too_large` → **chỉ tài liệu đó bị chặn** (`blocked`, có câu giải thích, "Try again" gỡ được), hàng đợi vẫn chạy. Lỗi khác (mạng, 5xx…) ném như cũ; yêu cầu đã gửi một nửa rồi lỗi thì gửi lại cả hai nửa ở chu kỳ sau — máy chủ coi op lặp là `ok` (đã có test "câu trả lời bị mất").
- **Rà cùng mẫu lỗi**: không còn chỗ nào so `.length` với giới hạn byte trong `src/sync` (`MAX_DOC_BYTES` dùng `utf8Length`: chính xác với văn bản lớn, cận trên với văn bản ≤ 1024 ký tự); ngưỡng ảnh khởi động 512 KB đếm ký tự cho `localStorage` (hạn mức tính theo ký tự) nên không cùng mẫu; `ShareDialog` đã dùng `utf8Bytes`.
- **Phép kiểm** — `FakeServer` có luật cỡ thật (`maxPushBytes` = 4 MB, `requestWeight`/`opWeight` y công thức máy chủ, `refusedPushes`, móc `duringPush`); 5 ca mới `the size of one push request`: 4 tài liệu ASCII 1,1 MB; 8 × 450.000 ký tự tiếng Việt (> 5 MB byte); 3 × 1,4 MB (mục cuối không được đẩy lô vượt trần: lô ≤ 3,5 MB); máy chủ trần 1 MB (chia đôi + nhớ bài học: 6 tài liệu nữa không còn bị từ chối); trần 100 KB (chỉ tài liệu 200 KB bị chặn `md_push_too_large`, hai tài liệu nhỏ lên, "Try again" gỡ sau khi nới trần). Trình duyệt thật: `kiem-dong-bo.py` bước 4b (+4 phép) — kho 8 × 450.000 ký tự đồng bộ lần đầu qua đường `v2 → IndexedDB → reconcile → pushAll`: mọi tài liệu lên đúng SHA-256, "Synced", ≥ 2 yêu cầu, mỗi yêu cầu ≤ 4.000.000 theo cách đếm của máy chủ (`--chi-lo-lon` chỉ chạy bước này).
- **Đỏ trên bản cũ**: ghi đè `engine.ts`/`workspace.ts`/`docStore.ts` bằng bản `HEAD` rồi chạy `vitest src/sync` → **12 test đỏ** (5 ca cỡ push; reset-toast; replace-refused; cờ blocked đè bản mới; cache băm; mục outbox ở workspace; 2 ca IndexedDB), trong đó các ca cỡ push đỏ đúng vì `refusedPushes = [{ops:5, weight:4401000}]`, `[{ops:9, weight:5212312}]`, `[{ops:4, weight:4200800}]`; bước 4b chạy trên bản xuất bản cũ: **3 SAI** (không lên máy chủ, "Sync problem — 9 changes waiting", 5 yêu cầu × 5.041.816 byte). Đã khôi phục bản sửa (`cmp` với bản lưu trước khi ghi đè).

### Góp ý nhỏ — đã sửa (kèm test)
1. **Hộp xác nhận "Replace this device's copy…" nói sai khi có tài liệu bị máy chủ từ chối** — `replaceFromServer` nay đưa `{documents, unsent, refused: string[]}` (`ReplaceInfo`); `refused` = tên các tài liệu `blocked` còn trong máy (bản duy nhất). `Header` nêu "N documents the server refused (“a”, “b”, “c” and 2 more) exist only on this device and will be lost for good." Test engine (huge.md bị chặn → `refused:['huge.md']`; huỷ thì không đổi gì; đồng ý thì mất), `m1.test.tsx` (nêu tên + "and 2 more", không còn câu "Nothing waiting…"), `storeSync.test.ts` cập nhật.
2. **Khoảng trống test (a)** "sửa trong lúc push đang bay thì lần sau vẫn gửi" — ca engine `an edit made while a push is in flight…` (FakeServer `duringPush`). **Đột biến** bỏ `versions.set` ở nhánh `ok` → đỏ (1/59).
3. **Khoảng trống test (b)** `contentRev` của shadow sau push — ca `a rename pushed on top of a text edit made elsewhere…` (máy đổi tên vẫn nhận chữ của máy kia, rồi sửa tiếp không lệch). **Đột biến** `contentRev: result.contentRev` luôn → đỏ (1/59). Đột biến thêm: `opWeight` đếm `.length` thay byte → ca "UTF-8 bytes" đỏ.
4. **Race `pushAll`**: `ws.apply` nay áp `ifVersion` cho cả mục **put** của outbox (cờ `blocked`/`forceFull` của phiên bản cũ không còn đè mục mới hơn; mục đã bị xoá không bị hồi sinh); `pushAll` gán `versions` cho mọi mục bị phán xử (ok / forceFull / blocked) và cho mục `block` của `buildOps` (sau `await` băm). Test: `workspace.test.ts` (mục `a` sửa sau push giữ nguyên, `b` nhận cờ) và engine `a node edited while its push was being refused…` (đồng hồ sai → `md_bad_clock`, người dùng sửa lại trong lúc bay → bản mới lên, không bị đánh "refused").
5. **ReconcileModal** nói "Nothing is deleted without your say-so" nhưng `reset` xoá tài liệu đã đồng bộ mà máy chủ không còn: sửa câu chữ ("Choose what to keep; a document that was deleted on the server is removed here too, and you are told which.") **và** thêm toast nêu số + tên (tối đa 3) tài liệu bị gỡ khỏi máy. Test: ca `after a reset…` kiểm đúng một thông báo, có `gone.md`, không có `keep.md`.
6. **`engine.cache` giữ 25 chuỗi nguyên văn** → giữ tối đa **4** (bỏ mục cũ nhất, không xoá cả bộ nhớ): ≤ ~14 MB thay vì ~90 MB. Khoá vẫn là chính chuỗi (không khoá theo tiền tố/độ dài: hai văn bản khác nhau trùng khoá sẽ cho băm sai, hỏng dữ liệu). Test `memory`.
7. **`openIdbDocStore`**: `onblocked`/hết giờ đã từ chối rồi mà `onsuccess` tới muộn → nay **đóng** kết nối (cờ `settled`). **`IdbDocStore.commit`**: một `put` ném (DataCloneError…) nay `abort()` giao dịch (không để nửa commit tự đáp xuống) và gắn `done.catch` (không còn unhandled rejection). Hai test bằng `indexedDB` giả tối thiểu (IndexedDB thật vẫn do `kiem-dong-bo`/`kiem-pwa` kiểm trên Edge).
8. **Dọn**: `.env.example` bỏ `VITE_MARKDOWN_API_URL` (thay bằng ghi chú API đọc lúc chạy). Các test cũ còn mock `loadMarkdownFiles/saveMarkdownFiles` đã gỡ: vô hại, để nguyên.
9. **Flake `shareDialog.test.tsx`** ("refreshing the list…"): thêm hạn 20 s riêng cho ca đó (riêng 1,2 s; vượt 5 s mặc định khi cả bộ chạy lúc máy bận). Không phải hồi quy của M4b.

### Không làm / để lại (có lý do)
- **Ảnh khởi động v3 chỉ chứa chữ tài liệu mở nếu ≤ 512 KB**: sửa tài liệu > 512 KB rồi đóng tab đúng lúc giao dịch IndexedDB chưa xong có thể mất vài ký tự cuối. Sửa gốc cần ghi đồng bộ chữ lớn vào `localStorage` (vượt hạn mức, đúng cái đợt này gỡ) hoặc `BroadcastChannel`/khoá hai tab — không rẻ, thuộc M5+. **Hai TAB cùng máy** dùng chung IndexedDB + `deviceId` vẫn không phối hợp (đã nêu ở "Còn tồn").
- **Bản app cũ** (`webapp/tranphuc8a/markdown-editor`, "lỗi thời") còn gọi `/markdown/files`: sau lần đồng bộ đầu của bản mới nhận 409 mỗi lần lưu (`MARKDOWN_LEGACY_PUT=reject`, quyết định có chủ ý ở M4b; dữ liệu cục bộ của nó còn nguyên; `allow` để mở lại).
- **Hiệu năng mở**: không đo lại (tiết kiệm; khung đầu 384 ms so mốc M1 276 ms vẫn trong nhiễu ±35 %, chưa `--ghi-moc`). **M5 nên đo lại mốc** trước khi kết luận có hồi quy do mở IndexedDB hay không.
- `kiem-chia-se.py` (34) và `check.py` của app khác không chạy lại (đợt sửa không đụng ShareDialog/giao diện chia sẻ; `npm test` phủ ca của `shareDialog`). `audit-webapps.mjs` không chạy (không thêm thư viện).

### Lệnh kiểm sau sửa (kết quả thật, 24/10)
| Lệnh | Kết quả |
|---|---|
| `cd markdown-editor && npm test && npm run type-check && npm run lint` | exit 0 — **52 tệp / 1.075 test** (266 s; bản đầu 1.061, thêm 14), tsc sạch, eslint 0 cảnh báo (chạy sau mọi sửa, một lần cuối) |
| `kiem-dong-bo.py` | exit 0 — **Đạt 46 · SAI 0** (42 + 4 phép bước 4b) |
| `pytest -q …test_markdown_docs_controller.py …test_markdown_storage_controller.py` (đặt `DB_URL` SQLite tạm, `MONGO_URI=`, `RATE_LIMIT_BACKEND=memory`, mọi `*_STORAGE_BACKEND=json`) | 107 passed |
| `node scripts/build-webapps.mjs --only markdown-editor` rồi `--check` | exit 0 / exit 0 (7 app ok); build id `6072167a6a8f` |
| `kiem-pwa.py` | exit 0 — **Đạt 59 · SAI 0** |

**An toàn DB thật**: mọi tiến trình backend đều có biến chặn (kiem-* đi qua `_kiem_chung.MayChuThat` vốn ép `DB_URL` SQLite tạm, `MONGO_URI=""`, `RATE_LIMIT_BACKEND=memory`, mọi `*_STORAGE_BACKEND=json`; pytest đặt đủ biến ngay trong lệnh). Không đọc/in `.env`, không gọi Gemini, không chạm DB thật.

### Lệch thiết kế mới
- Bộ gom lô dùng **cân nặng theo cách máy chủ đếm** (không phải "≤ 50 op / ≤ 3,5 MB chữ"): trần 3,5 MB tính byte UTF-8 + 200/op, tự co lại khi máy chủ từ chối (thiết kế md-sync §3.7.3 chỉ nêu "200 op / 4 MB" chung chung).
- `Workspace.apply(change, ifVersion)`: `ifVersion` nay cũng chặn **put** (trước chỉ chặn delete). `commitRemote` giữ nguyên.
