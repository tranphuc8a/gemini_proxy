// @TEMPLATE

// Thử SparseTable (min, max, gcd, and) với vét cạn trên MỌI đoạn không rỗng của mảng ngẫu nhiên (n = 1, n luỹ thừa 2 và không phải luỹ thừa 2);
// ca lớn: 2*10^5 phần tử, 3000 truy vấn so với vét cạn. Phép chọn cặp (giá trị, chỉ số) để lấy vị trí min.
int main() {
    mt19937_64 rng(20261017);
    for (int iter = 0; iter < 2000; iter++) {
        int n = 1 + rng() % 40;
        vector<long long> a(n);
        long long range = iter % 3 == 0 ? 3 : 1000000000000000LL;
        for (auto& x : a) x = (long long)(rng() % (range + 1)) + 1;
        SparseTable mn(a, [](long long x, long long y) { return min(x, y); });
        SparseTable mx(a, [](long long x, long long y) { return max(x, y); });
        SparseTable gc(a, [](long long x, long long y) { return __gcd(x, y); });
        SparseTable an(a, [](long long x, long long y) { return x & y; });
        vector<pair<long long, int>> p(n);
        for (int i = 0; i < n; i++) p[i] = {a[i], i};
        SparseTable am(p, [](const pair<long long, int>& x, const pair<long long, int>& y) { return min(x, y); });
        for (int l = 0; l < n; l++)
            for (int r = l + 1; r <= n; r++) {
                long long wmn = a[l], wmx = a[l], wg = 0, wa = a[l];
                for (int i = l; i < r; i++) { wmn = min(wmn, a[i]); wmx = max(wmx, a[i]); wg = __gcd(wg, a[i]); wa &= a[i]; }
                int wi = min_element(a.begin() + l, a.begin() + r) - a.begin();
                if (mn.query(l, r) != wmn || mx.query(l, r) != wmx || gc.query(l, r) != wg || an.query(l, r) != wa) {
                    printf("SAI iter=%d n=%d [%d,%d)\n", iter, n, l, r);
                    return 1;
                }
                if (am.query(l, r).first != wmn || a[am.query(l, r).second] != wmn || am.query(l, r).second != wi) {
                    printf("SAI vị trí min iter=%d [%d,%d)\n", iter, l, r);
                    return 1;
                }
            }
    }
    // ca lớn
    int n = 200000;
    vector<int> a(n);
    for (auto& x : a) x = (int)(rng() % 1000000000ULL);
    SparseTable mn(a, [](int x, int y) { return min(x, y); });
    for (int q = 0; q < 3000; q++) {
        int l = rng() % n, r = l + 1 + rng() % (n - l);
        if (mn.query(l, r) != *min_element(a.begin() + l, a.begin() + r)) { puts("SAI ca lớn"); return 1; }
    }
    if (mn.query(0, n) != *min_element(a.begin(), a.end())) { puts("SAI toàn mảng"); return 1; }
    puts("OK");
}
