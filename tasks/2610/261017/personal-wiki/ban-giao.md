# Personal Wiki — bàn giao 17/10/2026

Làm theo `tasks/my-apps/app-1.md`. Chủ dự án đã duyệt: **được dùng backend đồng bộ**; xoá = **Thùng rác 30 ngày** (khôi phục được); PDF = **hộp thoại in** (CSS in riêng); ảnh = **PNG**; vẽ tay, không build, không thêm thư viện.

## 1. Ở đâu, chạy thế nào
- Nguồn: `backend/fastapi/webapp/tranphuc8a/personal-wiki/` → mở `http://localhost:6789/webapp/tranphuc8a/personal-wiki/` (PWA, cài được; cần https hoặc localhost).
- Lớp (không có bước build): `assets/js/core` (thuần, chạy cả trong node) → `data` (store IndexedDB/bộ nhớ, repo, zip, sao lưu, **sync**) → `ui` (dom, list, editor, views, graphview, exporters, settings, syncpanel, pwa, app). CSS: `tokens.css` + `base.css` (chép từ portal) + `app.css`.
- **Sửa bất kỳ tệp vỏ nào phải chạy** `backend/fastapi/.venv/Scripts/python.exe …/personal-wiki/tao-pwa.py` (đóng dấu `sw.js`; `check.py --tinh` báo lỗi nếu quên).
- Đã cập nhật: skill `ban-do-ung-dung` (hàng mới + bảng API `/wiki`), `.claude/CLAUDE.md` (bảng lệnh), bộ nhớ `personal-wiki-app.md`.

## 2. Đã làm đủ spec (đối chiếu `app-1.md`)
Ghi chú (tiêu đề, nội dung, tạo/sửa, tag, trạng thái) · `[[liên kết]]` + backlink · tạo/sửa/xoá (có xác nhận)/lưu trữ khôi phục được · soạn Markdown Sửa/Xem (+ Chia đôi khi khung ≥ 720 px) · **đồ thị** (zoom, kéo, chụm, bấm nút mở note, ẩn/hiện tag và loại cạnh, ô lọc nút, danh sách nút, xuất PNG; bố cục lực đẩy trong Web Worker) · tìm tiêu đề + toàn văn + `tag:x` + `"cụm từ"` + `status:`/`is:fav`/`kind:` · quan hệ related_to/depends_on/parent_of/child_of (viết `[[depends_on::Tên]]` hoặc bảng bên cạnh) · ghi chú ngày · ghi chú đọc sách (sách/chương/trích dẫn) · flashcard `Q:`/`A:` (SM-2) · ghim · xuất JSON / Markdown ZIP (front-matter) / PDF / PNG · sao lưu `backup_YYYYMMDD.zip` + khôi phục (gộp / thay thế, có bản sao lưu an toàn trước khi thay) · nhập Markdown · offline (service worker) · không mất dữ liệu khi tắt máy/sập (nháp 0,5 s + `pagehide`) · điện thoại + máy tính · sáng/tối · phím tắt (`?`).

## 3. Thiết kế đáng nhớ
- **Local-first**: mọi ghi vào IndexedDB trước (giao dịch `strict`); mất mạng/máy chủ không làm mất hay chặn gì. `memory store` dùng cho test node và khi trình duyệt chặn IndexedDB (banner cảnh báo).
- **Chỉ mục đảo chia khối** (`n>>13`), mục `n*32+tf*8+flags`, tìm tiền tố bằng khoảng khoá; đầu note (tiêu đề, trích, tag…) nằm trong RAM theo cụm 128 ⇒ liệt kê/sắp xếp 100.000 note tức thì; danh sách **cuộn ảo** (≈16 dòng DOM).
- **Liên kết mờ (ghost)**: `[[X]]` chưa có note vẫn lưu cạnh; khi note X ra đời/đổi tên/khôi phục thì cạnh tự giải. Đổi tên note ⇒ viết lại `[[tên cũ]]` ở note khác.
- **Nháp**: gõ → nháp (500 ms + `pagehide`/`visibilitychange`); nút Lưu/Ctrl+S mới ghi vào note thật và xoá nháp. Mở lại sau sập ⇒ thông báo + banner "Khôi phục nháp".
- **Nhiều thẻ trình duyệt**: số thứ tự `n` cấp từ bộ đếm **trong** giao dịch; `BroadcastChannel("personal-wiki")` → `repo.reload()`.
- **An toàn**: trình dựng Markdown thoát mọi thứ, URL chỉ http/https/mailto/tel/tương đối, ảnh chỉ https hoặc `data:image` (kiểm XSS cả trong `kiem.js` lẫn trình duyệt thật ×3 engine).
- **PNG ghi chú** tự bố cục + vẽ lên canvas (không dùng `foreignObject`: làm canvas "nhiễm bẩn" trên WebKit). **PDF**: dựng `#printArea` rồi `window.print()`.
- Trình soạn: Enter tiếp tục danh sách, gợi ý khi gõ `[[`, thanh công cụ chèn nhanh (đậm, nghiêng, liên kết, danh sách, việc cần làm, trích dẫn, khối code, **thẻ hỏi–đáp**, bảng).

## 4. Đồng bộ (`/wiki`, phiên bản 1)
- Mô hình giống `/codestore`: không tài khoản; **kho = mã kho + khoá bí mật** (header `X-Wiki-Key`). Mã nối thiết bị: `<backend>.<mã kho>.<khoá>` (xem ở Cài đặt → Đồng bộ). `?backend=json|mysql|mongo`.
- Bản ghi `{id, kind: note|card, updatedAt, deleted, data}`; **bản `updatedAt` mới hơn thắng, hoà thì xoá thắng**; xoá = tombstone (máy chủ bỏ `data`). Thẻ ôn chỉ gửi **lịch ôn** (thẻ tự sinh lại từ nội dung note); thẻ mới sinh chưa ôn lần nào luôn nhường lịch đã có nơi khác.
- Client (`data/sync.js`): hàng đợi `changes` → PUT lô ≤ 100 bản ghi/≈ 2,5 MB → kéo `since=<serverTime>`; kéo về bằng `bulkAdd` (note mới) hoặc `save({remote:true})` (không dội ngược, giữ giờ sửa). Lỗi mạng: lùi 15 s → 30 s → … ≤ 5 phút; 401/404: dừng hẳn (báo "nối lại"); một bản ghi bị từ chối (400 + `itemId`) bị loại khỏi hàng đợi và đếm, không chặn các bản khác.
- **Xoá sạch dữ liệu trên máy ⇒ tự ngắt đồng bộ** (cố ý: không đẩy tombstone hàng loạt). Khôi phục kiểu "thay thế" cũng đi qua `wipe` nên cũng ngắt — nối lại bằng mã.
- Nhập hàng loạt (`bulk`) tự xếp cả kho vào hàng đợi (idempotent nhờ LWW).
- Backend: mục 6.

## 5. Kiểm
| Lệnh (chạy bằng `backend/fastapi/.venv/Scripts/python.exe`) | Phủ |
| --- | --- |
| `node …/personal-wiki/kiem.js` | 160 phép: văn bản, ghi chú, markdown + XSS, tìm kiếm, thẻ, đồ thị, zip (cả đọc bằng Python zipfile), kho, sao lưu/xuất/nhập, hai thẻ dùng chung kho, **đồng bộ với máy chủ giả** (xung đột, tombstone, dead-letter, lùi dần, nhiều trang, thẻ đến trước note, xoá sạch → ngắt) |
| `check.py --tinh` | cú pháp, tham chiếu, biểu tượng, manifest, dấu `sw.js`, **tương phản ≥ 4,5:1 mọi cặp màu** (sáng/tối/mã/toast), dung lượng vỏ (≈ 411 KB) |
| `check.py --chuc-nang` | ≈ 94 phép trên Chromium máy tính + **Pixel 5** + **WebKit iPhone 13**: tạo/lưu/liên kết/backlink/quan hệ/đổi tên, tìm kiếm, ghim/lưu trữ/thùng rác/xoá hẳn, ngày, sách, thẻ ôn, đồ thị (zoom/kéo/bấm nút/ẩn tag), xuất JSON/MD/PNG/PDF, backup + khôi phục sang trình duyệt mới, giao diện tối bền, điện thoại (thanh dưới, toàn màn hình khi soạn, không chia đôi, vùng chạm) |
| `check.py --song-sot` | **sập renderer** (`chrome://crash`) khi đang soạn → mở lại khôi phục nháp (note mới, note đã lưu); đóng thẻ < 0,5 s vẫn giữ nháp; **offline** qua service worker (cache đúng tệp, API không bị lưu đệm, tạo note khi offline, đồ thị Worker); luồng "Có bản mới → Tải lại" không chiếm trang đang soạn |
| `check.py --co-gian` | dữ liệu xấu nhất (tiêu đề/tag dài không ngắt chữ, bảng 12 cột, dòng mã dài, RTL, emoji, HTML/JS độc) × 9 bề rộng (280→1920) × 9 màn × Chromium/WebKit/Firefox: không tràn ngang, menu/hộp thoại nằm trong màn hình, **XSS không chạy** |
| `check.py --hieu-nang [N]` | N note (mặc định 100.000) trong **IndexedDB thật**, in số đo (mục 7) |
| `check.py --dong-bo` | hai thiết bị (hai trình duyệt) + **FastAPI thật** (SQLite tạm, kho JSON ở thư mục tạm): tạo kho, nối bằng mã, sửa hai chiều, offline→online, xoá hai chiều, note 400.000 ký tự, xoá kho |

Lỗi thật do tầng kiểm bắt được và đã sửa: nút "chia đôi" hiện trên điện thoại, thanh trên của trình soạn tràn ngang ≤ 320 px, chữ "null" ở trang chủ, ghost link mất chữ hoa, huy hiệu thẻ đến hạn không cập nhật sau khi ôn, lịch ôn từ máy khác bị thẻ mới sinh ghi đè, trang tải lại lần cài đầu của service worker, `window.print` giả bị Playwright gọi sớm (lỗi của test).

## 6. Backend `/wiki` (mới, anh em của `/codestore`, đơn giản hơn: không liên kết chia sẻ, không tệp)
- Tầng: `domain/vo/wiki_vo.py` · `application/ports/{input,output}/wiki_*_port.py` · `application/usecases/wiki_usecase.py` · `adapter/output/wiki/{json,mysql,mongo}_repository.py` · `adapter/factory/wiki_factory.py` · `adapter/input/controllers/wiki_controller.py`; đăng ký trong `main.py` sau codestore; cấu hình `WIKI_STORAGE_BACKEND` (mặc định `json`), `WIKI_JSON_FILE`, `WIKI_MAX_ITEMS` (300.000), `WIKI_WORKSPACES_PER_HOUR`, `WIKI_TOMBSTONE_DAYS` (`.env.example`, `README.md` đã có mục `/wiki`).
- Điểm cuối (đều trả JSON trần + `Cache-Control: no-store`): `GET /wiki/backends` · `POST /wiki/workspaces` (201 `{workspaceId, key}`, khoá chỉ hiện một lần, chỉ lưu SHA-256) · `GET /wiki/{id}/items?since=&limit=` (`{items, serverTime, more}`, trang ≤ 200 bản ghi / 3 MB) · `PUT /wiki/{id}/items` (≤ 200 bản ghi, ≤ 4 MB, mỗi `data` ≤ 1,6 MB; trả bản máy chủ đang giữ) · `DELETE /wiki/{id}`. Khoá: `X-Wiki-Key` hoặc `Authorization: Bearer`. Sai khoá đếm 20 lần/10 phút/IP rồi 429.
- Mã lỗi (`data.code`): `wiki_not_found` 404 · `wiki_key_required`/`wiki_bad_key` 401 · `wiki_rate_limited` 429 (+`Retry-After`) · `wiki_bad_item`/`wiki_bad_clock` 400 (+`itemId`) · `wiki_too_large` 400 · **`wiki_workspace_full` 400** (giống codestore, không phải 413) · `wiki_bad_backend` 400 · `wiki_backend_unavailable` 503; id/kind/`updatedAt`/`data` sai dạng → 422.
- Mongo dùng trường camelCase (`workspaceId`, `updatedAt`, `dataJson`…); MySQL: bảng `wiki_workspaces`, `wiki_items` (khoá chính `(workspace_id, id)`, cột id `utf8mb4_bin`, `payload` LONGTEXT, chỉ mục `(workspace_id, server_updated_at)`).
- Test: 186 test mới (usecase 61, kho json/SQLite/mongo-giả 90, controller 30) + 5 test dây chuyền giới hạn tốc độ; agent báo **cả bộ pytest 1895 đạt, 4 bỏ qua, 0 sai**; tôi chạy lại độc lập `-k "wiki or rate_limit_wiring"` → 210 đạt. Không chạm database thật.
- **Rủi ro cần biết**: (1) kho **JSON ghi lại cả tệp mỗi PUT** — đo với 100.000 note: ≈ 2,3 s/PUT, mở nguội ≈ 2,6 s ⇒ đồng bộ lần đầu hàng chục nghìn note nên dùng **MySQL/Mongo**; (2) DDL MySQL **chưa chạy trên MySQL thật** (test chạy SQL phổ thông trên SQLite + kiểm chuỗi DDL); (3) một hàng MySQL có thể 1,6 MB nên `max_allowed_packet` phải lớn hơn (mặc định ≥ 16 MB; MySQL 5.7 cũ 4 MB).

## 7. Số đo hiệu năng thật (Chromium headless, IndexedDB thật, máy dev Windows)
100.000 note (tiêu đề + ~60 từ thân + 1–2 tag, ~5 % có liên kết), **ba lần đo** (lần 2 máy đang bận chạy pytest nên chậm hơn):
- Nạp bằng `bulkAdd`: 115–229 s (≈ 440–870 note/s — chỉ chạy một lần khi nhập/đồng bộ lần đầu).
- Mở lại app (khởi động nguội, đọc đầu 100.000 note): **1,3–2,8 s**; JS heap sau dọn rác 72–220 MB (300–380 MB khi chưa dọn).
- Tìm kiếm đầu-cuối (gõ → kết quả hiện, gồm 130 ms debounce): từ cực phổ biến (khớp ~99.000 note) **466–674 ms**; từ ít gặp / tag / tiêu đề / cụm từ: **215–450 ms**; mọi truy vấn **< 1 s** cả lần đầu lẫn các lần sau.
- Cuộn tới giữa danh sách 16–87 ms; lưu một note giữa kho 100.000: 0,6–1,2 s (đã gồm thao tác nhập của Playwright).
- **Chưa đo** trên điện thoại thật: máy yếu sẽ chậm hơn nhiều lần; khởi động nguội và nạp lần đầu là chỗ đáng lo nhất.

## 8. Kết quả chạy lần cuối
`check.py --tat-ca` (cả sáu tầng, một lượt): **181 phép đạt, 0 sai**, exit 0 (đo trên Chromium, Pixel 5, WebKit iPhone 13, Firefox, Edge không dùng). Sau đó chỉ sửa xử lý lỗi `wiki_bad_clock`/`wiki_workspace_full` trong `sync.js` (+3 phép ở `kiem.js`, tổng 160) và chạy lại `--tinh` + `--dong-bo` (đạt; riêng `--dong-bo` từng sai một lần ở bước "liên kết đã được giải" rồi đạt 4/4 lần sau khi test chờ đúng ghi chú được mở — chưa tái hiện được nguyên nhân, nghi danh sách vẽ lại khi đồng bộ).

## 9. Giới hạn & nợ đã biết
- Chưa thử trên **iPhone/Samsung/Tecno thật**, chưa thử cài PWA thật (cần HTTPS thật; Chromium headless không bắn `beforeinstallprompt`). Kiểm bàn phím ảo chỉ bằng giả lập.
- iOS/Safari có thể xoá IndexedDB của site không cài vào màn hình chính sau ~7 ngày không mở: **bật đồng bộ hoặc sao lưu định kỳ** (app nhắc sao lưu).
- Kho JSON trên máy chủ chậm với kho lớn (mục 6); chưa có lệnh "Đẩy lại toàn bộ" riêng (đổi sang kho khác = ngắt rồi tạo kho mới, ghi chú trên máy tự lên lại).
- Đồng bộ chưa có: gộp văn bản ba chiều (xung đột = bản mới hơn thắng cả note), nén gói, WebSocket đẩy tức thì (hiện kéo theo chu kỳ/khi mở lại), mã hoá đầu-cuối (máy chủ đọc được nội dung ghi chú).
- Hai thẻ trình duyệt cùng đồng bộ sẽ cùng gửi (vô hại nhờ LWW, tốn băng thông).
- Đồ thị > vài nghìn nút vẽ canvas được nhưng bố cục lực đẩy lâu; "Toàn bộ" cắt ở các nút nhiều liên kết nhất (có dòng thông báo).
- Chưa commit (theo quy ước); `git status`: thư mục `personal-wiki/`, `tasks/my-apps/`, `tasks/2610/261017/personal-wiki/` và các tệp backend `/wiki`.

## 10. Việc kế tiếp gợi ý
1. Thử trên máy thật qua HTTPS (tunnel/triển khai), cài PWA, kiểm bàn phím ảo iOS, quyền lưu bền (`navigator.storage.persist`).
2. Chạy `kiem_*_that.py`-kiểu cho MySQL/MongoDB thật của `/wiki` (chưa chạy với DB thật theo quy ước "không ghi DB thật").
3. Nếu dùng nhiều thiết bị: thêm đẩy tức thì (SSE) và gộp xung đột theo đoạn.
