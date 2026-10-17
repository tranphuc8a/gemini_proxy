// @TEMPLATE

// Thử Rolling Hash: hash hai xâu con bằng nhau <=> nội dung bằng nhau (mọi cặp xâu con của xâu ngẫu nhiên nhỏ), LCP so với vét cạn,
// xâu rỗng / một ký tự, ca lớn, và kiểm chứng rằng hash tràn số mod 2^64 bị Thue–Morse phá còn mod 2^61-1 thì không.
static string tRand(mt19937& rng, int maxLen, int alpha) {
    int len = rng() % (maxLen + 1);
    string s;
    for (int i = 0; i < len; i++) s += char('a' + rng() % alpha);
    return s;
}

// hash đa thức "ngây thơ" theo mod 2^64 (tràn số tự nhiên)
static unsigned long long hash64(const string& s, unsigned long long B) {
    unsigned long long h = 0;
    for (char c : s) h = h * B + (unsigned char)c;
    return h;
}

int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 400; iter++) {
        int alpha = 2 + rng() % 2;
        string s = tRand(rng, 16, alpha);
        int n = s.size();
        RollingHash H(s, 911382323ULL + iter);   // cơ số cố định để lần chạy lặp lại được
        for (int l1 = 0; l1 <= n; l1++)
            for (int r1 = l1; r1 <= n; r1++)
                for (int l2 = 0; l2 <= n; l2++)
                    for (int r2 = l2; r2 <= n; r2++) {
                        bool same = r1 - l1 == r2 - l2 && s.compare(l1, r1 - l1, s, l2, r2 - l2) == 0;
                        if (H.equal(l1, r1, l2, r2) != same) { printf("SAI equal s=%s [%d,%d) [%d,%d)\n", s.c_str(), l1, r1, l2, r2); return 1; }
                        if (r1 - l1 == r2 - l2 && same != (H.get(l1, r1) == H.get(l2, r2))) { puts("SAI get"); return 1; }
                    }
        for (int i = 0; i <= n; i++)
            for (int j = 0; j <= n; j++) {
                int best = 0;
                while (i + best < n && j + best < n && s[i + best] == s[j + best]) best++;
                if (H.lcp(i, j) != best) { printf("SAI lcp s=%s i=%d j=%d: %d != %d\n", s.c_str(), i, j, H.lcp(i, j), best); return 1; }
            }
    }
    // cơ số ngẫu nhiên mặc định cũng phải đúng
    {
        string s = "abracadabra";
        RollingHash H(s);
        if (!H.equal(0, 4, 7, 11) || H.equal(0, 4, 1, 5) || H.get(3, 3) != 0 || H.lcp(0, 7) != 4) { puts("SAI cơ số ngẫu nhiên"); return 1; }
        RollingHash E("");
        if (E.get(0, 0) != 0 || E.lcp(0, 0) != 0) { puts("SAI xâu rỗng"); return 1; }
    }
    // ca lớn: xâu ngẫu nhiên 400000 ký tự, nhân đôi; hai nửa phải trùng, nửa sau bị đổi một ký tự thì phải khác
    {
        string half;
        for (int i = 0; i < 400000; i++) half += char('a' + rng() % 2);
        string s = half + half;
        RollingHash H(s);
        if (!H.equal(0, 400000, 400000, 800000) || H.lcp(0, 400000) != 400000) { puts("SAI ca lớn"); return 1; }
        s[400000 + 12345] ^= 1;
        RollingHash H2(s);
        if (H2.equal(0, 400000, 400000, 800000) || H2.lcp(0, 400000) != 12345) { puts("SAI ca lớn (đổi một ký tự)"); return 1; }
    }
    // Thue–Morse: hai xâu T và bù của T, mỗi xâu dài 2^10 = 1024, có hash mod 2^64 trùng nhau với MỌI cơ số lẻ
    {
        string a = "a", b = "b";
        for (int i = 0; i < 10; i++) { string na = a + b, nb = b + a; a = na; b = nb; }
        if (a.size() != 1024 || a == b) { puts("SAI dựng Thue–Morse"); return 1; }
        for (int it = 0; it < 50; it++) {
            unsigned long long B = (((unsigned long long)rng() << 32) | rng()) | 1ULL;
            if (hash64(a, B) != hash64(b, B)) { puts("SAI: Thue–Morse 2^10 không va chạm mod 2^64"); return 1; }
        }
        // còn RollingHash (mod 2^61-1, cơ số tuỳ ý) thì phân biệt được
        RollingHash H(a + b);
        if (H.get(0, 1024) == H.get(1024, 2048)) { puts("SAI: RollingHash va chạm trên Thue–Morse"); return 1; }
    }
    puts("OK");
}
