// @TEMPLATE

// Thử euler_phi / phi_sieve: so với định nghĩa (đếm k ≤ n nguyên tố cùng nhau với n), đồng nhất thức Σ φ(d) = n,
// tính nhân tính, định lý Euler a^φ(m) ≡ 1, sàng đến 10^6 so với chia thử, và vài giá trị lớn đã biết.
typedef long long ll;
typedef __int128 i128;

#define CHECK(cond, ...) do { if (!(cond)) { printf("SAI: " __VA_ARGS__); printf("\n"); return 1; } } while (0)

static ll pow_mod_t(ll a, ll e, ll m) {
    ll r = 1 % m;
    a %= m;
    while (e > 0) { if (e & 1) r = (ll)((i128)r * a % m); a = (ll)((i128)a * a % m); e >>= 1; }
    return r;
}

int main() {
    mt19937_64 rng(20261017);

    // 1) theo định nghĩa với n ≤ 2000
    vector<ll> ph(2001, 0);
    for (int n = 1; n <= 2000; n++) {
        ll cnt = 0;
        for (int k = 1; k <= n; k++) if (std::gcd(k, n) == 1) cnt++;
        ph[n] = cnt;
        CHECK(euler_phi(n) == cnt, "euler_phi(%d) = %lld, đúng là %lld", n, euler_phi(n), cnt);
    }
    // 2) Σ_{d | n} φ(d) = n
    for (int n = 1; n <= 2000; n++) {
        ll s = 0;
        for (int d = 1; d <= n; d++) if (n % d == 0) s += ph[d];
        CHECK(s == n, "tổng φ(d) cho n=%d", n);
    }
    // 3) sàng: bé và so với euler_phi
    CHECK(phi_sieve(0) == vector<int>{0}, "phi_sieve(0)");
    CHECK((phi_sieve(1) == vector<int>{0, 1}), "phi_sieve(1)");
    {
        auto p = phi_sieve(10);
        CHECK((p == vector<int>{0, 1, 1, 2, 2, 4, 2, 6, 4, 6, 4}), "φ(1..10)");
    }
    {
        const int N = 1000000;
        auto p = phi_sieve(N);
        CHECK((int)p.size() == N + 1, "kích thước");
        for (int i = 1; i <= N; i += (i < 20000 ? 1 : 7)) CHECK(p[i] == euler_phi(i), "phi_sieve[%d]=%d khác euler_phi=%lld", i, p[i], euler_phi(i));
        // tính nhân tính: φ(ab) = φ(a)φ(b) khi gcd = 1
        for (int it = 0; it < 20000; it++) {
            int a = 1 + rng() % 1000, b = 1 + rng() % 1000;
            if (std::gcd(a, b) != 1) continue;
            CHECK(p[a * b] == p[a] * p[b], "nhân tính %d %d", a, b);
        }
    }
    // 4) định lý Euler: a^φ(m) ≡ 1 (mod m) khi gcd(a, m) = 1
    for (int it = 0; it < 20000; it++) {
        ll m = 1 + rng() % 1000000007ULL;
        if (it % 4 == 0) m = 1 + rng() % 5000;
        ll a = 1 + rng() % 2000000000ULL;
        if (std::gcd(a, m) != 1) continue;
        CHECK(pow_mod_t(a, euler_phi(m), m) == 1 % m, "Euler a=%lld m=%lld", a, m);
    }
    // 5) giá trị đã biết (kiểm bằng phân tích riêng)
    CHECK(euler_phi(1) == 1, "φ(1)");
    CHECK(euler_phi(1LL << 40) == (1LL << 39), "φ(2^40)");
    CHECK(euler_phi(999999999989LL) == 999999999988LL, "φ(số nguyên tố ~1e12)");
    CHECK(euler_phi(1000000000000LL) == 400000000000LL, "φ(10^12) = 4·10^11");
    CHECK(euler_phi(97 * 97) == 97 * 96, "φ(p^2)");
    CHECK(euler_phi(1000000007LL * 3) == 1000000006LL * 2, "φ(3p)");
    puts("OK");
}
