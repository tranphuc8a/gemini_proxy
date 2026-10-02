# Nội dung khoá học chuyển vào database — bàn giao

**Ngày:** 2026-10-02 · **Nhánh:** `lab/dot-7-va-kiem-trinh-duyet` · **Chưa commit.**

Trước: mỗi trang khoá học nhúng toàn bộ bài giảng vào `assets/content.js` (+ một
`content.json` song sinh) — 23,6 MB trong `webapp/courses/`, đi theo mỗi lần deploy
Vercel, và trình duyệt tải cả khoá (8,4 MB với khoá AI) rồi lập chỉ mục tìm kiếm.
Sau: nội dung ở database, FastAPI phục vụ qua `/courses`, trang chỉ tải mục lục rồi
từng bài; có API + CLI + trang web + sqladmin để quản lý. Một đợt rà soát độc lập
(2 cao, 5 trung bình, 3 thấp) đã được sửa hết — mục 5. Sau đó một đợt kiểm thử QA trang
quản lý (20 lỗi + 21 đề xuất, `docs/kiem-thu-quan-ly-khoa-hoc.md`): **sửa cả 20 lỗi, làm đề
xuất P0 + P1 + P2 #21** — mục 6.

---

## 1. Con số

| | Trước | Sau |
| --- | ---: | ---: |
| `backend/fastapi` (Root Directory Vercel, tệp git) | 112,8 MB | **90,3 MB** |
| `webapp/courses` | 26,1 MB | **3,1 MB** |
| Khoá AI — tải khi mở trang | 8,4 MB `content.js` | **≈ 24 KB** manifest (gzip) |
| Heuristic / Heuristic 2 / System Design | 1,2 / 1,4 / 0,8 MB | ≈ 5 / 6 / 7 KB |
| OPIc | 230 KB | 79 KB bundle (gzip) |
| Mở lại trang | tải lại cả khoá | **304** (ETag) |

Bundle sao lưu (12,6 MB, mỗi khoá một tệp) nằm ở `backend/course-content/` — ngoài Root
Directory nên không vào function Vercel.

---

## 2. Kiến trúc

```text
courses ─┬─ course_sections ── course_groups ─┐       (section → nhóm → bài, như nav cũ)
         ├─ course_docs  ◄──── group_id ──────┘       md LONGTEXT + cột đã bỏ dấu để tìm
         ├─ course_assets                             tệp tải lên (LONGBLOB), duy nhất theo (khoá, tên)
         └─ course_doc_revisions                      30 bản gần nhất mỗi bài + bản trước khi xoá
course_trash                                          khoá đã xoá: cả bundle + tệp (base64), 30 ngày
```

| Lớp | Tệp |
| --- | --- |
| Domain | `src/domain/models/course_domain.py`; `src/domain/utils/`: `course_text.py` (bỏ dấu 1:1, outline, thống kê, xếp hạng — chuyển nguyên từ engine JS), `course_rev.py` (dấu vân tay `rev`/`treeRev`/`infoRev`, `If-Match`), `course_links.py` (quét link hỏng), `course_assets.py` (tên tệp, kiểu theo đuôi), `course_templates.py` (mẫu khoá) |
| Port / use case | `src/application/ports/{input,output}/course_*_port.py`, `src/application/usecases/course_usecase.py` (kiểm tra định danh, manifest, tìm kiếm: chỉ mục LRU + kết quả LRU theo **revision**, xếp hạng trong thread; thùng rác, lịch sử, tệp, nhân bản); `src/application/utils/rate_limit.py` |
| Adapter | `entities/course_entity.py` (`derived_doc_values` + sự kiện ORM), `repositories/course_repository.py`, `controllers/course_controller.py` (bảng route đầy đủ ở docstring), `factory/course_factory.py`, view sqladmin trong `adapter/input/admin.py` |
| Migration | `0003_create_course_tables.py` (utf8mb4; định danh `utf8mb4_bin`), `0004_course_assets_history_trash.py` — cả hai bỏ qua bảng đã có vì startup chạy `create_all` |
| Cấu hình | `DB_URL` (ghi đè DB_*, vd SQLite dev), `COURSE_ADMIN_KEY` (**rỗng = tắt quản trị**), `COURSE_SESSION_HOURS`, `COURSE_SESSION_MAX_DAYS`, `COURSE_BULK_MAX_BYTES`, `COURSE_DOC_MAX_BYTES` (1 MB), `COURSE_ASSET_MAX_BYTES` (3 MB), `COURSE_LOGIN_FAILURES` (5) / `_GLOBAL` (50) / `_WINDOW_SECONDS` (300) — có trong `.env.example` |

**API** (đọc công khai; ghi cần admin; nháp trả 404 cho công chúng) — bảng đầy đủ ở
`backend/fastapi/README.md`. Ngoài đọc / tạo / nạp / sửa / xoá: `duplicate`, `rename`,
`history`, `trash` (khoá và bài), `assets`, `links`, `export` kèm tệp.

**Phiên bản và cache.** Mọi lần ghi: khoá hàng `courses` (`SELECT … FOR UPDATE`), đếm
thống kê bằng đọc có khoá (`FOR SHARE`), rồi `version = version + 1` **trong SQL**. ETag và
chỉ mục tìm kiếm khoá theo *revision* = `id.created_at.version` — xoá rồi nạp lại một khoá
(version về 1) không bao giờ trùng cache cũ. SQLite: bảng `courses` có `AUTOINCREMENT` để
id không bị dùng lại.

**Chống ghi đè.** `rev` (bài), `treeRev` (cây), `infoRev` (thông tin) là sha1 16 ký tự của
chính nội dung — tính ra, không lưu cột. Ghi kèm `If-Match` thì so **trong** khoá hàng; lệch
→ 409 + `data.current`. `If-None-Match: *` = chỉ tạo bài.

**Bí danh.** Đổi slug: slug cũ vào `courses.config.slugAliases`; đổi id: `idAliases` (cả
lịch sử bài đổi theo, chuỗi bí danh được rút gọn). Hai khoá này ẩn khỏi ô cấu hình
(`public_config`); manifest trả `aliases` (chỉ những cái trỏ tới bài còn) và `idAliases`.

**Ghi hàng loạt** (MySQL ở xa: mỗi câu lệnh là một vòng mạng): bài nạp bằng INSERT nhiều
hàng (≈ 4 MB/lượt, aiomysql tự gộp ≈ 1 MB/câu), cây mới = 2 INSERT + 2 SELECT, gắn bài vào
cây bằng `UPDATE … CASE doc_id …` 150 bài/câu.

**Front-end:** nguồn engine ở `webapp/courses/engine/` — `app.js|css` (trang đọc) và
`hien-thi.js|css` (bộ dựng bài `HienThi`: marked + lọc HTML, KaTeX, hljs, mermaid nạp khi
cần, hộp chú ý, link giữa bài, ảnh `assets/…`). `sync.py` chép theo `dong-bo.json`: nhóm
`khoa_hoc` → 4 trang khoá học + `khoa-hoc/`; nhóm `quan_ly` → `hien-thi.*` sang trang quản
lý (xem trước = trang thật). Engine: manifest → từng bài (cache 40, tải trước bài tiếp) → tìm
kiếm qua API (huỷ request cũ); `aliases` chuyển link cũ sang địa chỉ mới, `idAliases` dời tiến
độ người học. `window.COURSE` có thì chạy offline. `?api=` **chỉ nhận API ở máy cục bộ**
(localhost/127.0.0.1/[::1]) hoặc trang mở từ `file://`. Dữ liệu DB vào HTML luôn qua `esc()`;
markdown qua `htmlSach`.

**OPIc:** câu hỏi = bài `kind=script`, chủ đề = nhóm, `dang`/`bo` + `dangThuTu`/`boThuTu`
trong `course.config` (MySQL sắp lại khoá object JSON). `OPICL.tuBundle` dựng lại theo thứ
tự đó và làm sạch mọi định danh `app.js` ghép thẳng vào HTML. Nguồn soạn:
`backend/course-content/opic/` (`build.py` sinh `opic.json`).

---

## 3. Quản lý

| Công cụ | Dùng khi |
| --- | --- |
| Trang `webapp/courses/quan-ly-khoa-hoc/` | mọi việc biên tập — xem README của trang (bảng chức năng, phím tắt, mã nguồn 4 tệp `app` / `cay` / `soan` / `tep`). Token cất theo đúng máy chủ đã cấp (`qlkh.phien@<gốc API>.token`); làm mới được tối đa `COURSE_SESSION_MAX_DAYS` ngày (mặc định 7) sau lần nhập khoá |
| `backend/fastapi/tools/manage_courses.py` | `info · init-db · list · import · import-all · export [--js] · search · publish · delete`; ghi vào DB không phải SQLite cần `--yes`; **cách duy nhất nạp bundle > 4,5 MB** (giới hạn thân request Vercel). `export` kèm tệp (base64), `--js` bỏ tệp |
| `/admin` (sqladmin) | sửa nhanh một hàng; hook trước/sau mỗi lần sửa / xoá (course, section, nhóm, bài) tăng `version` của **mọi** khoá liên quan (kể cả khi chuyển hàng sang khoá khác) |

**Trang đọc cho mọi khoá — Thư viện khoá học** `webapp/courses/khoa-hoc/`:

| Địa chỉ | Hiện gì |
| --- | --- |
| `/webapp/courses/khoa-hoc/` | danh mục mọi khoá (có trong portal); khoá có trang riêng CÓ THẬT thì thẻ trỏ sang đó |
| `…/khoa-hoc/?khoa=<slug>` | đọc khoá đó bằng engine chung; tên, phụ đề, biểu tượng, mô tả lấy từ database |
| `…/khoa-hoc/?khoa=<slug>&nhap=1` | bản nháp, gửi kèm token phiên của trang Quản lý |

Trang Quản lý: mọi khoá có nút **Mở trang khoá học ↗** (nháp: **Xem trước bản nháp ↗**);
thêm **Trang riêng ↗** khi `config.webapp` trỏ vào trang có thật (đối chiếu `/webapp/_api/list`,
không mở thử nên không có 404 trong console).

---

## 4. Lỗi bắt được trong lúc làm

| Lỗi | Bắt bằng | Sửa |
| --- | --- | --- |
| `sort_order` là vị trí *trong nhóm* — sắp theo nó trộn lẫn các nhóm | thiết kế + test thứ tự manifest | xếp theo thứ hạng điều hướng tính từ cây |
| `init-db` báo xong mà không tạo bảng | chạy CLI | phải import module entity trước `create_all` |
| Slug "Demo" bị âm thầm đổi thành "demo" | test | từ chối thay vì sửa hộ |
| Trang sửa bài / nhóm trong sqladmin lỗi 500 | smoke test sqladmin | cột `meta` đụng `Form.meta` của wtforms → thuộc tính `meta_json` |
| Bộ kiểm báo nhầm "tải lại không 304" | đọc log uvicorn | Playwright báo 200 cho phản hồi đã xác thực lại; sự thật là log máy chủ |
| Bản sửa tìm kiếm đầu tiên (regex có look-behind đứng trước) làm truy vấn thường chậm 30–40 lần | đo lại trên khoá AI | vòng `str.find` như cũ, quá 8 lần trúng giữa từ thì chuyển sang regex chữ-trước, look-behind-sau (chạy trong C) |
| Phép kiểm `?api=` báo nhầm | chạy thử | chính địa chỉ trang có chữ `evil.invalid`; so theo **host** của request |
| Trình soạn: lưu xong `S.doc` là object mới nhưng ô soạn vẫn ghi vào object cũ → chữ gõ sau lần lưu đầu **không vào bản nháp trên máy, xem trước, đếm từ** | `quan-ly-khoa-hoc/check.py` bước 12 (tải lại trang không thấy bản nháp) | ô soạn ghi vào `S.doc`; thêm phép thử "gõ tiếp sau khi lưu" |
| Trình soạn: phản hồi lưu về muộn ghi đè chữ vừa gõ trong lúc chờ | đọc lại mã | so nội dung đã gửi với ô soạn, phần gõ thêm vẫn là "chưa lưu" trên `rev` mới |
| `?theme=` trên địa chỉ khoá cứng nút sáng/tối | chạy thử | `?theme=` chỉ đặt lựa chọn một lần |

---

## 5. Rà soát độc lập — đã sửa

| # | Phát hiện | Sửa | Kiểm bằng |
| --- | --- | --- | --- |
| H1 | `?api=https://la` làm trang quản lý gửi token phiên (và khoá) tới máy lạ ngay khi mở; trang khoá học dựng HTML từ máy lạ; vài trường DB vào HTML không escape; OPIc cho link `javascript:`; khoá admin mặc định công khai | `?api=` chỉ nhận API cục bộ / `file://` (3 trang); token theo máy chủ; `esc()` slug, `meta.no/of`, id/icon section; `icon()` lọc tên; số sao kẹp 0–5; OPIc làm sạch định danh ở `tuBundle`, chặn `javascript:/vbscript:/data:`; server từ chối id/slug/kind/section/icon mang ký tự lạ; **không còn khoá mặc định**; refresh phiên tối đa 7 ngày | bước 21 trang quản lý + 2 ca biên ở 4 trang khoá học — **đối chứng âm**: code cũ gửi `/courses/admin/session` tới `evil.invalid`, nhận HTML lạ, sập "Invalid count value" |
| H2 | `"a " × 100` tốn 37 s CPU, chặn event loop | ≤ 6 từ khoá khác nhau, mỗi từ ≥ 2 ký tự; matcher lai `str.find` + regex; xếp hạng trong thread, tối đa 2 cùng lúc; cache 256 câu trả lời theo revision | test domain (so khớp với quy tắc gốc qua 400 chuỗi ngẫu nhiên) + đo bảng dưới |
| M3 | xoá rồi tạo lại khoá → version trùng → 304 nội dung cũ, tìm ra từ đã xoá | revision `id.created_at.version` | test: cùng version, khác ETag, cache tiến trình khác không trả "zebra" |
| M4 | hai lần lưu chồng nhau cùng ghi N+1 | `FOR UPDATE` + đọc thống kê có khoá + `version = version + 1` trong SQL | test câu lệnh `courses.version +`; câu SQL dựng cho MySQL đúng cú pháp |
| M5 | sqladmin sửa/xoá nhóm, xoá section/khoá không tăng version | hook `on_*` lấy id khoá trước khi ghi, `after_*` chạm mọi khoá liên quan | test gọi hook + smoke HTTP thật `/admin` (đổi tên nhóm, xoá section → ETag cũ nhận 200) |
| M6 | nhóm rỗng / cây rỗng làm trang chủ kẹt "Đang tải mục lục…" | `coThat()`, kiểm tra rỗng ở trang chủ; lỗi khi dựng trang → trang lỗi có nút thử lại | 2 ca biên trong `kiem_khoa_hoc.py` (đối chứng âm: code cũ sập) |
| M7 | nạp khoá AI 315 INSERT lẻ, lưu cấu trúc ≈ 335 vòng mạng; manifest 12 query, mở bài 7 | xem "Ghi hàng loạt" mục 2; manifest dùng tóm tắt bài làm vị trí trong cây; bài + nhãn nhóm 1 JOIN | test giới hạn số câu lệnh (300 bài) |
| L8 | MySQL sắp lại khoá `dang` → bộ lọc OPIc sai thứ tự | `dangThuTu`/`boThuTu`, `L.theoThuTu` | `kiem-nhanh.js` giả lập thứ tự MySQL |
| L9 | khoá rỗng → token ký bằng "" hợp lệ; so khoá bằng `==` | `admin_session` từ chối khoá rỗng (cả 3 controller dùng chung); `hmac.compare_digest` | test token giả ký bằng khoá rỗng → 403 |
| L10 | bundle thiếu `id/slug/title` → 422 | domain cho phép rỗng, `_normalise_bundle` tự điền | test nạp 300 bài chỉ có `md` |

**Đo trên khoá AI** (292 bài, 6,3 MB đã bỏ dấu; SQLite, đếm ở tầng SQLAlchemy):

| | Trước | Sau |
| --- | ---: | ---: |
| Nạp cả khoá | 315+ INSERT lẻ | **17** câu lệnh (6 executemany) |
| Lưu cấu trúc | ≈ 335 | **22** |
| Manifest lần đầu / mở bài / 304 | 12 / 7 / 1 | **5 / 3 / 1** |
| Xếp hạng "gradient descent" · "xác suất thống kê bayes ước" | 0,02 s | 16 ms · 48 ms |
| Truy vấn ác ý ("a " × 100 · "th ng co ch tr an") | 37 s | 0 ms (không còn từ khoá) · 143 ms |

---

## 6. Đợt QA: sửa lỗi + tính năng (2026-10-02, tối)

Bảng QA-01…QA-20 → cách sửa → phép thử chống tái phát: **mục 0 của
`docs/kiem-thu-quan-ly-khoa-hoc.md`**. Tóm tắt những gì mới:

| Phần | Việc |
| --- | --- |
| Không mất việc | `If-Match` cho bài / cây / thông tin (409 → hỏi, bài có khác biệt từng dòng); một chốt "chưa lưu" cho mọi lối thoát; bản nháp bài tự lưu trên máy; hết phiên → đăng nhập đè lên ứng dụng |
| Cây | kéo-thả bài / nhóm / section, ↑ ↓ giữ tiêu điểm, ⇄ menu, lọc không dấu, thu gọn nhóm, hộp thoại có kiểm tra (sửa được id + biểu tượng section), id bài gợi ý bỏ dấu không trùng |
| Soạn bài | Soạn / Chia đôi / Xem bằng **bộ dựng chung** `engine/hien-thi.js`; thanh công cụ; Ctrl+S / B / I; dán-kéo ảnh = tải lên; lịch sử 30 bản; nhân bản; đổi id; xoá vào thùng rác có cảnh báo link tới |
| Khoá | mẫu (`trong`, `co-ban` 2 section 6 bài, `chu-de`), nhân bản (nháp, kèm tệp), nạp đè hỏi trước + bản cũ vào thùng rác, xoá vào thùng rác 30 ngày, khôi phục (trùng slug thì hỏi slug mới) |
| Tệp, liên kết | tệp tải lên lưu trong DB, đi theo xuất / nhân bản / thùng rác; tab Kiểm tra liên kết; tệp khoá nháp chỉ quản trị viên xem (ảnh nạp bằng fetch + blob) |
| Khác | URL `#/<khoá>/<tab>/<id bài>`; giới hạn đăng nhập 429; bài ≤ 1 MB, tệp ≤ 3 MB; thông báo tiếng Việt; điện thoại (ngăn kéo, hai màn, nút cỡ ngón tay); trợ năng; nút sáng / tối; trang đọc: header không tràn, tiêu đề không lặp, link cũ chuyển hướng, tiến độ theo id mới |

**Chưa làm — P2 #16–#20** (tài khoản + vai trò + nhật ký, xuất bản theo bài / hẹn giờ, số liệu
người học, nhập / xuất Git–markdown, quiz + tiến độ đồng bộ): cần quyết định sản phẩm trước
(ai được làm gì, lưu gì về người học), không phải sửa lỗi.

**Thiết kế cần biết:** dấu vân tay thay cho cột `version` riêng từng bài (không đổi bảng cũ);
thùng rác khoá lưu nguyên bundle `export` (khôi phục = nạp lại); lịch sử lưu **bản bị thay**
mỗi lần lưu (bài mới tạo chưa có bản nào); dọn lịch sử > 30 bản khi lưu, dọn thùng rác > 30 ngày
khi xoá hoặc xem thùng rác (không cần cron).

---

## 7. Kiểm tra

| Phạm vi | Lệnh | Kết quả |
| --- | --- | --- |
| Backend | `cd backend/fastapi && .venv/Scripts/python.exe -m pytest -q` | **715 đạt** (18 mới ở `test_course_editing.py`: xung đột, lịch sử, thùng rác, bí danh, đổi id, liên kết, tệp, xuất / nạp kèm tệp, mẫu, nhân bản, giới hạn cỡ, giới hạn đăng nhập, thông báo tiếng Việt) |
| 4 trang khoá học | `python webapp/courses/<khoá>/check.py` | mỗi trang **22 đạt** — FastAPI thật + SQLite tạm + Chromium, gồm 4 ca biên |
| OPIc | `python webapp/courses/opic-course/check.py` | **29 đạt** (gồm `kiem-nhanh.js` 69 phép) |
| Trang quản lý | `python webapp/courses/quan-ly-khoa-hoc/check.py` | **73 đạt**, mọi thao tác đối chiếu bằng API; chạy 2 lần liền đều đạt |
| Thư viện khoá học | `python webapp/courses/khoa-hoc/check.py` | **27 đạt** — thêm link cũ sau đổi slug, tiến độ theo id mới, điện thoại 390 px |
| sqladmin | smoke HTTP (đăng nhập, sửa nhóm, xoá section) | 7/7 |
| CLI | `init-db · import · export (json / --js) · import --slug` trên SQLite tạm | tệp đi theo bundle JSON, `--js` bỏ tệp, nạp lại khôi phục tệp và chỗ dùng |
| Engine | `python webapp/courses/engine/sync.py --kiem` | mọi bản sao khớp nguồn |

Playwright cài ở Python hệ thống (`python`), không ở `.venv`. Không có linter trong dự án
(không thêm dependency); thay bằng `py_compile` + dò import / biến thừa trên mọi tệp `.py` đã
sửa (22 tệp), và `node --check` cho JS (17 tệp).

---

## 8. Việc phải làm khi deploy (chưa làm — cần quyền vào DB thật)

1. Deploy backend: lần khởi động đầu `create_all` tạo các bảng còn thiếu — gồm 3 bảng mới
   `course_assets`, `course_doc_revisions`, `course_trash` (hoặc `alembic upgrade head` → 0004).
   Không cần chuyển dữ liệu: khoá đang có chạy nguyên, lịch sử bắt đầu trống.
2. **Bắt buộc** đặt `COURSE_ADMIN_KEY` (chuỗi ngẫu nhiên dài) trên Vercel — không có thì
   mọi thao tác ghi trả 403 và trang quản lý báo "Máy chủ chưa bật quản trị khoá học".
   Máy dev cũng vậy: thêm vào `backend/fastapi/.env` nếu cần trang quản lý.
3. Từ máy vào được Aiven: `cd backend/fastapi && python tools/manage_courses.py import-all --yes`.
4. Mở `/webapp/courses/<khoá>/` — **trước bước 3 các trang báo "Không tải được khoá học"**.

**Trạng thái Aiven ngày 2026-10-02 (đọc bằng `manage_courses.py info`, từ máy này đã kết nối được):**
bốn bảng đầu đã có; 5 khoá đã nạp (đều v1, chưa sửa) + `test-course` (v9, người dùng tạo, `config.webapp`
= `courses/test`). Bản OPIc trên Aiven nạp TRƯỚC khi bundle có `dangThuTu` → cần nạp lại:
`python tools/manage_courses.py import ../course-content/opic.json --yes` (Claude không được phép
ghi vào DB thật trong phiên này — người dùng tự chạy). Ba bảng mới chưa có trên Aiven cho tới khi
backend mới khởi động (hoặc `manage_courses.py init-db --yes`).

## 9. Còn nợ / cần biết

- P2 #16–#20 của báo cáo QA (mục 6).
- Chưa chạy trên MySQL thật: khoá hàng (`FOR UPDATE`, `FOR SHARE` trên truy vấn đếm), gộp
  INSERT của aiomysql, `UPDATE … CASE`, và ba bảng mới (LONGBLOB, JSON `placement`). Tệp
  3 MB và hàng `course_trash` (cả khoá + tệp base64, to hơn 4/3) cần `max_allowed_packet` đủ
  lớn (MySQL 8 mặc định 64 MB). Lần nạp / xoá khoá đầu lên Aiven nên xem log.
- Migration 0003 (không sửa) tạo `courses` trên SQLite **không** có `AUTOINCREMENT`; chỉ
  ảnh hưởng SQLite tạo bằng alembic, xoá rồi tạo lại khoá trong cùng một giây.
- Markdown nguồn của bốn khoá lớn không có trong repo; bundle là bản đầy đủ duy nhất ngoài DB.
  Sửa trong DB muốn giữ ở repo thì `manage_courses.py export` rồi commit bundle.
- Chỉ mục tìm kiếm ở RAM từng instance: lần tìm đầu sau mỗi lần sửa nạp lại văn bản đã bỏ
  dấu (≈ 6 MB với khoá AI).
- Bản nháp bài nằm trong localStorage của từng trình duyệt — máy khác không thấy.
- Bốn bản khoá học cũ còn nhúng `content.js` dưới `webapp/tranphuc8a/` (heuristic,
  system-design, hai bản trong `courses/`; ≈ 3,3 MB, hai bản có trong portal) — **chưa động
  tới**, chờ quyết định giữ hay xoá.
- Git: phần đầu đã vào commit `312d19b` (người dùng commit, 21:16). Mọi thay đổi sau đó **chưa
  commit, chưa stage** (41 tệp sửa + 26 tệp mới lúc viết). Commit đó có lẫn hai ảnh
  `quan-ly-khoa-hoc/_shots/ql-*.png` (được stage trước khi có `.gitignore`) — không muốn giữ thì
  `git rm --cached` hai tệp đó.
