# Bàn giao 17/10/2026 — Code Studio: bảy đề xuất cải tiến (1 → 7)

Yêu cầu của chủ dự án: "Làm toàn bộ lần lượt từ 1 đến 7". Làm tiếp bản bàn giao `tasks/2610/261015/code-studio/ban-giao.md` (đợt 15–16/10). **Chưa push** gì; commit cục bộ (xem cuối).

| # | Việc | Trạng thái | Nơi chính |
|---|---|---|---|
| 1 | Commit tách nhỏ đợt trước | Xong (3 commit ngày 16/10: `32a2aaf`, `f0d497f`, `de9bb76`) | git |
| 2 | **Bộ test** nhiều ca vào→đáp án | Xong, kiểm 3 trình duyệt | `assets/core/tests.js`, `assets/ui/tests.js`, `project.js` (`meta.tests`) |
| 3 | **AI giải thích lỗi** biên dịch/chạy | Xong; **chưa gọi Gemini thật** (cần chủ đồng ý, tốn quota) | backend `ai_code_usecase.py`; `assets/core/ai.js`, `assets/ui/ai.js` |
| 4 | **Dựng Piston/Judge0** tự chủ | Piston **chạy thật**; Judge0 lên + xác thực được nhưng **chưa chạy được mã** (máy thử cgroup v2) | `deploy/code-runner/` |
| 5 | **Bộ đếm tốc độ bền** cho `/run`, `/codestore` | Xong; kiểm MariaDB + mongod thật | `rate_limiter*.py`, `RATE_LIMIT_BACKEND` |
| 6 | **CI** GitHub Actions | Viết xong; các bước chạy lại trên Ubuntu 24.04, **chưa chạy trên GitHub** | `.github/workflows/webapp-ci.yml` |
| 7 | **Liên kết chia sẻ chỉ đọc** | Xong, API + giao diện; kiểm 3 trình duyệt + 3 kho thật | backend `codestore_*`; `core/share.js`, `ui/share.js`, `ui/share-view.js` |

## 2. Bộ test
Thẻ "Bộ test" ở bảng dưới. Mỗi ca `{id, name, input, expected}` lưu trong `meta.tests` (≤ 30 ca, mỗi trường ≤ 16 000 ký tự) cùng `meta.testMode` (`lines` mặc định | `tokens` | `float` 1e-6 | `exact`).
Chạy lần lượt (không bao giờ hai ca cùng lúc) qua đúng nơi chạy/cấu hình của nút ▶ Chạy (`A.prepareRun()` + `A.runOptions()` tách ra từ `runNow`). Phán quyết: AC / WA (kèm bảng so dòng) / TLE / RE / CE (dừng cả bộ, ca còn lại "chưa chạy") / lỗi nơi chạy (cũng dừng). Nút Dừng dùng chung (`A.beginBatch`).
Sửa đáp án hoặc đổi cách so sánh thì **chấm lại ngay** từ đầu ra đã giữ (`T.rejudge`), không chạy lại. "Dùng đầu ra này làm đáp án" và "Từ lần chạy gần nhất" để soạn nhanh. Lệnh bảng lệnh: "Chạy bộ test", "Thêm test mới".
**`meta` tăng 8 → 32 KB** (backend `MAX_META_BYTES`, frontend `LIMITS.store.metaBytes`; test dùng hằng số). Ca cuối là thứ bị cắt **sau cùng** khi meta đầy; giao diện chặn gõ vượt và hiện "Dung lượng N%". IDE heuristic (dùng chung `project.js`, không nạp `tests.js`) giữ nguyên bộ test đi qua.
Kiểm: `kiem-bo-test.js` (node), `check.py` (Edge/Firefox/WebKit; kể cả g++ thật với CE rồi AC), dọc đường phát hiện lỗi bố cục điện thoại (thẻ tràn 100 px) và đã sửa.

## 3. AI giải thích lỗi
Backend `POST /ai/code/explain` (cổng `AiUseCase.ask`, công thức skill `them-tinh-nang-ai`): schema JSON, chống chèn lệnh (mã/lỗi nằm trong khối `<<< >>>` + dặn bỏ qua chỉ dẫn), kiểm lại đầu ra phía máy chủ (số dòng, `patch` ≤ 40 dòng trong tệp, bỏ patch giống hệt), cache theo mã+lỗi+model. 78 test, toàn bộ bằng `FakeModel`.
Giao diện: nút "✨ Giải thích bằng AI" ở dòng trạng thái tab Kết quả khi lần chạy lỗi (chỉ hiện khi máy chủ bật AI và người này được dùng/hoặc chỉ thiếu mã) + thẻ ở đầu tab Vấn đề: tóm tắt, từng mục (bấm "dòng N" nhảy tới dòng), **đề xuất sửa dạng so sánh - / +** với nút "Áp dụng" (một bước hoàn tác bằng Ctrl+Z; từ chối nếu mã đã đổi từ lúc hỏi). Dùng chung token/khoá `localStorage` với `courses/engine/ai-khach.js` (mở khoá AI ở trang khác là dùng được), nhập mã truy cập ngay trong thẻ. Chuỗi AI luôn vào DOM bằng `textContent`. Tệp > 30 000 ký tự chỉ gửi phần đầu (số dòng không lệch).
Kiểm: `kiem-ai.js` (node, fetch giả), `check.py` với máy chủ AI **giả** (`page.route`, không gọi Gemini): ẩn khi AI tắt, nhập mã, hỏi, áp đề xuất, hoàn tác, từ chối khi mã đổi, HTML trong kết quả không chạy, 429.
**Chưa kiểm với Gemini thật.** Rủi ro đã biết: schema không dùng `nullable`; `max_tokens` 4096 — nếu bị cắt thì tăng ở `ai_code_usecase.py`; nếu Gemini hay trả `patch` lạ thì chỉnh prompt `TASK`, không cần đổi phần kiểm.

## 4. Nơi chạy tự dựng
`deploy/code-runner/` (README riêng): `piston/docker-compose.yml` + `cai-runtime.sh` (cài gcc/python/node/java… qua API, chạy lại được), `judge0/docker-compose.yml` + `judge0.conf.example`, `.gitattributes` ép LF cho `.sh`/`.yml`.
**Piston đã chạy thật** (Docker trong WSL2, 17/10): `tools/kiem_nha_cung_cap_that.py piston` → C, C++, Python, Java, JavaScript, Go, Rust đúng; Python/JS nhiều tệp đúng. Phát hiện & sửa: (a) gói `gcc`/`java` của Piston chỉ biên dịch tệp vào → adapter khai `multiFileLanguages = python, javascript`, C/C++/Java nhiều tệp bị từ chối rõ ràng (`run_multifile_unsupported`) thay vì lỗi biên dịch khó hiểu (+1 test); (b) ảnh Piston không có `curl` → healthcheck dùng `node`; (c) Piston **không gửi CORS** → nơi chạy "Piston của bạn (URL)" gọi thẳng từ trình duyệt cần proxy thêm CORS.
**Judge0** (`judge0/docker-compose.yml`, `judge0.conf.example`): `docker-compose config` sạch, kéo ảnh, bốn container lên, `X-Auth-Token` đúng→200 / sai→401. **Bài nộp trả `Internal Error … /box/script.py`** vì `isolate` của Judge0 1.13 cần **cgroup v1** mà máy thử (WSL2 Ubuntu 24.04) là cgroup v2; không đổi kernel WSL vì sẽ khởi động lại các container khác của chủ máy. Adapter Judge0 vẫn chỉ được chạy thật với Judge0 CE công cộng. Cách bật cgroup v1 ghi ở `deploy/code-runner/README.md`.
Lưu ý máy này: cổng publish `127.0.0.1` trong WSL không tới được Windows → `PISTON_BIND=0.0.0.0`; WSL tự tắt khi không còn tiến trình `wsl`; `docker-compose` v1.29 hỏng khi tạo lại container (`ContainerConfig`) → `down` rồi `up`. Ảnh Piston (~1 GB) và `alpine` còn trong Docker; đã gỡ container/ổ dữ liệu thử.

## 5. Bộ đếm bền
Cổng `RateLimiter` (port) + adapter `memory` | `database` (MySQL `ON DUPLICATE KEY UPDATE`, SQLite `ON CONFLICT`) | `mongo` (`$inc` upsert + chỉ mục TTL); chọn bằng `RATE_LIMIT_BACKEND = memory|database|mongo|auto` (`auto`: `database` khi `DB_URL` là MySQL thật và không phải pytest; **không bao giờ tự chọn mongo**). Dùng cho `/run`, tạo không gian, khoá sai, đọc liên kết, token sai; `/ai/*`, khoá học, đấu trường **chưa đổi** (vẫn trong bộ nhớ).
Cửa sổ là xô `cửa sổ/6` (không bao giờ lỏng hơn cấu hình, có thể chặn lâu hơn tối đa 1/6 cửa sổ: `/run` 20/phút có thể chờ tới 70 s). Khoá lưu SHA-256 (không IP thô). Lỗi kho/quá 2 s → **fail-open** có kiểm soát (một dòng cảnh báo, đếm trong bộ nhớ 30 s rồi thử lại). Mỗi `/run` tốn thêm 2 truy vấn CSDL khi `database`.
Kiểm: 52+24 test, `tools/kiem_bo_dem_that.py` qua `kiem_mysql_that.py` (MariaDB 12.0.2) và `kiem_mongo_that.py` (mongod 8.0.4): 100 lượt đồng thời từ hai kết nối + tiến trình con → tổng đúng 100. **Chưa thử** Aiven MySQL thật (cấm) và nhiều instance Vercel thật.
Phát hiện thêm: lỗi có sẵn ở `list_items` (hai `PUT` trùng mili-giây `serverUpdatedAt` làm một trang kết thúc giữa hai bản → rơi mất bản sau) — đã sửa + test hồi quy.

## 6. CI
`.github/workflows/webapp-ci.yml`: job `logic` (node `kiem-tat.js` mọi app viết tay, `sync.py --kiem`, `heuristic-practice-2/kiem.js`) rồi job `browser` ma trận **chromium / firefox / webkit** (Playwright `--with-deps`) chạy `code-studio/check.py` và `heuristic-practice-2/check.py` trên backend thật. Pytest vẫn ở `fastapi-ci.yml` (có sẵn, 3 phiên bản Python). Ngưỡng phép kiểm thời gian nhân `CS_PERF_SLACK=4` (máy CI chậm). Lệnh gỡ lỗi cục bộ: giống các bước trong tệp.
**Đã chạy lại các bước trên Ubuntu 24.04** (container Docker, apt: Node 18.19, Python 3.12, g++ 13, JDK 21; `pip install -r requirements-dev.txt`; `playwright install --with-deps chromium`): `kiem-tat.js` 1723 phép, `sync.py --kiem` khớp, `heuristic-practice-2/kiem.js` 294, `heuristic-practice-2/check.py` 61/61, `code-studio/check.py` **100/100 trên Chromium** (kể cả chạy C++ bằng g++ thật và Java có package bằng javac thật). Lần chạy đầu bắt được một lỗi chỉ có trên Linux/Node cũ: `kiem-du-an.js` dùng `DecompressionStream("deflate-raw")` (Node < 21.2 không có) → đã cho các phép kiểm đó tự bỏ qua khi thiếu. Firefox/WebKit đạt trên Windows (100 / 98+1 bỏ qua) nhưng **chưa chạy trên Linux**; `actions/*` dùng đúng phiên bản các workflow có sẵn (`checkout@v7`, `setup-python@v7`, `cache@v6`) — chưa xác nhận trên GitHub.

## 7. Liên kết chia sẻ chỉ đọc
Backend: `POST/DELETE /codestore/{ws}/items/{id}/share`, `GET /codestore/{ws}/shares`, `GET /codestore/shared/{token}` công khai (xem `docs/code-studio-api.md` §2: bản **chụp**, token 128 bit giữ nguyên khi cập nhật, ≤ 50 liên kết/không gian, thu hồi khi xoá bản ghi/không gian, giới hạn đọc 120/phút/IP, token sai 20/10 phút).
Giao diện: menu ⋯ / bảng lệnh "Chia sẻ liên kết chỉ đọc…" (cần đã bật đồng bộ; tạo → lưu + đẩy mục lên → chụp; chép/mở/cập nhật/thu hồi, danh sách các liên kết khác). Liên kết `…/code-studio/index.html#share=<token>&backend=<kho>` — token **sau `#`** (không vào nhật ký/Referer). Mở ra trang **chỉ xem** (không dựng IDE, không đụng thư viện/IndexedDB/localStorage của người xem, đúng một lời gọi `GET shared`, `noindex`, chặn Backspace trên WebKit vì ô chỉ-đọc bị coi là "Quay lại"), nút "Nhân bản về thư viện của tôi" → `#clone=…` → IDE nhập thành mục **mới** (id mới, tên + " (bản chia sẻ)").
`store.js`: `sync.share/shares/unshare` (khoá không rời bộ đồng bộ), `CS.store.readShared`; thông báo lỗi riêng (`codestore_share_not_found`, `…item_not_found`, `…too_many_shares`).

## Sửa lỗi sau bàn giao: "không có máy chủ API" dù mở qua backend
Chủ dự án báo hộp "Nơi lưu" nói trang mở trực tiếp, không đồng bộ được. Nguyên nhân: `.env` máy này đặt `API_PREFIX=` (rỗng) nên backend chèn `apiBase: ""`, mà Code Studio (và IDE heuristic) coi **chuỗi rỗng = không có máy chủ** → tắt đồng bộ, danh sách nơi chạy máy chủ, AI, chia sẻ. Lỗi có từ 15/10, bị che vì `check.py` luôn ép `/api/v1`. Sửa: có-máy-chủ = có `__WEBAPP_CONFIG__` được chèn (`A.HAS_API`); `apiBase` rỗng là hợp lệ (route ở gốc). Thêm phép kiểm: node (URL từ apiBase rỗng cho readShared/sync/runner/AI) và `check.py` dựng backend `API_PREFIX=""` (nạp nơi chạy, hộp Nơi lưu, tạo không gian đồng bộ) — Edge/Firefox 103, WebKit 101+1 bỏ qua. Việc cần làm trên máy bạn: mở `http://localhost:6789/webapp/tranphuc8a/code-studio/` (không phải file:// hay Live Server), rồi "Nơi lưu & đồng bộ" → "Máy này + đồng bộ máy chủ" → chọn kho → "Tạo không gian mới".

## Chạy và kiểm
```bash
node backend/fastapi/webapp/tranphuc8a/code-studio/kiem.js                   # 960 phép (CS_PERF_SLACK=4 nếu máy chậm)
node backend/fastapi/webapp/tranphuc8a/code-studio/kiem-tich-hop.js          # 99 phép, backend thật json + mysql(SQLite) + chia sẻ
cd backend/fastapi && .venv/Scripts/python.exe webapp/tranphuc8a/code-studio/check.py [--trinh-duyet=firefox|webkit] [--anh]   # 100 phép
.venv/Scripts/python.exe webapp/courses/heuristic-practice-2/check.py        # 61 phép
.venv/Scripts/python.exe -m pytest -q                                        # 1705 đạt, 4 bỏ qua
```
Sau khi sửa mã dùng chung: `python webapp/tranphuc8a/code-studio/sync.py` (chép sang `heuristic-practice-2/assets/cs/`).

## Còn nợ / cần chủ dự án quyết
- **Gemini thật** cho `/ai/code/explain`: chưa gọi (cần đồng ý rõ ràng, tốn quota). Nên thử vài lỗi thật rồi chỉnh prompt nếu cần.
- **Judge0 tự dựng chạy được mã** chưa kiểm: cần máy cgroup v1 (xem mục 4); tên các khoá trong `judge0.conf.example` về giới hạn thời gian/bộ nhớ chưa đo hiệu lực.
- CI chưa chạy trên GitHub (xem mục 6); các bước đã được chạy lại trên Ubuntu 24.04 (container). Lần đầu trên GitHub nên xem job `browser · firefox/webkit` (chưa thử trên Linux).
- Dùng bộ đếm `database` ở môi trường thật: đặt `RATE_LIMIT_BACKEND` rõ ràng; kiểm sau khi deploy vì chưa thử Aiven/Vercel.
- Chưa làm (ý tưởng cũ): đồng bộ cài đặt giữa thiết bị, gập mã/đa con trỏ/chọn giao diện, báo thiếu ngoặc khi gõ, nối lab chấm điểm của heuristic với "Máy chủ".
- Bộ test chưa có nhập/xuất hàng loạt (dán nhiều ca một lần) — chỉ thêm từng ca.

## Commit (cục bộ, chưa push)
- `e8144ce` test(code-studio): chờ kho lưu dựng xong sau khi tải lại trang nhân bản
- `8c75cb6` feat(deploy,ci): nơi chạy mã tự dựng (Piston, Judge0) và CI cho webapp
- `d4b46d6` test(code-studio): bỏ qua phép kiểm deflate-raw khi Node chưa hỗ trợ
- `6b8703c` feat(code-studio): bộ test, AI giải thích lỗi, liên kết chia sẻ chỉ đọc
- `17a0b67` feat(backend): giải thích lỗi bằng AI, bộ đếm tốc độ bền, liên kết chia sẻ chỉ đọc, meta 32 KB
- (commit sau cùng) `docs: bàn giao 17/10` — tệp này, `docs/code-studio-api.md`, skill `ban-do-ung-dung`.

Ba commit của đợt 16/10 (`32a2aaf`, `f0d497f`, `de9bb76`) cũng chưa push. Không đụng `heuristic-3.json`, `tasks/2610/261010/coucoh/` (việc khác của chủ dự án).
Docker: ảnh `ghcr.io/engineer-man/piston` (986 MB) còn lại trong Docker của WSL — gỡ bằng `docker rmi` nếu không dùng.
