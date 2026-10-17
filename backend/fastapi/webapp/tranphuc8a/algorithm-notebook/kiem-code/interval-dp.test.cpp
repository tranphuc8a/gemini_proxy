// @TEMPLATE

// Thử matrixChain với vét cạn MỌI cách đặt ngoặc (liệt kê toàn bộ cây nhị phân, n <= 9); phân tích chuỗi order để tính lại chi phí; ca lớn n = 300.
// Liệt kê mọi chi phí nhân A_i..A_j trên mọi cách đặt ngoặc.
static vector<long long> allCosts(const vector<long long>& d, int i, int j) {
    if (i == j) return {0};
    vector<long long> out;
    for (int k = i; k < j; k++)
        for (long long a : allCosts(d, i, k))
            for (long long b : allCosts(d, k + 1, j)) out.push_back(a + b + d[i] * d[k + 1] * d[j + 1]);
    return out;
}

// Tính chi phí của biểu thức đặt ngoặc dạng "((A0 A1) A2)" bằng cách phân tích cú pháp; trả -1 nếu sai dạng.
struct Parser {
    const string& s;
    const vector<long long>& d;
    size_t pos = 0;
    vector<int> used;
    // Trả về (số dòng, số cột, chi phí) của biểu thức
    bool expr(long long& rows, long long& cols, long long& cost) {
        if (pos < s.size() && s[pos] == 'A') {
            pos++;
            size_t st = pos;
            while (pos < s.size() && isdigit((unsigned char)s[pos])) pos++;
            if (st == pos) return false;
            int idx = stoi(s.substr(st, pos - st));
            if (idx < 0 || idx + 1 >= (int)d.size()) return false;
            used.push_back(idx);
            rows = d[idx]; cols = d[idx + 1]; cost = 0;
            return true;
        }
        if (pos >= s.size() || s[pos] != '(') return false;
        pos++;
        long long r1, c1, k1, r2, c2, k2;
        if (!expr(r1, c1, k1)) return false;
        if (pos >= s.size() || s[pos] != ' ') return false;
        pos++;
        if (!expr(r2, c2, k2)) return false;
        if (pos >= s.size() || s[pos] != ')') return false;
        pos++;
        if (c1 != r2) return false;
        rows = r1; cols = c2; cost = k1 + k2 + r1 * c1 * c2;
        return true;
    }
};

static long long evalOrder(const string& s, const vector<long long>& d) {
    Parser p{s, d};
    long long r, c, k;
    if (!p.expr(r, c, k) || p.pos != s.size()) return -1;
    for (size_t i = 0; i < p.used.size(); i++) if (p.used[i] != (int)i) return -1;  // các ma trận phải xuất hiện theo thứ tự 0, 1, 2, ...
    if (p.used.size() + 1 != d.size()) return -1;
    return k;
}

int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 800; iter++) {
        int n = 1 + rng() % 9;
        vector<long long> dims(n + 1);
        for (auto& x : dims) x = 1 + rng() % (iter % 4 == 0 ? 100000 : 20);  // có kích thước tới 1e5 (tích ba số 1e15)
        auto costs = allCosts(dims, 0, n - 1);
        long long best = *min_element(costs.begin(), costs.end());
        string order;
        long long got = matrixChain(dims, &order);
        if (got != best || matrixChain(dims) != best) { printf("SAI iter=%d n=%d: %lld != %lld\n", iter, n, got, best); return 1; }
        if (evalOrder(order, dims) != best) { printf("SAI cách đặt ngoặc iter=%d: %s\n", iter, order.c_str()); return 1; }
    }
    // ca biên: không có ma trận, một ma trận
    {
        string o = "x";
        if (matrixChain({}, &o) != 0 || !o.empty()) { puts("SAI rỗng"); return 1; }
        if (matrixChain({5}, &o) != 0 || !o.empty()) { puts("SAI dims một phần tử"); return 1; }
        if (matrixChain({5, 7}, &o) != 0 || o != "A0") { puts("SAI một ma trận"); return 1; }
        if (matrixChain({5, 7, 3}, &o) != 105 || o != "(A0 A1)") { puts("SAI hai ma trận"); return 1; }
    }
    // ví dụ trong thư viện
    {
        string o;
        if (matrixChain({10, 30, 5, 60}, &o) != 4500 || o != "((A0 A1) A2)") { puts("SAI ví dụ"); return 1; }
    }
    // ca lớn n = 300: chi phí trả về phải khớp chi phí của cách đặt ngoặc trả về, và không tệ hơn nhân từ trái sang phải
    {
        int n = 300;
        vector<long long> dims(n + 1);
        for (auto& x : dims) x = 1 + rng() % 100000;
        string order;
        long long got = matrixChain(dims, &order);
        long long leftToRight = 0;
        for (int k = 2; k <= n; k++) leftToRight += dims[0] * dims[k - 1] * dims[k];
        // nhân tuần tự từ trái: (A0..A(k-2)) x A(k-1) tốn dims[0] * dims[k-1] * dims[k]
        if (evalOrder(order, dims) != got || got > leftToRight) { puts("SAI ca lớn"); return 1; }
    }
    puts("OK");
}
