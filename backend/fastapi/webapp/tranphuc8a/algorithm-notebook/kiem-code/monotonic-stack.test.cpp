// @TEMPLATE

// Thử nearestRight / nearestLeft (cả less<> và greater<>) và largestRectangle với cách vét cạn O(N^2):
// mảng ngẫu nhiên có nhiều giá trị bằng nhau, mảng rỗng, một phần tử, tăng dần / giảm dần / hằng, giá trị lớn.
int main() {
    mt19937_64 rng(20261017);
    for (int iter = 0; iter < 4000; iter++) {
        int n = rng() % 14;
        long long range = iter % 4 == 0 ? 3 : (iter % 4 == 1 ? 10 : (iter % 4 == 2 ? 1000000000LL : 1));
        vector<long long> a(n);
        for (auto& x : a) x = (long long)(rng() % (range + 1));
        if (iter % 7 == 0) sort(a.begin(), a.end());
        if (iter % 11 == 0) sort(a.rbegin(), a.rend());
        auto ng = nearestRight(a, less<>()), ns = nearestRight(a, greater<>());
        auto pg = nearestLeft(a, less<>()), ps = nearestLeft(a, greater<>());
        for (int i = 0; i < n; i++) {
            int wng = n, wns = n, wpg = -1, wps = -1;
            for (int j = i + 1; j < n; j++) if (a[j] > a[i]) { wng = j; break; }
            for (int j = i + 1; j < n; j++) if (a[j] < a[i]) { wns = j; break; }
            for (int j = i - 1; j >= 0; j--) if (a[j] >= a[i]) { wpg = j; break; }
            for (int j = i - 1; j >= 0; j--) if (a[j] <= a[i]) { wps = j; break; }
            if (ng[i] != wng || ns[i] != wns || pg[i] != wpg || ps[i] != wps) {
                printf("SAI gần nhất iter=%d i=%d: %d/%d %d/%d %d/%d %d/%d\n", iter, i, ng[i], wng, ns[i], wns, pg[i], wpg, ps[i], wps);
                return 1;
            }
        }
        long long best = 0;
        for (int l = 0; l < n; l++) {
            long long mn = LLONG_MAX;
            for (int r = l; r < n; r++) {
                mn = min(mn, a[r]);
                best = max(best, mn * (r - l + 1));
            }
        }
        if (largestRectangle(a) != best) { printf("SAI histogram iter=%d: %lld != %lld\n", iter, largestRectangle(a), best); return 1; }
    }
    if (largestRectangle({}) != 0 || largestRectangle({7}) != 7 || largestRectangle({2, 1, 5, 6, 2, 3}) != 10) { puts("SAI ca biên histogram"); return 1; }
    // ca lớn: 3 * 10^5 cột cao 10^9 -> diện tích 3 * 10^14 (vượt int32), và một mảng giảm dần dài
    int n = 300000;
    vector<long long> h(n, 1000000000LL);
    if (largestRectangle(h) != 1000000000LL * n) { puts("SAI ca lớn hằng"); return 1; }
    for (int i = 0; i < n; i++) h[i] = n - i;
    auto nx = nearestRight(h, less<>());
    for (int i = 0; i < n; i++) if (nx[i] != n) { puts("SAI giảm dần"); return 1; }
    long long want = 0;
    for (int i = 0; i < n; i++) want = max(want, (long long)(n - i) * (i + 1));
    if (largestRectangle(h) != want) { puts("SAI histogram giảm dần"); return 1; }
    puts("OK");
}
