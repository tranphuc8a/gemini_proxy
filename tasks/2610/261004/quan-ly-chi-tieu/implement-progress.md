# Tiến độ triển khai

Cập nhật cuối: 2026-10-06. Tất cả phase xong. ✅ xong · ⚠ xong nhưng có điều chưa kiểm được (xem `report.md` §5).

| Phase | Nội dung | Trạng thái |
|---|---|:--:|
| 0 | `requirements.md`, `design.md`, `implementation-plan.md` | ✅ |
| 1 | Lõi logic thuần: `text money dates model ledger parser sync csv charts` + `kiem.js` | ✅ |
| 2 | Backend `/spending` (giao cho một tác tử; tôi kiểm lại độc lập) | ⚠ MySQL qua SQLite, Mongo qua fake |
| 3 | Lưu trữ & đồng bộ phía client (`store.js`: local + remote + engine) | ✅ |
| 4 | Vỏ UI, nhập liệu, danh sách, tổng quan | ✅ |
| 5 | Báo cáo, chia tiền, tài khoản/tiết kiệm, kế hoạch, cài đặt, hoá đơn, CSV, sao lưu | ✅ |
| 6 | Responsive 360→1440, vùng chạm, tương phản AA, chủ đề tối, in | ⚠ in (Ctrl+P) chưa kiểm bằng mắt |
| 7 | Tự kiểm tích hợp `quan-ly-chi-tieu/selftest/run.py` (5 tầng) | ✅ 160 đạt · 0 sai · 1 bỏ qua (Mongo thật) |
| 8 | Xuất bản (`metadata.json`, portal liệt kê), `report.md`, `ban-giao.md` | ✅ |

## Nhật ký (theo thứ tự làm)

1. **Đọc PDF.** `pdftotext` ra rỗng (PDF là ảnh); cài PyMuPDF vào venv tạm ngoài dự án, render 28 trang, đọc từng trang. Rút ra: nhật ký chia tiền với bạn cùng phòng, lương/thưởng, sổ tiết kiệm có kỳ hạn, hoá đơn trọ, định kỳ. Mật khẩu wifi ở trang 3 **không** được chép vào tài liệu/app.
2. **Khảo sát backend.** Tìm thấy mẫu `postman` (workspace + khoá băm + `revision` + kho json/mysql/mongo) → dùng lại kiến trúc thay vì phát minh. App cũ `tranphuc8a/chi-tieu` giữ nguyên.
3. **Tài liệu 1–3** (requirements/design/plan). Quyết định chính: vanilla JS không build (đúng quy ước thư mục), đồng bộ theo tài liệu + gộp LWW + bia mộ, lưu có điều kiện nguyên tử ở cả 3 kho.
4. **Phase 2 song song** — tác tử backend làm `/spending`; trong lúc đó tôi viết lõi JS. Tác tử báo: 91 test mới, suite 902 → 993. Tôi chạy lại: 91 đạt; toàn suite 993 đạt.
5. **Phase 1.** Các con số tính tay trong PDF được dùng làm phép kiểm đối chiếu (128.750 · 124.250 · 215.250 · 89.250 · 2.828.000 · 1.252.500 · 1.033.200 · 970.000 · 589.000 · 37.000) — **10/10 đúng**.
6. **Phase 3.** Máy chủ giả trong `kiem.js` mô phỏng đúng hợp đồng API. Phủ: 409→gộp→thử lại, offline→online, tắt app lúc còn chưa đồng bộ rồi mở lại, 401, 404, quá lớn, sửa giữa lúc đang đẩy.
7. **Phase 4–5.** UI viết xong và chạy được ngay lần đầu mở bằng Edge thật; 7 màn hình vẽ ra, chỉ 1 lỗi console (favicon 404).
8. **Phase 7 — những gì selftest bắt được** (xem `report.md` §4): bấm Hoàn tác trúng toast cũ; dòng giao dịch dính chữ trên điện thoại; `file://` bắn request vô nghĩa; hai cặp màu dưới 4,5:1; tìm "com" ra "Techcombank"; tìm kiếm 260 ms và mỗi lần sửa 196 ms với 10.000 khoản.
9. **Tối ưu:** nhớ danh sách từ đã bỏ dấu theo từng giao dịch (tìm 222 → 10 ms), tính dung lượng sổ một lần mỗi lần ghi (sửa 196 → 82 ms).

## Số liệu cuối

| Bộ kiểm | Kết quả |
|---|---|
| `node kiem.js` | 430 phép kiểm đạt |
| `node webapp/tranphuc8a/kiem-tat.js` (cả 4 app tự viết) | 608 đạt — 3 app cũ nguyên vẹn |
| pytest `/spending` | 91 đạt |
| pytest toàn bộ backend | **993 đạt** (902 cũ + 91 mới), 0 hồi quy |
| `selftest/run.py` (tĩnh · node · pytest · API thật · Edge thật) | 160 đạt · 0 sai · 1 bỏ qua |
| Kích thước | HTML+JS+CSS ≈ 285 KB chưa nén (giới hạn 300 KB), không thư viện ngoài |
