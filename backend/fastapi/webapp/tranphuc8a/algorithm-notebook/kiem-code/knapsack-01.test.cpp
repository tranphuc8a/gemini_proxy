// @TEMPLATE

// Thử knapsack01 với vét cạn mọi tập con (n <= 12; có w = 0, w > W, v âm), kiểm tập vật dựng lại, và với bảng 2 chiều ở ca lớn (giá trị 1e12).
int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 4000; iter++) {
        int n = rng() % 13, W = rng() % 25;
        vector<int> w(n);
        vector<long long> v(n);
        for (int i = 0; i < n; i++) { w[i] = rng() % 12; v[i] = (long long)(rng() % 26) - 5; }
        long long best = 0;
        for (int mask = 0; mask < (1 << n); mask++) {
            long long sw = 0, sv = 0;
            for (int i = 0; i < n; i++) if ((mask >> i) & 1) { sw += w[i]; sv += v[i]; }
            if (sw <= W) best = max(best, sv);
        }
        vector<int> chosen;
        long long got = knapsack01(w, v, W, &chosen);
        if (got != best || knapsack01(w, v, W) != best) { printf("SAI iter=%d: %lld != %lld\n", iter, got, best); return 1; }
        long long sw = 0, sv = 0;
        int prev = -1;
        for (int i : chosen) {
            if (i <= prev || i >= n) { puts("SAI chỉ số vật chọn"); return 1; }
            prev = i; sw += w[i]; sv += v[i];
        }
        if (sw > W || sv != best) { printf("SAI tập chọn iter=%d (sw=%lld sv=%lld best=%lld)\n", iter, sw, sv, best); return 1; }
    }
    // ca biên: không có vật, sức chứa 0
    if (knapsack01({}, {}, 0) != 0 || knapsack01({}, {}, 100) != 0) { puts("SAI ca rỗng"); return 1; }
    if (knapsack01({5}, {7}, 4) != 0 || knapsack01({5}, {7}, 5) != 7) { puts("SAI một vật"); return 1; }
    // ca lớn: giá trị 1e12, so với bảng 2 chiều tự viết
    int n = 200, W = 5000;
    vector<int> w(n);
    vector<long long> v(n);
    for (int i = 0; i < n; i++) { w[i] = 1 + rng() % 200; v[i] = 1 + rng() % 1000000000000LL; }
    vector<vector<long long>> t(n + 1, vector<long long>(W + 1, 0));
    for (int i = 1; i <= n; i++)
        for (int c = 0; c <= W; c++) {
            t[i][c] = t[i - 1][c];
            if (c >= w[i - 1]) t[i][c] = max(t[i][c], t[i - 1][c - w[i - 1]] + v[i - 1]);
        }
    vector<int> chosen;
    long long got = knapsack01(w, v, W, &chosen);
    if (got != t[n][W]) { printf("SAI ca lớn %lld != %lld\n", got, t[n][W]); return 1; }
    long long sw = 0, sv = 0;
    for (int i : chosen) { sw += w[i]; sv += v[i]; }
    if (sw > W || sv != got) { puts("SAI tập chọn ca lớn"); return 1; }
    // ví dụ trong thư viện
    if (knapsack01({3, 4, 2, 5}, {4, 5, 3, 8}, 7) != 11) { puts("SAI ví dụ"); return 1; }
    puts("OK");
}
