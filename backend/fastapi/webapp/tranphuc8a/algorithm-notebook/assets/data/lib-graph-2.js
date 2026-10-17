/* lib-graph-2.js — đồ thị (2): luồng, ghép cặp & phân công, phân rã cây (HLD, centroid), đường đi Euler, 2-SAT.
   Định dạng theo HUONG-DAN-SOAN.md (mẫu chuẩn: mục dijkstra trong lib-graph-1.js). */
(function (root) {
  "use strict";
  var A = root.Algo;

  A.lib.add([
    // ------------------------------------------------------------------------------------------------ dinic
    {
      id: "dinic",
      name: "Dinic (luồng cực đại)",
      aliases: ["dinic", "dinitz", "luồng cực đại", "max flow", "maximum flow", "blocking flow", "cắt nhỏ nhất", "min cut", "max-flow min-cut", "mạng luồng"],
      category: "graph",
      sub: "Luồng cực đại & chi phí nhỏ nhất",
      level: 4,
      tags: ["graph", "flow", "max-flow", "min-cut", "bfs", "dfs"],
      summary: "Tìm luồng cực đại (và cắt nhỏ nhất) từ nguồn s tới đích t trong mạng có dung lượng cạnh, bằng cách đẩy luồng chặn trên đồ thị phân tầng BFS.",
      description:
        "Mạng luồng là đồ thị có hướng, mỗi cạnh có **dung lượng**; cần đẩy nhiều nhất có thể từ nguồn `s` tới đích `t` sao cho mỗi cạnh không vượt dung lượng và mọi đỉnh khác `s`, `t` **bảo toàn luồng** (vào = ra). Mỗi cạnh luôn đi kèm một **cạnh ngược** dung lượng 0: đẩy luồng qua cạnh thì dung lượng cạnh giảm, cạnh ngược tăng — nhờ vậy về sau có thể \"rút lại\" luồng đã đẩy chưa khéo.\n\n" +
        "Dinic chạy theo **pha**: (1) BFS từ `s` trên các cạnh còn dung lượng để gán **tầng** `level[v]`; (2) DFS chỉ đi theo cạnh `level[v] = level[u] + 1` và dùng con trỏ `it[u]` để không duyệt lại cạnh đã bế tắc, nhờ đó đẩy được một **luồng chặn** (blocking flow) trong một lần; (3) lặp tới khi BFS không tới được `t`. Sau mỗi pha, khoảng cách ngắn nhất (theo số cạnh) từ `s` tới `t` tăng ít nhất 1, nên có không quá V pha.\n\n" +
        "Theo định lý **max-flow = min-cut**, giá trị luồng cực đại bằng dung lượng cắt nhỏ nhất. Khi kết thúc, tập đỉnh còn tới được từ `s` trong đồ thị phần dư (`level >= 0`) là phía `s` của một cắt nhỏ nhất — mẫu có sẵn `in_cut_side`. Nhiều bài \"chặn ít cạnh nhất\", \"số đường đi không chung cạnh\", ghép cặp hai phía đều quy về luồng.",
      conditions: [
        "Đồ thị có hướng (đồ thị vô hướng: mỗi cạnh {u, v} thêm add_edge(u, v, c, c)); cho phép cạnh song song và vòng tự trỏ",
        "Dung lượng nguyên không âm; tổng dung lượng các cạnh rời s phải vừa long long (< 9,2·10¹⁸)",
        "Một nguồn s và một đích t khác nhau (nhiều nguồn / nhiều đích: thêm siêu nguồn, siêu đích nối bằng cạnh dung lượng đủ lớn)"
      ],
      complexity: { time: "O(V²E)", space: "O(V+E)", note: "Mạng đơn vị (mọi dung lượng 1): O(E·min(V^(2/3), √E)); mạng ghép cặp hai phía: O(E√V). Trên thực tế chạy nhanh hơn cận trên rất nhiều." },
      ops: [["Một pha (BFS + luồng chặn)", "O(VE)"], ["Số pha tối đa", "O(V)"], ["Toàn bộ thuật toán", "O(V²E)"], ["Tìm cắt nhỏ nhất sau khi xong", "O(1) mỗi đỉnh"]],
      use_case: [
        "Luồng cực đại: băng thông mạng, vận chuyển, lượng hàng/dữ liệu tối đa",
        "Cắt nhỏ nhất: ít cạnh (hoặc đỉnh, sau khi tách đỉnh) nhất phải xoá để tách s khỏi t",
        "Số đường đi không chung cạnh từ s tới t (dung lượng mỗi cạnh = 1)",
        "Ghép cặp hai phía, phủ đỉnh nhỏ nhất, tập độc lập lớn nhất hai phía (qua định lý König)",
        "Bài mô hình hoá thành mạng: chọn / không chọn dự án (project selection = cắt nhỏ nhất), phân công, lập lịch"
      ],
      not_for: [
        "Mỗi đơn vị luồng có chi phí và cần tổng chi phí nhỏ nhất → Min Cost Flow",
        "Chỉ ghép cặp hai phía không trọng số, đồ thị lớn → Hopcroft–Karp / Kuhn gọn hơn (Dinic vẫn đúng, O(E√V))",
        "Phân công có trọng số, ma trận chi phí n×n dày, n vài trăm → Hungarian",
        "Đồ thị đường dài cả trăm nghìn đỉnh với bản đệ quy → dễ tràn stack, cần bản dfs không đệ quy"
      ],
      pitfalls: [
        "Quên cạnh ngược (dung lượng 0): thuật toán chỉ làm được luồng tham lam, không rút lại được nên kết quả thiếu.",
        "Đồ thị vô hướng: dùng MỘT cặp cạnh add_edge(u, v, c, c); luồng hai chiều triệt tiêu nhau nên đọc lại luồng thực trên cạnh phải lấy hiệu hai chiều.",
        "Dùng int cho dung lượng / luồng: tổng luồng dễ vượt 2·10⁹. Dùng long long, và đừng cộng INF với INF.",
        "Quên BFS lại ở MỌI pha hoặc quên đặt lại it[] về 0 làm bỏ sót đường tăng.",
        "dfs đệ quy sâu bằng độ dài đường tăng (tới V): đồ thị dạng đường vài trăm nghìn đỉnh có thể tràn stack.",
        "Liệt kê cạnh của cắt: lấy cạnh GỐC u→v có in_cut_side(u) và !in_cut_side(v); đừng lấy cạnh ngược hay mọi cạnh nối hai phía."
      ],
      code: {
        lang: "cpp", title: "dinic.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Dinic: luồng cực đại s -> t trên đồ thị có hướng. Đỉnh 0..n-1, dung lượng long long. Độ phức tạp O(V^2 E).
// add_edge(u, v, cap) thêm cạnh u->v kèm cạnh ngược (dung lượng 0). Đồ thị vô hướng: add_edge(u, v, c, c).
// Luồng thực qua cạnh có id (add_edge trả về) = e[id ^ 1].cap khi rev_cap = 0.
// Sau max_flow: in_cut_side(v) = v nằm phía s của một cắt nhỏ nhất.
// Cảnh báo: dfs đệ quy sâu tới độ dài đường tăng (<= n).
struct Dinic {
    struct Edge { int to; long long cap; };
    int n;
    vector<Edge> e;              // e[i] và e[i ^ 1] là cặp cạnh thuận / ngược
    vector<vector<int>> g;       // g[u] = chỉ số các cạnh rời u
    vector<int> level, it;
    Dinic(int n) : n(n), g(n), level(n), it(n) {}
    int add_edge(int u, int v, long long cap, long long rev_cap = 0) {
        g[u].push_back((int)e.size()); e.push_back({v, cap});
        g[v].push_back((int)e.size()); e.push_back({u, rev_cap});
        return (int)e.size() - 2;
    }
    bool bfs(int s, int t) {
        fill(level.begin(), level.end(), -1);
        queue<int> q;
        level[s] = 0; q.push(s);
        while (!q.empty()) {
            int u = q.front(); q.pop();
            for (int id : g[u])
                if (e[id].cap > 0 && level[e[id].to] < 0) { level[e[id].to] = level[u] + 1; q.push(e[id].to); }
        }
        return level[t] >= 0;
    }
    long long dfs(int u, int t, long long f) {
        if (u == t) return f;
        long long pushed = 0;
        for (int& i = it[u]; i < (int)g[u].size(); i++) {   // it[u]: bỏ qua cạnh đã bế tắc
            int id = g[u][i], v = e[id].to;
            if (e[id].cap > 0 && level[v] == level[u] + 1) {
                long long d = dfs(v, t, min(f - pushed, e[id].cap));
                if (d > 0) {
                    e[id].cap -= d; e[id ^ 1].cap += d; pushed += d;
                    if (pushed == f) return pushed;
                }
            }
        }
        return pushed;
    }
    long long max_flow(int s, int t) {
        if (s == t) return 0;
        long long flow = 0;
        while (bfs(s, t)) {
            fill(it.begin(), it.end(), 0);
            flow += dfs(s, t, numeric_limits<long long>::max());
        }
        return flow;
    }
    bool in_cut_side(int v) const { return level[v] >= 0; }   // dùng sau max_flow
};
`
      },
      example: {
        input: "4 5\n1 2 3\n1 3 2\n2 3 1\n2 4 2\n3 4 3\n1 4",
        output: "5",
        explain: "4 đỉnh, 5 cạnh có hướng (u v dung lượng), nguồn 1, đích 4. Đẩy 2 theo 1→2→4, 1 theo 1→2→3→4 và 2 theo 1→3→4: tổng 5. Cắt {1} | {2, 3, 4} có dung lượng 3 + 2 = 5 nên không thể đẩy hơn."
      },
      problems: [
        { site: "cses", id: "1694", name: "Download Speed" },
        { site: "cses", id: "1695", name: "Police Chase" },
        { site: "cses", id: "1696", name: "School Dance" },
        { site: "cses", id: "1711", name: "Distinct Routes" },
        { site: "cf", id: "546E", name: "Soldier and Traveling" },
        { site: "atcoder", name: "AtCoder Library Practice Contest D - Maxflow" }
      ],
      related: ["edmonds-karp", "min-cost-flow", "bipartite-matching", "hopcroft-karp", "bfs"],
      compare: { "Bài toán giải": "Luồng cực đại / cắt nhỏ nhất", "Cạnh âm": "Không áp dụng (dung lượng ≥ 0)", "Hợp với đồ thị": "Có hướng, dung lượng nguyên; nhanh cả khi dày lẫn khi mạng đơn vị", "Kết quả cho ra": "Giá trị luồng, luồng từng cạnh, cắt nhỏ nhất" },
      cards: [
        { q: "Định lý max-flow min-cut nói gì?", a: "Giá trị luồng cực đại từ s tới t bằng dung lượng nhỏ nhất của một cắt (tập cạnh chia đồ thị thành phía chứa s và phía chứa t)." },
        { q: "Vì sao mỗi cạnh phải đi kèm cạnh ngược dung lượng 0?", a: "Đẩy luồng qua cạnh làm cạnh ngược tăng dung lượng; đi qua cạnh ngược chính là rút lại luồng đã đẩy trước đó. Thiếu cạnh ngược thì tham lam có thể kẹt ở luồng chưa cực đại." },
        { q: "Độ phức tạp của Dinic? Trường hợp đặc biệt?", a: "O(V²E). Mạng đơn vị (dung lượng 1) khoảng O(E·min(V^(2/3), √E)); ghép cặp hai phía O(E√V)." },
        { q: "Sau khi chạy xong Dinic, tìm cắt nhỏ nhất thế nào?", a: "Lấy tập đỉnh còn tới được từ s qua cạnh còn dung lượng dư > 0 (level >= 0 sau lần BFS cuối). Các cạnh gốc từ tập này ra ngoài chính là một cắt nhỏ nhất." },
        { q: "Con trỏ it[u] trong DFS của Dinic để làm gì?", a: "Đánh dấu cạnh đã bế tắc (hết dung lượng hoặc dẫn tới ngõ cụt) trong pha hiện tại, để mỗi cạnh chỉ bị xét lại không quá một lần; nhờ đó mỗi pha tốn O(VE)." }
      ]
    },

    // ------------------------------------------------------------------------------------------------ edmonds-karp
    {
      id: "edmonds-karp",
      name: "Edmonds–Karp",
      aliases: ["edmonds karp", "edmonds-karp", "ford-fulkerson", "ford fulkerson", "đường tăng luồng", "augmenting path", "luồng cực đại", "max flow"],
      category: "graph",
      sub: "Luồng cực đại & chi phí nhỏ nhất",
      level: 3,
      tags: ["graph", "flow", "max-flow", "bfs", "augmenting-path"],
      summary: "Luồng cực đại bằng cách lặp: dùng BFS tìm đường tăng ngắn nhất (theo số cạnh) trong đồ thị phần dư rồi đẩy luồng theo nút cổ chai.",
      description:
        "Phương pháp **Ford–Fulkerson**: chừng nào còn một đường từ `s` tới `t` đi qua các cạnh còn dung lượng dư (**đường tăng** trong **đồ thị phần dư**), đẩy qua đường đó lượng bằng dung lượng dư nhỏ nhất (**nút cổ chai**), đồng thời cộng dung lượng vào các cạnh ngược. Hết đường tăng thì luồng đã cực đại.\n\n" +
        "Nếu chọn đường tăng bằng DFS tuỳ ý, số lần tăng có thể phụ thuộc vào GIÁ TRỊ dung lượng (ví dụ hai đường chung một cạnh dung lượng 1 làm mỗi lần chỉ tăng 1). **Edmonds–Karp** chọn đường bằng **BFS** — đường ngắn nhất theo số cạnh — và nhờ đó số lần tăng luồng chỉ O(VE) bất kể dung lượng: mỗi lần tăng làm bão hoà ít nhất một cạnh \"tới hạn\", và một cạnh chỉ có thể tới hạn O(V) lần.\n\n" +
        "Cài đặt rất ngắn (BFS + lần ngược theo `pre[]`), phù hợp khi mạng nhỏ hoặc cần viết nhanh; khi mạng lớn nên dùng Dinic. Sau khi xong, các đỉnh còn tới được từ `s` trong đồ thị phần dư là phía `s` của một cắt nhỏ nhất.",
      conditions: [
        "Đồ thị có hướng (vô hướng: add_edge(u, v, c, c)); cho phép cạnh song song và vòng tự trỏ",
        "Dung lượng nguyên không âm, dùng long long; số lần tăng không phụ thuộc giá trị dung lượng",
        "Một nguồn s và một đích t khác nhau"
      ],
      complexity: { time: "O(V·E²)", space: "O(V+E)", note: "Tối đa O(VE) lần tăng luồng, mỗi lần một BFS O(E). Thực tế nhanh hơn cận trên nhiều; mạng lớn dùng Dinic." },
      ops: [["Một lần tìm đường tăng (BFS)", "O(E)"], ["Số lần tăng luồng tối đa", "O(VE)"], ["Toàn bộ thuật toán", "O(VE²)"]],
      use_case: [
        "Luồng cực đại / cắt nhỏ nhất trên mạng nhỏ (V đến vài trăm), cần cài nhanh",
        "Học khái niệm đường tăng, đồ thị phần dư, cạnh ngược, cắt nhỏ nhất",
        "Bài ghép cặp, phân công nhỏ quy về luồng"
      ],
      not_for: [
        "Mạng lớn (V, E cỡ 10⁴–10⁵) → Dinic nhanh hơn rõ rệt",
        "Ghép cặp hai phía lớn → Hopcroft–Karp",
        "Luồng có chi phí → Min Cost Flow"
      ],
      pitfalls: [
        "Tìm đường bằng DFS thay BFS (Ford–Fulkerson thuần): với dung lượng lớn số lần tăng có thể tới hàng tỉ → TLE. Phải là BFS.",
        "Cập nhật dọc đường phải trừ cạnh thuận VÀ cộng cạnh ngược; quên một trong hai cho kết quả sai.",
        "Cặp cạnh thuận / ngược phải ở chỉ số i và i ^ 1; thêm lẻ một cạnh bằng push_back làm lệch cặp.",
        "Khởi tạo lại pre[] mỗi lần BFS; dùng int cho luồng dễ tràn khi dung lượng ~10⁹.",
        "Đồ thị vô hướng dùng MỘT cặp cạnh add_edge(u, v, c, c), đừng thêm hai cặp riêng."
      ],
      code: {
        lang: "cpp", title: "edmonds_karp.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Edmonds–Karp: luồng cực đại s -> t, mỗi lần tăng theo đường BFS ngắn nhất. Độ phức tạp O(V E^2).
// Đỉnh 0..n-1, dung lượng long long. add_edge(u, v, cap) thêm cạnh u->v kèm cạnh ngược (dung lượng 0).
// Đồ thị vô hướng: add_edge(u, v, c, c). Luồng thực qua cạnh id = e[id ^ 1].cap khi rev_cap = 0.
// min_cut_side(s): sau max_flow, cho biết đỉnh nào còn tới được từ s trong đồ thị phần dư (phía s của cắt nhỏ nhất).
struct EdmondsKarp {
    struct Edge { int to; long long cap; };
    int n;
    vector<Edge> e;              // e[i] và e[i ^ 1] là cặp cạnh thuận / ngược
    vector<vector<int>> g;       // g[u] = chỉ số các cạnh rời u
    EdmondsKarp(int n) : n(n), g(n) {}
    int add_edge(int u, int v, long long cap, long long rev_cap = 0) {
        g[u].push_back((int)e.size()); e.push_back({v, cap});
        g[v].push_back((int)e.size()); e.push_back({u, rev_cap});
        return (int)e.size() - 2;
    }
    long long max_flow(int s, int t) {
        if (s == t) return 0;
        long long flow = 0;
        while (true) {
            vector<int> pre(n, -1);          // pre[v] = id cạnh dẫn tới v trên đường BFS; pre[s] = -2
            queue<int> q;
            pre[s] = -2; q.push(s);
            while (!q.empty() && pre[t] == -1) {
                int u = q.front(); q.pop();
                for (int id : g[u])
                    if (e[id].cap > 0 && pre[e[id].to] == -1) { pre[e[id].to] = id; q.push(e[id].to); }
            }
            if (pre[t] == -1) return flow;   // hết đường tăng
            long long push = numeric_limits<long long>::max();
            for (int v = t; v != s; v = e[pre[v] ^ 1].to) push = min(push, e[pre[v]].cap);
            for (int v = t; v != s; v = e[pre[v] ^ 1].to) { e[pre[v]].cap -= push; e[pre[v] ^ 1].cap += push; }
            flow += push;
        }
    }
    vector<char> min_cut_side(int s) const {
        vector<char> seen(n, 0);
        vector<int> q = {s};
        seen[s] = 1;
        for (size_t i = 0; i < q.size(); i++)
            for (int id : g[q[i]])
                if (e[id].cap > 0 && !seen[e[id].to]) { seen[e[id].to] = 1; q.push_back(e[id].to); }
        return seen;
    }
};
`
      },
      example: {
        input: "4 5\n1 2 1\n1 3 1\n2 3 1\n2 4 1\n3 4 1\n1 4",
        output: "2",
        explain: "Nguồn 1, đích 4, mọi dung lượng 1. BFS tìm đường ngắn nhất 1→2→4 (đẩy 1), rồi 1→3→4 (đẩy 1); hết đường tăng. Cạnh 2→3 không cần dùng. Cắt gồm hai cạnh rời đỉnh 1 có dung lượng 2 nên luồng cực đại = 2."
      },
      problems: [
        { site: "cses", id: "1694", name: "Download Speed" },
        { site: "cses", id: "1695", name: "Police Chase" },
        { site: "cf", id: "546E", name: "Soldier and Traveling" }
      ],
      related: ["dinic", "min-cost-flow", "bfs", "bipartite-matching"],
      compare: { "Bài toán giải": "Luồng cực đại / cắt nhỏ nhất", "Cạnh âm": "Không áp dụng (dung lượng ≥ 0)", "Hợp với đồ thị": "Mạng nhỏ (V đến vài trăm); dung lượng lớn vẫn ổn", "Kết quả cho ra": "Giá trị luồng, luồng từng cạnh, cắt nhỏ nhất" },
      cards: [
        { q: "Edmonds–Karp khác Ford–Fulkerson ở điểm nào?", a: "Edmonds–Karp chọn đường tăng bằng BFS (ngắn nhất theo số cạnh); Ford–Fulkerson cho phép chọn đường tuỳ ý (thường DFS) nên số lần tăng có thể phụ thuộc giá trị dung lượng." },
        { q: "Độ phức tạp của Edmonds–Karp?", a: "O(V·E²): tối đa O(VE) lần tăng luồng, mỗi lần một BFS O(E); không phụ thuộc giá trị dung lượng." },
        { q: "Nút cổ chai của đường tăng là gì và dùng thế nào?", a: "Là dung lượng dư nhỏ nhất dọc đường. Đẩy đúng lượng đó: trừ khỏi các cạnh thuận, cộng vào các cạnh ngược." },
        { q: "Khi nào chọn Dinic thay vì Edmonds–Karp?", a: "Khi mạng lớn (V, E cỡ 10⁴ trở lên) hoặc cần chạy nhanh: Dinic tìm cả luồng chặn mỗi pha nên nhanh hơn nhiều." },
        { q: "Làm sao lấy cắt nhỏ nhất sau khi xong?", a: "BFS từ s qua các cạnh còn dung lượng dư; các đỉnh tới được là phía s, các cạnh gốc đi từ phía s ra ngoài là cắt nhỏ nhất." }
      ]
    },

    // ------------------------------------------------------------------------------------------------ min-cost-flow
    {
      id: "min-cost-flow",
      name: "Luồng chi phí nhỏ nhất (Min Cost Flow)",
      aliases: ["min cost flow", "mcmf", "min cost max flow", "successive shortest path", "luồng chi phí nhỏ nhất", "luồng cực đại chi phí nhỏ nhất", "ssp"],
      category: "graph",
      sub: "Luồng cực đại & chi phí nhỏ nhất",
      level: 4,
      tags: ["graph", "flow", "min-cost-flow", "shortest-path", "spfa"],
      summary: "Đẩy luồng từ s tới t với tổng chi phí nhỏ nhất (mỗi cạnh có dung lượng và chi phí cho mỗi đơn vị luồng), bằng cách lặp đường ngắn nhất theo chi phí trong đồ thị phần dư.",
      description:
        "Mỗi cạnh có thêm **chi phí** trên mỗi đơn vị luồng; cần đẩy một lượng luồng cho trước K (hoặc luồng cực đại) từ `s` tới `t` với tổng chi phí nhỏ nhất. Thuật toán **successive shortest paths**: lặp lại việc tìm đường ngắn nhất theo chi phí (SPFA / Bellman-Ford, vì cạnh ngược có chi phí ÂM) từ `s` tới `t` trên cạnh còn dung lượng dư, rồi đẩy luồng tối đa qua đường đó.\n\n" +
        "Cạnh ngược của cạnh có chi phí `c` mang chi phí `-c`: đẩy luồng ngược chính là huỷ một quyết định cũ nếu nó đắt. Chi phí nhỏ nhất của luồng giá trị k là hàm **lồi** theo k, nên đường ngắn nhất sau mỗi lần tăng không bao giờ rẻ hơn lần trước; mỗi lần dừng ở bất kỳ k nào đều cho chi phí tối ưu của đúng k đơn vị. Mẫu trả về cặp (luồng thực sự đẩy được, tổng chi phí) để so với K.\n\n" +
        "Khi mọi chi phí ban đầu không âm có thể tăng tốc bằng Dijkstra kèm thế (potential, kiểu Johnson), nhưng SPFA đơn giản hơn và xử lý được cả cạnh chi phí âm (miễn là không có chu trình âm). Bài phân công, k đường đi không chung cạnh ngắn nhất, vận chuyển có sức chứa... đều là Min Cost Flow.",
      conditions: [
        "Đồ thị có hướng; cạnh song song và vòng tự trỏ được (vòng tự trỏ chi phí ≥ 0 vô hại)",
        "Dung lượng nguyên không âm; chi phí nguyên, có thể âm nhưng không được có chu trình CHI PHÍ ÂM nào gồm toàn cạnh dung lượng > 0",
        "Cần đúng K đơn vị (so sánh luồng trả về với K) hoặc luồng cực đại (không truyền giới hạn)"
      ],
      complexity: { time: "O(F·V·E)", space: "O(V+E)", note: "F = giá trị luồng đẩy được (số lần tăng ≤ F); mỗi lần SPFA O(VE) xấu nhất nhưng thường gần O(E). Dijkstra + thế (chi phí không âm): O(F·E log V)." },
      ops: [["Một lần tìm đường (SPFA)", "O(VE)"], ["Một lần tìm đường (Dijkstra + thế)", "O(E log V)"], ["Số lần tăng luồng", "O(F)"]],
      use_case: [
        "Chuyển K đơn vị hàng từ kho này tới kho kia với tổng cước nhỏ nhất qua các tuyến có sức chứa",
        "K đường đi không chung cạnh có tổng độ dài nhỏ nhất",
        "Phân công / ghép cặp có trọng số (chi phí nhỏ nhất; muốn lớn nhất thì đổi dấu chi phí)",
        "Lập lịch, phủ khoảng với giới hạn số máy, các bài mô hình hoá thành luồng có chi phí"
      ],
      not_for: [
        "Chỉ cần giá trị luồng, không có chi phí → Dinic (nhanh hơn nhiều)",
        "Phân công n×n dày, n đến vài trăm → Hungarian O(n³) gọn và nhanh hơn",
        "Ghép cặp cực đại không trọng số → Hopcroft–Karp / Kuhn",
        "Luồng F rất lớn (hàng triệu đơn vị) với SPFA → dùng Dijkstra + thế hoặc thuật toán scaling"
      ],
      pitfalls: [
        "Có chu trình chi phí âm ban đầu làm SPFA lặp vô hạn hoặc kết quả sai — kiểm tra đề; cạnh chi phí âm đơn lẻ trên đồ thị không chu trình thì ổn.",
        "Cạnh ngược phải có chi phí −cost và dung lượng 0 (không phải cost).",
        "Cần đúng K đơn vị: nếu luồng trả về < K thì bài vô nghiệm (đề thường yêu cầu in -1).",
        "Với chi phí âm, mẫu cho chi phí nhỏ nhất của luồng CỰC ĐẠI (hoặc đúng K), không phải 'dừng khi hết lợi'. Muốn chi phí nhỏ nhất trên mọi giá trị luồng thì dừng ngay khi đường ngắn nhất có chi phí ≥ 0.",
        "Tràn số: chi phí × lượng luồng có thể vượt 2³¹ — dùng long long cho chi phí cạnh, khoảng cách và tổng chi phí.",
        "Đẩy theo nút cổ chai (không phải 1 đơn vị mỗi lần) để số lần tăng nhỏ."
      ],
      code: {
        lang: "cpp", title: "min_cost_flow.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Min Cost Flow (successive shortest paths + SPFA). Đỉnh 0..n-1.
// add_edge(u, v, cap, cost): cạnh u->v dung lượng cap, chi phí cost mỗi đơn vị (kèm cạnh ngược dung lượng 0, chi phí -cost).
// Chi phí cạnh có thể ÂM nhưng không được có chu trình chi phí âm. Luồng thực qua cạnh id = e[id ^ 1].cap.
// min_cost_flow(s, t, limit): đẩy tối đa limit đơn vị (mặc định: luồng cực đại) -> (luồng thực đẩy được, tổng chi phí).
// Mỗi lần tìm đường ngắn nhất theo chi phí rồi đẩy theo nút cổ chai. Độ phức tạp O(F * V * E) xấu nhất.
struct MinCostFlow {
    struct Edge { int to; long long cap, cost; };
    static constexpr long long INF = (long long)4e18;
    int n;
    vector<Edge> e;              // e[i] và e[i ^ 1] là cặp cạnh thuận / ngược
    vector<vector<int>> g;
    MinCostFlow(int n) : n(n), g(n) {}
    int add_edge(int u, int v, long long cap, long long cost) {
        g[u].push_back((int)e.size()); e.push_back({v, cap, cost});
        g[v].push_back((int)e.size()); e.push_back({u, 0, -cost});
        return (int)e.size() - 2;
    }
    pair<long long, long long> min_cost_flow(int s, int t, long long limit = INF) {
        long long flow = 0, cost = 0;
        if (s == t) return {0, 0};
        vector<long long> dist(n);
        vector<int> pre(n);
        vector<char> inq(n);
        while (flow < limit) {
            fill(dist.begin(), dist.end(), INF);
            fill(pre.begin(), pre.end(), -1);
            queue<int> q;
            dist[s] = 0; q.push(s); inq[s] = 1;
            while (!q.empty()) {                          // SPFA
                int u = q.front(); q.pop(); inq[u] = 0;
                for (int id : g[u]) {
                    int v = e[id].to;
                    if (e[id].cap > 0 && dist[u] + e[id].cost < dist[v]) {
                        dist[v] = dist[u] + e[id].cost; pre[v] = id;
                        if (!inq[v]) { inq[v] = 1; q.push(v); }
                    }
                }
            }
            if (dist[t] == INF) break;                    // hết đường tăng
            long long push = limit - flow;
            for (int v = t; v != s; v = e[pre[v] ^ 1].to) push = min(push, e[pre[v]].cap);
            for (int v = t; v != s; v = e[pre[v] ^ 1].to) { e[pre[v]].cap -= push; e[pre[v] ^ 1].cap += push; }
            flow += push; cost += push * dist[t];
        }
        return {flow, cost};
    }
};
`
      },
      example: {
        input: "4 5 3\n1 2 2 1\n1 3 1 2\n2 3 1 1\n2 4 1 3\n3 4 2 1\n1 4",
        output: "3 10",
        explain: "n m K, rồi m cạnh (u v dung lượng chi phí), nguồn 1, đích 4, cần K = 3 đơn vị. Đường rẻ nhất 1→2→3→4 (chi phí 3, đẩy 1), tiếp 1→3→4 (chi phí 3, đẩy 1), cuối 1→2→4 (chi phí 4, đẩy 1): tổng 3 + 3 + 4 = 10. Mọi cạnh ra khỏi đỉnh 1 đều đầy nên không thể đẩy hơn 3."
      },
      problems: [
        { site: "cses", id: "2121", name: "Parcel Delivery" },
        { site: "cses", id: "2129", name: "Task Assignment" },
        { site: "cf", id: "277E", name: "Binary Tree on Plane" },
        { site: "atcoder", name: "AtCoder Library Practice Contest E - MinCostFlow" }
      ],
      related: ["dinic", "edmonds-karp", "hungarian", "bellman-ford", "spfa", "dijkstra", "bipartite-matching"],
      compare: { "Bài toán giải": "Luồng K đơn vị (hoặc cực đại) với tổng chi phí nhỏ nhất", "Cạnh âm": "Được nếu không có chu trình âm (SPFA / Bellman-Ford)", "Hợp với đồ thị": "Có hướng thưa hoặc vừa; luồng F không quá lớn", "Kết quả cho ra": "(luồng, tổng chi phí) và luồng trên từng cạnh" },
      cards: [
        { q: "Cạnh ngược trong Min Cost Flow có chi phí bao nhiêu và vì sao?", a: "−cost, dung lượng 0. Đẩy luồng qua cạnh ngược là huỷ luồng cũ trên cạnh thuận nên phải hoàn lại đúng chi phí đã trả." },
        { q: "Thuật toán successive shortest paths làm gì mỗi bước?", a: "Tìm đường ngắn nhất theo chi phí từ s tới t trên các cạnh còn dung lượng dư (SPFA / Bellman-Ford vì có chi phí âm), đẩy luồng theo nút cổ chai, lặp đến đủ K đơn vị hoặc hết đường." },
        { q: "Khi nào Min Cost Flow vô nghiệm với yêu cầu đúng K đơn vị?", a: "Khi luồng cực đại nhỏ hơn K: hàm trả về luồng thực đẩy được < K." },
        { q: "Có chu trình chi phí âm thì sao?", a: "Thuật toán đường ngắn nhất không còn đúng (SPFA lặp vô hạn). Phải khử chu trình âm trước hoặc dùng cách khác." },
        { q: "Phân công n×n nên dùng Min Cost Flow hay Hungarian?", a: "Ma trận dày n đến vài trăm thì Hungarian O(n³) nhanh và gọn hơn; Min Cost Flow tổng quát hơn (đồ thị thưa, có sức chứa, nhiều ràng buộc)." }
      ]
    },

    // ------------------------------------------------------------------------------------------------ bipartite-matching
    {
      id: "bipartite-matching",
      name: "Ghép cặp cực đại (Kuhn)",
      aliases: ["kuhn", "thuật toán kuhn", "ghép cặp", "bipartite matching", "maximum matching", "ghép cặp hai phía", "đường tăng xen kẽ", "augmenting path", "phủ đỉnh nhỏ nhất", "konig", "tập độc lập lớn nhất"],
      category: "graph",
      sub: "Ghép cặp & phân công",
      level: 3,
      tags: ["graph", "matching", "bipartite", "dfs", "augmenting-path"],
      summary: "Tìm ghép cặp có nhiều cạnh nhất trong đồ thị hai phía bằng cách lặp tìm đường tăng xen kẽ bằng DFS (thuật toán Kuhn).",
      description:
        "**Ghép cặp** là tập cạnh đôi một không chung đỉnh. Trong đồ thị hai phía (trái L, phải R), **đường tăng xen kẽ** bắt đầu ở một đỉnh trái chưa ghép, đi theo cạnh chưa ghép sang phải, quay về trái theo cạnh đã ghép, ..., kết thúc ở một đỉnh phải chưa ghép. Lật dọc đường (cạnh ghép thành không ghép và ngược lại) làm ghép cặp tăng đúng 1. Định lý **Berge**: ghép cặp là cực đại khi và chỉ khi không còn đường tăng.\n\n" +
        "Thuật toán **Kuhn** thử từng đỉnh trái chưa ghép: DFS đi tới đỉnh phải `v`, nếu `v` chưa ghép thì ghép luôn, nếu đã ghép với `u'` thì thử \"đẩy\" `u'` sang đỉnh phải khác (gọi đệ quy). Mảng `vis` đánh dấu đỉnh phải đã thăm để mỗi lần tìm đường tốn O(E). Bản trong mẫu dùng thêm mẹo chạy theo lượt: một lượt duyệt mọi đỉnh trái chưa ghép với chung một mảng `vis`, lặp đến khi một lượt không tăng được nữa — nhanh hơn nhiều trên dữ liệu thật mà vẫn đúng.\n\n" +
        "Hệ quả **König** (chỉ cho đồ thị hai phía): kích thước ghép cực đại = kích thước phủ đỉnh nhỏ nhất; tập độc lập lớn nhất = |L| + |R| − ghép cực đại. Phủ đường đi nhỏ nhất (không chung đỉnh) trên DAG = n − ghép cực đại sau khi tách mỗi đỉnh thành hai phía.",
      conditions: [
        "Đồ thị HAI PHÍA: đỉnh trái 0..nl-1, đỉnh phải 0..nr-1 đánh chỉ số độc lập (không cộng nl); đồ thị tổng quát cần thuật toán Blossom",
        "Cạnh song song được (không ảnh hưởng tính đúng)",
        "Không trọng số (có trọng số → Hungarian / Min Cost Flow)"
      ],
      complexity: { time: "O(V·E)", space: "O(V+E)", note: "Chính xác O(|L|·E). Mẹo chạy theo lượt làm nhanh hơn nhiều trên dữ liệu thực nhưng cận xấu nhất vẫn O(VE); cần bảo đảm O(E√V) thì dùng Hopcroft–Karp." },
      ops: [["Một lần tìm đường tăng (DFS)", "O(E)"], ["Toàn bộ thuật toán", "O(V·E)"], ["Bộ nhớ", "O(V+E)"]],
      use_case: [
        "Phân công: mỗi người một việc, mỗi việc một người, biết ai làm được việc nào",
        "Xếp cặp sinh viên–đề tài, thợ–máy, ô đen–ô trắng (lát domino)",
        "Phủ đỉnh nhỏ nhất / tập độc lập lớn nhất / phủ đường đi nhỏ nhất trên DAG (qua König)",
        "Bài 'chọn tối thiểu hàng hoặc cột để xoá hết các ô đặc biệt' (phủ đỉnh trong đồ thị hàng–cột)"
      ],
      not_for: [
        "Đồ thị rất lớn (hàng trăm nghìn đỉnh) cần bảo đảm thời gian → Hopcroft–Karp",
        "Có trọng số → Hungarian hoặc Min Cost Flow",
        "Đồ thị không hai phía (có chu trình lẻ) → thuật toán Blossom (Edmonds)"
      ],
      pitfalls: [
        "Quên xoá mảng vis đúng chỗ: bản đơn giản xoá trước mỗi đỉnh trái, bản theo lượt xoá trước mỗi lượt. Sai chỗ thì thiếu đường tăng.",
        "Nhầm kích thước hai phía: nl khác nr; chỉ số đỉnh phải bắt đầu từ 0 độc lập với đỉnh trái.",
        "DFS đệ quy sâu tới |L|: đồ thị dạng đường hàng trăm nghìn đỉnh có thể tràn stack.",
        "Không chắc đồ thị hai phía: phải chứng minh (ví dụ tô ô cờ đen–trắng) hoặc kiểm tra bằng BFS tô hai màu.",
        "Nhớ đúng König: phủ đỉnh nhỏ nhất = ghép cực đại; tập độc lập lớn nhất = |L| + |R| − ghép cực đại (chỉ hai phía).",
        "Dữ liệu xấu có thể khiến Kuhn thuần chạy chậm: ghép tham lam trước hoặc xáo thứ tự đỉnh trái giúp nhanh hơn."
      ],
      code: {
        lang: "cpp", title: "kuhn.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Kuhn: ghép cặp cực đại trong đồ thị hai phía. Đỉnh trái 0..nl-1, đỉnh phải 0..nr-1 (chỉ số độc lập nhau).
// add_edge(u, v): cạnh giữa đỉnh trái u và đỉnh phải v. max_matching() trả về số cặp.
// match_l[u] = đỉnh phải ghép với u (-1 nếu chưa), match_r[v] = đỉnh trái ghép với v (-1 nếu chưa).
// Độ phức tạp O(V * E) xấu nhất. Cảnh báo: try_augment đệ quy sâu tới nl.
struct Kuhn {
    int nl, nr;
    vector<vector<int>> adj;       // adj[u] = các đỉnh phải kề đỉnh trái u
    vector<int> match_l, match_r;
    vector<char> vis;              // vis[v]: đỉnh phải v đã thăm trong lượt hiện tại
    Kuhn(int nl, int nr) : nl(nl), nr(nr), adj(nl) {}
    void add_edge(int u, int v) { adj[u].push_back(v); }
    bool try_augment(int u) {
        for (int v : adj[u]) {
            if (vis[v]) continue;
            vis[v] = 1;
            if (match_r[v] == -1 || try_augment(match_r[v])) { match_l[u] = v; match_r[v] = u; return true; }
        }
        return false;
    }
    int max_matching() {
        match_l.assign(nl, -1);
        match_r.assign(nr, -1);
        int res = 0;
        for (bool found = true; found; ) {          // mỗi lượt dùng chung vis; lặp tới khi không tăng được nữa
            found = false;
            vis.assign(nr, 0);
            for (int u = 0; u < nl; u++)
                if (match_l[u] == -1 && try_augment(u)) { found = true; res++; }
        }
        return res;
    }
};
`
      },
      example: {
        input: "3 3 5\n1 1\n1 2\n2 1\n3 2\n3 3",
        output: "3",
        explain: "3 đỉnh trái, 3 đỉnh phải, 5 cạnh (trái phải). Tham lam ghép 1–1; đỉnh trái 2 chỉ muốn đỉnh phải 1 nên tìm đường tăng 2→(phải 1)→(trái 1)→(phải 2): đổi thành 1–2, 2–1. Đỉnh trái 3 ghép với phải 3. Cả 3 cặp được ghép."
      },
      problems: [
        { site: "cses", id: "1696", name: "School Dance" },
        { site: "cses", id: "1709", name: "Coin Grid" },
        { site: "lc", name: "Maximum Number of Accepted Invitations" }
      ],
      related: ["hopcroft-karp", "dinic", "hungarian", "dfs"],
      compare: { "Bài toán giải": "Ghép cặp cực đại hai phía không trọng số", "Cạnh âm": "Không áp dụng (không trọng số)", "Hợp với đồ thị": "Hai phía, thưa hoặc vừa (V·E không quá ~10⁸)", "Kết quả cho ra": "Số cặp và các cặp được ghép" },
      cards: [
        { q: "Đường tăng xen kẽ là gì?", a: "Đường bắt đầu ở đỉnh chưa ghép bên trái, luân phiên cạnh chưa ghép và cạnh đã ghép, kết thúc ở đỉnh chưa ghép bên phải. Lật dọc đường làm ghép cặp tăng 1." },
        { q: "Khi nào ghép cặp là cực đại?", a: "Khi và chỉ khi không còn đường tăng (định lý Berge)." },
        { q: "Độ phức tạp của Kuhn? Khi nào chuyển sang Hopcroft–Karp?", a: "O(V·E). Khi V, E cỡ 10⁵ và cần bảo đảm thời gian thì dùng Hopcroft–Karp O(E√V)." },
        { q: "Định lý König cho hệ quả gì?", a: "Trong đồ thị hai phía: ghép cực đại = phủ đỉnh nhỏ nhất, và tập độc lập lớn nhất = |L| + |R| − ghép cực đại." },
        { q: "Vì sao phải xoá mảng vis, và xoá khi nào?", a: "vis tránh thăm lại đỉnh phải trong cùng một lần tìm đường. Bản đơn giản xoá trước mỗi đỉnh trái được thử; bản theo lượt (như mẫu) xoá một lần ở đầu mỗi lượt rồi dùng chung cho mọi đỉnh trái trong lượt đó." }
      ]
    },

    // ------------------------------------------------------------------------------------------------ hopcroft-karp
    {
      id: "hopcroft-karp",
      name: "Hopcroft–Karp",
      aliases: ["hopcroft karp", "hopcroft-karp", "hk", "ghép cặp nhanh", "ghép cặp hai phía lớn", "maximum bipartite matching", "o(e sqrt v)"],
      category: "graph",
      sub: "Ghép cặp & phân công",
      level: 4,
      tags: ["graph", "matching", "bipartite", "bfs", "dfs", "layered-graph"],
      summary: "Ghép cặp cực đại hai phía trong O(E√V): mỗi pha dùng BFS phân tầng rồi DFS tìm nhiều đường tăng ngắn nhất cùng lúc.",
      description:
        "Kuhn tìm từng đường tăng một. **Hopcroft–Karp** tìm cả một tập đường tăng NGẮN NHẤT đôi một không giao nhau trong mỗi **pha**: BFS từ mọi đỉnh trái chưa ghép, đi xen kẽ cạnh chưa ghép / đã ghép để gán **tầng** `dist` cho đỉnh trái, và dừng khi gặp tầng đầu tiên có đỉnh kề một đỉnh phải tự do (tầng `lim`); sau đó DFS chỉ đi theo tầng tăng dần và chỉ nhận đỉnh phải tự do ở đúng tầng `lim`.\n\n" +
        "Sau mỗi pha độ dài đường tăng ngắn nhất tăng ít nhất 1, và sau khoảng √V pha chỉ còn tối đa √V đường tăng cần tìm (vì các đường đó phải đôi một rời nhau). Vậy tổng số pha O(√V), mỗi pha O(E) nên tổng O(E√V). Đây cũng chính là Dinic chạy trên mạng ghép cặp đơn vị.\n\n" +
        "Dùng khi đồ thị hai phía lớn (V, E cỡ 10⁵–10⁶) và cần chắc chắn về thời gian. Các hệ quả König (phủ đỉnh nhỏ nhất, tập độc lập lớn nhất) dùng y hệt như với Kuhn.",
      conditions: [
        "Đồ thị HAI PHÍA: đỉnh trái 0..nl-1, đỉnh phải 0..nr-1 đánh chỉ số độc lập; cạnh song song được",
        "Không trọng số (có trọng số → Hungarian / Min Cost Flow)",
        "Đồ thị tổng quát (không hai phía) cần Blossom"
      ],
      complexity: { time: "O(E√V)", space: "O(V+E)", note: "Số pha O(√V), mỗi pha một BFS và một lượt DFS đều O(E)." },
      ops: [["Một pha (BFS + DFS)", "O(E)"], ["Số pha", "O(√V)"], ["Toàn bộ thuật toán", "O(E√V)"]],
      use_case: [
        "Ghép cặp hai phía với V, E cỡ 10⁵–10⁶",
        "Phủ đỉnh nhỏ nhất, tập độc lập lớn nhất trong đồ thị hai phía lớn (qua König)",
        "Phủ đường đi nhỏ nhất trên DAG lớn (tách mỗi đỉnh thành hai phía)"
      ],
      not_for: [
        "Bài nhỏ (V đến vài nghìn): Kuhn ngắn hơn và đủ nhanh",
        "Có trọng số → Hungarian hoặc Min Cost Flow",
        "Đồ thị không hai phía → Blossom"
      ],
      pitfalls: [
        "Bỏ điều kiện tầng khi nhận đỉnh phải tự do (dist[u] == lim): kết quả vẫn đúng nhưng mất bảo đảm O(E√V) của phân tích.",
        "Phải BFS lại ở MỖI pha: tầng cũ vô nghĩa sau khi ghép cặp thay đổi.",
        "Quên đánh dấu dist[u] = -1 khi DFS từ u thất bại: sẽ thăm lại ngõ cụt trong pha và chậm hẳn.",
        "DFS đệ quy sâu bằng độ dài đường tăng (≤ V): đường rất dài có thể tràn stack.",
        "Chỉ số đỉnh phải bắt đầu từ 0 độc lập với đỉnh trái; nl và nr khác nhau."
      ],
      code: {
        lang: "cpp", title: "hopcroft_karp.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Hopcroft–Karp: ghép cặp cực đại hai phía trong O(E sqrt V). Đỉnh trái 0..nl-1, đỉnh phải 0..nr-1 (độc lập nhau).
// add_edge(u, v): cạnh giữa đỉnh trái u và đỉnh phải v. max_matching() trả về số cặp.
// match_l[u] = đỉnh phải ghép với u (-1 nếu chưa), match_r[v] = đỉnh trái ghép với v (-1 nếu chưa).
// Cảnh báo: dfs đệ quy sâu tới độ dài đường tăng (<= nl).
struct HopcroftKarp {
    int nl, nr, lim;
    vector<vector<int>> adj;
    vector<int> match_l, match_r, dist;     // dist[u] = tầng của đỉnh trái u trong pha hiện tại (-1: chưa tới / ngõ cụt)
    HopcroftKarp(int nl, int nr) : nl(nl), nr(nr), lim(0), adj(nl), match_l(nl, -1), match_r(nr, -1), dist(nl) {}
    void add_edge(int u, int v) { adj[u].push_back(v); }
    bool bfs() {                            // phân tầng đỉnh trái; lim = tầng ngắn nhất có đường tăng
        fill(dist.begin(), dist.end(), -1);
        queue<int> q;
        for (int u = 0; u < nl; u++) if (match_l[u] == -1) { dist[u] = 0; q.push(u); }
        lim = INT_MAX;
        while (!q.empty()) {
            int u = q.front(); q.pop();
            if (dist[u] >= lim) break;      // không cần các tầng sâu hơn tầng có đường tăng
            for (int v : adj[u]) {
                int w = match_r[v];
                if (w == -1) lim = dist[u];
                else if (dist[w] == -1) { dist[w] = dist[u] + 1; q.push(w); }
            }
        }
        return lim != INT_MAX;
    }
    bool dfs(int u) {
        for (int v : adj[u]) {
            int w = match_r[v];
            if (w == -1 ? dist[u] == lim : (dist[w] == dist[u] + 1 && dfs(w))) {
                match_l[u] = v; match_r[v] = u;
                return true;
            }
        }
        dist[u] = -1;                       // ngõ cụt: không thăm lại trong pha này
        return false;
    }
    int max_matching() {
        int res = 0;
        while (bfs())
            for (int u = 0; u < nl; u++)
                if (match_l[u] == -1 && dfs(u)) res++;
        return res;
    }
};
`
      },
      example: {
        input: "4 4 6\n1 1\n1 2\n2 1\n3 2\n3 3\n4 3",
        output: "3",
        explain: "4 đỉnh trái, 4 đỉnh phải, 6 cạnh (trái phải). Cả 4 đỉnh trái chỉ kề tới các đỉnh phải {1, 2, 3} nên ghép tối đa 3 (đỉnh phải 4 cô lập). Một ghép 3 cặp: 1–2, 2–1, 4–3."
      },
      problems: [
        { site: "cses", id: "1696", name: "School Dance" },
        { site: "cses", id: "1709", name: "Coin Grid" },
        { site: "other", name: "Library Checker: Matching on Bipartite Graph" }
      ],
      related: ["bipartite-matching", "dinic", "hungarian"],
      compare: { "Bài toán giải": "Ghép cặp cực đại hai phía không trọng số", "Cạnh âm": "Không áp dụng (không trọng số)", "Hợp với đồ thị": "Hai phía, thưa hoặc dày, V và E tới 10⁵–10⁶", "Kết quả cho ra": "Số cặp và các cặp được ghép" },
      cards: [
        { q: "Điểm khác của Hopcroft–Karp so với Kuhn?", a: "Mỗi pha tìm cả một tập đường tăng ngắn nhất đôi một rời nhau (BFS phân tầng + DFS theo tầng) thay vì từng đường một." },
        { q: "Vì sao số pha chỉ O(√V)?", a: "Sau mỗi pha đường tăng ngắn nhất dài thêm ít nhất 1. Khi đã dài ≥ √V thì chỉ còn tối đa V/√V = √V đường tăng rời nhau cần tìm." },
        { q: "Độ phức tạp của Hopcroft–Karp?", a: "O(E√V) thời gian, O(V+E) bộ nhớ." },
        { q: "Tầng lim dùng để làm gì?", a: "Là tầng đỉnh trái đầu tiên kề một đỉnh phải tự do. DFS chỉ nhận đỉnh phải tự do ở đúng tầng này để chỉ đẩy các đường tăng ngắn nhất." },
        { q: "Hopcroft–Karp có liên hệ gì với Dinic?", a: "Chính là Dinic chạy trên mạng ghép cặp đơn vị (nguồn → trái → phải → đích, dung lượng 1)." }
      ]
    },

    // ------------------------------------------------------------------------------------------------ hungarian
    {
      id: "hungarian",
      name: "Hungarian (bài toán phân công)",
      aliases: ["hungarian", "kuhn-munkres", "kuhn munkres", "km", "munkres", "bài toán phân công", "assignment problem", "phân công", "ghép cặp có trọng số"],
      category: "graph",
      sub: "Ghép cặp & phân công",
      level: 4,
      tags: ["graph", "assignment", "matching", "weighted-matching", "potentials"],
      summary: "Giải bài toán phân công n hàng vào m cột (n ≤ m) với tổng chi phí nhỏ nhất trong O(n²m) bằng thuật toán Hungarian dạng thế (potential).",
      description:
        "Cho ma trận chi phí `a[i][j]`; chọn cho mỗi hàng đúng một cột, các cột khác nhau, sao cho tổng chi phí nhỏ nhất (ghép cặp hoàn hảo có trọng số nhỏ nhất trong đồ thị hai phía đầy đủ). Thuật toán duy trì **thế** `u[i]`, `v[j]` thoả `u[i] + v[j] ≤ a[i][j]`; các ô đạt dấu bằng tạo thành **đồ thị bằng nhau**, và trên đồ thị đó thuật toán tìm đường tăng như Kuhn.\n\n" +
        "Thêm lần lượt từng hàng: tìm đường tăng trong đồ thị bằng nhau (duyệt theo cột chưa thăm có độ chênh `minv` nhỏ nhất). Nếu chưa có đường thì giảm thế các đỉnh đã thăm đi `delta` = độ chênh nhỏ nhất để xuất hiện thêm ô đạt dấu bằng, rồi tìm tiếp. Mỗi hàng tốn O(nm) nên tổng O(n²m); với ma trận vuông O(n³). Khi kết thúc, tổng chi phí tối ưu là −v[0] (tổng các thế).\n\n" +
        "Chi phí có thể âm. Muốn TỐI ĐA hoá tổng thì đổi dấu mọi ô (kết quả đổi dấu lại). Nếu n > m, chuyển vị ma trận (hoặc thêm cột giả chi phí 0 khi cho phép bỏ trống).",
      conditions: [
        "Ma trận chi phí a[i][j] kích thước n×m với n ≤ m (n > m: chuyển vị hoặc thêm cột giả)",
        "Chi phí nguyên (có thể âm); mỗi hàng nhận đúng một cột, mỗi cột tối đa một hàng",
        "Đồ thị hai phía ĐẦY ĐỦ: ô không được phép dùng gán chi phí lớn (nhưng không gây tràn)"
      ],
      complexity: { time: "O(n²·m)", space: "O(n+m)", note: "Ma trận vuông n×n: O(n³). Bộ nhớ chỉ tính phần thêm ngoài ma trận chi phí." },
      ops: [["Thêm một hàng (tìm đường tăng + chỉnh thế)", "O(n·m)"], ["Toàn bộ thuật toán", "O(n²·m)"], ["Bộ nhớ phụ", "O(n+m)"]],
      use_case: [
        "Phân công n người cho n việc với chi phí khác nhau, n đến vài trăm (có thể ~1000)",
        "Ghép cặp có trọng số nhỏ nhất / lớn nhất trong đồ thị hai phía đầy đủ",
        "Bước ghép đối tượng cũ với phát hiện mới trong theo dõi đối tượng (tracking)",
        "Thay thế bitmask DP 2ⁿ khi n lớn hơn 20 nhưng vẫn cỡ vài trăm"
      ],
      not_for: [
        "Đồ thị hai phía thưa, n cỡ 10⁵ → Min Cost Flow (hoặc Hopcroft–Karp nếu không trọng số)",
        "Chỉ cần ghép cặp cực đại, không trọng số → Kuhn / Hopcroft–Karp",
        "Đồ thị không hai phía có trọng số → Blossom có trọng số"
      ],
      pitfalls: [
        "Cần n ≤ m: nếu n > m phải chuyển vị ma trận, nếu không việc tìm cột tự do hỏng.",
        "Ô cấm: dùng chi phí lớn hơn tổng chi phí hợp lệ nhưng đủ nhỏ để không tràn long long khi cộng dồn (INF = 4e18 sẽ tràn).",
        "Tối đa hoá: đổi dấu ma trận và đổi dấu lại kết quả, đừng quên.",
        "Chỉ số bên trong là 1-based (cột 0 là cột giả); tự viết lại dễ lệch một — dùng nguyên mẫu, ngoài vào/ra là 0-based.",
        "n = m = 5000 (≈ 10¹¹ phép) quá chậm: cần mô hình đặc thù hoặc luồng trên đồ thị thưa."
      ],
      code: {
        lang: "cpp", title: "hungarian.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Hungarian: phân công chi phí nhỏ nhất, ma trận a (n hàng x m cột), BẮT BUỘC n <= m, chỉ số 0-based.
// Trả về tổng chi phí nhỏ nhất; nếu truyền assign thì assign[i] = cột được gán cho hàng i.
// Chi phí có thể âm. Tối đa hoá: đổi dấu ma trận. Độ phức tạp O(n^2 m).
long long hungarian(const vector<vector<long long>>& a, vector<int>* assign = nullptr) {
    int n = a.size(), m = n ? a[0].size() : 0;
    const long long INF = (long long)4e18;
    vector<long long> u(n + 1, 0), v(m + 1, 0);      // thế của hàng / cột (1-based, cột 0 là cột giả)
    vector<int> p(m + 1, 0), way(m + 1, 0);          // p[j] = hàng đang chiếm cột j (0 = trống)
    for (int i = 1; i <= n; i++) {
        p[0] = i;
        int j0 = 0;
        vector<long long> minv(m + 1, INF);
        vector<char> used(m + 1, 0);
        do {                                          // tìm đường tăng cho hàng i
            used[j0] = 1;
            int i0 = p[j0], j1 = 0;
            long long delta = INF;
            for (int j = 1; j <= m; j++) {
                if (used[j]) continue;
                long long cur = a[i0 - 1][j - 1] - u[i0] - v[j];
                if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
                if (minv[j] < delta) { delta = minv[j]; j1 = j; }
            }
            for (int j = 0; j <= m; j++) {
                if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
                else minv[j] -= delta;
            }
            j0 = j1;
        } while (p[j0] != 0);
        do { int j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);   // lật dọc đường
    }
    if (assign) {
        assign->assign(n, -1);
        for (int j = 1; j <= m; j++) if (p[j]) (*assign)[p[j] - 1] = j - 1;
    }
    return -v[0];
}
`
      },
      example: {
        input: "3\n9 2 7\n6 4 3\n5 8 1",
        output: "9\n2 1 3",
        explain: "Ma trận chi phí 3×3. Trong 6 hoán vị, tốt nhất là hàng 1→cột 2 (2), hàng 2→cột 1 (6), hàng 3→cột 3 (1): tổng 9. Dòng 2 in cột được gán cho từng hàng (1-based)."
      },
      problems: [
        { site: "cses", id: "2129", name: "Task Assignment" },
        { site: "other", name: "Library Checker: Assignment Problem" }
      ],
      related: ["bipartite-matching", "hopcroft-karp", "min-cost-flow", "dinic", "bitmask-dp"],
      compare: { "Bài toán giải": "Phân công chi phí nhỏ nhất (ghép cặp hoàn hảo có trọng số)", "Cạnh âm": "Được (chi phí âm hợp lệ)", "Hợp với đồ thị": "Hai phía ĐẦY ĐỦ n×m, n đến ~1000", "Kết quả cho ra": "Tổng chi phí nhỏ nhất và cột được gán cho từng hàng" },
      cards: [
        { q: "Hungarian giải bài toán gì và độ phức tạp?", a: "Phân công chi phí nhỏ nhất cho ma trận n×m (n ≤ m): O(n²m), vuông thì O(n³)." },
        { q: "'Thế' (potential) u[i], v[j] trong Hungarian dùng để làm gì?", a: "Giữ u[i] + v[j] ≤ a[i][j]; các ô dấu bằng tạo thành đồ thị bằng nhau, tìm đường tăng trên đó thì ghép cặp tìm được là tối ưu. Khi hết đường thì giảm thế đi độ chênh nhỏ nhất để thêm ô dấu bằng." },
        { q: "Muốn tối đa hoá tổng thì làm sao?", a: "Đổi dấu mọi ô của ma trận, chạy Hungarian rồi đổi dấu kết quả." },
        { q: "Nếu số hàng lớn hơn số cột thì xử lý thế nào?", a: "Chuyển vị ma trận để có n ≤ m (nếu cho phép bỏ trống bớt hàng thì thêm cột giả chi phí 0)." },
        { q: "Hungarian khác Min Cost Flow ở điểm nào?", a: "Hungarian chuyên cho phân công trên đồ thị hai phía đầy đủ, gọn và nhanh (O(n³)); Min Cost Flow tổng quát hơn (đồ thị thưa, có sức chứa) nhưng chậm hơn trên ma trận dày." }
      ]
    },

    // ------------------------------------------------------------------------------------------------ hld
    {
      id: "hld",
      name: "Heavy-Light Decomposition",
      aliases: ["hld", "heavy light decomposition", "heavy-light", "phân rã nặng nhẹ", "truy vấn đường đi trên cây", "path query", "chuỗi nặng"],
      category: "graph",
      sub: "Phân rã cây",
      level: 4,
      tags: ["graph", "tree", "hld", "path-query", "segment-tree", "decomposition"],
      summary: "Chia cây thành các chuỗi nặng để mọi đường đi bị cắt thành O(log n) đoạn liên tiếp, nhờ đó truy vấn / cập nhật trên đường đi hoặc cây con bằng Fenwick hay Segment Tree.",
      description:
        "Với mỗi đỉnh, **con nặng** là con có cây con lớn nhất; cạnh nối đỉnh với con nặng là cạnh nặng, các cạnh còn lại là cạnh nhẹ. Các cạnh nặng nối thành những **chuỗi nặng** phủ toàn bộ cây. Vì đi qua một cạnh nhẹ xuống con thì kích thước cây con ít nhất giảm một nửa, đường từ gốc tới bất kỳ đỉnh nào chỉ đi qua tối đa log₂n cạnh nhẹ, tức cắt ngang tối đa log₂n + 1 chuỗi.\n\n" +
        "Đánh số đỉnh sao cho mỗi chuỗi chiếm một đoạn LIÊN TIẾP `pos[head] .. pos[đáy]` (và cây con của `v` là đoạn `pos[v] .. pos[v] + sz[v] - 1`). Khi đó đường đi `u..v` bị cắt thành O(log n) đoạn trên mảng `pos`: ta leo từ đỉnh có đầu chuỗi sâu hơn lên cha của đầu chuỗi, mỗi bước lấy một đoạn, cho tới khi cùng chuỗi. Đặt Fenwick / Segment Tree lên mảng `pos` là xong truy vấn đường đi O(log² n); điểm dừng cuối cũng cho **LCA** miễn phí.\n\n" +
        "Trọng số trên **cạnh**: gán trọng số cạnh vào đỉnh con và khi truy vấn bỏ đỉnh LCA (tham số `edges = true`). Mẫu dựng bằng vòng lặp (không đệ quy) nên cây dạng đường dài vẫn an toàn.",
      conditions: [
        "Cây vô hướng: liên thông, n−1 cạnh, có gốc (rừng: dựng từng cây hoặc thêm gốc ảo nối các cây)",
        "Phép gộp có tính kết hợp và GIAO HOÁN (tổng, max, min, xor, gcd...); phép không giao hoán cần xử lý chiều đi lên / đi xuống",
        "Hình dạng cây cố định (thêm / bớt cạnh trực tuyến → Link-Cut Tree)"
      ],
      complexity: { time: "O(n) dựng; O(log² n) mỗi truy vấn đường đi", space: "O(n)", note: "Cập nhật điểm O(log n) với Fenwick / Segment Tree; truy vấn cây con chỉ một đoạn nên O(log n). Mỗi truy vấn đường đi có tối đa 2·log₂n + 1 đoạn, mỗi đoạn O(log n)." },
      ops: [["Dựng HLD", "O(n)"], ["Truy vấn đường đi (Fenwick / Segment Tree)", "O(log² n)"], ["Cập nhật giá trị một đỉnh", "O(log n)"], ["Truy vấn cây con", "O(log n)"], ["LCA", "O(log n)"]],
      use_case: [
        "Tổng / max / min trên đường đi giữa hai đỉnh khi có cập nhật điểm",
        "Cập nhật cả đường đi (cần Segment Tree lười) hoặc cả cây con",
        "LCA mà không cần bảng nhảy (bộ nhớ O(n))",
        "Bài trọng số cạnh có cập nhật: đẩy trọng số xuống đỉnh con"
      ],
      not_for: [
        "Chỉ LCA / khoảng cách, không cập nhật → Binary Lifting (LCA) hoặc Euler tour + Sparse Table",
        "Chỉ truy vấn / cập nhật cây con → Euler tour + Fenwick đơn giản hơn",
        "Đếm đường đi theo độ dài hoặc khoảng cách → Centroid Decomposition",
        "Thêm / bớt cạnh trực tuyến → Link-Cut Tree"
      ],
      pitfalls: [
        "Trọng số cạnh: gán vào đỉnh con và bỏ đỉnh LCA khi truy vấn (path(..., edges = true)); quên bỏ LCA là lỗi kinh điển.",
        "Phép không giao hoán (xâu, ma trận, hợp hàm): thứ tự đoạn đi lên và đi xuống phải ghép đúng chiều; mẫu path() chỉ phù hợp phép giao hoán.",
        "Đặt Fenwick / Segment Tree lên chỉ số pos, KHÔNG phải số hiệu đỉnh; nhầm ánh xạ là lỗi hay gặp.",
        "Truy vấn cây con dùng đoạn đóng [pos[v], pos[v] + sz[v] - 1]; lệch một ở biên.",
        "Dựng HLD bằng đệ quy trên cây dạng đường 2·10⁵ đỉnh tràn stack; mẫu dùng vòng lặp.",
        "Mẫu giả định cây liên thông và build() gọi một lần từ một gốc."
      ],
      code: {
        lang: "cpp", title: "hld.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Heavy-Light Decomposition. Cây n đỉnh 0..n-1 (liên thông, n-1 cạnh), gốc root. Dựng bằng vòng lặp (không đệ quy).
// Sau build(): chuỗi nặng chiếm một đoạn LIÊN TIẾP của pos; cây con của v = [pos[v], pos[v] + sz[v] - 1].
// path(u, v, f): gọi f(l, r) (l <= r, đóng) cho từng đoạn pos của đường đi u..v (O(log n) đoạn).
//   edges = true: bỏ đỉnh LCA (dùng khi trọng số nằm trên cạnh và đã gán vào đỉnh con).
struct HLD {
    int n, timer = 0;
    vector<vector<int>> g;
    vector<int> par, dep, sz, heavy, head, pos;
    HLD(int n) : n(n), g(n), par(n, -1), dep(n, 0), sz(n, 1), heavy(n, -1), head(n, 0), pos(n, 0) {}
    void add_edge(int u, int v) { g[u].push_back(v); g[v].push_back(u); }
    void build(int root = 0) {
        vector<int> order = {root};                       // thứ tự BFS
        for (int i = 0; i < (int)order.size(); i++) {
            int u = order[i];
            for (int v : g[u]) if (v != par[u]) { par[v] = u; dep[v] = dep[u] + 1; order.push_back(v); }
        }
        for (int i = n - 1; i > 0; i--) sz[par[order[i]]] += sz[order[i]];
        for (int i = 1; i < n; i++) {                     // con nặng = con có cây con lớn nhất
            int v = order[i], p = par[v];
            if (heavy[p] == -1 || sz[v] > sz[heavy[p]]) heavy[p] = v;
        }
        vector<int> st = {root};
        while (!st.empty()) {                             // mỗi lần gán trọn một chuỗi nặng, đẩy các con nhẹ vào ngăn xếp
            int h = st.back(); st.pop_back();
            for (int v = h; v != -1; v = heavy[v]) {
                head[v] = h; pos[v] = timer++;
                for (int c : g[v]) if (c != par[v] && c != heavy[v]) st.push_back(c);
            }
        }
    }
    int lca(int u, int v) const {
        while (head[u] != head[v]) {
            if (dep[head[u]] < dep[head[v]]) swap(u, v);
            u = par[head[u]];
        }
        return dep[u] < dep[v] ? u : v;
    }
    template <class F> void path(int u, int v, F f, bool edges = false) const {
        while (head[u] != head[v]) {
            if (dep[head[u]] < dep[head[v]]) swap(u, v);
            f(pos[head[u]], pos[u]);
            u = par[head[u]];
        }
        if (dep[u] > dep[v]) swap(u, v);
        if (pos[u] + edges <= pos[v]) f(pos[u] + edges, pos[v]);
    }
};

// Ví dụ dùng: tổng trọng số đỉnh trên đường đi u..v, cộng thêm d vào một đỉnh (Fenwick đặt trên pos).
// Cần max / min / cập nhật đoạn: thay Fenwick bằng Segment Tree (xem mục segment-tree, lazy-segment-tree).
struct HLDPathSum {
    const HLD& h;
    vector<long long> bit;
    HLDPathSum(const HLD& h) : h(h), bit(h.n + 1, 0) {}
    void add(int v, long long d) { for (int i = h.pos[v] + 1; i <= h.n; i += i & -i) bit[i] += d; }
    long long prefix(int i) const { long long s = 0; for (; i > 0; i -= i & -i) s += bit[i]; return s; }   // tổng các pos < i
    long long query(int u, int v) const {
        long long s = 0;
        h.path(u, v, [&](int l, int r) { s += prefix(r + 1) - prefix(l); });
        return s;
    }
};
`
      },
      example: {
        input: "6 4\n5 3 2 7 1 4\n1 2\n1 3\n2 4\n2 5\n3 6\nQ 4 6\nA 2 10\nQ 5 6\nQ 4 5",
        output: "21\n25\n21",
        explain: "n = 6 đỉnh, q = 4 thao tác; dòng 2 là giá trị đỉnh, sau đó 5 cạnh. 'Q u v' hỏi tổng giá trị trên đường u..v, 'A v d' cộng d vào đỉnh v. Q 4 6: đường 4-2-1-3-6 có 7+3+5+2+4 = 21. Sau A 2 10 (đỉnh 2 thành 13): Q 5 6 qua 5-2-1-3-6 = 1+13+5+2+4 = 25; Q 4 5 qua 4-2-5 = 7+13+1 = 21."
      },
      problems: [
        { site: "cses", id: "1138", name: "Path Queries" },
        { site: "cses", id: "2134", name: "Path Queries II" },
        { site: "spoj", name: "QTREE - Query on a tree" },
        { site: "other", name: "Library Checker: Vertex Add Path Sum" }
      ],
      related: ["lca", "segment-tree", "fenwick-tree", "lazy-segment-tree", "centroid-decomposition", "dfs", "tree-dp"],
      compare: { "Bài toán giải": "Truy vấn / cập nhật trên đường đi và cây con", "Cạnh âm": "Trọng số tuỳ ý (đỉnh hoặc cạnh, kể cả âm)", "Hợp với đồ thị": "Cây (không chu trình), hình dạng cố định", "Kết quả cho ra": "Giá trị tổng hợp trên đường đi / cây con, kèm LCA" },
      cards: [
        { q: "HLD đạt được điều gì?", a: "Cắt mọi đường đi trên cây thành O(log n) đoạn liên tiếp trên mảng pos, nên truy vấn / cập nhật trên đường đi chỉ cần một cấu trúc đoạn (Fenwick / Segment Tree)." },
        { q: "Vì sao đường từ gốc chỉ qua O(log n) cạnh nhẹ?", a: "Đi xuống một cạnh nhẹ thì cây con nhỏ đi ít nhất một nửa (con nhẹ không lớn hơn con nặng), nên sau tối đa log₂n cạnh nhẹ kích thước hết." },
        { q: "Độ phức tạp truy vấn đường đi bằng HLD + Fenwick?", a: "O(log² n): O(log n) đoạn, mỗi đoạn O(log n). Dựng O(n)." },
        { q: "Trọng số nằm trên cạnh thì xử lý thế nào?", a: "Gán trọng số cạnh vào đỉnh con, và khi truy vấn đường u..v thì bỏ đỉnh LCA (path(..., edges = true))." },
        { q: "Cây con của v nằm ở đâu trong mảng pos?", a: "Là đoạn liên tiếp [pos[v], pos[v] + sz[v] - 1], nên truy vấn cây con chỉ cần một đoạn." }
      ]
    },

    // ------------------------------------------------------------------------------------------------ centroid-decomposition
    {
      id: "centroid-decomposition",
      name: "Centroid Decomposition",
      aliases: ["centroid decomposition", "centroid", "phân rã trọng tâm", "trọng tâm cây", "cây centroid", "centroid tree", "chia để trị trên cây"],
      category: "graph",
      sub: "Phân rã cây",
      level: 4,
      tags: ["graph", "tree", "centroid", "divide-and-conquer", "decomposition"],
      summary: "Chia để trị trên cây: lần lượt chọn trọng tâm, xoá nó rồi xử lý các thành phần còn lại, tạo cây centroid sâu O(log n) để trả lời truy vấn khoảng cách / đường đi.",
      description:
        "**Trọng tâm (centroid)** của cây là đỉnh mà khi xoá đi, mọi thành phần còn lại có kích thước ≤ n/2; trọng tâm luôn tồn tại và tìm được bằng cách đi từ một đỉnh về phía con có kích thước > n/2. **Phân rã**: tìm trọng tâm `c`, xử lý mọi đường đi đi qua `c`, xoá `c`, rồi lặp lại trên từng thành phần. Kích thước giảm một nửa mỗi tầng nên độ sâu tối đa log₂n và tổng công việc O(n log n).\n\n" +
        "Mỗi đỉnh có các tổ tiên trong **cây centroid** (cha của `c` là trọng tâm của thành phần chứa nó ở tầng trước). Với hai đỉnh `u`, `v`, tổ tiên chung thấp nhất trong cây centroid là một đỉnh nằm trên đường `u..v`, nên `dist(u, v) = dist(u, c) + dist(c, v)`. Mẫu lưu sẵn khoảng cách từ mỗi đỉnh tới mọi tổ tiên centroid; nhờ đó **tô đỏ một đỉnh** và **hỏi khoảng cách tới đỉnh đỏ gần nhất** đều O(log n): mỗi tổ tiên giữ `best` = khoảng cách nhỏ nhất tới một đỉnh đỏ trong thành phần của nó. Một số tổ tiên cho giá trị lớn hơn khoảng cách thật (đường đi quay lại) nhưng không làm sai đáp án vì ta lấy min.\n\n" +
        "Cùng khung này dùng cho bài **đếm cặp đỉnh cách nhau đúng K**: tại mỗi trọng tâm, gom độ sâu của các đỉnh ở từng cây con rồi đếm cặp không cùng cây con; hoặc gán thứ hạng theo tầng trong cây centroid (bài chỉ huy trên cây).",
      conditions: [
        "Cây vô hướng liên thông (mẫu dựng từ đỉnh 0; rừng: gọi cho từng cây); khoảng cách trong mẫu tính theo số cạnh (trọng số cạnh: đổi BFS thành cộng trọng số)",
        "Bài chỉ cần thông tin trên đường đi đi qua một đỉnh chung: khoảng cách, đếm đường đi theo độ dài / tính chất, đỉnh đánh dấu gần nhất",
        "Cây không đổi hình dạng; giá trị (màu, trọng số đỉnh) có thể đổi"
      ],
      complexity: { time: "O(n log n) dựng; O(log n) mỗi tô màu / truy vấn", space: "O(n log n)", note: "Độ sâu cây centroid ≤ ⌊log₂ n⌋ (tầng 0..⌊log₂ n⌋). Mẫu lưu khoảng cách tới mọi tổ tiên centroid nên tốn O(n log n) bộ nhớ." },
      ops: [["Dựng cây centroid", "O(n log n)"], ["Tô màu một đỉnh", "O(log n)"], ["Khoảng cách tới đỉnh tô gần nhất", "O(log n)"], ["Bộ nhớ", "O(n log n)"]],
      use_case: [
        "Đỉnh tô màu gần nhất với thao tác tô màu xen kẽ truy vấn",
        "Đếm số cặp đỉnh có khoảng cách đúng K (hoặc trong một khoảng)",
        "Đếm / tối ưu trên mọi đường đi của cây theo độ dài hoặc tính chất của đường",
        "Gán thứ hạng theo tầng trong cây centroid (bài chỉ huy trên cây)"
      ],
      not_for: [
        "Truy vấn / cập nhật giá trị đỉnh trên một đường đi cụ thể → HLD",
        "Chỉ LCA / khoảng cách của một cặp → Binary Lifting hoặc Euler tour",
        "Chỉ cần đường kính cây → hai lần BFS (Đường kính cây)",
        "Cây nhỏ, ít truy vấn (n·q ≤ ~10⁷) → duyệt trực tiếp"
      ],
      pitfalls: [
        "Đếm cặp qua trọng tâm phải loại cặp CÙNG một cây con (trừ ra hoặc xử lý từng cây con rồi mới đưa vào bộ đếm); quên là lỗi đếm thừa kinh điển.",
        "Quên đánh dấu trọng tâm đã xoá (removed) làm duyệt xuyên sang thành phần khác, độ phức tạp thành O(n²).",
        "Đệ quy tính kích thước / khoảng cách trên cây dạng đường 10⁵–10⁶ đỉnh tràn stack; mẫu dùng BFS và ngăn xếp tường minh.",
        "dist[v][k] ứng với tổ tiên ở tầng k (k = 0..clevel[v]); đi lên cây centroid phải giảm k tương ứng, đừng dùng chỉ số theo thứ tự khác.",
        "Chưa tô đỏ đỉnh nào thì nearest trả -1; đề có sẵn đỉnh đỏ đầu tiên thì nhớ gọi mark trước khi hỏi.",
        "Mẫu dựng từ đỉnh 0 nên chỉ phủ thành phần liên thông chứa đỉnh 0."
      ],
      code: {
        lang: "cpp", title: "centroid_decomposition.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Centroid Decomposition. Cây n đỉnh 0..n-1 (liên thông). build() không dùng đệ quy.
// Sau build(): cpar[v] = cha trong cây centroid (-1 ở gốc), clevel[v] = tầng (gốc = 0, tối đa log2 n),
//   dist[v][k] = khoảng cách (số cạnh) từ v tới tổ tiên centroid ở tầng k, k = 0..clevel[v] (tầng clevel[v] là chính v).
// Ví dụ dùng: mark(v) tô đỏ đỉnh v; nearest(v) = khoảng cách từ v tới đỉnh đỏ gần nhất, -1 nếu chưa có đỉnh đỏ. Mỗi lần O(log n).
struct CentroidTree {
    static constexpr int INF = 1000000000;
    int n;
    vector<vector<int>> g;
    vector<int> cpar, clevel, best;      // best[c] = khoảng cách nhỏ nhất từ c tới đỉnh đỏ trong thành phần của c
    vector<vector<int>> dist;
    CentroidTree(int n) : n(n), g(n), cpar(n, -1), clevel(n, 0), best(n, INF), dist(n) {}
    void add_edge(int u, int v) { g[u].push_back(v); g[v].push_back(u); }
    void build() {
        vector<char> removed(n, 0);
        vector<int> sz(n, 1), tp(n, -1), order;          // tp = cha trong lần duyệt BFS hiện tại
        struct Job { int start, parent, level; };
        vector<Job> st = {{0, -1, 0}};
        while (!st.empty()) {
            Job job = st.back(); st.pop_back();
            order.assign(1, job.start);                  // 1) BFS thành phần, tính kích thước cây con
            tp[job.start] = -1;
            for (size_t i = 0; i < order.size(); i++) {
                int u = order[i];
                sz[u] = 1;
                for (int v : g[u]) if (!removed[v] && v != tp[u]) { tp[v] = u; order.push_back(v); }
            }
            for (size_t i = order.size() - 1; i > 0; i--) sz[tp[order[i]]] += sz[order[i]];
            int total = order.size(), c = job.start;     // 2) đi về phía con quá nửa để tới trọng tâm
            for (bool moved = true; moved; ) {
                moved = false;
                for (int v : g[c]) if (!removed[v] && v != tp[c] && 2 * sz[v] > total) { c = v; moved = true; break; }
            }
            cpar[c] = job.parent; clevel[c] = job.level;
            order.assign(1, c);                          // 3) BFS từ c: ghi khoảng cách tới c cho cả thành phần
            tp[c] = -1;
            dist[c].push_back(0);
            for (size_t i = 0; i < order.size(); i++) {
                int u = order[i];
                for (int v : g[u]) if (!removed[v] && v != tp[u]) { tp[v] = u; dist[v].push_back(dist[u].back() + 1); order.push_back(v); }
            }
            removed[c] = 1;                              // 4) xoá c, xử lý từng thành phần con
            for (int v : g[c]) if (!removed[v]) st.push_back({v, c, job.level + 1});
        }
    }
    void mark(int v) {
        for (int c = v, k = clevel[v]; c != -1; c = cpar[c], k--) best[c] = min(best[c], dist[v][k]);
    }
    int nearest(int v) const {
        int res = INF;
        for (int c = v, k = clevel[v]; c != -1; c = cpar[c], k--) res = min(res, dist[v][k] + best[c]);
        return res >= INF ? -1 : res;
    }
};
`
      },
      example: {
        input: "6 5\n1 2\n2 3\n3 4\n4 5\n3 6\n? 5\n+ 6\n? 5\n+ 4\n? 5",
        output: "4\n3\n1",
        explain: "Cây 6 đỉnh (5 cạnh), ban đầu chỉ đỉnh 1 đỏ; '+ v' tô đỏ đỉnh v, '? v' hỏi khoảng cách tới đỉnh đỏ gần nhất. ? 5: 5-4-3-2-1 dài 4. Sau + 6: 5-4-3-6 dài 3. Sau + 4: đỉnh 4 kề 5 nên đáp án 1."
      },
      problems: [
        { site: "cses", id: "2080", name: "Fixed-Length Paths I" },
        { site: "cses", id: "2081", name: "Fixed-Length Paths II" },
        { site: "cf", id: "342E", name: "Xenia and Tree" },
        { site: "cf", id: "321C", name: "Ciel the Commander" },
        { site: "cf", id: "161D", name: "Distance in Tree" }
      ],
      related: ["hld", "lca", "tree-diameter", "dfs", "tree-dp", "bfs"],
      compare: { "Bài toán giải": "Truy vấn khoảng cách / đếm đường đi qua một điểm trên cây", "Cạnh âm": "Trọng số tuỳ ý (mẫu tính theo số cạnh)", "Hợp với đồ thị": "Cây", "Kết quả cho ra": "Cây centroid kèm khoảng cách tới tổ tiên; đáp án truy vấn" },
      cards: [
        { q: "Trọng tâm (centroid) của cây là gì?", a: "Đỉnh mà khi xoá đi, mọi thành phần còn lại có kích thước ≤ n/2. Luôn tồn tại (có thể có hai)." },
        { q: "Vì sao độ sâu cây centroid là O(log n)?", a: "Mỗi lần xoá trọng tâm, mỗi thành phần con có kích thước ≤ một nửa thành phần cha nên sau tối đa log₂n tầng không còn đỉnh." },
        { q: "Với hai đỉnh u, v, khoảng cách tính qua cây centroid thế nào?", a: "Tổ tiên chung thấp nhất c của u, v trong cây centroid nằm trên đường u..v nên dist(u, v) = dist(u, c) + dist(c, v); lấy min trên mọi tổ tiên chung vẫn đúng." },
        { q: "Khi đếm cặp đỉnh qua trọng tâm cần lưu ý gì?", a: "Loại cặp cùng một cây con của trọng tâm (hoặc xử lý từng cây con rồi mới đưa vào bộ đếm), nếu không đếm thừa." },
        { q: "Centroid Decomposition dựng và truy vấn tốn bao nhiêu?", a: "Dựng O(n log n), mỗi lần tô màu / hỏi O(log n), bộ nhớ O(n log n) khi lưu khoảng cách tới mọi tổ tiên." }
      ]
    },

    // ------------------------------------------------------------------------------------------------ euler-path
    {
      id: "euler-path",
      name: "Đường đi Euler (Hierholzer)",
      aliases: ["euler path", "euler circuit", "eulerian path", "eulerian circuit", "hierholzer", "đường đi euler", "chu trình euler", "đi qua mỗi cạnh đúng một lần", "vẽ một nét", "người đưa thư"],
      category: "graph",
      sub: "Đường đi Euler & logic",
      level: 3,
      tags: ["graph", "euler", "hierholzer", "path", "circuit"],
      summary: "Tìm đường đi hoặc chu trình đi qua mỗi cạnh đúng một lần bằng thuật toán Hierholzer, sau khi kiểm tra điều kiện tồn tại theo bậc đỉnh và tính liên thông.",
      description:
        "**Đường đi Euler** đi qua mỗi cạnh đúng một lần; **chu trình Euler** là đường đi Euler quay về điểm xuất phát. Điều kiện tồn tại (cho các đỉnh có cạnh, phải cùng một thành phần liên thông): **vô hướng** — số đỉnh bậc lẻ là 0 (chu trình) hoặc 2 (đường đi, bắt đầu ở một đỉnh lẻ, kết thúc ở đỉnh lẻ kia); **có hướng** — mọi đỉnh in = out (chu trình), hoặc đúng một đỉnh out − in = 1 (điểm bắt đầu), đúng một đỉnh in − out = 1 (điểm kết thúc), còn lại cân bằng.\n\n" +
        "**Hierholzer** dựng đường bằng ngăn xếp: từ đỉnh đang xét đi theo một cạnh chưa dùng sang đỉnh kề (đẩy vào ngăn xếp); khi một đỉnh hết cạnh chưa dùng thì đẩy nó vào kết quả và lùi lại. Dãy kết quả đảo ngược là đường Euler (các vòng con được tự động \"khâu\" vào đúng chỗ). Con trỏ `it[u]` bảo đảm mỗi cạnh bị duyệt một lần: tổng O(V+E).\n\n" +
        "Mẫu xử lý cả hai loại đồ thị, cạnh song song và vòng tự trỏ; trả về dãy m+1 đỉnh hoặc mảng rỗng nếu không tồn tại. Kiểm tra liên thông bằng chính độ dài kết quả: nếu có cạnh nằm ở thành phần khác thì kết quả ngắn hơn m+1.",
      conditions: [
        "Đồ thị vô hướng hoặc có hướng (mẫu hỗ trợ cả hai), đơn hoặc đa cạnh, cho phép vòng tự trỏ; mỗi cạnh dùng đúng một lần",
        "Vô hướng: 0 hoặc 2 đỉnh bậc lẻ. Có hướng: mọi đỉnh in = out, hoặc đúng một đỉnh out − in = 1 và một đỉnh in − out = 1",
        "Mọi cạnh phải cùng một thành phần liên thông (đỉnh cô lập không có cạnh thì bỏ qua)"
      ],
      complexity: { time: "O(V+E)", space: "O(V+E)", note: "Cả kiểm tra điều kiện lẫn dựng đường đều tuyến tính." },
      ops: [["Kiểm tra điều kiện bậc", "O(V+E)"], ["Dựng đường (Hierholzer)", "O(V+E)"]],
      use_case: [
        "Vẽ một nét / người đưa thư đi qua mọi con đường đúng một lần",
        "Khôi phục xâu từ các xâu con độ dài k (đồ thị de Bruijn, k-mer)",
        "Sắp các mảnh nối đuôi–đầu (domino, từ ghép) thành một dãy dùng hết mỗi mảnh đúng một lần",
        "Hỏi tồn tại + in lộ trình đi qua mọi cạnh hoặc mọi bước chuyển"
      ],
      not_for: [
        "Đi qua mỗi ĐỈNH đúng một lần (đường đi Hamilton, NP-khó) → bitmask DP cho n ≤ ~20",
        "Đi qua mọi cạnh được phép lặp, tổng độ dài nhỏ nhất (người đưa thư Trung Hoa) → ghép các đỉnh bậc lẻ rồi Euler",
        "Đường đi / chu trình có ràng buộc thêm về thứ tự cạnh → cần mô hình khác"
      ],
      pitfalls: [
        "Quên kiểm tra liên thông: bậc thoả nhưng cạnh ở hai thành phần thì dãy có ít hơn m+1 đỉnh (mẫu kiểm bằng độ dài kết quả).",
        "Đồ thị vô hướng: phải đánh dấu cạnh theo ID (không theo đỉnh đích) để mỗi cạnh dùng đúng một lần, kể cả cạnh song song và vòng tự trỏ.",
        "Đồ thị có hướng: ngăn xếp cho thứ tự NGƯỢC, phải đảo mới đúng chiều cạnh.",
        "Chọn sai đỉnh bắt đầu: có hướng bắt đầu ở đỉnh out − in = 1, vô hướng ở một đỉnh bậc lẻ (nếu có); bắt đầu sai thì không dựng được dù đồ thị có đường Euler.",
        "Đệ quy trên 10⁵–10⁶ cạnh tràn stack; mẫu dùng ngăn xếp tường minh.",
        "Đề cho trước điểm đầu và điểm cuối (ví dụ từ 1 tới n): thêm cạnh ảo n→1, tìm chu trình, rồi cắt cạnh ảo ra."
      ],
      code: {
        lang: "cpp", title: "euler_path.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// Đường đi / chu trình Euler (Hierholzer, không đệ quy) cho đồ thị VÔ HƯỚNG hoặc CÓ HƯỚNG. Đỉnh 0..n-1.
// path(): dãy m+1 đỉnh của một đường Euler (đi qua mỗi cạnh đúng một lần); rỗng nếu không tồn tại hoặc m = 0.
// Có hướng: bắt đầu ở đỉnh out - in = 1 (nếu có). Vô hướng: bắt đầu ở một đỉnh bậc lẻ (nếu có). Cả hai: chu trình nếu mọi bậc cân bằng.
// Cho phép cạnh song song và vòng tự trỏ. Độ phức tạp O(V + E).
struct Euler {
    int n, m = 0;
    bool directed;
    vector<vector<pair<int, int>>> g;       // g[u] = (đỉnh kề, id cạnh)
    Euler(int n, bool directed) : n(n), directed(directed), g(n) {}
    void add_edge(int u, int v) {
        g[u].push_back({v, m});
        if (!directed) g[v].push_back({u, m});
        m++;
    }
    vector<int> path() const {
        if (m == 0) return {};
        int start = -1;
        if (directed) {
            vector<int> in(n, 0);
            for (int u = 0; u < n; u++) for (auto& e : g[u]) in[e.first]++;
            int plus = 0, minus = 0;
            for (int v = 0; v < n; v++) {
                int d = (int)g[v].size() - in[v];             // out - in
                if (d == 1) { plus++; start = v; }
                else if (d == -1) minus++;
                else if (d != 0) return {};
            }
            if (plus > 1 || plus != minus) return {};
        } else {
            int odd = 0;
            for (int v = 0; v < n; v++) if (g[v].size() % 2) { if (odd++ == 0) start = v; }
            if (odd != 0 && odd != 2) return {};
        }
        for (int v = 0; v < n && start == -1; v++) if (!g[v].empty()) start = v;
        vector<int> it(n, 0), st = {start}, res;
        vector<char> used(m, 0);
        while (!st.empty()) {
            int u = st.back();
            while (it[u] < (int)g[u].size() && used[g[u][it[u]].second]) it[u]++;
            if (it[u] == (int)g[u].size()) { res.push_back(u); st.pop_back(); }   // hết cạnh: chốt đỉnh vào đáp án
            else { auto e = g[u][it[u]++]; used[e.second] = 1; st.push_back(e.first); }
        }
        if ((int)res.size() != m + 1) return {};                  // còn cạnh ở thành phần khác
        reverse(res.begin(), res.end());
        return res;
    }
};
`
      },
      example: {
        input: "5 6\n1 2\n2 3\n3 1\n3 4\n4 5\n5 3",
        output: "1 2 3 4 5 3 1",
        explain: "Đồ thị vô hướng 'cái nơ' (hai tam giác chung đỉnh 3): mọi bậc đều chẵn (đỉnh 3 bậc 4) nên có chu trình Euler. Dãy 1-2-3-4-5-3-1 dùng đủ 6 cạnh, mỗi cạnh đúng một lần (đây là một đáp án hợp lệ; thuật toán có thể in thứ tự khác)."
      },
      problems: [
        { site: "cses", id: "1691", name: "Mail Delivery" },
        { site: "cses", id: "1693", name: "Teleporters Path" },
        { site: "cses", id: "1692", name: "De Bruijn Sequence" },
        { site: "cf", id: "508D", name: "Tanya and Password" },
        { site: "lc", name: "Reconstruct Itinerary" }
      ],
      related: ["dfs", "scc", "bridges-articulation", "topological-sort", "bitmask-dp"],
      compare: { "Bài toán giải": "Đường đi / chu trình đi qua mỗi cạnh đúng một lần", "Cạnh âm": "Không liên quan (không dùng trọng số)", "Hợp với đồ thị": "Vô hướng hoặc có hướng; đa cạnh và vòng tự trỏ được", "Kết quả cho ra": "Dãy m+1 đỉnh, hoặc 'không tồn tại'" },
      cards: [
        { q: "Điều kiện để đồ thị vô hướng có chu trình Euler?", a: "Mọi cạnh cùng một thành phần liên thông và mọi đỉnh có bậc chẵn. Có đường đi Euler (không khép kín) khi có đúng 2 đỉnh bậc lẻ." },
        { q: "Điều kiện cho đồ thị có hướng?", a: "Các cạnh cùng một thành phần liên thông (yếu) và in = out ở mọi đỉnh (chu trình), hoặc đúng một đỉnh out − in = 1, một đỉnh in − out = 1 còn lại cân bằng (đường đi)." },
        { q: "Hierholzer chạy thế nào và độ phức tạp?", a: "Đi theo cạnh chưa dùng bằng ngăn xếp; đỉnh hết cạnh thì đưa vào kết quả rồi lùi. Kết quả đảo ngược là đường Euler. O(V+E)." },
        { q: "Vì sao kết quả của Hierholzer trên đồ thị có hướng phải đảo ngược?", a: "Đỉnh được ghi vào kết quả khi hết cạnh, tức là từ cuối đường về đầu đường; đảo lại mới đúng chiều các cạnh." },
        { q: "Làm sao nhận ra bài Euler với đường đi Hamilton?", a: "Euler: mỗi CẠNH đúng một lần, kiểm tra bậc được trong O(V+E). Hamilton: mỗi ĐỈNH đúng một lần, NP-khó (n ≤ ~20 dùng bitmask DP)." }
      ]
    },

    // ------------------------------------------------------------------------------------------------ two-sat
    {
      id: "two-sat",
      name: "2-SAT",
      aliases: ["2-sat", "2sat", "two sat", "two-sat", "2 sat", "thoả mãn mệnh đề", "bài toán 2-sat", "đồ thị kéo theo", "implication graph", "2-cnf"],
      category: "graph",
      sub: "Đường đi Euler & logic",
      level: 3,
      tags: ["graph", "2-sat", "scc", "logic", "implication-graph"],
      summary: "Quyết định có gán đúng/sai cho n biến để mọi mệnh đề dạng (a hoặc b) đều đúng hay không và in một nghiệm, bằng SCC trên đồ thị kéo theo.",
      description:
        "Bài toán: cho n biến đúng/sai và m mệnh đề, mỗi mệnh đề là phép **HOẶC** của hai literal (`x` hoặc `¬x`); cần gán giá trị để mọi mệnh đề đều đúng. Mệnh đề `(a ∨ b)` tương đương hai kéo theo `¬a → b` và `¬b → a`. Dựng **đồ thị kéo theo** 2n đỉnh (mỗi biến hai literal `x` và `¬x`) với 2m cạnh.\n\n" +
        "Vô nghiệm khi và chỉ khi tồn tại biến `x` mà `x` và `¬x` thuộc cùng một **thành phần liên thông mạnh (SCC)**. Nếu có nghiệm, ta gán `x = true` khi thành phần của `x` đứng SAU thành phần của `¬x` theo thứ tự topo của đồ thị ngưng tụ. Với Tarjan, SCC được đánh số theo thứ tự topo ngược nên điều kiện là `comp[x] < comp[¬x]` (với Kosaraju thì ngược lại).\n\n" +
        "Cách mã hoá hay dùng: `x` phải đúng → `(x ∨ x)`; `x → y` → `(¬x ∨ y)`; không được cùng đúng → `(¬x ∨ ¬y)`; `x ≠ y` → `(x ∨ y) ∧ (¬x ∨ ¬y)`; `x = y` → `(¬x ∨ y) ∧ (x ∨ ¬y)`. Mẫu dùng Tarjan lặp (không đệ quy) nên đồ thị kéo theo hàng triệu đỉnh vẫn an toàn.",
      conditions: [
        "Mỗi mệnh đề có TỐI ĐA 2 literal (3 literal trở lên là 3-SAT, NP-đầy đủ); mệnh đề một literal (x) viết là (x ∨ x)",
        "Các mệnh đề nối bằng VÀ; biến chỉ nhận đúng / sai",
        "n biến, m mệnh đề → đồ thị kéo theo có hướng 2n đỉnh và 2m cạnh"
      ],
      complexity: { time: "O(n+m)", space: "O(n+m)", note: "Dựng đồ thị và SCC (Tarjan) đều tuyến tính theo số đỉnh và cạnh của đồ thị kéo theo." },
      ops: [["Thêm một mệnh đề", "O(1)"], ["Giải: SCC + gán nghiệm", "O(n+m)"]],
      use_case: [
        "Chọn một trong hai phương án cho mỗi đối tượng sao cho các ràng buộc 'cặp' đều thoả (không cùng chọn, ít nhất một trong hai...)",
        "Xếp lịch mà mỗi sự kiện có hai khả năng thời điểm",
        "Tô hai màu kèm điều kiện phức tạp hơn 'hai đầu cạnh khác màu'",
        "Bài kiểu 'mỗi người đưa hai nguyện vọng, cần thoả mãn ít nhất một trong hai'"
      ],
      not_for: [
        "Chỉ có ràng buộc 'khác nhau' giữa các cặp → kiểm tra đồ thị hai phía bằng BFS hoặc DSU là đủ",
        "Mệnh đề có từ 3 literal trở lên → NP-đầy đủ: backtracking, SAT solver hoặc khai thác cấu trúc bài",
        "Cần chọn ít biến đúng nhất / tối ưu → bài tối ưu, không phải 2-SAT thuần"
      ],
      pitfalls: [
        "Mã hoá mệnh đề (a ∨ b) phải thêm HAI cạnh ¬a→b và ¬b→a; thiếu một cạnh làm bỏ sót trường hợp vô nghiệm.",
        "Chọn nghiệm theo thứ tự topo: Tarjan dùng comp[x] < comp[¬x], Kosaraju dùng comp[x] > comp[¬x]; dùng nhầm thì kết luận có / không nghiệm vẫn đúng nhưng nghiệm in ra sai.",
        "Phải kiểm comp[x] == comp[¬x] cho MỌI biến trước khi gán nghiệm.",
        "Số đỉnh đồ thị là 2n; mã hoá literal nhất quán (2i / 2i+1 và phủ định bằng XOR 1).",
        "Đệ quy SCC trên 2n đỉnh sâu hàng trăm nghìn tầng tràn stack; mẫu dùng Tarjan lặp.",
        "Ràng buộc 'ít nhất một trong k biến' (k > 2) hoặc 'nhiều nhất một' trên nhiều biến không phải mệnh đề 2 literal; chỉ khai triển trực tiếp được khi k nhỏ."
      ],
      code: {
        lang: "cpp", title: "two_sat.cpp",
        src: String.raw`#include <bits/stdc++.h>
using namespace std;

// 2-SAT: n biến x_0..x_{n-1}. add_clause(a, va, b, vb) thêm mệnh đề (x_a == va) HOẶC (x_b == vb).
// solve() = có nghiệm không; nghiệm nằm trong val[i] (0/1). Mệnh đề một literal x_a: add_clause(a, true, a, true).
// Literal của biến i: 2*i = "x_i đúng", 2*i+1 = "x_i sai"; phủ định = XOR 1. SCC bằng Tarjan lặp. Độ phức tạp O(n + m).
struct TwoSat {
    int n;
    vector<vector<int>> g;     // đồ thị kéo theo trên 2n literal
    vector<char> val;
    TwoSat(int n) : n(n), g(2 * n) {}
    static int lit(int i, bool v) { return 2 * i + (v ? 0 : 1); }
    void add_clause(int a, bool va, int b, bool vb) {          // (x_a == va) OR (x_b == vb)
        int p = lit(a, va), q = lit(b, vb);
        g[p ^ 1].push_back(q);                                 // không p thì q
        g[q ^ 1].push_back(p);                                 // không q thì p
    }
    void add_xor(int a, int b) { add_clause(a, true, b, true); add_clause(a, false, b, false); }      // x_a != x_b
    void add_equal(int a, int b) { add_clause(a, false, b, true); add_clause(a, true, b, false); }    // x_a == x_b
    bool solve() {
        int N = 2 * n, timer = 0, ncomp = 0;
        vector<int> idx(N, -1), low(N, 0), comp(N, -1), it(N, 0), stk, call;
        vector<char> on(N, 0);
        for (int s = 0; s < N; s++) {
            if (idx[s] != -1) continue;
            idx[s] = low[s] = timer++;
            stk.push_back(s); on[s] = 1; call.push_back(s);
            while (!call.empty()) {
                int u = call.back();
                if (it[u] < (int)g[u].size()) {
                    int v = g[u][it[u]++];
                    if (idx[v] == -1) { idx[v] = low[v] = timer++; stk.push_back(v); on[v] = 1; call.push_back(v); }
                    else if (on[v]) low[u] = min(low[u], idx[v]);
                } else {
                    call.pop_back();
                    if (low[u] == idx[u]) {                    // u là gốc của một SCC
                        int v;
                        do { v = stk.back(); stk.pop_back(); on[v] = 0; comp[v] = ncomp; } while (v != u);
                        ncomp++;
                    }
                    if (!call.empty()) low[call.back()] = min(low[call.back()], low[u]);
                }
            }
        }
        val.assign(n, 0);
        for (int i = 0; i < n; i++) {
            if (comp[2 * i] == comp[2 * i + 1]) return false;  // x và not x cùng SCC: vô nghiệm
            val[i] = comp[2 * i] < comp[2 * i + 1];            // Tarjan đánh số SCC theo thứ tự topo NGƯỢC
        }
        return true;
    }
};
`
      },
      example: {
        input: "3 3\n1 2\n-1 3\n-2 -3",
        output: "YES\n1 0 1",
        explain: "3 biến, 3 mệnh đề (mỗi dòng hai literal, âm là phủ định): (x1 ∨ x2), (¬x1 ∨ x3), (¬x2 ∨ ¬x3). Gán x1 = 1, x2 = 0, x3 = 1 thoả cả ba (1 ∨ 0), (0 ∨ 1), (1 ∨ 1). Còn có nghiệm khác như 0 1 0."
      },
      problems: [
        { site: "cses", id: "1684", name: "Giant Pizza" },
        { site: "cf", id: "228E", name: "The Road to Berland is Paved With Good Intentions" },
        { site: "cf", id: "776D", name: "The Door Problem" },
        { site: "atcoder", name: "AtCoder Library Practice Contest H - Two SAT" }
      ],
      related: ["scc", "topological-sort", "dfs", "bfs"],
      compare: { "Bài toán giải": "Thoả mãn hội các mệnh đề hai literal", "Cạnh âm": "Không áp dụng", "Hợp với đồ thị": "Đồ thị kéo theo có hướng 2n đỉnh, 2m cạnh", "Kết quả cho ra": "Có / không nghiệm và một nghiệm cụ thể" },
      cards: [
        { q: "Mệnh đề (a ∨ b) tạo những cạnh nào trong đồ thị kéo theo?", a: "Hai cạnh: ¬a → b và ¬b → a." },
        { q: "Khi nào 2-SAT vô nghiệm?", a: "Khi tồn tại biến x sao cho x và ¬x cùng thuộc một thành phần liên thông mạnh của đồ thị kéo theo." },
        { q: "Làm sao lấy nghiệm sau khi SCC?", a: "Gán x = true nếu thành phần của x đứng sau thành phần của ¬x theo thứ tự topo. Với Tarjan (đánh số topo ngược): comp[x] < comp[¬x]." },
        { q: "Độ phức tạp của 2-SAT và vì sao 3-SAT khác?", a: "O(n+m) nhờ SCC. 3 literal mỗi mệnh đề trở lên là NP-đầy đủ, không có cách tuyến tính tổng quát." },
        { q: "Mã hoá x ≠ y bằng mệnh đề hai literal?", a: "(x ∨ y) ∧ (¬x ∨ ¬y): ít nhất một đúng và không cùng đúng." }
      ]
    }
  ]);

  // ------------------------------------------------------------------------------------------------ kịch bản Quiz
  A.lib.scenarios([
    {
      id: "q-dinic-1",
      prompt: "Mạng 2000 đỉnh, 20000 cạnh có hướng, mỗi cạnh có dung lượng nguyên tới 10^9. Cần biết lượng dữ liệu tối đa gửi được từ đỉnh 1 tới đỉnh 2000 cùng lúc.",
      answer: ["dinic"], also: [],
      wrong: ["dijkstra", "kruskal", "bipartite-matching", "floyd-warshall"],
      why: "Đây là luồng cực đại. Dinic (đồ thị phân tầng BFS + luồng chặn DFS) xử lý tốt cỡ này. Dijkstra chỉ tìm đường ngắn nhất, Kruskal tìm cây khung, ghép cặp chỉ là trường hợp đặc biệt của luồng đơn vị trên đồ thị hai phía, còn Floyd-Warshall O(V³) vừa chậm vừa không tính luồng.",
      level: 3
    },
    {
      id: "q-dinic-2",
      prompt: "Mạng gồm N = 500 máy, M = 1000 đường truyền hai chiều. Cần chặn ÍT đường truyền nhất để máy 1 không còn liên lạc được với máy N, và in danh sách đường bị chặn.",
      answer: ["dinic"], also: ["edmonds-karp"],
      wrong: ["bridges-articulation", "dijkstra", "kruskal", "bfs"],
      why: "Cắt cạnh nhỏ nhất giữa hai đỉnh = luồng cực đại với dung lượng 1 mỗi cạnh (hai chiều); các cạnh đi từ phía s (còn tới được trong đồ thị phần dư) ra ngoài là cắt cần in. Cầu & khớp chỉ cho trường hợp một cạnh duy nhất; Dijkstra, Kruskal, BFS không đếm số đường đi không chung cạnh.",
      level: 3
    },
    {
      id: "q-edmonds-karp-1",
      prompt: "Mạng nhỏ N = 100, M = 300 cạnh có hướng, dung lượng tới 10^9. Cần luồng cực đại và muốn dùng cách tăng luồng theo đường tăng sao cho số lần tăng KHÔNG phụ thuộc giá trị dung lượng. Chọn cách tìm đường tăng nào?",
      answer: ["edmonds-karp"], also: ["dinic"],
      wrong: ["dijkstra", "bellman-ford", "dfs", "kruskal"],
      why: "Edmonds–Karp chọn đường tăng ngắn nhất theo số cạnh bằng BFS nên số lần tăng chỉ O(VE), không phụ thuộc dung lượng; Dinic cũng đảm bảo điều đó và nhanh hơn. Tăng luồng bằng DFS tuỳ ý có thể mất hàng tỉ lần với dung lượng lớn; Dijkstra / Bellman-Ford chọn đường theo trọng số chứ không theo số cạnh; Kruskal không liên quan.",
      level: 3
    },
    {
      id: "q-min-cost-flow-1",
      prompt: "N = 100 kho và M = 400 tuyến đường một chiều. Mỗi tuyến cho tối đa c xe hàng đi qua, mỗi xe tốn cước w. Cần chuyển đúng K = 50 xe hàng từ kho 1 tới kho N sao cho tổng cước nhỏ nhất.",
      answer: ["min-cost-flow"], also: [],
      wrong: ["dinic", "dijkstra", "floyd-warshall", "hungarian"],
      why: "Có cả sức chứa lẫn chi phí và cần đúng K đơn vị nên là Min Cost Flow. Dinic cho luồng cực đại nhưng bỏ qua chi phí; Dijkstra chỉ cho một đường rẻ nhất mà không tính sức chứa; Floyd-Warshall không có khái niệm luồng; Hungarian chỉ cho phân công (đồ thị hai phía đầy đủ).",
      level: 4
    },
    {
      id: "q-min-cost-flow-2",
      prompt: "Đồ thị có hướng N = 200, M = 1000, mỗi cạnh có độ dài w và chỉ được dùng tối đa một lần trong toàn bộ lời giải. Cần chọn K = 3 đường đi từ đỉnh 1 tới đỉnh N, đôi một không chung cạnh, sao cho tổng độ dài nhỏ nhất.",
      answer: ["min-cost-flow"], also: [],
      wrong: ["dijkstra", "dinic", "bellman-ford", "edmonds-karp"],
      why: "Mỗi cạnh dung lượng 1, chi phí = độ dài, cần luồng K đơn vị với chi phí nhỏ nhất: Min Cost Flow. Chạy Dijkstra K lần và xoá cạnh dùng rồi là tham lam sai (đường tối ưu thứ hai có thể phải 'rút lại' cạnh của đường đầu). Dinic và Edmonds–Karp chỉ đếm số đường không chung cạnh, không tối ưu độ dài; Bellman-Ford chỉ cho một đường.",
      level: 4
    },
    {
      id: "q-bipartite-matching-1",
      prompt: "Có 300 sinh viên và 300 đề tài. Mỗi sinh viên liệt kê các đề tài mình làm được (tổng 5000 cặp). Mỗi sinh viên làm tối đa một đề tài, mỗi đề tài chỉ một sinh viên. Tối đa bao nhiêu sinh viên được nhận đề tài?",
      answer: ["bipartite-matching"], also: ["hopcroft-karp", "dinic"],
      wrong: ["dsu", "kruskal", "two-sat", "bridges-articulation"],
      why: "Đồ thị hai phía (sinh viên – đề tài), cần ghép cặp cực đại: Kuhn đủ nhanh ở cỡ này, Hopcroft–Karp hoặc Dinic cũng đúng. DSU và Kruskal chỉ gom nhóm / cây khung, 2-SAT quyết định đúng sai cho biến chứ không ghép cặp, cầu & khớp không liên quan.",
      level: 3
    },
    {
      id: "q-bipartite-matching-2",
      prompt: "Bảng n × n (n = 1000) có một số ô chứa đồng xu. Mỗi bước chọn một hàng hoặc một cột và nhặt hết xu trong đó. Tối thiểu bao nhiêu bước để nhặt hết xu?",
      answer: ["hopcroft-karp"], also: ["bipartite-matching", "dinic"],
      wrong: ["bitmask-dp", "knapsack-01", "dsu", "bfs"],
      why: "Dựng đồ thị hai phía hàng – cột, mỗi ô có xu là một cạnh; chọn ít hàng/cột phủ mọi cạnh là phủ đỉnh nhỏ nhất, bằng ghép cực đại (định lý König). Cạnh có thể tới 10^6 nên Hopcroft–Karp an toàn nhất; Kuhn hay Dinic cũng được. Bitmask DP không chạy được với n = 1000, knapsack, DSU, BFS không giải được bài phủ.",
      level: 4
    },
    {
      id: "q-hopcroft-karp-1",
      prompt: "Đồ thị hai phía mỗi phía N = 100000 đỉnh, M = 400000 cạnh, cần số cặp ghép tối đa. Thời gian 2 giây, cần bảo đảm thời gian ngay cả với dữ liệu xấu.",
      answer: ["hopcroft-karp"], also: ["dinic"],
      wrong: ["bipartite-matching", "hungarian", "edmonds-karp", "kruskal"],
      why: "Hopcroft–Karp O(E√V) bảo đảm thời gian ở cỡ này (Dinic trên mạng đơn vị cũng vậy). Kuhn O(VE) có thể rất chậm trên dữ liệu xấu, Edmonds–Karp O(VE²) và Hungarian O(n³) hoàn toàn không phù hợp, Kruskal không giải bài ghép cặp.",
      level: 4
    },
    {
      id: "q-hungarian-1",
      prompt: "500 công nhân và 500 công việc. Chi phí c[i][j] để công nhân i làm việc j (0 ≤ c ≤ 10^9) cho cả ma trận. Mỗi người một việc, mỗi việc một người. Tổng chi phí nhỏ nhất là bao nhiêu và gán thế nào?",
      answer: ["hungarian"], also: ["min-cost-flow"],
      wrong: ["bipartite-matching", "bitmask-dp", "knapsack-01", "kruskal"],
      why: "Phân công có trọng số trên đồ thị hai phía đầy đủ n = 500: Hungarian O(n³) ≈ 1,25·10^8 chạy tốt. Min Cost Flow cũng giải được nhưng chậm và dài hơn. Ghép cặp Kuhn bỏ qua chi phí; bitmask DP O(2^n·n) không chạy được với n = 500; knapsack và Kruskal không liên quan.",
      level: 4
    },
    {
      id: "q-hld-1",
      prompt: "Cây N = 200000 đỉnh, mỗi đỉnh có một giá trị. Q = 200000 thao tác: gán lại giá trị của một đỉnh, hoặc hỏi giá trị LỚN NHẤT trên đường đi giữa hai đỉnh bất kỳ.",
      answer: ["hld"], also: [],
      wrong: ["lca", "sparse-table", "tree-dp", "fenwick-tree"],
      why: "Cần truy vấn đường đi trên cây kèm cập nhật điểm: HLD cắt đường thành O(log n) đoạn liên tiếp rồi dùng Segment Tree max. LCA (binary lifting) không chịu được cập nhật, Sparse Table chỉ cho dữ liệu tĩnh, Tree DP tính một lần cho cả cây, Fenwick một mình không lấy được max trên đoạn và không hiểu cấu trúc cây.",
      level: 4
    },
    {
      id: "q-centroid-decomposition-1",
      prompt: "Cây N = 100000 đỉnh, cạnh không trọng số. Ban đầu chỉ đỉnh 1 đỏ, các đỉnh khác xanh. Q = 100000 thao tác trộn lẫn: tô đỏ một đỉnh xanh, hoặc hỏi khoảng cách từ một đỉnh tới đỉnh đỏ GẦN NHẤT.",
      answer: ["centroid-decomposition"], also: [],
      wrong: ["hld", "lca", "bfs", "dijkstra"],
      why: "Mỗi truy vấn là khoảng cách tới tập đỉnh đỏ thay đổi theo thời gian: Centroid Decomposition lưu khoảng cách tới mọi tổ tiên trong cây centroid, mỗi thao tác O(log n). BFS đa nguồn lại mỗi lần là O(N) mỗi truy vấn (quá chậm, tổng ~10^10); HLD và LCA hỗ trợ đường đi / khoảng cách một cặp chứ không có 'gần nhất trong tập'; Dijkstra cũng là O(N log N) mỗi lần.",
      level: 4
    },
    {
      id: "q-centroid-decomposition-2",
      prompt: "Cây N = 200000 đỉnh. Cho số K, đếm số cặp đỉnh (u, v) có khoảng cách trên cây đúng bằng K (K có thể tới N).",
      answer: ["centroid-decomposition"], also: [],
      wrong: ["tree-diameter", "lca", "dfs", "bfs"],
      why: "Đếm cặp theo khoảng cách cố định là bài kinh điển của Centroid Decomposition: tại mỗi trọng tâm gom độ sâu từng cây con, đếm cặp độ sâu tổng K không cùng cây con, tổng O(n log n). BFS / DFS từ mọi đỉnh là O(N²); LCA chỉ trả lời một cặp mỗi lần; đường kính cây chỉ cho khoảng cách lớn nhất.",
      level: 4
    },
    {
      id: "q-euler-path-1",
      prompt: "Thành phố có N = 100000 ngã tư và M = 200000 con đường hai chiều. Người đưa thư muốn đi qua MỖI con đường đúng một lần rồi trở về điểm xuất phát. Hỏi có thể không, nếu có hãy in lộ trình.",
      answer: ["euler-path"], also: [],
      wrong: ["bitmask-dp", "dfs", "scc", "bridges-articulation"],
      why: "Đi qua mỗi cạnh đúng một lần và quay về là chu trình Euler: kiểm tra bậc mọi đỉnh chẵn và các cạnh liên thông rồi dựng bằng Hierholzer, O(N + M). Bitmask DP chỉ hợp bài đi qua mỗi ĐỈNH (Hamilton, n nhỏ); DFS thường không bảo đảm dùng mỗi cạnh một lần; SCC và cầu & khớp không giải trực tiếp bài này.",
      level: 3
    },
    {
      id: "q-euler-path-2",
      prompt: "Có N = 100000 bộ ba ký tự (chữ cái / chữ số): đó là TẤT CẢ các xâu con liên tiếp độ dài 3 (có thể lặp, thứ tự xáo trộn) của một mật khẩu bí mật. Hãy khôi phục một mật khẩu thoả mãn, hoặc báo không tồn tại.",
      answer: ["euler-path"], also: [],
      wrong: ["topological-sort", "kmp", "trie", "bitmask-dp"],
      why: "Coi mỗi cặp ký tự là một đỉnh và mỗi bộ ba abc là cạnh có hướng từ ab tới bc; mật khẩu là đường đi Euler có hướng đi qua mọi cạnh đúng một lần (kiểm tra bậc in/out, rồi Hierholzer). Sắp xếp topo cần đồ thị không chu trình, KMP và Trie xử lý khớp mẫu chứ không ghép các mảnh chồng nhau, bitmask DP bùng nổ ở N lớn.",
      level: 4
    },
    {
      id: "q-two-sat-1",
      prompt: "N = 100000 công tắc, mỗi công tắc bật hoặc tắt. Có M = 200000 ràng buộc, mỗi ràng buộc dạng 'công tắc a ở trạng thái X HOẶC công tắc b ở trạng thái Y'. Hỏi có cấu hình thoả mọi ràng buộc không, nếu có hãy in một cấu hình.",
      answer: ["two-sat"], also: [],
      wrong: ["bitmask-dp", "backtracking", "bipartite-matching", "topological-sort"],
      why: "Mỗi ràng buộc là mệnh đề hai literal nên đây là 2-SAT: dựng đồ thị kéo theo 2N đỉnh, SCC, vô nghiệm khi x và ¬x cùng thành phần, O(N + M). Bitmask DP và quay lui là 2^N; ghép cặp không mô tả được phép HOẶC trên trạng thái; sắp xếp topo chỉ dùng được khi đồ thị không có chu trình.",
      level: 3
    },
    {
      id: "q-two-sat-2",
      prompt: "N = 100000 người cần chia vào hai đội. Cho M = 200000 cặp (a, b) mà a và b KHÔNG được ở cùng đội. Hỏi có cách chia thoả mọi cặp không.",
      answer: ["bfs"], also: ["two-sat", "dsu"],
      wrong: ["dinic", "hungarian", "bipartite-matching", "kruskal"],
      why: "Mỗi cặp 'khác đội' là một cạnh; chia được khi và chỉ khi đồ thị hai phía, kiểm tra bằng BFS tô hai màu (hoặc DSU có tính chẵn lẻ) trong O(N + M). 2-SAT cũng mã hoá được (x ≠ y) nhưng cồng kềnh hơn cần thiết. Luồng, Hungarian, ghép cặp, Kruskal không trả lời câu hỏi 'có chia được không'.",
      level: 2
    }
  ]);
})(typeof globalThis !== "undefined" ? globalThis : this);
