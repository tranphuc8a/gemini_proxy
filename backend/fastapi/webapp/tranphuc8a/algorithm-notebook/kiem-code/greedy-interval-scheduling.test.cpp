// @TEMPLATE

// Thử maxNonOverlapping với vét cạn trên mọi tập con (n <= 10, toạ độ nhỏ nên nhiều đoạn trùng/chạm đầu mút),
// kiểm tra tập được chọn thật sự đôi một không giao; thử minRooms với số đoạn phủ nhiều nhất tại các điểm nguyên; ca lớn.
#define CHECK(cond, ...) do { if (!(cond)) { printf("SAI: "); printf(__VA_ARGS__); printf("\n"); return 1; } } while (0)

typedef vector<pair<long long, long long>> Iv;

static bool overlap(const pair<long long, long long>& a, const pair<long long, long long>& b) {
    return a.first < b.second && b.first < a.second;           // nửa mở: chạm đầu mút không tính là giao
}

int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 3000; iter++) {
        int n = rng() % 11;
        Iv iv(n);
        for (auto& p : iv) { long long l = rng() % 12, len = 1 + rng() % 5; p = {l, l + len}; }
        // vét cạn mọi tập con
        int best = 0;
        for (int m = 0; m < (1 << n); m++) {
            bool ok = true;
            for (int i = 0; i < n && ok; i++)
                if ((m >> i) & 1)
                    for (int j = i + 1; j < n; j++)
                        if (((m >> j) & 1) && overlap(iv[i], iv[j])) { ok = false; break; }
            if (ok) best = max(best, __builtin_popcount(m));
        }
        vector<int> chosen;
        int g = maxNonOverlapping(iv, &chosen);
        CHECK(g == best && (int)chosen.size() == g, "maxNonOverlapping iter=%d: %d != %d", iter, g, best);
        CHECK(maxNonOverlapping(iv) == best, "không truyền chosen, iter=%d", iter);
        for (size_t i = 0; i < chosen.size(); i++)
            for (size_t j = i + 1; j < chosen.size(); j++)
                CHECK(!overlap(iv[chosen[i]], iv[chosen[j]]), "tập chọn có hai đoạn giao nhau iter=%d", iter);
        // số phòng tối thiểu = số đoạn phủ nhiều nhất tại một điểm nguyên t (l <= t < r)
        int rooms = 0;
        for (long long t = 0; t <= 20; t++) {
            int c = 0;
            for (auto& p : iv) if (p.first <= t && t < p.second) c++;
            rooms = max(rooms, c);
        }
        CHECK(minRooms(iv) == rooms, "minRooms iter=%d: %d != %d", iter, minRooms(iv), rooms);
    }
    // ví dụ trong mục (CLRS)
    {
        Iv iv = {{1, 4}, {3, 5}, {0, 6}, {5, 7}, {3, 9}, {5, 9}, {6, 10}, {8, 11}, {8, 12}, {2, 14}, {12, 16}};
        vector<int> chosen;
        CHECK(maxNonOverlapping(iv, &chosen) == 4, "ví dụ trong mục");
        CHECK(chosen == vector<int>({0, 3, 7, 10}), "các đoạn được chọn trong ví dụ");
        // phản ví dụ cho tham lam theo thời điểm bắt đầu: [0,10) [1,2) [3,4) -> 2, và 1 phòng đủ cho đoạn chạm nhau
        CHECK(maxNonOverlapping({{0, 10}, {1, 2}, {3, 4}}) == 2, "phản ví dụ sắp theo l");
        CHECK(minRooms({{0, 5}, {5, 10}}) == 1 && minRooms({}) == 0 && maxNonOverlapping({}) == 0, "chạm đầu mút / rỗng");
    }
    // ca lớn
    {
        int n = 200000;
        Iv iv(n), same(n, {5, 9}), big(n);
        for (int i = 0; i < n; i++) { iv[i] = {2LL * i, 2LL * i + 2}; big[i] = {1000000000000000000LL + i, 2000000000000000000LL + i}; }
        CHECK(maxNonOverlapping(iv) == n && minRooms(iv) == 1, "đoạn nối tiếp nhau");
        CHECK(maxNonOverlapping(same) == 1 && minRooms(same) == n, "toàn đoạn giống nhau");
        CHECK(maxNonOverlapping(big) == 1 && minRooms(big) == n, "toạ độ lớn");
        shuffle(iv.begin(), iv.end(), rng);
        CHECK(maxNonOverlapping(iv) == n, "xáo trộn thứ tự đầu vào");
    }
    puts("OK");
    return 0;
}
