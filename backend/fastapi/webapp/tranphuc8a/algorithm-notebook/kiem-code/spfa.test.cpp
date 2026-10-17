// @TEMPLATE

// Thử SPFA: so với Floyd-Warshall (khoảng cách + chu trình âm tới được từ nguồn) trên đồ thị ngẫu nhiên nhỏ có cạnh âm,
// ca lớn với trọng số không âm (so với Dijkstra) và cạnh âm không chu trình âm (thế năng), chu trình âm lớn.
int main() {
    mt19937 rng(20261017);
    const long long INF = Spfa::INF;
    int cntNeg = 0, cntOk = 0;
    for (int iter = 0; iter < 8000; iter++) {
        int n = 1 + rng() % 6, m = rng() % 13;
        Spfa sp(n);
        vector<vector<long long>> f(n, vector<long long>(n, INF)), best(n, vector<long long>(n, INF));
        for (int i = 0; i < n; i++) f[i][i] = 0;
        for (int i = 0; i < m; i++) {
            int u = rng() % n, v = rng() % n;
            long long w = (long long)(rng() % 13) - 3;  // -3..9
            sp.add_edge(u, v, w);
            f[u][v] = min(f[u][v], w);
            best[u][v] = min(best[u][v], w);
        }
        for (int k = 0; k < n; k++)
            for (int i = 0; i < n; i++)
                for (int j = 0; j < n; j++)
                    if (f[i][k] < INF && f[k][j] < INF) f[i][j] = min(f[i][j], f[i][k] + f[k][j]);
        int s = rng() % n;
        bool negReach = false;
        for (int i = 0; i < n; i++) if (f[s][i] < INF && f[i][i] < 0) negReach = true;
        bool ok = sp.run(s);
        if (ok == negReach) { printf("SAI run iter=%d: ok=%d negReach=%d\n", iter, (int)ok, (int)negReach); return 1; }
        if (negReach) { cntNeg++; continue; }
        cntOk++;
        for (int v = 0; v < n; v++) {
            if (sp.dist[v] != f[s][v]) { printf("SAI dist iter=%d v=%d: %lld != %lld\n", iter, v, sp.dist[v], f[s][v]); return 1; }
            if (v == s || sp.dist[v] == INF) continue;
            long long sum = 0;
            int cur = v, steps = 0;
            while (cur != s && steps++ <= n) {
                int p = sp.par[cur];
                if (p < 0 || best[p][cur] == INF) { puts("SAI par không phải cạnh"); return 1; }
                sum += best[p][cur];
                cur = p;
            }
            if (cur != s || sum != sp.dist[v]) { printf("SAI đường đi qua par iter=%d v=%d\n", iter, v); return 1; }
        }
    }
    if (cntNeg < 200 || cntOk < 200) { printf("Dữ liệu thử lệch: cntNeg=%d cntOk=%d\n", cntNeg, cntOk); return 1; }
    // ví dụ trong mục
    {
        Spfa sp(4);
        sp.add_edge(0, 1, 2); sp.add_edge(0, 2, 5); sp.add_edge(2, 1, -4); sp.add_edge(1, 3, 1);
        vector<long long> want = {0, 1, 5, 2};
        if (!sp.run(0) || sp.dist != want) { puts("SAI ví dụ"); return 1; }
        sp.add_edge(3, 2, -1);
        if (sp.run(0)) { puts("SAI ví dụ (chu trình âm)"); return 1; }
    }
    // một đỉnh: vòng tự trỏ dương / âm
    { Spfa sp(1); sp.add_edge(0, 0, 3); if (!sp.run(0) || sp.dist[0] != 0) { puts("SAI vòng tự trỏ dương"); return 1; } }
    { Spfa sp(1); sp.add_edge(0, 0, -1); if (sp.run(0)) { puts("SAI vòng tự trỏ âm"); return 1; } }
    // chu trình âm không tới được từ nguồn: run(s) vẫn true
    {
        Spfa sp(4);
        sp.add_edge(0, 1, 1);
        sp.add_edge(2, 3, -5); sp.add_edge(3, 2, 1);
        if (!sp.run(0) || sp.dist[2] != INF) { puts("SAI chu trình âm không tới được"); return 1; }
    }
    // ca lớn 1: trọng số không âm, n = 100000, m = 400000 so với Dijkstra
    {
        int n = 100000, m = 400000;
        Spfa sp(n);
        vector<vector<pair<int, long long>>> g(n);
        for (int i = 0; i < m; i++) {
            int u = rng() % n, v = rng() % n;
            long long w = rng() % 1000000000;
            sp.add_edge(u, v, w);
            g[u].push_back({v, w});
        }
        vector<long long> d(n, INF);
        priority_queue<pair<long long, int>, vector<pair<long long, int>>, greater<>> pq;
        d[0] = 0;
        pq.push({0, 0});
        while (!pq.empty()) {
            auto [du, u] = pq.top();
            pq.pop();
            if (du > d[u]) continue;
            for (auto [v, w] : g[u]) if (du + w < d[v]) { d[v] = du + w; pq.push({d[v], v}); }
        }
        if (!sp.run(0) || sp.dist != d) { puts("SAI ca lớn không âm"); return 1; }
    }
    // ca lớn 2: cạnh âm nhưng không chu trình âm (w = c + p[u] - p[v], c >= 0), n = 30000, m = 100000
    {
        int n = 30000, m = 100000;
        vector<long long> p(n);
        for (auto& x : p) x = rng() % 1000000;
        Spfa sp(n);
        vector<vector<pair<int, long long>>> g(n);
        for (int i = 0; i < m; i++) {
            int u = rng() % n, v = rng() % n;
            long long c = rng() % 1000;
            sp.add_edge(u, v, c + p[u] - p[v]);
            g[u].push_back({v, c});
        }
        vector<long long> d(n, INF);
        priority_queue<pair<long long, int>, vector<pair<long long, int>>, greater<>> pq;
        d[0] = 0;
        pq.push({0, 0});
        while (!pq.empty()) {
            auto [du, u] = pq.top();
            pq.pop();
            if (du > d[u]) continue;
            for (auto [v, c] : g[u]) if (du + c < d[v]) { d[v] = du + c; pq.push({d[v], v}); }
        }
        if (!sp.run(0)) { puts("SAI ca lớn thế năng: báo nhầm chu trình âm"); return 1; }
        for (int v = 0; v < n; v++) {
            long long want = d[v] == INF ? INF : d[v] + p[0] - p[v];
            if (sp.dist[v] != want) { printf("SAI ca lớn thế năng v=%d\n", v); return 1; }
        }
    }
    // ca lớn 3: vòng 100000 đỉnh tổng trọng số -1 => phải kết thúc và báo chu trình âm
    {
        int n = 100000;
        Spfa sp(n);
        for (int i = 0; i < n; i++) sp.add_edge(i, (i + 1) % n, i == 0 ? -1 : 0);
        if (sp.run(0)) { puts("SAI vòng âm lớn"); return 1; }
    }
    puts("OK");
    return 0;
}
