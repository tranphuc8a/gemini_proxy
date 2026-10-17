// @TEMPLATE

// Thử twoSumSorted / countPairsSumAtMost / intersectSorted / uniqueSorted với vét cạn và thư viện chuẩn:
// mảng nhỏ có số âm, trùng lặp, rỗng; ca lớn 1e6 phần tử so với cách nhị phân; tổng sát 1.8e18.
#define CHECK(cond, ...) do { if (!(cond)) { printf("SAI: "); printf(__VA_ARGS__); printf("\n"); return 1; } } while (0)

int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 30000; iter++) {
        int n = rng() % 10;
        vector<long long> a(n);
        for (auto& v : a) v = (long long)(rng() % 15) - 7;
        sort(a.begin(), a.end());
        long long t = (long long)(rng() % 31) - 15;
        // twoSumSorted
        pair<int, int> pr = twoSumSorted(a, t);
        bool exist = false;
        long long cnt = 0;
        for (int i = 0; i < n; i++)
            for (int j = i + 1; j < n; j++) {
                if (a[i] + a[j] == t) exist = true;
                if (a[i] + a[j] <= t) cnt++;
            }
        CHECK(exist == (pr.first >= 0), "twoSumSorted tồn tại iter=%d t=%lld", iter, t);
        if (pr.first >= 0)
            CHECK(0 <= pr.first && pr.first < pr.second && pr.second < n && a[pr.first] + a[pr.second] == t, "twoSumSorted cặp sai iter=%d", iter);
        // countPairsSumAtMost
        CHECK(countPairsSumAtMost(a, t) == cnt, "countPairsSumAtMost iter=%d t=%lld", iter, t);
        // intersectSorted so với set_intersection (giữ số lần lặp)
        vector<long long> b(rng() % 10);
        for (auto& v : b) v = (long long)(rng() % 15) - 7;
        sort(b.begin(), b.end());
        vector<long long> expect;
        set_intersection(a.begin(), a.end(), b.begin(), b.end(), back_inserter(expect));
        CHECK(intersectSorted(a, b) == expect, "intersectSorted iter=%d", iter);
        // uniqueSorted
        vector<long long> u = a, w = a;
        w.erase(unique(w.begin(), w.end()), w.end());
        int k = uniqueSorted(u);
        CHECK(k == (int)w.size() && u == w, "uniqueSorted iter=%d", iter);
    }
    // ví dụ trong mục
    {
        vector<long long> a = {1, 3, 4, 6, 8, 11};
        pair<int, int> p = twoSumSorted(a, 10);
        CHECK(p.first == 2 && p.second == 3, "ví dụ trong mục");
        CHECK(twoSumSorted(a, 100) == make_pair(-1, -1) && twoSumSorted({}, 0) == make_pair(-1, -1) && twoSumSorted({5}, 10) == make_pair(-1, -1), "không có cặp / rỗng / một phần tử");
    }
    // tổng sát 1.8e18 (vẫn chưa tràn long long)
    {
        vector<long long> a = {900000000000000000LL, 900000000000000000LL};
        pair<int, int> p = twoSumSorted(a, 1800000000000000000LL);
        CHECK(p.first == 0 && p.second == 1, "tổng lớn");
        CHECK(countPairsSumAtMost(a, 1800000000000000000LL) == 1 && countPairsSumAtMost(a, 1799999999999999999LL) == 0, "đếm với tổng lớn");
    }
    // ca lớn: 1e6 phần tử, so với cách khác (với mỗi i nhị phân tìm số j > i thoả)
    {
        int n = 1000000;
        vector<long long> a(n);
        for (auto& v : a) v = (long long)(rng() % 2000000001ULL) - 1000000000LL;
        sort(a.begin(), a.end());
        for (long long x : {-1000000000LL, 0LL, 123456789LL, 2000000000LL}) {
            long long expect = 0;
            for (int i = 0; i < n; i++) {
                auto first = a.begin() + i + 1;
                expect += upper_bound(first, a.end(), x - a[i]) - first;
            }
            CHECK(countPairsSumAtMost(a, x) == expect, "ca lớn x=%lld", x);
        }
    }
    puts("OK");
    return 0;
}
