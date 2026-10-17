// @TEMPLATE

// Thử gcd / lcm / Euclid mở rộng / Diophantine: so với định nghĩa (vét cạn ước chung, vét cạn nghiệm) trên mọi cặp nhỏ (có số âm và 0),
// rồi kiểm đẳng thức Bezout bằng __int128 trên số cỡ 10^18 và các cặp Fibonacci liên tiếp (độ sâu đệ quy lớn nhất).
typedef __int128 i128;

#define CHECK(cond, ...) do { if (!(cond)) { printf("SAI: " __VA_ARGS__); printf("\n"); return 1; } } while (0)

int main() {
    mt19937_64 rng(20261017);

    // 1) mọi cặp nhỏ
    for (long long a = -60; a <= 60; a++)
        for (long long b = -60; b <= 60; b++) {
            long long bg = 0;
            for (long long d = 1; d <= max(llabs(a), llabs(b)); d++)
                if (a % d == 0 && b % d == 0) bg = d;
            CHECK(gcd_ll(a, b) == bg, "gcd(%lld, %lld)", a, b);
            long long bl = (a == 0 || b == 0) ? 0 : llabs(a / bg * b);
            CHECK(lcm_ll(a, b) == bl, "lcm(%lld, %lld)", a, b);
            long long x, y;
            long long g = ext_gcd(a, b, x, y);
            long long lim = max(max(llabs(a), llabs(b)), 1LL);
            CHECK(g == bg, "ext_gcd g (%lld, %lld)", a, b);
            CHECK((i128)a * x + (i128)b * y == g, "Bezout (%lld, %lld)", a, b);
            CHECK(llabs(x) <= lim && llabs(y) <= lim, "x, y quá lớn (%lld, %lld)", a, b);
        }

    // 2) Diophantine nhỏ: so với vét cạn x trong [-300, 300]
    for (long long a = -9; a <= 9; a++)
        for (long long b = -9; b <= 9; b++)
            for (long long c = -30; c <= 30; c++) {
                bool exist = false;
                for (long long t = -300; t <= 300 && !exist; t++)
                    exist = (b != 0) ? ((c - a * t) % b == 0) : (c - a * t == 0);
                long long x = 0, y = 0;
                bool ok = diophantine(a, b, c, x, y);
                CHECK(ok == exist, "tồn tại nghiệm a=%lld b=%lld c=%lld", a, b, c);
                if (ok) {
                    CHECK((i128)a * x + (i128)b * y == c, "nghiệm sai a=%lld b=%lld c=%lld", a, b, c);
                    long long g = gcd_ll(a, b);
                    if (b != 0) CHECK(x >= 0 && x < llabs(b / g), "x không chuẩn hoá a=%lld b=%lld c=%lld", a, b, c);
                }
            }

    // 3) số lớn: Bezout bằng __int128
    for (int it = 0; it < 30000; it++) {
        long long lim = it % 3 == 0 ? (long long)4e18 : it % 3 == 1 ? (long long)1e18 : 1000000LL;
        long long a = (long long)(rng() % (2 * (unsigned long long)lim + 1)) - lim;
        long long b = (long long)(rng() % (2 * (unsigned long long)lim + 1)) - lim;
        if (it % 7 == 0 && rng() % 5 == 0) b = 0;
        long long x, y;
        long long g = ext_gcd(a, b, x, y);
        CHECK(g == gcd_ll(a, b), "gcd lớn");
        CHECK((i128)a * x + (i128)b * y == g, "Bezout lớn it=%d", it);
        long long m = max(max(llabs(a), llabs(b)), 1LL);
        CHECK(llabs(x) <= m && llabs(y) <= m, "x, y vượt max(|a|,|b|) it=%d", it);
    }
    // cặp Fibonacci liên tiếp: số bước nhiều nhất
    {
        vector<long long> f = {0, 1};
        while (f.size() < 92) f.push_back(f[f.size() - 1] + f[f.size() - 2]);   // F(91) ~ 4.66e18
        for (size_t i = 2; i + 1 < f.size(); i++) {
            long long x, y;
            long long g = ext_gcd(f[i + 1], f[i], x, y);
            CHECK(g == 1 && (i128)f[i + 1] * x + (i128)f[i] * y == 1, "Fibonacci %zu", i);
        }
    }

    // 4) Diophantine lớn |a|, |b|, |c| <= 1e18
    for (int it = 0; it < 30000; it++) {
        long long lim = it % 2 ? (long long)1e18 : 1000000000LL;
        long long a = (long long)(rng() % (2 * (unsigned long long)lim + 1)) - lim;
        long long b = (long long)(rng() % (2 * (unsigned long long)lim + 1)) - lim;
        if (it % 11 == 0) { long long d = 1 + rng() % 1000; a = a / d * d; b = b / d * d; }   // ép g > 1
        long long g = gcd_ll(a, b);
        if (g == 0) continue;
        long long kmax = lim / g - 1;
        long long k = kmax > 0 ? (long long)(rng() % (2 * (unsigned long long)kmax + 1)) - kmax : 0;
        long long c = g * k;
        long long x = 0, y = 0;
        CHECK(diophantine(a, b, c, x, y), "phải có nghiệm a=%lld b=%lld c=%lld", a, b, c);
        CHECK((i128)a * x + (i128)b * y == c, "nghiệm lớn sai a=%lld b=%lld c=%lld", a, b, c);
        if (b != 0) {
            CHECK(x >= 0 && x < llabs(b / g), "x lớn không chuẩn hoá");
            i128 y128 = ((i128)c - (i128)a * x) / b;
            CHECK(y128 == y, "y bị tràn a=%lld b=%lld c=%lld", a, b, c);
        }
        if (g > 1) {
            long long c2 = c + 1;                     // không chia hết cho g
            if (llabs(c2) <= lim) CHECK(!diophantine(a, b, c2, x, y), "phải vô nghiệm a=%lld b=%lld c=%lld", a, b, c2);
        }
    }
    puts("OK");
}
