# Chương 15 — Mathematical Optimization

Đây là chương **rất quan trọng và cũng là điểm chuyển pha lớn nhất của toàn bộ lộ trình**.

Các chương 5–14 chủ yếu xây dựng các cách **tìm kiếm** nghiệm:

$$
\text{Local Search}
\rightarrow
SA
\rightarrow
Tabu
\rightarrow
GA
\rightarrow
ILS
\rightarrow
VNS
\rightarrow
LNS
\rightarrow
ALNS
$$

Còn Mathematical Optimization đặt câu hỏi ở một tầng khác:

> **Ta có thể mô tả toàn bộ bài toán bằng một mô hình toán học, rồi để một optimization solver chứng minh nghiệm tối ưu hoặc cung cấp bound/chứng nhận chất lượng hay không?**

Đây là nơi xuất hiện những khái niệm rất quan trọng:

$$
\boxed{
LP,\ ILP,\ MILP/MIP,\ CP,\ Column\ Generation,\ Branch\&Cut,\ Benders
}
$$

Điều đặc biệt là **bảy mục này không phải bảy thuật toán độc lập**. Chúng xếp thành một hệ thống:

```text
                    Mathematical Optimization
                              │
          ┌───────────────────┴───────────────────┐
          │                                       │
    Mathematical Model                      Solver Paradigms
          │                                       │
    ┌─────┴─────┐                     ┌───────────┴───────────┐
    │           │                     │                       │
   LP         ILP/MIP                 CP              Decomposition
    │           │                                           │
    │      LP Relaxation                              ┌──────┴──────┐
    │           │                                     │             │
    └──────────►│                                  Column       Benders
                │                                  Generation
          Branch & Bound
                │
          Branch & Cut
                │
       Branch-and-Price
       Branch-Cut-and-Price
```

Các solver hiện đại thực tế còn kết hợp rất nhiều thành phần. SCIP chẳng hạn cung cấp cả branching, cutting-plane separation, pricing, propagation và Benders decomposition trong cùng một framework. ([Scipopt][1])

---

# 1. Mathematical Optimization là gì?

Một bài toán tối ưu toán học có dạng tổng quát:

$$
\boxed{
\begin{aligned}
\min/\max\quad & f(x)\\
\text{s.t.}\quad & g_i(x)\le 0,\quad i=1,\ldots,m\\
& h_j(x)=0,\quad j=1,\ldots,p\\
& x\in X
\end{aligned}
}
$$

Trong đó:

* \(x\): vector biến quyết định;
* \(f(x)\): objective;
* \(g_i,h_j\): constraints;
* \(X\): miền mà biến được phép nhận.

Ví dụ bài toán kỹ thuật viên điều hòa:

* \(x_{i,d}=1\): house \(i\) được phục vụ vào ngày \(d\);
* \(y_{i,j,d}=1\): sau house \(i\), kỹ thuật viên đi tới house \(j\);
* \(t_{i,d}\): thời gian;
* objective: tối đa tiền kiếm được;
* constraint: một house không được làm quá một lần;
* constraint: không vượt giới hạn thời gian mỗi ngày;
* constraint: route phải liên tục.

Ta chuyển từ:

> “Viết một chương trình để thử các route.”

sang:

> “Viết một tập phương trình biểu diễn **chính xác không gian nghiệm**.”

Đây là sự thay đổi tư duy rất quan trọng.

---

# 2. Ba thành phần của một mô hình tối ưu

Mỗi model cần phân biệt:

### Variables

Ta quyết định cái gì?

$$
x_1,x_2,\dots,x_n
$$

### Constraints

Điều gì được phép?

$$
Ax\le b
$$

hoặc các quan hệ phức tạp hơn.

### Objective

Ta muốn tốt theo tiêu chí nào?

$$
\min c^Tx
$$

hoặc:

$$
\max c^Tx
$$

Nếu cả objective và constraints đều tuyến tính, ta đang ở thế giới LP/MILP.

---

# 3. LP — Linear Programming

## 3.1 Định nghĩa

Một Linear Program có dạng:

$$
\boxed{
\begin{aligned}
\min\quad & c^Tx\\
\text{s.t.}\quad & Ax\le b\\
& x\ge0
\end{aligned}
}
$$

hoặc các dạng tương đương dùng \(=\), \(\ge\).

Điều kiện quyết định:

> **objective và mọi constraint đều là hàm tuyến tính của biến.**

Ví dụ:

$$
\max 5x+7y
$$

subject to:

$$
2x+y\le10
$$

$$
x+3y\le12
$$

$$
x,y\ge0
$$

là LP.

Nhưng:

$$
xy\le10
$$

không còn là LP.

---

# 4. LP có điểm gì đặc biệt?

Đây là phần cực kỳ quan trọng.

Ta có feasible region:

$$
P=\{x:Ax\le b,\ x\ge0\}
$$

Đây là một **convex polyhedron**.

Nếu bài toán bị chặn và khả thi, optimum của linear objective có thể đạt tại một **extreme point / vertex** của polyhedron. Đây là lý do simplex và các phương pháp LP có thể khai thác cấu trúc hình học này. MIT trình bày chính xác góc nhìn polyhedral này cùng với LP duality. 

Trong 2D, hãy tưởng tượng:

```text
          y
          ↑
       •──────•
      /        \
     /    →     \
    •────────────•
              → x
```

Ta không cần kiểm tra vô hạn điểm.

Objective:

$$
c^Tx
$$

tạo ra các đường đồng mức.

Ta "trượt" đường đó cho đến khi chạm polyhedron ở một extreme point.

---

# 5. LP Relaxation

Một khái niệm sẽ xuất hiện xuyên suốt phần còn lại:

> **Relaxation.**

Giả sử ta có:

$$
x\in\mathbb Z
$$

Nếu bỏ điều kiện nguyên:

$$
x\in\mathbb R
$$

thì bài toán trở thành LP relaxation.

Ví dụ:

$$
\max 10x+7y
$$

subject to:

$$
x+y\le3
$$

$$
2x+y\le4
$$

$$
x,y\in\mathbb Z_{\ge0}
$$

Relaxation:

$$
x,y\in\mathbb R_{\ge0}
$$

Feasible region được mở rộng.

Vì thế, với bài toán maximization:

$$
OPT_{LP}\ge OPT_{IP}
$$

và với minimization:

$$
OPT_{LP}\le OPT_{IP}
$$

Do đó LP solution cho ta **bound**.

Đây chính là nền tảng của Branch-and-Bound và Branch-and-Cut.

---

# 6. LP Duality — linh hồn của rất nhiều kỹ thuật về sau

Với primal:

$$
\begin{aligned}
\min\quad &c^Tx\\
\text{s.t.}\quad &Ax=b\\
&x\ge0
\end{aligned}
$$

ta có dual:

$$
\begin{aligned}
\max\quad &b^Ty\\
\text{s.t.}\quad &A^Ty\le c
\end{aligned}
$$

MIT mô tả dual như một cách xây dựng **lower bound** cho primal và cho thấy weak/strong duality và complementary slackness. ([Courses MIT][2])

---

## 6.1 Weak duality

Với bất kỳ primal feasible \(x\) và dual feasible \(y\):

$$
b^Ty\le c^Tx
$$

đối với primal minimization.

Do đó:

$$
\boxed{
dual\ feasible\ solution
\Rightarrow
bound
}
$$

Đây là insight rất lớn.

Một solution không chỉ cho ta:

> "giá trị của solution"

mà còn có thể cho ta:

> "chứng cứ rằng không thể tốt hơn một mức nào đó".

---

# 7. Strong Duality

Nếu primal và dual đều có optimum hữu hạn:

$$
\boxed{
OPT_P=OPT_D
}
$$

Đây là một trong những định lý trung tâm của LP. MIT's discrete mathematics notes trình bày duality như một phương pháp chứng minh optimality: tìm được một primal feasible solution và một dual feasible solution cùng objective thì cả hai đều tối ưu. ([MIT OpenCourseWare][3])

Điều này giải thích một loạt khái niệm về sau:

* shadow price;
* reduced cost;
* pricing;
* column generation;
* Benders cuts.

---

# 8. Shadow Price

Một constraint có thể có giá trị kinh tế.

Ví dụ:

$$
\sum_i t_i x_i\le720
$$

Nếu tăng 1 đơn vị resource từ 720 lên 721 thì objective cải thiện bao nhiêu?

Dual variable tương ứng chính là một dạng **shadow price**.

Ví dụ:

$$
\pi=250
$$

có thể được diễn giải:

> thêm một phút tài nguyên có giá trị biên khoảng 250 đơn vị objective, trong vùng mà basis vẫn giữ nguyên.

Đây không chỉ là toán học đẹp; nó có ý nghĩa quyết định:

> "Tôi nên đầu tư thêm resource nào?"

---

# 9. ILP — Integer Linear Programming

Bây giờ ta thêm:

$$
x_i\in\mathbb Z
$$

vào LP.

Ta được:

$$
\boxed{
\begin{aligned}
\min\quad &c^Tx\\
\text{s.t.}\quad &Ax\le b\\
&x_i\in\mathbb Z
\end{aligned}
}
$$

Đó là **Integer Linear Programming**.

Ví dụ:

$$
x_1=\text{số kỹ thuật viên}
$$

không thể là:

$$
x_1=3.7.
$$

---

# 10. Binary variables

Trường hợp đặc biệt quan trọng:

$$
x_i\in\{0,1\}
$$

Binary variable có thể biểu diễn:

```text
0 = không
1 = có
```

Ví dụ:

$$
x_i=
\begin{cases}
1 & \text{house }i\text{ được chọn}\\
0 & \text{ngược lại}
\end{cases}
$$

hoặc:

$$
x_{ij}=
\begin{cases}
1& i\to j\\
0&\text{otherwise}
\end{cases}
$$

Một phần cực lớn của combinatorial optimization có thể được mã hóa bằng binary variables.

---

# 11. ILP ≠ hoàn toàn khác LP

Một ILP rất thường được giải thông qua LP.

Đây là insight quan trọng:

```text
ILP
 │
 └── bỏ integrality
       ↓
      LP
       ↓
    solve nhanh
       ↓
      bound
       ↓
   search / cuts
```

Solver không "thử tất cả integer solutions".

Nó tận dụng **continuous relaxation** để dẫn đường cho việc tìm nghiệm nguyên.

---

# 12. MIP — Mixed Integer Programming

MIP thường dùng để chỉ mô hình có hỗn hợp:

$$
x_i\in\mathbb Z
$$

và:

$$
y_j\in\mathbb R.
$$

Ví dụ:

$$
x=\text{số xe}
$$

là integer nhưng:

$$
y=\text{lượng hàng}
$$

là continuous.

Google định nghĩa MIP là linear optimization có một số biến yêu cầu nguyên; MPSolver hỗ trợ LP/MIP, trong khi CP-SAT là một hướng khác cho integer optimization. ([Google for Developers][4])

Thuật ngữ **MILP** = Mixed-Integer Linear Programming thường được dùng thay cho **MIP** khi muốn nhấn mạnh rằng objective/constraints là tuyến tính.

---

# 13. ILP, IP, MIP, MILP — phân biệt thế nào?

Trong tài liệu thực tế, terminology hơi không đồng nhất.

| Thuật ngữ | Ý nghĩa                          |
| --------- | -------------------------------- |
| LP        | Linear Programming, continuous   |
| IP / ILP  | Integer Linear Programming       |
| MIP       | Mixed Integer Programming        |
| MILP      | Mixed Integer Linear Programming |
| 0–1 ILP   | ILP với biến binary              |

Thông thường:

$$
ILP\subseteq MILP
$$

vì MILP cho phép cả continuous và integer variables.

Trong phần lớn tài liệu optimization hiện đại, "MIP" được dùng rất rộng.

---

# 14. Tại sao MIP khó?

Đây là điểm khiến Chương 15 kết nối ngược với chương Complexity và Exact Search.

LP có cấu trúc convex/polyhedral rất mạnh.

Nhưng khi thêm:

$$
x\in\mathbb Z
$$

ta chuyển sang một tập rời rạc:

```text
continuous region:

██████████████
██████████████
██████████████

integer points:

•    •
  •
•       •
    •
```

Không còn được phép chọn các điểm fractional.

MIP nói chung là NP-hard; MOSEK cũng lưu ý mixed-integer optimization là một lớp rất rộng và thường không thể kỳ vọng tìm exact solution trong thời gian hợp lý cho mọi instance. ([Mosek Docs][5])

---

# 15. Integrality Gap

Đây là khái niệm rất quan trọng.

Với minimization:

$$
OPT_{LP}\le OPT_{IP}
$$

Ta định nghĩa một dạng integrality gap:

$$
\frac{OPT_{IP}}{OPT_{LP}}
$$

hoặc additive gap:

$$
OPT_{IP}-OPT_{LP}.
$$

Nếu:

$$
OPT_{LP}\approx OPT_{IP}
$$

thì relaxation rất mạnh.

Ngược lại:

$$
OPT_{LP}\ll OPT_{IP}
$$

thì relaxation yếu.

---

# 16. Ví dụ integrality gap

Giả sử:

$$
OPT_{LP}=100
$$

nhưng:

$$
OPT_{IP}=150.
$$

LP chỉ nói:

$$
OPT_{IP}\ge100.
$$

Bound này yếu.

Nếu ta cải thiện formulation để:

$$
OPT_{LP}=145
$$

thì solver chỉ cần chứng minh:

$$
145\le OPT_{IP}\le145
$$

thì xong.

Do đó:

> **Một formulation tốt có thể quan trọng không kém một thuật toán tốt.**

Đây là lý do Integer Programming không chỉ là "ném model vào solver".

---

# 17. Formulation Strength

Hai model có thể biểu diễn **cùng một tập nghiệm nguyên**, nhưng relaxation khác nhau.

Ví dụ:

```text
Formulation A
LP relaxation rộng
          ↓
fractional solutions rất nhiều

Formulation B
LP relaxation chặt
          ↓
fractional solutions ít hơn
```

Model B có thể giải nhanh hơn rất nhiều.

Trong optimization hiện đại, việc thiết kế formulation là một nghệ thuật lớn. MIT's Integer Programming and Combinatorial Optimization course dành hẳn nhiều bài cho formulation, ideal formulations, duality và cutting-plane methods. ([MIT OpenCourseWare][6])

---

# 18. Big-M

Một kỹ thuật rất phổ biến để encode logic:

$$
x=1\Rightarrow y\le c
$$

có thể dùng:

$$
y\le c+M(1-x).
$$

Nếu:

$$
x=1
$$

thì:

$$
y\le c.
$$

Nếu:

$$
x=0
$$

thì:

$$
y\le c+M.
$$

Đây là:

> **Big-M formulation.**

Nhưng Big-M quá lớn có thể gây numerical issues và làm relaxation yếu.

Gurobi cũng cảnh báo về numerical tolerances và ill-conditioning: các mô hình kém điều kiện có thể ảnh hưởng đáng kể tới hiệu năng và độ chính xác số của LP/MIP. ([Gurobi Documentation][7])

Do đó:

$$
\boxed{
M\text{ nên nhỏ nhất nhưng vẫn đúng}
}
$$

thường tốt hơn "chọn một số cực lớn".

---

# 19. MIP Solver thực sự làm gì?

Đây là điểm nhiều người mới học thường hiểu sai.

Không phải:

```text
for all possible x:
    check feasibility
```

Một MIP solver hiện đại thường có một hệ thống rất phức tạp:

```text
                 MIP
                  │
          Presolve / preprocessing
                  │
                  ▼
              LP relaxation
                  │
          ┌───────┴────────┐
          │                │
       feasible?        fractional?
          │                │
        bound          cuts / branch
          │                │
          └───────┬────────┘
                  ▼
             search tree
                  │
           heuristic solutions
                  │
                  ▼
          incumbent + bounds
                  │
                  ▼
              optimal?
```

Branch-and-cut là kiến trúc trung tâm của các MIP solver hiện đại. IBM CPLEX mô tả mỗi node của cây là một LP/QP subproblem; branching tạo các node con, còn cuts loại bỏ fractional points nhưng không loại bỏ feasible integer solutions. ([IBM][8])

---

# 20. Branch-and-Bound

Ta đã nghiên cứu Exact Search trước đây, giờ nó xuất hiện dưới một hình thức toán học mạnh hơn.

Giả sử maximization.

Root:

$$
LP\ relaxation = 120
$$

Nhưng nghiệm LP fractional.

Ta chưa có integer solution tốt nhất, nên:

$$
UB=120.
$$

Ta branch:

$$
x_1=0
$$

và:

$$
x_1=1.
$$

Cây:

```text
                  Root
                 UB=120
                /      \
           x1=0         x1=1
           UB=110       UB=117
```

Giả sử incumbent:

$$
LB=115.
$$

Node `x1=0`:

$$
UB=110<LB=115
$$

→ prune.

Chỉ còn:

```text
                  Root
                   |
                x1=1
                UB=117
```

Tiếp tục branch.

---

# 21. Ý nghĩa của bound

Đây là điểm cực kỳ quan trọng.

Exact Search thuần túy:

> duyệt solution space.

MIP:

> **duyệt solution space nhưng dùng LP để chứng minh cả một vùng không cần duyệt.**

Ví dụ:

```text
10 triệu solutions
      │
      ├── vùng A: upper bound < incumbent
      │             └── bỏ cả vùng
      │
      ├── vùng B: cần search
      │
      └── vùng C: bound tốt
                    └── tiếp tục
```

Đây chính là sức mạnh của optimization-based search.

---

# 22. Branch & Cut

Branch-and-Bound chỉ có:

```text
branch
+
bound
```

Branch-and-Cut bổ sung:

```text
branch
+
bound
+
cutting planes
```

IBM CPLEX mô tả cut là constraint mới cắt bớt continuous relaxation nhưng không loại bỏ các integer feasible solutions. ([IBM][8])

---

# 23. Cutting Plane

Giả sử LP relaxation có nghiệm:

$$
x=0.5,\ y=0.5
$$

nhưng integer problem chỉ chấp nhận:

```text
(0,0)
(1,0)
(0,1)
```

Nếu ta tìm được inequality:

$$
x+y\le1
$$

mà:

* mọi integer feasible solution đều thỏa;
* nhưng \(0.5+0.5=1\), ví dụ này chưa cắt; giả sử một fractional point khác \(0.7,0.7\) thì bị cắt.

Ta thêm constraint:

$$
x+y\le1.
$$

LP relaxation trở nên chặt hơn.

---

# 24. Valid Inequality

Một inequality:

$$
a^Tx\le b
$$

được gọi là **valid inequality** nếu mọi feasible integer solution đều thỏa:

$$
a^Tx\le b.
$$

Nó không nhất thiết ban đầu phải có trong formulation.

Ta có thể thêm nó như một strengthening constraint.

---

# 25. Tại sao cut không phá nghiệm nguyên?

Mục tiêu của cut là:

```text
Original integer feasible set
        ● ● ● ● ●
        │
        │ relaxation
        ▼
   ┌──────────────┐
   │ • • • • • •  │
   │ • ● • ● • •  │
   │ • • ● • • •  │
   └──────────────┘
```

Cut:

```text
remove fractional points
keep all legitimate integer points
```

Nếu cut loại bỏ một integer feasible solution thì nó **không còn là valid cut** cho formulation đó.

---

# 26. Một số loại cuts

Solver thực tế có rất nhiều loại:

* Gomory cuts
* Mixed Integer Rounding (MIR)
* cover cuts
* clique cuts
* flow-cover cuts
* lift-and-project
* zero-half
* implied-bound cuts
* v.v.

IBM CPLEX liệt kê nhiều họ cut mà solver có thể sử dụng. ([IBM][9])

Gurobi cũng cho phép điều khiển mức độ aggressiveness của cut generation trong MIP solver. ([Gurobi Documentation][10])

---

# 27. Branch-and-Cut đầy đủ

Một node có thể hoạt động như:

```text
Node
 │
 ▼
Solve LP relaxation
 │
 ├── infeasible
 │      └── prune
 │
 ├── integer solution
 │      └── update incumbent
 │
 └── fractional
       │
       ▼
   generate cuts
       │
       ▼
   solve LP again
       │
       ├── now integer
       ├── now infeasible
       └── still fractional
               │
               ▼
             branch
```

Đây là điều khiến MIP solver mạnh hơn rất nhiều so với một DFS đơn giản.

---

# 28. Branching và variable selection

Giả sử:

$$
x_1=0.2,\quad
x_2=0.49,\quad
x_3=0.8.
$$

Ta cần chọn biến để branch.

Một chiến lược đơn giản:

$$
x_2
$$

vì gần \(0.5\).

Nhưng các solver hiện đại có những branching heuristics phức tạp hơn nhiều.

Mục tiêu:

> tạo search tree càng nhỏ càng tốt.

Do đó branch strategy có thể ảnh hưởng cực lớn tới performance.

---

# 29. Incumbent vs Bound

Đây là hai đại lượng cần ghi nhớ.

### Incumbent

Best feasible integer solution đã tìm được.

Ví dụ maximization:

$$
LB=135.
$$

### Best bound

Giới hạn lý thuyết tốt nhất mà solution chưa tìm thấy có thể đạt.

Ví dụ:

$$
UB=140.
$$

Nếu:

$$
LB=140=UB
$$

→ chứng minh optimal.

Nếu:

$$
LB=135,\quad UB=140
$$

thì chưa biết optimum nằm ở đâu trong:

$$
[135,140].
$$

---

# 30. MIP Gap

Ta thường định nghĩa relative gap dạng:

$$
gap=
\frac{|UB-LB|}
{\max(1,|LB|)}
$$

hoặc một biến thể phụ thuộc solver/objective sense.

Gurobi dùng MIPGap để điều khiển relative optimality gap và cho phép tập trung vào tìm feasible solution hoặc chứng minh optimality/bound tùy mục tiêu. ([Gurobi Documentation][10])

Đây là một quan điểm rất khác metaheuristic.

Metaheuristic nói:

> "Best solution tôi tìm được là 135."

MIP có thể nói:

> "Solution = 135, và tôi biết optimum không thể vượt 140."

Đó là **certificate-like information** cực kỳ có giá trị.

---

# 31. CP — Constraint Programming

Bây giờ ta bước sang một thế giới khác.

CP không bắt buộc bài toán phải có:

$$
f(x)=c^Tx
$$

và:

$$
Ax\le b.
$$

Thay vào đó ta mô hình hóa bằng **constraints trên domains và variables**.

Ví dụ:

```text
x1 ∈ {1,2,3,4}
x2 ∈ {1,2,3,4}
x3 ∈ {1,2,3,4}

AllDifferent(x1,x2,x3)
```

hoặc:

$$
x_1+x_2=x_3.
$$

Hoặc các constraint chuyên biệt:

```text
AllDifferent
NoOverlap
Cumulative
Element
Circuit
Automaton
...
```

Google mô tả CP như một paradigm tìm nghiệm thỏa các constraint trên một không gian ứng viên rất lớn, đặc biệt phù hợp cho scheduling, planning và các bài toán có constraint dị thể. ([Google for Developers][11])

---

# 32. CP khác MIP ở đâu?

Đây là một trong những phần quan trọng nhất của chương.

### MIP

Thế giới chính:

$$
\text{Linear Algebra + Polyhedra + Relaxation}
$$

### CP

Thế giới chính:

$$
\text{Domains + Propagation + Constraint Structure}
$$

Ví dụ scheduling.

MIP có thể biểu diễn:

$$
start_i + duration_i \le start_j + M(1-x_{ij})
$$

nhưng CP có thể trực tiếp dùng:

```text
NoOverlap(interval_i, interval_j)
```

và propagation có thể loại bỏ giá trị khỏi domain trước khi search tiếp.

---

# 33. Constraint Propagation

Đây là trái tim của CP.

Giả sử:

$$
x,y\in\{1,2,3,4,5\}
$$

và:

$$
x+y=6.
$$

Nếu:

$$
x=1
$$

thì propagation suy ra:

$$
y=5.
$$

Nếu:

$$
x\ge3
$$

thì:

$$
y\le3.
$$

CP liên tục thu hẹp domain:

```text
Before:
x = {1,2,3,4,5}
y = {1,2,3,4,5}

Constraint x+y=6

After propagation:
x = {1,2,3,4,5}
y = {1,2,3,4,5}

x >= 4

After:
x = {4,5}
y = {1,2}
```

Khi constraint đủ mạnh, search tree giảm rất lớn.

---

# 34. CP-SAT

Đây là một ví dụ hiện đại rất đáng biết.

Google OR-Tools cung cấp **CP-SAT**, kết hợp Constraint Programming với SAT-style techniques để giải các bài integer/constraint optimization. OR-Tools hiện khuyến nghị CP-SAT cho nhiều integer models; mô hình CP-SAT làm việc trên số nguyên, nên các hệ số không nguyên cần được scale sang integer. ([Google for Developers][12])

Ví dụ:

$$
2.5x+1.5y\le10
$$

cần chuyển thành:

$$
5x+3y\le20.
$$

---

# 35. CP phù hợp với loại bài toán nào?

Rất mạnh khi có:

```text
Scheduling
Timetabling
Routing constraints
Assignment
Sequence
Resource constraints
Logical constraints
Precedence
Calendar constraints
```

Ví dụ:

> "Job A phải trước Job B."

> "Hai task không được chồng lên nhau."

> "Nhân viên X không thể làm ngày thứ 3."

Đây là những constraint tự nhiên hơn khi biểu diễn bằng CP.

---

# 36. Một quy tắc thực dụng: MIP hay CP?

Google đưa ra heuristic khá hữu ích:

> MIP thường thuận lợi khi bài toán có thể viết dưới dạng LP chuẩn với các biến integer tùy ý; CP-SAT thường hấp dẫn khi phần lớn biến là Boolean hoặc bài toán có cấu trúc constraint phong phú. Với các mô hình pha trộn integer + Boolean, đôi khi không có khác biệt rõ rệt về hiệu năng. ([Google for Developers][4])

Nhưng đây chỉ là heuristic.

Không có:

$$
\boxed{
"CP luôn tốt hơn MIP"
}
$$

hoặc ngược lại.

Formulation + solver + instance quyết định rất nhiều.

---

# 37. Bây giờ đến hai kỹ thuật decomposition quan trọng

Đây là phần khó nhất của chương:

$$
\boxed{
Column\ Generation
}
$$

và:

$$
\boxed{
Benders\ Decomposition
}
$$

Hai kỹ thuật đều xử lý vấn đề:

> **Mô hình quá lớn để giải trực tiếp.**

Nhưng chúng chia bài toán theo **hai hướng rất khác nhau**.

---

# 38. Column Generation — ý tưởng trước tiên

Giả sử LP/MIP có:

$$
10^{100}
$$

biến.

Không thể đưa tất cả vào master problem.

Column Generation nói:

> Không cần sinh tất cả biến. Chỉ giữ một tập nhỏ các biến có triển vọng.

Ta bắt đầu:

$$
J_0\subset J
$$

và giải:

$$
RMP
$$

(**Restricted Master Problem**).

Sau đó hỏi:

> "Có biến nào chưa xuất hiện nhưng nếu thêm vào thì cải thiện objective không?"

Nếu có:

> thêm biến đó.

Lặp lại.

---

# 39. Vì sao gọi là "Column"?

Trong matrix LP:

$$
Ax=b
$$

mỗi variable tương ứng với một **column** của matrix.

Ví dụ:

$$
\begin{bmatrix}
2&3&7&11\\
1&5&2&9\\
4&1&3&8
\end{bmatrix}
$$

mỗi vector:

$$
\begin{bmatrix}
2\\1\\4
\end{bmatrix}
$$

là một column.

Column generation:

```text
Master matrix

[ c1 c2 c3 ]
[ a1 a2 a3 ]

       ↓ generate new column

[ c1 c2 c3 c4 ]
[ a1 a2 a3 a4 ]
```

---

# 40. Pricing Problem

Đây là linh hồn của Column Generation.

Giả sử master hiện tại cho dual variables:

$$
\pi.
$$

Với một candidate column \(j\), reduced cost:

$$
\bar c_j=c_j-\pi^Ta_j.
$$

Đối với minimization:

$$
\bar c_j<0
$$

nghĩa là column này có tiềm năng cải thiện objective.

Nhưng nếu có hàng tỷ columns, ta không duyệt từng column.

Ta giải một **pricing problem**:

$$
\boxed{
\min_j(c_j-\pi^Ta_j)
}
$$

hoặc một formulation tương đương.

Nếu optimum pricing có:

$$
\bar c_j\ge0
$$

thì **không còn column cải thiện nào**.

Column Generation dừng.

---

# 41. Quy trình Column Generation

```text
           Full Master Problem
                   │
          too many columns
                   │
                   ▼
          Restricted Master
                   │
                 solve
                   │
                   ▼
              dual prices
                   │
                   ▼
             Pricing Problem
                   │
          ┌────────┴────────┐
          │                 │
       improving?       no improving
          │                 │
         yes                │
          │                 ▼
          ▼               STOP
      add column
          │
          └─────────► RMP
```

Đây là một feedback loop rất đẹp.

Desrosiers & Lübbecke trình bày chính xác mô hình này: giải RMP, lấy dual multipliers, rồi giải pricing problem để tìm variable/column có reduced cost cải thiện; nếu không còn reduced-cost cải thiện thì LP master đã đạt optimum. ([Homes di Unimi][13])

---

# 42. Ví dụ kinh điển: Cutting Stock

Giả sử một thanh dài:

$$
L=10.
$$

Ta có các loại item:

```text
A = 6
B = 4
C = 3
```

Có rất nhiều cách cắt:

```text
6+4
3+3+3
4+3+3
6+3
...
```

Mỗi pattern là một **column**.

Vấn đề:

> Số pattern có thể rất lớn.

Không cần liệt kê tất cả.

Master:

$$
\min\sum_{p\in P}\lambda_p
$$

subject to:

$$
\sum_p a_{ip}\lambda_p\ge d_i.
$$

Pricing problem:

> tìm pattern mới có reduced cost âm.

Trong cutting stock, pricing thường trở thành một knapsack problem. Đây là một ví dụ kinh điển của Column Generation được Desrosiers & Lübbecke trình bày. ([Homes di Unimi][13])

---

# 43. Column Generation rất gần với Dynamic Programming

Đây là connection cực hay.

Pricing problem đôi khi là:

```text
Shortest Path
Knapsack
Resource-Constrained Shortest Path
Scheduling DP
```

Tức là:

$$
\boxed{
Huge\ Master
+
small\ structured\ pricing\ problem
}
$$

Vì vậy ta có thể dùng:

$$
DP
$$

ở bên trong:

$$
Column\ Generation.
$$

Ví dụ routing:

```text
Master problem
    ↓
dual prices
    ↓
pricing
    ↓
shortest path with resource constraints
    ↓
new route / column
```

Đây là một trong những lý do decomposition cực mạnh.

---

# 44. Column Generation và Integer Solution

Một điểm rất quan trọng:

> Column Generation cơ bản giải **LP relaxation của restricted/master formulation**.

Nó không tự động đảm bảo integer solution.

Ví dụ:

$$
\lambda_1=0.5,\quad
\lambda_2=0.5.
$$

Có thể là LP-optimal nhưng không integer.

Khi đó cần:

$$
\boxed{
Branch\&Bound
+
Column\ Generation
}
$$

gọi là:

$$
\boxed{
Branch\text{-}and\text{-}Price
}
$$

Barnhart et al. mô tả Branch-and-Price như việc kết hợp column generation với branch-and-bound để giải các integer programs rất lớn. ([PubsOnline][14])

---

# 45. Branch-and-Price

Cấu trúc:

```text
                    Root
                     │
              Column Generation
                     │
              fractional solution
                     │
                  Branch
              ┌──────┴──────┐
              │             │
             Node          Node
              │             │
          pricing        pricing
              │             │
           branch         branch
             ...            ...
```

Mỗi node có pricing problem riêng.

Đây là một bước nâng cao đáng kể.

---

# 46. Column Generation: điểm mạnh

Rất phù hợp khi:

* formulation tự nhiên có số variable khổng lồ;
* mỗi variable tương ứng với một cấu trúc có ý nghĩa;
* pricing problem có thể giải hiệu quả.

Ví dụ:

```text
vehicle route
crew schedule
cutting pattern
set partition
configuration
path
```

---

# 47. Nhưng Column Generation có vấn đề gì?

### 1. Tail-off

Objective cải thiện ngày càng ít:

```text
100
90
85
82
81
80.5
80.2
80.1
...
```

nhưng phải chạy rất nhiều iterations.

### 2. Fractionality

LP solution không integer.

### 3. Pricing khó

Nếu pricing problem cũng NP-hard thì decomposition không tự động biến bài toán thành dễ.

### 4. Branching phức tạp

Branching phải được thiết kế sao cho pricing vẫn giải được.

Desrosiers & Lübbecke thảo luận cả tailing-off, partial pricing, stabilization và vấn đề branch-and-bound sau column generation. ([ResearchGate][15])

---

# 48. Benders Decomposition

Bây giờ đổi hướng hoàn toàn.

Column Generation thường nói:

> "Mô hình có quá nhiều **columns/variables**."

Benders thường nói:

> "Bài toán có thể chia thành **master variables + subproblem variables**."

Đặc biệt hữu ích khi có một tập biến "chiến lược" và một tập biến "operational".

Ví dụ:

```text
Master:
    quyết định mở facility nào

Subproblem:
    sau khi facility được chọn,
    tối ưu vận chuyển hàng
```

---

# 49. Mô hình Benders cơ bản

Xét:

$$
\min c^Tx+d^Ty
$$

subject to:

$$
Ax+By\ge b
$$

$$
x\in X
$$

$$
y\ge0.
$$

Ta coi:

$$
x
$$

là master variable.

Với \(x\) cố định, giải:

$$
Q(x)
=
\min_y
\{d^Ty:By\ge b-Ax,\ y\ge0\}.
$$

Khi đó bài toán trở thành:

$$
\min_{x\in X}\ c^Tx+Q(x).
$$

Vấn đề:

> \(Q(x)\) vẫn phức tạp.

Benders xử lý \(Q(x)\) thông qua dual của subproblem.

---

# 50. Ý tưởng Benders cực kỳ đẹp

Thay vì giải đồng thời:

```text
x + y
```

ta:

```text
MASTER
   │
choose x
   │
   ▼
SUBPROBLEM
   │
evaluate whether y exists
   │
   ├── infeasible
   │       ↓
   │   feasibility cut
   │
   └── feasible
           ↓
      optimality cut
           │
           └────► MASTER
```

Đây cũng là một feedback loop.

---

# 51. Feasibility Cut

Giả sử master chọn:

$$
x=x^k
$$

nhưng subproblem không khả thi.

Ta không chỉ nói:

> "x này sai."

Ta tìm một inequality loại bỏ không chỉ \(x^k\), mà cả một vùng \(x\) dẫn tới infeasibility tương tự.

Đó là:

$$
\boxed{
Feasibility\ Cut
}
$$

Mục tiêu:

$$
\text{loại bỏ master decisions không thể có completion}
$$

---

# 52. Optimality Cut

Giả sử subproblem feasible.

Ta giải dual:

$$
\max \pi^T(b-Ax)
$$

subject to các dual feasibility constraints.

Một dual solution \(\pi^k\) tạo ra bound:

$$
\theta
\ge
\pi^{kT}(b-Ax).
$$

Ở master ta có:

$$
\min c^Tx+\theta
$$

với cut:

$$
\boxed{
\theta
\ge
\pi^{kT}(b-Ax)
}
$$

Mỗi lần subproblem cho ta thông tin mới về:

> "Nếu master chọn \(x\), operational cost ít nhất là bao nhiêu?"

---

# 53. Benders master problem

Master thường có dạng:

$$
\begin{aligned}
\min\quad &c^Tx+\theta\\
\text{s.t.}\quad&
x\in X\\
&\theta\ge \pi_k^T(b-Ax),
\quad k=1,\dots,K\\
&\text{feasibility cuts}
\end{aligned}
$$

Ban đầu \(K\) nhỏ.

Qua từng iteration:

$$
K\rightarrow K+1.
$$

Master ngày càng hiểu subproblem hơn.

---

# 54. Ví dụ dễ hình dung: Facility Location

Giả sử ta cần quyết định mở kho.

### Master

$$
x_j=
\begin{cases}
1 & mở kho j\\
0 & không
\end{cases}
$$

### Subproblem

Sau khi biết kho nào mở:

$$
y_{ij}=
\text{lượng hàng từ kho }j\text{ tới khách }i.
$$

Flow problem có thể:

* feasible;
* infeasible;
* expensive.

Benders:

```text
Master
  ↓
open warehouses
  ↓
Subproblem
  ↓
shipping optimization
  ↓
cost / infeasibility
  ↓
Benders cut
  ↓
Master
```

Đây là một decomposition rất tự nhiên.

IBM CPLEX mô tả Benders như việc tách một formulation thành một master và một hoặc nhiều subproblems; CPLEX có thể phân chia MILP theo annotations hoặc tự động trong một số trường hợp. ([IBM][16])

---

# 55. Tại sao Benders dùng Duality?

Đây là chỗ LP Duality từ phần đầu quay trở lại.

Subproblem primal:

$$
Q(x)=
\min\{d^Ty:By\ge b-Ax,\ y\ge0\}.
$$

Dual:

$$
\max\{(b-Ax)^T\pi:B^T\pi\le d,\ \pi\ge0\}.
$$

Observe:

$$
x
$$

chỉ xuất hiện trong objective của dual.

Nếu \(\pi^k\) dual feasible:

$$
\theta
\ge
(b-Ax)^T\pi^k
$$

là một valid lower bound cho subproblem value.

→ Đây chính là **Benders optimality cut**.

Cho nên:

$$
\boxed{
Benders
=
decomposition
+
LP\ duality
}
$$

---

# 56. Benders và Column Generation: đối xứng tuyệt đẹp

Hai kỹ thuật này thường gây nhầm lẫn.

## Column Generation

Chia theo:

> **columns / variables**

```text
Master
  ↓
dual prices
  ↓
pricing
  ↓
new column
  ↓
Master
```

## Benders

Chia theo:

> **variables / constraints / subproblem**

```text
Master
  ↓
master decision
  ↓
subproblem
  ↓
dual information
  ↓
new cut
  ↓
Master
```

Một cách nhớ:

$$
\boxed{
Column\ Generation:
\text{add columns}
}
$$

$$
\boxed{
Benders:
\text{add cuts}
}
$$

---

# 57. Nhưng cả hai đều là "Generate on Demand"

Đây mới là insight sâu.

### Ordinary formulation

```text
generate everything
↓
solve
```

### Column Generation

```text
generate useful columns on demand
```

### Benders

```text
generate useful cuts on demand
```

Do đó cả hai cùng theo triết lý:

$$
\boxed{
\text{Don't explicitly build what you don't yet need.}
}
$$

---

# 58. Column Generation vs Benders

|                   | Column Generation   | Benders                 |
| ----------------- | ------------------- | ----------------------- |
| Dynamic object    | Column              | Cut                     |
| Master            | Restricted master   | Master decisions        |
| Auxiliary problem | Pricing             | Subproblem              |
| Information       | Dual prices         | Dual rays/solutions     |
| Add               | Variables           | Constraints             |
| Typical structure | Huge variable space | Coupled variable blocks |
| Famous extension  | Branch-and-Price    | Branch-and-Benders      |
| Key mathematics   | Reduced cost / dual | Duality / decomposition |

---

# 59. Branch & Cut vs Benders

Đây cũng là cặp dễ nhầm.

### Branch & Cut

Không nhất thiết chia problem thành subproblems có cấu trúc.

Nó làm:

$$
LP
\rightarrow
cuts
\rightarrow
branch
\rightarrow
cuts
\rightarrow\cdots
$$

### Benders

Có decomposition rõ:

$$
Master
\leftrightarrow
Subproblem.
$$

Benders tạo **problem-specific cuts** từ subproblem dual.

---

# 60. Có thể kết hợp tất cả không?

Có.

Solver hiện đại có thể có:

$$
\boxed{
Branch
+
Cut
+
Price
+
Decomposition
+
Heuristic
+
Presolve
}
$$

Một kiến trúc rất mạnh là:

$$
\boxed{
Branch\text{-}Cut\text{-}and\text{-}Price
}
$$

SCIP chính thức mô tả mình là framework cho branch-cut-and-price và có cả pricing, cutting plane, propagation, Benders decomposition. ([Scipopt][1])

---

# 61. "Price" ở đây không phải tiền

Trong Column Generation:

> pricing = tìm variable nào đáng đưa vào master.

Đó là giá trị theo **reduced cost / dual prices**, không phải "giá".

Ví dụ:

$$
\bar c_j=c_j-\pi^Ta_j.
$$

Nếu:

$$
\bar c_j<0
$$

thì column có "giá" hấp dẫn để đưa vào basis của minimization master.

---

# 62. Một bức tranh thống nhất

Đến đây ta có thể nhìn toàn bộ Chương 15:

```text
                 Mathematical Optimization
                           │
                           ▼
                         Model
                           │
             ┌─────────────┴─────────────┐
             │                           │
            LP                        Integer
             │                           │
       primal / dual                  ILP/MIP
             │                           │
             │                  ┌────────┴────────┐
             │                  │                 │
             │             LP relaxation       CP
             │                  │
             │          Branch-and-Bound
             │                  │
             │             Branch-and-Cut
             │
             ├──────────────┐
             │              │
             ▼              ▼
      Column Generation   Benders
             │              │
       add columns       add cuts
             │              │
      Branch-and-Price   Benders + B&B
```

---

# 63. Điểm đặc biệt: LP đứng phía sau gần như mọi thứ

LP không chỉ là một chương con.

Nó là **engine** của rất nhiều thuật toán.

$$
\boxed{
LP
}
$$

xuất hiện trong:

* LP relaxation của MIP;
* Branch-and-Bound;
* Branch-and-Cut;
* Column Generation master;
* pricing duality;
* Benders subproblem;
* Benders dual;
* lower bounds;
* shadow prices;
* reduced costs.

Nói cách khác:

> **Học LP sâu sẽ mở khóa phần lớn mathematical optimization còn lại.**

---

# 64. Mối quan hệ với Exact Search chương 3

Đây là một connection rất quan trọng.

Chương 3:

$$
DFS/Branch\&Bound
$$

có dạng:

```text
enumerate
   ↓
bound
   ↓
prune
```

MIP:

```text
branch
   ↓
solve LP relaxation
   ↓
bound
   ↓
cut
   ↓
prune
```

Do đó:

$$
\boxed{
MIP = Exact Search + Mathematical Bounds + Polyhedral Machinery
}
$$

Tất nhiên đây không phải định nghĩa hình thức, nhưng là một mental model rất tốt.

---

# 65. Mối quan hệ với chương 4 — Approximation

Approximation hỏi:

> "Tôi có guarantee?"

Ví dụ:

$$
f(S)\le2OPT.
$$

MIP/Exact Optimization hỏi:

> "Tôi có thể chứng minh optimum không?"

Hai thế giới khác nhau:

```text
Approximation
     ↓
fast
     ↓
quality guarantee
     ↓
not necessarily optimum

Exact MIP
     ↓
search + bounds
     ↓
prove optimum
     ↓
may be computationally expensive
```

MIP solver cũng có thể dừng sớm với gap để tạo **anytime optimization**:

```text
solution = 135
bound    = 140
gap      = 3.7%
```

Đây là vùng giao nhau rất thú vị giữa exact và heuristic.

---

# 66. Mối quan hệ với Local Search / ALNS

Đây mới là điểm cực kỳ thực chiến.

MIP solver thường cần:

> **good incumbent.**

ALNS có thể cung cấp:

$$
S_{heuristic}
$$

làm starting solution.

Ngược lại MIP có thể cung cấp:

$$
LB/UB
$$

cho metaheuristic.

Ta có:

```text
              ALNS
             ↙    ↘
       good solution
             ↓
            MIP
             ↓
        exact / bound
             ↓
       improve ALNS
```

Đây là **Matheuristic**.

---

# 67. Matheuristic

Matheuristic là sự kết hợp:

$$
\boxed{
Mathematical\ Optimization
+
Metaheuristic
}
$$

Ví dụ:

### ALNS + MIP Repair

```text
ALNS
 ↓
Destroy 30%
 ↓
MIP solves destroyed part exactly
 ↓
candidate
 ↓
Local Search
```

Hoặc:

### MIP + Large Neighborhood

```text
MIP incumbent
   ↓
fix 90% variables
   ↓
release 10%
   ↓
solve MIP subproblem
   ↓
new incumbent
```

Điều này gần như chính là tinh thần của LNS exact repair mà ta đã nói ở chương 13.

---

# 68. LNS nhìn dưới Mathematical Optimization

Recall chương 13:

$$
x_i=x_i^t,\qquad i\notin F
$$

và cho phép:

$$
x_i\text{ tự do},\qquad i\in F.
$$

Sau đó giải exact subproblem:

$$
x^{t+1}
=
\arg\min f(x).
$$

Bây giờ ta nhận ra:

$$
\boxed{
LNS + exact\ subproblem
=
Mathematical\ Optimization\ neighborhood
}
$$

Đây là một bridge rất đẹp giữa hai nửa curriculum.

---

# 69. Benders và LNS cũng có điểm chung

Cả hai đều có tư tưởng:

> chia bài toán lớn thành những phần nhỏ hơn.

Nhưng:

### LNS

```text
destroy
→ release variables
→ optimize subproblem
```

### Benders

```text
fix master variables
→ solve dependent subproblem
→ infer cuts
→ change master
```

LNS thay đổi variables trực tiếp.

Benders **học từ subproblem để thay đổi master formulation**.

---

# 70. Khi nào dùng LP?

LP phù hợp khi:

* variables continuous;
* objective linear;
* constraints linear;
* hoặc LP relaxation đủ hữu ích.

Ví dụ:

```text
flow
production amount
resource allocation
portfolio
blending
transportation
```

LP thường cực nhanh so với MIP cùng kích thước.

---

# 71. Khi nào dùng ILP/MIP?

Khi cần:

```text
yes/no decisions
counting decisions
assignment
selection
facility opening
routing
scheduling with linear formulation
sequencing
packing
```

Đặc biệt:

$$
x\in\{0,1\}
$$

là cực kỳ mạnh để encode combinatorial decisions.

---

# 72. Khi nào dùng CP?

Khi constraint logic/sequence/scheduling chiếm ưu thế:

```text
A trước B
A và B không overlap
mỗi người tối đa 2 shift
task này phải nằm trong một khoảng thời gian
AllDifferent
Cumulative
NoOverlap
```

CP thường cho một ngôn ngữ mô hình tự nhiên hơn.

---

# 73. Khi nào dùng Column Generation?

Hãy hỏi:

> "Liệu mỗi variable có thể đại diện cho một **structure** lớn và số structures là khổng lồ?"

Ví dụ:

```text
one variable = one route
one variable = one schedule
one variable = one cutting pattern
one variable = one configuration
```

Nếu:

$$
|J|\gg10^6
$$

thì Column Generation có thể là hướng rất đáng xem xét — miễn là pricing problem có thể giải được.

---

# 74. Khi nào dùng Benders?

Hãy hỏi:

> "Bài toán có thể chia thành quyết định cấp cao + operational subproblem không?"

Ví dụ:

```text
strategic decision
      ↓
operational optimization
```

Rất điển hình:

```text
facility location
network design
capacity planning
production planning
stochastic programming
```

Nếu sau khi fix \(x\), subproblem \(y\) rất dễ giải → Benders có thể rất mạnh.

---

# 75. Khi nào dùng Branch & Cut?

Khi:

> formulation MIP khá tốt nhưng LP relaxation vẫn có fractional solutions.

Ta muốn:

$$
\text{tighten relaxation}
$$

bằng cuts.

Đặc biệt hữu ích khi có **problem-specific valid inequalities**.

Ví dụ TSP:

```text
degree constraints
+
subtour elimination
+
branching
+
cuts
```

Branch-and-Cut là một trong những kỹ thuật nền tảng của MIP solvers hiện đại. CPLEX xử lý MIP bằng branch-and-cut, với cut separation ở root hoặc các node tùy tình huống. ([IBM][8])

---

# 76. Một ví dụ tổng hợp: TSP

Đây là ví dụ tuyệt vời để kết nối cả curriculum.

Ta có binary:

$$
x_{ij}=
\begin{cases}
1&i\to j\\
0&otherwise
\end{cases}
$$

Objective:

$$
\min\sum_{i,j}c_{ij}x_{ij}
$$

degree constraints:

$$
\sum_jx_{ij}=1
$$

$$
\sum_ix_{ij}=1.
$$

Nhưng có thể xuất hiện subtour:

```text
A → B → C → A

D → E → F → D
```

Không phải Hamiltonian cycle.

Ta cần subtour elimination cuts.

Đây là:

$$
\boxed{
Branch\&Cut
}
$$

và chính CPLEX có ví dụ Benders ATSP sử dụng lazy constraints/user cuts để tách các ràng buộc cần thiết trong search. ([IBM][17])

---

# 77. TSP và Column Generation

Một formulation khác:

$$
\lambda_r=
\begin{cases}
1&route/path/r{\text{ được chọn}}\\
0&otherwise
\end{cases}
$$

Số route khổng lồ.

Ta dùng:

$$
\boxed{
Column\ Generation
}
$$

pricing có thể là:

$$
Shortest\ Path
$$

hoặc:

$$
Resource\text{-}Constrained\ Shortest\ Path.
$$

Và nếu cần integer:

$$
\boxed{
Branch\text{-}and\text{-}Price.
}
$$

---

# 78. TSP và Benders

Cũng có thể tách:

```text
Master:
    chọn cạnh

Subproblem:
    kiểm tra/cấu trúc route
```

và generate cuts.

Cho nên một bài toán combinatorial có thể có **nhiều formulation và nhiều decomposition khác nhau**.

Đây là bài học cực quan trọng:

> **Bài toán ≠ formulation.**

Một bài toán có thể có nhiều model.

---

# 79. Tại sao formulation là một kỹ năng độc lập?

Giả sử cậu biết:

* Branch & Bound;
* Branch & Cut;
* MIP solver.

Nhưng formulation của cậu yếu:

$$
OPT_{LP}=200
$$

trong khi:

$$
OPT_{IP}=100.
$$

Solver sẽ rất vất vả.

Một formulation tốt:

$$
OPT_{LP}=98.
$$

có thể khiến cùng solver chạy cực nhanh.

Do đó optimization scientist thường dành rất nhiều thời gian vào:

$$
\boxed{
Modeling
}
$$

chứ không chỉ chọn algorithm.

---

# 80. Presolve

Trước khi Branch & Cut, solver thường simplfy model.

Ví dụ:

$$
x\le5
$$

$$
x\ge7
$$

→ infeasible ngay.

Hoặc:

$$
x\le5
$$

$$
x\ge0
$$

$$
2x\le10
$$

→ constraint \(2x\le10\) là redundant.

Presolve có thể:

* tighten bounds;
* remove redundant constraints;
* eliminate variables;
* detect infeasibility;
* aggregate constraints;
* strengthen coefficients.

Đây là một phần rất lớn của solver performance dù người dùng hiếm khi nhìn thấy.

---

# 81. Heuristics bên trong MIP solver

Một insight rất hay:

> Mathematical Optimization không có nghĩa solver thuần exact brute-force.

MIP solver thực tế có thể sử dụng:

```text
LP relaxation
cuts
branching
presolve
primal heuristics
local search
RINS
feasibility pump
diving
symmetry handling
...
```

Tức là:

$$
\boxed{
Exact\ framework
+
Heuristic\ machinery
}
$$

Đây là lý do metaheuristics và mathematical optimization không phải hai thế giới hoàn toàn tách biệt.

---

# 82. MIP solver như một "metaheuristic + proof engine"

Đây là mental model khá hữu ích:

```text
              MIP Solver
                   │
         ┌─────────┴─────────┐
         │                   │
       Search              Proof
         │                   │
    heuristics             bounds
    branching               cuts
    incumbents             relaxation
         │                   │
         └─────────┬─────────┘
                   ▼
          optimal / gap proof
```

Heuristic giúp tìm \(LB\).

Mathematical machinery giúp cải thiện \(UB\) và chứng minh.

---

# 83. Exactness của Branch & Cut

Tại sao Branch & Cut vẫn exact?

Vì:

1. cuts phải valid;
2. branching cuối cùng phân hoạch integer domain;
3. LP bounds là valid;
4. nếu search hoàn tất và:

$$
LB=UB
$$

thì optimum được chứng minh.

Do đó cuts không "heuristic" theo nghĩa làm mất tính exact, miễn chúng là valid inequalities và được dùng đúng cách.

IBM cũng phân biệt rõ **user cuts** và **lazy constraints**: user cuts phải không loại bỏ feasible integer solutions; lazy constraints thì là các ràng buộc thật sự thuộc model nhưng được đưa vào động để tránh phải nạp tất cả ngay từ đầu. ([IBM][17])

---

# 84. Benders có exact không?

Có.

Nếu:

* master được giải chính xác;
* subproblem được giải chính xác;
* feasibility/optimality cuts được sinh đúng;
* quá trình hội tụ hoàn tất,

thì Benders có thể chứng minh optimality.

Điều này phân biệt nó với:

```text
heuristic decomposition
```

chỉ nhằm tìm solution tốt.

---

# 85. Column Generation có exact không?

### Với LP

Column Generation có thể giải exact LP master nếu pricing được giải exact và termination condition đúng.

### Với ILP

Column Generation đơn thuần **chưa đủ**.

Cần branch-and-price hoặc một cơ chế integerization khác.

Đây là điểm rất dễ nhầm.

---

# 86. So sánh bảy thành phần của chương

| Kỹ thuật              | Bản chất                         | Mục tiêu                 |
| --------------------- | -------------------------------- | ------------------------ |
| **LP**                | Continuous linear optimization   | tối ưu liên tục          |
| **ILP**               | Linear + integer                 | discrete decisions       |
| **MIP/MILP**          | Linear + mixed variables         | model thực tế            |
| **CP**                | constraints + propagation/search | constraint-rich problems |
| **Column Generation** | generate variables on demand     | huge variable space      |
| **Branch & Cut**      | branch + valid inequalities      | exact MIP search         |
| **Benders**           | master + subproblem + cuts       | exploit decomposition    |

---

# 87. Bản đồ tư duy quan trọng nhất của chương

```text
                         MODEL
                           │
              ┌────────────┼────────────┐
              │            │            │
             LP           MIP           CP
              │            │
              │            ├──── LP relaxation
              │            │
              │            ├──── Branch & Bound
              │            │
              │            └──── Branch & Cut
              │
              │
              ├──── Duality
              │       │
              │       ├──── Reduced Cost
              │       │
              │       ├──── Column Generation
              │       │          │
              │       │          └── Branch-and-Price
              │       │
              │       └──── Benders
              │
              └──── Bounds / Certificates
```

---

# 88. Hai "động cơ" lớn của mathematical optimization

Nếu phải cô đọng cả chương vào hai cơ chế:

## Engine 1 — Relaxation

Ta giải một bài toán **dễ hơn**:

$$
Original
\rightarrow
Relaxation
$$

để lấy:

$$
Bound.
$$

---

## Engine 2 — Decomposition

Ta chia bài toán:

$$
Large\ problem
\rightarrow
smaller\ structured\ problems.
$$

Column Generation và Benders chính là hai biểu hiện kinh điển của engine này.

---

# 89. Một cách nhìn rất sâu về Column Generation

Column Generation hỏi:

> "Trong không gian nghiệm cực lớn, **hướng/cấu trúc nào chưa xuất hiện nhưng đáng thêm vào?**"

Mathematically:

$$
\bar c_j<0?
$$

Nếu có:

$$
add\ column.
$$

---

# 90. Một cách nhìn rất sâu về Benders

Benders hỏi:

> "Master decision này dẫn đến operational consequences nào mà master hiện chưa biết?"

Subproblem trả lời.

Nếu infeasible:

$$
\text{thêm knowledge: không được chọn vùng này}.
$$

Nếu feasible:

$$
\text{thêm knowledge: cost phải ít nhất như vậy}.
$$

Do đó Benders thực chất là:

$$
\boxed{
\text{learn constraints about the master}
}
$$

thông qua subproblem.

---

# 91. Và Branch & Cut hỏi:

> "Fractional relaxation đang cho phép những điều gì không thể xảy ra trong integer world?"

Sau đó:

$$
\text{find valid inequality}
$$

để loại bỏ chúng.

Vì vậy:

```text
Column Generation
→ add variables

Benders
→ add decomposition cuts

Branch & Cut
→ add valid inequalities
```

Đây là ba tư tưởng "generate-on-demand" rất khác nhau nhưng có cùng triết lý.

---

# 92. Liên hệ trực tiếp với bài toán kỹ thuật viên điều hòa

Bây giờ thử model hóa bài toán mà cậu đã nghiên cứu suốt các chương trước.

Ta có thể tạo:

### Selection variable

$$
x_i=
\begin{cases}
1 & \text{clean house }i\\
0 & \text{otherwise}
\end{cases}
$$

### Day assignment

$$
z_{i,d}
=
1
$$

nếu house \(i\) làm vào ngày \(d\).

### Routing

$$
y_{i,j,d}
=
1
$$

nếu ngày \(d\):

$$
i\to j.
$$

### Time

$$
t_{i,d}.
$$

### Objective

Có thể viết:

$$
\max
\sum_i p_i x_i
+
\sum_i overtime_i.
$$

Rồi thêm:

```text
house served at most once
day assignment
route continuity
time budget
daily boundary
travel time
cleaning time
```

Đây là một MIP rất tự nhiên.

---

# 93. Nhưng formulation này có thể khổng lồ

Nếu:

$$
n=300
$$

thì:

$$
y_{i,j,d}
$$

có thể tới:

$$
O(Dn^2).
$$

Và nếu mô tả route bằng sequence variables hoặc path variables thì còn phức tạp hơn.

Đây chính là nơi decomposition xuất hiện.

---

# 94. Có thể dùng Column Generation cho AC problem

Ta có thể coi:

> **một route hợp lệ trong một ngày = một column.**

Ví dụ:

```text
Day 1 route:
Depot → H12 → H25 → H71 → Depot

Day 2 route:
Depot → H5 → H80 → H21 → H3 → Depot
```

Mỗi route có:

* tập house;
* thời gian;
* doanh thu;
* travel cost;
* feasibility.

Master chọn route nào cho từng ngày.

Pricing:

> tìm một route mới có reduced cost tốt.

Pricing có thể liên quan đến:

$$
\text{resource-constrained shortest path}
$$

với resource là:

$$
time\le720.
$$

Đây là một hướng nghiên cứu cực kỳ tự nhiên.

---

# 95. Có thể dùng Benders cho AC problem

Tách:

### Master

Quyết định:

```text
house nào được phục vụ
house nào vào ngày nào
```

### Subproblem

Cho assignment đó:

> tìm route tối ưu cho từng ngày.

Do đó:

```text
Master
   │
   ▼
Selected houses / day
   │
   ▼
Routing subproblem
   │
   ├── impossible
   │      ↓
   │   feasibility cut
   │
   └── feasible
          ↓
       route cost
          ↓
      optimality cut
```

Đây là một cấu trúc Benders rất đẹp.

---

# 96. Và có thể dùng CP

Thay vì MIP:

```text
NoOverlap
Cumulative
Interval Variables
Sequence
precedence
```

có thể mô hình hóa:

```text
house cleaning = interval
travel = sequence transition
day capacity = cumulative
```

Nếu phần scheduling/sequence là nút thắt lớn, CP-SAT có thể rất đáng thử.

---

# 97. Và có thể hybrid với ALNS

Ta đã có ở chương 14:

$$
ALNS.
$$

Bây giờ có thể tạo:

$$
\boxed{
ALNS + MIP
}
$$

Ví dụ:

```text
ALNS
 ↓
Destroy 20 houses
 ↓
MIP optimizes those 20 houses
 ↓
VND
 ↓
Acceptance
```

Hoặc:

$$
\boxed{
ALNS + CP
}
$$

hoặc:

$$
\boxed{
ALNS + Benders
}
$$

hoặc:

$$
\boxed{
ALNS + Column\ Generation
}
$$

Đây chính là lý do Mathematical Optimization xuất hiện ở **chương áp chót**: nó kết nối rất nhiều thứ đã học trước đó.

---

# 98. Toàn bộ curriculum giờ đây bắt đầu hội tụ

Ta có:

```text
                 Combinatorial Optimization
                           │
        ┌──────────────────┴───────────────────┐
        │                                      │
   Exact / Mathematical                  Heuristic
        │                                      │
    LP / MIP / CP                         Local Search
        │                               SA / Tabu / ILS
   Branch & Cut                         VNS / LNS / ALNS
        │                                      │
   Decomposition                               │
   ├── Column Generation                       │
   └── Benders                                 │
        │                                      │
        └──────────────┬───────────────────────┘
                       ▼
                  Matheuristics
```

Đây là bức tranh mà tôi muốn cậu giữ lại sau chương này.

---

# 99. Điều quan trọng nhất cần học ở chương 15

Không phải nhớ cú pháp:

```text
LP
ILP
MIP
CP
...
```

mà phải hiểu **5 tầng tư duy**.

### Tầng 1 — Modeling

$$
\boxed{
\text{Real problem}
\rightarrow
\text{variables + constraints + objective}
}
$$

### Tầng 2 — Relaxation

$$
\boxed{
\text{hard problem}
\rightarrow
\text{easier problem}
\rightarrow
\text{bound}
}
$$

### Tầng 3 — Search

$$
\boxed{
\text{branch}
\rightarrow
\text{prune}
}
$$

### Tầng 4 — Strengthening

$$
\boxed{
\text{cuts}
\rightarrow
\text{stronger relaxation}
}
$$

### Tầng 5 — Decomposition

$$
\boxed{
\text{large model}
\rightarrow
\text{master + structured subproblem}
}
$$

Và từ đây:

$$
\boxed{
Column\ Generation:
\text{generate columns}
}
$$

$$
\boxed{
Benders:
\text{generate cuts}
}
$$

---

# 100. Bảng "nên nghĩ gì trước khi chọn phương pháp?"

| Câu hỏi                                                  | Hướng nên nghĩ                   |
| -------------------------------------------------------- | -------------------------------- |
| Biến liên tục, mọi thứ tuyến tính?                       | **LP**                           |
| Có quyết định nguyên/binary?                             | **ILP/MIP**                      |
| Nhiều constraint logic/sequence/scheduling?              | **CP/CP-SAT**                    |
| MIP nhưng LP relaxation yếu?                             | **Strengthening / Branch & Cut** |
| Số variable khổng lồ nhưng mỗi variable là một cấu trúc? | **Column Generation**            |
| Có master decision → operational subproblem?             | **Benders**                      |
| Exact quá chậm nhưng cần nghiệm tốt?                     | **ALNS / Matheuristic**          |
| Có heuristic tốt + MIP solver?                           | **Hybrid / Matheuristic**        |

---

# 101. Một "cheat sheet" cực ngắn

$$
\boxed{
LP = continuous
}
$$

$$
\boxed{
ILP = integer
}
$$

$$
\boxed{
MIP/MILP = mixed\ integer + continuous
}
$$

$$
\boxed{
CP = constraints + propagation/search
}
$$

$$
\boxed{
Branch\&Cut =
Branch\&Bound + Valid\ Inequalities
}
$$

$$
\boxed{
Column\ Generation =
Restricted\ Master + Pricing
}
$$

$$
\boxed{
Benders =
Master + Subproblem + Cuts
}
$$

---

# 102. Những connection cần thuộc lòng

Đây là phần tôi đánh giá quan trọng nhất:

$$
\boxed{
LP\ Duality
\rightarrow
Reduced\ Cost
\rightarrow
Column\ Generation
}
$$

$$
\boxed{
LP\ Relaxation
\rightarrow
Bound
\rightarrow
Branch\&Bound
\rightarrow
Branch\&Cut
}
$$

$$
\boxed{
LP\ Duality
\rightarrow
Subproblem\ Dual
\rightarrow
Benders\ Cuts
}
$$

và:

$$
\boxed{
MIP/CP
\leftrightarrow
Metaheuristics
\rightarrow
Matheuristics
}
$$

---

# 103. Một điểm rất quan trọng về "solver"

Cậu sẽ gặp những cái tên như:

* Gurobi;
* CPLEX;
* SCIP;
* OR-Tools;
* HiGHS;
* CBC;
* MOSEK.

Đừng hiểu:

> "Gurobi là một thuật toán."

Không.

Solver là **một hệ thống triển khai nhiều thuật toán**.

Ví dụ một MIP solver có thể gồm:

```text
Presolve
LP solver
Branching
Cut separation
Primal heuristics
Symmetry detection
Conflict analysis
Node selection
Parallel search
...
```

SCIP hiện mô tả rõ mình không chỉ là MIP solver mà còn là framework cho constraint integer programming và branch-cut-and-price. ([Scipopt][1])

---

# 104. Nên học thực hành bằng solver nào?

Để học, **OR-Tools** là một điểm bắt đầu rất tốt vì có API cho:

* LP;
* MIP;
* CP-SAT;
* routing.

Google hiện cung cấp ví dụ cho tất cả các nhóm này và hỗ trợ C++, Python, Java, C#. ([Google for Developers][18])

Còn nếu muốn đào sâu vào kiến trúc solver/exact optimization:

$$
\boxed{SCIP}
$$

rất đáng nghiên cứu vì framework của nó phơi bày nhiều khái niệm ta vừa học:

$$
branching,\ cutting,\ pricing,\ propagation,\ Benders.
$$

([Scipopt][1])

---

# 105. Các nguồn nghiên cứu cốt lõi tôi đã đối chiếu

Tôi không chỉ dựa trên một tutorial đơn lẻ. Các nguồn quan trọng gồm:

**MIT OpenCourseWare** — các lecture về LP duality, integer programming, formulations, cutting planes và branch-and-bound. ([MIT OpenCourseWare][6])

**Google OR-Tools** — tài liệu hiện hành về LP/MIP/CP-SAT và hướng dẫn lựa chọn solver. ([Google for Developers][4])

**IBM CPLEX** — tài liệu về branch-and-cut, cuts, Benders và distinction giữa user cuts/lazy constraints. ([IBM][8])

**SCIP** — kiến trúc solver hiện đại hỗ trợ MIP, MINLP, branch-cut-and-price, pricing và Benders. ([Scipopt][1])

**Desrosiers & Lübbecke, *A Primer in Column Generation*** — tài liệu kinh điển để hiểu RMP, dual multipliers, reduced cost, pricing, branch-and-price và các vấn đề thực thi column generation. ([Publications Polymtl][19])

**Barnhart et al., *Branch-and-Price: Column Generation for Solving Huge Integer Programs* (1998)** — nguồn kinh điển cho Branch-and-Price. ([PubsOnline][14])

**Benders, *Partitioning procedures for solving mixed-variables programming problems* (1962)** — công trình gốc đặt nền tảng cho Benders decomposition. ([Cổng thông tin Nghiên cứu TU Eindhoven][20])

---

# 106. Kết luận của chương 15

Nếu phải nén **toàn bộ chương** thành một sơ đồ duy nhất, tôi sẽ dùng:

```text
                         MATHEMATICAL OPTIMIZATION
                                  │
                           Model the problem
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                   LP                       Integer?
                    │                           │
             Continuous world              MIP / ILP
                    │                           │
               Duality                  LP Relaxation
                    │                           │
             ┌──────┴──────┐             ┌────┴────┐
             │             │             │         │
        Reduced Cost    Dual Bounds    Branch    Cuts
             │                           │         │
             ▼                           └────┬────┘
     Column Generation                        │
             │                           Branch & Cut
             ▼
      Branch-and-Price

                    Separate decomposition:
                              │
                           Benders
                              │
                    Master ↔ Subproblem

                    Another paradigm:
                              │
                              ▼
                             CP
                    domains + propagation
```

Và connection quan trọng nhất với **13 chương trước** là:

$$
\boxed{
\text{Metaheuristic tìm nghiệm}
\quad\Longleftrightarrow\quad
\text{Mathematical Optimization chứng minh/bound nghiệm}
}
$$

Metaheuristic mạnh ở **exploration**; mathematical optimization mạnh ở **structure, bounds, relaxation và certificates**. Khi ghép chúng:

$$
\boxed{
\text{ALNS + MIP/CP/CG/Benders}
=
\text{Matheuristic}
}
$$

thì ta có một lớp thuật toán rất mạnh trong thực tế.

Đặc biệt đối với bài toán kỹ thuật viên điều hòa của cậu, chương này mở ra **ít nhất bốn hướng nghiên cứu hoàn toàn khác nhau**: một MILP trực tiếp, CP-SAT cho scheduling/routing constraints, Column Generation với **mỗi route là một column**, và Benders với **house/day assignment là master — routing từng ngày là subproblem**. Đây chính là nơi ta có thể lấy bài toán thực tế ban đầu và biến toàn bộ kiến thức từ Chương 1–15 thành một hệ thống tối ưu thống nhất.

[1]: https://scipopt.org/?utm_source=chatgpt.com "SCIP"
[2]: https://courses.csail.mit.edu/6.854/18/Notes/n12-duality.html?utm_source=chatgpt.com "6.854 Lecture Notes"
[3]: https://ocw.mit.edu/courses/18-310-principles-of-discrete-applied-mathematics-fall-2013/11d00f8f0f460a5e59b5e97322a218a9_MIT18_310F13_Ch8.pdf?utm_source=chatgpt.com "Principles of Discrete Applied Mathematics, Linear Programming Notes"
[4]: https://developers.google.com/optimization/mip?utm_source=chatgpt.com "OR-Tools  |  Google for Developers"
[5]: https://docs.mosek.com/modeling-cookbook/mio.html?utm_source=chatgpt.com "9 Mixed integer optimization — MOSEK Modeling Cookbook 3.4.0"
[6]: https://ocw.mit.edu/courses/15-083j-integer-programming-and-combinatorial-optimization-fall-2009/pages/lecture-notes/?utm_source=chatgpt.com "Lecture Notes | Integer Programming and Combinatorial Optimization | Sloan School of Management | MIT OpenCourseWare"
[7]: https://docs.gurobi.com/projects/optimizer/en/current/concepts/modeling/tolerances.html?utm_source=chatgpt.com "Tolerances and Ill Conditioning - Gurobi Optimizer Reference Manual"
[8]: https://www.ibm.com/docs/en/icos/22.1.1?topic=c-branch-cut-in-cplex&utm_source=chatgpt.com "Branch and cut in CPLEX"
[9]: https://www.ibm.com/docs/en/cofz/22.1.2?topic=cuts-what-are&utm_source=chatgpt.com "What are cuts?"
[10]: https://docs.gurobi.com/projects/optimizer/en/current/reference/parameters.html?utm_source=chatgpt.com "Parameter Reference - Gurobi Optimizer Reference Manual"
[11]: https://developers.google.com/optimization/cp?utm_source=chatgpt.com "Constraint Optimization  |  OR-Tools  |  Google for Developers"
[12]: https://developers.google.com/optimization/cp/cp_solver?utm_source=chatgpt.com "CP-SAT Solver  |  OR-Tools  |  Google for Developers"
[13]: https://homes.di.unimi.it/~trubian/primer.pdf?utm_source=chatgpt.com "A Primer in Column Generation 23"
[14]: https://pubsonline.informs.org/doi/pdf/10.1287/opre.46.3.316?utm_source=chatgpt.com "Branch-and-Price: Column Generation for Solving Huge Integer Programs | Operations Research"
[15]: https://www.researchgate.net/publication/226683077_A_Primer_in_Column_Generation?utm_source=chatgpt.com "(PDF) A Primer in Column Generation"
[16]: https://www.ibm.com/docs/en/cofz/22.1.2?topic=parameters-benders-strategy&utm_source=chatgpt.com "Benders strategy"
[17]: https://www.ibm.com/docs/en/icos/22.1.1?topic=pools-differences-between-user-cuts-lazy-constraints&utm_source=chatgpt.com "Differences between user cuts and lazy constraints"
[18]: https://developers.google.com/optimization/examples/?utm_source=chatgpt.com "OR-Tools Examples  |  Google for Developers"
[19]: https://publications.polymtl.ca/24209/?utm_source=chatgpt.com "A Primer in column generation - PolyPublie"
[20]: https://research.tue.nl/en/publications/partitioning-procedures-for-solving-mixed-variables-programming-p-2?utm_source=chatgpt.com "Partitioning procedures for solving mixed-variables programming problems - Research portal Eindhoven University of Technology"
