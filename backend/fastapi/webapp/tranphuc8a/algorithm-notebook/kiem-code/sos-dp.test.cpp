// @TEMPLATE

// Thử sumOverSubsets / sumOverSupersets / inverseSumOverSubsets với vét cạn theo từng mặt nạ (k <= 10) và vài mặt nạ ở k = 20.
int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 300; iter++) {
        int k = rng() % 11, n = 1 << k;
        vector<long long> a(n);
        for (auto& x : a) x = (long long)(rng() % 2001) - 1000;
        auto sub = sumOverSubsets(a), sup = sumOverSupersets(a);
        for (int mask = 0; mask < n; mask++) {
            long long s1 = 0, s2 = 0;
            for (int s = 0; s < n; s++) {
                if ((s & mask) == s) s1 += a[s];    // s là tập con của mask
                if ((s & mask) == mask) s2 += a[s]; // s là tập cha của mask
            }
            if (sub[mask] != s1 || sup[mask] != s2) { printf("SAI iter=%d k=%d mask=%d\n", iter, k, mask); return 1; }
        }
        if (inverseSumOverSubsets(sub) != a) { printf("SAI nghịch đảo iter=%d\n", iter); return 1; }
    }
    // ví dụ trong thư viện
    if (sumOverSubsets({1, 2, 3, 4}) != vector<long long>({1, 3, 4, 10})) { puts("SAI ví dụ"); return 1; }
    // k = 20 (10^6 phần tử, giá trị tới 1e12): kiểm vài mặt nạ bằng duyệt tập con trực tiếp
    int k = 20, n = 1 << k;
    vector<long long> a(n);
    for (auto& x : a) x = (long long)((((unsigned long long)rng() << 32) | rng()) % 2000000000000ULL) - 1000000000000LL;
    auto sub = sumOverSubsets(a), sup = sumOverSupersets(a);
    for (int t = 0; t < 8; t++) {
        int mask = t == 0 ? n - 1 : (t == 1 ? 0 : rng() % n);
        long long s1 = 0;
        for (int s = mask;; s = (s - 1) & mask) { s1 += a[s]; if (s == 0) break; }  // duyệt mọi tập con của mask
        long long s2 = 0;
        int comp = (n - 1) ^ mask;
        for (int s = comp;; s = (s - 1) & comp) { s2 += a[mask | s]; if (s == 0) break; }  // mọi tập cha: mask | (tập con của phần bù)
        if (sub[mask] != s1 || sup[mask] != s2) { printf("SAI k=20 mask=%d\n", mask); return 1; }
    }
    if (inverseSumOverSubsets(sub) != a) { puts("SAI nghịch đảo k = 20"); return 1; }
    puts("OK");
}
