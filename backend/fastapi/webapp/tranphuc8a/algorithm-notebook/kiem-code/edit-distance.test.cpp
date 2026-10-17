// @TEMPLATE

// Thử editDistance với BFS thật trên không gian xâu (chèn / xoá / thay một ký tự, bảng chữ cái {a,b,c}):
// mọi cặp xâu độ dài <= 4, và ca lớn so với bảng 2 chiều tự viết.
int main() {
    const int ALPHA = 3, MAXLEN = 4, LIMIT = 5;  // xâu trung gian dài tối đa LIMIT (làm xoá, rồi thay, rồi chèn thì không cần dài quá MAXLEN)
    vector<string> all;
    map<string, int> id;
    // mọi xâu độ dài <= LIMIT
    all.push_back("");
    for (size_t i = 0; i < all.size(); i++)
        if ((int)all[i].size() < LIMIT)
            for (int c = 0; c < ALPHA; c++) all.push_back(all[i] + char('a' + c));
    for (size_t i = 0; i < all.size(); i++) id[all[i]] = i;
    auto neighbors = [&](const string& s) {
        vector<string> out;
        for (size_t i = 0; i < s.size(); i++) {
            out.push_back(s.substr(0, i) + s.substr(i + 1));  // xoá
            for (int c = 0; c < ALPHA; c++) if (s[i] != 'a' + c) { string t = s; t[i] = 'a' + c; out.push_back(t); }  // thay
        }
        if ((int)s.size() < LIMIT)
            for (size_t i = 0; i <= s.size(); i++)
                for (int c = 0; c < ALPHA; c++) out.push_back(s.substr(0, i) + char('a' + c) + s.substr(i));  // chèn
        return out;
    };
    for (const string& src : all) {
        if ((int)src.size() > MAXLEN) continue;
        vector<int> dist(all.size(), -1);
        queue<int> q;
        dist[id[src]] = 0;
        q.push(id[src]);
        while (!q.empty()) {
            int u = q.front();
            q.pop();
            for (const string& t : neighbors(all[u])) {
                int v = id[t];
                if (dist[v] < 0) { dist[v] = dist[u] + 1; q.push(v); }
            }
        }
        for (const string& dst : all) {
            if ((int)dst.size() > MAXLEN) continue;
            int expect = dist[id[dst]], got = editDistance(src, dst);
            if (got != expect) { printf("SAI \"%s\" -> \"%s\": %d != %d\n", src.c_str(), dst.c_str(), got, expect); return 1; }
        }
    }
    // ví dụ trong thư viện và ca biên
    if (editDistance("kitten", "sitting") != 3 || editDistance("", "") != 0 || editDistance("abc", "") != 3 || editDistance("", "abcd") != 4 || editDistance("same", "same") != 0) { puts("SAI ví dụ / biên"); return 1; }
    // ca lớn: so với bảng 2 chiều
    mt19937 rng(20261017);
    for (int iter = 0; iter < 5; iter++) {
        int n = 1 + rng() % 1500, m = 1 + rng() % 1500;
        string a(n, 'a'), b(m, 'a');
        for (auto& c : a) c = 'a' + rng() % 4;
        for (auto& c : b) c = 'a' + rng() % 4;
        vector<vector<int>> t(n + 1, vector<int>(m + 1));
        for (int i = 0; i <= n; i++) t[i][0] = i;
        for (int j = 0; j <= m; j++) t[0][j] = j;
        for (int i = 1; i <= n; i++)
            for (int j = 1; j <= m; j++)
                t[i][j] = min(min(t[i - 1][j], t[i][j - 1]) + 1, t[i - 1][j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1));
        if (editDistance(a, b) != t[n][m]) { puts("SAI ca lớn"); return 1; }
    }
    puts("OK");
}
