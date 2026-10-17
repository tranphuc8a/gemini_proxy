// @TEMPLATE

// Thử SqrtDecomp (add / sum / countGE) với mảng thường vét cạn: n = 0, n = 1, n không chia hết cho kích thước khối,
// đoạn nằm trọn trong một khối, đoạn rỗng, cộng âm, x âm / lớn. Ca lớn: 2*10^4 phần tử và 2*10^4 thao tác.
int main() {
    mt19937_64 rng(20261017);
    for (int iter = 0; iter < 3000; iter++) {
        int n = rng() % 45;
        long long range = iter % 3 == 0 ? 1000000000LL : 10;
        vector<long long> a(n);
        for (auto& x : a) x = (long long)(rng() % (2 * range + 1)) - range;
        SqrtDecomp sd(a);
        for (int step = 0; step < 60; step++) {
            int l = rng() % (n + 1), r = rng() % (n + 1);
            if (l > r) swap(l, r);
            int op = rng() % 3;
            if (op == 0) {
                long long v = (long long)(rng() % (2 * range + 1)) - range;
                sd.add(l, r, v);
                for (int i = l; i < r; i++) a[i] += v;
            } else if (op == 1) {
                long long s = 0;
                for (int i = l; i < r; i++) s += a[i];
                if (sd.sum(l, r) != s) { printf("SAI sum iter=%d [%d,%d)\n", iter, l, r); return 1; }
            } else {
                long long x = (long long)(rng() % (4 * range + 1)) - 2 * range;
                int c = 0;
                for (int i = l; i < r; i++) c += a[i] >= x;
                if (sd.countGE(l, r, x) != c) { printf("SAI countGE iter=%d [%d,%d) x=%lld\n", iter, l, r, x); return 1; }
            }
        }
        for (int i = 0; i < n; i++)
            if (sd.sum(i, i + 1) != a[i]) { printf("SAI phần tử iter=%d i=%d\n", iter, i); return 1; }
    }
    // ca lớn
    int n = 20000;
    vector<long long> a(n);
    for (auto& x : a) x = (long long)(rng() % 2000001ULL) - 1000000LL;
    SqrtDecomp sd(a);
    for (int q = 0; q < 20000; q++) {
        int l = rng() % (n + 1), r = rng() % (n + 1);
        if (l > r) swap(l, r);
        int op = rng() % 3;
        if (op == 0) {
            long long v = (long long)(rng() % 2000001ULL) - 1000000LL;
            sd.add(l, r, v);
            for (int i = l; i < r; i++) a[i] += v;
        } else if (op == 1) {
            long long s = 0;
            for (int i = l; i < r; i++) s += a[i];
            if (sd.sum(l, r) != s) { puts("SAI sum ca lớn"); return 1; }
        } else {
            long long x = (long long)(rng() % 20000001ULL) - 10000000LL;
            int c = 0;
            for (int i = l; i < r; i++) c += a[i] >= x;
            if (sd.countGE(l, r, x) != c) { puts("SAI countGE ca lớn"); return 1; }
        }
    }
    puts("OK");
}
