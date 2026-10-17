// @TEMPLATE

// Thử Hungarian: (1) so với vét cạn mọi phép gán đơn ánh hàng -> cột (n <= m <= 8), chi phí có thể ÂM, hàng bằng nhau, n == 0 và n == 1;
// (2) phép gán trả về phải là đơn ánh có tổng đúng bằng chi phí; (3) ma trận lớn có sẵn hoán vị chi phí 0, mọi ô khác >= 1 -> đáp án 0;
// (4) toàn ô 1e9 -> n * 1e9 vượt int32.
static bool kiem_gan(const vector<vector<long long>>& a, const vector<int>& as, long long cost, const char* ctx) {
    int n = a.size(), m = n ? a[0].size() : 0;
    if ((int)as.size() != n) { printf("SAI %s: assign sai kích thước\n", ctx); return false; }
    vector<char> used(m, 0);
    long long sum = 0;
    for (int i = 0; i < n; i++) {
        if (as[i] < 0 || as[i] >= m || used[as[i]]) { printf("SAI %s: phép gán không đơn ánh\n", ctx); return false; }
        used[as[i]] = 1;
        sum += a[i][as[i]];
    }
    if (sum != cost) { printf("SAI %s: tổng phép gán %lld khác chi phí trả về %lld\n", ctx, sum, cost); return false; }
    return true;
}

int main() {
    mt19937_64 rng(20261022);
    for (int iter = 0; iter < 3000; iter++) {
        int n = rng() % 8, m = n + rng() % (9 - n);
        if (n == 0) m = rng() % 3;
        vector<vector<long long>> a(n, vector<long long>(m));
        long long lo = (iter % 2) ? -20 : 0;
        for (auto& row : a) for (auto& x : row) x = lo + (long long)(rng() % 41);
        if (iter % 7 == 0 && n >= 2) a[1] = a[0];                    // hai hàng giống hệt
        // vét cạn: dp[mask] = chi phí nhỏ nhất khi các hàng 0..i-1 đã dùng tập cột mask
        vector<long long> dp(1 << m, LLONG_MAX);
        dp[0] = 0;
        for (int i = 0; i < n; i++) {
            vector<long long> nd(1 << m, LLONG_MAX);
            for (int mask = 0; mask < (1 << m); mask++) {
                if (dp[mask] == LLONG_MAX || __builtin_popcount(mask) != i) continue;
                for (int j = 0; j < m; j++) if (!((mask >> j) & 1)) nd[mask | (1 << j)] = min(nd[mask | (1 << j)], dp[mask] + a[i][j]);
            }
            dp = nd;
        }
        long long best = LLONG_MAX;
        for (int mask = 0; mask < (1 << m); mask++) if (__builtin_popcount(mask) == n) best = min(best, dp[mask]);
        if (n == 0) best = 0;
        vector<int> as;
        long long got = hungarian(a, &as);
        if (got != best) { printf("SAI iter=%d n=%d m=%d: %lld thay vì %lld\n", iter, n, m, got, best); return 1; }
        if (!kiem_gan(a, as, got, "nhỏ")) return 1;
        if (hungarian(a) != best) { puts("SAI khi không truyền assign"); return 1; }
    }
    // ma trận lớn: hoán vị chi phí 0, mọi ô khác trong [1, 1e9]
    {
        int n = 400;
        vector<vector<long long>> a(n, vector<long long>(n));
        vector<int> perm(n);
        iota(perm.begin(), perm.end(), 0);
        shuffle(perm.begin(), perm.end(), rng);
        for (int i = 0; i < n; i++)
            for (int j = 0; j < n; j++) a[i][j] = j == perm[i] ? 0 : 1 + (long long)(rng() % 1000000000LL);
        vector<int> as;
        long long got = hungarian(a, &as);
        if (got != 0) { printf("SAI ma trận lớn: %lld thay vì 0\n", got); return 1; }
        for (int i = 0; i < n; i++) if (as[i] != perm[i]) { puts("SAI phép gán lớn không phải hoán vị chi phí 0"); return 1; }
    }
    // chữ nhật lớn: n = 200, m = 300, đáp án >= 0 và phép gán hợp lệ
    {
        int n = 200, m = 300;
        vector<vector<long long>> a(n, vector<long long>(m));
        for (auto& row : a) for (auto& x : row) x = (long long)(rng() % 1000000000LL);
        vector<int> as;
        long long got = hungarian(a, &as);
        if (!kiem_gan(a, as, got, "chữ nhật")) return 1;
    }
    // toàn 1e9: tổng vượt int32
    {
        int n = 300;
        vector<vector<long long>> a(n, vector<long long>(n, 1000000000LL));
        if (hungarian(a) != 300LL * 1000000000LL) { puts("SAI toàn 1e9"); return 1; }
    }
    puts("OK");
    return 0;
}
