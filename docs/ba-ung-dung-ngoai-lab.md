# Ba ứng dụng ngoài lab — bàn giao

Ngày 2026-09-27. Ba ý trong danh sách 16 ý tưởng không phải lab; bạn đã chốt
*"làm cả ba sau khi xong đợt 7"*. Đợt 7 xong, nên đây là chúng.

Xem thêm: [`web-lab-ke-hoach.md`](web-lab-ke-hoach.md) mục 4b (phân loại 16 ý) và
[`web-lab-dot-7-ban-giao.md`](web-lab-dot-7-ban-giao.md).

---

## Vì sao chúng không nằm trong `courses/`

Lab trong `courses/*-visual/` phải thoả năm tiêu chí ở mục 1 của kế hoạch —
quan trọng nhất là **có núm để vặn** và **có điều bất ngờ**. Ba thứ này không có
cả hai: chúng là **công cụ**, **tài liệu** và **ứng dụng**. Nhét vào lộ trình
lab sẽ kéo engine `vis-core.js` đi sai hướng.

Nên chúng nằm ở `webapp/tranphuc8a/`, cạnh `markdown-editor-pro`. Cổng portal
đã tự thấy cả ba (kiểm bằng `_scan_apps_recursive`: 252 app, ba cái mới đều có
đúng `category`).

---

## Cả ba theo cùng một bộ ràng buộc

Giống hệt ràng buộc của `courses/`, và cố ý giữ như vậy:

| Ràng buộc | Vì sao |
|---|---|
| **Không thư viện ngoài** | `vercel-bundle-size.md` cho thấy kích thước gói đang là vấn đề sống |
| **Chạy được bằng `file://`** | mở thẳng `index.html` là dùng được, không cần máy chủ |
| **Có `kiem.js` chạy bằng node** | logic phải kiểm được, không chỉ "trông có vẻ chạy" |
| **Tiếng Việt** | cả giao diện lẫn dữ liệu |

Để ý kích thước: **60–80 KB mỗi ứng dụng**, so với `markdown-editor-pro` là
**7,5 MB**. Toàn bộ ba ứng dụng cộng lại nhỏ hơn 3 % một ứng dụng React đã build.

```bash
cd backend/fastapi/webapp/tranphuc8a
node kiem-tat.js          # chạy bộ kiểm của cả ba, exit 1 nếu hỏng
```

| Ứng dụng | Đường dẫn | Phép kiểm | Cỡ |
|---|---|:--:|:--:|
| **JSON Editor** | `tranphuc8a/json-editor` | 58 | 64 KB |
| **Mẫu thiết kế** | `tranphuc8a/design-pattern` | 36 | 80 KB |
| **Chi tiêu** | `tranphuc8a/chi-tieu` | 84 | 60 KB |
| | | **178** | **204 KB** |

---

## 1. JSON Editor

Năm chế độ: **Soạn** (số dòng, tô dòng lỗi) · **Cây** (gấp mở từng nhánh) ·
**Truy vấn** (đường dẫn kiểu JSONPath) · **So sánh** · **Thống kê**. Kèm định
dạng, nén, sắp khoá, gỡ một lớp chuỗi, mở/tải tệp.

### Bug thật bộ kiểm bắt được

**`JSON.parse` của V8 có ít nhất BỐN dạng thông báo lỗi, và dạng hay gặp nhất
không kèm vị trí nào cả.**

```
V8 cũ          Unexpected token } in JSON at position 42
V8 mới         Expected ',' … at position 42 (line 3 column 5)
SpiderMonkey   JSON.parse: expected … at line 3 column 5
V8, chuỗi ngắn Unexpected token '}', ..."1,⏎  "b": }⏎}" is not valid JSON   ← không có vị trí
```

Bản đầu của tôi chỉ xử lý hai dạng có vị trí. Nghĩa là **tính năng chính của
trình soạn này — chỉ đúng dòng lỗi — im lặng không hoạt động trên Chrome ở
phần lớn trường hợp**. Trang vẫn chạy, đèn vẫn đỏ, chỉ là không chỉ được dòng.

Dạng thứ tư nhúng một **đoạn trích của chính nguồn**, nên phải đi tìm lại đoạn
đó trong nội dung. Hai chỗ nữa sai trong lần sửa đầu:

- ký tự gây lỗi **có thể là chính dấu xuống dòng**, mà regex `.` không khớp `\n`;
- V8 cắt đoạn trích **căn giữa** chỗ lỗi, nên lấy lần xuất hiện *cuối cùng* là
  sai — phải lấy lần **gần giữa đoạn trích nhất**.

`kiem.js` giờ có bảng **11 JSON hỏng thật** với dòng lỗi đã biết trước, chạy qua
`JSON.parse` thật của node. 11/11 chỉ đúng dòng.

> Đây là **phỏng đoán**, không phải vị trí chính xác — và mã có ghi rõ như vậy.
> Vẫn tốt hơn nhiều so với không chỉ ra được dòng nào.

### Một chỗ tôi viết phép thử sai

Phép thử đầu bảo `$..ten` **không** được trả về khoá `ten` ở gốc. Sai: `..ten`
nghĩa là *tìm khoá đó ở mọi cấp*, và gốc là một cấp. Code đúng, phép thử sai.

### Phép so sánh so cây, không so chuỗi

Đổi thứ tự khoá trong object **không** bị tính là khác — JSON không quy định
thứ tự khoá. Nhưng đổi thứ tự **phần tử mảng** thì có, vì thứ tự mảng là dữ
liệu. Có phép thử cho cả hai.

---

## 2. Mẫu thiết kế — tra nhanh

23 mẫu GoF (đủ 5 khởi tạo + 7 cấu trúc + 11 hành vi) cộng 4 mẫu hiện đại:
dependency injection, repository, null object, circuit breaker.

### Điều làm nó khác các cheat sheet khác

Mỗi mẫu đều có mục **✘ Đừng dùng khi** và **Cái giá phải trả**. Hầu hết bảng
tra chỉ nói *khi nào dùng*, trong khi mẫu thiết kế **bị lạm dụng nhiều hơn bị
dùng thiếu**. Vài ví dụ:

- **Singleton** — *"Hầu hết mọi lúc. Đây là mẫu bị lạm dụng nhiều nhất trong cả
  23 mẫu."* Kèm câu hỏi tự kiểm: *"mình cần một thể hiện, hay mình chỉ lười
  truyền tham số?"*
- **Strategy** — trong ngôn ngữ có hàm hạng nhất thì mẫu này *chỉ là một tham số
  hàm*. Đừng dựng cả cây lớp cho việc đó.
- **Visitor** — dễ thêm thao tác, **khó thêm loại nút**. Đúng ngược với hướng
  đối tượng thông thường.
- **Flyweight** — *"Chưa đo thì đừng dùng."*

Tìm được theo **vấn đề đang gặp**, không chỉ theo tên: gõ `hoàn tác` ra Command
và Memento; gõ `test` ra Singleton, DI, Repository. Tìm không dấu vẫn ra, và từ
khoá được tô sáng **mà vẫn giữ nguyên dấu** của bản gốc.

### Phép kiểm đáng nói

Không chỉ đếm số lượng mà **đối chiếu với danh sách 23 tên gốc của GoF** — thiếu
một cái hay xếp nhầm một cái vào nhóm GoF đều bị bắt. Cộng với: mọi mẫu phải có
≥ 2 mục *"đừng dùng khi"*, mọi ví dụ mã phải dưới 18 dòng, mọi kiểu sơ đồ khai
báo đều phải có hàm vẽ thật, và mọi SVG sinh ra phải cân thẻ.

Một bất biến nhỏ nhưng hay hỏng: **bỏ hết thẻ `<mark>` phải ra đúng chuỗi gốc**
— sai là chữ bị mất hoặc nhân đôi trên màn hình.

---

## 3. Chi tiêu

Sổ thu chi cá nhân. Dữ liệu nằm trong `localStorage`, **không gửi đi đâu**.

Tóm tắt tháng kèm so sánh tháng trước · biểu đồ chi theo từng ngày · phân tích
theo nhóm · hạn mức từng nhóm báo động khi vượt · xuất/nhập CSV.

### Hai quyết định đáng ghi lại

**Tiền luôn là số nguyên đồng.** Không bao giờ lưu tiền bằng số thực:
`0.1 + 0.2 !== 0.3`, và sau vài trăm giao dịch thì tổng lệch vài đồng mà
*không ai biết tại đâu*. Có phép thử riêng cho bất biến này.

**Ngày lưu dạng chuỗi `"YYYY-MM-DD"`, không dùng `Date`.** Đối tượng `Date`
kéo theo múi giờ, và múi giờ là nguồn lỗi lệch-một-ngày kinh điển. `thangTruoc`
tự tính lấy thay vì qua `Date`, và có phép thử cho chỗ khó nhất: lùi qua năm mới
(`2026-01` → `2025-12`).

### Nhập tiền theo cách người Việt viết

`50k` · `1.5tr` · `2 triệu` · `20 nghìn` · `2 tỉ` · `1.234.567` đều đọc được.
Chỗ khó: `1.000` là một nghìn, còn `1.5tr` là một triệu rưỡi — cùng một dấu
chấm, hai nghĩa. Quy tắc: chỉ coi là dấu thập phân khi có hậu tố nhân.

Ô nhập hiện ngay số đọc lại (`= 1.500.000 ₫`) để người dùng thấy trước khi bấm
thêm — gõ nhầm một số 0 trong sổ chi tiêu là lỗi im lặng khó chịu.

### CSV

Chịu được **dấu phẩy và dấu nháy trong ghi chú** — chỗ mọi bộ đọc CSV viết vội
đều hỏng. Phép thử quan trọng nhất là **vòng tròn**: xuất ra rồi nhập lại phải
ra đúng dữ liệu cũ, từng trường một.

Lịch kiểm nhuận cũng được kiểm ở chỗ khó: 2024 nhuận, 2000 nhuận (chia hết 400),
**1900 không nhuận** (chia hết 100 nhưng không chia hết 400).

---

## Trạng thái

```bash
cd backend/fastapi/webapp/tranphuc8a && node kiem-tat.js
cd backend/fastapi && ./.venv/Scripts/python.exe -m pytest tests/ -q
```

| Kiểm | Kết quả |
|---|---|
| `kiem-tat.js` | **178 phép** trên 3 ứng dụng |
| Portal quét được | ✔ cả ba, đúng `category` |
| Pytest backend | 640 passed |

---

## Điều CHƯA làm, phải nói rõ

> **Chưa ứng dụng nào được mở bằng trình duyệt thật.** Giống hệt tình trạng của
> 32 lab.

Ở đây khoảng trống còn rộng hơn lab, vì `kiem.js` chỉ kiểm **hàm thuần** — nó
cố ý không chạm tới DOM. Nghĩa là **toàn bộ phần giao diện chưa được kiểm gì**:

- bố cục, màu, chế độ sáng/tối, màn hình hẹp
- mọi thao tác chuột: bấm tab, gấp mở nhánh cây, chọn nhóm chi tiêu, xoá khoản
- `localStorage` thật (bộ kiểm dùng bản giả trả `null`)
- mở và tải tệp, chép vào bộ nhớ tạm
- SVG có vẽ ra hình đúng không — bộ kiểm chỉ xác nhận **thẻ cân**, không xác
  nhận hình nhìn ra cái gì

Ba ứng dụng này **thuần giao diện** hơn lab nhiều, nên tỉ lệ phần chưa kiểm
cũng cao hơn. Cài `playwright` sẽ đóng được lỗ hổng này cho cả lab lẫn ứng dụng.

Ngoài ra: **chưa commit gì**.

---

## Việc tiếp theo

1. **Đợt 8** — thuốc độc · thử chìa khoá · tháp Hà Nội · hai quân mã. Dùng lại
   `V.cayQuyetDinh` + `V.choiThu` của đợt 7 nên rẻ hơn hẳn.
2. **Đợt 9** — chuỗi Markov · Bloom filter.
3. **Đợt 10** — vẽ số bằng chuột → mạng đoán (sinh dữ liệu thủ tục).
