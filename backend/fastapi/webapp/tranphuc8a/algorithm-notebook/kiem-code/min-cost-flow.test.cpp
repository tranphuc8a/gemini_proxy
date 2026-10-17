// @TEMPLATE

// Thử Min Cost Flow: (1) đồ thị nhỏ so với vét cạn MỌI phép gán luồng (chi phí nhỏ nhất cho từng giá trị luồng k, có cả cạnh chi phí âm trên DAG,
// dung lượng 0..2, vòng tự trỏ, cạnh song song); mọi giới hạn K = 0..maxflow+1; (2) bài phân công n x n so với vét cạn hoán vị;
// (3) đồ thị lớn: chứng chỉ tối ưu = luồng hợp lệ + chi phí tính lại đúng + KHÔNG còn chu trình âm trong đồ thị phần dư.
struct TE { int u, v; long long cap, cost; };

static bool chung_chi(const MinCostFlow& m, const vector<int>& ids, const vector<TE>& es, int n, int s, int t, pair<long long, long long> r, const char* ctx) {
    vector<long long> bal(n, 0);
    long long cost = 0;
    for (size_t i = 0; i < es.size(); i++) {
        long long f = m.e[ids[i] ^ 1].cap;
        if (f < 0 || f > es[i].cap) { printf("SAI %s: luồng cạnh %zu ngoài [0, cap]\n", ctx, i); return false; }
        cost += f * es[i].cost;
        bal[es[i].u] -= f; bal[es[i].v] += f;
    }
    for (int v = 0; v < n; v++)
        if (v != s && v != t && bal[v] != 0) { printf("SAI %s: không bảo toàn luồng tại %d\n", ctx, v); return false; }
    if (s != t && (bal[t] != r.first || bal[s] != -r.first)) { printf("SAI %s: luồng ra s / vào t khác giá trị trả về\n", ctx); return false; }
    if (cost != r.second) { printf("SAI %s: chi phí tính lại %lld khác %lld\n", ctx, cost, r.second); return false; }
    // không còn chu trình âm trong đồ thị phần dư (Bellman-Ford từ nguồn ảo)
    vector<long long> d(n, 0);
    bool changed = true;
    for (int round = 0; round <= n && changed; round++) {
        changed = false;
        for (size_t i = 0; i < m.e.size(); i++) {
            int from = m.e[i ^ 1].to, to = m.e[i].to;
            if (m.e[i].cap > 0 && d[from] + m.e[i].cost < d[to]) { d[to] = d[from] + m.e[i].cost; changed = true; }
        }
    }
    if (changed) { printf("SAI %s: còn chu trình âm trong đồ thị phần dư (chưa tối ưu)\n", ctx); return false; }
    return true;
}

int main() {
    mt19937_64 rng(20261019);
    // (1) vét cạn trên đồ thị nhỏ
    for (int iter = 0; iter < 1500; iter++) {
        int n = 2 + rng() % 4, m = rng() % 7;
        bool dag = iter % 2 == 0;                  // DAG: cho phép chi phí âm
        int s = rng() % n, t = rng() % n;
        if (iter % 20 == 19) t = s;
        vector<TE> es;
        for (int i = 0; i < m; i++) {
            int u, v;
            long long cost;
            if (dag) { u = rng() % (n - 1); v = u + 1 + rng() % (n - u - 1); cost = (long long)(rng() % 11) - 5; }
            else { u = rng() % n; v = rng() % n; cost = rng() % 6; }
            es.push_back({u, v, (long long)(rng() % 3), cost});
        }
        // vét cạn: best[k] = chi phí nhỏ nhất của luồng giá trị k (k = lượng ra khỏi s), mọi đỉnh khác s, t bảo toàn
        map<long long, long long> best;
        vector<long long> f(m, 0);
        for (;;) {
            vector<long long> bal(n, 0);
            long long cost = 0;
            for (int i = 0; i < m; i++) { bal[es[i].u] -= f[i]; bal[es[i].v] += f[i]; cost += f[i] * es[i].cost; }
            bool ok = true;
            for (int v = 0; v < n; v++) if (v != s && v != t && bal[v] != 0) ok = false;
            long long k = -bal[s];
            if (s == t) k = 0;
            if (ok && k >= 0 && (s == t || bal[t] == k)) {
                auto it = best.find(k);
                if (it == best.end() || cost < it->second) best[k] = cost;
            }
            int i = 0;
            while (i < m && f[i] == es[i].cap) f[i++] = 0;
            if (i == m) break;
            f[i]++;
        }
        long long maxf = best.rbegin()->first;
        for (long long K = 0; K <= maxf + 1; K++) {
            MinCostFlow mc(n);
            vector<int> ids;
            for (const TE& e : es) ids.push_back(mc.add_edge(e.u, e.v, e.cap, e.cost));
            auto r = mc.min_cost_flow(s, t, K);
            long long kk = min(K, maxf);
            if (r.first != kk || r.second != best[kk]) {
                printf("SAI iter=%d K=%lld: (%lld, %lld) thay vì (%lld, %lld)\n", iter, K, r.first, r.second, kk, best[kk]);
                return 1;
            }
        }
        MinCostFlow mc(n);
        vector<int> ids;
        for (const TE& e : es) ids.push_back(mc.add_edge(e.u, e.v, e.cap, e.cost));
        auto r = mc.min_cost_flow(s, t);
        if (r.first != maxf || r.second != best[maxf]) { printf("SAI iter=%d không giới hạn: (%lld, %lld)\n", iter, r.first, r.second); return 1; }
        if (!chung_chi(mc, ids, es, n, s, t, r, "nhỏ")) return 1;
    }
    // (2) phân công n x n qua luồng chi phí nhỏ nhất so với vét cạn hoán vị
    for (int iter = 0; iter < 300; iter++) {
        int n = 1 + rng() % 6;
        vector<vector<long long>> c(n, vector<long long>(n));
        for (auto& row : c) for (auto& x : row) x = rng() % 30;
        MinCostFlow mc(2 * n + 2);
        int s = 2 * n, t = 2 * n + 1;
        for (int i = 0; i < n; i++) {
            mc.add_edge(s, i, 1, 0);
            mc.add_edge(n + i, t, 1, 0);
            for (int j = 0; j < n; j++) mc.add_edge(i, n + j, 1, c[i][j]);
        }
        auto r = mc.min_cost_flow(s, t);
        vector<int> p(n);
        iota(p.begin(), p.end(), 0);
        long long best = LLONG_MAX;
        do {
            long long sum = 0;
            for (int i = 0; i < n; i++) sum += c[i][p[i]];
            best = min(best, sum);
        } while (next_permutation(p.begin(), p.end()));
        if (r.first != n || r.second != best) { printf("SAI phân công iter=%d: (%lld, %lld) thay vì (%d, %lld)\n", iter, r.first, r.second, n, best); return 1; }
    }
    // (3a) đồ thị lớn chi phí không âm
    {
        int n = 1500, m = 9000;
        MinCostFlow mc(n);
        vector<TE> es;
        vector<int> ids;
        for (int i = 0; i + 1 < n; i++) es.push_back({i, i + 1, 1 + (long long)(rng() % 20), (long long)(rng() % 101)});
        while ((int)es.size() < m) {
            int u = rng() % n, v = rng() % n;
            es.push_back({u, v, 1 + (long long)(rng() % 20), (long long)(rng() % 101)});
        }
        for (const TE& e : es) ids.push_back(mc.add_edge(e.u, e.v, e.cap, e.cost));
        auto r = mc.min_cost_flow(0, n - 1);
        if (r.first <= 0) { puts("SAI ca lớn: luồng phải dương"); return 1; }
        if (!chung_chi(mc, ids, es, n, 0, n - 1, r, "lớn không âm")) return 1;
    }
    // (3b) DAG lớn có chi phí âm
    {
        int n = 800, m = 6000;
        MinCostFlow mc(n);
        vector<TE> es;
        vector<int> ids;
        for (int i = 0; i + 1 < n; i++) es.push_back({i, i + 1, 1 + (long long)(rng() % 10), (long long)(rng() % 101) - 50});
        while ((int)es.size() < m) {
            int u = rng() % (n - 1), v = u + 1 + rng() % (n - u - 1);
            es.push_back({u, v, 1 + (long long)(rng() % 10), (long long)(rng() % 101) - 50});
        }
        for (const TE& e : es) ids.push_back(mc.add_edge(e.u, e.v, e.cap, e.cost));
        auto r = mc.min_cost_flow(0, n - 1);
        if (r.first <= 0) { puts("SAI DAG: luồng phải dương"); return 1; }
        if (!chung_chi(mc, ids, es, n, 0, n - 1, r, "DAG âm")) return 1;
    }
    // chi phí lớn: không tràn int32 (một cạnh 1e9 x luồng 1e9)
    {
        MinCostFlow mc(2);
        mc.add_edge(0, 1, 1000000000LL, 1000000000LL);
        auto r = mc.min_cost_flow(0, 1);
        if (r.first != 1000000000LL || r.second != 1000000000000000000LL) { puts("SAI chi phí lớn"); return 1; }
    }
    puts("OK");
    return 0;
}
