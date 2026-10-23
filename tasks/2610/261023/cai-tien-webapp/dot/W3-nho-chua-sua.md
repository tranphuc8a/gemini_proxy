# W3 — góp ý nhỏ của người kiểm độc lập (CHƯA sửa)

W3 đạt kiểm độc lập vòng 2 (0 blocking, 24/10 03:24). Điểm dưới đây ở mục "nhỏ"; workflow không sửa vì không có vòng sửa blocking.

1. **Thiếu test ép `VERIFY_PASSES=4`:** vòng lặp `verify_links` / `verifyLinks` tới điểm cố định không có test nào ép; cắm đột biến `VERIFY_PASSES=1` thì `-k "ai_wiki or ai_controller"` vẫn xanh. Dò ngẫu nhiên 40.000 chuỗi: một vòng không bất biến ở 57 chuỗi. Thêm vài ca cố định từ các chuỗi đó vào fixture dùng chung.
2. **`repo.related` chưa đo trên IndexedDB 100.000 note** (W3.md đã nói). Đoạn dán đầy từ phổ biến vẫn đọc hết danh sách khớp (~100k mục/token); `--hieu-nang` đo tìm một từ phổ biến ở kho 100.000 note ≈ 400–60x ms (xem báo cáo) — cao hơn ngưỡng thiết kế 300 ms. Cân nhắc cắt sớm theo `df`.
3. `ai_wiki_usecase.py` nhập `_unwrap` (tên gạch dưới) từ `ai_markdown_usecase` — nên chuyển cạnh `strip_code_fence` trong `ai_usecase.py` thành hàm công khai dùng chung.
4. Tiêu đề ứng viên dài hơn 200 ký tự bị cắt; tiêu đề chứa `|` hoặc `]]` được máy chủ ghi nguyên chữ cắt/ký tự lạ vào `[[…]]`. Trang kiểm lại bằng `repo.resolve` lúc áp dụng nên chỉ thành chữ thường, không hỏng dữ liệu. Hiếm.
5. `dot/W3.md` lệch nhẹ: mục "Tệp đổi" đầu tệp vẫn ghi "Không đụng `notes.js`/`markdown.js`" trong khi mục "Sửa sau kiểm" đã sửa cả hai và chạy `sync.py`.
6. Notebook mới chạy `--tinh`/`--chuc-nang`; chưa chạy `--song-sot`/`--co-gian`/`--hieu-nang`/`--ma`.
7. `markdown.render` (xem trước) còn ca bậc hai có từ trước: `[a](` ×10.000 ≈ 2 s, `**a `/`~~a ` ×10.000 ≈ 0,5 s → làm ở W5.
8. Môi trường: `AI_ENABLED=false` làm 6 test `test_send_message_endpoint` đỏ (cần AI bật) — chỉ đặt biến này cho script nháp, không đặt khi chạy pytest chuẩn. Đã sửa lời trong `nhap/workflow/dot-2.js`.
9. Đề xuất `CLAUDE.md` (việc 13, chưa tự sửa): thêm tầng `check.py --ai` và mục cạm bẫy "regex chạy trên đầu ra AI / dữ liệu người dùng phải tuyến tính; hai bản luật liên kết JS/Python dùng chung `kiem-lien-ket.json`".
