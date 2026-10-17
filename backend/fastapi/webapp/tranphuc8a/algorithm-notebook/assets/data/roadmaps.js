/* roadmaps.js — lộ trình học theo mục tiêu + các bộ so sánh gợi ý. Mọi id phải có trong thư viện (kiem.js kiểm).
   Lộ trình = các chặng theo thứ tự; trong chặng, id xếp từ dễ tới khó. Tiến độ lấy từ trạng thái từng thuật toán (Chưa học … Thành thạo). */
(function (root) {
  "use strict";
  var A = root.Algo;
  A.roadmaps = [
    { id: "cp", name: "Competitive Programming (ICPC / Codeforces / AtCoder)", goal: "Thi lập trình thi đấu", blurb: "Từ công cụ nền tảng tới các kỹ thuật thường gặp ở vòng khu vực và Div.2–Div.1.", stages: [
      { title: "1. Nền tảng", why: "Nhịp điệu giải bài: xử lý mảng nhanh, tìm kiếm, sắp xếp, bit.", ids: ["array-prefix-sum", "difference-array", "sorting", "binary-search", "two-pointers", "sliding-window", "bit-manipulation", "coordinate-compression", "stack", "queue"] },
      { title: "2. Đồ thị cơ bản", why: "Phần lớn bài đồ thị xuất phát từ đây.", ids: ["graph-representation", "bfs", "dfs", "bfs-01", "dsu", "topological-sort", "dijkstra", "kruskal", "prim"] },
      { title: "3. Cấu trúc dữ liệu truy vấn", why: "Truy vấn đoạn và duy trì cực trị — xuất hiện ở mọi cuộc thi.", ids: ["heap", "monotonic-stack", "monotonic-queue", "fenwick-tree", "segment-tree", "sparse-table", "lazy-segment-tree", "sqrt-decomposition", "mo-algorithm"] },
      { title: "4. Quy hoạch động", why: "Dạng bài đa dạng nhất; luyện nhận ra trạng thái.", ids: ["kadane", "knapsack-01", "knapsack-unbounded", "coin-change", "lis", "lcs", "edit-distance", "interval-dp", "bitmask-dp", "digit-dp", "tree-dp"] },
      { title: "5. Số học", why: "Modulo, nguyên tố, tổ hợp — hầu như bài đếm nào cũng cần.", ids: ["fast-pow", "gcd-extgcd", "modular-inverse", "sieve", "ncr-mod", "euler-phi", "crt", "matrix-exponentiation"] },
      { title: "6. Xâu", why: "So khớp và hash là công cụ nhanh cho bài xâu.", ids: ["kmp", "z-function", "rolling-hash", "trie", "xor-trie", "manacher"] },
      { title: "7. Đồ thị nâng cao", why: "Cây, liên thông, luồng — các bài khó vừa của vòng khu vực.", ids: ["bellman-ford", "floyd-warshall", "scc", "bridges-articulation", "lca", "tree-diameter", "hld", "centroid-decomposition", "bipartite-matching", "dinic", "min-cost-flow", "two-sat"] },
      { title: "8. Nâng cao", why: "Tối ưu DP, biến đổi nhanh, cấu trúc xâu mạnh, hình học.", ids: ["divide-conquer-opt", "convex-hull-trick", "sos-dp", "meet-in-the-middle", "ntt", "fft", "suffix-array", "aho-corasick", "suffix-automaton", "treap", "convex-hull", "sweep-line"] }
    ] },
    { id: "dsa", name: "Sinh viên: Cấu trúc dữ liệu & Giải thuật", goal: "Môn CTDL&GT, thi cuối kỳ", blurb: "Trình tự giống giáo trình: từ mảng, ngăn xếp tới đồ thị và quy hoạch động cơ bản.", stages: [
      { title: "1. Cấu trúc tuyến tính", why: "Mọi thứ khác dựa trên chúng.", ids: ["array-prefix-sum", "stack", "queue", "heap"] },
      { title: "2. Tìm kiếm & sắp xếp", why: "Hai bài toán kinh điển; hiểu độ phức tạp.", ids: ["sorting", "binary-search", "two-pointers", "count-inversions"] },
      { title: "3. Cây và bảng", why: "Biểu diễn dữ liệu có cấu trúc.", ids: ["trie", "dsu", "segment-tree", "fenwick-tree"] },
      { title: "4. Đồ thị", why: "Duyệt, đường đi ngắn nhất, cây khung.", ids: ["graph-representation", "bfs", "dfs", "topological-sort", "dijkstra", "bellman-ford", "floyd-warshall", "kruskal", "prim"] },
      { title: "5. Quy hoạch động & tham lam", why: "Thiết kế thuật toán theo bài toán con.", ids: ["kadane", "knapsack-01", "lis", "lcs", "edit-distance", "greedy-interval-scheduling", "backtracking"] }
    ] },
    { id: "interview", name: "Kỹ sư phần mềm: phỏng vấn thuật toán", goal: "Chuẩn bị phỏng vấn (big tech)", blurb: "Các mẫu xuất hiện nhiều nhất ở vòng coding: hai con trỏ, cửa sổ trượt, heap, đồ thị, DP, trie, LRU.", stages: [
      { title: "1. Mẫu cơ bản", why: "Giải 60% bài dễ-vừa.", ids: ["two-pointers", "sliding-window", "binary-search", "array-prefix-sum", "sorting", "stack", "queue", "monotonic-stack"] },
      { title: "2. Heap, đồ thị, cây", why: "Top K, lịch trình, đường đi, thứ tự phụ thuộc.", ids: ["heap", "bfs", "dfs", "topological-sort", "dsu", "dijkstra", "trie", "lca"] },
      { title: "3. DP & quay lui", why: "Nhận dạng bài DP cổ điển.", ids: ["kadane", "knapsack-01", "coin-change", "lis", "lcs", "edit-distance", "backtracking", "bitmask-dp"] },
      { title: "4. Thiết kế cấu trúc", why: "Câu hỏi kiểu \"thiết kế LRU / bộ giới hạn\".", ids: ["lru-cache", "lfu-cache", "rate-limiter", "skip-list", "bloom-filter"] }
    ] },
    { id: "system", name: "System Design, Database, Distributed System", goal: "Ôn thiết kế hệ thống & hệ phân tán", blurb: "Các cấu trúc / giao thức xuất hiện sau mọi hệ thống lớn.", stages: [
      { title: "1. Bộ nhớ đệm & cấu trúc cơ sở", why: "Hiệu năng đọc và chỉ mục.", ids: ["lru-cache", "lfu-cache", "skip-list", "b-plus-tree", "lsm-tree"] },
      { title: "2. Phân mảnh & xấp xỉ", why: "Mở rộng ngang và dữ liệu rất lớn.", ids: ["consistent-hashing", "bloom-filter", "hyperloglog", "rate-limiter"] },
      { title: "3. Nhất quán & đồng thuận", why: "Nhiều node cùng đồng ý.", ids: ["merkle-tree", "vector-clock", "two-phase-commit", "raft"] }
    ] },
    { id: "heuristic", name: "Tối ưu hoá & Heuristic Contest", goal: "AtCoder Heuristic, Marathon, OI tối ưu", blurb: "Khi không có thuật toán chính xác đủ nhanh: tìm kiếm cục bộ, metaheuristic, nhánh cận.", stages: [
      { title: "1. Vét cạn thông minh", why: "Cắt tỉa là nền của mọi heuristic tốt.", ids: ["backtracking", "meet-in-the-middle", "branch-and-bound"] },
      { title: "2. Tìm kiếm cục bộ", why: "Cải thiện dần một nghiệm.", ids: ["hill-climbing", "simulated-annealing", "tabu-search"] },
      { title: "3. Dựng nghiệm & quần thể", why: "Dựng nghiệm tham lam ngẫu nhiên, giữ nhiều phương án.", ids: ["grasp", "beam-search", "genetic-algorithm"] }
    ] }
  ];

  /** Các bộ so sánh gợi ý (bấm là mở bảng so sánh). */
  A.compareSets = [
    { name: "Fenwick ↔ Segment Tree", ids: ["fenwick-tree", "segment-tree"] },
    { name: "Fenwick ↔ Segment Tree ↔ Sparse Table", ids: ["fenwick-tree", "segment-tree", "sparse-table"] },
    { name: "Segment Tree ↔ Lazy ↔ Sqrt Decomposition", ids: ["segment-tree", "lazy-segment-tree", "sqrt-decomposition"] },
    { name: "Dijkstra ↔ Bellman-Ford ↔ SPFA", ids: ["dijkstra", "bellman-ford", "spfa"] },
    { name: "Đường đi ngắn nhất: Dijkstra ↔ Floyd ↔ 0-1 BFS", ids: ["dijkstra", "floyd-warshall", "bfs-01", "bfs"] },
    { name: "Kruskal ↔ Prim", ids: ["kruskal", "prim"] },
    { name: "BFS ↔ DFS", ids: ["bfs", "dfs"] },
    { name: "Luồng: Edmonds-Karp ↔ Dinic", ids: ["edmonds-karp", "dinic"] },
    { name: "Ghép cặp: Kuhn ↔ Hopcroft-Karp ↔ Hungarian", ids: ["bipartite-matching", "hopcroft-karp", "hungarian"] },
    { name: "So khớp xâu: KMP ↔ Z ↔ Hash ↔ Aho-Corasick", ids: ["kmp", "z-function", "rolling-hash", "aho-corasick"] },
    { name: "Suffix Array ↔ Suffix Automaton", ids: ["suffix-array", "suffix-automaton"] },
    { name: "Balô: 0/1 ↔ không giới hạn ↔ có giới hạn", ids: ["knapsack-01", "knapsack-unbounded", "knapsack-bounded"] },
    { name: "Tăng tốc DP: CHT ↔ chia để trị", ids: ["convex-hull-trick", "divide-conquer-opt"] },
    { name: "FFT ↔ NTT", ids: ["fft", "ntt"] },
    { name: "Nguyên tố: Sàng ↔ Miller-Rabin ↔ Pollard Rho", ids: ["sieve", "miller-rabin", "pollard-rho"] },
    { name: "Metaheuristic: Hill Climbing ↔ SA ↔ Tabu", ids: ["hill-climbing", "simulated-annealing", "tabu-search"] },
    { name: "Metaheuristic: GA ↔ GRASP ↔ Beam Search", ids: ["genetic-algorithm", "grasp", "beam-search"] },
    { name: "Cache: LRU ↔ LFU", ids: ["lru-cache", "lfu-cache"] },
    { name: "Lưu trữ: B+ Tree ↔ LSM Tree ↔ Skip List", ids: ["b-plus-tree", "lsm-tree", "skip-list"] },
    { name: "Tìm kiếm trên dãy: nhị phân ↔ tam phân ↔ hai con trỏ", ids: ["binary-search", "ternary-search", "two-pointers"] }
  ];
})(typeof globalThis !== "undefined" ? globalThis : this);
