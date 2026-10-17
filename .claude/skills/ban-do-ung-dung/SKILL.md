---
name: ban-do-ung-dung
description: Bản đồ mọi ứng dụng web của dự án gemini_proxy — mỗi app làm gì, viết tay hay bản build, mã nguồn nằm đâu, dùng API nào, kiểm bằng gì, đã có AI gì, đang ở trạng thái nào. Đọc trước khi sửa, thêm tính năng hay tìm hiểu bất kỳ app nào (chi tiêu, khoá học, OPIc, markdown, JSON, SQL/Mongo, Postman, chat, đấu trường, lab…).
---

# Bản đồ ứng dụng (cập nhật 2026-10-17)

Gốc phục vụ: `backend/fastapi/webapp/` → URL `/webapp/<đường dẫn>/`. `/webapp/` chuyển về cổng `_portal/portal.html`.
**V** = viết tay (nguồn = bản phục vụ, không build). **B** = bản build React/Vite (nguồn ở thư mục gốc repo, xuất bản bằng
`node scripts/build-webapps.mjs --only <tên>`). **T** = mã nhập từ bên thứ ba. Kiểm: xem `CLAUDE.md` mục lệnh.

## 1. Ứng dụng của chủ dự án

| Đường dẫn (dưới `webapp/`) | Làm gì | Loại · nguồn | API dùng | Kiểm | AI hiện có | Trạng thái / ghi chú |
| --- | --- | --- | --- | --- | --- | --- |
| `tranphuc8a/quan-ly-chi-tieu` | Sổ chi tiêu: nhập một dòng, chia tiền theo người/**nhóm**, báo cáo, ngân sách, định kỳ, tiết kiệm, PWA | V · chính nó | `/spending/*`, `/ai/spending` | `kiem.js` (520), `quan-ly-chi-tieu/selftest/run.py`, pytest `/spending` | Nhập từ văn bản → giao dịch (`/ai/spending`) | Xong 06–08/10; 15/10: sổ "Các khoản chung" lọc theo **khoảng ngày** (Từ/Đến + chọn nhanh 7/30 ngày, tháng, năm; ‹ › dịch theo độ dài khoảng); 17/10: phần chi tiết của bộ lọc **gập được** (nút "Bộ lọc" + huy hiệu, mặc định gập, nhớ theo máy), trần dung lượng 360 KB. Còn nợ: thử Gemini thật, Mongo/MySQL thật, Safari/iOS. Bàn giao `tasks/2610/261004/quan-ly-chi-tieu/ban-giao.md` |
| `tranphuc8a/markdown-editor-pro` | Soạn markdown: split/preview, sidebar tệp (ngăn kéo trên điện thoại), chế độ đọc (`?read=1`, Ctrl+Alt+V), xuất MD/HTML/PDF/PNG, đồng bộ máy chủ, hộp thư `?import=1` | B · `markdown-editor/` | `/markdown/*`, `/ai/markdown`, `/ai/status`, `/ai/models` | vitest (21 tệp, 367 test), `markdown-editor/scripts/kiem-pwa.py` (PWA offline, Edge + server thật), `scripts/audit-webapps.mjs` | **✨ Smart format** (chọn đoạn/cả tài liệu → xem trước → thay, hoàn tác 1 bước) | Xong 08–09/10: responsive điện thoại, chế độ đọc, AI. 17/10: **PWA cài về máy, chạy offline** (menu File → Install app / use offline; `sw.js` sinh lúc build bằng `scripts/make-sw.mjs`, lưu đủ 425 tệp ≈ 5,5 MB gồm chunk mermaid/PDF; offline vẫn sửa được nếu trước đó đã mở khoá quản trị — chỉ khi thiết bị thật sự mất mạng). Chưa thử Gemini thật. Bàn giao `markdown-editor/BAN-GIAO-RESPONSIVE-READING.md` + `tasks/2610/261008/…` |
| `tranphuc8a/code-studio` | **IDE trên web**: đoạn mã một tệp + dự án nhiều tệp (cây thư mục, tệp chính), 19 ngôn ngữ tô màu, gợi ý khi gõ, định dạng (tự viết / clang-format / Prettier / Ruff chọn được), chạy do người dùng chọn (trình duyệt: Clang-WASM/Pyodide/JS · máy chủ: Piston/Judge0/Wandbox/`local` · Piston tự dựng), C/C++ nhiều tệp, Java có package, xuất/nhập .zip, lưu máy này hoặc đồng bộ JSON/MySQL/MongoDB, **bộ test** (nhiều ca vào→đáp án, AC/WA/TLE/RE/CE, lưu trong `meta.tests`), **AI giải thích lỗi** (`/ai/code/explain`, đề xuất sửa xem trước rồi mới áp), **liên kết chia sẻ chỉ đọc** (`index.html#share=…`, nhân bản về thư viện) | V · chính nó (`assets/core` thuần + `assets/ui` + `assets/run`); mã dùng chung chép sang heuristic-practice-2 bằng `sync.py` | `/run/*`, `/codestore/*`, `/ai/code/explain` | `kiem.js` (960 phép; `CS_PERF_SLACK=4` cho máy chậm), `kiem-hinh.py code-studio`, `check.py [--wasm] [--trinh-duyet=firefox|webkit]` (100 phép, đủ 3 trình duyệt), `kiem-tich-hop.js` (backend thật) | không | Mới 15/10, PWA 16/10 (cài được, mở offline), bộ test + AI + chia sẻ + CI 17/10. Đã kiểm trên Edge/Firefox/WebKit, Wandbox + Judge0 CE thật, MariaDB + MongoDB thật (`backend/fastapi/tools/kiem_*_that.py`). Bàn giao `tasks/2610/261017/code-studio/ban-giao.md` (và `261015/` cho đợt đầu); API `docs/code-studio-api.md`. Nơi chạy tự dựng (Piston **đã chạy thật**, Judge0): `deploy/code-runner/`. Chưa gọi Gemini thật cho AI (cần chủ dự án đồng ý); công cộng emkc.org đã whitelist-only |
| `tranphuc8a/json-editor` | Soạn/cây/truy vấn/so sánh/thống kê JSON | V · chính nó | không | `kiem.js` (133), `kiem-hinh.py json-editor` | không (chưa AI-hoá: sửa JSON hỏng, giải thích cấu trúc) | Xong 08/10: sửa/đổi tên/thêm/xoá/đổi chỗ ngay trên cây (hoàn tác 100 bước), nút đóng hiện tóm tắt (`name: "Phúc"`), tô màu cú pháp ở chế độ soạn, theo `prefers-color-scheme` |
| `tranphuc8a/gemini-chat` | Chat Gemini streaming, so sánh hai model, mở trong Markdown Editor | B · `frontend/` | `/gemini/*`, `/conversations`, `/ai/chat`, `/ai/models` | vitest (16 tệp) | Chat, so sánh model, **chọn model động** | Danh sách model lấy từ máy chủ (hook `useAiModels`); lựa chọn chung `ai.model@<gốc API>`; model lạ → 400 (không còn lặng lẽ về 2.5-flash) |
| `tranphuc8a/sql-administrator` | Quản trị MySQL | B · `sql-administrator/` | `/sqladmin/*`, `/ai/sql` | vitest (9 tệp) | ✨ Hỏi AI → SQL | Cần phiên SQL admin; AI chưa chạy trên DB thật |
| `tranphuc8a/mongo-administrator` | Quản trị MongoDB | B · `mongo-administrator/` | `/mongoadmin/*`, `/ai/mongo` | vitest (9) | ✨ Hỏi AI → find/aggregate | như trên |
| `tranphuc8a/postman-lite-pro` | Máy khách API kiểu Postman | B · `postman-lite/` | `/proxy/*`, `/postman/*`, `/ai/http` | vitest (5) | Giải thích response, sinh test `pm.*` | worker chạy test còn khe `import()` cần CSP |
| `tranphuc8a/graphuc` | Vẽ đồ thị cho cấu trúc dữ liệu/thuật toán | B · `graphuc/` | `/graphs` | vitest (5) | không | — |
| `tranphuc8a/casio-fx580vnx` | Giả lập máy tính Casio fx-580VN X | B · `casio-fx580vnx/` | không | vitest (3) | không | — |
| `tranphuc8a/chi-tieu` | Sổ chi tiêu offline **cũ** (khác `quan-ly-chi-tieu`) | V | không | `kiem.js` | không | Không đụng; giữ nguyên |
| `tranphuc8a/design-pattern` | Tra nhanh mẫu thiết kế | V | không | `kiem.js` | không | Tài liệu tham khảo |
| `tranphuc8a/light-grid-{v1,v2,v3,shared}` | Trò Lights Out: playground / lab / GF(2) | V | không | — | không | — |
| `tranphuc8a/{markdown-editor,heuristic-course,system-design-course,courses}` | Bản cũ/bản sao còn sót | — | — | — | — | Lỗi thời; đừng sửa, hỏi trước khi xoá |

## 2. Khoá học và công cụ học (xem skill `khoa-hoc-engine`)

| Đường dẫn | Làm gì | Loại | API | Kiểm | AI hiện có |
| --- | --- | --- | --- | --- | --- |
| `courses/khoa-hoc` | Thư viện: đọc **mọi** khoá trong database (`?khoa=<slug>`) | V · engine | `/courses/*`, `/ai/*` | `check.py` | Trợ giảng (bài + cả khoá), ôn tập AI chấm, gợi ý bài tập, sổ tay→ôn |
| `courses/{ai-everything,heuristic,heuristic-2,system-design}-course` | Mỗi khoá một trang (slug `ai-everything`, `heuristic`, `heuristic-2`, `system-design`) | V · engine | như trên | `check.py` | như trên |
| `courses/opic-course` | Luyện nói OPIc: 185 script, thẻ Leitner, thi thử, ghi âm | V · app riêng (không dùng engine) | `/courses/opic/bundle`, `/ai/opic`, `/ai/opic/script` | `check.py`, `kiem-nhanh.js` | Nhận xét bản ghi; **nhận xét script viết** |
| `courses/quan-ly-khoa-hoc` | CMS khoá học (quản trị) + soạn khoá bằng AI + tab AI | V | `/courses` (admin), `/ai/draft/*`, `/ai/usage`, `/ai/models` | `check.py` | Soạn khoá (dàn ý → bài), **trợ lý đoạn chọn** (viết lại/mở rộng/dịch/câu hỏi/bài tập), chọn model |
| `courses/heuristic-practice-2` | **Thực hành song song** khoá heuristic-2: 32 trang (đầu vào, 28 bài, 3 ca) × trắc nghiệm / tự luận tự chấm / lab chấm tự động (JS hoặc C++) / ghi chú; **IDE** (trình soạn dùng chung với Code Studio: gợi ý, định dạng, tìm/thay; **nơi chạy chọn được**: C/C++ Clang→WebAssembly offline (nạp `@yowasp/clang` lần đầu ≈ 25 MB) / JS Worker / máy chủ `POST /run` (thêm Java, Python) / Piston tự dựng; thư viện đoạn mã tìm/ghim/xuất nhập, đồng bộ tuỳ chọn); PWA | V · app riêng, không build, không API | không bắt buộc (tĩnh; chỉ khi bật "Máy chủ"/đồng bộ trong IDE mới gọi `/run`, `/codestore`) | `kiem.js` (logic + nội dung + mọi lab), `check.py [--cpp]`, `sync.py --kiem` (bản sao `assets/cs/`) | không (tự luận tự chấm) | Xong 10/10. Nội dung `data/<id>.js` (soạn theo `data/HUONG-DAN-SOAN.md`); liên kết hai chiều với `heuristic-course-2` (module `engine/mo-lien-ket.js`) và `heuristic-visual-2`. Bàn giao `tasks/2610/261010/heuristic-thuc-hanh/ban-giao.md` |
| `courses/lab-visual` + `*-visual` | 39 lab canvas nhúng trong bài | V (vis-core v2; 3 trang *-visual ở engine v1, cố ý không đồng bộ) | không | `check.py`, `kiem-so.js` | không (chỗ còn trống: giải thích lab theo trạng thái) |
| `dau-truong-thuat-toan` | Đấu trường thuật toán (TSP heuristic), bảng xếp hạng | V | `/arena/*` | `check.py` | không (chỗ còn trống: nhận xét mã, giải thích điểm) |

## 3. Khác

| Đường dẫn | Ghi chú |
| --- | --- |
| `_portal` | **Cổng launcher (PWA)** — viết lại hoàn toàn 17/10, JS/CSS thuần không build. Trang chủ chia phần (Yêu thích, Mở gần đây, Ứng dụng của tôi, Khoá học, Thư viện gập theo thư mục — cấu hình ở `portal.config.json`), tab Tất cả/Yêu thích/Đã ẩn, tìm kiếm không dấu (`#tag`, `@thư-mục`, `loai:`), bộ lọc (thanh bên máy tính / tờ trượt điện thoại), lưới ⇄ danh sách, mật độ, ghim, ẩn, chi tiết + **mã QR** (tự viết, `core/qr.js`), phím tắt, Ctrl+K (app + khoá học + bài học + lab + hỏi AI), xuất/nhập dữ liệu, PWA offline (`sw.js`, đóng dấu bằng `tao-pwa.py`). Thẻ cố định kích thước; điện thoại: thanh dưới, lưới thành ô vuông. Kiểm: `kiem.js` (86 phép logic thuần), `check.py` (171 phép: tĩnh · chức năng · co giãn dữ liệu xấu nhất 3 engine · PWA). `/webapp/_api/list` có thêm `updated` (mtime) và `pwa` (có manifest + sw.js). Bàn giao `tasks/2610/261017/portal-moi/ban-giao.md` |
| `gemini-chat`, `postman-lite-pro`, `markdown-editor` (cấp trên cùng) | Bản build **cũ**, thay bởi `tranphuc8a/…` |
| `wukong-xiangqi-main` | Cờ tướng (T + chế độ "mỗi ngày" viết tay). `check.py` |
| `50projects50days-master`, `html-css-javascript-{calculator,games,projects}-main` | Bộ demo bên thứ ba, bỏ qua |
| máy tính/trò chơi/công cụ nhập ngoài | `AdvancedCalculator-main`, `Calculator_pro-main`, `Casio-Web-Calculator-master`, `scientific-calculator-master`, `calculators/*`, `games/*` (2048, Chess, gomoku, tic-tac-toe, mini-caro), `radar-undead-main`, `web-chess-main`, `xiangqi-master`, `mini-caro-2`, `tools/*`; không có backend/AI |

## 4. Cổng AI — việc nào do endpoint nào (mọi cái đi qua `AiUseCase.ask`)

| Endpoint | Việc | Quyền | Nơi gọi |
| --- | --- | --- | --- |
| `GET /ai/status`, `POST /ai/session`, `GET /ai/models` | trạng thái, đổi mã truy cập lấy token, danh sách model | công khai | mọi trang AI |
| `POST /ai/tutor` | tóm tắt/giải thích/trắc nghiệm/thẻ/hỏi trên bài | `AI_ACCESS` | `engine/mo-ai.js` |
| `POST /ai/ask` | hỏi cả kho hoặc **một khoá** (`course`) kèm nguồn | `AI_ACCESS` | `mo-ai.js`, `_portal/palette.js` |
| `POST /ai/review` | chấm câu trả lời thẻ ôn tập (0–5, SM-2) | `AI_ACCESS` | `engine/mo-on-tap.js` |
| `POST /ai/hint` | gợi ý 3 mức cho bài tập code không đạt | `AI_ACCESS` | `engine/hien-thi.js` + `mo-ai.js` |
| `POST /ai/notes` | sổ tay → tóm tắt/sinh thẻ | `AI_ACCESS` | `engine/mo-so-tay.js` |
| `POST /ai/opic`, `/ai/opic/script` | nhận xét bản ghi / script viết | `AI_ACCESS` | `opic-course` |
| `POST /ai/draft/{outline,lesson}` | soạn khoá bằng AI | quản trị | `quan-ly-khoa-hoc/soan-ai.js` |
| `POST /ai/draft/assist` | trợ lý trên đoạn chọn | quản trị | `quan-ly-khoa-hoc/soan.js` |
| `POST /ai/markdown` | định dạng thông minh | `AI_ACCESS` | `markdown-editor-pro` |
| `POST /ai/spending` | văn bản → giao dịch | `AI_ACCESS` | `quan-ly-chi-tieu/assets/ai.js` |
| `POST /ai/sql`, `/ai/mongo`, `/ai/http` | NL→SQL/Mongo, giải thích/sinh test HTTP | `AI_ACCESS` (+ phiên DB) | các app quản trị/Postman |
| `POST /ai/code/explain` | giải thích lỗi biên dịch/chạy: tóm tắt, mục (dòng, vì sao, cách sửa), `patch` một đoạn tuỳ chọn (đã kiểm trong tệp, ≤ 40 dòng); cache theo mã+lỗi+model | `AI_ACCESS` | `code-studio` (nút "AI giải thích lỗi") |
| `GET /run/providers`, `POST /run` | chạy mã qua Piston/Judge0/Wandbox/`local` (provider chọn bằng id; giới hạn 20 lượt/phút/IP, đếm chung giữa các instance khi `RATE_LIMIT_BACKEND`=`database`/`mongo` — `auto` chọn `database` với MySQL thật; `local` cần phiên quản trị) | công khai (+ quản trị cho `local`) | `code-studio`, IDE của heuristic-practice-2 |
| `/codestore/*` | kho đoạn mã/dự án đồng bộ (không gian + khoá bí mật; kho json/mysql/mongo) | khoá không gian | `code-studio`, IDE của heuristic-practice-2 |
| `POST/GET/DELETE /codestore/{id}/items/{itemId}/share`, `GET /codestore/{id}/shares`, `GET /codestore/shared/{token}?backend=` | liên kết chia sẻ **chỉ đọc** một bản ghi: chụp ẢNH (snapshot) bản đang lưu trên máy chủ (phải đồng bộ trước), token 128 bit giữ nguyên khi chia sẻ lại, ≤ 50 liên kết/không gian, xoá bản ghi/không gian thì thu hồi; đọc không cần khoá (bỏ `pinned/openTabs/activeFile`, 120 lượt/phút/IP, token sai 20/10 phút) | tạo/liệt kê/thu hồi: khoá không gian; đọc: công khai (token là khoá) | `code-studio` (hộp thoại chia sẻ + trang xem `#share=` + nhân bản `#clone=`); API `docs/code-studio-api.md` mục "Liên kết chia sẻ chỉ đọc" |
| `POST /ai/chat`, `/gemini/{query,stream}` | so sánh model / chat | `AI_ACCESS` / công khai | `gemini-chat` |
| `GET /ai/usage` | số liệu lượt/token | quản trị | `quan-ly-khoa-hoc` tab AI |

Chọn model: header `X-AI-Model` (xem skill `them-tinh-nang-ai`). Khoá `localStorage`: `ai.model@<gốc API>` (chung mọi trang),
`ai.phien@<gốc API>` (token mã truy cập), `qlkh.phien@<gốc API>.token` (phiên quản trị).

## 5. Nợ kỹ thuật và việc chưa làm (đọc trước khi hứa tính năng)

- AI chưa được thử với Gemini thật ở `quan-ly-chi-tieu` (chất lượng tách câu) và các tính năng học tập mới; chỉ có test với model giả.
- `/ai/sql`, `/ai/mongo` chưa chạy trên DB thật. Pyodide chưa thử trực tiếp (bài tập Python cần mạng lần đầu ~10 MB).
- Khoá học: P2 #16–20 (tài khoản/vai trò, xuất bản theo lịch, thống kê người học, import/export Git, đồng bộ tiến độ) chưa làm; tiến độ học nằm ở `localStorage`.
- OPIc: thiếu bài diễn về phim (AR17–19), chủ đề đi bộ mới 3 câu.
- Chưa AI-hoá: lab trực quan, đấu trường, bài thi thử OPIc, lộ trình học cá nhân hoá, sửa JSON hỏng bằng AI.
- Chưa xác nhận bản deploy có HTTPS (PWA cần). `/storage/backends` công khai tên DB/host (ngoài phạm vi, chưa sửa).

Tài liệu gốc: `docs/nang-cap-tinh-nang-ban-giao.md`, `docs/khoa-hoc-database-ban-giao.md`, `docs/opic-course-ban-giao.md`,
`docs/web-lab-dot-9-ban-giao.md`, `docs/webapp-runtime-config.md`, `tasks/2610/261004/quan-ly-chi-tieu/ban-giao.md`.
