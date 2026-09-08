# Tìm chất độc phức hợp trong các chai rượu — bản tiếng Việt đầy đủ

**Nguồn:** [Puzzling Stack Exchange, câu hỏi #12770](https://puzzling.stackexchange.com/questions/12770/find-the-composite-poison-in-the-wine-bottles)
**Giấy phép:** CC BY-SA 4.0 — bản tiếng Việt này là tác phẩm phái sinh, phát hành lại dưới cùng giấy phép.
**Ghi công:** câu hỏi của **user88** (Joe Z.), biên tập bởi **Ian MacDonald**. Mỗi câu trả lời và bình luận đều được ghi tên tác giả gốc ở dưới.

> Đây là bản **trình bày lại bằng tiếng Việt** toàn bộ nội dung trang gốc: đề bài, 25 bình luận dưới câu hỏi, 9 câu trả lời và 67 bình luận dưới các câu trả lời. Nội dung, con số và lập luận được giữ nguyên; cách diễn đạt là tiếng Việt tự nhiên chứ không dịch máy từng chữ.
>
> Lời giải độc lập của riêng chúng ta nằm ở file [bai-toan-doc-ruou-2-thanh-phan.md](bai-toan-doc-ruou-2-thanh-phan.md).

---

# 📜 ĐỀ BÀI

*(tác giả: **user88**, biên tập: **Ian MacDonald**)*

Bạn là người trị vì một vương quốc thời trung cổ và rất thích tổ chức tiệc. Gã cận thần từng tìm cách [đầu độc một trong những chai rượu của bạn](https://puzzling.stackexchange.com/questions/410/how-do-you-solve-a-word-puzzle-when-you-have-no-idea-where-to-start) lần trước đã tức tối khi biết rằng bạn xác định được chính xác chai nào bị hắn tẩm độc trong số 1.000 chai, mà chỉ cần mười tù nhân.

Lần này hắn tinh vi hơn. Hắn chế ra một loại **chất độc phức hợp** *P*: một dung dịch hai thành phần, chỉ gây tử vong khi hai thành phần — mà riêng lẻ thì đều vô hại — được trộn lẫn; tương tự cách [keo epoxy](https://en.wikipedia.org/wiki/Epoxy) hoạt động. Hắn gửi cho bạn một thùng khác gồm 1.000 chai rượu. Một chai chứa thành phần *Cₐ* và một chai khác chứa thành phần *C_b*. (*P* = *Cₐ* + *C_b*)

Bất kỳ ai uống **cả hai** thành phần sẽ chết vào **đúng nửa đêm của cái đêm mà họ uống thành phần cuối cùng**, bất kể uống vào thời điểm nào trong ngày. Mỗi thành phần độc **lưu lại trong cơ thể** cho đến khi thành phần thứ hai kích hoạt nó; vì vậy nếu uống một thành phần vào một ngày và thành phần còn lại vào ngày hôm sau, bạn sẽ chết vào nửa đêm cuối ngày thứ hai.

Bạn có **hai ngày** trước buổi tiệc kế tiếp. Số tù nhân **tối thiểu** bạn cần dùng để thử nghiệm nhằm xác định hai chai bị tẩm độc là bao nhiêu, và bạn cần theo thuật toán nào với số tù nhân đó?

## Câu hỏi thưởng

Ngoài ra, giả sử bạn bị giới hạn cố định ở **20 tù nhân**, thì về mặt lý thuyết, số chai **tối đa** bạn có thể thử nghiệm mà vẫn kết luận chính xác được những chai nào bị nhiễm độc là bao nhiêu?

> *Ghi chú của người đặt câu hỏi: Tôi thực ra không biết đáp án của bài toán này, nhưng thấy sẽ thú vị khi nghĩ về cách biểu diễn chính thông tin đó.*

---

# 💬 BÌNH LUẬN DƯỚI CÂU HỎI

*(25 bình luận, xếp theo thời gian)*

**Ian MacDonald** (15 điểm) — Vì tôi là ông vua tiết kiệm, tôi sẽ giới hạn mỗi người chỉ được uống một chai. Thế là không ai bị đầu độc cả! :)

**justhalf** — Hay đấy, cách đó né luôn được việc phải đi tìm chất độc, haha. Joe, nhiệm vụ là tìm ra hai chai độc A và B sau nửa đêm thứ hai, đúng không?

**DevSolar** — Nếu gã cận thần đó nghĩ tôi sẽ uống hết 1.000 chai rượu trong khoảng thời gian có ích cho hắn thì hắn điên rồi. :-D

**Engineer Toast** (2 điểm) — Vậy là ta không cần lo chuyện thử nghiệm sẽ làm cạn kho rượu? Kể cả dùng pipet lấy lượng nhỏ nhất, thì tại sao gã cận thần này vẫn còn được tự do? Hắn đã cố giết bạn! Bắt hắn lại và cho hắn uống một chai mỗi ngày cho tới chết.

**leoll2** — Thế nếu tù nhân bị sặc chết vì uống 1.000 loại nước thì sao?

**user88** — Mỗi tù nhân chỉ được cho một lượng mẫu cực nhỏ thôi.

**KSmarts** (8 điểm) — Nói về thực tế, nếu chất độc chỉ nguy hiểm khi hai thành phần trộn vào nhau, thì bạn **chỉ cần xác định một trong hai chai** là đã an toàn.

**user88** — Cũng đúng, nhưng chẳng ai muốn uống một chai đã bị nhiễm bẩn. Và câu hỏi này thiên về thông tin hơn là về hoàn cảnh thực tế.

**dberm22** — Dùng lý thuyết nhị phân và **nới lỏng ràng buộc thời gian**, lời giải tốt nhất về lý thuyết chỉ cần **27 lần thử** (không tính việc tái sử dụng người thử) và **10 ngày** (9 ngày thử + 1 ngày lấy kết quả ngày 9). Mỗi ngày dùng 3 người để cắt tập hợp đi một nửa. Ngày đầu: người 1 uống chai 1–500, người 2 uống 501–1000, người 3 uống 250–749. Sau 9 ngày loại một nửa mỗi lần, còn lại 2 chai chứa thành phần A và B. Hay hơn nữa: về lý thuyết **không ai phải chết**, dù khả năng đó cực kỳ mỏng.

**cjm** (1 điểm) — Cái này gọi là "**độc nhị phân**" (*binary poison*). Nhiều loại epoxy là hai thành phần, nhưng đó không phải đặc tính định nghĩa của epoxy — có cả epoxy một thành phần.

**user88** (2 điểm) — Tôi biết thuật ngữ chưa chính xác; tôi dùng "epoxy" để gợi hình ảnh "hai thành phần trộn vào nhau tạo ra hợp chất có hiệu lực", vì phần lớn mọi người không biết *binary poison* là gì, còn keo epoxy thì mang tính biểu tượng hơn.

**user88** — Mà Ian MacDonald có vẻ đã sửa phần đề bài cho khớp rồi; tôi thấy ổn.

**Random832** — Về câu "giả sử bạn có giới hạn 20 tù nhân, tối đa thử được bao nhiêu chai" — bạn **thử được hết tất cả** các chai; vấn đề chỉ là số chai tối thiểu bạn có thể loại ra thì lớn hơn hai.

**Ian MacDonald** — @Random832 tôi đã sửa đề chính xác hơn để đáp án thú vị, chứ không phải chỉ là "hết tất cả, đương nhiên". Joe Z., xin lỗi nếu tôi làm quá; tôi đã bắt đầu sửa từ trước khi đọc thấy các bình luận về epoxy.

**Random832** — Tôi nghĩ câu hỏi thú vị hơn là bạn **loại ra được ít nhất bao nhiêu chai**. Còn việc loại chúng bằng cách bỏ ra ngay từ đầu hay bằng cách dùng hết khả năng thử nghiệm chỉ là chi tiết triển khai.

**user88** — @IanMacDonald không sao, cảm ơn vì đã sửa.

**ColBeseder** (1 điểm) — @IanMacDonald giới hạn mỗi người một chai chỉ dùng được **một lần**. Có lẽ bạn đã dùng cách đó lần trước rồi.

**Vincent** — Chỉ có đúng 2 chai, một chứa A và một chứa B? Hay có x chai chứa A và x chai chứa B?

**Ian MacDonald** — @Vincent đúng như đề nói: "Một chai chứa thành phần *Cₐ* và một chai khác chứa thành phần *C_b*."

**Ian MacDonald** — @ColBeseder ý bạn là đùa rằng khách dự tiệc từng đến các buổi khác sẽ biết luật và tìm cách lách, hay bạn cho rằng giới hạn mỗi khách một chai (tức loại bỏ hoàn toàn khả năng trộn độc nhị phân) vẫn giết được một khách?

**starsplusplus** — @IanMacDonald tôi nghĩ Col đang nhắc tới chi tiết **thành phần độc nằm mãi trong người** cho tới khi bạn uống thành phần thứ hai, nên cách đó chỉ dùng được cho một buổi tiệc.

**ghosts_in_the_code** — Câu hỏi này (trên Stack Overflow) có thể chứng minh được con số tối thiểu một lần cho mãi mãi.

**user88** — Tôi nghĩ có thể nói rằng tôi đã tạo ra một câu đố khó ngang với bài về các điệp viên. :)

**Hemant Agarwal** — Ai muốn thì có thể thử câu rất tương tự này trên Mathematics Stack Exchange.

**Dmitry Kamenetsky** — Bài này khác gì so với bài "tìm 2 chai độc trong 1000 chai"?

---

# ✅ CÂU TRẢ LỜI 1 — ĐƯỢC CHẤP NHẬN

**Tác giả: Timbo** · **17 điểm** · **Kết quả: 20 tù nhân → cải tiến còn 18**

## Ngày thứ nhất

Dùng **10 cặp tù nhân**, đánh số `0.0, 0.1, 1.0, 1.1, 2.0, …, 9.0, 9.1`.

Tù nhân `a.b` uống mọi chai có **bit thứ a của số hiệu chai bằng b**, tức mọi chai thoả:

⌊index / 2^a⌋ mod 2 = b

Sau nửa đêm, có những cặp **một người sống**, và có những cặp **cả hai người sống**.

Xét một cặp *m* bất kỳ **có hai người sống**. Khi đó `m.0` đã uống đúng **một** thành phần độc, và `m.1` đã uống **thành phần còn lại** — nếu không thì một trong hai đã chết. Gọi:

- **x** = chai độc mà `m.0` đã uống
- **y** = chai độc mà `m.1` đã uống

Đặt xᵢ, yᵢ là bit thứ i của x và y. Khi đó:

- `a.0` chết ⟺ xₐ = 0 **và** yₐ = 0
- `a.1` chết ⟺ xₐ = 1 **và** yₐ = 1
- → **cả hai sống ⟺ xₐ XOR yₐ = 1**

Vậy nếu đặt s = tổng của 2^i với những cặp *i* mà **cả hai người sống** thì ta có:

> **Hệ quả 1: s = x XOR y**

*(Chứng minh: s = Σ 2^i × (xᵢ XOR yᵢ) = x XOR y.)*

## Ngày thứ hai

Mọi tù nhân thuộc các cặp **có hai người sống** đều phải uống **đúng những chai mà `m.1` đã uống ở ngày 1**. Việc này sẽ giết một người trong mỗi cặp như thế.

> **Hệ quả 2: Không ai uống chai x vào ngày 2.**
>
> *(Chứng minh: ngày 2 chỉ uống đúng phần của `m.1`, và `m.1` đã uống y — theo định nghĩa — nên vẫn còn sống.)*

Với mỗi cặp có 4 trường hợp:

| Sự kiện | Suy ra |
|:---|:---|
| `a.0` chết **ngày 1** | xₐ = 0 |
| `a.1` chết **ngày 1** | xₐ = 1 |
| `a.0` chết **ngày 2** | anh ta đã uống x ở ngày 1 (Hệ quả 2) → xₐ = 0 |
| `a.1` chết **ngày 2** | anh ta đã uống x ở ngày 1 (Hệ quả 2) → xₐ = 1 |

Gộp lại: **`a.1` chết ⟺ xₐ = 1** (bất kể chết ngày nào).

## Kết quả

Đọc từng bit của x:

x = Σᵢ 2^i × (1 nếu tù nhân `i.1` chết, 0 nếu tù nhân `i.0` chết)

Và từ Hệ quả 1, chai độc còn lại: **y = x XOR s**

**Dùng 20 tù nhân, 10 người sống sót.** Có thể cải thiện thành 20 tù nhân / 11 người sống bằng cách không bắt `m.0` uống thứ mà ta đã biết chắc sẽ giết anh ta.

**Cập nhật: 18 tù nhân, 8 người sống.** Thuật toán y như trên nhưng **không dùng** cặp `0.0` và `0.1`; thay vào đó `m.0` và `m.1` làm luôn việc của họ (hai người này chưa uống gì mâu thuẫn).

### 💬 Bình luận dưới câu trả lời này

**user2357112** — Rất hay. Có thể nâng tỉ lệ sống bằng cách chỉ cho **một** người trong mỗi cặp uống ở ngày 2, dù điều đó không cải thiện trường hợp xấu nhất. Cũng nên nói rõ: cặp *m* (có hai người sống) **chắc chắn tồn tại**, vì hai chai độc phải khác nhau ở ít nhất một bit.

**JonTheMon** — À, làm bản đồ bit ngày đầu kèm cả bản nghịch đảo, để bảo đảm hoặc có 2 người sống (chia thành 2 tập) hoặc xác định được giá trị của từng bit. Vậy lượng rượu tối đa thử được là 2^(n/2)?

**user88** *(người đặt câu hỏi)* — Lời giải của bạn có vẻ là tốt nhất hiện tại; tôi sẽ đổi nếu có ai hạ được con số này.

**user88** — Tôi đã kiểm tra công thức mới của bạn và nó đúng với n = 0. :P

---

# CÂU TRẢ LỜI 2

**Tác giả: Collett89** · **15 điểm** · **Kết quả: 1000 → 500 → 116 → 86 → 62 → 45 (cải tiến dần)**

## Lời giải đơn giản: 1000 tù nhân, 998 người chết

Đánh số cả tù nhân và chai từ 1 đến 1000. Mỗi tù nhân uống từ **TẤT CẢ các chai trừ chai trùng số của mình**.

**Hai người sống sót chính là số hiệu hai chai độc.**

*(Lưu ý: rượu có thể bị hụt kha khá vì 999 người đều nếm qua.)*

Cũng có thể bỏ bớt tù nhân cuối và suy luận: nếu chỉ một người sống thì chai còn lại chính là chai độc thứ hai.

## 500 tù nhân, 499 người chết

Mở rộng cách trên: 500 tù nhân, mỗi người uống 998 chai (người 1 bỏ chai 1 và 2, người 2 bỏ chai 3 và 4, …). Kết quả: hoặc 499 người chết và biết chính xác tổ hợp, hoặc 498 người chết và còn 4 chai để chọn (biết là 1 trong {1,2} và 1 trong {3,4}).

Sau đó cho những người còn sống uống **một** trong các chai họ chưa từng uống — chết thì chai đó độc, sống thì không.

## Mở rộng 2 — 116 tù nhân, 114 chết

Lấy 20 tù nhân. Người thứ 1 **bỏ** chai 0–100, người thứ 2 bỏ 50–150, … (người cuối bỏ 950–1000 và 0–50), tức các cửa sổ chồng lấn nhau 50 chai.

Trường hợp xấu nhất còn 4 người sống → cho ta 2 khoảng 50 chai, tức 100 chai cần khoanh tiếp.

Thêm 96 tù nhân mới vào 4 người sống sót, đánh số 0–100 (và chai 0–100), sao cho 4 người "may mắn" kia vẫn bỏ đúng những chai họ đã bỏ trước đó. Hai người sống cuối cùng chỉ ra hai chai độc.

## Mở rộng 3 — 86 tù nhân, 84 chết

*(Tôi viết một hàm JavaScript nhỏ để tìm điểm tối ưu của phương pháp này.)*

Như trên nhưng 40 tù nhân, mỗi người bỏ 50 chai (chồng lấn 25 chai với người cuối). Xấu nhất còn 4 người sống và một khoảng 50 chai → thêm 46 tù nhân để phủ hết 50 chai đó.

*Tôi cần một cách làm ngày 2 tốt hơn để cải thiện thêm.*

## Mở rộng 4 — 62 tù nhân, 60 chết

Nhận ra "trường hợp xấu nhất" giải được bằng khai triển nhị phân:

Vẫn 40 tù nhân bỏ 50 chai mỗi người (chồng lấn 25). Xấu nhất còn 4 người sống và **2 khoảng 25 chai** → chỉ cần thêm 6 tù nhân (cộng 4 người kia) dùng phương pháp nhị phân.

Nếu chỉ 2 người sống → một khoảng 25 chai → thêm 22 người và suy ra kết quả cuối.

## Mở rộng 5 — 45 tù nhân (nhờ @user2357112 trong phần bình luận)

**Ngày 1:** dùng 40 tù nhân như trên, nhưng mỗi người **uống 525 chai** (người 1 uống 0–525, người 2 uống 25–550, …).

- Nếu hai chất độc ở **hai nhóm khác nhau**: xấu nhất 20 người chết (khi độc ở các nhóm liền kề), còn lại 20 người — dư sức làm phương pháp nhị phân.
- Nếu **cả hai chất độc trong cùng một nhóm 25 chai**: 21 người chết.

### 💬 Bình luận dưới câu trả lời này

**justhalf** — Đây là hướng đi đúng. +1. Ít nhất giờ ta đã có một lời giải chạy được với cận trên 500 tù nhân.

**dberm22** — @Collett89 con số 64 rất ấn tượng! Nếu nới ràng buộc thời gian, lời giải tối ưu lý thuyết (tối ưu theo số người thử) là 27 người và 9 ngày, mỗi ngày 3 người để loại một nửa số chai. Xem bạn tiến được gần con số đó tới đâu với chỉ 2 ngày!

**user2357112** (1 điểm) — Tôi tin bạn giảm được thêm một tù nhân nữa nếu **thêm 24 chai nước** vào thùng và dùng 32 tù nhân, mỗi người bỏ 64 chai ở ngày 1.

**user2357112** (1 điểm) — Thực ra, thay vì thế, có cải tiến tốt hơn nhiều: **giảm số chai mỗi tù nhân uống ở ngày 1**. Mỗi người chỉ cần uống **525 chai**, vẫn chồng lấn 25, là đủ để xác định các nhóm 25 chai chứa độc. Số người chết phụ thuộc vào hai chai độc nằm gần nhau đến đâu; **trong trường hợp xấu nhất ta tái sử dụng được 19 người**.

**Collett89** — @user2357112 đúng là hướng suy nghĩ tôi đang muốn tới — càng nhiều người sống sót qua ngày 1 thì càng ít người phải thêm vào ngày 2.

**Timbo** — Cách mã hoá của tôi **cần ngày thứ hai** để tìm ra đáp án thật. Ví dụ trong lời giải của tôi, có 500 trường hợp không ai chết ở ngày 1. Nếu muốn làm xong trong một ngày, bạn sẽ cần cỡ **log(n)²** tù nhân thay vì 2·log(n).

**Collett89** — @Timbo đúng vậy… chứng minh đơn giản của tôi chưa xét việc **đổi chỗ các bit** của chai, nên những tổ hợp như [5,2] và [6,1] để lại **cùng một tập người chết**.

**Strikers** — Nếu nhiều tù nhân thế cùng uống thì còn gì cho buổi tiệc?

**Collett89** — Tuỳ lượng mỗi lần nếm và cỡ chai. Ở phương án cuối, phần lớn chai bị 21 người nếm. Nếu tính 1 ml mỗi lần thử và chai 750 ml thì không tệ. Nếu tôi là tù nhân phải uống rượu có thể có độc, tôi sẽ xin cả một ly đầy cho chắc.

---

# CÂU TRẢ LỜI 3

**Tác giả: user2357112** · **10 điểm** · **Kết quả: 124 tù nhân → 93**

Đây là chiến lược dùng **124 tù nhân**. Có lẽ vẫn tái sử dụng được một số người từ ngày 1 sang ngày 2 để giảm con số này, nhưng tôi muốn đăng một chiến lược đơn giản trước để người khác xây tiếp và tìm cách trình bày gọn hơn.

## Chuẩn bị

Để các con số tròn hơn, **thêm 24 chai nước** vào thùng → thử 1024 chai. Chia thành **32 nhóm × 32 chai**, đánh nhãn từ `1-1` đến `32-32`. Chia tù nhân thành **4 nhóm × 31 người**, đánh nhãn `A1` … `D31`.

## Ngày 1

Rót **32 cốc cocktail**, mỗi cốc pha rượu từ **mọi chai trong một nhóm**, đánh nhãn cocktail 1 đến 32.

- **Nhóm A:** mỗi người uống mọi cocktail **có nhãn ≤ số của mình**. Ví dụ A12 uống cocktail 1 đến 12.
- **Nhóm B:** mỗi người uống mọi cocktail **có nhãn > số của mình**. Ví dụ B12 uống cocktail 13 đến 32.

Từ việc ai chết, ta xác định **hai cocktail** (hoặc **một** cocktail) đã chứa độc:

| Quan sát | Kết luận |
|:---|:---|
| A13 sống, A14 chết | cocktail 14 có độc |
| B11 chết, B12 sống | cocktail 12 có độc |
| toàn bộ nhóm A sống | cocktail 32 có độc |

## Ngày 2

- **Nếu chỉ một cocktail có độc:** lặp lại đúng quy trình trên nhưng áp lên **các chai đã tạo nên cocktail đó**, dùng hai bộ tù nhân mới (nhóm C và D).
- **Nếu hai cocktail có độc:** mọi người nhóm **C** uống cocktail thứ nhất **cộng một chai đơn lẻ** thuộc cocktail thứ hai; mọi người nhóm **D** uống cocktail thứ hai **cộng một chai đơn lẻ** thuộc cocktail thứ nhất.

Cách nào cũng tìm ra hai chai độc.

## Hướng cải tiến

Tái sử dụng được **ít nhất 31 tù nhân**, hạ con số xuống **93**.

- Nếu chỉ một cocktail chứa độc: ta có 31 người chỉ uống các cocktail nằm **bên trái hoặc bên phải** nó → dùng lại được ngày 2.
- Nếu hai cocktail chứa độc: mọi người uống các cocktail bên trái "độc phải" và mọi người uống các cocktail bên phải "độc trái" đều sống — **ít nhất 32 người**. Một số người bị nhiễm sẵn một thành phần, nhưng **ta biết họ đang mang thành phần nào** (trái, phải, hay không có), nên có thể phân người mang "độc trái" vào đúng nhóm mà dù sao cũng phải uống "độc trái", và tương tự cho "độc phải".

### 💬 Bình luận dưới câu trả lời này

**justhalf** (1 điểm) — Hmm, nếu độc A và B ở hai nhóm khác nhau thì ngày 1 sẽ **không ai chết**, đúng không? Vậy tiếp tục thế nào? Nhớ rằng phải uống cả hai mới chết.

**Jiminion** — Có một chiến lược xét nghiệm trên đĩa microtiter dùng cách tiếp cận tương tự.

**user2357112** — @justhalf Không: nếu ngày 1 không ai chết thì độc ở **cocktail 1 và 32**. Tù nhân không chỉ uống một cocktail.

**justhalf** — À đúng, trước đó tôi hình dung sai quy trình.

---

# CÂU TRẢ LỜI 4

**Tác giả: The Pyrate** · **5 điểm** · **Kết quả: 499.500 tù nhân, chỉ 1 người chết**

Với phần đầu: bạn **chỉ phải hy sinh một tù nhân**.

Lấy tất cả tổ hợp 2 chai: C(1000, 2) = **499.500**. Vậy lấy 499.500 tù nhân, mỗi người uống một giọt từ **một tổ hợp hai chai khác nhau**. Cho mỗi người một chiếc vòng tay ghi số hiệu hai chai mà anh ta đã uống.

Nửa đêm, **đúng một** tù nhân sẽ chết, và ta biết ngay hai chai nào bị tẩm độc.

### 💬 Bình luận dưới câu trả lời này

**user66554** (1 điểm) — Đề hỏi *"phải hy sinh"*, tức bao nhiêu người cần uống. Ở đó bạn dùng ít hơn 499.500 vẫn được (nhưng khi đó sẽ chết nhiều hơn một người — tôi nghĩ trung bình một nửa số người được thử, tức 6–7 người).

**Lawrence** — Cách này có vẻ không thu hẹp đủ khả năng. Hai thành phần có thể được uống trong hai mẫu riêng, mỗi mẫu chỉ chứa một thành phần. Mỗi tù nhân uống khoảng 500 chai, nên khá nhiều người sẽ nạp cả hai thành phần.

**Bobson** — @Lawrence bạn đọc sai rồi. Mỗi tù nhân **chỉ uống đúng hai chai**. Nên chỉ một người duy nhất trúng tổ hợp chết người — nhưng bạn cần rất nhiều người để rải hết các cặp.

**justhalf** — Đây sẽ là đáp án đúng nếu câu hỏi không hỏi về **số tù nhân tối thiểu**. Nhưng ít nhất ta có được cận trên =) (thực ra dùng 499.499 là đủ, bỏ ra một tổ hợp, vì nếu không ai chết thì ta biết luôn tổ hợp đó là tổ hợp chết người, hehe).

**KSmarts** (10 điểm) — Nếu bạn có gần nửa triệu tù nhân để đi thử độc, thì chẳng lạ gì việc có người muốn giết bạn.

**user88** — @KSmarts ý tôi thật sự là **số tù nhân cần dùng để thử nghiệm**, không phải số người tối thiểu phải chết; nếu bạn không thích cách diễn đạt "phải hy sinh" thì tôi sẽ sửa.

**user88** — Được rồi, tôi đã sửa cách diễn đạt; câu trả lời này giờ không còn tối ưu ngay cả về mặt kỹ thuật cho trường hợp đó nữa.

**user88** (1 điểm) — Và nhà vua chắc chắn không có sẵn 500.000 tù nhân; vì thế mới phải đi tìm lời giải tối thiểu.

**Alexander** — @KSmarts nếu bạn giết hàng trăm tù nhân mỗi ngày thì chẳng lạ gì có người muốn giết bạn.

---

# CÂU TRẢ LỜI 5

**Tác giả: Cubicon** · **4 điểm** · **Kết quả: 35 tù nhân (trường hợp xấu nhất), 20 (tốt nhất)**

Lời giải tốt nhất tôi tìm được cho tới giờ thử **35 tù nhân trong trường hợp xấu nhất**. Cách dựng giống các câu trả lời trước, nhưng thay vì chia 1000 chai thành 4 nhóm 250, tôi chia thành **8 nhóm 125 chai**. Việc này giảm số tù nhân từ 39 xuống 35.

## Ngày 1

Chia chai thành 8 nhóm, mỗi nhóm 125 chai. Lấy 8 tù nhân, mỗi người uống **7 trong 8 nhóm** (người 1 uống tất cả trừ nhóm 1, v.v.). Sau đó ta còn hai kịch bản cho ngày 2.

## Ngày 2 — Kịch bản 1: **2 người sống**

Nghĩa là **2 trong 8 nhóm, mỗi nhóm chứa một chai độc**. Gọi hai nhóm đó là **A** và **B**, mỗi nhóm 125 chai. Giờ dựng một bản đồ nhị phân đơn giản với **7 tù nhân mỗi nhóm**:

```
Tù nhân 1: 0000001  (chai 1, 3, 5, 7, …)
Tù nhân 2: 0000010  (chai 2, 3, 6, 7, 10, 11, …)
Tù nhân 3: 0000100  (chai 8, 9, 10, 11, 12, 13, …)
…
```

Sơ đồ trên cho biết "bit" được gán cho mỗi tù nhân và tất cả các chai tương ứng anh ta phải nếm.

Lập **hai nhóm 7 tù nhân** (A1, A2, … và B1, B2, …). Một nhóm uống **mọi chai của nhóm A**, rồi áp bản đồ nhị phân của mình lên **nhóm B**. Nhóm tù nhân còn lại làm ngược lại. Sau đó lấy **OR logic** các bit của những người đã chết.

*Ví dụ:* nếu A1, A6, B3, B4 và B7 chết thì hai chai độc là **A33** (`0100001`) và **B76** (`1001100`).

Tổng: 14 người thử ở ngày 2, mất 6 người ở ngày 1 (tái sử dụng 2 người sống) → **20 tù nhân**. Đây là trường hợp tốt nhất.

## Ngày 2 — Kịch bản 2: **chỉ 1 người sống**

Nghĩa là **cả hai chai độc nằm trong cùng một nhóm** — khó hơn nhiều. Ngày 2 gồm hai bước.

**Bước 1:** bản đồ nhị phân đơn giản với 7 tù nhân, giống như bài "một chai độc" cổ điển. Số người chết ở bước này cho biết **những bit mà CẢ HAI chai độc đều bằng 1** (tức phép AND của hai số hiệu).

*Ví dụ:* nếu chai 39 và 97 bị tẩm độc:

```
37: 0100111
97: 1100001
```

Bit thứ 1 và bit thứ 6 (từ phải) là chung của cả hai chai, nghĩa là tù nhân 1 và tù nhân 6 sẽ chết.

**Bước 2** hoàn tất việc phân giải, đưa tổng số lên **35 tù nhân** trong trường hợp xấu nhất.

### 💬 Bình luận dưới câu trả lời này

**user88** — Hmm, bạn được ai dẫn link tới đây à?

**user2357112** — Tôi mong bạn có gì đó tốt cho ngày 2 kịch bản 2. Tôi **chưa thấy lời giải nào chạy được** để thử N chai trong một ngày với ít hơn N−1 tù nhân.

**Cubicon** — @JoeZ. bạn hỏi câu đố hay lời giải? Câu đố thì tôi lang thang trên SE mà tìm thấy. Lời giải là của tôi, dù ý tưởng chia nhóm ở ngày 1 lấy cảm hứng từ các câu trả lời khác. Lời giải ban đầu của tôi thử hết trong một ngày và cần **55 tù nhân**.

**user2357112** — Trong quy trình ngày 2 kịch bản 2 của bạn, **không ai uống chai số 0**. Nếu chai đó bị tẩm độc thì làm sao biết chai còn lại là chai nào?

**Cubicon** — Sẽ **không có chai số 0**. Sau ngày 1, mỗi nhóm có 125 chai, ta đánh nhãn 1 đến 125. 7 tù nhân là đủ vì họ phủ được 128 chai khác nhau (0–127 hoặc 1–128, tuỳ bạn).

**user2357112** — Tôi nghĩ sơ đồ này chạy được, **miễn là không chai nào được đánh nhãn 0** — nó dựa vào việc mỗi chai có ít nhất một bit bằng 1.

**Cubicon** — Chính xác. Và vì ta có đủ bit để đánh nhãn 1–125 cho cả 125 chai nên không cần chai số 0.

**user2357112** — Về câu "tôi tin bước một là cần thiết, tôi không nghĩ chỉ dùng bước hai là xác định được các bit trùng lặp": **chỉ bước 2 không phân biệt được** trường hợp (1, 2) và (1, 3) bị tẩm độc — kết quả bước 2 của hai trường hợp đó **giống nhau hoàn toàn**.

---

# CÂU TRẢ LỜI 6

**Tác giả: JonTheMon** · **2 điểm** · **Kết quả: 18 (tốt nhất) / xấu nhất tệ hơn nhiều — tác giả tự thừa nhận**

Dựa trên câu trả lời của Collett:

**Ngày 1:** chia chai thành 4 nhóm 250 chai, 4 tù nhân mỗi người uống **750 chai còn lại**. Ta có nhiều nhất 2 người sống, cho biết hai chất độc nằm ở nhóm 250 nào.

**Ngày 2:** lấy 2 người còn sống + 14 người chưa dùng, để riêng 2 người, chia thành 2 nhóm 8 người. Mỗi nhóm uống toàn bộ 250 chai của **một** nhóm, rồi dùng lời giải gốc trên nhóm 250 còn lại để tìm ra chai.

**Tổng: 18 tù nhân.**

## Giải thích rõ hơn về ngày 2

Giả sử 2 người còn lại là người **không uống nhóm 250** (gọi là A) và người **không uống nhóm 500** (gọi là B).

- Lập nhóm **A'** = A + 7 người khác, cùng uống **toàn bộ nhóm 500**.
- Lập nhóm **B'** = B + 7 người khác, cùng uống **toàn bộ nhóm 250**.

Vì mỗi nhóm có 8 người, 2⁸ = 256 nên xác định được chai độc còn lại trong mỗi nhóm. A' thử hết nhóm 250, B' thử hết nhóm 500.

Cách làm: **bản đồ bit**. Mỗi tù nhân ứng với một bit (ví dụ `00000100`, `00000010`), mỗi chai biểu diễn bằng số hiệu ở dạng nhị phân; nếu chai khớp bit của bạn thì bạn uống.

## Bổ sung 1

Nếu chỉ còn **1 nhóm 250**? Khi đó còn 17 tù nhân. May thay, nếu tách được 2 nhóm 8 người từ đó thì vẫn tìm ra được: đặt các chai vào **lưới 250×250** và làm bản đồ bit trên **mỗi trục**. Mất nhiều nhất 19 người.

Sơ đồ minh hoạ (số là chai, chữ là tù nhân; mỗi tù nhân uống các chai bên dưới mình hoặc trên hàng của mình):

```
Tù nhân    a   a   a
             b b     b
                 c c c
Chai     0 1 2 3 4 5 6
       7 x x x x x x x
     d 6 x x x x x x
   e   5 x x x x x
   e d 4 x x x x
 f     3 x x x
 f   d 2 x x
 f e   1 x
```

## Bổ sung 2 *(tác giả tự phản biện)*

**Bản đồ bit chỉ lý tưởng để tìm 1 phần tử trong một tập, chứ không phải 2, trong một lần thử.** Nên nếu cả hai chất độc rơi vào cùng một nhóm, ngày 2 sẽ phải dùng phương pháp vét cạn. Vậy: **tốt nhất 18, xấu nhất thì tệ hơn nhiều.**

### 💬 Bình luận dưới câu trả lời này

**Collett89** — Bạn giải thích thêm hoặc cho ví dụ ngắn về ngày 2 được không? Hiện tôi chưa hiểu (nên lời giải của tôi mới là "giết hết").

**Collett89** — Đăng xong tôi mới nhận ra ý bạn — cách này **sụp khi chỉ 1 người sống sót** (ta còn phải thu hẹp khoảng 250 chai đó).

**JonTheMon** (1 điểm) — Hoá ra kịch bản **xấu nhất** (còn 2 nhóm) thật ra lại là kịch bản **tốt nhất**.

**Collett89** — Ta sẽ chỉ còn 15 tù nhân (4 người uống − 3 chết − 14 người không uống → còn 17)… nên sẽ thành 19 tù nhân. Làm tốt lắm, **bản đồ nhị phân trên lưới là thiên tài**.

**Collett89** — Tôi nghĩ có 2 phương án ở mức 19 tù nhân (2 và 4 tù nhân ở ngày 1).

**Timbo** — Tôi không rõ "bản đồ nhị phân" trong ngữ cảnh này là gì. Nhưng tôi **không nghĩ** làm bản đồ nhị phân trên từng trục là được ở trường hợp thứ hai của bạn. Nếu được thì hẳn đã có câu trả lời làm bản đồ nhị phân trên toàn bộ 1000×1000 khả năng.

**JonTheMon** — @JoeZ. ta có 20 tù nhân ban đầu (nên 20 người cho lưới 1000×1000), hoặc nếu làm cách 2 ngày thì có 16 người cho lưới 250×250.

**Collett89** — @JonTheMon đúng, nhưng một người sống sót để dùng lại… hoặc dùng 1 và 3 tù nhân ở ngày 1 (nếu cả ba chết thì đó là khoảng cuối), cho ra tiềm năng 18 nhưng chắc chắn là 19.

**user2357112** — Bản đồ nhị phân trên lưới này hoạt động thế nào? Không rõ mỗi ô chứa gì hay áp kỹ thuật nhị phân theo trục ra sao.

**user2357112** — Hình vẽ vẫn chưa làm rõ. Bạn mô tả được **mỗi tù nhân uống những chai nào** không?

**user2357112** — Phần mô tả có giúp. Tù nhân A uống chai 1, 3, 5 hay uống **mọi thứ trừ chai 0**?

**user2357112** — Nếu A uống chai 1, 3, 5 thì hình như khi một chất độc ở **chai 0**, sẽ **không ai chết** và ta chẳng biết chất độc kia ở đâu. Còn nếu A uống mọi thứ trừ chai 0 thì **mọi người uống chai 4 cũng đều uống chai 5**, nên nếu một trong hai chai đó bị độc, ta không phân biệt được.

**user88** — Vậy lời giải của bạn dùng bao nhiêu tù nhân để thử — 18 hay 20?

---

# CÂU TRẢ LỜI 7

**Tác giả: JS1** · **1 điểm** · **Kết quả: 45 tù nhân được dùng, 33 người chết**

Kết hợp câu trả lời của **@Collett89** và các bình luận của **@user2357112**.

## Ngày thứ nhất

40 tù nhân, mỗi người uống **525 chai**, dịch dần **25 chai** một. Nói cách khác: người 0 uống chai 0–524, người 1 uống 25–549, … và **quay vòng** sau chai 999 (nên người 20 uống 500–999 và 0–24). Có hai trường hợp xảy ra.

## Ngày thứ hai — Trường hợp 1 (thường gặp)

Thường sẽ có **2 nhóm 25 chai** đáng nghi, độc A ở một nhóm và độc B ở nhóm kia. Tuỳ vị trí hai chai, **từ 2 đến 20 người chết** → ít nhất 20 người sống và tái sử dụng được. Để tìm ra hai chai cụ thể cần **10 tù nhân** (5 người cho mỗi chai).

**Cách tìm chai độc trong một nhóm 25 chai:** cho 5 tù nhân uống **toàn bộ chai của nhóm còn lại** (một số người sống sót đã làm việc này rồi). Sau đó mỗi người trong 5 người uống những chai có **một bit cụ thể bằng 1** trong biểu diễn nhị phân của số hiệu chai:

- Người 0 uống các chai có bit 0 bật: 1, 3, 5, 7, …, 25
- Người 1 uống các chai có bit 1 bật: 2, 3, 6, 7, 10, 11, …, 23

Cuối cùng, những người chết **ghép thành các bit của số hiệu chai**. Ví dụ nếu người 0, 2, 3 chết thì số hiệu chai là `01101` = **13**.

Để tránh trường hợp xấu nhất là 4 người chết, hãy **đánh số chai bỏ qua những số có 4 bit bật** (tức không dùng 15, 23, 27, 29, 30, 31). Khi đó xấu nhất chỉ 3 người chết cho mỗi chai tìm được.

> **Kết quả trường hợp 1: dùng 40 tù nhân, 26 người chết.**

## Ngày thứ hai — Trường hợp 2

Khả năng còn lại: **cả hai chai độc trong cùng một nhóm 25 chai**. Nghĩa là **21 người đã chết** ở ngày 1. Giờ ta làm y như ngày 1: cần **24 tù nhân**, mỗi người uống **13 chai**, dịch một chai một. Việc này giết từ 0 đến 12 người.

> **Kết quả trường hợp 2: dùng 45 tù nhân, 33 người chết.**

*Ghi chú: tôi cũng thử các con số khác, chẳng hạn 32 tù nhân chia chai thành nhóm 32. Nhưng **40/25 là cách chia tốt nhất** khi tính đến kịch bản xấu nhất là cả hai chai độc rơi vào cùng một nhóm.*

### 💬 Bình luận dưới câu trả lời này

**Collett89** — Cách hay để cứu được ít nhất 12 người trong số đó — chúc họ sống lâu để thử thêm nhiều chai rượu khả nghi nữa… Tôi tin chắc phải có một phương pháp lập bản đồ đánh bại được cách này, nhưng lời giải của bạn **dễ theo dõi hơn nhiều** (và tới giờ mọi cố gắng tổng quát hoá bản đồ của tôi đều thất bại).

---

# ❌ CÂU TRẢ LỜI 8 — SAI (tác giả tự thừa nhận)

**Tác giả: Ivo** · **0 điểm** · **Đề xuất: 19 tù nhân — nhưng không hợp lệ**

Tôi nghĩ có thể làm giống bài gốc. Cách này **chỉ cần 19 tù nhân** có nguy cơ chết.

Trước tiên, pha **tất cả các hỗn hợp** gồm mỗi loại rượu trộn với từng loại còn lại. Ta được 1000 × 999 / 2 = **499.500 hỗn hợp**. Con số này nhỏ hơn 2¹⁹. **Chỉ một** hỗn hợp là chết người!

Đánh số các hỗn hợp từ 1 đến 499.500 ở dạng nhị phân. Tù nhân 1 nếm mọi hỗn hợp có bit 1 ở vị trí thứ nhất, tù nhân 2 nếm những hỗn hợp có bit 1 ở vị trí thứ hai, v.v.

Giờ dựa vào ai chết là chỉ ra chính xác hỗn hợp nào chết người, từ đó ra hai chai độc. Ví dụ nếu tù nhân 1, 5, 10 và 11 chết thì hỗn hợp độc là `1000100001100000000`.

*Nhân đây: tôi chỉ dùng 1 ngày. Có thể cải thiện với 2 ngày, tôi không biết.*

### 💬 Bình luận dưới câu trả lời này

**user2357112** (3 điểm) — **Không chạy được.** Một hỗn hợp có chứa **một** thành phần độc **không hành xử giống** hỗn hợp chỉ có rượu thường. Nếu độc ở chai 1 và 2, thì người uống hỗn hợp (1, 3) **và** hỗn hợp (2, 3) **cũng sẽ chết**.

**Ivo** — À đúng, tôi không nghĩ tới. Bạn nói đúng. Tôi cứ để câu trả lời này lại cho những ai có thể nghĩ giống tôi.

> 💡 **Đây là cái bẫy quan trọng nhất của cả bài toán:** hai thành phần **không cần được uống trong cùng một ly**. Chúng tích tụ trong cơ thể. Nên không thể coi mỗi "hỗn hợp" là một đơn vị thử độc lập.

---

# CÂU TRẢ LỜI 9

**Tác giả: leoll2** · **−1 điểm** · **Đề xuất: 18–19 tù nhân — bị chất vấn mạnh, phần cốt lõi chưa được chứng minh**

Tôi có một đáp án chỉ cần **19 tù nhân** trong trường hợp xấu nhất!

Chia chai thành 4 nhóm 250 chai. Cần **4 tù nhân**: mỗi người được gán số 1–4 và uống **tất cả các chai trừ nhóm mang tên mình**. Sau nửa đêm thứ nhất:

**Ba người chết** → cả hai chai độc nằm trong **một phần tư** tổng số, tức 250 chai. Ngày 2, **16 tù nhân** là đủ để khoanh ra hai chai độc bằng "phép toán bit" (bản đồ nhị phân). Vì tái sử dụng được người sống sót của ngày 1, ta chỉ cần 16 người cho ngày 2 cộng 3 người đã chết ngày 1 → **tổng 19 tù nhân**.

**Hai người chết** → ta khoanh được hai chai vào **hai nhóm 250 chai riêng biệt**. Mỗi nhóm cần **8 tù nhân** để làm chiến lược bit và tìm ra chai độc trong nhóm đó → 16 người cho ngày 2. Tái sử dụng người sống sót → **tổng 18 tù nhân!**

## Với 20 tù nhân thì thử được bao nhiêu chai?

Nếu chiến lược trên là tối ưu (và có lẽ đúng vậy), tôi cho rằng số chai tối đa là **1024**: chia thành 4 nhóm 256 chai, và với phép toán nhị phân sẽ cần không quá 20 tù nhân.

## "Phép toán bit" là gì?

Giả sử bạn có **4 chai** và biết **1 chai** chứa độc. Có hai tù nhân **A** và **B**:

- A uống chai **1 và 3**
- B uống chai **1 và 2**

| Kết quả | Chai độc |
|:---|:---:|
| A sống, B chết | 2 |
| A sống, B sống | 4 |
| A chết, B sống | 3 |
| A chết, B chết | 1 |

Vậy ta phân tích được 4 chai bằng 2 tù nhân. Tổng quát, với *n* chai cần **log₂ n** tù nhân (làm tròn lên).

## Nếu hai chất độc trong cùng nhóm?

Vẫn làm phép toán bit, nhưng lần này với *n* chai thì cần **2·log₂ n** tù nhân. *(Tác giả đưa ví dụ 4 chai / 2 độc / 4 tù nhân.)*

### 💬 Bình luận dưới câu trả lời này

**JonTheMon** — Sao chỉ 1 hoặc 2 trong 8 người chết? Chẳng phải phải là 6 hoặc 7 người chết sao?

**leoll2** — @JonTheMon tôi đã sửa và xác nhận tốt nhất là 18 tù nhân. Chiến lược của tôi về cơ bản giống cái bạn mô tả…

**JonTheMon** — Nếu tất cả chai độc nằm trong 1/4, chẳng phải nghĩa là 3 người chết vì họ "uống hết mọi chai trừ nhóm mang tên mình" sao?

**leoll2** — Lại đúng nữa. Đây là sót lại từ phiên bản trước mà tôi quên sửa. Cảm ơn!

**user2357112** (2 điểm) — "**Dùng một phép toán bit**" không phải là một lời giải thích chi tiết cho lắm. Chính xác thì bạn dùng phép toán bit **thế nào** để định vị **hai** chai độc?

**Ewan** — Sao là 4 mà không phải 8?

**goldPseudo** (2 điểm) — Bạn có tái sử dụng được người sống sót ngày 1 trong trường hợp "hai người chết" không? Cả hai người đó đều đã nạp **một thành phần** độc ở giai đoạn một, và thành phần đó vẫn nằm trong cơ thể, sẽ ảnh hưởng tới lần thử thứ hai.

**user2357112** (1 điểm) — @goldPseudo Được: bạn **biết mỗi người đang mang thành phần nào**, nên có thể phân họ vào đúng nhóm mà dù sao cũng chắc chắn phải nạp thành phần đó.

**Falco** — Xin giải thích làm sao tìm được 2 chai độc trong 250 chai với 16 tù nhân? Bạn đã cần **1 ngày và 4 tù nhân** để đi từ 1000 chai xuống 250; theo quy nạp, thêm một ngày và 4 tù nhân nữa sẽ đưa bạn xuống 250/4 = 64… **Nếu bạn có cách làm ngày 2 tốt hơn, sao không dùng nó luôn cho ngày 1?**

**leoll2** — @Falco đã thêm giải thích, giờ chiến lược hẳn dễ hiểu hơn.

**leoll2** — @goldPseudo user2357112 đã trả lời đúng câu hỏi của bạn.

**leoll2** — @user2357112 tôi đã thêm giải thích về chiến lược bit, hy vọng là đủ.

**leoll2** — @JoeZ. bạn kiểm tra và đánh giá lời giải của tôi được không? Tôi nghĩ vì lý do nào đó nó chưa được chú ý đủ.

**Timbo** — Thử 4 chai với 4 tù nhân thì không khó. Nhưng tôi **không thấy cách nào** kiểm tra 16 chai với 8 tù nhân nếu **cả hai** chất độc nằm trong 16 chai đó. Bạn lập luận thế nào để ra **2·log(n)** tù nhân? Theo tôi cách của bạn cần **n** tù nhân.

**Timbo** — @leoll2 tôi muốn một lời giải tổng quát hơn. Kiểu như: làm sao **nhân đôi** số chai thử được khi thêm 2 tù nhân. 8 chai với 6 tù nhân gần như là lời giải dễ 8 chai / 7 tù nhân. Còn 8 chai với 6 tù nhân mới là bước đầu không tầm thường.

*(leoll2 đề nghị ví dụ 8 chai với 6 tù nhân; Timbo vẫn muốn một lập luận tổng quát. Cuộc thảo luận kết lại ở đó — phần cốt lõi "2·log₂ n tù nhân cho hai chất độc" **chưa được chứng minh**, và đây là lý do câu trả lời bị bỏ phiếu âm.)*

---

# 📊 BẢNG TỔNG HỢP CÁC CÂU TRẢ LỜI

| # | Tác giả | Điểm | Số tù nhân | Ý tưởng cốt lõi | Trạng thái |
|:---:|:---|:---:|:---:|:---|:---|
| 1 | **Timbo** | **17** | **18–20** | 10 cặp tù nhân, mỗi cặp một bit + bit nghịch đảo → đọc được `x XOR y`; ngày 2 tách ra `x` | ✅ **Được chấp nhận** |
| 2 | Collett89 | 15 | 1000 → **45** | Cửa sổ chồng lấn: mỗi người uống 525 chai, dịch 25 chai | Đúng, cải tiến dần |
| 3 | user2357112 | 10 | 124 → **93** | 32 cocktail theo nhóm; nhóm A uống tiền tố, nhóm B uống hậu tố | Đúng, trình bày rõ |
| 4 | The Pyrate | 5 | **499.500** | Một tù nhân cho mỗi cặp chai | Đúng nhưng vô dụng thực tế |
| 5 | Cubicon | 4 | **35** (xấu nhất) | 8 nhóm 125 chai + bản đồ bit; kịch bản 2 dùng phép AND các bit | Đúng, được rà kỹ |
| 6 | JonTheMon | 2 | **18** (tốt nhất) | 4 nhóm 250 + bản đồ bit trên lưới | ⚠️ Tác giả tự thừa nhận sụp ở xấu nhất |
| 7 | JS1 | 1 | **45** | Hiện thực hoá gợi ý của user2357112 một cách chi tiết, dễ theo | Đúng, rất dễ hiểu |
| 8 | Ivo | 0 | ~~19~~ | Pha sẵn tất cả 499.500 hỗn hợp | ❌ **Sai** — thành phần tích tụ trong cơ thể |
| 9 | leoll2 | −1 | ~~18–19~~ | 4 nhóm 250 + "phép toán bit" | ❌ Phần cốt lõi chưa chứng minh được |

---

# 🔑 NHỮNG Ý QUAN TRỌNG RÚT RA TỪ CẢ TRANG

1. **Cái bẫy lớn nhất (câu trả lời 8):** hai thành phần **không cần uống cùng một ly**. Chúng tích tụ trong cơ thể. Nên mọi lời giải kiểu "pha sẵn từng hỗn hợp rồi coi mỗi hỗn hợp là một phép thử độc lập" đều **sai**.

2. **Cái bẫy lớn thứ hai (câu trả lời 6 và 9):** bản đồ bit nhị phân là công cụ để tìm **một** phần tử trong một lần thử, **không phải hai**. Nhiều câu trả lời sập vào chỗ này khi cả hai chai độc rơi vào cùng một nhóm. Chính **Timbo** và **user2357112** là hai người liên tục chỉ ra lỗ hổng đó.

3. **Ý tưởng thắng cuộc (câu trả lời 1):** dùng **cặp** tù nhân cho mỗi bit — một người phụ trách "bit = 0", một người phụ trách "bit = 1". Cặp nào **cả hai đều sống** thì bit đó **khác nhau** giữa hai chai độc → đọc trực tiếp ra `x XOR y`. Đây là lời giải duy nhất khai thác được cấu trúc "hai chai độc" một cách trực tiếp thay vì đi chia nhóm rồi tìm từng chai.

4. **Tái sử dụng người sống sót là hợp lệ** (goldPseudo hỏi, user2357112 trả lời): người sống sót ngày 1 có thể đã mang một thành phần độc, nhưng **ta biết họ mang thành phần nào** — nên cứ phân họ vào đúng nhóm mà dù sao cũng phải nạp thành phần đó. Không mất thông tin.

5. **Nới ràng buộc thời gian thì rẻ hơn rất nhiều** (dberm22): nếu có 10 ngày thay vì 2, chỉ cần **27 người thử** — mỗi ngày 3 người cắt tập hợp đi một nửa. Điều này cho thấy **số vòng thử quan trọng hơn số người mỗi vòng**.

6. **Nhận xét thực dụng nhất** (KSmarts, 8 điểm): nếu chỉ cần **an toàn**, bạn chỉ cần xác định **một** trong hai chai là đủ — vì thiếu một thành phần thì chất độc không hoạt động.

---

*Bản tiếng Việt này trình bày lại nội dung từ Puzzling Stack Exchange #12770, phát hành dưới giấy phép CC BY-SA 4.0 như bản gốc. Ghi công: user88, Ian MacDonald, Timbo, Collett89, user2357112, The Pyrate, Cubicon, JonTheMon, JS1, Ivo, leoll2, cùng toàn bộ người bình luận có tên ở trên.*
