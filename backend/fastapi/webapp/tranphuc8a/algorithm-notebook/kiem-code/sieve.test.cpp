// @TEMPLATE

// Thử Sieve (spf, is_prime, factorize) với chia thử; số lượng nguyên tố ≤ 10^7 (= 664579, giá trị đã biết); sàng phân đoạn so với
// chia thử bằng các nguyên tố của một sàng viết riêng; các ca biên (n = 0, 1, L ≤ 1, R < L).
typedef long long ll;

#define CHECK(cond, ...) do { if (!(cond)) { printf("SAI: " __VA_ARGS__); printf("\n"); return 1; } } while (0)

static bool slow_prime(ll n) {
    if (n < 2) return false;
    for (ll d = 2; d * d <= n; d++) if (n % d == 0) return false;
    return true;
}

int main() {
    mt19937_64 rng(20261017);

    // 1) kích thước nhỏ và 200000: so với chia thử
    for (int n : {0, 1, 2, 3, 4, 5, 10, 97, 100, 1000, 200000}) {
        Sieve s(n);
        CHECK((int)s.spf.size() == n + 1, "kích thước spf n=%d", n);
        vector<int> expect;
        for (int x = 0; x <= n; x++) {
            bool p = slow_prime(x);
            CHECK(s.is_prime(x) == p, "is_prime(%d), n=%d", x, n);
            if (p) expect.push_back(x);
            if (x >= 1) {
                auto f = s.factorize(x);
                ll prod = 1;
                int prev = 0;
                for (auto [q, e] : f) {
                    CHECK(slow_prime(q) && q > prev && e >= 1, "factorize(%d): thừa số không nguyên tố / không tăng dần", x);
                    prev = q;
                    for (int i = 0; i < e; i++) prod *= q;
                }
                CHECK(prod == x, "factorize(%d): tích sai", x);
            }
        }
        CHECK(s.primes == expect, "danh sách nguyên tố sai (n=%d)", n);
    }

    // 2) đếm nguyên tố tới 10^7 và phân tích ngẫu nhiên
    {
        const int N = 10000000;
        Sieve s(N);
        CHECK(s.primes.size() == 664579u, "số nguyên tố ≤ 1e7 phải là 664579, được %zu", s.primes.size());
        for (int it = 0; it < 20000; it++) {
            int x = 2 + rng() % (N - 1);
            ll prod = 1;
            for (auto [q, e] : s.factorize(x)) for (int i = 0; i < e; i++) prod *= q;
            CHECK(prod == x, "factorize(%d) tích sai", x);
        }
    }

    // 3) sàng phân đoạn: so với chia thử bằng các nguyên tố từ sàng riêng
    const int LIM = 3300000;                           // đủ cho R ≤ 1e13
    vector<char> comp(LIM + 1, 0);
    vector<ll> small_primes;
    for (int i = 2; i <= LIM; i++) {
        if (comp[i]) continue;
        small_primes.push_back(i);
        for (ll j = (ll)i * i; j <= LIM; j += i) comp[j] = 1;
    }
    auto trial = [&](ll v) {
        if (v < 2) return false;
        for (ll p : small_primes) { if (p * p > v) break; if (v % p == 0) return false; }
        return true;
    };
    struct Range { ll L, R; };
    vector<Range> rs = {{0, 1}, {1, 1}, {1, 2}, {2, 2}, {2, 3}, {-5, 30}, {10, 9}, {1, 100}, {90, 100}, {4, 4}, {97, 97}, {1, 10000}};
    for (int it = 0; it < 60; it++) {
        ll top = it < 20 ? 1000000LL : it < 45 ? 1000000000000LL : 10000000000000LL;
        ll len = 1 + rng() % (it < 20 ? 3000 : it < 45 ? 400 : 80);
        ll R = 2 + (ll)(rng() % (unsigned long long)top);
        rs.push_back({R - len, R});
    }
    for (auto& rg : rs) {
        auto got = primes_in_range(rg.L, rg.R);
        vector<ll> expect;
        for (ll v = max(rg.L, 0LL); v <= rg.R; v++) if (trial(v)) expect.push_back(v);
        CHECK(got == expect, "primes_in_range(%lld, %lld) sai", rg.L, rg.R);
    }
    puts("OK");
}
