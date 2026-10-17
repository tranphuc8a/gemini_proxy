// @TEMPLATE

// Thử fft_multiply: so với nhân đa thức O(N²) (số nhỏ, có hệ số âm; N = 2000 với hệ số tới 10^5 → kết quả tới ~10^13), rồi các đa thức dài
// (2^17 và 2^19 hệ số) kiểm bằng tính giá trị tại điểm ngẫu nhiên modulo p (Schwartz–Zippel), cùng các ca biên (rỗng, độ dài 1, đúng luỹ thừa 2).
typedef long long ll;
typedef __int128 i128;

#define CHECK(cond, ...) do { if (!(cond)) { printf("SAI: " __VA_ARGS__); printf("\n"); return 1; } } while (0)

static const ll P = 1000000007LL;

static vector<ll> naive(const vector<ll>& a, const vector<ll>& b) {
    if (a.empty() || b.empty()) return {};
    vector<ll> r(a.size() + b.size() - 1, 0);
    for (size_t i = 0; i < a.size(); i++)
        for (size_t j = 0; j < b.size(); j++) r[i + j] += a[i] * b[j];
    return r;
}
static ll eval(const vector<ll>& poly, ll x) {            // Horner modulo P; hệ số có thể âm
    ll r = 0;
    for (size_t i = poly.size(); i-- > 0;) r = (r * x + ((poly[i] % P) + P) % P) % P;
    return r;
}

int main() {
    mt19937_64 rng(20261017);

    // 1) nhỏ, có hệ số âm
    for (int it = 0; it < 3000; it++) {
        int na = rng() % 40, nb = rng() % 40;
        vector<ll> a(na), b(nb);
        for (auto& v : a) v = (ll)(rng() % 2001) - 1000;
        for (auto& v : b) v = (ll)(rng() % 2001) - 1000;
        CHECK(fft_multiply(a, b) == naive(a, b), "nhỏ it=%d (na=%d, nb=%d)", it, na, nb);
    }
    // 2) ca biên về độ dài
    for (int na = 1; na <= 70; na++)
        for (int nb : {1, 2, 3, 63, 64, 65}) {
            vector<ll> a(na), b(nb);
            for (auto& v : a) v = (ll)(rng() % 100);
            for (auto& v : b) v = (ll)(rng() % 100);
            CHECK(fft_multiply(a, b) == naive(a, b), "độ dài %d × %d", na, nb);
        }
    CHECK(fft_multiply({}, {1, 2}).empty() && fft_multiply({3}, {}).empty(), "đa thức rỗng");
    CHECK((fft_multiply({7}, {6}) == vector<ll>{42}), "1 × 1");
    CHECK((fft_multiply({1, 2, 3}, {4, 5}) == vector<ll>{4, 13, 22, 15}), "ví dụ trong tài liệu");
    CHECK((fft_multiply({0, 0, 0}, {5, 5}) == vector<ll>{0, 0, 0, 0}), "toàn 0");

    // 3) trung bình: N = 2000, hệ số tới 10^5 (kết quả tới 2·10^13) so với O(N²)
    for (int it = 0; it < 3; it++) {
        vector<ll> a(2000), b(1500);
        for (auto& v : a) v = (ll)(rng() % 200001) - 100000;
        for (auto& v : b) v = (ll)(rng() % 200001) - 100000;
        CHECK(fft_multiply(a, b) == naive(a, b), "N = 2000, hệ số 10^5");
    }
    {   // hệ số 0 / 1 rất lớn nhưng đúng chỗ: đa thức toàn 10^5 → hệ số kết quả = 2000 · 10^10 = 2·10^13
        vector<ll> a(2000, 100000), b(2000, 100000);
        CHECK(fft_multiply(a, b) == naive(a, b), "toàn 10^5");
    }

    // 4) dài: kiểm tại điểm ngẫu nhiên
    struct Big { int na, nb; ll maxv; };
    for (Big t : {Big{131072, 131072, 99}, Big{262144, 262144, 1000}, Big{524288, 500000, 1000}}) {
        vector<ll> a(t.na), b(t.nb);
        for (auto& v : a) v = (ll)(rng() % (t.maxv + 1));
        for (auto& v : b) v = (ll)(rng() % (t.maxv + 1));
        auto r = fft_multiply(a, b);
        CHECK(r.size() == a.size() + b.size() - 1, "độ dài kết quả");
        for (int k = 0; k < 3; k++) {
            ll x = 2 + rng() % (P - 3);
            CHECK(eval(r, x) == eval(a, x) * eval(b, x) % P, "kiểm điểm ngẫu nhiên (na=%d, nb=%d, maxv=%lld)", t.na, t.nb, t.maxv);
        }
    }
    puts("OK");
}
