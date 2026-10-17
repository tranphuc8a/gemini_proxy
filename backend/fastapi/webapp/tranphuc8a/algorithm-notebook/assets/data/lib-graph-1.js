/* lib-graph-1.js — đồ thị (1): biểu diễn, duyệt, đường đi ngắn nhất, cây khung, sắp xếp topo, liên thông, LCA, cây.
   Mục `dijkstra` là MẪU CHUẨN của định dạng (xem HUONG-DAN-SOAN.md). */
(function (root) {
  "use strict";
  var A = root.Algo;

  A.lib.add([
    {
      id: "graph-representation",
      name: "Biểu diễn đồ thị",
      aliases: ["danh sách kề", "adjacency list", "ma trận kề", "adjacency matrix", "danh sách cạnh", "edge list", "lưu đồ thị", "đồ thị lưới", "graph representation"],
      category: "graph",
      sub: "Biểu diễn & duyệt",
      level: 1,
      tags: ["graph", "adjacency-list", "adjacency-matrix", "edge-list", "basics"],
      summary: "Ba cách lưu đồ thị trong bộ nhớ — danh sách kề, ma trận kề, danh sách cạnh — và khi nào chọn cách nào.",
      description:
        "Đồ thị G = (V, E) thường được lưu theo ba cách:\n\n" +
        "- **Danh sách kề** (`adj[u]` = các cạnh đi ra từ u): bộ nhớ O(V+E), duyệt hàng xóm của u mất O(deg u). Là lựa chọn mặc định cho BFS, DFS, Dijkstra, sắp xếp topo, SCC…\n" +
        "- **Ma trận kề** (`mat[u][v]` = trọng số cạnh u→v hoặc \"không có cạnh\"): bộ nhớ O(V²), kiểm tra cạnh (u, v) trong O(1). Hợp khi V chỉ vài nghìn và đồ thị dày, hoặc khi chạy Floyd-Warshall.\n" +
        "- **Danh sách cạnh** (`(u, v, w)`): bộ nhớ O(E), không truy cập nhanh hàng xóm; đủ cho Kruskal (sắp xếp cạnh) và Bellman-Ford (relax mọi cạnh mỗi vòng).\n\n" +
        "Đồ thị vô hướng = thêm cả hai chiều u→v và v→u (vòng tự trỏ chỉ thêm một lần). Với bài trên **lưới** thường không cần dựng đồ thị: đỉnh là ô (r, c), hàng xóm là 4 (hoặc 8) ô kề, đánh số `r * C + c` khi cần mảng một chiều.\n\n" +
        "Template gói danh sách kề lẫn danh sách cạnh trong `Graph`, kèm hàm dựng ma trận kề và hàm liệt kê ô kề trên lưới. Với đồ thị tĩnh rất lớn (E cỡ 10⁶–10⁷) có thể thay `vector<vector<…>>` bằng mảng CSR (một mảng cạnh liền khối + mảng vị trí đầu) để nhanh và gọn bộ nhớ hơn.",
      conditions: ["Đỉnh đánh số liên tiếp 0..V−1 (hoặc 1..V) — chọn một quy ước và giữ nhất quán", "Biết trước V; ước lượng E để quyết định dùng danh sách kề hay ma trận kề"],
      complexity: { time: "O(V+E) để dựng", space: "O(V+E) (danh sách kề) · O(V²) (ma trận kề)", note: "Kiểm tra cạnh (u, v): O(1) với ma trận kề, O(deg u) với danh sách kề." },
      ops: [["Dựng danh sách kề", "O(V+E)"], ["Duyệt hàng xóm của u (danh sách kề)", "O(deg u)"], ["Kiểm tra cạnh (u, v) — ma trận kề", "O(1)"], ["Kiểm tra cạnh (u, v) — danh sách kề", "O(deg u)"], ["Duyệt mọi cạnh (danh sách cạnh)", "O(E)"], ["Bộ nhớ ma trận kề", "O(V²)"]],
      use_case: ["Lưu đồ thị thưa (E cỡ V) để chạy BFS, DFS, Dijkstra, topo-sort… → danh sách kề", "V nhỏ (≤ vài nghìn), đồ thị dày hoặc cần hỏi \"có cạnh u–v không\" liên tục → ma trận kề", "Thuật toán chỉ cần duyệt mọi cạnh (Kruskal, Bellman-Ford) → danh sách cạnh", "Bài lưới hai chiều: dùng thẳng lưới, không dựng đồ thị"],
      not_for: ["Ma trận kề với V ≥ 10⁵ → hết bộ nhớ (V² phần tử), dùng danh sách kề", "Danh sách kề khi cần kiểm tra cạnh (u, v) hàng triệu lần trên đồ thị dày → ma trận kề hoặc unordered_set các cạnh"],
      pitfalls: [
        "Nhầm 0-based và 1-based khi đọc dữ liệu: khai báo V+1 phần tử mà quên bỏ phần tử 0, hoặc trừ 1 hai lần.",
        "Đồ thị vô hướng quên thêm chiều ngược lại — duyệt chỉ đi được một chiều.",
        "Thêm cạnh vô hướng hai chiều rồi lại đếm bậc/cạnh gấp đôi (tổng bậc = 2E, không phải E).",
        "Ma trận kề: dùng 0 làm \"không có cạnh\" trong khi cạnh trọng số 0 là hợp lệ — dùng giá trị riêng (INF hoặc −1).",
        "Cạnh song song và vòng tự trỏ: danh sách kề giữ tất cả, ma trận kề chỉ giữ một giá trị (lấy min) — chọn đúng theo đề.",
        "Dựng lại `vector<vector<…>>` cho từng test mà quên reset/clear — kết quả của test trước lẫn sang test sau."
      ],
      code: {
        lang: "cpp", title: "graph.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Biểu diễn đồ thị: danh sách kề + danh sách cạnh (+ ma trận kề khi cần). Đỉnh đánh số 0..n-1.
// add_edge(u, v, w, directed): vô hướng thì thêm cả hai chiều; vòng tự trỏ (u == v) chỉ vào adj[u] MỘT lần.
struct Graph {
    int n;
    vector<vector<pair<int, long long>>> adj;  // adj[u] = {(v, w)}
    vector<array<long long, 3>> edges;         // (u, v, w) theo thứ tự thêm vào: dùng cho Kruskal, Bellman-Ford

    explicit Graph(int n = 0) : n(n), adj(n) {}

    void add_edge(int u, int v, long long w = 1, bool directed = false) {
        adj[u].push_back({v, w});
        if (!directed && u != v) adj[v].push_back({u, w});
        edges.push_back({u, v, w});
    }

    int degree(int u) const { return adj[u].size(); }  // bậc ra của u (đồ thị vô hướng: bậc thường)

    // Ma trận kề n x n: mat[u][v] = trọng số nhỏ nhất của cạnh u->v (cạnh song song lấy min), none nếu không có cạnh.
    // none phải khác mọi trọng số thật (vd INF). Tốn O(n^2) bộ nhớ: chỉ dùng khi n <= vài nghìn.
    vector<vector<long long>> matrix(long long none) const {
        vector<vector<long long>> mat(n, vector<long long>(n, none));
        for (int u = 0; u < n; u++)
            for (auto [v, w] : adj[u])
                mat[u][v] = (mat[u][v] == none) ? w : min(mat[u][v], w);
        return mat;
    }

    // Lưới R x C: ô (r, c) có id = r * C + c. Trả về id các ô kề 4 hướng nằm trong lưới (thay cho việc dựng đồ thị).
    static vector<int> grid_neighbors(int id, int R, int C) {
        static const int dr[4] = {-1, 0, 1, 0}, dc[4] = {0, 1, 0, -1};
        vector<int> res;
        int r = id / C, c = id % C;
        for (int k = 0; k < 4; k++) {
            int nr = r + dr[k], nc = c + dc[k];
            if (nr >= 0 && nr < R && nc >= 0 && nc < C) res.push_back(nr * C + nc);
        }
        return res;
    }
};
`
      },
      example: {
        input: "4 đỉnh (0..3), cạnh vô hướng theo thứ tự nhập: 0-1 (w=5), 1-2 (w=3), 2-3 (w=1)",
        output: "adj[0] = {(1,5)}\nadj[1] = {(0,5), (2,3)}\nadj[2] = {(1,3), (3,1)}\nadj[3] = {(2,1)}",
        explain: "Mỗi cạnh vô hướng được thêm vào cả hai danh sách. Tổng độ dài các danh sách kề = 6 = 2E. Danh sách cạnh giữ đúng 3 phần tử (0,1,5), (1,2,3), (2,3,1); ma trận kề 4×4 đối xứng, mat[1][2] = mat[2][1] = 3."
      },
      problems: [
        { site: "cses", id: "1666", name: "Building Roads" },
        { site: "cses", id: "1192", name: "Counting Rooms" },
        { site: "cses", id: "1667", name: "Message Route" },
        { site: "lc", name: "Clone Graph" },
        { site: "lc", name: "Find if Path Exists in Graph" }
      ],
      related: ["bfs", "dfs", "dijkstra", "kruskal", "floyd-warshall"],
      compare: { "Bài toán giải": "Chọn cách lưu đồ thị (chưa phải thuật toán)", "Cạnh âm": "Lưu được mọi trọng số", "Hợp với đồ thị": "Thưa → danh sách kề; dày hoặc V nhỏ → ma trận kề", "Kết quả cho ra": "Cấu trúc dữ liệu để các thuật toán đồ thị chạy trên đó" },
      cards: [
        { q: "Khi nào chọn danh sách kề, khi nào chọn ma trận kề?", a: "Danh sách kề (O(V+E) bộ nhớ) cho đồ thị thưa và hầu hết bài V cỡ 10⁵; ma trận kề (O(V²)) khi V ≤ vài nghìn, đồ thị dày hoặc cần hỏi cạnh (u, v) trong O(1) / chạy Floyd-Warshall." },
        { q: "Tổng độ dài các danh sách kề của đồ thị vô hướng là bao nhiêu?", a: "2E (mỗi cạnh nằm trong hai danh sách). Với đồ thị có hướng là E." },
        { q: "Danh sách cạnh hợp với thuật toán nào?", a: "Những thuật toán chỉ cần duyệt/sắp xếp mọi cạnh: Kruskal (sắp xếp theo trọng số) và Bellman-Ford (relax mọi cạnh mỗi vòng)." },
        { q: "Bài trên lưới R×C đánh số ô thế nào để dùng mảng một chiều?", a: "id = r * C + c; ngược lại r = id / C, c = id % C. Hàng xóm 4 hướng là (r±1, c), (r, c±1) nằm trong lưới." }
      ]
    },
    {
      id: "bfs",
      name: "BFS",
      aliases: ["breadth first search", "duyệt theo chiều rộng", "tìm kiếm theo chiều rộng", "đường đi ngắn nhất không trọng số", "multi-source bfs", "bfs nhiều nguồn", "bfs lưới"],
      category: "graph",
      sub: "Biểu diễn & duyệt",
      level: 1,
      tags: ["graph", "bfs", "shortest-path", "queue", "grid"],
      summary: "Duyệt đồ thị theo từng lớp khoảng cách bằng hàng đợi; cho đường đi ít cạnh nhất từ nguồn (hoặc nhiều nguồn) tới mọi đỉnh trong O(V+E).",
      description:
        "BFS thăm các đỉnh theo từng **lớp**: nguồn (khoảng cách 0), rồi mọi đỉnh cách nguồn 1 cạnh, 2 cạnh… Dùng hàng đợi FIFO; mỗi đỉnh chỉ được đẩy vào hàng đợi **một lần** — đánh dấu ngay lúc đẩy vào, không phải lúc lấy ra.\n\n" +
        "Các lớp được xử lý theo khoảng cách tăng dần, nên lần đầu chạm tới một đỉnh chính là đường đi có **ít cạnh nhất** tới nó. Vì vậy BFS giải đường đi ngắn nhất trên đồ thị không trọng số (hoặc mọi cạnh cùng trọng số). Ghi `par[v]` = đỉnh đứng trước v rồi đi ngược từ đích về nguồn để dựng lại đường đi.\n\n" +
        "**BFS nhiều nguồn**: đẩy tất cả nguồn vào hàng đợi từ đầu với khoảng cách 0 (lửa lan, quái vật đuổi theo người, ô gần nhất thoả điều kiện…). Template có bản trên đồ thị `vector<vector<int>>` và bản riêng cho lưới.",
      conditions: ["Mọi cạnh có cùng chi phí (không trọng số) — đo độ dài bằng số cạnh", "Cần đường đi ngắn nhất hoặc duyệt theo thứ tự khoảng cách; đồ thị hữu hạn"],
      complexity: { time: "O(V+E)", space: "O(V)", note: "Lưới R×C: O(R·C) thời gian và bộ nhớ." },
      ops: [["Toàn bộ BFS", "O(V+E)"], ["Bộ nhớ (dist, par, hàng đợi)", "O(V)"], ["Dựng lại một đường đi", "O(độ dài đường đi)"]],
      use_case: ["Đường đi ít bước nhất trong mê cung / lưới", "Khoảng cách từ một hoặc nhiều nguồn tới mọi đỉnh (multi-source BFS)", "Kiểm tra đồ thị hai phía (tô hai màu theo lớp), tìm thành phần liên thông", "BFS trên không gian trạng thái (mỗi trạng thái là một đỉnh) khi mỗi bước tốn như nhau"],
      not_for: ["Cạnh có trọng số khác nhau → Dijkstra (hoặc 0-1 BFS nếu trọng số chỉ 0/1)", "Cần thứ tự vào/ra (tin/tout), chu trình, cầu/khớp → DFS"],
      pitfalls: [
        "Đánh dấu thăm lúc LẤY ra khỏi hàng đợi thay vì lúc ĐẨY vào — một đỉnh bị đẩy nhiều lần, có thể làm bùng nổ thời gian và bộ nhớ.",
        "Dùng BFS cho đồ thị có trọng số khác nhau: cho kết quả sai (ít cạnh nhất ≠ nhẹ nhất).",
        "Quên điều kiện biên khi duyệt lưới (r, c ra ngoài) hoặc quên kiểm tra ô xuất phát là tường.",
        "BFS nhiều nguồn: phải đẩy MỌI nguồn trước khi bắt đầu vòng lặp, không chạy BFS riêng cho từng nguồn rồi lấy min (chậm O(K·(V+E)))",
        "Khoảng cách -1 (chưa tới) bị cộng vào phép tính tiếp theo — luôn kiểm tra `dist[v] != -1`.",
        "Dựng đường đi: quên đảo ngược mảng sau khi đi ngược theo `par`."
      ],
      code: {
        lang: "cpp", title: "bfs.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// BFS trên đồ thị không trọng số. Đỉnh 0..n-1; g[u] = danh sách đỉnh kề.
// Nhiều nguồn: truyền nhiều đỉnh trong sources. dist[v] = số cạnh ít nhất từ nguồn gần nhất (-1 nếu không tới được);
// par[v] = đỉnh đứng trước v trên đường đi (-1 với nguồn và đỉnh không tới được).
struct BfsResult {
    vector<int> dist, par;
};

BfsResult bfs(const vector<vector<int>>& g, const vector<int>& sources) {
    int n = g.size();
    BfsResult r{vector<int>(n, -1), vector<int>(n, -1)};
    queue<int> q;
    for (int s : sources)
        if (r.dist[s] == -1) {
            r.dist[s] = 0;
            q.push(s);
        }
    while (!q.empty()) {
        int u = q.front();
        q.pop();
        for (int v : g[u])
            if (r.dist[v] == -1) {  // đánh dấu NGAY khi đẩy vào hàng đợi
                r.dist[v] = r.dist[u] + 1;
                r.par[v] = u;
                q.push(v);
            }
    }
    return r;
}

// Dựng đường đi nguồn -> t từ par; rỗng nếu t không tới được.
vector<int> bfs_path(const BfsResult& r, int t) {
    vector<int> path;
    if (r.dist[t] == -1) return path;
    for (int v = t; v != -1; v = r.par[v]) path.push_back(v);
    reverse(path.begin(), path.end());
    return path;
}

// BFS trên lưới: grid[r][c] == '#' là tường, ô khác đi được; 4 hướng.
// Trả về ma trận khoảng cách từ ô (sr, sc), -1 nếu không tới được (kể cả khi ô xuất phát là tường).
vector<vector<int>> grid_bfs(const vector<string>& grid, int sr, int sc) {
    int R = grid.size(), C = R ? (int)grid[0].size() : 0;
    vector<vector<int>> dist(R, vector<int>(C, -1));
    if (grid[sr][sc] == '#') return dist;
    static const int dr[4] = {-1, 0, 1, 0}, dc[4] = {0, 1, 0, -1};
    queue<pair<int, int>> q;
    dist[sr][sc] = 0;
    q.push({sr, sc});
    while (!q.empty()) {
        auto [r, c] = q.front();
        q.pop();
        for (int k = 0; k < 4; k++) {
            int nr = r + dr[k], nc = c + dc[k];
            if (nr < 0 || nr >= R || nc < 0 || nc >= C || grid[nr][nc] == '#' || dist[nr][nc] != -1) continue;
            dist[nr][nc] = dist[r][c] + 1;
            q.push({nr, nc});
        }
    }
    return dist;
}
`
      },
      example: {
        input: "5 đỉnh (0..4), cạnh vô hướng theo thứ tự nhập: 0-1, 0-2, 1-3, 2-3, 3-4. BFS từ nguồn 0.",
        output: "dist = 0 1 1 2 3\nđường đi 0 → 4: 0 1 3 4",
        explain: "Lớp 0: {0}; lớp 1: {1, 2}; lớp 2: {3} (tới được từ cả 1 và 2, lần đầu từ 1 nên par[3] = 1); lớp 3: {4}. Dựng đường đi ngược: 4 ← 3 ← 1 ← 0."
      },
      problems: [
        { site: "cses", id: "1193", name: "Labyrinth" },
        { site: "cses", id: "1667", name: "Message Route" },
        { site: "cses", id: "1194", name: "Monsters" },
        { site: "cses", id: "1668", name: "Building Teams" },
        { site: "cf", id: "689B", name: "Mike and Shortcuts" }
      ],
      related: ["dfs", "bfs-01", "dijkstra", "graph-representation"],
      compare: { "Bài toán giải": "Đường đi ít cạnh nhất từ (các) nguồn tới mọi đỉnh", "Cạnh âm": "Không áp dụng (không có trọng số)", "Hợp với đồ thị": "Mọi đồ thị không trọng số, kể cả lưới; O(V+E)", "Kết quả cho ra": "Khoảng cách theo số cạnh + cây đường đi (par)" },
      cards: [
        { q: "BFS cho đường đi ngắn nhất trong loại đồ thị nào?", a: "Đồ thị không trọng số (mọi cạnh cùng chi phí): độ dài đo bằng số cạnh. Có trọng số khác nhau thì dùng Dijkstra / 0-1 BFS." },
        { q: "Độ phức tạp của BFS?", a: "O(V+E) thời gian, O(V) bộ nhớ (lưới R×C: O(R·C))." },
        { q: "Đánh dấu thăm đỉnh lúc nào là đúng?", a: "Ngay khi đẩy vào hàng đợi. Đánh dấu lúc lấy ra khiến một đỉnh bị đẩy nhiều lần." },
        { q: "BFS nhiều nguồn khác BFS thường thế nào?", a: "Đẩy tất cả nguồn vào hàng đợi từ đầu (khoảng cách 0) rồi chạy một lần; dist[v] là khoảng cách tới nguồn gần nhất." },
        { q: "Làm sao dựng lại đường đi sau BFS?", a: "Lưu par[v] khi đẩy v; từ đích đi ngược theo par về nguồn rồi đảo mảng." }
      ]
    },
    {
      id: "dfs",
      name: "DFS",
      aliases: ["depth first search", "duyệt theo chiều sâu", "tìm kiếm theo chiều sâu", "tin tout", "euler tour", "thành phần liên thông", "flood fill", "phát hiện chu trình"],
      category: "graph",
      sub: "Biểu diễn & duyệt",
      level: 1,
      tags: ["graph", "dfs", "connected-components", "cycle-detection", "euler-tour"],
      summary: "Duyệt đồ thị đi sâu hết nhánh rồi quay lui; cho thứ tự vào/ra (tin/tout), thành phần liên thông và phát hiện chu trình trong O(V+E).",
      description:
        "DFS đi sâu hết mức theo một nhánh rồi mới quay lui. Mỗi đỉnh có hai mốc: lúc **vào** (`tin`) và lúc **thoát** (`tout`) sau khi thăm xong mọi con cháu. Một cạnh u→v phân loại theo trạng thái của v: v chưa thăm = cạnh cây; v đang mở (còn trên ngăn xếp) = **cạnh ngược** (báo chu trình trong đồ thị có hướng); v đã đóng = cạnh xuôi/chéo.\n\n" +
        "`tin/tout` cho phép kiểm tra \"u là tổ tiên của v\" trong O(1) bằng `tin[u] ≤ tin[v] < tout[u]`, và biến mỗi cây con thành một đoạn liên tiếp (Euler tour) để kết hợp với Fenwick/Segment Tree.\n\n" +
        "DFS là nền của rất nhiều thuật toán: thành phần liên thông, phát hiện chu trình, sắp xếp topo, SCC, cầu & khớp, LCA. Template cài **bằng vòng lặp** với ngăn xếp tường minh (vị trí cạnh kế tiếp lưu trong `it[]`) để không tràn ngăn xếp gọi hàm khi V tới 10⁶.",
      conditions: ["Đồ thị hữu hạn; có thể có hướng hoặc vô hướng, nhiều thành phần", "Cần thứ tự thăm theo chiều sâu, không cần đường đi ngắn nhất"],
      complexity: { time: "O(V+E)", space: "O(V)", note: "Đệ quy cần ngăn xếp gọi hàm sâu tới V — dùng vòng lặp khi V lớn." },
      ops: [["Toàn bộ DFS", "O(V+E)"], ["Kiểm tra u là tổ tiên của v (sau DFS)", "O(1)"], ["Bộ nhớ", "O(V)"]],
      use_case: ["Đếm / gán nhãn thành phần liên thông, flood fill trên lưới", "Phát hiện chu trình trong đồ thị có hướng (cạnh ngược)", "Kích thước cây con, độ sâu, Euler tour (tin/tout) của cây có gốc", "Nền cho sắp xếp topo, SCC, cầu/khớp, LCA", "Duyệt toàn bộ trạng thái / quay lui"],
      not_for: ["Đường đi ÍT cạnh nhất → BFS (DFS chỉ cho một đường đi hợp lệ)", "Đường đi ngắn nhất có trọng số → Dijkstra / Bellman-Ford"],
      pitfalls: [
        "Đệ quy sâu (V ~ 10⁵–10⁶, đồ thị dạng đường thẳng) gây tràn ngăn xếp — dùng bản vòng lặp hoặc tăng stack.",
        "\"DFS vòng lặp\" bằng cách đẩy MỌI hàng xóm vào ngăn xếp rồi pop cho thứ tự KHÔNG phải DFS thật, tin/tout sai — phải lưu vị trí cạnh kế tiếp của từng đỉnh như template.",
        "`has_back_edge` chỉ có nghĩa với đồ thị CÓ HƯỚNG. Đồ thị vô hướng phải bỏ qua cạnh về cha (theo id cạnh, vì có thể có cạnh song song).",
        "Đánh dấu thăm lúc thoát thay vì lúc vào — vòng lặp vô hạn trên đồ thị có chu trình.",
        "Quên duyệt mọi đỉnh gốc khi đồ thị không liên thông (chỉ gọi DFS từ đỉnh 0).",
        "Nhầm `comp` của đồ thị có hướng với thành phần liên thông mạnh: đó chỉ là chỉ số cây DFS (xem SCC)."
      ],
      code: {
        lang: "cpp", title: "dfs.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// DFS dạng VÒNG LẶP (không đệ quy, an toàn khi n tới 10^6) trên MỌI đỉnh. Đỉnh 0..n-1; g[u] = danh sách kề.
//   tin[u]  = thứ tự vào (0..n-1);  tout[u] = giá trị bộ đếm sau khi thăm xong cả cây con của u  (cây con = nửa khoảng [tin, tout))
//   par[u]  = cha trong rừng DFS (-1 với gốc);  comp[u] = chỉ số cây DFS chứa u (đồ thị vô hướng: chính là thành phần liên thông)
//   order   = thứ tự thăm (tiền tự)
//   has_back_edge = có cạnh quay về một đỉnh còn đang mở (hoặc vòng tự trỏ) = có chu trình: CHỈ đúng với đồ thị CÓ HƯỚNG
struct DfsResult {
    vector<int> tin, tout, par, comp, order;
    int comps = 0;
    bool has_back_edge = false;
    bool is_ancestor(int u, int v) const { return tin[u] <= tin[v] && tin[v] < tout[u]; }  // u là tổ tiên của v (hoặc u == v)
};

DfsResult dfs_all(const vector<vector<int>>& g) {
    int n = g.size();
    DfsResult r;
    r.tin.assign(n, -1);
    r.tout.assign(n, -1);
    r.par.assign(n, -1);
    r.comp.assign(n, -1);
    vector<int> it(n, 0), stk;  // it[u] = vị trí cạnh kế tiếp cần xét của u
    int timer = 0;
    for (int s = 0; s < n; s++) {
        if (r.tin[s] != -1) continue;
        r.tin[s] = timer++;
        r.order.push_back(s);
        r.comp[s] = r.comps;
        stk.push_back(s);
        while (!stk.empty()) {
            int u = stk.back();
            if (it[u] < (int)g[u].size()) {
                int v = g[u][it[u]++];
                if (r.tin[v] == -1) {
                    r.tin[v] = timer++;
                    r.order.push_back(v);
                    r.par[v] = u;
                    r.comp[v] = r.comps;
                    stk.push_back(v);
                } else if (r.tout[v] == -1) {
                    r.has_back_edge = true;  // v còn đang mở: cạnh u->v quay về tổ tiên
                }
            } else {
                r.tout[u] = timer;
                stk.pop_back();
            }
        }
        r.comps++;
    }
    return r;
}
`
      },
      example: {
        input: "6 đỉnh (0..5), cạnh có hướng theo thứ tự nhập: 0→1, 0→2, 1→3, 2→3, 4→5",
        output: "order = 0 1 3 2 4 5\ntin = 0 1 3 2 4 5 (theo đỉnh 0..5)\ncomps = 2: {0,1,2,3} và {4,5}\nhas_back_edge = false",
        explain: "Từ 0 đi sâu 0→1→3 (3 hết đường, quay lui), quay về 0 rồi sang 2; cạnh 2→3 gặp đỉnh 3 đã đóng nên không phải cạnh ngược. Sau đó gốc mới 4 và 5. Cây con của 1 là {1, 3} = đoạn tin [1, 3)."
      },
      problems: [
        { site: "cses", id: "1192", name: "Counting Rooms" },
        { site: "cses", id: "1666", name: "Building Roads" },
        { site: "cses", id: "1669", name: "Round Trip" },
        { site: "cses", id: "1678", name: "Round Trip II" },
        { site: "cses", id: "1674", name: "Subordinates" },
        { site: "cf", id: "580C", name: "Kefa and Park" }
      ],
      related: ["bfs", "topological-sort", "scc", "bridges-articulation", "lca", "graph-representation"],
      compare: { "Bài toán giải": "Thứ tự duyệt theo chiều sâu, chu trình, thành phần liên thông, tin/tout", "Cạnh âm": "Không áp dụng (không dùng trọng số)", "Hợp với đồ thị": "Mọi đồ thị (có hướng hoặc vô hướng); O(V+E)", "Kết quả cho ra": "Rừng DFS: cha, tin/tout, thành phần, cờ chu trình" },
      cards: [
        { q: "Ba loại trạng thái của đỉnh trong DFS và ý nghĩa?", a: "Chưa thăm (trắng), đang mở/trên ngăn xếp (xám), đã thoát (đen). Cạnh tới đỉnh xám là cạnh ngược = chu trình trong đồ thị có hướng." },
        { q: "Kiểm tra u là tổ tiên của v trong O(1) thế nào?", a: "Sau DFS với tin/tout nửa khoảng: tin[u] ≤ tin[v] < tout[u]." },
        { q: "Vì sao nên cài DFS bằng vòng lặp khi V lớn?", a: "Đệ quy sâu V mức dễ tràn ngăn xếp gọi hàm (đồ thị dạng đường thẳng V = 10⁶). Dùng ngăn xếp tường minh kèm vị trí cạnh kế tiếp `it[u]`." },
        { q: "Độ phức tạp của DFS?", a: "O(V+E) thời gian, O(V) bộ nhớ." }
      ]
    },
    {
      id: "bfs-01",
      name: "0-1 BFS",
      aliases: ["0-1 bfs", "bfs 0 1", "01 bfs", "bfs deque", "trọng số 0 và 1", "deque shortest path", "bfs hai đầu"],
      category: "graph",
      sub: "Đường đi ngắn nhất",
      level: 2,
      tags: ["graph", "shortest-path", "bfs", "deque", "0-1-weights"],
      summary: "Đường đi ngắn nhất từ một nguồn khi mọi cạnh có trọng số 0 hoặc 1, dùng deque trong O(V+E) thay cho Dijkstra.",
      description:
        "0-1 BFS giải đường đi ngắn nhất khi mọi cạnh có trọng số **0 hoặc 1**, trong O(V+E) — nhanh và gọn hơn Dijkstra. Dùng một `deque`: khi relax thành công qua cạnh trọng số 0 thì đẩy đỉnh mới vào **đầu** deque (cùng khoảng cách với đỉnh đang xét); qua cạnh trọng số 1 thì đẩy vào **cuối**.\n\n" +
        "Deque luôn chứa các đỉnh có khoảng cách tạm thuộc {D, D+1} và sắp tăng dần từ đầu tới cuối — chính tính chất của hàng đợi ưu tiên trong Dijkstra nhưng được giữ bằng thao tác O(1). Mỗi đỉnh bị đẩy tối đa hai lần (lần đầu với D+1, có thể lần hai với D), nên tổng thời gian là O(V+E).\n\n" +
        "Ứng dụng điển hình: lưới mà đi theo hướng cho sẵn miễn phí còn đổi hướng/phá tường tốn 1; đồ thị mà một số cạnh \"miễn phí\" và số khác tốn đúng 1 đơn vị. Bài toán chi phí nhỏ khác (trọng số 0/1/2…) có thể tách cạnh hoặc dùng Dijkstra.",
      conditions: ["Mọi trọng số cạnh thuộc {0, 1} (hoặc quy về được: 0 và một hằng số cố định)", "Cần khoảng cách từ MỘT nguồn tới các đỉnh khác"],
      complexity: { time: "O(V+E)", space: "O(V)", note: "Mỗi đỉnh vào deque tối đa 2 lần; không cần heap nên hệ số hằng nhỏ hơn Dijkstra." },
      ops: [["Toàn bộ thuật toán", "O(V+E)"], ["Đẩy / lấy ở hai đầu deque", "O(1)"], ["Bộ nhớ", "O(V)"]],
      use_case: ["Lưới có hai loại di chuyển: miễn phí (0) và tốn một đơn vị (1)", "Số lần đảo hướng cạnh / đổi hướng ít nhất để tới đích", "Thay Dijkstra khi trọng số chỉ 0/1 để thoát TLE"],
      not_for: ["Trọng số tuỳ ý không âm → Dijkstra", "Mọi cạnh trọng số 1 → BFS thường", "Có cạnh âm → Bellman-Ford / SPFA"],
      pitfalls: [
        "Đẩy nhầm đầu: cạnh trọng số 0 phải push_front, cạnh trọng số 1 phải push_back — đảo lại cho kết quả sai.",
        "Không có kiểm tra `dist[u] + w < dist[v]` (chỉ dùng mảng thăm như BFS thường): đỉnh có thể được chốt với khoảng cách sai.",
        "Trọng số khác 0/1 (ví dụ 2) làm thuật toán sai — dùng Dijkstra hoặc tách cạnh thành chuỗi cạnh trọng số 1.",
        "Đỉnh có thể nằm trong deque hai lần; không sao vì lần lấy thứ hai không còn relax được gì, nhưng đừng đếm số lần xử lý như số đỉnh.",
        "Dùng INT_MAX làm INF rồi cộng trọng số khi đỉnh chưa tới được gây tràn — chỉ relax từ đỉnh đã được lấy ra từ deque (luôn hữu hạn)."
      ],
      code: {
        lang: "cpp", title: "bfs01.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// 0-1 BFS: khoảng cách ngắn nhất từ s khi mọi cạnh có trọng số 0 hoặc 1. O(V + E).
// Đỉnh 0..n-1; g[u] = {(v, w)} với w ∈ {0, 1}. Trả về dist[v] (-1 nếu không tới được).
vector<int> bfs01(const vector<vector<pair<int, int>>>& g, int s) {
    int n = g.size();
    const int INF = INT_MAX;
    vector<int> dist(n, INF);
    deque<int> dq;
    dist[s] = 0;
    dq.push_back(s);
    while (!dq.empty()) {
        int u = dq.front();
        dq.pop_front();
        for (auto [v, w] : g[u]) {
            if (dist[u] + w < dist[v]) {
                dist[v] = dist[u] + w;
                if (w == 0) dq.push_front(v);  // cùng khoảng cách với u: xử lý ngay
                else dq.push_back(v);          // xa hơn đúng 1: xếp phía sau
            }
        }
    }
    for (int& d : dist)
        if (d == INF) d = -1;
    return dist;
}
`
      },
      example: {
        input: "4 đỉnh (0..3), cạnh có hướng (u→v, w): 0→1 (1), 0→2 (0), 2→1 (0), 1→3 (1), 2→3 (1). Nguồn 0.",
        output: "dist = 0 0 0 1",
        explain: "Đi 0→2 tốn 0, rồi 2→1 tốn 0 nên dist[1] = 0 (rẻ hơn cạnh trực tiếp 0→1 tốn 1). Tới 3 tốn tối thiểu 1 (qua 1→3 hoặc 2→3)."
      },
      problems: [
        { site: "cf", id: "1063B", name: "Labyrinth" },
        { site: "lc", name: "Minimum Cost to Make at Least One Valid Path in a Grid" }
      ],
      related: ["bfs", "dijkstra", "graph-representation"],
      compare: { "Bài toán giải": "Đường đi ngắn nhất một nguồn, trọng số chỉ 0/1", "Cạnh âm": "Không cho phép", "Hợp với đồ thị": "Thưa hay lưới; O(V+E), không cần heap", "Kết quả cho ra": "Khoảng cách tới mọi đỉnh" },
      cards: [
        { q: "0-1 BFS dùng khi nào?", a: "Đường đi ngắn nhất một nguồn với trọng số cạnh chỉ 0 hoặc 1: O(V+E), nhanh hơn Dijkstra." },
        { q: "Cạnh trọng số 0 và 1 đẩy vào đâu của deque?", a: "Trọng số 0: push_front (cùng khoảng cách); trọng số 1: push_back." },
        { q: "Vì sao tổng thời gian chỉ O(V+E)?", a: "Deque chỉ chứa đỉnh có khoảng cách tạm thuộc {D, D+1} nên mỗi đỉnh bị đẩy tối đa 2 lần, mỗi thao tác O(1)." },
        { q: "Trọng số 2 trở lên thì sao?", a: "0-1 BFS không còn đúng; dùng Dijkstra hoặc tách cạnh thành chuỗi cạnh trọng số 1 (nếu trọng số nhỏ)." }
      ]
    },
    {
      id: "dijkstra",
      name: "Dijkstra",
      aliases: ["dijkstra", "dijkstra shortest path", "đường đi ngắn nhất một nguồn", "sssp", "single source shortest path"],
      category: "graph",
      sub: "Đường đi ngắn nhất",
      level: 2,
      tags: ["graph", "shortest-path", "greedy", "priority-queue", "sssp"],
      summary: "Tìm đường đi ngắn nhất từ một đỉnh nguồn tới mọi đỉnh khác trong đồ thị có trọng số cạnh không âm.",
      description:
        "Dijkstra giữ một tập đỉnh đã \"chốt\" khoảng cách. Mỗi bước lấy đỉnh chưa chốt có khoảng cách tạm nhỏ nhất, chốt nó, rồi **relax** các cạnh đi ra: nếu đi qua đỉnh này tới láng giềng ngắn hơn thì cập nhật.\n\n" +
        "Vì trọng số không âm nên khi một đỉnh được lấy ra khỏi hàng đợi ưu tiên với khoảng cách nhỏ nhất, không thể có đường vòng nào ngắn hơn — đó là lý do thuật toán tham lam này đúng.\n\n" +
        "Cài đặt phổ biến nhất dùng `priority_queue` (bỏ qua bản ghi cũ khi lấy ra), độ phức tạp O((V+E) log V).",
      conditions: ["Mọi trọng số cạnh ≥ 0 (cạnh trọng số 0 vẫn được)", "Cần khoảng cách từ MỘT nguồn tới các đỉnh khác (nhiều nguồn: thêm nguồn ảo nối bằng cạnh 0)"],
      complexity: { time: "O((V+E) log V)", space: "O(V+E)", note: "Bản mảng không dùng heap: O(V²) — tốt hơn khi đồ thị rất dày (E ≈ V²)." },
      ops: [["Toàn bộ thuật toán (heap)", "O((V+E) log V)"], ["Toàn bộ thuật toán (mảng)", "O(V²)"], ["Mỗi lần relax thành công", "O(log V)"], ["Bộ nhớ", "O(V+E)"]],
      use_case: ["Đường đi ngắn nhất trên bản đồ, mạng, lưới có chi phí không âm", "Bước con của nhiều thuật toán: Johnson, Prim-giống-Dijkstra, k đường ngắn nhất", "Bài \"đi từ A tới B tốn ít nhất\" khi mỗi bước có chi phí khác nhau"],
      not_for: ["Có cạnh âm → Bellman-Ford hoặc SPFA", "Mọi cạnh trọng số 1 (hoặc 0/1) → BFS / 0-1 BFS nhanh hơn", "Cần khoảng cách giữa MỌI cặp đỉnh, V nhỏ → Floyd-Warshall"],
      pitfalls: [
        "Quên rằng trọng số âm làm kết quả SAI mà không báo lỗi — kiểm tra đề có cạnh âm không.",
        "Tràn số int: tổng khoảng cách có thể vượt 2·10⁹ — dùng long long cho dist và INF đủ lớn.",
        "Không bỏ qua bản ghi cũ (if (d > dist[u]) continue) làm độ phức tạp xấu đi rất nhiều.",
        "Đặt INF quá sát giá trị lớn nhất rồi cộng thêm trọng số gây tràn — dùng 4e18 và chỉ cộng khi dist[u] đã hữu hạn.",
        "Đếm số đường đi ngắn nhất cần xử lý dấu bằng (dist[u] + w == dist[v]) riêng; relax chỉ khi nhỏ hơn thật sự."
      ],
      code: {
        lang: "cpp", title: "dijkstra.cpp",
        src:
"#include <bits/stdc++.h>\nusing namespace std;\n\n" +
"// Dijkstra: khoảng cách ngắn nhất từ s tới mọi đỉnh. Trọng số cạnh phải >= 0.\n" +
"// Đỉnh đánh số 0..n-1; g[u] = danh sách (v, w). dist[v] = INF nếu không tới được.\n" +
"// par[v] = đỉnh đứng trước v trên đường ngắn nhất (-1 với nguồn và đỉnh không tới được).\n" +
"const long long INF = (long long)4e18;\n\n" +
"vector<long long> dijkstra(const vector<vector<pair<int, long long>>>& g, int s, vector<int>* par = nullptr) {\n" +
"    int n = g.size();\n" +
"    vector<long long> dist(n, INF);\n" +
"    if (par) par->assign(n, -1);\n" +
"    priority_queue<pair<long long, int>, vector<pair<long long, int>>, greater<>> pq;\n" +
"    dist[s] = 0;\n" +
"    pq.push({0, s});\n" +
"    while (!pq.empty()) {\n" +
"        auto [d, u] = pq.top();\n" +
"        pq.pop();\n" +
"        if (d > dist[u]) continue;  // bản ghi cũ: đã có đường ngắn hơn\n" +
"        for (auto [v, w] : g[u]) {\n" +
"            if (dist[u] + w < dist[v]) {\n" +
"                dist[v] = dist[u] + w;\n" +
"                if (par) (*par)[v] = u;\n" +
"                pq.push({dist[v], v});\n" +
"            }\n" +
"        }\n" +
"    }\n" +
"    return dist;\n" +
"}\n"
      },
      example: {
        input: "5 6\n1 2 2\n1 3 4\n2 3 1\n2 4 7\n3 5 3\n4 5 1\n1",
        output: "0 2 3 7 6",
        explain: "5 đỉnh, 6 cạnh vô hướng (u v w), nguồn là đỉnh 1. Đi 1→2→3 tốn 3 (ngắn hơn cạnh trực tiếp 1→3 = 4); tới đỉnh 5 qua 3 tốn 6; tới đỉnh 4 qua 5 tốn 7 (ngắn hơn đi qua 2 là 9)."
      },
      problems: [
        { site: "cses", id: "1671", name: "Shortest Routes I" },
        { site: "cses", id: "1195", name: "Flight Discount" },
        { site: "cses", id: "1202", name: "Investigation" },
        { site: "cses", id: "1196", name: "Flight Routes" },
        { site: "cf", id: "20C", name: "Dijkstra?" }
      ],
      related: ["bellman-ford", "spfa", "bfs", "bfs-01", "floyd-warshall", "prim"],
      compare: { "Bài toán giải": "Đường đi ngắn nhất từ một nguồn", "Cạnh âm": "Không cho phép", "Hợp với đồ thị": "Thưa và dày đều được (bản mảng O(V²) cho đồ thị dày)", "Kết quả cho ra": "Khoảng cách tới mọi đỉnh + cây đường đi" },
      cards: [
        { q: "Dijkstra chỉ đúng khi nào?", a: "Khi mọi cạnh có trọng số không âm. Có cạnh âm thì kết quả có thể sai." },
        { q: "Độ phức tạp của Dijkstra dùng priority_queue?", a: "O((V+E) log V) thời gian, O(V+E) bộ nhớ." },
        { q: "Vì sao phải có dòng `if (d > dist[u]) continue;`?", a: "Một đỉnh có thể được đẩy vào heap nhiều lần với khoảng cách giảm dần; bản ghi cũ phải bỏ qua để không xử lý lại, giữ độ phức tạp O((V+E) log V)." },
        { q: "Đồ thị toàn cạnh trọng số 1 thì nên dùng gì thay Dijkstra?", a: "BFS (0-1 BFS nếu có cạnh trọng số 0): O(V+E), không cần heap." }
      ],
      viz: "dijkstra"
    }
  ]);

  A.lib.add([
    {
      id: "bellman-ford",
      name: "Bellman-Ford",
      aliases: ["bellman ford", "bellmanford", "chu trình âm", "negative cycle", "cạnh âm", "đường đi ngắn nhất cạnh âm", "high score", "cycle finding"],
      category: "graph",
      sub: "Đường đi ngắn nhất",
      level: 2,
      tags: ["graph", "shortest-path", "negative-weights", "negative-cycle", "sssp"],
      summary: "Đường đi ngắn nhất từ một nguồn khi có cạnh âm, đồng thời phát hiện và lấy ra chu trình âm, trong O(V·E).",
      description:
        "Bellman-Ford dựa trên nhận xét: đường ngắn nhất (khi không có chu trình âm) có tối đa V−1 cạnh. Lặp V−1 vòng, mỗi vòng **relax mọi cạnh**; sau vòng k, `dist[v]` đã đúng cho mọi đường ngắn nhất dùng không quá k cạnh. Nếu vòng thứ V vẫn còn relax được thì đồ thị có **chu trình âm** tới được từ nguồn.\n\n" +
        "Đây là thuật toán một nguồn chịu được cạnh âm; chậm hơn Dijkstra nhưng đơn giản và biết **báo / lấy ra chu trình âm**: khởi tạo `dist = 0` cho mọi đỉnh (như một nguồn ảo nối tới tất cả), nếu vòng V còn relax thì lần theo `par` lùi V bước từ đỉnh vừa relax để chắc chắn đứng trong chu trình rồi đi một vòng để lấy nó (CSES Cycle Finding).\n\n" +
        "Một vòng không relax được gì thì dừng sớm. Muốn biết đỉnh nào có khoảng cách −∞ (tới được từ một chu trình âm) thì chạy thêm V vòng và lan cờ \"bị ảnh hưởng\" qua các cạnh. Biến thể đường đi dùng **tối đa k cạnh**: chạy đúng k vòng, mỗi vòng relax từ bản sao `dist` của vòng trước.",
      conditions: ["Đồ thị có hướng (cạnh vô hướng trọng số âm tự tạo chu trình âm)", "Trọng số tuỳ ý, kể cả âm; có thể có chu trình âm nhưng khi đó chỉ báo chứ không có khoảng cách hợp lệ"],
      complexity: { time: "O(V·E)", space: "O(V+E)", note: "Dừng sớm khi một vòng không còn relax; vẫn O(V·E) ở trường hợp xấu nhất." },
      ops: [["Toàn bộ thuật toán", "O(V·E)"], ["Một vòng relax", "O(E)"], ["Phát hiện / lấy chu trình âm", "O(V·E)"], ["Bộ nhớ", "O(V+E)"]],
      use_case: ["Đồ thị có cạnh âm, cần khoảng cách từ một nguồn", "Hỏi \"có chu trình âm không\" / in ra một chu trình âm", "Đường đi ngắn nhất dùng tối đa k cạnh (k vòng relax)", "Hệ ràng buộc hiệu x[v] − x[u] ≤ w (difference constraints)"],
      not_for: ["Trọng số không âm → Dijkstra (nhanh hơn nhiều)", "Cần khoảng cách giữa mọi cặp, V nhỏ → Floyd-Warshall", "V, E cỡ 10⁵ có cạnh âm → SPFA (thường nhanh hơn nhưng xấu nhất vẫn O(VE)) hoặc Johnson"],
      pitfalls: [
        "Relax từ đỉnh chưa tới được (dist = INF) làm \"INF + w âm\" thành giá trị giả — chỉ relax khi dist[u] hữu hạn.",
        "Cạnh vô hướng âm luôn tạo chu trình âm (u→v→u) — coi đồ thị là có hướng đúng như đề.",
        "Khi có chu trình âm, `dist` sau V vòng không còn ý nghĩa; muốn biết đỉnh nào là −∞ phải lan cờ riêng.",
        "Chỉ phát hiện chu trình âm TỚI ĐƯỢC từ nguồn; muốn tìm chu trình âm bất kỳ phải khởi tạo dist = 0 cho mọi đỉnh.",
        "Lấy chu trình: phải lùi V bước theo par từ đỉnh được relax ở vòng cuối rồi mới đi vòng, không lấy trực tiếp đỉnh đó.",
        "Quá chậm khi V·E cỡ 10⁹ — đổi sang SPFA hoặc Dijkstra với thế năng (Johnson)."
      ],
      code: {
        lang: "cpp", title: "bellman_ford.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Bellman-Ford: đường ngắn nhất từ một nguồn, CHO PHÉP cạnh âm, phát hiện / lấy ra chu trình âm. O(V * E).
// Đỉnh 0..n-1; cạnh CÓ HƯỚNG u -> v với trọng số w (cạnh vô hướng âm = chu trình âm: hãy thêm đúng hướng đề cho).
struct BellmanFord {
    static constexpr long long INF = (long long)4e18;
    struct Edge {
        int u, v;
        long long w;
    };
    int n;
    vector<Edge> edges;
    vector<long long> dist;  // dist[v] = INF nếu không tới được từ nguồn
    vector<int> par;         // par[v] = đỉnh đứng trước v trên đường ngắn nhất (-1 nếu không có)

    explicit BellmanFord(int n) : n(n) {}
    void add_edge(int u, int v, long long w) { edges.push_back({u, v, w}); }

    // Chạy từ nguồn s. Trả về false nếu có chu trình âm TỚI ĐƯỢC từ s (khi đó dist không còn ý nghĩa).
    bool run(int s) {
        dist.assign(n, INF);
        par.assign(n, -1);
        dist[s] = 0;
        for (int pass = 0; pass < n; pass++) {  // n vòng: vòng thứ n mà còn relax được => có chu trình âm
            bool changed = false;
            for (const Edge& e : edges) {
                if (dist[e.u] == INF) continue;  // u chưa tới được: không relax (tránh INF + w)
                if (dist[e.u] + e.w < dist[e.v]) {
                    dist[e.v] = dist[e.u] + e.w;
                    par[e.v] = e.u;
                    changed = true;
                }
            }
            if (!changed) return true;  // ổn định sớm
        }
        return false;
    }

    // Tìm MỘT chu trình âm bất kỳ (không cần nguồn). Trả về các đỉnh theo thứ tự đi v0 -> v1 -> ... -> v0
    // (v0 không lặp lại ở cuối); rỗng nếu không có chu trình âm.
    vector<int> find_negative_cycle() const {
        vector<long long> d(n, 0);  // như có nguồn ảo nối mọi đỉnh bằng cạnh 0
        vector<int> p(n, -1);
        int x = -1;
        for (int pass = 0; pass < n; pass++) {
            x = -1;
            for (const Edge& e : edges)
                if (d[e.u] + e.w < d[e.v]) {
                    d[e.v] = d[e.u] + e.w;
                    p[e.v] = e.u;
                    x = e.v;
                }
            if (x == -1) return {};
        }
        for (int i = 0; i < n; i++) x = p[x];  // lùi n bước: chắc chắn đã đứng trong chu trình
        vector<int> cyc;
        for (int v = x;; v = p[v]) {
            cyc.push_back(v);
            if (v == x && cyc.size() > 1) break;
        }
        cyc.pop_back();
        reverse(cyc.begin(), cyc.end());
        return cyc;
    }
};
`
      },
      example: {
        input: "4 đỉnh (0..3), cạnh có hướng (u→v, w): 0→1 (4), 0→2 (5), 1→2 (−3), 2→3 (4). Nguồn 0.",
        output: "dist = 0 4 1 5 (không có chu trình âm)",
        explain: "Tới 2 đi qua 1 tốn 4 + (−3) = 1, rẻ hơn cạnh trực tiếp 0→2 = 5; tới 3 tốn 1 + 4 = 5. Nếu thêm cạnh 3→1 (−5) thì 1→2→3→1 có tổng −3 + 4 − 5 = −4 < 0: chu trình âm, run() trả về false."
      },
      problems: [
        { site: "cses", id: "1673", name: "High Score" },
        { site: "cses", id: "1197", name: "Cycle Finding" },
        { site: "lc", name: "Cheapest Flights Within K Stops" },
        { site: "lc", name: "Network Delay Time" }
      ],
      related: ["spfa", "dijkstra", "floyd-warshall", "graph-representation"],
      compare: { "Bài toán giải": "Đường đi ngắn nhất một nguồn + phát hiện chu trình âm", "Cạnh âm": "Cho phép (báo chu trình âm tới được từ nguồn)", "Hợp với đồ thị": "Thưa hoặc nhỏ; chậm O(V·E) với đồ thị lớn", "Kết quả cho ra": "Khoảng cách tới mọi đỉnh + cây đường đi, hoặc chu trình âm" },
      cards: [
        { q: "Bellman-Ford lặp bao nhiêu vòng và vì sao?", a: "V−1 vòng relax mọi cạnh, vì đường ngắn nhất không có chu trình âm có tối đa V−1 cạnh. Vòng thứ V còn relax được ⇒ có chu trình âm." },
        { q: "Độ phức tạp của Bellman-Ford?", a: "O(V·E) thời gian, O(V+E) bộ nhớ." },
        { q: "Làm sao lấy ra một chu trình âm?", a: "Chạy với dist = 0 cho mọi đỉnh; nếu vòng V còn relax ở đỉnh x thì lùi V bước theo par để vào chu trình, rồi đi theo par cho tới khi quay lại đỉnh đó." },
        { q: "Vì sao không được relax từ đỉnh dist = INF?", a: "INF + w với w âm cho giá trị nhỏ hơn INF dù đỉnh chưa tới được, làm sai kết quả." },
        { q: "Cạnh vô hướng trọng số âm có dùng được không?", a: "Không: u→v→u đã là chu trình âm 2w < 0. Chỉ dùng cạnh có hướng." }
      ]
    },
    {
      id: "spfa",
      name: "SPFA",
      aliases: ["spfa", "shortest path faster algorithm", "bellman-ford hàng đợi", "queue based bellman ford", "anti-spfa"],
      category: "graph",
      sub: "Đường đi ngắn nhất",
      level: 2,
      tags: ["graph", "shortest-path", "negative-weights", "queue", "sssp"],
      summary: "Bellman-Ford dùng hàng đợi: chỉ relax lại các cạnh của đỉnh vừa giảm khoảng cách; thường nhanh nhưng xấu nhất vẫn O(V·E).",
      description:
        "SPFA là Bellman-Ford cải tiến bằng hàng đợi: chỉ những đỉnh có `dist` vừa giảm mới cần relax lại các cạnh đi ra. Đỉnh được đẩy vào hàng đợi nếu chưa nằm trong đó (`in_q`); khi hàng đợi rỗng thì mọi cạnh đều thoả bất đẳng thức tam giác.\n\n" +
        "Trên nhiều dữ liệu (ngẫu nhiên, hoặc \"thân thiện\") SPFA chạy nhanh hơn hẳn Bellman-Ford và chịu được cạnh âm, nhưng **trường hợp xấu nhất vẫn là O(V·E)**, và tồn tại các bộ test dựng riêng làm SPFA chạy chậm (anti-SPFA) — bài chấm có test như vậy hoặc cuộc thi có hack thì SPFA sẽ TLE. Khi trọng số không âm hãy dùng Dijkstra.\n\n" +
        "Phát hiện chu trình âm: giữ `len[v]` = số cạnh của đường đang giữ cho v; nếu `len[v] ≥ V` thì có chu trình âm tới được từ nguồn.",
      conditions: ["Có thể có cạnh âm; cần khoảng cách từ MỘT nguồn", "Chấp nhận trường hợp xấu nhất O(V·E) (không có test đối kháng) — hoặc đồ thị nhỏ"],
      complexity: { time: "O(V·E) xấu nhất", space: "O(V+E)", note: "Thực tế thường gần O(E) đến vài lần E trên dữ liệu ngẫu nhiên, nhưng không có bảo đảm; các test anti-SPFA buộc nó chạy Θ(V·E)." },
      ops: [["Xấu nhất", "O(V·E)"], ["Một lần relax thành công", "O(1)"], ["Phát hiện chu trình âm (đếm cạnh)", "O(V·E)"], ["Bộ nhớ", "O(V+E)"]],
      use_case: ["Cạnh âm, đồ thị thưa, không lo test đối kháng", "Bellman-Ford quá chậm nhưng chưa cần thuật toán có bảo đảm", "Bài đường đi ngắn nhất có cạnh âm cỡ V, E ~ 10⁵ với test ngẫu nhiên"],
      not_for: ["Trọng số không âm → Dijkstra (có bảo đảm O((V+E) log V))", "Cần bảo đảm thời gian trong trường hợp xấu nhất khi có cạnh âm → Bellman-Ford (đồ thị nhỏ) hoặc Johnson", "Cần mọi cặp, V nhỏ → Floyd-Warshall"],
      pitfalls: [
        "Test anti-SPFA làm thuật toán chạy O(V·E) — trên bài có hack hoặc test đối kháng, SPFA có thể TLE dù Dijkstra qua dễ dàng.",
        "Dùng SPFA khi mọi trọng số không âm rồi bị chậm: Dijkstra mới là lựa chọn an toàn.",
        "Quên cờ in_q làm một đỉnh nằm nhiều lần trong hàng đợi, bùng nổ độ dài hàng đợi.",
        "Không có kiểm tra chu trình âm (len ≥ V) thì với chu trình âm vòng lặp không bao giờ kết thúc.",
        "Đặt INF quá sát giá trị lớn nhất rồi cộng trọng số gây tràn — template chỉ relax từ đỉnh đã có khoảng cách hữu hạn (đỉnh nằm trong hàng đợi)."
      ],
      code: {
        lang: "cpp", title: "spfa.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// SPFA (Bellman-Ford dùng hàng đợi): đường ngắn nhất từ một nguồn, cho phép cạnh âm. XẤU NHẤT O(V * E)!
// Đỉnh 0..n-1; cạnh CÓ HƯỚNG u -> v, trọng số w. dist[v] = INF nếu không tới được; par[v] = đỉnh trước v.
struct Spfa {
    static constexpr long long INF = (long long)4e18;
    int n;
    vector<vector<pair<int, long long>>> g;
    vector<long long> dist;
    vector<int> par;

    explicit Spfa(int n) : n(n), g(n) {}
    void add_edge(int u, int v, long long w) { g[u].push_back({v, w}); }

    // Chạy từ nguồn s. Trả về false nếu có chu trình âm TỚI ĐƯỢC từ s.
    bool run(int s) {
        dist.assign(n, INF);
        par.assign(n, -1);
        vector<int> len(n, 0);  // số cạnh của đường đang giữ cho v; len[v] >= n  =>  có chu trình âm
        vector<char> in_q(n, 0);
        queue<int> q;
        dist[s] = 0;
        q.push(s);
        in_q[s] = 1;
        while (!q.empty()) {
            int u = q.front();
            q.pop();
            in_q[u] = 0;
            for (auto [v, w] : g[u]) {
                if (dist[u] + w < dist[v]) {
                    dist[v] = dist[u] + w;
                    par[v] = u;
                    len[v] = len[u] + 1;
                    if (len[v] >= n) return false;
                    if (!in_q[v]) {
                        in_q[v] = 1;
                        q.push(v);
                    }
                }
            }
        }
        return true;
    }
};
`
      },
      example: {
        input: "4 đỉnh (0..3), cạnh có hướng (u→v, w): 0→1 (2), 0→2 (5), 2→1 (−4), 1→3 (1). Nguồn 0.",
        output: "dist = 0 1 5 2 (không có chu trình âm)",
        explain: "Tới 1 đi qua 2 tốn 5 + (−4) = 1, rẻ hơn cạnh trực tiếp 0→1 = 2; tới 3 tốn 1 + 1 = 2. Thêm cạnh 3→2 (−1) thì 2→1→3→2 có tổng −4 + 1 − 1 = −4: chu trình âm, run() trả về false."
      },
      problems: [
        { site: "cses", id: "1673", name: "High Score" },
        { site: "cses", id: "1197", name: "Cycle Finding" }
      ],
      related: ["bellman-ford", "dijkstra", "floyd-warshall"],
      compare: { "Bài toán giải": "Đường đi ngắn nhất một nguồn (nhanh trong thực tế)", "Cạnh âm": "Cho phép (đếm số cạnh để phát hiện chu trình âm)", "Hợp với đồ thị": "Thưa; trung bình rất nhanh nhưng xấu nhất O(V·E), dễ bị test anti-SPFA", "Kết quả cho ra": "Khoảng cách tới mọi đỉnh + cây đường đi, hoặc báo chu trình âm" },
      cards: [
        { q: "SPFA khác Bellman-Ford ở điểm nào?", a: "Chỉ relax lại các cạnh đi ra của đỉnh vừa được giảm khoảng cách (dùng hàng đợi + cờ in_q), thay vì relax mọi cạnh mỗi vòng." },
        { q: "Độ phức tạp xấu nhất của SPFA?", a: "O(V·E), như Bellman-Ford; có các test anti-SPFA dựng riêng để đạt tới mức đó." },
        { q: "Phát hiện chu trình âm bằng SPFA thế nào?", a: "Lưu len[v] = số cạnh của đường đang giữ; len[v] ≥ V nghĩa là có chu trình âm tới được từ nguồn." },
        { q: "Trọng số không âm thì dùng SPFA hay Dijkstra?", a: "Dijkstra: có bảo đảm O((V+E) log V), không bị test anti-SPFA." }
      ]
    },
    {
      id: "floyd-warshall",
      name: "Floyd-Warshall",
      aliases: ["floyd warshall", "floyd", "mọi cặp đỉnh", "all pairs shortest path", "apsp", "bao đóng bắc cầu", "transitive closure"],
      category: "graph",
      sub: "Đường đi ngắn nhất",
      level: 2,
      tags: ["graph", "shortest-path", "all-pairs", "dp", "negative-weights"],
      summary: "Khoảng cách ngắn nhất giữa MỌI cặp đỉnh bằng quy hoạch động ba vòng lặp, O(V³), chịu cạnh âm và phát hiện chu trình âm.",
      description:
        "Floyd-Warshall tính khoảng cách giữa **mọi cặp đỉnh** bằng quy hoạch động. Gọi `d_k[i][j]` là độ dài đường ngắn nhất từ i tới j chỉ dùng các đỉnh trung gian trong {0..k−1}. Thêm đỉnh k: `d[i][j] = min(d[i][j], d[i][k] + d[k][j])`. Có thể ghi đè trên cùng một ma trận, nhưng **vòng k phải là vòng ngoài cùng**.\n\n" +
        "Chịu được cạnh âm. Đồ thị có chu trình âm khi và chỉ khi sau khi chạy có `d[i][i] < 0` với một i nào đó (khi đó các giá trị khác có thể bị kéo xuống rất sâu, nên chặn dưới để tránh tràn). Để dựng đường đi, lưu `nxt[i][j]` = đỉnh đứng ngay sau i trên đường ngắn nhất tới j.\n\n" +
        "Với V cỡ 400–500 thì V³ ≈ 10⁸ chạy trong khoảng một giây. Cùng khung đó làm được **bao đóng bắc cầu** (có đi được từ i tới j không): thay min/+ bằng OR/AND, kết hợp bitset giảm 64 lần.",
      conditions: ["V nhỏ (thường V ≤ 400–500)", "Không có chu trình âm nếu muốn khoảng cách hợp lệ (có thể phát hiện bằng d[i][i] < 0)"],
      complexity: { time: "O(V³)", space: "O(V²)", note: "Bao đóng bắc cầu với bitset: O(V³/64)." },
      ops: [["Toàn bộ thuật toán", "O(V³)"], ["Hỏi khoảng cách một cặp (sau khi chạy)", "O(1)"], ["Dựng một đường đi", "O(độ dài đường đi)"], ["Bộ nhớ", "O(V²)"]],
      use_case: ["Nhiều truy vấn khoảng cách giữa các cặp đỉnh trên đồ thị nhỏ", "Đồ thị có cạnh âm (không có chu trình âm), cần mọi cặp", "Bao đóng bắc cầu / tính đường kính đồ thị nhỏ", "Phát hiện chu trình âm bất kỳ trên đồ thị nhỏ"],
      not_for: ["V ≥ vài nghìn → V³ quá lớn; một nguồn thì Dijkstra / Bellman-Ford", "Chỉ cần một nguồn hoặc ít nguồn → Dijkstra (chạy V lần Dijkstra có thể nhanh hơn với đồ thị thưa)", "Đồ thị không trọng số → BFS từ từng đỉnh"],
      pitfalls: [
        "Đặt vòng k không phải vòng ngoài cùng (i, k, j hoặc i, j, k) cho kết quả SAI mà vẫn chạy.",
        "Cộng INF + INF tràn số: bỏ qua khi d[i][k] hoặc d[k][j] là INF (template đã kiểm tra).",
        "Quên d[i][i] = 0 ban đầu, hoặc quên lấy min khi có cạnh song song.",
        "Có chu trình âm: giá trị có thể giảm theo cấp số nhân và tràn long long — template chặn dưới ở −INF; vẫn không được tin các số đó, chỉ dùng d[i][i] < 0 để báo.",
        "Dùng int với INF = 1e9 rồi cộng hai INF (2e9) có thể tràn; dùng long long hoặc kiểm tra INF trước khi cộng.",
        "Dựng đường đi bằng nxt khi có chu trình âm sẽ lặp vô hạn — kiểm tra has_negative_cycle() trước."
      ],
      code: {
        lang: "cpp", title: "floyd_warshall.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Floyd-Warshall: khoảng cách ngắn nhất giữa MỌI cặp đỉnh. O(V^3) thời gian, O(V^2) bộ nhớ. Đỉnh 0..n-1.
// Chịu cạnh âm; có chu trình âm <=> sau run() tồn tại d[i][i] < 0.
struct FloydWarshall {
    static constexpr long long INF = (long long)4e18;
    int n;
    vector<vector<long long>> d;  // d[i][j] = khoảng cách ngắn nhất i -> j (INF nếu không tới được)
    vector<vector<int>> nxt;      // nxt[i][j] = đỉnh đứng ngay sau i trên đường ngắn nhất tới j (-1 nếu không có)

    explicit FloydWarshall(int n) : n(n), d(n, vector<long long>(n, INF)), nxt(n, vector<int>(n, -1)) {
        for (int i = 0; i < n; i++) {
            d[i][i] = 0;
            nxt[i][i] = i;
        }
    }

    // Cạnh CÓ HƯỚNG u -> v (cạnh vô hướng: gọi hai lần); cạnh song song lấy cạnh nhẹ nhất.
    void add_edge(int u, int v, long long w) {
        if (w < d[u][v]) {
            d[u][v] = w;
            nxt[u][v] = v;
        }
    }

    void run() {
        for (int k = 0; k < n; k++)  // k PHẢI là vòng ngoài cùng
            for (int i = 0; i < n; i++) {
                if (d[i][k] == INF) continue;
                for (int j = 0; j < n; j++) {
                    if (d[k][j] == INF) continue;
                    long long nd = max(d[i][k] + d[k][j], -INF);  // chặn dưới: tránh tràn khi có chu trình âm
                    if (nd < d[i][j]) {
                        d[i][j] = nd;
                        nxt[i][j] = nxt[i][k];
                    }
                }
            }
    }

    bool has_negative_cycle() const {
        for (int i = 0; i < n; i++)
            if (d[i][i] < 0) return true;
        return false;
    }

    // Đường đi i -> j gồm cả hai đầu; rỗng nếu không tới được. CHỈ dùng khi không có chu trình âm.
    vector<int> path(int i, int j) const {
        vector<int> p;
        if (d[i][j] == INF) return p;
        for (int u = i; u != j; u = nxt[u][j]) p.push_back(u);
        p.push_back(j);
        return p;
    }
};
`
      },
      example: {
        input: "4 đỉnh (0..3), cạnh có hướng (u→v, w): 0→1 (3), 1→2 (−1), 2→3 (2), 0→3 (7)",
        output: "d[0] = 0 3 2 4\nd[1] = INF 0 -1 1\nđường đi 0 → 3: 0 1 2 3",
        explain: "d[0][3] = min(7, 3 + (−1) + 2) = 4, rẻ hơn cạnh trực tiếp 7. Từ 1 không về được 0 nên d[1][0] = INF. Không có d[i][i] < 0 nên không có chu trình âm."
      },
      problems: [
        { site: "cses", id: "1672", name: "Shortest Routes II" },
        { site: "cf", id: "25C", name: "Roads in Berland" },
        { site: "cf", id: "295B", name: "Greg and Graph" },
        { site: "lc", name: "Find the City With the Smallest Number of Neighbors at a Threshold Distance" }
      ],
      related: ["dijkstra", "bellman-ford", "spfa", "graph-representation"],
      compare: { "Bài toán giải": "Đường đi ngắn nhất giữa MỌI cặp đỉnh", "Cạnh âm": "Cho phép (báo chu trình âm bằng d[i][i] < 0)", "Hợp với đồ thị": "V nhỏ (≤ ~500), thường đồ thị dày; O(V³)", "Kết quả cho ra": "Ma trận khoảng cách V×V (+ đường đi qua nxt)" },
      cards: [
        { q: "Thứ tự ba vòng lặp của Floyd-Warshall?", a: "k ngoài cùng, rồi i, j: d[i][j] = min(d[i][j], d[i][k] + d[k][j]). Đặt k không phải vòng ngoài là sai." },
        { q: "Độ phức tạp?", a: "O(V³) thời gian, O(V²) bộ nhớ; dùng được khi V ≲ 500." },
        { q: "Phát hiện chu trình âm bằng Floyd-Warshall?", a: "Sau khi chạy, tồn tại đỉnh i có d[i][i] < 0." },
        { q: "Làm sao dựng đường đi?", a: "Lưu nxt[i][j] = nxt[i][k] mỗi khi cập nhật d[i][j] qua k; từ i lần theo nxt[u][j] tới j." },
        { q: "Bao đóng bắc cầu làm thế nào cho nhanh?", a: "Cùng khung ba vòng lặp nhưng dùng OR: nếu reach[i][k] thì reach[i] |= reach[k] với bitset, O(V³/64)." }
      ]
    },
    {
      id: "topological-sort",
      name: "Sắp xếp topo",
      aliases: ["topological sort", "topo sort", "kahn", "thuật toán kahn", "sắp xếp tô pô", "dag", "thứ tự topo", "course schedule"],
      category: "graph",
      sub: "Thứ tự & liên thông",
      level: 2,
      tags: ["graph", "dag", "topological-sort", "ordering", "cycle-detection"],
      summary: "Xếp các đỉnh của đồ thị có hướng không chu trình thành dãy sao cho mọi cạnh u→v có u đứng trước v; phát hiện chu trình bằng Kahn.",
      description:
        "Sắp xếp topo xếp các đỉnh của **DAG** (đồ thị có hướng không chu trình) thành một dãy sao cho mọi cạnh u→v có u đứng trước v. Thứ tự này tồn tại khi và chỉ khi đồ thị không có chu trình.\n\n" +
        "**Thuật toán Kahn**: tính bậc vào; đẩy mọi đỉnh bậc vào 0 vào hàng đợi; lấy đỉnh u ra, ghi vào kết quả, giảm bậc vào của mọi v kề (u→v), v về 0 thì đẩy vào hàng đợi. Nếu kết quả ít hơn V đỉnh thì còn chu trình. Thay hàng đợi bằng min-heap để được thứ tự topo **nhỏ nhất theo từ điển**.\n\n" +
        "Cách khác: DFS rồi đảo ngược thứ tự thoát. Trên DAG, thứ tự topo là xương sống của quy hoạch động (đường dài nhất, đếm số đường đi, ngày học sớm nhất…): xử lý đỉnh theo thứ tự topo thì mọi đỉnh tiền nhiệm đã được tính xong.",
      conditions: ["Đồ thị có hướng; có chu trình thì không tồn tại thứ tự (thuật toán báo false)", "Cạnh song song được đếm đủ trong bậc vào (mỗi cạnh một lần)"],
      complexity: { time: "O(V+E)", space: "O(V)", note: "Bản min-heap (thứ tự nhỏ nhất theo từ điển): O((V+E) log V)." },
      ops: [["Kahn (hàng đợi)", "O(V+E)"], ["Kahn với min-heap", "O((V+E) log V)"], ["Bộ nhớ (bậc vào, hàng đợi)", "O(V)"]],
      use_case: ["Thứ tự học môn / thứ tự biên dịch với ràng buộc \"a trước b\"", "Phát hiện chu trình trong đồ thị có hướng", "Quy hoạch động trên DAG: đường dài nhất, đếm đường đi", "Thứ tự topo nhỏ nhất theo từ điển (min-heap)"],
      not_for: ["Đồ thị có chu trình cần gộp thành thành phần → SCC rồi topo trên đồ thị cô đặc", "Đồ thị vô hướng (không có khái niệm thứ tự topo)", "Cần đường đi ngắn nhất có trọng số → Dijkstra (hoặc DP topo nếu là DAG)"],
      pitfalls: [
        "Quên kiểm tra order.size() == V: nếu thiếu đỉnh nghĩa là có chu trình, kết quả không hợp lệ.",
        "Thứ tự topo không duy nhất — đề hỏi \"một thứ tự\" thì bất kỳ, hỏi \"nhỏ nhất theo từ điển\" thì phải dùng min-heap.",
        "\"Dãy topo nhỏ nhất theo từ điển\" khác với \"gán nhãn nhỏ nhất cho đỉnh 1, rồi đỉnh 2…\" — bài gán nhãn thường giải bằng topo ngược với max-heap.",
        "Đếm sai bậc vào khi đồ thị có cạnh song song (phải cộng mỗi cạnh một lần và trừ tương ứng).",
        "Cài DFS đệ quy với V lớn rồi tràn ngăn xếp — Kahn dùng vòng lặp nên an toàn."
      ],
      code: {
        lang: "cpp", title: "topo_sort.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Sắp xếp topo bằng Kahn. Đỉnh 0..n-1; g[u] = danh sách đỉnh kề (cạnh u -> v), cạnh song song được phép.
// Trả về true nếu là DAG và order là một thứ tự topo (u đứng trước v với mọi cạnh u -> v).
// Trả về false nếu có chu trình (order chỉ chứa các đỉnh xử lý được trước khi kẹt).
// smallest = true: dùng min-heap để lấy thứ tự topo NHỎ NHẤT theo từ điển, O((V + E) log V).
bool topo_sort(const vector<vector<int>>& g, vector<int>& order, bool smallest = false) {
    int n = g.size();
    vector<int> indeg(n, 0);
    for (int u = 0; u < n; u++)
        for (int v : g[u]) indeg[v]++;
    queue<int> q;
    priority_queue<int, vector<int>, greater<int>> pq;
    auto push = [&](int v) {
        if (smallest) pq.push(v);
        else q.push(v);
    };
    for (int v = 0; v < n; v++)
        if (indeg[v] == 0) push(v);
    order.clear();
    while (smallest ? !pq.empty() : !q.empty()) {
        int u;
        if (smallest) {
            u = pq.top();
            pq.pop();
        } else {
            u = q.front();
            q.pop();
        }
        order.push_back(u);
        for (int v : g[u])
            if (--indeg[v] == 0) push(v);
    }
    return (int)order.size() == n;
}
`
      },
      example: {
        input: "6 đỉnh (0..5), cạnh có hướng: 5→2, 5→0, 4→0, 4→1, 2→3, 3→1; smallest = true",
        output: "true; order = 4 5 0 2 3 1",
        explain: "Bậc vào ban đầu = 0 chỉ có đỉnh 4 và 5; lấy 4 (nhỏ nhất), rồi 5 giải phóng 0 và 2; lấy 0, rồi 2 giải phóng 3, rồi 3 giải phóng 1. Thêm cạnh 1→5 sẽ tạo chu trình 5→2→3→1→5 và hàm trả về false."
      },
      problems: [
        { site: "cses", id: "1679", name: "Course Schedule" },
        { site: "cses", id: "1680", name: "Longest Flight Route" },
        { site: "cses", id: "1681", name: "Game Routes" },
        { site: "cses", id: "1757", name: "Course Schedule II" },
        { site: "cf", id: "1385E", name: "Directing Edges" },
        { site: "lc", name: "Course Schedule II" }
      ],
      related: ["dfs", "scc", "bfs", "graph-representation"],
      compare: { "Bài toán giải": "Thứ tự tuyến tính các đỉnh của DAG / phát hiện chu trình", "Cạnh âm": "Không áp dụng (không dùng trọng số)", "Hợp với đồ thị": "Chỉ đồ thị có hướng không chu trình; O(V+E)", "Kết quả cho ra": "Một thứ tự topo (hoặc báo có chu trình)" },
      cards: [
        { q: "Sắp xếp topo tồn tại khi nào?", a: "Khi và chỉ khi đồ thị có hướng không có chu trình (DAG)." },
        { q: "Thuật toán Kahn hoạt động thế nào?", a: "Đẩy các đỉnh bậc vào 0 vào hàng đợi; lấy ra, giảm bậc vào các đỉnh kề, đỉnh nào về 0 thì đẩy vào. Kết quả ít hơn V đỉnh ⇒ có chu trình." },
        { q: "Muốn thứ tự topo nhỏ nhất theo từ điển thì làm gì?", a: "Thay hàng đợi bằng min-heap: O((V+E) log V)." },
        { q: "Độ phức tạp của Kahn?", a: "O(V+E) thời gian, O(V) bộ nhớ." }
      ]
    }
  ]);

  A.lib.add([
    {
      id: "kruskal",
      name: "MST — Kruskal",
      aliases: ["kruskal", "minimum spanning tree", "cây khung nhỏ nhất", "cây khung tối thiểu", "mst", "rừng khung nhỏ nhất", "road reparation"],
      category: "graph",
      sub: "Cây khung nhỏ nhất",
      level: 2,
      tags: ["graph", "mst", "greedy", "dsu", "spanning-tree"],
      summary: "Cây khung nhỏ nhất bằng cách sắp xếp cạnh theo trọng số và nhận cạnh nào nối hai thành phần khác nhau (kiểm bằng DSU), O(E log E).",
      description:
        "Kruskal xây cây khung nhỏ nhất (MST) bằng tham lam trên cạnh: sắp xếp cạnh theo trọng số tăng dần, duyệt lần lượt và **nhận** cạnh nếu nó nối hai thành phần khác nhau (kiểm bằng **DSU**), bỏ nếu nó tạo chu trình. Đúng nhờ tính chất lát cắt: cạnh nhẹ nhất đi qua một lát cắt luôn thuộc một MST nào đó.\n\n" +
        "Đồ thị không liên thông thì thuật toán cho **rừng khung nhỏ nhất** (một cây cho mỗi thành phần); số cạnh nhận = V − số thành phần. Trọng số âm không ảnh hưởng. Khi nhiều cạnh cùng trọng số, MST có thể không duy nhất nhưng tổng trọng số là duy nhất.\n\n" +
        "Template gói sẵn DSU (nén đường đi + gộp theo kích thước), không phụ thuộc mục khác. Kruskal hợp khi đồ thị cho dưới dạng danh sách cạnh và thưa; với đồ thị rất dày, Prim bản mảng O(V²) thường tốt hơn.",
      conditions: ["Đồ thị VÔ HƯỚNG có trọng số (âm cũng được)", "Cần cây khung nhỏ nhất, hoặc rừng khung nhỏ nhất nếu không liên thông"],
      complexity: { time: "O(E log E)", space: "O(V+E)", note: "Thời gian chủ yếu là sắp xếp cạnh; DSU gần như O(α(V)) mỗi thao tác." },
      ops: [["Sắp xếp cạnh", "O(E log E)"], ["Mỗi lần gộp / tìm DSU", "O(α(V))"], ["Toàn bộ thuật toán", "O(E log E)"], ["Bộ nhớ", "O(V+E)"]],
      use_case: ["Nối mọi nút của mạng với tổng chi phí nhỏ nhất (đường, cáp, ống nước)", "Đồ thị cho dưới dạng danh sách cạnh, E vừa phải", "Bài hỏi tổng trọng số MST hoặc cạnh nào thuộc MST", "Phân cụm đơn liên kết: dừng khi còn k thành phần"],
      not_for: ["Đồ thị rất dày với V nhỏ → Prim bản mảng O(V²) (không cần sắp xếp cạnh)", "Đồ thị CÓ HƯỚNG (cây có hướng tối thiểu là bài khác — Chu–Liu/Edmonds)", "Đường đi ngắn nhất giữa hai đỉnh → Dijkstra (cây khung nhỏ nhất không bảo toàn đường ngắn nhất)"],
      pitfalls: [
        "Nhầm MST với cây đường đi ngắn nhất: tổng nhỏ nhất của cây KHÔNG có nghĩa là đường đi trong cây là ngắn nhất.",
        "Quên đồ thị có thể không liên thông: số cạnh nhận ít hơn V−1 nghĩa là chỉ có rừng — kiểm tra `components`.",
        "Tổng trọng số vượt int32 (V·w lớn): dùng long long.",
        "Sắp xếp cạnh bằng so sánh dùng trừ (a.w - b.w) trên int bị tràn — dùng `<` trực tiếp.",
        "DSU không nén đường đi / không gộp theo kích thước làm chậm nặng ở dữ liệu xấu.",
        "Đề cần MST duy nhất hoặc đếm số MST: sắp xếp theo trọng số rồi xử lý các nhóm cạnh cùng trọng số riêng, không dùng thứ tự tuỳ ý."
      ],
      code: {
        lang: "cpp", title: "kruskal.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Kruskal: cây khung nhỏ nhất (MST) bằng sắp xếp cạnh + DSU. O(E log E).
// Đỉnh 0..n-1; cạnh VÔ HƯỚNG (u, v, w), w có thể âm.
// Đồ thị không liên thông => trả về RỪNG khung nhỏ nhất (components > 1, số cạnh nhận = n - components).
struct Kruskal {
    struct Edge {
        int u, v;
        long long w;
    };
    int n;
    vector<Edge> edges;

    explicit Kruskal(int n) : n(n) {}
    void add_edge(int u, int v, long long w) { edges.push_back({u, v, w}); }

    // Trả về tổng trọng số. picked (tuỳ chọn) = chỉ số các cạnh được nhận (theo thứ tự add_edge);
    // components (tuỳ chọn) = số thành phần liên thông của đồ thị.
    long long run(vector<int>* picked = nullptr, int* components = nullptr) const {
        vector<int> id(edges.size());
        iota(id.begin(), id.end(), 0);
        sort(id.begin(), id.end(), [&](int a, int b) { return edges[a].w < edges[b].w; });
        // DSU gói sẵn: nén đường đi (path halving) + gộp theo kích thước
        vector<int> parent(n), sz(n, 1);
        iota(parent.begin(), parent.end(), 0);
        auto find = [&](int x) {
            while (parent[x] != x) {
                parent[x] = parent[parent[x]];
                x = parent[x];
            }
            return x;
        };
        long long total = 0;
        int comps = n;
        if (picked) picked->clear();
        for (int i : id) {
            int a = find(edges[i].u), b = find(edges[i].v);
            if (a == b) continue;  // cùng thành phần: nhận cạnh này sẽ tạo chu trình
            if (sz[a] < sz[b]) swap(a, b);
            parent[b] = a;
            sz[a] += sz[b];
            total += edges[i].w;
            comps--;
            if (picked) picked->push_back(i);
        }
        if (components) *components = comps;
        return total;
    }
};
`
      },
      example: {
        input: "4 đỉnh (0..3), cạnh vô hướng (u-v, w) theo thứ tự nhập: 0-1 (1), 1-2 (2), 0-2 (3), 2-3 (4), 1-3 (5)",
        output: "tổng = 7; cạnh được nhận (chỉ số): 0, 1, 3; components = 1",
        explain: "Sắp theo trọng số: 1, 2, 3, 4, 5. Nhận 0-1 và 1-2; cạnh 0-2 (3) bỏ vì 0 và 2 đã cùng thành phần; nhận 2-3 (4); cạnh 1-3 (5) bỏ. Tổng 1 + 2 + 4 = 7."
      },
      problems: [
        { site: "cses", id: "1675", name: "Road Reparation" },
        { site: "cf", id: "609E", name: "Minimum spanning tree for each edge" },
        { site: "cf", id: "160D", name: "Edges in MST" },
        { site: "lc", name: "Min Cost to Connect All Points" },
        { site: "lc", name: "Find Critical and Pseudo-Critical Edges in Minimum Spanning Tree" }
      ],
      related: ["prim", "dsu", "graph-representation"],
      compare: { "Bài toán giải": "Cây (rừng) khung nhỏ nhất", "Cạnh âm": "Cho phép (không ảnh hưởng MST)", "Hợp với đồ thị": "Thưa, cho dưới dạng danh sách cạnh; O(E log E)", "Kết quả cho ra": "Tập cạnh MST + tổng trọng số (hoặc rừng khung)" },
      cards: [
        { q: "Kruskal chọn cạnh theo nguyên tắc nào?", a: "Duyệt cạnh theo trọng số tăng dần, nhận cạnh nếu nó nối hai thành phần khác nhau (DSU), bỏ nếu tạo chu trình." },
        { q: "Độ phức tạp của Kruskal?", a: "O(E log E) vì sắp xếp cạnh, DSU gần như hằng số; O(V+E) bộ nhớ." },
        { q: "Đồ thị không liên thông thì Kruskal trả về gì?", a: "Rừng khung nhỏ nhất: một MST cho mỗi thành phần, số cạnh nhận = V − số thành phần." },
        { q: "Kruskal có dùng được với trọng số âm không?", a: "Có: MST chỉ phụ thuộc thứ tự trọng số của các cạnh, không bị trọng số âm làm sai." },
        { q: "Kruskal hay Prim cho đồ thị rất dày?", a: "Prim bản mảng O(V²): không cần liệt kê và sắp xếp E ≈ V² cạnh." }
      ]
    },
    {
      id: "prim",
      name: "MST — Prim",
      aliases: ["prim", "jarnik", "prim mst", "cây khung nhỏ nhất prim", "minimum spanning tree prim"],
      category: "graph",
      sub: "Cây khung nhỏ nhất",
      level: 2,
      tags: ["graph", "mst", "greedy", "priority-queue", "spanning-tree"],
      summary: "Cây khung nhỏ nhất bằng cách lớn dần một cây từ một đỉnh, luôn nối thêm đỉnh có cạnh nhẹ nhất tới cây; O(E log V) với heap.",
      description:
        "Prim lớn dần một cây từ đỉnh xuất phát: mỗi bước nối vào cây đỉnh ngoài cây có **cạnh nhẹ nhất** tới cây hiện tại (đúng theo tính chất lát cắt). Dùng hàng đợi ưu tiên chứa (trọng số cạnh nối, đỉnh) và bỏ qua bản ghi cũ khi lấy ra — gần giống Dijkstra nhưng khoá là trọng số **một cạnh**, không phải tổng độ dài đường đi.\n\n" +
        "Thời gian O(E log V) với heap. Với đồ thị **dày** (E ≈ V²) bản mảng không dùng heap — mỗi bước duyệt V đỉnh tìm `key` nhỏ nhất — chạy O(V²), không cần danh sách cạnh hay sắp xếp: hợp với bài \"đồ thị đầy đủ theo toạ độ\".\n\n" +
        "Prim chỉ phủ thành phần liên thông chứa đỉnh xuất phát (`reached` cho biết số đỉnh được nối); muốn rừng khung nhỏ nhất thì gọi lại từ mỗi thành phần.",
      conditions: ["Đồ thị VÔ HƯỚNG có trọng số (âm cũng được)", "Cần MST của thành phần chứa một đỉnh xuất phát (đồ thị thường được đảm bảo liên thông)"],
      complexity: { time: "O(E log V)", space: "O(V+E)", note: "Bản mảng không heap: O(V²) — tốt hơn khi E ≈ V²." },
      ops: [["Toàn bộ thuật toán (heap)", "O(E log V)"], ["Toàn bộ thuật toán (mảng)", "O(V²)"], ["Bộ nhớ", "O(V+E)"]],
      use_case: ["Đồ thị dày hoặc đầy đủ (khoảng cách giữa mọi cặp điểm) → bản mảng O(V²)", "Đồ thị cho dưới dạng danh sách kề", "MST khi đã có sẵn cấu trúc kề cho các thuật toán khác"],
      not_for: ["Đồ thị thưa, cho dưới dạng danh sách cạnh → Kruskal gọn hơn", "Đồ thị có hướng (cây có hướng tối thiểu là bài khác)", "Cần đường đi ngắn nhất → Dijkstra"],
      pitfalls: [
        "Nhầm Prim với Dijkstra: khoá heap là trọng số cạnh nối vào cây, không cộng dồn khoảng cách từ nguồn.",
        "Đồ thị không liên thông: Prim chỉ trả MST của thành phần chứa đỉnh xuất phát — kiểm tra reached == n.",
        "Không bỏ qua bản ghi cũ trong heap (kiểm tra in_tree khi lấy ra) làm cộng một đỉnh nhiều lần.",
        "Tổng trọng số vượt int32: dùng long long; khoá ban đầu INF phải lớn hơn mọi trọng số.",
        "Đồ thị dày V = 5000+ dùng danh sách kề + heap: E ≈ V²/2 ≈ 10⁷ cạnh, dễ hết bộ nhớ — dùng bản mảng O(V²) với toạ độ thay vì lưu cạnh."
      ],
      code: {
        lang: "cpp", title: "prim.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Prim (heap): MST của thành phần liên thông chứa đỉnh s. O(E log V).
// Đỉnh 0..n-1; cạnh VÔ HƯỚNG (u, v, w), w có thể âm; cạnh song song và vòng tự trỏ được phép.
struct Prim {
    static constexpr long long INF = (long long)4e18;
    int n;
    vector<vector<pair<int, long long>>> g;
    vector<int> par;  // par[v] = đỉnh nối v vào cây (-1 với s và đỉnh không được nối)
    int reached = 0;  // số đỉnh được nối vào cây; reached < n => đồ thị không liên thông

    explicit Prim(int n) : n(n), g(n) {}
    void add_edge(int u, int v, long long w) {
        g[u].push_back({v, w});
        g[v].push_back({u, w});
    }

    // Trả về tổng trọng số cây khung của thành phần chứa s.
    long long run(int s = 0) {
        vector<long long> key(n, INF);  // key[v] = cạnh nhẹ nhất nối v vào cây hiện tại
        vector<char> in_tree(n, 0);
        par.assign(n, -1);
        reached = 0;
        priority_queue<pair<long long, int>, vector<pair<long long, int>>, greater<>> pq;
        key[s] = 0;
        pq.push({0, s});
        long long total = 0;
        while (!pq.empty()) {
            auto [k, u] = pq.top();
            pq.pop();
            if (in_tree[u]) continue;  // bản ghi cũ
            in_tree[u] = 1;
            total += k;
            reached++;
            for (auto [v, w] : g[u])
                if (!in_tree[v] && w < key[v]) {
                    key[v] = w;
                    par[v] = u;
                    pq.push({w, v});
                }
        }
        return total;
    }
};
`
      },
      example: {
        input: "4 đỉnh (0..3), cạnh vô hướng (u-v, w): 0-1 (1), 1-2 (2), 0-2 (3), 2-3 (4), 1-3 (5). Bắt đầu từ đỉnh 0.",
        output: "tổng = 7; reached = 4",
        explain: "Từ {0}: cạnh nhẹ nhất ra ngoài là 0-1 (1). Từ {0,1}: 1-2 (2) nhẹ hơn 0-2 (3) và 1-3 (5), nhận 1-2. Từ {0,1,2}: 2-3 (4) nhẹ hơn 1-3 (5), nhận 2-3. Tổng 1 + 2 + 4 = 7, trùng với Kruskal."
      },
      problems: [
        { site: "cses", id: "1675", name: "Road Reparation" },
        { site: "lc", name: "Min Cost to Connect All Points" }
      ],
      related: ["kruskal", "dijkstra", "graph-representation"],
      compare: { "Bài toán giải": "Cây khung nhỏ nhất của thành phần chứa đỉnh xuất phát", "Cạnh âm": "Cho phép (không ảnh hưởng MST)", "Hợp với đồ thị": "Dày (bản mảng O(V²)) hoặc cho dạng danh sách kề; O(E log V) với heap", "Kết quả cho ra": "Cây khung (par[]) + tổng trọng số" },
      cards: [
        { q: "Prim chọn đỉnh tiếp theo thế nào?", a: "Lấy đỉnh ngoài cây có cạnh nhẹ nhất nối tới cây hiện tại (khoá = trọng số một cạnh, không cộng dồn)." },
        { q: "Độ phức tạp của Prim?", a: "O(E log V) với heap; bản mảng O(V²) tốt hơn cho đồ thị dày." },
        { q: "Prim khác Dijkstra ở đâu?", a: "Dijkstra dùng khoá = tổng độ dài đường từ nguồn; Prim dùng khoá = trọng số cạnh nối vào cây." },
        { q: "Đồ thị không liên thông thì Prim cho gì?", a: "Chỉ MST của thành phần chứa đỉnh xuất phát; kiểm tra số đỉnh được nối (reached) so với V." }
      ]
    },
    {
      id: "scc",
      name: "Thành phần liên thông mạnh (SCC)",
      aliases: ["scc", "strongly connected components", "tarjan", "kosaraju", "thành phần liên thông mạnh", "đồ thị cô đặc", "condensation", "planets and kingdoms"],
      category: "graph",
      sub: "Thứ tự & liên thông",
      level: 3,
      tags: ["graph", "scc", "tarjan", "dfs", "condensation"],
      summary: "Chia đồ thị có hướng thành các thành phần liên thông mạnh (đi lại được hai chiều) bằng Tarjan trong O(V+E), kèm đồ thị cô đặc dạng DAG.",
      description:
        "Hai đỉnh thuộc cùng **thành phần liên thông mạnh** (SCC) nếu đi được từ đỉnh này sang đỉnh kia và ngược lại. Các SCC chia tập đỉnh thành các lớp; gộp mỗi SCC thành một đỉnh ta được **đồ thị cô đặc** (condensation) — luôn là một DAG, nên có thể sắp xếp topo và quy hoạch động trên đó.\n\n" +
        "Template dùng **Tarjan**: một lượt DFS giữ `tin` và `low` (tin nhỏ nhất đạt tới qua cạnh cây cùng tối đa một cạnh quay về đỉnh còn trên ngăn xếp). Đỉnh u có `low[u] == tin[u]` là gốc của một SCC: lấy các đỉnh trên ngăn xếp tới u ra làm một SCC. Các SCC được tìm theo thứ tự topo ngược của đồ thị cô đặc (SCC \"chìm\" trước), nên mọi cạnh u→v nối hai SCC khác nhau đều có `comp[u] > comp[v]`.\n\n" +
        "Kosaraju (hai lượt DFS, lượt hai trên đồ thị đảo) cho cùng phân hoạch; số thứ tự SCC của nó theo thứ tự topo xuôi. Template cài bằng vòng lặp, không đệ quy nên chịu V tới 10⁶.",
      conditions: ["Đồ thị CÓ HƯỚNG (đồ thị vô hướng: dùng DSU / DFS để lấy thành phần liên thông)", "Chỉ cần quan hệ đi tới được; trọng số cạnh không dùng"],
      complexity: { time: "O(V+E)", space: "O(V+E)", note: "Đồ thị cô đặc dựng thêm O(V+E) (cộng sắp xếp để bỏ cạnh trùng)." },
      ops: [["Tìm mọi SCC (Tarjan)", "O(V+E)"], ["Dựng đồ thị cô đặc", "O(E log E)"], ["Bộ nhớ", "O(V+E)"]],
      use_case: ["Hỏi mọi cặp đỉnh có đi lại được hai chiều không; đếm / gán nhãn \"vương quốc\"", "Quy hoạch động trên đồ thị có chu trình: cô đặc rồi DP theo thứ tự topo", "Thêm ít cạnh nhất để đồ thị liên thông mạnh (đếm nguồn/đích của đồ thị cô đặc)", "Nền của 2-SAT"],
      not_for: ["Đồ thị vô hướng → DSU hoặc DFS (SCC không có ý nghĩa thêm)", "Chỉ cần biết có chu trình hay không → DFS/Kahn đơn giản hơn", "Cầu / khớp trong đồ thị vô hướng → thuật toán cầu & khớp"],
      pitfalls: [
        "Dùng DFS đệ quy với V lớn gây tràn ngăn xếp gọi hàm — template dùng vòng lặp với ngăn xếp tường minh.",
        "Cập nhật low[u] bằng tin[v] khi v đã thuộc SCC khác (không còn trên ngăn xếp) cho kết quả SAI — chỉ cập nhật với v đang trên ngăn xếp.",
        "Nhầm thứ tự đánh số: Tarjan đánh số theo thứ tự topo NGƯỢC; muốn thứ tự topo xuôi thì đảo comp → count − 1 − comp.",
        "Cạnh nội bộ một SCC phải bỏ khi dựng đồ thị cô đặc, và nên loại cạnh trùng giữa hai SCC.",
        "Nhầm SCC với thành phần liên thông của đồ thị bỏ hướng (yếu): hai khái niệm khác nhau."
      ],
      code: {
        lang: "cpp", title: "scc.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// SCC bằng Tarjan dạng VÒNG LẶP (không đệ quy, an toàn khi n tới 10^6). O(V + E). Đỉnh 0..n-1, cạnh CÓ HƯỚNG.
// Các SCC được đánh số 0,1,2,... theo thứ tự hoàn thành = thứ tự topo NGƯỢC của đồ thị cô đặc:
// mọi cạnh u -> v nối hai SCC khác nhau đều có comp[u] > comp[v].
struct Scc {
    int n, count = 0;  // count = số SCC
    vector<vector<int>> g;
    vector<int> comp;  // comp[v] = chỉ số SCC chứa v

    explicit Scc(int n) : n(n), g(n) {}
    void add_edge(int u, int v) { g[u].push_back(v); }

    void run() {
        comp.assign(n, -1);
        count = 0;
        vector<int> tin(n, -1), low(n, 0), it(n, 0), stk, call;
        vector<char> on_stk(n, 0);
        int timer = 0;
        for (int r = 0; r < n; r++) {
            if (tin[r] != -1) continue;
            tin[r] = low[r] = timer++;
            stk.push_back(r);
            on_stk[r] = 1;
            call.push_back(r);
            while (!call.empty()) {
                int u = call.back();
                if (it[u] < (int)g[u].size()) {
                    int v = g[u][it[u]++];
                    if (tin[v] == -1) {  // cạnh cây: đi xuống v
                        tin[v] = low[v] = timer++;
                        stk.push_back(v);
                        on_stk[v] = 1;
                        call.push_back(v);
                    } else if (on_stk[v]) {  // cạnh quay về đỉnh còn trên ngăn xếp (chưa thuộc SCC nào)
                        low[u] = min(low[u], tin[v]);
                    }
                } else {
                    call.pop_back();
                    if (low[u] == tin[u]) {  // u là gốc của một SCC: lấy cả SCC ra khỏi ngăn xếp
                        while (true) {
                            int v = stk.back();
                            stk.pop_back();
                            on_stk[v] = 0;
                            comp[v] = count;
                            if (v == u) break;
                        }
                        count++;
                    }
                    if (!call.empty()) low[call.back()] = min(low[call.back()], low[u]);
                }
            }
        }
    }

    // Đồ thị cô đặc (condensation): DAG trên các SCC, đã bỏ cạnh trùng. Gọi sau run().
    vector<vector<int>> condensation() const {
        vector<vector<int>> dag(count);
        for (int u = 0; u < n; u++)
            for (int v : g[u])
                if (comp[u] != comp[v]) dag[comp[u]].push_back(comp[v]);
        for (auto& adj : dag) {
            sort(adj.begin(), adj.end());
            adj.erase(unique(adj.begin(), adj.end()), adj.end());
        }
        return dag;
    }
};
`
      },
      example: {
        input: "6 đỉnh (0..5), cạnh có hướng: 0→1, 1→2, 2→0, 2→3, 3→4, 4→5, 5→3",
        output: "comp = 1 1 1 0 0 0; count = 2",
        explain: "Hai SCC: {0, 1, 2} (vòng 0→1→2→0) và {3, 4, 5} (vòng 3→4→5→3). Cạnh duy nhất giữa hai SCC là 2→3, đi từ SCC số 1 sang SCC số 0 nên comp[u] > comp[v], đúng quy ước thứ tự topo ngược; đồ thị cô đặc có một cạnh 1→0."
      },
      problems: [
        { site: "cses", id: "1682", name: "Flight Routes Check" },
        { site: "cses", id: "1683", name: "Planets and Kingdoms" },
        { site: "cses", id: "1686", name: "Coin Collector" },
        { site: "cses", id: "1685", name: "New Flight Routes" },
        { site: "cf", id: "427C", name: "Checkposts" }
      ],
      related: ["dfs", "topological-sort", "bridges-articulation", "two-sat"],
      compare: { "Bài toán giải": "Phân rã đồ thị có hướng thành các thành phần liên thông mạnh", "Cạnh âm": "Không áp dụng (không dùng trọng số)", "Hợp với đồ thị": "Có hướng, thưa hay dày đều O(V+E)", "Kết quả cho ra": "Nhãn SCC của từng đỉnh + đồ thị cô đặc (DAG)" },
      cards: [
        { q: "Hai đỉnh cùng SCC khi nào?", a: "Khi từ mỗi đỉnh đi được tới đỉnh kia (đồ thị có hướng)." },
        { q: "Đồ thị cô đặc có tính chất gì?", a: "Là DAG (không chu trình) nên sắp xếp topo và làm quy hoạch động được." },
        { q: "Điều kiện để u là gốc của một SCC trong Tarjan?", a: "low[u] == tin[u]; khi đó lấy các đỉnh trên ngăn xếp tới u ra làm một SCC." },
        { q: "Thứ tự đánh số SCC của Tarjan là gì?", a: "Thứ tự topo ngược của đồ thị cô đặc: cạnh u→v nối hai SCC khác nhau luôn có comp[u] > comp[v]." },
        { q: "Độ phức tạp của Tarjan/Kosaraju?", a: "O(V+E) thời gian." }
      ]
    },
    {
      id: "bridges-articulation",
      name: "Cầu & khớp",
      aliases: ["bridges", "articulation points", "cut vertices", "cầu", "khớp", "điểm khớp", "cạnh cầu", "necessary roads", "necessary cities", "critical connections", "low-link"],
      category: "graph",
      sub: "Thứ tự & liên thông",
      level: 3,
      tags: ["graph", "bridges", "articulation-points", "dfs", "low-link"],
      summary: "Tìm cạnh cầu và đỉnh khớp của đồ thị vô hướng trong O(V+E) bằng một lượt DFS với mảng tin/low.",
      description:
        "**Cầu** là cạnh mà bỏ đi làm đồ thị vô hướng mất liên thông (tăng số thành phần); **khớp** là đỉnh mà bỏ đi (cùng các cạnh của nó) làm tăng số thành phần. Cả hai tìm trong một lượt DFS với `tin[u]` (thứ tự vào) và `low[u]` (tin nhỏ nhất đạt tới được từ cây con của u bằng cạnh cây rồi tối đa một cạnh ngược).\n\n" +
        "Cạnh cây (p, u) là **cầu** nếu `low[u] > tin[p]` (cây con của u không có cạnh ngược nào lên tới p hoặc tổ tiên của p). Đỉnh p không phải gốc là **khớp** nếu có con u với `low[u] ≥ tin[p]`; gốc DFS là khớp khi có ít nhất 2 con cây.\n\n" +
        "Phải bỏ qua **đúng cạnh** vừa đi xuống (theo id cạnh), không phải mọi cạnh về cha, để hai cạnh song song giữa p và u không bị coi là cầu. Bỏ hết các cầu, các thành phần còn lại là các thành phần liên thông 2-cạnh. Template cài bằng vòng lặp nên chịu V tới 10⁶.",
      conditions: ["Đồ thị VÔ HƯỚNG (có thể không liên thông, có cạnh song song và vòng tự trỏ)", "Cạnh được định danh bằng id (add_edge trả về id) để phân biệt cạnh song song"],
      complexity: { time: "O(V+E)", space: "O(V+E)", note: "Một lượt DFS cho cả cầu lẫn khớp." },
      ops: [["Tìm mọi cầu và khớp", "O(V+E)"], ["Bộ nhớ", "O(V+E)"]],
      use_case: ["Mạng: cáp / đường nào hỏng thì mạng bị chia đôi (cầu)", "Máy chủ / thành phố nào hỏng thì mạng bị chia (khớp)", "Gộp mỗi thành phần liên thông 2-cạnh thành một đỉnh để dựng cây cầu (bridge tree) rồi trả lời truy vấn trên cây"],
      not_for: ["Đồ thị có hướng → SCC (cầu/khớp là khái niệm vô hướng)", "Chỉ cần đếm thành phần liên thông → DFS / DSU"],
      pitfalls: [
        "Bỏ qua mọi cạnh tới cha (so sánh đỉnh thay vì id cạnh) làm hai cạnh song song bị coi là cầu — phải bỏ qua đúng một cạnh theo id.",
        "Điều kiện cầu là low[u] > tin[p] (nghiêm ngặt), điều kiện khớp là low[u] >= tin[p] (có dấu bằng); lẫn hai dấu cho kết quả sai.",
        "Gốc DFS xử lý riêng: khớp khi có ≥ 2 con cây, không áp dụng điều kiện low.",
        "Đồ thị không liên thông: phải chạy DFS từ mọi đỉnh chưa thăm.",
        "Đệ quy với V lớn tràn ngăn xếp — template dùng vòng lặp.",
        "Nhầm khớp (đỉnh) với cầu (cạnh): một đỉnh nối hai cầu là khớp, nhưng đỉnh đầu mút của cầu chưa chắc là khớp (đầu mút có bậc 1)."
      ],
      code: {
        lang: "cpp", title: "bridges.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Cầu và khớp của đồ thị VÔ HƯỚNG bằng DFS vòng lặp (không đệ quy). O(V + E). Đỉnh 0..n-1.
// Cạnh được đánh số theo thứ tự add_edge (id 0,1,2,...) để phân biệt cạnh song song; vòng tự trỏ được phép.
struct BridgeFinder {
    int n;
    vector<vector<pair<int, int>>> g;  // g[u] = {(v, id cạnh)}
    vector<pair<int, int>> edges;      // edges[id] = (u, v)
    vector<int> bridges;               // id các cạnh là cầu (sau run)
    vector<char> is_cut;               // is_cut[v] = 1 nếu v là khớp (sau run)

    explicit BridgeFinder(int n) : n(n), g(n) {}

    int add_edge(int u, int v) {
        int id = edges.size();
        g[u].push_back({v, id});
        g[v].push_back({u, id});
        edges.push_back({u, v});
        return id;
    }

    void run() {
        bridges.clear();
        is_cut.assign(n, 0);
        vector<int> tin(n, -1), low(n, 0), it(n, 0), pe(n, -1), call;  // pe[v] = id cạnh cây dẫn tới v
        int timer = 0;
        for (int r = 0; r < n; r++) {
            if (tin[r] != -1) continue;
            int root_children = 0;
            tin[r] = low[r] = timer++;
            call.push_back(r);
            while (!call.empty()) {
                int u = call.back();
                if (it[u] < (int)g[u].size()) {
                    auto [v, id] = g[u][it[u]++];
                    if (id == pe[u]) continue;  // bỏ qua ĐÚNG cạnh vừa đi xuống (không phải mọi cạnh tới cha)
                    if (tin[v] != -1) {
                        low[u] = min(low[u], tin[v]);  // cạnh ngược
                    } else {
                        pe[v] = id;
                        tin[v] = low[v] = timer++;
                        call.push_back(v);
                    }
                } else {
                    call.pop_back();
                    if (call.empty()) continue;
                    int p = call.back();
                    low[p] = min(low[p], low[u]);
                    if (low[u] > tin[p]) bridges.push_back(pe[u]);  // cầu: cây con u không vòng lên được p
                    if (p == r) root_children++;
                    else if (low[u] >= tin[p]) is_cut[p] = 1;       // khớp (không phải gốc)
                }
            }
            if (root_children >= 2) is_cut[r] = 1;  // gốc DFS là khớp khi có >= 2 con cây
        }
    }
};
`
      },
      example: {
        input: "6 đỉnh (0..5), cạnh vô hướng theo thứ tự nhập (id 0..5): 0-1, 1-2, 2-0, 1-3, 3-4, 4-5",
        output: "cầu: id 3, 4, 5 (cạnh 1-3, 3-4, 4-5); khớp: 1, 3, 4",
        explain: "Tam giác 0-1-2 không có cầu (mỗi cạnh nằm trên chu trình). Đuôi 1-3-4-5 gồm ba cạnh mà bỏ cạnh nào cũng cắt đồ thị, nên đều là cầu. Khớp là đỉnh 1 (nối tam giác với đuôi), 3 và 4 (nối hai cầu); đỉnh 0, 2 và 5 không phải khớp."
      },
      problems: [
        { site: "cses", id: "2076", name: "Necessary Roads" },
        { site: "cses", id: "2077", name: "Necessary Cities" },
        { site: "cf", id: "1000E", name: "We Need More Bosses" },
        { site: "lc", name: "Critical Connections in a Network" }
      ],
      related: ["dfs", "scc", "dsu", "lca"],
      compare: { "Bài toán giải": "Cạnh cầu và đỉnh khớp của đồ thị vô hướng", "Cạnh âm": "Không áp dụng (không dùng trọng số)", "Hợp với đồ thị": "Vô hướng, mọi mật độ; O(V+E)", "Kết quả cho ra": "Danh sách cầu + cờ khớp (và thành phần 2-cạnh nếu gỡ các cầu)" },
      cards: [
        { q: "Điều kiện để cạnh cây (p, u) là cầu?", a: "low[u] > tin[p]: cây con của u không có cạnh ngược lên tới p hoặc tổ tiên của p." },
        { q: "Điều kiện để đỉnh p (không phải gốc) là khớp?", a: "Có một con u trong cây DFS với low[u] ≥ tin[p]." },
        { q: "Khi nào gốc DFS là khớp?", a: "Khi gốc có ít nhất 2 con trong cây DFS." },
        { q: "Vì sao phải bỏ qua cạnh cha theo id cạnh?", a: "Nếu bỏ qua mọi cạnh tới cha thì hai cạnh song song giữa p và u sẽ bị coi là cầu; bỏ qua theo id thì cạnh song song còn lại làm low[u] ≤ tin[p]." },
        { q: "Độ phức tạp?", a: "O(V+E): một lượt DFS tính tin/low cho cả cầu và khớp." }
      ]
    },
    {
      id: "lca",
      name: "LCA (Binary Lifting)",
      aliases: ["lca", "lowest common ancestor", "tổ tiên chung gần nhất", "tổ tiên chung thấp nhất", "binary lifting", "nhảy nhị phân", "k-th ancestor", "tổ tiên thứ k", "khoảng cách trên cây"],
      category: "graph",
      sub: "Cây",
      level: 3,
      tags: ["graph", "tree", "lca", "binary-lifting", "queries"],
      summary: "Tổ tiên chung thấp nhất của hai đỉnh trong cây có gốc bằng binary lifting: tiền xử lý O(V log V), mỗi truy vấn O(log V), có kèm tổ tiên thứ k và khoảng cách.",
      description:
        "**LCA** (tổ tiên chung thấp nhất) của hai đỉnh a, b trong cây có gốc là đỉnh sâu nhất là tổ tiên của cả hai. **Binary lifting** lưu `up[j][v]` = tổ tiên thứ 2^j của v, tính bằng `up[j][v] = up[j-1][up[j-1][v]]` (tổ tiên của gốc quy ước là chính gốc).\n\n" +
        "Truy vấn: nâng đỉnh sâu hơn lên cùng độ sâu bằng cách nhảy theo các bit của hiệu độ sâu; nếu hai đỉnh đã trùng thì đó là LCA; ngược lại nhảy đồng thời cả hai từ bit lớn xuống bit nhỏ chừng nào tổ tiên hai bên còn khác nhau — đáp án là cha chung của chỗ dừng.\n\n" +
        "Tiền xử lý O(V log V), mỗi truy vấn O(log V), trả lời trực tuyến (online). Cùng bảng `up` trả lời **tổ tiên thứ k** trong O(log V); khoảng cách giữa hai đỉnh = depth[a] + depth[b] − 2·depth[LCA]. Template dựng depth và up bằng BFS (không đệ quy) nên chịu cây dạng đường thẳng V = 10⁵–10⁶. Phương án khác: Euler tour + Sparse Table (truy vấn O(1)), HLD.",
      conditions: ["Đồ thị đầu vào là CÂY liên thông (không hướng), biết đỉnh gốc", "Bộ nhớ O(V log V) cho bảng up chấp nhận được"],
      complexity: { time: "O(V log V) tiền xử lý, O(log V) mỗi truy vấn", space: "O(V log V)", note: "Euler tour + Sparse Table cho truy vấn O(1) với cùng tiền xử lý O(V log V)." },
      ops: [["Dựng bảng up", "O(V log V)"], ["lca(a, b)", "O(log V)"], ["Tổ tiên thứ k", "O(log V)"], ["Khoảng cách giữa hai đỉnh", "O(log V)"], ["Bộ nhớ", "O(V log V)"]],
      use_case: ["Khoảng cách giữa hai đỉnh trên cây, nhiều truy vấn online", "Tổ tiên thứ k của một đỉnh (Company Queries)", "Đếm đường đi qua cạnh/đỉnh bằng mảng hiệu trên cây (cần LCA của từng đường)", "Nền cho nhiều bài truy vấn đường đi trên cây"],
      not_for: ["Đồ thị không phải cây (có chu trình) → cần dựng cây khung trước hoặc dùng thuật toán khác", "Truy vấn rất nhiều (10⁶+) cần O(1) → Euler tour + Sparse Table", "Truy vấn tổng/cực trị trên đường đi kèm cập nhật → HLD + segment tree"],
      pitfalls: [
        "Quên rằng đầu vào phải là cây liên thông: đỉnh không tới được từ gốc có depth −1 và up sai.",
        "LOG quá nhỏ: cần 2^LOG ≥ V (độ sâu tối đa V−1) — template tính LOG đúng theo n.",
        "Nâng đỉnh sâu hơn bằng vòng lặp từng bước (O(V)) thay vì theo bit — chậm O(V) mỗi truy vấn.",
        "Đệ quy DFS dựng depth/up với cây đường thẳng V = 10⁵+ gây tràn ngăn xếp — dùng BFS như template.",
        "Quy ước tổ tiên của gốc: phải là chính gốc, nếu để −1 thì truy cập up[j][-1] gây lỗi.",
        "Nhầm 0-based/1-based khi chỉ định gốc."
      ],
      code: {
        lang: "cpp", title: "lca.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// LCA bằng binary lifting. Tiền xử lý O(n log n), mỗi truy vấn O(log n).
// g = danh sách kề của CÂY liên thông (không hướng), đỉnh 0..n-1, root = gốc. Dựng bằng BFS (không đệ quy).
struct Lca {
    int n, LOG;
    vector<int> depth;
    vector<vector<int>> up;  // up[j][v] = tổ tiên thứ 2^j của v; tổ tiên của gốc = chính gốc

    Lca(const vector<vector<int>>& g, int root = 0) : n(g.size()), LOG(1), depth(g.size(), -1) {
        while ((1 << LOG) < n) LOG++;  // 2^LOG >= n > độ sâu tối đa
        up.assign(LOG, vector<int>(n, root));
        queue<int> q;
        depth[root] = 0;
        q.push(root);
        while (!q.empty()) {
            int u = q.front();
            q.pop();
            for (int v : g[u])
                if (depth[v] == -1) {
                    depth[v] = depth[u] + 1;
                    up[0][v] = u;
                    q.push(v);
                }
        }
        for (int j = 1; j < LOG; j++)
            for (int v = 0; v < n; v++) up[j][v] = up[j - 1][up[j - 1][v]];
    }

    // Tổ tiên thứ k của v (k = 0: chính v); -1 nếu k vượt độ sâu của v.
    int kth_ancestor(int v, int k) const {
        if (k < 0 || k > depth[v]) return -1;
        for (int j = 0; j < LOG; j++)
            if ((k >> j) & 1) v = up[j][v];
        return v;
    }

    int lca(int a, int b) const {
        if (depth[a] < depth[b]) swap(a, b);
        a = kth_ancestor(a, depth[a] - depth[b]);  // đưa a lên cùng độ sâu với b
        if (a == b) return a;
        for (int j = LOG - 1; j >= 0; j--)
            if (up[j][a] != up[j][b]) {
                a = up[j][a];
                b = up[j][b];
            }
        return up[0][a];
    }

    // Số cạnh trên đường đi giữa a và b.
    int dist(int a, int b) const { return depth[a] + depth[b] - 2 * depth[lca(a, b)]; }
};
`
      },
      example: {
        input: "Cây 7 đỉnh (0..6), gốc 0, cạnh: 0-1, 0-2, 1-3, 1-4, 2-5, 2-6",
        output: "lca(3, 4) = 1; lca(3, 5) = 0; lca(4, 1) = 1; dist(3, 5) = 4; kth_ancestor(3, 2) = 0; kth_ancestor(3, 3) = -1",
        explain: "Đỉnh 3 và 4 cùng là con của 1 nên LCA = 1; 3 và 5 nằm ở hai nhánh khác nhau của gốc nên LCA = 0. Đường 3-1-0-2-5 có 4 cạnh. Tổ tiên thứ 2 của 3 là 0; tổ tiên thứ 3 không tồn tại (độ sâu của 3 chỉ là 2)."
      },
      problems: [
        { site: "cses", id: "1687", name: "Company Queries I" },
        { site: "cses", id: "1688", name: "Company Queries II" },
        { site: "cses", id: "1135", name: "Distance Queries" },
        { site: "cses", id: "1136", name: "Counting Paths" },
        { site: "cf", id: "191C", name: "Fools and Roads" },
        { site: "lc", name: "Kth Ancestor of a Tree Node" }
      ],
      related: ["dfs", "tree-diameter", "hld", "bridges-articulation"],
      compare: { "Bài toán giải": "Tổ tiên chung thấp nhất, tổ tiên thứ k, khoảng cách trên cây", "Cạnh âm": "Không áp dụng (đếm số cạnh; cần khoảng cách có trọng số thì lưu thêm độ dài từ gốc)", "Hợp với đồ thị": "Chỉ cây liên thông có gốc", "Kết quả cho ra": "Một đỉnh LCA / khoảng cách; mỗi truy vấn O(log V)" },
      cards: [
        { q: "Bảng up trong binary lifting lưu gì và tính thế nào?", a: "up[j][v] = tổ tiên thứ 2^j của v; up[j][v] = up[j-1][up[j-1][v]], tổ tiên của gốc là chính gốc." },
        { q: "Các bước truy vấn LCA(a, b)?", a: "Nâng đỉnh sâu hơn lên cùng độ sâu; nếu trùng thì xong; nếu không thì nhảy đồng thời từ bit lớn xuống nhỏ khi tổ tiên hai bên còn khác nhau, đáp án là cha của chỗ dừng." },
        { q: "Độ phức tạp?", a: "Tiền xử lý O(V log V) thời gian và bộ nhớ; mỗi truy vấn O(log V)." },
        { q: "Khoảng cách giữa a và b trên cây tính thế nào?", a: "depth[a] + depth[b] − 2·depth[lca(a, b)] (với trọng số: dùng khoảng cách từ gốc thay cho depth)." },
        { q: "Khi nào chọn Euler tour + Sparse Table thay vì binary lifting?", a: "Khi cần truy vấn O(1) và rất nhiều truy vấn; binary lifting đơn giản và còn cho tổ tiên thứ k." }
      ]
    },
    {
      id: "tree-diameter",
      name: "Đường kính cây",
      aliases: ["tree diameter", "đường kính của cây", "đường đi dài nhất trong cây", "hai lần bfs", "hai lần dfs", "tree distances", "đỉnh xa nhất"],
      category: "graph",
      sub: "Cây",
      level: 2,
      tags: ["graph", "tree", "diameter", "dfs", "longest-path"],
      summary: "Đường đi dài nhất giữa hai đỉnh của cây (trọng số cạnh không âm) bằng hai lượt duyệt, O(V); cho luôn khoảng cách xa nhất của mọi đỉnh.",
      description:
        "**Đường kính** của cây là đường đi dài nhất giữa hai đỉnh bất kỳ. Với trọng số cạnh **không âm** có thể tìm bằng hai lượt duyệt: từ một đỉnh tuỳ ý tìm đỉnh xa nhất a; từ a tìm đỉnh xa nhất b; đường a–b là một đường kính. Lý do: đỉnh xa nhất tính từ bất kỳ đỉnh nào luôn là một đầu mút của một đường kính.\n\n" +
        "Hệ quả hay dùng: với mọi đỉnh v, đỉnh xa nhất của v là một trong hai đầu mút a hoặc b, nên khoảng cách xa nhất từ v bằng max(dist(v, a), dist(v, b)) — template trả luôn hai mảng `da`, `db` để giải bài \"khoảng cách tới đỉnh xa nhất của mọi đỉnh\" bằng ba lượt duyệt (CSES Tree Distances I).\n\n" +
        "Template duyệt bằng vòng lặp với ngăn xếp tường minh nên chịu cây dạng đường thẳng V = 10⁶. Cách khác: quy hoạch động trên cây (hai nhánh sâu nhất qua mỗi đỉnh).",
      conditions: ["Đồ thị là CÂY liên thông có V ≥ 1", "Trọng số cạnh KHÔNG ÂM (không trọng số: coi mọi cạnh bằng 1)"],
      complexity: { time: "O(V)", space: "O(V)", note: "Ba lượt duyệt O(V); không cần sắp xếp hay heap." },
      ops: [["Đường kính + đường đi", "O(V)"], ["Khoảng cách xa nhất của mọi đỉnh", "O(V)"], ["Bộ nhớ", "O(V)"]],
      use_case: ["Độ dài và đường đi của đường kính cây", "Với mỗi đỉnh, khoảng cách tới đỉnh xa nhất (tâm cây, bán kính)", "Nối hai cây bằng một cạnh sao cho đường kính mới nhỏ nhất", "Tìm tâm cây (đỉnh hoặc cạnh ở giữa đường kính) và bán kính"],
      not_for: ["Đồ thị có chu trình → không phải cây (đường đi đơn dài nhất trong đồ thị tổng quát là bài NP-khó)", "Trọng số âm → hai lượt duyệt có thể sai; dùng quy hoạch động trên cây", "Cần khoảng cách giữa các cặp đỉnh tuỳ ý → LCA"],
      pitfalls: [
        "Trọng số âm làm kết luận 'đỉnh xa nhất là đầu mút' không còn đúng.",
        "Đồ thị rừng (nhiều cây): phải chạy riêng từng thành phần liên thông.",
        "Nhầm đường kính theo số đỉnh với theo số cạnh (hơn nhau 1) — đọc kỹ đề.",
        "Khoảng cách tổng vượt int32 (V·w): dùng long long.",
        "Duyệt đệ quy cây đường thẳng V = 10⁵+ gây tràn ngăn xếp — template dùng vòng lặp.",
        "Khởi đầu hai lượt từ cùng đỉnh: lượt hai PHẢI bắt đầu từ đỉnh xa nhất của lượt một, không phải đỉnh ban đầu."
      ],
      code: {
        lang: "cpp", title: "tree_diameter.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Đường kính của CÂY liên thông có trọng số cạnh KHÔNG ÂM bằng hai lượt duyệt. O(n).
// Đỉnh 0..n-1; g[u] = {(v, w)} (cạnh vô hướng: có mặt ở cả hai danh sách). Cần n >= 1.
struct DiameterResult {
    long long length = 0;      // độ dài đường kính
    vector<int> path;          // các đỉnh trên một đường kính, từ đầu mút a tới đầu mút b
    vector<long long> da, db;  // da[v], db[v] = khoảng cách từ v tới hai đầu mút; xa nhất của v = max(da[v], db[v])
};

// Khoảng cách từ s tới mọi đỉnh (duyệt bằng vòng lặp), ghi cha vào par; trả về đỉnh xa nhất.
int tree_farthest(const vector<vector<pair<int, long long>>>& g, int s, vector<long long>& dist, vector<int>& par) {
    int n = g.size();
    dist.assign(n, -1);
    par.assign(n, -1);
    vector<int> stk = {s};
    dist[s] = 0;
    int best = s;
    while (!stk.empty()) {
        int u = stk.back();
        stk.pop_back();
        if (dist[u] > dist[best]) best = u;
        for (auto [v, w] : g[u])
            if (dist[v] == -1) {
                dist[v] = dist[u] + w;
                par[v] = u;
                stk.push_back(v);
            }
    }
    return best;
}

DiameterResult tree_diameter(const vector<vector<pair<int, long long>>>& g) {
    DiameterResult r;
    vector<long long> d0;
    vector<int> p0, pa, pb;
    int a = tree_farthest(g, 0, d0, p0);   // lượt 1: từ đỉnh bất kỳ tới đỉnh xa nhất a
    int b = tree_farthest(g, a, r.da, pa);  // lượt 2: từ a tới đỉnh xa nhất b
    tree_farthest(g, b, r.db, pb);          // lượt 3 (tuỳ chọn): khoảng cách từ b
    r.length = r.da[b];
    for (int v = b; v != -1; v = pa[v]) r.path.push_back(v);  // b -> ... -> a
    reverse(r.path.begin(), r.path.end());                     // a -> ... -> b
    return r;
}
`
      },
      example: {
        input: "Cây 6 đỉnh (0..5), cạnh (u-v, w): 0-1 (2), 1-2 (3), 1-3 (4), 3-4 (1), 3-5 (6)",
        output: "length = 13; path = 5 3 1 2",
        explain: "Đường 2-1-3-5 dài 3 + 4 + 6 = 13 là dài nhất (đường 0-1-3-5 chỉ 12). Duyệt từ đỉnh 0: đỉnh xa nhất là 5 (12); duyệt từ 5: đỉnh xa nhất là 2 (13) nên đường kính nối 5 và 2. Khoảng cách xa nhất của đỉnh 0 là max(da[0], db[0]) = max(12, 5) = 12."
      },
      problems: [
        { site: "cses", id: "1131", name: "Tree Diameter" },
        { site: "cses", id: "1132", name: "Tree Distances I" },
        { site: "cf", id: "455C", name: "Civilization" },
        { site: "lc", name: "Diameter of Binary Tree" }
      ],
      related: ["dfs", "bfs", "lca", "tree-dp"],
      compare: { "Bài toán giải": "Đường đi dài nhất giữa hai đỉnh của cây", "Cạnh âm": "Không cho phép (trọng số phải ≥ 0)", "Hợp với đồ thị": "Chỉ cây liên thông; O(V)", "Kết quả cho ra": "Độ dài + đường đi của đường kính, khoảng cách xa nhất của mọi đỉnh" },
      cards: [
        { q: "Tìm đường kính cây bằng hai lượt duyệt thế nào?", a: "Từ đỉnh bất kỳ tìm đỉnh xa nhất a; từ a tìm đỉnh xa nhất b; đường a–b là đường kính." },
        { q: "Hai lượt duyệt đúng với điều kiện nào?", a: "Cây liên thông và trọng số cạnh không âm." },
        { q: "Khoảng cách xa nhất từ mỗi đỉnh v tới các đỉnh khác tính thế nào?", a: "max(dist(v, a), dist(v, b)) với a, b là hai đầu mút của đường kính." },
        { q: "Độ phức tạp?", a: "O(V) thời gian và bộ nhớ (ba lượt duyệt)." }
      ]
    }
  ]);

  A.lib.scenarios([
    {
      id: "q-graph-representation-1",
      prompt: "Một đồ thị vô hướng thưa có V = 100 000 đỉnh, E = 200 000 cạnh có trọng số. Chương trình sẽ chạy nhiều thuật toán duyệt, mỗi lần cần liệt kê nhanh mọi hàng xóm của từng đỉnh; bộ nhớ giới hạn 256 MB. Nên chọn cách LƯU đồ thị nào (phần nền tảng cho các thuật toán đó)?",
      answer: ["graph-representation"], also: [],
      wrong: ["floyd-warshall", "dsu", "sparse-table"],
      why: "Đây là bài chọn cách lưu: V = 10⁵ thì ma trận kề V² = 10¹⁰ ô là bất khả thi, còn danh sách kề chỉ O(V+E) và duyệt hàng xóm của u mất O(deg u). Floyd-Warshall cần ma trận V×V và V³ thời gian nên không hợp; DSU chỉ trả lời hai đỉnh có cùng thành phần không và không liệt kê được hàng xóm; Sparse Table là cấu trúc truy vấn đoạn trên mảng, không lưu đồ thị.",
      level: 1
    },
    {
      id: "q-bfs-1",
      prompt: "Mê cung dạng lưới 1000 × 1000: ô '#' là tường, ô '.' đi được. Mỗi bước đi sang một trong bốn ô kề (trên, dưới, trái, phải) tốn đúng 1 đơn vị. Cần số bước ít nhất từ ô A tới ô B và in ra một đường đi tương ứng.",
      answer: ["bfs"], also: ["dijkstra", "bfs-01"],
      wrong: ["dfs", "floyd-warshall", "bellman-ford"],
      why: "Mọi cạnh cùng chi phí 1 nên BFS cho đường ít bước nhất trong O(V+E) và dựng đường đi bằng mảng cha. Dijkstra và 0-1 BFS cũng đúng nhưng thừa công. DFS chỉ cho một đường đi hợp lệ chứ không phải ngắn nhất; Floyd-Warshall (V = 10⁶ thì V³ không thể) và Bellman-Ford (O(V·E)) quá chậm.",
      level: 1
    },
    {
      id: "q-bfs-2",
      prompt: "Lưới 1000 × 1000 có K ô đang cháy (K có thể tới 10⁵). Mỗi giây lửa lan sang các ô kề (4 hướng, trừ tường). Cần biết với mỗi ô thời điểm lửa tới sớm nhất (hoặc không bao giờ tới).",
      answer: ["bfs"], also: ["dijkstra"],
      wrong: ["dfs", "floyd-warshall", "topological-sort"],
      why: "Đây là BFS nhiều nguồn: đẩy cả K ô cháy vào hàng đợi với khoảng cách 0 rồi chạy MỘT lần, O(R·C). Chạy BFS riêng cho từng nguồn mất O(K·R·C), còn Floyd-Warshall là V³. DFS không cho khoảng cách ngắn nhất; sắp xếp topo là bài toán khác (thứ tự trên DAG).",
      level: 2
    },
    {
      id: "q-dfs-1",
      prompt: "Cho cây có gốc với N = 200 000 đỉnh. Cần trả lời Q = 200 000 truy vấn dạng 'đỉnh u có phải tổ tiên của đỉnh v không' và với mỗi đỉnh biết số đỉnh trong cây con của nó. Không có cập nhật.",
      answer: ["dfs"], also: ["lca"],
      wrong: ["bfs", "dijkstra", "floyd-warshall"],
      why: "Một lượt DFS vòng lặp ghi tin/tout: u là tổ tiên của v khi tin[u] ≤ tin[v] < tout[u], và kích thước cây con = tout − tin, mỗi truy vấn O(1). LCA (binary lifting) cũng trả lời được (lca(u, v) == u) nhưng chậm hơn O(log N) và thừa. BFS không cho khoảng thời gian vào/ra cây con; Dijkstra, Floyd-Warshall là đường đi ngắn nhất, không liên quan.",
      level: 2
    },
    {
      id: "q-bfs-01-1",
      prompt: "Lưới R × C (R, C ≤ 1000); mỗi ô có một mũi tên chỉ một trong bốn hướng. Đi theo hướng mũi tên của ô đang đứng thì miễn phí, đi sang bất kỳ hướng khác tốn 1 xu. Tìm số xu ít nhất từ góc trên trái tới góc dưới phải.",
      answer: ["bfs-01"], also: ["dijkstra"],
      wrong: ["bfs", "bellman-ford", "floyd-warshall"],
      why: "Trọng số cạnh chỉ là 0 hoặc 1 nên 0-1 BFS (deque) giải trong O(V+E). Dijkstra cũng đúng nhưng thêm hệ số log. BFS thường sai vì cạnh trọng số 0 và 1 khác nhau; Bellman-Ford O(V·E) và Floyd-Warshall O(V³) quá chậm với V = 10⁶.",
      level: 2
    },
    {
      id: "q-dijkstra-1",
      prompt: "Mạng 100 000 thành phố có 200 000 con đường một chiều, mỗi đường mất thời gian từ 1 tới 10⁹ (không âm, các đường có thể khác nhau nhiều). Tính thời gian đi ngắn nhất từ thành phố 1 tới mọi thành phố khác.",
      answer: ["dijkstra"], also: ["spfa"],
      wrong: ["bfs", "floyd-warshall", "bellman-ford"],
      why: "Trọng số không âm và một nguồn: Dijkstra với priority_queue chạy O((V+E) log V). SPFA chạy được nhưng có thể O(V·E) trong trường hợp xấu. BFS chỉ đúng khi mọi cạnh cùng chi phí; Floyd-Warshall (V³ = 10¹⁵) và Bellman-Ford (V·E = 2·10¹⁰) quá chậm.",
      level: 2
    },
    {
      id: "q-dijkstra-2",
      prompt: "Có V = 3 000 điểm, giữa mọi cặp điểm đều có đường (đồ thị đầy đủ, gần 9·10⁶ cạnh có hướng) với chi phí dương khác nhau. Cần chi phí nhỏ nhất từ điểm số 1 tới mọi điểm khác. Ma trận chi phí đã cho sẵn.",
      answer: ["dijkstra"], also: [],
      wrong: ["floyd-warshall", "bellman-ford", "bfs"],
      why: "Chi phí dương, một nguồn, đồ thị dày: Dijkstra bản mảng O(V²) ≈ 9·10⁶ rất nhanh (không cần heap). Floyd-Warshall tính mọi cặp O(V³) = 2,7·10¹⁰ thừa và quá chậm; Bellman-Ford O(V·E) ≈ 2,7·10¹⁰ cũng vậy; BFS chỉ cho trọng số bằng nhau.",
      level: 3
    },
    {
      id: "q-bellman-ford-1",
      prompt: "Đồ thị có hướng 2 500 đỉnh, 5 000 cạnh, trọng số từ −1000 tới 1000. Cần biết có thể đi vòng để giảm chi phí vô hạn không (chu trình âm tới được từ đỉnh xuất phát); nếu không thì in chi phí nhỏ nhất từ đỉnh xuất phát tới mọi đỉnh.",
      answer: ["bellman-ford"], also: ["spfa"],
      wrong: ["dijkstra", "bfs-01", "floyd-warshall"],
      why: "Có cạnh âm và cần phát hiện chu trình âm: Bellman-Ford (V−1 vòng relax, vòng thứ V còn relax ⇒ chu trình âm) với V·E ≈ 1,25·10⁷ rất nhanh. SPFA cũng làm được nhưng không bảo đảm xấu nhất. Dijkstra cho kết quả sai với cạnh âm; 0-1 BFS chỉ cho trọng số 0/1; Floyd-Warshall V³ ≈ 1,6·10¹⁰ quá chậm.",
      level: 2
    },
    {
      id: "q-spfa-1",
      prompt: "Đồ thị có hướng 100 000 đỉnh, 300 000 cạnh, một số cạnh có trọng số âm nhưng đề đảm bảo KHÔNG có chu trình âm. Dữ liệu do người ra đề sinh ngẫu nhiên, không có test đối kháng. Cần khoảng cách từ một đỉnh nguồn tới mọi đỉnh.",
      answer: ["spfa"], also: [],
      wrong: ["dijkstra", "bellman-ford", "floyd-warshall"],
      why: "Có cạnh âm nên Dijkstra thường không dùng được; Bellman-Ford O(V·E) = 3·10¹⁰ quá chậm; Floyd-Warshall V³ không thể. SPFA (Bellman-Ford hàng đợi) trên dữ liệu ngẫu nhiên thường chạy rất nhanh. Lưu ý trường hợp xấu nhất của SPFA vẫn là O(V·E) và có test anti-SPFA nên chỉ chọn khi không có test đối kháng.",
      level: 3
    },
    {
      id: "q-floyd-warshall-1",
      prompt: "Đồ thị có hướng 300 đỉnh, trọng số cạnh có thể âm nhưng không có chu trình âm. Có Q = 100 000 truy vấn, mỗi truy vấn hỏi khoảng cách ngắn nhất từ đỉnh a tới đỉnh b.",
      answer: ["floyd-warshall"], also: [],
      wrong: ["dijkstra", "bfs", "bellman-ford"],
      why: "V nhỏ, cần khoảng cách MỌI cặp và có cạnh âm: chạy Floyd-Warshall một lần O(V³) = 2,7·10⁷ rồi trả lời mỗi truy vấn O(1). Dijkstra sai với cạnh âm; BFS chỉ cho cạnh cùng chi phí; Bellman-Ford chạy lại cho từng truy vấn quá chậm.",
      level: 2
    },
    {
      id: "q-topological-sort-1",
      prompt: "Có N = 100 000 môn học và M = 200 000 ràng buộc dạng 'môn a phải học trước môn b'. Hỏi có thứ tự học nào thoả mọi ràng buộc không; nếu có hãy in một thứ tự.",
      answer: ["topological-sort"], also: ["dfs"],
      wrong: ["dijkstra", "kruskal", "scc"],
      why: "Các ràng buộc tạo đồ thị có hướng; có thứ tự hợp lệ khi và chỉ khi không có chu trình, và sắp xếp topo (Kahn) vừa kiểm tra vừa in được một thứ tự trong O(N+M). DFS rồi đảo thứ tự thoát cũng cho thứ tự topo. Dijkstra và Kruskal là đường đi ngắn nhất / cây khung nên không liên quan; SCC phát hiện chu trình nhưng không in thứ tự học và thừa với bài này.",
      level: 2
    },
    {
      id: "q-topological-sort-2",
      prompt: "Đồ thị có hướng không chu trình (DAG) có V = 100 000 đỉnh, E = 300 000 cạnh. Cần đếm số đường đi khác nhau từ đỉnh 1 tới đỉnh V (lấy modulo 10⁹+7).",
      answer: ["topological-sort"], also: [],
      wrong: ["dijkstra", "bfs", "floyd-warshall"],
      why: "Trên DAG, xử lý đỉnh theo thứ tự topo thì mọi đỉnh tiền nhiệm đã có đáp án: ways[v] = tổng ways[u] với u→v, tổng O(V+E). BFS/Dijkstra không bảo đảm thứ tự xử lý phù hợp cho việc đếm; Floyd-Warshall V³ quá chậm.",
      level: 2
    },
    {
      id: "q-kruskal-1",
      prompt: "Có N = 200 000 thành phố và M = 500 000 con đường có thể xây, mỗi đường có chi phí. Cần chọn các đường để mọi thành phố đi được tới nhau với tổng chi phí nhỏ nhất (đồ thị đảm bảo liên thông).",
      answer: ["kruskal"], also: ["prim"],
      wrong: ["dijkstra", "floyd-warshall", "bfs"],
      why: "Đây là cây khung nhỏ nhất. Đồ thị thưa, cho dưới dạng danh sách cạnh: Kruskal (sắp xếp cạnh + DSU) O(M log M). Prim với heap cũng đúng. Dijkstra tìm đường đi ngắn nhất từ một nguồn (không bảo đảm tổng cạnh nhỏ nhất); Floyd-Warshall là mọi cặp đỉnh; BFS không xét trọng số.",
      level: 2
    },
    {
      id: "q-prim-1",
      prompt: "Có 3 000 điểm trên mặt phẳng; chi phí nối hai điểm bất kỳ bằng khoảng cách Euclid giữa chúng (đồ thị đầy đủ, khoảng 4,5·10⁶ cạnh). Cần cây nối mọi điểm với tổng độ dài nhỏ nhất, không muốn lưu hay sắp xếp hết các cạnh.",
      answer: ["prim"], also: ["kruskal"],
      wrong: ["dijkstra", "floyd-warshall", "bfs"],
      why: "Đồ thị dày: Prim bản mảng chạy O(V²) = 9·10⁶ và tính khoảng cách khi cần, không cần lưu hay sắp xếp 4,5·10⁶ cạnh. Kruskal vẫn đúng nhưng phải liệt kê và sắp xếp mọi cạnh. Dijkstra là đường đi ngắn nhất, Floyd-Warshall là mọi cặp (V³ quá lớn), BFS không dùng trọng số.",
      level: 2
    },
    {
      id: "q-scc-1",
      prompt: "Mạng có 100 000 thành phố và 300 000 đường một chiều. Hai thành phố thuộc cùng một 'vương quốc' nếu đi được từ thành phố này sang thành phố kia và ngược lại. Cần đếm số vương quốc và cho biết thành phố nào thuộc vương quốc nào.",
      answer: ["scc"], also: [],
      wrong: ["bfs", "bridges-articulation", "dsu"],
      why: "Quan hệ 'đi được hai chiều' trên đồ thị có hướng chính là thành phần liên thông mạnh: Tarjan hoặc Kosaraju trong O(V+E). BFS từ một đỉnh chỉ cho tập đi tới được một chiều; cầu & khớp và DSU thuộc đồ thị vô hướng (DSU không phân biệt hướng đi).",
      level: 3
    },
    {
      id: "q-scc-2",
      prompt: "Đồ thị có hướng 100 000 đỉnh, trong đó có chu trình. Mỗi đỉnh chứa một lượng vàng; đi qua đỉnh nào thì nhặt hết vàng ở đó (đi lại các chu trình thoải mái nhưng mỗi đỉnh chỉ nhặt một lần). Cần lượng vàng nhiều nhất trên một đường đi.",
      answer: ["scc"], also: [],
      wrong: ["topological-sort", "dijkstra", "bellman-ford"],
      why: "Mỗi SCC có thể đi hết và nhặt trọn vàng, nên cô đặc đồ thị thành DAG các SCC rồi quy hoạch động theo thứ tự topo. Sắp xếp topo trực tiếp bị chặn vì có chu trình; Dijkstra và Bellman-Ford tìm đường ngắn nhất, không phải tổng giá trị lớn nhất trên đường đi.",
      level: 3
    },
    {
      id: "q-bridges-articulation-1",
      prompt: "Mạng gồm 100 000 máy chủ nối bằng 200 000 sợi cáp hai chiều (mạng liên thông). Cần liệt kê các sợi cáp mà nếu hỏng thì mạng bị tách thành hai phần không liên lạc được với nhau.",
      answer: ["bridges-articulation"], also: [],
      wrong: ["scc", "kruskal", "bfs"],
      why: "Cáp mà bỏ đi làm mất liên thông chính là cạnh cầu của đồ thị vô hướng, tìm bằng một lượt DFS với tin/low trong O(V+E). SCC dành cho đồ thị có hướng; Kruskal là cây khung nhỏ nhất; BFS đơn thuần không phát hiện cầu (thử bỏ từng cạnh rồi BFS thì O(E·(V+E)) quá chậm).",
      level: 3
    },
    {
      id: "q-lca-1",
      prompt: "Cây có gốc (đỉnh 1) với N = 200 000 đỉnh, cạnh không trọng số. Có Q = 200 000 truy vấn trực tuyến (phải trả lời ngay từng truy vấn): khoảng cách giữa hai đỉnh a và b.",
      answer: ["lca"], also: ["hld"],
      wrong: ["bfs", "floyd-warshall", "tree-diameter"],
      why: "Khoảng cách = depth[a] + depth[b] − 2·depth[LCA(a, b)]; binary lifting cho mỗi truy vấn O(log N) sau tiền xử lý O(N log N). BFS cho từng truy vấn mất O(N·Q) = 4·10¹⁰; Floyd-Warshall N³ không thể; đường kính cây chỉ cho một giá trị cực đại, không trả lời khoảng cách tuỳ ý.",
      level: 3
    },
    {
      id: "q-lca-2",
      prompt: "Cây có gốc với N = 200 000 đỉnh (đỉnh 1 là gốc). Có Q = 200 000 truy vấn: cho đỉnh v và số k, in ra tổ tiên thứ k của v (nếu không tồn tại in −1). Cây không thay đổi.",
      answer: ["lca"], also: [],
      wrong: ["bfs", "dfs", "tree-diameter"],
      why: "Bảng nhảy nhị phân up[j][v] (binary lifting) trả lời tổ tiên thứ k trong O(log N) bằng cách nhảy theo các bit của k. Duyệt BFS/DFS và đi lên k bước cho mỗi truy vấn mất O(N) mỗi truy vấn; đường kính cây không liên quan.",
      level: 3
    },
    {
      id: "q-tree-diameter-1",
      prompt: "Cho một cây N = 100 000 đỉnh, mỗi cạnh có độ dài từ 0 tới 10⁹. Tìm hai đỉnh có khoảng cách lớn nhất và khoảng cách đó (không cần đường đi cho mọi cặp).",
      answer: ["tree-diameter"], also: ["tree-dp"],
      wrong: ["floyd-warshall", "dijkstra", "lca"],
      why: "Đây là đường kính cây: hai lượt duyệt (đỉnh xa nhất từ đỉnh bất kỳ, rồi đỉnh xa nhất từ đó) cho kết quả trong O(N). Quy hoạch động trên cây cũng làm được. Floyd-Warshall (N³) hay chạy Dijkstra từ mọi đỉnh (O(N² log N)) quá chậm; LCA trả lời khoảng cách một cặp cho trước chứ không tìm cặp xa nhất.",
      level: 2
    },
    {
      id: "q-tree-diameter-2",
      prompt: "Cho cây N = 200 000 đỉnh, cạnh có độ dài không âm. Với MỖI đỉnh, cần khoảng cách tới đỉnh xa nhất của nó trong cây.",
      answer: ["tree-diameter"], also: ["tree-dp"],
      wrong: ["floyd-warshall", "lca", "bfs"],
      why: "Đỉnh xa nhất của mọi đỉnh luôn là một trong hai đầu mút a, b của đường kính, nên đáp án của v là max(dist(v, a), dist(v, b)): ba lượt duyệt, O(N). Quy hoạch động đổi gốc (rerooting) cũng được. BFS từ từng đỉnh mất O(N²); Floyd-Warshall N³; LCA chỉ cho khoảng cách một cặp cho trước.",
      level: 3
    }
  ]);
})(typeof globalThis !== "undefined" ? globalThis : this);
