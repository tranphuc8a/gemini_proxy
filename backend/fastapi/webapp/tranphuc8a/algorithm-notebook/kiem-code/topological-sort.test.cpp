// @TEMPLATE

// Thử sắp xếp topo (Kahn): DAG ngẫu nhiên (hoán vị + cạnh xuôi) phải cho thứ tự hợp lệ; đồ thị bất kỳ so với kiểm tra chu trình bằng bao đóng bắc cầu;
// thứ tự nhỏ nhất theo từ điển so với vét mọi hoán vị; ca lớn 10^6 đỉnh.
static bool valid_order(const vector<vector<int>>& g, const vector<int>& order) {
    int n = g.size();
    if ((int)order.size() != n) return false;
    vector<int> pos(n, -1);
    for (int i = 0; i < n; i++) {
        if (order[i] < 0 || order[i] >= n || pos[order[i]] != -1) return false;
        pos[order[i]] = i;
    }
    for (int u = 0; u < n; u++)
        for (int v : g[u]) if (pos[u] >= pos[v]) return false;
    return true;
}

int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 4000; iter++) {
        int n = 1 + rng() % 7, m = rng() % 14;
        bool forceDag = rng() % 2;
        vector<int> perm(n);
        iota(perm.begin(), perm.end(), 0);
        shuffle(perm.begin(), perm.end(), rng);
        vector<vector<int>> g(n);
        vector<vector<char>> reach(n, vector<char>(n, 0));
        for (int i = 0; i < m; i++) {
            int a = rng() % n, b = rng() % n;
            if (forceDag) {
                if (a == b) continue;
                // cạnh luôn đi từ vị trí nhỏ tới vị trí lớn trong hoán vị -> DAG
                int pa = find(perm.begin(), perm.end(), a) - perm.begin(), pb = find(perm.begin(), perm.end(), b) - perm.begin();
                if (pa > pb) swap(a, b);
            }
            g[a].push_back(b);
            reach[a][b] = 1;
        }
        // bao đóng bắc cầu: có chu trình <=> reach[i][i]
        for (int k = 0; k < n; k++)
            for (int i = 0; i < n; i++)
                for (int j = 0; j < n; j++) if (reach[i][k] && reach[k][j]) reach[i][j] = 1;
        bool cyclic = false;
        for (int i = 0; i < n; i++) if (reach[i][i]) cyclic = true;
        if (forceDag && cyclic) { puts("LỖI test: DAG sinh ra có chu trình"); return 1; }
        for (int smallest = 0; smallest < 2; smallest++) {
            vector<int> order;
            bool ok = topo_sort(g, order, smallest);
            if (ok == cyclic) { printf("SAI báo chu trình iter=%d smallest=%d (ok=%d)\n", iter, smallest, (int)ok); return 1; }
            if (ok && !valid_order(g, order)) { printf("SAI thứ tự topo iter=%d smallest=%d\n", iter, smallest); return 1; }
            if (!ok && (int)order.size() >= n) { puts("SAI: có chu trình mà order đủ đỉnh"); return 1; }
        }
        // nhỏ nhất theo từ điển: vét mọi hoán vị (n <= 7)
        if (!cyclic) {
            vector<int> p(n), best;
            iota(p.begin(), p.end(), 0);
            do {
                if (valid_order(g, p)) { best = p; break; }  // hoán vị đầu tiên theo từ điển hợp lệ = nhỏ nhất
            } while (next_permutation(p.begin(), p.end()));
            vector<int> order;
            topo_sort(g, order, true);
            if (order != best) { printf("SAI nhỏ nhất theo từ điển iter=%d\n", iter); return 1; }
        }
    }
    // đồ thị rỗng, một đỉnh, vòng tự trỏ
    { vector<vector<int>> g; vector<int> o; if (!topo_sort(g, o) || !o.empty()) { puts("SAI đồ thị rỗng"); return 1; } }
    { vector<vector<int>> g(1); vector<int> o; if (!topo_sort(g, o) || o != vector<int>{0}) { puts("SAI một đỉnh"); return 1; } }
    { vector<vector<int>> g(1); g[0].push_back(0); vector<int> o; if (topo_sort(g, o)) { puts("SAI vòng tự trỏ"); return 1; } }
    // cạnh song song: bậc vào phải đếm đủ
    { vector<vector<int>> g(2); g[0] = {1, 1, 1}; vector<int> o; if (!topo_sort(g, o) || o != vector<int>{0, 1}) { puts("SAI cạnh song song"); return 1; } }
    // ví dụ trong mục
    {
        vector<vector<int>> g(6);
        g[5] = {2, 0}; g[4] = {0, 1}; g[2] = {3}; g[3] = {1};
        vector<int> o, want = {4, 5, 0, 2, 3, 1};
        if (!topo_sort(g, o, true) || o != want) { puts("SAI ví dụ"); return 1; }
        g[1].push_back(5);
        if (topo_sort(g, o, true)) { puts("SAI ví dụ (chu trình)"); return 1; }
    }
    // ca lớn: DAG 10^6 đỉnh (đường thẳng + cạnh tắt), rồi đóng vòng
    {
        int n = 1000000;
        vector<vector<int>> g(n);
        for (int i = 0; i + 1 < n; i++) g[i].push_back(i + 1);
        for (int i = 0; i + 2 < n; i += 2) g[i].push_back(i + 2);
        vector<int> o;
        if (!topo_sort(g, o) || !valid_order(g, o)) { puts("SAI ca lớn DAG"); return 1; }
        if (!topo_sort(g, o, true) || !valid_order(g, o)) { puts("SAI ca lớn DAG (heap)"); return 1; }
        g[n - 1].push_back(0);
        if (topo_sort(g, o)) { puts("SAI ca lớn chu trình"); return 1; }
    }
    puts("OK");
    return 0;
}
