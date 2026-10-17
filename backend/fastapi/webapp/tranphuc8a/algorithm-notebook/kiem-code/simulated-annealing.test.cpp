// @TEMPLATE

// Thử Simulated Annealing: nghiệm hợp lệ, không tệ hơn nghiệm đầu (kể cả iters = 0), đạt tối ưu trên TSP nhỏ (vét cạn kiểm lại),
// và trên hàm nhiều cực trị cục bộ SA vượt trội Hill Climbing (đo trên nhiều lần chạy).
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

// hàm một biến nhiều cực trị cục bộ (kiểu Rastrigin rời rạc): tối ưu toàn cục f(0) = 0, cực trị cục bộ ở các bội của 10
double rugged(int x) { return x * x / 100.0 + 10.0 * (1.0 - cos(x * 2 * acos(-1.0) / 10.0)); }

// Hill Climbing thuần (đối chứng): bắt đầu x = 95, nhận láng giềng nếu không tệ hơn
template <class Cost, class Nb>
int hillClimbing95(Cost cost, Nb nb, mt19937& r) {
    int cur = 95;
    double cc = cost(cur);
    for (int it = 0; it < 40000; it++) {
        int y = nb(cur, r);
        double c = cost(y);
        if (c <= cc) { cur = y; cc = c; }
    }
    return cur;
}

int main() {
    mt19937 rng(20261017);
    // 1) TSP n = 1..8
    for (int iter = 0; iter < 80; iter++) {
        int n = 1 + iter % 8;
        Tsp tsp(n, rng);
        vector<int> init(n);
        iota(init.begin(), init.end(), 0);
        shuffle(init.begin(), init.end(), rng);
        auto cost = [&](const vector<int>& t) { return tsp.len(t); };
        vector<int> res = simulatedAnnealing(init, cost, twoOptNeighbor, 20.0, 0.05, 30000, rng);
        if (!tsp.isPerm(res)) { printf("SAI: không phải hoán vị (iter=%d)\n", iter); return 1; }
        if (tsp.len(res) > tsp.len(init) + 1e-9) { printf("SAI: tệ hơn nghiệm đầu (iter=%d)\n", iter); return 1; }
        double opt = tsp.brute();
        if (tsp.len(res) < opt - 1e-9) { printf("SAI: tốt hơn vét cạn?! (iter=%d)\n", iter); return 1; }
        if (tsp.len(res) > opt + 1e-9) { printf("không đạt tối ưu iter=%d n=%d: %.4f vs %.4f\n", iter, n, tsp.len(res), opt); return 1; }
        // iters = 0: trả về đúng nghiệm đầu
        vector<int> same = simulatedAnnealing(init, cost, twoOptNeighbor, 20.0, 0.05, 0, rng);
        if (same != init) { puts("SAI: iters = 0 phải trả về nghiệm đầu"); return 1; }
    }
    // 2) hàm nhiều cực trị cục bộ, xuất phát x = 95: so SA với Hill Climbing trên 30 hạt giống
    {
        auto cost = [](const int& x) { return rugged(x); };
        auto nb = [](const int& x, mt19937& r) {
            int y = x + (int)(r() % 7) - 3;
            return min(100, max(-100, y));
        };
        int saHit = 0, hcHit = 0;
        for (int s = 0; s < 30; s++) {
            mt19937 r1(1000 + s), r2(2000 + s);
            int a = simulatedAnnealing(95, cost, nb, 10.0, 0.05, 40000, r1);
            if (a == 0) saHit++;
            int b = hillClimbing95(cost, nb, r2);
            if (b == 0) hcHit++;
        }
        printf("(SA tối ưu %d/30, HC tối ưu %d/30)\n", saHit, hcHit);
        if (saHit < 20) { printf("SAI: SA ít khi tới tối ưu: %d/30\n", saHit); return 1; }
        if (hcHit > saHit / 2) { printf("SAI: HC không thua SA: %d vs %d\n", hcHit, saHit); return 1; }
    }
    puts("OK");
}
