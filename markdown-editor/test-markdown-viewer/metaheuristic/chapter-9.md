# Chương 9 — GRASP

## Greedy Randomized Adaptive Search Procedure

GRASP là một chương rất đáng học sau Greedy + Local Search, bởi vì nó gần như **lấy hai thứ cậu đã học ở Chương 1 và Chương 5, rồi ghép chúng thành một metaheuristic hoàn chỉnh**:

$$
\boxed{
\text{Greedy Construction}
+
\text{Randomization}
+
\text{Local Search}
}
$$

GRASP được Feo và Resende trình bày thành một metaheuristic cho combinatorial optimization; bài báo kinh điển *Greedy Randomized Adaptive Search Procedures* xuất bản năm 1995 trên *Journal of Global Optimization*. ([Bishtref][1])

Một điểm rất quan trọng ngay từ đầu:

> **GRASP không phải "Greedy nhưng thêm random một chút".**

Nó là một **multi-start metaheuristic**: mỗi iteration tạo một nghiệm ban đầu bằng randomized greedy construction, sau đó chạy local search từ nghiệm đó, và giữ nghiệm tốt nhất trong toàn bộ các lần chạy. ([Springer Nature Link][2])

---

# 9.1. Vị trí của GRASP trong toàn bộ lộ trình

Ta đã đi qua:

```text
Chương 1
Greedy
   │
   │ xây một nghiệm tốt nhanh
   ▼
Solution
```

và:

```text
Chương 5
Local Search
   │
   │ cải thiện nghiệm hiện tại
   ▼
Local Optimum
```

GRASP ghép chúng:

```text
             ┌─────────────────────┐
             │ Randomized Greedy   │
             │ Construction         │
             └──────────┬──────────┘
                        ↓
                 Initial Solution
                        ↓
             ┌─────────────────────┐
             │     Local Search    │
             └──────────┬──────────┘
                        ↓
                 Local Optimum
                        ↓
                 Best-so-far
                        ↓
                   repeat
```

Tức là:

$$
\boxed{
GRASP =
\text{Repeated Randomized Greedy + Local Search}
}
$$

---

# 9.2. Tại sao cần random?

Đây là câu hỏi cốt lõi.

Giả sử ta có một greedy algorithm.

Ở mỗi bước:

> luôn chọn candidate tốt nhất.

Ví dụ:

```text
Step 1 → A
Step 2 → B
Step 3 → D
Step 4 → C
```

thì chạy lại 100 lần:

```text
A B D C
A B D C
A B D C
...
```

Ta chỉ có **một starting point**.

Sau đó local search cũng bắt đầu từ đúng điểm đó:

```text
Greedy
   ↓
S
   ↓
Local Search
   ↓
Local Optimum L
```

Chạy lại chẳng giúp gì nhiều.

---

# 9.3. Ý tưởng của GRASP

Thay vì:

```text
always choose best
```

ta làm:

```text
mostly choose good
but sometimes choose another good candidate
```

Ví dụ:

```text
Candidates:

A = cost 10
B = cost 12
C = cost 13
D = cost 30
E = cost 100
```

Greedy thuần túy:

```text
A
```

GRASP:

```text
A / B / C
```

được đưa vào một tập gọi là:

$$
\boxed{RCL = Restricted\ Candidate\ List}
$$

rồi chọn **ngẫu nhiên** một phần tử trong RCL.

---

# 9.4. Restricted Candidate List — RCL

Đây là khái niệm trung tâm của GRASP.

Tại mỗi bước construction, ta có:

$$
C
=
\text{candidate set}
$$

Mỗi candidate có một greedy cost:

$$
g(c)
$$

Với minimization:

$$
c^*=\arg\min_{c\in C}g(c)
$$

Greedy thuần túy chọn:

$$
c^*
$$

GRASP tạo:

$$
RCL\subseteq C
$$

chứa những candidate đủ tốt, rồi:

$$
c\sim Uniform(RCL)
$$

([Wikipedia][3])

---

# 9.5. Có hai cách xây RCL phổ biến

## Cách 1 — Cardinality-based RCL

Chọn \(k\) candidate tốt nhất.

Ví dụ:

```text
A 10
B 12
C 13
D 17
E 30
```

với:

$$
k=3
$$

thì:

```text
RCL = {A,B,C}
```

sau đó random:

```text
A hoặc B hoặc C
```

Cách này rất dễ implement.

---

# 9.6. Cách 2 — Threshold-based RCL

Đây là cách kinh điển hơn về mặt lý thuyết.

Với minimization:

$$
g_{\min}=\min_{c\in C}g(c)
$$

$$
g_{\max}=\max_{c\in C}g(c)
$$

chọn:

$$
RCL=
\left\{
c\in C:
g(c)
\le
g_{\min}
+
\alpha(g_{\max}-g_{\min})
\right\}
$$

với:

$$
0\le\alpha\le1
$$

Đây chính là một trong những cách điều khiển **greediness ↔ randomness** của GRASP. ([DOI][4])

---

# 9.7. Ý nghĩa của \(\alpha\)

Đây là parameter quan trọng nhất của GRASP.

### \(\alpha=0\)

Ta có:

$$
RCL=\{c:g(c)=g_{\min}\}
$$

Tức là:

```text
GRASP ≈ Greedy
```

construction gần như deterministic.

---

### \(\alpha=1\)

Toàn bộ candidate:

```text
RCL = C
```

nếu dùng threshold trên toàn range.

Tức là:

```text
construction ≈ random
```

---

### \(0<\alpha<1\)

Ta có:

```text
Greedy <────── GRASP ──────> Random
```

hay:

$$
\boxed{
\alpha
=
\text{degree of randomization}
}
$$

Các tài liệu GRASP mô tả chính xác vai trò này của \(\alpha\): nhỏ thì thiên greedy, lớn thì tăng diversification. ([Springer Nature Link][5])

---

# 9.8. Ví dụ trực quan

Giả sử:

```text
candidate cost

A = 10
B = 11
C = 12
D = 15
E = 25
```

Ta có:

$$
g_{\min}=10
$$

$$
g_{\max}=25
$$

Chọn:

$$
\alpha=0.2
$$

Threshold:

$$
10+0.2(25-10)
=
13
$$

Do đó:

```text
RCL = {A,B,C}
```

Không cho D/E vào.

Sau đó random:

```text
A / B / C
```

---

# 9.9. Điều tuyệt vời ở đây

GRASP không random mù quáng.

Nó không làm:

```text
choose random candidate from C
```

mà làm:

```text
        C
        │
        ▼
  ┌───────────────┐
  │ Greedy Filter │
  └───────┬───────┘
          ↓
         RCL
          ↓
       Random
```

Do đó:

$$
\boxed{
Randomness\ có\ định\ hướng
}
$$

Đây là điểm khiến GRASP khác random search.

---

# 9.10. Từ "Greedy Randomized" sang "Adaptive"

Từ **Adaptive** cũng rất quan trọng.

Giả sử ta đang xây solution từng bước:

```text
S0 = ∅
```

Chọn candidate:

```text
c1
```

ta được:

$$
S_1=S_0\cup\{c_1\}
$$

Bây giờ candidate tiếp theo được đánh giá **trên \(S_1\)**.

Sau khi chọn \(c_2\):

$$
S_2=S_1\cup\{c_2\}
$$

thì greedy values lại thay đổi.

Tức là:

```text
Candidates at step 1
        ↓
      choose
        ↓
solution changed
        ↓
recompute candidate quality
        ↓
Candidates at step 2
        ↓
      choose
```

Đó chính là:

$$
\boxed{Adaptive}
$$

---

# 9.11. Ví dụ TSP

Ta đang ở city:

```text
A
```

Các city chưa thăm:

```text
B C D E
```

distance:

| City | Distance |
| ---- | -------: |
| B    |        3 |
| C    |        5 |
| D    |        8 |
| E    |       20 |

Greedy:

```text
A → B
```

GRASP có thể:

```text
RCL = {B,C}
```

và random chọn:

```text
C
```

Bây giờ ở:

```text
A → C
```

distance tới các city còn lại **hoàn toàn khác**.

Ta lại tính:

```text
B
D
E
```

và xây RCL mới.

Do đó:

$$
RCL_t=f(S_t)
$$

chứ không phải một RCL cố định.

---

# 9.12. Construction phase

Đây là phase đầu tiên của GRASP.

Pseudocode:

```text
Construct():

    S ← empty solution

    while S is not complete:

        C ← feasible candidates

        evaluate greedy cost of each c ∈ C

        RCL ← candidates sufficiently good

        c ← random choice from RCL

        S ← S ∪ {c}

    return S
```

Tài liệu GRASP chính thống cũng xem **solution construction** và **local search** là hai building blocks cơ bản. ([Springer Nature Link][2])

---

# 9.13. Local Search phase

Sau khi construction xong:

$$
S
$$

ta chạy local search:

```text
S
 ↓
N(S)
 ↓
choose improving neighbor
 ↓
S'
 ↓
N(S')
 ↓
...
 ↓
local optimum
```

Có thể dùng:

* Hill Climbing;
* Best Improvement;
* First Improvement;
* 2-opt;
* Swap;
* Insert;
* Tabu Search;
* SA;
* hoặc một local search custom.

GRASP vì thế **không tự định nghĩa một neighborhood cụ thể**; neighborhood phụ thuộc bài toán. ([ScienceDirect][6])

---

# 9.14. Một GRASP iteration

Toàn bộ một iteration:

$$
\boxed{
S
\leftarrow
RandomizedGreedy()
}
$$

sau đó:

$$
\boxed{
S'
\leftarrow
LocalSearch(S)
}
$$

rồi:

$$
Best\leftarrow\min(Best,S')
$$

Vậy:

```text
                 iteration i
                      │
                      ▼
             Randomized Greedy
                      │
                      ▼
                 S_initial
                      │
                      ▼
                 Local Search
                      │
                      ▼
                 S_local_opt
                      │
                      ▼
               update Best
```

---

# 9.15. GRASP đầy đủ

```text
GRASP():

    best ← ∅

    for iteration = 1..I:

        S ← randomized_greedy_construction()

        S ← local_search(S)

        if f(S) < f(best):
            best ← S

    return best
```

Đây là skeleton cốt lõi của GRASP. ([Optimization Online][7])

---

# 9.16. Một ví dụ hoàn chỉnh: Maximum Coverage

Ta có:

```text
Universe:

{1,2,3,4,5,6,7,8}
```

Có các set:

```text
A = {1,2,3,4}
B = {3,4,5}
C = {5,6,7}
D = {7,8}
E = {1,6,8}
```

Giả sử chỉ được chọn:

$$
k=2
$$

Mục tiêu:

$$
\max |\text{covered elements}|
$$

---

# 9.17. Greedy thuần túy

Bắt đầu:

$$
S=\emptyset
$$

Marginal gain:

| Set | Gain |
| --- | ---: |
| A   |    4 |
| B   |    3 |
| C   |    3 |
| D   |    2 |
| E   |    3 |

Greedy:

```text
A
```

Coverage:

```text
{1,2,3,4}
```

Bây giờ:

| Set | Additional gain |
| --- | --------------: |
| B   |               1 |
| C   |               3 |
| D   |               2 |
| E   |               2 |

Greedy chọn:

```text
C
```

Kết quả:

```text
A + C
```

coverage:

```text
{1,2,3,4,5,6,7}
```

score:

$$
7
$$

---

# 9.18. GRASP

Bước 1:

```text
A = 4
B = 3
C = 3
D = 2
E = 3
```

Giả sử RCL:

```text
{A,B,C,E}
```

Random chọn:

```text
B
```

Coverage:

```text
{3,4,5}
```

Bước 2:

| Set | Marginal gain |
| --- | ------------: |
| A   |             3 |
| C   |             3 |
| D   |             2 |
| E   |             3 |

RCL:

```text
{A,C,E}
```

giả sử chọn:

```text
E
```

Coverage:

```text
{1,3,4,5,6,8}
```

score:

$$
6
$$

Local Search có thể thử swap:

```text
B + E
→
A + C
```

và tìm được:

$$
7
$$

Iteration này cuối cùng vẫn đạt solution tốt.

Iteration tiếp theo có thể tạo starting point hoàn toàn khác.

---

# 9.19. Điều quan trọng: GRASP tìm **basin of attraction**

Hãy tưởng tượng search space:

```text
             Global optimum
                  ★
                 / \
                /   \
               /     \
        ______/_______\______
             basin A

       local optimum
             ▲
            / \
           /   \
```

Local Search từ một starting point sẽ đi tới một local optimum nào đó.

Ta có thể xem:

$$
basin(S^*)
$$

là tập các starting solutions mà local search cuối cùng đều hội tụ về \(S^*\).

GRASP làm:

```text
randomized construction
          ↓
sample starting points
          ↓
local search
          ↓
sample different basins
```

Đây là cách rất hữu ích để hiểu GRASP.

---

# 9.20. GRASP vs Random Restart Hill Climbing

Hai cái cực kỳ giống nhau về hình thức.

### Random Restart Hill Climbing

```text
random solution
      ↓
hill climbing
      ↓
local optimum
      ↓
repeat
```

### GRASP

```text
randomized greedy solution
      ↓
local search
      ↓
local optimum
      ↓
repeat
```

Khác biệt chính:

$$
\boxed{
GRASP\ tạo\ starting\ solution\ bằng\ randomized\ greedy
}
$$

thay vì random hoàn toàn.

Do đó GRASP thường tạo starting points có **quality tốt hơn random**, nhưng vẫn đủ đa dạng.

---

# 9.21. GRASP vs Greedy

|                      | Greedy           | GRASP                |
| -------------------- | ---------------- | -------------------- |
| Construction         | deterministic    | randomized           |
| Diversity            | thấp             | cao                  |
| Local Search         | không nhất thiết | thường có            |
| Multi-start          | không            | có                   |
| Escape local optimum | hạn chế          | thông qua restart    |
| Parameter            | ít               | \(\alpha, I_{\max}\) |

---

# 9.22. GRASP vs Genetic Algorithm

Đây là comparison rất đáng nhớ.

### GA

```text
population
 ↓
selection
 ↓
crossover
 ↓
mutation
 ↓
population
```

### GRASP

```text
construction
 ↓
local search
 ↓
solution

repeat independently
```

GA truyền information:

$$
parent_1,parent_2
\rightarrow child
$$

GRASP không cần crossover.

Mỗi iteration gần như là:

$$
\boxed{
new\ independent\ construction
}
$$

sau đó local search.

---

# 9.23. GRASP vs Simulated Annealing

SA:

```text
one trajectory
```

GRASP:

```text
many trajectories
```

SA perturb:

```text
S → neighbor
```

GRASP:

```text
construct new S from scratch
```

SA có:

$$
T(t)
$$

GRASP cơ bản không cần temperature.

---

# 9.24. Một cách nhìn cực kỳ đẹp

Có thể xếp:

```text
Greedy
   │
   │ add randomness
   ▼
Randomized Greedy
   │
   │ add local search
   ▼
GRASP
```

Trong khi:

```text
Random solution
   │
   ▼
Local Search
   │
   ▼
Random Restart
```

GRASP chính là một cách **thông minh hóa random restart**.

---

# 9.25. Parameter \(\alpha\) và trade-off

Giả sử:

$$
\alpha\rightarrow0
$$

thì:

```text
construction:
██████████ Greedy
```

Ưu:

* starting solution tốt;
* convergence nhanh.

Nhược:

* ít diversity;
* dễ lặp lại cùng basin.

Ngược lại:

$$
\alpha\rightarrow1
$$

thì:

```text
construction:
Random ██████████
```

Ưu:

* diversity cao.

Nhược:

* starting solution xấu;
* local search phải làm nhiều việc hơn.

Vậy:

$$
\boxed{
\alpha
\text{ điều khiển exploration/exploitation}
}
$$

---

# 9.26. Reactive GRASP

Đây là enhancement cực kỳ quan trọng.

Vấn đề:

> Chọn \(\alpha\) bao nhiêu?

Không có câu trả lời universal.

Nếu:

```text
α = 0.1
```

có thể quá greedy.

Nếu:

```text
α = 0.9
```

có thể quá random.

Reactive GRASP không cố định một \(\alpha\).

Nó dùng:

$$
A=\{\alpha_1,\alpha_2,\ldots,\alpha_k\}
$$

Ví dụ:

```text
α = {0.1, 0.2, 0.4, 0.7, 0.9}
```

ban đầu cho chúng cơ hội tương đối cân bằng.

Sau một số iteration:

```text
α=0.1 → solutions tốt
α=0.2 → solutions rất tốt
α=0.4 → trung bình
α=0.7 → kém
α=0.9 → rất kém
```

thì tăng xác suất chọn:

```text
α = 0.2
```

Reactive GRASP được đề xuất để tránh phải chọn trước một RCL parameter cố định; các tài liệu mô tả nó như cơ chế học từ chất lượng nghiệm thu được bởi các mức \(\alpha\) khác nhau. ([ScienceDirect][8])

---

# 9.27. Reactive GRASP dưới góc nhìn Multi-Armed Bandit

Đây là một cách nhìn hiện đại rất thú vị.

Ta có:

```text
Arm 1 → α=0.1
Arm 2 → α=0.2
Arm 3 → α=0.4
Arm 4 → α=0.7
```

Mỗi lần chọn một \(\alpha\), ta quan sát:

$$
reward(\alpha)
$$

ví dụ:

$$
reward = \text{quality improvement}
$$

Sau đó update probability.

Tức là:

$$
\boxed{
GRASP
+
Online\ parameter\ learning
}
$$

Đây là tư duy **adaptive metaheuristic**.

---

# 9.28. Elite Set

GRASP cơ bản chỉ cần:

```text
best solution
```

Nhưng có thể giữ:

$$
E=\{e_1,e_2,\ldots,e_k\}
$$

gọi là:

$$
\boxed{Elite\ Set}
$$

Ví dụ:

```text
Elite:

E1 = 1000
E2 = 995
E3 = 990
E4 = 985
E5 = 980
```

Nhưng không nên chỉ giữ những solution giống nhau.

Ta muốn:

$$
\boxed{
quality + diversity
}
$$

---

# 9.29. Path Relinking

Đây là một enhancement rất quan trọng của GRASP.

Giả sử có hai elite solutions:

```text
S1
A B C D E F

S2
A D B F E C
```

Ta muốn tìm các solution nằm **trên đường đi từ S1 đến S2**.

Ví dụ:

```text
S1
 ↓
S'
 ↓
S''
 ↓
S2
```

Mỗi bước làm solution gần S2 hơn.

Đây gọi là:

$$
\boxed{Path\ Relinking}
$$

GRASP hiện đại thường kết hợp path-relinking để khai thác thông tin từ các elite solutions; sách chuyên khảo của Resende & Ribeiro dành hẳn các chương cho path-relinking và GRASP with path-relinking. ([Springer Nature Link][2])

---

# 9.30. Ví dụ Path Relinking với permutation

Giả sử:

```text
S1 = A B C D E
S2 = A D E B C
```

Ta muốn biến S1 thành S2.

Một move:

```text
A B C D E
    ↓
A D B C E
```

rồi:

```text
A D B C E
      ↓
A D E B C
```

Trong quá trình:

```text
S1 → S' → S''
```

ta **đánh giá tất cả intermediate solutions**.

Điều rất thú vị:

> Solution tốt nhất có thể nằm **giữa hai elite solutions**, chứ không phải ở hai đầu.

---

# 9.31. GRASP + Path Relinking

Kiến trúc:

```text
        Randomized Greedy
                ↓
          Local Search
                ↓
             Elite
                ↓
        Path Relinking
          ↙           ↘
       Elite         New solution
                        ↓
                   Local Search
```

Đây là một dạng **intensification**:

* construction → diversification;
* local search → exploitation;
* elite set → memory;
* path relinking → intensification.

---

# 9.32. Diversification vs Intensification

Đây là vocabulary cần ghi nhớ.

### Diversification

Khám phá vùng mới:

```text
randomness
large RCL
restart
different α
```

### Intensification

Đào sâu vùng tốt:

```text
local search
elite solutions
path relinking
```

GRASP có thể được nhìn như:

$$
\boxed{
Diversification
+
Intensification
}
$$

---

# 9.33. Cost Perturbation

Một enhancement khác là perturb greedy cost.

Thay vì:

$$
g(c)
$$

ta dùng:

$$
g'(c)=g(c)+noise(c)
$$

hoặc một bias function.

Mục tiêu:

> làm cho construction đôi khi chọn một candidate khác mà không cần thay đổi toàn bộ logic greedy.

Các nghiên cứu/tổng quan GRASP liệt kê cost perturbation, bias functions, memory/learning, filtering và nhiều construction schemes mở rộng khác. ([Optimization Online][7])

---

# 9.34. Bias Function

Thay vì chọn uniformly từ RCL:

$$
P(c)=\frac1{|RCL|}
$$

ta có thể bias:

$$
P(c)\propto w(c)
$$

Ví dụ:

```text
best candidate
    ↓
xác suất cao

worse candidate
    ↓
xác suất thấp
```

Nhưng candidate xấu vừa phải vẫn có cơ hội.

Đây là:

$$
\boxed{
biased\ randomization
}
$$

thay vì uniform randomization.

---

# 9.35. Filtering

Local Search có thể rất đắt.

Giả sử construction tạo:

```text
100,000 solutions
```

nhưng 80% starting solutions quá tệ.

Ta có thể:

```text
Construction
    ↓
cheap filter
    ↓
    ├── bad → discard
    │
    └── promising
             ↓
        Local Search
```

Filtering là một kỹ thuật đã được nghiên cứu trong GRASP để tránh tiêu tốn local search cho những constructed solutions có chất lượng thấp. ([ScienceDirect][6])

---

# 9.36. Hashing / Duplicate Detection

GRASP có thể tạo lại cùng solution:

```text
Iteration 1 → S
Iteration 7 → S
Iteration 12 → S
```

Không có ích gì nếu local search deterministic.

Ta có thể hash:

$$
hash(S)
$$

và:

```text
if hash(S) already seen:
    reject / perturb
```

Đây là một dạng memory nhẹ.

Các survey GRASP cũng liệt kê hashing và filtering trong các kỹ thuật tăng tốc. ([Optimization Online][7])

---

# 9.37. Parallel GRASP

Đây là một advantage tự nhiên.

Các iteration gần như độc lập:

```text
Iteration 1 ──→ Local Search ──→ S1
Iteration 2 ──→ Local Search ──→ S2
Iteration 3 ──→ Local Search ──→ S3
Iteration 4 ──→ Local Search ──→ S4
```

Có thể chạy:

```text
CPU 1 → iteration 1
CPU 2 → iteration 2
CPU 3 → iteration 3
CPU 4 → iteration 4
```

sau đó:

$$
Best=\min(S_1,S_2,S_3,S_4)
$$

Tài liệu chuyên khảo về GRASP dành riêng một chương cho parallel GRASP. ([Springer Nature Link][2])

---

# 9.38. Complexity của GRASP

Giả sử:

* \(I\): số iterations;
* \(C\): cost construction;
* \(L\): cost local search.

Khi đó:

$$
T\approx I(C+L)
$$

Thông thường:

$$
L\gg C
$$

nên:

$$
T\approx IL
$$

Điều này giải thích tại sao các kỹ thuật:

* filtering;
* fast neighborhood evaluation;
* incremental evaluation;
* parallelization;

có giá trị rất lớn.

---

# 9.39. Một insight quan trọng cho coding challenge

Nếu execution time chỉ có:

$$
100ms
$$

thì không thể đơn giản:

```text
for iteration = 1..1000000
    construct
    local_search
```

Mà cần:

$$
\boxed{
maximize\ solution\ quality / evaluation
}
$$

Thậm chí có thể tốt hơn khi:

```text
20,000 cheap GRASP iterations
```

thay vì:

```text
1,000 expensive GRASP iterations
```

Tất nhiên còn phụ thuộc landscape và cost của local search.

---

# 9.40. GRASP cho Air Conditioner Technician

Bây giờ áp dụng kiến thức vào bài challenge ban đầu.

Ta có:

```text
100 × 100 city
~200–400 houses
30 days
720 min/day
Manhattan distance
service time
dynamic revenue
```

Ta có thể thiết kế GRASP như sau.

---

## Representation

Một solution:

```text
Day 1:
H17 → H92 → H3 → H51

Day 2:
H7 → H20 → H5

...
```

---

# 9.41. Greedy construction

Ta đang ở:

$$
(y,x)
$$

và còn các house chưa phục vụ.

Với mỗi house \(h\), tính:

$$
\Delta score(h)
$$

nếu chọn nó tiếp theo.

Ví dụ:

$$
\Delta score(h)
=
price(h)
+
timeBonus(h)
-
travelCost(h)
$$

Trong đó:

$$
travelCost
=
|y_h-y|+|x_h-x|
$$

và:

$$
serviceTime(h)
=
30m_h+30
$$

---

# 9.42. Nhưng greedy score phải rất cẩn thận

Đây là điểm khó.

Giả sử:

```text
House A:
distance = 1
price = 80k
service = 60 min

House B:
distance = 10
price = 300k
service = 210 min
```

Greedy đơn giản:

```text
price
```

sẽ chọn B.

Nhưng B có thể làm:

```text
day schedule
```

bị vỡ.

Do đó heuristic score nên xem:

$$
\boxed{
reward
+
future\ opportunity
-
travel
-
time\ consumption
}
$$

Đây là phần domain-specific nhất của GRASP.

---

# 9.43. RCL trong bài AC

Giả sử candidate scores:

| House | Incremental score |
| ----- | ----------------: |
| H1    |               250 |
| H2    |               245 |
| H3    |               238 |
| H4    |               220 |
| H5    |               170 |
| H6    |        infeasible |

Ta tạo:

```text
RCL = {H1,H2,H3,H4}
```

random chọn một.

Ví dụ:

```text
H3
```

Sau khi chọn H3:

```text
current position thay đổi
remaining time thay đổi
```

→ phải **recompute candidate scores**.

Đó chính là adaptive construction.

---

# 9.44. Feasibility

Một candidate \(h\) chỉ được đưa vào RCL nếu:

$$
currentTime
+
travel(h)
+
service(h)
\le720
$$

Nếu không:

```text
h không nằm trong feasible candidate set
```

Đây là một điểm rất đẹp của GRASP:

> Ta có thể thiết kế construction để **sinh trực tiếp feasible solution**, thay vì sinh rồi repair hàng loạt.

---

# 9.45. Local Search cho bài này

Sau khi xây xong schedule:

```text
Day 1:
H1 H2 H3 H4
```

ta thử:

### Swap

```text
H2 ↔ H4
```

### Insert

```text
H4 → before H1
```

### Move between days

```text
Day 1: H1 H2 H3
Day 2: H4 H5

        ↓

Day 1: H1 H2
Day 2: H4 H5 H3
```

### 2-opt

```text
A → B → C → D
```

thành:

```text
A → C → B → D
```

với điều kiện schedule vẫn feasible.

---

# 9.46. Một GRASP rất hợp lý cho bài này

```text
for iteration:

    S = empty schedule

    while possible:

        calculate marginal score
        calculate feasible candidates
        build RCL
        random-select candidate
        add candidate

    LocalSearch(S)

    if score(S) > best:
        best = S
```

Sau đó nâng cấp:

```text
GRASP
 │
 ├── Reactive α
 ├── Elite Set
 ├── Path Relinking
 ├── 2-opt
 ├── Swap / Insert
 └── incremental evaluation
```

---

# 9.47. GRASP vs GA cho bài AC

Đây là một câu hỏi thực chiến rất hay.

### GRASP

```text
construct schedule
      ↓
local optimization
      ↓
repeat
```

### GA

```text
population of schedules
      ↓
crossover
      ↓
mutation
      ↓
repair
      ↓
local search
```

Bài AC có một đặc điểm:

> **schedule có cấu trúc phức tạp và feasibility rất chặt.**

GA có thể gặp khó ở:

```text
crossover
    ↓
invalid schedule
    ↓
repair
```

GRASP có lợi thế:

```text
construct
    ↓
feasible by design
```

Do đó **GRASP là một candidate rất đáng thử** cho bài challenge này.

---

# 9.48. Nhưng GRASP cũng có điểm yếu

Nếu:

$$
construction
$$

quá greedy, tất cả iteration vẫn tương tự nhau.

Nếu:

$$
\alpha
$$

quá lớn:

```text
starting solutions quá tệ
```

Nếu local search yếu:

```text
construction quality quyết định gần như tất cả
```

Do đó:

$$
\boxed{
GRASP\ quality
\approx
construction\ quality
\times
local\ search\ quality
}
$$

Không phải công thức toán học chính thức, mà là một cách tư duy rất hữu ích.

---

# 9.49. So sánh với các chương trước

| Technique     | Diversification | Intensification | Memory      |
| ------------- | --------------- | --------------- | ----------- |
| Greedy        | thấp            | cao             | không       |
| Hill Climbing | thấp            | rất cao         | không       |
| SA            | trung bình      | trung bình      | temperature |
| Tabu          | trung bình      | cao             | mạnh        |
| GA            | rất cao         | trung bình      | population  |
| **GRASP**     | **cao**         | **cao**         | cơ bản thấp |
| GRASP + PR    | cao             | **rất cao**     | elite set   |

GRASP đặc biệt thú vị vì:

$$
\boxed{
Randomized\ construction
=
diversification
}
$$

và:

$$
\boxed{
Local\ search
=
intensification
}
$$

---

# 9.50. GRASP dưới góc nhìn "metaheuristic design pattern"

Từ đây cậu có thể nhìn GRASP như một design pattern:

```text
                    GRASP
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
   Diversification         Intensification
          │                       │
 randomized greedy          local search
          │                       │
          └───────────┬───────────┘
                      ▼
                 high-quality
                   solution
```

Đây là pattern rất tổng quát.

Ta chỉ cần thay:

```text
construction
```

và:

```text
local search
```

là có thể áp dụng cho rất nhiều bài.

---

# 9.51. Một điểm sâu hơn: GRASP không có "population"

So với GA:

```text
GA:
population = explicit
```

GRASP:

```text
population = implicit
```

Ta có:

```text
S1 → local optimum L1
S2 → local optimum L2
S3 → local optimum L3
...
```

Nhưng ta không nhất thiết giữ toàn bộ:

$$
\{S_1,S_2,\ldots\}
$$

mà thường chỉ giữ:

$$
Best
$$

hoặc elite set nếu dùng enhancement.

Vì thế GRASP có memory footprint nhỏ hơn GA trong nhiều implementation.

---

# 9.52. Một insight rất đáng nhớ

Có thể xem:

### GA

> **Evolution across solutions**

### GRASP

> **Repeated construction of solutions**

GA nói:

```text
"Solution tốt này có thể sinh ra solution tốt nào?"
```

GRASP nói:

```text
"Ta có thể xây một solution tốt theo một cách khác không?"
```

Đây là khác biệt về triết lý search.

---

# 9.53. Từ GRASP đến Adaptive / Hybrid Metaheuristics

Ta đã thấy:

```text
GRASP
 │
 ├── Reactive GRASP
 │
 ├── Path Relinking
 │
 ├── Elite Set
 │
 ├── Filtering
 │
 ├── Cost Perturbation
 │
 ├── Bias Functions
 │
 ├── Parallel GRASP
 │
 └── Hybrid GRASP
```

Đây là lý do tài liệu chuyên khảo của Resende & Ribeiro không chỉ trình bày basic GRASP mà còn có riêng các chương về extended construction, path relinking, parallel GRASP và case studies. ([Springer Nature Link][2])

---

# 9.54. Pseudocode nâng cao

Một phiên bản rất gần với implementation thực tế:

```text
GRASP():

    best ← ∅
    elite ← ∅

    initialize α probabilities

    for iter = 1..MAX_ITER:

        α ← select_alpha()

        S ← randomized_greedy_construction(α)

        if filtering_enabled and
           S looks poor:

            continue

        S ← local_search(S)

        update_elite(elite, S)

        if path_relinking_enabled:

            T ← choose_elite_solution(elite)

            R ← path_relink(S, T)

            R ← local_search(R)

            update_elite(elite, R)

        best ← best_solution(elite)

        update_alpha_probabilities()

    return best
```

Đây đã là một **serious GRASP framework**, không còn là textbook toy algorithm nữa.

---

# 9.55. Những thứ cần nhớ sau Chương 9

Nếu phải rút toàn bộ chương thành một bảng:

| Khái niệm       | Ý nghĩa                                          |
| --------------- | ------------------------------------------------ |
| GRASP           | Multi-start metaheuristic                        |
| Construction    | xây solution từ đầu                              |
| Greedy function | đo lợi ích của candidate                         |
| RCL             | tập candidate tốt để random                      |
| \(\alpha\)      | mức greediness/randomness                        |
| Adaptive        | candidate quality thay đổi theo partial solution |
| Local Search    | refine constructed solution                      |
| Reactive GRASP  | học \(\alpha\) tốt                               |
| Elite Set       | lưu nhiều solution tốt                           |
| Path Relinking  | khám phá đường giữa elite solutions              |
| Filtering       | bỏ starting solution quá tệ                      |
| Bias            | random có trọng số                               |
| Parallel GRASP  | chạy iteration song song                         |

---

# 9.56. Công thức tư duy cuối chương

GRASP có thể được nhớ bằng một chuỗi cực ngắn:

$$
\boxed{
Greedy
\rightarrow
Randomize
\rightarrow
Construct
\rightarrow
Local\ Search
\rightarrow
Restart
}
$$

hoặc:

```text
              GOOD
               │
               ▼
        Greedy Construction
               │
          add randomness
               │
               ▼
        Diverse solutions
               │
               ▼
         Local Search
               │
               ▼
       Strong local optima
               │
               ▼
          restart again
```

Và nếu nâng cấp:

$$
\boxed{
GRASP
+
Reactive
+
Elite
+
Path\ Relinking
}
$$

sẽ trở thành một framework rất mạnh cho combinatorial optimization. Sách *Optimization by GRASP* của Resende & Ribeiro hiện là tài liệu chuyên khảo trực tiếp nhất về chủ đề này; mục lục của sách đi đúng theo progression mà ta vừa học: construction → local search → basic GRASP → runtime → extended construction → path relinking → GRASP with path relinking → parallel GRASP → case studies. ([Springer Nature Link][2])

---

## Vị trí của Chương 9 trong "bản đồ" mà chúng ta đang xây

```text
                    METAHEURISTICS
                          │
          ┌───────────────┴────────────────┐
          │                                │
   Single-solution                   Population /
      methods                       multi-start methods
          │                                │
    ┌─────┼─────┐                    ┌────┴────┐
    │     │     │                    │         │
   HC     SA   Tabu                  GA       GRASP
                                      │         │
                                      │         │
                                  crossover   construction
                                  mutation       │
                                      │      local search
                                      ▼         │
                                  population     │
                                      │          │
                                      └────┬─────┘
                                           ▼
                                     Hybrid / Memetic
```

Điểm đáng chú ý là **GRASP nằm đúng giữa Greedy và Local Search**: nó không cần machinery phức tạp như GA, nhưng biến một greedy heuristic đơn giản thành một **framework tìm kiếm nhiều lần, có diversification + intensification**. Đây là một trong những lý do GRASP đặc biệt phù hợp để làm nền cho các hybrid heuristic sau này. ([Wiley Online Library][9])

[1]: https://bishtref.com/articles/10.1007/bf01096763?utm_source=chatgpt.com "Greedy Randomized Adaptive Search Procedures (1995)"
[2]: https://link.springer.com/book/10.1007/978-1-4939-6530-4?utm_source=chatgpt.com "Optimization by GRASP: Greedy Randomized Adaptive Search Procedures | Springer Nature Link"
[3]: https://en.wikipedia.org/wiki/Greedy_randomized_adaptive_search_procedure?utm_source=chatgpt.com "Greedy randomized adaptive search procedure"
[4]: https://doi.org/10.1016/j.ejor.2025.02.022?utm_source=chatgpt.com "Greedy Randomized Adaptive Search Procedures with Path Relinking. An analytical review of designs and implementations - ScienceDirect"
[5]: https://link.springer.com/chapter/10.1007/978-3-031-13714-3_7?utm_source=chatgpt.com "Randomized Methods | Springer Nature Link"
[6]: https://www.sciencedirect.com/science/article/pii/S0377221716000928?utm_source=chatgpt.com "Advanced Greedy Randomized Adaptive Search Procedure for the Obnoxious p-Median problem - ScienceDirect"
[7]: https://optimization-online.org/2001/09/371/?utm_source=chatgpt.com "Greedy randomized adaptive search procedures – Optimization Online"
[8]: https://www.sciencedirect.com/science/article/pii/S0305054806000426?utm_source=chatgpt.com "A reactive GRASP and path relinking for a combined production–distribution problem - ScienceDirect"
[9]: https://onlinelibrary.wiley.com/doi/10.1002/9780470400531.eorms0367?utm_source=chatgpt.com "Grasp: Greedy Randomized Adaptive Search Procedures - Resende - Major Reference Works - Wiley Online Library"
