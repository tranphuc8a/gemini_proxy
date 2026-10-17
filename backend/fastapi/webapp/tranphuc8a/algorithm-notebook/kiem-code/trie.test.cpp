// @TEMPLATE

// Thử Trie với multiset<string> (insert / erase / countWord / countPrefix) trên từ ngẫu nhiên bảng chữ cái 3 ký tự, gồm từ rỗng; rồi ca lớn.
static string tRand(mt19937& rng, int maxLen, int alpha) {
    int len = rng() % (maxLen + 1);
    string s;
    for (int i = 0; i < len; i++) s += char('a' + rng() % alpha);
    return s;
}

int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 3000; iter++) {
        Trie tr;
        multiset<string> ms;
        int ops = 1 + rng() % 40;
        for (int o = 0; o < ops; o++) {
            string s = tRand(rng, 5, 3);
            int type = rng() % 4;
            if (type <= 1) {
                tr.insert(s);
                ms.insert(s);
            } else if (type == 2) {
                bool got = tr.erase(s);
                auto it = ms.find(s);
                bool want = it != ms.end();
                if (want) ms.erase(it);
                if (got != want) { printf("SAI erase(%s): %d != %d\n", s.c_str(), got, want); return 1; }
            }
            for (int rep = 0; rep < 3; rep++) {
                string q = tRand(rng, 5, 3);
                int cw = ms.count(q), cp = 0;
                for (const string& w : ms) if (w.compare(0, q.size(), q) == 0) cp++;
                if (tr.countWord(q) != cw) { printf("SAI countWord(%s): %d != %d\n", q.c_str(), tr.countWord(q), cw); return 1; }
                if (tr.countPrefix(q) != cp) { printf("SAI countPrefix(%s): %d != %d\n", q.c_str(), tr.countPrefix(q), cp); return 1; }
            }
        }
    }
    // ca cố định theo ví dụ
    {
        Trie tr;
        for (string w : {"cat", "car", "cart", "dog"}) tr.insert(w);
        if (tr.countPrefix("car") != 2 || tr.countPrefix("ca") != 3 || tr.countWord("car") != 1 || tr.countWord("ca") != 0 || tr.countPrefix("") != 4) { puts("SAI ví dụ"); return 1; }
        if (tr.erase("ca") || !tr.erase("car") || tr.countPrefix("car") != 1 || tr.countWord("car") != 0) { puts("SAI erase ví dụ"); return 1; }
    }
    // ca lớn: 200000 từ ngẫu nhiên dài 1..8 trên 26 chữ cái
    {
        Trie tr;
        map<string, int> cnt;
        vector<string> words;
        for (int i = 0; i < 200000; i++) {
            string s;
            int len = 1 + rng() % 8;
            for (int j = 0; j < len; j++) s += char('a' + rng() % 26);
            tr.insert(s);
            cnt[s]++;
            words.push_back(s);
        }
        for (int i = 0; i < 2000; i++) {
            const string& w = words[rng() % words.size()];
            if (tr.countWord(w) != cnt[w]) { puts("SAI ca lớn countWord"); return 1; }
            string pre = w.substr(0, 1 + rng() % w.size());
            auto lo = cnt.lower_bound(pre);
            int want = 0;
            for (auto it = lo; it != cnt.end() && it->first.compare(0, pre.size(), pre) == 0; ++it) want += it->second;
            if (tr.countPrefix(pre) != want) { puts("SAI ca lớn countPrefix"); return 1; }
        }
    }
    puts("OK");
}
