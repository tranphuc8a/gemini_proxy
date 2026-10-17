// @TEMPLATE

// Thử treeMaxWeightIndependentSet với vét cạn mọi tập con (rừng ngẫu nhiên n <= 14, trọng số âm); kiểm tập chọn; cây sâu 10^6 (không đệ quy).
int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 4000; iter++) {
        int n = rng() % 15;
        vector<vector<int>> g(n);
        vector<pair<int, int>> edges;
        for (int v = 1; v < n; v++)
            if (rng() % 100 < 85) {  // 15% bỏ cạnh → rừng
                int p = rng() % v;
                g[p].push_back(v);
                g[v].push_back(p);
                edges.push_back({p, v});
            }
        // đánh số lại ngẫu nhiên để cha không luôn nhỏ hơn con
        vector<int> perm(n);
        iota(perm.begin(), perm.end(), 0);
        shuffle(perm.begin(), perm.end(), rng);
        vector<vector<int>> h(n);
        for (auto& e : edges) { h[perm[e.first]].push_back(perm[e.second]); h[perm[e.second]].push_back(perm[e.first]); }
        vector<long long> w(n);
        for (auto& x : w) x = (long long)(rng() % 30) - 8;
        long long best = 0;  // tập rỗng luôn hợp lệ
        for (int mask = 0; mask < (1 << n); mask++) {
            bool ok = true;
            for (auto& e : edges) if (((mask >> perm[e.first]) & 1) && ((mask >> perm[e.second]) & 1)) { ok = false; break; }
            if (!ok) continue;
            long long s = 0;
            for (int i = 0; i < n; i++) if ((mask >> i) & 1) s += w[i];
            best = max(best, s);
        }
        vector<char> pick;
        long long got = treeMaxWeightIndependentSet(h, w, &pick);
        if (got != best || treeMaxWeightIndependentSet(h, w) != best) { printf("SAI iter=%d n=%d: %lld != %lld\n", iter, n, got, best); return 1; }
        long long s = 0;
        for (int i = 0; i < n; i++) if (pick[i]) s += w[i];
        for (auto& e : edges) if (pick[perm[e.first]] && pick[perm[e.second]]) { printf("SAI tập chọn có hai đỉnh kề iter=%d\n", iter); return 1; }
        if (s != best) { printf("SAI tổng tập chọn iter=%d: %lld != %lld\n", iter, s, best); return 1; }
    }
    // ca biên: rỗng, một đỉnh (dương / âm)
    {
        vector<vector<int>> g0;
        vector<long long> w0;
        vector<char> pick;
        if (treeMaxWeightIndependentSet(g0, w0, &pick) != 0 || !pick.empty()) { puts("SAI rỗng"); return 1; }
        vector<vector<int>> g1(1);
        if (treeMaxWeightIndependentSet(g1, {5}) != 5 || treeMaxWeightIndependentSet(g1, {-5}) != 0) { puts("SAI một đỉnh"); return 1; }
    }
    // ví dụ trong thư viện: cạnh 1-2, 1-3, 3-4, 3-5 (0-based: 0-1, 0-2, 2-3, 2-4), w = 4 3 5 2 6 → 12, chọn {0, 3, 4}
    {
        vector<vector<int>> g(5);
        auto add = [&](int a, int b) { g[a].push_back(b); g[b].push_back(a); };
        add(0, 1); add(0, 2); add(2, 3); add(2, 4);
        vector<char> pick;
        long long got = treeMaxWeightIndependentSet(g, {4, 3, 5, 2, 6}, &pick);
        if (got != 12 || pick != vector<char>({1, 0, 0, 1, 1})) { puts("SAI ví dụ"); return 1; }
    }
    // cây dạng đường 10^6 đỉnh: không được đệ quy; trọng số 1 → ceil(n / 2)
    {
        int n = 1000000;
        vector<vector<int>> g(n);
        for (int i = 0; i + 1 < n; i++) { g[i].push_back(i + 1); g[i + 1].push_back(i); }
        vector<long long> w(n, 1);
        if (treeMaxWeightIndependentSet(g, w) != (n + 1) / 2) { puts("SAI đường 10^6"); return 1; }
    }
    // sao 10^6 đỉnh: tâm nặng 10^12 → chọn tâm; tâm nhẹ 1 → chọn mọi lá
    {
        int n = 1000000;
        vector<vector<int>> g(n);
        for (int i = 1; i < n; i++) { g[0].push_back(i); g[i].push_back(0); }
        vector<long long> w(n, 1000000);
        w[0] = 1000000000000LL;
        if (treeMaxWeightIndependentSet(g, w) != 1000000000000LL) { puts("SAI sao nặng tâm"); return 1; }
        w[0] = 1;
        if (treeMaxWeightIndependentSet(g, w) != 1000000LL * (n - 1)) { puts("SAI sao nhẹ tâm"); return 1; }
    }
    puts("OK");
}
