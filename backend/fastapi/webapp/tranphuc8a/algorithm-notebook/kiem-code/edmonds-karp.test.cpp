// @TEMPLATE

// Thử Edmonds–Karp: (1) so với cắt nhỏ nhất vét cạn (max-flow = min-cut) trên đồ thị ngẫu nhiên nhỏ có cạnh song song, vòng tự trỏ, dung lượng 0,
// s == t, cả có hướng lẫn vô hướng; (2) luồng hợp lệ (không vượt dung lượng, bảo toàn tại đỉnh); (3) cắt min_cut_side có dung lượng đúng bằng luồng;
// (4) đồ thị vừa với dung lượng tới 1e12 (số lần tăng không được phụ thuộc giá trị dung lượng).
struct TE { int u, v; long long c; };

static bool kiem_luong(const EdmondsKarp& d, const vector<int>& ids, const vector<TE>& es, int n, int s, int t, long long flow, const char* ctx) {
    vector<long long> bal(n, 0);
    for (size_t i = 0; i < es.size(); i++) {
        long long f = d.e[ids[i] ^ 1].cap;
        if (f < 0 || f > es[i].c) { printf("SAI %s: luồng trên cạnh %zu vượt dung lượng\n", ctx, i); return false; }
        if (d.e[ids[i]].cap != es[i].c - f) { printf("SAI %s: dung lượng còn lại không khớp\n", ctx); return false; }
        bal[es[i].u] -= f; bal[es[i].v] += f;
    }
    for (int v = 0; v < n; v++)
        if (v != s && v != t && bal[v] != 0) { printf("SAI %s: không bảo toàn luồng tại %d\n", ctx, v); return false; }
    if (s != t && (bal[t] != flow || bal[s] != -flow)) { printf("SAI %s: luồng ra s / vào t khác giá trị trả về\n", ctx); return false; }
    return true;
}

static bool kiem_cat(EdmondsKarp& d, const vector<TE>& es, int s, int t, long long flow, bool vo_huong, const char* ctx) {
    vector<char> side = d.min_cut_side(s);
    if (!side[s] || side[t]) { printf("SAI %s: s phải thuộc phía s, t thì không\n", ctx); return false; }
    long long cut = 0;
    for (const TE& e : es) {
        bool a = side[e.u], b = side[e.v];
        if (a && !b) cut += e.c;
        if (vo_huong && !a && b) cut += e.c;
    }
    if (cut != flow) { printf("SAI %s: cắt có dung lượng %lld khác luồng %lld\n", ctx, cut, flow); return false; }
    return true;
}

int main() {
    mt19937_64 rng(20261018);
    for (int iter = 0; iter < 4000; iter++) {
        int n = 2 + rng() % 6, m = rng() % 15;
        int s = rng() % n, t = rng() % n;
        if (iter % 10 == 9) t = s;
        bool vo_huong = iter % 3 == 0;
        EdmondsKarp d(n);
        vector<TE> es;
        vector<int> ids;
        for (int i = 0; i < m; i++) {
            int u = rng() % n, v = rng() % n;
            long long c = rng() % 9;
            ids.push_back(vo_huong ? d.add_edge(u, v, c, c) : d.add_edge(u, v, c));
            es.push_back({u, v, c});
        }
        long long flow = d.max_flow(s, t);
        long long best = 0;
        if (s != t) {
            best = LLONG_MAX;
            for (int mask = 0; mask < (1 << n); mask++) {
                if (!((mask >> s) & 1) || ((mask >> t) & 1)) continue;
                long long cut = 0;
                for (const TE& e : es) {
                    bool a = (mask >> e.u) & 1, b = (mask >> e.v) & 1;
                    if (a && !b) cut += e.c;
                    if (vo_huong && !a && b) cut += e.c;
                }
                best = min(best, cut);
            }
        }
        if (flow != best) { printf("SAI iter=%d: luồng %lld, cắt nhỏ nhất vét cạn %lld\n", iter, flow, best); return 1; }
        if (!vo_huong && !kiem_luong(d, ids, es, n, s, t, flow, "nhỏ")) return 1;
        if (s != t && !kiem_cat(d, es, s, t, flow, vo_huong, "nhỏ")) return 1;
    }
    // ca vừa: 300 đỉnh, 3000 cạnh, dung lượng tới 1e12
    {
        int n = 300, m = 3000;
        EdmondsKarp d(n);
        vector<TE> es;
        vector<int> ids;
        for (int i = 0; i < m; i++) {
            int u = rng() % n, v = rng() % n;
            long long c = 1 + rng() % 1000000000000LL;
            ids.push_back(d.add_edge(u, v, c));
            es.push_back({u, v, c});
        }
        long long flow = d.max_flow(0, n - 1);
        if (flow <= 0) { puts("SAI ca vừa: luồng phải dương"); return 1; }
        if (!kiem_luong(d, ids, es, n, 0, n - 1, flow, "vừa") || !kiem_cat(d, es, 0, n - 1, flow, false, "vừa")) return 1;
    }
    // ví dụ kinh điển khiến DFS chọn đường xấu sẽ tăng 1 đơn vị mỗi lần (2e9 lần): ở đây BFS chỉ cần 2 lần tăng
    {
        EdmondsKarp d(4);
        long long B = 1000000000LL;
        d.add_edge(0, 1, B); d.add_edge(0, 2, B); d.add_edge(1, 2, 1); d.add_edge(1, 3, B); d.add_edge(2, 3, B);
        if (d.max_flow(0, 3) != 2 * B) { puts("SAI ví dụ dung lượng lớn"); return 1; }
    }
    puts("OK");
    return 0;
}
