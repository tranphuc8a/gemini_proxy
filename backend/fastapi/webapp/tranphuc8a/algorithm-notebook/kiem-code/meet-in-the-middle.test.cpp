// @TEMPLATE

// Thử countSubsetsWithSum với vét cạn bitmask (n <= 14, có số âm, số 0 và giá trị trùng), và các ca n = 40 có đáp án biết trước:
// toàn 1 (C(40,20) = 137846528820), toàn 0 (2^40 tập con, tích hai nhóm 2^20·2^20), luỹ thừa của 2 (mỗi tổng đúng một cách), giá trị 1e17.
#define CHECK(cond, ...) do { if (!(cond)) { printf("SAI: "); printf(__VA_ARGS__); printf("\n"); return 1; } } while (0)

int main() {
    mt19937_64 rng(20261017);
    for (int iter = 0; iter < 3000; iter++) {
        int n = rng() % 15;
        vector<long long> a(n);
        for (auto& v : a) v = (long long)(rng() % 11) - 5;
        long long S = (long long)(rng() % 21) - 10;
        long long brute = 0;
        for (int m = 0; m < (1 << n); m++) {
            long long s = 0;
            for (int i = 0; i < n; i++)
                if ((m >> i) & 1) s += a[i];
            if (s == S) brute++;
        }
        CHECK(countSubsetsWithSum(a, S) == brute, "iter=%d n=%d S=%lld", iter, n, S);
    }
    // ví dụ trong mục và ca biên
    CHECK(countSubsetsWithSum({1, 2, 3, 4}, 5) == 2, "ví dụ trong mục");
    CHECK(countSubsetsWithSum({}, 0) == 1 && countSubsetsWithSum({}, 5) == 0, "tập rỗng");
    CHECK(countSubsetsWithSum({7}, 7) == 1 && countSubsetsWithSum({7}, 0) == 1 && countSubsetsWithSum({7}, 3) == 0, "một phần tử");
    // n = 40
    {
        vector<long long> ones(40, 1);
        CHECK(countSubsetsWithSum(ones, 20) == 137846528820LL, "C(40,20)");
        vector<long long> zeros(40, 0);
        CHECK(countSubsetsWithSum(zeros, 0) == (1LL << 40) && countSubsetsWithSum(zeros, 1) == 0, "toàn số 0");
        vector<long long> pw(40);
        for (int i = 0; i < 40; i++) pw[i] = 1LL << i;
        for (int iter = 0; iter < 5; iter++) {
            long long S = (long long)(rng() % (1ULL << 40));
            CHECK(countSubsetsWithSum(pw, S) == 1, "luỹ thừa của 2, S=%lld", S);
        }
        CHECK(countSubsetsWithSum(pw, 1LL << 40) == 0 && countSubsetsWithSum(pw, -1) == 0, "tổng ngoài miền");
        vector<long long> big(40, 100000000000000000LL);          // 1e17: tổng tối đa 4e18 vẫn vừa long long
        CHECK(countSubsetsWithSum(big, 2000000000000000000LL) == 137846528820LL, "giá trị 1e17");
    }
    puts("OK");
    return 0;
}
