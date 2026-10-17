// @TEMPLATE

// Thử discrete_log (BSGS mở rộng): vét cạn mọi (a, b, m) với m ≤ 70 (có a, b âm / ≥ m, gcd(a, m) > 1, a = 0, m = 1) so với x nhỏ nhất tìm bằng
// cách tính từng luỹ thừa; rồi modulo nguyên tố 10^9 + 7 (b = a^x phải ra r ≤ x và a^r ≡ b), trường hợp vô nghiệm (a là thặng dư bậc hai,
// b không), modulo hợp số ~10^12 và mô-đun có luỹ thừa của 2, 3 (gcd > 1) với nghiệm gieo sẵn.
typedef long long ll;
typedef __int128 i128;
typedef unsigned long long u64;

#define CHECK(cond, ...) do { if (!(cond)) { printf("SAI: " __VA_ARGS__); printf("\n"); return 1; } } while (0)

static ll mulm(ll a, ll b, ll m) { return (ll)((i128)a * b % m); }
static ll powm(ll a, u64 e, ll m) {
    ll r = 1 % m;
    a = ((a % m) + m) % m;
    while (e) { if (e & 1) r = mulm(r, a, m); a = mulm(a, a, m); e >>= 1; }
    return r;
}

int main() {
    mt19937_64 rng(20261017);

    // 1) vét cạn modulo nhỏ: x nhỏ nhất trong [0, 3m + 10] (tiền chu kỳ ≤ log2 m, chu kỳ ≤ m)
    for (ll m = 1; m <= 70; m++)
        for (ll a = -3; a <= m + 3; a++)
            for (ll b = -3; b <= m + 3; b++) {
                ll am = ((a % m) + m) % m, bm = ((b % m) + m) % m, cur = 1 % m, brute = -1;
                for (ll x = 0; x <= 3 * m + 10; x++) {
                    if (cur == bm) { brute = x; break; }
                    cur = cur * am % m;
                }
                ll r = discrete_log(a, b, m);
                CHECK(r == brute, "discrete_log(a=%lld, b=%lld, m=%lld) = %lld, đúng là %lld", a, b, m, r, brute);
            }

    // 2) modulo nguyên tố 10^9 + 7 và 998244353: nghiệm gieo sẵn
    for (ll p : {1000000007LL, 998244353LL}) {
        for (int it = 0; it < 60; it++) {
            ll a = 2 + (ll)(rng() % (u64)(p - 3));
            u64 x = rng() % (u64)p;
            ll b = powm(a, x, p);
            ll r = discrete_log(a, b, p);
            CHECK(r >= 0 && (u64)r <= x, "r phải ≤ x gieo (a=%lld, p=%lld, x=%llu, r=%lld)", a, p, x, r);
            CHECK(powm(a, (u64)r, p) == b, "a^r != b (a=%lld, p=%lld)", a, p);
        }
        // vô nghiệm: a = c² là thặng dư bậc hai nên a^x cũng vậy; b không phải thặng dư
        for (int it = 0; it < 25; it++) {
            ll c = 2 + (ll)(rng() % (u64)(p - 3)), a = mulm(c, c, p), b = 2 + (ll)(rng() % (u64)(p - 3));
            if (powm(b, (u64)((p - 1) / 2), p) == 1) continue;            // b là thặng dư: bỏ
            CHECK(discrete_log(a, b, p) == -1, "phải vô nghiệm (a=%lld, b=%lld, p=%lld)", a, b, p);
        }
    }
    // 3) modulo hợp số ~10^12, a nguyên tố cùng nhau
    for (int it = 0; it < 4; it++) {
        ll m = 999999999989LL - (ll)(rng() % 1000) * 2;                   // hợp số hay nguyên tố đều được
        ll a = 3 + (ll)(rng() % 1000000);
        if (std::gcd(a, m) != 1) continue;
        u64 x = rng() % 5000000;
        ll b = powm(a, x, m);
        ll r = discrete_log(a, b, m);
        CHECK(r >= 0 && (u64)r <= x && powm(a, (u64)r, m) == b, "m ~ 1e12 (a=%lld, m=%lld, x=%llu, r=%lld)", a, m, x, r);
    }
    // 4) gcd(a, m) > 1 với m lớn: nghiệm gieo sẵn nhỏ, tìm bằng vét cạn từng luỹ thừa
    for (int it = 0; it < 1200; it++) {
        ll p3 = 1;
        for (u64 t = rng() % 8; t > 0; t--) p3 *= 3;
        ll m = (1LL << (rng() % 13)) * p3 * (ll)(1 + rng() % 200);
        if (m < 2) m = 2;
        ll a = 2 + (ll)(rng() % 100);
        u64 x = rng() % 200;
        ll b = powm(a, x, m);
        ll brute = -1, cur = 1 % m;
        for (u64 t = 0; t < 400 && brute < 0; t++) { if (cur == b) brute = (ll)t; cur = mulm(cur, a, m); }
        ll r = discrete_log(a, b, m);
        CHECK(r >= 0 && r == brute, "gcd > 1: a=%lld b=%lld m=%lld: được %lld, vét cạn %lld (x gieo %llu)", a, b, m, r, brute, x);
    }
    puts("OK");
}
