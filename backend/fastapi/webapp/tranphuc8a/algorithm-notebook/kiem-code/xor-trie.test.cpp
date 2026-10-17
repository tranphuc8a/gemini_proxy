// @TEMPLATE

// Thử Binary Trie (XOR): thêm / xoá, maxXor, countLess so với vét cạn trên multiset ngẫu nhiên (giá trị nhỏ để trùng nhiều, giá trị sát 2^30 để kiểm bit cao),
// maxXorPair, maxXorSubarray; mảng rỗng / một phần tử; ca lớn.
int main() {
    mt19937 rng(20261017);
    const long long LIM = 1LL << 30;
    for (int iter = 0; iter < 4000; iter++) {
        XorTrie tr;
        multiset<long long> ms;
        long long range = iter % 3 == 0 ? 8 : iter % 3 == 1 ? 200 : LIM;
        int ops = 1 + rng() % 30;
        for (int o = 0; o < ops; o++) {
            long long v = (long long)(rng() % range);
            if (iter % 7 == 0) v = LIM - 1 - v % 16;     // sát 2^30 - 1
            if (rng() % 4 == 0 && !ms.empty()) {
                auto it = ms.begin();
                advance(it, rng() % ms.size());
                tr.add(*it, -1);
                ms.erase(it);
            } else {
                tr.add(v);
                ms.insert(v);
            }
            if (tr.size() != (int)ms.size()) { puts("SAI size"); return 1; }
            long long x = rng() % range, k = rng() % range;
            if (iter % 7 == 0) x = LIM - 1 - x % 16;
            if (!ms.empty()) {
                long long best = 0;
                for (long long y : ms) best = max(best, x ^ y);
                if (tr.maxXor(x) != best) { printf("SAI maxXor(%lld): %lld != %lld\n", x, tr.maxXor(x), best); return 1; }
            }
            long long less = 0;
            for (long long y : ms) if ((x ^ y) < k) less++;
            if (tr.countLess(x, k) != less) { printf("SAI countLess(%lld, %lld): %lld != %lld\n", x, k, tr.countLess(x, k), less); return 1; }
        }
    }
    // cặp / đoạn con
    for (int iter = 0; iter < 5000; iter++) {
        int n = rng() % 9;
        long long range = iter % 2 ? 16 : LIM;
        vector<long long> a(n);
        for (auto& x : a) x = rng() % range;
        long long bestPair = 0, bestSub = 0;
        for (int i = 0; i < n; i++) {
            long long cur = 0;
            for (int j = i; j < n; j++) { cur ^= a[j]; bestSub = max(bestSub, cur); }
            for (int j = i + 1; j < n; j++) bestPair = max(bestPair, a[i] ^ a[j]);
        }
        if (maxXorPair(a) != bestPair) { printf("SAI maxXorPair n=%d: %lld != %lld\n", n, maxXorPair(a), bestPair); return 1; }
        if (maxXorSubarray(a) != bestSub) { printf("SAI maxXorSubarray n=%d: %lld != %lld\n", n, maxXorSubarray(a), bestSub); return 1; }
    }
    if (maxXorPair({3, 10, 5, 25, 2, 8}) != 28) { puts("SAI ví dụ"); return 1; }
    // ca lớn: 60000 số ngẫu nhiên; so maxXorPair với cách làm khác (duyệt từng bit bằng tập băm các tiền tố)
    {
        int n = 60000;
        vector<long long> a(n);
        for (auto& x : a) x = rng() % LIM;
        long long best = 0;
        for (int b = 29; b >= 0; b--) {      // thuật toán "tiền tố bit + tập băm" kinh điển
            long long cand = best | (1LL << b);
            unordered_set<long long> pre;
            for (long long x : a) pre.insert(x >> b);
            bool ok = false;
            for (long long x : a) if (pre.count((x >> b) ^ (cand >> b))) { ok = true; break; }
            if (ok) best = cand;
        }
        if (maxXorPair(a) != best) { printf("SAI ca lớn: %lld != %lld\n", maxXorPair(a), best); return 1; }
        // xor lớn nhất của đoạn con = max của pre[i] ^ pre[j]
        vector<long long> pre(n + 1, 0);
        for (int i = 0; i < n; i++) pre[i + 1] = pre[i] ^ a[i];
        if (maxXorSubarray(a) != maxXorPair(pre)) { puts("SAI ca lớn đoạn con"); return 1; }
    }
    puts("OK");
}
