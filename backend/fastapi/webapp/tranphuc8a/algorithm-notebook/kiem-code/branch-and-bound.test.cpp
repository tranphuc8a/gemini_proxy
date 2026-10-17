// @TEMPLATE

// Thử Branch & Bound (chính xác): knapsack 0/1 với cận nới lỏng phân số so với DP; TSP với cận "tổng cạnh vào nhỏ nhất" so với vét cạn;
// cận tầm thường (luôn 0) vẫn cho đúng tối ưu nhưng thăm nhiều nút hơn; cắt tỉa thật sự giảm số nút; ví dụ trong mô tả (đáp số 90).
struct Item { long long w, v; };

// Knapsack: trạng thái = (i, w, v); cực tiểu hoá -v; cận = -(v + phần nới lỏng phân số của các đồ vật còn lại, đã sắp theo v/w giảm dần)
struct Knap {
    vector<Item> it;
    long long cap;
    struct St { int i = 0; long long w = 0, v = 0; };
    double bound(const St& s) const {
        double val = s.v;
        long long room = cap - s.w;
        for (int k = s.i; k < (int)it.size(); k++) {
            if (it[k].w <= room) { room -= it[k].w; val += it[k].v; }
            else { val += (double)it[k].v * room / it[k].w; break; }
        }
        return -val;
    }
    bool done(const St& s) const { return s.i == (int)it.size(); }
    vector<St> kids(const St& s) const {
        vector<St> r;
        if (s.w + it[s.i].w <= cap) r.push_back({s.i + 1, s.w + it[s.i].w, s.v + it[s.i].v});
        r.push_back({s.i + 1, s.w, s.v});
        return r;
    }
    long long dp() const {
        vector<long long> f(cap + 1, 0);
        for (auto& x : it) for (long long c = cap; c >= x.w; c--) f[c] = max(f[c], f[c - x.w] + x.v);
        return f[cap];
    }
};

struct Tsp {
    int n;
    vector<vector<double>> d;
    vector<double> minIn;
    Tsp(int n_, mt19937& rng) : n(n_), d(n_, vector<double>(n_, 0)), minIn(n_, 1e18) {
        vector<pair<double, double>> p(n);
        for (auto& q : p) q = {rng() / 4294967296.0 * 100, rng() / 4294967296.0 * 100};
        for (int i = 0; i < n; i++)
            for (int j = 0; j < n; j++) d[i][j] = hypot(p[i].first - p[j].first, p[i].second - p[j].second);
        for (int c = 0; c < n; c++) for (int u = 0; u < n; u++) if (u != c) minIn[c] = min(minIn[c], d[u][c]);
    }
    double len(const vector<int>& t) const {
        double s = 0;
        for (int i = 0; i < n; i++) s += d[t[i]][t[(i + 1) % n]];
        return s;
    }
    double brute() const {
        vector<int> t(n);
        iota(t.begin(), t.end(), 0);
        double best = 1e18;
        do { best = min(best, len(t)); } while (next_permutation(t.begin() + 1, t.end()));
        return best;
    }
    // trạng thái = đường đi dở dang từ 0; cận = độ dài đã đi + (mỗi thành phố chưa thăm cần một cạnh VÀO >= minIn) + cạnh vào thành phố 0
    double bound(const vector<int>& t) const {
        double s = 0;
        for (int i = 0; i + 1 < (int)t.size(); i++) s += d[t[i]][t[i + 1]];
        if ((int)t.size() == n) return s + d[t.back()][t[0]];
        vector<char> seen(n, 0);
        for (int c : t) seen[c] = 1;
        for (int c = 0; c < n; c++) if (!seen[c]) s += minIn[c];
        return s + minIn[0];
    }
    vector<vector<int>> kids(const vector<int>& t) const {
        vector<char> seen(n, 0);
        for (int c : t) seen[c] = 1;
        vector<vector<int>> r;
        for (int c = 0; c < n; c++) if (!seen[c]) { auto u = t; u.push_back(c); r.push_back(u); }
        return r;
    }
};

int main() {
    mt19937 rng(20261017);
    // 1) knapsack ngẫu nhiên N = 1..14 so với DP; đồng thời so số nút với 2^(N+1) - 1 (cây đầy đủ)
    long long totalNodes = 0, totalFull = 0;
    for (int iter = 0; iter < 300; iter++) {
        int n = 1 + iter % 14;
        Knap k;
        for (int i = 0; i < n; i++) k.it.push_back({(long long)(1 + rng() % 12), (long long)(1 + rng() % 30)});
        k.cap = 1 + rng() % 40;
        sort(k.it.begin(), k.it.end(), [](const Item& a, const Item& b) { return a.v * b.w > b.v * a.w; });
        BranchAndBound<Knap::St> bb;
        bb.lowerBound = [&](const Knap::St& s) { return k.bound(s); };
        bb.complete = [&](const Knap::St& s) { return k.done(s); };
        bb.children = [&](const Knap::St& s) { return k.kids(s); };
        if (!bb.solve(Knap::St())) { puts("SAI: không tìm được nghiệm"); return 1; }
        if (llround(-bb.best) != k.dp()) { printf("SAI knapsack iter=%d: %lld != %lld\n", iter, llround(-bb.best), k.dp()); return 1; }
        if (bb.bestState.v != llround(-bb.best) || bb.bestState.w > k.cap) { puts("SAI: nghiệm trả về không khớp"); return 1; }
        totalNodes += bb.nodes;
        totalFull += (1LL << (n + 1)) - 1;
        // cận tầm thường: vẫn đúng tối ưu, nhưng không cắt được gì (nhiều nút hơn hoặc bằng)
        BranchAndBound<Knap::St> weak;
        weak.lowerBound = [&](const Knap::St& s) { return k.done(s) ? -(double)s.v : -1e9; };
        weak.complete = bb.complete;
        weak.children = bb.children;
        weak.solve(Knap::St());
        if (llround(-weak.best) != k.dp()) { puts("SAI: cận yếu cho kết quả sai"); return 1; }
        if (weak.nodes < bb.nodes) { puts("SAI: cận chặt mà thăm nhiều nút hơn cận yếu"); return 1; }
    }
    if (totalNodes * 2 > totalFull) { printf("SAI: cắt tỉa kém: %lld nút / %lld\n", totalNodes, totalFull); return 1; }
    // 2) ví dụ trong mô tả: sức chứa 10, đồ vật (5,10), (4,40), (6,30), (3,50) -> 90
    {
        Knap k;
        k.it = {{5, 10}, {4, 40}, {6, 30}, {3, 50}};
        k.cap = 10;
        sort(k.it.begin(), k.it.end(), [](const Item& a, const Item& b) { return a.v * b.w > b.v * a.w; });
        if (k.it[0].w != 3 || k.it[1].w != 4 || k.it[2].w != 6 || k.it[3].w != 5) { puts("SAI: thứ tự tỉ số trong ví dụ"); return 1; }
        if (fabs(k.bound(Knap::St()) + 105.0) > 1e-9) { puts("SAI: cận gốc phải là 105"); return 1; }
        Knap::St skipBest;   // bỏ đồ vật (3,50)
        skipBest.i = 1;
        if (fabs(k.bound(skipBest) + 70.0) > 1e-9) { puts("SAI: cận nhánh bỏ (3,50) phải là 70"); return 1; }
        BranchAndBound<Knap::St> bb;
        bb.lowerBound = [&](const Knap::St& s) { return k.bound(s); };
        bb.complete = [&](const Knap::St& s) { return k.done(s); };
        bb.children = [&](const Knap::St& s) { return k.kids(s); };
        bb.solve(Knap::St());
        if (llround(-bb.best) != 90 || bb.bestState.w != 7) { puts("SAI: ví dụ mô tả"); return 1; }
    }
    // 3) TSP n = 1..9 so với vét cạn; tổng số nút ít hơn cây đầy đủ
    {
        long long nodes = 0, full = 0;
        for (int iter = 0; iter < 60; iter++) {
            int n = 1 + iter % 9;
            Tsp tsp(n, rng);
            BranchAndBound<vector<int>> bb;
            bb.lowerBound = [&](const vector<int>& t) { return tsp.bound(t); };
            bb.complete = [&](const vector<int>& t) { return (int)t.size() == n; };
            bb.children = [&](const vector<int>& t) { return tsp.kids(t); };
            if (!bb.solve(vector<int>{0})) { puts("SAI: TSP không có nghiệm"); return 1; }
            double opt = tsp.brute();
            if (fabs(bb.best - opt) > 1e-7) { printf("SAI TSP iter=%d n=%d: %.6f != %.6f\n", iter, n, bb.best, opt); return 1; }
            if (fabs(tsp.len(bb.bestState) - opt) > 1e-7) { puts("SAI: nghiệm TSP trả về"); return 1; }
            nodes += bb.nodes;
            long long f = 1, layer = 1;
            for (int k = 1; k < n; k++) { layer *= (n - k); f += layer; }
            full += f;
        }
        if (nodes * 2 > full) { printf("SAI: TSP cắt tỉa kém: %lld / %lld\n", nodes, full); return 1; }
    }
    // 4) không có nghiệm hoàn chỉnh: solve trả false
    {
        BranchAndBound<int> bb;
        bb.lowerBound = [](const int& s) { return (double)s; };
        bb.complete = [](const int&) { return false; };
        bb.children = [](const int& s) { return s < 3 ? vector<int>{s + 1} : vector<int>{}; };
        if (bb.solve(0)) { puts("SAI: không có nghiệm mà solve trả true"); return 1; }
    }
    puts("OK");
}
