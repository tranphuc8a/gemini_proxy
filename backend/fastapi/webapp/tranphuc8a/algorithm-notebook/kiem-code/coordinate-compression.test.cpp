// @TEMPLATE

// Thử Compressor: so với std::set / vét cạn (id, has, upTo, value, compress giữ nguyên thứ tự và quan hệ bằng nhau),
// mảng rỗng, giá trị cực lớn ±4e18, kiểu string; ca lớn 500000 phần tử kiểm tra tính giữ thứ tự bằng sắp xếp theo chỉ số.
#define CHECK(cond, ...) do { if (!(cond)) { printf("SAI: "); printf(__VA_ARGS__); printf("\n"); return 1; } } while (0)

int main() {
    mt19937_64 rng(20261017);
    for (int iter = 0; iter < 5000; iter++) {
        int n = rng() % 20;
        vector<long long> a(n);
        bool huge = rng() % 3 == 0;
        for (auto& v : a) v = huge ? (long long)(rng() % 9) * 1000000000000000000LL - 4000000000000000000LL : (long long)(rng() % 17) - 8;
        Compressor<long long> cp(a);
        set<long long> s(a.begin(), a.end());
        vector<long long> sv(s.begin(), s.end());
        CHECK(cp.size() == (int)sv.size(), "size iter=%d", iter);
        for (int i = 0; i < cp.size(); i++) CHECK(cp.value(i) == sv[i], "value(%d) iter=%d", i, iter);
        for (long long x : a) {
            int pos = (int)(find(sv.begin(), sv.end(), x) - sv.begin());
            CHECK(cp.id(x) == pos && cp.has(x) && cp.value(cp.id(x)) == x, "id/has/value của %lld iter=%d", x, iter);
        }
        for (long long probe = -10; probe <= 10; probe++) {            // x có thể không có trong tập
            int less = 0, leq = 0;
            for (long long y : sv) { if (y < probe) less++; if (y <= probe) leq++; }
            CHECK(cp.id(probe) == less, "id(%lld) = số giá trị nhỏ hơn, iter=%d", probe, iter);
            CHECK(cp.upTo(probe) == leq, "upTo(%lld) = số giá trị <=, iter=%d", probe, iter);
            CHECK(cp.has(probe) == (s.count(probe) > 0), "has(%lld) iter=%d", probe, iter);
        }
        vector<int> r = cp.compress(a);
        for (int i = 0; i < n; i++)
            for (int j = 0; j < n; j++)
                CHECK((a[i] < a[j]) == (r[i] < r[j]) && (a[i] == a[j]) == (r[i] == r[j]), "giữ thứ tự iter=%d (%d,%d)", iter, i, j);
    }
    // ví dụ trong mục
    {
        Compressor<long long> cp({100, 5, 5000, 5, 100});
        CHECK(cp.compress({100, 5, 5000, 5, 100}) == vector<int>({1, 0, 2, 0, 1}) && cp.size() == 3, "ví dụ trong mục");
        Compressor<long long> empty({});
        CHECK(empty.size() == 0 && empty.id(5) == 0 && !empty.has(5) && empty.upTo(5) == 0 && empty.compress({}).empty(), "rỗng");
    }
    // kiểu string
    {
        Compressor<string> cp({"pear", "apple", "pear", "fig"});
        CHECK(cp.size() == 3 && cp.id("apple") == 0 && cp.id("fig") == 1 && cp.id("pear") == 2 && !cp.has("kiwi") && cp.id("kiwi") == 2, "kiểu string");
    }
    // ca lớn
    {
        int n = 500000;
        vector<long long> a(n);
        for (auto& v : a) v = (long long)(rng() % 100000) * 40000000000000LL - 2000000000000000000LL;   // nhiều trùng, giá trị lớn
        Compressor<long long> cp(a);
        vector<int> r = cp.compress(a);
        vector<int> idx(n);
        iota(idx.begin(), idx.end(), 0);
        sort(idx.begin(), idx.end(), [&](int x, int y) { return a[x] < a[y]; });
        int maxId = 0;
        for (int k = 0; k < n; k++) {
            maxId = max(maxId, r[idx[k]]);
            if (k > 0) {
                int x = idx[k - 1], y = idx[k];
                CHECK((a[x] == a[y]) == (r[x] == r[y]) && (a[x] < a[y]) == (r[x] < r[y]), "ca lớn tại %d", k);
            }
        }
        CHECK(maxId + 1 == cp.size(), "các chỉ số phải liên tục 0..k-1");
    }
    puts("OK");
    return 0;
}
