// @TEMPLATE

// Thử Bellman-Ford: so với Floyd-Warshall (khoảng cách và chu trình âm) trên đồ thị ngẫu nhiên nhỏ có cạnh âm / dương / 0,
// kiểm tra chu trình âm lấy ra thật sự là chu trình âm, dựng đường đi qua par, ca lớn (thế năng => cạnh âm nhưng không chu trình âm).
typedef BellmanFord BF;

int main() {
    mt19937 rng(20261017);
    const long long INF = BF::INF;
    int cntNeg = 0, cntOk = 0;
    for (int iter = 0; iter < 8000; iter++) {
        int n = 1 + rng() % 6, m = rng() % 13;
        BF bf(n);
        vector<vector<long long>> f(n, vector<long long>(n, INF)), best(n, vector<long long>(n, INF));
        for (int i = 0; i < n; i++) f[i][i] = 0;
        for (int i = 0; i < m; i++) {
            int u = rng() % n, v = rng() % n;
            long long w = (long long)(rng() % 13) - 3;  // -3..9
            bf.add_edge(u, v, w);
            f[u][v] = min(f[u][v], w);
            best[u][v] = min(best[u][v], w);
        }
        for (int k = 0; k < n; k++)
            for (int i = 0; i < n; i++)
                for (int j = 0; j < n; j++)
                    if (f[i][k] < INF && f[k][j] < INF) f[i][j] = min(f[i][j], f[i][k] + f[k][j]);
        bool hasNeg = false;
        for (int i = 0; i < n; i++) if (f[i][i] < 0) hasNeg = true;
        int s = rng() % n;
        bool negReach = false;
        for (int i = 0; i < n; i++) if (f[s][i] < INF && f[i][i] < 0) negReach = true;
        bool ok = bf.run(s);
        if (ok == negReach) { printf("SAI run iter=%d: ok=%d negReach=%d\n", iter, (int)ok, (int)negReach); return 1; }
        if (ok) {
            cntOk++;
            for (int v = 0; v < n; v++) {
                if (bf.dist[v] != f[s][v]) { printf("SAI dist iter=%d v=%d: %lld != %lld\n", iter, v, bf.dist[v], f[s][v]); return 1; }
                if (v == s || bf.dist[v] == INF) {
                    if (v != s && bf.par[v] != -1) { puts("SAI par của đỉnh không tới được"); return 1; }
                    continue;
                }
                long long sum = 0;
                int cur = v, steps = 0;
                while (cur != s && steps++ <= n) {
                    int p = bf.par[cur];
                    if (p < 0 || best[p][cur] == INF) { puts("SAI par không phải cạnh"); return 1; }
                    sum += best[p][cur];
                    cur = p;
                }
                if (cur != s || sum != bf.dist[v]) { printf("SAI đường đi qua par iter=%d v=%d\n", iter, v); return 1; }
            }
        }
        auto cyc = bf.find_negative_cycle();
        if (cyc.empty() == hasNeg) { printf("SAI find_negative_cycle iter=%d (có chu trình âm: %d)\n", iter, (int)hasNeg); return 1; }
        if (!cyc.empty()) {
            cntNeg++;
            set<int> distinct(cyc.begin(), cyc.end());
            if (distinct.size() != cyc.size()) { puts("SAI chu trình lặp đỉnh"); return 1; }
            long long sum = 0;
            for (size_t i = 0; i < cyc.size(); i++) {
                int u = cyc[i], v = cyc[(i + 1) % cyc.size()];
                if (best[u][v] == INF) { printf("SAI chu trình không đi theo cạnh iter=%d\n", iter); return 1; }
                sum += best[u][v];
            }
            if (sum >= 0) { printf("SAI chu trình không âm iter=%d (tổng %lld)\n", iter, sum); return 1; }
        }
    }
    if (cntNeg < 200 || cntOk < 200) { printf("Dữ liệu thử lệch: cntNeg=%d cntOk=%d\n", cntNeg, cntOk); return 1; }
    // ví dụ trong mục
    {
        BF bf(4);
        bf.add_edge(0, 1, 4); bf.add_edge(0, 2, 5); bf.add_edge(1, 2, -3); bf.add_edge(2, 3, 4);
        vector<long long> want = {0, 4, 1, 5};
        if (!bf.run(0) || bf.dist != want) { puts("SAI ví dụ"); return 1; }
        bf.add_edge(3, 1, -5);
        if (bf.run(0)) { puts("SAI ví dụ (chu trình âm)"); return 1; }
    }
    // vòng tự trỏ âm trên một đỉnh
    { BF bf(1); bf.add_edge(0, 0, -1); if (bf.run(0) || bf.find_negative_cycle() != vector<int>{0}) { puts("SAI vòng tự trỏ âm"); return 1; } }
    // đồ thị một đỉnh, không cạnh
    { BF bf(1); if (!bf.run(0) || bf.dist[0] != 0 || !bf.find_negative_cycle().empty()) { puts("SAI một đỉnh"); return 1; } }
    // chu trình âm KHÔNG tới được từ nguồn: run(s) vẫn true, nhưng find_negative_cycle thấy nó
    {
        BF bf(4);
        bf.add_edge(0, 1, 1);
        bf.add_edge(2, 3, -5); bf.add_edge(3, 2, 1);
        if (!bf.run(0) || bf.find_negative_cycle().empty()) { puts("SAI chu trình âm không tới được"); return 1; }
    }
    // ca lớn 1: đường thẳng 3000 đỉnh, cạnh liệt kê NGƯỢC thứ tự (xấu nhất cần n vòng), trọng số -1e9 => tổng vượt int32
    {
        int n = 3000;
        BF bf(n);
        for (int i = n - 2; i >= 0; i--) bf.add_edge(i, i + 1, -1000000000LL);
        if (!bf.run(0) || bf.dist[n - 1] != -1000000000LL * (n - 1)) { puts("SAI ca lớn đường thẳng"); return 1; }
    }
    // ca lớn 2: vòng 2000 đỉnh tổng trọng số -1 => lấy đủ cả vòng
    {
        int n = 2000;
        BF bf(n);
        for (int i = 0; i < n; i++) bf.add_edge(i, (i + 1) % n, i == 0 ? -1 : 0);
        auto cyc = bf.find_negative_cycle();
        if ((int)cyc.size() != n || bf.run(0)) { puts("SAI ca lớn chu trình âm"); return 1; }
    }
    // ca lớn 3: cạnh âm nhưng không chu trình âm (w = c + p[u] - p[v], c >= 0) so với Dijkstra trên trọng số rút gọn
    {
        int n = 1500, m = 6000;
        vector<long long> p(n);
        for (auto& x : p) x = rng() % 1000000;
        BF bf(n);
        vector<vector<pair<int, long long>>> g(n);
        for (int i = 0; i < m; i++) {
            int u = rng() % n, v = rng() % n;
            long long c = rng() % 1000, w = c + p[u] - p[v];
            bf.add_edge(u, v, w);
            g[u].push_back({v, c});
        }
        int s = 0;
        vector<long long> d(n, INF);
        priority_queue<pair<long long, int>, vector<pair<long long, int>>, greater<>> pq;
        d[s] = 0;
        pq.push({0, s});
        while (!pq.empty()) {
            auto [du, u] = pq.top();
            pq.pop();
            if (du > d[u]) continue;
            for (auto [v, c] : g[u]) if (du + c < d[v]) { d[v] = du + c; pq.push({d[v], v}); }
        }
        if (!bf.run(s)) { puts("SAI ca lớn thế năng: báo nhầm chu trình âm"); return 1; }
        for (int v = 0; v < n; v++) {
            long long want = d[v] == INF ? INF : d[v] + p[s] - p[v];
            if (bf.dist[v] != want) { printf("SAI ca lớn thế năng v=%d\n", v); return 1; }
        }
        if (!bf.find_negative_cycle().empty()) { puts("SAI ca lớn thế năng: có chu trình âm giả"); return 1; }
    }
    puts("OK");
    return 0;
}
