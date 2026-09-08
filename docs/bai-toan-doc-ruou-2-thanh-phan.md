# Bài toán: Tìm chất độc phức hợp trong 1000 chai rượu

> Nguồn: [Puzzling Stack Exchange #12770](https://puzzling.stackexchange.com/questions/12770/find-the-composite-poison-in-the-wine-bottles) (CC BY-SA 4.0)

---

## Đề bài

Bạn có **1000 chai rượu**. Trong đó:

- Một chai chứa thành phần **Ca**
- Một chai khác chứa thành phần **Cb**

Riêng lẻ thì cả hai đều **vô hại**. Chỉ khi một người uống **cả hai** thì mới chết — và chết vào **đúng nửa đêm của cái ngày họ uống thành phần thứ hai** (dù uống lúc nào trong ngày cũng vậy). Thành phần đã uống thì **nằm mãi trong người** chờ thành phần kia.

Bạn có **tù nhân** để thử nghiệm. Mỗi ngày, mỗi tù nhân có thể nếm một ngụm từ bao nhiêu chai bạn muốn.

**Câu hỏi:** cần **ít nhất bao nhiêu tù nhân** để chắc chắn tìm ra đúng 2 chai bị tẩm độc?

---

## Bước 0 — Nắm luật chơi

Đây là điều **quan trọng nhất**, phải hiểu trước khi làm gì khác:

> **Một tù nhân chỉ chết nếu anh ta nếm được CẢ HAI chai độc.**
>
> Nếm 1 trong 2 chai độc → **không có triệu chứng gì**, không phân biệt được với người không nếm chai nào.

Điều này khác hoàn toàn bài toán cổ điển "1 chai độc / 1000 chai / 10 tù nhân". Ở bài cổ điển, mỗi tù nhân là một **cảm biến** cho câu hỏi *"chai độc có nằm trong nhóm của tôi không?"* — trả lời **CÓ** thì chết.

Ở bài này, mỗi tù nhân trả lời câu hỏi *"CẢ HAI chai độc có nằm trong nhóm của tôi không?"* Đây là phép **VÀ** (AND), và nó **yếu hơn nhiều**:

- Nếu anh ta chết → tuyệt vời, ta biết cả 2 chai đều trong nhóm anh ta.
- Nếu anh ta sống → chỉ biết "không phải cả hai đều trong nhóm". Có thể 1 chai ở trong, có thể 0 chai. **Gần như không có thông tin.**

Ghi nhớ điều này. Nó lý giải toàn bộ độ khó của bài toán.

---

# PHẦN 1 — Nếu chỉ có **1 ngày** (một lần thử duy nhất)

Tất cả tù nhân uống cùng ngày, rồi nửa đêm ta xem ai chết. Chỉ một lần quan sát.

## 1.1. Đếm xem cần bao nhiêu — cận dưới

**Đáp án có bao nhiêu khả năng?** Chọn 2 chai từ 1000:

C(1000, 2) = (1000 × 999) / 2 = **499,500**

**Một tù nhân cho bao nhiêu thông tin?** Chỉ 2 trạng thái: **sống** hoặc **chết**. Tức 1 bit.

Với *n* tù nhân → tối đa **2^n** kịch bản "ai sống ai chết" khác nhau. Muốn phân biệt được 499,500 đáp án thì bắt buộc:

2^n ≥ 499,500

- 2^18 = 262,144 → **thiếu**
- 2^19 = 524,288 → **đủ (về mặt đếm)**

> ### ✅ Cận dưới: **19 tù nhân**. Ít hơn 19 là chắc chắn không thể.

Nhưng cẩn thận: 19 chỉ là *"không thể ít hơn"*. Nó **không** có nghĩa là 19 làm được. Vì tù nhân trả lời câu hỏi kiểu **VÀ** rất yếu, thực tế cần **nhiều hơn thế rất nhiều**.

## 1.2. Ví dụ nhỏ để làm quen: 4 chai

Trước khi làm 1000 chai, hãy thử **4 chai** (đánh số 1, 2, 3, 4). Số đáp án = C(4,2) = 6. Đếm: 2^n ≥ 6 → cần ≥ 3 tù nhân.

Thử 3 tù nhân **A, B, C**, cho họ uống như sau:

| Chai | Ai nếm nó |
|:---:|:---|
| 1 | A, B |
| 2 | B, C |
| 3 | A, C |
| 4 | A, B, C |

Ai chết = những người nếm **cả hai** chai độc = **giao** của hai danh sách:

| Cặp chai độc | Người chết |
|:---:|:---|
| {1,2} | B |
| {1,3} | A |
| {1,4} | A, B |
| {2,3} | C |
| {2,4} | B, C |
| {3,4} | A, C |

**6 kết quả khác nhau hoàn toàn** → nhìn ai chết là biết ngay cặp chai. 🎉 Với 4 chai, 3 tù nhân là đủ và cũng là tối thiểu.

## 1.3. Lời giải cho 1000 chai: **lưới 32 × 32**

Đây là cách dựng đẹp và dễ kiểm tra nhất. Ý tưởng: **đừng bắt tù nhân uống một nhóm nhỏ — bắt họ uống gần hết, chỉ tránh một ít.**

### Xếp chai thành lưới

Xếp 1000 chai (dùng lưới 32×32 = 1024 ô, thừa thì để trống) thành bảng vuông. Mỗi chai có một địa chỉ **(hàng, cột)** với hàng, cột ∈ {0, 1, …, 31}.

Ngoài ra, mỗi chai còn có một **số đường chéo**:

d = (hàng + cột) mod 32

### Cần 96 tù nhân, chia 3 nhóm

| Nhóm | Số người | Người thứ *a* của nhóm sẽ… |
|:---|:---:|:---|
| **Hàng** R0…R31 | 32 | nếm **mọi chai KHÔNG ở hàng a** |
| **Cột** C0…C31 | 32 | nếm **mọi chai KHÔNG ở cột a** |
| **Chéo** D0…D31 | 32 | nếm **mọi chai có số chéo ≠ a** |

Tổng: **96 tù nhân**. Mỗi người nếm khoảng 992 chai — uống gần hết!

### Vì sao nó hoạt động — mẹo lật ngược

Xét tù nhân **Ra** (người tránh hàng *a*). Anh ta **chết** ⟺ nếm cả hai chai độc ⟺ **không chai độc nào ở hàng a**.

Lật ngược lại:

> **Ra SỐNG ⟺ hàng a CÓ chứa (ít nhất) một chai độc.**

Quá đẹp! Người **sống sót** trở thành cảm biến "CÓ", thay vì người chết. Vậy sau nửa đêm:

- Trong nhóm Hàng: chỉ có **1 hoặc 2 người sống** → ta biết ngay **hai hàng** {r1, r2} chứa độc
- Trong nhóm Cột: tương tự → biết **hai cột** {c1, c2}
- Trong nhóm Chéo: tương tự → biết **hai số chéo** {d1, d2}

### Ghép lại thành đáp án

**Trường hợp dễ:** nếu nhóm Hàng chỉ có 1 người sống (r1 = r2), hai chai độc cùng một hàng → chúng là (r1, c1) và (r1, c2). **Xong.** (Tương tự nếu nhóm Cột chỉ 1 người sống.)

**Trường hợp chung:** hai hàng khác nhau và hai cột khác nhau → 4 ô giao nhau tạo thành một **hình chữ nhật**. Hai chai độc là **một trong hai đường chéo** của hình chữ nhật đó:

```
         c1        c2
    ┌─────────┬─────────┐
 r1 │    A    │    B    │     Khả năng 1: {A, D}
    ├─────────┼─────────┤     Khả năng 2: {B, C}
 r2 │    C    │    D    │
    └─────────┴─────────┘
```

Nhóm Chéo phân biệt hai khả năng này:

- Khả năng 1 cho hai số chéo: {r1+c1, r2+c2}
- Khả năng 2 cho hai số chéo: {r1+c2, r2+c1}

Hai tập này **luôn khác nhau** khi r1 ≠ r2 và c1 ≠ c2 (vì nếu r1+c1 = r1+c2 thì c1 = c2, vô lý; nếu r1+c1 = r2+c1 thì r1 = r2, vô lý).

→ So sánh với {d1, d2} thực tế là biết ngay đường chéo nào. **Xong.** ✅

### Ví dụ chạy thử

Giả sử độc ở ô **(3, 7)** và **(20, 15)**.

- Số chéo: 3+7 = **10** và 20+15 = 35 mod 32 = **3**
- Nửa đêm: sống sót = **R3, R20** | **C7, C15** | **D10, D3**
- Hai hàng {3, 20}, hai cột {7, 15} → 4 ô: (3,7), (3,15), (20,7), (20,15)
- Chéo của khả năng {(3,7), (20,15)} = {10, 3} ✔️ **khớp**
- Chéo của khả năng {(3,15), (20,7)} = {18, 27} ✘ không khớp
- → Kết luận: **(3,7) và (20,15)** ✅

## 1.4. Tóm kết Phần 1

| | Giá trị |
|:---|:---|
| Cận dưới (đếm) | **19** tù nhân |
| Sơ đồ dựng được, dễ kiểm chứng | **96** tù nhân |

Khoảng cách 19 ↔ 96 là **thật**, không phải do ta dở. Với 1 lần thử duy nhất, câu trả lời "sống" gần như vô giá trị (xem Bước 0), nên buộc phải dùng rất nhiều tù nhân dư thừa. Tối ưu thật sự nằm đâu đó khoảng **40–60** và là một bài toán tổ hợp khó (họ tập hợp có hợp đôi một phân biệt — *union-free families*), không giải được bằng tay.

**Bài học:** một lần thử thì rất đắt. Giờ xem ngày thứ hai giúp gì.

---

# PHẦN 2 — Với **2 ngày**

## 2.1. Mỗi tù nhân giờ có **3** kết cục, không phải 2

Với mỗi tù nhân và mỗi chai, chỉ có 3 lựa chọn có ý nghĩa. Ta gán **nhãn**:

| Nhãn | Nghĩa |
|:---:|:---|
| **2** | Nếm chai đó **ngày 1** |
| **1** | Nếm chai đó **chỉ ngày 2** |
| **0** | **Không bao giờ** nếm |

Bây giờ xét một tù nhân, giả sử nhãn của anh ta với hai chai độc là *p* và *q*:

| p, q | Chuyện gì xảy ra | Ta thấy gì |
|:---:|:---|:---|
| 2 và 2 | Uống cả hai trong ngày 1 | **Chết nửa đêm ngày 1** |
| 2 và 1 (hoặc 1 và 1) | Đủ cả hai chậm nhất cuối ngày 2 | **Chết nửa đêm ngày 2** |
| có số 0 | Thiếu một thành phần | **Sống** |

Nhìn kỹ bảng trên, có một công thức cực gọn:

> **Kết cục = min(p, q)**

với **2 = chết ngày 1, 1 = chết ngày 2, 0 = sống**. Kiểm tra: min(2,2)=2 ✓, min(2,1)=min(1,1)=1 ✓, min(0, bất kỳ)=0 ✓.

> ### 💡 Ý tưởng cốt lõi
> Gán cho mỗi chai một **dãy nhãn** cơ số 3 (mỗi tù nhân một chữ số). Kết quả ta đọc được chính là **min từng chữ số** của hai dãy thuộc hai chai độc. Việc cần làm: thiết kế các dãy sao cho từ min ta suy ngược ra được cặp chai.

## 2.2. Cận dưới: **12 tù nhân**

Mỗi tù nhân giờ có 3 kết cục → *n* tù nhân cho tối đa **3^n** kịch bản:

3^n ≥ 499,500

- 3^11 = 177,147 → **thiếu**
- 3^12 = 531,441 → **đủ (về mặt đếm)**

> ### ✅ Cận dưới: **12 tù nhân**

So với 19 của bài 1 ngày — đã giảm mạnh, đúng như kỳ vọng (mỗi người cho log₂3 ≈ 1,585 bit thay vì 1 bit).

## 2.3. Ví dụ nhỏ: 4 chai, chỉ **2** tù nhân

Nhắc lại: 4 chai với 1 ngày cần **3** tù nhân. Với 2 ngày thì 3² = 9 ≥ 6, thử **2** tù nhân **A, B**. Gán nhãn:

| Chai | Nhãn (A, B) | Diễn giải |
|:---:|:---:|:---|
| 1 | (2, 2) | cả A và B nếm nó **ngày 1** |
| 2 | (2, 0) | A nếm **ngày 1**; B không bao giờ nếm |
| 3 | (0, 2) | A không nếm; B nếm **ngày 1** |
| 4 | (1, 1) | cả hai nếm nó **ngày 2** |

Lấy min từng vị trí:

| Cặp độc | min | Quan sát thực tế |
|:---:|:---:|:---|
| {1,2} | (2,0) | A chết **ngày 1**, B sống |
| {1,3} | (0,2) | A sống, B chết **ngày 1** |
| {1,4} | (1,1) | **cả hai** chết **ngày 2** |
| {2,3} | (0,0) | **cả hai sống** |
| {2,4} | (1,0) | A chết **ngày 2**, B sống |
| {3,4} | (0,1) | A sống, B chết **ngày 2** |

**6 kết quả khác nhau hoàn toàn** → chỉ **2 tù nhân** là đủ! Ngày thứ hai đã tiết kiệm được 1/3 số người. Học sinh nên tự tay kiểm tra bảng này — nó gói trọn toàn bộ ý tưởng.

## 2.4. Sức mạnh THẬT của ngày thứ hai: được **nhìn rồi mới nhắm**

Việc mỗi người cho 1,585 bit thay vì 1 bit chỉ là phần nhỏ. Phần lớn hơn nhiều là:

> **Nửa đêm ngày 1, ta ĐƯỢC XEM ai chết. Rồi mới quyết định ngày 2 ai uống chai nào.**

Ở Phần 1 ta phải chọn hết mọi thứ từ đầu, mù tịt → phải phòng mọi trường hợp → tốn 96 người. Giờ ta chia làm **2 vòng**: vòng 1 thu hẹp phạm vi, vòng 2 nhắm chính xác vào phần còn lại. Đây chính là lý do con số sụp từ ~96 xuống ~24.

## 2.5. Kế hoạch cụ thể: **24 tù nhân**

### 🌙 Ngày 1 — 12 tù nhân P1 … P12

Chuẩn bị trước 12 danh sách A1 … A12, **mỗi danh sách gồm 707 chai** lấy rải đều ngẫu nhiên (cố định, viết ra giấy trước). Tù nhân Pp nếm mọi chai trong Ap.

**Vì sao đúng 707 chai?** Ta muốn mỗi tù nhân cho trọn 1 bit, tức khả năng chết ≈ 50%. Anh ta chết ⟺ **cả hai** chai độc ở trong danh sách. Nếu danh sách chiếm tỉ lệ *t* của 1000 chai thì:

P(chết) ≈ t² = 0,5  ⟹  t = √0,5 ≈ 0,707

→ 707 chai. (Đây là chỗ hay bị làm sai: nếu cho mỗi người 500 chai thì chỉ 25% chết, thông tin thu về ít hơn nhiều.)

### 📋 Nửa đêm ngày 1 — lọc danh sách nghi vấn

Ghi lại **T** = tập những người đã chết. Rồi rà toàn bộ 499,500 cặp, giữ lại các cặp {i, j} thoả **đúng** kịch bản đó:

> {i, j} cùng nằm trong Ap **khi và chỉ khi** p ∈ T

Còn lại trung bình:

499,500 / 2^12 = 499,500 / 4096 ≈ **122 cặp**

Từ **nửa triệu** xuống còn **~122**. Chỉ với 12 người!

### 🌙 Ngày 2 — 12 tù nhân mới Q1 … Q12

Giờ ta **đã biết** 122 cặp nghi vấn nên có thể thiết kế riêng cho chúng. Gán cho mỗi chai còn nghi vấn một **chữ ký 12 bit** Db ⊆ {1,…,12}, chọn (bằng thuật toán tham lam đơn giản) sao cho mọi giao Di ∩ Dj của 122 cặp đó **đôi một khác nhau**.

Việc này rất thoải mái: ta chỉ cần 122 giá trị khác nhau trong không gian 2^12 = 4096 → dùng có **3%** chỗ.

Tù nhân Qq nếm mọi chai *b* mà q ∈ Db.

### 🎯 Nửa đêm ngày 2 — đọc đáp án

Tập người chết chính là **Di ∩ Dj**. Tra bảng → ra đúng cặp chai. ✅

## 2.6. Ép xuống gần cận dưới (phần nâng cao)

Kế hoạch 24 người vẫn "lãng phí": ta dùng 12 người chỉ cho ngày 1, 12 người chỉ cho ngày 2 → mỗi người chỉ cho **1 bit**, đâu có dùng tới 3 kết cục.

Muốn tiến về 12–13, phải cho **cùng một tù nhân** dùng cả 3 mức. Cách chỉnh:

- **Ngày 1:** Pp nếm **577 chai** → P(chết ngày 1) = 0,577² = **1/3**
- **Ngày 2** (nếu còn sống): nếm thêm cho tổng cộng thành **816 chai** → P(chết ≤ ngày 2) = 0,816² = **2/3**

Ba kết cục đều xác suất **1/3** → mỗi người cho trọn log₂3 = 1,585 bit. Cần 18,93 bit ⟹ *n* ≥ 11,9.

Rào cản còn lại: **ngày 2 cũng phải chọn hết cùng lúc** (mọi người uống cùng ngày, không nhìn nhau mà điều chỉnh được). Nên phải dùng máy tính dò ra thiết kế cho ngày 2. Vì vậy:

- **12** là cận dưới tuyệt đối, gần như chắc chắn **không** đạt được (phải nhồi 499,500 vào 531,441 chỗ = hiệu suất 94%)
- **13–14** là con số thực tế đạt được với thiết kế tối ưu

### Một biến thể rất đẹp (nhưng tốn người): "ai cũng uống hết"

Cho **mọi** tù nhân nếm **mọi** chai — chỉ khác nhau ở chỗ nếm **ngày nào**. Gọi Lb = tập tù nhân nếm chai *b* vào ngày 2 (số còn lại nếm nó ngày 1). Khi đó:

> Người chết **ngày 2** = **Li ∪ Lj** (hợp!), người chết **ngày 1** = phần còn lại.

Toàn bộ tù nhân đều chết, nhưng ta đọc ra chính xác hợp của hai tập → chỉ cần thiết kế 1000 tập có hợp đôi một khác nhau. Rất gọn về lý thuyết, nhưng cần khoảng **64 tù nhân**. Đây là ví dụ hay cho thấy "đẹp" ≠ "tối ưu".

---

# PHẦN 3 — Câu hỏi thưởng: có đúng 20 tù nhân thì tối đa mấy chai?

Dùng lại phép đếm, giải theo chiều ngược.

## Với 2 ngày (3 kết cục / người)

C(N, 2) ≤ 3^20 = 3,486,784,401
→ N(N−1) ≤ 6,973,568,802

Thử:

| N | N(N−1) | Kết luận |
|:---:|---:|:---|
| 83,508 | 6,973,502,556 | ✅ vừa đủ |
| 83,509 | 6,973,669,572 | ❌ vượt |

> ### 🏆 **Tối đa 83,508 chai**

## Với 1 ngày (2 kết cục / người) — để so sánh

C(N, 2) ≤ 2^20 = 1,048,576 → N(N−1) ≤ 2,097,152

| N | N(N−1) | Kết luận |
|:---:|---:|:---|
| 1,448 | 2,095,256 | ✅ |
| 1,449 | 2,098,152 | ❌ |

> **Tối đa 1,448 chai.**

Thêm **một ngày** làm con số nhảy từ ~1,4 nghìn lên ~83,5 nghìn — gấp **58 lần**!

## Lưu ý về tính thực tế

83,508 là **cận trên tuyệt đối** (chỉ từ phép đếm). Muốn chạm tới nó phải khai thác triệt để cả 3 mức nhãn *và* thiết kế ngày 2 bằng máy tính. Một phương án dễ dựng theo kiểu mục 2.5 (10 người ngày 1 + 10 người ngày 2) xử lý an toàn cỡ **1.000 – 3.000 chai** với 20 tù nhân.

---

# Bảng tổng kết

| Bài toán | Kết cục / tù nhân | Cận dưới (đếm) | Sơ đồ dựng được |
|:---|:---:|:---:|:---:|
| 1000 chai, **1 ngày** | 2 | **19** | 96 (lưới hàng/cột/chéo) |
| 1000 chai, **2 ngày** | 3 | **12** | 24 (12 + 12); tối ưu ~13–14 |
| 4 chai, 1 ngày | 2 | 3 | **3** ✅ đạt tối ưu |
| 4 chai, 2 ngày | 3 | 2 | **2** ✅ đạt tối ưu |

| Có 20 tù nhân | Số chai tối đa (lý thuyết) |
|:---|:---:|
| 1 ngày | 1,448 |
| 2 ngày | **83,508** |

---

# Ba ý cần nhớ

1. **Xác định "mỗi tù nhân cho bao nhiêu thông tin"** rồi đếm: (số kết cục)^(số tù nhân) ≥ (số đáp án). Đây là bước đầu tiên của mọi bài toán loại này.

2. **Chất độc 2 thành phần biến câu hỏi thành phép VÀ**, và phép VÀ rất yếu — câu trả lời "sống" gần như không cho thông tin. Mẹo chữa: **cho tù nhân uống thật nhiều chai** (707 thay vì 500), để tỉ lệ chết về gần 50%. Hoặc **lật ngược**: cho họ uống gần hết và tránh một ít, khi đó *người sống* mới là tín hiệu (chính là mẹo lưới 32×32).

3. **Chia thành nhiều vòng (adaptive) mạnh hơn nhiều so với thêm thông tin mỗi vòng.** Việc "nhìn kết quả ngày 1 rồi mới nhắm ngày 2" là điều làm con số sụp từ 96 xuống 24 — quan trọng hơn hẳn việc mỗi người có 3 kết cục thay vì 2.

---

# Bài tập tự luyện

1. **8 chai, 1 ngày.** Cận dưới đếm là bao nhiêu? Hãy tự dựng một sơ đồ và kiểm tra 28 cặp đều cho kết quả khác nhau.
2. **Vì sao 707?** Nếu mỗi tù nhân ngày 1 chỉ nếm 500 chai, xác suất anh ta chết là bao nhiêu? Sau 12 người thì còn lại trung bình bao nhiêu cặp nghi vấn? So sánh với 122.
3. **Lưới 32×32 bỏ nhóm chéo** (còn 64 tù nhân) — chỉ ra một trường hợp cụ thể mà ta không phân biệt được 2 khả năng.
4. **3 ngày thì sao?** Mỗi tù nhân có mấy kết cục? Cận dưới cho 1000 chai là bao nhiêu?
5. **3 thành phần** (P = Ca + Cb + Cc, chết khi uống cả ba, 2 ngày). Có bao nhiêu đáp án khả năng? Cận dưới là bao nhiêu?
