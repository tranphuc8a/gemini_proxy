# Đặc tả yêu cầu — Ứng dụng web Quản lý chi tiêu

Ngày 2026-10-05 · Nguồn: `prompt.md` + `Chi tiêu_261004_195034.pdf` (28 trang) + khảo sát `backend/fastapi`.

## 1. Bối cảnh

### 1.1 Hiện trạng: nhật ký chi tiêu bằng văn bản

Từ 02/2026 đến 10/2026, người dùng ghi chi tiêu vào một ghi chú văn bản, xuất ra PDF (28 trang, ~10 MB vì nhúng ảnh chụp màn hình). Đọc kỹ toàn bộ file, nội dung gồm:

| Nhóm nội dung | Ví dụ trong PDF | Ghi chú |
|---|---|---|
| Chi tiêu hằng ngày theo tuần | `Tháng 3 tuần 3 · T2-T6: 57/2P 57/2T 53/2T … · T7: 87/2P 83/2P · CN: 59.5/2P 75/2P` | Chia nhóm **T2–T6 / T7 / CN**. `/2` = chia đôi, `/1` = tự trả, hậu tố `P`/`T` = ai trả (Phúc/Thiệp). |
| Chi lẻ có ngày | `15/4: Mua 2 dầu gội sữa tắm 80K` · `24/04: Mua điện thoại Techno Pova 7: 3.520K` | Nhiều đơn vị: `K`, `tr`, `M`, `19.485.250`. |
| **Chia tiền với bạn cùng phòng** | `Tổng Thiệp = 205.5 + 315.5 = 521K · Tổng Phúc = 272.5K · Chuyển Thiệp = (521 − 272.5)/2 = 124.25K` | Cuối mỗi kỳ tự tính tay ai chuyển cho ai. Lặp lại ≥ 12 lần. |
| Thu nhập | `Nhận lương SRV 202605 14.916.956` · `Nhận thưởng PI 18.909.727` · `Công ty thưởng 500K` · `voucher sinh nhật 100K` | Lương, thưởng, quyết toán thuế, quà tặng. |
| **Tiết kiệm có kỳ hạn** | `Tích lũy 12M, 8,35%/năm, 12 tháng, lãi dự kiến 1.252.500` · `Rút sổ tiết kiệm 20.970.000` · `Tái tích lũy` · `thuế TNCN 31.000` | Gửi hằng tháng, rút khi đáo hạn, có lãi suất, kỳ hạn, thuế lãi. |
| Hoá đơn nhà trọ | `Điện: 1248 − 934 = 314 × 4 = 1.256 · nước 200 · tạm trú 200 · trọ 4.000 · Tổng 5656/2 = 2.828` | Tính theo chỉ số công tơ, chia đôi. |
| Chi định kỳ | `Vé xe bus tháng 280K` (mỗi tháng) · `Mua data 4G 12 tháng 840K` · `Shopping momo 300K` (mỗi tháng) | Lặp theo tháng. |
| Đi lại | `Bus 205: 25K` (về quê/ra trọ) · `Be về trọ 24K` | Nhiều khoản lặp lại giống hệt. |
| Mua sắm online | `Shopee: vỏ gối 22.7K`, `TikTok Shop: bút gel 18K` | Nhiều khoản nhỏ cùng ngày. |
| Quan hệ/hiếu hỉ/du lịch | `Viếng tang 100K` · `Quà Scoffee 87K − voucher 50K = 37K` · `Du lịch Hạ Long 446K` | Có trừ voucher; có chuyến đi. |
| Ghi chú mua sắm | `NOTES: Shopping 16/6/2026 — Sữa ông thọ, giấy vệ sinh…` | Danh sách cần mua, không phải giao dịch. |
| Ảnh chụp | Biên lai ViettelPay, tin nhắn ngân hàng, hoá đơn giấy | Chứng từ đối chiếu. |

> **An toàn dữ liệu:** trang 3 của PDF có một mật khẩu wifi lẫn trong nhật ký. Tài liệu này và ứng dụng **không** sao chép nó; khuyến nghị đổi mật khẩu đó và không đưa vào dữ liệu app (app không có mục lưu mật khẩu).

### 1.2 Nhược điểm của cách ghi hiện tại (vấn đề cần giải quyết)

| # | Nhược điểm | Hậu quả thấy trong PDF |
|---|---|---|
| N1 | **Tính tay** các tổng và số tiền chuyển | `(1277.5 − 513)/2`, `(534.5 − 525.1)/2 + 30` — một nhầm lẫn là lệch tiền với người khác. |
| N2 | **Ký hiệu tự đặt, không nhất quán** | `57/2P`, `57/2`, `/2T`, `(Thiệp)`, `Phúc: 170.5`, `0 (mỳ xôi)`; đơn vị `K`/`k`/`tr`/`M`/`000K`. |
| N3 | **Nhiều loại dữ liệu trộn một dòng chảy** | Chi, thu, tiết kiệm, nợ, hoá đơn nằm lẫn; không lọc/tách được. |
| N4 | **Không có tổng hợp** | Không biết tháng này chi bao nhiêu cho ăn uống; không có so sánh tháng, không có ngân sách. |
| N5 | **Không tìm kiếm**, không thống kê | Muốn xem "đã mua gì trên Shopee" phải đọc từng trang. |
| N6 | **Dòng bỏ trống/thiếu** | `T2-T6: …` chưa điền; tuần có ngày `0K (Về quê)`. |
| N7 | **Nhập liệu chậm trên điện thoại** | Gõ cả dòng văn bản, tự cộng `57+57+57+57+63`. |
| N8 | **Dữ liệu nhạy cảm lẫn lộn, file nặng** | Mật khẩu wifi cùng sổ tiết kiệm; ảnh chụp làm PDF 10 MB. |
| N9 | **Không đồng bộ/sao lưu có kiểm soát** | Một file ghi chú duy nhất trên một máy. |

### 1.3 Nền tảng kỹ thuật sẵn có (khảo sát `backend/fastapi`)

- FastAPI theo kiến trúc lục giác: `adapter/input/controllers` → `application/usecases` → `application/ports` → `adapter/output/*`. Phản hồi bọc `{status_code, message, data}`.
- Có **mẫu lưu trữ 3 kho** đang chạy tốt: `postman-lite-pro` (workspace + access key băm SHA-256 + khoá phiên bản `revision` + kho `json | mysql | mongo` chọn bằng `?backend=`) và `GET /storage/backends` kiểm tra kho nào đang kết nối được thật.
- Web app tĩnh nằm ở `backend/fastapi/webapp/<bộ-sưu-tập>/<app>/` (có `index.html`, `metadata.json`); server tự chèn `window.__WEBAPP_CONFIG__ = {apiBase, webappBase}` khi phục vụ. Nhóm ứng dụng tự viết ở `webapp/tranphuc8a/` theo quy ước: **không thư viện ngoài, mở được bằng `file://`, có `kiem.js` kiểm logic bằng node, tiếng Việt, 60–250 KB**.
- Đã có một ứng dụng **`tranphuc8a/chi-tieu`** (sổ thu chi đơn giản, localStorage, 60 KB). Ứng dụng mới là **ứng dụng riêng** (`tranphuc8a/quan-ly-chi-tieu`), không thay thế, không sửa ứng dụng cũ.

## 2. Mục tiêu và phạm vi

**Mục tiêu:** thay nhật ký văn bản bằng một web app nhập nhanh hơn gõ ghi chú, tự tính mọi tổng và khoản chia tiền, dữ liệu bền và đồng bộ được giữa điện thoại ↔ máy tính, dùng tốt trên cả hai.

**Đối tượng:** một người dùng chính (nhân viên, ở trọ, chia tiền ăn với bạn cùng phòng, có lương hằng tháng và gửi tiết kiệm có kỳ hạn). Bạn cùng phòng **không** cần tài khoản — chỉ là một "người" trong sổ chia tiền.

**Ngoài phạm vi bản này:** tài khoản đăng nhập/đa người dùng đồng thời, liên kết ngân hàng tự động, quét OCR hoá đơn, đính kèm ảnh chứng từ, đa tiền tệ, mã hoá đầu cuối, PWA cache offline (mở được bằng `file://` và localStorage đã cho phép dùng offline), thông báo đẩy, nhập PDF.

**Giả định:** tiền là **VND, số nguyên đồng**; tuần bắt đầu **thứ Hai**; ngày theo giờ địa phương của trình duyệt; mỗi không gian dữ liệu thuộc một người (chia sẻ giữa các thiết bị của người đó bằng mã kết nối).

## 3. Yêu cầu chức năng

Ưu tiên: **M** = bắt buộc, **S** = nên có, **C** = có thì tốt. Bản này làm M và S; C chỉ làm nếu rẻ.

### 3.1 Ghi chép giao dịch

| ID | Ưu tiên | Yêu cầu |
|---|:--:|---|
| FR-01 | M | Thêm / sửa / xoá giao dịch ba loại: **chi**, **thu**, **chuyển** giữa tài khoản. Trường: số tiền, ngày, danh mục, tài khoản, ghi chú, thẻ (#tag). |
| FR-02 | M | **Nhập nhanh một dòng** tiếng Việt, ví dụ `cơm mai dịch 61.5k hôm qua`, `57/2 bún đậu`, `lương 14.916.956 10/6`. Hiện bản xem trước các trường đã nhận (số tiền, ngày, danh mục, chia tiền), Enter để lưu, sửa được từng trường trước khi lưu. |
| FR-03 | M | Ô số tiền hiểu cách viết của người Việt: `50k`, `61.5k`, `1,5tr`, `2 triệu`, `19.485.250`, `3.520K`; số trần < 1.000 hiểu là **nghìn** (cài đặt bật/tắt, mặc định bật — đúng thói quen `57` = 57K trong PDF). Luôn hiện số đọc lại (`= 57.000 ₫`) để khỏi gõ nhầm. |
| FR-04 | M | Hiểu ngày: `hôm nay`, `hôm qua`, `hôm kia`, `T2…CN` (lần gần nhất, không quá hôm nay), `dd/mm`, `dd/mm/yyyy`; mặc định hôm nay. |
| FR-05 | S | **Nhập hàng loạt**: dán nhiều dòng ghi chú (như `27/2: vé xe buýt tháng 3: 280K`) → bảng xem trước, dòng không hiểu được đánh dấu, bỏ/sửa từng dòng → nhập một lần. |
| FR-06 | S | **Gợi ý**: mẫu nhanh từ lịch sử (cặp ghi chú + số tiền dùng nhiều, ví dụ `Bus 205 · 25K`); tự điền danh mục theo ghi chú đã gặp; nhân bản một giao dịch. |
| FR-07 | M | Danh sách giao dịch **nhóm theo ngày** (kèm thứ và tổng ngày); tìm chữ **không dấu**; lọc theo kỳ, danh mục, tài khoản, người, loại, khoảng tiền; **hoàn tác** sau khi xoá. |
| FR-08 | S | **Giao dịch định kỳ** (vé bus tháng, tiền trọ, data 4G, lương, tiền shopping hằng tháng): khai báo quy tắc theo tháng/tuần; đến hạn thì hỏi xác nhận một chạm (sửa được số tiền), không tự ghi âm thầm. |

### 3.2 Chi chung và chia tiền

| ID | Ưu tiên | Yêu cầu |
|---|:--:|---|
| FR-10 | M | Quản lý danh sách **người** (bạn cùng phòng, người thân). Giao dịch chi có thể đánh dấu **chi chung**: ai trả, ai tham gia, chia **đều** (mặc định) hoặc theo **số tiền cụ thể**. Không bao giờ lệch đồng: tổng phần = số tiền. |
| FR-11 | M | Phân biệt hai con số: **dòng tiền** (tài khoản của tôi giảm đúng số tiền tôi đã trả) và **chi tiêu của tôi** (chỉ phần của tôi). Báo cáo chi tiêu dùng phần của tôi; số dư tài khoản dùng tiền đã trả. Người khác trả hộ thì không động tới tài khoản của tôi. |
| FR-12 | M | **Sổ chia tiền**: với mỗi người, hiển thị ai nợ ai bao nhiêu; ghi **khoản đã thanh toán** làm nợ giảm; gợi ý số cần chuyển; sinh **tin nhắn quyết toán** sao chép được (liệt kê khoản trong kỳ + số cần chuyển). Kết quả trùng cách tính tay trong PDF (xem 6). |
| FR-13 | C | **Máy tính chia hoá đơn**: chỉ số điện cũ/mới × đơn giá + các khoản cố định, chia cho N người (tái hiện `5656/2 = 2828`). |

### 3.3 Tài khoản và tiết kiệm

| ID | Ưu tiên | Yêu cầu |
|---|:--:|---|
| FR-20 | M | **Tài khoản/ví** (tiền mặt, ngân hàng, ví điện tử, sổ tiết kiệm) có số dư đầu kỳ; số dư hiện tại **tính từ giao dịch** (không nhập tay); tổng tài sản. |
| FR-21 | S | **Sổ tiết kiệm**: gốc, lãi suất %/năm, kỳ hạn tháng, ngày gửi, thuế lãi % (tuỳ chọn) → ngày đáo hạn, **lãi dự kiến** (đơn, theo số ngày/365), lãi sau thuế; cảnh báo sổ đáo hạn trong 30 ngày; **tất toán** sinh giao dịch chuyển gốc về tài khoản + thu nhập lãi; cho phép **tái tục** (mở sổ mới). |

### 3.4 Ngân sách

| ID | Ưu tiên | Yêu cầu |
|---|:--:|---|
| FR-30 | S | **Hạn mức tháng** cho từng danh mục chi và tổng chi; thanh tiến độ, đổi màu ≥ 80 %, báo vượt 100 %, hiển thị "còn X ₫ ≈ Y ₫/ngày". |

### 3.5 Báo cáo

| ID | Ưu tiên | Yêu cầu |
|---|:--:|---|
| FR-40 | M | Chọn kỳ **Tuần / Tháng / Năm / Tuỳ chọn** (◀ ▶): tổng thu, tổng chi (phần của tôi), chênh lệch, **so với kỳ trước**; khớp cách nhóm "Tháng X tuần Y" trong PDF. |
| FR-41 | M | Chi theo **danh mục** (biểu đồ + bảng %), theo **ngày** (cột), theo **thứ trong tuần** và so sánh **T2–T6 / T7 / CN**. |
| FR-42 | S | Xu hướng thu/chi 12 tháng; trung bình/ngày; top khoản chi lớn. |
| FR-43 | S | Sao chép tóm tắt dạng chữ; in/PDF qua `Ctrl+P` (CSS in riêng). |

### 3.6 Lưu trữ và đồng bộ (yêu cầu cốt lõi)

| ID | Ưu tiên | Yêu cầu |
|---|:--:|---|
| FR-50 | M | **Chế độ "Máy này"** (localStorage): chạy hoàn toàn trong trình duyệt, không cần mạng/máy chủ, mở được bằng `file://`. Lỗi đầy dung lượng được báo, không mất dữ liệu đang có. |
| FR-51 | M | **Chế độ "Máy chủ · MySQL"** và **"Máy chủ · MongoDB"** qua FastAPI: tạo không gian (id + **khoá truy cập hiện đúng một lần**), kết nối lại bằng mã, lưu kèm số phiên bản; hai thiết bị sửa cùng lúc **không mất** bản ghi nào (gộp theo bản ghi, thắng bản sửa muộn hơn). |
| FR-52 | M | **Chuyển chế độ không mất dữ liệu**: đẩy dữ liệu "Máy này" lên máy chủ; kéo từ máy chủ về máy; sao chép từ MySQL sang MongoDB và ngược lại. Mỗi kho là một kho độc lập, nói rõ trên giao diện. |
| FR-53 | M | Hiện **trạng thái đồng bộ** (đã lưu · đang lưu · chưa đồng bộ/offline · cần xử lý), tự thử lại khi có mạng; ghi cục bộ trước nên mất mạng không mất nhập liệu. |
| FR-54 | M | **Sao lưu/khôi phục** JSON đầy đủ; **xuất CSV** giao dịch; **nhập CSV**. Khôi phục luôn hỏi xác nhận và có thể "gộp" hoặc "thay thế". |
| FR-55 | S | Nhắc sao lưu khi dùng "Máy này" và 30 ngày chưa sao lưu. Hiện dung lượng dữ liệu; cảnh báo khi gần giới hạn đồng bộ. |
| FR-56 | M | Máy chủ báo **kho nào dùng được thật** (`/spending/backends` kiểm tra kết nối), kèm lý do khi không; giao diện vô hiệu hoá kho hỏng và nói vì sao. |

### 3.7 Danh mục, cài đặt, giao diện

| ID | Ưu tiên | Yêu cầu |
|---|:--:|---|
| FR-70 | M | Danh mục mặc định phù hợp thực tế PDF (Ăn uống, Đi lại, Nhà trọ & hoá đơn, Mua sắm, Quà tặng & hiếu hỉ, Sức khoẻ, Học tập, Du lịch & giải trí, Gia đình, Khác · thu: Lương, Thưởng, Lãi tiết kiệm, Thu khác); thêm/sửa/ẩn danh mục với biểu tượng + màu. |
| FR-60 | M | **Responsive**: dùng tốt từ 360 px (điện thoại) đến ≥ 1440 px; điện thoại có thanh điều hướng dưới + nút `+` trong tầm ngón cái, máy tính có thanh bên và ô nhập nhanh trên đầu. |
| FR-61 | M | Sáng / tối / theo hệ thống; hoàn toàn tiếng Việt; số và ngày theo kiểu Việt (`1.234.567 ₫`, `T2 05/10`). |
| FR-62 | M | Phím tắt trên máy tính (`N` thêm, `/` tìm, `?` trợ giúp); mọi thao tác dùng được bằng bàn phím; focus nhìn thấy rõ. |
| FR-63 | M | Trạng thái trống có hướng dẫn; **dữ liệu mẫu** tuỳ chọn (xoá được); hướng dẫn lần đầu ngắn. |
| FR-64 | S | Vùng chạm ≥ 44 × 44 px; tôn trọng `prefers-reduced-motion`; tương phản WCAG AA. |

## 4. Yêu cầu phi chức năng

| ID | Yêu cầu |
|---|---|
| NFR-01 **Đúng tiền** | Mọi số tiền là **số nguyên đồng**; chia đều không lệch đồng (phần dư phân phối xác định); không dùng số thực để cộng tiền. |
| NFR-02 **Riêng tư** | Mặc định dữ liệu chỉ ở trình duyệt. Dùng máy chủ là lựa chọn chủ động. Server chỉ lưu **băm SHA-256** của khoá; khoá không đi qua URL; không ghi log nội dung. |
| NFR-03 **An toàn** | Mọi chuỗi người dùng được thoát HTML trước khi hiển thị (chống XSS); máy chủ giới hạn kích thước tài liệu và kiểm tra kiểu; so sánh khoá hằng thời gian. |
| NFR-04 **Đồng thời** | Lưu có điều kiện theo `revision` **nguyên tử** ở cả ba kho (không có khe hở đọc-rồi-ghi làm mất cập nhật). |
| NFR-05 **Hiệu năng** | Mở app < 1 s với 10.000 giao dịch trên điện thoại tầm trung; chỉ vẽ kỳ đang xem; lưu cục bộ không chặn nhập liệu (debounce); đồng bộ đẩy gộp. |
| NFR-06 **Kích thước** | Không thư viện ngoài, không bước build; tổng tài nguyên ≤ 300 KB chưa nén. |
| NFR-07 **Tương thích** | Chrome/Edge/Firefox/Safari 2 bản gần nhất, iOS Safari. `file://` hoạt động ở chế độ "Máy này". |
| NFR-08 **Khả kiểm** | Toàn bộ logic tiền/ngày/chia tiền/gộp dữ liệu là hàm thuần chạy bằng node; backend có pytest cho cả ba kho. |
| NFR-09 **Bền dữ liệu** | Ghi localStorage có bắt lỗi; ghi JSON phía server qua tệp tạm + `os.replace`; mỗi lần khôi phục/thay thế tự lưu bản sao an toàn gần nhất để hoàn tác. |
| NFR-10 **Vận hành** | Tuân thủ giới hạn của Vercel: thân yêu cầu ≤ 4,5 MB (tài liệu tối đa 4 MB), kho JSON trên nền tảng chỉ đọc là tạm thời (đã có cảnh báo ở `/storage/backends`). |

## 5. Dữ liệu cần lưu (mức khái niệm)

Tài khoản · Danh mục · Người · Giao dịch (chi/thu/chuyển/thanh toán nợ) · Ngân sách · Giao dịch định kỳ · Cài đặt · Bia mộ xoá (tombstones) phục vụ gộp. Chi tiết và ràng buộc ở `design.md` §3.

## 6. Tiêu chí nghiệm thu (đối chiếu số liệu thật trong PDF)

Ứng dụng phải ra **đúng các số người dùng đã tính tay**:

| Nguồn | Đầu vào | Kết quả phải ra |
|---|---|---|
| Trang 10 | Mình trả 60+57+68+55,5+57+60+82 = 439,5K; bạn trả 59+63+60 = 182K; tất cả chia đôi | Bạn chuyển cho mình **128.750 ₫** |
| Trang 17 | Mình 521K, bạn 272,5K | **124.250 ₫** |
| Trang 19 | Mình 430,5K, bạn 0 | **215.250 ₫** |
| Trang 27 | Mình 763K, bạn 584,5K | **89.250 ₫** |
| Trang 20 | Điện (1248−934)×4 = 1.256K + nước 200K + tạm trú 200K + trọ 4.000K, chia 2 | **2.828.000 ₫**/người |
| Trang 21 | Sổ 15.000.000 ₫, 8,35 %/năm, 12 tháng | Lãi **1.252.500 ₫** |
| Trang 24 | Sổ 12.000.000 ₫, 8,61 %/năm, 12 tháng | Lãi **1.033.200 ₫** |
| Trang 16 | Sổ 20.000.000 ₫, 4,85 %/năm, 365 ngày | Lãi **970.000 ₫** |
| Trang 22 | Lãi 620.000 ₫, thuế 5 % | Nhận **589.000 ₫** |
| Trang 8 | `87K − voucher 50K = 37K` | Nhập `87k - 50k` hiểu là **37.000 ₫** |

Ngoài ra:

- A1. Nhập `57/2 bún đậu hôm qua` → một giao dịch chi 57.000 ₫, chia đôi, hôm qua, danh mục Ăn uống, trong ≤ 2 thao tác (gõ + Enter).
- A2. Tạo không gian MySQL, nhập 3 giao dịch, mở app ở trình duyệt/thiết bị khác bằng mã kết nối → thấy đủ 3.
- A3. Hai thiết bị cùng sửa khi offline rồi đồng bộ → không mất bản ghi nào; cùng bản ghi sửa hai nơi → bản sửa muộn hơn thắng; không bản ghi nào bị nhân đôi.
- A4. Ghi chú `<img src=x onerror=alert(1)>` hiển thị nguyên văn, không chạy mã.
- A5. Mở ở 360×740, 768×1024, 1440×900: không tràn ngang, nút chính ≥ 44 px, không lỗi console.
- A6. Backend: cả ba kho qua cùng một bộ test; sai khoá → 401, sai phiên bản → 409 kèm bản hiện tại; tài liệu quá lớn → 400.
