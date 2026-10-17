// @TEMPLATE

// Thử Dinic: (1) so với cắt nhỏ nhất vét cạn trên đồ thị ngẫu nhiên nhỏ (max-flow = min-cut): có cạnh song song, vòng tự trỏ, cạnh vào s / ra t,
// dung lượng 0, s == t, cả đồ thị có hướng lẫn vô hướng; (2) luồng phải hợp lệ (không vượt dung lượng, bảo toàn tại đỉnh) và cắt in_cut_side
// phải có dung lượng đúng bằng luồng (chứng chỉ tối ưu); (3) đồ thị lớn, dung lượng tới 1e12.
struct TE { int u, v; long long c; };

static bool kiem_luong(const Dinic& d, const vector<int>& ids, const vector<TE>& es, int n, int s, int t, long long flow, const char* ctx) {
    vector<long long> bal(n, 0);
    for (size_t i = 0; i < es.size(); i++) {
        long long f = d.e[ids[i] ^ 1].cap;   // rev_cap = 0 nên cạnh ngược giữ đúng lượng luồng
        if (f < 0 || f > es[i].c) { printf("SAI %s: luồng trên cạnh %zu vượt dung lượng\n", ctx, i); return false; }
        if (d.e[ids[i]].cap != es[i].c - f) { printf("SAI %s: dung lượng còn lại không khớp cạnh %zu\n", ctx, i); return false; }
        bal[es[i].u] -= f; bal[es[i].v] += f;
    }
    for (int v = 0; v < n; v++)
        if (v != s && v != t && bal[v] != 0) { printf("SAI %s: không bảo toàn luồng tại đỉnh %d\n", ctx, v); return false; }
    if (s != t && (bal[t] != flow || bal[s] != -flow)) { printf("SAI %s: luồng ra khỏi s / vào t khác giá trị trả về\n", ctx); return false; }
    return true;
}

static bool kiem_cat(const Dinic& d, const vector<TE>& es, int s, int t, long long flow, bool vo_huong, const char* ctx) {
    if (!d.in_cut_side(s) || d.in_cut_side(t)) { printf("SAI %s: s phải thuộc phía s và t thì không\n", ctx); return false; }
    long long cut = 0;
    for (const TE& e : es) {
        bool a = d.in_cut_side(e.u), b = d.in_cut_side(e.v);
        if (a && !b) cut += e.c;
        if (vo_huong && !a && b) cut += e.c;
    }
    if (cut != flow) { printf("SAI %s: cắt in_cut_side có dung lượng %lld khác luồng %lld\n", ctx, cut, flow); return false; }
    return true;
}

int main() {
    mt19937_64 rng(20261017);
    for (int iter = 0; iter < 4000; iter++) {
        int n = 2 + rng() % 6, m = rng() % 15;
        int s = rng() % n, t = rng() % n;
        if (iter % 10 == 9) t = s;                 // s == t -> luồng 0
        bool vo_huong = iter % 3 == 0;
        Dinic d(n);
        vector<TE> es;
        vector<int> ids;
        for (int i = 0; i < m; i++) {
            int u = rng() % n, v = rng() % n;
            long long c = rng() % 9;               // có cả dung lượng 0
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

    // ca lớn 1: đồ thị có hướng ngẫu nhiên 2000 đỉnh, 20000 cạnh, dung lượng tới 1e12 (tổng luồng vượt int32 rất xa)
    {
        int n = 2000, m = 20000;
        Dinic d(n);
        vector<TE> es;
        vector<int> ids;
        for (int i = 0; i < m; i++) {
            int u = rng() % n, v = rng() % n;
            long long c = 1 + rng() % 1000000000000LL;
            ids.push_back(d.add_edge(u, v, c));
            es.push_back({u, v, c});
        }
        long long flow = d.max_flow(0, n - 1);
        if (flow <= 0) { puts("SAI ca lớn 1: luồng phải dương"); return 1; }
        if (!kiem_luong(d, ids, es, n, 0, n - 1, flow, "lớn 1") || !kiem_cat(d, es, 0, n - 1, flow, false, "lớn 1")) return 1;
    }
    // ca lớn 2: lưới 150 x 150 vô hướng, dung lượng 1..1000, từ góc này sang góc kia
    {
        int w = 150, n = w * w;
        Dinic d(n);
        vector<TE> es;
        auto id = [&](int r, int c) { return r * w + c; };
        for (int r = 0; r < w; r++)
            for (int c = 0; c < w; c++) {
                if (c + 1 < w) { long long x = 1 + rng() % 1000; d.add_edge(id(r, c), id(r, c + 1), x, x); es.push_back({id(r, c), id(r, c + 1), x}); }
                if (r + 1 < w) { long long x = 1 + rng() % 1000; d.add_edge(id(r, c), id(r + 1, c), x, x); es.push_back({id(r, c), id(r + 1, c), x}); }
            }
        long long flow = d.max_flow(0, n - 1);
        if (flow <= 0 || !kiem_cat(d, es, 0, n - 1, flow, true, "lưới")) return 1;
    }
    // ca lớn 3: mạng ghép cặp đơn vị 20000 + 20000 đỉnh, có sẵn ghép cặp hoàn hảo -> luồng phải đúng bằng 20000
    {
        int k = 20000, n = 2 * k + 2, s = n - 2, t = n - 1;
        Dinic d(n);
        vector<int> perm(k);
        iota(perm.begin(), perm.end(), 0);
        shuffle(perm.begin(), perm.end(), rng);
        for (int i = 0; i < k; i++) {
            d.add_edge(s, i, 1);
            d.add_edge(k + i, t, 1);
            d.add_edge(i, k + perm[i], 1);
            for (int j = 0; j < 4; j++) d.add_edge(i, k + (int)(rng() % k), 1);
        }
        long long flow = d.max_flow(s, t);
        if (flow != k) { printf("SAI ghép cặp đơn vị: %lld thay vì %d\n", flow, k); return 1; }
    }
    // đường dài 3000 đỉnh: độ sâu đệ quy 3000 vẫn an toàn
    {
        int n = 3000;
        Dinic d(n);
        for (int i = 0; i + 1 < n; i++) d.add_edge(i, i + 1, 5);
        if (d.max_flow(0, n - 1) != 5) { puts("SAI đường dài"); return 1; }
    }
    puts("OK");
    return 0;
}
