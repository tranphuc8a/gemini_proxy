// @TEMPLATE

// Thử segmentsIntersect / segmentIntersectionKind / intersectionPoint với nhà tiên tri dùng số học __int128 và tham số t, u:
//  (1) VÉT CẠN MỌI bộ bốn điểm trong lưới 5 x 5 (25^4 = 390625 trường hợp: gồm đoạn suy biến, đầu mút trùng, thẳng hàng chồng lấn / rời nhau);
//  (2) toạ độ lớn có cấu trúc: bốn điểm trên cùng một đường thẳng (hướng nhỏ nhân tỉ lệ 1e7), điểm lệch 1 đơn vị, và toàn miền ±1e9;
//  (3) giao điểm tính được nằm trên cả hai đường thẳng, ví dụ trong mục.
#define CHECK(cond, ...) do { if (!(cond)) { printf("SAI: "); printf(__VA_ARGS__); printf("\n"); return 1; } } while (0)

typedef long long ll;
typedef __int128 LL;

static LL cr(LL ax, LL ay, LL bx, LL by) { return ax * by - ay * bx; }
static bool eq(const SgPt& a, const SgPt& b) { return a.x == b.x && a.y == b.y; }
static bool onSeg(const SgPt& p, const SgPt& a, const SgPt& b) {
    if (cr(b.x - a.x, b.y - a.y, p.x - a.x, p.y - a.y) != 0) return false;
    return (LL)(p.x - a.x) * (p.x - b.x) + (LL)(p.y - a.y) * (p.y - b.y) <= 0;      // p nằm giữa a và b
}
static bool oracle(const SgPt& a, const SgPt& b, const SgPt& c, const SgPt& d) {
    if (eq(a, b)) return onSeg(a, c, d);
    if (eq(c, d)) return onSeg(c, a, b);
    LL rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y;
    LL den = cr(rx, ry, sx, sy), qx = c.x - a.x, qy = c.y - a.y;
    if (den == 0) {
        if (cr(qx, qy, rx, ry) != 0) return false;                                  // song song, không thẳng hàng
        return onSeg(a, c, d) || onSeg(b, c, d) || onSeg(c, a, b) || onSeg(d, a, b);
    }
    LL tn = cr(qx, qy, sx, sy), un = cr(qx, qy, rx, ry);                            // a + t r = c + u s, t = tn/den, u = un/den
    if (den < 0) { den = -den; tn = -tn; un = -un; }
    return tn >= 0 && tn <= den && un >= 0 && un <= den;
}
static int kindOracle(const SgPt& a, const SgPt& b, const SgPt& c, const SgPt& d) {
    if (!oracle(a, b, c, d)) return 0;
    if (eq(a, b) || eq(c, d)) return 1;
    LL rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y;
    if (cr(rx, ry, sx, sy) != 0) return 1;                                          // không song song: đúng một điểm
    LL t0 = (LL)(c.x - a.x) * rx + (LL)(c.y - a.y) * ry, t1 = (LL)(d.x - a.x) * rx + (LL)(d.y - a.y) * ry, rr = rx * rx + ry * ry;
    LL lo = max(min(t0, t1), (LL)0), hi = min(max(t0, t1), rr);                     // chiếu lên AB: giao [lo, hi] với [0, rr]
    return lo < hi ? 2 : 1;
}

// → "" nếu khớp nhà tiên tri
static string compare(const SgPt& a, const SgPt& b, const SgPt& c, const SgPt& d) {
    bool g = segmentsIntersect(a, b, c, d);
    if (g != oracle(a, b, c, d)) return "segmentsIntersect sai";
    if (g != segmentsIntersect(c, d, a, b) || g != segmentsIntersect(b, a, d, c)) return "không đối xứng khi đổi chỗ đoạn / đầu mút";
    if (segmentIntersectionKind(a, b, c, d) != kindOracle(a, b, c, d)) return "segmentIntersectionKind sai";
    return "";
}

int main() {
    mt19937_64 rng(20261017);
    // (1) vét cạn lưới 5 x 5
    {
        vector<SgPt> g;
        for (int x = 0; x < 5; x++)
            for (int y = 0; y < 5; y++) g.push_back(SgPt{x, y});
        long long yes = 0, point = 0, overlap = 0;
        for (auto& a : g) for (auto& b : g) for (auto& c : g) for (auto& d : g) {
            string err = compare(a, b, c, d);
            CHECK(err.empty(), "%s: A(%lld,%lld) B(%lld,%lld) C(%lld,%lld) D(%lld,%lld)", err.c_str(), a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y);
            int kind = segmentIntersectionKind(a, b, c, d);
            yes += kind > 0; point += kind == 1; overlap += kind == 2;
            if (kind > 0) {                                                         // giao điểm tính được phải nằm trên cả hai đường thẳng
                long double px, py;
                if (intersectionPoint(a, b, c, d, px, py)) {
                    long double e1 = (px - a.x) * (b.y - a.y) - (py - a.y) * (b.x - a.x);
                    long double e2 = (px - c.x) * (d.y - c.y) - (py - c.y) * (d.x - c.x);
                    CHECK(fabsl(e1) < 1e-9L && fabsl(e2) < 1e-9L, "giao điểm lệch (%.6Lf, %.6Lf)", px, py);
                    CHECK(px >= min(a.x, b.x) - 1e-9L && px <= max(a.x, b.x) + 1e-9L && py >= min(a.y, b.y) - 1e-9L && py <= max(a.y, b.y) + 1e-9L, "giao điểm ngoài đoạn");
                }
            }
        }
        CHECK(yes > 10000 && point > 10000 && overlap > 1000, "bộ dữ liệu phải có đủ cả ba loại: %lld %lld %lld", yes, point, overlap);
    }
    // (2a) bốn điểm trên cùng một đường thẳng, toạ độ lớn (tới ~6e8)
    for (int iter = 0; iter < 200000; iter++) {
        ll px = (ll)(rng() % 200000001ULL) - 100000000LL, py = (ll)(rng() % 200000001ULL) - 100000000LL;
        ll dx = (ll)(rng() % 11) - 5, dy = (ll)(rng() % 11) - 5;
        if (dx == 0 && dy == 0) dx = 1;
        auto pt = [&](int k) { return SgPt{px + (ll)k * dx * 10000000LL, py + (ll)k * dy * 10000000LL}; };
        int k[4];
        for (int& v : k) v = (int)(rng() % 11) - 5;
        string err = compare(pt(k[0]), pt(k[1]), pt(k[2]), pt(k[3]));
        CHECK(err.empty(), "thẳng hàng lớn iter=%d: %s", iter, err.c_str());
    }
    // (2b) hai đoạn có chung một điểm (đầu mút hoặc điểm trong) và hướng ngẫu nhiên; một đầu mút lệch 1 đơn vị
    for (int iter = 0; iter < 200000; iter++) {
        auto rnd = [&](ll range) { return (ll)(rng() % (2 * range + 1)) - range; };
        SgPt a{4 * rnd(100000000), 4 * rnd(100000000)}, b{4 * rnd(100000000), 4 * rnd(100000000)};   // bội của 4 để chia tư chính xác
        // c nằm CHÍNH XÁC trên AB (k/4 của đoạn, k = 0..4, gồm cả hai đầu mút); d ngẫu nhiên
        ll k = rng() % 5;
        SgPt c{a.x + (b.x - a.x) / 4 * k, a.y + (b.y - a.y) / 4 * k};
        SgPt d{rnd(400000000), rnd(400000000)};
        if (rng() % 3 == 0) c.x += (ll)(rng() % 3) - 1;                               // lệch ngang -1, 0, +1
        string err = compare(a, b, c, d);
        CHECK(err.empty(), "chung điểm iter=%d: %s", iter, err.c_str());
    }
    // (2c) toàn miền ±1e9
    for (int iter = 0; iter < 200000; iter++) {
        auto rnd = [&]() { return (ll)(rng() % 2000000001ULL) - 1000000000LL; };
        SgPt a{rnd(), rnd()}, b{rnd(), rnd()}, c{rnd(), rnd()}, d{rnd(), rnd()};
        string err = compare(a, b, c, d);
        CHECK(err.empty(), "toàn miền iter=%d: %s", iter, err.c_str());
    }
    // (3) ví dụ trong mục và hai đường chéo của hình vuông lớn
    {
        SgPt A{0, 0}, B{4, 4};
        CHECK(segmentIntersectionKind(A, B, SgPt{0, 4}, SgPt{4, 0}) == 1, "hai đường chéo cắt nhau");
        CHECK(segmentIntersectionKind(A, B, SgPt{5, 5}, SgPt{8, 8}) == 0, "thẳng hàng nhưng rời nhau");
        CHECK(segmentIntersectionKind(A, B, SgPt{2, 2}, SgPt{6, 6}) == 2, "thẳng hàng chồng lấn");
        CHECK(segmentIntersectionKind(A, B, SgPt{4, 4}, SgPt{6, 6}) == 1, "chạm đúng một đầu mút");
        long double px, py;
        CHECK(intersectionPoint(A, B, SgPt{0, 4}, SgPt{4, 0}, px, py) && fabsl(px - 2) < 1e-12L && fabsl(py - 2) < 1e-12L, "giao điểm (2,2)");
        CHECK(!intersectionPoint(A, B, SgPt{0, 1}, SgPt{4, 5}, px, py), "song song");
        const ll M = 1000000000LL;
        SgPt p1{-M, -M}, p2{M, M}, p3{-M, M}, p4{M, -M};
        CHECK(segmentsIntersect(p1, p2, p3, p4) && segmentIntersectionKind(p1, p2, p3, p4) == 1, "hai đường chéo ±1e9");
        CHECK(intersectionPoint(p1, p2, p3, p4, px, py) && fabsl(px) < 1e-6L && fabsl(py) < 1e-6L, "giao điểm (0,0) ở toạ độ lớn");
        CHECK(!segmentsIntersect(SgPt{-M, -M}, SgPt{M, M - 1}, SgPt{-M, -M + 1}, SgPt{M, M}), "gần song song, rời nhau");
    }
    puts("OK");
    return 0;
}
