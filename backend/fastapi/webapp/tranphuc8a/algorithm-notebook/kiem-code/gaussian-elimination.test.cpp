// @TEMPLATE

// Thử gauss_real và gauss_mod. Số thực: hệ nguyên nhỏ ngẫu nhiên (có hệ suy biến, thừa/thiếu phương trình), loại nghiệm (0/1/2) so với hạng tính
// độc lập (modulo số nguyên tố lớn — đúng vì định thức nhỏ), nghiệm trả về phải thoả hệ. Modulo: vét cạn mọi vector trên GF(p) với p = 2, 3, 5, 7
// (đếm nghiệm: 0, 1, nhiều), rồi p lớn với nghiệm gieo sẵn, hệ mâu thuẫn, hệ thiếu phương trình.
typedef long long ll;
typedef __int128 i128;

#define CHECK(cond, ...) do { if (!(cond)) { printf("SAI: " __VA_ARGS__); printf("\n"); return 1; } } while (0)

// hạng của ma trận (cột đầu cols) modulo P bằng khử đơn giản — độc lập với mẫu
static int rank_mod(vector<vector<ll>> a, int cols, ll P) {
    int n = a.size(), rk = 0;
    for (auto& row : a) for (auto& v : row) v = ((v % P) + P) % P;
    auto pw = [&](ll b, ll e) { ll r = 1; while (e) { if (e & 1) r = r * b % P; b = b * b % P; e >>= 1; } return r; };
    for (int c = 0; c < cols && rk < n; c++) {
        int s = -1;
        for (int i = rk; i < n; i++) if (a[i][c]) { s = i; break; }
        if (s < 0) continue;
        swap(a[s], a[rk]);
        ll inv = pw(a[rk][c], P - 2);
        for (int i = rk + 1; i < n; i++) {
            ll f = a[i][c] * inv % P;
            for (int j = c; j < (int)a[i].size(); j++) a[i][j] = ((a[i][j] - f * a[rk][j]) % P + P) % P;
        }
        rk++;
    }
    return rk;
}

int main() {
    mt19937_64 rng(20261017);

    // 1) số thực
    for (int it = 0; it < 20000; it++) {
        int n = 1 + rng() % 5, m = 1 + rng() % 5;
        vector<vector<double>> a(n, vector<double>(m + 1));
        vector<vector<ll>> ai(n, vector<ll>(m + 1));
        vector<ll> xt(m);
        for (auto& v : xt) v = (ll)(rng() % 7) - 3;
        for (int i = 0; i < n; i++) {
            for (int j = 0; j < m; j++) { ai[i][j] = (ll)(rng() % 7) - 3; if (it % 4 == 0 && rng() % 2) ai[i][j] = 0; }
            if (i > 0 && rng() % 4 == 0) for (int j = 0; j < m; j++) ai[i][j] = ai[rng() % i][j] * (ll)((rng() % 3) - 1) ;   // hàng phụ thuộc
            ll s = 0;
            for (int j = 0; j < m; j++) s += ai[i][j] * xt[j];
            ai[i][m] = (it % 2 == 0) ? s : (ll)(rng() % 7) - 3;                                                            // nửa số hệ nhất quán sẵn
            for (int j = 0; j <= m; j++) a[i][j] = (double)ai[i][j];
        }
        int rA = rank_mod(ai, m, 1000000007LL);
        vector<vector<ll>> aug = ai;
        int rAug = rank_mod(aug, m + 1, 1000000007LL);
        int expect = rA < rAug ? 0 : (rA == m ? 1 : 2);
        vector<double> x;
        int got = gauss_real(a, m, x);
        CHECK(got == expect, "loại nghiệm it=%d: được %d, đúng là %d (n=%d, m=%d)", it, got, expect, n, m);
        if (got >= 1) {
            CHECK((int)x.size() == m, "kích thước x");
            for (int i = 0; i < n; i++) {
                double s = 0;
                for (int j = 0; j < m; j++) s += a[i][j] * x[j];
                CHECK(fabs(s - a[i][m]) < 1e-6, "nghiệm không thoả phương trình %d (it=%d)", i, it);
            }
        }
        if (got == 1 && it % 2 == 0) for (int j = 0; j < m; j++) CHECK(fabs(x[j] - xt[j]) < 1e-6, "nghiệm duy nhất khác nghiệm gieo (it=%d)", it);
    }
    {   // pivot rất nhỏ ở đầu cột: phải chọn hàng khác
        vector<vector<double>> a = {{1e-12, 1, 1}, {1, 1, 2}};
        vector<double> x;
        CHECK(gauss_real(a, 2, x) == 1 && fabs(x[0] - 1) < 1e-6 && fabs(x[1] - 1) < 1e-6, "pivot nhỏ");
    }
    {   // hệ n×n lớn hơn: 60×60 ngẫu nhiên, nghiệm gieo sẵn
        int n = 60;
        vector<vector<double>> a(n, vector<double>(n + 1));
        vector<double> xt(n);
        for (auto& v : xt) v = (double)(rng() % 2001) / 100.0 - 10.0;
        for (int i = 0; i < n; i++) {
            double s = 0;
            for (int j = 0; j < n; j++) { a[i][j] = (double)(rng() % 2001) / 100.0 - 10.0; s += a[i][j] * xt[j]; }
            a[i][n] = s;
        }
        vector<double> x;
        CHECK(gauss_real(a, n, x) == 1, "60×60 phải có nghiệm duy nhất");
        for (int j = 0; j < n; j++) CHECK(fabs(x[j] - xt[j]) < 1e-5, "60×60: x[%d] lệch %g", j, fabs(x[j] - xt[j]));
    }

    // 2) modulo nhỏ: đếm nghiệm bằng vét cạn
    for (ll p : {2LL, 3LL, 5LL, 7LL})
        for (int it = 0; it < 3000; it++) {
            int n = 1 + rng() % 4, m = 1 + rng() % 4;
            vector<vector<ll>> a(n, vector<ll>(m + 1));
            for (auto& row : a) for (auto& v : row) v = (ll)(rng() % (3 * p)) - p;                          // có số âm và ≥ p
            int total = 1;
            for (int j = 0; j < m; j++) total *= (int)p;
            int cnt = 0;
            for (int code = 0; code < total; code++) {
                int c = code;
                vector<ll> v(m);
                for (int j = 0; j < m; j++) { v[j] = c % p; c /= (int)p; }
                bool ok = true;
                for (int i = 0; i < n && ok; i++) {
                    ll s = 0;
                    for (int j = 0; j < m; j++) s += a[i][j] * v[j];
                    ok = (((s - a[i][m]) % p) + p) % p == 0;
                }
                if (ok) cnt++;
            }
            vector<ll> x;
            int got = gauss_mod(a, m, p, x);
            int expect = cnt == 0 ? 0 : cnt == 1 ? 1 : 2;
            CHECK(got == expect, "mod %lld: loại nghiệm được %d, vét cạn %d (số nghiệm %d)", p, got, expect, cnt);
            if (got >= 1) {
                for (int i = 0; i < n; i++) {
                    ll s = 0;
                    for (int j = 0; j < m; j++) s += a[i][j] * x[j];
                    CHECK((((s - a[i][m]) % p) + p) % p == 0, "nghiệm mod %lld không thoả phương trình %d", p, i);
                }
            }
        }

    // 3) modulo lớn: nghiệm gieo sẵn, mâu thuẫn, thiếu phương trình
    for (ll P : {1000000007LL, 998244353LL}) {
        for (int it = 0; it < 300; it++) {
            int n = 1 + rng() % 8, m = 1 + rng() % 8;
            vector<vector<ll>> a(n, vector<ll>(m + 1));
            vector<ll> xt(m);
            for (auto& v : xt) v = rng() % P;
            for (int i = 0; i < n; i++) {
                ll s = 0;
                for (int j = 0; j < m; j++) { a[i][j] = (ll)(rng() % (2 * (unsigned long long)P)) - P; s = (s + ((a[i][j] % P + P) % P) * xt[j]) % P; }
                a[i][m] = s;
            }
            vector<ll> x;
            int got = gauss_mod(a, m, P, x);
            CHECK(got >= 1, "nghiệm gieo sẵn phải có nghiệm (P=%lld)", P);
            for (int i = 0; i < n; i++) {
                ll s = 0;
                for (int j = 0; j < m; j++) s = (s + ((a[i][j] % P + P) % P) * x[j]) % P;
                CHECK(s == a[i][m], "nghiệm mod lớn không thoả (P=%lld)", P);
            }
            if (n == m && got == 1) for (int j = 0; j < m; j++) CHECK(x[j] == xt[j], "nghiệm duy nhất phải là nghiệm gieo");
            if (n < m) CHECK(got == 2, "thiếu phương trình phải vô số nghiệm");
            // mâu thuẫn: thêm một hàng bằng hàng đầu nhưng lệch vế phải
            vector<vector<ll>> b = a;
            b.push_back(a[0]);
            b.back()[m] = (b.back()[m] + 1) % P;
            CHECK(gauss_mod(b, m, P, x) == 0, "hệ mâu thuẫn phải vô nghiệm (P=%lld)", P);
        }
    }
    puts("OK");
}
