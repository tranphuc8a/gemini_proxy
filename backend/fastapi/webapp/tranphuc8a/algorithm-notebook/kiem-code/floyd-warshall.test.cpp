// @TEMPLATE

// Thử Floyd-Warshall: so với Bellman-Ford chạy từ từng nguồn (viết ngay trong test) trên đồ thị ngẫu nhiên nhỏ có cạnh âm / 0 / dương,
// phát hiện chu trình âm, dựng đường đi, ca lớn so với Dijkstra, chặn tràn khi có chu trình âm với trọng số lớn.
typedef FloydWarshall FW;

int main() {
    mt19937 rng(20261017);
    const long long INF = FW::INF;
    int cntNeg = 0, cntOk = 0;
    for (int iter = 0; iter < 6000; iter++) {
        int n = 1 + rng() % 7, m = rng() % 16;
        FW fw(n);
        vector<array<long long, 3>> es;
        vector<vector<long long>> best(n, vector<long long>(n, INF));
        for (int i = 0; i < m; i++) {
            int u = rng() % n, v = rng() % n;
            long long w = (long long)(rng() % 13) - 2;  // -2..10
            fw.add_edge(u, v, w);
            es.push_back({u, v, w});
            best[u][v] = min(best[u][v], w);
        }
        fw.run();
        // vét: có chu trình âm ở đâu đó? (Bellman-Ford với nguồn ảo)
        vector<long long> d0(n, 0);
        bool neg = false;
        for (int pass = 0; pass < n + 1; pass++) {
            bool ch = false;
            for (auto& e : es) if (d0[e[0]] + e[2] < d0[e[1]]) { d0[e[1]] = d0[e[0]] + e[2]; ch = true; }
            if (!ch) break;
            if (pass == n) neg = true;
        }
        if (fw.has_negative_cycle() != neg) { printf("SAI has_negative_cycle iter=%d (vét: %d)\n", iter, (int)neg); return 1; }
        if (neg) { cntNeg++; continue; }
        cntOk++;
        for (int s = 0; s < n; s++) {
            vector<long long> d(n, INF);
            d[s] = 0;
            for (int pass = 0; pass < n; pass++)
                for (auto& e : es) if (d[e[0]] < INF && d[e[0]] + e[2] < d[e[1]]) d[e[1]] = d[e[0]] + e[2];
            for (int v = 0; v < n; v++) {
                if (fw.d[s][v] != d[v]) { printf("SAI d[%d][%d] iter=%d: %lld != %lld\n", s, v, iter, fw.d[s][v], d[v]); return 1; }
                auto path = fw.path(s, v);
                if (d[v] == INF) { if (!path.empty()) { puts("SAI đường đi của cặp không tới được"); return 1; } continue; }
                if (path.empty() || path.front() != s || path.back() != v || (int)path.size() > n) { printf("SAI dạng đường đi iter=%d\n", iter); return 1; }
                long long sum = 0;
                for (size_t i = 0; i + 1 < path.size(); i++) {
                    long long b = best[path[i]][path[i + 1]];
                    if (b == INF) { puts("SAI đường đi không đi theo cạnh"); return 1; }
                    sum += b;
                }
                if (sum != d[v]) { printf("SAI tổng đường đi iter=%d (%d->%d): %lld != %lld\n", iter, s, v, sum, d[v]); return 1; }
            }
        }
    }
    if (cntNeg < 200 || cntOk < 200) { printf("Dữ liệu thử lệch: cntNeg=%d cntOk=%d\n", cntNeg, cntOk); return 1; }
    // ví dụ trong mục
    {
        FW fw(4);
        fw.add_edge(0, 1, 3); fw.add_edge(1, 2, -1); fw.add_edge(2, 3, 2); fw.add_edge(0, 3, 7);
        fw.run();
        vector<long long> w0 = {0, 3, 2, 4}, w1 = {INF, 0, -1, 1};
        vector<int> wp = {0, 1, 2, 3};
        if (fw.d[0] != w0 || fw.d[1] != w1 || fw.path(0, 3) != wp || fw.has_negative_cycle()) { puts("SAI ví dụ"); return 1; }
    }
    // một đỉnh, vòng tự trỏ dương bị bỏ qua, âm là chu trình âm
    { FW fw(1); fw.add_edge(0, 0, 5); fw.run(); if (fw.d[0][0] != 0 || fw.has_negative_cycle()) { puts("SAI vòng tự trỏ dương"); return 1; } }
    { FW fw(1); fw.add_edge(0, 0, -5); fw.run(); if (!fw.has_negative_cycle()) { puts("SAI vòng tự trỏ âm"); return 1; } }
    // ca lớn: đồ thị đầy đủ 300 đỉnh, trọng số 1..1e9, so với Dijkstra bản mảng O(V^2) từ vài nguồn
    {
        int n = 300;
        FW fw(n);
        vector<vector<long long>> w(n, vector<long long>(n, INF));
        for (int u = 0; u < n; u++)
            for (int v = 0; v < n; v++)
                if (u != v && rng() % 3 != 0) { long long c = 1 + rng() % 1000000000; fw.add_edge(u, v, c); w[u][v] = c; }
        fw.run();
        for (int s : {0, 17, 299}) {
            vector<long long> d(n, INF);
            vector<char> done(n, 0);
            d[s] = 0;
            for (int it = 0; it < n; it++) {
                int u = -1;
                for (int v = 0; v < n; v++) if (!done[v] && d[v] < INF && (u == -1 || d[v] < d[u])) u = v;
                if (u == -1) break;
                done[u] = 1;
                for (int v = 0; v < n; v++) if (w[u][v] < INF && d[u] + w[u][v] < d[v]) d[v] = d[u] + w[u][v];
            }
            if (fw.d[s] != d) { printf("SAI ca lớn từ nguồn %d\n", s); return 1; }
        }
        if (fw.has_negative_cycle()) { puts("SAI ca lớn: báo nhầm chu trình âm"); return 1; }
    }
    // chu trình âm với trọng số rất âm: giá trị phải được chặn ở -INF, không tràn
    {
        int n = 120;
        FW fw(n);
        for (int u = 0; u < n; u++)
            for (int v = 0; v < n; v++) fw.add_edge(u, v, -1000000000LL);
        fw.run();
        if (!fw.has_negative_cycle()) { puts("SAI chu trình âm lớn"); return 1; }
        for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) if (fw.d[i][j] < -INF) { puts("SAI tràn dưới"); return 1; }
    }
    puts("OK");
    return 0;
}
