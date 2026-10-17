// @TEMPLATE

// Thử BFS: so với Floyd-Warshall (đồ thị không trọng số, có hướng, vòng tự trỏ, cạnh song song, đỉnh cô lập), BFS nhiều nguồn,
// dựng lại đường đi, BFS lưới so với BFS trên đồ thị dựng từ lưới, ca lớn.
int main() {
    mt19937 rng(20261017);
    const int INFD = 1 << 28;
    for (int iter = 0; iter < 3000; iter++) {
        int n = 1 + rng() % 9, m = rng() % 18;
        vector<vector<int>> g(n);
        vector<vector<int>> f(n, vector<int>(n, INFD));
        for (int i = 0; i < n; i++) f[i][i] = 0;
        for (int i = 0; i < m; i++) {
            int u = rng() % n, v = rng() % n;
            g[u].push_back(v);
            f[u][v] = min(f[u][v], 1);
        }
        for (int k = 0; k < n; k++)
            for (int i = 0; i < n; i++)
                for (int j = 0; j < n; j++) f[i][j] = min(f[i][j], f[i][k] + f[k][j]);
        // một nguồn
        int s = rng() % n;
        auto r = bfs(g, {s});
        for (int v = 0; v < n; v++) {
            int want = f[s][v] >= INFD ? -1 : f[s][v];
            if (r.dist[v] != want) { printf("SAI dist iter=%d s=%d v=%d: %d != %d\n", iter, s, v, r.dist[v], want); return 1; }
            auto path = bfs_path(r, v);
            if (want == -1) { if (!path.empty()) { puts("SAI đường đi của đỉnh không tới được"); return 1; } continue; }
            if ((int)path.size() != want + 1 || path.front() != s || path.back() != v) { printf("SAI độ dài đường đi iter=%d\n", iter); return 1; }
            for (size_t i = 0; i + 1 < path.size(); i++)
                if (find(g[path[i]].begin(), g[path[i]].end(), path[i + 1]) == g[path[i]].end()) { puts("SAI đường đi không đi theo cạnh"); return 1; }
        }
        // nhiều nguồn (có thể trùng nguồn): min theo từng nguồn
        int k = 1 + rng() % 3;
        vector<int> src;
        for (int i = 0; i < k; i++) src.push_back(rng() % n);
        auto rm = bfs(g, src);
        for (int v = 0; v < n; v++) {
            int best = INFD;
            for (int x : src) best = min(best, f[x][v]);
            int want = best >= INFD ? -1 : best;
            if (rm.dist[v] != want) { printf("SAI nhiều nguồn iter=%d v=%d\n", iter, v); return 1; }
        }
    }
    // nguồn rỗng: mọi đỉnh -1
    {
        vector<vector<int>> g(3);
        auto r = bfs(g, {});
        for (int v = 0; v < 3; v++) if (r.dist[v] != -1) { puts("SAI nguồn rỗng"); return 1; }
    }
    // BFS lưới so với BFS trên đồ thị dựng từ lưới
    for (int iter = 0; iter < 500; iter++) {
        int R = 1 + rng() % 7, C = 1 + rng() % 7;
        vector<string> grid(R, string(C, '.'));
        for (auto& row : grid) for (auto& ch : row) if (rng() % 4 == 0) ch = '#';
        vector<vector<int>> g(R * C);
        for (int r = 0; r < R; r++)
            for (int c = 0; c < C; c++) {
                if (grid[r][c] == '#') continue;
                int dr[4] = {-1, 0, 1, 0}, dc[4] = {0, 1, 0, -1};
                for (int d = 0; d < 4; d++) {
                    int nr = r + dr[d], nc = c + dc[d];
                    if (nr >= 0 && nr < R && nc >= 0 && nc < C && grid[nr][nc] != '#') g[r * C + c].push_back(nr * C + nc);
                }
            }
        int sr = rng() % R, sc = rng() % C;
        auto d = grid_bfs(grid, sr, sc);
        if (grid[sr][sc] == '#') {
            for (int r = 0; r < R; r++) for (int c = 0; c < C; c++) if (d[r][c] != -1) { puts("SAI nguồn là tường"); return 1; }
            continue;
        }
        auto r2 = bfs(g, {sr * C + sc});
        for (int r = 0; r < R; r++)
            for (int c = 0; c < C; c++)
                if (d[r][c] != r2.dist[r * C + c]) { printf("SAI lưới iter=%d (%d,%d)\n", iter, r, c); return 1; }
    }
    // ví dụ trong mục: 0-1, 0-2, 1-3, 2-3, 3-4 (vô hướng) từ 0
    {
        vector<vector<int>> g(5);
        auto add = [&](int a, int b) { g[a].push_back(b); g[b].push_back(a); };
        add(0, 1); add(0, 2); add(1, 3); add(2, 3); add(3, 4);
        auto r = bfs(g, {0});
        vector<int> wantd = {0, 1, 1, 2, 3}, wantp = {0, 1, 3, 4};
        if (r.dist != wantd || bfs_path(r, 4) != wantp) { puts("SAI ví dụ"); return 1; }
    }
    // ca lớn: đường thẳng 10^6 đỉnh, lưới 2000 x 2000 trống
    {
        int n = 1000000;
        vector<vector<int>> g(n);
        for (int i = 0; i + 1 < n; i++) { g[i].push_back(i + 1); g[i + 1].push_back(i); }
        auto r = bfs(g, {0});
        if (r.dist[n - 1] != n - 1 || (int)bfs_path(r, n - 1).size() != n) { puts("SAI ca lớn (đường thẳng)"); return 1; }
        vector<string> grid(2000, string(2000, '.'));
        auto d = grid_bfs(grid, 0, 0);
        if (d[1999][1999] != 3998) { puts("SAI ca lớn (lưới)"); return 1; }
    }
    puts("OK");
    return 0;
}
