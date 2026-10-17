# Algorithm Notebook — bàn giao 17/10/2026

Làm theo `tasks/my-apps/app-2.md`. Chủ dự án đã duyệt: **cả 22 mục, chia 4 giai đoạn**; template **chỉ C++** (biên dịch + chạy thử bằng g++); bài tập liên quan **chỉ ghi bài đã xác minh**. Không backend (chỉ offline), không build, không thêm thư viện; nhóm "Ứng dụng".

## 1. Ở đâu, chạy thế nào
- Nguồn: `backend/fastapi/webapp/tranphuc8a/algorithm-notebook/` → `http://localhost:6789/webapp/tranphuc8a/algorithm-notebook/` (PWA; cần https hoặc localhost để cài). Mở bằng `file://` cũng chạy nhưng không có service worker.
- Lớp (JS thuần, không build, namespace `Algo`): `assets/js/core` (thuần, chạy cả trong node: `lib` luật + kiểm dữ liệu, `catalog`, `find`, `srs`, `compare`, `quiz`, `decide`, `viz`, + `text/notes/markdown/highlight` chép từ personal-wiki) → `data` (`schema`, `store` IndexedDB, `user` kho người dùng, `backup`, `zip`) → `ui` (list, detail, views, library, decideview, practice, vizview, exporters, settings, app). Dữ liệu dựng sẵn: `assets/data/lib-*.js` (9 tệp), `tree.js` (cây quyết định), `roadmaps.js`.
- Tệp dùng chung chép từ personal-wiki bằng `sync.py` (`--kiem` để đối chiếu). **Sửa tệp nào của app cũng phải chạy** `backend/fastapi/.venv/Scripts/python.exe …/algorithm-notebook/tao-pwa.py` (đóng dấu `sw.js`; `check.py --tinh` báo lỗi nếu quên).
- Đã cập nhật: skill `ban-do-ung-dung` (hàng mới), `.claude/CLAUDE.md` (bảng lệnh), bộ nhớ `algorithm-notebook-app.md`.

## 2. Đã làm đủ spec (đối chiếu `app-2.md`)
Danh mục 9 nhóm (cấu trúc dữ liệu, đồ thị, xâu, QHĐ, toán, kỹ thuật, hình học, heuristic/tối ưu, hệ thống & CSDL) · trang chi tiết (mô tả, điều kiện, độ phức tạp từng thao tác, khi nào dùng / KHÔNG dùng, lỗi thường gặp, template, ví dụ vào/ra, bài tập, liên quan, ghi chú của tôi) · tìm theo tên/bí danh/tag/độ phức tạp (`O(logN)` = `O(log N)`)/use case/toàn văn, gõ sai vẫn ra · **"Nên dùng thuật toán nào?"** (wizard theo câu hỏi + cây quyết định xem toàn bộ) · bảng so sánh 2–4 mục · Cheat Sheet (+ in) · thư viện cá nhân (mục của tôi + ghi chú Markdown trên mọi mục) · Template Manager (sao chép, tải .cpp, xuất ZIP, lưu từ mục dựng sẵn) · trực quan hoá 11 thuật toán (BFS, DFS, Dijkstra, Bellman-Ford, Topo, DSU, Fenwick, Segment Tree, tìm nhị phân, KMP, knapsack 0/1) · Quiz (chọn thuật toán, độ phức tạp, tóm tắt) + flashcard SM-2 (Lại/Khó/Được/Dễ) · 5 lộ trình học · tiến độ Chưa học/Đang học/Đã học/Thành thạo + dashboard theo nhóm · bookmark · xuất JSON / Markdown ZIP / PDF (hộp thoại in) / sao lưu `backup_YYYYMMDD.zip` + khôi phục (gộp/thay thế) · offline.

## 3. Nội dung dựng sẵn (kiểm bằng máy)
- **116 mục** (ds 15, graph 25, string 10, dp 15, math 14, tech 12, geo 5, opt 7, sys 13), **183 tình huống** cho Quiz/Wizard. Mọi mục có tóm tắt, mô tả, điều kiện, độ phức tạp, dùng/không dùng, lỗi thường gặp, ví dụ, thẻ ôn; chỉ `raft` là `nocode` (mô tả bằng lời).
- **115 mẫu code C++** (`#include <bits/stdc++.h>`, không `main`, không tab): mỗi mẫu có `kiem-code/<id>.test.cpp` (chèn mẫu vào `// @TEMPLATE`, biên dịch `g++ -std=c++17 -O2 -Wall`, so với vét cạn/mô hình tham chiếu trên dữ liệu ngẫu nhiên, in `OK`). **115/115 đạt, 0 cảnh báo.** (Test do agent viết; một số hệ thống phân tán như 2PC/vector clock/LSM thử bằng mô hình mô phỏng.)
- Luật nội dung và cách thêm mục mới: `HUONG-DAN-SOAN.md`; kiểm: `node kiem-lib.js` (cấu trúc, id `related`, khoá `compare`, CSES đúng id + tên), `kiem-code.py [id…]`.
- **Bài tập liên quan — trạng thái xác minh (quan trọng):** 224 bài **CSES** được đối chiếu id + tên với danh sách thật tải từ cses.fi (`cses-tasks.txt` cùng thư mục tài liệu này) → có liên kết. **145 bài còn lại (Codeforces 50, LeetCode 70, AtCoder 9, SPOJ 7, khác 9) do agent soạn từ trí nhớ, CHƯA đối chiếu với trang gốc** (tôi không gọi được API Codeforces: lệnh mạng bị từ chối trong phiên này). Vì đã hứa "chỉ ghi bài đã xác minh", app **không tạo liên kết** cho chúng và gắn nhãn **"chưa kiểm"** (cả trong chi tiết lẫn xuất Markdown); bài nào được kiểm tay thì thêm `verified: true` vào mục `problems` để có nhãn sạch + liên kết (Codeforces cần `id` dạng `126B`).

## 4. Thiết kế đáng nhớ
- **Local-first**: toàn bộ dữ liệu người dùng (mục, ghi chú, template, đánh dấu, lịch ôn, kết quả quiz, nháp, meta) nằm trong IndexedDB (`memory` khi bị chặn → banner cảnh báo), nạp vào RAM khi mở; `user.js` phát sự kiện để danh sách/chỉ mục cập nhật từng bản ghi.
- **Tìm kiếm** (`core/find.js`): quét tuyến tính hai lượt — lượt 1 chỉ trường ngắn (tên, bí danh, tag, use case) bằng một `indexOf` trên chuỗi gộp; chỉ khi < 30 kết quả mới tìm toàn văn (gấp chữ lười, gấp sẵn lúc rảnh `warm()`); không có kết quả mới thử gõ sai (khoảng cách sửa ≤ 1–2). Truy vấn `O(…)` so dạng rút gọn (bỏ dấu cách, `log2`/`lg` → `log`). Danh sách cuộn ảo (≈ 16 dòng DOM) với trần 50.000 hàng.
- **Nháp**: gõ → nháp (500 ms + `pagehide`); Lưu / Ctrl+S mới ghi thật. Sập máy ⇒ thông báo + banner "Khôi phục nháp" (ghi chú, template, mục của tôi).
- **Nội dung dựng sẵn không sửa được tại chỗ** (chỉ "Sửa/Xoá mục này" với mục của tôi, `source: "user"`). Muốn chỉnh mã thì "Lưu vào Template của tôi" (bản riêng trong Template Manager); ghi chú riêng gắn theo id mục. Chưa có nút "nhân bản mục dựng sẵn thành mục của tôi" — gợi ý làm sau.
- **Trực quan hoá** (`core/viz.js`): mỗi thuật toán là bộ sinh bước thuần (kiểm bằng cách so với cài đặt tham chiếu trong `kiem.js`); `vizview.js` chỉ vẽ (SVG đồ thị / hàng ô / bảng / cây) và điều khiển phát–dừng–bước–tua.
- **An toàn**: mọi chuỗi vào `innerHTML` qua hàm thoát; markdown dựng bằng bộ chép từ wiki (URL chỉ http/https/mailto/tel/tương đối); XSS kiểm cả trong trình duyệt thật.

## 5. Kiểm
| Lệnh (chạy bằng `backend/fastapi/.venv/Scripts/python.exe`) | Phủ |
| --- | --- |
| `node …/kiem.js` | 66 phép: dữ liệu hợp lệ, danh mục, tìm kiếm (kể cả 10.000 mục: nguội/ấm), SRS, so sánh, quiz, viz so với tham chiếu, kho người dùng 10.000 mục, cây/lộ trình, bài CSES vs nguồn khác |
| `node …/kiem-lib.js [--partial\|--dump\|--ids]` | thư viện dựng sẵn hợp lệ |
| `kiem-code.py [id…]` | biên dịch + chạy 115 mẫu C++ (≈ 8 phút cả bộ) |
| `check.py --tinh` | cú pháp, tham chiếu, biểu tượng, manifest, dấu `sw.js`, **tương phản ≥ 4,5:1**, dung lượng vỏ + thư viện ≈ 1,5 MB |
| `check.py --chuc-nang` | mọi màn trên Chromium máy tính + **Pixel 5** + **WebKit iPhone 13** |
| `check.py --song-sot` | sập renderer (`chrome://crash`) → khôi phục nháp (ghi chú, template, mục của tôi); offline qua service worker (vỏ + 9 tệp thư viện trong cache, tìm/ghi chú/viz khi mất mạng); "Có bản mới → Tải lại" không chiếm trang đang soạn |
| `check.py --co-gian` | dữ liệu xấu nhất (tên/tag dài không ngắt chữ, bảng 12 cột, dòng mã dài, RTL, emoji, HTML/JS độc) × 9 bề rộng (280→1920) × 26 màn × Chromium/WebKit/Firefox: không tràn ngang, menu/hộp thoại nằm trong màn hình, **XSS không chạy** |
| `check.py --hieu-nang [N]` | N mục của tôi (mặc định 10.000) + N/5 ghi chú trong **IndexedDB thật**, in số đo (mục 6) |
| `check.py --ma` | chạy `kiem-code.py` |
| `check.py --tat-ca` | cả sáu tầng một lượt |

Lỗi thật do tầng kiểm bắt được và đã sửa: (1) khối ví dụ vào/ra, ghi chú và nút tên tệp dài **làm trang chi tiết tràn ngang** ở mọi bề rộng (lưới `1fr` thiếu `minmax(0,1fr)`, nhãn nút không cắt) — sửa trong `algo.css`, đạt trên cả 3 engine; (2) danh sách chỉ hiện **2.000 mục đầu** (trần cũ) nên không duyệt tới mục thứ 2.001 — nâng trần lên 50.000; (3) so sánh có hàng "Bộ nhớ" lặp; (4) viz: chữ trong nút tô màu thiếu tương phản; (5) tìm kiếm chậm 127–245 ms khi máy bận → gấp chữ nhanh hơn, hai lượt, gấp sẵn lúc rảnh, lọc nhanh bằng chuỗi gộp. Lỗi của chính test: `window.print` giả bị Playwright gọi sớm, so clipboard CRLF, `page.evaluate` gọi biểu thức trả về hàm.

## 6. Số đo hiệu năng thật (Chromium headless, IndexedDB thật, máy dev Windows, 10.000 mục + 2.000 ghi chú)
- Nạp 10.000 mục + 2.000 ghi chú vào IndexedDB: 1,8–5,6 s (hai lần đo).
- Mở lại app (khởi động nguội): **0,65–1,10 s**; JS heap sau dọn rác **36–70 MB**.
- Tìm kiếm — **thời gian lõi** (`res.ms`, 12 kiểu truy vấn × 3 lần): chậm nhất **28 ms** (lần đo khác 41 ms) — dưới 100 ms theo đặc tả. Từng loại: tên 13–22 ms, hai từ 11–14, tag 5–12, độ phức tạp 4–9, use case 19, trong ghi chú 27–28, gõ sai 18–28, không có kết quả 12–18.
- Tìm kiếm — **đầu-cuối** (gõ → danh sách vẽ xong, đã gồm 90 ms chờ gõ xong): 106–183 ms.
- Cuộn tới giữa danh sách 10.117 mục: 27 ms; lưu một mục mới giữa kho 10.000: 342 ms (đã gồm thao tác Playwright); mục vừa lưu tìm được ngay.
- `kiem.js` (node, không trình duyệt): tìm sâu lần đầu 72 ms (< 400), sau khi gấp sẵn 17 ms (< 100).
- **Chưa đo** trên điện thoại thật: máy yếu sẽ chậm hơn nhiều lần.

## 7. Kết quả chạy lần cuối
Mã app chốt rồi mới chạy `check.py --tat-ca` (cả sáu tầng, một lượt): **169 đạt, 1 sai**. Phép sai duy nhất là "Cheat Sheet: In / PDF" ở tầng 2 — **lỗi đua thời gian của test** (test xoá ô tìm rồi bấm In ngay, khi bộ lọc debounce chưa trả lại đủ thẻ nên bản in chỉ có thẻ đã lọc; người dùng thật không bấm nhanh cỡ 90 ms). Đã sửa test (chờ đủ ≥ 100 thẻ rồi mới in) và chạy lại riêng `check.py --chuc-nang`: **116 đạt, 0 sai**. Tôi **chưa chạy lại cả lượt `--tat-ca`** sau lần sửa test này; các tầng 1, 3, 4, 5, 6 đạt hết trong lượt tổng (tầng 3 = 24 phép, tầng 4 = 6, tầng 5 = 9, tầng 6 = 115/115 mẫu code), và `kiem.js` 66/66.

## 8. Giới hạn & nợ đã biết
- **145 bài tập không phải CSES chưa kiểm** (mục 3) — việc nên làm đầu tiên nếu muốn bài tập có liên kết.
- Chưa thử trên **iPhone/Samsung/Tecno thật**, chưa thử cài PWA qua **HTTPS thật** (Chromium headless không bắn `beforeinstallprompt`).
- Một số độ phức tạp thao tác/bộ nhớ do agent tính tay; template đúng (đã thử) nhưng câu chữ mô tả chưa được người thứ hai đọc lại. `hyperloglog` mẫu lệch cao ≈ +2,4% quanh n ≈ 2,5·m (chỗ chuyển linear counting → công thức thô, đúng như mô tả HLL++ cần bảng hiệu chỉnh); `vector-clock` chỉ nhận hai vector cùng độ dài, `lsm-tree` không có quét khoảng, `two-phase-commit` không có timeout tường minh — đều đã ghi trong mô tả/lỗi thường gặp hoặc test.
- iOS/Safari có thể xoá IndexedDB của site không cài vào màn hình chính sau ~7 ngày không mở: **sao lưu định kỳ** (app nhắc). Không có đồng bộ giữa thiết bị (chủ dự án chọn offline thuần).
- Trực quan hoá chỉ 11 thuật toán; mục khác không có nút Xem trực quan.
- Chưa commit (theo quy ước): thư mục `algorithm-notebook/`, `tasks/2610/261017/algorithm-notebook/`, `.claude/CLAUDE.md`, skill `ban-do-ung-dung`.

## 9. Việc kế tiếp gợi ý
1. Kiểm 145 bài chưa kiểm (Codeforces/LeetCode/AtCoder/SPOJ) rồi thêm `verified: true` — hoặc xoá bài nào không chắc.
2. Thử trên máy thật qua HTTPS (cài PWA, bàn phím ảo, quyền lưu bền `navigator.storage.persist`).
3. Thêm trực quan hoá cho các mục phổ biến chưa có (Floyd–Warshall, Dinic, Z-function, LIS…) và ôn theo `weakAreas` của Quiz ở trang chủ.
