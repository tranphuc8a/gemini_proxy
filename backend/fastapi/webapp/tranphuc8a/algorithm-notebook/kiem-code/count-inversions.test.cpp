// @TEMPLATE

// Thử countInversions với vét cạn O(n^2) (có giá trị trùng, mảng rỗng/một phần tử, số âm) và ca lớn:
// mảng đảo ngược 200000 phần tử (đáp án 1.99999e10 vượt int32), đã sắp xếp, toàn bằng nhau, hoán vị ngẫu nhiên so với Fenwick tree.
#define CHECK(cond, ...) do { if (!(cond)) { printf("SAI: "); printf(__VA_ARGS__); printf("\n"); return 1; } } while (0)

int main() {
    mt19937_64 rng(20261017);
    for (int iter = 0; iter < 30000; iter++) {
        int n = rng() % 14;
        vector<long long> a(n);
        for (auto& v : a) v = (long long)(rng() % 7) - 3;
        long long expect = 0;
        for (int i = 0; i < n; i++)
            for (int j = i + 1; j < n; j++)
                if (a[i] > a[j]) expect++;
        vector<long long> copyA = a;
        CHECK(countInversions(a) == expect, "iter=%d n=%d", iter, n);
        CHECK(a == copyA, "hàm không được sửa mảng gốc của người gọi");
    }
    // ví dụ trong mục
    CHECK(countInversions({3, 1, 2, 5, 4}) == 3, "ví dụ trong mục");
    CHECK(countInversions({}) == 0 && countInversions({7}) == 0, "rỗng / một phần tử");
    // giá trị lớn: không phụ thuộc kích thước giá trị
    CHECK(countInversions({4000000000000000000LL, -4000000000000000000LL, 0}) == 2, "giá trị lớn");
    // ca lớn
    {
        int n = 200000;
        vector<long long> desc(n), asc(n), same(n, 5);
        for (int i = 0; i < n; i++) { desc[i] = n - i; asc[i] = i; }
        CHECK(countInversions(desc) == (long long)n * (n - 1) / 2, "đảo ngược n=%d", n);
        CHECK(countInversions(asc) == 0, "đã sắp xếp");
        CHECK(countInversions(same) == 0, "toàn bằng nhau");
        // hoán vị ngẫu nhiên so với Fenwick tree
        vector<long long> p(n);
        iota(p.begin(), p.end(), 1);
        shuffle(p.begin(), p.end(), rng);
        vector<int> bit(n + 1, 0);
        long long expect = 0;
        for (int i = 0; i < n; i++) {
            int cntLE = 0;
            for (int x = (int)p[i]; x > 0; x -= x & -x) cntLE += bit[x];     // số phần tử đã gặp <= p[i]
            expect += i - cntLE;                                              // đã gặp i phần tử, trong đó i - cntLE phần tử lớn hơn
            for (int x = (int)p[i]; x <= n; x += x & -x) bit[x]++;
        }
        CHECK(countInversions(p) == expect, "hoán vị ngẫu nhiên: %lld", expect);
    }
    puts("OK");
    return 0;
}
