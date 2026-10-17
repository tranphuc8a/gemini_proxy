// @TEMPLATE

// Thử Tabu Search: xác định (cùng đầu vào -> cùng kết quả), kỷ lục không tệ đi khi thêm vòng lặp, đạt tối ưu trên TSP nhỏ
// (nước đi = đổi chỗ hai thành phố, khoá cấm = cặp thành phố), ca biên (không có nước đi, mọi nước đều bị cấm),
// và đúng ví dụ trong mô tả: thoát cực trị cục bộ vượt qua "đồi" trong khi leo đồi đứng yên.
struct Tsp {
    int n;
    vector<vector<double>> d;
    Tsp(int n_, mt19937& rng) : n(n_), d(n_, vector<double>(n_, 0)) {
        vector<pair<double, double>> p(n);
        for (auto& q : p) q = {rng() / 4294967296.0 * 100, rng() / 4294967296.0 * 100};
        for (int i = 0; i < n; i++)
            for (int j = 0; j < n; j++) d[i][j] = hypot(p[i].first - p[j].first, p[i].second - p[j].second);
    }
    double len(const vector<int>& t) const {
        double s = 0;
        for (int i = 0; i < n; i++) s += d[t[i]][t[(i + 1) % n]];
        return s;
    }
    double brute() const {
        vector<int> t(n);
        iota(t.begin(), t.end(), 0);
        double best = 1e18;
        do { best = min(best, len(t)); } while (next_permutation(t.begin() + 1, t.end()));
        return best;
    }
    bool isPerm(const vector<int>& t) const {
        if ((int)t.size() != n) return false;
        vector<int> c(t);
        sort(c.begin(), c.end());
        for (int i = 0; i < n; i++) if (c[i] != i) return false;
        return true;
    }
};

int main() {
    mt19937 rng(20261017);
    // 1) TSP n = 1..8: nước đi = (a, b) hai thành phố a < b đổi chỗ; khoá = a * n + b (nước và nghịch đảo của nó trùng khoá)
    for (int iter = 0; iter < 80; iter++) {
        int n = 1 + iter % 8;
        Tsp tsp(n, rng);
        vector<int> init(n);
        iota(init.begin(), init.end(), 0);
        shuffle(init.begin(), init.end(), rng);
        auto cost = [&](const vector<int>& t) { return tsp.len(t); };
        auto moves = [&](const vector<int>&) {
            vector<pair<int, int>> m;
            for (int a = 0; a < n; a++) for (int b = a + 1; b < n; b++) m.push_back({a, b});
            return m;
        };
        auto apply = [&](const vector<int>& t, const pair<int, int>& m) {
            vector<int> r = t;
            int pa = find(r.begin(), r.end(), m.first) - r.begin(), pb = find(r.begin(), r.end(), m.second) - r.begin();
            swap(r[pa], r[pb]);
            return r;
        };
        auto key = [&](const pair<int, int>& m) { return (long long)m.first * n + m.second; };
        double prev = 1e18;
        for (int iters : {0, 1, 5, 20, 80}) {
            vector<int> res = tabuSearch(init, cost, moves, apply, key, iters, 4);
            if (!tsp.isPerm(res)) { printf("SAI: không phải hoán vị (iter=%d)\n", iter); return 1; }
            if (iters == 0 && res != init) { puts("SAI: iters = 0 phải trả về nghiệm đầu"); return 1; }
            if (tsp.len(res) > tsp.len(init) + 1e-9) { printf("SAI: tệ hơn nghiệm đầu (iter=%d)\n", iter); return 1; }
            if (tsp.len(res) > prev + 1e-9) { printf("SAI: thêm vòng lặp mà kỷ lục tệ đi (iter=%d)\n", iter); return 1; }
            prev = tsp.len(res);
            if (tabuSearch(init, cost, moves, apply, key, iters, 4) != res) { puts("SAI: không xác định"); return 1; }
        }
        double opt = tsp.brute();
        if (prev < opt - 1e-9) { puts("SAI: tốt hơn vét cạn?!"); return 1; }
        if (prev > opt + 1e-9) { printf("không đạt tối ưu iter=%d n=%d: %.4f vs %.4f\n", iter, n, prev, opt); return 1; }
        // tenure rất lớn: mọi nước nhanh chóng bị cấm -> phải tự xoá danh sách cấm, không treo, vẫn trả nghiệm hợp lệ
        vector<int> big = tabuSearch(init, cost, moves, apply, key, 200, 1000000);
        if (!tsp.isPerm(big) || tsp.len(big) > tsp.len(init) + 1e-9) { puts("SAI: tenure rất lớn"); return 1; }
    }
    // 2) ví dụ trong mô tả: f(0..10) = [9,5,3,4,5,6,5,2,3,4,5], bắt đầu x = 2, nước ±1, khoá = cạnh {x, x±1}, tenure = 4, 8 vòng
    {
        const vector<double> f = {9, 5, 3, 4, 5, 6, 5, 2, 3, 4, 5};
        struct Mv { int from, to; };
        auto cost = [&](const int& x) { return f[x]; };
        auto moves = [&](const int& x) {
            vector<Mv> m;
            if (x > 0) m.push_back({x, x - 1});
            if (x < 10) m.push_back({x, x + 1});
            return m;
        };
        auto apply = [](const int&, const Mv& m) { return m.to; };
        auto key = [](const Mv& m) { return (long long)min(m.from, m.to); };
        int x = tabuSearch(2, cost, moves, apply, key, 8, 4);
        if (x != 7) { printf("SAI: ví dụ mô tả ra x = %d (mong 7)\n", x); return 1; }
        // đối chứng: leo đồi thuần từ x = 2 đứng yên vì cả hai láng giềng tệ hơn
        if (!(f[1] > f[2] && f[3] > f[2])) { puts("SAI: giả thiết cực trị cục bộ"); return 1; }
        // chỉ 4 vòng thì chưa tới 7: tới x = 6 (f = 5), kỷ lục vẫn là x = 2
        int y = tabuSearch(2, cost, moves, apply, key, 4, 4);
        if (y != 2) { printf("SAI: 4 vòng ra x = %d (mong 2)\n", y); return 1; }
    }
    // 3) không có nước đi nào: trả nghiệm đầu
    {
        int r = tabuSearch(5, [](const int& x) { return (double)x; }, [](const int&) { return vector<int>{}; },
                           [](const int& x, const int&) { return x; }, [](const int&) { return 0LL; }, 10, 3);
        if (r != 5) { puts("SAI: không có nước đi"); return 1; }
    }
    puts("OK");
}
