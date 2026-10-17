// @TEMPLATE

// Thử SegTree với CTAD C++17: tổng, min (đơn vị LLONG_MAX), và phép KHÔNG giao hoán (nối xâu, hợp hàm bậc nhất mod p)
// với n bất kỳ (không chỉ luỹ thừa 2), đoạn rỗng, n = 0, n = 1; so với vét cạn. Ca lớn so với prefix sum.
int main() {
    mt19937_64 rng(20261017);
    for (int iter = 0; iter < 3000; iter++) {
        int n = rng() % 20;
        vector<long long> a(n);
        for (auto& x : a) x = (long long)(rng() % 2001) - 1000;
        SegTree sum(a, 0LL, [](long long x, long long y) { return x + y; });
        SegTree mn(a, LLONG_MAX, [](long long x, long long y) { return min(x, y); });
        for (int step = 0; step < 40; step++) {
            if (n > 0 && rng() % 2) {
                int i = rng() % n;
                long long v = (long long)(rng() % 2001) - 1000;
                a[i] = v;
                sum.set(i, v);
                mn.set(i, v);
                if (sum.get(i) != v) { puts("SAI get"); return 1; }
            }
            int l = rng() % (n + 1), r = rng() % (n + 1);
            if (l > r) swap(l, r);
            long long ws = 0, wm = LLONG_MAX;
            for (int i = l; i < r; i++) { ws += a[i]; wm = min(wm, a[i]); }
            if (sum.query(l, r) != ws || mn.query(l, r) != wm) { printf("SAI tổng / min iter=%d [%d,%d)\n", iter, l, r); return 1; }
        }
    }
    // phép không giao hoán 1: nối xâu
    for (int iter = 0; iter < 3000; iter++) {
        int n = 1 + rng() % 23;
        vector<string> a(n);
        for (auto& s : a) s = string(1, (char)('a' + rng() % 26));
        SegTree cat(a, string(), [](const string& x, const string& y) { return x + y; });
        for (int step = 0; step < 30; step++) {
            if (rng() % 3 == 0) {
                int i = rng() % n;
                a[i] = string(1, (char)('a' + rng() % 26));
                cat.set(i, a[i]);
            }
            int l = rng() % (n + 1), r = rng() % (n + 1);
            if (l > r) swap(l, r);
            string want;
            for (int i = l; i < r; i++) want += a[i];
            if (cat.query(l, r) != want) { printf("SAI nối xâu iter=%d n=%d [%d,%d)\n", iter, n, l, r); return 1; }
        }
    }
    // phép không giao hoán 2: hợp hàm bậc nhất f(x) = (p * x + q) mod M, thứ tự áp dụng từ trái sang phải
    typedef pair<long long, long long> Lin;
    const long long M = 998244353;
    auto compose = [&](const Lin& f, const Lin& g) { return Lin(g.first * f.first % M, (g.first * f.second + g.second) % M); };   // g(f(x))
    for (int iter = 0; iter < 1500; iter++) {
        int n = 1 + rng() % 25;
        vector<Lin> a(n);
        for (auto& f : a) f = Lin(rng() % M, rng() % M);
        SegTree seg(a, Lin(1, 0), compose);
        int l = rng() % (n + 1), r = rng() % (n + 1);
        if (l > r) swap(l, r);
        Lin want(1, 0);
        for (int i = l; i < r; i++) want = compose(want, a[i]);
        if (seg.query(l, r) != want) { printf("SAI hợp hàm iter=%d n=%d [%d,%d)\n", iter, n, l, r); return 1; }
    }
    // ca lớn: 2*10^5 phần tử, cập nhật + truy vấn so với prefix sum dựng lại định kỳ
    int n = 200000;
    vector<long long> a(n);
    for (auto& x : a) x = (long long)(rng() % 2000000001ULL) - 1000000000LL;
    SegTree sum(a, 0LL, [](long long x, long long y) { return x + y; });
    SegTree mn(a, LLONG_MAX, [](long long x, long long y) { return min(x, y); });
    for (int step = 0; step < 300000; step++) {
        int i = rng() % n;
        long long v = (long long)(rng() % 2000000001ULL) - 1000000000LL;
        a[i] = v;
        sum.set(i, v);
        mn.set(i, v);
        if (step % 500 == 0) {
            int l = rng() % n, r = min(n, l + 1 + (int)(rng() % 3000));
            long long ws = 0, wm = LLONG_MAX;
            for (int j = l; j < r; j++) { ws += a[j]; wm = min(wm, a[j]); }
            if (sum.query(l, r) != ws || mn.query(l, r) != wm) { puts("SAI ca lớn"); return 1; }
        }
    }
    if (sum.query(0, n) != accumulate(a.begin(), a.end(), 0LL)) { puts("SAI tổng toàn mảng"); return 1; }
    puts("OK");
}
