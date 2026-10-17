// @TEMPLATE

// Thử Fenwick (add / prefix / sum / dựng O(N) / lowerBound) và RangeFenwick (cộng đoạn, tổng đoạn) với mảng thường vét cạn:
// n = 0, n = 1, n không phải luỹ thừa 2, giá trị âm và lớn (tổng vượt int32). lowerBound kiểm với quét tuyến tính (giá trị không âm, có số 0).
int main() {
    mt19937_64 rng(20261017);
    for (int iter = 0; iter < 3000; iter++) {
        int n = rng() % 20;
        long long range = iter % 3 == 0 ? 1000000000000LL : 20;
        vector<long long> a(n);
        for (auto& x : a) x = (long long)(rng() % (2 * range + 1)) - range;
        Fenwick fw = (iter % 2) ? Fenwick(a) : Fenwick(n);
        if (!(iter % 2)) for (int i = 0; i < n; i++) fw.add(i, a[i]);
        for (int step = 0; step < 40 && n > 0; step++) {
            int i = rng() % n;
            long long v = (long long)(rng() % (2 * range + 1)) - range;
            fw.add(i, v);
            a[i] += v;
        }
        for (int l = 0; l <= n; l++) {
            long long pre = 0;
            for (int i = 0; i < l; i++) pre += a[i];
            if (fw.prefix(l) != pre) { printf("SAI prefix iter=%d l=%d\n", iter, l); return 1; }
            for (int r = l; r <= n; r++) {
                long long s = 0;
                for (int i = l; i < r; i++) s += a[i];
                if (fw.sum(l, r) != s) { printf("SAI sum iter=%d [%d,%d)\n", iter, l, r); return 1; }
            }
        }
    }
    // lowerBound: giá trị không âm (có 0), mọi x từ 1 tới tổng + 1
    for (int iter = 0; iter < 3000; iter++) {
        int n = rng() % 20;
        vector<long long> a(n);
        for (auto& x : a) x = rng() % 4;
        Fenwick fw(a);
        long long total = accumulate(a.begin(), a.end(), 0LL);
        for (long long x = 1; x <= total + 1; x++) {
            int want = n;
            long long s = 0;
            for (int i = 0; i < n; i++) { s += a[i]; if (s >= x) { want = i; break; } }
            if (fw.lowerBound(x) != want) { printf("SAI lowerBound iter=%d x=%lld: %d != %d\n", iter, x, fw.lowerBound(x), want); return 1; }
        }
    }
    // RangeFenwick
    for (int iter = 0; iter < 3000; iter++) {
        int n = rng() % 16;
        RangeFenwick rf(n);
        vector<long long> a(n, 0);
        for (int step = 0; step < 30; step++) {
            int l = rng() % (n + 1), r = rng() % (n + 1);
            if (l > r) swap(l, r);
            if (rng() % 2) {
                long long v = (long long)(rng() % 2001) - 1000;
                if (iter % 4 == 0) v *= 1000000000LL;
                rf.add(l, r, v);
                for (int i = l; i < r; i++) a[i] += v;
            } else {
                long long s = 0;
                for (int i = l; i < r; i++) s += a[i];
                if (rf.sum(l, r) != s) { printf("SAI RangeFenwick iter=%d\n", iter); return 1; }
            }
        }
        long long s = accumulate(a.begin(), a.end(), 0LL);
        if (rf.sum(0, n) != s) { puts("SAI RangeFenwick tổng"); return 1; }
    }
    // ca lớn: 2*10^5 phần tử, 4*10^5 thao tác, so với mảng hiệu cập nhật vét cạn trên đoạn ngắn
    int n = 200000;
    Fenwick fw(n);
    vector<long long> a(n, 0);
    for (int step = 0; step < 400000; step++) {
        int i = rng() % n;
        long long v = (long long)(rng() % 2000000001ULL) - 1000000000LL;
        fw.add(i, v);
        a[i] += v;
        if (step % 1000 == 0) {
            int l = rng() % n, r = min(n, l + (int)(rng() % 3000));
            long long s = 0;
            for (int j = l; j < r; j++) s += a[j];
            if (fw.sum(l, r) != s) { puts("SAI ca lớn"); return 1; }
        }
    }
    puts("OK");
}
