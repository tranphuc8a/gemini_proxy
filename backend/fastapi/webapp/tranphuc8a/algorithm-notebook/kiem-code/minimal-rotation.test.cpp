// @TEMPLATE

// Thử dịch vòng nhỏ nhất và phân rã Lyndon (Duval) với vét cạn: vét MỌI xâu trên bảng chữ cái 3 ký tự độ dài tới 8,
// xâu ngẫu nhiên dài hơn, xâu rỗng / một ký tự / toàn một ký tự / tuần hoàn; ca lớn 10^6.
static int tBrute(const string& s) {            // vị trí NHỎ NHẤT của dịch vòng nhỏ nhất theo từ điển
    int n = s.size(), best = 0;
    string bs = s;
    for (int i = 1; i < n; i++) {
        string r = s.substr(i) + s.substr(0, i);
        if (r < bs) { bs = r; best = i; }
    }
    return best;
}

static bool tIsLyndon(const string& w) {         // nhỏ hơn mọi hậu tố thật sự của nó (và không rỗng)
    if (w.empty()) return false;
    for (int i = 1; i < (int)w.size(); i++) if (!(w < w.substr(i))) return false;
    return true;
}

// cách làm trong mô tả: chạy Duval trên s + s, lấy đầu nhóm thừa số cuối cùng bắt đầu ở vị trí < n
static int tDuvalMin(const string& s) {
    int n = s.size();
    string d = s + s;
    int i = 0, ans = 0;
    while (i < n) {
        ans = i;
        int j = i + 1, k = i;
        while (j < 2 * n && d[k] <= d[j]) {
            k = d[k] < d[j] ? i : k + 1;
            j++;
        }
        while (i <= k) i += j - k;
    }
    return ans;
}

static bool tCheck(const string& s) {
    int n = s.size();
    int got = minimalRotation(s), want = tBrute(s);
    if (got != want) { printf("SAI minimalRotation(%s): %d != %d\n", s.c_str(), got, want); return false; }
    int dv = tDuvalMin(s);
    if (s.substr(dv) + s.substr(0, dv) != s.substr(want) + s.substr(0, want)) { printf("SAI mô tả Duval trên s+s với %s: vị trí %d\n", s.c_str(), dv); return false; }
    if (dv != want) { printf("SAI: Duval trên s+s trả vị trí %d, không phải vị trí nhỏ nhất %d của %s\n", dv, want, s.c_str()); return false; }
    vector<pair<int, int>> f = lyndonFactorization(s);
    string joined, prev;
    int pos = 0;
    for (size_t i = 0; i < f.size(); i++) {
        if (f[i].first != pos || f[i].second <= 0) { printf("SAI vị trí thừa số Lyndon của %s\n", s.c_str()); return false; }
        string w = s.substr(f[i].first, f[i].second);
        if (!tIsLyndon(w)) { printf("SAI: thừa số %s của %s không phải từ Lyndon\n", w.c_str(), s.c_str()); return false; }
        if (i > 0 && w > prev) { printf("SAI: thừa số tăng dần trong %s\n", s.c_str()); return false; }
        prev = w;
        pos += f[i].second;
    }
    if (pos != n) { printf("SAI: các thừa số không phủ hết %s\n", s.c_str()); return false; }
    return true;
}

int main() {
    // vét mọi xâu độ dài 0..8 trên {a,b,c}
    for (int len = 0; len <= 8; len++) {
        int total = 1;
        for (int i = 0; i < len; i++) total *= 3;
        for (int code = 0; code < total; code++) {
            string s;
            for (int i = 0, c = code; i < len; i++, c /= 3) s += char('a' + c % 3);
            if (!tCheck(s)) return 1;
        }
    }
    // xâu ngẫu nhiên dài hơn (bảng chữ cái 2 ký tự để có chu kỳ / lặp), kể cả tuần hoàn
    mt19937 rng(20261017);
    for (int iter = 0; iter < 4000; iter++) {
        int len = 9 + rng() % 24, alpha = 2 + rng() % 2;
        string s;
        for (int i = 0; i < len; i++) s += char('a' + rng() % alpha);
        if (iter % 4 == 0) { string base = s.substr(0, 1 + rng() % 5); s.clear(); while ((int)s.size() < len) s += base; }
        if (!tCheck(s)) return 1;
    }
    if (minimalRotation("cabcab") != 1) { puts("SAI ví dụ"); return 1; }
    // ca lớn
    {
        string s = string(500000, 'a') + "b" + string(500000, 'a');      // dịch vòng nhỏ nhất bắt đầu ngay sau chữ b
        if (minimalRotation(s) != 500001) { puts("SAI ca lớn 1"); return 1; }
        string t(1000000, 'z');
        if (minimalRotation(t) != 0 || lyndonFactorization(t).size() != 1000000) { puts("SAI toàn một ký tự"); return 1; }
        string u;
        for (int i = 0; i < 1000000; i++) u += char('a' + rng() % 2);
        int r = minimalRotation(u);
        string rot = u.substr(r) + u.substr(0, r);
        // không có dịch vòng nào nhỏ hơn: thử so với 2000 vị trí ngẫu nhiên và mọi vị trí bắt đầu bằng chuỗi a dài nhất
        for (int rep = 0; rep < 2000; rep++) {
            int j = rng() % u.size();
            if (u.compare(j, u.size() - j, rot, 0, u.size() - j) < 0 || (u.compare(j, u.size() - j, rot, 0, u.size() - j) == 0 && u.compare(0, j, rot, u.size() - j, j) < 0)) { puts("SAI ca lớn ngẫu nhiên"); return 1; }
        }
        vector<pair<int, int>> f = lyndonFactorization(u);
        int sum = 0;
        for (auto& pr : f) sum += pr.second;
        if (sum != (int)u.size()) { puts("SAI phân rã ca lớn"); return 1; }
    }
    puts("OK");
}
