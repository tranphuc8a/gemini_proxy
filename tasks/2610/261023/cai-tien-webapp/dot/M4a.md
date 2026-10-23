# M4a — Đồng bộ delta + lịch sử phiên bản, backend (24/10/2026, làn A, đợt 2)

**Trạng thái: xong phần backend (B1–B8, B10, B11); đã sửa sau kiểm độc lập vòng 1 (xem mục "Sửa sau kiểm" ở cuối: 2 lỗi blocking — `make_delta` bậc hai làm đứng vòng lặp, phản hồi push không trần byte — và 8 góp ý nhỏ).** Chưa commit. Không đụng frontend, không build lại app. Không chạm database thật (xem "Bảo vệ DB").
Cây có sẵn một bản cài DỞ của đợt này (agent trước bị ngắt) — đã đọc từng tệp, chạy test, **giữ phần đúng** (gần như toàn bộ), sửa 4 chỗ sai/thiếu, viết nốt phần còn thiếu.
Tài liệu API: `docs/markdown-sync-api.md` (mới). Thiết kế: `thiet-ke/md-sync.md`.

## Kế thừa hay viết lại
| Phần | Quyết định | Lý do / bằng chứng |
|---|---|---|
| VO `markdown_docs_vo.py`, cổng vào/ra, `line_patch.py`, `history_retention.py`, `hashing.py` | **Giữ nguyên** | Khớp B1/B2; 160 test cũ xanh ngay đầu đợt; `test_markdown_docs_push.py` (587 dòng) thật sự kiểm từng quyết định của bảng §3.4 (xung đột, gộp meta/nội dung, sửa thắng xoá, phát lại, CAS thua, hash/patch sai) |
| 3 kho `adapter/output/markdown_docs/{json,mysql,mongo}_repository.py`, `legacy_reader.py` | **Giữ nguyên** | `test_markdown_docs_repositories.py` là bộ hợp đồng tham số hoá 3 kho (50 ca); đọc lại SQL: tham số hoá, `utf8mb4_bin` chỉ khi dialect mysql, chỉ mục tạo trong try/except. Chỉ sửa lại một câu chú thích về `CREATE INDEX IF NOT EXISTS` (MySQL không có; nhánh dự phòng chạy) — không đổi mã |
| `use case markdown_docs_usecase.py` | **Giữ + sửa 3 chỗ** | xem "Sửa trong phần kế thừa" |
| Controller, factory, `config.py`, `main.py`, `.env.example` | **Giữ + sửa 2 chỗ** (controller) | khối `MARKDOWN_*`, `MARKDOWN_LEGACY_PUT=allow` đã đúng chỉ đạo |
| `markdown_storage_controller.py` (GET dựng từ kho mới khi `reject`, PUT 409) | **Giữ nguyên** | thêm test (chưa có) |
| Test cũ: `test_line_patch`, `test_markdown_docs_push`, `test_markdown_docs_vo`, `test_markdown_docs_repositories`, `tests/support/markdown_docs.py`, fixture `markdown_patches.json` | Giữ, mở rộng `push` thêm 1 ca | |
| **Thiếu hẳn** | Viết mới | test `changes`, `history`, `retention`, `migration`, `controller`, ca legacy ở storage controller; docs; thử chuyển đổi trên bản sao SQLite; kiểm chéo patch JS↔Python |

## Sửa trong phần kế thừa (mỗi mục có test bắt được lỗi — đã thử "đột biến" gỡ sửa thì test đỏ)
1. **Phân trang mất đuôi dãy stamp trùng** (`utils/sync_paging.cut_page` + `changes`): khi cả trang chỉ là một dãy `serverUpdatedAt` trùng (limit=1, hoặc nhiều ghi cùng mili-giây) thì phần đuôi dãy rơi mất vì lần gọi sau hỏi `> cursor`. Nay giao nguyên cả dãy; use case lấy tiếp (`fetch×4`, trần 5000) nếu dãy có thể dài hơn lần lấy. (Mẫu `/wiki` còn lỗi này, không sửa vì ngoài phạm vi.) Test: `test_one_record_at_a_time_loses_nothing…`, `test_a_run_longer_than_one_fetch…`, `test_a_page_never_ends_between…`, `test_cut_page_is_pure…`.
2. **Dấu `serverUpdatedAt` lấy lúc bắt đầu push** (`now + index`): với DB xa một push vài chục op chạy vài giây, nên dấu của op cuối già hơn độ trễ 2 s của con trỏ → thiết bị khác có thể **không bao giờ nhận** bản ghi. Nay mỗi op lấy `max(đồng hồ lúc sắp ghi, dấu trước + 1)`. Test: `test_each_op_is_stamped_when_it_is_written_not_when_the_push_began`.
3. **Đường ghi tài liệu mới** bỏ một lượt đọc lịch sử (`known_rows=[]`): bớt 1 round trip mỗi nút mới (lần đẩy đầu 200 nút).
4. **Controller**: lỗi kho thành một câu 503 chung `md_store_unavailable` (+`Retry-After: 5`, chỉ ghi tên lớp lỗi): `main.generic_exception_handler` trả `str(exc)` — thông điệp SQLAlchemy mang tên máy chủ DB, câu lệnh và `[parameters: …]` (với push là cả nội dung tài liệu); khi `MARKDOWN_PUBLIC_READ=true` người lạ đọc được. Test: `test_a_store_failure_is_one_generic_503_that_leaks_nothing`.
5. `since` ≤ 2^53 ở route (số rất lớn từng đi thẳng vào BIGINT → 500). Test `test_an_enormous_cursor_is_refused…`.
6. Chú thích lệch thời ở `config.py`, `.env.example`, `markdown_admin.py` ("later /markdown/sync/…") sửa cho đúng hiện tại.

## Việc đã làm theo thiết kế (tóm tắt trạng thái từng việc)
| Việc | Trạng thái |
|---|---|
| B1 line_patch + băm | xong (kế thừa) — 46 test; **kiểm chéo mới**: 400 patch ngẫu nhiên do `nhap/md-sync/proto-diff.mjs` (JS) sinh áp đúng ở Python, và 400 patch `make_delta` (Python) áp đúng ở JS (emoji, `\r`, dòng rỗng, ghi đè toàn bộ) |
| B2 VO + cổng | xong (kế thừa) |
| B3–B5 3 kho + hợp đồng | xong (kế thừa), DDL mysql chỉ chạy trên SQLite trong test |
| B6 push | xong (kế thừa + 1 ca) |
| B7 changes | xong: dấu phân trang, con trỏ trễ 2 s, `since=0` bỏ tombstone, `device` bỏ nội dung (chỉ ở lần kéo tăng dần `since>0`; `since=0` luôn kèm chữ — sửa sau kiểm), `horizon`/`reset`, trang vượt ngân sách byte vẫn ≥ 1 bản — `test_markdown_docs_changes.py` (24) |
| B8 lịch sử | xong: một hàng mỗi lần đổi chữ, gộp cùng máy < 10 phút, 4 luật keyframe, nén > 32 KB, dựng lại **mọi** bản = nhật ký (70 bước ngẫu nhiên), ≤ 2 lượt đọc, hàng xoá, hỏng thì 500 `md_history_broken` — `test_markdown_docs_history.py` (22) |
| Chính sách giữ (phần của B9 phải có từ ngày đầu) | xong: 50 + 1/ngày × 90 ngày (múi `+07:00`) + bản có tên + keyframe cần, trần 300; 200 lần sửa trải 120 ngày → còn ~120 hàng, mọi hàng dựng lại đúng — `test_markdown_docs_retention.py` (10) |
| B10 chuyển đổi lười | xong: 3 kho cũ (json / bảng SQLite thay MySQL / fake_mongo), không nhân đôi, id lạ → `legacy-<24 hex>` + bảng đổi id **cập nhật cả `markdown_shares.doc_id`**, nút quá hạn mức bị bỏ + ghi `skipped`, claim `markdown_meta` (503 `md_migrating`, chiếm lại claim chết/thất bại), đọc kho cũ hỏng ≠ kho rỗng, **kho cũ không đổi một byte** — `test_markdown_docs_migration.py` (35) + 7 ca legacy ở `test_markdown_storage_controller.py` |
| B11 factory + controller + cấu hình + docs | xong: 5 route, `require_markdown_admin`/`require_markdown_reader` (B0), no-store, 422/400/403/404/503, 3 kho qua HTTP — `test_markdown_docs_controller.py` (41); `docs/markdown-sync-api.md` |

## Tệp đổi
- Mới (đợt này): `tests/application/test_markdown_docs_{changes,history,retention,migration}.py`, `tests/adapter/input/controller/test_markdown_docs_controller.py`, `docs/markdown-sync-api.md`, `dot/M4a.md`.
- Sửa (đợt này): `src/application/usecases/markdown_docs_usecase.py` (dấu theo op, `fetch` tìm tiếp, `store_unavailable`, `known_rows`, import), `src/application/utils/sync_paging.py`, `src/adapter/input/controllers/markdown_docs_controller.py` (`_answer`, `since` ≤ 2^53), `tests/application/test_markdown_docs_push.py` (+1 ca), `tests/adapter/input/controller/test_markdown_storage_controller.py` (+7 ca), chú thích ở `config.py` / `.env.example` / `markdown_admin.py`, `backend/fastapi/README.md` (+5 dòng bảng `/markdown`), `.claude/skills/ban-do-ung-dung/SKILL.md` (dòng `/markdown/*`), `ke-hoach.md` §7.1 (+1 gạch).
- Kế thừa nguyên (xem bảng trên): toàn bộ phần còn lại trong `src/**/markdown_docs*`, `utils/{line_patch,history_retention}.py`, `domain/vo/markdown_docs_vo.py`, `tests/support/markdown_docs.py`, `tests/fixtures/markdown_patches.json`.

## Lệnh kiểm (kết quả thật, 24/10)
Tất cả chạy qua tệp bọc đặt `DB_URL=sqlite+aiosqlite:///<tạm> MONGO_URI="" RATE_LIMIT_BACKEND=memory MARKDOWN/WIKI/CODESTORE/… _STORAGE_BACKEND=json`.
| Lệnh | Kết quả |
|---|---|
| `cd backend/fastapi && pytest -q tests/application/test_line_patch.py tests/application/test_markdown_docs_*.py tests/adapter/output/markdown_docs tests/adapter/input/controller/test_markdown_docs_controller.py tests/adapter/input/controller/test_markdown_storage_controller.py` | exit 0 — **332 passed** (≈ 45 s). Thêm `tests/domain/test_markdown_docs_vo.py` (22) → 354. **Sau "Sửa sau kiểm": 380 passed** (50 s, gồm cả `test_markdown_docs_vo.py`) |
| `cd backend/fastapi && pytest -q` (toàn bộ, sau mọi sửa mã trừ một câu chú thích ở `mysql_repository.py`) | exit 0 — **2400 passed**, 4 skipped (331 s); mốc M3: 2025 passed. **Sau "Sửa sau kiểm": exit 0 — 2426 passed**, 4 skipped (289 s), chạy đúng một lần cuối |
| `GET /api/v1/openapi.json` (TestClient) | 200, 5 route mới có trong schema |
| Thử chuyển đổi trên **bản sao SQLite có dữ liệu kiểu cũ** (`scratchpad/m4a/thu-chuyen-doi.py`, lặp cho kho "mysql"=SQLite và kho json) | đạt cả hai, số đo ở dưới |

Ghi chú về lệnh toàn bộ: lần chạy đầu của tôi đặt thêm `AI_ENABLED=false` (rào bảo vệ) nên 6 test của `test_send_message_endpoint.py` trả 503 (chúng cần AI bật; 2394 passed + 6 failed). Chạy lại với `AI_ENABLED=true` (các biến DB/Mongo/rate-limit/kho vẫn ghim) → toàn bộ xanh như bảng. Không liên quan đợt này; test không gọi Gemini thật (FakeModel).

## Số đo (bản sao SQLite, cây kiểu cũ: 202 tệp / 7,77 MB, gồm 4 tệp 1 MB, 6 tệp 200 KB, 40 tệp 20–60 KB, 150 tệp 2–10 KB, 2 id lạ)
| Đại lượng | Giá trị |
|---|---|
| `PUT /files` (cũ) cả cây | 200 trong 0,61 s |
| Lần gọi `/sync/changes` đầu (chuyển đổi + trang 1) | 1,70 s (SQLite cục bộ; DB xa sẽ chậm hơn: `insert_many` + `add_revisions` mỗi cái một phiên) |
| Kéo hết 213 bản ghi | 3 trang (77/53/83 bản ghi; 2,69 / 3,04 / 2,10 MB), 0,43 s — mỗi trang < 3,5 MB (trần Vercel 4,5 MB) |
| id đổi | 2 (`legacy-<24 hex>`), mọi chữ + hash khớp kho cũ |
| Kho cũ sau chuyển đổi | **giống hệt từng byte** (băm bảng / tệp trước = sau) |
| `PUT /files` + `GET /files` sau chuyển đổi, `allow` | 200, đọc lại đúng bản mới ghi |
| Đẩy sửa 1 dòng của tài liệu 1,00 MB (bản vá) | thân **334 B** (so 7,77 MB cả cây hiện nay), 238 ms (SQLite) / 325 ms (json); lịch sử `[(1, full, migrate), (2, delta, edit)]`, dựng lại rev 1 = bản gốc |
| `reject` | `PUT /files` → 409 `md_legacy_client`; `GET /files` dựng lại 213 nút từ kho mới (có bản sửa mới nhất) |
| Chưa có số: Aiven thật (không được phép), `difflib` trên Vercel | — |

## Lệch thiết kế (đã chọn cách an toàn)
1. **B9 chưa làm: `POST /docs/{id}/restore`, `GET /markdown/trash`, `PATCH …/revisions/{rev}` (đặt tên)** — hoãn M8 theo Q8, cùng giao diện F9/F10 của chúng. Phần của B9 phải có từ ngày đầu thì CÓ: chính sách giữ (`select_keep` trong đường ghi), dọn tombstone + `horizon`/`reset`. Bản có tên đã được chính sách giữ mãi nhưng chưa có API đặt tên (test gán nhãn thẳng vào kho). M8: thêm `restore` bằng cách dựng một `PushOp` tổng hợp và truyền `origin="restore"`/`restoredFrom` vào `_remember` → `_write_text_revision` (đã nhận tham số `origin`, `restored_from`).
2. `MARKDOWN_LEGACY_PUT` mặc định **`allow`** (thiết kế nói `reject`) theo chỉ đạo "cho tới M4b". Hệ quả của `allow`: `GET/PUT /files` chỉ chạm KHO CŨ; sau lần chép đầu, thứ bản cũ ghi vào kho cũ KHÔNG vào kho mới (và ngược lại). Chấp nhận được vì chưa có client mới; chủ dự án đặt `reject` sau khi M4b triển khai xong trên mọi máy.
3. `GET /markdown/docs/{id}` **không tự chuyển đổi** (không ghi từ một đường đọc, nhất là khi `MARKDOWN_PUBLIC_READ=true`): trước lần gọi `changes`/`push` đầu nó trả 404 cho tài liệu chỉ có ở kho cũ.
4. Mã lỗi thêm so với thiết kế: `md_duplicate_op`, `md_push_too_large` (400 cả yêu cầu), `md_busy` (503, 3 lần CAS thua), `md_migrating` (503), `md_store_unavailable` (503), và mã từ chối từng op `md_bad_parent`, `md_bad_content` (surrogate lẻ), `md_content_required` (hồi sinh tệp không kèm chữ).
5. `origin` của hàng lịch sử do push luôn là `edit` (`merge` chưa có đường nào đặt: op không có trường `origin`). Nếu M8 muốn đánh dấu "đã gộp", thêm trường tuỳ chọn vào `PushOp`.
6. Trần byte của push tính trên **chữ UTF-8** của các op (+200 B mỗi op), không phải độ dài thân JSON đã thoát: thân có thể to hơn ~10 % trong ca nhiều `\n`/`"` — vì vậy 4 MB < 4,5 MB; client tự tách op khi gần 4 MB.
7. Dấu `serverUpdatedAt` của push có thể nằm sau đồng hồ tới 199 ms (op thứ n của một push chưa chậm, dấu tăng ngặt) — vô hại với con trỏ cuối trễ 2 s (bản ghi chỉ được giao lại). Dấu của **chuyển đổi** (trước đây `now + chỉ số nút`, tới 20 s tương lai — kiểm độc lập chỉ ra có thể làm mất tài liệu mới khi kéo nhiều trang) nay là `now − n … now − 1`: mỗi nút một dấu riêng, toàn bộ ở quá khứ (xem "Sửa sau kiểm"). Còn lại: con trỏ **trung gian** (`more=true`) là dấu của bản ghi cuối trang, không trễ 2 s như con trỏ cuối (cùng hạn chế mẫu `/wiki`) — cửa sổ chỉ ≤ 199 ms của một push nhanh ≥ 200 op, xác suất rất thấp; không sửa.

## Bỏ qua có lý do
- B9 (restore/trash/label), F-series (frontend) — xem trên / ngoài phạm vi đợt này.
- Thử DDL MySQL trên DB thật — không được phép; DDL chỉ chạy trên SQLite (bộ test hợp đồng + thử chuyển đổi).
- `fake-indexeddb` / IndexedDB — thuộc M4b.

## Còn tồn / việc chủ dự án
- **Trước khi deploy:** đặt `MARKDOWN_ADMIN_KEY` riêng (đã nói ở M3), `MARKDOWN_STORAGE_BACKEND=mysql`. Không có gì ghi vào DB cho tới khi một request chạm `/markdown/sync/*`; chưa client nào gọi (M4b). Khi M4b ra: lần gọi đầu tạo 3 bảng (`markdown_docs`, `markdown_doc_revisions`, `markdown_meta`) và chép cây cũ (vài giây cho ~200 tài liệu); bảng cũ `markdown_files` không bị đụng nên quay lui được. Thử DDL trên DB thử trước.
- **Chi phí MySQL xa:** mỗi op ghi tốn vài lượt khứ hồi (đọc, CAS, lịch sử). Chưa đo trên Aiven. M4b nên đẩy ≤ ~50 op/yêu cầu thay vì 200 để một yêu cầu không vượt giới hạn thời gian của hàm serverless.
- Kho JSON trên Vercel nằm ở `/tmp` từng instance (lịch sử, cờ chuyển đổi và liên kết mất ngẫu nhiên) — đã có trong docs; cần `mysql`/`mongo`.
- `client_address` tin `X-Real-IP` (quyết định cũ ở `dot/M3V.md`), bộ đếm sai khoá dùng chung.
- Chưa có: `restore`/`trash`/đặt tên bản (M8), đồng hồ lệch chỉ kiểm "quá 1 ngày về tương lai".

## Ghi chú cho đợt sau (M4b, M8)
Xem `ke-hoach.md` §7.1, gạch "M4b, M8 (từ dot/M4a.md)". Điểm chính: hợp đồng op/kết quả trong `docs/markdown-sync-api.md`; `src/sync/lineDiff.ts` phải áp đúng `tests/fixtures/markdown_patches.json` và sinh patch theo cùng định dạng (đã kiểm chéo với `proto-diff.mjs`); client xử lý `md_migrating` (Retry-After 2), `reset:true`, `conflict.record` không có `content` khi chỉ đụng `meta`, `rejected md_patch_mismatch` → gửi nguyên văn, và `device` để bản của chính mình về không kèm chữ (hash vẫn có) **chỉ khi `since>0`** (ở `since=0` máy chủ luôn kèm chữ: IndexedDB bị xoá mà `deviceId` còn thì vẫn khôi phục được). **Mới (sửa sau kiểm):** một `conflict` có thể về với `contentOmitted: true` và `record.content = null` (tổng chữ của các conflict trong một phản hồi push ≤ 3 MB) → client phải `GET /markdown/docs/{id}` lấy chữ rồi mới gộp; tên thiết bị `legacy` bị cấm (422).

## Sửa sau kiểm (24/10, vòng sửa 1 — sau kiểm độc lập)
Người kiểm độc lập tìm 2 lỗi blocking và 13 góp ý nhỏ (4 trong số đó là quy tắc bảo vệ DB / kết quả đột biến / kiểm chéo patch / xác nhận điểm tốt, không phải việc). Cả hai lỗi blocking đã sửa tận gốc kèm test; trong 9 góp ý nhỏ còn lại: 7 đã sửa hẳn (`since=0`, dấu chuyển đổi, nén thừa, dọn tombstone, `rev`, dấu vết lỗi, hash của replay) + 1 sửa phần docs/tên dành riêng; 2 để lại có lý do (+ phần tổng quát của con trỏ trung gian). **Đột biến** (gỡ từng sửa trên BẢN SAO `scratchpad/m4a-fix/mut`, không có `.env`, đặt đủ biến chặn DB): **21 đột biến, 21 đỏ, 0 sống sót** (`scratchpad/m4a-fix/mutate.py`). Mọi pytest/script chạy với `DB_URL` SQLite tạm, `MONGO_URI=""`, `RATE_LIMIT_BACKEND=memory`, mọi `*_STORAGE_BACKEND=json`; không chạm DB thật, không đọc `.env`.

### Blocking 1 — `make_delta` bậc hai làm đứng vòng lặp sự kiện (`utils/line_patch.py`, `usecases/markdown_docs_usecase.py`)
- **Gốc lỗi:** `SequenceMatcher(autojunk=False)` trên dòng lặp (dòng trống, `---`, hàng bảng) là bậc hai, và nó chạy đồng bộ trong đường push. Số đo trước khi sửa (của người kiểm): 12.000 dòng 3,59 s, 25.000 dòng 16,7 s, push 2 ở 12.000 dòng treo 5,59 s (vòng lặp đứng 5,63 s).
- **Sửa (ba lớp, vì chỉ `autojunk` thì chưa đủ):**
  1. `autojunk=True` — không neo vào dòng chiếm > 1 % văn bản; patch có thể to hơn chút (vô hại: luôn áp được, hash kiểm lại, và lịch sử giữ nguyên văn nếu delta không nhỏ hơn nửa văn bản).
  2. **Ngân sách cặp dòng** `MAX_DIFF_PAIRS = 400_000`: `_anchor_pairs` đếm O(n) (phản chiếu đúng luật "popular" của `difflib`, có test so với `SequenceMatcher.b2j`) số cặp (dòng cũ, dòng mới bằng nhau) mà `difflib` sẽ duyệt; vượt thì `make_delta` trả `None` và lịch sử lưu nguyên văn. Cần vì `autojunk=True` KHÔNG cứu dạng "150 dòng riêng, mỗi dòng lặp 130 lần, trộn ở giữa" (mỗi dòng < 1 % nên không bị coi là rác; 20.000 dòng ≈ 1,9 s bậc hai).
  3. **Việc CPU nặng chạy ngoài vòng lặp** (`_cpu` → `asyncio.to_thread` khi văn bản > `INLINE_CPU_BYTES` = 32 KB; nhỏ hơn thì chạy thẳng như cũ): diff + nén lịch sử (`encode_revision_body`), dựng lại phiên bản (`decode_revision`), áp patch lên bản lưu to (`_plan` của op có patch), lập kế hoạch chuyển đổi (`plan_migration`: băm + nén cả cây cũ). **Đã rà cùng mẫu lỗi** — đây là bốn chỗ ngoài `make_delta` cũng chạy CPU tỉ lệ với cỡ tài liệu trên vòng lặp.
- **Số đo sau khi sửa** (máy yên; `scratchpad/m4a-fix/probe_push.py`, `probe_after.py`): `make_delta` hai chỗ sửa đầu/cuối, 25 % dòng trống: 12.000 dòng (376 KB) **26 ms**, 25.000 dòng (785 KB) **54 ms**, 50.000 dòng (1,5 MB) **141 ms**, vẫn đúng 2 hunk / 57 B. Push thật ở 12.000 dòng: **59 ms**, vòng lặp đứng tối đa **50 ms** (trước: 5.590 / 5.630 ms); 25.000 dòng: 106 ms / 55 ms; lịch sử `[(1, full), (2, delta)]`. Dạng xấu nhất còn lại (vocab-150 trộn, 20.000–50.000 dòng): bị từ chối trong ~50 ms, lưu nguyên văn. Hai tài liệu không liên quan 50.000 dòng: ≈ 0,5–1,5 s CPU trong luồng phụ (hiếm: thay cả tài liệu; luồng phụ vẫn giữ vòng lặp phản hồi).
- **Cái giá cần biết:** tài liệu nhiều dòng lặp *và* đổi nhiều ở giữa sẽ lưu nguyên văn (nén zlib) thay vì delta — tốn chỗ hơn, không sai. Trần 50 hàng lịch sử × ~300 KB nén cho tài liệu 1 MB vẫn trong tầm.
- **Test:** `test_line_patch.py` (+5: hai chỗ sửa xa ở 20.000 dòng < 1 s và đúng 2 hunk; 25 ca ngẫu nhiên nhiều sửa trên văn bản nhiều dòng lặp luôn áp đúng; từ chối vocab-150 < 0,5 s; ngân sách là thứ duy nhất từ chối; `_anchor_pairs` = `b2j`), `test_markdown_docs_history.py` (+5: push 20.000 dòng < 1 s và vòng lặp đứng < 0,3 s; mã hoá lịch sử và dựng lại chạy ngoài vòng lặp — chèn `time.sleep(0,5)` mà vòng lặp vẫn tick; dạng bị từ chối lưu nguyên văn và dựng lại đúng; chỉ dạng được giữ mới bị nén), `test_markdown_docs_push.py` (+1: áp patch lên bản to ngoài vòng lặp), `test_markdown_docs_migration.py` (+1: lập kế hoạch chuyển đổi ngoài vòng lặp). Helper `LoopWatch`, `repetitive_lines`, `shuffled_vocabulary` ở `tests/support/markdown_docs.py`.

### Blocking 2 — phản hồi push không có trần byte (`usecases/markdown_docs_usecase.py::_conflict`)
- **Gốc lỗi:** mỗi conflict kèm nguyên `record.content` của máy chủ (≤ 3,5 MB); yêu cầu chỉ là patch vài trăm byte nhưng phản hồi gấp hàng nghìn lần (người kiểm: 10 tài liệu 0,59 MB → 6,01 MB > 4,5 MB của Vercel; thiết bị không bao giờ nhận được conflict nên vòng đồng bộ kẹt).
- **Sửa:** tổng chữ của các conflict trong MỘT phản hồi chia chung ngân sách `PAGE_BYTES` (3.000.000; tính `size + 400` mỗi bản ghi, theo thứ tự op, biên bao gồm). Bản không vừa về với `record.content = null` + **`contentOmitted: true`** (cờ chỉ có khi có gì bị bỏ) → client `GET /markdown/docs/{id}` (có sẵn `rev`/`hash` trong record để biết bản nào) rồi gộp. Conflict chỉ đụng `meta` vẫn không có chữ và không có cờ; `ok`/`rejected` không tốn ngân sách. Ghi ở `docs/markdown-sync-api.md` (mục Result) và `ke-hoach.md` §7.1 để M4b biết.
- **Test** (`test_markdown_docs_push.py`, +4): ngân sách 2.000 B/4 tài liệu → 2 có chữ + 2 `contentOmitted`, chữ lấy lại đúng bằng `get_document`; biên (`weight−1` → không vừa, `weight` → vừa 1, `2×weight` → vừa 2) và phí cố định 400 B; chỉ chữ mới tính phí (ok/rejected/conflict-meta không); ca của người kiểm ở ngân sách thật (10 × 0,59 MB → 5 có chữ + 5 bỏ, phản hồi < 4,5 MB).
- **Chưa giải quyết (ghi nhận):** `get_many` vẫn nạp nội dung của mọi op đích để quyết định (200 patch lên 200 tài liệu 3,5 MB là 700 MB RAM của MỘT yêu cầu). Thân yêu cầu ≤ 4 MB không chặn được (patch nhỏ); chỉ chặn bằng `get_many` không kèm chữ cho op không cần (đổi cổng + 3 kho). Với "đẩy ≤ 50 op/yêu cầu" của M4b và cỡ mục tiêu (vài tài liệu 1 MB) là chấp nhận được; xem "Còn tồn".

### Góp ý nhỏ đã sửa
1. **`since=0` + `device`** (`changes`): `since=0` luôn kèm chữ, kể cả bản do chính `device` ghi (IndexedDB bị xoá mà `deviceId` còn ở localStorage). Chỉ kéo tăng dần mới bỏ chữ bản của mình. Test `test_a_full_pull_brings_the_text_of_the_devices_own_writes_too`; test cũ chuyển sang kéo tăng dần. **Hợp đồng đổi nhỏ** — đã ghi vào docs + ke-hoach §7.1 cho M4b.
2. **Dấu `serverUpdatedAt` của chuyển đổi** (`plan_migration`): thay `now + chỉ số` (tương lai) bằng `now − n … now − 1` (quá khứ, mỗi nút một dấu riêng). Lý do KHÔNG theo gợi ý "đặt chung dấu `now`": cả cây sẽ thành MỘT dãy dấu trùng mà `cut_page` giao nguyên cả dãy (không cắt giữa dãy) → trang đầu của cây cũ 7–8 MB vượt trần 4,5 MB. Dấu quá khứ giữ phân trang bình thường và con trỏ trung gian không bao giờ đứng trước đồng hồ. Test `test_a_document_pushed_during_a_paged_first_pull_is_not_lost_behind_the_cursor` (đỏ trên bản cũ: tài liệu mới bị bỏ mãi mãi), cộng cập nhật `test_plan_migration_is_pure…`.
3. **`pack_body` chạy zlib cho mọi hàng > 32 KB dù chọn delta:** nay chỉ nén dạng được giữ (`encode_revision_body`; `full_revision(packed=…)`). Test `test_only_the_form_that_is_kept_is_compressed`.
4. **`purge_expired_tombstones` N lượt khứ hồi + lịch sử mồ côi:** `purge_tombstones` của cổng nay xoá luôn lịch sử của các nút bị dọn, một câu lệnh mỗi loại (mysql: `DELETE … IN (SELECT …)` rồi xoá tài liệu, một commit; mongo: `$in` theo lô 1.000; json: xoá tệp lịch sử trước khi bỏ tài liệu). Test hợp đồng 3 kho `test_purging_tombstones_takes_their_history_with_them_and_only_theirs` (đỏ khi gỡ ở cả 3 kho).
5. **`rev` ở `GET /docs/{id}/revisions/{rev}`:** `le=2**31−1` (trước: OverflowError → 503 ở SQLite). Test `test_an_enormous_version_number_is_refused…`.
6. **`store_unavailable` không có dấu vết:** nay log tên lớp lỗi + các khung ngăn xếp (`traceback.format_tb`: tệp, dòng, mã nguồn — không có thông điệp/tham số/biến cục bộ). Lỗi lập trình (KeyError…) không còn trông như DB chết. Test với `caplog`, kiểm cả thông điệp xây lúc chạy không lọt vào log.
7. **Op có `content` trùng hash đang lưu nhưng chữ khác:** nay `_check_text` cũng chạy (→ `md_hash_mismatch`), không còn trả `ok`. (Op chỉ có `patch` trùng hash vẫn là `ok` replay: không có chữ để kiểm, không ghi gì.) Test `test_a_replay_whose_text_does_not_hash_to_what_it_says_is_refused`.
8. **Tên thiết bị `legacy`:** dành riêng cho bản ghi chuyển đổi — `PushRequest` từ chối (422); hằng `LEGACY_DEVICE` dùng chung. Surrogate lẻ qua HTTP là 400 chung của JSON (không phải `md_bad_content`; mã đó chỉ chạm khi gọi thẳng use case) — đã sửa câu trong docs.
9. Docs: chính sách diff/delta (`MAX_DIFF_PAIRS`, luồng phụ), `since=0`, `contentOmitted`, `rev` ≤ 2^31−1, dấu chuyển đổi.

### Góp ý nhỏ chưa sửa (có lý do)
- **`ensure_migrated` chạy từ `GET /sync/changes` khi `MARKDOWN_PUBLIC_READ=true`** (khách ẩn danh kích hoạt DDL + chép cây; tương tự DDL 3 bảng từ `GET/PUT /files` ở mysql khi `MARKDOWN_LEGACY_PUT=reject`): chữa đúng cần dependency `require_markdown_reader` cho biết người gọi có phải quản trị không (hiện nó chỉ trả/ném) và một mã "chưa sẵn sàng" mới cho khách — đổi hợp đồng/giao diện, ngoài phạm vi sửa lỗi. Giảm nhẹ: mặc định `MARKDOWN_PUBLIC_READ=false` (Q1) nên chỉ lộ khi chủ dự án cố ý bật; chuyển đổi idempotent, có claim, chỉ tốn một lần. **Chủ dự án nên biết:** đừng bật `MARKDOWN_PUBLIC_READ` trước khi lần đồng bộ đầu của quản trị đã chạy xong (khi đó `ensure_migrated` chỉ đọc cờ `done`, không ghi gì).
- **`list_since` nạp nguyên `content` của tới `size+1` (≤ 201) bản ghi rồi mới cắt theo ngân sách byte** (một lần kéo tài liệu 1 MB có thể nạp ~200 MB để trả 3 MB): chữa đúng cần cột `size` trước + đọc chữ sau (đổi cổng + 3 kho). Chấp nhận ở cỡ mục tiêu.
- **Con trỏ trung gian không trễ 2 s** (xem "Lệch thiết kế" #7): phần chuyển đổi đã sửa; phần còn lại là cửa sổ ≤ 199 ms của push rất nhanh ≥ 200 op.

### Tệp đổi trong vòng sửa này
- Mã: `src/application/usecases/markdown_docs_usecase.py` (`_cpu`, `encode_revision_body`, `decode_revision`, `_conflict`/`_Budget.reply_bytes`, dấu chuyển đổi, `since=0`, kiểm hash của replay, `store_unavailable`, bỏ vòng xoá lịch sử từng id), `src/application/utils/line_patch.py` (`autojunk=True`, `_anchor_pairs`, `MAX_DIFF_PAIRS`), `src/domain/vo/markdown_docs_vo.py` (`LEGACY_DEVICE`), `src/adapter/input/controllers/markdown_docs_controller.py` (`rev` ≤ 2^31−1), `src/application/ports/output/markdown_docs_repository_port.py` (chú thích `purge_tombstones`), `src/adapter/output/markdown_docs/{json,mysql,mongo}_repository.py` (`purge_tombstones` xoá lịch sử).
- Test: `tests/support/markdown_docs.py` (`LoopWatch`, `repetitive_lines`, `shuffled_vocabulary`), `test_line_patch.py`, `test_markdown_docs_{push,history,changes,migration}.py`, `test_markdown_docs_repositories.py`, `test_markdown_docs_vo.py`, `test_markdown_docs_controller.py`.
- Tài liệu: `docs/markdown-sync-api.md`, `ke-hoach.md` §7.1 (+1 gạch), mục này.
