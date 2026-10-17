// @TEMPLATE

// Thử Z-function với vét cạn trên xâu ngẫu nhiên (bảng chữ cái 2–3 ký tự), gồm xâu rỗng, một ký tự, mẫu dài hơn văn bản.
static string tRand(mt19937& rng, int maxLen, int alpha) {
    int len = rng() % (maxLen + 1);
    string s;
    for (int i = 0; i < len; i++) s += char('a' + rng() % alpha);
    return s;
}

int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 30000; iter++) {
        int alpha = 2 + rng() % 2;
        string t = tRand(rng, 14, alpha), p = tRand(rng, 7, alpha);
        int n = t.size(), m = p.size();
        // 1) mảng Z so với định nghĩa (z[0] = n theo quy ước của mẫu)
        vector<int> z = zFunction(t);
        if ((int)z.size() != n) { puts("SAI kích thước z"); return 1; }
        for (int i = 0; i < n; i++) {
            int best = 0;
            while (i + best < n && t[best] == t[i + best]) best++;
            if (z[i] != best) { printf("SAI z[%d] của %s: %d != %d\n", i, t.c_str(), z[i], best); return 1; }
        }
        // 2) tìm mẫu
        vector<int> expect;
        if (m > 0) for (int i = 0; i + m <= n; i++) if (t.compare(i, m, p) == 0) expect.push_back(i);
        if (zFind(t, p) != expect) { printf("SAI zFind t=%s p=%s\n", t.c_str(), p.c_str()); return 1; }
        // 3) chu kỳ nhỏ nhất
        int period = 0;
        for (int q = 1; q <= n && !period; q++) {
            bool ok = true;
            for (int i = 0; i + q < n; i++) if (t[i] != t[i + q]) { ok = false; break; }
            if (ok) period = q;
        }
        if (smallestPeriod(t) != period) { printf("SAI smallestPeriod %s: %d != %d\n", t.c_str(), smallestPeriod(t), period); return 1; }
    }
    // ca biên cố định
    if (!zFind("", "a").empty() || !zFind("abc", "abcd").empty() || !zFind("abc", "").empty()) { puts("SAI ca biên rỗng/mẫu dài hơn"); return 1; }
    if (zFind("aaa", "aa") != vector<int>({0, 1})) { puts("SAI khớp chồng nhau"); return 1; }
    if (zFunction("aabcaab") != vector<int>({7, 1, 0, 0, 3, 1, 0})) { puts("SAI ví dụ"); return 1; }
    // ca lớn: 10^6 ký tự
    string big(1000000, 'a');
    if ((int)zFind(big, string(500000, 'a')).size() != 500001) { puts("SAI ca lớn 1"); return 1; }
    string big2 = string(999999, 'a') + "b";
    if (zFind(big2, string(1000, 'a') + "b") != vector<int>({999999 - 1000})) { puts("SAI ca lớn 2"); return 1; }
    if (smallestPeriod(big) != 1 || smallestPeriod(big2) != 1000000) { puts("SAI chu kỳ ca lớn"); return 1; }
    puts("OK");
}
