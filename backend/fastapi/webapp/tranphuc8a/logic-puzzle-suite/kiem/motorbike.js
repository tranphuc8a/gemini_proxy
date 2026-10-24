/* kiem/motorbike.js — kiểm ĐI BỘ & XE MÁY (đợt P5). Nguồn sự thật ĐỘC LẬP với engine (viết riêng trong test, không gọi công thức của engine để tính giá trị đối chiếu):
     · LP cận dưới giải bằng LIỆT KÊ ĐỈNH (5 biến, ràng buộc tuyến tính, số thực) cho 768 bộ (n ≤ 12, k ≤ 4, m ∈ 8 giá trị gồm phân số, cả hai cách hiểu, cả đề chia hết lẫn không) = lbOf;
     · VÉT CẠN THEO TRẠNG THÁI (BFS trên mọi kế hoạch của lưới, loại đối xứng người/xe, khử trùng trạng thái) ở bộ nhỏ: tối thiểu = công thức khi biết tối ưu chính xác,
       không bao giờ dưới cận LP khi không chia hết;
     · BỘ MÔ PHỎNG số thực viết riêng (hàm fsim) so với engine (phân số BigInt) trên kế hoạch ngẫu nhiên hợp lệ; công thức đóng của lịch mẫu (T = 1 − x(1 − 1/m), x = (m+1)/(m+2g−1);
       tiếp sức T = 1 − d(1 − 1/m)) tính lại riêng; mọi người tới CÙNG LÚC ở lịch mẫu;
     · kế hoạch ngẫu nhiên / đột biến lịch tối ưu KHÔNG BAO GIỜ dưới cận LP (hàng nghìn kế hoạch);
     · bảng đối chiếu của thiết kế (13/25, 3/4, 7/9, 2/5, 19/54, 3/7, 13/28, 7/12) chỉ làm bảng đối chiếu; sự thật là các phép trên.
   Cộng các phép hợp đồng của mục 11.6: check/grade, hint (khớp tiền tố bất biến đổi tên, rẽ khỏi lịch → quay về), replay, I/O, options, diff/reverse, dung lượng, thời gian. */
"use strict";
var fs = require("fs"), path = require("path");

module.exports = function (t) {
  var Puz = t.Puz, T = Puz.types.get("motorbike"), L = T.lib, G = Puz.game, plan = Puz.plan, R = Puz.rng, GR = Puz.grade;
  var ROOT = path.join(__dirname, "..");
  var TIERS = ["easy", "medium", "hard", "expert"], INTERPS = ["A", "B"], OPN = ["", "take", "ride", "meet", "off"];
  function J(x) { return JSON.stringify(x); }
  function inBand(score, tier) { var b = Puz.util.tier(tier); return score >= b.min && score < b.max; }
  function mk(interp, n, k, m) { var r = T.fromInput({ interp: interp, n: n, k: k, m: m }); return r.ok ? r.puzzle : null; }
  function apply(p, s, a) { var d = T.moveFor(p, s, a); if (!d) return null; G.applyDiff(s, d.d, false); return d; }
  function mval(m) { var a = String(m).split("/"); return Number(a[0]) / Number(a[1] || 1); }
  function mtext(mu, mv) { return mv === 1 ? String(mu) : mu + "/" + mv; }
  function actOf(r) { return { k: "cmd", bike: r[0], op: OPN[r[1]], a: r[2], b: r[3] }; }

  t.group("motorbike — đăng ký, hợp đồng");
  (function () {
    var dir = path.join(ROOT, "..", "algorithm-notebook", "assets", "data"), libs = fs.readdirSync(dir).filter(function (f) { return /^lib-.*\.js$/.test(f); }), text = libs.map(function (f) { return fs.readFileSync(path.join(dir, f), "utf8"); }).join("\n");
    t.ok("algorithm.links[].id có thật trong algorithm-notebook/lib-*.js (ternary-search, gaussian-elimination)", T.algorithm.links.length >= 2 && T.algorithm.links.every(function (l) { return text.indexOf('id: "' + l.id + '"') >= 0; }), T.algorithm.links);
  })();
  t.ok("loại đã đăng ký, tuân giao diện, kind optimize, objective min, có grade + options interp", !!T && Puz.types.conformance(T).length === 0 && Puz.types.kindOf(T) === "optimize" && T.objective.sense === "min" && typeof T.grade === "function" && T.options.length === 1 && T.options[0].id === "interp" && T.options[0].default === "A");
  t.ok("tên, icon, category theo thiết kế; không dùng 'goal'", T.name === "Đi bộ & xe máy" && T.icon === "🛵" && T.category === "Tối ưu (LP)" && T.goal === undefined);

  // ====================================================================== 1. LP độc lập (liệt kê đỉnh)
  function lpMin(n, k, m, interp) {
    var c = k / n, A = interp === "A", rows = [];
    rows.push(A ? [[-(1 - 1 / m), 1 + 1 / m, 0, 0, -1], -1] : [[-(1 - 1 / m), 0, 0, 0, -1], -1]);
    rows.push([[1, 0, -(A ? 2 : 1) * c, 0, 0], 0]);
    rows.push(A ? [[0, -1, 0, c, 0], 0] : [[0, 1, 0, 0, 0], 0]);
    rows.push([[0, 0, 1, -1, 0], 1]); rows.push([[0, 0, 1, 1, -m], 0]); rows.push([[1, -1, 0, 0, 0], 1]);
    for (var i = 0; i < 5; i++) { var e = [0, 0, 0, 0, 0]; e[i] = -1; rows.push([e, 0]); }
    var N = rows.length, best = Infinity, idx = [];
    function solve5(sel) {
      var M = sel.map(function (j) { return rows[j][0].slice().concat([rows[j][1]]); }), r, c2, p, q;
      for (c2 = 0; c2 < 5; c2++) {
        p = -1; var bv = 1e-12;
        for (r = c2; r < 5; r++) if (Math.abs(M[r][c2]) > bv) { bv = Math.abs(M[r][c2]); p = r; }
        if (p < 0) return null;
        var tmp = M[p]; M[p] = M[c2]; M[c2] = tmp;
        for (r = 0; r < 5; r++) if (r !== c2) { var f = M[r][c2] / M[c2][c2]; for (q = c2; q <= 5; q++) M[r][q] -= f * M[c2][q]; }
      }
      return M.map(function (row, ii) { return row[5] / row[ii]; });
    }
    (function rec(start) {
      if (idx.length === 5) {
        var x = solve5(idx); if (!x) return;
        for (var j = 0; j < N; j++) { var s = 0; for (var q2 = 0; q2 < 5; q2++) s += rows[j][0][q2] * x[q2]; if (s > rows[j][1] + 1e-9) return; }
        if (x[4] < best) best = x[4];
        return;
      }
      for (var i2 = start; i2 < N; i2++) { idx.push(i2); rec(i2 + 1); idx.pop(); }
    })(0);
    return best;
  }
  var MS = [[3, 2], [2, 1], [5, 2], [3, 1], [7, 2], [4, 1], [5, 1], [8, 1]];
  function dOf(interp, n, k, mu, mv) { return { interp: interp, n: n, k: k, mu: mu, mv: mv }; }
  t.group("motorbike — cận dưới LP = công thức (LP liệt kê đỉnh viết riêng)");
  (function () {
    var tot = 0, bad = [], regimes = {};
    INTERPS.forEach(function (ip) { for (var k = 1; k <= 4; k++) for (var n = 1; n <= 12; n++) MS.forEach(function (ms) {
      var lp = lpMin(n, k, ms[0] / ms[1], ip), f = L.qf(L.lbOf(dOf(ip, n, k, ms[0], ms[1]))); tot++;
      if (!(Math.abs(lp - f) < 1e-9)) bad.push([ip, n, k, mtext(ms[0], ms[1]), lp, f]);
      regimes[L.regimeOf(dOf(ip, n, k, ms[0], ms[1]))] = 1;
    }); });
    t.ok("lbOf (BigInt) = LP liệt kê đỉnh ở " + tot + " bộ (sai khác < 1e-9); đủ các chế độ " + Object.keys(regimes).sort().join(", "), bad.length === 0 && Object.keys(regimes).length === 5, bad.slice(0, 4));
  })();

  // ====================================================================== 2. công thức đóng + bảng thiết kế, mọi người tới cùng lúc
  t.group("motorbike — công thức đóng (tính lại riêng) và bảng đối chiếu của thiết kế");
  (function () {
    var table = [["A", 4, 1, "5", "13/25"], ["A", 4, 1, "2", "3/4"], ["A", 6, 1, "3", "7/9"], ["A", 6, 2, "5", "2/5"], ["A", 9, 3, "6", "19/54"], ["A", 8, 2, "7", "3/7"], ["A", 3, 1, "4", "13/28"], ["A", 8, 2, "2", "3/4"], ["B", 3, 1, "5", "13/25"], ["B", 6, 2, "4", "7/12"]], bad = [];
    table.forEach(function (e) {
      var p = mk(e[0], e[1], e[2], e[3]), s = p && L.simOf(p, { v: p.solution.v });
      if (!p || !s.ok || L.qs(s.T) !== e[4] || p.data.best !== e[4] || !s.arrivals.every(function (a) { return L.qs(a) === e[4]; })) bad.push([e.join(","), s && s.ok ? L.qs(s.T) : s && s.error.msg]);
    });
    t.ok("10 ca trong bảng thiết kế 5.2: T và lời giải khớp từng phân số, mọi người tới B cùng lúc (BigInt)", bad.length === 0, bad);
    var bad2 = [], cnt = 0;
    L.pool("A").concat(L.pool("B").map(function (q) { return Object.assign({ b: 1 }, q); })).forEach(function (q) {
      var ip = q.b ? "B" : "A", p = mk(ip, q.n, q.k, mtext(q.mu, q.mv)); if (!p) { bad2.push(["không dựng được", ip, q.n, q.k, q.mu, q.mv]); return; }
      var d = p.data, m = d.mu / d.mv, s = L.simOf(p, { v: p.solution.v }), g, x, Tcl, fam = d.fam;
      if (ip === "A" && fam === "dua-don") { g = d.n / d.k - 1; x = (m + 1) / (m + 2 * g - 1); Tcl = 1 - x * (1 - 1 / m); }
      else if (ip === "A" && fam === "tiep-suc") { Tcl = 1 - (2 * d.k / d.n) * (1 - 1 / m); }
      else if (ip === "B") { g = d.n / d.k; x = (m + 1) / (m + 2 * g - 1); Tcl = 1 - x * (1 - 1 / m); }
      cnt++;
      if (!s.ok || Math.abs(L.qf(s.T) - Tcl) > 1e-12 || !s.arrivals.every(function (a) { return L.qcmp(a, s.T) === 0; })) bad2.push([ip, d.n, d.k, mtext(d.mu, d.mv), fam, s.ok && L.qf(s.T), Tcl]);
    });
    t.ok("mọi đề sinh được (" + cnt + " bộ, cả hai cách hiểu): T mô phỏng = 1 − x(1−1/m) (đưa-đón, x = (m+1)/(m+2g−1)) hoặc 1 − d(1−1/m) (tiếp sức d = 2k/n) tính lại riêng; mọi người tới cùng lúc", bad2.length === 0 && cnt > 100, bad2.slice(0, 4));
  })();

  // ====================================================================== 3. bộ mô phỏng số thực viết riêng + kế hoạch ngẫu nhiên
  /** Mô phỏng số thực (độc lập với BigInt của engine). recs = [[xe, lệnh, a, b]]. → {ok, T, arr} */
  function fsim(d, recs) {
    var n = d.n, k = d.k, Gd = d.G, m = d.mu / d.mv, A = d.interp !== "B", E = 1e-9, ps = [], bs = [], i;
    for (i = 0; i < n; i++) ps.push({ md: "w", x0: 0, t0: 0, dn: 0 });
    for (i = 0; i < k; i++) bs.push({ x: 0, t: 0, rd: A ? [] : [-1], q: [], qi: 0 });
    recs.forEach(function (r) { bs[r[0] - 1].q.push(r); });
    function real(b) { return b.rd.filter(function (z) { return z >= 0; }); }
    function walkAt(p, t) { return ps[p].x0 + (t - ps[p].t0); }
    var phase = 1;
    for (var guard = 0; guard < 5000; guard++) {
      var bi = -1;
      for (i = 0; i < k; i++) { var cand = phase === 1 ? bs[i].qi < bs[i].q.length : real(bs[i]).length > 0; if (cand && (bi < 0 || bs[i].t < bs[bi].t - 1e-15)) bi = i; }
      if (bi < 0) { if (phase === 1) { phase = 2; continue; } break; }
      var b = bs[bi], r = b.qi < b.q.length ? b.q[b.qi++] : [bi + 1, 2, Gd, 0], op = r[1], p, who;
      if (op === 1) {
        who = r[3] ? [r[2] - 1, r[3] - 1] : [r[2] - 1];
        if (A && b.rd.length) return { ok: false }; if (!A && (real(b).length || r[3])) return { ok: false };
        var tb = b.t;
        for (var j = 0; j < who.length; j++) { p = who[j]; if (!(p >= 0 && p < n) || ps[p].md !== "w" || walkAt(p, b.t) > b.x + E) return { ok: false }; tb = Math.max(tb, b.t + (b.x - walkAt(p, b.t))); }
        who.forEach(function (z) { ps[z].md = "b"; }); b.rd = (A ? [] : [-1]).concat(who); b.t = tb;
      } else if (op === 2) {
        if (!b.rd.length) return { ok: false };
        var x = r[2] / Gd; if (Math.abs(x - b.x) < E) return { ok: false };
        b.t += Math.abs(x - b.x) / m; b.x = x;
        if (Math.abs(x - 1) < E) { real(b).forEach(function (z) { ps[z].md = "d"; ps[z].dn = b.t; }); b.rd = A ? [] : [-1]; }
      } else if (op === 3) {
        p = r[2] - 1;
        if (!b.rd.length || b.rd.length >= 2 || !(p >= 0 && p < n) || ps[p].md !== "w") return { ok: false };
        var xq = walkAt(p, b.t); if (xq >= 1 - E) return { ok: false };
        var tm = xq >= b.x ? b.t + (xq - b.x) / (m - 1) : b.t + (b.x - xq) / (m + 1), xm = walkAt(p, tm);
        if (xm > 1 + E) return { ok: false };
        b.t = tm; b.x = xm; ps[p].md = "b"; b.rd.push(p);
      } else if (op === 4) {
        p = r[2] - 1; var at = b.rd.indexOf(p); if (!(p >= 0 && p < n) || at < 0) return { ok: false };
        b.rd.splice(at, 1); ps[p].md = "w"; ps[p].x0 = b.x; ps[p].t0 = b.t; if (b.x >= 1 - E) { ps[p].md = "d"; ps[p].dn = b.t; }
      } else return { ok: false };
    }
    var Tm = 0, arr = [];
    for (i = 0; i < n; i++) { var a = ps[i].md === "d" ? ps[i].dn : ps[i].md === "w" ? ps[i].t0 + 1 - ps[i].x0 : NaN; arr.push(a); Tm = Math.max(Tm, a); }
    return { ok: arr.every(function (a) { return a === a; }), T: Tm, arr: arr };
  }
  function randomPlan(p, rng, maxLen) {
    var d = p.data, s = T.newState(p), tries = 0, len = 1 + rng.int(maxLen);
    while (plan.count(s) < len && tries++ < len * 80) {
      var bike = 1 + rng.int(d.k), r = rng.next(), rec;
      if (r < 0.3) rec = [bike, 1, 1 + rng.int(d.n), rng.chance(0.6) && d.interp === "A" ? 1 + rng.int(d.n) : 0];
      else if (r < 0.6) rec = [bike, 2, rng.int(d.G + 1), 0];
      else if (r < 0.8) rec = [bike, 3, 1 + rng.int(d.n), 0];
      else rec = [bike, 4, 1 + rng.int(d.n), 0];
      if (rec[1] === 1 && rec[3] === rec[2]) rec[3] = 0;
      apply(p, s, actOf(rec));
    }
    return s;
  }
  t.group("motorbike — mô phỏng BigInt = mô phỏng số thực viết riêng; kế hoạch ngẫu nhiên không dưới cận LP");
  (function () {
    var rng = R.create(2026), cfgs = [["A", 4, 1, "5"], ["A", 6, 2, "3"], ["A", 5, 1, "2"], ["A", 8, 2, "7/2"], ["B", 5, 2, "4"], ["B", 3, 1, "5/2"], ["A", 12, 3, "2"], ["A", 2, 1, "3"]], n = 0, nonEmpty = 0, mism = [], below = [], valid = 0;
    cfgs.forEach(function (c) {
      var p = mk(c[0], c[1], c[2], c[3]), lb = L.qf(L.lbOf(p.data));
      for (var it = 0; it < 220; it++) {
        var s = randomPlan(p, rng, 16), recs = plan.read(s, L.LAYOUT), a = L.simOf(p, s), b = fsim(p.data, recs); n++;
        if (recs.length) nonEmpty++;
        if (!a.ok) { mism.push(["engine từ chối kế hoạch đã nhận", c.join(",")]); continue; }
        valid++;
        if (!b.ok || Math.abs(L.qf(a.T) - b.T) > 1e-9) mism.push([c.join(","), L.qf(a.T), b.T, J(recs).slice(0, 80)]);
        if (L.qf(a.T) < lb - 1e-12) below.push([c.join(","), L.qf(a.T), lb]);
      }
    });
    t.ok("engine (phân số BigInt) khớp mô phỏng số thực riêng trên " + n + " kế hoạch ngẫu nhiên hợp lệ (" + nonEmpty + " không rỗng, 8 đề, cả hai cách hiểu)", mism.length === 0 && nonEmpty > 1000, mism.slice(0, 3));
    t.ok("không kế hoạch ngẫu nhiên nào dưới cận dưới LP", below.length === 0 && valid > 1500, below.slice(0, 3));
    // đột biến lịch tối ưu: dịch một vị trí chở ±1..2 vạch / đổi chỗ hai lệnh → không bao giờ dưới LP (và dịch khỏi tối ưu thì T tăng)
    var bad = [], mut = 0, worse = 0, sameOpt = 0;
    L.pool("A").slice(0, 60).concat(L.pool("B").slice(0, 20).map(function (q) { return Object.assign({ b: 1 }, q); })).forEach(function (q) {
      var p = mk(q.b ? "B" : "A", q.n, q.k, mtext(q.mu, q.mv)), recs = plan.read({ v: p.solution.v }, L.LAYOUT), lb = L.qf(L.lbOf(p.data)), best = L.qf(L.qparse(p.data.best));
      recs.forEach(function (r, i) {
        if (r[1] !== 2 || r[2] === p.data.G) return;
        [-2, -1, 1, 2].forEach(function (dl) {
          var a = r[2] + dl; if (a < 1 || a >= p.data.G) return;
          var rr = recs.map(function (x) { return x.slice(); }); rr[i][2] = a; var sm = L.simulate(p.data, rr); if (!sm.ok) return; mut++;
          var tf = L.qf(sm.T);
          if (tf < lb - 1e-12) bad.push([q.n, q.k, i, dl, tf, lb]);
          if (tf > best + 1e-12) worse++; else sameOpt++;
        });
      });
    });
    t.ok("đột biến " + mut + " lịch tối ưu (dịch vị trí chở ±1/±2 vạch): không cái nào dưới LP; " + worse + " cái tệ hơn tối ưu, " + sameOpt + " bằng (đỉnh tối ưu không duy nhất)", bad.length === 0 && mut > 200 && worse > 50, bad.slice(0, 3));
  })();

  // ====================================================================== 4. vét cạn theo trạng thái (BFS, loại đối xứng)
  /** Mọi kế hoạch của lưới Gd (≤ depth lệnh), khử trùng theo trạng thái (vị trí/thời điểm xe, người). Trả {best (Q nhỏ nhất của "dừng ngay"), states}. */
  function bfsMin(base, depth, cap) {
    var d = Object.assign({}, base), k = d.k, n = d.n, A = d.interp === "A", seen = new Set(), frontier = [[]], best = null, states = 0, lvl;
    function key(r) {
      return J([r.bikes.map(function (b) { return [L.qs(b.x), L.qs(b.t), b.riders]; }), r.persons.map(function (q) { return [q.mode, L.qs(q.x0), L.qs(q.t0), q.done ? L.qs(q.done) : ""]; })]);
    }
    for (lvl = 0; lvl <= depth && frontier.length; lvl++) {
      var nextF = [];
      for (var fi = 0; fi < frontier.length; fi++) {
        var recs = frontier[fi], r = L.simulate(d, recs);
        if (!r.ok) continue;
        var kk = key(r); if (seen.has(kk)) continue; seen.add(kk); states++;
        if (recs.length && (best === null || L.qcmp(r.T, best) < 0)) best = r.T;
        if (states > cap) return { best: best, states: states, capped: true };
        if (lvl === depth) continue;
        var usedP = {}, usedB = {}, maxP = 0;
        recs.forEach(function (x) { usedB[x[0]] = 1; if (x[1] === 1) { usedP[x[2]] = 1; if (x[3]) usedP[x[3]] = 1; } else if (x[1] === 3 || x[1] === 4) usedP[x[2]] = 1; });
        var cp = []; for (var q = 1; q <= n; q++) if (usedP[q]) cp.push(q); for (q = 1; q <= n; q++) if (!usedP[q]) { cp.push(q); break; }
        var cb = []; for (var b = 1; b <= k; b++) if (usedB[b]) cb.push(b); for (b = 1; b <= k; b++) if (!usedB[b]) { cb.push(b); break; }
        cb.forEach(function (bk) {
          var cands = [];
          cp.forEach(function (a) { cands.push([bk, 1, a, 0]); if (A) cp.forEach(function (c2) { if (c2 !== a) cands.push([bk, 1, a, c2]); }); cands.push([bk, 3, a, 0]); cands.push([bk, 4, a, 0]); });
          for (var g = 0; g <= d.G; g++) cands.push([bk, 2, g, 0]);
          cands.forEach(function (c3) { nextF.push(recs.concat([c3])); });
        });
      }
      frontier = nextF;
    }
    return { best: best, states: states, capped: false };
  }
  t.group("motorbike — vét cạn theo trạng thái trên lưới nhỏ (độc lập với công thức)");
  (function () {
    var cases = [
      { d: dOf("A", 3, 1, 3, 1), G: 3, depth: 6, expect: "exact", name: "3 người, 1 xe, m=3" },
      { d: dOf("A", 3, 1, 4, 1), G: 7, depth: 6, expect: "exact", name: "3 người, 1 xe, m=4 (13/28)" },
      { d: dOf("A", 4, 1, 2, 1), G: 4, depth: 7, expect: "exact", name: "4 người, 1 xe, m=2 (tiếp sức 3/4)" },
      { d: dOf("A", 4, 1, 5, 1), G: 5, depth: 8, expect: "exact", name: "4 người, 1 xe, m=5 (13/25)" },
      { d: dOf("B", 2, 1, 3, 1), G: 6, depth: 6, expect: "exact", name: "xe ôm 2 người, 1 xe, m=3" },
      { d: dOf("A", 3, 1, 2, 1), G: 10, depth: 6, expect: "bound", name: "3 người, 1 xe, m=2 (không chia hết)" },
      { d: dOf("A", 2, 2, 2, 1), G: 4, depth: 6, expect: "exact", name: "2 người, 2 xe" }];
    cases.forEach(function (c) {
      var d = Object.assign({ interp: "A", mu: 2, mv: 1, G: 1 }, c.d, { G: c.G }), lb = L.lbOf(d), t0 = Date.now(), r = bfsMin(d, c.depth, 120000), ms = Date.now() - t0;
      if (c.expect === "exact") t.ok("vét cạn " + c.name + ": " + r.states + " trạng thái (" + ms + " ms), min = cận LP = " + (r.best && L.qs(r.best)), r.best && L.qcmp(r.best, lb) === 0 && !r.capped, [r.best && L.qs(r.best), L.qs(lb), r.capped]);
      else t.ok("vét cạn " + c.name + ": " + r.states + " trạng thái, min " + L.qs(r.best) + " ≥ cận LP " + L.qs(lb) + " (không đạt cận ⇒ cần cảnh báo 'chưa biết tối ưu')", r.best && L.qcmp(r.best, lb) >= 0, [L.qs(r.best), L.qs(lb)]);
    });
    // đề không chia hết: lịch tốt nhất app biết không thấp hơn min vét cạn trên lưới của chính đề đó
    var pn = mk("A", 3, 1, "2"), d = Object.assign({}, pn.data, { G: 10 }), r2 = bfsMin(d, 6, 120000);
    t.ok("3 người / 1 xe / m=2: lịch app biết 7/10 = min vét cạn trên lưới 1/10 (" + L.qs(r2.best) + ") — gần cận LP 2/3 nhưng không chạm", L.qs(r2.best) === "7/10" && pn.data.known === "7/10" && pn.data.exact === false && pn.data.best === "2/3", [L.qs(r2.best), pn.data.known]);
  })();

  // ====================================================================== 5. sinh đề, độ khó, tất định
  t.group("motorbike — sinh đề: bậc, tất định, đơn điệu, options");
  (function () {
    var tot = 0, ok = 0, bad = [], means = {}, ms = 0, maxMs = 0;
    INTERPS.forEach(function (ip) { TIERS.forEach(function (tier) {
      var sc = [];
      for (var s = 1; s <= 20; s++) {
        var t0 = Date.now(), p = T.generate(s * 7919, { sizeId: "std", tier: tier, options: ip === "B" ? { interp: "B" } : null }), dt = Date.now() - t0; ms += dt; maxMs = Math.max(maxMs, dt);
        tot++; if (inBand(p.score, tier) && p.tier === tier) ok++; else bad.push([ip, tier, p.score, p.tier]);
        sc.push(p.score);
        var q = T.generate(s * 7919, { sizeId: "std", tier: tier, options: ip === "B" ? { interp: "B" } : null });
        if (J(p) !== J(q)) bad.push(["không tất định", ip, tier, s]);
        if (!p.data.exact) bad.push(["đề sinh ra không biết tối ưu", ip, tier, s]);
        if (!T.check(p, { v: p.solution.v, c: null }).solved) bad.push(["lời giải không solved", ip, tier, s]);
        if (!T.validate(p).ok) bad.push(["validate", ip, tier, s]);
      }
      means[ip + tier] = sc.reduce(function (a, b) { return a + b; }, 0) / sc.length;
    }); });
    t.ok("160 đề (2 cách hiểu × 4 bậc × 20 seed): đạt bậc " + ok + "/" + tot + ", tất định, đề sinh luôn biết tối ưu, lời giải solved, validate ok; tối đa " + maxMs + " ms/đề", bad.length === 0 && ok === tot, bad.slice(0, 4));
    t.ok("điểm trung bình tăng theo bậc ở cả hai cách hiểu", INTERPS.every(function (ip) { return means[ip + "easy"] < means[ip + "medium"] && means[ip + "medium"] < means[ip + "hard"] && means[ip + "hard"] < means[ip + "expert"]; }), means);
    t.ok("mỗi bậc có ≥ 4 cấu hình khác nhau trong hồ chứa ở cả hai cách hiểu (không rơi về 'gần bậc nhất')", INTERPS.every(function (ip) { return TIERS.every(function (tier) { return L.pool(ip).filter(function (q) { return inBand(q.score, tier); }).length >= 4; }); }), INTERPS.map(function (ip) { return TIERS.map(function (tier) { return L.pool(ip).filter(function (q) { return inBand(q.score, tier); }).length; }); }));
    var ids = {}; for (var s = 1; s <= 40; s++) ids[T.generate(s, { sizeId: "std", tier: "medium" }).id] = 1;
    t.ok("40 seed khác nhau cho nhiều puzzle khác nhau (≥ 6)", Object.keys(ids).length >= 6, Object.keys(ids).length);
    // options
    var pa = T.generate(55, { sizeId: "std", tier: "easy" }), pa2 = T.generate(55, { sizeId: "std", tier: "easy", options: { interp: "A" } }), pb = T.generate(55, { sizeId: "std", tier: "easy", options: { interp: "B" } }), px = T.generate(55, { sizeId: "std", tier: "easy", options: { interp: "zzz", rác: 1 } });
    t.ok("options: mặc định tường minh ⇒ cùng puzzle như không truyền; puzzle.options gọn ({} hoặc {interp:'B'}); B khác id; lựa chọn lạ ⇒ mặc định", J(pa) === J(pa2) && J(pa.options) === "{}" && J(pb.options) === J({ interp: "B" }) && pb.id !== pa.id && pb.data.interp === "B" && J(px) === J(pa), [pa.options, pb.options]);
    t.ok("cùng seed, tier ⇒ B vẫn tất định và có lời giải solved; liên kết o=interp:B giải mã đúng", J(pb) === J(T.generate(55, { sizeId: "std", tier: "easy", options: { interp: "B" } })) && T.check(pb, { v: pb.solution.v, c: null }).solved && J(Puz.types.decodeOptions("interp:B")) === J({ interp: "B" }) && Puz.types.encodeOptions(T, { interp: "B" }) === "interp:B");
    t.ok("Daily: motorbike CHƯA vào ORDER / SCHEDULE (việc của P8); 600 ngày không ngày nào ra motorbike", (function () {
      var D = Puz.daily; if (!D) return false;
      var types = Puz.types.all().map(function (x) { return x.id; }), day = "2026-10-01", bad2 = 0;
      for (var i = 0; i < 600; i++) { var f = D.forDay(day, types); if (!f || f.type === "motorbike") bad2++; day = Puz.util.addDays(day, 1); }
      return D.ORDER.indexOf("motorbike") < 0 && D.SCHEDULE.every(function (v) { return v.ids.indexOf("motorbike") < 0; }) && bad2 === 0;
    })());
  })();

  // ====================================================================== 6. đề tự nhập, lỗi, giới hạn
  t.group("motorbike — đề tự nhập: không chia hết chơi được kèm cảnh báo, đầu vào xấu, giới hạn");
  (function () {
    var r = T.fromInput({ interp: "A", n: 5, k: 1, m: "2" });
    t.ok("5 người / 1 xe / m=2 (không chia hết): ok, status 'multiple', statusKind warn, cảnh báo 'chưa biết tối ưu' nêu cận LP 4/5 và lịch biết 5/6", r.ok && r.status === "multiple" && r.statusKind === "warn" && /Chưa biết tối ưu chính xác/.test(r.statusText) && /4\/5/.test(r.statusText) && /5\/6/.test(r.statusText) && r.warnings.length >= 1, r.statusText);
    var g = GR.errors(T.grade(r.puzzle, { v: r.puzzle.solution.v, c: null }));
    var gr = T.grade(r.puzzle, { v: r.puzzle.solution.v, c: null });
    t.ok("đề không chia hết: lịch tốt nhất biết chấm quality < 1, KHÔNG BAO GIỜ 3★ / 'Tối ưu!'; text nêu cận LP; grade đủ trường", g.length === 0 && gr.quality < 1 && gr.stars < 3 && !/Tối ưu!/.test(gr.text) && /cận dưới LP/.test(gr.text) && gr.quality === 0.96, [gr.quality, gr.stars, gr.text, g]);
    t.ok("mistakes luôn 0; solve: status 'multiple' khi không chắc, 'unique' khi biết", T.mistakes(r.puzzle, T.newState(r.puzzle), { d: [] }) === 0 && T.solve(r.puzzle).status === "multiple" && T.solve(mk("A", 4, 1, "5")).status === "unique");
    var triv = T.fromInput({ interp: "A", n: 2, k: 1, m: "3" });
    t.ok("n ≤ 2k: ok, 'unique', cảnh báo bài tầm thường, T = 1/m", triv.ok && triv.status === "unique" && /tầm thường/.test(triv.warnings.join(" ")) && triv.puzzle.data.best === "1/3");
    var bads = [null, undefined, 5, "x", {}, { interp: "C", n: 4, k: 1, m: "5" }, { interp: "A", n: 0, k: 1, m: "5" }, { interp: "A", n: 13, k: 1, m: "5" }, { interp: "A", n: 4, k: 0, m: "5" }, { interp: "A", n: 4, k: 5, m: "5" }, { interp: "A", n: 4, k: 1, m: "1" }, { interp: "A", n: 4, k: 1, m: "0.5" },
      { interp: "A", n: 4, k: 1, m: "abc" }, { interp: "A", n: 4, k: 1, m: "21" }, { interp: "A", n: 4, k: 1, m: "5/0" }, { interp: "A", n: 4.5, k: 1, m: "5" }, { interp: "A", n: "4", k: "1", m: "5" }, { interp: "__proto__", n: 4, k: 1, m: 5 }, { interp: "A", n: 4, k: 1, m: NaN }, { interp: "A", n: 4, k: 1 }];
    var thrown = 0, accepted = 0; bads.forEach(function (b) { try { var rr = T.fromInput(b); if (rr.ok) accepted++; } catch (e) { thrown++; } });
    t.ok("đầu vào xấu/thiếu/sai kiểu: không ném; chỉ chấp nhận chuỗi số hợp lệ ('4' → 4, m số)", thrown === 0 && accepted === 1, [thrown, accepted]);
    t.ok("parseM: '5' '5/2' '2,5' '2.5' [5,2] → đúng; ≤ 1, > 20, mẫu > 10, rác → null", J([L.parseM("5"), L.parseM("5/2"), L.parseM("2,5"), L.parseM("2.5"), L.parseM([5, 2]), L.parseM(3)]) === J([{ mu: 5, mv: 1 }, { mu: 5, mv: 2 }, { mu: 5, mv: 2 }, { mu: 5, mv: 2 }, { mu: 5, mv: 2 }, { mu: 3, mv: 1 }]) && [L.parseM("1"), L.parseM("1/2"), L.parseM("21"), L.parseM("1/11"), L.parseM("x"), L.parseM(null), L.parseM("3/0")].every(function (x) { return x === null; }));
    var worst = 0, wcfg = "", bigBad = [];
    INTERPS.forEach(function (ip) { for (var k = 1; k <= 4; k++) for (var n = 1; n <= 12; n++) ["7/3", "5/2", "19/10", "3", "2"].forEach(function (m) {
      var t0 = Date.now(), rr = T.fromInput({ interp: ip, n: n, k: k, m: m }), dt = Date.now() - t0;
      if (dt > worst) { worst = dt; wcfg = [ip, n, k, m].join(","); }
      if (!rr.ok) bigBad.push([ip, n, k, m, rr.errors[0]]);
      else if (!T.check(rr.puzzle, { v: rr.puzzle.solution.v, c: null }).solved || (rr.puzzle.data.exact && GR.errors(T.grade(rr.puzzle, { v: rr.puzzle.solution.v, c: null })).length)) bigBad.push([ip, n, k, m, "lời giải"]);
    }); });
    t.ok("mọi tổ hợp n ≤ 12, k ≤ 4, 5 giá trị m (480 đề tự nhập): đều dựng được, lời giải solved; chậm nhất " + worst + " ms (" + wcfg + ")", bigBad.length === 0 && worst < 1500 * t.slack, bigBad.slice(0, 4));
  })();

  // ====================================================================== 7. hợp đồng: check/grade/hint/replay/I-O
  t.group("motorbike — check, grade, moveFor, diff, dung lượng");
  (function () {
    var p = mk("A", 4, 1, "5"), s = T.newState(p);
    t.ok("trạng thái đầu: plan.valid, chưa nộp, 0 lệnh; initial dài 2 + 64·4 = 258", plan.valid(s, L.LAYOUT) && !plan.isSubmitted(s) && plan.count(s) === 0 && s.v.length === 258 && p.initial.v.length === 258);
    t.ok("nộp kế hoạch rỗng → null (cần ≥ 1 lệnh); lời giải solved, chưa nộp thì chưa solved", T.moveFor(p, s, { k: "submit" }) === null && T.check(p, { v: p.solution.v, c: null }).solved && T.check(p, s).solved === false && T.check(p, s).total === p.solution.v[1]);
    var bad = [null, undefined, 5, "x", {}, { k: "zzz" }, { k: "cmd" }, { k: "cmd", bike: 1, op: "zzz", a: 1 }, { k: "cmd", bike: 9, op: "take", a: 1 }, { k: "cmd", bike: 1, op: "take", a: 1.5 }, { k: "cmd", bike: 1, op: "take", a: 99 }, { k: "cmd", bike: 1, op: "ride", a: 5 },
      { k: "cmd", bike: 1, op: "meet", a: 2 }, { k: "cmd", bike: 1, op: "off", a: 1 }, { k: "steps" }, { k: "steps", recs: [] }, { k: "steps", recs: [[1, 1, 1]] }, { k: "abandon", bike: 1 }, { k: "abandon", bike: 99 }, { k: "truncate", n: 5 }, { k: "truncate", n: -1 }, { k: "cmd", bike: "1", op: "take", a: 1 }, { k: "cmd", bike: 1, op: "__proto__", a: 1 }];
    var thr = 0, acc = 0; bad.forEach(function (a) { try { if (T.moveFor(p, s, a)) acc++; } catch (e) { thr++; } });
    t.ok("action lạ / sai kiểu / thiếu trường / lệnh sai luật → null, không ném", thr === 0 && acc === 0, [thr, acc]);
    // chuỗi hợp lệ + hoàn lại từng diff
    var seq = plan.read({ v: p.solution.v }, L.LAYOUT).map(actOf), diffs = [], st = T.newState(p), okAll = true;
    seq.forEach(function (a) { var before = J(st.v), dd = apply(p, st, a); if (!dd) { okAll = false; return; } diffs.push([dd, before]); if (!plan.valid(st, L.LAYOUT)) okAll = false; });
    t.ok("lời giải 4/1/5 (" + seq.length + " lệnh) áp từng lệnh bằng moveFor: mỗi lệnh một diff, state luôn plan.valid", okAll && plan.count(st) === seq.length);
    var rev = true; diffs.slice().reverse().forEach(function (e) { G.applyDiff(st, e[0].d, true); if (J(st.v) !== e[1]) rev = false; });
    t.ok("hoàn lại từng diff bằng reverseDiff cho ĐÚNG state trước đó", rev && plan.count(st) === 0);
    var sh = G.create(p, {}); seq.forEach(function (a) { sh.act(a); }); var snap = J(sh.state.v); sh.undo(); sh.undo(); sh.redo(); sh.redo();
    t.ok("hoàn tác/làm lại qua Puz.game giữ nguyên state", J(sh.state.v) === snap);
    sh.act({ k: "submit" }); var gsub = T.grade(p, sh.state);
    t.ok("nộp lời giải → solved, quality 1, 3★, 'Tối ưu!', valueText = bestText = '31 phút 12 giây'; sau nộp mọi lệnh khác → null; mở lại bằng truncate(n = len)",
      sh.status === "solved" && gsub.quality === 1 && gsub.stars === 3 && /Tối ưu!/.test(gsub.text) && gsub.valueText === "31 phút 12 giây" && gsub.bestText === "31 phút 12 giây" && GR.errors(gsub).length === 0 && T.moveFor(p, sh.state, { k: "cmd", bike: 1, op: "take", a: 1 }) === null && !!T.moveFor(p, sh.state, { k: "truncate", n: seq.length }));
    // chưa nộp: 0★, nhưng vẫn có giá trị cho HUD; kế hoạch rỗng = đi bộ cả 60 phút
    var g0 = T.grade(p, T.newState(p));
    t.ok("chưa nộp: 0★ 'Chưa nộp kế hoạch'; HUD có giá trị (kế hoạch rỗng = 60 phút, quality = 13/25 : 1 = 0,52); không lộ tối ưu trong valueText", g0.stars === 0 && /Chưa nộp/.test(g0.text) && g0.valueText === "60 phút" && g0.quality === 0.52 && GR.errors(g0).length === 0);
    // kế hoạch gần tối ưu không bị báo "Tối ưu!"
    var near = plan.read({ v: p.solution.v }, L.LAYOUT).map(function (r) { return r.slice(); });
    near[1][2] += 1; var nst = T.newState(p); near.forEach(function (r) { apply(p, nst, actOf(r)); }); apply(p, nst, { k: "submit" }); var gn = T.grade(p, nst);
    t.ok("lịch chỉ lệch 1 vạch (T hơi lớn hơn 13/25): quality < 1 dù làm tròn 3 chữ số, không bao giờ '3★'/'Tối ưu!'", gn.quality < 1 && gn.stars < 3 && !/Tối ưu!/.test(gn.text), [gn.quality, gn.stars, gn.valueText]);
    // lưới RẤT mịn (G = 4980): lệch 1 vạch làm best/value ≈ 0,9999 — round3 ra 1,000, chỉ phép so sánh PHÂN SỐ + kẹp 0,999 mới giữ đúng "chưa tối ưu"
    (function () {
      var fine = JSON.parse(JSON.stringify(p)), sc = 4980 / p.data.G; fine.data.G = 4980;
      var rs = plan.read({ v: p.solution.v }, L.LAYOUT).map(function (r) { return r[1] === 2 ? [r[0], r[1], r[2] * sc, r[3]] : r.slice(); });
      function run(shift) {
        var q = rs.map(function (r) { return r.slice(); }); if (shift) q[1][2] += shift; var s2 = T.newState(fine);
        q.forEach(function (r) { apply(fine, s2, actOf(r)); }); apply(fine, s2, { k: "submit" }); return { g: T.grade(fine, s2), T: L.simOf(fine, s2).T };
      }
      var ok0 = run(0), ok1 = run(1), rr = G.create(fine, {});
      t.ok("lưới mịn 1/4980: lịch tối ưu → quality 1 / 3★; lệch đúng 1 vạch (best/T = " + (L.qf(L.qparse(fine.data.best)) / L.qf(ok1.T)).toFixed(5) + " → round3 = 1,000) vẫn quality < 1, < 3★, không 'Tối ưu!'",
        ok0.g.quality === 1 && ok0.g.stars === 3 && Math.round(L.qf(L.qparse(fine.data.best)) / L.qf(ok1.T) * 1000) / 1000 === 1 && ok1.g.quality < 1 && ok1.g.stars < 3 && !/Tối ưu!/.test(ok1.g.text) && L.qcmp(ok1.T, L.qparse(fine.data.best)) > 0 && !!rr, [ok0.g.quality, ok1.g.quality, ok1.g.stars]);
    })();
    // dung lượng
    var pb = mk("B", 12, 1, "5"), fs = T.newState(pb), pushed = 0; apply(pb, fs, { k: "cmd", bike: 1, op: "take", a: 1, b: 0 }); pushed++;
    for (var i = 0; pushed < L.CAP; i++) { if (!apply(pb, fs, { k: "cmd", bike: 1, op: "ride", a: i % 2 ? 1 : pb.data.G - 1, b: 0 })) break; pushed++; }
    t.ok("kế hoạch đầy " + L.CAP + " lệnh (xe ôm chạy tới lui): moveFor trả null, không ném; nộp vẫn được; hint không ném; plan.valid", pushed === L.CAP && T.moveFor(pb, fs, { k: "cmd", bike: 1, op: "ride", a: 1, b: 0 }) === null && !!T.moveFor(pb, fs, { k: "submit" }) && plan.valid(fs, L.LAYOUT) && (function () { try { return !!T.hint(pb, fs, 3); } catch (e) { return false; } })());
    // lỗi luật: thông báo rõ ràng
    var pr = T.newState(p); apply(p, pr, { k: "cmd", bike: 1, op: "take", a: 1, b: 2 });
    var errs = {
      "xe không có người": T.sim.preview(p, T.newState(p), { k: "cmd", bike: 1, op: "ride", a: 5 }),
      "lấy xe khi đang có người": T.sim.preview(p, pr, { k: "cmd", bike: 1, op: "take", a: 3, b: 4 }),
      "xe hết chỗ": T.sim.preview(p, pr, { k: "cmd", bike: 1, op: "meet", a: 3 }),
      "người không ở trên xe": T.sim.preview(p, pr, { k: "cmd", bike: 1, op: "off", a: 3 }),
      "bỏ xe khi trống": T.sim.preview(p, T.newState(p), { k: "abandon", bike: 1 }) };
    t.ok("lý do lỗi rõ ràng bằng tiếng Việt từ preview (không lái / đang có người / hết chỗ / không ở trên xe / không có ai để bỏ)", !errs["xe không có người"].ok && /không có người lái/.test(errs["xe không có người"].error) && !errs["lấy xe khi đang có người"].ok && /đang có người/.test(errs["lấy xe khi đang có người"].error) && /hết chỗ/.test(errs["xe hết chỗ"].error) && /không ở trên xe/.test(errs["người không ở trên xe"].error) && /không có ai/.test(errs["bỏ xe khi trống"].error), Object.keys(errs).map(function (k2) { return k2 + " → " + errs[k2].error; }));
    var okp = T.sim.preview(p, pr, { k: "cmd", bike: 1, op: "ride", a: 18 });
    t.ok("preview hợp lệ: after có T chữ, event 'Xe 1 tới 3/5 quãng lúc …', không đổi state", okp.ok && okp.after.event.indexOf("3/5") >= 0 && /phút|giây/.test(okp.after.Ttext) && plan.count(pr) === 1);
    t.ok("bỏ xe tại chỗ (A): macro 'abandon' = đúng một diff, mọi người xuống, xe trống; preview nêu 'bị bỏ lại'", (function () {
      var s2 = T.newState(p); apply(p, s2, actOf([1, 1, 1, 2])); apply(p, s2, actOf([1, 2, 18, 0])); var before = plan.count(s2), dd = apply(p, s2, { k: "abandon", bike: 1 }), v = T.sim.view(p, s2);
      return !!dd && plan.count(s2) === before + 2 && v.ok && v.bikes[0].riders.length === 0 && v.bikes[0].parked && /bị bỏ lại/.test(T.sim.preview(p, (function () { var s3 = T.newState(p); apply(p, s3, actOf([1, 1, 1, 2])); apply(p, s3, actOf([1, 2, 18, 0])); return s3; })(), { k: "abandon", bike: 1 }).after.event);
    })());
    t.ok("xe ôm: bỏ xe không có nghĩa → abandon báo lỗi; 'take' 2 người báo 'chỉ chở 1 khách'", (function () {
      var s2 = T.newState(pb); return !T.sim.preview(pb, s2, { k: "abandon", bike: 1 }).ok && /1 khách/.test(T.sim.preview(pb, s2, { k: "cmd", bike: 1, op: "take", a: 1, b: 2 }).error);
    })());
  })();

  t.group("motorbike — gợi ý: vòng 'mức 3 → áp dụng', khớp tiền tố bất biến đổi tên, rẽ khỏi lịch → quay về");
  function randomLegal(p, g, rng) {
    var d = p.data;
    for (var tr = 0; tr < 200; tr++) {
      var bike = 1 + rng.int(d.k), r = rng.next(), rec;
      if (r < 0.3) rec = [bike, 1, 1 + rng.int(d.n), d.interp === "A" && rng.chance(0.5) ? 1 + rng.int(d.n) : 0];
      else if (r < 0.65) rec = [bike, 2, rng.int(d.G + 1), 0]; else if (r < 0.85) rec = [bike, 3, 1 + rng.int(d.n), 0]; else rec = [bike, 4, 1 + rng.int(d.n), 0];
      if (rec[1] === 1 && rec[3] === rec[2]) rec[3] = 0;
      if (T.moveFor(p, g.state, actOf(rec))) return actOf(rec);
    }
    return null;
  }
  function hintLoop(p, rng, inject) {
    var g = G.create(p, {}), total = plan.count({ v: p.solution.v }), steps = 0, limit = total * 3 + 8, lvlBad = [], injected = 0, truncs = 0, injectAt = {};
    for (var q = 0; q < inject; q++) injectAt[rng.int(Math.max(1, total))] = 1;
    while (g.status !== "solved" && steps < limit) {
      if (injectAt[steps] && g.status === "playing") { var a0 = randomLegal(p, g, rng); if (a0 && g.act(a0).ok) injected++; }
      if (g.status === "ready") g.start();
      var h1 = g.hint(1), h2 = g.hint(2), h3 = g.hint(3);
      if (!h3 || h3.none || !h3.action) break;
      var act = h3.action;
      if (act.k === "truncate") truncs++;
      if (act.k === "cmd" && act.op === "ride" && act.a !== p.data.G) { var pt = L.gridText(act.a, p.data.G).replace(" quãng", ""); if (h1.text.indexOf(pt) >= 0 && pt.indexOf("/") > 0) lvlBad.push(["mức 1 lộ vị trí mức 3", pt, h1.text]); if (h2.text.indexOf(pt) < 0) lvlBad.push(["mức 2 không nêu vị trí", pt, h2.text]); }
      if (!(h1.text.length > 8 && h2.text.length > 8 && h3.text.length > 3) || (h3.why || []).length < 1 || h1.text === h3.text) lvlBad.push(["hint ngắn/không why", h1.text, h2.text, h3.text]);
      if (J(g.hint(3)) !== J(h3)) lvlBad.push(["không tất định"]);
      if (/\b(?:undefined|null|NaN)\b/.test(J([h1.text, h2.text, h3.text, h3.why]))) lvlBad.push(["chữ rác", h3.text]);
      var r = g.applyHint(h3); if (!r.ok) { lvlBad.push(["áp dụng thất bại", J(act), r.reason]); break; }
      steps++;
    }
    return { g: g, steps: steps, limit: limit, lvlBad: lvlBad, injected: injected, truncs: truncs, total: total };
  }
  (function () {
    var rng = R.create(777), tot = 0, bad = [], lvl = [], inj = 0, trn = 0, maxRatio = 0, nOpt = 0, puzzles = [];
    INTERPS.forEach(function (ip) { TIERS.forEach(function (tier) { for (var s = 1; s <= 2; s++) puzzles.push(T.generate(s * 331, { sizeId: "std", tier: tier, options: ip === "B" ? { interp: "B" } : null })); }); });
    puzzles.push(mk("A", 4, 1, "5"), mk("A", 4, 1, "2"), mk("A", 6, 1, "3"), mk("A", 6, 2, "5"), mk("A", 2, 1, "3"), mk("B", 6, 2, "4"), mk("A", 8, 2, "5/2"));
    puzzles.forEach(function (p) {
      [0, 0, 2, 4].forEach(function (inject) {
        var r = hintLoop(p, rng, inject); tot++; inj += r.injected; trn += r.truncs;
        if (r.g.status !== "solved") { bad.push([p.data.interp, p.data.n, p.data.k, mtext(p.data.mu, p.data.mv), "inject " + inject, "bước " + r.steps + "/" + r.limit]); return; }
        var gr = T.grade(p, r.g.state, r.g.counters);
        if (gr.quality !== 1 || gr.stars !== 3) bad.push([p.data.interp, p.data.n, p.data.k, "không tối ưu", gr.valueText, gr.bestText]); else nOpt++;
        maxRatio = Math.max(maxRatio, r.steps / r.total); lvl = lvl.concat(r.lvlBad);
      });
    });
    t.ok("vòng 'gợi ý mức 3 → áp dụng' giải xong với quality 1 (3★) ở " + tot + " ván (" + puzzles.length + " đề × 4 kiểu chèn; " + inj + " lệnh ngẫu nhiên chèn giữa chừng, " + trn + " lần gợi ý bảo quay về); nhiều bước nhất = " + maxRatio.toFixed(2) + " × số bước lời giải (≤ 3)", bad.length === 0 && nOpt === tot && trn > 0 && maxRatio <= 3, bad.slice(0, 3));
    t.ok("mỗi gợi ý: mức 1/2/3 đều có lời, mức 3 có 'vì sao', mức 1 không lộ vị trí chở của mức 3, mức 2 nêu vị trí, tất định, không chữ rác", lvl.length === 0, lvl.slice(0, 3));
  })();
  (function () {
    var p = mk("A", 4, 1, "5"), g = G.create(p, {}), h1 = g.hint(1), h3 = g.hint(3);
    t.ok("trạng thái đầu: mức 1 nói chiến lược (m = 5 > 3, đưa-đón), mức 3 = lấy xe cho P1 + P2 kèm 'vì sao'", /m = 5 > 3/.test(h1.text) && /đưa-đón/i.test(h1.text) && h3.action && h3.action.op === "take" && h3.action.a === 1 && h3.action.b === 2 && h3.why.length >= 1);
    // rẽ khỏi lịch: chở sai vị trí
    var s = T.newState(p); apply(p, s, { k: "cmd", bike: 1, op: "take", a: 1, b: 2 }); apply(p, s, { k: "cmd", bike: 1, op: "ride", a: 15, b: 0 });
    var hb = T.hint(p, s, 3), hb1 = T.hint(p, s, 1);
    t.ok("chở sai (1/2 thay vì 3/5): mọi mức nói 'rẽ khỏi lịch tối ưu'; mức 3 = truncate về trước lệnh 2 (n = 1); mức 2 nêu 'Lệnh 2'", hb.action && hb.action.k === "truncate" && hb.action.n === 1 && /rẽ khỏi|khác lịch/.test(hb1.text) && /Lệnh 2/.test(T.hint(p, s, 2).text), [hb.action, hb1.text]);
    // bất biến đổi tên: đổi tên người / xe của tiền tố lịch mẫu
    var rng = R.create(99), bad = [], tested = 0;
    [mk("A", 6, 2, "5"), mk("A", 8, 2, "2"), mk("A", 9, 3, "6"), mk("B", 6, 2, "4"), mk("A", 6, 1, "3"), mk("A", 4, 1, "5")].forEach(function (q) {
      var sol = plan.read({ v: q.solution.v }, L.LAYOUT);
      for (var rep = 0; rep < 5; rep++) {
        var pp = rng.shuffle(Array.apply(null, Array(q.data.n)).map(function (_, i) { return i + 1; })), bb = rng.shuffle(Array.apply(null, Array(q.data.k)).map(function (_, i) { return i + 1; }));
        var ren = sol.map(function (r) { var x = [bb[r[0] - 1], r[1], r[2], r[3]]; if (r[1] === 1) { x[2] = pp[r[2] - 1]; x[3] = r[3] ? pp[r[3] - 1] : 0; } else if (r[1] === 3 || r[1] === 4) x[2] = pp[r[2] - 1]; return x; });
        var cut = 1 + rng.int(ren.length - 1), part = ren.slice(0, cut), gg = G.create(q, {});
        gg.state = { v: plan.build(L.LAYOUT, part, 0, []), c: null }; gg.start();
        var left = sol.length - cut, steps = 0, trunc = 0;
        while (gg.status !== "solved" && steps < sol.length + 3) { var hh = gg.hint(3); if (!hh.action) break; if (hh.action.k === "truncate") trunc++; if (!gg.applyHint(hh).ok) break; steps++; }
        tested++;
        if (gg.status !== "solved" || trunc || steps > left + 1 || T.grade(q, gg.state).quality !== 1) bad.push([q.data.n, q.data.k, mtext(q.data.mu, q.data.mv), "cắt " + cut, "bước " + steps + " / " + (left + 1), "quay về " + trunc, gg.status]);
      }
    });
    t.ok("khớp tiền tố BẤT BIẾN đổi tên: " + tested + " lịch mẫu bị hoán vị người + xe rồi cắt dở → gợi ý KHÔNG bảo quay về, hoàn tất đúng (≤ còn lại + 1 bước nộp; lệnh 'chở tới B' cuối có thể bỏ vì xe tự chạy tới B), quality 1", bad.length === 0 && tested === 30, bad.slice(0, 3));
    // m = 3: hai họ cùng tối ưu — chơi theo tiếp sức (2k | n) vẫn được gợi ý nhất quán, nộp tối ưu
    var p3 = mk("A", 8, 2, "3"), fams = L.famsOf(p3.data).fams, ids = fams.map(function (f) { return f.id; }).sort();
    t.ok("m = 3, 2k | n: hai họ lịch mẫu (đưa-đón và tiếp sức) cùng cho T = 1 − 4k/(3n) = 5/6... đối chiếu cận LP", ids.length === 2 && fams.every(function (f) { var r = L.simulate(p3.data, f.recs); return r.ok && L.qcmp(r.T, L.lbOf(p3.data)) === 0; }), [ids, p3.data.best]);
    var relay = fams.filter(function (f) { return f.id === "tiep-suc"; })[0], gr = G.create(p3, {}); gr.state = { v: plan.build(L.LAYOUT, relay.recs.slice(0, 3), 0, []), c: null }; gr.start();
    var steps2 = 0; while (gr.status !== "solved" && steps2 < 40) { var hx = gr.hint(3); if (!hx.action || !gr.applyHint(hx).ok) break; steps2++; }
    t.ok("m = 3: bắt đầu theo họ tiếp sức → gợi ý theo đúng họ đó (không ép sang đưa-đón), giải xong tối ưu", gr.status === "solved" && T.grade(p3, gr.state).quality === 1 && steps2 <= relay.recs.length - 3 + 1, [gr.status, steps2, relay.recs.length]);
    // một lịch tối ưu khác dạng (đổi thứ tự xuống xe) vẫn được 100 % khi nộp, gợi ý chỉ nói "nộp"
    var p4 = mk("A", 4, 1, "2"), sol4 = plan.read({ v: p4.solution.v }, L.LAYOUT), alt = sol4.map(function (r) { return r.slice(); }), tmp = alt[2]; alt[2] = alt[3]; alt[3] = tmp;
    var s4 = T.newState(p4); alt.forEach(function (r) { apply(p4, s4, actOf(r)); });
    t.ok("tiếp sức: xuống xe theo thứ tự khác (lái trước hay ngồi sau trước) vẫn T tối ưu ⇒ gợi ý nói 'nộp' (không báo rẽ khỏi lịch), nộp được 3★", T.hint(p4, s4, 3).action.k === "submit" && (function () { apply(p4, s4, { k: "submit" }); return T.grade(p4, s4).quality === 1; })());
    t.ok("ván đã nộp: gợi ý none; kế hoạch hỏng (state bị sửa tay): không ném", T.hint(p4, { v: p4.solution.v.slice(), c: null }, 3).none === true && (function () { try { var s5 = { v: p4.solution.v.slice(), c: null }; s5.v[3] = 99; T.hint(p4, s5, 3); T.grade(p4, s5); T.check(p4, s5); T.describeCell(p4, s5, 0); return true; } catch (e) { return false; } })());
  })();

  t.group("motorbike — replay, constraintView, trace, describeCell, I/O");
  (function () {
    var p = mk("A", 6, 2, "5"), steps = T.replay(p), st = T.newState(p), okk = true, junk = 0;
    steps.forEach(function (stp) { if (!stp.text || !stp.diff || !Array.isArray(stp.cells) || !Array.isArray(stp.why) || !stp.why.length) okk = false; if (/\b(?:undefined|null|NaN)\b/.test(J(stp))) junk++; G.applyDiff(st, stp.diff.d, false); });
    t.ok("replay: " + steps.length + " bước (mỗi lệnh một bước + Nộp) áp tuần tự ra state solved; mỗi bước có text, diff, cells, why; không chữ rác", steps.length === plan.count({ v: p.solution.v }) + 1 && T.check(p, st).solved && okk && junk === 0, [steps.length, junk]);
    t.ok("replay: bước đầu 'lấy xe' có 'vì sao'; bước chở tới B nêu 'cùng lúc'; bước cuối nêu mức tối ưu", /lấy xe/.test(steps[0].text) && steps.some(function (s2) { return /cùng lúc/.test(s2.why.join(" ")); }) && /tối ưu/.test(steps[steps.length - 1].text));
    var cv = T.constraintView(p), tr = T.trace(p), sv = T.solve(p);
    t.ok("constraintView: summary + 4 biến + 6 họ ràng buộc + mục LP; trace: ma trận sự kiện (≤ 60 bước); solve: unique + lời giải + steps", cv.summary && cv.variables.length === 4 && cv.constraints.length === 6 && cv.sections.length >= 1 && tr.kind === "matrix" && tr.steps.length >= 6 && tr.steps.length <= 60 && sv.status === "unique" && sv.steps.length === plan.count({ v: p.solution.v }) && sv.value === sv.best);
    t.ok("kết quả sinh / replay / trace là JSON thuần (qua postMessage được)", (function () { try { return J([p, steps, cv, tr, sv]).length > 100 && !/\bn\b":\s*\d+n/.test(J(p)); } catch (e) { return false; } })());
    t.ok("describeCell: lệnh đã dùng / chưa dùng / ngoài phạm vi", /Lệnh 1: Xe 1 · lấy xe/.test(T.describeCell(p, { v: p.solution.v }, 0)) && /chưa dùng/.test(T.describeCell(p, T.newState(p), 3)) && /không hợp lệ/.test(T.describeCell(p, T.newState(p), 999)));
    var tx = T.toText(p), back = T.fromText(tx), f = T.toFile(p), back2 = T.fromFile(JSON.parse(JSON.stringify(f)));
    t.ok("toText 'motorbike nhom n=6 k=2 m=5' ↔ fromText; toFile ↔ fromFile (JSON): cùng data, id; xe ôm 'xeom'", tx === "motorbike nhom n=6 k=2 m=5" && back.ok && J(back.puzzle.data) === J(p.data) && back2.ok && J(back2.puzzle.data) === J(p.data) && back2.puzzle.id === p.id && T.toText(mk("B", 6, 2, "5/2")) === "motorbike xeom n=6 k=2 m=5/2" && T.fromText("Motorbike XE ÔM n = 6, k = 2, m = 5/2").ok && T.fromText("motorbike nhom n=6 k=2").ok === false && /initialState/.test(J(T.fromFile({}).errors)) && /^1\.T1\+2 /.test(f.solution), [tx, f.solution]);
    t.ok("fromText 'm=2,5' (dấu phẩy) ra m = 5/2; thiếu m / n → lỗi rõ, không ném", T.fromText("motorbike nhom n=5 k=1 m=2,5").puzzle.data.mu === 5 && T.fromText("motorbike nhom n=5 k=1 m=2,5").puzzle.data.mv === 2 && /Thiếu/.test(T.fromText("hi").errors[0]));
    var q = T.generate(9001, { sizeId: "std", tier: "hard" }), vq = T.validate(q);
    t.ok("validate dựng lại ĐÚNG p.solution; sizeText mô tả đề tự nhập", vq.ok && J(vq.solution) === J(q.solution) && /người · \d xe · xe nhanh gấp/.test(T.sizeText(q)) && /xe ôm/.test(T.sizeText(mk("B", 6, 2, "4"))));
  })();

  t.group("motorbike — thời gian và engine thuần");
  (function () {
    var p = mk("A", 12, 1, "7/3"), s = T.newState(p), t0 = Date.now(), hh = null;
    for (var i = 0; i < 5; i++) { hh = T.hint(p, s, 3); if (hh.action && hh.action.k === "cmd") apply(p, s, hh.action); }
    var ms = Date.now() - t0;
    t.ok("12 người / 1 xe / m=7/3 (không chia hết): 5 gợi ý liên tiếp, mỗi lần mô phỏng + khớp ≤ 0,5 s trung bình (" + ms + " ms)", ms / 5 < 500 * t.slack, ms);
    var t1 = Date.now(), pb = mk("A", 12, 4, "2"); for (var j = 0; j < 20; j++) L.simulate(pb.data, plan.read({ v: pb.solution.v }, L.LAYOUT));
    t.ok("20 lần mô phỏng lịch dài nhất (12 người, 4 xe) ≤ 2 s (" + (Date.now() - t1) + " ms)", Date.now() - t1 < 2000 * t.slack);
    var src = fs.readFileSync(path.join(ROOT, "assets/js/puzzles/motorbike.js"), "utf8");
    t.ok("không dùng Math.random / Date / performance.now / DOM / Puz.text / Puz.ui / localStorage trong engine; BigInt chỉ khi có (không ném ở nơi không có)", !/Math\.random|Date\.now|new Date|performance\.now|document\.|window\.|localStorage|Puz\.text|Puz\.ui|Puz\.stats/.test(src) && /typeof BigInt === "undefined"/.test(src));
    t.ok("engine phân số: không dùng số thực (Number) để so sánh giá trị tối ưu (chỉ để hiển thị/grade): mọi so sánh T dùng qcmp", !/Number\(.*\)\s*[<>]=?\s*Number\(/.test(src));
  })();
};
