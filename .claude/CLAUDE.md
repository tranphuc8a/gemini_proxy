# gemini_proxy — bản đồ dự án cho agent

Monorepo: backend FastAPI + nhiều ứng dụng web, nhiều ứng dụng viết tay không build. Đọc skill `ban-do-ung-dung`
trước khi sửa một ứng dụng nào đó (ứng dụng làm gì, mã nguồn nằm đâu, kiểm bằng gì, đang ở trạng thái nào).

## Kiến trúc trong 8 dòng

1. **Backend sống** là `backend/fastapi` (FastAPI, kiến trúc lục giác): `adapter/input/controllers` → `application/usecases`
   → `application/ports` → `adapter/output` (mysql/mongo/json/gemini/web). `adapter/factory` nối các lớp lại.
   `backend/gemini-proxy` (Java) chỉ là bản cũ, không ai dùng.
2. **Ứng dụng web** nằm ở `backend/fastapi/webapp/…`, được phục vụ tại `/webapp/<đường dẫn>/`
   (`webapp_controller.py` chèn `window.__WEBAPP_CONFIG__ = {apiBase, webappBase}` vào `index.html`).
3. Có hai loại ứng dụng: **viết tay** (JS thuần, không build, nguồn = bản phục vụ, mở được bằng `file://`) và **bản build**
   (React + Vite, nguồn ở thư mục gốc repo, xuất bản bằng `node scripts/build-webapps.mjs --only <tên>`). Sửa bản build
   ở nguồn rồi build lại — đừng sửa tệp `assets/index-*.js` trong `webapp/`.
4. **Khoá học** (`webapp/courses/*`) lấy nội dung từ database qua `/courses/*`; trang đọc dùng chung engine
   `webapp/courses/engine/` (nguồn thật), `engine/sync.py` chép sang từng trang. Xem skill `khoa-hoc-engine`.
5. **Mọi lời gọi Gemini** đi qua một cửa `AiUseCase.ask` (quyền, giới hạn theo IP, ngân sách ngày, sổ, bộ nhớ đệm,
   chọn model). Xem skill `them-tinh-nang-ai`.
6. Dữ liệu người dùng cuối nằm ở `localStorage` của trình duyệt; vài app đồng bộ qua `/spending`, `/markdown`, `/postman`, `/graphs`.
7. Tài liệu bàn giao theo đợt ở `docs/` và `tasks/<yymm>/<yymmdd>/…`; đọc `ban-giao.md` của đợt liên quan trước khi làm tiếp.
8. `graphify-out/` và `.codegraph/` là chỉ mục mã nguồn — dùng `codegraph explore` trước khi grep.

## Lệnh thường dùng (Windows, chạy từ gốc repo; shell của agent là Git Bash)

| Việc | Lệnh |
| --- | --- |
| Chạy backend | `.\backend\fastapi\run_fastapi.ps1` → <http://localhost:6789> (docs ở `/api/v1/docs`) |
| Toàn bộ test backend | `cd backend/fastapi && .venv/Scripts/python.exe -m pytest -q` (≈ 1,5 phút, hơn 1.000 test) |
| Test một vùng | `… -m pytest tests/application/test_ai_models.py -q` |
| App viết tay có `kiem.js` | `node backend/fastapi/webapp/tranphuc8a/<app>/kiem.js`; tất cả: `node backend/fastapi/webapp/tranphuc8a/kiem-tat.js` |
| Kiểm hình/bố cục (Playwright) | `backend/fastapi/.venv/Scripts/python.exe backend/fastapi/webapp/tranphuc8a/kiem-hinh.py <app> [--anh]` |
| Trang khoá học | `python backend/fastapi/webapp/courses/<trang>/check.py` (`--tinh` chỉ kiểm tĩnh) |
| Quản lý chi tiêu (đủ tầng) | `backend/fastapi/.venv/Scripts/python.exe quan-ly-chi-tieu/selftest/run.py` |
| App React | `cd <thư-mục-nguồn> && npm test && npm run type-check && npm run lint && npm run build` |
| Xuất bản app React | `node scripts/build-webapps.mjs --only <tên>` rồi `--check` |

## Quy ước

- Backend: tiếng Anh cho định danh và docstring; thông báo cho người dùng bằng **tiếng Việt**. Lỗi ném `AppException`
  (`application/exceptions`) — middleware đổi thành `{status_code, message, data:{code,…}}`. Các route `/ai/*` trả JSON trần.
- Web viết tay: tên hàm/biến tiếng Việt không dấu (courses, json-editor, chi-tieu cũ) hoặc tiếng Anh (quan-ly-chi-tieu, mới);
  **theo đúng thói quen của tệp đang sửa**. Mọi chuỗi từ người dùng/AI/dữ liệu vào `innerHTML` phải qua hàm thoát HTML.
- Test: pytest dùng `tests/support/fake_ai.py` (`FakeModel`, `FakeStore`) — không bao giờ gọi Gemini thật (`tests/conftest.py`
  còn chặn `models.list`). Kiểm trình duyệt dùng Gemini giả (`GeminiGia` trong `courses/engine/kiem_khoa_hoc.py`, `page.route`).
- Một thay đổi hành vi đi kèm test; tính năng giao diện đi kèm một phép kiểm trình duyệt thật (Edge qua Playwright, `channel="msedge"`).

## Không được làm

- **Không ghi vào database thật** (Aiven MySQL trong `.env`). Dev dùng `DB_URL=sqlite+aiosqlite:///…`; selftest/check.py tự đặt SQLite tạm.
  Chỉ đọc khi được yêu cầu. Không chạy migration trên môi trường thật.
- Không gọi Gemini thật trong test hay trong vòng lặp tự động. Chỉ gọi thật khi người dùng đồng ý rõ ràng (tốn quota); khoá ở
  `backend/fastapi/.env` — **không in khoá ra màn hình, log hay tài liệu**.
- Không sửa tệp sinh ra: `webapp/**/assets/index-*.js` (bản build), bản sao engine trong `courses/<trang>/assets/`
  (sửa ở `courses/engine/` rồi `python engine/sync.py`), `backend/course-content/*.json` khi chưa hiểu `_ghi_bundle.py`.
- Không thêm dependency mới khi chưa hỏi; ứng dụng viết tay không nạp thư viện/CDN ngoài (trừ những chỗ đã có: Pyodide, mermaid, katex).
- Không commit trực tiếp lên `main`; chỉ commit khi người dùng yêu cầu.

## Cạm bẫy đã gặp (đừng giẫm lại)

- **Heredoc bash làm mất dấu `\`** khi chèn mã (regex JS, `\n` trong chuỗi Python…). Ghi mã bằng công cụ Write/Edit, hoặc script Python
  với chuỗi raw `r'''…'''`; luôn `node --check` / chạy test sau khi sinh mã.
- Tệp tiếng Việt: luôn UTF-8; trên Windows đặt `PYTHONUTF8=1` khi chạy script in tiếng Việt, kẻo `cp1252` ném lỗi.
- `localStorage` có thể bị chặn (cửa sổ riêng tư) — bọc try/catch; ứng dụng phải chạy tiếp được.
- Service worker (PWA) chỉ được đụng GET cùng origin dưới phạm vi của app — **không bao giờ cache API đồng bộ** (ghi đè dữ liệu thiết bị khác).
- Hoàn tác (undo) phải là *hàm ngược tạo bản ghi mới hơn*, không khôi phục ảnh chụp, nếu không đồng bộ sẽ hoàn tác ngược trên thiết bị khác.
- Test frontend đang ghim tên model: đổi danh sách model thì sửa cả `frontend/src/**/*.test.tsx`.

## Quy trình làm việc (theo chỉ dẫn của chủ dự án)

Đọc các tệp liên quan → trình bày kế hoạch → chờ duyệt → sửa → chạy test + lint, tự sửa đến khi xanh → viết lại tài liệu bàn giao
bằng tiếng Việt, cô đọng, để phiên sau làm tiếp được (`tasks/<yymm>/<yymmdd>/<tên>/ban-giao.md`).
