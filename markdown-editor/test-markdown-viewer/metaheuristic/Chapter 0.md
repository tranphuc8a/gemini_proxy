# Chương 0 — Mathematical Modeling of Combinatorial Optimization

Đây là chương nền tảng cho toàn bộ chuỗi. Mục tiêu không phải học một thuật toán cụ thể, mà là học **cách biến một bài toán thực tế thành một bài toán tối ưu mà ta có thể giải bằng thuật toán**.

Ta sẽ lấy bài **Air Conditioner Cleaning Technician** làm ví dụ xuyên suốt.

---

# 0.1. Optimization problem thực chất là gì?

Một bài toán tối ưu có thể cô đọng thành:

$$
\boxed{\text{Tìm một nghiệm }x\text{ tốt nhất trong tập các nghiệm hợp lệ}}
$$

hay chính xác hơn:

$$
\boxed{
\begin{aligned}
\text{Optimize}\quad & f(x)\\
\text{subject to}\quad & x\in S
\end{aligned}}
$$

Trong đó:

* \(x\): **solution** — một phương án cụ thể.
* \(S\): **feasible set** — tập tất cả phương án hợp lệ.
* \(f(x)\): **objective function** — hàm đánh giá chất lượng phương án.

Ví dụ:

> Có 100 khách hàng, một xe tải, muốn chọn khách nào để giao hàng và đi theo thứ tự nào sao cho lợi nhuận lớn nhất nhưng không vượt quá thời gian.

Ta có:

* \(x\): danh sách khách hàng được phục vụ + thứ tự phục vụ.
* \(S\): tất cả các route không vi phạm giới hạn thời gian.
* \(f(x)\): tổng lợi nhuận.
* Mục tiêu:

$$
\max_{x\in S}f(x)
$$

---

# 0.2. Optimization khác với Decision Problem thế nào?

Đây là một phân biệt rất quan trọng trong lý thuyết thuật toán.

### Decision problem

Chỉ hỏi:

> Có tồn tại một nghiệm thỏa mãn điều kiện không?

Ví dụ:

> Có thể dọn ít nhất 300 căn trong 30 ngày không?

Câu trả lời:

$$
\boxed{\text{YES/NO}}
$$

### Optimization problem

Hỏi:

> Có thể đạt giá trị tốt nhất là bao nhiêu?

Ví dụ:

> Số tiền tối đa có thể kiếm được là bao nhiêu?

Kết quả:

$$
\boxed{309\,688\,200}
$$

Trong thực tế coding contest, ta thường trực tiếp giải **optimization problem**.

---

# 0.3. Ba thành phần quan trọng nhất

Mọi bài toán tối ưu nên được bóc thành ba thứ:

```text
                OPTIMIZATION PROBLEM
                       │
          ┌────────────┼────────────┐
          ↓            ↓            ↓
       Solution     Constraints   Objective
       (x)             (S)          f(x)
```

## 1. Solution

Ta phải trả lời:

> Một nghiệm được biểu diễn như thế nào?

Ví dụ route:

```text
Start
  ↓
House 17
  ↓
House 3
  ↓
House 42
  ↓
House 8
```

Có thể biểu diễn:

```cpp
[17, 3, 42, 8]
```

---

## 2. Constraints

Ta phải trả lời:

> Nghiệm nào được phép?

Ví dụ:

$$
\text{time} \le 720
$$

hoặc:

$$
\text{mỗi nhà chỉ được dọn tối đa một lần}
$$

---

## 3. Objective

Ta phải trả lời:

> Trong các nghiệm hợp lệ, nghiệm nào tốt hơn?

Ví dụ:

$$
\max \text{profit}
$$

---

# 0.4. Parameters và Decision Variables

Đây là bước bắt đầu của **mathematical modeling**.

## Parameters

Là dữ liệu **đã biết trước**.

Ví dụ bài điều hòa:

* vị trí căn nhà;
* loại điều hòa;
* thời gian vệ sinh;
* giá tiền;
* số ngày;
* giới hạn 720 phút/ngày;
* tốc độ di chuyển.

Ta ký hiệu:

$$
H=\{1,2,\ldots,n\}
$$

là tập các căn nhà.

Với nhà \(i\):

$$
(x_i,y_i)
$$

là tọa độ.

Loại nhà:

$$
m_i\in\{1,\ldots,6\}
$$

Thời gian vệ sinh:

$$
t_i=30m_i+30
$$

Do đó:

| Loại | Thời gian |     Giá |
| ---: | --------: | ------: |
|    1 |        60 |  80,000 |
|    2 |        90 | 140,000 |
|    3 |       120 | 180,000 |
|    4 |       150 | 240,000 |
|    5 |       180 | 250,000 |
|    6 |       210 | 300,000 |

Giá trị:

$$
r_i = \text{price}(m_i)
$$

Khoảng cách Manhattan giữa hai nhà:

$$
d_{ij}=|x_i-x_j|+|y_i-y_j|
$$

---

# 0.5. Decision Variables

Đây mới là thứ thuật toán phải **quyết định**.

Ví dụ đơn giản nhất:

$$
z_i=
\begin{cases}
1 & \text{nếu dọn nhà }i\\
0 & \text{nếu không}
\end{cases}
$$

Đây là **binary decision variable**.

Nhưng bài Air Conditioner phức tạp hơn.

Ta không chỉ cần quyết định:

> Dọn nhà nào?

mà còn:

> Dọn vào ngày nào?

và:

> Dọn theo thứ tự nào?

Đây chính là điểm khiến bài toán trở thành **combinatorial optimization**.

---

# 0.6. Selection → Assignment → Ordering

Một cách rất hữu ích để nhìn bài toán tổ hợp là chia quyết định thành ba tầng:

```text
             Tất cả các nhà
                    │
                    ▼
              [SELECTION]
           Chọn nhà nào?
                    │
                    ▼
             [ASSIGNMENT]
          Nhà nào → ngày nào?
                    │
                    ▼
              [ORDERING]
       Trong ngày đi theo thứ tự nào?
                    │
                    ▼
                 ROUTE
```

Bài Air Conditioner có **cả ba**.

### Selection

```text
200 nhà
 ↓
chọn 150 nhà
```

### Assignment

```text
Ngày 1 → 5 nhà
Ngày 2 → 6 nhà
...
Ngày 30 → 4 nhà
```

### Ordering

Ngày 1:

```text
Start → A → C → B → E → D
```

khác với:

```text
Start → D → A → E → C → B
```

mặc dù cùng phục vụ 5 nhà.

Vì chi phí di chuyển khác nhau.

---

# 0.7. Tại sao đây là Combinatorial Optimization?

Bởi vì không gian nghiệm là **rời rạc**, và số lượng phương án tăng cực nhanh.

Giả sử chỉ có \(n\) căn nhà.

Nếu chỉ quyết định chọn/bỏ:

$$
2^n
$$

phương án.

Với \(n=200\):

$$
2^{200}\approx 1.6\times10^{60}
$$

Đây đã là một không gian khổng lồ.

Nếu còn quyết định thứ tự, số permutation là:

$$
n!
$$

và:

$$
200!
$$

còn lớn hơn \(2^{200}\) rất nhiều.

Đây là bản chất của **combinatorial explosion**.

---

# 0.8. Feasible Solution

Không phải mọi solution đều hợp lệ.

Ta gọi:

$$
x\in S
$$

là **feasible solution** nếu nó thỏa tất cả hard constraints.

Ví dụ một ngày:

```text
Start
 ↓
A
 ↓
B
 ↓
C
```

giả sử tổng thời gian:

$$
T=650
$$

thì:

$$
650\le720
$$

→ feasible.

Nhưng:

$$
T=850
$$

thì:

$$
850>720
$$

→ infeasible.

---

# 0.9. Hard Constraint và Soft Constraint

Đây là khái niệm cực kỳ quan trọng khi sau này học metaheuristic.

## Hard constraint

Không được vi phạm.

Ví dụ:

$$
T_d\le720
$$

Nếu vi phạm:

$$
T_d=721
$$

thì solution không hợp lệ.

---

## Soft constraint

Có thể vi phạm nhưng phải trả giá.

Ví dụ giả sử một bài toán yêu cầu:

> Mỗi ngày nên làm tối đa 8 giờ.

Ta có thể cho phép vượt nhưng phạt:

$$
Penalty(x)=\lambda\max(0,T-480)
$$

Sau đó:

$$
f'(x)=f(x)-Penalty(x)
$$

Đây là ý tưởng **penalty method**.

Nó sẽ xuất hiện rất nhiều trong:

* Genetic Algorithm
* Simulated Annealing
* Tabu Search
* Local Search
* ALNS

---

# 0.10. Objective Function

Objective function là thứ nói cho thuật toán biết:

> "Nghiệm này tốt hơn nghiệm kia bao nhiêu?"

Ví dụ:

$$
f(x)=\sum_{i\in visited(x)}r_i
$$

Ta muốn:

$$
\max f(x)
$$

---

## Nhưng bài Air Conditioner có một điểm thú vị

Code không đơn thuần tính:

$$
\text{Revenue}
$$

mà còn có overtime.

Mỗi ngày, nếu hoàn thành công việc sau phút 480 thì nhận:

$$
200
$$

cho mỗi phút overtime.

Vì vậy objective gần với:

$$
\boxed{
f(x)=
\sum_i r_i
+
200\sum_d O_d
}
$$

với:

$$
O_d=\max(0,C_d-480)
$$

trong đó \(C_d\) là thời điểm hoàn thành công việc cuối cùng trong ngày.

Tất nhiên phải cẩn thận với **exact semantics của code**: overtime được cộng khi `move()` thực hiện công việc, nên mô hình chính xác nhất nên lấy thời điểm hoàn thành các job thực sự được phục vụ, không phải mọi chuyển động tới ô trống.

---

# 0.11. Một điểm rất dễ hiểu sai: 480 và 720 khác nhau

Bài có hai mốc:

```text
0                    480             720
|---------------------|---------------|
      regular              overtime
                             
                         hard limit
```

### 480 phút

Không phải hard limit.

Có thể tiếp tục làm.

### 720 phút

Là hard limit.

Không được vượt.

Do đó:

$$
C_d\le720
$$

nhưng:

$$
C_d>480
$$

thì bắt đầu được bonus.

---

# 0.12. Một route cụ thể

Giả sử ngày hôm nay:

```text
Start
  │
  │ 5 phút
  ▼
 A
 │
 │ 10
 ▼
 B
 │
 │ 20
 ▼
 C
```

Giả sử:

$$
t_A=60
$$

$$
t_B=150
$$

$$
t_C=180
$$

Tổng thời gian:

$$
T=5+60+10+150+20+180
$$

$$
T=425
$$

Không overtime.

Nếu thêm một nhà D:

```text
C
│
│ 10
▼
D
```

với:

$$
t_D=120
$$

thì:

$$
T=555
$$

Do đó overtime:

$$
555-480=75
$$

và bonus:

$$
75\times200=15\,000
$$

Đây là một điểm rất thú vị:

> **Một công việc có thể vẫn đáng làm dù nó kéo thời gian vượt 480, bởi overtime tạo thêm reward.**

Nhưng không thể vượt 720.

---

# 0.13. Từ bài toán thực tế → Mathematical Model

Bây giờ ta thử mô hình hóa toàn bộ bài Air Conditioner.

## Tập nhà

$$
H=\{1,\ldots,n\}
$$

## Tập ngày

$$
D=\{1,\ldots,30\}
$$

## Dữ liệu nhà

Mỗi nhà \(i\):

$$
p_i=(x_i,y_i)
$$

$$
t_i=30(m_i+1)
$$

$$
r_i=price(m_i)
$$

Khoảng cách:

$$
d_{ij}=|x_i-x_j|+|y_i-y_j|
$$

---

# 0.14. Một representation rất tự nhiên

Ta có thể biểu diễn solution:

```text
Day 1:  [17, 3, 42, 8]
Day 2:  [91, 5, 13]
Day 3:  [7, 19, 4, 31]
...
Day 30: [...]
```

Tức:

$$
x=
(R_1,R_2,\ldots,R_{30})
$$

với mỗi:

$$
R_d=(i_1,i_2,\ldots,i_k)
$$

là route ngày \(d\).

Đây là **solution representation**.

---

# 0.15. Tính thời gian của một ngày

Giả sử ngày \(d\) có:

$$
R_d=(i_1,i_2,\ldots,i_k)
$$

Vị trí bắt đầu ngày đó là:

$$
s_d
$$

Thời gian:

$$
C_d=
d(s_d,i_1)
+
t_{i_1}
+
\sum_{j=1}^{k-1}
\left[
d(i_j,i_{j+1})+t_{i_{j+1}}
\right]
$$

Hard constraint:

$$
\boxed{C_d\le720}
$$

---

# 0.16. Một đặc điểm quan trọng của code gốc

Trong bài này, **technician không quay về depot sau mỗi ngày**.

`gPosY`, `gPosX` được giữ nguyên khi gọi `nextDay()`.

Do đó:

```text
Day 1:

Start → A → C → B
                │
                └── technician kết thúc ở B


Day 2:

B → D → E → F
```

chứ không phải:

```text
Day 1:

Start → A → C → B → Start

Day 2:

Start → D → E → F
```

Đây là một chi tiết modeling rất quan trọng.

Ta có:

$$
s_{d+1}=last(R_d)
$$

nếu ngày \(d\) có phục vụ nhà.

Vì vậy **route của ngày hôm nay ảnh hưởng đến ngày mai**.

Đây chính là một dạng **inter-period coupling**.

---

# 0.17. Đây là lý do bài không đơn giản là 30 bài toán độc lập

Nếu mỗi ngày đều quay về depot:

```text
Day 1 ──┐
Day 2 ──┤
Day 3 ──┤ → độc lập
...
Day 30 ─┘
```

ta có thể tối ưu từng ngày tương đối độc lập.

Nhưng ở đây:

```text
Day 1
   ↓ vị trí cuối
Day 2
   ↓ vị trí cuối
Day 3
   ↓
...
Day 30
```

nên:

$$
R_d\rightarrow s_{d+1}
$$

và do đó:

$$
R_d
$$

ảnh hưởng tới chi phí của

$$
R_{d+1}
$$

Đây là một trong những thứ khiến việc thiết kế heuristic sau này trở nên thú vị.

---

# 0.18. Objective đầy đủ hơn

Nếu \(V(x)\) là tập các nhà được phục vụ:

$$
Revenue(x)=\sum_{i\in V(x)}r_i
$$

Overtime:

$$
OT(x)=200\sum_{d=1}^{30}\max(0,C_d-480)
$$

nên:

$$
\boxed{
f(x)=Revenue(x)+OT(x)
}
$$

và bài toán:

$$
\boxed{
\max_x f(x)
}
$$

subject to:

$$
C_d\le720,\qquad d=1,\ldots,30
$$

và mỗi nhà:

$$
\boxed{\text{được phục vụ tối đa một lần}}
$$

---

# 0.19. Nhưng representation trên vẫn chưa hoàn toàn đủ

Có một vấn đề:

```text
[17, 3, 42, 8]
```

ta biết thứ tự, nhưng làm sao biết:

* 17 thuộc ngày nào?
* 3 thuộc ngày nào?
* 42 thuộc ngày nào?

Vì vậy representation phải encode cả **partition**.

Có nhiều cách.

### Cách 1 — Nested routes

```cpp
vector<vector<int>> routes(30);
```

Ví dụ:

```cpp
routes[0] = {17, 3, 42, 8};
routes[1] = {91, 5, 13};
```

Đây là representation trực quan nhất.

---

### Cách 2 — Permutation + separator

Ví dụ:

```text
17 3 42 8 | 91 5 13 | 7 19 4 | ...
```

Dấu `|` phân cách ngày.

---

### Cách 3 — Assignment + successor

Có biến:

$$
y_{id}
=
\begin{cases}
1 & \text{nhà }i\text{ thuộc ngày }d\\
0 & \text{ngược lại}
\end{cases}
$$

và biến biểu diễn:

$$
x_{ij}=1
$$

nếu đi từ \(i\) tới \(j\).

Đây là hướng gần với **Integer Programming**.

---

# 0.20. Representation rất quan trọng

Đây là một trong những bài học lớn nhất của optimization:

> **Thuật toán tốt nhưng representation tệ vẫn có thể cho kết quả tệ.**

Ví dụ ta dùng:

```cpp
vector<int> order;
```

để lưu toàn bộ nhà.

Một phép `swap(i,j)` rất dễ thực hiện.

Nhưng nếu solution có 30 ngày thì swap có thể làm:

* ngày A quá 720 phút;
* ngày B còn rất nhiều thời gian;
* thay đổi vị trí cuối ngày;
* thay đổi chi phí ngày hôm sau.

Một representation tốt có thể khiến các phép biến đổi này dễ kiểm soát hơn.

---

# 0.21. Solution Space

Ta định nghĩa:

$$
\mathcal S
$$

là **toàn bộ search space**.

Trong đó:

```text
             Search Space
          /       |       \
       valid    invalid    ...
        │
        └── Feasible Solutions
                 │
                 └── Objective values
```

Ví dụ:

```text
                    ALL SOLUTIONS
                 /                 \
          feasible              infeasible
             │
       ┌─────┼─────┐
       │     │     │
      100   120   150
       │
     score
```

Optimization algorithm thực chất đang cố tìm:

$$
x^*=\arg\max_{x\in S}f(x)
$$

---

# 0.22. Global Optimum

Một nghiệm \(x^*\) là **global optimum** nếu:

$$
f(x^*)\ge f(x)
$$

với mọi feasible \(x\).

Nói đơn giản:

> Không có nghiệm hợp lệ nào tốt hơn nó.

Ví dụ:

```text
Solution     Score

A            100
B            150
C            130
D            180  ← Global optimum
E            120
```

thì:

$$
f(D)=180
$$

là optimum.

---

# 0.23. Local Optimum

Đây là khái niệm sẽ cực kỳ quan trọng từ Chương 5 trở đi.

Giả sử ta định nghĩa:

> Hai solution là hàng xóm nếu chỉ khác nhau bởi một `swap`.

Ta có:

```text
             150
            /   \
          140   145
          /
        130
```

Giả sử solution hiện tại có score 150.

Mọi **neighbor trực tiếp** đều ≤150.

Ta nói nó là:

$$
\boxed{\text{local optimum}}
$$

nhưng chưa chắc là:

$$
\boxed{\text{global optimum}}
$$

Có thể ở xa hơn có:

```text
                    180
                   /
              160
             /
150 ← local optimum
```

Đây chính là lý do Local Search có thể bị mắc kẹt.

---

# 0.24. Neighborhood

Một **neighborhood operator** xác định:

> Từ solution hiện tại, ta cho phép thay đổi như thế nào?

Ví dụ route:

```text
A B C D E
```

## Swap

Đổi hai phần tử:

```text
A D C B E
```

---

## Insert

Lấy một phần tử và chèn nơi khác:

```text
A B C D E

→ A C D B E
```

---

## Remove

```text
A B C D E

→ A B D E
```

---

## Add

```text
A B D E

→ A B C D E
```

---

## 2-opt

```text
A → B → C → D → E
```

cắt hai cạnh rồi đảo một đoạn:

```text
A → B → D → C → E
```

2-opt đặc biệt quan trọng trong routing.

---

# 0.25. Một insight rất quan trọng

**Solution representation** và **neighborhood** là hai thứ khác nhau.

Ví dụ:

```text
Solution representation:
[17, 3, 42, 8]
```

còn:

```text
Neighborhood:
swap two houses
```

Representation trả lời:

> "Nghiệm được lưu như thế nào?"

Neighborhood trả lời:

> "Từ nghiệm này, tôi có thể đi tới những nghiệm nào?"

Sau này:

* Local Search
* Tabu Search
* SA
* VNS
* LNS
* ALNS

đều xoay quanh ý tưởng này.

---

# 0.26. Objective landscape

Ta có thể tưởng tượng:

```text
Score
 ↑
 │                /\       Global optimum
 │       /\      /  \
 │  /\  /  \____/    \
 │ /  \/             \
 │/                    \__
 └──────────────────────────→ Solutions
```

Thuật toán optimization đang tìm cách đi trên **landscape** này.

### Local Search

Thường:

```text
đi lên → đi lên → đi lên → dừng
```

khi gặp local optimum.

### Simulated Annealing

Cho phép đôi lúc:

```text
đi xuống
```

để thoát local optimum.

### Tabu Search

Nhớ những vùng vừa đi qua để tránh quay lại.

### Genetic Algorithm

Duy trì nhiều solution cùng lúc.

### VNS

Thay đổi neighborhood để thoát local optimum.

### LNS

Phá một phần lớn solution rồi xây lại.

Ta sẽ học từng cái sau.

---

# 0.27. Exact vs Heuristic

Từ mathematical model, có một câu hỏi:

> Làm thế nào tìm được \(x^*\)?

Có hai triết lý lớn.

## Exact algorithm

Cố gắng tìm **global optimum có chứng minh**.

Ví dụ:

* brute force;
* dynamic programming;
* branch and bound;
* integer programming;
* branch and cut.

Nếu thuật toán trả:

$$
309\,688\,200
$$

thì có thể chứng minh:

> Không tồn tại solution nào tốt hơn.

---

## Heuristic

Không đảm bảo optimum.

Nhưng cố tìm nghiệm tốt thật nhanh.

Ví dụ:

$$
309\,100\,000
$$

và không biết optimum thật là bao nhiêu.

Nhưng nếu giới hạn thời gian chạy là vài giây thì đây có thể là lựa chọn thực tế.

---

# 0.28. Approximation algorithm nằm ở giữa

Một approximation algorithm có thể cho guarantee.

Ví dụ:

$$
f(x)\ge\frac12 OPT
$$

thì dù không tìm được optimum, ta biết:

> Solution ít nhất bằng 50% optimum.

Đây là khác biệt quan trọng giữa:

**heuristic**

và

**approximation algorithm**.

Heuristic:

$$
\text{thường tốt trong thực tế}
$$

Approximation:

$$
\text{có guarantee toán học}
$$

Không phải heuristic nào cũng là approximation algorithm.

---

# 0.29. Một cách phân loại bài toán cực kỳ hữu ích

Khi gặp một bài mới, hãy hỏi:

### 1. Selection?

> Chọn những phần tử nào?

Ví dụ:

* Knapsack
* Set Cover
* Orienteering

### 2. Ordering?

> Thứ tự nào?

Ví dụ:

* TSP
* scheduling
* sequencing

### 3. Assignment?

> Phần tử nào thuộc nhóm nào?

Ví dụ:

* machine scheduling
* bin packing
* clustering

### 4. Routing?

> Di chuyển qua những node nào và theo thứ tự nào?

Ví dụ:

* TSP
* VRP
* Orienteering

### 5. Partitioning?

> Chia thành các nhóm thế nào?

Ví dụ:

* scheduling
* clustering
* vehicle routing

### 6. Packing?

> Nhét các object vào resource giới hạn thế nào?

Ví dụ:

* Knapsack
* Bin Packing

### 7. Scheduling?

> Công việc nào chạy lúc nào, trên tài nguyên nào?

Ví dụ:

* Job Shop
* Flow Shop
* RCPSP

---

# 0.30. Bài Air Conditioner thuộc những nhóm nào?

Nó không thuộc chỉ một nhóm.

| Thành phần                  | Bản chất                  |
| --------------------------- | ------------------------- |
| Chọn nhà                    | Selection                 |
| Phân nhà vào ngày           | Assignment / Partitioning |
| Sắp thứ tự                  | Ordering                  |
| Di chuyển                   | Routing                   |
| Giới hạn 720 phút           | Resource constraint       |
| Overtime                    | Objective component       |
| 30 ngày                     | Multi-period              |
| Vị trí cuối ngày → ngày sau | Inter-period coupling     |

Đây chính là lý do nó rất thích hợp để học **metaheuristic/combinatorial optimization**.

---

# 0.31. Đừng nhầm Objective với Constraint

Đây là lỗi modeling rất phổ biến.

Ví dụ:

> Mỗi ngày không được vượt quá 720 phút.

Đây là:

$$
C_d\le720
$$

→ **constraint**.

Còn:

> Muốn kiếm nhiều tiền nhất.

là:

$$
\max f(x)
$$

→ **objective**.

Hai thứ hoàn toàn khác nhau.

---

# 0.32. Một ví dụ cực kỳ quan trọng

Giả sử:

```text
Route A: revenue = 100
time = 700

Route B: revenue = 110
time = 800
```

Nếu:

$$
time\le720
$$

là hard constraint:

```text
A → feasible
B → infeasible
```

Không được nói:

> B kiếm nhiều tiền hơn nên chọn B.

B không phải một candidate hợp lệ.

---

# 0.33. Nhưng nếu 720 là soft constraint?

Khi đó có thể:

$$
score(B)=110-\lambda(800-720)
$$

Ví dụ:

$$
\lambda=1
$$

thì:

$$
score(B)=30
$$

Lúc này B có thể bị đánh bại bởi A.

Đây là một cách biến constraint thành penalty.

Nhưng:

> **Không phải lúc nào penalty cũng tương đương hoàn toàn với hard constraint.**

Việc chọn penalty coefficient \(\lambda\) là cả một vấn đề thiết kế thuật toán.

---

# 0.34. Feasibility-first strategy

Một chiến lược rất phổ biến trong heuristic:

> Luôn ưu tiên solution feasible.

Có thể so sánh:

$$
x_1 \prec x_2
$$

nếu:

1. \(x_1\) feasible còn \(x_2\) infeasible;
2. cả hai feasible → score lớn hơn;
3. cả hai infeasible → violation nhỏ hơn.

Ví dụ:

| Solution | Score | Violation |
| -------- | ----: | --------: |
| A        |   300 |         0 |
| B        |   350 |        10 |
| C        |   280 |         0 |

Ta chọn:

$$
A
$$

thay vì B vì B vi phạm hard constraint.

Đây gọi là **constraint-domination / feasibility rules** trong nhiều metaheuristic.

---

# 0.35. Repair

Một cách khác:

```text
Generate solution
       ↓
   infeasible
       ↓
     Repair
       ↓
    feasible
```

Ví dụ route:

```text
A B C D E F G
```

có:

$$
T=760
$$

vượt 720.

Repair có thể:

```text
remove G
```

→

$$
T=680
$$

Feasible.

Đây là tư tưởng rất quan trọng trong:

* Genetic Algorithm;
* LNS;
* ALNS;
* constructive heuristic.

---

# 0.36. Evaluation Function

Trong optimization thực tế, ta thường viết:

```cpp
long long evaluate(const Solution& s);
```

Nó trả về:

$$
f(s)
$$

Ví dụ:

```cpp
score =
    totalRevenue
    + overtimeBonus;
```

Nhưng trong thuật toán lớn, việc `evaluate()` cực kỳ quan trọng.

Nếu có:

$$
n=400
$$

và ta thử:

$$
10^7
$$

solutions/neighborhood moves, mà mỗi lần evaluation mất \(O(n^2)\), chương trình có thể chết vì thời gian.

Do đó sau này ta sẽ học:

$$
\boxed{\text{Delta Evaluation}}
$$

---

# 0.37. Delta Evaluation

Giả sử:

```text
A → B → C → D
```

ta thử swap B và C:

```text
A → C → B → D
```

Không cần tính lại toàn bộ route.

Chỉ cần xem những cạnh thay đổi:

Trước:

$$
A-B,\quad B-C,\quad C-D
$$

Sau:

$$
A-C,\quad C-B,\quad B-D
$$

Ta tính:

$$
\Delta
=
(d_{AC}+d_{CB}+d_{BD})
-
(d_{AB}+d_{BC}+d_{CD})
$$

Thay vì:

$$
O(n)
$$

có thể xuống:

$$
O(1)
$$

cho phần routing.

Đây là một kỹ thuật cực kỳ quan trọng để biến Local Search từ:

> "ý tưởng hay nhưng chạy chậm"

thành:

> "thuật toán chạy được trên contest".

---

# 0.38. Modeling và Algorithm Design liên kết với nhau

Có thể nhìn toàn bộ quá trình:

```text
REAL WORLD
    ↓
Mathematical Model
    ↓
Solution Representation
    ↓
Feasibility
    ↓
Objective Function
    ↓
Search Space
    ↓
Neighborhood
    ↓
Optimization Algorithm
    ↓
Solution
```

Sai ở modeling:

```text
Sai model
   ↓
thuật toán cực kỳ thông minh
   ↓
vẫn giải sai bài
```

Vì vậy **modeling đi trước algorithm**.

---

# 0.39. Một ví dụ nhỏ hoàn chỉnh

Giả sử có 4 nhà:

| Nhà | reward | service | vị trí |
| --- | -----: | ------: | ------ |
| A   |    100 |      60 | (1,1)  |
| B   |    200 |     120 | (2,1)  |
| C   |    300 |     180 | (8,8)  |
| D   |    150 |      60 | (9,8)  |

Start:

$$
(0,0)
$$

Giới hạn:

$$
T\le420
$$

Giả sử chọn:

```text
A → B → C
```

Thời gian:

$$
d(S,A)=2
$$

$$
d(A,B)=1
$$

$$
d(B,C)=13
$$

Service:

$$
60+120+180
$$

nên:

$$
T=2+1+13+60+120+180=376
$$

Feasible.

Revenue:

$$
100+200+300=600
$$

---

Route khác:

```text
A → B → D
```

có thể có:

$$
T<420
$$

nhưng revenue:

$$
100+200+150=450
$$

→ route thứ nhất tốt hơn.

Đây là optimization.

---

# 0.40. Nhưng greedy có thể chọn sai

Giả sử:

```text
A: reward 300, time 200
B: reward 290, time 190
C: reward 280, time 190
```

với budget:

$$
380
$$

Greedy theo reward chọn A:

$$
300
$$

rồi không thể chọn B/C.

Nhưng:

$$
B+C=570
$$

không được.

Ví dụ này chưa thể hiện failure tốt. Hãy đổi:

```text
A: reward 300, time 210
B: reward 220, time 140
C: reward 220, time 140
```

budget:

$$
280
$$

Greedy:

$$
A=300
$$

Optimal:

$$
B+C=440
$$

Đây chính là lý do:

> **"Chọn thứ có reward lớn nhất" không đồng nghĩa với "tối ưu".**

Đây sẽ là chủ đề Chương 1.

---

# 0.41. Density cũng chỉ là heuristic

Ta có thể tính:

$$
density_i=\frac{r_i}{t_i}
$$

Ví dụ:

| Nhà | Reward | Time | Density |
| --- | -----: | ---: | ------: |
| A   |    300 |  210 |    1.43 |
| B   |    220 |  140 |    1.57 |
| C   |    220 |  140 |    1.57 |

Có thể chọn B/C trước.

Nhưng bài Air Conditioner còn có:

$$
\text{travel time}
$$

nên density chính xác hơn phải cân nhắc:

$$
\frac{\text{reward}}{\text{service time + marginal travel time}}
$$

Nhưng **marginal travel time phụ thuộc vào route hiện tại**.

Đây là lý do các heuristic ngày càng phức tạp.

---

# 0.42. Một insight quan trọng: "giá trị của một node không cố định"

Trong Knapsack:

$$
value_i
$$

thường cố định.

Nhưng trong routing:

```text
value of House A
```

không chỉ phụ thuộc vào A.

Nó phụ thuộc:

```text
A
+
vị trí hiện tại
+
node trước A
+
node sau A
+
ngày hiện tại
+
thời gian còn lại
+
ảnh hưởng đến ngày mai
```

Ví dụ:

```text
Current position = P

P ─── 2 ─── A ─── 2 ─── B
```

thêm A rất rẻ.

Nhưng:

```text
P ─── 30 ─── A ─── 30 ─── B
```

thêm A rất đắt.

Vì vậy:

$$
\boxed{\text{Marginal value depends on context}}
$$

Đây là một trong những lý do routing khó hơn Knapsack thuần túy.

---

# 0.43. Một cách nhìn sâu hơn: Optimization là Search

Sau khi modeling, ta có:

$$
S=\{\text{all feasible solutions}\}
$$

Ta cần tìm:

$$
\arg\max_{x\in S}f(x)
$$

Có thể hình dung:

```text
                SEARCH SPACE
                     │
       ┌─────────────┼─────────────┐
       ↓             ↓             ↓
      x₁            x₂            x₃
       │
       ↓
      x₄
       │
       ↓
      x₅
```

Mỗi thuật toán chỉ khác nhau ở:

> **Nó khám phá search space như thế nào?**

---

# 0.44. Các thuật toán sau thực chất là các chiến lược search khác nhau

| Thuật toán     | Cách nhìn                                             |
| -------------- | ----------------------------------------------------- |
| Brute Force    | Thử tất cả                                            |
| Backtracking   | Thử có cắt nhánh                                      |
| Branch & Bound | Thử + bound                                           |
| DP             | Gộp các trạng thái tương đương                        |
| Greedy         | Đi theo lựa chọn có vẻ tốt nhất                       |
| Local Search   | Đi sang neighbor tốt hơn                              |
| SA             | Đôi lúc chấp nhận bước xấu                            |
| Tabu           | Tránh quay lại vùng vừa đi                            |
| GA             | Tiến hóa một population                               |
| GRASP          | Randomized greedy + local search                      |
| ILS            | Perturb solution + local search                       |
| VNS            | Đổi neighborhood                                      |
| LNS            | Phá lớn + xây lại                                     |
| ALNS           | Chọn adaptive operator                                |
| MIP            | Tìm nghiệm trong không gian biến với relaxation/bound |

Đây là **bức tranh tổng thể** mà các chương sau sẽ lần lượt giải thích.

---

# 0.45. Một framework tư duy rất quan trọng

Khi gặp một bài optimization mới, **đừng lập tức nghĩ đến thuật toán**.

Hãy đi theo thứ tự:

### Bước 1 — What is a solution?

> Một nghiệm cụ thể trông như thế nào?

### Bước 2 — What are the decisions?

> Tôi thực sự phải quyết định những gì?

### Bước 3 — What are the hard constraints?

> Điều gì tuyệt đối không được vi phạm?

### Bước 4 — What is the objective?

> "Tốt" nghĩa là gì?

### Bước 5 — How large is the search space?

> Có thể brute force không?

### Bước 6 — What structure does the problem have?

> Selection? Routing? Scheduling? Assignment?

### Bước 7 — Can we exploit structure?

> DP? Greedy? Graph algorithm? MIP?

### Bước 8 — If exact is too expensive?

> Heuristic nào phù hợp?

### Bước 9 — How do we represent the solution?

### Bước 10 — What neighborhood / move can we use?

Đây chính là quy trình từ **model → algorithm**.

---

# 0.46. Áp dụng framework vào bài Air Conditioner

Ta có thể tóm tắt:

| Thành phần             | Air Conditioner                   |
| ---------------------- | --------------------------------- |
| Solution               | 30 routes                         |
| Decision               | chọn + phân ngày + sắp thứ tự     |
| Hard constraint        | mỗi ngày ≤ 720 phút               |
| Objective              | revenue + overtime                |
| Resource               | 720 phút/ngày                     |
| Travel                 | Manhattan distance                |
| Service                | 60–210 phút                       |
| State coupling         | vị trí cuối ngày                  |
| Search space           | cực lớn                           |
| Problem structure      | routing + selection + scheduling  |
| Natural exact approach | rất khó khi \(n\) lớn             |
| Natural heuristic      | greedy/local search/metaheuristic |

---

# 0.47. Ba khái niệm cần thuộc lòng

Nếu chỉ nhớ **ba công thức** của chương này, hãy nhớ:

### ① Feasible solution

$$
\boxed{x\in S}
$$

### ② Objective

$$
\boxed{f(x)}
$$

### ③ Optimal solution

$$
\boxed{
x^*=\arg\max_{x\in S}f(x)
}
$$

hoặc nếu minimization:

$$
\boxed{
x^*=\arg\min_{x\in S}f(x)
}
$$

Toàn bộ optimization gần như xoay quanh ba thứ này.

---

# 0.48. Và bốn khái niệm phải phân biệt

```text
Solution
   │
   ├── Feasible? ──→ yes/no
   │
   └── Objective ──→ score
```

| Khái niệm | Câu hỏi                         |
| --------- | ------------------------------- |
| Solution  | Phương án là gì?                |
| Feasible  | Phương án có hợp lệ không?      |
| Objective | Phương án tốt đến mức nào?      |
| Optimal   | Có phương án nào tốt hơn không? |

Đừng trộn bốn khái niệm này với nhau.

---

# 0.49. Bài tập cuối chương

Trước khi sang Chương 1, mình khuyên cậu tự thử modeling 3 bài sau.

### Bài 1 — Knapsack

Có:

```text
n items
weight[i]
value[i]
capacity C
```

Hãy xác định:

* Solution;
* Decision variable;
* Constraint;
* Objective;
* Feasible solution;
* Optimal solution.

---

### Bài 2 — TSP

Có \(n\) thành phố và khoảng cách \(d_{ij}\).

Hãy xác định:

* Solution representation;
* Objective;
* Constraint;
* Search space;
* Neighborhood nếu dùng Local Search.

---

### Bài 3 — Air Conditioner

Hãy tự viết bằng toán học:

$$
\boxed{
\text{Solution}
}
$$

$$
\boxed{
\text{Hard constraints}
}
$$

$$
\boxed{
\text{Objective}
}
$$

và đặc biệt giải thích:

> **Tại sao route của ngày 1 có thể ảnh hưởng đến score của ngày 2?**

Nếu cậu nắm được câu này, cậu đã hiểu một trong những điểm modeling quan trọng nhất của bài.

---

## Chốt Chương 0

Điểm cốt lõi của chương này là:

$$
\boxed{
\text{Real Problem}
\rightarrow
\text{Model}
\rightarrow
\text{Search Space}
\rightarrow
\text{Optimization Algorithm}
}
$$

Và với bài Air Conditioner:

$$
\boxed{
\text{Selection}
+
\text{Assignment}
+
\text{Ordering}
+
\text{Routing}
+
\text{Multi-period constraints}
}
$$

Đó là lý do bài này không chỉ đơn giản là "đi tìm đường ngắn nhất". Nó nằm rất gần họ bài **Orienteering / routing with profits**, vốn được mô tả như sự kết hợp giữa lựa chọn điểm cần ghé và quyết định thứ tự route dưới ràng buộc tài nguyên/thời gian.

**Chương 1 tiếp theo sẽ là Greedy — từ việc hiểu model ở trên, ta sẽ học cách xây dựng một nghiệm đầu tiên cực nhanh, tại sao greedy hấp dẫn, tại sao nó thường sai, và quan trọng nhất: làm thế nào thiết kế một greedy "có chất lượng" cho bài Air Conditioner.**
