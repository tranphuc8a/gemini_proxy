# Quản lý chi tiêu

Ứng dụng web thay cho nhật ký chi tiêu viết tay trong ghi chú: gõ một dòng là xong, tự tính tổng, tự tính ai nợ ai, lưu ngay trong trình duyệt hoặc đồng bộ qua máy chủ FastAPI (MySQL / MongoDB).

> Tài liệu của đợt làm việc này (yêu cầu → thiết kế → kế hoạch → tiến độ → báo cáo) nằm ở
> `tasks/2610/261004/quan-ly-chi-tieu/`. Thư mục này là **gốc dự án**: README và bộ tự kiểm.

## Mã nguồn nằm đâu

| Thứ | Vị trí |
|---|---|
| Ứng dụng (HTML/CSS/JS thuần, không build, không thư viện) | `backend/fastapi/webapp/tranphuc8a/quan-ly-chi-tieu/` — được phục vụ tại `/webapp/tranphuc8a/quan-ly-chi-tieu/` |
| Bộ kiểm logic (node) | `…/quan-ly-chi-tieu/kiem.js` (cũng được `webapp/tranphuc8a/kiem-tat.js` chạy) |
| API đồng bộ `/api/v1/spending/*` | `backend/fastapi/src/…/spending_*` (controller → usecase → port → kho json / mysql / mongo) |
| Test backend | `backend/fastapi/tests/…/test_spending_*.py` |
| Tự kiểm tích hợp (server thật + trình duyệt thật) | `quan-ly-chi-tieu/selftest/` |

Không có bước build nên mã nguồn và bản xuất bản là một: sửa thẳng trong thư mục webapp rồi tải lại trang.

## Chạy

```powershell
cd backend\fastapi
.\run_fastapi.ps1                      # http://localhost:6789
# mở  http://localhost:6789/webapp/tranphuc8a/quan-ly-chi-tieu/
```

Hoặc mở thẳng `index.html` bằng `file://` — chế độ **Máy này** chạy đủ; muốn đồng bộ thì điền “Địa chỉ máy chủ” (vd `http://localhost:6789/api/v1`) ở Cài đặt.

Ba chế độ lưu trữ (Cài đặt → Lưu trữ & đồng bộ):

| Chế độ | Dữ liệu nằm ở | Cần |
|---|---|---|
| Máy này | `localStorage` của trình duyệt | không gì cả |
| Máy chủ · MySQL | bảng `spending_workspaces` | `DB_*` hoặc `DB_URL` của backend |
| Máy chủ · MongoDB | collection `spending_workspaces` | `MONGO_URI` |

Chọn MySQL/MongoDB → **Tạo không gian mới** → app đẩy sổ hiện có lên và hiện **mã kết nối** `id.khoá` *một lần*. Dán mã đó vào “Nối bằng mã” trên thiết bị khác. Máy chủ chỉ lưu băm SHA-256 của khoá: mất mã là mất quyền truy cập.

## Cài như ứng dụng (PWA)

Mở **Cài đặt → Cài ứng dụng** (hoặc nút “Cài đặt ứng dụng” trên thanh địa chỉ của Chrome/Edge): app thành biểu tượng ở màn hình chính / menu Start, mở cửa sổ riêng và **chạy cả khi mất mạng**. Dữ liệu vẫn ở nơi đã chọn (trình duyệt hoặc máy chủ); khi offline, thay đổi ghi vào máy rồi tự đồng bộ khi có mạng lại.

| Việc | Ở đâu |
|---|---|
| Khai báo ứng dụng | `webapp/tranphuc8a/quan-ly-chi-tieu/manifest.webmanifest` + 4 icon PNG trong `assets/` |
| Service worker | `…/quan-ly-chi-tieu/sw.js` (phải ở **gốc** app). Chỉ lưu tệp của app, mạng trước → mất mạng dùng bản lưu. **Không bao giờ lưu API** `/spending` |
| Đăng ký + nút cài | `assets/pwa.js` → `QL.pwa.state()/install()`; giao diện ở mục “Cài ứng dụng” của trang Cài đặt |
| Vẽ lại icon (khi đổi favicon) | `backend\fastapi\.venv\Scripts\python.exe quan-ly-chi-tieu\tao-bieu-tuong.py` |

Điều kiện và cạm bẫy:

- **Cần HTTPS** (hoặc máy chủ chạy ngay trên máy). Mở qua `http://192.168.x.x:…` trên điện thoại thì trình duyệt không cho đăng ký service worker và không có nút cài.
- **iPhone/iPad** không có hộp thoại cài: Safari → Chia sẻ → *Thêm vào Màn hình chính*. Ứng dụng đó có kho dữ liệu **riêng**, tách khỏi Safari — sổ “Máy này” không tự sang; Sao lưu JSON → Khôi phục, hoặc bật đồng bộ máy chủ trước khi cài.
- Thêm tệp mới vào `index.html` là xong, `sw.js` tự đọc `index.html` lúc cài để lưu sẵn mọi `assets/*`. Đổi *quy tắc* của `sw.js` thì tăng `PHIEN_BAN` trong đó để cache cũ bị dọn.

## Kiểm thử

```powershell
# 1. Logic thuần + động cơ đồng bộ (430 phép kiểm, kể cả các con số trong PDF nhật ký cũ)
node backend\fastapi\webapp\tranphuc8a\quan-ly-chi-tieu\kiem.js

# 2. Backend (pytest)
cd backend\fastapi
.\.venv\Scripts\python.exe -m pytest tests\application\test_spending_usecase.py tests\adapter\output\spending tests\adapter\input\controller\test_spending_controller.py -q

# 3. Tất cả: tĩnh + node + pytest + API thật + trình duyệt thật (Edge/Chrome qua Playwright)
.\.venv\Scripts\python.exe ..\..\quan-ly-chi-tieu\selftest\run.py            # thêm --shots để lưu ảnh vào selftest\out\
```

`selftest/run.py` tự khởi động uvicorn với **SQLite tạm và `MONGO_URI` rỗng** (ghi đè `.env`) nên không bao giờ chạm vào MySQL/Mongo thật. Muốn kiểm cả MongoDB thật: đặt `SELFTEST_MONGO_URI` (ghi vào database `qlct_selftest`, rồi xoá).

Cần Playwright (đã khai báo trong `requirements-dev.txt`): `pip install playwright` — dùng Edge/Chrome có sẵn, không phải tải Chromium.

## Giới hạn đã biết

- Mỗi sổ là **một tài liệu JSON**, tối đa 4 MB (≈ 20.000 giao dịch; giới hạn thân yêu cầu của Vercel là 4,5 MB). App cảnh báo từ 3 MB.
- Gộp khi hai thiết bị cùng sửa dựa vào đồng hồ máy (`updatedAt`): đồng hồ lệch nhiều có thể làm “bản muộn hơn” chọn nhầm.
- Kho `json` phía server chỉ để dev/test; trên Vercel thư mục ghi được là tạm thời.
- MySQL mới được kiểm qua SQLite (cùng mã SQL portable), MongoDB qua `fake_mongo` — chưa chạy trên máy chủ MySQL/MongoDB thật.
- Chưa có: nhiều người dùng đồng thời, đính kèm ảnh chứng từ, OCR, đa tiền tệ, mã hoá đầu cuối. PWA: chưa thử trên Safari/iOS và điện thoại thật; chưa có công cụ chuyển giao dịch năm cũ ra file.
