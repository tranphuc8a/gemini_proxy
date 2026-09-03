# Chương 2.5 — Bitmask DP & Held-Karp Algorithm cho TSP

Đây là một trong những thuật toán đẹp nhất của khoa học máy tính.

Nó nằm đúng giữa:

```text
Bruteforce
    ↓
Backtracking
    ↓
Bitmask
    ↓
Dynamic Programming
    ↓
Exact Optimization
```

Nếu hiểu chương này, cậu sẽ hiểu vì sao:

* TSP là NP-Hard
* DP có thể giải được TSP nhỏ
* Vì sao OR-Tools, Concorde, LKH tồn tại
* Vì sao bài Air Conditioner không thể dùng DP trực tiếp

---

# 2.5.1 TSP là gì?

Traveling Salesman Problem.

Cho:

```text
n thành phố
```

và ma trận khoảng cách:

$$
dist(i,j)
$$

---

Mục tiêu:

```text
Xuất phát từ thành phố gốc
Đi qua mọi thành phố đúng 1 lần
Quay về điểm xuất phát
```

với tổng chi phí nhỏ nhất.

---

Ví dụ:

```text
      A
    /   \
   10   20
  /       \
 B---15----C
```

---

Các tour:

```text
A→B→C→A
```

chi phí:

$$
10+15+20=45
$$

---

```text
A→C→B→A
```

cũng:

$$
20+15+10=45
$$

---

Bài toán rất đơn giản để mô tả.

Nhưng cực khó để giải.

---

# 2.5.2 Bruteforce

Nếu cố thử mọi đường đi:

```text
n=4
```

---

Ta có:

$$
(4-1)!
=
6
$$

tour.

---

n=10

$$
9!
=
362880
$$

---

n=20

$$
19!
=
1.2\times10^{17}
$$

---

Không thể.

---

# 2.5.3 Quan sát quan trọng

Giả sử ta đã đi:

```text
A
B
D
```

---

Hiện đang đứng tại:

```text
D
```

---

Liệu thứ tự trước đó:

```text
A→B→D
```

hay

```text
A→C→D
```

có còn quan trọng không?

---

Điều quan trọng thật sự là:

```text
Đã thăm những thành phố nào
```

và

```text
Đang đứng ở đâu
```

---

Đây chính là state.

---

# 2.5.4 Trạng thái DP

Định nghĩa:

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
tập thành phố đã thăm
```

---

```text
u
```

=

```text
thành phố hiện tại
```

---

Ý nghĩa:

$$
dp[mask][u]
$$

=

```text
chi phí nhỏ nhất
để đi qua toàn bộ thành phố trong mask
và kết thúc ở u
```

---

Đây là trái tim của Held-Karp.

---

# 2.5.5 Bitmask là gì?

Ví dụ:

```text
5 thành phố
```

---

Đánh số:

```text
0 1 2 3 4
```

---

Mask:

```text
10110
```

---

nghĩa là:

```text
1 đã thăm
2 đã thăm
4 đã thăm
```

---

Ta lưu toàn bộ tập hợp chỉ bằng:

```cpp
int mask;
```

---

Ví dụ:

```cpp
mask & (1<<i)
```

kiểm tra đã thăm i chưa.

---

```cpp
mask | (1<<i)
```

thêm i.

---

```cpp
mask ^ (1<<i)
```

đảo trạng thái i.

---

Đây là lý do gọi là:

```text
Bitmask DP
```

---

# 2.5.6 Khởi tạo

Xuất phát từ 0.

---

Ta có:

$$
dp[1][0]
=
0
$$

---

vì:

```text
đã thăm thành phố 0
đang đứng ở 0
chi phí = 0
```

---

Các trạng thái khác:

$$
+\infty
$$

---

# 2.5.7 Chuyển trạng thái

Giả sử:

$$
dp[mask][u]
$$

đã biết.

---

Muốn đi tiếp tới:

$$
v
$$

---

Điều kiện:

```cpp
v chưa thuộc mask
```

---

Khi đó:

$$
newMask
=
mask|(1<<v)
$$

---

và:

$$
dp[newMask][v]
=
\min(
dp[newMask][v],
dp[mask][u]
+
dist[u][v]
)
$$

---

Đây là công thức quan trọng nhất chương.

---

# 2.5.8 Minh họa

Giả sử:

```text
0
```

là điểm xuất phát.

---

Trạng thái đầu:

```text
mask = 0001
u = 0
```

---

Đi tới:

```text
2
```

---

Trạng thái mới:

```text
0101
```

---

và:

```text
u = 2
```

---

DP đang xây dần cây tìm kiếm.

---

# 2.5.9 Tại sao đúng?

Đây là Optimal Substructure.

---

Giả sử:

```text
tour tối ưu
```

kết thúc ở:

```text
u
```

---

Trước đó chắc chắn phải có:

```text
tour tối ưu nhỏ hơn
```

kết thúc ở:

```text
v
```

---

Nếu không:

```text
thay bằng tour tốt hơn
```

---

sẽ tạo ra nghiệm tốt hơn.

---

Mâu thuẫn.

---

Đây là chứng minh DP kinh điển.

---

# 2.5.10 Kết quả cuối cùng

Sau khi tính hết.

---

Ta có:

```text
FULL_MASK
```

---

Ví dụ:

```text
11111
```

---

Đã thăm toàn bộ.

---

Đáp án:

$$
\min_u
\left(
dp[FULL][u]
+
dist[u][0]
\right)
$$

---

Tức:

```text
quay về thành phố gốc
```

---

# 2.5.11 Code chuẩn

```cpp
for(mask=0;mask<(1<<n);mask++)
{
    for(u=0;u<n;u++)
    {
        if(dp[mask][u]==INF)
            continue;

        for(v=0;v<n;v++)
        {
            if(mask&(1<<v))
                continue;

            newMask=mask|(1<<v);

            dp[newMask][v]
                =
                min(
                    dp[newMask][v],
                    dp[mask][u]+dist[u][v]
                );
        }
    }
}
```

---

Đây là Held-Karp chuẩn.

---

# 2.5.12 Complexity

Số trạng thái:

$$
2^n
\times
n
$$

---

Mỗi trạng thái:

```text
thử n đỉnh kế tiếp
```

---

Tổng:

$$
O(n^2 2^n)
$$

---

Bộ nhớ:

$$
O(n2^n)
$$

---

# 2.5.13 Giới hạn thực tế

n=15

```text
rất dễ
```

---

n=20

```text
vẫn được
```

---

n=22

```text
khá nặng
```

---

n=25

```text
gần chết
```

---

n=30

```text
không thể
```

---

# 2.5.14 So sánh với Bruteforce

Bruteforce:

$$
n!
$$

---

Held-Karp:

$$
n^22^n
$$

---

Ví dụ:

n=20

---

Bruteforce:

$$
2.4\times10^{18}
$$

---

Held-Karp:

$$
20^2\times2^{20}
$$

$$
\approx4\times10^8
$$

---

Khác biệt thiên văn.

---

# 2.5.15 Quan điểm hình học

Bruteforce:

```text
Duyệt mọi permutation
```

---

Held-Karp:

```text
Gom các permutation
có cùng:
    tập đã thăm
    điểm cuối
```

thành một state.

---

Ví dụ:

```text
A→B→C→D
```

và

```text
A→C→B→D
```

---

Cả hai đều:

```text
đã thăm A,B,C,D
```

và:

```text
đứng ở D
```

---

DP chỉ giữ:

```text
chi phí tốt nhất
```

---

Các đường còn lại bị loại.

---

Đây chính là:

$$
\boxed{
State Compression
}
$$

---

# 2.5.16 TSP và bài Air Conditioner

Bây giờ nhìn lại bài Samsung.

---

Có:

```text
200~400 nhà
```

---

Nếu dùng Held-Karp:

$$
2^{300}
$$

---

Lớn hơn số nguyên tử trong vũ trụ.

---

Không thể.

---

Do đó:

```text
DP Exact
```

không khả thi.

---

# 2.5.17 Ý nghĩa lịch sử

Held-Karp là lần đầu tiên người ta thấy:

```text
NP-hard
```

vẫn có thể giải tối ưu ở kích thước vừa phải.

---

Nó là tổ tiên của:

```text
Branch and Bound
Branch and Cut
Concorde
LKH
VRP Solver
OR-Tools
```

---

# 2.5.18 Một góc nhìn cực kỳ quan trọng

Held-Karp thực chất là:

```text
Bruteforce
+
Memoization
```

---

Nó vẫn xét:

```text
mọi khả năng
```

---

Nhưng:

```text
không xét lại
```

---

Đây là ranh giới giữa:

```text
Greedy
```

và

```text
Exact Search
```

---

# 2.5.19 Điều cần ghi nhớ

Bitmask DP không phải để giải TSP.

TSP chỉ là ví dụ nổi tiếng nhất.

---

Bất cứ khi nào gặp:

```text
Tập phần tử đã chọn
```

---

và:

```text
n ≤ 20~25
```

---

hãy nghĩ ngay:

$$
dp[mask]
$$

hoặc

$$
dp[mask][i]
$$

---

Rất nhiều bài kinh điển thuộc họ này:

* Traveling Salesman Problem
* Assignment Problem
* Set Cover nhỏ
* Steiner Tree
* Hamiltonian Path
* SOS DP
* Broken Profile DP
* Game DP trên tập trạng thái

---

# Tóm tắt chương 2.5

Held-Karp dựa trên state:

$$
\boxed{
dp[mask][u]
}
$$

trong đó:

* `mask` = tập đỉnh đã thăm
* `u` = đỉnh hiện tại

Transition:

$$
\boxed{
dp[mask\cup\{v\}][v]
=
\min(
dp[mask][u]
+
dist(u,v)
)
}
$$

Độ phức tạp:

$$
\boxed{
O(n^22^n)
}
$$

Đây là ví dụ kinh điển nhất của:

```text
State Compression DP
```

và là bước chuyển tiếp tự nhiên từ Dynamic Programming sang chương tiếp theo:

```text
Chương 3
Exact Search
```

nơi ta sẽ học:

```text
Backtracking
Branch & Bound
A*
IDA*
Meet in the Middle
```

và hiểu vì sao nhiều bài NP-hard thực tế lại được giải bằng cách "cắt bỏ cây tìm kiếm" thay vì duyệt toàn bộ.
