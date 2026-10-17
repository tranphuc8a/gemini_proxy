// @TEMPLATE

// Thử DFS vòng lặp: so với bản đệ quy chuẩn (cùng thứ tự kề -> tin/tout/par/order phải y hệt), cờ chu trình so với Kahn,
// thành phần của đồ thị vô hướng so với DSU, is_ancestor so với đi ngược par, ca lớn 10^6 đỉnh (không tràn ngăn xếp).
namespace ref {
vector<int> tin, tout, par, order;
int timer;
bool back;
const vector<vector<int>>* G;
void go(int u) {
    tin[u] = timer++;
    order.push_back(u);
    for (int v : (*G)[u]) {
        if (tin[v] == -1) { par[v] = u; go(v); }
        else if (tout[v] == -1) back = true;
    }
    tout[u] = timer;
}
}  // namespace ref

int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 4000; iter++) {
        int n = 1 + rng() % 9, m = rng() % 16;
        bool undirected = rng() % 2;
        vector<vector<int>> g(n);
        vector<pair<int, int>> es;
        for (int i = 0; i < m; i++) {
            int u = rng() % n, v = rng() % n;
            g[u].push_back(v);
            if (undirected) g[v].push_back(u);
            es.push_back({u, v});
        }
        // bản đệ quy chuẩn
        using namespace ref;
        tin.assign(n, -1); tout.assign(n, -1); par.assign(n, -1); order.clear(); timer = 0; back = false; G = &g;
        int comps = 0;
        vector<int> comp(n, -1);
        for (int s = 0; s < n; s++) if (tin[s] == -1) { go(s); comps++; }
        auto r = dfs_all(g);
        if (r.tin != tin || r.tout != tout || r.par != par || r.order != order || r.comps != comps) { printf("SAI khác bản đệ quy iter=%d\n", iter); return 1; }
        if (r.has_back_edge != back) { printf("SAI has_back_edge iter=%d\n", iter); return 1; }
        // đồ thị có hướng: has_back_edge <=> có chu trình (Kahn)
        if (!undirected) {
            vector<int> indeg(n, 0);
            for (int u = 0; u < n; u++) for (int v : g[u]) indeg[v]++;
            vector<int> q;
            for (int i = 0; i < n; i++) if (!indeg[i]) q.push_back(i);
            size_t head = 0;
            while (head < q.size()) { int u = q[head++]; for (int v : g[u]) if (--indeg[v] == 0) q.push_back(v); }
            bool cyclic = (int)q.size() < n;
            if (cyclic != r.has_back_edge) { printf("SAI chu trình iter=%d (kahn=%d dfs=%d)\n", iter, (int)cyclic, (int)r.has_back_edge); return 1; }
        } else {
            // vô hướng: comp = thành phần liên thông (DSU)
            vector<int> p(n);
            iota(p.begin(), p.end(), 0);
            function<int(int)> find = [&](int x) { return p[x] == x ? x : p[x] = find(p[x]); };
            for (auto [u, v] : es) p[find(u)] = find(v);
            for (int u = 0; u < n; u++)
                for (int v = 0; v < n; v++)
                    if ((find(u) == find(v)) != (r.comp[u] == r.comp[v])) { printf("SAI comp iter=%d\n", iter); return 1; }
        }
        // is_ancestor so với đi ngược par
        for (int u = 0; u < n; u++)
            for (int v = 0; v < n; v++) {
                bool want = false;
                for (int x = v; x != -1; x = r.par[x]) if (x == u) { want = true; break; }
                if (r.is_ancestor(u, v) != want) { printf("SAI is_ancestor iter=%d u=%d v=%d\n", iter, u, v); return 1; }
            }
    }
    // đồ thị rỗng
    { vector<vector<int>> g; auto r = dfs_all(g); if (r.comps != 0 || r.has_back_edge) { puts("SAI đồ thị rỗng"); return 1; } }
    // vòng tự trỏ có hướng là chu trình
    { vector<vector<int>> g(1); g[0].push_back(0); if (!dfs_all(g).has_back_edge) { puts("SAI vòng tự trỏ"); return 1; } }
    // ví dụ trong mục
    {
        vector<vector<int>> g(6);
        g[0] = {1, 2}; g[1] = {3}; g[2] = {3}; g[4] = {5};
        auto r = dfs_all(g);
        vector<int> wantOrder = {0, 1, 3, 2, 4, 5}, wantTin = {0, 1, 3, 2, 4, 5};
        if (r.order != wantOrder || r.tin != wantTin || r.comps != 2 || r.has_back_edge) { puts("SAI ví dụ"); return 1; }
        if (!r.is_ancestor(1, 3) || r.is_ancestor(2, 3)) { puts("SAI ví dụ (tổ tiên)"); return 1; }
    }
    // ca lớn: đường thẳng 10^6 đỉnh (đệ quy sẽ tràn ngăn xếp), có hướng và vô hướng
    {
        int n = 1000000;
        vector<vector<int>> g(n);
        for (int i = 0; i + 1 < n; i++) g[i].push_back(i + 1);
        auto r = dfs_all(g);
        if (r.comps != 1 || r.has_back_edge || r.tout[0] != n || r.tin[n - 1] != n - 1 || !r.is_ancestor(0, n - 1)) { puts("SAI ca lớn có hướng"); return 1; }
        g[n - 1].push_back(0);  // đóng vòng
        if (!dfs_all(g).has_back_edge) { puts("SAI ca lớn: thiếu chu trình"); return 1; }
    }
    puts("OK");
    return 0;
}
