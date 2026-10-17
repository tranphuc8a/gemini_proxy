// @TEMPLATE

// Thử băm nhất quán: tính xác định, mọi khoá về một nút đang có; thêm nút -> khoá chỉ chuyển SANG nút mới và chỉ khoảng 1/(N+1);
// bớt nút -> chỉ khoá của nút đó đổi chỗ; thêm lại nút khôi phục đúng ánh xạ cũ; tải cân bằng nhờ nút ảo (nhiều nút ảo thì đều hơn);
// getNodes cho các nút thật khác nhau; vòng rỗng / một nút; và con số 75% của hash mod N trong mô tả.
int main() {
    const int KEYS = 60000;
    vector<string> keys;
    for (int i = 0; i < KEYS; i++) keys.push_back("key-" + to_string(i) + "-x");
    auto owners = [&](const ConsistentHash& ch) {
        vector<string> o;
        for (auto& k : keys) o.push_back(ch.getNode(k));
        return o;
    };

    // vòng rỗng
    {
        ConsistentHash empty(50);
        if (empty.getNode("a") != "" || !empty.getNodes("a", 3).empty()) { puts("SAI: vòng rỗng"); return 1; }
    }
    // một nút nhận tất cả; thêm lại cùng nút không đổi gì; bớt nút lạ không làm gì
    {
        ConsistentHash one(50);
        one.addNode("solo");
        for (int i = 0; i < 200; i++) if (one.getNode(keys[i]) != "solo") { puts("SAI: một nút"); return 1; }
        size_t sz = one.ring.size();
        one.addNode("solo");
        one.removeNode("ghost");
        if (one.ring.size() != sz) { puts("SAI: thêm lại / bớt nút lạ làm đổi vòng"); return 1; }
        one.removeNode("solo");
        if (!one.ring.empty()) { puts("SAI: bớt nút cuối"); return 1; }
    }

    ConsistentHash ch(200);
    for (int i = 0; i < 10; i++) ch.addNode("node" + to_string(i));
    vector<string> before = owners(ch);
    if (before != owners(ch)) { puts("SAI: không xác định"); return 1; }
    set<string> present;
    for (int i = 0; i < 10; i++) present.insert("node" + to_string(i));
    map<string, int> load;
    for (auto& o : before) { if (!present.count(o)) { puts("SAI: khoá về nút không tồn tại"); return 1; } load[o]++; }
    int maxLoad = 0, minLoad = KEYS;
    for (auto& e : load) { maxLoad = max(maxLoad, e.second); minLoad = min(minLoad, e.second); }
    double mean = (double)KEYS / 10;
    if (load.size() != 10 || maxLoad > 1.5 * mean || minLoad < 0.55 * mean) { printf("SAI: tải lệch quá mức: min %d max %d mean %.0f\n", minLoad, maxLoad, mean); return 1; }

    // thêm nút thứ 11: khoá chuyển chỉ sang nút mới; tỉ lệ ~ 1/11
    ch.addNode("node10");
    vector<string> after = owners(ch);
    int moved = 0;
    for (int i = 0; i < KEYS; i++) {
        if (after[i] != before[i]) {
            if (after[i] != "node10") { puts("SAI: khoá chuyển sang nút cũ khác"); return 1; }
            moved++;
        }
    }
    double frac = (double)moved / KEYS;
    if (frac < 0.05 || frac > 0.14) { printf("SAI: tỉ lệ khoá di chuyển %.4f (mong ~ 1/11 = 0.0909)\n", frac); return 1; }

    // bớt node3: chỉ khoá của node3 đổi chỗ
    vector<string> beforeRemove = after;
    ch.removeNode("node3");
    vector<string> afterRemove = owners(ch);
    for (int i = 0; i < KEYS; i++) {
        if (beforeRemove[i] != "node3" && afterRemove[i] != beforeRemove[i]) { puts("SAI: khoá của nút khác bị đổi chỗ khi bớt nút"); return 1; }
        if (afterRemove[i] == "node3") { puts("SAI: khoá vẫn về nút đã bỏ"); return 1; }
    }
    // thêm lại node3: khôi phục đúng ánh xạ cũ
    ch.addNode("node3");
    if (owners(ch) != beforeRemove) { puts("SAI: thêm lại nút không khôi phục ánh xạ"); return 1; }

    // getNodes: các nút thật khác nhau, phần tử đầu = getNode, số lượng = min(count, số nút)
    for (int i = 0; i < 500; i++) {
        for (size_t cnt : {1, 3, 11, 20}) {
            vector<string> r = ch.getNodes(keys[i], cnt);
            set<string> s(r.begin(), r.end());
            if (s.size() != r.size() || r.size() != min<size_t>(cnt, 11) || r[0] != ch.getNode(keys[i])) { puts("SAI: getNodes"); return 1; }
        }
    }

    // nhiều nút ảo thì cân bằng hơn: so độ lệch chuẩn tải giữa 5 và 400 nút ảo
    auto spread = [&](int vn) {
        ConsistentHash c(vn);
        for (int i = 0; i < 10; i++) c.addNode("srv" + to_string(i));
        map<string, int> ld;
        for (auto& k : keys) ld[c.getNode(k)]++;
        double var = 0;
        for (auto& e : ld) var += (e.second - mean) * (e.second - mean);
        return sqrt(var / 10) / mean;
    };
    double s5 = spread(5), s400 = spread(400);
    if (!(s400 < s5)) { printf("SAI: nhiều nút ảo mà không cân bằng hơn: %.3f vs %.3f\n", s5, s400); return 1; }

    // hash mod N (mô tả): từ 3 lên 4 nút có 75% khoá đổi nút khi hash đều
    {
        int stay = 0, total = 12000;
        for (int h = 0; h < total; h++) if (h % 3 == h % 4) stay++;
        if (stay != 3000) { puts("SAI: con số 25% ở lại của hash mod N"); return 1; }
    }
    puts("OK");
}
