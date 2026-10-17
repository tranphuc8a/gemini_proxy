// @TEMPLATE

// Thử Binomial: so với tam giác Pascal modulo (n ≤ 700) với p = 10^9 + 7, 998244353 và các p nhỏ (Lucas khi n ≥ p), với C(1000, 500) mod 10^9 + 7
// = 159835829 (kiểm bằng số lớn), với phân tích theo công thức Legendre (độc lập) cho n = 10^6, số Catalan đã biết, ca biên (r < 0, r > n).
typedef long long ll;

#define CHECK(cond, ...) do { if (!(cond)) { printf("SAI: " __VA_ARGS__); printf("\n"); return 1; } } while (0)

int main() {
    mt19937_64 rng(20261017);

    // 1) Pascal modulo vs C(n, r) cho n < p (bảng dựng tới 700)
    for (ll p : {1000000007LL, 998244353LL}) {
        Binomial b(700, p);
        vector<vector<ll>> pas(701, vector<ll>(701, 0));
        for (int n = 0; n <= 700; n++) {
            pas[n][0] = 1;
            for (int r = 1; r <= n; r++) pas[n][r] = (pas[n - 1][r - 1] + (r <= n - 1 ? pas[n - 1][r] : 0)) % p;
        }
        for (int n = 0; n <= 700; n++)
            for (int r = -2; r <= n + 2; r++) {
                ll expect = (r < 0 || r > n) ? 0 : pas[n][r];
                CHECK(b.C(n, r) == expect, "C(%d, %d) mod %lld", n, r, p);
            }
    }

    // 2) p nhỏ: Lucas so với Pascal modulo p (n vượt p nhiều lần)
    for (ll p : {2LL, 3LL, 5LL, 7LL, 13LL, 101LL}) {
        Binomial b((int)p - 1, p);
        const int N = 700;
        vector<vector<ll>> pas(N + 1, vector<ll>(N + 1, 0));
        for (int n = 0; n <= N; n++) {
            pas[n][0] = 1;
            for (int r = 1; r <= n; r++) pas[n][r] = (pas[n - 1][r - 1] + (r <= n - 1 ? pas[n - 1][r] : 0)) % p;
        }
        for (int n = 0; n <= N; n++)
            for (int r = 0; r <= n; r++) CHECK(b.lucas(n, r) == pas[n][r], "Lucas C(%d, %d) mod %lld", n, r, p);
        CHECK(b.lucas(5, 9) == 0 && b.lucas(5, -1) == 0, "Lucas: r > n hoặc r < 0 phải bằng 0");
        // n rất lớn: C(p^k, r) ≡ 0 với 0 < r < p^k
        ll pk = p;
        for (int k = 1; k <= 8 && pk <= (ll)4e18 / p; k++, pk *= p)
            for (ll r : {1LL, 2LL, pk - 1, pk / 2}) if (r > 0 && r < pk) CHECK(b.lucas(pk, r) == 0, "Lucas C(p^k, r) phải ≡ 0 (p=%lld)", p);
        CHECK(b.lucas(pk, 0) == 1 && b.lucas(pk, pk) == 1, "Lucas C(n, 0) = C(n, n) = 1");
    }

    // 3) giá trị đã biết
    {
        Binomial b(1000, 1000000007LL);
        CHECK(b.C(1000, 500) == 159835829LL, "C(1000, 500) mod 1e9+7 phải là 159835829");
        CHECK(b.C(10, 3) == 120 && b.C(5, 2) == 10 && b.C(0, 0) == 1 && b.C(1000, 0) == 1 && b.C(1000, 1000) == 1, "giá trị nhỏ");
        const ll cat[] = {1, 1, 2, 5, 14, 42, 132, 429, 1430, 4862, 16796, 58786, 208012};
        Binomial c(40, 1000000007LL);
        for (int n = 0; n <= 12; n++) CHECK(c.catalan(n) == cat[n], "Catalan(%d)", n);
    }

    // 4) n = 10^6: số mũ của từng nguyên tố trong C(n, r) theo công thức Legendre rồi nhân lại (độc lập với bảng giai thừa)
    {
        const int N = 1000000;
        const ll P = 1000000007LL;
        Binomial b(N, P);
        vector<char> comp(N + 1, 0);
        vector<int> primes;
        for (int i = 2; i <= N; i++) { if (!comp[i]) { primes.push_back(i); for (ll j = (ll)i * i; j <= N; j += i) comp[j] = 1; } }
        auto legendre = [&](ll n, ll q) { ll e = 0; while (n) { n /= q; e += n; } return e; };
        auto power = [&](ll a, ll e) { ll r = 1; a %= P; while (e > 0) { if (e & 1) r = r * a % P; a = a * a % P; e >>= 1; } return r; };
        for (int it = 0; it < 12; it++) {
            ll n = it < 3 ? N : 1 + rng() % N;
            ll r = it == 0 ? N / 2 : rng() % (n + 1);
            ll expect = 1;
            for (int q : primes) {
                if (q > n) break;
                ll e = legendre(n, q) - legendre(r, q) - legendre(n - r, q);
                if (e) expect = expect * power(q, e) % P;
            }
            CHECK(b.C(n, r) == expect, "C(%lld, %lld) mod P khác công thức Legendre", n, r);
        }
        // đối xứng và hệ thức Pascal ngẫu nhiên
        for (int it = 0; it < 100000; it++) {
            ll n = 1 + rng() % N, r = rng() % (n + 1);
            CHECK(b.C(n, r) == b.C(n, n - r), "đối xứng");
            if (r >= 1) CHECK(b.C(n, r) == (b.C(n - 1, r - 1) + b.C(n - 1, r)) % P, "Pascal C(%lld, %lld)", n, r);
        }
    }
    puts("OK");
}
