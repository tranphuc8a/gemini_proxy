# Chương 4 — Approximation Algorithms

Đây là một trong những chương quan trọng nhất của Combinatorial Optimization, nhưng lại thường bị bỏ qua trong Competitive Programming.

Nếu Chương 3 (Exact Search) trả lời câu hỏi:

> Làm thế nào để tìm nghiệm tối ưu?

thì Chương 4 trả lời:

> Nếu tìm tối ưu quá khó, ta có thể tìm nghiệm gần tối ưu với cam kết toán học được không?

---

# 4.1. Bối cảnh ra đời

Rất nhiều bài toán:

* TSP
* Set Cover
* Vertex Cover
* Facility Location
* Scheduling
* Bin Packing

đều là:

$$
NP-Hard
$$

---

Điều đó có nghĩa:

Không ai biết thuật toán đa thức tìm optimum cho mọi input.

---

Ta có 3 lựa chọn:

### Cách 1

Exact Search

```text
Tìm optimum thật
```

---

Ưu điểm:

```text
100% chính xác
```

---

Nhược điểm:

```text
rất chậm
```

---

### Cách 2

Metaheuristic

```text
SA
GA
Tabu
ALNS
```

---

Ưu điểm:

```text
rất mạnh thực tế
```

---

Nhược điểm:

```text
không có đảm bảo
```

---

### Cách 3

Approximation Algorithm

```text
Nhanh
+
Có chứng minh
```

---

Đây là chương hôm nay.

---

# 4.2. Ý tưởng trung tâm

Thay vì:

```text
Tôi luôn tìm optimum
```

---

Ta nói:

```text
Tôi tìm nghiệm gần optimum
```

---

Nhưng phải chứng minh:

$$
Solution
\approx
OPT
$$

---

Ví dụ:

```text
OPT = 100
```

---

Thuật toán trả:

```text
95
```

---

Rất tốt.

---

Nhưng:

```text
OPT = 100
```

trả:

```text
1
```

---

Rất tệ.

---

Cần có bảo đảm toán học.

---

# 4.3. Approximation Ratio

Đây là khái niệm quan trọng nhất chương.

---

Giả sử:

$$
OPT
$$

là nghiệm tối ưu.

---

$$
ALG
$$

là nghiệm thuật toán.

---

## Với bài toán Minimize

Ví dụ:

```text
TSP
Vertex Cover
Set Cover
```

---

Ta muốn:

$$
ALG
\le
\rho OPT
$$

---

Ví dụ:

$$
\rho=2
$$

---

Nghĩa là:

```text
Thuật toán tệ nhất
cũng chỉ gấp đôi optimum
```

---

Gọi là:

$$
\boxed{2\text{-Approximation}}
$$

---

# 4.4. Ví dụ

OPT:

```text
100
```

---

Thuật toán:

```text
170
```

---

Ratio:

$$
\frac{170}{100}
=
1.7
$$

---

Nếu chứng minh:

$$
ALG
\le
2OPT
$$

---

thì:

```text
1.7 hợp lệ
```

---

# 4.5. Với bài toán Maximize

Ví dụ:

```text
Knapsack
Scheduling
Profit Maximization
```

---

Ta định nghĩa:

$$
ALG
\ge
\frac{OPT}{\rho}
$$

---

Ví dụ:

$$
\rho=2
$$

---

Nghĩa là:

```text
ít nhất bằng 50%
optimum
```

---

# 4.6. Các lớp approximation

---

## Constant Approximation

$$
2
$$

$$
3
$$

$$
5
$$

---

Ví dụ:

```text
Vertex Cover
```

---

2-approx.

---

## Logarithmic Approximation

$$
O(\log n)
$$

---

Ví dụ:

```text
Set Cover
```

---

## PTAS

Polynomial Time Approximation Scheme

---

Cho:

$$
\epsilon>0
$$

---

Thu được:

$$
(1+\epsilon)
$$

approx.

---

Ví dụ:

```text
Euclidean TSP
```

---

## FPTAS

Fully Polynomial PTAS.

---

Mạnh hơn PTAS.

---

# 4.7. Vertex Cover

Đây là bài approximation kinh điển nhất.

---

Cho graph:

$$
G=(V,E)
$$

---

Tìm tập đỉnh nhỏ nhất.

---

Sao cho:

```text
mọi cạnh
```

đều được phủ.

---

Ví dụ:

```text
A --- B
 \   /
   C
```

---

Chọn:

```text
B,C
```

---

phủ hết cạnh.

---

# 4.8. Greedy 2-Approx cho Vertex Cover

Thuật toán:

Chọn cạnh bất kỳ.

```text
(u,v)
```

---

Đưa cả:

```text
u
v
```

vào cover.

---

Xóa mọi cạnh liên quan.

---

Lặp lại.

---

# 4.9. Tại sao là 2-Approx?

Giả sử:

Thuật toán chọn:

$$
k
$$

cạnh.

---

Mỗi cạnh:

```text
phải có ít nhất
1 đầu mút
```

thuộc optimum.

---

Nên:

$$
OPT
\ge
k
$$

---

Thuật toán chọn:

$$
2k
$$

đỉnh.

---

Do đó:

$$
ALG
=
2k
\le
2OPT
$$

---

Đây là chứng minh approximation đầu tiên nhiều sinh viên học.

---

# 4.10. LP Relaxation

Bây giờ tới vũ khí mạnh nhất.

---

Rất nhiều bài NP-hard có dạng:

$$
x_i \in \{0,1\}
$$

---

Ví dụ:

```text
chọn
không chọn
```

---

Đó là Integer Programming.

---

Khó.

---

Ta relax:

$$
x_i \in [0,1]
$$

---

Cho phép:

```text
0.37
0.81
0.12
```

---

Lúc này bài toán thành:

$$
Linear Programming
$$

---

Giải được rất nhanh.

---

# 4.11. Ví dụ Vertex Cover LP

Biến:

$$
x_v
$$

---

Ý nghĩa:

```text
đỉnh v có được chọn không
```

---

Integer:

$$
x_v
\in
\{0,1\}
$$

---

Relax:

$$
0
\le
x_v
\le
1
$$

---

Ràng buộc:

$$
x_u+x_v\ge1
$$

cho mọi cạnh.

---

# 4.12. Tại sao LP hữu ích?

LP cho:

$$
LP^*
$$

---

Tính chất:

$$
LP^*
\le
OPT
$$

---

Vì:

```text
LP cho phép nhiều nghiệm hơn
```

---

Do đó:

```text
LP tạo Lower Bound
```

---

Cực kỳ quan trọng.

---

# 4.13. Rounding

LP cho nghiệm:

```text
0.2
0.8
0.5
0.9
```

---

Nhưng ta cần:

```text
0
1
```

---

Nên phải:

```text
làm tròn
```

---

Đây gọi là:

$$
\boxed{
Rounding
}
$$

---

# 4.14. Ví dụ Vertex Cover

LP nghiệm:

| Vertex | Value |
| ------ | ----- |
| A      | 0.7   |
| B      | 0.3   |
| C      | 1.0   |

---

Rounding:

```text
>=0.5 → 1
<0.5 → 0
```

---

Kết quả:

```text
A=1
B=0
C=1
```

---

# 4.15. Chứng minh 2-Approx

Điều kỳ diệu:

Vertex Cover LP + Rounding

cũng cho:

$$
2
$$

approx.

---

Chứng minh:

Nếu:

$$
x_v \ge 0.5
$$

---

làm tròn thành:

```text
1
```

---

Tổng chi phí tăng nhiều nhất:

```text
gấp đôi
```

---

Do:

$$
LP^*
\le
OPT
$$

---

nên:

$$
ALG
\le
2OPT
$$

---

# 4.16. Quy trình LP Approximation

Hầu hết các bài đều:

```text
NP-Hard
      ↓
IP
      ↓
LP Relaxation
      ↓
Solve LP
      ↓
Rounding
      ↓
Approximation
```

---

Đây là pipeline chuẩn.

---

# 4.17. Set Cover

Một bài cực nổi tiếng.

---

Cho:

$$
U
$$

gồm:

```text
n phần tử
```

---

Có:

$$
S_1,S_2,...,S_m
$$

---

Muốn chọn ít tập nhất.

---

Sao cho phủ toàn bộ:

$$
U
$$

---

# 4.18. Greedy Set Cover

Mỗi bước:

```text
chọn tập
phủ được nhiều phần tử chưa phủ nhất
```

---

Lặp.

---

# 4.19. Kết quả

Thuật toán này có ratio:

$$
H_n
$$

---

Trong đó:

$$
H_n
=
1+\frac12+\frac13+...
$$

---

Xấp xỉ:

$$
\log n
$$

---

Do đó:

$$
\boxed{
O(\log n)
}
$$

approx.

---

Đây là kết quả kinh điển.

---

# 4.20. Primal-Dual Method

Một trong những kỹ thuật mạnh nhất.

---

Nguồn gốc:

```text
Linear Programming Duality
```

---

# 4.21. Duality

Mỗi LP:

```text
Primal
```

---

đều có:

```text
Dual
```

---

Ví dụ:

Primal:

$$
\min c^Tx
$$

---

Dual:

$$
\max b^Ty
$$

---

Tính chất thần kỳ:

$$
Dual
\le
Primal
$$

---

# 4.22. Ý tưởng Primal-Dual

Thay vì:

```text
giải LP
```

rồi:

```text
rounding
```

---

Ta xây đồng thời:

```text
Primal
```

và

```text
Dual
```

---

Để:

```text
tự sinh nghiệm approximation
```

---

# 4.23. Ví dụ trực quan

Vertex Cover.

---

Tăng dần giá trị dual.

---

Khi cạnh nào đó:

```text
đủ căng
```

(tight)

---

Chọn đỉnh tương ứng.

---

Kết quả cuối:

```text
2-approx
```

---

# 4.24. Tại sao Primal-Dual mạnh?

Nó dẫn tới:

* Facility Location
* Steiner Tree
* Set Cover
* Network Design
* Scheduling

---

Rất nhiều thuật toán approximation hiện đại được xây bằng primal-dual.

---

# 4.25. Sơ đồ tư duy chương 4

```text
Approximation Algorithms
│
├── Approximation Ratio
│     ├── Constant
│     ├── Logarithmic
│     ├── PTAS
│     └── FPTAS
│
├── LP Relaxation
│     ├── Integer Program
│     ├── Relax
│     └── LP Lower Bound
│
├── Rounding
│     ├── Deterministic
│     ├── Randomized
│     └── LP-based
│
└── Primal-Dual
      ├── Duality
      ├── Tight Constraints
      └── Approximation Construction
```

---

# Điều quan trọng nhất cần nhớ

Approximation Algorithms là nhánh duy nhất trong tối ưu tổ hợp có thể đồng thời đạt:

```text
Đa thức
+
Có chứng minh chất lượng nghiệm
```

Tư duy cốt lõi:

```text
Exact Search:
    tìm optimum

Approximation:
    chấp nhận gần optimum
    nhưng phải chứng minh được
    gần đến mức nào
```

Và bốn từ khóa quan trọng nhất của chương là:

$$
\boxed{\text{Approximation Ratio}}
$$

$$
\boxed{\text{LP Relaxation}}
$$

$$
\boxed{\text{Rounding}}
$$

$$
\boxed{\text{Primal-Dual}}
$$

Đây chính là nền móng để bước sang các chủ đề sâu hơn như SDP Relaxation, Randomized Rounding, Goemans–Williamson cho Max-Cut, Facility Location, Steiner Tree và các thuật toán approximation hiện đại.
