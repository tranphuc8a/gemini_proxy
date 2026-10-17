// @TEMPLATE

// (1) balancedBrackets so với cách xoá lặp các cặp "()" "[]" "{}" cho tới khi hết; (2) evalExpr so với giá trị tính từ chính cây biểu thức
// đã sinh ngẫu nhiên (đủ ưu tiên, kết hợp trái, ngoặc thừa, khoảng trắng, dấu trừ đơn ngôi, chia cắt về 0).

static mt19937 g_rng(20261017);

static bool refBalanced(string s) {
    string f;
    for (char c : s) if (string("()[]{}").find(c) != string::npos) f += c;
    bool changed = true;
    while (changed) {
        changed = false;
        for (const char* p : {"()", "[]", "{}"}) {
            size_t pos = f.find(p);
            if (pos != string::npos) { f.erase(pos, 2); changed = true; }
        }
    }
    return f.empty();
}

struct Ex { string s; long long v; int pr; char op; };      // pr: 1 = + -, 2 = * /, 3 = nguyên tử / đơn ngôi / ngoặc

static Ex genExpr(int depth) {
    int kind = depth <= 0 ? 0 : (int)(g_rng() % 7);
    if (kind == 0) {
        long long x = g_rng() % (g_rng() % 4 == 0 ? 100000 : 21);
        return {to_string(x), x, 3, 0};
    }
    if (kind == 1) {                                         // dấu trừ đơn ngôi (ưu tiên cao nhất)
        Ex e = genExpr(depth - 1);
        return {"-" + (e.pr < 3 ? "(" + e.s + ")" : e.s), -e.v, 3, 0};
    }
    if (kind == 2) {                                         // ngoặc thừa
        Ex e = genExpr(depth - 1);
        return {"(" + e.s + ")", e.v, 3, 0};
    }
    Ex a = genExpr(depth - 1), b = genExpr(depth - 1);
    char op = "+-*/"[g_rng() % 4];
    if (op == '/' && b.v == 0) op = '+';
    if (op == '*' && llabs(a.v) > 1000000 / max(1LL, llabs(b.v))) op = '-';   // chặn tràn
    int pr = (op == '+' || op == '-') ? 1 : 2;
    bool lp = a.pr < pr;
    // Vế phải cùng mức ưu tiên chỉ bỏ ngoặc được khi toán tử cha là '+' (a + (b - c) = a + b - c luôn đúng);
    // với '*' thì không (chia nguyên không kết hợp: a * (x / y * z) khác a * x / y * z).
    bool rp = b.pr < pr || (b.pr == pr && op != '+');
    string sp1 = g_rng() % 2 ? " " : "", sp2 = g_rng() % 2 ? " " : "";
    string s = (lp ? "(" + a.s + ")" : a.s) + sp1 + op + sp2 + (rp ? "(" + b.s + ")" : b.s);
    long long v = op == '+' ? a.v + b.v : op == '-' ? a.v - b.v : op == '*' ? a.v * b.v : a.v / b.v;
    return {s, v, pr, op};
}

int main() {
    // (1) ngoặc
    int yes = 0;
    const string alpha = "()[]{}a";
    for (int iter = 0; iter < 30000; iter++) {
        string s;
        int len = g_rng() % 13;
        if (iter % 3 == 0) {                                 // sinh dãy hợp lệ có chủ đích
            function<void(int)> gen = [&](int d) {
                if (d == 0 || g_rng() % 3 == 0) return;
                int t = g_rng() % 3;
                s += "([{"[t];
                gen(d - 1);
                s += ")]}"[t];
                gen(d - 1);
            };
            gen(4);
        } else {
            for (int i = 0; i < len; i++) s += alpha[g_rng() % alpha.size()];
        }
        bool want = refBalanced(s), got = balancedBrackets(s);
        if (want) yes++;
        if (want != got) { printf("SAI ngoặc \"%s\": want=%d got=%d\n", s.c_str(), (int)want, (int)got); return 1; }
    }
    if (yes < 1000) { puts("sinh test ngoặc thiếu ca đúng"); return 1; }
    if (!balancedBrackets("") || balancedBrackets("(") || balancedBrackets(")") || !balancedBrackets("a(b)c")) { puts("SAI ca biên ngoặc"); return 1; }

    // (2) biểu thức
    for (int iter = 0; iter < 30000; iter++) {
        Ex e = genExpr(1 + g_rng() % 5);
        long long got = evalExpr(e.s);
        if (got != e.v) { printf("SAI biểu thức \"%s\": want=%lld got=%lld\n", e.s.c_str(), e.v, got); return 1; }
    }
    if (evalExpr("-7/2") != -3 || evalExpr("2--3") != 5 || evalExpr("2*-3") != -6 || evalExpr("-(2+3)*4") != -20 || evalExpr(" 10 - 4 - 3 ") != 3 || evalExpr("100/10/5") != 2) {
        puts("SAI ca biên biểu thức");
        return 1;
    }
    // chuỗi dài: 10^6 phép cộng / trừ xen kẽ
    string big = "1";
    for (int i = 0; i < 500000; i++) big += "+2-1";
    if (evalExpr(big) != 500001) { puts("SAI biểu thức dài"); return 1; }
    puts("OK");
}
