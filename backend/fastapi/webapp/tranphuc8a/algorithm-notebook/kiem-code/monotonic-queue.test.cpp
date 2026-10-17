// @TEMPLATE

// Thử slidingMax với cách vét cạn (mọi k, mảng nhỏ nhiều giá trị bằng nhau) và với thuật toán khối (van Herk) trên mảng 10^6;
// thử MaxQueue với một deque thật chứa đúng các giá trị đang có trong hàng đợi.
int main() {
    mt19937_64 rng(20261017);
    for (int iter = 0; iter < 3000; iter++) {
        int n = 1 + rng() % 14;
        long long range = iter % 3 == 0 ? 2 : 1000000000000LL;
        vector<long long> a(n);
        for (auto& x : a) x = (long long)(rng() % (range + 1)) - range / 2;
        for (int k = 1; k <= n; k++) {
            auto got = slidingMax(a, k);
            if ((int)got.size() != n - k + 1) { puts("SAI số cửa sổ"); return 1; }
            for (int i = 0; i + k <= n; i++) {
                long long want = *max_element(a.begin() + i, a.begin() + i + k);
                if (got[i] != want) { printf("SAI slidingMax iter=%d k=%d i=%d\n", iter, k, i); return 1; }
            }
        }
    }
    for (int iter = 0; iter < 3000; iter++) {
        MaxQueue<int> mq;
        deque<int> ref;
        int range = iter % 2 ? 3 : 1000;
        for (int step = 0; step < 100; step++) {
            if (ref.empty() || rng() % 3 != 0) {
                int x = (int)(rng() % range);
                mq.push(x);
                ref.push_back(x);
            } else {
                mq.pop(ref.front());
                ref.pop_front();
            }
            if (ref.empty() != mq.empty()) { puts("SAI empty"); return 1; }
            if (!ref.empty() && mq.getMax() != *max_element(ref.begin(), ref.end())) { printf("SAI MaxQueue iter=%d step=%d\n", iter, step); return 1; }
        }
    }
    // ca lớn: 10^6 phần tử, so với thuật toán khối (prefix max / suffix max trong từng khối độ dài k)
    int n = 1000000;
    for (int pattern = 0; pattern < 3; pattern++) {
        vector<long long> a(n);
        for (int i = 0; i < n; i++) a[i] = pattern == 0 ? (long long)(rng() % 1000000007ULL) : pattern == 1 ? i : n - i;
        int k = pattern == 0 ? 1000 : 54321;
        vector<long long> pre(n), suf(n);
        for (int i = 0; i < n; i++) pre[i] = (i % k == 0) ? a[i] : max(pre[i - 1], a[i]);
        for (int i = n - 1; i >= 0; i--) suf[i] = (i == n - 1 || (i + 1) % k == 0) ? a[i] : max(suf[i + 1], a[i]);
        auto got = slidingMax(a, k);
        if ((int)got.size() != n - k + 1) { puts("SAI số cửa sổ ca lớn"); return 1; }
        for (int i = 0; i + k <= n; i++)
            if (got[i] != max(suf[i], pre[i + k - 1])) { printf("SAI ca lớn pattern=%d i=%d\n", pattern, i); return 1; }
    }
    auto one = slidingMax({5}, 1);
    if (one != vector<long long>{5}) { puts("SAI n = 1"); return 1; }
    auto cls = slidingMax({1, 3, -1, -3, 5, 3, 6, 7}, 3);
    if (cls != vector<long long>{3, 3, 5, 5, 6, 7}) { puts("SAI ví dụ"); return 1; }
    puts("OK");
}
