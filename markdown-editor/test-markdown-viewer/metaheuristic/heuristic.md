```text
COMBINATORIAL OPTIMIZATION
│
├── 1. Exact Methods
│   │
│   ├── Exhaustive Search
│   │   ├── Brute Force
│   │   ├── Backtracking
│   │   └── Branch & Bound
│   │
│   ├── Dynamic Programming
│   │   ├── Knapsack DP
│   │   ├── Bitmask DP
│   │   ├── TSP DP (Held-Karp)
│   │   └── Resource-Constrained DP
│   │
│   ├── Graph Algorithms
│   │   ├── Shortest Path
│   │   ├── Min Cost Flow
│   │   ├── Matching
│   │   ├── Assignment
│   │   └── Network Flow
│   │
│   └── Mathematical Optimization
│       ├── Linear Programming (LP)
│       ├── Integer Programming (IP)
│       ├── Mixed Integer Programming (MIP)
│       ├── Constraint Programming (CP)
│       ├── Column Generation
│       ├── Branch & Cut
│       ├── Branch & Price
│       └── Benders Decomposition
│
├── 2. Approximation Algorithms
│   │
│   ├── Greedy Approximation
│   ├── LP Relaxation + Rounding
│   ├── Primal-Dual
│   ├── Local Ratio
│   └── PTAS / FPTAS
│
├── 3. Constructive Heuristics
│   │
│   ├── Greedy
│   │   ├── Profit
│   │   ├── Profit / Cost
│   │   ├── Earliest Deadline
│   │   └── Nearest Neighbor
│   │
│   ├── Clustering-Based
│   │   ├── Sweep
│   │   ├── K-Means
│   │   ├── Grid Partition
│   │   └── Region Growing
│   │
│   ├── Savings Heuristic
│   │   └── Clarke-Wright
│   │
│   └── Insertion Heuristics
│       ├── Cheapest Insertion
│       ├── Regret Insertion
│       └── Best Insertion
│
├── 4. Local Search
│   │
│   ├── Hill Climbing
│   │
│   ├── Neighborhood Design
│   │   ├── Swap
│   │   ├── Insert
│   │   ├── Remove
│   │   ├── Replace
│   │   └── Relocate
│   │
│   ├── TSP Neighborhoods
│   │   ├── 2-opt
│   │   ├── 3-opt
│   │   ├── k-opt
│   │   └── Lin-Kernighan
│   │
│   └── Variable Neighborhood
│       ├── VND
│       └── VNS
│
├── 5. Metaheuristics
│   │
│   ├── Simulated Annealing (SA)
│   │
│   ├── Tabu Search (TS)
│   │
│   ├── Genetic Algorithms (GA)
│   │   ├── Selection
│   │   ├── Crossover
│   │   └── Mutation
│   │
│   ├── Evolutionary Algorithms
│   │
│   ├── Memetic Algorithms
│   │   └── GA + Local Search
│   │
│   ├── GRASP
│   │
│   ├── Iterated Local Search
│   │
│   ├── Beam Search
│   │
│   ├── Ant Colony Optimization
│   │
│   ├── Particle Swarm Optimization
│   │
│   └── Scatter Search
│
├── 6. Large Neighborhood Methods
│   │
│   ├── LNS
│   │   ├── Destroy
│   │   └── Repair
│   │
│   ├── ALNS
│   │   ├── Adaptive Destroy
│   │   ├── Adaptive Repair
│   │   └── Operator Scoring
│   │
│   └── Ruin & Recreate
│
├── 7. Hybrid Methods
│   │
│   ├── MIP + Heuristic
│   ├── CP + Local Search
│   ├── SA + 2-opt
│   ├── GA + LNS
│   ├── Tabu + VNS
│   └── Matheuristics
│
└── 8. Problem Families
    │
    ├── Packing
    │   ├── Knapsack
    │   ├── Bin Packing
    │   └── Cutting Stock
    │
    ├── Routing
    │   ├── TSP
    │   ├── Prize Collecting TSP
    │   ├── Orienteering
    │   ├── Team Orienteering
    │   ├── VRP
    │   ├── VRPTW
    │   └── Pickup & Delivery
    │
    ├── Scheduling
    │   ├── Job Shop
    │   ├── Flow Shop
    │   ├── Open Shop
    │   └── RCPSP
    │
    ├── Assignment
    │   ├── Bipartite Matching
    │   ├── Assignment Problem
    │   └── General Matching
    │
    └── Network Design
        ├── Steiner Tree
        ├── Facility Location
        ├── Set Cover
        └── Set Packing
```

---

## Cách nhìn "cây tiến hóa"

Nếu bỏ hết chi tiết kỹ thuật, có thể xem lịch sử phát triển như sau:

```text
Brute Force
    │
    ▼
Dynamic Programming
    │
    ▼
Mathematical Programming
    │
    ├───────────────┐
    ▼               ▼
Approximation   Constructive Heuristic
                        │
                        ▼
                   Local Search
                        │
                        ▼
                  Metaheuristic
                        │
                        ▼
                 LNS / ALNS
                        │
                        ▼
                  Hybrid Methods
                        │
                        ▼
                 State-of-the-Art
```

---

## Nếu mục tiêu là các bài Samsung SW, ICPC Challenge, HashCode

80% thời gian nên đầu tư vào nhánh này:

```text
Greedy
   │
   ▼
Constructive Heuristic
   │
   ▼
Local Search
   ├── Swap
   ├── Insert
   ├── Remove
   └── 2-opt
   │
   ▼
Simulated Annealing
   │
   ▼
Tabu Search
   │
   ▼
LNS
   │
   ▼
ALNS
```

Đây chính là "xương sống" của phần lớn lời giải top-tier cho các bài tối ưu tổ hợp cỡ vài trăm tới vài chục nghìn đối tượng, nơi lời giải chính xác bằng DP/MIP không còn khả thi.
