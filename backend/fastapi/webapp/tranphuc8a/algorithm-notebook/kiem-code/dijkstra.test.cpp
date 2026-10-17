// @TEMPLATE

// Thử Dijkstra với Floyd-Warshall trên đồ thị ngẫu nhiên nhỏ (trọng số 0..9, có đỉnh không tới được, có cạnh song song / vòng tự trỏ).
int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 3000; iter++) {
        int n = 1 + rng() % 8, m = rng() % 15;
        vector<vector<pair<int, long long>>> g(n);
        vector<vector<long long>> f(n, vector<long long>(n, INF));
        for (int i = 0; i < n; i++) f[i][i] = 0;
        for (int i = 0; i < m; i++) {
            int u = rng() % n, v = rng() % n;
            long long w = rng() % 10;
            g[u].push_back({v, w});          // có hướng
            f[u][v] = min(f[u][v], w);
        }
        for (int k = 0; k < n; k++)
            for (int i = 0; i < n; i++)
                for (int j = 0; j < n; j++)
                    if (f[i][k] < INF && f[k][j] < INF) f[i][j] = min(f[i][j], f[i][k] + f[k][j]);
        int s = rng() % n;
        vector<int> par;
        auto d = dijkstra(g, s, &par);
        for (int v = 0; v < n; v++) {
            if (d[v] != f[s][v]) { printf("SAI iter=%d s=%d v=%d: %lld != %lld\n", iter, s, v, d[v], f[s][v]); return 1; }
            // đường đi dựng lại từ par phải có tổng đúng bằng dist
            if (d[v] < INF && v != s) {
                long long total = 0;
                int cur = v, steps = 0;
                while (cur != s && steps++ <= n) {
                    int p = par[cur];
                    long long best = INF;
                    for (auto [to, w] : g[p]) if (to == cur) best = min(best, w);
                    total += best;
                    cur = p;
                }
                if (cur != s || total != d[v]) { printf("SAI đường đi iter=%d v=%d\n", iter, v); return 1; }
            }
            if (d[v] == INF && par[v] != -1) { printf("SAI par của đỉnh không tới được\n"); return 1; }
        }
    }
    // ca lớn: đường thẳng 200000 đỉnh, trọng số 1e9 -> tổng vượt int32
    int n = 200000;
    vector<vector<pair<int, long long>>> g(n);
    for (int i = 0; i + 1 < n; i++) g[i].push_back({i + 1, 1000000000LL});
    auto d = dijkstra(g, 0);
    if (d[n - 1] != 1000000000LL * (n - 1)) { puts("SAI ca lớn"); return 1; }
    puts("OK");
}
