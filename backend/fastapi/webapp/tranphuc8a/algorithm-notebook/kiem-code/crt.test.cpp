// @TEMPLATE

// Thử crt_merge / crt: vét cạn x trong [0, lcm) với mô-đun nhỏ (không nguyên tố cùng nhau, vô nghiệm, a âm, m = 1), hệ 2–5 phương trình,
// rồi kiểm nghiệm bằng __int128 với mô-đun cỡ 10^9 (lcm ~10^18) và hệ gồm nhiều mô-đun có ước chung.
typedef long long ll;
typedef __int128 i128;

#define CHECK(cond, ...) do { if (!(cond)) { printf("SAI: " __VA_ARGS__); printf("\n"); return 1; } } while (0)

static ll norm(ll a, ll m) { return ((a % m) + m) % m; }

int main() {
    mt19937_64 rng(20261017);

    // 1) hai phương trình, mô-đun nhỏ, so với vét cạn
    for (ll m1 = 1; m1 <= 24; m1++)
        for (ll m2 = 1; m2 <= 24; m2++)
            for (ll a1 = -3; a1 < m1 + 3; a1++)
                for (ll a2 = -3; a2 < m2 + 3; a2++) {
                    ll l = m1 / std::gcd(m1, m2) * m2, brute = -1;
                    for (ll x = 0; x < l; x++) if (x % m1 == norm(a1, m1) && x % m2 == norm(a2, m2)) { brute = x; break; }
                    auto r = crt_merge(a1, m1, a2, m2);
                    if (brute < 0) CHECK(r.first == -1 && r.second == -1, "phải vô nghiệm (%lld,%lld) (%lld,%lld)", a1, m1, a2, m2);
                    else CHECK(r.first == brute && r.second == l, "crt_merge (%lld mod %lld) (%lld mod %lld): được {%lld, %lld}, đúng là {%lld, %lld}", a1, m1, a2, m2, r.first, r.second, brute, l);
                }

    // 2) hệ k phương trình, mô-đun nhỏ bất kỳ, so với vét cạn
    for (int it = 0; it < 3000; it++) {
        int k = 1 + rng() % 5;
        vector<ll> a(k), m(k);
        ll l = 1;
        for (int i = 0; i < k; i++) { m[i] = 1 + rng() % 12; a[i] = (ll)(rng() % 40) - 10; l = l / std::gcd(l, m[i]) * m[i]; }
        ll brute = -1;
        for (ll x = 0; x < l && brute < 0; x++) {
            bool ok = true;
            for (int i = 0; i < k; i++) if (x % m[i] != norm(a[i], m[i])) { ok = false; break; }
            if (ok) brute = x;
        }
        auto r = crt(a, m);
        if (brute < 0) CHECK(r.first == -1 && r.second == -1, "hệ phải vô nghiệm (it=%d)", it);
        else CHECK(r.first == brute && r.second == l, "hệ it=%d: được {%lld, %lld}, đúng là {%lld, %lld}", it, r.first, r.second, brute, l);
    }
    CHECK(crt({}, {}) == make_pair(0LL, 1LL), "hệ rỗng phải là {0, 1}");

    // 3) mô-đun lớn: nghiệm đã gieo sẵn (luôn có nghiệm), kiểm bằng __int128
    for (int it = 0; it < 20000; it++) {
        ll m1 = 1 + rng() % 2000000000ULL, m2 = 1 + rng() % 2000000000ULL;
        if (it % 3 == 0) { ll d = 1 + rng() % 5000; m1 = m1 / d * d + d; m2 = m2 / d * d + d; }     // ép gcd lớn
        ll g = std::gcd(m1, m2);
        i128 lcm = (i128)(m1 / g) * m2;
        ll x = (ll)(rng() % (unsigned long long)lcm);                                              // nghiệm gieo sẵn
        auto r = crt_merge(x % m1, m1, x % m2, m2);
        CHECK(r.second == (ll)lcm && r.first == x, "nghiệm gieo sẵn m1=%lld m2=%lld", m1, m2);
        // thêm nhiễu: a2 lệch 1 → vô nghiệm khi g > 1 và (a2 - a1) không chia hết cho g
        ll a1 = rng() % m1, a2 = rng() % m2;
        auto s = crt_merge(a1, m1, a2, m2);
        if ((a2 - a1) % g != 0) CHECK(s.first == -1, "phải vô nghiệm m1=%lld m2=%lld", m1, m2);
        else CHECK(s.first >= 0 && s.first < s.second && s.first % m1 == a1 && s.first % m2 == a2 && s.second == (ll)lcm, "nghiệm sai m1=%lld m2=%lld", m1, m2);
    }
    // 4) nhiều mô-đun đôi một nguyên tố cùng nhau: tích ~10^18
    for (vector<ll> mods : {vector<ll>{1000000007, 998244353, 2, 3}, vector<ll>{1000003, 999983, 999979, 2}, vector<ll>{7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47}}) {
        i128 total = 1;
        for (ll mm : mods) total *= mm;
        for (int it = 0; it < 2000; it++) {
            ll x = (ll)(rng() % (unsigned long long)total);
            vector<ll> a;
            for (ll mm : mods) a.push_back(x % mm);
            auto r = crt(a, mods);
            CHECK(r.first == x && (i128)r.second == total, "mô-đun nguyên tố cùng nhau, x=%lld", x);
        }
    }
    puts("OK");
}
