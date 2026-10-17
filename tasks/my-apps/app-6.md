Ứng dụng 11: Heuristic Playground

Đây là ứng dụng thiên về học tập, nghiên cứu và thử nghiệm thuật toán tối ưu hóa, cho phép người dùng trực quan hóa cách các heuristic/metaheuristic tìm kiếm nghiệm và so sánh hiệu quả giữa chúng.


---

1. Bài toán

Tôi đang học hoặc nghiên cứu các thuật toán tối ưu hóa như:

- Hill Climbing
- Simulated Annealing
- Tabu Search
- Genetic Algorithm
- GRASP
- Beam Search
- ILS
- VNS/VND
- Local Search
- Vân vân...

Khi học lý thuyết, tôi thường gặp khó khăn trong việc hình dung:

- Thuật toán thực sự di chuyển trong không gian nghiệm như thế nào.
- Tại sao Local Search dễ mắc kẹt ở local optimum.
- Simulated Annealing thoát local optimum như thế nào.
- Genetic Algorithm tiến hóa quần thể ra sao.
- GRASP khác Randomized Greedy như thế nào.
- Thay đổi parameter ảnh hưởng đến kết quả ra sao.
- Vì sao cùng một thuật toán nhưng các lần chạy khác nhau lại cho nghiệm khác nhau.

Tôi muốn một ứng dụng cho phép chạy, quan sát, điều khiển và so sánh các thuật toán tối ưu hóa ngay trên điện thoại, máy tính.


---

2. Mục tiêu sản phẩm

Ứng dụng phải cho phép:

- Chọn một bài toán tối ưu hóa.
- Chọn thuật toán giải.
- Cấu hình parameter.
- Chạy thuật toán.
- Quan sát quá trình tìm kiếm.
- Xem nghiệm hiện tại.
- Xem fitness/objective theo thời gian.
- Pause/resume/step.
- Chạy nhiều lần.
- So sánh nhiều thuật toán.
- Export kết quả.

Mục tiêu chính là visualization + experimentation, không phải trở thành thư viện tối ưu hóa production.


---

3. Đối tượng người dùng

Sinh viên

Học:

Optimization
AI
Algorithms
Operations Research

Competitive Programmer

Nghiên cứu:

Heuristic
Metaheuristic
Local Search

Nhà nghiên cứu

Thử nghiệm:

Parameter
Algorithm
Objective Function


---

4. Khái niệm nghiệp vụ

4.1. Problem

Một bài toán tối ưu hóa.

Ví dụ:

TSP
Knapsack
N-Queens
Max-Cut
Scheduling


---

4.2. Instance

Một dữ liệu cụ thể của Problem.

Ví dụ:

TSP

N = 100 cities

Problem:

TSP

Instance:

100 cities với tọa độ cụ thể


---

5. Objective Function

Mỗi bài toán phải xác định mục tiêu.

Ví dụ TSP:

Minimize:

total_distance

Knapsack:

Maximize:

total_value

Ứng dụng phải phân biệt rõ:

Minimize
Maximize

để không đánh giá ngược nghiệm.


---

6. Solution

Một nghiệm của problem.

Ví dụ TSP:

0 → 4 → 2 → 7 → 1 → 5 → 3 → 6 → 0

Ứng dụng lưu:

Solution
├── representation
├── objective value
└── metadata


---

7. Neighborhood

Đối với Local Search, ứng dụng phải mô tả phép biến đổi nghiệm.

Ví dụ TSP:

2-opt
3-opt
Swap
Insert

Ví dụ:

A → B → C → D

Swap:

A → C → B → D


---

8. Algorithm

Các thuật toán có thể được tích hợp sẵn.

Local Search

Hill Climbing
First Improvement
Best Improvement
Random Restart


---

Metaheuristic

Simulated Annealing
Tabu Search
GRASP
ILS
VNS
VND


---

Population-based

Genetic Algorithm


---

Search-based

Beam Search


---

9. Algorithm Configuration

Người dùng chọn:

Problem:
TSP

Algorithm:
Simulated Annealing

Sau đó ứng dụng hiển thị parameters:

Initial Temperature
Cooling Rate
Iterations
Neighborhood


---

Ví dụ:

Temperature = 1000
Cooling Rate = 0.995
Iterations = 100000


---

10. Random Seed

Đây là chức năng quan trọng.

Người dùng có thể chọn:

Random Seed = 123456

Nếu chạy lại cùng:

Problem
Instance
Algorithm
Parameters
Seed

thì phải tạo ra cùng kết quả.


---

Điều này giúp experiment có tính reproducibility.


---

11. Run

Người dùng bấm:

▶ Run

Ứng dụng thực thi thuật toán.

Hiển thị:

Iteration: 25,432

Current:
1234.5

Best:
1102.7


---

12. Pause / Resume

Người dùng có thể:

Pause

sau đó:

Resume

Trạng thái thuật toán phải được giữ nguyên.


---

13. Step-by-step

Đặc biệt phục vụ mục đích học.

Người dùng chọn:

Step

Mỗi lần bấm chỉ thực hiện một iteration hoặc một bước logic.

Ví dụ:

Iteration 12

Current solution
↓
Generate neighbor
↓
Evaluate
↓
Accept


---

14. Visualization

Đây là chức năng trung tâm.

Với TSP

Hiển thị các thành phố:

●────●
│  ╲ │
●────●

Đường đi hiện tại được vẽ trên canvas.

Khi thuật toán tìm nghiệm mới, đường đi thay đổi.


---

Với Knapsack

Hiển thị:

Capacity = 50

████████████████
Used = 42

Các item được chọn có thể được highlight.


---

15. Fitness Chart

Ứng dụng ghi lại:

iteration
objective

và vẽ:

Fitness
  │
  │╲
  │ ╲___
  │     ╲__
  │        ╲___
  └────────────── iteration


---

Có thể hiển thị đồng thời:

- Current objective.
- Best objective.
- Average objective nếu thuật toán có population.


---

16. Search Trajectory

Với các bài toán có thể trực quan hóa không gian nghiệm, ứng dụng hiển thị đường đi của thuật toán.

Ví dụ:

Start
  ↓
Solution A
  ↓
Solution B
  ↓
Local Optimum
  ↓
Escape
  ↓
Solution C

Đặc biệt hữu ích để minh họa Simulated Annealing và Tabu Search.


---

17. Algorithm Comparison

Người dùng chọn:

Hill Climbing
Simulated Annealing
GRASP

và chạy cùng:

Problem
Instance
Time limit

Ứng dụng hiển thị:

Algorithm	Best	Average	Time

Hill Climbing	1250	1302	1.2s
SA	1102	1145	2.1s
GRASP	1088	1110	2.4s



---

18. Multiple Runs

Do heuristic có tính ngẫu nhiên, một lần chạy không đủ để đánh giá.

Người dùng chọn:

Runs = 30

Ứng dụng chạy:

Seed 1
Seed 2
...
Seed 30


---

Sau đó thống kê:

Best
Worst
Average
Median
Standard Deviation


---

19. Statistical Comparison

Ứng dụng cho phép so sánh:

Algorithm A
vs
Algorithm B

với nhiều independent runs.

Hiển thị:

Best
Mean
Median
Std Dev

Để người dùng không kết luận rằng một thuật toán tốt hơn chỉ dựa trên một run may mắn.


---

20. Parameter Tuning

Người dùng muốn thử:

Temperature:

100
500
1000
2000

Ứng dụng có thể chạy experiment:

Temperature = 100
Temperature = 500
Temperature = 1000
Temperature = 2000

Sau đó so sánh kết quả.


---

21. Experiment

Một Experiment bao gồm:

Problem
Instance
Algorithm
Parameters
Random Seeds

Ví dụ:

Experiment #12

Problem: TSP-100
Algorithm: SA
Runs: 30
Temperature: 1000
Cooling: 0.995


---

22. Experiment History

Ứng dụng lưu lịch sử:

Experiment #1
Experiment #2
Experiment #3
...

Có thể mở lại để xem:

- Configuration.
- Result.
- Chart.
- Seed.
- Best solution.


---

23. Solution Viewer

Sau khi chạy xong:

Best Solution

người dùng có thể xem:

- Representation.
- Objective.
- Constraint violations.
- Algorithm.
- Iteration found.


---

24. Constraint

Một số bài toán có constraint.

Ví dụ Knapsack:

weight <= capacity

Ứng dụng phải phân biệt:

Feasible
Infeasible


---

Có thể hiển thị:

Objective = 850
Weight = 48 / 50
Feasible ✓


---

25. Penalty Function

Đối với thuật toán cho phép nghiệm infeasible, người dùng có thể cấu hình:

Penalty:

fitness =
objective
+
penalty × violation

Điều này đặc biệt hữu ích khi nghiên cứu heuristic.


---

26. Problem Generator

Ứng dụng có thể sinh instance ngẫu nhiên.

Ví dụ TSP:

N = 100

Generate

Sinh 100 thành phố ngẫu nhiên.


---

Có thể cấu hình:

N
Seed
Distribution
Range


---

27. Custom Instance

Người dùng có thể nhập dữ liệu.

Ví dụ TSP:

10
0 0
10 20
30 15
...


---

28. Built-in Problems

MVP nên hỗ trợ một số problem kinh điển:

TSP

Minimize total distance.

Knapsack

Maximize value.

N-Queens

Minimize conflicts.

Max-Cut

Maximize cut value.

Scheduling

Minimize makespan.


---

29. Algorithm Playground

Người dùng có thể tạo cấu hình:

Problem:
TSP

Initial Solution:
Random

Construction:
Randomized Greedy

Local Search:
2-opt

Metaheuristic:
GRASP

Điều này đặc biệt phù hợp để thử nghiệm các hybrid heuristic.


---

30. Algorithm Pipeline

Cho phép ghép các component:

Construction
     ↓
Local Search
     ↓
Perturbation
     ↓
Local Search

Ví dụ ILS:

Random Construction
        ↓
     Local Search
        ↓
     Perturbation
        ↓
     Local Search
        ↓
      Accept


---

31. Export Experiment

Cho phép xuất:

JSON
CSV

Ví dụ CSV:

algorithm,seed,best,time
SA,1,1102,2.1
SA,2,1130,2.0
...


---

32. Share Experiment

Không cần server.

Người dùng có thể export một file:

experiment.json

và import sang điện thoại khác.

File chứa toàn bộ:

Problem
Instance
Algorithm
Parameters
Seeds
Results


---

33. Phi chức năng

Cho phép chạy Offline.


---

Deterministic

Khi cùng random seed:

Input
+
Algorithm
+
Parameter
+
Seed

phải cho cùng kết quả, trong phạm vi implementation deterministic.


---

Performance

Ứng dụng phải chạy được các experiment vừa phải trên smartphone mà không làm UI bị treo.

Thuật toán nên chạy ở:

Worker / Web Worker

để tách computation khỏi UI thread.


---

Memory

Không lưu toàn bộ trajectory nếu experiment quá lớn.

Cho phép cấu hình:

Record every N iterations

Ví dụ:

1.000.000 iterations

record every 1.000

---

36. Một phiên sử dụng điển hình

Tôi muốn nghiên cứu GRASP cho TSP.

Tạo instance:

TSP-100

100 cities
Seed = 12345

Chọn:

GRASP

Construction:
Randomized Greedy

RCL size:
10

Local Search:
2-opt

Iterations:
1000

Bấm:

Run

Ứng dụng hiển thị:

Iteration: 350

Current: 12,532
Best:    11,820

Trên bản đồ, đường đi liên tục thay đổi.

Sau khi chạy xong:

Best = 11,420
Time = 2.31s

Tôi chạy lại 30 lần.

Ứng dụng tổng hợp:

Best       11,420
Worst      11,980
Average    11,650
Median     11,620
Std Dev       110

Sau đó tôi duplicate experiment và thay:

RCL = 10

thành:

RCL = 30

rồi chạy lại.

Cuối cùng có thể đặt hai experiment cạnh nhau:

GRASP-RCL10
vs
GRASP-RCL30

và trực tiếp quan sát parameter nào tạo ra nghiệm tốt hơn và ổn định hơn.

Đó là giá trị cốt lõi của Heuristic Playground: biến những thứ vốn khá trừu tượng trong sách — local optimum, diversification, intensification, randomization, exploration/exploitation — thành thứ có thể chạy, nhìn thấy, đo đạc và thực nghiệm ngay trên điện thoại.
