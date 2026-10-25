# Logic Puzzle Suite — 6 loại mới (bàn giao, 25/10/2026)

App: `backend/fastapi/webapp/tranphuc8a/logic-puzzle-suite` (viết tay, offline, không backend). Hợp đồng engine: `HUONG-DAN-ENGINE.md` mục 11 (11.15 = tổng hợp).

## Loại mới (đã vào Daily từ 30/10/2026)
| Loại | Làm gì | Công thức/giải thuật đã kiểm bằng |
| --- | --- | --- |
| `coinbalance` | Cân đĩa tìm xu giả (biết nặng hơn / không biết / có xu chuẩn / chỉ cần chỉ ra xu); xu cố định theo seed hoặc đối thủ thích nghi; ngân sách lần cân cứng | vét cạn cây quyết định cỡ nhỏ; kiểm đột biến |
| `bachet` | Ít quả cân nhất cân mọi 1..N (hai đĩa: 1, 3, 9, 27…) | vét cạn bộ quả cân, cận đếm |
| `coinscale` | Cân điện tử: n chồng xu một chồng giả / xu hai loại khối lượng | vét cạn tập ứng viên (n ≤ 6) |
| `camel` | Một lạc đà chở chuối từ kho: đi xa nhất / chở tới đích; nộp kế hoạch, chấm chất lượng | BFS vét cạn + công thức bậc thang |
| `motorbike` | Đi bộ & xe máy: cách hiểu A (mặc định), B (tuỳ chọn); số hữu tỉ BigInt | LP liệt kê 768 đỉnh, BFS khử đối xứng, mô phỏng số thực |
| `lightsoutx` | Lights Out biến thể: luật, mép, k ∈ {2,3,5}, ô khoá, bàn tới 20 | vét cạn k^n, OEIS A159257 |

## Daily
`core/daily.js` SCHEDULE phiên bản 2: `tu 2026-10-30`, 11 loại (5 cũ + 6 mới ở cuối). Chọn ngày tương lai để hôm nay và quá khứ KHÔNG đổi (kiểm trùng hệt lịch cũ từ 2020-01-01). Loại không đăng ký (vd `motorbike` thiếu BigInt) → nhảy loại kế. Thêm loại sau: thêm phiên bản thứ ba, ngày tương lai.

## Hạn chế đã biết
- Nhãn CW1/CW2/CW3/V1 là CÁCH HIỂU ĐÃ CHỐT (Q7), không phải đề gốc duy nhất.
- Xe máy không chia hết: chưa biết tối ưu chính xác; chấm theo cận LP, không bao giờ 3★.
- `lightsoutx`: par ước lượng (chip "Par ≈ K") ở ~7,3 % cấu hình lớn.
- Hoãn (Q8): Lights Out D5–D6 (soạn bằng bấm, bàn 12–20 zoom), lạc đà V2 (đoàn), coinscale chế độ kế hoạch, ghi chú người chơi của CW1.
- Nonogram, Safari thật, điện thoại thật chưa thử; Safari < 14 thiếu BigInt → vắng thẻ xe máy.
- Việc vỏ chung dồn lượt kiểm tổng: "Xem lời giải từng bước" giữa ván không bị phạt ở mọi loại.

## Lệnh kiểm
- `PUZ_PERF_SLACK=3 node …/logic-puzzle-suite/kiem.js [loại|core]` (máy bận)
- `…/.venv/Scripts/python.exe …/logic-puzzle-suite/check.py --tinh | --chuc-nang | --co-gian | --tat-ca`
- Kiểm hẹp một bàn: `PYTHONUTF8=1 …/python.exe tasks/2610/261023/cai-tien-webapp/nhap/puzzle-lo-coin/chay-rieng.py <loại> [vong-doi|ban|hoc|di-dong]`
- Sửa tệp nào của app phải chạy `tao-pwa.py`.
- Bàn giao từng đợt: `tasks/2610/261023/cai-tien-webapp/dot/P1..P8.md`.
