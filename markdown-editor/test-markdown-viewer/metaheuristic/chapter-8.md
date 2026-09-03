# Chương 8 — Genetic / Evolutionary Algorithms

Đây là một chương rất quan trọng, vì từ đây ta chuyển từ nhóm **single-solution metaheuristics** như Hill Climbing, Simulated Annealing, Tabu Search sang một cách tư duy hoàn toàn khác:

> **Không còn cố gắng cải thiện một lời giải duy nhất. Ta duy trì cả một quần thể các lời giải, cho chúng “sinh sản”, biến dị, cạnh tranh và tiến hóa qua nhiều thế hệ.**

Genetic Algorithm (GA) được John Holland phát triển thành một framework có nền tảng toán học trong *Adaptation in Natural and Artificial Systems* (1975). Sau đó David Goldberg hệ thống hóa GA cho bài toán search/optimization trong cuốn *Genetic Algorithms in Search, Optimization, and Machine Learning* (1989). ([Google Sách][1])

Với mục tiêu của cậu là **combinatorial optimization**, chương này sẽ không dừng ở kiểu giải thích "gene, chromosome, mutation" phổ thông. Ta sẽ đi đến:

* representation / encoding;
* genotype vs phenotype;
* population;
* fitness;
* selection pressure;
* crossover;
* mutation;
* elitism;
* exploration vs exploitation;
* schema;
* building block;
* deception và epistasis;
* permutation GA;
* PMX / OX / CX;
* constraint handling;
* diversity;
* adaptive mutation;
* memetic algorithm;
* hybrid GA + Local Search / Tabu Search;
* và cuối cùng áp dụng vào **Air Conditioner Cleaning Technician**.

---

# 8.1. Trước hết: GA thực sự đang làm gì?

Giả sử bài toán có không gian nghiệm:

$$
\mathcal S=\{S_1,S_2,\ldots,S_N\}
$$

và ta muốn:

$$
\min_{S\in\mathcal S}f(S)
$$

Hill Climbing làm:

```text
một solution
    ↓
sinh neighbor
    ↓
chọn neighbor tốt hơn
    ↓
lặp
```

Simulated Annealing:

```text
một solution
    ↓
sinh neighbor
    ↓
tốt → nhận
xấu → đôi khi nhận
    ↓
lặp
```

Tabu Search:

```text
một solution
    ↓
sinh nhiều neighbor
    ↓
dùng tabu memory để tránh cycling
    ↓
chọn move tốt nhất hợp lệ
    ↓
lặp
```

GA thì khác hẳn:

```text
population
   ↓
đánh giá tất cả
   ↓
selection
   ↓
parents
   ↓
crossover
   ↓
children
   ↓
mutation
   ↓
new population
   ↓
lặp nhiều thế hệ
```

Tức là:

> **GA không tìm kiếm bằng cách di chuyển một điểm trong search space. GA tiến hóa một tập các điểm trong search space.**

Đây là sự thay đổi tư duy cực kỳ quan trọng.

---

# 8.2. Tại sao cần population?

Đây là câu hỏi quan trọng nhất trước khi học GA.

Hãy tưởng tượng landscape:

```text
fitness

          /\                         /\
         /  \                       /  \
        /    \      /\             /    \
_______/______\____/  \____________/______\____
       local A                    global B
```

Một thuật toán local search bắt đầu ở:

```text
                    X
                   / \
                  /   \
                 /     \
              local optimum
```

thì rất dễ mắc kẹt ở đó.

GA thay vì chỉ có một điểm:

```text
       X1       X2

                X3

     X4                 X5
```

nó có thể đồng thời khám phá nhiều vùng.

Đó chính là **population-based search**.

Một population:

$$
P_t=\{x_1,x_2,\ldots,x_M\}
$$

với:

* \(t\): generation;
* \(M\): population size;
* \(x_i\): một candidate solution.

Sau mỗi generation:

$$
P_t\rightarrow P_{t+1}
$$

---

# 8.3. Một GA có 6 thành phần cơ bản

Ta có thể nhìn toàn bộ GA như:

$$
\boxed{
Representation
\rightarrow
Initialization
\rightarrow
Evaluation
\rightarrow
Selection
\rightarrow
Variation
\rightarrow
Replacement
}
$$

Trong đó:

### 1. Representation

Biểu diễn solution bằng chromosome.

### 2. Initialization

Tạo population ban đầu.

### 3. Evaluation

Tính fitness.

### 4. Selection

Chọn những cá thể có cơ hội sinh sản cao hơn.

### 5. Variation

Tạo cá thể mới bằng:

* crossover;
* mutation.

### 6. Replacement

Quyết định cá thể nào sống sót sang generation tiếp theo.

---

# 8.4. Genotype và Phenotype

Đây là hai thuật ngữ rất quan trọng.

## Genotype

Là **cách máy tính biểu diễn solution**.

Ví dụ:

```text
101101001
```

## Phenotype

Là **solution thực sự mà chuỗi đó đại diện cho**.

Ví dụ:

```text
101101001
```

có thể biểu diễn:

```text
x = 361
```

nếu ta đang encode một số nguyên.

Ta có:

$$
genotype \rightarrow phenotype \rightarrow fitness
$$

Ví dụ:

```text
chromosome
    │
    ▼
101101001
    │
    ▼
x = 361
    │
    ▼
f(x)
```

Đây là lý do **representation là một trong những quyết định quan trọng nhất khi thiết kế GA**.

---

# 8.5. Binary Encoding

Đây là dạng kinh điển của GA.

Ví dụ:

```text
chromosome = 10110010
```

Mỗi vị trí gọi là một **gene**.

```text
1 0 1 1 0 0 1 0
↑ ↑ ↑ ↑ ↑ ↑ ↑ ↑
gene
```

Mỗi gene có một **allele**.

Trong binary encoding:

$$
allele\in\{0,1\}
$$

Ví dụ:

```text
10110010
```

có 8 loci.

---

# 8.6. Ví dụ cực đơn giản

Giả sử:

$$
f(x)=\text{number of 1s}
$$

với chromosome dài 8.

Ta muốn:

$$
\max f(x)
$$

Rõ ràng optimum là:

```text
11111111
```

Population ban đầu:

```text
P0:

10110010   fitness = 4
11100010   fitness = 4
00111100   fitness = 4
11011110   fitness = 6
```

GA sẽ có xu hướng giữ lại:

```text
11011110
```

vì nó có fitness cao.

Nhưng đây mới chỉ là **selection**.

---

# 8.7. Fitness Function

GA thường được mô tả theo maximization:

$$
\max F(x)
$$

Trong khi rất nhiều bài toán optimization của chúng ta là:

$$
\min f(x)
$$

Có thể chuyển đổi:

$$
F(x)=-f(x)
$$

hoặc:

$$
F(x)=\frac{1}{1+f(x)}
$$

hoặc dùng ranking thay vì biến đổi trực tiếp.

Điểm quan trọng:

> **Fitness không nhất thiết phải giống objective function.**

Ta có thể có:

$$
objective(x)
\neq
fitness(x)
$$

đặc biệt khi có constraint.

---

# 8.8. Selection — "ai được sinh con?"

Đây là cơ chế tạo **selection pressure**.

Cá thể tốt hơn có xác suất được chọn làm parent cao hơn.

Nhưng:

> **không nên luôn luôn chọn cá thể tốt nhất.**

Nếu làm thế, population rất nhanh trở nên giống nhau.

Ta sẽ quay lại vấn đề này khi nói về diversity.

---

# 8.9. Roulette Wheel Selection

Giả sử:

| Individual | Fitness |
| ---------- | ------: |
| A          |      10 |
| B          |      20 |
| C          |      30 |
| D          |      40 |

Tổng:

$$
100
$$

Xác suất:

$$
P(A)=0.1
$$

$$
P(B)=0.2
$$

$$
P(C)=0.3
$$

$$
P(D)=0.4
$$

Ta tưởng tượng một roulette:

```text
A: 10%
B: 20%
C: 30%
D: 40%
```

D có cơ hội được chọn cao nhất.

Nhưng A vẫn có cơ hội.

Đây chính là:

$$
\text{fitness-proportionate selection}
$$

---

# 8.10. Tournament Selection

Trong thực tế, tournament selection thường đơn giản và robust hơn roulette.

Ví dụ:

```text
Population:

A  fitness=10
B  fitness=50
C  fitness=20
D  fitness=80
```

Chọn ngẫu nhiên 3 cá thể:

```text
A
D
C
```

So sánh:

```text
A = 10
C = 20
D = 80
```

chọn:

```text
D
```

Đây gọi là tournament size \(k=3\).

Nếu \(k\) lớn:

$$
selection\ pressure\uparrow
$$

Nếu \(k\) nhỏ:

$$
selection\ pressure\downarrow
$$

---

# 8.11. Selection Pressure

Đây là một khái niệm cực kỳ quan trọng.

Giả sử population:

```text
A = 100
B = 99
C = 98
D = 97
...
```

Nếu selection quá mạnh:

```text
A A A A A A A A
```

thế hệ sau gần như toàn A.

Population mất diversity.

Ngược lại, nếu selection quá yếu:

```text
A B C D E F G H
```

gần như ai cũng có cơ hội ngang nhau.

Khi đó GA không có đủ lực để hội tụ.

Vì vậy GA phải cân bằng:

$$
\boxed{Exploration \leftrightarrow Exploitation}
$$

---

# 8.12. Crossover — trái tim của Genetic Algorithm

Đây là phần khiến GA trở nên đặc biệt.

Giả sử:

```text
Parent 1
11110000

Parent 2
00001111
```

Chọn crossover point:

```text
1111 | 0000
0000 | 1111
```

Sinh:

```text
Child 1
1111 | 1111

Child 2
0000 | 0000
```

Tức:

$$
Child
=
part(Parent_1)+part(Parent_2)
$$

Crossover cố gắng:

> **kết hợp các đặc tính tốt của hai parent.**

---

# 8.13. Single-point crossover

Ví dụ:

```text
P1 = 10110 | 011
P2 = 00101 | 110
```

Sau crossover:

```text
C1 = 10110 | 110
C2 = 00101 | 011
```

Đây là:

$$
\text{single-point crossover}
$$

---

# 8.14. Two-point crossover

Ví dụ:

```text
P1 = 10 | 1101 | 001
P2 = 01 | 0010 | 111
```

Giữ đoạn giữa của P1:

```text
C1 = 01 | 1101 | 111
```

và ngược lại:

```text
C2 = 10 | 0010 | 001
```

---

# 8.15. Uniform crossover

Không có một đoạn liên tục.

Mỗi gene được quyết định độc lập:

```text
P1 = 1 1 0 1 0 0
P2 = 0 0 1 0 1 1
     ↓ ↓ ↓ ↓ ↓ ↓
mask=1 0 1 0 0 1
```

Child:

```text
1 0 0 0 1 1
```

Uniform crossover có khả năng trộn genetic material mạnh hơn.

---

# 8.16. Mutation

Crossover lấy vật liệu di truyền **từ population hiện tại**.

Mutation tạo ra **variation mới**.

Binary mutation:

```text
0 → 1
1 → 0
```

Ví dụ:

```text
before:

10110010

mutation tại vị trí 5:

10111010
```

Xác suất mutation:

$$
p_m
$$

Ví dụ:

$$
p_m=0.01
$$

nghĩa là mỗi gene có xác suất khoảng 1% bị mutate.

---

# 8.17. Tại sao mutation cực kỳ quan trọng?

Giả sử population đã trở thành:

```text
11110000
11110000
11110000
11110000
```

Crossover giữa các cá thể này không tạo ra thông tin mới.

Ta chỉ nhận:

```text
11110000
```

Mutation có thể tạo:

```text
11110001
```

hoặc:

```text
11111000
```

Do đó:

$$
\boxed{
Mutation = source\ of\ new\ genetic\ material
}
$$

---

# 8.18. Nhưng mutation quá mạnh thì sao?

Nếu:

$$
p_m\approx1
$$

thì:

```text
Parent
 ↓
mutation
 ↓
gần như random solution
```

GA gần như trở thành random search.

Vậy:

$$
p_m\rightarrow0
$$

→ thiếu exploration.

$$
p_m\rightarrow1
$$

→ phá hủy information.

Do đó:

$$
\boxed{
p_m\text{ phải đủ nhỏ nhưng không quá nhỏ}
}
$$

Các biến thể adaptive mutation thậm chí điều chỉnh mutation/crossover theo trạng thái của population để cân bằng diversity và convergence. ([SciSpace][2])

---

# 8.19. Elitism

Một vấn đề:

Giả sử generation hiện tại có:

```text
best = 100
```

nhưng do crossover + mutation, generation mới chỉ còn:

```text
best = 97
```

Ta vừa làm mất solution tốt.

Elitism giải quyết:

> luôn giữ lại một số cá thể tốt nhất.

Ví dụ:

```text
population size = 100
elite size = 2
```

Ta copy:

```text
best 2 individuals
```

sang generation mới.

---

# 8.20. Standard GA

Một GA đơn giản:

```text
initialize population P

evaluate P

while not termination:

    select parents

    crossover parents
        ↓
    offspring

    mutate offspring

    evaluate offspring

    select survivors

    P = new population

return best solution
```

Nếu dùng elitism:

```text
elite
  +
offspring
  ↓
next population
```

---

# 8.21. Pseudocode chuẩn

```text
GA():

    P ← InitializePopulation()

    Evaluate(P)

    best ← Best(P)

    while not TerminationCondition():

        E ← Elite(P)

        Q ← ∅

        while |Q| < population_size - |E|:

            p1 ← Select(P)
            p2 ← Select(P)

            if random() < crossover_rate:
                c1, c2 ← Crossover(p1, p2)
            else:
                c1 ← copy(p1)
                c2 ← copy(p2)

            Mutate(c1)
            Mutate(c2)

            Evaluate(c1)
            Evaluate(c2)

            Q.add(c1)
            Q.add(c2)

        P ← E ∪ Q

        best ← Best(best, P)

    return best
```

Đây là skeleton rất quan trọng.

---

# 8.22. Một ví dụ chạy hoàn chỉnh

Ta quay lại:

$$
f(x)=\text{number of 1s}
$$

và:

$$
L=6
$$

Population:

| Chromosome | Fitness |
| ---------- | ------: |
| 101100     |       3 |
| 111000     |       3 |
| 001111     |       4 |
| 110111     |       5 |

Best:

```text
110111
```

---

## Bước 1 — Selection

Giả sử tournament selection chọn:

```text
P1 = 001111
P2 = 110111
```

---

## Bước 2 — Crossover

Chọn:

```text
001 | 111
110 | 111
```

Child:

```text
001111
110111
```

Ở ví dụ này crossover không cải thiện gì.

---

## Bước 3 — Mutation

Giả sử:

```text
001111
```

mutation gene thứ 2:

```text
011111
```

Fitness:

$$
5
$$

Một child khác:

```text
110111
```

mutation gene thứ 3:

```text
111111
```

Fitness:

$$
6
$$

Ta đã tìm được optimum:

```text
111111
```

---

# 8.23. Nhưng ví dụ trên quá dễ

Đây là điểm cần bắt đầu suy nghĩ sâu hơn.

Nếu bài toán đơn giản như:

$$
f(x)=\sum_i x_i
$$

thì GA chẳng có gì thần kỳ.

Thậm chí Greedy hoặc random mutation cũng đủ.

Sức mạnh của GA xuất hiện khi:

> **fitness của một gene phụ thuộc vào sự kết hợp với các gene khác.**

Đây dẫn chúng ta đến:

# 8.24. Epistasis

Thuật ngữ này rất quan trọng trong evolutionary computation.

Giả sử:

$$
f(x_1,x_2)
$$

không thể phân tách thành:

$$
f_1(x_1)+f_2(x_2)
$$

mà có interaction:

$$
f(x_1,x_2)
=
f_1(x_1)+f_2(x_2)+g(x_1,x_2)
$$

thì:

$$
x_1
$$

có thể tốt khi đi với:

```text
x2 = 1
```

nhưng xấu khi đi với:

```text
x2 = 0
```

Đó là **gene interaction**, thường gọi là epistasis.

Đây là một trong những lý do khiến combinatorial optimization khó.

---

# 8.25. Schema

Bây giờ đến một trong những phần lý thuyết nổi tiếng nhất của GA.

Một **schema** là một pattern mô tả một tập chromosome.

Ví dụ:

```text
1 * 0 * * 1
```

Dấu:

```text
*
```

nghĩa là:

> gene ở vị trí đó có thể là bất kỳ giá trị nào.

Schema:

```text
1 * 0 * * 1
```

đại diện cho:

```text
100001
100011
100101
...
110111
```

---

# 8.26. Order của schema

**Order**:

$$
o(H)
$$

là số vị trí cố định.

Ví dụ:

```text
1 * 0 * * 1
```

có 3 vị trí cố định:

$$
o(H)=3
$$

---

# 8.27. Defining length

Gọi:

$$
\delta(H)
$$

là khoảng cách giữa gene cố định đầu tiên và cuối cùng.

Ví dụ:

```text
1 * 0 * * 1
↑         ↑
```

nên:

$$
\delta(H)=5
$$

Schema theorem của Holland phân tích xác suất schema được truyền sang thế hệ sau dưới tác động của selection, crossover và mutation. ([ScienceDirect][3])

---

# 8.28. Building Block

Đây là một ý tưởng cực đẹp.

Giả sử solution tốt gồm:

```text
[A B C] + [D E F] + [G H I]
```

Trong đó:

```text
[A B C]
```

là một cấu trúc tốt.

Và:

```text
[D E F]
```

cũng là một cấu trúc tốt.

GA có thể:

```text
Parent 1
[A B C] + X + Y

Parent 2
P + [D E F] + Q
```

sau crossover:

```text
[A B C] + [D E F] + ...
```

Tức là nó **ghép các partial solutions tốt**.

Những partial solutions tốt này thường được gọi là:

$$
\boxed{building\ blocks}
$$

Building-block hypothesis là cách diễn giải nổi tiếng về việc GA kết hợp những cấu trúc nhỏ có chất lượng tốt để hình thành solution tốt hơn. Nhưng cần lưu ý: đây là **hypothesis/interpretation**, không phải định lý bảo đảm GA luôn hoạt động theo cách đó. ([DORAS][4])

---

# 8.29. Một lưu ý quan trọng về Schema Theorem

Có một hiểu lầm phổ biến:

> "Schema theorem chứng minh GA sẽ tìm được optimum."

**Không đúng.**

Schema theorem cho một bound về expected propagation của schema dưới một số giả định. Nó **không chứng minh GA luôn tìm global optimum**, cũng không trực tiếp cho ta convergence rate hay chất lượng nghiệm. Những diễn giải mạnh hơn về sức mạnh của GA từ schema theorem đã bị tranh luận trong literature. ([ScienceDirect][5])

Đây là distinction rất quan trọng nếu sau này cậu đọc paper.

---

# 8.30. Tại sao representation quan trọng đến vậy?

Giả sử ta có TSP:

```text
A B C D E
```

Một solution là:

```text
A → C → E → B → D
```

Đây là **permutation**.

Không thể dùng crossover binary đơn giản một cách tùy tiện.

Ví dụ:

```text
P1 = A B C D E
P2 = C D E A B
```

Crossover:

```text
A B | C D E
C D | E A B
```

có thể tạo:

```text
A B E A B
```

Nhưng:

```text
A
B
E
A
B
```

không phải permutation hợp lệ.

Ta có:

* duplicate A;
* duplicate B;
* mất C;
* mất D.

Do đó:

> **Operator phải phù hợp với representation.**

Đây là một trong những nguyên tắc quan trọng nhất của GA cho combinatorial optimization.

---

# 8.31. Permutation Encoding

Đối với TSP:

$$
x=(x_1,x_2,\ldots,x_n)
$$

với:

$$
\{x_1,\ldots,x_n\}=\{1,\ldots,n\}
$$

Ví dụ:

```text
[4, 1, 5, 2, 3]
```

mỗi city xuất hiện đúng một lần.

---

# 8.32. PMX — Partially Mapped Crossover

PMX được Goldberg và Lingle đề xuất trong bối cảnh TSP/permutation representations. ([Genetic Programming Bibliography][6])

Ví dụ:

```text
P1 = 1 2 | 3 4 5 | 6 7 8
P2 = 5 7 | 8 6 2 | 1 4 3
```

Giữ đoạn giữa P1:

```text
_ _ | 3 4 5 | _ _ _
```

Mapping giữa hai đoạn:

```text
3 ↔ 8
4 ↔ 6
5 ↔ 2
```

Sau đó điền các vị trí còn lại từ P2, xử lý conflict bằng mapping.

Kết quả vẫn là:

```text
permutation hợp lệ
```

Đây là một ví dụ rất điển hình cho nguyên tắc:

$$
\boxed{
representation
\Rightarrow
operator
}
$$

---

# 8.33. Order Crossover — OX

OX tập trung nhiều hơn vào việc bảo toàn **thứ tự tương đối**.

Ví dụ:

```text
P1 = 1 2 | 3 4 5 | 6 7 8
P2 = 5 7 | 8 6 2 | 1 4 3
```

Ta copy:

```text
3 4 5
```

từ P1.

Sau đó duyệt P2 theo thứ tự vòng:

```text
1 4 3 5 7 8 6 2
```

bỏ những city đã có:

```text
3 4 5
```

còn:

```text
1 7 8 6 2
```

điền vào các vị trí còn lại.

OX được Davis thiết kế cho permutation/order-based problems. ([MDPI][7])

---

# 8.34. Tại sao có nhiều crossover?

Vì "goodness" của solution có thể nằm ở các cấu trúc khác nhau.

TSP có thể quan tâm:

```text
edge
```

hoặc:

```text
relative order
```

hoặc:

```text
position
```

Do đó có:

* PMX;
* OX;
* CX;
* edge recombination;
* heuristic crossover;
* v.v.

Không có crossover universal tốt nhất.

---

# 8.35. Mutation cho permutation

Không thể đơn giản:

```text
gene = random city
```

vì có thể duplicate.

Các mutation kinh điển:

### Swap

```text
1 2 3 4 5

swap(2,5)

1 5 3 4 2
```

### Insert

```text
1 2 3 4 5

move 4 before 2

1 4 2 3 5
```

### Inversion

```text
1 2 3 4 5 6

reverse [2..5]

1 5 4 3 2 6
```

Điều thú vị:

> Những mutation này chính là các **neighborhood move** mà chúng ta đã học ở Local Search.

Đây là điểm bắt đầu xuất hiện sự liên kết giữa các chương.

---

# 8.36. GA và Local Search bắt đầu gặp nhau

Ví dụ:

```text
GA
 │
 ├── crossover
 │
 ├── mutation
 │
 └── offspring
        │
        ▼
    Local Search
        │
        ▼
 improved offspring
```

Đây là:

$$
\boxed{Memetic\ Algorithm}
$$

Memetic Algorithm được Moscato đưa ra cuối thập niên 1980 như một dạng evolutionary/population-based search kết hợp với local refinement. ([ScienceDirect][8])

Và đây chính là một trong những hướng mạnh nhất cho combinatorial optimization.

---

# 8.37. GA vs Memetic Algorithm

### GA

```text
population
    ↓
crossover
    ↓
mutation
    ↓
population
```

### Memetic Algorithm

```text
population
    ↓
crossover
    ↓
mutation
    ↓
local search
    ↓
population
```

GA:

> tìm kiếm global bằng population.

Local Search:

> tinh chỉnh local.

MA:

> **global exploration + local exploitation.**

Đây chính là một theme xuyên suốt cả khóa học.

---

# 8.38. Constraint Handling

Đây là phần cực kỳ quan trọng khi áp dụng GA vào bài toán thật.

Giả sử:

$$
\min f(x)
$$

subject to:

$$
g_i(x)\le0
$$

GA có thể sinh:

```text
x = infeasible
```

Có 4 chiến lược lớn.

---

## Cách 1 — Penalty

Định nghĩa:

$$
F(x)
=
f(x)+
\lambda V(x)
$$

với:

$$
V(x)=\text{constraint violation}
$$

Ví dụ:

```text
objective = 100
violation = 5
λ = 1000
```

thì:

$$
F=100+5000=5100
$$

Infeasible solution bị phạt nặng.

Penalty là một trong những phương pháp phổ biến nhất nhưng việc chọn penalty coefficient là vấn đề quan trọng. ([ScienceDirect][9])

---

# 8.39. Cách 2 — Repair

Thay vì:

```text
infeasible
   ↓
penalty
```

ta làm:

```text
infeasible
   ↓
repair
   ↓
feasible
```

Ví dụ knapsack:

```text
capacity = 100
current weight = 130
```

Repair:

```text
remove some items
```

cho đến:

```text
weight <= 100
```

Repair đặc biệt hữu ích trong combinatorial optimization khi ta có thể tận dụng cấu trúc bài toán để sửa nghiệm không hợp lệ. ([ScienceDirect][10])

---

# 8.40. Cách 3 — Feasibility-preserving representation

Thiết kế chromosome sao cho:

$$
\boxed{
\text{mọi chromosome đều feasible}
}
$$

Đây thường là cách rất đẹp.

Ví dụ TSP:

```text
permutation
```

tự động đảm bảo:

```text
mỗi city xuất hiện đúng một lần
```

nếu crossover/mutation được thiết kế đúng.

---

# 8.41. Cách 4 — Feasibility Rules

Có thể so sánh:

1. feasible > infeasible;
2. giữa hai feasible → objective tốt hơn;
3. giữa hai infeasible → violation nhỏ hơn.

Ví dụ:

| Solution | Feasible? | Cost | Violation |
| -------- | --------- | ---: | --------: |
| A        | yes       |  100 |         0 |
| B        | yes       |  120 |         0 |
| C        | no        |   70 |         2 |
| D        | no        |   80 |         5 |

Thứ tự:

```text
A > B > C > D
```

dù C có objective thấp hơn B.

---

# 8.42. Diversity — vấn đề sống còn

Hãy tưởng tượng population:

```text
11111110
11111110
11111110
11111110
11111110
11111110
```

GA đã **converged** về mặt genetic diversity.

Nhưng chưa chắc:

```text
global optimum
```

đã được tìm thấy.

Đây gọi là:

$$
\boxed{Premature\ convergence}
$$

---

# 8.43. Genetic Drift

Nếu population quá nhỏ hoặc selection quá mạnh:

```text
gene A
 ↓
gene A
 ↓
gene A
 ↓
gene A
```

các allele khác biến mất.

Khi đã mất:

$$
\text{mutation}
$$

có thể là nguồn duy nhất để đưa chúng trở lại.

Đó là lý do population size, mutation rate và selection pressure liên kết chặt chẽ.

---

# 8.44. Exploration vs Exploitation trong GA

Ta có thể nhìn:

| Thành phần           | Vai trò                                    |
| -------------------- | ------------------------------------------ |
| Selection            | exploitation                               |
| Crossover            | recombination / exploitation + exploration |
| Mutation             | exploration                                |
| Population diversity | exploration                                |
| Elitism              | exploitation                               |
| Large population     | exploration                                |
| Strong selection     | exploitation                               |

Không phải một thành phần chỉ có một vai trò tuyệt đối, nhưng bảng này rất hữu ích về mặt trực giác.

---

# 8.45. Adaptive Mutation

Thay vì:

$$
p_m=0.01
$$

cố định suốt đời, ta có:

$$
p_m=p_m(t)
$$

Ví dụ:

```text
đầu algorithm:

mutation = 0.05
```

sau đó:

```text
population diversity giảm
       ↓
mutation tăng
```

Hoặc:

```text
fitness stagnates
       ↓
mutation tăng
```

Một nghiên cứu kinh điển về adaptive crossover/mutation của Srinivas và Patnaik đề xuất điều chỉnh xác suất nhằm vừa duy trì diversity vừa giữ khả năng hội tụ. ([SciSpace][2])

---

# 8.46. Multi-Parent / Population Structure

GA không nhất thiết phải có:

```text
một population duy nhất
```

Có thể chia thành:

```text
Island 1
Island 2
Island 3
Island 4
```

Mỗi island tiến hóa riêng.

Thỉnh thoảng:

```text
migration
```

đưa một vài individual từ island này sang island khác.

Ví dụ:

```text
Island A              Island B

AAAA                  BBBB
AAAA       ←→         BBBB
AAAA                  BBBB
```

Điều này giúp giảm premature convergence.

Các nghiên cứu về population structure/demes cũng đã được dùng để cải thiện khả năng tìm global optimum trên fitness landscapes có nhiều local optima. ([ScienceDirect][11])

---

# 8.47. Steady-State GA

Không nhất thiết mỗi generation thay toàn bộ population.

Ta có:

```text
Population:
A B C D E
```

sinh:

```text
X
```

rồi thay cá thể xấu nhất:

```text
A B X D E
```

Đây là:

$$
\boxed{Steady\text{-}state\ GA}
$$

thay vì:

$$
P_t\rightarrow P_{t+1}
$$

toàn bộ.

Selection schemes như tournament, ranking và steady-state/Genitor đã được nghiên cứu rất rộng trong GA. ([ScienceDirect][12])

---

# 8.48. Generational GA vs Steady-State GA

|                | Generational                 | Steady-State             |
| -------------- | ---------------------------- | ------------------------ |
| Replacement    | toàn bộ                      | một phần                 |
| Dynamics       | nhanh                        | liên tục                 |
| Diversity      | dễ kiểm soát theo generation | khó hơn                  |
| Implementation | đơn giản                     | linh hoạt                |
| Elitism        | thường rõ ràng               | thường implicit/explicit |

---

# 8.49. Một GA thực tế không chỉ là "genetic"

Đây là một insight rất quan trọng.

GA textbook:

```text
selection
crossover
mutation
```

Nhưng GA thực tế thường có:

```text
Representation
Initialization
Selection
Crossover
Mutation
Repair
Local Search
Elitism
Diversity control
Adaptive parameters
Restart
Population management
```

Do đó:

$$
\boxed{
GA \neq 3\ operators
}
$$

GA là **một search framework**.

---

# 8.50. Complexity

Giả sử:

* population size = \(P\);
* chromosome evaluation cost = \(E\);
* number of generations = \(G\).

Thì fitness evaluation xấp xỉ:

$$
O(GPE)
$$

Nếu mỗi generation có \(P\) offspring.

Trong nhiều bài toán combinatorial optimization:

$$
E\gg O(1)
$$

nên:

> **fitness evaluation thường là bottleneck chứ không phải crossover/mutation.**

Điều này rất quen thuộc với challenge của cậu.

---

# 8.51. Parallelism

GA có một advantage rất tự nhiên:

```text
evaluate(x1)
evaluate(x2)
evaluate(x3)
evaluate(x4)
...
```

gần như độc lập.

Có thể:

```text
CPU 1 → x1
CPU 2 → x2
CPU 3 → x3
CPU 4 → x4
```

Do đó GA rất phù hợp với:

* multicore;
* GPU;
* distributed island models.

---

# 8.52. Bây giờ áp dụng vào Air Conditioner Cleaning Technician

Đây mới là phần quan trọng nhất đối với mục tiêu của cậu.

Ta có:

* tối đa 30 ngày;
* mỗi ngày 720 phút;
* một technician;
* di chuyển Manhattan;
* mỗi house có số máy \(m\);
* service time:

  $$
  t_{service}=30m+30
  $$
* reward:

  $$
  gPrice[m]
  $$
* bonus phụ thuộc thời điểm hoàn thành.

Đây là một **complex scheduling + routing + selection problem**.

---

# 8.53. Một solution cần encode cái gì?

Một solution có thể là:

```text
Day 1:
H12 → H5 → H31 → H8

Day 2:
H4 → H19 → H7

Day 3:
H2 → H50 → ...
```

Nhưng nếu encode trực tiếp như vậy:

```text
[H12,H5,H31,H8,H4,H19,H7,...]
```

ta chưa biết:

```text
ngày nào?
```

Do đó chromosome có thể cần encoding cả:

$$
\boxed{
customer/order + day assignment
}
$$

---

# 8.54. Representation A — permutation + split points

Ví dụ:

```text
Permutation:

H5 H2 H8 H1 H9 H4 H7 H3
```

và:

```text
Day boundaries:

[ H5 H2 H8 ]
[ H1 H9 ]
[ H4 H7 H3 ]
```

nghĩa là:

```text
Day 1: H5 H2 H8
Day 2: H1 H9
Day 3: H4 H7 H3
```

Đây là một representation rất mạnh.

Ta tách:

$$
\text{chromosome}
=
\text{order}
+
\text{partition}
$$

---

# 8.55. Representation B — gene cho mỗi house

Mỗi house có:

```text
day
position
```

Ví dụ:

```text
House 1 → day 2
House 2 → day 1
House 3 → day 2
...
```

Sau đó decoder xây dựng route.

Đây gọi là:

$$
\boxed{Indirect\ representation}
$$

hay decoder-based representation.

---

# 8.56. Tại sao decoder rất hữu ích?

Thay vì để GA trực tiếp sinh:

```text
route hoàn chỉnh
```

ta để GA sinh:

```text
priority / key
```

sau đó decoder biến priority thành route.

Ví dụ:

```text
genes:

H1 = 0.72
H2 = 0.15
H3 = 0.93
H4 = 0.44
```

sort:

```text
H2 H4 H1 H3
```

→ route.

Điều này cho phép ta kiểm soát feasibility tốt hơn.

---

# 8.57. Fitness của AC Technician

Giả sử chromosome giải mã thành schedule \(S\).

Ta tính:

$$
F(S)
=
\sum_{jobs} revenue
+
\sum_{jobs} bonus
-
penalty(S)
$$

Ví dụ:

$$
F(S)=
\text{income}
+\text{time bonus}
-\lambda\cdot\text{violation}
$$

Nhưng có một vấn đề lớn:

> Nếu penalty không đủ lớn, GA có thể thích schedule vi phạm constraint vì nó kiếm nhiều tiền hơn.

---

# 8.58. Một hướng tốt hơn

Ta có thể dùng lexicographic fitness:

$$
S_1>S_2
$$

nếu:

1. \(S_1\) feasible, \(S_2\) infeasible;
2. cả hai feasible → score cao hơn;
3. cả hai infeasible → violation nhỏ hơn.

Điều này thường ổn định hơn penalty cố định trong những bài toán có constraint mạnh.

Constraint handling là một chủ đề lớn riêng trong evolutionary computation; literature bao gồm penalty, repair, special representations/operators, separation of objectives and constraints, v.v. ([ScienceDirect][9])

---

# 8.59. Mutation cực kỳ thú vị trong bài này

Ta có thể dùng:

### Swap

```text
H1 H2 H3 H4 H5

→

H1 H4 H3 H2 H5
```

### Insert

```text
H1 H2 H3 H4 H5

→

H1 H3 H4 H2 H5
```

### Move job to another day

```text
Day 1:
H1 H2 H3

Day 2:
H4 H5
```

move H3:

```text
Day 1:
H1 H2

Day 2:
H4 H5 H3
```

### 2-opt

Trong một route:

```text
A → B → C → D → E
```

đổi:

```text
A → C → B → D → E
```

hoặc inversion.

---

# 8.60. Và đây là điểm cực kỳ thú vị

Cậu vừa học:

* Hill Climbing;
* SA;
* Tabu Search;
* GA.

Bây giờ ta có thể **nhúng toàn bộ chúng vào nhau**.

Ví dụ:

```text
Genetic Algorithm
        │
        ├── Selection
        ├── Crossover
        ├── Mutation
        │
        ▼
    Tabu Search
        │
        ▼
 improved offspring
```

hoặc:

```text
GA
 ↓
SA
 ↓
solution
```

hoặc:

```text
GA
 ↓
2-opt
 ↓
Tabu Search
```

Đây là lý do metaheuristics trở nên rất mạnh trong thực tế:

> **Các thuật toán không phải những chiếc hộp đóng kín.**

---

# 8.61. GA + Local Search = Memetic Algorithm

Một pipeline rất tự nhiên:

```text
Initial Population
        ↓
      GA
        ↓
   Crossover
        ↓
    Mutation
        ↓
   Local Search
        ↓
  Elite Selection
        ↓
   New Population
```

Local Search có thể là:

```text
2-opt
Swap
Insert
Tabu Search
Hill Climbing
SA
```

Do đó:

$$
\boxed{
Memetic
=
Evolutionary\ Search
+
Local\ Improvement
}
$$

---

# 8.62. GA + Tabu Search

Đây là hybrid rất đáng chú ý đối với bài của cậu.

GA chịu trách nhiệm:

$$
\text{global exploration}
$$

Tabu Search:

$$
\text{local exploitation}
$$

Pipeline:

```text
Population
   ↓
Selection
   ↓
Crossover
   ↓
Mutation
   ↓
Tabu Search
   ↓
Elite offspring
   ↓
Population
```

Điều này tận dụng đúng thế mạnh của hai chương trước.

---

# 8.63. GA + Simulated Annealing

Tương tự:

```text
GA
 ↓
offspring
 ↓
SA
 ↓
locally refined offspring
```

GA tìm vùng tốt.

SA giúp offspring thoát local optimum.

---

# 8.64. Nhưng có một câu hỏi sâu hơn

Nếu ta đã có:

```text
Tabu Search
```

và:

```text
GA
```

tại sao không dùng một mình?

Đây chính là tư duy của **hybrid metaheuristics**.

Một thuật toán có thể:

* explore tốt nhưng exploit kém;
* exploit tốt nhưng explore kém;
* xử lý constraint tốt nhưng diversity kém;
* hoặc ngược lại.

Ta ghép chúng để bù điểm yếu.

---

# 8.65. Những vấn đề khó nhất khi implement GA

Không phải viết:

```cpp
crossover();
mutation();
selection();
```

là xong.

Các vấn đề thực sự là:

### 1. Representation

$$
\boxed{\text{What exactly is a chromosome?}}
$$

### 2. Fitness

$$
\boxed{\text{How do we measure solution quality?}}
$$

### 3. Feasibility

$$
\boxed{\text{What happens when offspring is invalid?}}
$$

### 4. Diversity

$$
\boxed{\text{How do we prevent population collapse?}}
$$

### 5. Operators

$$
\boxed{\text{What structure should crossover preserve?}}
$$

### 6. Evaluation speed

$$
\boxed{\text{Can we evaluate millions of individuals quickly?}}
$$

Đây mới là phần khó.

---

# 8.66. Các hyperparameter quan trọng

Một GA thường có:

| Parameter          | Ý nghĩa                   |
| ------------------ | ------------------------- |
| \(P\)              | population size           |
| \(G\)              | number of generations     |
| \(p_c\)            | crossover probability     |
| \(p_m\)            | mutation probability      |
| elite              | số elite                  |
| tournament size    | selection pressure        |
| representation     | encoding                  |
| crossover operator | cách recombine            |
| mutation operator  | cách perturb              |
| replacement        | generational/steady-state |

Không có bộ tham số universal tốt nhất.

---

# 8.67. Population size

Nếu:

$$
P
$$

quá nhỏ:

```text
diversity ↓
premature convergence ↑
```

Nếu:

$$
P
$$

quá lớn:

```text
exploration ↑
evaluation cost ↑
```

Nếu fitness evaluation rất đắt, population size cần được cân nhắc dựa trên **evaluation budget**, không chỉ số generation.

---

# 8.68. Mutation rate

Quá thấp:

```text
exploration ↓
```

Quá cao:

```text
building blocks destroyed
```

Nên tư duy:

$$
\boxed{
Mutation = inject\ diversity
}
$$

chứ không phải:

> mutation càng nhiều càng tốt.

---

# 8.69. Crossover rate

Thông thường crossover có xác suất khá cao trong canonical GA.

Nhưng không nên hiểu:

$$
p_c=1
$$

luôn luôn tốt.

Nếu representation và crossover không phù hợp, crossover có thể phá hủy những cấu trúc rất tốt.

---

# 8.70. Termination

Có thể dừng khi:

### Generation limit

$$
t\ge G_{max}
$$

### Evaluation budget

$$
evaluations\ge B
$$

### Time limit

```text
elapsed >= T
```

### No improvement

```text
best unchanged for K generations
```

Trong programming contest / optimization challenge:

$$
\boxed{\text{time budget thường quan trọng nhất}}
$$

---

# 8.71. Một điểm rất quan trọng: GA không đảm bảo optimal

Giống SA và Tabu Search:

$$
\boxed{
GA\text{ là heuristic/metaheuristic}
}
$$

Không có guarantee rằng:

$$
x_{GA}=x^*
$$

trong thời gian hữu hạn.

GA có thể rất mạnh trên một số landscape nhưng rất tệ trên landscape khác. Literature cũng nhấn mạnh rằng hiệu quả GA phụ thuộc mạnh vào problem representation, operators và cấu trúc landscape. ([IEEE Xplore][13])

---

# 8.72. So sánh toàn bộ 5 chương

Đây là bảng mà tớ rất muốn cậu ghi nhớ:

| Algorithm           | Search state              | Cơ chế thoát local optimum       |
| ------------------- | ------------------------- | -------------------------------- |
| Hill Climbing       | 1 solution                | gần như không                    |
| Simulated Annealing | 1 solution                | accept bad move                  |
| Tabu Search         | 1 solution + memory       | forbid/restrict moves            |
| Genetic Algorithm   | population                | crossover + population diversity |
| Memetic Algorithm   | population + local search | GA + local improvement           |

Nhìn theo cách khác:

```text
Hill Climbing
      │
      ▼
  một điểm
```

```text
SA / Tabu
      │
      ▼
một điểm + cơ chế escape
```

```text
GA
      │
      ▼
nhiều điểm
```

```text
Memetic
      │
      ▼
nhiều điểm
+
local optimization
```

---

# 8.73. Một insight cực kỳ quan trọng

Có thể coi các thuật toán ta đã học như những cách xử lý **information** khác nhau.

### Hill Climbing

```text
current solution
+
local neighborhood
```

### SA

```text
current solution
+
local neighborhood
+
temperature/history via T
```

### Tabu

```text
current solution
+
neighborhood
+
explicit memory
```

### GA

```text
many solutions
+
selection
+
recombination
+
mutation
```

### Memetic Algorithm

```text
population
+
recombination
+
mutation
+
local intelligence
```

Đây chính là lý do càng đi sâu, các metaheuristic càng bắt đầu "nói chuyện" với nhau.

---

# 8.74. Evolutionary Algorithms rộng hơn Genetic Algorithms

Một điểm terminological cần phân biệt.

**Genetic Algorithm** chỉ là **một nhánh** của:

$$
\boxed{Evolutionary\ Algorithms\ (EA)}
$$

EA bao gồm nhiều paradigm:

```text
Evolutionary Computation
│
├── Genetic Algorithms
├── Evolution Strategies
├── Evolutionary Programming
├── Genetic Programming
└── Differential Evolution
```

Một survey kinh điển cũng phân biệt các paradigm này và ghi nhận xu hướng hiện đại thường dùng "evolutionary algorithms" theo nghĩa rộng hơn. ([ScienceDirect][9])

Vì vậy tên chương:

> **Genetic / Evolutionary Algorithms**

là có chủ ý.

---

# 8.75. Genetic Programming là gì?

Thay vì chromosome:

```text
10101010
```

hoặc:

```text
[1,4,2,3,5]
```

ta có thể encode **program**:

```text
        +
       / \
      *   -
     / \ / \
    x  2 y  3
```

Mutation có thể:

```text
change operator
```

Crossover có thể:

```text
swap subtree
```

GA lúc này tiến hóa **chương trình**, không chỉ solution.

Đó là:

$$
\boxed{Genetic\ Programming}
$$

Một nhánh rất thú vị nhưng không phải trọng tâm combinatorial optimization của chúng ta.

---

# 8.76. Một workflow GA tốt cho bài thực tế

Nếu gặp một bài optimization mới, đừng bắt đầu bằng:

> "Dùng GA."

Hãy đi theo thứ tự:

```text
1. Define solution
       ↓
2. Define representation
       ↓
3. Define feasibility
       ↓
4. Define objective
       ↓
5. Design initialization
       ↓
6. Design neighborhood / genetic operators
       ↓
7. Design fitness
       ↓
8. Design diversity mechanism
       ↓
9. Benchmark
       ↓
10. Hybridize if necessary
```

Đây là tư duy **algorithm engineering**, không phải chỉ học thuật toán.

---

# 8.77. Áp dụng vào AC Technician — kiến trúc GA đầu tiên

Một phiên bản prototype có thể:

```text
Population
  ↓
random feasible schedules
  ↓
evaluate revenue
  ↓
tournament selection
  ↓
permutation crossover
  ↓
swap / insert mutation
  ↓
repair
  ↓
2-opt / local improvement
  ↓
elitism
  ↓
next generation
```

Fitness:

$$
F(S)
=
Revenue(S)+Bonus(S)
$$

với feasibility:

$$
\forall day:
\quad
time(day)\le720
$$

và những constraint khác.

---

# 8.78. Một kiến trúc mạnh hơn

Sau khi prototype chạy:

```text
                    ┌──────────────┐
                    │ Population   │
                    └──────┬───────┘
                           ↓
                     Selection
                           ↓
                    Crossover / OX
                           ↓
                  Mutation / Insert
                           ↓
                        Repair
                           ↓
                     Local Search
                           ↓
                    Tabu / 2-opt
                           ↓
                         Elite
                           ↓
                    New Population
```

Ta đã có:

$$
\boxed{
GA + Repair + Local\ Search + Tabu
}
$$

Đây là kiểu hybrid mà cậu sẽ gặp rất thường xuyên khi đọc các bài optimization thực tế.

---

# 8.79. Một cảnh báo rất quan trọng

GA **không tự động tốt hơn** SA/Tabu.

Ví dụ:

```text
Neighborhood rất mạnh
fitness delta rất nhanh
```

thì Tabu Search có thể đánh bại GA rất xa.

Ngược lại, nếu:

```text
solution landscape rất fragmented
nhiều local optima
nhiều cấu trúc tốt ở các vùng khác nhau
```

thì population-based search có thể có lợi thế.

Vì vậy:

$$
\boxed{
Algorithm\ choice
\neq
"algorithm\ nào\ nổi\ tiếng\ hơn"
}
$$

mà là:

$$
\boxed{
Problem\ structure
\rightarrow
Search\ strategy
}
$$

---

# 8.80. Tư duy quan trọng nhất của Chương 8

Nếu chỉ giữ lại **một câu**, hãy giữ câu này:

> **GA không cố sửa một solution cho đến khi nó tốt; GA tạo ra một quần thể, chọn lọc thông tin tốt, tái tổ hợp thông tin đó và liên tục tạo ra variation mới.**

Hay dưới dạng pipeline:

$$
\boxed{
Population
\rightarrow
Selection
\rightarrow
Recombination
\rightarrow
Mutation
\rightarrow
Evaluation
\rightarrow
Survival
}
$$

Và nếu nâng cấp:

$$
\boxed{
GA
+
Local\ Search
=
Memetic\ Algorithm
}
$$

---

# 8.81. Bức tranh toàn bộ đến thời điểm này

Ta đã đi từ:

```text
                    Exact / Approximate
                           │
                           ▼
                  Mathematical Search
                           │
              ┌────────────┴────────────┐
              │                         │
       Single Solution             Population
              │                         │
      ┌───────┼────────┐                │
      │       │        │                │
      ▼       ▼        ▼                ▼
     HC      SA       Tabu              GA
      │       │        │                │
      └───────┴────────┘                │
              │                         │
              └──────────┬──────────────┘
                         ▼
                   Hybrid Methods
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
       GA + Local Search       GA + Tabu
              │
              ▼
        Memetic Algorithm
```

Đây là lúc bức tranh bắt đầu trở nên rất đẹp: **SA, Tabu và GA không phải những thuật toán rời rạc**, mà là những cách khác nhau để điều khiển **exploration, exploitation, memory, diversity và information reuse**.

---

## 8.82. Tài liệu nền tảng nên biết

Nếu muốn đi theo hướng nghiên cứu thật sự, ba mốc rất đáng nhớ:

1. **John H. Holland — *Adaptation in Natural and Artificial Systems* (1975)**: công trình nền tảng đặt cơ sở lý thuyết cho Genetic Algorithms và schema analysis. ([Google Sách][1])
2. **David E. Goldberg — *Genetic Algorithms in Search, Optimization, and Machine Learning* (1989)**: một trong những textbook kinh điển về GA, bao gồm mathematical foundations, implementation và applications. ([Google Sách][14])
3. **Srinivas & Patnaik — "Genetic Algorithms: A Survey" (1994)**: survey về nền tảng, kỹ thuật cải tiến, theory, dynamics và deception trong GA. ([IEEE Xplore][13])

Và khi bước sang **GA cho combinatorial optimization**, PMX/OX và các permutation operators là nhóm tài liệu đặc biệt đáng học vì nó cho thấy rất rõ nguyên tắc *representation ↔ operator*. ([Genetic Programming Bibliography][6])

---

### Chốt Chương 8

Nếu Chương 6 cho cậu tư duy:

$$
\boxed{\text{"Cho phép mình đi xuống để có cơ hội leo lên cao hơn."}}
$$

thì Chương 7:

$$
\boxed{\text{"Nhớ những bước mình vừa đi để đừng mắc kẹt trong vòng lặp."}}
$$

còn Chương 8:

$$
\boxed{\text{"Đừng chỉ tiến hóa một lời giải — hãy tiến hóa cả một quần thể lời giải."}}
$$

Và đây cũng là bước đệm rất quan trọng cho **Chương 9**, nơi ta sẽ đi sâu vào các biến thể mạnh hơn của local/population search như **Iterated Local Search (ILS), Variable Neighborhood Search (VNS), Large Neighborhood Search (LNS) và Adaptive LNS (ALNS)** — đặc biệt hữu ích cho bài AC Technician vì chúng cho phép ta **phá một phần solution rồi xây lại có chủ đích**, thay vì chỉ perturb từng bước nhỏ.

[1]: https://books.google.com/books/about/Adaptation_in_Natural_and_Artificial_Sys.html?id=JE5RAAAAMAAJ&utm_source=chatgpt.com "Adaptation in Natural and Artificial Systems: An Introductory Analysis with ... - John Henry Holland - Google Books"
[2]: https://scispace.com/institutions/indian-institute-of-science-3ga7vigs/1994?utm_source=chatgpt.com "Top 606 papers published by Indian Institute of Science in 1994"
[3]: https://www.sciencedirect.com/topics/computer-science/schema-theorem?utm_source=chatgpt.com "Schema Theorem - an overview | ScienceDirect Topics"
[4]: https://doras.dcu.ie/28846/1/Cluskey_Thesis_FINAL_7%20July%202023.pdf?utm_source=chatgpt.com "that mimic the processes of biological evolution in order to solve problems and model solutions (Mitchell 1995, p. 1). Holland’s ‘schema theorem’ (Holland 1992b) and related ‘building block hypothesis’ (Goldberg 1989) provide the theoretical basis for the design of efficient GAs:"
[5]: https://www.sciencedirect.com/science/article/pii/B9781558603561500066?utm_source=chatgpt.com "The Schema Theorem and Price's Theorem - ScienceDirect"
[6]: https://gpbib.pmacs.upenn.edu/icga/icga1985-ocr.pdf?utm_source=chatgpt.com "PROCEEDINGS OF"
[7]: https://www.mdpi.com/2297-8747/30/6/129?utm_source=chatgpt.com "Optimization for Sustainability: A Comparative Analysis of Evolutionary Crossover Operators for the Traveling Salesman Problem (TSP) with a Case Study on Croatia | MDPI"
[8]: https://www.sciencedirect.com/science/article/abs/pii/S2210650211000691?utm_source=chatgpt.com "Memetic algorithms and memetic computing optimization: A literature review - ScienceDirect"
[9]: https://www.sciencedirect.com/science/article/pii/S0045782501003231?utm_source=chatgpt.com "Theoretical and numerical constraint-handling techniques used with evolutionary algorithms: a survey of the state of the art - ScienceDirect"
[10]: https://www.sciencedirect.com/science/article/pii/S1574013709000379?utm_source=chatgpt.com "A survey of repair methods used as constraint handling techniques in evolutionary algorithms - ScienceDirect"
[11]: https://www.sciencedirect.com/science/article/abs/pii/S0022519305802528?utm_source=chatgpt.com "Genetic algorithms and evolution - ScienceDirect"
[12]: https://www.sciencedirect.com/science/article/pii/B9780080506845500082?utm_source=chatgpt.com "A Comparative Analysis of Selection Schemes Used in Genetic Algorithms - ScienceDirect"
[13]: https://ieeexplore.ieee.org/document/294849/?utm_source=chatgpt.com "Genetic algorithms: a survey | IEEE Journals & Magazine | IEEE Xplore"
[14]: https://books.google.com/books?vid=ISBN978-0-201-15767-3&utm_source=chatgpt.com "Genetic Algorithms in Search, Optimization, and Machine Learning - David Edward Goldberg - Google Books"
