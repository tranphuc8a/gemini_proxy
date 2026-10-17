// @TEMPLATE

// Thử lis (tăng ngặt và không giảm) với DP O(n^2) cho độ dài; kiểm dãy chỉ số trả về hợp lệ; dãy trùng nhiều; ca lớn 200000 phần tử.
static int lisQuadratic(const vector<long long>& a, bool strict) {
    int n = a.size(), best = 0;
    vector<int> dp(n, 1);
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < i; j++)
            if (strict ? a[j] < a[i] : a[j] <= a[i]) dp[i] = max(dp[i], dp[j] + 1);
        best = max(best, dp[i]);
    }
    return best;
}

static bool valid(const vector<long long>& a, const vector<int>& idx, bool strict) {
    for (size_t k = 0; k < idx.size(); k++) {
        if (idx[k] < 0 || idx[k] >= (int)a.size()) return false;
        if (k && (idx[k] <= idx[k - 1] || (strict ? !(a[idx[k - 1]] < a[idx[k]]) : !(a[idx[k - 1]] <= a[idx[k]])))) return false;
    }
    return true;
}

int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 5000; iter++) {
        int n = rng() % 16, range = 1 + rng() % 12;
        vector<long long> a(n);
        for (auto& x : a) x = (long long)(rng() % (2 * range + 1)) - range;  // nhiều phần tử bằng nhau, có số âm
        for (bool strict : {true, false}) {
            auto res = lis(a, strict);
            if ((int)res.size() != lisQuadratic(a, strict) || !valid(a, res, strict)) {
                printf("SAI iter=%d strict=%d: độ dài %d != %d hoặc dãy không hợp lệ\n", iter, (int)strict, (int)res.size(), lisQuadratic(a, strict));
                return 1;
            }
        }
    }
    // ca biên: rỗng, một phần tử, toàn bằng nhau, giảm dần, tăng dần, giá trị cực lớn
    if (!lis({}).empty()) { puts("SAI rỗng"); return 1; }
    if (lis({5}).size() != 1) { puts("SAI một phần tử"); return 1; }
    if (lis({7, 7, 7, 7}, true).size() != 1 || lis({7, 7, 7, 7}, false).size() != 4) { puts("SAI toàn bằng nhau"); return 1; }
    if (lis({5, 4, 3, 2, 1}).size() != 1 || lis({1, 2, 3, 4, 5}).size() != 5) { puts("SAI đơn điệu"); return 1; }
    if (lis({LLONG_MIN, LLONG_MAX, LLONG_MIN, LLONG_MAX}, true).size() != 2) { puts("SAI giá trị cực"); return 1; }
    // ví dụ trong thư viện: dãy 3 1 4 1 5 9 2 6 -> 4 phần tử, chỉ số 1 2 4 7 (giá trị 1 4 5 6)
    {
        vector<long long> a = {3, 1, 4, 1, 5, 9, 2, 6};
        auto r = lis(a);
        if (r != vector<int>({1, 2, 4, 7})) { puts("SAI ví dụ"); return 1; }
    }
    // ca lớn: 200000 phần tử ngẫu nhiên, và dãy tăng dần hoàn toàn
    int n = 200000;
    vector<long long> a(n);
    for (auto& x : a) x = (long long)(rng() % 2000000000ULL) - 1000000000LL;
    auto res = lis(a, true), res2 = lis(a, false);
    if (!valid(a, res, true) || !valid(a, res2, false) || res2.size() < res.size()) { puts("SAI ca lớn"); return 1; }
    vector<long long> inc(n);
    for (int i = 0; i < n; i++) inc[i] = i;
    if ((int)lis(inc).size() != n) { puts("SAI dãy tăng lớn"); return 1; }
    puts("OK");
}
