// @TEMPLATE

// Thử pointInPolygon bằng ba "nhà tiên tri" độc lập với tia ngang:
//  (a) đa giác hình sao quanh gốc toạ độ: tìm nêm góc chứa điểm rồi xét một cạnh duy nhất — thử MỌI điểm nguyên trong lưới, gồm cả biên;
//  (b) đa giác "histogram" (trục song song): phân loại theo ô vuông, biên theo kiểm tra thuộc đoạn;
//  (c) phép biến đổi giữ nguyên đáp án: đảo chiều, dịch vòng đỉnh, xoay 90°, lật gương;
// cùng các ca toạ độ ±1e9 (tích có hướng sát 8e18) và đa giác chữ L trong mục.
#define CHECK(cond, ...) do { if (!(cond)) { printf("SAI: "); printf(__VA_ARGS__); printf("\n"); return 1; } } while (0)

typedef long long ll;

// (a) đa giác sao quanh gốc, đỉnh theo thứ tự ngược chiều kim đồng hồ, mọi cross(v_i, v_{i+1}) > 0
static int starOracle(const vector<PipPt>& v, ll qx, ll qy) {
    if (qx == 0 && qy == 0) return 1;
    int n = v.size();
    for (int i = 0; i < n; i++) {
        const PipPt& a = v[i];
        const PipPt& b = v[(i + 1) % n];
        if (a.x * qy - a.y * qx >= 0 && qx * b.y - qy * b.x > 0) {      // nêm [a, b) chứa tia gốc → q
            ll c = (b.x - a.x) * (qy - a.y) - (b.y - a.y) * (qx - a.x);
            return c > 0 ? 1 : (c == 0 ? 2 : 0);
        }
    }
    return -1;
}

static bool genStar(mt19937_64& rng, int n, vector<PipPt>& v) {
    const double PI = acos(-1.0);
    v.assign(n, PipPt{0, 0});
    double step = 2 * PI / n, total = 0;
    for (int i = 0; i < n; i++) {
        double ang = (i + (double)(rng() % 600) / 1000.0 - 0.3) * step;
        double rad = 20 + (double)(rng() % 400) / 10.0;
        v[i] = PipPt{(ll)llround(rad * cos(ang)), (ll)llround(rad * sin(ang))};
    }
    for (int i = 0; i < n; i++) {
        const PipPt& a = v[i];
        const PipPt& b = v[(i + 1) % n];
        ll cr = a.x * b.y - a.y * b.x, dt = a.x * b.x + a.y * b.y;
        if (cr <= 0) return false;
        total += atan2((double)cr, (double)dt);
    }
    return fabs(total - 2 * PI) < 1e-9;                                // quay đúng một vòng → đa giác đơn
}

// (b) thuộc đoạn
static bool onSeg(const PipPt& p, const PipPt& a, const PipPt& b) {
    ll c = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    return c == 0 && (p.x - a.x) * (p.x - b.x) + (p.y - a.y) * (p.y - b.y) <= 0;
}

static vector<PipPt> shiftAndReverse(const vector<PipPt>& v, bool rev, int shift) {   // dịch vòng đỉnh, có thể đảo chiều
    vector<PipPt> r(v.size());
    for (size_t i = 0; i < v.size(); i++) r[i] = v[(i + shift) % v.size()];
    if (rev) reverse(r.begin(), r.end());
    return r;
}
static PipPt transformPt(PipPt p, int rot, bool mirror) {
    for (int k = 0; k < rot; k++) p = PipPt{-p.y, p.x};               // xoay 90° ngược chiều kim đồng hồ
    if (mirror) p.x = -p.x;
    return p;
}

int main() {
    mt19937_64 rng(20261017);
    // (a) + (c) đa giác sao
    int polygons = 0;
    while (polygons < 150) {
        int n = 3 + rng() % 6;
        vector<PipPt> v;
        if (!genStar(rng, n, v)) continue;
        polygons++;
        for (ll x = -66; x <= 66; x++)
            for (ll y = -66; y <= 66; y++) {
                int e = starOracle(v, x, y);
                int g = pointInPolygon(v, PipPt{x, y});
                CHECK(e == g, "đa giác sao #%d (n=%d) điểm (%lld,%lld): %d != %d", polygons, n, x, y, g, e);
            }
        // phép biến đổi giữ nguyên đáp án (lấy mẫu 300 điểm)
        for (int t = 0; t < 300; t++) {
            PipPt q{(ll)(rng() % 141) - 70, (ll)(rng() % 141) - 70};
            int base = pointInPolygon(v, q);
            int rot = rng() % 4;
            bool mirror = rng() % 2, rev = rng() % 2;
            int shift = rng() % n;
            vector<PipPt> w = shiftAndReverse(v, rev, shift);
            for (auto& p : w) p = transformPt(p, rot, mirror);
            CHECK(pointInPolygon(w, transformPt(q, rot, mirror)) == base, "biến đổi rot=%d mirror=%d rev=%d shift=%d", rot, (int)mirror, (int)rev, shift);
        }
    }
    // (b) đa giác histogram (nhân đôi toạ độ để tâm ô là điểm lẻ)
    for (int iter = 0; iter < 500; iter++) {
        int w = 1 + rng() % 6;
        vector<int> h(w);
        int maxh = 0;
        for (auto& x : h) { x = 1 + rng() % 5; maxh = max(maxh, x); }
        vector<PipPt> poly = {{0, 0}, {2 * w, 0}};
        for (int i = w - 1; i >= 0; i--) {
            poly.push_back(PipPt{2 * (ll)(i + 1), 2 * (ll)h[i]});
            poly.push_back(PipPt{2 * (ll)i, 2 * (ll)h[i]});
        }
        for (ll px = -2; px <= 2 * w + 2; px++)
            for (ll py = -2; py <= 2 * maxh + 2; py++) {
                PipPt q{px, py};
                bool onBoundary = false;
                for (size_t i = 0, j = poly.size() - 1; i < poly.size(); j = i++)
                    if (onSeg(q, poly[j], poly[i])) { onBoundary = true; break; }
                int expect;
                if (onBoundary) expect = 2;
                else {
                    // điểm không nằm trên biên: mọi ô quanh nó cùng trạng thái, lấy tâm ô kề (cx, cy) là điểm lẻ
                    ll cx = ((px % 2) + 2) % 2 == 0 ? px + 1 : px, cy = ((py % 2) + 2) % 2 == 0 ? py + 1 : py;
                    ll ci = (cx - 1) / 2, cj = (cy - 1) / 2;                   // cx - 1, cy - 1 chẵn nên chia chính xác
                    bool inside = ci >= 0 && ci < w && cj >= 0 && cj < h[ci];
                    expect = inside ? 1 : 0;
                }
                int g = pointInPolygon(poly, q);
                CHECK(g == expect, "histogram iter=%d điểm (%lld,%lld): %d != %d", iter, px, py, g, expect);
            }
    }
    // ví dụ trong mục: hình chữ L
    {
        vector<PipPt> L = {{0, 0}, {4, 0}, {4, 2}, {2, 2}, {2, 4}, {0, 4}};
        CHECK(pointInPolygon(L, PipPt{3, 3}) == 0 && pointInPolygon(L, PipPt{1, 3}) == 1 &&
              pointInPolygon(L, PipPt{2, 3}) == 2 && pointInPolygon(L, PipPt{3, 1}) == 1, "ví dụ chữ L");
        CHECK(pointInPolygon(L, PipPt{0, 0}) == 2 && pointInPolygon(L, PipPt{2, 2}) == 2 && pointInPolygon(L, PipPt{4, 3}) == 0, "đỉnh và điểm ngoài");
    }
    // toạ độ ±1e9
    {
        const ll M = 1000000000LL;
        vector<PipPt> sq = {{-M, -M}, {M, -M}, {M, M}, {-M, M}};
        CHECK(pointInPolygon(sq, PipPt{0, 0}) == 1 && pointInPolygon(sq, PipPt{M, 0}) == 2 && pointInPolygon(sq, PipPt{M + 1, 0}) == 0 &&
              pointInPolygon(sq, PipPt{M, M}) == 2 && pointInPolygon(sq, PipPt{-M, M - 1}) == 2 && pointInPolygon(sq, PipPt{M - 1, M - 1}) == 1, "hình vuông ±1e9");
        vector<PipPt> tri = {{-M, -M}, {M, -M}, {0, M}};
        CHECK(pointInPolygon(tri, PipPt{0, 0}) == 1 && pointInPolygon(tri, PipPt{M / 2, 0}) == 2 && pointInPolygon(tri, PipPt{M / 2 + 1, 0}) == 0 &&
              pointInPolygon(tri, PipPt{M / 2 - 1, 0}) == 1 && pointInPolygon(tri, PipPt{0, M}) == 2 && pointInPolygon(tri, PipPt{M, M}) == 0 &&
              pointInPolygon(tri, PipPt{M, -M}) == 2 && pointInPolygon(tri, PipPt{0, -M}) == 2, "tam giác ±1e9");
        vector<PipPt> triRev(tri.rbegin(), tri.rend());                 // chiều kim đồng hồ
        CHECK(pointInPolygon(triRev, PipPt{0, 0}) == 1 && pointInPolygon(triRev, PipPt{M / 2, 0}) == 2, "tam giác đảo chiều");
    }
    puts("OK");
    return 0;
}
