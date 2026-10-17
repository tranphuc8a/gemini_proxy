// @TEMPLATE

// Thử LazySegTree (add / assign / sum / minimum) với mảng thường vét cạn: n = 0, n = 1, n không phải luỹ thừa 2, đoạn rỗng,
// giá trị gán 0 xen với cộng (kiểm cờ hasSet), giá trị âm và lớn. Ca lớn kiểm bằng tổng tích luỹ và thời gian.
int main() {
    mt19937_64 rng(20261017);
    for (int iter = 0; iter < 4000; iter++) {
        int n = rng() % 20;
        vector<long long> a(n);
        long long range = iter % 3 == 0 ? 1000000000LL : 10;
        for (auto& x : a) x = (long long)(rng() % (2 * range + 1)) - range;
        LazySegTree st(a);
        for (int step = 0; step < 60; step++) {
            int l = rng() % (n + 1), r = rng() % (n + 1);
            if (l > r) swap(l, r);
            int op = rng() % 5;
            long long v = (long long)(rng() % (2 * range + 1)) - range;
            if (op == 4) v = 0;                                          // gán 0 là giá trị hợp lệ
            if (op == 0 || op == 1) {
                st.add(l, r, v);
                for (int i = l; i < r; i++) a[i] += v;
            } else if (op == 2 || op == 4) {
                st.assign(l, r, v);
                for (int i = l; i < r; i++) a[i] = v;
            }
            int ql = rng() % (n + 1), qr = rng() % (n + 1);
            if (ql > qr) swap(ql, qr);
            long long ws = 0, wm = LLONG_MAX;
            for (int i = ql; i < qr; i++) { ws += a[i]; wm = min(wm, a[i]); }
            if (st.sum(ql, qr) != ws) { printf("SAI sum iter=%d step=%d [%d,%d)\n", iter, step, ql, qr); return 1; }
            if (st.minimum(ql, qr) != wm) { printf("SAI min iter=%d step=%d [%d,%d)\n", iter, step, ql, qr); return 1; }
        }
        for (int i = 0; i < n; i++)
            if (st.sum(i, i + 1) != a[i]) { printf("SAI phần tử iter=%d i=%d\n", iter, i); return 1; }
    }
    // ca lớn: chỉ cộng đoạn, tổng toàn mảng phải bằng tổng ban đầu + tổng (v * độ dài)
    int n = 200000;
    vector<long long> a(n);
    for (auto& x : a) x = (long long)(rng() % 2000000001ULL) - 1000000000LL;
    LazySegTree st(a);
    long long total = accumulate(a.begin(), a.end(), 0LL);
    for (int q = 0; q < 200000; q++) {
        int l = rng() % (n + 1), r = rng() % (n + 1);
        if (l > r) swap(l, r);
        long long v = (long long)(rng() % 2000001ULL) - 1000000LL;
        if (q % 2) { st.add(l, r, v); total += v * (r - l); }
        else {
            st.minimum(l, r);                                            // chỉ để chạy thêm truy vấn xen kẽ
            if (q % 1000 == 0 && st.sum(0, n) != total) { puts("SAI tổng giữa chừng"); return 1; }
        }
    }
    if (st.sum(0, n) != total) { puts("SAI ca lớn"); return 1; }
    st.assign(0, n, 7);
    if (st.sum(0, n) != 7LL * n || st.minimum(0, n) != 7) { puts("SAI gán toàn mảng"); return 1; }
    st.add(10, 20, -100);
    if (st.minimum(0, n) != -93 || st.sum(0, n) != 7LL * n - 1000) { puts("SAI cộng sau gán"); return 1; }
    puts("OK");
}
