// @TEMPLATE

// Thử convexHull bằng các tính chất đặc trưng của bao lồi (không tin vào cách cài đặt):
//  (1) mọi đỉnh của bao là điểm đầu vào, đỉnh đầu là điểm nhỏ nhất theo (x, y);
//  (2) đa giác lồi CHẶT, ngược chiều kim đồng hồ (mọi cross liên tiếp > 0, không có đỉnh thẳng hàng);
//  (3) mọi điểm đầu vào nằm trong hoặc trên bao (cross >= 0 với mọi cạnh).
// Một đa giác lồi chặt có đỉnh trong tập điểm và chứa mọi điểm chính là bao lồi duy nhất. Ngoài ra thử suy biến (rỗng, 1 điểm,
// trùng hết, thẳng hàng), toạ độ ±1e9 (tích có hướng sát 8e18) và diện tích bằng __int128.
#define CHECK(cond, ...) do { if (!(cond)) { printf("SAI: "); printf(__VA_ARGS__); printf("\n"); return 1; } } while (0)

typedef __int128 LL128;

// → "" nếu đúng, ngược lại là lý do sai
static string verifyHull(const vector<HullPt>& pts, const vector<HullPt>& h) {
    vector<HullPt> s = pts;
    sort(s.begin(), s.end());
    s.erase(unique(s.begin(), s.end()), s.end());
    if (s.empty()) return h.empty() ? "" : "đầu vào rỗng nhưng bao không rỗng";
    if (s.size() == 1) return (h.size() == 1 && h[0] == s[0]) ? "" : "một điểm";
    bool collinear = true;
    for (size_t k = 2; k < s.size(); k++)
        if (hullCross(s[0], s[1], s[k]) != 0) { collinear = false; break; }
    if (collinear) {
        if (h.size() == 2 && h[0] == s.front() && h[1] == s.back()) return "";
        return "mọi điểm thẳng hàng: bao phải là 2 đầu mút";
    }
    int m = h.size();
    if (m < 3) return "bao có ít hơn 3 đỉnh dù điểm không thẳng hàng";
    if (!(h[0] == s[0])) return "đỉnh đầu không phải điểm nhỏ nhất";
    for (auto& v : h)
        if (!binary_search(s.begin(), s.end(), v)) return "đỉnh bao không phải điểm đầu vào";
    for (int i = 0; i < m; i++)
        if (hullCross(h[i], h[(i + 1) % m], h[(i + 2) % m]) <= 0) return "không lồi chặt ngược chiều kim đồng hồ";
    for (auto& p : s)
        for (int i = 0; i < m; i++)
            if (hullCross(h[i], h[(i + 1) % m], p) < 0) return "có điểm nằm ngoài bao";
    // diện tích: so với dây giày __int128
    LL128 shoelace = 0;
    for (int i = 0; i < m; i++) shoelace += (LL128)h[i].x * h[(i + 1) % m].y - (LL128)h[i].y * h[(i + 1) % m].x;
    if (shoelace <= 0 || (LL128)polygonArea2(h) != shoelace) return "diện tích gấp đôi sai";
    return "";
}

int main() {
    mt19937_64 rng(20261017);
    // 1) toạ độ nhỏ: nhiều điểm trùng và thẳng hàng
    for (int iter = 0; iter < 30000; iter++) {
        int n = rng() % 14, R = 1 + rng() % 6;
        vector<HullPt> p(n);
        for (auto& q : p) q = {(long long)(rng() % (2 * R + 1)) - R, (long long)(rng() % (2 * R + 1)) - R};
        vector<HullPt> h = convexHull(p);
        string err = verifyHull(p, h);
        CHECK(err.empty(), "iter=%d n=%d: %s", iter, n, err.c_str());
        CHECK(convexHull(h) == h, "bao của bao phải là chính nó, iter=%d", iter);
    }
    // 2) ví dụ trong mục
    {
        vector<HullPt> p = {{0, 0}, {2, 0}, {1, 1}, {2, 2}, {0, 2}, {1, 0}};
        vector<HullPt> h = convexHull(p);
        vector<HullPt> expect = {{0, 0}, {2, 0}, {2, 2}, {0, 2}};
        CHECK(h == expect, "ví dụ trong mục");
        CHECK(polygonArea2(h) == 8, "gấp đôi diện tích = 8");
    }
    // 3) suy biến
    {
        CHECK(convexHull({}).empty(), "rỗng");
        CHECK(convexHull({{3, 4}}).size() == 1, "một điểm");
        CHECK(convexHull({{3, 4}, {3, 4}, {3, 4}}).size() == 1, "trùng hết");
        vector<HullPt> line;
        for (int i = 0; i < 10; i++) line.push_back({i * 2, i * 3 - 5});           // thẳng hàng
        string err = verifyHull(line, convexHull(line));
        CHECK(err.empty(), "thẳng hàng: %s", err.c_str());
        vector<HullPt> vline = {{5, 0}, {5, 9}, {5, 3}, {5, 9}};
        err = verifyHull(vline, convexHull(vline));
        CHECK(err.empty(), "thẳng hàng đứng: %s", err.c_str());
    }
    // 4) toạ độ ±1e9: tích có hướng sát 8e18
    {
        vector<HullPt> p = {{-1000000000LL, -1000000000LL}, {1000000000LL, -1000000000LL}, {1000000000LL, 1000000000LL}, {-1000000000LL, 1000000000LL}, {0, 0}, {1000000000LL, 0}};
        vector<HullPt> h = convexHull(p);
        string err = verifyHull(p, h);
        CHECK(err.empty() && h.size() == 4 && polygonArea2(h) == 8000000000000000000LL, "bốn góc ±1e9: %s", err.c_str());
        // ngẫu nhiên toàn miền
        for (int iter = 0; iter < 20; iter++) {
            vector<HullPt> q(2000);
            for (auto& v : q) v = {(long long)(rng() % 2000000001ULL) - 1000000000LL, (long long)(rng() % 2000000001ULL) - 1000000000LL};
            err = verifyHull(q, convexHull(q));
            CHECK(err.empty(), "ngẫu nhiên toàn miền: %s", err.c_str());
        }
    }
    // 5) mọi điểm đều là đỉnh (parabol) và ca lớn
    {
        vector<HullPt> par;
        for (int i = 0; i < 3000; i++) par.push_back({i, (long long)i * i});
        vector<HullPt> h = convexHull(par);
        CHECK(h.size() == par.size(), "parabol: mọi điểm là đỉnh (%d)", (int)h.size());
        string err = verifyHull(par, h);
        CHECK(err.empty(), "parabol: %s", err.c_str());
        vector<HullPt> big(200000);
        for (auto& v : big) v = {(long long)(rng() % 2000000001ULL) - 1000000000LL, (long long)(rng() % 2000000001ULL) - 1000000000LL};
        err = verifyHull(big, convexHull(big));
        CHECK(err.empty(), "ca lớn 200000 điểm: %s", err.c_str());
    }
    puts("OK");
    return 0;
}
