// @TEMPLATE

// Thử SCC (Tarjan vòng lặp): so với bao đóng bắc cầu trên đồ thị ngẫu nhiên nhỏ, so với Kosaraju (đệ quy, viết ngay trong test) trên đồ thị vừa,
// tính chất thứ tự topo ngược của comp, đồ thị cô đặc, ca lớn 10^6 đỉnh (đường thẳng và vòng; đệ quy sẽ tràn ngăn xếp).
namespace kos {
vector<vector<int>> g, rg;
vector<int> order, label;
vector<char> seen;
void dfs1(int u) { seen[u] = 1; for (int v : g[u]) if (!seen[v]) dfs1(v); order.push_back(u); }
void dfs2(int u, int c) { label[u] = c; for (int v : rg[u]) if (label[v] == -1) dfs2(v, c); }
vector<int> run(const vector<vector<int>>& graph) {
    int n = graph.size();
    g = graph; rg.assign(n, {}); order.clear(); label.assign(n, -1); seen.assign(n, 0);
    for (int u = 0; u < n; u++) for (int v : g[u]) rg[v].push_back(u);
    for (int u = 0; u < n; u++) if (!seen[u]) dfs1(u);
    int c = 0;
    for (int i = n - 1; i >= 0; i--) if (label[order[i]] == -1) dfs2(order[i], c++);
    return label;
}
}  // namespace kos

// hai cách gán nhãn là cùng một phân hoạch?
static bool same_partition(const vector<int>& a, const vector<int>& b) {
    map<int, int> ab, ba;
    for (size_t i = 0; i < a.size(); i++) {
        if (ab.count(a[i]) && ab[a[i]] != b[i]) return false;
        if (ba.count(b[i]) && ba[b[i]] != a[i]) return false;
        ab[a[i]] = b[i];
        ba[b[i]] = a[i];
    }
    return true;
}

int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 4000; iter++) {
        int n = 1 + rng() % 8, m = rng() % 18;
        Scc s(n);
        vector<vector<char>> reach(n, vector<char>(n, 0));
        for (int i = 0; i < n; i++) reach[i][i] = 1;
        vector<pair<int, int>> es;
        for (int i = 0; i < m; i++) {
            int u = rng() % n, v = rng() % n;
            s.add_edge(u, v);
            reach[u][v] = 1;
            es.push_back({u, v});
        }
        for (int k = 0; k < n; k++)
            for (int i = 0; i < n; i++)
                for (int j = 0; j < n; j++) if (reach[i][k] && reach[k][j]) reach[i][j] = 1;
        s.run();
        set<int> labels;
        for (int u = 0; u < n; u++) {
            if (s.comp[u] < 0 || s.comp[u] >= s.count) { puts("SAI nhãn ngoài miền"); return 1; }
            labels.insert(s.comp[u]);
            for (int v = 0; v < n; v++)
                if ((s.comp[u] == s.comp[v]) != (reach[u][v] && reach[v][u])) { printf("SAI phân hoạch iter=%d (%d,%d)\n", iter, u, v); return 1; }
        }
        if ((int)labels.size() != s.count) { printf("SAI count iter=%d\n", iter); return 1; }
        for (auto [u, v] : es)
            if (s.comp[u] != s.comp[v] && s.comp[u] < s.comp[v]) { printf("SAI thứ tự topo ngược iter=%d\n", iter); return 1; }
        // đồ thị cô đặc: đúng tập cạnh chéo SCC, không trùng, không chu trình
        auto dag = s.condensation();
        set<pair<int, int>> want, got;
        for (auto [u, v] : es) if (s.comp[u] != s.comp[v]) want.insert({s.comp[u], s.comp[v]});
        for (int a = 0; a < (int)dag.size(); a++) {
            for (size_t i = 0; i < dag[a].size(); i++) {
                if (i && dag[a][i] == dag[a][i - 1]) { puts("SAI cô đặc: cạnh trùng"); return 1; }
                got.insert({a, dag[a][i]});
            }
        }
        if ((int)dag.size() != s.count || got != want) { printf("SAI đồ thị cô đặc iter=%d\n", iter); return 1; }
        for (auto [a, b] : got) if (a <= b) { puts("SAI cô đặc không giảm dần"); return 1; }
    }
    // đồ thị vừa so với Kosaraju
    for (int iter = 0; iter < 30; iter++) {
        int n = 2000, m = (iter % 2 ? 2400 : 5000);
        Scc s(n);
        vector<vector<int>> g(n);
        for (int i = 0; i < m; i++) { int u = rng() % n, v = rng() % n; s.add_edge(u, v); g[u].push_back(v); }
        s.run();
        if (!same_partition(s.comp, kos::run(g))) { printf("SAI so với Kosaraju iter=%d\n", iter); return 1; }
    }
    // ví dụ trong mục
    {
        Scc s(6);
        s.add_edge(0, 1); s.add_edge(1, 2); s.add_edge(2, 0); s.add_edge(2, 3); s.add_edge(3, 4); s.add_edge(4, 5); s.add_edge(5, 3);
        s.run();
        vector<int> want = {1, 1, 1, 0, 0, 0};
        if (s.comp != want || s.count != 2) { puts("SAI ví dụ"); return 1; }
        auto dag = s.condensation();
        if (dag[1] != vector<int>{0} || !dag[0].empty()) { puts("SAI ví dụ (cô đặc)"); return 1; }
    }
    // đồ thị rỗng, một đỉnh, vòng tự trỏ
    { Scc s(0); s.run(); if (s.count != 0) { puts("SAI rỗng"); return 1; } }
    { Scc s(1); s.add_edge(0, 0); s.run(); if (s.count != 1) { puts("SAI vòng tự trỏ"); return 1; } }
    // ca lớn: đường thẳng 10^6 đỉnh (mỗi đỉnh một SCC), sau đó đóng vòng (một SCC)
    {
        int n = 1000000;
        Scc s(n);
        for (int i = 0; i + 1 < n; i++) s.add_edge(i, i + 1);
        s.run();
        if (s.count != n) { puts("SAI ca lớn đường thẳng"); return 1; }
        for (int i = 0; i + 1 < n; i++) if (s.comp[i] <= s.comp[i + 1]) { puts("SAI ca lớn thứ tự"); return 1; }
        Scc t(n);
        for (int i = 0; i < n; i++) t.add_edge(i, (i + 1) % n);
        t.run();
        if (t.count != 1) { puts("SAI ca lớn vòng"); return 1; }
    }
    puts("OK");
    return 0;
}
