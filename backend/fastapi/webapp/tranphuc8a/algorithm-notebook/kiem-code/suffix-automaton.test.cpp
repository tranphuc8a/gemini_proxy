// @TEMPLATE

// Thử Suffix Automaton với vét cạn: số xâu con phân biệt (set), số lần xuất hiện của mọi xâu con và mẫu ngẫu nhiên, contains,
// xâu con chung dài nhất của hai xâu; xâu rỗng / một ký tự; ca lớn (số trạng thái ≤ 2N).
static string tRand(mt19937& rng, int maxLen, int alpha) {
    int len = rng() % (maxLen + 1);
    string s;
    for (int i = 0; i < len; i++) s += char('a' + rng() % alpha);
    return s;
}

static int tCount(const string& t, const string& p) {
    int c = 0, m = p.size();
    for (int i = 0; i + m <= (int)t.size(); i++) if (t.compare(i, m, p) == 0) c++;
    return c;
}

int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 8000; iter++) {
        int alpha = 1 + rng() % 3;
        string s = tRand(rng, 14, alpha), t = tRand(rng, 10, alpha);
        int n = s.size();
        SuffixAutomaton sam(s);
        set<string> all;
        for (int i = 0; i < n; i++) for (int len = 1; i + len <= n; len++) all.insert(s.substr(i, len));
        if (sam.distinctSubstrings() != (long long)all.size()) { printf("SAI distinctSubstrings %s: %lld != %d\n", s.c_str(), sam.distinctSubstrings(), (int)all.size()); return 1; }
        if (n >= 2 && (int)sam.len.size() > 2 * n - 1) { puts("SAI: quá 2N-1 trạng thái"); return 1; }
        for (const string& w : all) {
            if (!sam.contains(w) || sam.occurrences(w) != tCount(s, w)) { printf("SAI occurrences(%s) trong %s: %lld != %d\n", w.c_str(), s.c_str(), sam.occurrences(w), tCount(s, w)); return 1; }
        }
        for (int rep = 0; rep < 4; rep++) {
            string p = tRand(rng, 5, alpha);
            if (p.empty()) continue;
            if (sam.contains(p) != (tCount(s, p) > 0) || sam.occurrences(p) != tCount(s, p)) { printf("SAI mẫu ngẫu nhiên %s trong %s\n", p.c_str(), s.c_str()); return 1; }
        }
        // xâu con chung dài nhất của s và t
        int best = 0;
        for (int i = 0; i < n; i++) for (int len = best + 1; i + len <= n; len++) if (t.find(s.substr(i, len)) != string::npos) best = len; else break;
        if (sam.longestCommonSubstring(t) != best) { printf("SAI longestCommonSubstring %s %s: %d != %d\n", s.c_str(), t.c_str(), sam.longestCommonSubstring(t), best); return 1; }
    }
    // ví dụ
    {
        SuffixAutomaton sam("abcbc");
        if (sam.distinctSubstrings() != 12 || sam.occurrences("bc") != 2 || sam.occurrences("abc") != 1 || sam.occurrences("cb") != 1 || sam.contains("ca")) { puts("SAI ví dụ"); return 1; }
        SuffixAutomaton e("");
        if (e.distinctSubstrings() != 0 || e.contains("a")) { puts("SAI xâu rỗng"); return 1; }
    }
    // ca lớn 1: toàn 'a' 100000 -> N xâu con phân biệt, a^k xuất hiện N-k+1 lần
    {
        int n = 100000;
        SuffixAutomaton sam{string(n, 'a')};
        if (sam.distinctSubstrings() != n || sam.occurrences(string(n / 2, 'a')) != n - n / 2 + 1 || (int)sam.len.size() > 2 * n) { puts("SAI toàn 'a'"); return 1; }
    }
    // ca lớn 2: ngẫu nhiên 26 chữ, 200000 ký tự — số trạng thái ≤ 2N, xâu con của chính nó luôn tìm thấy
    {
        int n = 200000;
        string s = tRand(rng, 0, 26);
        while ((int)s.size() < n) s += char('a' + rng() % 26);
        SuffixAutomaton sam(s);
        if ((int)sam.len.size() > 2 * n) { puts("SAI: quá 2N trạng thái"); return 1; }
        for (int rep = 0; rep < 1000; rep++) {
            int l = rng() % n, len = 1 + rng() % min(30, n - l);
            if (!sam.contains(s.substr(l, len)) || sam.occurrences(s.substr(l, len)) < 1) { puts("SAI: không tìm thấy xâu con có thật"); return 1; }
        }
        if (sam.longestCommonSubstring(s) != n) { puts("SAI LCS với chính nó"); return 1; }
    }
    puts("OK");
}
