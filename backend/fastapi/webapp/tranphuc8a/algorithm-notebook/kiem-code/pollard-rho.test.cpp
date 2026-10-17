// @TEMPLATE

// Thử pr::factorize / pr::is_prime: so với chia thử (mọi n tới 100000 và 300 số ngẫu nhiên tới 10^12), với phân tích đã biết
// (tích các nguyên tố được kiểm bằng chia thử: 2–4 thừa số, tích hai nguyên tố ~10^9, bình phương, luỹ thừa), 2^64 - 1, các luỹ thừa của 2 và 3,
// n = 0 / 1, và số 64 bit ngẫu nhiên (tích phải đúng, mọi thừa số nguyên tố theo bộ 7 cơ số độc lập).
typedef unsigned long long u64;
typedef __uint128_t u128;

#define CHECK(cond, ...) do { if (!(cond)) { printf("SAI: " __VA_ARGS__); printf("\n"); return 1; } } while (0)

static bool slow_prime(u64 n) {
    if (n < 2) return false;
    if (n % 2 == 0) return n == 2;
    for (u64 d = 3; d * d <= n; d += 2) if (n % d == 0) return false;
    return true;
}
static vector<u64> slow_factor(u64 n) {
    vector<u64> r;
    for (u64 d = 2; d * d <= n; d++) while (n % d == 0) { r.push_back(d); n /= d; }
    if (n > 1) r.push_back(n);
    return r;
}
static bool mr7(u64 n) {
    if (n < 2) return false;
    for (u64 p : {2ULL, 3ULL, 5ULL, 7ULL, 11ULL, 13ULL, 17ULL, 19ULL, 23ULL}) if (n % p == 0) return n == p;
    auto mulm = [&](u64 a, u64 b) { return (u64)((u128)a * b % n); };
    u64 d = n - 1;
    int s = 0;
    while ((d & 1) == 0) { d >>= 1; s++; }
    for (u64 a : {2ULL, 325ULL, 9375ULL, 28178ULL, 450775ULL, 9780504ULL, 1795265022ULL}) {
        u64 x = 1, b = a % n, e = d;
        if (b == 0) continue;
        for (; e; e >>= 1, b = mulm(b, b)) if (e & 1) x = mulm(x, b);
        if (x == 1 || x == n - 1) continue;
        bool composite = true;
        for (int i = 1; i < s && composite; i++) { x = mulm(x, x); if (x == n - 1) composite = false; }
        if (composite) return false;
    }
    return true;
}
static u64 random_prime(mt19937_64& rng, u64 lo, u64 hi) {      // nguyên tố trong [lo, hi], kiểm bằng chia thử
    while (true) { u64 p = lo + rng() % (hi - lo + 1); if (slow_prime(p)) return p; }
}

int main() {
    mt19937_64 rng(20261017);

    // 1) n < 300000 so với chia thử; n = 0, 1
    CHECK(pr::factorize(0).empty() && pr::factorize(1).empty(), "n = 0, 1 phải rỗng");
    for (u64 n = 2; n < 100000; n++)
        CHECK(pr::factorize(n) == slow_factor(n), "n=%llu", n);

    // 2) ngẫu nhiên tới 10^12 so với chia thử
    for (int it = 0; it < 300; it++) {
        u64 n = 2 + rng() % 1000000000000ULL;
        CHECK(pr::factorize(n) == slow_factor(n), "n=%llu", n);
    }

    // 3) phân tích đã biết: tích các nguyên tố nhiều cỡ khác nhau
    for (int it = 0; it < 200; it++) {
        vector<u64> fs;
        u128 prod = 1;
        int k = 1 + rng() % 4;
        for (int i = 0; i < k; i++) {
            u64 hi = it % 3 == 0 ? 4000000000ULL : it % 3 == 1 ? 70000ULL : 2000000ULL;
            u64 p = random_prime(rng, 2, hi);
            if ((prod * p) >> 64) break;
            prod *= p;
            fs.push_back(p);
        }
        sort(fs.begin(), fs.end());
        CHECK(pr::factorize((u64)prod) == fs, "tích đã biết n=%llu", (u64)prod);
    }
    // hai nguyên tố ~10^9..4·10^9 (tích tới ~1.6·10^19) và bình phương
    for (int it = 0; it < 60; it++) {
        u64 p = random_prime(rng, 500000000ULL, 4200000000ULL), q = random_prime(rng, 500000000ULL, 4200000000ULL);
        u128 prod = (u128)p * q;
        if (prod >> 64) continue;
        vector<u64> fs = {min(p, q), max(p, q)};
        CHECK(pr::factorize((u64)prod) == fs, "bán nguyên tố %llu * %llu", p, q);
    }
    CHECK(pr::factorize(4294967291ULL * 4294967291ULL) == (vector<u64>{4294967291ULL, 4294967291ULL}), "bình phương nguyên tố ~2^32");

    // 4) các số đặc biệt
    CHECK(pr::factorize(18446744073709551615ULL) == (vector<u64>{3, 5, 17, 257, 641, 65537, 6700417}), "2^64 - 1");
    CHECK(pr::factorize(600851475143ULL) == (vector<u64>{71, 839, 1471, 6857}), "600851475143");
    CHECK(pr::factorize(3825123056546413051ULL) == (vector<u64>{149491, 747451, 34233211}), "3825123056546413051");
    for (int e = 1; e <= 63; e++) CHECK(pr::factorize(1ULL << e) == vector<u64>(e, 2), "2^%d", e);
    {
        u64 v = 1;
        for (int e = 1; e <= 40; e++) { v *= 3; CHECK(pr::factorize(v) == vector<u64>(e, 3), "3^%d", e); }
    }
    for (u64 p : {1000000000000000003ULL, 1000000000000000009ULL, 9223372036854775783ULL, 18446744073709551557ULL, 2305843009213693951ULL})
        CHECK(pr::factorize(p) == vector<u64>{p}, "nguyên tố lớn %llu", p);

    // 5) số 64 bit ngẫu nhiên: tích đúng, mọi thừa số nguyên tố, thứ tự tăng dần
    for (int it = 0; it < 300; it++) {
        u64 n = (rng() >> (rng() % 8)) | 1ULL;
        if (n < 2) continue;
        auto f = pr::factorize(n);
        u128 prod = 1;
        for (size_t i = 0; i < f.size(); i++) {
            CHECK(mr7(f[i]), "thừa số %llu của %llu không nguyên tố", f[i], n);
            CHECK(i == 0 || f[i - 1] <= f[i], "không tăng dần");
            prod *= f[i];
        }
        CHECK(prod == n, "tích sai với n=%llu", n);
    }
    puts("OK");
}
