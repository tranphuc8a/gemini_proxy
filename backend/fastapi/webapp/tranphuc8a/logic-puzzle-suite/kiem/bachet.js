/* kiem/bachet.js — kiểm QUẢ CÂN BACHET (đợt P6a, CW2). Nguồn sự thật ĐỘC LẬP với engine (viết riêng trong test, đơn giản, chậm):
     · VÉT CẠN mọi đa tập quả cân tăng dần (giá trị ≤ N) bằng đệ quy + tập tổng có dấu dạng Set: số quả tối thiểu m*(N) hai đĩa N = 1..40 và một đĩa N = 1..31,
       ĐẾM số bộ tối ưu (N biên ⇒ duy nhất, N khác ⇒ nhiều) — đối chiếu minCount / canonical của engine; công thức ⌈log3(2N+1)⌉ / ⌈log2(N+1)⌉ chỉ là bảng đối chiếu;
     · bộ dựng sẵn canonical(N) phủ 1..N bằng Set (hai đĩa N ≤ 400, một đĩa N ≤ 255) và KHÔNG có cỡ nhỏ hơn (cận đếm 3^(m−1) < 2N+1);
     · "mở rộng được?" (feasible) so với bảng mọi bộ tối ưu vét cạn: hàng nghìn tập quả cân con ngẫu nhiên, kể cả bộ thừa quả / quả sai;
     · đặt quả cân: số quả tối thiểu và số bố trí tối ưu của từng vật so với đệ quy dấu {−1,0,1} viết riêng; "cân thử" arrange so với vét cạn;
     · vòng "gợi ý mức 3 → áp dụng" từ trạng thái đầu và từ trạng thái có chèn quả sai; moveFor/diff/hoàn tác; mistakes; grade; I/O; sinh đề; engine thuần. */
"use strict";
var fs = require("fs"), path = require("path");

module.exports = function (t) {
  var Puz = t.Puz, T = Puz.types.get("bachet"), L = T.lib, G = Puz.game, R = Puz.rng;
  var ROOT = path.join(__dirname, "..");
  var TIERS = ["easy", "medium", "hard", "expert"], SIZES = ["hai", "mot", "dat"];
  function J(x) { return JSON.stringify(x); }
  function pow(b, e) { var p = 1; for (var i = 0; i < e; i++) p *= b; return p; }
  function inBand(score, tier) { var b = Puz.util.tier(tier); return score >= b.min && score < b.max; }
  function mean(a) { return a.reduce(function (x, y) { return x + y; }, 0) / (a.length || 1); }
  function apply(p, s, a) { var d = T.moveFor(p, s, a); if (!d) return null; G.applyDiff(s, d.d, false); return d; }
  function zeros(n) { var a = []; for (var i = 0; i < n; i++) a.push(0); return a; }

  // ====================================================================== nguồn độc lập: tập tổng có dấu, vét cạn mọi bộ
  function sums(W, two) {
    var s = new Set([0]);
    W.forEach(function (w) { var nx = new Set(); s.forEach(function (v) { nx.add(v); nx.add(v + w); if (two) nx.add(v - w); }); s = nx; });
    return s;
  }
  function covers(W, N, two) { var s = sums(W, two); for (var x = 1; x <= N; x++) if (!s.has(x)) return false; return true; }
  /** mọi đa tập tăng dần cỡ m (giá trị 1..N) phủ 1..N → mảng các bộ */
  function allCovering(N, two, m, cap) {
    var out = [], cur = [];
    (function rec(start) {
      if (out.length > cap) return;
      if (cur.length === m) { if (covers(cur, N, two)) out.push(cur.slice()); return; }
      for (var w = start; w <= N; w++) { cur.push(w); rec(w); cur.pop(); }
    })(1);
    return out;
  }
  function bruteMin(N, two, cap) {
    for (var m = 1; m <= 8; m++) { var sets = allCovering(N, two, m, cap); if (sets.length) return { m: m, sets: sets }; }
    return null;
  }
  function boundary(N, two) { for (var m = 1; m <= 12; m++) if ((two ? (pow(3, m) - 1) / 2 : pow(2, m) - 1) === N) return true; return false; }
  // ---- dat: đệ quy dấu viết riêng
  function bruteDat(W, x) {
    var best = 99, count = 0;
    (function rec(i, sum, used) {
      if (i === W.length) { if (sum === x) { if (used < best) { best = used; count = 1; } else if (used === best) count++; } return; }
      rec(i + 1, sum, used); rec(i + 1, sum + W[i], used + 1); rec(i + 1, sum - W[i], used + 1);
    })(0, 0, 0);
    return { min: best, count: count };
  }
  function bruteArrange(W, t, two) {
    var best = 99;
    (function rec(i, sum, used) {
      if (i === W.length) { if (sum === t && used < best) best = used; return; }
      rec(i + 1, sum, used); rec(i + 1, sum + W[i], used + 1); if (two) rec(i + 1, sum - W[i], used + 1);
    })(0, 0, 0);
    return best;
  }

  // ====================================================================== 0. đăng ký
  t.group("bachet — đăng ký / tuân giao diện");
  t.ok("loại bachet đã đăng ký, kind optimize, objective min", !!T && T.kind === "optimize" && T.objective.sense === "min" && typeof T.grade === "function" && Puz.types.conformance(T).length === 0, T && Puz.types.conformance(T));
  t.eq("ba cỡ hai/mot/dat, đúng một mặc định (hai)", T.sizes.map(function (z) { return z.id + (z.default ? "*" : ""); }), ["hai*", "mot", "dat"]);
  (function () {
    var dir = path.join(ROOT, "..", "algorithm-notebook", "assets", "data"), text = "";
    fs.readdirSync(dir).filter(function (f) { return /^lib-.*\.js$/.test(f); }).forEach(function (f) { text += fs.readFileSync(path.join(dir, f), "utf8"); });
    t.ok("algorithm.links[].id có thật trong algorithm-notebook/lib-*.js", T.algorithm.links.length >= 2 && T.algorithm.links.every(function (l) { return text.indexOf('id: "' + l.id + '"') >= 0; }), T.algorithm.links);
  })();

  // ====================================================================== 1. số quả tối thiểu = vét cạn độc lập
  t.group("bachet — số quả cân tối thiểu vét cạn (hai đĩa N ≤ 40, một đĩa N ≤ 31)");
  (function () {
    var bad = [], tab = [], uniqBad = [], canBad = [];
    [true, false].forEach(function (two) {
      var top = two ? 40 : 31;
      for (var N = 1; N <= top; N++) {
        var b = bruteMin(N, two, 3000), e = L.minCount(N, two);
        if (!b || b.m !== e) bad.push((two ? "hai" : "mot") + " N=" + N + " vét cạn " + (b && b.m) + " engine " + e);
        var uniq = b && b.sets.length === 1, bnd = boundary(N, two);
        if (b && ((bnd && !uniq) || (!bnd && N > 4 && uniq))) uniqBad.push((two ? "hai" : "mot") + " N=" + N + " có " + b.sets.length + " bộ tối ưu, biên=" + bnd);
        var C = L.canonical(N, two), tag = J(C);
        if (b && (C.length !== b.m || !covers(C, N, two) || !b.sets.some(function (s) { return J(s) === tag; }))) canBad.push((two ? "hai" : "mot") + " N=" + N + " " + tag);
        if (two && (N === 13 || N === 40 || N === 30)) tab.push("N=" + N + ": m*=" + b.m + ", " + b.sets.length + " bộ" + (b.sets.length === 1 ? " " + J(b.sets[0]) : ""));
        if (!two && (N === 7 || N === 15 || N === 10)) tab.push("một đĩa N=" + N + ": m*=" + b.m + ", " + b.sets.length + " bộ");
      }
    });
    t.ok("minCount = vét cạn mọi đa tập tăng dần, hai đĩa N=1..40 và một đĩa N=1..31", bad.length === 0, bad.slice(0, 5));
    t.ok("N biên (3^m−1)/2 / 2^m−1 ⇒ bộ tối ưu duy nhất; N khác (> 4) ⇒ nhiều bộ", uniqBad.length === 0, uniqBad.slice(0, 5));
    t.ok("canonical(N) có đúng m* quả, phủ 1..N và là MỘT trong các bộ tối ưu vét cạn", canBad.length === 0, canBad.slice(0, 5));
    t.info(tab.join(" · "));
    t.eq("ví dụ thiết kế: 13 → {1,3,9}, 40 → {1,3,9,27}, một đĩa 15 → {1,2,4,8}", [L.canonical(13, true), L.canonical(40, true), L.canonical(15, false)], [[1, 3, 9], [1, 3, 9, 27], [1, 2, 4, 8]]);
    // bộ dựng sẵn với N lớn: phủ bằng Set + cận đếm (không bộ nào ít quả hơn)
    var big = [], cnt = 0;
    for (var N2 = 1; N2 <= 400; N2++) {
      var Ch = L.canonical(N2, true), m = Ch.length;
      cnt++;
      if (!covers(Ch, N2, true) || !(pow(3, m - 1) < 2 * N2 + 1 && 2 * N2 + 1 <= pow(3, m)) || Ch.some(function (w) { return w < 1 || w > N2; })) big.push("hai " + N2);
    }
    for (var N3 = 1; N3 <= 255; N3++) {
      var Cm = L.canonical(N3, false), mm = Cm.length;
      if (!covers(Cm, N3, false) || !(pow(2, mm - 1) < N3 + 1 && N3 + 1 <= pow(2, mm)) || Cm.some(function (w) { return w < 1 || w > N3; })) big.push("mot " + N3);
    }
    t.ok("canonical phủ 1..N (Set độc lập), đúng m* theo cận đếm — hai đĩa N=1..400, một đĩa N=1..255 (" + (cnt + 255) + " bộ)", big.length === 0, big.slice(0, 5));
  })();

  t.group("bachet — coverInfo (phủ liền R, khối lượng hở đầu tiên, số tổng) so với tập tổng có dấu độc lập");
  (function () {
    var rng = R.create(31337), bad = [], n = 0;
    for (var k = 0; k < 400; k++) {
      var two = rng.chance(0.5), N = 1 + rng.int(60), size = rng.int(6), W = [];
      for (var i = 0; i < size; i++) W.push(1 + rng.int(rng.chance(0.5) ? 10 : N));
      var s = sums(W, two), run = 0, gap = 0;
      while (run < N && s.has(run + 1)) run++;
      if (run < N) gap = run + 1;
      var e = L.coverInfo(W, N, two), cnt = 0;
      s.forEach(function () { cnt++; });
      n++;
      if (e.R !== run || e.gap !== gap || e.covered !== (gap === 0) || e.count !== cnt) bad.push((two ? "hai" : "mot") + " N=" + N + " W=" + J(W) + " engine " + J([e.R, e.gap, e.count]) + " vét " + J([run, gap, cnt]));
    }
    t.ok("coverInfo (R, gap, covered, count) = tập tổng có dấu Set độc lập trên " + n + " bộ ngẫu nhiên (cả hai đĩa / một đĩa, bộ thừa, bộ trùng)", bad.length === 0, bad.slice(0, 3));
    var p = T.fromInput({ mode: "hai", N: 40 }).puzzle, st = T.newState(p);
    apply(p, st, { k: "set", i: 0, val: 1 }); apply(p, st, { k: "set", i: 1, val: 3 });
    t.ok("hint mức 2 nêu đúng phủ liền 1…4 và giới hạn 2R + 1 = 9 cho bộ {1,3} (N=40)", /phủ liền 1…4 g/.test(T.hint(p, st, 2).text) && /2R \+ 1 = 9/.test(T.hint(p, st, 2).text), T.hint(p, st, 2).text);
  })();

  // ====================================================================== 2. mở rộng được (feasible) so với bảng bộ tối ưu vét cạn
  t.group("bachet — feasible (gợi ý có chứng minh) so với bảng mọi bộ tối ưu vét cạn");
  (function () {
    var cases = [[13, true], [10, true], [40, true], [30, true], [15, false], [10, false], [7, false], [20, false]], total = 0, bad = [], unk = 0, yes = 0, no = 0;
    cases.forEach(function (c, ci) {
      var N = c[0], two = c[1], b = bruteMin(N, two, 100000), m = b.m, rng = R.create(900 + ci);
      function oracle(W) { return b.sets.some(function (S) { var rest = S.slice(), ok = true; W.forEach(function (w) { var j = rest.indexOf(w); if (j < 0) ok = false; else rest.splice(j, 1); }); return ok; }); }
      for (var k = 0; k < 160; k++) {
        var size = rng.int(m + 2), W = [], i;
        if (rng.chance(0.5) && size > 0) { var S = b.sets[rng.int(b.sets.length)].slice(); rng.shuffle(S); W = S.slice(0, Math.min(size, m)); if (size > m) W.push(1 + rng.int(N)); if (rng.chance(0.3)) W[rng.int(W.length)] = 1 + rng.int(N); }
        else for (i = 0; i < size; i++) W.push(1 + rng.int(N));
        var e = L.feasible(W, N, two), o = oracle(W);
        total++;
        if (e.state === "unknown") { unk++; continue; }
        if ((e.state === "yes") !== o) bad.push((two ? "hai" : "mot") + " N=" + N + " W=" + J(W) + " engine " + e.state + " oracle " + o);
        else if (o) {
          yes++;
          var full = W.concat(e.add), cov = covers(full, N, two);
          if (!cov || full.length !== m) bad.push("cách hoàn thành sai " + J(W) + " + " + J(e.add));
        } else no++;
      }
    });
    t.ok("feasible = 'tồn tại bộ tối ưu chứa W' (oracle vét cạn) trên " + total + " tập con ngẫu nhiên (" + yes + " có, " + no + " không), không 'unknown'", bad.length === 0 && unk === 0, bad.slice(0, 4).concat(unk ? ["unknown: " + unk] : []));
    var tiny = L.feasible([2], 40, true, 50);
    t.ok("ngân sách quá bé ⇒ 'unknown' (không phải 'no')", tiny.state === "unknown", tiny);
    t.eq("quá nhiều quả ⇒ 'no' ngay", L.feasible([1, 3, 9, 27, 1], 40, true).state, "no");
    t.time("feasible N=364 từ bộ rỗng / {1,3} / {1,3,9,27,81} / quả sai {50} ≤ 800 ms mỗi lần", 3200, function () { [[], [1, 3], [1, 3, 9, 27, 81], [50], [100, 7]].forEach(function (W) { L.feasible(W, 364, true); }); });
    t.eq("N=364 hai đĩa: {1,3,9,27,81,243} mở rộng được, thiếu quả thì thêm đúng quả còn lại", [L.feasible([1, 3, 9, 27, 81], 364, true).add, L.feasible([], 364, true).add], [[243], [1, 3, 9, 27, 81, 243]]);
  })();

  // ====================================================================== 3. đặt quả cân: đệ quy dấu độc lập
  t.group("bachet — đặt quả cân (số quả tối thiểu, số bố trí tối ưu, cân thử)");
  (function () {
    var rng = R.create(4242), bad = [], n = 0, ex = [];
    for (var k = 0; k < 160; k++) {
      var q = 1 + rng.int(6), W = [];
      for (var i = 0; i < q; i++) W.push(1 + rng.int(rng.chance(0.5) ? 9 : 40));
      W.sort(function (a, b) { return a - b; });
      var tot = W.reduce(function (a, b) { return a + b; }, 0), x = 1 + rng.int(tot + 2), b = bruteDat(W, x), e = L.datRows(W, x);
      n++;
      if (e.min !== b.min || (b.min !== 99 && e.rows.length !== b.count)) bad.push("W=" + J(W) + " x=" + x + " engine " + e.min + "/" + e.rows.length + " vét " + b.min + "/" + b.count);
      e.rows.forEach(function (r) { if (L.rowSum(W, r) !== x || L.rowUsed(r) !== e.min) bad.push("hàng sai " + J(r)); });
    }
    t.ok("datRows (min + số bố trí tối ưu, mỗi hàng thăng bằng) = đệ quy dấu độc lập, " + n + " bộ ngẫu nhiên", bad.length === 0, bad.slice(0, 4));
    t.eq("ví dụ thiết kế: 25 g với {1,3,9,27} = 27 − 3 + 1, viết 1 + 27 − 3 (3 quả); 14 g với {1,2,5,10,20} = 20 − 5 − 1 (3 quả)", [L.datRows([1, 3, 9, 27], 25).min, L.datRows([1, 3, 9, 27], 25).rows.length, L.eqText([1, 3, 9, 27], L.datRows([1, 3, 9, 27], 25).rows[0], 25), L.datRows([1, 2, 5, 10, 20], 14).min], [3, 1, "25 = 1 + 27 − 3", 3]);
    var bad2 = [];
    for (var k2 = 0; k2 < 200; k2++) {
      var two = rng.chance(0.5), Wm = [], q2 = 1 + rng.int(5);
      for (var j = 0; j < q2; j++) Wm.push(1 + rng.int(12));
      var tt = 1 + rng.int(40), a = L.arrange(Wm, tt, two), bb = bruteArrange(Wm, tt, two);
      if ((a ? a.used : 99) !== bb) bad2.push("arrange " + J(Wm) + " t=" + tt + " " + (a && a.used) + " vs " + bb);
      if (a) { var s0 = 0; a.coef.forEach(function (c, i2) { s0 += c * Wm[i2]; }); if (s0 !== tt) bad2.push("arrange sai tổng"); }
    }
    t.ok("arrange (cân thử một khối lượng với bộ đang có) = vét cạn độc lập, 200 ca", bad2.length === 0, bad2.slice(0, 3));
    t.eq("closestRow: khoảng cách Hamming nhỏ nhất, hoà → hàng đứng đầu theo thứ tự từ điển (tất định)", [L.closestRow([[0, 1], [1, 0], [1, 1]], [0, 0]), L.closestRow([[2, 2], [1, 0]], [2, 0]), L.closestRow([[1, 2], [1, 0]], [1, 1])], [[0, 1], [2, 2], [1, 2]]);
    t.ok("(vật không cân được) min = 99; input báo lỗi", L.datRows([2, 4], 3).min === 99 && !T.fromInput({ mode: "dat", W: [2, 4], X: [3] }).ok);
  })();

  // ====================================================================== 4. engine: puzzle, check, grade, solution
  t.group("bachet — sinh đề, tất định, bậc, lời giải");
  var SEEDS = [1, 2, 3, 7, 42, 99, 777, 1234, 2026, 20261017, 20261018, 20261023, 424242, 65535, 99991, 123456, 31415, 27182, 16180, 14142];
  (function () {
    var detBad = [], valBad = [], tierBad = [], solBad = [], means = {}, total = 0, hit = 0, gradeBad = [];
    SIZES.forEach(function (sz) {
      TIERS.forEach(function (tier) {
        var sc = [], inb = 0;
        SEEDS.forEach(function (seed) {
          var p = T.generate(seed, { sizeId: sz, tier: tier }), q = T.generate(seed, { sizeId: sz, tier: tier });
          if (J(p) !== J(q)) detBad.push(sz + "/" + tier + " seed " + seed);
          var v = T.validate(p);
          if (!v.ok || J(v.solution) !== J(p.solution)) valBad.push(sz + "/" + tier + " seed " + seed + " " + J(v.errors));
          var st = { v: p.solution.v.slice(), c: null }, ck = T.check(p, st), g = T.grade(p, st);
          if (!ck.solved || g.quality !== 1 || g.stars !== 3 || Puz.grade.errors(g).length) solBad.push(sz + "/" + tier + " seed " + seed + " " + J([ck.solved, g.quality, g.stars, Puz.grade.errors(g)]));
          var ns = T.newState(p), g0 = T.grade(p, ns);
          if (T.check(p, ns).solved || g0.stars !== 0 || Puz.grade.errors(g0).length) gradeBad.push(sz + "/" + tier + " seed " + seed + " bàn trống");
          if (T.difficulty(p) !== p.score) valBad.push("difficulty ≠ score " + sz + "/" + tier);
          total++; sc.push(p.score);
          if (p.tier === tier && inBand(p.score, tier)) { inb++; hit++; }
        });
        means[sz + "/" + tier] = mean(sc);
        if (inb < SEEDS.length * 0.9) tierBad.push(sz + "/" + tier + " " + inb + "/" + SEEDS.length);
      });
      var ms = TIERS.map(function (tr) { return means[sz + "/" + tr]; });
      if (!(ms[0] < ms[1] && ms[1] < ms[2] && ms[2] < ms[3])) tierBad.push("không đơn điệu " + sz + " " + J(ms));
    });
    t.ok("tất định: cùng (seed, cỡ, bậc) → cùng puzzle từng bit (" + total + " đề)", detBad.length === 0, detBad.slice(0, 3));
    t.ok("validate dựng lại ĐÚNG solution của đề sinh ra", valBad.length === 0, valBad.slice(0, 3));
    t.ok("bậc đạt đúng ≥ 90 % ở mọi (cỡ, bậc) và điểm trung bình tăng theo bậc (" + hit + "/" + total + " đúng bậc)", tierBad.length === 0 && hit === total, tierBad.slice(0, 4));
    t.ok("check(solution) solved, grade(solution) 3★ quality 1, đủ trường; bàn trống 0★ chưa solved", solBad.length === 0 && gradeBad.length === 0, solBad.slice(0, 3).concat(gradeBad.slice(0, 2)));
    var pools = SIZES.slice(0, 2).map(function (sz) { return TIERS.map(function (tr) { return L.setPool(sz, tr).length; }); });
    t.info("hồ chứa N theo bậc: hai " + J(pools[0]) + " · một " + J(pools[1]));
    var d1 = T.generate(20261017, { sizeId: "hai", tier: "easy" }), d2 = T.generate(20261018, { sizeId: "hai", tier: "easy" });
    t.ok("seed 20261017 và 20261018 (check.py) cho hai đề hai đĩa dễ khác nhau", J(d1.data) !== J(d2.data), [d1.data, d2.data]);
  })();

  t.group("bachet — mẫu vàng (chụp 24/10/2026): cùng seed → cùng đề, điểm khó đúng bảng");
  (function () {
    var GOLD = {"1|hai|easy":[2,4],"1|hai|medium":[4.7,14],"1|hai|hard":[6.7,41],"1|hai|expert":[8.7,124],"1|mot|easy":[2.8,5],"1|mot|medium":[4.7,18],"1|mot|hard":[6.7,36],"1|mot|expert":[8.7,93],"1|dat|easy":[2.6,"1,3,9","5,11"],"1|dat|medium":[4.6,"1,3,9,27","11,32,39"],"1|dat|hard":[6.5,"1,3,9,27,81","33,59,69,86"],"1|dat|expert":[8.5,"1,3,9,27,81,243","345,238,39,56,123"],"42|hai|easy":[3.4,12],"42|hai|medium":[4.7,37],"42|hai|hard":[6.7,110],"42|hai|expert":[8.7,360],"42|mot|easy":[3.4,9],"42|mot|medium":[4.7,23],"42|mot|hard":[6.7,46],"42|mot|expert":[9.7,153],"42|dat|easy":[2.6,"1,3,9","12,7"],"42|dat|medium":[4.6,"1,3,9,27","15,7,19"],"42|dat|hard":[6.5,"1,3,9,27,81","109,33,91,113"],"42|dat|expert":[8.5,"1,3,9,27,81,243","277,176,308,38,333"],"20261017|hai|easy":[2,4],"20261017|hai|medium":[4.7,15],"20261017|hai|hard":[6.7,44],"20261017|hai|expert":[8.7,133],"20261017|mot|easy":[3.4,8],"20261017|mot|medium":[4.7,22],"20261017|mot|hard":[6.7,44],"20261017|mot|expert":[9.7,141],"20261017|dat|easy":[2.6,"1,3,9","13,10"],"20261017|dat|medium":[4.6,"1,3,9,27","5,40,22"],"20261017|dat|hard":[6.5,"1,3,9,27,81","63,91,74,5"],"20261017|dat|expert":[8.5,"1,3,9,27,81,243","222,228,77,33,83"]}, got = {}, bad = [];
    [1, 42, 20261017].forEach(function (seed) { SIZES.forEach(function (sz) { TIERS.forEach(function (tier) {
      var p = T.generate(seed, { sizeId: sz, tier: tier });
      got[seed + "|" + sz + "|" + tier] = sz === "dat" ? [p.score, p.data.W.join(","), p.data.X.join(",")] : [p.score, p.data.N];
    }); }); });
    Object.keys(GOLD).forEach(function (k) { if (J(GOLD[k]) !== J(got[k])) bad.push(k + " vàng " + J(GOLD[k]) + " nay " + J(got[k])); });
    t.ok("36 đề (3 seed × 3 cỡ × 4 bậc) khớp mẫu vàng — đổi sinh đề/độ khó mà lệch bảng này là làm hỏng liên kết seed, yêu thích, thư viện", bad.length === 0, bad.slice(0, 3));
    t.eq("điểm khó: hai đĩa N=13 → 3, 12 → 3,4, 40 → 4,3, 41 → 6,7; một đĩa 15 → 3, 14 → 3,4; dat {1,3,9}+2 vật → 2,6; {1,2,5,10}+3 vật → 5", [3,3.4,4.3,6.7,3,3.4,2.6,5], [3, 3.4, 4.3, 6.7, 3, 3.4, 2.6, 5].length === 8 ? [L.scoreOf({ mode: "hai", N: 13 }), L.scoreOf({ mode: "hai", N: 12 }), L.scoreOf({ mode: "hai", N: 40 }), L.scoreOf({ mode: "hai", N: 41 }), L.scoreOf({ mode: "mot", N: 15 }), L.scoreOf({ mode: "mot", N: 14 }), L.scoreOf({ mode: "dat", W: [1, 3, 9], X: [4, 5] }), L.scoreOf({ mode: "dat", W: [1, 2, 5, 10], X: [4, 5, 7] })] : []);
  })();

  t.group("bachet — luật, nước đi, hoàn tác, nộp");
  (function () {
    var p = T.fromInput({ mode: "hai", N: 13 }).puzzle, s = T.newState(p), M = p.data.slots, flag = M, bad = [];
    t.ok("trạng thái đầu: " + (M) + " ô quả cân + cờ nộp = 0; m* = 3", s.v.length === M + 1 && s.v.every(function (x) { return x === 0; }) && p.data.m === 3);
    t.ok("nộp khi chưa có quả nào bị từ chối; set ngoài khoảng / không đổi bị từ chối", T.moveFor(p, s, { k: "submit" }) === null && T.moveFor(p, s, { k: "set", i: 0, val: 14 }) === null && T.moveFor(p, s, { k: "set", i: M, val: 1 }) === null && T.moveFor(p, s, { k: "set", i: 0, val: 0 }) === null && T.moveFor(p, s, { k: "xyz" }) === null && T.moveFor(p, s, null) === null);
    var d1 = apply(p, s, { k: "set", i: 0, val: 1 }), d2 = apply(p, s, { k: "set", i: 1, val: 3 });
    t.eq("hai nước set → v = [1,3,0,…]", s.v.slice(0, 3), [1, 3, 0]);
    var snap = s.v.slice(); apply(p, s, { k: "submit" });
    t.ok("nộp bộ chưa phủ: cờ = 1 nhưng KHÔNG solved; grade 0★ 'chưa phủ'; mistakes của diff nộp = 1", s.v[flag] === 1 && !T.check(p, s).solved && T.grade(p, s).stars === 0 && /chưa phủ/.test(T.grade(p, s).text) && T.mistakes(p, { v: snap, c: null }, T.moveFor(p, { v: snap, c: null }, { k: "submit" })) === 1, T.grade(p, s));
    t.ok("sửa một ô sau khi nộp MỞ LẠI (cờ về 0 trong cùng diff)", (function () { var df = apply(p, s, { k: "set", i: 2, val: 9 }); return df && s.v[flag] === 0 && df.d.length === 2; })());
    apply(p, s, { k: "submit" });
    t.ok("moveFor 'reopen' mở lại ván đã nộp; 'submit' khi đã nộp = null", T.moveFor(p, s, { k: "submit" }) === null && T.moveFor(p, s, { k: "reopen" }) !== null && T.moveFor(p, { v: snap, c: null }, { k: "reopen" }) === null);
    // mọi diff hoàn lại bằng reverseDiff
    var q = T.newState(p), acts = [{ k: "set", i: 0, val: 1 }, { k: "set", i: 3, val: 3 }, { k: "set", i: 1, val: 9 }, { k: "submit" }, { k: "set", i: 3, val: 0 }, { k: "clear" }], hist = [];
    acts.forEach(function (a) { var before = q.v.slice(), df = T.moveFor(p, q, a); if (df) { G.applyDiff(q, df.d, false); hist.push([before, df]); } });
    hist.reverse().forEach(function (h) { G.applyDiff(q, G.reverseDiff(h[1].d), false); if (J(q.v) !== J(h[0])) bad.push("hoàn lại sai"); });
    t.ok("mọi diff (set/nộp/xoá/mở lại) hoàn lại đúng bằng reverseDiff", bad.length === 0 && J(q.v) === J(T.newState(p).v), bad);
    // bộ đúng, cố ý nhiều quả hơn → vẫn solved nhưng sao thấp hơn
    var r = T.newState(p); [1, 3, 9, 2].forEach(function (w, i) { apply(p, r, { k: "set", i: i, val: w }); }); apply(p, r, { k: "submit" });
    var g4 = T.grade(p, r);
    t.ok("4 quả {1,3,9,2} phủ 1..13: solved, 2★ (m*+1), quality 0,75, text nêu số quả", T.check(p, r).solved && g4.stars === 2 && g4.quality === 0.75 && g4.value === 4 && g4.best === 3 && /4 quả/.test(g4.text) && Puz.grade.errors(g4).length === 0, g4);
    var r5 = T.newState(p); [1, 3, 9, 2, 4].forEach(function (w, i) { apply(p, r5, { k: "set", i: i, val: w }); }); apply(p, r5, { k: "submit" });
    t.ok("5 quả: 1★", T.grade(p, r5).stars === 1 && T.check(p, r5).solved);
    t.ok("bộ phủ đủ nhưng thiếu cờ nộp thì chưa solved; check.complete đúng", (function () { var z = T.newState(p); [1, 3, 9].forEach(function (w, i) { apply(p, z, { k: "set", i: i, val: w }); }); var c = T.check(p, z); return !c.solved && c.complete === true && c.filled === 3 && c.total === 3; })());
    // dat
    var pd = T.fromInput({ mode: "dat", W: [1, 3, 9, 27], X: [25, 14] }).puzzle, sd = T.newState(pd), q4 = 4;
    t.ok("dat: state = |W|·|X| ô + cờ; solution thăng bằng cả hai vật; best = tổng tối thiểu", sd.v.length === 9 && pd.data.best === L.datRows([1, 3, 9, 27], 25).min + L.datRows([1, 3, 9, 27], 14).min && T.check(pd, { v: pd.solution.v.slice(), c: null }).solved);
    apply(pd, sd, { k: "place", item: 0, i: 3, val: 1 });
    t.ok("dat: đặt quả 27 vào đĩa đối diện vật 25 g → lệch; place không đổi / ngoài khoảng → null; describeCell nêu vật + quả + vị trí", !L.itemBalanced(pd.data, sd, 0) && T.moveFor(pd, sd, { k: "place", item: 0, i: 3, val: 1 }) === null && T.moveFor(pd, sd, { k: "place", item: 2, i: 0, val: 1 }) === null && T.moveFor(pd, sd, { k: "place", item: 0, i: 0, val: 3 }) === null && /Vật 1 \(25 g\), quả 27 g: đĩa đối diện vật/.test(T.describeCell(pd, sd, 3)), T.describeCell(pd, sd, 3));
    apply(pd, sd, { k: "submit" });
    t.ok("dat: nộp khi lệch → mistakes 1, conflicts liệt kê các ô của MỌI vật lệch (vật 1 lệch 27 g, vật 2 còn trống), grade 'còn vật chưa thăng bằng'", T.check(pd, sd).conflicts.length === 8 && /chưa thăng bằng/.test(T.grade(pd, sd).text), T.check(pd, sd));
  })();

  // ====================================================================== 5. mistakes
  t.group("bachet — mistakes (làm mất tối ưu chắc chắn / nộp khi chưa đạt)");
  (function () {
    var p = T.fromInput({ mode: "hai", N: 13 }).puzzle, s = T.newState(p);
    function mis(a) { var df = T.moveFor(p, s, a); var m = df ? T.mistakes(p, s, df) : null; if (df) G.applyDiff(s, df.d, false); return m; }
    t.eq("đặt 1, 3 (đúng hướng): 0 lỗi", [mis({ k: "set", i: 0, val: 1 }), mis({ k: "set", i: 1, val: 3 })], [0, 0]);
    t.eq("thêm quả 4 ({1,3,4} đủ 3 quả mà không phủ 13) = làm mất tối ưu: 1 lỗi; thêm tiếp quả 2 khi đã mất: 0 (không tính lại)", [mis({ k: "set", i: 2, val: 4 }), mis({ k: "set", i: 3, val: 2 })], [1, 0]);
    var s2 = T.newState(p); [1, 3, 9].forEach(function (w, i) { apply(p, s2, { k: "set", i: i, val: w }); });
    t.eq("nộp bộ đúng: 0 lỗi", T.mistakes(p, s2, T.moveFor(p, s2, { k: "submit" })), 0);
    var pd = T.fromInput({ mode: "dat", W: [1, 3, 9], X: [5] }).puzzle, sd = T.newState(pd);
    t.eq("dat: nộp khi chưa thăng bằng = 1 lỗi; đặt ô không tính lỗi", [T.mistakes(pd, sd, T.moveFor(pd, sd, { k: "place", item: 0, i: 0, val: 1 })) || 0, T.mistakes(pd, (apply(pd, sd, { k: "place", item: 0, i: 0, val: 1 }), sd), T.moveFor(pd, sd, { k: "submit" }))], [0, 1]);
  })();

  // ====================================================================== 6. gợi ý
  t.group("bachet — gợi ý: vòng 'mức 3 → áp dụng' từ trạng thái đầu và từ trạng thái có quả sai");
  function playHints(p, setup, rngSeed) {
    var s = T.newState(p), total = p.solution.v.length, steps = 0, flips = 0, guard = total * 3 + 8;
    (setup || []).forEach(function (a) { apply(p, s, a); });
    while (!T.check(p, s).solved && steps < guard) {
      var h = T.hint(p, s, 3);
      if (!h || h.none || !h.action) return { ok: false, steps: steps, why: "hết gợi ý " + (h && h.text), s: s };
      if (!h.why || !h.why.length || !h.text) return { ok: false, steps: steps, why: "mức 3 thiếu text/why", s: s };
      var df = T.moveFor(p, s, h.action);
      if (!df) return { ok: false, steps: steps, why: "action không hợp lệ " + J(h.action), s: s };
      G.applyDiff(s, df.d, false);
      steps++;
    }
    return { ok: T.check(p, s).solved, steps: steps, why: "", s: s };
  }
  (function () {
    var bad = [], loops = 0, maxRatio = 0, worst = "";
    // hai / mot: từ trạng thái đầu cho mọi seed + mọi bậc; có chèn quả sai ngẫu nhiên
    SIZES.slice(0, 2).forEach(function (sz) {
      TIERS.forEach(function (tier) {
        SEEDS.slice(0, 8).forEach(function (seed, si) {
          var p = T.generate(seed, { sizeId: sz, tier: tier }), N = p.data.N, rng = R.create(seed * 7 + si), M = p.data.slots, ins = [];
          [0, 1, 2].forEach(function (mode) {
            ins = [];
            for (var k = 0; k < mode * 1; k++) ins.push({ k: "set", i: rng.int(M), val: 1 + rng.int(N) });
            if (mode === 2) ins.push({ k: "submit" });
            var r = playHints(p, ins);
            loops++;
            var g = r.ok ? T.grade(p, r.s) : null;
            if (!r.ok || g.quality !== 1 || g.stars !== 3) bad.push(sz + "/" + tier + " seed " + seed + " chèn " + J(ins) + " → " + r.why + " " + (g && g.stars));
            else if (r.steps / p.solution.v.length > maxRatio) { maxRatio = r.steps / p.solution.v.length; worst = sz + "/" + tier + " " + seed; }
          });
        });
      });
    });
    t.ok("hai/mot: " + loops + " ván (4 bậc × 8 seed × 3 kiểu chèn 0/1/2 quả ngẫu nhiên + nộp sớm) đều giải xong 3★ bằng gợi ý, ≤ total·3 bước (tỉ lệ lớn nhất " + maxRatio.toFixed(2) + " ở " + worst + ")", bad.length === 0, bad.slice(0, 4));
    var bad2 = [], n2 = 0;
    TIERS.forEach(function (tier) {
      SEEDS.slice(0, 8).forEach(function (seed, si) {
        var p = T.generate(seed, { sizeId: "dat", tier: tier }), d = p.data, rng = R.create(seed + 5 + si), q = d.W.length;
        [0, 1].forEach(function (mode) {
          var ins = [];
          if (mode) for (var k = 0; k < 4; k++) ins.push({ k: "place", item: rng.int(d.X.length), i: rng.int(q), val: rng.int(3) });
          var r = playHints(p, ins);
          n2++;
          var g = r.ok ? T.grade(p, r.s) : null;
          if (!r.ok || g.quality !== 1 || g.stars !== 3) bad2.push("dat/" + tier + " seed " + seed + " " + r.why);
        });
      });
    });
    t.ok("dat: " + n2 + " ván (4 bậc × 8 seed × bàn trống / 4 ô đặt bừa) giải xong 3★ bằng gợi ý", bad2.length === 0, bad2.slice(0, 4));
  })();
  (function () {
    var p = T.fromInput({ mode: "hai", N: 40 }).puzzle, s = T.newState(p), h1, h2, h3, bad = [];
    h1 = T.hint(p, s, 1); h2 = T.hint(p, s, 2); h3 = T.hint(p, s, 3);
    t.ok("hint rỗng N=40: mức 3 đặt quả 1 vào ô 1, có 'vì sao'; mức 1 KHÔNG nêu quả cân; mức 2 nêu phủ liền + giới hạn nhưng chưa nêu quả; tất định", h3.action.k === "set" && h3.action.val === 1 && h3.action.i === 0 && h3.why.length >= 2 && !/Đặt quả cân/.test(h1.text + h2.text) && /2R \+ 1|R \+ 1/.test(h2.text) && J(T.hint(p, s, 2)) === J(h2), [h1.text, h2.text, h3.text]);
    // quả sai: {5} cho N=40 hai đĩa → không mở rộng được
    apply(p, s, { k: "set", i: 0, val: 5 });
    var a1 = T.hint(p, s, 1), a2 = T.hint(p, s, 2), a3 = T.hint(p, s, 3);
    t.ok("quả sai {5}: hint nói trước ('không thể hoàn thành'), mức 2 nêu quả + ô, mức 3 = bỏ quả (set val 0) kèm giải thích đếm", /không thể hoàn thành/.test(a1.text) && /Quả 5 g ở ô 1/.test(a2.text) && a3.action.k === "set" && a3.action.val === 0 && a3.action.i === 0 && a3.why.length >= 1, [a1.text, a2.text, a3]);
    // đã đạt → nộp
    var z = T.newState(p); [1, 3, 9, 27].forEach(function (w, i) { apply(p, z, { k: "set", i: i, val: w }); });
    var b3 = T.hint(p, z, 3);
    t.ok("bộ đã phủ đủ: mức 3 = nộp", b3.action && b3.action.k === "submit");
    apply(p, z, { k: "submit" });
    t.ok("đã nộp và đạt: hint none", T.hint(p, z, 3).none === true);
    // quả hợp lệ nhưng không thuộc bộ chuẩn: N=10 hai đĩa, {2,3,...}
    var p10 = T.fromInput({ mode: "hai", N: 10 }).puzzle, s10 = T.newState(p10);
    apply(p10, s10, { k: "set", i: 0, val: 2 });
    var fe = L.feasible([2], 10, true), h10 = T.hint(p10, s10, 3);
    t.ok("N=10, bộ {2}: " + fe.state + " — hint khớp (có đường ⇒ thêm quả; không ⇒ bỏ)", (fe.state === "yes" && h10.action.k === "set" && h10.action.val > 0) || (fe.state === "no" && h10.action.val === 0), [fe, h10.text]);
    // mức 1, 2 không lộ giá trị mức 3 ở các trạng thái đầu của đề ngẫu nhiên
    var leak = [];
    SEEDS.slice(0, 10).forEach(function (seed) {
      TIERS.forEach(function (tier) {
        var pp = T.generate(seed, { sizeId: "dat", tier: tier }), ss = T.newState(pp), x1 = T.hint(pp, ss, 1), x2 = T.hint(pp, ss, 2), x3 = T.hint(pp, ss, 3);
        if (!x3.action || x3.action.k !== "place" || x1.cells.length || !x2.cells.length || x3.cells[0] !== x2.cells[0] || /quả \d+ g (CÙNG|ở đĩa)/.test(x1.text)) leak.push("dat " + seed + "/" + tier);
        var sp = T.generate(seed, { sizeId: "hai", tier: tier }), s3 = T.newState(sp), y3 = T.hint(sp, s3, 3), y1 = T.hint(sp, s3, 1), y2 = T.hint(sp, s3, 2);
        if (y1.cells.length || !y2.cells.length || y2.cells[0] !== y3.action.i || new RegExp("quả cân " + y3.action.val + " g").test(y1.text + y2.text)) leak.push("set " + seed + "/" + tier);
      });
    });
    t.ok("mức 1 không tô ô; mức 2 tô đúng ô sẽ đặt ở mức 3; mức 1–2 không nêu 'quả cân w g' (40 đề)", leak.length === 0, leak.slice(0, 4));
  })();

  // ====================================================================== 7. replay, trace, constraintView, I/O
  t.group("bachet — replay, constraintView, trace, nhập/xuất");
  (function () {
    var bad = [], n = 0;
    SIZES.forEach(function (sz) {
      TIERS.forEach(function (tier) {
        var p = T.generate(777, { sizeId: sz, tier: tier }), s = T.newState(p), rp = T.replay(p);
        rp.forEach(function (st) { if (!st.text || !st.diff || !st.diff.d.length) bad.push("bước thiếu text/diff " + sz); G.applyDiff(s, st.diff.d, false); });
        n++;
        if (!T.check(p, s).solved) bad.push("replay không ra solved " + sz + "/" + tier);
        if (J(s.v) !== J(p.solution.v)) bad.push("replay ≠ solution.v " + sz + "/" + tier);
        var cv = T.constraintView(p), tr = T.trace(p), sv = T.solve(p);
        if (!cv.summary || !cv.variables.length || !cv.constraints.length) bad.push("constraintView " + sz);
        if (tr.kind !== "matrix" || !tr.steps.length || tr.steps.length > 60) bad.push("trace " + sz);
        if (sv.status !== "unique" || J(sv.solution.v) !== J(p.solution.v) || !sv.steps.length) bad.push("solve " + sz);
        var tx = T.fromText(T.toText(p)), fl = T.fromFile(JSON.parse(JSON.stringify(T.toFile(p))));
        if (!tx.ok || J(tx.puzzle.data) !== J(p.data) || J(tx.puzzle.initial) !== J(p.initial)) bad.push("toText/fromText " + sz + " " + T.toText(p));
        if (!fl.ok || J(fl.puzzle.data) !== J(p.data)) bad.push("toFile/fromFile " + sz);
      });
    });
    t.ok("replay áp tuần tự = solution.v, check solved; constraintView/trace(≤60 bước)/solve; toText↔fromText, toFile↔fromFile (" + n + " đề)", bad.length === 0, bad.slice(0, 4));
    t.eq("toText mẫu", [T.toText(T.fromInput({ mode: "hai", N: 40 }).puzzle), T.toText(T.fromInput({ mode: "mot", N: 15 }).puzzle), T.toText(T.fromInput({ mode: "dat", W: "27, 1,9,3", X: [25, 14] }).puzzle)], ["bachet hai N=40", "bachet mot N=15", "bachet dat W=1,3,9,27 X=25,14"]);
    t.ok("fromText chấp nhận dạng viết tay / có dấu / hoa thường", T.fromText("Bachet HAI N = 13").ok && T.fromText("quả cân bachet một đĩa N:7").ok && T.fromText("bachet đặt W=1, 2, 5, 10, 20 X=14").ok);
    var errs = [T.fromInput(null), T.fromInput({}), T.fromInput({ mode: "hai", N: 0 }), T.fromInput({ mode: "hai", N: 401 }), T.fromInput({ mode: "mot", N: 256 }), T.fromInput({ mode: "hai", N: 3.5 }), T.fromInput({ mode: "dat", W: [], X: [3] }), T.fromInput({ mode: "dat", W: [1, 3], X: [] }),
      T.fromInput({ mode: "dat", W: [1, 2, 3, 4, 5, 6, 7, 8, 9], X: [3] }), T.fromInput({ mode: "dat", W: [0, 3], X: [3] }), T.fromInput({ mode: "dat", W: [1, 3], X: [100] }), T.fromText("bachet"), T.fromText("bachet dat W=1,3"), T.fromFile({}), T.fromFile({ initialState: "mode=hai;N=abc" })];
    t.ok("đề hỏng bị từ chối có lời tiếng Việt (15 ca), không ném", errs.every(function (r) { return r.ok === false && r.errors.length && /[a-zà-ỹ]/i.test(r.errors[0]); }), errs.map(function (r) { return r.ok; }));
    var ok1 = T.fromInput({ mode: "hai", N: 40 }), ok2 = T.fromInput({ mode: "hai", N: 30 }), ok3 = T.fromInput({ mode: "mot", N: 15 });
    t.ok("statusText: N biên báo 'duy nhất' (count 1), N khác 'nhiều bộ' (count 2); status luôn 'unique' = biết chính xác giá trị tối ưu", ok1.status === "unique" && ok1.count === 1 && /duy nhất/.test(ok1.statusText) && ok2.count === 2 && /nhiều bộ/.test(ok2.statusText) && ok3.count === 1 && ok1.statusKind === "ok", [ok1.statusText, ok2.statusText]);
    t.ok("sizeText nêu cỡ đề tự nhập", /N = 40 g · hai đĩa/.test(T.sizeText(ok1.puzzle)) && /4 quả cân · 2 vật/.test(T.sizeText(T.fromInput({ mode: "dat", W: [1, 3, 9, 27], X: [25, 14] }).puzzle)));
    t.ok("fromFile không tin 'solution'/'difficulty' trong tệp", (function () { var f = T.toFile(ok1.puzzle); f.solution = "9 9 9"; f.difficulty = 0.1; var r = T.fromFile(f); return r.ok && J(r.puzzle.solution.v) === J(ok1.puzzle.solution.v) && r.puzzle.score === ok1.puzzle.score; })());
  })();

  // ====================================================================== 8. hiệu năng, đột biến, engine thuần, Daily
  t.group("bachet — hiệu năng");
  t.time("generate 4 bậc × 3 cỡ ≤ 1,5 s", 1500, function () { SIZES.forEach(function (sz) { TIERS.forEach(function (tr) { T.generate(20261017, { sizeId: sz, tier: tr }); }); }); });
  t.time("fromInput N=400 hai đĩa, N=255 một đĩa, dat 8 quả 8 vật ≤ 1 s", 1000, function () { T.fromInput({ mode: "hai", N: 400 }); T.fromInput({ mode: "mot", N: 255 }); var W = [1, 3, 9, 27, 81, 243, 2, 5]; T.fromInput({ mode: "dat", W: W, X: [100, 200, 300, 400, 500, 600, 700, 301] }); });
  t.time("hint + mistakes liên tiếp trên đề chuyên gia (N=364, 6 quả) ≤ 1 s", 1000, function () { var p = T.fromInput({ mode: "hai", N: 364 }).puzzle, s = T.newState(p); for (var i = 0; i < 6; i++) { var h = T.hint(p, s, 3), df = T.moveFor(p, s, h.action); T.mistakes(p, s, df); G.applyDiff(s, df.d, false); } });

  t.group("bachet — vào Daily từ 2026-10-30 (P8) và engine thuần");
  (function () {
    var D = Puz.daily;
    if (!D) { t.ok("core/daily.js có trong ngữ cảnh kiểm", false); return; }
    var types = Puz.types.all().map(function (d) { return d.id; }), bad = [], late = 0, day = "2026-10-01", n = 0;
    for (var i = 0; i < 800; i++) { var f = D.forDay(day, types); n++; if (!f) bad.push(day); else if (f.type === "bachet") { if (day < "2026-10-30") bad.push(day); else late++; } day = Puz.util.addDays(day, 1); }
    t.ok("bachet nằm trong Puz.daily.ORDER và đúng một phiên bản SCHEDULE (tu 2026-10-30, không phiên bản nào trước đó); {n} ngày từ 01/10: không ngày nào TRƯỚC 30/10 ra bachet, từ 30/10 ra đều ({late} ngày)".replace("{n}", n).replace("{late}", late), D.ORDER.indexOf("bachet") >= 0 && D.SCHEDULE.filter(function (v) { return v.ids.indexOf("bachet") >= 0; }).map(function (v) { return v.tu; }).join() === "2026-10-30" && bad.length === 0 && late >= 50, bad.slice(0, 3));
    var src = fs.readFileSync(path.join(ROOT, "assets/js/puzzles/bachet.js"), "utf8");
    t.ok("không dùng Math.random / Date / performance.now / DOM / Puz.text / Puz.ui / localStorage trong engine", !/Math\.random|Date\.now|new Date|performance\.now|document\.|window\.|localStorage|Puz\.text|Puz\.ui|Puz\.stats/.test(src));
    t.ok("ES5: không class / mũi tên / template literal / BigInt", !/\bclass\s+\w|=>|`|BigInt|\b\d+n\b/.test(src));
  })();
};
