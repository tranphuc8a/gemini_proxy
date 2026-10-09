# Bàn giao — đợt 2026-10-08/09: chọn model Gemini, AI cho học tập, Markdown Pro, JSON Editor, skill cho agent

Ngữ cảnh cô đọng cho phiên sau. Bản đồ ứng dụng đầy đủ: skill `.claude/skills/ban-do-ung-dung`. Công thức làm tính năng AI: skill `them-tinh-nang-ai`.

## Đã xong

### 1. Chọn model Gemini (backend + mọi client)
- **Đã đo trên API thật** (key trong `backend/fastapi/.env`, chỉ `models.list` + vài lệnh ngắn): họ 2.5 bị Google giới hạn cho tài khoản đã dùng (429 khi gọi mặc định);
  3.x chạy tốt. Công tắc "thinking" **khác nhau theo họ** và sai là HTTP 400: 2.5-flash(-lite) và 3.x flash nhận `thinkingBudget:0`; 3.x flash-lite chỉ nhận `thinkingLevel:"low"`;
  2.5 không nhận `thinkingLevel`; Pro không tắt được. Toàn bộ nằm ở `application/usecases/ai_models.py` (`thinking_config`), adapter còn thử lại một lần không có công tắc khi gặp 400.
- `AI_MODEL` mặc định đổi `gemini-2.5-flash` → **`gemini-3.5-flash`** (`.env` của bạn đang đặt `gemini-3-flash-preview` — giữ nguyên, ưu tiên hơn mặc định).
  Biến mới `AI_MODELS` (khoá danh sách), `AI_MODELS_TTL_SECONDS` (6 giờ).
- `GET /ai/models`: danh mục lấy từ Gemini `models.list` (chỉ model văn bản, mới → cũ; lỗi → danh sách dự phòng). Header `X-AI-Model` chọn model cho **mọi** lời gọi AI (và chat);
  `AiUseCase.resolve_model` kiểm: tên hợp lệ, có trong danh mục (400 `ai_model_unknown`), **dòng Pro chỉ quản trị viên** (403 `ai_model_admin_only`). Khoá cache tính theo model.
  Chat không còn âm thầm đổi mọi model lạ về 2.5-flash.
- Client: `courses/engine/ai-khach.js` (`model/datModel/dsModel/oModel`, tự bỏ lựa chọn hỏng rồi gọi lại bằng mặc định); `quan-ly-chi-tieu/assets/ai.js`; `src/lib/ai.ts` của SQL/Mongo/Postman;
  `frontend/src/services/aiService.ts` + hook `useAiModels` (chat và hộp so sánh dùng danh sách động; `FALLBACK_MODELS` trong `types/index.ts`);
  `markdown-editor/src/services/aiClient.ts`. Lựa chọn lưu **một chỗ** `localStorage["ai.model@<gốc API>"]`, dùng chung mọi trang cùng máy chủ.
  Nơi chọn: khung trợ giảng khoá học, nhận xét script OPIc, hộp ✨ của Markdown, app chat, và bảng "Model Gemini" ở tab AI của trang Quản lý khoá học.

### 2. AI cho ứng dụng học tập (7 endpoint mới, đều qua `AiUseCase.ask`)
| Endpoint | Việc | Giao diện |
| --- | --- | --- |
| `POST /ai/review` | chấm câu trả lời thẻ ôn tập (0–5, **gợi ý** mức SM-2, người học tự chọn) | `engine/mo-on-tap.js`: ô "tự trả lời" |
| `POST /ai/hint` | gợi ý bài tập code 3 mức (không bao giờ đưa lời giải; mức 1–2 cắt khối mã dài) | `engine/hien-thi.js` + `mo-ai.js`: nút ✨ Gợi ý khi nộp sai |
| `POST /ai/ask` + `course` | hỏi trong phạm vi **một khoá** | khung trợ giảng: "Bài này / Cả khoá" + nút ✨ trên header (kể cả trang chủ) |
| `POST /ai/notes` | sổ tay → tóm tắt để ôn / sinh thẻ (thêm vào bộ ôn theo bài nguồn) | `engine/mo-so-tay.js` |
| `POST /ai/opic/script` | nhận xét **script viết** (4 tiêu chí, không có phát âm/trôi chảy) | `opic-course`: nút ✨ Nhận xét script |
| `POST /ai/draft/assist` | trợ lý trên đoạn chọn (viết lại/mở rộng/rút gọn/đơn giản/dịch/câu hỏi/bài tập tự chấm); quản trị | `quan-ly-khoa-hoc/soan.js`: nút ✨ AI, xem trước rồi mới thay |
| `POST /ai/markdown` | định dạng thông minh (3 chế độ); không cache; cờ `shrunk` khi mất chữ | Markdown Editor Pro |
Dữ liệu riêng tư (sổ tay, câu trả lời, markdown) **không cache**; mọi văn bản vào prompt nằm trong rào `<<< >>>`; đầu ra được kiểm lại ở server (id, điểm 0–5, bài tập phải có kiểm tra ẩn…).

### 3. Markdown Editor Pro (`markdown-editor/` → `tranphuc8a/markdown-editor-pro`)
- **Responsive điện thoại** (agent làm, tôi đã kiểm lại): không cuộn ngang ở 360–1280 px; header 3 cấp + menu ⋯; sidebar thành ngăn kéo; "Both" thành Editor|Preview;
  chữ nhập ≥16 px; vùng chạm ≥40 px; menu tiêu đề không bị cắt. Sửa luôn 3 lỗi cũ: ảnh dán không hiện, khối `js/py/sh` không tô màu, dòng đầu khối mã bị thụt.
- **Chế độ đọc**: nút/palette/`Ctrl+Alt+V`/`?read=1`; cỡ chữ, giãn dòng, độ rộng cột, sáng/sepia/tối, mục lục + đánh dấu mục hiện tại, thanh tiến độ, thời gian còn lại; lưu `markdown-editor:reading`.
- **✨ Smart format** (tôi làm sau đó): thanh công cụ, menu ⋯, bảng lệnh → hộp thoại: chọn đoạn/cả tài liệu, 3 chế độ, ghi chú cho AI, ô Model; kết quả xem Result/Original/Markdown; "Thay đoạn chọn" = **một bước hoàn tác**;
  từ chối ghi nếu tài liệu đã đổi trong lúc AI chạy, hoặc kết quả bị cắt; mã: `SmartFormatModal.tsx`, `lib/smartFormat.ts`, `lib/editorSelection.ts`, store `smartFormat/openSmartFormat`. Chỉ quản trị viên (vì phải sửa tài liệu).
  Client AI **không** dùng phiên quản trị riêng của app (`markdown-editor:admin-session`, chỉ hợp lệ cho `/markdown`) mà dùng token chung `qlkh.phien@…` / `ai.phien@…`.

### 4. JSON Editor (`tranphuc8a/json-editor`, agent làm, tôi đã kiểm lại)
Cây sửa được (giá trị + đổi kiểu, đổi tên khoá, thêm, xoá, đổi chỗ phần tử), trạng thái đóng/mở giữ theo đường dẫn, hoàn tác/làm lại 100 bước, bàn phím + ARIA tree;
nút đóng hiện tóm tắt (`name: "Phúc"`, `1, 2, 3 …`, ưu tiên khoá name/title/id/ten…); chế độ soạn tô màu bằng lớp dưới textarea (khoá/chuỗi/số/bool/null, AA ≥ 4,5:1 cả hai chủ đề; tắt trên 300 KB).
Hạn chế: sửa trên cây **ghi lại cả tài liệu** theo kiểu thụt lề đã nhận (mất định dạng tay, `1.50`→`1.5`, số nguyên > 2^53 bị làm tròn); số dòng không theo dòng bị gập mềm.

### 5. `.claude/` (skill + quy tắc cho agent)
`CLAUDE.md` (kiến trúc 8 dòng, lệnh, quy ước, điều cấm, cạm bẫy) + 6 skill: `ban-do-ung-dung`, `backend-fastapi`, `them-tinh-nang-ai`, `webapp-thuan`, `webapp-react`, `khoa-hoc-engine`.
Đã xoá `skills/SKILL.md` rỗng (sai chỗ). `commands/review.md` vẫn rỗng — chưa có yêu cầu.

## Kiểm (kết quả lần chạy cuối)
| Bộ kiểm | Kết quả |
| --- | --- |
| pytest toàn backend | **1052 đạt** (1007 → +45: model, study, markdown, controller) |
| `check.py` system-design-course (engine + AI học tập mới) | 0 lỗi |
| `check.py` quan-ly-khoa-hoc (CMS, bảng model, trợ lý đoạn chọn) | 0 lỗi |
| `check.py` opic-course (kể cả nhận xét script viết) | 0 lỗi |
| `quan-ly-chi-tieu/selftest/run.py` | 208 đạt, 0 sai, 1 bỏ qua (Mongo thật) |
| json-editor `kiem.js` / `kiem-tat.js` / `kiem-hinh.py` | 133 / 751 / 10 phép — đạt |
| markdown-editor vitest / type-check / lint / build | 326 test (18 tệp) — đạt; kiểm Edge thật bản xuất bản: 204 (agent) + 18 (smart format) |
| frontend / sql-administrator / mongo-administrator / postman-lite | type-check + lint sạch; vitest **181 / 200 / 246 / 124** — đạt; đã build + `build-webapps --check` |

## Cạm bẫy mới
- Test frontend không được ghim tên model; `ChatArea.test.tsx` mock `aiService` — thêm hàm vào `aiService` thì thêm vào mock.
- `tests/conftest.py` chặn `models.list` thật trong mọi test (`.env` có thể chứa khoá thật). `FakeModel(models=[…])` mô phỏng danh mục.
- Bash của công cụ **làm mất `\`** khi chèn mã qua heredoc (gặp ≥5 lần): ghi script Python bằng Write với chuỗi raw.
- `userEvent.setup()` lỗi "Cannot redefine property: clipboard" trong markdown-editor (stub chung ở `test/setup.ts`): gọi `userEvent.click/type` trực tiếp.
- Stage git: một phần tệp json-editor/markdown-editor đã được `git add` ở bản dở của agent — **stage lại trước khi commit**.

## Còn nợ
1. **Chưa thử Gemini thật** cho các tính năng mới (chất lượng chấm thẻ, gợi ý bài tập, định dạng Markdown, tách chi tiêu): chỉ có test với model giả; đã dùng key thật duy nhất để liệt kê và thử vài lệnh ngắn trên 5 model. Muốn thử: dùng ít token, hỏi trước.
2. Chưa kiểm trên iOS/Android thật (chỉ giả lập cảm ứng của Edge); kéo-thả đổi chỗ tệp trong cây Markdown chưa chạy trên cảm ứng.
3. Chưa AI-hoá: lab trực quan (giải thích theo trạng thái), đấu trường (nhận xét mã), bài thi thử OPIc, lộ trình học cá nhân, sửa JSON hỏng bằng AI.
4. Chưa commit gì (nhánh `lab/261004`).
