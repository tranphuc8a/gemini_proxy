// @TEMPLATE

// Thử Suffix Array + LCP với vét cạn (sắp xếp mọi hậu tố), số xâu con phân biệt bằng set, tìm mẫu bằng saRange;
// xâu rỗng / một ký tự / toàn một ký tự / có byte > 127; rồi ca lớn kiểm bằng tính chất (thứ tự kề nhau + LCP).
static string tRand(mt19937& rng, int maxLen, int alpha, int base = 'a') {
    int len = rng() % (maxLen + 1);
    string s;
    for (int i = 0; i < len; i++) s += char(base + rng() % alpha);
    return s;
}

int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 6000; iter++) {
        int alpha = 1 + rng() % 3;
        string s = iter % 5 == 4 ? tRand(rng, 20, alpha, 200) : tRand(rng, 20, alpha);   // 1/5 số ca dùng ký tự có mã > 127
        int n = s.size();
        vector<int> sa = suffixArray(s), lcp = kasai(s, sa);
        vector<int> idx(n);
        iota(idx.begin(), idx.end(), 0);
        sort(idx.begin(), idx.end(), [&](int a, int b) { return s.substr(a) < s.substr(b); });
        if (sa != idx) { printf("SAI suffixArray s=%s\n", s.c_str()); return 1; }
        if ((int)lcp.size() != n) { puts("SAI kích thước lcp"); return 1; }
        for (int i = 0; i < n; i++) {
            int want = 0;
            if (i > 0) while (sa[i] + want < n && sa[i - 1] + want < n && s[sa[i] + want] == s[sa[i - 1] + want]) want++;
            if (lcp[i] != want) { printf("SAI lcp[%d] của %s: %d != %d\n", i, s.c_str(), lcp[i], want); return 1; }
        }
        set<string> all;
        for (int i = 0; i < n; i++) for (int len = 1; i + len <= n; len++) all.insert(s.substr(i, len));
        if (distinctSubstrings(s, lcp) != (long long)all.size()) { printf("SAI distinctSubstrings %s: %lld != %d\n", s.c_str(), distinctSubstrings(s, lcp), (int)all.size()); return 1; }
        // tìm mẫu: mẫu ngẫu nhiên (có thể rỗng, có thể dài hơn s) và một xâu con thật
        vector<string> pats;
        for (int rep = 0; rep < 4; rep++) pats.push_back(tRand(rng, 4, alpha));
        if (n > 0) pats.push_back(s.substr(rng() % n, 1 + rng() % 3));
        for (const string& p : pats) {
            int m = p.size();
            vector<int> pos;
            for (int i = 0; i < n; i++) if (s.compare(i, m, p) == 0) pos.push_back(i);
            pair<int, int> rg = saRange(s, sa, p);
            vector<int> got(sa.begin() + rg.first, sa.begin() + rg.second);
            sort(got.begin(), got.end());
            if (got != pos) { printf("SAI saRange s=%s p=%s\n", s.c_str(), p.c_str()); return 1; }
        }
    }
    // ví dụ banana
    {
        string s = "banana";
        vector<int> sa = suffixArray(s), lcp = kasai(s, sa);
        if (sa != vector<int>({5, 3, 1, 0, 4, 2}) || lcp != vector<int>({0, 1, 3, 0, 0, 2}) || distinctSubstrings(s, lcp) != 15) { puts("SAI ví dụ banana"); return 1; }
    }
    // ca lớn 1: toàn 'a' (đường chéo xấu nhất của nhân đôi)
    {
        int n = 200000;
        string s(n, 'a');
        vector<int> sa = suffixArray(s), lcp = kasai(s, sa);
        for (int i = 0; i < n; i++) if (sa[i] != n - 1 - i || lcp[i] != i) { puts("SAI toàn 'a'"); return 1; }
    }
    // ca lớn 2: ngẫu nhiên 2 chữ cái, 200000 ký tự: kiểm thứ tự từng cặp kề nhau và LCP chính xác
    // ca lớn 3: "ab" lặp lại (chu kỳ ngắn) — chỉ kiểm thứ tự + LCP tối đại (không so từng ký tự để khỏi O(N^2))
    for (int test = 0; test < 2; test++) {
        int n = 200000;
        string s;
        for (int i = 0; i < n; i++) s += test == 0 ? char('a' + rng() % 2) : char('a' + i % 2);
        vector<int> sa = suffixArray(s), lcp = kasai(s, sa);
        vector<char> seen(n, 0);
        for (int x : sa) { if (x < 0 || x >= n || seen[x]) { puts("SAI: sa không là hoán vị"); return 1; } seen[x] = 1; }
        for (int i = 1; i < n; i++) {
            int a = sa[i - 1], b = sa[i], l = lcp[i];
            if (a + l > n || b + l > n) { puts("SAI: lcp quá dài"); return 1; }
            bool aEnds = a + l == n, bEnds = b + l == n;
            if (bEnds || (!aEnds && s[a + l] > s[b + l])) { puts("SAI thứ tự hậu tố ca lớn"); return 1; }
            if (!aEnds && !bEnds && s[a + l] == s[b + l]) { puts("SAI lcp không tối đại"); return 1; }
            if (test == 0 && s.compare(a, l, s, b, l) != 0) { puts("SAI lcp không khớp nội dung"); return 1; }
        }
    }
    puts("OK");
}
