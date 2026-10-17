// @TEMPLATE

// Thử Hopcroft–Karp: (1) so với vét cạn (DP bitmask) trên đồ thị hai phía ngẫu nhiên nhỏ; (2) so với Kuhn viết ngay trong tệp thử trên đồ thị vừa
// ngẫu nhiên (thưa lẫn dày); (3) ghép cặp trả về hợp lệ; (4) đồ thị rất lớn (100000 + 100000 đỉnh, 500000 cạnh) có sẵn ghép cặp hoàn hảo,
// và dạng "đường" 5000 đỉnh ép đường tăng dài.
static bool hop_le(const HopcroftKarp& k, const vector<vector<int>>& adj, int res, const char* ctx) {
    int cnt = 0;
    for (int u = 0; u < k.nl; u++) {
        int v = k.match_l[u];
        if (v == -1) continue;
        cnt++;
        if (v < 0 || v >= k.nr || k.match_r[v] != u) { printf("SAI %s: match_l / match_r không khớp\n", ctx); return false; }
        if (find(adj[u].begin(), adj[u].end(), v) == adj[u].end()) { printf("SAI %s: ghép bằng cạnh không tồn tại\n", ctx); return false; }
    }
    for (int v = 0; v < k.nr; v++) if (k.match_r[v] != -1 && k.match_l[k.match_r[v]] != v) { printf("SAI %s: match_r không khớp\n", ctx); return false; }
    if (cnt != res) { printf("SAI %s: số cặp %d khác giá trị trả về %d\n", ctx, cnt, res); return false; }
    return true;
}

// Kuhn đơn giản làm chuẩn so sánh
struct ThamChieu {
    int nl, nr;
    vector<vector<int>> adj;
    vector<int> mr;
    vector<char> vis;
    bool go(int u) {
        for (int v : adj[u]) {
            if (vis[v]) continue;
            vis[v] = 1;
            if (mr[v] == -1 || go(mr[v])) { mr[v] = u; return true; }
        }
        return false;
    }
    int run() {
        mr.assign(nr, -1);
        int res = 0;
        for (int u = 0; u < nl; u++) { vis.assign(nr, 0); if (go(u)) res++; }
        return res;
    }
};

int main() {
    mt19937 rng(20261021);
    for (int iter = 0; iter < 4000; iter++) {
        int nl = rng() % 8, nr = rng() % 8, m = (nl && nr) ? rng() % 20 : 0;
        HopcroftKarp k(nl, nr);
        vector<vector<int>> adj(nl);
        for (int i = 0; i < m; i++) { int u = rng() % nl, v = rng() % nr; k.add_edge(u, v); adj[u].push_back(v); }
        int res = k.max_matching();
        vector<int> dp(1 << nr, -1000);
        dp[0] = 0;
        for (int u = 0; u < nl; u++) {
            vector<int> nd = dp;
            for (int mask = 0; mask < (1 << nr); mask++) {
                if (dp[mask] < 0) continue;
                for (int v : adj[u]) if (!((mask >> v) & 1)) nd[mask | (1 << v)] = max(nd[mask | (1 << v)], dp[mask] + 1);
            }
            dp = nd;
        }
        int best = 0;
        for (int x : dp) best = max(best, x);
        if (res != best) { printf("SAI iter=%d nl=%d nr=%d: %d thay vì %d\n", iter, nl, nr, res, best); return 1; }
        if (!hop_le(k, adj, res, "nhỏ")) return 1;
    }
    // so với Kuhn trên đồ thị vừa
    for (int iter = 0; iter < 300; iter++) {
        int nl = 1 + rng() % 200, nr = 1 + rng() % 200;
        int m = rng() % (nl * 4 + 1);
        HopcroftKarp k(nl, nr);
        ThamChieu ref;
        ref.nl = nl; ref.nr = nr; ref.adj.assign(nl, {});
        vector<vector<int>> adj(nl);
        for (int i = 0; i < m; i++) { int u = rng() % nl, v = rng() % nr; k.add_edge(u, v); ref.adj[u].push_back(v); adj[u].push_back(v); }
        int res = k.max_matching(), want = ref.run();
        if (res != want) { printf("SAI so với Kuhn iter=%d: %d thay vì %d\n", iter, res, want); return 1; }
        if (!hop_le(k, adj, res, "vừa")) return 1;
    }
    // đồ thị rất lớn có ghép cặp hoàn hảo
    {
        int n = 100000;
        HopcroftKarp k(n, n);
        vector<int> perm(n);
        iota(perm.begin(), perm.end(), 0);
        shuffle(perm.begin(), perm.end(), rng);
        vector<vector<int>> adj(n);
        for (int u = 0; u < n; u++) {
            k.add_edge(u, perm[u]); adj[u].push_back(perm[u]);
            for (int j = 0; j < 4; j++) { int v = rng() % n; k.add_edge(u, v); adj[u].push_back(v); }
        }
        int res = k.max_matching();
        if (res != n) { printf("SAI ghép hoàn hảo lớn: %d thay vì %d\n", res, n); return 1; }
        if (!hop_le(k, adj, res, "lớn")) return 1;
    }
    // dạng "đường": u nối v = u và v = u + 1 (cạnh u -> u + 1 thêm trước ép ghép tham lam sai)
    {
        int n = 5000;
        HopcroftKarp k(n, n + 1);
        vector<vector<int>> adj(n);
        for (int u = n - 1; u >= 0; u--) { k.add_edge(u, u + 1); adj[u].push_back(u + 1); k.add_edge(u, u); adj[u].push_back(u); }
        int res = k.max_matching();
        if (res != n || !hop_le(k, adj, res, "đường")) { printf("SAI dạng đường: %d\n", res); return 1; }
    }
    // rỗng
    {
        HopcroftKarp k(0, 0);
        if (k.max_matching() != 0) { puts("SAI đồ thị rỗng"); return 1; }
        HopcroftKarp k2(3, 3);
        if (k2.max_matching() != 0) { puts("SAI không có cạnh"); return 1; }
    }
    puts("OK");
    return 0;
}
