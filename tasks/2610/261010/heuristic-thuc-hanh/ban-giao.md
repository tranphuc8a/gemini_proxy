# Bàn giao — Thực hành Heuristic + IDE C/C++ online (10/10/2026)

## Yêu cầu và kết quả

Khoá `heuristic-2` cần thực hành thật, nhưng nhiều người học không có điều kiện cài môi trường/IDE. Đã dựng **app riêng, viết tay, không build, không backend**:

- `backend/fastapi/webapp/courses/heuristic-practice-2/` → `/webapp/courses/heuristic-practice-2/` (cũng chạy được bằng `file://` và `python -m http.server`).
- **32 trang thực hành song song 32 trang bài giảng** (bài kiểm tra đầu vào + 28 bài + 3 ca nghiên cứu): **318 câu trắc nghiệm, 119 câu tự luận, 51 lab**, tóm tắt "nhớ trong một phút", ghi chú theo bài.
- **IDE C/C++ online** (`#/ide`): Clang → WebAssembly chạy trong trình duyệt; có C/C++11–20, JavaScript, stdin, lỗi biên dịch bấm là nhảy tới dòng, nhiều đoạn mã, tải về.
- **Liên kết hai chiều** bài giảng ↔ thực hành ↔ mô phỏng (`heuristic-visual-2`); sửa luôn 25+ link gãy `../web/index.html` ở trang mô phỏng.
- Dùng được trên điện thoại (390 px không cuộn ngang, vùng chạm ≥ 36 px, hàng phím ký hiệu `{ } ( ) ; …` dưới ô soạn), sáng/tối, PWA (offline).

## Quyết định (đã được chủ dự án chốt: Clang-WASM từ CDN, app riêng, làm trọn một lượt)

| Quyết định | Lý do / hệ quả |
|---|---|
| **Chạy C++ bằng Clang-WASM (`@yowasp/clang@22.0.0-git20542-10`, jsDelivr, ISC)** | Không máy chủ, không giới hạn lượt, mã người học không rời máy. Đổi lại: tải lần đầu ≈ 25 MB (105 MB giải nén, lưu Cache Storage → dùng offline); biên dịch 0,4–10 s (máy bàn), điện thoại yếu có thể chậm/thiếu RAM; **không ngoại lệ** (`try/catch/throw`), không luồng, không tệp. Phương án dịch vụ từ xa (Judge0/Piston) bị loại: bên thứ ba, giới hạn tần suất. Đây là **phần duy nhất** của trang phụ thuộc bên thứ ba. |
| App riêng (không dùng engine khoá học) | Tự do UX (lab hai cột, IDE, canvas, tab kiểu dữ liệu). Không cần API/DB ⇒ không phải nạp bundle lên Aiven; không phụ thuộc Gemini. Tự viết cả trình soạn mã, markup, tô màu cú pháp (không CodeMirror/marked/KaTeX). |
| Lab theo giao thức judge (stdin/stdout) | Một đề, hai ngôn ngữ (JS hoặc C++) và một bộ chấm; JS là đường mặc định (tức thì, hợp điện thoại). |
| Tự luận người học **tự chấm** theo tiêu chí | Cố ý không gọi AI/máy chủ; có thể thêm sau qua `/ai/review`. |

## Cấu trúc (chi tiết: `heuristic-practice-2/README.md`)

`assets/core/` logic thuần kiểm bằng node (`tien-ich`, `markup`, `luu`, `trac-nghiem`, `vande` [P0 `tui`, P1 `ship1`, `tsp`, `tuDapAn`], `chay-js`, `cham`, `bai`, `tien-do`) ·
`assets/ui/` giao diện (`app`, `bai`, `lab`, `ide`, `editor`, `tomau`, `dom`) · `assets/cpp/cpp.js` trình biên dịch/chạy C/C++ · `data/khoa.js` mục lục · `data/<id>.js` nội dung 32 bài ·
`data/dem.js` sinh tự động · `kiem.js` · `check.py` · `sw.js` + `manifest.webmanifest`.

Thay đổi ngoài thư mục app (đều nhỏ):
- `courses/engine/mo-lien-ket.js` (module mới) + nhóm `lien_ket` trong `engine/dong-bo.json` (chỉ chép sang `heuristic-course-2`); `heuristic-course-2/assets/cau-hinh.js` thêm `moDun` + `lienKet`; `engine/kiem_khoa_hoc.py` thêm `kiem_lien_ket` (chạy cho mọi trang có `lienKet`).
- `heuristic-visual-2`: 25 link bài giảng sửa đúng + nút "🧪 Thực hành bài này" ở mỗi demo; header/footer/README trỏ đúng.
- `.claude/skills/ban-do-ung-dung`, `.claude/skills/khoa-hoc-engine`: thêm app mới / module mới.

## Kiểm (đã chạy)

| Lệnh | Kết quả |
|---|---|
| `node kiem.js` | 295 mục đạt (`--cpp`: 377 mục): logic thuần; 32 bài đúng lược đồ; **mọi lời giải JS tham chiếu đạt mức cao nhất, mọi khung khởi đầu không tự qua, mọi biến thể dữ liệu hợp lệ**; liên kết ngược bài giảng ↔ thực hành ↔ mô phỏng khớp 32/32; slug bài giảng và id demo có thật |
| `node kiem.js --cpp` | + biên dịch mọi lời giải/khung C++ bằng g++ (`-std=c++17 -O2 -fno-exceptions`) và chấm |
| `python check.py` | Edge thật: trắc nghiệm (mot/nhieu/so, xáo, làm lại câu sai), tự luận, ghi chú, lab qua Web Worker thật (kể cả vòng lặp vô hạn bị giết, lỗi có số dòng), **51 lab × lời giải JS trong trình duyệt**, IDE JS, sao lưu/khôi phục, sáng/tối, PWA offline (mở bài chưa từng mở khi mất mạng), 390 px: **52 đạt, 0 SAI** |
| `python check.py --cpp` / `--chi-cpp` | + Clang-WASM thật: IDE C++ (bits/stdc++.h, stdin, stderr, lỗi biên dịch, vòng lặp vô hạn, đệ quy 150 000 tầng, `clock()`, mảng tĩnh 4 triệu, in 64 bit, stdin 200 000 số) và **41 lab C++ × lời giải tham chiếu (≈ 4,5 phút)**: **14 đạt, 0 SAI** |
| Tích hợp qua FastAPI + SQLite tạm | bài giảng → thực hành → bài giảng → mô phỏng → thực hành bấm xuyên được; cổng `/webapp/_api/list` liệt kê app mới; `heuristic-course-2/check.py` (có thêm `kiem_lien_ket`): mọi bước của tôi đạt |

## Việc người dùng cần làm

1. **Không có gì phải nạp vào database.** Chỉ cần triển khai như các app tĩnh khác. Lần đầu người học bấm biên dịch C++ cần mạng tới `cdn.jsdelivr.net`.
2. Đọc `phat-hien-bai-giang.md` (47 nhóm sai lệch tìm được trong bài giảng/đáp án — nhiều chỗ ảnh hưởng nội dung, ví dụ đáp án D1 của bài kiểm tra đầu vào, đáp án 7.1, 9.2, 11.2, bảng thời gian ở Bài 2, logic ngược ở Bài 22 §8.3) và quyết định chỗ nào sửa ở nguồn.
3. Chưa commit (đang ở nhánh `lab/261009`, chưa stage).

## Giới hạn và nợ

- **Hai lỗi có sẵn từ trước, không do thay đổi này:** (1) `heuristic-course-2/check.py` báo *bản sao engine lệch nguồn* (7 tệp lệch CRLF/LF so với `engine/`; `python engine/sync.py heuristic-course-2` sửa nhưng làm git thấy 7 tệp "sửa" chỉ khác dấu xuống dòng — tôi đã hoàn lại, chỉ giữ `mo-lien-ket.js`); (2) `heuristic-visual-2/check.py` trỏ sai thư mục engine (`webapp/engine` thay vì `webapp/courses/engine`) và trang này giữ `vis-core.js` v1 riêng nên cũng báo lệch.
- Mảng tĩnh ≥ 10 triệu phần tử làm biên dịch Clang-WASM rất chậm (4 triệu ≈ 28 s, 10 triệu ≈ 170 s); chạy thì nhanh.

- Số liệu lab không trùng bảng số trong bài giảng (bộ sinh dữ liệu của mã C++ gốc không có trong repo); xu hướng khớp. Đề P3 thật và 3 ca nghiên cứu không có bộ chấm cục bộ trên trang: các lab Bài 21–22 và ca nghiên cứu dựng lại *phép tính/quy trình*, không phải đề gốc.
- C++ trong trình duyệt chưa thử trên Safari/Firefox cũ (dùng `import()` trong worker cổ điển) và điện thoại thật; chỉ kiểm bằng Edge trên máy bàn.
- Lab C++ của người học không thể dùng ngoại lệ — đã ghi ở mọi chỗ liên quan.
- Chưa có AI chấm tự luận / gợi ý lab (có thể nối `/ai/review`, `/ai/hint` sau).
- Chưa thử Gemini thật (không liên quan tới app này).

## Soạn nội dung — quy trình để mở rộng

`data/HUONG-DAN-SOAN.md` mô tả lược đồ, bài toán có sẵn và cách tự dựng bài toán nhỏ (`TH.vande.tuDapAn`, `keThua`). Nội dung được soạn song song bởi 10 tác tử (mỗi tác tử 3 bài), **mỗi lab đều qua bộ chấm** trước khi nhận; đáp án số tính bằng code.
