# Chương 16 — Hybrid / Matheuristics

Đây là chương cuối cùng, và xét toàn bộ lộ trình thì nó thực sự nên đứng ở đây.

Từ Chương 1 đến Chương 14, ta chủ yếu học cách **xây dựng các cơ chế tìm kiếm**. Chương 15 đưa vào **mathematical optimization**: LP, MIP, CP, Column Generation, Branch & Cut, Benders. Chương 16 ghép hai thế giới đó lại:

$$
\boxed{
\text{Heuristic / Metaheuristic}
+
\text{Mathematical Optimization}
}
$$

Nhưng cần tránh một hiểu lầm ngay từ đầu:

> **Hybrid metaheuristic** và **matheuristic** không hoàn toàn đồng nghĩa.

"Hybrid metaheuristic" là khái niệm rộng: có thể ghép SA + Tabu, GA + VNS, ACO + CP, v.v. Còn **matheuristic** nhấn mạnh việc mathematical programming/model đóng vai trò trung tâm hoặc được dùng như một thành phần có hệ thống để tạo nghiệm heuristic. Các survey gần đây cũng nhấn mạnh rằng matheuristic không phải một thuật toán đơn lẻ mà là một **conceptual framework** để thiết kế heuristic dựa trên mathematical model. ([Springer][1])

Đây cũng là lĩnh vực đã phát triển đáng kể: survey cập nhật năm 2024 của Boschetti & Maniezzo ghi nhận gần 200 công trình có tham chiếu trực tiếp tới matheuristics chỉ trong khoảng hai năm trước đó. ([Springer][1])

---

# 1. Tại sao cần Hybrid?

Hãy đặt cạnh nhau hai thế giới mà ta vừa học.

## Metaheuristic

Ví dụ:

* Local Search
* SA
* Tabu
* ILS
* VNS
* LNS
* ALNS
* GA

Ưu điểm:

$$
\boxed{\text{search rộng, linh hoạt, nhanh, dễ thích nghi}}
$$

Nhưng nhược điểm:

$$
\boxed{\text{thường không có certificate về optimality}}
$$

---

## Mathematical Optimization

Ví dụ:

* LP
* MIP
* CP
* Branch & Cut
* Column Generation
* Benders

Ưu điểm:

$$
\boxed{
\text{exploit cấu trúc toán học + bounds + exactness}
}
$$

Nhưng:

$$
\boxed{
\text{có thể cực kỳ đắt khi instance lớn}
}
$$

Đây là lý do hybrid rất hấp dẫn:

```text id="c48p7m"
         Metaheuristic
         ┌─────────────┐
         │ exploration │
         │ diversity   │
         │ flexibility │
         └──────┬──────┘
                │
                │ cooperate
                │
         ┌──────▼──────┐
         │ Mathematical│
         │ Optimization│
         └─────────────┘
            structure
            bounds
            exact local optimization
```

Mục tiêu không phải làm cho thuật toán "to hơn".

Mục tiêu là:

> **Dùng đúng công cụ cho đúng tầng của bài toán.**

---

# 2. Matheuristic thực sự là gì?

Một định nghĩa rất hữu ích từ survey 2024:

> Matheuristics là các framework sử dụng mathematical programming để thu được nghiệm heuristic chất lượng cao; framework đủ tổng quát để áp dụng cho nhiều bài toán khi được thích nghi với model tương ứng. ([Springer][1])

Một định nghĩa thực dụng hơn:

$$
\boxed{
\text{Matheuristic}
=
\text{heuristic search}
+
\text{mathematical programming component}
}
$$

Từ đó có một insight:

> Không cần mathematical model phải giải **toàn bộ bài toán**.

Nó có thể chỉ giải:

* một neighborhood;
* một subproblem;
* một repair;
* một construction step;
* một feasibility problem;
* một restricted model.

Đây chính là nơi sức mạnh của hybrid xuất hiện.

---

# 3. Hybrid không nhất thiết là "hai thuật toán chạy cạnh nhau"

Có ba mức kết hợp rất khác nhau.

## Mức 1 — Sequential

```text id="0aq40n"
Heuristic
   ↓
MIP
   ↓
Local Search
```

Các thuật toán chạy nối tiếp.

---

## Mức 2 — Cooperative / intertwined

```text id="x8x5nb"
Metaheuristic ─────► MIP
      ▲               │
      └───────────────┘
```

Hai thành phần trao đổi thông tin trong quá trình chạy.

---

## Mức 3 — Integrative

Một thuật toán nằm **bên trong** thuật toán kia:

```text id="93mkxq"
ALNS
 ├── Destroy
 ├── MIP Repair
 └── VND
```

hoặc:

```text id="4m26ag"
MIP Branch-and-Bound
 └── Metaheuristic primal heuristic
```

Taxonomy của Jourdan, Basseur & Talbi phân biệt đặc biệt giữa cooperative hybrid, sequential/parallel-intertwined execution và integrative hybrid; trong đó integrative có thể là exact nằm trong metaheuristic hoặc metaheuristic nằm trong exact algorithm. ([ScienceDirect][2])

---

# 4. Đây là một taxonomy rất quan trọng

Ta có thể phân loại:

```text id="8x52dr"
Hybrid Optimization
│
├── Metaheuristic + Metaheuristic
│
├── Metaheuristic + Exact
│   │
│   ├── Sequential
│   ├── Parallel
│   └── Intertwined
│
└── Integrative
    │
    ├── Exact inside Heuristic
    │
    └── Heuristic inside Exact
```

Trong chương này, trọng tâm là nhánh:

$$
\boxed{
\text{Metaheuristic}+\text{Mathematical Optimization}
}
$$

---

# 5. Nguyên tắc vàng của hybrid

Không phải:

> "Mỗi thuật toán làm một ít."

Mà phải hỏi:

> **Thuật toán nào giỏi việc gì?**

Ví dụ:

| Component    | Sở trường                         |
| ------------ | --------------------------------- |
| Greedy       | construction nhanh                |
| Local Search | cải thiện cục bộ                  |
| SA           | diversification                   |
| VNS          | thay đổi neighborhood             |
| LNS          | phá cấu trúc lớn                  |
| ALNS         | học cách perturb                  |
| LP           | bound / continuous optimization   |
| MIP          | discrete optimization             |
| CP           | propagation / logical constraints |
| CG           | huge variable space               |
| Benders      | decomposable structure            |

Hybrid tốt là hybrid trong đó các component **bù trừ nhau**.

---

# 6. Mẫu hybrid quan trọng nhất: Exact Search trong Metaheuristic

Đây là ý tưởng cực kỳ tự nhiên sau những gì ta vừa học.

Giả sử Local Search có:

$$
N(S)
$$

một neighborhood rất lớn.

Thay vì duyệt heuristic:

$$
S'\in N(S),
$$

ta dựng một MIP nhỏ để giải:

$$
\boxed{
\arg\min_{S'\in N(S)}f(S')
}
$$

theo nghĩa exact hoặc bounded-time.

Đây là:

> **exact large-neighborhood search**.

Survey VLSN kinh điển cũng chỉ ra một ý tưởng tương tự: neighborhood có thể rất lớn nhưng vẫn hữu ích nếu có một cơ chế hiệu quả để tìm kiếm nó, chẳng hạn bằng network flow, dynamic programming hoặc các phương pháp giải bài toán con. ([ScienceDirect][3])

---

# 7. Đây chính là bridge tới LNS

Chương 13:

$$
LNS=
Destroy\rightarrow Repair
$$

Bây giờ thay `Repair` bằng MIP:

$$
\boxed{
LNS + MIP
}
$$

Ta có:

```text id="9gb5gl"
Current solution
      ↓
Destroy
      ↓
freeze most variables
      ↓
release subset
      ↓
solve MIP subproblem
      ↓
new solution
```

Nếu subproblem được giải đến optimum:

$$
S'=
\arg\min_{x\in N(S)}f(x)
$$

thì ta đang **tối ưu chính neighborhood bằng mathematical programming**.

Đây là một trong những dạng matheuristic quan trọng nhất.

---

# 8. Very Large-Scale Neighborhood Search

VLSN xuất hiện từ trước thuật ngữ matheuristic và là một ý tưởng cực kỳ quan trọng.

Thông thường:

$$
|N(S)|=O(n^2)
$$

với swap chẳng hạn.

VLSN cho phép:

$$
|N(S)|\gg n^2
$$

hoặc thậm chí exponential.

Nhưng ta không enumerate tất cả.

Một neighborhood lớn có thể được mô tả bằng một bài toán con.

---

## Ví dụ

Thay vì:

```text id="h8n6m3"
try swap(i,j)
try swap(i,k)
try swap(j,k)
...
```

ta nói:

> "Cho phép tối đa 20 biến thay đổi; hãy tìm tổ hợp thay đổi tốt nhất."

Đó có thể trở thành một MIP.

Do đó:

$$
\boxed{
Neighborhood
\rightarrow
Mathematical\ Model
}
$$

---

# 9. Local Branching

Đây là một matheuristic kinh điển và rất đáng học kỹ.

Ý tưởng của Fischetti & Lodi:

> Dùng một MIP solver như công cụ "tactical" để exact-search trong neighborhood do một framework bên ngoài kiểm soát. Họ tạo neighborhood bằng **local branching cuts**. ([ResearchGate][4])

Giả sử solution hiện tại có binary vector:

$$
x^*.
$$

Định nghĩa:

$$
N(x^*)=
\left\{
x:
\sum_{i:x_i^*=0}x_i+
\sum_{i:x_i^*=1}(1-x_i)
\le k
\right\}.
$$

Ý nghĩa:

> nghiệm mới khác nghiệm hiện tại ở nhiều nhất \(k\) binary decisions.

Nếu:

$$
k=5
$$

thì chỉ cho phép thay đổi tối đa 5 binary variables.

---

# 10. Local Branching chính là Local Search + MIP

Đây là một connection rất đẹp:

```text id="4a2e3e"
Local Search:

current S
   ↓
neighborhood N(S)
   ↓
best neighbor
```

Local Branching:

```text
current S
   ↓
construct local branching constraint
   ↓
MIP solves N(S) exactly
   ↓
best neighbor
```

Vậy:

$$
\boxed{
Local\ Branching =
Local\ Search
+
MIP\ neighborhood\ optimization
}
$$

---

# 11. Sau khi tìm xong neighborhood

Có hai khả năng.

### Có solution tốt hơn

Ta di chuyển:

$$
S\leftarrow S'.
$$

Sau đó tạo neighborhood mới.

### Không có solution tốt hơn

Ta có thể tăng:

$$
k
$$

để mở rộng neighborhood.

Ví dụ:

```text id="pl4mvk"
k=5
 ↓
no improvement
 ↓
k=10
 ↓
no improvement
 ↓
k=20
 ↓
...
```

Đây rất gần tư duy VNS.

---

# 12. Fix-and-Optimize

Đây là một trong những matheuristic thực dụng nhất.

Giả sử MIP có binary variables:

$$
x_1,\dots,x_n.
$$

Ta giữ nghiệm hiện tại:

$$
x^*.
$$

Chỉ "thả" một subset:

$$
F\subseteq\{1,\dots,n\}.
$$

Các biến ngoài \(F\) được fix:

$$
x_i=x_i^*,
\qquad i\notin F.
$$

Sau đó solve MIP:

$$
\boxed{
\min f(x)
}
$$

với chỉ những biến trong \(F\) được tối ưu lại.

Helber & Sahling áp dụng đúng ý tưởng này: giải một chuỗi MIP con, trong đó chỉ một subset nhỏ của binary setup variables còn được quyết định; các binary khác được cố định theo nghiệm từ iteration trước. ([ScienceDirect][5])

---

# 13. Fix-and-Optimize như Sliding Window

Một ví dụ kinh điển là time-indexed model.

Giả sử:

$$
t=1,\dots,30.
$$

Ta chọn window:

$$
[t,t+w-1].
$$

Ví dụ:

```text id="bi8s4p"
Days:

1 2 3 4 5 6 7 8 9 10 ... 30
|---------|
  optimize
```

Các ngày ngoài window:

```text
fixed
```

Sau đó dịch:

```text id="izs7ey"
        |---------|
        optimize
```

rồi:

```text
          |---------|
          optimize
```

Do đó:

$$
\boxed{
Fix\&Optimize =
Sliding\ MIP\ Neighborhood
}
$$

---

# 14. Fix-and-Optimize cực gần VND

Hãy nhìn:

### VND

```text id="e7m4cl"
N1
 ↓
N2
 ↓
N3
 ↓
...
```

### Fix-and-Optimize

```text id="h4ysqb"
window 1
 ↓
window 2
 ↓
window 3
 ↓
...
```

Nếu mỗi window được coi là một neighborhood:

$$
N_1,N_2,N_3,\dots
$$

thì fix-and-optimize chính là một loại **mathematical neighborhood search**.

Một số nghiên cứu còn kết hợp trực tiếp Fix-and-Optimize với VNS/VNDS. ([ScienceDirect][6])

---

# 15. Tại sao Fix-and-Optimize mạnh?

Bởi vì nó cho phép thay đổi nhiều quyết định **đồng thời**.

Local Search:

```text id="frp5ui"
change x5
→ evaluate
change x7
→ evaluate
change x12
→ evaluate
```

Fix-and-Optimize:

```text id="7gj38j"
free:
x5,x7,x12,x18,x25,...

        ↓

MIP jointly optimizes all
```

Nó có thể phát hiện **combination improvement** mà single-move local search không thấy.

---

# 16. RINS — Relaxation Induced Neighborhood Search

Một ý tưởng rất đẹp khác.

Ta có:

* incumbent integer solution \(x^I\);
* LP relaxation solution \(x^L\).

Nếu:

$$
x_i^I=x_i^L
$$

thì hai nghiệm đồng ý về variable đó.

RINS tận dụng sự đồng ý này để fix variables.

Ý tưởng:

$$
x_i=
x_i^I
$$

cho những biến mà LP và incumbent cùng nhất trí, rồi solve một MIP nhỏ hơn trên phần còn lại.

Do đó:

```text id="2amf3k"
             LP relaxation
                   │
                   │ compare
                   ▼
Current integer ────────► common variables
                              │
                              ▼
                           FIX them
                              │
                              ▼
                         smaller MIP
```

RINS thuộc nhóm primal heuristics của MIP và là một ví dụ đặc biệt đẹp của việc dùng **thông tin relaxation để định nghĩa neighborhood**.

---

# 17. Đây là insight rất sâu

Chúng ta từng nói:

$$
LP\ relaxation
\rightarrow
Bound.
$$

Nhưng bây giờ LP còn được dùng để:

$$
\boxed{
\text{guide heuristic search}
}
$$

Tức là LP không chỉ nói:

> "Optimum tốt nhất có thể là bao nhiêu?"

nó còn nói:

> "Những variables nào có vẻ ổn định / đáng giữ?"

Đây là một bước chuyển rất quan trọng.

---

# 18. Feasibility Pump

Đây là một matheuristic khác, nhưng mục tiêu hơi khác.

Thay vì tối ưu objective thật ngay, mục tiêu đầu tiên là:

$$
\boxed{
\text{find a feasible integer solution}
}
$$

Fischetti, Glover & Lodi đề xuất Feasibility Pump dựa trên việc luân phiên giữa:

* điểm feasible đối với continuous relaxation;
* điểm gần integer/rời rạc.

Ở mỗi bước giải một optimization problem để đưa điểm LP gần điểm integer hiện tại rồi làm tròn, sau đó lại tìm điểm continuous gần điểm đã round. ([Nghiên cứu UNIPD][7])

Hình dung:

```text id="u5f6nr"
LP world                         Integer world

    ●  x^LP
     \ 
      \ minimize distance
       \
        ●
         \
          ● x^I
```

Rồi quay lại.

Đó là một kiểu **alternating projection / heuristic correction**.

---

# 19. Feasibility Pump khác Local Branching

### Feasibility Pump

Mục tiêu:

$$
\boxed{\text{feasibility}}
$$

trước.

### Local Branching

Mục tiêu:

$$
\boxed{\text{improve objective locally}}
$$

### Fix-and-Optimize

Mục tiêu:

$$
\boxed{\text{optimize restricted variable neighborhood}}
$$

Ba cái đều dùng mathematical programming nhưng vai trò hoàn toàn khác nhau.

---

# 20. Diving Heuristics

Diving cũng xuất phát từ MIP.

Ta có LP relaxation:

$$
x_1=0.8,\quad x_2=0.3,\quad x_3=0.6.
$$

Thay vì branch cả hai phía:

```text id="9rbsso"
x1=0
x1=1
```

ta chọn một variable và **fix một hướng**:

$$
x_1=1.
$$

Giải LP/MIP tiếp.

Rồi:

$$
x_2=0
$$

tiếp.

Cứ thế:

```text id="z2c1bh"
LP relaxation
      ↓
fix variable
      ↓
re-solve
      ↓
fix variable
      ↓
re-solve
      ↓
...
      ↓
integer solution
```

Survey của Boschetti & Maniezzo mô tả diving heuristics đúng như một họ heuristic liên tục cố định variables về integer values cho đến khi đạt một feasible MIP solution. ([Wiley Online Library][8])

---

# 21. Dạng "heuristic search guided by LP"

Đây là một pattern rất quan trọng:

$$
\boxed{
Relaxation
\rightarrow
Guide
\rightarrow
Fix
\rightarrow
Search
}
$$

Ta đã thấy nó ở:

* RINS;
* diving;
* feasibility pump;
* rounding;
* kernel search.

---

# 22. Kernel Search

Kernel Search là một matheuristic thuần túy dựa trên MIP.

Ý tưởng:

1. dùng LP relaxation hoặc một heuristic để xác định một tập variables "hứa hẹn";
2. gọi tập đó là **kernel**;
3. phần còn lại chia thành các **buckets**;
4. lần lượt đưa bucket vào kernel;
5. solve restricted MIP để cải thiện solution. ([Cris Unibo][9])

Ví dụ:

```text id="0s3foh"
1000 binary variables

LP relaxation
      ↓
top promising variables
      ↓
Kernel = 100 variables

Remaining:
Bucket 1 = 100
Bucket 2 = 100
...
Bucket 9 = 100
```

Sau đó:

```text id="ysv2oe"
Kernel
+ Bucket 1
→ MIP

Kernel
+ Bucket 2
→ MIP

...
```

---

# 23. Kernel Search có mental model rất đẹp

Nó nói:

> "Không giải toàn bộ MIP ngay. Hãy xác định vùng có triển vọng rồi tăng dần vùng đó."

Do đó:

$$
\boxed{
Huge\ MIP
\rightarrow
promising\ kernel
\rightarrow
incremental\ expansion
}
$$

Nó rất gần:

* beam search;
* VLSN;
* restricted master;
* large neighborhood.

---

# 24. Kernel Search vs Column Generation

Hai cái nhìn khá giống nhau:

### Column Generation

```text id="0vvurj"
start small
→ add promising columns
→ add promising columns
```

### Kernel Search

```text id="n7p4c5"
start with promising variables
→ add promising buckets
→ add promising variables
```

Nhưng khác nhau:

|             | Column Generation      | Kernel Search      |
| ----------- | ---------------------- | ------------------ |
| Cơ chế chọn | reduced cost / pricing | heuristic/kernel   |
| Guarantee   | có thể exact cho LP    | chủ yếu heuristic  |
| Đối tượng   | columns                | decision variables |
| Master      | restricted master      | restricted MIP     |

---

# 25. Decomposition-Based Matheuristics

Chương 15 ta học:

* Lagrangian decomposition;
* Dantzig–Wolfe / Column Generation;
* Benders.

Chương này ta dùng chúng **heuristically**.

Một decomposition exact có thể trở thành matheuristic bằng cách:

* dừng sớm;
* hạn chế subproblem;
* sử dụng heuristic subproblem;
* fix variables;
* chỉ sinh một phần cuts/columns;
* dùng decomposition để tạo incumbent.

Maniezzo, Boschetti & Stützle dành riêng một phần cho decomposition-based heuristics, xem Lagrangian, Dantzig–Wolfe và Benders như các nguồn để xây dựng những matheuristic framework. ([Cris Unibo][10])

---

# 26. Lagrangian Matheuristic

Giả sử:

$$
\min f(x)
$$

subject to:

$$
g(x)\le0.
$$

Ta relax constraint vào objective:

$$
L(x,\lambda)
=
f(x)+\lambda g(x).
$$

Thay vì bắt buộc constraint ngay:

$$
g(x)\le0,
$$

ta phạt violation.

Giải:

$$
\min_x L(x,\lambda).
$$

Nếu subproblem dễ hơn rất nhiều, ta dùng nó để:

* lấy bound;
* tạo candidate;
* hướng search.

Đây là một ví dụ rất đẹp của:

$$
\boxed{
Mathematical\ relaxation
\rightarrow
Heuristic
}
$$

---

# 27. Matheuristic không nhất thiết cần Metaheuristic

Điểm này quan trọng.

Tên "matheuristic" thường khiến người ta nghĩ:

$$
MIP + ALNS
$$

nhưng không nhất thiết.

Có thể:

$$
\boxed{
MIP\ based\ heuristic
}
$$

mà không có GA, SA, VNS.

Ví dụ:

* Kernel Search;
* Fix-and-Optimize;
* Diving;
* Relax-and-Fix;
* local branching.

Đó là lý do survey gần đây coi matheuristics là một **framework/concept**, chứ không phải một metaheuristic cụ thể. ([Springer][11])

---

# 28. Relax-and-Fix

Đây là counterpart rất quan trọng của Fix-and-Optimize.

Suppose binary variables được chia:

$$
X_1,X_2,\dots,X_k.
$$

Iteration 1:

```text id="s1j7nq"
X1 = integer
X2,...,Xk = continuous
```

solve.

Sau đó fix:

$$
X_1=X_1^*.
$$

Iteration 2:

```text id="ol2y5u"
X1 = fixed
X2 = integer
X3,... = continuous
```

Lại solve.

Cứ vậy.

---

# 29. Relax-and-Fix vs Fix-and-Optimize

Đây là cặp phải nhớ.

### Relax-and-Fix

Dùng chủ yếu để:

$$
\boxed{
construct\ initial\ feasible\ solution
}
$$

Các variables dần dần được **integer hóa và cố định**.

---

### Fix-and-Optimize

Dùng chủ yếu để:

$$
\boxed{
improve\ an\ existing\ feasible\ solution
}
$$

Một subset được mở lại và optimize.

---

# 30. Minh họa

### Relax-and-Fix

```text id="v70mka"
[continuous][continuous][continuous][continuous]
      ↓
[INTEGER ][continuous][continuous][continuous]
      ↓
[INTEGER ][INTEGER  ][continuous][continuous]
      ↓
[INTEGER ][INTEGER  ][INTEGER  ][continuous]
      ↓
[INTEGER ][INTEGER  ][INTEGER  ][INTEGER ]
```

### Fix-and-Optimize

```text id="q9zv4a"
[FIXED][FIXED][FREE][FREE][FIXED][FIXED]
                    ↓
                 optimize

       slide window →

[FIXED][FREE][FREE][FIXED][FIXED][FIXED]
                    ↓
                 optimize
```

Rất khác nhau về mục đích.

---

# 31. Matheuristic mạnh nhất thường là "neighborhood optimization"

Đây có lẽ là insight quan trọng nhất của toàn chương.

Local Search nói:

> "Tìm hàng xóm tốt."

LNS nói:

> "Tạo neighborhood lớn hơn."

Matheuristic nói:

> **"Dùng một solver để tối ưu neighborhood đó."**

Vậy:

$$
\boxed{
Metaheuristic
=
define\ where\ to\ search
}
$$

và:

$$
\boxed{
Mathematical\ optimization
=
solve\ that\ region\ intelligently
}
$$

---

# 32. Đây là lý do LNS + MIP rất mạnh

Giả sử:

$$
n=1000.
$$

Toàn bộ MIP quá lớn.

Nhưng ALNS destroy:

$$
q=50.
$$

Ta cố định 950 variables/decisions.

MIP chỉ giải bài toán còn 50 variables tự do.

```text id="r7hrd1"
1000 variables
████████████████████████████

fix 950
█████████████████████▒▒▒

MIP solves 50-variable neighborhood
                       ↑
                    exact core
```

Đây là:

$$
\boxed{
Huge\ global\ search
+
Small\ exact\ optimization
}
$$

Một pattern cực mạnh.

---

# 33. Exact inside Metaheuristic

Ta có thể tổng quát hóa:

```text id="s3z97o"
Metaheuristic
│
├── Generate neighborhood
│
├── MIP / CP / DP subproblem
│
├── Local Search
│
└── Acceptance
```

MIP không phải "solver cuối cùng".

Nó trở thành:

> **search operator**.

Đây là cách nhìn rất quan trọng.

---

# 34. Ngược lại: Metaheuristic inside MIP

Chiều ngược lại cũng quan trọng.

Một MIP solver có thể cần:

$$
\boxed{
good\ feasible\ solution
}
$$

càng sớm càng tốt.

Metaheuristic có thể cung cấp incumbent:

```text id="e7nffr"
MIP starts
   ↓
LP / Branch
   ↓
Metaheuristic finds 120
   ↓
incumbent = 120
   ↓
prune nodes with bound <= 120
```

Một incumbent tốt có thể giảm tree rất mạnh.

Do đó:

$$
\boxed{
heuristic\ solution
\rightarrow
MIP\ bound\ search
}
$$

---

# 35. Primal heuristic của MIP solver

Đây chính là lý do các MIP solver thực tế không chỉ là Branch-and-Cut.

Một solver như SCIP có hẳn nhiều cơ chế heuristic, branching, cut separation, pricing, propagation và Benders trong framework. ([Springer][12])

Feasibility Pump là ví dụ nổi tiếng: nó được thiết kế để nhanh chóng tìm feasible MIP solutions, và công trình gốc cho thấy heuristic này cạnh tranh đáng kể về tốc độ/chất lượng nghiệm đầu với solver đương thời trên benchmark của họ. ([Nghiên cứu UNIPD][7])

---

# 36. Vì sao incumbent tốt rất quan trọng?

Xét maximization.

Nếu:

$$
UB=1000
$$

và incumbent:

$$
LB=500
$$

thì:

$$
\text{gap rất lớn}.
$$

Nhưng nếu heuristic tìm được:

$$
LB=900,
$$

thì mọi node có:

$$
UB\le900
$$

có thể prune.

Do đó heuristic không cần chứng minh gì.

Nó chỉ cần:

$$
\boxed{
find\ good\ LB
}
$$

để giúp exact algorithm.

---

# 37. Matheuristic + MIP Warm Start

Đây là một kiến trúc thực tế:

```text id="5f1wq9"
Greedy
   ↓
Local Search
   ↓
ALNS
   ↓
good incumbent
   ↓
MIP solver
   ↓
prove / improve
```

Hoặc:

```text id="q2f273"
MIP
 ↓
partial solution
 ↓
ALNS
 ↓
better incumbent
 ↓
MIP
```

Đây là dạng cooperative hybrid.

---

# 38. Local Branching + Metaheuristic

Local branching còn hay hơn khi được điều khiển bởi metaheuristic.

Ví dụ:

```text id="6s3i9l"
ALNS decides neighborhood structure
             ↓
local branching defines exact region
             ↓
MIP solves region
             ↓
new solution
```

Có thể xem:

$$
\boxed{
ALNS = strategic layer
}
$$

$$
\boxed{
MIP = tactical optimizer
}
$$

Ý tưởng strategic/tactical này gần với cách Fischetti & Lodi mô tả Local Branching: external branching framework kiểm soát các search subspaces còn MIP solver thực hiện phần tactical optimization bên trong. ([ResearchGate][4])

---

# 39. VLSN + MIP

Nếu neighborhood rất lớn:

$$
|N(S)|=2^{100}
$$

ta không enumerate.

Ta xây MIP:

$$
M_N
$$

mà feasible solutions của nó chính là:

$$
N(S).
$$

Solve:

$$
\min M_N.
$$

Đây là exact neighborhood search.

---

# 40. LNS + CP

Không nhất thiết phải MIP.

Ví dụ scheduling:

```text id="38u1r3"
LNS
 ↓
destroy 20 jobs
 ↓
CP-SAT
 ↓
optimize/re-feasibilize
 ↓
new schedule
```

CP đặc biệt thích hợp nếu neighborhood chứa:

* precedence;
* no-overlap;
* cumulative;
* sequence constraints.

Đây là hybrid rất tự nhiên.

---

# 41. LNS + DP

Cũng có thể:

```text id="e9bkh9"
LNS
 ↓
release a route
 ↓
Dynamic Programming
 ↓
optimal route repair
```

Đây chính là VLSN bằng dynamic programming.

Một lần nữa ta thấy:

$$
\boxed{
"Exact" không nhất thiết = MIP.
}
$$

---

# 42. Beam Search + MIP

Ví dụ:

```text id="sy0s7r"
Beam Search
   ↓
produce top B partial solutions
   ↓
MIP solves completion
   ↓
evaluate
   ↓
keep best
```

Hoặc ngược lại:

```text id="qgrt7n"
MIP relaxation
      ↓
candidate states
      ↓
Beam Search
```

Đây là một ví dụ của hybrid giữa **state-space search** và **mathematical optimization**.

---

# 43. ALNS + MIP — kiến trúc cực mạnh

Bây giờ ghép Chương 14 + 15 + 16:

```text id="o4yxxr"
                    ALNS
                     │
             Adaptive Destroy
                     │
                     ▼
               Partial Solution
                     │
                     ▼
             ┌───────────────┐
             │ MIP / CP      │
             │ exact repair  │
             └───────┬───────┘
                     │
                     ▼
                    VND
                     │
                     ▼
                 Acceptance
                     │
                     ▼
                 Reward
                     │
                     ▼
              Update ALNS weights
```

Ở đây:

* ALNS quyết định **phá đâu**;
* MIP quyết định **xây tốt nhất có thể trong vùng đó**;
* VND làm **polishing**;
* acceptance giữ **diversity**.

Đây không còn là một heuristic đơn giản.

---

# 44. Matheuristic có thể có "exactness cục bộ"

Đây là khái niệm rất đáng nhớ.

Toàn bộ thuật toán:

$$
\text{không exact}.
$$

Nhưng mỗi iteration có thể:

$$
\boxed{
exactly\ optimize\ a\ restricted\ subproblem
}
$$

Do đó:

```text id="gsrywu"
Global search
   = heuristic

Local region
   = exact
```

Đây chính là điểm cân bằng:

$$
\boxed{
global\ flexibility
+
local\ mathematical\ rigor
}
$$

---

# 45. "Exact subproblem" không có nghĩa phải solve đến optimality

Có thể đặt:

$$
\text{TimeLimit}=100ms
$$

hoặc:

$$
gap\le5\%.
$$

Hoặc chỉ lấy first feasible solution.

Khi đó mathematical solver đóng vai trò:

$$
\boxed{
optimization\ engine
}
$$

chứ không phải exact oracle.

Đây là một insight thực tế rất quan trọng:

> **Matheuristic không phải lúc nào cũng cần exact optimization.**

Survey gần đây cũng phân loại các matheuristic trong đó exact methods có thể được dùng để giải một phần bài toán tối ưu hoặc **subproblem** theo cách exact hoặc approximate. ([ScienceDirect][13])

---

# 46. Mức độ "exactness"

Ta có thể tưởng tượng continuum:

```text id="6jkr4q"
Heuristic
    │
    ▼
heuristic subproblem
    │
    ▼
limited-time MIP
    │
    ▼
MIP with gap 1%
    │
    ▼
exact subproblem
    │
    ▼
global exact optimization
```

Matheuristic thường nằm ở giữa.

Đây là lý do nó rất phù hợp với bài toán thực tế.

---

# 47. Matheuristic và time budget

Giả sử có:

$$
T=100\text{ ms}.
$$

Thay vì:

```text id="q96vcf"
100ms MIP
```

ta có:

```text id="68c71u"
10ms construction
20ms ALNS
10ms VND
50ms MIP repair
10ms final polish
```

Hoặc adaptive:

```text id="7ck5eu"
search stagnates
→ give more time to MIP

search diversified
→ give more time to ALNS
```

Đây chính là **resource allocation among optimization components**.

---

# 48. Đây là một bài toán meta-optimization

Bây giờ phát sinh câu hỏi:

> Bao nhiêu thời gian cho heuristic?
>
> Bao nhiêu thời gian cho MIP?
>
> Neighborhood size bao nhiêu?
>
> MIP gap bao nhiêu?
>
> Khi nào chuyển phase?

Ví dụ:

$$
T_H+T_M=T.
$$

Ta phải chọn:

$$
T_H,\ T_M.
$$

Đây đã là một tầng optimization thứ hai.

---

# 49. Parameter tuning của hybrid

Có rất nhiều parameter:

$$
k
$$

local branching radius.

$$
q
$$

LNS destroy size.

$$
w
$$

fix-and-optimize window.

$$
\rho
$$

ALNS reaction factor.

$$
T
$$

SA temperature.

$$
g
$$

MIP gap.

$$
\tau
$$

MIP time limit.

Một thuật toán hybrid tốt không có nghĩa:

> "càng nhiều parameter càng mạnh."

Ngược lại, số parameter quá lớn có thể làm tuning trở thành bottleneck.

---

# 50. Adaptive hybridization

Một hướng hiện đại là **không chỉ adaptive operator mà adaptive cả solver component**.

Ví dụ:

```text id="v4x0lq"
Current state
    │
    ├── easy neighborhood → MIP
    │
    ├── hard neighborhood → greedy repair
    │
    ├── scheduling-heavy → CP
    │
    └── stagnation → large destroy
```

Tức là:

$$
\boxed{
Choose\ the\ optimization\ mechanism\ itself
}
$$

Đây là một bước tiến trên ALNS.

ALNS:

> chọn destroy/repair.

Adaptive matheuristic:

> chọn **chiến lược solver**.

---

# 51. Hybrid với Machine Learning

Đây không phải phần cốt lõi của chapter nhưng rất đáng biết.

Ta có thể dùng ML để dự đoán:

$$
P(\text{operator good}\mid state).
$$

Hoặc:

$$
P(\text{MIP useful}\mid neighborhood).
$$

Hoặc dự đoán:

$$
\text{which variables to fix}.
$$

Khi đó:

```text id="w91kpa"
Optimization state
      ↓
Machine Learning
      ↓
choose:
  operator
  neighborhood
  variables
  solver time
      ↓
Mathematical optimization
```

Đây là hướng "algorithm selection / automated optimization".

---

# 52. Hybridization theo problem structure

Một hybrid tốt thường dựa trên **cấu trúc bài toán**, không phải ghép ngẫu nhiên.

Ví dụ bài toán có:

```text id="0jqy08"
selection
+
routing
+
scheduling
```

thì có thể:

```text id="sr6z6o"
MIP → selection
ALNS → routing
CP → scheduling
```

Hoặc:

```text
Master MIP
   ↓
routing subproblem
   ↓
ALNS repair
```

Đây là nguyên tắc:

$$
\boxed{
Assign\ each\ structure\ to\ the\ method\ that\ handles\ it\ best.
}
$$

---

# 53. Hybridize by decomposition

Một trong những cách tự nhiên nhất:

$$
Problem = A+B+C.
$$

Ví dụ:

```text id="6f9n6y"
strategic
   │
   ▼
MIP

routing
   │
   ▼
ALNS

scheduling
   │
   ▼
CP
```

Đây là **algorithmic decomposition**.

---

# 54. Ví dụ production-routing

Ta đã thấy một nghiên cứu rất điển hình ở Chương 15: production + inventory + distribution.

Một phương pháp hai pha luân phiên giữa:

$$
\text{lot-sizing}
$$

và:

$$
\text{routing}
$$

để giải production-routing problem; các heuristic được sinh từ quá trình lặp giữa hai quyết định này và cho kết quả tốt hơn các phương pháp tham chiếu trong thực nghiệm. ([PubsOnline][14])

Đây là một pattern cực phổ biến:

```text id="h2k1t8"
Optimize A
   ↓
fix/update A
   ↓
Optimize B
   ↓
fix/update B
   ↓
repeat
```

Nó rất gần alternating optimization nhưng có thể được thiết kế heuristic.

---

# 55. Cooperative hybrid

Khác với integrative hybrid.

### Integrative

```text id="0g2v5r"
ALNS
 └── MIP
```

MIP nằm trong ALNS.

### Cooperative

```text id="a2q8f7"
ALNS ──► solution ──► MIP
ALNS ◄── bounds ───── MIP
```

Hai thuật toán vẫn tương đối độc lập.

Có thể chạy song song:

```text id="3b2f6n"
        ┌── ALNS ────┐
start ──┤            ├── best
        └── MIP ─────┘
```

rồi chia sẻ incumbent/bounds.

---

# 56. Parallel hybrid

Một kiến trúc đơn giản:

```text id="l24xmp"
                Instance
                   │
       ┌───────────┼───────────┐
       ↓           ↓           ↓
     ALNS         MIP          CP
       │           │           │
       └───────────┼───────────┘
                   ↓
               best solution
```

Đây là một **portfolio solver**.

Mỗi method thử một chiến lược khác nhau.

---

# 57. Portfolio ≠ Hybrid integrative

Portfolio:

$$
A_1,A_2,A_3
$$

chạy tương đối độc lập.

Hybrid:

$$
A_1\leftrightarrow A_2.
$$

Integrative:

$$
A_2\subset A_1.
$$

Phân biệt ba khái niệm này rất quan trọng.

---

# 58. Matheuristic cho bài toán kỹ thuật viên điều hòa

Bây giờ ta đưa toàn bộ curriculum vào bài toán "AC technician".

Ta có:

```text
300 houses
30 days
720 min/day
travel
cleaning
profit
overtime
```

Một architecture mạnh có thể là:

```text id="x4rcqf"
                     INITIAL
                       │
                 Greedy / MIP
                       │
                       ▼
                     ALNS
                       │
                 Adaptive Destroy
                       │
                       ▼
                  MIP Repair
                       │
                       ▼
                      VND
                 ┌─────┼─────┐
                 │     │     │
               swap relocate 2-opt
                 │     │     │
                 └─────┼─────┘
                       ▼
                    ACCEPT
                       │
                       ▼
                  update ALNS
```

Đây là một **full matheuristic**.

---

# 59. Nhưng ta còn có thể decomposition bài toán AC

### Option A — Master: assignment

Master quyết định:

$$
z_{i,d}.
$$

### Subproblem:

route từng ngày.

Có thể dùng:

$$
MIP/CP/DP
$$

cho routing.

---

### Option B — Master: selected houses

$$
x_i.
$$

Subproblem:

> khả năng schedule chúng trong 30 ngày.

---

### Option C — mỗi daily route là một column

Column Generation.

---

### Option D — ALNS quyết định destruction

MIP tối ưu phần bị destroy.

Bốn cách nhìn khác nhau trên **cùng một bài toán**.

---

# 60. Đây là lesson quan trọng nhất của toàn bộ chương 16

Một problem không có:

> **một thuật toán đúng duy nhất.**

Có:

$$
\boxed{
\text{different representations}
+
\text{different decompositions}
+
\text{different search mechanisms}
}
$$

Và hybrid cho phép ta chọn một architecture phù hợp với cấu trúc instance.

---

# 61. So sánh các matheuristic quan trọng

| Phương pháp             | Mathematical component    | Vai trò                     |
| ----------------------- | ------------------------- | --------------------------- |
| Relax-and-Fix           | MIP relaxation            | construction                |
| Fix-and-Optimize        | restricted MIP            | improvement                 |
| Local Branching         | MIP + local branching cut | exact neighborhood          |
| RINS                    | LP relaxation + MIP       | neighborhood from agreement |
| Feasibility Pump        | LP + rounding             | feasibility                 |
| Diving                  | LP/MIP                    | guided construction         |
| Kernel Search           | LP/MIP                    | restricted model expansion  |
| VLSN                    | MIP/DP/flow               | huge neighborhood           |
| Decomposition heuristic | Benders/Lagrangian/DW     | exploit structure           |
| ALNS + MIP              | MIP repair                | large neighborhood          |
| VNS + MIP               | MIP neighborhood sequence | structured local search     |

---

# 62. Fix-and-Optimize vs Local Branching vs RINS

Ba cái này rất dễ nhầm.

### Fix-and-Optimize

Người thiết kế quyết định:

$$
F=
\text{variables to free}.
$$

### Local Branching

Người thiết kế quyết định:

$$
d(x,x^*)\le k.
$$

Neighborhood được mô tả bằng **distance constraint**.

### RINS

Neighborhood được suy ra từ:

$$
x^I
\quad\text{và}\quad
x^{LP}.
$$

Tức là:

```text id="w0lcmq"
Fix&Optimize → structure-based neighborhood

Local Branching → distance-based neighborhood

RINS → relaxation-induced neighborhood
```

Đây là ba pattern cực kỳ quan trọng.

---

# 63. Một taxonomy sâu hơn

Ta có thể phân loại matheuristic theo **what is restricted**.

### Restrict variables

Fix-and-Optimize.

### Restrict distance from incumbent

Local Branching.

### Restrict variables based on relaxation

RINS / Kernel Search.

### Restrict time/window

Sliding-window MIP.

### Restrict constraints

Decomposition-based methods.

### Restrict candidate columns

Column-generation-inspired heuristic.

Đây là một cách phân loại rất hữu ích khi thiết kế thuật toán mới.

---

# 64. Exact method có thể cung cấp "knowledge"

Đây là một insight rất đẹp.

MIP/LP có thể trả về:

* incumbent;
* dual bound;
* reduced costs;
* fractional values;
* reduced cost;
* active constraints;
* infeasibility information.

Metaheuristic có thể dùng những thứ này để quyết định:

```text id="nku6k6"
what to fix
what to release
what to explore
which operator to choose
which variables are promising
```

Tức là:

$$
\boxed{
Mathematical\ optimization
\rightarrow
search\ information
}
$$

chứ không chỉ:

$$
\text{solution}.
$$

---

# 65. Metaheuristic cũng cung cấp knowledge cho MIP

Ngược lại:

* incumbent;
* variable fixing;
* branching priorities;
* warm start;
* candidate columns;
* feasible routes;
* good initial schedules.

Đây là:

$$
\boxed{
Heuristic
\rightarrow
MIP\ guidance
}
$$

Cho nên hybrid tốt thường là **hai chiều**.

---

# 66. Warm Start

Đây là cơ chế rất thực tế.

Nếu heuristic đã tìm:

$$
x^H
$$

ta đưa:

$$
x^H
$$

cho MIP solver làm incumbent/start.

Thay vì:

```text id="pudt8z"
MIP:
find first solution...
```

solver bắt đầu:

```text id="dyu5z3"
incumbent = x^H
```

và lập tức có primal bound.

Điều này đặc biệt hữu ích khi heuristic có thể tìm nghiệm tốt rất nhanh.

---

# 67. Heuristic được dùng ở đâu trong MIP tree?

Không nhất thiết chỉ ở root.

Ta có thể:

```text id="c8q1fl"
root
 ↓
branch
 ↓
node
 ↓
run heuristic
 ↓
improve incumbent
 ↓
prune many nodes
```

Do đó heuristic có thể được kích hoạt:

* ở root;
* tại các node sâu;
* khi node có tính chất nhất định;
* khi search stagnates.

---

# 68. Search control là vấn đề trung tâm

Khi xây hybrid, ta không chỉ hỏi:

> "Ghép A với B được không?"

Mà phải hỏi:

> **"Khi nào gọi A? Khi nào gọi B? Với input nào? Với output nào?"**

Đó chính là **control architecture**.

Ví dụ:

```text id="6f9d5m"
if stagnation > 100:
    call MIP repair

if gap < 5%:
    stop ALNS and intensify

if neighborhood large:
    use MIP

if neighborhood small:
    use greedy LS
```

Đây mới là phần khó của hybrid design.

---

# 69. Trigger-based hybridization

Một pattern rất thực dụng:

```text id="ou3m9v"
while time remains:

    run ALNS

    if improvement:
        continue

    if stagnation:
        MIP neighborhood search

    if MIP proves no improvement:
        enlarge neighborhood

    run VND

    continue
```

Ta không cần chạy MIP mỗi iteration.

Chỉ gọi khi nó **đáng tiền**.

---

# 70. Adaptive time allocation

Ví dụ:

$$
T=100s.
$$

Ban đầu:

$$
T_{ALNS}=80s,\quad T_{MIP}=20s.
$$

Nhưng nếu ALNS stagnates:

$$
T_{ALNS}\downarrow
$$

và:

$$
T_{MIP}\uparrow.
$$

Hoặc nếu MIP search tree tiến triển rất chậm:

$$
T_{MIP}\downarrow.
$$

Đây là một hướng thiết kế hybrid cao cấp.

---

# 71. Một vấn đề rất quan trọng: overhead

Hybrid không miễn phí.

Ví dụ:

```text id="v4g7nm"
ALNS → build MIP → solve MIP → extract solution
```

Nếu:

$$
\text{setup cost} > \text{search benefit}
$$

thì hybrid chậm hơn heuristic thuần túy.

Đặc biệt với instance nhỏ:

$$
MIP
$$

có thể giải thẳng trong thời gian ngắn, nên thêm ALNS chỉ làm phức tạp.

---

# 72. Khi nào hybrid là không đáng?

Nếu:

$$
MIP
$$

giải toàn bài toán trong 20ms:

> đừng cần ALNS.

Nếu:

$$
ALNS
$$

đã đạt đủ tốt trong 5ms:

> đừng cần MIP phức tạp.

Hybrid hữu ích khi:

$$
\boxed{
A\text{ và }B\text{ có complementary weaknesses}
}
$$

chứ không phải chỉ vì "hybrid thường mạnh hơn".

---

# 73. Over-engineering là rủi ro thực sự

Một architecture như:

```text
GA
 + SA
 + Tabu
 + VNS
 + ALNS
 + MIP
 + CP
 + Beam
 + Benders
```

không tự động tốt.

Có thể:

* quá nhiều parameter;
* overhead lớn;
* khó debug;
* khó reproduce;
* không biết component nào thực sự đóng góp.

Do đó:

$$
\boxed{
Hybridization\ should\ be\ justified\ by\ problem\ structure.
}
$$

---

# 74. Ablation Study

Khi nghiên cứu hybrid, phải hỏi:

> thành phần nào thực sự có tác dụng?

Ví dụ chạy:

```text id="znuq4e"
A = ALNS
B = ALNS + MIP
C = ALNS + MIP + VND
D = ALNS + CP
```

rồi so:

| Method | Avg objective | Time | Gap |
| ------ | ------------: | ---: | --: |
| A      |           100 |  10s |  8% |
| B      |           105 |  14s |  4% |
| C      |           108 |  16s |  2% |
| D      |           103 |  12s |  5% |

Từ đây mới biết:

> MIP thực sự đóng góp bao nhiêu?

Một paper hybrid tốt cần loại thực nghiệm này.

---

# 75. Không chỉ đo "best solution"

Phải đo:

* best;
* average;
* median;
* standard deviation;
* time to target;
* optimality gap;
* success rate;
* number of MIP calls;
* average MIP time;
* number of variables released;
* number of improvements per operator.

Đây là cách chứng minh hybrid không chỉ "may mắn".

---

# 76. Matheuristics hiện đại

Survey 2024 cho thấy lĩnh vực hiện tại không còn chỉ xoay quanh MIP + Local Search. Các hướng bao gồm:

* matheuristic hybrids;
* decomposition-based methods;
* MIP-based neighborhood search;
* automatic design;
* integration với các metaheuristic;
* và các framework mới dựa trên model/solver. ([Springer][1])

Một textbook chuyên biệt năm 2021 của Maniezzo, Boschetti & Stützle cũng chia matheuristics thành các nhóm như:

* single-solution hybrids;
* population-based hybrids;
* diving;
* VLSN;
* decomposition-based heuristics;
* corridor method;
* kernel search;
* fore-and-back. ([Springer][12])

Điều này cho thấy "Matheuristic" thực sự là một **hệ sinh thái**, không phải một thuật toán.

---

# 77. Corridor Method

Một ý tưởng rất đáng biết dù không cần đi sâu như Local Branching.

Ta có:

```text id="ym74yd"
Current solution
      ↓
define corridor
      ↓
restrict variables
      ↓
solve MIP
      ↓
new solution
```

Thay vì cho tất cả variables tự do, ta tạo một "corridor" quanh solution hoặc một cấu trúc được heuristic đề xuất.

Tư duy:

$$
\boxed{
don't optimize globally;
optimize inside a promising corridor
}
$$

Đây là một biến thể của restricted-space optimization và được trình bày như một matheuristic nguyên bản trong textbook 2021. ([Springer][12])

---

# 78. Fore-and-Back

Cũng là một pattern đáng nhớ:

```text id="e0ygl2"
forward
   ↓
restricted optimization
   ↓
solution
   ↓
backward
   ↓
re-optimize earlier decisions
```

Tư tưởng là không chỉ tiến một chiều mà quay lại các quyết định trước đó để sửa chúng.

Nó phản ánh một nguyên lý rất chung:

> **construct → optimize → revise → optimize again.**

Textbook Matheuristics 2021 đưa Fore-and-Back vào nhóm các "original matheuristics". ([Springer][12])

---

# 79. Matheuristic nhìn dưới góc độ "Search Space Management"

Đây có lẽ là mental model tốt nhất của chương.

Metaheuristic chủ yếu điều khiển:

$$
\boxed{
where\ to\ search
}
$$

Mathematical optimization giúp:

$$
\boxed{
how\ deeply\ to\ solve\ that\ region
}
$$

Ví dụ:

```text id="xppn17"
                  Entire Space
                      │
          ┌───────────┴───────────┐
          │                       │
      unpromising              promising
                                  │
                                  ▼
                            mathematical
                              optimizer
                                  │
                                  ▼
                              deep search
```

Do đó:

$$
\boxed{
Hybrid = intelligent allocation of search effort
}
$$

---

# 80. Đây cũng là cách hiểu LNS + MIP

LNS quyết định:

$$
N_t
$$

vùng cần khám phá.

MIP quyết định:

$$
\arg\min_{x\in N_t}f(x)
$$

nếu solve exact.

Vậy:

$$
\boxed{
LNS = neighborhood generator
}
$$

$$
\boxed{
MIP = neighborhood optimizer
}
$$

Đây là một trong những công thức quan trọng nhất của toàn bộ chương.

---

# 81. Hybrid có thể thay "repair" bằng nhiều thứ

Sau destroy:

```text id="7o5s7t"
partial solution
       │
       ├── Greedy Repair
       ├── Regret Repair
       ├── MIP Repair
       ├── CP Repair
       ├── DP Repair
       └── Beam Repair
```

Như vậy **Repair Operator** thực chất có thể là:

$$
\boxed{
a\ complete\ optimization\ algorithm
}
$$

Đây là lý do ALNS và matheuristics kết hợp rất tự nhiên.

---

# 82. ALNS + Matheuristic

Ta có thể thậm chí adaptive cả repair solver:

```text id="3k3tqv"
Repair pool:

R1 = Greedy
R2 = Regret-3
R3 = MIP
R4 = CP
R5 = Beam
```

ALNS học:

$$
P(R_i).
$$

Bây giờ adaptive layer không còn chỉ chọn heuristic.

Nó chọn:

> **optimization paradigm**.

Đây là một architecture rất mạnh nhưng cũng rất khó tuning.

---

# 83. Một architecture rất hiện đại

Có thể hình dung:

```text id="a0p4cp"
                     Search Controller
                           │
            ┌──────────────┼──────────────┐
            │              │              │
          ALNS            VNS         MIP/CP
            │              │              │
            └──────────────┼──────────────┘
                           │
                       incumbent
                           │
                      feedback/state
                           │
                           └────► controller
```

Controller quyết định:

* dùng operator nào;
* neighborhood nào;
* solver nào;
* solve bao lâu;
* dừng khi nào.

Đây là **hybrid search control**.

---

# 84. So sánh Hybrid Metaheuristic và Matheuristic

|                            | Hybrid Metaheuristic             | Matheuristic                                 |
| -------------------------- | -------------------------------- | -------------------------------------------- |
| Phạm vi                    | Rất rộng                         | Hẹp hơn                                      |
| Components                 | metaheuristics, CP, exact, ML... | mathematical programming là trung tâm        |
| Ví dụ                      | GA + SA                          | ALNS + MIP                                   |
| Có cần mathematical model? | Không                            | Thường có                                    |
| Mục tiêu                   | kết hợp search methods           | dùng mathematical model/solver cho heuristic |
| "Model-aware"              | không nhất thiết                 | thường rất cao                               |

Survey 2009 về hybridization nhấn mạnh taxonomy rộng của việc kết hợp heuristic/exact methods, trong khi các survey matheuristic hiện đại nhấn mạnh vai trò trung tâm của mathematical model. ([ScienceDirect][2])

---

# 85. Một hiểu lầm quan trọng: Matheuristic không có nghĩa "MIP solver chậm nhưng thêm heuristic"

Không.

Có ít nhất ba vai trò cho mathematical programming:

### 1. Optimizer

$$
\text{solve subproblem}
$$

### 2. Oracle / evaluator

$$
\text{calculate bound or feasibility}
$$

### 3. Knowledge source

$$
\text{dual, relaxation, reduced cost, fractional structure}
$$

Đặc biệt vai trò #3 rất mạnh.

---

# 86. MIP có thể hướng metaheuristic

Ví dụ LP relaxation:

$$
x_i^{LP}\approx1
$$

→ ưu tiên giữ \(x_i\).

$$
x_i^{LP}\approx0
$$

→ có thể ưu tiên bỏ.

Metaheuristic từ đó sử dụng:

$$
x^{LP}
$$

làm bias.

Đây là:

$$
\boxed{
optimization\ information
\rightarrow
heuristic\ bias
}
$$

---

# 87. Metaheuristic có thể hướng MIP

Ví dụ ALNS phát hiện:

```text id="0ab9mz"
houses H12,H17,H19,H24
```

thường xuất hiện cùng nhau trong solution tốt.

Ta có thể:

* ưu tiên branching;
* fix chúng;
* tạo route/column tương ứng;
* đưa constraint symmetry;
* sử dụng chúng làm incumbent.

Do đó:

$$
\boxed{
heuristic\ information
\rightarrow
MIP\ structure
}
$$

---

# 88. Matheuristics và Machine Learning có thể gặp nhau

Một architecture tương lai:

```text id="5zpidi"
optimization state
       ↓
ML controller
       ↓
choose:
  neighborhood
  solver
  variables
  time limit
       ↓
MIP / CP / ALNS
       ↓
reward
       ↓
update controller
```

Nó chính là sự mở rộng tự nhiên của:

$$
ALNS
$$

từ adaptive operator selection sang:

$$
\boxed{
adaptive\ algorithm\ selection
}
$$

---

# 89. Nhưng ML không thay thế mathematical reasoning

Một điểm cần giữ rõ:

ML có thể học:

$$
P(\text{action good})
$$

nhưng mathematical optimization vẫn cung cấp:

* feasibility;
* exact constraints;
* bounds;
* dual certificates;
* structured optimization.

Do đó hybrid:

$$
ML + MIP + Metaheuristic
$$

là một hướng khác hẳn nhưng nối rất đẹp với toàn bộ chương trình học.

---

# 90. Quay lại bài toán AC: một thiết kế hoàn chỉnh

Tớ sẽ thiết kế thử một framework ở mức nghiên cứu:

```text id="a2b0zv"
                 Initial construction
                        │
                 Greedy / Beam
                        │
                        ▼
                 Initial solution
                        │
                        ▼
                     ALNS
                        │
              adaptive destroy
                        │
          ┌─────────────┴─────────────┐
          │                           │
       small q                     large q
          │                           │
      Greedy/Regret                MIP Repair
          │                           │
          └─────────────┬─────────────┘
                        ▼
                       VND
               ┌────────┼────────┐
               │        │        │
            relocate   swap     2-opt
                        │
                        ▼
                   acceptance
                        │
                        ▼
                   update ALNS
```

Nhưng có thể thêm:

```text id="l1gnpu"
if MIP repair stagnates:
    increase destroy size

if MIP proves neighborhood optimal:
    switch neighborhood

if ALNS stagnates:
    activate local branching

if time is nearly over:
    MIP polish incumbent
```

Đây mới thực sự là một **hybrid optimization architecture**.

---

# 91. Thậm chí có thể dùng Column Generation

Một biến thể sâu hơn:

```text id="kq62ua"
ALNS
  ↓
destroy current routes
  ↓
generate route candidates
  ↓
pricing / column generation
  ↓
restricted master
  ↓
new schedule
```

Hoặc:

$$
\text{ALNS}
+
\text{Branch-and-Price}
$$

Đây đã là một framework nghiên cứu khá cao cấp.

---

# 92. Hoặc Benders

```text id="c62s9z"
ALNS proposes assignment
           ↓
Benders routing subproblem
           ↓
feasibility / cost
           ↓
accept / reject
           ↓
ALNS continues
```

Ở đây Benders trở thành một **intelligent evaluator / optimizer** cho candidate structure do ALNS đề xuất.

---

# 93. Hoặc CP-SAT

Nếu route/schedule có constraint phức tạp:

```text id="23tsno"
ALNS destroy
       ↓
free 30 houses
       ↓
CP-SAT
       ↓
rebuild feasible schedule
       ↓
VND
```

Không có lý do phải trung thành với MIP.

---

# 94. Một nguyên tắc thiết kế cực kỳ quan trọng

Đừng bắt đầu bằng:

> "Tôi muốn dùng ALNS + MIP."

Hãy bắt đầu bằng:

> **"Bottleneck của bài toán là gì?"**

Nếu bottleneck là:

### Local structure

→ VNS / Local Search.

### Large restructuring

→ LNS / ALNS.

### Joint decisions khó

→ MIP subproblem.

### Logical scheduling constraints

→ CP.

### Huge route space

→ Column Generation.

### Coupled master/subproblem

→ Benders.

Sau đó mới chọn hybrid.

---

# 95. Một methodology thiết kế matheuristic

Tôi đề xuất 8 bước:

```text id="m9j0kw"
1. Formulate mathematical model
        ↓
2. Identify hard combinatorial structure
        ↓
3. Identify tractable subproblem
        ↓
4. Design neighborhood / decomposition
        ↓
5. Decide exact vs time-limited solve
        ↓
6. Choose search controller
        ↓
7. Add acceptance/diversification
        ↓
8. Benchmark + ablation
```

Đây là quy trình có tính nghiên cứu hơn hẳn việc "thử ghép hai thuật toán".

---

# 96. Một ví dụ cực đơn giản

Giả sử solution hiện tại:

$$
x^*=(1,0,1,1,0,0,1).
$$

Ta muốn cải thiện tối đa 3 bit.

Local Branching:

$$
\sum_{i:x_i^*=0}x_i
+
\sum_{i:x_i^*=1}(1-x_i)
\le3.
$$

Sau đó đưa objective + constraint vào MIP.

Solver sẽ tìm:

$$
\arg\max f(x)
$$

trong neighborhood.

Điều tuyệt vời:

> Ta không phải tự viết logic thử toàn bộ \(2^7\) candidates.

MIP solver làm phần combinatorial reasoning đó.

---

# 97. Một ví dụ Fix-and-Optimize

Giả sử:

```text id="9ybg85"
x = [1,0,1,1,0,1,0,0,1,1]
```

Ta free:

$$
F=\{x_3,x_4,x_5\}.
$$

Fix tất cả còn lại.

MIP chỉ cần tìm:

$$
(x_3,x_4,x_5)\in\{0,1\}^3
$$

tốt nhất.

Nếu solution mới tốt:

```text
[1,0,0,1,1,1,0,0,1,1]
```

tiếp tục window khác.

Đây chính xác là:

$$
\boxed{
MIP\text{-}powered\ local\ search
}
$$

---

# 98. Một ví dụ RINS

LP:

```text id="ja4f8v"
x = [1.00, 0.00, 0.51, 0.98, 0.49]
```

Incumbent:

```text
x = [1, 0, 1, 1, 0]
```

Hai bên đồng ý:

```text id="07u7d3"
x1 = 1
x2 = 0
x4 = 1
```

Ta fix:

$$
x_1=1,\quad
x_2=0,\quad
x_4=1.
$$

Chỉ còn:

$$
x_3,x_5
$$

cần tìm.

RINS vừa tạo một neighborhood vừa dựa trên:

$$
LP\ structure.
$$

---

# 99. Đây là một điểm cực kỳ sâu

So sánh:

### Local Search

Neighborhood được định nghĩa bởi con người.

### VNS

Neighborhoods được định nghĩa bởi con người.

### LNS

Destroy operator định nghĩa neighborhood.

### ALNS

ALNS học cách chọn destroy/repair.

### RINS

**LP relaxation tự cung cấp thông tin để định nghĩa neighborhood.**

### Kernel Search

LP relaxation giúp xác định **kernel**.

### Local Branching

Mathematical model định nghĩa neighborhood bằng inequality.

Đây là cả một "family" của:

$$
\boxed{
model\text{-}guided\ search
}
$$

---

# 100. Model-guided Search

Đây là một thuật ngữ/mental model cực kỳ phù hợp cho chương này.

Thay vì:

```text id="4nlvl2"
heuristic
→ arbitrary search
```

ta có:

```text id="j3drmy"
mathematical model
        ↓
structural information
        ↓
guided search
```

Các nguồn survey matheuristics hiện đại cũng nhấn mạnh đúng điểm này: mathematical model không chỉ là công cụ giải, mà có thể cung cấp các thành phần/ý tưởng để xây dựng heuristic. ([Springer][11])

---

# 101. Một cách phân loại matheuristic rất mạnh

Ta có thể chia theo câu hỏi:

### Model dùng để **xây solution**?

→ Relax-and-Fix, Diving.

### Model dùng để **sửa solution**?

→ Fix-and-Optimize, MIP repair.

### Model dùng để **tìm neighborhood**?

→ Local Branching, RINS, VLSN.

### Model dùng để **lọc/promising variables**?

→ Kernel Search.

### Model dùng để **decompose**?

→ Benders/Lagrangian/Dantzig-Wolfe heuristics.

### Model dùng để **cung cấp bound**?

→ relaxation-guided search.

Đây là một taxonomy rất thực dụng khi thiết kế thuật toán mới.

---

# 102. So sánh Exact, Metaheuristic và Matheuristic

|                          | Exact           | Metaheuristic       | Matheuristic          |
| ------------------------ | --------------- | ------------------- | --------------------- |
| Optimality guarantee     | Có              | Thường không        | Thường không toàn cục |
| Search flexibility       | Trung bình      | Cao                 | Cao                   |
| Mathematical model       | Có/tuỳ          | Không bắt buộc      | Có                    |
| Large instances          | Khó             | Tốt                 | Thường tốt            |
| Local exact optimization | Có thể          | Hiếm                | Rất phổ biến          |
| Bounds                   | Mạnh            | Thường không        | Có thể tận dụng       |
| Implementation           | Phức tạp        | Tương đối linh hoạt | Phức tạp              |
| Tuning                   | Model-dependent | Parameter-heavy     | Cả hai                |

---

# 103. Điều gì làm một matheuristic tốt?

Không phải cứ có MIP là tốt.

Một matheuristic tốt thường có:

$$
\boxed{
Strong\ decomposition
}
$$

$$
\boxed{
Good\ neighborhood
}
$$

$$
\boxed{
Good\ incumbent
}
$$

$$
\boxed{
Efficient\ subproblem
}
$$

$$
\boxed{
Low\ communication\ overhead
}
$$

và:

$$
\boxed{
well-designed\ search\ control.
}
$$

---

# 104. Điều gì làm một matheuristic thất bại?

Một số pattern phổ biến:

### MIP subproblem quá lớn

$$
T_{MIP}\gg T.
$$

### Neighborhood quá nhỏ

$$
\approx\text{ordinary local search}.
$$

### Neighborhood quá lớn

$$
\approx\text{solve original MIP}.
$$

### Không có diversification

→ stagnation.

### Solver overhead lớn

→ heuristic thuần tốt hơn.

### Formulation yếu

→ MIP mất thời gian vào search tree.

### Không tận dụng warm start

→ lãng phí incumbent information.

---

# 105. Trade-off quan trọng nhất

Ta có:

$$
\boxed{
Neighborhood\ size
\leftrightarrow
Subproblem\ difficulty
}
$$

Ví dụ:

```text id="qvz8ah"
small
│
│ fast
│ but weak
│
├─────────────┤
│ sweet spot  │
├─────────────┤
│
│ slow
│ but powerful
│
large
```

Đây chính là bài toán tuning trung tâm của VLSN/LNS/matheuristic.

---

# 106. Và giờ có thể nhìn lại toàn bộ curriculum

Chương 5:

$$
Local Search
$$

→ search neighborhood nhỏ.

Chương 6:

$$
SA
$$

→ cho phép rời local optimum.

Chương 7:

$$
Tabu
$$

→ memory.

Chương 8:

$$
GA
$$

→ population.

Chương 9:

$$
GRASP
$$

→ randomized construction.

Chương 10:

$$
ILS
$$

→ perturb + LS.

Chương 11:

$$
VNS
$$

→ thay neighborhood.

Chương 12:

$$
Beam Search
$$

→ giữ nhiều partial states.

Chương 13:

$$
LNS
$$

→ large restructuring.

Chương 14:

$$
ALNS
$$

→ học cách restructuring.

Chương 15:

$$
Mathematical\ Optimization
$$

→ model + bounds + exact subproblem.

Chương 16:

$$
\boxed{
Hybrid / Matheuristics
}
$$

→ **đưa tất cả chúng vào cùng một architecture.**

---

# 107. Toàn bộ chuỗi tiến hóa

Tôi nghĩ đây là sơ đồ đẹp nhất để kết thúc chương:

```text id="8k0t5z"
                    SEARCH
                      │
          ┌───────────┴───────────┐
          │                       │
    Heuristic world        Mathematical world
          │                       │
    Local Search               LP / MIP
    SA / Tabu                    │
    ILS / VNS                Branch & Cut
    LNS / ALNS               Column Generation
          │                    Benders
          │                       │
          └───────────┬───────────┘
                      ▼
                 MATHEURISTICS
                      │
        ┌─────────────┼─────────────┐
        │             │             │
       MIP          CP/DP        Decomposition
        │             │             │
     repair         repair      master/subproblem
        │             │             │
        └─────────────┼─────────────┘
                      ▼
               Hybrid Controller
                      │
                      ▼
                  Best Solution
```

---

# 108. Và đây là mental model tôi khuyên cậu giữ

Có thể tóm cả chương bằng câu:

> **Metaheuristic quyết định vùng nào đáng tìm; mathematical optimization quyết định phải tìm vùng đó sâu đến đâu.**

Hay viết toán học:

$$
\boxed{
\text{Search controller}
\rightarrow
\text{define }N_t
\rightarrow
\text{optimize }N_t
\rightarrow
\text{feedback}
}
$$

Đây là một abstraction cực kỳ mạnh.

---

# 109. Bộ công cụ matheuristic cậu nên thuộc

Sau khi hoàn thành chương này, tôi cho rằng cậu nên nhận diện ngay các tên sau:

$$
\boxed{
\begin{array}{llll}
\text{Relax-and-Fix} &
\text{Fix-and-Optimize} &
\text{Local Branching} &
\text{RINS}\\
\text{Feasibility Pump} &
\text{Diving} &
\text{Kernel Search} &
\text{VLSN}\\
\text{Decomposition Heuristics} &
\text{MIP-based LNS} &
\text{MIP-based VNS} &
\text{ALNS + MIP}
\end{array}
}
$$

Đây là vocabulary rất quan trọng khi đọc paper về optimization.

Textbook *Matheuristics: Algorithms and Implementations* của Maniezzo, Boschetti & Stützle là một nguồn rất phù hợp cho đúng nhóm kỹ thuật này; sách trình bày hơn 40 algorithms cùng trace và code, trong đó có diving, VLSN, decomposition-based heuristics, corridor method và kernel search. ([Springer][12])

---

# 110. Ba paper/nguồn kinh điển đặc biệt đáng nhớ

### 1. Fischetti & Lodi — Local Branching

Đây là nền tảng cho việc dùng MIP solver để exact-search trong các neighborhoods được định nghĩa như local branching constraints. ([ResearchGate][4])

### 2. Helber & Sahling — Fix-and-Optimize

Một ví dụ kinh điển của chuỗi MIP subproblems với subset binary variables được thả tự do để cải thiện incumbent. ([ScienceDirect][5])

### 3. Fischetti, Glover & Lodi — Feasibility Pump

Một trong những primal heuristics kinh điển nhất cho MIP, dựa trên việc luân phiên giữa continuous feasibility và integer proximity. ([Nghiên cứu UNIPD][7])

Ngoài ra, taxonomy của Jourdan–Basseur–Talbi rất đáng đọc để hiểu **architecture của hybrid**, còn textbook 2021 và survey 2024 của Boschetti–Maniezzo cho bức tranh hiện đại của matheuristics. ([ScienceDirect][2])

---

# 111. Điều tôi muốn cậu thực sự "thông" sau Chương 16

Không phải nhớ 15 cái acronym.

Mà là 6 ý tưởng:

### 1. Neighborhood có thể được **mô hình hóa**

$$
N(S)
\rightarrow
MIP/CP/DP
$$

### 2. Relaxation có thể **hướng search**

$$
LP
\rightarrow
fix/select/branch
$$

### 3. Exact solver có thể trở thành **một search operator**

$$
\text{MIP Repair}
$$

### 4. Metaheuristic có thể trở thành **một component của exact solver**

$$
\text{heuristic incumbent}
\rightarrow
\text{better bound/pruning}
$$

### 5. Decomposition có thể trở thành heuristic

$$
Master
\leftrightarrow
Subproblem
$$

không nhất thiết phải chạy đến exact convergence.

### 6. Toàn bộ thuật toán có thể được xem như một **search controller**

$$
\boxed{
\text{Where to search?}
\quad+\quad
\text{How deeply to search?}
}
$$

---

# 112. Và đây là kết luận cuối cùng của toàn bộ lộ trình 16 chương

Nếu nhìn từ xa, ta đã đi từ:

$$
\boxed{\text{Greedy}}
$$

một quyết định đơn giản,

đến:

$$
\boxed{\text{Dynamic Programming}}
$$

ghi nhớ cấu trúc con,

đến:

$$
\boxed{\text{Exact Search}}
$$

phân hoạch không gian nghiệm,

đến:

$$
\boxed{\text{Approximation}}
$$

đặt guarantee,

đến:

$$
\boxed{\text{Local Search / Metaheuristics}}
$$

điều khiển quá trình exploration/exploitation,

đến:

$$
\boxed{\text{LNS / ALNS}}
$$

thay đổi cấu trúc nghiệm quy mô lớn,

đến:

$$
\boxed{\text{Mathematical Optimization}}
$$

mô hình hóa không gian nghiệm, relaxation, bounds, cuts và decomposition,

và cuối cùng:

$$
\boxed{
\textbf{Hybrid / Matheuristics}
}
$$

nơi không còn câu hỏi:

> "Thuật toán nào là tốt nhất?"

mà là:

> **"Phần nào của bài toán nên giao cho cơ chế nào, vào thời điểm nào, với mức độ exactness nào?"**

Đó chính là tư duy của một **optimization engineer/researcher**.

---

## Một công thức cuối cùng để nhớ cả Chương 16

$$
\boxed{
\text{Matheuristic}
=
\underbrace{\text{Search}}_{\text{Greedy/LS/SA/VNS/LNS/ALNS}}
+
\underbrace{\text{Model}}_{\text{LP/MIP/CP}}
+
\underbrace{\text{Structure}}_{\text{CG/Benders/Decomposition}}
+
\underbrace{\text{Control}}_{\text{when/how deeply to optimize}}
}
$$

Và đối với bài toán kỹ thuật viên điều hòa mà chúng ta đã dùng xuyên suốt:

$$
\boxed{
\text{ALNS}
+
\text{MIP/CP repair}
+
\text{VND}
+
\text{model-based neighborhoods}
}
$$

là điểm hội tụ tự nhiên của gần như **toàn bộ kiến thức từ Chương 1 đến Chương 16**.

Thực tế, các survey và sách chuyên khảo về matheuristics hiện nay cũng đang đi theo đúng hướng đó: từ các hybrid metaheuristic cổ điển đến những framework dùng MIP như **VLSN, Fix-and-Optimize, Kernel Search, decomposition heuristics**, rồi tới các matheuristic hiện đại có mức độ tích hợp ngày càng sâu. ([Springer][1])

[1]: https://link.springer.com/article/10.1007/s10479-024-06302-z?utm_source=chatgpt.com "Contemporary approaches in matheuristics an updated survey | Annals of Operations Research | Springer Nature Link"
[2]: https://www.sciencedirect.com/science/article/pii/S0377221708003597?utm_source=chatgpt.com "Hybridizing exact methods and metaheuristics: A taxonomy - ScienceDirect"
[3]: https://www.sciencedirect.com/science/article/pii/S0166218X01003389?utm_source=chatgpt.com "A survey of very large-scale neighborhood search techniques - ScienceDirect"
[4]: https://www.researchgate.net/publication/225135001_Local_branching?utm_source=chatgpt.com "(PDF) Local branching"
[5]: https://www.sciencedirect.com/science/article/pii/S0925527309003107?utm_source=chatgpt.com "A fix-and-optimize approach for the multi-level capacitated lot sizing problem - ScienceDirect"
[6]: https://www.sciencedirect.com/science/article/abs/pii/S0305048315000432?utm_source=chatgpt.com "Fix-and-optimize and variable neighborhood search approaches for multi-level capacitated lot sizing problems - ScienceDirect"
[7]: https://research.unipd.it/handle/11577/2431994?utm_source=chatgpt.com "The Feasibility Pump"
[8]: https://onlinelibrary.wiley.com/doi/full/10.1111/itor.13301?utm_source=chatgpt.com "Matheuristics: survey and synthesis - Boschetti - 2023 - International Transactions in Operational Research - Wiley Online Library"
[9]: https://cris.unibo.it/handle/11585/832905?utm_source=chatgpt.com "Kernel Search"
[10]: https://cris.unibo.it/handle/11585/832901?utm_source=chatgpt.com "Decomposition-Based Heuristics"
[11]: https://link.springer.com/article/10.1007/s10288-022-00510-8?utm_source=chatgpt.com "Matheuristics: using mathematics for heuristic design | 4OR | Springer Nature Link"
[12]: https://link.springer.com/book/10.1007/978-3-030-70277-9?utm_source=chatgpt.com "Matheuristics: Algorithms and Implementations | Springer Nature Link"
[13]: https://www.sciencedirect.com/science/article/abs/pii/S156849462400721X?utm_source=chatgpt.com "A survey of mat-heuristics for combinatorial optimisation problems: Variants, trends and opportunities - ScienceDirect"
[14]: https://pubsonline.informs.org/doi/10.1287/trsc.2014.0523?utm_source=chatgpt.com "A Two-Phase Iterative Heuristic Approach for the Production Routing Problem | Transportation Science"
