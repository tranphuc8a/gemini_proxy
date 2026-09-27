# Ghi chú bàn giao: sửa CI/CD

## Kết quả
- FastAPI CI thiếu pytest vì chỉ cài `requirements.txt`; chuyển sang `requirements-dev.txt` và cập nhật cache key.
- FastAPI CI tiếp tục lỗi exit code 4 do gọi console script `pytest`: `tests/conftest.py` không tìm thấy package `src`. Dùng `python -m pytest -q` để thêm working directory vào `sys.path`.
- Spring Data Commons 4.0 chuyển `PropertyReferenceException` sang `org.springframework.data.core`; sửa import trong `ExceptionResolver` để Maven biên dịch được.
- Gỡ workflow CodeQL nâng cao cũ vì xung đột với CodeQL default setup của repository. Các job CodeQL dynamic trong run 36029555184 đã thành công.
- FastAPI matrix 3.12/3.13 bị hủy theo fail-fast sau khi job 3.11 lỗi; không phải lỗi độc lập.

## Kiểm chứng
- FastAPI: `640 passed` trên Python 3.12.
- Xác nhận executable `pytest.exe -q` tái hiện `ModuleNotFoundError: No module named 'src'`; `python -m pytest -q` pass `640` test.
- Java: Maven clean test + JaCoCo: `26 passed`; chạy bằng JDK 20 với `-Djava.version=20` do máy local không có JDK 21.
- Checkstyle: `BUILD SUCCESS`.
- `git diff --check`: sạch.

## Cần lưu ý
Chưa chạy lại Actions trên GitHub; cần push các thay đổi để xác nhận matrix Python 3.11/3.12/3.13 và Java 21 trên runner thực tế.
