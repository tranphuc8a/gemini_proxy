# Chương 2 — Dynamic Programming (Quy Hoạch Động)

> "Đừng giải cùng một bài toán con nhiều lần."

Đây là bản chất thật sự của Dynamic Programming (DP).

Rất nhiều người học DP bằng cách nhớ công thức:

```cpp
dp[i] = ...
```

rồi làm vài trăm bài.

Nhưng nếu không hiểu:

> DP thực sự đang làm gì?

thì gặp bài lạ gần như phải học lại từ đầu.

---

# 3.1. DP sinh ra để giải quyết vấn đề gì?

Xét Fibonacci.

$$
F(n)=F(n-1)+F(n-2)
$$

Ví dụ:

$$
F(5)
$$

---

Cách đệ quy:

```text
F(5)
├── F(4)
│   ├── F(3)
│   │   ├── F(2)
│   │   └── F(1)
│   └── F(2)
└── F(3)
    ├── F(2)
    └── F(1)
```

---

Nhìn kỹ:

```text
F(3)
```

xuất hiện:

```text
2 lần
```

---

```text
F(2)
```

xuất hiện:

```text
3 lần
```

---

```text
F(1)
```

xuất hiện:

```text
2 lần
```

---

Đây gọi là:

$$
\boxed{\text{Overlapping Subproblems}}
$$

---

DP xuất hiện để tránh việc:

```text
Tính lại
Tính lại
Tính lại
```

---

# 3.2. Ý tưởng cốt lõi

Nếu:

```text
F(3)
```

đã tính rồi

thì lần sau:

```cpp
return memo[3];
```

---

Không tính lại nữa.

---

Đó chính là:

$$
\boxed{\text{Memoization}}
$$

---

# 3.3. Hai điều kiện của DP

Một bài thường dùng được DP khi có:

---

## 1. Optimal Substructure

Nghiệm tối ưu được xây từ nghiệm tối ưu của bài toán con.

---

Ví dụ:

Đường đi ngắn nhất:

```text
A → B → C → D
```

---

Nếu:

```text
A → D
```

là đường ngắn nhất.

Thì:

```text
A → C
```

bên trong nó cũng phải là đường ngắn nhất.

---

Đây là optimal substructure.

---

## 2. Overlapping Subproblems

Nhiều trạng thái được gọi đi gọi lại.

---

Ví dụ Fibonacci.

---

Nếu không có overlap:

DP thường không hiệu quả.

---

# 3.4. DP thực chất là gì?

Nhiều người nghĩ:

```text
DP = công thức
```

Sai.

---

Thực chất:

```text
DP = Duyệt trạng thái
     + Lưu kết quả
```

---

Hay:

$$
\boxed{
\text{State}
+
\text{Transition}
+
\text{Memoization}
}
$$

---

# 3.5. State là gì?

Đây là phần quan trọng nhất.

---

Ví dụ:

Bài toán:

> Từ vị trí 0 đi tới vị trí n.

---

Ta định nghĩa:

$$
dp[i]
$$

=

```text
đáp án tốt nhất khi đứng tại i
```

---

Đây chính là:

```text
STATE
```

---

# 3.6. Ví dụ 1 — Climbing Stairs

Có:

```text
n bậc thang
```

---

Mỗi lần đi:

```text
1 hoặc 2 bậc
```

---

Hỏi:

```text
có bao nhiêu cách lên tới đỉnh
```

---

## State

$$
dp[i]
$$

=

```text
số cách lên bậc i
```

---

# 3.7. Transition

Để tới:

```text
i
```

---

Có thể tới từ:

```text
i-1
```

hoặc

```text
i-2
```

---

Nên:

$$
dp[i]
=
dp[i-1]
+
dp[i-2]
$$

---

# 3.8. Base Case

$$
dp[0]=1
$$

---

$$
dp[1]=1
$$

---

Từ đó:

```text
1
1
2
3
5
8
13
...
```

---

Chính là Fibonacci.

---

# 3.9. Template DP chuẩn

Mọi bài DP đều gần giống:

```cpp
dp[base] = ...

for (...)
{
    dp[next] =
        combine(dp[previous]);
}
```

---

# 3.10. Một cách nhìn khác

DP là:

```text
DAG of states
```

---

Ví dụ:

```text
dp[0]
  ↓
dp[1]
  ↓
dp[2]
  ↓
dp[3]
```

---

Ta chỉ cần:

```text
tính từ trái sang phải
```

---

# 3.11. Ví dụ 2 — Coin Change

Cho:

```text
1
3
4
```

---

Hỏi:

```text
ít nhất bao nhiêu đồng để tạo 6
```

---

# 3.12. State

$$
dp[x]
$$

=

```text
ít nhất số đồng để tạo x
```

---

# 3.13. Transition

Nếu chọn coin:

```text
c
```

---

Thì:

$$
dp[x]
=
\min(dp[x],
dp[x-c]+1)
$$

---

# 3.14. Minh họa

Coin:

```text
1
3
4
```

---

Tạo:

```text
6
```

---

```text
dp[0]=0
```

---

```text
dp[1]=1
```

---

```text
dp[2]=2
```

---

```text
dp[3]=1
```

---

```text
dp[4]=1
```

---

```text
dp[5]=2
```

---

```text
dp[6]=2
```

---

Từ:

```text
3+3
```

---

# 3.15. Tại sao gọi là "quy hoạch động"?

Tên gốc:

```text
Dynamic Programming
```

---

Do Richard Bellman đặt.

---

Không liên quan tới:

```text
quy hoạch
```

theo nghĩa quy hoạch đô thị.

---

Thực chất:

```text
Lưu nghiệm các bài toán con
```

---

# 3.16. Cách tư duy DP

Khi gặp bài mới.

Đừng hỏi:

```text
Công thức là gì?
```

---

Hãy hỏi:

```text
Nếu biết lời giải nhỏ hơn,
tôi có xây được lời giải lớn hơn không?
```

---

Nếu có:

```text
DP khả thi
```

---

# 3.17. Bài toán Knapsack

Đây là bài DP quan trọng nhất.

---

Có:

```text
n item
```

---

Item i:

```text
weight[i]
value[i]
```

---

Capacity:

```text
W
```

---

# 3.18. State

$$
dp[i][w]
$$

=

```text
giá trị lớn nhất
sử dụng i item đầu tiên
với sức chứa w
```

---

# 3.19. Quyết định

Với item i.

---

Có hai lựa chọn:

```text
Không lấy
```

hoặc

```text
Lấy
```

---

# 3.20. Transition

Không lấy:

$$
dp[i-1][w]
$$

---

Lấy:

$$
dp[i-1][w-weight_i]
+
value_i
$$

---

Nên:

$$
dp[i][w]
=
\max
(
dp[i-1][w],
dp[i-1][w-weight_i]+value_i
)
$$

---

Đây là công thức nổi tiếng nhất của DP.

---

# 3.21. DP = Search Space Compression

Bruteforce:

```text
2^n
```

---

Knapsack:

```text
chọn
không chọn
```

---

Toàn bộ cây:

```text
2^n
```

---

DP nhận ra:

```text
Nhiều nhánh dẫn tới
cùng (i,w)
```

---

Nên:

```text
chỉ tính một lần
```

---

Đó là điều thần kỳ của DP.

---

# 3.22. Memoization vs Tabulation

Có hai cách viết.

---

## Top Down

```cpp
solve(state)
```

---

Đệ quy.

---

Lưu memo.

---

## Bottom Up

```cpp
for (...)
```

---

Điền bảng.

---

Thường nhanh hơn.

---

# 3.23. Ví dụ Top Down

```cpp
int fib(int n)
{
    if (n <= 1)
        return n;

    if (memo[n] != -1)
        return memo[n];

    return memo[n]
         = fib(n-1)+fib(n-2);
}
```

---

# 3.24. Ví dụ Bottom Up

```cpp
dp[0]=0;
dp[1]=1;

for(int i=2;i<=n;i++)
{
    dp[i]=dp[i-1]+dp[i-2];
}
```

---

Kết quả giống nhau.

---

# 3.25. Phân loại DP kinh điển

Có khoảng 15 họ bài rất quan trọng.

---

## Linear DP

```text
Fibonacci
Climbing Stairs
House Robber
```

---

## Knapsack DP

```text
0/1 Knapsack
Subset Sum
Partition
```

---

## Sequence DP

```text
LIS
LCS
Edit Distance
```

---

## Interval DP

```text
Matrix Chain
Burst Balloons
```

---

## Tree DP

```text
Independent Set
Vertex Cover
```

---

## Bitmask DP

```text
TSP
Assignment
```

---

## Digit DP

```text
Đếm số
```

---

# 3.26. DP và Greedy khác nhau thế nào?

Greedy:

```text
Ra quyết định ngay
```

---

DP:

```text
Xét mọi quyết định quan trọng
```

---

Ví dụ Knapsack.

---

Greedy:

```text
Item tốt nhất trước
```

---

DP:

```text
Thử cả lấy và không lấy
```

---

Sau đó chọn tốt nhất.

---

# 3.27. Tại sao DP thường cho optimum?

Vì:

```text
Không bỏ sót trạng thái
```

---

Nếu state đầy đủ:

```text
mọi khả năng đều được xét
```

---

Do đó:

```text
đảm bảo tối ưu
```

---

# 3.28. DP và bài Air Conditioner

Đây là phần quan trọng.

---

Giả sử:

```text
300 nhà
```

---

Muốn state:

```text
nhà nào đã đi
```

---

Ta cần:

$$
2^{300}
$$

trạng thái.

---

Không thể.

---

Vì vậy:

```text
DP tổng quát thất bại
```

---

# 3.29. Nhưng bài nhỏ thì được

Ví dụ:

```text
20 nhà
```

---

State:

$$
dp[mask][u]
$$

---

Trong đó:

```text
mask
```

=

```text
những nhà đã thăm
```

---

```text
u
```

=

```text
vị trí hiện tại
```

---

Đây chính là:

```text
Held-Karp TSP
```

---

# 3.30. DP cho TSP

State:

$$
dp[mask][u]
$$

---

Ý nghĩa:

```text
đã đi mask
và đang đứng tại u
```

---

Transition:

$$
dp[mask\cup v][v]
$$

---

Complexity:

$$
O(n^22^n)
$$

---

TSP 20 đỉnh còn chạy được.

---

TSP 100 đỉnh:

```text
thua
```

---

# 3.31. Lời nguyền của DP

DP thường có dạng:

$$
StateCount
\times
TransitionCount
$$

---

Nếu:

$$
10^6
$$

trạng thái

và

$$
100
$$

transition

---

Thì:

$$
10^8
$$

phép tính.

---

Có thể chấp nhận.

---

Nếu:

$$
2^{100}
$$

trạng thái

---

Kết thúc.

---

# 3.32. Nghệ thuật của DP

Không phải:

```text
viết công thức
```

---

Mà là:

```text
thiết kế state
```

---

90% độ khó nằm ở đây.

---

# 3.33. Quy trình giải DP

Khi gặp bài mới:

---

## B1

State là gì?

---

## B2

Base case?

---

## B3

Transition?

---

## B4

Thứ tự tính?

---

## B5

Có tối ưu bộ nhớ được không?

---

# 3.34. Một công thức thần chú

Khi bí DP.

Hãy tự hỏi:

> Nếu biết đáp án của các bài toán nhỏ hơn, mình cần thêm thông tin gì để quyết định đáp án hiện tại?

Thông tin đó chính là state.

---

# 3.35. Tóm tắt chương

DP có thể được xem như:

```text
Bruteforce
     ↓
Nhận ra trạng thái trùng nhau
     ↓
Lưu kết quả
     ↓
Không tính lại
```

Ba khái niệm quan trọng nhất:

$$
\boxed{\text{State}}
$$

$$
\boxed{\text{Transition}}
$$

$$
\boxed{\text{Memoization}}
$$

Nếu Greedy là:

> "Tin rằng quyết định cục bộ là đúng"

thì DP là:

> "Không tin điều đó, nên xét tất cả các quyết định quan trọng nhưng tránh tính lại."

---

Ở chương tiếp theo, đáng học nhất là **Bitmask DP & Held–Karp TSP**, vì đó là cây cầu nối giữa:

```text
Dynamic Programming
        ↓
Graph Optimization
        ↓
Traveling Salesman Problem
        ↓
Routing / Vehicle Routing
        ↓
Metaheuristic hiện đại
```

và là lần đầu tiên cậu thấy một bài toán NP-hard kinh điển được giải tối ưu bằng DP trên không gian trạng thái mũ.
