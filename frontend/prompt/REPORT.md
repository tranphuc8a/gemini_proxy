# Báo cáo: Fix lỗi & cải tiến gemini-proxy (FE + BE)

> Ngày: 2026-09-12, cập nhật 2026-09-13 · Phạm vi: `frontend/` + `backend/fastapi/`
> File này compact lại ngữ cảnh để sẵn sàng cho phiên làm việc tiếp theo.

## 1. Trạng thái

| | Trước | Sau |
|---|---|---|
| Backend `pytest` | 142 pass, 1 fail, 4 lỗi collect, 15 warning | **197 pass, 1 warning** |
| Frontend test | *không có framework* | **88 test / 8 file (Vitest)** |
| Frontend `tsc` | clean | clean |
| Frontend `eslint` | 8 error, 3 warning | **clean** |
| Frontend `build` | OK | OK |

## 2. Lỗi đã sửa — Backend

| Vấn đề | File | Ghi chú |
|---|---|---|
| `EModel.GPT_4` không tồn tại → `AttributeError` khi model lạ | `domain/utils/validators.py` | Thay bằng `DEFAULT_MODEL` |
| `html.escape()` mọi tin nhắn → `a < b` thành `a &lt; b` trong DB **và** trong prompt gửi Gemini | `domain/utils/validators.py` | Bỏ escape. Sanitize là việc của tầng render, không phải tầng lưu |
| Chặn tin nhắn chứa `;` + từ khoá SQL → hỏi về SQL bị lỗi | `domain/utils/validators.py` | Bỏ hoàn toàn |
| `ValueError` map thành **404** thay vì 400 | `main.py` | Thêm handler riêng → 400. Repo thiếu bản ghi giờ raise `NotFoundError` |
| **Stream nuốt lỗi**: Gemini lỗi giữa chừng → client thấy stream kết thúc sạch, bubble rỗng, không báo gì | `usecases/gemini_usecase.py` | Giao thức mới: stream luôn kết thúc bằng đúng 1 frame `done` hoặc `error` |
| `updated_at` không bao giờ được ghi (`save()` chỉ ghi `name`) | `repositories/conversation_repository.py` | Ghi cả `updated_at` |
| Sidebar không sắp theo hoạt động | `repositories/conversation_repository.py` | Sắp theo `COALESCE(updated_at, created_at)` |
| Conversation luôn tên "New Conversation" | `usecases/gemini_usecase.py` | Tự đặt tên từ tin nhắn đầu (không ghi đè tên user đã sửa) |
| `/conversations` bị 307 redirect sang `/conversations/` | `controllers/conversation_controller.py` | Phục vụ cả 2 cách viết, không redirect |
| **Thứ tự tin nhắn ngẫu nhiên** khi cùng giây (`created_at` đơn vị giây, tie-break bằng UUID ngẫu nhiên) | `domain/utils/utils.py` | ID giờ có tiền tố thời gian + sequence → tự sắp theo thời gian. **Không cần migration** |
| Model nhận history sai thứ tự khi trùng giây | `gemini/service/gemini_service.py` | Sort theo `(created_at, id)` |
| `ResponseNotRead` che mất lỗi upstream thật (401/429) khi stream lỗi | `gemini/helper/gemini_client.py` | `aread()` trước khi đọc body |
| Retry lưu câu hỏi 2 lần | `vo/message_request.py`, `gemini_usecase.py` | Frame `error` trả `user_message_id`; retry gửi lại id đó → update chứ không insert |
| Deprecation: `Query(regex=)`, `@app.on_event`, `class Config` | nhiều file | `pattern=`, `lifespan`, `ConfigDict` |

## 3. Lỗi đã sửa — Frontend

| Vấn đề | File |
|---|---|
| Base URL mặc định `…/api/v1` mâu thuẫn `API_PREFIX` rỗng của BE → dev 404 ngay | `services/apiClient.ts` |
| Timeout 30s < `GEMINI_TIMEOUT_SECONDS=300` → câu trả lời dài bị huỷ phía client | `services/apiClient.ts` |
| Nút "Cuộc trò chuyện mới" ở màn hình rỗng **không bao giờ hiện** (phụ thuộc prop không ai truyền) | `components/EmptyState.tsx` |
| ID tạm `temp-…` lọt vào cursor phân trang | `components/ChatArea.tsx`, `store/chatStore.ts` |
| Code block ``` không có ngôn ngữ bị render thành inline code | `components/MarkdownRenderer.tsx` |
| `mermaid.initialize()` chạy lại toàn cục mỗi chunk stream | `components/MarkdownRenderer.tsx` |
| Mỗi chunk re-render + re-parse markdown **toàn bộ** tin nhắn → giật | `components/ChatArea.tsx` (memo hoá `MessageBubble`) |
| `new Date(created_at)` (giây coi như ms) → file export ghi năm 1970 | `utils/helpers.ts` |
| Tên file export `[^a-z0-9]` → tên tiếng Việt thành toàn gạch dưới | `utils/helpers.ts` |
| `formatTimestamp` hardcode tiếng Việt bất kể ngôn ngữ | `utils/helpers.ts` |
| Ngôn ngữ có 2 nguồn sự thật (`app-settings` vs `localStorage.language`) | `store/appStore.ts`, `i18n/index.ts` |
| `onKeyPress` deprecated; Enter giữa lúc gõ Unikey gửi chữ dở | `components/ChatArea.tsx` |
| `rehypeRaw` + mermaid `securityLevel: 'loose'` render HTML thô từ model → XSS | `components/MarkdownRenderer.tsx` |

**Sửa thêm 2026-09-13 — lỗi `"Connection closed before the answer finished"`** (cả 3 đều ở `services/geminiService.ts`):

1. **Bắt buộc frame kết thúc** → vỡ với backend chưa deploy. Xem bảng tương thích ở mục 5.
2. **Không xả buffer khi stream đóng**: `reader.read()` trả `done` thì `break` ngay, bỏ luôn frame cuối còn nằm trong buffer nếu nó thiếu dấu `

` kết thúc. Giờ flush cả buffer lẫn `TextDecoder` (ký tự nhiều byte có thể bị cắt giữa 2 chunk mạng).
3. **Không `reader.cancel()`** khi return sớm → kết nối HTTP bị treo. Giờ cancel trong `finally`.

## 4. Tính năng / UX mới

- **Dừng sinh câu trả lời** — nút Gửi đổi thành Dừng khi đang stream (`AbortController`).
- **Thử lại** khi câu trả lời lỗi, không nhân đôi câu hỏi.
- **Timestamp** dưới mỗi tin nhắn (hover ra ngày giờ đầy đủ).
- **Tìm kiếm conversation** ở sidebar, bỏ dấu vẫn khớp (`ke hoach` → `Kế hoạch`).
- **Tự đặt tên conversation** từ tin nhắn đầu tiên.
- Sidebar hiện thời gian hoạt động + số tin nhắn; conversation vừa dùng nhảy lên đầu.
- **Mobile**: sidebar thành Drawer dưới breakpoint `md`; header/input/bubble co giãn lại.
- Nút **"Xuống tin nhắn mới nhất"** khi đang đọc ngược lên.
- Auto-scroll chỉ bám khi user đang ở đáy (không giật khi đang đọc lại).
- Lỗi API hiện **message thật từ backend** thay vì câu chung chung.
- A11y: `aria-label` cho nút icon, `role="alert"` cho lỗi, nút copy luôn hiện trên thiết bị cảm ứng, tôn trọng `prefers-reduced-motion`.

## 5. Giao thức stream mới (quan trọng)

`POST /gemini/stream` trả SSE. Stream **luôn** kết thúc bằng đúng một frame cuối:

```
data: "<chuỗi JSON>"                                  # delta — giữ nguyên format cũ
event: done\ndata: {"conversation_id","user_message_id","message_id"}
event: error\ndata: {"message","user_message_id"}
```

- FE dùng `message_id`/`user_message_id` để thay ID tạm bằng ID thật.
- Khi retry, FE gửi lại `message_id` trong body để BE update thay vì insert.

### Tương thích ngược (sửa 2026-09-13)

Backend **chưa deploy** (bản trên `main`) không gửi frame kết thúc. Ban đầu FE bắt
buộc phải có frame này nên báo lỗi `"Connection closed before the answer finished"`
với **mọi** câu hỏi. Quy tắc hiện tại:

| Stream kết thúc | Có nội dung? | Kết quả |
|---|---|---|
| có frame `done` | — | `onComplete` (kèm ID thật) |
| có frame `error` | — | `onError` |
| không frame cuối | **có** | `onComplete` — backend đời cũ kết thúc đúng kiểu này |
| không frame cuối | **không** | `onError` (`chat.streamIncomplete`) |

Với backend mới, mọi stream đều có frame cuối nên tính nghiêm ngặt vẫn giữ nguyên.

## 6. Lệnh

```bash
# Backend
cd backend/fastapi && .venv/Scripts/python.exe -m pytest tests -q

# Frontend
cd frontend
npm test            # vitest run
npm run typecheck
npm run lint
npm run build
```

**Lưu ý cấu hình**: `VITE_API_BASE_URL` (FE) phải khớp `API_PREFIX` (BE).
Hiện `.env` của BE để `API_PREFIX=` rỗng → FE dùng `http://localhost:6789`.

## 7. Còn tồn đọng (chưa làm)

0. **Quan trọng — backend chưa được deploy.** `main` đang ở `c389b58` (2026-09-08),
   chưa có các fix backend. `gemini8a.vercel.app` vì thế vẫn chạy code cũ. FE giờ
   chạy được với cả hai, nhưng để có báo lỗi stream đúng, ID thật và tự đặt tên
   conversation thì cần merge + deploy backend.
1. **Bundle 2.5 MB** (gzip 814 kB) — `mermaid` + `react-syntax-highlighter` chiếm phần lớn. Nên `React.lazy` cho `MarkdownRenderer`.
2. **`rehype-raw` vẫn còn trong `package.json`** nhưng không còn được dùng — có thể gỡ.
3. **Cursor pagination trên khoá thay đổi**: sidebar sắp theo `COALESCE(updated_at, created_at)`, nếu có conversation được cập nhật *trong lúc* user đang bấm "Tải thêm" thì có thể nhảy/lặp 1 item. Đánh đổi có chủ đích để đổi lấy UX đúng.
4. **`created_at` vẫn là giây**. Thứ tự đã đúng nhờ ID có tiền tố thời gian, nhưng nếu muốn timestamp chính xác đến ms thì cần migration `INT` → `BIGINT`.
5. Warning còn lại của pytest là từ `starlette.testclient` (thư viện ngoài), không phải code dự án.
