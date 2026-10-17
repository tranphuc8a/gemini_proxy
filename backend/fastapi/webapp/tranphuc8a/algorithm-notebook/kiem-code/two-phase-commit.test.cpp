// @TEMPLATE

// Thử Two-Phase Commit: (1) VÉT CẠN mọi bộ phiếu của 0..6 participant x mọi kiểu coordinator hỏng (không hỏng, trước khi ghi log, sau khi ghi log,
// giữa lúc gửi quyết định cho k bên) x có/không giao thức kết thúc hợp tác; (2) mô phỏng ngẫu nhiên tới 40 participant với phiếu YES/NO ngẫu nhiên,
// gọi cooperativeTermination / gửi lại quyết định / recover theo thứ tự ngẫu nhiên.
// Điều phải đúng: COMMIT chỉ khi MỌI phiếu là YES (và log = COMMIT); có NO, hoặc coordinator hỏng trước khi ghi quyết định (tương đương hết giờ chờ phiếu)
// thì ABORT (presumed abort); KHÔNG BAO GIỜ có bên COMMITTED cùng bên ABORTED; sau recover mọi bên cùng một kết cục; bị chặn đúng khi mọi bên còn sống đều READY.
// Mô hình không có đồng hồ: participant im lặng quá hạn được coi như phiếu NO.
static string stName(PState s) { return s == PState::INIT ? "INIT" : s == PState::READY ? "READY" : s == PState::COMMITTED ? "COMMITTED" : "ABORTED"; }

static string crashName(TwoPC::Crash c, int sent) {
    if (c == TwoPC::NONE) return "NONE";
    if (c == TwoPC::BEFORE_LOG) return "BEFORE_LOG";
    if (c == TwoPC::AFTER_LOG) return "AFTER_LOG";
    return "MID_SEND(" + to_string(sent) + ")";
}

// Bất biến an toàn phải đúng ở MỌI thời điểm. Trả "" nếu ổn.
static string safety(const TwoPC& t) {
    bool allYes = true, anyC = false, anyA = false, anyNo = false;
    for (int i = 0; i < t.n; i++) {
        allYes &= t.yes[i];
        anyNo |= !t.yes[i];
        anyC |= t.st[i] == PState::COMMITTED;
        anyA |= t.st[i] == PState::ABORTED;
    }
    if (anyC && anyA) return "có bên COMMITTED cùng bên ABORTED";
    if (anyC && (!allYes || t.log != Decision::COMMIT)) return "có bên COMMITTED nhưng không phải mọi phiếu YES / log không phải COMMIT";
    if (t.log == Decision::COMMIT && !allYes) return "log COMMIT dù có phiếu NO";
    for (int i = 0; i < t.n; i++) {
        if (!t.yes[i] && t.st[i] != PState::ABORTED) return "bên bỏ phiếu NO mà không ABORTED (" + stName(t.st[i]) + ")";
        if (t.yes[i] && t.st[i] == PState::INIT) return "bên bỏ phiếu YES còn INIT";
        if (t.yes[i] && t.st[i] == PState::ABORTED && !(t.log == Decision::ABORT || (t.log == Decision::NONE && anyNo)))
            return "bên YES bị ABORTED mà log không phải ABORT";
    }
    return "";
}

static bool allSame(const TwoPC& t, PState s) {
    for (PState x : t.st) if (x != s) return false;
    return true;
}

// kết quả mong đợi của pha 1 + pha 2 (trước recover). Trả "" nếu khớp.
static string expectAfterRun(const TwoPC& t, TwoPC::Crash crash, int sent) {
    bool allYes = true;
    for (bool y : t.yes) allYes &= y;
    Decision wantLog = crash == TwoPC::BEFORE_LOG ? Decision::NONE : (allYes ? Decision::COMMIT : Decision::ABORT);
    if (t.log != wantLog) return "log sau run sai";
    for (int i = 0; i < t.n; i++) {
        PState want;
        if (!t.yes[i]) want = PState::ABORTED;
        else {
            bool delivered = crash == TwoPC::NONE || (crash == TwoPC::MID_SEND && i < sent);
            want = !delivered ? PState::READY : (allYes ? PState::COMMITTED : PState::ABORTED);
        }
        if (t.st[i] != want) return "participant " + to_string(i) + " là " + stName(t.st[i]) + ", mong " + stName(want);
    }
    return "";
}

static bool wantBlocked(const TwoPC& t, TwoPC::Crash crash, int sent) {
    bool allYes = true;
    for (bool y : t.yes) allYes &= y;
    bool someoneKnows = crash == TwoPC::NONE || (crash == TwoPC::MID_SEND && sent >= 1);
    return t.n >= 1 && allYes && !someoneKnows;
}

#define CHECK_SAFE(t, ctx) { string e_ = safety(t); if (!e_.empty()) { printf("SAI an toàn (%s): %s\n", ctx, e_.c_str()); return 1; } }

// chạy một kịch bản; trả 0 nếu đúng
static int scenario(const vector<bool>& votes, TwoPC::Crash crash, int sent, bool coop, bool redeliver, mt19937& rng) {
    string tag = "n=" + to_string(votes.size()) + " crash=" + crashName(crash, sent) + (coop ? " +coop" : "") + (redeliver ? " +gửi lại" : "");
    for (size_t i = 0; i < votes.size(); i++) tag += votes[i] ? " Y" : " N";
    TwoPC t(votes);
    for (int i = 0; i < t.n; i++) if (t.st[i] != PState::INIT) { printf("SAI: trạng thái ban đầu phải INIT [%s]\n", tag.c_str()); return 1; }
    if (t.log != Decision::NONE) { printf("SAI: log ban đầu phải rỗng [%s]\n", tag.c_str()); return 1; }
    t.run(crash, sent);
    CHECK_SAFE(t, tag.c_str());
    string e = expectAfterRun(t, crash, sent);
    if (!e.empty()) { printf("SAI sau run: %s [%s]\n", e.c_str(), tag.c_str()); return 1; }
    bool allYes = true;
    for (bool y : votes) allYes &= y;
    vector<PState> before = t.st;
    if (coop) {
        bool blocked = t.cooperativeTermination();
        CHECK_SAFE(t, tag.c_str());
        if (blocked != wantBlocked(t, crash, sent)) { printf("SAI: cờ bị chặn = %d, mong %d [%s]\n", (int)blocked, (int)wantBlocked(t, crash, sent), tag.c_str()); return 1; }
        if (blocked && t.st != before) { printf("SAI: bị chặn mà trạng thái vẫn đổi [%s]\n", tag.c_str()); return 1; }
        if (!blocked) {
            // mọi participant READY đã học được kết cục đúng; kết cục này không được trái với quyết định cuối cùng
            for (int i = 0; i < t.n; i++)
                if (t.st[i] == PState::READY) { printf("SAI: không bị chặn mà vẫn còn READY [%s]\n", tag.c_str()); return 1; }
            if (t.n >= 1) {
                bool anyC = false;
                for (PState s : t.st) anyC |= (s == PState::COMMITTED);
                if (anyC != allYes) { printf("SAI: kết cục học được (%s) trái với phiếu [%s]\n", anyC ? "COMMIT" : "ABORT", tag.c_str()); return 1; }
            }
        }
    }
    if (redeliver && t.log != Decision::NONE) {         // coordinator gửi lại quyết định theo thứ tự lộn xộn, có trùng lặp (idempotent)
        for (int k = 0; k < 3 * t.n + 2 && t.n > 0; k++) t.deliver((int)(rng() % t.n));
        CHECK_SAFE(t, tag.c_str());
    }
    vector<PState> mid = t.st;
    t.recover();
    CHECK_SAFE(t, tag.c_str());
    // sau recover: mọi bên cùng kết cục. Có NO hoặc hỏng trước khi ghi log -> ABORT; ngược lại COMMIT.
    bool wantCommit = allYes && crash != TwoPC::BEFORE_LOG;
    if (t.n >= 1 && !allSame(t, wantCommit ? PState::COMMITTED : PState::ABORTED)) { printf("SAI: sau recover mong mọi bên %s [%s]\n", wantCommit ? "COMMITTED" : "ABORTED", tag.c_str()); return 1; }
    if (t.log != (wantCommit ? Decision::COMMIT : Decision::ABORT)) { printf("SAI: log sau recover [%s]\n", tag.c_str()); return 1; }
    // đã quyết xong thì không bao giờ đổi ý, và recover/deliver lặp lại không đổi gì
    for (int i = 0; i < t.n; i++)
        if ((mid[i] == PState::COMMITTED || mid[i] == PState::ABORTED) && mid[i] != t.st[i]) { printf("SAI: participant %d đổi kết cục đã có [%s]\n", i, tag.c_str()); return 1; }
    vector<PState> fin = t.st;
    t.recover();
    for (int i = 0; i < t.n; i++) t.deliver(i);
    if (t.st != fin || t.cooperativeTermination()) { printf("SAI: recover/deliver/cooperativeTermination lặp lại làm đổi trạng thái hoặc báo chặn [%s]\n", tag.c_str()); return 1; }
    if (t.st != fin) { printf("SAI: hợp tác kết thúc lặp lại làm đổi trạng thái [%s]\n", tag.c_str()); return 1; }
    return 0;
}

int main() {
    mt19937 rng(20261017);
    // 1) ví dụ trong mô tả
    {
        TwoPC a(vector<bool>{true, true, false});               // (a) YES, YES, NO -> cả ba ABORTED
        a.run(TwoPC::NONE);
        if (!allSame(a, PState::ABORTED) || a.log != Decision::ABORT) { puts("SAI: ví dụ (a)"); return 1; }
        TwoPC b(vector<bool>{true, true, true});                // (b) hỏng trước khi ghi quyết định -> kẹt READY, rồi ABORT
        b.run(TwoPC::BEFORE_LOG);
        if (!allSame(b, PState::READY) || !b.cooperativeTermination()) { puts("SAI: ví dụ (b) phải kẹt READY và bị chặn"); return 1; }
        b.recover();
        if (!allSame(b, PState::ABORTED) || b.log != Decision::ABORT) { puts("SAI: ví dụ (b) sau hồi phục phải ABORT"); return 1; }
        TwoPC c(vector<bool>{true, true, true});                // (c) ghi COMMIT rồi hỏng -> kẹt READY, rồi COMMIT
        c.run(TwoPC::AFTER_LOG);
        if (!allSame(c, PState::READY) || c.log != Decision::COMMIT || !c.cooperativeTermination()) { puts("SAI: ví dụ (c) phải kẹt READY với log COMMIT"); return 1; }
        c.recover();
        if (!allSame(c, PState::COMMITTED)) { puts("SAI: ví dụ (c) sau hồi phục phải COMMIT"); return 1; }
        // (a) biến thể: hai bên YES học ABORT từ bên NO qua giao thức hợp tác khi coordinator hỏng trước khi gửi
        TwoPC d(vector<bool>{true, true, false});
        d.run(TwoPC::BEFORE_LOG);
        if (d.cooperativeTermination() || !allSame(d, PState::ABORTED)) { puts("SAI: hợp tác kết thúc phải học ABORT từ bên bỏ NO"); return 1; }
    }
    // 2) không participant: mọi lần chạy phải an toàn, COMMIT rỗng không bị chặn
    {
        TwoPC t((vector<bool>()));
        t.run(TwoPC::NONE);
        if (t.log != Decision::COMMIT || t.cooperativeTermination()) { puts("SAI: giao dịch rỗng"); return 1; }
    }
    // 2b) deliver chỉ đổi participant READY: bên chưa bỏ phiếu (INIT) hoặc đã có kết cục thì không bao giờ bị quyết định đè lên
    {
        TwoPC t(vector<bool>{true, true, true});
        t.log = Decision::COMMIT;
        t.st[1] = PState::READY;
        t.st[2] = PState::ABORTED;                                // trạng thái tình huống không thể xảy ra, chỉ để kiểm tính idempotent / không ghi đè
        for (int k = 0; k < 3; k++) for (int i = 0; i < 3; i++) t.deliver(i);
        if (t.st[0] != PState::INIT || t.st[1] != PState::COMMITTED || t.st[2] != PState::ABORTED) { puts("SAI: deliver chỉ được đổi participant READY"); return 1; }
        TwoPC u(vector<bool>{true, false});
        u.log = Decision::ABORT;
        u.st[0] = PState::COMMITTED;
        u.deliver(0);
        if (u.st[0] != PState::COMMITTED) { puts("SAI: deliver đè lên kết cục COMMITTED"); return 1; }
    }
    // 3) vét cạn
    long long cases = 0;
    for (int n = 0; n <= 6; n++)
        for (int mask = 0; mask < (1 << n); mask++) {
            vector<bool> votes(n);
            for (int i = 0; i < n; i++) votes[i] = (mask >> i) & 1;
            vector<pair<TwoPC::Crash, int>> crashes = {{TwoPC::NONE, 0}, {TwoPC::BEFORE_LOG, 0}, {TwoPC::AFTER_LOG, 0}};
            for (int k = 0; k <= n + 1; k++) crashes.push_back({TwoPC::MID_SEND, k});   // k >= n: đã gửi hết rồi mới "hỏng"
            for (auto& c : crashes)
                for (int coop = 0; coop < 2; coop++)
                    for (int redeliver = 0; redeliver < 2; redeliver++) {
                        if (scenario(votes, c.first, c.second, coop, redeliver, rng)) return 1;
                        cases++;
                    }
        }
    // 4) ngẫu nhiên, nhiều participant, thứ tự thao tác ngẫu nhiên
    long long blockedSeen = 0, learnedSeen = 0;
    for (int iter = 0; iter < 20000; iter++) {
        int n = 1 + rng() % 40;
        static const double PYES[4] = {0.5, 0.9, 0.99, 1.0};
        double pyes = PYES[rng() % 4];
        vector<bool> votes(n);
        bool allYes = true;
        for (int i = 0; i < n; i++) { votes[i] = (rng() % 1000) < pyes * 1000; allYes &= votes[i]; }
        TwoPC::Crash crash = (TwoPC::Crash)(rng() % 4);
        int sent = rng() % (n + 1);
        TwoPC t(votes);
        t.run(crash, sent);
        string e = expectAfterRun(t, crash, sent);
        if (!e.empty()) { printf("SAI sau run (ngẫu nhiên): %s\n", e.c_str()); return 1; }
        CHECK_SAFE(t, "ngẫu nhiên: run");
        for (int step = 0; step < 6; step++) {
            int a = rng() % 3;
            if (a == 0) {
                bool blocked = t.cooperativeTermination();
                CHECK_SAFE(t, "ngẫu nhiên: cooperativeTermination");
                if (blocked) {
                    blockedSeen++;
                    if (!allYes || t.log == Decision::ABORT) { puts("SAI: báo bị chặn dù đã có thể biết ABORT"); return 1; }
                    for (PState s : t.st) if (s != PState::READY) { puts("SAI: bị chặn nhưng có bên đã kết thúc"); return 1; }
                } else learnedSeen++;
            } else if (a == 1 && t.log != Decision::NONE) {
                for (int k = 0; k < n; k++) t.deliver((int)(rng() % n));
                CHECK_SAFE(t, "ngẫu nhiên: gửi lại");
            } else {
                vector<PState> before = t.st;
                t.recover();
                CHECK_SAFE(t, "ngẫu nhiên: recover");
                for (int i = 0; i < n; i++)
                    if ((before[i] == PState::COMMITTED || before[i] == PState::ABORTED) && before[i] != t.st[i]) { puts("SAI: bên đã kết thúc bị đổi kết cục"); return 1; }
                if (!allSame(t, (allYes && crash != TwoPC::BEFORE_LOG) ? PState::COMMITTED : PState::ABORTED)) { puts("SAI: sau recover không đồng nhất / sai kết cục (ngẫu nhiên)"); return 1; }
            }
        }
        t.recover();                                              // kết thúc luôn bằng recover
        bool wantCommit = allYes && crash != TwoPC::BEFORE_LOG;
        if (!allSame(t, wantCommit ? PState::COMMITTED : PState::ABORTED)) { printf("SAI: trạng thái cuối n=%d crash=%s\n", n, crashName(crash, sent).c_str()); return 1; }
        CHECK_SAFE(t, "ngẫu nhiên: cuối");
    }
    if (blockedSeen < 100 || learnedSeen < 100) { puts("Kịch bản thử quá nghèo (ít ca bị chặn / ít ca học kết cục)"); return 1; }
    printf("%lld kịch bản vét cạn, 20000 kịch bản ngẫu nhiên (%lld lần bị chặn, %lld lần học được kết cục)\n", cases, blockedSeen, learnedSeen);
    puts("OK");
}
