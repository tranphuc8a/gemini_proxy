---
name: khoa-hoc-engine
description: Hiểu và sửa hệ thống khoá học — engine trang đọc (webapp/courses/engine), mô-đun học tập (trợ giảng AI, ôn tập SM-2, sổ tay, bản đồ tri thức, offline, thành tích), bài tập code tự chấm, đồng bộ engine sang từng trang, nội dung trong database, bundle, kiểm bằng check.py. Dùng khi sửa bất kỳ thứ gì dưới backend/fastapi/webapp/courses hoặc /courses API.
---

# Khoá học: engine + database

## Nội dung ở đâu

- **Database** (`courses` → `course_sections` → `course_groups` → `course_docs`, + tài sản, lịch sử, thùng rác). API `/courses/*`
  (`course_controller.py`, `course_usecase.py`). **Không còn `content.js`** trong trang (bản `tranphuc8a/*-course` cũ là bản sao lỗi thời).
- **Nguồn soạn**: `backend/course-content/<slug>.json` (bundle). Nạp: `python backend/fastapi/tools/manage_courses.py import <bundle>`;
  quy trình tạo khoá mới: `docs/khoa-hoc-huong-dan-tao-bundle.md`. Quản trị soạn trực tiếp ở `courses/quan-ly-khoa-hoc` (cũng có soạn khoá bằng AI).
- Khoá chưa xuất bản chỉ quản trị viên thấy (kể cả với AI: `include_unpublished=caller.admin`).
- **Không ghi vào database thật.** Test dùng SQLite tạm + bundle nạp sẵn (`MayChuThu`).

## Engine trang đọc — `webapp/courses/engine/` là NGUỒN THẬT

| Tệp | Vai trò |
| --- | --- |
| `app.js`, `app.css` | trang đọc: mục lục, bài, tìm kiếm phía server, tiến độ, ghi chú, route `#/slug`, API mô-đun `window.KhoaHoc` |
| `hien-thi.js`, `hien-thi.css` | dựng markdown thành HTML (dùng chung với khung xem trước ở trang Quản lý): lọc HTML an toàn, công thức KaTeX, khối `lab`, `mermaid`, mã chạy được |
| `mo-*.js` | mô-đun: `mo-ai` (trợ giảng), `mo-on-tap` (SM-2), `mo-so-tay`, `mo-ban-do`, `mo-offline`, `mo-doc`, `mo-thanh-tich`; **`mo-lien-ket`** (nút "Học song song → Thực hành / Mô phỏng" ở đầu bài + trang chủ; chỉ trang khai báo `lienKet` + thêm vào `moDun`, nhóm đồng bộ `lien_ket` — hiện chỉ `heuristic-course-2`, trỏ sang `courses/heuristic-practice-2`) |
| `ai-khach.js`, `pwa.js`, `sw.js` | khách gọi AI (token, chọn model); PWA/service worker (sw.js vào **gốc** trang) |
| `vis.css`, `kiem_*.py`, `tao_pwa.py` | giao diện lab; bộ kiểm dùng chung cho `check.py` của từng trang |
| `dong-bo.json`, `sync.py` | khai báo tệp nào chép sang trang nào (nhóm `khoa_hoc`, `pwa`, `pwa_goc`, `ai_khach`, `quan_ly`…) |

**Sửa ở `engine/`, rồi `python backend/fastapi/webapp/courses/engine/sync.py`** (`--kiem` chỉ so, không chép). Sửa bản sao ở `<trang>/assets/` sẽ mất.
Mỗi trang (`system-design-course`, `heuristic-course`, `khoa-hoc`…) chỉ có `index.html`, `cau-hinh.js` (khoaHoc slug, `moDun`), `metadata.json`, `check.py`.

### Mô-đun: `moDun` trong `cau-hinh.js` (mặc định đủ chín mô-đun), nạp tuần tự sau `app.js`

API `window.KhoaHoc`: `nghe("san-sang"|"trang-chu"|"bai"|"tien-do", fn)`, `dangKyTrang(ten, fn)` (route `#/~ten`), `themNut`, `themLoiTat`,
`themViecChon` (thanh nổi khi bôi đen), `LS` (localStorage riêng từng khoá), `render(md, docId)`, `docs()`, `baiDangDoc()`, `manifest()`,
`esc`, `toast`; do `mo-ai.js` thêm: `KhoaHoc.ai.{trangThai,dungDuoc,goi,hienLoi,oModel,boChay}`; do `mo-on-tap.js`: `KhoaHoc.onTap.{them,denHan,nhatKy}`.
Lỗi trong một mô-đun không được làm hỏng engine (engine bọc try). Dữ liệu người học nằm ở `localStorage` (`the`, `so-tay`, `on-tap.ngay`…).

### AI trong trang đọc (đợt 08/10)

- Khung trợ giảng (`mo-ai.js`): phạm vi "Bài này" (`/ai/tutor`) / "Cả khoá" (`/ai/ask` + `course`), ô chọn model, nút ✨ trên header.
- Ôn tập: viết câu trả lời → `/ai/review` chấm, **gợi ý** mức SM-2 (người học tự chọn). Sổ tay: `/ai/notes` tóm tắt / sinh thẻ.
- Bài tập code: không đạt → nút ✨ Gợi ý, 3 mức (`/ai/hint`); đăng ký qua `HienThi.dangKyGoiY` (khung xem trước của Quản lý không đăng ký).
- Câu trả lời AI là dữ liệu không tin cậy: dựng bằng `K.render(K.ai.boChay(md))` — khối `py-chay`/`py-bai-tap` bị đổi thành khối mã thường.

### Cú pháp đặc biệt trong bài (markdown)

` ```lab ` nhúng lab trực quan; ` ```mermaid `; ` ```py-chay ` / ` ```js-chay ` (ô chạy được); ` ```py-bai-tap ` / ` ```js-bai-tap ` (phần trước `---kiem---` là mã
cho người học, sau là kiểm tra ẩn: Python `assert`, JS `kiem(đk, "thông báo")`); `<details>` cho đáp án. Mã chạy trong Web Worker (Python = Pyodide từ CDN,
~10 MB lần đầu), có thời hạn (JS 5 s, Python 15 s).

## Kiểm

```text
python backend/fastapi/webapp/courses/<trang>/check.py [--tinh] [--anh]
```

Tầng 1 tĩnh (index, bản sao engine khớp, bundle); tầng 2 FastAPI thật trên SQLite tạm + **Gemini giả** (`GeminiGia`) + Chromium: đọc bài, tìm kiếm, offline,
trợ giảng, chạy mã, công cụ học, AI học tập (`kiem_ai_hoc_tap`), điện thoại 390px. `quan-ly-khoa-hoc/check.py` kiểm CMS + soạn bằng AI + trợ lý đoạn chọn.
Mất nhiều phút — chạy nền. Một trang đủ để kiểm engine (ví dụ `system-design-course`); đổi `sw.js`/`pwa.js` thì kiểm thêm trang khác.

## OPIc (`courses/opic-course`) — app riêng, không dùng engine

`assets/app.js` (≈1.330 dòng, tự có TTS, ghi âm, IndexedDB, Leitner, thi thử), dữ liệu `/courses/opic/bundle`. AI: nhận xét bản ghi (`/ai/opic`, WAV ≤ 90 s),
nhận xét script viết (`/ai/opic/script`). Dùng chung `ai-khach.js` (chép bởi `sync.py`, nhóm `ai_khach`). Bàn giao: `docs/opic-course-ban-giao.md`.

## Lab trực quan (`lab-visual`, `*-visual`)

`vis-core` v2, 39 lab canvas, nhúng vào bài bằng khối `lab`; ba trang `*-visual` cố ý ở engine v1 (`chua_dong_bo`). Tài liệu: `docs/web-lab-*.md`.
