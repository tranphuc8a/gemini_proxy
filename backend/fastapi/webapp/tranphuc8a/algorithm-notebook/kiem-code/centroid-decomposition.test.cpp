// @TEMPLATE

// Thử Centroid Decomposition (CentroidTree) trên cây ngẫu nhiên (ngẫu nhiên đệ quy, đường thẳng, sao, nhị phân đầy), nhãn xáo trộn:
//  - tính chất cây centroid: đúng một gốc, tầng tăng dần theo cha, độ sâu <= log2 n, mỗi thành phần con <= một nửa thành phần cha;
//  - dist[v][k] đúng bằng khoảng cách thật tới tổ tiên centroid ở tầng k;
//  - mark / nearest so với BFS đa nguồn vét cạn; n = 100000 (kể cả đường thẳng) không tràn stack.
static vector<pair<int, int>> cay(mt19937& rng, int n, int kind) {
    vector<int> perm(n);
    iota(perm.begin(), perm.end(), 0);
    shuffle(perm.begin(), perm.end(), rng);
    vector<pair<int, int>> e;
    for (int i = 1; i < n; i++) {
        int p = kind == 0 ? (int)(rng() % i) : kind == 1 ? i - 1 : kind == 2 ? 0 : (i - 1) / 2;
        e.push_back({perm[i], perm[p]});
    }
    return e;
}

static vector<int> bfs_tu(const vector<vector<int>>& g, const vector<int>& src) {
    vector<int> d(g.size(), -1), q = src;
    for (int s : src) d[s] = 0;
    for (size_t i = 0; i < q.size(); i++) for (int v : g[q[i]]) if (d[v] < 0) { d[v] = d[q[i]] + 1; q.push_back(v); }
    return d;
}

int main() {
    mt19937 rng(20261024);
    for (int iter = 0; iter < 2000; iter++) {
        int n = 1 + rng() % 25, kind = rng() % 4;
        auto edges = cay(rng, n, kind);
        CentroidTree ct(n);
        vector<vector<int>> g(n);
        for (auto& e : edges) { ct.add_edge(e.first, e.second); g[e.first].push_back(e.second); g[e.second].push_back(e.first); }
        ct.build();
        vector<vector<int>> D(n);
        for (int v = 0; v < n; v++) D[v] = bfs_tu(g, {v});
        int lg = 0;
        while ((1 << (lg + 1)) <= n) lg++;
        int roots = 0;
        vector<int> csz(n, 1);
        for (int v = 0; v < n; v++) {
            if (ct.cpar[v] == -1) { roots++; if (ct.clevel[v] != 0) { puts("SAI gốc phải ở tầng 0"); return 1; } }
            else if (ct.clevel[v] != ct.clevel[ct.cpar[v]] + 1) { puts("SAI tầng không tăng theo cha"); return 1; }
            if (ct.clevel[v] > lg) { printf("SAI iter=%d: độ sâu %d > log2 n = %d\n", iter, ct.clevel[v], lg); return 1; }
            if ((int)ct.dist[v].size() != ct.clevel[v] + 1) { puts("SAI kích thước dist[v]"); return 1; }
            int c = v;
            for (int k = ct.clevel[v]; k >= 0; k--) {
                if (c == -1 || ct.dist[v][k] != D[v][c]) { printf("SAI iter=%d: dist[%d][%d] không bằng khoảng cách thật\n", iter, v, k); return 1; }
                c = ct.cpar[c];
            }
            if (c != -1) { puts("SAI chuỗi tổ tiên dài hơn tầng"); return 1; }
        }
        if (roots != 1) { puts("SAI phải có đúng một gốc centroid"); return 1; }
        // kích thước thành phần: duyệt theo tầng giảm dần
        vector<int> order(n);
        iota(order.begin(), order.end(), 0);
        sort(order.begin(), order.end(), [&](int a, int b) { return ct.clevel[a] > ct.clevel[b]; });
        for (int v : order) if (ct.cpar[v] != -1) csz[ct.cpar[v]] += csz[v];
        for (int v = 0; v < n; v++) if (ct.cpar[v] != -1 && 2 * csz[v] > csz[ct.cpar[v]]) { puts("SAI thành phần con lớn hơn một nửa"); return 1; }
        // mark / nearest
        vector<int> red;
        vector<char> is(n, 0);
        for (int op = 0; op < 60; op++) {
            int v = rng() % n;
            if (rng() % 2) { ct.mark(v); if (!is[v]) { is[v] = 1; red.push_back(v); } }
            else {
                int want = -1;
                if (!red.empty()) { auto d = bfs_tu(g, red); want = d[v]; }
                if (ct.nearest(v) != want) { printf("SAI iter=%d: nearest(%d) = %d thay vì %d\n", iter, v, ct.nearest(v), want); return 1; }
            }
        }
    }
    for (int kind : {1, 0, 3, 2}) {
        int n = kind <= 1 ? 100000 : 30000;           // đường thẳng và cây ngẫu nhiên: 1e5 đỉnh; nhị phân đầy, sao: 3e4
        int lg = 0;
        while ((1 << (lg + 1)) <= n) lg++;
        auto edges = cay(rng, n, kind);
        CentroidTree ct(n);
        vector<vector<int>> g(n);
        for (auto& e : edges) { ct.add_edge(e.first, e.second); g[e.first].push_back(e.second); g[e.second].push_back(e.first); }
        ct.build();
        int mx = 0, roots = 0;
        for (int v = 0; v < n; v++) { mx = max(mx, ct.clevel[v]); if (ct.cpar[v] == -1) roots++; }
        if (mx > lg || roots != 1) { printf("SAI cây lớn kind=%d: độ sâu %d, %d gốc\n", kind, mx, roots); return 1; }
        vector<int> red;
        for (int op = 0; op < 30; op++) {
            int v = rng() % n;
            if (rng() % 3 == 0) { ct.mark(v); red.push_back(v); }
            else {
                int want = -1;
                if (!red.empty()) { auto d = bfs_tu(g, red); want = d[v]; }
                if (ct.nearest(v) != want) { printf("SAI cây lớn kind=%d: nearest\n", kind); return 1; }
            }
        }
    }
    puts("OK");
    return 0;
}
