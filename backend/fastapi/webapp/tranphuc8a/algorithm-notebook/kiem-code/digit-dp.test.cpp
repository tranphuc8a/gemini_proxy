// @TEMPLATE

// Thử countNoAdjacentEqual với vét cạn: mọi N trong [0, 30000] (đếm cộng dồn), vài N cỡ triệu, và công thức đóng cho N = 10^k - 1 tới k = 18.
static bool good(long long x) {
    string s = to_string(x);
    for (size_t i = 1; i < s.size(); i++) if (s[i] == s[i - 1]) return false;
    return true;
}

int main() {
    long long cum = 0;
    for (long long x = 0; x <= 30000; x++) {
        cum += good(x);
        long long got = countNoAdjacentEqual(to_string(x));
        if (got != cum) { printf("SAI N=%lld: %lld != %lld\n", x, got, cum); return 1; }
    }
    // N cỡ vài triệu: đếm cộng dồn tới từng mốc ngẫu nhiên
    mt19937 rng(20261017);
    vector<long long> marks;
    for (int i = 0; i < 25; i++) marks.push_back(30001 + rng() % 5000000);
    sort(marks.begin(), marks.end());
    cum = 0;
    long long x = 0;
    for (long long m : marks) {
        for (; x <= m; x++) cum += good(x);
        if (countNoAdjacentEqual(to_string(m)) != cum) { printf("SAI N=%lld\n", m); return 1; }
    }
    // khoảng [L, R]: f(R) - f(L - 1)
    {
        long long L = 1234, R = 98765, cnt = 0;
        for (long long y = L; y <= R; y++) cnt += good(y);
        if (countNoAdjacentEqual(to_string(R)) - countNoAdjacentEqual(to_string(L - 1)) != cnt) { puts("SAI khoảng"); return 1; }
    }
    // N = 10^k - 1: đếm = 1 + 9 + 9^2 + ... + 9^k = (9^(k+1) - 1) / 8 (số có k chữ số không có hai chữ số liền kề bằng nhau: 9^k)
    long long nines = 0, pw = 1;  // pw = 9^k
    string N;
    for (int k = 1; k <= 18; k++) {
        N += '9';
        pw *= 9;
        nines += pw;
        long long expect = 1 + nines;  // cộng số 0
        if (countNoAdjacentEqual(N) != expect) { printf("SAI N=10^%d-1\n", k); return 1; }
    }
    // ca biên và ví dụ trong thư viện
    if (countNoAdjacentEqual("0") != 1 || countNoAdjacentEqual("9") != 10 || countNoAdjacentEqual("10") != 11 || countNoAdjacentEqual("11") != 11 || countNoAdjacentEqual("120") != 101) { puts("SAI ca biên / ví dụ"); return 1; }
    puts("OK");
}
