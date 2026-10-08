---
name: backend-fastapi
description: Cách làm việc với backend FastAPI của dự án (backend/fastapi) — kiến trúc lục giác, thêm một route/use case/kho lưu trữ, cấu hình, xử lý lỗi, test, cơ sở dữ liệu và những điều không được đụng. Dùng khi sửa hoặc thêm bất cứ thứ gì trong backend/fastapi/src hoặc tests.
---

# Backend FastAPI

## Lớp và luồng

```text
adapter/input/controllers/*_controller.py   route (FastAPI APIRouter), kiểm dữ liệu vào bằng Pydantic
        │ Depends(get_*_usecase)
adapter/factory/*_factory.py                nối use case với cổng ra (một chỗ duy nhất tạo đối tượng)
        ▼
application/usecases/*_usecase.py           luật nghiệp vụ; KHÔNG biết HTTP, SQL, httpx
application/ports/{input,output}/*          giao diện trừu tượng (ABC)
        ▼
adapter/output/{mysql,mongo,spending,gemini,web}/…   cài đặt cổng ra
domain/{models,vo,enums,utils}              kiểu dữ liệu thuần
application/{config,exceptions,utils}       settings, AppException, tiện ích (rate_limit, admin_session…)
```

Đăng ký router ở `src/main.py`. Tiền tố API là `settings.API_PREFIX` (mặc định `/api/v1`).

## Thêm một route (làm theo mẫu có sẵn)

1. Use case mới ở `application/usecases/` — nhận cổng/đối tượng qua `__init__`, ném `AppException`/`BadRequestError`/`NotFoundError`
   (`application/exceptions/exceptions.py`) kèm `payload={"code": "…"}` để client phân biệt lỗi.
2. Hàm `get_xxx_usecase` ở `adapter/factory/`; controller `Depends` vào nó. Cần database thì `Depends(get_async_session_dependency)`.
3. Controller: Pydantic model có `Field(max_length=…)` cho **mọi** chuỗi người dùng gửi (chống thân yêu cầu khổng lồ; Vercel giới hạn 4,5 MB).
4. Test ở `tests/application/` (use case, nhanh) và `tests/adapter/input/controller/` (qua `TestClient`, ghi đè dependency bằng
   `app.dependency_overrides`). Mẫu AI: `test_ai_http_usecase.py`, `test_ai_controller.py`. Mẫu kho: `tests/adapter/output/spending/`.

## Lỗi và phản hồi

- Lỗi thành `{status_code, message, data:{code,…}}` (middleware đọc `AppException`). Route `/ai/*` trả **JSON trần** khi thành công
  và dùng phong bì lỗi trên khi lỗi — client AI (`ai-khach.js`, `aiService.ts`, `ai.js`) dựa vào đó.
- Dữ liệu sai kiểu bị FastAPI từ chối bằng **422** trước khi vào use case (không phải 400).
- `Cache-Control: no-store` cho phản hồi riêng tư/AI.

## Cấu hình (`application/config/config.py`, đọc từ `.env`)

`DB_URL` (SQLite dev) hoặc `DB_*` (MySQL), `MONGO_URI`, `COURSE_ADMIN_KEY`, `GEMINI_URL`/`GEMINI_API_KEY`, `AI_*` (xem `them-tinh-nang-ai`),
`SPENDING_*`, `API_PREFIX`. Thêm biến mới → đặt mặc định an toàn trong `Settings`, ghi vào `.env.example` và `README.md`.

## Cơ sở dữ liệu

- Dev/test: SQLite (`DB_URL=sqlite+aiosqlite:///data/dev.sqlite3`); khi chạy pytest ứng dụng tự dùng SQLite trong bộ nhớ.
  Test cần DB dùng `run_with_db` hoặc fixture trong `tests/conftest.py` (mọi việc trong **một** `asyncio.run` vì DB sống theo vòng lặp sự kiện).
- **Không ghi vào Aiven/MySQL thật.** Migration: `alembic` (xem `README_MIGRATIONS.md`); bảng nhỏ tự tạo `CREATE TABLE IF NOT EXISTS` (postman, spending).
- Mongo chỉ có kho `payload_json` dạng chuỗi (dữ liệu client mờ), test bằng `tests/support/fake_mongo.py`.

## Kiểm

```text
cd backend/fastapi
.venv/Scripts/python.exe -m pytest -q                      # toàn bộ (~1.040 test, ~1,5 phút)
.venv/Scripts/python.exe -m pytest tests/application -q    # chỉ use case
```

`tests/conftest.py` có fixture tự động: đặt lại giới hạn AI, chặn `models.list` thật, xoá bộ nhớ danh mục model. Test không bao giờ chạm Gemini thật.

## Phục vụ webapp

`webapp_controller.py` phục vụ `webapp/<app>/…`, ghim kiểu MIME cho `.js`/`.webmanifest`, chèn `__WEBAPP_CONFIG__` vào `index.html`
(`apiBase`, `webappBase`, + `config` trong `metadata.json` của app). App cần `metadata.json` (title, description, tags, icon; `category` tuỳ chọn)
để cổng liệt kê. Tên app chỉ gồm `[A-Za-z0-9_-]`.
