# Bàn giao 15–16/10/2026 — lọc khoảng ngày, IDE heuristic, Code Studio

Yêu cầu gốc: (1) Chi tiêu › "Các khoản chung" lọc theo khoảng ngày; (2) IDE app thực hành heuristic: lưu đoạn mã, biên dịch online song song offline, định dạng + gợi ý khi gõ, rà soát UI/UX; (3) webapp editor riêng: nhiều ngôn ngữ đơn tệp, dự án C/C++ và Java, UI/UX tốt.
Quyết định của chủ dự án: nơi chạy / bộ định dạng / nơi lưu đều **do người dùng chọn** (offline, bên thứ ba, máy chủ; local / MySQL / MongoDB); công nghệ webapp tự chọn (đã chọn JS thuần, không build). Chưa commit gì.

## Đã làm

| Đợt | Việc | Nơi | Kiểm |
| --- | --- | --- | --- |
| A | Lọc khoảng ngày: ô Từ/Đến + chọn nhanh (tháng này/trước, 7/30 ngày, năm nay, tất cả); ‹ › dịch theo độ dài khoảng; "Quyết toán" nhận đúng khoảng; từ > đến tự đổi chỗ | `tranphuc8a/quan-ly-chi-tieu` (`dates.js` hàm thuần mới, `chung.js`, `dialogs.js`, `kieu.css`, `sw.js` v2) | `kiem.js` 516, selftest trình duyệt 170, tĩnh 14, `kiem-hinh.py` |
| B | Backend `GET /run/providers`, `POST /run` (provider piston/judge0/wandbox/local) và `/codestore/*` (kho json/mysql/mongo, không tài khoản, LWW) | `backend/fastapi/src/…`, `docs/code-studio-api.md` | pytest toàn bộ 1459 (406 mới) |
| C | IDE heuristic: trình soạn dùng chung, gợi ý, định dạng chọn bộ, nơi chạy chọn được (trình duyệt/máy chủ/Piston tự dựng; thêm Java, Python), thư viện đoạn mã (tìm/ghim/nhân đôi/xuất nhập, đồng bộ tuỳ chọn), cài đặt | `courses/heuristic-practice-2` (`ide.js`, `ui/editor.js` bộ chuyển, `assets/cs/` **sinh ra**, README, `check.py`) | `check.py` 61 (+ `--chi-cpp` 14, Clang-WASM thật) |
| D | **Code Studio** `tranphuc8a/code-studio`: 19 ngôn ngữ, đoạn mã + dự án (cây tệp, tệp chính), C/C++ nhiều tệp, Java có package, .zip, thư viện, đồng bộ, điện thoại, sáng/tối | thư mục mới | `kiem.js` 794, `check.py` 49 (+ `--wasm` 51), `kiem-hinh.py`, `kiem-tich-hop.js` 71 (backend thật, json + mysql/SQLite), `kiem-chay-trinh-duyet.py` 113, `kiem-trinh-duyet.py` 17 |

## Kiến trúc Code Studio (JS thuần, không build, mở được bằng `file://`)

```text
assets/core/   LOGIC THUẦN (kiểm bằng node): langs, tokenize (bộ tách từ tố dùng chung), format (+format-ext: clang-format/Prettier/Ruff tải khi chọn),
               complete (gợi ý), project (mô hình đoạn mã/dự án = item của /codestore), zip (STORE+DEFLATE, chặn zip-slip/bom), store (kv memory/local/IDB + library + sync), runner (điều phối nơi chạy)
assets/run/    nơi chạy TRONG trình duyệt, tự đăng ký vào CS.runner: browser-js (Worker), browser-py (Pyodide), browser-cpp (Clang→WASM, nhiều tệp)
assets/ui/     dom, editor (CS.editor: textarea + lớp tô màu), app (vỏ, trạng thái, lệnh), panel (kết quả/vấn đề/stdin/cấu hình), side (tệp/thư viện/tìm), dialogs (cài đặt, nơi lưu, bảng lệnh…)
sync.py        chép core + editor sang courses/heuristic-practice-2/assets/cs/  (python sync.py [--kiem])
```

- Định dạng "Tự viết" giữ nguyên dãy từ tố, chỉ đổi khoảng trắng/ngắt dòng, lũy đẳng; kiểm trên 182 mẫu thật của app thực hành + 300 chương trình ngẫu nhiên. Tôn trọng dòng đã gọn (`keepOneLiners`).
- Nơi chạy: `browser` | `server:<id>` | `piston-custom`. Mã gửi lên máy chủ **đi ra dịch vụ ngoài** (trừ `local`). `local` = g++/javac/python/node cài trên máy chủ, **không phải sandbox**, mặc định tắt (`RUN_LOCAL_ENABLED`), cần khoá quản trị (`COURSE_ADMIN_KEY`; trong UI: Cài đặt › khoá quản trị, lưu `sessionStorage`).
- Đồng bộ: "Nơi lưu & đồng bộ" (thanh trạng thái hoặc bảng lệnh): tạo không gian (mã + khoá hiện **một lần**) hoặc nối bằng mã + khoá; kho json/mysql/mongo chọn được; hai thiết bị sửa cùng lúc hội tụ, xoá lan bằng bia mộ.

## Lỗi thật đã tìm ra khi kiểm trình duyệt (đã sửa)

- CSS `display` đè thuộc tính `hidden` (lớp "trống" chặn chuột, nút Dừng luôn hiện) → `[hidden]{display:none!important}`.
- Trình nghe `contextmenu` của thanh bên bị gắn lại mỗi lần vẽ → menu thư viện bị menu "Tệp mới" đè.
- Lệnh bấm sớm khi trang còn khởi động tạo hai bộ đồng bộ đè nhau → thêm `A.ready`/`A.booted`; `A.cmd` chờ; IDE heuristic cũng chờ `san`.
- stdin/tham số ghi trễ 300 ms nên bấm Chạy liền sau khi gõ chạy với dữ liệu cũ → ghi ngay.
- Lưới `.cs-app`/`.cs-center` cột `auto` làm điện thoại 390 px rộng 426 px (nút ⋯ ra ngoài) → cột `minmax(0,1fr)`.
- Ngăn kéo đóng trên điện thoại còn nhận Tab → `visibility:hidden`.
- `data/dem.js` của heuristic lệch nội dung (có sẵn trước đó) → `node kiem.js --ghi-dem`.

## Chạy và kiểm

```bash
node backend/fastapi/webapp/tranphuc8a/code-studio/kiem.js                       # logic thuần (794)
cd backend/fastapi/webapp/tranphuc8a/code-studio
../../../.venv/Scripts/python.exe check.py [--anh] [--wasm]                      # trình duyệt thật + backend thật (DB tạm; --wasm cần mạng ~vài chục MB)
node kiem-tich-hop.js                                                            # backend thật: /codestore json + mysql(SQLite)
python sync.py --kiem                                                            # bản sao assets/cs/ của heuristic-practice-2
```

`check.py` tự khởi động uvicorn với `DB_URL` SQLite tạm, `MONGO_URI` rỗng, `API_PREFIX=/api/v1` (`.env` máy này để rỗng!), không chạm DB thật, không gọi Piston/Judge0/Wandbox công cộng.

## Còn nợ / chưa kiểm — đọc trước khi hứa

- **Piston/Judge0/Wandbox công cộng chưa thử thật** (chỉ giả lập bằng `httpx.MockTransport`/`fetch` giả). Cần một lần thử trước khi tin; tên compiler Wandbox, id ngôn ngữ Judge0 và chế độ multi-file của Judge0 có thể lệch (ghi đè bằng `RUN_WANDBOX_COMPILERS`, `RUN_JUDGE0_LANGUAGE_IDS`).
- Kho **MongoDB thật** chưa thử (chỉ `fake_mongo`); MySQL chỉ chạy trên SQLite. Không chạm Aiven.
- `rlimit` của `local` trên POSIX chưa chạy thử (máy này là Windows); trên Windows không có giới hạn bộ nhớ/tiến trình.
- Trình duyệt: chỉ Edge/Chromium. Firefox/Safari chưa kiểm (IndexedDB, `DecompressionStream`, `import()` trong worker).
- Chạy trong trình duyệt: JS chỉ CommonJS (không ESM/top-level await); Python chỉ thư viện chuẩn; C/C++ không ngoại lệ/luồng/tệp.
- Lab chấm điểm của heuristic vẫn chỉ chạy offline (nhiều lần chạy, kiểm soát giờ) — cố ý chưa nối với "Máy chủ".
- Code Studio chưa là PWA (không `sw.js`/manifest) và chưa có AI (định dạng/gợi ý đều cục bộ).
- Hạn mức `/run`: 20 lượt/phút/IP, đếm trong bộ nhớ từng instance — chỉ làm chậm lạm dụng.
- Các kiểm `wait_for_function` với hàm bất đồng bộ làm kẹt trang thứ hai trong Edge headless (chưa rõ vì sao) → `check.py` dùng vòng lặp `evaluate` + nghỉ.
- Tệp git: `heuristic-3.json` và `tasks/2610/261010/coucoh/` là việc khác của chủ dự án, không đụng.
