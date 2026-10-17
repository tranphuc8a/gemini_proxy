// @TEMPLATE

// Thử Kruskal: so với vét mọi tập cạnh (rừng khung nhỏ nhất = tập không chu trình có n - c cạnh, tổng nhỏ nhất) trên đồ thị ngẫu nhiên nhỏ
// có trọng số âm, cạnh song song, vòng tự trỏ, không liên thông; so với Prim O(V^2) trên đồ thị vừa; ca lớn tràn int32.
static bool is_forest(int n, const vector<array<long long, 3>>& es, const vector<int>& idx) {
    vector<int> p(n);
    iota(p.begin(), p.end(), 0);
    function<int(int)> find = [&](int x) { return p[x] == x ? x : p[x] = find(p[x]); };
    for (int i : idx) {
        int a = find(es[i][0]), b = find(es[i][1]);
        if (a == b) return false;
        p[a] = b;
    }
    return true;
}

int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 3000; iter++) {
        int n = 1 + rng() % 7, m = rng() % 12;
        Kruskal k(n);
        vector<array<long long, 3>> es;
        vector<int> p(n);
        iota(p.begin(), p.end(), 0);
        function<int(int)> find = [&](int x) { return p[x] == x ? x : p[x] = find(p[x]); };
        for (int i = 0; i < m; i++) {
            int u = rng() % n, v = rng() % n;
            long long w = (long long)(rng() % 11) - 4;
            k.add_edge(u, v, w);
            es.push_back({u, v, w});
            p[find(u)] = find(v);
        }
        int comps = 0;
        for (int i = 0; i < n; i++) if (find(i) == i) comps++;
        long long bestW = LLONG_MAX;
        for (int mask = 0; mask < (1 << m); mask++) {
            if (__builtin_popcount(mask) != n - comps) continue;
            vector<int> idx;
            long long sum = 0;
            for (int i = 0; i < m; i++) if (mask >> i & 1) { idx.push_back(i); sum += es[i][2]; }
            if (is_forest(n, es, idx)) bestW = min(bestW, sum);
        }
        vector<int> picked;
        int c2 = -1;
        long long tot = k.run(&picked, &c2);
        if (tot != bestW) { printf("SAI tổng iter=%d: %lld != %lld\n", iter, tot, bestW); return 1; }
        if (c2 != comps) { printf("SAI số thành phần iter=%d\n", iter); return 1; }
        if ((int)picked.size() != n - comps) { printf("SAI số cạnh nhận iter=%d\n", iter); return 1; }
        set<int> uniq(picked.begin(), picked.end());
        long long sum = 0;
        for (int i : picked) { if (i < 0 || i >= m) { puts("SAI chỉ số cạnh"); return 1; } sum += es[i][2]; }
        if (uniq.size() != picked.size() || sum != tot || !is_forest(n, es, picked)) { printf("SAI tập cạnh nhận iter=%d\n", iter); return 1; }
        if (k.run() != tot) { puts("SAI run() không tham số"); return 1; }
    }
    // ví dụ trong mục
    {
        Kruskal k(4);
        k.add_edge(0, 1, 1); k.add_edge(1, 2, 2); k.add_edge(0, 2, 3); k.add_edge(2, 3, 4); k.add_edge(1, 3, 5);
        vector<int> picked, want = {0, 1, 3};
        int c;
        if (k.run(&picked, &c) != 7 || picked != want || c != 1) { puts("SAI ví dụ"); return 1; }
    }
    // không có cạnh; một đỉnh
    { Kruskal k(5); int c; if (k.run(nullptr, &c) != 0 || c != 5) { puts("SAI không cạnh"); return 1; } }
    { Kruskal k(1); k.add_edge(0, 0, -7); int c; if (k.run(nullptr, &c) != 0 || c != 1) { puts("SAI vòng tự trỏ"); return 1; } }
    // đồ thị vừa so với Prim O(V^2) (nối thêm xích nặng để đảm bảo liên thông)
    for (int iter = 0; iter < 5; iter++) {
        int n = 600, m = 3000;
        Kruskal k(n);
        const long long BIG = (long long)4e18;
        vector<vector<long long>> mat(n, vector<long long>(n, BIG));
        auto add = [&](int u, int v, long long w) { k.add_edge(u, v, w); if (u != v) { mat[u][v] = min(mat[u][v], w); mat[v][u] = min(mat[v][u], w); } };
        for (int i = 0; i + 1 < n; i++) add(i, i + 1, 1000000000LL + rng() % 1000);
        for (int i = 0; i < m; i++) add(rng() % n, rng() % n, (long long)(rng() % 2000000000) - 1000000000);
        long long ref = 0;
        vector<long long> key(n, BIG);
        vector<char> in(n, 0);
        key[0] = 0;
        for (int it = 0; it < n; it++) {
            int u = -1;
            for (int v = 0; v < n; v++) if (!in[v] && (u == -1 || key[v] < key[u])) u = v;
            in[u] = 1;
            ref += key[u];
            for (int v = 0; v < n; v++) if (!in[v] && mat[u][v] < key[v]) key[v] = mat[u][v];
        }
        int c;
        long long tot = k.run(nullptr, &c);
        if (tot != ref || c != 1) { printf("SAI so với Prim iter=%d: %lld != %lld\n", iter, tot, ref); return 1; }
    }
    // ca lớn: xích 200000 đỉnh trọng số 1e9 + 600000 cạnh nặng hơn => MST là xích, tổng vượt int32
    {
        int n = 200000;
        Kruskal k(n);
        for (int i = 0; i + 1 < n; i++) k.add_edge(i, i + 1, 1000000000LL);
        for (int i = 0; i < 600000; i++) k.add_edge(rng() % n, rng() % n, 1000000001LL + rng() % 1000);
        vector<int> picked;
        int c;
        long long tot = k.run(&picked, &c);
        if (tot != 1000000000LL * (n - 1) || c != 1 || (int)picked.size() != n - 1) { puts("SAI ca lớn"); return 1; }
    }
    puts("OK");
    return 0;
}
