// @TEMPLATE

// Thử B+ Tree với std::map: insert (ghi đè), find, erase (xoá lười), range, size khớp qua nhiều thao tác ngẫu nhiên với MAXK nhỏ (2..6, ép tách nút liên tục);
// kiểm tra BẤT BIẾN CẤU TRÚC sau mỗi lô thao tác (mọi lá cùng độ sâu, khoá trong nút tăng dần và <= MAXK, khoá phân cách đúng cận,
// danh sách lá đầy đủ và đúng thứ tự); chèn tăng dần/giảm dần; ví dụ trong mô tả; chiều cao O(log N).
template <int K>
struct Checker {
    typedef BPlusTree<K> T;
    typedef typename T::Node Node;
    // trả chiều cao của cây con x, kiểm các khoá nằm trong [lo, hi)
    static int walk(const Node* x, bool hasLo, long long lo, bool hasHi, long long hi, vector<const Node*>& leaves) {
        for (size_t i = 0; i < x->keys.size(); i++) {
            if (i && x->keys[i - 1] >= x->keys[i]) { puts("SAI: khoá trong nút không tăng dần"); exit(1); }
            if ((hasLo && x->keys[i] < lo) || (hasHi && x->keys[i] >= hi)) { puts("SAI: khoá ngoài cận của nút cha"); exit(1); }
        }
        if ((int)x->keys.size() > K) { puts("SAI: nút quá đầy"); exit(1); }
        if (x->leaf) {
            if (x->vals.size() != x->keys.size() || !x->kids.empty()) { puts("SAI: lá không hợp lệ"); exit(1); }
            leaves.push_back(x);
            return 1;
        }
        if (x->kids.size() != x->keys.size() + 1 || !x->vals.empty() || x->keys.empty()) { puts("SAI: nút trong không hợp lệ"); exit(1); }
        int h = -1;
        for (size_t i = 0; i < x->kids.size(); i++) {
            bool l = i > 0 || hasLo, hh = i < x->keys.size() || hasHi;
            long long a = i > 0 ? x->keys[i - 1] : lo, b = i < x->keys.size() ? x->keys[i] : hi;
            int ch = walk(x->kids[i], l, a, hh, b, leaves);
            if (h != -1 && ch != h) { puts("SAI: các lá không cùng độ sâu"); exit(1); }
            h = ch;
        }
        return h + 1;
    }
    static int check(const T& t, const map<long long, long long>& ref) {
        vector<const Node*> leaves;
        int h = walk(t.root, false, 0, false, 0, leaves);
        // danh sách lá: nối đúng thứ tự trái -> phải, phủ mọi cặp
        for (size_t i = 0; i + 1 < leaves.size(); i++) if (leaves[i]->next != leaves[i + 1]) { puts("SAI: liên kết giữa các lá"); exit(1); }
        if (leaves.back()->next != nullptr) { puts("SAI: lá cuối có next"); exit(1); }
        vector<pair<long long, long long>> all;
        for (auto* l : leaves) for (size_t i = 0; i < l->keys.size(); i++) all.push_back({l->keys[i], l->vals[i]});
        vector<pair<long long, long long>> want(ref.begin(), ref.end());
        if (all != want) { puts("SAI: nội dung các lá lệch mô hình"); exit(1); }
        if (t.size() != ref.size()) { puts("SAI: size"); exit(1); }
        return h;
    }
    static void randomTest(mt19937& rng) {
        for (int iter = 0; iter < 250; iter++) {
            T t;
            map<long long, long long> ref;
            int range = 1 + rng() % 120;
            for (int op = 0; op < 200; op++) {
                long long k = (long long)(rng() % (2 * range + 1)) - range;
                int ty = rng() % 5;
                if (ty <= 1) {
                    long long v = rng() % 100000;
                    t.insert(k, v);
                    ref[k] = v;
                } else if (ty == 2) {
                    bool a = t.erase(k), b = ref.erase(k) > 0;
                    if (a != b) { puts("SAI erase"); exit(1); }
                } else if (ty == 3) {
                    const long long* p = t.find(k);
                    auto it = ref.find(k);
                    if ((p == nullptr) != (it == ref.end()) || (p && *p != it->second)) { puts("SAI find"); exit(1); }
                } else {
                    long long lo = (long long)(rng() % (2 * range + 1)) - range, hi = lo + (long long)(rng() % 40) - 5;
                    auto got = t.range(lo, hi);
                    vector<pair<long long, long long>> want;
                    for (auto it = ref.lower_bound(lo); it != ref.end() && it->first <= hi; ++it) want.push_back(*it);
                    if (got != want) { printf("SAI range [%lld, %lld]\n", lo, hi); exit(1); }
                }
                if (op % 25 == 24) check(t, ref);
            }
            check(t, ref);
        }
    }
    static void sequentialTest() {
        for (int dir = 0; dir < 2; dir++) {
            T t;
            map<long long, long long> ref;
            const int N = 3000;
            for (int i = 0; i < N; i++) {
                long long k = dir ? N - 1 - i : i;
                t.insert(k, k * 7);
                ref[k] = k * 7;
            }
            int h = check(t, ref);
            // mỗi nút có >= K/2 khoá (lúc chưa xoá) => chiều cao <= log_{K/2+1}(N) + 2
            double bound = log((double)N) / log(K / 2.0 + 1.0) + 2.5;
            if (h > bound) { printf("SAI: cây quá cao h=%d (K=%d)\n", h, K); exit(1); }
            auto r = t.range(100, 299);
            if (r.size() != 200 || r.front().first != 100 || r.back().first != 299) { puts("SAI: range tuần tự"); exit(1); }
        }
    }
};

int main() {
    mt19937 rng(20261017);
    Checker<2>::randomTest(rng);
    Checker<3>::randomTest(rng);
    Checker<4>::randomTest(rng);
    Checker<6>::randomTest(rng);
    Checker<2>::sequentialTest();
    Checker<4>::sequentialTest();
    Checker<6>::sequentialTest();
    // ví dụ trong mô tả: BPlusTree<4>, chèn 1..5, gốc [3], lá [1,2] -> [3,4,5], range(2,4)
    {
        BPlusTree<4> t;
        for (long long k = 1; k <= 5; k++) t.insert(k, k * 10);
        if (t.root->leaf || t.root->keys != vector<long long>{3} || t.root->kids.size() != 2) { puts("SAI: ví dụ mô tả — gốc"); return 1; }
        if (t.root->kids[0]->keys != vector<long long>{1, 2} || t.root->kids[1]->keys != vector<long long>{3, 4, 5}) { puts("SAI: ví dụ mô tả — lá"); return 1; }
        auto r = t.range(2, 4);
        if (r.size() != 3 || r[0].first != 2 || r[1].first != 3 || r[2].first != 4) { puts("SAI: ví dụ mô tả — range"); return 1; }
    }
    // MAXK mặc định (64) và quy mô lớn: 2e5 khoá ngẫu nhiên
    {
        BPlusTree<> t;
        map<long long, long long> ref;
        for (int i = 0; i < 200000; i++) {
            long long k = (long long)(rng() % 1000000000);
            t.insert(k, i);
            ref[k] = i;
        }
        Checker<64>::check(t, ref);
        for (int i = 0; i < 50000; i++) {
            long long k = (long long)(rng() % 1000000000);
            if (t.erase(k) != (ref.erase(k) > 0)) { puts("SAI: erase quy mô lớn"); return 1; }
        }
        Checker<64>::check(t, ref);
        auto got = t.range(0, 50000000);
        vector<pair<long long, long long>> want;
        for (auto it = ref.begin(); it != ref.end() && it->first <= 50000000; ++it) want.push_back(*it);
        if (got != want) { puts("SAI: range quy mô lớn"); return 1; }
    }
    puts("OK");
}
