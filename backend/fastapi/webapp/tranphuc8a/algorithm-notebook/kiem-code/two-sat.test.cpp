// @TEMPLATE

// Thử 2-SAT: (1) so với vét cạn 2^n biến trên bài ngẫu nhiên nhỏ (mệnh đề trùng, (x ∨ x), (x ∨ ¬x), hai literal cùng biến, n = 0);
// khi có nghiệm thì nghiệm trả về phải thoả MỌI mệnh đề; (2) bài lớn có nghiệm ẩn (mọi mệnh đề đúng với một phép gán ẩn) -> phải có nghiệm và nghiệm thoả mọi mệnh đề;
// (3) chuỗi kéo theo dài 300000 biến ép vô nghiệm (đệ quy sẽ tràn stack); (4) mã hoá phụ: x != y, x = y.
struct Cl { int a; bool va; int b; bool vb; };

static bool thoa(const vector<char>& val, const vector<Cl>& cs) {
    for (const Cl& c : cs) if (!((val[c.a] == (char)c.va) || (val[c.b] == (char)c.vb))) return false;
    return true;
}

int main() {
    mt19937 rng(20261026);
    for (int iter = 0; iter < 6000; iter++) {
        int n = rng() % 9, m = n ? rng() % 25 : 0;
        TwoSat ts(n);
        vector<Cl> cs;
        for (int i = 0; i < m; i++) {
            Cl c = {(int)(rng() % n), (bool)(rng() % 2), (int)(rng() % n), (bool)(rng() % 2)};
            if (rng() % 8 == 0) { c.b = c.a; c.vb = c.va; }                 // (x ∨ x): ép x
            ts.add_clause(c.a, c.va, c.b, c.vb);
            cs.push_back(c);
        }
        bool want = false;
        for (int mask = 0; mask < (1 << n) && !want; mask++) {
            vector<char> val(n);
            for (int i = 0; i < n; i++) val[i] = (mask >> i) & 1;
            want = thoa(val, cs);
        }
        bool got = ts.solve();
        if (got != want) { printf("SAI iter=%d n=%d m=%d: solve = %d, vét cạn = %d\n", iter, n, m, (int)got, (int)want); return 1; }
        if (got && !thoa(ts.val, cs)) { printf("SAI iter=%d: nghiệm trả về không thoả mọi mệnh đề\n", iter); return 1; }
    }
    // bài lớn có nghiệm ẩn
    {
        int n = 60000, m = 180000;
        vector<char> hidden(n);
        for (auto& x : hidden) x = rng() % 2;
        TwoSat ts(n);
        vector<Cl> cs;
        for (int i = 0; i < m; i++) {
            int a = rng() % n, b = rng() % n;
            bool va = rng() % 2, vb = rng() % 2;
            if (!((hidden[a] == (char)va) || (hidden[b] == (char)vb))) { if (rng() % 2) va = !va; else vb = !vb; }
            ts.add_clause(a, va, b, vb);
            cs.push_back({a, va, b, vb});
        }
        if (!ts.solve()) { puts("SAI bài lớn có nghiệm ẩn nhưng solve = false"); return 1; }
        if (!thoa(ts.val, cs)) { puts("SAI nghiệm bài lớn không thoả"); return 1; }
    }
    // chuỗi kéo theo x0 -> x1 -> ... -> x_{n-1}, ép x0 đúng và x_{n-1} sai -> vô nghiệm
    {
        int n = 300000;
        TwoSat ts(n);
        for (int i = 0; i + 1 < n; i++) ts.add_clause(i, false, i + 1, true);     // (¬x_i ∨ x_{i+1})
        ts.add_clause(0, true, 0, true);
        if (!ts.solve()) { /* chưa ép x_{n-1} sai: phải có nghiệm (tất cả đúng) */ puts("SAI chuỗi kéo theo phải có nghiệm"); return 1; }
        for (int i = 0; i < n; i++) if (!ts.val[i]) { puts("SAI chuỗi kéo theo: mọi biến phải đúng"); return 1; }
        ts.add_clause(n - 1, false, n - 1, false);                                  // (¬x_{n-1})
        if (ts.solve()) { puts("SAI chuỗi kéo theo phải vô nghiệm"); return 1; }
    }
    // mã hoá phụ: x != y và x = y
    {
        TwoSat ts(3);
        ts.add_xor(0, 1);                  // x0 != x1
        ts.add_equal(1, 2);                // x1 == x2
        ts.add_clause(0, true, 0, true);   // x0 đúng
        if (!ts.solve() || !ts.val[0] || ts.val[1] || ts.val[2]) { puts("SAI add_xor / add_equal"); return 1; }
        ts.add_clause(2, true, 2, true);   // thêm x2 đúng -> mâu thuẫn
        if (ts.solve()) { puts("SAI: x0 != x1 = x2, x0 và x2 cùng đúng phải vô nghiệm"); return 1; }
    }
    puts("OK");
    return 0;
}
