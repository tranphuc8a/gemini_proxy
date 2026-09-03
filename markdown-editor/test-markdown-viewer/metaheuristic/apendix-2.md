# Phụ lục 2 — Thiết kế các thuật toán heuristic cho bài toán người dọn vệ sinh

Sau toàn bộ 16 chương, đây là lúc đáng làm một việc rất thực dụng: **không chọn ngay một thuật toán duy nhất**, mà thiết kế một *portfolio* gồm nhiều lời giải có mức độ phức tạp tăng dần, rồi phân tích xem cấu trúc nào thực sự đem lại điểm số tốt nhất.

Điểm quan trọng đầu tiên là bài toán ban đầu của cậu **không phải TSP thuần túy**. Nó gần với họ:

$$
\boxed{\text{Prize-Collecting / Orienteering / Profitable Routing}}
$$

vì ta vừa phải:

* chọn house nào nên làm;
* quyết định thứ tự ghé;
* chịu giới hạn thời gian mỗi ngày;
* tối đa hóa reward thay vì bắt buộc phục vụ tất cả.

Literature về Orienteering Problem định nghĩa chính xác tinh thần này: chọn một subset của khách hàng có reward, rồi tìm route trong giới hạn thời gian để maximize collected prize. ([ScienceDirect][1])

Đặc biệt, các công trình về **time-dependent prize-collecting routing** cũng sử dụng VNS, Iterated Greedy, ALNS và các destroy/repair heuristic cho những bài toán rất gần về cấu trúc. Iterated Greedy từng được báo cáo vượt các heuristic VNS/LANTIME trước đó trên benchmark TD-PARP; ALNS cũng đã được áp dụng trực tiếp cho Orienteering Problem và cho kết quả rất mạnh trên cả budget ngắn lẫn dài. ([ScienceDirect][2])

---

# 1. Đọc lại bản chất bài toán

Theo đặc tả đã nghiên cứu từ đầu, ta có:

* thành phố \(100\times100\);
* khoảng \(200\)–\(399\) house;
* một technician;
* tối đa \(30\) ngày;
* mỗi ngày tối đa \(720\) phút;
* đi giữa hai điểm mất Manhattan distance;
* house \(i\) có \(m_i\) máy;
* thời gian làm:

$$
s_i=30m_i+30;
$$

* reward:

$$
p_i=gPrice[m_i]
$$

với:

$$
[0,80000,140000,180000,240000,250000,300000];
$$

* overtime sau phút 480 mang thêm \(200\) điểm/phút;
* mỗi house tối đa một lần.

Tôi sẽ ký hiệu:

$$
T_d
$$

là số phút làm việc trong ngày \(d\).

Score ngày \(d\) có dạng:

$$
Score_d
=
\sum_{i\in day_d}p_i
+
200\max(0,T_d-480).
$$

Tổng:

$$
\boxed{
Score=\sum_{d=1}^{30}Score_d.
}
$$

> Tôi đang dùng đúng cách hiểu "overtime là bonus dương" từ đặc tả cậu đã cung cấp. Đây là chi tiết cần kiểm tra lại trong judge nếu API thực tế có cách tính khác.

---

# 2. Một insight rất quan trọng: đây là "selection + sequencing + partitioning"

Ta có ba quyết định:

$$
\boxed{
\text{Which houses?}
}
$$

$$
\boxed{
\text{In what order?}
}
$$

$$
\boxed{
\text{Where to split into days?}
}
$$

Có thể hình dung:

```text
All houses
    │
    ▼
 SELECT
    │
    ▼
h1 → h2 → h3 → h4 → h5 → ...
    │
    ▼
 PARTITION INTO DAYS
    │
    ├── Day 1
    ├── Day 2
    ├── Day 3
    └── ...
```

Ba lớp này nên được xử lý **tách biệt càng nhiều càng tốt**.

Đây là điểm mà tôi cho rằng sẽ quyết định chất lượng solution.

---

# 3. Một insight còn quan trọng hơn: không nên tối ưu day assignment quá sớm

Giả sử ta có:

```text
A → B → C → D → E → F
```

Ta có thể partition:

```text
Day 1: A B C
Day 2: D E F
```

hoặc:

```text
Day 1: A B
Day 2: C D E F
```

hoặc:

```text
Day 1: A B C D
Day 2: E F
```

Nếu `nextDay()` chỉ reset clock mà **không thay đổi vị trí**, thì thứ tự ghé house vẫn là một chuỗi liên tục; việc chia ngày chủ yếu quyết định **edge nào thuộc ngày nào và overtime được hưởng thế nào**.

Điều này cho phép ta làm một trick cực hay:

$$
\boxed{
\text{Optimize order trước}
\quad+\quad
\text{tối ưu partition bằng DP}
}
$$

thay vì nhét cả day assignment vào metaheuristic.

Đây có thể là một trong những tối ưu lớn nhất về mặt kiến trúc.

Nếu `nextDay()` trong judge có semantics khác, chẳng hạn đưa technician về depot, thì công thức partition cần thêm chi phí depot-to-start; framework vẫn dùng được nhưng segment-cost phải sửa.

---

# 4. Exact Day Partition DP

Đây là subroutine tôi **rất khuyến nghị**, dù toàn bộ solution vẫn heuristic.

Giả sử một candidate solution đã cho ta một sequence:

$$
v_1,v_2,\ldots,v_k.
$$

Đặt:

$$
s_i=30m_i+30.
$$

Travel giữa hai house:

$$
d_i=dist(v_i,v_{i+1}).
$$

Ta cần chia sequence thành tối đa 30 đoạn, mỗi đoạn:

$$
\le720.
$$

---

## 4.1. Segment time

Với segment:

$$
v_{j+1},v_{j+2},\ldots,v_i
$$

ta có:

$$
time(j+1,i)
=
\sum_{t=j+1}^{i}s_t
+
\sum_{t=j+1}^{i-1}d_t.
$$

Ta có thể tính bằng prefix sum để:

$$
O(1)
$$

cho mỗi segment.

---

## 4.2. Segment profit

$$
profit(j+1,i)
=
\sum_{t=j+1}^{i}p_t
+
200\max(0,time(j+1,i)-480).
$$

---

## 4.3. DP

Đặt:

$$
DP[d][i]
$$

là score tốt nhất để phục vụ:

$$
v_1,\ldots,v_i
$$

trong \(d\) ngày.

Transition:

$$
DP[d][i]
=
\max_{j<i}
\left[
DP[d-1][j]+profit(j+1,i)
\right]
$$

với:

$$
time(j+1,i)\le720.
$$

Complexity:

$$
O(Dk^2).
$$

Với:

$$
D=30,\qquad k\le399,
$$

chỉ khoảng vài triệu transition.

**Đối với constraint 100 ms, đây là một thứ rất đáng làm.**

---

# 5. Hệ quả cực lớn

Thay vì để ALNS phải đồng thời tìm:

```text
house selection
+
order
+
day assignment
```

ta có:

```text
ALNS / ILS / LK
       ↓
    sequence
       ↓
  Exact DP partition
       ↓
    exact best
 day segmentation
```

Tức là:

$$
\boxed{
Metaheuristic\ tìm\ permutation
+
DP\ tối\ ưu\ partition.
}
$$

Đây chính là một **matheuristic nhẹ**.

Không cần Gurobi.

Không cần CP-SAT.

Không cần MIP.

---

# 6. Một nuance về overtime

Đây là chỗ cần đặc biệt chú ý.

Nếu:

$$
T_d<480
$$

thì:

$$
overtime=0.
$$

Nếu:

$$
480<T_d\le720
$$

thì:

$$
overtime=200(T_d-480).
$$

Vì overtime là **bonus dương**, nên một ngày dùng 600 phút có:

$$
200(600-480)=24000
$$

bonus.

Do đó:

> Không nên xem 480 như một hard limit.

Hard limit là:

$$
\boxed{720}
$$

còn 480 chỉ là một **breakpoint trong objective**.

---

# 7. Phân tích reward/time của từng loại house

Ta có:

| \(m\) | Service | Base reward | Reward/min service |
| ----: | ------: | ----------: | -----------------: |
|     1 |      60 |         80k |              1,333 |
|     2 |      90 |        140k |              1,556 |
|     3 |     120 |        180k |              1,500 |
|     4 |     150 |        240k |          **1,600** |
|     5 |     180 |        250k |              1,389 |
|     6 |     210 |        300k |              1,429 |

Nếu **chỉ** xét reward / cleaning-time:

$$
m=4
$$

là tốt nhất.

Điều này lập tức cho ta một cảnh báo:

> Greedy theo `gPrice[m]` sẽ thiên quá mạnh về \(m=6\), nhưng đó không nhất thiết là chiến lược tốt nhất.

Ngược lại:

> Greedy theo `price/service_time` cũng chưa đủ, vì **travel time** mới là phần phụ thuộc vị trí.

---

# 8. Chỉ số quan trọng hơn: marginal value

Với house \(i\):

$$
value_i = p_i.
$$

Nhưng khi đặt nó vào route, ta cần xét:

$$
\Delta t_i
=
service_i + \Delta travel_i.
$$

Do đó:

$$
density_i=
\frac{p_i}{\Delta t_i}.
$$

Đây mới là chỉ số nên dùng.

Ví dụ:

```text
House A
reward = 240k
service = 150
extra travel = 10
```

thì:

$$
density_A=
\frac{240000}{160}=1500.
$$

House B:

```text
reward = 180k
service = 120
extra travel = 5
```

thì:

$$
density_B=
\frac{180000}{125}=1440.
$$

→ A tốt hơn mặc dù B có travel thấp hơn.

---

# 9. Nhưng density đơn giản vẫn chưa đủ

Giả sử:

```text
A:
240k
+ 150 min
+ 10 travel

B:
250k
+ 180 min
+ 70 travel
```

A rõ ràng tốt.

Nhưng có trường hợp:

```text
A: 240k / 150 min
B: 140k / 90 min
```

Nếu B nằm ngay giữa hai house đang có:

```text
X → B → Y
```

thì:

$$
\Delta travel_B
$$

có thể gần bằng 0 hoặc âm so với đường hiện tại.

B có thể rất đáng chọn.

Do đó chỉ số phải là:

$$
\boxed{
\frac{\text{reward + overtime marginal gain}}
{\text{service + insertion travel}}
}
$$

---

# 10. Solution 0 — Baseline: Greedy Density

Đầu tiên phải có một baseline thật nhanh.

## Algorithm

Khởi đầu:

$$
S=\emptyset.
$$

Lặp:

1. xét house chưa chọn;
2. thử chèn ở vị trí tốt nhất;
3. tính:

$$
\Delta Score;
$$

4. chọn candidate tốt nhất.

Score của insertion:

$$
\boxed{
\Delta Score
=
p_i
+
\Delta overtime
}
$$

trừ ảnh hưởng travel/time.

---

# 11. Best insertion

Nếu route hiện tại có:

```text
A → B
```

ta thử:

```text
A → i → B
```

thay vì:

```text
A → B
```

extra travel:

$$
\Delta d
=
d(A,i)+d(i,B)-d(A,B).
$$

Extra time:

$$
\Delta t
=
s_i+\Delta d.
$$

Insertion score:

$$
\boxed{
I(i;A,B)
=
p_i+
\Delta Overtime
}
$$

với điều kiện:

$$
T+\Delta t\le720.
$$

---

# 12. Nhưng route đầu tiên chưa có cạnh A-B

Nếu append:

```text
A → i
```

thì:

$$
\Delta d=d(A,i).
$$

Nếu day mới:

$$
start\rightarrow i
$$

thì dùng khoảng cách từ vị trí hiện tại.

---

# 13. Baseline nên có 3 cách greedy

Không chỉ một.

### G1 — Highest Profit

$$
score_i=p_i.
$$

### G2 — Profit / Service Time

$$
score_i=\frac{p_i}{s_i}.
$$

### G3 — Profit / Marginal Time

$$
score_i=
\frac{p_i}{s_i+\Delta d}.
$$

Sau đó:

$$
\boxed{
Best(G1,G2,G3)
}
$$

làm baseline.

---

# 14. Solution 1 — Greedy + Cheapest Insertion + 2-opt/Relocate

Đây là solution đầu tiên tôi kỳ vọng khá tốt.

Pipeline:

```text
Greedy construction
       ↓
Cheapest insertion
       ↓
2-opt
       ↓
Relocate
       ↓
Swap
       ↓
DP day partition
```

Đây là một **profit-aware Local Search**.

---

# 15. Vì sao không chỉ 2-opt?

2-opt chỉ thay thứ tự:

```text
A-B-C-D
```

thành:

```text
A-C-B-D
```

nhưng không thêm/bớt house.

Trong bài toán này:

> selection quan trọng gần bằng routing.

Do đó neighborhood cần:

$$
\boxed{
Add + Remove + Relocate + Swap + 2opt
}
$$

---

# 16. Remove move

Cho phép:

$$
S\rightarrow S\setminus\{i\}.
$$

Điều này có vẻ nghịch lý:

> remove làm score giảm.

Nhưng sau đó có thể:

$$
remove(i)
\rightarrow
insert(j)
\rightarrow
improve.
$$

Đây là cách thoát khỏi local optimum.

---

# 17. Replace

Một move mạnh:

$$
\boxed{
Remove(i)+Insert(j)
}
$$

Ví dụ:

```text
A B C D E
```

remove B:

```text
A C D E
```

insert F:

```text
A C F D E
```

Đây thường mạnh hơn pure 1-insertion.

---

# 18. Solution 2 — GRASP

Từ Chương 9.

Thay vì luôn chọn candidate tốt nhất:

```text
best candidate
```

chọn từ Restricted Candidate List:

$$
RCL
$$

gồm các ứng viên có score gần best.

Ví dụ:

```text
Top candidates:
A = 1800
B = 1770
C = 1750
D = 1600
```

với threshold:

$$
\alpha=0.9
$$

giữ:

```text
A B C
```

rồi random một candidate.

---

# 19. GRASP architecture

```text
GRASP
 │
 ├── randomized greedy construction
 │
 └── local search
```

Lặp nhiều lần:

$$
S_1,S_2,\dots,S_R
$$

và giữ:

$$
S_{best}.
$$

Điểm mạnh:

> tạo nhiều cấu trúc route khác nhau rất rẻ.

GRASP đặc biệt thích hợp cho bài này vì những greedily-built solutions có thể rất phụ thuộc vào bước chọn đầu tiên.

---

# 20. Solution 3 — ILS / VNS

Tiếp theo là:

$$
\boxed{ILS}
$$

Pipeline:

```text
Initial solution
      ↓
Local Search
      ↓
local optimum
      ↓
Perturbation
      ↓
Local Search
      ↓
Acceptance
      ↓
repeat
```

---

# 21. Perturbation nên làm gì trong bài này?

Không nên random toàn bộ route.

Một perturbation tốt có thể:

### P1

Remove 5–10 houses.

### P2

Remove một spatial cluster.

### P3

Remove những house có density thấp.

### P4

Remove một đoạn route.

### P5

Remove các house quanh một bottleneck.

Sau đó reinsert.

Đây chính là bridge sang LNS.

---

# 22. VNS phiên bản bài này

Ta có:

$$
N_1=\text{Relocate}
$$

$$
N_2=\text{Swap}
$$

$$
N_3=\text{2-opt}
$$

$$
N_4=\text{Remove+Insert}
$$

$$
N_5=\text{3-opt}
$$

$$
N_6=\text{Large Destroy+Repair}.
$$

Nếu:

$$
N_k
$$

không cải thiện:

$$
k\leftarrow k+1.
$$

Nếu cải thiện:

$$
k\leftarrow1.
$$

---

# 23. Solution 4 — Profit-aware LKH

Đây là phương án tôi đặc biệt khuyến nghị.

LKH không nên chạy trên tất cả house.

Thay vào đó:

```text
Selection
    ↓
selected houses
    ↓
LKH-style routing
```

Tức là:

$$
\boxed{
Selection\ layer
+
LK/LKH\ route\ optimizer
}
$$

---

# 24. Candidate edge của bài này

Vì thành phố chỉ:

$$
100\times100
$$

và distance là Manhattan:

$$
d(i,j)=|x_i-x_j|+|y_i-y_j|,
$$

ta có thể giữ:

$$
K=8,12,16,24
$$

nearest spatial candidates.

Không nhất thiết cần triển khai đầy đủ α-nearness.

Lý do:

* chỉ 200–399 nodes;
* time limit 100ms;
* Manhattan geometry;
* candidate generation rất cheap.

---

# 25. Nhưng có thể dùng α-nearness nếu muốn nghiên cứu sâu

Ta có thể:

1. build minimum 1-tree;
2. compute penalties;
3. generate alpha candidates;
4. LK search.

Đây là phiên bản:

$$
\boxed{
LKH\text{-}style.
}
$$

Tuy nhiên tôi **không xếp nó là lựa chọn đầu tiên** cho challenge này.

Ở \(n\approx300\), chi phí implementation phức tạp của full Held–Karp ascent chưa chắc đáng bằng việc đầu tư search operators phù hợp objective.

---

# 26. Vì bài này không phải TSP

Đây là nguyên nhân.

LKH cực mạnh khi:

$$
\text{all customers are already selected}.
$$

Nhưng bài này:

$$
\text{selection}
$$

là một phần quan trọng.

Nếu ta đưa toàn bộ 300 house vào LKH:

```text
LKH finds beautiful 300-house tour
```

nhưng:

$$
time>30\times720
$$

hoặc daily constraints không phù hợp.

Ta đã giải sai problem.

---

# 27. Vì vậy LKH chỉ nên làm "route optimizer"

Kiến trúc:

```text
Global selection
       ↓
Selected set
       ↓
LKH / LK
       ↓
Good ordering
       ↓
DP segmentation
```

chứ không:

```text
All houses
 ↓
LKH
```

---

# 28. Solution 5 — LNS

Bây giờ đến đúng Chương 13.

Current solution:

```text
Day 1: A B C D
Day 2: E F G H
...
```

Destroy:

```text
remove 20 houses
```

Repair:

```text
reinsert best positions
```

rồi:

```text
2-opt / relocate
```

---

# 29. Destroy operators đề xuất

Ta có thể xây:

$$
D_1=\text{Random Removal}
$$

$$
D_2=\text{Worst Removal}
$$

$$
D_3=\text{Spatial Removal}
$$

$$
D_4=\text{Low Profit Removal}
$$

$$
D_5=\text{High Travel Removal}
$$

$$
D_6=\text{Route Segment Removal}
$$

$$
D_7=\text{Day Removal}.
$$

Nhưng `Day Removal` chỉ hợp lý nếu representation rõ ràng theo day.

---

# 30. Worst removal

Đối với house \(i\), định nghĩa:

$$
loss_i
=
Score(S)-Score(S\setminus i).
$$

House có:

$$
loss_i
$$

nhỏ nghĩa là bỏ nó gần như không mất nhiều.

Ta ưu tiên remove:

$$
\boxed{
\text{small loss}
}
$$

để tạo không gian cho những house khác.

Đây tốt hơn "remove lowest price" vì một house reward thấp có thể nằm ở vị trí cực kỳ tốt.

---

# 31. Spatial removal

Chọn một seed house \(i\).

Xóa các house gần nó:

$$
d(i,j)<R.
$$

Ví dụ:

```text
● ● ●
 ● ●
  ●
```

thay vì:

```text
●       ●
    ●
          ●
```

Đây là operator rất phù hợp với grid Manhattan.

Literature về ALNS cho Orienteering cũng đã sử dụng clustering để xây destroy/repair neighborhoods theo nhóm node gần nhau. ([ScienceDirect][1])

---

# 32. High-travel removal

Đối với route:

```text
A → B → C
```

nếu:

$$
d(A,B)
$$

rất lớn thì B có thể gây "wasted travel".

Define:

$$
waste(B)
=
d(A,B)+d(B,C)-d(A,C).
$$

Đây chính là marginal travel cost của B.

Remove những node có:

$$
\frac{p_B}{service_B+waste(B)}
$$

thấp.

---

# 33. Repair operators

Ta có:

$$
R_1=\text{Greedy insertion}
$$

$$
R_2=\text{Regret-2}
$$

$$
R_3=\text{Regret-3}
$$

$$
R_4=\text{Profit-density insertion}
$$

$$
R_5=\text{Beam repair}.
$$

---

# 34. Regret insertion rất hợp bài này

Với house \(i\), giả sử best insertion score:

$$
v_1(i)
$$

và second-best:

$$
v_2(i).
$$

Regret:

$$
r_2(i)=v_1(i)-v_2(i).
$$

House có regret lớn:

> nếu không chèn nó ngay vào vị trí tốt nhất, ta có thể mất rất nhiều.

Do đó:

$$
\boxed{
insert\ high\ regret\ first.
}
$$

---

# 35. ALNS — ứng viên mạnh nhất

Từ Chương 14:

```text
              ALNS
                │
       ┌────────┴────────┐
       │                 │
   Destroy pool      Repair pool
       │                 │
   D1 D2 D3 ...      R1 R2 R3 ...
       │                 │
       └────────┬────────┘
                ▼
               VND
                │
                ▼
           DP partition
                │
                ▼
            acceptance
                │
                ▼
           update weights
```

Đây là architecture mà tôi đánh giá **có tiềm năng điểm cao nhất** trong nhóm heuristic thuần túy.

ALNS literature cho thấy đúng triết lý này: nhiều competing subheuristics được chọn dựa trên historical performance; Ropke & Pisinger báo cáo cải thiện best-known solutions trên hơn một nửa benchmark P&DPTW, còn ALNS cho Orienteering đã cho kết quả rất mạnh trên cả budget tính toán ngắn. ([PubsOnline][3])

---

# 36. Nhưng tôi sẽ sửa ALNS chuẩn thành "Objective-Aware ALNS"

ALNS chuẩn thưởng operator nếu:

```text
best
improvement
accepted
```

Ở bài này ta nên reward operator theo:

$$
\Delta Score
$$

và thêm:

$$
\Delta \text{selected houses}
$$

hay:

$$
\Delta \text{travel efficiency}.
$$

Ví dụ:

$$
reward=
\begin{cases}
50 & global\ best\\
15 & current\ improvement\\
5 & accepted\\
0 & otherwise.
\end{cases}
$$

Sau đó:

$$
w_i\leftarrow(1-\rho)w_i+\rho\bar s_i.
$$

---

# 37. Solution 6 — ALNS + LK/LKH + Exact DP

Đây là **ứng viên số 1** của tôi.

Pipeline:

```text
                 Initial population
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
       Greedy        GRASP       Random
          │            │            │
          └────────────┼────────────┘
                       ▼
                    ALNS
                       │
                 Destroy operator
                       │
                       ▼
                Repair operator
                       │
                       ▼
                 LK / 2-opt / 3-opt
                       │
                       ▼
              Exact day-partition DP
                       │
                       ▼
                  Acceptance
                       │
                       ▼
                 Update weights
                       │
                       └── repeat
```

Đây là:

$$
\boxed{
ALNS + LKH\text{-style local search} + DP
}
$$

và tôi đánh giá nó là **sweet spot** giữa chất lượng và 100 ms.

---

# 38. Vì sao tôi thích architecture này?

Mỗi component giải đúng một nhiệm vụ.

### ALNS

Tìm:

> "Nên thay đổi vùng nào của solution?"

### Repair

Tìm:

> "Nên đưa house nào vào?"

### LK/2-opt

Tìm:

> "Thứ tự route nên như thế nào?"

### DP

Tìm:

> "Nên chia sequence thành các ngày thế nào?"

### Acceptance

Tìm:

> "Có nên tiếp tục từ solution mới không?"

Rất sạch.

---

# 39. Solution 7 — ALNS + MIP

Về mặt nghiên cứu, սա có thể mạnh hơn nữa:

```text
ALNS
 ↓
Destroy 10–30 houses
 ↓
MIP exact repair
 ↓
VND
 ↓
DP
```

Đây đúng là một matheuristic.

Nhưng với:

$$
100ms/test
$$

tôi **không đặt cược version này là solution production đầu tiên**.

---

# 40. Vì sao?

MIP có overhead:

* xây model;
* copy variable state;
* presolve;
* LP relaxation;
* branch;
* extract solution.

Nếu phải gọi:

$$
1000\text{ cases}
$$

thì overhead có thể lớn.

Một paper về ILS cho TSP với release dates thậm chí báo cáo rằng việc dùng MILP models làm repair operator **không mang lại lợi ích** trong bài toán của họ. Đây là một minh họa rất tốt rằng "MIP repair" không mặc nhiên tốt hơn heuristic repair. ([ScienceDirect][4])

---

# 41. Tuy vậy MIP repair có một vai trò rất đáng thử

Ta có thể gọi MIP **chỉ ở cuối**:

```text
ALNS 80 ms
   ↓
best solution
   ↓
MIP neighborhood polish 20 ms
```

Nếu MIP tìm được improvement:

$$
S_{ALNS}\rightarrow S_{MIP}.
$$

Đây là một phương án benchmark rất đáng thử.

---

# 42. Solution 8 — Beam Search

Beam Search phù hợp nhất cho **construction**.

Ví dụ:

```text
Beam width B = 10

Start
 ├── A
 ├── B
 ├── C
 └── D
```

Mỗi bước mở rộng:

```text
A → candidates
B → candidates
C → candidates
D → candidates
```

giữ lại top \(B\).

---

# 43. Score của Beam State

Không nên dùng chỉ:

$$
currentScore.
$$

Nên:

$$
F(S)
=
Score(S)
+
EstimateRemainingPotential(S).
$$

Ví dụ:

$$
EstimateRemainingPotential
=
\text{top-k remaining profit density}.
$$

Beam sẽ ưu tiên những partial route có tiềm năng.

---

# 44. Beam Search rất hữu ích để tạo initial solutions

Thay vì:

```text
1 greedy solution
```

ta có:

```text
10 high-quality diverse initial solutions.
```

Rồi:

$$
\text{best}
\rightarrow
ALNS/LKH.
$$

Do đó:

$$
\boxed{
Beam \rightarrow ALNS
}
$$

là hybrid đáng thử.

---

# 45. Solution 9 — Multi-Start Profit-aware LKH

Một baseline mạnh khác:

```text
repeat R times:

    randomized profit construction
         ↓
    insertion
         ↓
    LKH
         ↓
    DP day partition
         ↓
    keep best
```

Nó đơn giản hơn ALNS nhưng có thể rất hiệu quả dưới deadline nhỏ.

---

# 46. Vì sao Multi-Start quan trọng?

Một greedy construction có thể mắc:

```text
A B C D
```

Trong khi chỉ thay:

```text
A B D C
```

đã thay đổi khả năng insert house tiếp theo.

Một run duy nhất rất dễ bias.

Multi-start giải quyết bằng:

$$
S_1,S_2,\ldots,S_R.
$$

---

# 47. Randomization nên có kiểm soát

Không nên:

```cpp
shuffle(allHouses);
```

rồi build route.

Nên randomized key:

$$
key_i=
density_i+\epsilon
$$

với:

$$
\epsilon\sim[-\delta,\delta].
$$

Hoặc RCL của GRASP.

Như vậy vẫn giữ heuristic quality.

---

# 48. Một heuristic rất đáng thử: Cluster-first

Do city chỉ:

$$
100\times100,
$$

ta có thể chia grid:

```text
10 × 10 cells
```

mỗi cell:

$$
10\times10.
$$

Sau đó:

```text
select promising cells
       ↓
visit clusters
       ↓
optimize houses within cluster
```

Có thể xem:

$$
cluster\rightarrow route\rightarrow local\ optimize.
$$

---

# 49. Cluster score

Với cluster \(C\):

$$
P(C)=\sum_{i\in C}p_i.
$$

$$
T(C)\approx
\text{internal travel}
+
\text{service}.
$$

Define:

$$
density(C)=\frac{P(C)}{T(C)}.
$$

Ưu tiên cluster có density cao.

Sau đó chạy LKH/local search trong từng cluster.

---

# 50. Nhưng cluster-first có nhược điểm

Một route tốt có thể đi xuyên cluster:

```text
Cluster A → B → A → C
```

Nếu ép:

```text
A → A → B → B → C → C
```

có thể mất solution.

Do đó cluster nên là:

$$
\boxed{
heuristic\ guidance
}
$$

không phải constraint cứng.

---

# 51. Một heuristic khác: Sweep

Vì tọa độ 2D, có thể:

1. chọn tâm;
2. tính angle:

$$
\theta_i=\operatorname{atan2}(y_i-y_0,x_i-x_0);
$$

3. sort theo angle;
4. tạo route theo sweep;
5. optimize.

Nhưng city grid + Manhattan không ưu tiên Euclidean angle mạnh như VRP Euclidean.

Tôi xếp nó dưới nearest-neighbor / spatial insertion.

---

# 52. Một insight quan trọng về Manhattan geometry

Khoảng cách:

$$
d((x_1,y_1),(x_2,y_2))
=
|x_1-x_2|+|y_1-y_2|.
$$

Có tính:

$$
d(a,c)\le d(a,b)+d(b,c).
$$

Do đó:

$$
2opt
$$

vẫn rất hữu ích.

Ta có thể tính delta:

$$
\Delta
=
-d(a,b)-d(c,d)
+d(a,c)+d(b,d).
$$

Không cần recompute toàn route.

---

# 53. Đây là chìa khóa để đạt 100 ms

Không được mỗi lần move:

```cpp
simulateWholeRoute();
```

với:

$$
O(n).
$$

Thay vào đó dùng:

$$
\boxed{
O(1)\ delta\ evaluation
}
$$

cho:

* 2-opt;
* swap;
* relocate;
* insertion;
* removal.

Sau một số move mới rebuild/evaluate toàn route.

---

# 54. Precompute tất cả Manhattan distances

Với:

$$
n\le399
$$

tạo:

$$
dist[n][n].
$$

Cost:

$$
O(n^2)
$$

≈ 160k entries.

Rất nhỏ.

Sau đó:

$$
dist(i,j)
$$

là:

$$
O(1).
$$

Đây là optimization **bắt buộc**.

---

# 55. Profit cũng nên preprocess

Mỗi house:

```cpp
struct House {
    int x, y;
    int m;
    int service;
    int profit;
};
```

Trong đó:

$$
service=30m+30.
$$

Không tính đi tính lại.

---

# 56. Một điểm tinh tế: overtime khiến delta score phụ thuộc vào ngày

Nếu một insertion tăng:

$$
T_d:470\rightarrow500
$$

thì overtime tăng:

$$
0\rightarrow4000.
$$

Marginal value:

$$
4000
$$

cho 30 phút đầu vượt ngưỡng?

Chính xác:

$$
200(500-480)=4000.
$$

Nếu:

$$
T_d:500\rightarrow530,
$$

thì:

$$
\Delta O=6000.
$$

Vậy marginal overtime:

$$
\frac{dO}{dT}
=
\begin{cases}
0,&T\le480\\
200,&T>480.
\end{cases}
$$

Có một discontinuity về marginal reward tại 480.

---

# 57. Điều này làm greedy "profit/time" hơi sai

Một candidate có:

$$
p=80k,\quad \Delta t=60
$$

có thể rất đáng ở một ngày:

$$
T=450
$$

bởi nó đưa ngày lên:

$$
510
$$

và nhận thêm:

$$
6000
$$

overtime.

Do đó insertion score phải tính **actual objective**, không chỉ base reward density.

---

# 58. Một trick: đừng tối ưu overtime riêng

Không cần heuristic riêng cho overtime.

Chỉ cần mọi candidate evaluation gọi:

$$
Score(day\ after\ move)-Score(day\ before\ move).
$$

Tức:

$$
\boxed{
objective\ delta
}
$$

đã tự xử lý breakpoint 480.

---

# 59. Day Partition DP giúp việc này cực sạch

Với sequence:

$$
S
$$

DP sẽ tự quyết định:

```text
Day 1
Day 2
...
```

sao cho tổng:

$$
base\ reward + overtime
$$

lớn nhất.

Do đó heuristic không cần tự "đoán" ngày nào nên overtime.

Đây là lý do tôi đánh giá subroutine này cực kỳ quan trọng.

---

# 60. Solution 10 — Sequence-based Matheuristic

Đây có thể là **kiến trúc nghiên cứu đẹp nhất**.

Thay vì representation:

```text
Day 1 route
Day 2 route
...
```

ta representation:

$$
\boxed{
S=(v_1,v_2,\ldots,v_k)
}
$$

chỉ là một sequence.

Sau đó:

$$
PartitionDP(S)
$$

tự tìm day split tối ưu.

Pipeline:

```text
sequence
   ↓
objective-aware moves
   ↓
sequence'
   ↓
DP segmentation
   ↓
exact best day partition
   ↓
score
```

Đây là một form **matheuristic rất nhẹ**.

---

# 61. Đây là cải tiến lớn so với representation theo ngày

Nếu representation trực tiếp:

```text
day[0]
day[1]
...
day[29]
```

mỗi move phải lo:

* route;
* day capacity;
* overtime;
* cross-day relocation.

Rất phức tạp.

Sequence-based:

```text
one permutation
```

và DP xử lý:

$$
30\text{ days}.
$$

Search space được đơn giản hóa rất nhiều.

---

# 62. Nhưng selection vẫn là vấn đề

Sequence của ta không cần chứa tất cả house.

Có thể:

$$
k\le n.
$$

Ta cần moves:

$$
insert,\ remove,\ relocate,\ swap.
$$

Do đó state:

$$
S\subseteq V
$$

và:

$$
order(S).
$$

---

# 63. Sequence Local Search

Ta có:

### Add

$$
S\rightarrow S+i
$$

### Remove

$$
S\rightarrow S-i
$$

### Relocate

```text
A B C D
↓
A C D B
```

### Swap

```text
A B C D
↓
A D C B
```

### 2-opt

```text
A B C D E
↓
A D C B E
```

---

# 64. Một move đặc biệt mạnh: 1-1 exchange

$$
\boxed{
remove(i)+insert(j)
}
$$

Đây thường là neighborhood rất tốt cho prize-collecting problems.

Bởi:

> house hiện tại tốt về route nhưng kém về reward có thể được thay bằng house khác.

---

# 65. Một move còn mạnh hơn: \(q\)-exchange

$$
q\text{-out}
+
q\text{-in}.
$$

Ví dụ:

$$
2\text{-out}/2\text{-in}.
$$

Không cần enumerate toàn bộ.

LNS có thể thực hiện:

```text
remove 10
repair 10
```

để approximate large exchange.

---

# 66. Tôi sẽ dùng destroy size adaptive

Ban đầu:

$$
q\in[5,15].
$$

Nếu stagnation:

$$
q\in[15,40].
$$

Nếu đang tiến bộ tốt:

$$
q\in[3,10].
$$

Do đó:

$$
\boxed{
destruction\ size = search\ temperature
}
$$

theo nghĩa exploration/exploitation.

---

# 67. ALNS destroy scoring

Một operator nên nhận reward nếu nó:

1. tạo global best;
2. cải thiện current;
3. tạo feasible candidate tốt;
4. giúp thoát stagnation.

Ví dụ:

$$
\sigma_1=50,
\quad
\sigma_2=15,
\quad
\sigma_3=5.
$$

Weights được update theo segment.

---

# 68. Tôi sẽ adaptive cả repair

Ví dụ:

```text
R1 Greedy
R2 Regret-2
R3 Regret-3
R4 Cluster-aware
R5 Randomized
```

Khi gần local optimum:

$$
R3
$$

có thể tốt.

Khi cần exploration:

$$
R5
$$

có thể tốt.

---

# 69. LKH-style route polishing

Sau mỗi ALNS repair, không nhất thiết chạy full LK.

Có thể:

```text
2-opt until no improvement
```

sau đó chỉ khi candidate tốt:

```text
LK intensive search
```

Điều này tiết kiệm thời gian.

---

# 70. Triggered LKH

Ví dụ:

```text
if newScore > bestScore * 0.995:
    run LK
else:
    only 2-opt
```

Hoặc:

```text
every 20 ALNS iterations:
    run intensive LK
```

Đây là cách quản lý time budget tốt hơn.

---

# 71. ILS cũng có thể dùng LKH

```text
LKH(S)
 ↓
local optimum
 ↓
kick 5–15 edges
 ↓
LKH(S')
```

Nếu muốn một solution đơn giản hơn ALNS:

$$
\boxed{
Iterated\ LKH
}
$$

đây là một candidate rất đáng benchmark.

---

# 72. Candidate solution portfolio

Tôi sẽ xây ít nhất 6 solver:

| Solver | Ý tưởng                 |
| ------ | ----------------------- |
| S0     | Greedy                  |
| S1     | Greedy + Local Search   |
| S2     | GRASP + LS              |
| S3     | ILS/VNS                 |
| S4     | LKH-style + Multi-start |
| S5     | ALNS + LK + DP          |
| S6     | ALNS + MIP polish       |

Sau đó benchmark.

---

# 73. Dự đoán xếp hạng

Nếu implementation đều tốt, tôi dự đoán:

$$
\boxed{
S5 > S4 > S3 > S2 > S1 > S0
}
$$

về điểm trung bình.

Nhưng đây là **hypothesis**, không phải kết quả benchmark.

S6:

$$
ALNS+MIP
$$

có thể:

$$
S6>S5
$$

trên instance khó, nhưng cũng có thể:

$$
S6<S5
$$

dưới 100 ms vì overhead MIP.

Do đó S6 là experimental branch.

---

# 74. Một portfolio còn hay hơn

Thay vì một algorithm:

```text
100 ms
```

ta có:

```text
20 ms Greedy/GRASP
30 ms LKH
45 ms ALNS
5 ms final polish
```

Nhưng có thể adaptive:

```text
Easy instance
→ Greedy + LKH

Hard/stagnant instance
→ ALNS

Nearly optimal-looking
→ intensive LK
```

Đây là:

$$
\boxed{
algorithm portfolio
}
$$

---

# 75. Instance classification

Ta có thể tính nhanh một vài statistic:

$$
n
$$

số house.

$$
\bar m
$$

average AC count.

$$
\bar p
$$

average reward.

$$
density
$$

spatial density.

$$
cluster\ strength.
$$

Sau đó chọn algorithm.

---

# 76. Ví dụ

Nếu:

$$
n=210
$$

và house khá thưa:

```text
random spread
```

→ travel dominates.

Dùng:

$$
LKH+\text{cluster-aware selection}.
$$

Nếu:

$$
n=390
$$

và rất nhiều house:

```text
dense clusters
```

→ selection dominates.

Dùng:

$$
ALNS.
$$

Nếu:

$$
m_i
$$

phân hóa mạnh:

```text
1 AC
6 AC
...
```

→ profit-aware selection rất quan trọng.

---

# 77. Một heuristic cực đơn giản nhưng có thể mạnh: Profit Cluster

Tính:

$$
score(i)
=
p_i
+
\lambda \sum_{j\in NN_k(i)}p_j
$$

để ưu tiên house nằm trong cụm profit cao.

Tại sao?

House có profit 180k nhưng quanh nó có:

```text
240k
250k
300k
```

có thể đáng hơn isolated house 300k.

Nó là một dạng **look-ahead heuristic**.

---

# 78. Đây là một heuristic nên thử trong bài này

Gọi:

$$
clusterValue(i)
=
p_i+\lambda\cdot NeighborProfit(i).
$$

Sau đó:

$$
constructionScore_i
=
\frac{clusterValue(i)}
{service_i+\text{expected travel}}.
$$

Có thể dùng trong initial construction hoặc ALNS repair.

---

# 79. Spatial insertion

Thay vì candidate:

$$
i
$$

được đánh giá độc lập, ta chọn:

> house có lợi nhuận cao và nằm gần route hiện tại.

Insertion cost:

$$
\Delta d=
d(a,i)+d(i,b)-d(a,b).
$$

Score:

$$
\boxed{
\frac{p_i}
{s_i+\Delta d}
}
$$

là baseline rất tốt.

---

# 80. "Regret" nên tính theo objective thật

Không nên:

$$
r(i)=d_2-d_1
$$

chỉ theo distance.

Nên:

$$
r(i)
=
\Delta Score_{best}(i)
-
\Delta Score_{second}(i).
$$

Hoặc với minimization cost equivalent:

$$
r(i)
=
cost_2(i)-cost_1(i).
$$

Ở đây objective phải bao gồm:

* reward;
* travel;
* overtime;
* day capacity.

---

# 81. Một local move có thể ảnh hưởng segmentation

Đây là nơi DP giúp chúng ta.

Sau mỗi candidate sequence:

```text
modify sequence
      ↓
DP segmentation
      ↓
exact score
```

Không cần cố đoán day assignment bằng local heuristic.

---

# 82. Đây chính là "embedded exact algorithm"

Ta có:

```text
Outer heuristic:
ALNS / ILS / LKH

Inner exact:
DP day partition
```

Do đó:

$$
\boxed{
Heuristic\ outer
+
Exact\ inner
}
$$

Đây là **matheuristic rất nhẹ**, và tôi ưu tiên nó hơn MIP trong challenge 100 ms.

---

# 83. Tại sao DP này tốt hơn MIP repair?

Vì subproblem day partition có cấu trúc rất đơn giản.

Ta không cần:

$$
MILP.
$$

DP:

$$
O(Dn^2)
$$

là đủ.

Đây là một nguyên tắc rất quan trọng:

> **Exact optimization chỉ nên dùng công cụ phức tạp khi cấu trúc không có công cụ đơn giản hơn.**

---

# 84. Một hybrid hoàn chỉnh mà tôi đề xuất

## Phase 1 — Preprocess

```text
read houses
compute:
    service[i]
    profit[i]
distance matrix
nearest candidates
```

---

## Phase 2 — Build seeds

Tạo khoảng:

$$
K=5\text{–}20
$$

initial solutions:

```text
Greedy profit
Greedy density
Greedy spatial
GRASP #1
GRASP #2
...
```

---

## Phase 3 — Initial local optimization

Với mỗi seed:

```text
insert
remove
relocate
swap
2-opt
```

---

## Phase 4 — DP partition

```text
sequence
 ↓
exact day partition
 ↓
score
```

---

## Phase 5 — ALNS

```text
destroy
repair
local search
DP
acceptance
weight update
```

---

## Phase 6 — Final intensification

Lấy:

$$
S_{best}
$$

và chạy:

```text
deep LK / 3-opt / relocation
```

---

# 85. Pseudocode tổng thể

```text
precompute distances

best = null

seeds = generateInitialSolutions()

for S in seeds:

    improve(S)
    partitionDP(S)

    best = max(best, S)

initialize ALNS weights

current = best

while time remains:

    D = adaptiveDestroy()
    R = adaptiveRepair()

    partial = D(current)

    candidate = R(partial)

    candidate = localSearch(candidate)

    partitionDP(candidate)

    if accept(candidate, current):
        current = candidate

    if score(candidate) > score(best):
        best = candidate

    reward(D)
    reward(R)

    periodically:
        updateWeights()

deepPolish(best)

return best
```

---

# 86. Một điểm tôi sẽ thay đổi so với ALNS textbook

Textbook ALNS thường representation theo routes:

```text
route 1
route 2
...
```

Ở bài này tôi nghiêng về:

$$
\boxed{
single\ global\ sequence
}
$$

và:

$$
\boxed{
DP\ partition.
}
$$

Đây là **customization theo cấu trúc problem**, không phải ALNS textbook nguyên bản.

---

# 87. Vì sao global sequence hợp lý?

Giả sử:

```text
A → B → C
```

và day boundary nằm giữa A/B.

Ngày 1 kết thúc ở A.

Ngày 2 bắt đầu tại A.

Đi đến B vẫn mất:

$$
d(A,B).
$$

Nếu boundary nằm sau B:

```text
Day 1: A B
Day 2: C
```

thì:

$$
d(A,B)
$$

được tính ngày 1.

Tổng travel vẫn:

$$
d(A,B)+d(B,C).
$$

Chỉ phân bố time khác nhau.

Đây là lý do sequence/partition decomposition có cơ sở.

---

# 88. Nếu nextDay đưa về depot thì sao?

Khi đó:

```text
Day 1: A B
Day 2: C
```

có thêm:

$$
d(B,depot)
$$

và:

$$
d(depot,C).
$$

Trong trường hợp ấy segmentation **không còn chỉ là breakpoint**; nó ảnh hưởng tổng travel.

Nhưng vẫn có thể dùng DP, chỉ cần:

$$
segmentCost(j+1,i)
$$

bao gồm:

* depot → first;
* internal travel;
* last → depot.

Tôi khuyến nghị kiểm tra semantics của `nextDay()` trong source judge trước khi code.

---

# 89. Đây là một distinction rất quan trọng

### Trường hợp A

```text
nextDay:
reset clock
keep position
```

→ sequence + partition DP cực đẹp.

### Trường hợp B

```text
nextDay:
reset clock
return depot
```

→ bài toán thực sự gần **multi-route orienteering**.

Khi đó representation:

```text
30 routes
```

sẽ tự nhiên hơn.

Cả hai architecture vẫn dùng được ALNS/LKH, nhưng move evaluator phải đổi.

---

# 90. Nếu là trường hợp B, ALNS sẽ destroy theo route

Ví dụ:

```text
Day 1
A B C D

Day 2
E F G
```

Destroy:

```text
remove E F
```

Repair vào:

```text
Day 1 / Day 2 / Day 3
```

và tính insertion:

$$
\Delta=
travel+
service+
day\ overtime.
$$

Đây chính là team-orienteering-like search, dù chỉ có một technician nhưng nhiều daily routes. Literature về Team Orienteering và augmented LNS cho thấy large-neighborhood plus insertion/replacement/shifting có thể cực mạnh trên các routing-with-profit benchmarks. ([ScienceDirect][5])

---

# 91. Với trường hợp B: dùng day-aware LKH

Mỗi ngày là:

$$
route_d.
$$

Có thể chạy:

$$
LKH(route_d)
$$

riêng từng ngày.

Sau đó có:

```text
cross-day relocate
cross-day swap
```

để đưa house từ ngày này sang ngày khác.

---

# 92. Một move quan trọng: Cross-day Relocate

```text
Day 1: A B C D
Day 2: E F G
```

move:

$$
D:
Day1\rightarrow Day2
$$

thành:

```text
Day1: A B C
Day2: E F D G
```

Cần tính:

* reward của D;
* service time;
* route delta Day1;
* route delta Day2;
* overtime changes của cả 2 ngày.

Đây là move rất mạnh.

---

# 93. Cross-day Swap

```text
Day1: A B C
Day2: D E F
```

đổi:

$$
B\leftrightarrow E.
$$

Có thể giải quyết tình huống:

> house B có reward cao nhưng nằm không tốt trong Day 1; E thì ngược lại.

---

# 94. Day rebalancing

Nếu:

```text
Day1 = 719 min
Day2 = 300 min
```

có thể move house từ Day1 sang Day2.

Nhưng cần nhớ overtime:

```text
719 → 650
300 → 369
```

có thể **làm mất overtime** của Day1.

Do đó move objective không đơn giản là:

$$
\Delta time.
$$

Phải tính:

$$
\Delta overtime.
$$

---

# 95. Một heuristic đặc biệt cho overtime

Giả sử:

$$
T_1=600,\quad T_2=300.
$$

Nếu chuyển một job:

$$
T_1'=500,\quad T_2'=400
$$

thì overtime:

trước:

$$
120\times200=24000.
$$

sau:

$$
20\times200=4000.
$$

Mất:

$$
20000.
$$

Dù tổng thời gian không đổi!

Do đó:

$$
\boxed{
overtime\ creates\ a\ non-linear\ incentive
}
$$

để **gom thời gian vào cùng một ngày** thay vì cân bằng đều.

Đây là điều mà nhiều generic VRP heuristics sẽ không tự nhiên xử lý tốt.

---

# 96. Consequence: đừng balance day loads một cách máy móc

Thông thường VRP heuristic thích:

```text
Day1 ≈ Day2 ≈ Day3
```

Nhưng bài này có overtime bonus.

Có thể tốt hơn:

```text
Day1 ≈ 700
Day2 ≈ 700
Day3 ≈ 700
```

thay vì:

```text
Day1 = 500
Day2 = 500
Day3 = 500
Day4 = 500
```

vì mỗi ngày vượt 480 được bonus.

Do đó objective chính xác phải dẫn dắt partition.

---

# 97. Một câu hỏi rất đáng nghiên cứu: có nên luôn dùng đủ 30 ngày?

Không nhất thiết.

Vì ngày mới reset overtime threshold.

Nếu:

$$
D=30
$$

nhưng tất cả house đã làm xong trước đó, không cần gọi thêm day.

Nếu mỗi ngày đều có đủ work để vượt 480:

> dùng nhiều ngày có thể tăng tổng score bằng cách làm thêm houses.

Do đó số ngày là decision variable.

---

# 98. Nhưng nếu overtime bonus quá thấp?

Base reward vẫn là động lực chính.

Ta có:

$$
200/min
$$

so với:

$$
\approx1300-1600/min
$$

service reward density.

Nên:

> không nên bỏ house tốt chỉ để chase overtime.

Overtime là **secondary objective signal**.

---

# 99. Một heuristic ranking mà tôi đề xuất

For candidate \(i\):

$$
\boxed{
R_i=
\frac{
p_i+
\Delta O_i
+
\lambda C_i
}{
s_i+\Delta d_i
}
}
$$

trong đó:

* \(p_i\): base profit;
* \(\Delta O_i\): marginal overtime;
* \(C_i\): cluster potential;
* \(\lambda\): small coefficient.

Cluster potential có thể:

$$
C_i=
\sum_{j\in NN_k(i)}p_j.
$$

---

# 100. Candidate evaluation nên gồm 4 thành phần

$$
\boxed{
Profit
+
Overtime
-
Travel
+
FuturePotential
}
$$

Đừng dùng:

$$
profit-only.
$$

Đừng dùng:

$$
distance-only.
$$

---

# 101. Look-ahead nhẹ

Sau khi thêm house \(i\), xem:

> "house \(j\) tốt nhất kế tiếp là gì?"

Define:

$$
lookahead(i)
=
\max_j
\frac{p_j}{service_j+d(i,j)}.
$$

Sau đó:

$$
score(i)
=
immediate(i)+\lambda lookahead(i).
$$

Chỉ cần look-ahead 1 bước, không cần search tree lớn.

---

# 102. Beam Search có thể dùng chính look-ahead này

Beam state:

$$
S.
$$

Evaluation:

$$
F(S)
=
Score(S)
+
\lambda\cdot Potential(S).
$$

Giữ:

$$
B=8\text{–}32
$$

states.

Với \(n\approx300\), beam width nhỏ vẫn đủ để tạo diverse seeds.

---

# 103. Một phương án rất đơn giản nhưng mạnh: Beam + ALNS

```text
Beam Search
    ↓
10 diverse promising sequences
    ↓
ALNS from each
    ↓
best
```

Không cần chạy Beam trong loop chính.

Beam chỉ dùng cho initialization.

Đây có thể đem lại diversity tốt hơn nhiều random restarts.

---

# 104. Một phương án khác: GRASP + LKH

```text
GRASP construction
       ↓
LKH
       ↓
DP
```

Lặp:

$$
20\text{–}100
$$

lần.

Ưu điểm:

* dễ implement;
* predictable;
* không có ALNS weight machinery.

Đây là ứng viên tuyệt vời cho baseline mạnh.

---

# 105. So sánh architecture

| Solution | Construction | Main search         | Exact component | Độ phức tạp code |
| -------- | ------------ | ------------------- | --------------- | ---------------- |
| S0       | Greedy       | —                   | DP              | thấp             |
| S1       | Greedy       | 2-opt/relocate      | DP              | thấp             |
| S2       | GRASP        | LS                  | DP              | vừa              |
| S3       | Randomized   | ILS/VNS             | DP              | vừa              |
| S4       | GRASP        | LK/LKH-style        | DP              | cao              |
| S5       | ALNS         | destroy/repair + LK | DP              | cao              |
| S6       | ALNS         | MIP repair + LS     | DP/MIP          | rất cao          |
| S7       | Beam         | ALNS + LK           | DP              | rất cao          |

---

# 106. Xếp hạng theo tốc độ

Tương đối:

$$
S0>S1>S2>S3>S4>S5>S6.
$$

S7 phụ thuộc beam width.

---

# 107. Xếp hạng theo khả năng đạt điểm

Dự đoán:

$$
S0<S1<S2\lesssim S3<S4<S5.
$$

S6 và S7:

$$
?
$$

phải benchmark.

Trong các bài toán prize-collecting routing, literature cho thấy ALNS/LNS/Iterated Greedy là những hướng rất đáng chú ý; đặc biệt IG và ALNS đã chứng minh khả năng đạt nghiệm rất mạnh trong các bài toán có cấu trúc chọn-khách-hàng + route + time limit. ([ScienceDirect][2])

---

# 108. Tôi sẽ benchmark theo 4 metric

Không chỉ:

$$
bestScore.
$$

Mà:

### Mean

$$
\bar S.
$$

### Worst-case

$$
S_{min}.
$$

### Best-case

$$
S_{max}.
$$

### Time

$$
t_{avg}.
$$

Quan trọng nhất:

$$
\boxed{
Score/ms
}
$$

vì constraint 100ms.

---

# 109. Với 1000 test cases, deterministic randomness là bắt buộc

Dùng:

$$
seed=f(testSeed,runId).
$$

Không dùng:

```cpp
srand(time(nullptr));
```

vì:

* khó reproduce;
* khó debug;
* benchmark không ổn định.

Ví dụ:

$$
rng.seed(seed\oplus(runId\cdot C)).
$$

---

# 110. Multi-start phải có ngân sách

Không được:

```text
1000 restarts
```

mà không biết time.

Tốt hơn:

```text
while clock < deadline:
    run one construction
```

Ví dụ:

```text
first 20%:
    generate seeds

next 70%:
    ALNS / LK

last 10%:
    intensive polish
```

---

# 111. Time management

Với:

$$
100ms
$$

tôi sẽ dùng:

```text
0–10 ms
preprocess + seeds

10–25 ms
initial LS

25–85 ms
ALNS / LK

85–98 ms
intensification

98–100 ms
final output
```

Không nên có một lần MIP call không kiểm soát thời gian.

---

# 112. "Anytime" behavior

Algorithm phải luôn giữ:

$$
S_{best}.
$$

Bất cứ lúc nào bị timeout:

```cpp
return best;
```

Điều này đặc biệt quan trọng trong judge.

---

# 113. Tôi sẽ tránh những gì?

## Không dùng DP toàn cục kiểu Held–Karp

Vì:

$$
n\approx300.
$$

Không khả thi.

---

## Không dùng full \(k\)-opt

Không cần.

---

## Không dùng full MIP mỗi iteration

100ms quá nguy hiểm.

---

## Không rebuild score O(n) cho mọi candidate

Dùng delta.

---

## Không dùng α-nearness đầy đủ ngay từ đầu

Chỉ triển khai nếu benchmark cho thấy candidate selection là bottleneck.

---

# 114. Tôi sẽ ưu tiên những gì?

$$
\boxed{
1. distance matrix
}
$$

$$
\boxed{
2. objective\ delta
}
$$

$$
\boxed{
3. insertion/removal/relocate/swap
}
$$

$$
\boxed{
4. 2-opt
}
$$

$$
\boxed{
5. exact day-partition DP
}
$$

$$
\boxed{
6. randomized multi-start
}
$$

$$
\boxed{
7. ALNS
}
$$

$$
\boxed{
8. LK-style intensive search
}
$$

Đây là thứ tự đầu tư effort tôi khuyến nghị.

---

# 115. Solution architecture tôi đánh giá cao nhất

Sau khi tổng hợp toàn bộ 16 chương, tôi sẽ đặt cược vào:

# **Adaptive Sequence Large Neighborhood Search + LK-style + Exact Partition DP**

Viết tắt tạm:

$$
\boxed{
ASLNS\text{-}LK\text{-}DP
}
$$

Không phải tên algorithm chuẩn trong literature; đây là tên kiến trúc cho implementation riêng của bài toán.

---

# 116. Architecture chi tiết

```text
                         INITIALIZATION
                              │
             ┌────────────────┼────────────────┐
             │                │                │
          Greedy           GRASP             Beam
             │                │                │
             └────────────────┼────────────────┘
                              ▼
                         Best sequence
                              │
                              ▼
                     Local improvement
                  ┌───────────┼───────────┐
                  │           │           │
               Insert      Relocate     2-opt
                  │           │           │
                  └───────────┼───────────┘
                              ▼
                       Partition DP
                              │
                              ▼
                           ALNS
                              │
                  ┌───────────┴───────────┐
                  │                       │
               Destroy                 Repair
                  │                       │
        random/worst/spatial       greedy/regret
        low-profit/segment        cluster/random
                  │                       │
                  └───────────┬───────────┘
                              ▼
                       LK-style search
                              │
                              ▼
                       Partition DP
                              │
                              ▼
                          Acceptance
                              │
                              ▼
                      Adaptive update
                              │
                              └──── repeat
```

---

# 117. Destroy pool tôi đề xuất

### D1 — Random

Diversification.

### D2 — Low marginal-value

Loại những house đang đóng góp ít:

$$
\frac{p_i}{\Delta t_i}.
$$

### D3 — High travel

Loại house gây:

$$
d(prev,i)+d(i,next)-d(prev,next)
$$

lớn.

### D4 — Spatial cluster

Phá một cụm.

### D5 — Segment

Phá một đoạn liên tiếp trong route.

### D6 — Worst combination

Xóa các house có marginal contribution thấp.

### D7 — Random large

Dùng khi stagnation.

---

# 118. Repair pool

### R1 — Best Profit Density

$$
\max\frac{\Delta Score}{\Delta t}.
$$

### R2 — Greedy Best Insertion

$$
\max\Delta Score.
$$

### R3 — Regret-2

$$
r_2.
$$

### R4 — Regret-3

$$
r_3.
$$

### R5 — Cluster Repair

ưu tiên đưa các neighbor gần nhau vào cùng route.

### R6 — Randomized Repair

diversification.

---

# 119. Acceptance

Tôi khuyến nghị:

$$
\boxed{
Simulated\ Annealing
}
$$

thay vì pure hill-climbing.

Vì ALNS + SA là một combination tự nhiên:

$$
P=
e^{-\Delta/T}.
$$

Như đã thấy ở các nghiên cứu ALNS/LNS, việc kết hợp search neighborhoods với acceptance/diversification mechanisms là một design pattern quan trọng. ([PubsOnline][3])

---

# 120. Nhưng temperature nên phụ thuộc score scale

Score ở đây hàng trăm nghìn / triệu.

Không thể:

$$
T_0=1.
$$

Nên chọn:

$$
T_0
=
\gamma\cdot |\text{typical score delta}|.
$$

Ví dụ sample các random moves:

$$
|\Delta|
\approx50,000.
$$

Có thể:

$$
T_0=50,000.
$$

Sau đó:

$$
T_{t+1}=\alpha T_t.
$$

---

# 121. Hoặc dùng threshold acceptance

Đơn giản hơn:

$$
Accept(S')
$$

nếu:

$$
Score(S')
\ge
Score(S)-\theta.
$$

Điều này tránh exp/log và có thể nhanh hơn.

---

# 122. Với 100ms, tôi còn thích Record-to-Record

Chấp nhận:

$$
Score(S')\ge Score(best)-R.
$$

Đây có thể ổn định hơn SA khi score landscape rất rời rạc.

---

# 123. Adaptive operator selection

Ta có:

```text
Destroy:
D1 1.0
D2 2.0
D3 3.5
D4 1.4
...

Repair:
R1 2.5
R2 1.1
R3 4.2
...
```

Sampling:

$$
P_i=\frac{w_i}{\sum_jw_j}.
$$

Sau segment:

$$
w_i
\leftarrow
(1-\rho)w_i+\rho\frac{score_i}{usage_i}.
$$

---

# 124. Nhưng có một adaptation nữa mà tôi muốn thêm

Adaptive destruction size:

$$
q_t.
$$

Nếu:

$$
bestScore
$$

không cải thiện 50 iterations:

$$
q\leftarrow1.2q.
$$

Nếu vừa cải thiện:

$$
q\leftarrow\max(q_{min},0.9q).
$$

Tức:

$$
\boxed{
stagnation\rightarrow bigger\ destroy
}
$$

---

# 125. LK intensity cũng adaptive

Nếu solution mới:

```text
high quality
```

thì chạy:

```text
deep LK
```

Nếu solution còn xa best:

```text
light 2-opt
```

Do đó:

$$
\boxed{
Search\ intensity
=
adaptive
}
$$

chứ không cố định.

---

# 126. Một tầng nữa: exploit vs explore

Có thể chia:

### Exploration

* random destroy;
* spatial destroy;
* large q;
* randomized repair.

### Exploitation

* worst removal;
* regret repair;
* LK;
* 2-opt;
* small q.

ALNS weights tự học balance.

---

# 127. Initial solution cực kỳ quan trọng

Do bài có:

$$
200-399
$$

house nhưng chỉ có một technician.

Có thể không phải tất cả đều được phục vụ.

Một initial solution tốt nên tận dụng:

$$
\text{high profit density + spatial clustering}.
$$

Tôi không khuyến nghị simply:

```text sort by profit descending
```

---

# 128. Seed strategy

Tạo:

### Seed A

Sort:

$$
p_i
$$

descending.

### Seed B

Sort:

$$
p_i/s_i.
$$

### Seed C

Sort:

$$
p_i/(s_i+nearestDist).
$$

### Seed D

GRASP.

### Seed E

Spatial-cluster greedy.

### Seed F

Randomized greedy.

Sau đó:

$$
best(seedA,\dots,seedF).
$$

---

# 129. Có thể tận dụng seed input

Bài sử dụng pseudo-random seed để generate instance.

Nếu generator deterministic theo seed, mỗi test instance có pattern riêng.

Nếu không có seed bias, không nên overfit.

Nhưng trong benchmark thực tế, có thể phát hiện:

```text
seed
→ spatial distribution
→ difficulty
```

và adaptive algorithm có thể phản ứng.

Không nên hard-code route cho sample seed.

---

# 130. Sample score không được dùng làm mục tiêu nội bộ

Sample:

$$
309688200
$$

chỉ là benchmark.

Không nên:

```cpp
if (score < 309688200) ...
```

Một solution tốt phải generalize qua tất cả seeds.

---

# 131. Nếu được phép precompute toàn bộ distance matrix

Đây gần như là "free win".

$$
399^2\approx159201.
$$

Một vài trăm nghìn integer.

Không đáng kể.

---

# 132. Dữ liệu route nên có double linked list hoặc vector

For 2-opt/relocate:

```text
vector<int> route;
```

rất đơn giản.

Do:

$$
n<400,
$$

không nhất thiết cần data structure phức tạp như LKH full two-level tree.

Đây là một điểm quan trọng:

> **Đừng over-engineer theo LKH nếu instance chỉ vài trăm nodes.**

---

# 133. LK đầy đủ có thể không đáng

LKH shines khi:

$$
n\gg1000.
$$

Ở:

$$
n\approx300,
$$

một implementation tốt của:

$$
2opt+3opt+relocate+swap
$$

có thể có cost/benefit tốt hơn full LKH.

Vì vậy tôi sẽ implement theo thứ tự:

$$
\boxed{
2OPT
\rightarrow
3OPT
\rightarrow
LK
}
$$

chứ không nhảy thẳng vào LKH.

---

# 134. 2-opt trước

Một full pass:

$$
O(k^2).
$$

Với:

$$
k\le399
$$

chỉ ~80k pairs.

Rất rẻ.

---

# 135. Relocate thường còn quan trọng hơn 3-opt

Ví dụ:

```text
A B C D E
```

house B có thể tốt hơn ở:

```text
A C D B E
```

Relocate giải được.

Trong prize-collecting problem, selection + relocation thường quan trọng hơn việc chỉ tối ưu tour topology.

---

# 136. Tôi sẽ ưu tiên neighborhood theo thứ tự

$$
\boxed{
Insert
\rightarrow
Remove
\rightarrow
Relocate
\rightarrow
Swap
\rightarrow
2opt
\rightarrow
3opt
\rightarrow
LK
}
$$

Đây là thứ tự tôi sẽ implement.

---

# 137. Một neighborhood rất mạnh: Remove-2 + Insert-2

```text
remove A B
      ↓
insert C D
```

Có thể phát hiện:

> một cặp low-density house nên được thay bởi hai high-density house.

Đây là một mini-LNS cực rẻ.

---

# 138. Một neighborhood khác: Segment replace

```text
A B C D E F
    └────┘

remove C D E

insert X Y
```

Đây là:

$$
3\text{-out}/2\text{-in}
$$

có thể cực mạnh trong các route có cluster.

---

# 139. Candidate list cho insertion

Không cần thử mọi house × mọi position.

Với mỗi house:

$$
NN_K(i)
$$

chỉ xem:

$$
K=10\text{–}20
$$

neighbors của route.

Điều này giảm insertion work đáng kể.

---

# 140. Nhưng insertion vị trí vẫn cần nhiều

Nếu route:

$$
k
$$

house, mỗi house có:

$$
k+1
$$

positions.

Với:

$$
k=300
$$

vẫn chỉ:

$$
O(90k)
$$

per complete scan.

Đủ nhỏ.

---

# 141. Practical complexity

Một iteration:

### Random destroy

$$
O(q)
$$

### Repair

$$
O(qk)
$$

### 2-opt

$$
O(k^2).
$$

### DP partition

$$
O(Dk^2).
$$

Với:

$$
k=300,\ D=30
$$

DP khoảng:

$$
2.7\text{ million}
$$

simple transitions.

Do đó DP có thể trở thành cost đáng kể nếu chạy **sau mọi iteration**.

---

# 142. Optimization cho DP

Không cần thử tất cả:

$$
j<i.
$$

Vì segment time tăng theo \(j\) giảm, ta có thể chỉ xét:

$$
j
$$

trong khoảng mà:

$$
time(j+1,i)\le720.
$$

Trên route thực tế, segment dài sẽ nhanh chóng vượt 720.

Nếu service times ~100–200:

$$
\text{segment length}
$$

thường chỉ vài chục house.

Do đó DP thực tế nhỏ hơn rất nhiều.

---

# 143. Có thể precompute feasible segment bounds

Với mỗi \(i\), tìm:

$$
j_{min}(i)
$$

sao cho:

$$
time(j+1,i)\le720.
$$

Sau đó:

$$
j\in[j_{min}(i),i-1].
$$

Dùng two-pointer.

---

# 144. DP partition có thể phục hồi route days

Ngoài score:

```text
parent[d][i]
```

lưu breakpoint.

Sau khi backtrack:

```text
Day 1 = v1...vj1
Day 2 = vj1+1...vj2
...
```

ta có actual sequence để gọi:

```cpp
move(...)
nextDay()
```

---

# 145. Điều này làm implementation rất sạch

Search state:

```cpp
vector<int> seq;
```

Evaluator:

```cpp
evaluate(seq)
```

trả:

```cpp
score
dayBreaks
```

Executor:

```cpp
for each day:
    move(...)
    nextDay()
```

Tách:

$$
\boxed{
search\ representation
\neq
execution\ representation
}
$$

Đây là design rất đáng làm.

---

# 146. Một điều kiện feasibility đơn giản

Một house riêng lẻ phải có:

$$
s_i\le720.
$$

Với:

$$
s_i=30m_i+30
$$

và:

$$
m_i\le6,
$$

ta có:

$$
s_i\le210.
$$

Do đó mọi house đơn lẻ đều feasible.

Điều này rất thuận lợi cho insertion.

---

# 147. Bài toán selection vì thế khá "mềm"

Không có house nào bản thân đã impossible.

Difficulty chủ yếu đến từ:

$$
\text{travel interactions}.
$$

Điều này làm:

$$
\boxed{
insertion/removal/local\ search
}
$$

rất phù hợp.

---

# 148. Một heuristic baseline rất mạnh

Tôi sẽ thực hiện:

```text
repeat until no improvement:

    best add
    best replace
    best relocate
    best 2-opt
```

đây là kiểu **best-improvement local search**.

Mỗi iteration chọn move có:

$$
\max\Delta Score.
$$

---

# 149. First-improvement vs Best-improvement

### First improvement

Tìm move đầu tiên có:

$$
\Delta>0.
$$

Nhanh.

### Best improvement

Tìm:

$$
\max\Delta.
$$

Chậm hơn nhưng thường tạo local optimum chất lượng hơn.

Với:

$$
n<400
$$

tôi nghiêng về **best-improvement** ở các phase intensification.

---

# 150. Một trick: candidate subset

Trong ALNS, không cần best-improvement trên 300 house mỗi lần.

Random sample:

$$
50\text{–}100
$$

candidate houses.

Sau đó full scan chỉ khi solution tốt.

---

# 151. LKH-style candidate edges

Cho mỗi node giữ:

$$
K=12
$$

nearest neighbors.

Khi xét:

$$
relocate/swap/2opt
$$

chỉ ưu tiên các edge trong candidate graph.

Đây là phiên bản nhẹ của tư tưởng LKH:

$$
\boxed{
candidate\ sparsification.
}
$$

---

# 152. Tôi sẽ chưa triển khai full α-nearness

Vì:

$$
n\approx300
$$

và:

$$
100ms.
$$

Alpha-nearness có thể rất mạnh nhưng tăng implementation complexity.

Benchmark trước:

```text nearest-neighbor candidates
```

Nếu chưa đủ tốt:

```text alpha-nearness
```

mới được thêm.

---

# 153. Đây là một nguyên tắc tối ưu engineering

$$
\boxed{
Measure\ before\ adding\ sophistication.
}
$$

Không phải:

$$
\text{LKH}>\text{2opt}
$$

ở mọi bài toán thực tế.

---

# 154. Benchmark matrix

Tôi sẽ chạy:

| Variant | Seeds | LS | ALNS | LK | DP              |
| ------- | ----: | -- | ---- | -- | --------------- |
| A       |     1 | —  | —    | —  | ✓               |
| B       |     1 | ✓  | —    | —  | ✓               |
| C       |    20 | ✓  | —    | —  | ✓               |
| D       |    20 | ✓  | ILS  | —  | ✓               |
| E       |    20 | ✓  | —    | ✓  | ✓               |
| F       |    10 | ✓  | ✓    | ✓  | ✓               |
| G       |    10 | ✓  | ✓    | ✓  | DP + MIP polish |

---

# 155. Đừng chỉ benchmark sample

Cần:

$$
\boxed{
1000\text{ cases}
}
$$

nếu judge có 1000 cases.

Đo:

$$
mean,\ median,\ worst,\ best.
$$

---

# 156. Nên lưu trajectory

Ví dụ:

```text
iteration    score
0            280M
100          291M
200          297M
300          300M
...
```

Điều này cho ta biết:

> ALNS đang thực sự cải thiện hay chỉ tốn CPU?

---

# 157. Operator statistics

Ví dụ:

```text
Destroy        Usage  Improvements
Random         100    10
Spatial         80    22
Worst           60    15
Segment         40    12
```

Nếu:

```text
Spatial
```

có improvement rate cao:

$$
22/80=27.5\%
$$

thì adaptive learning có cơ sở.

---

# 158. Có thể đo marginal contribution

Mỗi house:

$$
MC_i
=
Score(S)-Score(S\setminus i).
$$

Sort:

```text
MC thấp
↓
candidates for destroy
```

Đây mạnh hơn sorting theo:

$$
p_i.
$$

---

# 159. Có thể đo "travel waste"

$$
TW_i
=
d(prev,i)+d(i,next)-d(prev,next).
$$

House có:

$$
\frac{p_i}{s_i+TW_i}
$$

thấp:

> candidate removal.

Đây là một feature rất đặc trưng của bài toán.

---

# 160. Có thể xây "effective profit"

Định nghĩa:

$$
EP_i
=
p_i
-
\lambda TW_i.
$$

hoặc:

$$
EP_i
=
p_i
-
\lambda(s_i+TW_i).
$$

Dùng:

$$
EP_i
$$

cho:

* worst removal;
* candidate selection;
* greedy construction.

---

# 161. Chọn \(\lambda\) thế nào?

Không nên tùy tiện.

Có thể scale bằng:

$$
\lambda
=
\frac{\text{average profit}}
{\text{average effective minute}}.
$$

Hoặc đơn giản chuẩn hóa:

$$
score_i=
\frac{p_i}{s_i+TW_i}.
$$

Tôi ưu tiên ratio trước.

---

# 162. Cluster potential có thể bổ sung

$$
CP_i
=
\sum_{j\in NN_k(i)}
\frac{p_j}{d(i,j)+s_j}.
$$

Then:

$$
score_i=
\frac{p_i}{s_i+TW_i}
+
\lambda CP_i.
$$

Nó cho phép một house có **future opportunity** được ưu tiên.

---

# 163. Đây chính là "Look-ahead Greedy"

Greedy thông thường:

$$
current\ benefit.
$$

Look-ahead:

$$
current+future.
$$

Beam Search sau đó chỉ là:

> look-ahead với nhiều branch.

---

# 164. Solution recommendation #1 — Tôi sẽ chọn cái này

## **ASLNS + LK-lite + DP**

Không full LKH.

Cụ thể:

$$
\boxed{
GRASP\ seeds
+
ALNS
+
insert/remove/relocate/swap/2opt
+
LK-lite
+
exact\ partition\ DP
}
$$

Lý do:

* phù hợp objective;
* phù hợp \(n\approx300\);
* phù hợp 100ms;
* không phụ thuộc solver;
* tận dụng được gần như toàn bộ kiến thức 1–16;
* dễ điều chỉnh.

---

# 165. Recommendation #2 — baseline mạnh và đơn giản hơn

$$
\boxed{
GRASP + LK-lite + DP
}
$$

Nếu solution #1 quá phức tạp hoặc quá chậm:

```text
20 randomized constructions
      ↓
best
      ↓
LKH-style local search
      ↓
DP
```

Đây là solution tôi kỳ vọng có:

> **complexity / performance ratio rất tốt.**

---

# 166. Recommendation #3 — lightweight production solution

$$
\boxed{
Greedy\ Density
+
Replace
+
Relocate
+
2opt
+
DP
}
$$

Có thể chỉ vài trăm dòng C++.

Nếu benchmark cho thấy điểm đã cao, đây có thể là lựa chọn hợp lý nhất.

---

# 167. Recommendation #4 — maximum research sophistication

$$
\boxed{
Beam
+
ALNS
+
LKH
+
MIP\ polish
+
DP
}
$$

Architecture:

```text
Beam
 ↓
diverse elite solutions
 ↓
ALNS
 ↓
LKH
 ↓
DP
 ↓
MIP polish
```

Đây là solution "nghiên cứu" chứ không phải solution tôi mặc định dùng trong 100ms.

---

# 168. Recommendation #5 — nếu muốn nghiên cứu Mathematical Optimization thực sự

Xây:

$$
MILP
$$

với:

$$
x_i
$$

selection,

$$
y_{ij}
$$

routing,

$$
z_{id}
$$

day assignment.

Sau đó dùng:

$$
\boxed{
ALNS\rightarrow MIP\ neighborhood.
}
$$

Đây sẽ là matheuristic đầy đủ của Chương 16.

---

# 169. Có thể dùng Local Branching

Lấy incumbent:

$$
x^*.
$$

Cho phép thay tối đa:

$$
k
$$

selection decisions:

$$
\sum_{i:x_i^*=0}x_i+
\sum_{i:x_i^*=1}(1-x_i)
\le k.
$$

Solve MIP trong neighborhood.

Nhưng với challenge 100ms, đây là research experiment hơn là production approach.

---

# 170. Một phương án thú vị hơn MIP: exact small neighborhood bằng brute force

Nếu destroy:

$$
q\le15
$$

ta có thể exact-optimize một subset nhỏ bằng:

* DFS;
* DP;
* branch-and-bound.

Ví dụ:

```text
ALNS removes 10 houses
       ↓
exactly enumerate possible insert/replace combinations
       ↓
best repair
```

Với \(q\) nhỏ, đây có thể rẻ hơn MIP rất nhiều.

---

# 171. Đó cũng là một matheuristic

Không bắt buộc:

$$
MIP.
$$

Ta có:

$$
\boxed{
ALNS + Exact\ Search
}
$$

hoặc:

$$
\boxed{
ALNS + DP.
}
$$

---

# 172. Một "LNS spectrum"

Có thể tạo:

```text
Small destroy
   ↓
2-opt / relocate

Medium destroy
   ↓
Regret repair

Large destroy
   ↓
Beam repair

Very large destroy
   ↓
Exact search / MIP
```

Đây là spectrum rất hay.

---

# 173. Adaptive chọn mức độ exactness

Khi solution đang xa best:

```text
cheap heuristic repair
```

Khi solution gần best:

```text
expensive exact repair
```

Tức:

$$
\boxed{
search\ intensity\ increases\ near\ promising\ regions.
}
$$

---

# 174. Đây là điều tôi thực sự muốn áp dụng

Ta có khoảng cách heuristic:

$$
gapEstimate.
$$

Nếu candidate cải thiện mạnh:

$$
\rightarrow
cheap\ continuation.
$$

Nếu candidate rất gần best:

$$
\rightarrow
intensive\ LK.
$$

Nếu stagnate:

$$
\rightarrow
large\ destroy.
$$

Nếu cực gần best:

$$
\rightarrow
MIP/Exact\ neighborhood.
$$

Đây là **adaptive computational budget allocation**.

---

# 175. Toàn bộ algorithm theo state machine

```text
                   START
                     │
                     ▼
                CONSTRUCT
                     │
                     ▼
                 LOCAL OPT
                     │
             ┌───────┴────────┐
             │                │
          improve           stagnate
             │                │
             │                ▼
             │          LARGE DESTROY
             │                │
             │                ▼
             │             REPAIR
             │                │
             └───────┬────────┘
                     ▼
                    LK
                     │
                     ▼
                PARTITION DP
                     │
                     ▼
                 ACCEPT?
                /        \
              yes         no
               │           │
               ▼           ▼
            CURRENT      DIVERSIFY
               │
               └───────────►
```

Đây chính là một **search controller**, chứ không chỉ một heuristic.

---

# 176. Điều tôi kỳ vọng sẽ ảnh hưởng score mạnh nhất

Theo thứ tự:

$$
\boxed{
\text{Selection quality}
}
$$

$$
\boxed{
\text{Travel efficiency}
}
$$

$$
\boxed{
\text{Day partition / overtime}
}
$$

$$
\boxed{
\text{Deep k-opt}
}
$$

Đặc biệt tôi **không kỳ vọng full LKH sẽ tự nó tạo ra bước nhảy khổng lồ** nếu selection đang kém.

---

# 177. Đây là lý do "profit-aware" phải đứng trước "LKH"

Sai architecture:

```text
LKH all houses
```

Tốt hơn:

```text
profit selection
 ↓
LKH
```

Tốt nhất:

```text
profit-aware selection
 ↕
ALNS
 ↓
LKH
 ↓
DP
```

---

# 178. Một heuristic selection mạnh

Khởi đầu:

$$
S=\emptyset.
$$

Với mỗi house \(i\):

$$
score(i)
=
\frac{
p_i + \lambda NeighborProfit_i
}{
service_i+distance_i
}.
$$

Thêm house có score cao nhất.

Sau mỗi insertion:

$$
score
$$

được recompute cho neighbors.

Đây gần với **incremental greedy clustering**.

---

# 179. Candidate insertion objective

Tại insertion position \(j\):

$$
\Delta d_{i,j}
=
d(v_j,i)+d(i,v_{j+1})-d(v_j,v_{j+1}).
$$

$$
\Delta t=
s_i+\Delta d.
$$

Nếu day segment còn capacity:

$$
T+\Delta t\le720.
$$

Ta tính:

$$
\Delta Score
=
p_i+
200\left[
\max(0,T+\Delta t-480)
-
\max(0,T-480)
\right].
$$

Chọn:

$$
\boxed{
\max\Delta Score.
}
$$

Đây là evaluator cơ bản nhất cần chuẩn hóa.

---

# 180. Một cảnh báo rất quan trọng

Nếu dùng:

$$
\Delta Score
$$

theo một day hiện tại trong representation theo global sequence, insertion có thể thay đổi **optimal DP segmentation** toàn cục.

Do đó:

> local delta chỉ là approximation.

Đối với move candidates quan trọng, cần:

$$
evaluate(sequence')
$$

bằng DP thật.

Đây là trade-off.

---

# 181. Cách giải quyết

Hai tầng evaluation:

### Cheap filter

$$
ApproxDelta
$$

để loại bỏ 90% candidates.

### Exact candidate evaluation

$$
PartitionDP(sequence')
$$

cho top 5–20 candidates.

Đây là một kỹ thuật rất mạnh.

---

# 182. Candidate funnel

```text
300 houses
  ↓
cheap density filter
  ↓
50 candidates
  ↓
insertion scan
  ↓
10 best moves
  ↓
exact DP evaluation
  ↓
best actual move
```

Như vậy vừa nhanh vừa chính xác.

---

# 183. Đây là một pattern rất quan trọng

$$
\boxed{
Cheap\ approximate\ filter
+
expensive\ exact\ evaluator
}
$$

Nó xuất hiện rất nhiều trong optimization thực tế.

---

# 184. Một architecture cụ thể cho 100 ms

Tôi sẽ thử ngân sách:

### 5 ms

Preprocess.

### 10 ms

10–20 randomized greedy seeds.

### 10 ms

2-opt/relocate initial polish.

### 60 ms

ALNS.

### 10 ms

deep LK on best.

### 5 ms

final DP + output.

Có thể điều chỉnh sau benchmark.

---

# 185. Nhưng đừng hard-code 100 ms theo wall clock quá sát

Nên reserve:

$$
\approx10\%
$$

safety margin.

Nếu limit:

$$
100ms
$$

thì stop search ở:

$$
90\text{–}95ms.
$$

---

# 186. Vì 1000 cases, memory locality cũng đáng quan tâm

Distance matrix:

```cpp
int dist[400][400];
```

liên tục trong memory.

Route:

```cpp
int route[400];
```

tránh object allocation trong inner loop.

Không:

```cpp
vector<vector<int>>
```

ở hot path.

---

# 187. RNG cũng phải nhẹ

Dùng:

```cpp
std::mt19937
```

hoặc một PRNG nhẹ nếu cần.

Không tạo engine mới mỗi iteration.

---

# 188. Không dùng recursion sâu trong LK nếu không cần

Depth có thể:

$$
10\text{–}20
$$

nên recursion vẫn ổn, nhưng iterative version có thể nhanh hơn.

Với 100ms, profile trước khi micro-opt.

---

# 189. Không gọi `move()` trong search

`move()` là action thật.

Search phải hoạt động trên:

```text
simulated state
```

rồi cuối cùng:

```text
execute best plan
```

Nếu gọi `move()` để thử một candidate:

> cậu đã thay đổi state thật của judge.

---

# 190. Representation nên hoàn toàn local

Ví dụ:

```cpp
struct State {
    int route[MAXN];
    int len;
    int score;
};
```

Không cần truy cập Main's variables.

Đây cũng hợp với constraint code review nghiêm ngặt.

---

# 191. Execution phase

Sau khi có:

```text
dayBreaks
```

chỉ còn:

```cpp
for day:
    for house in day:
        move(house.y, house.x);

    if not lastDay:
        nextDay();
```

Điểm cần đặc biệt xác nhận:

> có được gọi `nextDay()` khi chưa hết 720 phút hay không?

Theo đặc tả đã nghiên cứu, có vẻ có. Nếu vậy DP partition phải được phép sử dụng breakpoint tùy ý.

---

# 192. Nếu `nextDay()` có cost

Nếu `nextDay()` có implicit penalty hoặc làm mất vị trí, formulation phải thay đổi.

Nhưng nếu chỉ reset daily time:

$$
\text{breakpoint free}.
$$

Đây là trường hợp đẹp nhất.

---

# 193. Tôi sẽ thử nghiệm theo 4 giai đoạn

## Experiment A

```text
Greedy + DP
```

để có baseline.

## Experiment B

```text
Greedy + LS + DP
```

đo contribution local search.

## Experiment C

```text
GRASP/ILS + LS + DP
```

đo diversification.

## Experiment D

```text
ALNS + LK + DP
```

đây là candidate cuối.

Sau đó:

```text
optional MIP polish
```

---

# 194. Ablation cho ALNS

Chạy:

```text
ALNS-Random only
ALNS-Random+Worst
ALNS+Spatial
ALNS+Regret
ALNS+LK
ALNS+DP
```

Mục đích:

> biết chính xác component nào tạo điểm.

---

# 195. Một expected result rất đáng kiểm chứng

Tôi dự đoán:

$$
DP
$$

sẽ đem lại improvement **rẻ nhưng đáng kể**.

$$
2opt/Relocate
$$

sẽ đem lại improvement lớn.

$$
ALNS
$$

sẽ đem lại improvement tiếp theo lớn.

$$
full\ LKH
$$

có thể đem lại marginal gain nhỏ hơn nhưng giúp polish.

$$
MIP
$$

có thể đem lại gain cao trên một số instances nhưng cost cũng cao.

Đây là hypothesis, cần benchmark.

---

# 196. So sánh với literature

Điểm đáng chú ý là pattern tôi đề xuất không phải ngẫu nhiên:

### Orienteering

$$
\text{selection + route + time budget}
$$

đã được giải bằng ALNS, VNS và các LNS variants. ([ScienceDirect][1])

### Time-dependent prize collecting routing

Iterated Greedy dùng destruction/construction để remove một số profitable nodes rồi reinsert chúng, và đã báo cáo kết quả vượt các approaches trước trên benchmark của bài toán. ([ScienceDirect][2])

### ALNS

Cơ chế adaptive choice giữa các competing subheuristics được chứng minh là hữu ích trong routing problems có nhiều constraint và cấu trúc khác nhau. ([PubsOnline][3])

### Hybrid ALNS

Các nghiên cứu TOP đã kết hợp ALNS với local improvement và một optimization stage để tăng chất lượng nghiệm. ([ScienceDirect][6])

Do đó:

$$
\boxed{
ALNS + local\ search + exact/light\ optimization
}
$$

là hướng có nền tảng nghiên cứu rất tốt.

---

# 197. Có một điều tôi **không** khuyên

Đừng cố "copy LKH" rồi nhét vào bài này.

Không nên:

```text
Full LKH source
+
custom profit
+
custom days
```

một cách cơ học.

Thay vào đó:

> **lấy những ý tưởng tốt nhất của LKH**:

* candidate edges;
* variable-depth exchange;
* gain;
* backtracking;
* multi-start;

rồi ghép vào representation phù hợp với bài toán.

---

# 198. Tương tự với ALNS

Không copy generic ALNS:

```text
Destroy
Repair
repeat
```

mà phải làm:

$$
\boxed{
problem-specific\ operators.
}
$$

Đặc biệt:

* spatial removal;
* travel-waste removal;
* low marginal-profit removal;
* segment removal.

Đây mới là nơi score được kéo lên.

---

# 199. Tương tự với MIP

Không nhất thiết dựng MILP toàn bài.

Có thể chỉ dùng:

$$
MIP
$$

ở:

```text
small neighborhood
```

hoặc:

```text
final polish
```

Đó mới là matheuristic đúng tinh thần Chương 16.

---

# 200. Nếu tôi phải chọn **3 solution để code đầu tiên**

### **Solution A — GRASP + 2-opt/Relocate + DP**

Dùng làm baseline mạnh.

### **Solution B — Multi-start + LK-lite + DP**

Dùng để kiểm tra contribution của Lin–Kernighan.

### **Solution C — ALNS + LK-lite + DP**

Đây là ứng viên chính.

Sau đó mới nghiên cứu:

### Solution D

$$
ALNS + MIP\ polish.
$$

---

# 201. Nếu chỉ được chọn **một solution**

Tôi chọn:

$$
\boxed{
\textbf{ALNS + Profit-aware Repair + LK-lite + Exact Day Partition DP}
}
$$

với sequence-based representation.

Cụ thể:

$$
\boxed{
\text{Global Sequence}
\rightarrow
\text{ALNS}
\rightarrow
\text{LK/2-opt}
\rightarrow
\text{DP}
}
$$

Đây là solution có sự cân bằng tốt nhất giữa:

$$
\text{quality}
$$

$$
\text{speed}
$$

$$
\text{implementation complexity}
$$

$$
\text{robustness}.
$$

---

# 202. Nếu mục tiêu là "điểm cao nhất tuyệt đối"

Tôi sẽ xây **portfolio hybrid**, không chỉ một solver:

```text
                    Instance
                       │
             ┌─────────┼─────────┐
             │         │         │
          GRASP      Beam      Greedy
             │         │         │
             └─────────┼─────────┘
                       ▼
                    Elite set
                       │
                       ▼
                      ALNS
                       │
              ┌────────┴────────┐
              │                 │
           2-opt             LK-lite
              │                 │
              └────────┬────────┘
                       ▼
                  DP partition
                       │
                       ▼
                 Candidate pool
                       │
            ┌──────────┴──────────┐
            │                     │
       normal instances       hard/stagnant
            │                     │
            ▼                     ▼
          return             MIP polish
                                  │
                                  ▼
                              final best
```

Đây là phiên bản mà tôi kỳ vọng có **upper performance ceiling cao nhất**, dù implementation phức tạp nhất.

---

# 203. Xếp hạng cuối cùng của tôi

|  Hạng | Phương pháp                | Chất lượng tiềm năng | Tốc độ | Độ khó |
| ----: | -------------------------- | -------------------- | ------ | ------ |
| **1** | **ALNS + LK-lite + DP**    | ★★★★★                | ★★★★☆  | ★★★★☆  |
| **2** | Multi-start + LK-lite + DP | ★★★★☆                | ★★★★★  | ★★★☆☆  |
| **3** | GRASP + LS + DP            | ★★★★☆                | ★★★★★  | ★★☆☆☆  |
| **4** | ILS/VNS + LS + DP          | ★★★★☆                | ★★★★☆  | ★★★☆☆  |
| **5** | Greedy + LS + DP           | ★★★☆☆                | ★★★★★  | ★★☆☆☆  |
| **6** | Beam + ALNS + LK + DP      | ★★★★★+               | ★★☆☆☆  | ★★★★★  |
| **7** | ALNS + MIP repair/polish   | ★★★★★+               | ★★☆☆☆  | ★★★★★  |

Hạng #1 là **recommendation**, chưa phải kết quả benchmark thực nghiệm trên judge; vì ta chưa có bộ 1000 instance thực tế để đo trực tiếp.

---

# 204. Một roadmap implementation rất cụ thể

Tôi sẽ triển khai theo thứ tự:

```text
V1
Distance matrix
+ Greedy

V2
+ insertion
+ remove
+ relocate
+ swap

V3
+ 2-opt
+ exact DP day partition

V4
+ GRASP
+ multi-start

V5
+ ILS / VNS

V6
+ LNS destroy/repair

V7
+ ALNS adaptive weights

V8
+ candidate edges
+ LK-lite

V9
+ Beam initialization

V10
+ optional MIP polish
```

Điều hay là sau mỗi version ta có thể đo chính xác:

$$
\Delta Score/\Delta Time.
$$

---

# 205. Thứ tự ưu tiên theo ROI

Nếu thời gian nghiên cứu/code có hạn:

$$
\boxed{
DP\ partition
}
$$

→ ưu tiên rất cao.

$$
\boxed{
Relocate + Swap + 2opt
}
$$

→ cực cao.

$$
\boxed{
GRASP/Multi-start
}
$$

→ cao.

$$
\boxed{
ALNS
}
$$

→ rất cao.

$$
\boxed{
LK-lite
}
$$

→ cao.

$$
\boxed{
Full\ LKH
}
$$

→ trung bình.

$$
\boxed{
MIP
}
$$

→ nghiên cứu sau cùng.

---

# 206. Tư tưởng cốt lõi của solution cuối

Toàn bộ bài toán có thể được xem:

$$
\boxed{
\max_{S\subseteq V,\;order(S)}
F(S)
}
$$

trong đó:

$$
F(S)=
\max_{\text{partition into }\le30\text{ days}}
Score(S,\text{partition}).
$$

Điều này cực kỳ đẹp.

Ta tách:

$$
\boxed{
\underbrace{\max_{S,order}}_{\text{hard heuristic search}}
\quad
\underbrace{
\max_{partition}
}_{\text{exact DP}}
}
$$

thay vì giải cả ba quyết định cùng lúc.

---

# 207. Một cách nhìn sâu hơn

Đây là dạng:

$$
\boxed{
\text{Bilevel-ish optimization}
}
$$

ở mức heuristic:

### Outer problem

$$
\text{Which houses + order?}
$$

### Inner problem

$$
\text{Best day partition for this order}.
$$

Inner problem:

$$
\boxed{\text{exact}}
$$

outer problem:

$$
\boxed{\text{heuristic}}.
$$

Đây là một matheuristic rất tự nhiên.

---

# 208. Từ các chương đã học, mỗi thuật toán đóng một vai trò

| Kiến thức    | Vai trò trong bài           |
| ------------ | --------------------------- |
| Greedy       | Initial construction        |
| GRASP        | Diverse seeds               |
| Local Search | Fine tuning                 |
| SA           | Acceptance                  |
| ILS          | Escape local optimum        |
| VNS          | Neighborhood escalation     |
| Beam         | Diverse construction        |
| LNS          | Large restructuring         |
| ALNS         | Adaptive destruction/repair |
| LK/LKH       | Route intensification       |
| DP           | Exact day partition         |
| MIP          | Optional final polish       |

Đây chính là lý do toàn bộ roadmap 16 chương thực ra **rất có chủ đích**.

---

# 209. Và bài toán này là một case study rất đẹp

Nó không phải:

$$
TSP.
$$

Không phải:

$$
knapsack.
$$

Không phải:

$$
scheduling.
$$

Mà là một hybrid:

$$
\boxed{
Prize\ Collecting
+
Routing
+
Scheduling
+
Resource\ Allocation
}
$$

với:

$$
\text{nonlinear-ish overtime reward}
$$

do breakpoint ở 480.

Đây chính là loại bài toán mà **không có một metaheuristic textbook nào giải hoàn hảo ngay từ đầu**.

Nó cần:

$$
\boxed{
problem-specific\ algorithm\ engineering.
}
$$

---

# 210. Kết luận phụ lục 2

Sau toàn bộ quá trình nghiên cứu, tôi **không khuyến nghị** một trong các cách:

> Greedy thuần túy.

> TSP + LKH thuần túy.

> ALNS textbook thuần túy.

> MIP toàn bài.

Thay vào đó, kiến trúc tôi đánh giá có triển vọng nhất là:

$$
\boxed{
\large
\textbf{
ALNS
+
Profit-Aware Destroy/Repair
+
LK-style Intensification
+
Exact Day-Partition DP
}
}
$$

với representation:

$$
\boxed{
\textbf{Một global sequence các house được chọn}
}
$$

và:

$$
\boxed{
\textbf{DP tự tìm cách chia sequence thành tối đa 30 ngày}
}
$$

Sau đó, nếu benchmark cho thấy ALNS + LK vẫn còn cách xa giới hạn tốt nhất, mới thêm:

$$
\boxed{
MIP/CP\ neighborhood\ polish
}
$$

theo tinh thần Chương 16.

Đây cũng phù hợp với những gì literature về prize-collecting/orienteering routing đã cho thấy: **selection + routing + time budget** thường là môi trường rất phù hợp cho LNS/ALNS, Iterated Greedy và các hybrid local-improvement methods; các nghiên cứu thực nghiệm đã nhiều lần cho thấy việc kết hợp nhiều neighborhood và repair/improvement mechanisms vượt các heuristic đơn lẻ. ([ScienceDirect][1])

**Nếu mục tiêu thực sự là phá mốc `309,688,200` trên bộ test của bài**, bước tiếp theo có giá trị nhất không phải thêm một metaheuristic mới, mà là **thiết kế và benchmark cụ thể V1 → V10 ở trên**, đặc biệt là `sequence + exact partition DP + ALNS + LK-lite`; chính quá trình benchmark đó sẽ cho biết bottleneck thật sự nằm ở **selection, routing hay day/overtime partitioning**.

[1]: https://www.sciencedirect.com/science/article/pii/S0957417418308182?utm_source=chatgpt.com "An adaptive large neighbourhood search algorithm for the orienteering problem - ScienceDirect"
[2]: https://www.sciencedirect.com/science/article/pii/S0360835215003563?utm_source=chatgpt.com "Iterated greedy heuristic for the time-dependent prize-collecting arc routing problem - ScienceDirect"
[3]: https://pubsonline.informs.org/doi/abs/10.1287/trsc.1050.0135?utm_source=chatgpt.com "An Adaptive Large Neighborhood Search Heuristic for the Pickup and Delivery Problem with Time Windows | Transportation Science"
[4]: https://www.sciencedirect.com/science/article/abs/pii/S030505481830114X?utm_source=chatgpt.com "An iterated local search for the Traveling Salesman Problem with release dates and completion time minimization - ScienceDirect"
[5]: https://www.sciencedirect.com/science/article/pii/S0957417412012638?utm_source=chatgpt.com "An augmented large neighborhood search method for solving the team orienteering problem - ScienceDirect"
[6]: https://www.sciencedirect.com/science/article/pii/S0305054820301519?utm_source=chatgpt.com "A hybrid adaptive large neighborhood search heuristic for the team orienteering problem - ScienceDirect"
