// @TEMPLATE

// Thử Skip List với std::set: insert/erase/contains/lowerBound/size khớp qua nhiều thao tác ngẫu nhiên (khoá âm, trùng, giá trị lớn),
// duyệt tầng 0 đúng thứ tự, chiều cao hợp lý (O(log N)), xoá hết rồi dùng lại, ví dụ trong mô tả, và quy mô 2e5 phần tử.
static void checkAgainst(const SkipList& sl, const set<long long>& ref, int iter) {
    // tầng 0 = đúng thứ tự tăng dần và đúng tập
    vector<long long> got;
    for (SkipList::Node* x = sl.head->next[0]; x; x = x->next[0]) got.push_back(x->key);
    vector<long long> want(ref.begin(), ref.end());
    if (got != want) { printf("SAI: tầng 0 lệch tập hợp (iter=%d)\n", iter); exit(1); }
    if (sl.size() != ref.size()) { printf("SAI: size (iter=%d)\n", iter); exit(1); }
    // mọi tầng trên là dãy con có thứ tự của tầng dưới
    for (int lv = 1; lv < sl.level; lv++) {
        long long prev = LLONG_MIN;
        bool first = true;
        for (SkipList::Node* x = sl.head->next[lv]; x; x = x->next[lv]) {
            if (!first && x->key <= prev) { puts("SAI: tầng trên không tăng dần"); exit(1); }
            if (!ref.count(x->key)) { puts("SAI: tầng trên có khoá lạ"); exit(1); }
            prev = x->key;
            first = false;
        }
    }
    if (sl.level < 1 || sl.level > SkipList::MAXL) { puts("SAI: level ngoài khoảng"); exit(1); }
    if (ref.empty() && sl.level != 1) { puts("SAI: rỗng mà level > 1"); exit(1); }
    size_t n = ref.size() + 2;
    int bound = 2 * (int)ceil(log2((double)n)) + 8;
    if (sl.level > bound) { printf("SAI: quá cao level=%d với n=%zu\n", sl.level, ref.size()); exit(1); }
}

int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 400; iter++) {
        SkipList sl;
        set<long long> ref;
        int range = 1 + rng() % 60;
        for (int op = 0; op < 150; op++) {
            long long k = (long long)(rng() % (2 * range + 1)) - range;
            if (rng() % 7 == 0) k *= 1000000000000LL;          // giá trị lớn
            int t = rng() % 4;
            if (t == 0) {
                bool a = sl.insert(k), b = ref.insert(k).second;
                if (a != b) { printf("SAI insert iter=%d\n", iter); return 1; }
            } else if (t == 1) {
                bool a = sl.erase(k), b = ref.erase(k) > 0;
                if (a != b) { printf("SAI erase iter=%d\n", iter); return 1; }
            } else if (t == 2) {
                if (sl.contains(k) != (ref.count(k) > 0)) { printf("SAI contains iter=%d\n", iter); return 1; }
            } else {
                const long long* p = sl.lowerBound(k);
                auto it = ref.lower_bound(k);
                if ((p == nullptr) != (it == ref.end()) || (p && *p != *it)) { printf("SAI lowerBound iter=%d\n", iter); return 1; }
            }
        }
        checkAgainst(sl, ref, iter);
        // xoá hết rồi dùng lại
        for (long long k : vector<long long>(ref.begin(), ref.end())) if (!sl.erase(k)) { puts("SAI: xoá khoá có mặt"); return 1; }
        ref.clear();
        checkAgainst(sl, ref, iter);
        if (!sl.insert(5) || sl.insert(5) || !sl.contains(5)) { puts("SAI: dùng lại sau khi xoá hết"); return 1; }
    }
    // ví dụ trong mô tả
    {
        SkipList sl;
        for (long long k : {3, 6, 7, 9, 12, 19, 17}) sl.insert(k);
        const long long* a = sl.lowerBound(8);
        if (!sl.contains(17) || sl.contains(5) || !a || *a != 9) { puts("SAI: ví dụ mô tả (1)"); return 1; }
        sl.erase(9);
        const long long* b = sl.lowerBound(8);
        if (!b || *b != 12) { puts("SAI: ví dụ mô tả (2)"); return 1; }
        if (sl.lowerBound(20) != nullptr) { puts("SAI: lowerBound vượt cuối"); return 1; }
    }
    // quy mô lớn: 2e5 phần tử theo thứ tự tăng (trường hợp xấu cho cây không cân bằng) rồi xoá một nửa
    {
        SkipList sl;
        set<long long> ref;
        for (long long i = 0; i < 200000; i++) { sl.insert(i); ref.insert(i); }
        for (long long i = 0; i < 200000; i += 2) { sl.erase(i); ref.erase(i); }
        checkAgainst(sl, ref, -1);
        for (long long i = 0; i < 200000; i += 997) if (sl.contains(i) != (i % 2 == 1)) { puts("SAI: quy mô lớn"); return 1; }
    }
    puts("OK");
}
