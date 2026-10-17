// @TEMPLATE

// Thử minCoins / countCombinations / countSequences: vét cạn (đệ quy), BFS trên các tổng, công thức đóng cho {1, 2} ở X lớn.
static long long bruteComb(const vector<int>& coin, size_t i, int rem) {  // số tổ hợp (multiset)
    if (rem == 0) return 1;
    if (i == coin.size()) return 0;
    long long total = 0;
    for (int k = 0; (long long)k * coin[i] <= rem; k++) total += bruteComb(coin, i + 1, rem - k * coin[i]);
    return total;
}
static long long bruteSeq(const vector<int>& coin, int rem) {  // số dãy có thứ tự
    if (rem == 0) return 1;
    long long total = 0;
    for (int c : coin) if (c <= rem) total += bruteSeq(coin, rem - c);
    return total;
}
static int bfsMin(const vector<int>& coin, int X) {  // số đồng ít nhất bằng BFS trên tổng
    vector<int> d(X + 1, -1);
    queue<int> q;
    d[0] = 0;
    q.push(0);
    while (!q.empty()) {
        int u = q.front();
        q.pop();
        for (int c : coin) if (u + c <= X && d[u + c] < 0) { d[u + c] = d[u] + 1; q.push(u + c); }
    }
    return d[X];
}

int main() {
    mt19937 rng(20261017);
    const long long MOD = 1000000007LL;
    for (int iter = 0; iter < 3000; iter++) {
        int n = rng() % 5, X = rng() % 19;
        set<int> s;
        while ((int)s.size() < n) s.insert(1 + rng() % 8);
        vector<int> coin(s.begin(), s.end());
        shuffle(coin.begin(), coin.end(), rng);
        int mn = bfsMin(coin, X);
        long long cb = bruteComb(coin, 0, X), sq = bruteSeq(coin, X);
        if (minCoins(coin, X) != mn || countCombinations(coin, X, MOD) != cb % MOD || countSequences(coin, X, MOD) != sq % MOD) {
            printf("SAI iter=%d X=%d: (%d %lld %lld) != (%d %lld %lld)\n", iter, X, minCoins(coin, X), countCombinations(coin, X, MOD), countSequences(coin, X, MOD), mn, cb, sq);
            return 1;
        }
        if (countCombinations(coin, X, 1) != 0 || countSequences(coin, X, 1) != 0) { puts("SAI mod = 1"); return 1; }
    }
    // BFS ở cỡ lớn hơn cho số đồng ít nhất
    for (int iter = 0; iter < 40; iter++) {
        int n = 1 + rng() % 4, X = rng() % 3000;
        set<int> s;
        while ((int)s.size() < n) s.insert(2 + rng() % 90);
        vector<int> coin(s.begin(), s.end());
        if (minCoins(coin, X) != bfsMin(coin, X)) { printf("SAI minCoins lớn iter=%d\n", iter); return 1; }
    }
    // phản ví dụ tham lam {1, 3, 4}, X = 6 và ví dụ trong thư viện
    if (minCoins({1, 3, 4}, 6) != 2 || countCombinations({1, 3, 4}, 6, MOD) != 4 || countSequences({1, 3, 4}, 6, MOD) != 9) { puts("SAI ví dụ"); return 1; }
    // không tạo được: toàn mệnh giá chẵn, tổng lẻ; X = 0
    if (minCoins({2, 4}, 7) != -1 || minCoins({5}, 0) != 0 || countCombinations({}, 0, MOD) != 1 || countCombinations({}, 3, MOD) != 0) { puts("SAI ca biên"); return 1; }
    // X lớn với {1, 2}: tổ hợp = X/2 + 1, dãy có thứ tự = Fibonacci (modulo)
    int X = 1000000;
    if (countCombinations({1, 2}, X, MOD) != (X / 2 + 1) % MOD) { puts("SAI tổ hợp {1,2}"); return 1; }
    long long f0 = 1, f1 = 1;  // dãy có thứ tự cho {1,2}: g(0) = 1, g(1) = 1, g(x) = g(x-1) + g(x-2)
    for (int x = 2; x <= X; x++) { long long f2 = (f0 + f1) % MOD; f0 = f1; f1 = f2; }
    if (countSequences({1, 2}, X, MOD) != f1) { puts("SAI dãy {1,2}"); return 1; }
    puts("OK");
}
