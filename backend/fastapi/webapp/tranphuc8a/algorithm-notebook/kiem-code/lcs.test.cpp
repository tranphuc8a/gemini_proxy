// @TEMPLATE

// Thử lcs / lcsLength với vét cạn (mọi dãy con của a, kiểm có là dãy con của b), kiểm xâu trả về là dãy con chung; ca lớn 3000 ký tự.
static bool isSubsequence(const string& s, const string& t) {
    size_t i = 0;
    for (char c : t) if (i < s.size() && s[i] == c) i++;
    return i == s.size();
}

static string randomString(mt19937& rng, int maxLen, int alpha) {
    string s(rng() % (maxLen + 1), 'a');
    for (auto& c : s) c = 'a' + rng() % alpha;
    return s;
}

int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 4000; iter++) {
        string a = randomString(rng, 10, 3 + iter % 2), b = randomString(rng, 10, 3 + iter % 2);
        int best = 0;
        for (int mask = 0; mask < (1 << a.size()); mask++) {
            string s;
            for (size_t i = 0; i < a.size(); i++) if ((mask >> i) & 1) s += a[i];
            if ((int)s.size() > best && isSubsequence(s, b)) best = s.size();
        }
        string res = lcs(a, b);
        if ((int)res.size() != best || !isSubsequence(res, a) || !isSubsequence(res, b) || lcsLength(a, b) != best || lcsLength(b, a) != best) {
            printf("SAI iter=%d a=%s b=%s: |lcs|=%d, vét cạn=%d, length=%d\n", iter, a.c_str(), b.c_str(), (int)res.size(), best, lcsLength(a, b));
            return 1;
        }
    }
    // ca biên
    if (!lcs("", "").empty() || !lcs("abc", "").empty() || !lcs("", "abc").empty() || lcsLength("", "abc") != 0) { puts("SAI xâu rỗng"); return 1; }
    if (lcs("abc", "abc") != "abc" || lcs("abc", "def") != "" || lcs("a", "a") != "a") { puts("SAI ca đơn giản"); return 1; }
    // ví dụ trong thư viện
    if (lcs("AGGTAB", "GXTXAYB") != "GTAB" || lcsLength("AGGTAB", "GXTXAYB") != 4) { puts("SAI ví dụ"); return 1; }
    // ca lớn: hai xâu 3000 ký tự trên bảng chữ cái nhỏ; hai xâu giống hệt
    string a = randomString(rng, 3000, 4), b = randomString(rng, 3000, 4);
    a.resize(3000, 'a');
    b.resize(3000, 'b');
    string res = lcs(a, b);
    if (!isSubsequence(res, a) || !isSubsequence(res, b) || (int)res.size() != lcsLength(a, b)) { puts("SAI ca lớn"); return 1; }
    if ((int)lcs(a, a).size() != 3000 || lcsLength(a, a) != 3000) { puts("SAI hai xâu giống nhau"); return 1; }
    puts("OK");
}
