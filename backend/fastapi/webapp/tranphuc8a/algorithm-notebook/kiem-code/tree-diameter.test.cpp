// @TEMPLATE

// Thử đường kính cây: so với vét mọi cặp đỉnh (khoảng cách tính bằng duyệt từ từng đỉnh) trên cây ngẫu nhiên nhỏ trọng số 0..10 (có cạnh trọng số 0),
// kiểm tra đường đi hợp lệ, khoảng cách xa nhất của mọi đỉnh = max(da, db); ca lớn so với quy hoạch động hai nhánh sâu nhất.
typedef vector<vector<pair<int, long long>>> WTree;

static vector<long long> dists_from(const WTree& g, int s) {
    int n = g.size();
    vector<long long> d(n, -1);
    vector<int> st = {s};
    d[s] = 0;
    while (!st.empty()) {
        int u = st.back();
        st.pop_back();
        for (auto [v, w] : g[u]) if (d[v] == -1) { d[v] = d[u] + w; st.push_back(v); }
    }
    return d;
}

int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 5000; iter++) {
        int n = 1 + rng() % 10;
        WTree g(n);
        map<pair<int, int>, long long> wt;
        for (int i = 1; i < n; i++) {
            int p = rng() % i;
            long long w = rng() % 11;
            g[i].push_back({p, w});
            g[p].push_back({i, w});
            wt[{i, p}] = wt[{p, i}] = w;
        }
        auto r = tree_diameter(g);
        long long best = 0;
        vector<long long> ecc(n, 0);
        for (int s = 0; s < n; s++) {
            auto d = dists_from(g, s);
            for (int v = 0; v < n; v++) { best = max(best, d[v]); ecc[s] = max(ecc[s], d[v]); }
        }
        if (r.length != best) { printf("SAI độ dài iter=%d: %lld != %lld\n", iter, r.length, best); return 1; }
        // đường đi: đơn, đi theo cạnh, tổng bằng length
        if (r.path.empty()) { puts("SAI đường đi rỗng"); return 1; }
        set<int> uniq(r.path.begin(), r.path.end());
        long long sum = 0;
        for (size_t i = 0; i + 1 < r.path.size(); i++) {
            auto it = wt.find({r.path[i], r.path[i + 1]});
            if (it == wt.end()) { puts("SAI đường đi không đi theo cạnh"); return 1; }
            sum += it->second;
        }
        if (uniq.size() != r.path.size() || sum != best) { printf("SAI đường đi iter=%d\n", iter); return 1; }
        if ((int)r.da.size() != n || (int)r.db.size() != n) { puts("SAI kích thước da/db"); return 1; }
        for (int v = 0; v < n; v++)
            if (max(r.da[v], r.db[v]) != ecc[v]) { printf("SAI khoảng cách xa nhất iter=%d v=%d: %lld != %lld\n", iter, v, max(r.da[v], r.db[v]), ecc[v]); return 1; }
        if (r.da[r.path.back()] != best || r.db[r.path.front()] != best) { puts("SAI da/db tại đầu mút"); return 1; }
    }
    // cây một đỉnh
    { WTree g(1); auto r = tree_diameter(g); if (r.length != 0 || r.path != vector<int>{0}) { puts("SAI một đỉnh"); return 1; } }
    // ví dụ trong mục
    {
        WTree g(6);
        auto add = [&](int a, int b, long long w) { g[a].push_back({b, w}); g[b].push_back({a, w}); };
        add(0, 1, 2); add(1, 2, 3); add(1, 3, 4); add(3, 4, 1); add(3, 5, 6);
        auto r = tree_diameter(g);
        vector<int> wantPath = {5, 3, 1, 2};
        if (r.length != 13 || r.path != wantPath || max(r.da[0], r.db[0]) != 12) { puts("SAI ví dụ"); return 1; }
    }
    // ca lớn 1: đường thẳng 10^6 đỉnh trọng số 1e9 (tổng vượt int32; đệ quy sẽ tràn ngăn xếp)
    {
        int n = 1000000;
        WTree g(n);
        for (int i = 0; i + 1 < n; i++) { g[i].push_back({i + 1, 1000000000LL}); g[i + 1].push_back({i, 1000000000LL}); }
        auto r = tree_diameter(g);
        if (r.length != 1000000000LL * (n - 1) || (int)r.path.size() != n) { puts("SAI ca lớn đường thẳng"); return 1; }
    }
    // ca lớn 2: cây ngẫu nhiên 100000 đỉnh so với quy hoạch động (hai nhánh sâu nhất) và vài đỉnh so với duyệt đầy đủ
    {
        int n = 100000;
        WTree g(n);
        vector<int> par(n, -1);
        vector<long long> pw(n, 0);
        for (int i = 1; i < n; i++) {
            int p = rng() % i;
            long long w = rng() % 1000000000;
            par[i] = p;
            pw[i] = w;
            g[i].push_back({p, w});
            g[p].push_back({i, w});
        }
        // vì par[i] < i, xử lý i từ n-1 xuống 1 là thứ tự từ lá lên gốc
        vector<long long> down(n, 0);
        long long best = 0;
        vector<long long> top1(n, 0), top2(n, 0);
        for (int i = n - 1; i >= 1; i--) {
            long long cand = down[i] + pw[i];
            int p = par[i];
            if (cand > top1[p]) { top2[p] = top1[p]; top1[p] = cand; }
            else if (cand > top2[p]) top2[p] = cand;
            down[p] = top1[p];
        }
        for (int v = 0; v < n; v++) best = max(best, top1[v] + top2[v]);
        auto r = tree_diameter(g);
        if (r.length != best) { printf("SAI ca lớn ngẫu nhiên: %lld != %lld\n", r.length, best); return 1; }
        for (int i = 0; i < 10; i++) {
            int v = rng() % n;
            auto d = dists_from(g, v);
            if (max(r.da[v], r.db[v]) != *max_element(d.begin(), d.end())) { puts("SAI ca lớn khoảng cách xa nhất"); return 1; }
        }
    }
    puts("OK");
    return 0;
}
