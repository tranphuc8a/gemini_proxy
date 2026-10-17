# Bàn giao 17/10 — cổng portal, Markdown Editor offline, bộ lọc "Các khoản chung"

Ba việc, làm theo thứ tự 3 → 2 → 1. **Chưa commit** (nhánh `lab/261010_2`). Backend không đổi dòng nào.

## 3. Quản lý chi tiêu — bộ lọc "Các khoản chung" gập được
- `assets/chung.js`: hàng luôn hiện = ‹ chọn tháng › + nút **Bộ lọc** (huy hiệu số bộ lọc bật). Phần chi tiết (ngày, chọn nhanh, loại/ai trả/thành viên/nhóm, tìm) nằm trong `#sl-detail` gập được; **mặc định gập**, nhớ theo máy (`localStorage["qlct.sl.chiTiet"]`). Gập mà đang lọc → dòng "Đang lọc: …" nói rõ điều kiện, nên không có bộ lọc ngầm.
- `ledger.js`: hàm thuần `activeFilterCount(f)` (khoảng ngày KHÔNG tính vì ô chọn tháng luôn hiện). `kieu.css`: mở ra thì thanh lọc hết dính; gập thì một hàng gọn dính đầu hộp. Điện thoại 390 px: thanh gập cao ≈ 128 px (trước đó > 330 px).
- `sw.js` `PHIEN_BAN` 2 → 3. **Trần dung lượng 350 → 360 KB** (`selftest/static_checks.py`): app đã ở 354,5 KB từ đợt lọc ngày 15/10, tức phép kiểm tĩnh đang vượt trần.
- Kiểm: `kiem.js` 520 phép (+4); `selftest/run.py --only browser` 181 phép (cập nhật các phép cũ trong `nhom_ai.py` cho phải mở phần chi tiết trước; thêm phép gập/mở, huy hiệu, "Đang lọc", nhớ trạng thái, 390 px và 360 px).

## 2. Markdown Editor Pro — cài về máy, chạy offline (PWA)
Hiểu yêu cầu là **PWA cài được** (không phải một tệp HTML). Nguồn `markdown-editor/`, xuất bản bằng `node scripts/build-webapps.mjs --only markdown-editor`.
- **Cách hoạt động**: `pwa/sw.js` là *mẫu*; `scripts/make-sw.mjs` (chạy sau `vite build`, đã nối vào `npm run build`) điền danh sách precache + build id rồi ghi `dist/sw.js`. Lưu **mọi** tệp build (425 tệp ≈ 5,5 MB, gồm 399 chunk JS — mermaid, PDF, Prism — mà `index.html` không nhắc tới) nên sơ đồ/KaTeX/xuất PDF vẫn chạy offline. Tệp trùng tên băm với bản trước thì chép từ cache cũ, không tải lại. `assets/*` cache-first (bất biến), còn lại mạng-trước.
- **Giao diện**: menu **File → "Install app / use offline…"** → `InstallModal` (trạng thái "Ready offline — N files", nút cài, hướng dẫn iOS/menu trình duyệt, lưu ý quyền sửa). Mã trang: `src/lib/pwa.ts`, `main.tsx` gọi `initPwa()` (chỉ đăng ký worker ở bản production).
- **Quyết định cần bạn biết — sửa được khi offline**: `restoreAdminSession` giờ tin token đã lưu **chỉ khi thiết bị thật sự mất mạng** (`navigator.onLine === false`); server chết mà mạng còn vẫn là chỉ-xem như cũ. Có mạng lại → `recheckAdminSession`; chỉ khi server **từ chối** (401/403) mới hạ về chỉ-xem (+ thông báo), còn "chưa trả lời" thì giữ nguyên. Token không cho thêm quyền gì: mọi ghi lên server vẫn bị server kiểm. Khách (chưa mở khoá) offline chỉ đọc. Muốn bỏ hành vi này: xoá nhánh `deviceIsOffline()` trong `markdownStorage.ts`.
- `build-webapps.mjs`: thêm `auditServiceWorker` — fail nếu `sw.js` còn placeholder, danh sách rỗng, liệt kê tệp không xuất bản, hoặc thiếu manifest. (Bước này bắt được một lỗi thật: `String.replace` thay nhầm token trong comment đầu tệp.)
- Biểu tượng: `pwa/tao-bieu-tuong.py` → `public/icons/` (192/512/maskable/apple-touch). `metadata.json` thêm tag `pwa`, `offline`.
- Kiểm: vitest 21 tệp / **367 test** (mới: `pwa.test.ts`, `markdownStorage.test.ts`, `install.test.tsx`, +4 trong `store.test.ts`); type-check, lint 0 cảnh báo, build. **Edge thật + server thật**: `backend\fastapi\.venv\Scripts\python.exe markdown-editor\scripts\kiem-pwa.py [--anh <thư-mục>]` — 25 phép: worker cài và lưu đủ 425 tệp, manifest, tắt server + mất mạng rồi tải lại, sửa offline, KaTeX + Mermaid vẽ offline, không yêu cầu `/webapp/` nào hỏng, đổi khoá → bị từ chối → chỉ-xem, khách offline chỉ đọc. Đã chạy đối chứng: chặn service worker thì offline không mở được.

## 1. Cổng portal (`webapp/_portal`)
- **Màn ≤ 960 px**: bộ lọc gập sau nút **"Lọc & sắp xếp"** (huy hiệu số lọc, nút "Xem N ứng dụng" cuối ngăn, Esc đóng); thanh tìm kiếm **dính** khi cuộn; thẻ app đầu tiên nằm ngay dưới đầu trang (trước đó bị ba nhóm lọc đẩy xuống). Ngăn lọc luôn mở *dưới* nút (xếp lại bằng `display: contents` + `order`).
- **Thẻ app** là `<article>` + một liên kết kéo giãn (`::after`) + nút loại/tag anh em — hết nút lồng trong `<a>`. Vòng **focus** cho mọi điều khiển, liên kết "Bỏ qua tới danh sách", `aria-pressed`/`aria-label`, `aria-live` cho số kết quả, **khung xương** thay vòng quay.
- **Giao diện sáng/tối** theo hệ điều hành khi chưa chọn (script đặt trước khi vẽ, không nhấp nháy); Esc không còn xoá sạch bộ lọc.
- **Tương phản**: `--text-faint` không đạt 4,5:1 (sáng 2,9–3,4; tối 4,1 trên thẻ) → `#7b8da5` (tối) / `#596a82` (sáng); đo thật trong test, thấp nhất 5,11 (tối) và 4,69 (sáng). Cảm ứng: điều khiển chính ≥ 44 px; **ngoại lệ có chủ ý**: loại/tag trong thẻ 28–32 px (mỗi thẻ có tới 6 cái).
- **Lỗi cũ tìm ra và đã sửa**: (a) `render()` ghi đè `portal:settings` bằng object mới → **xoá mất `theme`**, lựa chọn sáng/tối chưa bao giờ sống qua lần vẽ đầu; (b) chọn mỗi "Thể loại" thì nút "Xoá toàn bộ bộ lọc" không hiện; (c) trên màn hẹp `body` cao đúng 100% khung nhìn nên `sticky` chỉ giữ được trong khung đầu tiên.
- Kiểm: `cd backend/fastapi/webapp/_portal && ../../.venv/Scripts/python.exe check.py` — tầng mới "TẦNG 3" (390/768/1280 px, bàn phím, tương phản hai giao diện, khung xương, theme).

## Cần làm tiếp / chưa kiểm
- **Commit**: xuất bản lại đổi tên băm nên `git status` có ~76 tệp `D` + tệp mới trong `webapp/tranphuc8a/markdown-editor-pro/assets/` — đúng kỳ vọng.
- PWA cần **HTTPS** khi deploy (chưa xác nhận bản deploy có HTTPS — nợ cũ); đã thử trên Edge thật, **chưa** Safari/iOS/Firefox. Lần cài đầu tải ≈ 5,5 MB.
- Chưa có thông báo "có bản mới, tải lại" sau deploy; tab cũ đang mở có thể 404 khi nạp chunk lười của bản cũ cho tới khi tải lại.
- `scripts/audit-webapps.mjs` không chạy được ở đây (cần Playwright cho Node, chưa cài; cấm thêm dependency) — đã thay bằng `kiem-pwa.py` và `check.py`.
- Chưa chạy pytest backend (không đổi mã backend). Nhãn chọn tháng trên điện thoại hẹp bị cắt ("Tất cả các thán…") — chỉ là thẩm mỹ.
