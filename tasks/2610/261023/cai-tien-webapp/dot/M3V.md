# M3V — vá góp ý của người kiểm M3 (24/10/2026, làn A, đợt 2)

**Trạng thái: xong, mọi lệnh kiểm xanh (số thật ở bảng dưới).** Chưa commit. Bản xuất bản markdown-editor-pro build **`c6495a6c07dd`**.
Nguồn góp ý: `dot/M3-nho-chua-sua.md` (mục 1–8, 11, 14 + một ý thêm từ lần kiểm lại: `client_address`). Mục 9, 10, 12, 13, 15–17 không làm (ngoài phạm vi / chủ dự án quyết).

## Đã làm (mỗi mục kèm test)
| # | Việc | Cách sửa | Test |
|---|---|---|---|
| 1 | `#share` / `#share=` bị coi là liên kết chia sẻ | `parseShareHash` trả `null` khi token rỗng (`src/lib/share.ts`). Neo tiêu đề "Share" (`href="#share"`) và `[x](#share)` không còn làm `needsRestart` tải lại sang "Link not available". | `share.test.ts` (7 dạng hash rỗng + `#Share`, `#sharing`), `boot.test.ts` (startApp + hashchange không reload), **Edge thật** `kiem-chia-se.py` phép 9 (2 phép: bấm `[x](#share)`, `[x](#share=)`, neo tiêu đề, `location.hash='#share'`; trang không tải lại, không "Link not available") |
| 2 | Token lọt log + thân 500 | `markdown_share_usecase.store_unavailable(cause)`: lỗi kho ở `read_shared` → `AppException` 503 `markdown_share_unavailable`, chỉ ghi **tên lớp** lỗi (`logger.error("... %s", type(cause).__name__)`), `raise … from None` (không móc nối traceback). Route `GET /markdown/shared` bắt thêm mọi `Exception` khác (limiter, lỗi bất ngờ) thành cùng một câu trả lời, vẫn kèm `no-store`/`noindex`. Lỗi kho không bị đếm là "token sai". | usecase: repo giả ném `RuntimeError("… [parameters: ('<token>',)]")` → 503, message/payload/`caplog` không chứa token, `__cause__ is None`; controller: 2 test (lỗi kho, lỗi trước kho) kiểm thân + header + `caplog` |
| 3 | `is_local_request` | `ipaddress.ip_address(host).is_loopback` + nhánh IPv4-mapped (`::ffff:127.x`; Python 3.12 chưa tự nhận) + chữ `localhost`. Vẫn từ chối khi có header proxy. | 8 máy chủ loopback đúng + 11 máy khác sai (kể cả `testclient`, `127.0.0`, chuỗi rỗng, `None`); 4 header proxy; HTTP: khoá mặc định chạy từ `::ffff:127.0.0.1`, `127.0.0.2`, `::1` |
| 4 | `X-Admin-Key max_length=200` | **Bỏ trần ở header** (3 chỗ: `require_markdown_admin`, `require_markdown_reader`, `/admin/verify`) — chọn "nâng trần" thay vì "báo lỗi", vì 422 nghĩa là khoá dài không bao giờ mở khoá được. Trong `check_markdown_admin`: đoán dài hơn `max(2048, len(khoá thật))` bị coi là khoá sai (403 `markdown_admin_invalid`, vẫn bị đếm 20 lần/10 phút) mà không so sánh. Ghi chú `.env.example`, `backend/fastapi/README.md`, `docs/markdown-share-api.md`. | khoá 64/200/201/700/2048/3000 ký tự mở khoá + PUT được, đoán sai gần đúng → 403; khoá sai 5000 ký tự ×20 → 403 rồi khoá đúng bị 429 |
| 5 | Làm mới liên kết ĐÃ HẾT HẠN | **Cấp token mới** (an toàn hơn cảnh báo: ai giữ link cũ không đọc được bản mới). Use case: `existing` hết hạn → `delete_by_doc` rồi tạo mới (token mới, `sharedAt` mới, trả 201, hạn mức không đổi). Hộp thoại: dòng "This link has expired and no longer opens… the old address stays dead", nút "Create new link", ẩn dòng "changed since this snapshot". Liên kết chưa hết hạn vẫn giữ token. | usecase (hết hạn → token mới, quota 1 không đầy; còn hạn 1 ms → giữ token; 3 kho json/sql/mongo), controller (HTTP 201 + token cũ → 404), `shareDialog.test.tsx` |
| 6 | `scanDocumentRefs` bậc hai | Viết lại tuyến tính, không regex backtracking: `inlineLinks` (một lượt/dòng, mỗi `[` chỉ mở ứng viên khi chưa có ứng viên, đích `(…)` đọc xác định), `tagAttributes` (`<a href>`, `<img src>`: con trỏ nhớ — ứng viên, `>` kế, dấu nháy đóng), `withoutCodeSpans` (đoạn mã theo CommonMark: chuỗi N dấu backtick đóng ở chuỗi N kế tiếp). Bản regex cũ giữ làm **oracle** của fuzz ở `src/lib/__tests__/shareScanReference.ts` (không import từ app). | 30.000 chuỗi ngẫu nhiên: kết quả **giống hệt** bản regex; 16 ca bệnh lý (dòng 60.000 `[`, `<a ` ×30.000, `<img `, `<a href=`, `[a](`, `![`, `](`, escape cuối dòng, hàng `(` dài, dải backtick…) mỗi ca khớp oracle ở 4 KB và 256 KB < 1,5 s; "sau dòng bệnh lý vẫn thấy liên kết thật"; 1 MB đời thường 30.000 liên kết |
| 7 | ShareDialog mất tiêu đề đang gõ | Hai cờ `titleTouched`/`expiryTouched` + `seededFor`: gieo ô Title/Expires khi mở hộp thoại hoặc đổi tài liệu, rồi đi theo máy chủ **trừ khi chủ đang gõ**; sau khi Create/Update thành công thì thả cờ để lần liệt kê kế hiện đúng cái máy chủ đang giữ. | `shareDialog.test.tsx`: gõ dở + chọn 30 ngày, thu hồi liên kết KHÁC (liệt kê lại với đối tượng mới) → ô giữ nguyên; sau Update hiện tên máy chủ; đổi tài liệu → tên mới |
| 8 | MySQL hai `docId` chỉ khác hoa/thường | Cổng ra thêm `MarkdownShareConflict`; `mysql_repository.save` ném nó (không còn `IntegrityError` tự tạo, không thử lại vì sẽ quyết định giống nhau; lần ném cuối của vòng thử lại cũng đổi thành nó, bỏ chi tiết SQL). Use case → `ConflictError` 409 `markdown_share_conflict`. Client: thông báo tiếng Anh cho mã này và cho `markdown_share_unavailable`. | repo: bảng SQLite `COLLATE NOCASE` (giả MySQL) → save `DOC-A` sau `doc-a` ném `MarkdownShareConflict`, liên kết đầu giữ nguyên nội dung (UPDATE đã bị rollback), refresh chính nó vẫn chạy; usecase + controller (409 + `data.code`); `shareClient.test.ts` |
| 11 | Câu tài liệu về `CREATE TABLE` | `dot/M3.md` (Còn tồn), docstring `mysql_repository.py`, `docs/markdown-share-api.md`, `README.md`, `.env.example`: DDL chạy ở **yêu cầu đầu tiên chạm kho trong một tiến trình, kể cả `GET /markdown/shared?backend=mysql` của khách**; idempotent, chỉ tạo đúng bảng đó. | — (tài liệu) |
| 14 | Số vitest trong skill | `.claude/skills/ban-do-ung-dung/SKILL.md`: "43 tệp, 817 test" → **43 tệp, 849 test** (số thật sau M3V). | — |

## Quyết định cho chủ dự án: `client_address` tin `X-Real-IP` (mục 9 + ý thêm) — GIỮ NGUYÊN hành vi
- Nguy cơ hai chiều: đổi header để né bộ đếm sai khoá/token; hoặc gửi 20 khoá sai kèm `X-Real-IP` của nạn nhân để **khoá nạn nhân** 10 phút (bộ đếm khoá cả khoá đúng).
- Không đổi vì: (a) `client_address` (`admin_auth.py`) dùng chung cho `/courses`, `/ai`, `/run`, `/codestore`, `/wiki`, `/arena`, `/markdown` — đổi mặc định là đổi cả dự án và nhiều test mô phỏng địa chỉ bằng `X-Real-IP`/`X-Forwarded-For`
  (`test_codestore_controller`, `test_course_editing`, `test_markdown_storage_controller`); (b) trên Vercel, nếu thôi tin header thì mọi khách cùng một IP của proxy → bộ đếm khoá cả thế giới;
  (c) repo không có tài liệu Vercel nào về việc nền tảng ghi đè header (tôi nhớ tài liệu Vercel nói có ghi đè, chưa kiểm được ở đây) nên không đủ chắc để đổi.
- Đã làm: ghi rõ rủi ro + điều kiện (proxy phải GHI ĐÈ header khi tự dựng) ở `.env.example` và `backend/fastapi/README.md`.
- Nếu muốn siết: thêm biến `TRUST_PROXY_HEADERS` (mặc định `true` = như cũ; `false` = chỉ dùng địa chỉ socket) cho `client_address`, đặt `false` ở máy tự dựng không proxy; mỗi test dùng `X-Real-IP` phải `monkeypatch.setenv("TRUST_PROXY_HEADERS","true")`. Cần chủ dự án quyết vì chạm mọi app.

## Tệp đổi
- Backend: `src/application/ports/output/markdown_share_repository_port.py` (+`MarkdownShareConflict`), `src/application/usecases/markdown_share_usecase.py`
  (+`store_unavailable`, hết hạn → token mới, 409), `src/adapter/output/markdown_share/mysql_repository.py`, `src/adapter/input/controllers/markdown_share_controller.py`,
  `src/adapter/input/controllers/markdown_admin.py` (`_is_loopback`, bỏ `max_length`, `MAX_ADMIN_KEY_CHARS`), `src/adapter/input/controllers/markdown_storage_controller.py` (một dòng: `/admin/verify` bỏ `max_length`),
  `.env.example`, `README.md`, `docs/markdown-share-api.md`.
- Test backend: `tests/application/test_markdown_share_usecase.py`, `tests/adapter/input/controller/test_markdown_share_controller.py`,
  `tests/adapter/input/controller/test_markdown_storage_controller.py`, `tests/adapter/output/markdownshare/test_markdown_share_repositories.py`.
- Frontend: `markdown-editor/src/lib/share.ts`, `src/components/ShareDialog.tsx`, `src/services/shareClient.ts`, `README.md`;
  test `src/lib/__tests__/share.test.ts`, `src/lib/__tests__/shareScanReference.ts` (mới, oracle), `src/__tests__/boot.test.ts`, `src/__tests__/shareDialog.test.tsx`, `src/services/shareClient.test.ts`;
  `scripts/kiem-chia-se.py` (+ phép 9).
- Sinh ra: `backend/fastapi/webapp/tranphuc8a/markdown-editor-pro/**` (build `c6495a6c07dd`, qua `build-webapps.mjs`).
- Tài liệu: `dot/M3.md` (câu CREATE TABLE, mục lệch 12), `.claude/skills/ban-do-ung-dung/SKILL.md`, `ke-hoach.md` §7.1 (+1 gạch), `dot/M3V.md`.

## Số đo `scanDocumentRefs` (vitest/jsdom, Windows, trước → sau)
| Đầu vào | Cũ (regex) | Mới |
|---|---|---|
| một dòng toàn `[` | 8 KB 323 ms · 16 KB 1.441 ms · 32 KB **6.841 ms** (×4,5 mỗi lần gấp đôi: bậc hai; 64 KB ≈ 29 s, 256 KB ≈ 7–8 phút ngoại suy) | 64 KB 0,9 ms · 256 KB **0,5 ms** |
| `<a ` lặp, không đóng | 8 KB 34 ms · 16 KB 140 ms · 32 KB **410 ms** | 64 KB 0,7 ms · 256 KB **0,5 ms** |
| `[a](` lặp | 1,4 ms (32 KB) | 256 KB 29 ms (tuyến tính: 64 KB 6 ms) |
| tài liệu đời thường 1,03 triệu ký tự, 30.000 liên kết | 44 ms | 93 ms |
Tài liệu đời thường chậm hơn ~2× (tách dòng + nhiều hàm nhỏ) nhưng vẫn < 0,1 s cho 1 MB, chạy một lần mỗi lần mở hộp thoại. Trần kiểm thử 1,5 s cho 256 KB (cũ: hàng phút).

## Lệnh kiểm (kết quả thật, 24/10 02:2x–02:48)

Mọi tiến trình import mã backend chạy với `DB_URL=sqlite…tạm MONGO_URI= RATE_LIMIT_BACKEND=memory *_STORAGE_BACKEND=json` (kiem-*.py: thêm `AI_ENABLED=false`, và `MayChuThat` tự đặt SQLite tạm + cổng trống).
Không chạm database thật; không có script nháp nào import mã backend ngoài pytest và hai script kiem-*.

| Lệnh | Kết quả |
| --- | --- |
| `pytest tests/application/test_markdown_share_usecase.py tests/adapter/input/controller/test_markdown_share_controller.py tests/adapter/input/controller/test_markdown_storage_controller.py tests/adapter/output/markdownshare -q` | exit 0 — **132 passed** (13,5 s). Cộng `tests/application/test_share_links.py` (mốc M3 118 → **161 passed**) |
| `pytest -q` (toàn bộ, gồm phần M4a dở của cây) | exit 0 — **2261 passed**, 4 skipped (247 s); mốc M3 2025 (phần còn lại do làn B/M4a thêm). M4a dở dang (`markdown_docs_*`) đang xanh |
| `cd markdown-editor && npm test` | exit 0 — **43 tệp / 849 test** (mốc M3 821; +28) (189 s) |
| `npm run type-check` · `npm run lint` | exit 0 · exit 0 (0 cảnh báo) |
| `PYTHONUTF8=1 … kiem-chia-se.py` | exit 0 — **Đạt 33 · SAI 0** (mốc M3 31; +2 phép neo `#share`), Edge thật + uvicorn thật |
| `node scripts/build-webapps.mjs --only markdown-editor` rồi `--check` | exit 0 / exit 0 — build `c6495a6c07dd`, 427 tệp precache, SW audit sạch, 7 app ok |
| `PYTHONUTF8=1 … kiem-pwa.py` | exit 0 — **Đạt 57 · SAI 0** |

Ghi chú về lệnh kiểm:

- **Đừng đặt `AI_ENABLED=false` khi chạy `pytest`**: lần chạy đầu của tôi đặt nó (theo mục BẢO VỆ DATABASE của đề) → 6 test `test_send_message_endpoint.py` đỏ (đúng 6 / 2261; tự khỏi khi bỏ biến, chạy lại toàn bộ xanh).
  Bản thân pytest vốn đã an toàn với DB thật (`db/base.py` rơi về SQLite tạm khi thấy pytest, `rate_limit_factory` dùng bộ nhớ), nên chỉ cần `DB_URL=sqlite…`, `MONGO_URI=`, `RATE_LIMIT_BACKEND=memory`.
- Đã chạy hai lần `kiem-chia-se.py`: lần đầu 31 đạt + 1 sai do **phép 9 của chính tôi** (ô soạn của khách chỉ đọc, `fill` hết giờ); sửa phép dùng ngữ cảnh chủ (đã mở khoá) rồi chạy lại: 33/0.
- Đỏ → xanh đã thấy: backend — 12 test đỏ ở storage controller (422 cho khoá dài, loopback), usecase đỏ trước khi sửa (`RuntimeError` lọt thẳng); frontend — `parseShareHash`, `boot`, 2 test `ShareDialog` đỏ trên bản M3 trong index (đổi tạm tệp rồi trả lại), regex cũ bậc hai (bảng đo).
  Chưa chạy riêng đỏ cho: test controller (503 chung, 409), `MarkdownShareConflict` ở kho SQL (cũ ném `IntegrityError`, import `MarkdownShareConflict` còn chưa có nên chắc chắn đỏ), phép 9 trên bản xuất bản cũ.

## Lệch thiết kế (đã chọn cách an toàn)
1. Mục 4: thiết kế nói "nâng trần hoặc báo lỗi" — chọn **bỏ trần ở header** + coi đoán quá dài là khoá sai (đếm), vì báo lỗi 4xx riêng cho khoá dài vẫn không giúp mở khoá.
2. Mục 5: sửa ở **use case** (xoá bản hết hạn rồi tạo mới) chứ không ở kho, để cả ba kho (json/mysql/mongo) hành xử như nhau và hợp đồng của cổng ra ("làm mới giữ token") giữ nguyên.
   Trả `201` (liên kết mới) thay vì `200`; client vốn đọc `created` nên toast là "Read-only link created".
3. Mục 6: đoạn mã nội tuyến theo **CommonMark** thay vì regex cũ (`(`+)[^`]*?\1` coi "``a`" là một đoạn rỗng): khớp cách trình hiển thị hiểu, và regex cũ cũng bậc hai trên dải backtick.
   Đây là chỗ DUY NHẤT kết quả khác bản cũ có chủ ý; fuzz không dùng backtick và test riêng ghim hành vi mới.
4. Mục 2: kho lỗi → **503** (không 500), vì là sự cố tạm thời của kho; trang xem hiện "Could not open this link" + nút Try again (nhánh lỗi chung đã có).
5. Mục 9 (client_address): **không đổi** — xem phần quyết định ở trên.

## Bỏ qua có lý do
- Mục 9–10, 12, 13, 15–17 của `M3-nho-chua-sua.md`: ngoài phạm vi đợt này (chủ dự án quyết hoặc cần hạ tầng khác). Mục 12 (lỗi dependency đường đọc công khai thiếu `no-store`) vô hại, giữ.
- Không chạm `main.py` (`generic_exception_handler` vẫn trả `str(exc)` cho MỌI route): đó là tệp dùng chung hai làn và là đổi hành vi toàn cục. Đường đọc công khai của chia sẻ đã không còn đi vào nó.
  Lỗi kho ở đường **quản trị** (tạo/làm mới liên kết) vẫn có thể ra 500 kèm `str(exc)` có tham số SQL (kể cả nội dung tài liệu) — chỉ người có khoá quản trị thấy, nhưng vẫn ghi log: cân nhắc ở đợt sau.
- Chưa thử Safari/điện thoại (vẫn như M3).

## Còn tồn / ghi chú
- Cây làm việc còn các tệp **M4a chưa commit và chưa thuộc đợt này** (`markdown_docs_*`, `utils/{line_patch,history_retention,sync_paging}.py`, test tương ứng; sửa dở bị ngắt 01:39). Tôi không sửa chúng; `pytest -q` toàn bộ xanh nên chúng đang ở trạng thái nhất quán, nhưng chưa có `dot/M4a.md` và chưa qua kiểm độc lập.
- Kết quả `kiem-chia-se.py` ở bước 9 chạy trên bản xuất bản mới; chưa chạy phép 9 trên bản cũ để thấy đỏ (đã thấy đỏ ở vitest: `parseShareHash`, `boot`).
- `shareScanReference.ts` là oracle: nếu đổi luật quét liên kết (ví dụ thêm Markdown reference-style `[x][id]`) thì sửa cả hai, hoặc bỏ oracle và giữ test ca cụ thể.
