// @TEMPLATE

// Thử DiffArray / DiffArray2D với cách cộng trực tiếp từng phần tử: cả hai cách khởi tạo (mảng 0 và mảng có sẵn),
// đoạn rỗng, đoạn chạm cuối (r = n), n = 0, giá trị âm; ca lớn kiểm bằng tổng.
int main() {
    mt19937_64 rng(20261017);
    for (int iter = 0; iter < 3000; iter++) {
        int n = rng() % 12;
        vector<long long> init(n, 0);
        bool fromArray = iter % 2;
        if (fromArray)
            for (auto& x : init) x = (long long)(rng() % 2001) - 1000;
        vector<long long> brute = init;
        DiffArray da = fromArray ? DiffArray(init) : DiffArray(n);
        int m = rng() % 15;
        for (int q = 0; q < m; q++) {
            int l = rng() % (n + 1), r = rng() % (n + 1);
            if (l > r) swap(l, r);
            long long v = (long long)(rng() % 201) - 100;
            if (iter % 5 == 0) v *= 1000000000LL;           // vượt int32 khi cộng dồn
            da.add(l, r, v);
            for (int i = l; i < r; i++) brute[i] += v;
        }
        if (da.build() != brute) { printf("SAI 1D iter=%d\n", iter); return 1; }
    }
    for (int iter = 0; iter < 1500; iter++) {
        int n = rng() % 6, m = rng() % 6;
        vector<vector<long long>> brute(n, vector<long long>(m, 0));
        DiffArray2D da(n, m);
        int ops = rng() % 10;
        for (int q = 0; q < ops; q++) {
            int r1 = rng() % (n + 1), r2 = rng() % (n + 1), c1 = rng() % (m + 1), c2 = rng() % (m + 1);
            if (r1 > r2) swap(r1, r2);
            if (c1 > c2) swap(c1, c2);
            long long v = (long long)(rng() % 41) - 20;
            da.add(r1, c1, r2, c2, v);
            for (int i = r1; i < r2; i++)
                for (int j = c1; j < c2; j++) brute[i][j] += v;
        }
        if (da.build() != brute) { printf("SAI 2D iter=%d\n", iter); return 1; }
    }
    // ca lớn: 10^6 phần tử, 10^6 cập nhật giá trị 10^9 -> kiểm tra bằng tổng
    int n = 1000000;
    DiffArray da(n);
    long long total = 0;
    for (int q = 0; q < 1000000; q++) {
        int l = rng() % (n + 1), r = rng() % (n + 1);
        if (l > r) swap(l, r);
        da.add(l, r, 1000000000LL);
        total += 1000000000LL * (r - l);
    }
    auto a = da.build();
    long long s = 0;
    for (long long x : a) s += x;
    if (s != total) { puts("SAI ca lớn"); return 1; }
    puts("OK");
}
