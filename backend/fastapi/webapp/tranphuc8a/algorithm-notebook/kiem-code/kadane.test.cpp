// @TEMPLATE

// Thử kadane với vét cạn O(n^2) (có toàn số âm, số 0), kiểm đoạn [l, r] trả về có tổng đúng; ca lớn 10^6 phần tử so với phương pháp tổng tiền tố.
int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 8000; iter++) {
        int n = 1 + rng() % 14;
        int lowest = iter % 3 == 0 ? -20 : (iter % 3 == 1 ? -3 : -30);
        int highest = iter % 3 == 0 ? -1 : 12;  // một phần ba số lần: toàn số âm
        vector<long long> a(n);
        for (auto& x : a) x = lowest + (long long)(rng() % (highest - lowest + 1));
        long long best = LLONG_MIN;
        for (int l = 0; l < n; l++) {
            long long s = 0;
            for (int r = l; r < n; r++) { s += a[r]; best = max(best, s); }
        }
        auto res = kadane(a);
        long long check = 0;
        bool ok = res.l >= 0 && res.l <= res.r && res.r < n;
        if (ok) for (int i = res.l; i <= res.r; i++) check += a[i];
        if (res.sum != best || !ok || check != best) { printf("SAI iter=%d: sum=%lld l=%d r=%d, vét cạn=%lld\n", iter, res.sum, res.l, res.r, best); return 1; }
    }
    // ca biên
    {
        auto e = kadane({});
        if (e.sum != 0 || e.l != -1 || e.r != -1) { puts("SAI rỗng"); return 1; }
        auto one = kadane({-7});
        if (one.sum != -7 || one.l != 0 || one.r != 0) { puts("SAI một phần tử âm"); return 1; }
        auto allNeg = kadane({-5, -2, -9});
        if (allNeg.sum != -2 || allNeg.l != 1 || allNeg.r != 1) { puts("SAI toàn âm"); return 1; }
        auto zeros = kadane({0, 0, 0});
        if (zeros.sum != 0) { puts("SAI toàn 0"); return 1; }
    }
    // ví dụ trong thư viện
    {
        auto r = kadane({-2, 1, -3, 4, -1, 2, 1, -5, 4});
        if (r.sum != 6 || r.l != 3 || r.r != 6) { puts("SAI ví dụ"); return 1; }
    }
    // ca lớn: 10^6 phần tử |a| <= 1e9 (tổng tới 1e15 vượt int32), so với tổng tiền tố trừ tiền tố nhỏ nhất đứng trước
    {
        int n = 1000000;
        vector<long long> a(n);
        for (auto& x : a) x = (long long)(rng() % 2000000001ULL) - 1000000000LL + 100;  // hơi lệch dương để đoạn dài có lợi
        long long pre = 0, minPre = 0, best = LLONG_MIN;
        for (int i = 0; i < n; i++) {
            pre += a[i];
            // đoạn không rỗng kết thúc tại i: pre - (tiền tố nhỏ nhất trong số P[0..i-1])
            best = max(best, pre - minPre);
            minPre = min(minPre, pre);
        }
        auto res = kadane(a);
        long long check = 0;
        for (int i = res.l; i <= res.r; i++) check += a[i];
        if (res.sum != best || check != best) { printf("SAI ca lớn %lld != %lld\n", res.sum, best); return 1; }
    }
    puts("OK");
}
