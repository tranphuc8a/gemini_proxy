// @TEMPLATE

// Thử pow_mod / mul_mod / pow_ll: vét cạn nhân lặp với số nhỏ; nhân "nhân đôi–cộng" độc lập cho mul_mod; các đẳng thức
// a^(e1+e2) = a^e1 * a^e2, định lý Fermat, (m-1)^e = (-1)^e với m = LLONG_MAX (modulo sát giới hạn), 2^e mod (2^61-1) = 2^(e mod 61).
typedef __int128 i128;
typedef unsigned long long u64;

#define CHECK(cond, ...) do { if (!(cond)) { printf("SAI: " __VA_ARGS__); printf("\n"); return 1; } } while (0)

// nhân modulo độc lập: nhân đôi và cộng, không dùng phép nhân 128 bit
static long long slow_mul(long long a, long long b, long long m) {
    long long res = 0;
    a %= m; b %= m;
    while (b > 0) {
        if (b & 1) res = (long long)(((i128)res + a) % m);
        a = (long long)(((i128)a + a) % m);
        b >>= 1;
    }
    return res;
}

int main() {
    mt19937_64 rng(20261017);

    // 1) số nhỏ: nhân lặp
    for (long long a = -20; a <= 20; a++)
        for (long long e = 0; e <= 30; e++)
            for (long long m = 1; m <= 50; m++) {
                long long r = 1 % m, am = ((a % m) + m) % m;
                for (long long i = 0; i < e; i++) r = r * am % m;
                CHECK(pow_mod(a, e, m) == r, "pow_mod(%lld, %lld, %lld)", a, e, m);
            }
    CHECK(pow_mod(0, 0, 7) == 1, "0^0 phải bằng 1");
    CHECK(pow_mod(5, 0, 1) == 0, "m = 1 phải bằng 0");

    // 2) mul_mod so với nhân đôi–cộng, modulo tới LLONG_MAX
    for (int it = 0; it < 20000; it++) {
        long long m = 1 + (long long)(rng() % (u64)LLONG_MAX);
        if (it % 3 == 0) m = LLONG_MAX - (long long)(rng() % 10);
        long long a = (long long)(rng() % (u64)m), b = (long long)(rng() % (u64)m);
        CHECK(mul_mod(a, b, m) == slow_mul(a, b, m), "mul_mod sai (m=%lld)", m);
    }

    // 3) đẳng thức số mũ với modulo lớn
    for (int it = 0; it < 20000; it++) {
        long long m = 1 + (long long)(rng() % (u64)LLONG_MAX);
        if (it % 5 == 0) m = 1 + (long long)(rng() % 1000000007ULL);
        long long a = (long long)rng();
        if (a == LLONG_MIN) a++;
        u64 e1 = rng() >> 2, e2 = rng() >> 2;
        long long pa = pow_mod(a, e1, m), pb = pow_mod(a, e2, m);
        CHECK(pow_mod(a, e1 + e2, m) == mul_mod(pa, pb, m), "a^(e1+e2) (a=%lld, m=%lld)", a, m);
        CHECK(pow_mod(a, 2 * e1, m) == mul_mod(pa, pa, m), "a^(2e)");
        CHECK(pow_mod(a, 0, m) == 1 % m, "a^0");
        CHECK(pow_mod(a, 1, m) == (long long)((((i128)a % m) + m) % m), "a^1");
    }

    // 4) Fermat: a^(p-1) = 1 với p nguyên tố; 2^e mod (2^61-1) = 2^(e mod 61)
    long long primes[] = {2, 3, 998244353, 1000000007, 2305843009213693951LL, 9223372036854775783LL};
    for (long long p : primes)
        for (int it = 0; it < 2000; it++) {
            long long a = 1 + (long long)(rng() % (u64)(p - 1 > 0 ? p - 1 : 1));
            if (a % p == 0) continue;
            CHECK(pow_mod(a, (u64)(p - 1), p) == 1, "Fermat a^(p-1) (p=%lld)", p);
        }
    const long long M61 = 2305843009213693951LL;
    for (int it = 0; it < 5000; it++) {
        u64 e = rng();
        CHECK(pow_mod(2, e, M61) == (1LL << (e % 61)), "2^e mod M61");
    }
    // modulo sát giới hạn: (m-1)^e = (-1)^e
    for (int it = 0; it < 5000; it++) {
        u64 e = rng();
        long long m = LLONG_MAX;
        CHECK(pow_mod(m - 1, e, m) == ((e & 1) ? m - 1 : 1), "(m-1)^e (e=%llu)", e);
        CHECK(pow_mod(-1, e, m) == ((e & 1) ? m - 1 : 1), "(-1)^e");
    }

    // 5) pow_ll (không modulo): so với tích dùng __int128, chỉ so khi kết quả vừa long long
    for (long long a = -9; a <= 9; a++)
        for (int e = 0; e <= 60; e++) {
            i128 exact = 1;
            bool big = false;
            for (int i = 0; i < e && !big; i++) { exact *= a; if (exact > (i128)LLONG_MAX || exact < -(i128)LLONG_MAX) big = true; }
            if (big) continue;
            CHECK(pow_ll(a, e) == (long long)exact, "pow_ll(%lld, %d)", a, e);
        }
    CHECK(pow_ll(3, 39) == 4052555153018976267LL, "3^39 (bình phương cuối không được tràn)");
    puts("OK");
}
