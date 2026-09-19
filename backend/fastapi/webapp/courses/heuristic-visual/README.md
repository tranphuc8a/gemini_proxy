# Phụ lục trực quan — Học Heuristic

Mô phỏng **tương tác** cho [khoá Học Heuristic](../heuristic-course-from-basic-to-expert/README.md)
— những thứ không trình bày được bằng văn bản.

> **Không Node, không npm, không thư viện ngoài.** HTML + CSS + JavaScript thuần.
> Mọi thuật toán **chạy thật trong trình duyệt bạn**, không phải hoạt hình dàn dựng.

---

## Chạy

**Nhanh nhất:** nhấp đúp [`index.html`](index.html). Chạy được bằng `file://` vì
không có `fetch` nào.

```bash
cd samsung/visual
python -m http.server 8781 --bind 127.0.0.1
# mở http://127.0.0.1:8781
```

---

## 16 mô phỏng

| Nhóm | Demo | Bài | Điều nó cho thấy |
|---|---|:--:|---|
| **Nền tảng bài toán** | Bùng nổ tổ hợp — và cái bẫy của nó | B02 | `2ⁿ · n! · n!/(n−k)! · mⁿ` thang log · ★ **\|S\| khổng lồ ≠ khó**: DP giải `2¹⁰⁰` trong 2,5 ms |
| | Biểu diễn nghiệm — ba cách lưu cùng một thứ | B03 | cùng một nghiệm, ba mã hoá · 2-opt **không tồn tại** trên mảng gán nhãn |
| | Địa hình tối ưu và cực trị cục bộ | B12 | leo đồi thật · ba địa hình · ★ trên "sân golf" tỷ lệ thành công về **0 %** |
| **Dựng nghiệm** | Greedy — bốn họ chỉ số | B05 | lợi ích · chi phí · tỉ số Dantzig · ngẫu nhiên, so với **tối ưu DP** |
| | Giá mờ λ — tỉ giá quy đổi | B06 | quét λ, thấy điểm gãy · λ* = **giá trị biên** của tài nguyên |
| | Chèn · tiếc nuối · Clarke–Wright | B07 | bốn heuristic dựng tuyến · **đổi phân bố điểm thì đổi thứ hạng** |
| | GRASP — ngẫu nhiên hoá có kiểm soát | B08 | RCL kiểu A/B · ★ tái hiện **GRASP thua cả greedy** khi giá trị lệch |
| **Cải thiện nghiệm** | Leo đồi — nước đầu tiên hay tốt nhất? | B09 | 2-opt chạy từng bước · **cùng chất lượng, khác hẳn số lần đánh giá** |
| | Năm toán tử kinh điển | B11 | 2-opt/Or-opt/swap/relocate · quét cả lân cận từng toán tử |
| | Đánh giá delta | B10 | `O(1)` vs `O(n)` · ★ **lỗi trôi delta** — hỏng im lặng |
| **Metaheuristic** | Simulated annealing | B13 | Metropolis chạy thật · ★ **hai chế độ hỏng đối xứng** của T₀ |
| | Tabu search | B14 | tenure · tiêu chí nguyện vọng · cấm quá nhiều cũng tệ như không cấm |
| | Beam search | B16 | k=1 ⇒ greedy · ★ đánh giá nghiệm **dở dang** là phần khó nhất |
| | LNS & ALNS | B17 | phá/xây lại · ★ **ALNS tự học** toán tử nào hiệu quả, xem trọng số dịch chuyển |
| **Đo lường & cận** | Bao nhiêu test case là đủ? | B04 | `N ≳ 8(σ/Δ)²` · ★ kéo Δ=0 để thấy **dương tính giả** |
| | Cận trên, cận dưới — khi nào DỪNG | B18 | BHH `β√(An)` · ★ vượt cận **31 %** nhưng quy ra điểm chỉ **1,5 %** |

---

## Nguyên tắc thiết kế

```
   ① MỖI DEMO PHẢI PHÁ ĐƯỢC.
      Mỗi cái đều có ít nhất một tham số mà khi kéo tới cực trị sẽ làm
      thuật toán HỎNG một cách có ý nghĩa — và bài viết nói rõ hỏng thế nào.

   ② THUẬT TOÁN THẬT, KHÔNG HOẠT HÌNH.
      Leo đồi, SA, tabu, beam, LNS/ALNS đều chạy thật trên dữ liệu thật,
      trong trình duyệt bạn. Không có animation dàn dựng.

   ③ SỐ LIỆU BÁM ĐÚNG BÀI GIẢNG.
      Ví dụ cái túi B/D/E/C/A, bảng nhiệt độ SA, đề thi 158 nhà trên lưới
      100×100 — đều là số của bài giảng, không phải số bịa cho đẹp.

   ④ MỖI DEMO NỐI VỀ BÀI GIẢNG CỤ THỂ.
      check.py xác minh liên kết đó trỏ tới bài CÓ THẬT.
```

---

## Cách dùng đúng

> 📌 **Trước khi kéo một thanh trượt, hãy dự đoán điều sẽ xảy ra.** Rồi kéo và so.
> Mỗi lần dự đoán sai là một lần mô hình tư duy của bạn được sửa — và đó là toàn
> bộ giá trị của trang này. Xem mà không dự đoán thì chỉ là xem hoạt hình.

---

## Bản đồ tệp

```
   visual/
   ├── index.html                khung trang, nạp các file demo
   ├── check.py                  mỏng — gọi ../../engine/kiem_demo.py
   └── assets/
       ├── vis.css               ★ BẢN SAO của engine/vis.css — đừng sửa
       ├── vis-core.js           ★ BẢN SAO của engine/vis-core.js — đừng sửa
       ├── chu-de.css            RIÊNG — bảng màu (tím chàm #5b4bd6)
       ├── cau-hinh.js           RIÊNG — window.CAU_HINH_VIS
       ├── vis-1-nen-tang.js     bùng nổ tổ hợp · biểu diễn · địa hình
       ├── vis-2-dung-nghiem.js  greedy · giá mờ · chèn/CW · GRASP
       ├── vis-3-cai-thien.js    leo đồi · toán tử · delta
       ├── vis-4-metaheuristic.js SA · tabu · beam · LNS/ALNS
       └── vis-5-do-luong.js     đo lường · cận trên/dưới
```

Engine dùng chung với [`system-design/visual`](../../system-design/visual/README.md)
và [`ai-everything-course/visual`](../../ai-everything-course/visual/README.md) —
nguồn thật ở [`courses/engine/`](../../engine/README.md).
Sửa engine thì sửa ở đó rồi chạy `python engine/sync.py`.

### Kiểm tra

```bash
python -m http.server 8781 --bind 127.0.0.1   # ở một cửa sổ khác
python check.py [--shot] [--nhom "Metaheuristic"]
```

`check.py` mở **từng** demo bằng Chromium headless và kiểm: demo có ném lỗi không ·
có vẽ được gì không · có bảng điều khiển không · và ★ **liên kết tới bài giảng có
trỏ tới slug CÓ THẬT trong `web/assets/content.js` không**.

### Thêm demo mới

Tạo file `vis-6-*.js`, nạp trong `index.html` **sau** `vis-core.js`, gọi `demo({...})`.
Trường `nhom` phải khớp một mục trong `nhomThuTu` của `assets/cau-hinh.js`
(nhóm lạ vẫn hiện, nhưng bị xếp cuối).

---

**Trang khoá học:** [`../web/index.html`](../web/index.html) ·
**Khoá học:** [`../heuristic-course-from-basic-to-expert/README.md`](../heuristic-course-from-basic-to-expert/README.md)
