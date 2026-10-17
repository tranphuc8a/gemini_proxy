// @TEMPLATE

// Thử knapsackBounded: (1) vét cạn số bản mỗi loại; (2) mở rộng thành vật 0/1 rồi chạy balô 0/1 thuần; (3) số bản rất lớn (1e9, 1e18).
static long long brute(const vector<int>& w, const vector<long long>& v, const vector<long long>& cnt, size_t i, int cap) {
    if (i == w.size()) return 0;
    long long best = LLONG_MIN;
    for (long long k = 0; k <= cnt[i] && k * w[i] <= cap; k++)
        best = max(best, brute(w, v, cnt, i + 1, cap - (int)(k * w[i])) + k * v[i]);
    return best;
}

static long long expanded01(const vector<int>& w, const vector<long long>& v, const vector<long long>& cnt, int W) {
    vector<long long> dp(W + 1, 0);
    for (size_t i = 0; i < w.size(); i++) {
        long long copies = cnt[i];
        if (w[i] > 0) copies = min(copies, (long long)W / w[i]);  // dùng hơn W / w bản là vô ích
        for (long long k = 0; k < copies; k++)
            for (int c = W; c >= w[i]; c--) dp[c] = max(dp[c], dp[c - w[i]] + v[i]);
    }
    return dp[W];
}

int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 4000; iter++) {
        int n = rng() % 6, W = rng() % 25;
        vector<int> w(n);
        vector<long long> v(n), cnt(n);
        for (int i = 0; i < n; i++) { w[i] = rng() % 8; v[i] = (long long)(rng() % 20) - 2; cnt[i] = rng() % 6; }  // có w = 0, cnt = 0, v âm
        long long expect = brute(w, v, cnt, 0, W);
        long long got = knapsackBounded(w, v, cnt, W);
        if (got != expect) { printf("SAI iter=%d: %lld != %lld\n", iter, got, expect); return 1; }
    }
    // trung bình: so với mở rộng 0/1
    for (int iter = 0; iter < 60; iter++) {
        int n = 1 + rng() % 12, W = rng() % 400;
        vector<int> w(n);
        vector<long long> v(n), cnt(n);
        for (int i = 0; i < n; i++) { w[i] = 1 + rng() % 40; v[i] = 1 + rng() % 1000; cnt[i] = rng() % 60; }
        long long expect = expanded01(w, v, cnt, W), got = knapsackBounded(w, v, cnt, W);
        if (got != expect) { printf("SAI trung bình iter=%d: %lld != %lld\n", iter, got, expect); return 1; }
    }
    // số bản khổng lồ: kết quả bằng balô với số bản bị chặn bởi W / w (mở rộng 0/1)
    for (int iter = 0; iter < 20; iter++) {
        int n = 1 + rng() % 8, W = 1 + rng() % 600;
        vector<int> w(n);
        vector<long long> v(n), cnt(n);
        for (int i = 0; i < n; i++) {
            w[i] = 1 + rng() % 100; v[i] = 1 + rng() % 1000000;
            cnt[i] = (rng() & 1) ? 1000000000LL : 1000000000000000000LL;
        }
        long long expect = expanded01(w, v, cnt, W), got = knapsackBounded(w, v, cnt, W);
        if (got != expect) { printf("SAI số bản lớn iter=%d: %lld != %lld\n", iter, got, expect); return 1; }
    }
    // w = 1, v = 1e9, 1e9 bản, W = 1e5 -> 1e14
    if (knapsackBounded({1}, {1000000000LL}, {1000000000LL}, 100000) != 100000LL * 1000000000LL) { puts("SAI ca lớn"); return 1; }
    // ca biên
    if (knapsackBounded({}, {}, {}, 0) != 0 || knapsackBounded({3}, {4}, {0}, 10) != 0 || knapsackBounded({3}, {4}, {2}, 5) != 4) { puts("SAI ca biên"); return 1; }
    // ví dụ trong thư viện (nếu không giới hạn số bản sẽ là 15)
    if (knapsackBounded({3, 5, 2}, {4, 7, 3}, {2, 1, 3}, 10) != 14) { puts("SAI ví dụ"); return 1; }
    puts("OK");
}
