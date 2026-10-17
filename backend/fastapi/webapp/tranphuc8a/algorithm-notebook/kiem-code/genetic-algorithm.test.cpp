// @TEMPLATE

// Thử GA: cá thể trả về hợp lệ; kỷ lục không bao giờ tệ đi khi thêm thế hệ (cùng hạt giống -> cùng tiền tố ngẫu nhiên);
// đạt tối ưu trên TSP nhỏ (OX + đột biến đổi chỗ), OneMax đạt toàn bit 1, ca biên (quần thể 1, 0 thế hệ, elite lớn).
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

// Order crossover (OX): giữ đoạn [i, j] của a, điền phần còn lại theo thứ tự xuất hiện trong b
vector<int> orderCrossover(const vector<int>& a, const vector<int>& b, mt19937& rng) {
    int n = a.size();
    if (n < 2) return a;
    int i = rng() % n, j = rng() % n;
    if (i > j) swap(i, j);
    vector<int> child(n, -1);
    vector<char> used(n, 0);
    for (int k = i; k <= j; k++) { child[k] = a[k]; used[a[k]] = 1; }
    int pos = (j + 1) % n;
    for (int k = 0; k < n; k++) {
        int c = b[(j + 1 + k) % n];
        if (!used[c]) { child[pos] = c; pos = (pos + 1) % n; }
    }
    return child;
}

void swapMutate(vector<int>& t, mt19937& rng) {
    int n = t.size();
    if (n < 2) return;
    swap(t[rng() % n], t[rng() % n]);
}

int main() {
    mt19937 rng(20261017);
    // 1) TSP n = 1..8: hợp lệ, đạt tối ưu, kỷ lục không tệ đi khi tăng số thế hệ
    for (int iter = 0; iter < 60; iter++) {
        int n = 1 + iter % 8;
        Tsp tsp(n, rng);
        auto gen = [&](mt19937& r) {
            vector<int> t(n);
            iota(t.begin(), t.end(), 0);
            shuffle(t.begin(), t.end(), r);
            return t;
        };
        auto cost = [&](const vector<int>& t) { return tsp.len(t); };
        double prev = 1e18;
        for (int gens : {0, 3, 10, 40, 200}) {
            mt19937 r(777 + iter);   // cùng hạt giống: các thế hệ đầu giống hệt nhau
            vector<int> res = geneticAlgorithm(gen, cost, orderCrossover, swapMutate, 50, gens, 0.3, r);
            if (!tsp.isPerm(res)) { printf("SAI: không phải hoán vị (iter=%d)\n", iter); return 1; }
            if (tsp.len(res) > prev + 1e-9) { printf("SAI: thêm thế hệ mà kỷ lục tệ đi (iter=%d, gens=%d)\n", iter, gens); return 1; }
            prev = tsp.len(res);
        }
        double opt = tsp.brute();
        if (prev < opt - 1e-9) { printf("SAI: tốt hơn vét cạn?! (iter=%d)\n", iter); return 1; }
        if (prev > opt + 1e-9) { printf("không đạt tối ưu iter=%d n=%d: %.4f vs %.4f\n", iter, n, prev, opt); return 1; }
    }
    // 2) OneMax: xâu 10 bit, cost = số bit 0, lai ghép một điểm cắt, đột biến lật một bit
    {
        const int L = 10;
        auto gen = [](mt19937& r) { vector<int> s(L); for (int& x : s) x = r() & 1; return s; };
        auto cost = [](const vector<int>& s) { return (double)count(s.begin(), s.end(), 0); };
        auto cross = [](const vector<int>& a, const vector<int>& b, mt19937& r) {
            int cut = r() % (L + 1);
            vector<int> c(L);
            for (int i = 0; i < L; i++) c[i] = i < cut ? a[i] : b[i];
            return c;
        };
        auto mut = [](vector<int>& s, mt19937& r) { s[r() % L] ^= 1; };
        int hit = 0;
        for (int s = 0; s < 20; s++) {
            mt19937 r(5000 + s);
            auto res = geneticAlgorithm(gen, cost, cross, mut, 40, 200, 0.3, r);
            if (cost(res) == 0) hit++;
        }
        if (hit != 20) { printf("SAI: OneMax chỉ đạt %d/20\n", hit); return 1; }
    }
    // 3) ca biên: popSize = 1 (được nâng lên 2), 0 thế hệ, elite lớn hơn quần thể, elite = 0
    {
        auto gen = [](mt19937& r) { return (int)(r() % 1000); };
        auto cost = [](const int& x) { return (double)x; };
        auto cross = [](const int& a, const int& b, mt19937&) { return min(a, b); };
        auto mut = [](int& x, mt19937&) { x = max(0, x - 1); };
        mt19937 r(1);
        int a = geneticAlgorithm(gen, cost, cross, mut, 1, 0, 0.5, r);
        if (a < 0 || a >= 1000) { puts("SAI: popSize = 1"); return 1; }
        int b = geneticAlgorithm(gen, cost, cross, mut, 10, 50, 1.0, r, 100);
        int c = geneticAlgorithm(gen, cost, cross, mut, 10, 200, 1.0, r, 0);
        if (c != 0) { printf("SAI: elite = 0 mà không tới cực tiểu 0, ra %d\n", c); return 1; }
        if (b < 0) { puts("SAI: elite lớn"); return 1; }
    }
    puts("OK");
}
