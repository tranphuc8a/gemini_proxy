# Nâng cấp tính năng nền tảng (Phase 0–7) — bàn giao

**Ngày:** 2026-10-03 · **Nhánh:** `lab/261003_2` · **Claude không commit** (một phần đã được stage /
commit từ phía người dùng trong lúc làm).

Yêu cầu: "Làm tất cả, tiến hành tuần tự" — toàn bộ danh sách ý tưởng tính năng đã đề xuất, mỗi phase
phải chạy được và có kiểm thử. Tài liệu này nén ngữ cảnh để phiên sau làm tiếp mà không phải đọc lại
lịch sử.

---

## 1. Đã làm gì

| Phase | Tính năng | Ở đâu |
| --- | --- | --- |
| 0 | **Cổng AI chung** — mọi lời gọi Gemini qua `AiUseCase.ask`: công tắc, quyền (`admin`/`code`/`public`), giới hạn theo địa chỉ, ngân sách ngày trong DB, sổ sách theo tính năng, cache 30 ngày | `src/application/usecases/ai_usecase.py`, bảng `ai_usage`/`ai_cache` (migration `0005`) |
| 1 | **Lab nhúng trong bài** (khối ` ```lab `) + lab → bài liên quan · **PWA / offline** cho 7 trang (service worker ở gốc trang, manifest, biểu tượng) | `engine/hien-thi.js`, `engine/sw.js`, `pwa.js`, `tao_pwa.py`, `kiem_pwa.py` |
| 2 | **Trợ giảng AI** cạnh bài (tóm tắt, giải thích đoạn bôi đen, trắc nghiệm, thẻ, hỏi có trích bài) · **Soạn khoá bằng AI** từ chủ đề / văn bản / URL (tải an toàn SSRF) / PDF → khoá nháp | `mo-ai.js`, `ai_course_usecase.py`; `quan-ly-khoa-hoc/assets/soan-ai.js`, `ai_draft_usecase.py`, `safe_web_fetcher.py` |
| 3 | **Ôn tập SM-2** (thẻ từ AI, "Hôm nay cần ôn N thẻ") · **Luyện nói OPIc có AI chấm** (ghi âm WAV ≤ 90 s → bản ghi, cấp độ, 5 điểm, sửa lỗi) · **Ctrl+K toàn cổng** (ứng dụng, khoá, bài, lab) + **Hỏi AI** có trích bài | `mo-on-tap.js`; `opic-course/assets/app.js`, `ai_speaking_usecase.py`; `_portal/palette.js`, `GET /courses/search`, `POST /ai/ask` |
| 4 | **Mô phỏng kiến trúc hệ thống** (lab `kien-truc`: hàng đợi M/M/c, Erlang C, Monte Carlo p50/p99) · **Chạy Python/JS trong bài** + bài tập tự chấm (` ```py-chay `, ` ```js-bai-tap ` + `---kiem---`) | `lab-visual/assets/lab-kientruc.js`; `engine/hien-thi.js` (Worker, Pyodide v0.26.4 từ jsdelivr) |
| 5 | **Bản đồ kiến thức** (`GET /courses/{slug}/graph`, BFS đường học) · **Sổ tay / tô sáng** (CSS Highlight API, xuất .md, mở trong Markdown Editor) · **Chế độ đọc** (cỡ chữ, giãn dòng, Noto Serif, đọc to vi-VN) · **Thành tích** (chuỗi ngày, 11 huy hiệu, chứng chỉ in được) | `mo-ban-do.js`, `mo-so-tay.js`, `mo-doc.js`, `mo-thanh-tich.js` |
| 6 | **Công cụ dev có AI**: SQL bằng lời (đọc schema, EXPLAIN, xác nhận trước khi ghi) · Mongo bằng lời · Postman: giải thích response, sinh test `pm.*`, sửa link chia sẻ + chia sẻ 1 request qua URL · Gemini Chat: so sánh 2 model, thư viện prompt, gửi sang Markdown Editor, xem trước HTML (iframe sandbox) · Markdown Editor nhận hộp thư `?import=1` | `ai_query_usecase.py`, `ai_http_usecase.py`, `ai_chat_usecase.py`; các app React (mục 4) |
| 7 | **Đấu trường thuật toán** (TSP 60/200/1000, heuristic JS chạy trong Worker, máy chủ dựng lại đề và tự đo, bảng xếp hạng) · **Cờ tướng mỗi ngày** (đoán 8 nước của kỳ thủ, gợi ý / hỏi engine Wukong trong Worker, chuỗi ngày, chia sẻ emoji) | `webapp/dau-truong-thuat-toan/`, `arena_usecase.py` (bảng `arena_scores`, migration `0006`); `wukong-xiangqi-main/apps/wukong/gui/daily.html` + `game/daily*.js` |

---

## 2. Việc người dùng phải làm khi triển khai

1. **Database thật** (Claude không ghi vào Aiven): chạy migration `0005_ai_usage_cache` và
   `0006_arena_scores` (`alembic upgrade head`) — hoặc để `create_all` lúc khởi động tạo bảng
   `ai_usage`, `ai_cache`, `arena_scores`.
2. **Nạp lại bundle đã sửa** (`python tools/manage_courses.py import ../course-content/<tệp>.json --yes`):
   - `system-design.json` — lab nhúng ở bai-05, bai-20, bai-33, bai-29 (`kien-truc`);
   - `ai-everything.json` — 3 lab nhúng (> 4,5 MB: chỉ nạp được bằng CLI);
   - `heuristic*.json` — bai-13.
3. **Biến môi trường** (đã có trong `.env.example`): `AI_ENABLED`, `AI_ACCESS` (mặc định `admin`),
   `AI_ACCESS_CODE`, `AI_SESSION_DAYS`, `AI_MODEL`, `AI_TIMEOUT_SECONDS`, `AI_RATE_PER_MINUTE`,
   `AI_RATE_PER_DAY`, `AI_DAILY_REQUESTS`, `AI_DAILY_TOKENS`.
4. **Vercel:** thân request ≤ 4,5 MB → PDF soạn khoá và ghi âm OPIc giới hạn ~3 MB (base64). Nên
   đặt `maxDuration` cho function đủ cho lời gọi AI (`AI_TIMEOUT_SECONDS` = 90).
5. Các app React đã được build và publish vào `backend/fastapi/webapp/tranphuc8a/…` — deploy là đủ.

---

## 3. Cổng AI — quy tắc phiên sau cần giữ

- Mọi tính năng mới gọi `AiUseCase.ask(caller, "<feature>", contents=…, system=…, config=generation_config(schema=…), cache=cache_key(…), parse=…)`.
  `parse` ném `ValueError` khi model trả sai định dạng → 502 và **không cache**.
- `ask(..., model=...)` chọn model khác `AI_MODEL` (chỉ dùng cho "so sánh model"; người gọi tự kiểm
  danh sách `EModel`). `generation_config(model=…)` tắt thinking đúng theo model.
- Quyền: trang tĩnh dùng `engine/ai-khach.js`; app React có `src/lib/ai.ts` / `src/services/aiService.ts`
  cùng hợp đồng: header `X-Admin-Session` (localStorage `qlkh.phien@<gốc API tuyệt đối>.token`) và
  `X-AI-Session` (`ai.phien@<gốc>` = `{token, het}`); `canOffer = enabled && (allowed || needs === "code")`
  — chế độ chỉ-quản-trị-viên thì khách **không thấy** nút AI.
- Kiểm thử **không bao giờ** gọi Gemini thật: unit test dùng `tests/support/fake_ai.py`; kiểm trình
  duyệt dùng `kiem_khoa_hoc.MayChuThu` (trỏ `GEMINI_URL` vào `GeminiGia`, trả lời theo `responseSchema`,
  `may.gemini.tra_loi = fn` để tự trả lời).
- An toàn: `/ai/sql` phân loại câu lệnh bằng `sql_script.read_only` (chặt hơn `statement_kind`), EXPLAIN
  không bao giờ chạy câu lệnh, câu ghi phải xác nhận ở app; `/ai/mongo` gắn cờ `$out`/`$merge` và JS phía
  server; `/ai/http` che secret trong header / query / JSON / JWT và từ chối script test chạm mạng, hẹn
  giờ, eval, biến toàn cục, `constructor`/`__proto__`, escape `\u`.

---

## 4. Công cụ dev (Phase 6) — từng app

Mọi app có `src/lib/ai.ts` (Gemini Chat: `src/services/aiService.ts`) theo cùng hợp đồng ở mục 3; nút
AI ẩn khi `canOffer` sai; chế độ `code` hiện ô "Mã truy cập AI" ngay trong khung. Build + publish:
`node scripts/build-webapps.mjs --only <app>` (ghi vào `backend/fastapi/webapp/tranphuc8a/<đích>/`).

| App | Tính năng mới | Tệp chính |
| --- | --- | --- |
| **sql-administrator** | "✨ Hỏi AI" trong console: câu hỏi (+ sửa từ SQL đang có) → `POST /ai/sql` → giải thích, từng câu có nhãn *Chỉ đọc / Ghi*, *✓ MySQL đã kiểm (EXPLAIN)* / *✗ lỗi* / *Chưa kiểm*. "Chạy" chạy thẳng khi mọi câu chỉ đọc và không lỗi EXPLAIN; còn lại mở `ConfirmDialog` liệt kê câu ghi, ghi rõ `user@host / CSDL` | `src/lib/ai.ts`, `src/lib/aiSql.ts` (`needsConfirmation`), `src/components/AiSqlPanel.tsx` |
| **mongo-administrator** | "✨ Hỏi AI" ở trình duyệt tài liệu và console aggregate: find → điền filter/projection/sort/limit rồi chạy (hỏi trước nếu có JS phía server); aggregate → đưa vào console; ở console mọi câu trả lời thành pipeline (`toPipeline`). Chạy pipeline có `$out`/`$merge`/`$where`… phải xác nhận | `src/lib/aiMongo.ts`, `src/components/AiQueryPanel.tsx`, `useAiAssistant.tsx` |
| **postman-lite** | "✨ Giải thích" (tab "✨ AI" của response) · "✨ Sinh test từ response" (xem trước, *Thêm vào cuối / Thay thế / Bỏ*, không tự chạy) · link chia sẻ workspace giờ có `&backend=` và **được đọc** khi mở (hộp thoại "Nhập vào máy này", nhập thành collection mới, id mới) · **chia sẻ 1 request** qua `#req=` (base64url UTF-8, mặc định bỏ thông tin đăng nhập) · dán `curl …` vào ô URL là điền request. Worker chạy test **bị khoá mạng** (link độc không lấy được biến môi trường) | `src/lib/aiHttp.ts`, `src/lib/share.ts`, `src/components/Ai.tsx`, `src/lib/testRunner.ts` |
| **frontend (Gemini Chat)** | so sánh 2 model · thư viện prompt · gửi sang Markdown Editor · xem trước HTML trong iframe `sandbox="allow-scripts"` *(chi tiết: mục 4.1)* | `src/services/aiService.ts` |
| **markdown-editor** | mở với `?import=1` → đọc hộp thư `markdown-editor:inbox` = `{name, content, at, from}` **một lần** (xoá ngay; bỏ qua nếu cũ hơn 10 phút / hỏng), chờ biết phiên quản trị (tối đa 4 s): admin → thành tệp mới; khách → mở trong trình soạn, nhắc đăng nhập để giữ | `src/lib/inbox.ts`, `App.tsx`, `store.ts` (`importInbox`, `hydrate()` trả promise) |

---

### 4.1 Gemini Chat

- **So sánh model** (nút ở thanh tiêu đề khi đang mở một cuộc trò chuyện): prompt lấy từ ô nhập (≤ 8000),
  hai model (mặc định 2.5 Flash vs 2.5 Pro), hai `POST /ai/chat` song song, mỗi cột tự báo đang chờ / lỗi /
  câu trả lời markdown + "ms · token". Không lưu vào hội thoại; mỗi lần tính 2 lượt AI.
- **Thư viện prompt** (nút sách cạnh ô nhập): 17 mẫu sẵn trong 6 nhóm (vi + en), "Prompt của tôi" ở
  localStorage `gemini-chat:prompts`, tìm không dấu.
- **Mở trong Markdown Editor** (cả hội thoại) và **Gửi sang Markdown Editor** (một tin nhắn): cùng hộp thư
  `markdown-editor:inbox` như sổ tay khoá học; bộ dựng markdown dùng chung với "Xuất Markdown"
  (`utils/markdownExport.ts`). Chỉ chạy khi app do backend phục vụ (cùng origin với editor).
- **Xem trước HTML/SVG**: khối `html`/`htm`/`svg` có nút "Xem trước" → iframe `sandbox="allow-scripts"`
  (không `allow-same-origin`). Mermaid vốn đã `securityLevel: 'strict'`.

## 5. Kiểm thử

| Bộ | Lệnh | Kết quả |
| --- | --- | --- |
| Backend | `cd backend/fastapi && .venv/Scripts/python -m pytest -q` (Python hệ thống **không có** pytest) | **901 passed** |
| Khoá học (4 khoá + `khoa-hoc` + quản lý + OPIc) | `python webapp/courses/<trang>/check.py` | ĐẠT — gồm offline, trợ giảng, ôn tập, mã chạy được, công cụ học, **Sổ tay → Markdown Editor thật** |
| lab-visual (39 lab) · portal · đồng bộ | `python …/lab-visual/check.py` · `python webapp/_portal/check.py` · `python engine/sync.py --kiem` | ĐẠT |
| Đấu trường | `python webapp/dau-truong-thuat-toan/check.py` | ĐẠT (máy chủ tự đo, Worker bị huỷ sau 10 s, lời giải không hợp lệ bị chặn) |
| Cờ tướng mỗi ngày | `python webapp/wukong-xiangqi-main/check.py` | ĐẠT (22 mục: gợi ý, hỏi Wukong, sai/đúng, tải lại giữa chừng, chuỗi ngày, xem lại, ván luyện) |
| markdown-editor | `npm test` · `npm run lint` · `npm run type-check` | 219 test · sạch · sạch |
| sql-administrator · mongo-administrator · postman-lite · frontend | `npm test` · `npm run lint` · `npm run typecheck` (mỗi app) | 199 · 245 · 123 · 176 test; lint, typecheck sạch; build + audit "no hard-coded origin" đạt |
| Liên thông thật | Playwright trên bản đã publish + FastAPI + GeminiGia | Gemini Chat "So sánh model" gọi đúng 2 model, 2 cột trả lời · Postman: Giải thích, Sinh test → ô Tests, link `#req=` mở ở trang mới đúng request · Sổ tay khoá học → Markdown Editor nhận đúng nội dung |

Gotcha kiểm offline: mỗi lần điều hướng, trình duyệt tự tải lại `sw.js` để kiểm bản mới — yêu cầu này
**không** bị chế độ offline giả lập của Playwright chặn và không phải trang lấy nội dung từ mạng; bộ đếm
"yêu cầu lúc offline" bỏ qua nó (`kiem_pwa.la_cap_nhat_sw`) và chụp mốc khi log đã yên (`kiem_pwa.doi_yen`).

---

## 6. Chưa kiểm được / rủi ro còn lại

- **Python trong bài (Pyodide)** chưa chạy thử thật: lệnh tải jsdelivr bị chặn trong phiên làm việc.
  Phần JS và cơ chế Worker / quá giờ đã kiểm.
- `/ai/sql` và `/ai/mongo` chưa thử với MySQL / MongoDB thật (unit test với cổng giả + test HTTP).
- Postman Lite: Worker chạy test đã bị gỡ `fetch`, XHR, WebSocket(+Stream), EventSource, WebTransport,
  `importScripts`, Worker, `caches`, FontFace, Notification, indexedDB, BroadcastChannel. **Còn khe**:
  `import()` động là cú pháp, không gỡ được — trình duyệt cho phép nó trong classic worker thì một script
  độc (từ link `#req=` hay collection nhập) vẫn gửi được một yêu cầu kèm dữ liệu trong URL. Đóng hẳn cần
  CSP `script-src` ở trang (worker blob kế thừa CSP) — thay đổi phía phục vụ webapp, chưa làm; hiện có
  toast cảnh báo khi link mang script. Đừng siết `connect-src` (chế độ Direct phải gọi mọi host).
- Lỗi cũ đã sửa trên đường: OPIc `IDB.theoCau` luôn trả `[]` (IDBIndex không có `.transaction`).
- Đính chính: `backend/fastapi/webapp/tranphuc8a/` **không phải thư mục thừa** — đó là bản build đang
  chạy thật của gemini-chat, markdown-editor-pro, postman-lite-pro, sql-administrator,
  mongo-administrator (`scripts/build-webapps.mjs` publish vào đó).
