# Khoá luyện thi OPIc — bàn giao

**Ngày:** 2026-10-01 · **Nhánh:** `lab/dot-7-va-kiem-trinh-duyet` · **Thư mục:**
`backend/fastapi/webapp/courses/opic-course/` · **Chưa commit.**

> **Cập nhật 2026-10-02:** nội dung OPIc đã chuyển vào database cùng mọi khoá khác.
> `content/`, `tools/` và `build.py` nay ở `backend/course-content/opic/`; `build.py` sinh
> `backend/course-content/opic.json`; trang tải `/courses/opic/bundle`. Đường dẫn bên dưới
> là trạng thái ngày 01. Xem [khoa-hoc-database-ban-giao.md](khoa-hoc-database-ban-giao.md).

Một trang mới trong bộ sưu tập `courses/`: **hướng dẫn thi OPIc + 185 script mẫu +
công cụ luyện nói**, dựng từ ba tệp người dùng đưa ở `C:\Users\tranphuc8a\Desktop\opic`
(`opic_guideline.pdf` 23 trang ảnh quét, `script.md`, `script-2.md`). Bản gốc ba tệp
đó **không bị sửa**.

---

## 1. Đã làm gì

| Việc | Kết quả |
|---|---|
| Đọc PDF guideline | 23 trang chỉ là ảnh quét (pdftotext trả rỗng) → tách ảnh JPEG nhúng bằng Python thuần, thu nhỏ bằng Pillow, đọc bằng mắt. Viết lại thành **10 bài hướng dẫn** tiếng Việt (`content/huong-dan/`), giữ đúng khuyến nghị gốc (chọn survey, 9 chủ đề, 15 câu, 7 dạng, mẹo phòng thi) và thêm ba bài tự soạn: lộ trình 14 ngày, một đề đã thi ghép với script, khung câu / từ nối |
| Tách `script.md` (bộ A) | 66 câu + 16 role-play, nhân vật Son. Tiêu đề tiếng Việt có sẵn; **câu hỏi tiếng Anh do tôi viết** theo giọng đề OPIc (không có trong nguồn) |
| Tách `script-2.md` (bộ B) | 103 câu (gồm 4 biến thể `…b`), nhân vật Toàn. Câu hỏi tiếng Anh có sẵn; **câu hỏi tiếng Việt do tôi tóm tắt**. **Sửa ~100 lỗi chính tả / ngữ pháp rõ ràng** (spaceful, Fistly, clothers, "I can only used", "lovely balconyIn the living room"…) — bảng sửa nằm trong `tools/sinh-noi-dung.py` |
| Phân loại | 17 chủ đề (9 trọng tâm theo guideline + giới thiệu, nhà cửa, diễn, dịch vụ, gia đình, kỳ nghỉ, công việc / giáo dục), 8 dạng câu hỏi, thời gian gợi ý theo dạng |
| Site | `index.html` + `assets/app.css` + `assets/logic.js` + `assets/app.js`, không thư viện ngoài, chạy `file://`. Trang chủ · hướng dẫn · chủ đề · script (máy đọc, 5 chế độ che, đồng hồ, ghi âm IndexedDB, script của tôi, ghi chú, trạng thái) · luyện thẻ Leitner · thi thử 15 câu đúng cấu trúc · tiến độ (bản đồ nhiệt, xuất / nhập JSON) · tìm kiếm không dấu |
| Build & kiểm | `build.py` (content/ → content.js, kiểm lỗi nội dung), `kiem-nhanh.js` (50 phép kiểm Node, trong đó 450 đề thi thử), `check.py` ba tầng (tĩnh · Node · Chromium) — **tất cả đạt, 0 lỗi** |
| Portal | `metadata.json` (category "Khoá học", icon 🎙️) → cổng `_portal` tự liệt kê |

---

## 2. Quyết định đáng ghi

1. **Không dùng engine `courses/engine/app.js`** của ba khoá kia. Engine đó là trang đọc
   bài giảng markdown; trang này cần dữ liệu có cấu trúc (câu hỏi → từng câu nói) và
   công cụ thời gian thực (đồng hồ, ghi âm, thẻ, thi thử). Chỉ dùng chung hệ token màu
   và chữ để đứng cạnh nhau không lạc tông; màu nhấn mới: hổ phách `#b45309`.
2. **`content/` là nguồn sự thật**, không phải hai tệp `.md` gốc. Hai script
   `tools/tach-script-goc.py` → `tools/sinh-noi-dung.py` là công cụ *một lần* đã dùng;
   chạy lại sẽ ghi đè mọi chỉnh tay. Mọi quyết định dữ liệu (chủ đề, dạng, câu hỏi
   EN/VI, bảng sửa lỗi) nằm trong `sinh-noi-dung.py` để tra lại được.
3. **Markdown tự viết** (~120 dòng) thay vì `marked` từ CDN: trang này hướng tới luyện
   mọi lúc, kể cả offline.
4. **Logic tách khỏi DOM** (`logic.js`): sinh đề, Leitner, tìm kiếm, thống kê kiểm được
   bằng Node, không cần trình duyệt — cùng tinh thần `engine/thu-nhanh.js`.
5. **Sửa lỗi tiếng Anh bộ B** thay vì giữ nguyên: đây là script *mẫu* để học thuộc,
   giữ "I can only used it" là dạy sai. Bản gốc ngoài repo không đổi.

---

## 3. Bốn lỗi bắt được bằng bộ kiểm

| Lỗi | Tầng bắt | Sửa |
|---|---|---|
| Đề thi thử lấy câu 14–15 **khác chủ đề** ở một số hạt giống | Node (`sinhDe` 450 đề) | gộp `pool` với `tatCa` rồi đếm → một câu đếm hai lần, chủ đề có 1 câu tưởng có 2. Nay đếm trên pool trước, không đủ mới mở ra toàn kho |
| Tìm "nha cua" ra 19 script trước, **chủ đề** Nhà cửa đứng sau | Node | tên chủ đề nặng 130 thay vì 100 (bằng câu hỏi) |
| `pageerror: Cannot read properties of null` khi gõ vào ô script | Chromium | listener `change` gắn vào `#main` (sống qua mọi trang) từ trang Luyện thẻ; nay gắn vào khung cấu hình của trang đó |
| `#/luyen?cd=nha-cua` báo "không có trang" | tự đọc lại | router không tách `?…` khỏi hash |

Hai phép kiểm Node viết sai kỳ vọng (đếm nhầm 11 thay vì 12 từ) — sửa phép kiểm,
không sửa mã.

---

## 4. Trạng thái kiểm tra

| Tầng | Lệnh | Kết quả |
|---|---|---|
| Tĩnh | `python check.py --tinh` | **Đạt** — content khớp, thứ tự script đúng, cú pháp JS sạch |
| Node | `node kiem-nhanh.js` | **Đạt** — 50 phép kiểm |
| Chromium | `python check.py --anh` | **Đạt** — 10 tuyến, 7 tương tác, 0 lỗi console; ảnh ở `anh-kiem/` (git bỏ qua) |

---

## 5. Giới hạn & còn nợ

1. **Ghi âm cần ngữ cảnh an toàn** (`localhost` / `https` / qua FastAPI). Mở bằng
   `file://` Chrome có thể chặn `getUserMedia`; trang báo rõ thay vì im lặng.
2. **Máy đọc** phụ thuộc giọng tiếng Anh của hệ điều hành; không có giọng thì nút Nghe
   báo không hỗ trợ.
3. Tài liệu gốc nhắc **"10 đề quan trọng"** (tệp Word) và **tệp Excel script mẫu** —
   hai tệp đó không có trong `Desktop/opic`, chỉ có một đề in trong PDF (bài hướng dẫn
   8). Mục Thi thử sinh đề thay thế.
4. Đề mẫu trong PDF có **ba bài diễn về phim** (gọi rạp, đến rạp không vào được, báo
   bạn không đi được); bộ A chưa có bài diễn về phim — nên viết thêm 3 script
   `AR17–AR19` trong `content/scripts/17-dien.md`.
5. Chip dạng câu hỏi: bộ kiểm bảng màu `dataviz` cảnh báo vài cặp kề nhau cho người mù
   màu; chấp nhận vì chip luôn kèm chữ, không có biểu đồ nào phân biệt bằng màu.
6. Chưa commit. Chưa đẩy portal (`_portal` tự quét thư mục nên không cần đăng ký).

---

## 6. Việc tiếp theo

- Người học: đọc bài 1–5, rồi với mỗi câu trọng tâm viết *Script của tôi* (ô dưới
  script mẫu), ghi âm, chấm thẻ. Lộ trình ở bài 9.
- Viết thêm bài diễn về phim (mục 5.4) và một bộ ba miêu tả – so sánh – kinh nghiệm cho
  **đi bộ** (hiện chủ đề Chạy bộ & đi bộ chỉ có 3 câu, mà đề mẫu ra câu 14–15 về đi bộ).
- Commit: `feat(courses): khoá luyện thi OPIc — hướng dẫn, 185 script, luyện thẻ, thi thử`.

---

## 7. Lệnh

```bash
cd backend/fastapi/webapp/courses/opic-course
python build.py                 # sau khi sửa content/
python check.py --tinh          # tĩnh + Node
python check.py --anh           # + Chromium, chụp ảnh
python -m http.server 8793 --bind 127.0.0.1   # chạy thử có ghi âm
```
