// @TEMPLATE

// Thử countingSort / radixSort / mergeSort / quickSort với std::sort: mảng rỗng, một phần tử, nhiều giá trị trùng, số âm,
// INT_MIN / INT_MAX, đã sắp xếp, ngược, toàn bằng nhau; ca lớn 1e6 phần tử (quick sort 3 đường phải nhanh với toàn bằng nhau).
#define CHECK(cond, ...) do { if (!(cond)) { printf("SAI: "); printf(__VA_ARGS__); printf("\n"); return 1; } } while (0)

static bool sameAsStd(const vector<int>& a, int maxVal, const char** which) {
    vector<int> e = a;
    sort(e.begin(), e.end());
    { vector<int> x = a; mergeSort(x); if (x != e) { *which = "mergeSort"; return false; } }
    { vector<int> x = a; quickSort(x); if (x != e) { *which = "quickSort"; return false; } }
    { vector<int> x = a; radixSort(x); if (x != e) { *which = "radixSort"; return false; } }
    if (maxVal >= 0) { vector<int> x = a; countingSort(x, maxVal); if (x != e) { *which = "countingSort"; return false; } }
    return true;
}

int main() {
    mt19937 rng(20261017);
    const char* which = "";
    // 1) nhỏ, có trùng; counting sort cho giá trị trong [0, 9]
    for (int iter = 0; iter < 20000; iter++) {
        int n = rng() % 40;
        vector<int> a(n);
        for (auto& v : a) v = rng() % 10;
        CHECK(sameAsStd(a, 9, &which), "%s (giá trị 0..9) iter=%d", which, iter);
        for (auto& v : a) v = (int)(rng() % 11) - 5;               // có số âm (không dùng counting)
        CHECK(sameAsStd(a, -1, &which), "%s (có số âm) iter=%d", which, iter);
    }
    // 2) cực trị của int
    {
        vector<int> a = {INT_MAX, INT_MIN, 0, -1, 1, INT_MAX, INT_MIN, 123456789, -123456789};
        CHECK(sameAsStd(a, -1, &which), "%s với INT_MIN/INT_MAX", which);
        vector<int> b;
        CHECK(sameAsStd(b, 0, &which), "%s với mảng rỗng", which);
        vector<int> c = {5, -1, 3, 3, 0};
        mergeSort(c);
        CHECK(c == vector<int>({-1, 0, 3, 3, 5}), "ví dụ trong mục");
    }
    // 3) ca lớn
    {
        int n = 400000;
        vector<int> a(n);
        for (auto& v : a) v = (int)rng();                        // phủ cả miền int
        CHECK(sameAsStd(a, -1, &which), "%s ngẫu nhiên toàn miền", which);
        for (auto& v : a) v = rng() % 1001;                      // miền hẹp, rất nhiều trùng
        CHECK(sameAsStd(a, 1000, &which), "%s miền hẹp", which);
        vector<int> asc(n), desc(n), same(n, 42);
        for (int i = 0; i < n; i++) { asc[i] = i - n / 2; desc[i] = n / 2 - i; }
        CHECK(sameAsStd(asc, -1, &which), "%s đã sắp xếp", which);
        CHECK(sameAsStd(desc, -1, &which), "%s sắp ngược", which);
        CHECK(sameAsStd(same, 42, &which), "%s toàn bằng nhau", which);
        // dạng "răng cưa" thường làm hỏng pivot đầu/giữa
        vector<int> saw(n);
        for (int i = 0; i < n; i++) saw[i] = (i % 2 == 0) ? i : n - i;
        CHECK(sameAsStd(saw, -1, &which), "%s răng cưa", which);
    }
    puts("OK");
    return 0;
}
