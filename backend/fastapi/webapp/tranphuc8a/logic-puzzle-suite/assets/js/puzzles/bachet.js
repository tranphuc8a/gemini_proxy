/* puzzles/bachet.js — QUẢ CÂN BACHET (CW2): bộ quả cân ÍT NHẤT trên cân hai đĩa. Ba cỡ (sizes):
     hai  — chọn BỘ quả cân để cân được MỌI khối lượng nguyên 1..N g, quả cân đặt được cả hai đĩa (vật ở một đĩa; quả cân ở đĩa kia hoặc CÙNG đĩa với vật) → 1, 3, 9, 27…
     mot  — như trên nhưng quả cân chỉ được đặt ở đĩa đối diện vật → 1, 2, 4, 8… (luỹ thừa 2)
     dat  — cho sẵn bộ quả cân W và vài vật x: với MỖI vật hãy đặt quả cân lên cân (đĩa đối diện / cùng đĩa / để ngoài) cho thăng bằng, dùng ÍT quả nhất.
   Loại optimize (HUONG-DAN-ENGINE.md mục 11): không đúng/sai, NỘP rồi chấm theo số quả cân so với tối thiểu (Puz.grade.fromRatio, kiểu "min"; sao tự đặt: 3★ = tối thiểu).

   ── Lõi toán (đều kiểm bằng vét cạn độc lập trong kiem/bachet.js) ─────────────────────────────────────────────────────────────────────
   m quả cân, mỗi quả có 3 cách dùng (hai đĩa: −1/0/+1) hoặc 2 cách (một đĩa: 0/+1) ⇒ khối lượng 1..N cần (3^m − 1)/2 ≥ N hoặc 2^m − 1 ≥ N:
   m* = ⌈log3(2N+1)⌉ (hai) và ⌈log2(N+1)⌉ (một) — tính bằng VÒNG LẶP số nguyên (không dùng log). Bộ dựng được: hai {1,3,…,3^(m*−2), N − (3^(m*−1)−1)/2},
   một {1,2,…,2^(m*−2), N − (2^(m*−1)−1)} (quả cuối ≤ 2R+1 / ≤ R+1 nên phủ liền, R = tổng các quả trước): kiểm phủ bằng bitset các tổng có dấu.
   N = (3^m − 1)/2 (hai) hoặc 2^m − 1 (một) ⇒ bộ tối ưu DUY NHẤT (đếm tổng có dấu khít 3^m / 2^m); N khác ⇒ nhiều bộ tối ưu.

   ── Trạng thái ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   hai/mot: v = [w_0 … w_{M−1}, nộp] với M = m* + 2 ô quả cân (0 = trống, 1..N); dat: v = [ô (vật j, quả k) = j·|W| + k ∈ {0 ngoài, 1 đĩa đối diện vật, 2 cùng đĩa với vật}, nộp].
   Cờ nộp NẰM TRONG state ⇒ solution.v chứa cờ ⇒ Reveal/replay/check(solution) chạy đúng; sửa một ô sau khi nộp sẽ mở lại (cùng diff). Khác camel/xe máy: không dùng Puz.plan vì đây
   không phải dãy thao tác (cỡ bàn cố định, mỗi ô là một biến) — hoàn tác/làm lại/tự lưu vẫn là diff của game.js.
   Action: {k:"set", i, val} · {k:"place", item, i, val} (dat) · {k:"clear"} · {k:"reopen"} · {k:"submit"}.

   ── Gợi ý ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   hai/mot: "mở rộng được" = còn cách thêm quả cho TỔNG ≤ m* quả mà phủ 1..N (tìm kiếm DFS, quả thêm tăng dần, cắt tỉa bằng đếm 3^r / 2^r, ngân sách công việc đếm bằng ô mảng, không bằng giờ).
   Kết quả "yes" (có bộ hoàn thành) / "no" (đã vét hết, không có) / "unknown" (hết ngân sách — gợi ý nói thật là chưa chứng minh được và khuyên bỏ quả đó; mistakes KHÔNG tính). Bộ con của bộ mở rộng được
   cũng mở rộng được (đơn điệu) nên "quả đầu tiên làm hỏng" tìm theo tiền tố. dat: mỗi vật chọn bố trí tối thiểu GẦN NHẤT với bố trí hiện tại (khoảng cách Hamming), nên mỗi gợi ý giảm khoảng cách. */
(function (root) {
  "use strict";
  var P = root.Puz, G = P.grade;

  var MAXN = { hai: 400, mot: 255 };
  var MAX_W = 8, MAX_WV = 999, MAX_Q = 8;
  var BUDGET = 4000000;                       // ngân sách tìm kiếm mở rộng (đơn vị = ô mảng chạm tới)
  var MODES = ["hai", "mot", "dat"];

  function isInt(x, lo, hi) { return typeof x === "number" && x === Math.floor(x) && x >= lo && x <= hi; }
  function nf(n) { return G.fmt(n, 0); }
  function zeros(n) { var a = []; for (var i = 0; i < n; i++) a.push(0); return a; }
  function asc(a, b) { return a - b; }
  function both(mode) { return mode === "hai"; }
  function round1(x) { return Math.round(x * 10) / 10; }

  // ================================================================================================= lõi toán
  /** Số khối lượng liên tiếp tối đa cân được bằng m quả: (3^m − 1)/2 (hai đĩa) hoặc 2^m − 1 (một đĩa). */
  function capOf(m, two) { var p = 1, i; for (i = 0; i < m; i++) p *= two ? 3 : 2; return two ? (p - 1) / 2 : p - 1; }
  /** Số quả cân ÍT NHẤT để phủ 1..N (N ≥ 1): vòng lặp số nguyên. */
  function minCount(N, two) { var m = 1; while (capOf(m, two) < N) m++; return m; }
  /** Bộ dựng được (ĐÃ sắp tăng dần): chuỗi 1,3,9… (hoặc 1,2,4…) m−1 quả đầu + quả cuối = phần còn thiếu. */
  function canonical(N, two) {
    var m = minCount(N, two), out = [], p = 1, i;
    for (i = 0; i < m - 1; i++) { out.push(p); p *= two ? 3 : 2; }
    out.push(N - capOf(m - 1, two));
    return out.sort(asc);
  }
  /** Tập các tổng có dấu của bộ W: { reach: Uint8Array (chỉ số = tổng + S), S = ΣW }. Một đĩa: chỉ tổng không âm. */
  function addW(st, w, two) {
    var S2 = st.S + w, out = new Uint8Array(2 * S2 + 1), r = st.reach, S = st.S;
    for (var i = 0; i <= 2 * S; i++) if (r[i]) { var sum = i - S; out[sum + S2] = 1; out[sum + w + S2] = 1; if (two) out[sum - w + S2] = 1; }
    return { reach: out, S: S2 };
  }
  function reachOf(W, two) { var st = { reach: new Uint8Array([1]), S: 0 }; for (var i = 0; i < W.length; i++) st = addW(st, W[i], two); return st; }
  function firstGap(st, N) { for (var x = 1; x <= N; x++) if (x > st.S || !st.reach[st.S + x]) return x; return 0; }
  function countOnes(st) { var c = 0, r = st.reach; for (var i = 0; i < r.length; i++) c += r[i]; return c; }
  /** {covered, gap (khối lượng nhỏ nhất bị hở, 0 nếu phủ đủ), R (phủ liền 1..R), count (số tổng phân biệt)}. */
  function coverInfo(W, N, two) {
    var st = reachOf(W, two), gap = firstGap(st, N);
    return { covered: gap === 0, gap: gap, R: gap ? gap - 1 : N, count: countOnes(st) };
  }
  function popow(b, e) { var p = 1; for (var i = 0; i < e; i++) p *= b; return p; }

  /** C \ W (đa tập) đã sắp tăng dần; null nếu W không phải đa tập con của C. */
  function msDiff(C, W) {
    var rest = C.slice(), i, j;
    for (i = 0; i < W.length; i++) { j = rest.indexOf(W[i]); if (j < 0) return null; rest.splice(j, 1); }
    return rest;
  }
  /** Khối lượng nào của gap có thể phủ bằng đúng MỘT quả w nữa? (kiểm toàn bộ 1..N, không tạo mảng mới) */
  function oneMoreCovers(st, N, w, two) {
    for (var x = 1; x <= N; x++) {
      var a = x <= st.S && st.reach[st.S + x], b = x - w >= -st.S && x - w <= st.S && st.reach[st.S + x - w], c = two && x + w <= st.S && st.reach[st.S + x + w];
      if (!a && !b && !c) return false;
    }
    return true;
  }
  /** Bộ W (mảng số nguyên dương ≤ N) có MỞ RỘNG được thành bộ phủ 1..N với đúng m* quả không?
      → { state: "yes", add:[quả thêm tăng dần] } | { state: "no" } (đã vét hết) | { state: "unknown" } (hết ngân sách). Không đo giờ: ngân sách đếm bằng ô mảng. */
  function feasible(W, N, two, budget) {
    var m = minCount(N, two), r0 = m - W.length;
    if (r0 < 0) return { state: "no", add: null, why: "toomany" };
    var C = canonical(N, two), d = msDiff(C, W);
    if (d) return { state: "yes", add: d };
    var st0 = reachOf(W, two), work = 0, over = false, fan = two ? 3 : 2, need = two ? 2 * N + 1 : N + 1, why = "";
    function rec(st, r, minw, add) {
      if (over) return null;
      work += 2 * st.S + 1 + N;
      if (work > (budget || BUDGET)) { over = true; return null; }
      var gap = firstGap(st, N);
      if (!gap) return add.slice();
      if (r === 0) return null;
      if (countOnes(st) * popow(fan, r) < need) { if (!why && add.length === 0) why = "count"; return null; }
      var w, res;
      if (r === 1) {
        var seen = {}, cands = [], i, sum;
        for (i = 0; i < st.reach.length; i++) if (st.reach[i]) {
          sum = i - st.S;
          w = gap - sum; if (w >= 1 && w >= minw && w <= N && !seen[w]) { seen[w] = 1; cands.push(w); }
          if (two) { w = sum - gap; if (w >= 1 && w >= minw && w <= N && !seen[w]) { seen[w] = 1; cands.push(w); } }
        }
        cands.sort(asc);
        for (i = 0; i < cands.length; i++) { work += N; if (oneMoreCovers(st, N, cands[i], two)) return add.concat([cands[i]]); }
        return null;
      }
      for (w = minw; w <= N; w++) {
        res = rec(addW(st, w, two), r - 1, w, add.concat([w]));
        if (res) return res;
        if (over) return null;
      }
      return null;
    }
    var res = rec(st0, r0, 1, []);
    if (res) return { state: "yes", add: res };
    return { state: over ? "unknown" : "no", add: null, why: over ? "budget" : why };
  }

  // ---- dat: bố trí quả cân cho một vật x. Ô: 0 ngoài, 1 đĩa đối diện vật (+w), 2 cùng đĩa với vật (−w). Cân bằng: x = Σ_{1} w − Σ_{2} w.
  var rowsMemo = {}, rowsCount = 0;
  /** Mọi bố trí thăng bằng DÙNG ÍT QUẢ NHẤT (sắp theo thứ tự từ điển) → { min (99 nếu không cân được), rows }. */
  function datRows(W, x) {
    var key = W.join(",") + "|" + x;
    if (rowsMemo[key]) return rowsMemo[key];
    var q = W.length, total = popow(3, q), best = 99, rows = [], code, i, c, sum, used, row;
    for (code = 0; code < total; code++) {
      c = code; sum = 0; used = 0; row = [];
      for (i = 0; i < q; i++) { var dg = c % 3; c = (c - dg) / 3; row.push(dg); if (dg === 1) { sum += W[i]; used++; } else if (dg === 2) { sum -= W[i]; used++; } }
      if (sum !== x) continue;
      if (used < best) { best = used; rows = [row]; } else if (used === best) rows.push(row);
    }
    rows.sort(function (a, b) { for (var k = 0; k < a.length; k++) if (a[k] !== b[k]) return a[k] - b[k]; return 0; });
    var out = { min: best, rows: rows };
    if (++rowsCount > 400) { rowsMemo = {}; rowsCount = 0; }
    rowsMemo[key] = out;
    return out;
  }
  function rowSum(W, row) { var s = 0; for (var i = 0; i < W.length; i++) s += row[i] === 1 ? W[i] : row[i] === 2 ? -W[i] : 0; return s; }
  function rowUsed(row) { var u = 0; for (var i = 0; i < row.length; i++) if (row[i]) u++; return u; }
  /** Cách cân thử khối lượng t với bộ W hiện có (ít quả nhất): { coef: [−1|0|1 …] } hoặc null. coef +1 = đĩa đối diện, −1 = cùng đĩa với vật. */
  function arrange(W, t, two) {
    var q = W.length, base = two ? 3 : 2, total = popow(base, q), best = null, code, c, i, sum, used, coef;
    for (code = 0; code < total; code++) {
      c = code; sum = 0; used = 0; coef = [];
      for (i = 0; i < q; i++) { var dg = c % base; c = (c - dg) / base; var k = dg === 0 ? 0 : dg === 1 ? 1 : -1; coef.push(k); sum += k * W[i]; if (k) used++; }
      if (sum === t && (!best || used < best.used)) best = { coef: coef, used: used };
    }
    return best;
  }

  // ================================================================================================= dữ liệu / độ khó
  function isPow3Prefix(W) { for (var i = 0; i < W.length; i++) if (W[i] !== popow(3, i)) return false; return true; }
  var SET_F = { hai: { 1: 1.2, 2: 2.0, 3: 3.0, 4: 4.3, 5: 6.3, 6: 8.3, 7: 9.3, 8: 9.7 }, mot: { 1: 1.2, 2: 1.6, 3: 2.4, 4: 3.0, 5: 4.3, 6: 6.3, 7: 8.3, 8: 9.3 } };
  function scoreOf(d) {
    if (d.mode === "dat") return Math.max(0.5, Math.min(10, round1(-2.2 + 0.9 * d.W.length + 1.05 * d.X.length + (isPow3Prefix(d.W) ? 0 : 0.4))));
    var two = both(d.mode), m = minCount(d.N, two), nb = d.N !== capOf(m, two);
    return round1((SET_F[d.mode][m] || 9.7) + (nb ? 0.4 : 0));
  }
  function dataOk(d) {
    if (!d || MODES.indexOf(d.mode) < 0) return false;
    if (d.mode === "dat") return Array.isArray(d.W) && Array.isArray(d.X) && d.W.length >= 1 && d.W.length <= MAX_W && d.X.length >= 1 && d.X.length <= MAX_Q && d.W.every(function (w) { return isInt(w, 1, MAX_WV); }) && d.X.every(function (x) { return isInt(x, 1, MAX_WV * MAX_W); });
    return isInt(d.N, 1, MAXN[d.mode]) && isInt(d.slots, 1, 20);
  }
  function layoutOf(d) { var cells = d.mode === "dat" ? d.W.length * d.X.length : d.slots; return { cells: cells, flag: cells }; }
  function minsOf(W, X) { return X.map(function (x) { return datRows(W, x).min; }); }
  function sumOf(a) { return a.reduce(function (p, q) { return p + q; }, 0); }

  function buildSet(seed, sizeId, mode, N, tier) {
    var two = both(mode), m = minCount(N, two), M = m + 2, C = canonical(N, two), sol = zeros(M + 1), i;
    for (i = 0; i < C.length; i++) sol[i] = C[i];
    sol[M] = 1;
    var d = { mode: mode, N: N, m: m, slots: M };
    var p = { v: 1, type: "bachet", seed: seed, sizeId: sizeId, size: { mode: mode }, tier: tier, score: scoreOf(d), data: d, initial: { v: zeros(M + 1) }, solution: { v: sol }, meta: {} };
    if (tier !== "custom") p.tier = P.util.tierOfScore(p.score).id;
    p.id = P.util.puzzleId(p);
    return p;
  }
  function buildDat(seed, sizeId, W, X, tier) {
    var q = W.length, mins = minsOf(W, X), sol = zeros(q * X.length + 1), j;
    for (j = 0; j < X.length; j++) { var rows = datRows(W, X[j]).rows; if (!rows.length) return null; for (var k = 0; k < q; k++) sol[j * q + k] = rows[0][k]; }
    sol[q * X.length] = 1;
    var d = { mode: "dat", W: W.slice(), X: X.slice(), mins: mins, best: sumOf(mins) };
    var p = { v: 1, type: "bachet", seed: seed, sizeId: sizeId, size: { mode: "dat" }, tier: tier, score: scoreOf(d), data: d, initial: { v: zeros(q * X.length + 1) }, solution: { v: sol }, meta: {} };
    if (tier !== "custom") p.tier = P.util.tierOfScore(p.score).id;
    p.id = P.util.puzzleId(p);
    return p;
  }

  // ================================================================================================= đọc trạng thái
  function weightsOf(d, s) { var out = []; for (var i = 0; i < d.slots; i++) if (s.v[i] > 0) out.push({ i: i, w: s.v[i] }); return out; }
  function wlist(d, s) { return weightsOf(d, s).map(function (z) { return z.w; }); }
  function submittedOf(d, s) { return s.v[layoutOf(d).flag] === 1; }
  function rowOf(d, s, j) { var q = d.W.length; return s.v.slice(j * q, (j + 1) * q); }
  function itemBalanced(d, s, j) { return rowSum(d.W, rowOf(d, s, j)) === d.X[j]; }
  function usedOf(d, s) { var u = 0; for (var i = 0; i < d.W.length * d.X.length; i++) if (s.v[i]) u++; return u; }
  function isComplete(d, s) {
    if (d.mode === "dat") { for (var j = 0; j < d.X.length; j++) if (!itemBalanced(d, s, j)) return false; return true; }
    return coverInfo(wlist(d, s), d.N, both(d.mode)).covered;
  }
  function slotOf(d, s) { for (var i = 0; i < d.slots; i++) if (s.v[i] === 0) return i; return -1; }

  function check(p, s) {
    var d = p.data, L = layoutOf(d), sub = s.v[L.flag] === 1, comp = isComplete(d, s), conf = [], j, k;
    if (d.mode === "dat" && sub) for (j = 0; j < d.X.length; j++) if (!itemBalanced(d, s, j)) for (k = 0; k < d.W.length; k++) conf.push(j * d.W.length + k);
    return { solved: sub && comp, conflicts: conf, filled: d.mode === "dat" ? usedOf(d, s) : weightsOf(d, s).length, total: d.mode === "dat" ? d.best : d.m, complete: comp };
  }
  function valueOf(d, s) { return d.mode === "dat" ? usedOf(d, s) : weightsOf(d, s).length; }
  function grade(p, s) {
    var d = p.data, v = valueOf(d, s), best = d.mode === "dat" ? d.best : d.m, comp = isComplete(d, s), sub = submittedOf(d, s);
    var g = G.fromRatio(v, best, "min", { digits: 0 });
    if (!sub || !comp) {
      g.stars = 0; g.quality = 0;
      g.text = !sub ? "Chưa nộp" : d.mode === "dat" ? "Đã nộp nhưng còn vật chưa thăng bằng" : "Đã nộp nhưng bộ chưa phủ hết 1…" + nf(d.N) + " g";
      return g;
    }
    if (v <= best) { g.stars = 3; g.quality = 1; g.text = "Tối ưu! " + nf(v) + " quả — không thể ít hơn."; return g; }
    var slack = d.mode === "dat" ? Math.ceil(best / 4) : 1;
    g.stars = v <= best + slack ? 2 : 1;
    g.text = "Dùng " + nf(v) + " quả, tối thiểu là " + nf(best) + " (đạt " + Math.floor(g.quality * 100) + " % mức tối ưu).";
    return g;
  }

  // ================================================================================================= nước đi
  function diffOf(s, changes, label) {
    var d = [];
    changes.forEach(function (c) { if (s.v[c[0]] !== c[1]) d.push(["v", c[0], s.v[c[0]], c[1]]); });
    return d.length ? { d: d, label: label } : null;
  }
  function moveFor(p, s, a) {
    var d = p.data, L = layoutOf(d), sub = s.v[L.flag] === 1;
    if (!a || typeof a !== "object") return null;
    var ch = [], i, j;
    if (a.k === "set" && d.mode !== "dat") {
      if (!isInt(a.i, 0, d.slots - 1) || !isInt(a.val, 0, d.N) || s.v[a.i] === a.val) return null;
      ch.push([a.i, a.val]); if (sub) ch.push([L.flag, 0]);
      return diffOf(s, ch, a.val ? "Quả cân " + (a.i + 1) + " = " + a.val + " g" : "Bỏ quả cân " + (a.i + 1));
    }
    if (a.k === "place" && d.mode === "dat") {
      var q = d.W.length;
      if (!isInt(a.item, 0, d.X.length - 1) || !isInt(a.i, 0, q - 1) || !isInt(a.val, 0, 2)) return null;
      i = a.item * q + a.i;
      if (s.v[i] === a.val) return null;
      ch.push([i, a.val]); if (sub) ch.push([L.flag, 0]);
      return diffOf(s, ch, "Vật " + (a.item + 1) + ", quả " + nf(d.W[a.i]) + " g");
    }
    if (a.k === "clear") {
      for (j = 0; j < L.cells; j++) ch.push([j, 0]);
      ch.push([L.flag, 0]);
      return diffOf(s, ch, "Xoá hết");
    }
    if (a.k === "reopen") return sub ? diffOf(s, [[L.flag, 0]], "Mở lại để sửa") : null;
    if (a.k === "submit") {
      if (sub) return null;
      if (d.mode !== "dat" ? weightsOf(d, s).length === 0 : usedOf(d, s) === 0) return null;
      return diffOf(s, [[L.flag, 1]], "Nộp");
    }
    return null;
  }
  function after(s, diff) { var t = { v: s.v.slice(), c: null }; diff.d.forEach(function (e) { t.v[e[1]] = e[3]; }); return t; }
  /** Nước làm MẤT tối ưu / nộp sai: (hai, mot) trước còn mở rộng được và sau CHẮC CHẮN không (vét hết) = 1; nộp khi chưa đạt = 1; "unknown" không tính. */
  function mistakes(p, s, diff) {
    var d = p.data, L = layoutOf(d), t = after(s, diff), n = 0;
    if (s.v[L.flag] === 0 && t.v[L.flag] === 1 && !isComplete(d, t)) n++;
    if (d.mode !== "dat") {
      var touched = diff.d.some(function (e) { return e[1] < d.slots; });
      if (touched && wlist(d, s).length <= d.m + 2) {
        var two = both(d.mode), b0 = feasible(wlist(d, s), d.N, two).state, b1 = feasible(wlist(d, t), d.N, two).state;
        if (b0 === "yes" && b1 === "no") n++;
      }
    }
    return n;
  }

  // ================================================================================================= gợi ý
  function mk(level, tech, text, why, cells, action, extra) { var h = { level: level, technique: tech, text: text, why: why || [], cells: cells || [], regions: {}, action: action || null }; if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) h[k] = extra[k]; return h; }
  function setText(W) { return "{" + W.map(nf).join(", ") + "}"; }
  function bound(d) {
    var two = both(d.mode);
    return two ? "Mỗi quả cân có 3 cách dùng (đĩa đối diện, cùng đĩa với vật, để ngoài) nên m quả phân biệt tối đa 3^m tổng — phủ liền 1…N cần (3^m − 1)/2 ≥ N."
      : "Mỗi quả cân chỉ có 2 cách dùng (đặt vào đĩa đối diện hay để ngoài) nên m quả phân biệt tối đa 2^m tổng — phủ liền 1…N cần 2^m − 1 ≥ N.";
  }
  function whyInfeasible(d, W, fe) {
    var two = both(d.mode), m = d.m, k = W.length, out = [];
    if (fe.why === "toomany") { out.push("Đã có " + k + " quả cân, nhiều hơn mức tối thiểu " + m + " quả — chắc chắn không còn tối ưu."); return out; }
    var st = reachOf(W, two), c = countOnes(st), r = m - k, fan = two ? 3 : 2, need = two ? 2 * d.N + 1 : d.N + 1;
    out.push(k + " quả " + setText(W) + " tạo được " + c + " tổng phân biệt; thêm " + r + " quả nữa nhân tối đa " + fan + "^" + r + " = " + popow(fan, r) + " lần ⇒ tối đa " + nf(c * popow(fan, r)) + ", mà cần ít nhất " + nf(need) + " để phủ 1…" + nf(d.N) + ".");
    if (fe.state === "no" && fe.why !== "count") out.push("Đã vét hết các cách chọn " + r + " quả còn lại: không cách nào phủ được 1…" + nf(d.N) + ".");
    if (fe.state === "unknown") out.push("Tìm kiếm hết ngân sách nên chưa chứng minh được là hết cách; hướng an toàn là bỏ quả này rồi chọn lại.");
    return out;
  }
  function hintSet(p, s, level) {
    var d = p.data, two = both(d.mode), Ws = weightsOf(d, s), W = Ws.map(function (z) { return z.w; }), sub = submittedOf(d, s), comp = coverInfo(W, d.N, two);
    if (sub && comp.covered) return { level: level, text: "Đã nộp bộ quả cân đạt.", why: [], cells: [], none: true };
    var fe = feasible(W, d.N, two);
    // ---- A. không còn đường tới tối ưu (hoặc chưa chắc): tìm quả ĐẦU TIÊN làm hỏng (tiền tố theo thứ tự ô)
    if (fe.state !== "yes") {
      var pre = [], bad = Ws[0], z;
      for (z = 0; z < Ws.length; z++) { pre.push(Ws[z].w); if (feasible(pre, d.N, two).state !== "yes") { bad = Ws[z]; break; } }
      var prefixW = pre.slice(0, pre.length - 1), pf = feasible(pre, d.N, two);
      var lines = whyInfeasible(d, pre, pf);
      var msg1 = fe.state === "no" ? "Bộ quả cân hiện tại không thể hoàn thành với số quả tối thiểu — một quả đã đặt làm mất tối ưu." : "Chưa chứng minh được bộ hiện tại còn hoàn thành được với số quả tối thiểu — có một quả đáng nghi.";
      var msg2 = "Quả " + nf(bad.w) + " g ở ô " + (bad.i + 1) + (fe.state === "no" ? " làm mất tối ưu" : " là quả đầu tiên đáng nghi") + " (các quả trước nó " + (prefixW.length ? setText(prefixW) : "chưa có") + " vẫn ổn).";
      return mk(level, "Bỏ quả cân", level === 1 ? msg1 : level === 2 ? msg2 : "Bỏ quả cân " + nf(bad.w) + " g ở ô " + (bad.i + 1) + ".", level === 3 ? lines : [], level === 1 ? [] : [bad.i], level === 3 ? { k: "set", i: bad.i, val: 0 } : null);
    }
    // ---- B. đã phủ đủ (với đúng m* quả) → nộp
    if (comp.covered) {
      return mk(level, "Nộp", level === 1 ? "Bộ quả cân đã phủ đủ — hãy nộp." : "Bộ " + setText(W) + " cân được mọi khối lượng 1…" + nf(d.N) + " g với " + W.length + " quả: nộp.",
        level === 3 ? ["Số quả " + W.length + " bằng mức tối thiểu " + d.m + " (" + bound(d) + ")."] : [], [], level === 3 ? { k: "submit" } : null);
    }
    // ---- C. còn đường: quả kế tiếp = quả nhỏ nhất của một cách hoàn thành
    var w = fe.add[0], slot = slotOf(d, s), W2 = W.concat([w]), c2 = coverInfo(W2, d.N, two), R = comp.R, lim = two ? 2 * R + 1 : R + 1;
    var tech = "Phủ liền";
    var t1 = bound(d) + " Hãy chọn quả tiếp theo sao cho các khối lượng 1…N vẫn phủ liền, không để hở.";
    var t2 = "Đang phủ liền " + (R > 0 ? "1…" + nf(R) : "chưa được khối lượng nào") + " g với " + W.length + " quả; còn " + (d.m - W.length) + " quả nữa. Quả kế tiếp nên " + (two ? "≤ 2R + 1 = " : "≤ R + 1 = ") + nf(lim) + " g để không để hở.";
    var why = ["Hiện " + (W.length ? setText(W) : "chưa có quả nào") + " phủ liền 1…" + nf(R) + " g.",
      w <= lim ? "Quả " + nf(w) + " g ≤ " + (two ? "2R + 1 = " : "R + 1 = ") + nf(lim) + " nên không để hở và phủ liền tới " + nf(c2.R) + " g." : "Quả " + nf(w) + " g lớn hơn " + nf(lim) + " nên tạm hở ở " + nf(R + 1) + " g, nhưng " + (d.m - W.length - 1) + " quả sau lấp đủ (đã kiểm bằng tìm kiếm).",
      "Sau quả này vẫn còn cách hoàn thành đúng " + d.m + " quả (tối thiểu " + d.m + ": " + bound(d) + ")."];
    return mk(level, tech, level === 1 ? t1 : level === 2 ? t2 : "Đặt quả cân " + nf(w) + " g vào ô " + (slot + 1) + ".", level === 3 ? why : [], level === 1 ? [] : [slot], level === 3 ? { k: "set", i: slot, val: w } : null);
  }
  function closestRow(rows, cur) {
    var best = null, bd = 99;
    rows.forEach(function (r) { var dist = 0; for (var k = 0; k < r.length; k++) if (r[k] !== cur[k]) dist++; if (dist < bd) { bd = dist; best = r; } });
    return best;
  }
  function eqText(W, row, x) {
    var plus = [], minus = [];
    for (var i = 0; i < W.length; i++) { if (row[i] === 1) plus.push(nf(W[i])); else if (row[i] === 2) minus.push(nf(W[i])); }
    return nf(x) + " = " + (plus.length ? plus.join(" + ") : "0") + (minus.length ? " − " + minus.join(" − ") : "");
  }
  function hintDat(p, s, level) {
    var d = p.data, q = d.W.length, sub = submittedOf(d, s), j;
    if (sub && isComplete(d, s)) return { level: level, text: "Đã nộp.", why: [], cells: [], none: true };
    for (j = 0; j < d.X.length; j++) {
      var cur = rowOf(d, s, j), info = datRows(d.W, d.X[j]), used = rowUsed(cur);
      if (itemBalanced(d, s, j) && used === info.min) continue;
      var tgt = closestRow(info.rows, cur), k = 0;
      while (k < q && tgt[k] === cur[k]) k++;
      var bal = itemBalanced(d, s, j), sum = rowSum(d.W, cur), cell = j * q + k;
      var t1 = "Mỗi vật cân riêng: vật + quả cùng đĩa = quả ở đĩa đối diện. Cân bằng tam phân thường dùng ít quả nhất — quả dư ở đĩa kia thì đặt cùng đĩa với vật.";
      var t2 = "Vật " + (j + 1) + " (" + nf(d.X[j]) + " g): " + (bal ? "đang thăng bằng nhưng dùng " + used + " quả, tối thiểu là " + info.min : "đang lệch " + nf(Math.abs(d.X[j] - sum)) + " g") + " — cần đúng " + info.min + " quả.";
      var act = tgt[k] === 0 ? "bỏ quả " + nf(d.W[k]) + " g ra ngoài" : tgt[k] === 1 ? "đặt quả " + nf(d.W[k]) + " g ở đĩa đối diện vật" : "đặt quả " + nf(d.W[k]) + " g CÙNG đĩa với vật";
      var why = ["Vật " + (j + 1) + ": " + eqText(d.W, tgt, d.X[j]) + " — " + info.min + " quả, không cách nào ít hơn (đã vét " + nf(popow(3, q)) + " cách đặt).", "Bố trí tối thiểu gần nhất với hiện tại: " + act + "."];
      return mk(level, "Cân bằng tam phân", level === 1 ? t1 : level === 2 ? t2 : act.charAt(0).toUpperCase() + act.slice(1) + " (vật " + (j + 1) + ").", level === 3 ? why : [], level === 1 ? [] : [cell], level === 3 ? { k: "place", item: j, i: k, val: tgt[k] } : null);
    }
    return mk(level, "Nộp", level === 1 ? "Mọi vật đã thăng bằng bằng số quả tối thiểu — hãy nộp." : "Cả " + d.X.length + " vật đều thăng bằng với tổng " + nf(usedOf(d, s)) + " quả = tối thiểu: nộp.", level === 3 ? ["Tổng " + nf(d.best) + " quả là mức tối thiểu của từng vật cộng lại (mỗi vật vét hết " + nf(popow(3, q)) + " cách đặt)."] : [], [], level === 3 ? { k: "submit" } : null);
  }
  function hint(p, s, level) { return p.data.mode === "dat" ? hintDat(p, s, level) : hintSet(p, s, level); }

  // ================================================================================================= replay
  function replaySteps(p) {
    var d = p.data, s = { v: p.initial.v.slice(), c: null }, L = layoutOf(d), steps = [], sol = p.solution.v, i, j, k;
    function push(ch, text, why, cells) { var df = diffOf(s, ch, text); if (!df) return; steps.push({ text: text, why: why || [], diff: { d: df.d }, cells: cells || [], technique: d.mode === "dat" ? "Cân bằng" : "Phủ liền" }); s = after(s, df); }
    if (d.mode === "dat") {
      var q = d.W.length;
      for (j = 0; j < d.X.length; j++) {
        var row = sol.slice(j * q, (j + 1) * q);
        for (k = 0; k < q; k++) if (row[k]) push([[j * q + k, row[k]]], "Vật " + (j + 1) + ": " + (row[k] === 1 ? "đặt quả " + nf(d.W[k]) + " g ở đĩa đối diện" : "đặt quả " + nf(d.W[k]) + " g cùng đĩa với vật"), [eqText(d.W, row, d.X[j])], [j * q + k]);
      }
    } else {
      var W = [], two = both(d.mode);
      for (i = 0; i < d.slots; i++) if (sol[i] > 0) {
        var R0 = coverInfo(W, d.N, two).R; W.push(sol[i]); var c = coverInfo(W, d.N, two);
        push([[i, sol[i]]], "Đặt quả cân " + nf(sol[i]) + " g vào ô " + (i + 1), ["Trước đó phủ liền 1…" + nf(R0) + "; thêm quả " + nf(sol[i]) + " g phủ liền tới " + nf(c.R) + "."], [i]);
      }
    }
    push([[L.flag, 1]], "Nộp", d.mode === "dat" ? ["Mọi vật thăng bằng với tổng " + nf(d.best) + " quả (tối thiểu)."] : ["Bộ " + setText(wlist(d, s)) + " cân được mọi khối lượng 1…" + nf(d.N) + " g với " + d.m + " quả (tối thiểu)."], []);
    return steps;
  }

  // ================================================================================================= đề tự nhập / I-O
  function fail(errors, extra) { return Object.assign({ ok: false, errors: errors, warnings: [], status: "none", count: 0 }, extra || {}); }
  function ascii(s) { return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim(); }
  function listOf(x) {
    if (Array.isArray(x)) { var out = x.map(function (e) { return typeof e === "string" && /^\s*\d+\s*$/.test(e) ? Number(e) : e; }); return out; }
    if (typeof x === "string") { var parts = x.split(/[\s,;]+/).filter(function (t) { return t !== ""; }); return parts.map(function (t) { return /^\d+$/.test(t) ? Number(t) : NaN; }); }
    return null;
  }
  function numOf(x) { return typeof x === "string" && /^\s*\d+\s*$/.test(x) ? Number(x) : x; }
  function fromInputAt(inp, seed) {
    if (!inp || typeof inp !== "object") return fail(["Thiếu dữ liệu đề."]);
    var mode = inp.mode;
    if (MODES.indexOf(mode) < 0) return fail(["Cỡ phải là 'hai' (chọn bộ, hai đĩa), 'mot' (chọn bộ, một đĩa) hoặc 'dat' (đặt quả cân cho vật)."]);
    var p, warns = [];
    if (mode === "dat") {
      var W = listOf(inp.W), X = listOf(inp.X), errs = [];
      if (!W || !W.length || W.length > MAX_W || !W.every(function (w) { return isInt(w, 1, MAX_WV); })) errs.push("Bộ quả cân W: 1–" + MAX_W + " số nguyên 1–" + MAX_WV + " g (ngăn cách bằng dấu phẩy).");
      if (!X || !X.length || X.length > MAX_Q || !X.every(function (x) { return isInt(x, 1, MAX_WV * MAX_W); })) errs.push("Các vật X: 1–" + MAX_Q + " số nguyên dương (g).");
      if (errs.length) return fail(errs);
      W = W.slice().sort(asc);
      var impossible = X.filter(function (x) { return datRows(W, x).min === 99; });
      if (impossible.length) return fail(["Vật " + impossible.map(nf).join(", ") + " g không thể cân bằng với bộ " + setText(W) + " (mỗi quả dùng tối đa một lần). Đổi vật hoặc thêm quả cân."]);
      p = buildDat(seed, "tu-nhap", W, X, "custom");
      if (!p) return fail(["Không dựng được lời giải cho đề này."]);
      if (X.length !== X.filter(function (x, i) { return X.indexOf(x) === i; }).length) warns.push("Có hai vật cùng khối lượng — hợp lệ nhưng thừa.");
      if (W.some(function (w, i) { return i && W[i - 1] === w; })) warns.push("Có hai quả cân trùng khối lượng.");
      var tot = p.data.best;
      return { ok: true, puzzle: p, errors: [], warnings: warns, status: "unique", count: 1, statusKind: "ok", statusText: "✓ Tối thiểu " + nf(tot) + " quả cho " + X.length + " vật (vét hết " + nf(popow(3, W.length)) + " cách đặt mỗi vật)" };
    }
    var N = numOf(inp.N);
    if (!isInt(N, 1, MAXN[mode])) return fail(["Khối lượng lớn nhất N phải là số nguyên 1–" + MAXN[mode] + "."]);
    p = buildSet(seed, "tu-nhap", mode, N, "custom");
    var two = both(mode), m = p.data.m, uniq = N === capOf(m, two);
    if (N < 4) warns.push("N nhỏ: bài toán gần như tầm thường.");
    return { ok: true, puzzle: p, errors: [], warnings: warns, status: "unique", count: uniq ? 1 : 2, statusKind: "ok",
      statusText: "✓ Tối thiểu " + m + " quả (" + (two ? "⌈log3(2N+1)⌉" : "⌈log2(N+1)⌉") + ")" + (uniq ? ", bộ tối ưu duy nhất " + setText(canonical(N, two)) : ", có nhiều bộ tối ưu (vd " + setText(canonical(N, two)) + ")") };
  }
  function fromInput(inp) { return fromInputAt(inp, null); }
  function inputOf(d) { return d.mode === "dat" ? { mode: "dat", W: d.W.slice(), X: d.X.slice() } : { mode: d.mode, N: d.N }; }

  function parseText(text) {
    var t = ascii(text == null ? "" : text), mw = /\bw\s*[=:]\s*([\d,\s;]+?)(?=\s*[a-z]\s*[=:]|$)/.exec(t), mx = /\bx\s*[=:]\s*([\d,\s;]+?)(?=\s*[a-z]\s*[=:]|$)/.exec(t), mn = /\bn\s*[=:]\s*(\d+)/.exec(t);
    var mode = /\bdat\b/.test(t) || mw || mx ? "dat" : /\bmot\b/.test(t) ? "mot" : /\bhai\b/.test(t) ? "hai" : null;
    if (!mode) return { err: "Thiếu cỡ: 'bachet hai N=40', 'bachet mot N=15' hoặc 'bachet dat W=1,3,9,27 X=25,14'." };
    if (mode === "dat") { if (!mw || !mx) return { err: "Thiếu W (bộ quả cân) hoặc X (các vật): ví dụ 'bachet dat W=1,3,9,27 X=25,14'." }; return { inp: { mode: "dat", W: mw[1].trim(), X: mx[1].trim() } }; }
    if (!mn) return { err: "Thiếu N: ví dụ 'bachet " + mode + " N=40'." };
    return { inp: { mode: mode, N: Number(mn[1]) } };
  }
  function toText(p) { var d = p.data; return d.mode === "dat" ? "bachet dat W=" + d.W.join(",") + " X=" + d.X.join(",") : "bachet " + d.mode + " N=" + d.N; }
  function fromText(text) { var r = parseText(text); return r.err ? { ok: false, errors: [r.err], warnings: [] } : fromInput(r.inp); }
  function solText(p) {
    var d = p.data, v = p.solution.v;
    if (d.mode === "dat") { var q = d.W.length; return d.X.map(function (x, j) { return eqText(d.W, v.slice(j * q, (j + 1) * q), x); }).join("; "); }
    return v.slice(0, d.slots).filter(function (w) { return w > 0; }).join(" ");
  }
  function toFile(p) {
    var d = p.data;
    return { type: "bachet", seed: p.seed, difficulty: p.score, size: p.size, initialState: d.mode === "dat" ? "mode=dat;W=" + d.W.join(",") + ";X=" + d.X.join(",") : "mode=" + d.mode + ";N=" + d.N, solution: solText(p), metadata: p.meta || {} };
  }
  function fromFile(o) {
    if (!o || typeof o !== "object" || typeof o.initialState !== "string") return { ok: false, errors: ["Thiếu initialState (dạng mode=hai;N=… hoặc mode=dat;W=…;X=…)."], warnings: [] };
    var m = {}; o.initialState.split(";").forEach(function (kv) { var i = kv.indexOf("="); if (i > 0) m[kv.slice(0, i).trim()] = kv.slice(i + 1).trim(); });
    var r = fromInput(m.mode === "dat" ? { mode: "dat", W: m.W || "", X: m.X || "" } : { mode: m.mode, N: m.N === undefined ? NaN : Number(m.N) });
    if (r.ok && o.metadata && typeof o.metadata === "object" && typeof o.metadata.name === "string") r.puzzle.meta = { name: o.metadata.name.slice(0, 80) };
    return r;
  }

  // ================================================================================================= Constraint View, trace
  function constraintView(p) {
    var d = p.data, two = both(d.mode);
    if (d.mode === "dat") {
      var q = d.W.length, vars = [{ name: "Ô (vật j, quả k)", domain: "{0 ngoài, 1 đĩa đối diện, 2 cùng đĩa}", count: q * d.X.length }], cons = d.X.map(function (x, j) { return "Vật " + (j + 1) + ": " + nf(x) + " + Σ(quả cùng đĩa) = Σ(quả đối diện)"; });
      cons.push("Mục tiêu: ít quả nhất (Σ ô khác 0) — tối thiểu từng vật cộng lại = " + nf(d.best));
      return { summary: "Bộ " + setText(d.W) + ", " + d.X.length + " vật: " + d.X.map(nf).join(", ") + " g", variables: vars, constraints: cons, counts: { variables: q * d.X.length, constraints: d.X.length, "cách đặt mỗi vật": popow(3, q) } };
    }
    var vars2 = [{ name: "Quả cân i", domain: "{0 (trống), 1…" + nf(d.N) + "}", count: d.slots }];
    var cons2 = ["Mỗi khối lượng t ∈ 1…" + nf(d.N) + " phải bằng một tổng " + (two ? "ε₁w₁ + … + ε_mw_m, ε ∈ {−1, 0, +1} (đĩa đối diện / ngoài / cùng đĩa với vật)" : "ε₁w₁ + … + ε_mw_m, ε ∈ {0, +1} (một đĩa)"),
      "Cận đếm: m quả phân biệt tối đa " + (two ? "3^m" : "2^m") + " tổng ⇒ " + (two ? "(3^m − 1)/2" : "2^m − 1") + " ≥ " + nf(d.N) + " ⇒ m ≥ " + d.m, "Mục tiêu: ít quả nhất (tối thiểu " + d.m + ")"];
    return { summary: "Phủ 1…" + nf(d.N) + " g bằng " + (two ? "quả cân đặt hai đĩa" : "quả cân một đĩa") + ", tối thiểu " + d.m + " quả", variables: vars2, constraints: cons2, counts: { variables: d.slots, constraints: d.N, "số quả tối thiểu": d.m } };
  }
  function trace(p) {
    var d = p.data, rows, steps = [], i;
    if (d.mode === "dat") {
      rows = [["Vật", "Khối lượng", "Số quả tối thiểu", "Một bố trí tối ưu"]];
      d.X.forEach(function (x, j) { var info = datRows(d.W, x); rows = rows.concat([[j + 1, nf(x), info.min, eqText(d.W, info.rows[0], x)]]); steps.push({ text: "Vật " + (j + 1) + " (" + nf(x) + " g): vét " + nf(popow(3, d.W.length)) + " cách đặt, ít nhất " + info.min + " quả, có " + info.rows.length + " bố trí tối ưu: " + eqText(d.W, info.rows[0], x) + ".", matrix: rows.map(function (r) { return r.slice(); }), pivot: [j + 1, 2] }); });
      return { kind: "matrix", title: "Tối thiểu từng vật (vét hết 3^|W| cách đặt)", steps: steps, note: "Tổng các tối thiểu = " + nf(d.best) + " quả. Cân bằng tam phân (quả dư đặt cùng đĩa với vật) thường là cách ít quả nhất." };
    }
    var two = both(d.mode), C = canonical(d.N, two), W = [];
    rows = [["Quả", "Khối lượng", "Phủ liền 1…", "Số tổng phân biệt"]];
    for (i = 0; i < C.length && i < 60; i++) {
      W.push(C[i]); var c = coverInfo(W, d.N, two);
      rows = rows.concat([[i + 1, nf(C[i]), nf(Math.min(c.R, d.N)), c.count]]);
      steps.push({ text: "Thêm quả " + nf(C[i]) + " g: bộ " + setText(W) + " phủ liền 1…" + nf(c.R) + " g, " + c.count + " tổng phân biệt" + (c.covered ? " — đã phủ đủ 1…" + nf(d.N) + "." : "."), matrix: rows.map(function (r) { return r.slice(); }), pivot: [i + 1, 2] });
    }
    return { kind: "matrix", title: "Phủ liền tăng dần theo từng quả cân", steps: steps, note: (two ? "Mỗi quả mới ≤ 2R + 1 (R = phủ liền hiện có) nên phủ liền tới R + w." : "Mỗi quả mới ≤ R + 1 nên phủ liền tới R + w.") + " Quả cuối là phần còn thiếu của N." };
  }

  // ================================================================================================= sinh đề
  var SIZES = [
    { id: "hai", label: "Chọn bộ — quả cân đặt được hai đĩa", params: { mode: "hai" }, default: true },
    { id: "mot", label: "Chọn bộ — quả cân chỉ một đĩa", params: { mode: "mot" } },
    { id: "dat", label: "Đặt quả cân cho vật cho trước", params: { mode: "dat" } }
  ];
  var poolMemo = {};
  function setPool(mode, tier) {
    var key = mode + "/" + tier;
    if (poolMemo[key]) return poolMemo[key];
    var band = P.util.tier(tier), out = [];
    for (var N = 4; N <= MAXN[mode]; N++) { var sc = scoreOf({ mode: mode, N: N }); if (sc >= band.min && sc < band.max) out.push(N); }
    poolMemo[key] = out;
    return out;
  }
  var DAT_SHAPE = { easy: [3, 2], medium: [4, 3], hard: [5, 4], expert: [6, 5] };
  var CURRENCY = [1, 2, 5, 10, 20, 50, 100, 200];
  function datWeights(rng, nW) {
    var fam = rng.fork("fam").int(4), W, i;
    if (fam <= 1) { W = []; for (i = 0; i < nW; i++) W.push(popow(3, i)); }
    else if (fam === 2) W = CURRENCY.slice(0, nW);
    else { W = [1]; var pool = []; for (i = 2; i <= nW * 6; i++) pool.push(i); var pick = rng.fork("w").shuffle(pool).slice(0, nW - 1); W = W.concat(pick).sort(asc); }
    return W;
  }
  function genDat(seed, sizeId, tier) {
    var shape = DAT_SHAPE[tier], rng = P.rng.create(seed).fork("bachet-dat"), nW = shape[0], q = shape[1];
    for (var tries = 0; tries < 30; tries++) {
      var r = rng.fork("t" + tries), W = datWeights(r, nW), total = sumOf(W), cands = [], x, minNeed = tier === "easy" ? 2 : 3;
      for (x = 1; x <= total; x++) { var info = datRows(W, x); if (info.min !== 99 && info.min >= Math.min(minNeed, nW - 1)) cands.push(x); }
      if (cands.length < q) continue;
      var X = r.fork("x").shuffle(cands.slice()).slice(0, q), p = buildDat(seed, sizeId, W, X, tier);
      if (p) return p;
    }
    return buildDat(seed, sizeId, [1, 3, 9, 27].slice(0, nW), [4, 7, 11, 25, 22].slice(0, q), tier);
  }

  var def = {
    id: "bachet", name: "Quả cân Bachet", family: "Mathematical Puzzle", category: "Lý thuyết số", icon: "🏋",
    blurb: "Bộ quả cân ít nhất để cân mọi khối lượng 1…N g trên cân hai đĩa — hay đặt quả cân cho một vật: cân bằng tam phân 1, 3, 9, 27…",
    rules: [
      "Cân hai đĩa. Vật đặt ở đĩa TRÁI. Quả cân đặt ở đĩa PHẢI (đối diện vật) hoặc — ở cỡ \"hai đĩa\" — ở đĩa TRÁI cùng với vật; mỗi quả dùng tối đa một lần cho mỗi lần cân.",
      "Cỡ \"Chọn bộ\": bạn điền khối lượng (số nguyên gam) các quả cân vào các ô. Bộ hợp lệ nếu MỌI khối lượng nguyên từ 1 đến N g đều cân được thăng bằng. Ít quả hơn là tốt hơn.",
      "Cỡ \"một đĩa\": quả cân chỉ được đặt ở đĩa đối diện vật (không đặt cùng đĩa) — số khối lượng đo được ít hơn nên cần nhiều quả hơn.",
      "Cỡ \"Đặt quả cân\": cho sẵn bộ quả cân và vài vật; với MỖI vật hãy chọn từng quả: để ngoài / đĩa đối diện / cùng đĩa với vật sao cho cân thăng bằng và dùng ít quả nhất.",
      "Nộp xong ván kết thúc và được chấm theo số quả so với tối thiểu (3★ = tối thiểu). Gợi ý và bàn đếm \"nước làm mất tối ưu\" — hoàn tác được, nhưng lỗi đã tính."
    ],
    sizes: SIZES.map(function (z) { return { id: z.id, label: z.label, params: z.params, default: z.default || undefined }; }),
    algorithm: {
      title: "Cân bằng tam phân và cận đếm",
      steps: [
        { title: "Đếm khả năng", text: "Mỗi quả cân có 3 cách dùng (đĩa đối diện, cùng đĩa với vật, để ngoài) nên m quả cho tối đa 3^m tổng, đối xứng quanh 0 ⇒ phủ liền 1…N cần (3^m − 1)/2 ≥ N, tức m ≥ ⌈log3(2N + 1)⌉. Một đĩa chỉ 2 cách ⇒ 2^m − 1 ≥ N." },
        { title: "Dựng bộ tối ưu", text: "Hai đĩa: 1, 3, 9, …, 3^(m−2) phủ liền tới R = (3^(m−1) − 1)/2; quả cuối = N − R (≤ 2R + 1 nên không để hở). Một đĩa: 1, 2, 4, … rồi N − (2^(m−1) − 1). N = (3^m − 1)/2 hoặc 2^m − 1 thì bộ tối ưu duy nhất." },
        { title: "Phủ liền", text: "Giữ R = số lớn nhất sao cho 1…R đều cân được; quả mới w giữ phủ liền khi w ≤ 2R + 1 (hai đĩa) hay w ≤ R + 1 (một đĩa), khi đó R mới = R + w." },
        { title: "Đặt quả cân cho một vật", text: "Cho bộ W cố định: x = Σ ε_i·w_i với ε ∈ {−1, 0, +1}; số cách 3^|W| ≤ 6 561 nên vét hết để biết số quả tối thiểu của từng vật (cân bằng tam phân dùng ít quả nhất với luỹ thừa 3)." },
        { title: "Gợi ý có chứng minh", text: "Bộ đang chọn còn \"mở rộng được\" không? DFS thêm các quả tăng dần, cắt tỉa bằng đếm (số tổng đang có × 3^r phải ≥ 2N + 1). Hết ngân sách thì nói thật là chưa chứng minh được." }
      ],
      links: [{ id: "coin-change", label: "Đổi tiền (QHĐ)" }, { id: "meet-in-the-middle", label: "Gặp nhau ở giữa" }, { id: "bit-manipulation", label: "Thao tác bit" }]
    },
    difficultyNote: "Cỡ chọn bộ: điểm theo số quả tối thiểu m (Dễ m ≤ 3, Vừa 4, Khó 5, Chuyên gia ≥ 6 với hai đĩa) + 0,4 nếu N không phải biên (3^m − 1)/2 (khi đó có nhiều bộ tối ưu và quả cuối là phần dư). Cỡ đặt quả cân: −2,2 + 0,9·(số quả cân) + 1,05·(số vật) + 0,4 nếu bộ không phải 1, 3, 9, 27….",
    kind: "optimize", objective: { sense: "min", label: "Số quả cân dùng", unit: "quả" },
    sizeLabel: "Bài toán",
    moveLabel: "Số thao tác (điền ô, xoá, nộp — hoàn tác không làm giảm)",
    mistakeLabel: "Nước làm mất tối ưu / nộp khi chưa đạt",
    sizeText: function (p) {
      var d = p && p.data;
      if (!dataOk(d)) return "";
      return d.mode === "dat" ? d.W.length + " quả cân · " + d.X.length + " vật" : "N = " + nf(d.N) + " g · " + (d.mode === "hai" ? "hai đĩa" : "một đĩa");
    },

    generate: function (seed, o) {
      o = o || {};
      var sz = P.types.sizeOf(def, o.sizeId), mode = sz.params.mode, tier = P.util.tier(o.tier) ? o.tier : "easy";
      if (mode === "dat") return genDat(seed, sz.id, tier);
      var pool = setPool(mode, tier), rng = P.rng.create(seed).fork("bachet-" + mode);
      var N = pool.length ? pool[rng.fork("n").int(pool.length)] : (mode === "hai" ? 13 : 15);
      return buildSet(seed, sz.id, mode, N, tier);
    },
    fromInput: fromInput,
    validate: function (p) {
      if (!p || !dataOk(p.data)) return { ok: false, errors: ["Đề thiếu dữ liệu."], status: "none", count: 0, solution: null };
      var r = fromInputAt(inputOf(p.data), p.seed == null ? null : p.seed);
      return { ok: r.ok, errors: r.errors, status: r.status, count: r.count, solution: r.ok ? r.puzzle.solution : null };
    },
    solve: function (p) {
      var d = p.data, r = fromInputAt(inputOf(d), p.seed == null ? null : p.seed);
      if (!r.ok) return { status: "none", count: 0, solution: null, steps: [], techniques: {}, nodes: 0 };
      var rs = replaySteps(r.puzzle), tech = {};
      rs.forEach(function (st) { tech[st.technique] = (tech[st.technique] || 0) + 1; });
      return { status: r.status, count: r.count, solution: { v: r.puzzle.solution.v.slice() }, value: d.mode === "dat" ? d.best : minCount(d.N, both(d.mode)), nodes: d.mode === "dat" ? popow(3, d.W.length) * d.X.length : d.N,
        steps: rs.map(function (st) { return { technique: st.technique, text: st.text }; }), techniques: tech };
    },
    difficulty: function (p) { return scoreOf(p.data); },
    newState: function (p) { return { v: p.initial.v.slice(), c: null }; },
    isGiven: function () { return false; },
    moveFor: moveFor, check: check, mistakes: mistakes, grade: grade, hint: hint,
    replay: replaySteps,
    constraintView: constraintView, trace: trace,
    toText: toText, fromText: fromText, toFile: toFile, fromFile: fromFile,
    describeCell: function (p, s, i) {
      var d = p.data;
      if (d.mode === "dat") {
        var q = d.W.length, j = Math.floor(i / q), k = i % q;
        if (!isInt(i, 0, q * d.X.length - 1)) return "Ô không hợp lệ";
        var val = s.v[i];
        return "Vật " + (j + 1) + " (" + nf(d.X[j]) + " g), quả " + nf(d.W[k]) + " g: " + (val === 1 ? "đĩa đối diện vật" : val === 2 ? "cùng đĩa với vật" : "để ngoài");
      }
      if (!isInt(i, 0, d.slots - 1)) return "Ô không hợp lệ";
      return "Quả cân thứ " + (i + 1) + ": " + (s.v[i] > 0 ? nf(s.v[i]) + " g" : "trống");
    }
  };

  /** Hàm thuần cho bàn chơi và test (không thuộc hợp đồng chung). */
  def.lib = {
    MAXN: MAXN, MAX_W: MAX_W, MAX_WV: MAX_WV, MAX_Q: MAX_Q, BUDGET: BUDGET, capOf: capOf, minCount: minCount, canonical: canonical, reachOf: reachOf, coverInfo: coverInfo, feasible: feasible, msDiff: msDiff,
    datRows: datRows, rowSum: rowSum, rowUsed: rowUsed, arrange: arrange, layoutOf: layoutOf, scoreOf: scoreOf, setPool: setPool, buildSet: buildSet, buildDat: buildDat, weightsOf: weightsOf, wlist: wlist,
    isComplete: isComplete, itemBalanced: itemBalanced, rowOf: rowOf, usedOf: usedOf, closestRow: closestRow, eqText: eqText, fromInputAt: fromInputAt, valueOf: valueOf, setText: setText, isPow3Prefix: isPow3Prefix, DAT_SHAPE: DAT_SHAPE
  };

  P.types.register(def);
  if (typeof module !== "undefined" && module.exports) module.exports = def;
})(typeof globalThis !== "undefined" ? globalThis : this);
