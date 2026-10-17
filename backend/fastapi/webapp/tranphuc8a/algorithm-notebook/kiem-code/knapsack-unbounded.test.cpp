// @TEMPLATE

// Thử knapsackUnbounded (hai chế độ) với vét cạn đệ quy theo số bản mỗi loại; ca lớn kiểm bằng công thức.
static long long brute(const vector<int>& w, const vector<long long>& v, size_t i, int cap, bool exact) {
    if (i == w.size()) return (!exact || cap == 0) ? 0 : -1;
    long long best = -1;
    for (int k = 0; (long long)k * w[i] <= cap; k++) {
        long long r = brute(w, v, i + 1, cap - k * w[i], exact);
        if (r >= 0) best = max(best, r + k * v[i]);
    }
    return best;
}

int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 4000; iter++) {
        int n = rng() % 5, W = rng() % 25;
        vector<int> w(n);
        vector<long long> v(n);
        for (int i = 0; i < n; i++) { w[i] = 1 + rng() % 7; v[i] = rng() % 21; }
        long long a = brute(w, v, 0, W, false), b = brute(w, v, 0, W, true);
        long long ga = knapsackUnbounded(w, v, W), gb = knapsackUnbounded(w, v, W, true);
        if (ga != a || gb != b) { printf("SAI iter=%d: (%lld, %lld) != (%lld, %lld)\n", iter, ga, gb, a, b); return 1; }
    }
    // ca lớn: w = 1, v = 1e12, W = 1e5 -> 1e17 (nhiều hơn int32 rất nhiều)
    if (knapsackUnbounded({1}, {1000000000000LL}, 100000) != 100000LL * 1000000000000LL) { puts("SAI ca lớn"); return 1; }
    // đúng bằng W: chỉ có loại nặng 2 -> W lẻ không có cách (-1), W chẵn được (W/2) * v
    if (knapsackUnbounded({2}, {5}, 99999, true) != -1) { puts("SAI vô nghiệm"); return 1; }
    if (knapsackUnbounded({2}, {5}, 100000, true) != 250000) { puts("SAI đúng bằng W"); return 1; }
    // W = 0 và không có loại nào
    if (knapsackUnbounded({}, {}, 0) != 0 || knapsackUnbounded({}, {}, 5) != 0 || knapsackUnbounded({}, {}, 5, true) != -1) { puts("SAI ca rỗng"); return 1; }
    // ví dụ trong thư viện
    if (knapsackUnbounded({3, 4, 5}, {5, 7, 9}, 10) != 18) { puts("SAI ví dụ"); return 1; }
    puts("OK");
}
