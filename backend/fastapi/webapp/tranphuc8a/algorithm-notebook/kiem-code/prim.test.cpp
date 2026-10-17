// @TEMPLATE

// Thử Prim: so với vét mọi tập cạnh trong thành phần của đỉnh xuất phát (cây khung nhỏ nhất = tập không chu trình có |C| - 1 cạnh, tổng nhỏ nhất),
// đồ thị ngẫu nhiên nhỏ có trọng số âm, cạnh song song, vòng tự trỏ, không liên thông; ca lớn so với Kruskal viết ngay trong test.
int main() {
    mt19937 rng(20261017);
    const long long BIG = (long long)4e18;
    for (int iter = 0; iter < 3000; iter++) {
        int n = 1 + rng() % 7, m = rng() % 12;
        Prim pr(n);
        vector<array<long long, 3>> es;
        vector<vector<long long>> best(n, vector<long long>(n, BIG));
        vector<int> p(n);
        iota(p.begin(), p.end(), 0);
        function<int(int)> find = [&](int x) { return p[x] == x ? x : p[x] = find(p[x]); };
        for (int i = 0; i < m; i++) {
            int u = rng() % n, v = rng() % n;
            long long w = (long long)(rng() % 11) - 4;
            pr.add_edge(u, v, w);
            es.push_back({u, v, w});
            if (u != v) { best[u][v] = min(best[u][v], w); best[v][u] = min(best[v][u], w); }
            p[find(u)] = find(v);
        }
        int s = rng() % n;
        vector<int> comp;
        for (int i = 0; i < n; i++) if (find(i) == find(s)) comp.push_back(i);
        int need = comp.size() - 1;
        vector<int> eidx;  // cạnh nằm trong thành phần của s
        for (int i = 0; i < m; i++) if (find(es[i][0]) == find(s)) eidx.push_back(i);
        long long bestW = LLONG_MAX;
        int k = eidx.size();
        for (int mask = 0; mask < (1 << k); mask++) {
            if (__builtin_popcount(mask) != need) continue;
            vector<int> q(n);
            iota(q.begin(), q.end(), 0);
            function<int(int)> f2 = [&](int x) { return q[x] == x ? x : q[x] = f2(q[x]); };
            bool ok = true;
            long long sum = 0;
            for (int j = 0; j < k && ok; j++)
                if (mask >> j & 1) {
                    auto& e = es[eidx[j]];
                    int a = f2(e[0]), b = f2(e[1]);
                    if (a == b) ok = false;
                    else { q[a] = b; sum += e[2]; }
                }
            if (ok) bestW = min(bestW, sum);
        }
        long long tot = pr.run(s);
        if (tot != bestW) { printf("SAI tổng iter=%d: %lld != %lld\n", iter, tot, bestW); return 1; }
        if (pr.reached != (int)comp.size()) { printf("SAI reached iter=%d\n", iter); return 1; }
        // cây par: đúng thành phần, tổng trọng số cạnh nhẹ nhất nối v với par[v] = tổng
        long long sum = 0;
        for (int v = 0; v < n; v++) {
            bool inComp = find(v) == find(s);
            if (!inComp || v == s) { if (pr.par[v] != -1) { puts("SAI par của s hoặc đỉnh ngoài thành phần"); return 1; } continue; }
            int pv = pr.par[v];
            if (pv < 0 || best[pv][v] == BIG) { puts("SAI par không phải cạnh"); return 1; }
            sum += best[pv][v];
        }
        if (sum != tot) { printf("SAI tổng theo par iter=%d: %lld != %lld\n", iter, sum, tot); return 1; }
    }
    // ví dụ trong mục
    {
        Prim pr(4);
        pr.add_edge(0, 1, 1); pr.add_edge(1, 2, 2); pr.add_edge(0, 2, 3); pr.add_edge(2, 3, 4); pr.add_edge(1, 3, 5);
        if (pr.run(0) != 7 || pr.reached != 4) { puts("SAI ví dụ"); return 1; }
    }
    // một đỉnh, vòng tự trỏ âm bị bỏ qua
    { Prim pr(1); pr.add_edge(0, 0, -7); if (pr.run(0) != 0 || pr.reached != 1) { puts("SAI một đỉnh"); return 1; } }
    // ca lớn so với Kruskal viết trong test: n = 100000, m = 500000 (xích để liên thông + cạnh ngẫu nhiên, trọng số tới 1e9, có âm)
    {
        int n = 100000, m = 500000;
        Prim pr(n);
        vector<array<long long, 3>> es;
        auto add = [&](int u, int v, long long w) { pr.add_edge(u, v, w); es.push_back({w, u, v}); };
        for (int i = 0; i + 1 < n; i++) add(i, i + 1, (long long)(rng() % 1000000000) + 1000000000LL);
        for (int i = 0; i < m; i++) add(rng() % n, rng() % n, (long long)(rng() % 2000000000) - 1000000000LL);
        sort(es.begin(), es.end());
        vector<int> par(n);
        iota(par.begin(), par.end(), 0);
        function<int(int)> find = [&](int x) { while (par[x] != x) { par[x] = par[par[x]]; x = par[x]; } return x; };
        long long ref = 0;
        for (auto& e : es) {
            int a = find(e[1]), b = find(e[2]);
            if (a != b) { par[a] = b; ref += e[0]; }
        }
        long long tot = pr.run(0);
        if (tot != ref || pr.reached != n) { printf("SAI ca lớn: %lld != %lld\n", tot, ref); return 1; }
    }
    puts("OK");
    return 0;
}
