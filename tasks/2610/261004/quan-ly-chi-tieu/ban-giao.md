# Bàn giao nhanh — Quản lý chi tiêu (2026-10-06, đã thêm PWA)

Ngữ cảnh cô đọng cho phiên làm việc sau. Chi tiết: `report.md` (kết quả), `design.md` (thiết kế + §11 khác biệt), `implement-progress.md` (nhật ký).

## Đã xong
- App web **`backend/fastapi/webapp/tranphuc8a/quan-ly-chi-tieu/`** (HTML/CSS/JS thuần, không build, ≈ 285 KB). URL: `/webapp/tranphuc8a/quan-ly-chi-tieu/`. App cũ `tranphuc8a/chi-tieu` **không đụng**.
- API **`/api/v1/spending/*`** (5 route: backends, tạo, đọc `?since=`, lưu có `revision` → 409, xoá) + 3 kho json/mysql/mongo, lưu có điều kiện nguyên tử. Dựng theo mẫu `postman_*`.
- Gốc dự án `quan-ly-chi-tieu/`: `README.md` + `selftest/` (không có mã chạy — mã app nằm ở thư mục webapp vì không có bước build).
- Tài liệu: `tasks/2610/261004/quan-ly-chi-tieu/{requirements,design,implementation-plan,implement-progress,report,ban-giao}.md`.
- **PWA (cài như app trên máy tính/điện thoại, chạy offline)**: `manifest.webmanifest`, `sw.js` (gốc app), `assets/pwa.js`, 4 icon PNG, mục “Cài ứng dụng” ở Cài đặt (`views.installSection`, `ctx.pwa`, act `pwa-install`). Script vẽ icon: `quan-ly-chi-tieu/tao-bieu-tuong.py`. Chi tiết + cạm bẫy: README mục “Cài như ứng dụng”.

## Chạy kiểm
```powershell
node backend\fastapi\webapp\tranphuc8a\quan-ly-chi-tieu\kiem.js                       # 430 phép kiểm
backend\fastapi\.venv\Scripts\python.exe quan-ly-chi-tieu\selftest\run.py [--shots]   # 178 đạt, 0 sai, 1 bỏ qua
```
`selftest` = tĩnh · node · pytest `/spending` · uvicorn thật (SQLite tạm, `MONGO_URI` rỗng, `DB_HOST` trỏ hư vô) · Edge thật qua Playwright (có kiểm PWA: worker điều khiển trang, tắt mạng vẫn mở + ghi sổ, API không bị lưu cache, nút Cài, iOS). Toàn suite backend: 993 đạt (902 cũ + 91 mới) — PWA không đụng Python.

## Kiến trúc trong 6 dòng
1. Logic thuần (`money dates model ledger parser sync csv charts text`) đăng ký vào `globalThis.QL`, `require` được trong node → kiểm bằng `kiem.js`.
2. `store.js` = Engine: **ghi localStorage trước, đồng bộ sau** (debounce 1,2 s); 409 → `sync.merge` (LWW theo `updatedAt` + bia mộ xoá) → thử lại; offline → giữ `dirty`, tự thử lại.
3. Một tài liệu JSON/sổ (`schema 1`): accounts, categories, people, transactions (expense/income/transfer/settle), budgets, recurring, tombstones. Sổ tiết kiệm = tài khoản `kind=savings` có `deposit`.
4. Tiền luôn **số nguyên đồng**; chia dùng `money.allocate` (phần dư lớn nhất, tổng luôn khớp). "Chi của tôi" ≠ "dòng tiền" (xem `design.md` §3.2).
5. UI: `views.js` trả chuỗi HTML, `dialogs.js` hộp thoại `<dialog>`, `app.js` uỷ quyền sự kiện `data-act`; mọi chuỗi người dùng qua `esc()`.
6. Backend: `spending_controller → SpendingUseCase → SpendingRepositoryPort (replace_if_revision) → json | mysql | mongo (payload_json là chuỗi)`.

## Cạm bẫy đã gặp
- **sw.js chỉ được đụng tệp dưới phạm vi app, cùng origin, GET.** API `/spending` nằm ngoài phạm vi nên không bị lưu; nếu bị lưu thì đồng bộ đọc bản cũ rồi ghi đè sổ thiết bị khác. Kiểm tĩnh + trình duyệt đều khoá điều này — đừng nới.
- Cài được cần **HTTPS** (hoặc máy chủ chạy ngay trên máy). `http://192.168.x.x` trên điện thoại ⇒ không có service worker, không có nút cài.
- **iOS: app màn hình chính có localStorage riêng**, tách khỏi Safari ⇒ sổ “Máy này” không tự sang (UI đã cảnh báo; dùng Sao lưu/Khôi phục JSON hoặc đồng bộ máy chủ).
- `sw.js` tự đọc `index.html` lúc cài để lưu `assets/*` — thêm tệp mới vào index là đủ, nhưng tệp nhắc trong index mà thiếu trên đĩa sẽ làm cài worker thất bại (kiểm tĩnh bắt). Đổi quy tắc worker ⇒ tăng `PHIEN_BAN`.
- Kiểm tĩnh cấm chữ “localhost” trong mã/lời văn của app (trừ ví dụ placeholder) — diễn đạt khác.
- Nhập nhanh trên đầu trang chỉ lưu thẳng khi nhận ra **số tiền + danh mục + không cảnh báo**; còn lại mở hộp thoại. Test phải dùng câu có từ khoá danh mục (vd `cơm …`).
- Hoàn tác phải là **hàm ngược tạo bản ghi mới hơn** (không phải khôi phục ảnh chụp sổ) — nếu không, đồng bộ sẽ hoàn tác ngược trên thiết bị khác.
- Số trần < 1.000 hiểu là nghìn (`57` = 57.000) nên in→đọc vòng tròn cần `smallAsThousand:false` (hoặc dùng `amtText`).
- `file://` + chưa có "Địa chỉ máy chủ" ⇒ engine không gọi API (cố ý). Server chèn `window.__WEBAPP_CONFIG__.apiBase` khi phục vụ.
- Dữ liệu không phải object gửi lên API → **422** (không phải 400).
- Khi viết script sinh mã bằng heredoc/Python, dấu `\` trong regex JS bị mất — luôn `node --check` + chạy `kiem.js`.

## Còn nợ
1. Chạy `selftest` với `SELFTEST_MONGO_URI` (Mongo thật) và MySQL thật — chưa làm (không ghi vào Aiven).
2. Thử trên Safari/iOS, Firefox, điện thoại thật (cả luồng cài PWA thật trên Android/iOS); xem bản in `Ctrl+P`. Chưa xác nhận bản deploy thật có HTTPS.
3. Tuỳ chọn: công cụ chuyển giao dịch năm cũ ra file (sổ ≤ 4 MB); gom ba kho "workspace+khoá+revision" (postman/spending/markdown) thành một.
4. Ngoài phạm vi, chưa sửa: `/storage/backends` công khai tên DB + host MySQL.
5. PDF nguồn có mật khẩu wifi ở trang 3 — nên đổi; không có trong tài liệu/app.

## Trạng thái git
Chưa commit. Nhánh `lab/261004`. Có file mới ở `quan-ly-chi-tieu/`, `tasks/2610/…`, `backend/fastapi/{src,tests,webapp}/…spending…` và sửa nhỏ `main.py`, `config.py`, `.env.example`, `README.md`, `tests/support/fake_mongo.py`.
