// @TEMPLATE

// Thử 4 hàm cửa sổ trượt với vét cạn O(n^2)/O(n^3): phần tử không âm có số 0, K âm / S không dương, giá trị trùng, mảng rỗng;
// ca lớn so với prefix sum + nhị phân và các dãy có đáp án biết trước.
#define CHECK(cond, ...) do { if (!(cond)) { printf("SAI: "); printf(__VA_ARGS__); printf("\n"); return 1; } } while (0)

int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 10000; iter++) {
        int n = rng() % 12;
        vector<long long> a(n);
        for (auto& v : a) v = rng() % 6;
        long long K = (long long)(rng() % 22) - 2;       // gồm K âm
        long long S = (long long)(rng() % 24) - 3;       // gồm S không dương
        int longest = 0, shortest = INT_MAX;
        for (int l = 0; l < n; l++) {
            long long sum = 0;
            for (int r = l; r < n; r++) {
                sum += a[r];
                if (sum <= K) longest = max(longest, r - l + 1);
                if (sum >= S) shortest = min(shortest, r - l + 1);
            }
        }
        if (shortest == INT_MAX) shortest = 0;
        CHECK(longestSumAtMost(a, K) == longest, "longestSumAtMost iter=%d K=%lld", iter, K);
        CHECK(shortestSumAtLeast(a, S) == shortest, "shortestSumAtLeast iter=%d S=%lld", iter, S);
        // giá trị khác nhau
        vector<long long> d(n);
        for (auto& v : d) v = (long long)(rng() % 5) - 2;
        int ld = 0;
        for (int l = 0; l < n; l++) {
            set<long long> s;
            for (int r = l; r < n; r++) {
                if (!s.insert(d[r]).second) break;
                ld = max(ld, r - l + 1);
            }
        }
        CHECK(longestAllDistinct(d) == ld, "longestAllDistinct iter=%d", iter);
        for (int k = -1; k <= 6; k++) {
            long long expect = 0;
            for (int l = 0; l < n; l++) {
                set<long long> s;
                for (int r = l; r < n; r++) {
                    s.insert(d[r]);
                    if ((int)s.size() <= k) expect++;
                }
            }
            CHECK(countAtMostKDistinct(d, k) == expect, "countAtMostKDistinct iter=%d k=%d", iter, k);
        }
    }
    // ví dụ trong mục: [2,1,5,2,3,2], S = 7 -> 2
    {
        vector<long long> a = {2, 1, 5, 2, 3, 2};
        CHECK(shortestSumAtLeast(a, 7) == 2, "ví dụ trong mục");
        CHECK(shortestSumAtLeast(a, 100) == 0, "không có đoạn nào");
    }
    // ca vừa: 2000 phần tử, giá trị trong [0, 30], so với đếm O(n^2) tăng dần
    for (int iter = 0; iter < 8; iter++) {
        int n = 2000;
        vector<long long> a(n);
        for (auto& v : a) v = rng() % 31;
        int k = rng() % 11;
        long long expect = 0;
        for (int l = 0; l < n; l++) {
            vector<int> cnt(31, 0);
            int distinct = 0;
            for (int r = l; r < n; r++) {
                if (cnt[a[r]]++ == 0) distinct++;
                if (distinct <= k) expect++; else break;      // k tăng dần theo r nên có thể dừng
            }
        }
        CHECK(countAtMostKDistinct(a, k) == expect, "ca vừa k=%d", k);
    }
    // ca lớn: so với prefix sum + nhị phân; dãy có đáp án biết trước
    {
        int n = 500000;
        vector<long long> a(n), pre(n + 1, 0);
        for (int i = 0; i < n; i++) { a[i] = rng() % 10; pre[i + 1] = pre[i] + a[i]; }
        long long K = 1234567;
        int expect = 0;
        for (int l = 0; l < n; l++) {
            int r = (int)(upper_bound(pre.begin() + l, pre.end(), pre[l] + K) - pre.begin()) - 1;   // pre[r] <= pre[l] + K
            expect = max(expect, r - l);
        }
        CHECK(longestSumAtMost(a, K) == expect, "ca lớn longestSumAtMost");
        vector<long long> perm(n);
        for (int i = 0; i < n; i++) perm[i] = i;
        CHECK(longestAllDistinct(perm) == n, "dãy đôi một khác nhau");
        vector<long long> cyc(n);
        for (int i = 0; i < n; i++) cyc[i] = i % 1000;
        CHECK(longestAllDistinct(cyc) == 1000, "dãy tuần hoàn chu kỳ 1000");
        vector<long long> big(n, 1000000000LL);
        CHECK(longestSumAtMost(big, 4000000000LL) == 4 && shortestSumAtLeast(big, 4000000000LL) == 4, "tổng vượt int32");
    }
    puts("OK");
    return 0;
}
