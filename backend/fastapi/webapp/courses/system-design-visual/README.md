# Phụ lục trực quan — Học System Design

Mô phỏng **tương tác** cho [khoá System Design](../khoa-hoc/README.md) —
những đánh đổi mà bảng và văn bản không truyền tải được.

> **Không Node, không npm, không thư viện ngoài.** HTML + CSS + JavaScript thuần.
> Mọi con số **tính bằng công thức thật của bài giảng**, không phải hình minh hoạ.

---

## Chạy

**Nhanh nhất:** nhấp đúp [`index.html`](index.html). Chạy được bằng `file://`.

```bash
cd system-design/visual
python -m http.server 8782 --bind 127.0.0.1
# mở http://127.0.0.1:8782
```

---

## 8 mô phỏng

| Nhóm | Demo | Bài | Điều nó cho thấy |
|---|---|:--:|---|
| **Ước lượng & hàng đợi** | Vì sao hệ thống sập ở 80 % công suất | B02 | `W ∝ 1/(1−ρ)` · ★ cùng đỉnh tải 25 %: từ ρ=0,6 thì chịu được, từ ρ=0,8 thì **nổ** |
| | Tail latency — fan-out khuếch đại đuôi | B44 | `0,99¹⁰⁰ = 0,366` ⇒ **63 % request chạm đuôi** · p99.9 mua lại một bậc |
| | Cache — tỷ lệ trúng đổi độ trễ | B10 | 90→100 % đáng giá hơn 50→60 % · ★ **cache trống = DB sập** |
| **Dữ liệu & nhất quán** | Độ trễ nhân bản và ba bảo đảm đọc | B19 | read-your-writes là điểm ngọt · lỗi **không ném exception nào** |
| | Sharding và hot partition | B20 | Zipf + 3 chiến lược · ★ **thêm shard KHÔNG chữa được hot partition** |
| **Phân tán** | CAP và PACELC | B27 | P không phải lựa chọn · ★ PACELC quan trọng hơn vì 99,9 % thời gian mạng **không** đứt |
| **Vận hành** | Bão retry | B42 | ★ **metastable failure** — hết sự cố gốc mà hệ thống vẫn không hồi phục · jitter · circuit breaker |
| | SLO và ngân sách lỗi | B41 | 99,9 % = **43 phút/tháng** · ngân sách không tiêu hết cũng là lãng phí |

---

## Nguyên tắc thiết kế

```
   ① MỖI DEMO PHẢI PHÁ ĐƯỢC.
      Kéo tham số tới cực trị và xem hệ thống gãy — có giải thích vì sao.

   ② SỐ LIỆU BÁM ĐÚNG BÀI GIẢNG.
      Bảng hệ số chờ (50%→2×, 80%→5×, 99%→100×), phép tính 0,99¹⁰⁰ = 0,366,
      bảng các chữ số 9 — đều là số của bài giảng.

   ③ NÓI RÕ CHỖ NÀO LÀ MÔ HÌNH HOÁ.
      Demo "bão retry" dùng mô hình một tầng, thời gian rời rạc — và bài viết
      ghi rõ điều đó bằng dấu ⚖️.

   ④ MỖI DEMO NỐI VỀ BÀI GIẢNG CỤ THỂ.
      check.py xác minh liên kết trỏ tới slug CÓ THẬT trong content.js.
```

---

## Bản đồ tệp

```
   visual/
   ├── index.html                khung trang, nạp các file demo
   ├── check.py                  mỏng — gọi ../../engine/kiem_demo.py
   └── assets/
       ├── vis.css               ★ BẢN SAO của engine/vis.css — đừng sửa
       ├── vis-core.js           ★ BẢN SAO của engine/vis-core.js — đừng sửa
       ├── chu-de.css            RIÊNG — bảng màu (xanh mòng két #0e7490)
       ├── cau-hinh.js           RIÊNG — window.CAU_HINH_VIS
       ├── vis-1-uoc-luong.js    hàng đợi · tail latency · cache · bão retry
       └── vis-2-du-lieu.js      nhân bản · sharding · CAP/PACELC · SLO
```

Engine dùng chung với [`samsung/visual`](../../samsung/visual/README.md) và
[`ai-everything-course/visual`](../../ai-everything-course/visual/README.md) —
nguồn thật ở [`courses/engine/`](../../engine/README.md).

### Kiểm tra

```bash
python -m http.server 8782 --bind 127.0.0.1   # ở một cửa sổ khác
python check.py [--shot] [--nhom "Phân tán"]
```

---

## Còn có thể bổ sung

Khoá này có 58 bài; 8 demo mới phủ phần định lượng nhất. Các ứng viên tiếp theo,
xếp theo giá trị:

```
   · Raft — bầu leader và nhân bản log        (b.32–33)  ★ dễ hiểu hơn hẳn khi động
   · Đồng hồ Lamport / vector clock           (b.31)
   · Linearizability — lịch sử hợp lệ hay không (b.35)
   · Idempotency và outbox                    (b.25)
   · Bộ lọc Bloom và cấu trúc xác suất        (b.05)
   · Rate limiting: token bucket vs leaky     (b.12)
```

---

**Trang khoá học:** [`../web/index.html`](../web/index.html) ·
**Khoá học:** [`../khoa-hoc/README.md`](../khoa-hoc/README.md)
