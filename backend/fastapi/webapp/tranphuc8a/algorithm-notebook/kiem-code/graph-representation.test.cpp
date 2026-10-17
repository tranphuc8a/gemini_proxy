// @TEMPLATE

// Thử Graph: danh sách kề / danh sách cạnh / ma trận kề so với bộ đếm độc lập; hàng xóm lưới so với vét cạn.
int main() {
    mt19937 rng(20261017);
    const long long NONE = (long long)4e18;
    for (int iter = 0; iter < 3000; iter++) {
        int n = 1 + rng() % 7, m = rng() % 15;
        bool directed = rng() % 2;
        Graph g(n);
        vector<array<long long, 3>> es;
        map<array<long long, 3>, int> cnt;                        // (u, v, w) -> số lần xuất hiện trong adj
        vector<vector<long long>> best(n, vector<long long>(n, NONE));
        for (int i = 0; i < m; i++) {
            int u = rng() % n, v = rng() % n;
            long long w = (long long)(rng() % 21) - 10;           // âm cũng được: chỉ lưu
            g.add_edge(u, v, w, directed);
            es.push_back({u, v, w});
            cnt[{u, v, w}]++;
            best[u][v] = min(best[u][v], w);
            if (!directed) {
                if (u != v) cnt[{v, u, w}]++;
                best[v][u] = min(best[v][u], w);
            }
        }
        if (g.edges != es) { puts("SAI danh sách cạnh"); return 1; }
        map<array<long long, 3>, int> got;
        int total = 0;
        for (int u = 0; u < n; u++) {
            if (g.degree(u) != (int)g.adj[u].size()) { puts("SAI degree"); return 1; }
            for (auto [v, w] : g.adj[u]) { got[{u, v, w}]++; total++; }
        }
        if (got != cnt) { printf("SAI danh sách kề iter=%d\n", iter); return 1; }
        int selfLoops = 0;
        for (auto& e : es) if (e[0] == e[1]) selfLoops++;
        int expectTotal = directed ? m : 2 * m - selfLoops;
        if (total != expectTotal) { printf("SAI tổng độ dài kề %d != %d\n", total, expectTotal); return 1; }
        auto mat = g.matrix(NONE);
        if (mat != best) { printf("SAI ma trận kề iter=%d\n", iter); return 1; }
        if (!directed)
            for (int u = 0; u < n; u++)
                for (int v = 0; v < n; v++)
                    if (mat[u][v] != mat[v][u]) { puts("SAI ma trận vô hướng không đối xứng"); return 1; }
    }
    // n = 1, không cạnh; đồ thị rỗng
    { Graph g(1); if (g.edges.size() != 0 || g.matrix(NONE)[0][0] != NONE) { puts("SAI đồ thị một đỉnh"); return 1; } }
    { Graph g(0); if (!g.matrix(NONE).empty()) { puts("SAI đồ thị rỗng"); return 1; } }
    // ô kề trên lưới: so với vét cạnh (khoảng cách Manhattan = 1)
    for (int R = 1; R <= 6; R++)
        for (int C = 1; C <= 6; C++)
            for (int id = 0; id < R * C; id++) {
                vector<int> want;
                for (int j = 0; j < R * C; j++)
                    if (abs(id / C - j / C) + abs(id % C - j % C) == 1) want.push_back(j);
                auto got = Graph::grid_neighbors(id, R, C);
                sort(got.begin(), got.end());
                if (got != want) { printf("SAI ô kề R=%d C=%d id=%d\n", R, C, id); return 1; }
            }
    // ví dụ trong mục: 0-1 (5), 1-2 (3), 2-3 (1)
    {
        Graph g(4);
        g.add_edge(0, 1, 5); g.add_edge(1, 2, 3); g.add_edge(2, 3, 1);
        vector<vector<pair<int, long long>>> want = {{{1, 5}}, {{0, 5}, {2, 3}}, {{1, 3}, {3, 1}}, {{2, 1}}};
        if (g.adj != want) { puts("SAI ví dụ"); return 1; }
    }
    // lưới lớn: id góc
    if (Graph::grid_neighbors(0, 1000, 1000).size() != 2 || Graph::grid_neighbors(999 * 1000 + 999, 1000, 1000).size() != 2) { puts("SAI góc lưới"); return 1; }
    puts("OK");
    return 0;
}
