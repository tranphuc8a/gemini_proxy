// @TEMPLATE

// Thử Token bucket / Leaky bucket (thời gian giả, số học nguyên => xác định):
// (1) so với mô hình đơn giản chạy từng mili-giây (độc lập với công thức nạp lười), trên chuỗi yêu cầu ngẫu nhiên (khoảng cách 0..40 ms, cost 1..3);
// (2) bất biến của token bucket: trong mọi đoạn các yêu cầu được nhận, tổng token <= sức chứa + tốc độ * thời gian;
// (3) Leaky bucket (meter) cho đúng quyết định như Token bucket; (4) ví dụ trong mô tả; (5) khoảng nghỉ khổng lồ không tràn số, thời gian đi lùi, cost lớn hơn sức chứa.
struct RefBucket {   // mô hình ngây thơ: nạp từng mili-giây
    long long capU, rate, per, bal, t;
    RefBucket(long long capacity, long long refill, long long perMs, long long now)
        : capU(capacity * perMs), rate(refill), per(perMs), bal(capacity * perMs), t(now) {}
    bool allow(long long now, long long cost) {
        while (t < now) { bal = min(capU, bal + rate); t++; }
        if (bal >= cost * per) { bal -= cost * per; return true; }
        return false;
    }
};

int main() {
    mt19937 rng(20261017);
    for (int iter = 0; iter < 400; iter++) {
        long long capacity = 1 + rng() % 8, refill = 1 + rng() % 5, per = 1 + rng() % 40, start = rng() % 100;
        TokenBucket tb(capacity, refill, per, start);
        LeakyBucket lb(capacity, refill, per, start);
        RefBucket ref(capacity, refill, per, start);
        long long now = start;
        vector<pair<long long, long long>> allowed;   // (thời điểm, cost) các yêu cầu được nhận
        for (int op = 0; op < 80; op++) {
            now += rng() % 41;
            long long cost = 1 + rng() % 3;
            bool a = tb.allow(now, cost), b = ref.allow(now, cost), c = lb.allow(now, cost);
            if (a != b) { printf("SAI token bucket khác mô hình iter=%d op=%d\n", iter, op); return 1; }
            if (a != c) { printf("SAI leaky bucket khác token bucket iter=%d op=%d\n", iter, op); return 1; }
            if (tb.bal < 0 || tb.bal > tb.capU) { puts("SAI: số dư ngoài [0, sức chứa]"); return 1; }
            if (a) allowed.push_back({now, cost});
        }
        // bất biến cửa sổ: tổng cost từ yêu cầu i tới j (được nhận) * per <= capU + rate * (t_j - t_i)
        for (size_t i = 0; i < allowed.size(); i++) {
            long long sum = 0;
            for (size_t j = i; j < allowed.size(); j++) {
                sum += allowed[j].second;
                if (sum * per > capacity * per + refill * (allowed[j].first - allowed[i].first)) { puts("SAI: vi phạm giới hạn trong một cửa sổ"); return 1; }
            }
        }
    }
    // ví dụ trong mô tả: sức chứa 3, nạp 1 token / 1000 ms, yêu cầu tại 0 0 0 0 500 1000 1000
    {
        TokenBucket tb(3, 1, 1000, 0);
        vector<bool> out;
        for (long long t : {0, 0, 0, 0, 500, 1000, 1000}) out.push_back(tb.allow(t));
        if (out != vector<bool>{true, true, true, false, false, true, false}) { puts("SAI: ví dụ mô tả"); return 1; }
    }
    // khoảng nghỉ khổng lồ: không tràn số, đầy lại đúng sức chứa
    {
        TokenBucket tb(5, 1000, 1, 0);
        for (int i = 0; i < 5; i++) tb.allow(0);
        long long huge = 4000000000000000000LL;
        for (int i = 0; i < 5; i++) if (!tb.allow(huge)) { puts("SAI: không đầy lại sau khoảng nghỉ lớn"); return 1; }
        if (tb.allow(huge)) { puts("SAI: vượt sức chứa sau khoảng nghỉ lớn"); return 1; }
        LeakyBucket lb(5, 1000, 1, 0);
        for (int i = 0; i < 5; i++) lb.allow(0);
        for (int i = 0; i < 5; i++) if (!lb.allow(huge)) { puts("SAI: leaky không rò hết sau khoảng nghỉ lớn"); return 1; }
    }
    // thời gian đi lùi: bỏ qua nạp, không làm hỏng số dư
    {
        TokenBucket tb(2, 1, 1000, 1000);
        bool a = tb.allow(1000), b = tb.allow(500), c = tb.allow(500);
        if (!a || !b || c) { puts("SAI: thời gian đi lùi"); return 1; }
        if (!tb.allow(2000)) { puts("SAI: nạp lại sau khi thời gian đi lùi"); return 1; }
    }
    // cost lớn hơn sức chứa không bao giờ được nhận; cost = 0 luôn được nhận; tốc độ nạp 0 không bao giờ đầy lại
    {
        TokenBucket tb(3, 1, 10, 0);
        if (tb.allow(100000, 4)) { puts("SAI: cost > sức chứa"); return 1; }
        if (!tb.allow(0, 0)) { puts("SAI: cost = 0"); return 1; }
        TokenBucket z(2, 0, 10, 0);
        z.allow(0); z.allow(0);
        if (z.allow(1000000)) { puts("SAI: tốc độ nạp 0"); return 1; }
    }
    puts("OK");
}
