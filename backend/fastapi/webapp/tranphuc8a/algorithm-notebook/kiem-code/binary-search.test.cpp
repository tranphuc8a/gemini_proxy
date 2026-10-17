// @TEMPLATE

// Thử bsFirstTrue / bsLastTrue / lowerBoundIdx / upperBoundIdx / bsRealFirstTrue với std::lower_bound, std::upper_bound,
// công thức đóng và ca biên (mảng rỗng, miền rộng ±1e18, đáp án nằm ngoài miền, nhị phân trên đáp án, số thực).
#define CHECK(cond, ...) do { if (!(cond)) { printf("SAI: "); printf(__VA_ARGS__); printf("\n"); return 1; } } while (0)

int main() {
    mt19937_64 rng(20261017);
    // 1) trên mảng sắp xếp có nhiều giá trị trùng (kể cả rỗng)
    for (int iter = 0; iter < 20000; iter++) {
        int n = rng() % 12;
        vector<long long> a(n);
        for (auto& v : a) v = (long long)(rng() % 9) - 4;
        sort(a.begin(), a.end());
        for (long long x = -6; x <= 6; x++) {
            int lo = lowerBoundIdx(a, x), up = upperBoundIdx(a, x);
            CHECK(lo == (int)(lower_bound(a.begin(), a.end(), x) - a.begin()), "lowerBoundIdx iter=%d x=%lld", iter, x);
            CHECK(up == (int)(upper_bound(a.begin(), a.end(), x) - a.begin()), "upperBoundIdx iter=%d x=%lld", iter, x);
            CHECK(up - lo == (int)count(a.begin(), a.end(), x), "đếm số phần tử bằng x, iter=%d x=%lld", iter, x);
        }
    }
    {
        vector<long long> a = {1, 2, 2, 2, 5, 7, 7, 9};
        CHECK(lowerBoundIdx(a, 2) == 1 && upperBoundIdx(a, 2) == 4, "ví dụ trong mục");
    }
    // 2) ngưỡng t trên miền nhỏ: pred(x) = x >= t (đúng từ t trở đi) và pred(x) = x <= t (đúng tới t)
    for (int iter = 0; iter < 200000; iter++) {
        long long lo = (long long)(rng() % 2000000001ULL) - 1000000000LL;
        long long hi = lo + (long long)(rng() % 60);               // có thể rỗng (hi == lo)
        long long t = lo - 5 + (long long)(rng() % 70);
        long long r1 = bsFirstTrue(lo, hi, [&](long long x) { return x >= t; });
        long long e1 = t <= lo ? lo : (t >= hi ? hi : t);
        CHECK(r1 == e1, "bsFirstTrue lo=%lld hi=%lld t=%lld: %lld != %lld", lo, hi, t, r1, e1);
        long long r2 = bsLastTrue(lo, hi, [&](long long x) { return x <= t; });
        long long e2 = min(hi - 1, max(lo - 1, t));
        CHECK(r2 == e2, "bsLastTrue lo=%lld hi=%lld t=%lld: %lld != %lld", lo, hi, t, r2, e2);
    }
    // 3) miền rất rộng, không tràn khi tính mid
    for (int iter = 0; iter < 2000; iter++) {
        long long lo = -1000000000000000000LL, hi = 1000000000000000000LL;
        long long t = (long long)(rng() % 2000000000000000001ULL) - 1000000000000000000LL;
        long long r = bsFirstTrue(lo, hi, [&](long long x) { return x >= t; });
        CHECK(r == t, "miền rộng: %lld != %lld", r, t);
    }
    // 4) nhị phân trên đáp án: số nguyên t nhỏ nhất có t*t >= n (n tới 1e18, t tới 2e9 nên t*t <= 4e18 không tràn)
    for (int iter = 0; iter < 20000; iter++) {
        long long n = iter < 200 ? iter : (long long)(rng() % 1000000000000000001ULL);
        long long r = bsFirstTrue(0, 2000000001LL, [&](long long x) { return x * x >= n; });
        long long e = (long long)sqrtl((long double)n);
        while (e * e < n) e++;
        while (e > 0 && (e - 1) * (e - 1) >= n) e--;
        CHECK(r == e, "căn n=%lld: %lld != %lld", n, r, e);
    }
    // 5) không có đáp án: trả hi; mọi phần tử đều thoả: trả lo
    CHECK(bsFirstTrue(0, 10, [](long long) { return false; }) == 10, "không có đáp án");
    CHECK(bsFirstTrue(0, 10, [](long long) { return true; }) == 0, "mọi phần tử thoả");
    CHECK(bsFirstTrue(7, 7, [](long long) { return true; }) == 7, "miền rỗng");
    // 6) số thực
    double r = bsRealFirstTrue(0, 100, [](double x) { return x * x >= 2; });
    CHECK(fabs(r - sqrt(2.0)) < 1e-12, "căn 2 = %.15f", r);
    double big = 123456789012345678.0;
    double rb = bsRealFirstTrue(0, 1e18, [&](double x) { return x >= big; });
    CHECK(fabs(rb - big) <= 64, "số thực lớn: %.1f", rb);
    puts("OK");
    return 0;
}
