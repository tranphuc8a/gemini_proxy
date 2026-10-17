// @TEMPLATE

// Thử Kuhn: (1) so với vét cạn (DP bitmask trên tập đỉnh phải) trên đồ thị hai phía ngẫu nhiên nhỏ, có cạnh song song, đỉnh cô lập, nl != nr;
// (2) định lý König: kích thước ghép cực đại = phủ đỉnh nhỏ nhất (vét cạn mọi tập đỉnh); (3) ghép cặp trả về hợp lệ (cạnh có thật, mỗi đỉnh một lần);
// (4) đồ thị lớn có sẵn ghép cặp hoàn hảo -> kết quả phải bằng n; đồ thị dạng "đường" ép đường tăng dài.
static bool hop_le(const Kuhn& k, const vector<vector<int>>& adj, int res, const char* ctx) {
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

int main() {
    mt19937 rng(20261020);
    for (int iter = 0; iter < 4000; iter++) {
        int nl = rng() % 8, nr = rng() % 8, m = (nl && nr) ? rng() % 20 : 0;
        Kuhn k(nl, nr);
        vector<vector<int>> adj(nl);
        for (int i = 0; i < m; i++) { int u = rng() % nl, v = rng() % nr; k.add_edge(u, v); adj[u].push_back(v); }
        int res = k.max_matching();
        // vét cạn: dp[mask] = số đỉnh trái đã xét tối đa ghép được khi tập đỉnh phải đã dùng là mask
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
        // König: phủ đỉnh nhỏ nhất (vét cạn mọi tập đỉnh trái + phải)
        int cover = nl + nr;
        for (int mask = 0; mask < (1 << (nl + nr)); mask++) {
            bool ok = true;
            for (int u = 0; u < nl && ok; u++)
                for (int v : adj[u]) if (!((mask >> u) & 1) && !((mask >> (nl + v)) & 1)) { ok = false; break; }
            if (ok) cover = min(cover, __builtin_popcount(mask));
        }
        if (cover != res) { printf("SAI König iter=%d: phủ đỉnh %d khác ghép %d\n", iter, cover, res); return 1; }
        // gọi lại phải cho cùng kết quả (không giữ trạng thái cũ)
        if (k.max_matching() != res) { puts("SAI gọi max_matching lần hai"); return 1; }
    }
    // ghép cặp hoàn hảo có sẵn, 3000 x 3000, mỗi đỉnh trái thêm 5 cạnh ngẫu nhiên
    {
        int n = 3000;
        Kuhn k(n, n);
        vector<int> perm(n);
        iota(perm.begin(), perm.end(), 0);
        shuffle(perm.begin(), perm.end(), rng);
        vector<vector<int>> adj(n);
        for (int u = 0; u < n; u++) {
            k.add_edge(u, perm[u]); adj[u].push_back(perm[u]);
            for (int j = 0; j < 5; j++) { int v = rng() % n; k.add_edge(u, v); adj[u].push_back(v); }
        }
        int res = k.max_matching();
        if (res != n) { printf("SAI ghép hoàn hảo: %d thay vì %d\n", res, n); return 1; }
        if (!hop_le(k, adj, res, "hoàn hảo")) return 1;
    }
    // dạng "đường": u nối với v = u và v = u + 1; thứ tự cạnh khiến tham lam ghép sai, cần đường tăng dài
    {
        int n = 3000;
        Kuhn k(n, n + 1);
        vector<vector<int>> adj(n);
        for (int u = n - 1; u >= 0; u--) { k.add_edge(u, u + 1); adj[u].push_back(u + 1); k.add_edge(u, u); adj[u].push_back(u); }
        int res = k.max_matching();
        if (res != n || !hop_le(k, adj, res, "đường")) { printf("SAI dạng đường: %d\n", res); return 1; }
    }
    puts("OK");
    return 0;
}
