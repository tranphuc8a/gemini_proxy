// bike.js — n người đi bộ + k xe máy (2 chỗ), tốc độ xe = m × đi bộ, quãng AB = 1 (đi bộ hết 1 giờ). Chạy: node bike.js
// Cách hiểu A (mặc định): người lái là người trong nhóm, ai cũng lái được, xe chở người lái + 1 người; được bỏ xe bên đường, người phía sau nhặt lên đi tiếp; xe quay lại đón được.
// Cách hiểu B ("xe ôm"): mỗi xe có tài xế NGOÀI nhóm, chỉ chở 1 người của nhóm; tài xế không cần tới B.
"use strict";

// ------------------------------------------------------------------ phân số BigInt
function gcd(a, b) { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { var t = a % b; a = b; b = t; } return a; }
function Q(n, d) { n = BigInt(n); d = d === undefined ? 1n : BigInt(d); if (d === 0n) throw new Error("chia 0"); if (d < 0n) { n = -n; d = -d; } var g = gcd(n, d) || 1n; return { n: n / g, d: d / g }; }
var add = function (a, b) { return Q(a.n * b.d + b.n * a.d, a.d * b.d); }, sub = function (a, b) { return Q(a.n * b.d - b.n * a.d, a.d * b.d); };
var mul = function (a, b) { return Q(a.n * b.n, a.d * b.d); }, dv = function (a, b) { return Q(a.n * b.d, a.d * b.n); };
var cmp = function (a, b) { var x = a.n * b.d - b.n * a.d; return x < 0n ? -1 : x > 0n ? 1 : 0; };
var qmax = function (a, b) { return cmp(a, b) >= 0 ? a : b; }, qmin = function (a, b) { return cmp(a, b) <= 0 ? a : b; };
function qs(a) { return a.d === 1n ? a.n.toString() : a.n + "/" + a.d; }
function qf(a) { return Number(a.n) / Number(a.d); }
var Z = Q(0), ONE = Q(1);

// ------------------------------------------------------------------ dạng đóng
/** Lịch đưa-đón kinh điển: 1 xe chở lần lượt g nhóm khách (ai cũng đi xe đoạn x, đi bộ 1−x), xe chạy liên tục. T = (m(2g−1)+1)/(m(m+2g−1)), x = (m+1)/(m+2g−1). */
function Tshuttle(g, m) { return Q(m * (2 * g - 1) + 1, m * (m + 2 * g - 1)); }      // g, m nguyên ở đây (g phân số dùng bản số thực bên dưới)
function TshuttleR(g, m) { return (m * (2 * g - 1) + 1) / (m * (m + 2 * g - 1)); }
/** Cách hiểu A: m ≥ 3 → đưa-đón với g = n/k − 1 khách mỗi xe; m ≤ 3 → tiếp sức bỏ xe, mỗi người đi xe 2k/n quãng. n ≤ 2k → 1/m. */
function TA(n, k, m) { if (n <= 2 * k) return 1 / m; return m >= 3 ? TshuttleR(n / k - 1, m) : 1 - (2 * k / n) * (1 - 1 / m); }
function TB(n, k, m) { return TshuttleR(n / k, m); }
function TrelayR(n, k, m) { return 1 - (2 * k / n) * (1 - 1 / m); }

// ------------------------------------------------------------------ LP cận dưới (gộp đối xứng), giải bằng liệt kê đỉnh
// biến: r (km đi xe tới mỗi người, TB), s (km đi xe lùi mỗi người, TB), F (km tới mỗi xe), K (km lùi mỗi xe), T. Ràng buộc dạng a·x ≤ b.
function lpA(n, k, m, interp) {
  var c = k / n, rows = [];
  // (1) thời gian mỗi người: 1 − r + s + (r+s)/m ≤ T   ⇔  −r(1−1/m) + s(1+1/m) − T ≤ −1
  if (interp === "A") rows.push([[-(1 - 1 / m), (1 + 1 / m), 0, 0, -1], -1]);
  else rows.push([[-(1 - 1 / m), 0, 0, 0, -1], -1]);                    // B: người không lái lùi; s = 0
  // (2) ghế tới: n r ≤ cap·k F  (A: 2 người/xe; B: 1 khách/xe)
  rows.push([[1, 0, -(interp === "A" ? 2 : 1) * c, 0, 0], 0]);
  // (3) km lùi của xe cần người lái trong nhóm (A): n s ≥ k K ⇔ −s + c K ≤ 0 ; B: tài xế ngoài nhóm, bỏ ràng buộc
  if (interp === "A") rows.push([[0, -1, 0, c, 0], 0]); else rows.push([[0, 1, 0, 0, 0], 0]);
  rows.push([[0, 0, 1, -1, 0], 1]);                 // (4) F − K ≤ 1
  rows.push([[0, 0, 1, 1, -m], 0]);                 // (5) F + K ≤ mT
  rows.push([[1, -1, 0, 0, 0], 1]);                 // (6) r − s ≤ 1 (không đi bộ lùi; quãng đi bộ ≥ 0)
  for (var i = 0; i < 5; i++) { var e = [0, 0, 0, 0, 0]; e[i] = -1; rows.push([e, 0]); }   // không âm
  var best = null, idx = [], N = rows.length;
  function solve(sel) {
    var A = sel.map(function (j) { return rows[j][0].slice().concat([rows[j][1]]); }), n5 = 5, r, cc, p;
    for (cc = 0; cc < n5; cc++) { p = -1; var bv = 1e-12; for (r = cc; r < n5; r++) if (Math.abs(A[r][cc]) > bv) { bv = Math.abs(A[r][cc]); p = r; } if (p < 0) return null; var t = A[p]; A[p] = A[cc]; A[cc] = t; for (r = 0; r < n5; r++) if (r !== cc) { var f = A[r][cc] / A[cc][cc]; for (var q = cc; q <= n5; q++) A[r][q] -= f * A[cc][q]; } }
    return A.map(function (row, i2) { return row[n5] / row[i2]; });
  }
  (function rec(start) {
    if (idx.length === 5) { var x = solve(idx); if (!x) return; for (var j = 0; j < N; j++) { var s = 0; for (var q = 0; q < 5; q++) s += rows[j][0][q] * x[q]; if (s > rows[j][1] + 1e-9) return; } if (!best || x[4] < best[4] - 1e-12) best = x; return; }
    for (var i2 = start; i2 < N; i2++) { idx.push(i2); rec(i2 + 1); idx.pop(); }
  })(0);
  return best;    // [r, s, F, K, T]
}

// ------------------------------------------------------------------ MÔ PHỎNG HƯỚNG SỰ KIỆN (hữu tỉ chính xác)
// Kế hoạch = mỗi xe một hàng lệnh. Lệnh: ["take", p, q?] (xe đang đỗ: người p (và q) đi bộ tới xe rồi lên; p lái),
// ["ride", x] (chạy tới vị trí x), ["meet", p] (chạy tới gặp người đang đi bộ p, đón lên ghế sau), ["off", p] (người p xuống, đi bộ tiếp; người lái xuống thì người sau thành người lái; hết người ⇒ xe đỗ).
// Hết lệnh khi còn người trên xe ⇒ tự chạy về B. Người rảnh luôn đi bộ về B. Cách hiểu B: interp "B" — tài xế ngoài nhóm (người lái ảo id −1), chỉ chở 1 khách.
function simulate(n, k, m, plan, interp) {
  interp = interp || "A";
  var M = Q(m), pers = [], bikes = [], err = null, i;
  for (i = 0; i < n; i++) pers.push({ mode: "walk", x0: Z, t0: Z, res: -1, done: null });
  for (i = 0; i < k; i++) bikes.push({ x: Z, t: Z, riders: interp === "B" ? [-1] : [], q: (plan[i] || []).slice(), qi: 0, fin: false });
  function posAt(p, t) { var P = pers[p]; if (P.mode === "walk") { var x = add(P.x0, sub(t, P.t0)); return cmp(x, ONE) > 0 ? ONE : x; } return P.mode === "wait" ? P.x0 : null; }
  function arriveWalk(p) { var P = pers[p]; return add(P.t0, sub(ONE, P.x0)); }
  function release(p, x, t) { var P = pers[p]; P.mode = "walk"; P.x0 = x; P.t0 = t; P.res = -1; if (cmp(x, ONE) >= 0) { P.mode = "done"; P.done = t; } }
  function fail(b, msg) { if (!err) err = "xe " + (b + 1) + ", lệnh " + (bikes[b].qi) + ": " + msg; }
  function realRiders(B) { return B.riders.filter(function (r) { return r >= 0; }); }
  for (var guard = 0; guard < 10000 && !err; guard++) {
    // chọn xe có thời điểm sẵn sàng nhỏ nhất còn việc
    var bi = -1;
    for (i = 0; i < k; i++) { var B0 = bikes[i]; if (B0.fin) continue; if (bi < 0 || cmp(B0.t, bikes[bi].t) < 0) bi = i; }
    if (bi < 0) break;
    var B = bikes[bi], cmd = B.qi < B.q.length ? B.q[B.qi] : null; B.qi++;
    var seats = interp === "B" ? 2 : 2;
    if (!cmd) {                                              // hết lệnh
      if (realRiders(B).length) cmd = ["ride", 1];
      else { B.fin = true; continue; }
    }
    var op = cmd[0];
    if (op === "take") {
      if (B.riders.length && interp === "A") { fail(bi, "xe đang có người, không 'lấy xe' được"); break; }
      var who = cmd.slice(1).filter(function (p) { return p != null; }), tb = B.t;
      for (var w = 0; w < who.length; w++) {
        var p = who[w], P = pers[p];
        if (P.mode !== "walk") { fail(bi, "người " + (p + 1) + " không đang đi bộ"); break; }
        var xp = posAt(p, B.t);
        if (cmp(xp, B.x) > 0) { fail(bi, "người " + (p + 1) + " đã đi qua chỗ xe"); break; }
        var ta = add(B.t, sub(B.x, xp)); tb = qmax(tb, ta);
      }
      if (err) break;
      // lưu ý đơn giản hoá: người đi bộ được "giữ chỗ" từ lúc xử lý lệnh; họ không bị ai khác đón trong lúc tới xe
      who.forEach(function (p) { pers[p].mode = "bike"; pers[p].res = bi; });
      if (interp === "B" && who.length > 1) { fail(bi, "xe ôm chỉ chở 1 khách"); break; }
      B.riders = (interp === "B" ? [-1] : []).concat(who); if (B.riders.length > seats) { fail(bi, "quá 2 người"); break; }
      B.t = tb;
    } else if (op === "ride") {
      if (!B.riders.length) { fail(bi, "xe không có người lái"); break; }
      var x = typeof cmd[1] === "object" ? cmd[1] : Q(cmd[1][0] !== undefined ? cmd[1][0] : cmd[1], cmd[1][1] !== undefined ? cmd[1][1] : 1);
      if (cmp(x, Z) < 0 || cmp(x, ONE) > 0) { fail(bi, "vị trí ngoài [A,B]"); break; }
      var dist = cmp(x, B.x) >= 0 ? sub(x, B.x) : sub(B.x, x);
      B.t = add(B.t, dv(dist, M)); B.x = x;
      if (cmp(x, ONE) === 0) { realRiders(B).forEach(function (p) { pers[p].mode = "done"; pers[p].done = B.t; }); B.riders = interp === "B" ? [-1] : []; if (interp === "A") B.fin = true; }
    } else if (op === "meet") {
      var pm = cmd[1], PM = pers[pm];
      if (B.riders.length >= seats) { fail(bi, "xe hết chỗ"); break; }
      if (!B.riders.length) { fail(bi, "xe không có người lái"); break; }
      if (PM.mode !== "walk") { fail(bi, "người " + (pm + 1) + " không đang đi bộ (" + PM.mode + ")"); break; }
      var xq = posAt(pm, B.t), tm, xm;
      if (cmp(xq, B.x) >= 0) { tm = add(B.t, dv(sub(xq, B.x), Q(m - 1))); }            // đuổi theo
      else { tm = add(B.t, dv(sub(B.x, xq), Q(m + 1))); }                                // quay lại đón
      xm = add(PM.x0, sub(tm, PM.t0));
      if (cmp(xm, ONE) > 0) { fail(bi, "người " + (pm + 1) + " tới B trước khi gặp"); break; }
      B.t = tm; B.x = xm; PM.mode = "bike"; PM.res = bi; B.riders.push(pm);
    } else if (op === "off") {
      var po = cmd[1], at = B.riders.indexOf(po);
      if (at < 0) { fail(bi, "người " + (po + 1) + " không ở trên xe"); break; }
      B.riders.splice(at, 1); release(po, B.x, B.t);
    } else { fail(bi, "lệnh lạ " + op); break; }
  }
  if (err) return { ok: false, error: err };
  // người còn đi bộ tới B
  var T = Z, arr = [];
  for (i = 0; i < n; i++) { var Pi = pers[i]; if (Pi.mode === "walk") { Pi.done = arriveWalk(i); Pi.mode = "done"; } if (Pi.mode !== "done") return { ok: false, error: "người " + (i + 1) + " kẹt (" + Pi.mode + ")" }; arr.push(Pi.done); T = qmax(T, Pi.done); }
  return { ok: true, T: T, arrivals: arr };
}

// ------------------------------------------------------------------ các lịch kinh điển dưới dạng kế hoạch
/** A, m ≥ 3, k | n: mỗi xe 1 người lái cố định + g = n/k − 1 khách chở từng người một (xe chạy liên tục, người lái tới B cùng khách cuối). */
function planShuttleA(n, k, m) {
  var g = n / k - 1, x = Q(m + 1, m + 2 * g - 1), plan = [];
  for (var b = 0; b < k; b++) {
    var drv = b * (g + 1), cmds = [["take", drv, drv + 1]], pos = Z;
    // khách j được chở đoạn x tính từ chỗ đón; chỗ đón của khách j = j·2x/(m+1)
    for (var j = 0; j < g; j++) {
      var pick = mul(Q(j), dv(mul(Q(2), x), Q(m + 1))), drop = add(pick, x);
      if (j > 0) cmds.push(["meet", drv + 1 + j]);
      cmds.push(["ride", drop]);
      if (j < g - 1) cmds.push(["off", drv + 1 + j]);
    }
    plan.push(cmds);
  }
  return plan;
}
/** A, 2k | n: tiếp sức — mỗi xe phục vụ n/k người theo cặp, cặp j đi xe đoạn [j·L, (j+1)·L], L = 2k/n, rồi bỏ xe cho cặp sau. */
function planRelayA(n, k, m) {
  var per = n / k, pairs = per / 2, L = Q(2 * k, n), plan = [];
  for (var b = 0; b < k; b++) {
    var base = b * per, cmds = [];
    for (var j = 0; j < pairs; j++) {
      var a = base + 2 * j, c = a + 1;
      cmds.push(["take", a, c]); cmds.push(["ride", mul(Q(j + 1), L)]);
      if (j < pairs - 1) { cmds.push(["off", c]); cmds.push(["off", a]); }
    }
    plan.push(cmds);
  }
  return plan;
}
/** B, k | n: xe ôm — mỗi xe chở lần lượt g = n/k khách. */
function planShuttleB(n, k, m) {
  var g = n / k, x = Q(m + 1, m + 2 * g - 1), plan = [];
  for (var b = 0; b < k; b++) {
    var base = b * g, cmds = [["take", base]];
    for (var j = 0; j < g; j++) {
      var pick = mul(Q(j), dv(mul(Q(2), x), Q(m + 1))), drop = add(pick, x);
      if (j > 0) cmds.push(["meet", base + j]);
      cmds.push(["ride", drop]);
      if (j < g - 1) cmds.push(["off", base + j]);
    }
    plan.push(cmds);
  }
  return plan;
}

// ------------------------------------------------------------------ chạy
if (require.main === module) {
  var L = console.log;
  L("== 1. LP cận dưới (liệt kê đỉnh) so với dạng đóng — cách hiểu A");
  var worst = 0, rows = 0;
  [2, 2.5, 3, 4, 5, 6, 8, 10].forEach(function (m) {
    [[4, 1], [6, 1], [6, 2], [8, 2], [9, 3], [12, 3], [10, 1], [3, 1], [5, 1], [5, 2], [7, 2]].forEach(function (nk) {
      var n = nk[0], k = nk[1], x = lpA(n, k, m, "A"), cf = TA(n, k, m);
      worst = Math.max(worst, Math.abs(x[4] - cf)); rows++;
    });
  });
  L("  " + rows + " bộ (n,k,m): sai khác lớn nhất giữa LP và công thức = " + worst.toExponential(2));
  [[4, 1, 5], [4, 1, 2], [4, 1, 3], [6, 2, 5], [9, 3, 6], [12, 2, 8], [6, 1, 2]].forEach(function (t) {
    var x = lpA(t[0], t[1], t[2], "A");
    L("  n=" + t[0] + " k=" + t[1] + " m=" + t[2] + ": LP T* = " + x[4].toFixed(6) + " | công thức " + TA(t[0], t[1], t[2]).toFixed(6) + " | đưa-đón " + TshuttleR(t[0] / t[1] - 1, t[2]).toFixed(4) + " | bỏ xe " + TrelayR(t[0], t[1], t[2]).toFixed(4) + " | nghiệm LP r=" + x[0].toFixed(3) + " s=" + x[1].toFixed(3) + " F=" + x[2].toFixed(3) + " K=" + x[3].toFixed(3));
  });
  L("\n== 2. LP cận dưới — cách hiểu B (xe ôm)");
  var wb = 0; [2, 3, 5, 8].forEach(function (m) { [[4, 1], [6, 2], [5, 2], [3, 1], [7, 3]].forEach(function (nk) { var x = lpA(nk[0], nk[1], m, "B"); wb = Math.max(wb, Math.abs(x[4] - TB(nk[0], nk[1], m))); }); });
  L("  sai khác lớn nhất LP vs (m(2g−1)+1)/(m(m+2g−1)), g=n/k: " + wb.toExponential(2));

  L("\n== 3. Mô phỏng hữu tỉ các lịch kinh điển (phải ra ĐÚNG công thức)");
  function show(name, n, k, m, plan, interp, expect) {
    var r = simulate(n, k, m, plan, interp);
    if (!r.ok) { L("  " + name + " n=" + n + " k=" + k + " m=" + m + ": LỖI " + r.error); return; }
    var same = Math.abs(qf(r.T) - expect) < 1e-12;
    L("  " + name + " n=" + n + " k=" + k + " m=" + m + ": T = " + qs(r.T) + " giờ (" + (qf(r.T) * 60).toFixed(2) + " phút) | công thức " + expect.toFixed(6) + (same ? " ✓" : " ✗") + " | tới nơi: " + r.arrivals.map(qs).join(", "));
  }
  show("Đưa-đón A", 4, 1, 5, planShuttleA(4, 1, 5), "A", TshuttleR(3, 5));
  show("Đưa-đón A", 6, 2, 5, planShuttleA(6, 2, 5), "A", TshuttleR(2, 5));
  show("Đưa-đón A", 9, 3, 6, planShuttleA(9, 3, 6), "A", TshuttleR(2, 6));
  show("Đưa-đón A", 3, 1, 4, planShuttleA(3, 1, 4), "A", TshuttleR(2, 4));
  show("Đưa-đón A", 8, 2, 7, planShuttleA(8, 2, 7), "A", TshuttleR(3, 7));
  show("Tiếp sức A", 4, 1, 2, planRelayA(4, 1, 2), "A", TrelayR(4, 1, 2));
  show("Tiếp sức A", 6, 1, 3, planRelayA(6, 1, 3), "A", TrelayR(6, 1, 3));
  show("Tiếp sức A", 8, 2, 2, planRelayA(8, 2, 2), "A", TrelayR(8, 2, 2));
  show("Tiếp sức A (m=5, kém hơn)", 4, 1, 5, planRelayA(4, 1, 5), "A", TrelayR(4, 1, 5));
  show("Đưa-đón A (m=2, kém hơn)", 4, 1, 2, planShuttleA(4, 1, 2), "A", TshuttleR(3, 2));
  show("Xe ôm B", 3, 1, 5, planShuttleB(3, 1, 5), "B", TshuttleR(3, 5));
  show("Xe ôm B", 6, 2, 4, planShuttleB(6, 2, 4), "B", TshuttleR(3, 4));
  show("Xe ôm B", 4, 2, 3, planShuttleB(4, 2, 3), "B", TshuttleR(2, 3));
}
module.exports = { Q: Q, qs: qs, qf: qf, simulate: simulate, lpA: lpA, TA: TA, TB: TB, TshuttleR: TshuttleR, TrelayR: TrelayR, planShuttleA: planShuttleA, planRelayA: planRelayA, planShuttleB: planShuttleB, add: add, sub: sub, mul: mul, dv: dv, cmp: cmp };
