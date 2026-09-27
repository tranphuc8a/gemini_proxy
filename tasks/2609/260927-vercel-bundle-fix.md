# Bàn giao: Vercel bundle vượt giới hạn

## Nguyên nhân
Vercel Python preset bỏ qua `excludeFiles` cho framework function. Root Directory là `backend/fastapi`; Wukong `xqdb` (khoảng 64.4 MB) và `res` (khoảng 5.9 MB tài liệu) bị đóng gói dù không được app trình duyệt sử dụng.

## Đã xử lý
- Chuyển `webapp/wukong-xiangqi-main/xqdb` và `res` ra `backend/wukong-xiangqi-source/`, ngoài Vercel Root Directory.
- Giữ `src`, `apps`, generators và parsers trong webapp; không di chuyển runtime assets/công cụ.
- Dọn glob `excludeFiles` cũ trỏ vào các thư mục đã chuyển và cập nhật `docs/vercel-bundle-size.md`.

## Kiểm chứng
- `node scripts/check-vercel-bundle.mjs --limit 225 --deps 54.9`: 168.1 MB / 225 MB (75%).
- `backend/fastapi/tests/adapter/input/controller/test_webapp_controller.py`: 20 passed.
- `git diff --check`: sạch.

## Sau khi push
Kiểm tra Vercel build; bundle dự kiến thấp hơn chuẩn khoảng 57 MB. Không cần bật Large Functions cho kích thước hiện tại. Root Directory cần tiếp tục là `backend/fastapi`.
