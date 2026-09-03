# Chương 14 — Adaptive Large Neighborhood Search (ALNS)

Đây là chương rất đáng nghiên cứu kỹ, vì **ALNS không đơn thuần là “LNS có thêm adaptive”**. Nó là một bước chuyển quan trọng từ việc thiết kế **một heuristic cố định** sang xây dựng **một hệ thống tự học trong quá trình tìm kiếm**.

Nếu ở chương 13 ta có:

> **LNS = Destroy → Repair → Acceptance**

thì ở chương 14:

> **ALNS = nhiều Destroy + nhiều Repair + cơ chế Adaptive Selection + Acceptance**

Và chính phần **Adaptive Selection** là linh hồn của ALNS.

---

# 1. ALNS là gì?

**Adaptive Large Neighborhood Search** là một metaheuristic mở rộng từ LNS, trong đó thuật toán có một tập nhiều toán tử `destroy` và `repair`, rồi **tự động điều chỉnh xác suất sử dụng các toán tử dựa trên hiệu quả của chúng trong quá trình tìm kiếm**.

Ta có:

$$
\mathcal D = \{D_1,D_2,\dots,D_p\}
$$

là tập destroy operators và:

$$
\mathcal R = \{R_1,R_2,\dots,R_q\}
$$

là tập repair operators.

Mỗi iteration chọn:

$$
D_i \in \mathcal D
$$

và

$$
R_j \in \mathcal R
$$

sau đó:

$$
S'
=
R_j(D_i(S))
$$

rồi dùng acceptance criterion để quyết định có nhận `S'` hay không.

Điểm đặc biệt:

$$
P(D_i),P(R_j)
$$

**không cố định**.

Chúng thay đổi trong quá trình chạy.

---

# 2. Tại sao LNS cần "Adaptive"?

Hãy quay lại bài toán kỹ thuật viên điều hòa của chúng ta.

Giả sử ta có các destroy operator:

| Operator        | Ý tưởng                       |
| --------------- | ----------------------------- |
| Random Removal  | Xóa ngẫu nhiên                |
| Worst Removal   | Xóa các house gây chi phí lớn |
| Spatial Removal | Xóa các house gần nhau        |
| Day Removal     | Xóa toàn bộ một ngày          |
| Type Removal    | Xóa các house có cùng loại    |
| Cluster Removal | Xóa một cụm                   |

Ban đầu ta có thể cho chúng xác suất bằng nhau:

$$
P(D_i)=\frac{1}{6}
$$

Nhưng đây là một giả định rất yếu.

Có thể đối với instance hiện tại:

* `Random Removal` rất hữu ích;
* `Spatial Removal` cực kỳ hiệu quả;
* `Day Removal` thường phá hỏng solution;
* `Type Removal` đôi khi tốt;
* `Worst Removal` chỉ hiệu quả ở giai đoạn cuối.

Nếu vẫn dùng xác suất cố định thì thuật toán sẽ:

> tiếp tục dành cùng một lượng thời gian cho các operator tốt và operator tệ.

ALNS giải quyết chính vấn đề này.

---

# 3. Ý tưởng cốt lõi: "operator nào tốt thì dùng nhiều hơn"

Giả sử ban đầu:

```text
Random       1.0
Worst        1.0
Spatial      1.0
Day          1.0
Type         1.0
Cluster      1.0
```

Sau một số iteration, thuật toán quan sát:

```text
Spatial removal → thường xuyên tạo ra solution tốt
Random removal  → khá tốt
Worst removal   → trung bình
Day removal     → hiếm khi cải thiện
```

Nó có thể điều chỉnh:

```text
Random       1.5
Worst        1.0
Spatial      4.0
Day          0.3
Type         1.2
Cluster      2.0
```

Khi chọn operator theo trọng số:

$$
P_i =
\frac{w_i}
{\sum_j w_j}
$$

thì `Spatial Removal` sẽ được chọn thường xuyên hơn.

Đây chính là:

> **Adaptive operator selection.**

---

# 4. Kiến trúc tổng thể của ALNS

Ta có thể hình dung:

```text
                    Current Solution
                           │
                           ▼
                 ┌───────────────────┐
                 │ Select Destroy D  │
                 │    adaptively     │
                 └─────────┬─────────┘
                           │
                           ▼
                    Destroy(S)
                           │
                           ▼
                 Partial Solution
                           │
                           ▼
                 ┌───────────────────┐
                 │ Select Repair R   │
                 │    adaptively     │
                 └─────────┬─────────┘
                           │
                           ▼
                     Repair(...)
                           │
                           ▼
                    New Solution S'
                           │
                           ▼
                 ┌───────────────────┐
                 │ Local Search      │
                 │ / VND / 2-opt     │
                 └─────────┬─────────┘
                           │
                           ▼
                      S''
                           │
                           ▼
                 ┌───────────────────┐
                 │ Acceptance        │
                 └─────────┬─────────┘
                           │
                           ▼
                     Current S
                           │
                           ▼
                 Update operator scores
                           │
                           ▼
                 Update operator weights
                           │
                           └──────► repeat
```

Đây là cấu trúc rất quan trọng.

---

# 5. ALNS không chỉ "chọn operator tốt nhất"

Một điểm dễ hiểu nhầm:

> Adaptive **không có nghĩa** là luôn chọn operator có score cao nhất.

Nếu làm vậy:

```text
chọn operator tốt nhất
→ operator đó tiếp tục được chọn
→ các operator khác không còn cơ hội
→ mất diversity
→ search dễ bị mắc kẹt
```

ALNS thường dùng **weighted random selection**.

Ví dụ:

```text
D1: weight = 1
D2: weight = 5
D3: weight = 2
D4: weight = 1
```

Tổng:

$$
W=9
$$

Do đó:

$$
P(D_1)=\frac19
$$

$$
P(D_2)=\frac59
$$

$$
P(D_3)=\frac29
$$

$$
P(D_4)=\frac19
$$

`D2` được ưu tiên nhưng vẫn không độc quyền.

Đây là sự cân bằng giữa:

> **exploitation** và **exploration**.

---

# 6. Exploration vs Exploitation

Đây là một trong những tư tưởng lớn nhất của metaheuristic.

## Exploitation

Tập trung vào những thứ hiện tại đã chứng minh là tốt.

Ví dụ:

```text
Spatial Removal rất tốt
→ tăng xác suất Spatial Removal
```

Ta khai thác tri thức đã học.

---

## Exploration

Tiếp tục thử những thứ chưa được khám phá.

Ví dụ:

```text
Day Removal hiện tại chưa tốt
nhưng vẫn cho nó một xác suất nhỏ
```

Có thể:

```text
Day Removal
→ chưa tốt trong giai đoạn đầu
→ nhưng rất tốt khi solution gần optimum
```

Nếu loại bỏ nó quá sớm thì ta sẽ không bao giờ phát hiện điều này.

---

# 7. Hai tầng adaptive

Một ALNS thường có ít nhất hai loại lựa chọn:

### Destroy selection

$$
D_i
$$

và:

### Repair selection

$$
R_j
$$

Có thể duy trì hai bộ weight độc lập:

```text
Destroy weights:
D1 = 2.1
D2 = 4.8
D3 = 1.2
...

Repair weights:
R1 = 3.7
R2 = 1.1
R3 = 5.2
...
```

Sau đó:

$$
P(D_i)
=
\frac{w_i^D}
{\sum_k w_k^D}
$$

và:

$$
P(R_j)
=
\frac{w_j^R}
{\sum_k w_k^R}
$$

---

# 8. Operator Score

Bây giờ xuất hiện vấn đề quan trọng:

> Làm sao biết một operator "tốt"?

Không thể đơn giản nói:

```text
operator được chọn → +1
```

vì operator có thể được chọn nhưng tạo solution rất tệ.

Ta cần đo **kết quả mà operator tạo ra**.

Một cách kinh điển là gán reward theo outcome.

Ví dụ:

| Outcome                      | Reward |
| ---------------------------- | -----: |
| Tạo global best              |     33 |
| Tạo solution tốt hơn current |      9 |
| Tạo solution được accept     |      3 |
| Không được accept            |      0 |

Ta có:

$$
\text{score}(o)
\leftarrow
\text{score}(o)+r
$$

---

# 9. Tại sao global best có reward cao?

Giả sử:

$$
f(S_{best})=100
$$

và operator tạo:

$$
f(S')=90
$$

nếu là minimization thì:

$$
90<100
$$

Đây là một discovery quan trọng.

Ta có thể thưởng lớn:

$$
r=33
$$

Ngược lại nếu:

$$
f(S')=99
$$

nó cải thiện current solution nhưng chưa phá global best.

Có thể:

$$
r=9
$$

Nếu solution xấu hơn nhưng vẫn được acceptance criterion chấp nhận:

$$
r=3
$$

Như vậy hệ thống học được:

> Operator tạo ra global improvement đáng giá hơn operator chỉ giúp search tiếp tục.

---

# 10. Weight Update

Sau một khoảng thời gian, gọi là một **segment**, ta cập nhật weight.

Giả sử:

$$
w_i
$$

là weight hiện tại của operator.

Ta có score trung bình:

$$
\bar s_i
=
\frac{s_i}{n_i}
$$

trong đó:

* \(s_i\): tổng reward;
* \(n_i\): số lần operator được sử dụng.

Sau đó:

$$
w_i
\leftarrow
(1-\rho)w_i
+
\rho\bar s_i
$$

với:

$$
0<\rho\le1
$$

là reaction factor.

---

# 11. Ý nghĩa của reaction factor \(\rho\)

Đây là tham số cực kỳ quan trọng.

Ví dụ:

$$
\rho=0.1
$$

thì weight mới thay đổi từ từ.

```text
old knowledge
██████████████████
new observation
██
```

Ngược lại:

$$
\rho=0.8
$$

thì thuật toán phản ứng mạnh với kết quả gần đây.

```text
old knowledge
████
new observation
████████████████
```

Do đó:

### \(\rho\) nhỏ

Ổn định hơn nhưng thích nghi chậm.

### \(\rho\) lớn

Thích nghi nhanh nhưng dễ dao động.

Đây chính là một dạng **learning rate**.

---

# 12. Segment-based adaptation

Một thiết kế phổ biến là **không update weight sau mỗi iteration**.

Thay vào đó:

```text
100 iterations
       ↓
collect statistics
       ↓
update weights
       ↓
reset scores
       ↓
100 iterations
       ↓
...
```

Ví dụ:

```text
Segment 1
├── iteration 1
├── iteration 2
├── ...
└── iteration 100
        ↓
   update weights

Segment 2
├── iteration 101
├── ...
└── iteration 200
        ↓
   update weights
```

Điều này tránh việc weight thay đổi quá nhanh.

---

# 13. Một ví dụ hoàn chỉnh

Giả sử có 3 destroy operators:

```text
D1 = Random
D2 = Spatial
D3 = Worst
```

Ban đầu:

$$
w_1=w_2=w_3=1
$$

Do đó:

$$
P(D_i)=\frac13
$$

---

### Segment 1

Sau 100 lần:

```text
Random  → total reward = 20, used = 20
Spatial → total reward = 100, used = 40
Worst   → total reward = 15, used = 40
```

Average reward:

$$
\bar s_1=1
$$

$$
\bar s_2=2.5
$$

$$
\bar s_3=0.375
$$

Giả sử:

$$
\rho=0.5
$$

thì:

$$
w_1=0.5(1)+0.5(1)=1
$$

$$
w_2=0.5(1)+0.5(2.5)=1.75
$$

$$
w_3=0.5(1)+0.5(0.375)=0.6875
$$

Do đó:

```text
Random   1.00
Spatial  1.75
Worst    0.6875
```

Tổng:

$$
3.4375
$$

Suy ra:

$$
P(Random)\approx29.1\%
$$

$$
P(Spatial)\approx50.9\%
$$

$$
P(Worst)\approx20.0\%
$$

Search đã **tự học** rằng Spatial Removal có ích.

---

# 14. ALNS là một dạng Online Learning

Đây là cách nhìn sâu hơn.

Ta có:

```text
Environment
     │
     ▼
Operator
     │
     ▼
Solution quality
     │
     ▼
Reward
     │
     ▼
Update weight
     │
     ▼
Future operator probability
```

Nó rất giống một hệ thống **online learning**.

Nhưng cần phân biệt:

> ALNS không nhất thiết là Reinforcement Learning.

ALNS thường sử dụng một cơ chế reward/weight đơn giản, có thiết kế heuristic rõ ràng.

Không cần:

* neural network;
* state representation phức tạp;
* Q-table;
* policy gradient.

Nó là một dạng **adaptive heuristic control**.

---

# 15. Adaptive không chỉ áp dụng cho operator

Đây là điểm rất thú vị.

Ta có thể adaptive:

### Destroy operator

```text
Random
Worst
Spatial
Cluster
Day
...
```

### Repair operator

```text
Greedy
Regret-2
Regret-3
Beam Repair
...
```

### Destroy size

Ví dụ:

$$
q\in[5,30]
$$

ALNS có thể học rằng:

```text
q = 5   → ít thay đổi
q = 10  → tốt
q = 20  → rất tốt
q = 30  → quá phá
```

Do đó có thể adaptive cả:

$$
q
$$

---

# 16. Adaptive destruction degree

Giả sử solution có:

$$
n=300
$$

houses.

Ta có:

$$
q = \alpha n
$$

với:

$$
\alpha\in[0.05,0.40]
$$

Ví dụ:

```text
α = 5%   → 15 houses
α = 10%  → 30 houses
α = 20%  → 60 houses
α = 30%  → 90 houses
α = 40%  → 120 houses
```

Có thể coi mỗi mức là một "operator":

```text
Destroy-5%
Destroy-10%
Destroy-20%
Destroy-30%
Destroy-40%
```

và adaptive selection chọn mức phù hợp.

Đây là một ý tưởng rất mạnh.

---

# 17. ALNS + Relatedness

Trong chương 13 ta đã nói về **Shaw Removal**.

Ta có relatedness:

$$
R(i,j)
$$

ví dụ:

$$
R(i,j)
=
\alpha d(i,j)
+
\beta |q_i-q_j|
+
\gamma |t_i-t_j|
$$

với:

* \(d(i,j)\): khoảng cách;
* \(q_i,q_j\): demand;
* \(t_i,t_j\): thời gian;
* \(\alpha,\beta,\gamma\): trọng số.

ALNS có thể có nhiều biến thể:

```text
Spatial relatedness
Demand relatedness
Temporal relatedness
Route-position relatedness
Profit relatedness
```

và tự học biến thể nào hữu ích.

---

# 18. ALNS và Acceptance Criterion

Một điểm quan trọng:

> Operator selection và acceptance là hai cơ chế khác nhau.

ALNS có thể dùng:

### Hill Climbing

Chỉ nhận:

$$
f(S')<f(S)
$$

---

### Simulated Annealing

Có thể nhận nghiệm xấu:

$$
P=
e^{-\Delta/T}
$$

---

### Threshold Acceptance

Nhận nếu:

$$
f(S')\le f(S)+\theta
$$

---

Do đó một kiến trúc rất mạnh là:

$$
\boxed{
ALNS + SA
}
$$

Trong đó:

```text
ALNS
 ├── Adaptive Destroy
 ├── Adaptive Repair
 └── SA Acceptance
```

Hai cơ chế giải quyết hai vấn đề khác nhau:

| Cơ chế             | Vai trò                                  |
| ------------------ | ---------------------------------------- |
| Adaptive selection | Chọn cách perturb tốt                    |
| Acceptance         | Quyết định có đi sang solution mới không |

---

# 19. ALNS + Local Search

Thực tế thường không dừng ở:

$$
S'
=
Repair(Destroy(S))
$$

mà tiếp tục:

$$
S''
=
LocalSearch(S')
$$

Do đó:

$$
S
\rightarrow
Destroy
\rightarrow
Repair
\rightarrow
LocalSearch
\rightarrow
Acceptance
$$

Ví dụ:

```text
ALNS
  ↓
Destroy 20 houses
  ↓
Repair
  ↓
2-opt
  ↓
Relocate
  ↓
Swap
  ↓
VND
  ↓
Acceptance
```

Đây thường mạnh hơn rất nhiều.

---

# 20. ALNS + VND

Ta có thể đưa chương 11 vào đây.

Sau repair:

```text
VND
├── 2-opt
├── relocate
├── swap
├── insertion
└── ...
```

Tức là:

$$
S'
\rightarrow
VND(S')
$$

ALNS chịu trách nhiệm:

> **large-scale restructuring**

VND chịu trách nhiệm:

> **fine-grained optimization**

Hai tầng bổ sung cho nhau cực tốt.

---

# 21. ALNS + Beam Search

Ta cũng có thể kết hợp chương 12.

Repair thông thường:

```text
partial solution
      ↓
greedy insertion
      ↓
one solution
```

Beam Repair:

```text
partial solution
      ↓
candidate insertions
      ↓
keep top B states
      ↓
expand
      ↓
keep top B
      ↓
...
```

Do đó:

$$
Repair = BeamSearch
$$

Ta có:

$$
\boxed{ALNS + Beam Search}
$$

Đây là hybrid rất thú vị cho những bài toán mà repair có cấu trúc tổ hợp mạnh.

---

# 22. So sánh LNS và ALNS

|               | LNS                | ALNS                      |
| ------------- | ------------------ | ------------------------- |
| Destroy       | một hoặc vài loại  | nhiều loại                |
| Repair        | một hoặc vài loại  | nhiều loại                |
| Selection     | thường cố định     | adaptive                  |
| Learning      | ít/không           | có                        |
| Diversity     | phụ thuộc thiết kế | cao                       |
| Tự thích nghi | thấp               | cao                       |
| Độ phức tạp   | thấp hơn           | cao hơn                   |
| Tuning        | nhiều thủ công     | một phần được tự động hóa |

Điểm quan trọng:

> ALNS không loại bỏ heuristic design.

Ngược lại, **chất lượng của operator pool vẫn cực kỳ quan trọng**.

Nếu ta đưa vào 20 operator đều tệ thì ALNS không thể "học" ra một operator tốt từ hư không.

---

# 23. ALNS không phải Magic

Một sai lầm phổ biến là:

> "Có adaptive thì thuật toán tự tìm ra heuristic tốt."

Không hoàn toàn.

ALNS vẫn phụ thuộc vào:

$$
\boxed{
\text{Operator Pool}
}
$$

Nếu pool chứa:

```text
D1 = random bad
D2 = random bad
D3 = random bad
...
```

thì adaptive selection chỉ học được:

> "operator nào ít tệ nhất."

---

# 24. Operator Pool Design

Do đó thiết kế operator pool là một phần quan trọng của ALNS.

Một pool tốt nên có:

### 1. Diversity

Các operator nên có hành vi khác nhau.

### 2. Different scales

```text
small destruction
medium destruction
large destruction
```

### 3. Different biases

```text
random
cost-based
distance-based
structure-based
```

### 4. Different search philosophies

Ví dụ:

```text
exploration operator
exploitation operator
```

---

# 25. Một góc nhìn rất đẹp: ALNS tạo ra "portfolio"

Có thể coi operator pool là một **portfolio of heuristics**.

Ví dụ:

```text
                 ALNS
                  │
       ┌──────────┼──────────┐
       │          │          │
   Random      Spatial     Worst
       │          │          │
       └──────────┼──────────┘
                  │
             Adaptive
             selection
```

Thay vì hỏi:

> "Heuristic nào tốt nhất?"

ALNS hỏi:

> **"Ở thời điểm hiện tại, heuristic nào đáng thử nhất?"**

Đây là khác biệt về tư duy rất lớn.

---

# 26. Context-dependent behavior

Một operator có thể tốt trong một giai đoạn và xấu trong giai đoạn khác.

Ví dụ:

### Early search

Solution còn rất xấu:

```text
Large Random Removal
→ tốt
```

vì cần exploration.

### Late search

Solution đã khá tốt:

```text
Large Random Removal
→ phá quá mạnh
```

Trong khi:

```text
Worst Removal
→ tốt hơn
```

Do đó:

$$
P(D_i)
$$

có thể thay đổi theo **search phase**.

Đây chính là lý do adaptive mechanism rất hữu ích.

---

# 27. ALNS và "state of the search"

Một ALNS nâng cao có thể không chỉ nhìn reward quá khứ.

Nó có thể xét trạng thái hiện tại:

```text
distance from best
number of iterations without improvement
current destruction size
solution diversity
time remaining
```

Ví dụ:

```text
if search stagnates:
    tăng probability của large destroy
```

hoặc:

```text
if solution is far from best:
    exploration
else:
    exploitation
```

Đây là bước tiến từ:

> **Adaptive operator selection**

sang:

> **state-dependent adaptive search**

---

# 28. ALNS cho bài toán kỹ thuật viên điều hòa

Đây là nơi toàn bộ các chương trước bắt đầu hội tụ.

Ta có:

## Destroy operators

```text
D1 = RandomRemoval
D2 = WorstProfitRemoval
D3 = SpatialRemoval
D4 = DayRemoval
D5 = TypeRemoval
D6 = HighTravelRemoval
D7 = ClusterRemoval
```

---

## Repair operators

```text
R1 = GreedyInsertion
R2 = Regret2Insertion
R3 = Regret3Insertion
R4 = BeamInsertion
```

---

## Local Search

```text
VND
├── relocate
├── swap
├── 2-opt
└── day-reassignment
```

---

## Acceptance

Có thể dùng:

```text
Simulated Annealing
```

---

## Adaptive Layer

Theo dõi:

```text
score[D1 ... D7]
score[R1 ... R4]

weight[D1 ... D7]
weight[R1 ... R4]
```

---

# 29. Toàn bộ algorithm

Pseudo-code:

```text
S = InitialSolution()
S_best = S

initialize destroy weights
initialize repair weights

while not termination:

    D = select_destroy_operator(weights)
    R = select_repair_operator(weights)

    S_partial = D(S)

    S_new = R(S_partial)

    S_new = VND(S_new)

    outcome = acceptance(S, S_new)

    if outcome == ACCEPT:
        S = S_new

    if f(S_new) < f(S_best):
        S_best = S_new

    update score of D
    update score of R

    if segment finished:
        update weights

return S_best
```

Đây là skeleton quan trọng nhất của chương.

---

# 30. Complexity của ALNS

Giả sử:

* \(I\): số iterations;
* \(C_D\): cost destroy;
* \(C_R\): cost repair;
* \(C_L\): cost local search.

Khi đó xấp xỉ:

$$
O\left(
I(C_D+C_R+C_L)
\right)
$$

Adaptive selection gần như rất rẻ:

$$
O(|D|+|R|)
$$

hoặc có thể tối ưu thành sampling nhanh hơn nếu operator pool lớn.

Điểm quan trọng là:

> **Chi phí chính của ALNS không nằm ở adaptive mechanism.**

Nó nằm ở:

```text
Destroy
Repair
Local Search
```

---

# 31. Parameter tuning

ALNS có khá nhiều parameter:

### Weight-related

$$
\rho
$$

reaction factor.

### Segment

$$
L
$$

số iteration mỗi segment.

### Destruction

$$
q_{min},q_{max}
$$

### Acceptance

Nếu dùng SA:

$$
T_0,\alpha,T_{min}
$$

### Reward

```text
σ1 = global best
σ2 = improving current
σ3 = accepted
σ4 = rejected
```

Do đó ALNS có một vấn đề:

> **Metaheuristic itself has parameters.**

Đây là một chủ đề quan trọng của **parameter tuning**.

---

# 32. Reactive vs Adaptive

Hai khái niệm này khá gần nhau nhưng nên phân biệt.

### Static

```text
P(D1)=0.25
P(D2)=0.25
...
```

Không học.

### Reactive

Phản ứng với kết quả quan sát được:

```text
operator tốt
→ tăng probability
```

### Adaptive

Thường mang nghĩa rộng hơn:

```text
search behavior
→ observe
→ update
→ modify future behavior
```

ALNS thuộc nhóm **adaptive metaheuristic**.

---

# 33. Một cách nhìn toán học

Gọi operator được chọn ở iteration \(t\) là:

$$
O_t
$$

và outcome:

$$
Y_t
$$

Ta có:

$$
O_t
\rightarrow
Y_t
\rightarrow
w_{t+1}
$$

Tức là:

$$
w_{t+1}
=
F(w_t,Y_t)
$$

Trong đó \(F\) là adaptive update rule.

Selection:

$$
P(O_t=i)
=
\frac{w_i(t)}
{\sum_jw_j(t)}
$$

Do đó:

$$
\boxed{
w(t)
\rightarrow
P(t)
\rightarrow
O_t
\rightarrow
Y_t
\rightarrow
w(t+1)
}
$$

Đây chính là **feedback loop** của ALNS.

---

# 34. Feedback loop

Có thể nhìn ALNS như:

```text
       ┌──────────────────────┐
       │ Operator probabilities│
       └──────────┬───────────┘
                  ↓
            choose operator
                  ↓
             modify solution
                  ↓
              evaluate
                  ↓
               reward
                  ↓
            update weights
                  │
                  └───────────→
```

Đây là lý do chữ:

> **Adaptive**

quan trọng hơn chữ:

> **Large Neighborhood**

ở chương này.

LNS nói về **cách thay đổi solution**.

ALNS nói thêm về **cách thuật toán học cách thay đổi solution**.

---

# 35. ALNS so với các chương trước

Bây giờ ta có thể xâu chuỗi toàn bộ curriculum:

| Chương        | Tư tưởng                               |
| ------------- | -------------------------------------- |
| Greedy        | Chọn tốt nhất cục bộ                   |
| DP            | Ghi nhớ subproblem                     |
| Exact Search  | Tìm có hệ thống                        |
| Approximation | Đảm bảo chất lượng                     |
| Local Search  | Move nhỏ                               |
| SA            | Cho phép move xấu                      |
| Tabu          | Tránh quay lại                         |
| GA            | Population + evolution                 |
| GRASP         | Randomized Greedy + LS                 |
| ILS           | Perturb + LS                           |
| VNS           | Thay đổi neighborhood                  |
| Beam Search   | Giữ nhiều partial states               |
| LNS           | Destroy lớn + Repair                   |
| **ALNS**      | **LNS + học cách chọn Destroy/Repair** |

Ta có thể xem đây là một chuỗi tiến hóa:

$$
\boxed{
Local\ Search
\rightarrow
ILS/VNS
\rightarrow
LNS
\rightarrow
ALNS
}
$$

---

# 36. Điểm khác biệt sâu nhất giữa VNS, LNS và ALNS

Đây là phần tôi đặc biệt muốn cậu nắm.

### VNS

> **Neighborhood nào nên dùng?**

```text
N1 → N2 → N3 → ...
```

---

### LNS

> **Nên phá cấu trúc nào rồi xây lại?**

```text
Destroy → Repair
```

---

### ALNS

> **Hiện tại nên dùng cách phá và xây nào?**

```text
D1 ─┐
D2 ─┤
D3 ─┤→ adaptive selection
D4 ─┘
```

và:

```text
R1 ─┐
R2 ─┤→ adaptive selection
R3 ─┘
```

Nói cách khác:

$$
\boxed{
VNS:\ choose\ neighborhood
}
$$

$$
\boxed{
LNS:\ optimize\ a\ large\ neighborhood
}
$$

$$
\boxed{
ALNS:\ learn\ which\ neighborhood\ mechanism\ to\ use
}
$$

Đây là một cách phân biệt rất hữu ích.

---

# 37. Một insight quan trọng hơn nữa

Ta có thể viết:

$$
ALNS =
\underbrace{Large\ Neighborhood\ Search}_{search}
+
\underbrace{Adaptive\ Control}_{learning}
$$

Trong đó:

### Search layer

Tìm solution:

$$
S\rightarrow S'
$$

### Control layer

Điều khiển cách tìm:

$$
P(O_i)
$$

Hai lớp này tách biệt.

Đây là một design pattern rất đẹp khi cài đặt.

---

# 38. Architecture khi implement

Tôi khuyên thiết kế:

```text
ALNS
│
├── Solution
│
├── DestroyOperators
│   ├── RandomRemoval
│   ├── WorstRemoval
│   ├── SpatialRemoval
│   └── ...
│
├── RepairOperators
│   ├── GreedyRepair
│   ├── Regret2Repair
│   ├── Regret3Repair
│   └── ...
│
├── OperatorSelector
│
├── RewardManager
│
├── WeightUpdater
│
├── AcceptanceCriterion
│
└── LocalSearch
```

Điều này cực kỳ quan trọng khi code thực tế.

Không nên viết:

```cpp
if (...)
    randomRemoval();
else if (...)
    worstRemoval();
else if (...)
    spatialRemoval();
...
```

rồi trộn tất cả logic adaptive vào một hàm khổng lồ.

Nên coi operator là abstraction riêng.

---

# 39. ALNS dưới góc nhìn Software Engineering

Có thể định nghĩa interface:

```cpp
class DestroyOperator {
public:
    virtual void apply(Solution& s) = 0;
};
```

và:

```cpp
class RepairOperator {
public:
    virtual void apply(Solution& s) = 0;
};
```

Sau đó:

```cpp
vector<DestroyOperator*> destroyOps;
vector<RepairOperator*> repairOps;
```

Adaptive layer chỉ quan tâm:

```cpp
int selectOperator(weights);
void rewardOperator(id, reward);
void updateWeights();
```

Nhờ vậy:

> thêm heuristic mới **không cần sửa core ALNS**.

Đây chính là lợi ích lớn của kiến trúc này.

---

# 40. Những lỗi thiết kế ALNS thường gặp

### Lỗi 1 — Operator pool quá giống nhau

```text
D1 ≈ D2 ≈ D3
```

→ adaptive selection không có nhiều ý nghĩa.

---

### Lỗi 2 — Reward quá cực đoan

Ví dụ:

```text
best = 1000000
others = 1
```

Một lần thành công có thể làm weight bị thống trị quá lâu.

---

### Lỗi 3 — \(\rho\) quá lớn

Weights dao động mạnh:

```text
D1 ↑↑↑
D2 ↓↓↓
D1 ↓↓↓
D2 ↑↑↑
...
```

---

### Lỗi 4 — Không có exploration

Operator tệ trong giai đoạn đầu bị giảm weight gần 0 và không bao giờ được thử lại.

---

### Lỗi 5 — Destroy quá mạnh

```text
remove 80%
→ repair gần như random
```

ALNS biến thành random restart.

---

### Lỗi 6 — Repair quá yếu

Destroy tốt nhưng repair không đủ khả năng tái cấu trúc solution.

---

# 41. Công thức tư duy để ghi nhớ

Nếu chỉ cần nhớ một công thức của chương này, hãy nhớ:

$$
\boxed{
ALNS =
Destroy
+
Repair
+
Adaptive\ Operator\ Selection
+
Acceptance
}
$$

và adaptive loop:

$$
\boxed{
Select
\rightarrow
Search
\rightarrow
Evaluate
\rightarrow
Reward
\rightarrow
Update
}
$$

---

# 42. Toàn bộ pipeline cho bài toán AC

Nếu ghép tất cả kiến thức đã học:

```text
                    Initial Solution
                           │
                           ▼
                       ALNS loop
                           │
             ┌─────────────┴─────────────┐
             │                           │
             ▼                           ▼
      Adaptive Destroy            Adaptive Repair
             │                           │
       Random/Spatial/...         Greedy/Regret/Beam
             │                           │
             └─────────────┬─────────────┘
                           ▼
                          VND
                           │
                    ┌──────┴──────┐
                    │             │
                   2-opt       Relocate
                    │             │
                    └──────┬──────┘
                           ▼
                       Acceptance
                           │
                           ▼
                       New State
                           │
                           ▼
                        Reward
                           │
                           ▼
                    Update Weights
                           │
                           └───────► repeat
```

Đây là một **metaheuristic khá hoàn chỉnh**, chứ không còn là một heuristic đơn giản nữa.

---

# 43. Vị trí của ALNS trong bức tranh lớn

Sau 14 chương, ta đã đi từ những thuật toán rất cơ bản:

$$
Greedy
$$

đến những hệ thống tìm kiếm ngày càng phức tạp:

$$
Greedy
\rightarrow
Local\ Search
\rightarrow
SA
\rightarrow
Tabu
\rightarrow
ILS
\rightarrow
VNS
\rightarrow
LNS
\rightarrow
ALNS
$$

Điều thú vị là complexity của **ý tưởng điều khiển search** tăng dần.

Ban đầu:

> "Đi theo hướng tốt nhất."

Sau đó:

> "Đôi khi đi hướng xấu."

Rồi:

> "Đừng quay lại."

Rồi:

> "Phá solution rồi xây lại."

Và cuối cùng:

> **"Hãy quan sát xem cách phá/xây nào đang hiệu quả, rồi tự điều chỉnh cách tìm kiếm."**

Đó chính là tư tưởng trung tâm của **Adaptive Large Neighborhood Search**.

---

## 44. Những khái niệm nên nắm thật chắc sau chương này

Tôi đề xuất coi 10 khái niệm sau là "core knowledge" của ALNS:

1. **Destroy operator pool**
2. **Repair operator pool**
3. **Adaptive operator selection**
4. **Weighted roulette-wheel selection**
5. **Reward / score**
6. **Reaction factor \(\rho\)**
7. **Segment-based weight update**
8. **Exploration vs exploitation**
9. **Adaptive destruction degree**
10. **ALNS + Local Search / SA / VND / Beam / MIP**

Đặc biệt, **#3–#8** là phần tạo nên ALNS; còn #10 là phần đưa ALNS thành một framework thực chiến mạnh.

---

### Một cách nhìn cuối cùng

Nếu **LNS** là:

$$
\boxed{
\text{"Tôi có nhiều cách để phá solution."}
}
$$

thì **ALNS** là:

$$
\boxed{
\text{"Tôi có nhiều cách để phá solution,
và tôi sẽ học cách nào nên được dùng nhiều hơn."}
}
$$

Đây là bước chuyển từ **metaheuristic tĩnh** sang **metaheuristic có cơ chế thích nghi**.

Với bài toán kỹ thuật viên điều hòa của cậu, ALNS đặc biệt phù hợp vì không gian quyết định có nhiều "cấu trúc" khác nhau — **house nào được chọn, thứ tự ghé, phân bổ theo ngày, loại máy, thời gian di chuyển và giới hạn thời gian/ngày**. Những cấu trúc này cho phép xây dựng một operator pool rất phong phú, từ đó adaptive mechanism mới thực sự có đất để phát huy.
