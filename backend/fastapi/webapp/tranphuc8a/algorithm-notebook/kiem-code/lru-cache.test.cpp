// @TEMPLATE

// Thử LRU Cache với mô hình ngây thơ (mỗi mục lưu thời điểm dùng cuối, đuổi mục có thời điểm nhỏ nhất): get/put/kích thước/thứ tự
// "mới dùng nhất" khớp qua nhiều thao tác ngẫu nhiên, sức chứa 0..6, ví dụ trong mô tả, khoá chuỗi, và quy mô lớn.
struct NaiveLRU {
    size_t cap;
    long long tick = 0;
    map<int, pair<int, long long>> m;   // khoá -> (giá trị, thời điểm dùng cuối)
    explicit NaiveLRU(size_t c) : cap(c) {}
    bool get(int k, int& v) {
        auto it = m.find(k);
        if (it == m.end()) return false;
        it->second.second = ++tick;
        v = it->second.first;
        return true;
    }
    void put(int k, int v) {
        if (cap == 0) return;
        auto it = m.find(k);
        if (it != m.end()) { it->second = {v, ++tick}; return; }
        if (m.size() == cap) {
            auto old = m.begin();
            for (auto i = m.begin(); i != m.end(); ++i) if (i->second.second < old->second.second) old = i;
            m.erase(old);
        }
        m[k] = {v, ++tick};
    }
    vector<int> order() const {          // từ mới nhất tới cũ nhất
        vector<pair<long long, int>> t;
        for (auto& e : m) t.push_back({-e.second.second, e.first});
        sort(t.begin(), t.end());
        vector<int> r;
        for (auto& e : t) r.push_back(e.second);
        return r;
    }
};

int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 1500; iter++) {
        size_t cap = rng() % 7;
        LRUCache<int, int> c(cap);
        NaiveLRU ref(cap);
        for (int op = 0; op < 120; op++) {
            int k = rng() % 9;
            if (rng() % 2) {
                int v = rng() % 1000;
                c.put(k, v);
                ref.put(k, v);
            } else {
                int rv = -1;
                bool has = ref.get(k, rv);
                int* p = c.get(k);
                if ((p != nullptr) != has || (p && *p != rv)) { printf("SAI get iter=%d op=%d k=%d\n", iter, op, k); return 1; }
            }
            if (c.size() != ref.m.size() || c.size() > cap) { printf("SAI kích thước iter=%d\n", iter); return 1; }
            vector<int> o;
            for (auto& e : c.items) o.push_back(e.first);
            if (o != ref.order()) { printf("SAI thứ tự mới–cũ iter=%d op=%d\n", iter, op); return 1; }
            if (c.pos.size() != c.items.size()) { puts("SAI: bảng băm lệch danh sách"); return 1; }
        }
    }
    // ví dụ trong mô tả: sức chứa 2
    {
        LRUCache<int, int> c(2);
        c.put(1, 1); c.put(2, 2);
        vector<int> out;
        auto get = [&](int k) { int* p = c.get(k); out.push_back(p ? *p : -1); };
        get(1);
        c.put(3, 3);
        get(2);
        c.put(4, 4);
        get(1); get(3); get(4);
        if (out != vector<int>{1, -1, -1, 3, 4}) { puts("SAI: ví dụ mô tả"); return 1; }
    }
    // khoá chuỗi, giá trị chuỗi
    {
        LRUCache<string, string> c(2);
        c.put("a", "x"); c.put("b", "y"); c.put("a", "z"); c.put("c", "w");   // "b" bị đuổi
        if (c.get("b") != nullptr || !c.get("a") || *c.get("a") != "z" || !c.get("c") || *c.get("c") != "w") { puts("SAI: khoá chuỗi"); return 1; }
    }
    // quy mô lớn: sức chứa 1e5, 5e5 thao tác
    {
        const int CAP = 100000;
        LRUCache<int, int> c(CAP);
        for (int i = 0; i < 500000; i++) c.put(i, i);
        if (c.size() != (size_t)CAP) { puts("SAI: quy mô lớn"); return 1; }
        if (c.get(0) != nullptr || c.get(399999) != nullptr) { puts("SAI: mục cũ phải bị đuổi"); return 1; }
        if (!c.get(400000) || !c.get(499999)) { puts("SAI: mục mới phải còn"); return 1; }
    }
    puts("OK");
}
