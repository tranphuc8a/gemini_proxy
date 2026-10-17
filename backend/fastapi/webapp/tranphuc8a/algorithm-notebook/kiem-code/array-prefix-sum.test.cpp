// @TEMPLATE

// Thử PrefixSum / PrefixSum2D với cách cộng trực tiếp: dãy ngẫu nhiên (rỗng, 1 phần tử, giá trị lớn gây tràn int, số âm)
// và lưới ngẫu nhiên (gồm lưới rỗng), mọi đoạn / hình chữ nhật con kể cả rỗng; thêm một ca lớn vượt int32.
int main() {
    mt19937_64 rng(20261017);
    for (int iter = 0; iter < 3000; iter++) {
        int n = rng() % 12;                                 // gồm n = 0
        long long lim = (iter % 3 == 0) ? 1000000000000LL : 20;
        vector<long long> a(n);
        for (auto& x : a) x = (long long)(rng() % (2 * lim + 1)) - lim;
        PrefixSum ps(a);
        for (int l = 0; l <= n; l++)
            for (int r = l; r <= n; r++) {
                long long want = 0;
                for (int i = l; i < r; i++) want += a[i];
                if (ps.sum(l, r) != want) { printf("SAI 1D iter=%d [%d,%d)\n", iter, l, r); return 1; }
            }
    }
    for (int iter = 0; iter < 800; iter++) {
        int n = rng() % 7, m = n ? 1 + rng() % 7 : 0;
        vector<vector<long long>> g(n, vector<long long>(m));
        for (auto& row : g)
            for (auto& x : row) x = (long long)(rng() % 41) - 20;
        PrefixSum2D ps(g);
        for (int r1 = 0; r1 <= n; r1++)
            for (int r2 = r1; r2 <= n; r2++)
                for (int c1 = 0; c1 <= m; c1++)
                    for (int c2 = c1; c2 <= m; c2++) {
                        long long want = 0;
                        for (int i = r1; i < r2; i++)
                            for (int j = c1; j < c2; j++) want += g[i][j];
                        if (ps.sum(r1, c1, r2, c2) != want) { printf("SAI 2D iter=%d\n", iter); return 1; }
                    }
    }
    // ca lớn: 10^6 phần tử 10^9 -> tổng 10^15 vượt int32
    int n = 1000000;
    vector<long long> a(n, 1000000000LL);
    PrefixSum ps(a);
    if (ps.sum(0, n) != 1000000000LL * n || ps.sum(5, 10) != 5000000000LL || ps.sum(7, 7) != 0) { puts("SAI ca lớn"); return 1; }
    puts("OK");
}
