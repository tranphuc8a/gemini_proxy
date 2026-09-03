Được. Mình sẽ biến roadmap trên thành một **series bài giảng**, mỗi topic là một “chương” độc lập trong một đoạn chat. Không chỉ liệt kê thuật toán, mà đi từ **mô hình → trực giác → toán học → ví dụ → chứng minh → pseudocode → triển khai → khi nào dùng → giới hạn → bài tập**.

Mình đề xuất thứ tự như sau:

```text
COMBINATORIAL OPTIMIZATION
│
├── 0. Mathematical Modeling
│
├── 1. Greedy Algorithms
│
├── 2. Dynamic Programming
│
├── 3. Exact Search
│   ├── Backtracking
│   ├── Branch & Bound
│   └── Meet-in-the-Middle
│
├── 4. Approximation Algorithms
│   ├── Approximation Ratio
│   ├── LP Relaxation
│   ├── Rounding
│   └── Primal-Dual
│
├── 5. Local Search
│   ├── Neighborhood
│   ├── Hill Climbing
│   ├── Swap / Insert / Remove
│   └── 2-opt / 3-opt
│
├── 6. Simulated Annealing
│
├── 7. Tabu Search
│
├── 8. Genetic / Evolutionary Algorithms
│
├── 9. GRASP
│
├── 10. Iterated Local Search
│
├── 11. VND / VNS
│
├── 12. Beam Search
│
├── 13. Large Neighborhood Search
│
├── 14. Adaptive Large Neighborhood Search
│
├── 15. Mathematical Optimization
│   ├── LP
│   ├── ILP
│   ├── MIP
│   ├── CP
│   ├── Column Generation
│   ├── Branch & Cut
│   └── Benders
│
└── 16. Hybrid / Matheuristics
```

### Cách mình sẽ giảng

Mỗi topic sẽ theo cùng một framework:

**1. Bài toán kinh điển**

Ví dụ với Greedy:

> Activity Selection → Fractional Knapsack → MST → Huffman.

**2. Vì sao bài toán khó/dễ?**

Phân biệt:

$$
\text{Polynomial}
\quad\text{vs}\quad
\text{NP-hard}
$$

**3. Ý tưởng cốt lõi**

Không chỉ nói "Greedy chọn cái tốt nhất", mà giải thích **tại sao lựa chọn cục bộ có thể dẫn tới nghiệm tối ưu**.

**4. Formalization**

Ví dụ:

$$
\max f(x)
$$

với:

$$
x\in S
$$

và các constraint.

**5. Chứng minh**

Khi có thể, mình sẽ chứng minh:

* Greedy-choice property
* Optimal substructure
* Approximation ratio
* Tính hội tụ/local optimum
* Correctness của các phép biến đổi

**6. Implementation**

Pseudocode → C++ → phân tích:

$$
O(\cdot),\quad O(\cdot),\quad O(\cdot)
$$

**7. Failure cases**

Đây là phần đặc biệt quan trọng với tối ưu hóa:

> Khi nào thuật toán **không nên dùng**?

Ví dụ Greedy không phải cứ thấy "chọn cái tốt nhất trước" là dùng được.

**8. Nâng cấp**

Ví dụ:

```text
Greedy
   ↓
Greedy + Randomization
   ↓
Greedy + Local Search
   ↓
GRASP
```

hoặc:

```text
Local Search
      ↓
Simulated Annealing
      ↓
Tabu Search
      ↓
VNS
      ↓
LNS
      ↓
ALNS
```

---

# Quan trọng: mình sẽ dùng một bài toán xuyên suốt

Thay vì mỗi chương lấy một ví dụ hoàn toàn khác nhau, mình đề xuất dùng **TSP / Technician Routing** làm "case study" xuyên suốt.

Ví dụ:

```text
                 TSP
                  │
        ┌─────────┴─────────┐
        │                   │
     Exact               Heuristic
        │                   │
   Held-Karp             Greedy
        │                   │
        │              Nearest Neighbor
        │                   │
        │              Local Search
        │                   │
        │                2-opt
        │                   │
        │             Simulated Annealing
        │                   │
        │              Tabu Search
        │                   │
        │                 VNS
        │                   │
        │                  LNS
        │                   │
        │                 ALNS
        │                   │
        └───────────┬───────┘
                    │
               Hybrid Solver
```

Như vậy Phúc sẽ nhìn thấy **sự tiến hóa của một lời giải**, thay vì học 15 thuật toán rời rạc.

---

## Và sau đó quay lại bài Air Conditioner

Đến phần LNS/ALNS, chúng ta sẽ quay lại chính bài:

> **Air Conditioner Cleaning Technician**

và xây solver từng tầng:

```text
Version 1
Greedy
        ↓
Version 2
Greedy + spatial clustering
        ↓
Version 3
Greedy + Local Search
        ↓
Version 4
Simulated Annealing
        ↓
Version 5
VNS
        ↓
Version 6
LNS
        ↓
Version 7
ALNS
        ↓
Version 8
Hybrid / Matheuristic
```

Mục tiêu không chỉ là hiểu thuật toán mà là cuối cùng **tự tay thiết kế được một optimizer cho một đề bài hoàn toàn mới**.

---

# Chương 0 sẽ là nền tảng

Mình khuyên **không nhảy thẳng vào Greedy**. Trước tiên cần một bài về:

### **Mathematical Modeling of Optimization Problems**

Trong đó ta sẽ xây dựng đầy đủ:

$$
\boxed{
\text{Solution Space}
\rightarrow
\text{Decision Variables}
\rightarrow
\text{Constraints}
\rightarrow
\text{Objective Function}
}
$$

sau đó phân biệt:

```text
Feasible solution
        ↓
Local optimum
        ↓
Global optimum
        ↓
Approximate solution
```

và đặc biệt là hai khái niệm xuyên suốt toàn bộ series:

$$
\boxed{\text{Exploration}}
\qquad\text{vs}\qquad
\boxed{\text{Exploitation}}
$$

Đây chính là chìa khóa để hiểu vì sao **Greedy → Local Search → SA → Tabu → VNS → LNS → ALNS** không phải một đống thuật toán rời rạc, mà là những cách khác nhau để điều khiển việc **khám phá không gian nghiệm**.

Nếu bắt đầu series, **đoạn chat tiếp theo mình sẽ giảng Chương 0: Mathematical Modeling of Combinatorial Optimization** thật chi tiết, rồi từ đó lần lượt đi qua từng topic.
