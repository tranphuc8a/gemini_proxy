// @TEMPLATE

// Thử IndexedMinHeap với một bảng id -> khoá duyệt tuyến tính: chuỗi update (tăng, giảm, thêm mới, khoá trùng, khoá âm / lớn),
// erase (có id không tồn tại), pop; kiểm tra tính chất heap và bảng vị trí sau mỗi bước. Ca lớn: heap sort 2*10^5 phần tử + giảm khoá.
static bool checkInvariant(const IndexedMinHeap& h) {
    for (int i = 0; i < h.size(); i++) {
        if (h.pos[h.heap[i]] != i) return false;
        if (i > 0 && h.key[h.heap[(i - 1) / 2]] > h.key[h.heap[i]]) return false;
    }
    return true;
}

int main() {
    mt19937_64 rng(20261017);
    for (int iter = 0; iter < 3000; iter++) {
        int n = 1 + rng() % 12;
        IndexedMinHeap h(n);
        map<int, long long> ref;                                  // id -> khoá
        long long range = iter % 3 == 0 ? 5 : 4000000000000000000LL;
        for (int step = 0; step < 120; step++) {
            int op = rng() % 4;
            int id = rng() % n;
            long long k = (long long)(rng() % (2 * range + 1)) - range;
            if (op <= 1) { h.update(id, k); ref[id] = k; }
            else if (op == 2) { h.erase(id); ref.erase(id); }
            else if (!ref.empty()) {
                long long mn = LLONG_MAX;
                for (auto& [i, v] : ref) mn = min(mn, v);
                if (h.topKey() != mn) { printf("SAI topKey iter=%d\n", iter); return 1; }
                int got = h.pop();
                auto it = ref.find(got);
                if (it == ref.end() || it->second != mn) { printf("SAI pop iter=%d: id=%d\n", iter, got); return 1; }
                ref.erase(it);
            }
            if (h.size() != (int)ref.size() || h.empty() != ref.empty() || !checkInvariant(h)) { printf("SAI trạng thái iter=%d step=%d\n", iter, step); return 1; }
            for (int i = 0; i < n; i++) if (h.contains(i) != (ref.count(i) > 0)) { puts("SAI contains"); return 1; }
            if (!ref.empty()) {
                long long mn = LLONG_MAX;
                for (auto& [i, v] : ref) mn = min(mn, v);
                if (h.topKey() != mn || h.key[h.topId()] != mn) { printf("SAI topKey sau thao tác iter=%d\n", iter); return 1; }
            }
        }
    }
    // ca lớn: heap sort
    int n = 200000;
    IndexedMinHeap h(n);
    vector<long long> keys(n);
    for (int i = 0; i < n; i++) { keys[i] = (long long)(rng() % 2000000000ULL) - 1000000000LL; h.update(i, keys[i]); }
    for (int i = 0; i < n; i += 3) { keys[i] -= 3000000000LL; h.update(i, keys[i]); }      // giảm khoá
    for (int i = 1; i < n; i += 7) { h.erase(i); keys[i] = LLONG_MAX; }                     // xoá
    vector<long long> want;
    for (long long k : keys) if (k != LLONG_MAX) want.push_back(k);
    sort(want.begin(), want.end());
    vector<long long> got;
    while (!h.empty()) { int id = h.pop(); got.push_back(keys[id]); }
    if (got != want) { puts("SAI heap sort"); return 1; }
    puts("OK");
}
