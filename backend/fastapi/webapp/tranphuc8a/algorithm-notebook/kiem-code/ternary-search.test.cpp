// @TEMPLATE

// Thử ternaryMaxReal / ternaryMaxInt / peakBySlope: dãy nguyên tăng ngặt rồi giảm ngặt (có đỉnh đôi), hàm bậc hai trên miền lớn
// (bình phương tới 4e18), hàm số thực có đỉnh biết trước; so với vét cạn lấy max.
#define CHECK(cond, ...) do { if (!(cond)) { printf("SAI: "); printf(__VA_ARGS__); printf("\n"); return 1; } } while (0)

int main() {
    mt19937_64 rng(20261017);
    // 1) dãy ngẫu nhiên: đỉnh ở vị trí bất kỳ (kể cả đầu/cuối), có thể gồm hai điểm bằng nhau
    for (int iter = 0; iter < 30000; iter++) {
        int n = 1 + rng() % 30;
        int peak = rng() % n;
        bool twin = peak + 1 < n && rng() % 2;
        vector<long long> f(n);
        f[peak] = (long long)(rng() % 100);
        for (int i = peak - 1; i >= 0; i--) f[i] = f[i + 1] - 1 - (long long)(rng() % 5);
        int from = peak + 1;
        if (twin) { f[peak + 1] = f[peak]; from = peak + 2; }
        for (int i = from; i < n; i++) f[i] = f[i - 1] - 1 - (long long)(rng() % 5);
        auto g = [&](long long x) { return f[x]; };
        long long best = *max_element(f.begin(), f.end());
        long long x1 = ternaryMaxInt(0, n - 1, g), x2 = peakBySlope(0, n - 1, g);
        CHECK(x1 >= 0 && x1 < n && f[x1] == best, "ternaryMaxInt iter=%d n=%d peak=%d twin=%d", iter, n, peak, (int)twin);
        CHECK(x2 >= 0 && x2 < n && f[x2] == best, "peakBySlope iter=%d n=%d peak=%d twin=%d", iter, n, peak, (int)twin);
    }
    // 2) miền lớn: f(x) = -(x - c)^2 trên [-1e9, 1e9]; (x - c)^2 <= 4e18 vẫn vừa long long
    for (int iter = 0; iter < 300; iter++) {
        long long c = (long long)(rng() % 2000000001ULL) - 1000000000LL;
        auto f = [&](long long x) { return -(x - c) * (x - c); };
        CHECK(ternaryMaxInt(-1000000000LL, 1000000000LL, f) == c, "ternaryMaxInt miền lớn c=%lld", c);
        CHECK(peakBySlope(-1000000000LL, 1000000000LL, f) == c, "peakBySlope miền lớn c=%lld", c);
    }
    // 3) số thực
    for (int iter = 0; iter < 2000; iter++) {
        double a = (double)(rng() % 20001) / 100.0 - 100.0, b = (double)(rng() % 1000);
        double r = ternaryMaxReal(-100, 100, [&](double x) { return -(x - a) * (x - a) + b; });
        CHECK(fabs(r - a) < 1e-5, "bậc hai a=%.9f r=%.9f", a, r);
        double r2 = ternaryMaxReal(-100, 100, [&](double x) { return -fabs(x - a); });
        CHECK(fabs(r2 - a) < 1e-9, "|x - a| a=%.9f r=%.9f", a, r2);
        double r3 = ternaryMaxReal(-100, 100, [&](double x) { return -((x - a) * (x - a) * (x - a) * (x - a)); });   // đỉnh rất phẳng
        CHECK(fabs(r3 - a) < 1e-6, "bậc bốn a=%.9f r=%.9f", a, r3);
    }
    double r = ternaryMaxReal(0, 10, [](double x) { return x * exp(-x); });      // đỉnh tại x = 1
    CHECK(fabs(r - 1.0) < 1e-5, "x*exp(-x): %.9f", r);
    // cực tiểu của (x - 4)^2 + 1 bằng cách truyền -f
    double mn = ternaryMaxReal(-50, 50, [](double x) { return -((x - 4) * (x - 4) + 1); });
    CHECK(fabs(mn - 4.0) < 1e-5, "cực tiểu qua -f: %.9f", mn);
    // 4) ví dụ trong mục: f(x) = -(x-3)^2 + 10 trên [0, 10]
    auto fe = [](long long x) { return -(x - 3) * (x - 3) + 10; };
    CHECK(ternaryMaxInt(0, 10, fe) == 3 && peakBySlope(0, 10, fe) == 3, "ví dụ trong mục");
    // 5) một phần tử
    CHECK(ternaryMaxInt(5, 5, fe) == 5 && peakBySlope(5, 5, fe) == 5, "một phần tử");
    puts("OK");
    return 0;
}
