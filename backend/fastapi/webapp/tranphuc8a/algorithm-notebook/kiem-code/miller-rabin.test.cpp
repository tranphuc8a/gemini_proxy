// @TEMPLATE

// Thử mr::is_prime: so với chia thử (mọi n < 200000, mẫu ngẫu nhiên tới 10^12), danh sách số Carmichael và giả nguyên tố mạnh đã biết
// (hợp số được xác minh bằng chia thử hoặc bằng tích đã biết), tích hai nguyên tố ~10^9 (hợp số tới ~10^19), các số nguyên tố sát 2^61, 2^63,
// 2^64, 10^18 (đã kiểm bằng `factor`), và so chéo với bộ 7 cơ số {2, 325, 9375, 28178, 450775, 9780504, 1795265022} trên số ngẫu nhiên 64 bit.
typedef unsigned long long u64;
typedef __uint128_t u128;

#define CHECK(cond, ...) do { if (!(cond)) { printf("SAI: " __VA_ARGS__); printf("\n"); return 1; } } while (0)

static bool slow_prime(u64 n) {
    if (n < 2) return false;
    if (n % 2 == 0) return n == 2;
    for (u64 d = 3; d * d <= n; d += 2) if (n % d == 0) return false;
    return true;
}

// Miller–Rabin với bộ 7 cơ số của Jim Sinclair (độc lập với mẫu)
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

int main() {
    mt19937_64 rng(20261017);

    // 1) mọi n < 200000
    for (u64 n = 0; n < 200000; n++)
        CHECK(mr::is_prime(n) == slow_prime(n), "n=%llu", n);

    // 2) mẫu ngẫu nhiên tới 10^12 (so với chia thử)
    for (int it = 0; it < 1200; it++) {
        u64 n = 1000000000ULL + rng() % 999000000000ULL;
        if (it % 2) n |= 1;
        CHECK(mr::is_prime(n) == slow_prime(n), "n=%llu", n);
    }

    // 3) số Carmichael và giả nguyên tố mạnh đã biết — kết quả đúng được xác định bằng chia thử
    vector<u64> pseudo = {561, 1105, 1729, 2465, 2821, 6601, 8911, 10585, 15841, 29341, 41041, 46657, 52633, 62745, 63973, 75361, 101101,
                          115921, 126217, 162401, 172081, 188461, 252601, 278545, 294409, 314821, 334153, 340561, 399001, 410041, 449065,
                          488881, 512461, 5394826801ULL, 232250619601ULL, 9746347772161ULL,
                          2047, 3277, 4033, 4681, 8321, 1373653, 25326001, 3215031751ULL, 2152302898747ULL, 3474749660383ULL, 341550071728321ULL};
    for (u64 n : pseudo) CHECK(mr::is_prime(n) == slow_prime(n) && !mr::is_prime(n), "giả nguyên tố %llu bị coi là nguyên tố", n);
    {   // giả nguyên tố mạnh với 9 cơ số đầu tiên, tích đã biết
        u64 psi = 3825123056546413051ULL;
        CHECK((u128)149491 * 747451 * 34233211 == psi, "tích của 3825123056546413051");
        CHECK(!mr::is_prime(psi), "3825123056546413051 là hợp số");
    }

    // 4) số nguyên tố lớn đã biết
    vector<u64> primes = {2, 3, 998244353, 1000000007, 4294967291ULL, 4294967311ULL, 2305843009213693951ULL, 9223372036854775783ULL,
                          18446744073709551557ULL, 1000000000000000003ULL, 1000000000000000009ULL};
    for (u64 p : primes) CHECK(mr::is_prime(p), "số nguyên tố %llu bị coi là hợp số", p);
    CHECK(!mr::is_prime(18446744073709551615ULL), "2^64 - 1 là hợp số");
    CHECK(!mr::is_prime(1000000000000000001ULL) && !mr::is_prime(1000000000000000007ULL), "10^18 + 1, 10^18 + 7");

    // 5) tích hai nguyên tố ~10^9..4·10^9 và bình phương: hợp số tới ~10^19
    vector<u64> ps;
    while (ps.size() < 60) {
        u64 p = 500000000ULL + rng() % 3700000000ULL;
        if (slow_prime(p)) ps.push_back(p);
    }
    for (size_t i = 0; i < ps.size(); i++)
        for (size_t j = i; j < ps.size(); j++) {
            u128 prod = (u128)ps[i] * ps[j];
            if (prod >> 64) continue;
            CHECK(!mr::is_prime((u64)prod), "tích hai nguyên tố %llu * %llu bị coi là nguyên tố", ps[i], ps[j]);
        }

    // 6) so chéo với bộ 7 cơ số trên số ngẫu nhiên 64 bit (đủ kích cỡ) và quanh các luỹ thừa của 2
    for (int it = 0; it < 150000; it++) {
        u64 n = rng() >> (rng() % 60);
        CHECK(mr::is_prime(n) == mr7(n), "so chéo n=%llu", n);
    }
    for (int k = 2; k < 64; k++)
        for (u64 d = 0; d < 300; d++) {
            u64 n = (1ULL << k) + d - 150;
            CHECK(mr::is_prime(n) == mr7(n), "quanh 2^%d: n=%llu", k, n);
        }
    puts("OK");
}
