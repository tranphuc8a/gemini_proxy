// @TEMPLATE

// Thử Hill Climbing: tính chất (hợp lệ, không tệ hơn nghiệm đầu), đạt tối ưu trên TSP nhỏ (vét cạn kiểm lại) với khởi động lại,
// hàm một đỉnh luôn tới tối ưu, hàm hai thung lũng thì một lần leo KẸT (đúng bản chất: không đảm bảo tối ưu).
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

vector<int> twoOptNeighbor(const vector<int>& t, mt19937& rng) {
    vector<int> r = t;
    int n = t.size();
    if (n < 4) return r;
    int i = rng() % n, j = rng() % n;
    if (i > j) swap(i, j);
    reverse(r.begin() + i, r.begin() + j + 1);
    return r;
}

int main() {
    mt19937 rng(20261017);
    // 1) TSP ngẫu nhiên n = 1..8: nghiệm hợp lệ, không tệ hơn nghiệm đầu, đạt tối ưu (có khởi động lại)
    for (int iter = 0; iter < 150; iter++) {
        int n = 1 + iter % 8;
        Tsp tsp(n, rng);
        vector<int> first;
        bool haveFirst = false;
        auto gen = [&](mt19937& r) {
            vector<int> t(n);
            iota(t.begin(), t.end(), 0);
            shuffle(t.begin(), t.end(), r);
            if (!haveFirst) { first = t; haveFirst = true; }
            return t;
        };
        auto cost = [&](const vector<int>& t) { return tsp.len(t); };
        vector<int> res = hillClimbing(gen, cost, twoOptNeighbor, 40, 400, rng);
        if (!tsp.isPerm(res)) { printf("SAI: không phải hoán vị (iter=%d)\n", iter); return 1; }
        if (tsp.len(res) > tsp.len(first) + 1e-9) { printf("SAI: tệ hơn nghiệm đầu (iter=%d)\n", iter); return 1; }
        double opt = tsp.brute();
        if (tsp.len(res) < opt - 1e-9) { printf("SAI: tốt hơn vét cạn?! (iter=%d)\n", iter); return 1; }
        if (tsp.len(res) > opt + 1e-9) { printf("không đạt tối ưu iter=%d n=%d: %.4f vs %.4f\n", iter, n, tsp.len(res), opt); return 1; }
    }
    // 2) hàm một đỉnh: f(x) = (x - 37)^2 trên [0, 100], bắt đầu từ 90, láng giềng ±1 -> chắc chắn tới 37
    {
        auto gen = [](mt19937&) { return 90; };
        auto cost = [](const int& x) { return (double)(x - 37) * (x - 37); };
        auto nb = [](const int& x, mt19937& r) {
            int y = x + ((r() & 1) ? 1 : -1);
            return (y < 0 || y > 100) ? x : y;
        };
        int x = hillClimbing(gen, cost, nb, 1, 2000, rng);
        if (x != 37) { printf("SAI: hàm một đỉnh ra %d\n", x); return 1; }
    }
    // 3) cao nguyên: f(x) = max(|x - 37| - 5, 0): đi ngang được nên vẫn tới vùng chi phí 0
    {
        auto gen = [](mt19937&) { return 100; };
        auto cost = [](const int& x) { return (double)max(abs(x - 37) - 5, 0); };
        auto nb = [](const int& x, mt19937& r) { return min(100, max(0, x + ((r() & 1) ? 1 : -1))); };
        int x = hillClimbing(gen, cost, nb, 1, 3000, rng);
        if (cost(x) != 0) { printf("SAI: cao nguyên ra %d\n", x); return 1; }
    }
    // 4) hai thung lũng: tối ưu toàn cục f(10) = 0, cực trị cục bộ f(80) = 5. Một lần leo từ 95 KẸT ở 80 (không đảm bảo tối ưu);
    //    nhiều lần khởi động lại ngẫu nhiên thì tìm được 10.
    {
        auto cost = [](const int& x) { return (double)min((x - 10) * (x - 10), (x - 80) * (x - 80) + 5); };
        auto nb = [](const int& x, mt19937& r) { return min(100, max(0, x + ((r() & 1) ? 1 : -1))); };
        int stuck = hillClimbing([](mt19937&) { return 95; }, cost, nb, 1, 5000, rng);
        if (stuck != 80) { printf("SAI: mong kẹt ở 80, ra %d\n", stuck); return 1; }
        int good = hillClimbing([](mt19937& r) { return (int)(r() % 101); }, cost, nb, 60, 5000, rng);
        if (good != 10) { printf("SAI: khởi động lại nhiều lần vẫn không tới 10 (ra %d)\n", good); return 1; }
    }
    // 5) restarts = 1, iters = 0: trả về đúng nghiệm khởi đầu
    {
        int x = hillClimbing([](mt19937&) { return 7; }, [](const int& v) { return (double)v; }, [](const int& v, mt19937&) { return v - 1; }, 1, 0, rng);
        if (x != 7) { puts("SAI: iters = 0"); return 1; }
    }
    puts("OK");
}
