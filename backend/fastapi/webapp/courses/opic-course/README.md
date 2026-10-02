# Khoá luyện thi OPIc

Trang luyện nói OPIc theo script: **10 bài hướng dẫn** (viết lại từ 23 trang tài liệu
gốc), **185 script mẫu** chia theo **17 chủ đề**, và các công cụ để học thuộc rồi nói
đi nói lại — máy đọc, che dần script, đồng hồ 1′–2′, ghi âm, luyện thẻ lặp lại ngắt
quãng, thi thử 15 câu đúng cấu trúc, ô viết script của riêng mình.

> **Nội dung nằm trong database**, như mọi khoá khác (slug `opic`). Trang chỉ có
> giao diện; lúc mở nó tải `GET /courses/opic/bundle` (≈ 250 KB, gzip ≈ 80 KB — đủ nhỏ
> để tải một lần, vì luyện thẻ và thi thử cần cả kho script) rồi đổi về dạng riêng
> bằng `OPICL.tuBundle`. Không framework, không bước build cho trang.

---

## Chạy

```bash
cd backend/fastapi
python tools/manage_courses.py import ../course-content/opic.json     # một lần; --yes nếu đích là MySQL thật
uvicorn src.main:app --port 6789
# mở http://127.0.0.1:6789/webapp/courses/opic-course/
```

Trang mở từ máy chủ tĩnh hay `file://` thì thêm `?api=http://127.0.0.1:6789` (chỉ nhận API
ở máy cục bộ hoặc khi trang mở từ `file://`). Muốn chạy
offline hoàn toàn: tạo một tệp đặt `window.OPIC = …` (dạng sau `OPICL.tuBundle`) và nạp
nó trước `logic.js` — `app.js` thấy `window.OPIC` thì không gọi API.

> 🎙️ **Ghi âm cần ngữ cảnh an toàn** (`http://localhost`, `https://`, hoặc qua FastAPI).
> 🔊 Máy đọc dùng giọng tiếng Anh có sẵn trong hệ điều hành (Web Speech API).

---

## Trang có gì

| Mục | Nội dung |
|---|---|
| **Trang chủ** | KPI (script đã thuộc, thẻ đến hạn, chuỗi ngày, lần luyện hôm nay), thẻ “học tiếp”, 17 chủ đề kèm tiến độ, 10 bài hướng dẫn |
| **Hướng dẫn** | OPIc là gì · cấu trúc 20′+40′ · chọn Background Survey · 15 câu hỏi · **7 dạng câu hỏi và khung script** · chuẩn bị script · mẹo phòng thi · một đề đã thi · lộ trình 14 ngày · khung câu và từ nối |
| **Chủ đề** | danh sách câu hỏi, lọc theo bộ / dạng / trạng thái |
| **Script** | câu hỏi VI + EN (nghe được) · từng câu bấm để nghe · 5 chế độ che · *Script của tôi* tự lưu · ghi chú · trạng thái + sao · đồng hồ · ghi âm (giữ 5 bản / câu) · giọng đọc, tốc độ |
| **Luyện thẻ** | Leitner 1·3·7·14·30 ngày; lọc bộ / chủ đề / dạng |
| **Thi thử** | 15 câu đúng cấu trúc, Ava đọc 2 lần, đồng hồ theo dạng, tự ghi âm, lịch sử |
| **Tiến độ** | theo chủ đề, bản đồ nhiệt 12 tuần, xuất / nhập JSON |

Tiến độ, script của tôi, ghi chú lưu trong `localStorage` (tiền tố `opic.`); bản ghi âm
trong IndexedDB `opic-ghi-am`.

---

## Bản đồ tệp

```text
webapp/courses/opic-course/          ← chỉ giao diện (vào bundle Vercel)
├── index.html
├── assets/
│   ├── app.css
│   ├── logic.js        logic thuần + OPICL.tuBundle (bundle chung → dạng riêng); Node nạp được
│   └── app.js          giao diện; tải /courses/opic/bundle rồi chạy
├── check.py            3 tầng: tĩnh · Node · FastAPI thật + Chromium
├── kiem-nhanh.js       kiểm logic thuần bằng Node (đọc opic.json qua tuBundle)
└── metadata.json

backend/course-content/              ← nguồn soạn thảo (ngoài Root Directory của Vercel)
├── opic.json           bundle sinh ra — định dạng chung của mọi khoá
└── opic/
    ├── build.py        content/ → ../opic.json (kiểm lỗi nội dung)
    ├── content/scripts/NN-<chu-de>.md     mỗi tệp một chủ đề
    ├── content/huong-dan/NN-<slug>.md     bài hướng dẫn
    └── tools/          công cụ MỘT LẦN đã dùng để tách script.md / script-2.md
```

---

## Sửa nội dung

Hai cách, chọn một cho mỗi lần sửa:

1. **Sửa trong database** — trang [Quản lý khoá học](../quan-ly-khoa-hoc/) (khoá `opic`):
   mỗi câu hỏi là một bài `kind=script` (tiêu đề = câu hỏi tiếng Việt, markdown = các câu
   nói, mỗi dòng một câu, `meta = {en, dang, phut, bo, so}`); mỗi chủ đề là một nhóm trong
   section `chu-de` (`meta = {icon, uuTien, moTa, thuTu}`). Có hiệu lực ngay.
2. **Sửa tệp nguồn** — `backend/course-content/opic/content/…`, rồi:

   ```bash
   cd backend/course-content/opic
   python build.py                                          # → ../opic.json
   python ../../fastapi/tools/manage_courses.py import ../opic.json
   ```

   Nạp bundle **thay toàn bộ** khoá: sửa trong database mà chưa đưa về tệp nguồn sẽ mất.
   Trước khi nạp, xuất bản hiện tại nếu cần: `manage_courses.py export opic -o …`.

Định dạng tệp chủ đề (`content/scripts/NN-<id>.md`):

```markdown
---
id: am-nhac
ten: Âm nhạc
icon: 🎵
thu-tu: 3
uu-tien: 1          # 1 trọng tâm · 2 hay gặp · 3 ít gặp
mo-ta: Một câu nói chủ đề này gồm gì.
---

## A17 · Câu hỏi tiếng Việt
- en: English question, as Ava would ask it.
- dang: mieu-ta      # gioi-thieu | mieu-ta | thoi-quen | so-sanh | kinh-nghiem | y-kien | dien | tinh-huong

Mỗi dòng là MỘT câu nói. Dòng dạng "(Call 2 – Follow-up)" là chỉ dẫn sân khấu.
```

---

## Kiểm tra

```bash
python check.py --tinh      # tầng 1 + 2
python check.py             # + tầng 3: FastAPI thật trên SQLite tạm, nạp opic.json, Chromium
python check.py --anh       # tầng 3 kèm ảnh chụp vào anh-kiem/
node kiem-nhanh.js          # chỉ tầng 2
```

| Tầng | Kiểm gì |
|---|---|
| 1 | `content/` hợp lệ; `opic.json` khớp `content/`; `index.html` nạp `logic.js → app.js`, không còn `content.js`; cú pháp JS |
| 2 | 61 phép kiểm: bộ chuyển đổi bundle, bỏ dấu, 5 chế độ che, Leitner, 450 đề thi thử, tìm kiếm, thống kê |
| 3 | trang tải `/courses/opic/bundle` (gzip), 10 tuyến, che script, tiến độ, script của tôi, tìm kiếm, thi thử, luyện thẻ, tải lại → 304, không lỗi console |

---

## Ghi chú kỹ thuật

- **Một định dạng cho mọi khoá.** OPIc dùng đúng mô hình `section → nhóm → bài` của các
  khoá đọc bài giảng, nên chung API, CLI, trang quản lý, sqladmin, tìm kiếm phía server.
  Phần riêng của OPIc (dạng câu hỏi, bộ script) nằm trong `course.config`, kèm
  `dangThuTu` / `boThuTu`: MySQL lưu object JSON với khoá đã sắp lại (theo độ dài), nên thứ
  tự hiển thị phải đi riêng thành mảng. `OPICL.tuBundle` dựng lại theo mảng đó và làm sạch
  mọi định danh (id, mã câu, icon, số thứ tự) mà `app.js` ghép thẳng vào HTML.
- **Tải cả bundle, không tải từng bài**: OPIc nhỏ (≈ 250 KB) và luyện thẻ / thi thử cần
  toàn bộ kho; `GET /courses/{slug}/bundle` từ chối khoá lớn hơn `COURSE_BULK_MAX_BYTES`.
- **Logic tách khỏi DOM** (`logic.js`), kể cả bộ chuyển đổi — kiểm được bằng Node.
- Listener gắn vào `#main` sống qua mọi trang — đã từng gây `pageerror`. Gắn vào phần tử
  của trang đó.
