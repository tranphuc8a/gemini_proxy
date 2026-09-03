# Chương 10 — Iterated Local Search (ILS)

Sau **Local Search → SA → Tabu Search → Genetic Algorithm → GRASP**, ILS là một chương rất quan trọng vì nó cho thấy một ý tưởng cực kỳ “đẹp”:

> **Không cần tìm kiếm toàn bộ không gian nghiệm. Hãy chỉ tìm kiếm trên tập các nghiệm cục bộ tốt, và dùng một perturbation đủ mạnh để nhảy từ basin này sang basin khác.**

Đây là ý tưởng cốt lõi của **Iterated Local Search (ILS)**. Các tài liệu kinh điển của Lourenço, Martin và Stützle xem ILS là một metaheuristic đơn giản nhưng rất hiệu quả; các phiên bản hiện đại vẫn giữ đúng cấu trúc bốn thành phần: **initial solution → local search → perturbation → acceptance criterion**. ([Econ Papers][1])

---

# 1. ILS là gì?

Tên gọi:

> **Iterated Local Search — tìm kiếm cục bộ lặp**

Nếu Local Search làm:

$$
s \rightarrow s_1 \rightarrow s_2 \rightarrow \cdots \rightarrow s^*
$$

và dừng ở local optimum \(s^*\), thì ILS **không chấp nhận việc dừng lại**.

Nó làm:

$$
s^*
\xrightarrow{\text{Perturbation}}
s'
\xrightarrow{\text{Local Search}}
s^{*'}
$$

sau đó quyết định:

$$
s^* \leftarrow s^{*'} \quad ?
$$

Rồi lại tiếp tục.

Toàn bộ quá trình:

$$
\boxed{
\text{Local Search}
\rightarrow
\text{Perturb}
\rightarrow
\text{Local Search}
\rightarrow
\text{Perturb}
\rightarrow\cdots
}
$$

Điểm đặc biệt là ILS **không random lại từ đầu mỗi lần**.

Nó cố gắng tạo ra một nghiệm mới **gần nghiệm hiện tại nhưng khác basin of attraction**.

---

# 2. Vì sao Local Search cần ILS?

Giả sử không gian nghiệm như một địa hình:

```text
Cost
 ^
 |                 /\ 
 |        /\      /  \
 |   /\  /  \____/    \____
 |__/  \/                 \__
 +------------------------------> Solution space

      A        B             C
     local    local        global
     optimum  optimum      optimum
```

Local Search bắt đầu ở A:

```text
initial
   ↓
  ↘
   ↘
    A*
```

và dừng.

Vấn đề:

> A* có thể không phải nghiệm tốt nhất.

Ta cần một cơ chế **thoát khỏi A***.

---

# 3. Cách đơn giản nhất: Random Restart

Một cách là:

```text
Random solution
      ↓
 Local Search
      ↓
     A*

Random solution
      ↓
 Local Search
      ↓
     B*

Random solution
      ↓
 Local Search
      ↓
     C*
```

Đây là **Multi-Start Local Search**.

Nhưng có một vấn đề:

> Random restart vứt bỏ toàn bộ thông tin của nghiệm trước.

ILS làm thông minh hơn.

---

# 4. Ý tưởng cốt lõi của ILS

Thay vì:

```text
A* → bỏ A* → random từ đầu
```

ILS:

```text
             perturb
A* ───────────────────→ A'
                         │
                         │ Local Search
                         ↓
                        B*
```

Tức là:

1. Ta có một local optimum \(A^*\).
2. Phá vỡ nó một chút.
3. Có nghiệm trung gian \(A'\).
4. Chạy Local Search từ \(A'\).
5. Thu được local optimum mới \(B^*\).
6. Quyết định có chuyển sang \(B^*\) hay quay lại \(A^*\).

Đây chính là **randomized walk trên không gian các local optima**. ([ResearchGate][2])

---

# 5. Không gian nghiệm và không gian local optimum

Đây là khái niệm quan trọng nhất của chương.

Gọi:

$$
S
$$

là toàn bộ không gian nghiệm.

Ví dụ TSP với \(n\) thành phố:

$$
|S|=(n-1)!
$$

rất lớn.

Local Search tạo ra một ánh xạ:

$$
LS:S\rightarrow S^*
$$

trong đó:

$$
S^*=\{\text{các local optimum}\}
$$

Ví dụ:

```text
S = toàn bộ solution space

┌──────────────────────────────────┐
│                                  │
│   basin A       basin B          │
│      ↓             ↓             │
│     A*            B*             │
│                                  │
│                  basin C         │
│                     ↓            │
│                    C*            │
│                                  │
└──────────────────────────────────┘
```

Local Search thực chất làm:

$$
s \mapsto s^*
$$

nên ILS có thể nhìn như đang tìm kiếm:

$$
\boxed{S^*}
$$

thay vì toàn bộ:

$$
S
$$

Đây chính là một insight quan trọng trong tài liệu kinh điển của Lourenço, Martin và Stützle: ILS tập trung vào một không gian con nhỏ hơn gồm các nghiệm locally optimal và cố gắng **biased sampling** không gian đó. ([Econ Papers][1])

---

# 6. Basin of Attraction

Để hiểu ILS sâu hơn, cần hiểu **basin of attraction**.

Với một local search cố định, nhiều nghiệm ban đầu khác nhau có thể hội tụ về cùng một local optimum.

Ví dụ:

```text
Initial solutions

 s1 ─┐
 s2 ─┤
 s3 ─┤
 s4 ─┴────→ A*

 s5 ─┐
 s6 ─┤
 s7 ─┴────→ B*

 s8 ─┐
 s9 ─┴────→ C*
```

Ta gọi vùng:

$$
B(A^*)
$$

là basin of attraction của \(A^*\).

Local Search có xu hướng:

$$
s\in B(A^*) \Rightarrow LS(s)=A^*
$$

---

# 7. Perturbation thực chất làm gì?

Đây là điểm tinh tế.

Giả sử:

$$
s^*=A^*
$$

Nếu perturbation quá nhỏ:

```text
A*
 ↓ perturb nhỏ
A'
 ↓ Local Search
A*
```

Ta lại quay về chính A*.

Không có tác dụng.

Ngược lại, perturbation quá mạnh:

```text
A*
 ↓ perturb cực mạnh
random solution
 ↓ Local Search
B*
```

thì ILS gần như biến thành:

> **Random Restart Local Search**

Vì thế:

$$
\boxed{\text{Perturbation phải đủ mạnh để thoát basin, nhưng đủ yếu để giữ lại cấu trúc tốt.}}
$$

Đây là một trong những nguyên tắc quan trọng nhất của ILS. Tài liệu kinh điển nhấn mạnh rằng perturbation quá nhỏ sẽ thường bị local search “undo”, còn perturbation quá lớn sẽ khiến quá trình mất tính định hướng và tiến gần random restart. ([ResearchGate][2])

---

# 8. Ví dụ trực quan

Giả sử ta có:

```text
A* =

1 2 3
4 5 6
7 8 _
```

Perturbation:

```text
swap 5 và 8
```

ta được:

```text
1 2 3
4 8 6
7 5 _
```

Sau đó Local Search lại tối ưu.

Nếu perturbation chỉ đổi một thứ rất nhỏ:

```text
A*
 ↓
A'
 ↓
A*
```

thì vô ích.

Nhưng nếu perturbation:

```text
A*
 ↓
A'
 ↓
B*
```

thì ta đã thoát khỏi basin của A*.

---

# 9. Bốn thành phần của ILS

Một ILS chuẩn có bốn thành phần:

$$
\boxed{
\text{GenerateInitialSolution}
}
$$

$$
\boxed{
\text{LocalSearch}
}
$$

$$
\boxed{
\text{Perturbation}
}
$$

$$
\boxed{
\text{AcceptanceCriterion}
}
$$

Đây cũng là cấu trúc được sử dụng trong formulation kinh điển của ILS. ([Mathematics NSC][3])

---

# 10. Thành phần 1 — GenerateInitialSolution

Tạo nghiệm ban đầu:

$$
s_0
$$

Có thể là:

### Random

```cpp
s = randomSolution();
```

### Greedy

```cpp
s = greedySolution();
```

### Randomized Greedy

```cpp
s = randomizedGreedy();
```

### Heuristic chuyên biệt

Tùy bài toán.

Điểm thú vị:

> ILS thường không quá phụ thuộc vào initial solution nếu chạy đủ lâu.

Vì sau nhiều iteration, search trajectory đã rời rất xa điểm xuất phát.

---

# 11. Thành phần 2 — Local Search

Ta có:

$$
s_0
\xrightarrow{LS}
s^*
$$

trong đó:

$$
s^* = LocalSearch(s_0)
$$

và \(s^*\) là local optimum theo neighborhood đang dùng.

Ví dụ:

### TSP

* 2-opt
* 3-opt
* Or-opt

### Scheduling

* swap
* insert
* relocate

### Routing

* relocate
* exchange
* 2-opt
* cross-exchange

### General combinatorial optimization

* add
* remove
* swap
* insert
* exchange

---

# 12. Thành phần 3 — Perturbation

Đây là **trái tim của ILS**.

Ta có:

$$
s^* \rightarrow s'
$$

Perturbation **không nhất thiết là một move thông thường**.

Thường nó có dạng:

$$
P_k(s^*)
$$

trong đó \(k\) là **perturbation strength**.

Ví dụ:

```text
k = 1:
swap 1 pair

k = 2:
swap 2 pairs

k = 5:
swap 5 pairs
```

---

# 13. Local Search và Perturbation phải khác nhau

Đây là một nguyên tắc rất quan trọng.

Giả sử Local Search dùng:

$$
2\text{-opt}
$$

Nếu perturbation cũng chỉ làm một 2-opt nhỏ:

```text
A*
 ↓ 2-opt
A'
 ↓ 2-opt Local Search
A*
```

thì Local Search có thể dễ dàng undo perturbation.

Do đó:

$$
\boxed{
\text{Perturbation nên tạo ra thay đổi mà Local Search không dễ dàng hoàn tác.}
}
$$

Tài liệu về ILS cũng nhấn mạnh trực tiếp nguyên tắc này. ([Repositori API][4])

---

# 14. Ví dụ TSP

Giả sử:

```text
A → B → C → D → E → F → G → H
```

Local Search sử dụng 2-opt.

Một perturbation tốt có thể là:

```text
double-bridge move
```

thay vì một 2-opt thông thường.

Ví dụ:

```text
A-B-C-D-E-F-G-H
```

cắt thành:

```text
A-B | C-D-E | F-G | H
```

rồi nối lại theo cách khác.

Điều này phá cấu trúc tour đủ mạnh để:

$$
A^* \rightarrow s'
$$

nhưng vẫn giữ lại phần lớn cấu trúc tốt.

Đây là lý do ILS đặc biệt mạnh với TSP.

---

# 15. Thành phần 4 — Acceptance Criterion

Sau perturbation:

$$
s^*
\rightarrow s'
\rightarrow LS(s')
=s^{*'}
$$

ta có hai nghiệm:

$$
s^*
$$

và:

$$
s^{*'}
$$

Câu hỏi:

> Có thay \(s^*\) bằng \(s^{*'}\) không?

Đó là **Acceptance Criterion**.

---

# 16. Acceptance đơn giản nhất: Better

Đối với bài toán minimization:

$$
f(s^{*'}) < f(s^*)
$$

thì accept.

Nếu không:

$$
s^* \text{ giữ nguyên}
$$

Pseudo:

```cpp
if (cost(candidate) < cost(current))
    current = candidate;
```

Đây là acceptance có tính **intensification** rất cao. ([ResearchGate][5])

---

# 17. Acceptance = Random Walk

Ở cực đối lập:

```cpp
current = candidate;
```

bất kể candidate tốt hay xấu.

Khi đó ILS có khả năng đi:

```text
A* → B* → C* → D* → E*
```

mà không nhất thiết cost giảm.

Điều này tăng:

> **Diversification**

Nhưng có thể khiến search lang thang.

---

# 18. Acceptance trung gian

Ta có thể cho phép nghiệm xấu hơn.

Ví dụ:

$$
f(s^{*'}) \leq f(s^*)+\epsilon
$$

thì accept.

Hoặc sử dụng simulated annealing:

$$
P(\text{accept})
=
e^{-\frac{f(s^{*'})-f(s^*)}{T}}
$$

nếu:

$$
f(s^{*'})>f(s^*)
$$

Đây chính là cách ILS có thể kết hợp ý tưởng của SA vào acceptance criterion. Tài liệu kinh điển mô tả rõ hai cực Better và Random Walk, cùng các acceptance trung gian kiểu simulated annealing. ([ResearchGate][5])

---

# 19. Record-to-Record Travel

Một acceptance rất hữu ích:

Gọi:

$$
f_{\text{best}}
$$

là nghiệm tốt nhất từng thấy.

Cho phép candidate xấu hơn best một lượng:

$$
\epsilon
$$

Ví dụ:

$$
f(s')\leq f_{\text{best}}(1+\epsilon)
$$

thì accept.

Ví dụ:

$$
f_{\text{best}}=1000
$$

và:

$$
\epsilon=0.03
$$

thì chấp nhận nghiệm có cost:

$$
\leq1030
$$

Một số ILS hiện đại dùng dạng acceptance này để cân bằng intensification/diversification. ([ScienceDirect][6])

---

# 20. Basic ILS

Bây giờ ghép tất cả lại.

```text
s0 = GenerateInitialSolution()

s* = LocalSearch(s0)

while not termination:

    s'  = Perturbation(s*)

    s*' = LocalSearch(s')

    s*  = AcceptanceCriterion(s*, s*')
```

Có thêm:

```text
best = best(best, s*')
```

để không mất global best.

Pseudo chuẩn:

```cpp
Solution ILS() {
    Solution current = generateInitialSolution();

    current = localSearch(current);

    Solution best = current;

    while (!termination()) {

        Solution candidate = perturbation(current);

        candidate = localSearch(candidate);

        if (accept(current, candidate))
            current = candidate;

        if (better(candidate, best))
            best = candidate;
    }

    return best;
}
```

Đây gần như chính xác là framework cơ bản được mô tả trong Handbook of Metaheuristics. ([Mathematics NSC][3])

---

# 21. Một ví dụ cực kỳ quan trọng

Giả sử local search tạo ra:

```text
A* cost = 100
```

Perturb:

```text
A* → A'
```

Local Search:

```text
A' → B*
```

với:

```text
B* cost = 105
```

Nếu:

### Better

```text
100 → 105
```

❌ Không accept.

Ta ở lại A*.

---

Nếu Random Walk:

```text
100 → 105
```

✅ Accept.

Current trở thành B*.

---

Nếu SA:

```text
P = exp(-(105-100)/T)
```

có xác suất accept.

---

Nếu Record-to-Record với tolerance 10%:

```text
105 <= 100 × 1.10
```

✅ Accept.

---

# 22. Một insight rất quan trọng: Current ≠ Best

Đây là lỗi implementation rất hay gặp.

ILS có hai khái niệm:

### Current

$$
s_{\text{current}}
$$

nghiệm dùng để tiếp tục search.

### Best

$$
s_{\text{best}}
$$

nghiệm tốt nhất từng thấy.

Chúng **không nhất thiết giống nhau**.

Ví dụ:

```text
best = 100
current = 110
```

hoàn toàn hợp lệ nếu acceptance cho phép đi xuống vùng cost 110 để tìm đường đến 90.

```text
100
 ↓
110
 ↓
108
 ↓
95
 ↓
90
```

Nếu luôn bắt current = best:

```text
100
 ↓
110 ❌
```

thì search không thể thực hiện trajectory này.

---

# 23. ILS và Simulated Annealing khác nhau thế nào?

Đây là một câu hỏi quan trọng vì cả hai đều escape local optimum.

|               | SA                  | ILS                              |
| ------------- | ------------------- | -------------------------------- |
| Đơn vị search | solution            | local optima                     |
| Escape        | accept bad move     | perturbation                     |
| Local Search  | không nhất thiết    | bắt buộc là thành phần trung tâm |
| Randomness    | acceptance          | perturbation                     |
| Temperature   | thường có           | không bắt buộc                   |
| Structure     | trajectory liên tục | local optimum → local optimum    |
| Main design   | cooling schedule    | perturbation + acceptance        |

SA:

```text
s1 → s2 → s3 → s4 → ...
```

ILS:

```text
A* → B* → C* → D*
```

Trong ILS, các bước local search ở giữa có thể rất dài.

---

# 24. ILS và Tabu Search

Tabu Search sử dụng:

> **memory**

để tránh quay lại các trạng thái/move gần đây.

ILS thường không cần memory phức tạp.

```text
ILS:
current
 ↓
perturb
 ↓
local search
 ↓
candidate
 ↓
accept
```

Tabu:

```text
current
 ↓
explore neighborhood
 ↓
tabu restrictions
 ↓
choose move
 ↓
...
```

Tuy nhiên ILS **có thể bổ sung memory**.

Các nghiên cứu ILS chỉ ra rằng việc đưa history/memory vào perturbation hoặc acceptance có thể cải thiện hiệu năng. ([Mathematics NSC][3])

---

# 25. ILS và GRASP

Đây là phần rất đáng chú ý vì vừa học GRASP ở chương trước.

## GRASP

```text
Randomized Greedy Construction
             ↓
         Local Search
             ↓
           solution
             ↓
          restart
```

## ILS

```text
Initial Solution
      ↓
Local Search
      ↓
    local*
      ↓
Perturbation
      ↓
Local Search
      ↓
    local*
      ↓
Perturbation
      ↓
...
```

Sự khác biệt:

> **GRASP tạo starting solution mới bằng randomized construction.**

> **ILS tạo starting solution mới bằng perturbation từ local optimum hiện tại.**

Có thể hình dung:

```text
GRASP

random construction
       ↓
      LS
       ↓
      A*
       ↓
random construction
       ↓
      LS
       ↓
      B*
```

Trong khi:

```text
ILS

      A*
       ↓
  perturbation
       ↓
      LS
       ↓
      B*
       ↓
  perturbation
       ↓
      LS
       ↓
      C*
```

Vì vậy ILS có tính **trajectory-based** mạnh hơn.

---

# 26. ILS thực chất là một Markov Chain?

Nếu:

* perturbation chỉ phụ thuộc current;
* acceptance chỉ phụ thuộc current + candidate;
* Local Search deterministic;

thì:

$$
P(s_{t+1}|s_t,s_{t-1},\ldots)
=
P(s_{t+1}|s_t)
$$

Do đó ta có thể xem ILS như một **Markov chain trên không gian local optima**.

```text
A* ─────→ B*
 │         │
 ↓         ↓
C* ←────── D*
```

Mỗi local optimum là một state.

Perturbation + Local Search tạo ra transition:

$$
P(A^*\rightarrow B^*)
$$

Acceptance quyết định transition nào được phép.

Đây là một cách nhìn toán học rất đẹp về ILS. ([ResearchGate][2])

---

# 27. Tại sao ILS hiệu quả?

Có thể hiểu bằng ba tầng.

### Tầng 1 — Local Search

Tìm kiếm mạnh:

$$
S\rightarrow S^*
$$

### Tầng 2 — Perturbation

Thoát local optimum:

$$
S^*\rightarrow S
$$

### Tầng 3 — Local Search lần nữa

Tìm local optimum mới:

$$
S\rightarrow S^*
$$

Do đó:

$$
\boxed{
S^*
\rightarrow
S
\rightarrow
S^*
\rightarrow
S
\rightarrow
S^*
}
$$

ILS biến local search từ:

> **một lần descent**

thành:

> **một quá trình khám phá các basin of attraction.**

---

# 28. Perturbation Strength

Đây là hyperparameter cực kỳ quan trọng.

Gọi:

$$
k = \text{perturbation strength}
$$

Có ba vùng:

```text
k quá nhỏ
    ↓
không thoát basin
    ↓
ILS ≈ Local Search


k vừa phải
    ↓
thoát basin nhưng giữ structure
    ↓
ILS hiệu quả


k quá lớn
    ↓
mất structure
    ↓
ILS ≈ Random Restart
```

Có thể biểu diễn:

```text
Quality
  ^
  |          ______
  |        /        \
  |      /            \
  |_____/              \____
       small  optimal  large
              k
```

Các nghiên cứu thực nghiệm cũng nhấn mạnh rằng perturbation strength quá nhỏ không đủ thoát local optimum, còn quá lớn làm ILS gần random restart. ([Springer][7])

---

# 29. Adaptive Perturbation Strength

Không nhất thiết phải cố định:

$$
k=3
$$

Ta có thể adaptive.

Ví dụ:

```text
nhiều iteration không cải thiện
        ↓
    tăng k

đang cải thiện tốt
        ↓
    giảm k
```

Ví dụ:

```cpp
if (noImprovement > 100)
    strength++;

if (improvement)
    strength = max(1, strength - 1);
```

Hoặc:

```text
k = 1
2
3
4
5
...
```

cho đến khi escape được basin.

---

# 30. Một chiến lược rất hay: Variable Perturbation

Ví dụ:

```text
iteration 1  : k = 2
iteration 2  : k = 2
iteration 3  : k = 2

stagnation

iteration 4  : k = 3
iteration 5  : k = 4
iteration 6  : k = 5

improvement

iteration 7  : k = 2
```

Ta có:

$$
k=f(\text{search history})
$$

Điều này biến ILS từ một thuật toán static thành một adaptive metaheuristic.

---

# 31. Perturbation tốt phải có “memory of structure”

Một perturbation tốt không nên đơn giản là:

```cpp
randomly destroy 50% solution;
```

Nó nên tận dụng cấu trúc bài toán.

Ví dụ TSP:

```text
Không tốt:
randomly shuffle 50% cities

Tốt hơn:
double bridge
```

Scheduling:

```text
Không tốt:
randomly shuffle tất cả jobs

Tốt:
remove một block job
→ insert sang machine khác
```

Routing:

```text
remove một đoạn route
→ relocate sang route khác
```

Như vậy:

$$
\boxed{
\text{Good perturbation}
=
\text{destruction}+\text{preservation of useful structure}
}
$$

---

# 32. Một nguyên tắc rất đẹp của ILS

Có một heuristic guideline nổi tiếng:

> Một perturbation tốt biến một nghiệm rất tốt thành một **starting point tốt cho Local Search**.

Nói toán học:

Nếu:

$$
s^*=\text{excellent solution}
$$

thì perturbation nên tạo:

$$
s'=P(s^*)
$$

sao cho:

$$
LS(s')
$$

vẫn có xác suất cao dẫn đến một nghiệm tốt.

Không phải mục tiêu là tạo một nghiệm tốt ngay lập tức.

Mục tiêu là:

> **tạo một nghiệm tốt để Local Search tiếp tục khai thác.**

---

# 33. Perturbation không cần candidate phải tốt

Điều này khá ngược trực giác.

Ta có thể có:

$$
f(s') \gg f(s^*)
$$

nhưng:

$$
LS(s')=s^{*'}
$$

lại cực tốt.

Ví dụ:

```text
A* = 100

Perturbation
    ↓
A' = 500

Local Search
    ↓
B* = 95
```

Không có vấn đề gì.

Do đó:

$$
\boxed{
\text{quality of perturbed solution}
\neq
\text{quality of resulting local optimum}
}
$$

Đây là lý do không nên đánh giá perturbation chỉ bằng cost tức thời.

---

# 34. Acceptance và Perturbation phải được thiết kế cùng nhau

Đây là một trong những insight sâu nhất của ILS.

Giả sử perturbation rất mạnh:

$$
k=20
$$

nhưng acceptance:

```text
chỉ accept better
```

thì rất có thể:

```text
A* = 100
 ↓
strong perturbation
 ↓
B* = 120
 ↓
reject
 ↓
A*
```

Ta đã tốn rất nhiều CPU nhưng không đi đâu cả.

Ngược lại:

```text
strong perturbation
+
accept bad solutions
```

có thể hoạt động tốt.

Do đó:

$$
\boxed{
\text{Perturbation}+\text{Acceptance}
$$

phải được tune **jointly**.

Tài liệu ILS nhấn mạnh chính sự kết hợp này quyết định mức cân bằng giữa intensification và diversification; perturbation lớn chỉ hữu ích nếu acceptance cho phép tận dụng những bước nhảy đó. ([Repositori API][4])

---

# 35. Intensification và Diversification trong ILS

## Intensification

Tập trung quanh vùng tốt.

Ví dụ:

```text
A* = 100

A* → 99 → 98 → 97
```

Better acceptance:

$$
\text{intensification cao}
$$

---

## Diversification

Khám phá vùng khác.

```text
A* = 100
 ↓
110
 ↓
125
 ↓
105
 ↓
95
```

Perturbation mạnh + acceptance permissive:

$$
\text{diversification cao}
$$

---

# 36. Có thể biểu diễn ILS như hai lực đối nghịch

```text
                SEARCH
                  │
        ┌─────────┴─────────┐
        ↓                   ↓
 Intensification       Diversification
        │                   │
 local search          perturbation
 better accept         accept worse
        │                   │
        └─────────┬─────────┘
                  ↓
              ILS
```

Đây cũng là theme xuyên suốt các metaheuristic mà cậu đã học:

| Thuật toán    | Diversification         | Intensification  |
| ------------- | ----------------------- | ---------------- |
| Hill Climbing | thấp                    | rất cao          |
| SA            | acceptance bad          | cooling          |
| Tabu          | tabu/memory             | aspiration       |
| GA            | mutation/crossover      | selection        |
| GRASP         | randomized construction | local search     |
| **ILS**       | **perturbation**        | **local search** |

---

# 37. ILS với Best Acceptance

Một biến thể phổ biến:

```cpp
current = localSearch(initial);
best = current;

while (...) {
    candidate = perturbation(current);
    candidate = localSearch(candidate);

    if (candidate.cost < current.cost)
        current = candidate;

    if (candidate.cost < best.cost)
        best = candidate;
}
```

Đây là:

$$
\text{ILS + Better acceptance}
$$

Nó khá đơn giản và thường là điểm khởi đầu tốt.

---

# 38. ILS với SA Acceptance

Ta có:

$$
\Delta=f(s')-f(s)
$$

Nếu:

$$
\Delta\leq0
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

Pseudo:

```cpp
if (candidate.cost <= current.cost)
    current = candidate;
else {
    double p = exp(
        -(candidate.cost - current.cost) / T
    );

    if (random01() < p)
        current = candidate;
}
```

Có thể giảm \(T\):

$$
T_{t+1}=\alpha T_t
$$

hoặc dùng schedule khác.

---

# 39. ILS với Acceptance theo ngưỡng

Ví dụ:

$$
f(s')\leq f(s)+\epsilon
$$

thì accept.

Có thể giảm:

$$
\epsilon_t
$$

theo thời gian.

Ví dụ:

```text
ε = 10%
↓
8%
↓
6%
↓
4%
↓
2%
↓
0%
```

Search ban đầu:

> exploration

Search cuối:

> exploitation

---

# 40. ILS với Elite Solutions

ILS cơ bản chỉ giữ:

```text
current
best
```

Ta có thể mở rộng thành:

$$
E=\{s_1,s_2,\ldots,s_k\}
$$

với \(E\) là **elite set**.

Ví dụ:

```text
Elite set

A*  cost=100
B*  cost=102
C*  cost=103
D*  cost=104
```

Mỗi iteration có thể perturb một elite solution.

Nhưng không nên chỉ giữ các nghiệm gần như giống nhau.

Ta muốn:

$$
\boxed{\text{quality}+\text{diversity}}
$$

---

# 41. Path Relinking + ILS

Đây là một extension mạnh.

Giả sử:

```text
A*
B*
```

đều là elite.

Ta tìm một đường từ A đến B:

```text
A
 ↓
A1
 ↓
A2
 ↓
A3
 ↓
B
```

và đánh giá các intermediate solutions.

Đây chính là ý tưởng **Path Relinking**, thường được kết hợp với các metaheuristic như GRASP và ILS để intensification.

---

# 42. ILS và Variable Neighborhood Search

ILS cũng có thể kết hợp:

```text
Perturb
   ↓
Local Search N1
   ↓
Local Search N2
   ↓
Local Search N3
```

Thay vì một neighborhood duy nhất:

$$
LS=N_1
$$

ta có:

$$
LS=VND(N_1,N_2,\ldots,N_k)
$$

Ví dụ:

```text
N1 = swap
N2 = insert
N3 = 2-opt
N4 = 3-opt
```

Khi đó:

$$
\boxed{\text{ILS + VND}}
$$

là một framework rất mạnh.

Các ứng dụng thực tế hiện đại của ILS thường dùng VND/VNS làm local-search component. ([Wiley Online Library][8])

---

# 43. Complexity của ILS

Gọi:

* \(C\): cost của perturbation
* \(L\): cost của Local Search
* \(I\): số iteration

thì xấp xỉ:

$$
T_{\text{ILS}}
=
T_{\text{initial LS}}
+
I(C+L)
$$

Thường:

$$
L\gg C
$$

nên:

$$
T_{\text{ILS}}\approx I\cdot L
$$

Do đó optimization quan trọng nhất thường là:

> **làm Local Search nhanh.**

Đặc biệt cần:

* delta evaluation
* candidate lists
* don't-look bits
* incremental data structures
* efficient neighborhood enumeration

---

# 44. Delta Evaluation

Ví dụ cost hiện tại:

$$
C(s)
$$

Ta thử move \(m\).

Không nên:

```cpp
newCost = evaluateEntireSolution(newSolution);
```

mỗi lần.

Nên:

$$
\Delta(m)=C(s')-C(s)
$$

và:

$$
C(s')=C(s)+\Delta(m)
$$

Đây là một trong những lý do Local Search thực tế có thể chạy hàng triệu move.

Và khi ILS gọi Local Search hàng nghìn lần, delta evaluation càng quan trọng.

---

# 45. ILS cho bài Air Conditioner của cậu

Đây là nơi ILS cực kỳ hợp với bài toán đã dùng làm ví dụ xuyên suốt curriculum.

Ta có solution:

```text
Day 1:
    H17 → H32 → H8 → H41

Day 2:
    H5 → H19 → H27

Day 3:
    ...
```

Mục tiêu:

$$
\max Score
$$

với constraint:

$$
time_d\leq720
$$

---

# 46. Initial Solution

Có thể tạo greedy:

```text
currentPos = start

while còn thời gian:
    chọn house có:
       score / travel_cost
       hoặc marginal score
       hoặc score / service_time
```

Sau đó:

```text
Local Search
```

Ví dụ:

```text
Greedy
 ↓
Day 1: A B C D
Day 2: E F G
Day 3: H I
```

Local Search:

```text
swap
insert
move between days
2-opt
```

→

```text
Solution S*
score = 8,420,000
```

---

# 47. Perturbation cho bài này

Đây mới là phần thú vị.

### Perturbation 1 — Remove + Insert

Random:

```text
remove 3 houses
```

sau đó:

```text
reinsert 3 houses
```

---

### Perturbation 2 — Cross-day exchange

```text
Day 1: A B C D
Day 2: E F G
```

chọn:

```text
C ↔ F
```

→

```text
Day 1: A B F D
Day 2: E C G
```

---

### Perturbation 3 — Large destroy-repair

```text
remove 10% houses
       ↓
repair bằng greedy
       ↓
local search
```

Đây bắt đầu có hơi hướng:

$$
\text{ILS} \leftrightarrow \text{Large Neighborhood Search}
$$

---

# 48. Perturbation rất phù hợp với cấu trúc nhiều ngày

Một ý tưởng tốt:

```text
random chọn 1–3 ngày

random remove một block

repair bằng greedy

Local Search
```

Ví dụ:

```text
Day 4:
A B C D E F

remove:
C D E

Day 4:
A B F

repair:
A B G H I F
```

Sau đó Local Search tiếp tục tối ưu.

---

# 49. Acceptance cho bài Air Conditioner

Vì đây là bài:

$$
\max Score
$$

Better acceptance:

$$
Score(candidate)>Score(current)
$$

thì accept.

Nhưng có thể tốt hơn nếu cho phép:

$$
Score(candidate)\geq Score(current)-\epsilon
$$

hoặc:

$$
P=
e^{-\frac{Score(current)-Score(candidate)}{T}}
$$

cho candidate kém hơn.

Điều này cho phép ILS thoát khỏi những cấu hình:

> “gần tối ưu nhưng bị kẹt”.

---

# 50. Một ILS hoàn chỉnh cho bài này

```text
GenerateInitialSolution
        ↓
    Local Search
        ↓
       S*
        │
        ├─────────────── best
        │
        ↓
    Perturbation
        ↓
       S'
        ↓
    Local Search
        ↓
       S*'
        ↓
 Acceptance Criterion
        │
        ├── accept → S*'
        │
        └── reject → S*
        │
        └──────────────→ repeat
```

Pseudo:

```cpp
Solution process() {

    Solution current = greedyInitial();

    current = localSearch(current);

    Solution best = current;

    int strength = 3;

    while (timeRemaining()) {

        Solution candidate =
            perturb(current, strength);

        candidate =
            localSearch(candidate);

        if (accept(current, candidate)) {
            current = candidate;
        }

        if (candidate.score > best.score) {
            best = candidate;
            strength = 3;
        }
        else {
            strength++;
        }
    }

    return best;
}
```

Đây là một skeleton ILS khá tự nhiên cho bài của cậu.

---

# 51. Nhưng có một vấn đề rất quan trọng

Bài Air Conditioner có:

$$
\text{30 ngày}
$$

và mỗi ngày:

$$
720\text{ phút}
$$

Do đó perturbation phải **preserve feasibility**, hoặc có cơ chế repair.

Ví dụ:

```text
Day 5 = 710 min
```

không thể tùy tiện insert thêm một house 50 phút.

Có ba chiến lược.

---

## Strategy A — Feasible perturbation

Chỉ thực hiện move nếu:

$$
time_d\le720
$$

Đơn giản và an toàn.

---

## Strategy B — Perturb rồi repair

Cho phép:

$$
time_d>720
$$

tạm thời.

Sau đó repair:

```text
remove low-value houses
```

cho đến:

$$
time_d\le720
$$

Cách này có không gian search rộng hơn.

---

## Strategy C — Penalized infeasibility

Định nghĩa:

$$
F(s)
=
Score(s)-\lambda Violation(s)
$$

với:

$$
Violation(s)
=
\sum_d \max(0,time_d-720)
$$

ILS tối ưu \(F\), sau đó cuối cùng phải đưa solution về feasible.

---

# 52. Một perturbation rất đáng thử cho bài này

Tớ sẽ thiết kế:

### Step 1

Chọn ngẫu nhiên:

$$
k\in[2,8]
$$

houses.

### Step 2

Remove chúng khỏi lịch.

### Step 3

Chọn lại thứ tự insertion bằng:

$$
\frac{\Delta Score}{\Delta Time}
$$

hoặc:

$$
\frac{\Delta Score}{\Delta Travel+\Delta Service}
$$

### Step 4

Randomized top-\(k\) insertion.

### Step 5

Chạy:

```text
swap
insert
relocate
2-opt
```

### Step 6

Acceptance.

Đây là một ILS khá mạnh vì perturbation không phá toàn bộ solution.

---

# 53. ILS + GRASP

Và đây là lúc các chương bắt đầu **kết nối với nhau**.

Ta có thể dùng:

```text
GRASP construction
        ↓
    Local Search
        ↓
       ILS
        ↓
   Perturbation
        ↓
    Local Search
```

Hoặc:

```text
ILS
 │
 ├── initial solution = GRASP
 │
 ├── local search = VND
 │
 ├── perturbation = destroy/repair
 │
 └── acceptance = SA
```

Khi đó ta có một **hybrid metaheuristic**.

Đây là cách metaheuristic thực tế thường được xây dựng: không nhất thiết chọn “một thuật toán”, mà kết hợp các cơ chế phù hợp.

---

# 54. ILS vs Random Restart — điểm khác biệt sâu nhất

Giả sử:

$$
P(A^*\rightarrow B^*)
$$

là xác suất perturbation + LS từ A* đi đến B*.

ILS cố gắng làm transition này:

$$
P(A^*\rightarrow B^*)
$$

**có cấu trúc**.

Trong Random Restart:

$$
P(B^*)
$$

phụ thuộc vào random initialization.

Nói cách khác:

### Random Restart

> “Tôi không biết đang ở đâu → random lại.”

### ILS

> “Tôi đang ở một local optimum tốt → phá nó có chủ đích → đi sang vùng lân cận khác.”

Đây chính là lý do ILS thường hiệu quả hơn random restart. ([ResearchGate][2])

---

# 55. ILS vs Multi-Start

Hai thuật toán:

### Multi-Start

$$
s_1\rightarrow LS\rightarrow s_1^*
$$

$$
s_2\rightarrow LS\rightarrow s_2^*
$$

$$
s_3\rightarrow LS\rightarrow s_3^*
$$

### ILS

$$
s_1^*
\rightarrow
P(s_1^*)
\rightarrow
LS
\rightarrow
s_2^*
$$

$$
s_2^*
\rightarrow
P(s_2^*)
\rightarrow
LS
\rightarrow
s_3^*
$$

Sự khác biệt:

$$
\boxed{
\text{Multi-Start = independent sampling}
}
$$

$$
\boxed{
\text{ILS = correlated sampling}
}
$$

ILS sử dụng thông tin từ local optimum trước đó.

---

# 56. Một cách nhìn cực kỳ hay

Có thể xem:

### Greedy

```text
Một trajectory
```

### Local Search

```text
Một trajectory → local optimum
```

### Multi-Start

```text
Nhiều trajectory độc lập
```

### ILS

```text
Một trajectory giữa các local optima
```

```text
S ──LS──→ A*
           │
           P
           ↓
          B'
           │
          LS
           ↓
          B*
           │
           P
           ↓
          C'
           │
          LS
           ↓
          C*
```

Đây chính là “linh hồn” của ILS.

---

# 57. Những lỗi thiết kế ILS phổ biến

## Lỗi 1 — Perturbation quá yếu

```text
A*
 ↓
A'
 ↓
A*
```

→ ILS không tiến triển.

---

## Lỗi 2 — Perturbation quá mạnh

```text
A*
 ↓
random solution
 ↓
B*
```

→ biến thành random restart.

---

## Lỗi 3 — Acceptance quá tham lam

```text
chỉ accept better
```

kết hợp với perturbation mạnh:

→ rất nhiều candidate bị reject.

---

## Lỗi 4 — Acceptance quá dễ

```text
accept everything
```

→ random walk, thiếu intensification.

---

## Lỗi 5 — Không lưu best

```cpp
current = candidate;
```

nhưng không:

```cpp
best = max(best, candidate);
```

→ có thể cuối cùng trả về nghiệm tệ.

---

## Lỗi 6 — Local Search quá yếu

ILS không thể cứu một local search tệ.

---

## Lỗi 7 — Perturbation không hiểu problem structure

Random phá solution quá mạnh:

```text
good solution
 ↓
random destruction
 ↓
almost random
```

→ mất lợi thế của ILS.

---

# 58. Nguyên tắc tuning ILS

Một thứ tự khá hợp lý:

### Bước 1

Chọn Local Search tốt.

### Bước 2

Tối ưu tốc độ Local Search.

### Bước 3

Thiết kế perturbation.

### Bước 4

Tune perturbation strength.

### Bước 5

Chọn acceptance.

### Bước 6

Sau cùng mới thêm:

* adaptive strength
* memory
* elite set
* path relinking
* reactive mechanisms

Đừng làm ngược:

```text
ILS + 10 cơ chế
```

nhưng Local Search cơ bản lại chậm và yếu.

Tài liệu ILS cũng nhấn mạnh rằng hiệu quả phụ thuộc chủ yếu vào **local search, perturbation và acceptance criterion**, cùng với sự tương tác giữa chúng. ([Econ Papers][1])

---

# 59. Một framework ILS tổng quát

Ta có thể formalize:

Cho:

$$
S=\text{solution space}
$$

Local Search:

$$
LS:S\rightarrow S^*
$$

Perturbation:

$$
P:S^*\rightarrow S
$$

Acceptance:

$$
A:S^*\times S^*\rightarrow S^*
$$

Algorithm:

$$
s_0\in S
$$

$$
s^*=LS(s_0)
$$

lặp:

$$
s'=P(s^*)
$$

$$
\hat{s}=LS(s')
$$

$$
s^*=A(s^*,\hat{s})
$$

và:

$$
s_{\text{best}}
=
\arg\min/\arg\max
\{f(s):s\text{ đã gặp}\}
$$

Đây là mô hình toán học cô đọng nhất của ILS.

---

# 60. ILS dưới góc nhìn Optimization

Có thể viết:

$$
\min_{s\in S} f(s)
$$

Nhưng ILS không trực tiếp search toàn bộ:

$$
S
$$

mà search:

$$
S^*=LS(S)
$$

Do đó bài toán trở thành:

$$
\boxed{
\min_{s\in S^*}f(s)
}
$$

Tất nhiên \(S^*\) vẫn chưa biết trước.

ILS xây dựng sampling distribution trên \(S^*\):

$$
P(s^*_{t+1}|s^*_t)
$$

thông qua:

$$
\boxed{
\text{Perturbation}
+
\text{Local Search}
+
\text{Acceptance}
}
$$

Đây là cách nhìn khiến ILS trở thành một metaheuristic rất đẹp về mặt lý thuyết.

---

# 61. Bức tranh tổng thể từ chương 1 → 10

Sau 10 chương, ta đã có một chuỗi tiến hóa rất rõ:

```text
Greedy
  │
  ├── xây solution nhanh
  ↓
Dynamic Programming
  │
  ├── exploit subproblem structure
  ↓
Exact Search
  │
  ├── explore có kiểm soát
  ↓
Approximation
  │
  ├── guarantee chất lượng
  ↓
Local Search
  │
  └── exploit neighborhood
       ↓
Simulated Annealing
  │
  └── escape local optimum
       ↓
Tabu Search
  │
  └── memory + controlled exploration
       ↓
Genetic Algorithm
  │
  └── population + recombination
       ↓
GRASP
  │
  └── randomized greedy + LS
       ↓
ITERATED LOCAL SEARCH
  │
  └── perturb local optimum + LS
```

Đặc biệt:

$$
\boxed{
ILS
=
Local\ Search
+
Perturbation
+
Acceptance
}
$$

Đây là công thức cần nhớ.

---

# 62. So sánh GRASP và ILS — cực kỳ quan trọng

| Đặc điểm             | GRASP             | ILS                   |
| -------------------- | ----------------- | --------------------- |
| Starting point       | Randomized Greedy | Initial solution      |
| Main diversification | RCL               | Perturbation          |
| Intensification      | Local Search      | Local Search          |
| Restart              | xây lại từ đầu    | perturb current       |
| Memory               | không bắt buộc    | không bắt buộc        |
| Search trajectory    | nhiều run độc lập | một trajectory        |
| Central parameter    | \(\alpha\)        | perturbation strength |
| Acceptance           | thường giữ best   | rất quan trọng        |
| Basin exploration    | random entry      | controlled jump       |

Một câu để phân biệt:

> **GRASP randomize cách xây nghiệm; ILS randomize cách phá nghiệm hiện tại.**

---

# 63. Ba tham số quan trọng nhất

Nếu phải rút ILS về ba thứ:

$$
\boxed{LS}
$$

$$
\boxed{P}
$$

$$
\boxed{A}
$$

Trong đó:

### Local Search

> Tôi khai thác vùng hiện tại tốt đến đâu?

### Perturbation

> Tôi nhảy sang vùng khác bằng cách nào?

### Acceptance

> Tôi có cho phép nhảy sang vùng xấu hơn không?

Và ba thành phần này **không độc lập**.

---

# 64. Mental Model cần nhớ

Nếu cậu chỉ nhớ một hình của chương này thì hãy nhớ:

```text
                 ┌─────────────────────┐
                 │                     │
                 ↓                     │
Initial → Local Search → Local Optimum │
                           │           │
                           │           │
                      Perturbation     │
                           │           │
                           ↓           │
                     Intermediate      │
                           │           │
                           ↓           │
                      Local Search     │
                           │           │
                           ↓           │
                      New Local Opt.   │
                           │           │
                     Acceptance ───────┘
                           │
                           ↓
                         Best
```

Hay cô đọng hơn:

$$
\boxed{
\text{Construct}
\rightarrow
\text{Local Search}
\rightarrow
\text{Perturb}
\rightarrow
\text{Local Search}
\rightarrow
\text{Accept}
\rightarrow
\text{Repeat}
}
$$

---

# 65. Những kiến thức cậu cần thực sự nắm sau chương này

Không chỉ nhớ “ILS là perturb + local search”. Cần nắm được **7 tầng**:

### Tầng 1 — Basic

$$
ILS=LS+Perturbation
$$

### Tầng 2 — Local optima space

ILS search trên:

$$
S^*
$$

thay vì trực tiếp trên \(S\).

### Tầng 3 — Basin

Perturbation có nhiệm vụ đưa search sang basin khác.

### Tầng 4 — Perturbation strength

$$
\text{too small}\rightarrow LS
$$

$$
\text{optimal}\rightarrow ILS
$$

$$
\text{too large}\rightarrow Random Restart
$$

### Tầng 5 — Acceptance

$$
Better
\leftrightarrow
Random Walk
$$

là hai cực của:

$$
\text{intensification}
\leftrightarrow
\text{diversification}
$$

### Tầng 6 — Interaction

Không tune riêng:

$$
P
$$

và:

$$
A
$$

mà phải tune:

$$
\boxed{P+A}
$$

### Tầng 7 — Engineering

ILS mạnh hay không thường phụ thuộc rất lớn vào:

$$
\boxed{
\text{Neighborhood}
+
\text{Delta Evaluation}
+
\text{Perturbation Design}
}
$$

---

## Tài liệu nền tảng

Nguồn kinh điển nhất là chương **“Iterated Local Search”** của Helena R. Lourenço, Olivier C. Martin và Thomas Stützle trong *Handbook of Metaheuristics*; bản tổng quan của họ được công bố từ 2002/2003 và là tài liệu nền tảng để hiểu framework ILS. ([Econ Papers][1])

Ngoài ra, **Handbook of Heuristics** có chương ILS cập nhật của Thomas Stützle và Rubén Ruiz, mô tả ILS hiện đại vẫn xoay quanh perturbation → improvement/local search → acceptance. ([DOI][9])

---

### Vị trí của ILS trong lộ trình

Điểm rất đáng chú ý là **chương 10 đã nối trực tiếp Local Search với các metaheuristic hybrid hiện đại**. Sau ILS, khi học các chương tiếp theo, cậu sẽ bắt đầu thấy nhiều thuật toán không còn là “một thuật toán độc lập”, mà là:

$$
\boxed{
\text{Framework}
=
\text{Construction}
+
\text{Neighborhood}
+
\text{Perturbation}
+
\text{Acceptance}
+
\text{Memory}
}
$$

Đây chính là bước chuyển từ **“học tên thuật toán”** sang **“biết thiết kế metaheuristic cho một bài toán mới”**.

[1]: https://econ-papers.upf.edu/en/onepaper.php?id=513&utm_source=chatgpt.com "Department of Economics and Business - Universitat Pompeu Fabra"
[2]: https://www.researchgate.net/publication/227117023_Iterated_Local_Search_Framework_and_Applications?utm_source=chatgpt.com "(PDF) Iterated Local Search: Framework and Applications"
[3]: https://math.nsc.ru/LBRT/k5/OR-MMF/2019_Book_HandbookOfMetaheuristics.pdf?utm_source=chatgpt.com "International Series in"
[4]: https://repositori-api.upf.edu/api/core/bitstreams/e424385e-98be-4df8-a0f4-00347577fcdb/content?utm_source=chatgpt.com "Iterated Local Search: Framework and"
[5]: https://www.researchgate.net/publication/2329695_Iterated_Local_Search?utm_source=chatgpt.com "(PDF) Iterated Local Search"
[6]: https://www.sciencedirect.com/science/article/pii/S2192440622000053?utm_source=chatgpt.com "New neighborhoods and an iterated local search algorithm for the generalized traveling salesman problem - ScienceDirect"
[7]: https://link.springer.com/article/10.1007/s10732-017-9347-8?utm_source=chatgpt.com "Iterated local search for workforce scheduling and routing problems | Journal of Heuristics | Springer Nature Link"
[8]: https://onlinelibrary.wiley.com/doi/full/10.1002/net.22187?utm_source=chatgpt.com "An iterated local search for a multi‐period orienteering problem arising in a car patrolling application - Vidigal Corrêa - 2024 - Networks - Wiley Online Library"
[9]: https://doi.org/10.1007/978-3-319-07153-4_8-2?utm_source=chatgpt.com "Iterated Local Search | Springer Nature Link"
