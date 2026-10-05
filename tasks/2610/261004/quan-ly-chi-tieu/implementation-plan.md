# Kế hoạch triển khai

Căn cứ `design.md`. Thứ tự đi từ phần **đúng-sai-nhìn-không-ra** (tiền, ngày, chia, gộp) đến phần giao diện; backend làm song song vì chỉ phụ thuộc hợp đồng API (§5 của design).

## Quy ước làm việc

- Mọi đường dẫn tính từ gốc repo. `APP` = `backend/fastapi/webapp/tranphuc8a/quan-ly-chi-tieu`; `BE` = `backend/fastapi`; `PRJ` = `quan-ly-chi-tieu`.
- Viết kiểm thử **cùng lúc** với mã của từng phase; phase chưa xanh thì không sang phase sau.
- Không thêm dependency vào `requirements.txt`/npm. Không sửa ứng dụng `chi-tieu` cũ. Sửa file có sẵn ở backend chỉ là: `main.py` (đăng ký router), `config.py`, `.env.example`, `README.md`, `tests/support/fake_mongo.py` (nếu thiếu `matched_count`).
- Không commit (người dùng chưa yêu cầu).
- Ghi tiến độ vào `implement-progress.md` sau mỗi phase.

## Phase 0 — Khung (xong khi viết tài liệu)

`requirements.md`, `design.md`, `implementation-plan.md`; tạo `PRJ/README.md`.

## Phase 1 — Lõi logic thuần (trình duyệt) · phụ thuộc: không

| Việc | Tệp | Kiểm bằng |
|---|---|---|
| Tiền: `parse`, `format`, `compact`, `allocate` | `APP/assets/money.js` | bảng chuỗi; thuộc tính "tổng phần = tổng"; số trong PDF |
| Ngày: số ngày, thứ, tuần, kỳ, nhãn | `dates.js` | ranh giới tháng/năm, năm nhuận, tuần cắt tháng |
| Mô hình: `emptyDoc`, mặc định, `normalize`, `upsert/remove` + bia mộ, `validateTx` | `model.js` | tài liệu hỏng → chuẩn hoá được; bất biến §3.1 |
| Sổ cái: `effects`, số dư, tổng kỳ, danh mục/ngày/thứ, nợ, ngân sách, tiết kiệm, định kỳ, lọc/tìm | `ledger.js` | **đối chiếu 10 con số PDF** (requirements §6); lọc không dấu |
| Phân tích nhập nhanh/hàng loạt | `parser.js` | bảng ≥ 30 câu thật từ PDF + câu nhập nhanh |
| Gộp tài liệu | `sync.js` | giao hoán/kết hợp/lặp lại (ngẫu nhiên có hạt giống), xoá-vs-sửa, bia mộ cũ |
| CSV | `csv.js` | vòng tròn, dấu phẩy/nháy/xuống dòng, BOM, chống `=`/`@` |
| Biểu đồ SVG | `charts.js` | XML hợp lệ, không `NaN`, dữ liệu rỗng |
| Bộ kiểm | `APP/kiem.js` | `node kiem.js` exit 0; `node ../kiem-tat.js` xanh |

**Xong khi:** `node kiem.js` toàn `[ok]`.

## Phase 2 — Backend `/spending` · phụ thuộc: hợp đồng §5 (chạy song song với Phase 1, giao cho một tác tử riêng)

| Việc | Tệp |
|---|---|
| VO, port vào/ra | `BE/src/domain/vo/spending_vo.py`, `application/ports/{input,output}/spending_*_port.py` |
| Usecase (khoá, revision, kích thước, CAS) | `application/usecases/spending_usecase.py` |
| 3 kho | `adapter/output/spending/{json,mysql,mongo}_repository.py` |
| Factory + controller + đăng ký | `adapter/factory/spending_factory.py`, `adapter/input/controllers/spending_controller.py`, `main.py` |
| Cấu hình + tài liệu | `config.py`, `.env.example`, `README.md` |
| Test | `tests/application/test_spending_usecase.py`, `tests/adapter/output/spending/test_spending_repositories.py`, `tests/adapter/input/controller/test_spending_controller.py` |

**Xong khi:** `pytest` các file mới xanh **và** toàn bộ suite cũ không đổi kết quả (đối chiếu trước/sau).

## Phase 3 — Lưu trữ & đồng bộ phía client · phụ thuộc: P1 (`sync.js`, `model.js`), hợp đồng §5

| Việc | Tệp | Kiểm bằng |
|---|---|---|
| `LocalStore` (localStorage, bắt lỗi đầy, ghi 2 lớp) | `store.js` | storage giả: đầy bộ nhớ, JSON hỏng |
| `RemoteStore` (fetch, bóc envelope, ánh xạ 401/404/409/mạng) | `store.js` | fetch giả |
| `Engine`: mutate→debounce→push, 409→gộp→thử lại, offline/online, pull `since`, đổi chế độ, đẩy/kéo/sao chép | `store.js` | kịch bản: A/B hai thiết bị, offline rồi online, 401, `unchanged` |

**Xong khi:** các ca trong `kiem.js` mục Đồng bộ xanh.

## Phase 4 — Vỏ giao diện + nhập liệu + danh sách + tổng quan · phụ thuộc: P1, P3

`index.html`, `kieu.css`, `ui.js`, `views.js`, `app.js`: router băm (`#/tong-quan`…), thanh bên/thanh dưới, tờ nhập (nhập nhanh + biểu mẫu + mẫu nhanh), danh sách nhóm ngày + tìm/lọc + hoàn tác, Tổng quan, trạng thái đồng bộ, chủ đề, onboarding + dữ liệu mẫu.

**Xong khi:** thêm giao dịch bằng `cơm trưa 57/2 hôm qua ⏎` ra đúng; tải lại vẫn còn; không lỗi console.

## Phase 5 — Các màn còn lại · phụ thuộc: P4

Báo cáo (kỳ, donut, cột ngày/thứ, xu hướng, sao chép/in) · Chia tiền (số dư, chi tiết, quyết toán + tin nhắn, người) · Tài khoản (số dư, chuyển, sổ tiết kiệm: gửi/tất toán/tái tục) · Kế hoạch (hạn mức, định kỳ + xác nhận) · Cài đặt (kết nối MySQL/MongoDB, mã kết nối, sao lưu/khôi phục, CSV, nhập hàng loạt, danh mục, xoá dữ liệu, phím tắt) · máy tính chia hoá đơn (C).

## Phase 6 — Trau chuốt · phụ thuộc: P5

Responsive 360/768/1440, vùng chạm 44 px, focus, `prefers-reduced-motion`, in, trạng thái trống/lỗi, văn bản tiếng Việt thống nhất.

## Phase 7 — Tự kiểm tích hợp · phụ thuộc: P2, P6

`PRJ/selftest/run.py`: (1) `node kiem.js` (2) pytest các file spending (3) uvicorn thật + SQLite + kịch bản HTTP cho `json`/`mysql`(SQLite)/`mongo` (Mongo thật nếu `MONGO_URI` đặt, không thì ghi rõ "bỏ qua") (4) trình duyệt thật (Playwright nếu có; dùng Edge cài sẵn) ở 3 cỡ màn: không lỗi console, không tràn ngang, vùng chạm ≥ 44, nhập nhanh, thanh dưới, XSS, sáng/tối, chụp ảnh vào `PRJ/selftest/out/`.

## Phase 8 — Xuất bản & báo cáo

`metadata.json`, kiểm portal liệt kê app (`/webapp/_api/list`), `node ../kiem-tat.js`, chạy `selftest` lần cuối, viết `implement-progress.md` (hoàn chỉnh), `report.md`, `ban-giao.md`.

## Thứ tự và song song

```
P0 ─► P1 ─► P3 ─► P4 ─► P5 ─► P6 ─┐
  └──► P2 (tác tử riêng, song song) ─┴─► P7 ─► P8
```

## Tiêu chí hoàn thành chung

- `node APP/kiem.js` · `node APP/../kiem-tat.js` · `pytest` (mới + toàn bộ) · `selftest/run.py` đều xanh hoặc có ghi chú rõ phần *bỏ qua vì thiếu môi trường*.
- Đối chiếu đủ 10 số PDF + A1–A6 trong requirements §6.
- Báo cáo nêu rõ điều **chưa** kiểm được.
