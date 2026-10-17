// @TEMPLATE

// Thử tspBitmask với vét cạn mọi hoán vị (n <= 9; ma trận bất đối xứng, có cạnh không tồn tại, chi phí cỡ 1e12); kiểm tour trả về.
static long long tourCost(const vector<vector<long long>>& d, const vector<int>& tour) {
    long long sum = 0;
    for (size_t i = 0; i < tour.size(); i++) {
        long long w = d[tour[i]][tour[(i + 1) % tour.size()]];
        if (w >= TSP_INF) return TSP_INF;
        sum += w;
    }
    return sum;
}

int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 600; iter++) {
        int n = 1 + rng() % 9;
        long long scale = (iter % 3 == 0) ? 1000000000000LL : 10;
        vector<vector<long long>> d(n, vector<long long>(n, 0));
        for (int i = 0; i < n; i++)
            for (int j = 0; j < n; j++)
                if (i != j) d[i][j] = (iter % 4 == 1 && rng() % 100 < 35) ? TSP_INF : (long long)(rng() % 10 + 1) * scale / 10;
        // vét cạn mọi hoán vị của 1..n-1 (thành phố 0 cố định)
        vector<int> perm(n);
        iota(perm.begin(), perm.end(), 0);
        long long best = TSP_INF;
        do {
            long long c = tourCost(d, perm);
            if (n == 1) c = 0;
            best = min(best, c);
        } while (next_permutation(perm.begin() + 1, perm.end()));
        vector<int> tour;
        long long got = tspBitmask(d, &tour);
        if (got != best || tspBitmask(d) != best) { printf("SAI iter=%d n=%d: %lld != %lld\n", iter, n, got, best); return 1; }
        if (best < TSP_INF) {
            vector<int> sorted = tour;
            sort(sorted.begin(), sorted.end());
            vector<int> ident(n);
            iota(ident.begin(), ident.end(), 0);
            if (tour.empty() || tour[0] != 0 || sorted != ident || (n > 1 && tourCost(d, tour) != best)) { printf("SAI tour iter=%d n=%d\n", iter, n); return 1; }
        }
    }
    // ca biên: n = 0, 1, 2 (có và không có đường về)
    {
        vector<int> t;
        vector<vector<long long>> zero, one(1, vector<long long>(1, 0)), two = {{0, 3}, {4, 0}}, noBack = {{0, 3}, {TSP_INF, 0}};
        if (tspBitmask(zero, &t) != 0 || !t.empty()) { puts("SAI n = 0"); return 1; }
        if (tspBitmask(one, &t) != 0 || t != vector<int>({0})) { puts("SAI n = 1"); return 1; }
        if (tspBitmask(two, &t) != 7 || t != vector<int>({0, 1})) { puts("SAI n = 2"); return 1; }
        if (tspBitmask(noBack, &t) != TSP_INF) { puts("SAI n = 2 không có đường về"); return 1; }
    }
    // ví dụ trong thư viện
    {
        vector<vector<long long>> d = {{0, 10, 15, 20}, {10, 0, 35, 25}, {15, 35, 0, 30}, {20, 25, 30, 0}};
        vector<int> t;
        if (tspBitmask(d, &t) != 80 || t != vector<int>({0, 2, 3, 1})) { puts("SAI ví dụ"); for (int x : t) printf("%d ", x); puts(""); return 1; }
    }
    // ca lớn hơn: n = 18, kiểm tour và chi phí khớp nhau (cận dưới: tổng cạnh vào nhỏ nhất của từng thành phố)
    {
        int n = 18;
        vector<vector<long long>> d(n, vector<long long>(n, 0));
        for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) if (i != j) d[i][j] = 1 + rng() % 1000000;
        vector<int> tour;
        long long got = tspBitmask(d, &tour);
        long long lower = 0;
        for (int j = 0; j < n; j++) {
            long long m = TSP_INF;
            for (int i = 0; i < n; i++) if (i != j) m = min(m, d[i][j]);
            lower += m;
        }
        if (got < lower || tourCost(d, tour) != got || (int)tour.size() != n) { puts("SAI n = 18"); return 1; }
    }
    puts("OK");
}
