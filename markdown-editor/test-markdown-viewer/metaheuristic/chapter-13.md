# Chương 13 — Large Neighborhood Search (LNS)

Nếu **Local Search** ở chương 5 có tư tưởng:

> “Từ nghiệm hiện tại, thử một thay đổi nhỏ để đi sang nghiệm hàng xóm tốt hơn.”

thì **Large Neighborhood Search** đi theo hướng gần như ngược lại:

> **“Phá một phần khá lớn của nghiệm hiện tại, rồi xây dựng lại phần đó thật thông minh.”**

Đây là một ý tưởng cực kỳ quan trọng trong tối ưu tổ hợp hiện đại, đặc biệt với:

* Scheduling
* Vehicle Routing Problem (VRP)
* TSP
* Production planning
* Assignment
* Packing
* Routing
* Timetabling
* Constraint Programming
* Mixed Integer Programming

Và LNS có một điểm rất đáng chú ý: **nó là cầu nối rất đẹp giữa heuristic/metaheuristic và exact optimization/constraint programming**.

---

# 13.1. LNS là gì?

Giả sử ta đang có một nghiệm:

```text
S = [A B C D E F G H I J]
```

Local Search thường thử những thay đổi nhỏ:

```text
[A B C D E F G H I J]
       ↓
[A B D C E F G H I J]     swap C,D

[A B C E D F G H I J]     insert

[A B C D E G F H I J]
```

Tức là thay đổi một số rất ít thành phần.

LNS thì làm:

```text
[A B C D E F G H I J]
       ↓
destroy
       ↓
[A B _ _ E _ _ H I J]
       ↓
repair
       ↓
[A B D C E F G H I J]
```

Nhưng phần bị phá có thể **rất lớn**:

```text
[A B C D E F G H I J]
        ↓
[A B _ _ _ _ _ H I J]
```

sau đó solver xây lại:

```text
[A B K D C F G H I J]
```

Mô hình cơ bản:

$$
\boxed{
S
\xrightarrow{Destroy}
S'
\xrightarrow{Repair}
S''
}
$$

và nếu:

$$
f(S'') > f(S)
$$

thì cập nhật incumbent.

---

# 13.2. Vì sao gọi là "Large Neighborhood"?

Trong Local Search:

$$
N(S)
$$

thường được định nghĩa bằng những thay đổi nhỏ.

Ví dụ:

$$
N_{swap}(S)
$$

là tất cả nghiệm có được bằng cách swap hai phần tử.

Nếu có \(n\) phần tử:

$$
|N_{swap}(S)|=O(n^2)
$$

LNS không định nghĩa neighborhood theo kiểu:

> “swap chính xác hai phần tử”.

Thay vào đó:

$$
\boxed{
N_{LNS}(S)
=
\text{tập các nghiệm có thể tạo ra sau khi destroy + repair}
}
$$

Neighborhood này có thể cực kỳ lớn.

Ví dụ:

```text
Current solution
       │
       │ remove 40% components
       ▼
Partial solution
       │
       │ optimize remaining 40%
       ▼
many possible solutions
```

Do đó:

$$
|N_{LNS}(S)| \gg |N_{local}(S)|
$$

Đây chính là ý nghĩa của **Large Neighborhood**.

---

# 13.3. LNS xuất hiện để giải quyết vấn đề gì?

Ta đã thấy một vấn đề rất lớn ở Chapter 5.

Local Search:

```text
             Global optimum
                  ★
                 /
                /
      ┌────────●
      │       local optimum
      │
      │
     start
```

Nghiệm hiện tại có thể nằm trong một **local optimum**.

Nếu mọi move nhỏ đều không cải thiện:

$$
\forall S'\in N(S):
f(S')\le f(S)
$$

thì Local Search dừng.

---

## Với LNS

Ta phá nhiều biến cùng lúc:

```text
                 Global optimum
                      ★
                    /
                   /
                  /
        ┌───────────────┐
        │ current       │
        │ local optimum │
        └──────┬────────┘
               │
             destroy
               │
               ▼
          partial solution
               │
             repair
               │
               ▼
          new region
```

Tức LNS cho phép **thoát khỏi basin of attraction** của local optimum.

Đây là điểm liên hệ rất mạnh với:

* Simulated Annealing
* Tabu Search
* Iterated Local Search
* VNS

nhưng cơ chế khác hẳn.

---

# 13.4. LNS khác ILS thế nào?

Hai thuật toán rất dễ nhầm.

### ILS

```text
S
 ↓
Local Search
 ↓
S*
 ↓
Perturbation
 ↓
S'
 ↓
Local Search
 ↓
...
```

Perturbation thường là một số thay đổi được thiết kế để đẩy nghiệm sang vùng khác.

### LNS

```text
S
 ↓
Destroy
 ↓
Partial S
 ↓
Repair / Optimization
 ↓
S'
 ↓
...
```

Điểm quan trọng:

$$
\boxed{
ILS:
\text{perturb} \rightarrow \text{local search}
}
$$

còn:

$$
\boxed{
LNS:
\text{destroy} \rightarrow \text{re-optimize}
}
$$

LNS không chỉ “nhiễu” nghiệm.

Nó **cố tình bỏ một phần nghiệm và giải lại phần đó**.

Đây là khác biệt bản chất.

---

# 13.5. LNS khác VNS thế nào?

VNS:

```text
N1 → N2 → N3 → ...
```

thay đổi **neighborhood structure**.

Ví dụ TSP:

```text
N1 = 2-opt
N2 = 3-opt
N3 = Or-opt
```

LNS:

```text
destroy 20%
repair
destroy 40%
repair
destroy 60%
repair
```

Có thể xem:

$$
\boxed{
VNS = thay đổi cách di chuyển
}
$$

còn:

$$
\boxed{
LNS = thay đổi lượng cấu trúc bị phá rồi tái tối ưu
}
$$

---

# 13.6. Cấu trúc chuẩn của LNS

LNS có 4 thành phần chính:

```text
             Current solution S
                     │
                     ▼
              ┌─────────────┐
              │   Destroy   │
              └──────┬──────┘
                     │
                     ▼
             Partial solution
                     │
                     ▼
              ┌─────────────┐
              │    Repair   │
              └──────┬──────┘
                     │
                     ▼
                  S_new
                     │
                     ▼
              Acceptance
                     │
                     ▼
               next iteration
```

Có thể viết:

$$
S'
=
Repair(Destroy(S))
$$

Sau đó:

$$
S\leftarrow
Accept(S,S')
$$

---

# 13.7. Destroy Operator

Đây là component đầu tiên.

Ta chọn một tập biến/thành phần:

$$
R\subseteq S
$$

rồi remove chúng.

Ví dụ:

```text
S = A B C D E F G H I J

destroy:
    C D F G

→

A B _ _ E _ _ H I J
```

Phần còn lại được giữ nguyên.

---

# 13.8. Random Removal

Đơn giản nhất:

```text
randomly select k components
```

Ví dụ:

```text
S = A B C D E F G H I J

random:
C, F, I

→

A B _ D E _ G H _ J
```

Ưu điểm:

* đơn giản;
* dễ implement;
* tạo diversification.

Nhược điểm:

* không tận dụng cấu trúc bài toán.

Random removal thường là baseline tốt nhưng hiếm khi là destroy operator mạnh nhất.

---

# 13.9. Worst Removal

Một ý tưởng rất hay.

Thay vì random, ta tìm những thành phần đang đóng góp tệ cho nghiệm.

Ví dụ routing:

```text
A → B → C → D → E
```

Nếu customer `C` làm tăng cost rất lớn:

$$
\Delta cost(C)\gg 0
$$

ta ưu tiên remove C.

Tức:

$$
\boxed{
\text{remove components causing poor objective contribution}
}
$$

Sau đó repair có cơ hội tìm vị trí tốt hơn cho chúng.

Đây là:

> **intensification-oriented destroy**

---

# 13.10. Related Removal

Đây là một destroy operator cực kỳ quan trọng trong routing.

Giả sử:

```text
A
B
C
D
E
F
G
```

và khoảng cách:

```text
dist(A,B) nhỏ
dist(A,C) nhỏ
dist(A,D) lớn
```

Nếu chọn A làm seed:

```text
A
↓
remove B
remove C
remove ...
```

ta phá một **cluster**.

Ví dụ:

```text
Route:

Depot → A → B → C → D → E → F → Depot
              ↑
          cluster
```

Remove:

```text
B,C,D
```

rồi repair.

Điều này cho phép solver **tái cấu trúc toàn bộ một vùng** thay vì chỉ di chuyển từng customer.

---

# 13.11. Shaw Removal

Một destroy operator kinh điển cho VRP là **Shaw removal**.

Ý tưởng:

> Remove những customer có quan hệ gần nhau.

Mức độ relatedness có thể dựa trên:

$$
R(i,j)
=
\alpha d(i,j)
+
\beta |q_i-q_j|
+
\gamma |t_i-t_j|
$$

trong đó:

* \(d(i,j)\): khoảng cách;
* \(q_i\): demand;
* \(t_i\): time window;
* các hệ số điều chỉnh trọng số.

Nếu:

$$
R(i,j)
$$

nhỏ → hai customer “related”.

Ta remove chúng cùng nhau.

Điều này rất mạnh vì nó phá **một cấu trúc liên quan** trong nghiệm.

---

# 13.12. Cluster Removal

Một cách khác:

```text
customer cluster
       ↓
remove entire cluster
       ↓
repair
```

Có thể tạo cluster bằng:

* geographic clustering;
* time-window similarity;
* machine similarity;
* job family;
* resource similarity.

Đây là một tư tưởng rất tổng quát:

$$
\boxed{
Destroy \neq random deletion
}
$$

Destroy tốt phải biết **cấu trúc nào đáng phá**.

---

# 13.13. Repair Operator

Sau destroy:

```text
A B _ _ E _ _ H I J
```

ta phải xây lại nghiệm.

Đây thường là phần **quan trọng nhất** của LNS.

Repair có thể:

* greedy;
* regret heuristic;
* exact optimization;
* dynamic programming;
* CP;
* MIP;
* shortest path;
* matching;
* specialized algorithm.

Và đây là điểm khiến LNS đặc biệt.

---

# 13.14. Greedy Repair

Đơn giản nhất.

Lấy một phần tử chưa được đặt:

```text
C
```

thử các vị trí:

```text
position 1
position 2
...
position n
```

chọn insertion tốt nhất.

Ví dụ:

$$
\Delta(C,p)
=
f(S\oplus(C,p))-f(S)
$$

chọn:

$$
p^*
=
\arg\min_p \Delta(C,p)
$$

đối với minimization.

Sau đó tiếp tục phần tử tiếp theo.

---

# 13.15. Regret Repair

Đây là một kỹ thuật cực hay và rất đáng học.

Giả sử customer `C` có:

```text
best insertion cost = 5
second best = 6
```

regret:

$$
r(C)=6-5=1
$$

Customer khác:

```text
best = 5
second best = 50
```

thì:

$$
r(C)=45
$$

Customer thứ hai nguy hiểm hơn:

> Nếu không đặt nó vào vị trí tốt nhất ngay bây giờ, ta có thể mất cơ hội đó.

Vì vậy:

$$
\boxed{
\text{repair customer có regret lớn trước}
}
$$

Đây là một dạng **lookahead heuristic**.

---

# 13.16. Regret-k

Không chỉ có second-best.

Ta có:

$$
r_k(i)
=
\sum_{j=2}^{k}
(c_{ij}-c_{i1})
$$

Trong đó:

* \(c_{i1}\): insertion tốt nhất;
* \(c_{i2}\): insertion tốt thứ 2;
* ...

Ví dụ:

$$
c_1=5,\quad c_2=8,\quad c_3=20
$$

thì:

$$
r_3=(8-5)+(20-5)=18
$$

Regret càng lớn → càng nên xử lý sớm.

---

# 13.17. Điểm đặc biệt: Repair có thể là Exact Solver

Đây là phần quan trọng nhất của chương.

Giả sử:

```text
Original solution
       ↓
destroy 40%
       ↓
remaining 60% fixed
       ↓
40% variables unknown
```

Thay vì greedy repair, ta có thể:

```text
remaining variables
        ↓
      solve
    exact MIP / CP
        ↓
 optimal repair
```

Đây chính là **Large Neighborhood Search theo tinh thần hiện đại**.

Ví dụ:

$$
\min f(x)
$$

với:

```text
x1, x2, ..., x60 fixed
x61, ..., x100 free
```

Ta giải subproblem:

$$
\min
f(x_1,\ldots,x_{100})
$$

subject to:

$$
x_1,\ldots,x_{60}
=
\text{current values}
$$

và tối ưu các biến còn lại.

Đây chính là lý do LNS là cầu nối giữa:

$$
\boxed{
Metaheuristic
\longleftrightarrow
Mathematical Optimization
}
$$

---

# 13.18. LNS và Mathematical Programming

Hãy nhìn bài toán MIP:

$$
\min c^Tx
$$

subject to:

$$
Ax\le b
$$

Ta có nghiệm hiện tại:

$$
x^*
$$

LNS chọn một tập biến:

$$
F
$$

cho phép chúng thay đổi:

$$
x_i\quad i\in F
$$

Các biến khác cố định:

$$
x_i=x_i^*
\qquad i\notin F
$$

Sau đó giải:

$$
\boxed{
\min c^Tx
}
$$

với:

$$
x_i=x_i^*
\quad i\notin F
$$

Đây là **Large Neighborhood** dưới góc nhìn mathematical programming.

---

# 13.19. Tại sao subproblem vẫn "large"?

Giả sử bài toán có:

$$
n=10,000
$$

variables.

Local Search:

```text
thay đổi 1–2 variables
```

LNS:

```text
thả tự do 1,000 variables
```

MIP solver giải:

```text
1,000-variable subproblem
```

Nó lớn hơn nhiều so với neighborhood truyền thống.

Nhưng vẫn nhỏ hơn:

```text
10,000-variable full problem
```

Do đó:

$$
\boxed{
\text{Large neighborhood}
\neq
\text{solve entire problem}
}
$$

mà là:

$$
\boxed{
\text{solve a large but restricted subproblem}
}
$$

---

# 13.20. Đây chính là "Destroy and Repair"

Một cách gọi cực kỳ phổ biến:

$$
\boxed{
\text{Destroy-and-Repair}
}
$$

Toàn bộ LNS có thể nhớ bằng:

```text
      Current Solution
             │
        ┌────▼────┐
        │ Destroy │
        └────┬────┘
             │
       Partial Solution
             │
        ┌────▼────┐
        │  Repair │
        └────┬────┘
             │
        New Solution
```

Nếu cậu gặp paper nói:

> destroy-and-repair heuristic

thì lập tức nghĩ đến họ LNS.

---

# 13.21. Acceptance Criterion

Sau khi tạo:

$$
S'
$$

không nhất thiết lúc nào cũng:

$$
S\leftarrow S'
$$

Có nhiều lựa chọn.

### Hill climbing

$$
S' \text{ tốt hơn } S
\Rightarrow accept
$$

### Simulated Annealing

Có thể chấp nhận nghiệm xấu với xác suất:

$$
P=
e^{-\Delta/T}
$$

### Threshold acceptance

Accept nếu:

$$
f(S')\le f(S)+\theta
$$

### Record-to-record travel

Cho phép nghiệm mới không tệ hơn best quá một ngưỡng.

Như vậy LNS có thể kết hợp với rất nhiều acceptance mechanisms.

---

# 13.22. LNS cơ bản

Pseudo-code:

```text
S ← InitialSolution()

while not termination:

    S_partial ← Destroy(S)

    S_new ← Repair(S_partial)

    if Accept(S_new, S):
        S ← S_new

return best solution
```

Nếu dùng greedy repair:

```text
Destroy
   ↓
Greedy Repair
   ↓
Local Search
   ↓
Accept
```

thì đã có một solver khá mạnh.

---

# 13.23. Adaptive Large Neighborhood Search — ALNS

Đây là phần **cực kỳ quan trọng**.

Trong LNS, ta có thể có nhiều destroy/repair operators:

```text
Destroy:
D1 = Random Removal
D2 = Worst Removal
D3 = Related Removal
D4 = Cluster Removal

Repair:
R1 = Greedy
R2 = Regret-2
R3 = Regret-3
R4 = Exact
```

Câu hỏi:

> Chọn operator nào?

ALNS nói:

> **Đừng chọn cố định. Hãy học operator nào đang hoạt động tốt.**

---

# 13.24. Ý tưởng ALNS

Ban đầu:

```text
D1 D2 D3 D4
```

được assign weights:

$$
w_1=w_2=w_3=w_4=1
$$

Mỗi iteration chọn operator dựa trên weight.

Nếu:

```text
D3 + R2
```

liên tục tạo nghiệm tốt:

$$
w(D3)\uparrow
$$

Nếu:

```text
D1 + R1
```

không hiệu quả:

$$
w(D1)\downarrow
$$

Đây là:

$$
\boxed{
\text{adaptive operator selection}
}
$$

---

# 13.25. Adaptive Roulette Wheel

Một cách phổ biến:

$$
P_i
=
\frac{w_i}
{\sum_j w_j}
$$

Ví dụ:

```text
D1 = 1
D2 = 2
D3 = 6
D4 = 1
```

thì:

$$
P(D3)=\frac{6}{10}=60\%
$$

D3 được chọn thường xuyên hơn.

---

# 13.26. Score cho operator

Có thể reward operator nếu nó:

### Tạo global best

$$
score= \sigma_1
$$

### Cải thiện current

$$
score=\sigma_2
$$

### Tạo nghiệm được accept

$$
score=\sigma_3
$$

### Không có ích

$$
score=0
$$

Sau mỗi segment:

$$
w_i
\leftarrow
(1-\rho)w_i+\rho\frac{score_i}{usage_i}
$$

Trong đó:

* \(\rho\): reaction factor.

Đây là cách ALNS “học” operator nào phù hợp với instance hiện tại.

---

# 13.27. LNS vs ALNS

|               | LNS                      | ALNS           |
| ------------- | ------------------------ | -------------- |
| Destroy       | thường 1/một số operator | nhiều operator |
| Repair        | thường 1/một số operator | nhiều operator |
| Chọn operator | fixed/random             | adaptive       |
| Learning      | không                    | có             |
| Complexity    | thấp hơn                 | cao hơn        |
| Robustness    | phụ thuộc operator       | thường tốt hơn |

Có thể xem:

$$
\boxed{
ALNS = LNS + Adaptive Operator Selection
}
$$

---

# 13.28. LNS + Simulated Annealing

Đây là một hybrid cực tự nhiên.

```text
Destroy
   ↓
Repair
   ↓
S'
   ↓
SA acceptance
   ↓
continue
```

Ta không cần chỉ chấp nhận nghiệm tốt.

Nếu:

$$
\Delta=f(S')-f(S)<0
$$

vẫn có xác suất:

$$
P=e^{\Delta/T}
$$

đối với maximization theo convention thích hợp.

Kết quả:

```text
LNS
→ large jumps

SA
→ accepts bad jumps
```

Hai cơ chế bổ sung nhau.

---

# 13.29. LNS + Local Search

Đây có lẽ là hybrid đơn giản nhất.

```text
S
 ↓
Destroy
 ↓
Repair
 ↓
Local Search
 ↓
S*
```

Tại sao hiệu quả?

Repair tạo ra một nghiệm mới nhưng có thể chưa tối ưu cục bộ.

Local Search sau đó:

```text
2-opt
3-opt
swap
insert
VND
```

để polish nghiệm.

Ta có:

$$
\boxed{
\text{LNS = diversification}
}
$$

và:

$$
\boxed{
\text{LS = intensification}
}
$$

---

# 13.30. LNS + VND

Một architecture đẹp:

```text
                 S
                 │
              Destroy
                 │
          Partial solution
                 │
               Repair
                 │
                 ▼
                S'
                 │
                VND
          ┌──────┼──────┐
          ↓      ↓      ↓
        Swap   Insert   2-opt
          │      │      │
          └──────┼──────┘
                 ▼
              Local Opt
```

Cái này rất phù hợp với curriculum của chúng ta.

---

# 13.31. LNS + Beam Search

Cũng có thể kết hợp với chương 12:

```text
Destroy
   ↓
partial solution
   ↓
Beam Search
   ↓
top W repairs
   ↓
Local Search
   ↓
best
```

Tức thay vì repair bằng một solution:

$$
Repair(S')
\rightarrow S''
$$

ta tạo:

$$
Repair(S')
\rightarrow
\{S_1'',S_2'',...,S_W''\}
$$

rồi chọn tốt nhất.

Đây là một cách rất thú vị để kết hợp hai chương 12 và 13.

---

# 13.32. Một ví dụ cụ thể: TSP

Giả sử:

```text
A → B → C → D → E → F → G → H → A
```

Cost:

$$
C=500
$$

LNS destroy:

```text
remove C,D,E
```

ta có:

```text
A → B → _ → _ → _ → F → G → H → A
```

Repair:

Thử chèn:

```text
C,D,E
```

theo nhiều thứ tự/vị trí.

Một repair có thể tạo:

```text
A → B → E → C → D → F → G → H → A
```

Cost:

$$
C'=420
$$

Cải thiện:

$$
500\rightarrow420
$$

Sau đó chạy 2-opt:

```text
420 → 390
```

Vậy một iteration:

$$
\boxed{
500
\overset{Destroy/Repair}{\longrightarrow}
420
\overset{2-opt}{\longrightarrow}
390
}
$$

---

# 13.33. Tại sao LNS có thể phá local optimum rất mạnh?

Giả sử Local Search đang ở:

```text
A B C D E F G H
```

mọi swap đều xấu:

$$
\Delta f<0
$$

Nhưng optimum yêu cầu:

```text
A D F B C H E G
```

Cần thay đổi rất nhiều vị trí.

Local Search có thể phải đi qua:

```text
xấu
↓
xấu
↓
xấu
↓
tốt
```

nhưng không cho phép bước xấu.

LNS có thể:

```text
remove B,C,D,E
       ↓
A _ _ _ _ F G H
       ↓
repair
       ↓
A D F B C H E G
```

Nó **nhảy qua cả vùng nghiệm xấu**.

Đây là lý do "large neighborhood" có sức mạnh lớn.

---

# 13.34. Một góc nhìn toán học rất đẹp

Local Search:

$$
S_{t+1}\in N(S_t)
$$

với neighborhood nhỏ.

LNS:

$$
S_{t+1}
\in
\mathcal{R}(D(S_t))
$$

trong đó:

* \(D\): destroy operator;
* \(\mathcal R\): tập nghiệm có thể repair.

Neighborhood hiệu dụng là:

$$
\boxed{
N_{LNS}(S)
=
\{Repair(Destroy(S))\}
}
$$

Do repair có thể tạo hàng triệu khả năng:

$$
|N_{LNS}(S)|
$$

có thể cực lớn.

Nhưng ta không enumerate toàn bộ.

Thay vào đó:

$$
\boxed{
\text{solve / heuristically explore the neighborhood}
}
$$

Đây là insight rất quan trọng.

---

# 13.35. LNS thực chất là một cách "search neighborhood bằng solver"

Hãy nhìn:

### Local Search

```text
Neighborhood
     ↓
enumerate neighbors
     ↓
pick best
```

### LNS

```text
Large Neighborhood
     ↓
define subproblem
     ↓
solve subproblem
     ↓
get promising neighbor
```

Do đó:

$$
\boxed{
LNS
=
Neighborhood\ Search
+
Subproblem\ Optimization
}
$$

Đặc biệt khi repair là exact:

$$
\boxed{
LNS
=
Metaheuristic\ outer\ loop
+
Exact\ inner\ solver
}
$$

Đây chính là bản chất của nhiều **matheuristics**.

---

# 13.36. Exact LNS

Một phiên bản rất thú vị:

```text
Current solution S
       ↓
select variables to relax
       ↓
fix all other variables
       ↓
exact solver
       ↓
optimal solution of neighborhood
       ↓
S'
```

Nếu subproblem được giải hoàn toàn:

$$
S'
=
\arg\min_{x\in N(S)}f(x)
$$

thì ta đang thực hiện **exact optimization trên một large neighborhood**.

Không exact trên toàn bài toán.

---

# 13.37. LNS và CP-SAT

Trong thực tế hiện đại, LNS đặc biệt quan trọng với **Constraint Programming / CP-SAT**.

Một solver có thể:

```text
global problem
     ↓
find feasible solution
     ↓
freeze most decisions
     ↓
relax selected decisions
     ↓
solve subproblem
     ↓
improved solution
     ↓
repeat
```

Đây là một pattern rất mạnh.

Đặc biệt trong scheduling:

```text
job assignment
machine assignment
start time
sequence
```

có thể freeze 80–95% và chỉ relax một phần.

---

# 13.38. LNS và bài Air Conditioner của cậu

Đây là phần tôi nghĩ đặc biệt đáng chú ý.

Ta có:

* tối đa 400 house;
* 30 ngày;
* mỗi ngày 720 phút;
* vị trí hiện tại;
* travel Manhattan;
* cleaning time;
* reward theo loại house;
* overtime reward;
* mỗi house chỉ làm một lần.

Một nghiệm có thể biểu diễn:

```text
Day 1:
H17 → H42 → H91 → ...

Day 2:
H5 → H200 → ...

...

Day 30:
...
```

---

## Destroy

Ví dụ remove:

```text
20 houses
```

khỏi schedule.

Ta có:

```text
Day 1:
H17 → H42 → _ → H91

Day 2:
H5 → _ → H200

...
```

---

## Repair

Thử đưa 20 house đó trở lại:

```text
H123 → Day 3, position 4
H87  → Day 7, position 2
...
```

sao cho:

$$
\Delta Score
$$

lớn nhất.

---

# 13.39. Destroy thông minh cho Air Conditioner

Có rất nhiều destroy operator tự nhiên.

### Random houses

```text
random 20%
```

### Low-profit houses

Remove những house:

$$
\frac{price_i}{serviceTime_i+travelTime_i}
$$

thấp.

### Geographical removal

Chọn một vùng:

```text
x ∈ [20,40]
y ∈ [50,70]
```

và remove toàn bộ house trong vùng.

### Day removal

Chọn một ngày:

```text
Day 17
```

remove phần lớn schedule của ngày đó.

### Consecutive route removal

Chọn một đoạn:

```text
A → B → C → D → E
```

remove:

```text
C,D,E
```

### Type removal

Remove toàn bộ một số loại house:

```text
m = 1,2
```

để repair lại.

---

# 13.40. Đây là một destroy cực mạnh cho bài AC

Giả sử schedule:

```text
Day 1:  A B C D E F
Day 2:  G H I J K
Day 3:  L M N O P
```

Chọn:

```text
Day 2
```

destroy:

```text
Day 1: A B C D E F
Day 2: empty
Day 3: L M N O P
```

Sau đó **solve lại Day 2**.

Đây chính là:

$$
\boxed{
\text{day-level LNS}
}
$$

Nếu chỉ relax một ngày:

$$
\text{Subproblem size}\approx \text{houses available around Day 2}
$$

rất dễ xử lý.

---

# 13.41. Destroy theo spatial cluster

Vì travel cost là Manhattan:

$$
d((x_1,y_1),(x_2,y_2))
=
|x_1-x_2|+|y_1-y_2|
$$

nên spatial structure rất quan trọng.

Ta có thể:

```text
chọn seed house H
      ↓
tìm k house gần H
      ↓
remove chúng
      ↓
repair
```

Điều này có khả năng tái cấu trúc route một khu vực.

Đây là destroy operator rất tự nhiên cho bài toán.

---

# 13.42. Nhưng LNS có một điểm yếu lớn

Nếu destroy quá nhỏ:

```text
remove 1 house
```

thì:

$$
LNS\approx Local Search
$$

Nếu destroy quá lớn:

```text
remove 90%
```

thì:

* repair rất khó;
* mất nhiều cấu trúc tốt;
* runtime tăng;
* search trở nên gần random reconstruction.

Do đó cần tìm:

$$
\boxed{
\text{optimal destruction degree}
}
$$

Ví dụ:

$$
q\in[10\%,40\%]
$$

và có thể adaptive.

---

# 13.43. Adaptive Destroy Size

Ta có:

```text
q = 10%
q = 20%
q = 30%
q = 40%
q = 50%
```

Nếu:

```text
q = 30%
```

thường tạo improvement lớn:

$$
w_{30}\uparrow
$$

Nếu:

```text
q = 50%
```

tệ:

$$
w_{50}\downarrow
$$

Đây là một dạng ALNS nâng cao:

$$
\boxed{
\text{adaptive neighborhood size}
}
$$

---

# 13.44. So sánh toàn bộ chương 5–13

| Thuật toán   | Đơn vị search          | Cách thoát local optimum        |
| ------------ | ---------------------- | ------------------------------- |
| Local Search | solution               | không                           |
| SA           | solution               | accept worse                    |
| Tabu Search  | solution               | tabu + aspiration               |
| ILS          | local optimum          | perturbation                    |
| VNS          | neighborhood           | đổi neighborhood                |
| GRASP        | construction           | restart/randomized construction |
| GA           | population             | crossover/mutation              |
| Beam Search  | partial solutions      | giữ nhiều branches              |
| **LNS**      | **large neighborhood** | **destroy + repair**            |

Có thể thấy:

```text
Local Search
      ↓
   small move

VNS
      ↓
change neighborhood

ILS
      ↓
perturb solution

LNS
      ↓
destroy large part
      ↓
re-optimize
```

---

# 13.45. LNS nằm ở đâu trong taxonomy?

Roadmap của chúng ta hiện tại có thể mở rộng:

```text
Combinatorial Optimization
│
├── Exact
│   ├── DFS
│   ├── Branch & Bound
│   ├── DP
│   └── Integer Programming
│
├── Constructive
│   └── Greedy
│
├── Approximation
│
├── Local / Metaheuristic
│   ├── Local Search
│   ├── SA
│   ├── Tabu
│   ├── GA
│   ├── GRASP
│   ├── ILS
│   ├── VND / VNS
│   ├── Beam Search
│   └── LNS
│
└── Matheuristics
    ├── LNS + MIP
    ├── LNS + CP
    ├── ALNS + MIP
    └── ...
```

LNS nằm ở vị trí đặc biệt:

$$
\boxed{
\text{Metaheuristic}
\leftrightarrow
\text{Matheuristic}
}
$$

---

# 13.46. Ba level của LNS

Có thể phân cấp rất rõ:

### Level 1 — Simple LNS

```text
Random Destroy
       ↓
Greedy Repair
```

### Level 2 — ALNS

```text
Multiple Destroy
Multiple Repair
       ↓
Adaptive selection
```

### Level 3 — Matheuristic LNS

```text
Destroy
   ↓
MIP / CP / DP / exact subsolver
   ↓
Repair
```

Càng xuống dưới:

* solver phức tạp hơn;
* mỗi iteration đắt hơn;
* nhưng neighborhood mạnh hơn rất nhiều.

---

# 13.47. Công thức tổng quát

Một formulation rất đẹp:

Cho bài toán:

$$
\min_{x\in X}f(x)
$$

và nghiệm hiện tại:

$$
x^t
$$

Chọn tập biến được relax:

$$
F_t
$$

Ta cố định:

$$
x_i=x_i^t
\quad
\forall i\notin F_t
$$

và giải:

$$
\boxed{
x^{t+1}
=
\arg\min
f(x)
}
$$

subject to:

$$
x\in X
$$

$$
x_i=x_i^t,\quad i\notin F_t
$$

Đây là formulation toán học rất quan trọng của **exact LNS**.

---

# 13.48. Vì sao LNS mạnh hơn Local Search?

Local Search thường thay đổi:

$$
O(1)
$$

variables.

LNS có thể relax:

$$
O(k)
$$

variables với:

$$
k\gg1
$$

nhưng thay vì thử tất cả:

$$
\binom nk
$$

ta dùng một solver/heuristic để tìm một solution tốt trong vùng đó.

Đây là trade-off:

$$
\boxed{
\text{larger neighborhood}
+
\text{stronger subproblem solver}
}
$$

đổi lấy:

$$
\boxed{
\text{more computation per iteration}
}
$$

---

# 13.49. Khi nào nên dùng LNS?

LNS đặc biệt phù hợp khi:

### 1. Nghiệm có cấu trúc

Ví dụ:

```text
route
schedule
assignment
sequence
```

### 2. Có thể phá một phần nghiệm

Ví dụ:

```text
remove customers
remove jobs
remove routes
remove time slots
```

### 3. Phần còn lại vẫn là một bài toán có thể giải được

Đây là điều cực kỳ quan trọng.

Nếu:

$$
\text{partial solution}
$$

không thể repair hiệu quả thì LNS khó phát huy.

### 4. Có heuristic repair tốt

hoặc:

### 5. Có exact subsolver mạnh.

---

# 13.50. Khi nào LNS không phù hợp?

Ví dụ bài toán mà:

* solution không có cấu trúc phân rã;
* destroy một phần khiến toàn bộ nghiệm mất feasibility;
* repair cực kỳ khó;
* mỗi subproblem gần như khó ngang bài toán gốc.

Khi đó:

$$
LNS
$$

có thể không mang lại lợi ích.

---

# 13.51. Những vấn đề khó nhất khi implement LNS

Nếu cậu sau này tự code LNS, đừng nghĩ khó nhất là:

```cpp
destroy();
repair();
```

Không.

Có 5 thứ khó hơn:

### 1. Destroy strategy

Phá **đúng chỗ**.

### 2. Repair strategy

Xây lại **đúng cách**.

### 3. Feasibility

Sau destroy/repair phải đảm bảo:

$$
x\in X
$$

### 4. Evaluation speed

Phải tính:

$$
\Delta f
$$

nhanh.

### 5. Adaptive control

Biết khi nào:

* phá nhiều;
* phá ít;
* dùng random;
* dùng related;
* dùng worst;
* dùng exact repair.

---

# 13.52. Một kiến trúc LNS thực chiến

Nếu tự xây solver:

```text
                Initial Solution
                       │
                       ▼
              ┌────────────────┐
              │ Current / Best │
              └───────┬────────┘
                      │
                choose destroy
                      │
             ┌────────▼────────┐
             │    Destroy      │
             └────────┬────────┘
                      │
                Partial solution
                      │
                choose repair
                      │
             ┌────────▼────────┐
             │      Repair     │
             └────────┬────────┘
                      │
                    S_new
                      │
                 Local Search
                      │
                 Acceptance
                      │
              ┌───────┴───────┐
              │               │
          update best      continue
```

Nếu nâng cấp:

```text
              ALNS Controller
                     │
       ┌─────────────┼─────────────┐
       ↓             ↓             ↓
   Destroy D1    Destroy D2    Destroy D3
       │             │             │
       └─────────────┼─────────────┘
                     ↓
                Repair R1/R2/R3
                     ↓
                   LS/VND
                     ↓
                Acceptance
                     ↓
                Update weights
```

---

# 13.53. Liên hệ với tất cả những gì đã học

Đây là điểm tôi muốn cậu đặc biệt chú ý.

Sau 13 chương, ta đã có một bộ công cụ:

```text
Greedy
  │
  ├── tạo initial solution
  │
Local Search
  │
  ├── polish
  │
VND / VNS
  │
  ├── intensification
  │
ILS
  │
  ├── perturbation
  │
LNS
  │
  ├── destroy large structure
  │
ALNS
  │
  ├── learn which operators work
  │
Beam Search
  │
  ├── keep multiple construction paths
  │
MIP / CP / DP
  │
  └── exact repair
```

Và một solver hiện đại hoàn toàn có thể là:

$$
\boxed{
\text{Greedy}
+
\text{ALNS}
+
\text{VND}
+
\text{Exact Subproblem}
}
$$

Đây chính là tinh thần của **hybrid metaheuristics / matheuristics**.

---

# 13.54. Mental model quan trọng nhất

Nếu Chapter 5:

> **“Đi từng bước nhỏ.”**

Chapter 6:

> **“Đôi khi chấp nhận đi lùi.”**

Chapter 7:

> **“Đừng quay lại những chỗ vừa đi.”**

Chapter 10:

> **“Phá nghiệm rồi local search lại.”**

Chapter 11:

> **“Đổi cách định nghĩa hàng xóm.”**

Chapter 12:

> **“Giữ nhiều hướng đi song song.”**

thì Chapter 13:

> **“Phá một mảng lớn của nghiệm, rồi giải lại mảng đó.”**

Hay cô đọng hơn:

$$
\boxed{
\textbf{LNS = Destroy + Repair + Search}
}
$$

và nếu repair bằng exact optimizer:

$$
\boxed{
\textbf{LNS = Metaheuristic Outer Loop + Exact Inner Loop}
}
$$

Đây là lý do LNS là một trong những topic quan trọng nhất trong roadmap này: **nó bắt đầu xóa mờ ranh giới giữa “heuristic” và “optimization solver”.**

---

## Một bài tập rất đáng làm sau chương này

Với chính bài **Air Conditioner Cleaning Technician** ở đầu chuỗi nghiên cứu, một solver LNS có thể được thiết kế thành:

$$
\boxed{
\text{Greedy Initial}
\rightarrow
\text{Destroy}
\rightarrow
\text{Repair}
\rightarrow
\text{2-opt/VND}
\rightarrow
\text{Acceptance}
\rightarrow
\text{ALNS}
}
$$

với các destroy operator:

```text
D1: random houses
D2: low-profit houses
D3: spatial cluster
D4: one-day removal
D5: consecutive-route removal
D6: high-travel-cost removal
```

và repair:

```text
R1: greedy insertion
R2: regret-2
R3: regret-3
R4: beam-based repair
```

Đây sẽ là một **case study rất tốt** để cậu thấy toàn bộ Chapter 5 → 13 thực sự kết nối với nhau như thế nào, thay vì học từng metaheuristic như những “mẹo rời rạc”.
