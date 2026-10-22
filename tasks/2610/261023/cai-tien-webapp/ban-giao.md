# Bàn giao — đợt cải tiến web app (22–23/10/2026)

**Trạng thái: xong pha HIỂU + THIẾT KẾ, chưa sửa dòng mã nào. Đang chờ chủ dự án chốt Q1–Q8 trong `ke-hoach.md` §3.**

## Yêu cầu gốc (tóm tắt)
- Markdown Editor Pro: toán `\[ \]`; link chia sẻ chỉ đọc cho người ẩn danh; PlantUML; thêm định dạng toán/ký hiệu/sơ đồ của Gemini/Claude/ChatGPT; version + đồng bộ chỉ gửi phần đổi.
- Personal Wiki: đồng bộ không chạy; AI từ dữ liệu thô → note md đẹp + liên kết tới chủ đề có sẵn.
- Tất cả: lag với md rất dài.
- JSON Editor: JSON Schema (kiểm + sinh mẫu hợp lệ ngẫu nhiên); gập hiện preview/metadata; tìm/sửa/định dạng.
- Logic Puzzle: hoàn thiện Lights Out; cân xu CW1 (v1 biết nặng, v2 không biết), CW2 (ít quả cân nhất), CW3 (cân điện tử); lạc đà chở chuối V1/V2; nhóm đi bộ + xe máy.

## Tệp trong thư mục này
- `ke-hoach.md` — bản tổng hợp: việc chung/xung đột, 4 luồng M/W/J/P chia đợt kèm lệnh kiểm, 8 quyết định, dependency, phản biện.
- `thiet-ke/<vùng>.md` — thiết kế chi tiết 8 vùng (hiện trạng có path:line, phát hiện, thiết kế, danh sách việc đánh số mà `ke-hoach.md` tham chiếu).
- `nhap/<vùng>/` — script đo/thử đã dùng (dựng lại pipeline markdown, đo hiệu năng Playwright, kiểm công thức puzzle). Một số tham chiếu đường dẫn scratch cũ; sửa đường dẫn trước khi chạy lại.

## Phát hiện quan trọng nhất (đã kiểm)
- Wiki đồng bộ hỏng: `apiBase` rỗng (API_PREFIX trống) bị coi là "không có máy chủ" (cùng lỗi code-studio đã sửa ở 67995d6); `index.html` gọi đích danh không được chèn `__WEBAPP_CONFIG__` → PWA đã cài mất đồng bộ.
- Markdown: `\[ \]`/`\( \)` bị micromark coi là ký tự thoát; `$$x$$` một dòng thành inline; `$5…$10` thành công thức giả. gemini-chat dính cùng lỗi.
- Markdown lưu máy chủ = gửi + ghi đè cả cây, không kiểm phiên bản → mất dữ liệu giữa máy; "Load from backend" thay cây không hỏi; localStorage > ~5,24 triệu ký tự hỏng ngầm. `GET /markdown/files` công khai, khoá quản trị mặc định công khai.
- Hiệu năng (Edge thật): MD Editor 10k dòng mở 24 s, gõ p95 10 s; Wiki 9k dòng gõ p95 656 ms. Nguyên nhân: render lại cả tài liệu, tô màu inline-style, việc O(n) mỗi phím, gutter dựng lại.
- JSON Editor: 1 MB treo 3,4 s, 10 MB 31 s; nháp > 5 MB mất không báo; vài lỗi đúng/sai (prototype, `in`, `__proto__`, JSONPath).

## Việc tiếp theo
1. Chủ dự án chốt Q1–Q8 (`ke-hoach.md` §3; mặc định ngầm định ở cuối §3).
2. Bắt đầu theo thứ tự đề xuất §2: M0 → W1 → M1 → M2 → M2b → J1 → P1 → P2 → …; mỗi đợt kết thúc bằng `tasks/2610/<yymmdd>/<tên>/ban-giao.md`.
3. Chủ dự án tự kiểm trên production: biến `MARKDOWN_ADMIN_KEY`, `curl <prod>/wiki/backends` và `/markdown/backends` (kho JSON ở /tmp trên Vercel?).
