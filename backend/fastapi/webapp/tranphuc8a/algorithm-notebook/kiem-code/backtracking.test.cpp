// @TEMPLATE

// Thử NQueens (đếm, bitmask) với dãy đáp án đã biết của bài n quân hậu (n = 0..14) và với vét cạn hoán vị (n <= 8);
// thử QueensFirst (tìm một nghiệm): nghiệm trả về phải hợp lệ, vô nghiệm với n = 2, 3; dùng lại cùng một đối tượng nhiều lần.
#define CHECK(cond, ...) do { if (!(cond)) { printf("SAI: "); printf(__VA_ARGS__); printf("\n"); return 1; } } while (0)

int main() {
    const long long known[] = {1, 1, 0, 0, 2, 10, 4, 40, 92, 352, 724, 2680, 14200, 73712, 365596};   // n = 0..14
    NQueens q;
    for (int n = 0; n <= 14; n++) {
        long long c = q.solve(n);
        CHECK(c == known[n], "NQueens n=%d: %lld != %lld", n, c, known[n]);
    }
    // vét cạn bằng hoán vị cột: perm[r] = cột của quân hậu hàng r (đã khác cột), chỉ cần kiểm tra đường chéo
    for (int n = 1; n <= 8; n++) {
        vector<int> perm(n);
        iota(perm.begin(), perm.end(), 0);
        long long brute = 0;
        do {
            bool ok = true;
            for (int i = 0; i < n && ok; i++)
                for (int j = i + 1; j < n; j++)
                    if (abs(perm[i] - perm[j]) == j - i) { ok = false; break; }
            if (ok) brute++;
        } while (next_permutation(perm.begin(), perm.end()));
        CHECK(q.solve(n) == brute, "NQueens so với hoán vị n=%d", n);
    }
    // QueensFirst: nghiệm hợp lệ
    QueensFirst f;
    for (int n = 1; n <= 16; n++) {
        vector<int> col = f.solve(n);
        if (n == 2 || n == 3) { CHECK(col.empty(), "n=%d vô nghiệm", n); continue; }
        CHECK((int)col.size() == n, "n=%d: kích thước nghiệm %d", n, (int)col.size());
        for (int i = 0; i < n; i++) {
            CHECK(col[i] >= 0 && col[i] < n, "n=%d: cột ngoài bàn cờ", n);
            for (int j = i + 1; j < n; j++)
                CHECK(col[i] != col[j] && abs(col[i] - col[j]) != j - i, "n=%d: hai quân hậu ăn nhau (%d, %d)", n, i, j);
        }
    }
    CHECK(f.solve(4) == vector<int>({1, 3, 0, 2}), "ví dụ trong mục n = 4");
    puts("OK");
    return 0;
}
