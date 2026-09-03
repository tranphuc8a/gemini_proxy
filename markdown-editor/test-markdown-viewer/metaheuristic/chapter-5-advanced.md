# Chương 5 (Phần 2) — Local Search ở mức độ chuyên sâu

Ở phần trước, ta mới nhìn Local Search dưới góc độ:

```text
Có nghiệm hiện tại
    ↓
Sinh hàng xóm
    ↓
Nếu tốt hơn thì nhận
    ↓
Lặp lại
```

Nhưng đây chỉ là lớp vỏ.

Trong thực tế, 90% chất lượng của Local Search nằm ở:

```text
1. Thiết kế Neighborhood
2. Đánh giá Move nhanh
3. Thiết kế Move mạnh
4. Thoát Local Optimum
```

Thực tế trong các solver công nghiệp:

```text
Thuật toán = 10%
Neighborhood = 90%
```

---

# 5.33. Tư duy hình học của Neighborhood

Giả sử ta có tập nghiệm:

```text
ABCDE
```

---

Nếu dùng Swap:

```text
BACDE
ACBDE
ABDCE
...
```

---

Nếu dùng Insert:

```text
BCDEA
ACDBE
ADBCE
...
```

---

Nếu dùng 2-opt:

```text
ABEDC
AEDCB
...
```

---

Mỗi cách định nghĩa khác nhau tạo ra:

$$
N(S)
$$

khác nhau.

---

Điều cực kỳ quan trọng:

> Neighborhood quyết định ta nhìn thấy những nghiệm nào.

---

Ví dụ:

```text
Global optimum
      *
     /
    /
   /
  *
 /
*
```

Nếu Neighborhood quá nhỏ:

```text
*
```

không thể thấy nghiệm tốt hơn.

---

Search dừng.

---

# 5.34. Neighborhood Graph

Một góc nhìn rất mạnh.

Xem mỗi nghiệm là một node.

---

Nếu:

```text
S1
```

có thể biến thành

```text
S2
```

bằng một move.

---

Ta nối cạnh.

---

Ví dụ:

```text
S1 --- S2
 |      |
S3 --- S4
```

---

Toàn bộ không gian nghiệm trở thành:

$$
\boxed{
Graph
}
$$

---

Local Search thực chất là:

```text
Đi bộ trên graph này.
```

---

# 5.35. Neighborhood càng lớn càng tốt?

Nghe có vẻ đúng.

---

Ví dụ:

Swap:

$$
O(n^2)
$$

---

3-opt:

$$
O(n^3)
$$

---

5-opt:

$$
O(n^5)
$$

---

Neighborhood lớn hơn.

---

Nhưng:

```text
Duyệt chậm hơn.
```

---

Nên luôn tồn tại trade-off:

| Neighborhood  | Chất lượng | Tốc độ       |
| ------------- | ---------- | ------------ |
| Swap          | thấp       | nhanh        |
| 2-opt         | khá        | nhanh        |
| 3-opt         | cao        | chậm         |
| Lin-Kernighan | rất cao    | rất phức tạp |

---

# 5.36. Hill Climbing thực chất là Gradient Descent rời rạc

Machine Learning:

$$
x_{new}
=
x-\eta\nabla f
$$

---

Optimization tổ hợp:

Không có đạo hàm.

---

Thay vào đó:

```text
Tìm hàng xóm tốt nhất.
```

---

Nên Hill Climbing chính là:

$$
\boxed{
Discrete\ Gradient\ Descent
}
$$

---

# 5.37. First Improvement vs Best Improvement

Giả sử:

Current Cost:

```text
100
```

---

Neighborhood:

```text
99
95
92
90
91
```

---

## First Improvement

Thấy:

```text
99
```

---

Nhận ngay.

---

Cost mới:

```text
99
```

---

## Best Improvement

Duyệt hết.

---

Chọn:

```text
90
```

---

Cost mới:

```text
90
```

---

# 5.38. Khi nào dùng First Improvement?

Neighborhood rất lớn.

---

Ví dụ:

VRP

```text
500 khách
```

---

Swap:

$$
250000
$$

move.

---

Không thể duyệt hết.

---

Lúc đó:

```text
First Improvement
```

thường hiệu quả hơn.

---

# 5.39. Plateau

Một hiện tượng nguy hiểm.

---

Ví dụ:

```text
100
100
100
100
100
```

---

Mọi hàng xóm:

```text
bằng nhau
```

---

Landscape:

```text
_________
```

---

Hill Climbing không biết đi đâu.

---

Đây gọi là:

$$
\boxed{
Plateau
}
$$

---

# 5.40. Ridge

Hiện tượng khác.

---

Landscape:

```text
     /\
    /  \
   /    \
```

---

Đường tốt nhất nằm theo:

```text
đường chéo
```

---

Nhưng move hiện tại:

```text
chỉ đi ngang hoặc dọc
```

---

Không thể tiến.

---

Đây gọi là:

$$
\boxed{
Ridge
}
$$

---

# 5.41. Move Operator là linh hồn của Local Search

Rất nhiều người nghĩ:

```text
Hill Climbing
```

là quan trọng.

---

Sai.

---

Thứ quan trọng nhất là:

$$
\boxed{
Move
}
$$

---

Ví dụ:

TSP.

---

Move:

```text
Swap
```

---

thường cho nghiệm tệ.

---

Move:

```text
2-opt
```

---

cải thiện mạnh.

---

Move:

```text
Lin-Kernighan
```

---

cải thiện cực mạnh.

---

# 5.42. Delta Evaluation

Đây là kỹ thuật sống còn.

---

Giả sử:

TSP

```text
1000 thành phố
```

---

Một tour:

```text
1000 cạnh
```

---

Nếu mỗi move:

```text
tính lại toàn bộ cost
```

---

Ta mất:

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

Không dùng được.

---

# 5.43. Ý tưởng Delta

Thay vì:

```text
newCost
```

---

Ta tính:

$$
\Delta
=
new-old
$$

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

Chỉ:

```text
AB
BC
CD
DE
```

bị thay đổi.

---

Các cạnh khác giữ nguyên.

---

Nên:

$$
\Delta
$$

tính được trong:

$$
O(1)
$$

---

# 5.44. Công thức Delta cho Swap

Giả sử:

```text
... a i b ...
... c j d ...
```

---

Swap:

```text
i
j
```

---

Cạnh cũ:

$$
(a,i)
$$

$$
(i,b)
$$

$$
(c,j)
$$

$$
(j,d)
$$

---

Cạnh mới:

$$
(a,j)
$$

$$
(j,b)
$$

$$
(c,i)
$$

$$
(i,d)
$$

---

Do đó:

$$
\Delta
=
newEdges
-
oldEdges
$$

---

Tính O(1).

---

# 5.45. 2-opt sâu hơn

2-opt là move nổi tiếng nhất của TSP.

---

Tour:

```text
A-B-C-D-E-F
```

---

Cắt:

```text
(B,C)

(E,F)
```

---

Nối:

```text
(B,E)

(C,F)
```

---

Đảo đoạn:

```text
C-D-E
```

---

Thành:

```text
E-D-C
```

---

# 5.46. Tại sao phải đảo?

Nếu không đảo.

---

Tour sẽ bị đứt.

---

Đảo đoạn giúp:

```text
chu trình vẫn hợp lệ
```

---

Đây là bản chất toán học của 2-opt.

---

# 5.47. Delta của 2-opt

Rất đẹp.

---

Cạnh cũ:

$$
(B,C)
$$

$$
(E,F)
$$

---

Cạnh mới:

$$
(B,E)
$$

$$
(C,F)
$$

---

Toàn bộ đoạn giữa đảo chiều.

---

Nhưng với TSP đối xứng:

$$
d(i,j)=d(j,i)
$$

---

Chi phí đoạn giữa không đổi.

---

Nên:

$$
\Delta
=
d(B,E)+d(C,F)
-
d(B,C)-d(E,F)
$$

---

Chỉ cần:

```text
4 cạnh
```

---

O(1).

---

# 5.48. Crossing Elimination

Lý do hình học khiến 2-opt mạnh.

---

Giả sử:

```text
A-----B
 \   /
  \ /
  / \
 /   \
C-----D
```

---

Hai cạnh giao nhau.

---

Theo bất đẳng thức tam giác:

$$
AB+CD
>
AC+BD
$$

---

2-opt loại giao cắt.

---

Giảm chiều dài tour.

---

Đây là lý do chỉ vài vòng 2-opt đã cải thiện cực mạnh.

---

# 5.49. 3-opt

2-opt cắt:

```text
2 cạnh
```

---

3-opt cắt:

```text
3 cạnh
```

---

Ví dụ:

```text
(A,B)

(C,D)

(E,F)
```

---

Sau đó có nhiều cách ghép lại.

---

# 5.50. Có bao nhiêu cách ghép?

Sau khi cắt thành 3 đoạn.

---

Có:

$$
7
$$

cách ghép không tương đương.

---

Đây là nguồn gốc của thuật toán 3-opt chuẩn.

---

# 5.51. Tại sao 3-opt mạnh?

Xét tour:

```text
A-B-C-D-E-F-G-H
```

---

Có những local optimum mà:

```text
mọi 2-opt đều tệ hơn
```

---

Nhưng:

```text
một 3-opt
```

cải thiện rất lớn.

---

Tức là:

```text
2-opt bị kẹt
```

---

```text
3-opt thoát được
```

---

# 5.52. K-opt

Tổng quát:

$$
k-opt
$$

---

Cắt:

```text
k cạnh
```

---

Ghép lại.

---

K càng lớn:

```text
Neighborhood càng mạnh
```

---

Nhưng:

```text
chi phí nổ tung
```

---

# 5.53. Lin-Kernighan

Là phát minh vĩ đại nhất của Local Search cho TSP.

---

Ý tưởng:

Không cố định:

```text
2-opt
```

hay

```text
3-opt
```

---

Mà:

```text
động
```

---

Nếu:

```text
2-opt tốt
```

dừng.

---

Nếu:

```text
3-opt tốt hơn
```

tiếp tục.

---

Nếu:

```text
4-opt
```

có lợi.

---

Tiếp tục.

---

Thực chất:

$$
Variable\ Depth\ Search
$$

---

# 5.54. Tại sao LKH mạnh?

TSP 10.000 thành phố.

---

2-opt:

```text
khá tốt
```

---

3-opt:

```text
rất tốt
```

---

LKH:

```text
gần optimum
```

---

Sai số thường:

```text
< 1%
```

---

# 5.55. Bài học lớn nhất của chương

Khi gặp một bài tối ưu tổ hợp, đừng nghĩ:

```text
Làm sao tìm nghiệm tốt?
```

---

Hãy nghĩ:

```text
Nếu đã có nghiệm,
mình sửa nó như thế nào?
```

---

Đó chính là tư duy Local Search.

Và từ chương này sẽ sinh ra toàn bộ các metaheuristic hiện đại ở chương tiếp theo:

```text
Simulated Annealing
Tabu Search
Iterated Local Search
VNS
LNS
ALNS
Genetic Algorithm
```

vì tất cả các phương pháp đó, ở tận cùng bên trong, đều dựa trên cùng một thứ:

$$
\boxed{
Neighborhood\ Search
}
$$

Chỉ khác nhau ở cách **thoát khỏi Local Optimum** mà thôi.
