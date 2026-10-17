// @TEMPLATE

// Thử LiChao với vét cạn: (1) miền nhỏ, hỏi mọi x sau mỗi lần thêm; (2) miền [-1e9, 1e9] với hệ số tới 1e9 / 1e18;
// (3) miền một điểm; (4) dp[i] = min_j dp[j] + (p_i - p_j)^2 + C so với O(n^2).
int main() {
    mt19937 rng(20261017);
    // (1) miền nhỏ [-30, 30]: sau mỗi lần thêm đường, kiểm mọi x
    for (int iter = 0; iter < 400; iter++) {
        long long lo = -(long long)(rng() % 30), hi = rng() % 30;
        LiChao t(lo, hi);
        vector<pair<long long, long long>> lines;
        if (t.query(lo) != LiChao::INF) { puts("SAI: chưa có đường nào phải trả INF"); return 1; }
        int m = 1 + rng() % 25;
        for (int i = 0; i < m; i++) {
            long long k = (long long)(rng() % 21) - 10, b = (long long)(rng() % 101) - 50;  // có hệ số góc trùng, đường trùng
            lines.push_back({k, b});
            t.addLine(k, b);
            for (long long x = lo; x <= hi; x++) {
                long long best = LLONG_MAX;
                for (auto& l : lines) best = min(best, l.first * x + l.second);
                if (t.query(x) != best) { printf("SAI iter=%d x=%lld sau %d đường: %lld != %lld\n", iter, x, i + 1, t.query(x), best); return 1; }
            }
        }
    }
    // (2) miền lớn: |k| <= 1e9, |x| <= 1e9, |b| <= 1e18 -> |k*x + b| <= 2e18 < 9.2e18
    {
        long long lo = -1000000000LL, hi = 1000000000LL;
        LiChao t(lo, hi);
        vector<pair<long long, long long>> lines;
        for (int i = 0; i < 2000; i++) {
            long long k = (long long)(rng() % 2000000001ULL) - 1000000000LL;
            long long b = (long long)((((unsigned long long)rng() << 32) | rng()) % 2000000000000000001ULL) - 1000000000000000000LL;
            lines.push_back({k, b});
            t.addLine(k, b);
            if (i % 50 == 0 || i == 1999)
                for (int q = 0; q < 30; q++) {
                    long long x = q == 0 ? lo : (q == 1 ? hi : (long long)(rng() % 2000000001ULL) - 1000000000LL);
                    long long best = LLONG_MAX;
                    for (auto& l : lines) best = min(best, l.first * x + l.second);
                    if (t.query(x) != best) { printf("SAI miền lớn i=%d x=%lld\n", i, x); return 1; }
                }
        }
    }
    // (3) miền một điểm
    {
        LiChao t(5, 5);
        t.addLine(3, 1);
        t.addLine(-2, 20);
        t.addLine(0, 17);
        if (t.query(5) != 10) { puts("SAI miền một điểm"); return 1; }
    }
    // ví dụ trong thư viện
    {
        LiChao t(0, 10);
        t.addLine(2, 3);
        t.addLine(-1, 8);
        t.addLine(0, 5);
        if (t.query(0) != 3 || t.query(2) != 5 || t.query(5) != 3 || t.query(10) != -2) { puts("SAI ví dụ"); return 1; }
    }
    // (4) dp[i] = min_{j<i} dp[j] + (p_i - p_j)^2 + C (p tăng): đường thẳng k = -2p_j, b = dp[j] + p_j^2, hỏi tại x = p_i
    for (int iter = 0; iter < 5; iter++) {
        int n = 2000;
        long long C = rng() % 1000000;
        vector<long long> p(n);
        long long cur = 0;
        for (int i = 0; i < n; i++) { cur += 1 + rng() % 1000; p[i] = cur; }
        vector<long long> dp(n, 0), ref(n, 0);
        for (int i = 1; i < n; i++) {
            ref[i] = LLONG_MAX;
            for (int j = 0; j < i; j++) ref[i] = min(ref[i], ref[j] + (p[i] - p[j]) * (p[i] - p[j]) + C);
        }
        LiChao t(0, p[n - 1]);
        t.addLine(-2 * p[0], dp[0] + p[0] * p[0]);
        for (int i = 1; i < n; i++) {
            dp[i] = t.query(p[i]) + p[i] * p[i] + C;
            t.addLine(-2 * p[i], dp[i] + p[i] * p[i]);
        }
        if (dp != ref) { puts("SAI dp tối ưu bằng Li Chao"); return 1; }
    }
    puts("OK");
}
