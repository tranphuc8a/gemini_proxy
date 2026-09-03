# Chương 1 — Greedy Algorithm

Sau Chương 0, ta đã có mô hình:

$$
\boxed{
x^*=\arg\max_{x\in S}f(x)
}
$$

Nhưng câu hỏi thực tế là:

> Làm sao tìm được \(x^*\) ?

Greedy là câu trả lời đầu tiên, đơn giản nhất, và cũng là nguồn gốc của rất nhiều heuristic hiện đại.

---

# 1.1. Greedy là gì?

Ý tưởng:

```text
Khi đứng trước nhiều lựa chọn,
hãy chọn lựa chọn tốt nhất ngay lúc này.
```

Sau đó:

```text
Không quay đầu.
Không sửa lại.
Tiếp tục tiến lên.
```

---

Ví dụ:

Có các đồng xu:

```text
1
5
10
25
```

Cần đổi:

```text
63
```

Greedy:

```text
25
25
10
1
1
1
```

Luôn lấy đồng xu lớn nhất có thể.

---

# Định nghĩa hình thức

Giả sử:

$$
S
$$

là tập nghiệm.

Tại bước \(k\):

Greedy chọn:

$$
a_k
=
\arg\max_{a\in A_k}
gain(a)
$$

Trong đó:

* \(A_k\) là các lựa chọn hợp lệ hiện tại.
* gain là lợi ích cục bộ.

Sau đó:

```text
Cố định lựa chọn đó.
```

và chuyển sang bước tiếp theo.

---

# 1.2. Triết lý của Greedy

Greedy tin rằng:

> Nếu liên tục đưa ra quyết định tốt nhất cục bộ,
> cuối cùng sẽ thu được nghiệm tốt toàn cục.

Tức:

```text
Local Best
    ↓
Local Best
    ↓
Local Best
    ↓
Global Best ?
```

Dấu hỏi là vấn đề.

---

# 1.3. Khi nào Greedy đúng?

Không phải lúc nào cũng đúng.

Muốn đúng cần:

## Greedy Choice Property

Lựa chọn tốt nhất hiện tại luôn thuộc một nghiệm tối ưu nào đó.

---

## Optimal Substructure

Sau khi cố định lựa chọn đầu tiên:

```text
Bài toán còn lại
```

vẫn là một bài toán cùng dạng.

---

Nếu thiếu một trong hai:

```text
Greedy thường sai
```

---

# 1.4. Ví dụ kinh điển 1 — Activity Selection

Cho các khoảng:

```text
[1,4]
[3,5]
[0,6]
[5,7]
[8,9]
```

Muốn chọn được nhiều interval nhất.

---

Greedy:

```text
Luôn chọn interval kết thúc sớm nhất
```

---

Ví dụ:

```text
[1,4]
```

được chọn đầu tiên.

Sau đó:

```text
[5,7]
```

Sau đó:

```text
[8,9]
```

---

Tại sao đúng?

Bởi vì:

> Nếu một nghiệm tối ưu không chọn interval kết thúc sớm nhất,
> ta có thể thay interval đầu tiên bằng interval kết thúc sớm nhất
> mà không làm giảm số lượng interval.

Đây gọi là:

```text
Exchange Argument
```

---

# 1.5. Exchange Argument

Đây là kỹ thuật chứng minh Greedy quan trọng nhất.

Ý tưởng:

Giả sử:

```text
Greedy chọn G
Optimal chọn O
```

Ta chứng minh:

```text
Có thể thay O bằng G
```

mà không làm nghiệm xấu đi.

---

Nếu làm được:

```text
Optimal mới
```

vẫn tồn tại và chứa quyết định của Greedy.

---

Do đó:

```text
Greedy an toàn
```

---

# 1.6. Ví dụ kinh điển 2 — Huffman Coding

Cho:

| Ký tự | Tần suất |
| ----- | -------- |
| A     | 40       |
| B     | 30       |
| C     | 20       |
| D     | 10       |

---

Greedy:

```text
Ghép 2 node nhỏ nhất
```

---

Ghép:

```text
10 + 20 = 30
```

---

Sau đó:

```text
30 + 30 = 60
```

---

Sau đó:

```text
40 + 60 = 100
```

---

Kết quả là cây Huffman tối ưu.

---

Đây là một trong những bài Greedy nổi tiếng nhất.

---

# 1.7. Ví dụ kinh điển 3 — Minimum Spanning Tree

Cho graph:

```text
A --1-- B
|       |
2       3
|       |
C --4-- D
```

---

Kruskal:

```text
Chọn cạnh nhỏ nhất
```

---

Theo thứ tự:

```text
1
2
3
```

---

Tổng:

```text
6
```

---

Tại sao đúng?

Do:

```text
Cut Property
```

---

Mọi cut:

```text
cạnh nhẹ nhất đi qua cut
```

đều thuộc một MST tối ưu.

---

Đây là một dạng Greedy Choice Property.

---

# 1.8. Ví dụ Greedy sai — Knapsack

Capacity:

```text
50
```

---

Items:

| Value | Weight |
| ----- | ------ |
| 60    | 10     |
| 100   | 20     |
| 120   | 30     |

---

Greedy theo:

```text
value lớn nhất
```

chọn:

```text
120
```

---

Còn lại:

```text
20 weight
```

chọn:

```text
100
```

---

Tổng:

```text
220
```

Trường hợp này tình cờ đúng.

Đổi ví dụ:

| Value | Weight |
| ----- | ------ |
| 100   | 51     |
| 60    | 30     |
| 60    | 30     |

Capacity:

```text
60
```

---

Greedy:

```text
100
```

không lấy được.

---

Hoặc theo value:

```text
60
```

chọn một item.

---

Optimal:

```text
60 + 60 = 120
```

---

Greedy thất bại.

---

# 1.9. Nguyên nhân Greedy thất bại

Greedy chỉ nhìn:

```text
hiện tại
```

---

Nó không nhìn:

```text
hệ quả tương lai
```

---

Ví dụ:

```text
Nhà A:
reward = 300k
```

---

Nhà B:

```text
reward = 250k
```

---

Greedy:

```text
chọn A
```

---

Nhưng:

```text
A ở rất xa
```

khiến:

```text
mất 100 phút di chuyển
```

---

Sau đó không đủ thời gian làm:

```text
B
C
D
```

---

Optimal:

```text
B + C + D
```

---

Tổng reward cao hơn.

---

# 1.10. Greedy trong bài Air Conditioner

Đây là phần thú vị.

Ta có:

```text
200~400 nhà
```

---

Mỗi nhà:

```text
reward
service time
location
```

---

Cần:

```text
max revenue
```

---

Greedy đầu tiên mà ai cũng nghĩ tới:

```text
reward lớn nhất
```

---

Sai.

---

Ví dụ:

```text
300k
```

ở góc thành phố.

---

Trong khi:

```text
250k
250k
250k
```

nằm sát nhau.

---

Tổng sau cùng:

```text
750k
```

thắng xa.

---

# 1.11. Density Greedy

Tương tự Knapsack.

Ta định nghĩa:

$$
density_i
=
\frac{reward_i}
{service_i}
$$

---

Ví dụ:

| Reward | Time |
| ------ | ---- |
| 300    | 210  |
| 250    | 60   |

---

Density:

```text
1.43
4.17
```

---

Greedy thích item thứ hai hơn.

---

Nhưng vẫn thiếu:

```text
travel cost
```

---

# 1.12. Marginal Profit

Một Greedy tốt hơn:

$$
score(i)
=
\frac{reward_i}
{service_i + travel_i}
$$

---

Ví dụ:

Nhà A:

```text
reward = 300
service = 210
travel = 100
```

---

Score:

$$
300/310
$$

---

Nhà B:

```text
reward = 250
service = 60
travel = 10
```

---

Score:

$$
250/70
$$

---

Greedy sẽ chọn B.

---

Đây là heuristic rất phổ biến trong routing.

---

# 1.13. Context Dependence

Vấn đề:

$$
travel_i
$$

không cố định.

---

Nó phụ thuộc:

```text
vị trí hiện tại
```

---

Nếu technician đang ở:

```text
(10,10)
```

thì:

```text
A
```

có thể rất gần.

---

Nếu technician ở:

```text
(90,90)
```

thì:

```text
A
```

rất xa.

---

Nghĩa là:

$$
score(i)
$$

phụ thuộc trạng thái hiện tại.

---

Đây là đặc trưng của routing.

---

# 1.14. Constructive Greedy

Đa số heuristic thực tế đều là:

```text
Constructive
```

---

Bắt đầu:

```text
empty solution
```

---

Sau đó:

```text
thêm từng node
```

---

Ví dụ:

```text
Start
```

↓

```text
Thêm nhà 17
```

↓

```text
Thêm nhà 3
```

↓

```text
Thêm nhà 42
```

↓

...

---

Cho tới khi:

```text
không thêm được nữa
```

---

# 1.15. Greedy Framework

```cpp
solution = empty

while (true)
{
    candidate = best feasible move

    if (candidate == NONE)
        break;

    apply(candidate);
}
```

---

Đây là khuôn mẫu của hầu hết thuật toán Greedy.

---

# 1.16. Complexity

Giả sử:

```text
n = 300
```

---

Mỗi bước:

```text
duyệt toàn bộ node
```

---

Chi phí:

$$
O(n^2)
$$

---

Với:

```text
300
```

rất nhẹ.

---

Do đó Greedy thường cực nhanh.

---

# 1.17. Tại sao Greedy vẫn cực kỳ quan trọng?

Dù thường không tối ưu.

---

Lý do:

## 1. Rất nhanh

$$
O(n\log n)
$$

hoặc:

$$
O(n^2)
$$

---

## 2. Dễ code

---

## 3. Dùng làm Initial Solution

Đây là lý do quan trọng nhất.

---

Hầu hết solver hiện đại:

```text
Greedy
    ↓
Local Search
    ↓
Metaheuristic
```

---

Không ai khởi tạo bằng nghiệm ngẫu nhiên nếu có thể tạo một nghiệm Greedy tốt.

---

# 1.18. Ví dụ Pipeline Hiện Đại

ALNS:

```text
Constructive Greedy
          ↓
Local Search
          ↓
Destroy
          ↓
Repair
          ↓
Improve
```

---

Greedy thường là viên gạch đầu tiên.

---

# 1.19. Greedy Randomized

Thay vì:

```text
chọn tốt nhất
```

---

Ta chọn:

```text
top-k tốt nhất
```

rồi random.

---

Ví dụ:

```text
1st
2nd
3rd
```

---

Random chọn một.

---

Kỹ thuật này dẫn tới:

```text
GRASP
```

mà ta sẽ học sau.

---

# 1.20. Những dấu hiệu nhận biết Greedy

Khi gặp bài mới, hãy hỏi:

### Có thể xây lời giải từng bước không?

---

### Quyết định hiện tại có ít ảnh hưởng tới tương lai không?

---

### Có Exchange Argument không?

---

### Có Optimal Substructure không?

---

Nếu có:

```text
Greedy đáng thử
```

---

# 1.21. Bài học quan trọng nhất

Greedy không phải:

```text
chọn cái lớn nhất
```

---

Greedy là:

```text
thiết kế một hàm đánh giá cục bộ
```

sao cho:

```text
quyết định cục bộ tốt
⇒
nghiệm toàn cục tốt
```

---

Trong bài Air Conditioner, điều khó nhất không phải code.

Mà là thiết kế:

$$
gain(i)
$$

Ví dụ:

$$
gain(i)
=
\frac{reward_i}
{service_i+travel_i}
$$

hay:

$$
gain(i)
=
reward_i
-\lambda travel_i
$$

hay:

$$
gain(i)
=
\frac{reward_i+overtimeBonus_i}
{timeIncrease_i}
$$

Mỗi cách sẽ tạo ra một Greedy hoàn toàn khác nhau.

---

# Tóm tắt Chương 1

Greedy gồm 4 thành phần:

```text
Candidate Set
      ↓
Evaluation Function
      ↓
Best Choice
      ↓
Commit
```

Những khái niệm cần nhớ:

$$
\boxed{\text{Greedy Choice Property}}
$$

$$
\boxed{\text{Optimal Substructure}}
$$

$$
\boxed{\text{Exchange Argument}}
$$

$$
\boxed{\text{Constructive Heuristic}}
$$

Và bài học lớn nhất:

> Greedy thường không giải được bài toán tối ưu tổ hợp khó, nhưng gần như mọi metaheuristic mạnh đều bắt đầu từ một nghiệm Greedy chất lượng cao.

Ở chương tiếp theo (**Dynamic Programming**), ta sẽ thấy một triết lý hoàn toàn ngược lại với Greedy:

```text
Greedy:
Ra quyết định ngay lập tức

DP:
Hoãn quyết định,
xét tất cả khả năng quan trọng,
rồi ghi nhớ kết quả
```

và đó là bước đầu tiên từ heuristic sang các phương pháp tìm nghiệm tối ưu có chứng minh.
