// @TEMPLATE

// Thử Aho-Corasick với vét cạn: đếm số lần xuất hiện của từng mẫu (kể cả chồng nhau, mẫu trùng nhau, mẫu là hậu tố / tiền tố của mẫu khác)
// và liệt kê mọi lần khớp (vị trí kết thúc, chỉ số mẫu). Văn bản rỗng, mẫu dài hơn văn bản. Ca lớn.
static string tRand(mt19937& rng, int minLen, int maxLen, int alpha) {
    int len = minLen + rng() % (maxLen - minLen + 1);
    string s;
    for (int i = 0; i < len; i++) s += char('a' + rng() % alpha);
    return s;
}

int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 20000; iter++) {
        int alpha = 2 + rng() % 2;
        int k = 1 + rng() % 5;
        vector<string> pats;
        AhoCorasick ac;
        for (int i = 0; i < k; i++) {
            pats.push_back(tRand(rng, 1, 4, alpha));
            int id = ac.add(pats.back());
            if (id != i) { puts("SAI chỉ số mẫu trả về từ add"); return 1; }
        }
        ac.build();
        string t = tRand(rng, 0, 16, alpha);
        int n = t.size();
        vector<long long> want(k, 0);
        vector<pair<int, int>> wantPairs;
        for (int i = 0; i < k; i++) {
            int m = pats[i].size();
            for (int st = 0; st + m <= n; st++) if (t.compare(st, m, pats[i]) == 0) { want[i]++; wantPairs.push_back({st + m - 1, i}); }
        }
        vector<long long> got = ac.countAll(t);
        if (got != want) { printf("SAI countAll t=%s\n", t.c_str()); return 1; }
        vector<pair<int, int>> gotPairs = ac.findAll(t);
        sort(gotPairs.begin(), gotPairs.end());
        sort(wantPairs.begin(), wantPairs.end());
        if (gotPairs != wantPairs) { printf("SAI findAll t=%s (%d != %d lần khớp)\n", t.c_str(), (int)gotPairs.size(), (int)wantPairs.size()); return 1; }
    }
    // ví dụ kinh điển: he, she, his, hers trong "ushers"
    {
        AhoCorasick ac;
        for (string p : {"he", "she", "his", "hers"}) ac.add(p);
        ac.build();
        if (ac.countAll("ushers") != vector<long long>({1, 1, 0, 1})) { puts("SAI ví dụ"); return 1; }
    }
    // ca lớn: 200000 chữ 'a'; các mẫu a, aa, ..., a^50
    {
        AhoCorasick ac;
        for (int len = 1; len <= 50; len++) ac.add(string(len, 'a'));
        ac.build();
        vector<long long> c = ac.countAll(string(200000, 'a'));
        for (int len = 1; len <= 50; len++) if (c[len - 1] != 200000 - len + 1) { puts("SAI ca lớn"); return 1; }
    }
    // ca lớn ngẫu nhiên: 1000 mẫu dài 1..6 trên 4 chữ cái (có mẫu trùng nhau), văn bản 300000; so với bản đồ đếm xâu con
    {
        vector<string> pats;
        AhoCorasick ac;
        for (int i = 0; i < 1000; i++) { pats.push_back(tRand(rng, 1, 6, 4)); ac.add(pats.back()); }
        ac.build();
        string t = tRand(rng, 300000, 300000, 4);   // bảng chữ cái nhỏ để có khớp
        map<string, long long> cnt;
        for (int st = 0; st < (int)t.size(); st++) for (int len = 1; len <= 6 && st + len <= (int)t.size(); len++) cnt[t.substr(st, len)]++;
        vector<long long> c = ac.countAll(t);
        for (int i = 0; i < (int)pats.size(); i++) {
            auto it = cnt.find(pats[i]);
            long long want = it == cnt.end() ? 0 : it->second;
            if (c[i] != want) { puts("SAI ca lớn ngẫu nhiên"); return 1; }
        }
    }
    puts("OK");
}
