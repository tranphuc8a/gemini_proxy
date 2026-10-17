// @TEMPLATE

// Thử 0-1 BFS: so với Floyd-Warshall trên đồ thị có hướng ngẫu nhiên trọng số 0/1 (có cạnh song song, vòng tự trỏ, đỉnh không tới được),
// ca lớn: lưới 600 x 600 (đi thẳng miễn phí, đổi hướng tốn 1) và đường thẳng 10^6 đỉnh.
int main() {
    mt19937 rng(20261017);
    const int INFD = 1 << 28;
    for (int iter = 0; iter < 4000; iter++) {
        int n = 1 + rng() % 9, m = rng() % 20;
        vector<vector<pair<int, int>>> g(n);
        vector<vector<int>> f(n, vector<int>(n, INFD));
        for (int i = 0; i < n; i++) f[i][i] = 0;
        for (int i = 0; i < m; i++) {
            int u = rng() % n, v = rng() % n, w = rng() % 2;
            g[u].push_back({v, w});
            f[u][v] = min(f[u][v], w);
        }
        for (int k = 0; k < n; k++)
            for (int i = 0; i < n; i++)
                for (int j = 0; j < n; j++) f[i][j] = min(f[i][j], f[i][k] + f[k][j]);
        int s = rng() % n;
        auto d = bfs01(g, s);
        for (int v = 0; v < n; v++) {
            int want = f[s][v] >= INFD ? -1 : f[s][v];
            if (d[v] != want) { printf("SAI iter=%d s=%d v=%d: %d != %d\n", iter, s, v, d[v], want); return 1; }
        }
    }
    // ví dụ trong mục
    {
        vector<vector<pair<int, int>>> g(4);
        g[0] = {{1, 1}, {2, 0}}; g[2] = {{1, 0}, {3, 1}}; g[1] = {{3, 1}};
        vector<int> want = {0, 0, 0, 1};
        if (bfs01(g, 0) != want) { puts("SAI ví dụ"); return 1; }
    }
    // lưới 600 x 600: mỗi ô có mũi tên ngẫu nhiên; đi theo mũi tên miễn phí, đi hướng khác tốn 1 (so với Dijkstra chuẩn viết ngay trong test)
    {
        int R = 600, C = 600, N = R * C;
        vector<int> arrow(N);
        for (int i = 0; i < N; i++) arrow[i] = rng() % 4;
        int dr[4] = {-1, 0, 1, 0}, dc[4] = {0, 1, 0, -1};
        vector<vector<pair<int, int>>> g(N);
        for (int r = 0; r < R; r++)
            for (int c = 0; c < C; c++)
                for (int k = 0; k < 4; k++) {
                    int nr = r + dr[k], nc = c + dc[k];
                    if (nr < 0 || nr >= R || nc < 0 || nc >= C) continue;
                    g[r * C + c].push_back({nr * C + nc, k == arrow[r * C + c] ? 0 : 1});
                }
        auto d = bfs01(g, 0);
        vector<int> ref(N, INT_MAX);
        priority_queue<pair<int, int>, vector<pair<int, int>>, greater<>> pq;
        ref[0] = 0;
        pq.push({0, 0});
        while (!pq.empty()) {
            auto [du, u] = pq.top();
            pq.pop();
            if (du > ref[u]) continue;
            for (auto [v, w] : g[u]) if (du + w < ref[v]) { ref[v] = du + w; pq.push({ref[v], v}); }
        }
        for (int i = 0; i < N; i++) if (d[i] != ref[i]) { printf("SAI lưới ô %d: %d != %d\n", i, d[i], ref[i]); return 1; }
    }
    // đường thẳng toàn trọng số 1 và toàn trọng số 0
    {
        int n = 1000000;
        vector<vector<pair<int, int>>> g(n);
        for (int i = 0; i + 1 < n; i++) g[i].push_back({i + 1, i % 2});
        auto d = bfs01(g, 0);
        if (d[n - 1] != (n - 1) / 2) { puts("SAI đường thẳng xen kẽ"); return 1; }
    }
    puts("OK");
    return 0;
}
