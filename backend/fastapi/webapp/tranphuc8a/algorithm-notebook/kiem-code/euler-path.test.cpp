// @TEMPLATE

// Thử Euler (Hierholzer) cho đồ thị VÔ HƯỚNG và CÓ HƯỚNG:
//  - đồ thị ngẫu nhiên nhỏ (có cạnh song song, vòng tự trỏ, đỉnh cô lập, không liên thông): path() rỗng khi và chỉ khi vét cạn (thử mọi thứ tự cạnh) không có đường Euler;
//    khi có thì dãy đỉnh phải dùng mỗi cạnh đúng một lần;
//  - đồ thị lớn Euler (chuỗi các chu trình nối nhau): có chu trình hợp lệ; bỏ một cạnh -> đường đi bắt đầu/kết thúc đúng chỗ; hai chu trình rời nhau -> rỗng;
//  - đường 4e5 cạnh (đệ quy sẽ tràn stack).
typedef vector<pair<int, int>> Edges;

static bool hop_le(const vector<int>& p, const Edges& es, bool directed) {
    if (p.size() != es.size() + 1) return false;
    Edges a, b;
    for (auto e : es) { if (!directed && e.first > e.second) swap(e.first, e.second); a.push_back(e); }
    for (size_t i = 0; i + 1 < p.size(); i++) {
        pair<int, int> e = {p[i], p[i + 1]};
        if (!directed && e.first > e.second) swap(e.first, e.second);
        b.push_back(e);
    }
    sort(a.begin(), a.end());
    sort(b.begin(), b.end());
    return a == b;
}

static bool vet_can(int cur, int cnt, const Edges& es, vector<char>& used, bool directed) {
    if (cnt == (int)es.size()) return true;
    for (size_t i = 0; i < es.size(); i++) {
        if (used[i]) continue;
        int to = -1;
        if (es[i].first == cur) to = es[i].second;
        else if (!directed && es[i].second == cur) to = es[i].first;
        if (to < 0) continue;
        used[i] = 1;
        bool ok = vet_can(to, cnt + 1, es, used, directed);
        used[i] = 0;
        if (ok) return true;
    }
    return false;
}

static vector<int> chay(int n, const Edges& es, bool directed) {
    Euler eu(n, directed);
    for (auto& e : es) eu.add_edge(e.first, e.second);
    return eu.path();
}

int main() {
    mt19937 rng(20261025);
    for (int iter = 0; iter < 6000; iter++) {
        bool directed = iter % 2 == 0;
        int n = 1 + rng() % 6, m = rng() % 9;
        Edges es;
        for (int i = 0; i < m; i++) es.push_back({(int)(rng() % n), (int)(rng() % n)});
        // một nửa số ca: ép đồ thị Euler bằng cách nối thành chu trình rồi bỏ bớt / thêm cạnh
        if (iter % 4 >= 2 && m >= 3) {
            es.clear();
            int len = 3 + rng() % 6;
            int cur = rng() % n, first = cur;
            for (int i = 0; i < len; i++) { int nx = i + 1 == len ? first : (int)(rng() % n); es.push_back({cur, nx}); cur = nx; }
            if (rng() % 2) es.erase(es.begin() + rng() % es.size());
        }
        vector<int> p = chay(n, es, directed);
        bool exists = false;
        if (!es.empty()) {
            vector<char> used(es.size(), 0);
            for (int s = 0; s < n && !exists; s++) exists = vet_can(s, 0, es, used, directed);
        }
        if (exists != !p.empty()) { printf("SAI iter=%d directed=%d: vét cạn %d, mẫu %d\n", iter, directed, (int)exists, (int)!p.empty()); return 1; }
        if (!p.empty() && !hop_le(p, es, directed)) { printf("SAI iter=%d directed=%d: dãy đỉnh không dùng mỗi cạnh đúng một lần\n", iter, directed); return 1; }
    }
    // đồ thị lớn: chuỗi chu trình nối nhau tại đỉnh đã dùng
    for (int directed = 0; directed < 2; directed++) {
        int n = 100000;
        Edges es;
        vector<int> used = {0};
        for (int c = 0; c < 4000; c++) {
            int len = 2 + rng() % 60;
            int first = used[rng() % used.size()], cur = first;
            for (int i = 0; i < len; i++) {
                int nx = i + 1 == len ? first : (int)(rng() % n);
                es.push_back({cur, nx});
                used.push_back(nx);
                cur = nx;
            }
        }
        vector<int> p = chay(n, es, directed);
        if (p.empty() || !hop_le(p, es, directed)) { printf("SAI chu trình lớn directed=%d\n", directed); return 1; }
        if (p.front() != p.back()) { puts("SAI: đồ thị cân bằng phải cho chu trình (đầu = cuối)"); return 1; }
        // bỏ một cạnh (u, v): có hướng -> đường đi từ v tới u; vô hướng -> hai đầu là u và v (nếu u != v)
        size_t k = rng() % es.size();
        pair<int, int> cut = es[k];
        es.erase(es.begin() + k);
        p = chay(n, es, directed);
        if (cut.first != cut.second) {
            if (p.empty() || !hop_le(p, es, directed)) { printf("SAI đường Euler lớn directed=%d\n", directed); return 1; }
            if (directed) { if (p.front() != cut.second || p.back() != cut.first) { puts("SAI điểm đầu/cuối đường có hướng"); return 1; } }
            else if (!((p.front() == cut.first && p.back() == cut.second) || (p.front() == cut.second && p.back() == cut.first))) { puts("SAI hai đầu đường vô hướng"); return 1; }
        }
    }
    // hai chu trình rời nhau -> không có đường Euler
    for (int directed = 0; directed < 2; directed++) {
        Edges es = {{0, 1}, {1, 2}, {2, 0}, {3, 4}, {4, 5}, {5, 3}};
        if (!chay(6, es, directed).empty()) { puts("SAI hai chu trình rời nhau phải rỗng"); return 1; }
    }
    // không có cạnh nào
    if (!chay(5, {}, true).empty() || !chay(5, {}, false).empty()) { puts("SAI đồ thị không cạnh"); return 1; }
    // đường 4e5 cạnh
    {
        int m = 400000;
        Edges es;
        for (int i = 0; i < m; i++) es.push_back({i, i + 1});
        vector<int> p = chay(m + 1, es, true);
        if ((int)p.size() != m + 1 || p.front() != 0 || p.back() != m) { puts("SAI đường có hướng 4e5 cạnh"); return 1; }
        vector<int> q = chay(m + 1, es, false);
        if ((int)q.size() != m + 1 || !hop_le(q, es, false)) { puts("SAI đường vô hướng 4e5 cạnh"); return 1; }
    }
    puts("OK");
    return 0;
}
