// @TEMPLATE

// Thử mat_pow (modulo) và mat_pow_minplus: so với nhân lặp từng bước (e nhỏ), kiểm F(n) mod 10^9 + 7 với "fast doubling" độc lập (n tới 10^18),
// tribonacci, ma trận 1×1 (= luỹ thừa nhanh), mod = 1, e = 0 (ma trận đơn vị) và đường đi ngắn nhất có đúng e cạnh so với quy hoạch động.
typedef long long ll;
typedef unsigned long long u64;

#define CHECK(cond, ...) do { if (!(cond)) { printf("SAI: " __VA_ARGS__); printf("\n"); return 1; } } while (0)

static const ll MOD = 1000000007LL;

// F(n), F(n+1) bằng fast doubling
static pair<ll, ll> fib(u64 n) {
    if (n == 0) return {0, 1};
    auto [a, b] = fib(n >> 1);
    ll c = a * ((2 * b % MOD - a + MOD) % MOD) % MOD;     // F(2k)
    ll d = (a * a + b * b) % MOD;                          // F(2k+1)
    if (n & 1) return {d, (c + d) % MOD};
    return {c, d};
}

int main() {
    mt19937_64 rng(20261017);

    // 1) ma trận ngẫu nhiên: A^e so với nhân lặp
    for (int it = 0; it < 400; it++) {
        int d = 1 + rng() % 5;
        ll mod = it % 3 == 0 ? 1000000007LL : it % 3 == 1 ? 998244353LL : 1 + rng() % 100;
        Mat A(d, vector<ll>(d));
        for (auto& row : A) for (auto& x : row) x = (ll)(rng() % 2000000) - 1000000;      // có số âm
        int e = rng() % 41;
        Mat expect = mat_identity(d);
        for (auto& row : expect) for (auto& x : row) x %= mod;
        Mat An = A;
        for (auto& row : An) for (auto& x : row) x = ((x % mod) + mod) % mod;
        for (int i = 0; i < e; i++) expect = mat_mul(expect, An, mod);
        CHECK(mat_pow(A, e, mod) == expect, "A^%d (d=%d, mod=%lld)", e, d, mod);
    }
    CHECK(mat_pow(Mat{{5}}, 0, 7) == Mat{{1}}, "A^0 phải là ma trận đơn vị");
    CHECK(mat_pow(Mat{{5, 1}, {2, 3}}, 12345, 1) == (Mat{{0, 0}, {0, 0}}), "mod = 1");

    // 2) ma trận 1×1 là luỹ thừa nhanh: 3^e mod p
    for (int it = 0; it < 2000; it++) {
        u64 e = rng() >> (rng() % 64);
        ll expect = 1, base = 3;
        u64 k = e;
        while (k) { if (k & 1) expect = expect * base % MOD; base = base * base % MOD; k >>= 1; }
        CHECK(mat_pow(Mat{{3}}, e, MOD)[0][0] == expect, "1x1");
    }

    // 3) Fibonacci: [[1,1],[1,0]]^n = [[F(n+1), F(n)], [F(n), F(n-1)]]
    for (int it = 0; it < 3000; it++) {
        u64 n = 1 + (it < 300 ? (u64)it : (rng() >> (rng() % 64)) % 1000000000000000000ULL);
        Mat M = mat_pow(Mat{{1, 1}, {1, 0}}, n, MOD);
        auto [f, g] = fib(n);
        CHECK(M[0][1] == f && M[1][0] == f && M[0][0] == g, "Fibonacci n=%llu", n);
    }
    {
        Mat M = mat_pow(Mat{{1, 1}, {1, 0}}, 10, 1000000007LL);
        CHECK(M == (Mat{{89, 55}, {55, 34}}), "[[1,1],[1,0]]^10");
    }
    // tribonacci T(n) = T(n-1) + T(n-2) + T(n-3), T(0) = 0, T(1) = 0, T(2) = 1
    {
        vector<ll> t = {0, 0, 1};
        for (int i = 3; i <= 60; i++) t.push_back((t[i - 1] + t[i - 2] + t[i - 3]) % MOD);
        Mat C = {{1, 1, 1}, {1, 0, 0}, {0, 1, 0}};
        for (int n = 2; n <= 60; n++) {
            Mat P = mat_pow(C, n - 2, MOD);                          // [T(n), T(n-1), T(n-2)] = P * [T(2), T(1), T(0)]
            CHECK(P[0][0] * 1 % MOD == t[n], "tribonacci T(%d)", n);
        }
    }

    // 4) bán vòng (min, +): đường đi ngắn nhất có đúng e cạnh, so với quy hoạch động theo số cạnh
    for (int it = 0; it < 1500; it++) {
        int d = 1 + rng() % 6;
        Mat A(d, vector<ll>(d, MAT_INF));
        for (int i = 0; i < d; i++) for (int j = 0; j < d; j++) if (rng() % 3) A[i][j] = (ll)(rng() % 100) - 5;     // có cạnh âm, không có chu trình âm cần quan tâm vì độ dài cạnh cố định
        int e = rng() % 12;
        Mat dp(d, vector<ll>(d, MAT_INF));
        for (int i = 0; i < d; i++) dp[i][i] = 0;
        for (int step = 0; step < e; step++) {
            Mat nx(d, vector<ll>(d, MAT_INF));
            for (int i = 0; i < d; i++) for (int k = 0; k < d; k++) if (dp[i][k] < MAT_INF)
                for (int j = 0; j < d; j++) if (A[k][j] < MAT_INF) nx[i][j] = min(nx[i][j], dp[i][k] + A[k][j]);
            dp = nx;
        }
        CHECK(mat_pow_minplus(A, e) == dp, "min-plus e=%d d=%d", e, d);
    }
    {   // e rất lớn trên chu trình dương: đường thẳng 0 -> 1 -> 2 -> 0 với trọng số 1 → (A^e)[0][e mod 3 đỉnh] = e
        Mat A(3, vector<ll>(3, MAT_INF));
        A[0][1] = 1; A[1][2] = 1; A[2][0] = 1;
        Mat R = mat_pow_minplus(A, 1000000000000000000ULL);
        CHECK(R[0][(1000000000000000000ULL % 3)] == 1000000000000000000LL, "chu trình dài 3, e = 10^18");
        CHECK(R[0][(1000000000000000000ULL % 3 + 1) % 3] >= MAT_INF, "đỉnh không đạt được bằng đúng e cạnh phải là INF");
    }
    puts("OK");
}
