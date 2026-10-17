// @TEMPLATE

// Thử Vector Clock với mô hình happened-before dựng TỪ ĐẦU: chuỗi sự kiện ngẫu nhiên (cục bộ / gửi / nhận, thông điệp có thể nhận trễ, lộn xộn, trùng lặp,
// gửi cho chính mình), tiến trình 1..12. Quan hệ a -> b là bao đóng bắc cầu của (sự kiện trước trong cùng tiến trình) và (gửi -> nhận), tính bằng bitset.
// So sánh vector clock của MỌI cặp sự kiện phải cho đúng BEFORE / AFTER / CONCURRENT / EQUAL; kiểm thêm V[i] đúng bằng số sự kiện của tiến trình i
// nằm trong quá khứ nhân quả (gồm chính nó), tính phản đối xứng và bắc cầu, và ví dụ trong mô tả.
typedef VectorClock VC;
static const int MAXE = 260;

struct Sim {
    int n;
    vector<int> proc;                 // proc[e] = tiến trình của sự kiện e
    vector<VC> vc;                    // vector sau sự kiện e
    vector<bitset<MAXE>> past;        // past[e] = tập sự kiện xảy ra TRƯỚC e (không gồm e)
};

static Sim simulate(mt19937& rng, int n, int events) {
    Sim s;
    s.n = n;
    vector<VC> cur(n, VC(n));
    vector<int> last(n, -1);
    struct Msg { int sendEv; VC clock; };
    vector<Msg> msgs;
    for (int e = 0; e < events; e++) {
        int p = rng() % n;
        int kind = rng() % 10;
        vector<int> preds;
        if (last[p] >= 0) preds.push_back(last[p]);
        if (kind < 4 || msgs.empty()) {
            cur[p].tick(p);                                       // sự kiện cục bộ
        } else if (kind < 7) {
            cur[p].tick(p);                                       // gửi: tăng rồi đính kèm bản sao
            msgs.push_back({e, cur[p]});
        } else {
            size_t m = rng() % msgs.size();                       // nhận một thông điệp bất kỳ (kể cả cũ, đã nhận rồi, từ chính mình)
            cur[p].receive(p, msgs[m].clock);
            preds.push_back(msgs[m].sendEv);
        }
        s.proc.push_back(p);
        s.vc.push_back(cur[p]);
        bitset<MAXE> past;
        for (int q : preds) { past |= s.past[q]; past.set(q); }
        s.past.push_back(past);
        last[p] = e;
    }
    return s;
}

static const char* nm(VC::Order o) { return o == VC::BEFORE ? "BEFORE" : o == VC::AFTER ? "AFTER" : o == VC::EQUAL ? "EQUAL" : "CONCURRENT"; }

int main() {
    mt19937 rng(20261017);
    // 1) ví dụ trong mô tả: 3 tiến trình, e1..e5
    {
        VC p0(3), p1(3), p2(3);
        p0.tick(0);
        VC e1 = p0;
        p0.tick(0);
        VC e2 = p0, m = p0;                                       // gửi m mang [2,0,0]
        p1.tick(1);
        VC e3 = p1;
        p1.receive(1, m);
        VC e4 = p1;
        p2.tick(2);
        VC e5 = p2;
        if (e1.v != vector<int>{1, 0, 0} || e2.v != vector<int>{2, 0, 0} || e3.v != vector<int>{0, 1, 0} || e4.v != vector<int>{2, 2, 0} || e5.v != vector<int>{0, 0, 1}) { puts("SAI: vector của ví dụ trong mô tả"); return 1; }
        if (VC::compare(e2, e4) != VC::BEFORE || VC::compare(e4, e2) != VC::AFTER) { puts("SAI: e2 phải trước e4"); return 1; }
        if (VC::compare(e3, e2) != VC::CONCURRENT || VC::compare(e2, e3) != VC::CONCURRENT) { puts("SAI: e3 và e2 phải đồng thời"); return 1; }
        if (VC::compare(e5, e4) != VC::CONCURRENT) { puts("SAI: e5 và e4 phải đồng thời"); return 1; }
        if (VC::compare(e3, e4) != VC::BEFORE || VC::compare(e1, e2) != VC::BEFORE || VC::compare(e1, e4) != VC::BEFORE) { puts("SAI: e3 -> e4, e1 -> e2 -> e4"); return 1; }
        if (VC::compare(e4, e4) != VC::EQUAL) { puts("SAI: một sự kiện bằng chính nó"); return 1; }
    }
    // 2) ca biên: không tiến trình, một tiến trình
    {
        if (VC::compare(VC(0), VC(0)) != VC::EQUAL) { puts("SAI: vector rỗng"); return 1; }
        VC a(1);
        VC z = a;
        a.tick(0);
        VC b = a;
        a.receive(0, b);                                          // nhận thông điệp của chính mình vẫn tăng
        if (VC::compare(z, b) != VC::BEFORE || VC::compare(b, a) != VC::BEFORE || a.v[0] != 2) { puts("SAI: một tiến trình"); return 1; }
    }
    // 3) so sánh vector bất kỳ (không chỉ vector sinh ra từ mô phỏng) với định nghĩa viết lại bằng đếm
    for (int iter = 0; iter < 20000; iter++) {
        int n = 1 + rng() % 5;
        VC a(n), b(n);
        for (int k = 0; k < n; k++) { a.v[k] = rng() % 3; b.v[k] = rng() % 3; }
        int less = 0, greater = 0;
        for (int k = 0; k < n; k++) { less += a.v[k] < b.v[k]; greater += a.v[k] > b.v[k]; }
        VC::Order want = (less == 0 && greater == 0) ? VC::EQUAL : (greater == 0) ? VC::BEFORE : (less == 0) ? VC::AFTER : VC::CONCURRENT;
        if (VC::compare(a, b) != want) { printf("SAI: so sánh vector ngẫu nhiên (mong %s, mẫu %s)\n", nm(want), nm(VC::compare(a, b))); return 1; }
    }
    // 4) mô phỏng chuỗi sự kiện ngẫu nhiên vs happened-before dựng bằng bao đóng bắc cầu
    long long pairs = 0, concurrent = 0, before = 0;
    for (int iter = 0; iter < 600; iter++) {
        int n = (iter < 100) ? 1 + iter % 12 : 1 + rng() % 12;
        int events = 2 + rng() % (MAXE - 1);
        Sim s = simulate(rng, n, events);
        int E = (int)s.vc.size();
        for (int a = 0; a < E; a++) {
            // V[i] = số sự kiện của tiến trình i nằm trong quá khứ nhân quả của a (gồm chính a)
            vector<int> cnt(n, 0);
            for (int x = 0; x < E; x++) if (s.past[a][x]) cnt[s.proc[x]]++;
            cnt[s.proc[a]]++;
            if (cnt != s.vc[a].v) { printf("SAI: V[i] của sự kiện %d không bằng số sự kiện nhân quả (iter %d)\n", a, iter); return 1; }
            for (int b = 0; b < E; b++) {
                VC::Order want = (a == b) ? VC::EQUAL : s.past[b][a] ? VC::BEFORE : s.past[a][b] ? VC::AFTER : VC::CONCURRENT;
                VC::Order got = VC::compare(s.vc[a], s.vc[b]);
                if (got != want) { printf("SAI: iter %d n=%d sự kiện %d vs %d: mẫu %s, mô hình %s\n", iter, n, a, b, nm(got), nm(want)); return 1; }
                VC::Order rev = VC::compare(s.vc[b], s.vc[a]);       // phản đối xứng
                bool okRev = (got == VC::BEFORE && rev == VC::AFTER) || (got == VC::AFTER && rev == VC::BEFORE) || (got == rev && (got == VC::EQUAL || got == VC::CONCURRENT));
                if (!okRev) { puts("SAI: compare không đối xứng/phản đối xứng"); return 1; }
                pairs++;
                concurrent += (want == VC::CONCURRENT);
                before += (want == VC::BEFORE);
            }
        }
        // bắc cầu: a -> b và b -> c thì a -> c (lấy mẫu)
        for (int t = 0; t < 2000 && E >= 3; t++) {
            int a = rng() % E, b = rng() % E, c = rng() % E;
            if (VC::compare(s.vc[a], s.vc[b]) == VC::BEFORE && VC::compare(s.vc[b], s.vc[c]) == VC::BEFORE && VC::compare(s.vc[a], s.vc[c]) != VC::BEFORE) { puts("SAI: BEFORE không bắc cầu"); return 1; }
        }
        // hai sự kiện khác nhau không bao giờ có cùng vector
        for (int a = 0; a < E; a++) for (int b = a + 1; b < E; b++) if (s.vc[a].v == s.vc[b].v) { puts("SAI: hai sự kiện khác nhau cùng vector"); return 1; }
    }
    if (concurrent < 10000 || before < 10000) { printf("Kịch bản thử quá nghèo: %lld cặp đồng thời, %lld cặp trước/sau\n", concurrent, before); return 1; }
    printf("%lld cặp sự kiện đã so với mô hình happened-before (%lld đồng thời)\n", pairs, concurrent);
    puts("OK");
}
