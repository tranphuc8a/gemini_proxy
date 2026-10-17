// @TEMPLATE

// Thử countHVIntersections với vét cạn mọi cặp (đoạn ngang, đoạn dọc): toạ độ nhỏ nên rất nhiều chạm đầu mút / đoạn suy biến thành điểm,
// ca vừa 3000 x 3000 toạ độ ±1e9, lưới 1000 x 1000 (đúng 1e6 giao điểm) và ca 200000 x 200000 mà mọi cặp đều cắt (4e10 vượt int32).
#define CHECK(cond, ...) do { if (!(cond)) { printf("SAI: "); printf(__VA_ARGS__); printf("\n"); return 1; } } while (0)

static long long brute(const vector<HSeg>& hs, const vector<VSeg>& vs) {
    long long cnt = 0;
    for (auto& h : hs)
        for (auto& v : vs)
            if (v.x >= h.x1 && v.x <= h.x2 && h.y >= v.y1 && h.y <= v.y2) cnt++;
    return cnt;
}

int main() {
    mt19937_64 rng(20261017);
    for (int iter = 0; iter < 20000; iter++) {
        int nh = rng() % 8, nv = rng() % 8;
        vector<HSeg> hs(nh);
        vector<VSeg> vs(nv);
        for (auto& h : hs) { h.y = rng() % 7; h.x1 = rng() % 7; h.x2 = h.x1 + rng() % 4; }
        for (auto& v : vs) { v.x = rng() % 10; v.y1 = rng() % 7; v.y2 = v.y1 + rng() % 4; }
        long long e = brute(hs, vs), g = countHVIntersections(hs, vs);
        CHECK(g == e, "iter=%d: %lld != %lld", iter, g, e);
    }
    // ví dụ trong mục
    {
        vector<HSeg> hs = {{1, 0, 4}, {3, 2, 6}};
        vector<VSeg> vs = {{3, 0, 2}, {5, 2, 4}};
        CHECK(countHVIntersections(hs, vs) == 2, "ví dụ trong mục");
        CHECK(countHVIntersections({}, vs) == 0 && countHVIntersections(hs, {}) == 0 && countHVIntersections({}, {}) == 0, "rỗng");
    }
    // ca vừa, toạ độ lớn
    {
        int n = 3000;
        vector<HSeg> hs(n);
        vector<VSeg> vs(n);
        auto rnd = [&]() { return (long long)(rng() % 2000000001ULL) - 1000000000LL; };
        for (auto& h : hs) { h.y = rnd(); h.x1 = rnd(); h.x2 = h.x1 + (long long)(rng() % 1000000000ULL); }
        for (auto& v : vs) { v.x = rnd(); v.y1 = rnd(); v.y2 = v.y1 + (long long)(rng() % 1000000000ULL); }
        long long e = brute(hs, vs);
        CHECK(e > 1000, "bộ dữ liệu phải có nhiều giao điểm (%lld)", e);
        CHECK(countHVIntersections(hs, vs) == e, "ca vừa: %lld", e);
    }
    // lưới 1000 x 1000
    {
        int n = 1000;
        vector<HSeg> hs(n);
        vector<VSeg> vs(n);
        for (int i = 0; i < n; i++) { hs[i] = {i, 0, n - 1}; vs[i] = {i, 0, n - 1}; }
        CHECK(countHVIntersections(hs, vs) == 1000000, "lưới 1000 x 1000");
    }
    // 200000 x 200000, mọi cặp cắt nhau
    {
        int n = 200000;
        vector<HSeg> hs(n);
        vector<VSeg> vs(n);
        for (int i = 0; i < n; i++) { hs[i] = {5000LL * i, 0, 1000000000LL}; vs[i] = {5000LL * i, 0, 1000000000LL}; }
        shuffle(hs.begin(), hs.end(), rng);
        CHECK(countHVIntersections(hs, vs) == 40000000000LL, "mọi cặp cắt nhau (4e10)");
    }
    puts("OK");
    return 0;
}
