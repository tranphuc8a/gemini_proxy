Đúng, **Beam Search** là một thuật ngữ rất phổ biến, nhưng nó hơi “lệch hệ” so với các chương trước của cậu. Nó xuất hiện trong **AI search, scheduling, combinatorial optimization, NLP, speech recognition**, và đặc biệt hữu ích khi ta có **không gian nghiệm dạng cây** nhưng không đủ thời gian để duyệt toàn bộ cây.

Tôi đã rà lại nguồn gốc và các hướng dùng Beam Search trong AI/Operations Research. Điểm đáng chú ý là Beam Search **không đơn thuần là một metaheuristic kiểu SA/GA/ILS/VNS**; đúng hơn, nó là một **heuristic tree-search framework**, sau đó được đưa rất mạnh vào optimization và có thể hybridize với các metaheuristic khác. Một survey gần đây về matheuristics cũng xếp Beam Search vào nhóm phương pháp tìm kiếm gần với Branch-and-Bound và ghi nhận nguồn gốc của nó từ AI trước khi chuyển sang scheduling và các bài toán tối ưu tổ hợp. ([Springer][1])

# 12. Beam Search

## 12.1. Ý tưởng cốt lõi

Hãy bắt đầu từ một vấn đề rất quen thuộc.

Giả sử ta cần xây dựng một nghiệm từng bước:

```text
                    Root
                  /  |  \
                 A   B   C
                /|\ /|\ /|\
               ... ... ... ...
```

Nếu mỗi trạng thái có trung bình `b` lựa chọn và nghiệm cần `d` bước, số node có thể lên tới:

$$
1+b+b^2+\cdots+b^d=O(b^d)
$$

Đây chính là vấn đề của **BFS/exhaustive search**.

Beam Search đưa ra một ý tưởng cực kỳ đơn giản:

> **Không cần giữ tất cả các trạng thái ở mỗi tầng. Chỉ giữ lại W trạng thái tốt nhất.**

`W` được gọi là:

$$
\boxed{\text{beam width}}
$$

Ví dụ:

```text
Depth 0:

                 S
              /  |  \
             A   B   C

đánh giá:
A = 80
B = 60
C = 20

Beam width W = 2

=> giữ A, B
=> loại C
```

Sau đó:

```text
Depth 1:

          A             B
        / | \         / | \
       A1 A2 A3      B1 B2 B3

đánh giá tất cả:

A1 = 75
A2 = 91
A3 = 50
B1 = 88
B2 = 40
B3 = 85

Top 2:
A2 = 91
B1 = 88

=> giữ A2, B1
```

Rồi tiếp tục.

Đó chính là Beam Search.

Một mô tả kinh điển của Beam Search là **BFS nhưng cắt chiều rộng xuống còn `W` node ở mỗi level**. ([Wikipedia][2])

---

# 12.2. Beam Search nằm ở đâu trong hệ thống các thuật toán tìm kiếm?

Đây là phần rất quan trọng vì nó giúp nối chương 12 với các chương trước.

Ta có:

```text
                    Tree Search
                       │
        ┌──────────────┼──────────────┐
        │              │              │
       DFS             BFS        Best-First
        │              │              │
      W = 1          W = ∞       chọn node tốt nhất
                                      │
                                      │ giới hạn width
                                      ▼
                                Beam Search
```

Có thể hình dung:

| Thuật toán    | Bao nhiêu node được giữ? | Chiến lược              |
| ------------- | -----------------------: | ----------------------- |
| DFS           |            1 nhánh chính | đi sâu                  |
| BFS           |                   tất cả | đi theo tầng            |
| Best-First    |             frontier lớn | luôn chọn node tốt nhất |
| Beam Search   |          **W node/tầng** | BFS + pruning           |
| Greedy Search |  gần như 1 node tốt nhất | cực kỳ tham lam         |
| A*            |       frontier + `f=g+h` | có tính toán bound      |

Một cách nhìn rất đẹp là:

$$
\boxed{\text{DFS} \approx \text{Beam Search với }W=1}
$$

và:

$$
\boxed{\text{BFS} \approx \text{Beam Search với }W=\infty}
$$

Một số tài liệu optimization cũng sử dụng chính cách nhìn này. ([DOI][3])

Nhưng cần cẩn thận: **DFS không hoàn toàn đồng nhất với mọi biến thể Beam Search**, vì cơ chế ưu tiên và traversal có thể khác. Đây là một trực giác về `beam width`, không phải một định nghĩa toán học tuyệt đối.

---

# 12.3. Vì sao Beam Search nhanh?

Giả sử:

* branching factor = \(b\)
* depth = \(d\)
* beam width = \(W\)

BFS có thể phải giữ:

$$
O(b^d)
$$

node.

Beam Search chỉ giữ khoảng:

$$
O(W)
$$

node ở mỗi tầng.

Mỗi tầng:

$$
W \times b
$$

successors được sinh ra, sau đó chọn ra `W` node tốt nhất.

Do đó số node được mở rộng xấp xỉ:

$$
\boxed{O(dWb)}
$$

nếu `W`, `b` được xem là tham số giới hạn.

Đây chính là trade-off cơ bản:

$$
\boxed{
\text{Beam Width}
\quad\Longleftrightarrow\quad
\text{Time/Memory}
\quad\Longleftrightarrow\quad
\text{Solution Quality}
}
$$

Beam width càng lớn:

```text
W = 1
   ↓
ít tính toán
nhiều pruning
dễ bỏ mất nghiệm tốt
```

Trong khi:

```text
W = 1000
   ↓
nhiều tính toán
ít pruning
khám phá rộng hơn
```

Beam Search vì vậy không đảm bảo completeness hoặc optimality nói chung, bởi một node có vẻ kém ở tầng hiện tại có thể dẫn đến nghiệm cực tốt ở tầng sau nhưng đã bị loại vĩnh viễn. ([ScienceDirect][4])

---

# 12.4. Điều thực sự quan trọng: Evaluation Function

Đây mới là **linh hồn của Beam Search**.

Không phải:

> "Giữ W node đầu tiên."

Mà là:

> **Giữ W node có triển vọng tốt nhất theo một evaluation function.**

Giả sử bài toán maximization:

$$
F(s)
$$

là score của partial solution \(s\).

Ta giữ:

$$
Beam_t =
\operatorname{TopW}\{F(s):s\in Children(Beam_{t-1})\}
$$

Đây là công thức cốt lõi của Beam Search.

---

# 12.5. Nhưng đánh giá partial solution thế nào?

Đây là nơi Beam Search trở nên thú vị.

Giả sử đang giải TSP.

Ta có partial route:

```text
A → C → D
```

Score hiện tại có thể là:

$$
g(s)=-cost(s)
$$

Nhưng chỉ nhìn cost hiện tại chưa đủ.

Ví dụ:

```text
A → C → D
cost = 30

A → B → E
cost = 20
```

Nếu chỉ nhìn hiện tại, ta sẽ thích:

```text
A → B → E
```

Nhưng phần còn lại có thể khiến nó trở thành:

```text
A → B → E → F → G → A
cost = 300
```

trong khi:

```text
A → C → D → F → G → A
cost = 100
```

Do đó ta thường muốn:

$$
f(s)=g(s)+h(s)
$$

trong bài toán minimization.

Trong đó:

* \(g(s)\): cost đã phát sinh
* \(h(s)\): estimate cost còn lại

Đây lập tức liên hệ Beam Search với **A***.

---

# 12.6. Beam Search vs A*

Đây là một điểm rất đáng học.

### A*

A* sử dụng:

$$
f(n)=g(n)+h(n)
$$

và ưu tiên node có `f` tốt nhất.

Nếu heuristic \(h\) admissible và thỏa các điều kiện thích hợp, A* có thể đảm bảo optimality.

### Beam Search

Beam Search thêm một constraint:

> "Dù node có triển vọng thế nào, tôi chỉ cho phép tối đa W node sống ở mỗi level."

Nói cách khác:

```text
A*
    ↓
frontier có thể rất lớn
    ↓
Beam Search
    ↓
ép frontier xuống W
```

Vì pruning này có thể loại bỏ cả node dẫn đến nghiệm tối ưu nên Beam Search thông thường **hy sinh guarantee để đổi lấy bounded computation**. ([MIT Press Direct][5])

---

# 12.7. Một ví dụ cực kỳ quan trọng

Giả sử cây:

```text
                         S
                  /      |      \
                 A       B       C
                / \     / \     / \
               A1 A2   B1 B2   C1 C2
```

Score:

```text
A = 90
B = 80
C = 70

A1 = 91
A2 = 90

B1 = 89
B2 = 88

C1 = 200
C2 = 10
```

Beam width:

$$
W=2
$$

Tầng 1:

```text
A = 90
B = 80
C = 70
```

Giữ:

```text
A, B
```

Loại:

```text
C
```

Nhưng:

```text
C → C1 = 200
```

là nghiệm tốt nhất!

Beam Search **không bao giờ nhìn thấy C1**.

Đây là bản chất của Beam Search:

$$
\boxed{
\text{Pruning is irreversible}
}
$$

Một node bị loại thì hậu duệ của nó cũng biến mất khỏi search tree.

---

# 12.8. Đây có phải Greedy Algorithm không?

**Có liên quan rất gần, nhưng không nên đồng nhất.**

Greedy:

```text
chọn 1 lựa chọn tốt nhất
→ tiếp tục
→ chọn 1 lựa chọn tốt nhất
```

Beam Search:

```text
chọn W lựa chọn tốt nhất
→ mở rộng tất cả W
→ chọn W tốt nhất
→ tiếp tục
```

Ví dụ:

```text
Greedy:

             A
             ↓
             A1
             ↓
             A1x
```

Beam Search:

```text
             A       B       C
             ↓       ↓
            A1      B1
             ↓       ↓
            A1x     B1x
```

Do đó:

$$
\boxed{\text{Greedy Search = Beam Search với }W=1}
$$

theo cách nhìn beam-width.

Beam Search thêm một lượng **diversification** rất nhỏ so với greedy bằng cách giữ nhiều candidate song song.

---

# 12.9. Beam Search khác Beam Width với Population như thế nào?

Đây là chỗ rất dễ nhầm với GA/VNS/ILS.

Beam Search duy trì:

$$
\boxed{\text{set of partial solutions}}
$$

Ví dụ:

```text
Beam:

S1
S2
S3
S4
S5
```

Nhưng chúng có một vai trò đặc biệt:

> **Tất cả đều là các trạng thái ở cùng một độ sâu của search tree.**

Trong GA:

```text
Population:

P1
P2
P3
P4
P5
```

có thể trải rộng trên nhiều vùng của solution space và sinh thế hệ mới bằng crossover/mutation.

Beam Search thì:

```text
Depth t:
S1 S2 S3 S4 S5

        ↓ expand

Depth t+1:
S1'
S2'
S3'
...
```

Nó là **frontier của một search process**, không phải population tiến hóa.

---

# 12.10. Standard Beam Search

Pseudo-code:

```cpp
BeamSearch(initial)
{
    beam = {initial};

    while (!beam.empty()) {

        candidates = {};

        for (state : beam) {
            for (next : Expand(state)) {
                candidates.push_back(next);
            }
        }

        beam = TopW(candidates);

        if (HasCompleteSolution(beam))
            ...
    }

    return BestSolutionFound;
}
```

Nếu:

```text
beam width = W
branching factor = B
```

thì mỗi iteration tạo tối đa:

$$
W\times B
$$

candidate.

Sau đó:

```text
W × B
   ↓
 evaluate
   ↓
 sort/select
   ↓
 W
```

---

# 12.11. Một implementation C++ đơn giản

Ví dụ abstract:

```cpp
struct State {
    int score;
    bool complete;

    // dữ liệu partial solution
};

bool better(const State& a, const State& b) {
    return a.score > b.score;
}

State beamSearch(State start, int W) {

    vector<State> beam;
    beam.push_back(start);

    State best = start;

    while (!beam.empty()) {

        vector<State> candidates;

        for (const State& s : beam) {

            if (s.complete) {
                if (better(s, best))
                    best = s;

                continue;
            }

            auto children = expand(s);

            for (const State& child : children) {
                candidates.push_back(child);

                if (better(child, best))
                    best = child;
            }
        }

        if (candidates.empty())
            break;

        sort(candidates.begin(),
             candidates.end(),
             better);

        if ((int)candidates.size() > W)
            candidates.resize(W);

        beam.swap(candidates);
    }

    return best;
}
```

Nhưng implementation thực tế thường **không sort toàn bộ** `W×B` candidate. Có thể dùng:

* priority queue,
* partial sort,
* `nth_element`,
* bounded heap,

để chỉ lấy top `W`.

Đặc biệt khi:

$$
W\times B \gg W
$$

thì việc chọn top-W trở thành một phần đáng kể của runtime.

---

# 12.12. Beam Search trong Optimization

Đây mới là phần quan trọng đối với curriculum của cậu.

Trong optimization, ta thường biến bài toán thành:

$$
\text{Solution}
=
\text{sequence of decisions}
$$

Ví dụ:

### Scheduling

```text
Schedule
   ↓
chọn job 1
   ↓
chọn job 2
   ↓
chọn job 3
   ↓
...
```

### TSP

```text
A
 ↓
A → C
 ↓
A → C → F
 ↓
A → C → F → B
 ↓
...
```

### Knapsack

```text
item 1: take / skip
item 2: take / skip
item 3: take / skip
...
```

### Vehicle Routing

```text
Depot
 ↓
customer A
 ↓
customer C
 ↓
customer F
 ...
```

### Air Conditioner

Cũng hoàn toàn có thể:

```text
Initial
   ↓
chọn house #1
   ↓
chọn house #2
   ↓
chọn house #3
   ↓
...
```

Mỗi node là một **partial schedule**.

Beam Search sẽ giữ lại:

```text
Beam width = 20

20 partial schedules
        ↓
mỗi schedule thử thêm house
        ↓
~20 × candidate_count states
        ↓
đánh giá
        ↓
giữ 20 tốt nhất
```

Đây là một cách rất tự nhiên để áp dụng Beam Search vào bài toán của cậu.

---

# 12.13. Beam Search cho Air Conditioner Challenge

Ta thử thiết kế.

Giả sử mỗi state:

```cpp
struct State {
    Schedule schedule;

    bool used[N];

    int curDay;
    int curTime;

    int score;
};
```

Ta xây schedule từng bước.

Ví dụ:

```text
State 1:
Day 1:
A → C → F

State 2:
Day 1:
B → D → E

State 3:
Day 1:
A → D → G

...
```

Beam width:

```text
W = 50
```

Mỗi state thử các house tiếp theo:

```text
State 1
 ├── add H1
 ├── add H2
 ├── add H3
 └── ...

State 2
 ├── add H1
 ├── add H4
 ├── add H7
 └── ...

...
```

Sau đó đánh giá tất cả.

---

# 12.14. Nhưng score hiện tại chưa đủ tốt

Giả sử:

```text
State A:
score = 1,000,000
time = 700

State B:
score = 900,000
time = 300
```

Nếu chỉ nhìn:

$$
score(A)>score(B)
$$

ta giữ A.

Nhưng B còn rất nhiều thời gian để phục vụ những house giá trị cao.

Vì vậy evaluation function nên có dạng:

$$
F(s)
=
\text{currentScore}(s)
+
\text{estimatedFutureGain}(s)
$$

Ví dụ:

$$
F(s)
=
Score(s)
+
\lambda\cdot Potential(s)
$$

Trong đó:

* `Score(s)` = điểm hiện tại
* `Potential(s)` = ước lượng điểm có thể kiếm thêm
* \(\lambda\) = mức độ coi trọng tương lai.

Đây là tư duy cực kỳ quan trọng:

> **Beam Search không mạnh vì nó giữ nhiều nghiệm. Nó mạnh khi evaluation function biết nghiệm nào có “tiềm năng”.**

---

# 12.15. Evaluation Function tốt hơn

Có thể xây:

$$
F(s)
=
S_{\text{current}}
+
\alpha P_{\text{remaining}}
-
\beta T_{\text{wasted}}
$$

Ví dụ:

$$
P_{\text{remaining}}
=
\sum_{i\in Unserved}
\max(0,gPrice_i-\text{estimated travel/service penalty})
$$

Hoặc dùng một heuristic kiểu:

$$
\frac{\text{expected gain}}{\text{additional time}}
$$

Tức:

$$
\boxed{
F(s)
=
Score(s)
+
\lambda
\sum_{i}
\frac{\text{value}_i}{\text{time}_i}
}
$$

Đây chính là nơi Beam Search bắt đầu kết hợp với **Greedy heuristic**.

---

# 12.16. Beam Search + Greedy

Một kỹ thuật rất tự nhiên:

```text
Greedy:
    chỉ giữ 1 candidate tốt nhất

Beam Search:
    giữ W candidate tốt nhất

Beam + Greedy:
    candidate được sinh theo greedy heuristic
    rồi Beam Search giữ top-W
```

Ví dụ:

```text
candidate priority =
    price / extra_time
```

Ta không cần thử toàn bộ 200–400 house theo mọi thứ tự.

Có thể chỉ lấy:

```text
top 20–50 promising houses
```

làm branching candidates.

Khi đó:

$$
B \ll N
$$

và Beam Search trở nên rất nhanh.

---

# 12.17. Một vấn đề rất quan trọng: Diversity

Có một failure mode khác.

Giả sử:

```text
Beam width = 10
```

Sau một vài tầng:

```text
S1
S2
S3
...
S10
```

nhưng tất cả đều gần như giống nhau:

```text
A → B → C → ...
A → B → D → ...
A → B → E → ...
A → B → F → ...
...
```

Beam Search đã mất **diversification**.

Tất cả beam đang tập trung vào cùng một vùng.

Nếu vùng đó là bad basin:

```text
              Search Space

       ┌───────────────┐
       │               │
       │   Beam →      │
       │   local bad   │
       │   region      │
       └───────────────┘

       good region
          bị bỏ qua
```

Đây là một điểm Beam Search khá giống các metaheuristic mà ta đã học:

$$
\boxed{\text{Intensification vs Diversification}}
$$

Khái niệm này là một trong những trục phân tích quan trọng của metaheuristics. ([Dcs Sheffield][6])

---

# 12.18. Diversity-aware Beam Search

Do đó có thể sửa evaluation:

$$
F(s)
=
Quality(s)
+
\lambda Diversity(s)
$$

Ví dụ:

```text
candidate       score       similarity
A               100         0.99
B                99         0.98
C                98         0.50
D                97         0.20
```

Thay vì:

```text
A B C D
```

theo score đơn thuần, ta có thể ưu tiên:

```text
A C D ...
```

để beam khám phá nhiều vùng hơn.

Đây là nơi Beam Search có thể bắt đầu kết hợp tư tưởng của:

* GRASP
* VNS
* ILS
* genetic algorithms
* tabu/diversification

và thực tế Beam Search đã được hybridize với nhiều heuristic/metaheuristic khác. ([ScienceDirect][7])

---

# 12.19. Filtered Beam Search

Một biến thể lịch sử rất quan trọng là **Filtered Beam Search**.

Ow và Morton nghiên cứu Beam Search cho scheduling từ cuối những năm 1980 và đề xuất Filtered Beam Search, trong đó sử dụng priority/evaluation functions để tìm kiếm nhiều solution path song song nhưng hạn chế số node cần giữ. Các thí nghiệm của họ cho thấy phương pháp này có thể tạo nghiệm gần tối ưu với search tree tương đối nhỏ. ([Taylor & Francis Online][8])

Ý tưởng trực quan:

```text
              candidates
                  │
        ┌─────────┴─────────┐
        │                   │
   obvious bad          promising
        │                   │
      discard              keep
                            │
                     beam selection
```

Tức không nhất thiết:

> generate toàn bộ → sort → lấy W

mà có thể có **filter trước** để giảm lượng candidate cần xử lý.

---

# 12.20. Beam Search và Branch-and-Bound

Đây là một kết nối rất đẹp với **Chapter 3 – Exact Search**.

Branch-and-Bound:

```text
             root
          /    |    \
         A     B     C
        /|\   /|\   /|\
       ...
```

dùng:

$$
\text{bound}
$$

để chứng minh:

> "Nhánh này chắc chắn không thể tốt hơn incumbent."

Nếu đúng:

$$
bound(s)\le best
$$

thì prune **an toàn**.

---

Beam Search:

```text
giữ top W
loại phần còn lại
```

Nhưng không cần chứng minh rằng những node bị loại là vô vọng.

Do đó:

$$
\boxed{
Branch\&Bound:
\text{pruning có chứng minh}
}
$$

còn:

$$
\boxed{
Beam Search:
\text{pruning heuristic}
}
$$

Đây là khác biệt cực kỳ quan trọng.

Một bài nghiên cứu scheduling mô tả Beam Search như một biến thể của Branch-and-Bound trong đó chỉ một phần node được tiếp tục mở rộng. ([ScienceDirect][9])

---

# 12.21. Beam Search và Exact Search

Ta có:

```text
Exact Search
     │
     ├── DFS
     ├── BFS
     ├── Branch & Bound
     └── A*
             │
             │ bỏ guarantee bằng pruning
             ▼
        Beam Search
```

Vì Beam Search prune heuristic nên:

$$
\boxed{\text{Beam Search là approximate search}}
$$

chứ không phải exact algorithm trong trường hợp tổng quát. Một survey về matheuristics cũng phân loại Beam Search như một approximation/matheuristic vì nó không hoàn tất quá trình tìm kiếm mà Branch-and-Bound vốn sẽ thực hiện. ([Springer][1])

---

# 12.22. Beam Search và Dynamic Programming

Đây là một connection rất đáng nhớ với Chapter 2.

DP thường có:

$$
dp[state]
$$

và giữ **best value cho mỗi state**.

Beam Search lại giữ:

$$
\{s_1,s_2,\ldots,s_W\}
$$

ở mỗi level.

Nếu nhiều partial solutions có cùng abstract state:

```text
S1 ─┐
S2 ─┼──> State X
S3 ─┘
```

thì có thể **merge** chúng.

Đây là tư tưởng:

$$
\boxed{\text{Beam Search + state merging} \approx \text{approximate DP}}
$$

Đặc biệt hữu ích trong scheduling, sequence optimization, routing và NLP.

---

# 12.23. Beam Search trong NLP

Có một lý do cậu thấy thuật ngữ này cực kỳ phổ biến: **NLP/generative sequence decoding**.

Ví dụ mô hình đang sinh:

```text
"I"
```

có xác suất:

```text
am       0.5
like     0.2
want     0.1
...
```

Nếu beam width = 3:

```text
"I am"
"I like"
"I want"
```

Sau đó mỗi câu lại sinh tiếp:

```text
"I am happy"
"I am here"
"I am ..."
"I like ..."
"I like ..."
"I want ..."
```

rồi lại giữ top 3.

Đây chính là Beam Search.

Một paper TACL về Beam Search mô tả nó là phiên bản **pruned BFS**, rất phổ biến cho decoding trong machine translation và structured prediction; paper này cũng phân tích các biến thể như Best-First Beam Search và A*-Beam Search. ([MIT Press Direct][5])

---

# 12.24. Tại sao NLP thích Beam Search?

Sequence space tăng cực nhanh.

Nếu vocabulary có:

$$
V=50,000
$$

và câu dài:

$$
L=20
$$

thì số sequence:

$$
50,000^{20}
$$

là khổng lồ.

Không thể enumerate.

Greedy:

$$
W=1
$$

quá dễ bị mắc sai lầm.

Beam Search:

$$
W=5,10,50,100
$$

cho phép giữ một số hypothesis song song.

Đó là sweet spot:

```text
Greedy
   │
   │ quá hẹp
   ▼
Beam Search
   │
   │ vừa đủ rộng
   ▼
Exact Search
   │
   │ quá đắt
```

---

# 12.25. Beam Width có ý nghĩa gì về mặt search?

Đây là một cách rất hay để tư duy:

$$
W
=
\text{exploration budget per depth}
$$

Ví dụ:

### W = 1

```text
●
│
●
│
●
│
●
```

gần greedy.

### W = 5

```text
●
├─●
├─●
├─●
├─●
└─●
```

khám phá 5 hypotheses.

### W = 100

```text
       ~ 100 states
             ↓
       ~ 100 states
             ↓
       ~ 100 states
```

gần exhaustive hơn nhưng tốn tài nguyên.

Do đó `beam width` là một **computational budget**, chứ không đơn thuần là hyperparameter.

---

# 12.26. Beam Search có hội tụ không?

Không theo nghĩa thông thường của SA/VNS/ILS.

Nó không có:

```text
temperature
tabu tenure
acceptance probability
neighborhood descent
```

Thay vào đó nó có:

```text
search tree
      +
evaluation function
      +
beam width
      +
pruning
```

Nếu search space hữu hạn và depth hữu hạn thì nó kết thúc.

Nhưng:

$$
\boxed{\text{Không có guarantee rằng nghiệm cuối là optimum}}
$$

trừ khi beam width đủ lớn để không thực hiện pruning có hại hoặc có thêm cơ chế exact/bound phù hợp.

---

# 12.27. Một taxonomy rất hữu ích

Ta có thể phân loại các thuật toán đã học như sau:

```text
              SEARCH / OPTIMIZATION
                      │
       ┌──────────────┴──────────────┐
       │                             │
   Solution-based                Tree-based
       │                             │
       ├── Local Search              ├── DFS
       ├── SA                        ├── BFS
       ├── Tabu                      ├── Branch & Bound
       ├── ILS                       ├── A*
       ├── VND                       └── Beam Search
       ├── VNS
       └── GRASP
```

Điểm đặc biệt:

> **Beam Search nằm giữa classical search và heuristic optimization.**

Nó không thực sự giống ILS/VNS về cơ chế.

---

# 12.28. So sánh với các chương trước

| Algorithm       | Search object         | Diversification | Intensification | Có pruning?  |
| --------------- | --------------------- | --------------- | --------------- | ------------ |
| Greedy          | 1 solution            | rất thấp        | cao             | implicit     |
| Local Search    | 1 solution            | thấp            | cao             | không        |
| SA              | 1 solution            | cao             | cao             | không        |
| ILS             | local optima          | vừa/cao         | cao             | không        |
| VNS             | local optima          | cao             | cao             | không        |
| GRASP           | nhiều restart         | cao             | cao             | construction |
| GA              | population            | cao             | vừa             | selection    |
| **Beam Search** | **partial solutions** | **vừa**         | **cao**         | **rất mạnh** |
| Branch & Bound  | search tree           | —               | —               | **exact**    |

Đây là lý do Beam Search rất khác những chương 5–11.

---

# 12.29. Một insight rất quan trọng: Beam Search là "parallel greedy"

Nếu phải nhớ **một câu duy nhất** về Beam Search, tôi sẽ chọn:

> **Beam Search = Greedy Search nhưng không chỉ tin vào một tương lai duy nhất.**

Greedy:

$$
s_{t+1}
=
\arg\max_{s\in Children(s_t)}F(s)
$$

Beam:

$$
Beam_{t+1}
=
Top_W\left(
\bigcup_{s\in Beam_t}Children(s)
\right)
$$

Sự khác biệt nằm đúng ở đây.

Greedy:

$$
\boxed{1\rightarrow1\rightarrow1\rightarrow1}
$$

Beam:

$$
\boxed{W\rightarrow W\rightarrow W\rightarrow W}
$$

---

# 12.30. Nhưng Beam Search vẫn rất greedy

Điều này cũng cực kỳ quan trọng.

Giả sử:

```text
W = 10
```

Ở depth 5, một state xếp hạng 11 sẽ bị loại.

Không quan trọng rằng:

```text
depth 6 → cực tốt
depth 7 → cực tốt
depth 8 → optimal
```

Nó vẫn chết ở depth 5.

Vì vậy Beam Search mang tính:

$$
\boxed{\text{greedy + bounded lookahead}}
$$

và **không có khả năng quay lại** những nhánh đã prune trong phiên bản chuẩn.

---

# 12.31. Best-First Beam Search

Một biến thể đáng biết.

Standard Beam Search thường tổ chức theo level:

```text
depth 0
   ↓
depth 1
   ↓
depth 2
   ↓
depth 3
```

Best-First Beam Search thay đổi cách ưu tiên expansion, dùng score thay vì chỉ ưu tiên depth. Nghiên cứu TACL năm 2020 xây dựng một framework thống nhất cho BFS, best-first, A*, Beam Search và các biến thể beam bằng cách thay đổi priority, stopping criterion, beam size và heuristic. ([MIT Press Direct][5])

Tư tưởng:

```text
Standard Beam:

process depth 1
process depth 2
process depth 3

Best-First Beam:

process state có score tốt nhất
→ bất kể depth
```

Điều này cho phép tận dụng tài nguyên tốt hơn trong một số bài toán.

---

# 12.32. Beam Search + Local Search

Đây là hybrid rất tự nhiên với curriculum của cậu.

Thay vì:

```text
Beam
 ↓
Beam
 ↓
Beam
 ↓
solution
```

ta làm:

```text
Beam
 ↓
Beam
 ↓
Beam
 ↓
local search từng solution
 ↓
improved beam
```

Ví dụ:

```text
             Beam
        /      |      \
      S1       S2      S3
      ↓        ↓       ↓
     LS       LS      LS
      ↓        ↓       ↓
     S1'      S2'     S3'
```

Đây là một dạng **hybrid metaheuristic**.

Literature về combinatorial optimization có một xu hướng lớn là hybridize các search techniques thay vì coi mỗi metaheuristic như một hệ độc lập. ([ScienceDirect][7])

---

# 12.33. Beam Search + VND

Đặc biệt hợp với những gì cậu vừa học.

```text
Beam Search
      ↓
top W solutions
      ↓
     VND
      ↓
top W local optima
      ↓
expand
      ↓
...
```

Ta có:

$$
\boxed{\text{Beam Search}+\text{VND}}
$$

Một pipeline khá mạnh:

```text
                 Beam Search
                      │
          ┌───────────┼───────────┐
          ↓           ↓           ↓
         S1          S2          S3
          ↓           ↓           ↓
         VND         VND         VND
          ↓           ↓           ↓
         S1'         S2'         S3'
          └───────────┼───────────┘
                      ↓
                 Select Top W
```

Đây là một ví dụ điển hình cho tư tưởng **intensification sau diversification**.

---

# 12.34. Beam Search + ILS

Cũng có thể:

```text
Beam
 ↓
ILS mỗi candidate
 ↓
best local optimum
 ↓
Beam selection
```

hoặc ngược lại:

```text
Beam construction
 ↓
best solution
 ↓
ILS
```

Nhưng lúc này ta phải tự hỏi:

> Beam Search còn đóng vai trò gì nếu ILS đã làm phần lớn công việc?

Đây là một bài học quan trọng trong thiết kế metaheuristic:

$$
\boxed{\text{Không phải cứ ghép nhiều thuật toán là tốt}}
$$

Mỗi component phải giải quyết một điểm yếu khác nhau.

---

# 12.35. Một architecture rất mạnh cho bài AC

Nếu áp dụng toàn bộ những gì cậu đã học:

```text
                    Initial
                       │
                       ▼
               Greedy Construction
                       │
                       ▼
                 Beam Search
                 W = 20~100
                       │
             ┌─────────┼─────────┐
             │         │         │
             ▼         ▼         ▼
            S1        S2        S3
             │         │         │
             └──── VND / LS ─────┘
                       │
                       ▼
                  Top W states
                       │
                       ▼
                     ILS
                       │
                       ▼
                    VNS
                       │
                       ▼
                   Best Score
```

Nhưng với constraint **100 ms/test**, architecture này có thể quá nặng nếu implement naïve.

Do đó phải sử dụng:

* candidate list;
* incremental score;
* delta evaluation;
* compact state representation;
* bounded heap;
* tránh copy toàn bộ schedule;
* chỉ local-search top vài beam states;
* beam width nhỏ và adaptive.

---

# 12.36. Adaptive Beam Width

Không nhất thiết:

$$
W=\text{constant}
$$

Có thể:

$$
W(t)
$$

thay đổi theo search depth.

Ví dụ:

```text
depth 1   → W = 100
depth 2   → W = 100
depth 3   → W = 50
depth 4   → W = 30
depth 5   → W = 20
```

Hoặc ngược lại:

```text
early:
    W nhỏ

later:
    W lớn
```

tùy cấu trúc bài toán.

Có thể điều chỉnh theo:

* số candidate;
* diversity;
* improvement rate;
* remaining time;
* search depth.

---

# 12.37. Anytime Beam Search

Một đặc điểm rất hữu ích trong programming contest / optimization challenge:

Beam Search có thể trả về **best solution found so far** bất cứ lúc nào.

```text
start
 │
 │ best = S
 ▼
beam iteration
 │
 │ best = S'
 ▼
beam iteration
 │
 │ best = S''
 ▼
TIME LIMIT
 │
 ▼
return best
```

Do đó nó rất hợp với:

> "Có 100 ms, hãy kiếm được nghiệm tốt nhất có thể."

Nếu còn 90 ms:

```text
W = 100
```

Nếu còn 10 ms:

```text
W = 10
```

Nếu còn 1 ms:

```text
greedy finish
```

Đây là tư duy **anytime algorithm** rất hữu ích cho challenge của cậu.

---

# 12.38. Beam Search có phải Metaheuristic không?

Câu trả lời tốt nhất là:

> **Tùy cách phân loại, nhưng không nên xem nó là metaheuristic cùng loại với SA/GA/ILS/VNS.**

Beam Search ban đầu là heuristic search trong AI; sau đó được sử dụng rộng rãi trong optimization, đặc biệt scheduling. Literature hiện đại cũng xem nó như một heuristic/matheuristic có thể hybridize với các metaheuristic khác. ([Springer][1])

Nói chính xác hơn:

$$
\boxed{
\text{Beam Search}
=
\text{heuristic tree-search framework}
}
$$

còn:

$$
\boxed{
\text{SA, Tabu, ILS, VNS}
=
\text{metaheuristic search frameworks}
}
$$

Hai nhóm có thể **kết hợp với nhau**.

---

# 12.39. Lịch sử ngắn

Beam Search có nguồn gốc đáng chú ý từ **AI/speech recognition**. Bruce Lowerre phát triển hệ thống HARPY tại Carnegie Mellon và luận án năm 1976 mô tả việc chỉ tìm kiếm một số ít các path tốt song song thay vì toàn bộ không gian path. CMU mô tả HARPY là hệ thống tìm kiếm chỉ một số path cú pháp và âm học tốt nhất song song để xác định path tối ưu. ([csd.cmu.edu][10])

Sau đó Beam Search được chuyển mạnh sang Operations Research, đặc biệt scheduling. Công trình của Ow và Morton năm 1988 là một mốc quan trọng trong việc nghiên cứu có hệ thống Beam Search cho scheduling và phát triển **Filtered Beam Search**. ([Taylor & Francis Online][8])

Từ đó nó xuất hiện trong:

* single-machine scheduling;
* job-shop scheduling;
* flow-shop scheduling;
* routing;
* production planning;
* sequence optimization;
* speech recognition;
* machine translation;
* neural sequence decoding.

Các nghiên cứu scheduling sau này tiếp tục sử dụng Beam Search cho những bài toán mà exact solver không thể xử lý hiệu quả ở kích thước lớn. ([ScienceDirect][11])

---

# 12.40. Bức tranh tổng thể của chương 12

Tôi muốn cậu ghi nhớ architecture này:

```text
                   Search Tree
                       │
              Generate successors
                       │
                       ▼
                 Evaluate nodes
                       │
                       ▼
                 ┌───────────┐
                 │  Top W    │
                 │  states   │
                 └─────┬─────┘
                       │
                       ▼
                    Expand
                       │
                       ▼
                 Evaluate again
                       │
                       ▼
                    Top W
                       │
                      ...
```

Công thức toán học:

$$
\boxed{
B_{t+1}
=
Top_W
\left(
\bigcup_{s\in B_t}Children(s)
\right)
}
$$

với:

$$
B_0=\{s_0\}
$$

và cuối cùng:

$$
\boxed{
s^*=\arg\max_{s\in \cup_t B_t^{complete}}f(s)
}
$$

cho maximization.

Đây gần như là **định nghĩa toán học ngắn gọn nhất của Beam Search**.

---

# 12.41. Điều quan trọng nhất cần phân biệt

Sau 11 chương, tôi nghĩ có 5 câu này là đáng nhớ nhất:

### Greedy

> **Chọn một tương lai tốt nhất.**

$$
W=1
$$

### Beam Search

> **Giữ một số tương lai tốt nhất.**

$$
W>1
$$

### BFS

> **Giữ tất cả tương lai.**

$$
W=\infty
$$

### Branch & Bound

> **Loại tương lai khi có thể chứng minh chúng không thắng được.**

### A*

> **Ưu tiên tương lai dựa trên cost đã đi + cost ước lượng còn lại.**

Và Beam Search:

$$
\boxed{
\text{BFS}
+
\text{heuristic pruning}
+
\text{bounded width}
}
$$

---

# 12.42. Beam Search trong roadmap của chúng ta

Nếu đặt tất cả các chương vừa học cạnh nhau:

```text
Greedy
   │
   ├── chỉ 1 hướng
   │
   ▼
Exact Search
   │
   ├── khám phá rất rộng
   │
   ▼
Beam Search
   │
   ├── nhiều hướng
   ├── nhưng giới hạn W
   └── heuristic pruning
   │
   ▼
Local Search
   │
   └── cải thiện nghiệm hoàn chỉnh
   │
   ▼
VND / VNS
   │
   └── nhiều neighborhood
   │
   ▼
ILS
   │
   └── perturbation + LS
```

Vì vậy Beam Search **không phải phiên bản nâng cấp của VNS/ILS**. Nó giải một vấn đề khác:

> **Khi đang xây dựng nghiệm từng bước, thay vì cam kết vào một partial solution duy nhất, hãy giữ một “beam” gồm nhiều partial solutions tốt nhất.**

Đây là một ý tưởng rất mạnh trong các bài toán mà **construction sequence** tự nhiên và branching factor lớn.

---

## Mental model cuối cùng

Nếu hình dung solution space là một khu rừng:

```text
Greedy
   ↓
chọn 1 con đường
━━━━━━━━━━━━━━━━━━►

Beam Search
   ↓
giữ 20 con đường
━━━━━━━━━━━━━━━━━━►
━━━━━━━━━━━━━━━━━━►
━━━━━━━━━━━━━━━━━━►
━━━━━━━━━━━━━━━━━━►
        ...
━━━━━━━━━━━━━━━━━━►

BFS
   ↓
đi gần như mọi con đường
━━━━━━━━━━━━━━━━━━►
━━━━━━━━━━━━━━━━━━►
━━━━━━━━━━━━━━━━━━►
━━━━━━━━━━━━━━━━━━►
...
```

Và câu quan trọng nhất:

$$
\boxed{
\textbf{Beam Search = search nhiều khả năng song song, nhưng cắt bỏ phần lớn chúng ở mỗi tầng.}
}
$$

**Điểm khó thực sự của Beam Search không nằm ở thuật toán `Top-W`; nó nằm ở việc thiết kế `evaluation function` đủ tốt để những nhánh đáng giá không bị prune quá sớm.** Đây cũng là lý do Beam Search rất phù hợp để nối **Greedy + heuristic + DP/state representation + Local Search/VND** thành một solver thực tế.

### Tài liệu nền đáng đọc

* Ow & Morton, **Filtered Beam Search in Scheduling** (1988) — một trong những công trình kinh điển đưa Beam Search vào Operations Research. ([Taylor & Francis Online][8])
* Sabuncuoglu & Bayiz, **Job Shop Scheduling with Beam Search** — nghiên cứu ứng dụng Beam Search cho job-shop scheduling và đặt nó trong quan hệ với Branch-and-Bound. ([ScienceDirect][9])
* Meister et al., **Best-First Beam Search** — rất hữu ích để hiểu Beam Search từ góc nhìn thống nhất với BFS, Best-First và A*. ([MIT Press Direct][5])
* Survey về **matheuristics** — giúp định vị Beam Search trong hệ thống optimization hiện đại. ([Springer][1])

**Chương tiếp theo hợp lý sau Beam Search** là đi sâu vào **Branch-and-Bound / A* / Beam Search dưới cùng một framework**, vì lúc đó cậu sẽ thấy rất rõ rằng chúng thực chất khác nhau chủ yếu ở **evaluation, priority và pruning policy**. Đây là phần sẽ làm kiến thức Chapter 3 (Exact Search) + Chapter 12 kết nối lại thành một hệ thống thống nhất.

[1]: https://link.springer.com/article/10.1007/s10479-024-06302-z?utm_source=chatgpt.com "Contemporary approaches in matheuristics an updated survey | Annals of Operations Research | Springer Nature Link"
[2]: https://en.wikipedia.org/wiki/Beam_search?utm_source=chatgpt.com "Beam search"
[3]: https://doi.org/10.1016/j.cor.2026.107429?utm_source=chatgpt.com "Stochastic production–distribution planning with transportation mode-dependent lead times - ScienceDirect"
[4]: https://www.sciencedirect.com/science/article/abs/pii/S0020019013002391?utm_source=chatgpt.com "Incremental Beam search - ScienceDirect"
[5]: https://direct.mit.edu/tacl/article/doi/10.1162/tacl_a_00346/96473/Best-First-Beam-Search?utm_source=chatgpt.com "Best-First Beam Search | Transactions of the Association for Computational Linguistics | MIT Press"
[6]: https://staffwww.dcs.shef.ac.uk/people/R.K.Moore/research/progress--prospects-in.html?utm_source=chatgpt.com "Progress & Prospects in Speech Technology | Prof. Roger K. Moore | Roger K Moore"
[7]: https://www.sciencedirect.com/science/article/pii/S1568494611000962?utm_source=chatgpt.com "Hybrid metaheuristics in combinatorial optimization: A survey - ScienceDirect"
[8]: https://www.tandfonline.com/doi/abs/10.1080/00207548808947840?utm_source=chatgpt.com "Filtered beam search in scheduling‡: International Journal of Production Research: Vol 26, No 1"
[9]: https://www.sciencedirect.com/science/article/pii/S0377221798003191?utm_source=chatgpt.com "Job shop scheduling with beam search - ScienceDirect"
[10]: https://csd.cmu.edu/academics/doctoral/degrees-conferred/bruce-lowerre?utm_source=chatgpt.com "Bruce Lowerre | Carnegie Mellon University Computer Science Department"
[11]: https://www.sciencedirect.com/science/article/pii/S0305054816300776?utm_source=chatgpt.com "A beam search heuristic for scheduling a single machine with release dates and sequence dependent setup times to minimize the makespan - ScienceDirect"
