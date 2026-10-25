# Làn Wiki — kiểm tổng (24–25/10)

## Kết quả (chạy thật, máy đang bận ~100% CPU vì các làn khác)
| Phép kiểm | Lần 1 | Chạy lại đúng phép đỏ |
| --- | --- | --- |
| wiki `kiem.js` | 387/388, SAI 1: "toán 20 hình xấu < 500 ms" (724 ms, máy bận) | **388/388** đạt |
| wiki `check.py --tat-ca` | 451 đạt, 2 sai (xem dưới) | `--hieu-nang`: 16/0 (2337 ms) |
| notebook `kiem.js` | 71 đạt | — |
| notebook `kiem-lib.js` | dữ liệu hợp lệ (116 mục) | — |
| notebook `check.py --tat-ca` | lần 1 bị ngắt giữa tầng 5 (tiến trình nền chết, 193 đạt / 0 sai trước đó); chạy lại phần còn lại: `--hieu-nang` 9/0, `--ma` (g++) 115 mẫu đạt | — |
| notebook `sync.py --kiem` | các bản chép khớp nguồn | — |

Hai chỗ đỏ của wiki `check.py --tat-ca`: (1) `kiem.js` đỏ thời gian như trên; (2) "lưu một ghi chú giữa kho lớn < 3 s" = 3163/3095 ms khi máy bận, 6488 ms (PW_PERF_SLACK=2) khi g++ chạy cùng, **2337 ms** khi máy đỡ bận. Cả hai là đỏ do tải máy, không phải lỗi mã; không có đỏ chức năng/XSS/offline/hydrate.

## Đã sửa (nhỏ, thuộc làn Wiki)
- `personal-wiki/check.py`: phép "lưu ghi chú giữa kho lớn" nay nhân ngưỡng 3 s với `PW_PERF_SLACK` như mọi phép hiệu năng khác (trước đó là cứng). Mặc định không đổi. Không động vào mã app nên không cần `tao-pwa.py`.

## Trước / sau (so với bàn giao W6)
- wiki: kiem.js 388 (như W6); check --tat-ca 451 đạt + 2 đỏ tải máy, chạy lại 0 sai.
- notebook: kiem.js 71, kiem-lib hợp lệ, sync khớp, check.py tất cả tầng 0 sai (tầng 1–5 phần đầu 193 đạt + hiệu năng 9 + mã C++ 115).

## Hạn chế còn lại (chưa làm)
- Mermaid thật + SRI cdnjs chưa thử có mạng (kiểm bằng `window.mermaid` giả); sai SRI chỉ khiến hiện khối mã.
- Hydrate note 400k ký tự: ~12 s/835 công thức (chia lát để không chặn gõ); chưa ưu tiên khối đang nhìn thấy.
- PNG không vẽ KaTeX lên canvas (vẽ TeX nguyên văn) — lệch thiết kế đã ghi ở W6.
- Công thức > 2000 ký tự hoặc lồng sâu (> 10 tầng/40 lệnh) giữ TeX nguyên văn (chống sập tab).
- Đề xuất sửa skill `webapp-thuan`/CLAUDE.md: xem `dot/W6.md` (vendor lười ngoài ngân sách vỏ, cache SW riêng; `assets/vendor/katex/**` ở notebook là tệp chép bằng `sync.py`).
- Lưu ý chạy kiểm: các phép hiệu năng nhạy với tải; chạy lẻ lúc máy rảnh hoặc dùng `PW_PERF_SLACK=2`.

## Chủ dự án nên tự thử
- Điện thoại thật (Android/iOS): mở note có công thức, gõ giữa note dài, PWA đã cài.
- Safari (macOS/iOS): KaTeX woff2, mermaid, xuất PDF/in; PNG công thức.
- Offline thật: tắt mạng, mở lại app đã cài → TeX nguyên văn khi KaTeX chưa tải; bật mạng lại → tự vẽ.
- Một lần có mạng: sơ đồ mermaid thật trong Wiki và Notebook.
