// @TEMPLATE

// Thử Treap với std::multiset (insert / erase một bản sao / countLess / kth, khoá trùng nhiều, âm, rất lớn)
// và ImplicitTreap với std::vector (pushBack / insert / erase / reverse / at / toVector).
// Ca lớn: khoá tăng dần 2*10^5 (xấu nhất với BST thường) và 2*10^5 phép đảo đoạn (độ sâu kỳ vọng nhỏ, không tràn stack).
int main() {
    mt19937_64 rng(20261017);
    for (int iter = 0; iter < 2000; iter++) {
        Treap tr;
        multiset<long long> ref;
        long long range = iter % 3 == 0 ? 4 : (iter % 3 == 1 ? 1000000000000000000LL : 50);
        for (int step = 0; step < 120; step++) {
            long long k = (long long)(rng() % (2 * range + 1)) - range;
            int op = rng() % 5;
            if (op <= 1) { tr.insert(k); ref.insert(k); }
            else if (op == 2) {
                bool want = ref.find(k) != ref.end();
                if (want) ref.erase(ref.find(k));
                if (tr.erase(k) != want) { printf("SAI erase iter=%d\n", iter); return 1; }
            } else if (op == 3) {
                int want = distance(ref.begin(), ref.lower_bound(k));
                if (tr.countLess(k) != want) { printf("SAI countLess iter=%d\n", iter); return 1; }
            } else if (!ref.empty()) {
                int i = rng() % ref.size();
                if (tr.kth(i) != *next(ref.begin(), i)) { printf("SAI kth iter=%d\n", iter); return 1; }
            }
            if (tr.size() != (int)ref.size()) { printf("SAI size iter=%d\n", iter); return 1; }
        }
        int i = 0;
        for (long long x : ref) if (tr.kth(i++) != x) { puts("SAI thứ tự"); return 1; }
    }
    for (int iter = 0; iter < 2000; iter++) {
        ImplicitTreap it;
        vector<long long> ref;
        for (int step = 0; step < 100; step++) {
            int op = rng() % 6;
            long long v = (long long)(rng() % 2001) - 1000;
            int n = ref.size();
            if (op == 0) { it.pushBack(v); ref.push_back(v); }
            else if (op == 1) { int pos = rng() % (n + 1); it.insert(pos, v); ref.insert(ref.begin() + pos, v); }
            else if (op == 2 && n > 0) { int pos = rng() % n; it.erase(pos); ref.erase(ref.begin() + pos); }
            else if (op == 3) {
                int l = rng() % (n + 1), r = rng() % (n + 1);
                if (l > r) swap(l, r);
                it.reverse(l, r);
                std::reverse(ref.begin() + l, ref.begin() + r);
            } else if (op == 4 && n > 0) {
                int i = rng() % n;
                if (it.at(i) != ref[i]) { printf("SAI at iter=%d i=%d\n", iter, i); return 1; }
            }
            if (it.size() != (int)ref.size()) { printf("SAI size treap ẩn iter=%d\n", iter); return 1; }
        }
        if (it.toVector() != ref) { printf("SAI toVector iter=%d\n", iter); return 1; }
    }
    // ca lớn 1: khoá tăng dần
    {
        Treap tr;
        int n = 200000;
        for (int i = 0; i < n; i++) tr.insert(i);
        for (int i = 1; i < n; i += 2) if (!tr.erase(i)) { puts("SAI erase ca lớn"); return 1; }
        if (tr.size() != n / 2 || tr.kth(100) != 200 || tr.countLess(1001) != 501 || tr.erase(1)) { puts("SAI ca lớn tăng dần"); return 1; }
    }
    // ca lớn 2: đảo đoạn so với vét cạn (n nhỏ hơn) và chạy nhanh trên n lớn
    {
        int n = 20000;
        ImplicitTreap it;
        vector<long long> ref;
        for (int i = 0; i < n; i++) { it.pushBack(i); ref.push_back(i); }
        for (int q = 0; q < 3000; q++) {
            int l = rng() % n, r = l + rng() % (n - l + 1);
            it.reverse(l, r);
            std::reverse(ref.begin() + l, ref.begin() + r);
        }
        if (it.toVector() != ref) { puts("SAI đảo đoạn ca vừa"); return 1; }
        ImplicitTreap big;
        int m = 200000;
        for (int i = 0; i < m; i++) big.pushBack(i);
        for (int q = 0; q < 200000; q++) {
            int l = rng() % m, r = l + rng() % (m - l + 1);
            big.reverse(l, r);
        }
        auto v = big.toVector();
        long long s = 0;
        for (long long x : v) s += x;
        if ((int)v.size() != m || s != (long long)m * (m - 1) / 2) { puts("SAI đảo đoạn ca lớn"); return 1; }
    }
    puts("OK");
}
