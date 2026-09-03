# Phụ lục 1 — Lin–Kernighan (LK) và Lin–Kernighan–Helsgaun (LKH)

Đây là một **bonus cực kỳ đáng học**, và thực ra nó là một trong những nơi đẹp nhất để nhìn thấy toàn bộ tư tưởng của Local Search, Variable Neighborhood, Candidate Search, Backtracking và Hybridization hội tụ vào **một thuật toán rất tinh vi**.

Nếu 2-opt là:

> “Thử đổi 2 cạnh.”

3-opt là:

> “Thử đổi 3 cạnh.”

thì Lin–Kernighan hỏi một câu sâu hơn:

> **“Tại sao phải quyết định trước sẽ đổi bao nhiêu cạnh?”**

LK biến số lượng cạnh được thay đổi thành **một phần của quyết định tìm kiếm**. Đó là nguồn gốc của chữ **variable-depth**.

Và LKH của Keld Helsgaun tiếp tục đẩy ý tưởng đó rất xa bằng:

* candidate sets rất thông minh;
* α-nearness;
* minimum 1-tree;
* Held–Karp / subgradient optimization;
* generalized \(k\)-opt;
* sophisticated gain criteria;
* search pruning;
* backtracking;
* partitioning;
* kicks;
* recombination;
* nhiều cơ chế kỹ thuật để làm cho search cực nhanh.

Bài báo gốc của Lin & Kernighan xuất bản năm 1973; paper của Helsgaun năm 2000 mô tả một implementation được sửa đổi mạnh của LK, còn LKH-2 năm 2009 đưa generalized \(k\)-opt submoves lên quy mô tới hàng triệu đỉnh. ([PubsOnline][1])

---

# 1. Lịch sử tiến hóa: LK → LKH

Có thể hình dung:

```text
1973
Lin–Kernighan
     │
     ▼
Variable-depth local search
     │
     ▼
LKH-1
     │
     ▼
LKH-2
     │
     ├── General k-opt
     ├── Huge-instance machinery
     ├── Better candidate sets
     ├── Better data structures
     └── Partitioning
     │
     ▼
LKH-3
     │
     ├── constrained TSP
     ├── VRP
     ├── CVRP
     ├── CVRPTW
     ├── pickup-delivery
     └── many constrained variants
```

Trang chính thức của Helsgaun hiện liệt kê **LKH 2.0.11 (June 2025)** cho TSP; còn **LKH-3 3.0.13 (November 2024)** là nhánh mở rộng cho constrained TSP/VRP. ([Webhotel 4][2])

---

# 2. Nhắc lại TSP

Cho complete weighted graph:

$$
G=(V,E)
$$

với:

$$
|V|=n.
$$

Mỗi cạnh có cost:

$$
c_{ij}.
$$

TSP cần tìm Hamiltonian cycle:

$$
T=(v_1,v_2,\ldots,v_n,v_1)
$$

tối thiểu:

$$
L(T)
=
\sum_{i=1}^{n-1}c_{v_i,v_{i+1}}
+c_{v_n,v_1}.
$$

Search space:

$$
(n-1)!/2
$$

với symmetric TSP.

Quá lớn để enumerate.

Do đó ta dùng local search.

---

# 3. Từ 2-opt đến k-opt

Một \(k\)-opt move:

* xóa \(k\) cạnh khỏi tour;
* thêm \(k\) cạnh mới;
* kết quả vẫn là một tour.

Ví dụ 2-opt:

```text
A ─ B
C ─ D
```

xóa:

$$
(A,B),(C,D)
$$

thêm:

$$
(A,C),(B,D).
$$

---

## 3-opt

Xóa:

$$
x_1,x_2,x_3
$$

và thêm:

$$
y_1,y_2,y_3.
$$

Có một số cách reconnect khác nhau.

Neighborhood tăng rất nhanh theo \(k\).

---

# 4. Vấn đề của fixed-k search

Nếu ta nói:

> "Tôi dùng 5-opt."

thì search bị khóa ở:

$$
k=5.
$$

Nhưng một local improvement có thể cần:

$$
k=2
$$

ở vùng này, và:

$$
k=7
$$

ở vùng khác.

Fixed \(k\):

```text id="k1"
2-opt
→ 2-opt
→ 2-opt
→ ...
```

không linh hoạt.

LK đưa ra:

$$
\boxed{
k\text{ là biến trong quá trình search}
}
$$

---

# 5. Ý tưởng Variable-Depth

Thay vì:

$$
S\rightarrow N_2(S)
$$

hoặc:

$$
S\rightarrow N_3(S)
$$

ta xây một chuỗi trao đổi:

$$
x_1,y_1,x_2,y_2,\dots,x_k,y_k.
$$

Có thể dừng ở:

$$
k=2,
$$

hoặc:

$$
k=3,
$$

hoặc:

$$
k=8,
$$

hoặc một độ sâu khác.

Do đó neighborhood thực tế là:

$$
\boxed{
N_{\mathrm{LK}}(S)
=
\bigcup_{k\ge2}N_k^{\mathrm{restricted}}(S)
}
$$

nhưng **không bao giờ enumerate toàn bộ union**.

Đây chính là chỗ kỳ diệu.

---

# 6. Cấu trúc cơ bản của LK

LK xây hai tập cạnh:

$$
X=\{x_1,\ldots,x_k\}
$$

là các cạnh bị **remove**.

và:

$$
Y=\{y_1,\ldots,y_k\}
$$

là các cạnh **add**.

Tour mới về mặt tập cạnh là:

$$
T'=(T\setminus X)\cup Y.
$$

Nếu:

$$
L(X)>L(Y)
$$

thì:

$$
G_k=L(X)-L(Y)>0.
$$

Tức là move cuối cùng cải thiện tour.

---

# 7. Gain

Đặt:

$$
g_i=c(x_i)-c(y_i).
$$

Cumulative gain:

$$
G_i=\sum_{j=1}^{i}g_j.
$$

Hoặc:

$$
G_i=
\sum_{j=1}^{i}c(x_j)
-
\sum_{j=1}^{i}c(y_j).
$$

Nếu:

$$
G_i>0
$$

thì prefix exchanges có "positive gain".

Đây là **positive gain criterion**, một trong những pruning rules quan trọng nhất của LK. ([ResearchGate][3])

---

# 8. Ví dụ

Giả sử:

$$
c(x_1)=20
$$

$$
c(y_1)=8.
$$

Vậy:

$$
G_1=12.
$$

Tiếp:

$$
c(x_2)=15,
\quad c(y_2)=18.
$$

thì:

$$
G_2=12+(15-18)=9.
$$

Vẫn:

$$
G_2>0.
$$

Tiếp:

$$
c(x_3)=30,
\quad c(y_3)=25.
$$

thì:

$$
G_3=14.
$$

Cuối cùng:

$$
G_3>0
$$

→ move có lợi.

---

# 9. Nhưng tại sao không chỉ cần tổng gain cuối?

Giả sử:

$$
g_1=-5,\qquad
g_2=20.
$$

Tổng:

$$
G_2=15>0.
$$

Move cuối cùng có lợi.

Nhưng LK sẽ không thích path:

$$
G_1=-5.
$$

Tại sao?

Vì search tree ở bước đầu đã đi vào một nhánh kém hứa hẹn.

Positive gain criterion yêu cầu prefix phải tiếp tục có gain dương; điều này **prune rất nhiều nhánh**. Nghiên cứu gần đây cũng nhấn mạnh đây là một heuristic restriction: có thể tồn tại beneficial alternating cycle với các prefix không positive, dù Lin–Kernighan có lập luận rằng với một beneficial cycle có tồn tại cyclic permutation thỏa positive-gain criterion. ([ScienceDirect][4])

---

# 10. Một điều rất quan trọng: positive gain không phải theorem về optimality của move

Nó là:

$$
\boxed{
search\ heuristic
}
$$

chứ không phải:

$$
\boxed{
necessary\ condition\ for\ every\ improving\ path.
}
$$

LK hy sinh completeness của neighborhood để đổi lấy tốc độ.

Đây là một theme xuất hiện xuyên suốt metaheuristic:

> **cắt bớt search space một cách có chủ đích.**

---

# 11. Cấu trúc \(x_i,y_i\)

LK không chọn cạnh tùy ý.

Ta có:

```text
t1 --x1-- t2
          \
           y1
            \
             t3
             |
            x2
             |
             t4
             \
              y2
               \
                t5
```

Cụ thể:

$$
x_1=(t_1,t_2)
$$

$$
y_1=(t_2,t_3)
$$

$$
x_2=(t_3,t_4)
$$

$$
y_2=(t_4,t_5)
$$

...

Ta đang xây một **alternating sequence**:

$$
x_1,y_1,x_2,y_2,\ldots
$$

Các paper/tutorial về LK thường biểu diễn đúng chuỗi này. ([Thesis Erasmus University][5])

---

# 12. Feasibility Criterion

Một vấn đề lớn:

> sau khi add/remove cạnh, có còn cách đóng thành một tour hợp lệ không?

LK không thể chỉ tối ưu cost cục bộ.

Nó cần đảm bảo move có thể eventually tạo Hamiltonian cycle.

Đây là **feasibility criterion**.

Ý tưởng là khi đã chọn một inclusion edge \(y_{i-1}\), cạnh \(x_i\) bị giới hạn bởi cấu trúc tour sao cho ta vẫn có khả năng "close up" thành một tour.

Điều này làm search tree nhỏ hơn rất nhiều so với "tất cả cạnh có thể chọn". ([studylib.net][6])

---

# 13. Sequentiality

LK ban đầu còn có một constraint rất quan trọng:

> Các move phải có cấu trúc sequential.

Nghĩa là:

$$
x_i
$$

gắn với endpoint mới sinh ra bởi:

$$
y_{i-1}.
$$

Ví dụ:

```text id="seq1"
x1
 ↓
y1
 ↓
x2
 ↓
y2
 ↓
x3
 ↓
y3
```

chứ không phải tùy ý chọn:

$$
x_3
$$

ở một vùng hoàn toàn độc lập.

Sequentiality giúp giảm search space cực mạnh.

---

# 14. Disjunctivity Criterion

LK yêu cầu:

$$
X\cap Y=\varnothing.
$$

Không dùng cùng một cạnh vừa trong remove vừa trong add.

Điều này giúp:

* simplify implementation;
* giảm thời gian;
* tạo stop criterion tốt.

Đây là một trong những criterion gốc được Helsgaun tổng hợp khi mô tả LK. ([ResearchGate][3])

---

# 15. Candidate Set

Ngay cả khi sequential, số cạnh có thể chọn vẫn cực lớn.

Ví dụ một node có:

$$
n-1
$$

cạnh ứng viên.

LK cổ điển giải quyết bằng:

$$
\boxed{
Candidate\ Set
}
$$

Nguyên bản dùng **5 nearest neighbors** của mỗi city. ([ResearchGate][7])

Tức là:

```text id="cand0"
             city i
                ●
           / /  |  \
          /     |    \
       ●        ●      ●
      near     near   near

chỉ giữ ~5 candidate edges
```

Không thử mọi cạnh.

---

# 16. Đây là một trade-off cực quan trọng

Nearest-neighbor candidate:

$$
\text{cheap}
$$

nhưng:

$$
\text{not always structurally correct}.
$$

Có thể optimal tour chứa:

$$
(i,j)
$$

nhưng \(j\) không nằm trong 5 nearest neighbors của \(i\).

Khi đó LK không thể tìm ra optimum, ngay cả khi move sequence khác hoàn hảo.

Đây là một nhược điểm lớn của candidate rule gốc.

---

# 17. Và Helsgaun giải quyết bằng α-nearness

Đây là **một trong những đóng góp quan trọng nhất của LKH**.

Thay vì hỏi:

> "Edge nào ngắn?"

Helsgaun hỏi:

> **"Edge nào có vẻ phù hợp với cấu trúc của một tour tối ưu?"**

Đây là khác biệt rất sâu.

---

# 18. Minimum 1-tree

Chọn một node đặc biệt \(r\).

Tạo MST trên:

$$
V\setminus\{r\}
$$

sau đó nối \(r\) bằng hai cạnh rẻ nhất.

Ta được:

$$
\boxed{
1\text{-tree}
}
$$

Nó có:

$$
n
$$

cạnh và một cycle.

Nếu mọi node có degree 2 thì 1-tree chính là một TSP tour.

---

# 19. Tại sao 1-tree liên quan đến TSP?

Mọi TSP tour là một 1-tree có degree:

$$
deg(v)=2
$$

cho mọi \(v\).

Minimum 1-tree:

$$
T_{1tree}
$$

không nhất thiết là tour, nhưng là một **lower-bounding relaxation** rất hữu ích của TSP.

Nếu minimum 1-tree đã có:

$$
deg(v)=2
$$

cho mọi \(v\),

thì nó chính là TSP optimal tour.

Các tài liệu về LKH và Held–Karp relaxation mô tả chính connection này. ([Springer][8])

---

# 20. Ví dụ trực giác

Tour thật:

```text id="tour"
A──B
│  │
D──C
```

Minimum 1-tree có thể:

```text id="1tree"
A──B──C
   │
   D
```

nhưng degree của B/C/D không phải 2.

Nó chưa phải tour.

Tuy nhiên nó tiết lộ:

> "Những cạnh nào có xu hướng tạo nên một cấu trúc gần optimal?"

---

# 21. α-nearness

Giả sử:

$$
T
$$

là minimum 1-tree có cost:

$$
L(T).
$$

Gọi:

$$
T^+(i,j)
$$

là minimum 1-tree **bắt buộc phải chứa** edge \((i,j)\).

Định nghĩa:

$$
\boxed{
\alpha(i,j)
=
L(T^+(i,j))-L(T)
}
$$

Đây là **α-nearness**. ([Springer][8])

---

# 22. Ý nghĩa của α-nearness

Nếu:

$$
\alpha(i,j)=0
$$

thì tồn tại minimum 1-tree chứa:

$$
(i,j).
$$

Edge đó rất đáng quan tâm.

Nếu:

$$
\alpha(i,j)=10000
$$

thì bắt minimum 1-tree phải chứa edge đó làm cost tăng lớn.

Edge đó ít hứa hẹn hơn.

Do đó:

$$
\boxed{
small\ \alpha
\Rightarrow
promising\ edge
}
$$

---

# 23. Vì sao α tốt hơn nearest-neighbor?

Nearest-neighbor chỉ nhìn:

$$
c_{ij}.
$$

α-nearness nhìn:

$$
\text{global structural role of edge}.
$$

Hai edge có cùng distance:

$$
c_{ij}=c_{uv}
$$

nhưng:

$$
\alpha(i,j)\ll\alpha(u,v).
$$

Edge \((i,j)\) có cấu trúc phù hợp hơn với minimum 1-tree.

Đó là lý do LKH có candidate sets tốt hơn nearest-neighbor.

---

# 24. Candidate Set của LKH

Thay vì:

$$
5\text{ nearest neighbors},
$$

LKH thường chọn:

$$
k
$$

cạnh có α nhỏ nhất cho mỗi node, hoặc các edge dưới một α threshold. ([Springer][8])

Do đó:

```text id="alphaCand"
node i
  │
  ├── edge α=0
  ├── edge α=2
  ├── edge α=5
  ├── edge α=8
  └── edge α=10
        ↓
   candidate set
```

---

# 25. Nhưng tính α-nearness rất đắt

Nếu tính:

$$
\alpha(i,j)
$$

cho mọi:

$$
O(n^2)
$$

edges, với mỗi edge lại có một constrained minimum 1-tree, rõ ràng cực tốn.

LKH giải quyết bằng:

$$
\boxed{
Held\text{-}Karp\ subgradient\ optimization
}
$$

và chỉ cần một approximation hữu ích cho candidate generation. Các mô tả thực nghiệm về LKH chỉ ra tính α đầy đủ là \(O(n^2)\), nên LKH dùng subgradient optimization và có thể dừng ascent sớm vì mục tiêu là hiệu quả tính toán. ([PubMed Central (PMC)][9])

---

# 26. Penalty \(\pi\)

Đây là điểm cực kỳ quan trọng.

LKH biến đổi cost:

$$
\boxed{
\hat c_{ij}=c_{ij}+\pi_i+\pi_j
}
$$

với:

$$
\pi_i
$$

là node penalty. ([Springer][8])

Mục đích là làm minimum 1-tree có degree structure gần với tour hơn.

---

# 27. Tại sao cộng penalty có ích?

Giả sử node \(i\) đang có degree:

$$
deg(i)=5.
$$

Tour muốn:

$$
deg(i)=2.
$$

Penalty mechanism làm cost structure "discourage" những node degree bất thường trong minimum 1-tree.

Subgradient optimization điều chỉnh:

$$
\pi_i
$$

để cải thiện dual lower bound / tạo minimum 1-tree gần tour hơn.

---

# 28. Lower bound từ penalty

Với penalized minimum 1-tree:

$$
T_\pi
$$

có length:

$$
L(T_\pi).
$$

Một lower bound của TSP optimum có dạng:

$$
\boxed{
w(\pi)
=
L(T_\pi)-2\sum_i\pi_i
}
$$

và Held–Karp ascent cố gắng tối đa hóa lower bound này. ([Springer][8])

Đây là một điểm cực đẹp:

> Candidate generation của LKH được xây trên **dual-like lower-bound information**.

---

# 29. Từ LP Duality sang LKH

Cậu vừa học Chương 15.

Bây giờ nhìn:

$$
LP\ Duality
$$

→ dual variables.

Trong TSP relaxation:

$$
\pi_i
$$

đóng vai trò penalty/Lagrangian multipliers.

Rồi:

$$
\pi
\rightarrow
\text{transformed costs}
\rightarrow
1\text{-tree}
\rightarrow
\alpha
\rightarrow
candidate set.
$$

Đây là một connection rất sâu:

$$
\boxed{
Mathematical\ Optimization
\rightarrow
LKH\ Search\ Heuristic
}
$$

---

# 30. LK nguyên bản và LKH khác nhau ở candidate set

### LK

$$
5\text{-nearest}
$$

### LKH

$$
\alpha\text{-candidate}
$$

thường dựa trên minimum 1-tree và penalties.

Đây là một trong những nguyên nhân lớn khiến LKH mạnh hơn LK nguyên bản. ([ResearchGate][7])

---

# 31. Positive Gain + α-nearness

Hai cơ chế này bổ sung cho nhau.

### α-nearness

Giảm:

$$
\text{branching factor}
$$

trước khi search.

### Positive gain

Prune:

$$
\text{search branches}
$$

trong khi search.

```text id="combo"
All possible edges
      │
      ▼
α-candidate set
      │
      ▼
small candidate graph
      │
      ▼
positive gain
      │
      ▼
smaller search tree
```

Đây chính là lý do LK/LKH có thể làm những search tưởng như khổng lồ trở nên khả thi.

---

# 32. LKH-1: sửa LK ở mức search strategy

Helsgaun năm 2000 mô tả một modified LK với những khác biệt đáng kể so với bản gốc, đặc biệt:

> **larger and more complex search steps**

và:

> **sensitivity analysis để direct/restrict search**.

Ông cũng báo cáo runtime thực nghiệm xấp xỉ \(n^{2.2}\) và implementation này đã giải được nhiều benchmark rất lớn. ([ScienceDirect][10])

---

# 33. LKH-1 không chỉ là "LK nhanh hơn"

Đây là distinction quan trọng.

LK gốc:

```text
2-opt / 3-opt style sequential search
```

LKH:

```text
larger search steps
+
better candidate restriction
+
sensitivity information
+
more aggressive implementation
```

Do đó LKH là **algorithm redesign**, không chỉ optimization code.

---

# 34. LKH-2 và Generalized k-opt

Đây là bước tiến cực kỳ lớn.

LKH-2 cho phép:

$$
k
$$

được dùng như **submove**, với \(k\) có thể là bất kỳ integer:

$$
2\le k<n.
$$

Trong khi LK/LKH-1 có nhiều restriction hơn đối với decomposition của move. LKH-2 đưa general \(k\)-opt submoves trực tiếp vào search. ([Webhotel 4][2])

---

# 35. Sequential 4-opt

Một 4-opt sequential move có thể được biểu diễn như:

$$
2\text{-opt}
\rightarrow
2\text{-opt}
\rightarrow
2\text{-opt}.
$$

LKH-2 generalizes cách này.

Một \(k\)-opt submove được xử lý như một cấu trúc nguyên bản hơn, thay vì chỉ là một chuỗi cố định của 2-/3-opt. Paper 2009 trình bày chi tiết việc triển khai generalized \(k\)-opt submoves và cho thấy runtime gần tuyến tính theo kích thước trên các Euclidean instances rất lớn. ([Roskilde Universitets forskningsportal][11])

---

# 36. Non-sequential moves

LK gốc ưu tiên sequential moves và những non-sequential structures bị hạn chế.

LKH-2 thay đổi:

> **non-sequential moves không còn chỉ được xem như last resort; chúng được tích hợp vào search thông thường.** ([Webhotel 4][2])

Điều này mở search space đáng kể.

---

# 37. Nhưng nếu mở search thì làm sao vẫn nhanh?

Câu trả lời:

$$
\boxed{
stronger\ pruning
}
$$

LKH không đơn giản:

$$
search\ more
$$

mà:

$$
\boxed{
search\ more\ intelligently
}
$$

bằng:

* candidate sets;
* gain criteria;
* feasibility;
* disjointness;
* backtracking;
* patching;
* move restrictions;
* efficient edge tests;
* specialized data structures.

---

# 38. Backtracking

Đây là một điểm mà người học dễ bỏ qua.

Giả sử:

```text
t1
 └─ y1
     └─ y2
          └─ y3   ← dead end
```

LK không nhất thiết bỏ toàn bộ move.

Nó có thể quay lại:

$$
y_2
$$

và thử alternative.

Đây chính là:

$$
\boxed{
DFS + intelligent pruning
}
$$

trong một neighborhood khổng lồ.

---

# 39. LK thực chất có một search tree

Nếu viết abstractly:

```text id="tree"
                    x1
                     |
          ┌──────────┼──────────┐
         y1         y1'        y1''
          |
        x2
          |
      ┌───┼────┐
     y2  y2'  y2''
      |
     x3
```

Mỗi level thêm một pair:

$$
x_i,y_i.
$$

Mà branch factor được giảm mạnh bởi:

* candidate set;
* feasibility;
* positive gain.

Đây chính là lý do LK không phải "simple swap heuristic".

Nó gần với:

$$
\boxed{
depth\text{-}first\ combinatorial search
}
$$

được nhúng trong local search.

---

# 40. Positive gain giống Branch-and-Bound

Trong Branch-and-Bound:

$$
bound
\rightarrow
prune.
$$

Trong LK:

$$
G_i\le0
\rightarrow
prune.
$$

Dù không phải cùng một loại mathematical bound, tư duy giống nhau:

> **không mở rộng những partial move đã mất triển vọng.**

Đây là một connection thú vị với Chương 3.

---

# 41. LK là "variable-depth neighborhood search"

Ta có:

$$
2\text{-opt},
3\text{-opt},
4\text{-opt},
\ldots
$$

nhưng không xử lý riêng từng neighborhood.

LK dynamically constructs:

$$
k.
$$

Do đó có thể xem:

$$
\boxed{
LK \approx variable-depth k\text{-opt local search}
}
$$

đây cũng là lý do LK có quan hệ rất gần với VNS về mặt tư tưởng, dù cơ chế cụ thể rất khác.

---

# 42. LK khác VNS

### VNS

```text
N1
↓
N2
↓
N3
```

Neighborhood thường là:

$$
N_k(S)
$$

được định nghĩa trước.

### LK

```text
start exchange
↓
decide next exchange
↓
decide next exchange
↓
...
```

Depth \(k\) được quyết định **trong search tree**.

Vì vậy:

$$
\boxed{
VNS:\ choose\ neighborhood
}
$$

$$
\boxed{
LK:\ construct\ neighborhood\ path\ adaptively
}
$$

---

# 43. LK khác LNS

### LNS

```text
Destroy large chunk
→ Repair
```

### LK

```text
remove/add edge incrementally
→ build a variable-depth k-exchange
```

LNS có change theo **subset structure lớn**.

LK thay đổi **tour edges bằng alternating exchange search**.

---

# 44. LK khác Tabu

LK thường không dựa trên long-term memory kiểu:

$$
TabuList.
$$

Thay vào đó:

* gain;
* candidate;
* feasibility;
* structural restrictions

kiểm soát search.

Do đó LK là một ví dụ rất hay về **memoryless but highly structured search**.

---

# 45. Một LK iteration đầy đủ

Ta có thể mô hình hóa:

```text id="lkloop"
Current tour T
     │
     ▼
choose starting node t1
     │
     ▼
choose x1 from T
     │
     ▼
choose y1 candidate
     │
 positive gain?
     ├── no → backtrack
     └── yes
     │
     ▼
choose x2 uniquely/feasibly
     │
     ▼
choose y2
     │
     ├── continue
     └── close-up
     │
     ▼
obtain feasible T'
     │
     ▼
improvement?
     ├── yes → accept
     └── no → continue/backtrack
```

Đây là skeleton cần nhớ.

---

# 46. Close-up

Một từ khóa cực kỳ quan trọng trong LK:

$$
\boxed{
close\text{-}up
}
$$

Sau khi đã chọn một số exchanges, nếu ta nối endpoint cuối cùng về \(t_1\), ta có thể tạo ra một tour mới.

Ví dụ:

$$
x_1,y_1,x_2,y_2
$$

sau đó thêm:

$$
y^*=(t_5,t_1).
$$

Nếu resulting graph là Hamiltonian cycle và có gain dương:

$$
G_k>0,
$$

thì execute move.

Các mô tả chi tiết về LK thường gọi bước này là **closing up**. ([Thesis Erasmus University][5])

---

# 47. Không phải cứ gain dương là được

Một closing edge cần:

1. không vi phạm disjointness;
2. tạo được Hamiltonian tour;
3. gain đủ tốt;
4. thỏa các search criteria.

Do đó:

$$
\boxed{
cost\ improvement
\neq
feasible\ tour
}
$$

LK luôn phải kiểm tra cả hai.

---

# 48. Một ví dụ k-opt hoàn chỉnh

Tour hiện tại:

$$
1-2-3-4-5-6-7-8-1.
$$

Chọn:

$$
x_1=(1,2)
$$

bỏ cạnh này.

Chọn:

$$
y_1=(1,5)
$$

thêm.

Sau đó cần một cạnh cũ incident với 5, ví dụ:

$$
x_2=(5,6).
$$

Thêm:

$$
y_2=(6,3).
$$

Sau đó:

$$
x_3=(3,4)
$$

và:

$$
y_3=(4,2).
$$

Cuối cùng có thể close bằng:

$$
(2,1)
$$

hoặc một kết nối phù hợp khác tùy cấu trúc.

Điều quan trọng không phải một công thức reconnect cố định, mà là:

$$
x_1,y_1,x_2,y_2,x_3,y_3
$$

tạo thành một alternating structure có thể patch thành tour.

---

# 49. LKH sử dụng transformed cost

Như đã nói:

$$
\hat c_{ij}
=
\text{scaled }c_{ij}+\pi_i+\pi_j.
$$

User guide của LKH còn cho phép một `PRECISION` để biểu diễn transformed distances như:

$$
d_{ij}
=
PRECISION\cdot c_{ij}+\pi_i+\pi_j.
$$

Điều này vừa hỗ trợ numerical control vừa giúp search dựa trên transformed costs. ([Manuals+][12])

---

# 50. LKH không chỉ tối ưu theo distance gốc

Đây là điểm rất thú vị.

Search có thể dựa trên:

$$
\hat c_{ij}
$$

để candidate/gain ranking.

Trong khi objective thực tế vẫn là:

$$
c_{ij}.
$$

Tức là:

$$
\boxed{
search\ space\ guidance
\neq
original\ objective\ directly
}
$$

Đó là một dạng **surrogate / transformed metric**.

---

# 51. Ascent

Helsgaun dùng **subgradient optimization** để tìm node penalties.

Quy trình:

```text id="ascent"
initial π
   ↓
build minimum 1-tree
   ↓
measure degree violations
   ↓
update π
   ↓
build new 1-tree
   ↓
...
   ↓
best lower bound
```

Mục tiêu:

$$
\max_{\pi}w(\pi).
$$

---

# 52. Degree violation

Ta muốn:

$$
deg(i)=2.
$$

Nếu:

$$
deg(i)>2
$$

hoặc:

$$
deg(i)<2
$$

thì có violation.

Subgradient được xây từ:

$$
deg(i)-2.
$$

Một cách đơn giản:

$$
\pi_i
\leftarrow
\pi_i
+
\lambda(deg(i)-2).
$$

Đây là dạng intuition về subgradient update.

---

# 53. Tại sao ascent quan trọng với LKH?

Không phải vì LKH cần một lower bound hoàn hảo.

Mà vì ascent giúp:

1. tăng chất lượng lower bound;
2. làm minimum 1-tree có cấu trúc gần tour hơn;
3. làm α-nearness có ý nghĩa hơn;
4. sinh candidate set tốt hơn.

Do đó:

$$
\boxed{
Ascent
\rightarrow
better\ 1\text{-tree}
\rightarrow
better\ candidates
\rightarrow
better\ search
}
$$

---

# 54. Đây là feedback giữa mathematical optimization và heuristic

Một lần nữa:

```text id="mathlk"
Held–Karp lower-bound machinery
              ↓
           penalties
              ↓
          candidate set
              ↓
        LK local search
              ↓
      improved tour
```

Rất đẹp.

LKH chính là một trong những ví dụ rõ nhất của:

$$
\boxed{
mathematical\ information\ feeding\ a\ metaheuristic
}
$$

mà chúng ta vừa nói ở Chương 16.

---

# 55. Kicks

Nếu LK đã ở một local optimum:

```text
T*
```

chạy LK tiếp tục thường không giúp.

LKH có thể thực hiện **kick**:

$$
T^*
\rightarrow
T'
$$

một perturbation không nhất thiết cải thiện objective.

Sau đó:

$$
T'
\rightarrow
LK
\rightarrow
T''.
$$

Đây rất gần:

$$
\boxed{
Iterated\ Local\ Search
}
$$

---

# 56. LK + ILS

Ta có:

$$
\boxed{
LKH
\approx
\text{powerful local search}
+
\text{kicks}
+
\text{restarts}
}
$$

Do đó LKH có quan hệ rất mạnh với Chương 10.

Luồng:

```text id="lkils"
Tour
 ↓
LK
 ↓
local optimum
 ↓
kick
 ↓
LK
 ↓
local optimum
 ↓
...
```

---

# 57. Nhiều Runs

LKH có thể chạy nhiều trial:

$$
R=1,2,\dots,\text{RUNS}
$$

với các starting tours khác nhau hoặc recombination khác nhau.

Điều này tạo:

$$
\boxed{
multi-start + intensive local search
}
$$

LKH hiện tại vẫn có parameter `RUNS`; các benchmark gần đây thường dùng `RUNS=10` và `MAX_TRIALS=number of nodes` như cấu hình mặc định trong các nghiên cứu thực nghiệm với LKH-3. ([OpenReview][13])

---

# 58. LKH-2 thêm partitioning

Với problem cực lớn:

$$
n=1,000,000.
$$

Một local search toàn cục rất đắt.

LKH-2 cho phép partitioning:

```text id="part"
1,000,000 nodes
        ↓
  ┌─────┼─────┐
  ▼     ▼     ▼
sub1   sub2   sub3 ...
  │      │      │
 solve separately
  └──────┼──────┘
         ▼
     integrate
```

Official report mô tả partitioning là một trong các tính năng chính của LKH-2 để xử lý large-scale instances. ([Webhotel 4][14])

---

# 59. Vì sao partitioning không phá quá nhiều chất lượng?

Nếu các nodes có cấu trúc địa lý:

$$
\text{nearby nodes}
$$

thường có nhiều edge tốt với nhau.

Partitioning tập trung local search vào những vùng có khả năng cải thiện cao.

Đây là một dạng:

$$
\boxed{
spatial\ decomposition
}
$$

---

# 60. Data structures quan trọng

LKH không thể nhanh nếu mỗi move đều:

```cpp
rebuild full tour
```

Một trong những cải tiến chính là representation của tour và thao tác edge rất hiệu quả.

LKH-3/LKH-2 mặc định sử dụng **two-level tree** để biểu diễn tour; code cũng hỗ trợ **three-level tree**. ([GitHub][15])

---

# 61. Vì sao cần tree representation?

Giả sử tour:

$$
1-2-3-4-\cdots-n.
$$

Khi 2-opt đảo một segment:

$$
[a,\ldots,b]
$$

nếu dùng array naïve, phải reverse:

$$
O(n).
$$

Nếu có cấu trúc dữ liệu phù hợp, ta có thể thực hiện nhiều thao tác segment/flip hiệu quả hơn.

Do đó:

$$
\boxed{
algorithmic\ idea
+
data\ structure
}
$$

đều quan trọng.

---

# 62. Flip operation

Một 2-opt-like operation thường tương ứng với:

```text
flip(a,b)
```

để đảo orientation của một segment.

Trong implementation kiểu LK, flip không chỉ là thuật ngữ toán học mà là một primitive quan trọng của tour data structure.

Một số implementation giáo khoa mô tả LK trực tiếp bằng:

$$
flip(succ(a),pred(b)).
$$

Điều đó cho thấy cách biểu diễn successor/predecessor ảnh hưởng trực tiếp đến implementation.

---

# 63. LKH-2: Candidate set không chỉ ALPHA

Official LKH cho phép nhiều candidate-set types:

$$
\{
ALPHA,\ DELAUNAY,\ NEAREST\text{-}NEIGHBOR,\ QUADRANT
\}
$$

và có thể bổ sung extra candidate sets. ([Webhotel 4][2])

Điều này cho thấy:

> α-nearness rất mạnh, nhưng LKH là một **framework có nhiều option**, không phải chỉ một công thức cố định.

---

# 64. Delaunay candidate set

Trong Euclidean TSP, Delaunay triangulation giữ những cạnh mang cấu trúc hình học đặc biệt.

LKH cho phép dùng:

$$
\text{Delaunay}
$$

làm candidate graph.

Các mô tả benchmark lớn cũng ghi nhận việc LKH sử dụng Delaunay và quadrant links như các nguồn candidate cạnh. ([PubMed Central (PMC)][9])

---

# 65. Quadrant candidates

Chia mặt phẳng quanh node:

```text id="quad"
       NW | NE
      ----●----
       SW | SE
```

Chọn nearest neighbors trong từng quadrant.

Điều này giúp tránh tình trạng:

> tất cả candidate dồn về cùng một hướng.

Đặc biệt hữu ích ở instances có clustering.

---

# 66. POPMUSIC

Một extension khá thú vị trong LKH hiện đại:

$$
\boxed{
POPMUSIC
}
$$

Candidate sets có thể được tạo thông qua POPMUSIC; official LKH cho phép:

```text
CANDIDATE_SET_TYPE = POPMUSIC
```

và có các parameter riêng như sample size, số solutions, số trials, max neighbors. ([Webhotel 4][2])

---

# 67. LKH cũng có genetic components

Đừng ngạc nhiên.

LKH không còn chỉ là "local search thuần".

LKH-2 đã bổ sung:

* population;
* recombination;
* GPX2;
* IPT;
* các chiến lược diversity.

Official changelog ghi nhận population-based mechanism từ LKH 2.0.3 và GPX2 từ 2.0.8. ([Webhotel 4][2])

---

# 68. Đây là một ví dụ rất hay của Hybridization

Ta có:

$$
LKH
+
GA\text{-like\ recombination}
$$

→ hybrid search.

Do đó LKH hiện đại là một **optimization framework**, không chỉ một local search function.

---

# 69. Recombination

Giả sử có hai tour:

$$
T_1,T_2.
$$

Một recombination operator tạo:

$$
T_3.
$$

Sau đó:

$$
T_3
\rightarrow
LKH
\rightarrow
T_4.
$$

Đây chính là:

$$
\boxed{
population\ +\ intensive\ local\ search
}
$$

một architecture rất gần memetic algorithms.

---

# 70. LKH và Memetic Algorithm

Memetic Algorithm:

$$
GA
+
Local\ Search.
$$

LKH:

$$
population/recombination
+
very\ strong\ LK\ local\ search.
$$

Không phải định nghĩa chính thức của LKH là memetic algorithm, nhưng architecture có sự tương đồng rất mạnh.

---

# 71. LKH và GA

Official LKH có một simple genetic mechanism:

* tạo initial population;
* chọn parents;
* recombine;
* chạy LKH từ child;
* thay worst population member nếu tốt hơn;
* duy trì different tour costs để tránh premature convergence. ([Webhotel 4][2])

Đây đúng là một hybrid cực rõ.

---

# 72. LKH và ALNS

Cũng có một connection thú vị:

### ALNS

$$
adaptive\ operator\ selection.
$$

### LKH

$$
multiple\ move\ mechanisms
+
candidate\ rules
+
search\ controls.
$$

Nhưng LKH không đơn thuần adaptive theo reward như ALNS.

LKH nổi bật hơn về:

$$
\boxed{
problem-specific\ structural\ intelligence
}
$$

---

# 73. LKH và Beam Search

Không phải Beam Search đúng nghĩa.

Nhưng LK cũng xây nhiều partial exchange sequences:

```text
partial move 1
partial move 2
partial move 3
```

rồi prune.

Khác biệt:

### Beam

giữ top \(B\) states theo heuristic score.

### LK

thường DFS/backtracking theo candidate/gain/feasibility criteria.

Do đó:

$$
\boxed{
LK \neq Beam
}
$$

nhưng có chung tinh thần:

> không enumerate full combinatorial space.

---

# 74. LKH và Branch-and-Bound

Again, không phải B&B theo nghĩa exact.

Nhưng architecture:

$$
DFS
+
pruning
$$

rất giống.

Khác biệt:

$$
\boxed{
LKH\ pruning\ is\ heuristic
}
$$

không tạo certificate rằng phần bị prune không chứa optimum.

---

# 75. Tại sao LKH vẫn có thể tìm optimum rất thường xuyên?

Không phải vì nó exact.

Mà vì:

1. candidate sets có chất lượng cao;
2. LK neighborhood rất mạnh;
3. variable depth;
4. nhiều trials;
5. kicks;
6. recombination;
7. sophisticated pruning;
8. transformed costs;
9. α-nearness;
10. implementation cực tối ưu.

Official LKH page nhấn mạnh rằng dù là approximate heuristic, LKH đã tìm optimum với tần suất rất cao trên các instance đã biết optimum và đạt tới các instance cực lớn. Đây là **thực nghiệm**, không phải guarantee toán học. ([Webhotel 4][2])

---

# 76. Cực kỳ quan trọng: LKH không chứng minh optimum

Nếu LKH trả:

$$
L=123456.
$$

Ta không thể kết luận:

$$
OPT=123456.
$$

Trừ khi biết optimum từ một nguồn exact khác.

LKH chỉ nói:

> "Tôi đã tìm được một tour có cost 123456."

Đây là khác biệt với:

$$
\text{Concorde / Branch-and-Cut}
$$

hay một solver exact có certificate.

---

# 77. So sánh LKH và Concorde

|                        | LKH              | Concorde         |
| ---------------------- | ---------------- | ---------------- |
| Loại                   | heuristic        | exact            |
| Guarantee              | không            | có               |
| Search                 | LK/k-opt         | Branch-and-Cut   |
| Candidate structure    | rất mạnh         | polyhedral       |
| Large TSP              | cực mạnh         | exact khó hơn    |
| Optimum certificate    | không            | có               |
| Speed to good solution | xuất sắc         | không nhất thiết |
| Role                   | heuristic solver | exact solver     |

Đây là hai archetype hoàn toàn khác nhau.

---

# 78. LKH và Branch & Cut

Từ Chương 15:

### Branch & Cut

$$
LP
\rightarrow
cuts
\rightarrow
branch.
$$

### LKH

$$
candidate
\rightarrow
gain
\rightarrow
exchange
\rightarrow
local\ optimum.
$$

Nhưng LKH cũng sử dụng mathematical ideas:

$$
1\text{-tree}
+
Held\text{-}Karp
+
dual\ penalties.
$$

Do đó:

$$
\boxed{
LKH
=
heuristic\ search\ heavily\ informed\ by\ mathematical\ structure.
}
$$

---

# 79. LKH-3: bước sang VRP

Đây là phần đặc biệt quan trọng nếu cậu đang nghiên cứu bài toán kỹ thuật viên.

LKH-3 là extension của LKH-2 để xử lý constrained TSP và VRP. Official description liệt kê:

* CVRP;
* CVRPTW;
* distance-constrained VRP;
* pickup-delivery;
* clustered VRP;
* multiple TSP;
* nhiều colored/precedence variants. ([Webhotel 4][16])

---

# 80. Cách LKH-3 xử lý constraints

Điểm rất thú vị:

> LKH-3 thường biến constrained problem thành một dạng standard TSP-like problem, rồi biểu diễn violation bằng **penalty functions**.

Technical report 2017 mô tả chính xác cách tiếp cận này. ([Roskilde Universitets forskningsportal][17])

Do đó objective có thể mang dạng:

$$
\boxed{
F(T)
=
cost(T)+Penalty(T)
}
$$

Trong đó:

$$
Penalty(T)=0
$$

nếu solution feasible.

Nếu vi phạm:

$$
Penalty(T)>0.
$$

---

# 81. Ví dụ CVRP

Có capacity:

$$
Q.
$$

Route load:

$$
load(r).
$$

Nếu:

$$
load(r)>Q
$$

thì:

$$
Penalty(r)=
\lambda\max(0,load(r)-Q).
$$

Objective:

$$
F(T)
=
Distance(T)+Penalty(T).
$$

LK vẫn search trên edge exchanges, nhưng nó đánh giá candidate bằng penalized cost.

---

# 82. Tại sao penalty approach hay?

Nó tránh việc phải xây một move engine hoàn toàn mới cho từng constraint.

Thay vì:

```text
LK for TSP
LK for CVRP
LK for CVRPTW
LK for pickup-delivery
...
```

ta cố gắng:

$$
\boxed{
same\ search\ engine
+
problem-specific\ penalty.
}
$$

Đây là một kiến trúc software cực kỳ đẹp.

---

# 83. Nhưng penalty không biến constrained problem thành exact problem

Một move có:

$$
F(T_1)<F(T_2)
$$

không nhất thiết:

$$
Distance(T_1)<Distance(T_2)
$$

nếu \(T_1\) vi phạm constraints.

Do đó penalty parameters và feasibility handling rất quan trọng.

---

# 84. Đây là connection với Penalty Method

Chương 16 đã nói:

$$
f(x)+\lambda g(x).
$$

LKH-3 cũng dùng tinh thần:

$$
\boxed{
\text{objective}+\text{constraint penalty}
}
$$

Như vậy LKH-3 là một ví dụ rất đẹp của:

$$
\text{Metaheuristic}
+
\text{Penalty method}.
$$

---

# 85. LKH cho bài toán technician của chúng ta

Đây là nơi bonus này trở nên cực kỳ thực dụng.

Ta có mỗi ngày:

$$
720\text{ phút}.
$$

Mỗi house:

$$
service_i.
$$

Travel:

$$
dist(i,j).
$$

Một route:

$$
r=(i_1,\dots,i_k).
$$

Tổng thời gian:

$$
time(r)
=
\sum dist(i_j,i_{j+1})
+
\sum service_{i_j}.
$$

Constraint:

$$
time(r)\le720.
$$

---

# 86. Có thể biến thành VRP-like problem

Nếu mỗi ngày là một route:

$$
30\text{ routes}.
$$

Ta có một dạng:

$$
\boxed{
Multi\text{-}day\ routing / VRP
}
$$

với:

* capacity = daily time;
* service time;
* profit;
* potentially soft constraints.

LKH-3 có thể xử lý nhiều constrained routing variants, nên về mặt kiến trúc nó gần problem family này. ([Webhotel 4][16])

---

# 87. Nhưng objective của AC problem khác VRP chuẩn

VRP thường:

$$
\min Distance.
$$

Bài AC lại là:

$$
\max Revenue + OvertimeBonus - \lambda Travel.
$$

Hoặc equivalent:

$$
\min
-\text{Revenue}
+\text{TravelCost}
-\text{OvertimeBenefit}.
$$

Do đó cần custom objective/penalty.

Đây chính là nơi cậu có thể dùng:

$$
\boxed{
LKH\text{-}style\ local\ search
}
$$

chứ không nhất thiết dùng LKH off-the-shelf nguyên xi.

---

# 88. Một vấn đề lớn: LKH phù hợp nhất khi solution có tour structure

LKH cực mạnh với:

$$
\text{permutation / route / cycle}.
$$

Nếu bài toán quyết định chủ yếu là:

```text
which houses to serve?
```

thì pure LK chưa đủ.

Cần thêm:

$$
\text{selection operator}.
$$

---

# 89. Vì vậy một hybrid AC-LKH hợp lý

Có thể:

```text id="aclk"
      Selection layer
          │
          ▼
      choose houses
          │
          ▼
      Route layer
          │
          ▼
         LKH
          │
          ▼
       2-opt/LK
          │
          ▼
      scheduling
```

Hoặc:

$$
ALNS
$$

chịu trách nhiệm selection/day assignment,

còn:

$$
LKH
$$

chịu trách nhiệm route optimization.

Đây là một hybrid rất tự nhiên.

---

# 90. ALNS + LKH

Ví dụ:

```text id="alnsk"
ALNS
 │
 ├── Destroy houses
 │
 ▼
Repair assignment
 │
 ▼
LKH each day's route
 │
 ▼
evaluate total objective
 │
 ▼
accept / reject
```

Ở đây:

$$
\boxed{
ALNS = global restructuring
}
$$

$$
\boxed{
LKH = route-level intensive local search
}
$$

Rất mạnh.

---

# 91. LKH + MIP

Ta cũng có:

```text id="lk_mip"
MIP
 │
 ├── choose houses
 ├── assign days
 │
 ▼
LKH
 │
 └── optimize actual route
```

hoặc chiều ngược lại:

```text id="lk_mip2"
LKH
 ↓
good routes
 ↓
MIP
 ↓
optimize assignment
```

Đây chính là Matheuristic ở Chương 16.

---

# 92. LKH + Beam Search

Một route candidate có thể được tạo:

$$
Beam Search
$$

rồi:

$$
LKH
$$

polish route.

Hoặc:

$$
LKH
$$

tạo initial tours cho Beam.

---

# 93. LKH + VNS

Một architecture:

```text id="lk_vns"
VNS
├── neighborhood 1 → LK
├── neighborhood 2 → LK
├── neighborhood 3 → LK
```

hoặc:

```text id="lk_vns2"
LKH local optimum
      ↓
large perturbation
      ↓
LKH again
```

Đây gần với ILS/VNS.

---

# 94. LKH + Genetic Algorithm

LKH đã có sẵn recombination mechanisms.

Nhưng nếu tự thiết kế:

$$
GA
\rightarrow
offspring
\rightarrow
LKH
$$

thì đây là:

$$
\boxed{
Memetic\ algorithm
}
$$

LKH làm local improvement engine.

Đây là một pattern rất mạnh cho permutation problems.

---

# 95. Tại sao LK/LKH nổi tiếng đến vậy?

Vì nó giải quyết được một vấn đề cực khó:

> **Neighborhood của k-opt tăng quá nhanh, nhưng ta vẫn muốn tận dụng những move rất sâu.**

Nó giải bằng:

$$
\boxed{
variable\ depth
+
candidate\ restriction
+
structural\ pruning
}
$$

LKH nâng cấp thành:

$$
\boxed{
variable\ depth
+
\alpha\text{-candidates}
+
1\text{-tree}
+
penalties
+
general\ k\text{-opt}
+
backtracking
+
kicks
+
recombination
+
large\text{-}scale\ data\ structures
}
$$

Đó chính là "bí mật" của LKH.

---

# 96. Một cách nhìn cực kỳ quan trọng

Naive k-opt:

$$
O(n^k)
$$

ý tưởng.

LK không cố tính:

$$
N_k(S)
$$

đầy đủ.

Nó thực hiện:

$$
\boxed{
implicit\ neighborhood\ enumeration
}
$$

tức là neighborhood tồn tại về mặt khái niệm nhưng chỉ những phần có triển vọng mới được generate.

Đây là tư tưởng rất giống:

* Branch-and-Bound;
* Beam Search;
* Column Generation;
* LNS;
* CP propagation.

---

# 97. "Implicit neighborhood" là chìa khóa để hiểu LK

Ta có:

$$
N_{2}(S),N_3(S),N_4(S),\ldots
$$

rất lớn.

LK không materialize chúng.

Thay vào đó:

```text id="implicit"
Current tour
    ↓
start edge
    ↓
candidate edge
    ↓
candidate next edge
    ↓
...
```

Neighborhood được **generate on the fly**.

---

# 98. Đây chính là mối quan hệ với LNS

LNS cũng không enumerate:

$$
N_{LNS}(S).
$$

Nó:

$$
Destroy(S)
$$

rồi:

$$
Repair
$$

để implicitly generate candidates.

Có thể xem:

### LK

$$
\text{generate exchange sequence}
$$

### LNS

$$
\text{generate destroyed/repaired solution}
$$

Cả hai đều:

$$
\boxed{
implicit\ large\ neighborhood\ exploration
}
$$

---

# 99. LK dưới góc nhìn search tree

Có thể viết:

$$
State_i=(T,X_i,Y_i,G_i)
$$

và transition:

$$
State_i
\rightarrow
State_{i+1}
$$

bằng cách chọn:

$$
x_{i+1},y_{i+1}.
$$

Stop khi:

* infeasible;
* no candidate;
* \(G_i\le0\);
* close-up found;
* maximum depth reached.

Đây gần như một **constraint search** trên exchange sequences.

---

# 100. LK dưới góc nhìn dynamic programming?

Không phải DP chuẩn.

Tuy nhiên có một điểm chung:

> nhiều partial exchange sequences cần đánh giá theo state.

Nhưng LK không memoize states như DP.

Nó chọn một chiến lược DFS heuristic.

Do đó:

$$
\boxed{
LK = state\text{-}space\ search,\ not\ DP.
}
$$

---

# 101. Candidate set có thể xem như graph sparsification

Complete graph:

$$
K_n
$$

có:

$$
O(n^2)
$$

edges.

Candidate graph:

$$
G_C=(V,E_C)
$$

chỉ giữ:

$$
|E_C|=O(kn).
$$

Ví dụ:

$$
k=20
$$

→ khoảng:

$$
20n
$$

candidate edges thay vì:

$$
n(n-1)/2.
$$

Đây là một dạng:

$$
\boxed{
search-space sparsification
}
$$

---

# 102. Alpha-nearness là "intelligent sparsification"

Nearest-neighbor:

$$
\text{sparsify by local distance}.
$$

α-nearness:

$$
\text{sparsify by global TSP structure}.
$$

Đây chính là điểm làm candidate graph của LKH rất mạnh.

---

# 103. Một insight khác: candidate set chính là "prior"

Trong Bayesian-like intuition:

> "Edge này có prior probability cao xuất hiện trong optimum."

α-nearness đóng vai trò như một structural prior.

Không phải xác suất thật:

$$
P(edge\in T^*)
$$

nhưng là một surrogate measure.

---

# 104. Tại sao optimal edges thường có α nhỏ?

Vì optimal tour là một 1-tree.

Nếu edge:

$$
(i,j)
$$

thực sự thuộc optimal tour nhưng forced minimum 1-tree containing it làm cost tăng quá cao, thì edge đó có vẻ không "tự nhiên" trong relaxation.

α-nearness đo đúng sensitivity đó.

Đó là lý do heuristic này hợp lý về mặt toán học.

---

# 105. LKH và Held–Karp bound

Từ Chương 15:

$$
Held\text{-}Karp
$$

đã xuất hiện trong LP/Lagrangian context.

Trong LKH:

$$
Held\text{-}Karp
$$

được dùng để xây penalty và 1-tree.

Do đó ta có:

$$
\boxed{
Held\text{-}Karp\ relaxation
\rightarrow
LKH\ candidate\ generation
}
$$

Một connection quá đẹp giữa exact/relaxation theory và heuristic.

---

# 106. LKH là một ví dụ kinh điển của "matheuristic thinking"

Không phải matheuristic theo nghĩa MIP-based như Local Branching.

Nhưng nó thể hiện tinh thần:

$$
\boxed{
mathematical\ relaxation
\rightarrow
search\ guidance
}
$$

Do đó khi học Chương 16, LKH là một case study rất đáng nhớ.

---

# 107. LKH với giant instances

LKH-2 2009 paper thử các Euclidean instances từ:

$$
10,000
$$

đến:

$$
10,000,000
$$

cities và báo cáo runtime tăng gần tuyến tính với kích thước ở các thí nghiệm đó. ([Roskilde Universitets forskningsportal][11])

Trang LKH hiện tại cũng báo cáo kết quả trên các instance tới hàng triệu thành phố, bao gồm một instance khoảng 1.9 triệu thành phố trong danh sách best-known results. ([Webhotel 4][2])

Cần nhấn mạnh:

> đây là **empirical performance**, không phải complexity guarantee của thuật toán tổng quát.

---

# 108. Một nuance về complexity

Ta không nên nói:

$$
LKH=O(n)
$$

hay:

$$
LKH=O(n^2)
$$

một cách tuyệt đối.

Các paper báo cáo behavior thực nghiệm trên classes cụ thể.

Độ phức tạp thực tế phụ thuộc:

* candidate size;
* move depth;
* number of trials;
* backtracking;
* problem geometry;
* data structures;
* parameters.

Cho nên:

$$
\boxed{
empirical\ scaling \neq worst\text{-}case\ complexity.
}
$$

---

# 109. Các parameter quan trọng của LKH

Một số keyword đáng biết:

```text
RUNS
MAX_TRIALS
MOVE_TYPE
CANDIDATE_SET_TYPE
MAX_CANDIDATES
KICKS
KICK_TYPE
BACKTRACKING
PATCHING_A
PATCHING_C
RECOMBINATION
POPULATION_SIZE
SUBPROBLEM_SIZE
```

Official LKH documentation liệt kê các nhóm parameter này và các biến thể candidate/move/recombination. ([Webhotel 4][2])

---

# 110. MOVE_TYPE

LKH có thể dùng:

$$
2\text{-opt}
$$

$$
3\text{-opt}
$$

$$
5\text{-opt}
$$

và các cấu hình khác tùy mode/problem.

Các benchmark gần đây sử dụng `MOVE_TYPE=5` với LKH-3 mặc định trong một số thiết lập, trong khi kiến trúc tổng quát của LKH-2 cho phép general \(k\)-opt submoves. ([OpenReview][13])

Điều này cho thấy:

> "LKH" không đồng nghĩa với **một k duy nhất cố định**.

---

# 111. MAX_TRIALS

Một trial có thể thực hiện nhiều cơ hội exchange từ các starting structures.

Ví dụ:

$$
MAX\_TRIALS=n.
$$

Đây là một cách kiểm soát cường độ search.

---

# 112. RUNS

Nếu:

$$
RUNS=10,
$$

LKH chạy nhiều lần:

```text id="runs"
Run 1 → T1
Run 2 → T2
...
Run 10 → T10

return best(T1,...,T10)
```

Điều này tạo multi-start behavior.

---

# 113. KICKS và ILS-like diversification

Có thể:

$$
KICKS>0
$$

để perturb tour giữa các local searches.

Tư duy:

$$
\boxed{
intensification \leftrightarrow diversification
}
$$

giống tất cả metaheuristics ta đã học.

---

# 114. So sánh LK với các metaheuristic khác

| Thuật toán | Neighborhood            | Diversification              | Memory              |
| ---------- | ----------------------- | ---------------------------- | ------------------- |
| 2-opt      | fixed 2-exchange        | thấp                         | không               |
| 3-opt      | fixed 3-exchange        | thấp                         | không               |
| SA         | fixed/variable          | acceptance                   | temperature         |
| Tabu       | neighborhood            | tabu                         | mạnh                |
| VNS        | multiple neighborhoods  | shake                        | cấu trúc            |
| LNS        | large destroy/repair    | destroy                      | acceptance          |
| **LK**     | variable-depth k-opt    | restart/kicks                | implicit            |
| **LKH**    | advanced variable-depth | kicks + runs + recombination | structural guidance |

---

# 115. Một điểm cực hay: LK có cả Intensification và Diversification

### Intensification

* α-candidates;
* gain criterion;
* deep k-opt;
* aggressive local search.

### Diversification

* starting tours;
* kicks;
* multiple runs;
* recombination;
* population.

Do đó LKH thực tế là một framework khá hoàn chỉnh.

---

# 116. LKH vs ILS

Có thể viết:

$$
ILS:
Perturb
\rightarrow
LocalSearch
$$

LKH:

$$
Kick
\rightarrow
LK
$$

Nên về architecture:

$$
\boxed{
LKH\text{ có một lớp ILS-like behavior}
}
$$

nhưng LK local search bên trong mạnh hơn nhiều.

---

# 117. LKH vs ALNS

ALNS:

$$
Destroy_i
+
Repair_j
$$

với:

$$
P_i,P_j
$$

adaptive.

LKH:

$$
k\text{-exchange}
$$

được search bằng:

$$
candidate+gain+feasibility.
$$

ALNS mạnh ở:

$$
operator\ diversity.
$$

LKH mạnh ở:

$$
route\ topology\ intelligence.
$$

---

# 118. Nếu chỉ được nhớ một câu về LK

$$
\boxed{
\textbf{LK = k-opt, nhưng k không được quyết định trước.}
}
$$

Mà được **xây dần trong search**.

---

# 119. Nếu chỉ được nhớ một câu về LKH

$$
\boxed{
\textbf{LKH = LK + extremely intelligent candidate/search machinery.}
}
$$

Cụ thể:

$$
\boxed{
LK
+
\alpha\text{-nearness}
+
1\text{-trees}
+
Held\text{-}Karp\ penalties
+
general\ k\text{-opt}
+
pruning
+
backtracking
+
kicks
+
large\text{-}scale\ implementation
}
$$

---

# 120. Pseudocode LK đơn giản hóa

```cpp
Tour T = initialTour();

while (true) {
    bool improved = false;

    for (each starting node t1) {
        for (each starting edge x1) {

            SearchState state(T, x1);

            dfs(state);

            if (bestMove.improves(T)) {
                apply(bestMove, T);
                improved = true;
                break;
            }
        }

        if (improved) break;
    }

    if (!improved)
        break;
}
```

Nhưng `dfs(state)` mới là phần thực sự khó.

---

# 121. `dfs(state)` ở mức ý tưởng

```cpp
void dfs(State s) {

    choose candidate y_i;

    if (!positiveGain(y_i))
        return;

    choose feasible x_i;

    if (canCloseTour(s)) {
        if (gain > 0)
            recordMove();
    }

    if (depthLimitReached())
        return;

    for (next candidate y_{i+1})
        dfs(nextState);
}
```

Thực tế LKH phức tạp hơn rất nhiều, với các special cases, patching, non-sequential moves, data structures và pruning rules.

---

# 122. Pseudocode LKH-level abstraction

```text id="lkhlvl"
Build candidate sets
Build penalties / 1-tree information

Initialize best tour

repeat RUNS times:

    construct / choose initial tour

    repeat:

        perform LK search
            ├── candidate restriction
            ├── positive gain
            ├── feasibility tests
            ├── sequential / non-sequential moves
            ├── close-up
            └── backtracking

        if improved:
            continue

        kick / diversify

    optionally recombine tours

return best tour
```

---

# 123. Tại sao implementation LKH khó?

Paper 2000 của Helsgaun nhấn mạnh rằng việc thiết kế và implement LK không hề trivial; có rất nhiều quyết định implementation và nhiều quyết định ảnh hưởng mạnh đến performance. ([ScienceDirect][10])

Cậu không nên kỳ vọng:

> "Tôi đọc 20 dòng pseudo-code là viết được LKH."

Không.

LKH là một **hệ thống algorithms + data structures + tuning decisions**.

---

# 124. Một implementation LK giáo khoa thì khả thi

Nếu mục tiêu là học:

1. tour array;
2. candidate list;
3. 2-opt;
4. sequential \(x/y\) exchange;
5. gain;
6. close-up;
7. backtracking.

Có thể viết một LK đơn giản.

Nhưng:

$$
\boxed{
LKH\text{-}quality
\neq
simple\ LK.
}
$$

Khoảng cách giữa hai thứ rất lớn.

---

# 125. Một roadmap implement LK

Tôi sẽ đi theo:

```text
Step 1
2-opt

Step 2
3-opt

Step 3
candidate list

Step 4
sequential exchange

Step 5
gain criterion

Step 6
close-up

Step 7
backtracking

Step 8
variable depth

Step 9
kicks

Step 10
alpha-nearness

Step 11
1-tree / ascent

Step 12
efficient tour representation
```

Đây là cách học dễ hơn nhiều so với đọc thẳng source LKH.

---

# 126. Candidate set nên thử theo thứ tự

### Level 1

Nearest neighbors.

### Level 2

Delaunay.

### Level 3

α-nearness.

### Level 4

α + extra geometric candidates.

### Level 5

POPMUSIC / custom candidate generation.

Official LKH hiện hỗ trợ nhiều candidate-set modes, bao gồm ALPHA, DELAUNAY, NEAREST-NEIGHBOR, QUADRANT và POPMUSIC. ([Webhotel 4][2])

---

# 127. Nếu cần hiểu LKH source code

Đừng bắt đầu bằng `LKHmain.c`.

Hãy tìm conceptual modules:

```text
CreateCandidateSet
Ascent
FindTour
LinKernighan
BestKOptMove / KSwap-like machinery
Flip
Swap
MakeKOptMove
Penalty
```

Tên chính xác thay đổi theo version/source layout, nhưng khi đọc source hãy tìm các responsibility đó.

---

# 128. LKH-3 và custom problem

Official LKH-3 không chỉ là TSP.

Các problem type được hỗ trợ hiện gồm:

$$
TSP,\ ATSP,\ HCP,\ HPP
$$

và rất nhiều constrained variants như:

$$
CVRP,\ CVRPTW,\ PDTSP,\ DCVRP,\ CluVRP,\dots
$$

([Webhotel 4][16])

Điều này chứng minh:

> core philosophy của LK/LKH có thể được **generalize ra khỏi TSP**.

---

# 129. Cấu trúc tổng quát để generalize LK

Giữ nguyên:

$$
\boxed{
tour\ representation
+
exchange\ engine
}
$$

thay đổi:

$$
\boxed{
cost/penalty/feasibility
}
$$

Tức là:

```text id="general"
             LK Core
                │
       ┌────────┼─────────┐
       │        │         │
      TSP      CVRP     CVRPTW
       │        │         │
    distance   load    load + time
```

Đây là một architecture rất mạnh.

---

# 130. LKH-3 và penalty function là abstraction boundary

Đây là insight Software Engineering rất đẹp.

Core:

```text
Exchange Search
```

Problem-specific:

```text
Penalty(T)
```

Do đó algorithm core không phải biết toàn bộ semantics của CVRP/CVRPTW.

Nó chỉ cần hỏi:

$$
\boxed{
Cost(T)
}
$$

và:

$$
\boxed{
Penalty(T)
}
$$

---

# 131. LK/LKH và "move evaluator"

Trong bài toán general:

$$
F(T)
=
Objective(T)+Penalty(T).
$$

Một move:

$$
T\rightarrow T'
$$

có:

$$
\Delta F
=
F(T')-F(T).
$$

Cốt lõi của search là đánh giá \(\Delta F\) **rất nhanh**.

Do đó:

$$
\boxed{
fast\ delta\ evaluation
}
$$

là một nguyên lý quan trọng không chỉ của LKH mà của mọi local search.

---

# 132. Đây là connection với Chương 5

Ta từng học:

$$
\Delta_{2opt}
=
-d(a,b)-d(c,d)
+d(a,c)+d(b,d).
$$

LK tổng quát hóa tư duy này:

$$
\Delta
=
-\sum_{x_i}c(x_i)
+
\sum_{y_i}c(y_i).
$$

Do đó gain:

$$
G_k=-\Delta.
$$

Tức là:

$$
\boxed{
LK = extremely\ sophisticated\ delta\ evaluation\ over\ variable-depth\ k-opt.
}
$$

---

# 133. Và đây là connection với Chương 13

LNS có:

$$
Destroy
\rightarrow
Repair.
$$

LK có:

$$
Remove
\rightarrow
Add
\rightarrow
Remove
\rightarrow
Add.
$$

Cả hai đều xây một candidate solution bằng chuỗi modifications.

Khác biệt:

### LNS

thường xóa **một tập lớn** rồi repair.

### LK

interleave:

$$
remove/add/remove/add.
$$

Điều này khiến LK có tính **fine-grained structural surgery**.

---

# 134. "Surgery" là cách rất hay để tưởng tượng LK

Tour là:

```text
████████████████████
```

2-opt:

```text
✂──────✂
```

LK:

```text
✂
 └─ nối
    ✂
     └─ nối
        ✂
         └─ nối
            ...
```

Nó thực hiện một chuỗi "phẫu thuật" lên route trước khi quyết định commit.

---

# 135. Vì sao LK mạnh hơn 2-opt dù không exhaustive?

2-opt chỉ thấy:

$$
N_2(S).
$$

Nếu:

$$
S
$$

là 2-opt local optimum:

$$
\nexists S'\in N_2(S):f(S')<f(S).
$$

Nhưng có thể tồn tại:

$$
S^*\in N_5(S)
$$

tốt hơn.

LK có khả năng xây move sâu tới 5 exchanges và vì vậy thoát khỏi 2-opt local optimum.

---

# 136. Nhưng LK không phải exhaustive 5-opt

Đây là nuance rất quan trọng.

LK không nói:

> "Tôi sẽ xét tất cả 5-opt."

Nó chỉ xét **một tập con có chọn lọc**.

Do đó:

$$
N_{LK}(S)
\subsetneq
\bigcup_k N_k(S)
$$

thường là rất nhỏ so với toàn bộ k-opt universe.

---

# 137. LKH chính là bài học về "search-space engineering"

Đây có lẽ là insight quan trọng nhất của bonus.

LKH không thắng vì:

> "nó có một công thức gain thần kỳ."

Nó thắng vì nó thiết kế search space rất kỹ:

$$
\boxed{
\text{which edges}
}
$$

$$
\boxed{
\text{which exchanges}
}
$$

$$
\boxed{
\text{which depth}
}
$$

$$
\boxed{
\text{which partial moves}
}
$$

$$
\boxed{
\text{which candidates to backtrack}
}
$$

$$
\boxed{
\text{when to restart}
}
$$

---

# 138. Đây là lý do LKH là "masterclass" về heuristic design

Nó đồng thời có:

```text
Neighborhood design
Candidate generation
Search pruning
Delta evaluation
Backtracking
Diversification
Initialization
Mathematical relaxation
Data structures
Parameterization
Hybridization
```

Tức là nó gần như chứa **toàn bộ một môn metaheuristic optimization** trong một solver.

---

# 139. LKH và Chapter 15

| Chapter 15 concept  | LKH counterpart             |
| ------------------- | --------------------------- |
| LP/relaxation       | Held–Karp/1-tree relaxation |
| Dual variables      | \(\pi_i\) penalties         |
| Lower bound         | \(w(\pi)\)                  |
| Sensitivity         | α-nearness                  |
| Search              | LK                          |
| Cut/prune mentality | gain/feasibility pruning    |
| Decomposition       | subproblem partitioning     |

LKH không phải MIP solver, nhưng nó **mượn tư duy toán học từ relaxation/duality** để cải thiện heuristic.

---

# 140. LKH và Chapter 16

| Matheuristic concept   | LKH                                |
| ---------------------- | ---------------------------------- |
| Mathematical guidance  | 1-tree / Held–Karp                 |
| Variable neighborhood  | variable-depth k-opt               |
| Exact-ish substructure | strong structured move search      |
| Diversification        | kicks                              |
| Multi-start            | runs                               |
| Population             | optional GA/recombination          |
| Hybrid                 | LKH + recombination / partitioning |

Đây là lý do LK/LKH rất đáng để đặt sau Chương 16.

---

# 141. Nếu cậu đang giải bài toán route thực tế

Tôi sẽ không hỏi:

> "Có nên dùng LKH không?"

Mà hỏi:

### Route topology có phải phần khó nhất?

Nếu có:

$$
\boxed{\text{Yes → LKH rất đáng thử}}
$$

### Selection mới là bottleneck?

Thêm:

$$
ALNS/MIP/DP.
$$

### Scheduling/resource constraints mới khó?

Thêm:

$$
CP/MIP.
$$

### Route + scheduling + selection đều khó?

Dùng:

$$
\boxed{
Hybrid
}
$$

---

# 142. Một architecture tôi rất thích cho bài AC

```text id="ac-final"
                   Global Search
                       ALNS
                        │
             Adaptive Destroy
                        │
                        ▼
              Select houses / days
                        │
                        ▼
                Route construction
                        │
              ┌─────────┴─────────┐
              │                   │
           Greedy                LKH
              │                   │
              └─────────┬─────────┘
                        ▼
                     VND/2-opt
                        │
                        ▼
                    evaluate
                        │
                        ▼
                   acceptance
                        │
                        ▼
                update operators
```

Ở đây:

$$
LKH
$$

là **route optimizer**, không phải global solver.

---

# 143. Một architecture còn mạnh hơn

```text id="ac-strong"
                    ALNS
                      │
       ┌──────────────┼──────────────┐
       │              │              │
   selection      day assignment   destroy
       │              │              │
       └──────────────┼──────────────┘
                      ▼
               route subproblems
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
        LKH         LKH          LKH
        Day 1       Day 2        Day 3
          │           │           │
          └───────────┼───────────┘
                      ▼
                    score
```

Nếu có 30 ngày, có thể tối ưu mỗi day route bằng một LKH-like local search.

---

# 144. Nhưng có một vấn đề

LKH giả định cấu trúc route khá phù hợp với permutation/cycle.

Bài AC có:

* optional houses;
* multiple days;
* overtime;
* service duration;
* profit.

Vậy cần thêm:

$$
\text{selection/day assignment}
$$

ngoài route optimization.

Đây là lý do:

$$
\boxed{
LKH\ alone\ is\ not\ the\ whole\ solution.
}
$$

---

# 145. Khi nào LKH thua ALNS?

Nếu problem có nhiều cấu trúc phi-route:

```text
selection
assignment
resource allocation
scheduling
```

ALNS có thể dễ generalize hơn.

LKH cực mạnh khi:

$$
\boxed{
permutation/routing\ dominates.
}
$$

---

# 146. Khi nào LKH thua MIP?

Nếu:

* \(n\) nhỏ;
* formulation tốt;
* cần proof;
* constraints phức tạp nhưng tuyến tính.

MIP có thể giải exact.

LKH phù hợp hơn khi:

$$
n\text{ rất lớn}
$$

và:

$$
\text{need good solution quickly}.
$$

---

# 147. Khi nào LKH thua CP?

Nếu cấu trúc chủ yếu là:

```text
precedence
NoOverlap
Cumulative
calendar
sequence constraints
```

CP có thể tự nhiên hơn.

LKH-3 đã bổ sung nhiều constrained routing types, nhưng vẫn cần thiết kế penalty/representation phù hợp. ([Webhotel 4][16])

---

# 148. Một insight cực mạnh: LKH không phải "một neighborhood"

Nó là:

$$
\boxed{
Neighborhood\ generation\ framework.
}
$$

Trong đó:

$$
\text{start edge}
\rightarrow
\text{candidate edge}
\rightarrow
\text{next edge}
\rightarrow
\cdots
$$

gần như là một **policy** để sinh neighborhood.

Đây là lý do gọi nó là **variable-depth local search**, không đơn giản là k-opt.

---

# 149. LKH và policy

Có thể abstract:

$$
\pi_{\mathrm{LK}}(state)
\rightarrow
next\ exchange.
$$

State chứa:

* current endpoint;
* removed edges;
* added edges;
* gain;
* candidate list;
* feasibility status.

Policy heuristic quyết định:

> tiếp theo chọn edge nào?

Đây là perspective rất hiện đại.

---

# 150. Một cách nhìn machine-learning-friendly

Ta có state:

$$
s_t.
$$

Action:

$$
a_t=(x_t,y_t).
$$

Reward:

$$
r_t=g_t.
$$

LKH:

$$
s_t\rightarrow a_t\rightarrow s_{t+1}
$$

với những heuristic rules định sẵn.

NeuroLKH và các nghiên cứu ML hiện đại đã bắt đầu học hoặc thay thế một phần candidate selection/search guidance của LKH. Một ví dụ 2023 sử dụng reinforcement-learning perspective để học thông tin cho candidate selection; các benchmark 2025–2026 cũng tiếp tục dùng LKH-3 như một strong classical baseline. ([Springer][8])

---

# 151. Vì vậy LKH là baseline cực mạnh cho ML-for-TSP

Điều này giải thích tại sao rất nhiều paper:

```text
Neural solver
vs
LKH
```

hoặc:

```text
Neuro + LKH
```

LKH đã là một baseline rất khó đánh bại.

Official LKH ecosystem cũng liệt kê rất nhiều nghiên cứu sử dụng nó trong TSP/VRP và các ứng dụng khác. ([Webhotel 4][18])

---

# 152. Một cách nhớ lịch sử

$$
\boxed{
Lin\text{-}Kernighan
}
$$

1973:

> variable-depth k-opt.

$$
\boxed{
LKH
}
$$

Helsgaun 1999/2000:

> LK + sophisticated search + sensitivity.

$$
\boxed{
LKH-2
}
$$

2007–2009:

> general k-opt + giant-instance engineering + partitioning.

$$
\boxed{
LKH-3
}
$$

2017 onward:

> constrained TSP / VRP extensions.

Current official versions list LKH 2.0.11 from June 2025 and LKH-3 3.0.13 from November 2024. ([Webhotel 4][2])

---

# 153. Một bảng so sánh toàn bộ

|                         |            2-opt |        3-opt |                LK |                         LKH |
| ----------------------- | ---------------: | -----------: | ----------------: | --------------------------: |
| \(k\) cố định           |               Có |           Có |             Không |                       Không |
| Variable depth          |            Không |        Không |            **Có** |                      **Có** |
| Candidate set           |         đơn giản |     đơn giản | nearest neighbors | **α-nearness / nhiều loại** |
| Gain pruning            |               ít |           ít |            **Có** |            **Có, nâng cao** |
| Backtracking            |            Không | thường không |                Có |                      **Có** |
| 1-tree                  |            Không |        Không |    Không bắt buộc |                      **Có** |
| Held–Karp info          |            Không |        Không |             Không |                      **Có** |
| General k-opt           |            Không |        Không |           hạn chế |                      **Có** |
| Kicks                   | ngoài thuật toán |        ngoài |            có thể |                      **Có** |
| Recombination           |            Không |        Không |             Không |                      **Có** |
| Large-scale engineering |             thấp |         thấp |               cao |                 **rất cao** |
| VRP extension           |            không |        không |           hạn chế |                   **LKH-3** |

---

# 154. "LK" viết tắt chính xác là gì?

$$
\boxed{
\text{Lin–Kernighan}
}
$$

theo S. Lin và B. W. Kernighan.

Paper gốc:

> **An Effective Heuristic Algorithm for the Traveling-Salesman Problem**, *Operations Research*, 21(2):498–516, 1973. ([PubsOnline][1])

---

# 155. "LKH" là gì?

$$
\boxed{
\text{Lin–Kernighan–Helsgaun}
}
$$

thường dùng để chỉ implementation/extension của Helsgaun.

Paper nền tảng:

> **An Effective Implementation of the Lin-Kernighan Traveling Salesman Heuristic**, *European Journal of Operational Research*, 126(1):106–130, 2000. ([ScienceDirect][10])

---

# 156. Ba tài liệu nên đọc theo thứ tự

### 1. Lin & Kernighan (1973)

Để hiểu:

* variable depth;
* exchange sequence;
* gain;
* feasibility;
* candidate restrictions.

([PubsOnline][1])

### 2. Helsgaun (2000)

Để hiểu LKH-1:

* modified search;
* sensitivity;
* candidate sets;
* implementation;
* performance.

([ScienceDirect][10])

### 3. Helsgaun (2009)

Để hiểu LKH-2:

* general \(k\)-opt submoves;
* non-sequential moves;
* huge-instance implementation;
* partitioning.

([Roskilde Universitets forskningsportal][11])

Sau đó mới đọc:

### 4. Helsgaun (2017)

để hiểu LKH-3 và constrained TSP/VRP.

([Roskilde Universitets forskningsportal][17])

---

# 157. Nguồn implementation chính thức

Trang chính thức của Keld Helsgaun hiện cung cấp source của:

$$
\boxed{LKH-2.0.11}
$$

và extension:

$$
\boxed{LKH-3.0.13}.
$$

LKH-2 được viết bằng ANSI C; LKH-3 cũng vậy và có source cho Unix/Linux cùng Windows executable/project. ([Webhotel 4][2])

---

# 158. Một lưu ý về GitHub

Có nhiều GitHub mirror/fork của LKH-3, nhưng chúng **không phải repository chính thức của tác giả**. Ví dụ một mirror tự mô tả là copy của LKH-3 và nhắc rằng code không được phát hành dưới MIT license. ([GitHub][19])

Khi nghiên cứu source:

$$
\boxed{
ưu tiên\ source\ chính\ thức\ của\ Helsgaun.
}
$$

---

# 159. Nếu học thuật toán này thật sâu, nên chia thành 5 tầng

## Tầng 1 — Exchange

Hiểu:

$$
X,Y
$$

và \(k\)-opt.

## Tầng 2 — Search

Hiểu:

$$
x_i,y_i,
\quad G_i,
\quad close-up,
\quad backtracking.
$$

## Tầng 3 — Candidate

Hiểu:

$$
1\text{-tree},
\quad\alpha\text{-nearness}.
$$

## Tầng 4 — Mathematical guidance

Hiểu:

$$
\pi,
\quad Held\text{-}Karp,
\quad subgradient.
$$

## Tầng 5 — Engineering

Hiểu:

* candidate graph;
* tour representation;
* kicks;
* partitioning;
* recombination;
* caching;
* multi-run.

---

# 160. Một cây kiến thức của LK/LKH

```text
                    Lin–Kernighan
                          │
               Variable-depth k-opt
                          │
          ┌───────────────┼───────────────┐
          │               │               │
      Exchange          Gain          Feasibility
          │               │               │
       x / y           G_i>0          close-up
          │               │               │
          └───────────────┼───────────────┘
                          ▼
                     Search Tree
                          │
                    Candidate Set
                          │
              ┌───────────┴───────────┐
              │                       │
      Nearest Neighbor           α-nearness
                                      │
                                  1-tree
                                      │
                               Held–Karp ascent
                                      │
                                  π penalties
                                      │
                              transformed costs
                                      │
                                  LKH search
                                      │
                    ┌─────────────────┼────────────────┐
                    │                 │                │
                   kicks          partitioning    recombination
                    │                 │                │
                    └─────────────────┼────────────────┘
                                      ▼
                                     LKH-2
                                      │
                                      ▼
                                     LKH-3
                                      │
                              constrained TSP/VRP
```

---

# 161. Bài học lớn nhất từ LK/LKH

Tôi nghĩ bonus này giúp hoàn thiện một mảnh còn thiếu trong curriculum.

Ta từng học:

$$
\text{Local Search}
$$

như một ý tưởng chung.

Nhưng LK cho thấy:

> **Một local search cực mạnh không đến từ việc có một neighborhood lớn; nó đến từ việc biết cách khám phá neighborhood đó.**

Cụ thể:

$$
\boxed{
Huge\ neighborhood
+
good\ candidate\ model
+
smart\ pruning
=
powerful\ local\ search
}
$$

LKH còn thêm:

$$
\boxed{
mathematical\ guidance
+
excellent\ engineering
}
$$

---

# 162. Và đây là connection xuyên suốt toàn bộ 16 chương

Ta có:

$$
\text{Greedy}
\rightarrow
\text{LS}
\rightarrow
\text{ILS/VNS}
\rightarrow
\text{LNS}
\rightarrow
\text{ALNS}
$$

ở một phía.

Ở phía kia:

$$
\text{LP}
\rightarrow
\text{1-tree}
\rightarrow
\text{duality}
\rightarrow
\text{decomposition}.
$$

LKH ngồi **ngay giữa hai thế giới**:

```text id="bridge"
        METAHEURISTIC                    MATHEMATICAL
             │                                │
             │                                │
       variable-depth                    1-tree
       local search                     Held–Karp
       kicks                            penalties
       candidate search                lower bound
             │                                │
             └──────────────┬─────────────────┘
                            ▼
                           LKH
```

Đó là lý do tôi đánh giá **Lin–Kernighan/Helsgaun** là một trong những case study đáng học nhất sau khi hoàn thành toàn bộ lộ trình.

---

# 163. Công thức ghi nhớ cuối cùng

### LK:

$$
\boxed{
LK=
Variable\text{-}Depth\ k\text{-}Opt
+
Gain
+
Feasibility
+
Backtracking
}
$$

### LKH:

$$
\boxed{
LKH=
LK
+
\alpha\text{-Nearness}
+
1\text{-Tree}
+
Held\text{-}Karp\ Ascent
+
General\ k\text{-Opt}
+
Advanced\ Candidate/Search\ Control
+
Diversification
+
Engineering
}
$$

### LKH-3:

$$
\boxed{
LKH\text{-}3
=
LKH
+
Penalty\text{-}based\ constrained\ TSP/VRP
}
$$

---

## Tài liệu nghiên cứu cốt lõi

**Lin & Kernighan (1973)** — paper gốc định nghĩa heuristic LK và variable-depth search. Paper xuất hiện trên *Operations Research* 21(2):498–516. ([PubsOnline][1])

**Helsgaun (2000)** — paper nền tảng của LKH-1, tập trung vào modified LK search, sensitivity analysis và implementation hiệu quả. ([ScienceDirect][10])

**Helsgaun (2006/2007 report)** — *An Effective Implementation of K-opt Moves for the Lin-Kernighan TSP Heuristic*, nền tảng cho LKH-2. ([Webhotel 4][14])

**Helsgaun (2009)** — *General k-opt submoves for the Lin–Kernighan TSP heuristic*, trình bày generalized k-opt trong LKH-2 và thực nghiệm trên instances từ 10 nghìn tới 10 triệu thành phố. ([Roskilde Universitets forskningsportal][11])

**Helsgaun (2017)** — *An Extension of the Lin-Kernighan-Helsgaun TSP Solver for Constrained Traveling Salesman and Vehicle Routing Problems*, nền tảng của LKH-3. ([Roskilde Universitets forskningsportal][17])

**Official LKH/LKH-3 source and documentation** — hiện liệt kê LKH 2.0.11 và LKH-3 3.0.13 cùng các candidate set, move, kick, recombination và partitioning options. ([Webhotel 4][2])

---

### Tổng kết bonus

Nếu cậu đã thực sự hiểu:

$$
\boxed{
2\text{-opt}
\rightarrow
k\text{-opt}
\rightarrow
LK
\rightarrow
LKH
\rightarrow
LKH\text{-}3
}
$$

thì cậu đã nắm được một trong những ví dụ kinh điển nhất của **heuristic engineering**:

> **không cố tìm toàn bộ không gian nghiệm; thay vào đó, xây một cách thông minh để chỉ khám phá những phần của không gian nghiệm có xác suất cao chứa lời giải tốt.**

Và điểm đẹp nhất của LKH là nó thực hiện điều đó bằng sự kết hợp của **combinatorial search + geometric structure + relaxation/duality + data structures + diversification**.

Đó chính là lý do một heuristic từ năm **1973** vẫn là một đối thủ cực kỳ mạnh trong nghiên cứu TSP hiện đại. ([PubsOnline][1])

[1]: https://pubsonline.informs.org/doi/pdf/10.1287/opre.21.2.498 "An Effective Heuristic Algorithm for the Traveling-Salesman Problem | Operations Research"
[2]: https://webhotel4.ruc.dk/~keld/research/LKH/?utm_source=chatgpt.com "LKH (Keld Helsgaun)"
[3]: https://www.researchgate.net/publication/227121797_General_k-opt_submoves_for_the_Lin-Kernighan_TSP_heuristic?utm_source=chatgpt.com "(PDF) General k-opt submoves for the Lin–Kernighan TSP heuristic"
[4]: https://www.sciencedirect.com/science/article/pii/S0305054826000614?utm_source=chatgpt.com "A speed-up for Helsgaun’s TSP heuristic by relaxing the positive gain criterion - ScienceDirect"
[5]: https://thesis.eur.nl/pub/50237/Keetelaar_433250.pdf?utm_source=chatgpt.com "Erasmus University Rotterdam"
[6]: https://studylib.net/doc/11097059/september--1---1978-esl-fr-834-5-complex-materials-handli...?utm_source=chatgpt.com "September 1, 1978 ESL-FR-834-5 COMPLEX MATERIALS HANDLING AND ASSEMBLY SYSTEMS"
[7]: https://www.researchgate.net/publication/382065244_Dancing_to_the_State_of_the_Art_How_Candidate_Lists_Influence_LKH_for_Solving_the_Traveling_Salesperson_Problem?utm_source=chatgpt.com "(PDF) Dancing to the State of the Art? How Candidate Lists Influence LKH for Solving the Traveling Salesperson Problem"
[8]: https://link.springer.com/article/10.1016/j.jksuci.2023.101723?utm_source=chatgpt.com "Discovering Lin-Kernighan-Helsgaun heuristic for routing optimization using self-supervised reinforcement learning | Journal of King Saud University Computer and Information Sciences | Springer Nature Link"
[9]: https://pmc.ncbi.nlm.nih.gov/articles/PMC8520904/?utm_source=chatgpt.com "Solving the Large-Scale TSP Problem in 1 h: Santa Claus Challenge 2020 - PMC"
[10]: https://www.sciencedirect.com/science/article/pii/S0377221799002842?utm_source=chatgpt.com "An effective implementation of the Lin–Kernighan traveling salesman heuristic - ScienceDirect"
[11]: https://forskning.ruc.dk/en/publications/generalk-opt-submoves-for-the-lin-kernighan-tsp-heuristic/?utm_source=chatgpt.com "General k-opt submoves for the Lin-Kernighan TSP heuristic - Roskilde University Research Portal"
[12]: https://usermanual.wiki/Document/LKH20USERGUIDE.413457365.pdf?utm_source=chatgpt.com "LKH  
User Guide  
Version 2.0.2 (October 2008)"
[13]: https://openreview.net/pdf/ccdeb53fe368d435e440137a811102180bd59b0f.pdf?utm_source=chatgpt.com "Under review as a conference paper at ICLR 2026"
[14]: https://webhotel4.ruc.dk/~keld/research/LKH/KoptReport.pdf?utm_source=chatgpt.com "An Effective Implementation of K-opt Moves"
[15]: https://github.com/cerebis/LKH3?utm_source=chatgpt.com "GitHub - cerebis/LKH3: Github mirror of Keld Helsgaun's wonderful LKH3 project. · GitHub"
[16]: https://webhotel4.ruc.dk/~keld/research/LKH-3/?utm_source=chatgpt.com "LKH-3 (Keld Helsgaun)"
[17]: https://forskning.ruc.dk/en/publications/an-extension-of-the-lin-kernighan-helsgaun-tsp-solver-for-constra/ "An Extension of the Lin-Kernighan-Helsgaun TSP Solver for Constrained Traveling Salesman and Vehicle Routing Problems: Technical report - Roskilde University Research Portal"
[18]: https://webhotel4.ruc.dk/~keld/research/LKH/ScientificApplications.html?utm_source=chatgpt.com "Scientific applications of LKH"
[19]: https://github.com/ProvideQ/lkh-3?utm_source=chatgpt.com "GitHub - ProvideQ/lkh-3: Copy of the LKH-3 solver, used a Sub-Repository for the toolbox-server. This is an extra repository because LKH-3 is not distributed with the MIT license. · GitHub"
