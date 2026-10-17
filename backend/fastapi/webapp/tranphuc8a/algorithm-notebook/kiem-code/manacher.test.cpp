// @TEMPLATE

// Thử Manacher với vét cạn O(N^3) trên xâu ngẫu nhiên (bảng chữ cái 1–3 ký tự): d1, d2, isPalindrome mọi đoạn, tổng số palindrome con, palindrome dài nhất.
static string tRand(mt19937& rng, int maxLen, int alpha) {
    int len = rng() % (maxLen + 1);
    string s;
    for (int i = 0; i < len; i++) s += char('a' + rng() % alpha);
    return s;
}

static bool tIsPal(const string& s, int l, int r) {
    while (l < r) if (s[l++] != s[r--]) return false;
    return true;
}

int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 20000; iter++) {
        int alpha = 1 + rng() % 3;
        string s = tRand(rng, 24, alpha);
        int n = s.size();
        Manacher M(s);
        if ((int)M.d1.size() != n || (int)M.d2.size() != n) { puts("SAI kích thước d1/d2"); return 1; }
        long long total = 0;
        int bestLen = 0;
        for (int l = 0; l < n; l++)
            for (int r = l; r < n; r++) {
                bool pal = tIsPal(s, l, r);
                if (pal) { total++; bestLen = max(bestLen, r - l + 1); }
                if (M.isPalindrome(l, r) != pal) { printf("SAI isPalindrome s=%s [%d,%d]\n", s.c_str(), l, r); return 1; }
            }
        // d1[i] = số palindrome lẻ tâm i, d2[i] = số palindrome chẵn tâm giữa i-1 và i
        for (int i = 0; i < n; i++) {
            int c1 = 0, c2 = 0;
            for (int k = 1; i - k + 1 >= 0 && i + k - 1 < n; k++) if (tIsPal(s, i - k + 1, i + k - 1)) c1++; else break;
            for (int k = 1; i - k >= 0 && i + k - 1 < n; k++) if (tIsPal(s, i - k, i + k - 1)) c2++; else break;
            if (M.d1[i] != c1 || M.d2[i] != c2) { printf("SAI d1/d2[%d] của %s: (%d,%d) != (%d,%d)\n", i, s.c_str(), M.d1[i], M.d2[i], c1, c2); return 1; }
        }
        if (M.countAll() != total) { printf("SAI countAll %s: %lld != %lld\n", s.c_str(), M.countAll(), total); return 1; }
        pair<int, int> lg = M.longest();
        if (lg.second != bestLen) { printf("SAI longest %s: %d != %d\n", s.c_str(), lg.second, bestLen); return 1; }
        if (lg.second > 0 && (lg.first < 0 || lg.first + lg.second > n || !tIsPal(s, lg.first, lg.first + lg.second - 1))) { puts("SAI vị trí longest"); return 1; }
    }
    // ví dụ
    {
        Manacher M("abaaba");
        if (M.d1 != vector<int>({1, 2, 1, 1, 2, 1}) || M.d2 != vector<int>({0, 0, 0, 3, 0, 0}) || M.countAll() != 11 || M.longest() != make_pair(0, 6)) { puts("SAI ví dụ"); return 1; }
        Manacher E("");
        if (E.countAll() != 0 || E.longest() != make_pair(0, 0)) { puts("SAI xâu rỗng"); return 1; }
    }
    // ca lớn: toàn 'a' (mọi đoạn đều là palindrome) và 'ab' lặp lại (palindrome lẻ dài nhất = cả xâu nếu độ dài lẻ)
    {
        int n = 200000;
        Manacher M(string(n, 'a'));
        if (M.countAll() != (long long)n * (n + 1) / 2 || M.longest() != make_pair(0, n) || !M.isPalindrome(5, n - 7)) { puts("SAI toàn 'a'"); return 1; }
        string s;
        for (int i = 0; i < n + 1; i++) s += char('a' + i % 2);
        Manacher P(s);
        if (P.longest().second != n + 1 || P.isPalindrome(0, n - 1)) { puts("SAI 'ab' lặp"); return 1; }
    }
    puts("OK");
}
