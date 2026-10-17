// @TEMPLATE

// Thử Merkle tree: (1) gốc và proof so với cách dựng ĐỆ QUY TỪ TRÊN XUỐNG viết lại độc lập (tách tại luỹ thừa 2 lớn nhất < n, như RFC 6962;
// khớp với quy tắc "nút lẻ giữ nguyên lên tầng trên"); (2) mọi proof hợp lệ, độ dài <= ceil(log2 N); (3) gốc đổi khi và chỉ khi dữ liệu đổi
// (đổi một khối, đổi thứ tự, thêm/bớt, [a,b,c] khác [a,b,c,c]); (4) proof bị sửa / cắt / thêm / lật vị trí / sai dữ liệu / sai gốc đều bị từ chối;
// (5) proof cũ không còn hợp lệ với gốc mới sau khi dữ liệu đổi.
typedef MerkleTree MT;
typedef MerkleTree::H H;
typedef MerkleTree::Step Step;

static size_t splitPoint(size_t n) { size_t k = 1; while (k * 2 < n) k *= 2; return k; }   // luỹ thừa 2 lớn nhất < n (n >= 2)
static int ceilLog2(size_t n) { int c = 0; while (((size_t)1 << c) < n) c++; return c; }

static H refRoot(const vector<string>& d, size_t lo, size_t hi) {
    size_t n = hi - lo;
    if (n == 1) return MT::leaf(d[lo]);
    size_t k = splitPoint(n);
    return MT::node(refRoot(d, lo, lo + k), refRoot(d, lo + k, hi));
}
// đường chứng minh tham chiếu từ lá lên gốc (m = chỉ số lá, tính từ lo)
static void refPath(const vector<string>& d, size_t m, size_t lo, size_t hi, vector<Step>& out) {
    size_t n = hi - lo;
    if (n == 1) return;
    size_t k = splitPoint(n);
    if (m < k) { refPath(d, m, lo, lo + k, out); out.push_back({refRoot(d, lo + k, hi), false}); }
    else { refPath(d, m - k, lo + k, hi, out); out.push_back({refRoot(d, lo, lo + k), true}); }
}
static bool sameProof(const vector<Step>& a, const vector<Step>& b) {
    if (a.size() != b.size()) return false;
    for (size_t i = 0; i < a.size(); i++) if (a[i].sib != b[i].sib || a[i].sibLeft != b[i].sibLeft) return false;
    return true;
}
static string randStr(mt19937& rng, int alpha, int maxLen) {
    string s;
    int len = rng() % (maxLen + 1);
    for (int i = 0; i < len; i++) s += (char)('a' + rng() % alpha);
    return s;
}

int main() {
    mt19937 rng(20261017);
    // 1) rỗng
    {
        MT t((vector<string>()));
        if (t.root() != 0 || !t.lv.empty() || !t.proof(0).empty()) { puts("SAI: cây rỗng (gốc 0, không có proof)"); return 1; }
    }
    // 2) một khối: gốc = băm lá, proof rỗng, kiểm proof rỗng đúng với dữ liệu đúng và sai với dữ liệu khác
    {
        MT t(vector<string>{"hello"});
        if (t.root() != MT::leaf("hello") || !t.proof(0).empty()) { puts("SAI: cây một lá"); return 1; }
        if (!MT::verify("hello", t.proof(0), t.root()) || MT::verify("hellp", t.proof(0), t.root())) { puts("SAI: kiểm proof cây một lá"); return 1; }
        MT e(vector<string>{""});
        if (e.root() != MT::leaf("") || e.root() == t.root()) { puts("SAI: lá là chuỗi rỗng"); return 1; }
    }
    // 3) ví dụ trong mô tả: 4 khối a, b, c, d -> proof của c = [h(d) bên PHẢI, nút ab bên TRÁI]
    {
        vector<string> d = {"a", "b", "c", "d"};
        MT t(d);
        H ab = MT::node(MT::leaf("a"), MT::leaf("b")), cd = MT::node(MT::leaf("c"), MT::leaf("d"));
        if (t.root() != MT::node(ab, cd)) { puts("SAI: gốc của ví dụ a,b,c,d"); return 1; }
        vector<Step> p = t.proof(2);
        if (p.size() != 2 || p[0].sib != MT::leaf("d") || p[0].sibLeft || p[1].sib != ab || !p[1].sibLeft) { puts("SAI: proof của c trong ví dụ"); return 1; }
        if (!MT::verify("c", p, t.root()) || MT::verify("d", p, t.root())) { puts("SAI: kiểm proof ví dụ"); return 1; }
    }
    // 4) hàm node không giao hoán (lá/nút trái-phải khác nhau) và lá khác nút trong
    for (int i = 0; i < 2000; i++) {
        H x = ((H)rng() << 32) | rng(), y = ((H)rng() << 32) | rng();
        if (x != y && MT::node(x, y) == MT::node(y, x)) { puts("SAI: node giao hoán"); return 1; }
    }
    // 5) cây ngẫu nhiên: n = 1..70 x 3 kiểu dữ liệu (khác hết / bảng chữ cái nhỏ nên trùng nhiều / có chuỗi rỗng và rất dài)
    long long proofsChecked = 0, tampersRejected = 0;
    for (int n = 1; n <= 70; n++)
        for (int kind = 0; kind < 3; kind++) {
            vector<string> d(n);
            for (int i = 0; i < n; i++) {
                if (kind == 0) d[i] = "blk" + to_string(i) + "/" + randStr(rng, 26, 8);
                else if (kind == 1) d[i] = randStr(rng, 2, 3);
                else d[i] = (rng() % 5 == 0) ? string() : randStr(rng, 26, 200);
            }
            MT t(d);
            H expect = refRoot(d, 0, n);
            if (t.root() != expect) { printf("SAI: gốc n=%d kind=%d khác cách dựng tham chiếu\n", n, kind); return 1; }
            if ((int)t.lv.size() != ceilLog2(n) + 1 || t.lv[0].size() != (size_t)n || t.lv.back().size() != 1) { printf("SAI: số tầng n=%d\n", n); return 1; }
            size_t maxLen = 0;
            for (int i = 0; i < n; i++) {
                vector<Step> p = t.proof(i), q;
                refPath(d, i, 0, n, q);
                if (!sameProof(p, q)) { printf("SAI: proof lá %d của n=%d khác đường tham chiếu\n", i, n); return 1; }
                if ((int)p.size() > ceilLog2(n)) { printf("SAI: proof dài %zu > ceil(log2 %d)\n", p.size(), n); return 1; }
                if (n >= 2 && p.empty()) { printf("SAI: proof rỗng với n=%d >= 2\n", n); return 1; }
                maxLen = max(maxLen, p.size());
                if (!MT::verify(d[i], p, t.root())) { printf("SAI: proof đúng bị từ chối, n=%d lá %d\n", n, i); return 1; }
                proofsChecked++;
                if (MT::verify(d[i] + "x", p, t.root())) { puts("SAI: chấp nhận dữ liệu bị sửa"); return 1; }
                if (MT::verify(d[i], p, t.root() ^ 1)) { puts("SAI: chấp nhận gốc sai"); return 1; }
                tampersRejected += 2;
                H run = MT::leaf(d[i]);                         // băm đang tính dở tới bước s
                for (size_t s = 0; s < p.size(); s++) {
                    vector<Step> b = p;
                    b[s].sib ^= (H)1 << (rng() % 64);          // lật một bit của băm anh em
                    if (MT::verify(d[i], b, t.root())) { puts("SAI: chấp nhận băm anh em bị sửa"); return 1; }
                    tampersRejected++;
                    if (run != p[s].sib) {                      // (nếu anh em có băm trùng băm của mình, đổi bên không đổi gì: bỏ qua)
                        b = p;
                        b[s].sibLeft = !b[s].sibLeft;           // lật bên trái/phải
                        if (MT::verify(d[i], b, t.root())) { puts("SAI: chấp nhận anh em bị đổi bên"); return 1; }
                        tampersRejected++;
                    }
                    run = p[s].sibLeft ? MT::node(p[s].sib, run) : MT::node(run, p[s].sib);
                }
                if (!p.empty()) {
                    vector<Step> b(p.begin(), p.end() - 1);     // cụt bước cuối
                    if (MT::verify(d[i], b, t.root())) { puts("SAI: chấp nhận proof bị cụt cuối"); return 1; }
                    b.assign(p.begin() + 1, p.end());           // cụt bước đầu
                    if (MT::verify(d[i], b, t.root())) { puts("SAI: chấp nhận proof bị cụt đầu"); return 1; }
                    b = p;
                    b.push_back(p.back());                      // thêm một bước thừa
                    if (MT::verify(d[i], b, t.root())) { puts("SAI: chấp nhận proof thừa bước"); return 1; }
                    tampersRejected += 3;
                    if (p.size() >= 2 && (p[0].sib != p[1].sib || p[0].sibLeft != p[1].sibLeft)) {
                        b = p;
                        swap(b[0], b[1]);                       // đổi thứ tự hai bước
                        if (MT::verify(d[i], b, t.root())) { puts("SAI: chấp nhận proof bị đảo bước"); return 1; }
                        tampersRejected++;
                    }
                }
                if (n >= 2) {                                   // proof của lá j dùng cho dữ liệu của lá i (khi hai khối khác nhau)
                    int j = rng() % n;
                    if (j != i && d[j] != d[i] && MT::verify(d[j], p, t.root())) { puts("SAI: proof của lá này chứng minh được dữ liệu lá khác"); return 1; }
                    if (!t.proof(n + (int)(rng() % 5)).empty() || MT::verify(d[0], t.proof(n), t.root())) { puts("SAI: chỉ số lá vượt biên phải cho proof rỗng và không chứng minh được gì"); return 1; }
                }
            }
            if (maxLen != (size_t)ceilLog2(n)) { printf("SAI: proof dài nhất = %zu, mong ceil(log2 %d) = %d\n", maxLen, n, ceilLog2(n)); return 1; }
        }
    // 6) gốc đổi khi và chỉ khi dữ liệu đổi
    {
        set<H> seen;
        vector<string> pool;
        for (int i = 0; i < 45; i++) pool.push_back("item-" + to_string(i));
        for (size_t n = 0; n <= pool.size(); n++) {            // mọi tiền tố có độ dài khác nhau -> gốc khác nhau
            MT t(vector<string>(pool.begin(), pool.begin() + n));
            if (!seen.insert(t.root()).second) { printf("SAI: hai danh sách khác nhau (độ dài %zu) cùng gốc\n", n); return 1; }
        }
        for (int rep = 0; rep < 60; rep++) {
            int n = 1 + rng() % 40;
            vector<string> d(n);
            for (int i = 0; i < n; i++) d[i] = randStr(rng, 4, 6) + to_string(rng() % 50);
            MT t(d), same(vector<string>(d.begin(), d.end()));
            if (t.root() != same.root()) { puts("SAI: cùng dữ liệu cho hai gốc khác nhau"); return 1; }
            for (int k = 0; k < n; k++) {                      // đổi đúng một khối -> gốc đổi
                vector<string> e = d;
                e[k] += "!";
                MT u(e);
                if (u.root() == t.root()) { puts("SAI: đổi một khối mà gốc không đổi"); return 1; }
                // proof cũ không còn hợp lệ với gốc mới (mọi lá), proof mới hợp lệ với gốc mới
                for (int i = 0; i < n; i++) {
                    if (MT::verify(d[i], t.proof(i), u.root())) { puts("SAI: proof cũ vẫn hợp lệ với gốc mới"); return 1; }
                    if (!MT::verify(e[i], u.proof(i), u.root())) { puts("SAI: proof mới bị từ chối"); return 1; }
                }
                if (MT::verify(e[k], t.proof(k), t.root())) { puts("SAI: dữ liệu mới chứng minh được với gốc cũ"); return 1; }
            }
            for (int s = 0; s < 10 && n >= 2; s++) {           // đổi chỗ hai khối khác nhau -> gốc đổi
                int i = rng() % n, j = rng() % n;
                if (d[i] == d[j]) continue;
                vector<string> e = d;
                swap(e[i], e[j]);
                if (MT(e).root() == t.root()) { puts("SAI: đổi thứ tự mà gốc không đổi"); return 1; }
            }
            vector<string> e = d;                              // thêm khối cuối trùng khối cuối: khác gốc (không như cách nhân đôi kiểu Bitcoin)
            e.push_back(d.back());
            if (MT(e).root() == t.root()) { puts("SAI: [..., x] và [..., x, x] cùng gốc"); return 1; }
            e = d;
            e.pop_back();
            if (e.size() > 0 && MT(e).root() == t.root()) { puts("SAI: bớt một khối mà gốc không đổi"); return 1; }
        }
    }
    // 7) proof cho cây có luỹ thừa 2 lá: mọi proof đúng log2 N
    for (int lg = 0; lg <= 10; lg++) {
        size_t n = (size_t)1 << lg;
        vector<string> d;
        for (size_t i = 0; i < n; i++) d.push_back("p" + to_string(i));
        MT t(d);
        for (size_t i = 0; i < n; i++) if (t.proof(i).size() != (size_t)lg || !MT::verify(d[i], t.proof(i), t.root())) { printf("SAI: N=2^%d, lá %zu\n", lg, i); return 1; }
    }
    // 8) cây lớn: 100000 khối -> gốc khớp cách dựng tham chiếu, proof <= 17 băm, kiểm ngẫu nhiên nhiều lá
    {
        int n = 100000;
        vector<string> d(n);
        for (int i = 0; i < n; i++) d[i] = "tx" + to_string(i) + ":" + to_string(rng() % 1000000);
        MT t(d);
        if (t.root() != refRoot(d, 0, n)) { puts("SAI: gốc cây lớn"); return 1; }
        for (int s = 0; s < 3000; s++) {
            int i = (s < 100) ? (s % 2 ? n - 1 - s / 2 : s / 2) : (int)(rng() % n);   // gồm các lá đầu / cuối
            vector<Step> p = t.proof(i);
            if ((int)p.size() > 17 || !MT::verify(d[i], p, t.root())) { puts("SAI: proof cây lớn"); return 1; }
            if (MT::verify(d[i] + "x", p, t.root())) { puts("SAI: chấp nhận dữ liệu sửa (cây lớn)"); return 1; }
            if (s < 5) {
                vector<Step> q;
                refPath(d, i, 0, n, q);
                if (!sameProof(p, q)) { puts("SAI: proof cây lớn khác tham chiếu"); return 1; }
            }
        }
    }
    printf("%lld proof đúng được chấp nhận, %lld proof bị sửa đều bị từ chối\n", proofsChecked, tampersRejected);
    puts("OK");
}
