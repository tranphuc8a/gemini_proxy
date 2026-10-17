// @TEMPLATE

// Thử ClosestPair với vét cạn O(n^2) (toạ độ nhỏ nên rất nhiều điểm trùng / thẳng hàng, và toạ độ ±1e9), các dãy đặc biệt
// (cùng x, cùng y, trùng hết, hai điểm xa nhất d^2 = 8e18) và ca lớn 200000 điểm so với thuật toán quét + set viết độc lập.
#define CHECK(cond, ...) do { if (!(cond)) { printf("SAI: "); printf(__VA_ARGS__); printf("\n"); return 1; } } while (0)

static long long dist2(const CpPt& a, const CpPt& b) {
    long long dx = a.x - b.x, dy = a.y - b.y;
    return dx * dx + dy * dy;
}
static long long bruteBest(const vector<CpPt>& p) {
    long long b = LLONG_MAX;
    for (size_t i = 0; i < p.size(); i++)
        for (size_t j = i + 1; j < p.size(); j++) b = min(b, dist2(p[i], p[j]));
    return b;
}
// thuật toán quét (độc lập với mẫu): duyệt theo x, giữ set theo (y, x) các điểm có hiệu x < d
static long long sweepBest(vector<CpPt> p) {            // cần p.size() >= 2
    sort(p.begin(), p.end(), [](const CpPt& a, const CpPt& b) { return a.x != b.x ? a.x < b.x : a.y < b.y; });
    long long best = dist2(p[0], p[1]);
    set<pair<long long, long long>> s;
    s.insert({p[0].y, p[0].x});
    size_t left = 0;
    for (size_t i = 1; i < p.size(); i++) {
        long long d = (long long)ceill(sqrtl((long double)best));
        while (left < i && p[i].x - p[left].x >= d) { s.erase({p[left].y, p[left].x}); left++; }
        auto it = s.lower_bound({p[i].y - d, LLONG_MIN});
        for (; it != s.end() && it->first <= p[i].y + d; ++it) best = min(best, dist2(p[i], CpPt{it->second, it->first}));
        s.insert({p[i].y, p[i].x});
    }
    return best;
}

int main() {
    mt19937_64 rng(20261017);
    ClosestPair cp;
    // 1) nhỏ, toạ độ nhỏ (nhiều trùng / thẳng hàng)
    for (int iter = 0; iter < 30000; iter++) {
        int n = 2 + rng() % 14, R = 1 + rng() % 10;
        vector<CpPt> p(n);
        for (auto& q : p) q = {(long long)(rng() % (R + 1)), (long long)(rng() % (R + 1))};
        CHECK(cp.solve(p) == bruteBest(p), "iter=%d n=%d", iter, n);
    }
    // 2) vừa, toạ độ toàn miền ±1e9
    for (int iter = 0; iter < 20; iter++) {
        int n = 2 + rng() % 1500;
        vector<CpPt> p(n);
        for (auto& q : p) q = {(long long)(rng() % 2000000001ULL) - 1000000000LL, (long long)(rng() % 2000000001ULL) - 1000000000LL};
        CHECK(cp.solve(p) == bruteBest(p), "toàn miền iter=%d n=%d", iter, n);
    }
    // 3) ví dụ trong mục và các dãy đặc biệt
    CHECK(cp.solve({{0, 0}, {5, 5}, {1, 1}, {9, 0}, {4, 5}}) == 1, "ví dụ trong mục");
    CHECK(cp.solve({{0, 0}, {3, 4}}) == 25 && cp.solve({{7, 7}, {7, 7}}) == 0, "hai điểm");
    CHECK(cp.solve({{-1000000000LL, -1000000000LL}, {1000000000LL, 1000000000LL}}) == 8000000000000000000LL, "d^2 = 8e18");
    {
        vector<CpPt> col, row, same(1000, CpPt{5, -5});
        for (int i = 0; i < 1000; i++) { col.push_back({0, 3LL * i}); row.push_back({3LL * i, 0}); }
        shuffle(col.begin(), col.end(), rng);
        shuffle(row.begin(), row.end(), rng);
        CHECK(cp.solve(col) == 9 && cp.solve(row) == 9 && cp.solve(same) == 0, "cùng x / cùng y / trùng hết");
    }
    // 4) ca lớn so với thuật toán quét độc lập
    {
        int n = 200000;
        vector<CpPt> p(n);
        for (auto& q : p) q = {(long long)(rng() % 2000000001ULL) - 1000000000LL, (long long)(rng() % 2000000001ULL) - 1000000000LL};
        long long a = cp.solve(p), b = sweepBest(p);
        CHECK(a == b, "ca lớn ngẫu nhiên: %lld != %lld", a, b);
        vector<CpPt> line(n);
        for (int i = 0; i < n; i++) line[i] = {0, 3LL * i};                 // cùng một đường thẳng đứng
        shuffle(line.begin(), line.end(), rng);
        CHECK(cp.solve(line) == 9, "ca lớn thẳng đứng");
        vector<CpPt> grid(n);
        for (int i = 0; i < n; i++) grid[i] = {(long long)(i % 500) * 1000000, (long long)(i / 500) * 1000000};
        a = cp.solve(grid); b = sweepBest(grid);
        CHECK(a == b && a == 1000000000000LL, "lưới đều: %lld != %lld", a, b);
    }
    puts("OK");
    return 0;
}
