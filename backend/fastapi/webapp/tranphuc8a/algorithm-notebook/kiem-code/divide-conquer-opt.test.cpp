// @TEMPLATE

// Thử divideConquerDP với DP O(K n^2) trên ba hàm chi phí thoả bất đẳng thức tứ giác (bình phương tổng đoạn với phần tử >= 0,
// bình phương độ dài, và tổng hai loại); ca biên K = 1, K = n; ca lớn so với O(K n^2) và chạy nhanh với n = 50000.
static long long referenceDP(int n, int K, const function<long long(int, int)>& cost) {
    const long long INF = (long long)4e18;
    vector<long long> prev(n + 1, INF), cur(n + 1, INF);
    prev[0] = 0;
    for (int g = 1; g <= K; g++) {
        fill(cur.begin(), cur.end(), INF);
        for (int i = g; i <= n; i++)
            for (int j = g - 1; j < i; j++)
                if (prev[j] < INF) cur[i] = min(cur[i], prev[j] + cost(j, i));
        swap(prev, cur);
    }
    return prev[n];
}

int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 3000; iter++) {
        int n = 1 + rng() % 30, K = 1 + rng() % n;
        vector<long long> P(n + 1, 0);
        for (int i = 1; i <= n; i++) P[i] = P[i - 1] + rng() % 50;  // phần tử >= 0 (có thể bằng 0)
        int kind = iter % 3;
        auto cost = [&](int j, int i) -> long long {
            long long s = P[i] - P[j], len = i - j;
            return kind == 0 ? s * s : (kind == 1 ? len * len : s * s + len * len);
        };
        long long expect = referenceDP(n, K, cost), got = divideConquerDP(n, K, cost);
        if (got != expect) { printf("SAI iter=%d n=%d K=%d kind=%d: %lld != %lld\n", iter, n, K, kind, got, expect); return 1; }
    }
    // ca biên: n = 1; K = 1 (một đoạn duy nhất); K = n (mỗi phần tử một đoạn)
    {
        vector<long long> P = {0, 3, 4, 8, 9, 14};  // dãy 3 1 4 1 5
        auto cost = [&](int j, int i) -> long long { long long s = P[i] - P[j]; return s * s; };
        if (divideConquerDP(1, 1, [&](int, int) -> long long { return 7; }) != 7) { puts("SAI n = 1"); return 1; }
        if (divideConquerDP(5, 1, cost) != 14 * 14) { puts("SAI K = 1"); return 1; }
        if (divideConquerDP(5, 5, cost) != 9 + 1 + 16 + 1 + 25) { puts("SAI K = n"); return 1; }
        if (divideConquerDP(5, 2, cost) != 100) { puts("SAI ví dụ"); return 1; }  // ví dụ trong thư viện
    }
    // ca vừa: n = 2500, K = 15 so với O(K n^2)
    {
        int n = 2500, K = 15;
        vector<long long> P(n + 1, 0);
        for (int i = 1; i <= n; i++) P[i] = P[i - 1] + 1 + rng() % 100;
        auto cost = [&](int j, int i) -> long long { long long s = P[i] - P[j]; return s * s; };
        if (divideConquerDP(n, K, cost) != referenceDP(n, K, cost)) { puts("SAI n = 2500"); return 1; }
    }
    // ca lớn: n = 50000, K = 50 — chỉ kiểm chạy được (không tràn, thời gian) và đơn điệu theo K: thêm đoạn không làm tệ hơn
    {
        int n = 50000;
        vector<long long> P(n + 1, 0);
        for (int i = 1; i <= n; i++) P[i] = P[i - 1] + 1 + rng() % 100;
        auto cost = [&](int j, int i) -> long long { long long s = P[i] - P[j]; return s * s; };
        long long prevAns = LLONG_MAX;
        for (int K : {1, 2, 10, 50}) {
            long long ans = divideConquerDP(n, K, cost);
            if (ans > prevAns || ans <= 0) { puts("SAI ca lớn"); return 1; }
            prevAns = ans;
        }
    }
    puts("OK");
}
