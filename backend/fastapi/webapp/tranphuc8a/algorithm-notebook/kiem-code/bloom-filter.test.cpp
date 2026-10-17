// @TEMPLATE

// Thử Bloom filter: công thức chọn m, k (so với tính độc lập và con số n = 1000, p = 1% -> m = 9586, k = 7 trong mô tả);
// KHÔNG có âm tính giả; tỉ lệ dương tính giả đo được gần lý thuyết (và gần p đặt ra); lọc rỗng không chứa gì; quá tải thì tỉ lệ tăng đúng như công thức.
int main() {
    // 1) chọn tham số
    {
        size_t m;
        int k;
        BloomFilter::sizing(1000, 0.01, m, k);
        if (m != 9586 || k != 7) { printf("SAI: sizing(1000, 1%%) = %zu, %d\n", m, k); return 1; }
        for (double p : {0.1, 0.01, 0.001, 0.0001}) {
            for (size_t n : {1, 10, 1000, 123456}) {
                BloomFilter::sizing(n, p, m, k);
                double mm = ceil(-(double)n * log(p) / (log(2.0) * log(2.0)));
                if (m != (size_t)mm) { puts("SAI: m"); return 1; }
                int kk = max(1, (int)lround((double)m / n * log(2.0)));
                if (k != kk) { puts("SAI: k"); return 1; }
            }
        }
    }
    // 2) lọc rỗng
    {
        BloomFilter f(100, 0.01);
        for (uint64_t x = 0; x < 1000; x++) if (f.maybeContains(x)) { puts("SAI: lọc rỗng báo có"); return 1; }
    }
    // 3) không âm tính giả + tỉ lệ dương tính giả đo được so với lý thuyết
    for (double p : {0.1, 0.01, 0.001}) {
        const size_t N = 20000, Q = 400000;
        BloomFilter f(N, p);
        for (uint64_t x = 0; x < N; x++) f.add(x);
        for (uint64_t x = 0; x < N; x++) if (!f.maybeContains(x)) { puts("SAI: âm tính giả"); return 1; }
        size_t fp = 0;
        for (uint64_t x = 0; x < Q; x++) if (f.maybeContains(N + 1000000 + x)) fp++;
        double meas = (double)fp / Q, theory = f.fpRate(N);
        if (meas > theory * 1.35 + 5.0 / Q || meas < theory * 0.65 - 5.0 / Q) { printf("SAI: p=%.4f đo %.5f, lý thuyết %.5f\n", p, meas, theory); return 1; }
        if (theory > p * 1.05 || theory < p * 0.8) { printf("SAI: lý thuyết %.5f lệch xa p = %.4f\n", theory, p); return 1; }
        // gần một nửa số bit được bật khi tham số tối ưu
        size_t ones = 0;
        for (uint64_t w : f.bits) ones += __builtin_popcountll(w);
        double fill = (double)ones / f.m;
        if (fill < 0.4 || fill > 0.6) { printf("SAI: tỉ lệ bit bật %.3f (mong ~ 0.5)\n", fill); return 1; }
    }
    // 4) quá tải: thêm 3 lần số phần tử dự kiến -> tỉ lệ dương tính giả đo được gần công thức (và cao hơn hẳn p)
    {
        const size_t N = 10000, Q = 200000;
        BloomFilter f(N, 0.01);
        for (uint64_t x = 0; x < 3 * N; x++) f.add(x);
        size_t fp = 0;
        for (uint64_t x = 0; x < Q; x++) if (f.maybeContains(3 * N + 5000000 + x)) fp++;
        double meas = (double)fp / Q, theory = f.fpRate(3 * N);
        if (theory < 0.2 || fabs(meas - theory) > 0.25 * theory) { printf("SAI: quá tải đo %.4f lý thuyết %.4f\n", meas, theory); return 1; }
    }
    // 5) n = 1: vẫn dùng được
    {
        BloomFilter f(1, 0.01);
        f.add(42);
        if (!f.maybeContains(42)) { puts("SAI: n = 1"); return 1; }
    }
    puts("OK");
}
