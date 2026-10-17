// @TEMPLATE

// Thử HLD trên cây ngẫu nhiên (ngẫu nhiên đệ quy, đường thẳng, sao, nhị phân đầy), đỉnh gắn nhãn xáo trộn, gốc bất kỳ:
//  - lca khớp cách leo trực tiếp; path() phủ ĐÚNG tập đỉnh trên đường (đoạn rời nhau, l <= r), số đoạn <= 2*log2(n)+1; chế độ edges bỏ đúng đỉnh LCA;
//  - cây con của v = đoạn [pos[v], pos[v] + sz[v] - 1]; pos là hoán vị; mỗi chuỗi nặng liên tiếp; đỉnh con nặng có sz lớn nhất;
//  - HLDPathSum (Fenwick) so với cộng trực tiếp sau các lần cập nhật ngẫu nhiên; cây rất sâu (đường 100000 đỉnh) không tràn stack.
struct Ref {
    int n;
    vector<int> par, dep;
    vector<vector<int>> g;
    Ref(int n, const vector<pair<int, int>>& edges, int root) : n(n), par(n, -1), dep(n, 0), g(n) {
        for (auto& e : edges) { g[e.first].push_back(e.second); g[e.second].push_back(e.first); }
        vector<int> q = {root};
        for (size_t i = 0; i < q.size(); i++) for (int v : g[q[i]]) if (v != par[q[i]]) { par[v] = q[i]; dep[v] = dep[q[i]] + 1; q.push_back(v); }
    }
    vector<int> path(int u, int v) const {          // các đỉnh trên đường u..v
        vector<int> a, b;
        while (u != v) {
            if (dep[u] >= dep[v]) { a.push_back(u); u = par[u]; }
            else { b.push_back(v); v = par[v]; }
        }
        a.push_back(u);
        a.insert(a.end(), b.rbegin(), b.rend());
        return a;
    }
    int lca(int u, int v) const { while (u != v) { if (dep[u] >= dep[v]) u = par[u]; else v = par[v]; } return u; }
};

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

static bool kiem_tong_the(HLD& h, const Ref& ref, int root, const char* ctx) {
    int n = h.n;
    vector<char> seen(n, 0);
    for (int v = 0; v < n; v++) {
        if (h.pos[v] < 0 || h.pos[v] >= n || seen[h.pos[v]]) { printf("SAI %s: pos không phải hoán vị\n", ctx); return false; }
        seen[h.pos[v]] = 1;
        if (h.par[v] != ref.par[v] || h.dep[v] != ref.dep[v]) { printf("SAI %s: par/dep sai tại %d\n", ctx, v); return false; }
        int hv = h.heavy[v];
        if (hv != -1) {
            if (h.pos[hv] != h.pos[v] + 1 || h.head[hv] != h.head[v]) { printf("SAI %s: chuỗi nặng không liên tiếp\n", ctx); return false; }
            for (int c : ref.g[v]) if (c != ref.par[v] && h.sz[c] > h.sz[hv]) { printf("SAI %s: con nặng không phải con lớn nhất\n", ctx); return false; }
        }
        for (int c : ref.g[v]) if (c != ref.par[v] && c != hv && h.head[c] != c) { printf("SAI %s: con nhẹ phải là đầu chuỗi\n", ctx); return false; }
    }
    if (h.head[root] != root) { printf("SAI %s: gốc phải là đầu chuỗi\n", ctx); return false; }
    return true;
}

int main() {
    mt19937 rng(20261023);
    for (int iter = 0; iter < 1200; iter++) {
        int n = 1 + rng() % 14, kind = rng() % 4;
        auto edges = cay(rng, n, kind);
        int root = rng() % n;
        HLD h(n);
        for (auto& e : edges) h.add_edge(e.first, e.second);
        h.build(root);
        Ref ref(n, edges, root);
        if (!kiem_tong_the(h, ref, root, "nhỏ")) return 1;
        int lg = 0;
        while ((1 << (lg + 1)) <= n) lg++;
        // cây con
        for (int v = 0; v < n; v++) {
            vector<int> in;
            for (int x = 0; x < n; x++) {
                int y = x;
                while (y != -1 && y != v) y = ref.par[y];
                if (y == v) in.push_back(h.pos[x]);
            }
            sort(in.begin(), in.end());
            if ((int)in.size() != h.sz[v] || in.front() != h.pos[v] || in.back() != h.pos[v] + h.sz[v] - 1) { printf("SAI iter=%d: cây con của %d không liên tiếp\n", iter, v); return 1; }
        }
        for (int u = 0; u < n; u++)
            for (int v = 0; v < n; v++) {
                if (h.lca(u, v) != ref.lca(u, v)) { printf("SAI iter=%d: lca(%d,%d)\n", iter, u, v); return 1; }
                vector<int> on = ref.path(u, v);
                for (int mode = 0; mode < 2; mode++) {
                    vector<int> want;
                    for (int x : on) if (!(mode == 1 && x == ref.lca(u, v))) want.push_back(h.pos[x]);
                    sort(want.begin(), want.end());
                    vector<int> got;
                    int segs = 0;
                    bool bad = false;
                    h.path(u, v, [&](int l, int r) { segs++; if (l > r) bad = true; for (int i = l; i <= r; i++) got.push_back(i); }, mode == 1);
                    sort(got.begin(), got.end());
                    if (bad || got != want) { printf("SAI iter=%d: path(%d,%d,edges=%d) phủ sai tập đỉnh\n", iter, u, v, mode); return 1; }
                    if (segs > 2 * lg + 1) { printf("SAI iter=%d: path(%d,%d) có %d đoạn > %d\n", iter, u, v, segs, 2 * lg + 1); return 1; }
                }
            }
        // HLDPathSum
        HLDPathSum ps(h);
        vector<long long> val(n, 0);
        for (int op = 0; op < 40; op++) {
            if (rng() % 2) {
                int v = rng() % n;
                long long d = (long long)(rng() % 2001) - 1000;
                val[v] += d;
                ps.add(v, d);
            } else {
                int u = rng() % n, v = rng() % n;
                long long want = 0;
                for (int x : ref.path(u, v)) want += val[x];
                if (ps.query(u, v) != want) { printf("SAI iter=%d: tổng đường đi (%d,%d)\n", iter, u, v); return 1; }
            }
        }
    }
    // cây lớn
    for (int kind : {0, 1, 3, 2}) {
        int n = 100000;
        auto edges = cay(rng, n, kind);
        int root = rng() % n;
        HLD h(n);
        for (auto& e : edges) h.add_edge(e.first, e.second);
        h.build(root);
        Ref ref(n, edges, root);
        if (!kiem_tong_the(h, ref, root, "lớn")) return 1;
        HLDPathSum ps(h);
        vector<long long> val(n, 0);
        for (int i = 0; i < n; i += 7) { long long d = (long long)(rng() % 1000000007); val[i] += d; ps.add(i, d); }
        for (int q = 0; q < 150; q++) {
            int u = rng() % n, v = rng() % n;
            long long want = 0;
            int segs = 0;
            for (int x : ref.path(u, v)) want += val[x];
            if (ps.query(u, v) != want) { printf("SAI cây lớn kind=%d: tổng đường đi\n", kind); return 1; }
            h.path(u, v, [&](int, int) { segs++; });
            if (segs > 2 * 16 + 1) { printf("SAI cây lớn kind=%d: %d đoạn\n", kind, segs); return 1; }
        }
    }
    puts("OK");
    return 0;
}
