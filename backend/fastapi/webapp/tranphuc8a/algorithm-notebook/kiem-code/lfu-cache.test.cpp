// @TEMPLATE

// Thử LFU Cache với mô hình ngây thơ (mỗi mục lưu tần suất và thời điểm dùng cuối; đuổi mục có (tần suất, thời điểm) nhỏ nhất):
// kết quả get/kích thước khớp qua nhiều thao tác ngẫu nhiên, sức chứa 0..6, ví dụ trong mô tả, bất biến nội bộ (minFreq, nhóm tần suất không rỗng).
struct NaiveLFU {
    size_t cap;
    long long tick = 0;
    struct E { int val; int freq; long long last; };
    map<int, E> m;
    explicit NaiveLFU(size_t c) : cap(c) {}
    bool get(int k, int& v) {
        auto it = m.find(k);
        if (it == m.end()) return false;
        it->second.freq++;
        it->second.last = ++tick;
        v = it->second.val;
        return true;
    }
    void put(int k, int v) {
        if (cap == 0) return;
        auto it = m.find(k);
        if (it != m.end()) { it->second.val = v; it->second.freq++; it->second.last = ++tick; return; }
        if (m.size() == cap) {
            auto old = m.begin();
            for (auto i = m.begin(); i != m.end(); ++i)
                if (make_pair(i->second.freq, i->second.last) < make_pair(old->second.freq, old->second.last)) old = i;
            m.erase(old);
        }
        m[k] = {v, 1, ++tick};
    }
};

int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 2000; iter++) {
        size_t cap = rng() % 7;
        LFUCache<int, int> c(cap);
        NaiveLFU ref(cap);
        for (int op = 0; op < 150; op++) {
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
            if (c.size() != ref.m.size() || c.size() > cap) { printf("SAI kích thước iter=%d op=%d\n", iter, op); return 1; }
            // bất biến nội bộ: mỗi nhóm tần suất không rỗng; tổng số nút = size; minFreq là tần suất nhỏ nhất đang có
            size_t total = 0;
            int mf = INT_MAX;
            for (auto& g : c.byFreq) {
                if (g.second.empty()) { puts("SAI: nhóm tần suất rỗng chưa bị xoá"); return 1; }
                total += g.second.size();
                mf = min(mf, g.first);
                for (auto& n : g.second) if (n.freq != g.first) { puts("SAI: nút sai nhóm tần suất"); return 1; }
            }
            if (total != c.size()) { puts("SAI: tổng nút khác size"); return 1; }
            if (total && mf != c.minFreq) { printf("SAI: minFreq = %d, thực tế %d\n", c.minFreq, mf); return 1; }
            // tần suất khớp mô hình
            for (auto& e : ref.m) {
                auto f = c.pos.find(e.first);
                if (f == c.pos.end() || f->second->freq != e.second.freq) { puts("SAI: tần suất lệch mô hình"); return 1; }
            }
        }
    }
    // ví dụ trong mô tả: sức chứa 2
    {
        LFUCache<int, int> c(2);
        vector<int> out;
        auto get = [&](int k) { int* p = c.get(k); out.push_back(p ? *p : -1); };
        c.put(1, 1); c.put(2, 2);
        get(1);
        c.put(3, 3);
        get(2); get(3);
        c.put(4, 4);
        get(1); get(3); get(4);
        if (out != vector<int>{1, -1, 3, -1, 3, 4}) { puts("SAI: ví dụ mô tả"); return 1; }
    }
    // quy mô lớn: mục hot (tần suất cao) sống sót qua đợt quét 3e5 khoá đọc-một-lần
    {
        LFUCache<int, int> c(1000);
        for (int i = 0; i < 10; i++) { c.put(-1, i); for (int k = 0; k < 5; k++) c.get(-1); }
        for (int i = 0; i < 300000; i++) c.put(i, i);
        if (!c.get(-1)) { puts("SAI: mục hot bị đuổi bởi đợt quét"); return 1; }
        if (c.size() != 1000) { puts("SAI: kích thước sau quét"); return 1; }
    }
    puts("OK");
}
