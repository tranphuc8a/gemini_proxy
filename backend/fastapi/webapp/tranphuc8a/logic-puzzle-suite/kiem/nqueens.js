/* kiem/nqueens.js — kiểm engine N-Queens (assets/js/puzzles/nqueens.js).
   Nguồn sự thật ĐỘC LẬP (không đối chiếu engine với chính nó):
     · bộ đếm quay lui thường viết riêng trong test (refCount: kiểm hai hậu bằng so sánh hàng/cột/|Δhàng|=|Δcột|, KHÔNG dùng bitmask) cho mọi cỡ;
     · Puz.csp (bộ giải tổng quát của lõi, đã được test lõi đối chiếu số nghiệm công bố) dựng lại bài toán trong test;
     · số nghiệm công bố: OEIS A000170 (N = 4…12 → 2, 10, 4, 40, 92, 352, 724, 2680, 14200). */
"use strict";
var fs = require("fs"), path = require("path");
module.exports = function (t) {
  var Puz = t.Puz, T = Puz.types.get("nqueens"), U = Puz.util, G = Puz.game, R = Puz.rng, C = Puz.csp;
  var ROOT = path.join(__dirname, "..");
  var TIERS = ["easy", "medium", "hard", "expert"];

  // ------------------------------------------------------------ nguồn độc lập
  function rcOf(n, i) { return [Math.floor(i / n), i % n]; }
  function attacks(n, i, j) { var a = rcOf(n, i), b = rcOf(n, j); return a[0] === b[0] || a[1] === b[1] || Math.abs(a[0] - b[0]) === Math.abs(a[1] - b[1]); }
  /** Đếm số cách đặt đủ n hậu chứa các hậu `cells` (quay lui thường, pre-place hậu cho sẵn). Trả {count, sols (≤ keep)}; conflict → 0. */
  function refCount(n, cells, limit, keep) {
    limit = limit || 1e9; keep = keep || 0;
    var cols = [], r, k, i, j;
    for (r = 0; r < n; r++) cols.push(-1);
    for (k = 0; k < cells.length; k++) { var rc = rcOf(n, cells[k]); if (cols[rc[0]] >= 0 && cols[rc[0]] !== rc[1]) return { count: 0, sols: [] }; cols[rc[0]] = rc[1]; }
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) if (cols[i] >= 0 && cols[j] >= 0 && (cols[i] === cols[j] || Math.abs(cols[i] - cols[j]) === j - i)) return { count: 0, sols: [] };
    var fixed = cols.slice(), count = 0, sols = [];
    function ok(row, c) {
      for (var q = 0; q < n; q++) { if (q === row || cols[q] < 0) continue; if (cols[q] === c || Math.abs(cols[q] - c) === Math.abs(q - row)) return false; }
      return true;
    }
    function rec(row) {
      if (count >= limit) return;
      if (row === n) { count++; if (sols.length < keep) sols.push(cols.slice()); return; }
      if (fixed[row] >= 0) { rec(row + 1); return; }
      for (var c = 0; c < n; c++) if (ok(row, c)) { cols[row] = c; rec(row + 1); cols[row] = -1; if (count >= limit) return; }
    }
    rec(0);
    return { count: count, sols: sols };
  }
  function emptyV(n) { var v = []; for (var i = 0; i < n * n; i++) v.push(0); return v; }
  function queensOf(v) { var q = []; for (var i = 0; i < v.length; i++) if (v[i] === 1) q.push(i); return q; }
  function colsToCells(n, cols) { return cols.map(function (c, r) { return r * n + c; }); }
  function validFull(n, v, initialV) {
    var q = queensOf(v), i, j;
    if (q.length !== n) return false;
    for (i = 0; i < q.length; i++) for (j = i + 1; j < q.length; j++) if (attacks(n, q[i], q[j])) return false;
    for (i = 0; i < initialV.length; i++) if (initialV[i] === 1 && v[i] !== 1) return false;
    return true;
  }
  function cspCount(n, cells, limit) {                               // Puz.csp dựng lại trong test
    var vars = [], cons = [], domains = {}, r, s;
    for (r = 0; r < n; r++) vars.push({ name: "R" + r, size: n });
    for (r = 0; r < n; r++) for (s = r + 1; s < n; s++) (function (r, s) { cons.push({ vars: [r, s], test: function (v) { return v[0] !== v[1] && Math.abs(v[0] - v[1]) !== s - r; } }); })(r, s);
    cells.forEach(function (c) { var rc = rcOf(n, c); domains["R" + rc[0]] = (domains["R" + rc[0]] === undefined ? -1 : domains["R" + rc[0]]) & (1 << rc[1]); });
    return C.solve(C.problem({ vars: vars, cons: cons, domains: domains }), { limit: limit, keep: 0 }).count;
  }
  function pz(n, cells) { var o = T.fromInput({ n: n, queens: cells }); return o; }
  function bad(s) { return s === undefined || s === null || s === "" || /undefined|null|NaN/.test(String(s)); }

  // ------------------------------------------------------------ 1. siêu dữ liệu
  t.group("N-Queens — siêu dữ liệu và nội dung");
  t.eq("id/loại/nhóm", [T.id, T.family, T.category], ["nqueens", "Constraint Puzzle", "Ràng buộc"]);
  t.ok("sizes: 6/8/10/12/16, đúng một mặc định là 8", T.sizes.map(function (s) { return s.id; }).join() === "6,8,10,12,16" && T.sizes.filter(function (s) { return s.default; }).length === 1 && T.sizes.filter(function (s) { return s.default; })[0].id === "8");
  t.ok("sizes[].tiers chỉ chứa bậc hợp lệ, không trống", T.sizes.every(function (s) { return s.tiers && s.tiers.length && s.tiers.every(function (x) { return TIERS.indexOf(x) >= 0; }); }), T.sizes.map(function (s) { return s.id + ":" + s.tiers; }));
  (function () {
    var libs = fs.readdirSync(path.join(ROOT, "..", "algorithm-notebook", "assets", "data")).filter(function (f) { return /^lib-.*\.js$/.test(f); }), text = libs.map(function (f) { return fs.readFileSync(path.join(ROOT, "..", "algorithm-notebook", "assets", "data", f), "utf8"); }).join("\n");
    t.ok("algorithm.links[].id có thật trong algorithm-notebook/lib-*.js", T.algorithm.links.length >= 1 && T.algorithm.links.every(function (l) { return text.indexOf('id: "' + l.id + '"') >= 0; }), T.algorithm.links);
  })();
  t.ok("algorithm 3–5 bước, mỗi bước có tiêu đề và nội dung", T.algorithm.steps.length >= 3 && T.algorithm.steps.length <= 5 && T.algorithm.steps.every(function (s) { return !bad(s.title) && !bad(s.text); }));
  t.ok("rules, blurb, difficultyNote không rỗng, không undefined/null/NaN", T.rules.every(function (s) { return !bad(s); }) && !bad(T.blurb) && !bad(T.difficultyNote));

  // ------------------------------------------------------------ 2. số nghiệm công bố
  t.group("N-Queens — số nghiệm công bố (OEIS A000170) qua solve với bàn trống");
  var KNOWN = { 4: 2, 5: 10, 6: 4, 7: 40, 8: 92, 9: 352, 10: 724, 11: 2680, 12: 14200 };
  Object.keys(KNOWN).forEach(function (n) {
    n = +n;
    var p = T.fromInput({ n: n }).puzzle, r;
    t.time("N=" + n + " → " + KNOWN[n] + " nghiệm (solve, bàn trống)", 6000, function () { r = T.solve(p, { limit: 1e7, steps: false }); });
    t.eq("  số nghiệm N=" + n, r.count, KNOWN[n]);
  });
  t.eq("N=4..9: bộ đếm quay lui độc lập trong test cũng ra đúng số công bố", [4, 5, 6, 7, 8, 9].map(function (n) { return refCount(n, [], 1e9).count; }), [2, 10, 4, 40, 92, 352]);
  t.eq("N=2,3 (không cho phép nhập) bị từ chối, không ném lỗi", [T.fromInput({ n: 2 }).ok, T.fromInput({ n: 3 }).ok], [false, false]);

  // ------------------------------------------------------------ 3. vét cạn độc lập, đề tự nhập
  t.group("N-Queens — đề tự nhập: số nghiệm khớp bộ đếm độc lập và Puz.csp (≥ 200 đề N ≤ 8)");
  (function () {
    var rr = R.create(20261017), mism = [], stat = { none: 0, unique: 0, multiple: 0 }, cspBad = [], solBad = [], N = 260, k;
    for (k = 0; k < N; k++) {
      var n = rr.range(4, 8), g = rr.range(0, Math.min(5, n)), cells = [], useSol = rr.chance(0.6);
      if (useSol) {                                               // phần lớn: lấy các hậu từ một lời giải thật (có nghiệm), một phần: ô bất kỳ (hay mâu thuẫn)
        var all = refCount(n, [], 1e9, 5000).sols, s = all[rr.int(all.length)];
        var rows = []; for (var r = 0; r < n; r++) rows.push(r); rr.shuffle(rows);
        for (var q = 0; q < g; q++) cells.push(rows[q] * n + s[rows[q]]);
      } else for (var q2 = 0; q2 < g; q2++) cells.push(rr.int(n * n));
      cells = cells.filter(function (c, i) { return cells.indexOf(c) === i; });
      var ref = refCount(n, cells, 1e9, 3), refStatus = ref.count === 0 ? "none" : ref.count === 1 ? "unique" : "multiple";
      var out = T.fromInput({ n: n, queens: cells }), val = out.puzzle ? T.validate(out.puzzle) : null;
      stat[refStatus]++;
      if (out.status !== refStatus || out.ok !== (ref.count > 0) || out.count !== Math.min(ref.count, 2)) mism.push({ n: n, cells: cells, ref: ref.count, got: [out.status, out.ok, out.count] });
      if (val && (val.status !== refStatus || val.count !== Math.min(ref.count, 2) || val.ok !== (ref.count > 0))) mism.push({ n: n, cells: cells, validate: [val.status, val.count, val.ok] });
      if (out.puzzle) {
        var sv = T.solve(out.puzzle, { limit: 1e6, steps: false });
        if (sv.count !== ref.count || sv.status !== refStatus) solBad.push({ n: n, cells: cells, ref: ref.count, solve: [sv.count, sv.status] });
        if (ref.count > 0 && !validFull(n, out.puzzle.solution.v, out.puzzle.initial.v)) solBad.push({ n: n, cells: cells, why: "solution không hợp lệ" });
        if (ref.count === 0 && out.puzzle.solution !== null) solBad.push({ n: n, cells: cells, why: "vô nghiệm mà solution khác null" });
        if (ref.count > 0 && ref.count <= 40) {                   // tập nghiệm đúng bằng tập độc lập
          var all2 = T.solve(out.puzzle, { limit: 1e6, keep: 100, steps: false }).solutions.map(function (x) { return x.v.join(""); }).sort();
          var exp = refCount(n, cells, 1e9, 100).sols.map(function (c) { var v = emptyV(n); colsToCells(n, c).forEach(function (i) { v[i] = 1; }); return v.join(""); }).sort();
          if (JSON.stringify(all2) !== JSON.stringify(exp)) solBad.push({ n: n, cells: cells, why: "tập nghiệm khác" });
        }
        if (n <= 7 && ref.count < 1500) { var cc = cspCount(n, cells, 100000); if (cc !== ref.count) cspBad.push({ n: n, cells: cells, ref: ref.count, csp: cc }); }
      }
    }
    t.ok("fromInput/validate: status, count, ok khớp bộ đếm độc lập (" + N + " đề: " + JSON.stringify(stat) + ")", mism.length === 0, mism.slice(0, 3));
    t.ok("solve: đếm đủ và tập nghiệm đúng; solution hợp lệ; vô nghiệm → solution null", solBad.length === 0, solBad.slice(0, 3));
    t.ok("Puz.csp (dựng lại trong test) cho cùng số nghiệm", cspBad.length === 0, cspBad.slice(0, 3));
    t.ok("đủ ba loại đề được thử (vô nghiệm / duy nhất / nhiều nghiệm)", stat.none >= 10 && stat.unique >= 10 && stat.multiple >= 10, stat);
  })();

  t.group("N-Queens — fromInput: trường hợp cụ thể");
  (function () {
    var e1 = T.fromInput({ n: 8 });
    t.ok("bàn trống 8×8: ok, nhiều nghiệm, có cảnh báo (nhưng vẫn chơi được)", e1.ok && e1.status === "multiple" && e1.count === 2 && e1.warnings.length === 1 && e1.puzzle.tier === "custom" && e1.puzzle.seed === null && e1.puzzle.score >= 0, e1);
    var e2 = T.fromInput({ n: 8, queens: [0, 9] });
    t.ok("hai hậu cho sẵn ăn nhau (chéo): ok=false, lỗi tiếng Việt", !e2.ok && e2.status === "none" && /ăn nhau/.test(e2.errors[0]), e2.errors);
    var e3 = T.fromInput({ n: 8, queens: [0, 1] });
    t.ok("hai hậu cùng hàng: ok=false", !e3.ok && /Hàng 1/.test(e3.errors.join(" ")), e3.errors);
    var e4 = T.fromInput({ n: 6, queens: [0] });                      // hậu ở góc 6×6: không có nghiệm (4 nghiệm của 6×6 không có hậu ở góc)
    t.ok("6×6 có hậu ở góc (0,0): vô nghiệm đúng như bộ đếm độc lập", !e4.ok && e4.status === "none" && refCount(6, [0], 1e9).count === 0 && /vô nghiệm/.test(e4.errors[0]), e4.errors);
    var e5 = T.fromInput({ n: 4, queens: [1] });
    t.ok("4×4 có hậu ở (0,1): đúng một nghiệm, không cảnh báo", e5.ok && e5.status === "unique" && e5.count === 1 && e5.warnings.length === 0, e5);
    t.eq("  nghiệm 4×4 (0,1) khớp độc lập", e5.puzzle.solution.v.join(""), (function () { var c = refCount(4, [1], 1e9, 1).sols[0], v = emptyV(4); colsToCells(4, c).forEach(function (i) { v[i] = 1; }); return v.join(""); })());
    var e6 = T.fromInput({ n: 8, v: "1" + new Array(64).join("0") });
    t.ok("nhập bằng chuỗi 0/1 độ dài n×n", e6.ok && e6.puzzle.initial.v[0] === 1, e6.errors);
    t.ok("meta chỉ nhận name/source/note là chuỗi", T.fromInput({ n: 6, queens: [1], meta: { name: "Thử", evil: "x", note: 5 } }).puzzle.meta.name === "Thử" && !("evil" in T.fromInput({ n: 6, queens: [1], meta: { name: "Thử", evil: "x" } }).puzzle.meta));
    var big = T.fromInput({ n: 24 });
    t.ok("N=24 bàn trống: ok trong ngân sách", big.ok && big.status === "multiple");
  })();

  // ------------------------------------------------------------ 4. sinh
  t.group("N-Queens — sinh đề: tất định, duy nhất, đúng bậc, đơn điệu, ngân sách");
  var SEEDS = []; for (var sd = 0; sd < 20; sd++) SEEDS.push(1000003 * (sd + 1) + 17);
  var gen = {};                                                       // gen[size][tier] = [puzzle…]
  var timing = [];
  T.sizes.forEach(function (sz) {
    gen[sz.id] = {};
    sz.tiers.forEach(function (tier) {
      var arr = [], ms = [];
      SEEDS.forEach(function (seed) { var t0 = Date.now(); var p = T.generate(seed, { sizeId: sz.id, tier: tier }); ms.push(Date.now() - t0); arr.push(p); });
      gen[sz.id][tier] = arr;
      ms.sort(function (a, b) { return a - b; });
      var hit = arr.filter(function (p) { return p.tier === tier; }).length;
      timing.push(sz.id + "×" + sz.id + " " + tier + ": trung vị " + ms[10] + " ms, xấu nhất " + ms[19] + " ms, đạt bậc " + hit + "/20");
      t.ok("generate " + sz.id + "×" + sz.id + " / " + tier + ": trung vị ≤ 1500 ms và xấu nhất ≤ 4000 ms (đo: " + ms[10] + " / " + ms[19] + " ms)", ms[10] <= 1500 * t.slack && ms[19] <= 4000 * t.slack, ms);
      t.ok("  " + sz.id + "×" + sz.id + " / " + tier + ": đạt đúng bậc ≥ 90 % (" + hit + "/20)", hit >= 18, arr.map(function (p) { return p.score; }));
    });
  });
  t.info(timing.join("\n        "));
  (function () {
    var a = T.generate(424242, { sizeId: "10", tier: "hard" }), b = T.generate(424242, { sizeId: "10", tier: "hard" }), c = T.generate(424243, { sizeId: "10", tier: "hard" });
    t.ok("tất định: cùng (seed, cỡ, bậc) → cùng puzzle từng bit; khác seed → khác", JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(c));
    var all = []; T.sizes.forEach(function (sz) { sz.tiers.forEach(function (tier) { all.push(T.generate(7, { sizeId: sz.id, tier: tier })); all.push(T.generate(7, { sizeId: sz.id, tier: tier })); }); });
    var same = true; for (var i = 0; i < all.length; i += 2) if (JSON.stringify(all[i]) !== JSON.stringify(all[i + 1])) same = false;
    t.ok("tất định trên mọi (cỡ, bậc)", same);
  })();
  (function () {
    var bads = [], truth = [], shape = [], lapsed = 0, worst = 0;
    T.sizes.forEach(function (sz) {
      sz.tiers.forEach(function (tier) {
        gen[sz.id][tier].forEach(function (p) {
          var n = sz.params.n, cells = queensOf(p.initial.v);
          var ref = refCount(n, cells, 2, 1);
          if (ref.count !== 1) bads.push({ size: sz.id, tier: tier, seed: p.seed, ref: ref.count });
          if (!validFull(n, p.solution.v, p.initial.v)) bads.push({ size: sz.id, why: "solution sai" });
          if (n <= 12) { var cs = cspCount(n, cells, 2); if (cs !== 1) bads.push({ size: sz.id, tier: tier, seed: p.seed, csp: cs }); }
          if (T.solve(p, { steps: false }).status !== "unique" || T.validate(p).status !== "unique") bads.push({ size: sz.id, why: "solve/validate không báo unique" });
          if (p.tier !== U.tierOfScore(p.score).id) truth.push({ size: sz.id, tier: tier, got: p.tier, score: p.score });
          if (T.difficulty(p) !== p.score) truth.push({ size: sz.id, why: "difficulty ≠ score", d: T.difficulty(p), s: p.score });
          if (p.type !== "nqueens" || p.sizeId !== sz.id || p.size.n !== n || p.data.n !== n || p.initial.v.length !== n * n || p.id !== U.puzzleId(p) || p.seed !== R.seedOf(p.seed) || p.v !== 1) shape.push({ size: sz.id, tier: tier });
          if (cells.length > n - 3) lapsed++;
        });
      });
    });
    t.ok("mọi đề sinh ra có ĐÚNG MỘT nghiệm (bộ đếm độc lập mọi cỡ + Puz.csp tới 12×12 + solve), solution hợp lệ", bads.length === 0, bads.slice(0, 3));
    t.ok("puzzle.tier trung thực với score; difficulty(puzzle) === score", truth.length === 0, truth.slice(0, 3));
    t.ok("hình dạng puzzle: type, sizeId, size {n}, data {n}, id, seed, v", shape.length === 0, shape.slice(0, 3));
    t.ok("mọi đề còn ≥ 3 hậu để người chơi đặt", lapsed === 0, lapsed);
    var means = [];
    T.sizes.forEach(function (sz) {
      var ms = sz.tiers.map(function (tier) { var a = gen[sz.id][tier]; return a.reduce(function (s, p) { return s + p.score; }, 0) / a.length; });
      means.push(sz.id + ": " + sz.tiers.map(function (x, i) { return x + " " + ms[i].toFixed(2); }).join(" < "));
      var mono = true; for (var i = 1; i < ms.length; i++) if (!(ms[i] > ms[i - 1])) mono = false;
      t.ok("đơn điệu theo bậc (20 seed) ở " + sz.id + "×" + sz.id + ": " + sz.tiers.map(function (x, i) { return x + " " + ms[i].toFixed(2); }).join(" < "), mono, ms);
    });
    // số hậu cho sẵn giảm khi bậc tăng (ít = khó)
    var gm = true;
    T.sizes.forEach(function (sz) { var prev = 1e9; sz.tiers.forEach(function (tier) { var a = gen[sz.id][tier], av = a.reduce(function (s, p) { return s + queensOf(p.initial.v).length; }, 0) / a.length; if (!(av < prev)) gm = false; prev = av; }); });
    t.ok("số hậu cho sẵn trung bình giảm dần khi bậc tăng", gm);
  })();
  (function () {
    var p = T.generate(1, { sizeId: "6", tier: "expert" });
    t.ok("xin bậc không có ở cỡ đó (6×6 Chuyên gia): trả bậc gần nhất và ghi đúng bậc thật", T.sizes[0].tiers.indexOf(p.tier) >= 0 && p.tier === U.tierOfScore(p.score).id, [p.tier, p.score]);
    var q = T.generate(1, { sizeId: "zzz", tier: "nope" });
    t.ok("cỡ/bậc lạ không ném lỗi: dùng cỡ mặc định + bậc Vừa", q.size.n === 8 && !!q.solution);
  })();

  // ------------------------------------------------------------ 5. nước đi / kiểm / lỗi
  t.group("N-Queens — moveFor / check / mistakes");
  (function () {
    var p = gen["8"].medium[0], n = 8, s0 = T.newState(p), given = queensOf(p.initial.v)[0];
    t.ok("newState: bản sao initial, c = null", s0.v.join() === p.initial.v.join() && s0.c === null && s0.v !== p.initial.v);
    t.ok("isGiven đúng với hậu cho sẵn, sai với ô khác", queensOf(p.initial.v).every(function (i) { return T.isGiven(p, i); }) && p.initial.v.every(function (x, i) { return x === 1 || !T.isGiven(p, i); }));
    t.ok("không sửa được ô cho sẵn (set/cycle/val 0) → null", T.moveFor(p, s0, { k: "set", i: given, val: 0 }) === null && T.moveFor(p, s0, { k: "cycle", i: given }) === null && T.moveFor(p, s0, { k: "set", i: given, val: 2 }) === null);
    var empty = -1; for (var i = 0; i < n * n; i++) if (s0.v[i] === 0) { empty = i; break; }
    t.ok("giá trị/chỉ số/kiểu lạ → null, không ném lỗi", [{ k: "set", i: empty, val: 3 }, { k: "set", i: empty, val: -1 }, { k: "set", i: empty, val: "x" }, { k: "set", i: 999, val: 1 }, { k: "set", i: -1, val: 1 }, { k: "set", i: 1.5, val: 1 }, { k: "boom" }, {}, null, undefined, { k: "set", val: 1 }].every(function (a) { return T.moveFor(p, s0, a) === null; }));
    t.ok("set cùng giá trị → null (không đổi gì)", T.moveFor(p, s0, { k: "set", i: empty, val: 0 }) === null);
    var seq = [], cur = T.newState(p);
    [0, 1, 2, 0].forEach(function () { var d = T.moveFor(p, cur, { k: "cycle", i: empty }); seq.push(cur.v[empty]); G.applyDiff(cur, d.d, false); });
    t.eq("cycle: trống → hậu → chấm → trống", seq.concat([cur.v[empty]]), [0, 1, 2, 0, 1]);
    // ngẫu nhiên: áp rồi hoàn lại bằng reverseDiff ra đúng state cũ; check khớp bộ tính độc lập
    var rr = R.create(99), badRev = [], badChk = [], st = T.newState(p), steps = 0;
    for (var k = 0; k < 400; k++) {
      var act = rr.chance(0.1) ? { k: rr.pick(["clear", "clearmarks"]) } : { k: rr.pick(["set", "cycle"]), i: rr.int(n * n), val: rr.int(3) };
      var before = JSON.stringify(st), d = T.moveFor(p, st, act);
      if (!d) continue;
      steps++;
      G.applyDiff(st, d.d, false);
      var mid = JSON.stringify(st);
      G.applyDiff(st, G.reverseDiff(d.d), false);
      if (JSON.stringify(st) !== before) badRev.push(act);
      G.applyDiff(st, d.d, false);
      if (queensOf(p.initial.v).some(function (c) { return st.v[c] !== 1; })) badRev.push({ given: act });
      if (st.v.some(function (x) { return x !== 0 && x !== 1 && x !== 2; })) badRev.push({ range: act });
      var q = queensOf(st.v), exp = q.filter(function (a) { return q.some(function (b) { return a !== b && attacks(n, a, b); }); }), chk = T.check(p, st);
      if (JSON.stringify(chk.conflicts.slice().sort(function (a, b) { return a - b; })) !== JSON.stringify(exp) || chk.solved !== (q.length === n && exp.length === 0) || chk.filled !== q.length || chk.total !== n) badChk.push({ q: q, got: chk, exp: exp });
    }
    t.ok("diff áp rồi hoàn lại bằng reverseDiff ra đúng state cũ; ô cho sẵn nguyên vẹn; giá trị chỉ 0/1/2 (" + steps + " nước)", badRev.length === 0 && steps > 200, badRev.slice(0, 2));
    t.ok("check: conflicts đúng tập hậu ăn nhau (độc lập), solved/filled/total đúng (400 bước ngẫu nhiên)", badChk.length === 0, badChk.slice(0, 2));
    t.ok("check(solution) = solved, không xung đột; check(initial) = chưa xong", T.check(p, { v: p.solution.v.slice(), c: null }).solved && T.check(p, { v: p.solution.v.slice(), c: null }).conflicts.length === 0 && !T.check(p, T.newState(p)).solved);
    var dots = { v: p.solution.v.slice(), c: null }; for (var j = 0; j < dots.v.length; j++) if (dots.v[j] === 0 && j % 3 === 0) dots.v[j] = 2;
    t.ok("chấm loại (2) không ảnh hưởng solved/conflicts", T.check(p, dots).solved && T.check(p, dots).conflicts.length === 0);
    var full = T.newState(p); T.moveFor(p, full, { k: "set", i: empty, val: 1 });
    var cl = { v: p.solution.v.slice(), c: null }, dc = T.moveFor(p, cl, { k: "clear" });
    G.applyDiff(cl, dc.d, false);
    t.ok("clear: bỏ mọi thứ người chơi đặt, giữ hậu cho sẵn (= initial)", cl.v.join() === p.initial.v.join() && T.moveFor(p, cl, { k: "clear" }) === null);
    var cm = { v: dots.v.slice(), c: null }; G.applyDiff(cm, T.moveFor(p, cm, { k: "clearmarks" }).d, false);
    t.ok("clearmarks: chỉ bỏ chấm loại, giữ hậu", cm.v.join() === p.solution.v.join());
  })();

  (function () {                                                      // mistakes: đề duy nhất
    var bads = [], cnt = 0;
    ["8", "10", "12"].forEach(function (sid) {
      var p = gen[sid].medium[1], n = p.size.n, st = T.newState(p), rr = R.create(5);
      for (var k = 0; k < 60; k++) {
        var i = rr.int(n * n); if (st.v[i] !== 0) continue;
        var d = T.moveFor(p, st, { k: "set", i: i, val: 1 }), m = T.mistakes(p, st, d), expect = p.solution.v[i] === 1 ? 0 : 1;
        cnt++;
        if (m !== expect) bads.push({ sid: sid, i: i, m: m, expect: expect });
        if (T.mistakes(p, st, T.moveFor(p, st, { k: "set", i: i, val: 2 })) !== 0) bads.push({ sid: sid, why: "chấm loại bị tính lỗi" });
        G.applyDiff(st, d.d, false);
        if (rr.chance(0.5)) { var d0 = T.moveFor(p, st, { k: "set", i: i, val: 0 }); if (T.mistakes(p, st, d0) !== 0) bads.push({ sid: sid, why: "gỡ hậu bị tính lỗi" }); G.applyDiff(st, d0.d, false); }
      }
    });
    t.ok("mistakes (đề duy nhất): hậu ngoài lời giải = 1 lỗi, hậu đúng = 0, chấm/gỡ = 0 (" + cnt + " nước)", bads.length === 0 && cnt > 50, bads.slice(0, 3));
  })();
  (function () {                                                      // mistakes: đề nhiều nghiệm, đối chiếu định nghĩa với bộ đếm độc lập
    var bads = [], cnt = 0, wrongSeen = 0, rr = R.create(77);
    [[6, []], [7, []], [7, [3]], [8, [0 * 8 + 0]]].forEach(function (cfg) {
      var n = cfg[0], cells = cfg[1], out = T.fromInput({ n: n, queens: cells });
      if (!out.ok) return;
      var p = out.puzzle;
      for (var trial = 0; trial < 12; trial++) {
        var st = T.newState(p), E = [];
        for (var k = 0; k < 6; k++) {
          var i = rr.int(n * n); if (st.v[i] !== 0) continue;
          var d = T.moveFor(p, st, { k: "set", i: i, val: 1 }), m = T.mistakes(p, st, d);
          var base = cells.concat(E), aloneDead = refCount(n, cells.concat([i]), 1).count === 0, baseAlive = refCount(n, base, 1).count > 0, killed = baseAlive && refCount(n, base.concat([i]), 1).count === 0;
          var expect = aloneDead || killed ? 1 : 0;
          cnt++; if (expect) wrongSeen++;
          if (m !== expect) bads.push({ n: n, cells: cells, E: E.slice(), i: i, m: m, expect: expect });
          G.applyDiff(st, d.d, false); E.push(i);
        }
      }
    });
    t.ok("mistakes (đề nhiều nghiệm): khớp định nghĩa kiểm bằng bộ đếm độc lập — không so với solution duy nhất (" + cnt + " nước, " + wrongSeen + " nước sai)", bads.length === 0 && cnt > 100 && wrongSeen > 10, bads.slice(0, 3));
  })();

  // ------------------------------------------------------------ 6. hint
  t.group("N-Queens — hint: chạy thật tới xong (có chèn nước sai), mức 1–2 không lộ đáp án");
  var techCount = {};
  function playWithHints(p, injectAt, rr) {
    var g = G.create(p, { now: function () { return 0; } }), n = p.size.n, steps = 0, injected = 0, issues = [];
    while (!g.finished() && steps < n * 3 + 3) {
      steps++;
      if (injectAt.indexOf(steps) >= 0) {                              // chèn một nước SAI (hậu ngoài lời giải; với đề nhiều nghiệm: hậu không còn lời giải nào)
        var cand = []; for (var i = 0; i < n * n; i++) if (g.state.v[i] === 0 && !(p.solution.v[i] === 1)) cand.push(i);
        if (cand.length) { g.act({ k: "set", i: cand[rr.int(cand.length)], val: 1 }); injected++; continue; }
      }
      var st = JSON.stringify(g.state), h1 = g.hint(1), h2 = g.hint(2), h3 = g.hint(3);
      if (!h3 || h3.none) { issues.push({ why: "hint none khi chưa xong", step: steps }); break; }
      if (JSON.stringify(g.state) !== st) issues.push({ why: "hint làm đổi state" });
      if (JSON.stringify(T.hint(p, g.state, 3)) !== JSON.stringify(h3) || JSON.stringify(T.hint(p, g.state, 1)) !== JSON.stringify(h1)) issues.push({ why: "hint không tất định" });
      techCount[h3.technique] = (techCount[h3.technique] || 0) + 1;
      var isFix = h3.technique === "Gỡ hậu sai";
      if (h1.level !== 1 || h2.level !== 2 || h3.level !== 3) issues.push({ why: "level sai" });
      if (/cột\s*\d+/.test(h1.text) || (!isFix && /cột\s*\d+/.test(h2.text))) issues.push({ why: "mức 1/2 lộ cột", h1: h1.text, h2: h2.text });
      if ([h1, h2, h3].some(function (h) { return bad(h.text) || (h.why || []).some(bad) || !Array.isArray(h.cells); })) issues.push({ why: "text/why hỏng", h: h3 });
      if (!h3.why.length) issues.push({ why: "mức 3 thiếu lời giải thích" });
      if (h3.action.k !== "set" || h3.cells.length !== 1 || h3.cells[0] !== h3.action.i) issues.push({ why: "action/cells mức 3 lệch" });
      if (!isFix && h2.cells.indexOf(h3.action.i) < 0) issues.push({ why: "mức 2 không chỉ vùng chứa ô sẽ đặt" });
      if (isFix && (h3.action.val !== 0 || g.state.v[h3.action.i] !== 1 || T.isGiven(p, h3.action.i))) issues.push({ why: "gỡ hậu không hợp lệ" });
      if (!isFix && p.solution && p.solution.v[h3.action.i] !== 1) issues.push({ why: "hint đặt hậu ngoài lời giải duy nhất", i: h3.action.i });
      var r = g.act(h3.action);
      if (!r.ok) { issues.push({ why: "action bị từ chối", reason: r.reason }); break; }
      if (!isFix && r.mistakes) issues.push({ why: "hint mức 3 gây lỗi" });
    }
    return { solved: g.status === "solved", steps: steps, injected: injected, issues: issues, game: g };
  }
  (function () {
    var rr = R.create(31337), res = [], total = 0, solvedAll = true, maxRatio = 0, issues = [], inj = 0;
    T.sizes.forEach(function (sz) {
      sz.tiers.forEach(function (tier) {
        gen[sz.id][tier].slice(0, 5).forEach(function (p) {
          var withWrong = playWithHints(p, [2, 5], rr), clean = playWithHints(p, [], rr);
          [withWrong, clean].forEach(function (r) { total++; if (!r.solved) { solvedAll = false; res.push({ size: sz.id, tier: tier, seed: p.seed, steps: r.steps }); } maxRatio = Math.max(maxRatio, r.steps / p.size.n); issues = issues.concat(r.issues.map(function (x) { x.size = sz.id; return x; })); inj += r.injected; });
        });
      });
    });
    t.ok("lặp hint mức 3 giải xong mọi đề mẫu, có và không có nước sai chèn giữa chừng (" + total + " ván, " + inj + " nước sai chèn)", solvedAll, res.slice(0, 3));
    t.ok("mỗi bước hint hợp lệ; mức 1/2 không lộ cột; hint tất định; hậu hint luôn nằm trong lời giải duy nhất", issues.length === 0, issues.slice(0, 3));
    t.ok("số bước ≤ 3 × số hậu (tối đa đo được " + maxRatio.toFixed(2) + " × N)", maxRatio <= 3, maxRatio);
    t.info("kỹ thuật đã dùng: " + JSON.stringify(techCount));
    t.ok("đã dùng được cả bốn bậc kỹ thuật gợi ý (hàng/cột/thử-và-loại/gỡ hậu sai)", ["Hàng chỉ còn một cột", "Thử và loại", "Gỡ hậu sai"].every(function (k) { return techCount[k] > 0; }) && (techCount["Cột chỉ còn một hàng"] > 0 || techCount["Thử và loại sâu"] > 0), techCount);
  })();
  (function () {                                                      // đề tự nhập nhiều nghiệm: hint vẫn giải xong; đề có hậu sai không thể hoàn thành
    var rr = R.create(4), ok = true, why = [];
    [[6, []], [7, [3]], [8, []], [9, [4]], [10, []]].forEach(function (cfg) {
      var out = T.fromInput({ n: cfg[0], queens: cfg[1] });
      var r = playWithHints(out.puzzle, [2], rr);
      if (!r.solved || r.steps > cfg[0] * 3) { ok = false; why.push({ n: cfg[0], steps: r.steps, solved: r.solved }); }
      var bogus = r.issues.filter(function (x) { return x.why !== "hint đặt hậu ngoài lời giải duy nhất"; });          // solution của đề nhiều nghiệm chỉ là MỘT trong các nghiệm
      if (bogus.length) { ok = false; why.push(bogus[0]); }
      if (!r.game.check().solved || !validFull(cfg[0], r.game.state.v, out.puzzle.initial.v)) { ok = false; why.push({ n: cfg[0], why: "kết quả không hợp lệ theo bộ kiểm độc lập" }); }
    });
    t.ok("đề tự nhập nhiều nghiệm: hint chạy tới xong (có chèn nước sai) ra bàn hợp lệ theo bộ kiểm độc lập", ok, why);
  })();
  (function () {
    var p = gen["8"].hard[0], st = T.newState(p), n = 8, h;
    h = T.hint(p, { v: p.solution.v.slice(), c: null }, 2);
    t.ok("bàn đã xong → hint none:true có text tiếng Việt", h.none === true && !bad(h.text) && h.level === 2, h);
    var wrong = -1; for (var i = 0; i < n * n; i++) if (st.v[i] === 0 && p.solution.v[i] !== 1) { wrong = i; break; }
    var s2 = { v: st.v.slice(), c: null }; s2.v[wrong] = 1;
    var h1 = T.hint(p, s2, 1), h2 = T.hint(p, s2, 2), h3 = T.hint(p, s2, 3);
    t.ok("có hậu sai → báo gỡ hậu ĐÓ trước (mức 1 nêu hàng, mức 3 là action xoá)", /Có hậu đang đặt sai/.test(h1.text) && h3.action.k === "set" && h3.action.val === 0 && h3.action.i === wrong && h2.cells[0] === wrong, [h1.text, h3.action, wrong]);
    var many = { v: st.v.slice(), c: null }; var wr = []; for (i = 0; i < n * n && wr.length < 3; i++) if (st.v[i] === 0 && p.solution.v[i] !== 1 && Math.floor(i / n) !== Math.floor((wrong >= 0 ? wrong : 0) / n) && wr.every(function (w) { return Math.floor(w / n) !== Math.floor(i / n); })) wr.push(i);
    wr.forEach(function (w) { many.v[w] = 1; });
    var removed = 0, ss = many;
    for (var k = 0; k < 6; k++) { var hh = T.hint(p, ss, 3); if (hh.technique !== "Gỡ hậu sai") break; ss = { v: ss.v.slice(), c: null }; ss.v[hh.action.i] = 0; removed++; }
    t.ok("nhiều hậu sai: gỡ lần lượt hết (" + removed + " lần) rồi mới gợi ý nước đúng", removed === wr.length && T.hint(p, ss, 3).technique !== "Gỡ hậu sai", [removed, wr.length]);
    t.ok("đề không hợp lệ: hint none, không ném lỗi", T.hint({}, { v: [] }, 1).none === true && T.hint(null, null, 3).none === true);
    var h5 = T.hint(p, st, 7);
    t.ok("level ngoài 1..3 được kẹp lại", h5.level === 3 && T.hint(p, st, 0).level === 1);
  })();

  // ------------------------------------------------------------ 7. replay
  t.group("N-Queens — replay");
  (function () {
    var bads = [], cnt = 0, stepsMax = 0;
    var puzzles = [];
    T.sizes.forEach(function (sz) { sz.tiers.forEach(function (tier) { puzzles.push(gen[sz.id][tier][3]); }); });
    puzzles.push(T.fromInput({ n: 8 }).puzzle, T.fromInput({ n: 6 }).puzzle, T.fromInput({ n: 7, queens: [3] }).puzzle);
    puzzles.forEach(function (p) {
      var rep = T.replay(p), st = T.newState(p); cnt++;
      if (!rep.length) { bads.push({ id: p.id, why: "replay rỗng" }); return; }
      stepsMax = Math.max(stepsMax, rep.length);
      rep.forEach(function (s, i) {
        if (bad(s.text) || !s.diff || !s.diff.d || !s.diff.d.length || !Array.isArray(s.cells) || !s.cells.length || bad(s.technique) || (s.why || []).some(bad)) bads.push({ id: p.id, step: i, why: "thiếu text/diff/cells/technique" });
        s.diff.d.forEach(function (e) { if (st.v[e[1]] !== e[2]) bads.push({ id: p.id, step: i, why: "diff không khớp state" }); });
        G.applyDiff(st, s.diff.d, false);
        if (T.isGiven(p, s.cells[0])) bads.push({ id: p.id, step: i, why: "đụng ô cho sẵn" });
      });
      if (!T.check(p, st).solved || !validFull(p.size.n, st.v, p.initial.v)) bads.push({ id: p.id, why: "replay không kết thúc ở bàn giải xong" });
      if (rep.length !== p.size.n - queensOf(p.initial.v).length) bads.push({ id: p.id, why: "số bước ≠ số hậu cần đặt", got: rep.length });
    });
    t.ok("replay: áp tuần tự ra bàn giải xong hợp lệ; mỗi bước có text/diff/cells/technique (" + cnt + " đề, tối đa " + stepsMax + " bước)", bads.length === 0, bads.slice(0, 3));
    var s = T.solve(gen["10"].hard[0]);
    t.ok("solve(...).steps / techniques lấy từ cùng lời giải (technique + text)", s.steps.length > 0 && s.steps.every(function (x) { return !bad(x.technique) && !bad(x.text); }) && Object.keys(s.techniques).reduce(function (a, k) { return a + s.techniques[k]; }, 0) === s.steps.length, s);
    t.ok("đề vô nghiệm → replay = []", T.replay({ v: 1, type: "nqueens", size: { n: 6 }, data: { n: 6 }, initial: { v: (function () { var v = emptyV(6); v[0] = 1; return v; })() }, solution: null }).length === 0);
  })();

  // ------------------------------------------------------------ 8. vòng tròn nhập/xuất, đầu vào xấu
  t.group("N-Queens — toFile/fromFile, toText/fromText, đầu vào xấu");
  (function () {
    var bads = [], list = [];
    T.sizes.forEach(function (sz) { sz.tiers.forEach(function (tier) { list.push(gen[sz.id][tier][0]); }); });
    list.push(T.fromInput({ n: 4, queens: [1] }).puzzle, T.fromInput({ n: 9 }).puzzle, T.fromInput({ n: 24 }).puzzle);
    list.forEach(function (p) {
      var f = T.toFile(p), f2 = JSON.parse(JSON.stringify(f)), back = T.fromFile(f2), tx = T.toText(p), bt = T.fromText(tx);
      if (!back.ok || JSON.stringify(back.puzzle.initial) !== JSON.stringify(p.initial) || JSON.stringify(back.puzzle.data) !== JSON.stringify(p.data) || JSON.stringify(back.puzzle.size) !== JSON.stringify(p.size)) bads.push({ id: p.id, why: "file" });
      if (!bt.ok || JSON.stringify(bt.puzzle.initial) !== JSON.stringify(p.initial) || JSON.stringify(bt.puzzle.data) !== JSON.stringify(p.data)) bads.push({ id: p.id, why: "text" });
      if (f.type !== "nqueens" || f.initialState.length !== p.size.n * p.size.n || !/^[01]+$/.test(f.initialState) || (p.solution && f.solution.length !== f.initialState.length) || f.difficulty !== p.score) bads.push({ id: p.id, why: "định dạng toFile" });
      if (tx.split("\n").length !== p.size.n || !tx.split("\n").every(function (l) { return /^[.Q]( [.Q])*$/.test(l) && l.split(" ").length === p.size.n; })) bads.push({ id: p.id, why: "định dạng toText", tx: tx });
    });
    t.ok("vòng tròn file/text giữ nguyên initial, data, size (" + list.length + " đề, 4×4 … 24×24)", bads.length === 0, bads.slice(0, 3));
    t.ok("toFile giữ seed; fromFile nhận seed số", T.fromFile(T.toFile(gen["8"].easy[0])).puzzle.seed === gen["8"].easy[0].seed);
    var ex = T.fromText(". Q . .\n. . . Q\nQ . . .\n. . Q .");
    t.ok("fromText: lưới ví dụ trong spec (4×4 có đủ 4 hậu = một nghiệm hợp lệ) → ok, duy nhất", ex.ok && ex.status === "unique" && ex.warnings.length === 0, ex);
    t.eq("  hậu ở (0,1),(1,3),(2,0),(3,2)", queensOf(ex.puzzle.initial.v), [1, 7, 8, 14]);
    t.ok("fromText chấp nhận 1/0/-/♛, bỏ qua khoảng trắng, | và dòng trống; dạng gọn một dòng", (function () {
      var a = T.fromText("0 1 0 0\n0 0 0 1\n\n1 - 0 0\n0 0 1 0"), b = T.fromText("|. ♛ . .|\n|. . . ♛|\n|♛ . . .|\n|. . ♛ .|"), c = T.fromText(".q.............."), d = T.fromText("0 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0");
      return a.ok && b.ok && JSON.stringify(a.puzzle.initial) === JSON.stringify(b.puzzle.initial) && c.ok && c.puzzle.initial.v[1] === 1 && queensOf(c.puzzle.initial.v).length === 1 && d.ok && JSON.stringify(c.puzzle.initial) === JSON.stringify(d.puzzle.initial);
    })());
    var BAD_INPUTS = [null, undefined, 42, "", "   ", [], {}, { n: 3 }, { n: 25 }, { n: "abc" }, { n: 8.5 }, { n: 8, v: [1, 2, 3] }, { n: 4, v: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7] }, { n: 4, v: "0102000000000000" }, { n: 4, queens: [99] }, { n: 4, queens: ["x"] }, { n: 4, queens: -1 }, { n: 4, v: { a: 1 } }, { n: [4] }, { n: 4, v: 5 }];
    var thrown = [], notOk = 0;
    BAD_INPUTS.forEach(function (x, i) { try { var o = T.fromInput(x); if (o.ok === false && o.errors.length && o.errors.every(function (e) { return !bad(e); })) notOk++; else if (o.ok) thrown.push({ i: i, why: "ok=true với đầu vào xấu", x: x }); } catch (e) { thrown.push({ i: i, err: e.message }); } });
    t.ok("fromInput: đầu vào xấu → ok:false + lỗi tiếng Việt, không ném (" + notOk + "/" + BAD_INPUTS.length + ")", thrown.length === 0 && notOk === BAD_INPUTS.length, thrown.slice(0, 3));
    var BAD_TEXT = [null, undefined, 5, "", "\n\n", "XXXX", "Q Q Q\nQ Q", ". . .\n. . .\n. . .", "Q Q Q Q Q", "ab\ncd", "Q . . .\n. . . .\n. . . .", ". . . . .\n. . . . .", { a: 1 }];
    var th2 = [], ok2 = 0;
    BAD_TEXT.forEach(function (x, i) { try { var o = T.fromText(x); if (o.ok === false && o.errors.length && o.errors.every(function (e) { return !bad(e); })) ok2++; else th2.push({ i: i, ok: o.ok }); } catch (e) { th2.push({ i: i, err: e.message }); } });
    t.ok("fromText: đầu vào xấu → ok:false + lỗi, không ném (" + ok2 + "/" + BAD_TEXT.length + ")", th2.length === 0 && ok2 === BAD_TEXT.length, th2.slice(0, 3));
    var BAD_FILES = [null, undefined, 3, "x", [], {}, { type: "sudoku" }, { type: "nqueens" }, { type: "nqueens", initialState: "" }, { type: "nqueens", initialState: "01x0" }, { type: "nqueens", initialState: "0100", size: { n: 4 } }, { type: "nqueens", initialState: "0".repeat(15), size: { n: 4 } }, { type: "nqueens", initialState: "1".repeat(16), size: { n: 4 } }, { type: "nqueens", initialState: 7 }];
    var th3 = [], ok3 = 0;
    BAD_FILES.forEach(function (x, i) { try { var o = T.fromFile(x); if (o.ok === false && o.errors.length && o.errors.every(function (e) { return !bad(e); })) ok3++; else th3.push({ i: i, ok: o.ok }); } catch (e) { th3.push({ i: i, err: e.message }); } });
    t.ok("fromFile: tệp xấu → ok:false + lỗi, không ném (" + ok3 + "/" + BAD_FILES.length + ")", th3.length === 0 && ok3 === BAD_FILES.length, th3.slice(0, 3));
    t.ok("fromFile KHÔNG tin difficulty/solution trong tệp", (function () { var f = T.toFile(gen["8"].easy[0]); f.difficulty = 9.9; f.solution = "0".repeat(64); var o = T.fromFile(f); return o.ok && o.puzzle.score !== 9.9 && validFull(8, o.puzzle.solution.v, o.puzzle.initial.v) && o.puzzle.tier === "custom"; })());
    var thr = [], ths = [{}, { data: { n: 8 } }, { data: { n: 8 }, initial: { v: [1] } }, { data: { n: 99 }, initial: { v: [] } }, null, 5, "x"];
    ths.forEach(function (x) { ["solve", "validate", "difficulty", "check", "constraintView", "trace", "replay", "toText", "toFile"].forEach(function (fn) { try { var args = fn === "check" ? [x, { v: [] }] : [x]; T[fn].apply(T, args); } catch (e) { thr.push(fn + ": " + e.message); } }); });
    t.ok("solve/validate/difficulty/check/constraintView/trace/replay/toText/toFile với puzzle hỏng không ném lỗi", thr.length === 0, thr.slice(0, 3));
    t.ok("validate puzzle hỏng → ok:false, status none, lỗi tiếng Việt", (function () { var v = T.validate({ data: { n: 8 }, initial: { v: [1] } }); return !v.ok && v.status === "none" && v.errors.length && !bad(v.errors[0]); })());
  })();

  // ------------------------------------------------------------ 9. constraintView, trace, describeCell
  t.group("N-Queens — constraintView, trace, describeCell");
  (function () {
    var p6 = T.fromInput({ n: 6, queens: [1] }).puzzle, p12 = gen["12"].medium[0], p4 = T.fromInput({ n: 4 }).puzzle;
    [p6, p12, p4].forEach(function (p) {
      var cv = T.constraintView(p), n = p.size.n, pairs = n * (n - 1) / 2, g = queensOf(p.initial.v).length;
      t.ok("constraintView " + n + "×" + n + ": n biến, " + pairs + " cặp, counts khớp, chuỗi sạch", cv.variables.length === n && cv.counts.variables === n && cv.counts.pairConstraints === pairs && cv.counts.givens === g && cv.counts.constraints === pairs + g && !bad(cv.summary) && cv.constraints.length >= 1 && cv.constraints.every(function (c) { return !bad(c); }) && cv.variables.every(function (v) { return !bad(v.name) && !bad(v.domain); }) && cv.variables.length < 40, cv);
      t.ok("  danh sách ràng buộc gọn khi quá nhiều (≤ 40 dòng liệt kê cặp)", cv.constraints.length <= 1 + 40 + g + 2, cv.constraints.length);
    });
    var cv6 = T.constraintView(p6);
    t.ok("6×6: liệt kê đủ 15 cặp + ràng buộc cho sẵn", cv6.constraints.filter(function (c) { return /^Hậu hàng \d+ và hàng \d+/.test(c); }).length === 15 && cv6.constraints.some(function (c) { return /cho sẵn ở cột 2/.test(c); }));
    var tr = T.trace(T.fromInput({ n: 6 }).puzzle), nodes = tr.nodes;
    t.ok("trace 6×6 trống: kind tree, có gốc, cha có id nhỏ hơn con, trạng thái hợp lệ, đủ 4 nút lời giải", tr.kind === "tree" && nodes.length > 10 && nodes[0].parent === -1 && nodes.every(function (nd, i) { return nd.id === i && (i === 0 || (nd.parent >= 0 && nd.parent < nd.id)); }) && nodes.every(function (nd) { return /^(fail|dead|ok|solution)$/.test(nd.status) && !bad(nd.label); }) && nodes.filter(function (nd) { return nd.status === "solution"; }).length === 4 && tr.truncated === false && !bad(tr.note), [nodes.length, tr.truncated]);
    t.ok("  nhãn dạng \"Hàng r → cột c\"", nodes.slice(1).every(function (nd) { return /^Hàng \d+ → cột \d+$/.test(nd.label); }));
    var tr16 = T.trace(gen["16"].hard[0]);
    t.ok("trace 16×16: ≤ 600 nút, cắt thì báo truncated + note", tr16.nodes.length <= 600 && tr16.nodes.length >= 1 && (tr16.nodes.length < 600 || tr16.truncated) && tr16.nodes.every(function (nd) { return /^(fail|dead|ok|solution)$/.test(nd.status); }), [tr16.nodes.length, tr16.truncated]);
    var tr12 = T.trace(T.fromInput({ n: 12 }).puzzle);
    t.ok("trace 12×12 trống (cây khổng lồ): ≤ 600 nút, truncated=true", tr12.nodes.length <= 600 && tr12.truncated === true);
    t.time("trace 16×16 ≤ 1,5 s", 1500, function () { T.trace(gen["16"].expert[0]); });
    var trBad = T.trace({ v: 1, type: "nqueens", size: { n: 6 }, data: { n: 6 }, initial: { v: (function () { var v = emptyV(6); v[0] = 1; return v; })() } });
    t.ok("trace của đề vô nghiệm: gốc fail, không nút nào ok/solution", trBad.nodes[0].status === "fail" && trBad.nodes.every(function (x) { return x.status === "fail" || x.status === "dead"; }) && trBad.solutions === 0, trBad.nodes.map(function (x) { return x.status; }));
    var p = gen["8"].easy[0], st = T.newState(p), gi = queensOf(p.initial.v)[0], e = st.v.indexOf(0);
    var texts = [T.describeCell(p, st, gi), T.describeCell(p, st, e), T.describeCell(p, { v: p.solution.v.slice(), c: null }, p.solution.v.indexOf(1))];
    var s2 = { v: st.v.slice(), c: null }; s2.v[e] = 2; texts.push(T.describeCell(p, s2, e));
    t.ok("describeCell: tiếng Việt, nêu hàng/cột và trạng thái", texts.every(function (x) { return !bad(x) && /^Hàng \d+, cột \d+, /.test(x); }) && /cho sẵn/.test(texts[0]) && /trống/.test(texts[1]) && /đã đánh dấu loại/.test(texts[3]), texts);
    t.ok("describeCell ô ngoài bàn không ném", !bad(T.describeCell(p, st, 9999)) && !bad(T.describeCell(null, null, 1)));
    var conflictState = { v: emptyV(8), c: null }; conflictState.v[0] = 1; conflictState.v[9] = 1;
    t.ok("describeCell: hậu đang ăn nhau được nêu", /đang ăn hậu khác/.test(T.describeCell(T.fromInput({ n: 8 }).puzzle, conflictState, 0)));
  })();

  // ------------------------------------------------------------ 10. hiệu năng đề tự nhập
  t.group("N-Queens — hiệu năng đề tự nhập (≤ 1 s)");
  (function () {
    var rr = R.create(8), worst = 0, label = "";
    for (var k = 0; k < 40; k++) {
      var n = rr.range(10, 24), g = rr.range(0, 6), cells = [];
      var solV = T.solve(T.fromInput({ n: n }).puzzle, { steps: false }).solution.v;                  // một lời giải thật (và kiểm độc lập bằng validFull) để lấy hậu cho sẵn nhất quán
      if (!validFull(n, solV, emptyV(n))) t.ok("lời giải của bàn trống " + n + "×" + n + " hợp lệ theo bộ kiểm độc lập", false);
      var sol = []; for (var r0 = 0; r0 < n; r0++) for (var c0 = 0; c0 < n; c0++) if (solV[r0 * n + c0] === 1) sol[r0] = c0;
      var rows = []; for (var r = 0; r < n; r++) rows.push(r); rr.shuffle(rows);
      for (var q = 0; q < g; q++) cells.push(rows[q] * n + sol[rows[q]]);
      var t0 = Date.now(), o = T.fromInput({ n: n, queens: cells }); T.validate(o.puzzle); T.solve(o.puzzle, { steps: false });
      var ms = Date.now() - t0; if (ms > worst) { worst = ms; label = n + "×" + n + " với " + g + " hậu"; }
    }
    t.ok("fromInput + validate + solve trên 40 đề N 10…24 (chậm nhất " + worst + " ms: " + label + ")", worst <= 1000 * t.slack, worst);
    var t1 = Date.now(), o2 = T.fromInput({ n: 24, queens: [0, 24 * 2 + 5, 24 * 5 + 11] }); T.solve(o2.puzzle);
    t.ok("24×24 ít hậu cho sẵn (kể cả steps): " + (Date.now() - t1) + " ms ≤ 1 s; ok khớp bộ kiểm độc lập", Date.now() - t1 <= 1000 * t.slack && o2.ok === (o2.puzzle.solution !== null && validFull(24, o2.puzzle.solution.v, o2.puzzle.initial.v)));
    var t2 = Date.now(), trunc = T.solve(T.fromInput({ n: 24 }).puzzle, { limit: 1e12, maxNodes: 20000, steps: false });
    t.ok("maxNodes cạn → truncated + cảnh báo, không treo (" + (Date.now() - t2) + " ms)", trunc.truncated === true && /Chưa xác định hết/.test(trunc.warning) && trunc.status === "multiple" && Date.now() - t2 < 2000);
  })();

  // ------------------------------------------------------------ 11. ván chơi hoàn chỉnh qua Puz.game
  t.group("N-Queens — ván chơi qua Puz.game");
  (function () {
    var p = gen["8"].medium[2], g = G.create(p, { now: function () { return 0; } }), done = false;
    g.on(function (ev) { if (ev.type === "solved") done = true; });
    var solCells = queensOf(p.solution.v).filter(function (i) { return !T.isGiven(p, i); }), wrongCell = p.solution.v.indexOf(0, 0);
    while (p.initial.v[wrongCell] === 1 || p.solution.v[wrongCell] === 1) wrongCell++;
    var rw = g.act({ k: "set", i: wrongCell, val: 1 });
    t.ok("đặt hậu sai: nước đi hợp lệ, tính 1 lỗi", rw.ok && rw.mistakes === 1 && g.counters.mistakes === 1);
    t.ok("undo hậu sai về đúng trạng thái trước; số lỗi đã mắc giữ nguyên", g.undo() && g.state.v[wrongCell] === 0 && g.counters.mistakes === 1);
    solCells.forEach(function (i, k) { var r = g.act({ k: "set", i: i, val: 1 }); if (!r.ok || r.mistakes) done = done || false; });
    t.ok("đặt đúng các hậu còn lại → solved, sự kiện solved, 1 lỗi tổng", g.status === "solved" && done && g.counters.mistakes === 1 && g.record().result === "solved");
    var g2 = G.create(p, { now: function () { return 0; } }); g2.act({ k: "set", i: wrongCell, val: 1 });
    t.ok("reveal điền lời giải (xoá hậu sai) và ghi revealed", g2.reveal() && g2.state.v.join() === p.solution.v.join() && g2.record().result === "revealed");
  })();
};
