# Hướng dẫn rà soát và sửa lỗi nội dung bài giảng (`heuristic-2`)

Mục tiêu: tìm và **sửa** những chỗ SAI trong bài giảng — sai số, sai logic, mâu thuẫn trong một bài hoặc giữa các bài, tham chiếu chéo sai, mã minh hoạ sai — mà **không làm hỏng** những gì đang đúng và hay.
Bạn là người rà soát độc lập: **đừng tin** danh sách lỗi đã biết (do tác tử khác ghi lại khi soạn bài thực hành); hãy tự kiểm chứng từng mục rồi mới sửa.

## Nguồn và đích

- Markdown của từng bài (nguyên văn, chỉ đọc): `C:\Users\TRANPH~1\AppData\Local\Temp\claude\c--Users-tranphuc8a-Desktop-gemini-proxy\ecb3004f-40aa-49db-8dd3-b13dda001252\scratchpad\md\` — tên tệp là slug đổi `/` thành `__`
  (vd `khoa-hoc__bai-05-greedy.md`, `2607__03-de-xuat-cai-tien.md`, `case-2609__tong-quan.md`, `tai-lieu__cheatsheet.md`). `khoa-hoc__dap-an.md` là đáp án bài tập, chia theo mục `## Bài N`.
- Đích: **một tệp vá JSON** `backend/course-content/heuristic-2/sua-loi/<nhom>.json` (xem định dạng ở `ap-dung-sua-loi.py`). Bạn **không** sửa bundle, không sửa tệp nào khác ngoài tệp vá và báo cáo của bạn. Không chạy git.
- Kiểm tra bản vá: `cd backend/course-content/heuristic-2 && PYTHONUTF8=1 python ap-dung-sua-loi.py --thu sua-loi/<nhom>.json` — mỗi `old` phải xuất hiện **đúng một lần** trong bài (tính trên bản gốc; nhiều bản vá cùng một bài áp tuần tự nên `old` của bản vá sau không được nằm trong chỗ đã bị bản vá trước thay).
- Báo cáo: `backend/course-content/heuristic-2/sua-loi/<nhom>-bao-cao.md` (tiếng Việt, cô đọng) + tóm tắt trong tin nhắn cuối.

## Việc phải làm với mỗi bài được giao

1. **Đọc toàn bộ bài**, theo thứ tự, như một người học cẩn thận. Ghi lại mọi con số, công thức, khẳng định, ví dụ làm tay, đoạn mã.
2. **Tự tính lại bằng code** (python/node; `g++` ở `/c/devtools/mingw/mingw64/bin` — `export PATH="$PATH:/c/devtools/mingw/mingw64/bin"`): phép cộng/nhân/phần trăm trong bảng và ví dụ, tổng cột, công thức đếm, xác suất,
   ví dụ làm tay từng bước, lịch trình/thứ tự trong ví dụ, độ phức tạp, đoạn mã C++ (biên dịch + chạy với dữ liệu nhỏ nếu có thể).
3. **Kiểm logic**: lập luận có thực sự dẫn tới kết luận không? định lý có đủ giả thiết không? so sánh có cùng mẫu số/cơ sở không? "nhanh hơn/tốt hơn" có đúng chiều không? câu chữ trong bài có tự mâu thuẫn giữa các mục không?
4. **Kiểm tham chiếu**: "§x.y", "Bài N", "bảng ở …", "ví dụ ở …" có trỏ đúng không? Liên kết sang bài khác có trích đúng điều bài đó nói không? (Đọc bài được trích.)
5. **Kiểm với đáp án** (`dap-an.md`, mục của bài bạn): đáp án có khớp đề, khớp bài giảng, đúng về toán không?
6. **Kiểm chứng danh sách lỗi đã biết** (mục `Mục số …` ở `tasks/2610/261010/heuristic-thuc-hanh/phat-hien-bai-giang.md` mà nhóm của bạn được giao): mỗi mục → "xác nhận (có bằng chứng tính lại)", "không xác nhận", hoặc "một phần". Chỉ sửa mục đã xác nhận.
7. **Sửa** bằng bản vá nhỏ nhất đủ làm cho đúng. Rồi **đọc lại đoạn đã sửa trong ngữ cảnh** (câu trước/sau, bảng, mục tóm tắt, bảng thuật ngữ cuối bài) để chắc không để lại mâu thuẫn mới; nếu một con số xuất hiện ở nhiều chỗ trong bài (mở đầu, thân, tóm tắt, đáp án) thì sửa **mọi chỗ**.

## Quy tắc sửa (nghiêm)

- **Chỉ sửa cái SAI hoặc MÂU THUẪN kiểm chứng được.** Không viết lại cho "hay hơn", không đổi giọng văn, không thêm nội dung mới ngoài lời chữa/ghi chú cần thiết. Mục đích sư phạm, thứ tự, cấu trúc bài: giữ nguyên.
- **Số đo thực nghiệm** (bảng điểm, mili-giây, % do chạy mã C++ gốc, mã đó KHÔNG có trong repo): **không đổi** vì không tái lập được. Nếu hai chỗ trong bài nói hai số khác nhau cho cùng một đại lượng, hãy xác định cái nào được các phép tính khác trong bài ủng hộ; nếu không phân định được → không sửa số, thêm một câu làm rõ cơ sở/nguồn hoặc ghi vào báo cáo mục "chưa phân định được".
  Số **suy ra** (cộng, %, tỉ lệ, đếm, công thức) thì tính lại và sửa nếu sai.
- **Không bịa**: không thêm con số, trích dẫn, bài báo, kết quả thực nghiệm mà bạn không kiểm chứng được. Nếu một khẳng định vượt quá bằng chứng trong bài → hạ cho đúng mức ("khoảng", "trong bộ dữ liệu này", "chỉ đúng khi …") thay vì xoá.
- **Giữ định dạng**: bài dùng markdown + **TeX** (`$…$`, `$$…$$` cho KaTeX), bảng `| … |`, khối mã, hộp `> 📌/⚠️/❌/✅`, `<details>`. Khi sửa công thức/bảng hãy dùng đúng ký pháp của đoạn xung quanh. Sửa bảng thì sửa đúng ô, giữ thẳng cột.
- **Mã**: sửa lỗi cú pháp/logic thật (không biên dịch được, sai kết quả); không đổi phong cách. Mã trong bài cố ý không `#include` thì giữ nguyên tinh thần, chỉ nêu rõ điều kiện (vd cần `typedef`).
- Mỗi bản vá một lý do: trường `ly_do` bắt đầu bằng nhãn `[SỐ]`, `[LOGIC]`, `[MÂU THUẪN]`, `[THAM CHIẾU]`, `[MÃ]` hoặc `[NHỎ]`, rồi nêu **bằng chứng** (số đã tính lại, hai câu mâu thuẫn, dòng mã lỗi…).
- `old` ngắn nhưng duy nhất (một câu, một dòng bảng, một dòng mã); không dán cả đoạn dài khi chỉ sửa một con số. Với nhiều chỗ giống nhau, thêm ngữ cảnh để `old` duy nhất, hoặc tách bản vá.
- Chỗ sai nhưng **không thể sửa chắc chắn** (thiếu dữ liệu gốc, cần quyết định sư phạm của tác giả): KHÔNG sửa; ghi vào báo cáo mục "Cần tác giả quyết định" kèm trích dẫn và đề xuất.
- Phân loại: `[SỐ]` sai số/phép tính · `[LOGIC]` lập luận/khẳng định sai · `[MÂU THUẪN]` tự mâu thuẫn trong bài hoặc giữa bài · `[THAM CHIẾU]` tham chiếu chéo sai · `[MÃ]` mã sai · `[NHỎ]` lỗi nhỏ (chính tả/ký hiệu làm sai nghĩa).

## Quyết định thống nhất cho các mâu thuẫn giữa nhiều bài (mỗi nhóm chạy song song, nên tuân theo để các bài khớp nhau)

1. **Ngưỡng "độ hở tới cận trên" quyết định làm gì tiếp**: bản gốc ở **Bài 18 §6** là chuẩn. Nhóm Bài 18 chỉ sửa nếu bảng đó tự mâu thuẫn *bên trong Bài 18*. Nhóm Bài 20 (§8.3) và Bài 23 (§4) **đồng bộ cách nói theo đúng ngưỡng của Bài 18 §6** (đọc `khoa-hoc__bai-18-can-tren-can-duoi.md`), không tự đặt ngưỡng khác.
2. **Bộ cờ cảnh báo trình biên dịch**: chuẩn là mục về cờ ở **Bài 19**. `-Wreturn-type` đã nằm trong `-Wall` (và mặc định bật ở C++). Nhóm Bài 19B/20 đồng bộ theo Bài 19 và theo sự thật về g++.
3. **Đánh số phiên bản solver**: chuẩn là **Bài 22 (v1…v7)**. Bài 21 và các bài khác trích dẫn phải khớp Bài 22.
4. **Tốc độ máy dùng để đổi "số phép ↔ thời gian"**: chuẩn là **Bài 2** (≈ 10⁹ phép đơn giản/giây ⇒ 100 ms ≈ 10⁸ phép). Bài kiểm tra đầu vào, Bài 1, Bài 3… không được nói con số khác mà không giải thích (ví dụ "10⁷ là ngân sách an toàn vì mỗi phép tốn cỡ 10 lệnh").
5. **"ρ chính là λ" (Bài 16 §4.3, Bài 23 §1.3)**: chỉ đúng khi f là điểm *gộp*; khi f đã là giá trị ròng (đã trừ λ·c) thì ρ ≠ λ. Sửa cho nêu đúng điều kiện (không xoá ý chính của bài).
6. **"3/4 cải tiến lớn nhất đến từ đọc mã grader"** (Bài 20 §3.1, Bài 23 §3, 2607/05 §5): chuẩn là **bảng ablation của ca 2607** (`2607__03-de-xuat-cai-tien.md` và các bảng điểm trong `2607__*`). Mỗi nhóm tự tính lại từ bảng đó và sửa câu trong bài của mình cho khớp số thật (đừng đoán).

## Nội dung nhóm khác đang sửa song song

Nhiều nhóm cùng sửa các bài khác nhau. Chỉ sửa bài/mục được giao. Gặp lỗi ở bài ngoài nhóm → ghi vào báo cáo mục "Phát hiện ngoài phạm vi" (kèm trích dẫn nguyên văn và tên bài) để người điều phối chuyển cho nhóm phụ trách.

## Báo cáo cuối (≤ 1,5 trang)

- Số bản vá theo nhãn; bài nào, mục nào.
- Với mỗi mục đã biết được giao: xác nhận / không xác nhận / một phần (+ bằng chứng ngắn).
- Lỗi mới bạn tự tìm ra (ngoài danh sách đã biết).
- Mục **"Cần tác giả quyết định"** và **"Chưa phân định được"**.
- **"Phát hiện ngoài phạm vi"**.
- Nội dung bài thực hành `backend/fastapi/webapp/courses/heuristic-practice-2/data/<id>.js` (nếu bạn biết) có thể đang trích lại chỗ vừa sửa — liệt kê (tệp + từ khoá) để người điều phối đồng bộ.
- Kết quả lần chạy `ap-dung-sua-loi.py --thu` cuối của bạn.
