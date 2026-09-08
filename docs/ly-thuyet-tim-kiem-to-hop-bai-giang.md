# Lý thuyết Tìm kiếm Tổ hợp qua bài toán "chai rượu độc"

### Chuỗi bài giảng từ cơ bản đến nâng cao

> **Đối tượng:** học sinh giỏi toán / sinh viên năm đầu. Chỉ cần biết tổ hợp cơ bản (C(n,k)), logarit và hệ nhị phân. Các phần đánh dấu 🎓 là nâng cao, có thể bỏ qua lần đọc đầu.
>
> **Tài liệu liên quan trong repo:**
> - [Lời giải bài 1000 chai / 2 thành phần](bai-toan-doc-ruou-2-thanh-phan.md)
> - [Bản dịch đầy đủ thảo luận gốc trên Puzzling SE](puzzling-12770-ban-dich-day-du.md)

---

# 📖 MỤC LỤC

| Bài | Nội dung | Kết quả chính |
|:---:|:---|:---|
| **0** | Bản đồ toàn cảnh — 4 "núm điều chỉnh" | Khung phân loại |
| **1** | 1 chai độc, 1 ngày | ⌈log₂N⌉ = **10** |
| **2** | 1 chai độc, r ngày — "cái chết là tín hiệu một lần" | ⌈log_{r+1}N⌉ = **7** với 2 ngày |
| **3** | d chai độc độc lập — mô hình **MAX** | Kautz–Singleton: **49** tù nhân / 2401 chai |
| **4** | Chất độc phức hợp — mô hình **MIN** + **định lý đối ngẫu** | Cận dưới **12**; tốt nhất biết được **18** |
| **5** | Khung tổng quát: toán tử tổng hợp ⊗ | Định lý cận dưới phổ quát |
| **6** | Mô hình định lượng (cân tiền xu) — **SUM** | Θ(N / log N) — mạnh vượt trội |
| **7** | Nghệ thuật cận dưới & khoảng trống thích ứng | Vì sao đếm không bao giờ đủ |
| **8** | Các nhánh mở rộng & ứng dụng thật | Xét nghiệm gộp, DNA, nén tín hiệu |
| **9** | Bảng tra, bài tập, vấn đề mở | |

---
---

# BÀI 0 — BẢN ĐỒ TOÀN CẢNH

## 0.1. Tất cả các bài "chai rượu độc" đều là một bài

Mọi biến thể mà ta sẽ gặp đều có chung một khung:

> Có **N** đối tượng. Một tập con **S** trong số đó là "xấu". Ta không biết S. Ta được thực hiện các **phép thử**: chọn một tập T rồi nhận về **một tín hiệu** phụ thuộc vào quan hệ giữa S và T. Cần xác định S bằng ít tài nguyên nhất.

Đây gọi là **tìm kiếm tổ hợp** (*combinatorial search*), và trường hợp riêng nổi tiếng nhất của nó là **xét nghiệm gộp** (*group testing*) — ra đời năm 1943 khi Robert Dorfman tìm cách xét nghiệm bệnh syphilis cho hàng triệu quân nhân Mỹ mà không phải làm hàng triệu xét nghiệm.

## 0.2. Bốn núm điều chỉnh

Toàn bộ độ khó của họ bài toán này nằm ở bốn tham số:

| Núm | Ký hiệu | Các giá trị | Ảnh hưởng |
|:---|:---:|:---|:---|
| **① Số đối tượng** | N | 1000, 2401, … | Vào cận dưới qua log N |
| **② Số phần tử xấu** | d | 1, 2, 3, … | Vào cận dưới qua log C(N,d) — **và làm bài toán khó lên rất nhiều** |
| **③ Ngữ nghĩa phép thử** | ⊗ | MAX / MIN / SUM / ngưỡng | **Quyết định toàn bộ cảnh quan độ khó** |
| **④ Số vòng thử** | r | 1, 2, …, thích ứng hoàn toàn | Mở rộng bảng chữ cái tín hiệu |

Đặc thù của bài "tù nhân" so với xét nghiệm gộp cổ điển là **núm ④ tính theo *người thử*, không phải theo *phép thử***. Ta sẽ thấy đây là chi tiết tinh tế và quan trọng nhất (Bài 2).

## 0.3. Ba ngữ nghĩa phép thử mà ta sẽ gặp

Giả sử tù nhân *p* nếm một tập chai T:

| Tên | Ngữ nghĩa | Anh ta chết khi… | Toán tử |
|:---|:---|:---|:---:|
| **OR** (độc thường) | mỗi chai độc tự giết được | T chứa **ít nhất một** chai độc | **MAX** |
| **AND** (độc phức hợp) | cần đủ mọi thành phần | T chứa **tất cả** d chai độc | **MIN** |
| **SUM** (cân tiền xu) | tín hiệu định lượng | — nhận về **số lượng** \|S ∩ T\| | **SUM** |

Ba toán tử này cho ba thế giới hoàn toàn khác nhau về độ khó. Ta sẽ đi lần lượt.

---
---

# BÀI 1 — BÀI CƠ BẢN: MỘT CHAI ĐỘC, MỘT NGÀY

## 1.1. Đề bài

> 1000 chai rượu, **đúng một chai** có độc. Ai uống chai đó chết vào nửa đêm. Bạn có **một ngày**. Cần ít nhất bao nhiêu tù nhân?

## 1.2. Cận dưới — lập luận đếm

Đây là lập luận sẽ dùng lại suốt cả chuỗi bài, nên hãy nắm thật chắc.

**Bước 1 — Đếm số câu trả lời khả năng.** Chai độc có thể là bất kỳ chai nào trong 1000 chai:

|H| = 1000

*(H là "không gian giả thuyết" — tập mọi đáp án có thể.)*

**Bước 2 — Đếm số quan sát khả năng.** Mỗi tù nhân, cuối ngày, ở một trong **2** trạng thái: **sống** hoặc **chết**. Với *n* tù nhân, ta thấy một trong 2ⁿ bức tranh.

**Bước 3 — Nguyên lý chuồng bồ câu.** Chiến lược của ta là một hàm

φ : {bức tranh quan sát} → {đáp án}

Nếu hai đáp án khác nhau lại cho **cùng** một bức tranh thì ta không thể phân biệt được → chiến lược sai. Vậy hàm ngược phải đơn ánh, tức:

> **2ⁿ ≥ |H| = 1000  ⟹  n ≥ log₂1000 = 9,97  ⟹  n ≥ 10**

**Định lý 1.1 (Cận dưới đếm).** *Nếu mỗi người thử cho k tín hiệu phân biệt được và có n người thử, thì phải có kⁿ ≥ |H|, tức n ≥ log_k|H|.*

## 1.3. Cận trên — lời giải nhị phân

10 tù nhân là **đủ**. Đánh số chai từ 0 đến 999 và viết ở dạng nhị phân 10 bit. Đánh số tù nhân P₀ … P₉.

> **Tù nhân Pₖ nếm mọi chai có bit thứ k bằng 1.**

Nửa đêm, đọc: chai độc = số nhị phân mà bit thứ k bằng 1 nếu Pₖ chết, bằng 0 nếu Pₖ sống.

**Ví dụ:** chai 733 = `1011011101`. Chết: P₀, P₂, P₃, P₄, P₆, P₇, P₉. Sống: P₁, P₅, P₈. Ghép lại đúng ra 733.

## 1.4. Cách nhìn "mã hoá" — chìa khoá cho cả chuỗi bài

Hãy nhìn lại lời giải trên nhưng **đảo ngược góc nhìn**:

> Đừng nghĩ "tù nhân Pₖ uống những chai nào". Hãy nghĩ **"chai b được gán từ mã nào"**.

Gán cho chai *b* một **từ mã** (*codeword*) φ(b) ∈ {0,1}ⁿ, trong đó thành phần thứ p là:

- **1** nếu tù nhân p nếm chai b
- **0** nếu không

**Định lý 1.2 (Định lý mã hoá, trường hợp d = 1).** *Với đúng một chai độc b\*, bức tranh "ai chết" chính bằng từ mã φ(b\*).*

*Chứng minh.* Tù nhân p chết ⟺ p nếm b\* ⟺ thành phần thứ p của φ(b\*) bằng 1. ∎

**Hệ quả.** Chiến lược đúng ⟺ **các từ mã đôi một khác nhau**. Bài toán tổ hợp trở thành: *nhét 1000 từ mã phân biệt vào {0,1}ⁿ* → cần 2ⁿ ≥ 1000.

Đây là điểm mấu chốt: **cận dưới và cận trên gặp nhau**. Bài toán d = 1 được giải **trọn vẹn**, không còn khoảng trống.

## 1.5. Một quan sát bất ngờ: ngày thứ hai (theo lượt) không giúp gì

Giả sử thay vì thử một lần, ta được thử **tuần tự**: thử một nhóm, xem kết quả, rồi thử nhóm tiếp theo (**thích ứng** — *adaptive*).

Đây chính là **tìm kiếm nhị phân**: chia đôi, mỗi lần loại một nửa → ⌈log₂1000⌉ = **10 phép thử**. Không hơn gì cách không thích ứng!

**Định lý 1.3.** *Với d = 1, mô hình MAX, thích ứng không cho lợi thế nào: cả hai đều cần đúng ⌈log₂N⌉ phép thử.*

> ⚠️ **Hãy ghi nhớ điều này.** Nó **hoàn toàn sai** khi d ≥ 2. Khoảng trống giữa thích ứng và không thích ứng mở ra chính xác tại d = 2, và đó là hiện tượng trung tâm của cả lý thuyết (Bài 3, Bài 7).

## 1.6. Bài tập Bài 1

1. Với 1.000.000 chai và 1 chai độc, cần bao nhiêu tù nhân?
2. Nếu bạn chỉ có 9 tù nhân, số chai tối đa xử lý được là bao nhiêu? Nếu **được phép suy luận** trường hợp "không ai chết" thì sao?
3. Chứng minh chặt: nếu hai chai có cùng từ mã thì **không** chiến lược giải mã nào tồn tại.
4. 🎓 Nếu bạn muốn **ít người chết nhất** (không phải ít người thử nhất) với 1000 chai và không giới hạn số tù nhân, hãy tìm phương án tối ưu. *(Gợi ý: 1 người chết là đạt được — nhưng cần bao nhiêu người?)*

---
---

# BÀI 2 — THÊM NGÀY: "CÁI CHẾT LÀ TÍN HIỆU DÙNG MỘT LẦN"

## 2.1. Đề bài

> 1000 chai, **một** chai độc, nhưng giờ bạn có **hai ngày**. Chết vào nửa đêm của ngày uống chai độc. Cần ít nhất bao nhiêu tù nhân?

## 2.2. Cái bẫy: r ngày **không** cho 2^r tín hiệu

Phản xạ đầu tiên là: "mỗi ngày mỗi người cho 1 bit, 2 ngày → 2 bit → 4 tín hiệu → 4ⁿ ≥ 1000 → n = 5."

**Sai.** Vì sao? Hãy liệt kê những gì thực sự **quan sát được** ở một tù nhân sau 2 ngày:

| Kịch bản | Quan sát được không? |
|:---|:---|
| Sống qua cả 2 ngày | ✅ "sống" |
| Chết nửa đêm ngày 1 | ✅ "chết ngày 1" |
| Chết nửa đêm ngày 2 | ✅ "chết ngày 2" |
| "Chết ngày 1 rồi lại chết ngày 2" | ❌ **vô nghĩa** |

**Cái chết là trạng thái hấp thụ (absorbing).** Chết rồi thì không phát tín hiệu nữa. Nên 2 ngày cho **3** tín hiệu, không phải 4.

**Định lý 2.1 (Định lý bảng chữ cái).** *Với r vòng, mỗi người thử cho đúng r + 1 tín hiệu phân biệt được:*

> *sống sót, chết cuối vòng 1, chết cuối vòng 2, …, chết cuối vòng r*

*Do đó với n người thử: số quan sát khả năng ≤ (r+1)ⁿ, và*
>
> ### n ≥ log_{r+1} |H|

*Chứng minh.* Trạng thái của một người thử là không giảm theo thời gian (sống → chết, không quay lại) và "chết" chấm dứt việc phát tín hiệu. Một quỹ đạo như vậy được xác định hoàn toàn bởi **thời điểm chuyển trạng thái**, có r + 1 giá trị: không bao giờ, hoặc cuối vòng 1..r. ∎

> 💡 **Đây là đặc thù cốt lõi của họ bài toán "tù nhân".** Trong xét nghiệm gộp cổ điển ta đếm **phép thử** — r vòng × n người = rn phép thử, cho 2^{rn} kết quả. Ở đây ta đếm **người thử**, và r vòng chỉ nhân bảng chữ cái lên thành r+1, tức thêm log₂(r+1) bit mỗi người, chứ không phải r bit.
>
> Nói cách khác: **người thử là tài nguyên tái sử dụng được, nhưng chỉ phát tín hiệu đúng một lần trong đời.**

## 2.3. Đáp án: 7 tù nhân

Áp Định lý 2.1 với r = 2, |H| = 1000:

3ⁿ ≥ 1000 → 3⁶ = 729 (thiếu), 3⁷ = 2187 (đủ) → **n ≥ 7**

Và **7 là đạt được**. Cách làm — gán từ mã **cơ số 3**:

Viết số hiệu mỗi chai ở cơ số 3 với 7 chữ số. Với tù nhân p và chai b, gọi chữ số thứ p là vₚ(b) ∈ {0,1,2}:

| vₚ(b) | Tù nhân p nếm chai b vào… |
|:---:|:---|
| **2** | **ngày 1** |
| **1** | **ngày 2** |
| **0** | **không bao giờ** |

**Giải mã:** nếu p chết ngày 1 → chữ số thứ p là 2. Chết ngày 2 → là 1. Sống → là 0. Ghép 7 chữ số cơ số 3 lại được số hiệu chai độc.

**Ví dụ:** chai độc số 500. Ở cơ số 3: 500 = `0200112`₃ (kiểm tra: 2·3⁵ + 0 + 0 + 1·3² + 1·3 + 2 = 486 + 9 + 3 + 2 = 500). Vậy tù nhân số 5 chết ngày 1; tù nhân 2, 1 chết ngày 2; tù nhân 0 chết ngày 1... — đọc ngược lại ra đúng 500.

**Định lý 2.2 (d = 1 giải trọn vẹn).** *Với đúng một phần tử xấu trong N phần tử và r vòng, số người thử tối thiểu là chính xác*
>
> ### n = ⌈log_{r+1} N⌉

*Cận dưới từ Định lý 2.1; cận trên bằng cách gán từ mã cơ số (r+1) phân biệt.* ∎

## 2.4. Bảng: 1000 chai, 1 chai độc

| Số ngày r | Cơ số | Số tù nhân | Kiểm tra |
|:---:|:---:|:---:|:---|
| 1 | 2 | **10** | 2¹⁰ = 1024 ≥ 1000 > 512 |
| 2 | 3 | **7** | 3⁷ = 2187 ≥ 1000 > 729 |
| 3 | 4 | **5** | 4⁵ = 1024 ≥ 1000 > 256 |
| 4 | 5 | **5** | 5⁵ = 3125 ≥ 1000 > 625 |
| 5 | 6 | **4** | 6⁴ = 1296 ≥ 1000 > 216 |

Chú ý **quy luật giảm dần hiệu suất**: ngày thứ 2 tiết kiệm 3 người, ngày thứ 3 tiết kiệm 2 người, ngày thứ 4 tiết kiệm 0 người. Vì lợi ích chỉ là log₂(r+1) — tăng theo **logarit** của số ngày.

## 2.5. Bài tập Bài 2

1. 1 chai độc, 10 ngày, bao nhiêu tù nhân cho 1000 chai? Cho 1 tỉ chai?
2. Với **3 tù nhân** và 1 chai độc, cần bao nhiêu ngày để xử lý 1000 chai?
3. Chứng minh Định lý 2.1 chặt chẽ hơn: giải thích vì sao việc một người chết ngày 1 **vẫn được xếp lịch uống** ngày 2 không gây mâu thuẫn nào cho lời giải.
4. 🎓 Biến thể: giả sử chất độc giết sau **đúng 2 ngày** kể từ khi uống (chứ không phải nửa đêm cùng ngày). Với r ngày, mỗi người cho bao nhiêu tín hiệu?

---
---

# BÀI 3 — d CHAI ĐỘC ĐỘC LẬP: MÔ HÌNH **MAX**

## 3.1. Đề bài và mô hình

> 1000 chai, **d** chai có độc, **mỗi chai tự giết được**. Tù nhân chết vào nửa đêm của ngày đầu tiên anh ta nếm phải **bất kỳ** chai độc nào.

Mở rộng cách mã hoá của Bài 2. Gán cho chai *b* từ mã φ(b) ∈ {0, 1, …, r}ⁿ, với

vₚ(b) = r + 1 − (ngày sớm nhất p nếm chai b),  và 0 nếu không bao giờ nếm

**Định lý 3.1 (Định lý mã hoá, mô hình MAX).** *Nếu tập chai độc là S, thì quan sát được ở tù nhân p là*
>
> ### outₚ = max{ vₚ(b) : b ∈ S }

*Chứng minh.* p chết vào ngày sớm nhất anh ta nếm **một** chai nào đó trong S. Ngày sớm nhất ⟷ giá trị v lớn nhất (vì v = r+1−ngày, nghịch biến theo ngày). Nếu vₚ(b) = 0 với mọi b ∈ S thì p sống → max = 0. ∎

Vậy: **quan sát = MAX theo từng thành phần của d từ mã.** Với r = 1, đây đúng là **phép hợp tập hợp** — nên mô hình MAX còn gọi là **mô hình hợp** (*union model*) hay **mã chồng chập** (*superimposed codes*).

## 3.2. Cận dưới đếm

|H| = C(N, d), mỗi người cho r+1 tín hiệu:

> ### n ≥ log_{r+1} C(N, d)

**Bảng cho N = 1000:**

| d | \|H\| = C(1000,d) | r=1 | r=2 | r=3 | r=4 | r=9 |
|:---:|---:|:---:|:---:|:---:|:---:|:---:|
| 2 | 499.500 | **19** | **12** | **10** | **9** | **6** |
| 3 | 166.167.000 | **28** | **18** | **14** | **12** | **9** |
| 4 | 41.417.124.750 | **36** | **23** | **18** | **16** | **11** |

*(Xấp xỉ: log₂C(N,d) ≈ d·log₂(N/d) + O(d) — tăng **tuyến tính** theo d.)*

## 3.3. Thích ứng hoàn toàn: cận dưới là (gần) đạt được

Nếu được thử tuần tự không hạn chế số vòng, mô hình MAX rất "dễ chịu":

**Thuật toán chia đôi nhị phân tổng quát (Hwang, 1972).** Tìm được d phần tử xấu trong N phần tử bằng nhiều nhất

d·log₂(N/d) + O(d) **phép thử**

So với cận dưới log₂C(N,d) ≈ d·log₂(N/d): **chênh nhau chỉ hằng số**. Mô hình MAX thích ứng coi như đã giải xong.

*Ý tưởng:* luôn giữ một "khối" nghi vấn, chia đôi nó. Câu trả lời "CÓ (có ít nhất một phần tử xấu trong nhóm)" khoanh vùng được; câu trả lời "KHÔNG" **loại sạch cả nhóm**. Cả hai câu trả lời đều có giá trị → chia đôi cân bằng được.

## 3.4. Không thích ứng: khoảng trống mở ra

Giờ mọi phép thử phải chọn từ đầu (r = 1, tất cả uống cùng ngày). Hai khái niệm then chốt:

**Định nghĩa 3.2 (d-phân ly / *d-separable*).** *Họ từ mã {φ(b)} là d-phân ly nếu với hai tập d-phần tử khác nhau S ≠ S′, ta có MAX(S) ≠ MAX(S′).*
→ Đây là **điều kiện cần và đủ** để giải mã được.

**Định nghĩa 3.3 (d-tách rời / *d-disjunct*, còn gọi *d-cover-free*).** *Họ từ mã là d-tách rời nếu không từ mã nào bị **phủ** bởi hợp của d từ mã khác:*

> ∀ b, ∀ S với |S| = d, b ∉ S:  φ(b) ⊄ MAX(S)

d-tách rời **mạnh hơn** d-phân ly, và có lợi thế lớn: **giải mã cực nhanh** — chai b là độc ⟺ φ(b) ⊆ (tập quan sát). Chỉ cần quét N chai một lượt, không cần tra bảng.

**Định lý 3.4 (Dyachkov–Rykov 1982; Ruszinkó 1994; Füredi 1996).** *Số phép thử cần cho mã d-tách rời trên N phần tử là*
>
> ### t = Θ( d² · log N / log d )

*và mã d-phân ly cũng cần cùng bậc độ lớn đó.*

## 3.5. 🔥 Hiện tượng trung tâm: khoảng trống thích ứng

Đặt hai kết quả cạnh nhau:

| | Số phép thử |
|:---|:---|
| **Thích ứng** | Θ(d · log N) |
| **Không thích ứng** | Θ(d² · log N / log d) |

> ### Tỉ số = Θ(d / log d)
>
> **Với d = 1: tỉ số = 1** (không có khoảng trống — đúng Định lý 1.3).
> **Với d = 2: tỉ số ≈ 4.** **Với d = 10: tỉ số ≈ 30.**

**Vì sao?** Trong mô hình MAX không thích ứng, câu trả lời "KHÔNG" mang rất nhiều thông tin nhưng ta không được **dùng** thông tin đó để chọn phép thử tiếp theo. Ta phải thiết kế mọi phép thử để chống lại **mọi** kịch bản cùng lúc → dư thừa.

Đây chính là lý do sâu xa vì sao ở bài "chất độc phức hợp", hai ngày lại giúp giảm từ ~90 người xuống ~20 người: **thêm một vòng là mua được một phần của lợi thế thích ứng.**

## 3.6. ⭐ Cấu trúc Kautz–Singleton (1964) — dựng mã cụ thể

Đây là cấu trúc đẹp nhất và thực dụng nhất trong toàn bộ lý thuyết. Nó **biến một mã sửa lỗi thành một mã xét nghiệm gộp**.

### Nguyên liệu

Một mã q-phân độ dài ℓ: mỗi chai được gán một dãy ℓ ký hiệu lấy từ bảng chữ cái q phần tử, sao cho **hai dãy bất kỳ trùng nhau ở nhiều nhất a vị trí**.

### Phép biến đổi "unary hoá"

Dùng **n = ℓ · q tù nhân**, đánh số bằng cặp (i, s) với i ∈ {1..ℓ} là vị trí và s ∈ {1..q} là ký hiệu.

> **Tù nhân (i, s) nếm mọi chai có ký hiệu thứ i bằng s.**

Mỗi chai được nếm bởi đúng ℓ tù nhân (một cho mỗi vị trí).

### Tiêu chí tách rời

**Định lý 3.5.** *Mã thu được là d-tách rời nếu*
>
> ### d · a < ℓ

*Chứng minh.* Giả sử từ mã của chai x bị phủ bởi hợp của d chai y₁..y_d. Phủ nghĩa là: với **mọi** vị trí i, ký hiệu thứ i của x phải trùng với ký hiệu thứ i của một y_j nào đó. Mỗi y_j trùng với x ở nhiều nhất a vị trí, nên d chai phủ được nhiều nhất d·a vị trí. Nếu d·a < ℓ thì có vị trí không được phủ → mâu thuẫn. ∎

### Chọn mã Reed–Solomon

Lấy q là **lũy thừa nguyên tố**, ℓ ≤ q, và cho mỗi chai ứng với một **đa thức bậc < k** trên trường GF(q); từ mã là giá trị của đa thức tại ℓ điểm phân biệt.

- Số chai: **N = q^k**
- Hai đa thức bậc < k phân biệt trùng nhau ở nhiều nhất **a = k − 1** điểm
- Tiêu chí: **d(k−1) < ℓ ≤ q**
- Số tù nhân: **n = ℓ · q**

### 🏆 Ví dụ chủ lực: d = 2

Chọn **q = 7, ℓ = 7, k = 4**. Kiểm tra: a = 3, và 2·3 = 6 < 7 ✓

> ### **2401 chai, 2 chai độc, 1 ngày, 49 tù nhân**
>
> *(Đã kiểm chứng bằng máy: toàn bộ 2.881.200 cặp cho ra 2.881.200 tập quan sát khác nhau; mã là 2-tách rời.)*

Cách làm cụ thể: đánh số 2401 chai bằng bộ 4 hệ số (c₀,c₁,c₂,c₃) ∈ GF(7)⁴. Từ mã của chai là 7 giá trị f(0), f(1), …, f(6) mod 7 với f(x) = c₀ + c₁x + c₂x² + c₃x³. Tù nhân (i, s) — với i ∈ {0..6}, s ∈ {0..6} — nếm mọi chai có f(i) ≡ s.

**Giải mã (cực đơn giản):** liệt kê các chai b mà **toàn bộ 7 tù nhân của b đều chết**. Đúng 2 chai thoả — đó là hai chai độc.

**So sánh hiệu suất:** 49 / log₂(2401) = 49 / 11,23 ≈ **4,4 × log₂N** — rất gần với bậc lý thuyết d²/log d = 4.

### Bảng tra Kautz–Singleton (d = 2)

| q | ℓ | k | Số chai N | Số tù nhân n |
|:---:|:---:|:---:|---:|:---:|
| 5 | 5 | 3 | 125 | 25 |
| **7** | **7** | **4** | **2.401** | **49** |
| 8 | 7 | 4 | 4.096 | 56 |
| 9 | 9 | 5 | 59.049 | 81 |
| 16 | 10 | 5 | 1.048.576 | 160 |

## 3.7. Bài tập Bài 3

1. Kiểm tra Định lý 3.5 bằng tay với q = 3, ℓ = 3, k = 2 (N = 9 chai, n = 9 tù nhân, d = 2). Liệt kê cả 36 cặp và xác nhận các hợp đôi một khác nhau.
2. Với d = 3, hãy chọn (q, ℓ, k) để xử lý ít nhất 1000 chai. Cần bao nhiêu tù nhân? *(Gợi ý: tiêu chí là 3(k−1) < ℓ ≤ q.)*
3. Giải thích bằng lời vì sao "d-tách rời" cho phép giải mã bằng quét một lượt, còn "d-phân ly" thì phải tra bảng.
4. 🎓 Chứng minh d-tách rời ⟹ d-phân ly. Tìm phản ví dụ cho chiều ngược lại.
5. 🎓 Tính cận dưới đếm cho d = 2, N = 2401, r = 1. So với 49. Khoảng trống là bao nhiêu lần?

---
---

# BÀI 4 — CHẤT ĐỘC PHỨC HỢP: MÔ HÌNH **MIN**

## 4.1. Đề bài — bài toán gốc của chúng ta

> 1000 chai. Chất độc gồm **d = 2 thành phần**, mỗi thành phần ở một chai, **riêng lẻ vô hại**. Chỉ chết khi nạp **đủ cả hai** — chết vào nửa đêm của ngày nạp thành phần cuối cùng. Thành phần đã nạp **lưu lại vĩnh viễn** trong cơ thể. Có 2 ngày.

## 4.2. Định lý mã hoá cho mô hình MIN

Dùng đúng cách gán nhãn của Bài 3:

vₚ(b) = r + 1 − (ngày sớm nhất p nếm b),  0 nếu không nếm

**Định lý 4.1 (Định lý mã hoá, mô hình MIN).** *Nếu tập chai độc là S (|S| = d), quan sát tại tù nhân p là*
>
> ### outₚ = min{ vₚ(b) : b ∈ S }

*Chứng minh.* p chết khi đã nạp **đủ** d thành phần, tức vào ngày **muộn nhất** trong các ngày anh ta nếm các chai của S. Ngày muộn nhất ⟷ giá trị v **nhỏ nhất**. Nếu có b ∈ S với vₚ(b) = 0 (p không bao giờ nếm b) thì p thiếu thành phần đó mãi mãi → sống → min = 0. ∎

**Kiểm tra với r = 2** (bảng đã gặp ở Bài 1 của tài liệu lời giải):

| v của chai i, j | min | Ý nghĩa |
|:---:|:---:|:---|
| 2 và 2 | **2** | nạp đủ ngay ngày 1 → chết nửa đêm ngày 1 |
| 2 và 1, hoặc 1 và 1 | **1** | đủ chậm nhất cuối ngày 2 → chết nửa đêm ngày 2 |
| có 0 | **0** | thiếu thành phần → sống |

## 4.3. Cận dưới

> ### n ≥ log_{r+1} C(N, d)

**Giống hệt mô hình MAX!** Với N = 1000, d = 2:

- **1 ngày:** 2ⁿ ≥ 499.500 → **n ≥ 19**
- **2 ngày:** 3ⁿ ≥ 499.500 → **n ≥ 12**
- 3 ngày: **n ≥ 10** · 4 ngày: **n ≥ 9** · 9 ngày: **n ≥ 6**

## 4.4. ⭐⭐ ĐỊNH LÝ ĐỐI NGẪU MIN–MAX

Việc hai cận dưới giống nhau không phải trùng hợp. Có một lý do cấu trúc rất sâu.

**Định lý 4.2 (Đối ngẫu).** *Với phép đảo bảng chữ cái w = r − v, ta có đồng nhất thức*
>
> ### min(v₁, …, v_d) = r − max(w₁, …, w_d)

*Do đó: biết MIN của các từ mã v ⟺ biết MAX của các từ mã w. Bài toán độc phức hợp (MIN) và bài toán độc thường (MAX) là **đẳng cấu về mặt tổ hợp**.*

*Chứng minh.* min(v₁,…,v_d) = min(r−w₁, …, r−w_d) = r − max(w₁,…,w_d). ∎

### 🎁 Hệ quả thực dụng: dùng lại toàn bộ Bài 3

**Hệ quả 4.3.** *Mọi mã d-phân ly (hay d-tách rời) cho mô hình MAX, sau khi **đảo nhãn**, trở thành mã hợp lệ cho mô hình MIN, và ngược lại.*

Áp vào ví dụ chủ lực GF(7):

> ### **2401 chai, độc 2 thành phần, 1 NGÀY, 49 tù nhân**
>
> Lấy đúng mã Kautz–Singleton GF(7) ở §3.6 rồi **đảo lại**:
>
> **Tù nhân (i, s) nếm mọi chai có ký hiệu thứ i KHÁC s.**
>
> Mỗi tù nhân uống 2401 · (6/7) = **2058 chai** — uống gần hết, chỉ tránh một "lát".
>
> **Giải mã:** tù nhân (i,s) **sống** ⟺ anh ta tránh phải một chai độc ⟺ một trong hai chai độc có ký hiệu thứ i bằng s. Vậy tập người **sống sót** = hợp hai từ mã KS. Vì hợp đôi một phân biệt → truy ra được cặp. Với tính 2-tách rời: chai b là độc ⟺ **cả 7 tù nhân của b đều sống**.

So sánh với cấu trúc "lưới 32×32" ở tài liệu lời giải (96 tù nhân cho 1024 chai): mã Kautz–Singleton cho **49 tù nhân cho 2401 chai** — tốt hơn gấp nhiều lần.

### 🚨 Nhưng đối ngẫu KHÔNG bảo toàn tính thích ứng!

Đây là chỗ tinh tế nhất của cả chuỗi bài. Phép đảo w = r − v **đảo luôn trục thời gian**:

| Trong mô hình MIN | Đối ngẫu thành, trong mô hình MAX |
|:---|:---|
| v = r ("nếm ngày 1") | w = 0 ("không bao giờ nếm") |
| v = 0 ("không nếm") | w = r ("nếm ngày 1") |

**Định lý 4.4.** *Đối ngẫu MIN–MAX là song ánh trên tập các **mã** (thiết kế không thích ứng), nhưng **không** là song ánh trên tập các **chiến lược thích ứng r vòng**, vì nó đảo thứ tự các vòng.*

**Hệ quả trực giác — vì sao hai mô hình vẫn "cảm giác" rất khác nhau:**

| | Mô hình MAX (độc thường) | Mô hình MIN (độc phức hợp) |
|:---|:---|:---|
| Câu trả lời "chết" nghĩa là | nhóm chứa ≥ 1 chai độc | nhóm chứa **cả** d chai độc |
| Xác suất chết với nhóm nửa số chai | 1 − (1/2)^d = 75% (d=2) | (1/2)^d = 25% (d=2) |
| Để cân bằng 50/50 phải lấy nhóm | ~29% số chai | **~71% số chai** |
| Người chết sớm | rất nhiều → mất người thử nhanh | ít → giữ được người thử |

> 💡 **Kết luận sư phạm quan trọng:** trực giác phổ biến "phép thử AND yếu hơn phép thử OR" là **sai về mặt hình thức** trong bài toán không thích ứng (Định lý 4.2), nhưng **đúng về mặt vận hành** khi ta thiết kế chiến lược nhiều vòng — vì thứ tự thời gian không đối ngẫu được.
>
> Đây cũng chính là chỗ mà con số "707 chai mỗi người" trong lời giải xuất hiện: **1/√2 ≈ 0,707**, nghiệm của t² = 1/2.

## 4.5. Chiến lược thích ứng cho mô hình MIN

**Định lý 4.5 (Chia đôi cân bằng được).** *Trong mô hình MIN với d = 2, phép thử "cả hai chai độc có trong tập T?" chia đôi được không gian giả thuyết một cách cân bằng: chọn*

|T| = N / √2 ≈ 0,707 N

*khi đó C(|T|, 2) ≈ C(N,2) / 2, nên câu trả lời CÓ và KHÔNG đều loại đúng một nửa số cặp ứng viên.*

**Hệ quả.** Thích ứng hoàn toàn cần khoảng log₂C(N,2) ≈ **19 phép thử** cho N = 1000 — đạt cận dưới đếm.

Nhưng chú ý: đó là **19 phép thử tuần tự**, tức 19 vòng. Bài toán của ta chỉ có **2 vòng**. Đó là toàn bộ độ khó còn lại.

## 4.6. Trạng thái tri thức về bài toán 1000 chai / 2 thành phần / 2 ngày

| | Số tù nhân |
|:---|:---:|
| **Cận dưới đếm** (Định lý 4.3) | **12** |
| **Chiến lược tốt nhất được biết** (Timbo, Puzzling SE) | **18** |
| Chiến lược dễ dựng, dễ kiểm chứng | 24 |
| Khoảng trống | **12 ↔ 18 — vẫn mở** |

### Vì sao lời giải 18 tù nhân lại hay

Ý tưởng của Timbo khai thác đúng cấu trúc "cặp":

Dùng **10 cặp** tù nhân, cặp thứ a phụ trách **bit thứ a**: người `a.0` uống mọi chai có bit a = 0, người `a.1` uống mọi chai có bit a = 1. Gọi x, y là số hiệu hai chai độc.

- `a.0` chết ⟺ xₐ = 0 **và** yₐ = 0
- `a.1` chết ⟺ xₐ = 1 **và** yₐ = 1
- ⟹ **cả hai sống ⟺ xₐ ≠ yₐ**

Vậy ngày 1 đọc trực tiếp ra **x XOR y** — không cần biết x, y riêng lẻ! Ngày 2 chỉ còn việc tách ra một trong hai số, rồi số kia = (số đã biết) XOR (x XOR y).

> 💡 **Bài học thiết kế:** đừng cố tìm hai chai độc **cùng lúc**. Hãy tìm một **hàm đối xứng** của chúng (ở đây là XOR) mà phép thử đọc ra được dễ dàng, rồi phá đối xứng ở vòng sau.

## 4.7. Bài tập Bài 4

1. Chứng minh Định lý 4.1 cho r = 3 bằng cách liệt kê mọi trường hợp.
2. Áp Định lý 4.2 để biến đổi cấu trúc GF(5) (125 chai, 25 tù nhân, mô hình MAX) thành lời giải cho mô hình MIN. Viết rõ tù nhân nào uống chai nào.
3. Vì sao trong lời giải 24 tù nhân, mỗi người ngày 1 uống 707 chai chứ không phải 500? Tính lượng thông tin (bit) thu về trong hai trường hợp.
4. 🎓 Chứng minh **ràng buộc Sperner**: trong mô hình MIN, nếu φ(i) ≤ φ(j) và φ(i) ≤ φ(k) theo từng thành phần (với i, j, k phân biệt) thì xảy ra trùng lặp. Suy ra: mỗi từ mã bị **nhiều nhất một** từ mã khác trội hơn.
5. 🎓 Dùng bài 4 để cải thiện cận dưới 12 lên 13. *(Đây là một vấn đề mở nhỏ — hãy thử!)*

---
---

# BÀI 5 — KHUNG TỔNG QUÁT: TOÁN TỬ TỔNG HỢP

## 5.1. Định nghĩa bài toán tổng quát

Giờ ta gói mọi thứ vào một định nghĩa duy nhất.

> **Bài toán tìm kiếm tổ hợp (dạng mã hoá).**
>
> **Cho:**
> - Tập đối tượng X, |X| = N
> - Họ giả thuyết H ⊆ 2^X (các tập "xấu" có thể) — thường H = {S : |S| = d}
> - Bảng chữ cái tín hiệu A
> - **Toán tử tổng hợp** ⊗ : A × A → A, giao hoán và kết hợp
>
> **Cần:** một phép **gán mã** φ : X → Aⁿ với n nhỏ nhất, sao cho ánh xạ
>
> ### Φ : H → Aⁿ,  Φ(S) = ⊗_{b ∈ S} φ(b)  (theo từng thành phần)
>
> **là đơn ánh.**

Ánh xạ Φ chính là "những gì ta quan sát được". Đơn ánh = giải mã được.

## 5.2. Bảng các mô hình

| Mô hình | ⊗ | Bảng chữ cái A | Bài toán vật lý | Lũy đẳng? |
|:---|:---:|:---|:---|:---:|
| **Hợp / OR** | **max** | {0,…,r} | d chai độc thường, r ngày | ✅ |
| **Giao / AND** | **min** | {0,…,r} | độc phức hợp d thành phần | ✅ |
| **Định lượng / adder** | **sum** | ℕ | cân tiền xu giả | ❌ |
| **Ngưỡng** | ngưỡng θ | {0,1} | cần ≥ θ thành phần mới chết | ✅ |
| **XOR / cộng mod 2** | ⊕ | {0,1} | thử nghiệm chẵn/lẻ | ❌ |

## 5.3. Định lý cận dưới phổ quát

**Định lý 5.1.** *Với mọi toán tử ⊗ và mọi họ H:*
>
> ### n ≥ log_{|A|} |H|

*Chứng minh.* Miền giá trị của Φ nằm trong Aⁿ, có |A|ⁿ phần tử. Đơn ánh cần |A|ⁿ ≥ |H|. ∎

Kết hợp với Định lý bảng chữ cái (2.1): trong bài "tù nhân r ngày", |A| = r + 1, nên

> ### n ≥ log_{r+1} C(N, d)

Đây là **công thức chủ lực** của toàn bộ chuỗi bài. Mọi cận dưới ta đã tính đều là trường hợp riêng của nó.

## 5.4. 🎓 Lũy đẳng: vì sao MAX và MIN yếu, còn SUM mạnh

**Định nghĩa.** ⊗ **lũy đẳng** (*idempotent*) nếu a ⊗ a = a với mọi a.

max và min lũy đẳng. sum **không** (a + a = 2a ≠ a).

**Định lý 5.2 (Mất thông tin về số lượng).** *Nếu ⊗ lũy đẳng thì Φ(S) không mang thông tin nào về **số lần** một giá trị xuất hiện — chỉ về **tập** các giá trị. Cụ thể, với ⊗ = min:*

*Nếu φ(i) ≤ φ(j) và φ(i) ≤ φ(k) theo từng thành phần (i, j, k phân biệt), thì*

Φ({i,j}) = φ(i) = Φ({i,k})

*→ trùng lặp, mã không hợp lệ.*

*Chứng minh.* min(φ(i), φ(j)) = φ(i) vì φ(i) ≤ φ(j). Tương tự với k. ∎

**Hệ quả 5.3 (Ràng buộc kiểu Sperner).** *Trong một mã MIN hợp lệ cho d = 2, mỗi từ mã bị **nhiều nhất một** từ mã khác trội hơn. Nói cách khác, họ từ mã "gần như" là một **phản chuỗi** (*antichain*) trong dàn {0,…,r}ⁿ.*

Đây là ràng buộc cấu trúc **không** suy ra được từ phép đếm — ví dụ đầu tiên cho thấy cận dưới đếm không phải là toàn bộ câu chuyện (xem Bài 7).

Ngược lại, khi ⊗ = **sum**, ta giữ được thông tin số lượng, và bài toán trở nên **dễ hơn hẳn về mặt bậc độ lớn** — đó là nội dung Bài 6.

## 5.5. Bài tập Bài 5

1. Với mô hình XOR (⊗ = ⊕, A = {0,1}), tính cận dưới cho d = 2, N = 1000. Mô hình này có lũy đẳng không? Nó có "mạnh" hơn MAX không? *(Cẩn thận: XOR có tính chất kỳ lạ a ⊕ a = 0.)*
2. Chứng minh: nếu ⊗ lũy đẳng và giao hoán/kết hợp thì (A, ⊗) là một **nửa dàn** (*semilattice*). Với A = {0,…,r} và ⊗ = min, hãy vẽ dàn đó.
3. 🎓 Xây một mô hình mà cận dưới đếm **đạt được chính xác** với d = 2. *(Gợi ý: thử ⊗ = sum với bảng chữ cái đủ lớn.)*

---
---

# BÀI 6 — MÔ HÌNH ĐỊNH LƯỢNG: BÀI TOÁN CÂN TIỀN XU

## 6.1. Đề bài

> Có N đồng xu, một số đồng là giả (nhẹ hơn đúng 1 gram). Bạn có một **cân bàn** (đọc được số, không phải cân thăng bằng): đặt một nhóm xu lên, cân cho biết **chính xác có bao nhiêu đồng giả** trong nhóm. Cần ít nhất bao nhiêu lần cân để tìm hết các đồng giả?

Đây là mô hình **SUM**: outₚ = Σ_{b ∈ S} φₚ(b), tức phép thử T trả về **|S ∩ T|**.

## 6.2. Vì sao mô hình này mạnh hơn hẳn

Với d phần tử xấu, mỗi phép thử trả về một số trong {0, 1, …, d} — tức **d + 1** tín hiệu thay vì 2.

**Cận dưới (Định lý 5.1):** n ≥ log_{d+1} C(N, d) ≈ (d / log₂(d+1)) · log₂N

So sánh ba mô hình, không thích ứng, d phần tử xấu:

| Mô hình | Số phép thử cần |
|:---|:---|
| MAX / MIN | Θ(d² log N / log d) |
| **SUM** | **Θ(d log N / log d)** |

> **Chênh nhau một hệ số d.** Mô hình định lượng "miễn phí" cho ta lợi thế mà mô hình MAX phải dùng tính thích ứng mới có được.

## 6.3. Trường hợp d không biết trước — kết quả kinh điển

Nếu S là tập con **bất kỳ** (không biết cỡ), thì |H| = 2^N và:

**Cận dưới đếm:** (N+1)ⁿ ≥ 2^N → n ≥ N / log₂(N+1)

**Định lý 6.1 (Erdős–Rényi 1963; Lindström 1964; Cantor–Mills 1966).** *Số lần cân không thích ứng cần thiết để xác định một tập con bất kỳ của N đồng xu là*
>
> ### n = (2 + o(1)) · N / log₂ N

*Cận trên có cấu trúc tường minh (Lindström), dựa trên các **tập Sidon** / **tập B_h**.*

Với N = 1000: n ≈ 2 · 1000 / 9,97 ≈ **200 lần cân** cho **2^1000 giả thuyết**. Rất ấn tượng — nhưng chú ý cận dưới đếm là 100, nên hằng số 2 là chỗ "mất mát" (xem Bài 7).

## 6.4. Tập Sidon — công cụ đại số nền tảng

**Định nghĩa 6.2.** *Tập số nguyên B ⊆ {1,…,M} là **tập Sidon** (hay **tập B₂**) nếu mọi tổng đôi a + b (a ≤ b, a,b ∈ B) đều **khác nhau**. Tương đương: mọi hiệu a − b khác 0 đều khác nhau.*

**Vì sao liên quan?** Nếu gán cho đối tượng thứ i trọng số wᵢ và cân cho biết Σ_{i ∈ S} wᵢ, thì để suy ra S từ tổng, ta cần **mọi tập con có tổng khác nhau**. Với |S| = d, đó chính là điều kiện **B_d**.

**Định lý 6.3 (Erdős–Turán 1941; Bose–Chowla 1962).** *Tập Sidon lớn nhất trong {1,…,M} có cỡ (1 + o(1))·√M. Cấu trúc Bose–Chowla cho tập B_h cỡ q trong {1,…,q^h−1} với q là lũy thừa nguyên tố.*

**Kết nối trọn vẹn:**

| Đối tượng tổ hợp | Bài toán tìm kiếm |
|:---|:---|
| Từ mã phân biệt | d = 1, mô hình bất kỳ |
| Họ hợp-phân biệt (2-phân ly) | d = 2, mô hình MAX/MIN |
| Họ d-tách rời (cover-free) | d phần tử, MAX/MIN, giải mã nhanh |
| **Tập Sidon / B_d** | **d phần tử, mô hình SUM** |
| Mã sửa lỗi (Reed–Solomon) | nguyên liệu cho Kautz–Singleton |

> 🎓 Đây là thông điệp lớn nhất của cả chuỗi bài: **mỗi ngữ nghĩa phép thử tương ứng với một lớp đối tượng tổ hợp cụ thể**, và tìm lời giải tối ưu = tìm đối tượng tổ hợp cực trị trong lớp đó. Bài toán câu đố trở thành bài toán tổ hợp cực trị.

## 6.5. Bài tập Bài 6

1. Tìm một tập Sidon 4 phần tử trong {1,…,13}. Kiểm tra cả 10 tổng đôi.
2. Với mô hình SUM và d = 2, N = 1000, tính cận dưới đếm. So với cận dưới của mô hình MAX (19).
3. Vì sao cân **thăng bằng** (chỉ cho biết nặng/nhẹ/bằng) khác cân **bàn**? Bảng chữ cái tín hiệu của mỗi loại là gì?
4. 🎓 Giải thích trực giác vì sao hằng số trong Định lý 6.1 là **2** chứ không phải **1** (tức cận dưới đếm không đạt được).

---
---

# BÀI 7 — NGHỆ THUẬT CẬN DƯỚI VÀ KHOẢNG TRỐNG THÍCH ỨNG

## 7.1. Ba tầng cận dưới

Suốt chuỗi bài ta chỉ dùng tầng 1. Đây là bức tranh đầy đủ:

### Tầng 1 — Đếm / entropy

n ≥ log_{|A|}|H|. **Ưu điểm:** luôn đúng, dễ tính. **Nhược điểm:** thường **rất xa** sự thật trong bài toán không thích ứng.

### Tầng 2 — Đối phương (adversary argument)

Đối phương không cố định S trước; hắn trả lời từng câu hỏi sao cho **giữ lại nhiều ứng viên nhất**. Ta chứng minh sau n phép thử vẫn còn ≥ 2 ứng viên.

*Ví dụ ứng dụng:* trong mô hình MAX với d = 2, đối phương luôn trả lời "CÓ" cho mọi nhóm ≥ nửa số chai — buộc thuật toán phải làm việc rất nhiều.

### Tầng 3 — Ràng buộc cấu trúc

Khai thác hình dạng cụ thể của ⊗. Ví dụ đã gặp: **ràng buộc Sperner** (Hệ quả 5.3) cho mô hình MIN. Các cận dưới mạnh nhất trong lý thuyết (Dyachkov–Rykov) thuộc tầng này.

## 7.2. 🎓 Vì sao đếm không bao giờ đủ: hiệu ứng "sinh nhật"

Đây là lập luận đẹp và quan trọng, giải thích **định lượng** khoảng trống 19 ↔ 49.

**Bài toán:** ta cần một mã ngẫu nhiên n bit cho N chai sao cho **mọi** cặp trong C(N,2) cặp có hợp khác nhau. Đây là đòi hỏi kiểu **"hàm băm hoàn hảo"**, và bài toán sinh nhật nói rằng nó đắt hơn phép đếm rất nhiều.

**Tính toán (mô hình MAX/MIN, r = 1, d = 2, mã ngẫu nhiên mật độ t):**

Trường hợp xấu nhất là hai cặp **chia sẻ một chai**: {i,j} và {i,k}. Ta cần MAX(i,j) ≠ MAX(i,k). Ở một thành phần, hai giá trị này **khác nhau** chỉ khi φ(i) = 0 và đúng một trong φ(j), φ(k) bằng 1:

P(khác) = (1−t) · 2t(1−t) = 2t(1−t)²

Số bộ ba cần lo: ≈ N³/2. Điều kiện "không trùng nào" (chặn hợp — *union bound*):

(1 − 2t(1−t)²)ⁿ · N³/2 < 1

**Tối ưu t:** đạo hàm 2t(1−t)² → t = 1/3, giá trị 8/27 ≈ 0,296.

**Kết quả với N = 1000:** n > ln(5·10⁸)/0,3514 ≈ **57**, tức

> ### n ≈ 5,7 · log₂N   (so với cận dưới đếm 2 · log₂N)

**Hệ số mất mát ≈ 2,9.** Bảng đầy đủ (đã tính bằng máy):

| Mật độ t | P(khác) mỗi thành phần | n cần | Hệ số so với log₂N |
|:---:|:---:|:---:|:---:|
| 0,50 | 0,2500 | 70 | 7,0 |
| 0,60 | 0,2880 | 59 | 5,9 |
| **2/3** | **0,2963** | **57** | **5,7** ← tối ưu |
| 0,707 | 0,2929 | 58 | 5,8 |

**So sánh với thực tế:**

| Phương pháp | Số tù nhân (N = 1000, d = 2, 1 ngày) | Hệ số |
|:---|:---:|:---:|
| Cận dưới đếm | 19 | 2,0 |
| Bậc lý thuyết Θ(d²logN/log d) | ~40 | ~4,0 |
| **Kautz–Singleton GF(7)** *(cho 2401 chai)* | **49** | **4,4** |
| Mã ngẫu nhiên (tính ở trên) | 57 | 5,7 |
| Lưới hàng/cột/chéo *(cho 1024 chai)* | 96 | 9,6 |

> 💡 **Bài học:** cấu trúc đại số (Reed–Solomon) **đánh bại** ngẫu nhiên (49 < 57), và cả hai đều xa cận dưới đếm. Hằng số tối ưu chính xác cho d = 2 **vẫn là vấn đề mở**.

## 7.3. Tổng kết khoảng trống thích ứng

| Số vòng r | Bảng chữ cái | Bit/người | 1000 chai, d=2, cận dưới | Thực tế đạt được |
|:---:|:---:|:---:|:---:|:---|
| 1 | 2 | 1,00 | 19 | **49** (KS, cho 2401 chai) |
| 2 | 3 | 1,58 | 12 | **18** (Timbo) |
| 3 | 4 | 2,00 | 10 | ? |
| 9 | 10 | 3,32 | 6 | ~27 người thử *(dberm22, 10 ngày)* |
| ∞ (thích ứng) | — | — | 19 phép thử | 19 phép thử ✅ **đạt** |

Đọc bảng này theo hai chiều cho hai bài học đối lập:

1. **Theo hàng:** thêm vòng thì cận dưới giảm — nhưng chỉ theo log(r+1), rất chậm.
2. **Theo cột "thực tế":** thêm vòng thì **khoảng trống thu hẹp mạnh** (49 → 18 → thích ứng đạt cận). Đây mới là nguồn lợi ích thật.

> ### 🔑 Nguyên lý trung tâm của cả chuỗi bài
>
> **Số vòng thử không mua thêm nhiều thông tin — nó mua khả năng *nhắm*.**
>
> Cận dưới đếm gần như không quan tâm ta có mấy vòng (19 → 12, chỉ giảm 37%). Nhưng **khả năng đạt được** thì thay đổi hoàn toàn (49 → 18, giảm 63%; thích ứng thì đạt luôn cận). Vòng thử không làm bài toán chứa nhiều thông tin hơn — nó cho phép ta **không phải phòng mọi trường hợp cùng lúc**.

## 7.4. Bài tập Bài 7

1. Làm lại tính toán §7.2 cho N = 10.000. Hệ số trước log₂N thay đổi thế nào? Giải thích.
2. Với các cặp **rời nhau** {i,j} và {k,l}, tính P(hợp trùng nhau) mỗi thành phần khi t = 1/2. Vì sao trường hợp "chia sẻ một chai" mới là trường hợp quyết định?
3. 🎓 Dựng một lập luận đối phương (tầng 2) cho mô hình MIN, d = 2, r = 1, cho cận dưới tốt hơn 19.
4. 🎓 Trong bảng §7.3, hãy tìm một chiến lược 3 vòng cho 1000 chai và điền vào dấu "?".

---
---

# BÀI 8 — CÁC NHÁNH MỞ RỘNG VÀ ỨNG DỤNG THẬT

## 8.1. Xét nghiệm gộp có ngưỡng (*threshold group testing*)

**Mô hình (Damaschke 2006):** phép thử dương tính nếu nhóm chứa **≥ u** phần tử xấu, âm tính nếu **≤ ℓ**, và **tùy ý** nếu ở giữa (vùng "mờ").

- u = 1, ℓ = 0 → mô hình MAX quen thuộc
- u = d, ℓ = d−1 → mô hình MIN (độc phức hợp) của chúng ta!

Nên hai mô hình chính của chuỗi bài này là **hai đầu mút** của một phổ liên tục. Kết quả tổng quát: cần Θ(d log N) phép thử khi không có vùng mờ; có vùng mờ thì một số phần tử **không thể** xác định được.

## 8.2. Tìm kiếm khi câu trả lời có thể sai (*Rényi–Ulam*)

**Đề bài:** đoán một số trong 1..N bằng câu hỏi có/không, nhưng đối phương được **nói dối** k lần.

**Định lý (Berlekamp; Spencer; Pelc).** *Cận dưới kiểu Berlekamp:*

2ⁿ ≥ N · Σ_{i=0}^{k} C(n, i)

Và đây **chính là cận Hamming của mã sửa lỗi**! Bài toán tìm kiếm có nhiễu ⟷ mã sửa k lỗi. Đây là một trong những cầu nối đẹp nhất giữa lý thuyết tìm kiếm và lý thuyết mã.

*Ứng vào bài của ta:* nếu một tù nhân có thể "chết vì lý do khác" (nhiễu), thiết kế phải có dư thừa sửa lỗi.

## 8.3. Không biết d

Nếu số chai độc không biết trước, |H| = Σ_d C(N,d), và các thuật toán phải **ước lượng d trước** (dùng O(log N) phép thử) rồi mới chạy. Kết quả: chỉ đắt thêm một lượng cộng tính O(log N).

## 8.4. Người thử bị "nhiễm" — đặc thù của bài toán chai rượu

Đây là nét mà xét nghiệm gộp cổ điển **không có**, và là phần thú vị riêng của họ bài toán này:

| Hiện tượng | Hệ quả |
|:---|:---|
| Người thử **chết** → mất hẳn | Vòng sau còn ít người hơn |
| Người thử đã nạp **một** thành phần | Bị "nhiễm" nhưng **vẫn dùng được** |
| Ta **biết** anh ta nhiễm thành phần nào | Xếp anh ta vào nhóm nào dù sao cũng phải nạp thành phần đó |

Điểm thứ ba là một quan sát tinh tế (do goldPseudo nêu và user2357112 trả lời trong thảo luận gốc): **nhiễm không phải mất mát nếu ta biết nhiễm cái gì.** Đây là lý do các lời giải tốt tái sử dụng được người sống sót của ngày 1.

## 8.5. Ứng dụng thực tế

| Lĩnh vực | Bài toán | Mô hình |
|:---|:---|:---|
| **Xét nghiệm y tế gộp** | COVID-19, HIV, sàng lọc máu | MAX (OR) |
| **Sinh học phân tử** | Sàng lọc thư viện DNA/clone | MAX, d-tách rời |
| **Nén tín hiệu** (*compressed sensing*) | Khôi phục tín hiệu thưa | SUM (tuyến tính) |
| **Mạng máy tính** | Định vị nút lỗi, đo lưu lượng | MAX / SUM |
| **Tương tác thuốc** | Tìm cặp thuốc gây phản ứng | **MIN — đúng bài của ta!** |
| **Kiểm thử phần mềm** | Tìm tổ hợp cấu hình gây lỗi | MIN / ngưỡng |

> 🎯 Mô hình MIN (độc phức hợp) **không** chỉ là câu đố. Nó là mô hình chuẩn cho việc tìm **tương tác** — những lỗi chỉ xuất hiện khi **đồng thời** nhiều điều kiện. Trong kiểm thử phần mềm, đây gọi là *combinatorial interaction testing*.

## 8.6. Bài tập Bài 8

1. Trong xét nghiệm gộp COVID với tỉ lệ dương tính 1%, cỡ nhóm tối ưu là bao nhiêu để giảm số xét nghiệm nhiều nhất? *(Gợi ý: đây là chiến lược Dorfman hai tầng.)*
2. Cho N = 1000, k = 1 lời nói dối. Áp cận Berlekamp để tìm số câu hỏi tối thiểu.
3. 🎓 Mô hình hoá bài toán "tìm cặp cấu hình gây lỗi trong 100 tuỳ chọn nhị phân" theo khung Bài 5. Bảng chữ cái, ⊗, và |H| là gì?

---
---

# BÀI 9 — BẢNG TRA, BÀI TẬP TỔNG HỢP, VẤN ĐỀ MỞ

## 9.1. 📋 Bảng tra chủ lực

### Công thức cần nhớ

> **Cận dưới:**  n ≥ log_{r+1} C(N, d)
>
> **d = 1:** đạt được chính xác — n = ⌈log_{r+1} N⌉
>
> **d ≥ 2, không thích ứng:** Θ(d² log N / log d) *(MAX/MIN)* hoặc Θ(d log N / log d) *(SUM)*
>
> **d ≥ 2, thích ứng:** Θ(d log N) — đạt cận dưới đếm

### N = 1000, kết quả đầy đủ

| d | Mô hình | r = 1 ngày | r = 2 ngày | Thích ứng |
|:---:|:---|:---|:---|:---|
| 1 | bất kỳ | **10** ✅ đạt | **7** ✅ đạt | 10 phép thử ✅ |
| 2 | MAX | ≥19; KS cho ~49 | ≥12 | ~19 phép thử ✅ |
| 2 | MIN *(bài gốc)* | ≥19; KS cho ~49 | ≥12; **18** *(tốt nhất biết)* | ~19 phép thử ✅ |
| 2 | SUM | ≥10 | ≥7 | ~10 phép thử |
| 3 | MAX/MIN | ≥28 | ≥18 | ~28 phép thử |

### Với 20 tù nhân thì xử lý được bao nhiêu chai? (d = 2, cận trên lý thuyết)

| Số ngày | Cơ số | C(N,2) ≤ | N tối đa |
|:---:|:---:|---:|---:|
| 1 | 2 | 1.048.576 | **1.448** |
| 2 | 3 | 3.486.784.401 | **83.508** |
| 3 | 4 | 1,0995·10¹² | ~1.483.000 |

## 9.2. 🎯 Bài tập tổng hợp

**Mức cơ bản**

1. 512 chai, 1 chai độc, 1 ngày. Bao nhiêu tù nhân? Đúng bằng cận dưới không?
2. 1 chai độc, 4 tù nhân, 3 ngày. Số chai tối đa?
3. Chứng minh: nếu một chai có từ mã toàn 0 trong mô hình MIN với d = 2 và N ≥ 3, thì mã không hợp lệ.

**Mức trung bình**

4. Dựng đầy đủ mã Kautz–Singleton GF(5), ℓ = 5, k = 3 (125 chai, 25 tù nhân, d = 2). Viết ra ma trận và kiểm tra tính 2-tách rời cho vài trường hợp.
5. Áp Định lý đối ngẫu 4.2 để biến bài 4 thành lời giải cho độc phức hợp. Mỗi tù nhân uống bao nhiêu chai?
6. So sánh: 1000 chai, d = 2. (a) 1 ngày, mô hình MAX. (b) 2 ngày, mô hình MAX. (c) 2 ngày, mô hình MIN. Tính cận dưới cho cả ba và giải thích vì sao (a) và (c) có cùng cấu trúc tổ hợp nhưng khác nhau về vận hành.
7. Lời giải 24 tù nhân ở tài liệu kèm dùng danh sách 707 chai. Nếu đổi sang mô hình MAX (độc thường), con số tương ứng là bao nhiêu? *(Gợi ý: giải 1−(1−t)² = 1/2.)*

**Mức nâng cao 🎓**

8. Chứng minh Định lý 3.5 (tiêu chí d·a < ℓ) và tìm ví dụ cho thấy điều kiện này **không** cần thiết (tức có mã d-tách rời với d·a ≥ ℓ).
9. Chứng minh ràng buộc Sperner (Hệ quả 5.3) và dùng nó cải thiện cận dưới 12 → 13 cho bài 1000 chai / 2 thành phần / 2 ngày.
10. Tính tường minh hằng số ngẫu nhiên hoá cho mô hình MIN với **r = 2** (bảng chữ cái 3 ký hiệu), tương tự §7.2. Kết quả nên nằm giữa 12 và 18.
11. Chứng minh Định lý 4.5 (chia đôi cân bằng với |T| = N/√2) và tổng quát cho d bất kỳ. *(Gợi ý: cần C(tN, d) = C(N,d)/2 → t ≈ 2^{−1/d}.)*
12. Thiết lập và chứng minh phiên bản Định lý bảng chữ cái 2.1 cho trường hợp chất độc giết sau **đúng m ngày** kể từ khi nạp đủ.

## 9.3. ❓ Vấn đề mở

| # | Vấn đề | Trạng thái |
|:---:|:---|:---|
| 1 | **1000 chai, 2 thành phần, 2 ngày: đáp số chính xác?** | Biết 12 ≤ n ≤ 18 |
| 2 | Hằng số tối ưu c trong "mã 2-phân ly cần c·log₂N" | Biết 2 ≤ c ≤ 4,4 |
| 3 | Có mã MIN 2 ngày nào đạt hiệu suất > 50% không? | Chưa biết |
| 4 | Đánh đổi vòng–kích thước tối ưu cho r vòng cố định, d ≥ 2 | Chỉ có kết quả tiệm cận |
| 5 | Cận dưới cho mô hình MIN khai thác ràng buộc Sperner một cách hệ thống | Chưa được nghiên cứu kỹ |

## 9.4. 📚 Đọc thêm

**Sách nền tảng**
- Du & Hwang, *Combinatorial Group Testing and Its Applications* — sách chuẩn của lĩnh vực
- Du & Hwang, *Pooling Designs and Nonadaptive Group Testing*
- Aigner, *Combinatorial Search* — trình bày lý thuyết tìm kiếm rất dễ tiếp cận

**Các mốc lịch sử**
- Dorfman (1943) — bài báo khai sinh xét nghiệm gộp
- Kautz & Singleton (1964) — mã chồng chập, cấu trúc ở §3.6
- Erdős & Rényi (1963), Lindström (1964) — bài toán cân tiền xu
- Dyachkov & Rykov (1982) — cận dưới cho họ d-tách rời
- Hwang (1972) — thuật toán chia đôi nhị phân tổng quát
- Damaschke (2006) — xét nghiệm gộp có ngưỡng

**Khảo sát hiện đại**
- Aldridge, Johnson & Scarlett, *Group Testing: An Information Theory Perspective* (2019)

---
---

# 🎓 TỔNG KẾT: BẢY Ý TƯỞNG MANG THEO

1. **Đếm trước, dựng sau.** Mọi bài toán loại này bắt đầu bằng: đếm số giả thuyết |H|, đếm số tín hiệu mỗi người thử cho, rồi áp |A|ⁿ ≥ |H|.

2. **Cái chết là tín hiệu dùng một lần.** r vòng cho r+1 tín hiệu mỗi người thử, **không** phải 2^r. Đây là điều làm bài "tù nhân" khác với xét nghiệm gộp cổ điển.

3. **Đảo góc nhìn: gán mã cho đối tượng, đừng gán nhóm cho người thử.** Khi đó "quan sát được" trở thành một **toán tử tổng hợp** áp lên các từ mã, và bài toán câu đố biến thành bài toán tổ hợp cực trị.

4. **MAX và MIN đối ngẫu nhau về mã, nhưng không đối ngẫu về thời gian.** Không thích ứng thì hai bài toán y như nhau; nhiều vòng thì khác hẳn, vì phép đảo bảng chữ cái đảo luôn trục thời gian.

5. **Lũy đẳng là kẻ thù.** max và min mất thông tin số lượng, nên đắt Θ(d²logN/log d). sum giữ được, nên chỉ Θ(d logN/log d).

6. **Vòng thử mua khả năng nhắm, không mua thông tin.** Cận dưới hầu như không đổi khi thêm vòng; nhưng khả năng **đạt** được cận thì thay đổi hoàn toàn. Đây là hiện tượng "khoảng trống thích ứng", mở ra đúng tại d = 2.

7. **Đại số đánh bại ngẫu nhiên.** Reed–Solomon qua Kautz–Singleton cho 49 tù nhân / 2401 chai, tốt hơn mã ngẫu nhiên (57) và tốt hơn nhiều so với cấu trúc trực quan kiểu lưới (96 cho 1024 chai).

---

*Tài liệu này là bài giảng tự soạn. Các con số đều được kiểm chứng bằng máy tính: cấu trúc Kautz–Singleton GF(7) đã được vét cạn toàn bộ 2.881.200 cặp để xác nhận tính 2-phân ly.*
