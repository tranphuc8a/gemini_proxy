// @TEMPLATE

// Thử các hàm bit với vòng lặp từng bit trên các giá trị đặc biệt và ngẫu nhiên 64-bit, mã Gray (song ánh + đổi 1 bit),
// xorSwap (kể cả cùng một biến), forEachSubmask và forEachKSubset (đúng thứ tự, đủ phần tử, biên n = 31).
#define CHECK(cond, ...) do { if (!(cond)) { printf("SAI: "); printf(__VA_ARGS__); printf("\n"); return 1; } } while (0)

int main() {
    mt19937_64 rng(20261017);
    vector<ull> xs = {0, 1, 2, 3, 12, 255, 256, 1ULL << 31, 1ULL << 32, 1ULL << 62, 1ULL << 63, ~0ULL, (1ULL << 63) | 1, 0x8000000100000000ULL};
    for (int i = 0; i < 20000; i++) xs.push_back(rng() >> (rng() % 64));
    for (ull x : xs) {
        int pc = 0, low = -1, high = -1;
        for (int i = 0; i < 64; i++)
            if ((x >> i) & 1) { pc++; if (low < 0) low = i; high = i; }
        CHECK(popCount(x) == pc, "popCount(%llu)", x);
        CHECK(lowbit(x) == (x == 0 ? 0ULL : (1ULL << low)), "lowbit(%llu)", x);
        CHECK(clearLowbit(x) == x - lowbit(x), "clearLowbit(%llu)", x);
        CHECK(isPow2(x) == (pc == 1), "isPow2(%llu)", x);
        if (x != 0) {
            CHECK(lowIndex(x) == low, "lowIndex(%llu)", x);
            CHECK(highIndex(x) == high, "highIndex(%llu)", x);
        }
        for (int i = 0; i < 64; i++) {
            bool bit = (x >> i) % 2 == 1;
            CHECK(bitTest(x, i) == bit, "bitTest(%llu, %d)", x, i);
            CHECK(bitSet(x, i) == (bit ? x : x + (1ULL << i)), "bitSet(%llu, %d)", x, i);
            CHECK(bitClear(x, i) == (bit ? x - (1ULL << i) : x), "bitClear(%llu, %d)", x, i);
            CHECK(bitToggle(x, i) == (bit ? x - (1ULL << i) : x + (1ULL << i)), "bitToggle(%llu, %d)", x, i);
        }
    }
    // ví dụ trong mục
    CHECK(lowbit(12) == 4 && popCount(12) == 2 && highIndex(12) == 3, "ví dụ x = 12");
    // mã Gray
    for (int bits = 1; bits <= 12; bits++) {
        set<ull> seen;
        for (ull i = 0; i < (1ULL << bits); i++) {
            ull g = grayCode(i);
            CHECK(g < (1ULL << bits), "Gray ngoài miền");
            seen.insert(g);
            if (i > 0) CHECK(popCount(g ^ grayCode(i - 1)) == 1, "Gray liên tiếp khác 1 bit, bits=%d i=%llu", bits, i);
        }
        CHECK(seen.size() == (1ULL << bits), "Gray phải là song ánh, bits=%d", bits);
    }
    // xorSwap
    {
        int a = 3, b = 7;
        xorSwap(a, b);
        CHECK(a == 7 && b == 3, "xorSwap hai biến");
        int c = 5;
        xorSwap(c, c);
        CHECK(c == 5, "xorSwap cùng một biến phải giữ nguyên");
        int x = -4, y = 0;
        xorSwap(x, y);
        CHECK(x == 0 && y == -4, "xorSwap số âm");
    }
    // forEachSubmask: đủ, đúng thứ tự giảm dần
    for (int iter = 0; iter < 3000; iter++) {
        unsigned mask = rng() % 2048;
        vector<unsigned> got, expect;
        forEachSubmask(mask, [&](unsigned s) { got.push_back(s); });
        for (unsigned s = mask; s >= 1; s--)
            if ((s & mask) == s) expect.push_back(s);
        CHECK(got == expect, "forEachSubmask mask=%u", mask);
    }
    // forEachKSubset: mọi mask n bit có đúng k bit 1, theo thứ tự tăng dần
    for (int n = 0; n <= 12; n++)
        for (int k = 0; k <= n + 2; k++) {                 // gồm k > n: không có mask nào
            vector<unsigned> got, expect;
            forEachKSubset(n, k, [&](unsigned c) { got.push_back(c); });
            for (unsigned m = 0; m < (1u << n); m++)
                if (__builtin_popcount(m) == k) expect.push_back(m);
            CHECK(got == expect, "forEachKSubset n=%d k=%d (%d != %d phần tử)", n, k, (int)got.size(), (int)expect.size());
        }
    {   // n = 20, k = 10: C(20,10) = 184756
        long long cnt = 0;
        unsigned prev = 0;
        bool inc = true;
        forEachKSubset(20, 10, [&](unsigned c) { if (cnt > 0 && c <= prev) inc = false; prev = c; cnt++; });
        CHECK(cnt == 184756 && inc, "C(20,10): %lld", cnt);
    }
    {   // biên n = 31: không tràn khi tính limit hay mask kế tiếp
        long long c31 = 0, c30 = 0, c1 = 0;
        forEachKSubset(31, 31, [&](unsigned) { c31++; });
        forEachKSubset(31, 30, [&](unsigned c) { c30++; if (__builtin_popcount(c) != 30) c30 += 1000000; });
        forEachKSubset(31, 1, [&](unsigned c) { c1++; if (__builtin_popcount(c) != 1) c1 += 1000000; });
        CHECK(c31 == 1 && c30 == 31 && c1 == 31, "n = 31: %lld %lld %lld", c31, c30, c1);
    }
    puts("OK");
    return 0;
}
