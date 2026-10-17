// @TEMPLATE

// Thử cầu & khớp: so với vét cạnh / vét đỉnh (bỏ đi rồi đếm lại thành phần bằng DSU) trên đồ thị ngẫu nhiên có cạnh song song, vòng tự trỏ,
// nhiều thành phần; đồ thị vừa; ca lớn 10^6 đỉnh (đường thẳng, vòng, sao).
static int count_components(int n, const vector<pair<int, int>>& es, int skipEdge, int skipVertex) {
    vector<int> p(n);
    iota(p.begin(), p.end(), 0);
    function<int(int)> find = [&](int x) { return p[x] == x ? x : p[x] = find(p[x]); };
    for (int i = 0; i < (int)es.size(); i++) {
        if (i == skipEdge || es[i].first == skipVertex || es[i].second == skipVertex) continue;
        p[find(es[i].first)] = find(es[i].second);
    }
    int c = 0;
    for (int v = 0; v < n; v++) if (v != skipVertex && find(v) == v) c++;
    return c;
}

static bool check_graph(int n, const vector<pair<int, int>>& es, const char* tag) {
    BridgeFinder bf(n);
    for (size_t i = 0; i < es.size(); i++) {
        int id = bf.add_edge(es[i].first, es[i].second);
        if (id != (int)i) { puts("SAI id cạnh"); return false; }
    }
    bf.run();
    int base = count_components(n, es, -1, -1);
    set<int> gotB(bf.bridges.begin(), bf.bridges.end());
    if (gotB.size() != bf.bridges.size()) { printf("SAI %s: cầu trùng\n", tag); return false; }
    for (int i = 0; i < (int)es.size(); i++) {
        bool isBridge = count_components(n, es, i, -1) > base;
        if (isBridge != (gotB.count(i) > 0)) { printf("SAI %s: cạnh %d (%d-%d) cầu=%d\n", tag, i, es[i].first, es[i].second, (int)isBridge); return false; }
    }
    for (int v = 0; v < n; v++) {
        bool isCut = count_components(n, es, -1, v) > base;
        if (isCut != (bf.is_cut[v] != 0)) { printf("SAI %s: đỉnh %d khớp=%d\n", tag, v, (int)isCut); return false; }
    }
    return true;
}

int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 4000; iter++) {
        int n = 1 + rng() % 8, m = rng() % 14;
        vector<pair<int, int>> es;
        for (int i = 0; i < m; i++) es.push_back({(int)(rng() % n), (int)(rng() % n)});
        if (!check_graph(n, es, "nhỏ")) { printf("(iter=%d n=%d m=%d)\n", iter, n, m); return 1; }
    }
    // đồ thị vừa (thưa, nhiều cầu)
    for (int iter = 0; iter < 40; iter++) {
        int n = 60, m = 40 + rng() % 40;
        vector<pair<int, int>> es;
        for (int i = 0; i < m; i++) es.push_back({(int)(rng() % n), (int)(rng() % n)});
        if (!check_graph(n, es, "vừa")) { printf("(iter=%d)\n", iter); return 1; }
    }
    // ví dụ trong mục
    {
        BridgeFinder bf(6);
        int pairs[6][2] = {{0, 1}, {1, 2}, {2, 0}, {1, 3}, {3, 4}, {4, 5}};
        for (auto& e : pairs) bf.add_edge(e[0], e[1]);
        bf.run();
        vector<int> b = bf.bridges;
        sort(b.begin(), b.end());
        vector<int> cuts;
        for (int v = 0; v < 6; v++) if (bf.is_cut[v]) cuts.push_back(v);
        if (b != vector<int>{3, 4, 5} || cuts != vector<int>{1, 3, 4}) { puts("SAI ví dụ"); return 1; }
    }
    // hai cạnh song song: không phải cầu; một cạnh duy nhất: cầu
    {
        BridgeFinder bf(3);
        bf.add_edge(0, 1); bf.add_edge(0, 1); bf.add_edge(1, 2);
        bf.run();
        if (bf.bridges != vector<int>{2} || !bf.is_cut[1] || bf.is_cut[0] || bf.is_cut[2]) { puts("SAI cạnh song song"); return 1; }
    }
    // đồ thị rỗng, một đỉnh
    { BridgeFinder bf(0); bf.run(); if (!bf.bridges.empty()) { puts("SAI rỗng"); return 1; } }
    { BridgeFinder bf(1); bf.add_edge(0, 0); bf.run(); if (!bf.bridges.empty() || bf.is_cut[0]) { puts("SAI vòng tự trỏ"); return 1; } }
    // ca lớn: đường thẳng, vòng, sao với 10^6 đỉnh
    {
        int n = 1000000;
        BridgeFinder path(n);
        for (int i = 0; i + 1 < n; i++) path.add_edge(i, i + 1);
        path.run();
        int cuts = 0;
        for (int v = 0; v < n; v++) cuts += path.is_cut[v];
        if ((int)path.bridges.size() != n - 1 || cuts != n - 2) { puts("SAI ca lớn đường thẳng"); return 1; }
        BridgeFinder ring(n);
        for (int i = 0; i < n; i++) ring.add_edge(i, (i + 1) % n);
        ring.run();
        cuts = 0;
        for (int v = 0; v < n; v++) cuts += ring.is_cut[v];
        if (!ring.bridges.empty() || cuts != 0) { puts("SAI ca lớn vòng"); return 1; }
        BridgeFinder star(n);
        for (int i = 1; i < n; i++) star.add_edge(0, i);
        star.run();
        cuts = 0;
        for (int v = 0; v < n; v++) cuts += star.is_cut[v];
        if ((int)star.bridges.size() != n - 1 || cuts != 1 || !star.is_cut[0]) { puts("SAI ca lớn sao"); return 1; }
    }
    puts("OK");
    return 0;
}
