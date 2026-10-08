---
name: ban-do-ung-dung
description: Bản đồ mọi ứng dụng web của dự án gemini_proxy — mỗi app làm gì, viết tay hay bản build, mã nguồn nằm đâu, dùng API nào, kiểm bằng gì, đã có AI gì, đang ở trạng thái nào. Đọc trước khi sửa, thêm tính năng hay tìm hiểu bất kỳ app nào (chi tiêu, khoá học, OPIc, markdown, JSON, SQL/Mongo, Postman, chat, đấu trường, lab…).
---

# Bản đồ ứng dụng (cập nhật 2026-10-08)

Gốc phục vụ: `backend/fastapi/webapp/` → URL `/webapp/<đường dẫn>/`. `/webapp/` chuyển về cổng `_portal/portal.html`.
**V** = viết tay (nguồn = bản phục vụ, không build). **B** = bản build React/Vite (nguồn ở thư mục gốc repo, xuất bản bằng
`node scripts/build-webapps.mjs --only <tên>`). **T** = mã nhập từ bên thứ ba. Kiểm: xem `CLAUDE.md` mục lệnh.

## 1. Ứng dụng của chủ dự án

| Đường dẫn (dưới `webapp/`) | Làm gì | Loại · nguồn | API dùng | Kiểm | AI hiện có | Trạng thái / ghi chú |
| --- | --- | --- | --- | --- | --- | --- |
| `tranphuc8a/quan-ly-chi-tieu` | Sổ chi tiêu: nhập một dòng, chia tiền theo người/**nhóm**, báo cáo, ngân sách, định kỳ, tiết kiệm, PWA | V · chính nó | `/spending/*`, `/ai/spending` | `kiem.js` (498), `quan-ly-chi-tieu/selftest/run.py`, pytest `/spending` | Nhập từ văn bản → giao dịch (`/ai/spending`) | Xong 06–08/10. Còn nợ: thử Gemini thật, Mongo/MySQL thật, Safari/iOS. Bàn giao `tasks/2610/261004/quan-ly-chi-tieu/ban-giao.md` |
| `tranphuc8a/markdown-editor-pro` | Soạn markdown: split/preview, sidebar tệp, xuất MD/HTML/PDF/PNG, đồng bộ máy chủ, hộp thư `?import=1` | B · `markdown-editor/` | `/markdown/*` | vitest (10 tệp), `scripts/audit-webapps.mjs` | **Định dạng thông minh** (`/ai/markdown`, đợt 08/10) | Đợt 08/10: sửa responsive điện thoại + chế độ đọc (`?read=1`) + AI format |
| `tranphuc8a/json-editor` | Soạn/cây/truy vấn/so sánh/thống kê JSON | V · chính nó | không | `kiem.js` (58+), `kiem-hinh.py json-editor` | không | Đợt 08/10: sửa được ở chế độ cây, tóm tắt khi đóng nút, tô màu cú pháp |
| `tranphuc8a/gemini-chat` | Chat Gemini streaming, so sánh hai model, mở trong Markdown Editor | B · `frontend/` | `/gemini/*`, `/conversations`, `/ai/chat`, `/ai/models` | vitest (16 tệp) | Chat, so sánh model, **chọn model động** | Danh sách model lấy từ máy chủ (không còn ghim 2.5) |
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
| `courses/lab-visual` + `*-visual` | 39 lab canvas nhúng trong bài | V (vis-core v2; 3 trang *-visual ở engine v1, cố ý không đồng bộ) | không | `check.py`, `kiem-so.js` | không (chỗ còn trống: giải thích lab theo trạng thái) |
| `dau-truong-thuat-toan` | Đấu trường thuật toán (TSP heuristic), bảng xếp hạng | V | `/arena/*` | `check.py` | không (chỗ còn trống: nhận xét mã, giải thích điểm) |

## 3. Khác

| Đường dẫn | Ghi chú |
| --- | --- |
| `_portal` | Cổng liệt kê app (`/webapp/_api/list`), Ctrl+K có "Hỏi AI" (`/ai/ask`). `check.py` |
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
