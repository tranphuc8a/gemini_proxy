# Kiểm tra bằng trình duyệt thật — bàn giao

Ngày 2026-09-27. Bảy đợt liền tôi đều kết thúc bằng cùng một câu: *"chưa lab
nào được mở bằng trình duyệt thật"*. Lần này đóng được lỗ hổng đó.

---

## Cài đặt

```bash
pip install playwright
python -m playwright install chromium     # ~150 MB, tải một lần
```

`playwright>=1.40` đã khai báo trong [`requirements-dev.txt`](../backend/fastapi/requirements-dev.txt)
— **không** ở `requirements.txt`, vì Vercel nhồi tệp đó vào bundle và
[`vercel-bundle-size.md`](vercel-bundle-size.md) cho thấy kích thước gói đang là
vấn đề sống.

## Hai tầng, hai mục đích khác nhau

```bash
cd backend/fastapi/webapp/courses

python lab-visual/check.py               # tầng 5: smoke test (bỏ --tinh)
python engine/kiem_hinh.py lab-visual    # tầng hình ảnh
python engine/kiem_hinh.py lab-visual --anh          # kèm chụp ảnh
python engine/kiem_hinh.py lab-visual --lab can-xu   # một lab
```

| Tầng | Trả lời câu hỏi |
|---|---|
| `check.py` (tầng 5) | Lab **có nổ không**, có vẽ ra gì không |
| `kiem_hinh.py` | Lab **trông có đúng không** |

`kiem_hinh.py` đo năm thứ, ở ba chế độ (1440×900 tối · 1440×900 sáng ·
420×860 tối):

1. **Canvas có vẽ gì không** — đọc điểm ảnh thật và đếm **số màu khác nhau**.
   Canvas tô kín một màu vẫn là canvas không vẽ.
2. **Các hộp có đè lên nhau không** — `getBoundingClientRect()` từng cặp, lọc
   quan hệ cha-con bằng `Node.contains()`.
3. **Tràn ngang** — `scrollWidth` so `clientWidth`.
4. **Chuột có ăn không** — bấm thật vào canvas rồi xem trạng thái có đổi.
5. **Ảnh chụp** — `--anh` lưu 96 tấm vào `<trang>/anh-kiem/` (đã chặn khỏi git,
   33 MB mỗi lần chạy).

---

## Bốn lỗi của chính bộ kiểm

Tầng 5 đã nằm trong `kiem_demo.py` từ đợt 1, nhưng vì playwright chưa bao giờ
được cài nên nó **tự bỏ qua mình** suốt bảy đợt. Lần đầu chạy thật: **32/32 lab
báo lỗi**, và không lỗi nào là lỗi của lab.

1. **`kiem_demo.py` không hề dựng máy chủ.** Tài liệu của nó bảo người dùng tự
   chạy `python -m http.server` ở cửa sổ khác. Quên là cả tầng báo
   `ERR_CONNECTION_REFUSED`, mà thông báo đó không hề gợi ý nguyên nhân.
   → tự dựng máy chủ trong luồng nền, tự dò cổng trống.
2. **`TCPServer` xử lý một yêu cầu một lúc.** Mỗi trang nạp ~36 tệp và Chromium
   mở 6 kết nối song song. → `ThreadingTCPServer`.
3. **`request_queue_size` mặc định là 5** — vẫn thiếu, phần thừa bị từ chối ngay
   ở tầng TCP trước khi Python kịp thấy. → 128.
4. **Console Windows là cp1252.** Một dòng lỗi có dấu tiếng Việt làm chết cả
   script bằng `UnicodeEncodeError` khi chuyển hướng ra tệp — và nuốt luôn nội
   dung lỗi thật. → ép `stdout`/`stderr` sang UTF-8.

Và một lỗi của tầng mới: phép "đè lên nhau" báo **54 lỗi** ngay lần đầu, cả 54
đều là **nút xúc xắc nằm trong nhãn "Hạt giống"** ở 18 lab × 3 chế độ. Cha con
lồng nhau thì dĩ nhiên giao nhau. → chuyển phép so vào trong trang để dùng
`Node.contains()`.

> Bài học: **một tầng kiểm tra tự bỏ qua mình thì không phải là tầng kiểm tra.**
> Nó chỉ là mã chết trông như có bảo đảm.

---

## Sáu lỗi hình ảnh thật, của lab

Đây là những thứ tôi cảnh báo suốt bảy đợt mà không chứng minh được. Tầng DOM
giả chỉ **đếm số lần gọi** lệnh vẽ — nó không có hình học nên không biết cái gì
nằm đè cái gì, và không đo được bề rộng chữ.

| # | Lỗi | Ở đâu | Cách sửa |
|---|---|---|---|
| 1 | **Xu / toà nhà vẽ đè lên biểu đồ** | `can-xu`, `tha-trung` | biểu đồ nhường lề phải cho vùng vẽ |
| 2 | **Nhãn cạnh của cây chồng thành khối chữ dính liền** — `trái nặngcân bằngphải nặng` | engine `V.cayQuyetDinh` | đo `measureText`, không đủ chỗ thì bỏ vẽ |
| 3 | **Chữ ghi "viền cam" nhưng màu thật là lục lam** | `tha-trung` | bỏ gọi màu bằng tên |
| 4 | **Cột nhãn bảng số liệu quá hẹp** → `Kiểm / bằng / công / thức` | `vis.css`, **cả 32 lab** | cột nhãn co giãn, cột số bám phải |
| 5 | **Chú thích cây đè nhãn trục ngang** — `…số đáp án còn lại` × `số quả trứng` | `can-xu`, `tha-trung` | chừa chỗ cho cả hai dòng |
| 6 | **Lab không dùng được ở 420px** — canvas tỉ lệ 0,74 chỉ cao 310px mà nhồi ba thứ | engine `V.veBangCo` | canvas **cao hơn khi khung hẹp**, tối thiểu 1,15× bề ngang dưới 620px; hai lab dày tự bỏ cây |

Lỗi #2, #3, #5 là **chữ vẽ trên canvas**. Cả phép kiểm hình học DOM lẫn DOM giả
đều không thấy được chúng — **chỉ ảnh chụp mới lộ ra**. Đó là lý do `--anh` đáng
giữ, dù nó không tự động khẳng định được gì.

Lỗi #4 và #6 nằm trong engine nên **cả 32 lab cùng được sửa**.

---

## Còn lại gì chưa kiểm được

Tầng này **không** thay thế được mắt người. Nó không biết:

- chữ vẽ trên **canvas** có đè nhau không — nó chỉ đo hộp DOM
- màu có **đủ tương phản** để đọc không
- hình vẽ ra có **đúng ý** không (một biểu đồ vẽ sai dữ liệu vẫn "có nhiều màu")
- phép **chuột** chỉ xác nhận *có gì đó đổi*, không xác nhận đổi **đúng**

Nên quy trình đúng là: chạy `--anh` rồi **lướt qua 96 tấm ảnh**. Máy bắt được
lỗi hình học và lỗi nổ; mắt bắt được phần còn lại. Bốn trong sáu lỗi ở trên là
tôi **nhìn ảnh** mới thấy, không phải máy báo.

## Ba ứng dụng cũng đã được kiểm

```bash
cd backend/fastapi/webapp/tranphuc8a
python kiem-hinh.py          # cả ba
python kiem-hinh.py --anh    # kèm chụp ảnh
```

Cùng bộ phép đo, thêm một phép riêng cho ứng dụng: **nút bấm có đủ to để chạm
tay không** (ngưỡng WCAG 2.5.5). Kết quả: **30/30 đạt, 3 nhắc nhở** — nút
*Xoá sạch dữ liệu* cao 27px, dưới ngưỡng. Giữ nguyên có chủ đích: đó là nút
phá huỷ, khó bấm nhầm là tốt.

Một lỗi nữa ảnh chụp lộ ra: **biểu đồ tháng rỗng** của `chi-tieu` vẽ 31 cột
cao 1px, trông như một vạch mờ vô nghĩa. Đã đổi thành một dòng chữ.

Phần giao diện của chúng vẫn còn những chỗ chỉ mắt người thấy được — xem mục
trên.
