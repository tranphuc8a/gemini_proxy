# Chương 6 — Simulated Annealing

Simulated Annealing (**SA — tôi luyện mô phỏng**) là một bước chuyển rất quan trọng từ **Local Search** sang **Metaheuristic**.

Ở Chương 5, ta đã thấy vấn đề:

```text
                 Global optimum
                      ★
                     /
        local ★-----/
             /
            /
      current
```

Hill Climbing chỉ chấp nhận nghiệm tốt hơn:

$$
\Delta = f(S')-f(S) < 0
$$

đối với bài toán minimization.

Vấn đề là nó có thể mắc kẹt ở **local optimum**.

Simulated Annealing giải quyết bằng một ý tưởng rất đẹp:

> **Đôi khi chấp nhận một bước đi xấu để có cơ hội thoát khỏi local optimum. Nhưng càng về sau, xác suất chấp nhận bước xấu càng giảm.**

---

# 6.1. Bức tranh lớn

Ta đặt ba thuật toán cạnh nhau:

| Thuật toán          | Nghiệm tốt hơn |    Nghiệm xấu hơn |
| ------------------- | -------------: | ----------------: |
| Hill Climbing       |         Accept |            Reject |
| Simulated Annealing |         Accept | **Có thể accept** |
| Random Walk         |         Accept |            Accept |

SA nằm ở giữa:

```text
Hill Climbing
      │
      │ thêm khả năng "đi xuống"
      ▼
Simulated Annealing
      │
      │ nếu bỏ hết tiêu chí
      ▼
Random Walk
```

Nhưng SA không chấp nhận nghiệm xấu một cách tùy tiện.

Nó dùng một **xác suất phụ thuộc vào mức độ xấu và nhiệt độ hiện tại**.

---

# 6.2. Vì sao gọi là "Annealing"?

Tên này lấy cảm hứng từ một quá trình vật lý.

Trong luyện kim:

```text
Kim loại
   ↓
nung nóng
   ↓
các nguyên tử chuyển động mạnh
   ↓
từ từ làm nguội
   ↓
cấu trúc ổn định
```

Nếu làm nguội quá nhanh, vật liệu có thể mắc ở trạng thái không tối ưu.

Nếu làm nguội từ từ, hệ thống có cơ hội tìm được trạng thái năng lượng thấp.

---

SA mô phỏng ý tưởng đó:

| Vật lý                     | Optimization       |
| -------------------------- | ------------------ |
| Trạng thái vật chất        | Nghiệm             |
| Năng lượng                 | Objective          |
| Nhiệt độ \(T\)             | Mức độ "liều lĩnh" |
| Chuyển trạng thái          | Move               |
| Làm nguội                  | Giảm \(T\)         |
| Trạng thái năng lượng thấp | Nghiệm tốt         |

---

# 6.3. Tại sao Hill Climbing bị mắc kẹt?

Xét bài minimization.

Giả sử landscape:

```text
Cost

 ^
 |              ★ Global
 |             / \
 |       ★----/   \
 |      /           \
 |  ★--/             \
 +--------------------------> solution space
```

Ta đang ở:

```text
        ★
       / \
      /   \
-----      -----
```

Mọi hàng xóm đều có cost lớn hơn.

Hill Climbing nói:

> Không có hàng xóm nào tốt hơn → dừng.

Nhưng có thể:

```text
current
   ★
    \
     \   nghiệm xấu hơn
      ★
       \
        ★
         \
          ★ global optimum
```

Ta **phải đi qua một vùng xấu** trước khi tới vùng tốt hơn.

Hill Climbing không làm được.

SA thì có thể.

---

# 6.4. Một ví dụ số cực kỳ quan trọng

Giả sử:

$$
Cost(S)=100
$$

Ta thử một hàng xóm:

$$
Cost(S')=105
$$

Vậy:

$$
\Delta = 105-100=5
$$

Nghiệm mới **xấu hơn 5 đơn vị**.

Hill Climbing:

$$
\boxed{Reject}
$$

SA:

$$
\boxed{Có\ thể\ Accept}
$$

---

Xác suất thường dùng:

$$
\boxed{
P(\text{accept})
=
e^{-\Delta/T}
}
$$

với:

$$
\Delta>0
$$

---

Ví dụ:

$$
T=10
$$

thì:

$$
P=e^{-5/10}
=e^{-0.5}
\approx0.6065
$$

Tức khoảng:

$$
\boxed{60.65\%}
$$

---

Một nghiệm xấu hơn vẫn có khả năng được nhận.

---

# 6.5. Tại sao nhiệt độ lại quan trọng?

Xét:

$$
P=e^{-\Delta/T}
$$

Giữ:

$$
\Delta=5
$$

---

### Nhiệt độ cao

$$
T=100
$$

$$
P=e^{-0.05}\approx0.951
$$

→ **95.1%**

---

### Nhiệt độ trung bình

$$
T=10
$$

$$
P\approx0.607
$$

→ **60.7%**

---

### Nhiệt độ thấp

$$
T=1
$$

$$
P=e^{-5}\approx0.0067
$$

→ **0.67%**

---

Bảng:

| \(T\) | \(P\) |
| ----: | ----: |
|   100 | 95.1% |
|    10 | 60.7% |
|     5 | 36.8% |
|     2 |  8.2% |
|     1 | 0.67% |
|   0.1 | gần 0 |

Đây chính là linh hồn của SA.

---

# 6.6. Ý nghĩa trực giác của Temperature

Có thể hiểu:

### \(T\) rất cao

```text
"Thử đi, biết đâu đường này dẫn đến nơi tốt."
```

SA gần giống random exploration.

---

### \(T\) trung bình

```text
"Tôi vẫn chấp nhận rủi ro,
nhưng phải có lý do."
```

---

### \(T\) thấp

```text
"Đã đến lúc ổn định.
Chỉ nhận bước thực sự tốt."
```

---

Do đó:

$$
\boxed{
T\downarrow
\Rightarrow
Exploration\downarrow
}
$$

và:

$$
\boxed{
T\downarrow
\Rightarrow
Exploitation\uparrow
}
$$

---

# 6.7. Exploration và Exploitation

Đây là khái niệm sẽ xuất hiện rất nhiều ở các chương sau.

## Exploration

Khám phá những vùng mới.

```text
S
 \
  X
   \
    X
     \
      X
```

Có thể chấp nhận nghiệm xấu.

---

## Exploitation

Tập trung cải thiện vùng hiện tại.

```text
     ★
    ★ ★
   ★   ★
    ★ ★
     ★
```

Không muốn đi quá xa.

---

SA thực hiện:

```text
High T
   ↓
Exploration mạnh
   ↓
T giảm
   ↓
Exploitation mạnh
   ↓
Low T
```

---

# 6.8. Công thức đầy đủ của SA

Với bài toán **minimize**:

Cho nghiệm hiện tại \(S\).

Sinh:

$$
S'\in N(S)
$$

Tính:

$$
\Delta=f(S')-f(S)
$$

---

Nếu:

$$
\Delta\le0
$$

thì:

$$
\boxed{Accept}
$$

---

Nếu:

$$
\Delta>0
$$

thì:

$$
\boxed{
Accept\ with\ probability\
e^{-\Delta/T}
}
$$

---

Pseudo-code:

```text
S = initial_solution
best = S
T = T_initial

while T > T_min:

    S' = random_neighbor(S)

    Δ = cost(S') - cost(S)

    if Δ <= 0:
        S = S'
    else:
        accept with probability exp(-Δ / T)

    if cost(S) < cost(best):
        best = S

    T = cool(T)

return best
```

**Điểm rất quan trọng:** `current` và `best` là hai thứ khác nhau.

---

# 6.9. Current Solution vs Best Solution

Đây là lỗi implement SA rất phổ biến.

Giả sử:

```text
best = 100
current = 100
```

SA đi một bước xấu:

```text
current = 120
```

Ta vẫn có:

```text
best = 100
```

Sau đó:

```text
current = 110
```

Sau đó:

```text
current = 90
```

Lúc này:

```text
best = 90
```

---

Do đó luôn duy trì:

```cpp
current
best
```

chứ **không trả `current` khi kết thúc**.

---

# 6.10. Tại sao phải lưu Best?

Vì SA có thể:

```text
best = 80
current = 120
```

ở cuối quá trình.

Điều này hoàn toàn bình thường.

SA cố tình cho phép current đi xấu.

Do đó:

$$
\boxed{
Answer = Best\ Seen\ Solution
}
$$

---

# 6.11. Randomness nằm ở đâu?

Có hai nguồn ngẫu nhiên:

### 1. Chọn neighborhood

```text
random_neighbor(S)
```

---

### 2. Quyết định accept

Sinh:

$$
r\sim U(0,1)
$$

Nếu:

$$
r<P
$$

thì accept.

Code:

```cpp
double p = exp(-delta / T);

if (rand01() < p)
    current = next;
```

---

# 6.12. Một simulation bằng tay

Giả sử:

$$
T=10
$$

Current:

$$
100
$$

---

### Move 1

$$
S'=90
$$

$$
\Delta=-10
$$

Accept.

```text
current = 90
best = 90
```

---

### Move 2

$$
S'=95
$$

$$
\Delta=5
$$

$$
P=e^{-5/10}\approx0.607
$$

Giả sử random:

$$
r=0.4
$$

Vì:

$$
0.4<0.607
$$

Accept.

```text
current = 95
best = 90
```

---

### Move 3

$$
S'=110
$$

$$
\Delta=15
$$

$$
P=e^{-1.5}
\approx0.223
$$

Giả sử:

$$
r=0.8
$$

Reject.

```text
current = 95
best = 90
```

---

### Move 4

$$
S'=85
$$

Accept.

```text
current = 85
best = 85
```

---

Đây chính là SA vận hành.

---

# 6.13. Temperature Schedule

SA không chỉ có công thức acceptance.

Ta còn phải quyết định:

$$
T_0,T_1,T_2,\ldots
$$

---

Tức:

> Làm nguội như thế nào?

Đây gọi là:

$$
\boxed{
Cooling\ Schedule
}
$$

---

# 6.14. Geometric Cooling

Phổ biến nhất:

$$
\boxed{
T_{new}=\alpha T
}
$$

với:

$$
0<\alpha<1
$$

Ví dụ:

$$
\alpha=0.995
$$

---

Nếu:

$$
T_0=1000
$$

thì:

```text
1000
995
990.025
985.075
...
```

---

Đây thường là lựa chọn thực tế tốt.

---

# 6.15. Cooling quá nhanh

Ví dụ:

$$
\alpha=0.5
$$

```text
1000
500
250
125
62
31
15
7
3
1
```

---

SA rất nhanh trở thành:

```text
Hill Climbing
```

---

Hậu quả:

```text
exploration ↓↓↓
local optimum ↑
```

---

# 6.16. Cooling quá chậm

Ví dụ:

$$
\alpha=0.99999
$$

---

SA vẫn random rất lâu.

---

Ưu điểm:

```text
exploration mạnh
```

Nhược:

```text
tốn thời gian
```

---

Vì vậy cần balance.

---

# 6.17. Một Schedule thực tế

Ví dụ:

```cpp
T = 1000;

while (T > 1e-3)
{
    for (int i = 0; i < ITER_PER_TEMP; ++i)
        ...
        
    T *= 0.995;
}
```

Đây là template rất phổ biến.

---

# 6.18. Một vấn đề tinh tế: \(T\) không có đơn vị cố định

Nhiều người viết:

```cpp
T = 1000;
```

rồi nghĩ:

> 1000 là nhiệt độ chuẩn của SA.

Không có chuyện đó.

Nếu objective thay đổi từ:

```text
0 → 100
```

thì \(T=1000\) có thể quá cao.

Nếu objective thay đổi:

```text
0 → 10^9
```

thì \(T=1000\) lại quá thấp.

---

Temperature phải tương thích với **scale của objective delta**.

---

# 6.19. Cách chọn \(T_0\)

Một kỹ thuật thực tế rất hay:

Lấy nhiều move ngẫu nhiên ban đầu.

Tính các:

$$
\Delta>0
$$

Sau đó chọn \(T_0\) sao cho tỷ lệ accept ban đầu khoảng:

```text
60% ~ 90%
```

Ví dụ muốn:

$$
P=0.8
$$

với:

$$
\Delta_{typical}=10
$$

Ta có:

$$
0.8=e^{-10/T}
$$

Lấy log:

$$
\ln(0.8)=-10/T
$$

Suy ra:

$$
T=
-\frac{10}{\ln(0.8)}
\approx44.8
$$

---

Như vậy không cần "đoán mò":

$$
\boxed{
T_0\approx
-\frac{\Delta_{typical}}
{\ln p_0}
}
$$

---

# 6.20. Adaptive Temperature

Thậm chí có thể điều chỉnh \(T\) dựa trên acceptance rate.

Ví dụ:

```text
acceptance rate > 90%
```

→ quá nóng.

Giảm \(T\) mạnh hơn.

---

Nếu:

```text
acceptance rate < 10%
```

→ quá lạnh.

Có thể:

```text
tăng T
```

hoặc làm cooling chậm lại.

---

Đây là một dạng:

$$
\boxed{
Adaptive\ Simulated\ Annealing
}
$$

---

# 6.21. SA và Local Search khác nhau chính xác ở đâu?

Hill Climbing:

$$
P(accept)=
\begin{cases}
1 & \Delta\le0\\
0 & \Delta>0
\end{cases}
$$

---

SA:

$$
P(accept)=
\begin{cases}
1 & \Delta\le0\\
e^{-\Delta/T} & \Delta>0
\end{cases}
$$

---

Đây là khác biệt cốt lõi.

---

# 6.22. Khi \(T\to0\)

Nếu:

$$
T\rightarrow0
$$

và:

$$
\Delta>0
$$

thì:

$$
e^{-\Delta/T}\rightarrow0
$$

---

Do đó:

```text
SA
 ↓ T
 ↓
Hill Climbing
```

---

Có thể coi:

$$
\boxed{
Hill\ Climbing
=
SA\ ở\ nhiệt\ độ\ 0
}
$$

theo trực giác acceptance.

---

# 6.23. Khi \(T\to\infty\)

Với:

$$
\Delta>0
$$

ta có:

$$
e^{-\Delta/T}\rightarrow1
$$

---

Tức nghiệm xấu cũng gần như luôn được chấp nhận.

---

SA trở thành gần:

```text
Random Walk
```

---

Vì vậy:

```text
T cao
  ↓
Random exploration

T thấp
  ↓
Greedy exploitation
```

---

# 6.24. Tại sao SA có thể thoát Local Optimum?

Giả sử:

```text
       local optimum
             ★
            / \
           /   \
          /     \
         ★       \
                  \
                   ★ global
```

Tại local optimum:

```text
mọi neighbor đều xấu hơn
```

Hill Climbing:

```text
STOP
```

SA:

```text
neighbor xấu
    ↓
P > 0
    ↓
có thể đi
    ↓
khám phá vùng khác
```

---

# 6.25. Nhưng SA có thể đi sai rất xa

Đúng.

Đây là trade-off.

Nếu:

$$
T
$$

quá cao:

```text
current
 ↓
xấu
 ↓
xấu
 ↓
xấu
 ↓
...
```

Có thể phá hỏng nghiệm tốt.

Nhưng:

```text
best
```

vẫn giữ nghiệm tốt nhất từng thấy.

---

# 6.26. SA không đảm bảo tìm optimum trong thời gian hữu hạn

Đây là điểm cần phân biệt với Exact Algorithm.

SA là:

$$
\boxed{
Metaheuristic
}
$$

Không có guarantee:

```text
"chạy 1 giây → optimum"
```

---

Về lý thuyết, với những cooling schedule cực kỳ chậm và các giả định phù hợp, SA có các kết quả hội tụ tới global optimum.

Nhưng những schedule lý thuyết đó thường quá chậm để dùng trực tiếp trong thực tế.

---

Do đó trong Competitive Programming / Optimization Challenge:

```text
SA = heuristic
```

---

# 6.27. Markov Chain — trực giác đầu tiên

Đây là phần lý thuyết mới.

Tại thời điểm hiện tại:

$$
S_t
$$

SA chọn:

$$
S_{t+1}
$$

dựa trên:

```text
S_t
+
random move
+
T
```

Nó không cần toàn bộ lịch sử:

```text
S_0,S_1,...,S_{t-1}
```

để quyết định bước tiếp theo.

Chỉ cần:

$$
S_t
$$

và \(T\).

Đây là trực giác của một:

$$
\boxed{
Markov\ Process
}
$$

---

# 6.28. Tại sao acceptance lại có dạng \(e^{-\Delta/T}\)?

Đây không phải công thức bịa ra để "random cho vui".

Trong Statistical Mechanics, phân bố Boltzmann có dạng:

$$
P(E)
\propto
e^{-E/T}
$$

SA mượn nguyên lý này.

Trạng thái có năng lượng thấp:

```text
xác suất cao
```

Trạng thái năng lượng cao:

```text
xác suất thấp
```

---

Tỷ lệ giữa hai trạng thái dẫn đến dạng:

$$
e^{-\Delta/T}
$$

---

Đây là cầu nối rất đẹp giữa:

```text
Physics
   ↓
Probability
   ↓
Markov Chain
   ↓
Combinatorial Optimization
```

---

# 6.29. Một cách hiểu khác về \(e^{-\Delta/T}\)

Công thức:

$$
e^{-\Delta/T}
$$

có hai biến.

### \(\Delta\) tăng

Nghiệm càng tệ.

$$
P\downarrow
$$

---

### \(T\) tăng

Hệ thống càng "liều".

$$
P\uparrow
$$

---

Có thể hình dung:

```text
                 Temperature
                ───────────────►

Bad move        dễ reject     dễ accept
    ↑
    │
    │
    │
    ↓
Badness
```

---

# 6.30. Neighborhood vẫn quan trọng như Chương 5

SA **không tự sinh ra move tốt**.

Nó chỉ quyết định:

```text
accept / reject
```

---

Nếu neighborhood tệ:

```text
SA + bad neighborhood
=
bad algorithm
```

---

Ví dụ TSP:

```text
SA + random swap
```

có thể kém hơn:

```text
SA + 2-opt
```

rất nhiều.

---

Do đó pipeline:

```text
Solution
   ↓
Neighborhood
   ↓
Candidate Move
   ↓
Delta
   ↓
SA Acceptance
   ↓
New Solution
```

---

# 6.31. SA cho TSP

Giả sử tour:

```text
A → B → C → D → E → F → A
```

---

Chọn một move:

```text
2-opt(i,j)
```

Sinh:

```text
A → B → E → D → C → F → A
```

---

Tính:

$$
\Delta
$$

Nếu:

$$
\Delta<0
$$

accept.

Nếu:

$$
\Delta>0
$$

thì:

$$
P=e^{-\Delta/T}
$$

---

Đây là cách SA + 2-opt hoạt động.

---

# 6.32. Vì sao SA + 2-opt rất tự nhiên?

2-opt cung cấp:

```text
Local move
```

SA cung cấp:

```text
Acceptance policy
```

Hai thứ hoàn toàn tách biệt:

```text
        TSP Solver
             │
      ┌──────┴──────┐
      │             │
 Neighborhood    Acceptance
      │             │
    2-opt           SA
```

Đây là design pattern rất quan trọng.

---

# 6.33. SA + Swap cho bài Scheduling

Giả sử lịch:

```text
J1 J2 J3 J4 J5
```

Swap:

```text
J2 ↔ J5
```

thành:

```text
J1 J5 J3 J4 J2
```

---

Nếu makespan:

```text
100 → 90
```

accept.

---

Nếu:

```text
90 → 95
```

vẫn có thể accept.

---

Nhờ vậy SA có thể phá:

```text
local scheduling optimum
```

---

# 6.34. SA + Insert

Ví dụ:

```text
A B C D E
```

Move:

```text
remove C
insert after E
```

→

```text
A B D E C
```

---

SA quyết định có nhận hay không.

---

Rất hữu ích trong:

* Scheduling
* VRP
* Routing
* Sequencing

---

# 6.35. SA + Remove

Ví dụ bài chọn tập:

```text
S1 S2 S3 S4 S5
```

Remove:

```text
S3
```

Nếu nghiệm vẫn feasible:

```text
cost ↓
```

accept chắc chắn.

Nếu cost tăng:

```text
có thể accept
```

---

# 6.36. Một framework code thực tế

```cpp
current = initial_solution();
best = current;

T = T0;

while (T > Tmin)
{
    for (int it = 0; it < ITER_PER_TEMP; ++it)
    {
        next = random_neighbor(current);

        delta = cost(next) - cost(current);

        if (delta <= 0)
        {
            current = next;
        }
        else
        {
            double p = exp(-delta / T);

            if (random01() < p)
                current = next;
        }

        if (cost(current) < cost(best))
            best = current;
    }

    T *= alpha;
}

return best;
```

---

# 6.37. Nhưng code trên vẫn chưa đủ tốt

Trong bài optimization thực tế, ta cần quan tâm:

```text
1. Initial solution
2. Neighborhood
3. Delta evaluation
4. T0
5. Tmin
6. Cooling rate
7. Iterations per temperature
8. Random generator
9. Time limit
10. Best solution
```

---

# 6.38. Initial Solution

Có thể bắt đầu bằng:

### Random

```text
random solution
```

Ưu:

```text
đa dạng
```

Nhược:

```text
chất lượng ban đầu thấp
```

---

### Greedy

```text
Greedy solution
```

Ưu:

```text
best ban đầu tốt
```

Nhược:

```text
có bias
```

---

### Greedy + Randomization

Thường rất tốt.

Ví dụ:

```text
thay vì luôn chọn tốt nhất
```

chọn ngẫu nhiên trong:

```text
Top-K
```

---

# 6.39. Multi-start SA

Một cách cực kỳ đơn giản để tăng độ ổn định:

```text
SA(random seed 1)
SA(random seed 2)
SA(random seed 3)
...
```

Sau đó:

```text
take best
```

---

Nếu có 1 giây:

```text
Run 1
Run 2
Run 3
Run 4
...
```

---

Đây gọi là:

$$
\boxed{
Multi\text{-}Start
}
$$

---

# 6.40. Reheating

Một kỹ thuật rất thú vị.

SA:

```text
T ↓
```

---

Sau một thời gian:

```text
T ≈ 0
```

---

Nếu thấy:

```text
best không cải thiện
```

trong rất lâu.

Ta có thể:

```text
T ← T_reheat
```

---

Ví dụ:

```text
T = 1
```

→

```text
T = 100
```

---

Rồi tiếp tục annealing.

---

Đây gọi là:

$$
\boxed{
Reheating
}
$$

---

# 6.41. Khi nào Reheating hữu ích?

Khi:

```text
SA đã "đóng băng"
```

và:

```text
không cải thiện best
```

---

Landscape có thể:

```text
local optimum
     ↓
plateau
     ↓
không thoát được
```

---

Reheating tạo lại:

```text
exploration
```

---

# 6.42. SA không phải cứ random là tốt

Đây là một hiểu lầm phổ biến.

SA có:

```text
Randomness
```

nhưng:

$$
\boxed{
Randomness \neq Search\ Strategy
}
$$

---

Randomness chỉ là một thành phần.

Hiệu quả đến từ:

```text
Good neighborhood
+
Good acceptance rule
+
Good temperature schedule
+
Good initialization
+
Good evaluation
```

---

# 6.43. Một thí nghiệm tư duy

Giả sử:

```text
Hill Climbing
```

tìm được:

```text
cost = 100
```

SA tìm:

```text
cost = 120
```

Có nghĩa SA tệ hơn?

Không nhất thiết.

Nếu chạy thêm:

```text
SA run 1 = 120
SA run 2 = 95
SA run 3 = 98
SA run 4 = 90
```

thì SA rõ ràng có khả năng vượt Hill Climbing.

---

SA là một thuật toán **stochastic**.

Không nên đánh giá bằng một run duy nhất nếu bài toán không cố định seed.

---

# 6.44. Random Seed

Ví dụ:

```cpp
srand(12345);
```

---

Chạy lại:

```text
same seed
→ same sequence
→ same result
```

---

Rất hữu ích khi debug.

---

Khi benchmark:

```text
seed 1
seed 2
...
seed 30
```

---

Tính:

* Best
* Average
* Median
* Standard deviation

---

# 6.45. SA có thể kết hợp với Hill Climbing

Một pattern rất hay:

```text
SA
 ↓
temperature thấp
 ↓
Hill Climbing
```

---

Tức:

```text
Exploration
    ↓
SA
    ↓
Exploitation
    ↓
Hill Climbing
```

---

Cuối cùng chạy:

```text
2-opt local optimization
```

---

Đây là:

$$
\boxed{
Hybrid\ Metaheuristic
}
$$

---

# 6.46. SA + Local Search

Một pattern còn mạnh hơn:

```text
SA move
   ↓
current solution
   ↓
Local Search
   ↓
local optimum
```

---

Sau đó SA tiếp tục.

Đây có thể xem là một dạng:

$$
\boxed{
Iterated\ Local\ Search\ style
}
$$

hoặc hybrid SA/LS.

---

---

# 6.47. Một ví dụ hoàn chỉnh với TSP

Giả sử:

```text
n = 5
```

Tour:

```text
A-B-C-D-E-A
```

Cost:

$$
100
$$

---

Temperature:

$$
T=20
$$

---

Chọn 2-opt.

Candidate:

```text
A-B-D-C-E-A
```

Cost:

$$
105
$$

---

$$
\Delta=5
$$

---

Acceptance:

$$
P=e^{-5/20}
$$

$$
P\approx0.7788
$$

---

Có:

```text
77.88%
```

khả năng accept.

---

Giả sử random:

$$
r=0.5
$$

---

Accept.

```text
current = 105
best = 100
```

---

Điều này trông có vẻ ngu ngốc:

> "Đang có 100 sao lại đi 105?"

Nhưng đây chính là **cái giá để thoát local optimum**.

---

# 6.48. Sau khi giảm nhiệt độ

Giả sử:

$$
T=1
$$

Candidate vẫn:

$$
105
$$

---

$$
P=e^{-5}
\approx0.0067
$$

---

Chỉ:

```text
0.67%
```

---

Lúc này SA gần như nói:

> Không. Đủ phiêu rồi. Giờ tối ưu nghiêm túc.

---

# 6.49. Đây chính là toàn bộ triết lý SA

```text
              HIGH T
                │
                ▼
       "Cho tôi thử nghiệm"
                │
                │
          Exploration
                │
                ▼
          MEDIUM T
                │
                ▼
       "Cân nhắc kỹ hơn"
                │
                │
       Exploration + 
        Exploitation
                │
                ▼
           LOW T
                │
                ▼
       "Chỉ nhận cái tốt"
                │
                │
           Exploitation
                ▼
             BEST
```

---

# 6.50. Những tham số cần tune

Có 4 tham số quan trọng nhất:

| Parameter        | Ý nghĩa               |
| ---------------- | --------------------- |
| \(T_0\)          | Nhiệt độ ban đầu      |
| \(T_{min}\)      | Nhiệt độ kết thúc     |
| \(\alpha\)       | Cooling rate          |
| Iter/Temperature | Số move mỗi mức nhiệt |

---

Ví dụ:

```cpp
T0 = 1000
Tmin = 0.001
alpha = 0.995
ITER_PER_TEMP = 1000
```

Không có bộ số nào đúng cho mọi bài.

---

# 6.51. Sai lầm 1 — Không lưu best

Sai:

```cpp
return current;
```

Đúng:

```cpp
return best;
```

---

# 6.52. Sai lầm 2 — T giảm quá nhanh

Ví dụ:

```cpp
T *= 0.5;
```

SA gần như trở thành Hill Climbing.

---

# 6.53. Sai lầm 3 — T quá cao

Nếu:

```text
P ≈ 1
```

cho gần như mọi move.

Thì:

```text
SA ≈ Random Walk
```

---

# 6.54. Sai lầm 4 — Neighborhood quá yếu

Ví dụ TSP:

```text
random swap
```

nhưng không có:

```text
2-opt
```

Có thể khiến solver rất khó cải thiện.

---

# 6.55. Sai lầm 5 — Tính objective từ đầu

Ví dụ mỗi 2-opt:

```text
O(n)
```

---

Trong khi có thể:

```text
O(1)
```

với delta.

Đây thường là khác biệt giữa:

```text
100,000 moves
```

và:

```text
100,000,000 moves
```

---

# 6.56. Sai lầm 6 — Không kiểm soát thời gian

Trong optimization challenge, thường có:

```text
time limit
```

Không nên:

```cpp
while (T > Tmin)
```

mà không biết nó chạy bao lâu.

Thực tế tốt hơn:

```cpp
while (elapsed_time < TIME_LIMIT)
```

---

# 6.57. SA trong bài Air Conditioner

Quay lại bài đầu tiên của chúng ta.

Ta có:

```text
200~400 houses
30 days
720 minutes/day
```

---

Một nghiệm có thể biểu diễn:

```text
Day 1:
 H1 H7 H20 ...

Day 2:
 H3 H5 ...

...

Day 30:
 ...
```

---

Neighborhood có thể là:

### Move 1

```text
Move một house
Day A → Day B
```

---

### Move 2

```text
Swap:
house A ở Day 1
house B ở Day 5
```

---

### Move 3

```text
đổi thứ tự hai house
```

---

### Move 4

```text
Remove house
Insert house sang vị trí khác
```

---

SA quyết định:

```text
move tốt → accept
move xấu → đôi khi accept
```

---

Đây là nơi SA bắt đầu cực kỳ phù hợp với bài challenge kiểu này.

---

# 6.58. Nhưng cần chú ý constraint

Bài Air Conditioner có constraint:

$$
time_{day}\le720
$$

---

Nếu một move tạo:

$$
time_{day}>720
$$

thì nghiệm infeasible.

Có hai cách xử lý.

---

## Cách 1 — Reject ngay

```text
if infeasible:
    reject
```

Đây là cách đơn giản nhất.

---

## Cách 2 — Penalty

Định nghĩa:

$$
F(S)
=
Revenue(S)
-
\lambda Violation(S)
$$

hoặc với minimization:

$$
F(S)
=
Cost(S)
+
\lambda Violation(S)
$$

---

Đây là một chủ đề lớn:

$$
\boxed{
Penalty\ Method
}
$$

sẽ còn xuất hiện khi ta nghiên cứu các metaheuristic nâng cao.

---

# 6.59. Hard Constraint vs Soft Constraint

Một điểm rất quan trọng.

### Hard constraint

```text
Vi phạm → nghiệm không hợp lệ
```

Ví dụ:

```text
day time > 720
```

---

### Soft constraint

```text
Vi phạm → phạt
```

Ví dụ:

```text
nhân viên làm thêm giờ
```

---

SA có thể xử lý cả hai, nhưng cách implement khác nhau.

---

# 6.60. SA không nhất thiết phải dùng exponential chính xác?

Trong implementation thực tế, acceptance rule có thể biến đổi.

Công thức kinh điển:

$$
e^{-\Delta/T}
$$

là chuẩn cơ bản.

Nhưng có nhiều biến thể:

* Adaptive SA
* Threshold Accepting
* Record-to-Record Travel
* Fast Annealing
* Very Fast Annealing

---

Điều quan trọng cần nắm trước là:

$$
\boxed{
Bad\ move
\rightarrow
accept\ probabilistically
}
$$

và:

$$
\boxed{
T\downarrow
\rightarrow
bad\ moves\ increasingly\ rejected
}
$$

---

# 6.61. So sánh toàn bộ các chương đã học

Đến đây ta có:

```text
Greedy
   │
   │ xây nghiệm
   ▼
Local Search
   │
   │ sửa nghiệm
   ▼
Hill Climbing
   │
   │ cho phép bước xấu
   ▼
Simulated Annealing
```

---

| Algorithm     |    Exploration |   Exploitation | Guarantee |
| ------------- | -------------: | -------------: | --------- |
| Greedy        |           thấp |            cao | tùy bài   |
| Hill Climbing |           thấp |        rất cao | không     |
| SA            | **cao → thấp** | **thấp → cao** | không     |
| Exact Search  |    có hệ thống |    có hệ thống | **có**    |

---

# 6.62. Mindmap chương 6

```text
6. Simulated Annealing
│
├── Motivation
│   ├── Local Optimum
│   ├── Plateau
│   └── Exploration vs Exploitation
│
├── State
│   ├── Current Solution
│   └── Best Solution
│
├── Neighborhood
│   ├── Swap
│   ├── Insert
│   ├── Remove
│   └── 2-opt / 3-opt
│
├── Acceptance
│   ├── Δ <= 0
│   │     └── Accept
│   │
│   └── Δ > 0
│         └── exp(-Δ/T)
│
├── Temperature
│   ├── T0
│   ├── Tmin
│   ├── Cooling
│   ├── Geometric Cooling
│   ├── Adaptive Cooling
│   └── Reheating
│
├── Engineering
│   ├── Delta Evaluation
│   ├── Random Seed
│   ├── Time Limit
│   └── Multi-start
│
└── Theory
    ├── Boltzmann Distribution
    ├── Markov Chain
    └── Convergence
```

---

# 6.63. Công thức cần thuộc

Có 3 công thức quan trọng.

### ① Cost difference

$$
\boxed{
\Delta=f(S')-f(S)
}
$$

---

### ② Acceptance probability

$$
\boxed{
P=
\begin{cases}
1 & \Delta\le0\\
e^{-\Delta/T} & \Delta>0
\end{cases}
}
$$

---

### ③ Cooling

Phổ biến nhất:

$$
\boxed{
T_{k+1}=\alpha T_k
}
$$

với:

$$
0<\alpha<1
$$

---

# 6.64. Cách tư duy khi gặp bài mới

Khi muốn dùng SA, hãy đi theo checklist:

```text
Bước 1:
    Tôi biểu diễn một solution như thế nào?

Bước 2:
    Objective function là gì?

Bước 3:
    Một move nhỏ nhất là gì?

Bước 4:
    Neighborhood có bao nhiêu move?

Bước 5:
    Có tính Δ nhanh được không?

Bước 6:
    T0 nên dựa trên scale của Δ như thế nào?

Bước 7:
    Cooling rate bao nhiêu?

Bước 8:
    Làm thế nào phát hiện bị stagnation?

Bước 9:
    Có cần reheating không?

Bước 10:
    Có cần multi-start không?
```

Nếu trả lời được 10 câu này thì cậu đã có thể tự triển khai SA cho phần lớn bài optimization challenge ở mức cơ bản–trung cấp.

---

# 6.65. Một insight cực kỳ quan trọng

SA không thực sự cố gắng:

> **luôn đi về phía optimum.**

Nó cố gắng:

> **duy trì khả năng khám phá không gian nghiệm đủ lâu trước khi hội tụ.**

Đây là sự khác biệt về tư duy.

Hill Climbing:

```text
"Better? → đi."
```

SA:

```text
"Better? → đi.

Worse?
    Có tệ quá không?
    Nhiệt độ hiện tại thế nào?
    Nếu chưa quá tệ → thử."
```

Và khi thời gian trôi:

```text
"Thử đủ rồi.
Giờ chỉ nhận cái tốt."
```

Đó chính là **Simulated Annealing**.

---

## Sau chương này cần nắm chắc

Đừng vội nhảy sang code tối ưu phức tạp. Cậu nên thực sự hiểu được chuỗi:

$$
\boxed{
Neighborhood
\rightarrow
Move
\rightarrow
\Delta
\rightarrow
Acceptance
\rightarrow
Temperature
\rightarrow
Cooling
}
$$

Đặc biệt, **SA không phải một thuật toán sinh nghiệm**. Nó là **một cơ chế quyết định có chấp nhận nghiệm hàng xóm hay không**. Vì thế nó có thể ghép với `Swap`, `Insert`, `Remove`, `2-opt`, `3-opt`, hoặc bất kỳ neighborhood nào phù hợp với bài toán.

Đây cũng là chìa khóa để hiểu chương tiếp theo: **Tabu Search**. Nếu SA giải quyết local optimum bằng cách **cho phép đi lùi một cách xác suất**, thì Tabu Search sẽ dùng một triết lý hoàn toàn khác: **ghi nhớ lịch sử để cấm những bước đi dễ khiến nó quay vòng**.
