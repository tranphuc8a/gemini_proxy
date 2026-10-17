// @TEMPLATE

// Thử moDistinct với vét cạn (set) trên mảng nhỏ có số âm/trùng, truy vấn trùng lặp/độ dài 1/cả mảng;
// ca lớn n = q = 200000: giá trị chỉ có 6 loại (đáp án = số loại có mặt, tính bằng prefix count), dãy đôi một khác nhau, dãy hằng.
#define CHECK(cond, ...) do { if (!(cond)) { printf("SAI: "); printf(__VA_ARGS__); printf("\n"); return 1; } } while (0)

int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 4000; iter++) {
        int n = 1 + rng() % 30, q = rng() % 40;
        int range = 1 + rng() % 12;
        vector<int> a(n);
        for (auto& v : a) v = (int)(rng() % range) - 5;
        vector<pair<int, int>> qs(q);
        for (auto& p : qs) {
            int l = rng() % n, r = rng() % n;
            if (l > r) swap(l, r);
            p = {l, r};
        }
        vector<int> res = moDistinct(a, qs);
        CHECK(res.size() == qs.size(), "số đáp án iter=%d", iter);
        for (int i = 0; i < q; i++) {
            set<int> s(a.begin() + qs[i].first, a.begin() + qs[i].second + 1);
            CHECK(res[i] == (int)s.size(), "iter=%d truy vấn (%d,%d): %d != %d", iter, qs[i].first, qs[i].second, res[i], (int)s.size());
        }
    }
    // ví dụ trong mục
    {
        vector<int> a = {1, 2, 1, 3, 2};
        vector<int> res = moDistinct(a, {{0, 2}, {1, 4}, {2, 2}});
        CHECK(res == vector<int>({2, 3, 1}), "ví dụ trong mục");
        CHECK(moDistinct(a, {}).empty(), "không có truy vấn");
    }
    // ca lớn
    {
        int n = 200000, q = 200000;
        vector<int> a(n);
        vector<vector<int>> pre(6, vector<int>(n + 1, 0));
        for (int i = 0; i < n; i++) {
            a[i] = rng() % 6;
            for (int v = 0; v < 6; v++) pre[v][i + 1] = pre[v][i] + (a[i] == v);
        }
        vector<pair<int, int>> qs(q);
        for (auto& p : qs) {
            int l = rng() % n, r = rng() % n;
            if (l > r) swap(l, r);
            p = {l, r};
        }
        vector<int> res = moDistinct(a, qs);
        for (int i = 0; i < q; i++) {
            int expect = 0;
            for (int v = 0; v < 6; v++)
                if (pre[v][qs[i].second + 1] - pre[v][qs[i].first] > 0) expect++;
            CHECK(res[i] == expect, "ca lớn truy vấn %d", i);
        }
        // giá trị lớn đôi một khác nhau: đáp án = độ dài đoạn
        vector<int> b(n);
        for (int i = 0; i < n; i++) b[i] = i * 5000;             // tới ~1e9
        res = moDistinct(b, qs);
        for (int i = 0; i < q; i++) CHECK(res[i] == qs[i].second - qs[i].first + 1, "dãy khác nhau, truy vấn %d", i);
        // dãy hằng: đáp án luôn 1
        vector<int> c(n, 7);
        res = moDistinct(c, qs);
        for (int i = 0; i < q; i++) CHECK(res[i] == 1, "dãy hằng, truy vấn %d", i);
    }
    puts("OK");
    return 0;
}
