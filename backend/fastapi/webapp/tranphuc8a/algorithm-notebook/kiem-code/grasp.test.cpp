// @TEMPLATE

// Thử GRASP: rclPick tôn trọng ngưỡng RCL (alpha = 0 -> đúng ứng viên tốt nhất, alpha = 1 -> mọi ứng viên có thể xuất hiện);
// build với alpha = 0 trùng thuật toán láng giềng gần nhất; GRASP trả về nghiệm hợp lệ, đạt tối ưu trên TSP nhỏ (vét cạn kiểm lại),
// kỷ lục không tệ đi khi thêm vòng lặp (cùng hạt giống).
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
    // Xây dựng: bắt đầu ở 0, mỗi bước chọn thành phố chưa thăm bằng rclPick theo khoảng cách
    vector<int> build(double alpha, mt19937& rng) const {
        vector<int> t{0};
        vector<char> seen(n, 0);
        seen[0] = 1;
        while ((int)t.size() < n) {
            vector<int> cand;
            vector<double> sc;
            for (int c = 0; c < n; c++) if (!seen[c]) { cand.push_back(c); sc.push_back(d[t.back()][c]); }
            int pick = cand[rclPick(sc, alpha, rng)];
            seen[pick] = 1;
            t.push_back(pick);
        }
        return t;
    }
    vector<int> nearestNeighbor() const {
        vector<int> t{0};
        vector<char> seen(n, 0);
        seen[0] = 1;
        while ((int)t.size() < n) {
            int best = -1;
            for (int c = 0; c < n; c++) if (!seen[c] && (best < 0 || d[t.back()][c] < d[t.back()][best])) best = c;
            seen[best] = 1;
            t.push_back(best);
        }
        return t;
    }
    // Cải thiện cục bộ: 2-opt đầy đủ (lặp tới khi không còn đảo đoạn nào làm ngắn chu trình)
    void twoOpt(vector<int>& t) const {
        bool improved = true;
        while (improved) {
            improved = false;
            for (int i = 0; i < n && !improved; i++)
                for (int j = i + 1; j < n && !improved; j++) {
                    vector<int> r = t;
                    reverse(r.begin() + i, r.begin() + j + 1);
                    if (len(r) < len(t) - 1e-12) { t = r; improved = true; }
                }
        }
    }
};

int main() {
    mt19937 rng(20261017);
    // 1) rclPick
    for (int iter = 0; iter < 2000; iter++) {
        int m = 1 + rng() % 8;
        vector<double> c(m);
        for (double& x : c) x = rng() / 4294967296.0 * 10;
        double alpha = (rng() % 11) / 10.0;
        double lo = *min_element(c.begin(), c.end()), hi = *max_element(c.begin(), c.end());
        for (int rep = 0; rep < 5; rep++) {
            int i = rclPick(c, alpha, rng);
            if (i < 0 || i >= m || c[i] > lo + alpha * (hi - lo) + 1e-12) { puts("SAI: rclPick ngoài RCL"); return 1; }
            if (alpha == 0.0 && c[i] != lo) { puts("SAI: alpha = 0 phải chọn ứng viên tốt nhất"); return 1; }
        }
    }
    {
        vector<double> c{5, 1, 3, 2, 4};
        vector<int> cnt(5, 0);
        for (int i = 0; i < 4000; i++) cnt[rclPick(c, 1.0, rng)]++;
        for (int x : cnt) if (x < 400) { puts("SAI: alpha = 1 phải đủ ngẫu nhiên"); return 1; }
        vector<int> cnt2(5, 0);
        for (int i = 0; i < 4000; i++) cnt2[rclPick(c, 0.3, rng)]++;   // ngưỡng 1 + 0.3 * 4 = 2.2 -> chỉ ứng viên 1 và 3
        if (cnt2[0] || cnt2[2] || cnt2[4] || !cnt2[1] || !cnt2[3]) { puts("SAI: RCL alpha = 0.3"); return 1; }
        vector<double> one{7};
        if (rclPick(one, 0.5, rng) != 0) { puts("SAI: một ứng viên"); return 1; }
        vector<double> same{2, 2, 2};
        for (int i = 0; i < 50; i++) { int k = rclPick(same, 0.0, rng); if (k < 0 || k > 2) { puts("SAI: ứng viên bằng nhau"); return 1; } }
    }
    // 2) build với alpha = 0 trùng láng giềng gần nhất
    for (int iter = 0; iter < 100; iter++) {
        Tsp tsp(1 + iter % 9, rng);
        if (tsp.build(0.0, rng) != tsp.nearestNeighbor()) { puts("SAI: alpha = 0 khác láng giềng gần nhất"); return 1; }
    }
    // 3) GRASP trên TSP n = 1..8
    for (int iter = 0; iter < 60; iter++) {
        int n = 1 + iter % 8;
        Tsp tsp(n, rng);
        auto build = [&](double a, mt19937& r) { return tsp.build(a, r); };
        auto improve = [&](vector<int>& t) { tsp.twoOpt(t); };
        auto cost = [&](const vector<int>& t) { return tsp.len(t); };
        double prev = 1e18;
        for (int iters : {1, 3, 10, 40}) {
            mt19937 r(300 + iter);
            vector<int> res = grasp(build, improve, cost, 0.4, iters, r);
            if (!tsp.isPerm(res)) { printf("SAI: không phải hoán vị (iter=%d)\n", iter); return 1; }
            if (tsp.len(res) > prev + 1e-9) { printf("SAI: thêm vòng lặp mà kỷ lục tệ đi (iter=%d)\n", iter); return 1; }
            prev = tsp.len(res);
        }
        double opt = tsp.brute();
        if (prev < opt - 1e-9) { puts("SAI: tốt hơn vét cạn?!"); return 1; }
        if (prev > opt + 1e-9) { printf("không đạt tối ưu iter=%d n=%d: %.4f vs %.4f\n", iter, n, prev, opt); return 1; }
    }
    puts("OK");
}
