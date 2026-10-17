// @TEMPLATE

// Thử LSM-tree với std::map làm mô hình tham chiếu: put / erase (tombstone) / get / flush tường minh ngẫu nhiên trên nhiều cấu hình
// (memtable 1..64, fanout 1..4, miền khoá nhỏ -> nhiều ghi đè và xoá lại khoá cũ ở run dưới). Mẫu KHÔNG có quét khoảng, nên phép quét
// khoảng được cài ở đây bằng k-way merge qua memtable + mọi run (kiểm luôn rằng run sắp xếp tăng chặt, đúng điều kiện của k-way merge).
// Kiểm thêm cấu trúc: run tăng chặt, kích thước run tăng theo cấp số nhân (fanout >= 2 -> O(log N) run), tombstone che đúng bản cũ,
// bị bỏ khi gộp xuống run cũ nhất mà khoá không "sống lại".
typedef LSMTree::Val OV;

static vector<pair<long long, long long>> scanRange(const LSMTree& t, long long lo, long long hi) {
    LSMTree::Run memRun(t.mem.begin(), t.mem.end());
    vector<const LSMTree::Run*> src;                 // src[0] = memtable (mới nhất), src[1..] = runs[0..] (mới -> cũ)
    src.push_back(&memRun);
    for (const LSMTree::Run& r : t.runs) src.push_back(&r);
    typedef tuple<long long, int, size_t> E;         // (khoá, tuổi nguồn, vị trí): cùng khoá thì nguồn mới (tuổi nhỏ) ra trước
    priority_queue<E, vector<E>, greater<E>> pq;
    for (size_t s = 0; s < src.size(); s++) {
        auto p = lower_bound(src[s]->begin(), src[s]->end(), lo, [](const pair<long long, OV>& e, long long key) { return e.first < key; });
        if (p != src[s]->end()) pq.push(E(p->first, (int)s, (size_t)(p - src[s]->begin())));
    }
    vector<pair<long long, long long>> out;
    bool have = false;
    long long last = 0;
    while (!pq.empty()) {
        long long k = get<0>(pq.top());
        int s = get<1>(pq.top());
        size_t i = get<2>(pq.top());
        pq.pop();
        if (k > hi) break;
        if (i + 1 < src[s]->size()) pq.push(E((*src[s])[i + 1].first, s, i + 1));
        if (have && last == k) continue;             // bản cũ hơn của cùng khoá: bị che
        have = true;
        last = k;
        const OV& v = (*src[s])[i].second;
        if (v) out.push_back({k, *v});               // tombstone: bỏ qua
    }
    return out;
}

static vector<pair<long long, long long>> refScan(const map<long long, long long>& ref, long long lo, long long hi) {
    vector<pair<long long, long long>> out;
    for (auto it = ref.lower_bound(lo); it != ref.end() && it->first <= hi; ++it) out.push_back(*it);
    return out;
}

// "" nếu cấu trúc hợp lệ
static string checkStructure(const LSMTree& t) {
    for (size_t r = 0; r < t.runs.size(); r++) {
        const LSMTree::Run& run = t.runs[r];
        for (size_t i = 1; i < run.size(); i++)
            if (!(run[i - 1].first < run[i].first)) return "run " + to_string(r) + " không tăng chặt theo khoá";
        if (run.empty() && t.runs.size() > 1) return "run rỗng nhưng không phải run duy nhất";
    }
    if (t.mem.size() >= max<size_t>(t.memLimit, 1)) return "memtable vượt giới hạn mà chưa flush";
    size_t total = 0;
    for (const LSMTree::Run& run : t.runs) total += run.size();
    for (size_t i = 0; i + 1 < t.runs.size(); i++)   // bất biến của quy tắc gộp: run mới * fanout < run cũ liền kề
        if ((long long)t.runs[i].size() * t.fanout >= (long long)t.runs[i + 1].size())
            return "run " + to_string(i) + " (" + to_string(t.runs[i].size()) + ") chưa nhỏ hơn hẳn run kề (" + to_string(t.runs[i + 1].size()) + ")";
    if (t.fanout >= 2 && t.runs.size() >= 2 && pow((double)t.fanout, (double)t.runs.size() - 1) > (double)total)
        return "quá nhiều run (" + to_string(t.runs.size()) + ") so với " + to_string(total) + " mục, mong O(log N)";
    return "";
}

static long long countShadowed(const LSMTree& t) {   // số tombstone (ở memtable hoặc run) đang che một giá trị sống ở run cũ hơn
    auto liveIn = [](const LSMTree::Run& r, long long k) {
        auto p = lower_bound(r.begin(), r.end(), k, [](const pair<long long, OV>& e, long long key) { return e.first < key; });
        return p != r.end() && p->first == k && p->second.has_value();
    };
    long long c = 0;
    for (auto& e : t.mem)
        if (!e.second) for (const LSMTree::Run& r : t.runs) if (liveIn(r, e.first)) { c++; break; }
    for (size_t i = 0; i < t.runs.size(); i++)
        for (auto& e : t.runs[i])
            if (!e.second) for (size_t j = i + 1; j < t.runs.size(); j++) if (liveIn(t.runs[j], e.first)) { c++; break; }
    return c;
}

static bool sameAsRef(const LSMTree& t, const map<long long, long long>& ref, long long lo, long long hi, string& why) {
    for (long long k = lo; k <= hi; k++) {
        OV g = t.get(k);
        auto it = ref.find(k);
        if ((it == ref.end()) != !g.has_value() || (g && *g != it->second)) {
            why = "get(" + to_string(k) + ") sai: mẫu " + (g ? to_string(*g) : string("không có")) + ", mong " + (it == ref.end() ? string("không có") : to_string(it->second));
            return false;
        }
    }
    if (scanRange(t, LLONG_MIN, LLONG_MAX) != refScan(ref, LLONG_MIN, LLONG_MAX)) { why = "quét toàn bộ khác mô hình"; return false; }
    return true;
}

int main() {
    // 1) ví dụ trong mô tả: LSMTree(2, 2); put(1,10), put(2,20), put(1,11), erase(2) -> còn đúng một run {1 -> 11}
    {
        LSMTree t(2, 2);
        t.put(1, 10);
        t.put(2, 20);
        if (t.runs.size() != 1 || t.runs[0].size() != 2 || !t.mem.empty()) { puts("SAI: sau 2 put phải flush thành một run 2 mục"); return 1; }
        t.put(1, 11);
        t.erase(2);
        if (t.runs.size() != 1 || t.runs[0].size() != 1 || t.runs[0][0].first != 1 || t.runs[0][0].second != OV(11)) { puts("SAI: ví dụ trong mô tả: mong một run {1 -> 11}"); return 1; }
        if (t.get(1) != OV(11) || t.get(2).has_value()) { puts("SAI: ví dụ trong mô tả: get"); return 1; }
    }
    // 2) rỗng, mặc định, khoá chưa từng có, xoá khoá không tồn tại, flush rỗng
    {
        LSMTree t;
        if (t.memLimit != 4 || t.fanout != 2) { puts("SAI: tham số mặc định"); return 1; }
        if (t.get(0).has_value() || t.get(-5).has_value() || !scanRange(t, LLONG_MIN, LLONG_MAX).empty()) { puts("SAI: cây rỗng"); return 1; }
        t.flush();
        if (!t.runs.empty()) { puts("SAI: flush memtable rỗng không được tạo run"); return 1; }
        t.erase(42);                                  // xoá khoá chưa có: vẫn phải ghi tombstone, và get vẫn "không có"
        if (t.get(42).has_value()) { puts("SAI: xoá khoá chưa có"); return 1; }
        t.put(1, 0);                                  // giá trị 0 khác với "không có"
        t.put(2, LLONG_MIN);
        if (!t.runs.empty() || t.mem.size() != 3) { puts("SAI: 3 mục (kể cả tombstone) chưa được flush (memLimit mặc định 4)"); return 1; }
        t.put(3, LLONG_MAX);                          // đủ 4 mục (tombstone 42, 1, 2, 3) -> flush
        if (t.runs.size() != 1 || !t.mem.empty()) { puts("SAI: mục thứ 4 (kể cả tombstone) phải kích hoạt flush"); return 1; }
        if (t.get(42).has_value() || t.get(1) != OV(0) || t.get(2) != OV(LLONG_MIN) || t.get(3) != OV(LLONG_MAX)) { puts("SAI: giá trị biên (0, LLONG_MIN/MAX) hoặc tombstone"); return 1; }
    }
    {
        LSMTree t;                                    // memLimit = 4: put 3 khoá chưa flush, khoá thứ 4 thì flush
        t.put(1, 0);
        t.put(2, LLONG_MIN);
        t.put(3, LLONG_MAX);
        if (!t.runs.empty() || t.mem.size() != 3) { puts("SAI: 3 mục chưa được flush (memLimit mặc định 4)"); return 1; }
        t.put(4, -1);
        if (t.runs.size() != 1 || !t.mem.empty()) { puts("SAI: mục thứ 4 phải kích hoạt flush"); return 1; }
        if (t.get(1) != OV(0) || t.get(2) != OV(LLONG_MIN) || t.get(3) != OV(LLONG_MAX) || t.get(4) != OV(-1) || t.get(5).has_value()) { puts("SAI: giá trị biên (0, LLONG_MIN/MAX)"); return 1; }
    }
    // 3) tombstone che bản cũ ở run dưới rồi mới bị bỏ khi gộp xuống run cũ nhất (khoá không được "sống lại")
    {
        LSMTree t(2, 2);
        for (long long k = 0; k < 10; k++) t.put(k, k * 10);
        if (t.runs.size() != 1 || t.runs[0].size() != 10) { puts("SAI: kịch bản tombstone: run nền phải gồm 10 mục"); return 1; }
        t.erase(3);
        t.put(100, 1);                                // flush {3:tombstone, 100:1}, chưa gộp xuống nền (4 mục * 2 < 10)? -> run mới nhỏ hơn hẳn
        if (t.runs.size() != 2) { puts("SAI: kịch bản tombstone: mong 2 run (tombstone nằm ở run mới, chưa gộp)"); return 1; }
        if (t.get(3).has_value()) { puts("SAI: tombstone ở run mới không che được bản cũ ở run nền"); return 1; }
        bool inBase = false;
        for (auto& e : t.runs[1]) if (e.first == 3 && e.second) inBase = true;
        bool tomb = false;
        for (auto& e : t.runs[0]) if (e.first == 3 && !e.second) tomb = true;
        if (!inBase || !tomb) { puts("SAI: kịch bản tombstone dựng sai (tombstone phải còn, bản cũ phải còn)"); return 1; }
        for (long long k = 1000; k < 1100 && t.runs.size() > 1; k++) {
            t.put(k, k);
            if (t.get(3).has_value()) { puts("SAI: khoá đã xoá sống lại khi gộp"); return 1; }
        }
        if (t.runs.size() != 1) { puts("SAI: không gộp được về một run dù ghi thêm nhiều"); return 1; }
        for (auto& e : t.runs[0]) if (!e.second || e.first == 3) { puts("SAI: tombstone/khoá 3 vẫn còn ở run cũ nhất sau khi gộp xuống đáy"); return 1; }
        if (t.get(3).has_value() || t.get(4) != OV(40) || t.get(100) != OV(1)) { puts("SAI: dữ liệu sau khi gộp xuống đáy"); return 1; }
    }
    // 4) ngẫu nhiên so với std::map trên nhiều cấu hình
    mt19937 rng(20261017);
    long long shadowCover = 0, flushes = 0;
    for (size_t memLimit : {1, 2, 3, 4, 8, 16, 64})
        for (int fanout : {1, 2, 3, 4})
            for (int K : {4, 40, 400, 6000}) {
                LSMTree t(memLimit, fanout);
                map<long long, long long> ref;
                const int OPS = 3000;
                for (int op = 0; op < OPS; op++) {
                    long long key = (long long)(rng() % K) - K / 2;
                    int r = rng() % 100;
                    if (r < 45) {
                        long long v = (rng() % 5 == 0) ? 0 : (long long)(((uint64_t)rng() << 32) | rng());
                        t.put(key, v);
                        ref[key] = v;
                    } else if (r < 78) {
                        t.erase(key);
                        ref.erase(key);
                    } else if (r < 90) {
                        OV g = t.get(key);
                        auto it = ref.find(key);
                        if ((it == ref.end()) == g.has_value() || (g && *g != it->second)) { printf("SAI get(%lld) cfg(mem=%zu,fan=%d,K=%d) op=%d\n", key, memLimit, fanout, K, op); return 1; }
                    } else if (r < 96) {
                        long long lo = (long long)(rng() % (K + 2)) - K / 2 - 1, hi = lo + (long long)(rng() % (K / 2 + 2)) - 1;   // gồm cả khoảng rỗng (hi < lo)
                        if (scanRange(t, lo, hi) != refScan(ref, lo, hi)) { printf("SAI quét [%lld,%lld] cfg(mem=%zu,fan=%d,K=%d) op=%d\n", lo, hi, memLimit, fanout, K, op); return 1; }
                    } else {
                        t.flush();                    // flush tường minh
                        flushes++;
                    }
                    if (r < 78) {                     // ngay sau put/erase khoá đó phải đọc lại đúng
                        OV g = t.get(key);
                        auto it = ref.find(key);
                        if ((it == ref.end()) == g.has_value() || (g && *g != it->second)) { printf("SAI đọc lại sau ghi, khoá %lld cfg(mem=%zu,fan=%d,K=%d) op=%d\n", key, memLimit, fanout, K, op); return 1; }
                    }
                    if (op % 25 == 0) {
                        string e = checkStructure(t);
                        if (!e.empty()) { printf("SAI cấu trúc: %s cfg(mem=%zu,fan=%d,K=%d) op=%d\n", e.c_str(), memLimit, fanout, K, op); return 1; }
                    }
                    if (op % 250 == 249 || op == OPS - 1) {
                        string why;
                        if (!sameAsRef(t, ref, -K / 2 - 2, K / 2 + 2, why)) { printf("SAI: %s cfg(mem=%zu,fan=%d,K=%d) op=%d\n", why.c_str(), memLimit, fanout, K, op); return 1; }
                        shadowCover += countShadowed(t);
                    }
                }
                // flush hết rồi vẫn đúng
                t.flush();
                string e = checkStructure(t), why;
                if (!e.empty()) { printf("SAI cấu trúc sau flush cuối: %s\n", e.c_str()); return 1; }
                if (!sameAsRef(t, ref, -K / 2 - 2, K / 2 + 2, why)) { printf("SAI sau flush cuối: %s\n", why.c_str()); return 1; }
            }
    if (shadowCover < 100) { printf("Kịch bản thử quá nghèo: chỉ %lld lần tombstone che bản cũ\n", shadowCover); return 1; }
    if (flushes < 100) { puts("Kịch bản thử quá nghèo: ít flush tường minh"); return 1; }
    // 5) ca lớn: 400000 thao tác trên 100000 khoá (memtable 64, fanout 2) -> O(log N) run
    {
        LSMTree t(64, 2);
        map<long long, long long> ref;
        for (int op = 0; op < 400000; op++) {
            long long key = rng() % 100000;
            if (rng() % 10 < 7) {
                long long v = (long long)rng() - 1000;
                t.put(key, v);
                ref[key] = v;
            } else {
                t.erase(key);
                ref.erase(key);
            }
        }
        string e = checkStructure(t), why;
        if (!e.empty()) { printf("SAI cấu trúc (ca lớn): %s\n", e.c_str()); return 1; }
        if (t.runs.size() > 20) { printf("SAI: %zu run (> 20) với ~100000 khoá\n", t.runs.size()); return 1; }
        if (!sameAsRef(t, ref, -2, 100002, why)) { printf("SAI (ca lớn): %s\n", why.c_str()); return 1; }
        for (int i = 0; i < 300; i++) {
            long long lo = rng() % 100000, hi = lo + rng() % 3000;
            if (scanRange(t, lo, hi) != refScan(ref, lo, hi)) { puts("SAI: quét khoảng (ca lớn)"); return 1; }
        }
    }
    puts("OK");
}
