// @TEMPLATE

// Thử OrderedSet (order_of_key / find_by_order) với std::set và OrderedMultiset với std::multiset:
// khoá trùng nhiều, âm, rất lớn; erase một bản sao; tập rỗng; ca lớn 2*10^5 thao tác.
int main() {
    mt19937_64 rng(20261017);
    for (int iter = 0; iter < 2000; iter++) {
        OrderedSet<int> os;
        set<int> ref;
        for (int step = 0; step < 100; step++) {
            int k = (int)(rng() % 41) - 20;
            int op = rng() % 4;
            if (op == 0) { os.insert(k); ref.insert(k); }
            else if (op == 1) { os.erase(k); ref.erase(k); }
            else if (op == 2) {
                if ((int)os.order_of_key(k) != (int)distance(ref.begin(), ref.lower_bound(k))) { puts("SAI order_of_key"); return 1; }
            } else if (!ref.empty()) {
                int i = rng() % ref.size();
                if (*os.find_by_order(i) != *next(ref.begin(), i)) { puts("SAI find_by_order"); return 1; }
            }
            if (os.size() != ref.size()) { puts("SAI size tập"); return 1; }
        }
    }
    for (int iter = 0; iter < 2000; iter++) {
        OrderedMultiset<long long> ms;
        multiset<long long> ref;
        long long range = iter % 3 == 0 ? 3 : (iter % 3 == 1 ? 1000000000000000000LL : 30);
        for (int step = 0; step < 120; step++) {
            long long k = (long long)(rng() % (2 * range + 1)) - range;
            int op = rng() % 6;
            if (op <= 1) { ms.insert(k); ref.insert(k); }
            else if (op == 2) {
                bool want = ref.find(k) != ref.end();
                if (want) ref.erase(ref.find(k));
                if (ms.erase(k) != want) { printf("SAI erase iter=%d\n", iter); return 1; }
            } else if (op == 3) {
                if (ms.countLess(k) != (int)distance(ref.begin(), ref.lower_bound(k))) { printf("SAI countLess iter=%d\n", iter); return 1; }
            } else if (op == 4) {
                if (ms.countLessEq(k) != (int)distance(ref.begin(), ref.upper_bound(k))) { printf("SAI countLessEq iter=%d\n", iter); return 1; }
            } else if (!ref.empty()) {
                int i = rng() % ref.size();
                if (ms.kth(i) != *next(ref.begin(), i)) { printf("SAI kth iter=%d\n", iter); return 1; }
            }
            if (ms.size() != (int)ref.size()) { printf("SAI size iter=%d\n", iter); return 1; }
        }
    }
    // ca lớn: chèn 2*10^5 giá trị, rồi xoá bớt và truy vấn xen kẽ
    OrderedMultiset<long long> ms;
    vector<long long> sorted;
    for (int i = 0; i < 200000; i++) {
        long long v = (long long)(rng() % 2000000000000ULL);
        ms.insert(v);
        sorted.push_back(v);
    }
    sort(sorted.begin(), sorted.end());
    for (int q = 0; q < 2000; q++) {
        int i = rng() % sorted.size();
        if (ms.kth(i) != sorted[i]) { puts("SAI kth ca lớn"); return 1; }
        long long x = sorted[i];
        int want = lower_bound(sorted.begin(), sorted.end(), x) - sorted.begin();
        if (ms.countLess(x) != want) { puts("SAI countLess ca lớn"); return 1; }
    }
    puts("OK");
}
