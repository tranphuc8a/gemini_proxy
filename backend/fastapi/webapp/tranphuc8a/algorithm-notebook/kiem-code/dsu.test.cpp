// @TEMPLATE

// Thử DSU với cách gán nhãn thành phần vét cạn (đổi nhãn cả thành phần), gồm cả kiểm tra comps / size / same;
// thử RollbackDSU với bản sao trạng thái nhãn tại mỗi snapshot rồi hoàn tác. Ca lớn: đường thẳng 10^6 đỉnh (find phải không đệ quy).
int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 3000; iter++) {
        int n = 1 + rng() % 12;
        DSU d(n);
        vector<int> lab(n);
        iota(lab.begin(), lab.end(), 0);
        int comps = n;
        for (int step = 0; step < 30; step++) {
            int a = rng() % n, b = rng() % n;
            bool merged = d.unite(a, b);
            bool want = lab[a] != lab[b];
            if (want) {
                int from = lab[b], to = lab[a];
                for (int& x : lab) if (x == from) x = to;
                comps--;
            }
            if (merged != want || d.comps != comps) { printf("SAI unite iter=%d\n", iter); return 1; }
            for (int i = 0; i < n; i++) {
                int sz = count(lab.begin(), lab.end(), lab[i]);
                if (d.size(i) != sz) { printf("SAI size iter=%d i=%d\n", iter, i); return 1; }
                for (int j = 0; j < n; j++) if (d.same(i, j) != (lab[i] == lab[j])) { printf("SAI same iter=%d\n", iter); return 1; }
            }
        }
    }
    for (int iter = 0; iter < 3000; iter++) {
        int n = 1 + rng() % 12;
        RollbackDSU d(n);
        vector<int> lab(n);
        iota(lab.begin(), lab.end(), 0);
        vector<pair<int, vector<int>>> snaps;                     // (snapshot của DSU, nhãn tại thời điểm đó)
        for (int step = 0; step < 40; step++) {
            int op = rng() % 5;
            if (op <= 2) {
                int a = rng() % n, b = rng() % n;
                bool merged = d.unite(a, b);
                bool want = lab[a] != lab[b];
                if (want) {
                    int from = lab[b], to = lab[a];
                    for (int& x : lab) if (x == from) x = to;
                }
                if (merged != want) { printf("SAI rollback unite iter=%d\n", iter); return 1; }
            } else if (op == 3) {
                snaps.push_back({d.snapshot(), lab});
            } else if (!snaps.empty()) {
                int pick = rng() % snaps.size();                  // quay về một snapshot cũ (bỏ các snapshot mới hơn)
                d.rollback(snaps[pick].first);
                lab = snaps[pick].second;
                snaps.resize(pick + 1);
            }
            for (int i = 0; i < n; i++) {
                if (d.size(i) != (int)count(lab.begin(), lab.end(), lab[i])) { printf("SAI rollback size iter=%d\n", iter); return 1; }
                for (int j = 0; j < n; j++) if ((d.find(i) == d.find(j)) != (lab[i] == lab[j])) { printf("SAI rollback same iter=%d\n", iter); return 1; }
            }
        }
    }
    // ca lớn: đường thẳng 10^6 đỉnh nối theo thứ tự, rồi thứ tự ngược (cây lệch) — find lặp không tràn stack
    int n = 1000000;
    DSU d(n);
    for (int i = 0; i + 1 < n; i++) d.unite(i, i + 1);
    if (d.comps != 1 || d.size(0) != n || !d.same(0, n - 1)) { puts("SAI ca lớn"); return 1; }
    DSU e(n);
    for (int i = n - 2; i >= 0; i--) e.unite(i + 1, i);
    if (e.comps != 1 || e.size(n / 2) != n || !e.same(0, n - 1)) { puts("SAI ca lớn ngược"); return 1; }
    puts("OK");
}
