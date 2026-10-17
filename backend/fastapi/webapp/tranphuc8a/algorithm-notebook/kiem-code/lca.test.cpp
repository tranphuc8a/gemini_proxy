// @TEMPLATE

// Thử LCA binary lifting: so với cách đi lên từng bước (cha/độ sâu tính bằng DFS đệ quy ngay trong test) trên cây ngẫu nhiên nhiều dạng,
// tổ tiên thứ k, khoảng cách, cây một đỉnh, ca lớn (đường thẳng 200000, cây ngẫu nhiên 200000 với nhiều truy vấn).
namespace ref {
vector<int> par, dep;
void dfs(const vector<vector<int>>& g, int u, int p, int d) {
    par[u] = p;
    dep[u] = d;
    for (int v : g[u]) if (v != p) dfs(g, v, u, d + 1);
}
int lca(int a, int b) {
    while (dep[a] > dep[b]) a = par[a];
    while (dep[b] > dep[a]) b = par[b];
    while (a != b) { a = par[a]; b = par[b]; }
    return a;
}
}  // namespace ref

static vector<vector<int>> random_tree(int n, mt19937& rng, int mode) {
    vector<vector<int>> g(n);
    vector<int> label(n);
    iota(label.begin(), label.end(), 0);
    shuffle(label.begin(), label.end(), rng);  // nhãn ngẫu nhiên: gốc không phải lúc nào cũng là 0
    for (int i = 1; i < n; i++) {
        int p;
        if (mode == 0) p = rng() % i;                                   // cây ngẫu nhiên nông
        else if (mode == 1) p = i - 1;                                  // đường thẳng
        else p = max(0, i - 1 - (int)(rng() % 3));                      // sâu, ít nhánh
        g[label[i]].push_back(label[p]);
        g[label[p]].push_back(label[i]);
    }
    return g;
}

int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 3000; iter++) {
        int n = 1 + rng() % 40;
        auto g = random_tree(n, rng, rng() % 3);
        int root = rng() % n;
        Lca L(g, root);
        ref::par.assign(n, -1);
        ref::dep.assign(n, 0);
        ref::dfs(g, root, -1, 0);
        for (int v = 0; v < n; v++) if (L.depth[v] != ref::dep[v]) { printf("SAI depth iter=%d v=%d\n", iter, v); return 1; }
        for (int a = 0; a < n; a++)
            for (int b = 0; b < n; b++) {
                int want = ref::lca(a, b);
                if (L.lca(a, b) != want) { printf("SAI lca iter=%d (%d,%d) root=%d: %d != %d\n", iter, a, b, root, L.lca(a, b), want); return 1; }
                int wd = ref::dep[a] + ref::dep[b] - 2 * ref::dep[want];
                if (L.dist(a, b) != wd) { printf("SAI dist iter=%d\n", iter); return 1; }
            }
        for (int v = 0; v < n; v++)
            for (int k = 0; k <= n + 2; k++) {
                int want = v;
                bool ok = true;
                for (int i = 0; i < k && ok; i++) { if (ref::par[want] == -1) ok = false; else want = ref::par[want]; }
                if (!ok) want = -1;
                if (L.kth_ancestor(v, k) != want) { printf("SAI kth_ancestor iter=%d v=%d k=%d: %d != %d\n", iter, v, k, L.kth_ancestor(v, k), want); return 1; }
            }
        if (L.kth_ancestor(root, 0) != root || L.kth_ancestor(root, 1) != -1) { puts("SAI tổ tiên của gốc"); return 1; }
    }
    // cây một đỉnh
    { vector<vector<int>> g(1); Lca L(g, 0); if (L.lca(0, 0) != 0 || L.dist(0, 0) != 0 || L.kth_ancestor(0, 0) != 0 || L.kth_ancestor(0, 1) != -1) { puts("SAI một đỉnh"); return 1; } }
    // ví dụ trong mục
    {
        vector<vector<int>> g(7);
        auto add = [&](int a, int b) { g[a].push_back(b); g[b].push_back(a); };
        add(0, 1); add(0, 2); add(1, 3); add(1, 4); add(2, 5); add(2, 6);
        Lca L(g, 0);
        if (L.lca(3, 4) != 1 || L.lca(3, 5) != 0 || L.lca(4, 1) != 1 || L.dist(3, 5) != 4 || L.kth_ancestor(3, 2) != 0 || L.kth_ancestor(3, 3) != -1) { puts("SAI ví dụ"); return 1; }
    }
    // ca lớn 1: đường thẳng 200000 đỉnh (đệ quy sẽ tràn ngăn xếp), gốc ở một đầu
    {
        int n = 200000;
        vector<vector<int>> g(n);
        for (int i = 0; i + 1 < n; i++) { g[i].push_back(i + 1); g[i + 1].push_back(i); }
        Lca L(g, 0);
        if (L.depth[n - 1] != n - 1 || L.lca(0, n - 1) != 0 || L.lca(n - 1, n - 2) != n - 2 || L.dist(0, n - 1) != n - 1) { puts("SAI ca lớn đường thẳng"); return 1; }
        for (int i = 0; i < 1000; i++) {
            int v = rng() % n, k = rng() % (n + 5);
            int want = k <= v ? v - k : -1;
            if (L.kth_ancestor(v, k) != want) { puts("SAI ca lớn kth_ancestor"); return 1; }
            int a = rng() % n, b = rng() % n;
            if (L.lca(a, b) != min(a, b)) { puts("SAI ca lớn lca đường thẳng"); return 1; }
        }
    }
    // ca lớn 2: cây ngẫu nhiên 200000 đỉnh, 200000 truy vấn so với đi lên từng bước (cây nông)
    {
        int n = 200000;
        auto g = random_tree(n, rng, 0);
        int root = rng() % n;
        Lca L(g, root);
        // cha / độ sâu bằng BFS đơn giản trong test
        vector<int> par(n, -1), dep(n, -1);
        vector<int> q = {root};
        dep[root] = 0;
        for (size_t h = 0; h < q.size(); h++) {
            int u = q[h];
            for (int v : g[u]) if (dep[v] == -1) { dep[v] = dep[u] + 1; par[v] = u; q.push_back(v); }
        }
        for (int i = 0; i < 200000; i++) {
            int a = rng() % n, b = rng() % n;
            int x = a, y = b;
            while (dep[x] > dep[y]) x = par[x];
            while (dep[y] > dep[x]) y = par[y];
            while (x != y) { x = par[x]; y = par[y]; }
            if (L.lca(a, b) != x) { printf("SAI ca lớn ngẫu nhiên (%d,%d)\n", a, b); return 1; }
        }
    }
    // ca lớn 3: cây sâu (hàng chục nghìn mức) với ít truy vấn
    {
        int n = 200000;
        auto g = random_tree(n, rng, 2);
        int root = rng() % n;
        Lca L(g, root);
        vector<int> par(n, -1), dep(n, -1);
        vector<int> q = {root};
        dep[root] = 0;
        for (size_t h = 0; h < q.size(); h++) {
            int u = q[h];
            for (int v : g[u]) if (dep[v] == -1) { dep[v] = dep[u] + 1; par[v] = u; q.push_back(v); }
        }
        for (int i = 0; i < 200; i++) {
            int a = rng() % n, b = rng() % n;
            int x = a, y = b;
            while (dep[x] > dep[y]) x = par[x];
            while (dep[y] > dep[x]) y = par[y];
            while (x != y) { x = par[x]; y = par[y]; }
            if (L.lca(a, b) != x) { printf("SAI ca lớn sâu (%d,%d)\n", a, b); return 1; }
        }
    }
    puts("OK");
    return 0;
}
