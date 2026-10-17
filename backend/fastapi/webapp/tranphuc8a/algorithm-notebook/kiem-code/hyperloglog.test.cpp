// @TEMPLATE

// Thử HyperLogLog: (1) p bị kẹp trong [4, 18]; (2) tập rỗng ước lượng 0; (3) ca biên của rho, gồm phần còn lại = 0 (dựng khoá bằng NGHỊCH ĐẢO bộ trộn bit);
// (4) tập nhỏ (linear counting) gần đúng; (5) thêm trùng và đổi thứ tự không đổi thanh ghi; (6) merge = sketch của hợp hai tập (so thanh ghi từng bit),
// giao hoán, luỹ đẳng; (7) độ chính xác THỐNG KÊ: với mỗi (p, n) nhiều lần chạy hạt giống cố định, sai số tương đối từng lần <= 4.5 sigma, độ lệch trung bình
// gần 0 và độ lệch chuẩn đo được cỡ sigma = 1.04 / sqrt(m) (không tốt hơn lý thuyết một cách đáng ngờ, cũng không tệ hơn nhiều); (8) mẫu khoá có quy luật (bội 2^32...).
// Lưu ý đo được: ở QUANH n ~ 2.5 m (chỗ chuyển giữa linear counting và công thức thô) HLL thô thiên cao ~ +2.4% (đã nói ở mô tả: HLL++ có bảng hiệu chỉnh);
// vùng đó cho phép lệch tới 3.2%, nơi khác phải không thiên lệch.
static uint64_t modinv(uint64_t a) { uint64_t x = a; for (int i = 0; i < 6; i++) x *= 2 - a * x; return x; }   // nghịch đảo modulo 2^64 của số lẻ
static uint64_t unxorshift(uint64_t v, int s) { uint64_t x = v; for (int i = 0; i < 64 / s + 1; i++) x = v ^ (x >> s); return x; }
static uint64_t unmix(uint64_t h) {                      // nghịch đảo của HyperLogLog::mix (splitmix64 finalizer là song ánh)
    h = unxorshift(h, 31);
    h *= modinv(0x94d049bb133111ebULL);
    h = unxorshift(h, 27);
    h *= modinv(0xbf58476d1ce4e5b9ULL);
    h = unxorshift(h, 30);
    return h - 0x9e3779b97f4a7c15ULL;
}

static uint64_t makeKey(int pattern, uint64_t base, uint64_t i, mt19937_64& rng) {
    switch (pattern) {
        case 0: return base + i;                         // liên tiếp
        case 1: return rng();                            // ngẫu nhiên 64 bit
        case 2: return (base + i) << 32;                 // bội của 2^32 (bit thấp đều 0)
        case 3: return (base + i) * 1024;                // bội của 1024
        default: return base + i * 0x9E3779B97F4A7C15ULL;   // bước lẻ rất lớn
    }
}

static bool regsOk(const HyperLogLog& h) {
    for (uint8_t r : h.reg) if (r > 64 - h.p + 1) return false;
    return true;
}

int main() {
    mt19937_64 rng(20261017);
    // 1) kẹp p, kích thước
    {
        int want[][2] = {{-5, 4}, {0, 4}, {3, 4}, {4, 4}, {12, 12}, {18, 18}, {19, 18}, {64, 18}};
        for (auto& w : want) {
            HyperLogLog h(w[0]);
            if (h.p != w[1] || h.m != ((size_t)1 << w[1]) || h.reg.size() != h.m) { printf("SAI: HyperLogLog(%d) -> p=%d m=%zu\n", w[0], h.p, h.m); return 1; }
            for (uint8_t r : h.reg) if (r) { puts("SAI: thanh ghi ban đầu phải 0"); return 1; }
        }
        HyperLogLog d;
        if (d.p != 12 || d.m != 4096) { puts("SAI: p mặc định 12"); return 1; }
    }
    // 2) rỗng
    for (int p = 4; p <= 18; p++) {
        HyperLogLog h(p);
        if (fabs(h.estimate()) > 1e-9) { printf("SAI: tập rỗng p=%d ước lượng %.6f\n", p, h.estimate()); return 1; }
    }
    // 3) mix là song ánh (để dựng khoá), rồi ca biên của rho
    for (int i = 0; i < 1000; i++) {
        uint64_t x = rng();
        if (unmix(HyperLogLog::mix(x)) != x || HyperLogLog::mix(unmix(x)) != x) { puts("SAI: nghịch đảo bộ trộn bit trong tệp thử"); return 1; }
    }
    for (int p : {4, 8, 12, 14, 18}) {
        for (size_t j : {(size_t)0, (size_t)1, ((size_t)1 << p) / 2, ((size_t)1 << p) - 1}) {
            uint64_t group = (uint64_t)j << (64 - p);
            struct { uint64_t hash; int rho; const char* name; } cases[] = {
                {group, 64 - p + 1, "phần còn lại = 0 (rho = 64 - p + 1)"},
                {group | (1ULL << (63 - p)), 1, "bit đầu của phần còn lại là 1 (rho = 1)"},
                {group | 1ULL, 64 - p, "chỉ bit cuối bật (rho = 64 - p)"},
            };
            for (auto& c : cases) {
                HyperLogLog h(p);
                h.add(unmix(c.hash));
                for (size_t k = 0; k < h.m; k++)
                    if (h.reg[k] != (k == j ? c.rho : 0)) { printf("SAI rho p=%d nhóm %zu: %s: reg[%zu]=%d, mong %d\n", p, j, c.name, k, (int)h.reg[k], c.rho); return 1; }
                if (fabs(h.estimate() - 1.0) > 0.01 + 1.0 / (double)h.m) { printf("SAI: ước lượng 1 phần tử = %.4f (p=%d)\n", h.estimate(), p); return 1; }   // linear counting cho m*ln(m/(m-1)) ~ 1 + 1/(2m)
            }
        }
    }
    // 4) tập nhỏ: linear counting đủ gần (sai số 4.5 độ lệch chuẩn của linear counting + 1.5)
    for (int p : {10, 12, 14}) {
        double m = (double)((size_t)1 << p);
        for (int rep = 0; rep < 3; rep++) {
            HyperLogLog h(p);
            uint64_t off = rng();
            for (int n = 1; n <= 400; n++) {
                h.add(off + (uint64_t)n * 0x9E3779B97F4A7C15ULL);
                double t = n / m, sd = sqrt(m * (exp(t) - t - 1)), est = h.estimate();
                if (fabs(est - n) > 4.5 * sd + 1.5) { printf("SAI: tập nhỏ p=%d n=%d ước lượng %.2f\n", p, n, est); return 1; }
            }
        }
    }
    // 5) trùng lặp / thứ tự không đổi thanh ghi
    for (int p : {6, 12, 14}) {
        for (int n : {1, 7, 100, 5000, 70000}) {
            uint64_t off = rng();
            vector<uint64_t> keys(n);
            for (int i = 0; i < n; i++) keys[i] = off + (uint64_t)i * 31;
            HyperLogLog once(p);
            for (uint64_t k : keys) once.add(k);
            vector<uint64_t> mult;
            for (uint64_t k : keys) for (int c = 0, times = 1 + rng() % 4; c < times; c++) mult.push_back(k);
            shuffle(mult.begin(), mult.end(), rng);
            HyperLogLog many(p);
            for (uint64_t k : mult) many.add(k);
            if (once.reg != many.reg) { printf("SAI: thêm trùng/đổi thứ tự làm đổi thanh ghi (p=%d n=%d)\n", p, n); return 1; }
            if (once.estimate() != many.estimate()) { puts("SAI: ước lượng khác khi thêm trùng"); return 1; }
        }
    }
    {
        HyperLogLog h(14);
        for (int i = 0; i < 300000; i++) h.add(123456789);
        if (fabs(h.estimate() - 1.0) > 0.01) { puts("SAI: một phần tử thêm nhiều lần phải ước lượng ~1"); return 1; }
    }
    // 6) merge: thanh ghi của (A hợp B) đúng từng bit, giao hoán, luỹ đẳng, kết hợp; ước lượng của hợp gần |A hợp B| (và tốt hơn cộng hai ước lượng khi giao nhau nhiều)
    for (int p : {8, 12, 14}) {
        for (int rep = 0; rep < 12; rep++) {
            int na = 100 + rng() % 30000, nb = 100 + rng() % 30000, common = rng() % (min(na, nb) + 1);
            uint64_t off = rng();
            HyperLogLog A(p), B(p), C(p), U(p);
            for (int i = 0; i < na; i++) { A.add(off + i); U.add(off + i); }
            for (int i = 0; i < nb; i++) { uint64_t k = off + (uint64_t)(na - common) + i; B.add(k); U.add(k); }   // nb phần tử, chung `common` với A
            for (int i = 0; i < 5000; i++) C.add(off + 7777777 + i);
            HyperLogLog AB = A, BA = B;
            AB.merge(B);
            BA.merge(A);
            if (AB.reg != U.reg) { printf("SAI: merge khác sketch của hợp hai tập (p=%d)\n", p); return 1; }
            if (AB.reg != BA.reg) { puts("SAI: merge không giao hoán"); return 1; }
            HyperLogLog twice = AB;
            twice.merge(B);
            twice.merge(A);
            twice.merge(twice);
            if (twice.reg != AB.reg) { puts("SAI: merge không luỹ đẳng"); return 1; }
            HyperLogLog l = AB, r = A;
            l.merge(C);
            HyperLogLog bc = B;
            bc.merge(C);
            r.merge(bc);
            if (l.reg != r.reg) { puts("SAI: merge không kết hợp"); return 1; }
            double uni = (double)na + nb - common, sigma = 1.04 / sqrt((double)((size_t)1 << p));
            if (fabs(AB.estimate() - uni) / uni > 4.5 * sigma + 0.005) { printf("SAI: ước lượng của hợp %.1f, thật %.0f (p=%d)\n", AB.estimate(), uni, p); return 1; }
            if (common > uni * 0.3 && fabs(A.estimate() + B.estimate() - uni) < fabs(AB.estimate() - uni)) { puts("SAI: cộng hai ước lượng không được tốt hơn merge khi giao nhau nhiều"); return 1; }
        }
    }
    // 7) độ chính xác thống kê theo (p, n); T lần chạy hạt giống cố định
    long long cells = 0, adds = 0;
    for (int p : {4, 6, 8, 10, 12, 14, 16, 18}) {
        double m = (double)((size_t)1 << p), sigma = 1.04 / sqrt(m);
        for (double f : {0.02, 0.3, 1.0, 2.0, 2.5, 3.0, 6.0, 25.0}) {
            long long n = max(1LL, (long long)(f * m));
            if (n > 1200000) continue;
            int T = (int)max(6LL, min(40LL, 1500000LL / n));
            bool transition = f >= 2.2 && f <= 3.6;
            double sum = 0, sq = 0;
            for (int t = 0; t < T; t++) {
                HyperLogLog h(p);
                uint64_t base = rng();
                int pattern = t % 5;
                for (long long i = 0; i < n; i++) h.add(makeKey(pattern, base, (uint64_t)i, rng));
                adds += n;
                if (!regsOk(h)) { puts("SAI: thanh ghi vượt 64 - p + 1"); return 1; }
                double e = (h.estimate() - (double)n) / (double)n;
                sum += e;
                sq += e * e;
                double lim = (p == 4 ? 6.0 : 4.5) * sigma + (transition ? 0.032 : 0.0);
                if (fabs(e) > lim) { printf("SAI: p=%d n=%lld lần %d (mẫu khoá %d): sai số tương đối %.4f > %.4f\n", p, n, t, pattern, e, lim); return 1; }
            }
            double mean = sum / T, rms = sqrt(sq / T);
            double meanLim = (3.5 / sqrt((double)T) + 0.1) * sigma + (p == 4 ? 0.2 * sigma : 0.0) + (transition ? 0.032 : 0.0);
            if (fabs(mean) > meanLim) { printf("SAI: p=%d n=%lld thiên lệch trung bình %+.4f (%.2f sigma) vượt %.4f\n", p, n, mean, mean / sigma, meanLim); return 1; }
            // (tập nhỏ dưới linear counting chính xác hơn sigma nhiều nên chỉ kiểm độ lệch chuẩn khi f >= 1)
            if (T >= 30 && f >= 1.0 && !transition && (rms < 0.45 * sigma || rms > 1.6 * sigma)) { printf("SAI: p=%d n=%lld độ lệch chuẩn đo %.4f = %.2f sigma (mong ~1)\n", p, n, rms, rms / sigma); return 1; }
            cells++;
        }
    }
    // 8) cỡ lớn như ví dụ trong mô tả: p = 14, 1 triệu phần tử phân biệt (mỗi phần tử thêm 2 lần)
    {
        HyperLogLog h(14);
        const uint64_t N = 1000000;
        for (uint64_t i = 0; i < N; i++) { h.add(i); h.add(N - 1 - i); }
        double e = (h.estimate() - (double)N) / (double)N;
        if (fabs(e) > 4.5 * 1.04 / 128.0) { printf("SAI: 1 triệu phần tử p=14, sai số %.4f\n", e); return 1; }
    }
    printf("%lld ô (p, n) kiểm thống kê, %lld lần add\n", cells, adds);
    puts("OK");
}
