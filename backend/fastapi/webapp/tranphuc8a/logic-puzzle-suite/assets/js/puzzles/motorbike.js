/* puzzles/motorbike.js — ĐI BỘ & XE MÁY: n người đi bộ từ A tới B (đi bộ hết 1 giờ), k xe máy chở thêm 1 người, tốc độ xe gấp m lần đi bộ; xe được QUAY LẠI đón người
   và BỎ XE bên đường (người đi sau nhặt lên đi tiếp). Mục tiêu: cực tiểu thời điểm người CUỐI CÙNG tới B. Loại optimize (HUONG-DAN-ENGINE.md mục 11):
   người chơi xếp một KẾ HOẠCH (mỗi xe một hàng lệnh), engine mô phỏng hướng sự kiện bằng số hữu tỉ BigInt (không sai số), NỘP → chấm so với mức tối ưu.

   ── Hai cách hiểu (options.interp) ──────────────────────────────────────────────────────────────────────────────────────────────────
   A (mặc định, "người trong nhóm lái"): ai cũng lái được; xe chở 2 người của nhóm (người lái + người ngồi sau); người lái cũng phải tới B; được bỏ xe.
   B ("xe ôm"): mỗi xe có tài xế NGOÀI nhóm, chở 1 người của nhóm; tài xế không cần tới B; bỏ xe vô nghĩa.

   ── Lõi toán (chuẩn hoá AB = 1, đi bộ tốc độ 1, xe tốc độ m) ─────────────────────────────────────────────────────────────────────────
   Lịch ĐƯA-ĐÓN (một xe, g khách, mỗi khách đi xe quãng x, đi bộ 1−x, xe chạy liên tục): điểm đón tiến 2x/(m+1) mỗi chu kỳ ⇒ x = (m+1)/(m+2g−1),
   T_dd(g) = (m(2g−1)+1) / (m(m+2g−1)); khách j được thả ở (m+1+2j)/(m+2g−1).  Lịch TIẾP SỨC (cách hiểu A, bỏ xe): xe chỉ đi tới, luôn chở 2, mỗi nhóm hai người đi xe quãng
   d = 2k/n rồi bỏ xe cho nhóm sau: T = 1 − (2k/n)(1 − 1/m).  Cận dưới LP (biến trung bình mỗi người: r km xe chiều tới, s km xe chiều lùi; mỗi xe: F km tới, K km lùi):
   (1) 1 − r + s + (r+s)/m ≤ T, (2) n·r ≤ 2k·F (B: k·F), (3) n·s ≥ k·K (chỉ A: km lùi cần một người trong nhóm lái), (4) F − K ≤ 1, (5) F + K ≤ mT, (6) r − s ≤ 1.
   Giải ra: A, m > 3 → T* = T_dd(n/k − 1); m < 3 → T* = 1 − (2k/n)(1 − 1/m); m = 3 → hai công thức bằng nhau; n ≤ 2k → 1/m.  B: T* = T_dd(n/k) (n ≤ k → 1/m).
   Đạt được khi: m ≥ 3 cần k | n; m ≤ 3 cần 2k | n (B: k | n). Ngoài các trường hợp đó chỉ BIẾT cận dưới: đề vẫn chơi được, chấm so với cận dưới LP, KHÔNG báo "Tối ưu!"
   (grade luôn < 1) và gợi ý theo lịch tốt nhất app biết (đưa-đón hoặc tiếp sức chia nhóm cân bằng). Công thức đã kiểm bằng LP liệt kê đỉnh viết riêng trong kiem/motorbike.js.

   ── Trạng thái (Puz.plan, mục 11.2) ─────────────────────────────────────────────────────────────────────────────────────────────────
   layout(cap = 64, W = 4, 0): bản ghi [xe (1…k), lệnh, a, b]; lệnh 1 = LẤY XE (a = người lái + 1, b = người ngồi sau + 1 hoặc 0) · 2 = CHỞ TỚI (a = vị trí trên lưới, x = a/G quãng AB)
   · 3 = ĐÓN (a = người + 1: xe chạy tới gặp người đang đi bộ — đuổi theo nếu người ở phía trước, quay lại nếu ở phía sau) · 4 = XUỐNG (a = người + 1; người lái xuống thì người sau thành người lái;
   không còn ai ⇒ xe đỗ = bỏ xe). Người rảnh luôn đi bộ về B. Hết lệnh mà còn người trên xe ⇒ xe tự chạy tới B. Các xe xử lý theo thời điểm sẵn sàng nhỏ nhất; người ĐÃ được một lệnh
   LẤY/ĐÓN giữ chỗ thì lệnh khác không đụng tới được ("P3 đang ngồi xe khác lúc đó") — không hỗ trợ đổi xe giữa chừng của một người đã xuống xe. Cờ nộp nằm trong state.
   Action: {k:"cmd", bike, op:"take"|"ride"|"meet"|"off", a, b} · {k:"steps", recs:[[xe, lệnh, a, b]…]} · {k:"abandon", bike} (bỏ xe tại chỗ: mọi người trên xe xuống) · {k:"truncate", n} · {k:"submit"}.
   Mọi action = MỘT diff; moveFor chạy lại cả kế hoạch (simulate) nên không bao giờ sinh state sai luật. `mistakes` luôn 0 (không xác định được nước làm mất tối ưu). */
(function (root) {
  "use strict";
  if (typeof BigInt === "undefined") return;                                  // Safari < 14: không có BigInt ⇒ không đăng ký loại này (các loại khác chạy bình thường)
  var P = root.Puz, plan = P.plan, G = P.grade;

  var CAP = 64, W = 4, MAX_N = 12, MAX_K = 4, MAX_GRID = 5000, MIN_GRID = 24;
  var OP_TAKE = 1, OP_RIDE = 2, OP_MEET = 3, OP_OFF = 4;
  var OPNAME = { take: OP_TAKE, ride: OP_RIDE, meet: OP_MEET, off: OP_OFF };
  var LAYOUT = plan.layout(CAP, W, 0);

  function isInt(x, lo, hi) { return typeof x === "number" && x === Math.floor(x) && x >= lo && x <= hi; }
  function copyState(s) { return { v: s.v.slice(), c: null }; }
  function after(s, diff) { var t = copyState(s); P.game.applyDiff(t, diff.d, false); return t; }
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  // ================================================================================================= số hữu tỉ BigInt
  function gcdB(a, b) { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { var t = a % b; a = b; b = t; } return a; }
  function Q(n, d) { n = BigInt(n); d = d === undefined ? 1n : BigInt(d); if (d === 0n) throw new Error("chia 0"); if (d < 0n) { n = -n; d = -d; } var g = gcdB(n, d) || 1n; return { n: n / g, d: d / g }; }
  function qadd(a, b) { return Q(a.n * b.d + b.n * a.d, a.d * b.d); }
  function qsub(a, b) { return Q(a.n * b.d - b.n * a.d, a.d * b.d); }
  function qmul(a, b) { return Q(a.n * b.n, a.d * b.d); }
  function qdiv(a, b) { return Q(a.n * b.d, a.d * b.n); }
  function qcmp(a, b) { var x = a.n * b.d - b.n * a.d; return x < 0n ? -1 : x > 0n ? 1 : 0; }
  function qmax(a, b) { return qcmp(a, b) >= 0 ? a : b; }
  function qs(a) { return a.d === 1n ? a.n.toString() : a.n + "/" + a.d; }
  function qf(a) { return Number(a.n) / Number(a.d); }
  function qparse(s) { var m = /^(\d+)(?:\/(\d+))?$/.exec(String(s)); return m ? Q(BigInt(m[1]), BigInt(m[2] || "1")) : null; }
  var Z = Q(0), ONE = Q(1);
  function igcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a || 1; }
  function ilcm(a, b) { return a / igcd(a, b) * b; }

  /** "31 phút 12 giây" từ số giờ hữu tỉ; "≈" khi làm tròn tới giây. */
  function durText(T) {
    var num = T.n * 3600n, den = T.d, exact = num % den === 0n, sec = exact ? num / den : (2n * num + den) / (2n * den), s = Number(sec), mi = Math.floor(s / 60), ss = s % 60;
    return (exact ? "" : "≈ ") + (mi ? mi + " phút" + (ss ? " " + ss + " giây" : "") : ss + " giây");
  }
  function hoursText(T) { return qs(T) + " giờ"; }
  function posText(x) { return x.n === 0n ? "A" : qs(x) === "1" ? "B" : qs(x) + " quãng"; }
  function gridText(a, Gd) { var g = igcd(a, Gd); return a === 0 ? "A" : a === Gd ? "B" : a / g + "/" + Gd / g + " quãng"; }

  // ================================================================================================= m = mu/mv
  /** "5" · "5/2" · "2,5" · số → {mu, mv} rút gọn, 1 < m ≤ 20; null nếu sai. */
  function parseM(x) {
    var t = typeof x === "number" ? String(x) : typeof x === "string" ? x.trim().replace(",", ".") : "", mu, mv, mt;
    if (Array.isArray(x) && x.length === 2) { mu = x[0]; mv = x[1]; }
    else if ((mt = /^(\d+)\s*\/\s*(\d+)$/.exec(t))) { mu = Number(mt[1]); mv = Number(mt[2]); }
    else if ((mt = /^(\d+)(?:\.(\d{1,2}))?$/.exec(t))) { var frac = mt[2] || ""; mv = Math.pow(10, frac.length); mu = Number(mt[1]) * mv + Number(frac || 0); }
    else return null;
    if (!isInt(mu, 1, 100000) || !isInt(mv, 1, 100)) return null;
    var g = igcd(mu, mv); mu /= g; mv /= g;
    if (mu <= mv || mu > 20 * mv || mu > 200 || mv > 10) return null;
    return { mu: mu, mv: mv };
  }
  function mText(d) { return d.mv === 1 ? String(d.mu) : d.mu + "/" + d.mv; }
  function mQ(d) { return Q(d.mu, d.mv); }

  // ================================================================================================= dạng đóng + cận dưới LP
  /** T_dd(g) cho g là số hữu tỉ ≥ 1: (m(2g−1)+1) / (m(m+2g−1)). */
  function tShuttle(g, m) {
    var two = qsub(qmul(Q(2), g), ONE);
    return qdiv(qadd(qmul(m, two), ONE), qmul(m, qadd(m, two)));
  }
  function tRelay(n, k, m) { return qsub(ONE, qmul(Q(2 * k, n), qsub(ONE, qdiv(ONE, m)))); }
  /** Cận dưới LP (số hữu tỉ). A: n ≤ 2k → 1/m; m ≥ 3 → T_dd(n/k − 1); m < 3 → tiếp sức. B: n ≤ k → 1/m, còn lại T_dd(n/k). */
  function lbOf(d) {
    var m = mQ(d), n = d.n, k = d.k;
    if (d.interp === "B") return n <= k ? qdiv(ONE, m) : tShuttle(Q(n, k), m);
    if (n <= 2 * k) return qdiv(ONE, m);
    return d.mu >= 3 * d.mv ? tShuttle(qsub(Q(n, k), ONE), m) : tRelay(n, k, m);
  }
  /** Biết chính xác tối ưu (có lịch đạt cận LP)? */
  function exactOf(d) {
    var n = d.n, k = d.k, ge3 = d.mu >= 3 * d.mv, le3 = d.mu <= 3 * d.mv;
    if (d.interp === "B") return n <= k || n % k === 0;
    if (n <= 2 * k) return true;
    return (ge3 && n % k === 0) || (le3 && n % (2 * k) === 0);
  }
  function regimeOf(d) {
    if (d.interp === "B") return d.n <= d.k ? "chi-can" : "xe-om";
    if (d.n <= 2 * d.k) return "chi-can";
    return d.mu > 3 * d.mv ? "dua-don" : d.mu < 3 * d.mv ? "tiep-suc" : "ca-hai";
  }
  var REGIME_NAME = { "chi-can": "Chở thẳng (đủ chỗ cho mọi người)", "dua-don": "Đưa-đón (xe chạy liên tục)", "tiep-suc": "Tiếp sức (bỏ xe)", "ca-hai": "Đưa-đón hoặc tiếp sức (m = 3, hai lịch bằng nhau)", "xe-om": "Xe ôm đưa-đón" };

  // ================================================================================================= lịch mẫu (bản ghi chuẩn: người gán theo thứ tự trên từng xe)
  function sizesOf(n, k) { var out = [], q = Math.floor(n / k), r = n % k; for (var b = 0; b < k; b++) { var s = q + (b < r ? 1 : 0); if (s > 0) out.push(s); } return out; }
  function shuttleDen(d, g) { return d.mu + (2 * g - 1) * d.mv; }
  /** Mỗi xe một nhóm: A — người lái + g khách; B — g khách (tài xế ngoài). dens = các mẫu số cần có trên lưới. */
  function famShuttle(d, Gd) {
    var A = d.interp !== "B", sizes = sizesOf(d.n, d.k), recs = [], off = 0, dens = [];
    sizes.forEach(function (s, b) {
      var g = A ? s - 1 : s, drv = A ? off : -1, first = A ? off + 1 : off;
      if (g < 1) { recs.push([b + 1, OP_TAKE, off + 1, 0]); if (Gd) recs.push([b + 1, OP_RIDE, Gd, 0]); off += s; return; }
      var Y = shuttleDen(d, g); dens.push(Y);
      if (A) recs.push([b + 1, OP_TAKE, drv + 1, first + 1]); else recs.push([b + 1, OP_TAKE, first + 1, 0]);
      for (var j = 0; j < g; j++) {
        if (j > 0) recs.push([b + 1, OP_MEET, first + j + 1, 0]);
        if (Gd) recs.push([b + 1, OP_RIDE, j === g - 1 ? Gd : (d.mu + d.mv + 2 * j * d.mv) * (Gd / Y), 0]);
        if (j < g - 1) recs.push([b + 1, OP_OFF, first + j + 1, 0]);
      }
      off += s;
    });
    return { id: A ? "dua-don" : "xe-om", name: A ? "Đưa-đón" : "Xe ôm đưa-đón", recs: recs, dens: dens };
  }
  /** Tiếp sức (chỉ A): mỗi xe một chuỗi các nhóm ≤ 2 người, nhóm i đi xe quãng 1/R rồi bỏ xe lại. */
  function famRelay(d, Gd) {
    var sizes = sizesOf(d.n, d.k), recs = [], off = 0, dens = [];
    sizes.forEach(function (s, b) {
      var R = Math.ceil(s / 2); dens.push(R);
      for (var i = 0; i < R; i++) {
        var p = off + 2 * i, two = p + 1 < off + s;
        recs.push([b + 1, OP_TAKE, p + 1, two ? p + 2 : 0]);
        if (Gd) recs.push([b + 1, OP_RIDE, i === R - 1 ? Gd : (i + 1) * (Gd / R), 0]);
        if (i < R - 1) { recs.push([b + 1, OP_OFF, p + 1, 0]); if (two) recs.push([b + 1, OP_OFF, p + 2, 0]); }
      }
      off += s;
    });
    return { id: "tiep-suc", name: "Tiếp sức", recs: recs, dens: dens };
  }
  /** Mọi xe chở thẳng tới B (n ≤ 2k, hoặc B với n ≤ k). */
  function famDirect(d, Gd) {
    var A = d.interp !== "B", per = A ? 2 : 1, recs = [], nb = Math.ceil(d.n / per);
    for (var b = 0; b < nb; b++) {
      var p = b * per, two = A && p + 1 < d.n;
      recs.push([b + 1, OP_TAKE, p + 1, two ? p + 2 : 0]);
      if (Gd) recs.push([b + 1, OP_RIDE, Gd, 0]);
    }
    return { id: "chi-can", name: "Chở thẳng", recs: recs, dens: [] };
  }
  function gridOf(dens) {
    var L = 1; for (var i = 0; i < dens.length; i++) { L = ilcm(L, dens[i]); if (L > MAX_GRID) return 0; }
    var G2 = L * Math.ceil(MIN_GRID / L);
    return G2 > MAX_GRID ? 0 : G2;
  }
  function builders(d) {                                                          // [{id, mk(d, Gd)}] — mọi lịch ứng viên của đề (đã hợp lệ về mặt luật)
    var A = d.interp !== "B";
    if (d.interp === "B") return d.n <= d.k ? [famDirect] : [famShuttle];
    if (d.n <= 2 * d.k) return [famDirect];
    var out = [];
    if (exactOf(d)) {
      var ge3 = d.mu >= 3 * d.mv, le3 = d.mu <= 3 * d.mv;
      if (ge3 && d.n % d.k === 0) out.push(famShuttle);
      if (le3 && d.n % (2 * d.k) === 0) out.push(famRelay);
      return out;
    }
    return [famShuttle, famRelay];
  }
  /** Các lịch ứng viên với lưới G đã chọn (G chung cho cả đề). → {G, fams:[{id,name,recs}]}; G = 0 nếu không lưới nào đủ nhỏ. */
  function famsOf(d) {
    var bs = builders(d), dens = [];
    bs.forEach(function (f) { dens = dens.concat(f(d, 0).dens); });
    var Gd = gridOf(dens);
    if (!Gd && dens.length) {                                                       // lưới chung quá lớn: bỏ bớt ứng viên (tiếp sức luôn có lưới nhỏ)
      bs = bs.filter(function (f) { return gridOf(f(d, 0).dens) > 0; });
      dens = []; bs.forEach(function (f) { dens = dens.concat(f(d, 0).dens); });
      Gd = gridOf(dens);
    }
    if (!Gd && !dens.length) Gd = MIN_GRID;
    if (!Gd) return { G: 0, fams: [] };
    return { G: Gd, fams: bs.map(function (f) { var r = f(d, Gd); return { id: r.id, name: r.name, recs: r.recs }; }) };
  }

  // ================================================================================================= MÔ PHỎNG HƯỚNG SỰ KIỆN
  /** recs = [[xe, lệnh, a, b]…] → { ok, error:{at, msg}|null, T, arrivals, segs, events, bikes, persons }. Không đổi đầu vào. Số hữu tỉ BigInt. */
  function simulate(d, recs) {
    var n = d.n, k = d.k, Gd = d.G, M = mQ(d), Mm1 = qsub(M, ONE), Mp1 = qadd(M, ONE), A = d.interp !== "B", err = null, i, guard;
    var pers = [], bikes = [], segs = [], events = [];
    for (i = 0; i < n; i++) pers.push({ mode: "walk", x0: Z, t0: Z, done: null });
    for (i = 0; i < k; i++) bikes.push({ x: Z, t: Z, riders: A ? [] : [-1], q: [], qi: 0 });
    function fail(idx, msg) { if (!err) err = { at: idx, msg: msg }; }
    function nm(p) { return "P" + (p + 1); }
    function seg(kind, id, t0, x0, t1, x1) { segs.push({ kind: kind, id: id, t0: t0, x0: x0, t1: t1, x1: x1 }); }
    function real(B) { return B.riders.filter(function (r) { return r >= 0; }); }
    function ev(idx, bi, t, x, text) { events.push({ idx: idx, bike: bi, t: t, x: x, text: text }); }
    for (i = 0; i < recs.length; i++) {
      var r = recs[i];
      if (!Array.isArray(r) || r.length !== W || !r.every(function (v) { return typeof v === "number" && v === Math.floor(v); })) { fail(i, "Bản ghi " + (i + 1) + " sai hình dạng."); break; }
      if (r[0] < 1 || r[0] > k) { fail(i, "Lệnh " + (i + 1) + ": xe " + r[0] + " không tồn tại (có " + k + " xe)."); break; }
      bikes[r[0] - 1].q.push({ op: r[1], a: r[2], b: r[3], idx: i });
    }
    var phase = 1, snap = null;                                                   // pha 1: chỉ các lệnh tường minh (snap = trạng thái cho bàn); pha 2: xe còn người mà hết lệnh tự chạy tới B
    function snapshot() {
      return { bikes: bikes.map(function (b) { return { x: b.x, t: b.t, riders: real(b), parked: !real(b).length, used: b.q.length > 0 }; }), persons: pers.map(function (q) { return { mode: q.mode, x0: q.x0, t0: q.t0, done: q.done }; }) };
    }
    for (guard = 0; guard < 4096 && !err; guard++) {
      var bi = -1;
      for (i = 0; i < k; i++) {
        var B0 = bikes[i];
        if (phase === 1 ? B0.qi >= B0.q.length : !real(B0).length) continue;
        if (bi < 0 || qcmp(B0.t, bikes[bi].t) < 0) bi = i;
      }
      if (bi < 0) { if (phase === 1) { snap = snapshot(); phase = 2; continue; } break; }
      var B = bikes[bi], cmd, implicit = false, lastIdx = B.q.length ? B.q[B.q.length - 1].idx : -1;
      if (B.qi < B.q.length) cmd = B.q[B.qi++]; else { cmd = { op: OP_RIDE, a: Gd, b: 0, idx: lastIdx }; implicit = true; }
      var idx = cmd.idx, tag = "Xe " + (bi + 1) + ": ", p, P, who, tt, x, xp, dist, t1, j;
      if (cmd.op === OP_TAKE) {
        who = cmd.b > 0 ? [cmd.a - 1, cmd.b - 1] : [cmd.a - 1];
        if (A && B.riders.length) { fail(idx, tag + "xe đang có người — phải cho xuống hết (hoặc bỏ xe) trước khi lấy xe cho người khác."); break; }
        if (!A && (real(B).length || cmd.b > 0)) { fail(idx, tag + (cmd.b > 0 ? "xe ôm chỉ chở 1 khách." : "xe ôm đang chở khách rồi.")); break; }
        if (who.some(function (q) { return q < 0 || q >= n; }) || (who.length === 2 && who[0] === who[1])) { fail(idx, tag + "người không hợp lệ."); break; }
        var tb = B.t, tas = [];
        for (j = 0; j < who.length && !err; j++) {
          p = who[j]; P = pers[p];
          if (P.mode !== "walk") { fail(idx, tag + nm(p) + (P.mode === "bike" ? " đang ngồi xe khác lúc đó." : " đã tới B.")); break; }
          if (qcmp(B.t, P.t0) < 0) { fail(idx, tag + nm(p) + " chưa xuống xe lúc xe này sẵn sàng."); break; }
          xp = qadd(P.x0, qsub(B.t, P.t0));
          if (qcmp(xp, B.x) > 0) { fail(idx, tag + nm(p) + " đã đi qua chỗ xe (" + posText(B.x) + ") trước khi xe được lấy."); break; }
          tas.push(qadd(B.t, qsub(B.x, xp))); tb = qmax(tb, tas[j]);
        }
        if (err) break;
        who.forEach(function (q, jj) { var Pq = pers[q]; seg("walk", q, Pq.t0, Pq.x0, tas[jj], B.x); if (qcmp(tb, tas[jj]) > 0) seg("wait", q, tas[jj], B.x, tb, B.x); Pq.mode = "bike"; });
        B.riders = (A ? [] : [-1]).concat(who); B.t = tb;
        ev(idx, bi, tb, B.x, "Xe " + (bi + 1) + " lấy xe tại " + posText(B.x) + " lúc " + durText(tb) + (who.length > 1 ? ": " + nm(who[0]) + " lái, " + nm(who[1]) + " ngồi sau" : ": " + nm(who[0]) + (A ? " lái một mình" : " lên xe")) + ".");
      } else if (cmd.op === OP_RIDE) {
        if (!B.riders.length) { fail(idx, tag + "xe không có người lái — hãy lấy xe cho một người trước."); break; }
        if (!isInt(cmd.a, 0, Gd)) { fail(idx, tag + "vị trí ngoài [A, B]."); break; }
        x = Q(cmd.a, Gd);
        if (qcmp(x, B.x) === 0) { fail(idx, tag + "xe đã ở " + posText(x) + " rồi."); break; }
        dist = qcmp(x, B.x) >= 0 ? qsub(x, B.x) : qsub(B.x, x); t1 = qadd(B.t, qdiv(dist, M));
        seg("bike", bi, B.t, B.x, t1, x); real(B).forEach(function (q) { seg("ride", q, B.t, B.x, t1, x); });
        B.t = t1; B.x = x;
        if (qcmp(x, ONE) === 0) {
          real(B).forEach(function (q) { pers[q].mode = "done"; pers[q].done = t1; });
          B.riders = A ? [] : [-1];
          ev(idx, bi, t1, x, "Xe " + (bi + 1) + (implicit ? " tự chạy tới B" : " tới B") + " lúc " + durText(t1) + ".");
        } else ev(idx, bi, t1, x, "Xe " + (bi + 1) + " tới " + posText(x) + " lúc " + durText(t1) + ".");
      } else if (cmd.op === OP_MEET) {
        p = cmd.a - 1;
        if (!B.riders.length) { fail(idx, tag + "xe không có người lái."); break; }
        if (B.riders.length >= 2) { fail(idx, tag + (A ? "xe hết chỗ (chở tối đa 2 người)." : "xe ôm chỉ chở 1 khách.")); break; }
        if (!isInt(p, 0, n - 1)) { fail(idx, tag + "người không hợp lệ."); break; }
        P = pers[p];
        if (P.mode !== "walk") { fail(idx, tag + nm(p) + (P.mode === "bike" ? " đang ngồi xe khác lúc đó." : " đã tới B.")); break; }
        if (qcmp(B.t, P.t0) < 0) { fail(idx, tag + nm(p) + " chưa xuống xe lúc xe này sẵn sàng."); break; }
        xp = qadd(P.x0, qsub(B.t, P.t0));
        if (qcmp(xp, ONE) >= 0) { fail(idx, tag + nm(p) + " đã tới B trước khi xe tới gặp."); break; }
        tt = qcmp(xp, B.x) >= 0 ? qadd(B.t, qdiv(qsub(xp, B.x), Mm1)) : qadd(B.t, qdiv(qsub(B.x, xp), Mp1));
        x = qadd(P.x0, qsub(tt, P.t0));
        if (qcmp(x, ONE) > 0) { fail(idx, tag + nm(p) + " tới B trước khi xe kịp gặp."); break; }
        seg("bike", bi, B.t, B.x, tt, x); real(B).forEach(function (q) { seg("ride", q, B.t, B.x, tt, x); });
        seg("walk", p, P.t0, P.x0, tt, x);
        B.t = tt; B.x = x; P.mode = "bike"; B.riders.push(p);
        ev(idx, bi, tt, x, "Xe " + (bi + 1) + " gặp " + nm(p) + " ở " + posText(x) + " lúc " + durText(tt) + " (" + (qcmp(xp, B.x) >= 0 ? "" : "") + "đón lên xe).");
      } else if (cmd.op === OP_OFF) {
        p = cmd.a - 1; var at = B.riders.indexOf(p);
        if (!isInt(p, 0, n - 1) || at < 0) { fail(idx, tag + (isInt(p, 0, n - 1) ? nm(p) + " không ở trên xe này." : "người không hợp lệ.")); break; }
        B.riders.splice(at, 1); P = pers[p]; P.mode = "walk"; P.x0 = B.x; P.t0 = B.t;
        if (qcmp(B.x, ONE) >= 0) { P.mode = "done"; P.done = B.t; }
        ev(idx, bi, B.t, B.x, nm(p) + " xuống xe ở " + posText(B.x) + " lúc " + durText(B.t) + (real(B).length || !A ? "" : " — xe " + (bi + 1) + " bị bỏ lại bên đường") + ".");
      } else { fail(idx, tag + "lệnh lạ (" + cmd.op + ")."); break; }
    }
    if (err) return { ok: false, error: err, T: null, arrivals: [], segs: segs, events: events, bikes: [], persons: [] };
    var T = Z, arr = [];
    for (i = 0; i < n; i++) {
      var Pi = pers[i];
      if (Pi.mode === "walk") { var ta = qadd(Pi.t0, qsub(ONE, Pi.x0)); seg("walk", i, Pi.t0, Pi.x0, ta, ONE); Pi.mode = "done"; Pi.done = ta; }
      if (Pi.mode !== "done") return { ok: false, error: { at: -1, msg: nm(i) + " kẹt trên xe." }, T: null, arrivals: [], segs: segs, events: events, bikes: [], persons: [] };
      arr.push(Pi.done); T = qmax(T, Pi.done);
    }
    if (!snap) snap = snapshot();
    return { ok: true, error: null, T: T, arrivals: arr, segs: segs, events: events, bikes: snap.bikes, persons: snap.persons };
  }
  function recsOf(s) { return plan.read(s, LAYOUT); }
  function simOf(p, s) { return simulate(p.data, recsOf(s)); }
  function numSeg(sg) { return { kind: sg.kind, id: sg.id, t0: qf(sg.t0), x0: qf(sg.x0), t1: qf(sg.t1), x1: qf(sg.x1) }; }
  /** Dạng hiển thị cho bàn (số thực, chuỗi chính xác). */
  function viewOf(d, r) {
    if (!r.ok) return { ok: false, error: r.error.msg, at: r.error.at };
    return { ok: true, T: qs(r.T), Tf: qf(r.T), Ttext: durText(r.T), arrivals: r.arrivals.map(function (a) { return { q: qs(a), f: qf(a), text: durText(a) }; }),
      segs: r.segs.map(numSeg), events: r.events.map(function (e) { return { idx: e.idx, bike: e.bike, t: qf(e.t), x: qf(e.x), text: e.text }; }),
      bikes: r.bikes.map(function (b) { return { x: qf(b.x), xq: qs(b.x), t: qf(b.t), tText: durText(b.t), riders: b.riders.slice(), parked: b.parked, used: b.used }; }),
      persons: r.persons.map(function (q) { return { mode: q.mode, x0: qf(q.x0), t0: qf(q.t0) }; }) };
  }
  /** Vị trí (số thực) mà người p đang ở lúc thời điểm tf nếu đang đi bộ từ lần xuống xe — cho bàn gợi ý "ai còn đi bộ ở phía sau xe". */
  function walkersBehind(d, r, bike) {
    if (!r.ok) return [];
    var B = r.bikes[bike], out = [];
    r.persons.forEach(function (q, i) {
      var used = r.bikes.some(function (b) { return b.riders.indexOf(i) >= 0; });
      if (used) return;
      var tq = qcmp(B.t, q.t0) >= 0 ? B.t : null;
      out.push({ id: i, mode: q.mode, behind: tq ? qcmp(qadd(q.x0, qsub(tq, q.t0)), B.x) <= 0 : false });
    });
    return out;
  }

  // ================================================================================================= đề: dựng, kiểm, điểm
  function dataOk(d) {
    return !!d && typeof d === "object" && (d.interp === "A" || d.interp === "B") && isInt(d.n, 1, MAX_N) && isInt(d.k, 1, MAX_K) && isInt(d.mu, 2, 200) && isInt(d.mv, 1, 10) && d.mu > d.mv && igcd(d.mu, d.mv) === 1 &&
      isInt(d.G, 1, MAX_GRID) && typeof d.best === "string" && !!qparse(d.best) && typeof d.known === "string" && !!qparse(d.known) && typeof d.exact === "boolean";
  }
  function scoreTenths(d, cmds, nFam) {
    var relay = regimeOf(d) === "tiep-suc" || (nFam === 1 && d.fam === "tiep-suc") ? 1 : 0;
    var s = 6 + 3 * cmds + 14 * (d.k - 1) + 6 * relay + 5 * (d.mu === 3 * d.mv && nFam > 1 ? 1 : 0) + 5 * (d.mv > 1 ? 1 : 0) - 2 * (d.interp === "B" ? 1 : 0) + (d.exact ? 0 : 10);
    return Math.max(1, Math.min(100, s));
  }
  function scoreOf(d) { return scoreTenths(d, d.cmds || 0, d.nFam || 1) / 10; }
  /** Dựng data đầy đủ + lời giải (lịch tốt nhất biết). → { d, sol:{v}, fam } hoặc { error }. */
  function dataFor(interp, n, k, mu, mv) {
    var d = { interp: interp, n: n, k: k, mu: mu, mv: mv, G: 1, best: "1", known: "1", exact: false, regime: "", fam: "", cmds: 0, nFam: 1 };
    d.regime = regimeOf(d); d.exact = exactOf(d);
    var lb = lbOf(d), fs = famsOf(d), bestFam = null, bestT = null;
    if (!fs.G || !fs.fams.length) return { error: "Không dựng được lịch mẫu cho đề này (lưới quá mịn)." };
    d.G = fs.G;
    fs.fams.forEach(function (f) {
      if (f.recs.length > CAP) return;
      var r = simulate(d, f.recs);
      if (!r.ok) return;
      if (!bestFam || qcmp(r.T, bestT) < 0) { bestFam = f; bestT = r.T; }
    });
    if (!bestFam) return { error: "Lịch mẫu vượt " + CAP + " lệnh hoặc không chạy được." };
    d.fam = bestFam.id; d.known = qs(bestT); d.cmds = bestFam.recs.length; d.nFam = fs.fams.filter(function (f) { return f.recs.length <= CAP; }).length;
    d.best = d.exact ? qs(lb) : qs(lb);
    if (d.exact && qcmp(bestT, lb) !== 0) return { error: "Nội bộ: lịch mẫu (" + qs(bestT) + ") không đạt cận LP (" + qs(lb) + ")." };
    if (!d.exact && qcmp(bestT, lb) < 0) return { error: "Nội bộ: lịch mẫu thấp hơn cận LP." };
    var v = plan.build(LAYOUT, bestFam.recs, 1, []);
    if (!v) return { error: "Lịch mẫu không vừa dung lượng." };
    return { d: d, sol: { v: v }, fam: bestFam, fams: fs.fams };
  }
  function buildPuzzle(seed, sizeId, interp, n, k, mu, mv, tier) {
    var r = dataFor(interp, n, k, mu, mv);
    if (r.error) return null;
    var d = r.d, p = { v: 1, type: "motorbike", seed: seed, sizeId: sizeId, size: { n: n, k: k }, tier: tier, score: scoreOf(d), data: d, initial: { v: plan.empty(LAYOUT) }, solution: r.sol, meta: {} };
    if (tier !== "custom") p.tier = P.util.tierOfScore(p.score).id;
    p.id = P.util.puzzleId(p);
    return p;
  }

  var poolMemo = {};
  /** Hồ chứa đề SINH được (chỉ đề biết tối ưu chính xác, n > 2k / n > k, m ∈ {2, 5/2, 3, 4, 5, 6, 8}) kèm điểm. */
  function pool(interp) {
    if (poolMemo[interp]) return poolMemo[interp];
    var out = [], ms = [[2, 1], [5, 2], [3, 1], [4, 1], [5, 1], [6, 1], [8, 1]], k, n, mi;
    for (k = 1; k <= 3; k++) for (n = (interp === "B" ? k + 1 : 2 * k + 1); n <= MAX_N; n++) for (mi = 0; mi < ms.length; mi++) {
      var d = { interp: interp, n: n, k: k, mu: ms[mi][0], mv: ms[mi][1] };
      if (!exactOf(d)) continue;
      d.regime = regimeOf(d); d.exact = true;
      var fs = famsOf(d); if (!fs.G || !fs.fams.length) continue;
      var cmds = Math.min.apply(null, fs.fams.filter(function (f) { return f.recs.length <= CAP; }).map(function (f) { return f.recs.length; }));
      if (!isFinite(cmds)) continue;
      var d2 = { interp: interp, n: n, k: k, mu: d.mu, mv: d.mv, exact: true, cmds: cmds, nFam: fs.fams.length, fam: fs.fams[0].id };
      out.push({ n: n, k: k, mu: d.mu, mv: d.mv, score: scoreOf(Object.assign(d2, { fam: fs.fams.length === 1 ? fs.fams[0].id : "" })) });
    }
    poolMemo[interp] = out;
    return out;
  }

  // ================================================================================================= action → bản ghi
  function recFromCmd(a) {
    var op = typeof a.op === "string" ? (own(OPNAME, a.op) ? OPNAME[a.op] : 0) : a.op;
    if (!isInt(a.bike, 1, MAX_K) || !isInt(op, 1, 4) || !isInt(a.a, 0, 100000)) return null;
    var b = a.b == null ? 0 : a.b;
    return isInt(b, 0, 100000) ? [a.bike, op, a.a, b] : null;
  }
  /** → {recs, label} | {error} | null (action lạ). */
  function resolve(p, s, a) {
    if (!a || typeof a !== "object") return null;
    if (a.k === "cmd") { var r = recFromCmd(a); return r ? { recs: [r], label: labelOf(p.data, r) } : null; }
    if (a.k === "steps") {
      if (!Array.isArray(a.recs) || !a.recs.length || a.recs.length > CAP) return null;
      for (var i = 0; i < a.recs.length; i++) { var q = a.recs[i]; if (!Array.isArray(q) || q.length !== W || !q.every(function (v) { return isInt(v, 0, 100000); })) return null; }
      return { recs: a.recs.map(function (q) { return q.slice(); }), label: "Gợi ý: " + a.recs.length + " lệnh" };
    }
    if (a.k === "abandon") {
      if (!isInt(a.bike, 1, p.data.k)) return null;
      var cur = simOf(p, s);
      if (!cur.ok) return { error: "Kế hoạch hiện tại không hợp lệ: " + cur.error.msg };
      var rs = cur.bikes[a.bike - 1].riders;
      if (!rs.length) return { error: "Xe " + a.bike + " không có ai trên xe để bỏ." };
      if (p.data.interp === "B") return { error: "Xe ôm: bỏ xe không có nghĩa (tài xế đi cùng xe)." };
      return { recs: rs.map(function (q) { return [a.bike, OP_OFF, q + 1, 0]; }), label: "Xe " + a.bike + ": bỏ xe tại chỗ" };
    }
    return null;
  }
  function moveFor(p, s, a) {
    if (!a || typeof a !== "object" || !dataOk(p.data)) return null;
    if (a.k === "truncate") return plan.truncateDiff(s, LAYOUT, a.n);
    if (a.k === "submit") return plan.count(s) >= 1 ? plan.submitDiff(s, LAYOUT, [], "Nộp kế hoạch") : null;
    if (plan.isSubmitted(s)) return null;
    var rs = resolve(p, s, a);
    if (!rs || rs.error) return null;
    var all = recsOf(s).concat(rs.recs);
    if (all.length > CAP || !simulate(p.data, all).ok) return null;
    return plan.appendDiff(s, LAYOUT, rs.recs, rs.label);
  }
  /** Xem trước cho bàn: {ok, error, after:{T, Ttext, event, count}}. Không đổi state. */
  function preview(p, s, a) {
    var cur = simOf(p, s);
    if (!cur.ok) return { ok: false, error: "Kế hoạch hiện tại không hợp lệ: " + cur.error.msg };
    if (plan.isSubmitted(s)) return { ok: false, error: "Đã nộp — hãy mở lại kế hoạch để sửa." };
    var rs = resolve(p, s, a);
    if (!rs) return { ok: false, error: "Lệnh không hợp lệ." };
    if (rs.error) return { ok: false, error: rs.error };
    var n0 = plan.count(s), all = recsOf(s).concat(rs.recs);
    if (all.length > CAP) return { ok: false, error: "Kế hoạch tối đa " + CAP + " lệnh." };
    var r = simulate(p.data, all);
    if (!r.ok) return { ok: false, error: r.error.msg };
    var last = n0 + rs.recs.length - 1, evs = r.events.filter(function (e) { return e.idx >= n0 && e.idx <= last; });
    return { ok: true, error: null, recs: rs.recs, after: { T: qs(r.T), Ttext: durText(r.T), event: evs.map(function (e) { return e.text; }).join(" "), count: all.length } };
  }
  function check(p, s) {
    var n = plan.count(s), r = simOf(p, s);
    return { solved: plan.isSubmitted(s) && r.ok && n >= 1, conflicts: [], filled: n, total: p.solution ? plan.count({ v: p.solution.v }) : 0, complete: r.ok && n >= 1 };
  }
  function grade(p, s) {
    var d = p.data, r = simOf(p, s), best = qparse(d.best), known = qparse(d.known), g;
    if (!r.ok) { g = G.fromRatio(null, qf(best), "min"); g.text = "Kế hoạch chưa hợp lệ"; g.valueText = "—"; g.bestText = durText(best); return g; }
    var opt = qcmp(r.T, best) <= 0;
    g = G.fromRatio(opt ? qf(best) : qf(r.T), qf(best), "min");
    if (!opt && g.quality >= 1) { g.quality = 0.999; g.stars = G.starsFor(0.999); }
    g.valueText = durText(r.T); g.bestText = durText(best);
    if (!plan.isSubmitted(s)) { g.stars = 0; g.text = "Chưa nộp kế hoạch"; return g; }
    if (d.exact) g.text = opt ? "Tối ưu! Người cuối tới B sau " + durText(r.T) + " — không lịch nào nhanh hơn." : "Đạt " + Math.floor(g.quality * 100) + " % mức tối ưu (" + durText(r.T) + " so với " + durText(best) + ").";
    else g.text = "Chấm so với cận dưới LP (" + durText(best) + "), chưa biết tối ưu chính xác — lịch tốt nhất app biết: " + durText(known) + ". Đạt " + Math.floor(g.quality * 100) + " %.";
    return g;
  }

  // ================================================================================================= mô tả + giải thích
  function pn(x) { return "P" + x; }
  function recText(d, r) {
    var xe = "Xe " + r[0] + " · ";
    if (r[1] === OP_TAKE) return xe + (d.interp === "B" ? "nhận khách " + pn(r[2]) : r[3] ? "lấy xe: " + pn(r[2]) + " lái + " + pn(r[3]) + " ngồi sau" : "lấy xe: " + pn(r[2]) + " lái một mình");
    if (r[1] === OP_RIDE) return xe + "chở tới " + gridText(r[2], d.G);
    if (r[1] === OP_MEET) return xe + "quay lại đón " + pn(r[2]);
    if (r[1] === OP_OFF) return xe + pn(r[2]) + " xuống đi bộ";
    return xe + "lệnh lạ";
  }
  function labelOf(d, r) { return recText(d, r).replace(/^Xe \d+ · /, function (m) { return m; }); }

  // ================================================================================================= gợi ý: khớp tiền tố với lịch mẫu, bất biến đổi tên người / xe
  function bikeQueues(recs, k) { var q = []; for (var b = 0; b < k; b++) q.push([]); recs.forEach(function (r, i) { if (r[0] >= 1 && r[0] <= k) q[r[0] - 1].push({ rec: r, i: i }); }); return q; }
  function refQueues(f, k) { return bikeQueues(f.recs, k).map(function (qq) { return qq.map(function (e) { return e.rec; }); }); }
  /** So khớp một hàng lệnh của người chơi với hàng lệnh mẫu bằng ánh xạ người ↔ vai (hai chiều); trả số lệnh khớp liên tiếp từ đầu. pm/rm bị cập nhật (bản sao do bên gọi lo). */
  function matchQueue(pq, rq, pm, rm) {
    var cnt = 0;
    function bind(pp, rr) {
      if (pp === 0 || rr === 0) return pp === rr;
      if (own(pm, pp)) return pm[pp] === rr;
      if (own(rm, rr)) return false;
      pm[pp] = rr; rm[rr] = pp; return true;
    }
    for (var i = 0; i < pq.length && i < rq.length; i++) {
      var a = pq[i].rec, b = rq[i];
      if (a[1] !== b[1]) break;
      var ok = true;
      if (a[1] === OP_RIDE) ok = a[2] === b[2];
      else if (a[1] === OP_TAKE) ok = bind(a[2], b[2]) && bind(a[3], b[3]);
      else ok = bind(a[2], b[2]);
      if (!ok) break;
      cnt++;
    }
    return cnt;
  }
  function perms(arr) { if (arr.length <= 1) return [arr.slice()]; var out = []; arr.forEach(function (x, i) { perms(arr.slice(0, i).concat(arr.slice(i + 1))).forEach(function (r) { out.push([x].concat(r)); }); }); return out; }
  /** Khớp kế hoạch recs với một lịch mẫu f: { matched:[bool], bad (chỉ số bản ghi đầu tiên không khớp, −1 nếu hết), bikeMap:{playerBike: refBike}, pm, rm, total (số lệnh khớp), refDone:[số lệnh mẫu đã khớp] }. */
  function matchFam(d, recs, f) {
    var k = d.k, pq = bikeQueues(recs, k), rq = refQueues(f, k), used = [], b, best = null;
    for (b = 0; b < k; b++) if (pq[b].length) used.push(b);
    var refs = []; for (b = 0; b < k; b++) refs.push(b);
    perms(refs).forEach(function (pr) {
      var tot = 0; used.forEach(function (pb, j) { tot += matchQueue(pq[pb], rq[pr[j]], {}, {}); });
      if (!best || tot > best.tot) best = { tot: tot, pr: pr };
    });
    var pm = {}, rm = {}, matched = recs.map(function () { return false; }), bikeMap = {}, total = 0, refDone = rq.map(function () { return 0; });
    if (best) used.forEach(function (pb, j) {
      var rb = best.pr[j], c = matchQueue(pq[pb], rq[rb], pm, rm);
      bikeMap[pb] = rb; refDone[rb] = c; total += c;
      for (var i = 0; i < c; i++) matched[pq[pb][i].i] = true;
    });
    var bad = -1; for (var i = 0; i < matched.length; i++) if (!matched[i]) { bad = i; break; }
    return { matched: matched, bad: bad, bikeMap: bikeMap, pm: pm, rm: rm, total: total, refDone: refDone, rq: rq };
  }
  /** Lệnh kế tiếp của lịch mẫu f theo cách đặt tên của người chơi (xe chưa dùng → xe trống thấp nhất; vai chưa gán → người chưa dùng thấp nhất). null nếu lịch mẫu đã hết. */
  function nextRef(d, recs, f, mt) {
    var k = d.k, rb = -1, i;
    for (i = 0; i < k; i++) if (mt.refDone[i] < mt.rq[i].length) { if (rb < 0 || mt.refDone[i] > mt.refDone[rb]) rb = i; }
    if (rb < 0) return null;
    var pb = -1, key;
    for (key in mt.bikeMap) if (own(mt.bikeMap, key) && mt.bikeMap[key] === rb) pb = Number(key);
    if (pb < 0) {
      var usedBikes = {}; recs.forEach(function (r) { usedBikes[r[0] - 1] = 1; });
      for (i = 0; i < k; i++) if (!usedBikes[i]) { pb = i; break; }
      if (pb < 0) return null;
    }
    var ref = mt.rq[rb][mt.refDone[rb]], usedP = {}; recs.forEach(function (r) { if (r[1] === OP_TAKE) { usedP[r[2]] = 1; if (r[3]) usedP[r[3]] = 1; } else if (r[1] === OP_MEET || r[1] === OP_OFF) usedP[r[2]] = 1; });
    var rm = Object.assign({}, mt.rm);
    function person(rr) {
      if (rr === 0) return 0;
      if (own(rm, rr)) return rm[rr];
      for (var q = 1; q <= d.n; q++) if (!usedP[q]) { usedP[q] = 1; rm[rr] = q; return q; }
      return -1;
    }
    var rec;
    if (ref[1] === OP_RIDE) rec = [pb + 1, OP_RIDE, ref[2], 0];
    else if (ref[1] === OP_TAKE) { var a1 = person(ref[2]), b1 = person(ref[3]); rec = [pb + 1, OP_TAKE, a1, b1]; }
    else rec = [pb + 1, ref[1], person(ref[2]), 0];
    if (rec[2] < 0 || rec[3] < 0) return null;
    return { rec: rec, refRec: ref, refBike: rb, refIndex: mt.refDone[rb], rm: rm };
  }
  function planOfFam(f) { return f.recs; }
  function whyFor(d, rec, ctx) {
    var m = mText(d), out = [], A = d.interp !== "B", fam = ctx.fam;
    if (rec[1] === OP_TAKE) {
      if (d.interp === "B") out.push("Xe ôm " + rec[0] + " đón khách " + pn(rec[2]) + " ở A lúc 0 (tài xế ngoài nhóm nên chỉ chở được 1 khách).");
      else if (ctx.firstOnBike) out.push("Mọi xe xuất phát từ A lúc 0. Xe chở 2 người của nhóm: một lái, một ngồi sau" + (fam === "dua-don" ? " — người lái sẽ ở trên xe suốt, chạy đưa-đón liên tục." : fam === "tiep-suc" ? " — cả hai chỉ đi xe một quãng rồi bỏ xe lại cho cặp sau." : "."));
      else out.push("Cặp sau đi bộ từ A tới chỗ xe bị bỏ lại; tới nơi thì nhặt xe lên đi tiếp (xe luôn chở đủ 2 người).");
    } else if (rec[1] === OP_RIDE) {
      if (rec[2] === d.G) out.push("Chở tới B: những người còn trên xe tới B cùng lúc với người đi bộ cuối — mọi người cùng về đích đúng lúc " + (ctx.best ? durText(ctx.best) : "T*") + ".");
      else if (fam === "tiep-suc") out.push("Mỗi cặp đi xe cùng một quãng d = 2k/n = " + gridText(rec[2] - (ctx.prevPos || 0), d.G).replace(" quãng", "") + " của AB rồi xuống đi bộ: ai cũng đi xe quãng bằng nhau thì tới B cùng lúc, và xe luôn chở đủ 2 người.");
      else out.push("Thả khách ở " + gridText(rec[2], d.G) + ": mọi người đi xe cùng một quãng x = (m+1)/(m+2g−1) (m = " + m + ", g = số khách mỗi xe) rồi đi bộ phần còn lại ⇒ tất cả tới B cùng lúc, xe chạy liên tục không nghỉ.");
    } else if (rec[1] === OP_MEET) out.push("Xe quay lại gặp " + pn(rec[2]) + " (đang đi bộ ở phía sau): xe lùi với tốc độ m = " + m + ", người đi bộ tiến với tốc độ 1 ⇒ hai bên lại gần nhau với tốc độ m + 1; đón lên rồi chở tiếp.");
    else if (rec[1] === OP_OFF) out.push(pn(rec[2]) + " xuống xe và đi bộ phần còn lại" + (fam === "tiep-suc" ? "; cả hai người cùng cặp xuống thì xe được bỏ lại bên đường cho cặp sau nhặt." : " — người lái ở lại trên xe để quay đi đón người kế."));
    return out;
  }
  function mkHint(level, tech, text, why, cells, regions, action) { return { level: level, technique: tech, text: text, why: why || [], cells: cells || [], regions: regions || {}, action: action || null }; }
  function strategyText(d, fam) {
    var m = mText(d);
    if (d.interp === "B") return "Xe ôm: mỗi xe chở lần lượt từng khách — ai cũng đi xe cùng một quãng rồi đi bộ nốt, và xe quay lại đón người kế (tài xế không cần tới B).";
    if (fam === "chi-can") return "Đủ chỗ cho mọi người (n ≤ 2k): xe nào cũng chở đủ 2 người đi thẳng một mạch tới B.";
    if (fam === "dua-don") return "m = " + m + " > 3: xe nhanh nên đưa-đón thắng bỏ xe — một người lái chạy liên tục, chở lần lượt từng người một đoạn, rồi quay lại đón người kế.";
    if (fam === "tiep-suc") return "m = " + m + " < 3: xe không đủ nhanh để quay lại đón — bỏ xe thắng: xe chỉ đi tới, luôn chở đủ 2 người, mỗi cặp đi xe một đoạn rồi bỏ xe lại cho cặp sau.";
    return "m = 3 đúng ngưỡng: đưa-đón và tiếp sức cho cùng một thời gian — chọn một trong hai.";
  }
  function hint(p, s, level) {
    var d = p.data, recs = recsOf(s), best = qparse(d.best), known = qparse(d.known);
    if (plan.isSubmitted(s)) return { level: level, text: "Đã nộp kế hoạch.", why: [], cells: [], none: true };
    var r = simulate(d, recs);
    if (!r.ok) return { level: level, text: "Kế hoạch hiện tại không hợp lệ.", why: [], cells: [], none: true };
    // ---- 1. đã đạt giá trị tối ưu (hoặc tốt bằng lịch biết) → nộp
    if (recs.length >= 1 && qcmp(r.T, known) <= 0) {
      return mkHint(level, "Nộp", level === 1 ? "Kế hoạch hiện tại đã đạt mức " + (d.exact ? "tối ưu" : "tốt nhất app biết") + " — hãy nộp." : "Người cuối tới B lúc " + durText(r.T) + (d.exact ? " = mức tối ưu" : " = lịch tốt nhất app biết") + ": nộp kế hoạch.",
        level === 3 ? [d.exact ? "Không lịch nào nhanh hơn: cận dưới LP cũng bằng " + hoursText(best) + "." : "Cận dưới LP là " + hoursText(best) + " nhưng app chưa biết lịch nào đạt được nó."] : [], [], {}, level === 3 ? { k: "submit" } : null);
    }
    var fs = famsOf(d).fams.filter(function (f) { return f.recs.length <= CAP; }), bestM = null, bestF = null;
    fs.forEach(function (f) { var mt = matchFam(d, recs, f); if (!bestM || mt.total > bestM.total) { bestM = mt; bestF = f; } });
    if (!bestF) return { level: level, text: "Không còn gợi ý.", why: [], cells: [], none: true };
    // ---- 2. rẽ khỏi lịch mẫu → quay về
    if (bestM.bad >= 0) {
      var j = bestM.bad, bad = recs[j];
      return mkHint(level, "Hoàn tác", level === 1 ? "Kế hoạch đã rẽ khỏi lịch tối ưu — từ một lệnh trước đó, chưa chắc còn đạt được mức tối ưu." : level === 2 ? "Lệnh " + (j + 1) + " (" + recText(d, bad) + ") là lệnh đầu tiên khác lịch tối ưu." : "Quay về trước lệnh " + (j + 1) + ".",
        level === 3 ? ["Lịch mẫu theo hướng \"" + bestF.name + "\": " + strategyText(d, bestF.id), "Lệnh " + (j + 1) + " (" + recText(d, bad) + ") không nằm trong lịch này — từ đó trở đi chưa chắc tới được " + durText(best) + ".", "Một lịch tối ưu khác dạng vẫn được điểm cao khi nộp, nhưng gợi ý chỉ theo lịch mẫu."] : [],
        [j], bad[1] === OP_RIDE ? { positions: [bad[2] / d.G] } : {}, level === 3 ? { k: "truncate", n: j } : null);
    }
    // ---- 3. còn đúng lịch mẫu → lệnh kế tiếp
    var nx = nextRef(d, recs, bestF, bestM);
    if (!nx) return mkHint(level, "Nộp", "Lịch mẫu đã hết lệnh — hãy nộp.", [], [], {}, level === 3 ? { k: "submit" } : null);
    var rec = nx.rec, firstOnBike = !recs.some(function (q) { return q[0] === rec[0]; }), prevPos = 0;
    var prevRide = null; for (var q = nx.refIndex - 1; q >= 0; q--) if (nx.refBike >= 0 && bestM.rq[nx.refBike][q][1] === OP_RIDE) { prevRide = bestM.rq[nx.refBike][q][2]; break; }
    prevPos = prevRide || 0;
    var ctx = { fam: bestF.id, firstOnBike: firstOnBike, best: best, prevPos: prevPos }, why = whyFor(d, rec, ctx), pv = preview(p, s, { k: "cmd", bike: rec[0], op: rec[1], a: rec[2], b: rec[3] });
    var evText = pv.ok && pv.after.event ? pv.after.event : "";
    var lvl2 = rec[1] === OP_RIDE ? (rec[2] === d.G ? "Xe " + rec[0] + " chở tới B." : "Chở tới " + gridText(rec[2], d.G) + " (xe " + rec[0] + ").") : recText(d, rec) + ".";
    var tech = bestF.id === "tiep-suc" ? "Tiếp sức" : bestF.id === "chi-can" ? "Chở thẳng" : d.interp === "B" ? "Xe ôm" : "Đưa-đón";
    return mkHint(level, tech, level === 1 ? strategyText(d, bestF.id) : level === 2 ? lvl2 : recText(d, rec) + (evText ? " — " + evText : "."), level === 3 ? why : [], level === 1 ? [] : [plan.count(s)],
      level === 1 || rec[1] !== OP_RIDE ? {} : { positions: [rec[2] / d.G] }, level === 3 ? { k: "cmd", bike: rec[0], op: ["", "take", "ride", "meet", "off"][rec[1]], a: rec[2], b: rec[3] } : null);
  }

  // ================================================================================================= lời giải từng bước, solve
  function explainRec(d, fam, recs, i) {
    var rec = recs[i], firstOnBike = !recs.slice(0, i).some(function (q) { return q[0] === rec[0]; }), prevPos = 0;
    for (var q = i - 1; q >= 0; q--) if (recs[q][0] === rec[0] && recs[q][1] === OP_RIDE) { prevPos = recs[q][2]; break; }
    return whyFor(d, rec, { fam: fam, firstOnBike: firstOnBike, best: qparse(d.best), prevPos: prevPos });
  }
  function replaySteps(p) {
    var d = p.data, sol = recsOf({ v: p.solution.v }), s = { v: plan.empty(LAYOUT), c: null }, out = [], fam = d.fam;
    sol.forEach(function (r, i) {
      var dd = plan.appendDiff(s, LAYOUT, [r], "Lệnh " + (i + 1));
      if (!dd) return;
      P.game.applyDiff(s, dd.d, false);
      var sim = simulate(d, recsOf(s)), ev = sim.ok ? sim.events.filter(function (e) { return e.idx === i && true; }).map(function (e) { return e.text; }).join(" ") : "";
      out.push({ text: "Lệnh " + (i + 1) + ": " + recText(d, r) + (ev ? " — " + ev : "."), why: explainRec(d, fam, sol, i), diff: { d: dd.d }, cells: [i], technique: REGIME_NAME[d.fam] ? d.fam === "tiep-suc" ? "Tiếp sức" : d.fam === "chi-can" ? "Chở thẳng" : d.interp === "B" ? "Xe ôm" : "Đưa-đón" : "Lịch mẫu" });
    });
    var sd = plan.submitDiff(s, LAYOUT, [], "Nộp kế hoạch"), fin = simulate(d, sol);
    if (sd) out.push({ text: "Nộp kế hoạch: người cuối tới B lúc " + (fin.ok ? durText(fin.T) : "—") + (d.exact ? " — mức tối ưu." : " — lịch tốt nhất app biết."), why: [d.exact ? "Mọi người tới B cùng lúc " + hoursText(qparse(d.best)) + " và cận dưới LP cũng bằng giá trị đó, nên không thể nhanh hơn." : "Cận dưới LP là " + hoursText(qparse(d.best)) + " nhưng chưa biết lịch nào đạt được nó."], diff: { d: sd.d }, cells: [], technique: "Nộp" });
    return out;
  }
  function inputOf(d) { return { interp: d.interp, n: d.n, k: d.k, m: mText(d) }; }

  // ================================================================================================= đề tự nhập / I-O
  function fail(errors, extra) { return Object.assign({ ok: false, errors: errors, warnings: [], status: "none", count: 0 }, extra || {}); }
  function num(x) { return typeof x === "string" && /^\s*\d+\s*$/.test(x) ? Number(x) : x; }
  function fromInputAt(inp, seed) {
    if (!inp || typeof inp !== "object") return fail(["Thiếu dữ liệu đề."]);
    var errs = [], interp = inp.interp === "B" ? "B" : inp.interp === "A" || inp.interp == null ? "A" : null, n = num(inp.n), k = num(inp.k), m = parseM(inp.m);
    if (!interp) errs.push("Cách hiểu phải là 'A' (người trong nhóm lái) hoặc 'B' (xe ôm).");
    if (!isInt(n, 1, MAX_N)) errs.push("Số người (n) phải là số nguyên 1–" + MAX_N + ".");
    if (!isInt(k, 1, MAX_K)) errs.push("Số xe (k) phải là số nguyên 1–" + MAX_K + ".");
    if (!m) errs.push("Tốc độ xe gấp m lần đi bộ: m > 1, dạng \"5\", \"5/2\" hoặc \"2,5\" (m ≤ 20, mẫu ≤ 10).");
    if (errs.length) return fail(errs);
    var p = buildPuzzle(seed, "tu-nhap", interp, n, k, m.mu, m.mv, "custom");
    if (!p) return fail(["Không dựng được lịch mẫu cho đề này (quá nhiều lệnh hoặc lưới quá mịn)."]);
    var d = p.data, warns = [], best = qparse(d.best), known = qparse(d.known);
    if (interp === "A" ? n <= 2 * k : n <= k) warns.push("Đủ chỗ cho mọi người trên xe: bài tầm thường — ai cũng ngồi xe thẳng tới B, T = 1/m.");
    if (!d.exact) warns.push("Chưa biết tối ưu chính xác: cận dưới LP là " + hoursText(best) + " (" + durText(best) + ") nhưng lịch tốt nhất app biết là " + hoursText(known) + " (" + durText(known) + "). Đề vẫn chơi được, chấm so với cận dưới LP.");
    if (n >= 8 && interp === "A") warns.push("Nhiều người: kế hoạch dài (" + d.cmds + " lệnh trong lịch mẫu).");
    return { ok: true, puzzle: p, errors: [], warnings: warns, status: d.exact ? "unique" : "multiple", count: d.exact ? 1 : 0, statusKind: d.exact ? "ok" : "warn",
      statusText: d.exact ? "✓ Tối ưu chính xác: " + hoursText(best) + " (" + durText(best) + ") — " + REGIME_NAME[d.regime] : "⚠ Chưa biết tối ưu chính xác — cận dưới LP " + hoursText(best) + " (" + durText(best) + "), lịch tốt nhất biết " + hoursText(known) + " (" + durText(known) + ")" };
  }
  function fromInput(inp) { return fromInputAt(inp, null); }
  function ascii(s) { return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim(); }
  function parseText(text) {
    var t = ascii(text == null ? "" : text), interp = /xeom|xe om|\bb\b/.test(t) ? "B" : "A", m = {}, re = /\b([nkm])\s*[=:]\s*([0-9]+(?:[.,][0-9]+)?(?:\s*\/\s*[0-9]+)?)/g, q;
    while ((q = re.exec(t)) !== null) if (m[q[1]] === undefined) m[q[1]] = q[2].replace(/\s+/g, "");
    if (m.n === undefined || m.k === undefined || m.m === undefined) return { err: "Thiếu n, k hoặc m: ví dụ 'motorbike nhom n=4 k=1 m=5'." };
    return { inp: { interp: interp, n: Number(m.n), k: Number(m.k), m: m.m } };
  }
  function toText(p) { var d = p.data; return "motorbike " + (d.interp === "B" ? "xeom" : "nhom") + " n=" + d.n + " k=" + d.k + " m=" + mText(d); }
  function fromText(text) { var r = parseText(text); return r.err ? { ok: false, errors: [r.err], warnings: [] } : fromInput(r.inp); }
  function planText(p) {
    try { return recsOf({ v: p.solution.v }).map(function (r) { return r[0] + "." + ["", "T", "R", "M", "X"][r[1]] + (r[1] === OP_TAKE ? r[2] + (r[3] ? "+" + r[3] : "") : r[1] === OP_RIDE ? r[2] + "/" + p.data.G : r[2]); }).join(" "); } catch (e) { return ""; }
  }
  function toFile(p) { var d = p.data; return { type: "motorbike", seed: p.seed, difficulty: p.score, size: p.size, initialState: "interp=" + d.interp + ";n=" + d.n + ";k=" + d.k + ";m=" + mText(d), solution: planText(p), metadata: p.meta || {} }; }
  function fromFile(o) {
    if (!o || typeof o !== "object" || typeof o.initialState !== "string") return { ok: false, errors: ["Thiếu initialState (dạng interp=A;n=…;k=…;m=…)."], warnings: [] };
    var m = {}; o.initialState.split(";").forEach(function (kv) { var i = kv.indexOf("="); if (i > 0) m[kv.slice(0, i).trim()] = kv.slice(i + 1).trim(); });
    var r = fromInput({ interp: m.interp, n: m.n === undefined ? NaN : Number(m.n), k: m.k === undefined ? NaN : Number(m.k), m: m.m });
    if (r.ok && o.metadata && typeof o.metadata === "object" && typeof o.metadata.name === "string") r.puzzle.meta = { name: o.metadata.name.slice(0, 80) };
    return r;
  }

  // ================================================================================================= Constraint View, trace
  function constraintView(p) {
    var d = p.data, A = d.interp !== "B", best = qparse(d.best), known = qparse(d.known), m = mText(d), c = d.k + "/" + d.n;
    var vars = [{ name: "r — km đi xe CHIỀU TỚI của mỗi người (trung bình)", domain: "[0, 1]" }, { name: "s — km đi xe CHIỀU LÙI của mỗi người (trung bình)", domain: "[0, 1]" },
      { name: "F_b, K_b — km tới / km lùi của xe b", domain: "[0, mT]", count: d.k }, { name: "T — thời điểm người cuối tới B", domain: "[1/m, 1]" }];
    var cons = ["(1) mỗi người: 1 − r + s + (r + s)/m ≤ T  (đi bộ ≥ 1 − r + s)",
      "(2) ghế chiều tới: n·r ≤ " + (A ? "2" : "1") + "·k·F",
      A ? "(3) km lùi của xe cần một người TRONG nhóm lái: n·s ≥ k·K" : "(3) bỏ — tài xế xe ôm ở ngoài nhóm nên không tốn người của nhóm",
      "(4) F − K ≤ 1  (xe đi tới ròng không quá 1 quãng)", "(5) F + K ≤ m·T  (xe chạy tối đa mT km trong thời gian T)", "(6) r − s ≤ 1, mọi biến ≥ 0"];
    var items = [d.exact ? "Cận LP = " + hoursText(best) + " = " + durText(best) + ", và có lịch mẫu đạt đúng giá trị đó ⇒ đó là TỐI ƯU." : "Cận LP = " + hoursText(best) + " = " + durText(best) + " nhưng lịch tốt nhất app biết là " + hoursText(known) + " (" + durText(known) + ") — chưa biết tối ưu chính xác.",
      "Chế độ: " + REGIME_NAME[d.regime] + ".", "Chặt: (1) mọi người tới cùng lúc và (5) xe chạy liên tục không nghỉ."];
    var f = [];
    if (d.interp === "A" && d.n > 2 * d.k) f.push("A, m " + (d.mu > 3 * d.mv ? "> 3" : d.mu < 3 * d.mv ? "< 3" : "= 3") + ": " + (d.mu >= 3 * d.mv ? "T* = T_dd(n/k − 1) = (m(2g−1)+1)/(m(m+2g−1)), g = n/k − 1" : "T* = 1 − (2k/n)(1 − 1/m)") + (d.mu === 3 * d.mv ? " (hai công thức bằng nhau)" : ""));
    if (d.interp === "B" && d.n > d.k) f.push("Xe ôm: T* = T_dd(n/k) với g = n/k khách mỗi xe.");
    var secs = [{ title: "Quy hoạch tuyến tính (cận dưới)", note: "Lấy trung bình mọi lịch hợp lệ cho một điểm thoả các ràng buộc tuyến tính, nên T của MỌI lịch ≥ nghiệm tối ưu của LP.", items: items }];
    if (f.length) secs.push({ title: "Dạng đóng", items: f });
    return { summary: d.n + " người, " + d.k + " xe (" + (A ? "2 chỗ, người trong nhóm lái" : "xe ôm, 1 khách") + "), xe nhanh gấp " + m + ", đi bộ cả quãng mất 60 phút", variables: vars, constraints: cons, counts: { variables: vars.length, constraints: cons.length, "xe": d.k, "người": d.n }, sections: secs, note: c };
  }
  function trace(p) {
    var d = p.data, sol = recsOf({ v: p.solution.v }), r = simulate(d, sol), head = ["Bước", "Xe", "Lúc", "Vị trí", "Sự kiện"], rows = [head], steps = [];
    if (!r.ok) return { kind: "matrix", title: "Bảng sự kiện", steps: [], note: "" };
    r.events.slice(0, 60).forEach(function (e, i) {
      rows = rows.concat([[i + 1, e.bike + 1, durText(e.t), posText(e.x), e.text]]);
      steps.push({ text: e.text, matrix: rows.map(function (q) { return q.slice(); }), pivot: [i + 1, 0] });
    });
    return { kind: "matrix", title: "Bảng sự kiện của lịch " + (d.exact ? "tối ưu" : "tốt nhất biết") + " (theo thời gian xử lý)", steps: steps, note: "Mỗi hàng là một sự kiện của lịch mẫu; mọi người tới B cùng lúc " + durText(r.T) + " khi lịch đưa-đón/tiếp sức đạt tối ưu." };
  }

  // ================================================================================================= đăng ký
  var SIZES = [{ id: "std", label: "Tiêu chuẩn (n người, k xe, xe nhanh gấp m)", params: {}, default: true }];
  var def = {
    id: "motorbike", name: "Đi bộ & xe máy", family: "Mathematical Puzzle", category: "Tối ưu (LP)", icon: "🛵",
    blurb: "n người đi bộ từ A tới B, k xe máy chở thêm một người — xe quay lại đón và bỏ xe bên đường: người cuối cùng tới B càng sớm càng tốt.",
    rules: [
      "n người cùng xuất phát từ A, phải tới B; đi bộ cả quãng mất đúng 1 giờ. Có k xe máy ở A, tốc độ gấp m lần đi bộ.",
      "Cách hiểu A (mặc định): ai cũng lái được; mỗi xe chở 2 người của nhóm (người lái + người ngồi sau); người lái cũng phải tới B. Xe được quay lại đón người và BỎ XE bên đường — người đi sau nhặt xe lên đi tiếp. Cách hiểu B (\"xe ôm\"): mỗi xe có tài xế ngoài nhóm, chở 1 người, tài xế không cần tới B.",
      "Bạn xếp KẾ HOẠCH cho từng xe bằng các lệnh: LẤY XE (ai lái, ai ngồi sau) · CHỞ TỚI một vị trí trên quãng AB · ĐÓN một người đang đi bộ (xe chạy tới gặp: đuổi theo nếu người đó ở phía trước, quay lại nếu ở phía sau) · XUỐNG (một người xuống đi bộ; mọi người xuống hết = bỏ xe). Người rảnh luôn đi bộ về B.",
      "Giá trị = thời điểm người CUỐI CÙNG tới B (tính chính xác bằng phân số, không sai số). Nộp kế hoạch: ván kết thúc và được chấm so với mức tối ưu (100 % = \"Tối ưu!\"). Hoàn tác được; loại này không đếm lỗi.",
      "Đề không chia hết (vd 5 người, 1 xe, m = 2) chưa biết tối ưu chính xác: vẫn chơi được, chấm so với cận dưới LP và sẽ không bao giờ báo \"Tối ưu!\"."
    ],
    sizes: SIZES.map(function (z) { return { id: z.id, label: z.label, params: z.params, default: z.default || undefined }; }),
    algorithm: {
      title: "Đưa-đón, tiếp sức và cận dưới bằng quy hoạch tuyến tính",
      steps: [
        { title: "Đưa-đón kinh điển", text: "Một xe, g khách, mỗi khách đi xe quãng x rồi đi bộ phần còn lại; xe chạy liên tục (chở tới, quay lại đón). Điểm đón tiến thêm 2x/(m+1) mỗi chu kỳ ⇒ tất cả tới B cùng lúc khi x = (m+1)/(m+2g−1), T = (m(2g−1)+1)/(m(m+2g−1))." },
        { title: "Tiếp sức bỏ xe (cách hiểu A, m < 3)", text: "Khi xe không đủ nhanh để quay lại đón, tốt hơn là chỉ đi tới và luôn chở đủ 2 người: mỗi người đi xe quãng 2k/n rồi xe bị bỏ lại cho cặp sau ⇒ T = 1 − (2k/n)(1 − 1/m)." },
        { title: "Ngưỡng m = 3", text: "Hai công thức bằng nhau tại m = 3: với m > 3 đưa-đón thắng, với m < 3 tiếp sức thắng. Đưa-đón cần k | n, tiếp sức cần 2k | n." },
        { title: "Cận dưới LP", text: "Gọi r, s là số km đi xe chiều tới / lùi của mỗi người (trung bình), F, K là số km tới / lùi của mỗi xe: thời gian mỗi người, số ghế, người lái cho quãng lùi, quãng đường của xe đều là ràng buộc TUYẾN TÍNH, nên lấy trung bình mọi lịch cho một điểm thoả LP ⇒ T ≥ T_LP. Giải LP (liệt kê đỉnh) cho đúng hai công thức trên." },
        { title: "Xe ôm và đề không chia hết", text: "Cách hiểu B bỏ ràng buộc người lái: T* = T_dd(n/k), đạt được khi k | n. Khi không chia hết app chỉ biết cận dưới LP và lịch tốt nhất đã thử (chia nhóm cân bằng) — khoảng cách có thể là một khoảng hở thật." }
      ],
      links: [{ id: "binary-search", label: "Tìm kiếm nhị phân" }, { id: "coin-change", label: "Đổi tiền (QHĐ)" }]
    },
    difficultyNote: "Điểm 0–10 = 0,6 + 0,3·(số lệnh của lịch tối ưu) + 1,4·(k−1) + 0,6·[tiếp sức] + 0,5·[m = 3 hai lịch] + 0,5·[m không nguyên] − 0,2·[xe ôm] (+1 nếu chưa biết tối ưu): Dễ 3–4 người một xe · Vừa 4–6 người hoặc 2 xe · Khó 7–8 người hoặc nhiều xe · Chuyên gia 9–12 người hoặc 3 xe.",
    kind: "optimize", objective: { sense: "min", label: "Thời điểm người cuối tới B", unit: "" },
    sizeLabel: "Phiên bản",
    moveLabel: "Số thao tác (lệnh, bỏ xe, nộp — hoàn tác không làm giảm)",
    mistakeLabel: "Sai sót (loại này không đếm lỗi — luôn 0)",
    options: [{ id: "interp", label: "Cách hiểu", choices: [
      { id: "A", label: "Người trong nhóm lái", note: "Xe chở 2 người của nhóm (lái + ngồi sau); được quay lại đón và bỏ xe bên đường cho người sau nhặt." },
      { id: "B", label: "Xe ôm", note: "Mỗi xe có tài xế ngoài nhóm, chở 1 người; tài xế không cần tới B; bỏ xe vô nghĩa." }], default: "A" }],
    sizeText: function (p) { var d = p && p.data; return d && dataOk(d) ? d.n + " người · " + d.k + " xe · xe nhanh gấp " + mText(d) + (d.interp === "B" ? " · xe ôm" : "") : ""; },

    generate: function (seed, o) {
      o = o || {};
      var sz = P.types.sizeOf(def, o.sizeId), full = P.types.optionsOf(def, o.options), interp = full.interp, tier = P.util.tier(o.tier) ? o.tier : "easy", band = P.util.tier(tier), rng = P.rng.create(seed).fork("moto");
      var pl = pool(interp), cands = pl.filter(function (q) { return q.score >= band.min && q.score < band.max; });
      if (!cands.length) { var bd = 99; pl.forEach(function (q) { var dd = Math.abs(q.score - band.target); if (dd < bd) { bd = dd; cands = [q]; } }); }
      var c = cands[rng.fork("cfg").int(cands.length)], p = buildPuzzle(seed, sz.id, interp, c.n, c.k, c.mu, c.mv, tier);
      if (!p) p = buildPuzzle(seed, sz.id, interp, 4, 1, 5, 1, tier);
      p.options = P.types.compactOptions(def, full);
      return p;
    },
    fromInput: fromInput,
    validate: function (p) {
      if (!p || !dataOk(p.data)) return { ok: false, errors: ["Đề thiếu dữ liệu."], status: "none", count: 0, solution: null };
      var r = fromInputAt(inputOf(p.data), p.seed == null ? null : p.seed);
      return { ok: r.ok, errors: r.errors, status: r.status, count: r.count, solution: r.ok ? r.puzzle.solution : null };
    },
    solve: function (p) {
      var d = p.data, sol = p.solution && p.solution.v ? { v: p.solution.v.slice() } : null;
      if (!sol) return { status: "none", count: 0, solution: null, steps: [], techniques: {}, nodes: 0 };
      var rs = recsOf(sol), sim = simulate(d, rs);
      return { status: d.exact ? "unique" : "multiple", count: d.exact ? 1 : 0, solution: sol, value: sim.ok ? qf(sim.T) : null, best: qf(qparse(d.best)), nodes: rs.length,
        steps: rs.map(function (r, i) { return { technique: d.fam === "tiep-suc" ? "Tiếp sức" : d.fam === "chi-can" ? "Chở thẳng" : "Đưa-đón", text: "Lệnh " + (i + 1) + ": " + recText(d, r) + "." }; }),
        techniques: (function () { var k = d.fam === "tiep-suc" ? "Tiếp sức" : d.fam === "chi-can" ? "Chở thẳng" : "Đưa-đón", o = {}; o[k] = rs.length; return o; })() };
    },
    difficulty: function (p) { return scoreOf(p.data); },
    newState: function (p) { return { v: p.initial.v.slice(), c: null }; },
    isGiven: function () { return false; },
    moveFor: moveFor, check: check, mistakes: function () { return 0; }, grade: grade, hint: hint,
    replay: replaySteps,
    constraintView: constraintView, trace: trace,
    toText: toText, fromText: fromText, toFile: toFile, fromFile: fromFile,
    describeCell: function (p, s, i) {
      var n = plan.count(s);
      if (!isInt(i, 0, CAP - 1)) return "Lệnh không hợp lệ";
      if (i >= n) return "Lệnh " + (i + 1) + ": chưa dùng";
      return "Lệnh " + (i + 1) + ": " + recText(p.data, plan.record(s, LAYOUT, i));
    }
  };

  /** Hàm thuần cho bàn chơi và test (không thuộc hợp đồng chung). */
  def.sim = { preview: preview, view: function (p, s) { return viewOf(p.data, simOf(p, s)); }, walkers: function (p, s, bike) { return walkersBehind(p.data, simOf(p, s), bike); } };
  def.lib = {
    CAP: CAP, W: W, MAX_N: MAX_N, MAX_K: MAX_K, OP_TAKE: OP_TAKE, OP_RIDE: OP_RIDE, OP_MEET: OP_MEET, OP_OFF: OP_OFF, LAYOUT: LAYOUT, Q: Q, qs: qs, qf: qf, qcmp: qcmp, qparse: qparse,
    parseM: parseM, mText: mText, durText: durText, hoursText: hoursText, posText: posText, gridText: gridText, tShuttle: tShuttle, tRelay: tRelay, lbOf: lbOf, exactOf: exactOf, regimeOf: regimeOf,
    famsOf: famsOf, simulate: simulate, recsOf: recsOf, simOf: simOf, viewOf: viewOf, dataFor: dataFor, scoreOf: scoreOf, pool: pool, resolve: resolve, matchFam: matchFam, nextRef: nextRef,
    recText: recText, planText: planText, fromInputAt: fromInputAt, dataOk: dataOk, REGIME_NAME: REGIME_NAME
  };

  P.types.register(def);
  if (typeof module !== "undefined" && module.exports) module.exports = def;
})(typeof globalThis !== "undefined" ? globalThis : this);
