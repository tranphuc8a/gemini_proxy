# Nơi chạy mã tự dựng cho Code Studio (Piston, Judge0)

Backend `POST /run` chuyển mã tới một **nhà cung cấp chạy mã**. Máy công cộng thì tiện nhưng có giới hạn (Wandbox chậm 15–40 s, Judge0 CE công cộng
giới hạn tốc độ, Piston công cộng emkc.org chỉ cho danh sách trắng từ 15/02/2026). Thư mục này dựng **máy của riêng bạn**, để mã nguồn không rời hạ tầng bạn quản lý
và không phụ thuộc dịch vụ ngoài.

| Cần | Chọn |
|---|---|
| Nhẹ, cài nhanh, đủ cho đoạn mã đơn tệp mọi ngôn ngữ, Python/JS nhiều tệp | **Piston** (`piston/`) |
| Dự án **nhiều tệp C/C++/Java**, cờ biên dịch (`-std=`, `-O2`), thống kê thời gian/bộ nhớ | **Judge0** (`judge0/`) — hoặc `local` (g++/javac trên máy chạy backend) |
| Không muốn chạy Docker | `RUN_LOCAL_ENABLED=true` (không phải sandbox — chỉ máy của chính bạn) hoặc Wandbox/Judge0 công cộng |

> **Tình trạng kiểm chứng (17/10/2026).** Piston: **đã chạy thật** (Docker trong WSL2 Ubuntu 24.04, cgroup v2) — cài runtime bằng `piston/cai-runtime.sh`, rồi
> `tools/kiem_nha_cung_cap_that.py piston` đạt cả 7 ngôn ngữ đơn tệp + Python/JavaScript nhiều tệp. Judge0: **khởi động và xác thực được, nhưng chưa chạy được mã** trên máy thử (cgroup v2) — xem mục Judge0.

## Yêu cầu chung

* Docker Engine ≥ 24 với `docker compose` (v2). Lệnh dưới ghi `docker compose`; bản cũ `docker-compose` v1.29 chạy được nhưng **hỏng khi tạo lại** container
  trên Docker mới (`KeyError: 'ContainerConfig'`) — muốn đổi cấu hình thì `down` rồi `up`, hoặc dùng compose v2.
* Cả hai chạy mã người lạ bằng namespace/cgroup nên container **phải `privileged`**. Hệ quả: coi máy chạy chúng là nơi **không tin cậy hoàn toàn** — tách khỏi dữ liệu quan trọng,
  chỉ mở cổng ở `127.0.0.1` (mặc định của các tệp ở đây) hoặc mạng riêng, **không bao giờ** ra Internet không kèm khoá.
* Piston ≈ 1 GB ảnh + runtime (gcc ≈ 750 MB, đo ~7 phút trên đường truyền thường). RAM thực tế ~0,5 GB khi cài. Judge0 ≈ 1,5 GB ảnh + PostgreSQL + Redis.
* **Windows + WSL2**: cổng publish ở `127.0.0.1` *trong WSL* **không** tới được từ Windows. Đặt `PISTON_BIND=0.0.0.0` (hoặc `JUDGE0_BIND`) để backend chạy trên Windows gọi được
  qua `localhost`; chỉ làm vậy trên máy dev. Và WSL2 tự tắt máy ảo khi không còn tiến trình `wsl` nào — giữ một cửa sổ `wsl` mở trong lúc dùng.

## Piston

```bash
cd deploy/code-runner/piston
docker compose -p cs-piston up -d            # Windows+WSL: PISTON_BIND=0.0.0.0 docker compose -p cs-piston up -d
./cai-runtime.sh                              # gcc (C, C++), python, node, java; chạy lại bao nhiêu lần cũng được
./cai-runtime.sh go rust                      # thêm gói khác (tên GÓI Piston ≠ tên ngôn ngữ: gcc = C+C++, node = JavaScript)
```

Cho backend (`backend/fastapi/.env`):

```ini
RUN_PISTON_URL=http://localhost:2000/api/v2     # adapter gọi {RUN_PISTON_URL}/execute
RUN_DEFAULT_PROVIDER=piston                     # tuỳ chọn: mặc định hiện là wandbox
```

Kiểm bằng chương trình thật (khởi động backend tạm, gửi mã nhỏ qua chính `/run`):

```bash
cd backend/fastapi
RUN_PISTON_URL=http://localhost:2000/api/v2 .venv/Scripts/python.exe tools/kiem_nha_cung_cap_that.py piston
```

Điều đã đo trên Piston thật (ảnh `ghcr.io/engineer-man/piston:latest`, gcc 10.2.0, python 3.12.0, node 20.11.1, java 15.0.2, go 1.16.2, rust 1.68.2):

* C, C++, Python, Java, JavaScript, Go, Rust một tệp: đúng. **Nhiều tệp chỉ Python và JavaScript.** Gói `gcc` và `java` của Piston chỉ biên dịch **tệp vào**
  (đổi tên thành `main.cpp.cpp` / `Main.java.java`) và không giữ thư mục con, nên `#include "include/calc.h"` hay lớp thứ hai bị "không tìm thấy". Backend vì thế **từ chối ngay**
  dự án nhiều tệp C/C++/Java gửi tới Piston (`run_multifile_unsupported`) thay vì trả thông báo biên dịch khó hiểu — dùng Judge0/`local` cho loại đó.
* Piston **không gửi header CORS**: nơi chạy "Piston của bạn (URL)" gọi thẳng từ trình duyệt chỉ chạy được khi có reverse proxy thêm `Access-Control-Allow-Origin`. Đường qua backend
  (`RUN_PISTON_URL`) không cần CORS.
* Piston bỏ qua cờ biên dịch (`compileArgs`, chuẩn, tối ưu) — kết quả có `warnings` nói rõ.
* Ảnh Piston không có `curl`/`wget`; `healthcheck` trong compose dùng `node`.
* `PISTON_RUN_TIMEOUT` / `PISTON_COMPILE_TIMEOUT` (compose đặt 15 s / 30 s) là **trần**: Piston từ chối (HTTP 400, backend báo `run_provider_rejected`) yêu cầu đòi hơn. Mặc định của Piston 3 s / 10 s quá thấp cho Java/Rust.

Gỡ: `docker compose -p cs-piston down` (giữ runtime đã cài) hoặc `down -v` (xoá cả ổ `piston-packages`).

## Judge0 CE

```bash
cd deploy/code-runner/judge0
cp judge0.conf.example judge0.conf          # RỒI ĐỔI hai mật khẩu và AUTHN_TOKEN (judge0.conf nằm trong .gitignore)
docker compose -p cs-judge0 up -d db redis && sleep 10 && docker compose -p cs-judge0 up -d
```

Cho backend:

```ini
RUN_JUDGE0_URL=http://localhost:2358
RUN_JUDGE0_KEY=<AUTHN_TOKEN>
RUN_JUDGE0_KEY_HEADER=X-Auth-Token
```

Kiểm: `RUN_JUDGE0_URL=… RUN_JUDGE0_KEY=… .venv/Scripts/python.exe tools/kiem_nha_cung_cap_that.py judge0` (chạy chương trình thật, gồm C/C++/Java/Python nhiều tệp).

**Cần cgroup v1.** Judge0 1.13.x chạy mã bằng `isolate` và `isolate` cần cgroup v1. Trên máy cgroup v2 (Ubuntu ≥ 22.04 mặc định, WSL2, Docker Desktop) bài nộp trả
`Internal Error — No such file or directory @ rb_sysopen - /box/script.py`. Bật cgroup v1: thêm `systemd.unified_cgroup_hierarchy=0` vào `GRUB_CMDLINE_LINUX` rồi khởi động lại
(WSL2: `kernelCommandLine` trong `.wslconfig` — khởi động lại **mọi** container WSL, cân nhắc trước). Máy Piston không bị ràng buộc này.

> **Đã kiểm (17/10/2026, Docker trong WSL2 Ubuntu 24.04 = cgroup v2):** `docker compose config` sạch; kéo `judge0/judge0:1.13.1`, `postgres:13.0`, `redis:6.0`; cả bốn container lên; `GET /about` trả 200 với
> `X-Auth-Token` đúng và 401 khi thiếu/sai (xác thực `AUTHN_TOKEN` hoạt động; adapter báo `run_provider_rejected` đúng khi khoá sai). **Chưa kiểm được việc chạy mã** vì máy thử là cgroup v2 — hiện tượng đúng như trên.
> **Chưa kiểm** tên các khoá khác trong `judge0.conf.example` (giới hạn thời gian/bộ nhớ, `ENABLE_*`): server nhận cấu hình và khởi động, nhưng giá trị có hiệu lực hay không thì chưa đo.
> Adapter Judge0 đã chạy thật với **Judge0 CE công cộng** `https://ce.judge0.com` (7 ngôn ngữ đơn tệp + nhiều tệp C/C++/Python/Java/JavaScript) — xem `docs/code-studio-api.md` §5.

Gỡ: `docker compose -p cs-judge0 down` (giữ CSDL) hoặc `down -v`.

## Bảo mật — đọc trước khi mở ra ngoài localhost

* Container `privileged` = có thể thoát ra máy chủ nếu `isolate`/Piston có lỗ hổng. Dùng máy/VM riêng, không chạy chung với CSDL thật.
* Đặt khoá: Piston không có cơ chế khoá riêng (đặt sau reverse proxy có xác thực nếu mở ra ngoài; backend gửi `RUN_PISTON_KEY` trong header `Authorization`);
  Judge0 có `AUTHN_TOKEN` (xem `judge0.conf.example`).
* Backend đã tự giới hạn: ≤ 64 tệp, 128 KB/tệp, 256 KB tổng, stdin 64 KB, ≤ 15 s chạy / 30 s biên dịch, 20 lượt/phút/IP (`RUN_RATE_PER_MIN`, đếm bền khi `RATE_LIMIT_BACKEND` ≠ memory).
  Đó là lớp **thêm**, không thay cho việc cô lập máy chạy mã.
