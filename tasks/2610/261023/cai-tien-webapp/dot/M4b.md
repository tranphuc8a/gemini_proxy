# M4b — Đồng bộ delta + lịch sử, frontend (IndexedDB) (24/10/2026, làn A, đợt 2)

**Trạng thái: xong F1–F8, F11 (phần P1).** Chưa commit. Build xuất bản `3ec8112a081a` (`webapp/tranphuc8a/markdown-editor-pro/`, `build-webapps.mjs --check` exit 0, 7 app ok).
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
