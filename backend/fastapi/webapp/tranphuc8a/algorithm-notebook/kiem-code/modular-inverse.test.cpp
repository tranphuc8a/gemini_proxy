// @TEMPLATE

// Thử mod_inv (Euclid mở rộng), mod_inv_prime (Fermat), inv_table, inv_batch: vét cạn với modulo nhỏ (có a âm, a >= m, gcd > 1, m = 1)
// và kiểm a * inv ≡ 1 bằng __int128 với modulo cỡ 10^18 và các số nguyên tố NTT / 2^61 - 1.
typedef __int128 i128;

#define CHECK(cond, ...) do { if (!(cond)) { printf("SAI: " __VA_ARGS__); printf("\n"); return 1; } } while (0)

int main() {
    mt19937_64 rng(20261017);

    // 1) modulo nhỏ: vét cạn
    for (long long m = 1; m <= 100; m++)
        for (long long a = -150; a <= 150; a++) {
            long long am = ((a % m) + m) % m, brute = -1;
            for (long long x = 0; x < m; x++) if (am * x % m == 1 % m) { brute = x; break; }
            long long r = mod_inv(a, m);
            CHECK(r == brute, "mod_inv(%lld, %lld) = %lld, đúng là %lld", a, m, r, brute);
        }

    // 2) modulo lớn bất kỳ (hợp số cũng được)
    for (int it = 0; it < 40000; it++) {
        long long m = 2 + (long long)(rng() % (unsigned long long)(it % 2 ? 1000000000000000000LL : 1000000LL));
        long long a = (long long)(rng() % 4000000000000000000ULL) - 2000000000000000000LL;
        long long am = ((a % m) + m) % m;
        long long g = std::gcd(am, m);
        long long r = mod_inv(a, m);
        if (g != 1) CHECK(r == -1, "gcd > 1 phải trả -1 (a=%lld, m=%lld)", a, m);
        else CHECK(r >= 0 && r < m && (i128)am * r % m == 1, "a * inv != 1 (a=%lld, m=%lld, r=%lld)", a, m, r);
    }
    CHECK(mod_inv(7, 1) == 0, "mod_inv(7, 1) phải bằng 0");

    // 3) Fermat với các số nguyên tố
    vector<long long> primes = {2, 3, 5, 7, 998244353, 1000000007, 2305843009213693951LL};
    for (long long p : primes) {
        for (int it = 0; it < 3000; it++) {
            long long a = (long long)(rng() % 4000000000000000000ULL) - 2000000000000000000LL;
            long long am = ((a % p) + p) % p;
            if (am == 0) continue;
            long long r = mod_inv_prime(a, p);
            CHECK(r >= 0 && r < p && (i128)am * r % p == 1, "Fermat sai (a=%lld, p=%lld)", a, p);
            CHECK(r == mod_inv(a, p), "Fermat và Euclid khác nhau (a=%lld, p=%lld)", a, p);
        }
    }

    // 4) bảng nghịch đảo 1..n
    struct Case { long long p; int n; };
    for (Case c : vector<Case>{{3, 2}, {5, 4}, {7, 6}, {13, 12}, {101, 100}, {998244353, 300000}, {1000000007, 1000000}}) {
        auto inv = inv_table(c.n, c.p);
        CHECK((int)inv.size() >= c.n + 1, "kích thước bảng");
        for (int i = 1; i <= c.n; i++)
            CHECK((long long)i % c.p * inv[i] % c.p == 1, "inv_table[%d] sai với p=%lld", i, c.p);
    }

    // 5) nghịch đảo hàng loạt
    for (long long p : {998244353LL, 1000000007LL, 7LL, 2LL}) {
        for (int n : {0, 1, 2, 17, 1000}) {
            vector<long long> a(n);
            for (auto& v : a) { do v = (long long)(rng() % 2000000000ULL) - 1000000000LL; while (((v % p) + p) % p == 0); }
            auto r = inv_batch(a, p);
            CHECK((int)r.size() == n, "kích thước inv_batch");
            for (int i = 0; i < n; i++) {
                long long am = ((a[i] % p) + p) % p;
                CHECK(am * r[i] % p == 1, "inv_batch[%d] sai (p=%lld)", i, p);
            }
        }
    }
    puts("OK");
}
