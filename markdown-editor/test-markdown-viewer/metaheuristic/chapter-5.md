# Chương 5 — Local Search

Đây là chương đánh dấu một bước chuyển tư duy rất lớn.

Các chương trước đều có tư tưởng:

```text
Greedy:
    Xây nghiệm từ đầu

DP:
    Xét toàn bộ state

Exact Search:
    Duyệt cây nghiệm

Approximation:
    Chứng minh ratio
```

Nhưng Local Search lại nói:

> Tôi không quan tâm nghiệm được tạo ra như thế nào.
>
> Chỉ cần hiện tại có một nghiệm hợp lệ.
>
> Tôi sẽ liên tục sửa nó để tốt hơn.

Đây là nền móng của:

* Simulated Annealing
* Tabu Search
* Variable Neighborhood Search
* Large Neighborhood Search (LNS)
* Adaptive Large Neighborhood Search (ALNS)
* Lin-Kernighan
* Hầu hết VRP/TSP solver hiện đại

---

# 5.1. Ý tưởng cốt lõi

Giả sử có nghiệm:

```text
A → B → C → D → E
```

Chi phí:

```text
120
```

---

Ta thử thay đổi rất nhỏ:

```text
A → B → D → C → E
```

Chi phí:

```text
110
```

---

Tốt hơn.

Giữ lại.

---

Tiếp tục:

```text
A → D → B → C → E
```

Chi phí:

```text
105
```

---

Tốt hơn.

Giữ lại.

---

Lặp lại.

---

Đây chính là:

$$
\boxed{
Local\ Search
}
$$

---

# 5.2. Không gian nghiệm (Solution Space)

Đây là khái niệm quan trọng nhất.

---

Ví dụ TSP với:

```text
A B C D
```

---

Một nghiệm:

```text
A-B-C-D-A
```

---

Nghiệm khác:

```text
A-C-B-D-A
```

---

Tất cả các tour tạo thành:

$$
\boxed{
Solution\ Space
}
$$

---

Có thể hình dung:

```text
      x
   x     x
 x    x     x
   x      x
      x
```

---

Mỗi điểm:

```text
1 nghiệm
```

---

# 5.3. Neighborhood

Khái niệm trung tâm của chương.

---

Cho nghiệm:

```text
S
```

---

Ta định nghĩa:

$$
N(S)
$$

---

là tập các nghiệm:

```text
gần S
```

---

Ví dụ:

```text
ABCDE
```

---

Đổi chỗ hai phần tử:

```text
BACDE
```

---

```text
ACBDE
```

---

```text
ABDCE
```

---

Tất cả tạo thành:

$$
N(S)
$$

---

Đây gọi là:

$$
\boxed{
Neighborhood
}
$$

---

# 5.4. Local Search Framework

Khung chung:

```cpp
current = initial_solution();

while(true)
{
    bestNeighbor =
        best_solution_in_neighborhood();

    if(bestNeighbor not better)
        break;

    current = bestNeighbor;
}
```

---

Đơn giản đáng kinh ngạc.

---

Nhưng cực mạnh.

---

# 5.5. Landscape

Một cách nhìn rất quan trọng.

---

Xem mỗi nghiệm là một điểm.

---

Chi phí:

```text
cao thấp
```

---

tạo thành địa hình:

```text
             *
            / \
           /   \
      *---/     \----
     /
 *--/
```

---

Local Search:

```text
đi xuống dốc
```

---

cho tới khi không xuống được nữa.

---

# 5.6. Local Optimum

Ví dụ:

```text
          *
         / \
        /   \
   *---/     \---
```

---

Đang đứng tại:

```text
*
```

---

Mọi hàng xóm đều tệ hơn.

---

Local Search dừng.

---

Nhưng:

```text
không phải optimum toàn cục
```

---

Đây gọi là:

$$
\boxed{
Local\ Optimum
}
$$

---

# 5.7. Global Optimum

Điểm thấp nhất toàn bộ landscape.

---

```text
      *
     /
    /
   /
  *
 /
*
```

---

Điểm cuối cùng:

```text
*
```

---

là:

$$
\boxed{
Global\ Optimum
}
$$

---

Khó tìm hơn rất nhiều.

---

# 5.8. Hill Climbing

Local Search đơn giản nhất.

---

Mỗi bước:

```text
chọn hàng xóm tốt nhất
```

---

Ví dụ:

```text
Current = 100
```

---

Hàng xóm:

```text
95
110
97
102
```

---

Chọn:

```text
95
```

---

Tiếp tục.

---

# 5.9. Best Improvement

Duyệt toàn bộ neighborhood.

---

Chọn tốt nhất.

---

Ví dụ:

```text
95
93
90
99
```

---

Chọn:

```text
90
```

---

Ưu điểm:

```text
ít vòng lặp
```

---

Nhược:

```text
tốn thời gian
```

---

# 5.10. First Improvement

Gặp nghiệm tốt hơn đầu tiên.

---

Dừng luôn.

---

Ví dụ:

```text
98
96
94
90
```

---

Thấy:

```text
98
```

đã tốt hơn.

---

Chuyển ngay.

---

Ưu điểm:

```text
rất nhanh
```

---

# 5.11. Steepest Descent

Tên khác của:

```text
Best Improvement
```

---

Luôn đi theo hướng dốc nhất.

---

# 5.12. Swap Move

Move kinh điển nhất.

---

Ví dụ:

```text
A B C D E
```

---

Swap:

```text
B
D
```

---

Kết quả:

```text
A D C B E
```

---

# 5.13. Complexity của Swap

Có:

$$
n
$$

phần tử.

---

Số swap:

$$
\frac{n(n-1)}2
$$

---

Tức:

$$
O(n^2)
$$

---

# 5.14. Insert Move

Lấy một phần tử.

---

Bỏ vào vị trí khác.

---

Ví dụ:

```text
A B C D E
```

---

Lấy:

```text
C
```

---

Chèn sau:

```text
E
```

---

Kết quả:

```text
A B D E C
```

---

# 5.15. Remove Move

Xóa phần tử khỏi nghiệm.

---

Rất phổ biến trong:

```text
Set Cover
Facility Location
VRP
```

---

Ví dụ:

```text
Kho đang mở:
1 2 5 8
```

---

Thử đóng:

```text
5
```

---

Nếu vẫn hợp lệ.

---

Giảm chi phí.

---

# 5.16. Move Operator

Swap

Insert

Remove

gọi chung là:

$$
\boxed{
Move\ Operator
}
$$

---

Move quyết định sức mạnh của Local Search.

---

# 5.17. Ví dụ TSP

Tour:

```text
A B C D E
```

---

Neighborhood:

```text
swap(B,C)

swap(B,D)

swap(C,E)

...
```

---

Tổng:

$$
O(n^2)
$$

hàng xóm.

---

# 5.18. Tại sao TSP phù hợp Local Search?

Vì:

* Luôn tồn tại nghiệm hợp lệ
* Dễ sửa nghiệm
* Dễ tính delta cost

---

Đây là thiên đường của Local Search.

---

# 5.19. Delta Evaluation

Sai lầm phổ biến:

---

Mỗi lần swap:

```text
tính lại toàn bộ tour
```

---

$$
O(n)
$$

---

Neighborhood:

$$
O(n^2)
$$

---

Tổng:

$$
O(n^3)
$$

---

Rất chậm.

---

# 5.20. Ý tưởng Delta

Chỉ cạnh bị ảnh hưởng mới thay đổi.

---

Ví dụ:

```text
A-B-C-D-E
```

---

Swap:

```text
B
D
```

---

Chỉ vài cạnh thay đổi.

---

Không cần tính lại cả tour.

---

Tính:

$$
\Delta
$$

---

trong:

$$
O(1)
$$

---

# 5.21. 2-opt

Đây là move nổi tiếng nhất lịch sử TSP.

---

Tour:

```text
A-B-C-D-E-F
```

---

Chọn hai cạnh:

```text
(B,C)

(E,F)
```

---

Cắt chúng.

---

Nối lại:

```text
(B,E)

(C,F)
```

---

Đảo đoạn giữa.

---

# 5.22. Minh họa 2-opt

Trước:

```text
A-B-C-D-E-F
```

---

Sau:

```text
A-B-E-D-C-F
```

---

Đoạn:

```text
C-D-E
```

bị đảo.

---

# 5.23. Ý nghĩa hình học

Hai cạnh giao nhau:

```text
 \ /
  X
 / \
```

---

2-opt biến thành:

```text
 | |
 | |
```

---

Ngắn hơn gần như luôn luôn.

---

Đây là lý do 2-opt hiệu quả.

---

# 5.24. Complexity

Có:

$$
O(n^2)
$$

cặp cạnh.

---

Neighborhood:

$$
O(n^2)
$$

---

Khá nhỏ.

---

# 5.25. 2-opt Local Search

```cpp
while(improved)
{
    improved=false;

    for(i)
      for(j)
      {
          if(delta<0)
          {
              apply_2opt();
              improved=true;
          }
      }
}
```

---

Đây là TSP solver đầu tiên của rất nhiều người.

---

# 5.26. 3-opt

Mạnh hơn 2-opt.

---

Chọn:

```text
3 cạnh
```

---

Cắt.

---

Nối lại theo nhiều cách.

---

Ví dụ:

```text
(A,B)
(C,D)
(E,F)
```

---

Cắt cả ba.

---

Ghép lại.

---

# 5.27. Vì sao 3-opt mạnh hơn?

2-opt chỉ sửa:

```text
một đoạn
```

---

3-opt sửa:

```text
nhiều đoạn cùng lúc
```

---

Có thể thoát nhiều local optimum.

---

# 5.28. Complexity

2-opt:

$$
O(n^2)
$$

---

3-opt:

$$
O(n^3)
$$

---

Đắt hơn rất nhiều.

---

# 5.29. Lin-Kernighan

Thuật toán nổi tiếng nhất của TSP.

---

Ý tưởng:

```text
2-opt chưa đủ
3-opt chưa đủ
```

---

Tự động chọn:

```text
2-opt
3-opt
4-opt
5-opt
...
```

---

một cách thích nghi.

---

Đây là nền tảng của:

```text
LKH Solver
```

---

# 5.30. Local Search trong bài Air Conditioner

Giả sử Greedy tạo:

```text
300 nhà
```

---

Ta có thể:

```text
swap
```

hai nhà.

---

Hoặc:

```text
insert
```

một nhà sang ngày khác.

---

Hoặc:

```text
remove
```

nhà lợi nhuận thấp.

---

Nếu điểm tốt hơn:

```text
accept
```

---

Lặp lại.

---

Đây là cách rất nhiều thí sinh Samsung đạt điểm cao.

---

# 5.31. Những move phổ biến theo lớp bài toán

| Bài toán          | Move                  |
| ----------------- | --------------------- |
| TSP               | 2-opt, 3-opt          |
| VRP               | relocate, swap, cross |
| Scheduling        | swap jobs             |
| Set Cover         | add/remove set        |
| Facility Location | open/close facility   |
| Knapsack          | add/remove item       |

---

# 5.32. Hạn chế của Local Search

Vấn đề lớn nhất:

$$
\boxed{
Local\ Optimum
}
$$

---

Kẹt tại:

```text
đáy nhỏ
```

---

không tới được:

```text
đáy sâu nhất
```

---

Đây là lý do chương tiếp theo ra đời.

---

# Tóm tắt chương 5

Local Search xoay quanh bốn khái niệm:

$$
\boxed{
Solution\ Space
}
$$

$$
\boxed{
Neighborhood
}
$$

$$
\boxed{
Move\ Operator
}
$$

$$
\boxed{
Local\ Optimum
}
$$

Các move quan trọng nhất:

```text
Swap
Insert
Remove
2-opt
3-opt
```

Và một sự thật rất quan trọng:

> Chất lượng của Local Search phụ thuộc ít vào thuật toán hơn là vào cách thiết kế Neighborhood.

Hai Local Search cùng dùng Hill Climbing nhưng khác neighborhood có thể chênh nhau hàng nghìn lần về chất lượng nghiệm.

Đó là lý do trong các solver công nghiệp (TSP, VRP, Scheduling), phần lớn công sức nghiên cứu không nằm ở vòng lặp hill climbing, mà nằm ở việc thiết kế các move như 2-opt, 3-opt, Or-opt, Cross-exchange, Relocate, Ejection Chain, Lin-Kernighan,... để khám phá không gian nghiệm hiệu quả hơn.
