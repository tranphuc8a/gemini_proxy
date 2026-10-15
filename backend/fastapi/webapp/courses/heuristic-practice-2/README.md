# Thực hành Heuristic — bài tập, lab và IDE online

Trang bài tập **song song** với khoá [Học Heuristic](../heuristic-course-2/) (32 trang: bài kiểm tra đầu vào, 28 bài giảng, 3 ca nghiên cứu).
Người học **không cài gì**, dùng được trên điện thoại: trắc nghiệm, tự luận, lab lập trình chấm tự động, ghi chú theo bài — và một **IDE** (C/C++, JavaScript; thêm Java, Python khi chạy trên máy chủ) có gợi ý khi gõ, định dạng mã, thư viện đoạn mã, chạy ngay trong trình duyệt **hoặc** trên máy chủ.

> App viết tay: HTML + CSS + JavaScript thuần, **không build, không npm, không máy chủ riêng**. Không phông/thư viện ngoài. Phần *duy nhất* phụ thuộc bên thứ ba là
> bộ biên dịch C/C++ (Clang → WebAssembly, `@yowasp/clang`, giấy phép ISC) nạp từ `cdn.jsdelivr.net` **khi người học bấm biên dịch lần đầu** (xem [§ C/C++](#cc-trong-trình-duyệt)).

## Chạy

```bash
cd backend/fastapi && .venv/Scripts/python.exe -m uvicorn src.main:app --port 6789   # → http://127.0.0.1:6789/webapp/courses/heuristic-practice-2/
# hoặc chỉ cần một máy chủ tĩnh bất kỳ:
cd backend/fastapi/webapp/courses/heuristic-practice-2 && python -m http.server 8790  # → http://127.0.0.1:8790/
```
Mở bằng `file://` cũng chạy (mã chạy trong Web Worker dựng từ Blob; C++ cần `http(s)` vì Cache Storage). Không cần database hay API.

## Một bài có gì

| Phần | Làm gì |
|---|---|
| **Tóm tắt** | 5–8 ý "nhớ trong một phút". |
| **Trắc nghiệm** | `mot` / `nhieu` / `so`; chọn xong biết đúng/sai kèm giải thích; đáp án **xáo mỗi lần làm**; "Làm lại câu sai". |
| **Tự luận** | tự viết → xem đáp án mẫu → **tự chấm theo tiêu chí**; gợi ý mở dần. |
| **Lab** | đề kiểu judge: trang sinh dữ liệu từ seed → **stdin**; lời giải in **stdout**; chấm nhiều test, **mức đạt** (hợp lệ → bằng greedy → …) so với lời giải tham chiếu, kèm kiểm định chênh lệch ± SE theo Bài 4, vẽ lời giải lên canvas. Giải bằng **JavaScript** (Web Worker, tức thì) hoặc **C++** (Clang-WASM). Đổi "kiểu dữ liệu" để thấy kết luận của bài (vd Bài 5: subset-sum làm tỉ số thua giá trị). |
| **Ghi chú** | tự lưu, gom ở "Ghi chú của tôi", xuất `.md`. |

Liên kết hai chiều: nút **📖 Bài giảng**, **🎛 Mô phỏng**, **⌨ IDE** ở đầu mỗi bài; ngược lại bài giảng (`heuristic-course-2`) có nút **Học song song → Thực hành / Mô phỏng**
(module engine `mo-lien-ket.js`, cấu hình `lienKet` ở `heuristic-course-2/assets/cau-hinh.js`) và mỗi demo ở `heuristic-visual-2` có link **🧪 Thực hành bài này**.

Dữ liệu người học (tiến độ, mã lab, ghi chú, đoạn mã IDE) nằm ở `localStorage` (`th2:*`), **không có tài khoản, không gửi đi đâu**. Trang *Hướng dẫn* có sao lưu/khôi phục `.json`
(bản ghi mới hơn thắng khi nhập) và xoá dữ liệu.

## Bản đồ tệp

```text
index.html            vỏ trang; nạp script theo thứ tự (core thuần → dữ liệu → giao diện)
metadata.json         cổng _portal đọc
manifest.webmanifest, sw.js, assets/icon-*.png   PWA (cache tệp của chính trang; trình biên dịch C++ có cache riêng)
kiem.js               node: module thuần + toàn bộ nội dung + mọi lab qua bộ chấm  (--cpp: biên dịch C++ bằng g++ trên máy)
check.py              trình duyệt thật (Edge/Chromium, Playwright); --cpp: biên dịch Clang-WASM thật; --anh: chụp ảnh
assets/core/          LOGIC THUẦN (không DOM) — kiểm bằng node
  tien-ich.js         thoát HTML, rng mulberry32 tất định, thống kê (SE), định dạng số kiểu Việt
  markup.js           mini-markdown → HTML an toàn (thoát trước, chỉ thẻ do bộ dựng tạo)
  luu.js              kho localStorage chịu lỗi (bị chặn → bộ nhớ), sao lưu/khôi phục, gộp theo thời điểm
  trac-nghiem.js      lược đồ, xáo, chấm, tổng kết
  vande.js            bài toán: `tui` (P0), `ship1` (P1), `tsp` + `tuDapAn`, `keThua`; sinh/viết/chấm/tham chiếu
  chay-js.js          chạy JS người học (Web Worker, giết khi quá giờ); readInput/print/log/rng/now
  cham.js             bộ chấm lab: sinh test, chạy, mức đạt, so tham chiếu, kiểm định 2·SE
  bai.js              sổ đăng ký bài + kiểm lược đồ nội dung
  tien-do.js          tiến độ theo bài (trọng số 40/25/35)
assets/ui/            giao diện: dom, tomau (tô màu khối mã trong bài giảng), editor (bộ chuyển tiếng Việt sang CS.editor), app (vỏ + trang chủ + ghi chú + hướng dẫn), bai, lab, ide
assets/cs/            SINH RA bằng `python ../../tranphuc8a/code-studio/sync.py` — đừng sửa ở đây (nguồn: webapp/tranphuc8a/code-studio): langs, tokenize, format(+ext), complete,
                      project, store, runner, editor.js/.css = trình soạn dùng chung, định dạng, gợi ý, kho đoạn mã, chạy trực tuyến
assets/cpp/cpp.js     trình biên dịch + chạy C/C++ (worker biên dịch, worker chạy .wasm, WASI tối thiểu, Cache Storage)
data/khoa.js          mục lục: 32 trang, phần, slug bài giảng, id demo mô phỏng
data/<id>.js          nội dung từng bài (tải khi mở) — `TH.dangKy({...})`; soạn theo data/HUONG-DAN-SOAN.md
data/dem.js           SINH TỰ ĐỘNG (`node kiem.js --ghi-dem`): số câu/lab mỗi bài cho chip trên thẻ bài
```

## IDE

Trang `#/ide`. Trình soạn là **CS.editor** (dùng chung với webapp *Code Studio*): tô cú pháp 5 ngôn ngữ, **gợi ý khi gõ** (từ khoá, thành viên sau `.`/`->`/`::` suy từ khai báo, `#include`, mẫu đoạn mã — Ctrl+Space gọi tay),
tự đóng ngoặc/nháy, tự thụt dòng (tách `{|}`), **tìm/thay** (Ctrl+F/H, cả regex), tới dòng (Ctrl+G), tô cặp ngoặc, tô chỗ trùng từ, di chuyển/nhân đôi dòng (Alt+↑↓), chú thích dòng (Ctrl+/), phóng chữ (Ctrl+=/−), ngắt dòng mềm (Alt+Z), hàng phím ký hiệu trên điện thoại.

- **Định dạng mã xấu** (Shift+Alt+F hoặc nút): người học chọn bộ định dạng — *Tự viết* (có sẵn, tức thì, không mạng; giữ nguyên từ tố, chỉ đổi khoảng trắng/ngắt dòng; chọn kiểu ngoặc K&R/Allman, con trỏ `int *p` / `int* p`),
  hoặc *clang-format* (WebAssembly), *Prettier*, *Ruff* tải về **một lần có hỏi** từ cdn.jsdelivr.net. Lỗi tải/cú pháp thì tự rơi về bộ tự viết và báo lý do. Một bước hoàn tác (Ctrl+Z trả mã cũ).
- **Nơi chạy** (hộp *Nơi chạy*, nhớ theo ngôn ngữ): *Trong trình duyệt (offline)* — C/C++ bằng Clang→WebAssembly, JavaScript trong Web Worker, mã không rời máy; *Máy chủ* — backend chuyển mã tới Piston / Judge0 / Wandbox
  hoặc trình biên dịch cài trên máy chủ (`POST /run`, xem `docs/code-studio-api.md`; **thêm Java, Python**; không bị giới hạn không-ngoại-lệ của WASM; mã **được gửi tới dịch vụ đó**); *Piston của bạn* — gọi thẳng từ trình duyệt tới máy Piston tự dựng (cần CORS).
  Lab chấm điểm vẫn chạy offline (cần nhiều lần chạy, kiểm soát thời gian).
- **Đoạn mã**: thư viện có tìm kiếm (theo tên/ngôn ngữ/nội dung), ghim, nhân đôi, xoá, nhập tệp `.cpp/.java/.py/…`, xuất/nhập `.json`. Lưu trong `localStorage` (khoá `th2:ide2/*`, có trong sao lưu ở trang *Hướng dẫn*);
  đoạn mã cũ (`ide/ds`) được nhập tự động một lần. **Nơi lưu & đồng bộ** (chỉ khi mở qua backend): thêm đồng bộ lên máy chủ — kho JSON / MySQL / MongoDB, không tài khoản (mã không gian + khoá bí mật), hai thiết bị sửa cùng lúc không mất dữ liệu.

## C/C++ trong trình duyệt

- **Biên dịch** `clang++ -std=c++17 -O2 -fno-exceptions -Wall -D_WASI_EMULATED_PROCESS_CLOCKS …` → `.wasm` trong một Web Worker; **chạy** trong Worker khác bằng WASI tối thiểu tự viết
  (stdin/stdout/stderr, đồng hồ, ngẫu nhiên; mọi hàm WASI chưa cài trả `ENOSYS`). Quá giờ → giết cả worker (vòng lặp vô hạn không treo trang). Chọn C++11/14/17/20, C11/17, `-O0…-O3`.
- **Tải lần đầu ≈ 25 MB** truyền tải (≈ 105 MB giải nén) từ `cdn.jsdelivr.net/npm/@yowasp/clang@22.0.0-git20542-10` (ghim đúng phiên bản). Người học được hỏi trước; sau đó
  `fetch` của worker bị bọc để lưu vào **Cache Storage** (`th2-clang-<phiên bản>`) → dùng lại cả khi offline. Trang *Hướng dẫn* có nút xoá bộ nhớ này.
  Đo trên máy bàn: lần đầu ≈ 30–45 s (gồm tải), các lần sau 0,4–10 s tuỳ độ nặng của `#include`. Điện thoại cấu hình thấp có thể chậm/thiếu RAM → mọi lab đều có đường **JavaScript**.
- Mảng tĩnh/toàn cục **rất lớn** (≥ 10 triệu phần tử) có thể làm biên dịch chậm bất thường (đo trên máy bàn đang bận: 4 triệu ≈ 28 s, 10 triệu ≈ 170 s; chạy thì nhanh) — dùng `-O1`, hoặc `vector`/mảng nhỏ hơn.
  Trong lúc biên dịch trang báo số giây đã trôi.
- **Giới hạn** (do thư viện chuẩn trong gói): *không ngoại lệ* (`try/catch/throw` không dùng được — `vector::at` ngoài khoảng → `abort`), không luồng, không tệp; stack 8 MB, bộ nhớ ≤ 512 MB,
  đầu ra ≤ 1 MB. `#include <bits/stdc++.h>` dùng được (bản giả trong `cpp.js`). `clock()` dùng được nhờ bản giả lập đồng hồ tiến trình của WASI.
- Mã của người học **không** gửi đi đâu; bên thứ ba chỉ thấy yêu cầu tải tệp trình biên dịch từ CDN.

## Kiểm

```bash
cd backend/fastapi/webapp/courses/heuristic-practice-2
node kiem.js                 # logic thuần + 32 bài đúng lược đồ + mọi lab: lời giải JS tham chiếu đạt mức cao nhất, khung khởi đầu KHÔNG tự qua
node kiem.js --cpp           # + biên dịch mọi lời giải/khung C++ bằng g++ trên máy và chấm
../../../.venv/Scripts/python.exe check.py --tinh    # tĩnh (+ node kiem.js)
../../../.venv/Scripts/python.exe check.py           # + Edge thật: trắc nghiệm, tự luận, lab, IDE (gợi ý, định dạng, kho đoạn mã), sao lưu, 390 px, mọi lab qua Web Worker thật
python ../../tranphuc8a/code-studio/sync.py --kiem   # assets/cs/ có lệch nguồn Code Studio không
../../../.venv/Scripts/python.exe check.py --cpp     # + Clang-WASM thật (cần mạng, vài phút)
```

## Thêm / sửa nội dung

Xem [`data/HUONG-DAN-SOAN.md`](data/HUONG-DAN-SOAN.md) (lược đồ trắc nghiệm / tự luận / lab, bài toán có sẵn, cách tự dựng bài toán nhỏ, quy tắc chất lượng). Bài mẫu: `data/bai-05-greedy.js`.
Sau khi sửa: `node kiem.js --bai=<id>`; thêm/xoá câu thì `node kiem.js --ghi-dem`. Thêm một bài mới: khai báo ở `data/khoa.js` (và ánh xạ ở `heuristic-course-2/assets/cau-hinh.js`
nếu là bài giảng mới — `kiem.js` kiểm hai chiều khớp nhau).

## Giới hạn đã biết

- Số liệu lab **không trùng bảng số trong bài giảng** (bộ sinh dữ liệu của mã C++ gốc không có trong repo): xu hướng khớp, con số cụ thể thì không.
- `ship1` là P1 của khoá (Bài 1 §7). Đề P3 (thợ vệ sinh điều hoà) và ba ca nghiên cứu không có bộ chấm cục bộ trên trang; các lab Bài 21–22 và ca nghiên cứu dựng lại *phép tính / quy trình* của chúng.
- Tự luận do **người học tự chấm** (chưa có AI chấm — trang cố ý không phụ thuộc máy chủ).
- C++ trong trình duyệt: xem *Giới hạn* ở trên; Safari/Firefox cũ chưa kiểm (dùng `import()` trong worker cổ điển).
- Các sai lệch tìm thấy ở bài giảng khi soạn: `tasks/2610/261010/heuristic-thuc-hanh/phat-hien-bai-giang.md`.
