// @TEMPLATE

// Thử Beam Search trên TSP (trạng thái = đường đi dở dang từ thành phố 0): width = 1 trùng thuật toán láng giềng gần nhất,
// width đủ lớn (>= số đường đi dở dang tối đa) cho đúng tối ưu (vét cạn kiểm lại), mọi kết quả là hoán vị hợp lệ,
// và beam không bao giờ tạo ra nghiệm tốt hơn vét cạn. Thêm ca biên n = 1, n = 2, width = 0 (được nâng lên 1).
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
        for (int i = 0; i + 1 < (int)t.size(); i++) s += d[t[i]][t[i + 1]];
        if ((int)t.size() == n) s += d[t.back()][t[0]];   // đủ n thành phố: cộng cạnh quay về
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
    vector<int> beam(size_t width) const {
        auto expand = [&](const vector<int>& t, vector<vector<int>>& out) {
            if ((int)t.size() == n) return;
            vector<char> seen(n, 0);
            for (int c : t) seen[c] = 1;
            for (int c = 0; c < n; c++) if (!seen[c]) { vector<int> u = t; u.push_back(c); out.push_back(u); }
        };
        auto score = [&](const vector<int>& t) { return len(t); };
        return beamSearch(vector<int>{0}, expand, score, width);
    }
};

int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 48; iter++) {
        int n = 1 + iter % 8;
        Tsp tsp(n, rng);
        vector<int> g = tsp.beam(1);
        if (!tsp.isPerm(g)) { printf("SAI: width = 1 không phải hoán vị (iter=%d)\n", iter); return 1; }
        if (g != tsp.nearestNeighbor()) { printf("SAI: width = 1 khác láng giềng gần nhất (iter=%d)\n", iter); return 1; }
        vector<int> z = tsp.beam(0);
        if (z != g) { puts("SAI: width = 0 phải như width = 1"); return 1; }
        double opt = tsp.brute();
        for (size_t w : {2, 5, 30, 200, 6000}) {
            vector<int> b = tsp.beam(w);
            if (!tsp.isPerm(b)) { printf("SAI: width = %zu không phải hoán vị (iter=%d)\n", w, iter); return 1; }
            if (tsp.len(b) < opt - 1e-9) { printf("SAI: tốt hơn vét cạn?! (iter=%d)\n", iter); return 1; }
        }
        // 7! = 5040 đường đi dở dang tối đa mỗi tầng: width 6000 không cắt gì -> vét cạn theo tầng -> tối ưu
        vector<int> full = tsp.beam(6000);
        if (tsp.len(full) > opt + 1e-9) { printf("SAI: beam đủ rộng mà không tối ưu iter=%d n=%d: %.4f vs %.4f\n", iter, n, tsp.len(full), opt); return 1; }
    }
    // beam rộng cải thiện tham lam ở ít nhất một số bài (không phải bài nào cũng vậy): đếm trên 50 bài n = 8
    int better = 0;
    for (int iter = 0; iter < 50; iter++) {
        Tsp tsp(8, rng);
        if (tsp.len(tsp.beam(6000)) < tsp.len(tsp.beam(1)) - 1e-9) better++;
    }
    if (better < 8) { printf("SAI: beam rộng hiếm khi hơn tham lam (%d/50)\n", better); return 1; }
    // đường đi hoàn chỉnh từ đầu (trạng thái đầu đã là nghiệm): n = 1
    {
        Tsp one(1, rng);
        if (one.beam(3) != vector<int>{0}) { puts("SAI: n = 1"); return 1; }
    }
    puts("OK");
}
